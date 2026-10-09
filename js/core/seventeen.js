// 17-0 core: the boards (data/seventeen.json, written by tools/seventeen/build.py from nflverse data), the season
// model, the perfect lineup, and what this phone remembers per board. No DOM. Owner: 17-0.
//
//   load()                   -> Promise<doc> (memoized; a failed load can be retried)
//   boards(), board(id)      the loaded boards (or [] / null before load)
//   cost(b, pick)            dollars spent. A pick is five row indexes, one per column (QB, RB, WR1, WR2, TE), row 0
//                            the $5 player down to row 4 the $1 one, null for an empty slot.
//   card(b, col, row)        the player-season in that square
//   full(pick), fits(b, pick)
//   ppg(b, pick)             team points per game: model.base + each pick's imp (his weighted value per game)
//   season(b, pick)          {w, l, ppg, pf, pa, games: [{wk, g (the opponent), home, us, them, win}]}
//   all(b)                   every legal lineup, best first: {list: [{ppg, cost, pick}], perfect (how many go 17-0)}
//   best(b), rankOf(b, pick) the perfect lineup; {rank, of, pct (top pct)} of a lineup among the legal ones
//   saved(id), remember(id, pick, season)   localStorage 'gg-17-<id>': {pick, last: {w, l}, best: {w, l, ppg, pick},
//                            played, perfect}
//   shareText(b, pick, season)
//
// THE SEASON (the same rules as tools/seventeen/build.py; its docstring has the whole model): your defense is league
// average. Against an opponent you score ppg + g.pa (how much worse than average its defense was that season) and it
// scores g.pf (its points per game). A projected win is a win: ppg > g.need. Displayed scores are rounded; when
// rounding would tie a game or flip it, the winner's score rounds up and the loser's down (28-27).
import {lsGet, lsSet, absLink} from './ui.js';

const URL_ = new URL('../../data/seventeen.json', import.meta.url).href;
export let DOC = null;
let loading = null;

export function load() {
  if (DOC) return Promise.resolve(DOC);
  if (loading) return loading;
  loading = fetch(URL_, {cache: 'no-cache'})
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => {
      if (!d || !Array.isArray(d.boards) || !d.model) throw new Error('bad seventeen.json');
      DOC = d;
      return d;
    })
    .finally(() => { loading = null; });
  return loading;
}

export const boards = () => (DOC ? DOC.boards : []);
export const board = id => boards().find(b => b.id === id) || null;
export const card = (b, c, r) => (b && b.cells[c] && b.cells[c][r]) || null;
export const empty = () => [null, null, null, null, null];
export const full = pick => Array.isArray(pick) && pick.length === 5 && pick.every(r => r != null);
export const cost = (b, pick) => pick.reduce((s, r) => s + (r == null ? 0 : b.tiers[r]), 0);
export const fits = (b, pick) => cost(b, pick) <= b.budget;
/** A pick from storage or a link: five rows 0-4 or null; anything else is null. */
export function cleanPick(p) {
  if (!Array.isArray(p) || p.length !== 5) return null;
  const out = p.map(r => (Number.isInteger(r) && r >= 0 && r <= 4 ? r : null));
  return out;
}

export function ppg(b, pick) {
  let s = DOC.model.base;
  pick.forEach((r, c) => { if (r != null) s += b.cells[c][r].imp; });
  return s;
}

export function season(b, pick) {
  const p = ppg(b, pick);
  let w = 0, pf = 0, pa = 0;
  const games = b.sched.map((g, i) => {
    const win = p > g.need, x = p + g.pa, y = g.pf;
    let us = Math.round(x), them = Math.round(y);
    if (win && us <= them) { us = Math.ceil(x); them = Math.min(Math.floor(y), us - 1); }
    if (!win && them <= us) { them = Math.ceil(y); us = Math.min(Math.floor(x), them - 1); }
    if (win) w++;
    pf += us; pa += them;
    return {wk: i + 1, g, home: !!g.home, us, them, win};
  });
  return {w, l: games.length - w, ppg: p, pf, pa, games};
}

// Every legal lineup (5^5 picks, those within the budget), best first. Memoized per board.
const ALL = new WeakMap();
export function all(b) {
  let a = ALL.get(b);
  if (a) return a;
  const list = [];
  const pick = [0, 0, 0, 0, 0];
  for (let i = 0; i < 3125; i++) {
    let x = i;
    for (let c = 0; c < 5; c++) { pick[c] = x % 5; x = Math.floor(x / 5); }
    const cst = cost(b, pick);
    if (cst <= b.budget) list.push({ppg: ppg(b, pick), cost: cst, pick: pick.slice()});
  }
  // Ties (the same points) go to the cheaper lineup, then the earlier pick.
  list.sort((x, y) => y.ppg - x.ppg || x.cost - y.cost);
  const top = b.sched.reduce((m, g) => Math.max(m, g.need), -Infinity);
  a = {list, perfect: list.filter(x => x.ppg > top).length};
  ALL.set(b, a);
  return a;
}
export const best = b => all(b).list[0];
export function rankOf(b, pick) {
  const {list} = all(b), p = ppg(b, pick);
  const above = list.filter(x => x.ppg > p + 1e-9).length;
  return {rank: above + 1, of: list.length, pct: Math.max(1, Math.ceil(100 * (above + 1) / list.length))};
}
export const samePick = (a, b) => !!a && !!b && a.every((r, i) => r === b[i]);

// ---------------------------------------------------------------------------------------------- memory
const KEY = id => 'gg-17-' + id;
export function saved(id) {
  let v = null;
  try { v = JSON.parse(lsGet(KEY(id)) || 'null'); } catch (_) { v = null; }
  if (!v || typeof v !== 'object') v = {};
  return {
    pick: cleanPick(v.pick) || empty(),
    last: v.last && Number.isInteger(v.last.w) ? v.last : null,
    best: v.best && Number.isInteger(v.best.w) && cleanPick(v.best.pick) ? v.best : null,
    played: Number.isInteger(v.played) ? v.played : 0,
    perfect: !!v.perfect
  };
}
function write(id, v) { lsSet(KEY(id), JSON.stringify(v)); }
/** The picks on the board right now (kept between visits). */
export function keepPick(id, pick) {
  const v = saved(id);
  v.pick = pick;
  write(id, v);
}
/** A played season: last result, best record (more wins, then more points per game), seasons played, 17-0 seen. */
export function remember(id, pick, s) {
  const v = saved(id);
  v.pick = pick.slice();
  v.last = {w: s.w, l: s.l};
  v.played += 1;
  if (!v.best || s.w > v.best.w || (s.w === v.best.w && s.ppg > v.best.ppg + 1e-9)) v.best = {w: s.w, l: s.l, ppg: Math.round(s.ppg * 100) / 100, pick: pick.slice()};
  if (s.w === 17) v.perfect = true;
  write(id, v);
  return v;
}

// ---------------------------------------------------------------------------------------------- text
export const rec = s => `${s.w}–${s.l}`;
const yy = y => '’' + String(y).slice(2);
const last = n => n.replace(/^\S+\s+/, '');
export function shareText(b, pick, s) {
  const r = rankOf(b, pick);
  const lines = [`17–0 · ${b.name}`, `My $${b.budget} team went ${rec(s)}${s.w === 17 ? ' 🏆' : ''} (#${r.rank.toLocaleString('en-US')} of ${r.of.toLocaleString('en-US')} lineups)`];
  lines.push(pick.map((row, c) => { const p = b.cells[c][row]; return `${b.cols[c].replace(/\d$/, '')} ${last(p.s)} ${yy(p.y)}`; }).join(' · '));
  lines.push(absLink('/puzzles/17-0/' + b.id));
  return lines.join('\n');
}
