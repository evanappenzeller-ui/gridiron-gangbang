// Survivor (the owner's ask, Oct 2026): every week, pick one NFL team to win its game. A team can be picked once a
// season. Your team loses (or ties), or you don't pick before the week locks, and you're out; last one standing wins.
// If everyone still in who picked loses the same week, they all stay in (a missed week still goes out). Pure logic +
// the one write; no DOM. Its screen is views/survivor.js, the Pick'em tab's "Survivor".
//
// The weeks are the NFL's, from FIRST on. Every league member (the season's teams) is in from the first week, so a
// member who doesn't pick by its lock goes out then (the owner's ask, Oct 2026); anyone else (Ryan D, a guest) is in
// if they picked in the first week. A week opens for picks as soon
// as the week before is over (every game final: Tuesday, after Monday night's game), not Wednesday as the NFL pick'em
// does (the owner's ask: picks open the day the last week ends). The week's picks lock at its first Sunday kickoff
// (lockOf; the owner's ask, Oct 24 2026: "available until the first Sunday kickoff", was Thursday night's game): until
// then a pick can change, to any team you haven't used, unless you've locked it in (the owner's ask, Oct 2026): a pick
// locked in is final for the week, on every phone. A game before Sunday's (Thursday night's, a Saturday's) locks at its
// own kickoff: its teams can't be picked once it's under way, and a pick on one is final once it kicks off.
// Picks ride on each phone's Daily board doc (players/{uid}, daily.js), like the League pick'em's:
//   sv1: {'2026': {'7': {k: 'PIT' (the team), g: '401872964' (ESPN's game id), t (ms, when saved), l: 1 (locked in)}}}
// The lock is the app's (a friends' league; the rules only let a phone write its own doc): this phone stops saving at
// the week's lock (or its game's kickoff, if sooner), and a pick saved at or after it never counts, on any phone. A member on two phones counts
// once: their latest save that counts (or the first they locked in, if they did: a later save on another phone that
// hadn't heard yet doesn't count). Others' picks show once the week has locked.
// Every board read here is the board as this phone may see it (daily.LB.raw: THE RULE, CLAUDE.md).
import * as data from './data.js';
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
let etDay = null;
/** Whether a kickoff (ms) falls on a Sunday, US Eastern time (the NFL's). */
function sunday(t) {
  try {
    etDay = etDay || new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', weekday: 'short'});
    return etDay.format(new Date(t)) === 'Sun';
  } catch (_) { return new Date(t - 4 * 36e5).getUTCDay() === 0; }
}
/** A week's lock: its first Sunday kickoff (Eastern; a game with no set time doesn't count), in ms; the first kickoff
 *  for a week with no Sunday game; null for a board with no games. */
export function lockOf(board) {
  const gs = (board && board.games) || [];
  const ks = gs.map(g => ms(g.kickoff)).filter(isFinite);
  if (!ks.length) return null;
  const sun = gs.filter(g => !g.tbd).map(g => ms(g.kickoff)).filter(t => isFinite(t) && sunday(t));
  return Math.min(...(sun.length ? sun : ks));
}
/** Whether a week's picks are locked at `at`: its lock has come (or ESPN already has a game from the lock on under
 *  way; a game before it, Thursday night's, doesn't lock the week). */
export function locked(board, at = now()) {
  if (!board || !(board.games || []).length) return false;
  const l = lockOf(board);
  return (l != null && ms(at) >= l) || board.games.some(g => g.state === 'in' && (l == null || ms(g.kickoff) >= l));
}
/** When a pick on game g stops counting: the week's lock, or the game's kickoff if that's sooner (a game before Sunday's). */
function cutoff(board, g) {
  const l = lockOf(board), k = ms(g.kickoff);
  return l == null ? k : isFinite(k) ? Math.min(l, k) : l;
}
/** Whether game g is shut for picks at `at`: the week has locked, or the game has kicked off. */
export function gameShut(board, g, at = now()) {
  return locked(board, at) || nfl.gameStarted(g, at);
}
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
/** A doc's saved pick for a week {k, g, t, l (locked in)}, or null. */
export function entryOf(doc, year, wk) {
  const y = doc && doc[F] && typeof doc[F] === 'object' ? doc[F][year] : null;
  const e = y && typeof y === 'object' ? y[wk] : null;
  if (!e || typeof e.k !== 'string' || !/^[A-Z]{2,4}$/.test(e.k) || !/^[0-9]{1,12}$/.test(String(e.g || ''))) return null;
  return {k: e.k, g: String(e.g), t: Number(e.t) || 0, l: e.l === 1 || e.l === true};
}
/** Which of two saves counts: the first one locked in, else the latest. */
const better = (e, best) => !best || (e.l ? !best.l || e.t < best.t : !best.l && e.t > best.t);
function people(list) {
  const m = new Map();
  list.forEach(p => { const k = daily.boardKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return m;
}
const myKey = () => (daily.LB.uid ? daily.boardKey({id: daily.LB.uid, nick: daily.LB.nick}) : null);
function who(ds, k) {
  const uid = daily.LB.uid, mk = myKey();
  if (!ds.length) return {key: k, name: data.name(k), managerId: k, guest: false, you: k === (mk || data.me())}; // a member with no board doc yet
  const rep = ds.find(p => p.id === uid) || ds.slice().sort((a, b) => (b.last || 0) - (a.last || 0))[0];
  return {key: k, name: daily.displayName(rep), managerId: daily.keyManager(k), guest: daily.guestOf(rep), you: ds.some(p => p.id === uid) || (!!mk && k === mk)};
}
/** A member's pick for a week from their docs: the latest save made before the week locked (or its game kicked off,
 *  if sooner), or the first locked in (a pick whose game isn't in the week's board doesn't count once the board is
 *  known). */
function pickOf(ds, year, wk, board) {
  let best = null;
  ds.forEach(d => {
    const e = entryOf(d, year, wk);
    if (!e) return;
    if (board) {
      const m = gameOf(board, e.k), cut = m ? cutoff(board, m.g) : null;
      if (!m || m.g.id !== e.g || (cut != null && isFinite(cut) && e.t >= cut)) return;
    }
    if (better(e, best)) best = e;
  });
  return best;
}

// ---------------------------------------------------------------------------------------------- the pool
/** The league's members for a season (manager ids): its teams, else every manager. */
export function membersOf(year) {
  const s = data.seasonByYear(year);
  const ids = s && Object.keys(s.teams || {}).length ? Object.keys(s.teams) : ((data.DATA && data.DATA.managers) || []).map(m => m.id);
  return ids.filter(id => data.M[id]);
}

/**
 * Everyone's season: boards = Map(week -> the week's board {games}) for FIRST through the current week (cur). ->
 * {rows: [{key, name, managerId, guest, you, alive, out (the week they went out, or null), why ('L' | 'T' | 'none'),
 * weeks (survived), picks: [{w, k, res ('W'|'L'|'T'|'C'|null), shown (whether this phone may see it yet), l (locked
 * in)}], used (Set of teams), pick (this week's {k, g, t, l} or null)}], alive (how many), entered, champion (key, or
 * null), saved}
 * Every member (members: manager ids, default the season's) is in from the first week, picked or not; anyone else
 * only if they picked in it.
 * Rows ranked: in first (most weeks survived), then out by the week they went (latest first), then the name.
 */
export function pool(year, cur, boards, list, at = now(), members = membersOf(year)) {
  const first = FIRST[year];
  const rows = [];
  if (!first || cur < first) return {rows, alive: 0, entered: 0, champion: null};
  const ppl = people(docs(list));
  members.forEach(k => { if (!ppl.has(k)) ppl.set(k, []); });
  ppl.forEach((ds, k) => {
    const p0 = pickOf(ds, year, first, boards.get(first));
    if (!p0 && !members.includes(k)) return; // a member is in from the first week; anyone else only with a pick in it
    rows.push(Object.assign(who(ds, k), {ds, alive: true, out: null, why: null, weeks: 0, picks: [], used: new Set(), pick: null}));
  });
  for (let w = first; w <= cur; w++) {
    const board = boards.get(w), shut = locked(board, at);
    const goers = [];
    let decided = true;
    rows.filter(r => r.alive).forEach(r => {
      let e = pickOf(r.ds, year, w, board);
      if (e && r.used.has(e.k)) e = null; // a team used before doesn't count
      if (w === cur) r.pick = e ? {k: e.k, g: e.g, t: e.t, l: e.l} : null;
      if (!e) {
        if (shut) goers.push([r, 'none']); else decided = false; // no pick by the lock: out
        return;
      }
      const m = gameOf(board, e.k), res = m ? resultOf(m.g, e.k) : null;
      r.used.add(e.k);
      r.picks.push({w, k: e.k, res, shown: r.you || shut, l: e.l});
      if (res === 'L' || res === 'T') goers.push([r, res]);
      else if (res === 'W' || res === 'C') r.weeks++;
      else decided = false;
    });
    const still = rows.filter(r => r.alive).length;
    // everyone still in who picked lost (or tied) the same week: they all go on; a missed week is never saved
    const all = decided && goers.length === still && goers.some(([, why]) => why !== 'none');
    goers.forEach(([r, why]) => {
      if (all && why !== 'none') { r.weeks++; r.saved = w; } else { r.alive = false; r.out = w; r.why = why; }
    });
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
/** Your pick for a week (the latest of your phones' saves, or the first locked in), or null. */
export function mine(year, wk, list) {
  const k = myKey();
  if (!k) return null;
  let best = null;
  docs(list).filter(p => p.id === daily.LB.uid || daily.boardKey(p) === k).forEach(d => {
    const e = entryOf(d, year, wk);
    if (e && better(e, best)) best = e;
  });
  return best;
}

// ---------------------------------------------------------------------------------------------- picking
let saving = Promise.resolve();
/** Picks team (in game g of the week's board) for the week; team null takes it back; fin locks it in (final for the
 *  week). -> 'ok' | 'locked' (the week's first Sunday game has kicked off) | 'started' (that team's game has kicked off)
 *  | 'final' (you've locked in your pick, or its game has kicked off) | 'used' (a team you've picked before) | 'closed'
 *  (not a week you can pick in) | 'off' (no board to save to) | 'failed'. */
export function pick(year, wk, board, team, used = new Map(), fin = false) {
  const run = async () => {
    const LB = daily.LB, at = now();
    if (wk < (FIRST[year] || Infinity)) return 'closed';
    if (locked(board, at)) return 'locked';
    let body;
    if (team) {
      const m = gameOf(board, team);
      if (!m) return 'closed';
      if (used.has(team)) return 'used';
      if (nfl.gameStarted(m.g, at)) return 'started';
      body = {k: team, g: m.g.id, t: Date.now()};
      if (fin) body.l = 1;
    } else if (fin) return 'closed';
    else body = null;
    const was = mine(year, wk);
    if (was && (was.l || kicked(board, was, at))) return 'final';
    if (!LB.merge || !LB.uid || LB.off) return 'off';
    const doc = {[F]: {[year]: {[wk]: body}}};
    const own = (LB.raw || []).find(d => d.id === LB.uid); // (your own row is always on the board you see)
    if (!own) Object.assign(doc, {nick: (daily.postName() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0});
    try { await LB.merge(doc); return 'ok'; } catch (_) { return 'failed'; }
  };
  saving = saving.then(run, run);
  return saving;
}
/** Whether a saved pick's game has kicked off (with the pick saved before it: final for the week). */
export function kicked(board, e, at = now()) {
  const m = e && gameOf(board, e.k);
  return !!m && m.g.id === e.g && nfl.gameStarted(m.g, at) && e.t < cutoff(board, m.g);
}
/** Locks in your saved pick for the week (pick's answers; 'closed' with no pick to lock in). */
export function lockIn(year, wk, board, used = new Map()) {
  const e = mine(year, wk);
  return e ? pick(year, wk, board, e.k, used, true) : Promise.resolve('closed');
}

// ---------------------------------------------------------------------------------------------- loading
/** The week to pick and every Survivor week's board so far: {year, cur, boards (Map week -> board), stale, before}.
 *  The week is the NFL pick'em's (nfl.currentWeek), or the one after it once every game of that one is over (the
 *  pick'em keeps a finished week up through Tuesday; Survivor's next week opens then). Rejects (code 'offline') only
 *  with no scores at all. */
export async function load() {
  const cw = await nfl.currentWeek();
  const year = cw.year, first = FIRST[year];
  let cur = cw.week;
  const wb = await nfl.scoreboard(year, cur).catch(() => null);
  if (wb && nfl.weekOver(wb.games) && cur < (cw.weeks || nfl.REG_WEEKS)) cur++;
  const boards = new Map();
  if (!first || cur < first) {
    if (first) boards.set(first, await nfl.scoreboard(year, first).catch(() => null)); // the opening week, to look at
    return {year, cur, boards, stale: !!cw.stale, before: true};
  }
  const weeks = [];
  for (let w = first; w <= cur; w++) weeks.push(w);
  const got = await Promise.all(weeks.map(w => (w === cw.week && wb ? wb : nfl.scoreboard(year, w).catch(() => null))));
  weeks.forEach((w, i) => { if (got[i]) boards.set(w, got[i]); });
  return {year, cur, boards, stale: !!cw.stale || got.some(b => !b || b.stale), before: false};
}
