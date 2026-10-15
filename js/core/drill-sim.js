// Two-Minute Drill engine: one drive, snap by snap. Pure functions, no DOM and no imports, so node runs it too
// (tools/drill/tune.mjs sets each day's situation with it). Owner: Drill.
//
// A drive is a scenario {o, d (team ids), us, them (the score), t (seconds left), b (the ball: yards from your own goal
// line), to (your timeouts), s (the seed)} plus the actions taken, one character each (ACT). Everything follows from
// the two: replay(sc, teams, acts) rebuilds the drive, so a phone stores only the action string, a friend's drive can
// be shown from theirs, and the same calls in the same spots get the same results for everyone.
//
// Randomness: a counter-based generator (integer hash, no Math.random) keyed by the seed, the snap number and the
// call, so a snap's dice don't depend on what was called before it. The engine uses only + - * / and comparisons on
// its numbers (no exp or log, whose last bits differ between browsers), so every phone computes the same drive.
//
// THE DEFENSE shows a look before each snap (LOOKS), drawn for the situation. THE CALLS: run, pass (short, sideline,
// deep), RPO (the QB reads the box: pulls it against a light one, throws quick against a crowded one) and one trick
// play a drive. A call does well or badly against a look (MOD), and the players matter: each snap pits your QB, the
// receiver he throws to and your line against the defender on that receiver, the safeties and the pass rush (or your
// back and line against the front and the linebackers). THE CLOCK: a run, a sack or a catch in bounds keeps it
// running, and the next snap comes HURRY seconds later; an incompletion, going out of bounds, a timeout or a spike
// stops it. The two-minute warning stops it once. Down 1-3 a field goal is there; down 7 a touchdown brings the choice:
// kick to tie, or go for two to win.

export const LOOKS = {
  box: {name: 'Loaded box', sub: '7 or more near the line'},
  blitz: {name: 'Blitz', sub: '6 or more coming for the QB'},
  two: {name: 'Two-high shell', sub: 'Both safeties deep'},
  prevent: {name: 'Prevent', sub: 'Three rush, everyone else deep'},
  man: {name: 'Press man', sub: 'Tight on every receiver, one safety deep'}
};
export const LOOK_IDS = Object.keys(LOOKS);

// Actions, one character each.
export const ACT = {
  run: 'r', short: 's', side: 'l', deep: 'd', rpo: 'o', trick: 'x',
  spike: 'k', timeout: 't', fg: 'f', kick: 'p',
  run2: 'R', pass2: 'S', rpo2: 'O', trick2: 'X'
};
const CALL_OF = Object.fromEntries(Object.entries(ACT).map(([k, v]) => [v, k]));
export const callOf = ch => CALL_OF[ch] || null;
export const PLAYS = ['run', 'short', 'side', 'deep', 'rpo', 'trick'];
export const TWO_PT = ['run2', 'pass2', 'rpo2', 'trick2'];

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

// ---------------------------------------------------------------------------------------------- the model
// Calls on a neutral look with even players. comp: completion; air/airSd/yac: yards; sack, int; big: a broken
// tackle; oob: out of bounds after the catch; t: seconds the play takes. rpo: its quick throw (the pass read).
const PASS = {
  short: {comp: 0.70, air: 4.0, airSd: 2.5, yac: 2.5, sack: 0.045, int: 0.018, big: 0.04, oob: 0.14, t: 5, tg: [['WR3', 3], ['TE', 3], ['RB', 2], ['WR1', 1], ['WR2', 1]]},
  side: {comp: 0.60, air: 9.0, airSd: 3.0, yac: 1.0, sack: 0.055, int: 0.026, big: 0.02, oob: 0.78, t: 5, tg: [['WR1', 4.5], ['WR2', 4.5], ['WR3', 1]]},
  deep: {comp: 0.36, air: 27, airSd: 7.0, yac: 3.0, sack: 0.085, int: 0.05, big: 0.15, oob: 0.30, t: 7, tg: [['WR1', 4.5], ['WR2', 3.5], ['WR3', 1], ['TE', 1]]},
  rpo: {comp: 0.80, air: 3.5, airSd: 2.0, yac: 2.5, sack: 0.012, int: 0.012, big: 0.04, oob: 0.20, t: 5, tg: [['WR3', 4], ['TE', 3], ['WR1', 1.5], ['WR2', 1.5]]}
};
const RUN = {mean: 4.2, sd: 3.0, stuff: 0.08, big: 0.045, fum: 0.012, oob: 0.08, t: 6};
// How each look changes each call. Missing numbers: no change (comp/air/yac/mean add; the rest multiply). rpo: 'run'
// when the QB keeps it on the ground against this look, else his quick throw's changes.
export const MOD = {
  box: {run: {mean: -2.3, big: 0.5, stuff: 1.8}, short: {comp: 0.04, yac: 1.0, big: 1.2, int: 0.9}, side: {comp: 0.06, int: 0.9},
    deep: {comp: 0.12, air: 3, int: 0.7, big: 1.4, sack: 1.2}, rpo: {comp: 0.04}, trick: 0.62},
  blitz: {run: {mean: -1.0, big: 1.8, stuff: 1.5}, short: {comp: 0.05, yac: 2.5, big: 1.6}, side: {comp: -0.02, sack: 1.8, int: 1.1},
    deep: {comp: -0.04, air: 2, sack: 2.8, int: 1.3}, rpo: {comp: 0.02, yac: 1}, trick: 0.5},
  two: {run: {mean: 1.9, big: 1.2, stuff: 0.6}, short: {comp: 0.03}, side: {comp: -0.14, int: 2.0},
    deep: {comp: -0.14, air: -2, int: 1.7, big: 0.6}, rpo: 'run', trick: 0.28},
  prevent: {run: {mean: 2.6, big: 0.6, stuff: 0.4, oob: 0.4}, short: {comp: 0.12, yac: 2.5, sack: 0.5, int: 0.6, oob: 0.5},
    side: {comp: 0.02, sack: 0.5, oob: 0.85}, deep: {comp: -0.22, int: 2.4, sack: 0.6, big: 0.3}, rpo: 'run', trick: 0.14},
  man: {run: {mean: 0.5, big: 1.2}, short: {comp: -0.10, yac: 0.5, sack: 1.2, int: 1.2}, side: {comp: -0.03, sack: 1.2},
    deep: {comp: 0.06, air: 2, sack: 1.3, int: 1.1, big: 1.3, duel: 1.8}, rpo: {comp: -0.06}, trick: 0.45}
};
const add = (m, k) => (m && m[k]) || 0;
const mul = (m, k) => (m && m[k] != null ? m[k] : 1);

/** The look for snap i: weights by situation, then the dice. */
export function lookFor(s) {
  const w = {box: 0.18, blitz: 0.17, two: 0.27, prevent: 0.13, man: 0.25};
  if (s.phase === 'pat') { w.two = 0; w.prevent = 0; w.box = 0.4; w.man = 0.35; w.blitz = 0.25; }
  else {
    if (s.togo <= 3) { w.box *= 2.2; w.prevent *= 0.4; w.two *= 0.7; }
    if (s.togo >= 10) { w.two *= 1.3; w.prevent *= 1.2; w.box *= 0.6; }
    if (s.clock <= 40) { w.prevent *= 2.0; w.blitz *= 0.7; }
    if (s.ball >= 80) { w.prevent *= 0.1; w.two *= 0.8; w.man *= 1.4; w.blitz *= 1.3; w.box *= 1.2; }
    else if (s.ball <= 30) w.prevent *= 0.5;
    const D = s.U.d;
    if (D.rush > 0.3) w.blitz *= 0.8;
    if (avg([D.by.LCB, D.by.RCB].map(p => c(p.r))) > 0.3) w.man *= 1.3;
  }
  return pickW(dice(s.sc.s, s.snap, 0x100), LOOK_IDS.map(k => [k, w[k]]));
}

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

// ---------------------------------------------------------------------------------------------- the drive
/** A new drive. sc: the scenario; teams: data/drill.json's teams. */
export function start(sc, teams) {
  const O = teams[sc.o], D = teams[sc.d];
  const s = {
    sc, U: {o: units(O), d: units(D)},
    us: sc.us, them: sc.them, clock: sc.t, ball: sc.b, down: 1, togo: Math.min(10, 100 - sc.b), tos: sc.to,
    running: false, warned: sc.t <= WARN, trick: true, snap: 0, phase: 'play', result: null, why: '', plays: [], best: sc.b, look: null
  };
  s.look = lookFor(s);
  return s;
}

/** What can be done now: {plays: [...calls], spike, timeout, fg: {dist, p} | null, pat: bool}. */
export function options(s) {
  if (s.result) return {plays: [], spike: false, timeout: false, fg: null, pat: false};
  if (s.phase === 'pat') return {plays: TWO_PT.slice(), spike: false, timeout: false, fg: null, pat: true};
  const deficit = s.them - s.us;
  const fg = deficit <= 3 ? fgOdds(s) : null;
  return {
    plays: PLAYS.filter(k => k !== 'trick' || s.trick),
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
    if (!during) s.clock = WARN; // between plays: it stops right at 2:00
    s.running = false;
    s.warnStop = true;
  }
  return s.clock > 0;
}

/** Before a snap from a running clock: the time it takes to get it off. false when time ran out first. */
function preSnap(s, sec) {
  if (!s.running) return true;
  if (!tick(s, sec, false)) { end(s, 'L', 'clock'); return false; }
  if (s.warnStop) { s.warnStop = false; s.preWarn = true; } // stopped at 2:00 before this snap
  return true;
}

function pickReceiver(r, s, k, look) {
  const {o, d} = s.U, B = PASS[k];
  const duel = mul(MOD[look][k], 'duel');
  return pickW(r, B.tg.map(([slot, w]) => {
    const p = o.by[slot], m = d.by[d.cover[slot]];
    return [slot, w * clamp(1.2 + 0.6 * duel * (c(p.r) - c(m.r)), 0.25, 3)];
  }));
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
/** A defender for a tackle, a sack or a pick, by rating. */
function whoDef(r, s, pool) {
  const d = s.U.d;
  return pickW(r, pool.map(slot => [slot, 0.6 + Math.max(0, c(d.by[slot].r) + 1)]));
}

/** One pass play's result: {kind: 'sack'|'int'|'inc'|'catch'|'fum', gain, who, by, oob, t}. */
function passPlay(r, s, k, look, opts = {}) {
  const B = PASS[k], M = MOD[look][k] || {};
  const red = s.ball >= 80;
  const pSack = clamp(B.sack * mul(M, 'sack') * (1 + 0.9 * rushEdge(s)), 0.004, 0.4);
  if (r() < pSack) {
    const loss = 4 + Math.floor(5 * r()) + (r() < 0.12 ? 3 : 0);
    const by = whoDef(r, s, s.U.d.front.concat(look === 'blitz' ? s.U.d.lbs.concat('NB') : []));
    if (r() < 0.06) return {kind: 'fum', gain: -loss, by, t: 6};
    return {kind: 'sack', gain: -loss, by, t: 6};
  }
  const slot = pickReceiver(r, s, k, look);
  const e = passEdge(s, slot, mul(M, 'duel'));
  const pInt = clamp(B.int * mul(M, 'int') * (1 - 1.2 * e), 0.004, 0.15);
  let pComp = clamp(B.comp + add(M, 'comp') + 0.22 * e - (red && k === 'deep' ? 0.08 : 0) + (opts.comp || 0), 0.08, 0.95);
  const u = r();
  const def = s.U.d.by[s.U.d.cover[slot]];
  if (u < pInt) return {kind: 'int', gain: 0, who: slot, by: def.slot, t: B.t};
  if (u >= pInt + pComp) return {kind: 'inc', gain: 0, who: slot, by: def.slot, t: B.t};
  let air = Math.max(k === 'deep' ? 15 : k === 'side' ? 4 : -1, B.air + add(M, 'air') + 3 * e + B.airSd * gauss(r));
  let yac = Math.max(0, B.yac + add(M, 'yac') + 2 * e + 2 * gauss(r));
  if (r() < B.big * mul(M, 'big') * (1 + e)) yac += 10 + 35 * r();
  const gain = Math.round(air + yac);
  const oob = r() < B.oob * mul(M, 'oob');
  return {kind: 'catch', gain, who: slot, by: def.slot, oob, t: B.t + Math.floor(2 * r())};
}

function runPlay(r, s, look, bonus = 0) {
  const M = MOD[look].run;
  const e = runEdge(s);
  let g;
  if (r() < RUN.stuff * mul(M, 'stuff') * (1 - 0.5 * e)) g = -1 - Math.floor(3 * r());
  else g = RUN.mean + add(M, 'mean') + bonus + 2.4 * e + RUN.sd * gauss(r);
  if (r() < RUN.big * mul(M, 'big') * (1 + e)) g += 10 + 30 * r();
  const by = whoDef(r, s, s.U.d.lbs.concat(s.U.d.front, ['SS']));
  if (r() < RUN.fum) return {kind: 'fum', gain: Math.round(g), who: 'RB', by, t: RUN.t};
  return {kind: 'run', gain: Math.round(g), who: 'RB', by, oob: r() < RUN.oob * mul(M, 'oob'), t: RUN.t + Math.floor(2 * r())};
}

function trickPlay(r, s, look) {
  const p = clamp(MOD[look].trick + 0.12 * passEdge(s, 'WR1'), 0.05, 0.8);
  if (r() < p) {
    const slot = r() < 0.6 ? 'WR1' : 'WR2';
    return {kind: 'catch', gain: Math.round(22 + 23 * r()), who: slot, by: s.U.d.cover[slot], oob: r() < 0.3, t: 8, trick: true};
  }
  const u = r();
  if (u < 0.5) return {kind: 'inc', gain: 0, who: 'WR1', by: 'LCB', t: 7, trick: true};
  if (u < 0.82) {
    const by = whoDef(r, s, s.U.d.front);
    return {kind: r() < 0.08 ? 'fum' : 'sack', gain: -(7 + Math.floor(6 * r())), by, t: 7, trick: true};
  }
  return {kind: 'int', gain: 0, who: 'WR1', by: r() < 0.5 ? 'FS' : 'SS', t: 7, trick: true};
}

/** The two-point try: one play from the 2. true when it's good. */
function twoPoint(r, s, k, look) {
  const base = {run2: 0.46, pass2: 0.47, rpo2: 0.48, trick2: 0.42}[k];
  const m = {
    box: {run2: -0.14, pass2: 0.08, rpo2: 0.06, trick2: 0.14},
    blitz: {run2: -0.04, pass2: 0.06, rpo2: 0.02, trick2: 0.1},
    man: {run2: 0.08, pass2: -0.08, rpo2: 0.02, trick2: 0.04}
  }[look] || {};
  const e = k === 'run2' ? runEdge(s) : passEdge(s, 'TE');
  return r() < clamp(base + (m[k] || 0) + 0.15 * e, 0.1, 0.9);
}

/** Takes one action (an ACT character) and returns the play it made (also pushed on s.plays), or null when it isn't
 *  allowed now. Mutates s. */
export function act(s, ch) {
  const k = callOf(ch);
  const o = options(s);
  if (!k || s.result) return null;
  const before = {n: s.snap, down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, running: s.running, look: s.look, tos: s.tos};
  const play = Object.assign({act: ch, call: k}, before);
  s.warnStop = false;
  s.preWarn = false;

  if (k === 'timeout') {
    if (!o.timeout) return null;
    s.tos -= 1;
    s.running = false;
    play.kind = 'timeout';
    return push(s, play);
  }
  if (s.phase === 'pat') {
    if (k === 'kick') {
      s.us += 1;
      play.kind = 'xp';
      end(s, s.us > s.them ? 'W' : 'T', 'xp');
      return push(s, play);
    }
    if (!o.plays.includes(k)) return null;
    const r = dice(s.sc.s, s.snap, ch.charCodeAt(0));
    const good = twoPoint(r, s, k, s.look);
    s.snap += 1;
    play.kind = good ? '2good' : '2fail';
    if (good) { s.us += 2; end(s, s.us > s.them ? 'W' : 'T', '2pt'); }
    else end(s, s.us > s.them ? 'W' : s.us === s.them ? 'T' : 'L', '2pt');
    return push(s, play);
  }
  if (k === 'kick') return null;
  if (k === 'spike') {
    if (!o.spike) return null;
    if (!preSnap(s, SPIKE_SET)) { play.kind = 'expired'; return push(s, play); }
    tick(s, 1, true);
    s.snap += 1;
    s.down += 1;
    s.running = false;
    play.kind = 'spike';
    play.t1 = s.clock;
    return push(s, play);
  }
  if (k === 'fg') {
    if (!o.fg) return null;
    if (!preSnap(s, FG_SET)) { play.kind = 'expired'; return push(s, play); }
    const r = dice(s.sc.s, s.snap, ch.charCodeAt(0));
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
  if (!o.plays.includes(k)) return null;
  if (!preSnap(s, HURRY)) { play.kind = 'expired'; return push(s, play); }
  play.clock = s.clock; // at the snap
  const r = dice(s.sc.s, s.snap, ch.charCodeAt(0));
  const look = s.look;
  let res;
  if (k === 'run') res = runPlay(r, s, look);
  else if (k === 'rpo') res = MOD[look].rpo === 'run' ? Object.assign(runPlay(r, s, look, 0.5), {read: 'run'}) : Object.assign(passPlay(r, s, 'rpo', look), {read: 'pass'});
  else if (k === 'trick') { s.trick = false; res = trickPlay(r, s, look); }
  else res = passPlay(r, s, k, look);
  s.snap += 1;
  Object.assign(play, res);
  const alive = tick(s, res.t, true);
  play.t1 = s.clock;

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
      const lead = s.us - s.them;
      if (lead >= 0) { s.us += 1; end(s, 'W', 'td'); return push(s, play); }
      // Down 7 before it: tie it with the kick or go for two.
      s.phase = 'pat';
      s.running = false;
      s.ball = 98;
      s.look = lookFor(s);
      return push(s, play);
    }
    if (s.ball <= 0) { s.them += 2; play.safety = true; end(s, 'L', 'safety'); return push(s, play); }
    s.running = !(res.oob) && !s.warnStop;
    if (s.warnStop) s.running = false;
  }
  // The chains.
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

function push(s, play) {
  play.after = {down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, running: s.running, us: s.us, them: s.them, tos: s.tos};
  if (s.warnStop || s.preWarn) play.warn = true;
  s.plays.push(play);
  if (!s.result && play.kind !== 'timeout') s.look = lookFor(s);
  return play;
}

/** Rebuilds a drive from its action string. Stops at the first action that isn't allowed. */
export function replay(sc, teams, acts = '') {
  const s = start(sc, teams);
  for (const ch of String(acts)) { if (s.result || !act(s, ch)) break; }
  return s;
}
/** The actions a drive took, as one string (what a phone stores and posts). */
export const actsOf = s => s.plays.map(p => p.act).join('');

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
