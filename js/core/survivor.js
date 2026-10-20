// Survivor (the owner's ask, Oct 2026): every week, pick one NFL team to win its game. A team can be picked once a
// season. Your team loses (or ties), or you don't pick before the week's last game kicks off, and you're out; last one
// standing wins. If everyone still in loses the same week, nobody goes out (a missed week still does). Pure logic + the one
// write; no DOM. Its screen is views/survivor.js, the Pick'em tab's "Survivor".
//
// The weeks are the NFL pick'em's (nfl.currentWeek: a finished week's results stay up through Tuesday, the next
// week opens Wednesday 12:00 AM ET), from FIRST on: you're in if you picked in the first week. A pick can change
// until its game kicks off (then it's locked), to any team you haven't used whose game hasn't started.
// Picks ride on each phone's Daily board doc (players/{uid}, daily.js), like the League pick'em's:
//   sv1: {'2026': {'7': {k: 'PIT' (the team), g: '401872964' (ESPN's game id), t (ms, when saved)}}}
// The kickoff lock is the app's (a friends' league; the rules only let a phone write its own doc): this phone stops
// saving once that game has started, and a pick saved at or after its game's kickoff never counts, on any phone. A
// member on two phones counts once: their latest save that counts. Others' picks show once their game has kicked off.
// Every board read here is the board as this phone may see it (daily.LB.raw: THE RULE, CLAUDE.md).
import * as daily from './daily.js';
import * as nfl from './nfl.js';
import * as week from './week.js';

export const F = 'sv1';
/** The first Survivor week of each season. */
export const FIRST = {2026: 7};

const docs = list => list || daily.LB.raw || daily.LB.players || [];
const now = () => week.now();
const ms = t => (t instanceof Date ? t.getTime() : Number(t));

// ---------------------------------------------------------------------------------------------- games
/** A team's game in a week's board, as {g, side ('home'|'away')}, or null. */
export function gameOf(board, team) {
  const g = board && (board.games || []).find(x => x.home.abbr === team || x.away.abbr === team);
  return g ? {g, side: g.home.abbr === team ? 'home' : 'away'} : null;
}
const started = (g, at) => nfl.gameStarted(g, at);
/** A pick's result: 'W' (won), 'L' (lost), 'T' (tied: out too), 'C' (the game was canceled: you go on), or null (not
 *  over yet). */
export function resultOf(g, team) {
  if (!g) return null;
  if (g.state === 'post' && /CANCEL/.test(String(g.status || ''))) return 'C';
  if (!g.final) return null;
  if (!g.winner) return 'T';
  return g[g.winner].abbr === team ? 'W' : 'L';
}

// ---------------------------------------------------------------------------------------------- whose picks
/** A doc's saved pick for a week {k, g, t}, or null. */
export function entryOf(doc, year, wk) {
  const y = doc && doc[F] && typeof doc[F] === 'object' ? doc[F][year] : null;
  const e = y && typeof y === 'object' ? y[wk] : null;
  if (!e || typeof e.k !== 'string' || !/^[A-Z]{2,4}$/.test(e.k) || !/^[0-9]{1,12}$/.test(String(e.g || ''))) return null;
  return {k: e.k, g: String(e.g), t: Number(e.t) || 0};
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
/** A member's pick for a week from their docs: the latest save made before its game kicked off (a pick whose game
 *  isn't in the week's board doesn't count once the board is known). */
function pickOf(ds, year, wk, board) {
  let best = null;
  ds.forEach(d => {
    const e = entryOf(d, year, wk);
    if (!e) return;
    if (board) {
      const m = gameOf(board, e.k);
      if (!m || m.g.id !== e.g || e.t >= ms(m.g.kickoff)) return;
    }
    if (!best || e.t > best.t) best = e;
  });
  return best;
}

// ---------------------------------------------------------------------------------------------- the pool
/**
 * Everyone's season: boards = Map(week -> the week's board {games}) for FIRST through the current week (cur). ->
 * {rows: [{key, name, managerId, guest, you, alive, out (the week they went out, or null), why ('L' | 'T' | 'none'),
 * weeks (survived), picks: [{w, k, res ('W'|'L'|'T'|'C'|null), shown (whether this phone may see it yet)}], used
 * (Set of teams), pick (this week's {k, g} or null)}], alive (how many), entered, champion (key, or null), saved}
 * Rows ranked: in first (most weeks survived), then out by the week they went (latest first), then the name.
 */
export function pool(year, cur, boards, list, at = now()) {
  const first = FIRST[year];
  const rows = [];
  if (!first || cur < first) return {rows, alive: 0, entered: 0, champion: null};
  const ppl = people(docs(list));
  ppl.forEach((ds, k) => {
    const p0 = pickOf(ds, year, first, boards.get(first));
    if (!p0) return; // in from the first week only
    rows.push(Object.assign(who(ds, k), {ds, alive: true, out: null, why: null, weeks: 0, picks: [], used: new Set(), pick: null}));
  });
  for (let w = first; w <= cur; w++) {
    const board = boards.get(w);
    const allStarted = !!board && board.games.length > 0 && board.games.every(g => started(g, at) || /CANCEL/.test(String(g.status || '')));
    const goers = [];
    let decided = true;
    rows.filter(r => r.alive).forEach(r => {
      let e = pickOf(r.ds, year, w, board);
      if (e && r.used.has(e.k)) e = null; // a team used before doesn't count
      if (w === cur) r.pick = e ? {k: e.k, g: e.g} : null;
      if (!e) {
        if (allStarted) goers.push([r, 'none']); else decided = false;
        return;
      }
      const m = gameOf(board, e.k), res = m ? resultOf(m.g, e.k) : null;
      r.used.add(e.k);
      r.picks.push({w, k: e.k, res, shown: r.you || (!!m && started(m.g, at))});
      if (res === 'L' || res === 'T') goers.push([r, res]);
      else if (res === 'W' || res === 'C') r.weeks++;
      else decided = false;
    });
    const still = rows.filter(r => r.alive).length;
    // everyone still in lost (or tied) the same week: they all go on (a missed week is never saved)
    if (decided && goers.length && goers.length === still && goers.every(([, why]) => why !== 'none')) goers.forEach(([r]) => { r.weeks++; r.saved = w; });
    else goers.forEach(([r, why]) => { r.alive = false; r.out = w; r.why = why; });
  }
  rows.forEach(r => { delete r.ds; });
  rows.sort((x, y) => (y.alive - x.alive) || (x.alive ? y.weeks - x.weeks : (y.out || 0) - (x.out || 0)) || x.name.localeCompare(y.name));
  rows.forEach((r, i) => { const q = rows[i - 1]; r.rank = q && q.alive === r.alive && q.weeks === r.weeks && q.out === r.out ? q.rank : i + 1; });
  const alive = rows.filter(r => r.alive);
  return {rows, alive: alive.length, entered: rows.length, champion: rows.length > 1 && alive.length === 1 ? alive[0].key : null};
}
/** Your teams used so far this season (picks before the current week), from your docs. */
export function usedBy(year, cur, boards, list) {
  const k = myKey(), out = new Map();
  if (!k) return out;
  const ds = docs(list).filter(p => p.id === daily.LB.uid || daily.boardKey(p) === k);
  for (let w = FIRST[year] || cur; w < cur; w++) { const e = pickOf(ds, year, w, boards.get(w)); if (e) out.set(e.k, w); }
  return out;
}
/** Your pick for a week (the latest of your phones' saves), or null. */
export function mine(year, wk, list) {
  const k = myKey();
  if (!k) return null;
  let best = null;
  docs(list).filter(p => p.id === daily.LB.uid || daily.boardKey(p) === k).forEach(d => {
    const e = entryOf(d, year, wk);
    if (e && (!best || e.t > best.t)) best = e;
  });
  return best;
}

// ---------------------------------------------------------------------------------------------- picking
let saving = Promise.resolve();
/** Picks team (in game g of the week's board) for the week; team null takes it back. -> 'ok' | 'started' (that game
 *  or your current pick's has kicked off) | 'used' (a team you've picked before) | 'closed' (not a week you can pick
 *  in) | 'off' (no board to save to) | 'failed'. */
export function pick(year, wk, board, team, used = new Map()) {
  const run = async () => {
    const LB = daily.LB, at = now();
    if (wk < (FIRST[year] || Infinity)) return 'closed';
    const cur = mine(year, wk);
    if (cur) { const m = gameOf(board, cur.k); if (m && m.g.id === cur.g && started(m.g, at)) return 'started'; }
    let body;
    if (team) {
      const m = gameOf(board, team);
      if (!m) return 'closed';
      if (started(m.g, at)) return 'started';
      if (used.has(team)) return 'used';
      body = {k: team, g: m.g.id, t: Date.now()};
    } else body = null;
    if (!LB.merge || !LB.uid || LB.off) return 'off';
    const doc = {[F]: {[year]: {[wk]: body}}};
    const own = (LB.raw || []).find(d => d.id === LB.uid); // (your own row is always on the board you see)
    if (!own) Object.assign(doc, {nick: (daily.postName() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0});
    try { await LB.merge(doc); return 'ok'; } catch (_) { return 'failed'; }
  };
  saving = saving.then(run, run);
  return saving;
}

// ---------------------------------------------------------------------------------------------- loading
/** The week to pick ({year, week}: the NFL pick'em's) and every Survivor week's board so far: {year, cur, boards
 *  (Map week -> board), stale}. Rejects (code 'offline') only with no scores at all. */
export async function load() {
  const cw = await nfl.currentWeek();
  const year = cw.year, first = FIRST[year];
  const boards = new Map();
  if (!first || cw.week < first) {
    if (first) boards.set(first, await nfl.scoreboard(year, first).catch(() => null)); // the opening week, to look at
    return {year, cur: cw.week, boards, stale: !!cw.stale, before: true};
  }
  const weeks = [];
  for (let w = first; w <= cw.week; w++) weeks.push(w);
  const got = await Promise.all(weeks.map(w => nfl.scoreboard(year, w).catch(() => null)));
  weeks.forEach((w, i) => { if (got[i]) boards.set(w, got[i]); });
  return {year, cur: cw.week, boards, stale: !!cw.stale || got.some(b => !b || b.stale), before: false};
}
