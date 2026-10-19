// Two-Minute Drill: the players as pictures (views/drill-cam.js draws them). One atlas of every pose
// (img/drill/players.webp, from five sprite sheets by tools/drill/sprites.py) with its uniform in grey, and a mask of
// which grey is the jersey, the pants and the helmet (players-mask.webp): each team's colours are put on once a game
// (atlasFor, kept), yours in your colours and theirs in white, as the drawn players were. pick() chooses a player's
// picture for the moment (his stance before the snap; his stride the way he's going, two to a stride; a block, the
// throw, a catch, a stiff arm, a tackle, a swat, a pick; on the ground) and draw() puts it at his feet.
// Exports: load(), ready(), pick(pl, o), hasFrame(name), hasBall(pick), draw(g, pick, team, colored, x, y, tallPx), TALL.
// Owner: Drill.

// <frames> (tools/drill/sprites.py writes this)
/** A runner's height in the atlas, px. */
export const TALL = 112;
const FRAMES = {
  'def.r_b0': [629, 140, 65, 113, 32.7, 111.0],
  'def.r_b1': [640, 2, 62, 116, 29.6, 114.0],
  'def.r_f0': [704, 2, 60, 116, 29.2, 114.0],
  'def.r_f1': [755, 140, 63, 111, 29.9, 109.0],
  'def.r_l0': [2, 481, 87, 101, 35.9, 99.0],
  'def.r_l1': [91, 481, 83, 101, 38.8, 99.0],
  'def.r_r0': [872, 371, 76, 102, 38.5, 100.0],
  'def.r_r1': [176, 481, 89, 100, 50.8, 98.0],
  'def.stance': [2, 677, 87, 73, 39.8, 71.0],
  'def.swim': [305, 584, 82, 86, 37.4, 84.0],
  'def.rip': [478, 584, 82, 85, 43.1, 83.0],
  'def.hands': [950, 584, 58, 74, 27.2, 72.0],
  'def.reach': [641, 677, 88, 66, 39.2, 64.0],
  'def.dive': [108, 752, 93, 54, 49.1, 40.8],
  'def.lunge': [292, 677, 78, 71, 41.1, 69.0],
  'def.fallen': [473, 677, 82, 69, 40.9, 52.5],
  'def.juked': [135, 584, 86, 87, 35.8, 85.0],
  'def.flat': [2, 752, 104, 58, 50.9, 43.9],
  'def.leap': [267, 481, 86, 100, 39.0, 98.0],
  'def.pick': [562, 584, 50, 85, 24.0, 83.0, 1],
  'ol.r_b0': [445, 140, 63, 114, 31.3, 112.0],
  'ol.r_b1': [84, 140, 58, 115, 28.2, 113.0],
  'ol.r_f0': [416, 2, 59, 117, 28.6, 114.0],
  'ol.r_f1': [86, 258, 63, 110, 29.6, 108.0],
  'ol.r_l0': [492, 258, 88, 109, 36.0, 107.0],
  'ol.r_l1': [582, 258, 82, 109, 34.1, 107.0],
  'ol.r_r0': [92, 371, 83, 107, 44.6, 105.0],
  'ol.r_r1': [177, 371, 92, 107, 53.3, 105.0],
  'ol.stance': [389, 584, 87, 86, 42.8, 84.0],
  'ol.pass': [626, 371, 85, 105, 42.4, 103.0],
  'ol.drive': [666, 258, 90, 109, 39.5, 107.0],
  'ol.cut': [614, 584, 103, 81, 55.3, 79.0],
  'ol.set': [550, 481, 103, 97, 48.9, 95.0],
  'ol.reach': [168, 2, 69, 122, 35.7, 120.0],
  'ol.lunge': [719, 584, 122, 79, 54.6, 77.0],
  'ol.fallen': [557, 677, 82, 68, 44.3, 51.7],
  'wr.r_b0': [144, 140, 64, 115, 31.1, 113.0],
  'wr.r_b1': [210, 140, 57, 115, 27.8, 113.0],
  'wr.r_f0': [477, 2, 58, 117, 27.8, 115.0],
  'wr.r_f1': [820, 140, 63, 111, 29.0, 109.0],
  'wr.r_l0': [885, 140, 88, 111, 35.3, 109.0],
  'wr.r_l1': [758, 258, 81, 109, 32.8, 107.0],
  'wr.r_r0': [151, 258, 83, 110, 44.1, 108.0],
  'wr.r_r1': [236, 258, 90, 110, 51.8, 108.0],
  'wr.catch': [269, 140, 52, 115, 25.1, 113.0, 1],
  'wr.high': [2, 2, 67, 136, 39.0, 134.0, 1],
  'wr.onehand': [71, 2, 95, 127, 52.7, 125.0, 1],
  'wr.layout': [409, 752, 105, 46, 57.5, 34.5, 1],
  'wr.fumble': [447, 481, 101, 99, 49.9, 97.0, 1],
  'wr.after': [713, 371, 82, 104, 38.3, 102.0, 1],
  'wr.dive': [731, 677, 102, 62, 50.1, 47.0],
  'wr.down': [835, 677, 91, 62, 51.3, 47.0, 1],
  'rb.r_b0': [766, 2, 60, 116, 29.8, 114.0, 1],
  'rb.r_b1': [828, 2, 57, 116, 26.5, 114.0, 1],
  'rb.r_f0': [510, 140, 60, 114, 29.7, 112.0, 1],
  'rb.r_f1': [696, 140, 57, 112, 26.9, 110.0, 1],
  'rb.r_l0': [357, 371, 90, 106, 34.4, 104.0, 1],
  'rb.r_l1': [271, 371, 84, 107, 31.6, 105.0, 1],
  'rb.r_r0': [923, 258, 78, 108, 45.5, 105.0, 1],
  'rb.r_r1': [2, 371, 88, 108, 54.8, 106.0, 1],
  'rb.juke': [223, 584, 80, 87, 33.2, 85.0, 1],
  'rb.stiff_r': [449, 371, 96, 106, 34.9, 104.0, 1],
  'rb.stiff_b': [547, 371, 77, 106, 36.9, 104.0, 1],
  'rb.high': [797, 371, 73, 103, 34.8, 101.0, 1],
  'rb.hurdle': [812, 481, 95, 95, 35.5, 93.0, 1],
  'rb.stiff_f': [355, 481, 90, 100, 34.9, 98.0, 1],
  'rb.spin': [655, 481, 74, 97, 37.6, 95.0, 1],
  'rb.take': [731, 481, 79, 97, 40.3, 95.0, 1],
  'rb.dive': [175, 677, 115, 72, 57.0, 54.8],
  'rb.lunge': [372, 677, 99, 70, 51.7, 68.0, 1],
  'rb.falling': [91, 677, 82, 73, 37.3, 55.6, 1],
  'rb.down': [309, 752, 98, 48, 45.1, 35.3, 1],
  'qb.r_b0': [887, 2, 58, 116, 30.1, 114.0, 1],
  'qb.r_b1': [947, 2, 53, 116, 24.3, 113.0, 1],
  'qb.r_f0': [572, 140, 55, 114, 26.7, 112.0, 1],
  'qb.r_f1': [323, 140, 53, 115, 24.0, 113.0, 1],
  'qb.r_l0': [2, 258, 82, 111, 29.2, 109.0, 1],
  'qb.r_l1': [841, 258, 80, 109, 29.6, 106.0, 1],
  'qb.r_r0': [328, 258, 76, 110, 44.9, 108.0, 1],
  'qb.r_r1': [406, 258, 84, 110, 51.8, 107.0, 1],
  'qb.set': [2, 140, 80, 116, 35.3, 114.0, 1],
  'qb.handoff': [537, 2, 101, 117, 39.2, 115.0, 1],
  'qb.tuck': [378, 140, 65, 115, 32.8, 113.0, 1],
  'qb.windup': [318, 2, 96, 118, 46.7, 116.0, 1],
  'qb.release': [239, 2, 77, 119, 26.5, 117.0],
  'qb.dive': [2, 584, 131, 91, 65.8, 68.9],
  'qb.falling': [843, 584, 105, 78, 42.7, 59.5, 1],
  'qb.down': [203, 752, 104, 50, 43.6, 37.7, 1]
};
// </frames>

let ART = null, MASK = null, LOADING = null, DEAD = false;
const imgOf = src => new Promise((ok, no) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => ok(im);
  im.onerror = no;
  im.src = new URL(`../../img/drill/${src}`, import.meta.url).href;
});
/** Loads the atlas and its mask (once). Resolves true when they're in; false if they can't load (the drawn players stay). */
export function load() {
  if (!LOADING) {
    LOADING = Promise.all([imgOf('players.webp'), imgOf('players-mask.webp')])
      .then(([a, m]) => { ART = a; MASK = m; return true; }, () => { DEAD = true; return false; });
  }
  return LOADING;
}
export const ready = () => !!(ART && MASK) && !DEAD && Object.keys(FRAMES).length > 0;

// ---------------------------------------------------------------------------- Colours
const rgbOf = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x808080; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const WHITE = '#F3F3F0', OFFWHITE = '#ECEAE3';
/** A team's uniform in the pictures: jersey, pants, helmet. Coloured: its colour with off-white pants; white: a white
 *  jersey with pants in its colour. The helmet is its colour either way. */
function kitOf(team, colored) {
  const c0 = team[0];
  return colored ? {J: c0, P: OFFWHITE, H: c0} : {J: WHITE, P: c0, H: c0};
}
const KITS = new Map(); // 'J,P,H' -> canvas
let PIX = null; // the atlas's and the mask's pixels, read once
/** The atlas in a uniform: a canvas, made once a uniform. */
function atlasFor(kit) {
  const key = `${kit.J},${kit.P},${kit.H}`;
  if (KITS.has(key)) return KITS.get(key);
  const W = ART.naturalWidth, H = ART.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', {willReadFrequently: false});
  if (!PIX) {
    g.drawImage(ART, 0, 0);
    const art = g.getImageData(0, 0, W, H);
    const mc = document.createElement('canvas');
    mc.width = W; mc.height = H;
    const mg = mc.getContext('2d');
    mg.drawImage(MASK, 0, 0);
    PIX = {art: art.data, mask: mg.getImageData(0, 0, W, H).data};
    g.clearRect(0, 0, W, H);
  }
  const out = g.createImageData(W, H), o = out.data, a = PIX.art, m = PIX.mask;
  // Each colour, with how much of the grey's light and shade it takes (a pale colour less contrast, so a white
  // jersey's folds don't go grey).
  const T = [kit.J, kit.P, kit.H].map(h => {
    const c = rgbOf(h).map(v => v / 255), l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    return {c, k: 1 - 0.55 * Math.min(1, Math.max(0, (l - 0.55) / 0.35))};
  });
  for (let i = 0; i < o.length; i += 4) {
    o[i] = a[i]; o[i + 1] = a[i + 1]; o[i + 2] = a[i + 2]; o[i + 3] = a[i + 3];
    if (!a[i + 3]) continue;
    const r = m[i], gn = m[i + 1], b = m[i + 2], w = Math.max(r, gn, b);
    if (!w) continue;
    const t = T[r >= gn && r >= b ? 0 : gn >= b ? 1 : 2], wk = w / 255;
    const shade = (0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]) / 127.5, vp = 1 + (shade - 1) * t.k;
    for (let c = 0; c < 3; c++) {
      const tc = t.c[c], v = vp <= 1 ? tc * vp : tc + (1 - tc) * Math.min(1, vp - 1);
      o[i + c] = Math.round(a[i + c] * (1 - wk) + v * 255 * wk);
    }
  }
  g.putImageData(out, 0, 0);
  KITS.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------------------- Which picture
const OL = new Set(['LT', 'LG', 'C', 'RG', 'RT']), DL = new Set(['LDE', 'LDT', 'RDT', 'RDE', 'NT']);
const RUN = {b: 'r_b', f: 'r_f', l: 'r_l', r: 'r_r'};
const hashOf = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; };
/** A player's picture now: {f: frame name ('sheet.pose'), flip}. o: {pose (as drill-cam.js poses him: stand, set,
 *  line, run, bk, tw, tr, ct, dc (a diving, leaping catch), jk (a juke), sw, tk, tl, jd (juked, grasping)), face (b, f, l, r), ph (his stride), ball (he has it), down ('l' | 'r' on
 *  the ground), pre (before the snap), moving}. */
export function pick(pl, o) {
  const off = pl.side === 'o', ol = off && OL.has(pl.slot), dl = !off && DL.has(pl.slot), qb = pl.slot === 'QB';
  const h = hashOf(pl.key), stride = Math.floor((o.ph || 0) / Math.PI) & 1;
  const run = (sheet, face, still) => ({f: `${sheet}.${RUN[face] || 'r_b'}${still ? 0 : stride}`, flip: false});
  const side = (f, face) => ({f, flip: face === 'l'});
  if (off) {
    const carry = o.ball ? (qb ? 'qb' : 'rb') : null, own = carry || (ol ? 'ol' : 'wr');
    if (o.down) return carry ? {f: `${carry}.down`, flip: o.down === 'r'} : {f: 'ol.fallen', flip: o.down === 'l'};
    if (o.pre) return qb ? {f: 'qb.set', flip: false} : ol ? {f: 'ol.stance', flip: false} : {f: 'ol.set', flip: false};
    switch (o.pose) {
      case 'line': return {f: 'ol.stance', flip: false};
      case 'set': return {f: 'ol.set', flip: false};
      case 'bk': return {f: h % 3 ? 'ol.pass' : 'ol.drive', flip: !!(h & 4) && h % 3 === 0};
      case 'tw': return {f: 'qb.windup', flip: false};
      case 'tr': return {f: 'qb.release', flip: false};
      case 'ct': return o.face === 'l' || o.face === 'r' ? side('wr.onehand', o.face) : {f: h & 1 ? 'wr.high' : 'wr.catch', flip: false};
      case 'dc': return o.face === 'l' || o.face === 'r' ? side(h & 1 ? 'wr.onehand' : 'wr.layout', o.face) : {f: 'wr.high', flip: false};
      case 'jk': return {f: h & 1 ? 'rb.juke' : 'rb.spin', flip: o.face === 'r'};
      case 'tk':
        if (qb && o.ball) return {f: 'qb.falling', flip: o.face === 'r'};
        if (o.face === 'b') return {f: 'rb.stiff_b', flip: false};
        if (o.face === 'f') return {f: h & 1 ? 'rb.stiff_f' : 'rb.lunge', flip: false};
        return side('rb.stiff_r', o.face);
      default:
        if (qb && !o.ball && !o.moving) return {f: 'wr.r_b0', flip: false};
        return run(own, o.face, !o.moving);
    }
  }
  if (o.down) return {f: o.tackler ? 'def.dive' : 'def.fallen', flip: o.down === 'l'};
  if (o.pre) return {f: dl ? 'def.stance' : 'def.hands', flip: false};
  switch (o.pose) {
    case 'line': return {f: 'def.stance', flip: false};
    case 'set': return {f: 'def.hands', flip: false};
    case 'bk': return {f: h & 1 ? 'def.swim' : 'def.rip', flip: !!(h & 2)};
    case 'tl': return o.face === 'l' || o.face === 'r' ? side('def.lunge', o.face) : {f: 'def.reach', flip: !!(h & 1)};
    case 'sw': return {f: 'def.leap', flip: !!(h & 1)};
    case 'ct': return {f: 'def.pick', flip: false};
    case 'tk': case 'jd': return {f: 'def.juked', flip: !!(h & 1)};
    default: return run('def', o.face, !o.moving);
  }
}
/** Whether the atlas has a picture by this name ('sheet.pose'). */
export const hasFrame = f => !!FRAMES[f];
/** Whether a pick's picture has the ball in it (so the ball isn't drawn again). */
export const hasBall = p => !!(FRAMES[p.f] && FRAMES[p.f][6]);
/** Draws a pick at (x, y) on g (screen px: his feet), tallPx a runner's height there. */
export function draw(g, p, team, colored, x, y, tallPx) {
  const fr = FRAMES[p.f];
  if (!fr) return false;
  const atlas = atlasFor(kitOf(team, colored)), k = tallPx / TALL;
  g.setTransform(p.flip ? -k : k, 0, 0, k, x, y);
  g.drawImage(atlas, fr[0], fr[1], fr[2], fr[3], -fr[4], -fr[5], fr[2], fr[3]);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}
