// The League pick'em (the owner's ask, Oct 2026): pick the winner of each of the week's six fantasy matchups in the
// league itself. Pure logic + the one write; no DOM. Its screen is views/lpick.js, the Pick'em tab's "League".
//
// The week: the Matchup of the Week's (week.current(): the next unplayed week on the league's schedule, its games in
// schedule order), from FIRST on. Every pick locks at that week's first NFL kickoff (week.lockTime: Thursday 8:15 PM
// ET), when the fantasy points start. A pick is right when its manager won that matchup (data.GAMES, once the week's
// finals are in league.json), wrong when they lost; a tie is a push.
// Picks ride on each phone's Daily board doc (players/{uid}, daily.js), like the daily games' results:
//   lp1: {'2026-w7': {p: {'ben|evan': 'evan', ...}, t (ms, when last saved)}}
// keyed by the matchup's pair (pairKey: the two manager ids sorted), a null pick taken back. The lock is the app's,
// as for the Matchup of the Week vote and The Lay (a friends' league; the rules only let a phone write its own doc):
// this phone stops saving at the lock, and a week saved at or after it never counts, on any phone. A member on two
// phones counts once: the latest of their saves before the lock. Others' picks show once the week has locked.
// Every board read here is the board as this phone may see it (daily.LB.raw: THE RULE, CLAUDE.md).
import * as data from './data.js';
import * as daily from './daily.js';
import * as week from './week.js';

export const F = 'lp1';
/** The first League pick'em week of each season (weeks before it had no picks). */
export const FIRST = {2026: 7};

export const pairKey = (a, b) => [String(a), String(b)].sort().join('|');
const docs = list => list || daily.LB.raw || daily.LB.players || [];
const now = () => week.now();

/** The week to pick: {year, week, key, games: [{a, b, id}], lock (Date), locked}, or null (no schedule left, or the
 *  season's first League week hasn't come). */
export function current(at = now()) {
  const c = week.current(at);
  if (!c || c.week < (FIRST[c.year] || 1)) return null;
  return {year: c.year, week: c.week, key: c.key, lock: c.lock, locked: c.locked, games: c.games.map(g => ({a: g.a, b: g.b, id: pairKey(g.a, g.b)}))};
}
/** A week's matchups [{a, b, id}] (schedule order while unplayed, then as played). */
export const gamesOf = (year, wk) => week.gamesOf(year, wk).map(g => ({a: g.a, b: g.b, id: pairKey(g.a, g.b)}));
/** The weeks of a season the League pick'em has run: FIRST through the current one (or the last played). */
export function weeksOf(year, at = now()) {
  const c = current(at), first = FIRST[year];
  if (!first) return [];
  const played = data.GAMES.filter(g => g.year === year && g.reg).reduce((m, g) => Math.max(m, g.week), 0);
  const last = c && c.year === year ? c.week : played;
  const out = [];
  for (let w = first; w <= last; w++) out.push(w);
  return out;
}
/** A played matchup's result: {winner (manager id, null on a tie), sa, sb} in the order a, b; null before it's in. */
export function resultOf(year, wk, a, b) {
  const r = week.resultOf(year, wk, week.gameKey(a, b));
  return r ? {winner: r.winner, sa: r.sa, sb: r.sb} : null;
}

// ---------------------------------------------------------------------------------------------- whose picks
/** A doc's saved week {p: {pair: id}, t}, or null. */
export function entryOf(doc, key) {
  const v = doc && doc[F] && typeof doc[F] === 'object' ? doc[F][key] : null;
  if (!v || typeof v !== 'object' || !v.p || typeof v.p !== 'object') return null;
  const p = {};
  Object.entries(v.p).forEach(([k, id]) => { if (typeof id === 'string' && k.split('|').includes(id)) p[k] = id; });
  return {p, t: Number(v.t) || 0};
}
function people(list) {
  const m = new Map();
  list.forEach(p => { const k = daily.boardKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return m;
}
const myKey = () => (daily.LB.uid ? daily.boardKey({id: daily.LB.uid, nick: daily.LB.nick}) : null);
function who(ds, k) {
  const uid = daily.LB.uid, mk = myKey();
  const rep = ds.find(p => p.id === uid) || ds.slice().sort((a, b) => (b.last || 0) - (a.last || 0))[0];
  return {key: k, name: daily.displayName(rep), managerId: daily.keyManager(k), guest: daily.guestOf(rep), you: ds.some(p => p.id === uid) || (!!mk && k === mk)};
}
/** Each member's picks for a week: Map(board key -> {key, name, managerId, guest, you, p, t}). A save at or after
 *  the lock never counts; of a member's phones, the latest save before it does. */
export function picksOf(year, wk, list) {
  const key = week.weekKey(year, wk), lock = week.lockTime(year, wk).getTime(), out = new Map();
  people(docs(list)).forEach((ds, k) => {
    let best = null;
    ds.forEach(d => { const e = entryOf(d, key); if (e && e.t < lock && (!best || e.t > best.t)) best = e; });
    if (best) out.set(k, Object.assign(who(ds, k), best));
  });
  return out;
}
/** This phone's picks for a week ({pair: id}): yours across your phones (the latest save), {} for none. */
export function mine(year, wk, list) {
  const k = myKey(), key = week.weekKey(year, wk);
  if (!k) return {};
  let best = null;
  docs(list).filter(p => p.id === daily.LB.uid || daily.boardKey(p) === k).forEach(d => {
    const e = entryOf(d, key);
    if (e && (!best || e.t > best.t)) best = e;
  });
  return best ? best.p : {};
}

// ---------------------------------------------------------------------------------------------- picking
let saving = Promise.resolve();
/** Picks a side of a matchup (id null takes the pick back). -> 'ok' | 'locked' | 'off' (no board to save to: offline,
 *  or a preview) | 'failed'. Saves the whole week, so one save carries every pick (and its time). */
export function pick(year, wk, pair, id) {
  const run = async () => {
    const LB = daily.LB;
    if (week.isLocked(year, wk, now())) return 'locked';
    if (!LB.merge || !LB.uid || LB.off) return 'off';
    const p = Object.assign({}, mine(year, wk));
    if (id) p[pair] = id; else p[pair] = null;
    const body = {[F]: {[week.weekKey(year, wk)]: {p, t: Date.now()}}};
    const own = (LB.raw || []).find(d => d.id === LB.uid); // (your own row is always on the board you see)
    if (!own) Object.assign(body, {nick: (daily.postName() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0});
    try { await LB.merge(body); return 'ok'; } catch (_) { return 'failed'; }
  };
  saving = saving.then(run, run);
  return saving;
}

// ---------------------------------------------------------------------------------------------- grading
/** A pick graded: 'W' (right), 'L' (wrong), 'P' (push: a tie), or null (not played yet). */
export function grade(year, wk, g, id) {
  const r = resultOf(year, wk, g.a, g.b);
  if (!r) return null;
  return r.winner == null ? 'P' : r.winner === id ? 'W' : 'L';
}
// The rows: right first, then fewer wrong, then the name.
function rank(rows) {
  rows.sort((x, y) => y.right - x.right || x.wrong - y.wrong || x.name.localeCompare(y.name));
  rows.forEach((r, i) => { const q = rows[i - 1]; r.rank = q && q.right === r.right && q.wrong === r.wrong ? q.rank : i + 1; });
  return rows;
}
/** One week's table: [{key, name, managerId, guest, you, right, wrong, push, pending, picked, rank}], ranked. */
export function weekRows(year, wk, list) {
  const games = gamesOf(year, wk);
  const rows = [...picksOf(year, wk, list).values()].map(m => {
    const o = {key: m.key, name: m.name, managerId: m.managerId, guest: m.guest, you: m.you, right: 0, wrong: 0, push: 0, pending: 0, picked: 0};
    games.forEach(g => {
      const id = m.p[g.id];
      if (!id) return;
      o.picked++;
      const r = grade(year, wk, g, id);
      if (r === 'W') o.right++; else if (r === 'L') o.wrong++; else if (r === 'P') o.push++; else o.pending++;
    });
    return o;
  }).filter(o => o.picked);
  return rank(rows);
}
/** The season so far: the weeks summed, plus weeks (how many they picked in). */
export function seasonRows(year, list, at = now()) {
  const all = new Map();
  weeksOf(year, at).forEach(wk => weekRows(year, wk, list).forEach(r => {
    let o = all.get(r.key);
    if (!o) all.set(r.key, o = {key: r.key, name: r.name, managerId: r.managerId, guest: r.guest, you: r.you, right: 0, wrong: 0, push: 0, pending: 0, picked: 0, weeks: 0});
    ['right', 'wrong', 'push', 'pending', 'picked'].forEach(f => { o[f] += r[f]; });
    o.weeks++;
    o.name = r.name;
  }));
  return rank([...all.values()]);
}
/** How a matchup was picked, once the week has locked: {a: [names], b: [names]} (members' rows as this phone may see
 *  them), else null. */
export function splitOf(year, wk, g, list, at = now()) {
  if (!week.isLocked(year, wk, at)) return null;
  const out = {a: [], b: []};
  picksOf(year, wk, list).forEach(m => {
    const id = m.p[g.id];
    if (id === g.a) out.a.push(m); else if (id === g.b) out.b.push(m);
  });
  return out;
}
/** How many have picked every matchup of a week (and how many have picked any). */
export function countIn(year, wk, list) {
  const games = gamesOf(year, wk);
  let all = 0, any = 0;
  picksOf(year, wk, list).forEach(m => { const n = games.filter(g => m.p[g.id]).length; if (n) any++; if (n === games.length && n) all++; });
  return {all, any};
}
