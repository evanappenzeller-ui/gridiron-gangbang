// Live league scores (Oct 30 2026, everyone's; the owner: "Can you insert live scores into the app?"): the week's
// matchups scored as the NFL games play. Each manager's starters are Yahoo's lineup (league.json seasons[].rosters:
// [name, position, NFL team, slot], synced by tools/yahoo; BN and IR sit), each scored from ESPN's box scores
// (core/gameday.js) in the league's scoring: Yahoo's standard PPR, kickers by distance, defenses by sacks, takeaways,
// touchdowns, safeties and points allowed. Unofficial: once the week's final comes in from Yahoo (the next sync),
// Matchup shows Yahoo's scores instead. No DOM. Owner: MATCHUP.
//
// Projected totals (Oct 30 2026, the owner: "Add total point projections"): Yahoo's projection for the team (league.json
// schedule pa/pb, synced with the lineups; Yahoo gives it for the team, not each player, and doesn't move it with the
// scores) shared among its starters by position and by how much each one scores (data/nfl-players.json, gameday.rankOf).
// Then a player whose game is over counts his points; one playing, his points and his share for the time left; one yet to
// play, his share; one on a bye, nothing. Before kickoff it is Yahoo's projection.
//
//   lineups(league, year, week) -> Map(manager -> [{name, pos, team, slot}]): the starters in Yahoo's order; null when
//                                 that season has no rosters with slots, or they're another week's (rosters.week)
//   teamScore(feed, lineup, yp) -> {pts, proj (the projected total; null without Yahoo's projection yp), left (yet to play
//                                 or playing), on (playing now), started, done, rows: [{name, pos, team, slot, pts,
//                                 state: 'pre'|'in'|'post'|'bye'|'out', game, line, p}]}
//                                 (feed: gameday.watch's update for the week: {games, boxes})
//   matchup(feed, ups, a, b, yp) -> {a, b (teamScores), started, over, on} or null (no lineup for a side);
//                                 yp: Yahoo's projections {a, b} or null
//   gameLeft(game)              -> how much of a game is still to play, 1 before kickoff to 0 once it's over
//   watch(year, week, fn)       -> stop; gameday.watch for that week (and again once the player list's ranks load)
import * as gd from './gameday.js';

const SIT = new Set(['BN', 'IR', 'IR+', 'NA', '']);
// Yahoo's team abbreviations that ESPN writes another way.
const ESPN = {WAS: 'WSH', JAC: 'JAX', LA: 'LAR'};
const espnOf = t => { const u = String(t || '').toUpperCase(); return ESPN[u] || u; };

export function lineups(league, year, week) {
  const season = league && Array.isArray(league.seasons) ? league.seasons.find(s => s && s.year === year) : null;
  const ro = season && season.rosters;
  if (!ro || !ro.teams || typeof ro.teams !== 'object') return null;
  if (ro.week != null && week != null && +ro.week !== +week) return null;
  const out = new Map();
  Object.entries(ro.teams).forEach(([mgr, ps]) => {
    const list = (Array.isArray(ps) ? ps : []).filter(p => Array.isArray(p) && p[0] && p.length >= 4 && !SIT.has(String(p[3] || '').toUpperCase()))
      .map(([name, pos, team, slot]) => ({name: String(name), pos: String(pos || ''), team: espnOf(team), slot: String(slot)}));
    if (list.length) out.set(mgr, list);
  });
  return out.size ? out : null;
}

const r2 = n => Math.round(n * 100) / 100;
const gameFor = (feed, team) => (feed && Array.isArray(feed.games) ? feed.games : []).find(g => g.home.abbr === team || g.away.abbr === team) || null;
function find(list, name, team) {
  const k = gd.norm(name);
  const same = (list || []).filter(x => x.key === k);
  return same.find(x => x.team === team) || (same.length === 1 ? same[0] : null);
}
function defLine(d, allowed) {
  const out = [];
  if (d.sacks) out.push(`${d.sacks} sack${d.sacks === 1 ? '' : 's'}`);
  if (d.int) out.push(`${d.int} INT`);
  if (d.fr) out.push(`${d.fr} FR`);
  if (d.td) out.push(`${d.td} TD`);
  if (d.sfty) out.push(`${d.sfty} safety`);
  out.push(`${allowed} pts allowed`);
  return out.join(' · ');
}
function kLine(k) {
  const fg = k.fg.filter(Boolean);
  const out = [];
  if (k.fgAtt) out.push(`FG ${k.fg.length}/${k.fgAtt}${fg.length ? ` (${fg.join(', ')})` : ''}`);
  if (k.xpAtt) out.push(`XP ${k.xp}/${k.xpAtt}`);
  return out.join(' · ');
}

function rowOf(feed, p) {
  const g = gameFor(feed, p.team);
  const row = Object.assign({}, p, {pts: 0, state: 'bye', game: g, line: '', p: null});
  if (!g) return row;
  if (g.state === 'pre') return Object.assign(row, {state: 'pre'});
  row.state = g.state === 'in' ? 'in' : 'post';
  const box = feed.boxes && feed.boxes.get(g.id);
  if (!box) return row;
  if (p.pos === 'DEF') {
    const d = box.defs && box.defs[p.team];
    const allowed = Number(g.home.abbr === p.team ? g.away.score : g.home.score) || 0;
    if (d) Object.assign(row, {pts: gd.defPoints(d, allowed), line: defLine(d, allowed)});
  } else if (p.pos === 'K') {
    const k = find(box.kickers, p.name, p.team);
    if (k) Object.assign(row, {pts: k.pts, line: kLine(k), p: k});
  } else {
    const x = find(box.players, p.name, p.team);
    if (x) Object.assign(row, {pts: x.pts, line: gd.statLine(x), p: x});
  }
  return row;
}

export function gameLeft(g) {
  if (!g || g.state === 'post') return 0;
  if (g.state !== 'in') return 1;
  if (/half/i.test(g.detail || '')) return .5;
  const q = Number(g.period) || 0;
  if (!q) return 1;
  if (q > 4) return 0;
  const m = /^(\d+):(\d+)/.exec(g.clock || '');
  const min = m ? Math.min(15, +m[1] + +m[2] / 60) : 7.5;
  return Math.max(0, Math.min(1, ((4 - q) * 15 + min) / 60));
}
// A starter's share of his team's projection, before it's scaled to Yahoo's total: a starter's points at his position,
// more or less by how much he scores (between 0.6 and 1.4 times; kickers and defenses all alike). Nothing on a bye.
const BASE = {QB: 18, RB: 12, WR: 12, TE: 9, K: 8, DEF: 7};
function weightOf(r) {
  if (r.state === 'bye') return 0;
  const rk = gd.rankOf(r);
  const f = rk ? Math.max(.6, Math.min(1.4, Math.sqrt(Math.max(0, rk.score) / rk.ref))) : r.pos === 'K' || r.pos === 'DEF' ? 1 : .85;
  return (BASE[r.pos] || 10) * f;
}
function projOf(rows, yp) {
  if (yp == null || !isFinite(yp)) return null;
  const w = rows.map(weightOf), sum = w.reduce((a, x) => a + x, 0);
  if (!(sum > 0)) return null;
  return r2(rows.reduce((a, r, i) => a + r.pts + yp * w[i] / sum * gameLeft(r.game), 0));
}

export function teamScore(feed, lineup, yp = null) {
  const rows = (lineup || []).map(p => rowOf(feed, p));
  const pts = r2(rows.reduce((a, r) => a + r.pts, 0));
  const on = rows.filter(r => r.state === 'in').length;
  const left = rows.filter(r => r.state === 'pre').length + on;
  return {pts, proj: projOf(rows, yp), rows, on, left, started: rows.some(r => r.state === 'in' || r.state === 'post'), done: rows.length > 0 && left === 0};
}

export function matchup(feed, ups, a, b, yp = null) {
  if (!feed || !ups || !ups.get(a) || !ups.get(b)) return null;
  const A = teamScore(feed, ups.get(a), yp && yp.a), B = teamScore(feed, ups.get(b), yp && yp.b);
  return {a: A, b: B, started: A.started || B.started, over: A.done && B.done, on: A.on + B.on};
}

export function watch(year, week, fn) {
  let last = null, dead = false;
  gd.loadPositions().then(() => { if (!dead && last) fn(last); }, () => {});
  const stop = gd.watch(f => { last = f; fn(f); }, {year, week});
  return () => { dead = true; stop(); };
}
