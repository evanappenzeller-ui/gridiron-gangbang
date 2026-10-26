import * as features from '../core/features.js';
// The Keep's lot in 3D (views/realm.js and views/realm-raid.js): three.js (js/vendor/three, MIT), a camera looking down
// across the lot corner-on (a diamond, as these games are), dragged to pan, pinched or wheeled to zoom. The lot lies in
// the middle of its land; folk stand about: villagers at work by their buildings, an archer up each tower, a cannon's
// crew round it, a trebuchet's catapult on its platform. It draws when something moved (a finger, a raid) and, while
// there are folk about, a few times a second for them.
// The full 3D Keepfall (Oct 25 2026, the owner's ask: "this game should be all 3d from here on out"): the land is real
// terrain, its forests, rocks and water models (views/realm-world.js), no painting; every building is modelled
// (views/realm-buildings.js; realm-models.js's plain 3D ones while a model's missing), and every soldier, villager,
// crew, guard and hero is an animated Western Kingdoms model (realm-characters.js), plain 3D figures while one's
// missing; dragons are realm-dragon.js's. Only effects face the camera: fire, dust and the hero badges.
// What the defenses loose and what the raiders shoot (arrows, bolts, boulders, fire), dust where a building goes down.
// load() → true when three.js is in and this phone has WebGL; create(host, opts) → the view (see its methods).
import * as FM from './realm-models.js';
import * as WALLS from './realm-walls.js';
import {KINDS, TROOPS, N, EDGE} from '../core/realm.js';
import * as data from '../core/data.js';
import {createWildlife} from './realm-wildlife.js';
import {createWorld} from './realm-world.js';
import {createHomeNPCs, createBattleHeroes, npcPaths} from './realm-npcs.js';
import {routineRoute, homeRoutine} from './realm-routines.js';
import * as CH from './realm-characters.js';
import * as BUILD from './realm-buildings.js';
import {isDragonKind, dragonCanFly, loadDragon, onDragonReady, createBattleDragons, createHomeDragon, createSceneryDragons} from './realm-dragon.js';
const {createWallView, wallPreview} = WALLS;
const V = new URL('../vendor/three/', import.meta.url).href;
let T = null, RE = null, LOADING = null, DEAD = false, LOAD_EPOCH = 0;
let ownerActive = features.available();
data.subscribe(type => { if (type !== 'me') return; const next = features.available(); if (next !== ownerActive) { ownerActive = next; LOAD_EPOCH++; LOADING = null; } });
/** Loads three.js and the models (buildings, walls, characters); the land's own models come as each view wants them. */
export function load() {
  if (!features.available()) return Promise.resolve(false);
  const epoch = LOAD_EPOCH, active = () => features.available() && epoch === LOAD_EPOCH;
  if (LOADING) return LOADING.then(async ok => {
    if (!ok || !active()) return false;
    await Promise.all([CH.load(T), BUILD.load(T), WALLS.load(T)]);
    return active();
  });
  const task = (async () => {
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
      const [three, {RoomEnvironment}, BU] = await Promise.all([import(V + 'three.module.min.js'), import(V + 'RoomEnvironment.js'), import(V + 'BufferGeometryUtils.js')]);
      if (!active()) return false;
      T = three; RE = RoomEnvironment;
      FM.init(T, BU);
      await Promise.all([CH.load(T), BUILD.load(T), WALLS.load(T)]);
      if (!active()) return false;
      try { await document.fonts.load('800 60px "Barlow Condensed"'); } catch (_) {}
      return active();
    } catch (e) {
      if (active()) { console.warn('The Keep: no 3D', e); DEAD = true; }
      return false;
    }
  })();
  LOADING = task;
  return task.then(ok => { if (LOADING === task && !ok && !DEAD) LOADING = null; return ok && active(); });
}
export const ready = () => !!T && !DEAD;

// The camera looks down across the lot corner-on, the floor .54 as deep as it is wide on the screen.
export const YAW = Math.PI / 4, PITCH = Math.asin(.54);
const W = (x) => x - N / 2; // a tile coordinate to the world's (the lot centred on the origin)

// Who works round building b (its status: ok, new, up, down), each an animated model: [{role (work: a villager, at
// home only; crew: a cannon's; archer: on a tower; build: a builder at a job; engine: a trebuchet's catapult), u, v
// (tiles from its middle), kind (realm-characters.js), height}].
function crewOf(b, status, size) {
  if (status === 'down') return [];
  const s = size, left = [s * .18, s / 2 + .45], right = [s / 2 + .45, s * .18];
  if (status !== 'ok') return [{role: 'build', u: left[0], v: left[1], kind: 'worker'}];
  if (b.t === 'cannon') return [{role: 'crew', u: -.35, v: 1.15, kind: 'worker'}, {role: 'crew', u: 1.15, v: -.3, kind: 'worker'}];
  if (b.t === 'tower') return [{role: 'archer', u: 0, v: 0, kind: 'archer', height: 1.15}];
  if (b.t === 'trebuchet') return [{role: 'engine', u: 0, v: 0, kind: 'catapult', height: 1.2 + .06 * Math.min(6, b.l)}];
  const two = {keep: 2, farm: 2, barracks: 2, camp: 2, hut: 1, mine: 1, treasury: 1, granary: 1, hatchery: 1}[b.t] || 0;
  return [left, right].slice(0, two).map(([u, v]) => ({role: 'work', u, v, kind: 'worker'}));
}

// ---- pictures of the models for the shop and the army (rendered once each, on a small canvas of their own)
let THUMB = null;
const THUMBS = new Map();
/** A plain 3D soldier (realm-models.js's parts) for kind k: the stand-in while its model's missing. */
function plainTroop(k, house) {
  const parts = FM.troopParts(k, house), mat = FM.mats().paint, obj = new T.Group();
  const body = new T.Mesh(parts.body, mat); body.position.y = .22; obj.add(body);
  if (k === 'dragon') [-1, 1].forEach(sd => { const w = new T.Mesh(parts.leg, mat); w.position.set(sd * .18, .32, .1); w.scale.x = sd; w.rotation.z = sd * .35; obj.add(w); });
  else [-1, 1].forEach(sd => { const lg = new T.Mesh(parts.leg, mat); lg.position.set(sd * .06 * (k === 'knight' ? 1.35 : 1), .22, 0); lg.rotation.x = sd * .3; obj.add(lg); });
  return obj;
}
// (each troop's model and how tall he stands: a knight in plate a head over a thief)
const TROOP_MODEL = {footman: ['footman', 1.15], archer: ['archer', 1.15], knight: ['knight', 1.28], thief: ['thief', 1.08]};
/** A picture (data URL) of kind k at level l in a house's colours, or of a soldier (troop: true): rendered from the
 *  3D model the lot draws it with. card: {w, h} px for a building's card (on a patch of its ground), else 160 square. */
export function thumb(k, l, house, troop = false, card = null) {
  if (!ready() || !features.available()) return '';
  const W0 = card ? card.w : 160, H0 = card ? card.h : 160;
  const key = `${troop ? 't' : 'b'}:${k}:${l}:${house.pri}:${house.sigil}:${W0}x${H0}:${BUILD.ready(k)}:${CH.ready(TROOP_MODEL[k]?.[0])}`;
  if (THUMBS.has(key)) return THUMBS.get(key);
  let actor = null;
  try {
    if (!THUMB) {
      const r = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
      r.setPixelRatio(1);
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping;
      const sc = new T.Scene(), pm = new T.PMREMGenerator(r);
      sc.environment = pm.fromScene(new RE(r), .04).texture; pm.dispose();
      sc.add(new T.HemisphereLight(0xFFFFFF, 0x445533, 1.2));
      const sun = new T.DirectionalLight(0xFFF0D8, 2.2); sun.position.set(-3, 6, 4); sc.add(sun);
      THUMB = {r, sc, cam: new T.OrthographicCamera(-1, 1, 1, -1, .1, 100), w: 0, h: 0};
    }
    const {r, sc, cam} = THUMB;
    if (THUMB.w !== W0 || THUMB.h !== H0) { r.setSize(W0, H0, false); THUMB.w = W0; THUMB.h = H0; }
    let obj;
    if (troop) {
      const m = TROOP_MODEL[k];
      actor = m && CH.ready(m[0]) ? CH.create(m[0], {height: m[1]}) : null;
      obj = actor ? actor.root : plainTroop(k, house);
      if (actor) { obj.rotation.y = .5; actor.pose('idle', .4); }
    } else obj = k === 'wall' ? wallPreview(T, l, true) : BUILD.create(k, l, KINDS[k] ? KINDS[k].size : 3) || FM.model(k, l, house);
    sc.add(obj);
    let patch = null;
    if (card && !troop) {
      // (its footprint: a patch of grass under it, as on the lot)
      const sz0 = KINDS[k] ? KINDS[k].size : 1;
      patch = new T.Mesh(new T.PlaneGeometry(sz0 + .4, sz0 + .4).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({color: 0x6f8f4a, roughness: 1}));
      patch.position.y = -.01; sc.add(patch);
    }
    sc.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
    const R = Math.max(sz.x, sz.y, sz.z) * (card ? .7 : .62), aspect = W0 / H0;
    cam.left = -R * aspect; cam.right = R * aspect; cam.top = R; cam.bottom = -R; cam.updateProjectionMatrix();
    cam.position.set(c.x + R * 2 * Math.sin(YAW), c.y + R * 2 * Math.sin(.6), c.z + R * 2 * Math.cos(YAW)); cam.lookAt(c);
    r.setClearColor(0x000000, 0);
    r.render(sc, cam);
    const url = r.domElement.toDataURL('image/png');
    sc.remove(obj);
    if (patch) { sc.remove(patch); patch.geometry.dispose(); patch.material.dispose(); }
    if (actor) actor.dispose();
    THUMBS.set(key, url);
    // (its own GPU context, let go a few seconds after the last picture: the pictures stay, as data URLs)
    clearTimeout(THUMB.idle);
    THUMB.idle = setTimeout(releaseThumb, 4000);
    return url;
  } catch (e) { if (actor) actor.dispose(); return ''; }
}
function releaseThumb() {
  if (!THUMB) return;
  const {r, sc} = THUMB;
  THUMB = null;
  if (sc.environment) sc.environment.dispose();
  r.dispose();
  try { r.forceContextLoss(); } catch (_) {}
}

/** Frees what a building group owns (its rank studs): its shared model and materials stay. */
function releaseOwned(group) {
  const owned = group && group.userData && group.userData.owned;
  if (!owned) return;
  owned.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); if (mesh.isInstancedMesh) mesh.dispose(); });
  group.userData.owned = [];
}
function blobTexture(T) {
  // a soft round shadow
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(.6, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(cv);
}
// A dragon's fire (a raid's): a hot white heart, yellow, then orange going to nothing (drawn adding its light).
const FLAME = 4;
function flameTexture(T) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(.22, 'rgba(255,214,90,.95)'); gr.addColorStop(.5, 'rgba(255,120,24,.6)');
  gr.addColorStop(.78, 'rgba(200,48,8,.22)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
  return t;
}
function puffTexture(T) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
  return t;
}

/**
 * The view, in host (filled). opts: {house: {pri, sec, sigil}, zoom (start), onTap(hit), onGrab(tile) → bool (a drag
 * that starts here moves something instead of panning: onDrag(tile), onDrop(tile)), onCamera()}.
 */
export function create(host, opts = {}) {
  if (!features.available() || !ready()) return null;
  const village = !!opts.village && features.available();
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
  let lost = false, lostTimer = 0;
  // (a phone short of memory can take the GPU back and never return it: then the owner builds the view again)
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true;
    clearTimeout(lostTimer);
    if (opts.onLost) lostTimer = setTimeout(() => { if (lost && !dead) opts.onLost(); }, 2500);
  });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; clearTimeout(lostTimer); want(); });

  const scene = new T.Scene();
  scene.background = new T.Color(0x9AAEC0);
  scene.fog = new T.Fog(0xA3B4C4, 70, 140);
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RE(renderer), .04).texture;
  pmrem.dispose();
  const hemi = new T.HemisphereLight(0xDCE6F2, 0x3E5530, .75); scene.add(hemi);
  const sun = new T.DirectionalLight(0xFFE8C8, 2.4);
  sun.position.set(-16, 30, 12); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  Object.assign(sun.shadow.camera, {left: -N * .7, right: N * .7, top: N * .7, bottom: -N * .7, near: 1, far: 90});
  scene.add(sun, sun.target);

  // ---- the land (views/realm-world.js): opts.scenery's (core/realm.js SCENERIES; the coast if none), its terrain,
  // water, woods and rocks round the lot, its sky and light; the village's wildlife about it
  let theme = opts.scenery || 'coast', wildlife = null;
  // (a raid, a scout and a replay look at the lot: fewer trees round it, the same land)
  const world = createWorld(T, scene, {theme, onChange: () => want(), maxAnisotropy: renderer.capabilities.getMaxAnisotropy(), detail: village ? 1 : .55});
  function lightFor() {
    const L = world.light;
    scene.background = world.background || new T.Color(L.fog);
    scene.fog.color.set(L.fog);
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1];
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
  }
  function wildlifeFor() {
    if (wildlife) { wildlife.dispose(); wildlife = null; }
    if (village) wildlife = createWildlife(T, world.group, {theme: world.theme, ground: world.ground, pitch: PITCH, onChange: () => queueMicrotask(() => want()),
      dragonModels: (three, group, n) => createSceneryDragons(three, group, n)});
  }
  lightFor(); wildlifeFor();

  // ---- the base: where everything's built and moved about (the lot inside its EDGE: core/realm.js fits()), the land's
  // own ground; a low stone kerb round it while something's being placed, the buildings' shadows over it all
  const base = {};
  {
    const B = N - 2 * EDGE;
    const kerbM = new T.MeshStandardMaterial({color: 0x9A9284, roughness: .9}), w = .26, hgt = .14, kerbs = [];
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([sx, sz]) => {
      const k = new T.Mesh(new T.BoxGeometry(sx ? w : B + 2 * w, hgt, sz ? w : B + 2 * w), kerbM);
      k.position.set(sx * (B + w) / 2, hgt / 2, sz * (B + w) / 2); k.receiveShadow = true; k.visible = false;
      scene.add(k);
      kerbs.push(k);
    });
    const shade = new T.Mesh(new T.PlaneGeometry(N + 6, N + 6), new T.ShadowMaterial({opacity: .34}));
    shade.rotation.x = -Math.PI / 2; shade.position.y = .016; shade.receiveShadow = true; shade.renderOrder = -2000;
    scene.add(shade);
    Object.assign(base, {B, kerbM, kerbs, shade});
  }

  // ---- the camera: looking down across the lot corner-on
  const cam = new T.PerspectiveCamera(30, 1, .5, 400);
  const view = {tx: 0, tz: 0, dist: opts.zoom || 46};
  const placeCam = () => {
    const h = Math.cos(PITCH) * view.dist;
    cam.position.set(view.tx + Math.sin(YAW) * h, Math.sin(PITCH) * view.dist, view.tz + Math.cos(YAW) * h);
    cam.lookAt(view.tx, 0, view.tz);
    // (the near and far planes go with the zoom: zoomed right out over the land it's hundreds of yards off)
    const nr = Math.max(.5, view.dist * .03), fr = view.dist * 3 + 160;
    if (cam.near !== nr || cam.far !== fr) { cam.near = nr; cam.far = fr; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    scene.fog.near = view.dist * 1.05 + 35; scene.fog.far = view.dist * 2.1 + 150;
  };
  // (the village may be looked over from far out and wandered round its land; a raid, a scout and a replay keep to the lot)
  const ZMIN = 14, ZMAX = village ? 170 : 130, PAN = village ? world.extent : N / 2 + 2;
  const zTop = ZMAX;
  const clampView = () => {
    view.dist = Math.max(ZMIN, Math.min(zTop, view.dist));
    view.tx = Math.max(-PAN, Math.min(PAN, view.tx)); view.tz = Math.max(-PAN, Math.min(PAN, view.tz));
  };
  let Wd = 1, Hd = 1;
  const resize = () => {
    if (!isActive()) return;
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    if (w === Wd && h === Hd) return;
    Wd = w; Hd = h;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    cam.aspect = w / h; cam.updateProjectionMatrix();


    clampView();
    if (village && autoFrame && lotState && !framing) frameVillage();
    want();
  };

  // ---- drawing on demand
  let raf = 0, dead = false, anim = null, cameraSig = '', flyTimer = 0;
  const want = () => { if (!raf && !dead && isActive() && !document.hidden) raf = requestAnimationFrame(frame); };
  let drawnAt = 0;
  function frame(now) {
    raf = 0;
    if (dead || lost || !isActive() || document.hidden) return;
    // (about 60 a second at most: a 90 or 120 Hz phone would draw everything up to twice as often for nothing; the
    // raid's and the folk's clocks run by the time gone, so they play the same)
    if (drawnAt && now - drawnAt < 12) { raf = requestAnimationFrame(frame); return; }
    drawnAt = now;
    resize();
    placeCam();
    let more = false;
    if (anim) more = anim(now) !== false;
    const sig = [view.tx, view.tz, view.dist, Wd, Hd].join(':');
    // (the wildlife, like the dragon over the hatchery, about 30 frames a second: the whole land needn't be drawn at 60)
    const lively = !!wildlife && wildlife.update(now / 1000, {zoom: view.dist, active: document.visibilityState === 'visible'});
    // (and the land's own: windmill sails, chimney smoke, fireflies or snow; still under reduced motion)
    const stirring = world.update(now / 1000, {camera: cam, still: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches});
    if (homeNPCs) homeNPCs.update(now / 1000, {zoom: view.dist, active: !raid, placement});
    // (the dragon over the hatchery: about 30 frames a second while it's on the screen, not every refresh)
    const flying = !!homeDragon && homeDragon.update(now / 1000, {zoom: view.dist, active: !raid, placement, camera: cam});
    folkFrame(now);
    revealDepthCleared = false;
    renderer.render(scene, cam);
    if (opts.onCamera && sig !== cameraSig) { cameraSig = sig; opts.onCamera(); }
    clearTimeout(flyTimer); flyTimer = 0;
    if (more) want();
    else if (flying || lively || stirring) flyTimer = setTimeout(() => { flyTimer = 0; want(); }, 33);
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
  const homeNPCs = village ? createHomeNPCs(T, scene, {onChange: () => want()}) : null;
  // the dragon over the hatchery (views/realm-dragon.js); its model is fetched when a dragon's wanted (a built hatchery,
  // a raid with one, the scenery's first in view), and each view redraws when it comes in
  const homeDragon = village ? createHomeDragon(T, scene, {renderer, camera: cam}) : null;
  const offDragon = onDragonReady(() => {
    want();
    if (raid && raid.need.dragon) raid.dragons.warm(renderer, cam, Math.min(4, raid.need.dragon));
  });
  const groups = new Map(); // id -> {g, key, b}
  const picks = [];
  const root = new T.Group(); scene.add(root);
  const wallView = createWallView(T, root, W);
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
    clearReveal();
    lotState = s;
    const layout = s.b.map(b => `${b.i}:${b.t}:${b.x}:${b.y}:${b.l}`).join('|'), layoutChanged = layout !== layoutSig;
    layoutSig = layout;
    updateWear(s);
    const now = o.now || Date.now(), gone = o.gone || new Set();
    if (o.house) house = o.house;
    if (homeNPCs) homeNPCs.setLot(s, {house});
    if (homeDragon) homeDragon.setLot(s);
    const seen = new Set();
    let folkChanged = layoutChanged;
    s.b.forEach(b => {
      if (b.t === 'wall') return;
      seen.add(b.i);
      const size = KINDS[b.t].size, down = gone.has(b.i), status = down ? 'down' : b.u > now ? (b.l < 1 ? 'new' : 'up') : 'ok';
      const key = `${b.t}:${b.l}:${status}:${house.pri}:${house.sigil}`;
      let e = groups.get(b.i);
      if (!e || e.key !== key) {
        folkChanged = true;
        if (e) { root.remove(e.g); releaseOwned(e.g); dropFolk(e); }
        const g = new T.Group();
        if (status === 'down') g.add(FM.rubble(size));
        else if (status === 'new') { g.add(FM.scaffold(size)); }
        else {
          const art = BUILD.create(b.t, b.l, size);
          g.add(art || FM.model(b.t, b.l, house));
          if (art) g.userData = art.userData;
          if (status === 'up') g.add(FM.scaffold(size));
        }
        g.traverse(m => { if (m.isMesh) m.userData.bid = b.i; });
        root.add(g);
        e = {g, key, b, folk: []};
        groups.set(b.i, e);
        crewOf(b, status, size).forEach((c, j) => {
          const ph = ((b.i * 7919 + j * 104729) % 1000) / 1000;
          const actor = CH.create(c.kind, {height: c.height || 1.05, phase: ph});
          if (actor) { actor.root.userData.homeRole = c.role; actor.root.visible = false; scene.add(actor.root); }
          // (a trebuchet's catapult while its model's missing: the plain one, standing on its platform)
          else if (c.role === 'engine') { const top = FM.model('trebuchet', b.l, house); top.scale.setScalar(.7); g.add(top); return; }
          if (actor) e.folk.push({c, ph, actor});
        });
      }
      e.b = b;
      e.g.position.set(W(b.x + size / 2), 0, W(b.y + size / 2));
    });
    [...groups.keys()].forEach(id => { if (!seen.has(id)) { root.remove(groups.get(id).g); releaseOwned(groups.get(id).g); dropFolk(groups.get(id)); groups.delete(id); } });
    if (folkChanged) {
      const paths = npcPaths(s.b);
      groups.forEach(e => e.folk.forEach(f => {
        f.route = f.c.role === 'work' || f.c.role === 'build'
          ? routineRoute(paths, e.b, f.c, KINDS[e.b.t].size, f.ph) : [];
      }));
    }
    // Walls retain their own design at mixed-level joins and remain selectable along each run.
    const walls = s.b.filter(b => b.t === 'wall' && !gone.has(b.i));
    wallView.setLot(walls);
    picks.length = 0;
    groups.forEach(e => e.g.traverse(m => { if (m.isMesh) picks.push(m); }));
    picks.push(...wallView.picks);
    if (sel.id != null) select(sel.id, sel.moving);
    if (village && autoFrame && layoutChanged && !placement) frameVillage();
    want();
  }
  /** All buildings under a tap, nearest first, with each wall instance mapped to its own id. */
  const pickAll = (cx, cy) => {
    if (!features.available()) return [];
    placeCam(); scene.updateMatrixWorld(true); ndcOf(cx, cy); ray.setFromCamera(ndc, cam);
    const extra = village && sel.id != null ? revealPicks : [];
    const ids = ray.intersectObjects([...picks, ...extra], false).map(hit =>
      hit.object.isInstancedMesh && hit.object.userData.walls
        ? hit.object.userData.walls[hit.instanceId]?.i : hit.object.userData.bid);
    return [...new Set(ids.filter(id => id != null))];
  };
  /** The revealed selection takes grab priority so an object behind the Castle can be moved. */
  const pick = (cx, cy) => {
    const ids = pickAll(cx, cy);
    return village && ids.includes(sel.id) ? sel.id : ids[0] ?? null;
  };

  // Peaceful routines use independent schedules and clear courtyard paths. In a raid the tower's archer, the cannon's
  // crew and the trebuchet's catapult act on the battle's real shots, nothing else.
  function dropFolk(e) { (e.folk || []).forEach(f => f.actor.dispose()); e.folk = []; }
  function folkFrame(now) {
    const sec = now / 1000;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    groups.forEach(e => e.folk.forEach(f => {
      const c = f.c, a = f.actor, civilian = c.role === 'work' || c.role === 'build';
      a.root.visible = false;
      if (!features.available() || placement || view.dist >= 145 || (raid && civilian)) return;
      const g = e.g.position, U = e.g.userData;
      const fired = raid ? raid.fired.get(e.b.i) : undefined, rt = raid ? raid.t : sec, bl = raid ? raid.byId.get(e.b.i) : null;
      if (bl && bl.dead) return;
      a.root.visible = true;
      a.root.position.set(g.x + c.u, g.y, g.z + c.v);
      if (c.role === 'archer') {
        a.root.position.set(g.x, g.y + (U?.platformY || (U?.height || 2) * .8), g.z);
        if (raid && bl) {
          const dt = fired == null ? 9 : rt - fired;
          a.root.rotation.y = Math.PI / 2 - bl.aim;
          a.pose(dt < 1.1 ? 'attack' : 'idle', rt, {event: dt < 1.1 ? fired - .265 : undefined, rate: 1});
        } else { a.root.rotation.y = Math.PI / 4 + (still ? 0 : Math.sin(sec * .2 + f.ph * 9) * .6); a.pose('idle', sec); }
        return;
      }
      if (c.role === 'engine') {
        a.root.position.set(g.x, g.y + .04, g.z);
        if (raid && bl) {
          const dt = fired == null ? 99 : rt - fired, dur = a.durationOf('attack');
          a.root.rotation.y = Math.PI / 2 - bl.aim;
          a.pose(dt < dur ? 'attack' : 'idle', rt, {event: dt < dur ? fired : undefined});
        } else { a.root.rotation.y = Math.PI / 4; a.pose('idle', still ? 0 : sec); }
        return;
      }
      if (c.role === 'crew') {
        // (loading the cannon after each shot, else at ease beside it)
        const dt = raid && fired != null ? rt - fired : 9;
        a.root.rotation.y = Math.atan2(-c.u, -c.v);
        a.pose(dt < 2.5 ? 'work' : 'idle', rt, {rate: 1.2});
        return;
      }
      const routine = homeRoutine(f.route || [], {role: c.role, building: e.b.t, phase: f.ph}, sec, still);
      if (!routine.point) { a.root.visible = false; return; }
      a.root.position.set(W(routine.point.x), 0, W(routine.point.y));
      const idleLook = still || routine.state !== 'idle' ? 0 : Math.sin(sec * .28 + f.ph * 17) * .16;
      a.root.rotation.y = routine.face ?? (Math.atan2(-c.u, -c.v) + idleLook);
      a.root.userData.duty = routine.state;
      a.pose(routine.state, sec, {rate: routine.rate});
    }));
  }
  // (a few frames a second while there are folk about and no raid's drawing every frame)
  let folkTick = 0;
  const folkTimer = setInterval(() => {
    if (raid || dead || lost || document.visibilityState !== 'visible' || !features.available()) return;
    const now = performance.now(), animatedWorker = [...groups.values()].some(e => e.folk.some(f => f.actor && f.actor.root.visible));
    if (now - folkTick < (animatedWorker ? 45 : 150)) return;
    folkTick = now;
    if ((homeNPCs && homeNPCs.animated) || (homeDragon && homeDragon.animated)) { want(); return; }
    for (const e of groups.values()) if (e.folk.length) { want(); break; }
  }, 50);

  // ---- the selected building: a ring of light round its footprint; moving it, a green or red square under it
  const sel = {id: null, mesh: null, foot: null, t0: 0, moving: null};
  const revealed = [], revealPicks = [];
  let revealedWall = null, revealDepthCleared = false;
  function clearReveal() {
    revealed.forEach(({object, material, order, beforeRender}) => {
      [object.material].flat().forEach(m => m.dispose());
      object.material = material; object.renderOrder = order; object.onBeforeRender = beforeRender;
    });
    revealed.length = revealPicks.length = 0;
    if (revealedWall) { scene.remove(revealedWall); revealedWall = null; }
  }
  function reveal(group, id) {
    if (!village || !features.available() || !group) return;
    group.traverse(object => {
      if ((!object.isSprite && !object.isMesh) || (object.geometry?.type === 'PlaneGeometry' && object.material?.isMeshBasicMaterial)) return;
      if (![object.material].flat().some(m => m.visible)) return;
      revealed.push({object, material: object.material, order: object.renderOrder, beforeRender: object.onBeforeRender});
      const clones = [object.material].flat().map(m => {
        const clone = m.clone(); clone.depthTest = true; clone.depthWrite = true; clone.transparent = true; return clone;
      });
      object.material = Array.isArray(object.material) ? clones : clones[0];
      object.renderOrder = 10001; object.userData.bid = id;
      const beforeRender = object.onBeforeRender;
      object.onBeforeRender = function (...args) {
        // Clear the foreground depth once, then keep self-occlusion within the revealed model.
        if (!revealDepthCleared) { renderer.state.buffers.depth.setMask(true); renderer.clearDepth(); revealDepthCleared = true; }
        beforeRender.apply(this, args);
      };
      // Sprites raycast their transparent rectangular corners; the building's existing box is its touch target.
      if (object.isMesh) revealPicks.push(object);
    });
  }
  {
    const shape = new T.Shape(), hole = new T.Path();
    shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, .5); shape.lineTo(-.5, .5); shape.lineTo(-.5, -.5);
    const i = .44; hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.lineTo(-i, -i);
    shape.holes.push(hole);
    sel.mesh = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshBasicMaterial({color: 0xFFFFFF, transparent: true, opacity: .9, depthWrite: false, toneMapped: false}));
    sel.mesh.rotation.x = -Math.PI / 2; sel.mesh.position.y = .03; sel.mesh.visible = false; sel.mesh.renderOrder = village ? 10000 : 2; sel.mesh.material.depthTest = !village;
    sel.foot = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({color: 0x3BD16F, transparent: true, opacity: .45, depthWrite: false, toneMapped: false}));
    sel.foot.rotation.x = -Math.PI / 2; sel.foot.position.y = .025; sel.foot.visible = false; sel.foot.renderOrder = village ? 9999 : 1; sel.foot.material.depthTest = !village;
    scene.add(sel.mesh, sel.foot);
  }
  /** Marks building id (or none); moving: {x, y, size, ok} lifts it there over a green (fits) or red square. */
  function select(id, moving = null) {
    clearReveal();
    sel.id = id; sel.moving = moving;
    const e = id != null ? groups.get(id) : null;
    const b = e?.b || (village && lotState?.b.find(b => b.i === id));
    groups.forEach(x => { x.g.position.y = 0; });
    if (!b && !moving) { sel.mesh.visible = sel.foot.visible = false; want(); return; }
    const size = moving ? moving.size : KINDS[b.t].size, x = moving ? moving.x : b.x, y = moving ? moving.y : b.y;
    sel.mesh.visible = true;
    sel.mesh.scale.set(size + .3, size + .3, 1);
    sel.mesh.position.set(W(x + size / 2), .03, W(y + size / 2));
    sel.foot.visible = !!moving;
    if (e) reveal(e.g, id);
    else if (b?.t === 'wall' && village) {
      revealedWall = wallPreview(T, b.l);
      if (revealedWall) {
        revealedWall.position.set(W(x + size / 2), moving ? .25 : 0, W(y + size / 2));
        scene.add(revealedWall); reveal(revealedWall, id);
      }
    }
    if (moving) {
      sel.foot.scale.set(size, size, 1); sel.foot.position.set(W(x + size / 2), .025, W(y + size / 2));
      sel.foot.material.color.set(moving.ok ? 0x3BD16F : 0xE5484D);
      if (e) { e.g.position.set(W(x + size / 2), .25, W(y + size / 2)); }
    }
    want();
  }
  // a building not on the lot yet (the shop's pick), shown where it would go; a run of walls (g.run, the tiles in a
  // line) joined as they'd stand, a green or red square under each
  let ghost = null;
  const runFoot = new T.PlaneGeometry(.92, .92).rotateX(-Math.PI / 2);
  const runMat = ok => new T.MeshBasicMaterial({color: ok ? 0x3BD16F : 0xE5484D, transparent: true, opacity: .45, depthWrite: false, toneMapped: false});
  const runMats = {true: runMat(true), false: runMat(false)};
  function setGhost(g) {
    if (ghost) { root.remove(ghost.g); releaseOwned(ghost.g); ghost.g.children.forEach(m => m.isInstancedMesh && m.dispose()); ghost = null; }
    if (!g) { select(null); return; }
    const size = KINDS[g.t].size;
    if (g.run) {
      // a run of new walls, in the level-1 design the lot draws them in (realm-walls.js), rails joining each to the next
      const run = g.run, parts = WALLS.partsOf(1), n = run.length, horiz = run[1].y === run[0].y, grp = new T.Group();
      const posts = parts.post.map(([geometry, material]) => new T.InstancedMesh(geometry, material, n));
      const rails = parts.rail.map(([geometry, material]) => new T.InstancedMesh(geometry, material, Math.max(1, n - 1)));
      rails.forEach(r => { r.count = n - 1; });
      const foot = new T.InstancedMesh(runFoot, runMats[!!g.ok], n);
      const m = new T.Matrix4(), one = new T.Vector3(1, 1, 1);
      const turn = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), horiz ? 0 : -Math.PI / 2), none = new T.Quaternion();
      // from the run's lower tile: rails join each tile to the next along +x or +y
      const tiles = run.slice().sort((a, b) => a.x - b.x || a.y - b.y);
      tiles.forEach((q, i) => {
        posts.forEach(p => p.setMatrixAt(i, m.compose(new T.Vector3(W(q.x + .5), .25, W(q.y + .5)), none, one)));
        foot.setMatrixAt(i, m.compose(new T.Vector3(W(q.x + .5), .025, W(q.y + .5)), none, one));
        if (i < n - 1) rails.forEach(r => r.setMatrixAt(i, m.compose(new T.Vector3(W(q.x + .5), .25, W(q.y + .5)), turn, one)));
      });
      foot.renderOrder = 1;
      grp.add(...posts, ...rails, foot);
      root.add(grp);
      ghost = {g: grp};
      select(null);
      return;
    }
    const grp = g.t === 'wall' ? wallPreview(T, 1) : BUILD.create(g.t, 1, size) || FM.model(g.t, 1, house);
    if (!grp) return;
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
      opts.onTap({id: pick(p.x, p.y), ids: village ? pickAll(p.x, p.y) : undefined, tile: tileAt(p.x, p.y), x: p.x, y: p.y});
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
  /** How many of each kind battle B can put on the field, for what draws them: every dragon (the troop, the Dragon Hero,
   *  a defending one) counted as 'dragon' (one picture while its model isn't in). */
  function armyNeed(B) {
    const need = {};
    Object.keys(TROOPS).forEach(k => { need[k] = (B.left[k] || 0) + (B.used[k] || 0); });
    const dragons = [...new Set([...Object.keys(B.left || {}), ...Object.keys(B.used || {})])].filter(isDragonKind).reduce((n, k) => n + (B.left[k] || 0) + (B.used[k] || 0), 0)
      + (B.defenders || []).filter(u => isDragonKind(u.t)).length;
    if (dragons) need.dragon = dragons + 2; // (and room for one sent in a test)
    return need;
  }
  /** Draws battle B (core/realm-battle.js) on this lot: call before the raid's first frame; then raidFrame(t)
   *  each frame with the raid's clock (interpolated between its steps). raider: the raiders' house. */
  function raidStart(B, raider) {
    raidStop();
    if (dead || !features.available()) return;
    const need = armyNeed(B), kinds = Object.keys(need), meshes = {}, m4 = new T.Matrix4();
    let shadows = 0;
    kinds.forEach(k => {
      const n = Math.max(1, need[k]);
      shadows += n;
      // (each soldier his own animated model; the plain 3D figures, instanced, while a kind's model is missing, and for
      // a dragon whose model isn't in)
      const model = TROOP_MODEL[k];
      if (model && CH.ready(model[0])) {
        meshes[k] = {characters: new Map(), capacity: n, model};
        return;
      }
      const parts = FM.troopParts(k, raider);
      const body = new T.InstancedMesh(parts.body, FM.mats().paint, n), leg = new T.InstancedMesh(parts.leg, FM.mats().paint, n * 2);
      body.castShadow = leg.castShadow = true; body.count = leg.count = 0;
      body.frustumCulled = leg.frustumCulled = false;
      scene.add(body, leg);
      meshes[k] = {body, leg};
      // (a grounded dragon's plain figure stands on the ground: its body's lowest point at y 0)
      if (k === 'dragon') { parts.body.computeBoundingBox(); meshes[k].groundY = -parts.body.boundingBox.min.y * 1.5 + .02; }
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
      // (a dragon's fire: a burst of flame facing the camera, FLAME of them along its way, the leading the biggest,
      // glowing as they add up)
      fire: mk(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map: flameTexture(T), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false}), 24 * FLAME),
      ball: mk(new T.SphereGeometry(.11, 10, 8), new T.MeshStandardMaterial({color: 0x26272A, roughness: .45, metalness: .7}), 40),
      magic: mk(new T.OctahedronGeometry(.2), new T.MeshBasicMaterial({color: 0x8FE6FF, toneMapped: false}), 12)
    };
    fly.fire.instanceColor = new T.InstancedBufferAttribute(new Float32Array(24 * FLAME * 3), 3);
    fly.fire.renderOrder = 4;
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
      fired: new Map(), byId: new Map(B.bl.map(b => [b.i, b])), t: 0, shotSeen: new WeakSet(),
      heroes: createBattleHeroes(T, scene, {house: raider, onChange: () => want()}), heroCur: new Map(), heroPrev: new Map(), raider,
      dragons: createBattleDragons(T, scene, {onLand: (x, y) => { if (raid) puff(x, y, 2.6, 0xB5AC9E, 1.1, raid.now); }}), now: 0, f: 0, fireAt: new WeakMap(), byModel: new WeakMap(), need, spread: new Map(), spreadAt: undefined, slots: new Map()};
    const started = raid;
    started.dragons.warm(renderer, cam, 0);
    started.dragons.preload(B).then(ok => { if (ok && raid === started && !dead) { started.dragons.warm(renderer, cam, 0); want(); } });
    // (its dragons drawn from the model: fetched now if they're not in yet, a plain one meanwhile; the renderer readied
    // for it and a few made now, so the first sent doesn't hold the screen still)
    const legacyDragon = [...Object.keys(B.left || {}), ...Object.keys(B.used || {}), ...(B.defenders || []).map(u => u.t)]
      .some(kind => kind === 'dragon' || kind === 'hero_dragon');
    if (legacyDragon) { const R = raid; loadDragon().then(ok => { if (ok && raid === R) R.dragons.warm(renderer, cam, Math.min(4, need.dragon || 1)); }); }
    drawZone();
    want();
  }
  // where unit u is drawn this frame (between its last two steps, eased by raid.f): {x, y (tiles), moving}, or null
  const spot = {x: 0, y: 0, moving: false}, mouthV = new T.Vector3();
  function stepSpot(u) {
    const R = raid;
    if (!R) return null;
    const def = !!u.targetHero, key = def ? 'd:' + u.id : u.id, c = (def ? R.heroCur : R.cur).get(key), p = (def ? R.heroPrev : R.prev).get(key) || c;
    if (!c) return null;
    spot.x = p.x + (c.x - p.x) * R.f; spot.y = p.y + (c.y - p.y) * R.f; spot.moving = Math.hypot(c.x - p.x, c.y - p.y) > .001;
    return spot;
  }
  function locate(u) {
    const at = stepSpot(u), off = at && raid.spread.get(u);
    if (off) { at.x += off.x; at.y += off.y; }
    return at;
  }
  // Soldiers the battle stacks on one spot (a drop, a crowd at a wall) are drawn apart (the owner, Oct 25 2026: "Ensure
  // they remain spread out and don't pile up on top of each other"): each takes a place in a formation round the spot he
  // landed on (a sunflower spiral, by the order they landed: the same in every replay) and keeps it as he marches, then
  // soldiers still too close are pushed off each other; never into a building or a wall, eased frame to frame. Only the
  // picture: the battle, its shots and every replay keep their own positions.
  const ROOM = {footman: .29, archer: .29, thief: .27, knight: .38}, GOLDEN = Math.PI * (3 - Math.sqrt(5));
  function spreadOut(R, t) {
    const live = [], cells = new Map(), key = (x, y) => x * 4096 + y;
    for (const u of R.B.tr) {
      if (u.dead || u.hero || !ROOM[u.t]) continue;
      const at = stepSpot(u);
      if (!at) continue;
      live.push({u, x: at.x, y: at.y, r: ROOM[u.t], ox: 0, oy: 0});
    }
    live.sort((p, q) => p.u.id - q.u.id);
    for (const p of live) {
      let slot = R.slots.get(p.u);
      if (!slot) {
        // (his place: the next free one round where he landed, counting those already placed there)
        const here = live.filter(q => q !== p && R.slots.has(q.u) && Math.hypot(q.x - p.x, q.y - p.y) < .3);
        const i = here.length, r = .33 * Math.sqrt(i), ang = i * GOLDEN;
        slot = {x: Math.cos(ang) * r, y: Math.sin(ang) * r};
        R.slots.set(p.u, slot);
      }
      p.ox = slot.x; p.oy = slot.y;
    }
    // (never drawn standing in a building or a wall that's still up: a place in one is moved out to its nearest free edge,
    // each round, so the spacing is kept round it)
    const solid = new Uint8Array(N * N);
    for (const b of R.B.bl) {
      if (b.dead) continue;
      const sz = KINDS[b.t]?.size || 1;
      for (let y = Math.max(0, b.y); y < Math.min(N, b.y + sz); y++) for (let x = Math.max(0, b.x); x < Math.min(N, b.x + sz); x++) solid[y * N + x] = 1;
    }
    const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N && solid[Math.floor(y) * N + Math.floor(x)] === 1;
    const eject = p => {
      if (inside(p.x, p.y)) return;
      for (let n = 0; n < 4 && inside(p.x + p.ox, p.y + p.oy); n++) {
        const x = p.x + p.ox, y = p.y + p.oy, fx = Math.floor(x), fy = Math.floor(y);
        const ways = [[fx - .03 - x, 0], [fx + 1.03 - x, 0], [0, fy - .03 - y], [0, fy + 1.03 - y]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        const way = ways.find(([dx, dy]) => !inside(x + dx, y + dy)) || ways[0];
        p.ox += way[0]; p.oy += way[1];
      }
    };
    // (who's near whom, by where each is drawn, each round: two from far apart in the battle may be drawn side by side)
    const regrid = () => { cells.clear(); for (const p of live) { const k = key(Math.floor(p.x + p.ox), Math.floor(p.y + p.oy)); (cells.get(k) || cells.set(k, []).get(k)).push(p); } };
    const near = p => { const out = [], cx = Math.floor(p.x + p.ox), cy = Math.floor(p.y + p.oy); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of cells.get(key(cx + i, cy + j)) || []) out.push(q); return out; };
    for (let round = 0; round < 16; round++) {
      regrid();
      for (const p of live) for (const q of near(p)) {
        if (q.u.id <= p.u.id) continue;
        let dx = q.x + q.ox - p.x - p.ox, dy = q.y + q.oy - p.y - p.oy, d = Math.hypot(dx, dy);
        const min = p.r + q.r;
        if (d >= min) continue;
        // (two on the very same spot part along a way of their own: the same every frame and every replay)
        if (d < 1e-4) { const a = (p.u.id * 2.39996 + q.u.id * .7) % (Math.PI * 2); d = 1e-4; dx = Math.cos(a) * d; dy = Math.sin(a) * d; }
        // (one with a building or a wall at his back stays; the other takes the whole push)
        const push = (min - d) / 2 / d, pFree = !inside(p.x + p.ox - dx * push, p.y + p.oy - dy * push) || inside(p.x, p.y);
        const qFree = !inside(q.x + q.ox + dx * push, q.y + q.oy + dy * push) || inside(q.x, q.y);
        const pk = pFree ? (qFree ? 1 : 2) : 0, qk = qFree ? (pFree ? 1 : 2) : 0;
        p.ox -= dx * push * pk; p.oy -= dy * push * pk; q.ox += dx * push * qk; q.oy += dy * push * qk;
      }
      for (const p of live) { const len = Math.hypot(p.ox, p.oy); if (len > 2.6) { p.ox *= 2.6 / len; p.oy *= 2.6 / len; } eject(p); }
    }
    const dt = t - (R.spreadAt ?? -1), ease = dt > 0 && dt < .5 ? 1 - Math.exp(-dt * 20) : 1;
    R.spreadAt = t;
    const next = new Map();
    for (const p of live) {
      // (still in a building after all that, with no way out: drawn where the battle has him)
      const blocked = !inside(p.x, p.y) && inside(p.x + p.ox, p.y + p.oy), ox = blocked ? 0 : p.ox, oy = blocked ? 0 : p.oy;
      const was = R.spread.get(p.u) || {x: 0, y: 0};
      next.set(p.u, {x: was.x + (ox - was.x) * ease, y: was.y + (oy - was.y) * ease});
    }
    R.spread = next;
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
  /** The raid drawn from its start again with battle B (a replay's restart, or its bar's jump: views/realm-replay.js),
   *  the same army by the same house as the one drawn: what draws it is kept, emptied, and B put in its place (building it
   *  all again, and compiling its shaders, held the screen still for a second each time). Otherwise, raidStart. */
  function raidRestart(B, raider) {
    if (dead || !features.available()) { raidStop(); return; }
    const need = armyNeed(B), fits = raid && raid.raider === raider && Object.keys(need).every(k => {
      const M = raid.meshes[k], n = need[k];
      return !n || (!!M && n <= (M.characters ? M.capacity : M.body.instanceMatrix.count));
    });
    if (!fits) { raidStart(B, raider); return; }
    raid.dragons.reset(); raid.need = need;
    groups.forEach(e => { BUILD.animateDefense(e.g, Infinity); });
    Object.values(raid.meshes).forEach(M => {
      if (M.characters) { M.characters.forEach(a => a.model.dispose()); M.characters.clear(); }
      else M.body.count = M.leg.count = 0;
    });
    raid.shadow.count = 0;
    Object.values(raid.fly).forEach(M => { M.count = 0; });
    raid.puffs.forEach(p => { p.sp.visible = false; p.t0 = -9; });
    Object.assign(raid, {B, fxAt: 0, prev: new Map(), cur: new Map(), stepSeen: -1, zoneSig: '', zoneShow: 0, aim: new Map(), fired: new Map(),
      byId: new Map(B.bl.map(b => [b.i, b])), t: 0, shotSeen: new WeakSet(), heroCur: new Map(), heroPrev: new Map(), fireAt: new WeakMap(), byModel: new WeakMap(), spread: new Map(), spreadAt: undefined, slots: new Map()});
    raid.dragons.preload(B);
    drawZone();
    want();
  }
  const showZone = (on) => { if (raid) { raid.zoneShow = on ? performance.now() : -1; want(); } };
  /** One frame of the raid at its clock t (seconds; between steps it eases from where each was to where he is). */
  function raidFrame(t, now = performance.now()) {
    if (!raid) return;
    if (dead || !features.available()) { raidStop(); return; }
    const B = raid.B, R = raid;
    R.t = t;
    // the steps' positions: keep the last two
    if (B.step !== R.stepSeen) {
      R.prev = R.cur; R.cur = new Map();
      B.tr.forEach(u => R.cur.set(u.id, {x: u.x, y: u.y}));
      R.heroPrev = R.heroCur; R.heroCur = new Map();
      [...B.tr, ...(B.defenders || [])].forEach(u => { if (u.hero || (u.targetHero && isDragonKind(u.t))) R.heroCur.set(`${u.targetHero ? 'd' : 'a'}:${u.id}`, {x: u.x, y: u.y}); });
      R.stepSeen = B.step;
    }
    const f = Math.max(0, Math.min(1, (t - (B.t - .1)) / .1));
    R.heroes.update([...B.tr, ...(B.defenders || [])], t, R.heroCur, R.heroPrev, f);
    // the dragons, from the model once it's in (realm-dragon.js: those it draws are left out below)
    R.f = f; R.now = now;
    spreadOut(R, t);
    R.dragons.update(B, t, locate, now);
    const drawn = R.dragons.drawn;
    // (whether a shot leaves from a model (an archer's bow, a dragon's mouth): settled once, as it's loosed)
    const byModel = s => {
      let m = R.byModel.get(s);
      if (m === undefined) {
        m = (s.k === 'archer' && !!R.meshes.archer?.characters) || (isDragonKind(s.k) && R.dragons.modelled((s.foe ? 'd:' : 'a:') + s.from));
        R.byModel.set(s, m);
      }
      return m;
    };
    // the soldiers
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1.5, 1.5, 1.5), up = new T.Vector3(0, 1, 0), pv = new T.Vector3();
    const counts = {}, camQ = cam.quaternion, ssc = new T.Vector3();
    let nShadow = 0;
    Object.keys(R.meshes).forEach(k => { counts[k] = 0; });
    // (a dragon its plain 3D figure, kind 'dragon', till its model draws it; one defending too)
    const soldier = u => {
      if (drawn.has(u)) return;
      const kind = isDragonKind(u.t) ? 'dragon' : u.t, M = R.meshes[kind], at = M && locate(u);
      if (M && M.characters && at) {
        let a = M.characters.get(u.id);
        if (!a && !u.dead && M.characters.size < M.capacity) {
          const model = CH.create(M.model[0], {height: M.model[1], phase: (u.id * .618) % 1});
          if (!model) return;
          a = {model, hp: u.hp, hurt: -9, death: null}; M.characters.set(u.id, a); scene.add(model.root);
        }
        if (!a) return;
        if (u.dead) {
          if (a.death == null) a.death = t;
          a.model.pose('death', t, {event: a.death});
          if (t - a.death > Math.max(1.5, a.model.duration)) { a.model.dispose(); M.characters.delete(u.id); }
          return;
        }
        if (u.hp < a.hp) a.hurt = t;
        a.hp = u.hp;
        const attackAge = t - u.hitAt;
        // The simulation is up to one step ahead of this interpolated frame.
        const attacking = !at.moving && attackAge >= -.101 && attackAge < 1;
        const state = attacking ? 'attack' : t - a.hurt < .25 ? 'hit' : at.moving ? 'run' : 'idle';
        // Source clips release the bow at frame 10–11/40 and strike with the
        // sword at frame 11–12/40. Align those poses to hitAt; recovery wraps
        // into the next windup before the next one-second simulation hit.
        const release = u.t === 'archer' ? .265 : .29;
        const attackStart = u.hitAt - release + Math.floor(Math.max(0, attackAge + release));
        a.model.root.position.set(W(at.x), 0, W(at.y)); a.model.root.rotation.y = Math.PI / 2 - u.face;
        a.model.pose(state, t, {event: state === 'attack' ? attackStart : state === 'hit' ? a.hurt : undefined,
          rate: state === 'attack' ? a.model.durationOf('attack') : 1});
        if (nShadow < R.shadow.instanceMatrix.count) {
          m4.compose(pv.set(W(at.x), 0, W(at.y)), q.identity(), ssc.set(.65, 1, .42));
          R.shadow.setMatrixAt(nShadow++, m4);
        }
        return;
      }
      if (u.dead) return;
      if (!at || counts[kind] >= M.body.instanceMatrix.count || nShadow >= R.shadow.instanceMatrix.count) return;
      const x = at.x, y = at.y, moving = at.moving, uid = Number(u.id) || 0, swing = moving ? Math.sin(t * 14 + uid) * .6 : 0;
      const attackAge = t - u.hitAt;
      const hit = attackAge >= 0 && attackAge < .35 ? Math.sin(attackAge / .35 * Math.PI) : 0;
      const face = -u.face + Math.PI / 2;
      q.setFromAxisAngle(up, face);
      const i = counts[kind]++;
      if (kind === 'dragon') {
        // in the air, bobbing, its wings beating
        const groundedDragon = !dragonCanFly(u.t);
        const flap = groundedDragon ? 0 : Math.sin(t * 7 + uid) * .55, hy = groundedDragon ? M.groundY ?? .5 : 2.3 + Math.sin(t * 2.2 + uid) * .12;
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
      const bob = moving ? Math.abs(Math.sin(t * 14 + uid)) * .04 : 0;
      pv.set(W(x), .33 + bob, W(y));
      m4.compose(pv, qq, sc); M.body.setMatrixAt(i, m4);
      [-1, 1].forEach((sd, j) => {
        const lq = q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), sd * swing));
        const off = new T.Vector3(sd * .09 * (kind === 'knight' ? 1.35 : 1), 0, 0).applyQuaternion(q);
        m4.compose(new T.Vector3(pv.x + off.x, .33 + bob, pv.z + off.z), lq, sc); M.leg.setMatrixAt(i * 2 + j, m4);
      });
    };
    B.tr.forEach(soldier);
    (B.defenders || []).forEach(u => { if (isDragonKind(u.t)) soldier(u); });
    Object.entries(R.meshes).forEach(([k, M]) => {
      if (M.characters) return;
      M.body.count = counts[k]; M.leg.count = counts[k] * 2; M.body.instanceMatrix.needsUpdate = true; M.leg.instanceMatrix.needsUpdate = true;
    });
    R.shadow.count = nShadow; R.shadow.instanceMatrix.needsUpdate = true;
    // what's in the air: each along its arc, pointing the way it's going
    const KIND = {archer: 'arrow', tower: 'arrow', ballista: 'bolt', trebuchet: 'rock', dragon: 'fire', cannon: 'ball', hero_wizard: 'magic'};
    const ARC = {trebuchet: 4, archer: 1.1, tower: 1, ballista: .35, dragon: .15, cannon: .3};
    const n = {arrow: 0, bolt: 0, rock: 0, fire: 0, ball: 0, magic: 0}, dir = new T.Vector3(), fwd = new T.Vector3(0, 0, 1), one = new T.Vector3(1, 1, 1);
    const a0 = new T.Vector3(), a1 = new T.Vector3(), flameC = new T.Color();
    B.shots.forEach(s => {
      if (s.foe && !R.shotSeen.has(s)) { R.shotSeen.add(s); R.fired.set(s.from, Math.max(R.fired.get(s.from) ?? -9, s.t0)); if (s.k === 'cannon') puff(s.x0 + Math.cos(Math.atan2(s.y1 - s.y0, s.x1 - s.x0)) * 1.1, s.y0 + Math.sin(Math.atan2(s.y1 - s.y0, s.x1 - s.x0)) * 1.1, .7, 0xD8D2C8, .5, now); }
      // (a dragon's fire (the troop's or the Dragon Hero's): from the model's mouth when the dragon that loosed it is drawn
      // from the model (byModel); else main's attack art draws it from the picture's mouth once that's in; else the flame
      // below from where the picture flies)
      const dragon = isDragonKind(s.k);
      const kind = dragon ? 'fire' : KIND[s.k];
      if (!kind) return;
      const M = R.fly[kind];
      if (n[kind] >= M.instanceMatrix.count) return;
      const u = Math.max(0, Math.min(1, (t - s.t0) / Math.max(.01, s.t1 - s.t0))), arc = dragon ? ARC.dragon : ARC[s.k] || .5;
      const defenseArt = s.foe ? groups.get(s.from)?.g.userData : null;
      const y0 = defenseArt?.importedBuilding === 'ballista' ? defenseArt.height * .91 : dragon ? (dragonCanFly(s.k) ? 2.2 : .8) : s.foe ? (s.k === 'tower' ? 2.6 : s.k === 'cannon' ? .68 : 1.1) : (s.k === 'archer' && byModel(s) ? .72 : .55), y1 = s.high ? 2.3 : .35;
      // (a tower's arrow leaves from its archer's bow; a dragon's fire from its mouth, where it was as it struck, when
      // it's drawn from the model)
      const archer = s.foe && s.k === 'tower' ? archerAt(s.from) : null;
      let mouth = dragon ? R.fireAt.get(s) : null;
      if (dragon && !mouth && drawn.size && (mouth = R.dragons.mouth((s.foe ? 'd:' : 'a:') + s.from, mouthV)) && t >= s.t0) R.fireAt.set(s, mouth = mouth.clone());
      if (archer) a0.copy(archer); else if (mouth) a0.copy(mouth); else a0.set(W(s.x0), y0, W(s.y0));
      a1.set(W(s.x1), y1, W(s.y1));
      if (kind === 'fire') {
        // the flame and its trail, each a little behind the one before (back at the mouth as it leaves: a glow there),
        // smaller and dimmer down the line, swelling as it goes
        for (let j = 0; j < FLAME && n.fire < M.instanceMatrix.count; j++) {
          const uj = Math.max(0, u - j * .075), size = (.95 + .95 * uj) * (1 - j * .16);
          pv.lerpVectors(a0, a1, uj); pv.y += arc * 4 * uj * (1 - uj);
          m4.compose(pv, camQ, ssc.set(size, size, size));
          M.setMatrixAt(n.fire, m4);
          M.setColorAt(n.fire++, flameC.setScalar(1 - j * .2));
        }
        return;
      }
      dir.subVectors(a1, a0); dir.y += arc * 4 * (1 - 2 * u); dir.normalize();
      q.setFromUnitVectors(fwd, dir);
      pv.lerpVectors(a0, a1, u); pv.y += arc * 4 * u * (1 - u);
      m4.compose(pv, q, one);
      M.setMatrixAt(n[kind]++, m4);
    });
    Object.entries(R.fly).forEach(([k, M]) => { M.count = n[k]; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true; });
    // Painted weapons recoil on actual shots; procedural fallbacks retain aiming and tipping.
    B.bl.forEach(b => {
      if (!b.def) return;
      const e = groups.get(b.i);
      if (e && BUILD.animateDefense(e.g, R.t - (R.fired.get(b.i) ?? -9), b.aim)) return;
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
      else if (e.k === 'hit' && isDragonKind(e.of)) puff(e.x, e.y, 1.8, 0xFF7A1E, .5, now);
      else if (e.k === 'down' && !R.dragons.falling(e.id)) puff(e.x, e.y, .9, 0xDDDDDD, .6, now);
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
  /** Where a tower's archer looses from (world: his bow, a little over where he stands), or null without him. */
  function archerAt(id) {
    const e = groups.get(id), f = e && e.folk.find(x => x.c.role === 'archer' && x.actor.root.visible);
    return f ? f.actor.root.position.clone().add(new T.Vector3(0, .78, 0)) : null;
  }
  function puff(x, y, size, color, life, now) {
    const p = raid.puffs.find(q => !q.sp.visible) || raid.puffs[0];
    p.sp.visible = true; p.sp.material.color.set(color); p.t0 = now; p.life = life; p.size = size;
    p.sp.position.set(W(x), .4, W(y));
  }
  function raidStop() {
    if (!raid) return;
    groups.forEach(e => { BUILD.animateDefense(e.g, Infinity); });
    raid.heroes.dispose();
    raid.dragons.dispose();
    Object.values(raid.meshes).forEach(M => {
      if (M.characters) { M.characters.forEach(a => a.model.dispose()); M.characters.clear(); return; }
      scene.remove(M.body, M.leg); M.body.dispose(); M.leg.dispose();
    });
    scene.remove(raid.shadow); raid.shadow.geometry.dispose(); raid.shadow.material.map.dispose(); raid.shadow.material.dispose(); raid.shadow.dispose();
    Object.values(raid.fly).forEach(M => { scene.remove(M); M.geometry.dispose(); M.material.dispose(); M.dispose(); });
    scene.remove(raid.zone); raid.zone.geometry.dispose(); raid.zone.material.dispose(); raid.zoneTex.dispose();
    raid.zoneCv.width = raid.zoneCv.height = 0;
    raid.puffs.forEach(p => { scene.remove(p.sp); p.sp.material.dispose(); });
    if (raid.puffs[0]) raid.puffs[0].sp.material.map.dispose();
    raid = null;
  }

  // ---- the frame hook (a raid's clock, the job timers' redraws)
  const setAnim = fn => { anim = fn; want(); };
  const look = (x, y, dist) => { autoFrame = false; view.tx = W(x); view.tz = W(y); if (dist) view.dist = dist; clampView(); want(); };
  /** Frame the village between the HUD and action bar. Manual camera gestures keep their view until recentered. */
  function frameVillage({margin = 1.15, maxDistance = Infinity} = {}) {
    if (!village || !lotState || !lotState.b.length || !features.available()) return;
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
        points.push(project(b.x + sz / 2, b.y + sz / 2, (art?.height ? art.height + (b.t === 'tower' ? 1.2 : 0) : (b.t === 'wall' ? 1.8 : 3.5))));
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
  /** Looks out over the whole land round the village (the 44 × 44 lot keeps its own dimensions). */
  function frameWorld() {
    if (!village || !features.available()) return;
    autoFrame = false; resize();
    view.tx = view.tz = -6; view.dist = ZMAX;
    clampView(); placeCam(); want();
  }
  resize(); placeCam(); want();
  // localStorage.clear in another tab has no individual gg-me event. Drop the
  // atlas meshes as well as their textures when that whole profile store goes.
  const clearedStorage = event => { if (event.key === null) { raidStop(); want(); } };
  window.addEventListener('storage', clearedStorage);
  // (frames stop while the app is in the background; a raid, scout or replay has nothing else to wake them on return)
  document.addEventListener('visibilitychange', want);
  return canvas.__keep3d = {
    setLot, select, setGhost, showGrid, showReach, pick, pickAll, tileAt, project, want, setAnim, look, frame: fit, frameVillage, frameWorld, zoomBy, resize,
    raidStart, raidRestart, raidFrame, raidStop, showZone,
    get zoom() { return view.dist; },
    /** Where the camera is (for setCamera on a view built again later). */
    get camera() { return {tx: view.tx, tz: view.tz, dist: view.dist, auto: autoFrame}; },
    setCamera(c) { view.tx = c.tx; view.tz = c.tz; view.dist = c.dist; autoFrame = !!c.auto; clampView(); placeCam(); want(); },
    get overlayScale() { return village ? Math.max(.5, Math.min(1, 70 / view.dist)) : 1; },
    get overview() { return village && view.dist > 145; },
    /** Lays scenery theme k round the lot. */
    setTheme(k) { theme = k || 'coast'; if (world.setTheme(theme)) { lightFor(); wildlifeFor(); } want(); },
    /** The land (realm-world.js), for the checks' hands. */
    get world() { return world; },
    get theme() { return theme; },
    canvas,
    /** The dragons drawn here (for the checks' and tests' hands): {home, battle} (realm-dragon.js), and the scene. */
    get dragons() { return {home: homeDragon, battle: raid && raid.dragons, scene, camera: cam, renderer}; },
    dispose() {
      dead = true;
      clearTimeout(lostTimer);
      window.removeEventListener('storage', clearedStorage);
      document.removeEventListener('visibilitychange', want);
      clearReveal();
      clearTimeout(flyTimer);
      clearInterval(folkTimer);
      if (homeNPCs) homeNPCs.dispose();
      if (homeDragon) homeDragon.dispose();
      offDragon();
      groups.forEach(e => { dropFolk(e); releaseOwned(e.g); });
      wallView.dispose();
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      // Big canvases go back to zero size: iOS caps total canvas memory, and three.js's listeners on the shared
      // sprite textures keep this renderer (and through it this canvas) reachable after the screen has gone.
      const freeTex = t => { if (!t) return; const im = t.image; t.dispose(); if (im && im.getContext) im.width = im.height = 0; };
      if (wear) { wear.mesh.geometry.dispose(); wear.mesh.material.dispose(); freeTex(wear.tex); wear = null; }
      if (wildlife) { wildlife.dispose(); wildlife = null; }
      world.dispose();
      base.kerbs.forEach(k => { k.geometry.dispose(); }); base.kerbM.dispose(); base.shade.geometry.dispose(); base.shade.material.dispose();
      if (scene.background && scene.background.isTexture) scene.background = null;
      if (scene.environment) scene.environment.dispose();
      setGhost(null); runFoot.dispose(); runMats.true.dispose(); runMats.false.dispose();
      raidStop();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (_) {}
      canvas.remove();
      delete canvas.__keep3d;
    }
  };
}
