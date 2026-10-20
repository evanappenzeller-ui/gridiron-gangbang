// Return Man's world (views/return.js draws with it): the places a return runs through (core/return.js THEMES), drawn
// on its canvas from behind the returner. Each place has its sky and far skyline (drawn once into a canvas of its own
// and copied in each frame; the next place's fades in as you come to its gate), its ground (the field; a parking lot;
// a city street; packed snow; the desert and its rail tracks), what stands beside the road (the walls and stands;
// parked cars, tents and light poles; buildings and street lamps; pines and snow fences; cacti, the saloon and the
// trading post), the gate into it, and its weather. In the lanes: the vehicles (boxes in perspective, each place's own,
// with their ramps), the power-ups, and the goal line every 100 yards.
// st: the view's state {W, H, y0, dpr, f, camX, camZ, camH, co (the course)}. The world in yards (x across, y up, z
// ahead); P(st, x, y, z) puts a point on the screen. Exports: P, NEAR, FAR, sky, ground, sides, vehicle, item, gate,
// weather, ICONS (the power-ups' pictures, for the HUD and the cards). Owner: RETURN.
import * as R from '../core/return.js';
import {backdrop, bowl, seeded, sparkle} from './stadium.js';

export const NEAR = .9, FAR = 150;
const FADE = 45; // yards before a gate the next place's sky comes in over
const WORDS = ['RETURN MAN', '★', 'GRIDIRON', '★', 'KICKOFF', '★'];
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
export function P(st, x, y, z) {
  const Z = Math.max(.05, z - st.camZ);
  return {x: st.W / 2 + st.f * (x - st.camX) / Z, y: st.y0 + st.f * (st.camH - y) / Z, s: st.f / Z};
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function path(c, pts) { c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); }
function fill(c, pts, style) { c.fillStyle = style; c.beginPath(); path(c, pts); c.fill(); }
// The faces of a box: a side (the plane x), its top (the plane y), a strip on the ground.
const sideQ = (st, x, ya, yb, za, zb) => [P(st, x, yb, za), P(st, x, yb, zb), P(st, x, ya, zb), P(st, x, ya, za)];
const topQ = (st, y, xa, xb, za, zb) => [P(st, xa, y, za), P(st, xb, y, za), P(st, xb, y, zb), P(st, xa, y, zb)];
const gnd = (st, xa, xb, za, zb) => topQ(st, 0, xa, xb, za, zb);
/** The near end of what's drawn from z (the near plane), or null when it's all behind the camera. */
const nearOf = (st, z0, z1) => { const zn = Math.max(z0, st.camZ + NEAR); return z1 > zn ? zn : null; };
// A face square to us (the plane z): a rectangle on the screen, in yards about its own origin (y up = minus).
function flat(st, c, x, y, z) { const p = P(st, x, y, z); c.save(); c.translate(p.x, p.y); c.scale(p.s, p.s); return p.s; }
function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
const hash = s => { let h = 0x811c9dc5 | 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return Math.abs(h) || 1; };
const rnd = (...k) => seeded(hash(k.join('|')) % 2147483647);

// ============================================================================ The places' looks
// haze: the far ground's colour as it meets the sky; night: the stadium's lights.
const LOOK = {
  stadium: {haze: '14,26,58', night: true},
  tailgate: {haze: '214,124,92'},
  downtown: {haze: '200,224,242'},
  tundra: {haze: '222,231,239'},
  west: {haze: '238,196,150'}
};
export const themeOf = (st, z) => R.zoneAt(st.co, z).theme;

// ============================================================================ The sky
function canvas(st) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(st.W * st.dpr); cv.height = Math.round((st.y0 + 2) * st.dpr);
  const c = cv.getContext('2d');
  c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  return {cv, c};
}
function grad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function cloud(c, x, y, w, col, shade) {
  const r = w / 4;
  c.fillStyle = shade; [[-1.2, .25, .8], [0, .3, 1], [1.2, .25, .8]].forEach(([u, v, k]) => { c.beginPath(); c.arc(x + u * r, y + v * r, r * k, 0, Math.PI * 2); c.fill(); });
  c.fillStyle = col; [[-1.25, 0, .75], [-.4, -.35, 1], [.55, -.2, .95], [1.3, .05, .7]].forEach(([u, v, k]) => { c.beginPath(); c.arc(x + u * r, y + v * r, r * k, 0, Math.PI * 2); c.fill(); });
  c.fillRect(x - r * 1.9, y, r * 3.8, r * .55);
}
const SKIES = {
  tailgate(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#2A1B52'], [.35, '#6C2F70'], [.68, '#E2664D'], [1, '#FFB868']]); c.fillRect(0, 0, W, h + 2);
    for (let i = 0; i < W * .08; i++) { c.fillStyle = `rgba(255,240,255,${(.2 + r() * .4).toFixed(2)})`; c.fillRect(r() * W, r() * h * .3, 1, 1); }
    const sx = W * .76, sy = h - 22, sr = Math.max(13, W * .05);
    const g = c.createRadialGradient(sx, sy, 2, sx, sy, W * .55); g.addColorStop(0, 'rgba(255,214,140,.7)'); g.addColorStop(1, 'rgba(255,170,110,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, h);
    c.fillStyle = '#FFE6A8'; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 7; i++) { const y = h * (.12 + r() * .5), x = r() * W, w = W * (.2 + r() * .3); c.fillStyle = `rgba(${r() < .5 ? '255,150,130' : '150,80,150'},${(.22 + r() * .2).toFixed(2)})`; c.beginPath(); c.ellipse(x, y, w / 2, 2 + r() * 4, 0, 0, Math.PI * 2); c.fill(); }
    // the stadium far off, its lights on
    const bx = W * .36, bw = W * .5, bh = Math.max(16, h * .17);
    c.fillStyle = '#2E1D44'; c.beginPath(); c.moveTo(bx - bw / 2, h + 2); c.lineTo(bx - bw / 2 + bw * .06, h - bh); c.quadraticCurveTo(bx, h - bh * 1.25, bx + bw / 2 - bw * .06, h - bh); c.lineTo(bx + bw / 2, h + 2); c.fill();
    c.strokeStyle = 'rgba(255,220,180,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx - bw / 2 + bw * .06, h - bh); c.quadraticCurveTo(bx, h - bh * 1.25, bx + bw / 2 - bw * .06, h - bh); c.stroke();
    [-.42, -.15, .15, .42].forEach(u => {
      const lx = bx + u * bw, ly = h - bh * 1.35 - (Math.abs(u) < .3 ? 6 : 0);
      c.fillStyle = '#24163A'; c.fillRect(lx - .8, ly, 1.6, bh * .4);
      const L = c.createRadialGradient(lx, ly, 1, lx, ly, 22); L.addColorStop(0, 'rgba(255,250,230,.95)'); L.addColorStop(.2, 'rgba(255,230,190,.35)'); L.addColorStop(1, 'rgba(255,220,180,0)');
      c.fillStyle = L; c.fillRect(lx - 22, ly - 22, 44, 44);
    });
    // trees and the lot's poles in silhouette
    c.fillStyle = '#25163A';
    c.beginPath(); c.moveTo(0, h + 2);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, h - 4 - r() * 7 - (Math.abs(x - bx) < bw / 2 ? 0 : 3));
    c.lineTo(W, h + 2); c.fill();
  },
  downtown(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#2F86DD'], [.7, '#8CCBF2'], [1, '#D3ECF9']]); c.fillRect(0, 0, W, h + 2);
    for (let i = 0; i < 5; i++) cloud(c, r() * W, h * (.12 + r() * .35), W * (.14 + r() * .12), 'rgba(255,255,255,.95)', 'rgba(196,222,244,.95)');
    [['#A9C3D9', .36, .5], ['#7F9DBB', .5, .62], ['#5A7697', .3, .8]].forEach(([col, tall, win]) => {
      for (let x = -10; x < W + 10;) {
        const w = 12 + r() * 30, bh = h * tall * (.35 + r() * .65);
        c.fillStyle = col; c.fillRect(x, h - bh, w, bh + 2);
        if (r() < .25) c.fillRect(x + w / 2 - 1, h - bh - 8 - r() * 10, 2, 12);
        c.fillStyle = `rgba(255,255,255,${(win * .2).toFixed(2)})`;
        for (let yy = h - bh + 4; yy < h - 3; yy += 5) for (let xx = x + 3; xx < x + w - 3; xx += 4) if (r() < .55) c.fillRect(xx, yy, 1.6, 2);
        x += w + (r() < .3 ? 4 + r() * 8 : 0);
      }
    });
    c.fillStyle = 'rgba(210,232,248,.35)'; c.fillRect(0, h - 10, W, 12);
  },
  tundra(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#7E93A8'], [.6, '#B8C7D4'], [1, '#E2E9EF']]); c.fillRect(0, 0, W, h + 2);
    const range = (col, cap, base, amp, step) => {
      const pts = [];
      for (let x = -20; x <= W + 20; x += step * (.6 + r() * .8)) pts.push([x, base - amp * (.3 + r() * .7)]);
      c.fillStyle = col; c.beginPath(); c.moveTo(-20, h + 2); pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(W + 20, h + 2); c.fill();
      c.fillStyle = cap;
      pts.forEach(([x, y], i) => { if (i % 2) return; c.beginPath(); c.moveTo(x, y); c.lineTo(x - step * .22, y + amp * .22); c.lineTo(x + step * .22, y + amp * .22); c.fill(); });
    };
    range('#B9C8D6', '#F4F8FB', h - 8, h * .42, W * .16);
    range('#93A8BB', '#EEF3F7', h - 4, h * .26, W * .11);
    // the pines along the far edge, snow on them
    for (let x = -4; x < W + 4; x += 3 + r() * 4) {
      const th = 6 + r() * 10;
      c.fillStyle = '#2F4A42'; c.beginPath(); c.moveTo(x, h - th); c.lineTo(x - th * .32, h + 1); c.lineTo(x + th * .32, h + 1); c.fill();
      c.fillStyle = 'rgba(244,248,251,.85)'; c.beginPath(); c.moveTo(x, h - th); c.lineTo(x - th * .1, h - th * .7); c.lineTo(x + th * .1, h - th * .7); c.fill();
    }
    c.fillStyle = 'rgba(226,233,239,.45)'; c.fillRect(0, h - 14, W, 16);
  },
  west(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#7F6BC9'], [.45, '#D69AB7'], [.8, '#F3B892'], [1, '#F7D2A8']]); c.fillRect(0, 0, W, h + 2);
    const sun = c.createRadialGradient(W * .7, h * .25, 4, W * .7, h * .25, W * .6); sun.addColorStop(0, 'rgba(255,240,210,.65)'); sun.addColorStop(1, 'rgba(255,230,200,0)');
    c.fillStyle = sun; c.fillRect(0, 0, W, h);
    for (let i = 0; i < 3; i++) cloud(c, r() * W, h * (.1 + r() * .25), W * (.12 + r() * .1), 'rgba(255,238,236,.9)', 'rgba(232,190,200,.9)');
    // mesas and buttes: flat tops, a lit face and a shadowed one, bands of rock
    const mesa = (x, w, mh, lit, dark) => {
      const top = h - mh, k = w * .14;
      c.fillStyle = dark; c.beginPath(); c.moveTo(x - w / 2 - k, h + 2); c.lineTo(x - w / 2, top); c.lineTo(x + w / 2, top); c.lineTo(x + w / 2 + k, h + 2); c.fill();
      c.fillStyle = lit; c.beginPath(); c.moveTo(x - w / 2 - k, h + 2); c.lineTo(x - w / 2, top); c.lineTo(x + w * .1, top); c.lineTo(x + w * .02, h + 2); c.fill();
      c.strokeStyle = 'rgba(120,40,30,.25)'; c.lineWidth = 1;
      for (let y = top + 5; y < h; y += 6) { c.beginPath(); c.moveTo(x - w / 2 - k * (y - top) / mh, y); c.lineTo(x + w / 2 + k * (y - top) / mh, y); c.stroke(); }
    };
    for (let i = 0; i < 4; i++) mesa(r() * W, W * (.16 + r() * .2), h * (.18 + r() * .14), '#E59A7A', '#C97C66');
    for (let i = 0; i < 4; i++) mesa(r() * W, W * (.1 + r() * .22), h * (.24 + r() * .28), '#E8754A', '#B9502F');
    c.fillStyle = '#EDB487'; c.fillRect(0, h - 6, W, 8);
  }
};
const SKY_CACHE = new Map();
function skyOf(st, id) {
  const key = `${id}|${st.W}|${st.y0}|${st.dpr}`;
  if (SKY_CACHE.has(key)) return SKY_CACHE.get(key);
  let v;
  if (id === 'stadium') {
    const B = bowl(st), r = seeded(31);
    const sparks = Array.from({length: 7}, () => { const x = r() * st.W; return {x, y: 6 + r() * Math.max(8, B.rim(x) - 18), s: 3 + r() * 3.5, v: 1 + r() * 1.8, ph: r() * 6.3}; });
    v = {cv: backdrop(st, WORDS), bowl: B, sparks};
  } else {
    const {cv, c} = canvas(st);
    SKIES[id](c, st.W, st.y0, seeded(hash(id) % 997 + 3));
    v = {cv};
  }
  if (SKY_CACHE.size > 12) SKY_CACHE.clear();
  SKY_CACHE.set(key, v);
  return v;
}
/** Readies the skies of the place z yards is in and the next (so a gate never waits on one being drawn). */
export function warm(st, z) {
  const zone = R.zoneAt(st.co, z);
  skyOf(st, zone.theme.id); skyOf(st, R.zoneAt(st.co, zone.z0 + R.ZONE).theme.id);
}
/** How far into the next place's sky we are (0..1), and the two places. */
export function blendAt(st, z) {
  const zone = R.zoneAt(st.co, z), next = R.zoneAt(st.co, zone.z0 + R.ZONE);
  return {now: zone.theme, next: next.theme, k: clamp((z - (zone.z0 + R.ZONE - FADE)) / FADE, 0, 1)};
}
function skyOne(st, c, id, t, a) {
  const S = skyOf(st, id);
  c.globalAlpha = a;
  c.drawImage(S.cv, 0, 0, st.W, st.y0 + 2);
  if (id === 'stadium') {
    S.sparks.forEach(s => { const b = Math.max(0, Math.sin(t * s.v + s.ph)); if (b > .05) sparkle(c, s.x, s.y, s.s * (.6 + .4 * b), b * .9 * a); });
    // phones flashing in the stands, a burst of them after a touchdown
    const B = S.bowl, cheer = st.cheer > performance.now(), r = seeded(1 + Math.floor(t * (cheer ? 14 : 5)));
    for (let i = 0, n = cheer ? 22 : 3; i < n; i++) {
      const x = r() * st.W, top = B.rim(x) + B.Sh * .1, y = top + r() * (B.wall(x) - 2 - top), b = .55 + r() * .45;
      c.fillStyle = `rgba(255,255,255,${(b * .28 * a).toFixed(2)})`; c.beginPath(); c.arc(x, y, 3.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(255,255,255,${(b * a).toFixed(2)})`; c.fillRect(x - .9, y - .9, 1.8, 1.8);
    }
  }
  c.globalAlpha = 1;
}
export function sky(st, c, t, z) {
  const b = blendAt(st, z);
  skyOne(st, c, b.now.id, t, 1);
  if (b.k > 0) skyOne(st, c, b.next.id, t, b.k);
  // the stadium's lights, falling on the field
  const stad = (b.now.id === 'stadium' ? 1 - b.k : 0) + (b.next.id === 'stadium' ? b.k : 0);
  if (stad > .02) {
    skyOf(st, 'stadium').bowl.lights.forEach(L => {
      if (L.r < 1) return;
      const tx = st.W / 2 + (L.x - st.W / 2) * .2, spread = st.W * .24;
      const g = c.createLinearGradient(0, L.y, 0, st.H);
      g.addColorStop(0, `rgba(215,228,255,${(.12 * stad).toFixed(3)})`); g.addColorStop(.55, `rgba(215,228,255,${(.04 * stad).toFixed(3)})`); g.addColorStop(1, 'rgba(215,228,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(L.x - 7, L.y); c.lineTo(L.x + 7, L.y); c.lineTo(tx + spread, st.H); c.lineTo(tx - spread, st.H); c.closePath(); c.fill();
    });
  }
}

// ============================================================================ The ground
// Each place's ground over its stretch of z (cut at the gates). The lanes are x = -LANE, 0, LANE.
const LANE = R.LANE, HALF = 26.67, WALL = 31;
/** Strips of ground (each [xa, xb, za, zb]) in one colour, one fill. */
function strips(st, c, list, style) {
  if (!list.length) return;
  c.fillStyle = style; c.beginPath();
  list.forEach(([xa, xb, za, zb]) => path(c, gnd(st, xa, xb, za, zb)));
  c.fill();
}
/** The z's from za to zb on a step (anchored to the world), for marks along the ground. */
function marks(za, zb, step, from = 0) { const out = []; for (let z = Math.ceil((za - from) / step) * step + from; z < zb; z += step) out.push(z); return out; }
const fieldYard = z => ((z % 100) + 100) % 100;
const inEndZone = z => z < 0 || (z >= 100 && fieldYard(z) < 10);
const GROUNDS = {
  stadium(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#1A5A31');
    // the field in 5-yard stripes; an end zone behind you, and past each goal line
    const a = [], b = [], ez = [];
    for (let z = Math.floor(za / 5) * 5; z < zb; z += 5) {
      const lo = Math.max(z, za), hi = Math.min(z + 5, zb);
      if (hi <= lo || z < -10) continue;
      (inEndZone(z + 2.5) ? ez : Math.floor(fieldYard(z) / 5) % 2 ? a : b).push([-HALF, HALF, lo, hi]);
    }
    strips(st, c, a, '#2B8A45'); strips(st, c, b, '#257D3E'); strips(st, c, ez, '#16357A');
    // the lanes: three faint mowed strips
    strips(st, c, [-LANE, 0, LANE].map(x => [x - .95, x + .95, za, zb]), 'rgba(255,255,255,.035)');
    // the yard lines (the goal lines heavier), the hashes, the sidelines
    const lines = [], goals = [], hashes = [];
    marks(Math.max(za, -10), zb, 1).forEach(z => {
      if (z - st.camZ > 120) return;
      const y = fieldYard(z), ezz = inEndZone(z + .5) && inEndZone(z - .5);
      if (y === 0) goals.push([-HALF, HALF, z - .2, z + .2]);
      else if (y % 5 === 0 && !ezz) lines.push([-HALF, HALF, z - .1, z + .1]);
      if (!inEndZone(z)) [-LANE / 2, LANE / 2].forEach(hx => hashes.push([hx - .33, hx + .33, z - .06, z + .06]));
    });
    strips(st, c, lines, 'rgba(255,255,255,.75)'); strips(st, c, goals, 'rgba(255,255,255,.95)'); strips(st, c, hashes, 'rgba(255,255,255,.6)');
    strips(st, c, [[-HALF - .15, -HALF + .15, za, zb], [HALF - .15, HALF + .15, za, zb]], 'rgba(255,255,255,.8)');
    // the numbers every ten, by the sidelines
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    marks(za, Math.min(zb, st.camZ + 90), 10).forEach(z => {
      const y = fieldYard(z);
      if (y === 0 || inEndZone(z)) return;
      const num = String(y <= 50 ? y : 100 - y), fade = clamp(1.2 - (z - st.camZ) / 80, 0, 1);
      [-1, 1].forEach(side => {
        const p = P(st, side * (HALF - 7), 0, z);
        if (p.x < -60 || p.x > st.W + 60) return;
        c.save(); c.translate(p.x, p.y); c.scale(1, .45);
        c.font = `800 ${Math.max(6, p.s * 2).toFixed(1)}px ${DISPLAY}`;
        c.fillStyle = `rgba(255,255,255,${(.8 * fade).toFixed(2)})`; c.fillText(num, 0, 0);
        c.restore();
      });
    });
    // the sideline walls, lit along the top, and the stands rising behind them
    [-1, 1].forEach(s => {
      const x = s * WALL, A = P(st, x, 0, za), B = P(st, x, 0, zb), B2 = P(st, x, 2.4, zb), A2 = P(st, x, 2.4, za);
      fill(c, [A, B, B2, A2], '#13204A');
      c.strokeStyle = 'rgba(62,240,143,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(A2.x, A2.y); c.lineTo(B2.x, B2.y); c.stroke();
      fill(c, [A2, B2, P(st, x + s * 12, 14, zb), P(st, x + s * 12, 14, za)], '#0B1433');
    });
  },
  tailgate(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#34363E');
    strips(st, c, [[-5.2, 5.2, za, zb]], '#3D4049');
    strips(st, c, [[-5.05, -4.9, za, zb], [4.9, 5.05, za, zb]], 'rgba(242,201,76,.85)');
    const dash = [], stalls = [];
    marks(za, Math.min(zb, st.camZ + 110), 4).forEach(z => { [-LANE / 2, LANE / 2].forEach(x => dash.push([x - .07, x + .07, z, z + 2])); });
    marks(za, Math.min(zb, st.camZ + 110), 3.2, .6).forEach(z => { stalls.push([-11.8, -5.8, z - .07, z + .07], [5.8, 11.8, z - .07, z + .07]); });
    strips(st, c, dash, 'rgba(255,255,255,.75)'); strips(st, c, stalls, 'rgba(255,255,255,.55)');
  },
  downtown(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#8F959E');
    strips(st, c, [[-5.6, 5.6, za, zb]], '#41444C');
    strips(st, c, [[-5.9, -5.6, za, zb], [5.6, 5.9, za, zb]], '#C9CED5');
    const dash = [], joints = [], walk = [];
    marks(za, Math.min(zb, st.camZ + 110), 4).forEach(z => { [-LANE / 2, LANE / 2].forEach(x => dash.push([x - .07, x + .07, z, z + 2])); });
    marks(za, Math.min(zb, st.camZ + 70), 2).forEach(z => { joints.push([-9.6, -5.9, z - .04, z + .04], [5.9, 9.6, z - .04, z + .04]); });
    // a crosswalk every 55 yards
    marks(za, zb, 55, 27).forEach(z => { for (let x = -5.2; x < 5.2; x += 1.1) walk.push([x, x + .6, z, z + 3]); });
    strips(st, c, dash, 'rgba(255,255,255,.8)'); strips(st, c, joints, 'rgba(70,74,82,.35)'); strips(st, c, walk, 'rgba(255,255,255,.82)');
  },
  tundra(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#EAF1F7');
    strips(st, c, [[-5.0, 5.0, za, zb]], '#D5E0EA');
    strips(st, c, [-LANE, 0, LANE].flatMap(x => [[x - 1, x - .5, za, zb], [x + .5, x + 1, za, zb]]), 'rgba(150,172,192,.35)');
    // the banks along the road
    [-1, 1].forEach(s => {
      const xi = s * 5.1, xo = s * 7.2;
      fill(c, [P(st, xi, 0, za), P(st, xi, 0, zb), P(st, xi + s * .7, .8, zb), P(st, xi + s * .7, .8, za)], '#C8D7E4');
      fill(c, [P(st, xi + s * .7, .8, za), P(st, xi + s * .7, .8, zb), P(st, xo, .55, zb), P(st, xo, .55, za)], '#F7FAFD');
    });
  },
  west(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#E7A86F');
    strips(st, c, [-LANE, 0, LANE].map(x => [x - 1.45, x + 1.45, za, zb]), '#B58463');
    // the ties, then the rails
    const ties = [], far = Math.min(zb, st.camZ + 95);
    marks(za, far, 1.1).forEach(z => { [-LANE, 0, LANE].forEach(x => ties.push([x - 1.25, x + 1.25, z, z + .38])); });
    strips(st, c, ties, '#6E4A33');
    if (far < zb) strips(st, c, [-LANE, 0, LANE].map(x => [x - 1.25, x + 1.25, far, zb]), 'rgba(110,74,51,.55)');
    strips(st, c, [-LANE, 0, LANE].flatMap(x => [[x - .78, x - .66, za, zb], [x + .66, x + .78, za, zb]]), '#7C828C');
    strips(st, c, [-LANE, 0, LANE].flatMap(x => [[x - .76, x - .7, za, zb], [x + .7, x + .76, za, zb]]), '#D8DDE3');
  }
};
/** The ground out to FAR, each place on its own stretch, then the haze where it meets the sky. */
export function ground(st, c) {
  const zn = st.camZ + NEAR, zf = st.camZ + FAR;
  for (let i = Math.max(0, Math.floor(zn / R.ZONE)); i * R.ZONE < zf; i++) {
    const a = Math.max(zn, i * R.ZONE), b = Math.min(zf, (i + 1) * R.ZONE);
    const th = R.zoneAt(st.co, i * R.ZONE).theme;
    // (the stadium's own end zone lies behind where you field it)
    GROUNDS[th.id](st, c, i === 0 ? Math.max(zn, -12) : a, b);
  }
  // the goal line every 100 yards out of the stadium: a line across the road
  const lines = [];
  marks(zn, zf, R.TD).forEach(z => { if (themeOf(st, z).id !== 'stadium') lines.push([-5.4, 5.4, z - .22, z + .22]); });
  strips(st, c, lines, 'rgba(255,255,255,.92)');
  // (in the colour of the sky it meets: the place's, going over to the next's near a gate)
  const b = blendAt(st, st.camZ + st.back), mix = LOOK[b.now.id].haze.split(',').map((v, i) => Math.round(+v + (LOOK[b.next.id].haze.split(',')[i] - v) * b.k)).join(',');
  const H = st.H, y0 = st.y0, hz = c.createLinearGradient(0, y0, 0, y0 + (H - y0) * .2);
  hz.addColorStop(0, `rgba(${mix},.9)`); hz.addColorStop(1, `rgba(${mix},0)`);
  c.fillStyle = hz; c.fillRect(0, y0, st.W, (H - y0) * .2);
}

// ============================================================================ Beside the road
// Each place's dressing, worked out once a stretch (the same every time): [{k (kind), s (side), x, z0, z1, ...}].
const DRESS = new Map();
const CARS = ['#C8102E', '#1D3F8F', '#E8E8EC', '#2A2D33', '#7B8794', '#B98A2F', '#2E6B4F', '#5E2A84'];
const BRICK = ['#B5654A', '#D8C3A0', '#8FA5BA', '#5E7A91', '#C9B79C', '#9E4F3E', '#E3DCCF', '#6E7F8F'];
const SIGNS = ['SALOON', 'TRADING POST', 'GENERAL STORE', 'SHERIFF', 'BANK', 'HOTEL', 'BARBER', 'SALOON'];
const WOOD = ['#9A5B34', '#B06D3E', '#8A4F2E', '#C27D48'];
const DRESSERS = {
  stadium() {},
  tailgate(list, z0, z1, r) {
    for (let z = z0 + 6; z < z1 - 6; z += 3.2) [-1, 1].forEach(s => { if (r() < .7) list.push({k: 'car', s, z0: z - .95, z1: z + .95, col: CARS[Math.floor(r() * CARS.length)], h: .78 + r() * .14, suv: r() < .3}); });
    [-1, 1].forEach(s => { for (let z = z0 + 8 + r() * 6; z < z1 - 10; z += 8 + r() * 9) if (r() < .7) list.push({k: 'tent', s, x: 12.6 + r() * 2.5, z0: z, z1: z + 3.4, col: r() < .5 ? '#C8102E' : '#1D3F8F'}); });
    [-1, 1].forEach(s => { for (let z = z0 + 14 + (s > 0 ? 16 : 0); z < z1 - 6; z += 32) list.push({k: 'pole', s, z0: z, z1: z}); });
  },
  downtown(list, z0, z1, r) {
    [-1, 1].forEach(s => {
      for (let z = z0 + 5; z < z1 - 6;) {
        const e = Math.min(z1 - 5, z + 9 + r() * 16);
        list.push({k: 'bldg', s, x: 9.8 + r() * 1.5, z0: z, z1: e, h: 9 + r() * 26, col: BRICK[Math.floor(r() * BRICK.length)], awn: r() < .45 ? (r() < .5 ? '#C8102E' : '#1E6FD9') : null});
        z = e + (r() < .35 ? 3 + r() * 4 : .6);
      }
      for (let z = z0 + 10 + (s > 0 ? 12 : 0); z < z1 - 6; z += 24) list.push({k: 'lamp', s, z0: z, z1: z});
    });
  },
  tundra(list, z0, z1, r) {
    for (let z = z0 + 5; z < z1 - 5; z += 3.6) [-1, 1].forEach(s => { if (r() < .55) list.push({k: 'pine', s, x: 8.2 + r() * 20, z0: z + r() * 2, z1: z, h: 4.5 + r() * 5}); });
    [-1, 1].forEach(s => { for (let z = z0 + 12 + r() * 20; z < z1 - 20; z += 30 + r() * 30) { const e = z + 10 + r() * 14; list.push({k: 'fence', s, x: 8, z0: z, z1: e}); } });
    for (let z = z0 + 30 + r() * 40; z < z1 - 10; z += 70 + r() * 60) list.push({k: 'snowman', s: r() < .5 ? -1 : 1, x: 7.6 + r() * 2, z0: z, z1: z});
  },
  west(list, z0, z1, r) {
    [-1, 1].forEach(s => {
      for (let z = z0 + 10 + r() * 10; z < z1 - 14;) {
        if (r() < .55) { const len = 7 + r() * 5; list.push({k: 'facade', s, x: 9.6 + r() * 1.2, z0: z, z1: z + len, h: 4.2 + r() * 2.2, col: WOOD[Math.floor(r() * WOOD.length)], name: SIGNS[Math.floor(r() * SIGNS.length)]}); z += len + 4 + r() * 8; }
        else z += 10 + r() * 10;
      }
    });
    for (let z = z0 + 6; z < z1 - 5; z += 5.5) [-1, 1].forEach(s => { const u = r(); if (u < .4) list.push({k: 'cactus', s, x: 7 + r() * 18, z0: z + r() * 3, z1: z, h: 2.4 + r() * 2.8, flip: r() < .5}); else if (u < .55) list.push({k: 'rock', s, x: 7 + r() * 20, z0: z, z1: z, h: .6 + r() * 1.4}); });
    for (let z = z0 + 8; z < z1 - 4; z += 28) list.push({k: 'post', s: 1, x: 6.6, z0: z, z1: z});
    list.push({k: 'tower', s: r() < .5 ? -1 : 1, x: 15 + r() * 4, z0: z0 + 40 + r() * (R.ZONE - 80), z1: 0});
  }
};
function dressOf(st, i) {
  const key = `${st.co.n}|${st.co.k}|${i}`;
  if (DRESS.has(key)) return DRESS.get(key);
  const th = R.zoneAt(st.co, i * R.ZONE).theme, list = [];
  DRESSERS[th.id](list, i * R.ZONE, (i + 1) * R.ZONE, rnd('dress', key));
  list.forEach(o => { if (!o.z1) o.z1 = o.z0; });
  list.sort((a, b) => b.z0 - a.z0);
  if (DRESS.size > 10) DRESS.clear();
  const v = {th, list};
  DRESS.set(key, v);
  return v;
}
// The props: each drawn at its spot (s: the side, -1 left, 1 right; x: its distance out from the middle).
function glow(c, x, y, r, col) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},.75)`); g.addColorStop(.3, `rgba(${col},.25)`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
const PROPS = {
  car(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    // parked nose to the road: its side square to us, the cabin set back on the body
    const xi = o.s * 6.5, xo = o.s * 11.3, h = o.h, ch = o.suv ? .75 : .55;
    const ci = o.s * (o.suv ? 7.2 : 7.7), co = o.s * (o.suv ? 10.9 : 10.1);
    fill(c, sideQ(st, xi, .18, h, zn, o.z1), shade(o.col, .72));
    fill(c, topQ(st, h, Math.min(xi, xo), Math.max(xi, xo), zn, o.z1), shade(o.col, 1.15));
    fill(c, sideQ(st, ci, h, h + ch, zn + .12, o.z1 - .12), '#1C2530');
    fill(c, topQ(st, h + ch, Math.min(ci, co), Math.max(ci, co), Math.max(zn, o.z0 + .12), o.z1 - .12), shade(o.col, 1.05));
    if (o.z0 < zn) return;
    const s = flat(st, c, (xi + xo) / 2, 0, o.z0), L = 4.8, cl = Math.abs(co - ci), cm = (ci + co) / 2 - (xi + xo) / 2;
    c.fillStyle = o.col; rr(c, -L / 2, -h, L, h - .18, .18); c.fill();
    c.fillStyle = shade(o.col, .9); c.beginPath(); c.moveTo(cm - cl / 2 - .35, -h); c.lineTo(cm - cl / 2 + .15, -h - ch); c.lineTo(cm + cl / 2 - .1, -h - ch); c.lineTo(cm + cl / 2 + .25, -h); c.fill();
    c.fillStyle = '#26313E'; c.beginPath(); c.moveTo(cm - cl / 2 - .15, -h - .04); c.lineTo(cm - cl / 2 + .25, -h - ch + .1); c.lineTo(cm + cl / 2 - .2, -h - ch + .1); c.lineTo(cm + cl / 2 + .08, -h - .04); c.fill();
    c.fillStyle = shade(o.col, .9); c.fillRect(cm - .05, -h - ch, .1, ch);
    c.fillStyle = '#15181D'; [-L / 2 + .95, L / 2 - .95].forEach(x => { c.beginPath(); c.arc(x, -.36, .36, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = '#9AA1AB'; [-L / 2 + .95, L / 2 - .95].forEach(x => { c.beginPath(); c.arc(x, -.36, .15, 0, Math.PI * 2); c.fill(); });
    c.restore(); void s;
  },
  tent(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const xa = o.s * o.x, xb = o.s * (o.x + 3.4), top = 3.1;
    c.strokeStyle = '#C9CDD4'; c.lineWidth = Math.max(.6, P(st, xa, 0, o.z1).s * .06); c.beginPath();
    [[xa, o.z1], [xb, o.z1], [xa, Math.max(zn, o.z0)], [xb, Math.max(zn, o.z0)]].forEach(([x, z]) => { const a = P(st, x, 0, z), b = P(st, x, top, z); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); });
    c.stroke();
    if (o.z0 < zn) return;
    const pk = P(st, (xa + xb) / 2, top + .9, (o.z0 + o.z1) / 2);
    fill(c, [P(st, xa, top, o.z1), P(st, xb, top, o.z1), pk], shade(o.col, .7));
    fill(c, [P(st, xa, top, o.z0), P(st, xa, top, o.z1), pk], shade(o.col, .85));
    fill(c, [P(st, xb, top, o.z0), P(st, xb, top, o.z1), pk], shade(o.col, .85));
    fill(c, [P(st, xa, top, o.z0), P(st, xb, top, o.z0), pk], o.col);
    const A = P(st, Math.min(xa, xb), top, o.z0), B = P(st, Math.max(xa, xb), top - .3, o.z0);
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#FFFFFF' : o.col; c.fillRect(A.x + (B.x - A.x) * i / 6, A.y, (B.x - A.x) / 6 + .5, B.y - A.y); }
  },
  pole(st, c, o) {
    if (o.z0 < st.camZ + NEAR) return;
    const x = o.s * 5.9, a = P(st, x, 0, o.z0), b = P(st, x, 9, o.z0), hd = P(st, x - o.s * .7, 9, o.z0);
    c.strokeStyle = '#2B2F38'; c.lineWidth = Math.max(.7, a.s * .14); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(hd.x, hd.y); c.stroke();
    c.fillStyle = '#FFF4D8'; c.fillRect(hd.x - a.s * .45, hd.y - a.s * .1, a.s * .9, a.s * .25);
    glow(c, hd.x, hd.y, a.s * 3.2, '255,236,190');
  },
  bldg(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const xi = o.s * o.x, xo = o.s * 32, far = o.z0 - st.camZ > 95;
    fill(c, sideQ(st, xi, 0, o.h, zn, o.z1), shade(o.col, .82));
    if (!far) {
      // windows on the face to the street, floor on floor (one fill)
      c.fillStyle = 'rgba(40,62,88,.78)'; c.beginPath();
      for (let y = 3; y < o.h - 1.2; y += 2.2) for (let z = o.z0 + .8; z < o.z1 - 1; z += 2.4) { if (z + 1.1 <= zn) continue; path(c, sideQ(st, xi, y, y + 1.2, Math.max(zn, z), z + 1.1)); }
      c.fill();
      fill(c, sideQ(st, xi, 0, 2.3, zn, o.z1), 'rgba(30,36,46,.55)');
      if (o.awn) fill(c, sideQ(st, xi, 2.3, 2.75, zn, o.z1), o.awn);
    }
    if (o.z0 < zn) return;
    const A = P(st, Math.min(xi, xo), o.h, o.z0), B = P(st, Math.max(xi, xo), 0, o.z0);
    c.fillStyle = o.col; c.fillRect(A.x, A.y, B.x - A.x, B.y - A.y);
    if (far) return;
    c.fillStyle = 'rgba(40,62,88,.7)';
    const s = A.s, inner = o.s < 0 ? B.x : A.x;
    for (let y = 3; y < o.h - 1.2; y += 2.2) for (let u = .8; u < 21; u += 2.4) {
      const x = o.s < 0 ? inner - (u + 1.1) * s : inner + u * s;
      if (x > st.W || x + 1.1 * s < 0) continue;
      c.fillRect(x, B.y - (y + 1.2) * s, 1.1 * s, 1.2 * s);
    }
  },
  lamp(st, c, o) {
    if (o.z0 < st.camZ + NEAR) return;
    const x = o.s * 6.1, a = P(st, x, 0, o.z0), b = P(st, x, 6.4, o.z0), hd = P(st, x - o.s * 1.4, 6.6, o.z0);
    c.strokeStyle = '#30353D'; c.lineWidth = Math.max(.7, a.s * .13); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(hd.x, hd.y); c.stroke();
    c.fillStyle = '#E9EEF3'; c.fillRect(hd.x - a.s * .35, hd.y, a.s * .7, a.s * .16);
  },
  pine(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    const s = flat(st, c, o.s * o.x, 0, o.z0), h = o.h;
    c.fillStyle = '#5A4030'; c.fillRect(-.22, -h * .2, .44, h * .2);
    [[.2, .62, .44], [.45, .5, .38], [.68, .36, .32]].forEach(([y, w, th]) => {
      c.fillStyle = '#2E5A45'; c.beginPath(); c.moveTo(0, -h * (y + th)); c.lineTo(-h * w * .5, -h * y); c.lineTo(h * w * .5, -h * y); c.fill();
      c.fillStyle = '#F2F7FA'; c.beginPath(); c.moveTo(0, -h * (y + th)); c.lineTo(-h * w * .22, -h * (y + th * .55)); c.lineTo(h * w * .25, -h * (y + th * .5)); c.fill();
      c.fillRect(-h * w * .5, -h * y - .12, h * w, .14);
    });
    c.restore(); void s;
  },
  fence(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const x = o.s * o.x;
    fill(c, sideQ(st, x, .15, 1.15, zn, o.z1), 'rgba(242,108,38,.78)');
    c.strokeStyle = '#6B4A33'; c.lineWidth = 1; c.beginPath();
    marks(zn, o.z1, 2.5, o.z0).forEach(z => { const a = P(st, x, 0, z), b = P(st, x, 1.3, z); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); });
    c.stroke();
  },
  snowman(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.fillStyle = '#F7FAFD'; [[.5, .5], [1.25, .36], [1.78, .26]].forEach(([y, r]) => { c.beginPath(); c.arc(0, -y, r, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = '#1A1D22'; c.fillRect(-.24, -2.3, .48, .26); c.fillRect(-.33, -2.06, .66, .06);
    c.fillStyle = '#F07A1E'; c.beginPath(); c.moveTo(0, -1.8); c.lineTo(.32, -1.75); c.lineTo(0, -1.72); c.fill();
    c.fillStyle = '#C8102E'; c.fillRect(-.36, -1.56, .72, .12);
    c.restore();
  },
  cactus(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const h = o.h, w = h * .14, f = o.flip ? -1 : 1;
    c.fillStyle = '#3F8E4C';
    rr(c, -w / 2, -h, w, h, w / 2); c.fill();
    rr(c, f * w * .4, -h * .55, w * 1.3, w * .7, w * .35); c.fill();
    rr(c, f * (w * 1.05) - w * .38 + (f < 0 ? -w * .2 : w * .45), -h * .82, w * .75, h * .33, w * .38); c.fill();
    rr(c, -f * w * 1.6, -h * .42, w * 1.25, w * .7, w * .35); c.fill();
    rr(c, -f * w * 1.6 - (f > 0 ? 0 : -w * .5), -h * .64, w * .72, h * .26, w * .36); c.fill();
    c.strokeStyle = 'rgba(30,80,40,.6)'; c.lineWidth = w * .1; c.beginPath(); c.moveTo(-w * .15, -h * .95); c.lineTo(-w * .15, -h * .05); c.moveTo(w * .18, -h * .95); c.lineTo(w * .18, -h * .05); c.stroke();
    c.restore();
  },
  rock(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const h = o.h;
    c.fillStyle = '#B5653E'; c.beginPath(); c.moveTo(-h, 0); c.lineTo(-h * .8, -h * .7); c.lineTo(-h * .1, -h); c.lineTo(h * .7, -h * .8); c.lineTo(h * 1.1, 0); c.fill();
    c.fillStyle = '#D98A5A'; c.beginPath(); c.moveTo(-h * .8, -h * .7); c.lineTo(-h * .1, -h); c.lineTo(h * .7, -h * .8); c.lineTo(h * .1, -h * .55); c.fill();
    c.restore();
  },
  post(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    const a = P(st, o.s * o.x, 0, o.z0), b = P(st, o.s * o.x, 7.5, o.z0), s = a.s;
    c.strokeStyle = '#5B3E2A'; c.lineWidth = Math.max(.7, s * .2); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.moveTo(b.x - s * 1, b.y + s * .5); c.lineTo(b.x + s * 1, b.y + s * .5); c.stroke();
  },
  facade(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const xi = o.s * o.x, xo = o.s * (o.x + 7);
    fill(c, sideQ(st, xi, 0, o.h, zn, o.z1), shade(o.col, .78));
    // the porch roof along the street side, and the boardwalk
    fill(c, sideQ(st, xi - o.s * .9, 2.6, 2.9, zn, o.z1), '#7A3E26');
    fill(c, gnd(st, Math.min(xi, xi - o.s * 1.2), Math.max(xi, xi - o.s * 1.2), zn, o.z1), '#9C6A44');
    c.fillStyle = 'rgba(60,30,20,.35)'; c.beginPath();
    for (let y = .8; y < o.h; y += .8) path(c, sideQ(st, xi, y, y + .08, zn, o.z1));
    c.fill();
    if (o.z0 < zn) return;
    // the false front, facing us, with its sign
    const s = flat(st, c, (xi + xo) / 2, 0, o.z0), w = 7, top = o.h + 1.6;
    c.fillStyle = o.col; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -o.h); c.lineTo(-w / 2 + .6, -o.h); c.lineTo(-w / 2 + .6, -top); c.lineTo(w / 2 - .6, -top); c.lineTo(w / 2 - .6, -o.h); c.lineTo(w / 2, -o.h); c.lineTo(w / 2, 0); c.fill();
    c.fillStyle = 'rgba(60,30,20,.3)'; for (let y = .7; y < top; y += .7) c.fillRect(-w / 2 + (y > o.h ? .6 : 0), -y, w - (y > o.h ? 1.2 : 0), .06);
    c.fillStyle = '#2C4A2E'; rr(c, -w / 2 + .9, -top + .3, w - 1.8, 1.15, .1); c.fill();
    c.strokeStyle = '#E8C46A'; c.lineWidth = .08; rr(c, -w / 2 + 1, -top + .4, w - 2, .95, .08); c.stroke();
    c.fillStyle = '#F2D27A'; c.font = `800 ${(o.name.length > 8 ? .62 : .8)}px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(o.name, 0, -top + .88);
    c.fillStyle = '#3A2216'; c.fillRect(-.7, -2.3, 1.4, 2.3);
    c.fillStyle = '#8C7AE6'; c.fillRect(-2.6, -3.6, 1.2, .9); c.fillRect(1.4, -3.6, 1.2, .9);
    c.fillStyle = '#C0392B'; c.beginPath(); c.moveTo(-w / 2, -2.9); c.lineTo(w / 2, -2.9); c.lineTo(w / 2 + .4, -2.4); c.lineTo(-w / 2 - .4, -2.4); c.fill();
    c.restore(); void s;
  },
  tower(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 3) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.strokeStyle = '#5B3E2A'; c.lineWidth = .22; c.beginPath();
    [[-1.4, -1], [1.4, 1], [-.6, -.4], [.6, .4]].forEach(([a, b]) => { c.moveTo(a, 0); c.lineTo(b, -6); });
    c.moveTo(-1.2, -2); c.lineTo(1.2, -4); c.moveTo(1.2, -2); c.lineTo(-1.2, -4); c.stroke();
    c.fillStyle = '#9A5B34'; rr(c, -1.8, -9.2, 3.6, 3.4, .3); c.fill();
    c.fillStyle = 'rgba(60,30,20,.4)'; c.fillRect(-1.8, -8.2, 3.6, .14); c.fillRect(-1.8, -6.8, 3.6, .14);
    c.fillStyle = '#6B3D24'; c.beginPath(); c.moveTo(-2.1, -9.1); c.lineTo(0, -10.6); c.lineTo(2.1, -9.1); c.fill();
    c.restore();
  }
};
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = v => clamp(Math.round(v * k), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
/** What stands beside the road out to FAR, far to near on each side; and the pylons at each goal line. */
export function sides(st, c) {
  const zn = st.camZ + NEAR, zf = st.camZ + FAR - 20;
  const all = [];
  for (let i = Math.max(0, Math.floor(zn / R.ZONE)); i * R.ZONE < zf; i++) {
    dressOf(st, i).list.forEach(o => { if (o.z1 >= zn - 1 && o.z0 <= zf) all.push(o); });
  }
  all.sort((a, b) => b.z0 - a.z0);
  all.forEach(o => PROPS[o.k](st, c, o));
  marks(zn + 1, zf, R.TD).forEach(z => {
    const stad = themeOf(st, z).id === 'stadium', x = stad ? HALF : 5.6;
    [-1, 1].forEach(s => {
      const A = P(st, s * x - .2, .55, z), B = P(st, s * x + .2, 0, z);
      c.fillStyle = '#FF7A1A'; c.fillRect(A.x, A.y, B.x - A.x, B.y - A.y);
    });
  });
}

// ============================================================================ The vehicles
// A box in perspective: the side we see, the top (we're above it), the front (square to us, a rectangle on the
// screen: decorated in yards about its bottom middle). o: {side, top, front: colours; sideDeco(sx, za, zb),
// topDeco(za, zb), frontDeco(w, h) (in the front's yards, y up = minus)}.
function box(st, c, b, o) {
  const zn = nearOf(st, b.z0, b.z1);
  if (zn == null) return;
  const sx = st.camX < b.x0 ? b.x0 : st.camX > b.x1 ? b.x1 : null;
  if (sx != null) { fill(c, sideQ(st, sx, b.y0, b.y1, zn, b.z1), o.side); if (o.sideDeco) o.sideDeco(sx, zn, b.z1); }
  if (st.camH > b.y1) { fill(c, topQ(st, b.y1, b.x0, b.x1, zn, b.z1), o.top); if (o.topDeco) o.topDeco(zn, b.z1); }
  if (b.z0 >= zn) {
    flat(st, c, (b.x0 + b.x1) / 2, b.y0, b.z0);
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    c.fillStyle = o.front; c.fillRect(-w / 2, -h, w, h);
    if (o.frontDeco) o.frontDeco(w, h);
    c.restore();
  }
}
/** Windows along a side, z from za to zb every pitch (one fill). */
function windows(st, c, sx, ya, yb, z0, z1, pitch, gap, zn, zb, col) {
  c.fillStyle = col; c.beginPath();
  for (let z = z0; z + pitch - gap <= z1 + .01; z += pitch) {
    const a = Math.max(z, zn), b = Math.min(z + pitch - gap, zb);
    if (b > a) path(c, sideQ(st, sx, ya, yb, a, b));
  }
  c.fill();
}
function wheels(st, c, sx, list, r, zn, zb, col = '#14161A') {
  list.forEach(z => {
    if (z - r < zn || z + r > zb + .01) return;
    const m = P(st, sx, r, z), a = P(st, sx, r, z - r), b = P(st, sx, r, z + r), g = P(st, sx, 0, z);
    const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(g.y - m.y);
    if (rx < .3) return;
    c.fillStyle = col; c.beginPath(); c.ellipse((a.x + b.x) / 2, m.y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9AA1AB'; c.beginPath(); c.ellipse((a.x + b.x) / 2, m.y, rx * .45, ry * .45, 0, 0, Math.PI * 2); c.fill();
  });
}
function lights(w, h, y, col = '#FFF6D6') {
  return c => { c.fillStyle = col; [-1, 1].forEach(s => { c.beginPath(); c.arc(s * w * .36, -y, .17, 0, Math.PI * 2); c.fill(); }); };
}
const HW = 1.25, LW = 1.15;
const VEHICLES = {
  // ---------------------------------------------------------------- the stadium: the team bus; the bench
  stadium: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#1D3F8F', side: '#16326F', top: '#2E52A6',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .5, za, zb), '#0D1B40');
          fill(c, sideQ(st, sx, 1.2, 1.34, za, zb), '#3EF08F');
          windows(st, c, sx, 1.6, 2.55, p.z0 + 2.6, p.z1 - .6, 1.8, .22, za, zb, '#0B1532');
          wheels(st, c, sx, [p.z0 + 2, p.z1 - 2.4], .55, za, zb);
        },
        topDeco: (za, zb) => { c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); marks(za, zb - 2, 5, p.z0 + 3).forEach(z => path(c, topQ(st, b.y1, b.x0 + .5, b.x1 - .5, z, z + 1.6))); c.fill(); },
        frontDeco: (w, h) => {
          c.fillStyle = '#0B1532'; rr(c, -w / 2 + .15, -h + .55, w - .3, 1.15, .12); c.fill();
          c.fillStyle = 'rgba(160,200,255,.25)'; c.beginPath(); c.moveTo(-w / 2 + .3, -h + 1.6); c.lineTo(-w / 2 + .9, -h + .6); c.lineTo(-w / 2 + 1.3, -h + .6); c.lineTo(-w / 2 + .7, -h + 1.6); c.fill();
          c.fillStyle = '#05080F'; c.fillRect(-w / 2 + .3, -h + .12, w - .6, .36);
          c.fillStyle = '#3EF08F'; c.font = `800 .3px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GRIDIRON', 0, -h + .31);
          c.fillStyle = '#3EF08F'; c.fillRect(-w / 2, -1.34, w, .14);
          c.fillStyle = '#0D1B40'; c.fillRect(-w / 2 + .5, -.95, w - 1, .45);
          lights(w, h, .75)(c);
          c.fillStyle = '#2A2F3A'; c.fillRect(-w / 2, -.22, w, .22);
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#1D3F8F', side: '#152E66', top: '#24448C',
        sideDeco: (sx, za, zb) => { fill(c, sideQ(st, sx, 0, .45, za, zb), 'rgba(5,10,25,.55)'); fill(c, sideQ(st, sx, .62, .7, za, zb), 'rgba(255,255,255,.75)'); },
        topDeco: (za, zb) => { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); marks(za, zb, .6, p.z0).forEach(z => path(c, topQ(st, b.y1, b.x0, b.x1, z, z + .08))); c.fill(); },
        frontDeco: (w, h) => {
          c.fillStyle = 'rgba(5,10,25,.55)'; c.fillRect(-w / 2 + .15, -.45, w - .3, .45);
          c.fillStyle = '#F07A1E'; rr(c, -.35, -.95, .7, .8, .12); c.fill();
          c.fillStyle = '#FFFFFF'; c.fillRect(-.35, -.7, .7, .12);
        }});
    }
  },
  // ---------------------------------------------------------------- the tailgate: an RV; a beer pong table
  tailgate: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#EEE6D6', side: '#D4CBB9', top: '#F6F1E6',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .45, za, zb), '#6E6658');
          fill(c, sideQ(st, sx, .95, 1.15, za, zb), '#7A4A2B'); fill(c, sideQ(st, sx, 1.2, 1.32, za, zb), '#E07B39');
          windows(st, c, sx, 1.65, 2.35, p.z0 + 1.6, p.z1 - 1.2, 3.4, 1.6, za, zb, '#253041');
          wheels(st, c, sx, [p.z0 + 2.2, p.z1 - 3.4, p.z1 - 2.2], .5, za, zb);
        },
        topDeco: (za, zb) => { fill(c, topQ(st, b.y1, b.x0 + .4, b.x1 - .4, Math.max(za, p.z0 + 4), Math.max(za, p.z0 + 5.4)), '#C9C2B4'); },
        frontDeco: (w, h) => {
          c.fillStyle = '#253041'; rr(c, -w / 2 + .1, -h + .9, w - .2, .95, .2); c.fill();
          c.fillStyle = 'rgba(255,200,150,.3)'; c.fillRect(-w / 2 + .3, -h + 1, .5, .75);
          c.fillStyle = '#7A4A2B'; c.fillRect(-w / 2, -1.15, w, .2); c.fillStyle = '#E07B39'; c.fillRect(-w / 2, -1.32, w, .12);
          lights(w, h, .7)(c);
          c.fillStyle = '#4A4438'; c.fillRect(-w / 2, -.25, w, .25);
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#2B2D31', side: '#232428', top: '#F4F3EE',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, .78, .95, za, zb), '#E6E4DC');
          c.fillStyle = '#C9CCD2'; c.beginPath();
          marks(za, zb, 2.7, p.z0).forEach(z => { path(c, sideQ(st, sx, 0, .78, Math.max(za, z + .2), z + .35)); path(c, sideQ(st, sx, 0, .78, Math.max(za, z + 2.35), Math.min(zb, z + 2.5))); });
          c.fill();
        },
        topDeco: (za, zb) => {
          // the cups racked at each end of each table
          const X = (b.x0 + b.x1) / 2;
          c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath();
          marks(za, zb, 2.7, p.z0).forEach(z => { const a = P(st, b.x0, b.y1, z), e = P(st, b.x1, b.y1, z); c.moveTo(a.x, a.y); c.lineTo(e.x, e.y); });
          c.stroke();
          for (let z = p.z0; z < p.z1 - .3; z += 2.7) [[z + .25, 1], [z + 2.45, -1]].forEach(([z1, dir]) => {
            for (let row = 0; row < 3; row++) for (let i = 0; i <= row; i++) {
              const cz = z1 + dir * row * .22, cx = X + (i - row / 2) * .24;
              if (cz < za + .1 || cz > zb) continue;
              const q = P(st, cx, b.y1, cz), r = q.s * .1;
              if (r < .4) continue;
              c.fillStyle = '#D21F2B'; c.fillRect(q.x - r, q.y - r * 1.6, r * 2, r * 1.6);
              c.fillStyle = '#FFFFFF'; c.fillRect(q.x - r, q.y - r * 1.6, r * 2, r * .3);
            }
          });
        },
        frontDeco: (w, h) => {
          c.fillStyle = '#E6E4DC'; c.fillRect(-w / 2, -h, w, .17);
          c.fillStyle = '#C9CCD2'; c.fillRect(-w / 2 + .2, -h + .17, .15, h - .17); c.fillRect(w / 2 - .35, -h + .17, .15, h - .17);
        }});
    }
  },
  // ---------------------------------------------------------------- downtown: the city bus; road work
  downtown: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#E9EDF2', side: '#CBD2DA', top: '#B9C1CB',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .4, za, zb), '#3C424B');
          fill(c, sideQ(st, sx, .55, 1.1, za, zb), '#1F6FE0');
          windows(st, c, sx, 1.35, 2.55, p.z0 + 1.8, p.z1 - .4, 2.1, .18, za, zb, '#1E2A3A');
          wheels(st, c, sx, [p.z0 + 2, p.z1 - 2.4], .52, za, zb);
        },
        topDeco: (za, zb) => fill(c, topQ(st, b.y1, b.x0 + .5, b.x1 - .5, Math.max(za, p.z0 + 3), Math.max(za, Math.min(zb, p.z0 + 6))), '#A3ACB7'),
        frontDeco: (w, h) => {
          c.fillStyle = '#111317'; c.fillRect(-w / 2 + .15, -h + .1, w - .3, .42);
          c.fillStyle = '#FF9B21'; c.font = `800 .3px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('17  STADIUM', 0, -h + .31);
          c.fillStyle = '#1E2A3A'; rr(c, -w / 2 + .12, -h + .62, w - .24, 1.5, .1); c.fill();
          c.fillStyle = 'rgba(200,225,255,.25)'; c.beginPath(); c.moveTo(w / 2 - .4, -h + .7); c.lineTo(w / 2 - .9, -h + 2); c.lineTo(w / 2 - 1.2, -h + 2); c.lineTo(w / 2 - .7, -h + .7); c.fill();
          c.fillStyle = '#1F6FE0'; c.fillRect(-w / 2, -1.1, w, .5);
          lights(w, h, .45)(c);
          c.strokeStyle = '#3C424B'; c.lineWidth = .06; c.strokeRect(-.6, -1.0, 1.2, .5);
        }});
    },
    lo(st, c, b, p) {
      const stripe = (sx, za, zb) => {
        c.fillStyle = '#FFFFFF'; c.beginPath();
        marks(za, zb, 1.2, p.z0).forEach(z => { const a = Math.max(za, z), e = Math.min(zb, z + .55); if (e > a) path(c, sideQ(st, sx, .2, .85, a, e)); });
        c.fill();
      };
      box(st, c, b, {front: '#F26B1D', side: '#D85A14', top: '#F58A3C',
        sideDeco: (sx, za, zb) => { fill(c, sideQ(st, sx, 0, .2, za, zb), '#40444C'); stripe(sx, za, zb); },
        topDeco: (za, zb) => {
          const on = Math.floor(performance.now() / 380) % 2;
          marks(za + .5, zb, 2.4, p.z0 + 1).forEach((z, i) => { const q = P(st, (b.x0 + b.x1) / 2, b.y1 + .12, z); if ((i + on) % 2) glow(c, q.x, q.y, q.s * .7, '255,190,60'); c.fillStyle = '#FFC53D'; c.beginPath(); c.arc(q.x, q.y, Math.max(.8, q.s * .1), 0, Math.PI * 2); c.fill(); });
        },
        frontDeco: (w, h) => {
          c.save(); c.beginPath(); c.rect(-w / 2, -h + .1, w, h - .3); c.clip();
          c.fillStyle = '#FFFFFF'; for (let x = -w; x < w; x += .6) { c.beginPath(); c.moveTo(x, -.2); c.lineTo(x + .3, -.2); c.lineTo(x + .3 + .6, -h); c.lineTo(x + .6, -h); c.fill(); }
          c.restore();
          c.fillStyle = '#40444C'; c.fillRect(-w / 2, -.2, w, .2);
        }});
    }
  },
  // ---------------------------------------------------------------- the tundra: the snowplow; a snowbank
  tundra: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#E8742A', side: '#C95F1E', top: '#F4F8FB',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .55, za, zb), '#2B2F36');
          fill(c, sideQ(st, sx, 2.75, 3, za, zb), '#F4F8FB');
          windows(st, c, sx, 1.7, 2.45, p.z0 + .4, p.z0 + 2.4, 2, .2, za, zb, '#1F2A36');
          fill(c, sideQ(st, sx, 1.1, 1.25, Math.max(za, p.z0 + 2.6), zb), '#2B2F36');
          wheels(st, c, sx, [p.z0 + 1.6, p.z1 - 3.6, p.z1 - 2], .62, za, zb);
        },
        topDeco: () => {
          const q = P(st, (b.x0 + b.x1) / 2, b.y1 + .1, Math.max(p.z0 + .4, st.camZ + NEAR + .1)), on = Math.floor(performance.now() / 300) % 2;
          c.fillStyle = on ? '#FFB020' : '#B86E10'; c.fillRect(q.x - q.s * .7, q.y - q.s * .12, q.s * 1.4, q.s * .2);
          if (on) glow(c, q.x, q.y, q.s * 1.6, '255,170,40');
        },
        frontDeco: (w, h) => {
          c.fillStyle = '#F4F8FB'; rr(c, -w / 2 - .05, -h - .12, w + .1, .3, .12); c.fill();
          c.fillStyle = '#1F2A36'; rr(c, -w / 2 + .2, -h + .5, w - .4, .95, .1); c.fill();
          c.fillStyle = 'rgba(200,225,255,.22)'; c.fillRect(-w / 2 + .35, -h + .6, .45, .75);
          lights(w, h, 1.35)(c);
          // the blade
          c.fillStyle = '#F2C230'; c.beginPath(); c.moveTo(-w / 2 - .45, 0); c.lineTo(-w / 2 - .3, -1.25); c.lineTo(w / 2 + .3, -1.05); c.lineTo(w / 2 + .45, 0); c.fill();
          c.fillStyle = '#1D1F24'; for (let x = -w / 2 - .3; x < w / 2 + .2; x += .55) { c.beginPath(); c.moveTo(x, -.08); c.lineTo(x + .25, -.08); c.lineTo(x + .5, -.32); c.lineTo(x + .25, -.32); c.fill(); }
          c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(-w / 2 - .4, -.06, w + .8, .06);
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#EEF4F9', side: '#D3E0EB', top: '#FBFDFF',
        sideDeco: (sx, za, zb) => fill(c, sideQ(st, sx, 0, .3, za, zb), 'rgba(170,192,212,.6)'),
        topDeco: (za, zb) => { c.fillStyle = 'rgba(190,210,228,.5)'; c.beginPath(); marks(za, zb, 1.7, p.z0 + .5).forEach(z => path(c, topQ(st, b.y1, b.x0 + .4, b.x1 - .6, z, z + .5))); c.fill(); },
        frontDeco: (w, h) => {
          c.fillStyle = '#FBFDFF'; rr(c, -w / 2, -h - .1, w, h + .1, .45); c.fill();
          c.fillStyle = 'rgba(170,192,212,.55)'; c.beginPath(); c.ellipse(0, -.1, w * .5, .22, 0, 0, Math.PI * 2); c.fill();
        }});
    }
  },
  // ---------------------------------------------------------------- the Wild West: a train car; a hay wagon
  west: {
    hi(st, c, b, p) {
      const col = ['#8E3B2A', '#D9A21B', '#2E7F7A', '#5C8A3A'][Math.floor(p.z0) % 4];
      box(st, c, b, {front: col, side: shade(col, .8), top: shade(col, .62),
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .7, za, zb), '#24201E');
          c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); marks(za, zb, 1.1, p.z0).forEach(z => path(c, sideQ(st, sx, .75, 2.95, z, z + .1))); c.fill();
          const mid = (p.z0 + p.z1) / 2;
          if (mid + 1.4 > za) fill(c, sideQ(st, sx, .85, 2.75, Math.max(za, mid - 1.4), Math.min(zb, mid + 1.4)), shade(col, .62));
          wheels(st, c, sx, [p.z0 + 1.4, p.z0 + 2.6, p.z1 - 2.6, p.z1 - 1.4], .38, za, zb, '#3A3533');
        },
        topDeco: (za, zb) => fill(c, topQ(st, b.y1 + .01, -.45 + (b.x0 + b.x1) / 2, .45 + (b.x0 + b.x1) / 2, za, zb), '#7B5A3C'),
        frontDeco: (w, h) => {
          c.fillStyle = '#24201E'; c.fillRect(-w / 2, -.7, w, .7);
          c.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -w / 2 + .3; x < w / 2; x += .45) c.fillRect(x, -h, .07, h - .7);
          c.strokeStyle = '#F2D27A'; c.lineWidth = .07; c.beginPath(); c.moveTo(-.25, -h + .1); c.lineTo(-.25, -.8); c.moveTo(.25, -h + .1); c.lineTo(.25, -.8);
          for (let y = -h + .35; y < -.8; y += .35) { c.moveTo(-.25, y); c.lineTo(.25, y); }
          c.stroke();
          c.fillStyle = '#5A5450'; c.fillRect(-.2, -.6, .4, .3);
          c.fillStyle = '#F4E6C8'; c.font = `800 .34px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('G.G.R.R.', 0, -h + .3);
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#E3BE5A', side: '#C9A245', top: '#EDCB6A',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .3, za, zb), 'rgba(60,40,20,.45)');
          fill(c, sideQ(st, sx, .3, .55, za, zb), '#8A5A34');
          c.fillStyle = 'rgba(120,80,30,.35)'; c.beginPath(); marks(za, zb, 1.3, p.z0).forEach(z => path(c, sideQ(st, sx, .55, .95, z, z + .08))); c.fill();
          wheels(st, c, sx, [p.z0 + 1.2, p.z1 - 1.2], .42, za, zb, '#5B3E2A');
        },
        topDeco: (za, zb) => { c.strokeStyle = 'rgba(170,120,40,.45)'; c.lineWidth = 1; c.beginPath(); marks(za, zb, .5, p.z0).forEach((z, i) => { const a = P(st, b.x0 + (i % 3) * .3, b.y1, z), e = P(st, b.x0 + (i % 3) * .3 + .9, b.y1, z + .2); c.moveTo(a.x, a.y); c.lineTo(e.x, e.y); }); c.stroke(); },
        frontDeco: (w, h) => {
          c.fillStyle = '#8A5A34'; c.fillRect(-w / 2, -.55, w, .25);
          c.fillStyle = 'rgba(60,40,20,.45)'; c.fillRect(-w / 2, -.3, w, .3);
          c.strokeStyle = 'rgba(150,100,30,.5)'; c.lineWidth = .05; c.beginPath(); for (let x = -w / 2 + .2; x < w / 2; x += .3) { c.moveTo(x, -.6); c.lineTo(x + .15, -h); } c.stroke();
        }});
    }
  }
};
const RAMPS = {
  stadium: ['#7D8794', '#5E6773', '#F2C230'],
  tailgate: ['#C9A26B', '#9C7A4C', '#E07B39'],
  downtown: ['#8D96A3', '#68717D', '#F2C230'],
  tundra: ['#E8EFF5', '#B8C8D6', '#E8742A'],
  west: ['#B7834E', '#8A5E34', '#6E4A33']
};
function ramp(st, c, p, look) {
  const X = R.xOf(null, p.lane), x0 = X - 1.15, x1 = X + 1.15, zs = p.z0 - p.ramp, zn = st.camZ + NEAR;
  if (p.z0 <= zn) return;
  let za = zs, ya = 0;
  if (za < zn) { ya = p.h * (zn - zs) / p.ramp; za = zn; }
  if (st.camX < x0 || st.camX > x1) { const sx = st.camX < x0 ? x0 : x1; fill(c, [P(st, sx, 0, za), P(st, sx, ya, za), P(st, sx, p.h, p.z0), P(st, sx, 0, p.z0)], look[1]); }
  fill(c, [P(st, x0, ya, za), P(st, x1, ya, za), P(st, x1, p.h, p.z0), P(st, x0, p.h, p.z0)], look[0]);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath();
  for (let i = 1; i < 10; i++) {
    const u = i / 10, z = zs + p.ramp * u, z2 = z + p.ramp * .025;
    if (z < za) continue;
    path(c, [P(st, x0, p.h * u, z), P(st, x1, p.h * u, z), P(st, x1, p.h * (u + .025), z2), P(st, x0, p.h * (u + .025), z2)]);
  }
  c.fill();
  // the edges in the place's colour, chevrons up the middle
  c.fillStyle = look[2]; c.beginPath();
  [[x0, x0 + .14], [x1 - .14, x1]].forEach(([a, b]) => path(c, [P(st, a, ya, za), P(st, b, ya, za), P(st, b, p.h, p.z0), P(st, a, p.h, p.z0)]));
  c.fill();
}
/** A vehicle (and its ramp) in its lane, in the place it stands in. */
export function vehicle(st, c, p) {
  const th = themeOf(st, p.z0), X = R.xOf(null, p.lane), w = p.hi ? HW : LW;
  const b = {x0: X - w, x1: X + w, y0: 0, y1: p.h, z0: p.z0, z1: p.z1};
  const zn = nearOf(st, p.z0 - (p.ramp || 0), p.z1);
  if (zn == null) return;
  fill(c, gnd(st, b.x0 - .25, b.x1 + .35, Math.max(zn, p.z0 - .2), p.z1 + .9), 'rgba(0,0,0,.26)');
  VEHICLES[th.id][p.hi ? 'hi' : 'lo'](st, c, b, p);
  if (p.ramp) ramp(st, c, p, RAMPS[th.id]);
}

// ============================================================================ The power-ups
// Each about a yard tall, drawn in yards about its middle (y down). ICONS[kind](c, t).
export const ICONS = {
  salts(c, t) {
    c.save(); c.rotate(-.35);
    c.fillStyle = '#FFFFFF'; rr(c, -.13, -.32, .26, .64, .13); c.fill();
    c.strokeStyle = 'rgba(0,40,80,.35)'; c.lineWidth = .025; c.stroke();
    c.fillStyle = '#18A35A'; c.fillRect(-.13, -.06, .26, .14);
    c.fillStyle = '#FFFFFF'; c.font = `800 .08px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('NH3', 0, .01);
    c.restore();
    c.strokeStyle = 'rgba(170,232,255,.9)'; c.lineWidth = .05; c.lineCap = 'round';
    [-.12, .04, .2].forEach((x, i) => { const ph = t * 4 + i * 2; c.beginPath(); c.moveTo(x, -.3); c.bezierCurveTo(x + .1 * Math.sin(ph), -.42, x - .1 * Math.sin(ph), -.52, x + .05 * Math.sin(ph + 1), -.62); c.stroke(); });
  },
  pills(c) {
    c.fillStyle = 'rgba(242,140,40,.95)'; rr(c, -.21, -.24, .42, .58, .06); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-.16, -.2, .07, .5);
    c.fillStyle = '#FFFFFF'; rr(c, -.25, -.38, .5, .16, .04); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = .02; for (let x = -.2; x < .25; x += .07) { c.beginPath(); c.moveTo(x, -.37); c.lineTo(x, -.23); c.stroke(); }
    c.fillStyle = '#FFFFFF'; c.fillRect(-.21, -.08, .42, .26);
    c.fillStyle = '#1D3F8F'; c.font = `800 .14px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Rx', 0, -.01);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-.15, .09, .3, .025);
  },
  booze(c) {
    c.fillStyle = '#7A3E0E'; c.beginPath(); c.moveTo(-.14, .38); c.lineTo(-.14, -.06); c.quadraticCurveTo(-.14, -.18, -.055, -.24); c.lineTo(-.055, -.42); c.lineTo(.055, -.42); c.lineTo(.055, -.24); c.quadraticCurveTo(.14, -.18, .14, -.06); c.lineTo(.14, .38); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,190,110,.35)'; c.fillRect(-.1, -.04, .05, .38);
    c.fillStyle = '#E8C547'; c.fillRect(-.065, -.47, .13, .06);
    c.fillStyle = '#F2E3B3'; c.fillRect(-.14, .04, .28, .2);
    c.fillStyle = '#C8102E'; c.fillRect(-.14, .1, .28, .05);
  }
};
const HALO = {salts: '150,225,255', pills: '255,165,60', booze: '255,214,90'};
export function item(st, c, it, t) {
  const X = R.xOf(null, it.lane), g = R.groundAt(st.co, it.lane, it.z), bob = Math.sin(t * 3 + it.i) * .12;
  if (it.z < st.camZ + NEAR + 1) return;
  const p = P(st, X, g + 1 + bob, it.z), base = P(st, X, g, it.z), s = p.s;
  if (s < 1.2) return;
  const pulse = .5 + .5 * Math.sin(t * 5 + it.i);
  c.strokeStyle = `rgba(${HALO[it.kind]},${(.35 + .35 * pulse).toFixed(2)})`; c.lineWidth = Math.max(1, s * .06);
  c.beginPath(); c.ellipse(base.x, base.y, s * .55, s * .16, 0, 0, Math.PI * 2); c.stroke();
  glow(c, p.x, p.y, s * (.75 + .15 * pulse), HALO[it.kind]);
  c.save(); c.translate(p.x, p.y); c.scale(s * 1.05, s * 1.05); c.rotate(Math.sin(t * 2 + it.i) * .18);
  ICONS[it.kind](c, t);
  c.restore();
}

// ============================================================================ The gates
// Into each place, across the road at its first yard (z): two posts, and the place's name over the lanes.
const GATES = {
  stadium(c, t) {
    c.fillStyle = '#16224A'; c.fillRect(-7, -7.8, 1, 7.8); c.fillRect(6, -7.8, 1, 7.8);
    c.fillStyle = '#0E1B45'; rr(c, -7.4, -8.6, 14.8, 2.2, .3); c.fill();
    c.strokeStyle = '#3EF08F'; c.lineWidth = .14; rr(c, -7.2, -8.4, 14.4, 1.8, .2); c.stroke();
    return ['#EAF1FF', '#3EF08F'];
  },
  tailgate(c, t) {
    c.fillStyle = '#1D3F8F'; c.fillRect(-6.9, -7.4, .7, 7.4); c.fillRect(6.2, -7.4, .7, 7.4);
    c.fillStyle = '#C8102E'; rr(c, -7.4, -8.4, 14.8, 2.1, .2); c.fill();
    c.fillStyle = '#1D3F8F'; c.fillRect(-7.4, -6.55, 14.8, .25);
    for (let i = 0; i < 15; i++) { const x = -7 + i, y = -6.1 + Math.sin(i / 14 * Math.PI) * .5, on = (i + Math.floor(t * 3)) % 3; c.fillStyle = on ? '#FFE9A8' : '#B98A2F'; c.beginPath(); c.arc(x, y, .12, 0, Math.PI * 2); c.fill(); }
    return ['#FFFFFF', '#FFD23F'];
  },
  downtown(c) {
    c.fillStyle = '#7D8590'; c.fillRect(-7.2, -8.6, .55, 8.6); c.fillRect(6.65, -8.6, .55, 8.6);
    c.strokeStyle = '#7D8590'; c.lineWidth = .12; c.beginPath(); c.moveTo(-7, -8.5); c.lineTo(7, -8.5); c.moveTo(-7, -6.3); c.lineTo(7, -6.3);
    for (let x = -7; x < 7; x += .7) { c.moveTo(x, -8.5); c.lineTo(x + .7, -6.3); } c.stroke();
    c.fillStyle = '#0B6E3A'; rr(c, -5, -8.9, 10, 2.5, .25); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = .1; rr(c, -4.8, -8.7, 9.6, 2.1, .18); c.stroke();
    return ['#FFFFFF', '#FFFFFF'];
  },
  tundra(c) {
    c.fillStyle = '#6B4A2E'; c.fillRect(-6.9, -7.6, .7, 7.6); c.fillRect(6.2, -7.6, .7, 7.6);
    c.fillStyle = '#7A5636'; rr(c, -7.2, -8.5, 14.4, 2.2, .2); c.fill();
    c.fillStyle = '#F6F9FC'; rr(c, -7.35, -8.75, 14.7, .45, .22); c.fill();
    [-6.55, 6.55].forEach(x => { rr(c, x - .45, -7.85, .9, .35, .17); c.fill(); });
    return ['#F6F9FC', '#BFE4FF'];
  },
  west(c) {
    c.fillStyle = '#7A4E2C';
    rr(c, -7.1, -8.6, .9, 8.6, .3); c.fill(); rr(c, 6.2, -8.6, .9, 8.6, .3); c.fill();
    rr(c, -7.8, -9.1, 15.6, .8, .4); c.fill();
    c.strokeStyle = 'rgba(40,20,10,.35)'; c.lineWidth = .06; for (let y = -8.2; y < 0; y += .9) { c.beginPath(); c.moveTo(-7.1, y); c.lineTo(-6.2, y + .1); c.moveTo(6.2, y); c.lineTo(7.1, y + .1); c.stroke(); }
    c.strokeStyle = '#3A3533'; c.lineWidth = .07; c.beginPath(); c.moveTo(-4, -8.3); c.lineTo(-4, -7.6); c.moveTo(4, -8.3); c.lineTo(4, -7.6); c.stroke();
    c.fillStyle = '#5E1F1A'; rr(c, -5.2, -7.7, 10.4, 1.9, .15); c.fill();
    c.strokeStyle = '#E8B36A'; c.lineWidth = .14; rr(c, -5.05, -7.55, 10.1, 1.6, .1); c.stroke();
    // a skull and horns over it
    c.fillStyle = '#F3EEE2'; c.beginPath(); c.ellipse(0, -9.55, .42, .5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#F3EEE2'; c.lineWidth = .18; c.lineCap = 'round'; c.beginPath(); c.moveTo(-.35, -9.7); c.quadraticCurveTo(-1.2, -9.9, -1.3, -10.6); c.moveTo(.35, -9.7); c.quadraticCurveTo(1.2, -9.9, 1.3, -10.6); c.stroke();
    c.fillStyle = '#3A2216'; c.beginPath(); c.arc(-.16, -9.6, .09, 0, Math.PI * 2); c.arc(.16, -9.6, .09, 0, Math.PI * 2); c.fill();
    return ['#F2D27A', '#F2D27A'];
  }
};
/** The gate into a place, at its first yard z. */
export function gate(st, c, z, th, t) {
  if (z < st.camZ + NEAR + .5) return;
  const s = flat(st, c, 0, 0, z);
  if (s < .8) { c.restore(); return; }
  const [ink, small] = GATES[th.id](c, t);
  const big = th.name.toUpperCase(), name = big.replace(/^THE /, ''), the = big.startsWith('THE ');
  const top = th.id === 'downtown' ? -8.9 : th.id === 'west' ? -7.7 : th.id === 'tundra' ? -8.5 : -8.6;
  const hgt = th.id === 'west' ? 1.9 : th.id === 'downtown' ? 2.5 : 2.2;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = small; c.font = `700 .5px ${DISPLAY}`;
  c.fillText(th.id === 'downtown' ? 'EXIT 17  ↑' : the ? 'WELCOME TO THE' : 'WELCOME TO', 0, top + hgt * .27);
  c.fillStyle = ink; c.font = `800 ${(name.length > 10 ? .95 : 1.1)}px ${DISPLAY}`;
  c.fillText(name, 0, top + hgt * .66);
  c.restore();
}

// ============================================================================ The weather
// Snow over the tundra (and coming in as you near it), dust over the desert.
export function weather(st, c, t, z) {
  const b = blendAt(st, z);
  const k = id => (b.now.id === id ? 1 - b.k : 0) + (b.next.id === id ? b.k : 0);
  const snow = k('tundra');
  if (snow > .02) {
    const r = seeded(77);
    for (let i = 0; i < 80; i++) {
      const x0 = r(), y0 = r(), sp = .35 + r() * .6, dr = r() - .5, sz = .7 + r() * 1.9;
      const x = ((x0 * st.W + Math.sin(t * .8 + i) * 14 + dr * t * 30) % st.W + st.W) % st.W, y = ((y0 * st.H + t * sp * 160) % st.H);
      c.fillStyle = `rgba(255,255,255,${(.85 * snow).toFixed(2)})`; c.beginPath(); c.arc(x, y, sz, 0, Math.PI * 2); c.fill();
    }
  }
  const dust = k('west');
  if (dust > .02) {
    const r = seeded(91);
    for (let i = 0; i < 18; i++) {
      const x = ((r() * st.W + t * (40 + r() * 60)) % (st.W + 40)) - 20, y = st.y0 + r() * (st.H - st.y0);
      c.fillStyle = `rgba(250,220,180,${(.25 * dust).toFixed(2)})`; c.beginPath(); c.arc(x, y, 1 + r() * 2, 0, Math.PI * 2); c.fill();
    }
  }
}
