// Return Man's players, drawn (views/return.js): the returner in navy and the linebacker chasing him in red, as jointed
// figures in the scene's own yards (views/return-world.js P: x across, y up, z ahead), so they run, jump, slide, spin,
// stumble and go down as you watch, with the camera's perspective on every joint (the owner's ask, Oct 2026: an
// animation, not pictures).
// A pose is a player's joints, in yards from his feet, facing ahead (+z, away from the camera): stand, catching, run,
// air, slide, sprawl and dive build them (flail and mix change them); draw() turns it about him (a spin, a cut), leans
// it to the side, pitches it forward about his feet (a fall, a dive), then draws it part by part, far to near: the
// legs, the arms, the pants and the jersey (a box, its faces lit from the upper left, the number on the back), the
// helmet, the ball.
// Exports: KITS, stand(t), catching(p), run(ph, o), air(tuck, o), slide(), sprawl(o), dive(), flail(J, k, t), mix(A, B, u),
// draw(st, c, x, y, z, K, J, o).
import {P} from './return-world.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = v => v * v * (3 - 2 * v);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

// The kits: ours navy (white pants with a navy stripe, white socks, a navy helmet with a white stripe); the
// linebacker's red and white.
export const KITS = {
  us: {jersey: '#1D3F8F', sleeve: '#E8EBF2', num: '#FFFFFF', numEdge: '#0C1A44', pants: '#D5D9E2', stripe: '#1D3F8F',
    sock: '#F3F4F7', cleat: '#14161B', helmet: '#1D3F8F', helmetStripe: '#F4F6FA', mask: '#C4CAD4', glove: '#151C36', skin: '#8A5A36', num0: 22},
  them: {jersey: '#C8102E', sleeve: '#FFFFFF', num: '#FFFFFF', numEdge: '#6E0E10', pants: '#F3F3F5', stripe: '#C8102E',
    sock: '#C8102E', cleat: '#14161B', helmet: '#F2F3F5', helmetStripe: '#C8102E', mask: '#4E535C', glove: '#F4F4F6', skin: '#C68C5E', num0: 52}
};
// A color a shade darker or lighter (f: 1 is itself), for the faces the light doesn't fall on.
const TONE = new Map();
function tone(hex, f) {
  f = Math.round(f * 20) / 20;
  const key = hex + f;
  let v = TONE.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16), ch = s => clamp(Math.round(((n >> s) & 255) * f), 0, 255);
    v = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
    TONE.set(key, v);
  }
  return v;
}

// ---------------------------------------------------------------- Poses
// His build, yards: the hips, the torso (hips to the shoulder line), the neck, a thigh, a shin, an upper arm, a forearm.
const HIP = .94, TORSO = .7, NECK = .24, THIGH = .47, SHIN = .46, UPPER = .29, FORE = .27;
/** A two-bone limb from A reaching for T (lengths l1, l2), the joint bent toward dir: [the joint, where it reaches]. */
function bend(A, T, l1, l2, dir) {
  const d = sub(T, A);
  let n = len(d) || 1e-3;
  const u = mul(d, 1 / n), reach = l1 + l2 - .002;
  if (n > reach) { n = reach; T = add(A, mul(u, n)); }
  let b = sub(dir, mul(u, dot(dir, u)));
  b = len(b) < 1e-4 ? [0, 0, 1] : unit(b);
  const a = (l1 * l1 + n * n - l2 * l2) / (2 * n), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [add(add(A, mul(u, a)), mul(b, h)), T];
}
/** The trunk: the hips at hipY, the torso pitched lean radians forward (back, if less than 0). */
function trunk(hipY, lean) {
  const hip = [0, hipY, 0], neck = add(hip, [0, TORSO * Math.cos(lean), TORSO * Math.sin(lean)]);
  const up = unit(sub(neck, hip)), fwd = cross([1, 0, 0], up);
  return {hip, neck, head: add(neck, add(mul(up, NECK), mul(fwd, .05))), up, fwd,
    hp: [add(hip, [-.15, -.02, 0]), add(hip, [.15, -.02, 0])], sh: [add(neck, [-.38, -.05, 0]), add(neck, [.38, -.05, 0])],
    kn: [], ft: [], el: [], hd: [], ball: null, bdir: null};
}
const leg = (J, i, foot, dir) => { const [k, f] = bend(J.hp[i], foot, THIGH, SHIN, dir); J.kn[i] = k; J.ft[i] = f; };
const armTo = (J, i, hand, dir) => { const [e, h] = bend(J.sh[i], hand, UPPER, FORE, dir); J.el[i] = e; J.hd[i] = h; };
/** The ball tucked high and tight in his right arm (i 1), the elbow back at his side; f swings it a little. */
function carry(J, i = 1, f = 0) {
  const s = i ? 1 : -1;
  armTo(J, i, add(J.sh[i], [s * .02, -.4 + .03 * f, .2 + .05 * f]), [s * .8, -.3, -1]);
  J.ball = add(mix3(J.el[i], J.hd[i], .6), [s * .09, .03, 0]);
  J.bdir = unit([-s * .25, .45, 1]);
}
/** Waiting for the kick: knees bent, hands ready, breathing. */
export function stand(t = 0) {
  const J = trunk(HIP - .08 + .008 * Math.sin(t * 2.2), .12);
  [0, 1].forEach(i => { const s = i ? 1 : -1; leg(J, i, [s * .2, .1, 0], [s * .3, 0, 1]); armTo(J, i, add(J.sh[i], [s * .06, -.42, .22]), [s, -.2, -1]); });
  return J;
}
/** Under the kick, p 0 to 1 as it comes down: the hands from up high reaching for it to cradling it at his chest. */
export function catching(p) {
  const J = trunk(HIP - .08, .06), u = smooth(clamp(p, 0, 1));
  [0, 1].forEach(i => {
    const s = i ? 1 : -1;
    leg(J, i, [s * .2, .1, 0], [s * .3, 0, 1]);
    armTo(J, i, mix3([s * .26, 2.06, .32], [s * .13, 1.24, .42], u), [s, -.6, -.3]);
  });
  return J;
}
// A stride, u 0 to 1 (a foot's own phase): planted and driving back, then the heel kicked up behind him and the knee
// driving through to reach ahead for the next. [ankle height, how far ahead]
function gait(u, k) {
  if (u < .4) return [.1, (.34 - .8 * u / .4) * k];
  const v = (u - .4) / .6;
  return [.1 + .68 * k * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.12)), 1.3) * (1 - .25 * v), (-.46 + .8 * smooth(clamp((v - .1) / .9, 0, 1))) * k];
}
/** Running, ph the stride (a step every pi): the legs opposite, the arms pumping against them, a bob each step.
 *  o: carry (the ball in his right arm), pump (the arms' swing), lean (forward, radians), stride (its length),
 *  sink (yards lower in his knees: a landing). */
export function run(ph, o = {}) {
  const u = ((ph / TAU) % 1 + 1) % 1, k = o.stride ?? 1;
  const J = trunk(HIP - .06 - .045 * Math.cos(4 * Math.PI * (u - .2)) - (o.sink || 0), o.lean ?? .2);
  [0, 1].forEach(i => { const s = i ? 1 : -1, g = gait((u + i * .5) % 1, k); leg(J, i, [s * .12, g[0], g[1]], [s * .12, 0, 1]); });
  [0, 1].forEach(i => {
    const s = i ? 1 : -1, f = s * Math.cos(TAU * u) * (o.pump ?? 1);
    if (o.carry && i === 1) { carry(J, 1, f); return; }
    const a = .9 * f, el = add(J.sh[i], [s * .13, -UPPER * Math.cos(a), UPPER * Math.sin(a)]), b = a + 1.45;
    J.el[i] = el; J.hd[i] = add(el, [-s * .07, -FORE * Math.cos(b), FORE * Math.sin(b)]);
  });
  return J;
}
/** In the air, tuck 0 to 1: his left leg reaching up and over, the right tucked with its knee out, the free arm up. */
export function air(tuck, o = {}) {
  const h = clamp(tuck, 0, 1), J = trunk(HIP - .02, .2 + .25 * h);
  leg(J, 0, mix3([-.12, .1, .05], [-.1, .52, .5], h), [-.1, .3, 1]);
  leg(J, 1, mix3([.12, .12, -.08], [.3, .62, -.22], h), [1, .25, .35]);
  armTo(J, 0, mix3(add(J.sh[0], [-.08, -.4, .25]), add(J.sh[0], [-.14, .2, .4]), h), [-1, -.3, -.4]);
  if (o.carry) carry(J, 1);
  else armTo(J, 1, mix3(add(J.sh[1], [.08, -.4, -.15]), add(J.sh[1], [.2, .1, -.1]), h), [1, -.3, -.4]);
  return J;
}
/** Sliding in feet first: low, leaning back, the left leg out ahead and the right bent under it, his left hand trailing
 *  on the ground, the ball held up. */
export function slide() {
  const J = trunk(.28, -.3);
  leg(J, 0, [-.26, .1, .84], [0, 1, 0]);
  leg(J, 1, [.02, .08, .4], [1, .6, 0]);
  armTo(J, 0, [-.72, .08, -.12], [-1, .3, 0]);
  carry(J, 1);
  return J;
}
/** Going down (pitched forward as he falls): the arms out ahead to break it, the ball still tucked (carry). */
export function sprawl(o = {}) {
  const J = trunk(HIP - .02, .12);
  [0, 1].forEach(i => { const s = i ? 1 : -1; leg(J, i, [s * .13, .1, -.08], [0, 0, 1]); });
  armTo(J, 0, add(J.sh[0], [-.08, .5, .2]), [-1, 0, -.3]);
  if (o.carry) carry(J, 1); else armTo(J, 1, add(J.sh[1], [.08, .5, .2]), [1, 0, -.3]);
  return J;
}
/** The linebacker's dive (pitched forward as he leaves his feet): both arms out ahead, the legs trailing. */
export function dive() {
  const J = trunk(HIP, .2);
  [0, 1].forEach(i => {
    const s = i ? 1 : -1;
    leg(J, i, [s * .14, .16 + .1 * i, -.3 + .1 * i], [0, 0, 1]);
    armTo(J, i, add(J.sh[i], [-s * .1, .52, .18]), [s, 0, -.2]);
  });
  return J;
}
/** A stumble (k 0 to 1, fading as he gets going again): the free arm thrown out, windmilling for balance. */
export function flail(J, k, t, carried = 1) {
  if (k <= 0) return J;
  [0, 1].forEach(i => {
    if (i === carried) return;
    const s = i ? 1 : -1, w = Math.sin(t * 15 + i * 2);
    const [e, h] = bend(J.sh[i], add(J.sh[i], [s * (.48 + .08 * w), .12 + .22 * w, .12]), UPPER, FORE, [s * .3, -1, -.3]);
    J.el[i] = mix3(J.el[i], e, k); J.hd[i] = mix3(J.hd[i], h, k);
  });
  return J;
}
/** Part way (u) from pose A to pose B: one move easing into the next. */
export function mix(A, B, u) {
  if (u <= 0) return A;
  if (u >= 1) return B;
  const m = (a, b) => mix3(a, b, u), two = (a, b) => [m(a[0], b[0]), m(a[1], b[1])];
  return {hip: m(A.hip, B.hip), neck: m(A.neck, B.neck), head: m(A.head, B.head), up: unit(m(A.up, B.up)), fwd: unit(m(A.fwd, B.fwd)),
    hp: two(A.hp, B.hp), sh: two(A.sh, B.sh), kn: two(A.kn, B.kn), ft: two(A.ft, B.ft), el: two(A.el, B.el), hd: two(A.hd, B.hd),
    ball: A.ball && B.ball ? m(A.ball, B.ball) : u < .5 ? A.ball : B.ball,
    bdir: A.bdir && B.bdir ? unit(m(A.bdir, B.bdir)) : u < .5 ? A.bdir : B.bdir};
}

// ---------------------------------------------------------------- Drawing
const LIGHT = unit([-.45, .75, -.5]); // from the upper left, over the camera's shoulder
const DISPLAY = '800 100px "Barlow Condensed", "Arial Narrow", sans-serif';
/** Draws pose J of a player in kit K with his feet at (x, y, z). o: turn (radians about him, + to his right), roll (a
 *  lean to the side, + to his right), pitch (forward about his feet), lift (yards off the ground), num. */
export function draw(st, c, x, y, z, K, J, o = {}) {
  const ct = Math.cos(o.turn || 0), stn = Math.sin(o.turn || 0), cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0);
  const cp = Math.cos(o.pitch || 0), sp = Math.sin(o.pitch || 0), base = [x, y + (o.lift || 0), z];
  const rot = v => {
    let a = v[0], b = v[1], d = v[2];
    [b, d] = [b * cp - d * sp, b * sp + d * cp]; // pitched forward: his head goes ahead and down
    [a, b] = [a * cr + b * sr, -a * sr + b * cr]; // leaned to the side
    [a, d] = [a * ct + d * stn, -a * stn + d * ct]; // turned
    return [a, b, d];
  };
  const world = v => add(rot(v), base), cam = [st.camX, st.camH, st.camZ];
  const pr = v => P(st, v[0], v[1], v[2]);
  const parts = [];
  const part = (d, fn) => parts.push({d, fn});
  c.lineCap = 'round'; c.lineJoin = 'round';
  const seg = (a, b, w, col) => { c.strokeStyle = col; c.lineWidth = Math.max(1, w * (a.s + b.s) / 2); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); };
  const dotAt = (p, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, Math.max(.8, r * p.s), 0, TAU); c.fill(); };
  const fwdW = rot([0, 0, 1]), upW = rot([0, 1, 0]);

  // the legs: the thigh in the pants (a stripe down the outside), the sock, the cleat
  [0, 1].forEach(i => {
    const s = i ? 1 : -1, hp = world(J.hp[i]), kn = world(J.kn[i]), ft = world(J.ft[i]);
    const shade = s > 0 ? .86 : 1, P1 = pr(kn), P2 = pr(ft);
    const toe = add(ft, add(mul(fwdW, .15), mul(upW, -.06))), heel = add(ft, add(mul(fwdW, -.05), mul(upW, -.05)));
    part((ft[2] + kn[2]) / 2, () => { seg(P1, P2, .17, tone(K.sock, shade)); seg(pr(heel), pr(toe), .12, K.cleat); });
    part(Math.max((hp[2] + kn[2]) / 2, world(mix3(J.hip, J.neck, .5))[2] + .002), () => {
      seg(pr(mix3(hp, kn, .12)), P1, .27, tone(K.pants, shade)); seg(P1, pr(mix3(kn, ft, .2)), .21, tone(K.pants, shade));
      seg(pr(world(add(mix3(J.hp[i], J.kn[i], .08), [s * .13, 0, 0]))), pr(world(add(mix3(J.hp[i], J.kn[i], .92), [s * .1, 0, 0]))), .035, K.stripe);
    });
  });
  // the arms: the sleeve, the bare arm, the glove
  [0, 1].forEach(i => {
    const s = i ? 1 : -1, sh = world(J.sh[i]), el = world(J.el[i]), hd = world(J.hd[i]);
    const shade = s > 0 ? .86 : 1, S = pr(sh), E = pr(el), H = pr(hd);
    part((el[2] + hd[2]) / 2, () => { seg(E, H, .145, tone(K.skin, shade)); dotAt(H, .085, K.glove); });
    part((sh[2] + el[2]) / 2 - .02, () => { seg(S, E, .17, tone(K.skin, shade)); seg(S, pr(mix3(sh, el, .5)), .22, tone(K.jersey, shade)); seg(pr(mix3(sh, el, .38)), pr(mix3(sh, el, .5)), .225, tone(K.sleeve, shade)); });
  });
  // the pants and the jersey, boxes: the faces turned to the camera, lit; the number on the back (or the front)
  const U = unit(sub(J.neck, J.hip)), L = [1, 0, 0], F = cross(L, U);
  const corner = (o0, sx, sz) => world(add(o0, add(mul(L, sx), mul(F, sz))));
  const box = (lo, hi, wl, wh, dl, dh) => {
    const c8 = [];
    [-1, 1].forEach(a => [-1, 1].forEach(b => { c8.push(corner(lo, a * wl, b * dl)); c8.push(corner(hi, a * wh, b * dh)); }));
    // c8: [-x-z lo, -x-z hi, -x+z lo, -x+z hi, +x-z lo, +x-z hi, +x+z lo, +x+z hi]
    return {back: [0, 4, 5, 1], front: [6, 2, 3, 7], left: [2, 0, 1, 3], right: [4, 6, 7, 5], top: [1, 5, 7, 3], c8};
  };
  const faces = (B, col, num) => {
    const n = {back: rot(mul(F, -1)), front: rot(F), left: rot(mul(L, -1)), right: rot(L), top: rot(U)};
    Object.keys(n).forEach(f => {
      const q = B[f].map(j => B.c8[j]), mid = mul(q.reduce((m, v) => add(m, v), [0, 0, 0]), .25);
      if (dot(n[f], sub(cam, mid)) <= 0) return;
      const pts = q.map(pr);
      c.fillStyle = tone(col, .7 + .4 * Math.max(0, dot(n[f], LIGHT)));
      c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let j = 1; j < 4; j++) c.lineTo(pts[j].x, pts[j].y); c.closePath(); c.fill();
      if (num && (f === 'back' || f === 'front')) number(c, K, num, pts, unit(sub(cam, mid)), n[f]);
    });
  };
  const waist = add(J.hip, mul(U, .1)), shl = add(J.neck, mul(U, -.03)), seat = add(J.hip, mul(U, -.17));
  const tz = world(mix3(J.hip, J.neck, .5))[2];
  part(tz + .001, () => faces(box(seat, waist, .24, .31, .13, .15), K.pants));
  part(tz, () => {
    faces(box(waist, shl, .31, .45, .15, .17), K.jersey, o.num ?? K.num0);
    // the pads' sleeve caps at his shoulders
    [-1, 1].forEach(s => { const p = pr(world(add(shl, mul(L, s * .4)))); dotAt(p, .095, tone(K.sleeve, s > 0 ? .86 : 1)); });
  });
  // the helmet, last of him but the ball (over the shoulders): a stripe over the top, the face mask if he's turned to us
  const head = world(J.head);
  part(head[2] - .3, () => {
    seg(pr(world(J.neck)), pr(head), .14, tone(K.skin, .8));
    helmet(c, K, pr(head), head, rot(J.up), rot(J.fwd), cam, pr);
  });
  if (J.ball) {
    const b = world(J.ball), tip = add(b, mul(rot(J.bdir), .17));
    part(b[2] - .3, () => football(c, pr(b), pr(tip)));
  }
  parts.sort((a, b) => b.d - a.d).forEach(p => p.fn());
}
/** The number on a face of the jersey (q: its corners on screen; back: lower left, lower right, upper right, upper
 *  left as you look at it), squeezed as the face turns away. */
function number(c, K, num, q, toCam, n) {
  const face = dot(toCam, n);
  if (face < .35) return;
  const o = q[0], ex = [q[1].x - o.x, q[1].y - o.y], ey = [q[3].x - o.x, q[3].y - o.y];
  if (Math.hypot(ey[0], ey[1]) < 9) return;
  c.save();
  c.transform(ex[0], ex[1], ey[0], ey[1], o.x, o.y);
  c.translate(.5, .54); c.scale(.0062, -.0056);
  c.font = DISPLAY; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 14; c.strokeStyle = K.numEdge; c.strokeText(String(num), 0, 4);
  c.fillStyle = K.num; c.fillText(String(num), 0, 4);
  c.restore();
}
/** The helmet at p (on screen; h in the world): round, lit from the upper left, its stripe over the top from the back of
 *  it to the front, the face mask when he faces us (fwd, up: which way his head points). */
function helmet(c, K, p, h, up, fwd, cam, pr) {
  const R = .21, r = Math.max(1.5, R * p.s);
  const g = c.createRadialGradient(p.x - r * .35, p.y - r * .4, r * .1, p.x, p.y, r);
  g.addColorStop(0, tone(K.helmet, 1.35)); g.addColorStop(.55, K.helmet); g.addColorStop(1, tone(K.helmet, .62));
  c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.clip();
  // the stripe: the arc over his head, the part of it on our side
  c.strokeStyle = K.helmetStripe; c.lineWidth = Math.max(1, .075 * p.s); c.beginPath();
  let on = false;
  for (let a = -1.75; a <= 1.75; a += .25) {
    const nrm = add(mul(fwd, Math.sin(a)), mul(up, Math.cos(a))), w = add(h, mul(nrm, R));
    if (dot(nrm, sub(cam, w)) <= 0) { on = false; continue; }
    const q = pr(w);
    if (on) c.lineTo(q.x, q.y); else { c.moveTo(q.x, q.y); on = true; }
  }
  c.stroke();
  // the rim at the bottom, in shadow
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(p.x - r, p.y + r * .62, r * 2, r);
  c.restore();
  // facing us: the face in the helmet's shadow, behind the bars
  const to = unit(sub(cam, h)), face = dot(fwd, to);
  if (face > .2) {
    const f = pr(add(h, add(mul(fwd, .14), mul(up, -.05)))), w = r * .62 * Math.sqrt(face);
    c.fillStyle = tone(K.skin, .75); c.beginPath(); c.ellipse(f.x, f.y, w, r * .48, 0, 0, TAU); c.fill();
    c.strokeStyle = K.mask; c.lineWidth = Math.max(1, r * .14);
    c.beginPath();
    c.moveTo(f.x - w * 1.1, f.y); c.lineTo(f.x + w * 1.1, f.y);
    c.moveTo(f.x - w * .9, f.y + r * .3); c.lineTo(f.x + w * .9, f.y + r * .3);
    c.moveTo(f.x, f.y - r * .05); c.lineTo(f.x, f.y + r * .45);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(p.x - r * .4, p.y - r * .45, r * .2, r * .3, -.5, 0, TAU); c.fill();
}
/** The ball: c its middle on screen, tip its nose; laces up. */
function football(c, m, tip) {
  const w = Math.max(1.5, .105 * m.s), dx = tip.x - m.x, dy = tip.y - m.y, l = Math.max(w * 1.05, Math.hypot(dx, dy));
  c.save(); c.translate(m.x, m.y); c.rotate(Math.atan2(dy, dx));
  c.fillStyle = '#7A3B1B'; c.beginPath(); c.ellipse(0, 0, l, w, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, w * .3, l * .92, w * .6, 0, 0, Math.PI); c.fill();
  if (l > w * 1.4) { c.strokeStyle = '#F4F0E6'; c.lineWidth = Math.max(.8, w * .22); c.beginPath(); c.moveTo(-l * .35, -w * .3); c.lineTo(l * .35, -w * .3); c.stroke(); }
  c.restore();
}
