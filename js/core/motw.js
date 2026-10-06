// Matchup of the Week: ranks the next scheduled week's games so the league has a shortlist to vote on.
// Pure derivations over data.js (no DOM). Two lenses feed one overall score:
//   standings: where both teams sit right now (weighted down early in the season, when ranks mean little)
//   history:   how close and how storied the all-time series is (playoff and title-game meetings, streaks)
import * as data from './data.js';
import {resetAfter} from './nfl.js';

export const LENSES = [
  {id: 'overall', label: 'Overall'},
  {id: 'standings', label: 'Standings'},
  {id: 'history', label: 'History'}
];

const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// The fantasy week the calendar is in at time `at`: week 1 from the Tuesday reset before the season's opening
// Thursday, then a new week every Tuesday 3:00 AM ET (nfl.resetAfter). Cached per hour.
const OPENER = {2026: '2026-09-10'};
function openerOf(year) {
  if (OPENER[year]) return OPENER[year];
  const dow = new Date(Date.UTC(year, 8, 1)).getUTCDay();
  return `${year}-09-${String(1 + (8 - dow) % 7 + 3).padStart(2, '0')}`; // the Thursday after Labor Day
}
const calMemo = new Map();
export function calendarWeek(year, at = Date.now()) {
  const k = year + ':' + Math.floor(at / 36e5);
  if (calMemo.has(k)) return calMemo.get(k);
  let s = resetAfter(Date.parse(openerOf(year) + 'T12:00:00Z') - 4 * 864e5), w = 0;
  if (at >= s) { w = 1; for (let n = resetAfter(s); n <= at && w < 30; n = resetAfter(n)) w++; }
  calMemo.set(k, w);
  return w;
}

// The week the league is on: the next week on the in-progress season's schedule that has not been played yet, and
// never one the calendar has moved past (every Tuesday is a new week, whether or not league.json has the last
// week's results yet), or null.
export function upcoming(at = Date.now()) {
  const live = data.SEASONS.find(s => s.live);
  if (!live) return null;
  const raw = data.DATA.seasons.find(s => s.year === live.year);
  const sched = (raw && raw.schedule) || [];
  const played = data.throughWeek(live) || 0;
  const cal = calendarWeek(live.year, at);
  const weeks = sched.map(g => g.week).filter(w => w > played && w >= cal);
  if (!weeks.length) return null;
  const week = Math.min(...weeks);
  const games = sched.filter(g => g.week === week && data.M[g.a] && data.M[g.b]);
  return games.length ? {season: live, year: live.year, week, played, games} : null;
}

function standing(season, id) {
  const r = season.table.find(x => x.id === id);
  return r ? {rank: r.seed, w: r.w, l: r.l, t: r.t, pf: r.pf, gp: r.w + r.l + r.t} : {rank: null, w: 0, l: 0, t: 0, pf: 0, gp: 0};
}

function lastOf(games, pred) {
  for (let i = games.length - 1; i >= 0; i--) if (pred(games[i])) return games[i];
  return null;
}

// Score one scheduled game. Reasons carry a lens and a weight so each lens can show its own best three.
function score(up, g) {
  const {season, played} = up;
  const n = season.table.length || data.ids.length || 12;
  const A = standing(season, g.a), B = standing(season, g.b);
  const reasons = [];
  const why = (lens, weight, text) => reasons.push({lens, weight, text});

  // ---- Standings
  let S = 0;
  if (A.rank && B.rank && played > 0) {
    const quality = clamp((2 * n + 1 - A.rank - B.rank) / (2 * n - 2));
    const near = clamp(1 - Math.abs(A.rank - B.rank) / (n - 1));
    const early = clamp(played / 4, .35, 1); // week 1 ranks are mostly noise
    S = 100 * (.65 * quality + .35 * near) * early;
    const top = [A.rank, B.rank].sort((x, y) => x - y);
    if (top[0] === 1 && top[1] === 2) { S += 12; why('standings', 100, '#1 vs #2'); }
    else if (top[1] <= 4) { S += 6; why('standings', 80, 'Top-4 clash'); }
    if (A.gp >= 2 && B.gp >= 2 && !A.l && !A.t && !B.l && !B.t) { S += 10; why('standings', 95, 'Both unbeaten'); }
    if (A.gp >= 2 && B.gp >= 2 && !A.w && !B.w) why('standings', 60, 'Both winless');
    if (played >= 6 && top[0] >= 5 && top[1] <= 8) { S += 8; why('standings', 75, 'Playoff bubble'); }
    if (top[0] <= 3 && top[1] >= n - 2) why('standings', 50, 'Upset watch');
    const pfRank = id => season.table.slice().sort((x, y) => y.pf - x.pf).findIndex(x => x.id === id) + 1;
    if (pfRank(g.a) <= 3 && pfRank(g.b) <= 3) { S += 6; why('standings', 70, 'Top-3 offenses'); }
  }
  S = clamp(S, 0, 100);

  // ---- History (every meeting, playoffs and consolation included, like the rest of Rivals)
  const h = data.h2hC(g.a, g.b);
  const m = h.games.length;
  let H;
  if (!m) {
    H = 35;
    why('history', 90, 'First-ever meeting');
  } else {
    const even = 1 - Math.abs(h.aw - h.bw) / m;
    const volume = clamp(m / 10);
    const margin = h.games.reduce((s, x) => s + Math.abs(x.my - x.their), 0) / m;
    const tight = clamp(1 - margin / 40);
    const playoffs = h.games.filter(x => x.playoff).length;
    const title = lastOf(h.games, x => x.type === 'final');
    const lastPlayoff = lastOf(h.games, x => x.playoff);
    H = 100 * (.35 * even + .2 * volume + .2 * tight) + 12 * Math.min(playoffs, 2) + (title ? 10 : 0) + (h.streak.n >= 3 ? 8 : 0);
    if (title) why('history', 100, `${title.year} title game rematch`);
    else if (lastPlayoff) why('history', 85, `Met in the ${lastPlayoff.year} playoffs`);
    if (h.aw === h.bw && m >= 2) why('history', 80, `Series tied ${h.aw}–${h.bw}`);
    else if (Math.abs(h.aw - h.bw) === 1 && m >= 3) {
      const lead = h.aw > h.bw ? g.a : g.b;
      why('history', 70, `${data.name(lead)} leads ${Math.max(h.aw, h.bw)}–${Math.min(h.aw, h.bw)}`);
    }
    if (h.streak.n >= 3) why('history', 65, `${data.name(h.streak.who)} has won ${h.streak.n} straight`);
    if (m >= 3 && margin < 15) why('history', 55, `Avg margin ${margin.toFixed(1)}`);
    const last = h.games[m - 1];
    const lastGap = Math.abs(last.my - last.their);
    if (lastGap < 5) why('history', 60, `Last meeting decided by ${lastGap.toFixed(2)}`);
  }
  H = clamp(H, 0, 100);

  const overall = .55 * S + .45 * H;
  return {a: g.a, b: g.b, A, B, h, meetings: m, scores: {overall, standings: S, history: H}, reasons};
}

// All of the week's games ranked for a lens, each with its best three reasons for that lens.
export function candidates(lens = 'overall') {
  const up = upcoming();
  if (!up) return null;
  const key = LENSES.some(l => l.id === lens) ? lens : 'overall';
  const list = up.games.map(g => score(up, g));
  list.sort((x, y) => y.scores[key] - x.scores[key] || (y.scores.overall - x.scores.overall));
  list.forEach((c, i) => {
    c.place = i + 1;
    c.hype = Math.round(c.scores[key]);
    const pool = key === 'overall' ? c.reasons : c.reasons.filter(r => r.lens === key);
    c.tags = pool.slice().sort((x, y) => y.weight - x.weight).slice(0, 3).map(r => r.text);
  });
  return {year: up.year, week: up.week, played: up.played, lens: key, list};
}

const rankStr = x => x.rank ? `#${x.rank}, ${data.recStr(x.w, x.l, x.t)}` : 'no games yet';

// Poll-ready text for the league chat: a numbered shortlist people can vote on by number.
export function shareText(res, link) {
  const lines = [`Matchup of the Week, Week ${res.week}. Vote by number:`];
  res.list.forEach(c => {
    const tags = c.tags.length ? ` (${c.tags.join(', ')})` : '';
    lines.push(`${c.place}. ${data.name(c.a)} (${rankStr(c.A)}) vs ${data.name(c.b)} (${rankStr(c.B)})${tags}`);
  });
  if (link) lines.push(link);
  return lines.join('\n');
}
