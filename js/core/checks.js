// Core checks for the dev gallery (#/_kit). Each check compares the new core modules
// against a copy of the old single-file app's formulas, or against a hand-computed value.
// Nothing here writes to storage or to the league board.
// Owner: foundation (core).

import * as data from './data.js';
import * as daily from './daily.js';
import * as fire from './fire.js';
import * as motw from './motw.js';
import * as week from './week.js';

// ---------------------------------------------------------------------------
// Old formulas, copied from the old index.html

function oldDayIndex(PZ) {
  const [y, m, d] = PZ.start.split('-').map(Number);
  const t = new Date();
  return Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}

function oldScoring(DS, DAY) {
  const PTS = {col: 40, grid: 50, who: 50};
  const gridDone = () => DS.grid.over || DS.grid.cells.every(Boolean);
  const gridScore = () => DS.grid.cells.filter(c => c && c.ok).length;
  const colDone = () => DS.col.a.length >= 5;
  const colScore = () => DS.col.a.filter((a, r) => a === DAY.c[r][2]).length;
  const whoDone = () => DS.who.done;
  const ptsCol = () => colScore() * PTS.col;
  const ptsWho = () => DS.who.won ? (8 - DS.who.clues) * PTS.who : 0;
  const ptsGrid = () => gridScore() * PTS.grid;
  const totalPts = () => ptsCol() + ptsWho() + ptsGrid();
  return {gridDone, gridScore, colDone, colScore, whoDone, ptsCol, ptsWho, ptsGrid, totalPts};
}

// The share header's date: today (a dev ?day= preview uses the previewed puzzle day, as daily.shareText does).
const shareDate = () => (daily.DEV_DAY && daily.status === 'ready' ? daily.dateOf(daily.PNUM) : new Date());

// when: the header date.
function oldShareText(DS, DAY, leagueName, when = new Date()) {
  const nf = n => Number(n).toLocaleString('en-US');
  const {totalPts, colDone, whoDone, gridDone, gridScore} = oldScoring(DS, DAY);
  const lines = [`${leagueName} daily, ${when.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}: ${nf(totalPts())} pts`];
  if (colDone()) lines.push('College ' + DS.col.a.map((a, r) => a === DAY.c[r][2] ? '🟩' : '🟥').join(''));
  if (whoDone()) lines.push(DS.who.won ? `Mystery player: clue ${DS.who.clues} of 7` : 'Mystery player: stumped');
  if (gridDone()) { lines.push(`Grid ${gridScore()}/9`); for (let r = 0; r < 3; r++) lines.push(DS.grid.cells.slice(r * 3, r * 3 + 3).map(c => c && c.ok ? '🟩' : '🟥').join('')); }
  return lines.join('\n');
}

// The rows, order and ranks the old leaderboardHTML() rendered.
function oldBoard(players, mode, PNUM, uid) {
  const displayName = p => (p.nick || 'Someone');
  const rows = players.map(p => {
    if (mode === 'today') {
      const d = p.days && p.days[PNUM];
      return d ? {id: p.id, name: displayName(p), pts: d.p, sub: `College ${d.c}/5, grid ${d.g}/9, ${d.w ? 'ID on clue ' + d.w : 'no ID'}`} : null;
    }
    if (!p.played) return null;
    return {id: p.id, name: displayName(p), pts: p.total || 0, sub: `${p.played} day${p.played === 1 ? '' : 's'} played, ${Math.round((p.total || 0) / p.played)} a day`};
  }).filter(Boolean).sort((a, b) => b.pts - a.pts);
  let rank = 0, prev = null;
  return rows.map((r, i) => {
    if (r.pts !== prev) { rank = i + 1; prev = r.pts; }
    return {id: r.id, name: r.name, pts: r.pts, sub: r.sub, rank, me: r.id === uid};
  });
}

// The old finish() column, mapped to finishOf's return values.
function oldFinish(s, id) {
  return id === s.champion ? 'champion'
    : id === s.runnerUp ? 'runnerUp'
    : id === s.thirdPlace ? 'third'
    : s.playoffTeams.has(id) ? 'playoffs'
    : id === s.lastPlace ? 'last' : 'missed';
}

// The old league derivations, run on a fresh copy of league.json.
function oldLeague(DATA) {
  DATA.managers.sort((x, y) => x.name.localeCompare(y.name));
  const M = Object.fromEntries(DATA.managers.map(m => [m.id, m]));
  const name = id => (M[id] ? M[id].name : (id || '—'));
  const fmt = n => Number(n).toFixed(2);
  const recStr = (w,l,t) => t ? `${w}–${l}–${t}` : `${w}–${l}`;
  const BRACKET = ['quarter', 'semi', 'final', 'third'];
  const GAMES = [];
  DATA.seasons.forEach(s => (s.matchups || []).forEach(g => GAMES.push(Object.assign({}, g, {year: s.year}))));
  GAMES.sort((x, y) => x.year - y.year || x.week - y.week);
  GAMES.forEach(g => {
    g.tie = g.sa === g.sb;
    g.win = g.sa > g.sb ? g.a : g.b;
    g.lose = g.sa > g.sb ? g.b : g.a;
    g.ws = Math.max(g.sa, g.sb);
    g.ls = Math.min(g.sa, g.sb);
    g.margin = g.ws - g.ls;
    g.reg = !g.type || g.type === 'reg';
    g.playoff = BRACKET.includes(g.type);
  });
  const SEASONS = DATA.seasons.map(s => {
    const games = GAMES.filter(g => g.year === s.year);
    const rows = {};
    const row = id => rows[id] || (rows[id] = {id, w:0, l:0, t:0, pf:0, pa:0});
    games.filter(g => g.reg).forEach(g => {
      const A = row(g.a), B = row(g.b);
      A.pf += g.sa; A.pa += g.sb; B.pf += g.sb; B.pa += g.sa;
      if (g.tie) { A.t++; B.t++; }
      else if (g.win === g.a) { A.w++; B.l++; }
      else { B.w++; A.l++; }
    });
    const table = Object.values(rows).sort((x, y) => (y.w + y.t/2) - (x.w + x.t/2) || y.pf - x.pf);
    table.forEach((r, i) => r.seed = i + 1);
    const fin = games.find(g => g.type === 'final');
    const third = games.find(g => g.type === 'third');
    const live = !!s.inProgress;
    return {
      year: s.year, games, table, live, teams: s.teams || {},
      champion: s.champion || (fin ? fin.win : null),
      runnerUp: s.runnerUp || (fin ? fin.lose : null),
      thirdPlace: s.thirdPlace || (third ? third.win : null),
      lastPlace: s.lastPlace || (!live && table.length ? table[table.length - 1].id : null),
      playoffTeams: new Set(games.filter(g => g.playoff).flatMap(g => [g.a, g.b]))
    };
  }).sort((a, b) => b.year - a.year);
  const DONE = SEASONS.filter(s => s.champion);
  function allTime() {
    const r = {};
    DATA.managers.forEach(m => r[m.id] = {id:m.id, w:0, l:0, t:0, pf:0, pa:0, gp:0, po:0, pw:0, pl:0, titles:0, seconds:0, lasts:0, seasons:0});
    SEASONS.forEach(s => {
      s.table.forEach(t => { const x = r[t.id]; if (!x) return; x.w += t.w; x.l += t.l; x.t += t.t; x.pf += t.pf; x.pa += t.pa; x.gp += t.w + t.l + t.t; x.seasons++; });
      s.playoffTeams.forEach(id => r[id] && r[id].po++);
      s.games.filter(g => g.playoff && !g.tie).forEach(g => { r[g.win] && r[g.win].pw++; r[g.lose] && r[g.lose].pl++; });
      if (r[s.champion]) r[s.champion].titles++;
      if (r[s.runnerUp]) r[s.runnerUp].seconds++;
      if (r[s.lastPlace]) r[s.lastPlace].lasts++;
    });
    return Object.values(r).map(x => Object.assign(x, {pct: x.gp ? (x.w + x.t/2) / x.gp : 0, ppg: x.gp ? x.pf / x.gp : 0}));
  }
  const AT = allTime();
  function h2h(a, b) {
    const games = GAMES.filter(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)).map(g => {
      const my = g.a === a ? g.sa : g.sb, their = g.a === a ? g.sb : g.sa;
      return Object.assign({}, g, {my, their});
    });
    const o = {games, aw:0, bw:0, t:0, ap:0, bp:0, apw:0, bpw:0, aBig:null, bBig:null};
    games.forEach(g => {
      o.ap += g.my; o.bp += g.their;
      if (g.my > g.their) { o.aw++; if (g.playoff) o.apw++; if (!o.aBig || g.my - g.their > o.aBig.m) o.aBig = {m: g.my - g.their, g}; }
      else if (g.their > g.my) { o.bw++; if (g.playoff) o.bpw++; if (!o.bBig || g.their - g.my > o.bBig.m) o.bBig = {m: g.their - g.my, g}; }
      else o.t++;
    });
    let streak = 0, who = null;
    for (let i = games.length - 1; i >= 0; i--) {
      const g = games[i]; const w = g.my > g.their ? a : g.their > g.my ? b : null;
      if (!w) break;
      if (!who) who = w;
      if (w !== who) break;
      streak++;
    }
    o.streak = {who, n: streak};
    return o;
  }
  function defaultOpponent(a) {
    const others = DATA.managers.map(m => m.id).filter(id => id !== a);
    let best = others[0], bestScore = -1;
    others.forEach(id => {
      const r = h2h(a, id); const score = r.games.length * 100 - Math.abs(r.aw - r.bw);
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return best;
  }
  function computeFacts() {
    const reg = GAMES.filter(g => g.reg);
    const F = [];
    const scores = GAMES.flatMap(g => [{id:g.a, s:g.sa, opp:g.b, g}, {id:g.b, s:g.sb, opp:g.a, g}]);
    const when = g => `${g.year}, week ${g.week}`;
    if (!scores.length) return F;
    const hi = scores.reduce((m, x) => x.s > m.s ? x : m);
    const lo = scores.reduce((m, x) => x.s < m.s ? x : m);
    F.push({label:'Highest score in a week', val:fmt(hi.s), detail:`${name(hi.id)} vs ${name(hi.opp)}, ${when(hi.g)}`});
    F.push({label:'Lowest score in a week', val:fmt(lo.s), detail:`${name(lo.id)} vs ${name(lo.opp)}, ${when(lo.g)}`});
    const decided = GAMES.filter(g => !g.tie);
    const blow = decided.reduce((m, g) => g.margin > m.margin ? g : m);
    const close = decided.reduce((m, g) => g.margin < m.margin ? g : m);
    F.push({label:'Biggest blowout', val:fmt(blow.margin), unit:'points', detail:`${name(blow.win)} beat ${name(blow.lose)} ${fmt(blow.ws)} to ${fmt(blow.ls)}, ${when(blow)}`});
    F.push({label:'Closest game', val:fmt(close.margin), unit:'points', detail:`${name(close.win)} edged ${name(close.lose)} ${fmt(close.ws)} to ${fmt(close.ls)}, ${when(close)}`});
    const bl = decided.reduce((m, g) => g.ls > m.ls ? g : m);
    const fw = decided.reduce((m, g) => g.ws < m.ws ? g : m);
    F.push({label:'Most points in a loss', val:fmt(bl.ls), detail:`${name(bl.lose)} lost to ${name(bl.win)}, ${when(bl)}`});
    F.push({label:'Fewest points in a win', val:fmt(fw.ws), detail:`${name(fw.win)} still beat ${name(fw.lose)}, ${when(fw)}`});
    let bw = {n:0}, blst = {n:0};
    DATA.managers.forEach(m => {
      let w = 0, l = 0, ws = null, ls = null;
      reg.filter(g => g.a === m.id || g.b === m.id).forEach(g => {
        if (g.tie) { w = 0; l = 0; return; }
        if (g.win === m.id) { if (!w) ws = g; w++; l = 0; if (w > bw.n) bw = {n:w, id:m.id, from:ws, to:g}; }
        else { if (!l) ls = g; l++; w = 0; if (l > blst.n) blst = {n:l, id:m.id, from:ls, to:g}; }
      });
    });
    const span = s => s.from.year === s.to.year ? `${s.from.year}, weeks ${s.from.week} to ${s.to.week}` : `${when(s.from)} to ${when(s.to)}`;
    if (bw.n) F.push({label:'Longest winning streak', val:bw.n, unit:'games', detail:`${name(bw.id)}, ${span(bw)}`});
    if (blst.n) F.push({label:'Longest losing streak', val:blst.n, unit:'games', detail:`${name(blst.id)}, ${span(blst)}`});
    const seasonRows = DONE.flatMap(s => s.table.map(r => Object.assign({year:s.year, s}, r)));
    const best = seasonRows.reduce((m, r) => ((r.w + r.t/2) - (m.w + m.t/2) || r.pf - m.pf) > 0 ? r : m);
    const mostPf = seasonRows.reduce((m, r) => r.pf > m.pf ? r : m);
    const unlucky = seasonRows.reduce((m, r) => r.pa > m.pa ? r : m);
    const bestFinish = best.id === best.s.champion ? 'and won the title' : `but ${best.id === best.s.runnerUp ? 'lost in the championship' : 'didn\u2019t win the title'}`;
    F.push({label:'Best regular season', val:recStr(best.w, best.l, best.t), detail:`${name(best.id)} in ${best.year}, ${bestFinish}`});
    F.push({label:'Most points in a season', val:fmt(mostPf.pf), detail:`${name(mostPf.id)} in ${mostPf.year}`});
    F.push({label:'Toughest schedule', val:fmt(unlucky.pa), unit:'points against', detail:`${name(unlucky.id)} in ${unlucky.year}, went ${recStr(unlucky.w, unlucky.l, unlucky.t)}`});
    const top = (k) => AT.slice().sort((x, y) => y[k] - x[k])[0];
    const ru = top('seconds'); if (ru && ru.seconds > 1) F.push({label:'Most runner-up finishes', val:ru.seconds, detail:name(ru.id)});
    const lp = top('lasts'); if (lp && lp.lasts > 0) F.push({label:'Most last-place finishes', val:lp.lasts, detail:name(lp.id)});
    const tc = {}; (DATA.trades || []).forEach(t => t.sides.forEach(s => tc[s.manager] = (tc[s.manager] || 0) + 1));
    const tt = Object.entries(tc).sort((a, b) => b[1] - a[1])[0];
    if (tt) F.push({label:'Most trades made', val:tt[1], detail:name(tt[0])});
    const latestYear = SEASONS.length ? SEASONS[0].year : 0;
    const droughts = AT.filter(x => x.seasons).map(x => {
      const won = SEASONS.filter(s => s.champion === x.id).map(s => s.year);
      return won.length ? {id:x.id, n: latestYear - Math.max(...won), last: Math.max(...won)} : {id:x.id, n: x.seasons, never:true};
    }).sort((a, b) => b.n - a.n || (b.never ? 1 : 0) - (a.never ? 1 : 0));
    if (droughts[0]) {
      const d = droughts[0];
      F.push({label:'Longest title drought', val:d.n, unit:'seasons', detail: d.never ? `${name(d.id)} hasn't won one yet` : `${name(d.id)}, last title in ${d.last}`});
    }
    return F;
  }
  return {GAMES, SEASONS, DONE, AT, FACTS: computeFacts(), h2h, defaultOpponent};
}

// ---------------------------------------------------------------------------
// Helpers

const ser = v => JSON.stringify(v, (k, x) => x instanceof Set ? [...x].sort() : x);

// A crafted DS for today's puzzle: College 3 of 5, Mystery solved on clue 3, Grid 5 of 9 then given up.
// Hand-computed: 3 x 40 + (8 - 3) x 50 + 5 x 50 = 120 + 250 + 250 = 620.
function craftDS(DAY) {
  const wrong = r => (DAY.c[r][2] + 1) % DAY.c[r][1].length;
  const right = r => DAY.c[r][2];
  const cells = [
    {p: 11, ok: true}, {p: 12, ok: false}, {p: 13, ok: true},
    null, {p: 14, ok: true}, {p: 15, ok: false},
    {p: 16, ok: true}, null, {p: 17, ok: true}
  ];
  return {
    grid: {cells, over: true},
    col: {a: [right(0), wrong(1), right(2), right(3), wrong(4)]},
    who: {g: [5, 6], clues: 3, done: true, won: true},
    hl: {a: []}
  };
}
// A second crafted DS: College unfinished (2 right so far), Mystery stumped, Grid all 9 filled with no give-up.
// Hand-computed: 2 x 40 + 0 + 9 x 50 = 80 + 450 = 530.
function craftDS2(DAY) {
  const cells = Array.from({length: 9}, (_, k) => ({p: 100 + k, ok: true}));
  return {
    grid: {cells, over: false},
    col: {a: [DAY.c[0][2], DAY.c[1][2]]},
    who: {g: [1, 2, 3, 4, 5, 6, 7], clues: 7, done: true, won: false},
    hl: {a: []}
  };
}

// The v1 checks run on a v1 day: today's entry when it is v1 (the normal case, so they test exactly
// today's behavior), else the first v1 entry in days (a dev ?day= preview of a v2 day).
function v1Day() {
  if (!daily.isV2(daily.DAY)) return daily.DAY;
  return daily.PZ.days.find(d => !daily.isV2(d));
}

// A crafted v2 day built from real P indexes of a v1 day: its grid, College rows and Mystery player,
// a Journey for the Mystery player (his teams in P order, his N college) and five silhouette rounds
// (answers = the College players, distractors = the higher/lower players), answer positions 0,1,2,3,0.
function craftV2Day(base) {
  const PP = daily.PP, w = base.w;
  const pool = [...new Set(base.h.flat().filter(x => typeof x === 'number'))].filter(i => !base.c.some(c => c[0] === i));
  const s = base.c.map((c, r) => {
    const p = c[0], a = r % 4, o = pool.slice(r * 2, r * 2 + 3);
    while (o.length < 3) o.push(r * 10 + o.length + 1);
    o.splice(a, 0, p);
    return {p, e: '0', o, a};
  });
  const col = daily.PZ.N[w] && daily.PZ.N[w][8] ? [daily.PZ.N[w][8]] : [];
  return {v: 2, g: base.g.slice(), c: base.c, w, h: base.h, j: {p: w, col, t: PP[w][1]}, s};
}

// A crafted v2 DS: College 3 of 5 (120), Faces 3 of 5 (150), Mystery on clue 3 (250), Journey on guess 2
// (150), Grid 5 of 9 (250). Hand-computed total 920.
function craftV2DS(day) {
  const ds = craftDS(day);
  const S = day.s;
  ds.sil = {a: [S[0].a, (S[1].a + 1) % 4, S[2].a, -1, S[4].a]};
  ds.jr = {g: [day.j.p === 1 ? 2 : 1], done: true, won: true};
  return ds;
}
// A perfect v2 DS: 200 + 250 + 350 + 250 + 450 = 1500.
function perfectV2DS(day) {
  return {
    grid: {cells: Array.from({length: 9}, (_, k) => ({p: 200 + k, ok: true})), over: false},
    col: {a: day.c.map(c => c[2])},
    who: {g: [], clues: 1, done: true, won: true},
    hl: {a: []},
    sil: {a: day.s.map(x => x.a)},
    jr: {g: [], done: true, won: true}
  };
}

function fakePlayers(PNUM) {
  return [
    {id: 'fake-1', nick: 'Evan A.', days: {[PNUM]: {p: 620, g: 5, c: 3, w: 3}, [PNUM - 2]: {p: 580, g: 4, c: 3, w: 4}}, total: 1200, played: 2, last: PNUM},
    {id: 'fake-2', nick: '', days: {[PNUM]: {p: 800, g: 7, c: 4, w: 0}}, total: 800, played: 1, last: PNUM},
    {id: 'fake-3', nick: 'Mason', days: {[PNUM]: {p: 620, g: 6, c: 2, w: 2}, [PNUM - 1]: {p: 900, g: 8, c: 4, w: 1}, [PNUM - 2]: {p: 880, g: 8, c: 4, w: 1}}, total: 2400, played: 3, last: PNUM},
    {id: 'fake-4', nick: 'Zed', days: {[PNUM - 1]: {p: 500, g: 4, c: 4, w: 1}}, total: 500, played: 1, last: PNUM - 1},
    {id: 'fake-5', nick: 'Old timer', days: {[PNUM - 30]: {p: 100, g: 1, c: 1, w: 0}}, total: 100, played: 1, last: PNUM - 30}
  ];
}

// ---------------------------------------------------------------------------

export async function runChecks() {
  const out = [];
  const pending = [];
  // fn returns true or {pass, detail}; it may also return a Promise of that (awaited before runChecks resolves,
  // the row keeps its place in the list).
  const check = (name, fn) => {
    const row = {name, pass: false, detail: 'pending'};
    out.push(row);
    const done = r => {
      const pass = r === true || (r && r.pass === true);
      row.pass = pass;
      row.detail = (r && r.detail) || (pass ? 'ok' : 'mismatch');
    };
    const fail = e => { row.pass = false; row.detail = 'threw: ' + (e && e.message || e); };
    try {
      const r = fn();
      if (r && typeof r.then === 'function') pending.push(Promise.resolve(r).then(done, fail));
      else done(r);
    } catch (e) { fail(e); }
  };

  let dataErr = null, dailyErr = null;
  try { await data.load(); } catch (e) { dataErr = e; }
  try { await daily.ensure(); } catch (e) { dailyErr = e; }
  const needDaily = () => { if (dailyErr) throw new Error('puzzles did not load: ' + (dailyErr.message || dailyErr)); };
  const needData = () => { if (dataErr) throw new Error('league did not load: ' + (dataErr.message || dataErr)); };

  // 1. PNUM, dayIndex and DAY match the old formula
  check('PNUM, dayIndex and DAY match the old formula', () => {
    needDaily();
    // A dev ?day=<PNUM> preview (dev hosts only) replaces the date-based index.
    const PZ = daily.PZ, idx = daily.DEV_DAY ? daily.DEV_DAY - 1 : oldDayIndex(PZ);
    const pass = daily.dayIndex === idx && daily.PNUM === idx + 1 && daily.DAY === PZ.days[idx % PZ.days.length];
    return {pass, detail: `dayIndex ${daily.dayIndex} (${daily.DEV_DAY ? 'dev ?day=' + daily.DEV_DAY : 'old ' + idx}), PNUM ${daily.PNUM}, DAY is days[${idx % PZ.days.length}]: ${daily.DAY === PZ.days[idx % PZ.days.length]}`};
  });

  // 2. SKEY
  check("SKEY === 'gg-daily-' + PNUM", () => {
    needDaily();
    return {pass: daily.SKEY === 'gg-daily-' + daily.PNUM, detail: daily.SKEY};
  });

  // 3. totalPts for a crafted DS equals the hand-computed value
  check('totalPts() for a crafted DS equals the hand-computed value', () => {
    needDaily();
    const D = v1Day(), live = D === daily.DAY;
    const ds = craftDS(D), ds2 = craftDS2(D);
    // On a v1 day the default arguments (live DS/DAY/STEPS) must give the same answers.
    const a = live ? daily.totalPts(ds) : daily.totalPts(ds, D), b = live ? daily.totalPts(ds2) : daily.totalPts(ds2, D);
    const oldA = oldScoring(ds, D).totalPts(), oldB = oldScoring(ds2, D).totalPts();
    const steps = (live ? daily.STEPS : daily.stepsFor(D)).map(s => s.result(ds, D)).join(' | ');
    const pass = a === 620 && b === 530 && oldA === 620 && oldB === 530
      && steps === '3 of 5 | Clue 3 of 7 | 5 of 9'
      && (live ? daily.allDone(ds) && !daily.allDone(ds2) && daily.firstOpen(ds2) === 0
        : daily.allDone(ds, D) && !daily.allDone(ds2, D) && daily.firstOpen(ds2, D) === 0)
      && (!live || (daily.STEPS === daily.stepsFor(D) && daily.maxPts() === 1000));
    return {pass, detail: `crafted ${a} (expected 620), second ${b} (expected 530); steps "${steps}"${live ? '' : ' (on a v1 day; today is a v2 preview)'}`};
  });

  // 4. shareText for a crafted DS matches the old function
  check("shareText() for a crafted DS matches the old function's output", () => {
    needDaily(); needData();
    const L = data.DATA.league.name, D = v1Day(), live = D === daily.DAY;
    const ds = craftDS(D), ds2 = craftDS2(D);
    const a = live ? daily.shareText(ds) : daily.shareText(ds, D), b = live ? daily.shareText(ds2) : daily.shareText(ds2, D);
    const oa = oldShareText(ds, D, L, shareDate()), ob = oldShareText(ds2, D, L, shareDate());
    return {pass: a === oa && b === ob && a.split('\n').length === 7, detail: JSON.stringify(a)};
  });

  // 5. boardRows('today') sub strings match the old leaderboardHTML format
  check("boardRows('today') sub strings, sort and ranks match the old leaderboard", () => {
    needDaily();
    // The old board only ever showed three-puzzle days: test on today if it is one, else on day 1 (a v1 day).
    const P = daily.isV2() ? 1 : daily.PNUM, players = fakePlayers(P);
    const mine = daily.boardRows('today', players, P).map(r => ({id: r.id, name: r.name, pts: r.pts, sub: r.sub, rank: r.rank, me: r.me}));
    const old = oldBoard(players, 'today', P, daily.LB.uid);
    const expect = [
      'fake-2|Someone|800|College 4/5, grid 7/9, no ID|1',
      'fake-1|Evan A.|620|College 3/5, grid 5/9, ID on clue 3|2',
      'fake-3|Mason|620|College 2/5, grid 6/9, ID on clue 2|2'
    ].join(';');
    const got = mine.map(r => [r.id, r.name, r.pts, r.sub, r.rank].join('|')).join(';');
    return {pass: ser(mine) === ser(old) && got === expect, detail: got};
  });

  check("boardRows('season') matches the old leaderboard, with movement", () => {
    needDaily();
    const P = daily.PNUM, players = fakePlayers(P);
    const rows = daily.boardRows('season', players);
    const mine = rows.map(r => ({id: r.id, name: r.name, pts: r.pts, sub: r.sub, rank: r.rank, me: r.me}));
    const old = oldBoard(players, 'season', P, daily.LB.uid);
    // Hand-computed: before today fake-3 1780 (#1), fake-1 580 (#2), fake-4 500 (#3), fake-5 100 (#4); fake-2 is new.
    const moves = rows.map(r => r.id + ':' + r.move).join(' ');
    const mgr = rows.map(r => r.id + ':' + r.managerId).join(' ');
    const pass = ser(mine) === ser(old)
      && moves === 'fake-3:0 fake-1:0 fake-2:new fake-4:-1 fake-5:-1'
      && mgr === 'fake-3:mason fake-1:evan fake-2:null fake-4:null fake-5:null';
    return {pass, detail: `${moves}; ${mgr}; subs ${rows.map(r => r.sub).join(' / ')}`};
  });

  check('social() and streakOf() on a fake player list', () => {
    needDaily();
    const P = daily.PNUM, players = fakePlayers(P);
    // On a five-puzzle day, today's entries need the v2 fields to count as played (entryFor).
    if (daily.isV2()) players.forEach(p => { const d = p.days[P]; if (d) Object.assign(d, {s: 0, j: 0}); });
    const s = daily.social(players);
    const st = daily.streakOf(players[2]);
    const pass = s.played.length === 3 && s.regulars === 4 && s.leader === 'Someone'
      && s.stillToPlay.map(x => x.id).join() === 'fake-4'
      && (P < 3 || (st.current === 3 && st.best === 3))
      && daily.streakOf(players[3]).current === (P > 1 ? 1 : 0);
    return {pass, detail: `played ${s.played.length}, regulars ${s.regulars}, leader ${s.leader}, still ${s.stillToPlay.map(x => x.name).join(', ')}; Mason streak ${st.current}/${st.best}`};
  });

  // 6. holders
  check("holders(\"Diesel vs Carswell's Ls, week 16, 2021\") returns Corbin first", () => {
    needData();
    const h = data.holders('Diesel vs Carswell\'s Ls, week 16, 2021');
    const curly = data.holders('Diesel vs Carswell’s Ls, week 16, 2021');
    const pass = h.length === 2 && h[0].id === 'corbin' && h[1].id === 'jacob' && h[0].year === 2021 && ser(curly) === ser(h);
    return {pass, detail: h.map(x => `${x.id}@${x.at} (${x.team})`).join(', ')};
  });

  // 7. finishOf agrees with the old finish()
  check('finishOf() agrees with the old finish() for every manager in every completed season', () => {
    needData();
    let n = 0; const bad = [];
    data.DONE.forEach(s => data.ids.forEach(id => {
      n++;
      const a = data.finishOf(s, id), b = oldFinish(s, id), c = data.finishOf(s.year, id);
      if (a !== b || c !== b) bad.push(`${s.year}/${id}: ${a} vs ${b}`);
    }));
    return {pass: !bad.length && n > 0, detail: bad.length ? bad.slice(0, 5).join('; ') : `${n} season-manager pairs agree`};
  });

  // Extra: league derivations match the old code on a fresh copy of league.json
  let fresh = null;
  if (!dataErr) {
    try {
      const res = await fetch(new URL('../../data/league.json', import.meta.url).href, {cache: 'no-cache'});
      fresh = oldLeague(await res.json());
    } catch (e) { fresh = e; }
  }
  check('GAMES, SEASONS, DONE, AT and FACTS match the old derivations', () => {
    needData();
    if (!fresh || fresh instanceof Error) throw fresh || new Error('no fresh copy');
    const parts = {GAMES: [data.GAMES, fresh.GAMES], SEASONS: [data.SEASONS, fresh.SEASONS], DONE: [data.DONE, fresh.DONE], AT: [data.AT, fresh.AT], FACTS: [data.FACTS, fresh.FACTS]};
    const bad = Object.keys(parts).filter(k => ser(parts[k][0]) !== ser(parts[k][1]));
    return {pass: !bad.length, detail: bad.length ? 'differs: ' + bad.join(', ') : `${data.GAMES.length} games, ${data.SEASONS.length} seasons, ${data.FACTS.length} facts`};
  });

  check('h2h, h2hC and defaultOpponent match the old code for every pair', () => {
    needData();
    if (!fresh || fresh instanceof Error) throw fresh || new Error('no fresh copy');
    const bad = [];
    data.ids.forEach(a => {
      if (data.defaultOpponent(a) !== fresh.defaultOpponent(a)) bad.push('defaultOpponent ' + a);
      data.ids.forEach(b => {
        if (a === b) return;
        const o = ser(fresh.h2h(a, b));
        if (ser(data.h2h(a, b)) !== o || ser(data.h2hC(a, b)) !== o) bad.push(a + '|' + b);
      });
    });
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 5).join(', ') : `${data.ids.length * (data.ids.length - 1)} pairs agree`};
  });

  check('color(), hueClose() and recordsFlat()', () => {
    needData();
    const known = data.ids.every(id => data.color(id).cls === 'mc-' + id);
    const x = data.color('zz'); // 122 + 122 = 244, 244 % 12 = 4
    const flat = data.recordsFlat();
    const pass = known && x.cls === 'mc-x4' && x.mono === 'ZZ' && data.color('jackson').mono === 'JX'
      && data.hueClose('evan', 'mason') && !data.hueClose('ben', 'corbin')
      && flat.length > 0 && flat.every(r => r.key && r.label != null && Array.isArray(r.holders));
    return {pass, detail: `unknown id -> ${x.cls} ${x.mono}; ${flat.length} records, first key ${flat[0] && flat[0].key}, primary ${flat[0] && flat[0].primary}`};
  });

  check('gradeFor() ladder', () => {
    const want = 'PERFECT DAY,ALL-PRO,ALL-PRO,PRO BOWL,PRO BOWL,STARTER,PRACTICE SQUAD,CUT DAY,CUT DAY';
    const T = [1000, 999, 850, 849, 650, 450, 250, 249, 0];
    const g = T.map(t => daily.gradeFor(t, 1000)).join(',');
    // Today's default max on a v1 day is 1,000; as an array callback the index is not taken as a max.
    const v1 = !daily.isV2(daily.DAY);
    const g2 = v1 ? T.map(daily.gradeFor).join(',') : want;
    return {pass: g === want && g2 === want, detail: g};
  });

  check('Dev guard: no league-board writes from dev hosts without ?post=1', () => {
    // Dev hosts: loopback, bare machine names, *.localhost/.test/.local/.lan/.home.arpa/.internal/.ts.net, private LAN
    // and CGNAT IPs, IPv6 link-local / unique-local. Exactly post=1 opts in.
    const samples = {'localhost': true, '127.0.0.1': true, '[::1]': true, 'gg.test': true, '192.168.1.20': true, '10.0.0.7': true, '172.20.1.1': true,
      '127.0.0.2': true, '0.0.0.0': true, 'evan-pc': true, 'devbox.lan': true, 'mypc.home.arpa': true, 'box.internal': true, '100.101.102.103': true,
      'pc.tail1234.ts.net': true, '[fe80::1]': true, '[fd12:3456::1]': true, '[::ffff:7f00:1]': true,
      'evanappenzeller-ui.github.io': false, 'gridirongangbang.com': false, '172.32.0.1': false, '8.8.8.8': false, '100.128.0.1': false,
      'localhost.example.com': false, '[2606:4700::1111]': false};
    const bad = Object.entries(samples).filter(([h, want]) => daily.isDevHost(h) !== want).map(([h]) => h);
    let post = false;
    try { post = new URLSearchParams(location.search).get('post') === '1'; } catch (_) {}
    const local = daily.isDevHost(location.hostname) && !post;
    const pass = !bad.length && daily.DEV_NO_POST === local && (!local || daily.LB.save === null);
    return {pass, detail: `${bad.length ? 'misclassified ' + bad.join(', ') + '; ' : ''}local ${local}, DEV_NO_POST ${daily.DEV_NO_POST}, LB.save ${daily.LB.save ? 'assigned' : 'unassigned'}, uid ${daily.LB.uid ? 'signed in' : 'none yet'}`};
  });

  // ---------------------------------------------------------------------------
  // v2 days (5 puzzles, 1,500 points). Crafted from real P indexes; nothing is saved or emitted.
  let V1 = null, V2 = null;
  try { if (!dailyErr) { V1 = v1Day(); V2 = craftV2Day(V1); } } catch (_) { V1 = V2 = null; }
  const needV2 = () => { needDaily(); if (!V2) throw new Error('could not craft a v2 day'); };

  check('isV2, maxPts and the v1 / v2 step sets', () => {
    needV2();
    const ids = d => daily.stepsFor(d).map(s => s.id).join(','), sum = d => daily.stepsFor(d).reduce((t, s) => t + s.max, 0);
    const pass = !daily.isV2(V1) && daily.isV2(V2) && daily.maxPts(V1) === 1000 && daily.maxPts(V2) === 1500
      && daily.maxPts() === daily.maxPts(daily.DAY) && !daily.isV2(null) && daily.maxPts(null) === 1000
      && ids(V1) === 'col,who,grid' && ids(V2) === 'col,sil,who,jr,grid' && sum(V1) === 1000 && sum(V2) === 1500
      && daily.slugsFor(V1).join() === 'college,mystery,grid' && daily.slugsFor(V2).join() === 'college,silhouette,mystery,journey,grid'
      && daily.STEPS === daily.stepsFor(daily.DAY) && daily.SLUGS === daily.slugsFor(daily.DAY)
      && daily.SLUGS.every((s, i) => daily.slug(i) === s && daily.stepOf(s) === i) && daily.slug(daily.SLUGS.length) === null
      && daily.__dev.scratch(V2, {}, () => daily.STEPS.length === 5 && daily.slug(3) === 'journey' && daily.stepOf('silhouette') === 1 && daily.maxPts() === 1500)
      && daily.STEPS === daily.stepsFor(daily.DAY);
    return {pass, detail: `v1 ${ids(V1)} = ${sum(V1)}, v2 ${ids(V2)} = ${sum(V2)}; today ${daily.isV2() ? 'v2' : 'v1'}, ${daily.STEPS.length} steps`};
  });

  check('totalPts() on a crafted v2 DS equals the hand-computed value', () => {
    needV2();
    const ds = craftV2DS(V2), pf = perfectV2DS(V2);
    const part = {grid: {cells: Array(9).fill(null), over: false}, col: {a: [V2.c[0][2]]}, who: {g: [], clues: 1, done: false, won: false}, hl: {a: []}, sil: {a: []}, jr: {g: [], done: false, won: false}};
    const a = daily.totalPts(ds, V2), p = daily.totalPts(pf, V2), q = daily.totalPts(part, V2);
    const steps = daily.stepsFor(V2).map(s => s.result(ds, V2)).join(' | ');
    const pts = daily.stepsFor(V2).map(s => s.pts(ds, V2)).join(',');
    // The same DS scored as a v1 day ignores the v2 parts: 120 + 250 + 250.
    const asV1 = daily.totalPts(ds, V1);
    const pass = a === 920 && p === 1500 && q === 40 && asV1 === 620 && pts === '120,150,250,150,250'
      && steps === '3 of 5 | 3 of 5 | Clue 3 of 7 | Guess 2 of 3 | 5 of 9'
      && daily.allDone(ds, V2) && daily.allDone(pf, V2) && !daily.allDone(part, V2) && daily.firstOpen(part, V2) === 0
      && daily.anyStarted(part, V2) && daily.firstOpen(Object.assign({}, pf, {jr: {g: [5], done: false, won: false}}), V2) === 3
      && daily.jrGuessNo(ds) === 2 && daily.silScore(ds, V2) === 3;
    return {pass, detail: `crafted ${a} (expected 920; ${pts}), perfect ${p} (1500), partial ${q} (40), as v1 ${asV1} (620); steps "${steps}"`};
  });

  check('gradeFor() on v2 totals (out of 1,500)', () => {
    const g = [1500, 1499, 1275, 1274, 975, 974, 675, 375, 374, 0].map(t => daily.gradeFor(t, 1500)).join(',');
    const want = 'PERFECT DAY,ALL-PRO,ALL-PRO,PRO BOWL,PRO BOWL,STARTER,STARTER,PRACTICE SQUAD,CUT DAY,CUT DAY';
    return {pass: g === want, detail: g};
  });

  check('shareText() on v2 days: Faces and Journey lines', () => {
    needV2(); needData();
    const L = data.DATA.league.name, date = shareDate().toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
    const G = '🟩', R = '🟥';
    const a = daily.shareText(craftV2DS(V2), V2);
    const wantA = [`${L} daily, ${date}: 920 pts`, `College ${G}${R}${G}${G}${R}`, `Faces ${G}${R}${G}${R}${G}`, 'Mystery player: clue 3 of 7',
      'Journey: guess 2 of 3', 'Grid 5/9', G + R + G, R + G + R, G + R + G].join('\n');
    // Faces unfinished (no line), Journey missed, Mystery stumped, Grid all nine: 80 + 100 + 0 + 0 + 450 = 630.
    const ds2 = Object.assign(craftDS2(V2), {sil: {a: [V2.s[0].a, V2.s[1].a]}, jr: {g: [1, 2, 3], done: true, won: false}});
    const b = daily.shareText(ds2, V2);
    const wantB = [`${L} daily, ${date}: 630 pts`, 'Mystery player: stumped', 'Journey: missed', 'Grid 9/9', G + G + G, G + G + G, G + G + G].join('\n');
    const perfect = daily.shareText(perfectV2DS(V2), V2).split('\n')[0];
    return {pass: a === wantA && b === wantB && perfect === `${L} daily, ${date}: 1,500 pts`, detail: JSON.stringify(a)};
  });

  check('silPick, journeyGuess and lockIn branching on a scratch DS', () => {
    needV2();
    const before = {ds: JSON.stringify(daily.DS), ls: (() => { try { return localStorage.getItem(daily.SKEY); } catch (_) { return null; } })(), day: daily.DAY};
    let events = 0;
    const off = daily.subscribe(t => { if (t === 'progress') events++; });
    const log = [];
    try {
      const S = V2.s, wrongOf = r => (S[r].a + 1) % 4;
      // Silhouettes
      daily.__dev.scratch(V2, {}, ds => {
        log.push(daily.silPick(1, 0) === null);                       // out of order
        log.push(daily.silPick(0, 4) === null && daily.silPick(0, -1) === null && daily.silPick('x', 0) === null);
        const r0 = daily.silPick('0', String(S[0].a));                 // strings coerce
        log.push(!!r0 && r0.round === 0 && r0.correct === true && r0.ans === S[0].a && r0.p === S[0].p && ds.sil.a[0] === S[0].a);
        log.push(daily.silPick(0, 0) === null);                         // already answered
        const r1 = daily.silPick(1, wrongOf(1));
        log.push(!!r1 && r1.correct === false && r1.ans === S[1].a);
        for (let r = 2; r < 5; r++) daily.silPick(r, S[r].a);
        log.push(daily.silPick(5, 0) === null && ds.sil.a.length === 5 && daily.silDone() && daily.silScore() === 4 && daily.ptsSil() === 200);
      });
      // Journey: three distinct wrong guesses lose, with hints after guesses 1 and 2
      const J = V2.j.p, w = [1, 2, 3].map(x => x === J ? 4 : x);
      daily.__dev.scratch(V2, {}, ds => {
        log.push(daily.journeyGuess(-1) === null && daily.journeyGuess('abc') === null && daily.journeyHints().length === 0);
        log.push(daily.journeyGuess(w[0]) === 'wrong' && daily.journeyHints().length === 1);
        log.push(daily.journeyGuess(String(w[0])) === 'dup' && ds.jr.g.length === 1);
        log.push(daily.journeyGuess(w[1]) === 'wrong' && daily.journeyHints().length === 2 && !ds.jr.done);
        log.push(daily.journeyGuess(w[2]) === 'lost' && ds.jr.done && !ds.jr.won && daily.ptsJr() === 0 && daily.jrGuessNo() === 0);
        log.push(daily.journeyGuess(J) === null && daily.journeyHints().length === 2);
      });
      // Journey: solved on guess 1 and on guess 3
      daily.__dev.scratch(V2, {}, ds => { log.push(daily.journeyGuess(J) === 'win' && ds.jr.won && daily.jrGuessNo() === 1 && daily.ptsJr() === 250 && ds.jr.g.length === 0); });
      daily.__dev.scratch(V2, {}, ds => {
        daily.journeyGuess(w[0]); daily.journeyGuess(w[1]);
        log.push(daily.journeyGuess(String(J)) === 'win' && daily.jrGuessNo() === 3 && daily.ptsJr() === 75 && daily.STEPS[3].result() === 'Guess 3 of 3');
      });
      // lockIn on v2: unanswered rounds become -1, Journey ends unsolved
      daily.__dev.scratch(V2, {}, ds => {
        daily.silPick(0, S[0].a); daily.silPick(1, S[1].a); daily.journeyGuess(w[0]);
        daily.lockIn();
        log.push(ds.sil.a.join() === [S[0].a, S[1].a, -1, -1, -1].join() && ds.jr.done && !ds.jr.won && ds.who.done && ds.grid.over
          && ds.col.a.length === 5 && daily.allDone() && daily.totalPts() === 100);
      });
      // v1 day: the v2 actions refuse, and lockIn leaves the v2 parts alone
      daily.__dev.scratch(V1, {}, ds => {
        log.push(daily.silPick(0, 0) === null && daily.journeyGuess(V1.w) === null && daily.journeyPath() === null && daily.journeyHints().length === 0);
        daily.lockIn();
        log.push(ds.sil.a.length === 0 && !ds.jr.done && daily.allDone() && daily.totalPts() === 0);
      });
    } finally { off(); }
    const after = {ds: JSON.stringify(daily.DS), ls: (() => { try { return localStorage.getItem(daily.SKEY); } catch (_) { return null; } })()};
    const clean = after.ds === before.ds && after.ls === before.ls && daily.DAY === before.day && events === 0;
    const bad = log.map((x, i) => x ? null : i + 1).filter(Boolean);
    return {pass: !bad.length && clean && log.length === 17, detail: bad.length ? 'failed steps ' + bad.join(', ') : `${log.length} steps ok; live DS, storage and events untouched: ${clean}`};
  });

  check('v2 saved state: partial sil/jr objects are normalized; a previewed day never posts', () => {
    needV2();
    const S = V2.s, J = V2.j.p, wrong = J === 1 ? 2 : 1;
    const log = [];
    const v2n = daily.PZ.days.findIndex(d => daily.isV2(d)) + 1;
    log.push(v2n > 0 && daily.pointsFor({sil: {}, jr: {done: false}}, v2n) === 0);   // read side on a real v2 day
    daily.__dev.scratch(V2, {sil: {}, jr: {done: false}}, ds => {
      log.push(Array.isArray(ds.sil.a) && Array.isArray(ds.jr.g) && ds.jr.done === false);
      log.push(!!daily.silPick(0, S[0].a) && daily.journeyGuess(wrong) === 'wrong');
      let threw = false; try { daily.lockIn(); } catch (_) { threw = true; }
      log.push(!threw && ds.sil.a.length === 5 && ds.jr.done);
    });
    daily.__dev.scratch(V2, {sil: 'x', jr: {done: true, won: true}}, ds => { log.push(ds.sil.a.length === 0 && ds.jr.done && ds.jr.won && ds.jr.g.length === 0); });
    // ?day=N on a dev host must keep posting off even with ?post=1 (DEV_NO_POST is fixed at load).
    log.push(daily.DEV_DAY == null || daily.DEV_NO_POST === true);
    const bad = log.map((x, i) => x ? null : i + 1).filter(Boolean);
    return {pass: !bad.length, detail: bad.length ? 'failed steps ' + bad.join(', ') : `${log.length} steps ok (DEV_DAY ${daily.DEV_DAY}, DEV_NO_POST ${daily.DEV_NO_POST})`};
  });

  check('journeyPath() and journeyClues() on crafted v2 days', () => {
    needV2();
    const PP = daily.PP, PZ = daily.PZ, j = V2.j;
    const path = daily.journeyPath(V2);
    const teams = [...j.t].map(c => PZ.teams[daily.TA.indexOf(c)]);
    const n = PZ.N[j.p];
    const clues = daily.journeyClues(V2).map(x => x.join(': '));
    const want = [`Position: ${daily.POSN[PP[j.p][2]]}`, `Draft: ${n[0]}, round ${n[1]}`];
    // Fallbacks: a frozen j.d wins; else P's round with the first season; 'U' reads Undrafted.
    const alt = t => Object.assign({}, V2, {j: Object.assign({}, j, t)});
    const withD = daily.journeyClues(alt({d: [2019, 3]}))[1][1], undD = daily.journeyClues(alt({d: [null, 'U']}))[1][1];
    const pu = PP.findIndex((p, i) => p[3] === 'U' && !PZ.N[i]), pr = PP.findIndex((p, i) => /^\d+$/.test(p[3]) && !PZ.N[i] && p[5] >= 2015);
    const und = daily.journeyClues(alt({p: pu}))[1][1], rnd = daily.journeyClues(alt({p: pr}))[1][1];
    const kc = daily.journeyPath(alt({col: ['Wake Forest', 'Michigan State'], t: 'cP'}));
    const pass = !!path && path.teams.join() === teams.join() && path.current === teams[teams.length - 1] && path.colleges.join() === j.col.join()
      && clues.join('|') === want.join('|') && withD === '2019, round 3' && undD === 'Undrafted' && und === 'Undrafted'
      && rnd === `${PP[pr][4]}, round ${PP[pr][3]}`
      && kc.colleges.join() === 'Wake Forest,Michigan State' && kc.teams.join() === 'Seahawks,Chiefs' && kc.current === 'Chiefs'
      && daily.journeyHints({jr: {g: [1, 2, 3], done: true, won: false}}, V2).join('|') === want.join('|');
    return {pass, detail: `${path && path.colleges.join(' > ')} > ${teams.join(' > ')} (now ${path && path.current}); ${clues.join('; ')}; fallback ${rnd}`};
  });

  check('boardRows(): v2 day entries append faces and path; old-format entries do not count on a v2 day', () => {
    needDaily();
    // A five-puzzle day: today if it is one, else the first v2 day in the file.
    const P = daily.isV2() ? daily.PNUM : daily.PZ.days.findIndex(d => daily.isV2(d)) + 1;
    const players = [
      {id: 'v2-a', nick: 'Evan', days: {[P]: {p: 1180, g: 6, c: 4, w: 2, j: 1, s: 3}}, total: 1180, played: 1, last: P},
      {id: 'v2-b', nick: 'Mason', days: {[P]: {p: 380, g: 3, c: 2, w: 0, j: 0, s: 0}}, total: 380, played: 1, last: P},
      // Posted for the day's earlier three-puzzle version (Sep 29 was re-released as v2 mid-day): not on the board.
      {id: 'v1-c', nick: 'Zed', days: {[P]: {p: 620, g: 5, c: 3, w: 3}}, total: 620, played: 1, last: P}
    ];
    const got = daily.boardRows('today', players, P).map(r => r.id + '|' + r.sub + '|' + r.rank).join(';');
    const want = ['v2-a|College 4/5, faces 3/5, ID on clue 2, path on guess 1, grid 6/9|1',
      'v2-b|College 2/5, faces 0/5, no ID, no path, grid 3/9|2'].join(';');
    const stale = daily.entryFor(players[2], P) === null && daily.entryFor(players[0], P) === players[0].days[P];
    return {pass: P > 0 && got === want && stale, detail: `day ${P}: ${got}; old-format entry ignored: ${stale}`};
  });

  check('dayLabel(), dayFor() and the dev ?day= preview', () => {
    needDaily();
    const f = daily.__dev.devDayFrom;
    const parse = f('?day=3', 'localhost') === 3 && f('?day=3&x=1', '192.168.1.20') === 3 && f('?day=3', 'evanappenzeller-ui.github.io') === null
      && f('?day=0', 'localhost') === null && f('?day=abc', 'localhost') === null && f('?day=-2', 'localhost') === null && f('', 'localhost') === null;
    const labels = daily.dayLabel(1) === 'Mon, Sep 28' && daily.dayLabel(2) === 'Tue, Sep 29' && daily.dayLabel(3, {long: true}) === 'Wednesday, September 30'
      && daily.dayLabel(daily.PNUM, {long: true}) === daily.TODAY_LABEL && daily.dayLabel() === daily.dayLabel(daily.PNUM);
    const days = daily.dayFor(1) === daily.PZ.days[0] && daily.dayFor() === daily.DAY && daily.dayFor(daily.PZ.days.length + 1) === daily.PZ.days[0] && daily.dayFor(0) === null;
    // Without a preview the day follows the calendar; a preview pins it (no 'newday').
    const pinned = daily.DEV_DAY ? daily.PNUM === daily.DEV_DAY && daily.checkDay() === false : daily.DEV_DAY === null;
    return {pass: parse && labels && days && pinned, detail: `day 1 ${daily.dayLabel(1)}, today ${daily.dayLabel()} / ${daily.TODAY_LABEL}; DEV_DAY ${daily.DEV_DAY}`};
  });

  check('Grid examples prefer audience players, then non-specialists, then the most recognizable', () => {
    needDaily();
    const PP = daily.PP, aud = daily.isAudienceIdx, spec = i => ['K', 'P', 'LS', 'ST'].includes(PP[i][2]);
    // Today's grid plus a v2 day's (the ranking is the same on both versions).
    const v2 = daily.PZ.days.find(d => daily.isV2(d));
    const bad = [];
    let older = 0, specs = 0;
    const names = [];
    const days = [daily.DAY, v2].filter((D, k, a) => D && a.indexOf(D) === k);
    for (const D of days) {
      const ex = daily.examplesFor(new Set(), D);
      for (let k = 0; k < 9; k++) {
        const r = D.g[Math.floor(k / 3)], c = D.g[3 + (k % 3)];
        const fits = [];
        for (let i = 0; i < PP.length; i++) if (daily.critOk(r, PP[i]) && daily.critOk(c, PP[i])) fits.push(i);
        const best = fits.reduce((b, i) => b < 0 || daily.exampleRank(i) > daily.exampleRank(b) ? i : b, -1);
        if (ex[k] !== best || daily.exampleFor(r, c, new Set()) !== best) bad.push(`${D === daily.DAY ? 'today' : 'v2'} ${k}`);
        // the order's promises: an audience player whenever one fits; a non-specialist whenever an audience one fits
        if (best >= 0 && !aud(best) && fits.some(aud)) bad.push(`${k} not audience`);
        if (best >= 0 && spec(best) && fits.some(i => aud(i) && !spec(i))) bad.push(`${k} specialist`);
        if (best >= 0 && !aud(best)) older++;
        if (best >= 0 && spec(best)) specs++;
        if (D === daily.DAY) names.push(best >= 0 ? PP[best][0] : '-');
      }
    }
    return {pass: !bad.length, detail: bad.length ? 'squares differ: ' + bad.join(', ') : `${days.length * 9} squares agree (${older} pre-2010, ${specs} specialists): ${names.join(', ')}`};
  });

  check('puzzles.json: day 1 is v1, v2 entries are well-formed', () => {
    needDaily();
    const PZ = daily.PZ, PP = daily.PP, bad = [];
    let v2 = 0;
    // Day 1 stays v1 (people finished it); day 2 (Sep 29) was re-released as v2 mid-day.
    if (daily.isV2(PZ.days[0])) bad.push('day 1 must stay v1');
    PZ.days.forEach((d, i) => {
      if (!daily.isV2(d)) return;
      v2++;
      const at = `day ${i + 1}: `;
      if (!Array.isArray(d.g) || d.g.length !== 6) bad.push(at + 'g');
      if (!Array.isArray(d.c) || d.c.length !== 5 || d.c.some(c => !PP[c[0]] || c[1].length !== 4 || !(c[2] >= 0 && c[2] < 4))) bad.push(at + 'c');
      if (!PP[d.w] || !PZ.N[d.w]) bad.push(at + 'w');
      if (!d.j || !PP[d.j.p] || !Array.isArray(d.j.col) || !d.j.t || [...d.j.t].some(ch => daily.TA.indexOf(ch) < 0 || daily.TA.indexOf(ch) >= PZ.teams.length)) bad.push(at + 'j');
      if (!Array.isArray(d.s) || d.s.length !== 5 || d.s.some(s => !PP[s.p] || !Array.isArray(s.o) || s.o.length !== 4 || s.o[s.a] !== s.p || new Set(s.o).size !== 4 || s.o.some(o => !PP[o]))) bad.push(at + 's');
    });
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') + (bad.length > 6 ? ` (+${bad.length - 6})` : '') : `${PZ.days.length} days, ${v2} v2`};
  });

  // ---------------------------------------------------------------------------
  // fire.js and week.js (Matchup of the Week votes, pick'em). Pure functions on crafted docs: nothing is read
  // from or written to Firestore or the local stand-in.

  check('fire.js: one shared Firebase app; the dev write guard is unchanged', async () => {
    const same = fire.isDevHost === daily.isDevHost && daily.__dev.devDayFrom === fire.devDayFrom && daily.DEV_DAY === fire.DEV_DAY;
    const guard = fire.canWrite() === !daily.DEV_NO_POST && week.__dev.standIn() === !fire.canWrite();
    const st = ['idle', 'loading', 'ready', 'off'].includes(fire.status);
    let apps = 'not started';
    if (fire.status === 'loading' || fire.status === 'ready') {
      const p = fire.getFire();
      if (p !== fire.getFire()) return {pass: false, detail: 'getFire() made a second promise'};
      const F = await p;
      const {getApps} = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
      apps = getApps().length === 1 && getApps()[0] === F.app && F.uid === fire.uid && (!daily.LB.uid || daily.LB.uid === F.uid) ? 'one app' : `apps ${getApps().length}`;
    }
    const pass = same && guard && st && (apps === 'one app' || apps === 'not started' || fire.status === 'off');
    return {pass, detail: `status ${fire.status}, ${apps}, canWrite ${fire.canWrite()}, DEV_NO_POST ${daily.DEV_NO_POST}, stand-in ${week.__dev.standIn()}`};
  });

  check('weekKey(), parseKey() and game keys', () => {
    const k = week.weekKey(2026, 4), p = week.parseKey(k);
    const pass = k === '2026-w4' && week.weekKey(2027, 12) === '2027-w12' && p && p.year === 2026 && p.week === 4
      && week.parseKey('2026-w0') === null && week.parseKey('2026-w123') === null && week.parseKey('w4') === null && week.parseKey(null) === null
      && week.gameKey('jaymin', 'jayton') === 'jaymin|jayton' && week.samePair('a|b', 'b|a') && !week.samePair('a|b', 'a|c') && !week.samePair('a|a', 'a|a') && !week.samePair('a', 'a');
    return {pass, detail: `${k} -> ${JSON.stringify(p)}`};
  });

  check('lockTime(): Thursday 8:15 PM Eastern (EDT, then EST after Nov 1 2026); Thanksgiving 12:30 PM', () => {
    const iso = (y, w) => week.lockTime(y, w).toISOString();
    const want = {'2026/1': '2026-09-11T00:15:00.000Z', '2026/4': '2026-10-02T00:15:00.000Z', '2026/8': '2026-10-30T00:15:00.000Z',
      '2026/9': '2026-11-06T01:15:00.000Z', '2026/10': '2026-11-13T01:15:00.000Z', '2027/1': '2027-09-10T00:15:00.000Z',
      '2026/11': '2026-11-20T01:15:00.000Z', '2026/12': '2026-11-26T17:30:00.000Z', '2026/13': '2026-12-04T01:15:00.000Z', '2027/12': '2027-11-25T17:30:00.000Z'};
    const bad = Object.keys(want).filter(k => { const [y, w] = k.split('/').map(Number); return iso(y, w) !== want[k]; });
    const lock4 = Date.parse('2026-10-02T00:15:00Z');
    const edge = !week.isLocked(2026, 4, lock4 - 1) && week.isLocked(2026, 4, lock4) && week.isLocked(2026, 4, new Date(lock4 + 1));
    // Fallback kickoff: the Thursday after the first Monday of September (2026 agrees with the table).
    const fb = week.KICKOFF[2026] === '2026-09-10' && week.kickoff(2027) === '2027-09-09' && week.kickoff(2028) === '2028-09-07' && week.kickoff(2031) === '2031-09-04';
    const near = week.lockText(2026, 4, lock4 - 2 * 864e5), far = week.lockText(2026, 4, lock4 - 10 * 864e5);
    const text = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2}:\d{2} (AM|PM)$/.test(near) && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (Sep|Oct) \d{1,2}, \d{1,2}:\d{2} (AM|PM)$/.test(far);
    return {pass: !bad.length && edge && fb && text, detail: `${bad.length ? 'wrong: ' + bad.join(', ') + '; ' : ''}wk 4 ${iso(2026, 4)}, wk 10 ${iso(2026, 10)}; "${near}" / "${far}" local`};
  });

  // Three of the week-4 games, keys in schedule order.
  const G3 = [{a: 'evan', b: 'mitch'}, {a: 'john', b: 'sayer'}, {a: 'jaymin', b: 'jayton'}].map(g => Object.assign(g, {key: g.a + '|' + g.b}));

  check('tallyVotes() and leader(): counts, reversed keys, my vote, tie broken by hype order', () => {
    const docs = [
      {uid: 'u2', pick: 'mitch|evan', me: 'mason', nick: 'Mason', at: 2000},  // reversed key counts for evan|mitch
      {uid: 'u1', pick: 'evan|mitch', me: 'evan', nick: 'Evan', at: 1000},
      {uid: 'u3', pick: 'john|sayer', me: null, nick: 'Someone', at: {seconds: 3, nanoseconds: 0}},
      {uid: 'u4', pick: 'john|sayer', me: 'constructor', nick: 'X', at: 4000}, // unknown manager id -> me null
      {uid: 'u5', pick: 'ben|dresden', nick: 'Y', at: 5000},                    // not a game this week: dropped
      {uid: 'u6', pick: 5, nick: 'Z', at: 6000},                                // not a string: dropped
      {uid: 'u7', pick: 'jaymin|jayton', nick: 'W', at: 7000}
    ];
    const t = week.tallyVotes(docs, G3, 'u3');
    const tally = JSON.stringify(t.tally);
    const order = t.votes.map(v => v.uid).join();
    const L = week.leader;
    const lead = [
      L(t.tally, ['jaymin|jayton', 'john|sayer', 'evan|mitch']) === 'john|sayer',
      L(t.tally, ['mitch|evan', 'john|sayer']) === 'evan|mitch',                 // ranking keys in either order
      L(t.tally, [{a: 'sayer', b: 'john'}, {a: 'evan', b: 'mitch'}]) === 'john|sayer', // motw candidates
      L(t.tally, {list: [{a: 'evan', b: 'mitch'}]}) === 'evan|mitch',            // motw.candidates() result
      L({'evan|mitch': 1, 'john|sayer': 3, 'jaymin|jayton': 3}, ['jaymin|jayton']) === 'jaymin|jayton',
      L({'evan|mitch': 0, 'john|sayer': 0}, []) === null && L({}, []) === null,
      L({'evan|mitch': 2, 'john|sayer': 1}, []) === 'evan|mitch'
    ];
    const pass = tally === '{"evan|mitch":2,"john|sayer":2,"jaymin|jayton":1}' && t.total === 5 && order === 'u1,u2,u3,u4,u7'
      && t.mine && t.mine.pick === 'john|sayer' && t.mine.at === 3000 && t.votes[3].me === null && t.votes[0].me === 'evan'
      && week.tallyVotes(docs, G3, 'nobody').mine === null && lead.every(Boolean);
    return {pass, detail: `tally ${tally}, order ${order}, leader checks ${lead.map(x => x ? 'ok' : 'x').join(' ')}`};
  });

  check('tallyPicks(): normalized keys, invalid picks dropped, per-team counts', () => {
    const docs = [
      {uid: 'p1', picks: {'evan|mitch': 'evan', 'sayer|john': 'john', 'x|y': 'x', 'jaymin|jayton': 'mason'}, nick: 'A', at: 1},
      {uid: 'p2', picks: {'mitch|evan': 'mitch'}, me: 'mitch', nick: 'Mitch', at: 2},
      {uid: 'p3', picks: {}, nick: 'empty', at: 3},
      {uid: 'p4', picks: 'bad', nick: 'bad', at: 4}
    ];
    const t = week.tallyPicks(docs, G3, 'p2');
    const e = t.entries.map(x => x.uid + ':' + JSON.stringify(x.picks) + ':' + x.count).join(' ');
    const pass = e === 'p1:{"evan|mitch":"evan","john|sayer":"john"}:2 p2:{"evan|mitch":"mitch"}:1'
      && JSON.stringify(t.counts) === '{"evan|mitch":{"evan":1,"mitch":1},"john|sayer":{"john":1,"sayer":0},"jaymin|jayton":{"jaymin":0,"jayton":0}}'
      && t.mine && t.mine.uid === 'p2' && t.mine.me === 'mitch';
    return {pass, detail: e};
  });

  check('Tallies: server time after kickoff never counts; a manager on two phones counts once', () => {
    const lock = 10000;
    const votes = [
      {uid: 'a1', pick: 'evan|mitch', me: 'evan', nick: 'Evan', at: 1000},     // Evan, Safari
      {uid: 'a2', pick: 'john|sayer', me: 'evan', nick: 'Evan', at: 2000},     // Evan, home-screen app (latest wins)
      {uid: 'b1', pick: 'john|sayer', me: null, nick: 'Fan', at: 3000},
      {uid: 'c1', pick: 'evan|mitch', me: 'mason', nick: 'Mason', at: 10000},  // exactly at kickoff: too late
      {uid: 'd1', pick: 'evan|mitch', me: 'jacob', nick: 'Jacob', at: 99999},  // wrong clock, days later
      {uid: 'e1', pick: 'evan|mitch', me: 'ben', nick: 'Ben'}                  // no server time
    ];
    const t = week.tallyVotes(votes, G3, 'a1', {lock, me: 'evan'});
    const v = JSON.stringify(t.tally) === '{"evan|mitch":0,"john|sayer":2,"jaymin|jayton":0}' && t.total === 2
      && t.mine && t.mine.uid === 'a2' && week.tallyVotes(votes, G3, 'zz', {lock}).mine === null;
    const picks = [
      {uid: 'p1', picks: {'evan|mitch': 'evan'}, me: 'john', nick: 'John', at: 5000},
      {uid: 'p2', picks: {'evan|mitch': 'mitch', 'john|sayer': 'john'}, me: 'john', nick: 'John', at: 6000},
      {uid: 'p3', picks: {'evan|mitch': 'mitch'}, me: 'sayer', nick: 'Sayer', at: 20000}
    ];
    const p = week.tallyPicks(picks, G3, 'p1', {lock, me: 'john'});
    const pk = p.entries.length === 1 && p.entries[0].uid === 'p2' && p.mine === p.entries[0] && p.counts['evan|mitch'].mitch === 1;
    // Without a lock (crafted docs) nothing is filtered by time.
    const open = week.tallyVotes(votes, G3, 'a1').total === 5;
    return {pass: v && pk && open, detail: `votes ${JSON.stringify(t.tally)} (mine ${t.mine && t.mine.uid}), picks ${p.entries.map(e => e.uid).join()}, no lock ${week.tallyVotes(votes, G3, 'a1').total}`};
  });

  // Played, untied games of a 2026 week.
  const playedIn = w => data.GAMES.filter(g => g.year === 2026 && g.week === w && !g.tie);

  check('scoreWeek() on a crafted entry (2026 week 3 results)', () => {
    needData();
    const g = playedIn(3);
    if (g.length < 5) throw new Error('2026 week 3 has ' + g.length + ' decided games');
    const picks = {};
    picks[g[0].a + '|' + g[0].b] = g[0].win;          // right
    picks[g[0].b + '|' + g[0].a] = g[0].lose;         // same game again, reversed key: ignored
    picks[g[1].a + '|' + g[1].b] = g[1].lose;         // wrong
    picks[g[2].b + '|' + g[2].a] = g[2].win;          // right (reversed key)
    picks[g[3].a + '|' + g[3].b] = 'nobody';          // not one of the two teams: ignored
    picks[g[0].a + '|' + g[1].a] = g[0].a;            // not a game that week: ungraded
    const s = week.scoreWeek({picks}, 2026, 3);
    const none = week.scoreWeek(null, 2026, 3), future = week.scoreWeek({picks: {[g[0].a + '|' + g[0].b]: g[0].a}}, 2026, 30);
    const pass = s.right === 2 && s.graded === 3 && none.right === 0 && none.graded === 0 && future.graded === 0;
    return {pass, detail: `right ${s.right} of ${s.graded} graded (expected 2 of 3)`};
  });

  check('standingsFrom(): season pick\'em table, equal right shares a rank', () => {
    needData();
    const w1 = playedIn(1), w2 = playedIn(2);
    const all = (gs, pick) => Object.fromEntries(gs.map(g => [g.a + '|' + g.b, pick(g)]));
    const weeks = [
      {year: 2026, week: 1, entries: [
        {uid: 'A', picks: all(w1, g => g.win), me: 'evan', nick: 'Evan'},
        {uid: 'B', picks: all(w1, g => g.win), me: null, nick: 'Bee'},
        {uid: 'C', picks: all(w1, g => g.lose), me: 'mason', nick: 'Old name'}]},
      {year: 2026, week: 2, entries: [
        {uid: 'B', picks: all(w2, g => g.lose), me: null, nick: 'Bee'},
        {uid: 'C', picks: all(w2.slice(0, 3), g => g.win), me: 'mason', nick: 'Mason'},
        {uid: 'D', picks: all(w2.slice(0, 1), g => g.win), me: null, nick: 'Dee'},
        {uid: 'E', picks: {}, nick: 'nothing graded'}]}
    ];
    const n1 = w1.length, n2 = w2.length;
    const rows = week.standingsFrom(weeks, 'C');
    const got = rows.map(r => `${r.uid}:${r.right}/${r.graded}:${r.weeks}:#${r.rank}`).join(' ');
    const want = `A:${n1}/${n1}:1:#1 B:${n1}/${n1 + n2}:2:#1 C:3/${n1 + 3}:2:#3 D:1/1:1:#4`;
    const c = rows.find(r => r.uid === 'C'), d = rows.find(r => r.uid === 'D');
    // games: every decided game of the weeks entered (a skipped game is a miss): D picked 1 of week 2's games.
    const games = c.games === n1 + n2 && d.games === n2 && Math.abs(d.pct - 1 / n2) < 1e-9;
    const pass = got === want && games && c.you && c.nick === 'Mason' && c.me === 'mason' && rows.filter(r => r.you).length === 1;
    return {pass, detail: got};
  });

  check('current(): the week from motw.upcoming(); hype replay equals motw.candidates()', () => {
    needData();
    const up = motw.upcoming(), cur = week.current();
    if (!up) return {pass: cur === null, detail: 'no upcoming week'};
    const lock = week.lockTime(up.year, up.week);
    const shape = cur && cur.year === up.year && cur.week === up.week && cur.key === week.weekKey(up.year, up.week) && cur.played === up.played
      && cur.games.map(g => g.key).join() === up.games.map(g => g.a + '|' + g.b).join() && cur.games.every(g => g.key === g.a + '|' + g.b)
      && cur.lock.getTime() === lock.getTime() && cur.locked === week.isLocked(up.year, up.week)
      && week.current(lock.getTime() - 1).locked === false && week.current(lock.getTime()).locked === true;
    const c = motw.candidates('overall');
    const rep = week.hypeReplay(cur.year, cur.week);
    const same = c.list.length === rep.length && c.list.every((x, i) => x.a + '|' + x.b === rep[i].key && x.scores.overall === rep[i].overall);
    const rank = week.ranking(cur.year, cur.week).join() === rep.map(x => x.key).join();
    // A played week replays from the games before it (2026 week 3: six games, standings after week 2).
    const past = week.hypeReplay(2026, 3);
    const pass = shape && same && rank && past.length === 6 && past.every(x => isFinite(x.overall));
    return {pass, detail: `${cur.key}, ${cur.games.length} games, locks ${lock.toISOString()} (${cur.locked ? 'locked' : 'open'}); replay ${same ? 'matches' : 'differs from'} motw: ${rep.map(x => x.key + ' ' + x.overall.toFixed(1)).join(', ')}`};
  });

  check('records() and resultOf(): Matchup of the Week results', () => {
    needData();
    const g = playedIn(3);
    const k0 = g[0].b + '|' + g[0].a;                  // reversed: the result follows the key's order
    const r = week.resultOf(2026, 3, k0);
    const res = r && r.a === g[0].b && r.b === g[0].a && r.sa === g[0].sb && r.sb === g[0].sa && r.winner === g[0].win
      && week.resultOf(2026, 30, k0) === null && week.resultOf(2026, 3, 'bad') === null;
    const hist = [
      {a: g[0].a, b: g[0].b, result: week.resultOf(2026, 3, g[0].a + '|' + g[0].b)},
      {a: 'x1', b: 'x2', result: {a: 'x1', b: 'x2', sa: 100, sb: 100, winner: null}},
      {a: g[1].a, b: g[1].b, result: null}
    ];
    const rec = week.records(hist);
    const w = rec[g[0].win], l = rec[g[0].lose];
    const pass = res && w.w === 1 && w.n >= 1 && l.l === 1 && rec.x1.t === 1 && rec.x2.t === 1 && rec[g[1].a].n === 1 && rec[g[1].a].w === 0;
    return {pass, detail: `${k0}: ${r && r.sa}-${r && r.sb}, winner ${r && r.winner}`};
  });

  // ---------------------------------------------------------------------------
  // Stats checks (js/core/checks-stats.js, owned by the stats module). Guarded: a missing or broken module
  // shows up as one failing row instead of stopping the other checks.
  let statsMod = null, statsErr = null;
  try { statsMod = await import('./checks-stats.js'); } catch (e) { statsErr = e; }
  if (statsMod && typeof statsMod.statsChecks === 'function') {
    try { await statsMod.statsChecks(check); } catch (e) { check('Stats checks (checks-stats.js)', () => { throw e; }); }
  } else {
    check('Stats checks (checks-stats.js) loaded', () => ({pass: false, detail: statsErr ? 'did not load: ' + (statsErr.message || statsErr) : 'no statsChecks export'}));
  }

  await Promise.all(pending);
  return out;
}
