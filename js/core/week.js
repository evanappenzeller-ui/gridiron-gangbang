// Week features core: Matchup of the Week votes (the league's fantasy matchups) and the NFL pick'em (the real
// NFL games of the week, from nfl.js). Week keys, lock times, Firestore subscriptions and writes (through the
// shared layer in fire.js), grading, standings and history.
// Pure logic + subscriptions, no DOM. Power rankings live in stats.js, not here.
// Owner: core (MOTW), PICKEM-CORE (NFL pick'em).
//
// Firestore:  motw/{weekKey}/votes/{uid}                 {pick: 'a|b', me, nick, at}
//             nflpicks/{weekKey}/picks/{uid}__{gameId}   {uid, game: '401872964', team: 'PIT', me, nick, at, kick}
// A MOTW game key is 'a|b' with the manager ids in schedule order. Played weeks leave the schedule and come back
// from the matchups, possibly in the other order, so keys are always matched as unordered pairs and reported
// in the week's current order (gamesOf).
// NFL picks are one doc per person per game, stamped with the server time when made (`at`) and the kickoff it was
// made for (`kick`; the rules refuse any change or delete after it): a pick counts only when its `at` is before
// that game's kickoff, others' picks for a game are revealed once ESPN shows it started (before that you only see
// your own, saved under your uid), a manager on two phones counts once per game (the latest doc), and a pick is
// right when its team won a final game (a tie, a postponed or canceled game grades as no pick).
//
// Dev hosts (fire.canWrite() false: no ?post=1, or a ?day= preview) never write to the real database: writes go
// to a local stand-in (localStorage 'gg-dev-week') that is merged into the live snapshot and emitted like a real
// change. Reads of the real database still happen. See __dev at the bottom for the test hooks.

import * as data from './data.js';
import * as motw from './motw.js';
import * as daily from './daily.js';
import * as fire from './fire.js';
import * as nfl from './nfl.js';

// Week 1 Thursday of each NFL season (lock = that Thursday's 8:15 PM US Eastern kickoff, then every 7 days;
// Thanksgiving and LOCK_AT below are the exceptions).
// Seasons not listed fall back to the Thursday after the first Monday of September.
export const KICKOFF = {2026: '2026-09-10'};

const SUB = {motw: 'votes', nflpicks: 'picks'};
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
// Matchup of the Week votes close at that week's first kickoff: Thursday 8:15 PM US Eastern, Thanksgiving
// 12:30 PM Eastern, or the LOCK_AT override. (NFL picks lock per game, at that game's own kickoff: gameLocked.)
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
// phone with a wrong clock that votes after the lock is ignored everywhere (tallies, leader, history). With no
// lock given (the crafted docs in the checks) nothing is filtered. NFL picks do the same per game (countNfl).
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
// NFL pick'em (pure). `games` are nfl.js games; `docs` are raw pick docs ({uid, game, team, me, nick, at}, plus
// the doc `id` when read from Firestore or the stand-in).

// The doc id of a pick: '{uid}__{gameId}' (the rules check it against the signed-in uid).
export const nflPickId = (uid, gameId) => `${uid}__${gameId}`;

// A game takes no picks or changes once it has kicked off (its kickoff time on this module's clock, so the dev
// clock applies, or ESPN already shows it started). The lock may use the phone's clock: a wrong clock can only
// lock early here, and the rules refuse late writes anyway (the `kick` field).
export function gameLocked(g, at = now()) { return nfl.gameStarted(g, toMs(at)); }
// Others' picks for a game are revealed once ESPN shows it started ('in' or 'post'), never on the phone's clock:
// a phone whose clock runs ahead must not see picks early. A game can be locked a minute or two before its picks
// show (ESPN flips the state at the real kickoff; the feed is polled every 30 s around kickoff).
export const gameRevealed = g => !!g && g.state !== 'pre';

// 'right' | 'wrong' | 'push' (a tie, or a game that ended without a result: graded as no pick) | 'pending'
// (not over yet) | null (no pick).
export function gradeNfl(g, team) {
  if (!g || !team) return null;
  if (g.state !== 'post') return 'pending';
  if (!g.final || !g.winner) return 'push';
  return g[g.winner].abbr === team ? 'right' : 'wrong';
}

// A raw doc -> {uid, game, team ('' = an empty pick: older builds wrote one to clear a pick; it counts as no
// pick), me, nick, at (ms), kick (ms, the kickoff the doc was saved against; null when absent, NaN when
// malformed)} or null (malformed, or its id does not match its uid and game).
function nflDoc(d) {
  if (!d || typeof d !== 'object') return null;
  const uid = typeof d.uid === 'string' ? d.uid : '';
  const game = typeof d.game === 'string' ? d.game : '';
  if (!uid || !/^[0-9]{1,12}$/.test(game) || typeof d.team !== 'string' || d.team.length > 4) return null;
  if (d.id != null && d.id !== nflPickId(uid, game)) return null;
  const kick = d.kick == null ? null : toMs(d.kick);
  return {uid, game, team: d.team.toUpperCase(), me: typeof d.me === 'string' && data.M[d.me] ? d.me : null,
    nick: typeof d.nick === 'string' ? d.nick.slice(0, 24) : '', at: toMs(d.at), kick: d.kick == null ? null : kick == null ? NaN : kick};
}

// Per game (in `games` order): {g, picks: [{uid, game, team, side, me, nick, at}] (the picks that count, oldest
// first: one per manager, the latest of their phones; nick-only players one per uid), own (the doc saved under
// `uid` itself, before that dedupe, or null)}. Dropped: docs for other games or teams, docs stamped at or after
// that game's kickoff (or not stamped), and docs saved against a later kickoff than ESPN's (`kick`: the rules lock
// a doc at its own `kick`, so a doc claiming a later one could still be changed after the game and never counts).
function countNfl(docs, games, uid) {
  const G = new Map((games || []).map(g => [g.id, g]));
  const per = new Map();
  (docs || []).forEach(raw => {
    const d = nflDoc(raw);
    const g = d && G.get(d.game);
    if (!g) return;
    const k = toMs(g.kickoff);
    if (d.at == null || !(d.at < k)) return;
    if (d.kick != null && !(d.kick <= k)) return;
    if (d.team && d.team !== g.home.abbr && d.team !== g.away.abbr) return;
    if (!per.has(g.id)) per.set(g.id, []);
    per.get(g.id).push(d);
  });
  return (games || []).map(g => {
    const all = per.get(g.id) || [];
    const own = (uid && all.find(v => v.uid === uid)) || null;
    const picks = onePerManager(all).filter(v => v.team).sort((x, y) => (x.at || 0) - (y.at || 0) || byUid(x, y))
      .map(v => pickOf(g, v));
    return {g, picks, own};
  });
}
const pickOf = (g, v, you = false) => ({uid: v.uid, game: g.id, team: v.team, side: v.team === g.home.abbr ? 'home' : 'away', me: v.me, nick: v.nick, at: v.at, you});

// The subscription's view of a week with the reveal rule applied: {picks (everyone's for games that have started,
// plus yours), mine: {gameId: team}, byGame: {gameId: {home, away, voters: {home: [pick], away: [pick]}, n,
// revealed, locked, mine: 'home'|'away'|null}}, count (your picks)}. Before a game starts (gameRevealed) its
// byGame entry only tells how many picks are in (n); home/away stay 0 and the voter lists empty.
// Yours: before the reveal, only the pick saved under your uid. "Which one are you?" is a claim anyone can make,
// so a doc under your manager from another uid could be someone else's pick and is never shown to you early.
// Once the game has started every pick is public, and your manager's pick that counts (the latest of your phones)
// is the one marked yours.
// opt.at: the clock for the locks (default now()); opt.me: your manager id.
export function tallyNfl(docs, games, uid, opt = {}) {
  const at = opt.at != null ? toMs(opt.at) : now();
  const my = opt.me && data.M[opt.me] ? opt.me : null;
  const picks = [], mine = {}, byGame = {};
  countNfl(docs, games, uid).forEach(({g, picks: list, own}) => {
    const locked = gameLocked(g, at), revealed = gameRevealed(g);
    const b = {home: 0, away: 0, voters: {home: [], away: []}, n: list.length, revealed, locked, mine: null};
    let m = null;
    if (revealed) {
      m = (uid && list.find(p => p.uid === uid)) || (my && list.find(p => p.me === my)) || null;
      list.forEach(p => {
        p.you = p === m;
        b[p.side]++; b.voters[p.side].push(p);
        picks.push(p);
      });
    } else if (own && own.team) {
      m = pickOf(g, own, true);
      picks.push(m);
    }
    if (m) { mine[g.id] = m.team; b.mine = m.side; }
    byGame[g.id] = b;
  });
  return {picks, mine, byGame, count: Object.keys(mine).length};
}

// Grades the counted picks into one row per person: a manager is one row across phones, nick-only players one
// row per uid. -> Map(key -> {uid (latest), uids, me, nick (latest), right, wrong, push, pending, picked})
function rowsOf(counted) {
  const rows = new Map();
  counted.forEach(({g, picks}) => picks.forEach(p => {
    const k = p.me ? 'm:' + p.me : 'u:' + p.uid;
    let r = rows.get(k);
    if (!r) rows.set(k, r = {uid: p.uid, uids: new Set(), me: p.me, nick: p.nick, _at: -Infinity, right: 0, wrong: 0, push: 0, pending: 0, picked: 0});
    r.uids.add(p.uid);
    if ((p.at || 0) >= r._at) { r._at = p.at || 0; r.uid = p.uid; r.nick = p.nick; }
    r.picked++;
    r[gradeNfl(g, p.team)]++;
  }));
  return rows;
}

const nameOf = (me, nick) => (me ? data.name(me) : String(nick || '').trim() || 'Someone');

// Rows -> ranked output rows. Ranked by right (desc), then fewer wrong; a rank is shared only when both are equal
// (the rule the Pick'em summary and the Wrap use for the leader). Then by name.
function finishRows(rows, uid, me, extra) {
  const my = me && data.M[me] ? me : null;
  const list = [...rows.values()].map(r => {
    const name = nameOf(r.me, r.nick);
    const decided = r.right + r.wrong;
    const o = {who: {uid: r.uid, me: r.me, nick: r.nick, name}, uid: r.uid, me: r.me, nick: r.nick, name,
      you: (!!uid && r.uids.has(uid)) || (!!my && r.me === my),
      right: r.right, wrong: r.wrong, decided, pushes: r.push, pending: r.pending, picked: r.picked, pct: decided ? r.right / decided : 0};
    return Object.assign(o, extra ? extra(r) : null);
  });
  list.sort((x, y) => y.right - x.right || x.wrong - y.wrong || x.name.localeCompare(y.name) || byUid(x, y));
  let rank = 0;
  list.forEach((r, i) => { if (!i || r.right !== list[i - 1].right || r.wrong !== list[i - 1].wrong) rank = i + 1; r.rank = rank; });
  return list;
}

// One week's table: [{who: {uid, me, nick, name}, uid, me, nick, name, you, right, wrong, decided (right +
// wrong), pushes (ties: no pick), pending (not over yet), picked (picks that count), pct, rank}], ranked.
export function nflRowsFrom(docs, games, uid, opt = {}) {
  return finishRows(rowsOf(countNfl(docs, games, uid)), uid, opt.me);
}

// Season table from weeks = [{year, week, games, docs}]: the same rows summed over the weeks, plus weeks (weeks
// with at least one pick that counts). Name and uid from the latest week.
export function nflStandingsFrom(weeks, uid, opt = {}) {
  const rows = new Map();
  (weeks || []).forEach(({year, week, games, docs}) => {
    rowsOf(countNfl(docs, games, uid)).forEach((w, k) => {
      let r = rows.get(k);
      if (!r) rows.set(k, r = {uid: w.uid, uids: new Set(), me: w.me, nick: w.nick, _o: -1, right: 0, wrong: 0, push: 0, pending: 0, picked: 0, weeks: 0});
      w.uids.forEach(u => r.uids.add(u));
      r.right += w.right; r.wrong += w.wrong; r.push += w.push; r.pending += w.pending; r.picked += w.picked;
      r.weeks++;
      const o = year * 100 + week;
      if (o >= r._o) { r._o = o; r.uid = w.uid; r.nick = w.nick; }
    });
  });
  return finishRows(rows, uid, opt.me, r => ({weeks: r.weeks}));
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
// Local stand-in (dev hosts): {motw: {weekKey: {uid: doc}}, nflpicks: {weekKey: {'{uid}__{gameId}': doc}}}

const STORE = 'gg-dev-week';
function readStore() {
  try { const o = JSON.parse(localStorage.getItem(STORE) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
}
function writeStore(o) {
  try { localStorage.setItem(STORE, JSON.stringify(o)); return true; } catch (_) { return false; }
}
// MOTW docs are keyed by uid; NFL picks by their doc id (uid__game) and carry uid in the body.
const idField = kind => (kind === 'motw' ? 'uid' : 'id');
function localDocs(kind, key) {
  if (!standIn()) return [];
  const m = readStore()[kind];
  const w = m && m[key];
  const f = idField(kind);
  return w && typeof w === 'object' ? Object.keys(w).filter(id => w[id] && typeof w[id] === 'object').map(id => Object.assign({}, w[id], {[f]: id})) : [];
}
function localPut(kind, key, id, body) {
  const o = readStore();
  const k = o[kind] && typeof o[kind] === 'object' ? o[kind] : (o[kind] = {});
  const w = k[key] && typeof k[key] === 'object' ? k[key] : (k[key] = {});
  if (body) w[id] = body; else delete w[id];
  if (!Object.keys(w).length) delete k[key];
  return writeStore(o);
}
// Remote docs with the stand-in's docs on top (same doc id: the local one wins).
function merge(remote, local, kind) {
  const f = idField(kind), m = new Map();
  (remote || []).forEach(d => m.set(d[f], d));
  (local || []).forEach(d => m.set(d[f], d));
  return [...m.values()];
}
const docOf = kind => d => Object.assign({}, d.data({serverTimestamps: 'estimate'}), {[idField(kind)]: d.id});

// ---------------------------------------------------------------------------
// Subscriptions

const live = new Map(); // 'kind:key' -> entry
const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, {timeout: 1500}) : setTimeout(fn, 200));

function subscribe(kind, key, fn) {
  const P = parseKey(key);
  if (!P || typeof fn !== 'function') {
    const bad = {key, error: 'failed', ready: true};
    if (typeof fn === 'function') queueMicrotask(() => { try { fn(Object.assign(kind === 'motw' ? {votes: [], mine: null, tally: {}, total: 0} : emptyNfl(), bad)); } catch (e) { console.error(e); } });
    return () => {};
  }
  const id = kind + ':' + key;
  let e = live.get(id);
  if (!e) {
    e = {id, kind, key, P, fns: new Set(), remote: [], remoteErr: null, ready: false, synced: false, stop: null, closed: false, timer: 0,
      board: null, boardReady: false, unwatch: null};
    live.set(id, e);
    idle(() => startRemote(e));
    if (kind === 'motw') armLockTimer(e);
    else e.unwatch = nfl.watch(P.year, P.week, b => { e.board = b; e.boardReady = true; armKickTimer(e); emitEntry(e); });
  }
  e.fns.add(fn);
  queueMicrotask(() => { if (e.fns.has(fn)) call(fn, payload(e)); });
  return () => {
    e.fns.delete(fn);
    if (e.fns.size || e.closed) return;
    e.closed = true;
    live.delete(id);
    clearTimeout(e.timer);
    if (e.unwatch) { try { e.unwatch(); } catch (_) {} e.unwatch = null; }
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
    // from the empty local cache, and a view that trusted it would show "nothing picked yet". Later cache-only
    // snapshots (going offline) keep the synced data.
    e.stop = F.fs.onSnapshot(F.fs.collection(F.db, e.kind, e.key, SUB[e.kind]), {includeMetadataChanges: true}, snap => {
      if (!(snap.metadata && snap.metadata.fromCache)) e.synced = true;
      e.remote = snap.docs.map(docOf(e.kind));
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
// NFL picks: re-emit at the next kickoff (that game locks and its picks are revealed), then the one after.
function armKickTimer(e) {
  clearTimeout(e.timer); e.timer = 0;
  const t = Date.now();
  const next = ((e.board && e.board.games) || []).map(g => toMs(g.kickoff)).filter(k => k > t).sort((a, b) => a - b)[0];
  if (next && next - t < 2 ** 31 - 1) e.timer = setTimeout(() => { emitEntry(e); armKickTimer(e); }, next - t + 250);
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
  const docs = merge(e.remote, localDocs(e.kind, e.key), e.kind);
  if (e.kind !== 'motw') return nflPayload(e, docs);
  const games = gamesOf(year, week);
  const base = {key: e.key, year, week, games, error: errorOf(e.remoteErr), remote: e.remoteErr, ready: e.ready, dev: standIn(), locked: isLocked(year, week)};
  return Object.assign(base, tallyVotes(docs, games, myUid(), {lock: lockMsOf(year, week), me: myMe()}));
}

function emptyNfl() {
  return {picks: [], mine: {}, byGame: {}, count: 0, rows: [], you: null, games: [], next: null, stale: false, scores: null};
}
function nflPayload(e, docs) {
  const {year, week} = e.P;
  const b = e.board;
  const games = b ? b.games : [];
  const at = now(), uid = myUid(), me = myMe();
  const t = tallyNfl(docs, games, uid, {at, me});
  const rows = nflRowsFrom(docs, games, uid, {me});
  return Object.assign(emptyNfl(), t, {
    key: e.key, year, week, games, rows, you: rows.find(r => r.you) || null,
    next: games.find(g => !gameLocked(g, at)) || null,
    error: errorOf(e.remoteErr), remote: e.remoteErr, ready: e.ready && e.boardReady, dev: standIn(),
    stale: !!(b && b.stale), scores: b && b.error ? b.error : null
  });
}

// Live votes for a week: fn({votes: [{uid, pick, me, nick, at}], mine, tally: {gameKey: count}, total, error,
// ready, dev, locked, games, key, year, week}). Called once soon after subscribing (from local state), then on
// every change. error: null | 'denied' (rules not deployed: "Voting isn't switched on yet.") | 'off' | 'failed'.
export function subscribeVotes(key, fn) { return subscribe('motw', key, fn); }

// Live NFL picks for a week: fn({
//   picks: [{uid, game, team, side: 'home'|'away', me, nick, at, you}]  the picks that count, oldest first, with
//          the reveal rule applied (everyone's for games that have kicked off, plus all of yours),
//   mine: {gameId: team}, count (your picks),
//   byGame: {gameId: {home: n, away: n, voters: {home: [pick], away: [pick]}, n (picks in), revealed, locked,
//            mine: 'home'|'away'|null}}  (before kickoff only n is filled in; home/away 0, voter lists empty),
//   rows: the week's table as nflWeekResults() rows, you: your row or null,
//   games: the week's nfl.js games (live: states, clocks and scores update through nfl.watch),
//   next: the next game still open for picks or null,
//   error: null | 'denied' | 'off' | 'failed' (the picks), stale: scores may be out of date, scores: 'offline'
//          when there are no scores at all (games is then []),
//   ready (picks synced and scores loaded), dev (the local stand-in), key, year, week
// }). Called once soon after subscribing, then on every change, at every kickoff, and on score changes.
export function subscribeNflPicks(year, week, fn) { return subscribe('nflpicks', weekKey(Number(year), Number(week)), fn); }

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

// The pick'em week: nfl.currentWeek() (ESPN's week, or the next one once every game in it is final) with its
// games: Promise<{year, week, key, games, stale, espnWeek, weeks}>. Rejects (err.code 'offline') only when there
// are no scores at all.
export async function pickemWeek() {
  const cw = await nfl.currentWeek();
  const b = await nfl.scoreboard(cw.year, cw.week);
  return Object.assign({}, b, {key: weekKey(b.year, b.week), espnWeek: cw.espnWeek, weeks: cw.weeks, stale: !!(b.stale || cw.stale)});
}

// The game and its week: from a live subscription's scores, then anything nfl.js already has, then the pick'em week.
async function findGame(gameId) {
  const id = String(gameId == null ? '' : gameId);
  if (!/^[0-9]{1,12}$/.test(id)) return null;
  for (const e of live.values()) {
    const g = e.kind === 'nflpicks' && e.board ? e.board.games.find(x => x.id === id) : null;
    if (g) return {year: e.P.year, week: e.P.week, game: g};
  }
  const hit = nfl.lookup(id);
  if (hit) return hit;
  try {
    const b = await pickemWeek();
    const g = b.games.find(x => x.id === id);
    return g ? {year: b.year, week: b.week, game: g} : null;
  } catch (_) { return null; }
}

// team: an abbreviation of the game's teams, or 'home' / 'away' -> the abbreviation, else null.
function teamFor(g, team) {
  const t = String(team == null ? '' : team);
  if (t === 'home' || t === 'away') return g[t].abbr;
  const u = t.toUpperCase();
  return u === g.home.abbr || u === g.away.abbr ? u : null;
}

// The pick doc saved under `uid` for a game, as the live subscription last saw it (null when not known).
function ownDoc(key, uid, game) {
  if (!uid) return null;
  const id = nflPickId(uid, game);
  const e = live.get('nflpicks:' + key);
  const docs = merge(e ? e.remote : [], localDocs('nflpicks', key), 'nflpicks');
  return docs.find(d => d && d.id === id) || null;
}
// The rules lock a doc at the kickoff it was saved with (`kick`): once that has passed, no change or delete. (It only
// differs from ESPN's kickoff when a game was moved after the pick was made.)
const kickPassed = (d, t) => !!d && d.kick != null && t >= toMs(d.kick);

// The `kick` saved on a pick doc. It must never be later than the real kickoff (readers drop docs that claim a
// later one), so a game without a set time (ESPN lists it at midnight Eastern on its Sunday: `tbd`) uses 36 hours
// before that placeholder, which covers a Saturday game; its pick then locks early unless it is re-made once ESPN
// sets the time.
const kickOf = g => toMs(g.kickoff) - (g.tbd ? 36 * 3600e3 : 0);

// Saves (team: an abbreviation) or deletes (team null) your pick doc. Every doc carries `kick`, the game's kickoff:
// the rules refuse a new doc after it and any change or delete of a doc after its own `kick`, so a pick can never
// be erased or changed once its game has started, whatever the phone's clock says.
async function writePick(f, team) {
  if (devFail) return devFail === 'denied' ? 'denied' : 'failed';
  const key = weekKey(f.year, f.week), game = f.game.id;
  const kick = kickOf(f.game);
  if (team != null && now() >= kick) return 'locked';
  if (standIn()) {
    const uid = myUid();
    if (kickPassed(ownDoc(key, uid, game), now())) return 'locked'; // what the rules would say
    const doc = team == null ? null : {uid, game, team, me: myMe(), nick: myNick(), at: now(), kick};
    if (!localPut('nflpicks', key, nflPickId(uid, game), doc)) return 'failed';
    cache.delete('nflpicks:' + key);
    notify('nflpicks', key);
    return 'dev';
  }
  let F;
  try { F = await fire.getFire(); } catch (_) { return 'failed'; }
  if (kickPassed(ownDoc(key, F.uid, game), Date.now())) return 'locked';
  const ref = F.fs.doc(F.db, 'nflpicks', key, SUB.nflpicks, nflPickId(F.uid, game));
  try {
    if (team == null) await F.fs.deleteDoc(ref);
    else await F.fs.setDoc(ref, {uid: F.uid, game, team, me: myMe(), nick: myNick(), at: F.fs.serverTimestamp(), kick: new Date(kick)});
    cache.delete('nflpicks:' + key);
    return 'ok';
  } catch (err) {
    if (fire.codeOf(err) !== 'denied') return 'failed';
    // Refused within a few minutes of kickoff: this phone's clock runs behind the server's and the game has started.
    return kick - Date.now() < 15 * 60e3 ? 'locked' : 'denied';
  }
}

// Pick a team to win one NFL game: team = its abbreviation ('PIT') or 'home' / 'away'. Saved at once (one doc per
// game, overwritten on a change). 'locked' once the game has kicked off; 'failed' for an unknown game or team.
export async function pickGame(gameId, team) {
  const f = await findGame(gameId);
  if (!f) return 'failed';
  if (gameLocked(f.game)) return 'locked';
  const abbr = teamFor(f.game, team);
  if (!abbr) return 'failed';
  return writePick(f, abbr);
}

// Remove your pick for a game (until its kickoff): deletes the doc saved from this phone (uid). Nothing else: a
// pick under your manager from another uid is left alone (from here it cannot be told apart from someone else
// claiming your name), and the latest of a manager's phones is the one that counts.
export async function clearPick(gameId) {
  const f = await findGame(gameId);
  if (!f) return 'failed';
  if (gameLocked(f.game)) return 'locked';
  return writePick(f, null);
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
          return {remote: snap.docs.map(docOf(kind)), error: null};
        } catch (err) { return {remote: [], error: fire.codeOf(err)}; }
      })();
      c = {t: Date.now(), p};
      cache.set(id, c);
    }
    r = await c.p;
    if (r.error && cache.get(id) === c) cache.delete(id);
  }
  return {docs: merge(r.remote, localDocs(kind, key), kind), remote: r.remote, error: errorOf(r.error), readError: r.error};
}

// NFL picks of a week the pick'em has moved past never change again: a game takes no picks after its kickoff, the
// rules refuse any change after a doc's `kick`, and the app only takes picks for the current week. Such a week is
// read once and kept in localStorage ('gg-nflpicks-2026-w4'), so a season table late in the season does not read
// every pick of every week (thousands of reads) on each open. `past` says whether the week is one of those.
const PK_LS = 'gg-nflpicks-';
const slimPick = d => ({id: d.id, uid: d.uid, game: d.game, team: d.team, me: d.me == null ? null : d.me, nick: d.nick,
  at: toMs(d.at), kick: d.kick == null ? null : (toMs(d.kick) != null ? toMs(d.kick) : 'bad')});
async function fetchPicks(y, w, past) {
  const key = weekKey(y, w);
  if (past) {
    let saved = null;
    try { const o = JSON.parse(localStorage.getItem(PK_LS + key) || 'null'); if (o && Array.isArray(o.docs)) saved = o.docs; } catch (_) { saved = null; }
    if (saved) return {docs: merge(saved, localDocs('nflpicks', key), 'nflpicks'), remote: saved, error: errorOf(null)};
  }
  const r = await fetchDocs('nflpicks', key);
  if (past && !r.readError) {
    try { localStorage.setItem(PK_LS + key, JSON.stringify({at: Date.now(), docs: r.remote.map(slimPick)})); } catch (_) {}
  }
  return r;
}
// Weeks of `year` the pick'em has moved past, given nfl.currentWeek() (nothing is "past" when it is unknown).
const pastWeek = (cw, year, w) => !!cw && (cw.year > year || (cw.year === year && w < cw.week));

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

// One NFL week's pick'em table: Promise<[{who: {uid, me, nick, name}, uid, me, nick, name, you, right, wrong,
// decided (right + wrong), pushes (tied games: no pick), pending (not over yet), picked (picks that count), pct,
// rank}]>, ranked by right, then fewer wrong (a rank is shared when both are equal). "Mitch went 12–4" = right–wrong. The array also carries
// .games (games that week), .decidedGames (final with a winner), .stale, and .error ('denied' | 'off' | 'failed'
// for the picks, 'scores' when the week's games could not be loaded: the array is then empty).
export async function nflWeekResults(year, week) {
  const y = Number(year), w = Number(week);
  const out = [];
  if (!Number.isInteger(y) || !Number.isInteger(w) || w < 1 || w > nfl.REG_WEEKS) { out.error = 'failed'; return out; }
  const cw = await nfl.currentWeek().catch(() => null);
  const [r, b] = await Promise.all([fetchPicks(y, w, pastWeek(cw, y, w)), nfl.scoreboard(y, w).catch(() => null)]);
  if (!b) { out.error = 'scores'; return out; }
  const rows = nflRowsFrom(r.docs, b.games, myUid(), {me: myMe()});
  rows.games = b.games.length;
  rows.decidedGames = b.games.filter(g => g.final && g.winner).length;
  rows.stale = b.stale;
  if (r.error) rows.error = r.error;
  return rows;
}

// The season's NFL pick'em table: Promise<[{...the nflWeekResults() row fields, weeks (weeks with a pick that
// counts)}]>, summed over weeks 1 to the pick'em week (every regular-season week for a past season), ranked like
// nflWeekResults(). Only weeks with picks fetch their scores (final weeks come from nfl.js's cache), and weeks the
// pick'em has moved past read their picks once (fetchPicks). The array carries .error like nflWeekResults()
// ('scores' when some week's games could not be loaded: those weeks are left out).
export async function nflStandings(year) {
  let cw = null;
  try { cw = await nfl.currentWeek(); } catch (_) { cw = null; }
  const y = year != null ? Number(year) : cw ? cw.year : yearOr(null);
  if (!Number.isInteger(y)) return [];
  if (cw && cw.year < y) return [];
  const last = cw && cw.year === y ? cw.week : nfl.REG_WEEKS;
  const weeks = [];
  for (let w = 1; w <= last; w++) weeks.push(w);
  const res = await Promise.all(weeks.map(w => fetchPicks(y, w, pastWeek(cw, y, w))));
  const need = weeks.filter((w, i) => res[i].docs.length);
  const boards = await Promise.all(need.map(w => nfl.scoreboard(y, w).catch(() => null)));
  const list = nflStandingsFrom(need.map((w, i) => (boards[i] ? {year: y, week: w, games: boards[i].games, docs: res[weeks.indexOf(w)].docs} : null)).filter(Boolean), myUid(), {me: myMe()});
  const err = res.find(r => r.error);
  if (err) list.error = err.error;
  else if (boards.some(b => !b)) list.error = 'scores';
  if (boards.some(b => b && b.stale)) list.stale = true;
  return list;
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
//                                                 (locks follow the clock; picks are revealed only when the game's
//                                                 ESPN state leaves 'pre': nfl.__dev.patch(2026, 4, {id: {state: 'in'}}))
//   week.__dev.as({uid: 'dev-fake-2', me: 'mason', nick: 'Mason'})  // act as another voter; null = yourself
//   await week.castVote('jaymin|jayton'); await week.pickGame('401872964', 'PIT'); await week.clearPick('401872964')
//   week.__dev.seed()                             // 8 fake voters on the current Matchup of the Week
//   await week.__dev.seedNfl(2026, 4)             // 8 fake NFL pickers on a week (default: the pick'em week)
//   week.__dev.fail('denied')                     // show the "isn't switched on yet" states; null clears
//   week.__dev.reset()                            // clear the stand-in
// Fake live scores and offline scores: nfl.__dev (js/core/nfl.js).
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
  // Fake voters (uids dev-fake-1..n, managers in id order) on the stand-in for a Matchup of the Week.
  seed(key, n = 8) {
    if (!standIn()) return false;
    const cur = current();
    const k = key || (cur && cur.key);
    const P = parseKey(k);
    if (!P) return false;
    const games = gamesOf(P.year, P.week);
    if (!games.length) return false;
    const o = readStore();
    o.motw = o.motw || {};
    const V = o.motw[k] = o.motw[k] || {};
    // Stamped before that week's kickoff (docs after it never count), on the injected clock.
    const t0 = Math.min(now(), lockMsOf(P.year, P.week) - 60e3) - n * 60e3;
    for (let i = 0; i < n; i++) {
      const uid = 'dev-fake-' + (i + 1), me = data.ids[i % data.ids.length] || null;
      V[uid] = {pick: games[[0, 1, 0, 2, 1, 0, 3, 2][i % 8] % games.length].key, me, nick: me ? data.name(me) : 'Fan ' + (i + 1), at: t0 + i * 60e3};
    }
    writeStore(o);
    cache.clear();
    emitAll();
    return {key: k, voters: n};
  },
  // Fake NFL pickers (uids dev-fake-1..n, managers in id order) on the stand-in: each picks most games of the week,
  // stamped before each game's kickoff (and before the injected clock).
  async seedNfl(year, week, n = 8) {
    if (!standIn()) return false;
    const b = year == null ? await pickemWeek() : await nfl.scoreboard(Number(year), Number(week));
    if (!b.games.length) return false;
    const k = weekKey(b.year, b.week);
    const o = readStore();
    o.nflpicks = o.nflpicks || {};
    const W = o.nflpicks[k] = o.nflpicks[k] || {};
    let made = 0;
    for (let i = 0; i < n; i++) {
      const uid = 'dev-fake-' + (i + 1), me = data.ids[i % data.ids.length] || null;
      const nick = me ? data.name(me) : 'Fan ' + (i + 1);
      b.games.forEach((g, j) => {
        if ((i + j) % 4 === 3) return;
        const at = Math.min(now(), toMs(g.kickoff)) - (n - i) * 60e3 - j * 1000;
        W[nflPickId(uid, g.id)] = {uid, game: g.id, team: (i * 5 + j * 3) % 3 ? g.home.abbr : g.away.abbr, me, nick, at, kick: kickOf(g)};
        made++;
      });
    }
    writeStore(o);
    cache.clear();
    emitAll();
    return {key: k, pickers: n, picks: made};
  },
  reset() {
    if (!DEV_OK) return false;
    try { localStorage.removeItem(STORE); } catch (_) {}
    cache.clear();
    emitAll();
    return true;
  }
};
