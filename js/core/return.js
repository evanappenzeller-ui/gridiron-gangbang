// Return Man core: the Daily Games' endless runner, after Subway Surfers (the owner's ask, Oct 2026). You field a
// kickoff in the stadium and run it back as far as you can, and the run goes on out of the stadium into a new place
// every 100 yards (ZONE: each one a field, a touchdown at its far end): the tailgate, the city, the frozen tundra, the
// desert, the farmers market, the beach, outer space and the farm, in an order of the kickoff's own, and round again.
// Three lanes, and in them, a row at a time, the things to get past (OBST; the owner's ask, Oct 2026: no coverage men
// running at you, more to jump and slide): a barricade to jump, a banner to slide under. Swipe left or right to juke
// a lane over, up to jump, down to slide (in the air: drop, then slide). In the way too: each place's
// vehicles, parked in the lanes (a team bus, an RV, a train car...). The tall ones you go round, or run up a ramp onto
// the roof and along the top; the low ones you jump onto and run across. Jump down off the end, or juke off the side.
// A linebacker chases you down from behind (CHASE, the owner's ask, Oct 2026, after Subway Surfers' inspector; not the
// kicker, his word): a hit (a barricade or banner you didn't clear, a vehicle you ran into, the side of one you juked
// into, a juke off the edge of the road: the owner's ask, Oct 2026) slows you and puts him right on your back; run on
// clean and he drops away. A hit while he's on you (at the
// catch he starts there too) and he tackles you: that's the return.
// On the way, three power-ups: smelling salts (a burst of speed, BURST: the owner's ask, Oct 2026; and an extra life:
// the next time he'd catch you, you shake him off, and away you burst again),
// prescription painkillers (a few seconds when nothing can stop you) and booze (a few seconds of double yards). You
// speed up as you go, and every 100 yards is a touchdown. Run it back as often as you like (the owner's ask, Oct 2026:
// replayed, an arcade game), the day's course the same on every phone and every run; the day's score is your best
// run's yards. No DOM. Owner: RETURN.
//
//   todayNumber(), dateOf(n), dayLabel(n)       day 1 on START, a new day at local midnight
//   course(n, k, hard), fill(course, z)         day n's course (k 0: every run of the day runs it; hard: HARD_SPEED,
//                                               HARD_GAP, HARD_OBST), worked out as far as z yards: its rows
//                                               [{i, z (where it stands), lanes: [OBST type|null x 3]}], its vehicles
//                                               (sets: [{i, zs, ze, plats: [{lane, kind, part, z0 (the front), z1, h, b,
//                                               ramp, hi}]}]: KINDS)
//                                               and its power-ups [{i, z, lane, top, kind}]
//   THEMES, ZONE, zoneAt(course, z)             the places, and which one z yards is in ({i, theme, z0})
//   groundAt(course, lane, z, y), blockAt(...)  how high the ground is there for him at height y (a ramp, a roof, a
//                                               pad; 0 on the road); what's in his way there
//   speedAt(z, hard), tdsAt(z), LANE            your speed (yards a second) at z yards; touchdowns by z yards; the
//                                               lanes' spacing (yards)
//   startRun(n, k, hard), move(run, dir), step(run, dt), stop(run)   a return, played (hard: the hard course, the
//                                               owner's for now): move takes a swipe ('left' 'right' 'up' 'down'),
//                                               step moves it on dt seconds and says what happened (events)
//   laneOf(run), xOf(run, lane), ahead(run, dist), endOf(run)   where you are; what's in front of you (for drawing);
//                                               what ended it
//   CHASE, gapOf(run), chasing(run), hitLine(what)   the linebacker behind you: how far back he is now, whether he's
//                                               on you (a hit now is a tackle); a hit's words
//   dayState(n, real), record(n, k, yards, dist), score(list), totals()   localStorage 'gg-ret1'
//   keepLive(n, k, yards, dist), settle(n), live(n)   a return under way: kept as it goes, counted if it's left behind
//   setTest(on, n), testing()                   test play (the owner's sandbox; his way to play it again)
//   autoPost(), boardRows(n), weekRows(n), weekDays(n), boardState()   the league scoreboard (below)
//
// THE RULE (CLAUDE.md): the scoreboard reads daily.LB.raw, the board as this phone may see it: league members and
// Ryan D for everyone; a guest (or Ryan S) only on their own phones.
import {lsGet, lsSet} from './ui.js';
import * as daily from './daily.js';

// ---------------------------------------------------------------------------------------------- days
export const START = '2026-10-20';
const startParts = () => START.split('-').map(Number);
/** Day number for a moment (local date): 1 on START, never below 1. */
export function todayNumber(t = new Date()) {
  const [y, m, d] = startParts();
  return 1 + Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}
export function dateOf(n) {
  const [y, m, d] = startParts();
  return new Date(y, m - 1, d + n - 1);
}
export const dayLabel = (n, o = {weekday: 'short', month: 'short', day: 'numeric'}) => dateOf(n).toLocaleDateString('en-US', o);

// ---------------------------------------------------------------------------------------------- the world
// In yards: x across (+ right), y up, z ahead from where you field the kick. The lanes are the hash marks and the
// middle (the NFL's hashes, 18 ft 6 in apart) and go on as the lanes of the road. You run at speedAt(z), from a jog
// to a sprint; every 100 yards is a touchdown.
export const LANE = 3.083, LANES = 3;
export const SPEED = {start: 9.5, top: 19, ramp: 360};
// Hard (the owner's ask, Oct 2026: "far too easy", a run should last about 90 seconds to 3 minutes; his profile only
// for now, data.isOwner(), so the league's course and board stay as they were): off quicker, to a sprint sooner, and
// never done speeding up: climb more a yard on top, to max.
export const HARD_SPEED = {start: 11, top: 20, ramp: 220, climb: .0045, max: 36};
/** Your speed (yards a second) z yards into a return: on the hard course (hard) HARD_SPEED's. */
export function speedAt(z, hard = false) {
  const S = hard ? HARD_SPEED : SPEED, d = Math.max(0, z);
  const v = S.start + (S.top - S.start) * (1 - Math.exp(-d / S.ramp)) + (S.climb || 0) * d;
  return S.max ? Math.min(S.max, v) : v;
}
export const TD = 100;
/** Touchdowns in a return of z yards. */
export const tdsAt = z => Math.max(0, Math.floor(z / TD));
// You, in the air: a jump (up) peaks at JUMP_V^2 / 2GRAV (1.35 yards, over a barricade, up onto a low vehicle; a
// tall one's roof is out of reach) and lasts 2 JUMP_V / GRAV (.6 s). A jump swiped in the air waits for you to land
// (BUFFER s). Down slides you (in the air: drops you, DROP_V, into the slide). You step up anything STEP yards or less
// (a ramp, onto a roof from the air); anything higher in your way is a crash.
export const GRAV = 30, JUMP_V = 9, DROP_V = -18, BUFFER = .25, STEP = .45;
// (his stride, run.steps: a yard a yard run up to STRIDE_V yards a second, the regular course's top speed)
export const STRIDE_V = 19;
// The moves, seconds: a juke takes you a lane over (eased out: most of the way at once, settling in; snappier, the
// owner's ask, Oct 2026); a slide keeps you low (SLIDE_BODY yards, not BODY) for slide s.
export const MOVE = {juke: .13, slide: .7};
// The things in the rows, standing still in a lane: what beats each (a juke round it beats both; so does being up
// over it, top yards). A barricade you jump (clear: up that high as you reach it); a banner you slide under.
// The hard course adds two (HARD_OBST): a pothole you jump (it's flat: a slide goes in it), each place's own (HOLES),
// and a tackling sled, too high to jump and too low to slide under: you juke round it.
export const OBST = {
  hurdle: {name: 'barricade', beat: 'jump', clear: .5, top: 1.05, says: 'Clipped the barricade'},
  bar: {name: 'banner', beat: 'slide', top: 2.5, says: 'Ran into the banner'},
  hole: {name: 'pothole', beat: 'jump', clear: .25, top: 1.05, says: 'Stepped in the pothole'},
  sled: {name: 'tackling sled', beat: 'juke', top: 1.6, says: 'Ran into the tackling sled'}
};
export const HARD_OBST = ['hole', 'sled'];
export const HOLES = {stadium: 'divot', tailgate: 'pothole', city: 'pothole', tundra: 'ice hole', desert: 'sinkhole', market: 'open manhole',
  beach: 'sand pit', space: 'crater', farm: 'mud pit'};
// What stands in the lanes: each place's own (KINDS, below): vehicles to go round or climb (a tall one, HIGH_H yards;
// a ramp up onto its roof, or not), low ones to jump on (LOW_H), and things to climb: ramps up onto rocks and crates,
// steps of hay bales, a flatbed and its cab, piers with a gap between, pads floating in the air. Each is one or more
// parts in a lane, each part a box (h its top, b its bottom: above the ground for a floating pad) with a ramp up to
// its front or not. You stand on a part you're up level with (STEP); you pass under one whose bottom is over your head
// (BODY); anything else in your way is a crash, and a pad you jump up into from below stops you short.
export const HIGH_H = 3, LOW_H = .95, RAMP = 8, BODY = 2, SLIDE_BODY = .9;
// The places, one after another, ZONE yards each (a field each: you score as you go into the next): the stadium first,
// then the other eight in the kickoff's own order, and round again. A vehicle never sits across the line between two
// (there are goalposts on it).
export const ZONE = 100;
export const THEMES = [
  {id: 'stadium', name: 'The Stadium', kinds: [['teambus', 1], ['bench', 1.2]]},
  {id: 'tailgate', name: 'The Tailgate', kinds: [['rv', 1], ['pong', 1.2]]},
  {id: 'city', name: 'The City', kinds: [['citybus', 1], ['ramptruck', 1], ['parkedcar', 1.2]]},
  {id: 'tundra', name: 'The Frozen Tundra', kinds: [['plow', 1], ['snowbank', 1.2]]},
  {id: 'desert', name: 'The Desert', kinds: [['train', .7], ['canyon', 1], ['minecart', 1], ['wagonbridge', 1]]},
  {id: 'market', name: 'Farmers Market', kinds: [['producetruck', .6], ['producecart', 1], ['marketramp', 1], ['awning', 1]]},
  {id: 'beach', name: 'The Beach', kinds: [['icecream', .6], ['lifeguard', 1], ['buggy', 1], ['pier', 1]]},
  {id: 'space', name: 'Outer Space', kinds: [['shuttle', .6], ['rover', 1], ['cargo', 1], ['hover', 1]]},
  {id: 'farm', name: 'The Farm', kinds: [['combine', .6], ['hay', 1], ['trailer', 1], ['fence', 1]]}
];
// The kinds: the name a crash says, and its parts (at: where the part's front is, from where the thing starts; len,
// h, b (its bottom, 0 on the ground), ramp (the ramp's length up to its front)), drawn from the course's own numbers
// (r), how far into it (L) and how fast you're going there (k: 1 at a jog, 2 at a sprint; a step you land on and jump
// again from is longer the faster you come).
const tall = (r, L, rampP) => [{at: RAMP, len: 12 + r() * (9 + 13 * L), h: HIGH_H, ramp: r() < rampP ? RAMP : 0}];
const low = (r, len, h = LOW_H) => [{at: 0, len, h}];
export const KINDS = {
  teambus: {name: 'team bus', build: (r, L) => tall(r, L, .65)},
  bench: {name: 'bench', build: r => low(r, 6 + r() * 5)},
  rv: {name: 'RV', build: (r, L) => tall(r, L, .65)},
  pong: {name: 'beer pong table', build: r => low(r, 5.4 + Math.floor(r() * 3) * 2.7)},
  plow: {name: 'snowplow', build: (r, L) => tall(r, L, .65)},
  snowbank: {name: 'snowbank', build: r => low(r, 6 + r() * 5)},
  // the city: the bus (up on its roof by a ramp, or not); a tow truck (up its ramp onto the bed, a jump up onto the
  // cab); a parked car (jump on)
  citybus: {name: 'city bus', build: (r, L) => tall(r, L, .5)},
  ramptruck: {name: 'tow truck', build: (r, L, k) => { const bed = (5 + r() * 2) * k; return [{at: 5, len: bed, h: 1.4, ramp: 5}, {at: 5 + bed, len: 2.6, h: 2.6}]; }},
  parkedcar: {name: 'parked car', build: r => (r() < .4 ? [{at: 0, len: 4.6, h: 1.25}, {at: 5.6, len: 4.6, h: 1.25}] : [{at: 0, len: 4.6, h: 1.25}])},
  // the desert: a train car; a ramp up onto the canyon rock; mine carts on the rails (jump on); a wagon bridge
  train: {name: 'train car', build: (r, L) => tall(r, L, .55)},
  canyon: {name: 'canyon rock', build: (r, L) => [{at: 7, len: 6 + r() * (4 + 6 * L), h: 2.4, ramp: 7}]},
  minecart: {name: 'mine cart', build: r => (r() < .55 ? [{at: 0, len: 2.6, h: 1.1}, {at: 3.6, len: 2.6, h: 1.1}] : [{at: 0, len: 2.6, h: 1.1}])},
  wagonbridge: {name: 'wagon bridge', build: (r, L) => [{at: 4.5, len: 8 + r() * (3 + 4 * L), h: 1.6, ramp: 4.5}]},
  // the market: the produce truck; a produce cart (jump on); a ramp up the crates; crates to jump on, then the awning
  producetruck: {name: 'produce truck', build: (r, L) => tall(r, L, .6)},
  producecart: {name: 'produce cart', build: r => low(r, 3.8 + r() * 1.5, 1.15)},
  marketramp: {name: 'stack of crates', build: r => [{at: 5, len: 4 + r() * 2.5, h: 1.9, ramp: 5}]},
  awning: {name: 'market stall', build: (r, L, k) => [{at: 0, len: 4 * k, h: LOW_H}, {at: 4 * k, len: 4 + r() * 1.5, h: 2.2}]},
  // the beach: the ice cream truck; the lifeguard's ramp up to his deck; a beach buggy (jump on); two piers, a gap
  icecream: {name: 'ice cream truck', build: (r, L) => tall(r, L, .6)},
  lifeguard: {name: 'lifeguard stand', build: r => [{at: 5, len: 5 + r() * 3, h: 2, ramp: 5}]},
  buggy: {name: 'beach buggy', build: r => low(r, 3.6, 1.2)},
  pier: {name: 'pier', build: r => { const a = 4 + r() * 2, gap = 2.4 + r() * 1.2; return [{at: 0, len: a, h: 1}, {at: a + gap, len: 4 + r() * 2, h: 1}]; }},
  // space: the shuttle; a moon rover (jump on); a ramp up onto the cargo; pads floating up in steps (under the top one)
  shuttle: {name: 'space shuttle', build: (r, L) => tall(r, L, .6)},
  rover: {name: 'moon rover', build: r => low(r, 4 + r() * 1.5, 1.1)},
  cargo: {name: 'cargo crate', build: (r, L) => [{at: 6, len: 6 + r() * (4 + 5 * L), h: 2.4, ramp: 6}]},
  hover: {name: 'hover pad', build: (r, L, k) => [{at: 0, len: 4 * k, h: 1, b: .75}, {at: 4.8 * k, len: 4 * k, h: 1.9, b: 1.65}, {at: 9.6 * k, len: 4.5 * k, h: 2.8, b: 2.55}]},
  // the farm: the combine; hay bales in steps; a ramp up onto the trailer; a fence to hurdle
  combine: {name: 'combine', build: (r, L) => tall(r, L, .5)},
  hay: {name: 'hay bales', build: (r, L, k) => [{at: 0, len: 4 * k, h: LOW_H}, {at: 4 * k, len: 4 * k, h: 1.9}].concat(r() < .5 ? [{at: 8 * k, len: 3.5, h: 2.85}] : [])},
  trailer: {name: 'farm trailer', build: r => [{at: 4, len: 5.5 + r() * 2, h: 1.3, ramp: 4}]},
  fence: {name: 'fence', build: r => (r() < .5 ? [{at: 0, len: .35, h: .9}, {at: 7, len: .35, h: .9}] : [{at: 0, len: .35, h: .9}])}
};
function pickKind(th, r) {
  const sum = th.kinds.reduce((a, k) => a + k[1], 0);
  let u = r() * sum;
  for (const [id, w] of th.kinds) { if ((u -= w) < 0) return id; }
  return th.kinds[0][0];
}
// The power-ups: salts (you can carry SALTS_MAX), pills (seconds) and booze (seconds of double yards).
// is, does: what it is and what it does, in a line each (said when you pick one up).
export const POWER = {
  salts: {name: 'Smelling salts', says: 'A burst of speed and an extra life', is: 'One sniff and you’re wide awake', does: 'A 4-second burst of speed, and an extra life: shake off the next tackle'},
  pills: {name: 'Painkillers', says: 'Nothing can stop you', s: 6, is: 'You can’t feel a thing', does: 'For 6 seconds, run straight through whatever’s in your way'},
  booze: {name: 'Booze', says: 'Double yards', s: 8, is: 'Liquid courage (the world gets wobbly)', does: 'For 8 seconds, every yard counts double'}
};
export const SALTS_MAX = 2, SHIELD = 1.2;
// The salts' burst (picked up, and again when they shake the linebacker off): k faster for s seconds, easing back to
// your own speed over the last ease of them.
export const BURST = {s: 4, k: .3, ease: 1};
/** How much faster than your own speed you are now (0 to BURST.k). */
export const burstOf = run => (run && run.burst > 0 ? BURST.k * Math.min(1, run.burst / BURST.ease) : 0);
// The linebacker, chasing (yards behind you, seconds): at the catch and right after a hit he's on you, near (after a hit
// you're slowed too, by slowBy for slow s, easing back to speed), falling back to edge (the bottom of the screen) as you
// run clean; once window s have gone by he's lost: in drop s he's out of sight (far: behind the camera). A hit while
// he's on you (within window s of the catch or the last hit) is the tackle (the owner's ask, Oct 2026: a stumble with
// him there is a tackle). For grace s after a hit nothing else counts (it's the same collision), and a tall vehicle's
// front knocks you into the open lane beside it (or, with none open, up onto it). After a hit he runs up on you from
// wherever he was (out of sight, or further back), near in runUp s (the owner's ask, Oct 2026: not out of nowhere).
// And while he's still in the picture (under seen yards back: the camera rides 7 behind you, views/return.js), falling
// away once he's lost you, a hit is the tackle too (the owner's ask, Oct 2026: a stumble with him in frame is a tackle).
export const CHASE = {near: 2.2, edge: 3.4, far: 9, window: 4, drop: .6, slow: 1, slowBy: .45, grace: .35, runUp: .55, seen: 5.7};

function hashStr(str) {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h;
}
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const round2 = v => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------------------------- the course
// Worked out a beat at a time, each beat a row (barricades and banners) or a set of vehicles, the next beat a moment
// later: 1.3 seconds at first, down to GAP.min by GAP.by yards (and a bit more now and then). The first row comes at
// GAP.first; the first vehicles after GAP.cars, more often as you go (a second one beside the first, later on, always
// leaving a lane open). Rows grow with the yards: one thing early on (a barricade to jump for the first 40), then two,
// then often three (each one beaten by its move, so a full row still has a way through). Beside a vehicle a row is
// only in the open lanes, and a beat apart (IN_GAP s or more). A power-up every 180 to 360 yards (fewer of them: the
// owner's ask, Oct 2026): on a tall vehicle's roof when there's one to put it on, else on the road in a lane between
// two beats.
export const GAP = {first: 22, cars: 45, max: 1.3, min: .62, by: 1000, jitter: .25, in: .8};
// Hard: the beats start closer and keep closing in (by is how many yards they take to close most of the way to min,
// late's last bit of it over its own yards: they never stop closing in), the jitter shrinking too; vehicles from cars
// yards, more of them (sets: the chance a beat is one, from .. to, over mix yards; two: the chance of two side by
// side) and less room after one (after: past a tall one, a low one); the potholes from hole yards, the sleds from sled.
// (A returner who reads it all right but can only swipe every .35-.45 s is down in 1 to 3 minutes; on the regular
// course he runs forever.)
export const HARD_GAP = {first: 20, cars: 35, max: 1.1, min: .32, by: 650, late: [.06, 3000], jitter: .2, in: .6, after: [.25, .1], mix: 700, sets: [.22, .38], two: .6, hole: 120, sled: 220};
const COURSES = new Map();
/** Day n's kickoff k: the same on every phone. It's worked out as it's needed (fill). */
export function course(n, k, hard = false) {
  hard = !!hard;
  const key = `${n}|${k}|${hard ? 'h' : ''}`;
  if (COURSES.has(key)) return COURSES.get(key);
  // the places after the stadium: the day's order, each kickoff starting one further on
  const others = shuffle(THEMES.map((_, i) => i).slice(1), rng(hashStr(`return-man-places-${n}`))), m = others.length;
  const order = [0, ...others.slice(k % m), ...others.slice(0, k % m)];
  const c = {n, k, hard, order, rows: [], sets: [], items: [], r: rng(hashStr(`return-man-${n}-${k}${hard ? '-hard' : ''}`)), z: (hard ? HARD_GAP : GAP).first, itemAt: 100, done: 0, first: {}};
  if (COURSES.size > 12) COURSES.clear();
  COURSES.set(key, c);
  return c;
}
/** The place z yards is in: {i (the how-many-th), theme, z0 (where it starts)}. */
export function zoneAt(co, z) {
  const i = Math.max(0, Math.floor(z / ZONE));
  return {i, theme: THEMES[co.order[i % co.order.length]], z0: i * ZONE};
}
/** Seconds to the next beat at z yards (L: how far into the course, 0 to 1). */
function gapAt(co, L, z) {
  if (!co.hard) return GAP.max - (GAP.max - GAP.min) * L + co.r() * GAP.jitter;
  const H = HARD_GAP, d = Math.max(0, z), [lk, lby] = H.late;
  return H.min + lk * Math.exp(-d / lby) + (H.max - H.min - lk) * Math.exp(-d / H.by) + co.r() * H.jitter * (1 - .5 * Math.min(1, d / 2000));
}
const speedOn = (co, z) => speedAt(z, co.hard);
function addItem(co, z, lane, top) {
  const u = co.r(), kind = u < .25 ? 'salts' : u < .6 ? 'pills' : 'booze';
  co.items.push({i: co.items.length, z: round2(z), lane, top: !!top, kind});
  co.itemAt = z + 180 + co.r() * 180;
}
function addRow(co, z, open) {
  const r = co.r, lanes = [null, null, null];
  const pick = r(), most = open.length;
  let count = co.hard
    ? (z < 40 ? 1 : z < 150 ? (pick < .6 ? 1 : 2) : z < 350 ? (pick < .15 ? 1 : pick < .65 ? 2 : 3) : z < 1000 ? (pick < .05 ? 1 : pick < .45 ? 2 : 3) : (pick < .25 ? 2 : 3))
    : (z < 60 ? 1 : z < 200 ? (pick < .7 ? 1 : 2) : z < 450 ? (pick < .35 ? 1 : pick < .9 ? 2 : 3) : (pick < .15 ? 1 : pick < .7 ? 2 : 3));
  count = Math.min(count, most);
  // (a sled only with the road open all the way across, never more than one before 600 yards, two after: there's always
  // a lane it isn't in)
  let sleds = co.hard && most === 3 && z >= HARD_GAP.sled ? (z < 600 ? 1 : 2) : 0;
  shuffle(open.slice(), r).slice(0, count).forEach(l => {
    if (!co.hard) { lanes[l] = z < 40 || r() < .5 ? 'hurdle' : 'bar'; return; }
    if (z < 40) { lanes[l] = 'hurdle'; return; }
    const u = r(), hole = z >= HARD_GAP.hole, w = hole ? (sleds ? [.3, .3, .22, .18] : [.36, .36, .28, 0]) : [.5, .5, 0, 0];
    const t = u < w[0] ? 'hurdle' : u < w[0] + w[1] ? 'bar' : u < w[0] + w[1] + w[2] ? 'hole' : 'sled';
    if (t === 'sled') sleds--;
    lanes[l] = t;
    if (!(t in co.first)) co.first[t] = z;
  });
  co.rows.push({i: co.rows.length, z: round2(z), lanes, th: zoneAt(co, z).theme.id});
}
// A set at z (where the first ramp starts, or the fronts): a thing of the place's in one lane, or two side by side
// (always a lane left open). False if it would cross into the next place.
function addSet(co, z, L) {
  const r = co.r, th = zoneAt(co, z).theme, lanes = shuffle([0, 1, 2], r), two = co.hard ? L > .1 && r() < HARD_GAP.two : L > .2 && r() < .45;
  const plats = [];
  lanes.slice(0, two ? 2 : 1).forEach(lane => {
    const kind = pickKind(th, r), parts = KINDS[kind].build(r, L, speedOn(co, z) / 10), from = Math.min(...parts.map(q => q.at - (q.ramp || 0)));
    parts.forEach((q, i) => {
      const z0 = z + q.at - from;
      plats.push({lane, kind, part: i, z0: round2(z0), z1: round2(z0 + q.len), h: q.h, b: q.b || 0, ramp: q.ramp || 0, hi: q.h >= 2});
    });
  });
  const ze = Math.max(...plats.map(p => p.z1)), edge = (Math.floor(z / ZONE) + 1) * ZONE;
  if (ze > edge - 10) return false;
  const set = {i: co.sets.length, zs: round2(z), ze, plats};
  co.sets.push(set);
  // a power-up up top: on the highest thing there is to climb
  const roof = plats.filter(p => p.h >= 1.5).sort((a, b) => b.h - a.h)[0];
  if (roof && z >= co.itemAt - 40) addItem(co, roof.z0 + (roof.z1 - roof.z0) * (.35 + r() * .3), roof.lane, true);
  // the rows beside it: in the open lanes, a beat apart
  const open = [0, 1, 2].filter(l => !plats.some(p => p.lane === l)), zf = Math.min(...plats.map(p => p.z0));
  const gIn = (co.hard ? HARD_GAP : GAP).in;
  for (let at = zf + Math.max(gIn, gapAt(co, L, zf)) * speedOn(co, zf); at < ze - 3; at += Math.max(gIn, gapAt(co, L, at)) * speedOn(co, at)) {
    if (r() < .75) addRow(co, at, open);
  }
  const after = co.hard ? HARD_GAP.after : [.45, .15];
  co.z = ze + (gapAt(co, L, ze) + (plats.some(p => p.hi) ? after[0] : after[1])) * speedOn(co, ze);
  return true;
}
/** Works the course out as far as z yards (once; the same every time). */
export function fill(co, z) {
  while (co.z <= z + 2) {
    const r = co.r, at = co.z, H = HARD_GAP, L = Math.min(1, at / (co.hard ? H.mix : GAP.by));
    if (at > (co.hard ? H.cars : GAP.cars) && r() < (co.hard ? H.sets[0] + (H.sets[1] - H.sets[0]) * L : .2 + .18 * L) && addSet(co, at, L)) continue;
    addRow(co, at, [0, 1, 2]);
    const next = at + gapAt(co, L, at) * speedOn(co, at);
    if (at >= co.itemAt) addItem(co, (at + next) / 2, Math.floor(r() * 3), false);
    co.z = next;
  }
  co.done = z;
  return co;
}
function setAt(co, z) {
  const s = co.sets;
  let lo = 0, hi = s.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (s[m].ze < z) lo = m + 1; else if (s[m].zs > z) hi = m - 1; else return s[m];
  }
  return null;
}
const heightOf = (p, z) => (z > p.z1 || z < p.z0 - p.ramp ? 0 : z >= p.z0 ? p.h : p.h * (z - (p.z0 - p.ramp)) / p.ramp);
/** The parts (and ramps) in a lane at z yards. */
function partsAt(co, lane, z) {
  if (co.done < z) fill(co, z);
  const s = setAt(co, z);
  return s ? s.plats.filter(q => q.lane === lane && heightOf(q, z) > 0) : [];
}
/** How high the ground is in a lane at z yards for someone at height y (the top of the highest part he's up level
 *  with: a ramp, a roof, a pad; 0 on the road). Leave y out for the highest there is. */
export function groundAt(co, lane, z, y = Infinity) {
  let g = 0;
  partsAt(co, lane, z).forEach(p => { const h = heightOf(p, z); if (h <= y + STEP && h > g) g = h; });
  return g;
}
/** What's in the way of someone at height y in a lane at z yards (a part over his step and under his head: body
 *  yards tall, less in a slide), or null. */
export function blockAt(co, lane, z, y, body = BODY) {
  return partsAt(co, lane, z).find(p => heightOf(p, z) > y + STEP && p.b < y + body) || null;
}
/** The part in a lane at z yards he'd hit at the height of the road (for the crash's words), or null. */
export const platAt = (co, lane, z) => blockAt(co, lane, z, 0);

// ---------------------------------------------------------------------------------------------- a return
/** A new return: day n's run k (on the day's course: every run the same), you in the middle lane where you field it. */
export function startRun(n, k, hard = false) {
  return {n, k, co: course(n, 0, hard), t: 0, steps: 0, z: 0, yards: 0, lane: 1, x: 0, jFrom: 0, jt: 1, y: 0, vy: 0, jumpQ: -9,
    slide: 0, lastJuke: -9, bump: -9, next: 0, nextItem: 0, zone: 0, tds: 0,
    salts: 0, pills: 0, booze: 0, shield: 0, burst: 0, over: false, why: null, by: null,
    hits: 0, hitAt: 0, slow: 0, grace: 0, knock: 0, sideHit: null}; // (the linebacker starts on you, at the catch)
}
export const xOf = (run, lane) => (lane - 1) * LANE;
/** The lane you're in now (the nearest to you, mid-juke). */
export const laneOf = run => clamp(Math.round(run.x / LANE) + 1, 0, LANES - 1);
const grounded = run => run.vy <= 0 && run.y <= groundAt(run.co, laneOf(run), run.z, run.y) + 1e-3;
/** A swipe: 'left' and 'right' juke a lane over, 'up' jumps (out of a slide too), 'down' slides (and drops you, in the
 *  air). False when it can't: off the edge of the road or into the side of a vehicle (a hit, both: run.bump notes when,
 *  step counts it), the return's over. */
export function move(run, dir) {
  if (run.over) return false;
  if (dir === 'left' || dir === 'right') {
    const to = run.lane + (dir === 'left' ? -1 : 1);
    if (to < 0 || to >= LANES) { run.bump = run.t; run.sideHit = {edge: dir, lane: run.lane, side: true}; return false; } // (a hit: step counts it)
    const side = blockAt(run.co, to, run.z, run.y);
    if (side) { run.bump = run.t; run.sideHit = {plat: side, lane: to, side: true}; return false; } // (a hit: step counts it)
    run.jFrom = run.x; run.lane = to; run.jt = 0; run.lastJuke = run.t;
    return true;
  }
  if (dir === 'up') {
    if (grounded(run)) { run.vy = JUMP_V; run.slide = 0; run.jumpQ = -9; } else run.jumpQ = run.t;
    return true;
  }
  if (dir === 'down') {
    if (!grounded(run)) run.vy = Math.min(run.vy, DROP_V);
    run.slide = MOVE.slide; run.jumpQ = -9;
    return true;
  }
  return false;
}
/** How far behind you the linebacker is now, in yards (CHASE): near at the catch, running up on you from where he was
 *  just after a hit (near runUp s on), falling back to edge while he's on you, then out of sight (far) once he's lost;
 *  on top of you once he's tackled you. */
export function gapOf(run) {
  if (!run) return CHASE.far;
  if (run.over && run.why === 'caught') return .6;
  const s = run.t - run.hitAt;
  if (s < CHASE.runUp && run.fromGap > CHASE.near) { const k = 1 - s / CHASE.runUp; return CHASE.near + (run.fromGap - CHASE.near) * k * k; }
  if (s < CHASE.window) return CHASE.near + (CHASE.edge - CHASE.near) * clamp((s - CHASE.slow) / (CHASE.window - CHASE.slow), 0, 1);
  return CHASE.edge + (CHASE.far - CHASE.edge) * clamp((s - CHASE.window) / CHASE.drop, 0, 1);
}
/** Whether the linebacker is on you now (at the catch, or a hit ago, and not lost yet, or still in the picture as he
 *  falls away): a hit now is a tackle. */
export const chasing = run => !!run && !run.over && (run.t - run.hitAt < CHASE.window || gapOf(run) < CHASE.seen);
// What you run into (a barricade, a banner, a vehicle's front, its side): with painkillers (or just back up after the salts) you go
// through it (or up onto it); just after a hit, it's the same collision ('shoved'); with the linebacker on you, he tackles
// you (the salts shake him off once); else you stumble, slowed, and he's on your back.
// -> 'pass' | 'stumble' | false (the return's over).
// On the hard course, head on into a tall one's front (what.wall: more than a man's height over you) is the end of the
// return whether he's on you or not (the owner's ask, Oct 2026: Subway Surfers' train); the salts shake that off too.
function hit(run, out, what) {
  if (run.pills > 0 || run.shield > 0) { if (!what.side) out.push(Object.assign({type: what.ob ? 'trucked' : 'vaulted', z: run.z}, what)); return 'pass'; }
  if (run.grace > 0) { out.push(Object.assign({type: 'shoved', z: run.z}, what)); return 'pass'; }
  if (what.wall && run.co.hard) {
    if (run.salts > 0) {
      run.salts--; run.shield = SHIELD; run.fromGap = gapOf(run); run.hitAt = run.t; run.slow = CHASE.slow; run.burst = BURST.s;
      out.push(Object.assign({type: 'revived', z: run.z, salts: run.salts}, what));
      return 'pass';
    }
    run.over = true; run.why = 'crash'; run.by = what;
    out.push(Object.assign({type: 'crashed', z: run.z}, what));
    return false;
  }
  if (chasing(run)) {
    if (run.salts > 0) {
      run.salts--; run.shield = SHIELD; run.fromGap = gapOf(run); run.hitAt = run.t; run.slow = CHASE.slow; run.burst = BURST.s;
      out.push(Object.assign({type: 'revived', z: run.z, salts: run.salts}, what));
      return 'pass';
    }
    run.over = true; run.why = 'caught'; run.by = what;
    out.push(Object.assign({type: 'tackled', z: run.z, caught: true}, what));
    return false;
  }
  run.hits++; run.fromGap = gapOf(run); run.hitAt = run.t; run.slow = CHASE.slow; run.grace = CHASE.grace;
  out.push(Object.assign({type: 'stumbled', z: run.z, n: run.hits}, what));
  return 'stumble';
}
/** A hit's words: "Clipped the barricade", "Ran into the city bus", "Bounced off the city bus", "Ran out of room on the
 *  right". */
export function hitLine(what) {
  if (!what) return '';
  if (what.edge) return `Ran out of room on the ${what.edge}`;
  if (what.ob === 'hole') return `Stepped in the ${HOLES[what.row && what.row.th] || OBST.hole.name}`;
  if (what.ob) return OBST[what.ob].says;
  const p = what.plat, name = p && KINDS[p.kind] ? KINDS[p.kind].name : 'wall';
  return `${what.side ? 'Bounced off' : 'Ran into'} the ${name}`;
}
function sub(run, dt, out) {
  const co = run.co, v0 = speedAt(run.z, co.hard), v = v0 * (1 - CHASE.slowBy * run.slow / CHASE.slow) * (1 + burstOf(run));
  run.t += dt; run.z += v * dt; run.yards += v * dt * (run.booze > 0 ? 2 : 1);
  // (his strides: a yard a yard up to STRIDE_V, longer past it, so his legs never spin faster than they do at a sprint)
  run.steps += v * dt * Math.min(1, STRIDE_V / v0);
  if (run.jt < 1) { run.jt = Math.min(1, run.jt + dt / MOVE.juke); const e = 1 - (1 - run.jt) ** 3; run.x = run.jFrom + (xOf(run, run.lane) - run.jFrom) * e; }
  else run.x = xOf(run, run.lane);
  // a juke into a vehicle's side or off the edge of the road (refused by move) is a hit
  if (run.sideHit) { const w = run.sideHit; run.sideHit = null; if (!hit(run, out, w)) return; }
  // (knocked off a vehicle's front, you're in the lane you're headed for)
  const body = run.slide > 0 ? SLIDE_BODY : BODY;
  const lane = run.knock > 0 ? run.lane : laneOf(run), blk = blockAt(co, lane, run.z, run.y, body);
  // something in your way: a pad you've jumped up into from under stops you; a front (or a side, mid-juke) is a hit
  if (blk && blk.b > run.y + .8 && run.vy > 0) { run.vy = 0; run.y = Math.max(0, blk.b - BODY - 1e-3); }
  else if (blk) {
    const h = hit(run, out, {plat: blk, lane, wall: blk.hi && heightOf(blk, run.z) - run.y > 1.6});
    if (!h) return;
    // through it (painkillers) or a low one: up onto it; a tall one's front knocks you into the open lane beside it
    const to = h === 'stumble' && heightOf(blk, run.z) - run.y > 1.6
      ? [lane - 1, lane + 1].filter(l => l >= 0 && l < LANES && !blockAt(co, l, run.z, run.y, body) && !blockAt(co, l, run.z + 2, run.y, body)).sort((a, b) => Math.abs(a - 1) - Math.abs(b - 1))[0]
      : undefined;
    if (to != null) { run.jFrom = run.x; run.lane = to; run.jt = 0; run.knock = MOVE.juke; }
    else { run.y = heightOf(blk, run.z); run.vy = Math.max(run.vy, 3); }
  }
  const g = groundAt(co, lane, run.z, run.y);
  let landed = false;
  if (run.vy > 0 || run.y > g + 1e-3) {
    run.vy -= GRAV * dt; run.y += run.vy * dt;
    if (run.y <= g) { landed = run.vy < -1; run.y = g; run.vy = 0; if (landed) out.push({type: 'landed', z: run.z, on: g > 0}); }
  } else { run.y = g; run.vy = 0; }
  if (run.y <= g + 1e-3 && run.vy === 0 && run.t - run.jumpQ < BUFFER) { run.vy = JUMP_V; run.slide = 0; run.jumpQ = -9; }
  // the place, the touchdowns
  const zone = Math.floor(run.z / ZONE);
  if (zone > run.zone) { run.zone = zone; out.push({type: 'zone', z: run.z, theme: zoneAt(co, run.z).theme}); }
  const tds = tdsAt(run.z);
  if (tds > run.tds) { run.tds = tds; out.push({type: 'td', z: run.z, n: tds}); }
  // the rows: a barricade jumped, a banner slid under (or up over either, on a roof), or a hit
  const rows = co.rows;
  while (run.next < rows.length && rows[run.next].z <= run.z) {
    const row = rows[run.next++], ob = row.lanes[lane];
    // Something you've just left behind in the lane you juked out of: a juke.
    const near = run.t - run.lastJuke < .45 && row.lanes.some((t, l) => t && l !== lane && Math.abs(xOf(run, l) - run.jFrom) < LANE * .5);
    if (!ob) { out.push({type: near ? 'juked' : 'passed', row, lane, z: run.z}); continue; }
    const O = OBST[ob];
    if (run.y >= O.top + .1) { out.push({type: 'over', row, lane, ob, z: run.z}); continue; }
    if (O.beat === 'jump' && run.y >= O.clear) { out.push({type: 'hurdled', row, lane, ob, z: run.z}); continue; }
    if (O.beat === 'slide' && run.slide > 0 && run.y < .3) { out.push({type: 'slid', row, lane, ob, z: run.z}); continue; }
    if (!hit(run, out, {ob, row, lane})) return;
  }
  // the power-ups: in your lane, at your height
  const items = co.items;
  while (run.nextItem < items.length && items[run.nextItem].z <= run.z) {
    const it = items[run.nextItem++];
    if (it.lane !== lane || Math.abs(run.y - groundAt(co, it.lane, it.z)) > 1.4) continue;
    if (it.kind === 'salts') { run.salts = Math.min(SALTS_MAX, run.salts + 1); run.burst = BURST.s; }
    else run[it.kind] = POWER[it.kind].s;
    out.push({type: 'pickup', kind: it.kind, item: it, z: run.z});
  }
  run.slide = Math.max(0, run.slide - dt);
  run.pills = Math.max(0, run.pills - dt);
  run.booze = Math.max(0, run.booze - dt);
  run.shield = Math.max(0, run.shield - dt);
  run.burst = Math.max(0, (run.burst || 0) - dt);
  run.slow = Math.max(0, run.slow - dt);
  run.grace = Math.max(0, run.grace - dt);
  run.knock = Math.max(0, run.knock - dt);
}
/** Moves a return on dt seconds. Returns what happened: [{type: 'td' | 'zone' | 'juked' | 'hurdled' | 'slid' | 'over' |
 *  'passed' | 'landed' | 'pickup' | 'trucked' | 'vaulted' | 'stumbled' | 'shoved' | 'revived' | 'tackled' | 'crashed', z, ...}]
 *  ('juked': you left a thing's lane in the last moment before it; 'over': it was below you; 'trucked', 'vaulted':
 *  through a barricade or banner, or up onto a vehicle you'd have hit, on painkillers; 'stumbled': a hit, the linebacker on you
 *  (n: hits so far); 'shoved': the same collision a moment on; 'revived': the salts shook him off; 'tackled' (caught):
 *  he ran you down; 'crashed': head on into a tall one's front, on the hard course). */
export function step(run, dt) {
  if (run.over || !(dt > 0)) return [];
  const out = [];
  fill(run.co, run.z + 120);
  for (let left = Math.min(dt, .25); left > 1e-9 && !run.over;) {
    const h = Math.min(left, 1 / 120);
    sub(run, h, out);
    left -= h;
  }
  return out;
}
/** Ends a return where it is (the hard course, when this phone's no longer the owner's: views/return.js). */
export function stop(run) {
  if (!run || run.over) return;
  run.over = true; run.why = 'stopped';
}
/** What ended a return: the line for it ("Wrapped up", "Ran into the city bus"). */
export function endOf(run) {
  if (!run || !run.why) return '';
  if (run.why === 'caught') return 'Tackled from behind by the linebacker';
  if (run.why === 'stopped') return 'Whistled dead';
  if (run.why !== 'crash') return OBST[run.why] ? OBST[run.why].says : '';
  const p = run.by && run.by.plat;
  return `Ran into the ${p && KINDS[p.kind] ? KINDS[p.kind].name : 'wall'}`;
}
/** What's in front of you out to dist yards (and just behind, for a moment): {rows: [{row, d (yards ahead)}], sets:
 *  [{set, d}], items: [{item, d}]}. */
export function ahead(run, dist = 90, behind = 6) {
  const co = fill(run.co, run.z + dist), z = run.z;
  const rows = [], sets = [], items = [];
  for (let i = Math.max(0, run.next - 4); i < co.rows.length; i++) {
    const d = co.rows[i].z - z;
    if (d > dist) break;
    if (d >= -behind) rows.push({row: co.rows[i], d});
  }
  for (const s of co.sets) {
    if (s.zs - z > dist) break;
    if (s.ze - z >= -behind - 40) sets.push({set: s, d: s.zs - z});
  }
  for (let i = Math.max(0, run.nextItem - 2); i < co.items.length; i++) {
    const d = co.items[i].z - z;
    if (d > dist) break;
    if (d >= -behind) items.push({item: co.items[i], d});
  }
  return {rows, sets, items};
}

// ---------------------------------------------------------------------------------------------- memory
// 'gg-ret1': {days: {n: {r: [{y (yards), d (how far you ran)}, ...] (every run that day, in order), at (when the best
// one ended)}}, played (runs, all time)}. (A return kept as a plain number, before power-ups, is its yards and its
// distance.)
const KEY = 'gg-ret1', KEEP = 60, MAX_YARDS = 99999;
// Test play (the owner's: views/testplay.js): the day's game again in a sandbox, whenever he needs to test it. While
// it's on, play reads and writes a store of its own (KEY + '-test', the day started fresh each time), never posted and
// never counted; the posts and the all-time totals read the real one (real), and ending it brings the real day back as
// it was.
let TEST = false;
export const testing = () => TEST;
/** Turns test play on (day n started fresh in the sandbox) or off. */
export function setTest(on, n = todayNumber()) {
  TEST = !!on;
  if (TEST) { const v = read(); delete v.days[n]; write(v); }
}
const keyOf = real => (TEST && !real ? KEY + '-test' : KEY);
function read(real) {
  let v = null;
  try { v = JSON.parse(lsGet(keyOf(real)) || 'null'); } catch (_) { v = null; }
  if (!v || typeof v !== 'object' || !v.days || typeof v.days !== 'object') v = {days: {}};
  if (!Number.isInteger(v.played)) v.played = 0;
  return v;
}
function write(v, real) {
  Object.keys(v.days).map(Number).filter(Number.isInteger).sort((a, b) => b - a).slice(KEEP).forEach(k => { delete v.days[k]; });
  lsSet(keyOf(real), JSON.stringify(v));
}
const okNum = y => Number.isInteger(y) && y >= 0 && y <= MAX_YARDS;
const cleanOne = e => (okNum(e) ? {y: e, d: e} : e && okNum(e.y) && okNum(e.d) ? {y: e.y, d: e.d} : null);
const cleanList = r => (Array.isArray(r) ? r.map(cleanOne) : []).filter(Boolean);
/** The best of a day's runs ([{y, d}]): the most yards (the first of equals), or null. */
const bestOf = list => list.reduce((b, e) => (!b || e.y > b.y ? e : b), null);
/** Numbers from returns ([{y, d}]): yards (all of them), longest, tds. */
export function score(list) {
  let yards = 0, longest = 0, tds = 0;
  list.forEach(e => { yards += e.y; longest = Math.max(longest, e.y); tds += tdsAt(e.d); });
  return {yards, longest, tds};
}
/** Day n on this phone: {list ([{y, d}] every run), runs, next (the next run's number), best (its yards; 0 with none),
 *  at, official (the day that counts: the best run, {list: [it], at} plus its score, or null before a run)} plus the
 *  best run's score (yards, longest, tds). */
export function dayState(n, real) {
  const d = read(real).days[n] || {}, list = cleanList(d.r), b = bestOf(list);
  return Object.assign({list, runs: list.length, next: list.length, best: b ? b.y : 0, at: Number(d.at) || 0, official: officialOf(d)}, score(b ? [b] : []));
}
/** The day that counts: its best run ({list: [it], at} plus score), or null. */
export function officialOf(d) {
  const b = bestOf(cleanList(d && d.r));
  return b ? Object.assign({list: [b], at: Number(d.at) || 0}, score([b])) : null;
}
const yardsOf = v => clamp(Math.floor(v) || 0, 0, MAX_YARDS);
/** Saves run k's return (its yards, and how far you ran; k must be the next). Returns the day's state, or null (a
 *  return out of turn). */
export function record(n, k, yards, dist = yards) {
  const v = read(), day = v.days[n] || (v.days[n] = {r: []});
  const list = cleanList(day.r), was = bestOf(list);
  if (k !== list.length) return null;
  const e = {y: yardsOf(yards), d: yardsOf(dist)};
  list.push(e);
  day.r = list;
  delete day.live;
  if (!was || e.y > was.y) day.at = Date.now(); // (when the best run ended)
  v.played += 1;
  write(v);
  return dayState(n);
}
export function totals() {
  const v = read(true);
  return {played: Math.max(v.played, Object.values(v.days).filter(d => d && cleanList(d.r).length).length)};
}
// A return under way is kept as it goes (live: {k, y, d}), so one left behind (the app closed, the page left) still
// counts, ending where it was.
/** Notes how far kickoff k of day n has got (its yards so far, and how far you've run). */
export function keepLive(n, k, yards, dist = yards) {
  const v = read(), day = v.days[n] || (v.days[n] = {r: []});
  if (cleanList(day.r).length !== k) return;
  day.live = {k, y: Math.floor(yards), d: Math.floor(dist)};
  write(v);
}
/** Ends a return left behind on day n where it was. Returns the day's state when it did, else null. */
export function settle(n) {
  const v = read(), day = v.days[n];
  if (!day || !day.live) return null;
  const {k} = day.live, y = day.live.y ?? day.live.z, d = day.live.d ?? y, list = cleanList(day.r);
  delete day.live;
  write(v);
  return k === list.length && Number.isFinite(y) ? record(n, k, y, Number.isFinite(d) ? d : y) : null;
}
/** Whether day n has a return under way (kept by keepLive). */
export const live = n => { const d = read().days[n]; return !!(d && d.live && d.live.k === cleanList(d.r).length); };

// ---------------------------------------------------------------------------------------------- scoreboard
// Days ride on each phone's board doc (players/{uid}, daily.js), like the other games': rm2: {n: {y (yards), l (the
// longest return: the one), td (touchdowns), t (when it ended)}}: the day's best run, posted by itself once the board
// has loaded and again whenever a run beats it (and after a failed post). One day per person: across their phones the
// best counts. (rm1 held days of three kickoffs; rm2 began with one a day, first run counting, Oct 20 2026, and is
// each day's best run since replays came in the same day.)
const F = 'rm2', POST_BACK = 7;
let posting = false;
export function entryOf(p, n) {
  const e = p && p[F] && typeof p[F] === 'object' ? p[F][n] : null;
  if (!e || !Number.isInteger(e.y) || !Number.isInteger(e.l) || e.y < 0 || e.y > MAX_YARDS || e.l < 0 || e.l > e.y) return null;
  return {y: e.y, l: e.l, td: Number.isInteger(e.td) && e.td >= 0 ? e.td : 0, t: Number(e.t) || 0};
}
// The board as this phone may see it (THE RULE, CLAUDE.md): never every doc.
const docs = () => daily.LB.raw || daily.LB.players || [];
const meKey = () => (daily.LB.uid ? daily.boardKey({id: daily.LB.uid, nick: daily.LB.nick}) : null);
function people(list) {
  const m = new Map();
  list.forEach(p => { const k = daily.boardKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return m;
}
// A person's day across their docs: the best (the most yards, then the longest, then the earliest).
function bestEntry(list, n) {
  let out = null;
  list.forEach(p => {
    const e = entryOf(p, n);
    if (e && (!out || e.y > out.e.y || (e.y === out.e.y && (e.l > out.e.l || (e.l === out.e.l && e.t < out.e.t))))) out = {e, doc: p};
  });
  return out;
}
function unposted() {
  const list = docs(), mine = list.find(p => p.id === daily.LB.uid), k = meKey();
  const theirs = list.filter(p => p === mine || (k && daily.boardKey(p) === k));
  const v = read(true), top = todayNumber();
  return Object.keys(v.days).map(Number)
    .filter(n => Number.isInteger(n) && n <= top && n > top - POST_BACK && dayState(n, true).official)
    // (not posted yet, or this phone's best now beats what's posted)
    .filter(n => { const b = bestEntry(theirs, n); return !b || dayState(n, true).official.yards > b.e.y; })
    .sort((a, b) => a - b);
}
export async function autoPost() {
  const LB = daily.LB;
  if (posting || !LB.merge || !LB.ready || LB.off || !LB.uid) return false;
  const days = unposted();
  if (!days.length) return false;
  const out = {};
  days.forEach(n => { const s = dayState(n, true).official; out[n] = {y: s.yards, l: s.longest, td: s.tds, t: s.at || Date.now()}; });
  const body = {[F]: out};
  const mine = docs().find(p => p.id === LB.uid);
  if (!mine) Object.assign(body, {nick: (daily.postName() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0});
  posting = true;
  try { await LB.merge(body); return true; } catch (_) { return false; } finally { posting = false; }
}
try {
  daily.subscribe(type => { if (type === 'lb') autoPost(); });
  addEventListener('online', () => autoPost());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoPost(); });
} catch (_) {}

export function boardState() {
  if (daily.status === 'error') return 'wait';
  const LB = daily.LB;
  if (LB.off || LB.err) return 'off';
  if (daily.status !== 'ready' || !LB.ready) return 'loading';
  return 'ready';
}
const rowWho = (ds, k) => {
  const mk = meKey(), uid = daily.LB.uid;
  const rep = ds.find(p => p.id === uid) || ds.slice().sort((a, b) => (b.last || 0) - (a.last || 0))[0];
  return {key: k, name: daily.displayName(rep), managerId: daily.keyManager(k), guest: daily.guestOf(rep), me: ds.some(p => p.id === uid) || (!!mk && k === mk)};
};
const rank = (rows, same) => { rows.forEach((r, i) => { r.rank = i && same(rows[i - 1], r) ? rows[i - 1].rank : i + 1; }); return rows; };
/** Day n's board: one row per person, the most yards first, then the longest return, then touchdowns. Rows: {key, name,
 *  managerId, me, guest, y, l, td, rank}. list: board docs (default: the board as this phone may see it). */
export function boardRows(n = todayNumber(), list = docs()) {
  const rows = [];
  people(list).forEach((ds, k) => {
    const f = bestEntry(ds, n);
    if (f) rows.push(Object.assign(rowWho(ds, k), f.e));
  });
  const cmp = (a, b) => b.y - a.y || b.l - a.l || b.td - a.td;
  return rank(rows.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name)), (a, b) => !cmp(a, b));
}
// Weeks run Tuesday to Monday, as the NFL's do.
const weekKey = n => Math.floor((dateOf(n).getTime() - new Date(2026, 9, 13).getTime() + 3.6e6) / (7 * 86400000));
/** The days of day n's week played so far (up to today). */
export function weekDays(n = todayNumber(), today = todayNumber()) {
  const out = [];
  for (let d = 1; d <= today; d++) if (weekKey(d) === weekKey(n)) out.push(d);
  return out;
}
/** The week's board: yards summed over its days, then the longest of the week, then the days played. Rows: {key, name,
 *  managerId, me, guest, y, l, td, played, rank}. */
export function weekRows(n = todayNumber(), list = docs(), today = todayNumber()) {
  return totalsOver(weekDays(n, today), list);
}
/** The season's board (every day so far), the same way as the week's: rows as weekRows'. */
export function seasonRows(list = docs(), today = todayNumber()) {
  const days = [];
  for (let d = 1; d <= today; d++) days.push(d);
  return totalsOver(days, list);
}
function totalsOver(days, list) {
  const rows = [];
  people(list).forEach((ds, k) => {
    const row = Object.assign(rowWho(ds, k), {y: 0, l: 0, td: 0, played: 0});
    days.forEach(d => { const f = bestEntry(ds, d); if (f) { row.y += f.e.y; row.l = Math.max(row.l, f.e.l); row.td += f.e.td; row.played++; } });
    if (row.played) rows.push(row);
  });
  const cmp = (a, b) => b.y - a.y || b.l - a.l || a.played - b.played;
  return rank(rows.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name)), (a, b) => !cmp(a, b));
}
