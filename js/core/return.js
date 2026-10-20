// Return Man core: the Daily Games' endless runner, after Subway Surfers (the owner's ask, Oct 2026). You field a
// kickoff in the stadium and run it back as far as you can, and the run goes on out of the stadium: through the
// tailgate lots, downtown, the frozen tundra and the Wild West (a new place every ZONE yards, in an order of the
// kickoff's own), and round again. Three lanes. The coverage team comes at you a row at a time: swipe left or right to
// juke a lane over, up to jump (a man diving at your legs), down to spin out of a wrap-up (in the air: drop, then
// spin). A wedge of two blockers can only be juked around (or run over from up high). In the way too: each place's
// vehicles, parked in the lanes (a team bus, an RV, a train car...). The tall ones you go round, or run up a ramp onto
// the roof and along the top; the low ones you jump onto and run across. Jump down off the end, or juke off the side.
// On the way, three power-ups: smelling salts (an extra life: the next hit, you get back up), prescription painkillers
// (a few seconds when nothing can stop you) and booze (a few seconds of double yards). You speed up as you go, and
// every 100 yards is a touchdown. Three kickoffs a day, the same three courses on every phone; the day's score is the
// yards of all three. No DOM. Owner: RETURN.
//
//   todayNumber(), dateOf(n), dayLabel(n)       day 1 on START, a new day at local midnight
//   course(n, k), fill(course, z)               day n's kickoff k (0-2), worked out as far as z yards: its rows of men
//                                               [{i, z (where he meets you), lanes: [type|null x 3]}], its vehicles
//                                               (sets: [{i, zs, ze, plats: [{lane, z0 (the front), z1, h, ramp, hi}]}])
//                                               and its power-ups [{i, z, lane, top, kind}]
//   THEMES, ZONE, zoneAt(course, z)             the places, and which one z yards is in ({i, theme, z0})
//   groundAt(course, lane, z)                   how high the ground is there (on a ramp, a roof; 0 on the road)
//   speedAt(z), tdsAt(z), LANE, VD, RETURNS     your speed (yards a second) at z yards; touchdowns by z yards; the
//                                               lanes' spacing (yards); the coverage's speed; kickoffs a day
//   startRun(n, k), move(run, dir), step(run, dt)   a return, played: move takes a swipe ('left' 'right' 'up' 'down'),
//                                               step moves it on dt seconds and says what happened (events)
//   laneOf(run), xOf(run, lane), ahead(run, dist), endOf(run)   where you are; what's in front of you (for drawing);
//                                               what ended it
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
// middle (the NFL's hashes, 18 ft 6 in apart) and go on as the lanes of the road. The coverage runs at you (VD); you
// run at speedAt(z), from a jog to a sprint; every 100 yards is a touchdown.
export const LANE = 3.083, LANES = 3, RETURNS = 3;
export const VD = 3.5;
export const SPEED = {start: 9.5, top: 19, ramp: 360};
export const speedAt = z => SPEED.start + (SPEED.top - SPEED.start) * (1 - Math.exp(-Math.max(0, z) / SPEED.ramp));
export const TD = 100;
/** Touchdowns in a return of z yards. */
export const tdsAt = z => Math.max(0, Math.floor(z / TD));
// You, in the air: a jump (up) peaks at JUMP_V^2 / 2GRAV (1.35 yards, over a man at your ankles, up onto a low
// vehicle; a tall one's roof is out of reach) and lasts 2 JUMP_V / GRAV (.6 s). A jump swiped in the air waits for you
// to land (BUFFER s). Down in the air drops you (DROP_V) and spins you. You step up anything STEP yards or less (a
// ramp, onto a roof from the air); anything higher in your way is a crash. From OVER yards up, the men are below you.
export const GRAV = 30, JUMP_V = 9, DROP_V = -18, BUFFER = .25, STEP = .45, OVER = 1.55;
// The moves, seconds: a juke takes you a lane over; a spin carries you through a wrap-up.
export const MOVE = {juke: .16, spin: .5};
// The men: what each one is, and what beats him (a juke beats them all; so does being up high).
export const MEN = {
  wedge: {name: 'wedge', beat: null, says: 'Stoned by the wedge'},
  diver: {name: 'diving tackle', beat: 'jump', says: 'Taken down at the ankles'},
  wrap: {name: 'wrap-up', beat: 'spin', says: 'Wrapped up'}
};
// The vehicles: a tall one (HIGH_H yards; a ramp up onto its roof, or not) and a low one (LOW_H; jump on) in each place.
export const HIGH_H = 3, LOW_H = .95, RAMP = 8;
// The places, one after another, ZONE yards each: the stadium first, then the other four in the kickoff's own order,
// and round again. A vehicle never sits across the line between two (there's a gate on it).
export const ZONE = 220;
export const THEMES = [
  {id: 'stadium', name: 'The Stadium', hi: 'team bus', lo: 'bench'},
  {id: 'tailgate', name: 'The Tailgate', hi: 'RV', lo: 'beer pong table'},
  {id: 'downtown', name: 'Downtown', hi: 'city bus', lo: 'road work'},
  {id: 'tundra', name: 'The Frozen Tundra', hi: 'snowplow', lo: 'snowbank'},
  {id: 'west', name: 'The Wild West', hi: 'train car', lo: 'hay wagon'}
];
// The power-ups: salts (you can carry SALTS_MAX), pills (seconds) and booze (seconds of double yards).
export const POWER = {
  salts: {name: 'Smelling salts', says: 'An extra life'},
  pills: {name: 'Painkillers', says: 'Nothing can stop you', s: 6},
  booze: {name: 'Booze', says: 'Double yards', s: 8}
};
export const SALTS_MAX = 2, SHIELD = 1.2;

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
// Worked out a beat at a time, each beat a row of men or a set of vehicles, the next beat a moment later: 1.3 seconds
// at first, down to GAP.min by GAP.by yards (and a bit more now and then). The first row comes at GAP.first; the first
// vehicles after GAP.cars, more often as you go (a second one beside the first, later on, always leaving a lane
// open). Rows grow with the yards: one man early on (a wedge to juke round for the first 40), then two, then often
// three; never three wedges. Beside a vehicle a row is only in the open lanes, never a wedge, and a beat apart
// (IN_GAP s or more), so the open lane is always a way through. A power-up every 90 to 180 yards: on a tall vehicle's
// roof when there's one to put it on, else on the road in a lane between two beats.
export const GAP = {first: 22, cars: 45, max: 1.3, min: .62, by: 1000, jitter: .25, in: .8};
const COURSES = new Map();
/** Day n's kickoff k: the same on every phone. It's worked out as it's needed (fill). */
export function course(n, k) {
  const key = `${n}|${k}`;
  if (COURSES.has(key)) return COURSES.get(key);
  // the places after the stadium: the day's order, each kickoff starting one further on
  const others = shuffle([1, 2, 3, 4], rng(hashStr(`return-man-places-${n}`)));
  const order = [0, ...others.slice(k % 4), ...others.slice(0, k % 4)];
  const c = {n, k, order, rows: [], sets: [], items: [], r: rng(hashStr(`return-man-${n}-${k}`)), z: GAP.first, itemAt: 60, done: 0};
  if (COURSES.size > 12) COURSES.clear();
  COURSES.set(key, c);
  return c;
}
/** The place z yards is in: {i (the how-many-th), theme, z0 (where it starts)}. */
export function zoneAt(co, z) {
  const i = Math.max(0, Math.floor(z / ZONE));
  return {i, theme: THEMES[co.order[i % co.order.length]], z0: i * ZONE};
}
const gapAt = (co, L) => GAP.max - (GAP.max - GAP.min) * L + co.r() * GAP.jitter;
function addItem(co, z, lane, top) {
  const u = co.r(), kind = u < .25 ? 'salts' : u < .6 ? 'pills' : 'booze';
  co.items.push({i: co.items.length, z: round2(z), lane, top: !!top, kind});
  co.itemAt = z + 90 + co.r() * 90;
}
function addRow(co, z, open, L, wedges) {
  const r = co.r, lanes = [null, null, null];
  const pick = r(), most = open.length;
  let count = z < 60 ? 1 : z < 200 ? (pick < .7 ? 1 : 2) : z < 450 ? (pick < .35 ? 1 : pick < .9 ? 2 : 3) : (pick < .15 ? 1 : pick < .7 ? 2 : 3);
  count = Math.min(count, most);
  shuffle(open.slice(), r).slice(0, count).forEach(l => {
    const u = r();
    lanes[l] = !wedges ? (u < .55 ? 'diver' : 'wrap') : z < 40 ? 'wedge' : u < .5 - .15 * L ? 'wedge' : u < .75 - .05 * L ? 'diver' : 'wrap';
  });
  // never a row you can't get through: a full row keeps at least one man who can be beaten
  if (lanes.every(t => t === 'wedge')) lanes[Math.floor(r() * 3)] = r() < .5 ? 'diver' : 'wrap';
  co.rows.push({i: co.rows.length, z: round2(z), lanes});
}
// A set of vehicles at z (where the first ramp starts, or the fronts): false if it would cross into the next place.
function addSet(co, z, L) {
  const r = co.r, lanes = shuffle([0, 1, 2], r), two = L > .2 && r() < .45;
  const plats = lanes.slice(0, two ? 2 : 1).map((lane, j) => {
    const hi = r() < (j ? .55 : .45), len = hi ? 14 + r() * (12 + 18 * L) : 6 + r() * 6;
    return {lane, hi, h: hi ? HIGH_H : LOW_H, len, ramp: hi && r() < .65 ? RAMP : 0};
  });
  const zf = z + Math.max(...plats.map(p => p.ramp));
  plats.forEach(p => { p.z0 = round2(zf); p.z1 = round2(zf + p.len); delete p.len; });
  const ze = Math.max(...plats.map(p => p.z1)), edge = (Math.floor(z / ZONE) + 1) * ZONE;
  if (ze > edge - 10) return false;
  const set = {i: co.sets.length, zs: round2(z), ze, plats};
  co.sets.push(set);
  // a power-up on a roof
  const roof = plats.find(p => p.hi);
  if (roof && z >= co.itemAt - 40) addItem(co, roof.z0 + (roof.z1 - roof.z0) * (.35 + r() * .3), roof.lane, true);
  // the rows beside it: in the open lanes, a beat apart
  const open = [0, 1, 2].filter(l => !plats.some(p => p.lane === l));
  for (let at = zf + Math.max(GAP.in, gapAt(co, L)) * speedAt(zf); at < ze - 3; at += Math.max(GAP.in, gapAt(co, L)) * speedAt(at)) {
    if (r() < .75) addRow(co, at, open, L, false);
  }
  co.z = ze + (gapAt(co, L) + (plats.some(p => p.hi) ? .45 : .15)) * speedAt(ze);
  return true;
}
/** Works the course out as far as z yards (once; the same every time). */
export function fill(co, z) {
  while (co.z <= z + 2) {
    const r = co.r, at = co.z, L = Math.min(1, at / GAP.by);
    if (at > GAP.cars && r() < .2 + .18 * L && addSet(co, at, L)) continue;
    addRow(co, at, [0, 1, 2], L, true);
    const next = at + gapAt(co, L) * speedAt(at);
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
/** The vehicle (or its ramp) in a lane at z yards, or null. */
export function platAt(co, lane, z) {
  if (co.done < z) fill(co, z);
  const s = setAt(co, z), p = s && s.plats.find(q => q.lane === lane);
  return p && heightOf(p, z) > 0 ? p : null;
}
/** How high the ground is in a lane at z yards (a ramp, a roof; 0 on the road). */
export function groundAt(co, lane, z) {
  const p = platAt(co, lane, z);
  return p ? heightOf(p, z) : 0;
}

// ---------------------------------------------------------------------------------------------- a return
/** A new return: day n's kickoff k, you in the middle lane where you field it. */
export function startRun(n, k) {
  return {n, k, co: course(n, k), t: 0, z: 0, yards: 0, lane: 1, x: 0, jFrom: 0, jt: 1, y: 0, vy: 0, jumpQ: -9,
    spin: 0, lastJuke: -9, bump: -9, next: 0, nextItem: 0, zone: 0, tds: 0,
    salts: 0, pills: 0, booze: 0, shield: 0, over: false, why: null, by: null};
}
export const xOf = (run, lane) => (lane - 1) * LANE;
/** The lane you're in now (the nearest to you, mid-juke). */
export const laneOf = run => clamp(Math.round(run.x / LANE) + 1, 0, LANES - 1);
const grounded = run => run.vy <= 0 && run.y <= groundAt(run.co, laneOf(run), run.z) + 1e-3;
/** A swipe: 'left' and 'right' juke a lane over, 'up' jumps, 'down' spins (and drops you, in the air). False when it
 *  can't: the edge of the road, the side of a vehicle (run.bump notes when), the return's over. */
export function move(run, dir) {
  if (run.over) return false;
  if (dir === 'left' || dir === 'right') {
    const to = run.lane + (dir === 'left' ? -1 : 1);
    if (to < 0 || to >= LANES) return false;
    if (groundAt(run.co, to, run.z) > run.y + STEP) { run.bump = run.t; return false; }
    run.jFrom = run.x; run.lane = to; run.jt = 0; run.lastJuke = run.t;
    return true;
  }
  if (dir === 'up') {
    if (grounded(run)) { run.vy = JUMP_V; run.spin = 0; run.jumpQ = -9; } else run.jumpQ = run.t;
    return true;
  }
  if (dir === 'down') {
    if (!grounded(run)) run.vy = Math.min(run.vy, DROP_V);
    run.spin = MOVE.spin; run.jumpQ = -9;
    return true;
  }
  return false;
}
// What gets you (a man, a vehicle's front): with painkillers (or just back up) you go through it (or up onto it);
// with salts you go down and get back up; else that's the return.
function hit(run, out, what) {
  const kind = what.man ? 'trucked' : 'vaulted';
  if (run.pills > 0 || run.shield > 0) { out.push(Object.assign({type: kind, z: run.z}, what)); return true; }
  if (run.salts > 0) {
    run.salts--; run.shield = SHIELD;
    out.push(Object.assign({type: 'revived', z: run.z, salts: run.salts}, what));
    return true;
  }
  run.over = true; run.why = what.man || 'crash'; run.by = what;
  out.push(Object.assign({type: 'tackled', z: run.z}, what));
  return false;
}
function sub(run, dt, out) {
  const co = run.co, v = speedAt(run.z);
  run.t += dt; run.z += v * dt; run.yards += v * dt * (run.booze > 0 ? 2 : 1);
  if (run.jt < 1) { run.jt = Math.min(1, run.jt + dt / MOVE.juke); const e = 1 - (1 - run.jt) * (1 - run.jt); run.x = run.jFrom + (xOf(run, run.lane) - run.jFrom) * e; }
  else run.x = xOf(run, run.lane);
  const lane = laneOf(run), g = groundAt(co, lane, run.z);
  // a vehicle's front (or side, mid-juke) in your way
  if (g > run.y + STEP) {
    const p = platAt(co, lane, run.z);
    if (!hit(run, out, {plat: p, lane})) return;
    run.y = g; run.vy = Math.max(run.vy, 3);
  }
  let landed = false;
  if (run.vy > 0 || run.y > g + 1e-3) {
    run.vy -= GRAV * dt; run.y += run.vy * dt;
    if (run.y <= g) { landed = run.vy < -1; run.y = g; run.vy = 0; if (landed) out.push({type: 'landed', z: run.z, on: g > 0}); }
  } else { run.y = g; run.vy = 0; }
  if (run.y <= g + 1e-3 && run.vy === 0 && run.t - run.jumpQ < BUFFER) { run.vy = JUMP_V; run.spin = 0; run.jumpQ = -9; }
  // the place, the touchdowns
  const zone = Math.floor(run.z / ZONE);
  if (zone > run.zone) { run.zone = zone; out.push({type: 'zone', z: run.z, theme: zoneAt(co, run.z).theme}); }
  const tds = tdsAt(run.z);
  if (tds > run.tds) { run.tds = tds; out.push({type: 'td', z: run.z, n: tds}); }
  // the men
  const rows = co.rows;
  while (run.next < rows.length && rows[run.next].z <= run.z) {
    const row = rows[run.next++], man = row.lanes[lane];
    // A man you've just left behind in the lane you juked out of: a juke.
    const near = run.t - run.lastJuke < .45 && row.lanes.some((t, l) => t && l !== lane && Math.abs(xOf(run, l) - run.jFrom) < LANE * .5);
    if (!man) { out.push({type: near ? 'juked' : 'passed', row, lane, z: run.z}); continue; }
    const beat = MEN[man].beat;
    if (run.y >= OVER) { out.push({type: 'over', row, lane, man, z: run.z}); continue; }
    if (beat === 'jump' && run.y >= .35) { out.push({type: 'hurdled', row, lane, z: run.z}); continue; }
    if (beat === 'spin' && run.spin > 0) { out.push({type: 'spun', row, lane, z: run.z}); continue; }
    if (!hit(run, out, {man, row, lane})) return;
  }
  // the power-ups: in your lane, at your height
  const items = co.items;
  while (run.nextItem < items.length && items[run.nextItem].z <= run.z) {
    const it = items[run.nextItem++];
    if (it.lane !== lane || Math.abs(run.y - groundAt(co, it.lane, it.z)) > 1.4) continue;
    if (it.kind === 'salts') run.salts = Math.min(SALTS_MAX, run.salts + 1);
    else run[it.kind] = POWER[it.kind].s;
    out.push({type: 'pickup', kind: it.kind, item: it, z: run.z});
  }
  run.spin = Math.max(0, run.spin - dt);
  run.pills = Math.max(0, run.pills - dt);
  run.booze = Math.max(0, run.booze - dt);
  run.shield = Math.max(0, run.shield - dt);
}
/** Moves a return on dt seconds. Returns what happened: [{type: 'td' | 'zone' | 'juked' | 'hurdled' | 'spun' | 'over' |
 *  'passed' | 'landed' | 'pickup' | 'trucked' | 'vaulted' | 'revived' | 'tackled', z, ...}] ('juked': you left a man's
 *  lane in the last moment before he got there; 'over': he was below you; 'trucked', 'vaulted': through a man or up
 *  onto a vehicle you'd have hit, on painkillers; 'revived': the salts got you up). */
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
/** What ended a return: the line for it ("Wrapped up", "Ran into the city bus"). */
export function endOf(run) {
  if (!run || !run.why) return '';
  if (run.why !== 'crash') return MEN[run.why].says;
  const p = run.by && run.by.plat, th = zoneAt(run.co, run.z).theme;
  return `Ran into the ${p && !p.hi ? th.lo : th.hi}`;
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
// 'gg-ret1': {days: {n: {r: [{y (yards), d (how far you ran)}, ...] (each return run, in order), at (when the third
// ended)}}, played}. (A return kept as a plain number, before power-ups, is its yards and its distance.)
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
const cleanList = r => (Array.isArray(r) ? r.map(cleanOne) : []).filter(Boolean).slice(0, RETURNS);
/** A day's numbers from its returns ([{y, d}]): yards (all of them), longest, tds. */
export function score(list) {
  let yards = 0, longest = 0, tds = 0;
  list.forEach(e => { yards += e.y; longest = Math.max(longest, e.y); tds += tdsAt(e.d); });
  return {yards, longest, tds};
}
/** Day n on this phone: {list ([{y, d}] per return run), done, at, next (the next kickoff), official (the day that
 *  counts: {list, at} plus score(list), or null till all three are run)} plus score(list). */
export function dayState(n, real) {
  const d = read(real).days[n] || {}, list = cleanList(d.r);
  return Object.assign({list, done: list.length >= RETURNS, at: Number(d.at) || 0, next: list.length, official: officialOf(d)}, score(list));
}
/** The day that counts: all three returns ({list, at} plus score(list)), or null. */
export function officialOf(d) {
  const list = cleanList(d && d.r);
  if (list.length < RETURNS) return null;
  return Object.assign({list, at: Number(d.at) || 0}, score(list));
}
const yardsOf = v => clamp(Math.floor(v) || 0, 0, MAX_YARDS);
/** Saves kickoff k's return (its yards, and how far you ran; k must be the next). Returns the day's state, or null (the
 *  day's done, or a return out of turn). */
export function record(n, k, yards, dist = yards) {
  const v = read(), day = v.days[n] || (v.days[n] = {r: []});
  const list = cleanList(day.r);
  if (list.length >= RETURNS || k !== list.length) return null;
  list.push({y: yardsOf(yards), d: yardsOf(dist)});
  day.r = list;
  delete day.live;
  if (list.length >= RETURNS) { day.at = Date.now(); v.played += 1; }
  write(v);
  return dayState(n);
}
export function totals() {
  const v = read(true);
  return {played: v.played};
}
// A return under way is kept as it goes (live: {k, y, d}), so one left behind (the app closed, the page left) still
// counts, ending where it was: no kickoff run twice.
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
// Days ride on each phone's board doc (players/{uid}, daily.js), like the other games': rm1: {n: {y (yards, all three
// returns), l (the longest), td (touchdowns), t (when the third ended)}}. A finished day posts by itself once the board
// has loaded (and again after a failed post). One day per person: across their phones the first finished counts.
const F = 'rm1', POST_BACK = 7;
let posting = false;
export function entryOf(p, n) {
  const e = p && p[F] && typeof p[F] === 'object' ? p[F][n] : null;
  if (!e || !Number.isInteger(e.y) || !Number.isInteger(e.l) || e.y < 0 || e.y > MAX_YARDS * RETURNS || e.l < 0 || e.l > e.y) return null;
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
function firstOf(list, n) {
  let out = null;
  list.forEach(p => {
    const e = entryOf(p, n);
    if (e && (!out || e.t < out.e.t || (e.t === out.e.t && String(p.id) < String(out.doc.id)))) out = {e, doc: p};
  });
  return out;
}
function unposted() {
  const list = docs(), mine = list.find(p => p.id === daily.LB.uid), k = meKey();
  const theirs = list.filter(p => p === mine || (k && daily.boardKey(p) === k));
  const v = read(true), top = todayNumber();
  return Object.keys(v.days).map(Number)
    .filter(n => Number.isInteger(n) && n <= top && n > top - POST_BACK && dayState(n, true).official)
    .filter(n => !theirs.some(p => entryOf(p, n)))
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
    const f = firstOf(ds, n);
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
  const days = weekDays(n, today), rows = [];
  people(list).forEach((ds, k) => {
    const row = Object.assign(rowWho(ds, k), {y: 0, l: 0, td: 0, played: 0});
    days.forEach(d => { const f = firstOf(ds, d); if (f) { row.y += f.e.y; row.l = Math.max(row.l, f.e.l); row.td += f.e.td; row.played++; } });
    if (row.played) rows.push(row);
  });
  const cmp = (a, b) => b.y - a.y || b.l - a.l || a.played - b.played;
  return rank(rows.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name)), (a, b) => !cmp(a, b));
}
