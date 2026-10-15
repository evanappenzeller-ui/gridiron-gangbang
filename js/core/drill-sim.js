// Two-Minute Drill engine: one drive, snap by snap. Pure functions, no DOM and no imports, so node runs it too
// (tools/drill/tune.mjs sets each day's situation with it). Owner: Drill.
//
// A drive is a scenario {o, d (team ids), us, them (the score), t (seconds left), b (the ball: yards from your own goal
// line), to (your timeouts), s (the seed)} plus the actions taken (tokens, TOKENS below). Everything follows from the
// two: replay(sc, teams, acts) rebuilds the drive, so a phone stores only the action string, a friend's drive can be
// shown from theirs, and the same call in the same spot gets the same result for everyone.
//
// Randomness: a counter-based generator (integer hash, no Math.random) keyed by the seed, the snap number and what was
// called, so a snap's dice don't depend on what came before. The engine uses only + - * / and comparisons on its
// numbers (no exp or log, whose last bits differ between browsers), so every phone computes the same drive.
//
// BEFORE THE SNAP you see: the defense's look (LOOKS) and which side its front leans to (shade), and your receivers'
// routes (a play design drawn for the snap; tap one to change it). AT THE SNAP the defense's real call is drawn from
// what that look usually means (CALLS_FOR): a light box is mostly two- and four-deep zones, a loaded box a run blitz or
// man coverage. Each call takes some things away and gives others up (FX), so the odds shown before a throw (odds())
// are the look's average, and the breakdown after it says what they were really in.
// THE CALLS: a pass to one receiver on his route (with play action, a roll out, or the receiver getting out of
// bounds), a run or an RPO to the strong or the weak side (and out of bounds if you like), one trick play a drive, and
// the clock tools: timeout, spike, field goal. THE CLOCK: a catch or run in bounds or a sack keeps it running, and the
// next snap comes HURRY seconds later; an incompletion, going out of bounds, a timeout or a spike stops it; the
// two-minute warning stops it once. Down 1-3 a field goal is there in range; down 7 a touchdown brings the choice:
// kick to tie (token e), or go for two from the 2 (any play) to win.
// THE PLAYERS: every snap pits your QB, the receiver and your line against his man, the safeties and the rush (or your
// back and line against the front and the linebackers); man coverage leans on the one-on-one far harder than zone.
// Also here: odds() for the pass menu, a bot that plays a drive well (bot()), and the win chance from any spot and
// for every option at a snap (winChance, scoreOptions), by playing it out many times with the bot.

export const LOOKS = {
  box: {name: 'Loaded box', sub: '7 or more near the line'},
  light: {name: 'Light box', sub: '6 or fewer near the line'},
  two: {name: 'Two-high shell', sub: 'Both safeties deep'},
  blitz: {name: 'Blitz look', sub: 'Linebackers up in the gaps'},
  prevent: {name: 'Prevent', sub: 'Everyone deep'}
};
export const LOOK_IDS = Object.keys(LOOKS);
/** The defense's real calls. what: in a breakdown's words. */
export const CALLS = {
  c0: {name: 'Cover 0', what: 'everybody blitzing, nobody deep'},
  c1: {name: 'Cover 1', what: 'man to man, one safety deep'},
  c2: {name: 'Cover 2', what: 'two deep safeties, corners sitting on the sideline'},
  c3: {name: 'Cover 3', what: 'three deep, four underneath'},
  c4: {name: 'Quarters', what: 'four deep, nothing over the top'},
  rb: {name: 'a run blitz', what: 'eight crashing the line'},
  fire: {name: 'a zone blitz', what: 'five rushing, three deep'},
  pv: {name: 'prevent', what: 'everybody deep, three rushing'}
};
export const CALLS_FOR = {
  box: [['rb', 0.35], ['c1', 0.35], ['c0', 0.15], ['c3', 0.15]],
  light: [['c2', 0.3], ['c4', 0.35], ['c3', 0.25], ['pv', 0.1]],
  two: [['c2', 0.45], ['c4', 0.35], ['c1', 0.1], ['fire', 0.1]],
  blitz: [['c0', 0.35], ['fire', 0.35], ['c1', 0.2], ['c2', 0.1]],
  prevent: [['pv', 0.75], ['c4', 0.25]]
};
// What each call does. run: yards added to a run; stuff/big/oob: multiply a run's stuffs, breakaways, sideline exits;
// sack: multiplies sacks on a slow throw (qs: on a quick one, 2 seconds or less); duel: how much the receiver-vs-man
// matchup counts; pa: play action fools it; rpo: the RPO's read ('pass': the QB throws it quick); trick: the trick
// play's chance; cat: by route family, [completion added, interceptions multiplied, yards after catch added].
export const FX = {
  c0: {run: -1.0, stuff: 1.4, big: 1.8, sack: 2.6, qs: 0.9, duel: 1.6, pa: true, rpo: 'pass', trick: 0.55,
    cat: {quick: [0.10, 1, 2], out: [0.04, 1, 0], mid: [-0.03, 1.1, 1], seam: [0.05, 1, 3], deep: [0.08, 0.9, 4], sdeep: [0.04, 1, 2]}},
  c1: {run: -1.5, stuff: 1.5, big: 1.0, sack: 1.2, qs: 1, duel: 2.0, pa: true, rpo: 'pass', trick: 0.5,
    cat: {quick: [0.02, 1.1, 1], out: [0, 1.1, 0], mid: [0.06, 1, 1.5], seam: [0.02, 1, 0], deep: [0.02, 1.1, 1], sdeep: [0, 1, 0]}},
  c2: {run: 1.5, stuff: 0.7, big: 1.1, sack: 0.9, qs: 1, duel: 1, rpo: 'run', trick: 0.3,
    cat: {quick: [0.03, 1, 0], out: [-0.20, 2.0, -1], mid: [0.08, 0.9, 1], seam: [0.10, 1, 2], deep: [-0.14, 1.8, 0], sdeep: [0.10, 1, 0]}},
  c3: {run: 0, stuff: 1, big: 1, sack: 1, qs: 1, duel: 1, rpo: 'run', trick: 0.35,
    cat: {quick: [0.06, 1, 1], out: [0.04, 1, 0], mid: [-0.08, 1.3, 0], seam: [0.10, 0.9, 1], deep: [-0.12, 1.5, 0], sdeep: [-0.06, 1.2, 0]}},
  c4: {run: 2.0, stuff: 0.6, big: 0.8, sack: 0.9, qs: 1, duel: 1, rpo: 'run', trick: 0.2,
    cat: {quick: [0.10, 0.8, 1.5], out: [0.06, 0.9, 0.5], mid: [0.02, 1, 0], seam: [-0.14, 1.6, 0], deep: [-0.22, 2.0, 0], sdeep: [-0.10, 1.4, 0]}},
  rb: {run: -3.5, stuff: 2.4, big: 0.6, sack: 1.3, qs: 1, duel: 1.2, pa: true, rpo: 'pass', trick: 0.62,
    cat: {quick: [0.06, 0.9, 1], out: [0.03, 1, 0], mid: [0.05, 0.9, 1], seam: [0.06, 0.9, 2], deep: [0.10, 0.8, 2], sdeep: [0.06, 0.9, 1]}},
  fire: {run: -0.5, stuff: 1.3, big: 1, sack: 2.0, qs: 0.8, duel: 1, rpo: 'pass', trick: 0.5,
    cat: {quick: [0.06, 1.3, 1.5], out: [-0.04, 1.2, 0], mid: [-0.06, 1.2, 0], seam: [0.02, 1, 0], deep: [-0.04, 1.1, 0], sdeep: [-0.04, 1, 0]}},
  pv: {run: 2.5, stuff: 0.4, big: 0.5, oob: 0.4, sack: 0.5, qs: 0.5, duel: 1, rpo: 'run', trick: 0.12,
    cat: {quick: [0.14, 0.6, 2], out: [0.06, 0.8, -0.5], mid: [0.08, 0.8, 1], seam: [-0.10, 1.6, 0], deep: [-0.30, 2.6, 0], sdeep: [-0.20, 2.0, 0]}}
};
// Routes on an even matchup against no call in particular. depth: air yards at the catch; comp, int; yac: yards after
// the catch; time: seconds before the ball is out (sacks grow with it); oob: out of bounds after the catch; big: a
// broken tackle.
export const ROUTES = {
  slant: {name: 'Slant', cat: 'quick', depth: 6, comp: 0.70, int: 0.022, yac: 3.5, time: 1.7, oob: 0.04, big: 0.06},
  flat: {name: 'Flat', cat: 'quick', depth: 2, comp: 0.78, int: 0.012, yac: 4.5, time: 1.6, oob: 0.35, big: 0.05},
  drag: {name: 'Drag', cat: 'quick', depth: 4, comp: 0.74, int: 0.015, yac: 4.5, time: 2.0, oob: 0.08, big: 0.05},
  out: {name: 'Out', cat: 'out', depth: 8, comp: 0.62, int: 0.03, yac: 0.8, time: 2.2, oob: 0.8, big: 0.01},
  curl: {name: 'Curl', cat: 'mid', depth: 9, comp: 0.66, int: 0.02, yac: 1.5, time: 2.3, oob: 0.08, big: 0.02},
  dig: {name: 'Dig', cat: 'mid', depth: 12, comp: 0.58, int: 0.03, yac: 3, time: 2.6, oob: 0.05, big: 0.05},
  angle: {name: 'Angle', cat: 'mid', depth: 5, comp: 0.66, int: 0.02, yac: 4, time: 2.0, oob: 0.06, big: 0.06},
  seam: {name: 'Seam', cat: 'seam', depth: 18, comp: 0.44, int: 0.04, yac: 4, time: 2.7, oob: 0.05, big: 0.1},
  post: {name: 'Post', cat: 'deep', depth: 22, comp: 0.38, int: 0.05, yac: 5, time: 3.0, oob: 0.05, big: 0.12},
  go: {name: 'Go', cat: 'deep', depth: 30, comp: 0.30, int: 0.05, yac: 6, time: 3.2, oob: 0.35, big: 0.1},
  corner: {name: 'Corner', cat: 'sdeep', depth: 18, comp: 0.40, int: 0.035, yac: 2, time: 2.9, oob: 0.55, big: 0.05},
  wheel: {name: 'Wheel', cat: 'sdeep', depth: 16, comp: 0.40, int: 0.03, yac: 5, time: 2.9, oob: 0.45, big: 0.08}
};
/** The receivers, in token order, and the routes each can run. */
export const TARGETS = ['WR1', 'WR2', 'WR3', 'TE', 'RB'];
export const ROUTES_FOR = {
  WR1: ['go', 'post', 'dig', 'out', 'slant', 'curl'], WR2: ['go', 'post', 'dig', 'out', 'slant', 'curl'],
  WR3: ['seam', 'dig', 'out', 'slant', 'corner'], TE: ['seam', 'dig', 'out', 'drag', 'corner'], RB: ['angle', 'flat', 'wheel']
};
// Play designs: each snap's routes, before you change any.
const CONCEPTS = [
  {WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'angle'},
  {WR1: 'dig', WR2: 'post', WR3: 'slant', TE: 'drag', RB: 'flat'},
  {WR1: 'curl', WR2: 'out', WR3: 'corner', TE: 'dig', RB: 'flat'},
  {WR1: 'slant', WR2: 'slant', WR3: 'out', TE: 'seam', RB: 'wheel'},
  {WR1: 'out', WR2: 'dig', WR3: 'seam', TE: 'out', RB: 'angle'},
  {WR1: 'post', WR2: 'curl', WR3: 'dig', TE: 'drag', RB: 'flat'}
];

export const HURRY = 15;     // seconds between snaps while the clock runs (no huddle)
export const SPIKE_SET = 6;  // getting everyone set to spike it
export const FG_SET = 18;    // the field goal unit on and set, with the clock running
const WARN = 120;            // the two-minute warning

// ---------------------------------------------------------------------------------------------- dice
function mix(h, k) {
  h = (h ^ Math.imul((k | 0) + 0x9e3779b9 | 0, 0x85ebca6b)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) | 0;
}
/** A generator of uniforms in [0, 1) for these keys. */
export function dice(...keys) {
  let s = keys.reduce(mix, 0x2545f491);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A string's hash, for keying a snap's dice by what was called. */
function hashStr(str) {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h;
}
const SQ3 = 1.7320508075688772;
/** About normal (mean 0, sd 1): four uniforms. */
const gauss = r => (r() + r() + r() + r() - 2) * SQ3;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const pickW = (r, items) => {
  let tot = 0;
  items.forEach(([, w]) => { tot += w; });
  let u = r() * tot;
  for (const [v, w] of items) { u -= w; if (u < 0) return v; }
  return items[items.length - 1][0];
};

// ---------------------------------------------------------------------------------------------- teams
const c = r => ((Number(r) || 75) - 75) / 25; // a rating -> about -1..1 (75 is 0)
const avg = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
/** A team's players by slot and the units the engine uses. T: data/drill.json's team. Memoized. */
const UNITS = new WeakMap();
export function units(T) {
  let u = UNITS.get(T);
  if (u) return u;
  const by = {};
  T.o.concat(T.d).forEach(p => { by[p[0]] = {slot: p[0], n: p[1], j: p[2], r: p[3], e: p[4]}; });
  const k = {slot: 'K', n: T.k[1], j: T.k[2], r: T.k[3], e: T.k[4]};
  const r = s => c(by[s].r);
  const front = T.s === '34' ? ['LDE', 'NT', 'RDE', 'WLB', 'SLB'] : ['LDE', 'LDT', 'RDT', 'RDE'];
  const lbs = T.s === '34' ? ['LILB', 'RILB'] : ['WLB', 'MLB', 'SLB'];
  u = {
    by, k, front, lbs,
    qb: r('QB'), rb: r('RB'), ol: avg(['LT', 'LG', 'C', 'RG', 'RT'].map(r)),
    rush: avg(front.map(r)), lb: avg(lbs.map(r)), saf: avg(['SS', 'FS'].map(r)), kick: c(k.r),
    // Who covers whom (as the defense): the receivers and their men.
    cover: {WR1: 'LCB', WR2: 'RCB', WR3: 'NB', TE: 'SS', RB: lbs[0]}
  };
  UNITS.set(T, u);
  return u;
}
// The players: how much better your side is on this snap (about -1..1; EDGE scales how much it moves the dice).
const EDGE = 0.75;
function passEdge(s, slot, duel = 1) {
  const {o, d} = s.U;
  const rec = c(o.by[slot].r), man = c(d.by[d.cover[slot]].r);
  return EDGE * (0.38 * o.qb + 0.32 * duel * rec + 0.10 * o.ol - 0.32 * duel * man - 0.12 * d.saf - 0.06 * d.rush);
}
const rushEdge = s => EDGE * (0.6 * s.U.d.rush - 0.6 * s.U.o.ol - 0.15 * s.U.o.qb);
const runEdge = s => {
  const {o, d} = s.U;
  return EDGE * (0.45 * o.rb + 0.35 * o.ol + 0.05 * o.qb - 0.5 * d.rush - 0.35 * d.lb - 0.1 * d.saf);
};

// ---------------------------------------------------------------------------------------------- tokens
// One action each, joined with commas in a drive's action string:
//   p{target 0-4}{route}[+a play action][+r roll out][+o out of bounds]   a pass (p1dig, p0go+a, p4flat+o)
//   r{s|w}[+o]   a run to the strong (tight end) or weak side;  o{s|w}[+o]   an RPO
//   x  the trick play   k  spike   t  timeout   f  field goal   e  the extra point (to tie, after a touchdown down 7)
export function parse(tok) {
  const [head, ...fl] = String(tok).split('+');
  const flags = {a: fl.includes('a'), r: fl.includes('r'), o: fl.includes('o')};
  if (fl.some(f => !['a', 'r', 'o'].includes(f))) return null;
  const k = head[0];
  if (k === 'p') {
    const i = Number(head[1]), route = head.slice(2), slot = TARGETS[i];
    return slot && ROUTES_FOR[slot].includes(route) ? {kind: 'pass', slot, i, route, flags} : null;
  }
  if ((k === 'r' || k === 'o') && (head[1] === 's' || head[1] === 'w') && head.length === 2) return {kind: k === 'r' ? 'run' : 'rpo', dir: head[1], flags};
  const one = {x: 'trick', k: 'spike', t: 'timeout', f: 'fg', e: 'kick'}[k];
  return one && head.length === 1 && !fl.length ? {kind: one, flags} : null;
}
export const tok = {
  pass: (slot, route, f = {}) => `p${TARGETS.indexOf(slot)}${route}${f.a ? '+a' : ''}${f.r ? '+r' : ''}${f.o ? '+o' : ''}`,
  run: (dir, oob) => `r${dir}${oob ? '+o' : ''}`,
  rpo: (dir, oob) => `o${dir}${oob ? '+o' : ''}`,
  trick: 'x', spike: 'k', timeout: 't', fg: 'f', kick: 'e'
};

// ---------------------------------------------------------------------------------------------- the snap
/** At the goal line (and on a two-point try) the defense is stacked and there's no room to throw. */
const goalLine = s => s.phase === 'pat' || s.ball >= 96;
/** The look, its lean and the routes for the snap about to happen. */
function setSnap(s) {
  const w = {box: 0.16, light: 0.30, two: 0.24, blitz: 0.15, prevent: 0.15};
  if (s.phase === 'pat') { w.light = 0; w.prevent = 0; w.two = 0.2; w.box = 0.45; w.blitz = 0.35; }
  else {
    if (s.togo <= 3) { w.box *= 2.4; w.light *= 0.6; w.prevent *= 0.4; }
    if (s.togo >= 10) { w.light *= 1.2; w.two *= 1.2; w.box *= 0.6; }
    if (s.clock <= 40) { w.prevent *= 2.0; w.blitz *= 0.7; }
    if (s.ball >= 80) { w.prevent *= 0.1; w.two *= 0.8; w.blitz *= 1.4; w.box *= 1.3; }
    else if (s.ball <= 30) w.prevent *= 0.5;
    if (s.U.d.rush > 0.3) w.blitz *= 0.8;
  }
  const r = dice(s.sc.s, s.snap, 0x100);
  s.look = pickW(r, LOOK_IDS.map(k => [k, w[k]]));
  s.shade = r() < 0.5 ? 's' : 'w';
  s.routes = Object.assign({}, CONCEPTS[Math.floor(r() * CONCEPTS.length)]);
}
/** The defense's real call at this snap (the same whatever you call). */
const callAt = s => pickW(dice(s.sc.s, s.snap, 0x300), CALLS_FOR[s.look]);

/** A field goal from the ball's spot: {dist, p} (p 0 when it's out of range). */
export function fgOdds(s) {
  const dist = 100 - s.ball + 17;
  const d = dist - 3 * s.U.o.kick;
  const P = [[0, 0.97], [35, 0.97], [45, 0.88], [55, 0.70], [60, 0.52], [66, 0.2], [67, 0]];
  let p = 0;
  for (let i = 1; i < P.length; i++) {
    if (d <= P[i][0]) { const [x0, y0] = P[i - 1], [x1, y1] = P[i]; p = y0 + (y1 - y0) * (d - x0) / (x1 - x0); break; }
  }
  return {dist, p: dist > 66 ? 0 : clamp(p, 0, 0.99)};
}

/** One pass against one call: the probabilities and yards before the dice. */
function passModel(s, slot, route, f, call) {
  const R = ROUTES[route], F = FX[call], [cd, im, yd] = F.cat[R.cat];
  const fooled = F.pa || s.look === 'box';
  const time = R.time + (f.a ? 0.4 : 0);
  const slow = time > 2.0;
  let pSack = (0.012 + 0.03 * Math.max(0, time - 1.5)) * (slow ? F.sack : F.qs) * (1 + 0.9 * rushEdge(s)) * (f.r ? 0.55 : 1);
  pSack = clamp(pSack, 0.003, 0.45);
  const e = passEdge(s, slot, F.duel);
  let comp = R.comp + cd + 0.22 * e;
  let yac = R.yac + yd + 2 * e;
  if (f.a) { comp += fooled ? 0.06 : -0.02; if (fooled) yac += 1.5; }
  if (f.r) comp += ['out', 'sdeep', 'quick'].includes(R.cat) ? 0.03 : -0.03;
  if (s.ball >= 80 && (R.cat === 'deep' || R.cat === 'seam')) comp -= 0.06;
  if (goalLine(s)) { comp -= 0.3; yac *= 0.3; } // no room: every window is tight, a tackler right there
  let oob = R.oob * (F.oob || 1);
  if (f.o) { oob = Math.min(0.92, R.oob * 2 + 0.35); yac *= 0.45; }
  return {
    pSack, pComp: clamp(comp, 0.05, 0.95), pInt: clamp(R.int * im * (1 - 1.2 * e), 0.003, 0.2),
    depth: R.depth + 2 * e, yac: Math.max(0, yac), oob, big: R.big * (F.big || 1) * (1 + e), time
  };
}
/** The pass menu's numbers for a receiver on a route against this look: {caught, ypt (yards a throw), picked}, each
 *  averaged over what the look usually is. */
export function odds(s, slot, route, f = {}) {
  let caught = 0, ypt = 0, picked = 0;
  CALLS_FOR[s.look].forEach(([call, w]) => {
    const m = passModel(s, slot, route, f, call), ok = 1 - m.pSack;
    caught += w * ok * m.pComp;
    picked += w * ok * m.pInt;
    ypt += w * (ok * m.pComp * Math.min(100 - s.ball, m.depth + m.yac) - m.pSack * 6.5);
  });
  return {caught, ypt, picked};
}

function whoDef(r, s, pool) {
  const d = s.U.d;
  return pickW(r, pool.map(slot => [slot, 0.6 + Math.max(0, c(d.by[slot].r) + 1)]));
}
function passPlay(r, s, slot, route, f, call) {
  const m = passModel(s, slot, route, f, call), R = ROUTES[route];
  if (r() < m.pSack) {
    const loss = 4 + Math.floor(5 * r()) + (r() < 0.12 ? 3 : 0);
    const by = whoDef(r, s, s.U.d.front.concat(call === 'c0' || call === 'fire' ? s.U.d.lbs.concat('NB') : []));
    return {kind: r() < 0.06 ? 'fum' : 'sack', gain: -loss, by, t: Math.round(m.time + 2.5)};
  }
  const by = s.U.d.cover[slot];
  const u = r();
  // A pick in a deep zone is often the safety's; in man, it's his man's.
  const deepZone = (call === 'c2' || call === 'c3' || call === 'c4' || call === 'pv') && R.cat !== 'quick';
  if (u < m.pInt) return {kind: 'int', gain: 0, who: slot, route, by: deepZone && r() < 0.5 ? (r() < 0.5 ? 'FS' : 'SS') : by, t: Math.round(m.time + 3)};
  if (u >= m.pInt + m.pComp) return {kind: 'inc', gain: 0, who: slot, route, by, air: Math.round(m.depth), t: Math.round(m.time + 2)};
  const air = Math.max(R.cat === 'deep' ? 14 : R.cat === 'quick' ? -1 : 3, m.depth + 1.5 * gauss(r));
  let yac = Math.max(0, m.yac + 1.8 * gauss(r));
  let broke = false;
  if (r() < m.big) { yac += 10 + 30 * r(); broke = true; }
  const gain = Math.round(air + yac);
  return {kind: 'catch', gain, air: Math.round(air), who: slot, route, by, oob: r() < m.oob, broke, t: Math.round(1.8 + m.time + (air + yac) / 7)};
}
function runPlay(r, s, dir, f, call, bonus = 0) {
  const F = FX[call];
  const e = runEdge(s);
  let g;
  const lean = dir === s.shade ? -1.2 : 1.6;
  if (r() < 0.08 * F.stuff * (1 - 0.5 * e) * (dir === s.shade ? 1.3 : 0.8)) g = -1 - Math.floor(3 * r());
  else g = 4.0 + F.run + lean + bonus + 2.2 * e + (f.o ? -0.8 : 0) - (goalLine(s) ? 3 : 0) + 3 * gauss(r);
  let broke = false;
  if (r() < 0.045 * F.big * (1 + e)) { g += 10 + 30 * r(); broke = true; }
  const by = whoDef(r, s, s.U.d.lbs.concat(s.U.d.front, ['SS']));
  g = Math.round(g);
  if (r() < 0.012) return {kind: 'fum', gain: g, who: 'RB', dir, by, t: 6};
  const oob = g > 0 && r() < (f.o ? 0.55 : 0.08) * (F.oob || 1);
  return {kind: 'run', gain: g, who: 'RB', dir, by, oob, broke, t: Math.round(5 + Math.max(0, g) / 8)};
}
function rpoPlay(r, s, dir, f, call) {
  if (FX[call].rpo === 'pass') {
    const p = passPlay(r, s, 'WR3', 'slant', {o: f.o}, call === 'c0' ? 'c0' : 'rb');
    return Object.assign(p, {read: 'pass', dir});
  }
  return Object.assign(runPlay(r, s, dir, f, call, 0.6), {read: 'run'});
}
function trickPlay(r, s, call) {
  const p = clamp(FX[call].trick + 0.12 * passEdge(s, 'WR1'), 0.05, 0.8);
  if (r() < p) {
    const slot = r() < 0.6 ? 'WR1' : 'WR2';
    return {kind: 'catch', gain: Math.round(22 + 23 * r()), who: slot, route: 'go', by: s.U.d.cover[slot], oob: r() < 0.3, t: 8, trick: true};
  }
  const u = r();
  if (u < 0.5) return {kind: 'inc', gain: 0, who: 'WR1', route: 'go', by: 'LCB', t: 7, trick: true};
  if (u < 0.82) return {kind: r() < 0.08 ? 'fum' : 'sack', gain: -(7 + Math.floor(6 * r())), by: whoDef(r, s, s.U.d.front), t: 7, trick: true};
  return {kind: 'int', gain: 0, who: 'WR1', route: 'go', by: r() < 0.5 ? 'FS' : 'SS', t: 7, trick: true};
}

// ---------------------------------------------------------------------------------------------- the drive
/** A new drive. sc: the scenario; teams: data/drill.json's teams. */
export function start(sc, teams) {
  const s = {
    sc, U: {o: units(teams[sc.o]), d: units(teams[sc.d])},
    us: sc.us, them: sc.them, clock: sc.t, ball: sc.b, down: 1, togo: Math.min(10, 100 - sc.b), tos: sc.to,
    running: false, warned: sc.t <= WARN, trick: true, snap: 0, phase: 'play', result: null, why: '', plays: [], best: sc.b,
    look: null, shade: 's', routes: null
  };
  setSnap(s);
  return s;
}

/** What can be done now: {plays (pass, run, rpo, trick), spike, timeout, fg: {dist, p} | null, pat}. */
export function options(s) {
  if (s.result) return {plays: [], spike: false, timeout: false, fg: null, pat: false};
  if (s.phase === 'pat') return {plays: ['pass', 'run', 'rpo'].concat(s.trick ? ['trick'] : []), spike: false, timeout: false, fg: null, pat: true};
  const deficit = s.them - s.us;
  const fg = deficit <= 3 ? fgOdds(s) : null;
  return {
    plays: ['pass', 'run', 'rpo'].concat(s.trick ? ['trick'] : []),
    spike: s.running && s.down < 4,
    timeout: s.running && s.tos > 0,
    fg: fg && fg.p > 0 ? fg : null,
    pat: false
  };
}

function end(s, result, why) { s.result = result; s.why = why; s.phase = 'done'; s.running = false; }

/** Takes the clock down by sec; the two-minute warning stops it once. Returns false when it ran out. */
function tick(s, sec, during) {
  const before = s.clock;
  s.clock = Math.max(0, s.clock - sec);
  if (!s.warned && before > WARN && s.clock <= WARN) {
    s.warned = true;
    if (!during) s.clock = WARN;
    s.running = false;
    s.warnStop = true;
  }
  return s.clock > 0;
}
/** Before a snap from a running clock: the time it takes to get it off. false when time ran out first. */
function preSnap(s, sec) {
  if (!s.running) return true;
  if (!tick(s, sec, false)) { end(s, 'L', 'clock'); return false; }
  if (s.warnStop) { s.warnStop = false; s.preWarn = true; }
  return true;
}

/** Takes one action (a token) and returns the play it made (also pushed on s.plays), or null when it isn't allowed
 *  now. Mutates s. */
export function act(s, token) {
  const a = parse(token);
  if (!a || s.result) return null;
  const o = options(s);
  const before = {n: s.snap, down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, running: s.running, look: s.look, shade: s.shade, routes: s.routes, tos: s.tos};
  const play = Object.assign({act: token, call: a.kind, a, c0: s.clock}, before); // c0: before any runoff
  s.warnStop = false;
  s.preWarn = false;

  if (a.kind === 'timeout') {
    if (!o.timeout) return null;
    s.tos -= 1;
    s.running = false;
    play.kind = 'timeout';
    return push(s, play, false);
  }
  if (s.phase === 'pat') {
    if (a.kind === 'kick') {
      s.us += 1;
      play.kind = 'xp';
      end(s, s.us > s.them ? 'W' : 'T', 'xp');
      return push(s, play);
    }
    if (!o.plays.includes(a.kind)) return null;
    const r = dice(s.sc.s, s.snap, hashStr(token));
    const call = callAt(s);
    const res = a.kind === 'pass' ? passPlay(r, s, a.slot, a.route, a.flags, call)
      : a.kind === 'run' ? runPlay(r, s, a.dir, a.flags, call)
      : a.kind === 'rpo' ? rpoPlay(r, s, a.dir, a.flags, call) : trickPlay(r, s, call);
    if (a.kind === 'trick') s.trick = false;
    s.snap += 1;
    Object.assign(play, res, {dcall: call, two: true});
    const good = (res.kind === 'catch' || res.kind === 'run') && res.gain >= 2;
    play.kind = good ? '2good' : '2fail';
    play.res = res.kind;
    if (good) { s.us += 2; end(s, s.us > s.them ? 'W' : 'T', '2pt'); }
    else end(s, s.us > s.them ? 'W' : s.us === s.them ? 'T' : 'L', '2pt');
    return push(s, play);
  }
  if (a.kind === 'kick') return null;
  if (a.kind === 'spike') {
    if (!o.spike) return null;
    if (!preSnap(s, SPIKE_SET)) { play.kind = 'expired'; return push(s, play); }
    play.clock = s.clock;
    tick(s, 1, true);
    s.snap += 1;
    s.down += 1;
    s.running = false;
    play.kind = 'spike';
    return push(s, play);
  }
  if (a.kind === 'fg') {
    if (!o.fg) return null;
    if (!preSnap(s, FG_SET)) { play.kind = 'expired'; return push(s, play); }
    play.clock = s.clock;
    const r = dice(s.sc.s, s.snap, 0x46);
    tick(s, 4, true);
    s.snap += 1;
    play.dist = o.fg.dist;
    play.p = o.fg.p;
    if (r() < o.fg.p) {
      s.us += 3;
      play.kind = 'fg';
      end(s, s.us > s.them ? 'W' : s.us === s.them ? 'T' : 'L', 'fg');
    } else {
      play.kind = 'fgx';
      end(s, 'L', 'fgx');
    }
    return push(s, play);
  }
  if (!o.plays.includes(a.kind)) return null;
  if (!preSnap(s, HURRY)) { play.kind = 'expired'; return push(s, play); }
  play.clock = s.clock; // at the snap
  const r = dice(s.sc.s, s.snap, hashStr(token));
  const call = callAt(s);
  let res;
  if (a.kind === 'pass') res = passPlay(r, s, a.slot, a.route, a.flags, call);
  else if (a.kind === 'run') res = runPlay(r, s, a.dir, a.flags, call);
  else if (a.kind === 'rpo') res = rpoPlay(r, s, a.dir, a.flags, call);
  else { s.trick = false; res = trickPlay(r, s, call); }
  s.snap += 1;
  Object.assign(play, res, {dcall: call});
  const alive = tick(s, res.t, true);

  if (res.kind === 'int' || res.kind === 'fum') { end(s, 'L', res.kind); return push(s, play); }
  if (res.kind === 'inc') {
    s.running = false;
  } else {
    const gain = Math.min(res.gain, 100 - s.ball);
    play.gain = gain;
    s.ball += gain;
    s.best = Math.max(s.best, s.ball);
    if (s.ball >= 100) {
      s.us += 6;
      play.td = true;
      if (s.us - s.them >= 0) { s.us += 1; end(s, 'W', 'td'); return push(s, play); }
      // Down 7 before it: tie it with the kick or go for two.
      s.phase = 'pat';
      s.running = false;
      s.ball = 98;
      s.down = 1;
      s.togo = 2;
      return push(s, play);
    }
    if (s.ball <= 0) { s.them += 2; play.safety = true; end(s, 'L', 'safety'); return push(s, play); }
    s.running = !res.oob && !s.warnStop;
  }
  if (res.kind !== 'inc' && play.gain >= s.togo) {
    s.down = 1;
    s.togo = Math.min(10, 100 - s.ball);
    play.first = true;
  } else {
    if (res.kind !== 'inc') s.togo -= play.gain;
    s.down += 1;
    if (s.down > 4) { end(s, 'L', 'downs'); return push(s, play); }
  }
  if (!alive) { end(s, 'L', 'clock'); return push(s, play); }
  return push(s, play);
}

function push(s, play, next = true) {
  play.after = {down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, running: s.running, us: s.us, them: s.them, tos: s.tos};
  play.t1 = s.clock;
  if (s.warnStop || s.preWarn) play.warn = true;
  s.plays.push(play);
  if (!s.result && next) setSnap(s);
  return play;
}

/** Rebuilds a drive from its action string. Stops at the first action that isn't allowed. */
export function replay(sc, teams, acts = '') {
  const s = start(sc, teams);
  const list = String(acts || '').split(',').filter(Boolean);
  for (const t of list) { if (s.result || !act(s, t)) break; }
  return s;
}
/** The actions a drive took, as one string (what a phone stores and posts). */
export const actsOf = s => s.plays.map(p => p.act).join(',');

// ---------------------------------------------------------------------------------------------- the bot
// A good play-caller: reads the look's odds for every throw and run, minds the clock, kicks when it should. skill 1
// takes the best option it sees; lower, it sometimes takes the second or third. Used to set each day's situation
// (tools/drill/tune.mjs) and to estimate win chances.
function runMean(s, dir, f, call) {
  return 4.0 + FX[call].run + (dir === s.shade ? -1.2 : 1.6) + 2.2 * runEdge(s) + (f.o ? -0.8 : 0) - (goalLine(s) ? 3 : 0);
}
/** About the normal curve's area below z (for the bot's sense of a spot; never part of a play's dice). */
const Phi = z => 1 / (1 + Math.exp(-1.7 * z));
/** The bot's sense of a spot: the chance of coming back from it (a tie counts a half), from how many snaps the time
 *  and timeouts leave against the yards still needed (about 6 a snap, give or take 8.5). */
function spotValue(s, ball, down, togo, clock, running, tos) {
  const deficit = s.them - s.us;
  if (ball >= 100) return deficit >= 7 ? 0.75 : 1;
  if (down > 4 || clock <= 0 || ball <= 0) return 0;
  const T = clock - (running ? HURRY : 0) + Math.min(tos, 3) * 12;
  const n = T / 10 + 0.6 - (down - 1) * 0.3 - (down > 1 ? Math.min(togo, 15) / 40 : 0);
  if (n <= 0.05) return 0;
  const sd = 8.5 * Math.sqrt(n);
  const pTD = Phi((n * 6.2 - (100 - ball)) / sd);
  let v = deficit >= 7 ? 0.75 * pTD : pTD;
  if (deficit <= 3) {
    const pFG = 0.8 * Phi((n * 6.2 - Math.max(0, 100 - ball - 33)) / sd);
    v = Math.max(v, deficit === 3 ? pTD + 0.5 * Math.max(0, pFG - pTD) : pFG);
  }
  return clamp(v, 0, 1);
}
/** The bot's sense of a play: the spot value after it, averaged over what the look usually is and how the play goes. */
function playValue(s, a) {
  let v = 0;
  const after = (gain, secs, run, downUsed = true) => {
    const ball = Math.min(100, s.ball + gain);
    if (s.phase === 'pat') return ball >= 100 ? 1 : 0; // the two-point try: in, or it's over
    const conv = gain >= s.togo;
    const down = ball >= 100 ? 1 : conv ? 1 : s.down + (downUsed ? 1 : 0);
    const togo = conv ? Math.min(10, 100 - ball) : s.togo - gain;
    return spotValue(s, ball, down, togo, s.clock - (s.running ? HURRY : 0) - secs, run, s.tos);
  };
  if (s.running && s.clock <= HURRY) return 0;
  CALLS_FOR[s.look].forEach(([call, w]) => {
    if (a.kind === 'pass' || (a.kind === 'rpo' && FX[call].rpo === 'pass')) {
      const slot = a.kind === 'pass' ? a.slot : 'WR3', route = a.kind === 'pass' ? a.route : 'slant';
      const m = passModel(s, slot, route, a.kind === 'pass' ? a.flags : {o: a.flags.o}, call);
      const ok = 1 - m.pSack, gain = Math.round(m.depth + m.yac);
      const catchSecs = 1.8 + m.time + gain / 7;
      const pc = ok * m.pComp, pi = ok * m.pInt, pinc = Math.max(0, ok - pc - pi);
      v += w * (m.pSack * after(-6, m.time + 2.5, true)
        + pinc * after(0, m.time + 2, false)
        + pc * (m.oob * after(gain, catchSecs, false) + (1 - m.oob) * after(gain, catchSecs, true))
        + pc * m.big * 0.5 * (after(gain + 18, catchSecs + 2, true) - after(gain, catchSecs, true)));
    } else if (a.kind === 'run' || a.kind === 'rpo') {
      const mean = runMean(s, a.dir, a.flags, call) + (a.kind === 'rpo' ? 0.6 : 0);
      const po = a.flags.o ? 0.5 : 0.08;
      [-3, 0, 3].forEach(d => {
        const g = Math.round(mean + d);
        v += (w / 3) * (po * after(g, 5 + g / 8, false) + (1 - po) * after(g, 5 + g / 8, true));
      });
    } else if (a.kind === 'trick') {
      const p = FX[call].trick;
      v += w * (p * after(32, 8, true) + (1 - p) * (0.5 * after(0, 7, false) + 0.32 * after(-9, 7, true)));
    }
  });
  return v;
}
/** Every play you could call now, valued by the bot: [{token, v}], best first. fast: only the routes drawn up for
 *  the snap and runs away from the lean (for playing many drives out quickly). */
export function candidates(s, fast = false) {
  const out = [];
  const late = s.clock <= 75 && s.tos <= 1;
  const fooled = s.look === 'box' || s.look === 'blitz';
  TARGETS.forEach(slot => {
    (fast ? [s.routes[slot]] : ROUTES_FOR[slot]).forEach(route => {
      const fs = [{}];
      if (late && ['out', 'corner', 'wheel', 'flat', 'go', 'curl'].includes(route)) fs.push({o: true});
      if (fooled) fs.push({a: true});
      if (!fast && s.U.d.rush > 0.2 && s.U.o.ol < 0) fs.push({r: true});
      fs.forEach(f => out.push(tok.pass(slot, route, f)));
    });
  });
  (fast ? [s.shade === 's' ? 'w' : 's'] : ['s', 'w']).forEach(dir => [false, true].forEach(oob => { out.push(tok.run(dir, oob)); out.push(tok.rpo(dir, oob)); }));
  if (s.trick) out.push(tok.trick);
  return out.map(t => ({token: t, v: playValue(s, parse(t))})).sort((a, b) => b.v - a.v);
}
export function bot(s, r = Math.random, skill = 1, fast = false) {
  const o = options(s);
  if (s.phase === 'pat') {
    // Go for two when a play is more likely to make it than not (a tie is worth a half); people don't always.
    const best = candidates(s, fast)[0];
    return (best.v > 0.5) !== (r() < 0.15) ? best.token : tok.kick;
  }
  if (o.fg && o.fg.p >= 0.5) {
    const lateKick = s.down === 4 || s.clock <= 10 || (s.running && s.tos === 0 && s.clock <= HURRY + 6);
    if (lateKick) {
      if (s.running && s.clock <= FG_SET + 1 && o.timeout) return tok.timeout;
      if (!(s.running && s.clock <= FG_SET)) return tok.fg;
    }
  }
  if (s.running) {
    if (s.clock <= HURRY + 1) { if (o.timeout) return tok.timeout; if (o.spike) return tok.spike; }
    if (s.clock <= 40 && o.timeout && 100 - s.ball > 20) return tok.timeout;
  }
  const list = candidates(s, fast);
  if (skill >= 1) return list[0].token;
  const u = r();
  return list[u < skill ? 0 : u < (1 + skill) / 2 ? 1 : 2].token;
}
/** Plays a drive out with the bot from where it is. */
export function finish(s, r, skill = 0.8, fast = false) {
  for (let i = 0; !s.result && i < 120; i++) {
    if (!act(s, bot(s, r, skill, fast))) act(s, tok.run('s', false)) || act(s, tok.kick);
  }
  return s;
}
/** A copy of the drive to play out a different future: the same spot and what's shown now, new dice after it. */
function fork(s, salt) {
  return Object.assign({}, s, {sc: Object.assign({}, s.sc, {s: (mix(s.sc.s, salt) >>> 0) || 1}), plays: []});
}
const value = s => (s.result === 'W' ? 1 : s.result === 'T' ? 0.5 : 0);
/** The chance of coming back (a tie counts a half) from here, played out n times by the bot. */
export function winChance(s, n = 120, salt = 7) {
  if (s.result) return value(s);
  let v = 0;
  for (let i = 0; i < n; i++) {
    const f = fork(s, salt * 1000 + i);
    // The snap shown now keeps its look, lean and routes; the defense's real call is redrawn in every future.
    v += value(finish(f, dice(salt, i, 0xb07), 0.8, true));
  }
  return v / n;
}
/** Every option at this snap with its win chance (each played out n times): [{token, wp}], best first. tokens: which
 *  to score (default: the runs, the RPOs, a throw to each receiver on his route, the trick play, the field goal). */
export function scoreOptions(s, tokens, n = 60, salt = 11) {
  const list = tokens || defaultOptions(s);
  // The same n futures for every option (the defense's real call included), so they're compared fairly.
  return list.map(t => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const f = fork(s, salt * 1000 + i);
      if (!act(f, t)) { v = -1; break; }
      v += value(finish(f, dice(salt, i, 0xb07), 0.8, true));
    }
    return {token: t, wp: v < 0 ? null : v / n};
  }).filter(x => x.wp != null).sort((a, b) => b.wp - a.wp);
}
export function defaultOptions(s, routes = s.routes) {
  const o = options(s);
  const out = ['s', 'w'].map(d => tok.run(d)).concat(['s', 'w'].map(d => tok.rpo(d)));
  TARGETS.forEach(slot => out.push(tok.pass(slot, routes[slot])));
  if (s.trick) out.push(tok.trick);
  if (o.fg) out.push(tok.fg);
  if (s.phase === 'pat') out.push(tok.kick);
  return out;
}

// ---------------------------------------------------------------------------------------------- Survivor
/** Survivor's drive i of a run: random teams and a harder spot each time. ids: the team ids. */
export function survivorScenario(seed, i, ids) {
  const r = dice(seed, i, 0x5a5a);
  const o = ids[Math.floor(r() * ids.length)];
  let d = ids[Math.floor(r() * ids.length)];
  if (d === o) d = ids[(ids.indexOf(o) + 1) % ids.length];
  const hard = Math.min(i, 12);
  const deficit = pickW(r, [[2, 1], [3, 1.4], [4, 2], [5, 1], [6, 1.6], [7, 1.2 + hard * 0.15]]);
  const them = 17 + 3 * Math.floor(r() * 5);
  const t = Math.max(38, Math.round(124 - 6 * hard + 20 * (r() - 0.5)));
  const b = Math.max(12, Math.round(36 - 1.6 * hard + 10 * (r() - 0.5)));
  const to = Math.max(0, Math.min(3, 3 - Math.floor(hard / 3) - (r() < 0.3 ? 1 : 0)));
  return {o, d, us: them - deficit, them, t, b, to, s: mix(seed, i + 1) >>> 0};
}
