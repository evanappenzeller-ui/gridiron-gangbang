// Two-Minute Drill, the third game of the Daily Games tab (puzzles.js: its picker shows this pane for /puzzles/drill;
// imported on first use). After nfl2mindrill.com: you're down late with the ball, real NFL starters on both sides, and
// you call every snap against the look the defense shows (core/drill-sim.js is the engine, core/drill.js the days,
// memory, words and scoreboard).
//
// A pane module, like 17-0's: render(ctx), mount(el, ctx, {anchor}), params(el, ctx), unmount(el, ctx).
// Two modes (the segmented control): Daily, one drive a day, the same for everyone (each snap is saved as it's called,
// so there are no do-overs), and Survivor, drive after drive with random teams until one is lost.
// The screen: the scorebug (their score, the quarter and clock, yours, your timeouts), the down and distance, the field
// (top-down, your offense going up, every player a dot coloured by his rating, the line of scrimmage blue and the
// first-down line yellow), then the call. Your call: the defense's look, then Run · Pass · RPO · Trick, a field goal
// when it's on, and the clock tools. Pass opens the receivers: each on his route (drawn on the field; tap a receiver
// there, or his route below, to change it) with the look's odds for a throw to him, and play action, roll out and out
// of bounds to toggle; tap a name to throw it. Run and RPO pick a side (strong is the tight end's) and whether to head
// for the sideline. The snap plays out on the field (every player moves, the clock runs; tap the field to skip), then
// the breakdown: what happened, the win chance before and after, what the defense was really in, how your call ranked
// and how every option scored (each played out many times: drill-sim.js scoreOptions), and Replay. When the drive
// ends: the result, Share, and the league's Scoreboard (Today: everyone's drive, tap one to read it once you've played
// yours; Survivor: best runs). Every control here is data-dr-*, so the Daily Puzzles handlers on the same screen never
// see these taps.
// Owner: Drill.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as dr from '../core/drill.js';
import * as daily from '../core/daily.js';
import {msToMidnight} from './board.js';

const E = dr.E;
const esc = data.esc;
const nf = n => data.nf(n);
const COPIED = 'Copied. Paste it in the league chat.';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const nextIn = () => ui.untilText(msToMidnight());
const pct = x => `${Math.round(x * 100)}%`;
const ST = new WeakMap(); // ctx -> pane state

// A home-screen app open across an update imports this module new under the stylesheet it started with: when
// drill.css's mark (--dr-css on :root) isn't this module's, the current file is added (as in views/seventeen.js).
const CSS_V = '2';
function ensureCss() {
  try {
    if (getComputedStyle(document.documentElement).getPropertyValue('--dr-css').trim() === CSS_V || document.querySelector('link[data-dr-css]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL(`../../css/views/drill.css?v=${CSS_V}`, import.meta.url).href;
    l.setAttribute('data-dr-css', '');
    document.head.appendChild(l);
  } catch (_) {}
}

// ============================================================================ The field
// Field coordinates in yards: x across (0-53.3, the middle 26.67), y from your own goal line (0) to theirs (100), the
// end zones out to -10 and 110. The track is the whole field; it slides so the line of scrimmage sits BEHIND yards
// from the bottom of the window (which shows WIN yards; CSS: .dr-field height = WIN x --yd).
const WIDTH = 53.33, MID = 26.67, WIN = 36, BEHIND = 11;
// Spread out past real spacing so every dot (24px, about 4 yards across and 2.7 deep) and name has room. The tight
// end is on the right: that's the strong side.
const OFF_POS = {
  QB: [MID, -5.6], RB: [MID + 4.4, -5.8], WR1: [3.6, -1.2], WR2: [49.6, -1.2], WR3: [11.5, -2.8], TE: [MID + 12, -1.8],
  LT: [MID - 8, -1.4], LG: [MID - 4, -1.3], C: [MID, -1.2], RG: [MID + 4, -1.3], RT: [MID + 8, -1.4]
};
const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
const LABELLED = new Set(['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'LCB', 'RCB', 'SS', 'FS']);
const LABEL_SIDE = {RB: 'r'}; // beside the dot, not under it (he sits level with the QB)
const dirSign = d => (d === 's' ? 1 : -1); // strong side is to the right
/** The defense's eleven for a look: slot -> [x, depth] (null: off the field). Base personnel against the loaded box,
 *  the nickel back in for everything else. shade: the side the front leans to (its extra man and the rotated safety). */
function defPos(T, look, shade = 's') {
  const three = T.s === '34', P = {};
  const lean = dirSign(shade);
  const cbD = {box: 5, blitz: 2.6, two: 7, prevent: 12, light: 6.5}[look];
  P.LCB = [3.6, cbD]; P.RCB = [49.6, cbD];
  P.SS = {box: [MID + 9 * lean, 7], blitz: [MID + 9.5 * lean, 4.6], two: [MID + 12, 14.5], prevent: [MID + 9, 21], light: [MID + 8 * lean, 11]}[look];
  P.FS = {box: [MID - 2 * lean, 14], blitz: [MID, 13], two: [MID - 12, 14.5], prevent: [MID - 9, 21], light: [MID - 6 * lean, 15]}[look];
  P.NB = look === 'box' ? null : {blitz: [9.6, 3.6], two: [11.5, 6.5], prevent: [11.5, 11], light: [11.5, 5.5]}[look];
  const lbD = {box: 5.2, blitz: 4.6, two: 6.2, prevent: 10, light: 6.6}[look];
  if (three) {
    Object.assign(P, {LDE: [MID - 6.5, 2.1], NT: [MID + 1.2 * lean, 2.1], RDE: [MID + 6.5, 2.1]});
    P.WLB = look === 'prevent' ? [MID - 13, 8.5] : [MID - 11.4, 2.1];
    P.SLB = look === 'prevent' ? [MID + 13, 8.5] : [MID + 13, 2.1];
    P.LILB = look === 'box' ? [MID - 3.8, lbD] : look === 'blitz' ? [MID - 2.4, lbD] : [MID + 2 * lean, lbD];
    P.RILB = look === 'box' ? [MID + 3.8, lbD] : null;
  } else {
    Object.assign(P, {LDE: [MID - 10.5, 2.1], LDT: [MID - 3.6 + 0.8 * lean, 2.1], RDT: [MID + 3.6 + 0.8 * lean, 2.1], RDE: [MID + 10.5, 2.1]});
    if (look === 'prevent') P.RDE = [MID + 15, 8];
    const nickel = look !== 'box';
    P.WLB = [look === 'blitz' ? MID - 7 : nickel ? MID - 4 + 1.5 * lean : MID - 7, lbD];
    P.MLB = [look === 'blitz' ? MID + 1 : nickel ? MID + 4 + 1.5 * lean : MID, lbD];
    P.SLB = nickel ? null : [MID + 7, lbD];
  }
  return P;
}
const top = y => `calc(var(--yd) * ${(110 - y).toFixed(2)})`;
const left = x => `${(x / WIDTH * 100).toFixed(2)}%`;
/** Where the track sits for a line of scrimmage: the window's top yard (never past the back of their end zone). */
const winTop = los => Math.min(110, los - BEHIND + WIN);
const trackY = wt => `translateY(calc(var(--yd) * ${-(110 - wt).toFixed(2)}))`;
/** A rating's colour: red (55) through orange and yellow to green (99). */
function ratingColor(r) {
  const t = Math.max(0, Math.min(1, ((Number(r) || 55) - 55) / 44));
  return `hsl(${Math.round(4 + 124 * t)} 74% ${Math.round(54 - 6 * t)}%)`;
}
const tcol = id => (dr.team(id) ? dr.team(id).c : ['#25366A', '#8A94B8']);
const clampX = x => Math.max(1.4, Math.min(WIDTH - 1.4, x));

function linesHTML(s) {
  let h = '';
  for (let y = 0; y <= 100; y += 5) h += `<i class="dr-yl${y % 10 ? '' : ' is-ten'}${y === 0 || y === 100 ? ' is-goal' : ''}" style="top:${top(y)}"></i>`;
  for (let y = 10; y <= 90; y += 10) {
    const n = y <= 50 ? y : 100 - y;
    h += `<b class="dr-num is-l" style="top:${top(y)}">${n}</b><b class="dr-num is-r" style="top:${top(y)}">${n}</b>`;
  }
  const [oc] = tcol(s.sc.o), [dc] = tcol(s.sc.d);
  h += `<span class="dr-ez is-them" style="top:${top(110)};--tc:${esc(dc)}"><b>${esc(dr.team(s.sc.d).n)}</b></span>`;
  h += `<span class="dr-ez is-us" style="top:${top(0)};--tc:${esc(oc)}"><b>${esc(dr.team(s.sc.o).n)}</b></span>`;
  return h;
}
/** Names on the outside players hang inward, so they never run off the field. */
const edgeCls = x => (x < 8 ? ' is-edge-l' : x > WIDTH - 8 ? ' is-edge-r' : '');
function dotHTML(side, p, x, y, hidden) {
  const lab = LABELLED.has(p.slot) ? `<em class="dr-pl-n">${esc(dr.short(p.n))}</em>` : '';
  const at = side === 'o' && LABEL_SIDE[p.slot] ? ' is-lab-' + LABEL_SIDE[p.slot] : '';
  const tgt = side === 'o' && E.TARGETS.includes(p.slot) ? ` data-dr-rcv="${p.slot}"` : '';
  return `<span class="dr-pl is-${side}${at}${edgeCls(x)}${hidden ? ' is-off' : ''}" data-dr-p="${side}-${p.slot}"${tgt} style="left:${left(x)};top:${top(y)};--rc:${ratingColor(p.r)}">`
    + `<b class="dr-pl-j">${p.j == null ? '' : p.j}</b>${lab}</span>`;
}
/** Every player's spot before a snap: [{key, side, slot, p, x, y, off}]. snap: {ball, look, shade} (default: now). */
function spots(s, snap = s) {
  const los = snap.ball, out = [];
  const O = s.U.o, D = s.U.d;
  Object.keys(OFF_POS).forEach(slot => {
    const [x, dy] = OFF_POS[slot];
    out.push({key: 'o-' + slot, side: 'o', slot, p: O.by[slot], x, y: los + dy});
  });
  const P = defPos(dr.team(s.sc.d), snap.look || 'two', snap.shade);
  // Near their goal line the deep players squeeze in (never past the back of the end zone).
  const k = Math.max(0.35, Math.min(1, (108 - los) / 21));
  dr.team(s.sc.d).d.forEach(([slot]) => {
    const at = P[slot] || [slot === 'NB' ? 11.5 : MID + 7, 8];
    const dy = at[1] > 2.5 ? 2.5 + (at[1] - 2.5) * k : at[1];
    out.push({key: 'd-' + slot, side: 'd', slot, p: D.by[slot], x: at[0], y: los + dy, off: !P[slot]});
  });
  return out;
}

// ---------------------------------------------------------------------------- Routes
/** A receiver's route from where he lines up: points in field yards, the stem first. */
function routePath(slot, route, x0, y0) {
  const side = x0 < MID ? -1 : 1, inn = -side;
  const P = {
    slant: [[x0, y0 + 2], [x0 + inn * 6, y0 + 7.5]],
    flat: [[x0 + side * 3, y0 + 1], [x0 + side * 10, y0 + 2.5]],
    drag: [[x0, y0 + 2], [x0 + inn * 15, y0 + 4.5]],
    out: [[x0, y0 + 8], [x0 + side * 7, y0 + 8]],
    curl: [[x0, y0 + 10], [x0 + inn * 1.2, y0 + 8.5]],
    dig: [[x0, y0 + 12], [x0 + inn * 13, y0 + 12]],
    angle: [[x0 + side * 3, y0 + 1.5], [x0 - side * 3, y0 + 6.5]],
    seam: [[x0, y0 + 22]],
    post: [[x0, y0 + 11], [x0 + inn * 8, y0 + 26]],
    go: [[x0, y0 + 33]],
    corner: [[x0, y0 + 11], [x0 + side * 8, y0 + 20]],
    wheel: [[x0 + side * 6, y0 + 2], [x0 + side * 9, y0 + 18]]
  }[route] || [[x0, y0 + 10]];
  return [[x0, y0]].concat(P.map(([x, y]) => [clampX(x), y]));
}
/** The point along a path at a distance downfield (air yards past the line). */
function pointAt(path, los, air) {
  const want = los + air;
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x1, y1] = path[i];
    if ((y1 - want) * (y0 - want) <= 0 && y1 !== y0) { const k = (want - y0) / (y1 - y0); return [x0 + (x1 - x0) * k, want]; }
  }
  const [x, y] = path[path.length - 1];
  return [x, Math.max(y, want)];
}
function routesSVG(s, routes, pick) {
  const lines = E.TARGETS.map(slot => {
    const [x0, dy] = OFF_POS[slot];
    const pts = routePath(slot, routes[slot], x0, s.ball + dy);
    return `<polyline class="dr-route${pick === slot ? ' is-on' : ''}" points="${pts.map(([x, y]) => `${x.toFixed(2)},${(110 - y).toFixed(2)}`).join(' ')}"/>`;
  }).join('');
  const ends = E.TARGETS.map(slot => {
    const [x0, dy] = OFF_POS[slot];
    const pts = routePath(slot, routes[slot], x0, s.ball + dy), [x, y] = pts[pts.length - 1];
    return `<span class="dr-route-end${pick === slot ? ' is-on' : ''}" style="left:${left(x)};top:${top(y)}"></span>`;
  }).join('');
  return `<svg class="dr-routes" viewBox="0 0 ${WIDTH} 120" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${ends}`;
}

function fieldHTML(st) {
  const s = st.s, los = s.ball;
  const fd = fdLine(s);
  const dots = spots(s).map(d => dotHTML(d.side, d.p, d.x, d.y, d.off)).join('');
  return `<div class="dr-field${st.panel === 'pass' ? ' is-routes' : ''}" role="${st.panel === 'pass' ? 'group' : 'img'}" aria-label="${esc(fieldLabel(st))}" data-dr-field>`
    + `<div class="dr-track" style="transform:${trackY(winTop(los))}">`
    + linesHTML(s)
    + `<i class="dr-los" data-dr-los style="top:${top(los)}"></i>`
    + `<i class="dr-fd" data-dr-fd style="top:${top(fd == null ? los : fd)}"${fd == null ? ' hidden' : ''}></i>`
    + `<div class="dr-rlayer" data-dr-routes>${st.panel === 'pass' && !s.result ? routesSVG(s, st.routes, st.pick) : ''}</div>`
    + dots
    + `<span class="dr-ball" data-dr-ball style="left:${left(MID)};top:${top(los)}"></span>`
    + `<div class="dr-callouts" data-dr-callouts></div>`
    + `</div></div>`;
}
const fdLine = s => (s.phase === 'play' && !s.result && s.ball + s.togo < 100 ? s.ball + s.togo : null);
function fieldLabel(st) {
  const s = st.s;
  const look = s.look && E.LOOKS[s.look];
  const base = `Ball on the ${dr.spot(s)}.${look && !s.result ? ` ${dr.team(s.sc.d).n} defense: ${look.name.toLowerCase()}, ${look.sub.toLowerCase()}, leaning to the ${s.shade === 's' ? 'strong' : 'weak'} side.` : ''}`;
  return st.panel === 'pass' ? base + ' Tap a receiver to change his route.' : base;
}
/** Moves the field to the drive's current snap: the camera, the lines, the players (CSS transitions animate it). */
function patchField(st) {
  const f = st.el.querySelector('[data-dr-field]');
  if (!f) return;
  const s = st.s, los = s.ball;
  const fd = fdLine(s);
  f.classList.toggle('is-routes', st.panel === 'pass' && !s.result);
  f.setAttribute('role', st.panel === 'pass' ? 'group' : 'img');
  f.setAttribute('aria-label', fieldLabel(st));
  f.querySelector('.dr-track').style.transform = trackY(winTop(los));
  f.querySelector('[data-dr-los]').style.top = top(los);
  const fdEl = f.querySelector('[data-dr-fd]');
  fdEl.hidden = fd == null;
  if (fd != null) fdEl.style.top = top(fd);
  spots(s).forEach(d => {
    const e = f.querySelector(`[data-dr-p="${d.key}"]`);
    if (!e) return;
    e.style.left = left(d.x);
    e.style.top = top(d.y);
    e.classList.toggle('is-off', !!d.off);
    e.classList.toggle('is-edge-l', d.x < 8);
    e.classList.toggle('is-edge-r', d.x > WIDTH - 8);
  });
  const ball = f.querySelector('[data-dr-ball]');
  ball.style.left = left(MID);
  ball.style.top = top(los);
  ball.classList.remove('is-loose', 'is-air');
  const cl = f.querySelector('[data-dr-callouts]');
  if (cl) cl.innerHTML = '';
  patchRoutes(st);
}
function patchRoutes(st) {
  const host = st.el.querySelector('[data-dr-routes]');
  if (!host) return;
  const on = st.panel === 'pass' && !st.busy && st.s && !st.s.result;
  host.innerHTML = on ? routesSVG(st.s, st.routes, st.pick) : '';
  st.el.querySelectorAll('[data-dr-rcv]').forEach(e => {
    if (on) {
      e.setAttribute('role', 'button');
      e.setAttribute('tabindex', '0');
      e.setAttribute('aria-label', `${st.s.U.o.by[e.dataset.drRcv].n}: ${E.ROUTES[st.routes[e.dataset.drRcv]].name}. Change his route.`);
    } else { e.removeAttribute('role'); e.removeAttribute('tabindex'); e.removeAttribute('aria-label'); }
  });
}

// ============================================================================ The snap, on the field
// A play becomes tracks: for each player and the ball, keyframes [t (0-1 of the play), x, y], and callouts. The play's
// own result decides everything (where the catch was, how far, who made the tackle): this only draws it.
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function at(track, t) {
  if (!track || !track.length) return null;
  if (t <= track[0][0]) return [track[0][1], track[0][2]];
  for (let i = 1; i < track.length; i++) {
    const [t1, x1, y1] = track[i];
    if (t <= t1) {
      const [t0, x0, y0] = track[i - 1];
      const k = t1 === t0 ? 1 : ease((t - t0) / (t1 - t0));
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
  }
  const l = track[track.length - 1];
  return [l[1], l[2]];
}
/** Spread a path's points over [t0, t1] by their length. */
function timed(path, t0, t1) {
  const d = [0];
  for (let i = 1; i < path.length; i++) d.push(d[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const tot = d[d.length - 1] || 1;
  return path.map(([x, y], i) => [t0 + (t1 - t0) * d[i] / tot, x, y]);
}
function choreo(s, p) {
  const L = p.ball, tr = {}, calls = [], start = {};
  spots(s, {ball: L, look: p.look, shade: p.shade}).forEach(d => { start[d.key] = [d.x, d.y, d.off]; tr[d.key] = [[0, d.x, d.y]]; });
  const add = (key, ...kf) => { if (tr[key]) tr[key].push(...kf); };
  const a = E.parse(p.act) || {};
  const D = s.U.d, cover = D.cover;
  const kind = p.kind === '2good' || p.kind === '2fail' ? p.res : p.kind;
  const end = Math.max(-8, Math.min(108, L + (p.gain || 0)));
  const ballTr = [[0, MID, L]];
  const isRun = kind === 'run' || (kind === 'fum' && p.who === 'RB');
  // The line: pass sets back, run drives forward; the front engages.
  OL.forEach(k => { const [x, y] = start['o-' + k]; add('o-' + k, isRun ? [0.25, x + 0.8 * dirSign(p.dir || 's'), y + 1.4] : [0.2, x, y - 1.1]); });
  D.front.forEach(k => {
    const s0 = start['d-' + k];
    if (!s0 || s0[2]) return;
    add('d-' + k, [0.22, s0[0] * 0.85 + MID * 0.15, isRun ? L + 0.6 : L - 1.2]);
  });
  if (kind === 'spike') {
    add('o-QB', [0.35, MID, L - 1.5]);
    ballTr.push([0.15, MID, L - 1.5], [0.5, MID, L - 1.5]);
    calls.push({t: 0.45, text: 'Spike', x: MID, y: L + 3});
    return {tr, ball: ballTr, calls, dur: 1000};
  }
  if (kind === 'fg' || kind === 'fgx') {
    add('o-QB', [0.2, MID, L - 7]);
    ballTr.push([0.2, MID, L - 7], [0.85, kind === 'fg' ? MID : MID + 6, 110]);
    calls.push({t: 0.86, text: kind === 'fg' ? 'It’s good!' : 'No good', x: MID, y: 104, cls: kind === 'fg' ? 'is-score' : 'is-bad'});
    return {tr, ball: ballTr, calls, dur: 2000, kick: true};
  }
  if (isRun) {
    const sg = dirSign(p.dir || 's');
    const holeX = MID + sg * 5;
    const fx = p.oob ? (sg > 0 ? WIDTH - 0.6 : 0.6) : clampX(holeX + sg * Math.min(12, Math.max(0, p.gain) * 0.35));
    add('o-QB', [0.14, MID + sg * 0.8, L - 5], [0.45, MID - sg * 2.5, L - 6.5]);
    add('o-RB', [0.14, MID + sg * 1.2, L - 4.8], [0.38, holeX, L + 0.8], [0.9, fx, end]);
    ballTr.push([0.08, MID, L - 5.2], [0.14, MID + sg * 1.2, L - 4.8]);
    tr['o-RB'].slice(2).forEach(k => ballTr.push(k));
    if (p.broke) calls.push({t: 0.6, text: 'Broken tackle!', key: 'o-RB'});
    if (kind === 'fum') calls.push({t: 0.86, text: 'Fumble!', x: fx, y: end + 3, cls: 'is-bad'});
    // Linebackers and safeties flow to the ball; the tackler meets it.
    D.lbs.concat(['SS', 'FS', 'NB', 'LCB', 'RCB']).forEach(k => {
      const s0 = start['d-' + k];
      if (!s0 || s0[2]) return;
      const near = k === p.by;
      add('d-' + k, [0.45, (s0[0] + holeX) / 2, Math.max(L + 1.5, s0[1] - 2)], [0.92, near ? fx + 0.6 : (s0[0] * 0.4 + fx * 0.6), near ? end + 0.9 : Math.max(end + 2.5, (s0[1] + end) / 2)]);
    });
    if (p.by && D.front.includes(p.by)) add('d-' + p.by, [0.9, fx - 0.6, end + 0.8]);
    // Receivers block downfield a little.
    E.TARGETS.filter(k => k !== 'RB').forEach(k => { const [x, y] = start['o-' + k]; add('o-' + k, [0.6, x + (MID - x) * 0.1, y + 5]); });
    finishCalls(p, kind, calls, fx, end);
    return {tr, ball: ballTr, calls, dur: 2300 + Math.min(900, Math.max(0, p.gain) * 25)};
  }
  // Passes (and sacks, and the trick play).
  const routes = Object.assign({}, p.routes || {});
  if (a.kind === 'pass') routes[a.slot] = a.route;
  const target = p.who || (a.kind === 'pass' ? a.slot : 'WR1');
  const routeOf = k => (p.trick && k === target ? 'go' : (p.read === 'pass' && k === 'WR3') ? 'slant' : routes[k] || 'go');
  const roll = a.flags && a.flags.r ? (OFF_POS[target][0] >= MID ? 1 : -1) : 0;
  const qbSpot = [MID + roll * 8, L - 7.2];
  const R = E.ROUTES[routeOf(target)] || E.ROUTES.go;
  const tThrow = p.trick ? 0.48 : Math.min(0.55, Math.max(0.3, 0.22 + R.time * 0.09));
  const air = p.air != null ? p.air : R.depth;
  const tCatch = Math.min(0.82, tThrow + Math.min(0.3, Math.max(0.08, Math.abs(air) / 70)));
  if (p.trick) {
    // The flea flicker: a handoff, the pitch back, then deep.
    add('o-RB', [0.14, MID + 1, L - 4.8], [0.3, MID + 1.5, L - 2.5], [0.6, MID + 3, L + 2]);
    add('o-QB', [0.12, MID, L - 5.5], [0.3, MID - 0.5, L - 7]);
    ballTr.push([0.1, MID, L - 5.4], [0.16, MID + 1, L - 4.8], [0.3, MID - 0.5, L - 7]);
  } else {
    add('o-QB', [0.22, qbSpot[0], qbSpot[1]]);
    ballTr.push([0.1, MID, L - 5.5], [0.22, qbSpot[0], qbSpot[1]]);
  }
  // Every receiver runs his route; the target's ends where the ball got to him.
  const recv = {};
  E.TARGETS.forEach(k => {
    if (p.trick && k === 'RB') return;
    const [x0, y0] = start['o-' + k];
    const path = routePath(k, routeOf(k), x0, y0);
    if (k === target && ['catch', 'inc', 'int'].includes(kind)) {
      const cp = pointAt(path, L, air);
      const cut = path.filter(pt => pt[1] < cp[1] - 0.01);
      cut.push(cp);
      tr['o-' + k] = timed(cut, 0.04, tCatch);
      recv[k] = cp;
    } else tr['o-' + k] = timed(path, 0.04, 0.8);
  });
  if (kind === 'sack' || kind === 'fum') {
    const tSack = 0.46;
    const sx = qbSpot[0], sy = Math.max(-8, L + (p.gain || -6));
    add('o-QB', [tSack, sx, qbSpot[1]], [tSack + 0.12, sx, sy]);
    ballTr.push([tSack, sx, qbSpot[1]], [tSack + 0.12, sx, sy]);
    if (p.by) add('d-' + p.by, [tSack, sx + 0.8, qbSpot[1] + 0.6], [tSack + 0.12, sx + 0.6, sy + 0.4]);
    calls.push({t: tSack + 0.04, text: kind === 'fum' ? 'Fumble!' : 'Sack!', x: sx, y: qbSpot[1] + 2.5, cls: 'is-bad'});
    coverage(tr, start, D, cover, p, L, null, 0.9);
    return {tr, ball: ballTr, calls, dur: 2300};
  }
  const cp = recv[target] || [OFF_POS[target][0], L + air];
  ballTr.push([tThrow, qbSpot[0], qbSpot[1]], [tCatch, cp[0], cp[1]]);
  const air2 = {t0: tThrow, t1: tCatch};
  let dur = 2500;
  if (kind === 'catch') {
    const fx = p.oob ? (cp[0] >= MID ? WIDTH - 0.6 : 0.6) : clampX(cp[0] + (MID - cp[0]) * 0.15);
    const tEnd = Math.min(0.95, tCatch + 0.12 + Math.min(0.3, Math.max(0, end - cp[1]) / 60));
    tr['o-' + target].push([tEnd, fx, end]);
    ballTr.push([tEnd, fx, end]);
    if (p.broke) calls.push({t: (tCatch + tEnd) / 2, text: 'Broken tackle!', key: 'o-' + target});
    coverage(tr, start, D, cover, p, L, {at: tCatch, x: fx, y: end, t: tEnd}, tEnd);
    finishCalls(p, kind, calls, fx, end, tEnd);
    dur = 2500 + (tEnd - tCatch) * 2400;
  } else if (kind === 'inc') {
    ballTr.push([Math.min(0.95, tCatch + 0.1), cp[0] + 1.2, cp[1] - 1.5]);
    coverage(tr, start, D, cover, p, L, {at: tCatch, x: cp[0], y: cp[1], miss: true}, tCatch);
    calls.push({t: tCatch, text: p.by && !p.trick ? 'Broken up' : 'Incomplete', x: cp[0], y: cp[1] + 2.8});
    if (p.kind === '2fail') calls.push({t: 0.9, text: 'Stopped', x: MID, y: L + 6, cls: 'is-bad'});
  } else if (kind === 'int') {
    const back = Math.max(L + 2, cp[1] - 8);
    ballTr.push([0.95, cp[0] + (MID - cp[0]) * 0.3, back]);
    coverage(tr, start, D, cover, p, L, {at: tCatch, x: cp[0], y: cp[1], pick: true, back}, tCatch);
    calls.push({t: tCatch + 0.02, text: 'Picked off!', x: cp[0], y: cp[1] + 2.8, cls: 'is-bad'});
    dur = 2600;
  }
  return {tr, ball: ballTr, calls, dur, air: air2};
}
/** Coverage: man calls trail their receivers; zones drop, then everyone converges on the ball. */
function coverage(tr, start, D, cover, p, L, ballAt, tEnd) {
  const man = p.dcall === 'c0' || p.dcall === 'c1';
  const deep = {c2: [[MID - 12, 14], [MID + 12, 14]], c3: [[8, 13], [MID, 15], [WIDTH - 8, 13]], c4: [[8, 13], [MID - 6, 15], [MID + 6, 15], [WIDTH - 8, 13]],
    pv: [[10, 22], [MID - 6, 24], [MID + 6, 24], [WIDTH - 10, 22]], fire: [[8, 12], [MID, 15], [WIDTH - 8, 12]], rb: [[MID, 14]], c0: [], c1: [[MID, 15]]}[p.dcall] || [[MID, 14]];
  const used = new Set();
  Object.keys(cover).forEach(rk => {
    const dk = cover[rk], s0 = start['d-' + dk];
    if (!s0 || s0[2] || !tr['o-' + rk] || !tr['d-' + dk]) return;
    used.add(dk);
    const r = tr['o-' + rk];
    const t1 = ballAt ? ballAt.at : 0.8;
    if (man) {
      [0.2, 0.4, 0.6, t1].forEach(t => { const q = at(r, Math.max(0, t - 0.05)); if (q) tr['d-' + dk].push([t, q[0] + (MID - q[0]) * 0.05, q[1] + 0.8]); });
    } else {
      const z = deep.length && (dk === 'LCB' || dk === 'RCB') && ['c3', 'c4', 'pv', 'fire'].includes(p.dcall) ? deep[dk === 'LCB' ? 0 : deep.length - 1] : null;
      const q = at(r, 0.4);
      tr['d-' + dk].push([0.4, z ? z[0] : (s0[0] + q[0]) / 2, z ? L + z[1] : Math.max(L + 3, (s0[1] + q[1]) / 2 + 2)]);
    }
  });
  // Safeties (unless in man on someone) drop to the deep zones; linebackers to their hooks (or blitz).
  ['FS', 'SS'].concat(D.lbs).forEach((dk, i) => {
    const s0 = start['d-' + dk];
    if (!s0 || s0[2] || used.has(dk) || !tr['d-' + dk]) return;
    const z = dk === 'FS' || dk === 'SS' ? deep[i % Math.max(1, deep.length)] || [MID, 15] : [s0[0], 7];
    if ((p.dcall === 'c0' || p.dcall === 'fire' || p.dcall === 'rb') && dk !== 'FS') tr['d-' + dk].push([0.35, MID + (s0[0] - MID) * 0.3, L - 2]);
    else tr['d-' + dk].push([0.4, z[0], L + z[1]]);
  });
  if (!ballAt) return;
  // After the catch (or the miss), the nearest close in; the man in coverage or the tackler arrives.
  Object.keys(tr).filter(k => k.startsWith('d-') && !D.front.includes(k.slice(2))).forEach(k => {
    const last = tr[k][tr[k].length - 1];
    if (!last || start[k][2]) return;
    const slot = k.slice(2), hero = slot === p.by;
    if (ballAt.pick && hero) { tr[k].push([ballAt.at, ballAt.x, ballAt.y + 0.3], [0.95, ballAt.x + (MID - ballAt.x) * 0.3, ballAt.back]); return; }
    if (ballAt.miss) { if (hero) tr[k].push([ballAt.at, ballAt.x + 0.9, ballAt.y + 0.6]); return; }
    const t = Math.max(last[0] + 0.05, ballAt.t || tEnd);
    if (hero) tr[k].push([t, ballAt.x + 0.7, ballAt.y + 0.8]);
    else tr[k].push([t, last[1] * 0.5 + ballAt.x * 0.5, Math.max(ballAt.y + 2, (last[2] + ballAt.y) / 2)]);
  });
}
function finishCalls(p, kind, calls, x, y, t = 0.92) {
  if (p.td || p.kind === '2good') calls.push({t, text: p.kind === '2good' ? 'It’s good!' : 'Touchdown!', x, y: Math.min(106, y + 3), cls: 'is-score'});
  else if (p.kind === '2fail') calls.push({t, text: 'Stopped', x, y: y + 3, cls: 'is-bad'});
  else if (p.first) calls.push({t, text: 'First down', x, y: y + 3, cls: 'is-good'});
  else if (p.oob) calls.push({t, text: 'Out of bounds', x: Math.max(8, Math.min(WIDTH - 8, x)), y: y + 3});
}

/** Plays a choreography on the field. Resolves when it's done (or skipped: a tap on the field). */
function runAnim(st, plan, p) {
  return new Promise(resolve => {
    const f = st.el.querySelector('[data-dr-field]');
    if (!f || ui.RM || !st.ctx.visible) { resolve(); return; }
    const track = f.querySelector('.dr-track'), ball = f.querySelector('[data-dr-ball]'), cl = f.querySelector('[data-dr-callouts]');
    const els = {};
    Object.keys(plan.tr).forEach(k => { els[k] = f.querySelector(`[data-dr-p="${k}"]`); });
    f.classList.add('is-anim');
    cl.innerHTML = '';
    const shown = new Set();
    const clock = st.el.querySelector('[data-dr-clock]');
    const c0 = p.clock, c1 = p.t1 != null ? p.t1 : p.after.clock;
    const wt0 = winTop(p.ball);
    const t0 = performance.now();
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      f.classList.remove('is-anim');
      f.removeEventListener('click', skip);
      st.anim = null;
      resolve();
    };
    const draw = t => {
      Object.keys(plan.tr).forEach(k => {
        const e = els[k], q = at(plan.tr[k], t);
        if (!e || !q) return;
        e.style.left = left(q[0]);
        e.style.top = top(q[1]);
      });
      const b = at(plan.ball, t);
      if (b) { ball.style.left = left(b[0]); ball.style.top = top(b[1]); }
      ball.classList.toggle('is-air', !!(plan.air && t > plan.air.t0 && t < plan.air.t1) || !!(plan.kick && t > 0.2 && t < 0.85));
      // The camera follows the ball when it heads off the top of the window.
      const want = b ? Math.min(110, Math.max(wt0, b[1] + 9)) : wt0;
      track.style.transform = trackY(want);
      plan.calls.forEach((c, i) => {
        if (t < c.t || shown.has(i)) return;
        shown.add(i);
        const pos = c.key ? at(plan.tr[c.key], c.t) : [c.x, c.y];
        const el = document.createElement('span');
        el.className = 'dr-co' + (c.cls ? ' ' + c.cls : '');
        el.textContent = c.text;
        el.style.left = left(Math.max(9, Math.min(WIDTH - 9, pos[0])));
        el.style.top = top(pos[1] + (c.key ? 2.8 : 0));
        cl.appendChild(el);
      });
      if (clock) clock.textContent = dr.clockText(Math.round(c0 + (c1 - c0) * Math.min(1, Math.max(0, (t - 0.08) / 0.85))));
    };
    const frame = now => {
      if (done || st.dead) { stop(); return; }
      const t = Math.min(1, (now - t0) / plan.dur);
      draw(t);
      if (t >= 1) { st.timers.push(setTimeout(stop, 420)); return; }
      requestAnimationFrame(frame);
    };
    const skip = () => { if (!done) { draw(1); stop(); } };
    st.anim = {skip};
    f.addEventListener('click', skip);
    requestAnimationFrame(frame);
  });
}
/** The runoff before a snap from a running clock: the scorebug counts it down quickly. */
function runOff(st, from, to) {
  return new Promise(resolve => {
    const el = st.el.querySelector('[data-dr-clock]');
    if (!el || from === to || ui.RM || !st.ctx.visible) { if (el) el.textContent = dr.clockText(to); resolve(); return; }
    const t0 = performance.now(), ms = 420;
    const step = now => {
      if (st.dead) { resolve(); return; }
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = dr.clockText(Math.round(from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

// ============================================================================ Markup: the game
function bugHTML(s) {
  const [oc, oa] = tcol(s.sc.o), [dc, da] = tcol(s.sc.d);
  const tos = Array.from({length: 3}, (_, i) => `<i class="${i < s.tos ? 'is-on' : ''}"></i>`).join('');
  return `<div class="dr-bug" data-dr-bug>`
    + `<span class="dr-bug-t is-them" style="--tc:${esc(dc)};--ta:${esc(da)}"><span class="dr-bug-ab">${esc(s.sc.d)}</span></span>`
    + `<span class="dr-bug-sc" data-dr-them>${s.them}</span>`
    + `<span class="dr-bug-mid"><span class="dr-bug-q">Q4</span><span class="dr-bug-clk${s.running ? ' is-run' : ''}" data-dr-clock>${dr.clockText(s.clock)}</span></span>`
    + `<span class="dr-bug-sc" data-dr-us>${s.us}</span>`
    + `<span class="dr-bug-t is-us" style="--tc:${esc(oc)};--ta:${esc(oa)}"><span class="dr-bug-poss" aria-hidden="true"></span><span class="dr-bug-ab">${esc(s.sc.o)}</span><span class="dr-bug-you">You</span>`
    + `<span class="dr-bug-to" data-dr-tos aria-label="${esc(plural(s.tos, 'timeout') + ' left')}">${tos}</span></span>`
    + `</div>`;
}
function sitHTML(s) {
  if (s.result) return `<p class="dr-sit" data-dr-sit><b>Final</b> · ${esc(dr.resultText(s).head)}</p>`;
  if (s.phase === 'pat') return `<p class="dr-sit" data-dr-sit><b>Touchdown</b> · down one · clock stopped</p>`;
  const where = s.ball === 50 ? 'ball at midfield' : `ball on the ${dr.spot(s)}`;
  return `<p class="dr-sit" data-dr-sit><b>${esc(dr.downText(s.down, s.togo, s.ball))}</b> · ${esc(where)} · `
    + `<span class="${s.running ? 'is-run' : ''}">${s.running ? 'clock running' : 'clock stopped'}</span></p>`;
}
function legendHTML() {
  return `<div class="dr-legend"><span class="dr-scale" aria-hidden="true"><span>worse</span><i></i><span>better</span></span>`
    + `<button type="button" class="btn btn-secondary btn-s dr-ratings" data-dr-ratings>${ui.icon('search', {size: 16})}<span class="btn-label">Player ratings</span></button></div>`;
}
function lookHTML(s) {
  const look = E.LOOKS[s.look];
  return `<p class="dr-look"><span class="dr-look-k">Defense</span><b>${esc(look.name)}</b><span class="dr-look-s">${esc(look.sub)}</span></p>`;
}
function headRow(title, s, back) {
  const where = s.phase === 'pat' ? 'Two-point try' : `${dr.downText(s.down, s.togo, s.ball)} · ${s.ball === 50 ? 'midfield' : dr.spot(s)}`;
  return `<div class="dr-call-h"><h3 class="dr-call-t" id="dr-call-t">${esc(title)}</h3>`
    + (back ? `<button type="button" class="btn btn-secondary btn-s dr-back" data-dr-back>${ui.icon('chevron-left', {size: 16})}<span class="btn-label">Back</span></button>` : `<p class="dr-call-s">${esc(where)}</p>`)
    + `</div>`;
}
function mainHTML(st) {
  const s = st.s, o = E.options(s);
  const pat = s.phase === 'pat';
  const calls = [['run', 'Run'], ['pass', 'Pass'], ['rpo', 'RPO'], ['trick', 'Trick']].map(([k, l]) => {
    const off = k === 'trick' && !s.trick;
    return `<button type="button" class="dr-cb${off ? ' is-used' : ''}" ${k === 'trick' ? `data-dr-go="${E.tok.trick}"` : `data-dr-menu="${k}"`}${off ? ' disabled aria-label="Trick play, already used this drive"' : ''}>${esc(l)}${off ? '<small>Used</small>' : ''}</button>`;
  }).join('');
  const fg = o.fg ? `<button type="button" class="dr-fg" data-dr-go="${E.tok.fg}"><b>Field goal</b><small>${esc(`${o.fg.dist} yards · ${pct(o.fg.p)} to make`)}</small></button>` : '';
  const kick = pat ? `<button type="button" class="dr-fg" data-dr-go="${E.tok.kick}"><b>Kick it</b><small>The extra point ties it. Overtime.</small></button><p class="dr-or">or go for two from the 2, to win it</p>` : '';
  const tools = [];
  if (o.timeout || (s.running && !pat)) tools.push(`<button type="button" class="btn btn-secondary btn-s dr-tool" data-dr-go="${E.tok.timeout}"${o.timeout ? '' : ' disabled'}>${ui.icon('clock', {size: 16})}<span class="btn-label">Timeout · ${s.tos} left</span></button>`);
  if (o.spike) tools.push(`<button type="button" class="btn btn-secondary btn-s dr-tool" data-dr-go="${E.tok.spike}">${ui.icon('bolt', {size: 16})}<span class="btn-label">Spike</span></button>`);
  const warn = s.running && s.clock <= E.HURRY
    ? `<p class="dr-warn">${ui.icon('clock', {size: 15})}<span>${esc(`The clock is running and the next snap takes ${E.HURRY} seconds to get off. ${o.timeout ? 'Call a timeout' : s.down < 4 ? 'Spike it' : 'Nothing left to stop it'}${o.fg ? (o.timeout ? ', then kick' : '') : ''}.`)}</span></p>`
    : '';
  return `<section class="dr-call" aria-labelledby="dr-call-t">${headRow(pat ? 'Kick or go for two?' : 'Your call', s)}`
    + kick + lookHTML(s) + `<div class="dr-calls">${calls}</div>` + fg
    + (tools.length ? `<div class="dr-tools">${tools.join('')}</div>` : '') + warn + `</section>`;
}
const FLAG_INFO = [['a', 'Play action'], ['r', 'Roll out'], ['o', 'Out of bounds']];
function receiverRowHTML(st, slot) {
  const s = st.s, p = s.U.o.by[slot], route = st.routes[slot];
  const od = E.odds(s, slot, route, st.flags);
  const stat = `${pct(od.caught)} caught · ${od.ypt.toFixed(1)} yds a throw${od.picked >= 0.03 ? ` · ${pct(od.picked)} picked` : ''}`;
  return `<li class="dr-rcv"><button type="button" class="dr-rcv-go" data-dr-go="${E.tok.pass(slot, route, st.flags)}" aria-label="${esc(`Throw to ${p.n}, ${E.ROUTES[route].name}: ${stat}`)}">`
    + `<span class="dr-rcv-pos">${esc(dr.posOf(slot))}</span><span class="dr-rcv-id"><b>${esc(dr.short(p.n))}</b></span>`
    + `<span class="dr-rcv-st">${esc(stat)}</span></button>`
    + `<button type="button" class="dr-rcv-rt" data-dr-route="${slot}" aria-label="${esc(`${p.n}'s route: ${E.ROUTES[route].name}. Change it.`)}">${esc(E.ROUTES[route].name)}${ui.icon('chevron-down', {size: 12})}</button></li>`;
}
function passHTML(st) {
  const s = st.s;
  const chips = FLAG_INFO.map(([k, l]) => `<button type="button" class="chip dr-flag" data-dr-flag="${k}" aria-pressed="${!!st.flags[k]}">${esc(l)}</button>`).join('');
  return `<section class="dr-call" aria-labelledby="dr-call-t">${headRow(s.phase === 'pat' ? 'Two-point pass' : 'Pass', s, true)}${lookHTML(s)}`
    + `<p class="dr-hint">Tap a receiver on the field (or his route) to change it. Tap a name to throw it to him.</p>`
    + `<div class="dr-flags" role="group" aria-label="Options">${chips}</div>`
    + `<ol class="dr-rcvs" data-dr-rcvs>${E.TARGETS.map(slot => receiverRowHTML(st, slot)).join('')}</ol></section>`;
}
function runHTML(st, kind) {
  const s = st.s, mk = kind === 'run' ? E.tok.run : E.tok.rpo;
  const title = (s.phase === 'pat' ? 'Two-point ' : '') + (kind === 'run' ? 'run' : 'RPO');
  const sub = kind === 'rpo' ? '<p class="dr-hint">Your QB reads the box: against a crowd he throws a quick slant, against a light box he hands it off.</p>' : '';
  return `<section class="dr-call" aria-labelledby="dr-call-t">${headRow(title.charAt(0).toUpperCase() + title.slice(1), s, true)}${lookHTML(s)}${sub}`
    + `<div class="dr-dirs"><button type="button" class="dr-cb is-dir" data-dr-go="${mk('w', st.runOob)}">← Weak</button><button type="button" class="dr-cb is-dir" data-dr-go="${mk('s', st.runOob)}">Strong →</button></div>`
    + `<div class="dr-oob"><span class="dr-oob-tx"><b>Get out of bounds</b><small>The ball carrier tries to stop the clock. No guarantee.</small></span>${ui.switchCtl({name: 'dr-oob', checked: st.runOob, label: 'Get out of bounds'})}</div>`
    + `</section>`;
}
function snapHTML() {
  return `<section class="dr-snap" aria-live="polite"><p class="dr-snap-t"><span class="spin" aria-hidden="true"></span>Snap…</p><p class="dr-snap-s">Tap the field to skip</p></section>`;
}
function panelHTML(st) {
  const s = st.s;
  if (st.busy) return snapHTML();
  const bd = st.last ? breakdownHTML(st) : '';
  if (s.result) return bd + resultHTML(st);
  if (st.panel === 'pass') return bd + passHTML(st);
  if (st.panel === 'run' || st.panel === 'rpo') return bd + runHTML(st, st.panel);
  return bd + mainHTML(st);
}

// ---------------------------------------------------------------------------- The breakdown of the last snap
function breakdownHTML(st) {
  const L = st.last, s = st.s, p = L.p;
  if (p.kind === 'timeout') return `<section class="dr-bd is-flat is-mini" data-dr-bd><p class="dr-bd-line">${esc(dr.playText(s, p).line)}</p></section>`;
  const t = dr.playText(s, p);
  const ready = L.wpA != null && L.wpB != null;
  const delta = ready ? Math.round((L.wpA - L.wpB) * 100) : null;
  const badge = delta == null ? `<span class="dr-bd-d is-wait"><span class="spin" aria-hidden="true"></span></span>`
    : `<span class="dr-bd-d ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-even'}" aria-label="${esc(`Win chance ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} points`)}">${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)}</span>`;
  const wp = ready ? `<p class="dr-bd-wp">Win chance ${pct(L.wpB)} → ${pct(L.wpA)}</p>` : `<p class="dr-bd-wp">Working out the win chance…</p>`;
  const ct = dr.callText(s, p);
  const call = ct ? `<p class="dr-bd-call ${ct.good ? 'is-good' : 'is-bad'}">${esc(ct.text)}</p>` : '';
  let grade = '', opts = '';
  if (L.scores) {
    const i = L.scores.findIndex(x => x.token === p.act), best = L.scores[0];
    const mine = i >= 0 ? L.scores[i] : null;
    const isBest = mine && best && mine.wp >= best.wp - 0.015;
    const rank = mine ? 1 + L.scores.filter(x => x.wp > mine.wp + 0.015).length : 0;
    grade = isBest
      ? `<p class="dr-bd-grade is-best">${ui.icon('check-circle', {size: 16})}<span>Your call: <b>the best one.</b></span></p>`
      : mine ? `<p class="dr-bd-grade">${ui.icon('info', {size: 16})}<span>${esc(`Your call: ${ui.ordinal(rank)} of ${L.scores.length}. Best: ${dr.tokenShort(s, best.token)} (${pct(best.wp)}).`)}</span></p>` : '';
    opts = `<details class="dr-bd-opts"><summary>How every option scored</summary><ol>${L.scores.map(x => `<li class="${x.token === p.act ? 'is-mine' : ''}"><span>${esc(dr.tokenShort(s, x.token))}${x.token === p.act ? ' · yours' : ''}</span><i style="--w:${Math.round(x.wp * 100)}%"></i><b>${pct(x.wp)}</b></li>`).join('')}</ol>`
      + `<p class="dr-bd-note">Each option played out ${L.n} times from that snap by a good play-caller. Win chance counts a tie as half.</p></details>`;
  } else if (L.scoring) grade = `<p class="dr-bd-grade is-wait"><span class="spin" aria-hidden="true"></span><span>Scoring every option…</span></p>`;
  const replay = L.canReplay ? `<button type="button" class="btn btn-secondary btn-s dr-replay" data-dr-replay>${ui.icon('play-fill', {size: 14})}<span class="btn-label">Replay</span></button>` : '';
  return `<section class="dr-bd is-${t.tone}" data-dr-bd aria-label="Last play">`
    + `<div class="dr-bd-top">${badge}<div class="dr-bd-main"><h3 class="dr-bd-h">${esc(t.head)}</h3><p class="dr-bd-line">${esc(t.line)}</p>${wp}</div></div>`
    + call + grade + `<div class="dr-bd-act">${replay}${opts}</div></section>`;
}

const TONE_IC = {good: 'arrow-up', bad: 'arrow-down', score: 'trophy', flat: 'chevron-right'};
function logItemHTML(s, p) {
  const t = dr.playText(s, p);
  const pre = p.kind === 'timeout' ? dr.clockText(p.clock) : p.kind === 'xp' ? 'After the touchdown' : p.two ? 'Two-point try' : `${dr.downText(p.down, p.togo, p.ball)} · ${dr.spot(s, p.ball)} · ${dr.clockText(p.clock)}`;
  const what = p.kind === 'timeout' ? '' : dr.tokenLabel(s, p.act) + (p.look && !['timeout', 'kick', 'spike', 'fg'].includes(p.call) ? ` vs ${E.LOOKS[p.look].name.toLowerCase()}` : '');
  return `<li class="dr-lg is-${t.tone}"><span class="dr-lg-ic" aria-hidden="true">${ui.icon(TONE_IC[t.tone] || 'chevron-right', {size: 14})}</span>`
    + `<span class="dr-lg-b"><small class="dr-lg-pre">${esc(pre)}</small><b class="dr-lg-h">${esc(t.line)}</b>`
    + (what ? `<small class="dr-lg-sub">${esc(what)}</small>` : '') + `</span></li>`;
}
function pbpHTML(st) {
  const s = st.s;
  if (!s || !s.plays.length) return '';
  return `<details class="dr-pbp"${st.pbpOpen ? ' open' : ''} data-dr-pbp><summary>Play-by-play</summary><ol class="dr-log">${s.plays.slice().reverse().map(p => logItemHTML(s, p)).join('')}</ol></details>`;
}
function resultHTML(st) {
  const s = st.s;
  if (!s.result) return '';
  const r = dr.resultText(s);
  const surv = st.mode === 'surv';
  const sv = surv ? dr.survivor() : null;
  let actions, foot = '';
  if (!surv) {
    actions = `<button type="button" class="btn btn-primary" data-dr-share>${ui.icon('share')}<span class="btn-label">Share</span></button>`;
    foot = `<p class="dr-next">${ui.icon('clock', {size: 15})}<span>Next drill in <span data-dr-next>${esc(nextIn())}</span></span></p>`;
  } else if (s.result === 'L') {
    actions = `<button type="button" class="btn btn-primary" data-dr-newrun>${ui.icon('play-fill')}<span class="btn-label">New run</span></button>`;
    foot = `<p class="dr-next">${esc(`Run over: ${plural(sv.run ? sv.run.streak : 0, 'drive')} survived. Best ${sv.best}.`)}</p>`;
  } else {
    actions = `<button type="button" class="btn btn-primary" data-dr-nextdrive>${ui.icon('play-fill')}<span class="btn-label">Next drive</span></button>`;
    foot = `<p class="dr-next">${esc(`${plural(sv.run ? sv.run.streak : 0, 'drive')} survived. Best ${sv.best}.`)}</p>`;
  }
  return `<section class="card dr-result is-${s.result}" aria-labelledby="dr-res-h">`
    + `<p class="dr-res-k">${esc(surv ? `Survivor · drive ${(sv.run ? sv.run.i : 0) + 1}` : `Two-Minute Drill #${st.n} · ${dr.dayLabel(st.n)}`)}</p>`
    + `<h2 class="dr-res-h" id="dr-res-h">${esc(r.head)}</h2>`
    + `<p class="dr-res-sc">${esc(`${s.sc.o} ${s.us} – ${s.sc.d} ${s.them}`)}</p>`
    + `<p class="dr-res-sub">${esc(r.sub)}</p>`
    + `<p class="dr-res-sq" aria-hidden="true">${esc(dr.squares(s))}</p>`
    + `<div class="dr-res-act">${actions}</div>${foot}</section>`;
}
function headHTML(st) {
  const s = st.s, n = st.n;
  const sc = s.sc, deficit = sc.them - sc.us;
  const g = sc.g;
  const kick = `Down ${deficit} · ${dr.clockText(sc.t)} left · ${dr.spot(s, sc.b)}`;
  const title = st.mode === 'surv' ? 'Survivor' : `Drill #${n}`;
  const sub = st.mode === 'surv'
    ? (() => { const v = dr.survivor(); return `Drive ${(v.run ? v.run.i : 0) + 1}${v.run && v.run.streak ? ` · ${plural(v.run.streak, 'drive')} survived` : ''} · best ${v.best}`; })()
    : `${dr.dayLabel(n, {weekday: 'long', month: 'long', day: 'numeric'})}${g ? ` · Week ${g.wk}: ${g.a} at ${g.h}` : ''}`;
  return `<header class="dr-head">`
    + `<p class="dr-kick">${esc(kick)}</p>`
    + `<h2 class="dr-title">${esc(title)}</h2>`
    + `<p class="dr-sub">${esc(sub)}</p>`
    + ui.iconButton({icon: 'info', label: 'How the Two-Minute Drill works', cls: 'dr-howto', attrs: {'data-dr-help': ''}})
    + `</header>`;
}
const MODES = [{id: 'daily', label: 'Daily'}, {id: 'surv', label: 'Survivor'}];
function gameHTML(st) {
  const s = st.s;
  return headHTML(st)
    + `<div class="dr-game">${bugHTML(s)}${sitHTML(s)}${fieldHTML(st)}${legendHTML()}`
    + `<div class="dr-panel" data-dr-panel>${panelHTML(st)}</div></div>`
    + `<div data-dr-pbph>${pbpHTML(st)}</div>`;
}
function survIntroHTML() {
  const v = dr.survivor();
  return `<header class="dr-head"><p class="dr-kick">Drive after drive</p><h2 class="dr-title">Survivor</h2>`
    + `<p class="dr-sub">Random teams, a tougher spot every time. Win or tie to keep going; one loss ends the run.</p>`
    + ui.iconButton({icon: 'info', label: 'How the Two-Minute Drill works', cls: 'dr-howto', attrs: {'data-dr-help': ''}}) + `</header>`
    + `<section class="card dr-intro"><div class="tiles tiles-2">`
    + ui.statTile({label: 'Best run', value: nf(v.best)}) + ui.statTile({label: 'Runs', value: nf(v.runs)})
    + `</div><button type="button" class="btn btn-primary dr-start" data-dr-newrun>${ui.icon('play-fill')}<span class="btn-label">Start a run</span></button></section>`;
}
function bodyHTML(st) {
  if (!dr.DOC) return loadingHTML();
  const seg = ui.seg({name: 'dr-mode', items: MODES, value: st.mode, small: true, label: 'Mode', cls: 'dr-mode'});
  const main = st.mode === 'surv' && !st.s ? survIntroHTML() : gameHTML(st);
  return seg + main + boardHTML(st);
}

// ============================================================================ Markup: scoreboard
const SB_MODES = [{id: 'today', label: 'Today'}, {id: 'survivor', label: 'Survivor'}];
const SB_EMPTY = {today: ['Be first on the board.', 'No drives yet today. Run yours to take the top spot.'], survivor: ['', 'No Survivor runs yet.']};
function sbRowHTML(st, r, mode) {
  let sub, trail, label;
  if (mode === 'today') {
    const rp = r.k ? E.replay(dr.scenario(st.n), dr.DOC.teams, r.k) : null;
    const score = rp && rp.result ? `${rp.us}–${rp.them}` : '';
    sub = r.r === 'L' ? `Got to the ${rp ? dr.spot(rp, r.y) : r.y} · ${plural(r.p, 'play')}` : `${dr.clockText(r.c)} left · ${plural(r.p, 'play')}`;
    trail = `<span class="n4 c-bval dr-bval is-${r.r}">${r.r} ${esc(score)}</span>`;
    label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}: ${{W: 'won', T: 'tied', L: 'lost'}[r.r]} ${score}. ${sub}. Show the drive.`;
  } else {
    sub = 'Best Survivor run';
    trail = `<span class="n4 c-bval dr-bval">${nf(r.b)}</span>`;
    label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}: best run ${plural(r.b, 'drive')}.`;
  }
  const tag = mode === 'today' ? 'button type="button"' : 'div';
  const close = mode === 'today' ? 'button' : 'div';
  return `<div class="c-brow-w" role="listitem"><${tag} class="row c-brow dr-brow${r.me ? ' is-me' : ''}"${mode === 'today' ? ` data-dr-who="${esc(r.key)}"` : ''} aria-label="${esc(label)}">`
    + `<span class="c-brank n4${r.rank <= 3 ? ' is-r' + r.rank : ''}" aria-hidden="true">${r.rank}</span>`
    + `<span class="row-lead" aria-hidden="true">${ui.nickAvatar(r.name, {size: 36, managerId: r.managerId, you: r.me, crown: r.rank === 1})}</span>`
    + `<span class="row-main" aria-hidden="true"><span class="row-title"><span class="c-bnick">${esc(r.name)}</span>${r.me ? ui.badge('you') : ''}</span><span class="row-sub">${esc(sub)}</span></span>`
    + `<span class="row-trail" aria-hidden="true">${trail}</span></${close}></div>`;
}
function sbBodyHTML(st, mode) {
  const state = dr.boardState();
  if (state === 'loading') return `<div class="c-board-sk">${ui.skeleton('rows', 3, {label: 'Loading the scoreboard.'})}</div>`;
  if (state !== 'ready') return `<p class="c-board-note">The scoreboard isn't connected right now.</p>`;
  let rows = [];
  try { rows = dr.boardRows(mode, st.n || dr.todayNumber()); } catch (e) { console.error(e); }
  if (!rows.length) {
    const [t, body] = SB_EMPTY[mode];
    return `<div class="c-board-empty">${t ? `<p class="c-board-et">${esc(t)}</p>` : ''}<p class="c-board-eb">${esc(body)}</p></div>`;
  }
  const n = rows.length;
  const lead = mode === 'today' ? `<p class="dr-sb-sum">${esc(`${n} ${n === 1 ? 'has' : 'have'} run today’s drill.`)}</p>` : '';
  return lead + `<div class="c-brows" role="list" aria-label="${esc(mode === 'today' ? "Today's drives" : 'Best Survivor runs')}">${rows.map(r => sbRowHTML(st, r, mode)).join('')}</div>`;
}
function boardHTML(st) {
  const hide = dr.boardState() === 'wait';
  return `<div class="dr-sb-host" data-dr-board${hide ? ' hidden' : ''}><section class="card c-board dr-board" aria-labelledby="dr-sb-t">`
    + `<div class="c-board-head"><h2 class="c-board-t" id="dr-sb-t">Scoreboard</h2></div>`
    + ui.seg({name: 'dr-sb', items: SB_MODES, value: st.sbMode, small: true, label: 'Scoreboard', cls: 'c-board-seg'})
    + `<div class="c-board-body" data-dr-sbody>${sbBodyHTML(st, st.sbMode)}</div></section></div>`;
}
const norm = typeof document !== 'undefined' ? document.createElement('template') : null;
function patchBoard(st, {fade = false} = {}) {
  if (st.dead || !dr.DOC) return;
  const host = st.el.querySelector('[data-dr-board]');
  if (!host) return;
  host.hidden = dr.boardState() === 'wait';
  const body = host.querySelector('[data-dr-sbody]');
  if (!body) return;
  const html = sbBodyHTML(st, st.sbMode);
  norm.innerHTML = html;
  if (body.innerHTML === norm.innerHTML) return;
  const go2 = () => { body.innerHTML = html; ui.hydrate(body); };
  if (fade && !ui.RM && st.ctx.visible) ui.crossfade(body, go2, {duration: 160}); else go2();
}
function scheduleBoard(st) {
  if (st.dead) return;
  if (st.cancelBoard) st.cancelBoard();
  st.cancelBoard = ui.whenIdle(() => { st.cancelBoard = null; patchBoard(st); });
}

// ============================================================================ Sheets
/** Someone's drive today: hidden until this phone has finished its own. */
function openDrive(st, key) {
  const row = dr.boardRows('today', st.n).find(r => r.key === key);
  if (!row) return;
  const mine = dr.dayState(st.n);
  let body;
  if (!row.me && !mine.result) {
    body = `<p class="dr-sh-note">${ui.icon('lock', {size: 16})}<span>${esc(`Run today’s drill to watch ${row.name}’s drive.`)}</span></p>`;
  } else {
    const d = dr.driveOf(key, st.n);
    if (!d || !d.s) body = `<p class="dr-sh-note">${ui.icon('info', {size: 16})}<span>That drive didn’t come with its plays.</span></p>`;
    else {
      const r = dr.resultText(d.s, {you: row.me});
      body = `<p class="dr-sh-res is-${d.s.result}"><b>${esc(r.head)}</b><span>${esc(`${d.s.sc.o} ${d.s.us} – ${d.s.sc.d} ${d.s.them} · ${r.sub}`)}</span></p>`
        + `<ol class="dr-log">${d.s.plays.map(p => logItemHTML(d.s, p)).join('')}</ol>`;
    }
  }
  ui.haptic('light');
  ui.openSheet({title: row.me ? 'Your drive' : `${row.name}’s drive`, body: `<div class="dr-sheet">${body}</div>`, detents: ['medium', 'large'], cls: 'sh-drill'});
}
function ratingRowHTML(p, pos) {
  return `<li class="dr-rt"><span class="dr-rt-j">${p.j == null ? '' : '#' + p.j}</span><span class="dr-rt-n"><b>${esc(p.n)}</b><small>${esc(pos)}</small></span>`
    + `<span class="dr-rt-v" style="--rc:${ratingColor(p.r)}">${p.r}</span></li>`;
}
const DEF_POS = {LDE: 'DE', RDE: 'DE', LDT: 'DT', RDT: 'DT', NT: 'NT', WLB: 'LB', MLB: 'LB', SLB: 'LB', LILB: 'LB', RILB: 'LB', LCB: 'CB', RCB: 'CB', SS: 'S', FS: 'S', NB: 'Nickel CB'};
const asofText = () => {
  const [y, m, d] = String(dr.DOC.asof).split('-').map(Number);
  return y ? new Date(y, m - 1, d).toLocaleDateString('en-US', {month: 'long', day: 'numeric'}) : '';
};
function openRatings(st) {
  const s = st.s;
  if (!s) return;
  const O = dr.team(s.sc.o), D = dr.team(s.sc.d);
  const off = O.o.map(r => s.U.o.by[r[0]]);
  const def = D.d.map(r => s.U.d.by[r[0]]);
  const edge = D.s === '34' ? {WLB: 'OLB', SLB: 'OLB'} : {};
  const body = `<div class="dr-sheet dr-rts">`
    + `<p class="dr-rt-intro">${esc(`Each starter’s rank at his spot across the league, from his 2025 season and 2026 so far (55 to 99). Depth charts as of ${asofText()}.`)}</p>`
    + `<h3 class="dr-rt-h">${esc(`Your offense · ${O.city} ${O.n}`)}</h3><ol class="dr-rt-l">${off.map(p => ratingRowHTML(p, dr.posOf(p.slot) === p.slot ? p.slot : dr.posOf(p.slot))).join('')}${ratingRowHTML(s.U.o.k, 'K')}</ol>`
    + `<h3 class="dr-rt-h">${esc(`Their defense · ${D.city} ${D.n}`)}</h3><ol class="dr-rt-l">${def.map(p => ratingRowHTML(p, edge[p.slot] || DEF_POS[p.slot] || p.slot)).join('')}</ol>`
    + `</div>`;
  ui.haptic('light');
  ui.openSheet({title: 'Player ratings', body, detents: ['large'], cls: 'sh-drill'});
}
function openHelp() {
  const body = `<div class="dr-help">`
    + `<p><b>You’re down late, and you have the ball.</b> Every day brings one drive, the same for everyone, from a real game on this week’s NFL slate with each team’s current starters. Score enough before the clock hits 0:00. Every snap counts as soon as you call it: there are no do-overs.</p>`
    + `<p><b>Read the defense.</b> Before each snap the defense shows a look, and at the snap it plays a real call that look usually hides. A <b>light box</b> is mostly two- and four-deep zones: deep shots and outs get eaten, the middle opens up. A <b>loaded box</b> is a run blitz or man to man: don’t run into it, and play action fools it. A <b>blitz look</b> means pressure: get it out quick. A <b>two-high shell</b> takes away the deep ball and the sideline. <b>Prevent</b> gives up the short stuff and keeps the clock running. The line on the field leans to one side: run away from it.</p>`
    + `<p><b>Passing.</b> Each receiver runs a route, drawn on the field; tap one there to change it. The numbers next to each name are what a throw to him tends to do against this look: how often it’s caught, the yards a throw, and how often it’s picked. Play action fools an aggressive defense and costs time against a patient one; a roll out beats the rush but cuts off the middle; out of bounds stops the clock and gives up the yards after the catch.</p>`
    + `<p><b>The players matter.</b> Every dot is a real starter, coloured by his rating. Man coverage is one-on-one, so a great receiver against a weak corner wins; your line against their rush decides the sacks. Tap Player ratings to scout.</p>`
    + `<p><b>The clock.</b> A run, a sack or a catch in bounds keeps it running, and the next snap takes ${E.HURRY} seconds to get off. Incompletions, going out of bounds, timeouts and spikes stop it. Down three or less, a field goal is there when you’re in range; down seven, a touchdown brings the choice: kick to tie, or go for two to win.</p>`
    + `<p><b>After each snap</b> the breakdown shows what the defense was really in, how your win chance moved, and how every option would have done, each played out many times from the same spot.</p>`
    + `<p><b>Survivor.</b> Drive after drive with random teams, each spot a little tougher. Win or tie to keep going; your best run goes on the scoreboard.</p>`
    + `</div>`;
  ui.openSheet({title: 'How it works', body, detents: ['large'], cls: 'sh-drill'});
}

// ============================================================================ Markup: states
function loadingHTML() {
  return `<div class="dr-loading" aria-busy="true">${ui.skeleton('rows', 4, {label: 'Loading the Two-Minute Drill.'})}</div>`;
}
function errorHTML() {
  return ui.empty({icon: 'football', title: 'The Two-Minute Drill needs a connection the first time.', action: {label: 'Try again', attrs: {'data-dr-retry': ''}}});
}

// ============================================================================ Win chances
// Worked out in small slices off the main beat (setTimeout 0 between them), so the snap's animation never stutters:
// the chance now (for the next breakdown's "before"), and after a snap the chance after it and every option's score.
const WP_N = 90, OPT_N = 40;
const stateKey = s => `${s.sc.s}|${E.actsOf(s)}`;
function slice(st, fn) {
  return new Promise(res => { st.timers.push(setTimeout(() => { if (st.dead) { res(null); return; } res(fn()); }, 0)); });
}
async function wpNow(st, s) {
  const k = stateKey(s);
  if (st.wp.has(k)) return st.wp.get(k);
  const v = await slice(st, () => E.winChance(s, WP_N));
  if (v != null) st.wp.set(k, v);
  return v;
}
/** After a snap: the chance before (cached, or worked out from the spot before), after, and every option's score. */
async function scoreLast(st, sBefore, p) {
  const L = st.last;
  const before = await wpNow(st, sBefore);
  if (st.last !== L || st.dead) return;
  L.wpB = before;
  const after = st.s.result ? (st.s.result === 'W' ? 1 : st.s.result === 'T' ? 0.5 : 0) : await wpNow(st, st.s);
  if (st.last !== L || st.dead) return;
  L.wpA = after;
  patchBreakdown(st);
  if (['timeout', 'expired'].includes(p.kind)) return;
  L.scoring = true;
  patchBreakdown(st);
  const list = E.defaultOptions(sBefore, p.routes || sBefore.routes);
  if (!list.includes(p.act)) list.push(p.act);
  const scores = [];
  for (const t of list) {
    const r = await slice(st, () => E.scoreOptions(sBefore, [t], OPT_N));
    if (st.last !== L || st.dead) return;
    if (r && r[0]) scores.push(r[0]);
  }
  scores.sort((a, b) => b.wp - a.wp);
  L.scores = scores;
  L.n = OPT_N;
  L.scoring = false;
  patchBreakdown(st);
}
function patchBreakdown(st) {
  if (st.busy || st.dead) return;
  const bd = st.el.querySelector('[data-dr-bd]');
  if (!bd || !st.last) return;
  const open = !!bd.querySelector('details[open]');
  const tmp = document.createElement('template');
  tmp.innerHTML = breakdownHTML(st);
  const next = tmp.content.firstElementChild;
  if (open) { const d = next.querySelector('details'); if (d) d.open = true; }
  bd.replaceWith(next);
  ui.hydrate(st.el.querySelector('[data-dr-panel]'));
}

// ============================================================================ Playing a snap
function persist(st) {
  if (st.mode === 'surv') dr.saveSurvivor(st.s); else dr.record(st.n, st.s);
}
const replayState = (st, acts) => E.replay(st.s.sc, dr.DOC.teams, acts);
async function go(st, token) {
  const s = st.s;
  if (st.busy || !s || s.result) return;
  const actsBefore = E.actsOf(s);
  const sBefore = replayState(st, actsBefore);
  const runningBefore = s.running, c0 = s.clock;
  const p = E.act(s, token);
  if (!p) return;
  persist(st);
  if (s.result) dr.autoPost(); // the day's drive, or a new Survivor best
  ui.haptic(p.kind === 'timeout' ? 'light' : 'medium');
  st.panel = 'main';
  st.pick = null;
  st.last = {p, wpB: null, wpA: null, scores: null, canReplay: !['timeout', 'expired', 'xp'].includes(p.kind), before: actsBefore};
  scoreLast(st, sBefore, p);
  if (p.kind === 'timeout') { finishPlay(st, p); return; }
  st.busy = true;
  setPanel(st);
  patchRoutes(st);
  if (runningBefore && p.clock !== c0) await runOff(st, c0, p.clock);
  if (st.dead) return;
  await runAnim(st, choreo(s, p), p);
  if (st.dead) return;
  finishPlay(st, p);
}
function setPanel(st) {
  const panel = st.el.querySelector('[data-dr-panel]');
  if (!panel) return;
  panel.innerHTML = panelHTML(st);
  ui.hydrate(panel);
}
function finishPlay(st, p) {
  st.busy = false;
  if (st.dead) return;
  const s = st.s;
  st.routes = Object.assign({}, s.routes || {});
  patchField(st);
  const bug = st.el.querySelector('[data-dr-bug]');
  if (bug) bug.outerHTML = bugHTML(s);
  const sit = st.el.querySelector('[data-dr-sit]');
  if (sit) sit.outerHTML = sitHTML(s);
  setPanel(st);
  const ph = st.el.querySelector('[data-dr-pbph]');
  if (ph) { ph.innerHTML = pbpHTML(st); ui.hydrate(ph); }
  const t = dr.playText(s, p);
  if (s.result) {
    const res = st.el.querySelector('.dr-result');
    if (s.result === 'W' && res && !ui.RM) {
      ui.haptic('celebrate');
      ui.stamp(res.querySelector('.dr-res-h'), {from: 1.4});
      ui.confetti(res.getBoundingClientRect(), {colors: ['#FFC531', '#7CF058', '#FFFFFF'], count: 90});
    } else if (s.result === 'L') ui.haptic('error');
    if (st.mode !== 'surv') scheduleBoard(st);
    else patchHead(st);
    ui.announce(`${t.line} ${dr.resultText(s).head}, ${s.us} to ${s.them}.`);
  } else {
    ui.announce(`${t.line} ${dr.downText(s.down, s.togo, s.ball)} on the ${dr.spot(s)}, ${dr.clockText(s.clock)} left.`);
    wpNow(st, s); // ready for the next breakdown
  }
}
function patchHead(st) {
  const h = st.el.querySelector('.dr-head');
  if (h && st.s) { h.outerHTML = headHTML(st); ui.hydrate(st.el); }
}
/** Replays the last snap on the field, then puts it back where the drive is now. */
async function replayLast(st) {
  const L = st.last;
  if (!L || st.busy || !L.canReplay) return;
  const p = L.p;
  const f = st.el.querySelector('[data-dr-field]');
  if (!f) return;
  st.busy = true;
  f.classList.add('is-anim');
  // Back to the snap's spot, at once.
  spots(st.s, {ball: p.ball, look: p.look, shade: p.shade}).forEach(d => {
    const e = f.querySelector(`[data-dr-p="${d.key}"]`);
    if (e) { e.style.left = left(d.x); e.style.top = top(d.y); e.classList.toggle('is-off', !!d.off); }
  });
  f.querySelector('.dr-track').style.transform = trackY(winTop(p.ball));
  f.querySelector('[data-dr-los]').style.top = top(p.ball);
  const clock = st.el.querySelector('[data-dr-clock]');
  if (clock) clock.textContent = dr.clockText(p.clock);
  setPanel(st);
  patchRoutes(st);
  void f.offsetWidth;
  await runAnim(st, choreo(st.s, p), p);
  if (st.dead) return;
  finishPlay(st, p);
}

// ============================================================================ Modes and days
function setDaily(st) {
  st.n = dr.todayNumber();
  st.s = dr.drive(st.n);
  resetSnap(st);
}
function setSurvivor(st) {
  const v = dr.survivor();
  st.s = v.run ? dr.survivorDrive(v.run) : null;
  resetSnap(st);
}
function resetSnap(st) {
  st.panel = 'main';
  st.last = null;
  st.pick = null;
  st.flags = {};
  st.runOob = false;
  st.routes = st.s && st.s.routes ? Object.assign({}, st.s.routes) : {};
  if (st.s && !st.s.result && st.el && st.wp) st.timers.push(setTimeout(() => wpNow(st, st.s), 400));
}
function rerender(st, {fade = true} = {}) {
  const go2 = () => { st.el.innerHTML = bodyHTML(st); ui.hydrate(st.el); };
  if (fade && !ui.RM && st.ctx.visible) ui.crossfade(st.el, go2, {duration: 160}); else go2();
}
function setMode(st, m) {
  if (!MODES.some(x => x.id === m) || m === st.mode || st.busy) return;
  st.mode = m;
  if (m === 'surv') setSurvivor(st); else setDaily(st);
  rerender(st);
}
function share(st) {
  const s = st.s;
  if (!s || !s.result || st.mode === 'surv') return;
  ui.share({text: dr.shareText(st.n, s)}).then(r => {
    if (r === 'copied') { ui.toast(COPIED, {icon: 'check-circle'}); ui.haptic('success'); }
    else if (r === 'unavailable') ui.toast("Couldn't copy your drive.");
  });
}
function openMenu(st, k) {
  if (st.busy) return;
  st.panel = k;
  ui.haptic('selection');
  setPanel(st);
  patchRoutes(st);
  const f = st.el.querySelector('[data-dr-field]');
  if (f) { f.classList.toggle('is-routes', k === 'pass'); f.setAttribute('role', k === 'pass' ? 'group' : 'img'); f.setAttribute('aria-label', fieldLabel(st)); }
  const first = st.el.querySelector(k === 'main' ? '[data-dr-panel] .dr-calls button' : '[data-dr-panel] [data-dr-back]');
  if (first) { try { first.focus({preventScroll: true}); } catch (_) {} }
}
function cycleRoute(st, slot) {
  const list = E.ROUTES_FOR[slot];
  const i = list.indexOf(st.routes[slot]);
  st.routes[slot] = list[(i + 1) % list.length];
  st.pick = slot;
  ui.haptic('selection');
  patchRoutes(st);
  const rows = st.el.querySelector('[data-dr-rcvs]');
  if (rows) { rows.innerHTML = E.TARGETS.map(k => receiverRowHTML(st, k)).join(''); ui.hydrate(rows); }
  ui.announce(`${st.s.U.o.by[slot].n}: ${E.ROUTES[st.routes[slot]].name}.`);
}

function onClick(st, e) {
  if (st.busy && st.anim && e.target.closest('[data-dr-field]')) return; // the field's own skip handler
  const rcv = st.panel === 'pass' && !st.busy && e.target.closest('[data-dr-rcv]');
  if (rcv && st.el.contains(rcv)) { cycleRoute(st, rcv.dataset.drRcv); return; }
  const t = e.target.closest('[data-dr-go], [data-dr-menu], [data-dr-back], [data-dr-flag], [data-dr-route], [data-dr-replay], [data-dr-ratings], [data-dr-help], [data-dr-share], [data-dr-retry], [data-dr-who], [data-dr-newrun], [data-dr-nextdrive]');
  if (!t || !st.el.contains(t) || t.disabled) return;
  if (t.hasAttribute('data-dr-go')) { go(st, t.dataset.drGo); return; }
  if (t.hasAttribute('data-dr-menu')) { openMenu(st, t.dataset.drMenu); return; }
  if (t.hasAttribute('data-dr-back')) { openMenu(st, 'main'); return; }
  if (t.hasAttribute('data-dr-flag')) {
    const k = t.dataset.drFlag;
    st.flags = Object.assign({}, st.flags, {[k]: !st.flags[k]});
    t.setAttribute('aria-pressed', String(!!st.flags[k]));
    ui.haptic('selection');
    const rows = st.el.querySelector('[data-dr-rcvs]');
    if (rows) { rows.innerHTML = E.TARGETS.map(x => receiverRowHTML(st, x)).join(''); ui.hydrate(rows); }
    return;
  }
  if (t.hasAttribute('data-dr-route')) { cycleRoute(st, t.dataset.drRoute); return; }
  if (t.hasAttribute('data-dr-replay')) { replayLast(st); return; }
  if (t.hasAttribute('data-dr-ratings')) { openRatings(st); return; }
  if (t.hasAttribute('data-dr-help')) { openHelp(); return; }
  if (t.hasAttribute('data-dr-share')) { share(st); return; }
  if (t.hasAttribute('data-dr-who')) { openDrive(st, t.dataset.drWho); return; }
  if (t.hasAttribute('data-dr-newrun')) { dr.newRun(); setSurvivor(st); ui.haptic('medium'); rerender(st); toTop(st); return; }
  if (t.hasAttribute('data-dr-nextdrive')) { dr.nextDrive(); setSurvivor(st); ui.haptic('medium'); rerender(st); toTop(st); return; }
  if (t.hasAttribute('data-dr-retry')) load(st);
}
function onKey(st, e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-dr-rcv][role="button"]')) {
    e.preventDefault();
    cycleRoute(st, e.target.dataset.drRcv);
  }
}
/** Scrolls up so the game picker (opts.anchor, else the pane) sits just under the bar, if it is above the view. */
function toTop(st) {
  const scr = st.ctx.screen, a = st.anchor || st.el;
  if (!scr || !a.isConnected) return;
  const nav = scr.querySelector(':scope > .nav');
  const navH = nav ? nav.offsetHeight : 44;
  const y = a.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - navH - 8;
  if (scr.scrollTop > y) scr.scrollTop = Math.max(0, y);
}
function load(st) {
  st.el.innerHTML = loadingHTML();
  dr.load().then(() => {
    if (st.dead) return;
    if (st.mode === 'surv') setSurvivor(st); else setDaily(st);
    rerender(st, {fade: false});
    dr.autoPost();
  }, () => {
    if (st.dead) return;
    st.el.innerHTML = errorHTML();
    ui.hydrate(st.el);
  });
}
/** Each tick: the countdown, and after midnight the new drive (not mid-snap). */
function tick(st) {
  if (st.dead || !dr.DOC || st.busy) return;
  if (st.mode === 'daily' && dr.todayNumber() !== st.n) { setDaily(st); rerender(st); return; }
  const v = st.el.querySelector('[data-dr-next]');
  if (v) { const t = nextIn(); if (v.textContent !== t) v.textContent = t; }
}

// ============================================================================ Pane
export function render(ctx) {
  const st = ST.get(ctx);
  if (st) return bodyHTML(st);
  if (!dr.DOC) return loadingHTML();
  const tmp = {mode: 'daily', sbMode: 'today', panel: 'main', flags: {}, routes: {}, timers: []};
  setDaily(tmp);
  return bodyHTML(tmp);
}

export function mount(el, ctx, {anchor} = {}) {
  ensureCss();
  const st = {el, ctx, anchor: anchor || null, mode: 'daily', sbMode: 'today', n: 0, s: null, panel: 'main', flags: {}, runOob: false, routes: {}, pick: null,
    last: null, busy: false, dead: false, timers: [], cancelBoard: null, anim: null, wp: new Map(), pbpOpen: false};
  ST.set(ctx, st);
  st.onClick = e => onClick(st, e);
  st.onKey = e => onKey(st, e);
  st.onToggle = e => { if (e.target.matches && e.target.matches('[data-dr-pbp]')) st.pbpOpen = e.target.open; };
  st.onChange = e => {
    if (!e.detail) return;
    if (e.detail.name === 'dr-sb') {
      e.stopPropagation();
      if (e.detail.value !== st.sbMode && SB_MODES.some(x => x.id === e.detail.value)) { st.sbMode = e.detail.value; patchBoard(st, {fade: true}); }
    } else if (e.detail.name === 'dr-mode') {
      e.stopPropagation();
      setMode(st, e.detail.value);
    } else if (e.detail.name === 'dr-oob') {
      e.stopPropagation();
      st.runOob = !!e.detail.value;
      const panel = st.el.querySelector('[data-dr-panel]');
      const k = st.panel === 'rpo' ? E.tok.rpo : E.tok.run;
      if (panel) panel.querySelectorAll('.dr-dirs [data-dr-go]').forEach((b, i) => { b.dataset.drGo = k(i ? 's' : 'w', st.runOob); });
    }
  };
  el.addEventListener('click', st.onClick);
  el.addEventListener('keydown', st.onKey);
  el.addEventListener('toggle', st.onToggle, true);
  el.addEventListener('ui:change', st.onChange);
  st.stopTick = ctx.timer(() => tick(st), 20000);
  st.unsub = daily.subscribe(type => { if (type === 'lb' || type === 'ready' || type === 'error') scheduleBoard(st); });
  if (!dr.DOC) { load(st); return; }
  setDaily(st);
  rerender(st, {fade: false});
  dr.autoPost();
}

/** Shown again (the picker, a link): catch up with the day. */
export function params(el, ctx) {
  const st = ST.get(ctx);
  if (st) tick(st);
}

export function unmount(el, ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  st.dead = true;
  st.timers.forEach(clearTimeout);
  el.removeEventListener('click', st.onClick);
  el.removeEventListener('keydown', st.onKey);
  el.removeEventListener('toggle', st.onToggle, true);
  el.removeEventListener('ui:change', st.onChange);
  if (st.stopTick) st.stopTick();
  if (st.unsub) st.unsub();
  if (st.cancelBoard) st.cancelBoard();
  ST.delete(ctx);
}
