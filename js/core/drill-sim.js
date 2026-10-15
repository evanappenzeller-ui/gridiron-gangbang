// Two-Minute Drill engine: the end of a game, snap by snap. Pure functions, no DOM and no imports, so node runs it too
// (tools/drill/tune.mjs sets each day's situation with it). Owner: Drill.
//
// A game is a scenario {o (your team), d (theirs), us, them (the score), t (seconds left), b (the ball: yards from your
// own goal line), to (your timeouts), dto (theirs), s (the seed)} plus the actions you took (tokens, below). Everything
// follows from the two: replay(sc, teams, acts) rebuilds the game, so a phone stores only the action string, a friend's
// game can be shown from theirs, and the same call in the same spot gets the same result for everyone.
//
// Randomness: a counter-based generator (integer hash, no Math.random) keyed by the seed, the snap number and what was
// called, so a snap's dice don't depend on what came before. The engine uses only + - * / and comparisons on its
// numbers (no exp or log, whose last bits differ between browsers), so every phone plays the same game.
//
// THE GAME runs until the clock hits 0:00, and the final score is the result: a win, a tie (overtime) or a loss.
// You start with the ball, down late. Score with time left and you kick off: they get it at their 25 and you call the
// defense. They can answer, and you get it back. A turnover gives them the ball where it happened; a team ahead with
// the ball and few enough seconds left takes a knee and the game is over.
// ON OFFENSE you see the defense's look (LOOKS) and which side its front leans to (shade), and pick a play, like a
// playbook: three of each type. Pass: three pass plays a snap (PASS_PLAYS, offered in s.book: every receiver's route;
// you can change any), then the receiver to throw to (with play action, a roll out, or the receiver getting out of
// bounds). Run: Inside Zone, HB Toss or HB Draw (RUNS), to the strong or weak side. RPO: the zone run with a slant, a
// bubble or a seam to throw when the box is loaded (RPOS). Trick: the flea flicker, the halfback pass or the double
// reverse (TRICKS), one a game. At the snap the defense's real call is drawn from what that look usually means
// (CALLS_FOR); each call takes some things away and gives others up (FX), so the odds shown before a throw (odds()) are
// the look's average, and the breakdown says what they were really in. And the clock tools: timeout, spike, field
// goal, kneel (when you lead). Down 1 or 2 after a touchdown: kick, or go for two from the 2 (any play).
// ON DEFENSE you see their formation (FORMS: how likely a pass is) and pick a call (DEF_CALLS); their play is drawn at
// the snap from the formation and the situation, whatever you call, and plays out against your call. They manage
// their own clock (hurry or milk it, timeouts, spikes), kick field goals, punt when ahead, and kneel when they can.
// THE CLOCK: a catch or run in bounds or a sack keeps it running, and the next snap comes HURRY seconds later (MILK
// when the team ahead is running it out); an incompletion, going out of bounds, a timeout, a spike or a change of
// possession stops it; the two-minute warning stops it once.
// THE PLAYERS: every snap pits the QB, the receiver and the line against his man, the safeties and the rush (or the
// back and the line against the front and the linebackers); man coverage leans on the one-on-one far harder than zone.
// Also here: odds() for the pass menu, bots for both sides (bot, defBot) and win chances from any spot and for every
// option at a snap (winChance, scoreOptions), by playing the rest of the game out many times.

export const LOOKS = {
  box: {name: 'Loaded box', sub: '7 or more near the line'},
  light: {name: 'Light box', sub: '6 or fewer near the line'},
  two: {name: 'Two-high shell', sub: 'Both safeties deep'},
  blitz: {name: 'Blitz look', sub: 'Linebackers up in the gaps'},
  prevent: {name: 'Prevent', sub: 'Everyone deep'}
};
export const LOOK_IDS = Object.keys(LOOKS);
/** The defense's calls. what: in a breakdown's words; short: on the defense menu. */
export const CALLS = {
  c2: {name: 'Cover 2', short: 'Two deep, corners on the sideline', what: 'two deep safeties, corners sitting on the sideline'},
  c3: {name: 'Cover 3', short: 'Three deep, four underneath', what: 'three deep, four underneath'},
  c4: {name: 'Quarters', short: 'Four deep: nothing over the top', what: 'four deep, nothing over the top'},
  c1: {name: 'Cover 1', short: 'Man to man, one safety deep', what: 'man to man, one safety deep'},
  c0: {name: 'Cover 0', short: 'Everybody blitzes, nobody deep', what: 'everybody blitzing, nobody deep'},
  fire: {name: 'Zone blitz', short: 'Five rush, three deep', what: 'five rushing, three deep'},
  rb: {name: 'Run blitz', short: 'Eight crash the line', what: 'eight crashing the line'},
  pv: {name: 'Prevent', short: 'Everyone deep, rush three', what: 'everybody deep, three rushing'}
};
export const DEF_CALLS = ['c2', 'c3', 'c4', 'c1', 'c0', 'fire', 'rb', 'pv'];
export const CALLS_FOR = {
  box: [['rb', 0.35], ['c1', 0.35], ['c0', 0.15], ['c3', 0.15]],
  light: [['c2', 0.3], ['c4', 0.35], ['c3', 0.25], ['pv', 0.1]],
  two: [['c2', 0.45], ['c4', 0.35], ['c1', 0.1], ['fire', 0.1]],
  blitz: [['c0', 0.35], ['fire', 0.35], ['c1', 0.2], ['c2', 0.1]],
  prevent: [['pv', 0.75], ['c4', 0.25]]
};
/** Their formations on your defense: name, sub (what it tells you), pass (how often it's a pass). */
export const FORMS = {
  spread: {name: 'Shotgun spread', sub: 'Four wide: a pass is likely', pass: 0.78},
  empty: {name: 'Empty backfield', sub: 'Five wide: almost surely a pass', pass: 0.95},
  pistol: {name: 'Pistol', sub: 'Could be either', pass: 0.5},
  heavy: {name: 'Heavy set', sub: 'Two tight ends: a run is likely', pass: 0.25}
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
// THE PLAYBOOK: three plays of each type to pick from, like a play-call screen.
/** Pass plays: every receiver's route. Three are offered at each of your snaps (s.book); a throw names its card. */
export const PASS_PLAYS = {
  verts: {name: 'Four Verticals', routes: {WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'angle'}},
  postdig: {name: 'Post Dig', routes: {WR1: 'dig', WR2: 'post', WR3: 'slant', TE: 'drag', RB: 'flat'}},
  smash: {name: 'Smash', routes: {WR1: 'curl', WR2: 'out', WR3: 'corner', TE: 'dig', RB: 'flat'}},
  slantwheel: {name: 'Slant Wheel', routes: {WR1: 'slant', WR2: 'slant', WR3: 'out', TE: 'seam', RB: 'wheel'}},
  levels: {name: 'Levels', routes: {WR1: 'out', WR2: 'dig', WR3: 'seam', TE: 'out', RB: 'angle'}},
  dagger: {name: 'Dagger', routes: {WR1: 'post', WR2: 'curl', WR3: 'dig', TE: 'drag', RB: 'flat'}},
  outs: {name: 'Quick Outs', routes: {WR1: 'out', WR2: 'out', WR3: 'out', TE: 'drag', RB: 'flat'}},
  mesh: {name: 'Mesh', routes: {WR1: 'dig', WR2: 'curl', WR3: 'slant', TE: 'drag', RB: 'wheel'}},
  corners: {name: 'Double Corner', routes: {WR1: 'post', WR2: 'go', WR3: 'corner', TE: 'corner', RB: 'angle'}},
  hail: {name: 'Hail Mary', routes: {WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'wheel'}}
};
const BOOK = ['verts', 'postdig', 'smash', 'slantwheel', 'levels', 'dagger', 'outs', 'mesh', 'corners'];
/** Runs. mean, sd: yards added and the spread; lean: how much the front's lean counts; stuff, big, oob: multiply
 *  stuffs, breakaways and sideline exits; t: seconds added (the draw waits). */
export const RUNS = {
  z: {name: 'Inside Zone', what: 'Downhill between the tackles', mean: 0, sd: 3, lean: 1, stuff: 1, big: 1, oob: 1, t: 0},
  t: {name: 'HB Toss', what: 'Pitch it outside: boom or bust', mean: -0.4, sd: 4.4, lean: 1.6, stuff: 1.3, big: 1.8, oob: 1.8, t: 0},
  d: {name: 'HB Draw', what: 'Show pass, then hand it off', mean: 0, sd: 3.2, lean: 0.4, stuff: 1, big: 1.2, oob: 0.5, t: 1}
};
/** The draw against each call: it eats up a rush and soft coverage, and dies against a run blitz. */
export const DRAW = {c0: 2.5, fire: 2, pv: 1.8, c2: 1, c4: 0.6, c3: 0, c1: -0.6, rb: -3};
/** RPOs: the zone run, or the throw when the read says the box is loaded. */
export const RPOS = {
  s: {name: 'RPO Slant', what: 'Run it, or the slot on a slant', slot: 'WR3', route: 'slant'},
  b: {name: 'RPO Bubble', what: 'Run it, or the slot on a bubble', slot: 'WR3', route: 'flat'},
  g: {name: 'RPO Seam', what: 'Run it, or the tight end up the seam', slot: 'TE', route: 'seam'}
};
/** Trick plays (one a game). */
export const TRICKS = {
  f: {name: 'Flea Flicker', what: 'Handoff, pitch back, then deep'},
  h: {name: 'HB Pass', what: 'The back pulls up and throws'},
  r: {name: 'Double Reverse', what: 'The receiver comes back the other way'}
};
/** How often each trick works against each call (the flea flicker's is FX's trick). */
const TRICK_ODDS = {
  h: {rb: 0.6, c0: 0.5, c1: 0.45, fire: 0.4, c3: 0.3, c2: 0.25, c4: 0.2, pv: 0.1},
  r: {rb: 0.55, c0: 0.55, fire: 0.5, c1: 0.4, c3: 0.3, c2: 0.35, c4: 0.3, pv: 0.25}
};
/** How often a trick play (TRICKS) works against a call. */
export const trickOdds = (play, call) => (play === 'f' ? FX[call].trick : TRICK_ODDS[play][call]);

export const HURRY = 15;     // seconds between snaps while the clock runs (a quick huddle)
export const NO_HUDDLE = 7;  // ... with no huddle at all: lined up and snapped, a little less set (+h)
export const MILK = 38;      // ... when the team ahead lets it run
export const KNEEL = 40;     // a kneel and the play clock after it
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
    T, by, k, front, lbs,
    qb: r('QB'), rb: r('RB'), ol: avg(['LT', 'LG', 'C', 'RG', 'RT'].map(r)),
    rush: avg(front.map(r)), lb: avg(lbs.map(r)), saf: avg(['SS', 'FS'].map(r)), kick: c(k.r),
    // Who covers whom (as the defense): the receivers and their men.
    cover: {WR1: 'LCB', WR2: 'RCB', WR3: 'NB', TE: 'SS', RB: lbs[0]}
  };
  UNITS.set(T, u);
  return u;
}
/** Offense and defense units for a possession ('us': you have the ball). */
export const unitsFor = (s, poss) => (poss === 'us' ? {o: s.mine, d: s.theirs} : {o: s.theirs, d: s.mine});
/** The team ids for a possession: {o (with the ball), d}. */
export const idsFor = (s, poss) => (poss === 'us' ? {o: s.sc.o, d: s.sc.d} : {o: s.sc.d, d: s.sc.o});
// The players: how much better the offense is on this snap (about -1..1; EDGE scales how much it moves the dice).
const EDGE = 0.6;
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
/** How far the team with the ball trails (negative: it leads). */
const behind = s => (s.poss === 'us' ? s.them - s.us : s.us - s.them);

// ---------------------------------------------------------------------------------------------- tokens
// Your actions, one each, joined with commas in a game's action string:
//   p{target 0-4}{route}[+a play action][+r roll out][+o out of bounds][+h no huddle][+1|+2 the second or third pass
//     play offered]   a pass (p1dig, p0go+a, p4flat+o, p2slant+h+1)
//   r{s|w}[t|d][+o][+h]   a run to the strong (tight end) or weak side: Inside Zone, or the HB Toss or Draw (rs, rwt+o)
//   o{s|w}[b|g][+o][+h]   an RPO: the slant, or the bubble or seam (os, owb)
//   (+h, no huddle: from a running clock the snap comes NO_HUDDLE seconds later instead of HURRY, a little less set)
//   x[h|r]  a trick play: the flea flicker, or the HB pass or double reverse
//   k  spike   t  timeout   f  field goal   n  kneel   e  the extra point (after a touchdown, down 1-2)
//   d{call}   on defense: the call (dc2, dc1, drb, dpv, ...)
export function parse(tok) {
  const [head, ...fl] = String(tok).split('+');
  const card = fl.length && (fl[fl.length - 1] === '1' || fl[fl.length - 1] === '2') ? Number(fl.pop()) : 0;
  const flags = {a: fl.includes('a'), r: fl.includes('r'), o: fl.includes('o'), h: fl.includes('h')};
  if (fl.some(f => !['a', 'r', 'o', 'h'].includes(f))) return null;
  if (flags.h && !['p', 'r', 'o'].includes(head[0])) return null; // only a pass, a run or an RPO goes without a huddle
  const k = head[0];
  if (k === 'p') {
    const i = Number(head[1]), route = head.slice(2), slot = TARGETS[i];
    return slot && ROUTES_FOR[slot].includes(route) ? {kind: 'pass', slot, i, route, card, flags} : null;
  }
  if (card) return null; // only a pass comes from a card
  if (k === 'r' || k === 'o') {
    const book = k === 'r' ? RUNS : RPOS, base = k === 'r' ? 'z' : 's', play = head[2] || base;
    const ok = (head[1] === 's' || head[1] === 'w') && head.length <= 3 && book[play] && (head.length === 2 || play !== base);
    return ok ? {kind: k === 'r' ? 'run' : 'rpo', dir: head[1], play, flags} : null;
  }
  if (k === 'x') {
    const play = head[1] || 'f';
    return TRICKS[play] && (head.length === 1 || (head.length === 2 && play !== 'f')) && !fl.length ? {kind: 'trick', play, flags} : null;
  }
  if (k === 'd' && !fl.length) { const call = head.slice(1); return DEF_CALLS.includes(call) ? {kind: 'def', call, flags} : null; }
  const one = {k: 'spike', t: 'timeout', f: 'fg', e: 'kick', n: 'kneel'}[k];
  return one && head.length === 1 && !fl.length ? {kind: one, flags} : null;
}
export const tok = {
  pass: (slot, route, f = {}) => `p${TARGETS.indexOf(slot)}${route}${f.a ? '+a' : ''}${f.r ? '+r' : ''}${f.o ? '+o' : ''}${f.h ? '+h' : ''}${f.c ? '+' + f.c : ''}`,
  run: (dir, oob, play = 'z', h = false) => `r${dir}${play === 'z' ? '' : play}${oob ? '+o' : ''}${h ? '+h' : ''}`,
  rpo: (dir, oob, play = 's', h = false) => `o${dir}${play === 's' ? '' : play}${oob ? '+o' : ''}${h ? '+h' : ''}`,
  tricks: play => (play === 'f' ? 'x' : 'x' + play),
  def: call => `d${call}`,
  trick: 'x', spike: 'k', timeout: 't', fg: 'f', kick: 'e', kneel: 'n'
};

// ---------------------------------------------------------------------------------------------- the snap
/** At the goal line (and on a two-point try) the defense is stacked and there's no room to throw. */
const goalLine = s => s.phase === 'pat' || s.ball >= 96;
/** What's shown before the snap: on offense the look, its lean and your routes; on defense their formation. */
function setSnap(s) {
  const r = dice(s.sc.s, s.snap, 0x100);
  if (s.poss === 'them') {
    const lead = s.them > s.us;
    const w = lead ? {heavy: 0.5, pistol: 0.35, spread: 0.15, empty: 0}
      : s.clock <= 75 || behind(s) > 3 ? {spread: 0.5, empty: 0.28, pistol: 0.17, heavy: 0.05} : {spread: 0.4, empty: 0.1, pistol: 0.3, heavy: 0.2};
    if (s.togo <= 2) { w.heavy += 0.3; w.empty *= 0.5; }
    s.form = pickW(r, Object.keys(FORMS).map(k => [k, w[k] || 0]));
    s.look = null;
    s.shade = r() < 0.5 ? 's' : 'w';
    s.book = null;
    s.routes = Object.assign({}, PASS_PLAYS[BOOK[Math.floor(r() * BOOK.length)]].routes);
    return;
  }
  const w = {box: 0.16, light: 0.30, two: 0.24, blitz: 0.15, prevent: 0.15};
  if (s.phase === 'pat') { w.light = 0; w.prevent = 0; w.two = 0.2; w.box = 0.45; w.blitz = 0.35; }
  else {
    if (s.togo <= 3) { w.box *= 2.4; w.light *= 0.6; w.prevent *= 0.4; }
    if (s.togo >= 10) { w.light *= 1.2; w.two *= 1.2; w.box *= 0.6; }
    if (s.clock <= 40) { w.prevent *= 2.0; w.blitz *= 0.7; }
    if (s.ball >= 80) { w.prevent *= 0.1; w.two *= 0.8; w.blitz *= 1.4; w.box *= 1.3; }
    else if (s.ball <= 30) w.prevent *= 0.5;
    if (behind(s) < 0) { w.prevent = 0; w.box *= 2; } // you lead: they sell out to get the ball back
    if (s.U.d.rush > 0.3) w.blitz *= 0.8;
  }
  s.form = null;
  s.look = pickW(r, LOOK_IDS.map(k => [k, w[k]]));
  s.shade = r() < 0.5 ? 's' : 'w';
  // Three pass plays to pick from: no Four Verticals in the red zone, and a Hail Mary when it's down to one shot.
  const pool = BOOK.filter(k => !(k === 'verts' && s.ball >= 80));
  const book = [];
  while (book.length < 3) { const k = pool[Math.floor(r() * pool.length)]; if (!book.includes(k)) book.push(k); }
  if (s.phase === 'play' && s.clock <= 12 && s.ball <= 65) book[2] = 'hail';
  s.book = book;
  s.routes = Object.assign({}, PASS_PLAYS[book[0]].routes);
}
/** The defense's real call at this snap when you have the ball (the same whatever you call). */
const callAt = s => pickW(dice(s.sc.s, s.snap, 0x300), CALLS_FOR[s.look]);

/** A field goal from the ball's spot for the team with it: {dist, p} (p 0 when it's out of range). */
export function fgOdds(s, ball = s.ball, kick = s.U.o.kick) {
  const dist = 100 - ball + 17;
  const d = dist - 3 * kick;
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
  let pSack = (0.02 + 0.035 * Math.max(0, time - 1.5)) * (slow ? F.sack : F.qs) * (1 + 0.9 * rushEdge(s)) * (f.r ? 0.55 : 1) * (f.h ? 1.3 : 1);
  pSack = clamp(pSack, 0.003, 0.45);
  const e = passEdge(s, slot, F.duel);
  let comp = R.comp - 0.04 + cd + 0.22 * e; // the defense sits on the sticks late: every window a bit tighter
  let yac = 0.6 * (R.yac + yd + 2 * e);
  if (f.a) { comp += fooled ? 0.06 : -0.02; if (fooled) yac += 1.5; }
  if (f.r) comp += ['out', 'sdeep', 'quick'].includes(R.cat) ? 0.03 : -0.03;
  if (f.h) comp -= 0.05; // no huddle: snapped before everyone's quite set
  if (s.ball >= 80 && (R.cat === 'deep' || R.cat === 'seam')) comp -= 0.06;
  if (goalLine(s)) { comp -= 0.3; yac *= 0.3; } // no room: every window is tight, a tackler right there
  let oob = R.oob * (F.oob || 1);
  if (f.o) { oob = Math.min(0.92, R.oob * 2 + 0.35); yac *= 0.45; }
  return {
    pSack, pComp: clamp(comp, 0.05, 0.95), pInt: clamp(R.int * im * (1 - 1.2 * e), 0.003, 0.2),
    depth: R.depth + 2 * e, yac: Math.max(0, yac), oob, big: 0.5 * R.big * (F.big || 1) * (1 + e), time
  };
}
/** The calls a play might meet: on your offense the look's mix; for theirs, any of yours alike. */
const DEF_MIX = DEF_CALLS.map(k => [k, 1 / DEF_CALLS.length]);
const mixOf = s => (s.poss === 'us' ? CALLS_FOR[s.look] : DEF_MIX);
/** The pass menu's numbers for a receiver on a route against this look: {caught, ypt (yards a throw), picked}, each
 *  averaged over what the look usually is. */
export function odds(s, slot, route, f = {}) {
  let caught = 0, ypt = 0, picked = 0;
  mixOf(s).forEach(([call, w]) => {
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
  if (u < m.pInt) return {kind: 'int', gain: 0, who: slot, route, air: Math.round(m.depth), by: deepZone && r() < 0.5 ? (r() < 0.5 ? 'FS' : 'SS') : by, ret: Math.floor(16 * r() * r()), t: Math.round(m.time + 3)};
  if (u >= m.pInt + m.pComp) return {kind: 'inc', gain: 0, who: slot, route, by, air: Math.round(m.depth), t: Math.round(m.time + 2)};
  const air = Math.max(R.cat === 'deep' ? 14 : R.cat === 'quick' ? -1 : 3, m.depth + 1.5 * gauss(r));
  let yac = Math.max(0, m.yac + 1.8 * gauss(r));
  let broke = false;
  if (r() < m.big) { yac += 8 + 22 * r(); broke = true; }
  const gain = Math.round(air + yac);
  return {kind: 'catch', gain, air: Math.round(air), who: slot, route, by, oob: r() < m.oob, broke, t: Math.round(1.8 + m.time + (air + yac) / 7)};
}
/** The mean gain of a run (RUNS[play]) against a call, before the dice. */
function runMean(s, dir, f, call, play = 'z') {
  const K = RUNS[play];
  return 2.8 + FX[call].run + K.mean + (play === 'd' ? DRAW[call] : 0) + (dir === s.shade ? -1.2 : 1.0) * K.lean
    + 2.2 * runEdge(s) + (f.o ? -0.8 : 0) + (f.h ? -0.8 : 0) - (goalLine(s) ? 3 : 0);
}
function runPlay(r, s, dir, f, call, bonus = 0, play = 'z') {
  const F = FX[call], K = RUNS[play];
  const e = runEdge(s);
  let g;
  if (r() < 0.08 * F.stuff * K.stuff * (1 - 0.5 * e) * (dir === s.shade ? 1.3 : 0.8)) g = -1 - Math.floor(3 * r());
  else g = runMean(s, dir, f, call, play) + bonus + K.sd * gauss(r);
  let broke = false;
  if (r() < 0.03 * F.big * K.big * (1 + e)) { g += 8 + 22 * r(); broke = true; }
  const by = whoDef(r, s, s.U.d.lbs.concat(s.U.d.front, ['SS']));
  g = Math.round(g);
  if (r() < 0.012) return {kind: 'fum', gain: g, who: 'RB', dir, rk: play, by, t: 6 + K.t};
  const oob = g > 0 && r() < Math.min(0.9, (f.o ? 0.55 : 0.08) * (F.oob || 1) * K.oob);
  return {kind: 'run', gain: g, who: 'RB', dir, rk: play, by, oob, broke, t: Math.round(5 + K.t + Math.max(0, g) / 8)};
}
function rpoPlay(r, s, dir, f, call, play = 's') {
  if (FX[call].rpo === 'pass') {
    const R = RPOS[play];
    const p = passPlay(r, s, R.slot, R.route, {o: f.o, h: f.h}, call === 'c0' ? 'c0' : 'rb');
    return Object.assign(p, {read: 'pass', dir, rpo: play});
  }
  return Object.assign(runPlay(r, s, dir, f, call, 0.6), {read: 'run', rpo: play});
}
function trickPlay(r, s, call, play = 'f') {
  const p = clamp(trickOdds(play, call) + 0.12 * passEdge(s, 'WR1'), 0.05, 0.8);
  if (play === 'r') {
    // The double reverse: the receiver comes back the other way. A run, so no pick, and the clock keeps going.
    const by = whoDef(r, s, s.U.d.lbs.concat(['SS', 'RCB']));
    if (r() < p) return {kind: 'run', gain: Math.round(10 + 20 * r()), who: 'WR1', dir: 'w', rk: 'r', by, oob: r() < 0.3, broke: false, t: 8, trick: 'r'};
    const u = r();
    if (u < 0.05) return {kind: 'fum', gain: -3, who: 'WR1', dir: 'w', by, t: 7, trick: 'r'};
    return {kind: 'run', gain: u < 0.6 ? -(2 + Math.floor(7 * r())) : Math.floor(5 * r()), who: 'WR1', dir: 'w', rk: 'r', by, oob: false, broke: false, t: 7, trick: 'r'};
  }
  if (r() < p) {
    const slot = r() < 0.6 ? 'WR1' : 'WR2';
    const gain = play === 'h' ? Math.round(16 + 20 * r()) : Math.round(22 + 23 * r());
    return {kind: 'catch', gain, who: slot, route: 'go', by: s.U.d.cover[slot], oob: r() < 0.3, t: 8, trick: play};
  }
  const u = r();
  if (play === 'h') {
    // The back throwing: more of them picked, or he's run down.
    if (u < 0.55) return {kind: 'inc', gain: 0, who: 'WR2', route: 'go', by: 'RCB', t: 7, trick: 'h'};
    if (u < 0.86) return {kind: 'sack', gain: -(4 + Math.floor(6 * r())), by: whoDef(r, s, s.U.d.front.concat(s.U.d.lbs)), t: 7, trick: 'h'};
    return {kind: 'int', gain: 0, who: 'WR2', route: 'go', air: 28, by: r() < 0.5 ? 'FS' : 'SS', ret: Math.floor(12 * r()), t: 7, trick: 'h'};
  }
  if (u < 0.5) return {kind: 'inc', gain: 0, who: 'WR1', route: 'go', by: 'LCB', t: 7, trick: 'f'};
  if (u < 0.82) return {kind: r() < 0.08 ? 'fum' : 'sack', gain: -(7 + Math.floor(6 * r())), by: whoDef(r, s, s.U.d.front), t: 7, trick: 'f'};
  return {kind: 'int', gain: 0, who: 'WR1', route: 'go', air: 30, by: r() < 0.5 ? 'FS' : 'SS', ret: Math.floor(12 * r()), t: 7, trick: 'f'};
}
/** Their play at a snap of theirs: from the formation and the situation, whatever you call. */
function theirPlay(s) {
  const r = dice(s.sc.s, s.snap, 0x400);
  const late = s.clock <= 75 && behind(s) >= 0;
  if (r() < FORMS[s.form].pass) {
    const list = candidates(s, true).filter(x => x.token[0] === 'p');
    const u = r();
    const i = u < 0.45 ? 0 : u < 0.7 ? 1 : u < 0.85 ? 2 : 3 + Math.floor(r() * Math.min(4, list.length - 3));
    return parse(list[Math.min(i, list.length - 1)].token);
  }
  return parse(tok.run(r() < 0.5 ? 's' : 'w', late && r() < 0.6, ['z', 'z', 't', 'd'][Math.floor(r() * 4)]));
}

// ---------------------------------------------------------------------------------------------- the game
/** A new game. sc: the scenario; teams: data/drill.json's teams. */
export function start(sc, teams) {
  const mine = units(teams[sc.o]), theirs = units(teams[sc.d]);
  const s = {
    sc, mine, theirs, U: {o: mine, d: theirs}, poss: 'us',
    us: sc.us, them: sc.them, clock: sc.t, ball: sc.b, down: 1, togo: Math.min(10, 100 - sc.b), tos: sc.to, dtos: sc.dto == null ? 2 : sc.dto,
    running: false, warned: sc.t <= WARN, trick: true, snap: 0, phase: 'play', result: null, why: '', plays: [], best: sc.b,
    look: null, form: null, shade: 's', routes: null, drives: 1
  };
  setSnap(s);
  return s;
}

/** What you can do now: {plays (on offense: pass, run, rpo, trick), def (on defense: the calls), spike, timeout,
 *  fg: {dist, p} | null, kneel, pat}. */
export function options(s) {
  const none = {plays: [], def: [], spike: false, timeout: false, fg: null, kneel: false, pat: false};
  if (s.result) return none;
  if (s.phase === 'pat') return Object.assign(none, {plays: ['pass', 'run', 'rpo'].concat(s.trick ? ['trick'] : []), pat: true});
  if (s.poss === 'them') return Object.assign(none, {def: DEF_CALLS.slice(), timeout: s.running && s.tos > 0});
  const fg = behind(s) <= 3 ? fgOdds(s) : null;
  return Object.assign(none, {
    plays: ['pass', 'run', 'rpo'].concat(s.trick ? ['trick'] : []),
    spike: s.running && s.down < 4,
    timeout: s.running && s.tos > 0,
    fg: fg && fg.p > 0 ? fg : null,
    kneel: behind(s) < 0
  });
}

function end(s, why) {
  s.result = s.us > s.them ? 'W' : s.us === s.them ? 'T' : 'L';
  s.why = why;
  s.phase = 'done';
  s.running = false;
}

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
  if (!tick(s, sec, false)) { end(s, 'clock'); return false; }
  if (s.warnStop) { s.warnStop = false; s.preWarn = true; }
  return true;
}

/** The other team gets the ball at `ball` (yards from its own goal line). The clock stops. */
function turnOver(s, ball) {
  s.poss = s.poss === 'us' ? 'them' : 'us';
  s.U = unitsFor(s, s.poss);
  s.ball = clamp(Math.round(ball), 1, 99);
  s.down = 1;
  s.togo = Math.min(10, 100 - s.ball);
  s.running = false;
  s.drives += 1;
}
/** After a score with time left: the kickoff, a touchback at the 25. */
function kickoff(s) {
  if (s.clock <= 0) { end(s, 'clock'); return; }
  turnOver(s, 25);
}
/** Points for the team with the ball. */
const score = (s, pts) => { if (s.poss === 'us') s.us += pts; else s.them += pts; };

/** Takes one action (a token) and returns the play it made (also pushed on s.plays), or null when it isn't allowed
 *  now. Mutates s. */
export function act(s, token) {
  const a = parse(token);
  if (!a || s.result) return null;
  const o = options(s);
  const before = {n: s.snap, poss: s.poss, down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, running: s.running, look: s.look, form: s.form, shade: s.shade, routes: s.routes, tos: s.tos, us: s.us, them: s.them};
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
  if (s.phase === 'pat') return patAct(s, a, token, play, o);
  if (a.kind === 'kick') return null;
  if (s.poss === 'them') {
    if (a.kind !== 'def') return null;
    return theirSnap(s, a, token, play);
  }
  if (a.kind === 'def') return null;
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
  if (a.kind === 'kneel') {
    if (!o.kneel) return null;
    if (!preSnap(s, behind(s) < 0 ? MILK : HURRY)) { play.kind = 'expired'; return push(s, play); }
    play.clock = s.clock;
    tick(s, 2, true);
    s.snap += 1;
    s.ball = Math.max(1, s.ball - 1);
    s.down += 1;
    s.togo += 1;
    s.running = true;
    play.kind = 'kneel';
    play.gain = -1;
    if (s.down > 4) { turnOver(s, 100 - s.ball); play.downs = true; }
    else if (s.clock <= 0) end(s, 'clock');
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
    if (r() < o.fg.p) { score(s, 3); play.kind = 'fg'; kickoff(s); }
    else { play.kind = 'fgx'; if (s.clock <= 0) end(s, 'clock'); else turnOver(s, Math.max(20, 100 - (s.ball - 7))); }
    return push(s, play);
  }
  if (!o.plays.includes(a.kind)) return null;
  if (!preSnap(s, behind(s) < 0 ? MILK : a.flags.h ? NO_HUDDLE : HURRY)) { play.kind = 'expired'; return push(s, play); }
  play.clock = s.clock; // at the snap
  const r = dice(s.sc.s, s.snap, hashStr(token));
  const call = callAt(s);
  let res;
  if (a.kind === 'pass') res = passPlay(r, s, a.slot, a.route, a.flags, call);
  else if (a.kind === 'run') res = runPlay(r, s, a.dir, a.flags, call, 0, a.play);
  else if (a.kind === 'rpo') res = rpoPlay(r, s, a.dir, a.flags, call, a.play);
  else { s.trick = false; res = trickPlay(r, s, call, a.play); }
  s.snap += 1;
  Object.assign(play, res, {dcall: call}, cardOf(s, a));
  return applyResult(s, play, res);
}

/** A pass's play card: {pp (its PASS_PLAYS id), routes (its design)}, or nothing. */
function cardOf(s, a) {
  const id = a.kind === 'pass' && s.book ? s.book[a.card] : null;
  return id ? {pp: id, routes: Object.assign({}, PASS_PLAYS[id].routes)} : {};
}

/** Their snap: their clock handling, then their play against your call. */
function theirSnap(s, a, token, play) {
  const lead = s.them > s.us;
  if (s.running) {
    if (!lead && s.dtos > 0 && s.clock <= 45) { s.dtos -= 1; s.running = false; play.theirTO = true; }
    else if (!preSnap(s, lead ? MILK : HURRY)) { play.kind = 'expired'; return push(s, play); }
  }
  play.clock = s.clock;
  const t = theirPlay(s);
  const r = dice(s.sc.s, s.snap, hashStr(token), 0x51);
  let res;
  if (t.kind === 'pass') res = passPlay(r, s, t.slot, t.route, t.flags, a.call);
  else res = runPlay(r, s, t.dir, t.flags, a.call);
  s.snap += 1;
  Object.assign(play, res, {dcall: a.call, their: t, tact: t.kind === 'pass' ? tok.pass(t.slot, t.route, t.flags) : tok.run(t.dir, t.flags.o)});
  return applyResult(s, play, res);
}

/** Where a play left the ball: the chains, scores, turnovers and the clock. */
function applyResult(s, play, res) {
  const alive = tick(s, res.t, true);
  if (res.kind === 'int') {
    const at = Math.min(99, s.ball + Math.max(0, res.air || 10));
    turnOver(s, 100 - at + (res.ret || 0));
    play.change = true;
    if (s.clock <= 0) end(s, 'clock');
    return push(s, play);
  }
  if (res.kind === 'fum') {
    turnOver(s, 100 - clamp(s.ball + res.gain, 1, 99));
    play.change = true;
    if (s.clock <= 0) end(s, 'clock');
    return push(s, play);
  }
  if (res.kind === 'inc') {
    s.running = false;
  } else {
    const gain = Math.min(res.gain, 100 - s.ball);
    play.gain = gain;
    s.ball += gain;
    if (s.poss === 'us') s.best = Math.max(s.best, s.ball);
    if (s.ball >= 100) {
      score(s, 6);
      play.td = true;
      return afterTouchdown(s, play);
    }
    if (s.ball <= 0) {
      play.safety = true;
      const off = s.poss;
      s.poss = off === 'us' ? 'them' : 'us';
      score(s, 2);
      s.poss = off;
      if (s.clock <= 0) end(s, 'clock'); else turnOver(s, 40);
      return push(s, play);
    }
    s.running = !res.oob && !s.warnStop;
  }
  if (res.kind !== 'inc' && play.gain >= s.togo) {
    s.down = 1;
    s.togo = Math.min(10, 100 - s.ball);
    play.first = true;
  } else {
    if (res.kind !== 'inc') s.togo -= play.gain;
    s.down += 1;
    if (s.down > 4) {
      play.downs = true;
      if (!alive) { end(s, 'clock'); return push(s, play); }
      turnOver(s, 100 - s.ball);
      play.change = true;
      return push(s, play);
    }
  }
  if (!alive) { end(s, 'clock'); return push(s, play); }
  return push(s, play);
}
/** A touchdown: the extra point (or the choice, for you), then the kickoff. */
function afterTouchdown(s, play) {
  const d = behind(s); // for the team that scored
  if (s.poss === 'us' && (d === 1 || d === 2)) {
    // Down one: kick to tie or go for two to win. Down two: go for two to tie, or kick and stay down one.
    s.phase = 'pat';
    s.running = false;
    s.ball = 98;
    s.down = 1;
    s.togo = 2;
    return push(s, play);
  }
  if (s.poss === 'them' && d === 2) {
    // They go for two to tie.
    const ok = dice(s.sc.s, s.snap, 0x2b)() < 0.48;
    play.their2 = ok;
    if (ok) score(s, 2);
  } else { score(s, 1); play.xp = true; }
  kickoff(s);
  return push(s, play);
}
/** Your try after a touchdown: the kick, or a play from the 2. */
function patAct(s, a, token, play, o) {
  if (a.kind === 'kick') {
    score(s, 1);
    play.kind = 'xp';
    s.phase = 'play';
    kickoff(s);
    return push(s, play);
  }
  if (!o.plays.includes(a.kind)) return null;
  const r = dice(s.sc.s, s.snap, hashStr(token));
  const call = callAt(s);
  const res = a.kind === 'pass' ? passPlay(r, s, a.slot, a.route, a.flags, call)
    : a.kind === 'run' ? runPlay(r, s, a.dir, a.flags, call, 0, a.play)
    : a.kind === 'rpo' ? rpoPlay(r, s, a.dir, a.flags, call, a.play) : trickPlay(r, s, call, a.play);
  if (a.kind === 'trick') s.trick = false;
  s.snap += 1;
  Object.assign(play, res, {dcall: call, two: true}, cardOf(s, a));
  const good = (res.kind === 'catch' || res.kind === 'run') && res.gain >= 2;
  play.kind = good ? '2good' : '2fail';
  play.res = res.kind;
  if (good) score(s, 2);
  s.phase = 'play';
  kickoff(s);
  return push(s, play);
}

/** Their side of things between your decisions: field goals, punts, spikes, and the kneel when the game is theirs (or
 *  yours). Each becomes a play of its own. */
function auto(s) {
  for (let guard = 0; guard < 12 && !s.result && s.phase !== 'pat'; guard++) {
    const lead = behind(s) < 0;
    // A team ahead with the ball and few enough seconds left takes a knee and the game is over.
    if (lead && s.clock <= kneelTime(s)) { autoPlay(s, {kind: 'kneelout', gain: 0}); end(s, s.poss === 'us' ? 'kneel' : 'their-kneel'); return; }
    if (s.poss !== 'them') return;
    const d = behind(s);
    const fg = fgOdds(s);
    if (d >= 0 && d <= 3 && fg.p >= 0.45 && (s.down === 4 || s.clock <= 10 || (s.running && s.dtos === 0 && s.clock <= 25))) {
      if (s.running && s.clock <= FG_SET && s.dtos > 0) { s.dtos -= 1; s.running = false; }
      if (s.running && !tick(s, FG_SET, false)) { end(s, 'clock'); return; }
      const ok = dice(s.sc.s, s.snap, 0x47)() < fg.p;
      const p = {kind: ok ? 'their-fg' : 'their-fgx', dist: fg.dist, p: fg.p};
      tick(s, 4, true);
      s.snap += 1;
      if (ok) { score(s, 3); autoPlay(s, p); kickoff(s); }
      else { autoPlay(s, p); if (s.clock <= 0) end(s, 'clock'); else turnOver(s, Math.max(20, 100 - (s.ball - 7))); }
      if (s.result) return;
      continue;
    }
    if (s.down === 4 && lead) {
      // Punt: about 42 yards, a touchback at the 20 if it goes in.
      const land = s.ball + 42;
      tick(s, 6, true);
      s.snap += 1;
      autoPlay(s, {kind: 'punt', gain: 0});
      if (s.clock <= 0) { end(s, 'clock'); return; }
      turnOver(s, land >= 100 ? 20 : 100 - land);
      continue;
    }
    if (s.running && d >= 0 && s.dtos === 0 && s.clock <= HURRY + 1 && s.down < 4) {
      tick(s, SPIKE_SET + 1, false);
      s.snap += 1;
      s.down += 1;
      s.running = false;
      autoPlay(s, {kind: 'their-spike', gain: 0});
      if (s.clock <= 0) { end(s, 'clock'); return; }
      continue;
    }
    return;
  }
}
/** Seconds the team with the ball can take off with kneels, the other side using its timeouts. */
function kneelTime(s) {
  const downs = 5 - s.down;
  let stops = s.poss === 'us' ? s.dtos : s.tos;
  let t = s.running ? KNEEL : 2;
  for (let k = 1; k < downs; k++) { if (stops > 0) { stops -= 1; t += 2; } else t += KNEEL; }
  return t;
}
function autoPlay(s, p) {
  const play = Object.assign({act: null, auto: true, n: s.snap, poss: s.poss, down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, us: s.us, them: s.them}, p);
  play.after = {down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, running: s.running, us: s.us, them: s.them, tos: s.tos, poss: s.poss};
  s.plays.push(play);
}

function push(s, play, next = true) {
  play.after = {down: s.down, togo: s.togo, ball: s.ball, clock: s.clock, running: s.running, us: s.us, them: s.them, tos: s.tos, poss: s.poss};
  play.t1 = s.clock;
  if (s.warnStop || s.preWarn) play.warn = true;
  s.plays.push(play);
  if (!s.result && s.clock <= 0 && s.phase !== 'pat') end(s, 'clock');
  if (!s.result && next) { setSnap(s); auto(s); if (!s.result && s.plays[s.plays.length - 1] !== play) setSnap(s); }
  return play;
}

/** Rebuilds a game from its action string. Stops at the first action that isn't allowed. */
export function replay(sc, teams, acts = '') {
  const s = start(sc, teams);
  const list = String(acts || '').split(',').filter(Boolean);
  for (const t of list) { if (s.result || !act(s, t)) break; }
  return s;
}
/** Your actions in a game, as one string (what a phone stores and posts). */
export const actsOf = s => s.plays.filter(p => p.act).map(p => p.act).join(',');

// ---------------------------------------------------------------------------------------------- tendencies
const DEEP = 18, SHORT = 8;
const MIDDLE = new Set(['slant', 'dig', 'drag', 'post', 'seam', 'angle']);
export const TENDENCIES = ['pass', 'deep', 'short', 'middle', 'oob', 'spike', 'hurry', 'timeout', 'two', 'fourth'];
/** A play-caller's tendencies in a game, counted like the NFL coaches' (tools/drill/coaches.py; core/drill.js
 *  matchCoach): {pass, deep, short, middle, oob, spike, hurry, timeout, two, fourth: [k, n]}. hurry: no huddle, of your snaps from a running clock; timeout: timeouts, of your chances to stop a
 *  running clock with one (each call made with it running and a timeout left); both when you're behind or tied. */
export function tendencies(s) {
  const f = {};
  TENDENCIES.forEach(k => { f[k] = [0, 0]; });
  const add = (k, hit) => { f[k][1] += 1; if (hit) f[k][0] += 1; };
  s.plays.forEach(p => {
    const a = p.poss === 'us' && p.act ? parse(p.act) : null;
    if (!a) return;
    if (p.two || p.kind === 'xp') { add('two', !!p.two); return; } // the try after a touchdown: kick it or go for two
    const clock = p.running && p.us <= p.them;
    if (clock && p.tos > 0 && ['pass', 'run', 'rpo', 'trick', 'spike', 'fg', 'timeout'].includes(a.kind)) add('timeout', a.kind === 'timeout');
    if (clock && ['pass', 'run', 'rpo'].includes(a.kind)) add('hurry', !!a.flags.h);
    if (a.kind === 'spike') { if (p.kind === 'spike') add('spike', true); return; }
    if (!['pass', 'run', 'rpo', 'trick', 'fg'].includes(a.kind) || p.kind === 'expired') return;
    // Fourth down with a field goal on: kick it or go for it.
    if (p.down === 4 && p.them - p.us <= 3 && fgOdds(s, p.ball, s.mine.kick).p > 0) add('fourth', a.kind !== 'fg');
    if (a.kind === 'fg') return;
    add('spike', false);
    const route = a.kind === 'pass' ? a.route : a.kind === 'rpo' && p.read === 'pass' ? p.route : a.kind === 'trick' && a.play !== 'r' ? 'go' : null;
    add('pass', !!route);
    if (route) {
      const depth = ROUTES[route].depth;
      add('deep', depth >= DEEP);
      add('short', depth < SHORT);
      add('middle', MIDDLE.has(route));
    }
    if (p.kind === 'catch' || p.kind === 'run') add('oob', !!p.oob);
  });
  return f;
}

// ---------------------------------------------------------------------------------------------- the bots
// A good play-caller on offense: reads the look's odds for every throw and run, minds the clock, kicks when it should.
// skill 1 takes the best option it sees; lower, it sometimes takes the second or third. On defense (defBot): the call
// that holds their likely plays to the least. Used to set each day's situation (tools/drill/tune.mjs), to pick their
// plays, and to estimate win chances.
/** About the normal curve's area below z (for the bots' sense of a spot; never part of a play's dice). */
const Phi = z => 1 / (1 + Math.exp(-1.7 * z));
/** The offense's sense of a spot: the chance of getting what it needs (a tie counts a half), from how many snaps the
 *  time and timeouts leave against the yards still needed (about 6 a snap, give or take 8.5). */
function spotValue(s, ball, down, togo, clock, running, tos) {
  const deficit = behind(s);
  if (s.phase === 'pat') return ball >= 100 ? 1 : 0;
  if (deficit < 0) return clamp(0.85 + 0.03 * (ball - 50) / 10 - (down > 4 ? 0.3 : 0), 0, 1); // ahead: just don't give it up
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
/** The offense's sense of a play: the spot value after it, averaged over the calls it might meet and how it goes. */
function playValue(s, a, mix) {
  let v = 0;
  const tos = s.poss === 'us' ? s.tos : s.dtos;
  const setup = s.running ? (a.flags && a.flags.h ? NO_HUDDLE : HURRY) : 0;
  const after = (gain, secs, run, downUsed = true) => {
    const ball = Math.min(100, s.ball + gain);
    if (s.phase === 'pat') return ball >= 100 ? 1 : 0;
    const conv = gain >= s.togo;
    const down = ball >= 100 ? 1 : conv ? 1 : s.down + (downUsed ? 1 : 0);
    const togo = conv ? Math.min(10, 100 - ball) : s.togo - gain;
    return spotValue(s, ball, down, togo, s.clock - setup - secs, run, tos);
  };
  if (s.running && s.clock <= setup) return 0;
  mix.forEach(([call, w]) => {
    if (a.kind === 'pass' || (a.kind === 'rpo' && FX[call].rpo === 'pass')) {
      const slot = a.kind === 'pass' ? a.slot : RPOS[a.play].slot, route = a.kind === 'pass' ? a.route : RPOS[a.play].route;
      const m = passModel(s, slot, route, a.kind === 'pass' ? a.flags : {o: a.flags.o, h: a.flags.h}, call);
      const ok = 1 - m.pSack, gain = Math.round(m.depth + m.yac);
      const catchSecs = 1.8 + m.time + gain / 7;
      const pc = ok * m.pComp, pi = ok * m.pInt, pinc = Math.max(0, ok - pc - pi);
      v += w * (m.pSack * after(-6, m.time + 2.5, true)
        + pinc * after(0, m.time + 2, false)
        + pc * (m.oob * after(gain, catchSecs, false) + (1 - m.oob) * after(gain, catchSecs, true))
        + pc * m.big * 0.5 * (after(gain + 18, catchSecs + 2, true) - after(gain, catchSecs, true)));
    } else if (a.kind === 'run' || a.kind === 'rpo') {
      const play = a.kind === 'run' ? a.play : 'z', K = RUNS[play];
      const mean = runMean(s, a.dir, a.flags, call, play) + (a.kind === 'rpo' ? 0.6 : 0);
      const po = Math.min(0.9, (a.flags.o ? 0.5 : 0.08) * K.oob);
      [-K.sd, 0, K.sd].forEach(d => {
        const g = Math.round(mean + d), secs = 5 + K.t + g / 8;
        v += (w / 3) * (po * after(g, secs, false) + (1 - po) * after(g, secs, true));
      });
    } else if (a.kind === 'trick') {
      const p = trickOdds(a.play, call);
      if (a.play === 'r') v += w * (p * after(20, 8, true) + (1 - p) * (0.55 * after(-5, 7, true) + 0.4 * after(2, 7, true)));
      else if (a.play === 'h') v += w * (p * after(26, 8, true) + (1 - p) * (0.5 * after(0, 7, false) + 0.25 * after(-7, 7, true)));
      else v += w * (p * after(32, 8, true) + (1 - p) * (0.5 * after(0, 7, false) + 0.32 * after(-9, 7, true)));
    }
  });
  return v;
}
/** Every play the team with the ball could call now, valued: [{token, v}], best first. fast: only the routes drawn
 *  up for the snap, the runs away from the lean, the plain RPO and the flea flicker (for playing many games out
 *  quickly). Their offense runs only the inside zone here (theirPlay picks the run itself). */
export function candidates(s, fast = false) {
  const out = [];
  const late = s.clock <= 75;
  const fooled = s.look === 'box' || s.look === 'blitz';
  const ours = s.poss === 'us';
  TARGETS.forEach(slot => {
    (fast ? [s.routes[slot]] : ROUTES_FOR[slot]).forEach(route => {
      const fs = [{}];
      if (late && ['out', 'corner', 'wheel', 'flat', 'go', 'curl'].includes(route)) fs.push({o: true});
      if (ours && fooled) fs.push({a: true});
      if (!fast && ours && s.U.d.rush > 0.2 && s.U.o.ol < 0) fs.push({r: true});
      fs.forEach(f => out.push(tok.pass(slot, route, f)));
    });
  });
  (fast && ours ? [s.shade === 's' ? 'w' : 's'] : ['s', 'w']).forEach(dir => [false, true].forEach(oob => {
    (ours ? Object.keys(RUNS) : ['z']).forEach(k => out.push(tok.run(dir, oob, k)));
    if (ours) (fast ? ['s'] : Object.keys(RPOS)).forEach(k => out.push(tok.rpo(dir, oob, k)));
  }));
  if (ours && s.trick) (fast ? ['f'] : Object.keys(TRICKS)).forEach(k => out.push(tok.tricks(k)));
  const mix = mixOf(s);
  return out.map(t => ({token: t, v: playValue(s, parse(t), mix)})).sort((a, b) => b.v - a.v);
}
export function bot(s, r = Math.random, skill = 1, fast = false) {
  const o = options(s);
  if (s.phase === 'pat') {
    // Go for two when a play is more likely to make it than not (down one: the kick ties, worth a half); down two,
    // always (the kick leaves you behind). People don't always.
    const best = candidates(s, fast)[0];
    return behind(s) === 2 || (best.v > 0.5) !== (r() < 0.15) ? best.token : tok.kick;
  }
  if (o.kneel && s.clock <= kneelTime(s) + 10) return tok.kneel;
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
/** Their likely plays from this formation, each with its weight: [[action, weight]]. */
function theirMix(s) {
  const F = FORMS[s.form];
  const passes = candidates(s, true).filter(x => x.token[0] === 'p').slice(0, 3).map(x => parse(x.token));
  const out = passes.map((p, i) => [p, F.pass * [0.5, 0.3, 0.2][i]]);
  ['s', 'w'].forEach(d => out.push([parse(tok.run(d)), (1 - F.pass) / 2]));
  return out;
}
/** Your defense's sense of each call: how much it holds their likely plays to (lower is better for you). */
export function defValues(s) {
  const mix = theirMix(s);
  return DEF_CALLS.map(call => {
    let v = 0;
    mix.forEach(([a, w]) => { v += w * playValue(s, a, [[call, 1]]); });
    return {token: tok.def(call), v};
  }).sort((a, b) => a.v - b.v);
}
export function defBot(s, r = Math.random, skill = 1) {
  const o = options(s);
  if (o.timeout && behind(s) > 0 && s.clock <= 90) return tok.timeout; // they lead: stop the clock to get it back
  const list = defValues(s);
  if (skill >= 1) return list[0].token;
  const u = r();
  return list[u < skill ? 0 : u < (1 + skill) / 2 ? 1 : 2].token;
}
/** Plays the rest of a game out with the bots from where it is. */
export function finish(s, r, skill = 0.8, fast = false) {
  for (let i = 0; !s.result && i < 200; i++) {
    const t = s.poss === 'them' && s.phase !== 'pat' ? defBot(s, r, skill) : bot(s, r, skill, fast);
    if (!act(s, t)) act(s, s.poss === 'them' ? tok.def('c3') : tok.run('s', false)) || act(s, tok.kick);
  }
  return s;
}
/** A copy of the game to play out a different future: the same spot and what's shown now, new dice after it. */
function fork(s, salt) {
  return Object.assign({}, s, {sc: Object.assign({}, s.sc, {s: (mix(s.sc.s, salt) >>> 0) || 1}), plays: [], U: Object.assign({}, s.U)});
}
const value = s => (s.result === 'W' ? 1 : s.result === 'T' ? 0.5 : 0);
/** Your chance of winning (a tie counts a half) from here, played out n times by the bots. */
export function winChance(s, n = 120, salt = 7) {
  if (s.result) return value(s);
  let v = 0;
  for (let i = 0; i < n; i++) v += value(finish(fork(s, salt * 1000 + i), dice(salt, i, 0xb07), 0.8, true));
  return v / n;
}
/** Every option at this snap with its win chance (each played out n times): [{token, wp}], best first. tokens: which
 *  to score (default: defaultOptions). The same n futures for every option, so they're compared fairly. */
export function scoreOptions(s, tokens, n = 60, salt = 11) {
  const list = tokens || defaultOptions(s);
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
/** The options worth scoring at a snap: on defense every call; on offense the three runs both ways, the three RPOs
 *  away from the lean, a throw to each receiver on his route in a pass play (card: which of s.book; routes: the routes,
 *  default that card's), the three trick plays, the field goal and the kneel (and the extra point on a try). */
export function defaultOptions(s, routes, card = 0) {
  if (s.poss === 'them' && s.phase !== 'pat') return DEF_CALLS.map(tok.def);
  const o = options(s);
  const rs = routes || (s.book ? PASS_PLAYS[s.book[card]].routes : s.routes);
  const away = s.shade === 's' ? 'w' : 's';
  const out = [];
  ['s', 'w'].forEach(d => Object.keys(RUNS).forEach(k => out.push(tok.run(d, false, k))));
  Object.keys(RPOS).forEach(k => out.push(tok.rpo(away, false, k)));
  TARGETS.forEach(slot => out.push(tok.pass(slot, rs[slot], {c: card})));
  if (s.trick) Object.keys(TRICKS).forEach(k => out.push(tok.tricks(k)));
  if (o.fg) out.push(tok.fg);
  if (o.kneel) out.push(tok.kneel);
  if (s.phase === 'pat') out.push(tok.kick);
  return out;
}
