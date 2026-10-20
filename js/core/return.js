// Return Man core: the Daily Games' endless runner, after Subway Surfers (the owner's ask, Oct 2026). You field a
// kickoff at your own goal line and run it back, straight up the field, as far as you can: the coverage team comes at
// you a row at a time, and you swipe to beat each man in your lane. Three lanes (the hash marks and the middle):
// swipe left or right to juke a lane over, up to hurdle a man diving at your legs, down to spin out of a wrap-up. A
// wedge of two blockers can only be juked around. The first man who gets you ends that return. You speed up as you go,
// the rows come quicker and fuller, and every 100 yards is a touchdown: the field goes on (an end zone, then another
// field), so a return never has to end. Three kickoffs a day, the same three courses on every phone; the day's score
// is the yards of all three. No DOM. Owner: RETURN.
//
//   todayNumber(), dateOf(n), dayLabel(n)       day 1 on START, a new day at local midnight
//   course(n, k), rowsTo(course, c)             day n's kickoff k (0-2): its rows of men, worked out as far as needed:
//                                               [{i, c (where it meets you, in closing yards), lanes: [type|null x 3]}]
//   speedAt(z), tdsAt(z), LANE, VD, RETURNS     your speed (yards a second) at z yards; touchdowns by z yards; the
//                                               lanes' spacing (yards); the coverage's speed; kickoffs a day
//   startRun(n, k), move(run, dir), step(run, dt)   a return, played: move takes a swipe ('left' 'right' 'up' 'down'),
//                                               step moves it on dt seconds and says what happened (events)
//   laneOf(run), xOf(run, lane), ahead(run, dist)   where you are; the rows in front of you (for drawing)
//   dayState(n, real), record(n, k, yards), score(list), totals()   localStorage 'gg-ret1'
//   keepLive(n, k, z), settle(n), live(n)       a return under way: kept as it goes, and counted if it's left behind
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

// ---------------------------------------------------------------------------------------------- the field
// The world in yards: x across (+ right), z up the field from your goal line (where you field the kick). The lanes are
// the hash marks and the middle (the NFL's hashes, 18 ft 6 in apart). The coverage runs at you (VD); you run at
// speedAt(z), from a jog to a sprint. A field is 100 yards and an end zone 10: you score at 100, 210, 320...
export const LANE = 3.083, LANES = 3, RETURNS = 3;
export const VD = 3.5;
export const SPEED = {start: 9.5, top: 19, ramp: 360};
export const speedAt = z => SPEED.start + (SPEED.top - SPEED.start) * (1 - Math.exp(-Math.max(0, z) / SPEED.ramp));
export const FIELD = 100, ENDZONE = 10;
/** Touchdowns in a return of z yards. */
export const tdsAt = z => (z < FIELD ? 0 : 1 + Math.floor((z - FIELD) / (FIELD + ENDZONE)));
// The moves, seconds: a juke takes you a lane over; a hurdle keeps you off the ground; a spin carries you through a
// wrap-up. Any move cuts the one before it short (a spin from the air brings you straight down).
export const MOVE = {juke: .16, hurdle: .62, spin: .5};
// The men: what each one is, and the move that beats him (a juke beats them all).
export const MEN = {
  wedge: {name: 'wedge', beat: null, says: 'Stoned by the wedge'},
  diver: {name: 'diving tackle', beat: 'hurdle', says: 'Taken down at the ankles'},
  wrap: {name: 'wrap-up', beat: 'spin', says: 'Wrapped up'}
};

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

// ---------------------------------------------------------------------------------------------- the course
// Rows sit in "closing yards" (c): you and they run at each other, so a row c yards out meets you once you've closed c
// (at speedAt + VD a second). The first comes 26 yards out. How long between rows: 1.3 seconds at first, down to GAP.min
// by 900 yards (and a bit more now and then). How full a row is grows with the yards too: one man a row early on (a
// wedge to juke round for the first 40), then two, then often three; never three wedges (there's always a way through,
// and from any lane you can get to it in the time).
export const GAP = {first: 26, max: 1.3, min: .6, by: 900, jitter: .25};
const COURSES = new Map();
/** Day n's kickoff k: the same on every phone. Its rows are worked out as they're needed (rowsTo). */
export function course(n, k) {
  const key = `${n}|${k}`;
  if (COURSES.has(key)) return COURSES.get(key);
  const c = {n, k, rows: [], r: rng(hashStr(`return-man-${n}-${k}`)), at: GAP.first, z: 0};
  if (COURSES.size > 12) COURSES.clear();
  COURSES.set(key, c);
  return c;
}
/** The course's rows out to closing yards c (worked out once). */
export function rowsTo(co, c) {
  while (co.at <= c + 1) {
    const r = co.r, z = co.z, L = Math.min(1, z / GAP.by);
    const pick = r(), count = z < 60 ? 1 : z < 200 ? (pick < .7 ? 1 : 2) : z < 450 ? (pick < .35 ? 1 : pick < .9 ? 2 : 3) : (pick < .15 ? 1 : pick < .7 ? 2 : 3);
    const order = [0, 1, 2];
    for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const lanes = [null, null, null];
    order.slice(0, count).forEach(l => {
      const u = r();
      lanes[l] = z < 40 ? 'wedge' : u < .5 - .15 * L ? 'wedge' : u < .75 - .05 * L ? 'diver' : 'wrap';
    });
    // never a row you can't get through: a full row keeps at least one man who can be beaten
    if (lanes.every(t => t === 'wedge')) lanes[order[0]] = r() < .5 ? 'diver' : 'wrap';
    co.rows.push({i: co.rows.length, c: Math.round(co.at * 100) / 100, lanes});
    const v = speedAt(z), T = GAP.max - (GAP.max - GAP.min) * L + r() * GAP.jitter;
    const gap = T * (v + VD);
    co.at += gap;
    co.z += gap * v / (v + VD);
  }
  return co.rows;
}

// ---------------------------------------------------------------------------------------------- a return
/** A new return: day n's kickoff k, you in the middle lane at your goal line. */
export function startRun(n, k) {
  return {n, k, co: course(n, k), t: 0, z: 0, c: 0, lane: 1, x: 0, jFrom: 0, jt: 1, air: 0, spin: 0, lastJuke: -9,
    next: 0, tds: 0, over: false, why: null, by: null};
}
export const xOf = (run, lane) => (lane - 1) * LANE;
/** The lane you're in now (the nearest to you, mid-juke). */
export const laneOf = run => clamp(Math.round(run.x / LANE) + 1, 0, LANES - 1);
/** A swipe: 'left' and 'right' juke a lane over, 'up' hurdles, 'down' spins. False when it can't (the edge of the field,
 *  or the return's over). */
export function move(run, dir) {
  if (run.over) return false;
  if (dir === 'left' || dir === 'right') {
    const to = run.lane + (dir === 'left' ? -1 : 1);
    if (to < 0 || to >= LANES) return false;
    run.jFrom = run.x; run.lane = to; run.jt = 0; run.lastJuke = run.t;
    return true;
  }
  if (dir === 'up') { run.spin = 0; run.air = MOVE.hurdle; return true; }
  if (dir === 'down') { run.air = 0; run.spin = MOVE.spin; return true; }
  return false;
}
/** Moves a return on dt seconds. Returns what happened: [{type: 'td' | 'juked' | 'hurdled' | 'spun' | 'tackled' |
 *  'passed', row, lane, z}] ('juked': you left a man's lane in the last moment before he got there). */
export function step(run, dt) {
  if (run.over || !(dt > 0)) return [];
  const out = [];
  const v = speedAt(run.z);
  run.t += dt; run.z += v * dt; run.c += (v + VD) * dt;
  if (run.jt < 1) { run.jt = Math.min(1, run.jt + dt / MOVE.juke); const e = 1 - (1 - run.jt) * (1 - run.jt); run.x = run.jFrom + (xOf(run, run.lane) - run.jFrom) * e; }
  else run.x = xOf(run, run.lane);
  const tds = tdsAt(run.z);
  if (tds > run.tds) { run.tds = tds; out.push({type: 'td', z: run.z, n: tds}); }
  const rows = rowsTo(run.co, run.c + 2);
  while (run.next < rows.length && rows[run.next].c <= run.c) {
    const row = rows[run.next++], lane = laneOf(run), man = row.lanes[lane];
    // A man you've just left behind in the lane you juked out of: a juke.
    const near = run.t - run.lastJuke < .45 && row.lanes.some((t, l) => t && l !== lane && Math.abs(xOf(run, l) - run.jFrom) < LANE * .5);
    if (!man) { out.push({type: near ? 'juked' : 'passed', row, lane, z: run.z}); continue; }
    const beat = MEN[man].beat;
    if (beat === 'hurdle' && run.air > 0) { out.push({type: 'hurdled', row, lane, z: run.z}); continue; }
    if (beat === 'spin' && run.spin > 0) { out.push({type: 'spun', row, lane, z: run.z}); continue; }
    run.over = true; run.why = man; run.by = {row, lane};
    out.push({type: 'tackled', row, lane, man, z: run.z});
    break;
  }
  run.air = Math.max(0, run.air - dt);
  run.spin = Math.max(0, run.spin - dt);
  return out;
}
/** The rows in front of you out to dist yards (and those just behind, for a moment): [{row, d (yards ahead of you)}]. */
export function ahead(run, dist = 70, behind = 6) {
  const rows = rowsTo(run.co, run.c + dist);
  const out = [];
  for (let i = Math.max(0, run.next - 3); i < rows.length; i++) {
    const d = rows[i].c - run.c;
    if (d > dist) break;
    if (d >= -behind) out.push({row: rows[i], d});
  }
  return out;
}
/** Where a return ended, as the field says it: "your own 34", "the 50", "their 12", or "the end zone" (just past a
 *  touchdown; after one, the next field goes the same way from its own goal line). */
export function spotOf(z) {
  const say = y => (y === 50 ? 'the 50' : y < 50 ? `your own ${Math.max(1, y)}` : `their ${100 - y}`);
  if (z < FIELD) return say(Math.floor(Math.max(0, z)));
  const f = (z - FIELD) % (FIELD + ENDZONE);
  return f < ENDZONE ? 'the end zone' : say(Math.floor(f - ENDZONE));
}

// ---------------------------------------------------------------------------------------------- memory
// 'gg-ret1': {days: {n: {r: [yards, ...] (each return run, in order), at (when the third ended)}}, played}.
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
const cleanList = r => (Array.isArray(r) ? r.filter(y => Number.isInteger(y) && y >= 0 && y <= MAX_YARDS).slice(0, RETURNS) : []);
/** A day's numbers from its returns' yards: yards (all of them), longest, tds. */
export function score(list) {
  let yards = 0, longest = 0, tds = 0;
  list.forEach(y => { yards += y; longest = Math.max(longest, y); tds += tdsAt(y); });
  return {yards, longest, tds};
}
/** Day n on this phone: {list (yards per return run), done, at, next (the next kickoff), official (the day that counts:
 *  {list, at} plus score(list), or null till all three are run)} plus score(list). */
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
/** Saves kickoff k's return (yards; k must be the next). Returns the day's state, or null (the day's done, or a return
 *  out of turn). */
export function record(n, k, yards) {
  const v = read(), day = v.days[n] || (v.days[n] = {r: []});
  const list = cleanList(day.r);
  if (list.length >= RETURNS || k !== list.length) return null;
  list.push(clamp(Math.floor(yards) || 0, 0, MAX_YARDS));
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
// A return under way is kept as it goes (live: {k, z}), so one left behind (the app closed, the page left) still
// counts, ending where it was: no kickoff run twice.
/** Notes how far kickoff k of day n has got (yards). */
export function keepLive(n, k, z) {
  const v = read(), day = v.days[n] || (v.days[n] = {r: []});
  if (cleanList(day.r).length !== k) return;
  day.live = {k, z: Math.floor(z)};
  write(v);
}
/** Ends a return left behind on day n where it was (yards so far). Returns the day's state when it did, else null. */
export function settle(n) {
  const v = read(), day = v.days[n];
  if (!day || !day.live) return null;
  const {k, z} = day.live, list = cleanList(day.r);
  delete day.live;
  write(v);
  return k === list.length && Number.isFinite(z) ? record(n, k, z) : null;
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
