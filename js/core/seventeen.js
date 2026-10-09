// 17-0 core: the daily boards (data/seventeen.json, written by tools/seventeen/build.py from nflverse data), the
// season model, the perfect lineup, and what this phone remembers. No DOM. Owner: 17-0.
//
// One board a day, the same for everyone: board n is days[(n - 1) % days.length], board 1 on DOC.start, a new one at
// local midnight (like the daily puzzles). One season a day: the lineup is locked in when it is played.
//
//   load()                   -> Promise<doc> (memoized; a failed load can be retried)
//   todayNumber(), dateOf(n), board(n) (memoized), today()
//     A board: {id, n, date, budget, tiers, cols, cells (5 columns x 5 cards, $5 first), sched (17 opponents)}.
//   cost(b, pick)            dollars spent. A pick is five row indexes, one per column (QB, RB, WR1, WR2, TE), row 0
//                            the $5 player down to row 4 the $1 one, null for an empty slot.
//   card(b, col, row), full(pick), fits(b, pick), cleanPick(p), samePick(a, b)
//   ppg(b, pick)             team points per game: model.base + each pick's imp (his weighted value per game)
//   season(b, pick)          {w, l, ppg, pf, pa, games: [{wk, g (the opponent), home, us, them, win}]}
//   all(b)                   every legal lineup, best first: {list: [{ppg, cost, pick}], perfect (how many go 17-0)}
//   best(b), rankOf(b, pick) the perfect lineup; {rank, of, pct} of a lineup among the legal ones
//   dayState(n), keepPick(n, pick), lockIn(n, pick, season), totals()   localStorage 'gg-17'
//   shareText(b, season)     no player names: everyone plays the same board
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
      if (!d || !Array.isArray(d.days) || !d.days.length || !Array.isArray(d.cards) || !Array.isArray(d.teams) || !d.model || !/^\d{4}-\d\d-\d\d$/.test(d.start)) throw new Error('bad seventeen.json');
      DOC = d;
      return d;
    })
    .finally(() => { loading = null; });
  return loading;
}

// ---------------------------------------------------------------------------------------------- days
const startParts = () => DOC.start.split('-').map(Number);
/** Board number for a moment (local date): 1 on DOC.start, never below 1. */
export function todayNumber(t = new Date()) {
  const [y, m, d] = startParts();
  return 1 + Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}
/** Local midnight of board n's day. */
export function dateOf(n) {
  const [y, m, d] = startParts();
  return new Date(y, m - 1, d + n - 1);
}
const BOARDS = new Map();
export function board(n) {
  let b = BOARDS.get(n);
  if (b) return b;
  const row = DOC.days[(n - 1) % DOC.days.length];
  const cells = [0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => DOC.cards[row[c * 5 + r]]));
  const sched = row.slice(25).map((ti, i) => {
    const [f, y, tn, pf, pa, need, rec] = DOC.teams[ti];
    return {f, y, tn, pf, pa, need, rec, home: i % 2 === 0 ? 1 : 0};
  });
  b = {id: 'd' + n, n, date: dateOf(n), budget: DOC.budget, tiers: DOC.tiers, cols: DOC.cols, cells, sched};
  BOARDS.set(n, b);
  return b;
}
export const today = () => board(todayNumber());

// ---------------------------------------------------------------------------------------------- lineups
export const card = (b, c, r) => (b && b.cells[c] && b.cells[c][r]) || null;
export const empty = () => [null, null, null, null, null];
export const full = pick => Array.isArray(pick) && pick.length === 5 && pick.every(r => r != null);
export const cost = (b, pick) => pick.reduce((s, r) => s + (r == null ? 0 : b.tiers[r]), 0);
export const fits = (b, pick) => cost(b, pick) <= b.budget;
export const samePick = (a, b) => !!a && !!b && a.every((r, i) => r === b[i]);
/** A pick from storage: five rows 0-4 or null; anything else is null. */
export function cleanPick(p) {
  if (!Array.isArray(p) || p.length !== 5) return null;
  return p.map(r => (Number.isInteger(r) && r >= 0 && r <= 4 ? r : null));
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

// ---------------------------------------------------------------------------------------------- memory
// 'gg-17': {days: {n: {pick, w?, l?, ppg?}} (the last KEEP days), played, perfect (all-time counts)}.
const KEY = 'gg-17', KEEP = 60;
function read() {
  let v = null;
  try { v = JSON.parse(lsGet(KEY) || 'null'); } catch (_) { v = null; }
  if (!v || typeof v !== 'object' || !v.days || typeof v.days !== 'object') v = {days: {}, played: 0, perfect: 0};
  if (!Number.isInteger(v.played)) v.played = 0;
  if (!Number.isInteger(v.perfect)) v.perfect = 0;
  return v;
}
function write(v) {
  const keys = Object.keys(v.days).map(Number).filter(Number.isInteger).sort((a, b) => b - a);
  keys.slice(KEEP).forEach(k => { delete v.days[k]; });
  lsSet(KEY, JSON.stringify(v));
}
/** Board n on this phone: the picks so far, and the season once it was played (locked in). */
export function dayState(n) {
  const d = read().days[n] || {};
  const played = Number.isInteger(d.w) && Number.isInteger(d.l) ? {w: d.w, l: d.l, ppg: Number(d.ppg) || 0} : null;
  return {pick: cleanPick(d.pick) || empty(), played};
}
export function keepPick(n, pick) {
  const v = read();
  const d = v.days[n] || (v.days[n] = {});
  if (Number.isInteger(d.w)) return; // locked in
  d.pick = pick.slice();
  write(v);
}
/** The day's one season: locks the lineup and counts it. A second call for the same day changes nothing. */
export function lockIn(n, pick, s) {
  const v = read();
  const d = v.days[n] || (v.days[n] = {});
  if (Number.isInteger(d.w)) return false;
  Object.assign(d, {pick: pick.slice(), w: s.w, l: s.l, ppg: Math.round(s.ppg * 100) / 100});
  v.played += 1;
  if (s.w === 17) v.perfect += 1;
  write(v);
  return true;
}
/** All-time: seasons played and how many went 17-0. */
export function totals() {
  const v = read();
  return {played: v.played, perfect: v.perfect};
}

// ---------------------------------------------------------------------------------------------- text
export const rec = s => `${s.w}–${s.l}`;
export const dayLabel = (n, o = {month: 'short', day: 'numeric', weekday: 'short'}) => dateOf(n).toLocaleDateString('en-US', o);
/** The record, rank and a square per week. No player names: everyone plays the same board today. */
export function shareText(b, s, pick) {
  const r = rankOf(b, pick);
  const sq = s.games.map(g => (g.win ? '🟩' : '🟥'));
  return [
    `17–0 #${b.n} · ${dayLabel(b.n)}`,
    `${rec(s)}${s.w === 17 ? ' 🏆' : ''} · #${r.rank.toLocaleString('en-US')} of ${r.of.toLocaleString('en-US')} lineups`,
    sq.slice(0, 9).join(''),
    sq.slice(9).join(''),
    absLink('/puzzles/17-0')
  ].join('\n');
}
