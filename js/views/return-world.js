// Return Man's world (views/return.js draws with it): the places a return runs through (core/return.js THEMES), drawn
// on its canvas from behind the returner. Each place has its sky and far skyline (drawn once into a canvas of its own
// and copied in each frame; the next place's fades in as you come to its gate), its ground (the field; a parking lot;
// a city street; packed snow; the desert and its rail tracks), what stands beside the road (the walls and stands;
// parked cars, tents and light poles; buildings and street lamps; pines and snow fences; cacti, the saloon and the
// trading post), the gate into it, and its weather. In the lanes: the vehicles (boxes in perspective, each place's own,
// with their ramps), the power-ups, and the goal line every 100 yards.
// st: the view's state {W, H, y0, dpr, f, camX, camZ, camH, co (the course)}. The world in yards (x across, y up, z
// ahead); P(st, x, y, z) puts a point on the screen. Exports: P, NEAR, FAR, sky, ground, sides, vehicle, obstacle (the
// rows' barricades and banners), item, gate, weather, ICONS (the power-ups' pictures, for the HUD and the cards);
// dressList, LOOKS, OBS, GOODS_COL (for the 3D world).
// Owner: RETURN.
import * as R from '../core/return.js';
import {backdrop, bowl, seeded, sparkle} from './stadium.js';

export const NEAR = .9, FAR = 150;
const FADE = 28; // yards before a gate the next place's sky comes in over
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
/** A bull's skull, k across its horns, at (x, y) (the desert's signs and gate). */
function skull(c, x, y, k) {
  c.fillStyle = '#F3EEE2'; c.beginPath(); c.ellipse(x, y, .3 * k, .38 * k, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#F3EEE2'; c.lineWidth = .13 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - .25 * k, y - .12 * k); c.quadraticCurveTo(x - .85 * k, y - .25 * k, x - .95 * k, y - .75 * k); c.moveTo(x + .25 * k, y - .12 * k); c.quadraticCurveTo(x + .85 * k, y - .25 * k, x + .95 * k, y - .75 * k); c.stroke();
  c.fillStyle = '#3A2216'; c.beginPath(); c.arc(x - .12 * k, y - .05 * k, .07 * k, 0, Math.PI * 2); c.arc(x + .12 * k, y - .05 * k, .07 * k, 0, Math.PI * 2); c.fill();
}
/** A football, w across, at (x, y): the leather and its laces (for the signs, the banners, the pennants). */
function football(c, x, y, w) {
  c.fillStyle = '#8A3F1C'; c.beginPath(); c.ellipse(x, y, w / 2, w * .31, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(.04, w * .07); c.beginPath(); c.moveTo(x - w * .18, y); c.lineTo(x + w * .18, y);
  for (let k = -2; k <= 2; k++) { c.moveTo(x + k * w * .08, y - w * .07); c.lineTo(x + k * w * .08, y + w * .07); }
  c.stroke();
}
const hash = s => { let h = 0x811c9dc5 | 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return Math.abs(h) || 1; };
const rnd = (...k) => seeded(hash(k.join('|')) % 2147483647);

// ============================================================================ The places' looks
// haze: the far ground's colour as it meets the sky; night: the stadium's lights.
// paint: the yard markings on its road.
const LOOK = {
  stadium: {haze: '14,26,58', night: true},
  tailgate: {haze: '214,124,92', paint: 'rgba(255,255,255,.55)'},
  city: {haze: '200,224,242', paint: 'rgba(255,255,255,.7)'},
  tundra: {haze: '222,231,239', paint: 'rgba(52,96,150,.5)'},
  desert: {haze: '246,214,170', paint: 'rgba(255,248,235,.6)'},
  market: {haze: '214,234,248', paint: 'rgba(255,250,240,.6)'},
  beach: {haze: '200,236,250', paint: 'rgba(255,255,255,.65)'},
  space: {haze: '70,46,120', paint: 'rgba(160,250,255,.6)'},
  farm: {haze: '214,238,224', paint: 'rgba(255,248,230,.6)'}
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
  city(c, W, h, r) {
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
    // the stadium, at the end of the road
    const bx = W / 2, bw = W * .4, bh = Math.max(18, h * .24);
    c.fillStyle = '#C3CCD8'; c.beginPath(); c.moveTo(bx - bw / 2, h + 2); c.lineTo(bx - bw / 2 + bw * .05, h - bh); c.quadraticCurveTo(bx, h - bh * 1.22, bx + bw / 2 - bw * .05, h - bh); c.lineTo(bx + bw / 2, h + 2); c.fill();
    c.fillStyle = '#2A4B7C'; c.beginPath(); c.moveTo(bx - bw / 2 + bw * .05, h - bh); c.quadraticCurveTo(bx, h - bh * 1.22, bx + bw / 2 - bw * .05, h - bh); c.lineTo(bx + bw / 2 - bw * .06, h - bh * .84); c.quadraticCurveTo(bx, h - bh * 1.04, bx - bw / 2 + bw * .06, h - bh * .84); c.fill();
    c.fillStyle = '#9AA7B8'; for (let x = bx - bw * .42; x < bx + bw * .42; x += 5) c.fillRect(x, h - bh * .7, 2.4, bh * .6);
    c.fillStyle = '#1D3F8F'; c.fillRect(bx - bw * .16, h - bh * .78, bw * .32, bh * .3);
    football(c, bx, h - bh * .63, bh * .24);
    [-.36, -.12, .12, .36].forEach(u => { const lx = bx + u * bw, ly = h - bh * 1.28 - (Math.abs(u) < .2 ? 5 : 0); c.fillStyle = '#5D6B80'; c.fillRect(lx - .7, ly, 1.4, bh * .3); c.fillStyle = '#F4F7FF'; c.fillRect(lx - 4, ly - 2, 8, 3.5); });
    [['#C8102E', -.3], ['#1E6FD9', .3]].forEach(([col, u]) => { const fx = bx + u * bw, fy = h - bh * 1.2; c.fillStyle = '#5D6B80'; c.fillRect(fx, fy - 9, 1, 10); c.fillStyle = col; c.beginPath(); c.moveTo(fx + 1, fy - 9); c.lineTo(fx + 8, fy - 6.5); c.lineTo(fx + 1, fy - 4); c.fill(); });
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
  desert(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#3A98E6'], [.6, '#8DCBF2'], [1, '#F7DCB4']]); c.fillRect(0, 0, W, h + 2);
    for (let i = 0; i < 4; i++) cloud(c, r() * W, h * (.1 + r() * .3), W * (.12 + r() * .1), 'rgba(255,255,255,.95)', 'rgba(214,232,246,.95)');
    // mesas and buttes: flat tops, a lit face and a shadowed one, bands of rock
    const mesa = (x, w, mh, lit, dark) => {
      const top = h - mh, k = w * .14;
      c.fillStyle = dark; c.beginPath(); c.moveTo(x - w / 2 - k, h + 2); c.lineTo(x - w / 2, top); c.lineTo(x + w / 2, top); c.lineTo(x + w / 2 + k, h + 2); c.fill();
      c.fillStyle = lit; c.beginPath(); c.moveTo(x - w / 2 - k, h + 2); c.lineTo(x - w / 2, top); c.lineTo(x + w * .1, top); c.lineTo(x + w * .02, h + 2); c.fill();
      c.strokeStyle = 'rgba(120,40,30,.22)'; c.lineWidth = 1;
      for (let y = top + 5; y < h; y += 6) { c.beginPath(); c.moveTo(x - w / 2 - k * (y - top) / mh, y); c.lineTo(x + w / 2 + k * (y - top) / mh, y); c.stroke(); }
    };
    for (let i = 0; i < 4; i++) mesa(r() * W, W * (.14 + r() * .18), h * (.14 + r() * .12), '#EDB08E', '#D69476');
    // the arch of rock down the far end of the road
    const ax = W / 2, aw = W * .3, ah = h * .46, th = aw * .2;
    c.fillStyle = '#C8613C';
    c.beginPath(); c.moveTo(ax - aw / 2 - th * .3, h + 2); c.lineTo(ax - aw / 2, h - ah * .55); c.quadraticCurveTo(ax - aw / 2, h - ah, ax, h - ah); c.quadraticCurveTo(ax + aw / 2, h - ah, ax + aw / 2, h - ah * .55); c.lineTo(ax + aw / 2 + th * .3, h + 2);
    c.lineTo(ax + aw / 2 - th, h + 2); c.lineTo(ax + aw / 2 - th, h - ah * .5); c.quadraticCurveTo(ax + aw / 2 - th, h - ah + th, ax, h - ah + th); c.quadraticCurveTo(ax - aw / 2 + th, h - ah + th, ax - aw / 2 + th, h - ah * .5); c.lineTo(ax - aw / 2 + th, h + 2); c.fill();
    c.fillStyle = 'rgba(255,190,140,.35)'; c.fillRect(ax - aw / 2 + 1, h - ah * .55, th * .35, ah * .55);
    // the canyon walls either side, in steps
    [-1, 1].forEach(sd => {
      const pts = [], x0 = sd < 0 ? 0 : W;
      let x = x0, y = h * .12 + r() * h * .08;
      pts.push([x0, h + 2], [x0, y]);
      for (let i = 0; i < 5; i++) { x += -sd * (W * (.03 + r() * .04)); pts.push([x, y]); y += h * (.06 + r() * .08); pts.push([x, y]); }
      pts.push([x - sd * W * .02, h + 2]);
      c.fillStyle = '#B9512E'; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.fill();
      c.fillStyle = '#DE7244'; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px + sd * 8, py + 4) : c.moveTo(px, py))); c.fill();
      c.strokeStyle = 'rgba(110,40,20,.25)'; c.lineWidth = 1;
      for (let yy = h * .2; yy < h; yy += 7) { c.beginPath(); c.moveTo(x0, yy); c.lineTo(x0 - sd * W * .2, yy + 2); c.stroke(); }
    });
    c.fillStyle = '#F0C28E'; c.fillRect(0, h - 5, W, 7);
  },
  market(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#3A9BE6'], [.7, '#9DD3F4'], [1, '#E3F3FB']]); c.fillRect(0, 0, W, h + 2);
    for (let i = 0; i < 4; i++) cloud(c, r() * W, h * (.1 + r() * .3), W * (.13 + r() * .1), 'rgba(255,255,255,.96)', 'rgba(210,230,246,.95)');
    c.fillStyle = '#8CC67A'; c.beginPath(); c.moveTo(0, h + 2); for (let x = 0; x <= W; x += 8) c.lineTo(x, h - 16 - 7 * Math.sin(x / W * 5 + 1)); c.lineTo(W, h + 2); c.fill();
    for (let x = 0; x < W; x += 9 + r() * 8) { c.fillStyle = r() < .5 ? '#5FA35A' : '#4E9150'; c.beginPath(); c.arc(x, h - 18 - r() * 8, 5 + r() * 5, 0, Math.PI * 2); c.fill(); }
    // the old town's houses and its church tower
    const walls = ['#F2D9B1', '#EBC8A0', '#F5E6C8', '#E8B79A', '#DCE6CC', '#F3D2C1'];
    for (let x = -6; x < W + 6;) {
      const w = 16 + r() * 18, bh = h * (.1 + r() * .14), col = walls[Math.floor(r() * walls.length)];
      if (Math.abs(x + w / 2 - W * .62) < 10) { c.fillStyle = '#E9DCC4'; c.fillRect(x + w / 2 - 6, h - bh - 40, 12, bh + 42); c.fillStyle = '#B54A33'; c.beginPath(); c.moveTo(x + w / 2 - 8, h - bh - 40); c.lineTo(x + w / 2, h - bh - 62); c.lineTo(x + w / 2 + 8, h - bh - 40); c.fill(); }
      c.fillStyle = col; c.fillRect(x, h - bh, w, bh + 2);
      c.fillStyle = r() < .5 ? '#C4573A' : '#B54A33'; c.beginPath(); c.moveTo(x - 2, h - bh); c.lineTo(x + w / 2, h - bh - w * .35); c.lineTo(x + w + 2, h - bh); c.fill();
      c.fillStyle = 'rgba(60,70,90,.55)'; for (let yy = h - bh + 4; yy < h - 4; yy += 7) for (let xx = x + 3; xx < x + w - 4; xx += 6) c.fillRect(xx, yy, 2.5, 3.5);
      x += w + 1;
    }
    c.fillStyle = 'rgba(227,243,251,.35)'; c.fillRect(0, h - 8, W, 10);
  },
  beach(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#2C98EA'], [.7, '#8ED3F6'], [1, '#D7F0FB']]); c.fillRect(0, 0, W, h + 2);
    for (let i = 0; i < 4; i++) cloud(c, r() * W, h * (.08 + r() * .32), W * (.13 + r() * .12), 'rgba(255,255,255,.96)', 'rgba(205,230,248,.95)');
    // the sea, out to the horizon, boats on it
    const sea = h * .8;
    c.fillStyle = grad(c, sea, h, [[0, '#1E9CC4'], [1, '#2CC1DE']]); c.fillRect(0, sea, W, h - sea + 2);
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const x = r() * W, y = sea + 2 + r() * (h - sea - 3); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6 + r() * 10, y); c.stroke(); }
    for (let i = 0; i < 3; i++) { const x = W * (.1 + r() * .45), y = sea + 1 + r() * 4; c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y - 9); c.lineTo(x + 5, y); c.fill(); c.fillStyle = '#7A5A3A'; c.fillRect(x - 2, y, 9, 1.6); }
    // the headland and its lighthouse
    c.fillStyle = '#B9A27A'; c.beginPath(); c.moveTo(W * .58, h + 2); c.lineTo(W * .66, h - h * .3); c.lineTo(W * .82, h - h * .42); c.lineTo(W + 2, h - h * .46); c.lineTo(W + 2, h + 2); c.fill();
    c.fillStyle = '#6F9A5A'; c.beginPath(); c.moveTo(W * .64, h - h * .29); c.lineTo(W * .82, h - h * .42); c.lineTo(W + 2, h - h * .46); c.lineTo(W + 2, h - h * .36); c.lineTo(W * .8, h - h * .33); c.fill();
    const lx = W * .84, ly = h - h * .42;
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(lx - 4, ly); c.lineTo(lx - 2.6, ly - 26); c.lineTo(lx + 2.6, ly - 26); c.lineTo(lx + 4, ly); c.fill();
    c.fillStyle = '#D83A2E'; c.fillRect(lx - 3.6, ly - 9, 7.2, 4); c.fillRect(lx - 3, ly - 19, 6, 4);
    c.fillStyle = '#FFE9A0'; c.fillRect(lx - 2.4, ly - 31, 4.8, 5); c.fillStyle = '#D83A2E'; c.beginPath(); c.moveTo(lx - 3.5, ly - 31); c.lineTo(lx, ly - 35); c.lineTo(lx + 3.5, ly - 31); c.fill();
  },
  space(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#0E0828'], [.5, '#2B1660'], [.85, '#4E2E92'], [1, '#6E50B6']]); c.fillRect(0, 0, W, h + 2);
    [[W * .3, h * .3, '255,110,200'], [W * .75, h * .55, '90,160,255']].forEach(([x, y, col]) => { const g = c.createRadialGradient(x, y, 2, x, y, W * .45); g.addColorStop(0, `rgba(${col},.28)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, W, h); });
    for (let i = 0; i < W * .5; i++) { c.fillStyle = `rgba(255,255,255,${(.3 + r() * .7).toFixed(2)})`; const sz = r() < .1 ? 1.8 : 1; c.fillRect(r() * W, r() * h, sz, sz); }
    // the big striped planet, the ringed one, the moons
    const planet = (x, y, rad, base, band) => {
      c.save(); c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.clip();
      c.fillStyle = base; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      c.fillStyle = band; for (let k = -1; k < 1; k += .28) c.fillRect(x - rad, y + rad * k, rad * 2, rad * .1);
      const g = c.createRadialGradient(x - rad * .4, y - rad * .4, rad * .2, x, y, rad * 1.05); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(20,0,40,.55)');
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); c.restore();
    };
    planet(W * .14, h * .5, W * .24, '#F08A4B', '#D8643A');
    const rx = W * .84, ry = h * .32, rr2 = W * .1;
    c.strokeStyle = 'rgba(200,236,244,.85)'; c.lineWidth = 3; c.beginPath(); c.ellipse(rx, ry, rr2 * 1.8, rr2 * .45, -.25, Math.PI, Math.PI * 2); c.stroke();
    planet(rx, ry, rr2, '#3CC6D9', '#2BA3BC');
    c.beginPath(); c.ellipse(rx, ry, rr2 * 1.8, rr2 * .45, -.25, 0, Math.PI); c.stroke();
    [[W * .55, h * .5, 7, '#9B7BE0'], [W * .42, h * .2, 4.5, '#C9B8F5'], [W * .66, h * .14, 3, '#F2B6D8']].forEach(([x, y, rad, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = '#3E3270'; c.beginPath(); c.moveTo(0, h + 2); for (let x = 0; x <= W; x += 10) c.lineTo(x, h - 6 - 9 * Math.abs(Math.sin(x / W * 7)) - r() * 3); c.lineTo(W, h + 2); c.fill();
  },
  farm(c, W, h, r) {
    c.fillStyle = grad(c, 0, h, [[0, '#3C9EEA'], [.7, '#9DD5F5'], [1, '#E5F5FB']]); c.fillRect(0, 0, W, h + 2);
    for (let i = 0; i < 5; i++) cloud(c, r() * W, h * (.08 + r() * .32), W * (.13 + r() * .12), 'rgba(255,255,255,.97)', 'rgba(210,232,246,.95)');
    const hill = (col, base, amp, f, ph) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, h + 2); for (let x = 0; x <= W; x += 6) c.lineTo(x, h - base - amp * Math.sin(x / W * f + ph)); c.lineTo(W, h + 2); c.fill(); };
    hill('#A5D17F', h * .2, h * .06, 4, .5);
    for (let x = 0; x < W; x += 6 + r() * 10) { c.fillStyle = r() < .5 ? '#5E9E48' : '#4F8C3E'; c.beginPath(); c.arc(x, h - h * .2 - h * .06 * Math.sin(x / W * 4 + .5) + 2, 3 + r() * 4, 0, Math.PI * 2); c.fill(); }
    hill('#7DBE58', h * .08, h * .04, 6, 2);
    // a barn and its silo, a windmill
    const bx = W * .28, by = h - h * .1;
    c.fillStyle = '#C23B2E'; c.fillRect(bx, by - 14, 20, 14); c.fillStyle = '#8E2A20'; c.beginPath(); c.moveTo(bx - 2, by - 14); c.lineTo(bx + 10, by - 22); c.lineTo(bx + 22, by - 14); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 1; c.strokeRect(bx + 7, by - 8, 6, 8);
    c.fillStyle = '#B7BEC6'; c.fillRect(bx + 23, by - 24, 7, 24); c.beginPath(); c.arc(bx + 26.5, by - 24, 3.5, Math.PI, 0); c.fill();
    const wx = W * .78, wy = h - h * .16;
    c.strokeStyle = '#8A8F96'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(wx - 5, wy); c.lineTo(wx, wy - 30); c.lineTo(wx + 5, wy); c.stroke();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.beginPath(); c.moveTo(wx, wy - 30); c.lineTo(wx + Math.cos(a) * 9, wy - 30 + Math.sin(a) * 9); c.stroke(); }
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
  city(st, c, za, zb) {
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
  desert(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#E7A86F');
    strips(st, c, [-LANE, 0, LANE].map(x => [x - 1.45, x + 1.45, za, zb]), '#B58463');
    // the ties, then the rails
    const ties = [], far = Math.min(zb, st.camZ + 95);
    marks(za, far, 1.1).forEach(z => { [-LANE, 0, LANE].forEach(x => ties.push([x - 1.25, x + 1.25, z, z + .38])); });
    strips(st, c, ties, '#6E4A33');
    if (far < zb) strips(st, c, [-LANE, 0, LANE].map(x => [x - 1.25, x + 1.25, far, zb]), 'rgba(110,74,51,.55)');
    strips(st, c, [-LANE, 0, LANE].flatMap(x => [[x - .78, x - .66, za, zb], [x + .66, x + .78, za, zb]]), '#7C828C');
    strips(st, c, [-LANE, 0, LANE].flatMap(x => [[x - .76, x - .7, za, zb], [x + .7, x + .76, za, zb]]), '#D8DDE3');
  },
  market(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#D6C7A8');
    strips(st, c, [[-5.4, 5.4, za, zb]], '#8F8A82');
    // the cobbles: rows across, the joints staggered row to row (out to 45 yards)
    const rows = [], joints = [], far = Math.min(zb, st.camZ + 45);
    marks(za, far, .9).forEach((z, i) => {
      rows.push([-5.4, 5.4, z, z + .07]);
      for (let x = -5.4 + (Math.round(z / .9) % 2 ? .55 : 0); x < 5.4; x += 1.1) joints.push([x, x + .07, z, z + .9]);
    });
    strips(st, c, rows, 'rgba(70,64,58,.45)'); strips(st, c, joints, 'rgba(70,64,58,.35)');
    strips(st, c, [-LANE / 2, LANE / 2].map(x => [x - .2, x + .2, za, zb]).concat([[-5.7, -5.4, za, zb], [5.4, 5.7, za, zb]]), '#E3D7BE');
  },
  beach(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#F2D7A0');
    strips(st, c, [[-160, -17, za, zb]], '#22AFD3'); strips(st, c, [[-17, -15.8, za, zb]], '#EAFBFF'); strips(st, c, [[-15.8, -13.5, za, zb]], '#E0C08A');
    strips(st, c, [[-5.4, 5.4, za, zb]], '#C9915A');
    const planks = [];
    marks(za, Math.min(zb, st.camZ + 70), .55).forEach(z => planks.push([-5.4, 5.4, z, z + .07]));
    strips(st, c, planks, 'rgba(120,72,36,.5)');
    strips(st, c, [[-5.6, -5.2, za, zb], [5.2, 5.6, za, zb]], '#8A5A30');
  },
  space(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#5A4E86');
    // craters on the moon either side
    marks(za, Math.min(zb, st.camZ + 90), 9).forEach(z => [-1, 1].forEach(sd => {
      const r = rnd('crater', Math.round(z), sd), x = sd * (8 + r() * 26), rad = .8 + r() * 2.2, zz = z + r() * 6;
      if (zz < st.camZ + NEAR + rad) return;
      const p = P(st, x, 0, zz), q = P(st, x + rad, 0, zz), rx = Math.abs(q.x - p.x);
      c.fillStyle = '#7468A4'; c.beginPath(); c.ellipse(p.x, p.y - rx * .03, rx * 1.08, rx * .32, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#433870'; c.beginPath(); c.ellipse(p.x, p.y, rx, rx * .28, 0, 0, Math.PI * 2); c.fill();
    }));
    strips(st, c, [[-5.4, 5.4, za, zb]], '#2E3148');
    strips(st, c, [[-5.9, -4.9, za, zb], [4.9, 5.9, za, zb]], 'rgba(60,242,255,.22)');
    strips(st, c, [[-5.45, -5.25, za, zb], [5.25, 5.45, za, zb]], '#5CF4FF');
    const dash = [];
    marks(za, Math.min(zb, st.camZ + 110), 4).forEach(z => { [-LANE / 2, LANE / 2].forEach(x => dash.push([x - .07, x + .07, z, z + 2])); });
    strips(st, c, dash, 'rgba(230,250,255,.8)');
  },
  farm(st, c, za, zb) {
    strips(st, c, [[-160, 160, za, zb]], '#69B144');
    strips(st, c, [[-5.6, 5.6, za, zb]], '#9BC25A');
    strips(st, c, [[-5.2, 5.2, za, zb]], '#C28C5A');
    strips(st, c, [-LANE, 0, LANE].flatMap(x => [[x - .95, x - .55, za, zb], [x + .55, x + .95, za, zb]]), 'rgba(140,92,52,.45)');
    const tufts = [];
    marks(za, Math.min(zb, st.camZ + 60), 1.7).forEach(z => [-LANE / 2, LANE / 2].forEach(x => tufts.push([x - .1, x + .1, z, z + .6])));
    strips(st, c, tufts, 'rgba(120,170,70,.6)');
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
  // out of the stadium each place is a field too: the goal line across the road, a hash every 5 yards by the edges, the
  // 50 painted in the middle
  const lines = [];
  marks(zn, zf, R.TD).forEach(z => { if (themeOf(st, z).id !== 'stadium') lines.push([-5.4, 5.4, z - .22, z + .22]); });
  strips(st, c, lines, 'rgba(255,255,255,.92)');
  for (let i = Math.max(1, Math.floor(zn / R.ZONE)); i * R.ZONE < zf; i++) {
    const z0 = i * R.ZONE, look = LOOK[R.zoneAt(st.co, z0).theme.id];
    if (!look.paint) continue;
    const hs = [];
    marks(Math.max(zn, z0 + 1), Math.min(zf, z0 + R.ZONE - 1, st.camZ + 90), 5, z0).forEach(z => hs.push([-4.95, -4.2, z - .09, z + .09], [4.2, 4.95, z - .09, z + .09]));
    strips(st, c, hs, look.paint);
    const mid = z0 + R.ZONE / 2;
    if (mid > zn + 2 && mid < st.camZ + 90) {
      const p = P(st, 0, 0, mid);
      c.save(); c.translate(p.x, p.y); c.scale(1, .42);
      c.font = `800 ${Math.max(6, p.s * 3.2).toFixed(1)}px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillStyle = look.paint; c.fillText('50', 0, 0);
      c.restore();
    }
  }
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
  city(list, z0, z1, r) {
    [-1, 1].forEach(s => {
      for (let z = z0 + 5; z < z1 - 6;) {
        const e = Math.min(z1 - 5, z + 9 + r() * 16);
        list.push({k: 'bldg', s, x: 10.4 + r() * 1.5, z0: z, z1: e, h: 9 + r() * 26, col: BRICK[Math.floor(r() * BRICK.length)], awn: r() < .45 ? (r() < .5 ? '#C8102E' : '#1E6FD9') : null});
        z = e + (r() < .35 ? 3 + r() * 4 : .6);
      }
      for (let z = z0 + 8 + (s > 0 ? 9 : 0); z < z1 - 6; z += 18) list.push({k: 'lamp', s, z0: z, z1: z, flag: r() < .5 ? '#1E4FB8' : '#C8102E'});
      for (let z = z0 + 14 + (s > 0 ? 0 : 9); z < z1 - 6; z += 18) list.push({k: 'palm', s, x: 7.6, z0: z, z1: z, h: 6 + r() * 2});
      for (let z = z0 + 20 + r() * 20; z < z1 - 6; z += 35 + r() * 20) list.push({k: 'hydrant', s, x: 6.4, z0: z, z1: z});
    });
  },
  tundra(list, z0, z1, r) {
    for (let z = z0 + 5; z < z1 - 5; z += 3.6) [-1, 1].forEach(s => { if (r() < .55) list.push({k: 'pine', s, x: 8.2 + r() * 20, z0: z + r() * 2, z1: z, h: 4.5 + r() * 5}); });
    [-1, 1].forEach(s => { for (let z = z0 + 12 + r() * 20; z < z1 - 20; z += 30 + r() * 30) { const e = z + 10 + r() * 14; list.push({k: 'fence', s, x: 8, z0: z, z1: e}); } });
    for (let z = z0 + 30 + r() * 40; z < z1 - 10; z += 70 + r() * 60) list.push({k: 'snowman', s: r() < .5 ? -1 : 1, x: 7.6 + r() * 2, z0: z, z1: z});
  },
  desert(list, z0, z1, r) {
    [-1, 1].forEach(s => {
      for (let z = z0 + 10 + r() * 10; z < z1 - 14;) {
        if (r() < .55) { const len = 7 + r() * 5; list.push({k: 'facade', s, x: 9.6 + r() * 1.2, z0: z, z1: z + len, h: 4.2 + r() * 2.2, col: WOOD[Math.floor(r() * WOOD.length)], name: SIGNS[Math.floor(r() * SIGNS.length)]}); z += len + 4 + r() * 8; }
        else z += 10 + r() * 10;
      }
    });
    for (let z = z0 + 6; z < z1 - 5; z += 5.5) [-1, 1].forEach(s => { const u = r(); if (u < .4) list.push({k: 'cactus', s, x: 7 + r() * 18, z0: z + r() * 3, z1: z, h: 2.4 + r() * 2.8, flip: r() < .5}); else if (u < .55) list.push({k: 'rock', s, x: 7 + r() * 20, z0: z, z1: z, h: .6 + r() * 1.4}); });
    for (let z = z0 + 8; z < z1 - 4; z += 28) list.push({k: 'post', s: 1, x: 6.6, z0: z, z1: z});
    list.push({k: 'tower', s: r() < .5 ? -1 : 1, x: 15 + r() * 4, z0: z0 + 20 + r() * (R.ZONE - 40), z1: 0});
    for (let z = z0 + 9; z < z1 - 6; z += 16) list.push({k: 'pennant', s: (Math.round(z / 16) % 2) ? 1 : -1, x: 6.5, z0: z, z1: z, col: '#C8102E'});
    for (let z = z0 + 5; z < z1 - 5; z += 7) [-1, 1].forEach(s => { const u = r(); if (u < .18) list.push({k: 'wheel', s, x: 7.4 + r() * 2, z0: z + r() * 4, z1: 0}); else if (u < .36) list.push({k: 'barrel', s, x: 7.2 + r() * 2.5, z0: z + r() * 4, z1: 0}); });
  },
  market(list, z0, z1, r) {
    const AWN = [['#D8392B', '#FFFFFF'], ['#2E9E4F', '#FFFFFF'], ['#2C6FD1', '#FFFFFF'], ['#F2A81D', '#FFFFFF']], GOODS = Object.keys(GOODS_COL);
    const walls = ['#F2D9B1', '#EBC8A0', '#F5E6C8', '#E8B79A', '#DCE6CC', '#F3D2C1'];
    [-1, 1].forEach(s => {
      for (let z = z0 + 5 + r() * 3; z < z1 - 8; z += 4.2 + r() * 1.6) list.push({k: 'stall', s, x: 6.3, z0: z, z1: z + 3.4, awn: AWN[Math.floor(r() * AWN.length)], goods: [0, 1, 2].map(() => GOODS[Math.floor(r() * GOODS.length)])});
      for (let z = z0 + 4; z < z1 - 5;) { const e = Math.min(z1 - 4, z + 8 + r() * 8); list.push({k: 'house', s, x: 11.4, z0: z, z1: e, h: 6.5 + r() * 4.5, col: walls[Math.floor(r() * walls.length)], roof: r() < .5 ? '#C4573A' : '#B54A33', shut: r() < .5 ? '#3F7A4A' : '#2F5E8E'}); z = e + .3; }
      for (let z = z0 + 9 + (s > 0 ? 11 : 0); z < z1 - 6; z += 22) list.push({k: 'lamp2', s, x: 5.95, z0: z, z1: z});
    });
    for (let z = z0 + 16; z < z1 - 10; z += 24) list.push({k: 'bunting', s: 1, x: 0, z0: z, z1: z});
  },
  beach(list, z0, z1, r) {
    const HUTS = ['#3FB6D8', '#F2C230', '#F27BA8', '#5CC48A', '#F28C3A'];
    [-1, 1].forEach(s => list.push({k: 'rope', s, x: 5.75, z0: z0 + 2, z1: z1 - 2}));
    for (let z = z0 + 6; z < z1 - 6; z += 8 + r() * 5) [-1, 1].forEach(s => { if (r() < .6) list.push({k: 'palm', s, x: s < 0 ? 7.5 + r() * 4 : 8 + r() * 12, z0: z + r() * 3, z1: 0, h: 5.5 + r() * 3}); });
    for (let z = z0 + 8 + r() * 6; z < z1 - 10; z += 11 + r() * 6) list.push({k: 'hut', s: 1, x: 10 + r() * 3, z0: z, z1: 0, col: HUTS[Math.floor(r() * HUTS.length)]});
    for (let z = z0 + 5; z < z1 - 5; z += 6 + r() * 4) { const s = r() < .5 ? -1 : 1, u = r(); list.push(u < .55 ? {k: 'umbrella', s, x: 7.5 + r() * 5, z0: z, z1: 0, col: HUTS[Math.floor(r() * HUTS.length)]} : {k: 'surf', s, x: 6.8 + r() * 5, z0: z, z1: 0, col: HUTS[Math.floor(r() * HUTS.length)]}); }
    list.push({k: 'lifeguard', s: -1, x: 10.5, z0: z0 + 25 + r() * 50, z1: 0});
  },
  space(list, z0, z1, r) {
    [-1, 1].forEach(s => {
      for (let z = z0 + 8 + r() * 8; z < z1 - 10; z += 14 + r() * 12) list.push({k: 'dome', s, x: 9 + r() * 7, z0: z, z1: 0, w: 3.5 + r() * 2.5});
      for (let z = z0 + 6 + (s > 0 ? 6 : 0); z < z1 - 4; z += 12) list.push({k: 'beacon', s, x: 6.3, z0: z, z1: 0});
      for (let z = z0 + 4; z < z1 - 4; z += 5) if (r() < .3) list.push({k: 'spire', s, x: 8 + r() * 24, z0: z + r() * 4, z1: 0, h: 1.5 + r() * 4});
    });
    list.push({k: 'rocket', s: r() < .5 ? -1 : 1, x: 17 + r() * 6, z0: z0 + 30 + r() * 40, z1: 0});
    list.push({k: 'dish', s: r() < .5 ? -1 : 1, x: 11 + r() * 5, z0: z0 + 15 + r() * 60, z1: 0});
  },
  farm(list, z0, z1, r) {
    [-1, 1].forEach(s => {
      list.push({k: 'fence2', s, x: 6.1, z0: z0 + 2, z1: z1 - 2});
      for (let z = z0 + 4; z < z1 - 6;) {
        if (r() < .7 || z > z1 - 22) { const e = Math.min(z1 - 4, z + 12 + r() * 16); list.push({k: 'corn', s, x: 8.2, z0: z, z1: e}); z = e + 1.5; }
        else {
          const u = r();
          if (u < .5) { list.push({k: 'barn', s, x: 10, z0: z + 2, z1: z + 12, h: 4.6}); list.push({k: 'silo', s, x: 20.5, z0: z + 5, z1: 0}); }
          else { list.push({k: 'tractor', s, x: 9, z0: z + 4, z1: 0}); [0, 1, 2].forEach(k => list.push({k: 'bale', s, x: 11 + k * 2.2, z0: z + 8 + r() * 3, z1: 0})); }
          z += 16;
        }
      }
      for (let z = z0 + 7; z < z1 - 5; z += 6 + r() * 6) if (r() < .45) list.push({k: 'sunflower', s, x: 6.7, z0: z, z1: 0, h: 1.6 + r() * .6});
    });
    list.push({k: 'windmill', s: r() < .5 ? -1 : 1, x: 24 + r() * 8, z0: z0 + 30 + r() * 40, z1: 0});
    for (let z = z0 + 12; z < z1 - 6; z += 20) list.push({k: 'pennant', s: (Math.round(z / 20) % 2) ? 1 : -1, x: 6.4, z0: z, z1: z, col: '#C8102E'});
  }
};
const GOODS_COL = {oranges: ['#F28C28', '#FFB255'], apples: ['#D63B2E', '#F06A55'], greens: ['#4FA845', '#7CCB5E'], corn: ['#F2C94C', '#FFE08A'], flowers: ['#E85AA0', '#FFD23F']};
function dressOf(st, i) {
  const key = `${st.co.n}|${st.co.k}|${i}`;
  if (DRESS.has(key)) return DRESS.get(key);
  const th = R.zoneAt(st.co, i * R.ZONE).theme, list = [];
  DRESSERS[th.id](list, i * R.ZONE, (i + 1) * R.ZONE, rnd('dress', key));
  list.forEach(o => { if (!o.z1) o.z1 = o.z0; o.zi = i; });
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
    if (!o.flag) return;
    // a team banner on the pole, a football on it
    flat(st, c, x, 0, o.z0);
    const d = -o.s;
    c.fillStyle = o.flag; c.beginPath(); c.moveTo(d * .1, -5.9); c.lineTo(d * 1.05, -5.9); c.lineTo(d * 1.05, -3.6); c.lineTo(d * .575, -3.95); c.lineTo(d * .1, -3.6); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = .06; c.strokeRect(Math.min(d * .18, d * .97), -5.82, .79, .1);
    football(c, d * .575, -4.8, .62);
    c.restore();
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
    if (o.name === 'SALOON' || o.name === 'TRADING POST') skull(c, 0, -top - .55, .9);
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
  },
  palm(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const h = o.h, lean = -o.s * h * .1;
    c.strokeStyle = '#8A6A45'; c.lineWidth = h * .055; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * .1, -h * .55, lean, -h); c.stroke();
    c.strokeStyle = 'rgba(70,50,30,.35)'; c.lineWidth = h * .012;
    for (let k = .12; k < .95; k += .1) { const x = lean * k * k, y = -h * k; c.beginPath(); c.moveTo(x - h * .03, y); c.lineTo(x + h * .03, y - h * .015); c.stroke(); }
    [-2.6, -2, -1.35, -.6, .1, .75, 1.35, 1.95, 2.6].forEach((a, k) => {
      const ang = -Math.PI / 2 + a * .55, L = h * (.36 + (k % 2) * .06), ex = lean + Math.cos(ang) * L, ey = -h + Math.sin(ang) * L * .7 + L * .25;
      c.fillStyle = k % 2 ? '#2F9E4A' : '#3DB25A';
      c.beginPath(); c.moveTo(lean, -h); c.quadraticCurveTo(lean + Math.cos(ang) * L * .5, -h + Math.sin(ang) * L * .5 - L * .18, ex, ey);
      c.quadraticCurveTo(lean + Math.cos(ang) * L * .45, -h + Math.sin(ang) * L * .45 + L * .05, lean, -h); c.fill();
    });
    c.fillStyle = '#6B4A2A'; [[-.25, .1], [.2, .15], [0, .3]].forEach(([dx, dy]) => { c.beginPath(); c.arc(lean + dx, -h + dy, h * .035, 0, Math.PI * 2); c.fill(); });
    c.restore();
  },
  hydrant(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.fillStyle = '#D8322B'; rr(c, -.16, -.62, .32, .62, .06); c.fill(); c.fillRect(-.24, -.45, .48, .1);
    c.beginPath(); c.arc(0, -.62, .17, Math.PI, 0); c.fill();
    c.fillStyle = '#F2C230'; c.fillRect(-.06, -.86, .12, .08);
    c.restore();
  },
  pennant(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const d = -o.s;
    c.strokeStyle = '#6B4A33'; c.lineWidth = .14; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -5.4); c.moveTo(0, -5.2); c.lineTo(d * 1.35, -5.2); c.stroke();
    c.fillStyle = o.col; c.beginPath(); c.moveTo(d * .1, -5.15); c.lineTo(d * 1.3, -5.15); c.lineTo(d * 1.3, -3.9); c.lineTo(d * .7, -2.9); c.lineTo(d * .1, -3.9); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = .06; c.beginPath(); c.moveTo(d * .1, -4.95); c.lineTo(d * 1.3, -4.95); c.stroke();
    football(c, d * .7, -4.2, .7);
    c.restore();
  },
  wheel(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.save(); c.translate(0, -.62); c.scale(.8, 1);
    c.strokeStyle = '#6B4325'; c.lineWidth = .1; c.beginPath(); c.arc(0, 0, .6, 0, Math.PI * 2); c.stroke();
    c.lineWidth = .05; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 6; c.beginPath(); c.moveTo(-Math.cos(a) * .58, -Math.sin(a) * .58); c.lineTo(Math.cos(a) * .58, Math.sin(a) * .58); c.stroke(); }
    c.fillStyle = '#4A2E1A'; c.beginPath(); c.arc(0, 0, .12, 0, Math.PI * 2); c.fill();
    c.restore(); c.restore();
  },
  barrel(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.fillStyle = '#9A5B34'; rr(c, -.36, -1, .72, 1, .14); c.fill();
    c.fillStyle = '#4A3A2E'; c.fillRect(-.37, -.85, .74, .07); c.fillRect(-.37, -.2, .74, .07);
    c.fillStyle = 'rgba(255,220,180,.2)'; c.fillRect(-.24, -.95, .1, .9);
    c.restore();
  },
  stall(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const xi = o.s * o.x, xo = o.s * (o.x + 3.4), xa = Math.min(xi, xo), xb = Math.max(xi, xo), top = 1, can = 2.75, out = xi - o.s * .45;
    fill(c, sideQ(st, xi, 0, top, zn, o.z1), '#9C6B3E');
    fill(c, sideQ(st, xi, .82, top, zn, o.z1), '#B9834F');
    // the goods on the counter, three crates of them
    for (let k = 0; k < 3; k++) {
      const a = o.z0 + .15 + k * 1.05, b = a + .95;
      if (b <= zn) continue;
      const col = GOODS_COL[o.goods[k]];
      fill(c, topQ(st, top + .12, Math.min(xi, xi + o.s * 1.3), Math.max(xi, xi + o.s * 1.3), Math.max(zn, a), b), col[0]);
      const q = P(st, xi + o.s * .6, top + .2, (Math.max(zn, a) + b) / 2);
      if (q.s > 6) { c.fillStyle = col[1]; for (let d = -1; d <= 1; d++) { c.beginPath(); c.arc(q.x + d * q.s * .28, q.y + (d & 1) * q.s * .05, q.s * .1, 0, Math.PI * 2); c.fill(); } }
    }
    // the posts, the striped awning sloping up from over the road
    c.strokeStyle = '#6B4A33'; c.lineWidth = Math.max(.6, P(st, xi, 0, o.z1).s * .07); c.beginPath();
    [o.z1, Math.max(zn, o.z0)].forEach(z => { const a = P(st, xi, 0, z), b = P(st, xi, can, z); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); });
    c.stroke();
    const n = 6, step = (o.z1 - o.z0 + .4) / n;
    for (let k = 0; k < n; k++) {
      const a = Math.max(zn, o.z0 - .2 + k * step), b = o.z0 - .2 + (k + 1) * step;
      if (b <= a) continue;
      fill(c, [P(st, out, can, a), P(st, xo, can + .7, a), P(st, xo, can + .7, b), P(st, out, can, b)], o.awn[k % 2]);
      fill(c, sideQ(st, out, can - .32, can, a, b), o.awn[(k + 1) % 2]);
    }
    if (o.z0 < zn) return;
    // the front: the counter and its crates
    flat(st, c, (xa + xb) / 2, 0, o.z0);
    const w = xb - xa;
    c.fillStyle = '#8A5A34'; c.fillRect(-w / 2, -top, w, top);
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = -.8; y < 0; y += .27) c.fillRect(-w / 2, y, w, .04);
    c.fillStyle = o.awn[0]; c.beginPath(); c.moveTo(-w / 2 - .45 * (o.s > 0 ? 1 : 0), -can); c.lineTo(w / 2 + .45 * (o.s < 0 ? 1 : 0), -can); c.lineTo(o.s > 0 ? w / 2 : -w / 2, -can - .7); c.fill();
    c.restore();
  },
  house(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const xi = o.s * o.x, xo = o.s * (o.x + 8), ridge = (xi + xo) / 2, far = o.z0 - st.camZ > 90;
    fill(c, sideQ(st, xi, 0, o.h, zn, o.z1), shade(o.col, .9));
    fill(c, [P(st, xi, o.h, zn), P(st, xi, o.h, o.z1), P(st, ridge, o.h + 2.6, o.z1), P(st, ridge, o.h + 2.6, zn)], o.roof);
    if (!far) {
      c.fillStyle = o.shut; c.beginPath();
      for (let y = 1.5; y < o.h - 1.2; y += 2.4) for (let z = o.z0 + .9; z < o.z1 - 1.2; z += 2.4) { if (z + 1.3 <= zn) continue; path(c, sideQ(st, xi, y, y + 1.3, Math.max(zn, z - .25), z + 1.25)); }
      c.fill();
      c.fillStyle = 'rgba(40,52,74,.8)'; c.beginPath();
      for (let y = 1.5; y < o.h - 1.2; y += 2.4) for (let z = o.z0 + .9; z < o.z1 - 1.2; z += 2.4) { if (z + 1 <= zn) continue; path(c, sideQ(st, xi, y + .1, y + 1.2, Math.max(zn, z), z + 1)); }
      c.fill();
    }
    if (o.z0 < zn) return;
    flat(st, c, (xi + xo) / 2, 0, o.z0);
    c.fillStyle = o.col; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-4, -o.h); c.lineTo(0, -o.h - 2.6); c.lineTo(4, -o.h); c.lineTo(4, 0); c.fill();
    c.strokeStyle = o.roof; c.lineWidth = .35; c.beginPath(); c.moveTo(-4.3, -o.h + .15); c.lineTo(0, -o.h - 2.75); c.lineTo(4.3, -o.h + .15); c.stroke();
    if (!far) { c.fillStyle = 'rgba(40,52,74,.8)'; for (let y = 1.5; y < o.h - 1.2; y += 2.4) [-2.4, 1.4].forEach(x => c.fillRect(x, -y - 1.2, 1, 1.1)); c.fillStyle = '#6B4A33'; c.fillRect(-.6, -2.1, 1.2, 2.1); }
    c.restore();
  },
  lamp2(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.fillStyle = '#23262C'; c.fillRect(-.07, -4.3, .14, 4.3); c.fillRect(-.2, -.3, .4, .3);
    c.fillStyle = '#23262C'; c.beginPath(); c.moveTo(-.32, -4.3); c.lineTo(.32, -4.3); c.lineTo(.22, -5.1); c.lineTo(-.22, -5.1); c.fill();
    c.fillStyle = '#FFE7A3'; c.fillRect(-.2, -5, .4, .6);
    c.fillStyle = '#23262C'; c.beginPath(); c.moveTo(-.3, -5.1); c.lineTo(0, -5.4); c.lineTo(.3, -5.1); c.fill();
    c.restore();
  },
  bunting(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, 0, 0, o.z0);
    const y = -7.4, sag = 1.1, x0 = -11.5, x1 = 11.5, cols = ['#D8392B', '#FFFFFF', '#2E9E4F', '#F2C230', '#2C6FD1'];
    c.strokeStyle = 'rgba(60,40,30,.75)'; c.lineWidth = .05; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(0, y + sag * 2, x1, y); c.stroke();
    for (let k = 1; k < 26; k++) {
      const t = k / 26, x = x0 + (x1 - x0) * t, yy = y + 2 * t * (1 - t) * sag * 2;
      c.fillStyle = cols[k % cols.length]; c.beginPath(); c.moveTo(x - .36, yy); c.lineTo(x + .36, yy); c.lineTo(x, yy + .8); c.fill();
    }
    c.restore();
  },
  rope(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const x = o.s * o.x, zs = marks(zn, Math.min(o.z1, st.camZ + 80), 3, o.z0);
    if (!zs.length) return;
    c.fillStyle = '#7A5230'; c.beginPath();
    zs.forEach(z => path(c, sideQ(st, x, 0, 1.05, z, z + .22)));
    c.fill();
    c.strokeStyle = '#E8D3A6'; c.lineWidth = Math.max(.6, P(st, x, 0, zs[0]).s * .04); c.beginPath();
    zs.forEach((z, i) => { if (!i) return; const a = P(st, x, .95, zs[i - 1]), m = P(st, x, .62, z - 1.5), b = P(st, x, .95, z); c.moveTo(a.x, a.y); c.quadraticCurveTo(2 * m.x - (a.x + b.x) / 2, 2 * m.y - (a.y + b.y) / 2, b.x, b.y); });
    c.stroke();
  },
  hut(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.fillStyle = o.col; c.fillRect(-1.3, -2.4, 2.6, 2.4);
    c.fillStyle = 'rgba(255,255,255,.55)'; for (let x = -1.3; x < 1.3; x += .52) c.fillRect(x, -2.4, .26, 2.4);
    c.fillStyle = '#F4F1EA'; c.beginPath(); c.moveTo(-1.6, -2.35); c.lineTo(0, -3.4); c.lineTo(1.6, -2.35); c.fill();
    c.fillStyle = '#5A3A22'; c.fillRect(-.4, -1.5, .8, 1.5);
    c.restore();
  },
  umbrella(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.strokeStyle = '#E8E2D6'; c.lineWidth = .07; c.beginPath(); c.moveTo(0, 0); c.lineTo(.15, -2.1); c.stroke();
    for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#FFFFFF' : o.col; c.beginPath(); c.moveTo(.15, -2.5); c.lineTo(-1.25 + k * .5, -1.75); c.lineTo(-.75 + k * .5, -1.75); c.fill(); }
    c.restore();
  },
  surf(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.rotate(o.s * .12); c.fillStyle = o.col; c.beginPath(); c.ellipse(0, -1, .24, 1, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#FFFFFF'; c.fillRect(-.03, -1.9, .06, 1.8);
    c.restore();
  },
  lifeguard(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.strokeStyle = '#D83A2E'; c.lineWidth = .16; c.beginPath(); [[-1, -.7], [1, .7]].forEach(([a, b]) => { c.moveTo(a, 0); c.lineTo(b, -2.6); }); c.moveTo(-.9, -1.2); c.lineTo(.9, -1.2); c.stroke();
    c.fillStyle = '#E8E2D6'; c.fillRect(-1, -2.7, 2, .12);
    c.fillStyle = '#D83A2E'; c.fillRect(-.85, -3.9, 1.7, 1.2); c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(-1.1, -3.85); c.lineTo(0, -4.5); c.lineTo(1.1, -3.85); c.fill();
    c.fillStyle = '#2B3A52'; c.fillRect(-.55, -3.6, 1.1, .5);
    c.strokeStyle = '#E8E2D6'; c.lineWidth = .05; c.beginPath(); c.moveTo(.9, -3.9); c.lineTo(.9, -5.2); c.stroke();
    c.fillStyle = '#C8102E'; c.beginPath(); c.moveTo(.9, -5.2); c.lineTo(1.6, -4.95); c.lineTo(.9, -4.7); c.fill();
    c.restore();
  },
  dome(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const w = o.w, h = w * .55, on = Math.floor(st.t * 2 + o.z0) % 2;
    c.fillStyle = '#C9CEDB'; c.fillRect(-w / 2 - .15, -.35, w + .3, .35);
    c.fillStyle = '#EEF1F7'; c.beginPath(); c.ellipse(0, -.35, w / 2, h, 0, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(120,110,170,.35)'; c.beginPath(); c.ellipse(w * .12, -.35, w * .38, h * .92, 0, Math.PI * 1.5, 0); c.lineTo(w * .12, -.35); c.fill();
    c.fillStyle = '#54E3F2'; for (let k = -2; k <= 2; k++) c.fillRect(k * w * .16 - w * .05, -h * .55, w * .1, h * .16);
    c.strokeStyle = '#9AA3B8'; c.lineWidth = .06; c.beginPath(); c.moveTo(0, -h - .35); c.lineTo(0, -h - 1.2); c.stroke();
    c.fillStyle = on ? '#FF4B5C' : '#7A2A35'; c.beginPath(); c.arc(0, -h - 1.25, .12, 0, Math.PI * 2); c.fill();
    c.restore();
  },
  dish(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.strokeStyle = '#9AA3B8'; c.lineWidth = .14; c.beginPath(); c.moveTo(-.6, 0); c.lineTo(0, -1.6); c.lineTo(.6, 0); c.stroke();
    c.save(); c.translate(0, -2.3); c.rotate(-o.s * .5);
    c.fillStyle = '#EEF1F7'; c.beginPath(); c.ellipse(0, 0, 1.5, .55, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#C9CEDB'; c.beginPath(); c.ellipse(0, 0, 1.5, .18, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#9AA3B8'; c.lineWidth = .06; c.beginPath(); c.moveTo(0, .4); c.lineTo(0, -1); c.stroke();
    c.restore(); c.restore();
  },
  rocket(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 3) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.strokeStyle = '#8A93A8'; c.lineWidth = .1; c.beginPath();
    for (let y = 0; y > -7; y -= 1) { c.moveTo(1.2, y); c.lineTo(2, y - 1); c.moveTo(2, y); c.lineTo(1.2, y - 1); } c.moveTo(1.2, 0); c.lineTo(1.2, -7.4); c.moveTo(2, 0); c.lineTo(2, -7.4); c.stroke();
    c.fillStyle = '#5A6074'; c.fillRect(-1.4, -.4, 3.8, .4);
    c.fillStyle = '#F4F6FA'; rr(c, -.55, -7, 1.1, 6.6, .2); c.fill();
    c.fillStyle = '#E2453C'; c.beginPath(); c.moveTo(-.55, -7); c.quadraticCurveTo(0, -9, .55, -7); c.fill();
    c.beginPath(); c.moveTo(-.55, -2); c.lineTo(-1.2, -.4); c.lineTo(-.55, -.9); c.fill(); c.beginPath(); c.moveTo(.55, -2); c.lineTo(1.2, -.4); c.lineTo(.55, -.9); c.fill();
    c.fillStyle = '#2B3A62'; c.beginPath(); c.arc(0, -5.4, .25, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1D3F8F'; c.fillRect(-.55, -3.6, 1.1, .22);
    c.restore();
  },
  spire(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const h = o.h;
    c.fillStyle = '#4B3F7C'; c.beginPath(); c.moveTo(-h * .4, 0); c.lineTo(-h * .12, -h); c.lineTo(h * .1, -h * .85); c.lineTo(h * .38, 0); c.fill();
    c.fillStyle = '#6E5FAE'; c.beginPath(); c.moveTo(-h * .4, 0); c.lineTo(-h * .12, -h); c.lineTo(-h * .02, -h * .4); c.lineTo(0, 0); c.fill();
    c.restore();
  },
  beacon(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    const s = flat(st, c, o.s * o.x, 0, o.z0), on = Math.floor(st.t * 3 + o.z0 / 12) % 2;
    c.fillStyle = '#4A4F66'; c.fillRect(-.06, -1.6, .12, 1.6);
    c.fillStyle = on ? '#5CF4FF' : '#2A7C88'; c.beginPath(); c.arc(0, -1.7, .14, 0, Math.PI * 2); c.fill();
    c.restore();
    if (on) { const q = P(st, o.s * o.x, 1.7, o.z0); glow(c, q.x, q.y, s * .8, '92,244,255'); }
  },
  fence2(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const x = o.s * o.x, zf = Math.min(o.z1, st.camZ + 90);
    if (zf <= zn) return;
    c.fillStyle = '#B98A5A'; c.beginPath(); path(c, sideQ(st, x, .55, .68, zn, zf)); path(c, sideQ(st, x, 1, 1.13, zn, zf)); c.fill();
    c.fillStyle = '#8A5E34'; c.beginPath();
    marks(zn, zf - .2, 2.4, o.z0).forEach(z => path(c, sideQ(st, x, 0, 1.3, z, z + .18)));
    c.fill();
  },
  corn(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const xi = o.s * o.x, xo = o.s * 40, h = 2.3, near = Math.min(o.z1, st.camZ + 55);
    fill(c, topQ(st, h, Math.min(xi, xo), Math.max(xi, xo), zn, o.z1), '#A9C24E');
    c.fillStyle = 'rgba(90,130,40,.45)'; c.beginPath();
    for (let k = 1; k < 30; k += 1.2) path(c, topQ(st, h, o.s > 0 ? xi + k : xi - k - .35, o.s > 0 ? xi + k + .35 : xi - k, zn, o.z1));
    c.fill();
    fill(c, sideQ(st, xi, 0, h, zn, o.z1), '#4E9A3C');
    if (near > zn) {
      c.fillStyle = 'rgba(40,100,30,.6)'; c.beginPath();
      marks(zn, near, .5, o.z0).forEach(z => path(c, sideQ(st, xi, 0, h, z, z + .12)));
      c.fill();
      c.fillStyle = '#F2C94C'; c.beginPath();
      marks(zn, near, 1.4, o.z0 + .4).forEach(z => path(c, sideQ(st, xi, 1.05, 1.45, z, z + .22)));
      c.fill();
      c.fillStyle = '#E8D27A'; c.beginPath();
      marks(zn, near, .5, o.z0 + .2).forEach(z => path(c, sideQ(st, xi, h, h + .3, z, z + .1)));
      c.fill();
    }
  },
  barn(st, c, o) {
    const zn = nearOf(st, o.z0, o.z1); if (zn == null) return;
    const xi = o.s * o.x, xo = o.s * (o.x + 8), h = o.h, ridge = (xi + xo) / 2;
    fill(c, sideQ(st, xi, 0, h, zn, o.z1), '#B2362A');
    fill(c, [P(st, xi, h, zn), P(st, xi, h, o.z1), P(st, ridge, h + 2.6, o.z1), P(st, ridge, h + 2.6, zn)], '#5E4A44');
    const dm = (o.z0 + o.z1) / 2;
    if (dm + 1.6 > zn) {
      fill(c, sideQ(st, xi, 0, 3, Math.max(zn, dm - 1.6), dm + 1.6), '#8E2A20');
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.2; const A = P(st, xi, 3, Math.max(zn, dm - 1.6)), B = P(st, xi, 0, dm + 1.6), C = P(st, xi, 0, Math.max(zn, dm - 1.6)), D = P(st, xi, 3, dm + 1.6);
      c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.moveTo(C.x, C.y); c.lineTo(D.x, D.y); c.stroke();
    }
    if (o.z0 < zn) return;
    flat(st, c, (xi + xo) / 2, 0, o.z0);
    c.fillStyle = '#C23B2E'; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-4, -h); c.lineTo(0, -h - 2.6); c.lineTo(4, -h); c.lineTo(4, 0); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = .14; c.beginPath(); c.moveTo(-4, -h); c.lineTo(0, -h - 2.6); c.lineTo(4, -h); c.stroke();
    c.strokeRect(-1.4, -3, 2.8, 3); c.beginPath(); c.moveTo(-1.4, -3); c.lineTo(1.4, 0); c.moveTo(1.4, -3); c.lineTo(-1.4, 0); c.stroke();
    c.fillStyle = '#5E2A20'; c.fillRect(-.6, -h - .3, 1.2, 1.2); c.strokeRect(-.6, -h - .3, 1.2, 1.2);
    c.restore();
  },
  silo(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.fillStyle = '#B8C0C8'; c.fillRect(-1.1, -8, 2.2, 8);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-.8, -8, .4, 8);
    c.fillStyle = 'rgba(80,90,100,.3)'; for (let y = -7; y < 0; y += 1.2) c.fillRect(-1.1, y, 2.2, .08);
    c.fillStyle = '#9AA3AD'; c.beginPath(); c.arc(0, -8, 1.1, Math.PI, 0); c.fill();
    c.restore();
  },
  windmill(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 3) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.strokeStyle = '#8A8F96'; c.lineWidth = .12; c.beginPath(); c.moveTo(-1.2, 0); c.lineTo(-.2, -8); c.moveTo(1.2, 0); c.lineTo(.2, -8);
    for (let y = -1.5; y > -8; y -= 1.5) { const w = 1.2 - (-y / 8) * 1; c.moveTo(-w, y); c.lineTo(w, y - 1.5 * 0); } c.stroke();
    const a0 = (st.t || 0) * 1.6;
    c.strokeStyle = '#C9CED6'; c.lineWidth = .16;
    for (let k = 0; k < 12; k++) { const a = a0 + k * Math.PI / 6; c.beginPath(); c.moveTo(0, -8.3); c.lineTo(Math.cos(a) * 1.8, -8.3 + Math.sin(a) * 1.8); c.stroke(); }
    c.fillStyle = '#C23B2E'; c.beginPath(); c.moveTo(.2, -8.4); c.lineTo(2.2, -8.8); c.lineTo(2.2, -7.9); c.fill();
    c.restore();
  },
  bale(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    c.fillStyle = '#E3BE5A'; c.beginPath(); c.arc(0, -.8, .8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(150,110,30,.55)'; c.lineWidth = .06; c.beginPath(); for (let a = 0; a < 12; a += .3) { const r = .08 + a * .06; c.lineTo(Math.cos(a) * r, -.8 + Math.sin(a) * r); } c.stroke();
    c.restore();
  },
  tractor(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 2) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const d = o.s;
    c.fillStyle = '#C8322B'; rr(c, -1.6, -1.9, 3.2, 1.1, .15); c.fill();
    c.fillStyle = '#C8322B'; c.fillRect(-.2 * d - .5, -3.2, 1.6, 1.3);
    c.fillStyle = '#9FD3F4'; c.fillRect(-.2 * d - .35, -3.05, 1.3, .8);
    c.fillStyle = '#2A2A2E'; c.fillRect(d * 1.2 - .06, -2.9, .12, 1.1);
    c.fillStyle = '#1E1F23'; c.beginPath(); c.arc(-d * .9, -.95, .95, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(d * 1.1, -.5, .5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F2C230'; c.beginPath(); c.arc(-d * .9, -.95, .4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(d * 1.1, -.5, .2, 0, Math.PI * 2); c.fill();
    c.restore();
  },
  sunflower(st, c, o) {
    if (o.z0 < st.camZ + NEAR + 1) return;
    flat(st, c, o.s * o.x, 0, o.z0);
    const h = o.h;
    c.strokeStyle = '#3E8E3A'; c.lineWidth = .08; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -h); c.stroke();
    c.fillStyle = '#4FA845'; c.beginPath(); c.ellipse(.2, -h * .5, .25, .1, -.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F7C62F'; for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; c.beginPath(); c.ellipse(Math.cos(a) * .25, -h + Math.sin(a) * .25, .16, .07, a, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#6B3E1E'; c.beginPath(); c.arc(0, -h, .16, 0, Math.PI * 2); c.fill();
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
  // what stands in the places ahead comes up out of the haze as you near their gate (60 yards off: nothing yet; 25:
  // all of it), so each place keeps its own look till you're nearly there
  const at = st.camZ + st.back;
  all.forEach(o => {
    const a = o.zi * R.ZONE <= at ? 1 : clamp(1 - (o.zi * R.ZONE - at - 25) / 35, 0, 1);
    if (a <= 0) return;
    c.globalAlpha = a;
    PROPS[o.k](st, c, o);
  });
  c.globalAlpha = 1;
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
  // ---------------------------------------------------------------- the city: the city bus; road work
  city: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#F2F4F7', side: '#DCE1E8', top: '#C9D0D9',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .4, za, zb), '#3C424B');
          fill(c, sideQ(st, sx, .55, 1.1, za, zb), '#D8322B');
          fill(c, sideQ(st, sx, 2.7, 2.95, za, zb), '#1E4FB8');
          windows(st, c, sx, 1.35, 2.55, p.z0 + 1.8, p.z1 - .4, 2.1, .18, za, zb, '#1E2A3A');
          wheels(st, c, sx, [p.z0 + 2, p.z1 - 2.4], .52, za, zb);
        },
        topDeco: (za, zb) => fill(c, topQ(st, b.y1, b.x0 + .7, b.x1 - .7, za, zb), '#1E4FB8'),
        frontDeco: (w, h) => {
          c.fillStyle = '#111317'; c.fillRect(-w / 2 + .15, -h + .1, w - .3, .42);
          c.fillStyle = '#FF9B21'; c.font = `800 .3px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('17  STADIUM', 0, -h + .31);
          c.fillStyle = '#1E2A3A'; rr(c, -w / 2 + .12, -h + .62, w - .24, 1.5, .1); c.fill();
          c.fillStyle = 'rgba(200,225,255,.25)'; c.beginPath(); c.moveTo(w / 2 - .4, -h + .7); c.lineTo(w / 2 - .9, -h + 2); c.lineTo(w / 2 - 1.2, -h + 2); c.lineTo(w / 2 - .7, -h + .7); c.fill();
          c.fillStyle = '#D8322B'; c.fillRect(-w / 2, -1.1, w, .5);
          lights(w, h, .45)(c);
          badge(c, 0, -1.55, .5);
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
  // ---------------------------------------------------------------- the desert: a train car; a hay wagon
  desert: {
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
  },
  // ---------------------------------------------------------------- the farmers market: a produce truck; an apple cart
  market: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#2E9E4F', side: '#E9ECE6', top: '#F4F6F2',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .5, za, zb), '#3A3F45');
          fill(c, sideQ(st, sx, .5, 3, za, Math.min(zb, p.z0 + 2.4)), '#2E9E4F');
          windows(st, c, sx, 1.7, 2.5, p.z0 + .5, p.z0 + 2.1, 1.6, .1, za, zb, '#1F2A36');
          // the fruit painted down its side, crate on crate
          const cols = ['#F28C28', '#D63B2E', '#4FA845', '#F2C94C'];
          cols.forEach((col, k) => { c.fillStyle = col; c.beginPath(); for (let z = p.z0 + 3 + k * 1.6; z < p.z1 - 1; z += 6.4) { const a = Math.max(za, z), e = Math.min(zb, z + 1.3); if (e > a) path(c, sideQ(st, sx, .9, 2.2, a, e)); } c.fill(); });
          fill(c, sideQ(st, sx, 2.45, 2.62, Math.max(za, p.z0 + 2.4), zb), '#2E9E4F');
          wheels(st, c, sx, [p.z0 + 1.5, p.z1 - 2.2], .5, za, zb);
        },
        frontDeco: (w, h) => {
          c.fillStyle = '#1F2A36'; rr(c, -w / 2 + .15, -h + .9, w - .3, .9, .12); c.fill();
          c.fillStyle = 'rgba(200,225,255,.25)'; c.fillRect(-w / 2 + .3, -h + 1, .45, .7);
          c.fillStyle = '#F4F6F2'; rr(c, -w / 2 + .1, -h + .1, w - .2, .6, .1); c.fill();
          c.fillStyle = '#2E9E4F'; c.font = `800 .42px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FRESH', 0, -h + .41);
          lights(w, h, .6)(c);
          c.fillStyle = '#3A3F45'; c.fillRect(-w / 2, -.25, w, .25);
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#9C6B3E', side: '#8A5A34', top: '#C9372B',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, .25, .7, za, zb), '#9C6B3E');
          c.fillStyle = 'rgba(60,30,10,.35)'; c.beginPath(); marks(za, zb, 1.1, p.z0).forEach(z => path(c, sideQ(st, sx, .25, .7, z, z + .07))); c.fill();
          wheels(st, c, sx, [p.z0 + 1.2, p.z1 - 1.2], .35, za, zb, '#5B3E2A');
        },
        topDeco: (za, zb) => {
          c.fillStyle = '#E8564A'; c.beginPath();
          marks(za, zb, .55, p.z0).forEach((z, k) => [b.x0 + .4 + (k % 2) * .3, b.x0 + 1.2 + (k % 2) * .3].forEach(x => { const q = P(st, x, b.y1 + .05, z); if (q.s > 4) { c.moveTo(q.x + q.s * .14, q.y); c.arc(q.x, q.y, q.s * .14, 0, Math.PI * 2); } }));
          c.fill();
        },
        frontDeco: (w, h) => {
          c.fillStyle = '#C9372B'; c.beginPath(); c.ellipse(0, -h + .05, w / 2, .28, 0, Math.PI, 0); c.fill();
          c.fillStyle = '#E8564A'; for (let x = -w / 2 + .25; x < w / 2; x += .42) { c.beginPath(); c.arc(x, -h + .02, .17, 0, Math.PI * 2); c.fill(); }
          c.fillStyle = 'rgba(60,30,10,.3)'; c.fillRect(-w / 2, -.5, w, .06); c.fillRect(-w / 2, -.25, w, .06);
        }});
    }
  },
  // ---------------------------------------------------------------- the beach: an ice cream truck; a sandcastle
  beach: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#FBEFF4', side: '#F2DCE6', top: '#FFFFFF',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .45, za, zb), '#4A4A55');
          fill(c, sideQ(st, sx, .55, 1, za, zb), '#F27BA8');
          windows(st, c, sx, 1.75, 2.45, p.z0 + .4, p.z0 + 2.2, 1.8, .2, za, zb, '#1F2A36');
          const mid = (p.z0 + p.z1) / 2;
          if (mid + 2 > za) {
            fill(c, sideQ(st, sx, 1.3, 2.3, Math.max(za, mid - 2), Math.min(zb, mid + 2)), '#3A2A38');
            for (let k = 0; k < 8; k++) { const a = Math.max(za, mid - 2 + k * .5), e = Math.min(zb, mid - 1.5 + k * .5); if (e > a) fill(c, sideQ(st, sx, 2.3, 2.75, a, e), k % 2 ? '#FFFFFF' : '#F27BA8'); }
          }
          wheels(st, c, sx, [p.z0 + 1.6, p.z1 - 2.2], .5, za, zb);
        },
        topDeco: (za, zb) => { c.fillStyle = 'rgba(242,123,168,.5)'; c.beginPath(); marks(za, zb, 2, p.z0 + 1).forEach(z => path(c, topQ(st, b.y1, b.x0 + .2, b.x1 - .2, z, z + .2))); c.fill(); },
        frontDeco: (w, h) => {
          c.fillStyle = '#1F2A36'; rr(c, -w / 2 + .12, -h + .55, w - .24, 1.1, .12); c.fill();
          c.fillStyle = 'rgba(200,225,255,.25)'; c.fillRect(-w / 2 + .3, -h + .65, .45, .9);
          c.fillStyle = '#F27BA8'; c.fillRect(-w / 2, -1, w, .45);
          lights(w, h, .6)(c);
          // the cone up top
          c.fillStyle = '#E2A55A'; c.beginPath(); c.moveTo(-.3, -h - .1); c.lineTo(.3, -h - .1); c.lineTo(0, -h + .55); c.fill();
          c.fillStyle = '#FBD3E3'; c.beginPath(); c.arc(0, -h - .2, .34, Math.PI, 0); c.fill(); c.fillStyle = '#E8567C'; c.beginPath(); c.arc(0, -h - .55, .1, 0, Math.PI * 2); c.fill();
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#E9C987', side: '#D9B572', top: '#F2D7A0',
        sideDeco: (sx, za, zb) => {
          c.fillStyle = '#F2D7A0'; c.beginPath(); marks(za, zb, .8, p.z0).forEach(z => path(c, sideQ(st, sx, b.y1, b.y1 + .3, z, Math.min(zb, z + .4)))); c.fill();
          c.fillStyle = 'rgba(150,110,50,.3)'; c.beginPath(); marks(za, zb, 1.6, p.z0 + .5).forEach(z => path(c, sideQ(st, sx, .35, .7, z, Math.min(zb, z + .35)))); c.fill();
        },
        frontDeco: (w, h) => {
          c.fillStyle = '#E9C987'; for (let x = -w / 2; x < w / 2 - .1; x += .5) c.fillRect(x, -h - .3, .28, .32);
          c.fillStyle = '#D9B572'; rr(c, -.35, -h - 1, .7, 1.05, .1); c.fill(); c.beginPath(); c.moveTo(-.45, -h - 1); c.lineTo(0, -h - 1.5); c.lineTo(.45, -h - 1); c.fill();
          c.strokeStyle = '#6B4A33'; c.lineWidth = .04; c.beginPath(); c.moveTo(0, -h - 1.5); c.lineTo(0, -h - 2); c.stroke();
          c.fillStyle = '#C8102E'; c.beginPath(); c.moveTo(0, -h - 2); c.lineTo(.35, -h - 1.88); c.lineTo(0, -h - 1.76); c.fill();
          c.fillStyle = 'rgba(120,80,30,.35)'; rr(c, -.18, -.55, .36, .55, .15); c.fill();
        }});
    }
  },
  // ---------------------------------------------------------------- outer space: a space shuttle; a moon rover
  space: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#F1F3F7', side: '#DADFE8', top: '#F7F8FB',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .7, za, zb), '#24262E');
          fill(c, sideQ(st, sx, 1.4, 1.6, za, zb), '#2F5BD8');
          windows(st, c, sx, 2.1, 2.55, p.z0 + .6, p.z0 + 2.6, .65, .15, za, zb, '#1A1C24');
          // a wing out the side, low
          const wa = Math.max(za, p.z1 - 9), wb = p.z1 - 1, out = sx + (sx > (b.x0 + b.x1) / 2 ? .7 : -.7);
          if (wb > wa) fill(c, [P(st, sx, .8, wa), P(st, out, .75, Math.max(wa, wb - 3)), P(st, out, .75, wb), P(st, sx, .8, wb)], '#C9CED8');
        },
        topDeco: (za, zb) => { c.fillStyle = 'rgba(40,44,60,.12)'; c.beginPath(); marks(za, zb, 1.5, p.z0 + 2).forEach(z => path(c, topQ(st, b.y1, b.x0 + .3, b.x1 - .3, z, z + .06))); c.fill(); },
        frontDeco: (w, h) => {
          c.fillStyle = '#F1F3F7'; rr(c, -w / 2, -h, w, h, .9); c.fill();
          c.fillStyle = '#24262E'; c.beginPath(); c.ellipse(0, -.55, w / 2, .5, 0, 0, Math.PI); c.fill(); c.fillRect(-w / 2, -.7, w, .2);
          c.fillStyle = '#1A1C24'; [[-.7, -2.1], [-.22, -2.2], [.22, -2.2], [.7, -2.1]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x - .2, y); c.lineTo(x + .2, y); c.lineTo(x + .17, y + .32); c.lineTo(x - .17, y + .32); c.fill(); });
          c.fillStyle = '#2F5BD8'; c.fillRect(-w / 2 + .2, -1.6, w - .4, .2);
          c.fillStyle = '#2F5BD8'; c.font = `800 .3px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GRIDIRON', 0, -1.05);
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#C9CED6', side: '#AEB4C0', top: '#25356E',
        sideDeco: (sx, za, zb) => { fill(c, sideQ(st, sx, .35, .95, za, zb), '#C9CED6'); wheels(st, c, sx, marks(za + .4, zb, 1.8, p.z0 + .6), .38, za, zb, '#2A2C34'); },
        topDeco: (za, zb) => { c.strokeStyle = 'rgba(120,180,255,.5)'; c.lineWidth = 1; c.beginPath(); marks(za, zb, .6, p.z0).forEach(z => { const a = P(st, b.x0, b.y1, z), e = P(st, b.x1, b.y1, z); c.moveTo(a.x, a.y); c.lineTo(e.x, e.y); }); c.stroke(); },
        frontDeco: (w, h) => {
          c.fillStyle = '#2A2C34'; c.fillRect(-w / 2, -.35, w, .35);
          c.fillStyle = '#5CF4FF'; [-1, 1].forEach(sg => { c.beginPath(); c.arc(sg * w * .3, -.62, .13, 0, Math.PI * 2); c.fill(); });
          c.strokeStyle = '#9AA3B8'; c.lineWidth = .06; c.beginPath(); c.moveTo(w * .35, -h); c.lineTo(w * .35, -h - .7); c.stroke();
          c.fillStyle = '#FF4B5C'; c.beginPath(); c.arc(w * .35, -h - .75, .08, 0, Math.PI * 2); c.fill();
        }});
    }
  },
  // ---------------------------------------------------------------- the farm: a combine; hay bales
  farm: {
    hi(st, c, b, p) {
      box(st, c, b, {front: '#3E8E3A', side: '#347A31', top: '#4FA34A',
        sideDeco: (sx, za, zb) => {
          fill(c, sideQ(st, sx, 0, .6, za, zb), '#24261F');
          fill(c, sideQ(st, sx, 1.1, 1.25, za, zb), '#F2C230');
          windows(st, c, sx, 1.8, 2.7, p.z0 + 1.6, p.z0 + 3.6, 2, .15, za, zb, '#1F2A36');
          wheels(st, c, sx, [p.z0 + 2.4], .85, za, zb, '#1E1F23');
          wheels(st, c, sx, [p.z1 - 2], .55, za, zb, '#1E1F23');
        },
        topDeco: (za, zb) => fill(c, topQ(st, b.y1, b.x0 + .25, b.x1 - .25, Math.max(za, p.z0 + 4), zb), '#E3BE5A'),
        frontDeco: (w, h) => {
          c.fillStyle = '#1F2A36'; rr(c, -w / 2 + .3, -h + .3, w - .6, 1, .1); c.fill();
          c.fillStyle = 'rgba(200,225,255,.25)'; c.fillRect(-w / 2 + .45, -h + .4, .4, .8);
          // the header out front: the reel and its bars
          c.fillStyle = '#F2C230'; rr(c, -w / 2 - .4, -1.25, w + .8, 1.25, .25); c.fill();
          c.strokeStyle = '#B88A12'; c.lineWidth = .07; c.beginPath(); for (let y = -1.05; y < -.1; y += .25) { c.moveTo(-w / 2 - .3, y); c.lineTo(w / 2 + .3, y); } c.stroke();
          c.fillStyle = '#24261F'; for (let x = -w / 2 - .2; x < w / 2 + .3; x += .3) c.fillRect(x, -.12, .14, .12);
        }});
    },
    lo(st, c, b, p) {
      box(st, c, b, {front: '#E3BE5A', side: '#CFA846', top: '#EDCB6A',
        sideDeco: (sx, za, zb) => {
          c.fillStyle = 'rgba(140,100,30,.45)'; c.beginPath(); marks(za, zb, 1.1, p.z0).forEach(z => path(c, sideQ(st, sx, 0, b.y1, z, z + .06))); c.fill();
          fill(c, sideQ(st, sx, .3, .35, za, zb), 'rgba(110,80,40,.6)'); fill(c, sideQ(st, sx, .65, .7, za, zb), 'rgba(110,80,40,.6)');
        },
        topDeco: (za, zb) => { c.strokeStyle = 'rgba(170,120,40,.45)'; c.lineWidth = 1; c.beginPath(); marks(za, zb, 1.1, p.z0).forEach(z => { const a = P(st, b.x0, b.y1, z), e = P(st, b.x1, b.y1, z); c.moveTo(a.x, a.y); c.lineTo(e.x, e.y); }); c.stroke(); },
        frontDeco: (w, h) => {
          c.strokeStyle = 'rgba(150,100,30,.5)'; c.lineWidth = .05; c.beginPath(); for (let y = -h + .1; y < 0; y += .14) { c.moveTo(-w / 2, y); c.lineTo(w / 2, y + .03); } c.stroke();
          c.fillStyle = 'rgba(110,80,40,.7)'; c.fillRect(-w / 2, -.35, w, .05); c.fillRect(-w / 2, -.7, w, .05);
        }});
    }
  }
};
const RAMPS = {
  stadium: ['#7D8794', '#5E6773', '#F2C230'],
  tailgate: ['#C9A26B', '#9C7A4C', '#E07B39'],
  city: ['#8D96A3', '#68717D', '#F2C230'],
  tundra: ['#E8EFF5', '#B8C8D6', '#E8742A'],
  desert: ['#B7834E', '#8A5E34', '#6E4A33'],
  market: ['#B98E5C', '#8E6A40', '#2E9E4F'],
  beach: ['#C9915A', '#9C6A3C', '#F27BA8'],
  space: ['#7C8296', '#565C70', '#5CF4FF'],
  farm: ['#B98E5C', '#8E6A40', '#F2C230']
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
// The things on the owner's sheet (Oct 2026: "Run, Jump, Climb"), each part by part (p.part: which of its pieces).
const wood = (st, c, sx, za, zb, y0, y1, pitch, col = 'rgba(60,30,10,.3)') => { c.fillStyle = col; c.beginPath(); for (let y = y0 + pitch; y < y1 - .02; y += pitch) path(c, sideQ(st, sx, y, y + .05, za, zb)); c.fill(); };
const planks = (st, c, b, za, zb, pitch, col = 'rgba(60,30,10,.28)') => { c.fillStyle = col; c.beginPath(); marks(za, zb, pitch, b.z0).forEach(z => path(c, topQ(st, b.y1, b.x0, b.x1, z, z + .07))); c.fill(); };
/** A football on a round white badge (the sheet's mark on everything), r its radius, in the front's yards. */
function badge(c, x, y, r) {
  c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = r * .1; c.stroke();
  football(c, x, y, r * 1.35);
}
/** A pennant on the front: a team colour, a football, hanging from a little bar. */
function flag(c, x, y, col, k = 1) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x - .45 * k, y); c.lineTo(x + .45 * k, y); c.lineTo(x + .45 * k, y + .55 * k); c.lineTo(x, y + 1.05 * k); c.lineTo(x - .45 * k, y + .55 * k); c.fill();
  football(c, x, y + .42 * k, .45 * k);
}
const KIND_DRAW = {
  teambus: VEHICLES.stadium.hi, bench: VEHICLES.stadium.lo, rv: VEHICLES.tailgate.hi, pong: VEHICLES.tailgate.lo,
  citybus: VEHICLES.city.hi, plow: VEHICLES.tundra.hi, snowbank: VEHICLES.tundra.lo, train: VEHICLES.desert.hi,
  producetruck: VEHICLES.market.hi, icecream: VEHICLES.beach.hi, shuttle: VEHICLES.space.hi, combine: VEHICLES.farm.hi,
  // ---------------------------------------------------------------- the desert
  canyon(st, c, b, p) {
    box(st, c, b, {front: '#C8613C', side: '#B9512E', top: '#E39A68',
      sideDeco: (sx, za, zb) => { wood(st, c, sx, za, zb, 0, b.y1, .45, 'rgba(110,40,20,.3)'); fill(c, sideQ(st, sx, b.y1 - .25, b.y1, za, zb), '#E39A68'); },
      topDeco: (za, zb) => { c.fillStyle = 'rgba(150,80,40,.25)'; c.beginPath(); marks(za, zb, 2.3, b.z0 + .8).forEach((z, k) => { const q = P(st, (b.x0 + b.x1) / 2 + (k % 2 ? .5 : -.4), b.y1, z), w = q.s * .3; c.moveTo(q.x + w, q.y); c.ellipse(q.x, q.y, w, w * .3, 0, 0, Math.PI * 2); }); c.fill(); },
      frontDeco: (w, h) => flag(c, w / 2 - .3, -h - .2, '#C8102E', .9)});
  },
  minecart(st, c, b, p) {
    box(st, c, b, {front: '#7A5233', side: '#6B4628', top: '#3E2A1A',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, 0, .3, za, zb), '#2A2C30');
        wood(st, c, sx, za, zb, .3, b.y1, .26);
        fill(c, sideQ(st, sx, b.y1 - .14, b.y1, za, zb), '#8A929C'); fill(c, sideQ(st, sx, .3, .42, za, zb), '#8A929C');
        wheels(st, c, sx, [p.z0 + .6, p.z1 - .6], .26, za, zb, '#2A2C30');
      },
      topDeco: (za, zb) => { c.fillStyle = '#B07A48'; c.beginPath(); marks(za, zb, .55, b.z0 + .2).forEach((z, k) => path(c, topQ(st, b.y1 + .05, b.x0 + .25 + (k % 2) * .4, b.x0 + 1.3 + (k % 2) * .4, z, z + .4))); c.fill(); },
      frontDeco: (w, h) => {
        c.fillStyle = 'rgba(60,30,10,.35)'; for (let y = -h + .3; y < -.3; y += .26) c.fillRect(-w / 2, y, w, .05);
        c.fillStyle = '#8A929C'; c.fillRect(-w / 2, -h, w, .14); c.fillRect(-w / 2, -.42, w, .12); c.fillRect(-w / 2, -h, .14, h - .3); c.fillRect(w / 2 - .14, -h, .14, h - .3);
        badge(c, 0, -.72, .26);
        c.fillStyle = '#2A2C30'; c.fillRect(-w / 2 + .1, -.3, w - .2, .3);
      }});
  },
  wagonbridge(st, c, b, p) {
    box(st, c, b, {front: '#9C6B3E', side: '#8A5A34', top: '#C98A4E',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, 0, b.y1 - .45, za, zb), 'rgba(60,35,18,.85)');
        fill(c, sideQ(st, sx, b.y1 - .45, b.y1, za, zb), '#A86E3E');
        c.fillStyle = '#5B3E2A'; c.beginPath(); marks(za, zb, 2.2, b.z0 + .3).forEach(z => path(c, sideQ(st, sx, 0, b.y1 - .45, z, z + .25))); c.fill();
        wheels(st, c, sx, [p.z0 + 1.6, p.z1 - 1.6], .75, za, zb, '#6B4325');
      },
      topDeco: (za, zb) => planks(st, c, b, za, zb, .5),
      frontDeco: (w, h) => { c.fillStyle = '#5B3E2A'; c.fillRect(-w / 2, -h + .45, w, h - .45); flag(c, -w / 2 + .45, -h - .1, '#C8102E', .85); }});
  },
  // ---------------------------------------------------------------- the city
  parkedcar(st, c, b, p) {
    box(st, c, b, {front: '#2F5BD8', side: '#2849B0', top: '#3A68E6',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, 0, .25, za, zb), '#1E2230');
        windows(st, c, sx, .82, 1.18, p.z0 + 1.2, p.z1 - .9, 1.25, .12, za, zb, '#1C2530');
        fill(c, sideQ(st, sx, .55, .62, za, zb), '#FFFFFF');
        wheels(st, c, sx, [p.z0 + .9, p.z1 - .9], .36, za, zb);
      },
      topDeco: (za, zb) => { const X = (b.x0 + b.x1) / 2; fill(c, topQ(st, b.y1, X - .35, X - .15, za, zb), '#FFFFFF'); fill(c, topQ(st, b.y1, X + .15, X + .35, za, zb), '#FFFFFF'); },
      frontDeco: (w, h) => {
        c.fillStyle = '#1C2530'; rr(c, -w / 2 + .2, -h + .05, w - .4, .4, .08); c.fill();
        c.fillStyle = '#FFFFFF'; c.fillRect(-.3, -h, .18, h - .3); c.fillRect(.12, -h, .18, h - .3);
        c.fillStyle = '#E8323F'; c.fillRect(-w / 2 + .1, -.62, .4, .16); c.fillRect(w / 2 - .5, -.62, .4, .16);
        c.fillStyle = '#C9CED6'; c.fillRect(-w / 2, -.25, w, .2); c.fillStyle = '#F4F1E2'; c.fillRect(-.3, -.48, .6, .2);
      }});
  },
  ramptruck(st, c, b, p) {
    if (p.part === 0) {
      box(st, c, b, {front: '#4A4F58', side: '#3C4048', top: '#5E6470',
        sideDeco: (sx, za, zb) => { fill(c, sideQ(st, sx, 0, .5, za, zb), '#24262C'); fill(c, sideQ(st, sx, b.y1 - .2, b.y1, za, zb), '#F2C230'); wheels(st, c, sx, [p.z0 + 1.2, p.z0 + 2.4], .5, za, zb); },
        topDeco: (za, zb) => planks(st, c, b, za, zb, .35, 'rgba(255,255,255,.08)')});
      return;
    }
    box(st, c, b, {front: '#F2C230', side: '#D9A91B', top: '#F7D35A',
      sideDeco: (sx, za, zb) => { fill(c, sideQ(st, sx, 0, .5, za, zb), '#24262C'); windows(st, c, sx, 1.6, 2.3, p.z0 + .3, p.z1 - .2, 2.1, .1, za, zb, '#1F2A36'); wheels(st, c, sx, [p.z1 - 1.1], .5, za, zb); },
      frontDeco: (w, h) => { c.fillStyle = '#1F2A36'; rr(c, -w / 2 + .3, -h + .45, w - .6, .7, .1); c.fill(); badge(c, 0, -h + 1.75, .32); c.fillStyle = '#FF9B21'; c.fillRect(-w / 2 + .2, -h - .12, w - .4, .14); }});
  },
  // ---------------------------------------------------------------- the farmers market
  producecart(st, c, b, p) {
    const fruit = ['#D63B2E', '#F28C28', '#4FA845', '#F2C94C'];
    box(st, c, b, {front: '#9C6B3E', side: '#8A5A34', top: '#C9372B',
      sideDeco: (sx, za, zb) => { fill(c, sideQ(st, sx, 0, .3, za, zb), 'rgba(40,25,10,.6)'); wood(st, c, sx, za, zb, .3, b.y1, .28); wheels(st, c, sx, [p.z0 + .9, p.z1 - .9], .48, za, zb, '#6B4325'); },
      topDeco: (za, zb) => fruit.forEach((col, k) => { c.fillStyle = col; c.beginPath(); marks(za, zb, 1.1, b.z0 + k * .27).forEach((z, m) => [b.x0 + .35 + (m % 2) * .3, b.x0 + 1.2 + (m % 2) * .25].forEach(x => { const q = P(st, x, b.y1 + .06, z); if (q.s > 4) { c.moveTo(q.x + q.s * .13, q.y); c.arc(q.x, q.y, q.s * .13, 0, Math.PI * 2); } })); c.fill(); }),
      frontDeco: (w, h) => {
        fruit.forEach((col, k) => { c.fillStyle = col; for (let x = -w / 2 + .2 + k * .12; x < w / 2 - .1; x += .5) { c.beginPath(); c.arc(x, -h - .02 + (k % 2) * .08, .14, 0, Math.PI * 2); c.fill(); } });
        c.fillStyle = 'rgba(60,30,10,.35)'; c.fillRect(-w / 2, -.6, w, .05); c.fillRect(-w / 2, -.33, w, .05);
        flag(c, w / 2 - .5, -h + .15, '#2E9E4F', .75);
      }});
  },
  marketramp(st, c, b, p) {
    box(st, c, b, {front: '#C98A4E', side: '#B07A48', top: '#D9A866',
      sideDeco: (sx, za, zb) => { c.fillStyle = 'rgba(80,45,15,.45)'; c.beginPath(); marks(za, zb, 1.05, b.z0).forEach(z => path(c, sideQ(st, sx, 0, b.y1, z, z + .06))); path(c, sideQ(st, sx, b.y1 / 2 - .03, b.y1 / 2 + .03, za, zb)); c.fill(); },
      topDeco: (za, zb) => planks(st, c, b, za, zb, .45),
      frontDeco: (w, h) => { c.strokeStyle = 'rgba(80,45,15,.5)'; c.lineWidth = .06; c.strokeRect(-w / 2 + .05, -h + .05, w / 2 - .1, h / 2 - .1); c.strokeRect(.05, -h + .05, w / 2 - .1, h / 2 - .1); c.strokeRect(-w / 2 + .05, -h / 2 + .05, w - .1, h / 2 - .1); badge(c, 0, -h * .27, .3); }});
  },
  awning(st, c, b, p) {
    if (p.part === 0) {
      box(st, c, b, {front: '#C98A4E', side: '#B07A48', top: '#E8A04A',
        sideDeco: (sx, za, zb) => { c.fillStyle = 'rgba(80,45,15,.45)'; c.beginPath(); marks(za, zb, 1, b.z0).forEach(z => path(c, sideQ(st, sx, 0, b.y1, z, z + .06))); c.fill(); },
        topDeco: (za, zb) => { c.fillStyle = '#F28C28'; c.beginPath(); marks(za, zb, .5, b.z0 + .2).forEach((z, m) => [b.x0 + .4, b.x0 + 1.1, b.x0 + 1.8].forEach(x => { const q = P(st, x + (m % 2) * .2, b.y1 + .06, z); if (q.s > 4) { c.moveTo(q.x + q.s * .12, q.y); c.arc(q.x, q.y, q.s * .12, 0, Math.PI * 2); } })); c.fill(); },
        frontDeco: (w, h) => { c.strokeStyle = 'rgba(80,45,15,.5)'; c.lineWidth = .06; c.strokeRect(-w / 2 + .05, -h + .05, w - .1, h - .1); badge(c, 0, -h / 2, .26); }});
      return;
    }
    // the stall: posts and a counter under its striped awning (the awning is what you stand on)
    box(st, c, b, {front: 'rgba(0,0,0,0)', side: 'rgba(40,25,15,.75)', top: '#D8392B',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, 0, .95, za, zb), '#9C6B3E');
        c.fillStyle = '#6B4A33'; c.beginPath(); [p.z0 + .05, p.z1 - .25].forEach(z => { if (z + .2 > za) path(c, sideQ(st, sx, 0, b.y1, Math.max(za, z), z + .2)); }); c.fill();
        for (let z = p.z0, k = 0; z < p.z1; z += .5, k++) { const a = Math.max(za, z), e = Math.min(zb, z + .5); if (e > a) fill(c, sideQ(st, sx, b.y1 - .35, b.y1, a, e), k % 2 ? '#FFFFFF' : '#D8392B'); }
      },
      topDeco: (za, zb) => { for (let z = p.z0, k = 0; z < p.z1; z += .55, k++) { const a = Math.max(za, z), e = Math.min(zb, z + .55); if (e > a && k % 2) fill(c, topQ(st, b.y1, b.x0, b.x1, a, e), '#FFFFFF'); } },
      frontDeco: (w, h) => {
        c.fillStyle = '#6B4A33'; c.fillRect(-w / 2, -h, .18, h); c.fillRect(w / 2 - .18, -h, .18, h);
        c.fillStyle = '#9C6B3E'; c.fillRect(-w / 2, -.95, w, .95);
        for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#FFFFFF' : '#D8392B'; c.fillRect(-w / 2 + k * w / 6, -h, w / 6 + .01, .35); }
        flag(c, 0, -h + .4, '#D8392B', .8);
      }});
  },
  // ---------------------------------------------------------------- the beach
  lifeguard(st, c, b, p) {
    box(st, c, b, {front: '#C9915A', side: '#B07A48', top: '#D9A866',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, 0, b.y1 - .35, za, zb), 'rgba(40,25,15,.55)');
        c.fillStyle = '#D83A2E'; c.beginPath(); marks(za, zb, 1.8, b.z0 + .2).forEach(z => path(c, sideQ(st, sx, 0, b.y1 - .35, z, z + .22))); c.fill();
        fill(c, sideQ(st, sx, b.y1 - .35, b.y1, za, zb), '#B07A48');
      },
      topDeco: (za, zb) => planks(st, c, b, za, zb, .45),
      frontDeco: (w, h) => { c.fillStyle = '#D83A2E'; c.fillRect(-w / 2 + .1, -h + .35, .22, h - .35); c.fillRect(w / 2 - .32, -h + .35, .22, h - .35); flag(c, -w / 2 + .5, -h - .15, '#1E4FB8', .8); c.strokeStyle = '#FFFFFF'; c.lineWidth = .14; c.beginPath(); c.arc(w / 2 - .5, -h * .45, .3, 0, Math.PI * 2); c.stroke(); }});
  },
  buggy(st, c, b, p) {
    box(st, c, b, {front: '#F28C28', side: '#E07A1A', top: '#2A2C30',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, .3, .8, za, zb), '#F28C28');
        c.strokeStyle = '#1E1F23'; c.lineWidth = 1.5; c.beginPath(); [[p.z0 + .5, p.z0 + 1.3], [p.z1 - .5, p.z1 - 1.3]].forEach(([a, e]) => { if (Math.min(a, e) < za) return; const A = P(st, sx, .8, a), B = P(st, sx, b.y1, e); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); }); c.stroke();
        fill(c, sideQ(st, sx, .85, 1.0, Math.max(za, p.z0 + 1.3), p.z1 - 1.3), '#2F7DD8');
        wheels(st, c, sx, [p.z0 + .7, p.z1 - .7], .45, za, zb);
      },
      topDeco: (za, zb) => { c.strokeStyle = '#1E1F23'; c.lineWidth = 1.2; c.beginPath(); marks(za, zb, .9, b.z0 + .4).forEach(z => { const a = P(st, b.x0, b.y1, z), e = P(st, b.x1, b.y1, z); c.moveTo(a.x, a.y); c.lineTo(e.x, e.y); }); c.stroke(); },
      frontDeco: (w, h) => {
        c.strokeStyle = '#1E1F23'; c.lineWidth = .12; c.strokeRect(-w / 2 + .15, -h, w - .3, h - .8);
        c.fillStyle = '#F28C28'; c.fillRect(-w / 2, -.8, w, .5);
        c.fillStyle = '#FFE08A'; [-1, 1].forEach(sg => { c.beginPath(); c.arc(sg * w * .32, -.55, .13, 0, Math.PI * 2); c.fill(); });
        badge(c, 0, -.55, .2);
        c.fillStyle = '#1E1F23'; c.fillRect(-w / 2, -.3, w, .3);
      }});
  },
  pier(st, c, b, p) {
    box(st, c, b, {front: '#B07A48', side: 'rgba(70,45,25,.7)', top: '#C9915A',
      sideDeco: (sx, za, zb) => {
        c.fillStyle = '#5B3E2A'; c.beginPath(); marks(za, zb, 1.4, b.z0 + .1).forEach(z => path(c, sideQ(st, sx, 0, b.y1, z, Math.min(zb, z + .25)))); c.fill();
        fill(c, sideQ(st, sx, b.y1 - .25, b.y1, za, zb), '#A86E3E');
      },
      topDeco: (za, zb) => planks(st, c, b, za, zb, .4),
      frontDeco: (w, h) => {
        c.fillStyle = 'rgba(70,45,25,.75)'; c.fillRect(-w / 2, -h + .25, w, h - .25);
        c.fillStyle = '#5B3E2A'; c.fillRect(-w / 2 + .05, -h - .5, .22, h + .5); c.fillRect(w / 2 - .27, -h - .5, .22, h + .5);
        c.fillStyle = '#A86E3E'; c.fillRect(-w / 2, -h, w, .25);
        flag(c, w / 2 - .16, -h - 1.45, '#C8102E', .55);
      }});
  },
  // ---------------------------------------------------------------- outer space
  rover(st, c, b, p) {
    box(st, c, b, {front: '#E9ECF2', side: '#C9CED8', top: '#DDE1E8',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, .3, b.y1, za, zb), '#E9ECF2');
        fill(c, sideQ(st, sx, .6, .75, za, zb), '#F28C28');
        windows(st, c, sx, .8, 1.02, p.z0 + .4, p.z0 + 1.6, .55, .1, za, zb, '#2B3A62');
        wheels(st, c, sx, [p.z0 + .6, (p.z0 + p.z1) / 2, p.z1 - .6], .42, za, zb, '#2A2C34');
      },
      topDeco: (za, zb) => fill(c, topQ(st, b.y1, b.x0 + .3, b.x1 - .3, Math.max(za, (p.z0 + p.z1) / 2 - .6), Math.max(za, (p.z0 + p.z1) / 2 + .6)), '#25356E'),
      frontDeco: (w, h) => {
        c.fillStyle = '#2B3A62'; rr(c, -w / 2 + .2, -h + .1, w - .4, .35, .08); c.fill();
        c.fillStyle = '#F28C28'; c.fillRect(-w / 2, -.75, w, .15);
        badge(c, 0, -.45, .2);
        c.strokeStyle = '#9AA3B8'; c.lineWidth = .05; c.beginPath(); c.moveTo(w * .35, -h); c.lineTo(w * .35, -h - .6); c.stroke();
        c.fillStyle = '#EEF1F7'; c.beginPath(); c.ellipse(w * .35, -h - .65, .3, .1, -.4, 0, Math.PI * 2); c.fill();
      }});
  },
  cargo(st, c, b, p) {
    box(st, c, b, {front: '#2E3446', side: '#262B3A', top: '#3A4157',
      sideDeco: (sx, za, zb) => {
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); marks(za, zb, .9, b.z0).forEach(z => path(c, sideQ(st, sx, .2, b.y1 - .2, z, z + .1))); c.fill();
        fill(c, sideQ(st, sx, b.y1 - .2, b.y1 - .1, za, zb), '#5CF4FF'); fill(c, sideQ(st, sx, .3, .38, za, zb), '#5CF4FF');
      },
      topDeco: (za, zb) => { fill(c, topQ(st, b.y1, b.x0, b.x0 + .1, za, zb), '#5CF4FF'); fill(c, topQ(st, b.y1, b.x1 - .1, b.x1, za, zb), '#5CF4FF'); },
      frontDeco: (w, h) => { c.strokeStyle = '#5CF4FF'; c.lineWidth = .1; c.strokeRect(-w / 2 + .12, -h + .12, w - .24, h - .24); badge(c, 0, -h / 2, .4); }});
  },
  hover(st, c, b, p) {
    // its glow on the ground under it, then the pad
    const zn = nearOf(st, p.z0, p.z1);
    if (zn != null) {
      const q = P(st, (b.x0 + b.x1) / 2, 0, (Math.max(zn, p.z0) + p.z1) / 2), e = P(st, b.x1, 0, (Math.max(zn, p.z0) + p.z1) / 2);
      glow(c, q.x, q.y, Math.abs(e.x - q.x) * 1.4, '92,200,255');
      const u = P(st, (b.x0 + b.x1) / 2, p.b, Math.max(zn, p.z0) + .3);
      c.fillStyle = 'rgba(120,220,255,.55)'; c.beginPath(); c.ellipse(u.x, u.y, u.s * 1, u.s * .2, 0, 0, Math.PI * 2); c.fill();
    }
    box(st, c, b, {front: '#2A3150', side: '#222842', top: '#C9CED8',
      sideDeco: (sx, za, zb) => fill(c, sideQ(st, sx, b.y1 - .1, b.y1, za, zb), '#F2C230'),
      topDeco: (za, zb) => fill(c, topQ(st, b.y1, b.x0 + .35, b.x1 - .35, za, zb), '#2A3150'),
      frontDeco: (w, h) => { c.fillStyle = '#F2C230'; c.fillRect(-w / 2, -h, w, .08); badge(c, 0, -h / 2, .11); c.fillStyle = '#5CF4FF'; c.fillRect(-w / 2 + .2, -.04, w - .4, .04); }});
  },
  // ---------------------------------------------------------------- the farm
  hay: VEHICLES.farm.lo,
  trailer(st, c, b, p) {
    box(st, c, b, {front: '#C8322B', side: '#B02A24', top: '#C98A4E',
      sideDeco: (sx, za, zb) => {
        fill(c, sideQ(st, sx, 0, .45, za, zb), 'rgba(40,20,15,.6)');
        fill(c, sideQ(st, sx, b.y1 - .3, b.y1 + .35, za, zb), 'rgba(200,50,43,.9)');
        c.fillStyle = '#8E2A20'; c.beginPath(); marks(za, zb, 1.2, b.z0).forEach(z => path(c, sideQ(st, sx, b.y1 - .3, b.y1 + .35, z, z + .08))); c.fill();
        wheels(st, c, sx, [p.z0 + 1.4, p.z1 - 1.4], .55, za, zb);
      },
      topDeco: (za, zb) => planks(st, c, b, za, zb, .4),
      frontDeco: (w, h) => { c.fillStyle = 'rgba(40,20,15,.6)'; c.fillRect(-w / 2, -.45, w, .45); flag(c, w / 2 - .45, -h - .1, '#C8102E', .75); }});
  },
  fence(st, c, b, p) {
    if (b.z0 < st.camZ + NEAR) return;
    flat(st, c, (b.x0 + b.x1) / 2, 0, b.z0);
    const w = b.x1 - b.x0 + .3, h = b.y1;
    c.fillStyle = '#F4F1EA';
    c.fillRect(-w / 2, -h - .15, .22, h + .15); c.fillRect(w / 2 - .22, -h - .15, .22, h + .15);
    c.fillRect(-w / 2, -h + .05, w, .2); c.fillRect(-w / 2, -h * .5, w, .2);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = .03; c.strokeRect(-w / 2, -h + .05, w, .2);
    flag(c, 0, -h + .25, '#C8102E', .7);
    [[-w / 2 - .25, -.9], [w / 2 + .25, -1.1]].forEach(([x, y]) => { c.strokeStyle = '#3E8E3A'; c.lineWidth = .06; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y); c.stroke(); c.fillStyle = '#F7C62F'; c.beginPath(); c.arc(x, y, .2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#6B3E1E'; c.beginPath(); c.arc(x, y, .08, 0, Math.PI * 2); c.fill(); });
    c.restore();
  }
};
// The ramps up the things that have them: the place's colours, or the thing's own.
const RAMP_OF = {canyon: ['#C98A4E', '#8E5E34', '#6E4A33'], wagonbridge: ['#C98A4E', '#8E5E34', '#C8102E'], ramptruck: ['#5E6470', '#3E434C', '#F2C230'],
  marketramp: ['#D9A866', '#A87A44', '#2E9E4F'], lifeguard: ['#C9915A', '#9C6A3C', '#1FA6C9'], cargo: ['#4A5068', '#30354A', '#5CF4FF'], trailer: ['#C98A4E', '#8E5E34', '#C8322B']};
const WIDE = {fence: 1.35, pier: 1.3, hover: 1.2, canyon: 1.3, marketramp: 1.25, awning: 1.25, lifeguard: 1.25, cargo: 1.25, wagonbridge: 1.25, trailer: 1.2, ramptruck: 1.2};
/** A thing in a lane (one part of it), in the place it stands in. */
export function vehicle(st, c, p) {
  const th = themeOf(st, p.z0), X = R.xOf(null, p.lane), w = WIDE[p.kind] || (p.hi ? HW : LW);
  const b = {x0: X - w, x1: X + w, y0: p.b || 0, y1: p.h, z0: p.z0, z1: p.z1};
  const zn = nearOf(st, p.z0 - (p.ramp || 0), p.z1);
  if (zn == null) return;
  if (!p.b) fill(c, gnd(st, b.x0 - .25, b.x1 + .35, Math.max(zn, p.z0 - .2), p.z1 + .9), 'rgba(0,0,0,.26)');
  const draw = KIND_DRAW[p.kind] || VEHICLES[th.id][p.hi ? 'hi' : 'lo'];
  draw(st, c, b, p);
  if (p.ramp) ramp(st, c, p, RAMP_OF[p.kind] || RAMPS[th.id]);
}

// ============================================================================ The rows: barricades and banners
// What stands across a lane a row at a time (core/return.js OBST): a barricade to jump (a striped board on two
// sawhorse legs, about a yard up) and a banner to slide under (slung between two poles, its bottom 1.15 yards up). Each
// in the colours of the place it stands in, the banner with the place's word on it. k (0 to 1): knocked flying, after
// a hit (or smashed through on painkillers).
const OB = {stadium: ['#C8102E', '#FFFFFF', 'RETURN MAN'], tailgate: ['#F28C28', '#FFFFFF', 'TAILGATE'], city: ['#F2A900', '#1B1B1B', 'DETOUR'],
  tundra: ['#2E6FB5', '#FFFFFF', 'FROZEN TUNDRA'], desert: ['#B5652B', '#F3D9A4', 'WILD WEST'], market: ['#2E9E4F', '#FFF4D6', 'FRESH'],
  beach: ['#1FA6C9', '#FFFFFF', 'SURF’S UP'], space: ['#6B3CFF', '#5CF4FF', 'ZERO G'], farm: ['#C8322B', '#F3E6C8', 'FARM FRESH']};
export function obstacle(st, c, type, lane, z, k = 0) {
  if (z < st.camZ + NEAR + .2) return;
  const [a, b, word] = OB[themeOf(st, z).id] || OB.stadium;
  const side = lane === 0 ? -1 : 1, X = R.xOf(null, lane) + side * k * 4.5, lift = Math.max(0, 3.2 * k - 4 * k * k);
  c.save();
  c.globalAlpha = Math.max(0, 1 - k * k);
  if (!k) fill(c, gnd(st, X - 1.3, X + 1.3, z - .1, z + .45), 'rgba(0,0,0,.22)');
  flat(st, c, X, lift, z);
  c.rotate(side * k * 1.3);
  if (type === 'hurdle') {
    // two sawhorse legs
    c.fillStyle = '#2B2F36';
    [-1.02, 1.02].forEach(e => { c.beginPath(); c.moveTo(e - .2, 0); c.lineTo(e - .05, -.9); c.lineTo(e + .05, -.9); c.lineTo(e + .2, 0); c.lineTo(e + .1, 0); c.lineTo(e, -.62); c.lineTo(e - .1, 0); c.closePath(); c.fill(); });
    // the board: the place's colour in diagonal stripes on the other
    c.save(); rr(c, -1.17, -1, 2.34, .42, .05); c.clip();
    c.fillStyle = b; c.fillRect(-1.17, -1, 2.34, .42);
    c.fillStyle = a; c.beginPath();
    for (let x = -1.7; x < 1.3; x += .38) { c.moveTo(x, -.58); c.lineTo(x + .19, -.58); c.lineTo(x + .4, -1); c.lineTo(x + .21, -1); c.closePath(); }
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-1.17, -1, 2.34, .08);
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = .03; rr(c, -1.17, -1, 2.34, .42, .05); c.stroke();
    // a blinking lamp at each end
    c.fillStyle = Math.floor((st.t || 0) * 2.5) % 2 ? '#FFC23A' : '#B07A10';
    [-.98, .98].forEach(x => { c.beginPath(); c.arc(x, -1.07, .075, 0, Math.PI * 2); c.fill(); });
  } else {
    // two poles, a banner slung between them
    c.fillStyle = '#8E98A4'; c.fillRect(-1.45, -2.7, .1, 2.7); c.fillRect(1.35, -2.7, .1, 2.7);
    c.fillStyle = '#E9EDF1'; [-1.4, 1.4].forEach(x => { c.beginPath(); c.arc(x, -2.72, .08, 0, Math.PI * 2); c.fill(); });
    rr(c, -1.36, -2.45, 2.72, 1.3, .04); c.fillStyle = a; c.fill();
    c.fillStyle = b; c.fillRect(-1.36, -2.45, 2.72, .09); c.fillRect(-1.36, -1.24, 2.72, .09);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-1.36, -1.24, 2.72, .03);
    c.fillStyle = b; c.font = `800 .52px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(word, 0, -1.8, 2.45);
  }
  c.restore();
  c.restore();
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
// Into each place, across the road at its first yard (z), on the goal line (you score as you go under it): two posts,
// the place's name over the lanes with a football either side, and the goalposts standing up out of it. Each gate draws
// its posts and sign (in yards about the road's middle, y up = minus) and says where its sign is and how to letter it.
const GATES = {
  stadium(c) {
    c.fillStyle = '#16224A'; c.fillRect(-7, -7.8, 1, 7.8); c.fillRect(6, -7.8, 1, 7.8);
    c.fillStyle = '#0E1B45'; rr(c, -7.4, -8.6, 14.8, 2.2, .3); c.fill();
    c.strokeStyle = '#3EF08F'; c.lineWidth = .14; rr(c, -7.2, -8.4, 14.4, 1.8, .2); c.stroke();
    return {ink: '#EAF1FF', small: '#3EF08F', top: -8.6, hgt: 2.2, bar: -9.6};
  },
  tailgate(c, t) {
    c.fillStyle = '#1D3F8F'; c.fillRect(-6.9, -7.4, .7, 7.4); c.fillRect(6.2, -7.4, .7, 7.4);
    c.fillStyle = '#C8102E'; rr(c, -7.4, -8.4, 14.8, 2.1, .2); c.fill();
    c.fillStyle = '#1D3F8F'; c.fillRect(-7.4, -6.55, 14.8, .25);
    for (let i = 0; i < 15; i++) { const x = -7 + i, y = -6.1 + Math.sin(i / 14 * Math.PI) * .5, on = (i + Math.floor(t * 3)) % 3; c.fillStyle = on ? '#FFE9A8' : '#B98A2F'; c.beginPath(); c.arc(x, y, .12, 0, Math.PI * 2); c.fill(); }
    return {ink: '#FFFFFF', small: '#FFD23F', top: -8.4, hgt: 2.1, bar: -9.4};
  },
  city(c) {
    c.fillStyle = '#7D8590'; c.fillRect(-7.2, -8.6, .55, 8.6); c.fillRect(6.65, -8.6, .55, 8.6);
    c.strokeStyle = '#7D8590'; c.lineWidth = .12; c.beginPath(); c.moveTo(-7, -8.5); c.lineTo(7, -8.5); c.moveTo(-7, -6.3); c.lineTo(7, -6.3);
    for (let x = -7; x < 7; x += .7) { c.moveTo(x, -8.5); c.lineTo(x + .7, -6.3); } c.stroke();
    c.fillStyle = '#0B6E3A'; rr(c, -5.6, -8.9, 11.2, 2.5, .25); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = .1; rr(c, -5.4, -8.7, 10.8, 2.1, .18); c.stroke();
    return {ink: '#FFFFFF', small: '#FFFFFF', top: -8.9, hgt: 2.5, bar: -9.9, over: 'EXIT 17  ↑'};
  },
  tundra(c) {
    c.fillStyle = '#6B4A2E'; c.fillRect(-6.9, -7.6, .7, 7.6); c.fillRect(6.2, -7.6, .7, 7.6);
    c.fillStyle = '#7A5636'; rr(c, -7.2, -8.5, 14.4, 2.2, .2); c.fill();
    c.fillStyle = '#F6F9FC'; rr(c, -7.35, -8.75, 14.7, .45, .22); c.fill();
    [-6.55, 6.55].forEach(x => { rr(c, x - .45, -7.85, .9, .35, .17); c.fill(); });
    return {ink: '#F6F9FC', small: '#BFE4FF', top: -8.5, hgt: 2.2, bar: -9.7};
  },
  desert(c) {
    c.fillStyle = '#7A4E2C';
    rr(c, -7.1, -8.6, .9, 8.6, .3); c.fill(); rr(c, 6.2, -8.6, .9, 8.6, .3); c.fill();
    rr(c, -7.8, -9.1, 15.6, .8, .4); c.fill();
    c.strokeStyle = 'rgba(40,20,10,.35)'; c.lineWidth = .06; for (let y = -8.2; y < 0; y += .9) { c.beginPath(); c.moveTo(-7.1, y); c.lineTo(-6.2, y + .1); c.moveTo(6.2, y); c.lineTo(7.1, y + .1); c.stroke(); }
    c.strokeStyle = '#3A3533'; c.lineWidth = .07; c.beginPath(); c.moveTo(-4.4, -8.3); c.lineTo(-4.4, -7.6); c.moveTo(4.4, -8.3); c.lineTo(4.4, -7.6); c.stroke();
    c.fillStyle = '#5E1F1A'; rr(c, -5.6, -7.7, 11.2, 1.9, .15); c.fill();
    c.strokeStyle = '#E8B36A'; c.lineWidth = .14; rr(c, -5.45, -7.55, 10.9, 1.6, .1); c.stroke();
    skull(c, 0, -9.55, 1.35);
    return {ink: '#F2D27A', small: '#F2D27A', top: -7.7, hgt: 1.9, bar: -11.2};
  },
  market(c) {
    c.fillStyle = '#8A5E34'; c.fillRect(-7, -7.6, .75, 7.6); c.fillRect(6.25, -7.6, .75, 7.6);
    c.fillStyle = '#2E7D46'; [-6.62, 6.62].forEach(x => { c.beginPath(); c.moveTo(x - .55, -7.6); c.lineTo(x, -8.3); c.lineTo(x + .55, -7.6); c.fill(); });
    c.fillStyle = '#2E7D46'; rr(c, -6.6, -8.6, 13.2, 2.2, .25); c.fill();
    c.strokeStyle = '#F5E6C8'; c.lineWidth = .12; rr(c, -6.4, -8.4, 12.8, 1.8, .18); c.stroke();
    const cols = ['#D8392B', '#FFFFFF', '#2E9E4F', '#F2C230', '#2C6FD1'];
    for (let k = 0; k < 18; k++) { const x = -6.2 + k * .73, y = -6.25 + Math.sin(k / 17 * Math.PI) * .4; c.fillStyle = cols[k % cols.length]; c.beginPath(); c.moveTo(x - .3, y); c.lineTo(x + .3, y); c.lineTo(x, y + .6); c.fill(); }
    return {ink: '#FFF6DE', small: '#F7D774', top: -8.6, hgt: 2.2, bar: -9.6};
  },
  beach(c) {
    c.fillStyle = '#C9A27A'; rr(c, -7.05, -7.6, .8, 7.6, .3); c.fill(); rr(c, 6.25, -7.6, .8, 7.6, .3); c.fill();
    c.strokeStyle = '#E8D3A6'; c.lineWidth = .1; [-6.65, 6.65].forEach(x => { for (let y = -1.6; y > -2.6; y -= .2) { c.beginPath(); c.moveTo(x - .42, y); c.lineTo(x + .42, y - .08); c.stroke(); } });
    c.fillStyle = '#1FA6C9'; rr(c, -6.8, -8.4, 13.6, 2.1, .5); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = .14; rr(c, -6.6, -8.2, 13.2, 1.7, .4); c.stroke();
    return {ink: '#FFFFFF', small: '#FFE08A', top: -8.4, hgt: 2.1, bar: -9.4};
  },
  space(c, t) {
    c.fillStyle = '#2E3148'; c.fillRect(-7.1, -8, .8, 8); c.fillRect(6.3, -8, .8, 8);
    const on = .55 + .45 * Math.sin(t * 4);
    c.fillStyle = `rgba(92,244,255,${on.toFixed(2)})`; c.fillRect(-6.75, -7.6, .1, 7.2); c.fillRect(6.65, -7.6, .1, 7.2);
    c.fillStyle = '#1A1640'; rr(c, -6.9, -8.8, 13.8, 2.3, .2); c.fill();
    c.strokeStyle = '#5CF4FF'; c.lineWidth = .14; rr(c, -6.7, -8.6, 13.4, 1.9, .14); c.stroke();
    return {ink: '#E8FBFF', small: '#5CF4FF', top: -8.8, hgt: 2.3, bar: -9.8};
  },
  farm(c) {
    c.fillStyle = '#8A5E34'; c.fillRect(-7, -7.6, .7, 7.6); c.fillRect(6.3, -7.6, .7, 7.6);
    c.fillStyle = '#B2362A'; rr(c, -6.8, -8.6, 13.6, 2.2, .15); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = .14; rr(c, -6.6, -8.4, 13.2, 1.8, .1); c.stroke();
    c.strokeStyle = '#8A5E34'; c.lineWidth = .14; c.beginPath(); [[-7, -6.3], [6.3, 7]].forEach(([a, b]) => { c.moveTo(a, -2.4); c.lineTo(b + .7, -1.2); }); c.stroke();
    return {ink: '#FFFFFF', small: '#FFE08A', top: -8.6, hgt: 2.2, bar: -9.6};
  }
};
/** The goalposts over a gate, their crossbar at bar (yards, up = minus): the uprights 18 ft 6 in apart, ribbons on top. */
function goalposts(c, bar) {
  c.fillStyle = '#F7C62F';
  c.fillRect(-.17, bar, .34, 3);
  c.fillRect(-3.2, bar - .15, 6.4, .3);
  c.fillRect(-3.2, bar - 4.6, .27, 4.6); c.fillRect(2.93, bar - 4.6, .27, 4.6);
  c.fillStyle = 'rgba(160,110,0,.35)'; c.fillRect(-3.02, bar - 4.6, .09, 4.45); c.fillRect(3.11, bar - 4.6, .09, 4.45);
  c.fillStyle = '#FF6A2B'; c.fillRect(-3.16, bar - 5, .14, .42); c.fillRect(3.06, bar - 5, .14, .42);
}
/** The gate into a place, at its first yard z. */
export function gate(st, c, z, th, t) {
  if (z < st.camZ + NEAR + .5) return;
  const s = flat(st, c, 0, 0, z);
  if (s < .8) { c.restore(); return; }
  const bar = {stadium: -9.6, tailgate: -9.4, city: -9.9, tundra: -9.7, desert: -11.2, market: -9.6, beach: -9.4, space: -9.8, farm: -9.6}[th.id];
  goalposts(c, bar);
  const g = GATES[th.id](c, t);
  const big = th.name.toUpperCase(), name = big.replace(/^THE /, ''), the = big.startsWith('THE ');
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = g.small; c.font = `700 .5px ${DISPLAY}`;
  c.fillText(g.over || (the ? 'WELCOME TO THE' : 'WELCOME TO'), 0, g.top + g.hgt * .27);
  c.fillStyle = g.ink; c.font = `800 ${(name.length > 10 ? .95 : 1.1)}px ${DISPLAY}`;
  const y = g.top + g.hgt * .66, w = c.measureText(name).width;
  c.fillText(name, 0, y);
  [-1, 1].forEach(sd => football(c, sd * (w / 2 + .7), y, .85));
  c.restore();
}

// ============================================================================ The weather
// Snow over the tundra (and coming in as you near it), dust over the desert, gulls over the beach, shooting stars in
// space.
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
  const dust = k('desert');
  if (dust > .02) {
    const r = seeded(91);
    for (let i = 0; i < 18; i++) {
      const x = ((r() * st.W + t * (40 + r() * 60)) % (st.W + 40)) - 20, y = st.y0 + r() * (st.H - st.y0);
      c.fillStyle = `rgba(250,220,180,${(.25 * dust).toFixed(2)})`; c.beginPath(); c.arc(x, y, 1 + r() * 2, 0, Math.PI * 2); c.fill();
    }
  }
  const gulls = k('beach');
  if (gulls > .02) {
    const r = seeded(53);
    c.strokeStyle = `rgba(40,50,70,${(.7 * gulls).toFixed(2)})`; c.lineWidth = 1.4; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = ((r() * st.W + t * (12 + r() * 14)) % (st.W + 40)) - 20, y = st.y0 * (.15 + r() * .5) + Math.sin(t * 1.3 + i) * 4, w = 4 + r() * 3, f = Math.sin(t * 6 + i * 2) * 2;
      c.beginPath(); c.moveTo(x - w, y - f); c.quadraticCurveTo(x - w * .4, y - 3 - f * .5, x, y); c.quadraticCurveTo(x + w * .4, y - 3 - f * .5, x + w, y - f); c.stroke();
    }
  }
  const stars = k('space');
  if (stars > .02) {
    const ph = (t % 3.2) / 3.2, r = seeded(Math.floor(t / 3.2) + 7), x = r() * st.W, y = r() * st.y0 * .6, L = 60;
    if (ph < .35) {
      const u = ph / .35, hx = x + u * L * 2, hy = y + u * L * .7, g = c.createLinearGradient(hx - L, hy - L * .35, hx, hy);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${(.9 * stars * (1 - u)).toFixed(2)})`);
      c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - L, hy - L * .35); c.lineTo(hx, hy); c.stroke();
    }
  }
}
// (for the 3D world, views/return-3dworld.js: the same things beside the road, the same colours)
export {dressOf as dressList, LOOK as LOOKS, OB as OBS, GOODS_COL};
