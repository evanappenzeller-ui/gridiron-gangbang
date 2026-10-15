// Two-Minute Drill: each snap seen from behind the offense, like a 16-bit football game (views/drill.js runAnim runs
// it). A canvas laid over the field, drawn small and scaled up with hard pixels: the field in perspective (its stripes,
// lines, numbers, both end zones with the teams' names, the far goalpost, the crowd in the stands), every player a
// pixel sprite in his team's uniform (yours in your colours, theirs in white; the offense seen from behind, the
// defense from the front; running legs, a tackled man down), the ball with its shadow, and the callouts over it.
// The camera starts straight down over the dots (the top-down field under it, matched yard for yard), swings down
// behind the offense for the play and follows the ball, then swings back up; the canvas fades into the dots.
// open(field, scene) -> cam (or null with no 2D canvas): cam.render(frame), cam.css(x, y, lift), cam.overlay,
// cam.close() (fades out, then removes itself), cam.remove().
// Owner: Drill.

const WIDTH = 53.33, MID = 26.67;
// The behind-the-offense camera: its pitch (degrees down), its distance to what it looks at (yards), and the lens (the
// focal length as a share of the canvas width). The top-down camera's distance is whatever matches the dots' field.
const PITCH = 31, DIST = 30, LENS = 0.6, NEAR = 0.6;
// The canvas is about this many pixels across (a whole number of screen pixels each, so the pixels stay square).
const PIX = 264;
// The stadium: the grass around the field out to the stands, which rise to a rim.
const GX0 = -8, GX1 = WIDTH + 8, GY0 = -26, GY1 = 121, RIM = 30, RIM_Z = 24;

const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp01 = u => Math.max(0, Math.min(1, u));
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------------------------------------------------------------------------- A pixel font (3 x 5)
const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111'
};
const glyph = ch => FONT[ch] || null;

// ---------------------------------------------------------------------------- Sprites
// A player is 14 x 22 pixels (16 x 24 with his outline), his feet at the bottom middle. Cached by everything that
// changes a pixel.
const SKINS = ['#F1C9A5', '#E2B084', '#C68A5C', '#A0673F', '#7B4B2A', '#5A3520'];
const OUTLINE = [11, 14, 20];
const SPR = new Map();
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function kitOf(team, colored) {
  const [c0, c1] = team;
  return colored
    ? {jersey: c0, num: '#FFFFFF', helmet: c0, stripe: '#FFFFFF', pants: '#E6E3DC', belt: c0, sock: c0, trim: c1}
    : {jersey: '#F3F3F0', num: c0, helmet: c0, stripe: c1, pants: c0, belt: '#1B1B1B', sock: c0, trim: c0};
}
/** Puts a dark outline round every opaque pixel. */
function outline(c) {
  const g = c.getContext('2d'), {width: w, height: h} = c;
  const im = g.getImageData(0, 0, w, h), d = im.data, solid = i => d[i * 4 + 3] > 0;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid(i)) continue;
    if ((x > 0 && solid(i - 1)) || (x < w - 1 && solid(i + 1)) || (y > 0 && solid(i - w)) || (y < h - 1 && solid(i + w))) add.push(i);
  }
  add.forEach(i => { d[i * 4] = OUTLINE[0]; d[i * 4 + 1] = OUTLINE[1]; d[i * 4 + 2] = OUTLINE[2]; d[i * 4 + 3] = 255; });
  g.putImageData(im, 0, 0);
  return c;
}
/** A player: front (the defense) or back (the offense), standing (frame 0) or mid-stride (1, 2). */
function figure(kit, skin, j, front, frame) {
  const c = canvasOf(16, 24), g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + 1, y + 1, w, h); };
  // Legs (the lifted one shorter), then the pants over the tops of them.
  const lift = [[0, 0], [0, 2], [2, 0]][frame];
  [[3, lift[0]], [8, lift[1]]].forEach(([x, l]) => {
    R(x, 16 - l, 3, 1, kit.pants);
    R(x, 17 - l, 3, 3, kit.sock);
    R(x, 20 - l, 3, 2, '#151515');
  });
  R(3, 13, 8, 1, kit.belt);
  R(3, 14, 8, 2, kit.pants);
  // Arms swing against the legs.
  const swing = [[0, 0], [-1, 1], [1, -1]][frame];
  [[1, swing[0]], [11, swing[1]]].forEach(([x, s]) => {
    R(x, 8 + s, 2, 2, kit.jersey);
    R(x, 9 + s, 2, 1, kit.trim);
    R(x, 10 + s, 2, 2, skin);
  });
  // Shoulders and the jersey, the number on it.
  R(2, 6, 10, 1, kit.jersey);
  R(1, 7, 12, 1, kit.jersey);
  R(3, 8, 8, 5, kit.jersey);
  const digits = String(j == null ? '' : j).slice(0, 2).split('');
  const row0 = front ? 8 : 7;
  digits.forEach((ch, k) => {
    const gl = glyph(ch);
    if (!gl) return;
    const x0 = digits.length === 1 ? 5 : k ? 8 : 3;
    for (let i = 0; i < 15; i++) if (gl[i] === '1') R(x0 + (i % 3), row0 + Math.floor(i / 3), 1, 1, kit.num);
  });
  // The neck and the helmet: a facemask in front, the stripe behind.
  R(6, 5, 2, 1, skin);
  R(5, 0, 4, 1, kit.helmet);
  R(4, 1, 6, 4, kit.helmet);
  if (front) {
    R(5, 2, 4, 1, skin);
    R(5, 3, 4, 1, '#CFCFCF');
    R(5, 4, 4, 1, skin);
    R(5, 4, 1, 1, '#CFCFCF');
    R(8, 4, 1, 1, '#CFCFCF');
  } else R(6, 0, 2, 4, kit.stripe);
  return outline(c);
}
/** A tackled man: the figure on its side. */
function fallen(img, left) {
  const c = canvasOf(img.height, img.width), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.translate(c.width / 2, c.height / 2);
  g.rotate(left ? -Math.PI / 2 : Math.PI / 2);
  g.drawImage(img, -img.width / 2, -img.height / 2);
  return c;
}
function spriteOf(pl, frame, down) {
  const key = `${pl.kitKey}|${pl.j}|${pl.skin}|${pl.side}|${frame}|${down ? (down === 'l' ? 'l' : 'r') : ''}`;
  let c = SPR.get(key);
  if (c) return c;
  c = down ? fallen(spriteOf(pl, 0, null), down === 'l') : figure(pl.kit, pl.skin, pl.j, pl.side === 'd', frame);
  SPR.set(key, c);
  return c;
}
let BALL = null;
function ballSprite() {
  if (BALL) return BALL;
  const c = canvasOf(7, 5), g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(2, 0, 3, 1, '#3A1B08'); R(1, 1, 5, 3, '#3A1B08'); R(0, 2, 7, 1, '#3A1B08'); R(2, 4, 3, 1, '#3A1B08');
  R(2, 1, 3, 1, '#A5582A'); R(1, 2, 5, 1, '#8C4520'); R(2, 3, 3, 1, '#763A1A');
  R(3, 2, 1, 1, '#F2EEE6');
  BALL = c;
  return c;
}

// ---------------------------------------------------------------------------- The camera
/** u: 0 straight down (matching the dots' field), 1 behind the offense. target: the ground point it looks at. */
function cameraAt(V, u, tx, ty) {
  const e = smooth(u);
  const th = (90 + (PITCH - 90) * e) * Math.PI / 180;
  const D = V.D0 + (DIST - V.D0) * e;
  const sn = Math.sin(th), cs = Math.cos(th);
  return {sn, cs, cx: tx, cy: ty - D * cs, cz: D * sn, vs: V.vs0 + (1 - V.vs0) * e};
}
const toCam = (c, x, y, z) => { const dy = y - c.cy, dz = z - c.cz; return [x - c.cx, dy * c.sn + dz * c.cs, dy * c.cs - dz * c.sn]; };

export function open(field, scene) {
  const cssW = field.clientWidth, cssH = field.clientHeight;
  if (!cssW || !cssH) return null;
  const dpr = window.devicePixelRatio || 1;
  const n = Math.max(1, Math.round(cssW * dpr / PIX));
  const W = Math.max(120, Math.round(cssW * dpr / n)), H = Math.max(100, Math.round(cssH * dpr / n));
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
  g.imageSmoothingEnabled = false;
  const S = W / cssW; // canvas pixels per CSS pixel
  // The dots' field: 53.3 yards across 92% of the width, 36 yards top to bottom (stretched: vs0 squares it up).
  const F = LENS * W, hppy = 0.92 * W / WIDTH, vppy = H / 36;
  const V = {D0: F / hppy, vs0: vppy / hppy};
  const players = scene.players.map(pl => {
    const kit = kitOf(pl.team, pl.colored);
    return Object.assign({}, pl, {kit, kitKey: `${pl.team.join('')}${pl.colored ? 'c' : 'w'}`, skin: SKINS[hash(pl.n || pl.key) % SKINS.length]});
  });
  const crowdCols = scene.crowd;
  // Where the fans sit (rows up the stands, a couple of yards apart), by shirt colour.
  const FANS = crowdCols.map(() => []);
  for (let r = 0, i = 0; r < 9; r++) {
    const s = (r + 0.5) / 9, z = RIM_Z * s, off = RIM * s;
    const seat = (x, y) => FANS[hash(`${r}:${i++}`) % FANS.length].push([x, y, z]);
    for (let x = GX0 - off; x <= GX1 + off; x += 1.7) seat(x, GY1 + off);
    for (let y = GY0; y <= GY1 + off; y += 1.7) { seat(GX0 - off, y); seat(GX1 + off, y); }
  }
  let cam = null, fx = null, fy = null, last = 0, closed = false;

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
    if (out.length < 3) return;
    out.forEach(([xc, yc, zc], i) => { const k = F / zc, sx = W / 2 + xc * k, sy = H / 2 - yc * k * cam.vs; if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
    g.closePath();
  };
  const rect = (x0, y0, x1, y1, z = 0) => poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
  const fillWith = (col, fn) => { g.beginPath(); fn(); g.fillStyle = col; g.fill(); };
  /** Pixel-font text flat on the grass, read from behind the offense, centred on (cx, cy). */
  const groundText = (text, cx, cy, cell) => {
    const chars = String(text).toUpperCase().split('');
    const w = (chars.length * 4 - 1) * cell;
    chars.forEach((ch, k) => {
      const gl = glyph(ch);
      if (!gl) return;
      const x0 = cx - w / 2 + k * 4 * cell;
      for (let i = 0; i < 15; i++) {
        if (gl[i] !== '1') continue;
        const x = x0 + (i % 3) * cell, y = cy + 2.5 * cell - Math.floor(i / 3) * cell;
        rect(x, y - cell, x + cell, y);
      }
    });
  };
  const line3 = (a, b, col, wYd) => {
    let A = toCam(cam, ...a), B = toCam(cam, ...b);
    if (A[2] < NEAR && B[2] < NEAR) return;
    if (A[2] < NEAR || B[2] < NEAR) {
      const k = (NEAR - A[2]) / (B[2] - A[2]), m = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, NEAR];
      if (A[2] < NEAR) A = m; else B = m;
    }
    const s = p => [W / 2 + p[0] * F / p[2], H / 2 - p[1] * F / p[2] * cam.vs];
    const [ax, ay] = s(A), [bx, by] = s(B);
    g.strokeStyle = col;
    g.lineWidth = Math.max(1, wYd * F / ((A[2] + B[2]) / 2));
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  };

  function drawStadium() {
    // The sky, then the stands (far, left, right) rising from the edge of the grass to the rim.
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#05070C'); sky.addColorStop(1, '#101624');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    fillWith('#171C28', () => {
      poly([[GX0, GY1, 0], [GX1, GY1, 0], [GX1 + RIM, GY1 + RIM, RIM_Z], [GX0 - RIM, GY1 + RIM, RIM_Z]]);
      poly([[GX0, GY0, 0], [GX0, GY1, 0], [GX0 - RIM, GY1 + RIM, RIM_Z], [GX0 - RIM, GY0, RIM_Z]]);
      poly([[GX1, GY0, 0], [GX1 + RIM, GY0, RIM_Z], [GX1 + RIM, GY1 + RIM, RIM_Z], [GX1, GY1, 0]]);
    });
    // The crowd: a fan every couple of yards on each row, one colour at a time.
    FANS.forEach((list, ci) => {
      g.beginPath();
      list.forEach(([x, y, z]) => {
        const p = proj(x, y, z);
        if (!p || p[0] < -3 || p[0] > W + 3 || p[1] < -3 || p[1] > H + 3) return;
        const sz = Math.max(1, Math.min(3, Math.round(p[2] * 0.45)));
        g.rect(Math.round(p[0]), Math.round(p[1]) - sz, sz, sz);
      });
      g.fillStyle = crowdCols[ci];
      g.fill();
    });
    // The rail in front of the stands.
    fillWith('#2A3142', () => {
      poly([[GX0, GY1, 0], [GX1, GY1, 0], [GX1, GY1, 1], [GX0, GY1, 1]]);
    });
    // The grass round the field.
    fillWith('#1F5A2C', () => rect(GX0, GY0, GX1, GY1));
  }
  function drawField(los, fd, u) {
    // The stripes (five yards each), the end zones in the teams' colours with their names.
    fillWith('#2C7B3B', () => rect(0, 0, WIDTH, 100));
    fillWith('#338A43', () => { for (let y = 0; y < 100; y += 10) rect(0, y, WIDTH, y + 5); });
    fillWith(scene.ends.near.c, () => rect(0, -10, WIDTH, 0));
    fillWith(scene.ends.far.c, () => rect(0, 100, WIDTH, 110));
    const nameCell = n => Math.min(1.25, 42 / Math.max(1, String(n).length * 4 - 1));
    fillWith('rgba(255,255,255,.82)', () => {
      groundText(scene.ends.near.name, MID, -5, nameCell(scene.ends.near.name));
      groundText(scene.ends.far.name, MID, 105, nameCell(scene.ends.far.name));
    });
    // The lines: every five yards, the goal lines heavier; the sidelines and end lines; the hash marks near the camera.
    fillWith('rgba(255,255,255,.78)', () => {
      for (let y = 5; y < 100; y += 5) rect(0, y - 0.13, WIDTH, y + 0.13);
      for (let y = Math.max(1, Math.ceil(cam.cy - 20)); y < Math.min(100, cam.cy + 60); y++) {
        if (y % 5 === 0) continue;
        [0.3, 23.3, 29.4, WIDTH - 0.95].forEach(x => rect(x, y - 0.1, x + 0.65, y + 0.1));
      }
    });
    fillWith('#F4F4F1', () => {
      rect(0, -0.25, WIDTH, 0.25); rect(0, 99.75, WIDTH, 100.25);
      rect(-0.6, -10.6, 0, 110.6); rect(WIDTH, -10.6, WIDTH + 0.6, 110.6);
      rect(0, -10.6, WIDTH, -10); rect(0, 110, WIDTH, 110.6);
    });
    // The numbers, every ten, upright from behind.
    fillWith('rgba(255,255,255,.78)', () => {
      for (let y = 10; y <= 90; y += 10) {
        const t = y <= 50 ? y : 100 - y;
        groundText(t, 8.2, y, 0.55);
        groundText(t, WIDTH - 8.2, y, 0.55);
      }
    });
    // The line of scrimmage and the line to gain.
    fillWith('#3D9BFF', () => rect(0, los - 0.22, WIDTH, los + 0.22));
    if (fd != null) fillWith('#FFD60A', () => rect(0, fd - 0.22, WIDTH, fd + 0.22));
    // The far goalpost: the gooseneck, the crossbar ten feet up, the uprights.
    g.globalAlpha = clamp01(u * 2 - 0.4);
    if (g.globalAlpha > 0) {
      const Y = 110.6, GP = '#F2C81E', half = 3.08;
      line3([MID, Y + 1.2, 0], [MID, Y + 1.2, 2.6], GP, 0.3);
      line3([MID, Y + 1.2, 2.6], [MID, Y, 3.33], GP, 0.3);
      line3([MID - half, Y, 3.33], [MID + half, Y, 3.33], GP, 0.24);
      line3([MID - half, Y, 3.33], [MID - half, Y, 13], GP, 0.2);
      line3([MID + half, Y, 3.33], [MID + half, Y, 13], GP, 0.2);
    }
    g.globalAlpha = 1;
  }
  /** The dots (the top-down field's players) fading into the sprites as the camera tips down. */
  function drawDots(list, alpha) {
    if (alpha <= 0) return;
    g.globalAlpha = alpha;
    const r = Math.max(5, Math.round(12 * S));
    list.forEach(({pl, p}) => {
      g.beginPath(); g.arc(p[0], p[1], r + 1, 0, Math.PI * 2); g.fillStyle = pl.mine ? '#FFFFFF' : 'rgba(8,12,20,.9)'; g.fill();
      g.beginPath(); g.arc(p[0], p[1], r - (pl.mine ? 1 : 0), 0, Math.PI * 2); g.fillStyle = pl.rc; g.fill();
      const ds = String(pl.j == null ? '' : pl.j).split(''), cell = r >= 9 ? 2 : 1;
      const w = (ds.length * 4 - 1) * cell;
      g.fillStyle = '#0A0F1A';
      ds.forEach((ch, k) => {
        const gl = glyph(ch);
        if (!gl) return;
        for (let i = 0; i < 15; i++) if (gl[i] === '1') g.fillRect(Math.round(p[0] - w / 2 + k * 4 * cell + (i % 3) * cell), Math.round(p[1] - 2.5 * cell + Math.floor(i / 3) * cell), cell, cell);
      });
    });
    g.globalAlpha = 1;
  }

  /** One frame. f: {u, top [x, y], follow [x, y], pos {key: [x, y]}, run {key: frame}, down {key: 'l'|'r'},
   *  ball [x, y, z], air (the ball is in the air), hold (the key of the man with the ball, or null), los, fd, now}. */
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
    cam = cameraAt(V, f.u, f.top[0] + (fx - f.top[0]) * e, f.top[1] + (fy - f.top[1]) * e);
    drawStadium();
    drawField(f.los, f.fd, f.u);
    // The players, far to near; each on his shadow, the man with the ball on a yellow ring.
    const m = clamp01((f.u - 0.18) / 0.5);
    const list = [];
    players.forEach(pl => {
      const q = f.pos[pl.key];
      if (!q) return;
      const p = proj(q[0], q[1], 0);
      if (p) list.push({pl, q, p});
    });
    list.sort((a, b) => b.q[1] - a.q[1]);
    drawDots(list, 1 - m);
    if (m > 0) {
      g.globalAlpha = m;
      list.forEach(({pl, p}) => {
        const x = Math.round(p[0]), y = Math.round(p[1]);
        if (pl.key === f.hold) { g.strokeStyle = '#FFD60A'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, 8, 2.6, 0, 0, Math.PI * 2); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(x, y, 6, 1.8, 0, 0, Math.PI * 2); g.fill();
      });
      list.forEach(({pl, p}) => {
        const down = f.down[pl.key];
        const img = spriteOf(pl, down ? 0 : f.run[pl.key] || 0, down);
        g.drawImage(img, Math.round(p[0] - img.width / 2), Math.round(p[1] - img.height + (down ? 4 : 1)));
      });
      g.globalAlpha = 1;
    }
    // The ball (its shadow on the grass when it's up): carried at the chest, in the air on its arc.
    if (f.ball) {
      const [bx, by, bz] = f.ball;
      const lift = (f.carry == null ? 10 : f.carry) * m;
      const sh = proj(bx, by, 0);
      if (sh && bz > 0.3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(Math.round(sh[0]) - 2, Math.round(sh[1]) - 1, 4, 1); }
      const p = proj(bx, by, bz);
      if (p) {
        const img = ballSprite();
        g.drawImage(img, Math.round(p[0] - img.width / 2), Math.round(p[1] - lift - img.height / 2));
      }
    }
  }
  /** Where a field point is on screen, in CSS pixels from the field's top left (lift: canvas pixels up from it). */
  function css(x, y, lift = 0) {
    if (!cam) return null;
    const p = proj(x, y, 0);
    if (!p) return null;
    return [p[0] / S, (p[1] - lift) / S];
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
