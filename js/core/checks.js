// Core checks for the dev gallery (#/_kit). Each check compares the new core modules
// against a copy of the old single-file app's formulas, or against a hand-computed value.
// Nothing here writes to storage or to the league board.
// Owner: foundation (core).

import * as data from './data.js';
import * as daily from './daily.js';

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

function oldShareText(DS, DAY, leagueName) {
  const nf = n => Number(n).toLocaleString('en-US');
  const {totalPts, colDone, whoDone, gridDone, gridScore} = oldScoring(DS, DAY);
  const lines = [`${leagueName} daily, ${new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}: ${nf(totalPts())} pts`];
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
  const check = (name, fn) => {
    try {
      const r = fn();
      const pass = r === true || (r && r.pass === true);
      out.push({name, pass, detail: (r && r.detail) || (pass ? 'ok' : 'mismatch')});
    } catch (e) {
      out.push({name, pass: false, detail: 'threw: ' + (e && e.message || e)});
    }
  };

  let dataErr = null, dailyErr = null;
  try { await data.load(); } catch (e) { dataErr = e; }
  try { await daily.ensure(); } catch (e) { dailyErr = e; }
  const needDaily = () => { if (dailyErr) throw new Error('puzzles did not load: ' + (dailyErr.message || dailyErr)); };
  const needData = () => { if (dataErr) throw new Error('league did not load: ' + (dataErr.message || dataErr)); };

  // 1. PNUM, dayIndex and DAY match the old formula
  check('PNUM, dayIndex and DAY match the old formula', () => {
    needDaily();
    const PZ = daily.PZ, idx = oldDayIndex(PZ);
    const pass = daily.dayIndex === idx && daily.PNUM === idx + 1 && daily.DAY === PZ.days[idx % PZ.days.length];
    return {pass, detail: `dayIndex ${daily.dayIndex} (old ${idx}), PNUM ${daily.PNUM}, DAY is days[${idx % PZ.days.length}]: ${daily.DAY === PZ.days[idx % PZ.days.length]}`};
  });

  // 2. SKEY
  check("SKEY === 'gg-daily-' + PNUM", () => {
    needDaily();
    return {pass: daily.SKEY === 'gg-daily-' + daily.PNUM, detail: daily.SKEY};
  });

  // 3. totalPts for a crafted DS equals the hand-computed value
  check('totalPts() for a crafted DS equals the hand-computed value', () => {
    needDaily();
    const ds = craftDS(daily.DAY), ds2 = craftDS2(daily.DAY);
    const a = daily.totalPts(ds), b = daily.totalPts(ds2);
    const oldA = oldScoring(ds, daily.DAY).totalPts(), oldB = oldScoring(ds2, daily.DAY).totalPts();
    const steps = daily.STEPS.map(s => s.result(ds)).join(' | ');
    const pass = a === 620 && b === 530 && oldA === 620 && oldB === 530
      && steps === '3 of 5 | Clue 3 of 7 | 5 of 9'
      && daily.allDone(ds) && !daily.allDone(ds2) && daily.firstOpen(ds2) === 0;
    return {pass, detail: `crafted ${a} (expected 620), second ${b} (expected 530); steps "${steps}"`};
  });

  // 4. shareText for a crafted DS matches the old function
  check("shareText() for a crafted DS matches the old function's output", () => {
    needDaily(); needData();
    const L = data.DATA.league.name;
    const ds = craftDS(daily.DAY), ds2 = craftDS2(daily.DAY);
    const a = daily.shareText(ds), b = daily.shareText(ds2);
    const oa = oldShareText(ds, daily.DAY, L), ob = oldShareText(ds2, daily.DAY, L);
    return {pass: a === oa && b === ob && a.split('\n').length === 7, detail: JSON.stringify(a)};
  });

  // 5. boardRows('today') sub strings match the old leaderboardHTML format
  check("boardRows('today') sub strings, sort and ranks match the old leaderboard", () => {
    needDaily();
    const P = daily.PNUM, players = fakePlayers(P);
    const mine = daily.boardRows('today', players).map(r => ({id: r.id, name: r.name, pts: r.pts, sub: r.sub, rank: r.rank, me: r.me}));
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
    const g = [1000, 999, 850, 849, 650, 450, 250, 249, 0].map(daily.gradeFor).join(',');
    return {pass: g === 'PERFECT DAY,ALL-PRO,ALL-PRO,PRO BOWL,PRO BOWL,STARTER,PRACTICE SQUAD,CUT DAY,CUT DAY', detail: g};
  });

  check('Dev guard: no league-board writes from dev hosts without ?post=1', () => {
    // Dev hosts: loopback, *.localhost/.test/.local, private LAN IPs (a phone on the dev server). Exactly post=1 opts in.
    const samples = {'localhost': true, '127.0.0.1': true, '[::1]': true, 'gg.test': true, '192.168.1.20': true, '10.0.0.7': true, '172.20.1.1': true,
      'evanappenzeller-ui.github.io': false, '172.32.0.1': false, '8.8.8.8': false, 'localhost.example.com': false};
    const bad = Object.entries(samples).filter(([h, want]) => daily.isDevHost(h) !== want).map(([h]) => h);
    let post = false;
    try { post = new URLSearchParams(location.search).get('post') === '1'; } catch (_) {}
    const local = daily.isDevHost(location.hostname) && !post;
    const pass = !bad.length && daily.DEV_NO_POST === local && (!local || daily.LB.save === null);
    return {pass, detail: `${bad.length ? 'misclassified ' + bad.join(', ') + '; ' : ''}local ${local}, DEV_NO_POST ${daily.DEV_NO_POST}, LB.save ${daily.LB.save ? 'assigned' : 'unassigned'}, uid ${daily.LB.uid ? 'signed in' : 'none yet'}`};
  });

  return out;
}
