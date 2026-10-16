// Two-Minute Drill: each snap seen from behind the offense like a console football game's camera (views/drill.js
// runAnim runs it). A canvas over the field at the screen's own resolution: the stadium (the stands full of fans, the
// suites, the padded wall round the field), the field in true perspective (mowed stripes over grass, the white
// border, the yard lines, hash marks and numbers with their arrows, the end zones with the teams' names, the logo at
// midfield, the line of scrimmage and the line to gain), every player a jointed figure in his team's uniform (seen from
// behind, in front or from either side by the way he's going; his arms and legs swinging through every stride, linemen
// down in their stance before the snap, the play's moments posed, a tackled man on the ground) on his shadow, the
// ball, the goalposts. (The scoreboard is the game screen's header, just above it: views/drill.js.)
// The camera starts straight down over the dots (the top-down field under it, matched yard for yard), swings down
// behind the offense for the play and follows the ball, then swings back up; the canvas fades into the dots.
// open(field, scene) -> cam (or null with no 2D canvas): cam.render(frame), cam.css(x, y, lift), cam.overlay,
// cam.close() (fades out, then removes itself), cam.remove(). chalkMark(side, key): a player's chalk mark on the
// chalkboard (the dots' field, views/drill.js), which the camera starts from.
// Owner: Drill.

const WIDTH = 53.33, MID = 26.67;
// The game camera: its pitch (degrees down), its distance to what it looks at (yards: wide while the ball is behind the
// line, so the passer's drop and throw stay in; pushed in once it's past it or a back has it), its lens (the focal
// length as a share of the canvas width), and how much further than views/drill.js asks it leans toward the ball's
// side. The top-down camera's distance is whatever matches the dots' field.
const CAMS = {pitch: 19, snap: 29, play: 19, lens: 0.6, followX: 1.35};
const NEAR = 0.5;
// Drawn at the screen's resolution, up to this many canvas pixels to a CSS pixel.
const DPR_MAX = 2;
// The stadium: the faces of the wall round the field (and its height), the stands behind it (how far back they go and
// how high they rise).
const WX0 = -9, WX1 = WIDTH + 9, WY0 = -22, WY1 = 122, WALL = 1.2, BACK = 40, RISE = 30;
// A player stands a touch taller than life (yards), so he reads on a phone.
const TALL = 2.2;
const OL = new Set(['LT', 'LG', 'C', 'RG', 'RT']), DL = new Set(['LDE', 'LDT', 'RDT', 'RDE', 'NT']);
const SKINS = ['#F1C9A5', '#E2B084', '#C68A5C', '#A0673F', '#7B4B2A', '#5A3520'];
const FANS = ['#E8E4DA', '#B9BDC8', '#5B6272', '#2A2F3B', '#C9B48E', '#8C2F2F', '#2F4F8C', '#D8D2C2', '#41464F', '#9AA3B5'];
const STROKE = 'rgba(8,10,16,.6)';

const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = u => clamp(u, 0, 1);
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const rgbOf = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x808080; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (h, to, k) => { const a = rgbOf(h), b = rgbOf(to); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };
const lite = (h, k) => mix(h, '#FFFFFF', k), dark = (h, k) => mix(h, '#000000', k);
const luma = h => { const [r, g, b] = rgbOf(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// ---------------------------------------------------------------------------- The chalkboard's marks
// Before the snap the field is a coach's chalkboard (views/drill.js): an O for each man on offense, an X for each on
// defense (its middle left open for his number), drawn by hand: a few takes on each, turned a little, so no two look
// stamped. In a 24-unit box round the player's spot.
const CHALK_O = [
  'M13.2 2.9C18.4 3.1 21.4 7.2 21.2 12.3C21 17.5 17.1 21.2 12 21.1C6.8 21 2.9 17.1 3 11.9C3.1 6.9 6.8 3 11.6 2.8C12.9 2.8 14.3 3.1 15.4 3.7',
  'M11 3C16.3 2.5 20.9 5.9 21.3 11.4C21.7 17 17.6 21.1 12.2 21.3C6.9 21.5 2.8 17.6 2.7 12.4C2.6 7.6 5.6 3.9 10.2 3.1L12.6 2.9',
  'M14.4 3.3C19.3 4.4 21.8 8.6 21 13.4C20.2 18.2 15.9 21.6 11.1 21.1C6 20.6 2.6 16.5 3 11.5C3.4 6.6 7.3 2.9 12.2 2.9C13.3 2.9 14.2 3 15 3.3'
];
const CHALK_X = [
  'M2.6 2.9L7.4 7.6M16.6 16.4L21.3 21.2M21.2 2.7L16.5 7.4M7.5 16.6L2.8 21.4',
  'M2.4 3.4L7.2 7.9M16.8 16.1L21 20.8M20.7 2.3L16.3 7.2M7.8 16.9L3.3 21.6',
  'M3.1 2.3L7.7 7.3M16.2 16.7L20.9 21.6M21.5 3.2L16.7 7.6M7.2 16.3L2.5 20.8'
];
/** A player's chalk mark: {d (the path), rot (degrees)}. side: 'o' | 'd'; key: who he is (the same mark every time). */
export function chalkMark(side, key) {
  const h = hash(String(key));
  return side === 'o' ? {d: CHALK_O[h % 3], rot: (h >>> 4) % 360} : {d: CHALK_X[h % 3], rot: (h >>> 4) % 15 - 7};
}
const marks = new Map();
const markPath = d => { if (!marks.has(d)) marks.set(d, new Path2D(d)); return marks.get(d); };

// ---------------------------------------------------------------------------- Textures (made once)
let NOISE = null;
/** The grass: blades and patches, light and dark, tiling (256 pixels to 4 yards, and a small copy for far off). */
function noiseTex() {
  if (NOISE) return NOISE;
  const N = 256, c = canvasOf(N, N), g = c.getContext('2d'), r = rng(17);
  for (let i = 0; i < 30; i++) {
    const x = r() * N, y = r() * N, rad = 24 + r() * 60, lt = r() < 0.5;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, lt ? 'rgba(235,255,170,.07)' : 'rgba(0,30,0,.09)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  g.lineWidth = 0.9; g.lineCap = 'round';
  for (let i = 0; i < 11000; i++) {
    const x = r() * N, y = r() * N, l = 1.4 + r() * 2.6, a = (r() - 0.5) * 1.1;
    g.strokeStyle = r() < 0.5 ? `rgba(225,255,170,${(0.05 + r() * 0.1).toFixed(3)})` : `rgba(0,28,0,${(0.07 + r() * 0.13).toFixed(3)})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke();
  }
  const s = canvasOf(64, 64), sg = s.getContext('2d');
  sg.drawImage(c, 0, 0, 64, 64);
  NOISE = [c, s];
  return NOISE;
}
let LAMP = null;
/** A light in the stadium's rim, glowing. */
function lampTex() {
  if (LAMP) return LAMP;
  const c = canvasOf(48, 26), g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 13, 0, 24, 13, 24);
  gr.addColorStop(0, 'rgba(255,252,235,1)'); gr.addColorStop(0.22, 'rgba(255,248,220,.95)'); gr.addColorStop(0.5, 'rgba(255,240,200,.3)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 48, 26);
  LAMP = c;
  return c;
}
let DIGITS = null;
/** The field's numbers: a white digit 4 feet wide and 6 tall (100 x 150 pixels). */
function digitTex() {
  if (DIGITS) return DIGITS;
  DIGITS = {};
  for (let d = 0; d <= 9; d++) {
    const c = canvasOf(100, 150), g = c.getContext('2d');
    g.font = `800 188px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const m = g.measureText(String(d)), w = m.width || 100, asc = m.actualBoundingBoxAscent || 136;
    g.save();
    g.translate(50, 146);
    g.scale(Math.min(1, 92 / w), 142 / asc);
    g.fillStyle = 'rgba(255,255,255,.93)';
    g.fillText(String(d), 0, 0);
    g.restore();
    DIGITS[d] = c;
  }
  return DIGITS;
}
const NAMES = new Map();
/** A team's name for its end zone: big block letters in its colour, outlined in white. */
function nameTex(name, col) {
  const key = `${name}|${col}`;
  if (NAMES.has(key)) return NAMES.get(key);
  const text = String(name || '').toUpperCase();
  const c = canvasOf(1400, 240), g = c.getContext('2d');
  g.font = `900 200px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const w = g.measureText(text).width || 1000;
  g.save();
  g.translate(700, 212);
  g.scale(Math.min(1.25, 1340 / w), 1);
  g.lineJoin = 'round';
  g.lineWidth = 22; g.strokeStyle = 'rgba(255,255,255,.92)'; g.strokeText(text, 0, 0);
  g.fillStyle = luma(col) > 0.82 ? '#2A2F3B' : col; g.fillText(text, 0, 0);
  g.restore();
  NAMES.set(key, c);
  return c;
}
const CROWDS = new Map();
/** The stands: rows of fans (most in the two teams' colours), a band of suites, the upper deck darker. The front row is
 *  at the bottom. */
function crowdTex(cols) {
  const key = cols.join('');
  if (CROWDS.has(key)) return CROWDS.get(key);
  const Wt = 768, Ht = 384, c = canvasOf(Wt, Ht), g = c.getContext('2d'), r = rng(hash(key));
  g.fillStyle = '#171B24'; g.fillRect(0, 0, Wt, Ht);
  const RH = 12, rows = Ht / RH;
  for (let row = 0; row < rows; row++) {
    const y = Ht - (row + 1) * RH;
    if (row >= 13 && row <= 15) continue;
    g.fillStyle = row % 2 ? '#1E232D' : '#1A1E27'; g.fillRect(0, y, Wt, RH);
    for (let x = r() * 4; x < Wt - 3; x += 5 + r() * 2.6) {
      if (r() < 0.06) continue;
      const shirt = r() < 0.58 ? cols[r() < 0.62 ? 0 : 1] : FANS[Math.floor(r() * FANS.length)];
      g.fillStyle = shirt; g.fillRect(x, y + 5.2, 4.5, 6.8);
      g.fillStyle = SKINS[Math.floor(r() * SKINS.length)];
      g.beginPath(); g.arc(x + 2.25, y + 3.9, 1.9, 0, Math.PI * 2); g.fill();
      if (r() < 0.05) { g.fillStyle = shirt; g.fillRect(x - 0.8, y - 1.5, 1.5, 5.2); g.fillRect(x + 3.8, y - 1.5, 1.5, 5.2); }
    }
  }
  // The suites: dark glass, warm lights, a stripe in the home colour.
  const sy = Ht - 16 * RH, sh = 3 * RH;
  g.fillStyle = '#0E1118'; g.fillRect(0, sy, Wt, sh);
  g.fillStyle = cols[0]; g.fillRect(0, sy + sh - 5, Wt, 5);
  for (let x = 3; x < Wt; x += 16.5) {
    g.fillStyle = r() < 0.7 ? 'rgba(255,214,150,.55)' : 'rgba(150,180,220,.35)';
    g.fillRect(x, sy + 6, 12.8, sh - 16.5);
  }
  // Light falls off up the stands.
  const sh2 = g.createLinearGradient(0, 0, 0, Ht);
  sh2.addColorStop(0, 'rgba(4,6,10,.38)'); sh2.addColorStop(0.45, 'rgba(4,6,10,.12)'); sh2.addColorStop(1, 'rgba(4,6,10,0)');
  g.fillStyle = sh2; g.fillRect(0, 0, Wt, Ht);
  CROWDS.set(key, c);
  return c;
}

// ---------------------------------------------------------------------------- Players
// A player is a jointed figure: hips, knees, ankles and toes, shoulders, elbows and hands, his neck and head, placed in
// 3D in units (100 tall; x to his right, y the way he faces, z up, his feet on the ground) for a pose (standing, set,
// a lineman's stance, any point of his stride, or one of a play's moments), then seen from one of four sides (from
// behind, in front, his right side or his left side to the camera) and drawn limb by limb, far ones first. Drawn
// fresh every frame, so a stride is smooth and arms and legs swing through it.
function kitOf(team, colored) {
  const [c0, c1] = team;
  const trim = luma(c1) > 0.85 && luma(c0) > 0.85 ? '#333333' : c1;
  return colored
    ? {jersey: c0, num: '#FFFFFF', edge: trim, helmet: c0, stripe: '#FFFFFF', pants: luma(c0) < 0.25 ? '#E9E6DE' : '#F2F0EA', pstripe: c0, sock: c0, glove: '#FFFFFF', mask: '#D8DADF'}
    : {jersey: '#F5F5F2', num: c0, edge: trim, helmet: c0, stripe: trim, pants: c0, pstripe: '#FFFFFF', sock: c0, glove: luma(c0) < 0.3 ? '#F2F2F2' : '#202020', mask: '#C9CCD3'};
}
function strokeFill(g, fill) { g.fillStyle = fill; g.fill(); g.strokeStyle = STROKE; g.lineWidth = 1.3; g.stroke(); }
function limb(g, ax, ay, bx, by, w, col) {
  g.lineCap = 'round';
  g.strokeStyle = STROKE; g.lineWidth = w + 2.4; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
}
const NUMS = new Map();
/** A jersey number, drawn once (96 x 64 pixels: the digits in the kit's colour, outlined in its trim). */
function numImg(K, j) {
  const key = `${K.num}|${K.edge}|${j}`;
  if (NUMS.has(key)) return NUMS.get(key);
  const c = canvasOf(96, 64), g = c.getContext('2d');
  g.translate(48, 34);
  g.scale(String(j).length > 1 ? 0.8 : 0.9, 1);
  g.font = `800 58px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = K.edge; g.strokeText(String(j), 0, 2);
  g.fillStyle = K.num; g.fillText(String(j), 0, 2);
  NUMS.set(key, c);
  return c;
}
/** The helmet from behind or in front (shell, stripe or facemask, the shine), units round (x, y). */
function helmet(g, K, x, y, front, r = 1) {
  const rx = 10 * r, ry = 11 * r;
  const gr = g.createRadialGradient(x - 4 * r, y - 5 * r, 1, x, y, 13 * r);
  gr.addColorStop(0, lite(K.helmet, 0.5)); gr.addColorStop(0.42, K.helmet); gr.addColorStop(1, dark(K.helmet, 0.4));
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); strokeFill(g, gr);
  g.save();
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.clip();
  if (front) {
    g.fillStyle = 'rgba(18,12,8,.92)';
    g.beginPath(); g.roundRect(x - 6.6 * r, y - 3.2 * r, 13.2 * r, 13 * r, 3 * r); g.fill();
    g.fillStyle = K.skin; g.globalAlpha = 0.55; g.fillRect(x - 4.6 * r, y + 1 * r, 9.2 * r, 6 * r); g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 10 * r, y + 8.5 * r, 20 * r, 4 * r);
  } else {
    g.fillStyle = K.stripe; g.fillRect(x - 1.7 * r, y - ry, 3.4 * r, ry * 2);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - rx, y + 7 * r, rx * 2, 5 * r);
  }
  g.restore();
  if (front) {
    g.strokeStyle = K.mask; g.lineWidth = 1.5 * r; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 6.4 * r, y + 1.2 * r); g.lineTo(x + 6.4 * r, y + 1.2 * r);
    g.moveTo(x - 5.6 * r, y + 5.4 * r); g.lineTo(x + 5.6 * r, y + 5.4 * r);
    g.moveTo(x, y + 1.2 * r); g.lineTo(x, y + 9.6 * r);
    g.moveTo(x - 6.4 * r, y - 1 * r); g.lineTo(x - 5 * r, y + 8.4 * r);
    g.moveTo(x + 6.4 * r, y - 1 * r); g.lineTo(x + 5 * r, y + 8.4 * r);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.beginPath(); g.ellipse(x - 4.2 * r, y - 6.2 * r, 2.8 * r, 1.6 * r, -0.5, 0, Math.PI * 2); g.fill();
}
/** The helmet in profile, facing dir (1: right, -1: left): the shell, the stripe over the crown, the decal, the ear
 *  hole, the face in its shade and the facemask out front. */
function helmetSide(g, K, x, y, dir) {
  const gr = g.createRadialGradient(x - 3 * dir, y - 5, 1, x, y, 13);
  gr.addColorStop(0, lite(K.helmet, 0.5)); gr.addColorStop(0.42, K.helmet); gr.addColorStop(1, dark(K.helmet, 0.4));
  g.beginPath(); g.ellipse(x - 1 * dir, y, 10.6, 10.4, 0, 0, Math.PI * 2); strokeFill(g, gr);
  g.save();
  g.beginPath(); g.ellipse(x - 1 * dir, y, 10.6, 10.4, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(18,12,8,.9)';
  g.beginPath(); g.moveTo(x + 9.8 * dir, y - 3); g.lineTo(x + 3.5 * dir, y - 2); g.lineTo(x + 3 * dir, y + 7); g.lineTo(x + 9.8 * dir, y + 10); g.closePath(); g.fill();
  g.fillStyle = K.skin; g.globalAlpha = 0.6; g.fillRect(dir > 0 ? x + 5 : x - 9, y, 4, 6); g.globalAlpha = 1;
  g.restore();
  g.strokeStyle = K.stripe; g.lineWidth = 3; g.lineCap = 'butt';
  g.beginPath(); g.ellipse(x - 1 * dir, y, 9.2, 9, 0, dir > 0 ? Math.PI * 1.08 : Math.PI * 1.52, dir > 0 ? Math.PI * 1.48 : Math.PI * 1.92); g.stroke();
  g.fillStyle = K.stripe; g.globalAlpha = 0.9; g.beginPath(); g.arc(x - 3 * dir, y - 1.5, 3.2, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(x - 1.5 * dir, y + 3.5, 1.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = K.mask; g.lineWidth = 1.5; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x + 7 * dir, y - 1); g.quadraticCurveTo(x + 13 * dir, y + 1, x + 11 * dir, y + 9);
  g.moveTo(x + 7 * dir, y + 3.5); g.lineTo(x + 12.4 * dir, y + 3.5);
  g.moveTo(x + 6 * dir, y + 8); g.lineTo(x + 11 * dir, y + 8);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath(); g.ellipse(x - 2 * dir, y - 6, 3, 1.6, -0.4 * dir, 0, Math.PI * 2); g.fill();
}

const RUN = 2.3; // yards a full stride (two steps) covers
const v3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
/** A leg from the hip: the thigh swung forward by thigh (radians), the knee bent by bend, the foot out by spread. */
function legOf(hip, thigh, bend, spread) {
  const k = [hip[0] + spread * 0.4, hip[1] + 25 * Math.sin(thigh), hip[2] - 25 * Math.cos(thigh)];
  const sa = thigh - bend;
  const a = [hip[0] + spread, k[1] + 21 * Math.sin(sa), k[2] - 21 * Math.cos(sa)];
  return {h: hip, k, a, t: [a[0], a[1] + 9 * Math.cos(sa), a[2] + 9 * Math.sin(sa) - 1]};
}
/** An arm from the shoulder: swung forward by fwd (radians from hanging), out to the side by out, the elbow bent by
 *  bend (a bent arm's hand comes in toward the middle). side: -1 left, 1 right. */
function armOf(sh, side, fwd, out, bend) {
  const e = [sh[0] + side * 14.5 * Math.sin(out), sh[1] + 14.5 * Math.sin(fwd) * Math.cos(out), sh[2] - 14.5 * Math.cos(fwd) * Math.cos(out)];
  const fa = fwd + bend;
  return {s: sh, e, h: [e[0] + side * 3 * Math.sin(out) - side * 3.5 * Math.sin(Math.min(bend, 1.6)), e[1] + 13.5 * Math.sin(fa), e[2] - 13.5 * Math.cos(fa)]};
}
/** A pose's body in 3D. pose: stand, set, line (a lineman's three-point stance), run, or a play's moment (tw, tr, bk,
 *  ct, sw, tk, tl); ph: where he is in his stride (radians); Wd: how broad he is. */
function bodyOf(pose, ph, Wd) {
  let lean = 0.04, legs, arms;
  const hipZ = 50, P = [0, 0, hipZ], hip = [[-6.5 * Wd, 0, hipZ], [6.5 * Wd, 0, hipZ]];
  const stride = (i, amp = 1) => { const q = ph + (i ? Math.PI : 0); return legOf(hip[i], 0.55 * amp * Math.sin(q), 0.3 + 1.35 * amp * Math.pow(Math.max(0, Math.cos(q)), 1.3), i ? 1.2 : -1.2); };
  const runLegs = (amp = 1) => [stride(0, amp), stride(1, amp)];
  if (pose === 'run' || pose === 'ct' || pose === 'sw' || pose === 'tk') { lean = pose === 'tk' ? 0.8 : pose === 'ct' ? 0.1 : 0.22; legs = runLegs(pose === 'tk' ? 0.8 : 1); }
  else if (pose === 'set') { lean = 0.4; legs = [legOf(hip[0], 0.45, 0.95, -3.5), legOf(hip[1], 0.45, 0.95, 3.5)]; }
  else if (pose === 'line') { lean = 1.25; legs = [legOf(hip[0], 1.0, 1.8, -6), legOf(hip[1], 0.85, 1.6, 6)]; }
  else if (pose === 'bk') { lean = 0.5; legs = [legOf(hip[0], 0.5, 1.05, -5.5), legOf(hip[1], 0.35, 0.85, 5.5)]; }
  else if (pose === 'tw') { lean = -0.06; legs = [legOf(hip[0], 0.34, 0.15, -2.5), legOf(hip[1], -0.3, 0.35, 2.5)]; }
  else if (pose === 'tr') { lean = 0.26; legs = [legOf(hip[0], 0.3, 0.2, -2), legOf(hip[1], -0.6, 1.05, 2)]; }
  else if (pose === 'tl') { lean = 1.2; legs = [legOf(hip[0], -0.7, 0.35, -2), legOf(hip[1], 0.25, 1.35, 2)]; }
  else legs = [legOf(hip[0], 0.02, 0.06, -1.2), legOf(hip[1], -0.02, 0.06, 1.2)];
  const N = [0, 28 * Math.sin(lean), hipZ + 28 * Math.cos(lean)];
  const sh = [[-17 * Wd, N[1], N[2] - 3], [17 * Wd, N[1], N[2] - 3]];
  const head = [0, N[1] + 11 * Math.sin(lean * 0.55), N[2] + 11 * Math.cos(lean * 0.55)];
  let ball = -1;
  if (pose === 'run') {
    // Arms pump against the legs: the left arm comes through with the right leg.
    arms = [0, 1].map(i => { const q = ph + (i ? 0 : Math.PI); return armOf(sh[i], i ? 1 : -1, 0.8 * Math.sin(q) - 0.1, 0.22, 1.3 + 0.3 * Math.cos(q)); });
  } else if (pose === 'set') arms = [armOf(sh[0], -1, 0.8, 0.15, 0.05), armOf(sh[1], 1, 0.8, 0.15, 0.05)];
  else if (pose === 'line') arms = [armOf(sh[0], -1, 0.9, 0.15, 0.6), armOf(sh[1], 1, 1.32, 0.05, -0.05)];
  else if (pose === 'bk') arms = [armOf(sh[0], -1, 1.4, 0.25, 0.25), armOf(sh[1], 1, 1.4, 0.25, 0.25)];
  else if (pose === 'tw') {
    // The ball cocked by his ear, the front arm out toward the target.
    const e = v3(sh[1], [3, -7, 9]);
    arms = [armOf(sh[0], -1, 1.25, 0.3, 0.4), {s: sh[1], e, h: v3(e, [-1, -5, 12])}];
    ball = 1;
  } else if (pose === 'tr') {
    const e = v3(sh[1], [-3, 11, 8]);
    arms = [armOf(sh[0], -1, -0.35, 0.25, 1.0), {s: sh[1], e, h: v3(e, [-4, 11, -1])}];
  } else if (pose === 'ct') arms = [armOf(sh[0], -1, 2.55, 0.25, 0.45), armOf(sh[1], 1, 2.55, 0.25, 0.45)];
  else if (pose === 'sw') arms = [armOf(sh[0], -1, -0.4, 0.2, 0.9), armOf(sh[1], 1, 2.95, 0.45, 0.05)];
  else if (pose === 'tk') arms = [armOf(sh[0], -1, 1.0, 0.3, 0.2), armOf(sh[1], 1, 0.25, 0.05, 2.1)];
  else if (pose === 'tl') arms = [armOf(sh[0], -1, 1.55, 0.55, 0.25), armOf(sh[1], 1, 1.55, 0.55, 0.25)];
  else arms = [armOf(sh[0], -1, 0.08, 0.2, 0.3), armOf(sh[1], 1, 0.08, 0.2, 0.3)];
  // On the ground: the lowest foot (or the hand on the turf) touches it.
  let low = Infinity;
  legs.forEach(L => { low = Math.min(low, L.a[2] - 5, L.t[2] - 1.5); });
  if (pose === 'line') low = Math.min(low, arms[1].h[2] - 2);
  const dz = -low, up = q => [q[0], q[1], q[2] + dz];
  return {P: up(P), N: up(N), head: up(head), sh: sh.map(up), lean,
    legs: legs.map(L => ({h: up(L.h), k: up(L.k), a: up(L.a), t: up(L.t)})),
    arms: arms.map(A => ({s: up(A.s), e: up(A.e), h: up(A.h)})), ball};
}
/** A body point seen from a side: [x, y on screen (units, up negative), how near the camera]. From an elevated camera,
 *  what's nearer sits a little lower. view: b (from behind), f (in front), r (his right side to us, facing right), l. */
function seen(view, q) {
  const [x, y, z] = q;
  if (view === 'b') return [x, -z - y * 0.22, -y];
  if (view === 'f') return [-x, -z + y * 0.22, y];
  if (view === 'r') return [y, -z + x * 0.18, x];
  return [-y, -z - x * 0.18, -x];
}
/** One player, drawn in units round his feet (the caller sets the transform). */
function drawFigure(g, pl, view, pose, ph) {
  const K = pl.kitS || (pl.kitS = Object.assign({skin: pl.skin}, pl.kit)), Wd = pl.line ? 1.13 : 1;
  const B = bodyOf(pose, ph, Wd), see = q => seen(view, q), side = view === 'r' || view === 'l', dir = view === 'l' ? -1 : 1;
  const parts = [];
  B.legs.forEach(L => {
    const h = see(L.h), k = see(L.k), a = see(L.a), t = see(L.t);
    parts.push({d: (h[2] + k[2] + a[2]) / 3 + (side ? 0 : -0.5), draw: () => {
      limb(g, k[0], k[1], a[0], a[1], 7.4, K.sock);
      g.strokeStyle = '#F1F1F1'; g.lineWidth = 7.4; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(a[0] + (k[0] - a[0]) * 0.18, a[1] + (k[1] - a[1]) * 0.18); g.lineTo(a[0], a[1]); g.stroke();
      limb(g, a[0], a[1], t[0], t[1], 5.2, '#18191D');
      limb(g, h[0], h[1], k[0] + (k[0] - h[0]) * 0.08, k[1] + (k[1] - h[1]) * 0.08, 11.5, K.pants);
      g.strokeStyle = K.pstripe; g.lineWidth = 1.7; g.lineCap = 'butt';
      const o = side ? 0 : (h[0] < 0 ? -4.6 : 4.6);
      g.beginPath(); g.moveTo(h[0] + o, h[1] + 2); g.lineTo(k[0] + o * 0.8, k[1] - 2); g.stroke();
    }});
  });
  B.arms.forEach((A, i) => {
    const s = see(A.s), e = see(A.e), h = see(A.h);
    parts.push({d: (s[2] + e[2] + h[2]) / 3, draw: () => {
      limb(g, s[0], s[1], e[0], e[1], 7.2, K.skin);
      limb(g, e[0], e[1], h[0], h[1], 6.2, K.skin);
      limb(g, s[0], s[1] - 1, s[0] + (e[0] - s[0]) * 0.42, s[1] + (e[1] - s[1]) * 0.42, 9, K.jersey);
      g.beginPath(); g.arc(h[0], h[1], 3.6, 0, Math.PI * 2); strokeFill(g, K.glove);
      if (B.ball === i) {
        g.save(); g.translate(h[0], h[1] - 3.5); g.rotate(-0.5);
        g.beginPath(); g.ellipse(0, 0, 5.4, 3.3, 0, 0, Math.PI * 2); strokeFill(g, '#8A4318');
        g.strokeStyle = '#F4F1EA'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-2, -1); g.lineTo(2, -1); g.stroke();
        g.restore();
      }
    }});
  });
  // The torso: the jersey over the pads from behind or in front (his number on it), or in profile; the seat of his
  // pants under it.
  const P = see(B.P), N = see(B.N), L = see(B.sh[0]), R = see(B.sh[1]), HL = see(B.legs[0].h), HR = see(B.legs[1].h);
  parts.push({d: 0, draw: () => {
    if (!side) {
      g.beginPath(); g.ellipse((HL[0] + HR[0]) / 2, (HL[1] + HR[1]) / 2 + 2, Math.abs(HR[0] - HL[0]) / 2 + 6, 8, 0, 0, Math.PI * 2); strokeFill(g, K.pants);
      const [a, b] = L[0] < R[0] ? [L, R] : [R, L], [ha, hb] = HL[0] < HR[0] ? [HL, HR] : [HR, HL];
      g.beginPath();
      g.moveTo(a[0] - 3, a[1] + 8); g.quadraticCurveTo(a[0] - 3, a[1] - 1, a[0] + 6, a[1] - 2);
      g.lineTo(b[0] - 6, b[1] - 2); g.quadraticCurveTo(b[0] + 3, b[1] - 1, b[0] + 3, b[1] + 8);
      g.lineTo(hb[0] + 5.5, hb[1] - 1); g.lineTo(ha[0] - 5.5, ha[1] - 1); g.closePath();
      const jg = g.createLinearGradient(a[0], a[1], b[0], hb[1]);
      jg.addColorStop(0, lite(K.jersey, 0.16)); jg.addColorStop(0.55, K.jersey); jg.addColorStop(1, dark(K.jersey, 0.26));
      strokeFill(g, jg);
      g.fillStyle = dark(K.pants, 0.5); g.fillRect(ha[0] - 5, (ha[1] + hb[1]) / 2 - 2.5, hb[0] - ha[0] + 10, 2.5);
      if (pl.j != null && pl.j !== '') {
        const top = (a[1] + b[1]) / 2, bot = (ha[1] + hb[1]) / 2, ht = clamp((bot - top) * (view === 'b' ? 0.62 : 0.42), 5, 19);
        const cx = (a[0] + b[0]) / 2, cy = top + (bot - top) * (view === 'b' ? 0.42 : 0.36);
        g.drawImage(numImg(K, pl.j), cx - ht * 0.75, cy - ht * 0.5, ht * 1.5, ht);
      }
    } else {
      g.beginPath(); g.ellipse(P[0] - dir * 1.5, P[1] + 1, 11, 9.5, 0, 0, Math.PI * 2); strokeFill(g, K.pants);
      const vx = N[0] - P[0], vy = N[1] - P[1], len = Math.hypot(vx, vy) || 1, ux = vx / len, uy = vy / len;
      let nx = -uy, ny = ux;
      if (nx * dir < 0) { nx = -nx; ny = -ny; }
      const pt = (base, u, n) => [base[0] + ux * u + nx * n, base[1] + uy * u + ny * n];
      // In profile he's deep through the chest and the pads, the pads riding up over the shoulders.
      const A = pt(P, 1, 9), Bp = pt(N, -9, 12.5), C = pt(N, 2.5, 7.5), D = pt(N, 3.5, -6.5), E = pt(N, -7, -12.5), F = pt(P, 1, -10.5);
      g.beginPath();
      g.moveTo(A[0], A[1]); g.lineTo(Bp[0], Bp[1]); g.quadraticCurveTo(...pt(N, 1, 13), C[0], C[1]);
      g.lineTo(D[0], D[1]); g.quadraticCurveTo(...pt(N, 1, -13.5), E[0], E[1]); g.lineTo(F[0], F[1]); g.closePath();
      const jg = g.createLinearGradient(...pt(N, 0, -13), ...pt(P, 0, 10));
      jg.addColorStop(0, dark(K.jersey, 0.2)); jg.addColorStop(0.5, K.jersey); jg.addColorStop(1, lite(K.jersey, 0.1));
      strokeFill(g, jg);
      g.fillStyle = dark(K.pants, 0.5);
      const w0 = pt(P, 2.5, 9), w1 = pt(P, 2.5, -10.5);
      g.strokeStyle = dark(K.pants, 0.5); g.lineWidth = 2.5; g.beginPath(); g.moveTo(w0[0], w0[1]); g.lineTo(w1[0], w1[1]); g.stroke();
      if (pl.j != null && pl.j !== '') { const c = pt(N, -9, -1); g.drawImage(numImg(K, pl.j), c[0] - 6, c[1] - 4, 12, 8); }
    }
    g.fillStyle = dark(K.skin, 0.2);
    g.beginPath(); g.arc(N[0], N[1], 3.6, 0, Math.PI * 2); g.fill();
  }});
  const Hd = see(B.head);
  parts.push({d: Hd[2] + 0.1, draw: () => (side ? helmetSide(g, K, Hd[0], Hd[1], dir) : helmet(g, K, Hd[0], Hd[1], view === 'f'))});
  parts.sort((x, y) => x.d - y.d).forEach(x => x.draw());
}

// ---------------------------------------------------------------------------- The camera
/** u: 0 straight down (matching the dots' field), 1 behind the offense. target: the ground point it looks at. */
function cameraAt(V, u, tx, ty, dist) {
  const e = smooth(u);
  const th = (90 + (V.pitch - 90) * e) * Math.PI / 180;
  const D = V.D0 + (dist - V.D0) * e;
  const sn = Math.sin(th), cs = Math.cos(th);
  return {sn, cs, cx: tx, cy: ty - D * cs, cz: D * sn, vs: V.vs0 + (1 - V.vs0) * e};
}
const toCam = (c, x, y, z) => { const dy = y - c.cy, dz = z - c.cz; return [x - c.cx, dy * c.sn + dz * c.cs, dy * c.cs - dz * c.sn]; };

export function open(field, scene) {
  const cssW = field.clientWidth, cssH = field.clientHeight;
  if (!cssW || !cssH) return null;
  const S = Math.min(DPR_MAX, window.devicePixelRatio || 1); // canvas pixels per CSS pixel
  const W = Math.round(cssW * S), H = Math.round(cssH * S);
  const wrap = document.createElement('div');
  wrap.className = 'dr-cam';
  wrap.setAttribute('aria-hidden', 'true');
  const cv = canvasOf(W, H);
  const g = cv.getContext('2d');
  if (!g) return null;
  const overlay = document.createElement('div');
  overlay.className = 'dr-cam-co';
  wrap.append(cv, overlay);
  field.appendChild(wrap);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  // The dots' field: 53.3 yards across 92% of the width, 36 yards top to bottom (stretched: vs0 squares it up).
  const C = Object.assign({}, CAMS, window.__DR_CAM || {});
  const F = C.lens * W, hppy = 0.92 * W / WIDTH, vppy = H / 36;
  const V = {D0: F / hppy, vs0: vppy / hppy, pitch: C.pitch};
  const players = scene.players.map(pl => {
    const kit = kitOf(pl.team, pl.colored), line = (pl.side === 'o' ? OL : DL).has(pl.slot);
    return Object.assign({}, pl, {kit, line, kitKey: `${pl.team.join('')}${pl.colored ? 'c' : 'w'}`, skin: SKINS[hash(pl.n || pl.key) % SKINS.length]});
  });
  const [noiseBig, noiseSmall] = noiseTex();
  const pats = [g.createPattern(noiseBig, 'repeat'), g.createPattern(noiseSmall, 'repeat')];
  const crowd = crowdTex(scene.crowd.slice(0, 2));
  const names = {near: nameTex(scene.ends.near.name, scene.ends.near.c), far: nameTex(scene.ends.far.name, scene.ends.far.c)};
  let logo = null;
  if (scene.logo) {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { logo = im; };
    im.src = scene.logo;
  }
  const motion = new Map(); // key -> {x, y, vx, vy, ph, face}
  // The play's moments by player: key -> [{a (a pose), t0, t1}].
  const acts = new Map();
  (scene.acts || []).forEach(x => { if (!acts.has(x.key)) acts.set(x.key, []); acts.get(x.key).push(x); });
  let cam = null, fx = null, fy = null, last = 0, closed = false, prevBall = null, pushK = null;

  const proj = (x, y, z) => {
    const [xc, yc, zc] = toCam(cam, x, y, z);
    if (zc < NEAR) return null;
    const k = F / zc;
    return [W / 2 + xc * k, H / 2 - yc * k * cam.vs, k];
  };
  /** A polygon of world points, clipped at the near plane, onto the current path. */
  const poly = pts => {
    const v = pts.map(([x, y, z]) => toCam(cam, x, y, z)), out = [];
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) { const k = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, NEAR]); }
    }
    if (out.length < 3) return false;
    out.forEach(([xc, yc, zc], i) => { const k = F / zc, sx = W / 2 + xc * k, sy = H / 2 - yc * k * cam.vs; if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
    g.closePath();
    return true;
  };
  const rect = (x0, y0, x1, y1, z = 0) => poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
  const fillWith = (col, fn) => { g.beginPath(); fn(); g.fillStyle = col; g.fill(); };
  /** The nearest ground y in front of the camera (nothing nearer is on screen). */
  const groundNear = () => (cam.cs < 0.05 ? -Infinity : cam.cy + (NEAR + 0.6 - cam.cz * cam.sn) / cam.cs);
  /** An image laid on a flat world parallelogram: its top-left at o, its top edge along ex, its left edge along ey
   *  (world vectors), cut into strips along ey so the perspective holds. */
  const lay = (img, o, ex, ey, strips = 1, sx = 0, sy = 0, sw = img.width, sh = img.height) => {
    for (let i = 0; i < strips; i++) {
      const a = i / strips, b = (i + 1) / strips;
      const p0 = [o[0] + ey[0] * a, o[1] + ey[1] * a, o[2] + ey[2] * a];
      const P0 = proj(...p0), P1 = proj(p0[0] + ex[0], p0[1] + ex[1], p0[2] + ex[2]), P2 = proj(o[0] + ey[0] * b, o[1] + ey[1] * b, o[2] + ey[2] * b);
      if (!P0 || !P1 || !P2) continue;
      const h = sh * (b - a);
      const pad = i < strips - 1 ? 1.012 : 1; // a hair of overlap so the strips meet
      g.setTransform((P1[0] - P0[0]) / sw, (P1[1] - P0[1]) / sw, (P2[0] - P0[0]) / h * pad, (P2[1] - P0[1]) / h * pad, P0[0], P0[1]);
      g.drawImage(img, sx, sy + sh * a, sw, h, 0, 0, sw, h);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  };
  /** A 3D line as a quad of world width w (yards). */
  const bar = (a, b, w, col) => {
    const A = proj(...a), B = proj(...b);
    if (!A || !B) return;
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const wa = Math.max(0.8, w * A[2] / 2), wb = Math.max(0.8, w * B[2] / 2);
    g.beginPath();
    g.moveTo(A[0] + nx * wa, A[1] + ny * wa); g.lineTo(B[0] + nx * wb, B[1] + ny * wb);
    g.lineTo(B[0] - nx * wb, B[1] - ny * wb); g.lineTo(A[0] - nx * wa, A[1] - ny * wa);
    g.closePath(); g.fillStyle = col; g.fill();
  };

  function drawStadium() {
    // The sky over the rim is the wrapper's own background (drill.css).
    g.clearRect(0, 0, W, H);
    // The stands: far, left and right, rising from the wall; under them, a dark fill so their tiles meet cleanly.
    const far = [[WX0 - BACK, WY1 + BACK, RISE], [WX1 + BACK, WY1 + BACK, RISE], [WX1, WY1, WALL], [WX0, WY1, WALL]];
    const left = [[WX0 - BACK, WY0 - BACK * 0.3, RISE], [WX0 - BACK, WY1 + BACK, RISE], [WX0, WY1, WALL], [WX0, WY0, WALL]];
    const right = [[WX1 + BACK, WY1 + BACK, RISE], [WX1 + BACK, WY0 - BACK * 0.3, RISE], [WX1, WY0, WALL], [WX1, WY1, WALL]];
    fillWith('#171B24', () => { poly(far); poly(left); poly(right); });
    // The crowd laid over each: 40 yards of fans to a tile, cut finer where the stands run away from the camera.
    const tileFace = (b0, b1, t0, t1, tiles, cuts) => {
      for (let i = 0; i < tiles * cuts; i++) {
        const a = i / (tiles * cuts), b = (i + 1) / (tiles * cuts);
        const at = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
        const tl = at(t0, t1, a), tr = at(t0, t1, b), bl = at(b0, b1, a);
        const u0 = (i % cuts) / cuts, sw = crowd.width / cuts;
        const P0 = proj(...tl), P1 = proj(...tr), P2 = proj(...bl);
        if (!P0 || !P1 || !P2) continue;
        const xs = [P0[0], P1[0], P2[0], P1[0] + P2[0] - P0[0]], ys = [P0[1], P1[1], P2[1], P1[1] + P2[1] - P0[1]];
        if (Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H) continue;
        g.setTransform((P1[0] - P0[0]) / sw * 1.01, (P1[1] - P0[1]) / sw * 1.01, (P2[0] - P0[0]) / crowd.height, (P2[1] - P0[1]) / crowd.height, P0[0], P0[1]);
        g.drawImage(crowd, crowd.width * u0, 0, sw, crowd.height, 0, 0, sw, crowd.height);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    };
    tileFace(far[3], far[2], far[0], far[1], 3, 2);
    tileFace(left[3], left[2], left[0], left[1], 4, 4);
    tileFace(right[2], right[3], right[1], right[0], 4, 4);
    // The rim: a lip of roof along the top of the stands, its banks of lights.
    const rimZ = RISE + 3.2, rimC = '#2B303B';
    fillWith(rimC, () => {
      poly([[WX0 - BACK, WY1 + BACK, RISE], [WX1 + BACK, WY1 + BACK, RISE], [WX1 + BACK, WY1 + BACK, rimZ], [WX0 - BACK, WY1 + BACK, rimZ]]);
      poly([[WX0 - BACK, WY0 - BACK * 0.3, RISE], [WX0 - BACK, WY1 + BACK, RISE], [WX0 - BACK, WY1 + BACK, rimZ], [WX0 - BACK, WY0 - BACK * 0.3, rimZ]]);
      poly([[WX1 + BACK, WY0 - BACK * 0.3, RISE], [WX1 + BACK, WY1 + BACK, RISE], [WX1 + BACK, WY1 + BACK, rimZ], [WX1 + BACK, WY0 - BACK * 0.3, rimZ]]);
    });
    const glow = lampTex();
    const lamp = (x, y) => {
      const p = proj(x, y, RISE + 1.8);
      if (!p || p[0] < -20 || p[0] > W + 20 || p[1] < -20 || p[1] > H) return;
      const r = clamp(0.55 * p[2], 1, 4 * S);
      g.drawImage(glow, p[0] - r * 3, p[1] - r * 1.6, r * 6, r * 3.2);
    };
    for (let x = WX0 - BACK + 6; x < WX1 + BACK; x += 9) lamp(x, WY1 + BACK);
    for (let y = WY0; y < WY1 + BACK; y += 9) { lamp(WX0 - BACK, y); lamp(WX1 + BACK, y); }
    // The wall round the field: padded, in the home team's colour, a light line along its top.
    const wc = dark(scene.crowd[0], 0.35);
    fillWith(wc, () => {
      poly([[WX0, WY1, 0], [WX1, WY1, 0], [WX1, WY1, WALL], [WX0, WY1, WALL]]);
      poly([[WX0, WY0, 0], [WX0, WY1, 0], [WX0, WY1, WALL], [WX0, WY0, WALL]]);
      poly([[WX1, WY0, 0], [WX1, WY0, WALL], [WX1, WY1, WALL], [WX1, WY1, 0]]);
    });
    g.globalAlpha = 0.75;
    bar([WX0, WY1, WALL], [WX1, WY1, WALL], 0.14, '#E8ECF2');
    bar([WX0, WY0, WALL], [WX0, WY1, WALL], 0.14, '#E8ECF2');
    bar([WX1, WY0, WALL], [WX1, WY1, WALL], 0.14, '#E8ECF2');
    g.globalAlpha = 1;
  }
  function drawGround() {
    const yn = groundNear();
    // The grass out to the wall, then the field's stripes: five yards each between the goal lines, the end zones.
    fillWith('#3B7D2E', () => rect(WX0, Math.max(WY0, yn), WX1, WY1));
    fillWith('#4C9638', () => rect(0, -10, WIDTH, 110));
    fillWith('#56A33F', () => { for (let y = 0; y < 100; y += 10) if (y + 5 > yn) rect(0, Math.max(y, yn), WIDTH, y + 5); });
    // The grass itself, laid band by band so it shrinks into the distance: narrow bands near the camera (so the
    // perspective holds), wide ones far off, a finer copy of the grass far off, none past seeing.
    for (let y0 = Math.max(WY0, yn), step = 0; y0 < WY1; y0 += step) {
      step = clamp((y0 - cam.cy) / 3.6, 1.5, 12);
      const y1 = Math.min(WY1, y0 + step), a = y0;
      if (a >= y1) continue;
      const P0 = proj(WX0, a, 0), P1 = proj(WX1, a, 0), P2 = proj(WX0, y1, 0);
      if (!P0 || !P1 || !P2) continue;
      const kx = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) / (WX1 - WX0);
      if (kx < 2.2) continue;
      const big = kx > 14, ppy = big ? 64 : 16, pat = pats[big ? 0 : 1];
      g.save();
      g.beginPath(); rect(WX0, a, WX1, y1); g.clip();
      const A = (P1[0] - P0[0]) / ((WX1 - WX0) * ppy), B = (P1[1] - P0[1]) / ((WX1 - WX0) * ppy);
      const C = (P2[0] - P0[0]) / ((y1 - a) * ppy), D = (P2[1] - P0[1]) / ((y1 - a) * ppy);
      g.setTransform(A, B, C, D, P0[0] - A * WX0 * ppy - C * a * ppy, P0[1] - B * WX0 * ppy - D * a * ppy);
      g.fillStyle = pat;
      g.fillRect(WX0 * ppy, a * ppy, (WX1 - WX0) * ppy, (y1 - a) * ppy);
      g.restore();
    }
    // The end zones' names, the logo at midfield.
    lay(names.far, [3.5, 107.6, 0], [WIDTH - 7, 0, 0], [0, -5.4, 0], 3);
    lay(names.near, [WIDTH - 3.5, -7.6, 0], [-(WIDTH - 7), 0, 0], [0, 5.4, 0], 3);
    if (logo && logo.naturalWidth) { g.globalAlpha = 0.92; lay(logo, [MID - 5, 55, 0], [10, 0, 0], [0, -10, 0], 4); g.globalAlpha = 1; }
    // The white: the border round the field, the goal lines, the yard lines, the hash marks, the try lines.
    fillWith('rgba(255,255,255,.94)', () => {
      rect(-2, -12, 0, 112); rect(WIDTH, -12, WIDTH + 2, 112);
      rect(0, -12, WIDTH, -10); rect(0, 110, WIDTH, 112);
      rect(0, -0.12, WIDTH, 0.12); rect(0, 99.88, WIDTH, 100.12);
    });
    fillWith('rgba(255,255,255,.86)', () => {
      for (let y = 5; y < 100; y += 5) if (y > yn - 1) rect(0, y - 0.07, WIDTH, y + 0.07);
      for (let y = Math.max(1, Math.ceil(yn)); y < 100; y++) {
        if (y % 5 === 0) continue;
        [0.33, 23.58, 29.08, WIDTH - 1].forEach(x => rect(x, y - 0.06, x + 0.67, y + 0.06));
      }
      rect(MID - 0.5, 1.94, MID + 0.5, 2.06); rect(MID - 0.5, 97.94, MID + 0.5, 98.06);
    });
    // The numbers, every ten, read from the sidelines; the arrows point to the nearer goal.
    const D = digitTex();
    for (let y = 10; y <= 90; y += 10) {
      if (y < yn - 3) continue;
      const t = String(y <= 50 ? y : 100 - y), dir = y < 50 ? -1 : 1;
      // Left side: the tops toward the middle (x 9), read along -y; right side: tops at x 44.33, read along +y.
      lay(D[t[0]], [9, y + 1.62, 0], [0, -1.33, 0], [-2, 0, 0], 1);
      lay(D[t[1]], [9, y - 0.29, 0], [0, -1.33, 0], [-2, 0, 0], 1);
      lay(D[t[0]], [WIDTH - 9, y - 1.62, 0], [0, 1.33, 0], [2, 0, 0], 1);
      lay(D[t[1]], [WIDTH - 9, y + 0.29, 0], [0, 1.33, 0], [2, 0, 0], 1);
      if (y !== 50) {
        fillWith('rgba(255,255,255,.9)', () => {
          poly([[8.25, y + dir * 1.95, 0], [8.95, y + dir * 1.95, 0], [8.6, y + dir * 2.6, 0]]);
          poly([[WIDTH - 8.25, y + dir * 1.95, 0], [WIDTH - 8.95, y + dir * 1.95, 0], [WIDTH - 8.6, y + dir * 2.6, 0]]);
        });
      }
    }
  }
  function drawLines(los, fd) {
    // The broadcast lines: the line of scrimmage in blue, the line to gain in yellow.
    fillWith('rgba(46,124,255,.92)', () => rect(0, los - 0.17, WIDTH, los + 0.17));
    if (fd != null && fd < 100) fillWith('rgba(255,214,10,.95)', () => rect(0, fd - 0.17, WIDTH, fd + 0.17));
  }
  function drawPosts(u) {
    // The goalposts at both ends: the gooseneck, the crossbar ten feet up, the uprights.
    g.globalAlpha = clamp01(u * 2 - 0.5);
    if (g.globalAlpha <= 0) { g.globalAlpha = 1; return; }
    const GP = '#F2CC1B', GPD = '#B8930C', half = 3.08;
    [[110, 1], [-10, -1]].forEach(([Y, s]) => {
      const base = Y + s * 1.6;
      bar([MID, base, 0], [MID, base, 1.9], 0.4, '#2A2F3B');
      bar([MID, base, 0], [MID, base, 2.7], 0.28, GPD);
      bar([MID, base, 2.7], [MID, Y, 3.33], 0.26, GP);
      bar([MID - half, Y, 3.33], [MID + half, Y, 3.33], 0.22, GP);
      bar([MID - half, Y, 3.33], [MID - half, Y, 13.3], 0.16, GP);
      bar([MID + half, Y, 3.33], [MID + half, Y, 13.3], 0.16, GP);
    });
    g.globalAlpha = 1;
  }
  function drawLight() {
    // The stadium's light: a haze toward the far end.
    const hz = proj(MID, cam.cy + 600, 0);
    if (hz && hz[1] > -H && hz[1] < H) {
      const top = Math.max(0, hz[1]), hg = g.createLinearGradient(0, top, 0, top + H * 0.35);
      hg.addColorStop(0, 'rgba(210,225,240,.22)'); hg.addColorStop(1, 'rgba(210,225,240,0)');
      g.fillStyle = hg; g.fillRect(0, top, W, H * 0.35);
    }
    // (The corners' shade is drill.css's, over the canvas.)
  }
  /** The chalkboard's marks (the top-down field's players: an O or an X in his rating's chalk, his number in white)
   *  fading into the figures as the camera tips down. */
  function drawDots(list, alpha) {
    if (alpha <= 0) return;
    g.globalAlpha = alpha;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(10.5 * S)}px ${FONT}`;
    g.lineCap = 'round'; g.lineJoin = 'round';
    list.forEach(({pl, p}) => {
      const mk = chalkMark(pl.side, pl.key);
      g.setTransform(S * 26 / 24, 0, 0, S * 26 / 24, p[0], p[1]);
      g.rotate(mk.rot * Math.PI / 180);
      g.translate(-12, -12);
      g.lineWidth = 2.3; g.strokeStyle = pl.rc;
      g.stroke(markPath(mk.d));
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#F3F0E6';
      g.fillText(String(pl.j == null ? '' : pl.j), p[0], p[1] + 0.5 * S);
    });
    g.globalAlpha = 1;
  }
  /** Each player's pace and stride from where he was a frame ago, and which way he faces (offense from behind,
   *  defense in front, unless he's running hard the other way; a backpedal doesn't turn him). */
  function stepMotion(pl, q, dt) {
    const home = pl.side === 'o' ? 'b' : 'f';
    let m = motion.get(pl.key);
    if (!m) { m = {x: q[0], y: q[1], vx: 0, vy: 0, ph: hash(pl.key) % 12 / 12 * Math.PI * 2, face: home, cand: null, candT: 0}; motion.set(pl.key, m); }
    if (dt > 0) {
      const sec = dt / 1000, vx = (q[0] - m.x) / sec, vy = (q[1] - m.y) / sec, a = 1 - Math.exp(-dt / 90);
      m.vx += (vx - m.vx) * a; m.vy += (vy - m.vy) * a;
      m.ph += Math.hypot(q[0] - m.x, q[1] - m.y) / RUN * Math.PI * 2;
    }
    m.x = q[0]; m.y = q[1];
    // Which side of him we see: the way he's running (away: his back; at us: his front; across: his side). A
    // backpedal (the passer's drop, a corner bailing) or a shuffle along the line doesn't turn him; a turn has to
    // hold a moment before it shows.
    const sp = Math.hypot(m.vx, m.vy), ax = Math.abs(m.vx), ay = Math.abs(m.vy);
    let want = m.face;
    if (ax > ay * 1.2 && sp > 3) want = m.vx > 0 ? 'r' : 'l';
    else if (ay > ax * 1.2 && sp > 2.2) {
      want = m.vy > 0 ? 'b' : 'f';
      if (want !== home && sp < 4.2) want = m.face === 'r' || m.face === 'l' ? m.face : home;
    }
    if (want === m.face) m.cand = null;
    else if (m.cand === want) { m.candT += dt; if (m.candT > 90) { m.face = want; m.cand = null; } }
    else { m.cand = want; m.candT = dt; }
    return m;
  }
  /** The ball (side: how far to the side of the man carrying it, yards), its shadow when it's up. */
  function drawBall(f, m, side = 0) {
    const [bx, by, bz] = f.ball;
    const lift = (f.carry == null ? 10 : f.carry) / 10 * 1.15 * m;
    const ground = proj(bx, by, 0), p = proj(bx + side, by, bz + lift);
    if (!p) return;
    if (ground && bz > 0.3) {
      g.fillStyle = 'rgba(0,0,0,.28)';
      g.beginPath(); g.ellipse(ground[0], ground[1], Math.max(2, 0.22 * ground[2]), Math.max(1, 0.08 * ground[2]), 0, 0, Math.PI * 2); g.fill();
    }
    const L = Math.max(4.5 * S, 0.36 * p[2]);
    let ang = -0.35;
    if (prevBall && bz > 0.3) { const dx = p[0] - prevBall[0], dy = p[1] - prevBall[1]; if (Math.hypot(dx, dy) > 0.5) ang = Math.atan2(dy, dx); }
    prevBall = [p[0], p[1]];
    const spin = bz > 0.3 ? 0.82 + 0.18 * Math.sin(f.now / 35) : 1;
    g.save();
    g.translate(p[0], p[1]); g.rotate(ang);
    const bg = g.createRadialGradient(-L * 0.15, -L * 0.12, L * 0.05, 0, 0, L * 0.6);
    bg.addColorStop(0, '#B4652F'); bg.addColorStop(1, '#5E2A10');
    g.beginPath(); g.ellipse(0, 0, L / 2, L * 0.3 * spin, 0, 0, Math.PI * 2);
    g.fillStyle = bg; g.fill(); g.lineWidth = Math.max(0.6, L * 0.06); g.strokeStyle = 'rgba(30,12,4,.8)'; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(0.5, L * 0.05);
    g.beginPath(); g.moveTo(-L * 0.16, -L * 0.1 * spin); g.lineTo(L * 0.16, -L * 0.1 * spin); g.stroke();
    g.restore();
  }

  /** One frame. f: {u, t, top [x, y], follow [x, y], pos {key: [x, y]}, down {key: 'l'|'r'}, ball [x, y, z], carry,
   *  hold (the key of the man with the ball, or null), los, fd, now}. */
  function render(f) {
    if (closed) return;
    const dt = last ? Math.min(100, f.now - last) : 0;
    last = f.now;
    // The camera eases toward the ball; between the dots and the play it swings from straight down to behind.
    if (fx == null) { fx = f.follow[0]; fy = f.follow[1]; } else {
      const a = 1 - Math.exp(-dt / 230);
      fx += (f.follow[0] - fx) * a; fy += (f.follow[1] - fy) * a;
    }
    const e = smooth(f.u);
    // Wide while the ball is behind the line (the formation, the passer's throw, a sack all in), pushed in once it's
    // past it. Eased, so the push follows the ball rather than jumping with it.
    let push = f.ball && f.los != null ? smooth(clamp01((f.ball[1] - f.los + 1) / 7)) : 0;
    // Handed off, the back has it: in most of the way, so a run stopped at the line is still seen up close.
    if (f.hold && f.hold !== 'o-QB' && f.t > 0.05) push = Math.max(push, 0.75);
    pushK = pushK == null ? push : pushK + (push - pushK) * (1 - Math.exp(-dt / 170));
    const dist = C.snap + (C.play - C.snap) * pushK;
    const tx = clamp(MID + (fx - MID) * C.followX, 4, WIDTH - 4);
    cam = cameraAt(V, f.u, f.top[0] + (tx - f.top[0]) * e, f.top[1] + (fy - f.top[1]) * e, dist);
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawStadium();
    drawGround();
    drawLines(f.los, f.fd);
    // The players, far to near, each on his shadow; the ball with the man who has it.
    const m = clamp01((f.u - 0.18) / 0.5);
    const list = [];
    players.forEach(pl => {
      const q = f.pos[pl.key];
      if (!q) return;
      const mo = stepMotion(pl, q, dt);
      const p = proj(q[0], q[1], 0);
      if (p) list.push({pl, q, p, mo});
    });
    list.sort((a, b) => b.q[1] - a.q[1]);
    drawLight();
    drawDots(list, 1 - m);
    if (m > 0) {
      g.globalAlpha = m;
      list.forEach(({p}) => {
        const k = p[2];
        g.fillStyle = 'rgba(0,0,0,.16)';
        g.beginPath(); g.ellipse(p[0] + 0.18 * k, p[1], 0.62 * k, 0.62 * k * 0.36, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(0,0,0,.24)';
        g.beginPath(); g.ellipse(p[0] + 0.1 * k, p[1], 0.4 * k, 0.4 * k * 0.34, 0, 0, Math.PI * 2); g.fill();
      });
      const pre = !f.t;
      const carrier = f.hold ? list.find(o => o.pl.key === f.hold) : null;
      let ballDone = false;
      list.forEach(({pl, q, p, mo}) => {
        const down = f.down[pl.key];
        const sp = Math.hypot(mo.vx, mo.vy), home = pl.side === 'o' ? 'b' : 'f';
        // The play's moment for him now (a block only while he's holding his ground), else his stride or his stance.
        const act = pre || down ? null : (acts.get(pl.key) || []).find(x => f.t >= x.t0 && f.t <= x.t1 && !(x.a === 'bk' && sp > 3.5));
        const pose = pre ? (pl.line ? 'line' : pl.slot === 'QB' ? 'stand' : 'set') : act ? act.a : sp > 1.6 ? 'run' : 'stand';
        // Set, blocking, or winding up from the pocket, he squares up the way his side faces; a tackler dives at the
        // man with the ball.
        let face = mo.face;
        if (pre || pose === 'bk' || ((pose === 'tw' || pose === 'tr') && sp < 3)) face = home;
        else if (pose === 'tl' && carrier && carrier.pl !== pl) {
          const dx = carrier.q[0] - q[0], dy = carrier.q[1] - q[1];
          face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'b' : 'f';
        }
        const head = proj(q[0], q[1], TALL);
        if (!head) return;
        const s = (p[1] - head[1]) / 100;
        if (!(s > 0)) return;
        if (down) {
          // On the ground: laid on his side, seen from above.
          g.setTransform(s, 0, 0, s * 0.5, p[0], p[1] + 2 * s);
          g.rotate(down === 'l' ? -Math.PI / 2 : Math.PI / 2);
          g.translate(0, 50);
          drawFigure(g, pl, face, 'stand', 0);
        } else {
          g.setTransform(s, 0, 0, s, p[0], p[1]);
          drawFigure(g, pl, face, pose, mo.ph);
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        // The ball with the man who has it, tucked on the side we see (in the passer's hand as he winds up, it's in
        // the drawing).
        if (f.ball && pl.key === f.hold) {
          if (pose !== 'tw') drawBall(f, m, {r: 0.4, l: -0.4, b: 0.3, f: 0.12}[face]);
          ballDone = true;
        }
      });
      if (f.ball && !ballDone) drawBall(f, m);
      g.globalAlpha = 1;
    } else if (f.ball) prevBall = null;
    drawPosts(f.u);
  }
  /** Where a field point is on screen, in CSS pixels from the field's top left (lift: above a player's head). */
  function css(x, y, lift = 0) {
    if (!cam) return null;
    const p = proj(x, y, lift ? TALL + 1.1 : 0);
    if (!p) return null;
    return [p[0] / S, p[1] / S];
  }
  function remove() { closed = true; wrap.remove(); }
  function close() {
    if (closed) return;
    closed = true;
    wrap.classList.remove('is-on');
    setTimeout(() => wrap.remove(), 220);
  }
  // On next frame, so the fade in runs.
  requestAnimationFrame(() => { if (!closed) wrap.classList.add('is-on'); });
  return {render, css, overlay, close, remove, S};
}
