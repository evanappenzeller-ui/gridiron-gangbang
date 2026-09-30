// Week features core: Matchup of the Week votes and the weekly pick'em. Week keys, lock times, Firestore
// subscriptions and writes (through the shared layer in fire.js), scoring, standings and history.
// Pure logic + subscriptions, no DOM. Power rankings live in stats.js, not here.
// Owner: core.
//
// Firestore:  motw/{weekKey}/votes/{uid}     {pick: 'a|b', me, nick, at}
//             pickem/{weekKey}/entries/{uid} {picks: {'a|b': winnerId, ...}, me, nick, at}
// A game key is 'a|b' with the manager ids in schedule order. Played weeks leave the schedule and come back
// from the matchups, possibly in the other order, so keys are always matched as unordered pairs and reported
// in the week's current order (gamesOf).
//
// Dev hosts (fire.canWrite() false: no ?post=1, or a ?day= preview) never write to the real database: writes go
// to a local stand-in (localStorage 'gg-dev-week') that is merged into the live snapshot and emitted like a real
// change. Reads of the real database still happen. See __dev at the bottom for the test hooks.

import * as data from './data.js';
import * as motw from './motw.js';
import * as daily from './daily.js';
import * as fire from './fire.js';

// Week 1 Thursday of each NFL season (lock = that Thursday's 8:15 PM US Eastern kickoff, then every 7 days;
// Thanksgiving and LOCK_AT below are the exceptions).
// Seasons not listed fall back to the Thursday after the first Monday of September.
export const KICKOFF = {2026: '2026-09-10'};

const SUB = {motw: 'votes', pickem: 'entries'};
const DAY_MS = 864e5;

// ---------------------------------------------------------------------------
// Keys

export const weekKey = (year, week) => `${year}-w${week}`;
export function parseKey(key) {
  const m = /^(\d{4})-w([1-9]\d?)$/.exec(String(key == null ? '' : key));
  return m ? {year: +m[1], week: +m[2]} : null;
}
export const gameKey = (a, b) => `${a}|${b}`;
function pairOf(k) {
  const p = String(k == null ? '' : k).split('|');
  return p.length === 2 && p[0] && p[1] && p[0] !== p[1] ? p : null;
}
const pairId = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
// Same two managers, in either order.
export function samePair(k1, k2) {
  const p = pairOf(k1), q = pairOf(k2);
  return !!p && !!q && pairId(p[0], p[1]) === pairId(q[0], q[1]);
}

// ---------------------------------------------------------------------------
// Clock (the local stand-in can inject one: __dev.setNow). Dev overrides (clock, identity, forced errors) only
// ever apply on a page that cannot write to the real database, so a stale injected clock can never reopen a
// locked week on a ?post=1 page.

const DEV_OK = !fire.canWrite();
let devNow = null;
if (DEV_OK) {
  try { const v = sessionStorage.getItem('gg-dev-now'); if (v && isFinite(+v)) devNow = +v; } catch (_) {}
}
export function now() { return devNow != null ? devNow : Date.now(); }
function toMs(t) {
  if (t == null) return null;
  if (typeof t === 'number') return isFinite(t) ? t : null;
  if (t instanceof Date) return t.getTime();
  if (typeof t.toMillis === 'function') { try { return t.toMillis(); } catch (_) { return null; } }
  if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}

// ---------------------------------------------------------------------------
// Lock times

const ymdOf = ms => { const d = new Date(ms); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
// Day of the month of the nth Sunday (month 1-12).
function nthSunday(year, month, n) {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + (7 - dow) % 7 + 7 * (n - 1);
}
// Hours from US Eastern wall time to UTC on that date's evening: EDT (4) from the second Sunday of March until
// the first Sunday of November, else EST (5).
function easternOffset(y, m, d) {
  const dst = (m > 3 && m < 11) || (m === 3 && d >= nthSunday(y, 3, 2)) || (m === 11 && d < nthSunday(y, 11, 1));
  return dst ? 4 : 5;
}
// 'YYYY-MM-DD' of the season's week 1 Thursday.
export function kickoff(year) {
  if (KICKOFF[year]) return KICKOFF[year];
  const dow = new Date(Date.UTC(year, 8, 1)).getUTCDay();
  const thu = 1 + (8 - dow) % 7 + 3; // first Monday of September + 3 days
  return `${year}-09-${String(thu).padStart(2, '0')}`;
}
// Weeks whose first NFL game is not the Thursday 8:15 PM ET kickoff: 'YYYY-wN' -> UTC ISO time of the first
// kickoff. Thanksgiving Thursday is handled below for every season; list anything else here (a Wednesday
// opener, an early international Thursday game).
export const LOCK_AT = {};
// Thanksgiving (the fourth Thursday of November): the first game kicks off around 12:30 PM ET.
const isThanksgiving = (y, m, d) => m === 11 && new Date(Date.UTC(y, 10, d)).getUTCDay() === 4 && d >= 22 && d <= 28;
// Votes and picks for a week close at that week's first kickoff: Thursday 8:15 PM US Eastern, Thanksgiving
// 12:30 PM Eastern, or the LOCK_AT override.
export function lockTime(year, week) {
  const o = LOCK_AT[weekKey(year, week)];
  if (o) { const t = Date.parse(o); if (isFinite(t)) return new Date(t); }
  const [ky, km, kd] = kickoff(year).split('-').map(Number);
  const [y, m, d] = ymdOf(Date.UTC(ky, km - 1, kd + 7 * (week - 1)));
  const [hh, mm] = isThanksgiving(y, m, d) ? [12, 30] : [20, 15];
  return new Date(Date.UTC(y, m - 1, d, hh + easternOffset(y, m, d), mm));
}
export function isLocked(year, week, at = now()) {
  return toMs(at) >= lockTime(year, week).getTime();
}
// The lock in the viewer's local time: 'Thu 5:15 PM' (with the date when it is more than 6 days away).
export function lockText(year, week, at = now()) {
  const lock = lockTime(year, week);
  const far = Math.abs(lock.getTime() - toMs(at)) > 6 * DAY_MS;
  const o = far ? {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'} : {weekday: 'short', hour: 'numeric', minute: '2-digit'};
  return lock.toLocaleString('en-US', o).replace(/[\s]+/g, ' '); // narrow no-break spaces from Intl -> plain spaces
}

// ---------------------------------------------------------------------------
// Weeks and games

const liveSeason = () => data.SEASONS.find(s => s.live) || null;

// The week's games [{a, b, key}]: the schedule while it is unplayed, else the played matchups.
export function gamesOf(year, week) {
  const raw = data.DATA && data.DATA.seasons ? data.DATA.seasons.find(s => s.year === year) : null;
  const sched = ((raw && raw.schedule) || []).filter(g => g.week === week && data.M[g.a] && data.M[g.b]);
  const src = sched.length ? sched : data.GAMES.filter(g => g.year === year && g.week === week);
  const seen = new Set(), out = [];
  src.forEach(g => {
    const id = pairId(g.a, g.b);
    if (g.a === g.b || seen.has(id)) return;
    seen.add(id);
    out.push({a: g.a, b: g.b, key: gameKey(g.a, g.b)});
  });
  return out;
}

// A played game of that week as {a, b, sa, sb, winner} in the order of `k` ('a|b'); winner null on a tie.
// null when the pair did not play that week (yet).
export function resultOf(year, week, k) {
  const p = pairOf(k);
  if (!p) return null;
  const id = pairId(p[0], p[1]);
  const g = data.GAMES.find(x => x.year === year && x.week === week && pairId(x.a, x.b) === id);
  if (!g) return null;
  const flip = g.a !== p[0];
  return {a: p[0], b: p[1], sa: flip ? g.sb : g.sa, sb: flip ? g.sa : g.sb, winner: g.tie ? null : g.win};
}

// The week the features are about: the next unplayed week on the live schedule (motw.upcoming()), or null.
// {year, week, key, games: [{a, b, key}], lock: Date, locked, played (last played week)}
export function current(at = now()) {
  let up = null;
  try { up = motw.upcoming(); } catch (_) { up = null; }
  if (!up) return null;
  const lock = lockTime(up.year, up.week);
  return {
    year: up.year, week: up.week, key: weekKey(up.year, up.week),
    games: up.games.map(g => ({a: g.a, b: g.b, key: gameKey(g.a, g.b)})),
    lock, locked: toMs(at) >= lock.getTime(), played: up.played
  };
}

// ---------------------------------------------------------------------------
// Matchup of the Week hype order, for any week, "as of" the Thursday it locked.
// The current week uses motw.candidates('overall') itself. Other weeks replay motw.js's overall score on the
// standings and series history entering that week (checks.js verifies the replay equals motw for the current
// week), so a tie at the top resolves the same way before and after the week is played.

const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
function tableAsOf(year, week) {
  const reg = data.GAMES.filter(g => g.year === year && g.reg && g.week < week);
  const rows = {};
  const row = id => rows[id] || (rows[id] = {id, w: 0, l: 0, t: 0, pf: 0, pa: 0});
  reg.forEach(g => {
    const A = row(g.a), B = row(g.b);
    A.pf += g.sa; A.pa += g.sb; B.pf += g.sb; B.pa += g.sa;
    if (g.tie) { A.t++; B.t++; }
    else if (g.win === g.a) { A.w++; B.l++; }
    else { B.w++; A.l++; }
  });
  const table = Object.values(rows).sort((x, y) => (y.w + y.t / 2) - (x.w + x.t / 2) || y.pf - x.pf);
  table.forEach((r, i) => { r.seed = i + 1; });
  return {table, played: Math.max(0, ...reg.map(g => g.week))};
}
function h2hAsOf(a, b, year, week) {
  const games = data.h2hC(a, b).games.filter(g => g.year < year || (g.year === year && g.week < week));
  let aw = 0, bw = 0;
  games.forEach(g => { if (g.my > g.their) aw++; else if (g.their > g.my) bw++; });
  let n = 0, who = null;
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i], w = g.my > g.their ? a : g.their > g.my ? b : null;
    if (!w) break;
    if (!who) who = w;
    if (w !== who) break;
    n++;
  }
  return {games, aw, bw, streak: {who, n}};
}
function standingIn(table, id) {
  const r = table.find(x => x.id === id);
  return r ? {rank: r.seed, w: r.w, l: r.l, t: r.t, pf: r.pf, gp: r.w + r.l + r.t} : {rank: null, w: 0, l: 0, t: 0, pf: 0, gp: 0};
}
// motw.js score() -> scores.overall, replayed (same terms, same order of operations).
function hypeAsOf(table, played, g, year, week) {
  const n = table.length || data.ids.length || 12;
  const A = standingIn(table, g.a), B = standingIn(table, g.b);
  let S = 0;
  if (A.rank && B.rank && played > 0) {
    const quality = clamp((2 * n + 1 - A.rank - B.rank) / (2 * n - 2));
    const near = clamp(1 - Math.abs(A.rank - B.rank) / (n - 1));
    const early = clamp(played / 4, .35, 1);
    S = 100 * (.65 * quality + .35 * near) * early;
    const top = [A.rank, B.rank].sort((x, y) => x - y);
    if (top[0] === 1 && top[1] === 2) S += 12;
    else if (top[1] <= 4) S += 6;
    if (A.gp >= 2 && B.gp >= 2 && !A.l && !A.t && !B.l && !B.t) S += 10;
    if (played >= 6 && top[0] >= 5 && top[1] <= 8) S += 8;
    const pfRank = id => table.slice().sort((x, y) => y.pf - x.pf).findIndex(x => x.id === id) + 1;
    if (pfRank(g.a) <= 3 && pfRank(g.b) <= 3) S += 6;
  }
  S = clamp(S, 0, 100);
  const h = h2hAsOf(g.a, g.b, year, week);
  const m = h.games.length;
  let H;
  if (!m) H = 35;
  else {
    const even = 1 - Math.abs(h.aw - h.bw) / m;
    const volume = clamp(m / 10);
    const margin = h.games.reduce((s, x) => s + Math.abs(x.my - x.their), 0) / m;
    const tight = clamp(1 - margin / 40);
    const playoffs = h.games.filter(x => x.playoff).length;
    const title = h.games.some(x => x.type === 'final');
    H = 100 * (.35 * even + .2 * volume + .2 * tight) + 12 * Math.min(playoffs, 2) + (title ? 10 : 0) + (h.streak.n >= 3 ? 8 : 0);
  }
  H = clamp(H, 0, 100);
  return .55 * S + .45 * H;
}
// Replayed scores for a week: [{key, a, b, overall}] in hype order (exported for the checks).
export function hypeReplay(year, week) {
  const games = gamesOf(year, week);
  const {table, played} = tableAsOf(year, week);
  return games.map(g => ({key: g.key, a: g.a, b: g.b, overall: hypeAsOf(table, played, g, year, week)}))
    .sort((x, y) => y.overall - x.overall);
}
// The week's game keys in Matchup of the Week hype order (highest first).
export function ranking(year, week) {
  const cur = current();
  if (cur && cur.year === year && cur.week === week) {
    let c = null;
    try { c = motw.candidates('overall'); } catch (_) { c = null; }
    if (c && c.list && c.list.length) return c.list.map(x => canonKey(cur.games, gameKey(x.a, x.b))).filter(Boolean);
  }
  return hypeReplay(year, week).map(x => x.key);
}
function canonKey(games, k) {
  const p = pairOf(k);
  if (!p) return null;
  const id = pairId(p[0], p[1]);
  const g = games.find(x => pairId(x.a, x.b) === id);
  return g ? g.key : null;
}
function rankingKeys(r) {
  const list = Array.isArray(r) ? r : r && Array.isArray(r.list) ? r.list : [];
  return list.map(x => (typeof x === 'string' ? x : x && x.key ? x.key : x && x.a && x.b ? gameKey(x.a, x.b) : null)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Votes (pure)

// Only what was written before kickoff counts. `at` is the server's time (rules pin it to request.time), so a
// phone with a wrong clock that votes or picks after the lock is ignored everywhere (tallies, leader, history,
// standings, week results). With no lock given (the crafted docs in the checks) nothing is filtered.
function inTime(d, lockMs) {
  if (lockMs == null) return true;
  const t = toMs(d && d.at);
  return t != null && t < lockMs;
}
const lockMsOf = (year, week) => lockTime(year, week).getTime();
const byUid = (x, y) => (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0);
// One doc per manager: Safari and the home-screen app (or a cleared phone) have different anonymous uids, but a
// manager counts once; their latest doc wins. Docs without a manager (nick only) stay one per uid.
function onePerManager(list) {
  const best = new Map(), out = [];
  list.forEach(x => {
    if (!x.me) { out.push(x); return; }
    const b = best.get(x.me);
    if (!b || (x.at || 0) > (b.at || 0) || ((x.at || 0) === (b.at || 0) && byUid(x, b) > 0)) best.set(x.me, x);
  });
  return out.concat([...best.values()]);
}
// Your own doc: the one under your uid, else your manager's doc from your other phone.
const mineOf = (list, uid, me) => (uid && list.find(v => v.uid === uid)) || (me && data.M[me] && list.find(v => v.me === me)) || null;

// Normalizes vote docs against the week's games: {votes (oldest first), mine (my vote or null), tally
// ({gameKey: count}, every game present), total}. Votes for games not in that week are dropped, and so are
// votes stamped after `opt.lock` (ms); a manager's votes from several phones count once (the latest).
// opt.me: your manager id (finds your vote made on another phone).
export function tallyVotes(docs, games, uid, opt = {}) {
  const idx = new Map((games || []).map(g => [pairId(g.a, g.b), g.key]));
  let votes = [];
  (docs || []).forEach(d => {
    if (!d || typeof d.pick !== 'string' || !inTime(d, opt.lock)) return;
    const p = pairOf(d.pick);
    const pick = idx.size ? (p ? idx.get(pairId(p[0], p[1])) : null) : (p ? d.pick : null);
    if (!pick) return;
    votes.push({uid: d.uid, pick, me: typeof d.me === 'string' && data.M[d.me] ? d.me : null, nick: typeof d.nick === 'string' ? d.nick : '', at: toMs(d.at)});
  });
  votes = onePerManager(votes);
  votes.sort((x, y) => (x.at || 0) - (y.at || 0) || byUid(x, y));
  const tally = {};
  (games || []).forEach(g => { tally[g.key] = 0; });
  votes.forEach(v => { tally[v.pick] = (tally[v.pick] || 0) + 1; });
  return {votes, mine: mineOf(votes, uid, opt.me), tally, total: votes.length};
}

// The game with the most votes; a tie goes to the one earlier in `ranking` (motw hype order: a list of keys,
// motw candidates, or motw.candidates()' result; default the current week's). null when nobody voted.
export function leader(tally, rank) {
  const keys = Object.keys(tally || {});
  let max = 0;
  keys.forEach(k => { if ((tally[k] || 0) > max) max = tally[k]; });
  if (!max) return null;
  const top = keys.filter(k => tally[k] === max);
  if (top.length === 1) return top[0];
  let order = rankingKeys(rank);
  if (rank === undefined) { const cur = current(); order = cur ? ranking(cur.year, cur.week) : []; }
  for (const r of order) { const hit = top.find(k => samePair(k, r)); if (hit) return hit; }
  return top.slice().sort()[0];
}

// ---------------------------------------------------------------------------
// Pick'em (pure)

// Normalizes entry docs: {entries: [{uid, picks: {gameKey: winnerId}, count, me, nick, at}] (oldest first),
// mine, counts: {gameKey: {teamId: n}}}. Picks for other games or non-playing winners are dropped, and so are
// entries stamped after `opt.lock`; a manager's entries from several phones count once (the latest).
export function tallyPicks(docs, games, uid, opt = {}) {
  const idx = new Map((games || []).map(g => [pairId(g.a, g.b), g.key]));
  let entries = [];
  (docs || []).forEach(d => {
    if (!d || !d.picks || typeof d.picks !== 'object' || !inTime(d, opt.lock)) return;
    const picks = {};
    Object.keys(d.picks).forEach(k => {
      const w = d.picks[k], p = pairOf(k);
      if (!p || (w !== p[0] && w !== p[1])) return;
      const key = idx.size ? idx.get(pairId(p[0], p[1])) : k;
      if (key && !(key in picks)) picks[key] = w;
    });
    const count = Object.keys(picks).length;
    if (!count) return;
    entries.push({uid: d.uid, picks, count, me: typeof d.me === 'string' && data.M[d.me] ? d.me : null, nick: typeof d.nick === 'string' ? d.nick : '', at: toMs(d.at)});
  });
  entries = onePerManager(entries);
  entries.sort((x, y) => (x.at || 0) - (y.at || 0) || byUid(x, y));
  const counts = {};
  (games || []).forEach(g => { counts[g.key] = {[g.a]: 0, [g.b]: 0}; });
  entries.forEach(e => Object.keys(e.picks).forEach(k => { if (counts[k]) counts[k][e.picks[k]]++; }));
  return {entries, mine: mineOf(entries, uid, opt.me), counts};
}

// Grades an entry ({picks}) against data.GAMES for that week: right = correct winners, graded = picked games
// that have been played. A tied game is not graded (nobody can pick a tie).
export function scoreWeek(entry, year, week) {
  let right = 0, graded = 0;
  const picks = entry && entry.picks;
  if (!picks || typeof picks !== 'object') return {right, graded};
  const played = data.GAMES.filter(g => g.year === year && g.week === week);
  const seen = new Set();
  Object.keys(picks).forEach(k => {
    const p = pairOf(k), w = picks[k];
    if (!p || (w !== p[0] && w !== p[1])) return;
    const id = pairId(p[0], p[1]);
    if (seen.has(id)) return;
    seen.add(id);
    const g = played.find(x => pairId(x.a, x.b) === id);
    if (!g || g.tie) return;
    graded++;
    if (g.win === w) right++;
  });
  return {right, graded};
}

// Ranks rows by right (desc); equal `right` shares a rank. Display order within a tie: fewer graded, then name.
function rankRows(list) {
  list.sort((x, y) => y.right - x.right || x.graded - y.graded || String(x.nick).localeCompare(String(y.nick)) || (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0));
  let rank = 0;
  list.forEach((r, i) => { if (!i || r.right !== list[i - 1].right) rank = i + 1; r.rank = rank; });
  return list;
}

// Decided (untied) games of a week: the denominator of "6 games, 1 point each" (a game you skipped is a miss).
export const decidedIn = (year, week) => data.GAMES.filter(g => g.year === year && g.week === week && !g.tie).length;

// Season table from raw entry docs per week: weeks = [{year, week, entries: [{uid, picks, me, nick, at}]}].
// -> [{uid, me, nick, right, graded, games, weeks, pct, rank, you}] (name and avatar from the latest week).
// graded = picked games that were played; games = every decided game of the weeks entered (pct = right / games).
// A manager is one row across phones (their latest entry each week); nick-only entries are one row per uid.
// opt.me: your manager id (your row when you picked on another phone).
export function standingsFrom(weeks, uid, opt = {}) {
  const rows = new Map();
  (weeks || []).forEach(({year, week, entries}) => {
    const list = onePerManager((entries || []).filter(e => e && e.uid).map(e => ({e, uid: e.uid, me: typeof e.me === 'string' && data.M[e.me] ? e.me : null, at: toMs(e.at)})));
    const games = decidedIn(year, week);
    list.forEach(({e, me}) => {
      const s = scoreWeek(e, year, week);
      if (!s.graded) return;
      const key = me ? 'm:' + me : 'u:' + e.uid;
      let r = rows.get(key);
      if (!r) rows.set(key, r = {uid: e.uid, uids: new Set(), me: null, nick: '', right: 0, graded: 0, games: 0, weeks: 0, _w: -1});
      r.uids.add(e.uid);
      r.right += s.right; r.graded += s.graded; r.games += Math.max(games, s.graded); r.weeks++;
      const order = year * 100 + week;
      if (order >= r._w) {
        r._w = order;
        r.uid = e.uid;
        r.me = me;
        r.nick = typeof e.nick === 'string' ? e.nick : '';
      }
    });
  });
  return rankRows([...rows.values()].map(r => ({uid: r.uid, me: r.me, nick: r.nick, right: r.right, graded: r.graded, games: r.games, weeks: r.weeks,
    pct: r.games ? r.right / r.games : 0, you: (!!uid && r.uids.has(uid)) || (!!opt.me && r.me === opt.me)})));
}

// ---------------------------------------------------------------------------
// Identity

let devAs = null;   // {uid, me?, nick?}: act as someone else on the local stand-in (never on a page that can write)
let devFail = null; // forced error code for the UI states (same)
const DEV_UID = 'dev-me';
if (DEV_OK) {
  try { const v = JSON.parse(sessionStorage.getItem('gg-dev-as') || 'null'); if (v && typeof v.uid === 'string') devAs = v; } catch (_) {}
}
const standIn = () => !fire.canWrite();
// The uid votes and picks are stored under: the anonymous uid (null until signed in); on the stand-in 'dev-me'
// (or the __dev.as identity).
export function myUid() { return standIn() ? (devAs && devAs.uid) || DEV_UID : fire.uid; }
function myMe() { return devAs && devAs.me !== undefined ? (data.M[devAs.me] ? devAs.me : null) : data.me(); }
function myNick() {
  let n = devAs && typeof devAs.nick === 'string' ? devAs.nick : daily.LB.nick;
  if (!n) { const m = myMe(); n = m ? data.name(m) : ''; }
  return String(n || '').trim().slice(0, 24);
}

// ---------------------------------------------------------------------------
// Local stand-in (dev hosts): {motw: {weekKey: {uid: doc}}, pickem: {weekKey: {uid: doc}}}

const STORE = 'gg-dev-week';
function readStore() {
  try { const o = JSON.parse(localStorage.getItem(STORE) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
}
function writeStore(o) {
  try { localStorage.setItem(STORE, JSON.stringify(o)); return true; } catch (_) { return false; }
}
function localDocs(kind, key) {
  if (!standIn()) return [];
  const m = readStore()[kind];
  const w = m && m[key];
  return w && typeof w === 'object' ? Object.keys(w).filter(uid => w[uid] && typeof w[uid] === 'object').map(uid => Object.assign({}, w[uid], {uid})) : [];
}
function localPut(kind, key, uid, body) {
  const o = readStore();
  const k = o[kind] && typeof o[kind] === 'object' ? o[kind] : (o[kind] = {});
  const w = k[key] && typeof k[key] === 'object' ? k[key] : (k[key] = {});
  if (body) w[uid] = body; else delete w[uid];
  if (!Object.keys(w).length) delete k[key];
  return writeStore(o);
}
// Remote docs with the stand-in's docs on top (same uid: the local one wins).
function merge(remote, local) {
  const m = new Map();
  (remote || []).forEach(d => m.set(d.uid, d));
  (local || []).forEach(d => m.set(d.uid, d));
  return [...m.values()];
}
const docOf = d => Object.assign({}, d.data({serverTimestamps: 'estimate'}), {uid: d.id});

// ---------------------------------------------------------------------------
// Subscriptions

const live = new Map(); // 'kind:key' -> entry
const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, {timeout: 1500}) : setTimeout(fn, 200));

function subscribe(kind, key, fn) {
  const P = parseKey(key);
  if (!P || typeof fn !== 'function') {
    const bad = {key, error: 'failed', ready: true};
    if (typeof fn === 'function') queueMicrotask(() => { try { fn(kind === 'motw' ? Object.assign({votes: [], mine: null, tally: {}, total: 0}, bad) : Object.assign({entries: [], mine: null, counts: {}}, bad)); } catch (e) { console.error(e); } });
    return () => {};
  }
  const id = kind + ':' + key;
  let e = live.get(id);
  if (!e) {
    e = {id, kind, key, P, fns: new Set(), remote: [], remoteErr: null, ready: false, synced: false, stop: null, closed: false, timer: 0};
    live.set(id, e);
    idle(() => startRemote(e));
    armLockTimer(e);
  }
  e.fns.add(fn);
  queueMicrotask(() => { if (e.fns.has(fn)) call(fn, payload(e)); });
  return () => {
    e.fns.delete(fn);
    if (e.fns.size || e.closed) return;
    e.closed = true;
    live.delete(id);
    clearTimeout(e.timer);
    if (e.stop) { try { e.stop(); } catch (_) {} e.stop = null; }
  };
}

async function startRemote(e) {
  if (e.closed || e.stop) return;
  let F;
  try { F = await fire.getFire(); } catch (err) {
    if (e.closed) return;
    e.remoteErr = 'off'; e.ready = true; emitEntry(e);
    return;
  }
  if (e.closed || e.stop) return;
  try {
    // ready only once the server has answered: the first snapshot offline (or before the server replies) comes
    // from the empty local cache, and a view that trusted it would show "nothing saved yet" and let a tap
    // overwrite the saved pick'em entry. Later cache-only snapshots (going offline) keep the synced data.
    e.stop = F.fs.onSnapshot(F.fs.collection(F.db, e.kind, e.key, SUB[e.kind]), {includeMetadataChanges: true}, snap => {
      if (!(snap.metadata && snap.metadata.fromCache)) e.synced = true;
      e.remote = snap.docs.map(docOf);
      e.remoteErr = null; e.ready = e.synced;
      cache.delete(e.id);
      emitEntry(e);
    }, err => {
      e.remoteErr = fire.codeOf(err); e.ready = true; e.stop = null;
      emitEntry(e);
    });
  } catch (err) {
    e.remoteErr = fire.codeOf(err); e.ready = true; emitEntry(e);
  }
}

// Re-emit when the week locks while someone is watching (real clock only).
function armLockTimer(e) {
  const ms = lockTime(e.P.year, e.P.week).getTime() - Date.now();
  if (ms > 0 && ms < 2 ** 31 - 1) e.timer = setTimeout(() => emitEntry(e), ms + 250);
}

function call(fn, p) { try { fn(p); } catch (err) { console.error(err); } }
function emitEntry(e) { if (e.closed) return; const p = payload(e); [...e.fns].forEach(fn => call(fn, p)); }
function emitAll() { [...live.values()].forEach(emitEntry); }
function notify(kind, key) { const e = live.get(kind + ':' + key); if (e) emitEntry(e); }

// The error a view should show: a forced dev error, else the remote one (the stand-in hides remote errors:
// its own writes work either way).
const errorOf = remoteErr => devFail || (standIn() ? null : remoteErr);

function payload(e) {
  const {year, week} = e.P;
  const games = gamesOf(year, week);
  const docs = merge(e.remote, localDocs(e.kind, e.key));
  const base = {key: e.key, year, week, games, error: errorOf(e.remoteErr), remote: e.remoteErr, ready: e.ready, dev: standIn(), locked: isLocked(year, week)};
  const opt = {lock: lockMsOf(year, week), me: myMe()};
  return Object.assign(base, e.kind === 'motw' ? tallyVotes(docs, games, myUid(), opt) : tallyPicks(docs, games, myUid(), opt));
}

// Live votes for a week: fn({votes: [{uid, pick, me, nick, at}], mine, tally: {gameKey: count}, total, error,
// ready, dev, locked, games, key, year, week}). Called once soon after subscribing (from local state), then on
// every change. error: null | 'denied' (rules not deployed: "Voting isn't switched on yet.") | 'off' | 'failed'.
export function subscribeVotes(key, fn) { return subscribe('motw', key, fn); }
// Live pick'em entries: fn({entries: [{uid, picks, count, me, nick, at}], mine, counts: {gameKey: {teamId: n}},
// error, ready, dev, locked, games, key, year, week}).
export function subscribePicks(key, fn) { return subscribe('pickem', key, fn); }

// ---------------------------------------------------------------------------
// Writes -> 'ok' | 'locked' | 'denied' | 'failed' | 'dev' (saved on the local stand-in)

async function write(kind, key, body) {
  if (devFail) return devFail === 'denied' ? 'denied' : 'failed';
  const doc = body ? Object.assign({}, body, {me: myMe(), nick: myNick()}) : null;
  if (standIn()) {
    // Stamped with the (possibly injected) clock, the stand-in's stand-in for the server time.
    if (!localPut(kind, key, myUid(), doc && Object.assign(doc, {at: now()}))) return 'failed';
    cache.delete(kind + ':' + key);
    notify(kind, key);
    return 'dev';
  }
  let F;
  try { F = await fire.getFire(); } catch (_) { return 'failed'; }
  const ref = F.fs.doc(F.db, kind, key, SUB[kind], F.uid);
  try {
    if (doc) await F.fs.setDoc(ref, Object.assign(doc, {at: F.fs.serverTimestamp()}));
    else await F.fs.deleteDoc(ref);
    cache.delete(kind + ':' + key);
    return 'ok';
  } catch (err) {
    return fire.codeOf(err) === 'denied' ? 'denied' : 'failed';
  }
}

// Vote for one of the current week's games (either key order is accepted). Changeable until the lock.
export async function castVote(k) {
  const cur = current();
  if (!cur || cur.locked) return 'locked';
  const g = cur.games.find(x => samePair(x.key, k));
  if (!g) return 'failed';
  return write('motw', cur.key, {pick: g.key});
}
export async function clearVote() {
  const cur = current();
  if (!cur || cur.locked) return 'locked';
  return write('motw', cur.key, null);
}
// Save the whole pick map for the current week: {gameKey: winnerId} (null values = no pick). An empty map
// removes the entry. Invalid games or winners are dropped ('failed' when nothing valid is left of a non-empty map).
export async function savePicks(map) {
  const cur = current();
  if (!cur || cur.locked) return 'locked';
  if (!map || typeof map !== 'object') return 'failed';
  const picks = {};
  let bad = 0;
  Object.keys(map).forEach(k => {
    const w = map[k];
    if (w == null || w === '') return;
    const g = cur.games.find(x => samePair(x.key, k));
    if (!g || (w !== g.a && w !== g.b)) { bad++; return; }
    picks[g.key] = w;
  });
  const n = Object.keys(picks).length;
  if (bad && !n) return 'failed';
  return write('pickem', cur.key, n ? {picks} : null);
}

// ---------------------------------------------------------------------------
// One-shot reads (history, standings, week results)

const cache = new Map(); // 'kind:key' -> {t, p}
const TTL = 5 * 60e3;
async function fetchDocs(kind, key) {
  const id = kind + ':' + key;
  const e = live.get(id);
  let r;
  if (e && e.ready && !e.remoteErr) r = {remote: e.remote, error: null};
  else {
    let c = cache.get(id);
    if (!c || Date.now() - c.t > TTL) {
      const p = (async () => {
        try {
          const F = await fire.getFire();
          const snap = await F.fs.getDocs(F.fs.collection(F.db, kind, key, SUB[kind]));
          return {remote: snap.docs.map(docOf), error: null};
        } catch (err) { return {remote: [], error: fire.codeOf(err)}; }
      })();
      c = {t: Date.now(), p};
      cache.set(id, c);
    }
    r = await c.p;
    if (r.error && cache.get(id) === c) cache.delete(id);
  }
  return {docs: merge(r.remote, localDocs(kind, key)), error: errorOf(r.error)};
}

const yearOr = y => (y != null ? Number(y) : (liveSeason() || {}).year);

// Every past week of the season with votes, newest first: [{year, week, key, pick, a, b, votes (for the pick),
// total, tally, voters, mine, result: {a, b, sa, sb, winner}|null}]. "Past" = before the current week (or every
// played week once the schedule is done). The array carries `.error` when a read failed.
export async function history(year) {
  const y = yearOr(year);
  if (!y) return [];
  const cur = current();
  const last = cur && cur.year === y ? cur.week - 1 : data.throughWeek(y);
  const weeks = [];
  for (let w = 1; w <= last; w++) weeks.push(w);
  const res = await Promise.all(weeks.map(w => fetchDocs('motw', weekKey(y, w))));
  const out = [];
  let error = null;
  res.forEach((r, i) => {
    if (r.error && !error) error = r.error;
    const w = weeks[i], games = gamesOf(y, w);
    const t = tallyVotes(r.docs, games, myUid(), {lock: lockMsOf(y, w), me: myMe()});
    if (!t.total) return;
    const pick = leader(t.tally, ranking(y, w));
    const [a, b] = pairOf(pick);
    out.push({year: y, week: w, key: weekKey(y, w), pick, a, b, votes: t.tally[pick], total: t.total, tally: t.tally, voters: t.votes, mine: t.mine, result: resultOf(y, w, pick)});
  });
  out.sort((x, z) => z.week - x.week);
  if (error) out.error = error;
  return out;
}

// Each manager's Matchup of the Week record from history(): {id: {w, l, t, n}} (n = picked games, played or not).
export function records(hist) {
  const r = {};
  const row = id => r[id] || (r[id] = {w: 0, l: 0, t: 0, n: 0});
  (hist || []).forEach(h => {
    if (!h || !h.a || !h.b) return;
    row(h.a).n++; row(h.b).n++;
    const x = h.result;
    if (!x) return;
    if (!x.winner) { row(h.a).t++; row(h.b).t++; return; }
    const lose = x.winner === h.a ? h.b : h.a;
    row(x.winner).w++; row(lose).l++;
  });
  return r;
}

// Season pick'em table over the played weeks: [{uid, me, nick, right, graded, weeks, pct, rank, you}], sorted,
// ties (equal right) share a rank. The array carries `.error` when a read failed.
export async function standings(year) {
  const y = yearOr(year);
  if (!y) return [];
  const last = data.throughWeek(y);
  const weeks = [];
  for (let w = 1; w <= last; w++) weeks.push(w);
  const res = await Promise.all(weeks.map(w => fetchDocs('pickem', weekKey(y, w))));
  const list = standingsFrom(weeks.map((w, i) => ({year: y, week: w, entries: res[i].docs.filter(d => inTime(d, lockMsOf(y, w)))})), myUid(), {me: myMe()});
  const err = res.find(r => r.error);
  if (err) list.error = err.error;
  return list;
}

// A finished (or partly played) week's pick'em: {key, year, week, games: [{a, b, key, result}], graded (games
// with a winner: the denominator for everyone, a skipped game is a miss), rows: [{uid, me, nick, picks, count,
// right, graded (picked games played), rank, you}], winners (rank-1 rows, only once something is graded and
// someone got one right), counts, error}. null for a bad key.
export async function weekResults(key) {
  const P = parseKey(key);
  if (!P) return null;
  const games = gamesOf(P.year, P.week).map(g => Object.assign(g, {result: resultOf(P.year, P.week, g.key)}));
  const {docs, error} = await fetchDocs('pickem', key);
  const uid = myUid();
  const t = tallyPicks(docs, games, uid, {lock: lockMsOf(P.year, P.week), me: myMe()});
  const mine = t.mine;
  const rows = rankRows(t.entries.map(e => {
    const s = scoreWeek(e, P.year, P.week);
    return {uid: e.uid, me: e.me, nick: e.nick, picks: e.picks, count: e.count, right: s.right, graded: s.graded, you: !!mine && e === mine};
  }));
  const graded = games.filter(g => g.result && g.result.winner).length;
  const winners = graded && rows.length && rows[0].right > 0 ? rows.filter(r => r.rank === 1) : [];
  return {key, year: P.year, week: P.week, games, graded, rows, winners, counts: t.counts, error};
}

// ---------------------------------------------------------------------------
// Refresh on new data, stand-in changes in another tab, and coming back online.

data.subscribe(type => { if (type === 'data') { cache.clear(); emitAll(); } });
try {
  addEventListener('storage', ev => { if (ev.key === STORE || ev.key === null) { cache.clear(); emitAll(); } });
  addEventListener('online', () => { [...live.values()].forEach(e => { if (e.remoteErr && !e.stop) { e.remoteErr = null; startRemote(e); } }); });
} catch (_) {}

// ---------------------------------------------------------------------------
// Dev hooks (only on a page that cannot write to the real database: a dev host without ?post=1, or a ?day=
// preview; they never touch the real database). From the console:
//   const week = await import('/js/core/week.js');
//   week.__dev.setNow('2026-10-02T00:16:00Z')   // inject a clock (kept for this tab); null restores the real one
//   week.__dev.as({uid: 'dev-fake-2', me: 'mason', nick: 'Mason'})  // act as another voter; null = yourself
//   await week.castVote('jaymin|jayton'); await week.savePicks({...})
//   week.__dev.seed()                             // 8 fake voters and pickers on the current week
//   week.__dev.fail('denied')                     // show the "isn't switched on yet" states; null clears
//   week.__dev.reset()                            // clear the stand-in
export const __dev = {
  standIn,
  store: () => readStore(),
  setNow(v) {
    if (!DEV_OK) return false;
    const ms = v == null ? null : toMs(typeof v === 'string' ? new Date(v) : v);
    devNow = ms != null && isFinite(ms) ? ms : null;
    try { if (devNow == null) sessionStorage.removeItem('gg-dev-now'); else sessionStorage.setItem('gg-dev-now', String(devNow)); } catch (_) {}
    emitAll();
    return devNow;
  },
  as(who) {
    if (!DEV_OK) return false;
    devAs = who == null ? null : typeof who === 'string' ? {uid: who} : (who && typeof who.uid === 'string' ? {uid: who.uid, me: who.me, nick: who.nick} : null);
    try { if (devAs) sessionStorage.setItem('gg-dev-as', JSON.stringify(devAs)); else sessionStorage.removeItem('gg-dev-as'); } catch (_) {}
    emitAll();
    return devAs;
  },
  fail(code) {
    if (!DEV_OK) return false;
    devFail = ['denied', 'off', 'failed'].includes(code) ? code : null;
    emitAll();
    return devFail;
  },
  // Fake voters and pickers (uids dev-fake-1..n, managers in id order) on the stand-in for a week.
  seed(key, n = 8) {
    if (!standIn()) return false;
    const cur = current();
    const k = key || (cur && cur.key);
    const P = parseKey(k);
    if (!P) return false;
    const games = gamesOf(P.year, P.week);
    if (!games.length) return false;
    const o = readStore();
    o.motw = o.motw || {}; o.pickem = o.pickem || {};
    const V = o.motw[k] = o.motw[k] || {}, E = o.pickem[k] = o.pickem[k] || {};
    // Stamped before that week's kickoff (docs after it never count), on the injected clock.
    const t0 = Math.min(now(), lockMsOf(P.year, P.week) - 60e3) - n * 60e3;
    for (let i = 0; i < n; i++) {
      const uid = 'dev-fake-' + (i + 1), me = data.ids[i % data.ids.length] || null;
      const base = {me, nick: me ? data.name(me) : 'Fan ' + (i + 1), at: t0 + i * 60e3};
      V[uid] = Object.assign({pick: games[[0, 1, 0, 2, 1, 0, 3, 2][i % 8] % games.length].key}, base);
      const picks = {};
      games.forEach((g, j) => { if ((i + j) % 5 !== 4) picks[g.key] = (i * 3 + j * 7) % 4 < 2 ? g.a : g.b; });
      E[uid] = Object.assign({picks}, base);
    }
    writeStore(o);
    cache.clear();
    emitAll();
    return {key: k, voters: n};
  },
  reset() {
    if (!DEV_OK) return false;
    try { localStorage.removeItem(STORE); } catch (_) {}
    cache.clear();
    emitAll();
    return true;
  }
};
