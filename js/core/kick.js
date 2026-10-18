// Kick It core: the Daily Games' field-goal game, after Paper Toss. Each day everyone gets the same run of kicks: the
// posts stand somewhere new for every kick (a different distance and angle), the wind changes, the kicks get longer
// and windier as the run goes on, and the third miss ends it. A kick is a flick of the ball: its direction aims, its
// speed is the leg; the wind carries the ball in the air. No DOM. Owner: KICK.
//
//   todayNumber(), dateOf(n), dayLabel(n)       day 1 on START, a new run at local midnight
//   kicks(n)                                    day n's kicks: [{i, d (yards to the posts), gx (the posts' offset,
//                                               yards, + right), w (wind, mph, 1-25), dir (wind's heading, degrees: 0
//                                               toward the posts, 90 to the right)}]
//   windCall(kick, launch, call)                what the wind did: 'took' (it would have been good in calm air),
//                                               'carried' (it went in only because of the wind), or null
//   launchOf({dx, dy, speed, aim})              a flick on screen (px, px, px/ms; aim: where it points at the posts)
//                                               -> {theta, v}, or null (not a kick)
//   fly(kick, launch)                           the flight and the call: {made, why, d, tCross, at, pos(t), tEnd}
//   dayState(n), record(n, kick, call), score(list), totals()   localStorage 'gg-kick1'
//   autoPost(), boardRows(n), weekRows(n), weekDays(n), boardState()   the league scoreboard (below)
//
// THE RULE (CLAUDE.md): the scoreboard reads daily.LB.raw, the board as this phone may see it: league members and
// Ryan D for everyone; a guest (or Ryan S) only on their own phones.
import {lsGet, lsSet} from './ui.js';
import * as daily from './daily.js';

// ---------------------------------------------------------------------------------------------- days
export const START = '2026-10-18';
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

// ---------------------------------------------------------------------------------------------- the kicks
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
export const MAX_KICKS = 40, STRIKES = 3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Day n's kicks, the same on every phone. The first few are chip shots near the middle; then the posts wander
 *  further off to the side, the kicks get longer (a yard and a third a kick, 62 the longest, about kick 30 on) and the
 *  wind stronger: a breeze from the first kick (1-4 mph), 3-9 by kick 6, 5-15 by kick 11, up to 25 from kick 21. */
export function kicks(n) {
  const r = rng(hashStr(`kick-it-${n}`)), out = [];
  for (let i = 0; i < MAX_KICKS; i++) {
    const d = Math.round(clamp(19 + i * 1.35 + (r() * 8 - 3), 18, 62));
    const span = Math.min(17, 3 + i * .9);
    const gx = Math.round((r() * 2 - 1) * span * 10) / 10;
    const w = Math.round(clamp(1 + i * .45 + r() * (3 + i * .6), 0, 25));
    const dir = Math.round(r() * 360);
    out.push({i, d, gx, w, dir});
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- the kick
// The world in yards: x across (+ right), y up, z downfield from the tee. The posts stand on the plane z = d: uprights
// 18 ft 6 in apart (3.083 yards each side of the middle), the crossbar 10 ft up (3.333 yards), drawn 21 ft above it. The camera sits CAM.back
// behind the tee and CAM.h up, looking downfield (views/kick.js draws with the same numbers).
export const POST = {half: 3.083, bar: 3.333, top: 10.333};
export const CAM = {h: 2, back: 4};
export const GRAV = 10.72;                 // yards a second, a second
const ELEV = 37 * Math.PI / 180;           // the ball's climb off the tee
// The wind. Across the field the ball goes with it at once and more the longer it's up (yards per mph: WIND_ACROSS.v a
// second plus WIND_ACROSS.a a second squared), so even a chip shot moves: at full leg 10 mph across moves a 20-yarder
// over a yard, 20 mph a 40-yarder about 6 (the posts are 6 wide), 25 mph a 62-yarder about 12. Along the field it
// pushes (WIND_ALONG, yards a second a second per mph): a headwind costs carry without making the long kicks impossible.
const WIND_ACROSS = {v: .15, a: .025}, WIND_ALONG = .18;
/** A flick (dx, dy: its travel on screen in px, up negative; speed: px a millisecond near its end) as a kick: theta, the
 *  aim (radians off straight downfield, + right), so that a flick at the posts on screen goes at the posts; v, the
 *  leg (yards a second), from the flick's speed. aim, from the screen (views/kick.js): the tangent of the line from the
 *  tee to where the flick's line crosses the crossbar's height on screen, at the posts' distance; without it, the
 *  flick's angle on screen read through the camera. Null for a flick that doesn't go up the screen. */
export function launchOf({dx, dy, speed, aim}) {
  if (!(dy < -24)) return null;
  const alpha = clamp(Math.atan2(dx, -dy), -1.3, 1.3);
  const theta = clamp(Number.isFinite(aim) ? Math.atan(aim) : Math.atan(Math.tan(alpha) * CAM.h / CAM.back), -1.1, 1.1);
  const v = clamp(13 + speed * 9.5, 14, 33);
  return {theta, v};
}
/** A kick's flight and its call. made; why: 'good', 'wide-l', 'wide-r', 'post' (off an upright), 'bar' (off the
 *  crossbar), 'short'; d (the kick's distance); tCross (when it reaches the posts' plane, or null); at ({x, y} there,
 *  x from the posts' middle); pos(t) -> {x, y, z} (the world); tEnd (when to stop drawing it). */
export function fly(kick, launch) {
  const {d, gx, w, dir} = kick, {theta, v} = launch;
  const a = dir * Math.PI / 180, wx = w * Math.sin(a), az = WIND_ALONG * w * Math.cos(a);
  const vh = v * Math.cos(ELEV), vx = vh * Math.sin(theta), vz = vh * Math.cos(theta), vy = v * Math.sin(ELEV);
  const pos = t => ({x: vx * t + wx * (WIND_ACROSS.v * t + WIND_ACROSS.a * t * t), y: Math.max(0, vy * t - .5 * GRAV * t * t), z: vz * t + .5 * az * t * t});
  const tLand = 2 * vy / GRAV;
  // When it reaches the posts' plane (z = d), if it does before it lands.
  let tCross = null;
  if (Math.abs(az) < 1e-6) tCross = d / vz;
  else {
    const disc = vz * vz + 2 * az * d;
    if (disc >= 0) tCross = (-vz + Math.sqrt(disc)) / az;
  }
  if (tCross != null && (!(tCross > 0) || tCross > tLand)) tCross = null;
  let why = 'short', at = null;
  if (tCross != null) {
    const p = pos(tCross), rel = p.x - gx, ar = Math.abs(rel);
    at = {x: rel, y: p.y};
    if (ar > POST.half + .1) why = rel < 0 ? 'wide-l' : 'wide-r';
    else if (ar > POST.half - .1) why = 'post';
    else if (p.y >= POST.bar) why = 'good';
    else if (p.y >= POST.bar - .25) why = 'bar';
    else why = 'short';
  }
  const tEnd = Math.min(tLand, tCross != null ? tCross + .9 : tLand);
  return {made: why === 'good', why, d, tCross, at, pos, tEnd, tLand};
}
export const CALLS = {good: 'It’s good!', 'wide-l': 'Wide left', 'wide-r': 'Wide right', post: 'Off the upright', bar: 'Off the crossbar', short: 'Short'};
/** What the wind did to a kick: 'took' (a miss that would have been good in calm air), 'carried' (good only because of
 *  the wind), or null (it made no difference, or there was none). */
export function windCall(kick, launch, call) {
  if (!kick.w) return null;
  const calm = fly(Object.assign({}, kick, {w: 0}), launch);
  return calm.made === call.made ? null : call.made ? 'carried' : 'took';
}

// ---------------------------------------------------------------------------------------------- memory
// 'gg-kick1': {days: {n: {r: [[why, d], ...] (each kick taken), done, at}}, played}
const KEY = 'gg-kick1', KEEP = 60;
const WHYS = Object.keys(CALLS);
function read() {
  let v = null;
  try { v = JSON.parse(lsGet(KEY) || 'null'); } catch (_) { v = null; }
  if (!v || typeof v !== 'object' || !v.days || typeof v.days !== 'object') v = {days: {}};
  if (!Number.isInteger(v.played)) v.played = 0;
  return v;
}
function write(v) {
  Object.keys(v.days).map(Number).filter(Number.isInteger).sort((a, b) => b - a).slice(KEEP).forEach(k => { delete v.days[k]; });
  lsSet(KEY, JSON.stringify(v));
}
const cleanList = r => (Array.isArray(r) ? r.filter(x => Array.isArray(x) && WHYS.includes(x[0]) && Number.isFinite(x[1])).slice(0, MAX_KICKS) : []);
/** A run's numbers: made, missed, longest (yards, 0 with none), yards (all the made kicks'). */
export function score(list) {
  let made = 0, missed = 0, longest = 0, yards = 0;
  list.forEach(([why, d]) => { if (why === 'good') { made++; longest = Math.max(longest, d); yards += d; } else missed++; });
  return {made, missed, longest, yards};
}
/** Day n on this phone: {list ([why, d] per kick taken), done, at, next (the next kick's index)} plus score(list). */
export function dayState(n) {
  const d = read().days[n] || {}, list = cleanList(d.r);
  const done = !!d.done || score(list).missed >= STRIKES || list.length >= MAX_KICKS;
  return Object.assign({list, done, at: Number(d.at) || 0, next: list.length}, score(list));
}
/** Saves a kick of day n's run (kick: its index, which must be the next). Returns the day's state, or null (a finished
 *  run, or a kick out of turn). */
export function record(n, i, call) {
  const v = read(), day = v.days[n] || (v.days[n] = {r: []});
  const list = cleanList(day.r);
  if (day.done || i !== list.length) return null;
  list.push([call.why, call.d]);
  day.r = list;
  const s = score(list);
  if (s.missed >= STRIKES || list.length >= MAX_KICKS) {
    day.done = true;
    day.at = Date.now();
    v.played += 1;
  }
  write(v);
  return dayState(n);
}
export function totals() {
  const v = read();
  return {played: v.played};
}

// ---------------------------------------------------------------------------------------------- scoreboard
// Runs ride on each phone's board doc (players/{uid}, daily.js), like 17-0's and the Drill's: kk1: {n: {m (made), l
// (the longest, yards), y (yards made in all), k (kicks taken), t (when it ended)}}. A finished run posts by itself
// once the board has loaded (and again after a failed post). One run per person per day: across their phones the
// first finished counts.
const F = 'kk1', POST_BACK = 7;
let posting = false;
export function entryOf(p, n) {
  const e = p && p[F] && typeof p[F] === 'object' ? p[F][n] : null;
  if (!e || !Number.isInteger(e.m) || !Number.isInteger(e.l) || e.m < 0 || e.m > MAX_KICKS || e.l < 0 || e.l > 70) return null;
  return {m: e.m, l: e.l, y: Number.isInteger(e.y) ? e.y : 0, k: Number.isInteger(e.k) ? e.k : 0, t: Number(e.t) || 0};
}
// The board as this phone may see it (THE RULE, CLAUDE.md): never LB.all.
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
  const v = read(), top = todayNumber();
  return Object.keys(v.days).map(Number)
    .filter(n => Number.isInteger(n) && n <= top && n > top - POST_BACK && dayState(n).done)
    .filter(n => !theirs.some(p => entryOf(p, n)))
    .sort((a, b) => a - b);
}
export async function autoPost() {
  const LB = daily.LB;
  if (posting || !LB.merge || !LB.ready || LB.off || !LB.uid) return false;
  const days = unposted();
  if (!days.length) return false;
  const out = {};
  days.forEach(n => { const s = dayState(n); out[n] = {m: s.made, l: s.longest, y: s.yards, k: s.list.length, t: s.at || Date.now()}; });
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
/** Day n's board: one row per person, most made first, then the longest, then yards. Rows: {key, name, managerId, me,
 *  guest, m, l, y, k, rank}. list: board docs (default: the board as this phone may see it). */
export function boardRows(n = todayNumber(), list = docs()) {
  const rows = [];
  people(list).forEach((ds, k) => {
    const f = firstOf(ds, n);
    if (f) rows.push(Object.assign(rowWho(ds, k), f.e));
  });
  const cmp = (a, b) => b.m - a.m || b.l - a.l || b.y - a.y;
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
/** The week's board: made kicks summed over its days, then the longest of the week, then the days played. Rows: {key,
 *  name, managerId, me, guest, m, l, played, rank}. */
export function weekRows(n = todayNumber(), list = docs(), today = todayNumber()) {
  const days = weekDays(n, today), rows = [];
  people(list).forEach((ds, k) => {
    const row = Object.assign(rowWho(ds, k), {m: 0, l: 0, played: 0});
    days.forEach(d => { const f = firstOf(ds, d); if (f) { row.m += f.e.m; row.l = Math.max(row.l, f.e.l); row.played++; } });
    if (row.played) rows.push(row);
  });
  const cmp = (a, b) => b.m - a.m || b.l - a.l || a.played - b.played;
  return rank(rows.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name)), (a, b) => !cmp(a, b));
}
