// A game case up close that turns in your hand (the owner's ask, Oct 2026: once a game's played, its case can be
// turned every way, and it rights itself as you move it, like a real case with the disc in it). Drag it (anywhere on
// the screen) to turn it: while it's held it eases back upright, let go and it springs to whichever side is nearer,
// its front or its back. Facing front it can be opened (a tap on the cover, or Open the case): the cover swings over
// on its spine and the disc is inside. It opens only from the front.
import * as ui from '../core/ui.js';

// ---------------------------------------------------------------- quaternions ([x, y, z, w]; CSS axes: x right, y down, z out of the screen)
const mul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];
const norm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map(c => c / l); };
/** A turn by v (its axis, its length the angle in radians). */
function fromVec(v) {
  const a = Math.hypot(v[0], v[1], v[2]);
  if (a < 1e-9) return [0, 0, 0, 1];
  const s = Math.sin(a / 2) / a;
  return [v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)];
}
/** The turn that takes q to t, the short way round, as a vector. */
function between(q, t) {
  let e = mul(t, [-q[0], -q[1], -q[2], q[3]]);
  if (e[3] < 0) e = e.map(c => -c);
  const s = Math.hypot(e[0], e[1], e[2]);
  if (s < 1e-9) return [0, 0, 0];
  const a = 2 * Math.atan2(s, e[3]);
  return [e[0] / s * a, e[1] / s * a, e[2] / s * a];
}
/** CSS matrix3d (column by column) of q. */
function matrixOf([x, y, z, w]) {
  const r = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1
  ];
  return `matrix3d(${r.map(c => (Math.abs(c) < 1e-7 ? 0 : +c.toFixed(6))).join(',')})`;
}
const FRONT = [0, 0, 0, 1], BACK = [0, 1, 0, 0]; // (its back: turned round on its spine)
const len = v => Math.hypot(v[0], v[1], v[2]);

// How it moves: a drag turns it SENS radians a pixel (across the case and it's turned round); held, it comes upright
// at PULL a second; let go, a spring (K, C: a little past and back) takes it to the nearer side. The cover the same
// way (OK, OC), LID degrees open: not quite flat, as a case lies open on a table.
const SENS = .0088, PULL = 1.4, K = 58, C = 9.5, OK = 130, OC = 17, LID = -172, FLING = 18;
// Facing front within this (radians) it can be opened.
const NEAR = .32;

/**
 * Wires the case in dlg (its .gm-z-stage > .gm-z-obj, the cover .gm-z-lid). surface: where a drag turns it (the whole
 * overlay). on(state): told when what it can do changes ({front, open}). Returns {turn(dir), lid(open), rest(), stop()}.
 */
export function turnable(surface, dlg, on = () => {}) {
  const stage = dlg.querySelector('.gm-z-stage'), obj = dlg.querySelector('.gm-z-obj'), lid = dlg.querySelector('.gm-z-lid');
  const gl = [dlg.querySelector('.gm-z-front .gm-z-gl'), dlg.querySelector('.gm-z-back .gm-z-gl')];
  const S = {q: BACK.slice(), w: [0, 0, 0], u: 0, uv: 0, open: 0, goal: null, held: false, raf: 0, t: 0, dead: false, said: '', dragged: false};
  let P = null; // the pointer turning it

  const target = () => (S.open || S.u > .05 ? FRONT : S.goal || (Math.abs(S.q[3]) >= Math.abs(S.q[1]) ? FRONT : BACK));
  const facingFront = () => !S.held && target() === FRONT && len(between(S.q, FRONT)) < NEAR;

  function paint() {
    const W = stage.offsetWidth || 1, u = Math.max(0, Math.min(1, S.u));
    // open, the case lies flat with its cover out to the left: the pair is twice as wide, so it comes down to fit and
    // turns about its spine (in the middle)
    const fit = Math.min(1, ((innerWidth || W * 2) - 24) / (2 * W)), sc = 1 + (fit - 1) * u, p = W / 2 * u;
    obj.style.transform = `translateX(${(p * sc).toFixed(2)}px) scale(${sc.toFixed(4)}) translateX(${(-p).toFixed(2)}px) ${matrixOf(S.q)} translateX(${p.toFixed(2)}px)`;
    lid.style.transform = `translateZ(calc(var(--zd) / 2)) rotateY(${(LID * Math.max(0, S.u)).toFixed(2)}deg)`;
    // the shine on the plastic moves as it turns
    const [x, y, z, w] = S.q, nx = 2 * (x * z + y * w), ny = 2 * (y * z - x * w);
    if (gl[0]) gl[0].style.transform = `translate(${(-nx * 34).toFixed(1)}%, ${(-ny * 34).toFixed(1)}%)`;
    if (gl[1]) gl[1].style.transform = `translate(${(-nx * 34).toFixed(1)}%, ${(ny * 34).toFixed(1)}%)`;
    const st = {front: facingFront(), open: !!S.open}, key = `${st.front}|${st.open}`;
    if (key !== S.said) { S.said = key; on(st); }
  }
  function step(dt) {
    if (S.held) {
      // held: it comes upright (its top toward the top of the screen), however it's turned about
      const [x, y, z, w] = S.q, ux = -2 * (x * y - z * w), uy = -(1 - 2 * (x * x + z * z)), uz = -2 * (y * z + x * w);
      const ax = [uz, 0, -ux], s = len(ax);
      if (s > 1e-6) {
        const a = Math.atan2(s, -uy) * Math.min(1, PULL * dt) / s;
        S.q = norm(mul(fromVec([ax[0] * a, 0, ax[2] * a]), S.q));
      }
    } else if (ui.RM) {
      S.q = target().slice(); S.w = [0, 0, 0];
    } else {
      const v = between(S.q, target());
      S.w = S.w.map((c, i) => c + (K * v[i] - C * c) * dt);
      S.q = norm(mul(fromVec(S.w.map(c => c * dt)), S.q));
    }
    if (ui.RM) { S.u = S.open; S.uv = 0; }
    else { S.uv += (OK * (S.open - S.u) - OC * S.uv) * dt; S.u += S.uv * dt; }
  }
  const still = () => !S.held && len(between(S.q, target())) < .002 && len(S.w) < .02 && Math.abs(S.u - S.open) < .002 && Math.abs(S.uv) < .01;
  function frame(now) {
    S.raf = 0;
    if (S.dead) return;
    const dt = Math.min(1 / 30, Math.max(0, (now - S.t) / 1000)) || 1 / 60;
    S.t = now;
    step(dt);
    if (still()) {
      const was = S.goal;
      S.q = target().slice(); S.w = [0, 0, 0]; S.u = S.open; S.uv = 0; S.goal = null;
      paint();
      if (was) ui.haptic('selection');
      return;
    }
    paint();
    S.raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!S.raf && !S.dead) { S.t = performance.now(); S.raf = requestAnimationFrame(frame); } };

  // ---------------------------------------------------------------- the hand
  const down = e => {
    if (P || e.button > 0 || S.dead) return;
    S.dragged = false; // (a finger's drag has no click after it to clear this)
    if (e.target.closest('.gm-z-x, .gm-z-ctl')) return;
    P = {id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, on: false, body: !!e.target.closest('.gm-z-body'), moves: []};
  };
  const move = e => {
    if (!P || e.pointerId !== P.id) return;
    if (!P.on) {
      const tx = e.clientX - P.x0, ty = e.clientY - P.y0;
      if (Math.hypot(tx, ty) < 8) return;
      // on the leaderboard, up and down is its scroll
      if (P.body && Math.abs(ty) > Math.abs(tx)) { P = null; return; }
      P.on = true; S.held = true; S.dragged = true; S.goal = null; S.w = [0, 0, 0];
      try { surface.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const dx = e.clientX - P.x, dy = e.clientY - P.y;
    P.x = e.clientX; P.y = e.clientY;
    const v = [-dy * SENS, dx * SENS, 0];
    S.q = norm(mul(fromVec(v), S.q));
    P.moves.push({t: e.timeStamp, v});
    while (P.moves.length > 1 && e.timeStamp - P.moves[0].t > 90) P.moves.shift();
    paint();
    wake();
  };
  const up = e => {
    if (!P || e.pointerId !== P.id) return;
    const was = P;
    P = null;
    if (!was.on) return;
    S.held = false;
    // a flick keeps it turning
    const m = was.moves, span = m.length > 1 ? (m[m.length - 1].t - m[0].t) / 1000 : 0;
    if (span > .008 && e.type !== 'pointercancel' && e.timeStamp - m[m.length - 1].t < 60) {
      const sum = m.slice(1).reduce((a, x) => [a[0] + x.v[0], a[1] + x.v[1], 0], [0, 0, 0]);
      let w = sum.map(c => c / span);
      const l = len(w);
      if (l > FLING) w = w.map(c => c * FLING / l);
      S.w = w;
    }
    wake();
  };
  // a drag isn't a tap: the click after it goes nowhere
  const click = e => { if (S.dragged) { S.dragged = false; e.stopPropagation(); e.preventDefault(); } };
  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', up);
  surface.addEventListener('click', click, true);
  addEventListener('resize', paint, {passive: true}); // (open, it's laid out in pixels)
  paint();

  return {
    /** Turn it round (dir 1: its right side toward you), closing it first if it's open. */
    turn(dir = 1) {
      if (S.held) return;
      // (open, it shuts first, then turns)
      S.goal = target() === FRONT ? BACK : FRONT;
      if (S.open) { S.open = 0; ui.haptic('light'); }
      else if (S.u < .05) S.w = [S.w[0], S.w[1] + dir * 4.5, S.w[2]];
      if (ui.RM) S.q = S.goal.slice();
      wake();
    },
    /** Open it (only facing front) or close it; with no word, the other way. True if it moved. */
    lid(open = !S.open) {
      if (open && (S.open || !facingFront())) return false;
      if (!open && !S.open) return false;
      S.open = open ? 1 : 0;
      S.goal = null;
      ui.haptic('light');
      if (open && !ui.RM) {
        const lab = obj.querySelector('.gm-z-lab');
        if (lab) ui.animate(lab, [{transform: 'rotate(-140deg)'}, {transform: 'rotate(0deg)'}], {duration: 1400, easing: 'cubic-bezier(.2,.7,.25,1)', delay: 120});
      }
      wake();
      return true;
    },
    get state() { return {front: facingFront(), open: !!S.open}; },
    /** Where it ends up shut and turned round (to go back to the shelf): the transforms for the case and the cover. */
    rest() { return {obj: `translateX(0px) scale(1) translateX(0px) ${matrixOf(BACK)} translateX(0px)`, lid: 'translateZ(calc(var(--zd) / 2)) rotateY(0deg)'}; },
    stop() {
      S.dead = true;
      if (S.raf) cancelAnimationFrame(S.raf);
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
      surface.removeEventListener('pointercancel', up);
      surface.removeEventListener('click', click, true);
      removeEventListener('resize', paint);
    }
  };
}
