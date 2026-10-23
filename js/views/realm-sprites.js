import * as features from '../core/features.js';
// Owner-only Keep upgrade art: a unique picture per playable building level.
// Fixed gameplay footprints; visible buildings grow within those footprints. Legacy art is a per-family fallback.
import * as data from '../core/data.js';
import {BUILD as UPGRADE_BUILD, PLATFORM as UPGRADE_PLATFORM} from './realm-upgrade-art.js';
export const BUILD = UPGRADE_BUILD;
export const KINDS = Object.keys(BUILD);
let T = null, SIN_P = .78, IMGS = {}, SOURCES = {}, LOADING = null, EPOCH = 0;
const TEX = {}, MATS = new Map(), URLS = new Map(), PENDING = new Set();
const BASE = new URL('../../img/realm/', import.meta.url).href;
const ISO = .27;
export const FOLK_H = .95;
let SHADOW = null;
export function init(three, pitch) { T = three; SIN_P = Math.sin(pitch); }
/** Cancel pending loads and clear owner art on profile eligibility transitions. */
export function clear() {
  EPOCH++;
  [...PENDING].forEach(cancel => cancel()); PENDING.clear();
  MATS.forEach(m => { m.map.dispose(); m.map.image.width = m.map.image.height = 0; m.dispose(); }); MATS.clear();
  Object.keys(TEX).forEach(k => { TEX[k].dispose(); delete TEX[k]; });
  URLS.clear(); IMGS = {}; SOURCES = {}; LOADING = null;
  if (SHADOW) { SHADOW.dispose(); SHADOW = null; }
}
let ownerActive = features.available();
data.subscribe(type => { if (type !== 'me') return; const next = features.available(); if (next !== ownerActive) { ownerActive = next; clear(); } });
function imageAt(file, epoch) {
  return new Promise(resolve => {
    if (!features.available() || epoch !== EPOCH) { resolve(null); return; }
    const im = new Image(); let finished = false;
    const done = image => {
      if (finished) return;
      finished = true; PENDING.delete(cancel); im.onload = im.onerror = null;
      resolve(features.available() && epoch === EPOCH ? image : null);
    };
    const cancel = () => { done(null); im.removeAttribute('src'); };
    PENDING.add(cancel);
    im.decoding = 'async'; im.onload = () => done(im); im.onerror = () => done(null);
    im.src = BASE + file;
  });
}
export function load() {
  if (!features.available()) return Promise.resolve(false);
  if (LOADING) return LOADING;
  const epoch = EPOCH, active = () => features.available() && epoch === EPOCH;
  LOADING = Promise.all([
    ...KINDS.map(async kind => {
      let im = await imageAt(`upgrades-v1/${kind}.webp`, epoch), source = 'upgrade';
      if (!im && active() && LEGACY_BUILD[kind]) { im = await imageAt(kind + '.webp', epoch); source = 'legacy'; }
      if (im && active()) { IMGS[kind] = im; SOURCES[kind] = source; }
    }),
    imageAt('folk.webp', epoch).then(im => { if (im && active()) IMGS.folk = im; })
  ]).then(() => active() && Object.keys(IMGS).length > 0);
  return LOADING;
}
export const ready = () => features.available() && !!T && Object.keys(IMGS).length > 0;
export const has = kind => ready() && !!IMGS[kind] && !!BUILD[kind];
export const folkReady = () => ready() && !!IMGS.folk;
export const sourceOf = kind => has(kind) ? SOURCES[kind] : null;
function texOf(n) {
  if (!TEX[n]) {
    const t = new T.Texture(IMGS[n]);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; TEX[n] = t;
  }
  return TEX[n];
}
function frameTex(n, x, y, w, h, W, H, flip = false) {
  const t = texOf(n).clone(); setFrame(t, x, y, w, h, W, H, flip); return t;
}
// A building's level is its own small texture, cut from its sheet with the sheet's 2 px clear border: the GPU holds
// only the pictures on the lot (about 1 MB each), not every level of every building (some 140 MB a 3D view).
function cutTex(n, x, y, w, h) {
  const P = 2, cv = document.createElement('canvas');
  cv.width = w + P * 2; cv.height = h + P * 2;
  cv.getContext('2d').drawImage(IMGS[n], x, y, w, h, P, P, w, h);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  setFrame(t, P, P, w, h, cv.width, cv.height);
  return t;
}
function setFrame(t, x, y, w, h, W, H, flip) {
  t.repeat.set((flip ? -w : w) / W, h / H);
  t.offset.set((flip ? x + w : x) / W, 1 - (y + h) / H);
}
export function frameOf(kind, level) {
  return Math.max(0, Math.min(BUILD[kind].f.length - 1, Math.floor(Number(level) || 1) - 1));
}
export function shrinkOf(kind, level) {
  const n = BUILD[kind].f.length;
  return n === 1 ? .78 : .55 + .45 * frameOf(kind, level) / (n - 1);
}
function legacyFrame(kind, level) {
  const i = frameOf(kind, level);
  return kind === 'keep' ? [3, 3, 4, 5, 6, 7, 8, 9][i] : Math.round(i * 9 / (BUILD[kind].f.length - 1));
}
function frameData(kind, level) {
  const legacy = SOURCES[kind] === 'legacy', fam = legacy ? LEGACY_BUILD[kind] : BUILD[kind];
  const i = legacy ? legacyFrame(kind, level) : frameOf(kind, level);
  return {fam, i, f: fam.f[i]};
}
/** Keep aspect ratios while visible width, height and base grow at every upgrade. */
export function dimensionsOf(kind, level, size = 1) {
  const n = BUILD[kind].f.length, chosen = frameOf(kind, level); let next = null;
  for (let i = n - 1; i >= chosen; i--) {
    const {f} = frameData(kind, i + 1);
    let k = size * Math.SQRT2 * shrinkOf(kind, i + 1) / f[6];
    if (next) k = Math.min(k, next.width / (f[2] * 1.035), next.height / (f[3] * 1.035), next.baseWidth / (f[6] * 1.035));
    next = {k, baseWidth: f[6] * k, width: f[2] * k, height: f[3] * k};
  }
  return next;
}
function shadowTex() {
  if (!SHADOW) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 6, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.7, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SHADOW = new T.CanvasTexture(cv);
  }
  return SHADOW;
}
export function building(kind, level, size) {
  if (!has(kind)) return null;
  const {i, f} = frameData(kind, level), [x, y, w, h, ax, ay, bw] = f;
  const {k} = dimensionsOf(kind, level, size), key = `${kind}:${SOURCES[kind]}:${i}`;
  if (!MATS.has(key)) MATS.set(key, new T.SpriteMaterial({map: cutTex(kind, x, y, w, h), transparent: true, alphaTest: .04, toneMapped: false}));
  const sp = new T.Sprite(MATS.get(key));
  sp.center.set(ax / w, 1 - ay / h); sp.scale.set(w * k, h * k, 1);
  const g = ISO * bw * k / SIN_P;
  sp.position.set(g * Math.SQRT1_2, 0, g * Math.SQRT1_2); sp.renderOrder = 1;
  const grp = new T.Group(); grp.add(sp);
  const shadowSize = bw * k / Math.SQRT2 * 1.15;
  const sh = new T.Mesh(new T.PlaneGeometry(shadowSize, shadowSize), new T.MeshBasicMaterial({map: shadowTex(), transparent: true, depthWrite: false, toneMapped: false}));
  sh.rotation.x = -Math.PI / 2; sh.position.y = .012; grp.add(sh);
  const hitHeight = Math.min(4, h * k * .8);
  const hit = new T.Mesh(new T.BoxGeometry(size * .9, hitHeight, size * .9), new T.MeshBasicMaterial({visible: false}));
  hit.position.y = hitHeight / 2; grp.add(hit);
  grp.userData = {sprite: sp, k, ax, ay, w, h, rest: sp.position.clone(), base: sp.scale.clone(), owned: [sh, hit]};
  return grp;
}
/** Release per-building geometry; atlas materials and shadow texture remain shared. */
export function release(group) {
  const owned = group && group.userData && group.userData.owned;
  if (!owned) return;
  owned.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
  group.userData.owned = [];
}
/** A building's picture at a level, a PNG data URL: side x side px (160, for the lists) and drawn as big as its top
 *  level's, so it grows with each level. With wide (a building's card, views/realm.js: its width to its height) and
 *  foot (its footprint in tiles), side px high, on the lighter diamond of its footprint, as Clash draws its info
 *  screen's: bigger for a higher level and a bigger footprint. */
export function thumbURL(kind, level, side = 160, wide = 0, foot = 0) {
  if (!has(kind)) return '';
  const key = kind + ':' + SOURCES[kind] + ':' + frameOf(kind, level) + (side === 160 && !wide ? '' : `@${side}x${wide}x${foot}`);
  if (URLS.has(key)) return URLS.get(key);
  const {f} = frameData(kind, level), [x, y, w, h, ax, ay, bw] = f, dim = dimensionsOf(kind, level), W = Math.round(side * (wide || 1));
  const last = dimensionsOf(kind, BUILD[kind].f.length), px = side * .95 / Math.max(last.width, last.height);
  // (the card: its own picture fitted to the tile, then as much smaller as it is to its kind's top level, gently (a first
  // level still well seen), and smaller for a smaller footprint: a Castle's 4 tiles, a hut's 2)
  const grown = Math.min(1, Math.max(dim.width / last.width, dim.height / last.height));
  const scale = wide ? Math.min(1.6, W * .9 / w, side * .86 / h) * (.58 + .42 * grown) * (foot ? .6 + .1 * Math.min(4, foot) : 1) : dim.k * px;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = side;
  const g = cv.getContext('2d'), left = (W - w * scale) / 2, top = side * (wide ? .95 : .975) - h * scale;
  if (wide) {
    // (the footprint: a lighter diamond of grass under its base, ISO high to its width, a little wider than the base)
    const cx = left + ax * scale, cy = top + (ay - ISO * bw) * scale, hw = bw * scale * .59, hh = ISO * bw * scale * 1.18;
    g.beginPath(); g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy); g.closePath();
    g.fillStyle = 'rgba(214,236,160,.2)'; g.fill();
    g.lineWidth = Math.max(1.5, side / 160); g.strokeStyle = 'rgba(250,246,214,.3)'; g.stroke();
  }
  g.drawImage(IMGS[kind], x, y, w, h, left, top, w * scale, h * scale);
  const url = cv.toDataURL('image/png'); URLS.set(key, url); return url;
}
/** Actual shot times drive recoil; transforms belong to each sprite, with shared materials. */
export function animateDefense(group, kind, elapsed, aim = 0) {
  const u = group.userData;
  if (!u.sprite || !['cannon', 'ballista', 'trebuchet', 'cauldron'].includes(kind)) return false;
  const duration = kind === 'trebuchet' ? .65 : kind === 'cauldron' ? .5 : .3;
  const pulse = elapsed >= 0 && elapsed < duration ? Math.sin(Math.PI * elapsed / duration) : 0;
  u.sprite.position.copy(u.rest);
  u.sprite.position.x -= Math.cos(aim) * .13 * pulse;
  u.sprite.position.z -= Math.sin(aim) * .13 * pulse;
  u.sprite.position.y += (kind === 'trebuchet' ? .12 : .045) * pulse;
  u.sprite.scale.set(u.base.x * (1 + .025 * pulse), u.base.y * (1 - .035 * pulse), 1);
  return true;
}

// ---------------------------------------------------------------------------------------------------- the folk
/** A figure (a sprite of its own, the folk's picture shared): pose() it. */
export function folk() {
  const sp = new T.Sprite(new T.SpriteMaterial({map: frameTex('folk', 0, 0, 1, 1, FOLK_SIZE[0], FOLK_SIZE[1]), transparent: true, alphaTest: .04, toneMapped: false}));
  sp.renderOrder = 2;
  sp.userData.at = '';
  return sp;
}
/** Puts figure sp in pose i of sheet (flip: facing the other way); its feet at its position, a standing figure
 *  FOLK_H x size tall. */
export function pose(sp, sheet, i, flip = false, size = 1) {
  const at = `${sheet}:${i}:${flip ? 1 : 0}:${size}`;
  if (sp.userData.at === at) return;
  sp.userData.at = at;
  const fr = FOLK[sheet][i % FOLK[sheet].length], [x, y, w, h, fx, fy] = fr, k = FOLK_H * size / TALL;
  setFrame(sp.material.map, x, y, w, h, FOLK_SIZE[0], FOLK_SIZE[1], flip);
  sp.center.set(flip ? 1 - fx / w : fx / w, 1 - fy / h);
  sp.scale.set(w * k, h * k, 1);
  sp.userData.base = [w * k, h * k];
}
// Where an archer tower's archer stands, per level: px in its picture (the floor of its platform, at the front).
const LEGACY_PLATFORM = [[115, 150], [118, 128], [122, 162], [136, 136], [142, 112], [130, 205], [140, 212], [150, 125], [160, 140], [172, 132]];
export const platform = level => SOURCES.tower === 'legacy' ? LEGACY_PLATFORM[legacyFrame('tower', level)] : UPGRADE_PLATFORM[frameOf('tower', level)];
const TIER = l => (l >= 8 ? 2 : l >= 4 ? 1 : 0);
// The work each building's villagers do (one each side of its front corner). The brewery's (KINDS.farm) carry in a sack
// of malt and wood for the kettle's fire (the farmer and the harvest sheets were the farm's, before it brewed Ale).
const WORK = {keep: ['lantern', 'firewood'], farm: ['sack', 'firewood'], barracks: ['smith', 'tongs'], camp: ['feed', 'hay'], hut: ['timber'],
  mine: ['sack'], treasury: ['fabric'], granary: ['sack'], hatchery: ['firewood']};
const CREW = [['powder1', 'ball1', 'ram1'], ['fire2', 'ball2', 'scoop2'], ['fire3', 'ball3', 'ram3']];
/**
 * Who stands round building b (its status: ok, new, up, down): [{sheet, u, v (tiles from its middle), flip, role
 * (work: a villager, at home only; crew: a cannon's; archer: on a tower; build: a builder at a job), size}].
 */
export function crewOf(b, status, size) {
  if (status === 'down') return [];
  const s = size, left = [s * .18, s / 2 + .45], right = [s / 2 + .45, s * .18];
  if (status !== 'ok') return [{sheet: 'chop', u: left[0], v: left[1], flip: false, role: 'build'}];
  if (b.t === 'cannon') {
    const c = CREW[TIER(b.l)];
    return [{sheet: c[0], u: -.25, v: 1.05, flip: false, role: 'crew'}, {sheet: c[1], u: 1.05, v: -.2, flip: true, role: 'crew'}, {sheet: c[2], u: -1.05, v: -.2, flip: false, role: 'crew'}];
  }
  if (b.t === 'tower') return [{sheet: 'archer' + (TIER(b.l) + 1), u: 0, v: 0, flip: false, role: 'archer', size: 1.15}];
  return (WORK[b.t] || []).map((sheet, i) => ({sheet, u: (i ? right : left)[0], v: (i ? right : left)[1], flip: !!i, role: 'work'}));
}

// <frames> (tools/realm/sprites.py writes this)
/** Buildings: per family, a frame per level [x, y, w, h, ax, ay, bw] (px in img/realm/<family>.webp; ax, ay
 *  the front point of its base, bw its base's width). */
const LEGACY_BUILD = {
  keep: {w: 2048, h: 772, f: [[1335, 423, 333, 270, 166.0, 269.0, 332], [1004, 423, 329, 282, 164.0, 282.0, 328], [679, 423, 323, 296, 161.5, 296.0, 323], [2, 423, 325, 344, 163.0, 344.0, 324], [329, 423, 348, 322, 173.5, 322.0, 347], [1147, 2, 371, 380, 186.0, 380.0, 370], [1520, 2, 371, 377, 185.5, 376.0, 369], [781, 2, 364, 388, 182.0, 388.0, 364], [2, 2, 381, 419, 190.5, 419.0, 381], [385, 2, 394, 414, 196.5, 414.0, 393]]},
  mine: {w: 2048, h: 784, f: [[1446, 442, 328, 237, 164.0, 237.0, 328], [1119, 442, 325, 271, 162.5, 271.0, 325], [372, 442, 355, 329, 177.0, 329.0, 354], [2, 442, 368, 338, 184.0, 338.0, 368], [729, 442, 388, 327, 194.0, 326.0, 388], [1173, 2, 361, 403, 180.5, 403.0, 361], [1536, 2, 365, 401, 182.5, 401.0, 365], [401, 2, 376, 420, 188.0, 420.0, 376], [779, 2, 392, 419, 196.0, 419.0, 392], [2, 2, 397, 438, 198.5, 438.0, 397]]},
  tower: {w: 2048, h: 876, f: [[548, 476, 234, 364, 116.5, 364.0, 233], [784, 476, 237, 361, 118.5, 360.0, 237], [2, 476, 254, 398, 127.5, 398.0, 253], [1521, 2, 276, 399, 138.0, 399.0, 274], [258, 476, 288, 381, 144.0, 380.0, 288], [346, 2, 262, 465, 130.5, 465.0, 261], [610, 2, 277, 460, 138.5, 460.0, 277], [1213, 2, 306, 437, 148.0, 437.0, 278], [889, 2, 322, 455, 159.0, 455.0, 318], [2, 2, 342, 472, 171.0, 471.0, 342]]},
  hatchery: {w: 2048, h: 844, f: [[1357, 490, 268, 244, 134.5, 243.0, 267], [1044, 490, 311, 282, 156.0, 282.0, 310], [739, 490, 303, 313, 151.5, 313.0, 303], [1399, 2, 372, 359, 186.0, 359.0, 372], [2, 490, 387, 352, 194.5, 352.0, 385], [391, 490, 346, 343, 173.5, 343.0, 345], [1091, 2, 306, 368, 153.5, 368.0, 305], [762, 2, 327, 442, 164.0, 442.0, 326], [2, 2, 357, 486, 176.5, 486.0, 353], [361, 2, 399, 486, 200.0, 486.0, 398]]},
};
/** The folk: per sheet, its poses in order [x, y, w, h, ax, ay] (px in img/realm/folk.webp; ax, ay where the feet
 *  are). A standing figure is TALL px. */
export const TALL = 96;
export const FOLK_SIZE = [2048, 608];
export const FOLK = {
  farmer: [[428, 123, 60, 96, 22.5, 96.0], [432, 418, 74, 94, 67.0, 94.0], [983, 418, 78, 93, 70.0, 93.0], [1793, 418, 70, 90, 63.5, 90.0], [1351, 418, 74, 92, 28.0, 92.0], [737, 2, 76, 98, 38.0, 98.0], [545, 2, 68, 99, 23.0, 99.0], [490, 123, 61, 96, 23.5, 96.0]],
  harvest: [[553, 123, 58, 96, 26.0, 96.0], [889, 2, 60, 97, 25.5, 97.0], [613, 123, 76, 96, 46.0, 96.0], [1099, 320, 60, 95, 26.5, 95.0]],
  smith: [[691, 123, 57, 96, 27.0, 96.0], [750, 123, 58, 96, 28.5, 96.0], [124, 2, 57, 108, 27.5, 108.0], [65, 2, 57, 116, 26.5, 116.0], [1427, 418, 59, 92, 29.0, 92.0], [1488, 418, 59, 92, 28.5, 92.0], [508, 418, 57, 94, 27.0, 94.0], [567, 418, 57, 94, 27.0, 94.0]],
  tongs: [[810, 123, 55, 96, 38.0, 96.0], [867, 123, 55, 96, 38.5, 96.0], [924, 123, 56, 96, 39.5, 96.0], [982, 123, 55, 96, 38.5, 96.0], [1039, 123, 55, 96, 38.5, 96.0], [1161, 320, 55, 95, 38.5, 95.0], [1096, 123, 55, 96, 38.5, 96.0], [1153, 123, 55, 96, 38.5, 96.0]],
  chop: [[1865, 418, 59, 90, 43.0, 90.0], [626, 418, 59, 94, 45.0, 94.0], [183, 2, 60, 100, 46.0, 100.0], [2, 2, 61, 119, 47.0, 119.0], [1210, 123, 61, 96, 45.0, 96.0], [1926, 418, 64, 90, 49.5, 90.0], [1273, 123, 60, 96, 46.0, 96.0], [1654, 418, 59, 91, 43.5, 91.0]],
  timber: [[1335, 123, 58, 96, 26.0, 96.0], [1218, 320, 66, 95, 33.5, 95.0], [1395, 123, 75, 96, 45.0, 96.0], [1472, 123, 58, 96, 26.5, 96.0]],
  sack: [[892, 515, 61, 77, 25.0, 77.0], [1532, 123, 56, 96, 15.0, 96.0], [245, 2, 61, 100, 20.0, 100.0], [1286, 320, 68, 95, 26.5, 95.0]],
  fabric: [[824, 515, 66, 79, 37.0, 79.0], [308, 2, 59, 100, 32.5, 100.0], [1590, 123, 58, 96, 33.0, 96.0], [955, 515, 65, 74, 47.0, 74.0]],
  feed: [[1650, 123, 50, 96, 29.5, 96.0], [951, 2, 57, 97, 28.5, 97.0], [1702, 123, 75, 96, 28.5, 96.0], [1779, 123, 49, 96, 28.5, 96.0]],
  hay: [[1830, 123, 82, 96, 48.0, 96.0], [471, 515, 80, 85, 47.0, 85.0], [1022, 515, 81, 74, 44.5, 74.0], [1914, 123, 79, 96, 44.0, 96.0]],
  firewood: [[1356, 320, 66, 95, 35.0, 95.0], [2, 222, 62, 96, 31.5, 96.0], [1424, 320, 86, 95, 39.0, 95.0], [66, 222, 63, 96, 33.0, 96.0]],
  lantern: [[131, 222, 56, 96, 23.5, 96.0], [1063, 418, 58, 93, 27.0, 93.0], [815, 2, 72, 98, 36.5, 98.0], [1123, 418, 55, 93, 25.5, 93.0]],
  archer1: [[2, 515, 72, 89, 27.0, 89.0], [189, 222, 66, 96, 26.0, 96.0], [257, 222, 74, 96, 29.0, 96.0], [369, 2, 70, 100, 30.0, 100.0], [1010, 2, 67, 97, 31.5, 97.0], [1512, 320, 68, 95, 30.0, 95.0], [1715, 418, 76, 91, 31.5, 91.0], [553, 515, 68, 85, 26.0, 85.0]],
  archer2: [[687, 515, 68, 82, 25.0, 82.0], [623, 515, 62, 85, 23.0, 85.0], [1079, 2, 63, 97, 25.5, 97.0], [1144, 2, 69, 97, 28.5, 97.0], [1180, 418, 65, 93, 30.0, 93.0], [1215, 2, 64, 97, 30.0, 97.0], [333, 222, 70, 96, 30.5, 96.0], [757, 515, 65, 82, 25.5, 82.0]],
  archer3: [[332, 515, 68, 86, 28.0, 86.0], [687, 418, 69, 94, 27.5, 94.0], [405, 222, 75, 96, 28.5, 96.0], [615, 2, 67, 99, 25.5, 99.0], [1281, 2, 69, 97, 31.5, 97.0], [482, 222, 68, 96, 29.0, 96.0], [552, 222, 69, 96, 29.5, 96.0], [402, 515, 67, 86, 28.0, 86.0]],
  powder1: [[623, 222, 62, 96, 50.5, 96.0], [1352, 2, 69, 97, 31.0, 97.0], [687, 222, 72, 96, 52.0, 96.0], [1582, 320, 95, 95, 36.5, 95.0], [761, 222, 81, 96, 30.0, 96.0], [1679, 320, 69, 95, 34.0, 95.0], [844, 222, 66, 96, 31.0, 96.0], [912, 222, 63, 96, 51.0, 96.0]],
  ball1: [[977, 222, 59, 96, 54.0, 96.0], [1038, 222, 58, 96, 53.0, 96.0], [1098, 222, 58, 96, 53.5, 96.0], [1158, 222, 57, 96, 52.0, 96.0], [1217, 222, 67, 96, 55.0, 96.0], [1286, 222, 58, 96, 53.0, 96.0], [1346, 222, 58, 96, 53.0, 96.0], [1406, 222, 57, 96, 52.0, 96.0]],
  ram1: [[1423, 2, 97, 97, 67.0, 97.0], [1522, 2, 97, 97, 62.0, 97.0], [1465, 222, 105, 96, 61.5, 96.0], [1247, 418, 102, 93, 62.0, 93.0], [1549, 418, 103, 92, 62.0, 92.0], [1750, 320, 98, 95, 65.5, 95.0], [1572, 222, 96, 96, 62.0, 96.0], [1850, 320, 95, 95, 67.0, 95.0]],
  fire2: [[1621, 2, 79, 97, 52.0, 97.0], [758, 418, 72, 94, 50.5, 94.0], [832, 418, 83, 94, 51.5, 94.0], [162, 515, 83, 87, 56.5, 87.0], [247, 515, 83, 87, 56.0, 87.0], [1670, 222, 70, 96, 53.5, 96.0], [1702, 2, 74, 97, 50.0, 97.0], [1778, 2, 79, 97, 52.0, 97.0]],
  ball2: [[1742, 222, 60, 96, 30.5, 96.0], [1947, 320, 60, 95, 30.0, 95.0], [1804, 222, 60, 96, 30.0, 96.0], [917, 418, 64, 94, 30.0, 94.0], [1859, 2, 73, 97, 31.0, 97.0], [1934, 2, 60, 97, 30.5, 97.0], [1866, 222, 61, 96, 31.5, 96.0], [1929, 222, 60, 96, 30.0, 96.0]],
  scoop2: [[1161, 515, 54, 67, 28.0, 67.0], [684, 2, 51, 99, 26.0, 99.0], [2, 320, 79, 96, 52.0, 96.0], [1105, 515, 54, 73, 28.0, 73.0]],
  fire3: [[83, 320, 82, 96, 55.0, 96.0], [167, 320, 75, 96, 55.5, 96.0], [2, 418, 66, 95, 53.0, 95.0], [244, 320, 106, 96, 70.5, 96.0], [76, 515, 84, 89, 60.0, 89.0], [352, 320, 78, 96, 57.0, 96.0], [2, 123, 85, 97, 57.0, 97.0], [432, 320, 80, 96, 57.0, 96.0]],
  ball3: [[89, 123, 58, 97, 53.0, 97.0], [514, 320, 57, 96, 52.0, 96.0], [70, 418, 57, 95, 52.0, 95.0], [129, 418, 57, 95, 52.0, 95.0], [573, 320, 67, 96, 53.5, 96.0], [149, 123, 59, 97, 53.5, 97.0], [642, 320, 59, 96, 53.5, 96.0], [703, 320, 57, 96, 52.0, 96.0]],
  ram3: [[441, 2, 102, 100, 61.0, 100.0], [210, 123, 105, 97, 63.0, 97.0], [188, 418, 123, 95, 61.5, 95.0], [313, 418, 117, 95, 63.5, 95.0], [762, 320, 116, 96, 64.0, 96.0], [880, 320, 107, 96, 64.5, 96.0], [989, 320, 108, 96, 64.5, 96.0], [317, 123, 109, 97, 64.5, 97.0]],
};
// </frames>
