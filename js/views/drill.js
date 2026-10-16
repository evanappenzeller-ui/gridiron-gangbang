// Two-Minute Drill, the third game of the Daily Games tab (puzzles.js: its picker shows this pane for /puzzles/drill;
// imported on first use). After nfl2mindrill.com: you're down late with the ball, real NFL starters on both sides, and
// the game runs to 0:00 (core/drill-sim.js is the engine, core/drill.js the days, memory, words and scoreboard).
//
// A pane module, like 17-0's: render(ctx), mount(el, ctx, {anchor}), params(el, ctx), unmount(el, ctx).
// One game a day, the same for everyone; each call is saved as it's made, so there are no do-overs.
// The screen: the scorebug (both teams, their scores and timeouts, the clock, who has the ball), the situation, the
// field (top-down, the team with the ball going up, every player a dot coloured by his rating, yours ringed in white,
// the line of scrimmage blue and the first-down line yellow), then the call.
// On offense: the defense's look, then Run · Pass · RPO · Trick, a field goal when it's on, and the clock tools (and the
// kneel when you lead). Pass opens the receivers: each on his route (drawn on the field; tap a receiver there, or his
// route below, to change it) with the look's odds for a throw to him, and play action, roll out and out of bounds to
// toggle; tap a name to throw it. Run and RPO pick a side (strong is the tight end's) and whether to head for the
// sideline. After a touchdown that leaves you down one or two: kick, or go for two.
// On defense (you scored with time left, or turned it over): their formation, and your call from eight in four types.
// Each snap plays out from behind the offense like a console football game (views/drill-cam.js: the camera swings down
// from the dots into the stadium, every player a shaded figure in his uniform, the scoreboard across the top, then
// swings back up; the clock runs; tap the field to skip), then the breakdown:
// what happened, the win chance before and after, what the defense was really in, how your call ranked and how every
// option scored (each played out many times: drill-sim.js scoreOptions), and Replay. At 0:00: the final, Share, and
// the league's finals for the day (tap one to read it once you've played yours). Every control here is data-dr-*, so
// the Daily Puzzles handlers on the same screen never see these taps.
// Owner: Drill.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as dr from '../core/drill.js';
import * as daily from '../core/daily.js';
import * as camLib from './drill-cam.js';
import {msToMidnight} from './board.js';

const E = dr.E;
const esc = data.esc;
const COPIED = 'Copied. Paste it in the league chat.';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const nextIn = () => ui.untilText(msToMidnight());
const pct = x => `${Math.round(x * 100)}%`;
const ST = new WeakMap(); // ctx -> pane state

// A home-screen app open across an update imports this module new under the stylesheet it started with: when
// drill.css's mark (--dr-css on :root) isn't this module's, the current file is added (as in views/seventeen.js).
const CSS_V = '22';
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

// ============================================================================ Teams
const tcol = id => (dr.team(id) ? dr.team(id).c : ['#25366A', '#8A94B8']);
const logoUrl = (id, w) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${String(id).toLowerCase()}.png&w=${w}&h=${w}`;
/** A team's logo on a soft disc of its colour (the disc alone if the logo can't load). */
function logoHTML(id, size = 32) {
  return `<span class="dr-logo" style="--tc:${esc(tcol(id)[0])};--sz:${size}px" aria-hidden="true"><i style="background-image:url(${esc(logoUrl(id, size > 40 ? 160 : 96))})"></i></span>`;
}

// ============================================================================ The field
// Field coordinates in yards: x across (0-53.3, the middle 26.67), y from the goal line of the team with the ball (0)
// to the one it's going for (100), the end zones out to -10 and 110. The team with the ball always goes up. The track is
// the whole field; it slides so the line of scrimmage sits BEHIND yards from the bottom of the window (which shows WIN
// yards; CSS: .dr-field height = WIN x --yd).
const WIDTH = 53.33, MID = 26.67, WIN = 36, BEHIND = 11;
// Spread out past real spacing so every dot (24px, about 4 yards across and 2.7 deep) and name has room. The tight
// end is on the right: that's the strong side.
const OFF_POS = {
  QB: [MID, -5.6], RB: [MID + 4.4, -5.8], WR1: [3.6, -1.2], WR2: [49.6, -1.2], WR3: [11.5, -2.8], TE: [MID + 12, -1.8],
  LT: [MID - 8, -1.4], LG: [MID - 4, -1.3], C: [MID, -1.2], RG: [MID + 4, -1.3], RT: [MID + 8, -1.4]
};
/** Their formations when you're on defense (FORMS): the backfield and the slot move. */
function offPos(form) {
  const P = Object.assign({}, OFF_POS);
  if (form === 'pistol') { P.QB = [MID, -4.4]; P.RB = [MID, -7.6]; }
  else if (form === 'empty') P.RB = [MID + 15.5, -3.2];
  else if (form === 'heavy') { P.QB = [MID, -3.6]; P.RB = [MID, -7.6]; P.WR3 = [MID - 12, -1.8]; }
  return P;
}
/** Where a name sits beside its dot instead of under it (players level with each other). */
const labSide = (slot, form, flip = false) => {
  const l = (form === 'pistol' || form === 'heavy' ? {QB: 'l', RB: 'r'} : form === 'empty' ? {} : {RB: 'r'})[slot];
  return flip && slot === 'RB' && form !== 'pistol' && form !== 'heavy' && l ? 'l' : l;
};
const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
const LABELLED = new Set(['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'LCB', 'RCB', 'SS', 'FS']);
const dirSign = d => (d === 's' ? 1 : -1); // strong side is to the right
/** A run or an RPO to the weak side flips the backfield: the back lines up on the weak side of the QB, and the play is
 *  the mirror image of the strong side's. Where he lines up with it (an offset back; one behind the QB or split out
 *  stays put). */
const flipX = x => (Math.abs(x - MID) < 6 ? 2 * MID - x : x);
/** The formation with the back flipped. */
const flipPos = P => Object.assign({}, P, {RB: [flipX(P.RB[0]), P.RB[1]]});
/** Your defense lines up in the look its call usually shows; before you call one, a two-high shell. */
const CALL_LOOK = E.CALL_LOOK;
const PRE_LOOK = 'two';
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
/** Where the track sits for a line of scrimmage: the window's top yard (never past the back of the end zone). */
const winTop = los => Math.min(110, los - BEHIND + WIN);
const trackY = wt => `translateY(calc(var(--yd) * ${-(110 - wt).toFixed(2)}))`;
/** A rating's colour: red (55) through orange and yellow to green (99). */
function ratingColor(r) {
  const t = Math.max(0, Math.min(1, ((Number(r) || 55) - 55) / 44));
  return `hsl(${Math.round(4 + 124 * t)} 72% ${Math.round(56 - 8 * t)}%)`;
}
const clampX = x => Math.max(1.4, Math.min(WIDTH - 1.4, x));

/** What the field shows: {poss, ball, look, shade, form, fd (the first-down line, or null)}. Now, or at a snap. */
const fdLine = s => (s.phase === 'play' && !s.result && s.ball + s.togo < 100 ? s.ball + s.togo : null);
const viewNow = (s, flip = false) => ({poss: s.poss, ball: s.ball, look: s.poss === 'us' ? s.look || PRE_LOOK : PRE_LOOK, shade: s.shade, form: s.poss === 'them' ? s.form : null, fd: fdLine(s), flip});
const viewOf = p => ({poss: p.poss, ball: p.ball, look: p.poss === 'us' ? p.look || PRE_LOOK : CALL_LOOK[p.dcall] || PRE_LOOK, shade: p.shade, form: p.poss === 'them' ? p.form : null,
  fd: p.two || p.ball + p.togo >= 100 ? null : p.ball + p.togo, flip: p.dir === 'w' && !p.trick});
/** The field before your call: a run or an RPO to the weak side open, your back already lined up for it. */
const flipNow = st => !!st.s && st.s.poss === 'us' && !st.s.result && (st.panel === 'run' || st.panel === 'rpo') && st.side === 'w';

function linesHTML(s, poss) {
  let h = '';
  for (let y = 0; y <= 100; y += 5) h += `<i class="dr-yl${y % 10 ? '' : ' is-ten'}${y === 0 || y === 100 ? ' is-goal' : ''}" style="top:${top(y)}"></i>`;
  for (let y = 10; y <= 90; y += 10) {
    const n = y <= 50 ? y : 100 - y;
    h += `<b class="dr-num is-l" style="top:${top(y)}">${n}</b><b class="dr-num is-r" style="top:${top(y)}">${n}</b>`;
  }
  const ids = E.idsFor(s, poss);
  h += `<span class="dr-ez is-top" style="top:${top(110)};--tc:${esc(tcol(ids.d)[0])}"><b>${esc(dr.team(ids.d).n)}</b></span>`;
  h += `<span class="dr-ez is-bot" style="top:${top(0)};--tc:${esc(tcol(ids.o)[0])}"><b>${esc(dr.team(ids.o).n)}</b></span>`;
  return h;
}
/** Names on the outside players hang inward, so they never run off the field. */
const edgeCls = x => (x < 8 ? ' is-edge-l' : x > WIDTH - 8 ? ' is-edge-r' : '');
function dotHTML(d, view) {
  const {side, p, x, y, off, slot} = d;
  const lab = LABELLED.has(slot) ? `<em class="dr-pl-n">${esc(dr.short(p.n))}</em>` : '';
  const ls = side === 'o' ? labSide(slot, view.form, view.flip) : null;
  const mine = (side === 'o') === (view.poss === 'us');
  const tgt = side === 'o' && view.poss === 'us' && E.TARGETS.includes(slot) ? ` data-dr-rcv="${slot}"` : '';
  return `<span class="dr-pl is-${side}${mine ? ' is-mine' : ''}${ls ? ' is-lab-' + ls : ''}${edgeCls(x)}${off ? ' is-off' : ''}" data-dr-p="${side}-${slot}"${tgt} style="left:${left(x)};top:${top(y)};--rc:${ratingColor(p.r)}">`
    + `<b class="dr-pl-j">${p.j == null ? '' : p.j}</b>${lab}</span>`;
}
/** Every player's spot before a snap: [{key, side, slot, p, x, y, off}]. */
function spots(s, view) {
  const los = view.ball, out = [];
  const U = E.unitsFor(s, view.poss), P0 = view.flip ? flipPos(offPos(view.form)) : offPos(view.form);
  Object.keys(P0).forEach(slot => {
    const [x, dy] = P0[slot];
    out.push({key: 'o-' + slot, side: 'o', slot, p: U.o.by[slot], x, y: los + dy});
  });
  const P = defPos(U.d.T, view.look || PRE_LOOK, view.shade);
  // Near the goal line the deep players squeeze in (never past the back of the end zone).
  const k = Math.max(0.35, Math.min(1, (108 - los) / 21));
  U.d.T.d.forEach(([slot]) => {
    const at = P[slot] || [slot === 'NB' ? 11.5 : MID + 7, 8];
    const dy = at[1] > 2.5 ? 2.5 + (at[1] - 2.5) * k : at[1];
    out.push({key: 'd-' + slot, side: 'd', slot, p: U.d.by[slot], x: at[0], y: los + dy, off: !P[slot]});
  });
  return out;
}

// ---------------------------------------------------------------------------- Routes
/** A receiver's route from where he lines up: points in field yards, the stem first. */
function routePath(route, x0, y0) {
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
  const paths = E.TARGETS.map(slot => {
    const [x0, dy] = OFF_POS[slot];
    return [slot, routePath(routes[slot], x0, s.ball + dy)];
  });
  const lines = paths.map(([slot, pts]) => `<polyline class="dr-route${pick === slot ? ' is-on' : ''}" points="${pts.map(([x, y]) => `${x.toFixed(2)},${(110 - y).toFixed(2)}`).join(' ')}"/>`).join('');
  const ends = paths.map(([slot, pts]) => {
    const [x, y] = pts[pts.length - 1];
    return `<span class="dr-route-end${pick === slot ? ' is-on' : ''}" style="left:${left(x)};top:${top(y)}"></span>`;
  }).join('');
  return `<svg class="dr-routes" viewBox="0 0 ${WIDTH} 120" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${ends}`;
}
const routesOn = st => st.panel === 'pass' && !st.busy && !!st.s && !st.s.result && st.s.poss === 'us';

function fieldHTML(st, view = viewNow(st.s, flipNow(st))) {
  const s = st.s, los = view.ball;
  const routes = routesOn(st) && view.poss === 'us';
  return `<div class="dr-field${routes ? ' is-routes' : ''}${view.poss === 'them' ? ' is-def' : ''}" data-poss="${view.poss}" role="${routes ? 'group' : 'img'}" aria-label="${esc(fieldLabel(st))}" data-dr-field>`
    + bugHTML(s)
    + `<div class="dr-track" style="transform:${trackY(winTop(los))}">`
    + linesHTML(s, view.poss)
    + `<i class="dr-los" data-dr-los style="top:${top(los)}"></i>`
    + `<i class="dr-fd" data-dr-fd style="top:${top(view.fd == null ? los : view.fd)}"${view.fd == null ? ' hidden' : ''}></i>`
    + `<div class="dr-rlayer" data-dr-routes>${routes ? routesSVG(s, st.routes, st.pick) : ''}</div>`
    + spots(s, view).map(d => dotHTML(d, view)).join('')
    + `<span class="dr-ball" data-dr-ball style="left:${left(MID)};top:${top(los)}"></span>`
    + `<div class="dr-callouts" data-dr-callouts></div>`
    + `</div></div>`;
}
function fieldLabel(st) {
  const s = st.s;
  if (s.result) return `Final: ${s.sc.o} ${s.us}, ${s.sc.d} ${s.them}.`;
  if (s.poss === 'them') {
    const F = E.FORMS[s.form];
    return `${E.idsFor(s, 'them').o} ball on the ${dr.spot(s)}.${F ? ` Their offense: ${F.name.toLowerCase()}, ${F.sub.toLowerCase()}.` : ''}`;
  }
  const look = s.look && E.LOOKS[s.look];
  const base = `Ball on the ${dr.spot(s)}.${look ? ` ${s.sc.d} defense: ${look.name.toLowerCase()}, ${look.sub.toLowerCase()}, leaning to the ${s.shade === 's' ? 'strong' : 'weak'} side.` : ''}`;
  return routesOn(st) ? base + ' Tap a receiver to change his route.' : base;
}
/** Swaps in a new field (a change of possession, or a replay of a snap from before it). */
function swapField(st, view, {fade = true} = {}) {
  const f = st.el.querySelector('[data-dr-field]');
  if (!f) return null;
  const tmp = document.createElement('template');
  tmp.innerHTML = fieldHTML(st, view);
  const nf = tmp.content.firstElementChild;
  if (fade && !ui.RM) nf.classList.add('is-in');
  f.replaceWith(nf);
  camLib.sbarLogos(nf);
  return nf;
}
/** Moves the field to the game's current snap: the camera, the lines, the players (CSS transitions animate it). */
function patchField(st) {
  let f = st.el.querySelector('[data-dr-field]');
  if (!f) return;
  const s = st.s, view = viewNow(s, flipNow(st));
  if (f.dataset.poss !== view.poss) { swapField(st, view); patchRoutes(st); return; }
  f.classList.toggle('is-routes', routesOn(st));
  f.setAttribute('role', routesOn(st) ? 'group' : 'img');
  f.setAttribute('aria-label', fieldLabel(st));
  moveTo(st, f, view);
  const fdEl = f.querySelector('[data-dr-fd]');
  fdEl.hidden = view.fd == null;
  if (view.fd != null) fdEl.style.top = top(view.fd);
  const ball = f.querySelector('[data-dr-ball]');
  ball.style.left = left(MID);
  ball.style.top = top(view.ball);
  ball.classList.remove('is-air');
  const cl = f.querySelector('[data-dr-callouts]');
  if (cl) cl.innerHTML = '';
  patchRoutes(st);
}
/** The players to their spots for a view, and the camera and the line of scrimmage with them. */
function moveTo(st, f, view) {
  spots(st.s, view).forEach(d => {
    const e = f.querySelector(`[data-dr-p="${d.key}"]`);
    if (!e) return;
    e.style.left = left(d.x);
    e.style.top = top(d.y);
    e.classList.toggle('is-off', !!d.off);
    e.classList.toggle('is-edge-l', d.x < 8);
    e.classList.toggle('is-edge-r', d.x > WIDTH - 8);
    if (d.side === 'o') { const ls = labSide(d.slot, view.form, view.flip); e.classList.toggle('is-lab-l', ls === 'l'); e.classList.toggle('is-lab-r', ls === 'r'); }
  });
  f.querySelector('.dr-track').style.transform = trackY(winTop(view.ball));
  f.querySelector('[data-dr-los]').style.top = top(view.ball);
}
function patchRoutes(st) {
  const host = st.el.querySelector('[data-dr-routes]');
  if (!host) return;
  const on = routesOn(st);
  host.innerHTML = on ? routesSVG(st.s, st.routes, st.pick) : '';
  st.el.querySelectorAll('[data-dr-rcv]').forEach(e => {
    if (on) {
      e.setAttribute('role', 'button');
      e.setAttribute('tabindex', '0');
      e.setAttribute('aria-label', `${st.s.mine.by[e.dataset.drRcv].n}: ${E.ROUTES[st.routes[e.dataset.drRcv]].name}. Change his route.`);
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
  const view = viewOf(p);
  const L = p.ball, tr = {}, calls = [], start = {};
  spots(s, view).forEach(d => { start[d.key] = [d.x, d.y, d.off]; tr[d.key] = [[0, d.x, d.y]]; });
  const add = (key, ...kf) => { if (tr[key]) tr[key].push(...kf); };
  const ours = p.poss === 'us';
  // Callout colours are yours: good for you is green, whoever has the ball.
  const forO = good => (ours ? (good ? 'is-good' : 'is-bad') : (good ? 'is-bad' : 'is-good'));
  const a = (ours ? E.parse(p.act) : p.their) || {};
  const flags = a.flags || {};
  const D = E.unitsFor(s, p.poss).d, cover = D.cover;
  const kind = p.two ? p.res : p.kind;
  const end = Math.max(-8, Math.min(108, L + (p.gain || 0)));
  const ballTr = [[0, MID, L]];
  const isRun = kind === 'run' || (kind === 'fum' && !!p.who);
  // The play's moments, for the camera to pose: {key, a, t0, t1} (drill-cam.js POSES).
  const acts = [];
  const act = (key, a, t0, t1) => { if (tr[key] && t1 > t0) acts.push({key, a, t0: Math.max(0.01, t0), t1: Math.min(1, t1)}); };
  // The line: pass sets back, run drives forward; the front engages; they block.
  OL.forEach(k => { const [x, y] = start['o-' + k]; add('o-' + k, isRun ? [0.25, x + 0.8 * dirSign(p.dir || 's'), y + 1.4] : [0.2, x, y - 1.1]); act('o-' + k, 'bk', 0.05, isRun ? 0.62 : 0.8); });
  D.front.forEach(k => {
    const s0 = start['d-' + k];
    if (!s0 || s0[2]) return;
    add('d-' + k, [0.22, s0[0] * 0.85 + MID * 0.15, isRun ? L + 0.6 : L - 1.75]);
    act('d-' + k, 'bk', 0.08, 0.6);
  });
  /** The carrier lowers his shoulder as he's brought down; the tackler lunges into him and goes down with him. */
  const tackle = (carrier, tD, down) => {
    act(carrier, 'tk', tD - 0.07, tD);
    if (!p.by || !tr['d-' + p.by]) return;
    act('d-' + p.by, 'tl', tD - 0.06, tD + 0.02);
    down.push({key: 'd-' + p.by, t: Math.min(0.99, tD + 0.03), tackler: true});
  };
  const qb0 = start['o-QB'];
  if (kind === 'spike' || kind === 'kneel') {
    add('o-QB', [0.35, MID, L - 1.5]);
    ballTr.push([0.15, MID, qb0[1]], [0.5, MID, L - 1.5]);
    calls.push({t: 0.45, text: kind === 'spike' ? 'Spike' : 'Kneel', x: MID, y: L + 3});
    return {tr, ball: ballTr, calls, dur: 1000, acts};
  }
  if (kind === 'fg' || kind === 'fgx' || kind === 'xp') {
    const good = kind !== 'fgx';
    add('o-QB', [0.2, MID, L - 7]);
    ballTr.push([0.2, MID, L - 7], [0.85, good ? MID : MID + 6, 110]);
    calls.push({t: 0.86, text: good ? 'It’s good!' : 'No good', x: MID, y: 104, cls: good ? 'is-score' : 'is-bad'});
    return {tr, ball: ballTr, calls, dur: 2000, kick: true, acts};
  }
  if (isRun) {
    const rk = p.trick === 'r' ? 'r' : p.rk || 'z';
    const sg = rk === 'r' ? -1 : dirSign(p.dir || 's'); // the reverse always ends up weak
    const carrier = 'o-' + (p.who || 'RB');
    const holeX = rk === 't' ? MID + sg * 15 : rk === 'r' ? MID - 13 : MID + sg * 5;
    const fx = p.oob ? (sg > 0 ? WIDTH - 0.6 : 0.6) : clampX(holeX + sg * Math.min(12, Math.max(0, p.gain) * 0.35));
    if (rk === 't') {
      // The toss: the QB pitches it wide and the back runs for the edge.
      add('o-QB', [0.12, MID + sg, qb0[1] + 0.4], [0.45, MID - sg, qb0[1] - 0.5]);
      add('o-RB', [0.17, MID + sg * 8, L - 5.2], [0.42, holeX, L + 0.5], [0.9, fx, end]);
      ballTr.push([0.06, MID, qb0[1]], [0.17, MID + sg * 8, L - 5.2]);
      tr['o-RB'].slice(2).forEach(k => ballTr.push(k));
    } else if (rk === 'd') {
      // The draw: the QB drops back like it's a pass, then hands it off late.
      add('o-QB', [0.24, MID, L - 7.5], [0.34, MID - sg * 0.6, L - 7.4], [0.6, MID - sg * 2, L - 8]);
      add('o-RB', [0.22, MID + sg * 1.2, L - 6.6], [0.32, MID + sg * 0.8, L - 6.8], [0.55, MID + sg * 1.5, L + 0.6], [0.92, fx, end]);
      ballTr.push([0.1, MID, qb0[1]], [0.24, MID, L - 7.5], [0.32, MID + sg * 0.8, L - 6.8]);
      tr['o-RB'].slice(3).forEach(k => ballTr.push(k));
    } else if (rk === 'r') {
      // The double reverse: the back takes it one way and hands it to the receiver coming back the other.
      const [wx, wy] = start[carrier];
      add('o-RB', [0.16, MID + 5, L - 4.8], [0.32, MID + 9, L - 4.2], [0.55, MID + 11, L - 2.5]);
      tr[carrier] = [[0, wx, wy], [0.3, MID + 8.6, L - 4.6], [0.35, MID + 8, L - 4.8], [0.62, holeX, L - 1], [0.92, fx, end]];
      ballTr.push([0.08, MID, qb0[1]], [0.16, MID + 5, L - 4.8], [0.32, MID + 8.6, L - 4.6]);
      tr[carrier].slice(2).forEach(k => ballTr.push(k));
      calls.push({t: 0.36, text: 'Reverse!', x: MID + 8, y: L - 1.5});
    } else {
      add('o-QB', [0.14, MID + sg * 0.8, qb0[1] + 0.6], [0.45, MID - sg * 2.5, qb0[1] - 1]);
      add('o-RB', [0.14, MID + sg * 1.2, L - 4.8], [0.38, holeX, L + 0.8], [0.9, fx, end]);
      ballTr.push([0.08, MID, qb0[1]], [0.14, MID + sg * 1.2, L - 4.8]);
      tr['o-RB'].slice(2).forEach(k => ballTr.push(k));
    }
    if (p.broke) { calls.push({t: 0.6, text: 'Broken tackle!', key: carrier, cls: forO(true)}); act(carrier, 'tk', 0.56, 0.63); }
    if (kind === 'fum') calls.push({t: 0.86, text: 'Fumble!', x: fx, y: end + 3, cls: forO(false)});
    // Linebackers and safeties flow to the ball; the tackler meets it.
    D.lbs.concat(['SS', 'FS', 'NB', 'LCB', 'RCB']).forEach(k => {
      const s0 = start['d-' + k];
      if (!s0 || s0[2]) return;
      const near = k === p.by;
      add('d-' + k, [0.45, (s0[0] + holeX) / 2, Math.max(L + 1.5, s0[1] - 2)], [0.92, near ? fx + 0.6 : (s0[0] * 0.4 + fx * 0.6), near ? end + 0.9 : Math.max(end + 2.5, (s0[1] + end) / 2)]);
    });
    if (p.by && D.front.includes(p.by)) add('d-' + p.by, [0.9, fx - 0.6, end + 0.8]);
    // Receivers block downfield a little.
    E.TARGETS.filter(k => k !== 'RB' && 'o-' + k !== carrier).forEach(k => { const [x, y] = start['o-' + k]; add('o-' + k, [0.6, x + (MID - x) * 0.1, y + 5]); });
    finishCalls(p, kind, calls, fx, end, forO);
    const ct = tr[carrier] || [];
    const down = tackled(p) && ct.length ? [{key: carrier, t: ct[ct.length - 1][0]}] : [];
    if (down.length) tackle(carrier, down[0].t, down);
    return {tr, ball: ballTr, calls, dur: 2300 + Math.min(900, Math.max(0, p.gain) * 25), down, acts};
  }
  // Passes (and sacks, the RPO's throw, the flea flicker and the halfback pass).
  const routes = Object.assign({}, p.routes || {});
  if (a.kind === 'pass') routes[a.slot] = a.route;
  const target = p.who || (a.kind === 'pass' ? a.slot : 'WR1');
  const routeOf = k => (p.trick && k === target ? 'go' : (p.read === 'pass' && k === target) ? p.route : routes[k] || 'go');
  const roll = flags.r ? (start['o-' + target][0] >= MID ? 1 : -1) : 0;
  const hb = p.trick === 'h';
  const passer = hb ? 'o-RB' : 'o-QB';
  const qbSpot = hb ? [MID + 12, L - 3.5] : [MID + roll * 8, L - 7.2];
  const R = E.ROUTES[routeOf(target)] || E.ROUTES.go;
  const tThrow = p.trick ? 0.5 : Math.min(0.55, Math.max(0.3, 0.22 + R.time * 0.09));
  const air = p.air != null ? p.air : R.depth;
  const tCatch = Math.min(0.82, tThrow + Math.min(0.3, Math.max(0.08, Math.abs(air) / 70)));
  if (hb) {
    // The halfback pass: the pitch, the back heads for the edge like a sweep, then pulls up and throws.
    add('o-RB', [0.16, MID + 9, L - 5], [0.42, qbSpot[0], qbSpot[1]]);
    add('o-QB', [0.12, MID + 1, qb0[1] + 0.4], [0.5, MID + 3, qb0[1] + 1.5]);
    ballTr.push([0.06, MID, qb0[1]], [0.16, MID + 9, L - 5], [0.42, qbSpot[0], qbSpot[1]]);
  } else if (p.trick) {
    // The flea flicker: a handoff, the pitch back, then deep.
    add('o-RB', [0.14, MID + 1, L - 4.8], [0.3, MID + 1.5, L - 2.5], [0.6, MID + 3, L + 2]);
    add('o-QB', [0.12, MID, L - 5.5], [0.3, MID - 0.5, L - 7]);
    ballTr.push([0.1, MID, L - 5.4], [0.16, MID + 1, L - 4.8], [0.3, MID - 0.5, L - 7]);
  } else {
    add('o-QB', [0.22, qbSpot[0], qbSpot[1]]);
    ballTr.push([0.1, MID, qb0[1]], [0.22, qbSpot[0], qbSpot[1]]);
  }
  // Every receiver runs his route; the target's ends where the ball got to him.
  const recv = {};
  E.TARGETS.forEach(k => {
    if (p.trick && k === 'RB') return;
    const [x0, y0] = start['o-' + k];
    const path = routePath(routeOf(k), x0, y0);
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
    add(passer, [tSack, sx, qbSpot[1]], [tSack + 0.12, sx, sy]);
    ballTr.push([tSack, sx, qbSpot[1]], [tSack + 0.12, sx, sy]);
    if (p.by) add('d-' + p.by, [tSack, sx + 0.8, qbSpot[1] + 0.6], [tSack + 0.12, sx + 0.6, sy + 0.4]);
    calls.push({t: tSack + 0.04, text: kind === 'fum' ? 'Fumble!' : 'Sack!', x: sx, y: qbSpot[1] + 2.5, cls: forO(false)});
    coverage(tr, start, D, cover, p, L, null, 0.9);
    // He looks to throw; the rusher gets to him first.
    act(passer, 'tw', tSack - 0.12, tSack - 0.01);
    const down = [{key: passer, t: tSack + 0.12}];
    if (p.by && tr['d-' + p.by]) { act('d-' + p.by, 'tl', tSack - 0.05, tSack + 0.1); down.push({key: 'd-' + p.by, t: tSack + 0.14, tackler: true}); }
    return {tr, ball: ballTr, calls, dur: 2300, down, acts};
  }
  const cp = recv[target] || [start['o-' + target][0], L + air];
  ballTr.push([tThrow, qbSpot[0], qbSpot[1]], [tCatch, cp[0], cp[1]]);
  const air2 = {t0: tThrow, t1: tCatch};
  // The passer winds up and lets it go; his target reaches for it.
  act(passer, 'tw', tThrow - 0.07, tThrow);
  act(passer, 'tr', tThrow, tThrow + 0.07);
  act('o-' + target, 'ct', tCatch - 0.05, tCatch + 0.03);
  let dur = 2500, down = [], loose = null;
  if (kind === 'catch') {
    const fx = p.oob ? (cp[0] >= MID ? WIDTH - 0.6 : 0.6) : clampX(cp[0] + (MID - cp[0]) * 0.15);
    const tEnd = Math.min(0.95, tCatch + 0.12 + Math.min(0.3, Math.max(0, end - cp[1]) / 60));
    tr['o-' + target].push([tEnd, fx, end]);
    ballTr.push([tEnd, fx, end]);
    if (p.broke) { calls.push({t: (tCatch + tEnd) / 2, text: 'Broken tackle!', key: 'o-' + target, cls: forO(true)}); act('o-' + target, 'tk', (tCatch + tEnd) / 2 - 0.04, (tCatch + tEnd) / 2 + 0.03); }
    coverage(tr, start, D, cover, p, L, {at: tCatch, x: fx, y: end, t: tEnd}, tEnd);
    finishCalls(p, kind, calls, fx, end, forO, tEnd);
    dur = 2500 + (tEnd - tCatch) * 2400;
    if (tackled(p)) { down = [{key: 'o-' + target, t: tEnd}]; tackle('o-' + target, tEnd, down); }
  } else if (kind === 'inc') {
    ballTr.push([Math.min(0.95, tCatch + 0.1), cp[0] + 1.2, cp[1] - 1.5]);
    loose = tCatch;
    coverage(tr, start, D, cover, p, L, {at: tCatch, x: cp[0], y: cp[1], miss: true}, tCatch);
    calls.push({t: tCatch, text: p.by && !p.trick ? 'Broken up' : 'Incomplete', x: cp[0], y: cp[1] + 2.8});
    // The man in coverage gets a hand on it.
    if (p.by && !p.trick) act('d-' + p.by, 'sw', tCatch - 0.05, tCatch + 0.05);
    if (p.kind === '2fail') calls.push({t: 0.9, text: 'No good', x: MID, y: L + 6, cls: 'is-bad'});
    else if (p.downs) calls.push({t: 0.9, text: 'Turnover on downs', x: MID, y: L + 6, cls: forO(false)});
  } else if (kind === 'int') {
    const back = Math.max(L + 2, cp[1] - 8);
    ballTr.push([0.95, cp[0] + (MID - cp[0]) * 0.3, back]);
    coverage(tr, start, D, cover, p, L, {at: tCatch, x: cp[0], y: cp[1], pick: true, back}, tCatch);
    calls.push({t: tCatch + 0.02, text: 'Picked off!', x: cp[0], y: cp[1] + 2.8, cls: forO(false)});
    if (p.by) act('d-' + p.by, 'ct', tCatch - 0.05, tCatch + 0.03);
    dur = 2600;
  }
  return {tr, ball: ballTr, calls, dur, air: air2, down, loose, acts};
}
/** The ball carrier goes down at the end of his run unless he scored or got out of bounds. */
const tackled = p => !p.td && !p.oob && p.kind !== '2good';
/** A snap's choreography (choreo) and where a track is at a moment (at), for the kit's checks (checks-drill.js). */
export const planOf = (s, p) => choreo(s, p), trackAt = (track, t) => at(track, t);
/** Coverage: man calls trail their receivers; zones drop, then everyone converges on the ball. */
function coverage(tr, start, D, cover, p, L, ballAt, tEnd) {
  const man = p.dcall === 'c0' || p.dcall === 'c1';
  const deep = {c2: [[MID - 12, 14], [MID + 12, 14]], c3: [[8, 13], [MID, 15], [WIDTH - 8, 13]], c4: [[8, 13], [MID - 6, 15], [MID + 6, 15], [WIDTH - 8, 13]],
    pv: [[10, 22], [MID - 6, 24], [MID + 6, 24], [WIDTH - 10, 22]], fire: [[8, 12], [MID, 15], [WIDTH - 8, 12]], rb: [[MID, 14]], c0: [], c1: [[MID, 15]]}[p.dcall] || [[MID, 14]];
  const used = new Set();
  const look = viewOf(p).look;
  Object.keys(cover).forEach(rk => {
    const dk = E.fielded(D.T, look, cover[rk]), s0 = start['d-' + dk];
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
function finishCalls(p, kind, calls, x, y, forO, t = 0.92) {
  const at2 = (text, cls, dy = 3) => calls.push({t, text, x: Math.max(8, Math.min(WIDTH - 8, x)), y: Math.min(106, y + dy), cls});
  if (p.kind === '2good') at2('It’s good!', 'is-score');
  else if (p.kind === '2fail') at2('No good', 'is-bad');
  else if (p.td) at2('Touchdown!', p.poss === 'us' ? 'is-score' : 'is-bad');
  else if (p.safety) at2('Safety!', forO(false));
  else if (p.downs) at2('Turnover on downs', forO(false));
  else if (p.first) at2('First down', forO(true));
  else if (p.oob) at2('Out of bounds');
}

/** How fast a snap plays out: each plan's own length times PACE (above 1: slower, so the play can be followed). */
const PACE = 1.6;
// The camera behind the offense (views/drill-cam.js): how long it takes to swing down before the snap and back up
// after the play, how long the end of the play holds first, and the beat set before the snap.
const PAN_IN = 760, PAN_OUT = 640, HOLD = 420 * PACE, SET = 420;
/** What the camera draws for a snap: the players on the field (their numbers, rating colours and uniforms; yours in
 *  your team's colours, theirs in white), the end zones, the home team's stands and its logo at midfield, and the
 *  scoreboard as the snap starts. */
function camScene(st, p) {
  const s = st.s, ids = E.idsFor(s, p.poss);
  const players = spots(s, viewOf(p)).filter(d => !d.off).map(d => {
    const id = d.side === 'o' ? ids.o : ids.d;
    return {key: d.key, slot: d.slot, side: d.side, j: d.p.j, n: d.p.n, rc: ratingColor(d.p.r), team: tcol(id), colored: id === s.sc.o, mine: (d.side === 'o') === (p.poss === 'us')};
  });
  const end = id => ({name: dr.team(id).n, c: tcol(id)[0]});
  const home = s.sc.g && s.sc.g.h && dr.team(s.sc.g.h) ? s.sc.g.h : s.sc.d;
  return {players, ends: {near: end(ids.o), far: end(ids.d)}, crowd: tcol(home), logo: logoUrl(home, 320), board: camBoard(st, p, false)};
}
/** The scoreboard bar's content (drill-cam.js sbarHTML) from a game as it stands: yours first. */
function boardOf(s) {
  const poss = s.result ? null : s.poss;
  const team = (id, side, score, tos) => ({id, c: tcol(id), logo: logoUrl(id, 96), score, tos, ball: poss === side});
  return {teams: [team(s.sc.o, 'us', s.us, s.tos), team(s.sc.d, 'them', s.them, s.dtos)], q: s.result ? 'Final' : '4th',
    clock: dr.clockText(s.clock), run: !s.result && s.running, dd: s.result ? '' : s.phase === 'pat' ? 'Try' : dr.downText(s.down, s.togo, s.ball)};
}
/** The camera's scoreboard: as the snap starts (from the play), or after it (the game as it now stands). */
function camBoard(st, p, after) {
  if (after) return boardOf(st.s);
  const s = st.s, b = boardOf(s);
  b.teams[0].score = p.us; b.teams[1].score = p.them; b.teams[0].tos = p.tos;
  b.teams[0].ball = p.poss === 'us'; b.teams[1].ball = p.poss === 'them';
  b.q = '4th'; b.clock = dr.clockText(p.clock); b.run = false;
  b.dd = ['xp', '2good', '2fail'].includes(p.kind) ? 'Try' : dr.downText(p.down, p.togo, p.ball);
  return b;
}
/** Plays a choreography: the camera swings down behind the offense, the play runs, the camera swings back up to the
 *  dots, now where the play left them. Resolves when it's done (or skipped: a tap on the field). Without a canvas,
 *  the dots play it out top-down. */
function runAnim(st, plan, p) {
  return new Promise(resolve => {
    const f = st.el.querySelector('[data-dr-field]');
    if (!f || ui.RM || !st.ctx.visible) { resolve(); return; }
    const track = f.querySelector('.dr-track'), ball = f.querySelector('[data-dr-ball]'), cl = f.querySelector('[data-dr-callouts]');
    const els = {};
    Object.keys(plan.tr).forEach(k => { els[k] = f.querySelector(`[data-dr-p="${k}"]`); });
    f.classList.add('is-anim');
    cl.innerHTML = '';
    const clock = st.el.querySelector('[data-dr-clock]');
    const c0 = p.clock, c1 = p.t1 != null ? p.t1 : p.after.clock;
    const wt0 = winTop(p.ball), fd = viewOf(p).fd;
    // The window follows the ball when it heads off the top.
    const winAt = b => (b ? Math.min(110, Math.max(wt0, b[1] + 9)) : wt0);
    const wt1 = winAt(at(plan.ball, 1));
    let cam = null;
    try { cam = camLib.open(f, Object.assign(camScene(st, p), {acts: plan.acts || []})); } catch (_) { cam = null; }
    // The ball's height: a pass on its arc, a kick up and over the bar.
    const air = plan.air, a0 = air && at(plan.ball, air.t0), a1 = air && at(plan.ball, air.t1);
    const arc = air ? Math.min(9, Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / 3.2) : 0;
    const ballZ = t => {
      if (air && t > air.t0 && t < air.t1) { const u = (t - air.t0) / (air.t1 - air.t0); return 4 * arc * u * (1 - u); }
      if (plan.kick && t > 0.2) {
        const u = Math.min(1, (t - 0.2) / 0.65);
        return t <= 0.85 ? 36 * u * (1 - u) + 3.8 * u : 3.8 * Math.max(0, 1 - (t - 0.85) / 0.15);
      }
      return 0;
    };
    const ms = plan.dur * PACE, still = ms * 0.015 / 1000 * 1.4; // under 1.4 yards a second, he's standing
    const frameAt = (u, t, now, wt) => {
      const pos = {}, run = {}, down = {};
      Object.keys(plan.tr).forEach((k, i) => {
        const q = at(plan.tr[k], t);
        if (!q) return;
        pos[k] = q;
        if (t <= 0 || t >= 1) return;
        const q0 = at(plan.tr[k], Math.max(0, t - 0.015));
        if (Math.hypot(q[0] - q0[0], q[1] - q0[1]) > still) run[k] = 1 + (Math.floor(now / 115) + i) % 2;
      });
      (plan.down || []).forEach(d => { if (t >= d.t && pos[d.key]) down[d.key] = pos[d.key][0] < MID ? 'r' : 'l'; });
      const b = at(plan.ball, t), z = ballZ(t);
      const loose = plan.loose != null && t > plan.loose;
      let hold = null;
      if (t > 0.06 && z < 0.3 && !loose) {
        let best = 1.8;
        Object.keys(pos).forEach(k => { const d = Math.hypot(pos[k][0] - b[0], pos[k][1] - b[1]); if (d < best) { best = d; hold = k; } });
      }
      const carry = plan.kick ? 2 : loose ? 10 * Math.max(0, 1 - (t - plan.loose) / 0.06) : hold && down[hold] ? 4 : 10;
      // The camera follows the ball; a pass in the air, it heads for where it's going, once the passer's follow-through
      // has been seen.
      const fb = air && t > air.t0 + 0.08 && t < air.t1 ? a1 : b;
      return {u, t, top: [MID, wt - WIN / 2], follow: [MID + (fb[0] - MID) * 0.45, Math.min(104, Math.max(p.ball + 8, fb[1] + 6))],
        pos, run, down, ball: [b[0], b[1], z], carry, hold, los: p.ball, fd, now};
    };
    // The dots underneath: where the play leaves them (every frame when there's no camera).
    const dom = t => {
      Object.keys(plan.tr).forEach(k => {
        const e = els[k], q = at(plan.tr[k], t);
        if (!e || !q) return;
        e.style.left = left(q[0]);
        e.style.top = top(q[1]);
      });
      const b = at(plan.ball, t);
      if (b) { ball.style.left = left(b[0]); ball.style.top = top(b[1]); }
      ball.classList.toggle('is-air', !!(plan.air && t > plan.air.t0 && t < plan.air.t1) || !!(plan.kick && t > 0.2 && t < 0.85));
      track.style.transform = trackY(winAt(b));
    };
    const seen = new Set(), shown = [];
    const calls = t => plan.calls.forEach((c, i) => {
      if (t < c.t || seen.has(i)) return;
      seen.add(i);
      const pos = c.key ? at(plan.tr[c.key], c.t) : [c.x, c.y];
      const el = document.createElement('span');
      el.className = 'dr-co' + (c.cls ? ' ' + c.cls : '');
      el.textContent = c.text;
      // On the camera, over the players' heads (a player's own over his), so it doesn't hide what's happening.
      if (cam) { cam.overlay.appendChild(el); shown.push({el, x: pos[0], y: pos[1] - (c.key ? 0 : 2.8), lift: 1}); }
      else {
        el.style.left = left(Math.max(9, Math.min(WIDTH - 9, pos[0])));
        el.style.top = top(pos[1] + (c.key ? 2.8 : 0));
        cl.appendChild(el);
      }
    });
    // Callouts on the camera's view stay over their spot as it moves (and on the field).
    const place = () => {
      const w = f.clientWidth, h = f.clientHeight;
      shown.forEach(c => {
        const q = cam.css(c.x, c.y, c.lift);
        if (!q) return;
        c.el.style.left = `${Math.max(64, Math.min(w - 64, q[0])).toFixed(1)}px`;
        c.el.style.top = `${Math.max(18, Math.min(h - 18, q[1])).toFixed(1)}px`;
      });
    };
    const clockAt = t => {
      const text = dr.clockText(Math.round(c0 + (c1 - c0) * Math.min(1, Math.max(0, (t - 0.08) / 0.85))));
      if (clock) clock.textContent = text;
      if (cam) cam.clock(text);
    };
    let done = false, phase = cam ? 'in' : 'play', p0 = performance.now();
    const stop = quick => {
      if (done) return;
      done = true;
      if (cam) { if (quick) cam.remove(); else cam.close(); }
      f.classList.remove('is-anim');
      f.removeEventListener('click', skip);
      st.anim = null;
      resolve();
    };
    const tick = now => {
      if (done) return;
      if (st.dead) { stop(true); return; }
      const el = now - p0;
      if (phase === 'in') {
        if (el < PAN_IN) cam.render(frameAt(el / PAN_IN, 0, now, wt0));
        else { phase = 'set'; p0 = now; }
      }
      // Set, a beat before the snap: linemen down in their stance.
      if (phase === 'set') {
        if (now - p0 < SET) cam.render(frameAt(1, 0, now, wt0));
        else { phase = 'play'; p0 = now; }
      }
      if (phase === 'play') {
        const t = Math.min(1, (now - p0) / ms);
        if (cam) { cam.render(frameAt(1, t, now, wt0)); place(); } else dom(t);
        calls(t);
        clockAt(t);
        if (t >= 1) { dom(1); phase = 'hold'; p0 = now; if (cam) cam.board(camBoard(st, p, true)); }
      } else if (phase === 'hold') {
        if (cam) { cam.render(frameAt(1, 1, now, wt0)); place(); }
        if (now - p0 >= HOLD) {
          if (!cam) { stop(); return; }
          phase = 'out'; p0 = now;
        }
      } else if (phase === 'out') {
        const u = 1 - (now - p0) / PAN_OUT;
        if (u <= 0) { stop(); return; }
        cam.render(frameAt(u, 1, now, wt1));
        place();
      }
      requestAnimationFrame(tick);
    };
    const skip = () => { if (done) return; dom(1); calls(1); clockAt(1); stop(); };
    st.anim = {skip};
    f.addEventListener('click', skip);
    if (cam) cam.render(frameAt(0, 0, p0, wt0));
    requestAnimationFrame(tick);
  });
}
/** The runoff before a snap from a running clock: the scorebug counts it down quickly. */
function runOff(st, from, to) {
  return new Promise(resolve => {
    const el = st.el.querySelector('[data-dr-clock]');
    if (!el || from === to || ui.RM || !st.ctx.visible) { if (el) el.textContent = dr.clockText(to); resolve(); return; }
    const t0 = performance.now(), ms = 420 * PACE;
    const step = now => {
      if (st.dead) { resolve(); return; }
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = dr.clockText(Math.round(from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}
const pause = (st, ms) => new Promise(res => { if (ui.RM || !st.ctx.visible) res(); else st.timers.push(setTimeout(res, ms)); });

// ============================================================================ Markup: the game
/** The scoreboard bar on the field (drill-cam.js sbarHTML, the same as the camera's): the game as it stands. */
function bugHTML(s) {
  const has = s.result ? '' : s.poss === 'us' ? ' You have the ball.' : ` ${s.sc.d} has the ball.`;
  const label = `${s.sc.o} ${s.us}, ${s.sc.d} ${s.them}. ${s.result ? 'Final.' : `${dr.clockText(s.clock)} left in the fourth.`}${has} Timeouts: you ${s.tos}, ${s.sc.d} ${s.dtos}.`;
  return camLib.sbarHTML(boardOf(s), {attrs: ` data-dr-bug role="group" aria-label="${esc(label)}"`, clock: 'data-dr-clock'});
}
function sitHTML(s) {
  const chip = (t, cls = '') => `<span class="dr-chip${cls ? ' ' + cls : ''}">${t}</span>`;
  let h;
  if (s.result) h = chip('Final', 'is-strong') + chip(esc(dr.resultText(s).sub));
  else if (s.phase === 'pat') h = chip('Try', 'is-strong') + chip('From the 2') + chip('Clock stopped');
  else {
    const side = s.poss === 'us' ? chip(`${ui.icon('football', {size: 13})}Offense`, 'is-o') : chip(`${ui.icon('shield', {size: 13})}Defense`, 'is-d');
    h = side + chip(`<b>${esc(dr.downText(s.down, s.togo, s.ball))}</b>${esc(` · ${s.ball === 50 ? 'midfield' : dr.spot(s)}`)}`, 'is-strong')
      + chip(s.running ? '<i class="dr-dot"></i>Clock runs' : `${ui.icon('clock', {size: 13})}Stopped`, s.running ? 'is-run' : 'is-stop');
  }
  return `<div class="dr-sit" data-dr-sit>${h}</div>`;
}
function legendHTML() {
  return `<div class="dr-legend"><span class="dr-scale" aria-hidden="true"><span>Rating</span><i></i></span>`
    + `<span class="dr-key" aria-hidden="true"><i class="is-mine"></i>Yours</span>`
    + `<button type="button" class="dr-pill" data-dr-ratings>${ui.icon('search', {size: 14})}<span>Player ratings</span></button></div>`;
}
/** What the other side shows, as a slim strip: who, and the look (or formation) with what it means. */
function lookHTML(s) {
  const them = s.poss === 'them', L = them ? E.FORMS[s.form] : E.LOOKS[s.look];
  return `<div class="dr-look"><span class="dr-look-ic">${ui.icon(them ? 'football' : 'shield', {size: 15})}</span><span class="dr-look-tx">`
    + `<small>${esc(them ? `${E.idsFor(s, 'them').o} offense` : `${s.sc.d} defense shows`)}</small>`
    + `<span><b>${esc(L.name)}</b> · ${esc(L.sub)}</span></span></div>`;
}
function headRow(title, s) {
  const where = s.phase === 'pat' ? 'Try from the 2' : `${dr.downText(s.down, s.togo, s.ball)} · ${s.ball === 50 ? 'midfield' : dr.spot(s)}`;
  return `<div class="dr-call-h"><h3 class="dr-call-t" id="dr-call-t">${esc(title)}</h3><p class="dr-call-s">${esc(where)}</p></div>`;
}
// No huddle: from a running clock, the snap comes E.NO_HUDDLE seconds later instead of E.HURRY, a little less set. A
// switch on every snap of yours that stays on until you turn it off; it only goes into a call while the clock runs
// (with the clock stopped there's no time to save), and trick plays need a huddle.
const hurryOn = st => !!st.hurry && !!st.s && st.s.running && st.s.poss === 'us' && st.s.phase === 'play';
function hurryHTML(st, cls = 'dr-pill') {
  if (!(st.s && st.s.poss === 'us' && st.s.phase === 'play' && !st.s.result)) return '';
  return `<button type="button" class="${cls} dr-hurry" data-dr-hurry aria-pressed="${!!st.hurry}" aria-label="${esc(`No huddle: while the clock runs, snap in ${E.NO_HUDDLE} seconds instead of ${E.HURRY}`)}">${ui.icon('bolt', {size: 14})}<span>No huddle</span></button>`;
}
function warnHTML(st) {
  const s = st.s, o = E.options(s), setup = hurryOn(st) ? E.NO_HUDDLE : E.HURRY;
  if (!s.running || s.clock > E.HURRY || s.phase !== 'play') return '';
  const fix = s.clock > setup ? `${st.hurry ? 'No huddle gets the snap off in time' : `No huddle gets it off in ${E.NO_HUDDLE}`}${o.timeout || o.spike ? `, or ${o.timeout ? 'call a timeout' : 'spike it'}` : ''}`
    : o.timeout ? 'Call a timeout' : s.down < 4 ? 'Spike it' : 'Nothing left to stop it';
  return `<p class="dr-warn" data-dr-warn>${ui.icon('clock', {size: 15})}<span>${esc(`The clock is running and the next snap takes ${setup} seconds to get off. ${fix}${o.fg ? (o.timeout ? ', then kick' : '') : ''}.`)}</span></p>`;
}
/** The four play types, each with its three plays (a pass's are the snap's s.book). */
const CALL_TYPES = [['run', 'Run'], ['pass', 'Pass'], ['rpo', 'RPO'], ['trick', 'Trick']];
/** The open play type (st.panel): 'main' with none open, or with the trick play used. */
const typeOf = st => (st.panel === 'trick' && !st.s.trick ? 'main' : ['pass', 'run', 'rpo', 'trick'].includes(st.panel) ? st.panel : 'main');
/** The play types as one switch that stays above the open type's plays: tap another to change, the open one to close. */
function typesHTML(st, open) {
  const s = st.s;
  const subs = {run: 'Zone, Toss, Draw', pass: (s.book || []).map(k => E.PASS_PLAYS[k].name).join(', '), rpo: 'Slant, Bubble, Seam', trick: 'Flea Flicker, HB Pass, Reverse'};
  return `<div class="dr-types" role="group" aria-label="Play type">` + CALL_TYPES.map(([k, l]) => {
    const off = k === 'trick' && !s.trick;
    return `<button type="button" class="dr-type" data-dr-menu="${k}" aria-pressed="${open === k}"${off ? ' disabled' : ''}`
      + ` aria-label="${esc(`${k === 'trick' ? 'Trick play' : l}: ${off ? 'used, one a game' : subs[k]}`)}">${esc(l)}</button>`;
  }).join('') + `</div>`;
}
function callHTML(st) {
  const s = st.s, o = E.options(s), open = typeOf(st);
  const pat = s.phase === 'pat';
  const body = open === 'pass' ? passBody(st) : open === 'run' || open === 'rpo' ? runBody(st, open) : open === 'trick' ? trickBody(st)
    : `<p class="dr-hint">Pick a play type to see its three plays.</p>`;
  const fg = o.fg ? `<button type="button" class="dr-fg" data-dr-go="${E.tok.fg}"><span class="dr-fg-tx"><b>Field goal</b><small>${esc(`${o.fg.dist} yards`)}</small></span><span class="dr-fg-p">${pct(o.fg.p)}<small>to make</small></span></button>` : '';
  let kick = '';
  if (pat) {
    const d = s.them - s.us;
    kick = `<button type="button" class="dr-fg" data-dr-go="${E.tok.kick}"><span class="dr-fg-tx"><b>Kick the extra point</b><small>${d === 1 ? 'Ties the game' : 'Gets you within one'}</small></span></button>`
      + `<p class="dr-or">or run a play from the 2 for two points, ${d === 1 ? 'to take the lead' : 'to tie it'}</p>`;
  }
  const tools = [];
  if (o.timeout || (s.running && !pat)) tools.push(`<button type="button" class="dr-pill" data-dr-go="${E.tok.timeout}"${o.timeout ? '' : ' disabled'}>${ui.icon('clock', {size: 14})}<span>Timeout · ${s.tos} left</span></button>`);
  if (o.spike) tools.push(`<button type="button" class="dr-pill" data-dr-go="${E.tok.spike}">${ui.icon('bolt', {size: 14})}<span>Spike</span></button>`);
  if (o.kneel) tools.push(`<button type="button" class="dr-pill is-accent" data-dr-go="${E.tok.kneel}">${ui.icon('check-circle', {size: 14})}<span>Kneel</span></button>`);
  // No huddle sits with the options of a pass, a run and an RPO; a trick play needs a huddle.
  if (!pat && s.us <= s.them && open === 'main') tools.push(hurryHTML(st));
  const warn = warnHTML(st);
  const lead = s.us > s.them && !pat ? `<p class="dr-goal">${esc(`You lead by ${s.us - s.them}. Keep the ball and run out the clock: a kneel takes ${E.KNEEL} seconds off when it's running.`)}</p>` : '';
  return `<section class="dr-call" aria-labelledby="dr-call-t">${headRow(pat ? 'Kick or go for two?' : 'Your call', s)}<div class="dr-call-box">`
    + kick + lead + lookHTML(s) + typesHTML(st, open) + body + fg
    + (tools.filter(Boolean).length ? `<div class="dr-tools">${tools.join('')}</div>` : '') + warn + `</div></section>`;
}
/** What your defense has to do, from the score. */
function goalText(s) {
  const lead = s.us - s.them;
  if (lead >= 9) return `Up ${lead}: keep everything in front of you.`;
  if (lead >= 7) return `Up ${lead}: a touchdown${lead === 8 ? ' and a two-point try' : ''} ties it.`;
  if (lead >= 4) return `Up ${lead}: a touchdown beats you.`;
  if (lead === 3) return 'Up 3: a field goal ties it, a touchdown beats you.';
  if (lead > 0) return `Up ${lead}: a field goal beats you.`;
  if (lead === 0) return 'Tied: any score beats you.';
  return `Down ${-lead}: get a stop and get the ball back with time left.`;
}
/** The defense's play types, like the offense's: each with its calls. */
const DEF_TYPES = [['zone', 'Zone', ['c2', 'c3', 'c4']], ['man', 'Man', ['c1', 'c0']], ['blitz', 'Blitz', ['fire', 'rb']], ['prevent', 'Prevent', ['pv']]];
/** The open defensive type (st.dpanel), or null with none open. */
const dtypeOf = st => (DEF_TYPES.some(([k]) => k === st.dpanel) ? st.dpanel : null);
/** The defense's types as the same switch as the offense's: tap another to change, the open one to close. */
function defTypesHTML(open) {
  return `<div class="dr-types" role="group" aria-label="Type of call">` + DEF_TYPES.map(([k, l, calls]) =>
    `<button type="button" class="dr-type${l.length > 6 ? ' is-long' : ''}" data-dr-dmenu="${k}" aria-pressed="${open === k}" aria-label="${esc(`${l}: ${calls.map(c => E.CALLS[c].name).join(', ')}`)}">${esc(l)}</button>`).join('') + `</div>`;
}
function defenseHTML(st) {
  const s = st.s, o = E.options(s), open = dtypeOf(st);
  const tools = o.timeout ? `<div class="dr-tools"><button type="button" class="dr-pill" data-dr-go="${E.tok.timeout}">${ui.icon('clock', {size: 14})}<span>Timeout · ${s.tos} left</span></button></div>` : '';
  const warn = o.timeout && s.them > s.us ? `<p class="dr-warn">${ui.icon('clock', {size: 15})}<span>${esc(`Their clock is running. Each snap takes ${E.MILK} seconds off unless you stop it.`)}</span></p>` : '';
  const body = open ? `<div class="dr-cards" data-dr-cards>${defCardsHTML(st, DEF_TYPES.find(([k]) => k === open)[2])}</div>` + legendDefHTML()
    : `<p class="dr-hint">Pick a type of call to see its plays. Their play is set at the snap from the formation and the situation, whatever you call.</p>`;
  return `<section class="dr-call is-def" aria-labelledby="dr-call-t">${headRow('Your defense', s)}<div class="dr-call-box">`
    + `<p class="dr-goal">${esc(goalText(s))}</p>` + lookHTML(s) + defTypesHTML(open) + body + tools + warn + `</div></section>`;
}
// ---------------------------------------------------------------------------- Play cards
// Three plays of each type, drawn like a Madden play-call screen: the formation and the play's name, the target
// player's headshot, the play art on a dark field (the real yard lines around the ball, the line of scrimmage dashed
// gold, the line as blocks, every route with its arrow: the target's red, the back's blue, the rest yellow; blockers'
// lines end in a bar) and how the play has gone for you this game (calls, average yards). Field yards across (0-53.3)
// and from the line of scrimmage (ART.lo behind to ART.hi past it, squeezed by ART.k); a deep route runs off the top,
// its arrow at the edge.
const ART = {lo: -10.5, hi: 24, k: 0.7};
const ART_H = (ART.hi - ART.lo) * ART.k;
const ARTY = y => (ART.hi - y) * ART.k;
const f2 = v => v.toFixed(2);
const RC = {key: '#FF4D5E', white: 'rgba(255,255,255,.88)'};
/** Each receiver's own colour on the cards (his route, his name, the mark on his route in the list); the play's
 *  target is red instead. */
const SLOT_C = {WR1: '#F5C518', WR2: '#38BDF8', WR3: '#4ADE80', TE: '#FB923C', RB: '#C084FC'};
const FORMATION = 'Gun Doubles';
/** The play's target: the player on its card (pass plays: the read the play is built for). */
const PASS_KEY = {verts: 'WR1', postdig: 'WR2', smash: 'WR3', slantwheel: 'RB', levels: 'WR2', dagger: 'WR3', outs: 'WR1', mesh: 'TE', corners: 'TE', hail: 'WR2'};
const RPO_KEY = k => E.RPOS[k].slot;
const TRICK_KEY = {f: 'WR1', h: 'WR2', r: 'WR1'};
/** A line along a path (field yards), ending in an arrow, a block bar or nothing. */
/** A path cut where it leaves the top of the art. */
function artClip(path) {
  const top = ART.hi - 1.2, out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x1, y1] = path[i];
    if (y1 <= top) { out.push(path[i]); continue; }
    const k = (top - y0) / (y1 - y0);
    out.push([x0 + (x1 - x0) * k, top]);
    break;
  }
  return out;
}
function artPath(path, col, {dash = false, end = 'arrow'} = {}) {
  const P = artClip(path).map(([x, y]) => [x, ARTY(y)]);
  let h = `<polyline points="${P.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' ')}" fill="none" stroke="${col}" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"${dash ? ' stroke-dasharray=".2 1.3"' : ''}/>`;
  if (end === 'none' || P.length < 2) return h;
  const [x1, y1] = P[P.length - 1], [x0, y0] = P[P.length - 2];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  if (end === 'block') return h + `<line x1="${f2(x1 - uy * 1.3)}" y1="${f2(y1 + ux * 1.3)}" x2="${f2(x1 + uy * 1.3)}" y2="${f2(y1 - ux * 1.3)}" stroke="${col}" stroke-width=".8" stroke-linecap="round"/>`;
  const a = 1.7, bx = x1 - ux * a, by = y1 - uy * a, px = -uy * a * 0.62, py = ux * a * 0.62;
  return h + `<polygon points="${f2(x1 + ux * 0.3)},${f2(y1 + uy * 0.3)} ${f2(bx + px)},${f2(by + py)} ${f2(bx - px)},${f2(by - py)}" fill="${col}"/>`;
}
/** The field under the art: the real yard lines around the ball, numbers, hash marks, the end zone, the line. */
function artField(ball) {
  let h = '';
  if (ball + ART.hi > 100) h += `<rect x="0" y="0" width="${WIDTH}" height="${f2(ARTY(100 - ball))}" fill="rgba(255,255,255,.05)"/>`;
  for (let yd = Math.ceil((ball + ART.lo) / 5) * 5; yd <= ball + ART.hi; yd += 5) {
    if (yd < 0 || yd > 100) continue;
    const y = f2(ARTY(yd - ball)), goal = yd === 0 || yd === 100, ten = yd % 10 === 0;
    h += `<line x1="0" x2="${WIDTH}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,${goal ? 0.55 : ten ? 0.2 : 0.09})" stroke-width="${goal ? 0.5 : 0.22}"/>`;
    if (ten && !goal) {
      const n = yd <= 50 ? yd : 100 - yd;
      h += `<text x="4.6" y="${y}" transform="rotate(90 4.6 ${y})" class="dr-art-n">${n}</text><text x="${f2(WIDTH - 4.6)}" y="${y}" transform="rotate(-90 ${f2(WIDTH - 4.6)} ${y})" class="dr-art-n">${n}</text>`;
    }
  }
  for (let yd = Math.ceil(ball + ART.lo); yd <= Math.min(100, ball + ART.hi); yd++) {
    if (yd % 5 === 0 || yd < 0) continue;
    const y = f2(ARTY(yd - ball));
    h += `<path d="M21.4 ${y}h1M31 ${y}h1" stroke="rgba(255,255,255,.16)" stroke-width=".22"/>`;
  }
  return h + `<line x1="0" x2="${WIDTH}" y1="${f2(ARTY(0))}" y2="${f2(ARTY(0))}" stroke="#E2B93B" stroke-width=".42" stroke-dasharray="1 .8"/>`;
}
/** The eleven: the line as blocks (the center square), everyone else a dot; on a run the line drives forward. */
function artPlayers(run, P = OFF_POS) {
  let h = '';
  Object.keys(P).forEach(k => {
    const [x, y] = P[k], Y = ARTY(y);
    if (!OL.includes(k)) { h += `<circle cx="${f2(x)}" cy="${f2(Y)}" r="1.05" fill="#fff"/>`; return; }
    if (run) h += artPath([[x, y], [x, y + 1.8]], RC.white, {end: 'block'});
    h += `<rect x="${f2(x - 0.9)}" y="${f2(Y - 0.9)}" width="1.8" height="1.8" rx="${k === 'C' ? 0.2 : 0.9}" fill="#fff"/>`;
  });
  return h;
}
/** Who runs what: each receiver's last name under his dot in his colour (the target's first; each placed where it
 *  overlaps no other name and no player: under him, then lower, then beside him). who: slot -> name. */
const LBL = {fs: 1.7, cw: 1.12};
function artLabels(who, slots, key, P = OFF_POS) {
  const boxes = Object.keys(P).map(k => { const [x, y] = P[k], Y = ARTY(y); return [x - 1.15, Y - 1.15, x + 1.15, Y + 1.15, k]; });
  const hit = (b, own) => boxes.some(c => c[4] !== own && b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
  const order = slots.filter(k => k === key).concat(slots.filter(k => k !== key));
  return order.map(slot => {
    const text = String(who[slot] || '').toUpperCase();
    if (!text) return '';
    const [x, y] = P[slot], Y = ARTY(y), w = text.length * LBL.cw, h = LBL.fs * 0.78;
    const tries = [];
    [2.45, 4.05].forEach(dy => [x - w / 2, x - 1, x + 1 - w].forEach(x0 => tries.push([x0, Y + dy])));
    tries.push([x + 1.6, Y + h / 2], [x - 1.6 - w, Y + h / 2]);
    for (const [x0r, base] of tries) {
      const x0 = Math.max(0.5, Math.min(WIDTH - 0.5 - w, x0r));
      const b = [x0 - 0.25, base - h - 0.1, x0 + w + 0.25, base + 0.3];
      if (b[3] > ART_H || hit(b, slot)) continue;
      boxes.push(b.slice(0, 4));
      return `<text class="dr-art-l" x="${f2(x0)}" y="${f2(base)}" fill="${colOf(slot, key)}">${esc(text)}</text>`;
    }
    return '';
  }).join('');
}
/** A card's art: the field, the play (inner), your eleven (P: where they line up), the names. on: {who} (artOn). */
const artSVG = (on, ball, inner, run = false, labels = '', P = OFF_POS) => `<svg class="dr-art" viewBox="0 0 ${WIDTH} ${f2(ART_H)}" aria-hidden="true">${artField(ball)}${inner}${artPlayers(run, P)}${labels}</svg>`;
/** Your eleven for a run or an RPO to a side: to the weak side, the back flipped. */
const runPos = dir => (dir === 'w' ? flipPos(OFF_POS) : OFF_POS);
const artRoute = (slot, route) => routePath(route, OFF_POS[slot][0], OFF_POS[slot][1]);
const colOf = (slot, key) => (slot === key ? RC.key : SLOT_C[slot] || RC.white);
/** What every card shares: your receivers' last names by slot (their labels) and the look their defense shows. */
const artOn = s => ({who: Object.fromEntries(E.TARGETS.map(k => [k, dr.lastName(s.mine.by[k].n)])),
  vs: s.poss === 'us' ? `vs ${E.LOOKS[s.look || PRE_LOOK].name}` : ''});
/** The receivers' blocks on a run: a few yards up, a bar at the end. */
const artBlocks = skip => E.TARGETS.filter(k => k !== 'RB' && !skip.includes(k)).map(k => {
  const [x, y] = OFF_POS[k];
  return artPath([[x, y], [x + (MID - x) * 0.06, y + 4]], RC.white, {end: 'block'});
}).join('');
function passArt(ball, routes, key, on) {
  // The target's route last, over the others.
  const order = E.TARGETS.filter(k => k !== key).concat(key ? [key] : []);
  return artSVG(on, ball, order.map(k => artPath(artRoute(k, routes[k]), colOf(k, key))).join(''), false, artLabels(on.who, E.TARGETS, key));
}
/** The back's path on a run (RUNS) to a side, from where he lines up for it: one side's the other's mirror image. */
function runPath(play, dir) {
  const sg = dirSign(dir), rb = runPos(dir).RB;
  if (play === 't') return [rb, [MID + sg * 9, -5], [MID + sg * 16, -1.5], [MID + sg * 18, 9]];
  if (play === 'd') return [rb, [MID + sg * 1.5, -6.8], [MID + sg * 1.2, 0], [MID + sg * 1.5, 11]];
  return [rb, [MID + sg * 2, -2], [MID + sg * 4, 3], [MID + sg * 5, 11]];
}
function runArt(ball, play, dir, on) {
  let h = artBlocks([]);
  if (play === 't') h += artPath([OFF_POS.QB, [MID + dirSign(dir) * 9, -5]], RC.white, {dash: true, end: 'none'});
  if (play === 'd') h += artPath([OFF_POS.QB, [MID, -8.4]], RC.white, {dash: true, end: 'none'});
  const P = runPos(dir);
  return artSVG(on, ball, h + artPath(runPath(play, dir), RC.key), true, artLabels(on.who, ['RB'], 'RB', P), P);
}
function rpoArt(ball, play, dir, on) {
  const R = E.RPOS[play], P = runPos(dir);
  return artSVG(on, ball, artBlocks([R.slot]) + artPath(runPath('z', dir), colOf('RB', R.slot)) + artPath(artRoute(R.slot, R.route), RC.key), true,
    artLabels(on.who, [R.slot, 'RB'], R.slot, P), P);
}
function trickArt(ball, play, on) {
  const W1 = OFF_POS.WR1, rb = OFF_POS.RB, key = TRICK_KEY[play], c = slot => colOf(slot, key);
  if (play === 'r') return artSVG(on, ball, artBlocks(['WR1']) + artPath([rb, [MID + 5, -4.8], [MID + 9, -5.6]], c('RB'), {end: 'none'})
    + artPath([W1, [MID + 4, -2.6], [MID + 9.5, -6], [MID - 6, -7.4], [MID - 14, -2.5], [MID - 17, 12]], c('WR1')), true, artLabels(on.who, ['WR1', 'RB'], key));
  if (play === 'h') return artSVG(on, ball, artPath([OFF_POS.QB, [MID + 9, -5]], RC.white, {dash: true, end: 'none'})
    + artPath([rb, [MID + 9, -5], [MID + 12, -3.5]], c('RB')) + artPath(artRoute('WR1', 'go'), c('WR1'))
    + artPath(artRoute('TE', 'seam'), c('TE')) + artPath(artRoute('WR3', 'out'), c('WR3')) + artPath(artRoute('WR2', 'go'), c('WR2')), false,
    artLabels(on.who, E.TARGETS, key));
  return artSVG(on, ball, artPath([rb, [MID + 2, -2]], c('RB'), {end: 'none'}) + artPath([[MID + 2, -2], [MID - 0.5, -7.5]], RC.white, {dash: true, end: 'none'})
    + artPath(artRoute('WR2', 'go'), c('WR2')) + artPath(artRoute('WR3', 'seam'), c('WR3')) + artPath(artRoute('TE', 'out'), c('TE'))
    + artPath(artRoute('WR1', 'go'), c('WR1')), false, artLabels(on.who, E.TARGETS, key));
}
const headUrl = (e, w) => `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${String(e || '').replace(/[^0-9]/g, '')}.png&w=${w}&h=${Math.round(w * 436 / 600)}`;
/** A player's headshot over his number on his team's colour (the number shows when the photo can't load). */
function faceHTML(p, team) {
  const [c, acc] = tcol(team);
  return `<span class="dr-face" style="--tc:${esc(c)};--ta:${esc(acc)}" aria-hidden="true"><i>${p.j == null ? '' : p.j}</i>`
    + (p.e ? `<span style="background-image:url(${esc(headUrl(p.e, 160))})"></span>` : '') + `</span>`;
}
/** How a play has gone for you this game: {calls, yds}. match: the plays it counts. */
function usage(s, match) {
  const list = s.plays.filter(p => p.poss === 'us' && p.a && match(p));
  const yds = list.reduce((t, p) => t + (['catch', 'run', 'sack'].includes(p.kind) || p.two ? (p.gain || 0) : 0), 0);
  return {calls: list.length, yds: list.length ? yds / list.length : 0};
}
/** A play card. go: the action it calls; else pick: the pass play it selects. key: the player on it (none: no
 *  player). form: the formation over its name; sub: a line under the header; foot: the footer (else how the play has
 *  gone: use). */
function cardHTML(st, {i, art, name, tag, key, use, go, pick, on, label, form = FORMATION, sub = '', foot = null, vs = ''}) {
  const s = st.s, p = key ? s.mine.by[key] : null;
  const at = go ? `data-dr-go="${go}"` : `data-dr-card="${pick}" aria-pressed="${!!on}"`;
  return `<button type="button" class="dr-card${on ? ' is-on' : ''}" ${at} aria-label="${esc(label || name)}">`
    + `<span class="dr-card-h"><span class="dr-card-tt"><small><span class="dr-card-tag is-${tag.toLowerCase()}">${esc(tag)}</span>${esc(form)}</small><b>${esc(name)}</b></span>`
    + (p ? `<span class="dr-card-p">${faceHTML(p, s.sc.o)}<small>${esc(dr.short(p.n))}</small></span>` : '') + `</span>`
    + (sub ? `<span class="dr-card-d">${esc(sub)}</span>` : '')
    + `<span class="dr-card-art">${art}</span>`
    + `<span class="dr-card-f">${vs ? `<span class="dr-card-vs">${esc(vs)}</span>` : ''}<span>${esc(foot || `${use.calls} ${use.calls === 1 ? 'call' : 'calls'} | ${use.yds.toFixed(1)} avg yds`)}</span></span></button>`;
}
/** The snap's three pass plays; the picked one drawn with its routes as they stand (audibles and all), marked so. */
function passCardsHTML(st) {
  const s = st.s, field = artOn(s);
  return (s.book || []).map((k, i) => {
    const P = E.PASS_PLAYS[k], key = PASS_KEY[k];
    const rs = st.card === i ? Object.assign({}, P.routes, st.routes) : P.routes;
    const aud = E.TARGETS.some(slot => rs[slot] !== P.routes[slot]);
    const label = `${P.name}${aud ? ' (audibled)' : ''}, for ${s.mine.by[key].n}: ${E.TARGETS.map(slot => `${dr.lastName(s.mine.by[slot].n)} ${E.ROUTES[rs[slot]].name.toLowerCase()}`).join(', ')}`;
    return cardHTML(st, {i, art: passArt(s.ball, rs, key, field), name: P.name, tag: 'Pass', key, use: usage(s, p => p.pp === k), pick: i, on: st.card === i, label, vs: field.vs,
      form: aud ? `${FORMATION} · Audible` : FORMATION});
  }).join('');
}
function runCardsHTML(st) {
  const s = st.s, kind = st.panel, rpo = kind === 'rpo', book = rpo ? E.RPOS : E.RUNS, mk = rpo ? E.tok.rpo : E.tok.run;
  const side = st.side === 'w' ? 'weak' : 'strong';
  const field = artOn(s);
  return Object.keys(book).map((k, i) => cardHTML(st, {i, art: rpo ? rpoArt(s.ball, k, st.side, field) : runArt(s.ball, k, st.side, field), name: book[k].name,
    tag: rpo ? 'RPO' : 'Run', key: rpo ? RPO_KEY(k) : 'RB', use: usage(s, p => p.a.kind === kind && p.a.play === k), vs: field.vs,
    go: mk(st.side, st.runOob, k, hurryOn(st)), label: `${book[k].name} to the ${side} side: ${book[k].what}`})).join('');
}
function trickCardsHTML(st) {
  const s = st.s;
  const field = artOn(s);
  return Object.keys(E.TRICKS).map((k, i) => cardHTML(st, {i, art: trickArt(s.ball, k, field), name: E.TRICKS[k].name, tag: 'Trick', key: TRICK_KEY[k],
    use: usage(s, p => p.a.kind === 'trick' && p.a.play === k), go: E.tok.tricks(k), label: `${E.TRICKS[k].name}: ${E.TRICKS[k].what}`, vs: field.vs})).join('');
}

// ---------------------------------------------------------------------------- Defense cards
// Madden's defensive play art: their formation as rings (the line as squares), your eleven as triangles where the call
// lines them up, and what each one does: a zone (a bubble: deep blue, hook yellow, flat light blue, curl-flat
// purple), a man (an orange line to him), a rush (a white arrow) or a blitz (a red one).
const ZONE = {deep: ['#3B82F6', 'Deep zone'], hook: ['#FACC15', 'Hook zone'], flat: ['#22D3EE', 'Flat zone'], cf: ['#A855F7', 'Curl-flat zone']};
const MAN_C = '#FB923C', BLITZ_C = '#FF4D5E';
/** Each call's tag on its card: its type on the switch. */
const DEF_TAG = Object.fromEntries(DEF_TYPES.flatMap(([, l, calls]) => calls.map(k => [k, l])));
/** What each of your defenders does on a call: {slot: {zone: [kind, x, depth]} | {man: slot} | {rush: true, blitz}}.
 *  P: where the call lines them up (defPos); U: your units (who's on the front, who the linebackers are). */
function defRoles(U, P, O, call) {
  const on = k => !!P[k], R = {}, W = WIDTH;
  const front = U.front.filter(on), lbs = U.lbs.filter(on);
  const byX = list => list.filter(on).sort((a, b) => P[a][0] - P[b][0]);
  const rush = (list, blitz = false) => list.forEach(k => { if (on(k)) R[k] = {rush: true, blitz}; });
  const zone = (k, kind, x, y) => { if (on(k)) R[k] = {zone: [kind, x, y]}; };
  const man = (k, who) => { if (on(k)) R[k] = {man: who}; };
  const spread = (list, kind, x0, x1, y) => byX(list).forEach((k, i, a) => zone(k, kind, a.length === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (a.length - 1), y));
  /** The two curl-flats: the one lined up further left takes the left. Both on one side: the outside one takes that
   *  side's, the inside one a hook toward the other. */
  const curlFlats = (a, b, y) => {
    const [l, r] = byX([a, b]);
    if (!l || !r) { [l, r].filter(Boolean).forEach(k => zone(k, 'cf', P[k][0] < MID ? 12 : W - 12, y)); return; }
    if (P[r][0] < MID) { zone(l, 'cf', 12, y); zone(r, 'hook', MID + 5, y + 1); }
    else if (P[l][0] > MID) { zone(r, 'cf', W - 12, y); zone(l, 'hook', MID - 5, y + 1); }
    else { zone(l, 'cf', 12, y); zone(r, 'cf', W - 12, y); }
  };
  /** Man across: corners on the outside receivers, the nickel on the slot, the strong safety on the tight end, and
   *  the nearest linebackers on the back (and on the slot when there's no nickel). */
  const manUp = () => {
    man('LCB', 'WR1'); man('RCB', 'WR2'); man('SS', 'TE');
    if (on('NB')) man('NB', 'WR3');
    const free = lbs.slice();
    (on('NB') ? ['RB'] : ['WR3', 'RB']).sort((a, b) => O[a][0] - O[b][0]).forEach(t => {
      if (!free.length) return;
      free.sort((a, b) => Math.abs(P[a][0] - O[t][0]) - Math.abs(P[b][0] - O[t][0]));
      man(free.shift(), t);
    });
  };
  if (call === 'c2') {
    rush(front); zone('FS', 'deep', MID - 12, 16); zone('SS', 'deep', MID + 12, 16);
    zone('LCB', 'flat', 6, 4); zone('RCB', 'flat', W - 6, 4); spread(lbs.concat('NB'), 'hook', 15, W - 15, 8);
  } else if (call === 'c3') {
    rush(front); zone('LCB', 'deep', 8, 15); zone('FS', 'deep', MID, 17); zone('RCB', 'deep', W - 8, 15);
    curlFlats('NB', 'SS', 7); spread(lbs, 'hook', MID - 6, MID + 6, 8);
  } else if (call === 'c4') {
    rush(front); zone('LCB', 'deep', 7, 14); zone('FS', 'deep', MID - 7, 16); zone('SS', 'deep', MID + 7, 16); zone('RCB', 'deep', W - 7, 14);
    zone('NB', 'cf', 11, 6); spread(lbs, 'hook', MID - 7, MID + 7, 7);
  } else if (call === 'c1') {
    rush(front); zone('FS', 'deep', MID, 17); manUp();
    spread(lbs.filter(k => !R[k]), 'hook', MID - 3, MID + 3, 6);
  } else if (call === 'c0') {
    rush(front); manUp(); rush(lbs.filter(k => !R[k]).concat('FS'), true);
  } else if (call === 'fire') {
    // The zone blitz: an end drops into a hook, the linebackers come, three deep behind them.
    rush(front.slice(1)); rush(lbs, true); zone(front[0], 'hook', MID - 8, 6);
    zone('LCB', 'deep', 8, 13); zone('FS', 'deep', MID, 15); zone('RCB', 'deep', W - 8, 13); curlFlats('NB', 'SS', 6);
  } else if (call === 'rb') {
    rush(front); rush(lbs, true); rush(['SS'], true); zone('FS', 'deep', MID, 15); man('LCB', 'WR1'); man('RCB', 'WR2');
  } else {
    // Prevent: three rush (anyone the call stands up off the line drops), four deep, the rest underneath.
    const line = front.filter(k => P[k][1] <= 3);
    rush(line);
    zone('LCB', 'deep', 9, 19); zone('FS', 'deep', MID - 6, 21); zone('SS', 'deep', MID + 6, 21); zone('RCB', 'deep', W - 9, 19);
    spread(front.filter(k => !line.includes(k)).concat(lbs, 'NB'), 'hook', 9, W - 9, 11);
  }
  return R;
}
/** The play art for a defensive call, against their formation as it lines up now. */
function defArt(st, call) {
  const s = st.s, U = s.mine, look = CALL_LOOK[call];
  const P = defPos(U.T, look, s.shade), O = offPos(s.form), R = defRoles(U, P, O, call);
  // Near the goal line the deep players squeeze in (as on the field: spots), and so do the zones.
  const room = 110 - s.ball, sq = Math.max(0.35, Math.min(1, (108 - s.ball) / 21));
  const depth = y => (y > 2.5 ? 2.5 + (y - 2.5) * sq : y);
  const at = k => [P[k][0], depth(P[k][1])];
  const deeps = Object.values(R).filter(r => r.zone && r.zone[0] === 'deep').length;
  const size = {deep: [deeps <= 1 ? 13 : deeps === 2 ? 11.5 : deeps === 3 ? 8.2 : 6.4, 3.4], hook: [4.2, 2.4], flat: [4.6, 2.2], cf: [5, 2.5]};
  let zones = '', lines = '';
  Object.keys(R).forEach(k => {
    const r = R[k], [x, y] = at(k);
    if (r.zone) {
      const [kind, zx, zy0] = r.zone, [rx, ry] = size[kind], col = ZONE[kind][0];
      const zy = Math.max(ry + 0.5, Math.min(depth(zy0), Math.min(ART.hi, room) - ry - 0.8));
      zones += `<ellipse cx="${f2(zx)}" cy="${f2(ARTY(zy))}" rx="${f2(rx)}" ry="${f2(ry * ART.k)}" fill="${col}" fill-opacity=".42" stroke="${col}" stroke-width=".35"/>`;
      lines += artPath([[x, y], [zx, zy]], col, {end: 'none'});
    } else if (r.man) {
      const [mx, my] = O[r.man];
      lines += artPath([[x, y], [mx + (x - mx) * 0.12, my + 1.2]], MAN_C, {end: 'none'}) + `<circle cx="${f2(mx)}" cy="${f2(ARTY(my + 1.2))}" r=".55" fill="${MAN_C}"/>`;
    } else if (r.rush) {
      // A blitz shoots its gap: in toward the ball, then straight into the backfield.
      lines += r.blitz ? artPath([[x, y], [x + (MID - x) * 0.25, 0.3], [x + (MID - x) * 0.32, -3.4]], BLITZ_C) : artPath([[x, y], [x + (MID - x) * 0.12, -0.9]], RC.white);
    }
  });
  // Them: rings, the line as squares.
  let them = '';
  Object.keys(O).forEach(k => {
    const [x, y] = O[k], Y = ARTY(Math.max(ART.lo + 1.3, y));
    them += OL.includes(k) ? `<rect x="${f2(x - 0.85)}" y="${f2(Y - 0.85)}" width="1.7" height="1.7" rx="${k === 'C' ? 0.15 : 0.85}" fill="none" stroke="rgba(255,255,255,.62)" stroke-width=".38"/>`
      : `<circle cx="${f2(x)}" cy="${f2(Y)}" r=".95" fill="none" stroke="rgba(255,255,255,.62)" stroke-width=".38"/>`;
  });
  // You: a triangle each, pointing at the ball.
  const you = Object.keys(P).filter(k => P[k]).map(k => {
    const [x, y] = at(k), Y = ARTY(y);
    return `<polygon points="${f2(x - 1.05)},${f2(Y - 0.75)} ${f2(x + 1.05)},${f2(Y - 0.75)} ${f2(x)},${f2(Y + 1)}" fill="#fff"/>`;
  }).join('');
  return `<svg class="dr-art" viewBox="0 0 ${WIDTH} ${f2(ART_H)}" aria-hidden="true">${artField(s.ball)}${zones}${lines}${them}${you}</svg>`;
}
/** Your personnel for a call: base against the loaded box, nickel otherwise. */
const defForm = (T, call) => (CALL_LOOK[call] === 'box' ? `${T.s === '34' ? '3-4' : '4-3'} Base` : `Nickel ${T.s === '34' ? '3-3-5' : '4-2-5'}`);
function defCardsHTML(st, calls) {
  const s = st.s, U = s.mine;
  return calls.map((k, i) => {
    const C = E.CALLS[k], list = s.plays.filter(p => p.poss === 'them' && p.dcall === k && p.act);
    const yds = list.reduce((t, p) => t + (['catch', 'run', 'sack'].includes(p.kind) ? (p.gain || 0) : 0), 0);
    const foot = `${list.length} ${list.length === 1 ? 'call' : 'calls'} | ${(list.length ? yds / list.length : 0).toFixed(1)} avg yds allowed`;
    return cardHTML(st, {i, art: defArt(st, k), name: C.name, tag: DEF_TAG[k], key: null, form: defForm(U.T, k), sub: C.short, foot,
      go: E.tok.def(k), label: `${C.name}: ${C.what}. ${foot}.`});
  }).join('');
}
const legendDefHTML = () => `<p class="dr-dlegend" aria-hidden="true">${Object.values(ZONE).map(([c, t]) => `<span><i style="--c:${c}"></i>${t}</span>`).join('')}`
  + `<span><i class="is-line" style="--c:${MAN_C}"></i>Man</span><span><i class="is-line" style="--c:${BLITZ_C}"></i>Blitz</span></p>`;

const FLAG_INFO = [['a', 'Play action'], ['r', 'Roll out'], ['o', 'Out of bounds']];
/** The pass play's target (its card's player), or null. */
const keyOf = st => (st.s.book && st.s.book[st.card] ? PASS_KEY[st.s.book[st.card]] : null);
/** The route the picked pass play gives a receiver (his audible changes it), or null. */
const calledRoute = (st, slot) => (st.s.book && st.s.book[st.card] ? E.PASS_PLAYS[st.s.book[st.card]].routes[slot] : null);
/** A receiver's route as a drop-down: his pill (the route he runs, its colour on the card), and when open
 *  (st.rtOpen) the other routes he can run straight down from it, how deep each goes, the play's own marked. A route
 *  changed from the play's call turns the pill to the tint. */
function routeMenuHTML(st, slot) {
  const p = st.s.mine.by[slot], route = st.routes[slot], call = calledRoute(st, slot), aud = !!call && route !== call, open = st.rtOpen === slot;
  const opt = r => `<li class="dr-ropt" role="option" tabindex="-1" aria-selected="false" data-dr-ropt="${r}"><span>${esc(E.ROUTES[r].name)}${r === call ? '<em>Call</em>' : ''}</span><small>${E.ROUTES[r].depth} yds</small></li>`;
  return `<span class="dr-rt${open ? ' is-open' : ''}" data-dr-rt="${slot}">`
    + `<button type="button" class="dr-rcv-rt${aud ? ' is-aud' : ''}" data-dr-rtbtn="${slot}" aria-haspopup="listbox" aria-expanded="${open}" aria-label="${esc(`${p.n}'s route: ${E.ROUTES[route].name}${aud ? ' (an audible)' : ''}. Change it.`)}">`
    + `<i class="dr-rcv-c" style="--c:${colOf(slot, keyOf(st))}" aria-hidden="true"></i><span class="dr-rcv-rn">${esc(E.ROUTES[route].name)}</span>${ui.icon('chevron-down', {size: 12})}</button>`
    + (open ? `<ul class="dr-rlist" role="listbox" aria-label="${esc(`${p.n}'s other routes`)}">${E.ROUTES_FOR[slot].filter(r => r !== route).map(opt).join('')}</ul>` : '')
    + `</span>`;
}
/** A receiver to throw to, on one line: his position (coloured by his rating), his name, his route's menu. */
function receiverRowHTML(st, slot) {
  const s = st.s, p = s.mine.by[slot], route = st.routes[slot], key = slot === keyOf(st);
  return `<li class="dr-rcv${key ? ' is-key' : ''}${st.rtOpen === slot ? ' is-open' : ''}" data-dr-rcvrow="${slot}"><button type="button" class="dr-rcv-go" data-dr-go="${E.tok.pass(slot, route, Object.assign({}, st.flags, {c: st.card, h: hurryOn(st)}))}" aria-label="${esc(`${key ? 'The target. ' : ''}Throw to ${p.n}, ${E.ROUTES[route].name}`)}">`
    + `<span class="dr-rcv-pos" style="--rc:${ratingColor(p.r)}">${esc(dr.posOf(slot))}</span>`
    + `<span class="dr-rcv-id">${key ? '<span class="dr-rcv-tag">Target</span>' : ''}<b>${esc(dr.short(p.n))}</b></span></button>`
    + routeMenuHTML(st, slot) + `</li>`;
}
/** The receivers to throw to, the play's target first. */
const rowsHTML = st => { const key = keyOf(st); return (key ? [key] : []).concat(E.TARGETS.filter(k => k !== key)).map(k => receiverRowHTML(st, k)).join(''); };
// What each play type opens under the switch.
function passBody(st) {
  const chips = FLAG_INFO.map(([k, l]) => `<button type="button" class="dr-toggle" data-dr-flag="${k}" aria-pressed="${!!st.flags[k]}">${esc(l)}</button>`).join('') + hurryHTML(st, 'dr-toggle');
  return `<div class="dr-cards" role="group" aria-label="Pass plays" data-dr-cards>${passCardsHTML(st)}</div>`
    + `<ol class="dr-rcvs" data-dr-rcvs>${rowsHTML(st)}</ol>`
    + `<div class="dr-flags" role="group" aria-label="Options">${chips}</div>`
    + `<p class="dr-hint">Pick a play and it goes to its target; throw to him or anyone else. Audible a receiver from his route's menu, or tap him on the field for his next route.</p>`;
}
function runBody(st, kind) {
  const s = st.s;
  const sides = [['w', '◀ Weak side'], ['s', 'Strong side ▶']].map(([d, l]) => `<button type="button" class="dr-side" data-dr-side="${d}" aria-pressed="${st.side === d}">${l}</button>`).join('');
  const hint = `Their front leans to the ${s.shade === 's' ? 'strong' : 'weak'} side.${kind === 'rpo' ? ' Your QB reads the box: crowded, he throws it; light, he hands it off.' : ''}`;
  return `<div class="dr-sides" role="group" aria-label="Which side">${sides}</div><p class="dr-hint">${esc(hint)}</p>`
    + (hurryHTML(st) ? `<div class="dr-flags">${hurryHTML(st, 'dr-toggle')}</div>` : '')
    + `<div class="dr-cards" role="group" aria-label="${kind === 'run' ? 'Runs' : 'RPOs'}" data-dr-cards>${runCardsHTML(st)}</div>`
    + `<div class="dr-oob"><span class="dr-oob-tx"><b>Get out of bounds</b><small>The ball carrier tries to stop the clock. No guarantee.</small></span>${ui.switchCtl({name: 'dr-oob', checked: st.runOob, label: 'Get out of bounds'})}</div>`;
}
function trickBody(st) {
  return `<p class="dr-hint">One a game. Each fools a different defense: the aggressive ones bite.</p>`
    + `<div class="dr-cards" role="group" aria-label="Trick plays" data-dr-cards>${trickCardsHTML(st)}</div>`;
}
function snapHTML() {
  return `<section class="dr-snap" aria-live="polite"><p class="dr-snap-t"><i class="dr-dot"></i>Live</p><p class="dr-snap-s">Tap the field to skip</p></section>`;
}
function panelHTML(st) {
  const s = st.s;
  if (st.busy) return snapHTML();
  const bd = st.last ? breakdownHTML(st) : '';
  // What's next first (the final, your defense, your call), the last play's breakdown under it.
  if (s.result) return resultHTML(st) + bd;
  if (s.poss === 'them' && s.phase !== 'pat') return defenseHTML(st) + bd;
  return callHTML(st) + bd;
}

// ---------------------------------------------------------------------------- The breakdown of the last snap
function breakdownHTML(st) {
  const L = st.last, s = st.s, p = L.p;
  const autos = L.autos.length ? `<ul class="dr-bd-auto">${L.autos.map(x => `<li>${esc(dr.playText(s, x).line)}</li>`).join('')}</ul>` : '';
  if (p.kind === 'timeout') return `<section class="dr-bd is-mini" data-dr-bd aria-label="Last play"><p class="dr-bd-k">Last play</p><p class="dr-bd-line">${esc(dr.playText(s, p).line)}</p>${autos}</section>`;
  const t = dr.playText(s, p);
  const ready = L.wpA != null && L.wpB != null;
  const delta = ready ? Math.round((L.wpA - L.wpB) * 100) : null;
  const badge = delta == null ? `<span class="dr-bd-d is-wait"><span class="spin" aria-hidden="true"></span></span>`
    : `<span class="dr-bd-d ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-even'}" aria-label="${esc(`Win chance ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} points`)}">${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)}</span>`;
  const wp = ready ? `<p class="dr-bd-wp">Win chance <b>${pct(L.wpB)}</b> → <b>${pct(L.wpA)}</b></p>` : `<p class="dr-bd-wp">Working out the win chance…</p>`;
  const ct = dr.callText(s, p);
  const call = ct ? `<p class="dr-bd-call ${ct.good ? 'is-good' : 'is-bad'}">${esc(ct.text)}</p>` : '';
  let grade = '', opts = '';
  if (L.call) {
    grade = L.call.score >= 98
      ? `<p class="dr-bd-grade is-best">${ui.icon('check-circle', {size: 16})}<span>Call score <b>${L.call.score}</b>: the best call there.</span></p>`
      : `<p class="dr-bd-grade">${ui.icon('info', {size: 16})}<span>${esc(`Call score ${L.call.score}. The best call there: ${dr.tokenShort(s, L.call.best)}.`)}</span></p>`;
  }
  if (L.scores) {
    const i = L.scores.findIndex(x => x.token === p.act), best = L.scores[0];
    const mine = i >= 0 ? L.scores[i] : null;
    const isBest = mine && best && mine.wp >= best.wp - 0.015;
    const rank = mine ? 1 + L.scores.filter(x => x.wp > mine.wp + 0.015).length : 0;
    if (!L.call) grade = isBest
      ? `<p class="dr-bd-grade is-best">${ui.icon('check-circle', {size: 16})}<span>Your call: <b>the best one.</b></span></p>`
      : mine ? `<p class="dr-bd-grade">${ui.icon('info', {size: 16})}<span>${esc(`Your call: ${ui.ordinal(rank)} of ${L.scores.length}. Best: ${dr.tokenShort(s, best.token)} (${pct(best.wp)}).`)}</span></p>` : '';
    opts = `<details class="dr-bd-opts"><summary>How the options played out</summary><ol>${L.scores.map(x => `<li class="${x.token === p.act ? 'is-mine' : ''}"><span>${esc(dr.tokenShort(s, x.token))}${x.token === p.act ? ' · yours' : ''}</span><i style="--w:${Math.round(x.wp * 100)}%"></i><b>${pct(x.wp)}</b></li>`).join('')}</ol>`
      + `<p class="dr-bd-note">Each option played out ${L.n} times from that snap to the end of the game by a good play-caller on both sides. Win chance counts a tie as half.</p></details>`;
  } else if (L.scoring && !L.call) grade = `<p class="dr-bd-grade is-wait"><span class="spin" aria-hidden="true"></span><span>Scoring every option…</span></p>`;
  const replay = L.canReplay ? `<button type="button" class="dr-pill" data-dr-replay>${ui.icon('play-fill', {size: 12})}<span>Replay</span></button>` : '';
  return `<section class="dr-bd is-${t.tone}" data-dr-bd aria-label="Last play"><p class="dr-bd-k">Last play</p>`
    + `<div class="dr-bd-top">${badge}<div class="dr-bd-main"><h3 class="dr-bd-h">${esc(t.head)}</h3><p class="dr-bd-line">${esc(t.line)}</p>${wp}</div></div>`
    + autos + call + grade + `<div class="dr-bd-act">${replay}${opts}</div></section>`;
}

const TONE_IC = {good: 'arrow-up', bad: 'arrow-down', score: 'trophy', flat: 'chevron-right'};
function logItemHTML(s, p) {
  const t = dr.playText(s, p);
  const team = E.idsFor(s, p.poss || 'us').o;
  const pre = p.kind === 'timeout' ? `Timeout · ${dr.clockText(p.clock)}` : p.kind === 'xp' ? 'After the touchdown' : p.two ? 'Two-point try'
    : p.auto ? `${team} · ${dr.clockText(p.clock)}` : `${team} · ${dr.downText(p.down, p.togo, p.ball)} · ${dr.spot(s, p.ball, p.poss)} · ${dr.clockText(p.clock)}`;
  let what = '';
  if (p.poss === 'them' && p.dcall) what = `Your call: ${E.CALLS[p.dcall].name}${E.FORMS[p.form] ? ` vs ${E.FORMS[p.form].name.toLowerCase()}` : ''}`;
  else if (p.act && p.kind !== 'timeout') what = dr.tokenLabel(s, p.act, p) + (p.look && !['timeout', 'kick', 'spike', 'fg', 'kneel'].includes(p.call) ? ` vs ${E.LOOKS[p.look].name.toLowerCase()}` : '');
  return `<li class="dr-lg is-${t.tone}${p.poss === 'them' ? ' is-them' : ''}"><span class="dr-lg-ic" aria-hidden="true">${ui.icon(TONE_IC[t.tone] || 'chevron-right', {size: 14})}</span>`
    + `<span class="dr-lg-b"><small class="dr-lg-pre">${esc(pre)}</small><b class="dr-lg-h">${esc(t.line)}</b>`
    + (what ? `<small class="dr-lg-sub">${esc(what)}</small>` : '') + `</span></li>`;
}
function pbpHTML(st) {
  const s = st.s;
  if (!s || !s.plays.length) return '';
  return `<details class="dr-pbp"${st.pbpOpen ? ' open' : ''} data-dr-pbp><summary>Play-by-play<span>${plural(s.plays.length, 'play')}</span></summary><ol class="dr-log">${s.plays.slice().reverse().map(p => logItemHTML(s, p)).join('')}</ol></details>`;
}
/** The final score, both teams side by side. you: the label under your team (someone else's game: their name). */
function finalSBHTML(s, you = 'You') {
  const side = us => {
    const id = us ? s.sc.o : s.sc.d, pts = us ? s.us : s.them, other = us ? s.them : s.us;
    return `<span class="dr-fsb-t${pts > other ? ' is-win' : pts < other ? ' is-lose' : ''}">${logoHTML(id, 46)}<b>${esc(id)}</b><small>${us ? esc(you) : '&nbsp;'}</small></span>`;
  };
  const sc = (pts, other) => `<span class="dr-fsb-sc${pts < other ? ' is-lose' : ''}">${pts}</span>`;
  return `<div class="dr-fsb" role="img" aria-label="${esc(`Final: ${s.sc.o} ${s.us}, ${s.sc.d} ${s.them}`)}">${side(true)}${sc(s.us, s.them)}<span class="dr-fsb-x">Final</span>${sc(s.them, s.us)}${side(false)}</div>`;
}
/** Who the game was called like: the NFL head coach whose late-game play-calling fits it best (dr.coachComp). */
function compHTML(s, who = 'you') {
  const c = dr.coachComp(s, who);
  if (!c) return '';
  return `<section class="dr-comp" aria-labelledby="dr-comp-n"><p class="dr-comp-k">${esc(who === 'you' ? 'You called this one like' : `${who} called it like`)}</p>`
    + `<h3 class="dr-comp-n" id="dr-comp-n">${logoHTML(c.team, 34)}<span>${esc(c.name)}</span></h3>`
    + `<p class="dr-comp-t">${esc(c.text)}</p>`
    + `<p class="dr-comp-f">${esc(`${c.teamName} · ${c.seasons} · from ${c.snaps} late-game snaps`)}</p></section>`;
}
/** A finished game's call grade, as the scoreboard ranks it. */
function finalGradeHTML(n, s, who = 'Your') {
  const g = dr.gradeOf(n, E.actsOf(s));
  if (g.grade == null) return '';
  return `<p class="dr-final-grade">${gradeChip(g.grade, 'dr-fg-chip')}<span>${esc(`${who} call grade, from ${plural(g.n, 'call')}: how close each was to the best one at its snap.`)}</span></p>`;
}
function resultHTML(st) {
  const s = st.s;
  if (!s.result) return '';
  const r = dr.resultText(s), practice = dr.dayState(st.n).practice;
  return `<section class="dr-final is-${s.result}" aria-labelledby="dr-res-h">`
    + `<p class="dr-final-k">${esc(`Two-Minute Drill #${st.n} · ${dr.dayLabel(st.n)}`)}</p>`
    + finalSBHTML(s)
    + `<h2 class="dr-final-h" id="dr-res-h">${esc(r.head)}</h2>`
    + `<p class="dr-final-sub">${esc(r.sub)}</p>`
    + finalGradeHTML(st.n, s)
    + `<p class="dr-res-sq" aria-hidden="true">${esc(dr.squares(s))}</p>`
    + (practice ? `<p class="dr-practice">${esc(`Practice run ${practice}: your first game today is the one on the scoreboard.`)}</p>` : '')
    + `<div class="dr-res-act"><button type="button" class="btn btn-primary dr-share" data-dr-share>${ui.icon('share')}<span class="btn-label">Share</span></button>`
    + (dr.canReplay() ? `<button type="button" class="btn btn-secondary dr-again" data-dr-again>${ui.icon('play-fill')}<span class="btn-label">Play again</span></button>` : '') + `</div>`
    + `<p class="dr-next">${ui.icon('clock', {size: 15})}<span>Next drill in <span data-dr-next>${esc(nextIn())}</span></span></p></section>`
    + compHTML(s);
}
function headHTML(st) {
  const s = st.s, sc = s.sc, n = st.n, g = sc.g;
  const where = sc.b === 50 ? 'midfield' : sc.b < 50 ? `your ${sc.b}` : `their ${100 - sc.b}`;
  return `<header class="dr-head">`
    + `<p class="dr-kick">${esc(`Two-Minute Drill #${n} · ${dr.dayLabel(n)}${dr.dayState(n).practice ? ' · Practice' : ''}`)}</p>`
    + `<h2 class="dr-title">${esc(`Down ${sc.them - sc.us}, ${dr.clockText(sc.t)} to go`)}</h2>`
    + `<p class="dr-sub">${esc(`${g ? `Week ${g.wk}: ${g.a} at ${g.h}. ` : ''}Ball on ${where}, ${plural(sc.to, 'timeout')}. Play to 0:00.`)}</p>`
    + ui.iconButton({icon: 'info', label: 'How the Two-Minute Drill works', cls: 'dr-howto', attrs: {'data-dr-help': ''}})
    + `</header>`;
}
function gameHTML(st) {
  const s = st.s;
  return headHTML(st)
    + `<div class="dr-stage">${sitHTML(s)}${fieldHTML(st)}${legendHTML()}</div>`
    + `<div class="dr-panel" data-dr-panel>${panelHTML(st)}</div>`
    + `<div data-dr-pbph>${pbpHTML(st)}</div>`;
}
function bodyHTML(st) {
  if (!dr.DOC) return loadingHTML();
  return gameHTML(st) + boardHTML(st);
}

// ============================================================================ Markup: the league's finals
function rowGame(st, r) {
  const k = `${st.n}|${r.k}`;
  if (!st.rp.has(k)) st.rp.set(k, r.k ? E.replay(dr.scenario(st.n), dr.DOC.teams, r.k) : null);
  return st.rp.get(k);
}
/** A grade as its letter and number: "A− · 91". */
const gradeText = g => (g == null ? '' : `${dr.gradeLetter(g)} · ${Math.round(g)}`);
function gradeChip(g, cls = 'dr-sb-gr') {
  return g == null ? `<span class="${cls} is-none" aria-hidden="true"><b>–</b></span>`
    : `<span class="${cls} is-${dr.gradeLetter(g)[0]}" aria-hidden="true"><b>${esc(dr.gradeLetter(g))}</b><small>${Math.round(g)}</small></span>`;
}
function sbRowHTML(st, r) {
  const g = rowGame(st, r);
  const how = g && g.result ? dr.resultText(g, {you: r.me}).sub : '';
  const sub = [how, plural(r.p, 'play')].filter(Boolean).join(' · ');
  const graded = r.grade == null ? '' : ` Call grade ${gradeText(r.grade)}.`;
  const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}: ${{W: 'won', T: 'tied', L: 'lost'}[r.r]} ${r.u} to ${r.h}.${graded} ${sub}. Show the game.`;
  return `<button type="button" class="dr-sb-row${r.me ? ' is-me' : ''}" role="listitem" data-dr-who="${esc(r.key)}" aria-label="${esc(label)}">`
    + `<span class="dr-sb-rank" aria-hidden="true">${r.rank}</span>`
    + `<span class="dr-sb-av" aria-hidden="true">${ui.nickAvatar(r.name, {size: 36, managerId: r.managerId, you: r.me, crown: r.rank === 1 && r.r === 'W'})}</span>`
    + `<span class="dr-sb-main" aria-hidden="true"><span class="dr-sb-name">${esc(r.name)}${r.me ? ui.badge('you') : ''}</span><span class="dr-sb-sub">${esc(sub)}</span></span>`
    + gradeChip(r.grade)
    + `<span class="dr-sb-res is-${r.r}" aria-hidden="true"><b>${r.r}</b><span>${r.u}–${r.h}</span></span></button>`;
}
/** The week's standings: points, the record, the average grade, a run of wins; the week's best-called game below. */
function weekBodyHTML(st) {
  const n = st.n || dr.todayNumber();
  let rows = [];
  try { rows = dr.weekRows(n); } catch (e) { console.error(e); }
  if (!rows.length) return `<div class="dr-sb-empty"><p class="dr-sb-et">No games yet this week.</p><p class="dr-sb-eb">Every final this week counts toward the standings.</p></div>`;
  const days = dr.weekDays(n).length;
  const list = rows.map(r => {
    const rec = `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
    const sub = [rec, r.avg == null ? '' : `avg ${gradeText(r.avg)}`, r.streak >= 2 ? `${r.streak} wins in a row` : ''].filter(Boolean).join(' · ');
    const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}: ${plural(r.pts, 'point')}, ${r.w} won, ${r.l} lost${r.t ? `, ${r.t} tied` : ''}${r.avg == null ? '' : `, average call grade ${gradeText(r.avg)}`}${r.streak >= 2 ? `, ${r.streak} wins in a row` : ''}.`;
    return `<div class="dr-sb-row dr-wk-row${r.me ? ' is-me' : ''}" role="listitem" aria-label="${esc(label)}">`
      + `<span class="dr-sb-rank" aria-hidden="true">${r.rank}</span>`
      + `<span class="dr-sb-av" aria-hidden="true">${ui.nickAvatar(r.name, {size: 36, managerId: r.managerId, you: r.me, crown: r.rank === 1 && r.pts > 0})}</span>`
      + `<span class="dr-sb-main" aria-hidden="true"><span class="dr-sb-name">${esc(r.name)}${r.me ? ui.badge('you') : ''}</span><span class="dr-sb-sub">${esc(sub)}</span></span>`
      + `<span class="dr-wk-pts" aria-hidden="true"><b>${r.pts}</b><small>${r.pts === 1 ? 'pt' : 'pts'}</small></span></div>`;
  }).join('');
  const t = rows.top;
  const top = t ? `<p class="dr-wk-top">${ui.icon('trophy', {size: 15})}<span>${esc(`Best-called game: ${t.me ? 'your' : `${t.name}’s`} ${t.u}–${t.h} ${{W: 'win', T: 'tie', L: 'loss'}[t.r]} on ${dr.dayLabel(t.day, {weekday: 'short'})}, ${gradeText(t.grade)}`)}</span></p>` : '';
  return `<p class="dr-sb-sum">${esc(`${plural(days, 'day')} played · 3 points a win, 1 a tie`)}</p>`
    + `<div class="dr-sb-list" role="list" aria-label="${esc(`${dr.weekLabel(n)} standings`)}">${list}</div>${top}`;
}
/** The board: today's finals or the week's standings (st.sbTab), the switch between them on top. */
function sbBodyHTML(st) {
  const week = st.sbTab === 'week', n = st.n || dr.todayNumber();
  const tab = (k, label) => `<button type="button" class="dr-sb-tab" role="tab" aria-selected="${st.sbTab === k || (!st.sbTab && k === 'day')}" data-dr-sbtab="${k}">${esc(label)}</button>`;
  const head = `<div class="dr-board-h"><div class="dr-board-row"><h2 class="dr-board-t" id="dr-sb-t">${esc(week ? `${dr.weekLabel(n)} standings` : 'Today’s finals')}</h2>`
    + `<div class="dr-sb-tabs" role="tablist" aria-label="Scoreboard">${tab('day', 'Today')}${tab('week', 'Week')}</div></div>`
    + `<p class="dr-board-s">${esc(week ? 'Most points first; the average call grade breaks a tie' : 'Wins first, then the best-called games')}</p></div>`;
  const state = dr.boardState();
  if (state === 'loading') return head + `<div class="dr-sb-sk">${ui.skeleton('rows', 3, {label: 'Loading the finals.'})}</div>`;
  if (state !== 'ready') return head + `<p class="dr-sb-note">The scoreboard isn't connected right now.</p>`;
  if (week) return head + weekBodyHTML(st);
  let rows = [];
  try { rows = dr.boardRows(n); } catch (e) { console.error(e); }
  if (!rows.length) return head + `<div class="dr-sb-empty"><p class="dr-sb-et">No finals yet today.</p><p class="dr-sb-eb">Play yours to put the first score on the board.</p></div>`;
  const w = rows.filter(r => r.r === 'W').length;
  const sum = `${plural(rows.length, 'game')} final · ${w} won`;
  return head + `<p class="dr-sb-sum">${esc(sum)}</p><div class="dr-sb-list" role="list" aria-label="Today's finals">${rows.map(r => sbRowHTML(st, r)).join('')}</div>`
    + `<p class="dr-sb-foot">Call grade: how close each pass, run and defensive call was to the best one at that snap, out of 100. A win never grades below a C−.</p>`;
}
function boardHTML(st) {
  const hide = dr.boardState() === 'wait';
  return `<div class="dr-sb-host" data-dr-board${hide ? ' hidden' : ''}><section class="dr-board" aria-labelledby="dr-sb-t">`
    + `<div class="dr-board-body" data-dr-sbody>${sbBodyHTML(st)}</div></section></div>`;
}
const norm = typeof document !== 'undefined' ? document.createElement('template') : null;
function patchBoard(st, {fade = false} = {}) {
  if (st.dead || !dr.DOC) return;
  const host = st.el.querySelector('[data-dr-board]');
  if (!host) return;
  host.hidden = dr.boardState() === 'wait';
  const body = host.querySelector('[data-dr-sbody]');
  if (!body) return;
  const html = sbBodyHTML(st);
  norm.innerHTML = html;
  if (body.innerHTML === norm.innerHTML) return;
  const go2 = () => { body.innerHTML = html; ui.hydrate(body); };
  if (fade && !ui.RM && st.ctx.visible) ui.crossfade(body, go2, {duration: 160}); else go2();
}
function scheduleBoard(st) {
  if (st.dead) return;
  if (st.cancelBoard) st.cancelBoard();
  st.cancelBoard = ui.whenIdle(() => { st.cancelBoard = null; patchBoard(st); warmWeek(st); });
}
/** Grades the week's games (about 6 ms each) a slice at a time while nothing moves, so the Week tab opens at once. */
function warmWeek(st) {
  if (st.dead || st.cancelBoard || !dr.DOC || dr.boardState() !== 'ready') return;
  const todo = dr.ungraded(st.n || dr.todayNumber());
  if (!todo.length) return;
  st.cancelBoard = ui.whenIdle(() => {
    st.cancelBoard = null;
    const t0 = performance.now();
    while (todo.length && performance.now() - t0 < 12) dr.gradeOf(...todo.shift());
    warmWeek(st);
  });
}

// ============================================================================ Sheets
/** Someone's game today: hidden until this phone has finished its own. */
function openGame(st, key) {
  const row = dr.boardRows(st.n).find(r => r.key === key);
  if (!row) return;
  const mine = dr.dayState(st.n);
  let body;
  if (!row.me && !mine.result) {
    body = `<p class="dr-sh-note">${ui.icon('lock', {size: 16})}<span>${esc(`Finish today’s drill to watch ${row.name}’s game.`)}</span></p>`;
  } else {
    const g = dr.gameOf(key, st.n);
    if (!g || !g.s) body = `<p class="dr-sh-note">${ui.icon('info', {size: 16})}<span>That game didn’t come with its plays.</span></p>`;
    else {
      const r = dr.resultText(g.s, {you: row.me});
      body = `<div class="dr-sh-final is-${g.s.result}">${finalSBHTML(g.s, row.me ? 'You' : row.name)}<p class="dr-sh-h"><b>${esc(r.head)}</b><span>${esc(r.sub)}</span></p>${finalGradeHTML(st.n, g.s, row.me ? 'Your' : `${row.name}’s`)}</div>`
        + compHTML(g.s, row.me ? 'you' : row.name)
        + `<ol class="dr-log">${g.s.plays.map(p => logItemHTML(g.s, p)).join('')}</ol>`;
    }
  }
  ui.haptic('light');
  ui.openSheet({title: row.me ? 'Your game' : `${row.name}’s game`, body: `<div class="dr-sheet">${body}</div>`, detents: ['medium', 'large'], cls: 'sh-drill'});
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
  const U = E.unitsFor(s, s.poss), ids = E.idsFor(s, s.poss);
  const O = dr.team(ids.o), D = dr.team(ids.d);
  const off = O.o.map(r => U.o.by[r[0]]);
  const def = D.d.map(r => U.d.by[r[0]]);
  const edge = D.s === '34' ? {WLB: 'OLB', SLB: 'OLB'} : {};
  const whose = side => ((side === 'o') === (s.poss === 'us') ? 'Your' : 'Their');
  const body = `<div class="dr-sheet dr-rts">`
    + `<p class="dr-rt-intro">${esc(`Each starter’s rank at his spot across the league, from his 2025 season and 2026 so far (55 to 99). Depth charts as of ${asofText()}.`)}</p>`
    + `<h3 class="dr-rt-h">${esc(`${whose('o')} offense · ${O.city} ${O.n}`)}</h3><ol class="dr-rt-l">${off.map(p => ratingRowHTML(p, dr.posOf(p.slot))).join('')}${ratingRowHTML(U.o.k, 'K')}</ol>`
    + `<h3 class="dr-rt-h">${esc(`${whose('d')} defense · ${D.city} ${D.n}`)}</h3><ol class="dr-rt-l">${def.map(p => ratingRowHTML(p, edge[p.slot] || DEF_POS[p.slot] || p.slot)).join('')}</ol>`
    + `</div>`;
  ui.haptic('light');
  ui.openSheet({title: 'Player ratings', body, detents: ['large'], cls: 'sh-drill'});
}
function openHelp() {
  const body = `<div class="dr-help">`
    + `<p><b>You’re down late, and you have the ball.</b> One game a day, the same for everyone, from a real matchup on this week’s NFL slate with each team’s current starters. The game runs to 0:00 and the final score is the result: a win, a tie (overtime) or a loss. Every call counts as soon as you make it: there are no do-overs.</p>`
    + `<p><b>Score too early and they get it back.</b> After your score they get the ball at their 25 and you call the defense. They can answer, and if there’s time you get it back. Lead with the ball late and you can take a knee to end it.</p>`
    + `<p><b>Read the defense.</b> Before each snap the defense shows a look, and at the snap it plays a real call that look usually hides. A <b>light box</b> is mostly two- and four-deep zones: deep shots and outs get eaten, the middle opens up. A <b>loaded box</b> is a run blitz or man to man: don’t run into it, and play action fools it. A <b>blitz look</b> means pressure: get it out quick. A <b>two-high shell</b> takes away the deep ball and the sideline. <b>Prevent</b> gives up the short stuff and keeps the clock running. The line on the field leans to one side: run away from it.</p>`
    + `<p><b>Call a play.</b> Like a playbook: pick Run, Pass, RPO or Trick play, then one of its three plays. Runs: <b>Inside Zone</b> (steady), <b>HB Toss</b> (outside: boom or bust, and the best way to the sideline) and <b>HB Draw</b> (eats up a blitz or a soft prevent, dies against a run blitz), to the strong or weak side. RPOs hand it off against a light box and throw it against a crowded one: a slant, a bubble or a seam. Trick plays (one a game): the <b>Flea Flicker</b> and the <b>HB Pass</b> go deep, the <b>Double Reverse</b> is a run the other way, with no interception risk.</p>`
    + `<p><b>Passing.</b> Each snap offers three pass plays; pick one and its routes go up on the field (tap a receiver there to change his route), then pick who gets the ball. The numbers next to each name are what a throw to him tends to do against this look: how often it’s caught, the yards a throw, and how often it’s picked. Play action fools an aggressive defense and costs time against a patient one; a roll out beats the rush but cuts off the middle; out of bounds stops the clock and gives up the yards after the catch.</p>`
    + `<p><b>On defense</b> you see their formation (a heavy set usually runs, an empty backfield almost always throws) and pick a call: Zone, Man, Blitz or Prevent, then one of its plays. Zones keep the ball in front of you, man and blitzes gamble for a sack or a stop, and prevent gives up the short stuff to save the end zone. Their clock is theirs to manage: ahead, they let it run; behind, they hurry.</p>`
    + `<p><b>The players matter.</b> Every dot is a real starter, coloured by his rating; yours are ringed in white. Man coverage is one-on-one, so a great receiver against a weak corner wins; the lines decide the sacks. Tap Player ratings to scout.</p>`
    + `<p><b>The clock.</b> A run, a sack or a catch in bounds keeps it running, and the next snap takes ${E.HURRY} seconds to get off (${E.MILK} when the team ahead lets it run). Go <b>no huddle</b> and it takes ${E.NO_HUDDLE}, but nobody’s quite set: passes are caught a little less, sacks come a little more and runs gain a little less (trick plays need a huddle). Incompletions, going out of bounds, timeouts, spikes and changes of possession stop it. Down one or two after a touchdown, you choose: kick, or go for two.</p>`
    + `<p><b>Who you called it like.</b> At the final whistle, your calls are matched to the NFL head coach whose late-game play-calling (the last two minutes of either half, ${esc(dr.DOC && dr.DOC.coaches ? dr.DOC.coaches.seasons : '2025–2026')}) fits them best: how often he throws, goes deep or keeps it short, attacks the middle, gets out of bounds, spikes it, goes no-huddle, burns a timeout to stop the clock, goes for two and goes for it on fourth down.</p>`
    + `<p><b>After each snap</b> the breakdown shows what the defense was really in, how your win chance moved, and how every option would have done, each played out many times from the same spot to the end of the game.</p>`
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
// Each slice plays a few games out to 0:00; slices with different salts are different futures, so they average.
const WP_SALTS = [7, 8, 9, 10], WP_CHUNK = 20;
const OPT_SALTS = [11, 12, 13], OPT_CHUNK = 12;
const stateKey = s => `${s.sc.s}|${E.actsOf(s)}`;
function slice(st, fn) {
  return new Promise(res => { st.timers.push(setTimeout(() => { if (st.dead) { res(null); return; } res(fn()); }, 0)); });
}
function wpNow(st, s) {
  const k = stateKey(s);
  if (!st.wp.has(k)) {
    st.wp.set(k, (async () => {
      let v = 0;
      for (const salt of WP_SALTS) {
        const x = await slice(st, () => E.winChance(s, WP_CHUNK, salt));
        if (x == null) return null;
        v += x;
      }
      return v / WP_SALTS.length;
    })());
  }
  return st.wp.get(k);
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
  const card = p.pp && sBefore.book ? Math.max(0, sBefore.book.indexOf(p.pp)) : 0;
  const list = E.defaultOptions(sBefore, p.pp ? p.routes : null, card);
  if (!list.includes(p.act)) list.push(p.act);
  const scores = [];
  for (const t of list) {
    let v = 0, n = 0;
    for (const salt of OPT_SALTS) {
      const r = await slice(st, () => E.scoreOptions(sBefore, [t], OPT_CHUNK, salt));
      if (st.last !== L || st.dead) return;
      if (r && r[0]) { v += r[0].wp; n++; }
    }
    if (n) scores.push({token: t, wp: v / n});
  }
  scores.sort((a, b) => b.wp - a.wp);
  L.scores = scores;
  L.n = OPT_SALTS.length * OPT_CHUNK;
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

/** A call's score by the play-caller's numbers, as the scoreboard grades it: {score (0-100), best (the best call's
 *  token)}, or null for a call that isn't graded (a clock tool, a kick). */
function callNow(s, token) {
  try {
    const v = E.callScore(s, token);
    return v == null ? null : {score: Math.round(100 * v), best: E.callValues(s).bestToken};
  } catch (_) { return null; }
}
// ============================================================================ Playing a snap
/** Brings the field into view for a snap: the calls sit below it, so the call that was just tapped usually has the
 *  field scrolled up out of sight. The stage goes just under the nav bar; when it can't all fit above the tab bar, the
 *  field's bottom stays in view. Nothing moves when the field is already in full view. */
function showField(st) {
  const stage = st.el.querySelector('.dr-stage'), f = st.el.querySelector('[data-dr-field]');
  const scr = stage && stage.closest('.screen');
  if (!scr || !f || !st.ctx.visible) return;
  const nav = scr.querySelector(':scope > .nav'), bar = document.getElementById('tabbar');
  const sr = scr.getBoundingClientRect();
  const under = (nav ? nav.getBoundingClientRect().bottom : sr.top) + 8;
  const br = bar && bar.offsetHeight ? bar.getBoundingClientRect() : null;
  const above = Math.min(sr.bottom, br ? br.top : Infinity) - 8;
  const fr = f.getBoundingClientRect();
  if (fr.top >= under && fr.bottom <= above) return;
  let d = stage.getBoundingClientRect().top - under;
  if (fr.bottom - d > above) d = fr.bottom - above;
  scr.scrollTo({top: Math.max(0, scr.scrollTop + d), behavior: ui.RM ? 'auto' : 'smooth'});
}
async function go(st, token) {
  const s = st.s;
  if (st.busy || !s || s.result) return;
  const sBefore = E.replay(s.sc, dr.DOC.teams, E.actsOf(s));
  const i0 = s.plays.length;
  const p = E.act(s, token);
  if (!p) return;
  dr.record(st.n, s);
  if (s.result) dr.autoPost();
  ui.haptic(p.kind === 'timeout' ? 'light' : 'medium');
  st.panel = 'main';
  st.dpanel = null;
  st.pick = null;
  st.rtOpen = null;
  st.last = {p, autos: s.plays.slice(i0 + 1), wpB: null, wpA: null, scores: null, canReplay: !['timeout', 'expired'].includes(p.kind), call: callNow(sBefore, p.act)};
  scoreLast(st, sBefore, p);
  if (p.kind === 'timeout') { finishPlay(st, p); return; }
  st.busy = true;
  setPanel(st);
  patchRoutes(st);
  showField(st);
  const c1 = p.kind === 'expired' ? p.after.clock : p.clock;
  if (p.c0 !== c1) await runOff(st, p.c0, c1);
  if (st.dead) return;
  if (p.kind !== 'expired') {
    if (p.poss === 'them') {
      // Your defense shifts into its call before the snap.
      const f = st.el.querySelector('[data-dr-field]');
      if (f) { moveTo(st, f, viewOf(p)); await pause(st, 520 * PACE); }
      if (st.dead) return;
    }
    await runAnim(st, choreo(s, p), p);
  }
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
  st.card = 0;
  st.side = 's';
  patchField(st);
  const bug = st.el.querySelector('[data-dr-bug]');
  if (bug) { bug.outerHTML = bugHTML(s); camLib.sbarLogos(st.el); }
  const sit = st.el.querySelector('[data-dr-sit]');
  if (sit) sit.outerHTML = sitHTML(s);
  setPanel(st);
  const ph = st.el.querySelector('[data-dr-pbph]');
  if (ph) { ph.innerHTML = pbpHTML(st); ui.hydrate(ph); }
  const t = dr.playText(s, p);
  const extra = st.last && st.last.p === p ? st.last.autos.map(x => dr.playText(s, x).line).join(' ') : '';
  if (s.result) {
    const res = st.el.querySelector('.dr-final');
    if (s.result === 'W' && res && !ui.RM) {
      ui.haptic('celebrate');
      ui.stamp(res.querySelector('.dr-final-h'), {from: 1.4});
      ui.confetti(res.getBoundingClientRect(), {colors: ['#FFC531', '#34D399', '#FFFFFF'], count: 90});
    } else if (s.result === 'L') ui.haptic('error');
    scheduleBoard(st);
    ui.announce(`${t.line} ${extra} Final: ${dr.resultText(s).head}, ${s.us} to ${s.them}.`);
  } else {
    const who = s.poss === 'us' ? '' : `${E.idsFor(s, 'them').o} ball, `;
    ui.announce(`${t.line} ${extra} ${who}${dr.downText(s.down, s.togo, s.ball)} on the ${dr.spot(s)}, ${dr.clockText(s.clock)} left.`);
    wpNow(st, s); // ready for the next breakdown
  }
}
/** Replays the last snap on the field (from that side of the ball), then puts it back where the game is now. */
async function replayLast(st) {
  const L = st.last;
  if (!L || st.busy || !L.canReplay) return;
  const p = L.p;
  st.busy = true;
  setPanel(st);
  showField(st);
  const f = swapField(st, viewOf(p), {fade: false});
  if (!f) { st.busy = false; return; }
  const clock = st.el.querySelector('[data-dr-clock]');
  if (clock) clock.textContent = dr.clockText(p.clock);
  void f.offsetWidth;
  await runAnim(st, choreo(st.s, p), p);
  if (st.dead) return;
  // Back to now: a new field when the ball changed hands, else the players walk back.
  if (f.dataset.poss !== st.s.poss) swapField(st, viewNow(st.s, flipNow(st)));
  finishPlay(st, p);
}

// ============================================================================ The day
function setDaily(st) {
  st.n = dr.todayNumber();
  st.s = dr.game(st.n);
  st.panel = 'main';
  st.dpanel = null;
  st.last = null;
  st.pick = null;
  st.rtOpen = null;
  st.flags = {};
  st.runOob = false;
  st.hurry = false;
  st.card = 0;
  st.side = 's';
  st.routes = st.s && st.s.routes ? Object.assign({}, st.s.routes) : {};
  if (st.s && !st.s.result && st.el && st.wp) st.timers.push(setTimeout(() => wpNow(st, st.s), 400));
}
/** A tester's practice run of today's drill: the first game is posted (if it wasn't yet) and stays on the board. */
function playAgain(st) {
  if (st.busy) return;
  dr.autoPost();
  if (!dr.replayDay(st.n)) return;
  ui.haptic('medium');
  setDaily(st);
  rerender(st);
  setTimeout(() => { if (!st.dead) showField(st); }, 200);
  ui.announce('Practice run: a fresh start on today’s drill.');
}
function rerender(st, {fade = true} = {}) {
  const go2 = () => { st.el.innerHTML = bodyHTML(st); ui.hydrate(st.el); camLib.sbarLogos(st.el); };
  if (fade && !ui.RM && st.ctx.visible) ui.crossfade(st.el, go2, {duration: 160}); else go2();
}
function share(st) {
  const s = st.s;
  if (!s || !s.result) return;
  ui.share({text: dr.shareText(st.n, s)}).then(r => {
    if (r === 'copied') { ui.toast(COPIED, {icon: 'check-circle'}); ui.haptic('success'); }
    else if (r === 'unavailable') ui.toast("Couldn't copy your game.");
  });
}
function openMenu(st, k) {
  if (st.busy) return;
  const was = st.panel;
  st.panel = k;
  st.rtOpen = null;
  ui.haptic('selection');
  setPanel(st);
  patchRoutes(st);
  const f = st.el.querySelector('[data-dr-field]');
  if (f) { f.classList.toggle('is-routes', routesOn(st)); f.setAttribute('role', routesOn(st) ? 'group' : 'img'); f.setAttribute('aria-label', fieldLabel(st)); }
  flipField(st);
  const first = st.el.querySelector(`[data-dr-panel] [data-dr-menu="${k === 'main' ? was : k}"]`);
  if (first) { try { first.focus({preventScroll: true}); } catch (_) {} }
}
/** Your back to where the open call lines him up (the weak side flips him), on the dots. */
function flipField(st) {
  const f = st.el.querySelector('[data-dr-field]');
  if (f && !st.busy && st.s && f.dataset.poss === st.s.poss) moveTo(st, f, viewNow(st.s, flipNow(st)));
}
/** Opens a defensive type (null closes it): its calls under the switch. */
function openDefMenu(st, k) {
  if (st.busy) return;
  const was = st.dpanel;
  st.dpanel = k;
  ui.haptic('selection');
  setPanel(st);
  const b = st.el.querySelector(`[data-dr-panel] [data-dr-dmenu="${k || was}"]`);
  if (b) { try { b.focus({preventScroll: true}); } catch (_) {} }
}
/** No huddle on or off: the switches, the calls that carry it and the clock warning follow. */
function toggleHurry(st) {
  st.hurry = !st.hurry;
  ui.haptic('selection');
  st.el.querySelectorAll('[data-dr-hurry]').forEach(b => b.setAttribute('aria-pressed', String(st.hurry)));
  const rows = st.el.querySelector('[data-dr-rcvs]');
  if (rows) { rows.innerHTML = rowsHTML(st); ui.hydrate(rows); }
  if (st.panel === 'run' || st.panel === 'rpo') refreshCards(st);
  const w = st.el.querySelector('[data-dr-warn]');
  if (w) w.outerHTML = warnHTML(st);
  ui.announce(st.hurry ? `No huddle: the snap comes in ${E.NO_HUDDLE} seconds while the clock runs.` : 'No huddle off.');
}
/** Redraws the open menu's play cards (a side flipped, the sideline switch, a pass play picked). */
function refreshCards(st) {
  const host = st.el.querySelector('[data-dr-cards]');
  if (!host) return;
  const x = host.scrollLeft;
  host.innerHTML = st.panel === 'pass' ? passCardsHTML(st) : st.panel === 'trick' ? trickCardsHTML(st) : runCardsHTML(st);
  host.scrollLeft = x;
  ui.hydrate(host);
}
/** Picks one of the snap's three pass plays: its routes go up on the field (any route changes start over). */
function pickCard(st, i) {
  const s = st.s;
  if (!s.book || !s.book[i] || st.busy) return;
  st.card = i;
  st.routes = Object.assign({}, E.PASS_PLAYS[s.book[i]].routes);
  st.pick = null;
  st.rtOpen = null;
  ui.haptic('selection');
  refreshCards(st);
  patchRoutes(st);
  const rows = st.el.querySelector('[data-dr-rcvs]');
  if (rows) { rows.innerHTML = rowsHTML(st); ui.hydrate(rows); }
  // Straight to the play's target: his row, ready to throw.
  const row = st.el.querySelector('.dr-rcv.is-key');
  if (row) row.scrollIntoView({block: 'center', behavior: ui.RM ? 'auto' : 'smooth'});
  ui.announce(`${E.PASS_PLAYS[s.book[i]].name}, for ${s.mine.by[keyOf(st)].n}.`);
}
/** Redraws a receiver's row (his throw and his route's menu). */
function patchRow(st, slot) {
  const li = st.el.querySelector(`[data-dr-rcvrow="${slot}"]`);
  if (!li) return null;
  norm.innerHTML = receiverRowHTML(st, slot);
  const row = norm.content.firstElementChild;
  li.replaceWith(row);
  ui.hydrate(row);
  return row;
}
/** Opens a receiver's route menu (slot) or closes the open one (null); a keyboard opening goes to its first route. */
function openRoutes(st, slot, {keys = false} = {}) {
  const was = st.rtOpen;
  if (was === slot) return;
  st.rtOpen = slot;
  if (was) patchRow(st, was);
  if (!slot) {
    const b = st.el.querySelector(`[data-dr-rtbtn="${was}"]`);
    if (b && keys) { try { b.focus({preventScroll: true}); } catch (_) {} }
    return;
  }
  ui.haptic('selection');
  const row = patchRow(st, slot), list = row && row.querySelector('.dr-rlist');
  if (!list) return;
  list.scrollIntoView({block: 'nearest', behavior: ui.RM ? 'auto' : 'smooth'});
  if (keys) { const f = list.querySelector('[data-dr-ropt]'); if (f) { try { f.focus({preventScroll: true}); } catch (_) {} } }
}
/** An audible: a receiver's new route, on the field, on the picked play's card and in his row; his menu closes. */
function setRoute(st, slot, route) {
  if (st.busy || !E.ROUTES_FOR[slot] || !E.ROUTES_FOR[slot].includes(route)) return;
  const was = st.rtOpen;
  st.routes[slot] = route;
  st.pick = slot;
  st.rtOpen = null;
  if (was && was !== slot) patchRow(st, was);
  ui.haptic('selection');
  patchRoutes(st);
  refreshCards(st);
  const row = patchRow(st, slot), b = row && row.querySelector('[data-dr-rtbtn]');
  if (b) { try { b.focus({preventScroll: true}); } catch (_) {} }
  ui.announce(`${st.s.mine.by[slot].n}: ${E.ROUTES[route].name}.`);
}
/** A tap on a receiver on the field: his next route. */
function cycleRoute(st, slot) {
  const list = E.ROUTES_FOR[slot];
  setRoute(st, slot, list[(list.indexOf(st.routes[slot]) + 1) % list.length]);
}

function onClick(st, e) {
  if (st.busy && st.anim && e.target.closest('[data-dr-field]')) return; // the field's own skip handler
  // A route's menu: its pill opens and closes it, a route in it is the audible, a tap anywhere else only closes it.
  const ro = e.target.closest('[data-dr-ropt]'), rb = e.target.closest('[data-dr-rtbtn]');
  if (ro && st.rtOpen) { setRoute(st, st.rtOpen, ro.dataset.drRopt); return; }
  if (rb && st.el.contains(rb)) { openRoutes(st, st.rtOpen === rb.dataset.drRtbtn ? null : rb.dataset.drRtbtn, {keys: e.detail === 0}); return; }
  if (st.rtOpen) { openRoutes(st, null); return; }
  const rcv = routesOn(st) && e.target.closest('[data-dr-rcv]');
  if (rcv && st.el.contains(rcv)) { cycleRoute(st, rcv.dataset.drRcv); return; }
  const t = e.target.closest('[data-dr-go], [data-dr-menu], [data-dr-dmenu], [data-dr-card], [data-dr-side], [data-dr-hurry], [data-dr-flag], [data-dr-replay], [data-dr-ratings], [data-dr-help], [data-dr-share], [data-dr-again], [data-dr-retry], [data-dr-who], [data-dr-sbtab]');
  if (!t || !st.el.contains(t) || t.disabled) return;
  if (t.hasAttribute('data-dr-go')) { go(st, t.dataset.drGo); return; }
  if (t.hasAttribute('data-dr-menu')) { openMenu(st, st.panel === t.dataset.drMenu ? 'main' : t.dataset.drMenu); return; }
  if (t.hasAttribute('data-dr-dmenu')) { openDefMenu(st, st.dpanel === t.dataset.drDmenu ? null : t.dataset.drDmenu); return; }
  if (t.hasAttribute('data-dr-card')) { pickCard(st, Number(t.dataset.drCard)); return; }
  if (t.hasAttribute('data-dr-side')) {
    st.side = t.dataset.drSide === 'w' ? 'w' : 's';
    ui.haptic('selection');
    st.el.querySelectorAll('[data-dr-side]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.drSide === st.side)));
    refreshCards(st);
    flipField(st);
    return;
  }
  if (t.hasAttribute('data-dr-hurry')) { toggleHurry(st); return; }
  if (t.hasAttribute('data-dr-flag')) {
    const k = t.dataset.drFlag;
    st.flags = Object.assign({}, st.flags, {[k]: !st.flags[k]});
    t.setAttribute('aria-pressed', String(!!st.flags[k]));
    ui.haptic('selection');
    const rows = st.el.querySelector('[data-dr-rcvs]');
    if (rows) { rows.innerHTML = rowsHTML(st); ui.hydrate(rows); }
    return;
  }
  if (t.hasAttribute('data-dr-replay')) { replayLast(st); return; }
  if (t.hasAttribute('data-dr-ratings')) { openRatings(st); return; }
  if (t.hasAttribute('data-dr-help')) { openHelp(); return; }
  if (t.hasAttribute('data-dr-share')) { share(st); return; }
  if (t.hasAttribute('data-dr-again')) { playAgain(st); return; }
  if (t.hasAttribute('data-dr-who')) { openGame(st, t.dataset.drWho); return; }
  if (t.hasAttribute('data-dr-sbtab')) {
    if ((st.sbTab || 'day') === t.dataset.drSbtab) return;
    st.sbTab = t.dataset.drSbtab;
    ui.haptic('selection');
    patchBoard(st, {fade: true});
    return;
  }
  if (t.hasAttribute('data-dr-retry')) load(st);
}
function onKey(st, e) {
  // In an open route menu: up and down move through it, Enter or Space picks, Escape and Tab close it.
  if (st.rtOpen && e.target.closest && e.target.closest('[data-dr-rt]')) {
    const opts = [...st.el.querySelectorAll('.dr-rlist [data-dr-ropt]')], i = opts.indexOf(e.target);
    if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); openRoutes(st, null, {keys: e.key === 'Escape'}); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = opts[i < 0 ? (e.key === 'ArrowDown' ? 0 : opts.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length];
      if (n) n.focus();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); setRoute(st, st.rtOpen, opts[i].dataset.drRopt); return; }
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-dr-rcv][role="button"]')) {
    e.preventDefault();
    cycleRoute(st, e.target.dataset.drRcv);
  }
}
function load(st) {
  st.el.innerHTML = loadingHTML();
  dr.load().then(() => {
    if (st.dead) return;
    dr.applyResets();
    setDaily(st);
    rerender(st, {fade: false});
    dr.autoPost();
  }, () => {
    if (st.dead) return;
    st.el.innerHTML = errorHTML();
    ui.hydrate(st.el);
  });
}
/** Each tick: the countdown, and after midnight the new game (not mid-snap). */
function tick(st) {
  if (st.dead || !dr.DOC || st.busy) return;
  if (dr.todayNumber() !== st.n) { setDaily(st); rerender(st); return; }
  const v = st.el.querySelector('[data-dr-next]');
  if (v) { const t = nextIn(); if (v.textContent !== t) v.textContent = t; }
}

// ============================================================================ Pane
export function render(ctx) {
  const st = ST.get(ctx);
  if (st) return bodyHTML(st);
  if (!dr.DOC) return loadingHTML();
  const tmp = {panel: 'main', flags: {}, routes: {}, card: 0, side: 's', timers: [], rp: new Map()};
  setDaily(tmp);
  return bodyHTML(tmp);
}

export function mount(el, ctx, {anchor} = {}) {
  ensureCss();
  const st = {el, ctx, anchor: anchor || null, n: 0, s: null, panel: 'main', flags: {}, runOob: false, routes: {}, pick: null, rtOpen: null, card: 0, side: 's', hurry: false,
    last: null, busy: false, dead: false, timers: [], cancelBoard: null, anim: null, wp: new Map(), rp: new Map(), pbpOpen: false};
  ST.set(ctx, st);
  st.onClick = e => onClick(st, e);
  st.onKey = e => onKey(st, e);
  st.onToggle = e => { if (e.target.matches && e.target.matches('[data-dr-pbp]')) st.pbpOpen = e.target.open; };
  st.onChange = e => {
    if (!e.detail || e.detail.name !== 'dr-oob') return;
    e.stopPropagation();
    st.runOob = !!e.detail.value;
    refreshCards(st);
  };
  el.addEventListener('click', st.onClick);
  el.addEventListener('keydown', st.onKey);
  el.addEventListener('toggle', st.onToggle, true);
  el.addEventListener('ui:change', st.onChange);
  st.onOut = e => { if (st.rtOpen && !el.contains(e.target)) openRoutes(st, null); };
  document.addEventListener('pointerdown', st.onOut, true);
  st.stopTick = ctx.timer(() => tick(st), 20000);
  st.unsub = daily.subscribe(type => {
    // A reset for this phone's member (dr.applyResets) or another tab: the saved game isn't the one showing.
    if (type === 'lb' && !st.busy && st.s && dr.DOC) { dr.applyResets(); if (dr.dayState(st.n).acts !== E.actsOf(st.s)) { setDaily(st); rerender(st); } }
    if (type === 'lb' || type === 'ready' || type === 'error') scheduleBoard(st);
  });
  if (!dr.DOC) { load(st); return; }
  dr.applyResets();
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
  document.removeEventListener('pointerdown', st.onOut, true);
  if (st.stopTick) st.stopTick();
  if (st.unsub) st.unsub();
  if (st.cancelBoard) st.cancelBoard();
  ST.delete(ctx);
}
