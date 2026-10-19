// Kick It core: the Daily Games' field-goal game, after Paper Toss. Each day everyone gets the same run of kicks: the
// posts stand somewhere new for every kick (a different distance and angle), the kicks get longer with every make (a
// chip shot till the first, then straight back to 30 and on toward 40: DIST), and the third miss ends it. The weather goes by how many you've made (the owner's ask, Oct 2026): calm air for the
// first three makes, then wind (a breeze till the fifth make, stronger with every make after it), and from the seventh
// make a brick wall in the goal's opening, standing on the crossbar against an upright. The line of scrimmage is 7
// yards out, a holder at the spot. A kick is a swipe of the ball: its line aims and its speed is the leg; it flies
// straight and rides the wind (no curving it: the swipe's shape doesn't matter). No DOM. Owner: KICK.
//
//   todayNumber(), dateOf(n), dayLabel(n)       day 1 on START, a new run at local midnight
//   kicks(n)                                    day n's kicks in calm air: [{i, dj (its distance's own yards either
//                                               way), gx (the posts' offset, yards, + right), w: 0, dir, obs: []}]
//   distFor(made, dj)                           yards to the posts with made kicks made (DIST)
//   kickFor(n, i, made)                         day n's kick i with made kicks made before it: the same plus d (yards
//                                               to the posts: distFor), w (wind,
//                                               mph), dir (its heading, degrees: 0 toward the posts, 90 to the right)
//                                               and obs (the wall, from the seventh make: [{t (OBSTACLES' key), x, z
//                                               (its middle, yards), half (half its width), y0 (its foot: the crossbar),
//                                               h (its top), face (+1 or -1: the upright it stands against)}])
//   nextKick(n, list)                           the kick after a run's kicks so far (list: dayState's)
//   WIND_FROM, WIND_GROWS, WALL_FROM            the makes the wind starts at, starts growing at, and the wall at
//   windCall(kick, launch, call)                what the wind did: 'took' (it would have been good in calm air),
//                                               'carried' (it went in only because of the wind), or null
//   launchOf({dx, dy, speed, aim})              a swipe on screen (px, px, px/ms; aim: where it points at the posts)
//                                               -> {theta, v}, or null (not a kick)
//   fly(kick, launch)                           the flight and the call: {made, why, d, tCross, at, pos(t), tEnd, hit
//                                               (the obstacle it hit, or null)}
//   dayState(n, real), record(n, kick, call), score(list), totals()   localStorage 'gg-kick1'
//   setTest(on, n), testing()                   test play (the owner's sandbox, below)
//   canReplay(), restart(n)                     unlimited tries for the owner, to test it: a new run of the day's
//                                               kicks; his first finished run stays the one on the scoreboard
//   autoPost(), boardRows(n), weekRows(n), weekDays(n), boardState()   the league scoreboard (below)
//
// THE RULE (CLAUDE.md): the scoreboard reads daily.LB.raw, the board as this phone may see it: league members and
// Ryan D for everyone; a guest (or Ryan S) only on their own phones.
import {lsGet, lsSet} from './ui.js';
import * as data from './data.js';
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
// The one thing in the way: a brick wall in the goal's opening, standing on the crossbar against one upright and up
// to the uprights' tops, closing off a quarter or half of the opening (a kick high enough clears it). half: half its
// width (set per kick); y0, h: its foot and its top (yards); says: the word for when it stops a kick.
export const OBSTACLES = {
  wall: {name: 'brick wall', half: 0, y0: 3.333, h: 10.333, says: 'Bricked off the wall', at: 'goal'}
};
// The line of scrimmage, 7 yards in front of the hold (a field goal's distance is that and 10 more to the posts): the
// blockers and the rush meet there, arms up. Only a kick far too soft to reach the posts anyway is low enough there to
// be blocked.
export const LINE = {z: 7, reach: 7.4, half: 6.5, h: 2.6, says: 'Blocked at the line'};
// The weather by makes: calm air till WIND_FROM made, then a breeze (4 to 8 mph); from WIND_GROWS made it picks up with
// every make (a mph and a half or so each, to WIND_MAX); from WALL_FROM made, the wall.
export const WIND_FROM = 3, WIND_GROWS = 5, WALL_FROM = 7, WIND_MAX = 26;
// The hash marks (yards from the middle of the field): high school's, 53 feet 4 inches apart (a third of the field),
// wider than the NFL's 18 feet 6 inches. The ball is spotted on a hash or between them, never outside (the owner's ask,
// Oct 2026).
export const HASH = 8.89;
// How far back the posts are, by makes (the owner's ask, Oct 2026: "jump from a 20 yarder to 30-40 quickly"): a chip
// shot till the first make; then 30, and DIST.step more a make to 39 by the fourth; then DIST.late more a make, to
// DIST.max. Each kick a couple of yards either way of that (dj).
export const DIST = {chip: 20, first: 30, step: 3, late: 1.5, max: 62};
export function distFor(made, dj = 0) {
  const at = made < 1 ? DIST.chip : DIST.first + DIST.step * Math.min(made - 1, 3) + DIST.late * Math.max(0, made - 4);
  return Math.round(clamp(at + dj, 18, DIST.max));
}
/** Day n's kicks, the same on every phone, in calm air. The first few near the middle; then the spot wanders out
 *  toward the hashes (out to them by kick 15, and from then a third of the kicks are right on one). gx: where the
 *  posts are from the ball, so the ball is gx from the middle of the field the other way, never more than HASH; dj:
 *  the kick's own yards either way of its distance. How far back, the wind and the wall come from how many you've
 *  made: kickFor(). */
const DAYS = new Map(); // day n -> its kicks (worked out once)
export function kicks(n) {
  if (DAYS.has(n)) return DAYS.get(n);
  const r = rng(hashStr(`kick-it-${n}`)), out = [];
  for (let i = 0; i < MAX_KICKS; i++) {
    const dj = Math.round((r() * 4 - 2) * 10) / 10;
    const span = Math.min(HASH, 2 + i * .5), u = r() * 2 - 1, onHash = i >= 14 && r() < 1 / 3;
    const gx = onHash ? (u < 0 ? -HASH : HASH) : Math.round(u * span * 100) / 100;
    if (i < 14) r();
    r(); // (what was each kick's own wind: kept, so a day's spots stay as they were)
    out.push({i, dj, gx, w: 0, dir: 0, obs: []});
  }
  if (DAYS.size > 40) DAYS.clear();
  DAYS.set(n, out);
  return out;
}
/** How strong the wind is with made kicks made: 0 till WIND_FROM; a breeze (4 to 8 mph, by f: 0-1) till WIND_GROWS;
 *  then 8 to 11 and about a mph and a half more a make, to WIND_MAX. */
export function windFor(made, f = .5) {
  if (made < WIND_FROM) return 0;
  if (made < WIND_GROWS) return Math.round(4 + 4 * f);
  return Math.round(Math.min(WIND_MAX, 8 + (made - WIND_GROWS) * 1.6 + 3 * f));
}
/** Day n's kick i with made kicks made before it: how far back (distFor), its wind (heading and strength: the same on
 *  every phone for the same kick and makes) and, from WALL_FROM made, the wall; never more wind than leaves it
 *  makeable (fair(): it comes down a mph at a time till it is). */
const FOR = new Map();
export function kickFor(n, i, made) {
  const base = kicks(n)[Math.max(0, Math.min(MAX_KICKS - 1, i))], key = `${n}|${base.i}|${made}`;
  if (FOR.has(key)) return FOR.get(key);
  const r = rng(hashStr(`kick-it-wind-${n}-${base.i}`)), ro = rng(hashStr(`kick-it-obs-${n}-${base.i}-${made >= WALL_FROM + 6 ? 2 : made >= WALL_FROM + 3 ? 1 : 0}`));
  const f = r(), dir = Math.round(r() * 360), d = distFor(made, base.dj);
  const k = Object.assign({}, base, {d, w: windFor(made, f), dir, made, obs: made >= WALL_FROM ? obstaclesFor(ro, made, d, base.gx) : []});
  while (k.w > 0 && !fair(k)) k.w--;
  if (FOR.size > 400) FOR.clear();
  FOR.set(key, k);
  return k;
}
/** The kick after a run's kicks so far (list: [[why, d], ...], dayState's). */
export const nextKick = (n, list) => kickFor(n, list.length, score(list).made);
/** A kick is fair when a good leg can put it through: an unbroken run of aims at least 2 degrees wide that go
 *  through, whatever's in the way and wherever the wind blows. */
function fair(k) {
  for (const v of [V_MAX * .95, V_MAX * .85, V_MAX * .75]) {
    let run = 0;
    for (let th = -1.05; th <= 1.05; th += .01) {
      if (fly(k, {theta: th, v}).made) { if (++run >= 5) return true; } else run = 0;
    }
  }
  return false;
}
function obstaclesFor(r, made, d, gx) {
  // in the opening, on the crossbar against one upright: a quarter of it at first, a quarter or half (a third of the
  // time) from three makes on, half (mostly) from six more
  const step = made - WALL_FROM;
  const share = step < 3 ? .25 : step >= 6 ? (r() < .65 ? .5 : .25) : (r() < .35 ? .5 : .25), k = r() < .5 ? -1 : 1;
  const inner = gx + k * (POST.half - share * POST.half * 2), outer = gx + k * POST.half;
  const r3 = v => Math.round(v * 1000) / 1000;
  return [{t: 'wall', x: r3((inner + outer) / 2), z: r3(d - .05), half: r3(Math.abs(outer - inner) / 2), y0: OBSTACLES.wall.y0, h: OBSTACLES.wall.h, face: k, share}];
}

// ---------------------------------------------------------------------------------------------- the kick
// The world in yards: x across (+ right), y up, z downfield from the tee. The posts stand on the plane z = d: uprights
// 18 ft 6 in apart (3.083 yards each side of the middle), the crossbar 10 ft up (3.333 yards), drawn 21 ft above it. The camera is third
// person: CAM.back behind the tee and about CAM.h up, looking downfield over the kicker and the holder (views/kick.js
// draws from there, raising or lowering it a little to fit the screen).
export const POST = {half: 3.083, bar: 3.333, top: 10.333};
export const CAM = {h: 6.5, back: 7.5};
export const GRAV = 9.2;                   // yards a second, a second (a touch floaty: slower, higher arcs)
const ELEV = 30 * Math.PI / 180;           // the ball's climb off the tee
const V_MIN = 13, V_MAX = 30;              // the leg, yards a second
// The wind is the big factor, and the ball rides it. Across the field it carries the ball, more and more the longer
// it's up (yards per mph: WIND_ACROSS.v a second plus WIND_ACROSS.a a second squared): it leaves the foot on its line
// and bends with the wind, so the flight curves (a kick aimed into the wind goes out and bends back). 7 mph across
// moves a 40-yarder about 7 yards (the posts are 6 wide), 15 mph about 14; halfway there it's moved under a third of
// that. Along the field it pushes (WIND_ALONG, yards a second a second per mph): a headwind costs carry, a tailwind
// adds it.
const WIND_ACROSS = {v: .08, a: .3}, WIND_ALONG = .36;
/** A flick (dx, dy: its travel on screen in px, up negative; speed: px a millisecond near its end) as a kick: theta, the
 *  aim (radians off straight downfield, + right), so that a flick at the posts on screen goes at the posts; v, the
 *  leg (yards a second), from the flick's speed. aim, from the screen (views/kick.js): the tangent of the line from the
 *  tee to where the flick's line crosses the crossbar's height on screen, at the posts' distance; without it, the
 *  flick's angle on screen read through the camera. Null for a flick that doesn't go up the screen. */
export function launchOf({dx, dy, speed, aim}) {
  if (!(dy < -24)) return null;
  const alpha = clamp(Math.atan2(dx, -dy), -1.3, 1.3);
  const theta = clamp(Number.isFinite(aim) ? Math.atan(aim) : Math.atan(Math.tan(alpha) * CAM.h / CAM.back), -1.1, 1.1);
  const v = clamp(13.6 + speed * 8.7, V_MIN, V_MAX);
  return {theta, v};
}
/** A kick's flight and its call. made; why: 'good', 'wide-l', 'wide-r', 'post' (off an upright), 'bar' (off the
 *  crossbar), 'short', 'blocked' (it hit something in the way: hit); d (the kick's distance); tCross (when it reaches
 *  the posts' plane, or null); at ({x, y} there, x from the posts' middle); pos(t) -> {x, y, z} (the world); tEnd
 *  (when to stop drawing it). */
export function fly(kick, launch) {
  const {d, gx, w, dir} = kick, {theta, v} = launch;
  const a = dir * Math.PI / 180, wx = w * Math.sin(a), az = WIND_ALONG * w * Math.cos(a);
  const vh = v * Math.cos(ELEV), vx = vh * Math.sin(theta), vz = vh * Math.cos(theta), vy = v * Math.sin(ELEV);
  const zAt = t => vz * t + .5 * az * t * t;
  // straight off the foot, and the wind's drift on top
  const free = t => ({x: vx * t + wx * (WIND_ACROSS.v * t + WIND_ACROSS.a * t * t), y: Math.max(0, vy * t - .5 * GRAV * t * t), z: zAt(t)});
  const tLand = 2 * vy / GRAV;
  // When it reaches the plane z = Z (going forward), if it does before it lands.
  const tAt = Z => {
    let t = null;
    if (Math.abs(az) < 1e-6) t = Z / vz;
    else { const disc = vz * vz + 2 * az * Z; if (disc >= 0) t = (-vz + Math.sqrt(disc)) / az; }
    return t != null && t > 0 && t <= tLand ? t : null;
  };
  // Something in the way: the first thing it reaches, if it's there and low enough (it always is) when it gets there.
  let hit = null, tHit = null;
  const line = {t: 'line', x: 0, z: LINE.reach, half: LINE.half, h: LINE.h, says: LINE.says};
  (kick.obs || []).concat([line]).sort((p, q) => p.z - q.z).forEach(o => {
    if (hit) return;
    const t = tAt(o.z);
    if (t == null) return;
    const p = free(t);
    if (Math.abs(p.x - o.x) < o.half + .15 && p.y >= (o.y0 || 0) && p.y < o.h) { hit = o; tHit = t; }
  });
  let tCross = tAt(d);
  if (hit) tCross = null;
  // Blocked: it smacks into it, pops back a little and drops.
  const pos = hit ? t => {
    if (t <= tHit) return free(t);
    const p = free(tHit), u = t - tHit;
    return {x: p.x + (p.x > hit.x ? 1 : -1) * u * 1.5, y: Math.max(0, p.y + 2 * u - .5 * GRAV * u * u), z: p.z - .4 - u * 3};
  } : free;
  let why = hit ? 'blocked' : 'short', at = null;
  if (tCross != null) {
    const p = pos(tCross), rel = p.x - gx, ar = Math.abs(rel);
    at = {x: rel, y: p.y};
    if (ar > POST.half + .1) why = rel < 0 ? 'wide-l' : 'wide-r';
    else if (ar > POST.half - .1) why = 'post';
    else if (p.y >= POST.bar) why = 'good';
    else if (p.y >= POST.bar - .25) why = 'bar';
    else why = 'short';
  }
  const tEnd = hit ? tHit + .9 : Math.min(tLand, tCross != null ? tCross + .9 : tLand);
  return {made: why === 'good', why, d, tCross, at, pos, tEnd, tLand, hit, tHit};
}
export const CALLS = {good: 'It’s good!', 'wide-l': 'Wide left', 'wide-r': 'Wide right', post: 'Off the upright', bar: 'Off the crossbar', short: 'Short', blocked: 'Blocked!'};
/** What the wind did to a kick: 'took' (a miss that would have been good in calm air), 'carried' (good only because of
 *  the wind), or null (it made no difference, or there was none). */
export function windCall(kick, launch, call) {
  if (!kick.w) return null;
  const calm = fly(Object.assign({}, kick, {w: 0}), launch);
  return calm.made === call.made ? null : call.made ? 'carried' : 'took';
}

// ---------------------------------------------------------------------------------------------- memory
// 'gg-kick1': {days: {n: {r: [[why, d], ...] (each kick taken), done, at, first: {r, at} (the first finished run, kept
// when a run's started over), tries}}, played}
const KEY = 'gg-kick1', KEEP = 60;
const WHYS = Object.keys(CALLS);
// Test play (the owner's: views/testplay.js): the day's game again in a sandbox, whenever he needs to test it. While
// it's on, play reads and writes a store of its own (KEY + '-test', the day started fresh each time), never posted and
// never counted; the posts, the resets and the all-time totals read the real one (real), and ending it brings the
// real day back as it was.
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
const cleanList = r => (Array.isArray(r) ? r.filter(x => Array.isArray(x) && WHYS.includes(x[0]) && Number.isFinite(x[1])).slice(0, MAX_KICKS) : []);
/** A run's numbers: made, missed, longest (yards, 0 with none), yards (all the made kicks'). */
export function score(list) {
  let made = 0, missed = 0, longest = 0, yards = 0;
  list.forEach(([why, d]) => { if (why === 'good') { made++; longest = Math.max(longest, d); yards += d; } else missed++; });
  return {made, missed, longest, yards};
}
const finished = d => { const list = cleanList(d && d.r); return !!(d && d.done) || score(list).missed >= STRIKES || list.length >= MAX_KICKS; };
/** Day n on this phone: {list ([why, d] per kick taken), done, at, next (the next kick's index), practice (a run started
 *  over: the first finished one is the official), tries, official (the run that counts: {list, at} plus score(list),
 *  or null till one's finished)} plus score(list). */
export function dayState(n, real) {
  const d = read(real).days[n] || {}, list = cleanList(d.r);
  return Object.assign({list, done: finished(d), at: Number(d.at) || 0, next: list.length, practice: !!d.first || (d.tries || 1) > 1,
    tries: Number.isInteger(d.tries) ? d.tries : 1, official: officialOf(d)}, score(list));
}
/** The run of a day's record that counts: the first finished ({list, at} plus score(list)), or null. */
export function officialOf(d) {
  if (!d) return null;
  if (d.first) { const list = cleanList(d.first.r); return Object.assign({list, at: Number(d.first.at) || 0}, score(list)); }
  if (!finished(d)) return null;
  const list = cleanList(d.r);
  return Object.assign({list, at: Number(d.at) || 0}, score(list));
}
/** A day's record started over: no kicks taken, the first finished run kept (if there was one). */
export function restartDay(d) {
  d = d || {};
  const first = d.first || (finished(d) ? {r: cleanList(d.r), at: Number(d.at) || Date.now()} : null);
  return Object.assign({r: [], tries: (Number.isInteger(d.tries) ? d.tries : 1) + 1}, first ? {first} : {});
}
// Unlimited tries, for testing: the owner may start the day's run over as often as he likes (his ask, Oct 2026). The
// first run he finishes is the one on the scoreboard; the rest are practice.
export const TESTERS = ['evan'];
export const canReplay = (id = data.me()) => !!id && TESTERS.includes(id);
/** Starts day n's run over (a tester only). Returns the day's state, or null. */
export function restart(n) {
  if (!canReplay()) return null;
  const v = read();
  v.days[n] = restartDay(v.days[n]);
  write(v);
  return dayState(n);
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
  const v = read(true);
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
  // the run that counts: the first finished (a tester's later tries are practice)
  days.forEach(n => { const s = dayState(n, true).official; out[n] = {m: s.made, l: s.longest, y: s.yards, k: s.list.length, t: s.at || Date.now()}; });
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
