// The Keep's pictures (views/realm-3d.js puts them in its 3D lot): the Castle (KINDS.keep), the gold mine, the archer tower and the
// dragon hatchery drawn from their art, a picture a level (stood up facing the camera, which never turns, so they
// look as drawn), and the folk: villagers at work by their buildings, an archer on each archer tower, a cannon's crew
// round it. The art (img/realm/*.webp) and its frames below come from tools/realm/sprites.py.
// A building's picture stands on its footprint: its base's front point a little in front of the footprint's middle
// (so the middle of the base it's drawn on lands on the footprint's), as wide as the footprint seen corner-on at the
// family's top level (a level-1 hut stands smaller on the same ground). A figure's feet are where it stands.
// Exports: init(T, pitch), load() → true when the art's in, ready(), KINDS (the buildings drawn from art), building(kind,
// level, size) → THREE.Group, frameOf(kind, level), thumbURL(kind, level), folk() → a figure (THREE.Sprite), pose(figure,
// sheet, i, flip), FOLK_H, crewOf(b, status) (who stands round a building), platform(level) (where a tower's archer
// stands, px in its picture), FOLK.
let T = null, SIN_P = .78, IMGS = null, LOADING = null, DEAD = false;
const TEX = {};
const MATS = new Map();
const URLS = new Map();
const BASE = new URL('../../img/realm/', import.meta.url).href;
export const KINDS = ['keep', 'mine', 'tower', 'hatchery'];
// How wide a family's widest base is on its footprint (seen corner-on, a footprint is size x 1.41 across).
const FIT = {keep: 1.02, mine: 1.04, tower: .98, hatchery: 1.04};
// The art's ground is drawn flatter than the camera sees it: its base's half-height is this share of its width.
const ISO = .27;
/** A figure's height (tiles) for TALL px. */
export const FOLK_H = .95;

export function init(three, pitch) { T = three; SIN_P = Math.sin(pitch); }
export function load() {
  if (!LOADING) {
    LOADING = Promise.all([...KINDS, 'folk'].map(n => new Promise((ok, no) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => ok([n, im]);
      im.onerror = () => no(new Error('no ' + n));
      im.src = BASE + n + '.webp';
    }))).then(list => { IMGS = Object.fromEntries(list); return true; }, e => { console.warn('The Keep: no art', e); DEAD = true; return false; });
  }
  return LOADING;
}
export const ready = () => !!IMGS && !DEAD && !!T;
function texOf(n) {
  if (!TEX[n]) {
    const t = new T.Texture(IMGS[n]);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    TEX[n] = t;
  }
  return TEX[n];
}
/** A frame of an atlas (px from its top left) as a texture of its own (the picture shared). */
function frameTex(n, x, y, w, h, W, H, flip = false) {
  const t = texOf(n).clone();
  setFrame(t, x, y, w, h, W, H, flip);
  return t;
}
function setFrame(t, x, y, w, h, W, H, flip) {
  t.repeat.set((flip ? -w : w) / W, h / H);
  t.offset.set((flip ? x + w : x) / W, 1 - (y + h) / H);
}

// The Castle's pictures (Oct 21 2026: the Keep became the Castle): the atlas's first three are timber halls, so its 8
// levels are drawn from the seven stone castles (3 to 9), levels 1 and 2 both the smallest, level 1's drawn smaller.
const FRAMES = {keep: [3, 3, 4, 5, 6, 7, 8, 9]};
const SHRINK = {keep: [.84]};
/** Which of a family's ten pictures a level gets (the mine's 12 levels spread over them; the Castle's above). */
export function frameOf(kind, level) {
  const top = {keep: 8, mine: 12}[kind] || 10, l = Math.max(1, Math.min(top, level || 1));
  return FRAMES[kind] ? FRAMES[kind][l - 1] : Math.round((l - 1) * 9 / (top - 1));
}
/** How much smaller than its picture a level stands (1: as drawn). */
export const shrinkOf = (kind, level) => (SHRINK[kind] || [])[Math.max(1, level || 1) - 1] || 1;
let SHADOW = null;
function shadowTex() {
  if (!SHADOW) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 6, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.7, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    SHADOW = new T.CanvasTexture(cv);
  }
  return SHADOW;
}
/** A building drawn from its art, on a size x size footprint centred on the group's origin: its picture, a soft
 *  shadow on the ground, and an unseen box to tap. userData: {sprite, k (tiles a px), ax, ay (its anchor, px)}. */
export function building(kind, level, size) {
  const fam = BUILD[kind], i = frameOf(kind, level), [x, y, w, h, ax, ay, bw] = fam.f[i];
  const top = Math.max(...fam.f.map(f => f[6])), k = size * Math.SQRT2 * FIT[kind] / top * shrinkOf(kind, level);
  const key = `${kind}:${i}`;
  if (!MATS.has(key)) MATS.set(key, new T.SpriteMaterial({map: frameTex(kind, x, y, w, h, fam.w, fam.h), transparent: true, alphaTest: .04, toneMapped: false}));
  const sp = new T.Sprite(MATS.get(key));
  sp.center.set(ax / w, 1 - ay / h);
  sp.scale.set(w * k, h * k, 1);
  const g = ISO * bw * k / SIN_P;
  sp.position.set(g * Math.SQRT1_2, 0, g * Math.SQRT1_2);
  sp.renderOrder = 1;
  const grp = new T.Group();
  grp.add(sp);
  const sh = new T.Mesh(new T.PlaneGeometry(size * 1.15, size * 1.15), new T.MeshBasicMaterial({map: shadowTex(), transparent: true, depthWrite: false, toneMapped: false}));
  sh.rotation.x = -Math.PI / 2; sh.position.y = .012;
  grp.add(sh);
  const hit = new T.Mesh(new T.BoxGeometry(size * .9, Math.min(4, h * k * .8), size * .9), new T.MeshBasicMaterial({visible: false}));
  hit.position.y = Math.min(4, h * k * .8) / 2;
  grp.add(hit);
  grp.userData = {sprite: sp, k, ax, ay, w, h};
  return grp;
}
/** A picture of a building at a level (a data URL), for the shop. */
export function thumbURL(kind, level) {
  const key = kind + ':' + frameOf(kind, level) + ':' + shrinkOf(kind, level);
  if (URLS.has(key)) return URLS.get(key);
  const fam = BUILD[kind], [x, y, w, h] = fam.f[frameOf(kind, level)];
  const cv = document.createElement('canvas'); cv.width = cv.height = 160;
  const s = Math.min(152 / w, 152 / h) * shrinkOf(kind, level);
  cv.getContext('2d').drawImage(IMGS[kind], x, y, w, h, (160 - w * s) / 2, 156 - h * s, w * s, h * s);
  const url = cv.toDataURL('image/png');
  URLS.set(key, url);
  return url;
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
const PLATFORM = [[115, 150], [118, 128], [122, 162], [136, 136], [142, 112], [130, 205], [140, 212], [150, 125], [160, 140], [172, 132]];
export const platform = level => PLATFORM[frameOf('tower', level)];
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
export const BUILD = {
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
