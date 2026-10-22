// The Realm's lot in 3D (views/realm.js and views/realm-raid.js): three.js (js/vendor/three, MIT), the buildings from
// views/realm-models.js, a camera looking down across the lot corner-on (a diamond, as these games are), dragged to
// pan, pinched or wheeled to zoom. The lot lies in the middle of its land's open ground (img/realm/scenery/,
// tools/realm/sceneries.py: a blank portrait landscape a land, on any screen) laid on the ground so the camera sees it
// as painted; the camera never looks past the landscape's edges, nor zooms out further than fills the screen with it
// (the owner's ask, Oct 2026: each tall enough round the lot to zoom well out; without it: a meadow with a
// moat round it, pines beyond and mountains far off). The Keep, gold mines, archer towers and dragon hatcheries are drawn
// from their art (views/realm-sprites.js), and folk stand about: villagers at work by their buildings, an archer up each tower, a cannon's crew round it. It
// draws when something moved (a finger, a raid) and, while there are folk about, a few times a second for them.
// In a raid it also draws the raiders (instanced: a few draw calls however many), each drawn from his picture (img/realm/
// army/, tools/realm/army.py: stood up facing the camera, turned the way he's going, a soft shadow under him; the
// Dragon in the air), what
// the defenses loose and what the raiders shoot (arrows, bolts, boulders, fire), dust where a building goes down.
// load() → true when three.js is in and this phone has WebGL; create(host, opts) → the view (see its methods).
import * as FM from './realm-models.js';
import * as SPR from './realm-sprites.js';
import {KINDS, TROOPS, N, EDGE} from '../core/realm.js';
import * as data from '../core/data.js';
import {createWildlife} from './realm-wildlife.js';
import {createAmbience} from './realm-ambience.js';
import {villageGroundTexture} from './realm-ground.js';
const V = new URL('../vendor/three/', import.meta.url).href;
let T = null, RE = null, LOADING = null, DEAD = false;
// The sceneries (core/realm.js SCENERIES), each a layout a shape: its own landscape, placements (its village round
// the lot: tools/realm/village.py, the owner's kit's buildings, Oct 2026) and lot (its layout's lot: where the lot lies
// in it, px: the middle and its diamond's height, far corner to near; as big as fits in the build zone, the checks hold
// it to that). Every land is tall (portrait), on any screen
// (the owner's ask, Oct 2026). Each loaded when it's first wanted (SCENERY: those in, by file).
export const FILES = Object.fromEntries(['coast', 'forest', 'tundra', 'ocean', 'desert', 'infernal'].map(k => [k, {tall: `layout-${k}.json`}]));
FILES.christmas = {tall: 'layout-tundra.json'};
export const WORLD_FILES = Object.fromEntries(Object.keys(FILES).map(k => [k, {tall: `world-${k}-v2.json`}]));
WORLD_FILES.coast.tall = 'world-coast-v3.json';
const shapeOf = (w, h) => (h > w ? 'tall' : 'wide');
const fileFor = (theme, shape) => { const files = data.isOwner() ? WORLD_FILES : FILES, f = files[theme] || files.coast; return f[shape] || f.tall || f.wide; };
const SCENERY = {}, ASKED = {};
const sceneryFor = file => ASKED[file] || (ASKED[file] = scenery(file).then(sc => { if (sc) { sc.file = file; SCENERY[file] = sc; } else delete ASKED[file]; return sc; }));
const SCENERY_AT = new URL('../../img/realm/scenery/', import.meta.url).href;
const picture = file => new Promise(ok => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => ok(im);
  im.onerror = () => ok(null);
  im.src = SCENERY_AT + file;
});
/** A shape of the scenery: {lay (its layout), ground (the landscape), pics {asset id: picture}}, or null without it. */
async function scenery(file) {
  const world = file.startsWith('world-');
  if (!data.isOwner()) return null;
  try {
    const lay = await (await fetch(SCENERY_AT + file)).json(), bg = lay.scene.background_asset_id;
    if (!data.isOwner()) return null;
    const ids = Object.keys(lay.assets), got = await Promise.all(ids.map(id => picture(lay.assets[id].pic.file)));
    if (!data.isOwner()) return null;
    const pics = Object.fromEntries(ids.map((id, i) => [id, got[i]]).filter(([id, im]) => im && id !== bg));
    const ground = got[ids.indexOf(bg)];
    if (!ground) throw new Error('no landscape');
    return {lay, ground, pics};
  } catch (e) {
    console.warn('Realm: no scenery', e);
    if (world && data.isOwner()) {
      const key = Object.keys(WORLD_FILES).find(k => Object.values(WORLD_FILES[k]).includes(file));
      return scenery((FILES[key] || FILES.coast).tall);
    }
    return null;
  }
}

// The army's pictures (tools/realm/army.py): {troop: {w, h, ax, ay (where he stands, px), right (faces right), fly,
// tall or wide (tiles), img, url}}; troops use 3D models if their pictures cannot load.
const ARMY = {};
const ARMY_AT = new URL('../../img/realm/army/', import.meta.url).href;
async function army() {
  try {
    const meta = await (await fetch(ARMY_AT + 'army.json')).json();
    await Promise.all(Object.entries(meta).map(([k, m]) => new Promise(ok => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { ARMY[k] = Object.assign({}, m, {img: im, url: ARMY_AT + k + '.webp'}); ok(); };
      im.onerror = () => ok();
      im.src = ARMY_AT + k + '.webp';
    })));
  } catch (e) { console.warn('Realm: no army pictures', e); }
}
/** Loads three.js, the art and scenery theme's layout for this screen (the coast's if none's given). */
export function load(theme = 'coast') {
  if (!data.isOwner()) return Promise.resolve(false);
  if (LOADING) return LOADING.then(ok => (ok && data.isOwner() ? sceneryFor(fileFor(theme, shapeOf(innerWidth, innerHeight))).then(() => data.isOwner()) : false));
  LOADING = (async () => {
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
      const [three, {RoomEnvironment}, BU] = await Promise.all([import(V + 'three.module.min.js'), import(V + 'RoomEnvironment.js'), import(V + 'BufferGeometryUtils.js')]);
      T = three; RE = RoomEnvironment;
      if (!data.isOwner()) return false;
      FM.init(T, BU);
      SPR.init(T, PITCH);
      await Promise.all([SPR.load(), army(), sceneryFor(fileFor(theme, shapeOf(innerWidth, innerHeight)))]); // (without the art, everything's drawn in 3D)
      try { await document.fonts.load('800 60px "Barlow Condensed"'); } catch (_) {}
      return true;
    } catch (e) {
      console.warn('Realm: no 3D', e);
      DEAD = true;
      return false;
    }
  })();
  return LOADING.then(ok => { if (!ok && !DEAD) LOADING = null; return ok && data.isOwner(); });
}
export const ready = () => !!T && !DEAD;

export const YAW = Math.PI / 4, PITCH = .9;
const W = (x) => x - N / 2; // a tile coordinate to the world's (the lot centred on the origin)

// ---- pictures of the models for the shop and the army (rendered once each, on a small canvas of their own)
let THUMB = null;
const THUMBS = new Map();
/** A picture (data URL) of kind k at level l in a house's colours, or of a soldier (troop: true). */
export function thumb(k, l, house, troop = false) {
  if (!ready()) return '';
  if (!troop && SPR.ready() && SPR.KINDS.includes(k)) return SPR.thumbURL(k, l);
  if (troop && ARMY[k]) return ARMY[k].url;
  const key = `${troop ? 't' : 'b'}:${k}:${l}:${house.pri}:${house.sigil}`;
  if (THUMBS.has(key)) return THUMBS.get(key);
  try {
    if (!THUMB) {
      const r = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
      r.setPixelRatio(1); r.setSize(160, 160, false);
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping;
      const sc = new T.Scene(), pm = new T.PMREMGenerator(r);
      sc.environment = pm.fromScene(new RE(r), .04).texture; pm.dispose();
      sc.add(new T.HemisphereLight(0xFFFFFF, 0x445533, 1.2));
      const sun = new T.DirectionalLight(0xFFF0D8, 2.2); sun.position.set(-3, 6, 4); sc.add(sun);
      THUMB = {r, sc, cam: new T.OrthographicCamera(-1, 1, 1, -1, .1, 100)};
    }
    const {r, sc, cam} = THUMB;
    let obj;
    if (troop) {
      const parts = FM.troopParts(k, house), mat = FM.mats().paint;
      obj = new T.Group();
      const body = new T.Mesh(parts.body, mat); body.position.y = .22; obj.add(body);
      if (k === 'dragon') [-1, 1].forEach(sd => { const w = new T.Mesh(parts.leg, mat); w.position.set(sd * .18, .32, .1); w.scale.x = sd; w.rotation.z = sd * .35; obj.add(w); });
      else [-1, 1].forEach(sd => { const lg = new T.Mesh(parts.leg, mat); lg.position.set(sd * .06 * (k === 'knight' ? 1.35 : 1), .22, 0); lg.rotation.x = sd * .3; obj.add(lg); });
    } else obj = FM.model(k, l, house);
    sc.add(obj);
    const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
    const R = Math.max(sz.x, sz.y, sz.z) * .62;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.updateProjectionMatrix();
    cam.position.set(c.x + R * 2 * Math.sin(YAW), c.y + R * 2 * Math.sin(.6), c.z + R * 2 * Math.cos(YAW)); cam.lookAt(c);
    r.setClearColor(0x000000, 0);
    r.render(sc, cam);
    const url = r.domElement.toDataURL('image/png');
    sc.remove(obj);
    THUMBS.set(key, url);
    return url;
  } catch (e) { return ''; }
}

function grassTexture(T) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#4A7A35'; g.fillRect(0, 0, 256, 256);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < .5 ? '28,60,22' : '120,160,70'},${.08 + r() * .12})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 2 + r() * 4); }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function lotTexture(T) {
  // a meadow: grass in patches, a little worn earth, flowers here and there
  const cv = document.createElement('canvas'); cv.width = cv.height = 576;
  const g = cv.getContext('2d');
  g.fillStyle = '#5B913C'; g.fillRect(0, 0, 576, 576);
  let s = 11;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 40; i++) { const x = r() * 576, y = r() * 576, R = 20 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, r() < .5 ? 'rgba(70,120,45,.45)' : 'rgba(110,150,60,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() < .5 ? '40,80,25' : '150,190,90'},${.05 + r() * .08})`; g.fillRect(r() * 576, r() * 576, 1 + r() * 2, 2 + r() * 3); }
  for (let i = 0; i < 160; i++) { g.fillStyle = ['#E8E2C8', '#D9C34A', '#B8A6D8'][i % 3]; g.fillRect(r() * 576, r() * 576, 2, 2); }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function blobTexture(T) {
  // a soft round shadow
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(.6, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(cv);
}
function puffTexture(T) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
  return t;
}

// The base's ground in each land (its open ground's colours, taken from its landscape under the lot): its check's two
// tiles, its patches and specks (dark, light), its edge, the kerb, and whether grass blades grow on it close up.
const GROUND = {
  coast: {a: '#96952E', b: '#8C8D2A', pd: '110,115,25', pl: '180,170,70', sd: '70,80,15', sl: '190,180,90', edge: 'rgba(60,65,15,.45)', kerb: 0xB4AA94, blades: true},
  ocean: {a: '#9E9B34', b: '#94932F', pd: '115,118,30', pl: '185,175,75', sd: '75,82,18', sl: '195,185,95', edge: 'rgba(60,65,15,.45)', kerb: 0xC2B48E, blades: true},
  forest: {a: '#51652C', b: '#4A5E28', pd: '40,55,20', pl: '110,130,60', sd: '30,40,12', sl: '120,140,70', edge: 'rgba(20,30,10,.5)', kerb: 0x7C8070, blades: true},
  tundra: {a: '#CED3DF', b: '#C6CCDA', pd: '150,165,190', pl: '235,238,245', sd: '130,145,170', sl: '245,247,250', edge: 'rgba(90,110,140,.4)', kerb: 0x8E9AA6, blades: false},
  christmas: {a: '#C1CDE6', b: '#B9C6DF', pd: '135,151,183', pl: '224,231,246', sd: '119,138,174', sl: '241,244,252', edge: 'rgba(74,90,125,.4)', kerb: 0x8794AA, blades: false},
  desert: {a: '#ED9F4D', b: '#E59646', pd: '190,110,40', pl: '250,190,110', sd: '160,90,30', sl: '255,210,140', edge: 'rgba(150,80,25,.4)', kerb: 0xB08A5E, blades: false},
  infernal: {a: '#57362B', b: '#4F3026', pd: '35,20,15', pl: '120,70,50', sd: '25,14,10', sl: '255,120,40', edge: 'rgba(255,90,20,.35)', kerb: 0x3A302C, blades: false}
};
function plotTexture(T, B, G, feather = false) {
  // the base: its ground a tile each in a faint check (lighter and darker by turns), worn a little, a darker line at
  // its edge under the kerb
  const px = 32, cv = document.createElement('canvas'); cv.width = cv.height = B * px;
  const g = cv.getContext('2d');
  let s = 13;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { g.fillStyle = !feather && (x + y) % 2 ? G.b : G.a; g.fillRect(x * px, y * px, px, px); }
  for (let i = 0; i < 60; i++) { const x = r() * B * px, y = r() * B * px, R = 30 + r() * 90, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, r() < .5 ? `rgba(${G.pd},.22)` : `rgba(${G.pl},.18)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < .5 ? G.sd : G.sl},${.06 + r() * .1})`; g.fillRect(r() * B * px, r() * B * px, 1 + r() * 2, 1 + r() * 2); }
  if (feather) {
    const pixels = g.getImageData(0, 0, cv.width, cv.height), edge = px * 6;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const d = Math.min(x, y, cv.width - 1 - x, cv.height - 1 - y), f = Math.min(1, d / edge);
      pixels.data[(y * cv.width + x) * 4 + 3] = Math.round(255 * f * f * (3 - 2 * f));
    }
    g.putImageData(pixels, 0, 0);
  } else { g.strokeStyle = G.edge; g.lineWidth = 6; g.strokeRect(3, 3, B * px - 6, B * px - 6); }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function bladesTexture(T) {
  // the painted meadow close up: short blades in its own dark and sunlit greens on nothing (it tiles)
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  let s = 5;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.lineCap = 'round';
  for (let i = 0; i < 1500; i++) {
    const x = r() * 256, y = r() * 256, h = 3 + r() * 5, lean = (r() - .5) * 3, dark = r() < .55;
    g.strokeStyle = dark ? `rgba(70,92,14,${.3 + r() * .3})` : `rgba(196,192,82,${.25 + r() * .3})`;
    g.lineWidth = 1 + r() * .8;
    [-256, 0, 256].forEach(ox => [-256, 0, 256].forEach(oy => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + lean, y + oy - h); g.stroke(); }));
  }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/**
 * The landscape laid on the ground (y 0) so that, looked at the way the game's camera looks (the painting has no
 * perspective, so straight along that line, not from a point), it's as painted with the lot on its meadow: a grid of
 * the painting's points, each put where its ray meets the ground. The game's camera then sees it with the same
 * perspective as the lot (lot: where it lies, its layout's). → {mesh, px(world point) → where it is on the painting
 * (px), under(x, y) → the ground under a px of it (world), per (world a px of it, standing facing the camera), lot, w, h}.
 */
function sceneryGround(img, lot, maxAniso) {
  // A small lot makes the surrounding realm hundreds of tiles deep. Keep the
  // reference ray origins above the whole painting, including its far corners.
  const w = img.naturalWidth, h = img.naturalHeight, D = Math.max(200, N * h / lot.h * 4);
  const rc = new T.OrthographicCamera(-w / h, w / h, 1, -1, 1, 2 * D), hd = Math.cos(PITCH) * D;
  rc.position.set(Math.sin(YAW) * hd, Math.sin(PITCH) * D, Math.cos(YAW) * hd); rc.lookAt(0, 0, 0); rc.updateMatrixWorld();
  const far = new T.Vector3(-N / 2, 0, -N / 2).project(rc), near = new T.Vector3(N / 2, 0, N / 2).project(rc);
  const k = (far.y - near.y) / (lot.h / (h / 2)), mid = (far.y + near.y) / 2; // (the painting's px to the camera's)
  const ray = new T.Raycaster(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), at = new T.Vector3(), v = new T.Vector2();
  const GX = 48, GY = 28, pos = [], uv = [], idx = [];
  for (let j = 0; j <= GY; j++) {
    for (let i = 0; i <= GX; i++) {
      const px = i / GX * w, py = j / GY * h;
      ray.setFromCamera(v.set((px - lot.cx) / (w / 2) * k, mid - (py - lot.cy) / (h / 2) * k), rc);
      if (!ray.ray.intersectPlane(ground, at)) throw new Error('scenery: off the ground');
      pos.push(at.x, 0, at.z); uv.push(px / w, 1 - py / h);
      if (i < GX && j < GY) { const a = j * (GX + 1) + i, b = a + GX + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const tex = new T.Texture(img);
  tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = maxAniso; tex.needsUpdate = true;
  geo.userData.tex = tex;
  const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({map: tex, toneMapped: false, fog: false}));
  mesh.position.y = -.02;
  const p = new T.Vector3();
  const px = q => { p.copy(q).project(rc); return {x: lot.cx + p.x / k * (w / 2), y: lot.cy - (p.y - mid) / k * (h / 2)}; };
  const under = (x, y) => {
    ray.setFromCamera(v.set((x - lot.cx) / (w / 2) * k, mid - (y - lot.cy) / (h / 2) * k), rc);
    return ray.ray.intersectPlane(ground, new T.Vector3());
  };
  return {mesh, px, under, per: 2 * k / h, lot, w, h};
}

/**
 * The scenery's pictures, each stood up facing the camera (it never turns, so they look as drawn) on the ground under
 * its instance's anchor (the bottom middle of its rect), as big as its rect: the whole original in the rect, so the
 * trimmed picture where its crop was in it. They're drawn in the layout's draw_order: those behind the lot's middle
 * before everything on the lot (so the lot's buildings stand in front of them), those in front of it after (so they
 * stand in front of the lot's); none of them hides anything else. → [THREE.Sprite].
 */
function sceneryPictures(sc, gr) {
  const mats = sc.mats || (sc.mats = {}), out = []; // (its textures shared by every view)
  sc.lay.instances.forEach(it => {
    const a = sc.lay.assets[it.asset_id], im = sc.pics[it.asset_id];
    if (!a || !im || !a.pic) return;
    const R = it.rect, sx = R.width / a.width, sy = R.height / a.height, [x0, y0, x1, y1] = a.pic.crop;
    const left = R.x + x0 * sx, top = R.y + y0 * sy, w = (x1 - x0) * sx, h = (y1 - y0) * sy;
    const ax = R.x + R.width / 2, ay = R.y + R.height, g = gr.under(ax, ay);
    if (!g) return;
    const key = it.asset_id + (it.flip_x ? ':f' : '');
    if (!mats[key]) {
      const t = new T.Texture(im);
      t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      if (it.flip_x) { t.wrapS = T.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
      mats[key] = new T.SpriteMaterial({map: t, transparent: true, depthWrite: false, toneMapped: false, fog: false});
    }
    const sp = new T.Sprite(mats[key]);
    sp.center.set((it.flip_x ? left + w - ax : ax - left) / w, 1 - (ay - top) / h);
    sp.scale.set(w * gr.per, h * gr.per, 1);
    sp.position.copy(g);
    sp.renderOrder = (ay <= gr.lot.cy ? -1000 : 1000) + (it.draw_order || 0);
    sp.raycast = () => {};
    out.push(sp);
  });
  return out;
}

/**
 * The view, in host (filled). opts: {house: {pri, sec, sigil}, zoom (start), onTap(hit), onGrab(tile) → bool (a drag
 * that starts here moves something instead of panning: onDrag(tile), onDrop(tile)), onCamera()}.
 */
export function create(host, opts = {}) {
  if (!data.isOwner() || !ready()) return null;
  const village = !!opts.village && data.isOwner();
  const isActive = () => !opts.isActive || opts.isActive();
  let lotState = null, layoutSig = '', autoFrame = false, framing = false, placement = false;
  const renderer = new T.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'rl-canvas';
  host.appendChild(canvas);
  let lost = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; want(); });

  const scene = new T.Scene();
  scene.background = new T.Color(0x9AAEC0);
  scene.fog = new T.Fog(0xA3B4C4, 70, 140);
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RE(renderer), .04).texture;
  pmrem.dispose();
  const hemi = new T.HemisphereLight(0xDCE6F2, 0x3E5530, .75); scene.add(hemi);
  const sun = new T.DirectionalLight(0xFFE8C8, village ? 1.8 : 2.8);
  sun.position.set(-16, 30, 12); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  Object.assign(sun.shadow.camera, {left: -N * .7, right: N * .7, top: N * .7, bottom: -N * .7, near: 1, far: 90});
  scene.add(sun, sun.target);

  // ---- the ground: the scenery (opts.scenery: its theme, core/realm.js SCENERIES; the coast if none), the lot on its
  // ground; or, till it's in or without it, grass all round, a moat round the lot (a stone lip each side), the lot,
  // pines and mountains (plain)
  let scene0 = null, sceneG = null, wildlife = null, ambience = null, ambienceSig = '', ambienceVisible = false, theme = opts.scenery || 'coast';
  const plain = new T.Group();
  let sceneryTheme = 'coast';
  const base = {}; // (the base's ground: below)
  /** The base's ground for land k (GROUND). */
  function groundFor(k) {
    sceneryTheme = k;
    if (!base.plot) return;
    const key = GROUND[k] ? k : 'coast', color = village && scene0 && scene0.terrainColor;
    const G = color ? {...GROUND[key], a: color, b: color} : GROUND[key], textureKey = key + (color || '');
    if (village) {
      // Keep only the active high-detail texture resident on mobile GPUs.
      if (base.textureKey !== textureKey) {
        const previous = base.plot.material.map;
        base.plot.material.map = villageGroundTexture(T, base.B, key, G.a);
        base.textureKey = textureKey;
        if (previous) previous.dispose();
      }
    } else base.plot.material.map = base.tex[textureKey] || (base.tex[textureKey] = plotTexture(T, base.B, G));
    base.plot.material.needsUpdate = true;
    base.blades.visible = G.blades;
    base.kerbM.color.set(G.kerb);
    if (village) {
      // Fine ground detail close up, feathered into the same landscape over six tiles at every edge.
      base.plot.material.transparent = true; base.plot.material.depthWrite = false;
      base.plot.renderOrder = -2002;
      base.blades.visible = false;
      base.kerbs.forEach(k => { k.visible = placement; });
    }
  }
  /** Lays scenery sc (a theme's layout for a shape) round the lot, instead of what's there: true when it's down. */
  function dropScenery() {
    if (ambience) { ambience.dispose(); ambience = null; ambienceSig = ''; }
    if (wildlife) { wildlife.dispose(); wildlife = null; }
    if (!sceneG) return;
    const geometry = new Set(), materials = new Set(), textures = new Set();
    sceneG.traverse(o => {
      if (o.geometry) geometry.add(o.geometry);
      if (o.material) for (const m of [o.material].flat()) { materials.add(m); if (m.map) textures.add(m.map); }
    });
    geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    scene.remove(sceneG); sceneG.clear(); sceneG = scene0 = null;
  }
  function setScenery(sc) {
    if (!data.isOwner()) return false;
    let gr;
    try { gr = sceneryGround(sc.ground, sc.lay.lot, renderer.capabilities.getMaxAnisotropy()); } catch (e) { console.warn('Realm: no scenery', e); return false; }
    dropScenery();
    scene.remove(plain);
    scene.background.set(0x16202A); // (never seen: the camera stays over it)
    sceneG = new T.Group();
    sceneG.add(gr.mesh, ...sceneryPictures(sc, gr));
    scene.add(sceneG);
    scene0 = gr; scene0.file = sc.file; scene0.terrainColor = sc.lay.terrain_color;
    const key = Object.keys(FILES).find(k => [...Object.values(FILES[k]), ...Object.values(WORLD_FILES[k])].includes(sc.file)) || 'coast';
    groundFor(key);
    const dusk = sc.lay.lighting === 'dusk';
    hemi.intensity = dusk ? .55 : .75;
    sun.intensity = dusk ? (village ? 1.05 : 1.6) : (village ? 1.8 : 2.8);
    sun.color.set(dusk ? 0xFFD0A0 : 0xFFE8C8);
    if (village && sc.file.startsWith('world-')) wildlife = createWildlife(T, sceneG, {theme: key, ground: gr, sleighImage: sc.pics['christmas:sleigh'], onChange: () => want()});
    if (village && /world-v[23]\.webp$/.test(sc.lay.assets[sc.lay.scene.background_asset_id].pic.file)) ambience = createAmbience(T, gr, {theme: key, onChange: () => want()});
    return true;
  }
  /** The theme's layout for this screen's shape laid down: now, if it's in; else once it is (if it's still wanted). */
  function wantScenery(w, h) {
    const f = fileFor(theme, shapeOf(w, h));
    if (scene0 && scene0.file === f) return;
    if (SCENERY[f]) { setScenery(SCENERY[f]); return; }
    sceneryFor(f).then(sc => {
      if (!sc || dead || (village && !data.isOwner()) || (scene0 && scene0.file === f) || fileFor(theme, shapeOf(Wd, Hd)) !== f || !setScenery(sc)) return;
      zTop = mostOut(); clampView(); want();
    });
  }
  {
    const w0 = host.clientWidth || innerWidth, h0 = host.clientHeight || innerHeight, f0 = fileFor(theme, shapeOf(w0, h0));
    // (the coast's while another's coming)
    const first = SCENERY[f0] || SCENERY[fileFor('coast', shapeOf(w0, h0))] || Object.values(SCENERY)[0];
    if (first) setScenery(first);
  }
  if (!scene0) scene.add(plain);
  {
    const grass = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshStandardMaterial({map: grassTexture(T), roughness: 1}));
    grass.material.map.repeat.set(60, 60);
    grass.rotation.x = -Math.PI / 2; grass.position.y = -.02; grass.receiveShadow = true;
    plain.add(grass);
    const ringAt = (r0, r1, y, mat) => {
      const m = new T.Mesh(new T.RingGeometry(r0 * Math.SQRT2, r1 * Math.SQRT2, 4, 1), mat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 4; m.position.y = y; m.receiveShadow = true;
      plain.add(m);
    };
    ringAt(N / 2 + .9, N / 2 + 3.1, -.06, new T.MeshStandardMaterial({color: 0x2F5F73, roughness: .12, metalness: .2, envMapIntensity: 1.2}));
    ringAt(N / 2 + .3, N / 2 + .9, .005, new T.MeshStandardMaterial({color: 0x8E887E, roughness: .9}));
    ringAt(N / 2 + 3.1, N / 2 + 3.6, .005, new T.MeshStandardMaterial({color: 0x8E887E, roughness: .9}));
    const lot = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshStandardMaterial({map: lotTexture(T), roughness: .95}));
    lot.rotation.x = -Math.PI / 2; // (the shadows on it: the base's, below)
    plain.add(lot);
    // pines round the outside (a few tiers each), mountains far off with snow on top
    {
      let s = 3;
      const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const needles = new T.MeshStandardMaterial({color: 0x24482A, roughness: .9}), bark = new T.MeshStandardMaterial({color: 0x5A3E2A, roughness: .9});
      const tiers = [new T.ConeGeometry(1.3, 1.8, 7), new T.ConeGeometry(1.0, 1.5, 7), new T.ConeGeometry(.7, 1.2, 7)], trunk = new T.CylinderGeometry(.16, .22, 1, 6);
      const n = 90, meshes = tiers.map(g => new T.InstancedMesh(g, needles, n)), tr = new T.InstancedMesh(trunk, bark, n), m = new T.Matrix4(), q = new T.Quaternion();
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = N * .8 + 4 + r() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d, k = .7 + r() * .8;
        meshes.forEach((M, j) => { m.compose(new T.Vector3(x, (1.5 + j * 1.0) * k, z), q, new T.Vector3(k, k, k)); M.setMatrixAt(i, m); });
        m.compose(new T.Vector3(x, .5 * k, z), q, new T.Vector3(k, k, k)); tr.setMatrixAt(i, m);
      }
      meshes.forEach(M => { M.castShadow = true; plain.add(M); }); plain.add(tr);
      const rockM = new T.MeshStandardMaterial({color: 0x6F7378, roughness: 1, flatShading: true}), snowM = new T.MeshStandardMaterial({color: 0xEEF2F6, roughness: .9, flatShading: true});
      for (let i = 0; i < 9; i++) {
        const a = -2.6 + i * .5 + r() * .2, d = 110 + r() * 20, h = 30 + r() * 25, w = 22 + r() * 16;
        const mt = new T.Mesh(new T.ConeGeometry(w, h, 6), rockM); mt.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d); mt.rotation.y = r() * 3; plain.add(mt);
        const cap = new T.Mesh(new T.ConeGeometry(w * .32, h * .32, 6), snowM); cap.position.set(mt.position.x, h - 2 - h * .16 + .3, mt.position.z); cap.rotation.y = mt.rotation.y; plain.add(cap);
      }
    }
  }

  // ---- the base: a clear square cut out of the land, where everything's built and moved about (the lot inside its
  // EDGE: core/realm.js fits()), its ground the land's (GROUND: grass, moss, snow, sand or ash) in a faint check a tile each, short
  // blades over grass close up, a low stone kerb round it
  {
    const B = N - 2 * EDGE;
    const plot = new T.Mesh(new T.PlaneGeometry(B, B), new T.MeshBasicMaterial({toneMapped: false, fog: false}));
    plot.rotation.x = -Math.PI / 2; plot.position.y = .006;
    const blades = new T.Mesh(new T.PlaneGeometry(B, B), new T.MeshBasicMaterial({map: bladesTexture(T), transparent: true, depthWrite: false, toneMapped: false, fog: false}));
    blades.material.map.repeat.set(B / 2, B / 2);
    blades.rotation.x = -Math.PI / 2; blades.position.y = .009; blades.renderOrder = -2001;
    const kerbM = new T.MeshStandardMaterial({color: GROUND.coast.kerb, roughness: .9}), w = .26, hgt = .14, kerbs = [];
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([sx, sz]) => {
      const k = new T.Mesh(new T.BoxGeometry(sx ? w : B + 2 * w, hgt, sz ? w : B + 2 * w), kerbM);
      k.position.set(sx * (B + w) / 2, hgt / 2, sz * (B + w) / 2); k.receiveShadow = true;
      scene.add(k);
      kerbs.push(k);
    });
    // (the buildings' shadows over it all, the base and the scenery round it)
    const shade = new T.Mesh(new T.PlaneGeometry(N + 6, N + 6), new T.ShadowMaterial({opacity: .32}));
    shade.rotation.x = -Math.PI / 2; shade.position.y = .016; shade.receiveShadow = true; shade.renderOrder = -2000;
    scene.add(plot, blades, shade);
    Object.assign(base, {B, plot, blades, kerbM, kerbs, tex: {}});
    groundFor(sceneryTheme);
  }

  // ---- the camera: looking down across the lot corner-on
  const cam = new T.PerspectiveCamera(30, 1, .5, 400);
  const view = {tx: 0, tz: 0, dist: opts.zoom || 46};
  const placeCam = () => {
    const h = Math.cos(PITCH) * view.dist;
    cam.position.set(view.tx + Math.sin(YAW) * h, Math.sin(PITCH) * view.dist, view.tz + Math.cos(YAW) * h);
    cam.lookAt(view.tx, 0, view.tz);
    // (the near and far planes go with the zoom: zoomed right out to the whole scenery it's hundreds of yards off)
    const nr = Math.max(.5, view.dist * .03), fr = view.dist * 3 + 100;
    if (cam.near !== nr || cam.far !== fr) { cam.near = nr; cam.far = fr; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    scene.fog.near = view.dist * .9 + 20; scene.fog.far = view.dist * 1.7 + 70;
  };
  const ZMIN = 14, ZMAX = 130, PAN = N / 2 + 2;
  let zTop = ZMAX; // (with the scenery: out as far as the screen's still all on it, on this screen's shape)
  const clampView = () => {
    view.dist = Math.max(ZMIN, Math.min(zTop, view.dist));
    // Explore the full realm; painted edges, rather than the small village, bound panning.
    if (!village || !scene0) { view.tx = Math.max(-PAN, Math.min(PAN, view.tx)); view.tz = Math.max(-PAN, Math.min(PAN, view.tz)); }
    if (scene0) inScene();
  };
  // over the landscape, never past its edges: where the screen's corners fall on it, then the view slid back in (past
  // both sides at once can't happen, zTop sees to that; if it did, it'd be centred)
  const RIGHT = new T.Vector3(Math.cos(YAW), 0, -Math.sin(YAW)), AWAY = new T.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW));
  const cRay = new T.Raycaster(), cNdc = new T.Vector2(), cAt = new T.Vector3(), flat = new T.Plane(new T.Vector3(0, 1, 0), 0);
  function inScene() {
    for (let n = 0; n < 32; n++) {
      placeCam();
      let l = 0, r = 0, t = 0, b = 0;
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        cRay.setFromCamera(cNdc.set(x, y), cam);
        if (!cRay.ray.intersectPlane(flat, cAt)) { t = Infinity; continue; }
        const p = scene0.px(cAt);
        l = Math.max(l, -p.x); r = Math.max(r, p.x - scene0.w); t = Math.max(t, -p.y); b = Math.max(b, p.y - scene0.h);
      }
      if (t === Infinity) { if (view.dist <= ZMIN) return; view.dist = Math.max(ZMIN, view.dist * .94); continue; }
      const pxw = N * Math.SQRT2 * Math.sin(PITCH) / scene0.lot.h; // (world a painting px across, about, near the lot)
      const dx = (l && r ? (l - r) / 2 : l - r) * pxw * .8, dy = (t && b ? (t - b) / 2 : t - b) * pxw / Math.sin(PITCH) * .8;
      if (Math.abs(dx) + Math.abs(dy) < .01) return;
      view.tx += RIGHT.x * dx - AWAY.x * dy; view.tz += RIGHT.z * dx - AWAY.z * dy;
    }
  }
  /** How far out the camera can be with the screen still all on the scenery: where the screen's corners fall on it
   *  takes up no more than its width and height (wherever it's looking: the painting's laid down evenly). */
  function mostOut() {
    const was = {...view};
    let lo = ZMIN, hi = 4000;
    for (let i = 0; i < 32; i++) {
      view.dist = (lo + hi) / 2;
      placeCam();
      const ps = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => { cRay.setFromCamera(cNdc.set(x, y), cam); return cRay.ray.intersectPlane(flat, cAt) ? scene0.px(cAt) : null; });
      const ok = ps.every(Boolean) && Math.max(...ps.map(p => p.x)) - Math.min(...ps.map(p => p.x)) <= scene0.w && Math.max(...ps.map(p => p.y)) - Math.min(...ps.map(p => p.y)) <= scene0.h;
      if (ok) lo = view.dist; else hi = view.dist;
    }
    Object.assign(view, was);
    return lo * .995;
  }
  let Wd = 1, Hd = 1;
  const resize = () => {
    if (!isActive()) return;
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    if (w === Wd && h === Hd) return;
    Wd = w; Hd = h;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    cam.aspect = w / h; cam.updateProjectionMatrix();
    wantScenery(w, h); // (the phone turned: the scenery's other shape, if it has one)
    if (scene0) zTop = mostOut();
    clampView();
    if (village && autoFrame && lotState && !framing) frameVillage();
    want();
  };

  // ---- drawing on demand
  let raf = 0, dead = false, anim = null, cameraSig = '';
  const want = () => { if (!raf && !dead && isActive() && !document.hidden) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    if (dead || lost || !isActive() || document.hidden) return;
    resize();
    placeCam();
    if (village && base.plot) base.plot.material.opacity = scene0 ? Math.max(0, Math.min(.9, (180 - view.dist) / 100)) : 1;
    let more = false;
    if (anim) more = anim(now) !== false;
    const sig = [view.tx, view.tz, view.dist, Wd, Hd].join(':');
    if (ambience) {
      // Avoid continuous rendering while the camera sees only the quiet village
      // clearing. Re-evaluate the painted effect regions only after camera moves.
      if (sig !== ambienceSig) {
        ambienceSig = sig;
        ambienceVisible = [...ambience.regions.water, ...ambience.regions.lights].some(r => {
          const pts = [r.x - r.rx, r.x + r.rx].flatMap(x => [r.y - r.ry, r.y + r.ry].map(y => scene0.under(x * scene0.w, y * scene0.h).project(cam)));
          return pts.some(p => p.z > -1 && p.z < 1) && Math.min(...pts.map(p => p.x)) < 1 && Math.max(...pts.map(p => p.x)) > -1 && Math.min(...pts.map(p => p.y)) < 1 && Math.max(...pts.map(p => p.y)) > -1;
        });
      }
      more = ambience.update(now / 1000, {zoom: view.dist, active: ambienceVisible}) || more;
    }
    if (wildlife) more = wildlife.update(now / 1000, {zoom: view.dist, active: document.visibilityState === 'visible'}) || more;
    folkFrame(now);
    renderer.render(scene, cam);
    if (opts.onCamera && sig !== cameraSig) { cameraSig = sig; opts.onCamera(); }
    if (more) want();
  }

  // ---- picking and projecting
  const ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hitV = new T.Vector3();
  const ndcOf = (cx, cy) => { const b = canvas.getBoundingClientRect(); ndc.set((cx - b.left) / b.width * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); };
  /** The ground under a point on the screen, in tiles (fractional), or null. */
  const tileAt = (cx, cy) => {
    placeCam(); ndcOf(cx, cy); ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(ground, hitV) ? {x: hitV.x + N / 2, y: hitV.z + N / 2} : null;
  };
  /** Screen position (px in host) of a point over the lot (tiles; h up). */
  const project = (x, y, h = 0) => {
    const v = new T.Vector3(W(x), h, W(y)).project(cam);
    return {x: (v.x + 1) / 2 * Wd, y: (1 - v.y) / 2 * Hd, on: v.z < 1};
  };

  // ---- the buildings
  let house = opts.house || {pri: 0x7A1F2B, sec: 0xD4A63A, sigil: 'crown'};
  const groups = new Map(); // id -> {g, key, b}
  const picks = [];
  let wallSig = '', wallMesh = null;
  const root = new T.Group(); scene.add(root);
  // One transparent decal for the whole lot. Soft wear at entrances and narrow paths leave the landscape visible.
  let wear = null, wearSig = '';
  function updateWear(s) {
    if (!village) return;
    const buildings = s.b.filter(b => b.t !== 'wall');
    const sig = buildings.map(b => `${b.i}:${b.x}:${b.y}:${b.t}`).join('|');
    if (sig === wearSig) return;
    wearSig = sig;
    if (!wear) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      const mesh = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false}));
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = .011; mesh.renderOrder = -2001;
      scene.add(mesh); wear = {cv, tex, mesh};
    }
    const ctx = wear.cv.getContext('2d'), per = wear.cv.width / N;
    ctx.clearRect(0, 0, 1024, 1024);
    const door = b => ({x: (b.x + KINDS[b.t].size / 2) * per, y: (b.y + KINDS[b.t].size - .15) * per});
    const keep = buildings.find(b => b.t === 'keep');
    ctx.lineCap = 'round';
    buildings.forEach(b => {
      const p = door(b), r = KINDS[b.t].size * per * .55;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      glow.addColorStop(0, 'rgba(102,76,42,.28)'); glow.addColorStop(.45, 'rgba(115,87,49,.16)'); glow.addColorStop(1, 'rgba(115,87,49,0)');
      ctx.fillStyle = glow; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      if (!keep || b === keep) return;
      const q = door(keep), distance = Math.hypot(q.x - p.x, q.y - p.y);
      if (distance > 14 * per) return;
      for (const [width, alpha] of [[.8, .025], [.55, .035], [.3, .05]]) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x, q.y, q.x, q.y);
        ctx.lineWidth = per * width; ctx.strokeStyle = `rgba(121,91,51,${alpha})`; ctx.stroke();
      }
    });
    wear.tex.needsUpdate = true;
  }
  function setLot(s, o = {}) {
    lotState = s;
    const layout = s.b.map(b => `${b.i}:${b.t}:${b.x}:${b.y}:${b.l}`).join('|'), layoutChanged = layout !== layoutSig;
    layoutSig = layout;
    updateWear(s);
    const now = o.now || Date.now(), gone = o.gone || new Set();
    if (o.house) house = o.house;
    const seen = new Set();
    s.b.forEach(b => {
      if (b.t === 'wall') return;
      seen.add(b.i);
      const size = KINDS[b.t].size, down = gone.has(b.i), status = down ? 'down' : b.u > now ? (b.l < 1 ? 'new' : 'up') : 'ok';
      const key = `${b.t}:${b.l}:${status}:${house.pri}:${house.sigil}`;
      let e = groups.get(b.i);
      if (!e || e.key !== key) {
        if (e) { root.remove(e.g); dropFolk(e); }
        const g = new T.Group();
        if (status === 'down') g.add(FM.rubble(size));
        else if (status === 'new') { g.add(FM.scaffold(size)); }
        else {
          const art = SPR.ready() && SPR.KINDS.includes(b.t) ? SPR.building(b.t, b.l, size) : null;
          g.add(art || FM.model(b.t, b.l, house));
          if (art) g.userData = art.userData;
          if (status === 'up') g.add(FM.scaffold(size));
        }
        g.traverse(m => { if (m.isMesh) m.userData.bid = b.i; });
        root.add(g);
        e = {g, key, b, folk: []};
        groups.set(b.i, e);
        if (SPR.ready()) SPR.crewOf(b, status, size).forEach((c, j) => { const sp = SPR.folk(); scene.add(sp); e.folk.push({sp, c, ph: ((b.i * 7919 + j * 104729) % 1000) / 1000}); });
      }
      e.b = b;
      e.g.position.set(W(b.x + size / 2), 0, W(b.y + size / 2));
    });
    [...groups.keys()].forEach(id => { if (!seen.has(id)) { root.remove(groups.get(id).g); dropFolk(groups.get(id)); groups.delete(id); } });
    // the walls: one instanced pillar and run mesh for the lot, a run joining walls side by side
    const walls = s.b.filter(b => b.t === 'wall' && !gone.has(b.i));
    const sig = walls.map(f => `${f.i}.${f.x}.${f.y}.${f.l}`).join(',');
    if (sig !== wallSig) {
      wallSig = sig;
      if (wallMesh) { root.remove(wallMesh.post, wallMesh.rail); wallMesh.post.dispose(); wallMesh.rail.dispose(); }
      const parts = FM.wallParts(), at = new Map(walls.map(f => [f.x + ',' + f.y, f]));
      const runs = [];
      walls.forEach(f => { if (at.has((f.x + 1) + ',' + f.y)) runs.push([f, 0]); if (at.has(f.x + ',' + (f.y + 1))) runs.push([f, 1]); });
      const mat = FM.mats().paint;
      const post = new T.InstancedMesh(parts.post, mat, Math.max(1, walls.length)), rail = new T.InstancedMesh(parts.rail, mat, Math.max(1, runs.length));
      const m = new T.Matrix4(), q = new T.Quaternion(), one = new T.Vector3(1, 1, 1), c = new T.Color();
      walls.forEach((f, i) => { m.compose(new T.Vector3(W(f.x + .5), 0, W(f.y + .5)), q, one); post.setMatrixAt(i, m); post.setColorAt(i, c.set(FM.WALL_TINT[f.l - 1] || 0x8A6239)); });
      runs.forEach(([f, dir], i) => {
        m.compose(new T.Vector3(W(f.x + .5), 0, W(f.y + .5)), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), dir ? -Math.PI / 2 : 0), one);
        rail.setMatrixAt(i, m); rail.setColorAt(i, c.set(FM.WALL_TINT[f.l - 1] || 0x8A6239));
      });
      post.count = walls.length; rail.count = runs.length;
      post.castShadow = rail.castShadow = true; post.receiveShadow = rail.receiveShadow = true;
      post.userData.walls = walls;
      root.add(post, rail);
      wallMesh = {post, rail};
    }
    picks.length = 0;
    groups.forEach(e => e.g.traverse(m => { if (m.isMesh) picks.push(m); }));
    if (wallMesh) picks.push(wallMesh.post);
    if (village && autoFrame && layoutChanged && !placement) frameVillage();
    want();
  }
  /** The building under a point on the screen (its id), or null. */
  const pick = (cx, cy) => {
    placeCam(); ndcOf(cx, cy); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(picks, false)[0];
    if (!hit) return null;
    if (hit.object.isInstancedMesh && hit.object.userData.walls) { const f = hit.object.userData.walls[hit.instanceId]; return f ? f.i : null; }
    return hit.object.userData.bid ?? null;
  };

  // ---- the folk: each a picture standing where it works, posed for the moment. A villager loops his work (six poses a
  // second, then a rest), at home only; in a raid a tower's archer draws and looses as the tower shoots (the release
  // as the arrow goes) and a cannon's crew works the gun while it's firing. Each is drawn a little nearer the camera
  // than where he stands (his place on the screen kept), so the building he's by never covers him.
  const camR = new T.Vector3(), camU = new T.Vector3(), fp = new T.Vector3(), toCam = new T.Vector3();
  function dropFolk(e) { (e.folk || []).forEach(f => { scene.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); }); e.folk = []; }
  function folkFrame(now) {
    if (!SPR.ready()) return;
    camR.setFromMatrixColumn(cam.matrixWorld, 0); camU.setFromMatrixColumn(cam.matrixWorld, 1);
    const sec = now / 1000;
    groups.forEach(e => e.folk.forEach(f => {
      const c = f.c, n = SPR.FOLK[c.sheet].length;
      if (c.role === 'work' && raid) { f.sp.visible = false; return; }
      f.sp.visible = true;
      let i = 0, flip = c.flip;
      const fired = raid ? raid.fired.get(e.b.i) : undefined, rt = raid ? raid.t : 0;
      if (raid && c.role === 'archer') {
        const dt = fired == null ? 9 : rt - fired;
        i = dt < .4 ? 4 + Math.floor(Math.max(0, dt) / .1) : dt < 1.3 ? Math.min(3, Math.floor((dt - .4) / .15)) : 0;
        const bl = raid.byId.get(e.b.i);
        if (bl) flip = Math.cos(bl.aim) - Math.sin(bl.aim) < 0; // (aiming left of the screen)
      } else if (raid && c.role === 'crew') {
        const dt = fired == null ? 9 : rt - fired;
        i = dt < 2.5 ? Math.floor(Math.max(0, dt) * 10 + f.ph * n) % n : 0;
      } else {
        const run = n / 6, rest = c.role === 'archer' ? 7 + f.ph * 6 : .6 + f.ph * 2.4, p = (sec + f.ph * 9) % (run + rest);
        i = p < run ? Math.floor(p * 6) : 0;
      }
      SPR.pose(f.sp, c.sheet, i, flip, c.size || 1);
      const g = e.g.position, U = e.g.userData;
      let bias = c.role === 'crew' ? .08 : .9;
      if (c.role === 'archer' && U && U.sprite) {
        const [px, py] = SPR.platform(e.b.l);
        fp.copy(g).add(U.sprite.position).addScaledVector(camR, (px - U.ax) * U.k).addScaledVector(camU, (U.ay - py) * U.k);
        bias = .35;
      } else if (c.role === 'archer') { f.sp.visible = false; return; }
      else fp.set(g.x + c.u, g.y, g.z + c.v);
      toCam.copy(cam.position).sub(fp);
      const d = toCam.length(), sc = (d - bias) / d;
      f.sp.position.copy(fp).addScaledVector(toCam, bias / d);
      f.sp.scale.set(f.sp.userData.base[0] * sc, f.sp.userData.base[1] * sc, 1);
    }));
  }
  // (a few frames a second while there are folk about and no raid's drawing every frame)
  const folkTimer = setInterval(() => { if (!raid && !dead && !lost && SPR.ready() && document.visibilityState === 'visible') { for (const e of groups.values()) if (e.folk.length) { want(); break; } } }, 160);

  // ---- the selected building: a ring of light round its footprint; moving it, a green or red square under it
  const sel = {id: null, mesh: null, foot: null, t0: 0};
  {
    const shape = new T.Shape(), hole = new T.Path();
    shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, .5); shape.lineTo(-.5, .5); shape.lineTo(-.5, -.5);
    const i = .44; hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.lineTo(-i, -i);
    shape.holes.push(hole);
    sel.mesh = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshBasicMaterial({color: 0xFFFFFF, transparent: true, opacity: .9, depthWrite: false, toneMapped: false}));
    sel.mesh.rotation.x = -Math.PI / 2; sel.mesh.position.y = .03; sel.mesh.visible = false; sel.mesh.renderOrder = 2;
    sel.foot = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({color: 0x3BD16F, transparent: true, opacity: .45, depthWrite: false, toneMapped: false}));
    sel.foot.rotation.x = -Math.PI / 2; sel.foot.position.y = .025; sel.foot.visible = false; sel.foot.renderOrder = 1;
    scene.add(sel.mesh, sel.foot);
  }
  /** Marks building id (or none); moving: {x, y, size, ok} lifts it there over a green (fits) or red square. */
  function select(id, moving = null) {
    sel.id = id;
    const e = id != null ? groups.get(id) : null;
    groups.forEach(x => { x.g.position.y = 0; });
    if (!e && !moving) { sel.mesh.visible = sel.foot.visible = false; want(); return; }
    const size = moving ? moving.size : KINDS[e.b.t].size, x = moving ? moving.x : e.b.x, y = moving ? moving.y : e.b.y;
    sel.mesh.visible = true;
    sel.mesh.scale.set(size + .3, size + .3, 1);
    sel.mesh.position.set(W(x + size / 2), .03, W(y + size / 2));
    sel.foot.visible = !!moving;
    if (moving) {
      sel.foot.scale.set(size, size, 1); sel.foot.position.set(W(x + size / 2), .025, W(y + size / 2));
      sel.foot.material.color.set(moving.ok ? 0x3BD16F : 0xE5484D);
      if (e) { e.g.position.set(W(x + size / 2), .25, W(y + size / 2)); }
    }
    want();
  }
  // a building not on the lot yet (the shop's pick), shown where it would go
  let ghost = null;
  function setGhost(g) {
    if (ghost) { root.remove(ghost.g); ghost = null; }
    if (!g) { select(null); return; }
    const size = KINDS[g.t].size;
    const grp = SPR.ready() && SPR.KINDS.includes(g.t) ? SPR.building(g.t, 1, size) : FM.model(g.t, 1, house);
    grp.traverse(m => { if (m.isMesh) { m.castShadow = false; } });
    grp.position.set(W(g.x + size / 2), .25, W(g.y + size / 2));
    root.add(grp);
    ghost = {g: grp};
    select(null, {x: g.x, y: g.y, size, ok: g.ok});
  }
  // the lot's grid, while something is being placed
  const grid = new T.GridHelper(N, N, 0xFFFFFF, 0xFFFFFF);
  grid.material.transparent = true; grid.material.opacity = .16; grid.material.depthWrite = false; grid.position.y = .02; grid.visible = false;
  scene.add(grid);
  const showGrid = on => { placement = !!on; grid.visible = placement; if (village) base.kerbs.forEach(k => { k.visible = placement; }); want(); };
  // ---- a defense's reach (scouting): a pale red disc out to where it hits, a hole where it can't (a trebuchet's
  // nearest), a firmer line round its edge
  const reachM = new T.MeshBasicMaterial({color: 0xFF5A48, transparent: true, opacity: .2, depthWrite: false, toneMapped: false, fog: false});
  const reachDisc = new T.Mesh(new T.RingGeometry(0, 1, 72), reachM);
  const reachEdge = new T.Mesh(new T.RingGeometry(.975, 1, 96), new T.MeshBasicMaterial({color: 0xFF8A70, transparent: true, opacity: .75, depthWrite: false, toneMapped: false, fog: false}));
  [reachDisc, reachEdge].forEach(m => { m.rotation.x = -Math.PI / 2; m.position.y = .021; m.visible = false; m.renderOrder = 1; scene.add(m); });
  /** Shows a reach round tile (x, y): {x, y, out, min} (tiles), or none. */
  function showReach(r) {
    reachDisc.visible = reachEdge.visible = !!r;
    if (r) {
      reachDisc.geometry.dispose();
      reachDisc.geometry = new T.RingGeometry(Math.min(r.min || 0, r.out - .1), r.out, 72);
      reachDisc.position.set(W(r.x), .021, W(r.y));
      reachEdge.position.set(W(r.x), .022, W(r.y)); reachEdge.scale.set(r.out, r.out, 1);
    }
    want();
  }

  // ---- fingers: drag to pan (or to move what onGrab took), pinch or wheel to zoom, tap to pick
  const ptr = new Map();
  let gesture = null;
  const down = e => {
    if (e.button > 0) return;
    canvas.setPointerCapture && (() => { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} })();
    ptr.set(e.pointerId, {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now()});
    if (ptr.size === 1) {
      const tile = tileAt(e.clientX, e.clientY);
      const grab = tile && opts.onGrab ? opts.onGrab(tile, pick(e.clientX, e.clientY)) : false;
      gesture = {kind: grab ? 'grab' : 'pan', moved: false, start: tile, anchor: tile, view: {...view}};
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      gesture = {kind: 'pinch', moved: true, d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: view.dist, mid0: tileAt((a.x + b.x) / 2, (a.y + b.y) / 2)};
    }
  };
  const move = e => {
    const p = ptr.get(e.pointerId);
    if (!p || !gesture) return;
    p.x = e.clientX; p.y = e.clientY;
    if (!gesture.moved && Math.hypot(p.x - p.x0, p.y - p.y0) < 7) return;
    gesture.moved = true;
    autoFrame = false;
    if (gesture.kind === 'grab') { const t = tileAt(p.x, p.y); if (t && opts.onDrag) opts.onDrag(t); return; }
    if (gesture.kind === 'pan' && gesture.anchor) {
      // keep the ground that was under the finger under it
      const t = tileAt(p.x, p.y);
      if (t) { view.tx -= t.x - gesture.anchor.x; view.tz -= t.y - gesture.anchor.y; clampView(); placeCam(); }
      want();
      return;
    }
    if (gesture.kind === 'pinch' && ptr.size >= 2) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      view.dist = gesture.dist0 * gesture.d0 / Math.max(10, d);
      clampView(); placeCam();
      const mid = tileAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (mid && gesture.mid0) { view.tx -= mid.x - gesture.mid0.x; view.tz -= mid.y - gesture.mid0.y; clampView(); }
      want();
    }
  };
  const up = e => {
    const p = ptr.get(e.pointerId);
    ptr.delete(e.pointerId);
    if (!p || !gesture) return;
    if (gesture.kind === 'grab' && gesture.moved) { const t = tileAt(p.x, p.y); if (opts.onDrop) opts.onDrop(t); }
    else if (!gesture.moved && e.type === 'pointerup' && performance.now() - p.t0 < 500 && opts.onTap) {
      opts.onTap({id: pick(p.x, p.y), tile: tileAt(p.x, p.y), x: p.x, y: p.y});
    }
    if (!ptr.size) gesture = null;
    else if (ptr.size === 1) { const q = [...ptr.values()][0]; gesture = {kind: 'pan', moved: true, anchor: tileAt(q.x, q.y)}; }
  };
  const wheel = e => {
    e.preventDefault();
    autoFrame = false;
    const before = tileAt(e.clientX, e.clientY);
    view.dist *= Math.exp(e.deltaY * .0016);
    clampView(); placeCam();
    const after = tileAt(e.clientX, e.clientY);
    if (before && after) { view.tx -= after.x - before.x; view.tz -= after.y - before.y; clampView(); }
    want();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, {passive: false});
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => want()) : null;
  if (ro) ro.observe(host);

  // ---------------------------------------------------------------------------------------------------- a raid
  let raid = null;
  /** Draws battle B (core/realm-battle.js) on this lot: call before the raid's first frame; then raidFrame(t)
   *  each frame with the raid's clock (interpolated between its steps). raider: the raiders' house. */
  function raidStart(B, raider) {
    raidStop();
    const kinds = Object.keys(TROOPS), meshes = {}, m4 = new T.Matrix4();
    let shadows = 0;
    kinds.forEach(k => {
      const n = Math.max(1, (B.left[k] || 0) + (B.used[k] || 0));
      shadows += n;
      const A = ARMY[k];
      if (A) {
        // his picture on a card a tile across, its anchor (where he stands) at the origin; scaled to size each frame
        const g = new T.PlaneGeometry(1, 1);
        g.translate(.5 - A.ax / A.w, A.ay / A.h - .5, 0);
        if (!A.tex) { A.tex = new T.Texture(A.img); A.tex.colorSpace = T.SRGBColorSpace; A.tex.anisotropy = 4; A.tex.needsUpdate = true; }
        const art = new T.InstancedMesh(g, new T.MeshBasicMaterial({map: A.tex, alphaTest: .35, side: T.DoubleSide, toneMapped: false, fog: false}), n);
        art.count = 0; art.frustumCulled = false; art.renderOrder = 3;
        scene.add(art);
        meshes[k] = {art};
        return;
      }
      const parts = FM.troopParts(k, raider);
      const body = new T.InstancedMesh(parts.body, FM.mats().paint, n), leg = new T.InstancedMesh(parts.leg, FM.mats().paint, n * 2);
      body.castShadow = leg.castShadow = true; body.count = leg.count = 0;
      body.frustumCulled = leg.frustumCulled = false;
      scene.add(body, leg);
      meshes[k] = {body, leg};
    });
    // a soft shadow under each soldier drawn from his picture (a dragon's on the ground under it)
    const shadow = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({map: blobTexture(T), transparent: true, depthWrite: false, toneMapped: false, fog: false}), Math.max(1, shadows));
    shadow.count = 0; shadow.frustumCulled = false; shadow.renderOrder = 2; shadow.position.y = .02;
    scene.add(shadow);
    // what flies: arrows (archers, archer towers), bolts (ballistas), boulders (trebuchets), dragon fire
    const arrowGeo = new T.CylinderGeometry(.014, .014, .46, 5); arrowGeo.rotateX(Math.PI / 2);
    const boltGeo = new T.CylinderGeometry(.035, .035, .85, 6); boltGeo.rotateX(Math.PI / 2);
    const mk = (g, mat, n) => { const m = new T.InstancedMesh(g, mat, n); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    const fly = {
      arrow: mk(arrowGeo, new T.MeshStandardMaterial({color: 0x6B4A2A, roughness: .7}), 160),
      bolt: mk(boltGeo, new T.MeshStandardMaterial({color: 0x4A3220, roughness: .6}), 40),
      rock: mk(new T.DodecahedronGeometry(.22, 0), new T.MeshStandardMaterial({color: 0x77726A, roughness: 1, flatShading: true}), 24),
      fire: mk(new T.SphereGeometry(.22, 10, 8), new T.MeshBasicMaterial({color: 0xFF8A1E, toneMapped: false}), 24),
      ball: mk(new T.SphereGeometry(.11, 10, 8), new T.MeshStandardMaterial({color: 0x26272A, roughness: .45, metalness: .7}), 40)
    };
    const puffTex = puffTexture(T), puffs = [];
    for (let i = 0; i < 40; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({map: puffTex, color: 0xBFB7AA, transparent: true, depthWrite: false, opacity: 0}));
      sp.visible = false; scene.add(sp); puffs.push({sp, t0: -9, life: 1, kind: ''});
    }
    // where nothing can be dropped (shown red while a finger's down on the lot)
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const zoneTex = new T.CanvasTexture(cv); zoneTex.magFilter = T.NearestFilter;
    const zone = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshBasicMaterial({map: zoneTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false}));
    zone.rotation.x = -Math.PI / 2; zone.position.y = .015; zone.renderOrder = 1;
    scene.add(zone);
    raid = {B, meshes, shadow, fly, puffs, fxAt: 0, prev: new Map(), cur: new Map(), stepSeen: -1, zone, zoneCv: cv, zoneTex, zoneSig: '', zoneShow: 0, aim: new Map(),
      fired: new Map(), byId: new Map(B.bl.map(b => [b.i, b])), t: 0, shotSeen: new WeakSet()};
    drawZone();
    want();
  }
  function drawZone() {
    if (!raid) return;
    const B = raid.B, sig = B.bl.filter(b => b.dead).length;
    if (sig === raid.zoneSig) return;
    raid.zoneSig = sig;
    const g = raid.zoneCv.getContext('2d'), img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4, bad = !B.canDrop(x + .5, y + .5);
      img.data[o] = 230; img.data[o + 1] = 60; img.data[o + 2] = 60; img.data[o + 3] = bad ? 120 : 0;
    }
    g.putImageData(img, 0, 0);
    raid.zoneTex.needsUpdate = true;
  }
  const showZone = (on) => { if (raid) { raid.zoneShow = on ? performance.now() : -1; want(); } };
  /** One frame of the raid at its clock t (seconds; between steps it eases from where each was to where he is). */
  function raidFrame(t, now = performance.now()) {
    if (!raid) return;
    const B = raid.B, R = raid;
    R.t = t;
    // the steps' positions: keep the last two
    if (B.step !== R.stepSeen) {
      R.prev = R.cur; R.cur = new Map();
      B.tr.forEach(u => R.cur.set(u.id, {x: u.x, y: u.y}));
      R.stepSeen = B.step;
    }
    const f = Math.max(0, Math.min(1, (t - (B.t - .1)) / .1));
    // the soldiers
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1.5, 1.5, 1.5), up = new T.Vector3(0, 1, 0), pv = new T.Vector3();
    const counts = {}, camQ = cam.quaternion, tilt = new T.Quaternion(), zAxis = new T.Vector3(0, 0, 1), ssc = new T.Vector3();
    let nShadow = 0;
    Object.keys(R.meshes).forEach(k => { counts[k] = 0; });
    B.tr.forEach(u => {
      if (u.dead) return;
      const M = R.meshes[u.t], c = R.cur.get(u.id), p = R.prev.get(u.id) || c;
      if (!M || !c) return;
      const x = p.x + (c.x - p.x) * f, y = p.y + (c.y - p.y) * f;
      const moving = Math.hypot(c.x - p.x, c.y - p.y) > .001, swing = moving ? Math.sin(t * 14 + u.id) * .6 : 0;
      const hit = t - u.hitAt < .35 ? Math.sin((t - u.hitAt) / .35 * Math.PI) : 0;
      if (M.art) {
        // his picture facing the camera, turned the way he's going (the way the screen sees it), a step's bob and
        // rock as he walks, knocked back a little when he's hit; the Dragon high up, bobbing
        const A = ARMY[u.t], right = Math.cos(u.face) - Math.sin(u.face) >= 0, sx = right === A.right ? 1 : -1;
        const wk = A.fly ? A.wide : A.tall * A.w / A.h, hk = A.fly ? A.wide * A.h / A.w : A.tall;
        const hy = A.fly ? 2.3 + Math.sin(t * 2.2 + u.id) * .15 : (moving ? Math.abs(Math.sin(t * 9 + u.id)) * .06 : 0);
        tilt.setFromAxisAngle(zAxis, (moving && !A.fly ? Math.sin(t * 9 + u.id) * .06 : 0) + sx * .25 * hit);
        pv.set(W(x), hy, W(y));
        m4.compose(pv, camQ.clone().multiply(tilt), ssc.set(wk * sx, hk, 1));
        M.art.setMatrixAt(counts[u.t]++, m4);
        const sw = A.fly ? 1.6 : Math.max(.55, wk * .8);
        m4.compose(pv.set(W(x), 0, W(y)), q.identity(), ssc.set(sw, 1, sw * .6));
        R.shadow.setMatrixAt(nShadow++, m4);
        return;
      }
      const face = -u.face + Math.PI / 2;
      q.setFromAxisAngle(up, face);
      const i = counts[u.t]++;
      if (u.t === 'dragon') {
        // in the air, bobbing, its wings beating
        const flap = Math.sin(t * 7 + u.id) * .55, hy = 2.3 + Math.sin(t * 2.2 + u.id) * .12;
        pv.set(W(x), hy, W(y));
        m4.compose(pv, q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -.08 - .25 * hit)), sc); M.body.setMatrixAt(i, m4);
        [-1, 1].forEach((sd, j) => {
          const wq = q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), sd * flap));
          const off = new T.Vector3(sd * .2, .12, .1).multiplyScalar(1.5).applyQuaternion(q);
          m4.compose(new T.Vector3(pv.x + off.x, hy + off.y, pv.z + off.z), wq, new T.Vector3(sd * 1.5, 1.5, 1.5)); M.leg.setMatrixAt(i * 2 + j, m4);
        });
        return;
      }
      const lean = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), .15 * (moving ? 1 : 0) + .5 * hit);
      const qq = q.clone().multiply(lean);
      const bob = moving ? Math.abs(Math.sin(t * 14 + u.id)) * .04 : 0;
      pv.set(W(x), .33 + bob, W(y));
      m4.compose(pv, qq, sc); M.body.setMatrixAt(i, m4);
      [-1, 1].forEach((sd, j) => {
        const lq = q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), sd * swing));
        const off = new T.Vector3(sd * .09 * (u.t === 'knight' ? 1.35 : 1), 0, 0).applyQuaternion(q);
        m4.compose(new T.Vector3(pv.x + off.x, .33 + bob, pv.z + off.z), lq, sc); M.leg.setMatrixAt(i * 2 + j, m4);
      });
    });
    Object.entries(R.meshes).forEach(([k, M]) => {
      if (M.art) { M.art.count = counts[k]; M.art.instanceMatrix.needsUpdate = true; return; }
      M.body.count = counts[k]; M.leg.count = counts[k] * 2; M.body.instanceMatrix.needsUpdate = true; M.leg.instanceMatrix.needsUpdate = true;
    });
    R.shadow.count = nShadow; R.shadow.instanceMatrix.needsUpdate = true;
    // what's in the air: each along its arc, pointing the way it's going
    const KIND = {archer: 'arrow', tower: 'arrow', ballista: 'bolt', trebuchet: 'rock', dragon: 'fire', cannon: 'ball'};
    const ARC = {trebuchet: 4, archer: 1.1, tower: 1, ballista: .35, dragon: .15, cannon: .3};
    const n = {arrow: 0, bolt: 0, rock: 0, fire: 0, ball: 0}, dir = new T.Vector3(), fwd = new T.Vector3(0, 0, 1), one = new T.Vector3(1, 1, 1);
    const a0 = new T.Vector3(), a1 = new T.Vector3();
    B.shots.forEach(s => {
      if (s.foe && !R.shotSeen.has(s)) { R.shotSeen.add(s); R.fired.set(s.from, Math.max(R.fired.get(s.from) ?? -9, s.t0)); if (s.k === 'cannon') puff(s.x0 + Math.cos(Math.atan2(s.y1 - s.y0, s.x1 - s.x0)) * 1.1, s.y0 + Math.sin(Math.atan2(s.y1 - s.y0, s.x1 - s.x0)) * 1.1, .7, 0xD8D2C8, .5, now); }
      const kind = KIND[s.k];
      if (!kind) return;
      const M = R.fly[kind];
      if (n[kind] >= M.instanceMatrix.count) return;
      const u = Math.max(0, Math.min(1, (t - s.t0) / Math.max(.01, s.t1 - s.t0))), arc = ARC[s.k] || .5;
      const y0 = s.foe ? (s.k === 'tower' ? 2.6 : s.k === 'cannon' ? .68 : 1.1) : (s.k === 'dragon' ? 2.2 : .55), y1 = s.high ? 2.3 : .35;
      // (a tower's arrow leaves from its archer's bow)
      const archer = s.foe && s.k === 'tower' ? archerAt(s.from) : null;
      if (archer) a0.copy(archer); else a0.set(W(s.x0), y0, W(s.y0));
      a1.set(W(s.x1), y1, W(s.y1));
      dir.subVectors(a1, a0); dir.y += arc * 4 * (1 - 2 * u); dir.normalize();
      q.setFromUnitVectors(fwd, dir);
      pv.lerpVectors(a0, a1, u); pv.y += arc * 4 * u * (1 - u);
      m4.compose(pv, q, kind === 'fire' ? new T.Vector3(1 + u, 1 + u, 1 + u) : one);
      M.setMatrixAt(n[kind]++, m4);
    });
    Object.entries(R.fly).forEach(([k, M]) => { M.count = n[k]; M.instanceMatrix.needsUpdate = true; });
    // the defenses turn to whom they're shooting at; the cauldron tips when it pours
    B.bl.forEach(b => {
      if (!b.def) return;
      const e = groups.get(b.i);
      const top = e && e.g.getObjectByName('top');
      if (!top) return;
      if (b.t === 'cauldron') { const tip = B.t - (b.cd > 0 ? (b.def.every - b.cd) : 9) < .5 ? .6 : .15; top.rotation.z += (tip - top.rotation.z) * .3; }
      else { const want = -b.aim + Math.PI / 2; const cur = R.aim.get(b.i) ?? want; const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); const nv = cur + d * .25; R.aim.set(b.i, nv); top.rotation.y = nv; }
    });
    // what happened since the last frame: dust, splashes, puffs
    for (; R.fxAt < B.fx.length; R.fxAt++) {
      const e = B.fx[R.fxAt];
      if (e.k === 'boom') { for (let j = 0; j < (e.wall ? 1 : 4); j++) puff(e.x + (j % 2 - .5) * .8, e.y + (j > 1 ? .4 : -.4), e.wall ? .9 : 2.4, 0xB5AC9E, 1.1, now); }
      else if (e.k === 'land' && e.splash) puff(e.x, e.y, e.splash * 2.2, e.of === 'cauldron' ? 0xE0641E : 0xC9BCA4, .6, now);
      else if (e.k === 'hit' && e.of === 'dragon') puff(e.x, e.y, 1.8, 0xFF7A1E, .5, now);
      else if (e.k === 'down') puff(e.x, e.y, .9, 0xDDDDDD, .6, now);
    }
    R.puffs.forEach(p => {
      if (!p.sp.visible) return;
      const a = (now - p.t0) / 1000 / p.life;
      if (a >= 1) { p.sp.visible = false; return; }
      p.sp.material.opacity = .85 * (1 - a);
      const s = p.size * (.5 + a * .8); p.sp.scale.set(s, s, 1);
      p.sp.position.y = .4 + a * .8;
    });
    // the red zone fades out a moment after a refused drop
    drawZone();
    const zt = R.zoneShow > 0 ? (now - R.zoneShow) / 1000 : 9;
    R.zone.material.opacity = zt < 1.2 ? .9 * (1 - Math.max(0, zt - .6) / .6) : 0;
  }
  /** Where a tower's archer looses from (world), or null when it's drawn in 3D. */
  function archerAt(id) {
    const e = groups.get(id), f = e && e.folk.find(x => x.c.role === 'archer' && x.sp.visible);
    return f ? f.sp.position.clone().addScaledVector(camU, .45) : null;
  }
  function puff(x, y, size, color, life, now) {
    const p = raid.puffs.find(q => !q.sp.visible) || raid.puffs[0];
    p.sp.visible = true; p.sp.material.color.set(color); p.t0 = now; p.life = life; p.size = size;
    p.sp.position.set(W(x), .4, W(y));
  }
  function raidStop() {
    if (!raid) return;
    Object.values(raid.meshes).forEach(M => {
      if (M.art) { scene.remove(M.art); M.art.geometry.dispose(); M.art.material.dispose(); M.art.dispose(); return; }
      scene.remove(M.body, M.leg); M.body.dispose(); M.leg.dispose();
    });
    scene.remove(raid.shadow); raid.shadow.geometry.dispose(); raid.shadow.material.map.dispose(); raid.shadow.material.dispose(); raid.shadow.dispose();
    Object.values(raid.fly).forEach(M => { scene.remove(M); M.dispose(); });
    scene.remove(raid.zone);
    raid.puffs.forEach(p => scene.remove(p.sp));
    raid = null;
  }

  // ---- the frame hook (a raid's clock, the job timers' redraws)
  const setAnim = fn => { anim = fn; want(); };
  const look = (x, y, dist) => { autoFrame = false; view.tx = W(x); view.tz = W(y); if (dist) view.dist = dist; clampView(); want(); };
  /** Frame the village between the HUD and action bar. Manual camera gestures keep their view until recentered. */
  function frameVillage({margin = 1.15, maxDistance = Infinity} = {}) {
    if (!village || !lotState || !lotState.b.length || !data.isOwner()) return;
    if (!isActive()) { autoFrame = true; return; }
    framing = true;
    resize();
    const bs = lotState.b, x0 = Math.min(...bs.map(b => b.x)), y0 = Math.min(...bs.map(b => b.y));
    const x1 = Math.max(...bs.map(b => b.x + KINDS[b.t].size)), y1 = Math.max(...bs.map(b => b.y + KINDS[b.t].size));
    view.tx = W((x0 + x1) / 2); view.tz = W((y0 + y1) / 2);
    view.dist = Math.max(38, (x1 - x0 + y1 - y0) / Math.SQRT2 / (2 * Math.tan(cam.fov * Math.PI / 360) * cam.aspect));
    const hud = parseFloat(getComputedStyle(host.parentElement).getPropertyValue('--rl-hud-t')) || 80;
    const top = Math.min(Hd * .27, Math.max(125, hud + 112)), bottom = Math.min(Hd * .28, 178);
    const left = 28, right = Wd - 28, lower = Hd - bottom;
    for (let n = 0; n < 7; n++) {
      clampView(); placeCam();
      const points = [];
      bs.forEach(b => {
        const sz = KINDS[b.t].size, e = groups.get(b.i), art = e && e.g.userData;
        for (const x of [b.x, b.x + sz]) for (const y of [b.y, b.y + sz]) points.push(project(x, y, 0));
        if (art && art.sprite) {
          const at = new T.Vector3(); art.sprite.getWorldPosition(at);
          const p = project(at.x + N / 2, at.z + N / 2, at.y), d = at.distanceTo(cam.position);
          const px = Hd / (2 * Math.tan(cam.fov * Math.PI / 360) * d);
          points.push({x: p.x - art.ax * art.k * px, y: p.y - art.ay * art.k * px}, {x: p.x + (art.w - art.ax) * art.k * px, y: p.y + (art.h - art.ay) * art.k * px});
        } else points.push(project(b.x + sz / 2, b.y + sz / 2, b.t === 'wall' ? 1.8 : 3.5));
      });
      const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
      const rect = canvas.getBoundingClientRect();
      const from = tileAt(rect.left + (minX + maxX) / 2, rect.top + (minY + maxY) / 2);
      const to = tileAt(rect.left + (left + right) / 2, rect.top + (top + lower) / 2);
      if (from && to) { view.tx += from.x - to.x; view.tz += from.y - to.y; }
      const ratio = Math.max((maxX - minX) * margin / Math.max(1, right - left), (maxY - minY) * margin / Math.max(1, lower - top));
      view.dist = Math.min(maxDistance, Math.max(38, view.dist * Math.max(.75, Math.min(1.5, ratio))));
    }
    clampView(); placeCam(); autoFrame = true; framing = false; want();
  }
  /** Frames the box of tiles [x0, x1] x [y0, y1] (seen corner-on, a diamond), as big as it fits. */
  const fit = (x0, y0, x1, y1, margin = 1.15, most = ZMAX) => {
    resize();
    const wTiles = (x1 - x0 + y1 - y0) / Math.SQRT2, hTiles = wTiles * Math.sin(PITCH) * .55 + 3;
    const vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    const d = Math.max(wTiles / 2 / Math.tan(hf / 2), hTiles / 2 / Math.tan(vf / 2)) * margin;
    view.tx = W((x0 + x1) / 2); view.tz = W((y0 + y1) / 2); view.dist = Math.min(d, most);
    clampView(); want();
  };
  /** Zooms in (k < 1) or out (k > 1) about the middle of the screen. */
  const zoomBy = k => { autoFrame = false; view.dist *= k; clampView(); want(); };
  /** Explore the entire landscape; the 44 × 44 village square keeps its original dimensions. */
  function frameWorld() {
    if (!village || !data.isOwner()) return;
    autoFrame = false; resize();
    if (scene0) {
      const center = scene0.under(scene0.w / 2, scene0.h / 2);
      view.tx = center.x; view.tz = center.z;
      view.dist = zTop;
    } else { view.tx = view.tz = 0; view.dist = ZMAX; }
    clampView(); placeCam(); want();
  }
  resize(); placeCam(); want();
  return {
    setLot, select, setGhost, showGrid, showReach, pick, tileAt, project, want, setAnim, look, frame: fit, frameVillage, frameWorld, zoomBy, resize,
    raidStart, raidFrame, raidStop, showZone,
    get zoom() { return view.dist; },
    get overlayScale() { return village ? Math.max(.5, Math.min(1, 70 / view.dist)) : 1; },
    get overview() { return village && view.dist > 145; },
    /** Lays scenery theme k round the lot (once it's in). */
    setTheme(k) { theme = k || 'coast'; wantScenery(Wd, Hd); if (scene0) { zTop = mostOut(); clampView(); } want(); },
    get theme() { return theme; },
    canvas,
    dispose() {
      dead = true;
      dropScenery();
      clearInterval(folkTimer);
      groups.forEach(dropFolk);
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (wear) { wear.mesh.geometry.dispose(); wear.mesh.material.dispose(); wear.tex.dispose(); }
      if (village && base.plot.material.map) base.plot.material.map.dispose();
      raidStop();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (_) {}
      canvas.remove();
    }
  };
}
