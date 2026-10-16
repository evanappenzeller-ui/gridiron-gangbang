// Two-Minute Drill: each snap seen from behind the offense like a console football game's camera (views/drill.js
// runAnim runs it). A canvas over the field at the screen's own resolution: the stadium (the stands full of fans, the
// suites, the padded wall round the field), the field in true perspective (mowed stripes over grass, the white
// border, the yard lines, hash marks and numbers with their arrows, the end zones with the teams' names, the logo at
// midfield, the line of scrimmage and the line to gain), every player a shaded figure in his team's uniform (seen from
// behind or in front by the way he's going, running and leaning into it, linemen down in their stance before the
// snap, a tackled man on the ground) on his shadow, the ball, the goalposts; the scoreboard across the top.
// The camera starts straight down over the dots (the top-down field under it, matched yard for yard), swings down
// behind the offense for the play and follows the ball, then swings back up; the canvas fades into the dots.
// open(field, scene) -> cam (or null with no 2D canvas): cam.render(frame), cam.css(x, y, lift), cam.overlay,
// cam.board(b), cam.clock(text), cam.close() (fades out, then removes itself), cam.remove().
// Owner: Drill.

const WIDTH = 53.33, MID = 26.67;
// The game camera: its pitch (degrees down), its distance to what it looks at (yards: wide at the snap for the whole
// formation, pushed in as the play goes), its lens (the focal length as a share of the canvas width), and how much
// further than views/drill.js asks it leans toward the ball's side. The top-down camera's distance is whatever
// matches the dots' field.
const CAMS = {pitch: 19, snap: 29, play: 19, lens: 0.6, followX: 1.35};
const NEAR = 0.5;
// Drawn at the screen's resolution, up to this many canvas pixels to a CSS pixel.
const DPR_MAX = 2;
// The stadium: the faces of the wall round the field (and its height), the stands behind it (how far back they go and
// how high they rise).
const WX0 = -9, WX1 = WIDTH + 9, WY0 = -22, WY1 = 122, WALL = 1.2, BACK = 40, RISE = 30;
// A player stands a touch taller than life (yards), so he reads on a phone; his sprite is drawn 100 units tall at U
// canvas pixels a unit.
const TALL = 2.2, U = 1.1;
const SW = 74, SH = 124, AX = 37, AY = 119;
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
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const rgbOf = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x808080; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (h, to, k) => { const a = rgbOf(h), b = rgbOf(to); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };
const lite = (h, k) => mix(h, '#FFFFFF', k), dark = (h, k) => mix(h, '#000000', k);
const luma = h => { const [r, g, b] = rgbOf(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

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
// A player in local units: 100 tall, his feet at the origin, up is negative y. Drawn once for each look (his team's
// uniform, his number, from behind or in front, standing, set, or one of eight steps of a stride) and kept.
function kitOf(team, colored) {
  const [c0, c1] = team;
  const trim = luma(c1) > 0.85 && luma(c0) > 0.85 ? '#333333' : c1;
  return colored
    ? {jersey: c0, num: '#FFFFFF', edge: trim, helmet: c0, stripe: '#FFFFFF', pants: luma(c0) < 0.25 ? '#E9E6DE' : '#F2F0EA', pstripe: c0, sock: c0, glove: '#FFFFFF', mask: '#D8DADF'}
    : {jersey: '#F5F5F2', num: c0, edge: trim, helmet: c0, stripe: trim, pants: c0, pstripe: '#FFFFFF', sock: c0, glove: luma(c0) < 0.3 ? '#F2F2F2' : '#202020', mask: '#C9CCD3'};
}
const SPRITES = new Map();
function poseOf(pose) {
  if (pose === 'set') return {hip: -45, sh: -73, head: -85, lift: [0, 0], arm: [0, 0], feet: 10, knees: true};
  if (pose && pose[0] === 'r') {
    const ph = Number(pose.slice(1)) / 8 * Math.PI * 2, s = Math.sin(ph), bob = -2 * Math.abs(Math.cos(ph));
    return {hip: -49 + bob, sh: -78 + bob, head: -90 + bob, lift: [Math.max(0, s), Math.max(0, -s)], arm: [-s, s], feet: 6.5};
  }
  return {hip: -50, sh: -78, head: -90, lift: [0, 0], arm: [0, 0], feet: 8};
}
function strokeFill(g, fill) { g.fillStyle = fill; g.fill(); g.strokeStyle = STROKE; g.lineWidth = 1.3; g.stroke(); }
function limb(g, ax, ay, bx, by, w, col) {
  g.lineCap = 'round';
  g.strokeStyle = STROKE; g.lineWidth = w + 2.4; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
}
function numberOn(g, K, j, x, y, h, sy = 1) {
  if (j == null || j === '') return;
  g.save();
  g.translate(x, y);
  g.scale(String(j).length > 1 ? 0.8 : 0.9, sy);
  g.font = `800 ${h}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 2.6; g.strokeStyle = K.edge;
  g.strokeText(String(j), 0, 1);
  g.fillStyle = K.num; g.fillText(String(j), 0, 1);
  g.restore();
}
function helmet(g, K, x, y, front, r = 1) {
  const rx = 10 * r, ry = 11 * r;
  const gr = g.createRadialGradient(x - 4 * r, y - 5 * r, 1, x, y, 13 * r);
  gr.addColorStop(0, lite(K.helmet, 0.5)); gr.addColorStop(0.42, K.helmet); gr.addColorStop(1, dark(K.helmet, 0.4));
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); strokeFill(g, gr);
  g.save();
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.clip();
  if (front) {
    // The face in the shade of the helmet, the facemask over it.
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
function cleat(g, x, y, lifted) {
  g.beginPath(); g.ellipse(x, y, 4.6, lifted ? 3.4 : 2.8, 0, 0, Math.PI * 2); strokeFill(g, '#17181C');
  if (lifted) { g.fillStyle = '#E9E9E9'; g.beginPath(); g.ellipse(x, y + 0.4, 3.2, 1.8, 0, 0, Math.PI * 2); g.fill(); }
  else { g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x - 3, y - 1.2, 6, 1); }
}
/** Upright: standing, set (knees bent, hands on his thighs) or running. */
function paintUpright(g, K, j, front, pose, wide) {
  const P = poseOf(pose), Wd = wide ? 1.13 : 1;
  const ws = 20 * Wd, ww = 12 * Wd;
  // Legs: each from the hip through the knee to the cleat; a lifted leg kicks its heel up.
  const legs = [-1, 1].map((sg, i) => {
    const l = P.lift[i];
    const hipX = sg * 6.5 * Wd, kneeX = sg * (8 + (P.knees ? 3 : 0)) * Wd, kneeY = -24 + l * 5 + (P.knees ? -2 : 0);
    const ankX = sg * (P.feet + (P.knees ? 2 : 0)) * (1 - 0.25 * l), ankY = -6 - l * 21;
    return {sg, l, hipX, kneeX, kneeY, ankX, ankY};
  });
  // The lifted leg behind the planted one from the back, in front of it from the front.
  const order = legs.slice().sort((a, b) => (front ? a.l - b.l : b.l - a.l));
  order.forEach(L => {
    limb(g, L.kneeX, L.kneeY, L.ankX, L.ankY, 7, K.sock);
    g.strokeStyle = '#F1F1F1'; g.lineWidth = 7; g.beginPath(); g.moveTo(L.ankX, L.ankY - 3); g.lineTo(L.ankX, L.ankY); g.stroke();
    cleat(g, L.ankX, L.ankY + 2.5, L.l > 0.35 && !front);
  });
  // The pants: both thighs to just below the knees, a stripe down each side, the belt.
  const [A, B] = legs;
  g.beginPath();
  g.moveTo(-ww - 0.5, P.hip); g.lineTo(ww + 0.5, P.hip);
  g.lineTo(B.kneeX + 5, B.kneeY + 1.5); g.lineTo(B.kneeX - 4, B.kneeY + 1.5);
  g.lineTo(0, P.hip + 13);
  g.lineTo(A.kneeX + 4, A.kneeY + 1.5); g.lineTo(A.kneeX - 5, A.kneeY + 1.5);
  g.closePath();
  const pg = g.createLinearGradient(-ww, 0, ww, 0);
  pg.addColorStop(0, lite(K.pants, 0.12)); pg.addColorStop(0.6, K.pants); pg.addColorStop(1, dark(K.pants, 0.22));
  strokeFill(g, pg);
  g.strokeStyle = K.pstripe; g.lineWidth = 1.8; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(-ww + 0.4, P.hip + 2); g.lineTo(A.kneeX - 4.3, A.kneeY); g.moveTo(ww - 0.4, P.hip + 2); g.lineTo(B.kneeX + 4.3, B.kneeY); g.stroke();
  // The arms: a sleeve over the shoulder pad, the forearm, the glove. Running, they pump against the legs.
  const arm = (sg, a) => {
    const shx = sg * (ws - 4), shy = P.sh + 5;
    const fwd = Math.max(0, a), back = Math.max(0, -a);
    const hx = P.knees ? sg * 9 * Wd : sg * (ws - 2 - 7 * fwd + 2 * back), hy = P.knees ? P.hip + 6 : P.hip - 2 - 13 * fwd + 5 * back;
    const ex = sg * (ws + 1.5 - 2 * fwd), ey = (shy + hy) / 2 - 2 * fwd;
    limb(g, shx, shy, ex, ey, 7.2, K.skin);
    limb(g, ex, ey, hx, hy, 6.2, K.skin);
    limb(g, shx, shy - 1, shx + (ex - shx) * 0.45, shy + (ey - shy) * 0.45, 8.6, K.jersey);
    g.beginPath(); g.arc(hx, hy, 3.6, 0, Math.PI * 2); strokeFill(g, K.glove);
  };
  const arms = () => { arm(-1, P.arm[0]); arm(1, P.arm[1]); };
  if (!front) arms();
  // The jersey over the shoulder pads.
  g.beginPath();
  g.moveTo(-ws, P.sh + 7);
  g.quadraticCurveTo(-ws, P.sh - 2, -ws + 8, P.sh - 3);
  g.lineTo(ws - 8, P.sh - 3);
  g.quadraticCurveTo(ws, P.sh - 2, ws, P.sh + 7);
  g.lineTo(ww + 1, P.hip + 1); g.lineTo(-ww - 1, P.hip + 1);
  g.closePath();
  const jg = g.createLinearGradient(-ws, P.sh, ws, P.hip);
  jg.addColorStop(0, lite(K.jersey, 0.16)); jg.addColorStop(0.55, K.jersey); jg.addColorStop(1, dark(K.jersey, 0.26));
  strokeFill(g, jg);
  g.fillStyle = K.edge; g.globalAlpha = 0.9;
  g.fillRect(-ws + 1, P.sh + 3, 6, 2); g.fillRect(ws - 7, P.sh + 3, 6, 2);
  g.globalAlpha = 1;
  g.fillStyle = dark(K.pants, 0.5); g.fillRect(-ww, P.hip - 1.5, ww * 2, 2.5);
  numberOn(g, K, j, 0, front ? P.sh + 13 : P.sh + 15, front ? 13 : 19);
  if (front) arms();
  // The neck, then the helmet.
  g.fillStyle = dark(K.skin, 0.2); g.fillRect(-4, P.sh - 7, 8, 7);
  helmet(g, K, 0, P.head, front);
}
/** A lineman in his three-point stance: feet wide, back flat, a hand on the turf. */
function paintStance(g, K, j, front) {
  const ws = 21, legs = [-1, 1];
  legs.forEach(sg => {
    limb(g, sg * 7, -38, sg * 12, -22, 9, K.pants);
    limb(g, sg * 12, -22, sg * 13.5, -6, 6.6, K.sock);
    cleat(g, sg * 13.5, -3.5, false);
  });
  g.beginPath(); g.ellipse(0, -40, 13.5, 8.5, 0, 0, Math.PI * 2);
  const pg = g.createLinearGradient(-13, 0, 13, 0); pg.addColorStop(0, lite(K.pants, 0.12)); pg.addColorStop(1, dark(K.pants, 0.2));
  strokeFill(g, pg);
  const hand = front ? [7, -3] : [17, -3];
  if (!front) {
    limb(g, -16, -58, -11, -27, 6.4, K.skin); g.beginPath(); g.arc(-11, -27, 3.5, 0, Math.PI * 2); strokeFill(g, K.glove);
    limb(g, 17, -58, hand[0], hand[1], 6.6, K.skin); g.beginPath(); g.arc(hand[0], hand[1], 3.6, 0, Math.PI * 2); strokeFill(g, K.glove);
  }
  // The back, seen from above and behind (the number squashed on it), or the chest and pads from the front.
  g.beginPath();
  g.moveTo(-12, -42); g.lineTo(-ws, -58); g.quadraticCurveTo(-ws, -66, -ws + 7, -66);
  g.lineTo(ws - 7, -66); g.quadraticCurveTo(ws, -66, ws, -58); g.lineTo(12, -42); g.closePath();
  const jg = g.createLinearGradient(0, -66, 0, -42); jg.addColorStop(0, lite(K.jersey, 0.14)); jg.addColorStop(1, dark(K.jersey, 0.22));
  strokeFill(g, jg);
  if (!front) {
    numberOn(g, K, j, 0, -54, 16, 0.66);
    helmet(g, K, 0, -71, false, 0.95);
  } else {
    limb(g, -15, -60, -10, -28, 6.2, K.skin); g.beginPath(); g.arc(-10, -28, 3.4, 0, Math.PI * 2); strokeFill(g, K.glove);
    limb(g, 15, -60, hand[0], hand[1], 6.4, K.skin); g.beginPath(); g.arc(hand[0], hand[1], 3.5, 0, Math.PI * 2); strokeFill(g, K.glove);
    helmet(g, K, 0, -58, true, 0.95);
  }
}
function spriteOf(pl, view, pose, down) {
  const key = `${pl.kitKey}|${pl.j}|${pl.skin}|${view}|${pose}|${down || ''}|${pl.line ? 1 : 0}`;
  let c = SPRITES.get(key);
  if (c) return c;
  if (SPRITES.size > 900) SPRITES.clear();
  if (down) {
    // On the ground: the standing figure laid on its side and seen from above, its middle where he went down.
    const st = spriteOf(pl, view, 'stand', null);
    c = canvasOf(SH, 64);
    const g = c.getContext('2d');
    g.translate(SH / 2, 40); g.scale(1, 0.55); g.rotate(down === 'l' ? -Math.PI / 2 : Math.PI / 2);
    g.drawImage(st, -AX, -(AY - 50 * U));
    c.ax = SH / 2; c.ay = 46;
  } else {
    c = canvasOf(SW, SH);
    const g = c.getContext('2d');
    g.translate(AX, AY); g.scale(U, U);
    const K = Object.assign({skin: pl.skin}, pl.kit);
    if (pose === 'set' && pl.line) paintStance(g, K, pl.j, view === 'f');
    else paintUpright(g, K, pl.j, view === 'f', pose, pl.line);
    c.ax = AX; c.ay = AY;
  }
  SPRITES.set(key, c);
  return c;
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
  const sb = document.createElement('div');
  sb.className = 'dr-cam-sb';
  const overlay = document.createElement('div');
  overlay.className = 'dr-cam-co';
  wrap.append(cv, sb, overlay);
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
  let cam = null, fx = null, fy = null, last = 0, closed = false, prevBall = null;

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
  /** The dots (the top-down field's players) fading into the figures as the camera tips down. */
  function drawDots(list, alpha) {
    if (alpha <= 0) return;
    g.globalAlpha = alpha;
    const r = 12 * S;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(11 * S)}px ${FONT}`;
    list.forEach(({pl, p}) => {
      g.beginPath(); g.arc(p[0], p[1], r + 1.5 * S, 0, Math.PI * 2); g.fillStyle = 'rgba(8,12,20,.85)'; g.fill();
      g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fillStyle = pl.rc; g.fill();
      if (pl.mine) { g.lineWidth = 1.5 * S; g.strokeStyle = '#FFFFFF'; g.stroke(); }
      g.fillStyle = '#0A0F1A';
      g.fillText(String(pl.j == null ? '' : pl.j), p[0], p[1] + 0.5 * S);
    });
    g.globalAlpha = 1;
  }
  /** Each player's pace and stride from where he was a frame ago, and which way he faces (offense from behind,
   *  defense in front, unless he's running hard the other way). */
  function stepMotion(pl, q, dt) {
    let m = motion.get(pl.key);
    if (!m) { m = {x: q[0], y: q[1], vx: 0, vy: 0, ph: hash(pl.key) % 8 / 8 * Math.PI * 2, face: pl.side === 'o' ? 'b' : 'f'}; motion.set(pl.key, m); }
    if (dt > 0) {
      const sec = dt / 1000, vx = (q[0] - m.x) / sec, vy = (q[1] - m.y) / sec, a = 1 - Math.exp(-dt / 90);
      m.vx += (vx - m.vx) * a; m.vy += (vy - m.vy) * a;
      m.ph += Math.hypot(q[0] - m.x, q[1] - m.y) / 2.3 * Math.PI * 2;
    }
    m.x = q[0]; m.y = q[1];
    const sp = Math.hypot(m.vx, m.vy);
    if (sp > 2.5) {
      if (m.vy > 0.6 * sp) m.face = 'b';
      else if (m.vy < -0.6 * sp) m.face = 'f';
    }
    return m;
  }
  function drawBall(f, m) {
    const [bx, by, bz] = f.ball;
    const lift = (f.carry == null ? 10 : f.carry) / 10 * 1.15 * m;
    const ground = proj(bx, by, 0), p = proj(bx + (f.hold ? 0.3 : 0), by, bz + lift);
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
    // Wide for the snap (the whole formation in), in closer as the play goes.
    const dist = C.snap + (C.play - C.snap) * smooth(clamp01((f.t || 0) / 0.35));
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
      let ballDone = false;
      list.forEach(({pl, q, p, mo}) => {
        const down = f.down[pl.key];
        const sp = Math.hypot(mo.vx, mo.vy);
        const pose = pre ? 'set' : sp > 1.6 ? `r${Math.floor(((mo.ph / (Math.PI * 2)) % 1 + 1) % 1 * 8)}` : 'stand';
        const img = spriteOf(pl, mo.face, pose, down ? (down === 'l' ? 'l' : 'r') : null);
        const head = proj(q[0], q[1], TALL);
        if (!head) return;
        const s = (p[1] - head[1]) / (100 * U);
        if (!(s > 0)) return;
        const lean = down ? 0 : clamp(mo.vx / 14, -0.28, 0.28);
        g.setTransform(s, 0, -lean * s, s * (down ? 1 : 1), p[0], p[1] + (down ? 0.2 * s * 10 : 0));
        g.drawImage(img, -img.ax, -img.ay);
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (f.ball && pl.key === f.hold) { drawBall(f, m); ballDone = true; }
      });
      if (f.ball && !ballDone) drawBall(f, m);
      g.globalAlpha = 1;
    } else if (f.ball) prevBall = null;
    drawPosts(f.u);
  }
  /** Where a field point is on screen, in CSS pixels from the field's top left (lift: above a player's head). */
  function css(x, y, lift = 0) {
    if (!cam) return null;
    const p = proj(x, y, lift ? TALL + 0.5 : 0);
    if (!p) return null;
    return [p[0] / S, p[1] / S];
  }
  /** The scoreboard across the top: b {teams: [{id, c: [c0, c1], logo, score, tos, ball}] (yours first), q, clock,
   *  dd (down and distance)}. */
  function board(b) {
    if (!b) return;
    const team = t => `<div class="dr-cam-sb-t${t.ball ? ' has-ball' : ''}" style="--tc:${esc(t.c[0])}">`
      + `${t.logo ? `<i data-logo="${esc(t.logo)}"></i>` : ''}<b>${esc(t.id)}</b>`
      + `<span class="dr-cam-sb-to">${[0, 1, 2].map(i => `<s${i < t.tos ? ' class="is-on"' : ''}></s>`).join('')}</span>`
      + `<em>${esc(t.score)}</em></div>`;
    sb.innerHTML = b.teams.map(team).join('')
      + `<div class="dr-cam-sb-g"><span>${esc(b.q)}</span><b data-cam-clock>${esc(b.clock)}</b></div>`
      + `<div class="dr-cam-sb-d">${esc(b.dd)}</div>`;
    // A logo shows once it has loaded (most often from the page's own scorebug, already in the cache).
    sb.querySelectorAll('i[data-logo]').forEach(i => {
      const im = new Image();
      im.onload = () => { i.style.backgroundImage = `url("${im.src}")`; i.classList.add('is-in'); };
      im.src = i.dataset.logo;
    });
  }
  function clock(text) {
    const c = sb.querySelector('[data-cam-clock]');
    if (c && c.textContent !== text) c.textContent = text;
  }
  function remove() { closed = true; wrap.remove(); }
  function close() {
    if (closed) return;
    closed = true;
    wrap.classList.remove('is-on');
    setTimeout(() => wrap.remove(), 220);
  }
  board(scene.board);
  // On next frame, so the fade in runs.
  requestAnimationFrame(() => { if (!closed) wrap.classList.add('is-on'); });
  return {render, css, overlay, board, clock, close, remove, S};
}
