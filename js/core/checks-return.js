// Return Man checks for the dev gallery (#/_kit): the day's courses (core/return.js: the same on every phone, one man a
// row at first, fuller and quicker as the yards go, always a way through), the moves (a juke a lane over, a hurdle over
// a dive, a spin out of a wrap-up, a wedge only juked round) and what ends a return, the speed and the touchdowns, a
// day's numbers, and the league scoreboard's rows (on crafted board docs), which read the board as this phone may see
// it (THE RULE, CLAUDE.md). checks.js (owner: core) imports returnChecks and calls it with its own check(name, fn)
// helper; every fn returns true or {pass, detail}. Nothing here writes to storage or the database. Owner: RETURN.

import * as R from './return.js';
import * as daily from './daily.js';
import {gameFor} from '../views/puzzles.js';

/** A returner who sees the course: to the lane he can get through (the open one nearest, else a man he can beat) and
 *  his move just in time. Runs till tackled or to maxZ yards. */
function bot(n, k, maxZ) {
  const run = R.startRun(n, k), dt = 1 / 60;
  for (let i = 0; i < 60 * 900 && !run.over && run.z < maxZ; i++) {
    const row = R.rowsTo(run.co, run.c + 60)[run.next];
    if (row) {
      const tt = (row.c - run.c) / (R.speedAt(run.z) + R.VD);
      const want = [0, 1, 2].map(l => ({l, t: row.lanes[l], cost: Math.abs(l - run.lane) + (row.lanes[l] ? .5 : 0)}))
        .filter(o => o.t !== 'wedge').sort((a, b) => a.cost - b.cost)[0];
      if (want.l !== run.lane && run.jt >= 1) R.move(run, want.l < run.lane ? 'left' : 'right');
      if (want.t === 'diver' && run.air <= 0 && tt < .3) R.move(run, 'up');
      if (want.t === 'wrap' && run.spin <= 0 && tt < .25) R.move(run, 'down');
    }
    R.step(run, dt);
  }
  return run;
}
/** Runs a return straight at a row (lanes as given) with one move made t seconds before it: what happens there. */
function meet(lanes, move, t = .15, lane = 1) {
  const run = R.startRun(1, 0);
  run.co = {n: 0, k: 0, rows: [{i: 0, c: 30, lanes}], r: () => 0, at: 1e9, z: 0};
  run.lane = lane; run.x = R.xOf(run, lane);
  let out = null, moved = !move;
  for (let i = 0; i < 2000 && !out; i++) {
    const left = (30 - run.c) / (R.speedAt(run.z) + R.VD);
    if (!moved && left <= t) { R.move(run, move); moved = true; }
    const ev = R.step(run, 1 / 120).find(e => e.type !== 'td');
    if (ev) out = ev.type;
  }
  return out;
}

export async function returnChecks(check) {
  // ------------------------------------------------------------------------------------------- the course
  check('Return Man: day 1 is Oct 20 2026; a day\'s three kickoffs are the same every time (the same on every phone) and differ kickoff to kickoff and day to day; a wedge (go round it) is all you meet for the first 40 yards, one man a row till 60; every row leaves a way through (never three wedges); the rows come no closer than GAP.min seconds apart', () => {
    const day1 = R.todayNumber(new Date(2026, 9, 20, 9)) === 1 && R.todayNumber(new Date(2026, 9, 21, 1)) === 2 && R.dayLabel(1, {month: 'short', day: 'numeric'}) === 'Oct 20';
    const sig = (n, k) => JSON.stringify(R.rowsTo(R.course(n, k), 600).slice(0, 25).map(r => [r.c, r.lanes]));
    const same = sig(3, 1) === sig(3, 1), differ = sig(3, 0) !== sig(3, 1) && sig(3, 1) !== sig(4, 1);
    const bad = [];
    let minT = Infinity;
    for (let n = 1; n <= 8; n++) for (let k = 0; k < R.RETURNS; k++) {
      const co = R.course(n, k), rows = R.rowsTo(co, 3000);
      let z = 0;
      rows.forEach((r, i) => {
        const men = r.lanes.filter(Boolean);
        if (!men.length) bad.push(`day ${n}/${k} row ${i} empty`);
        if (r.lanes.every(t => t === 'wedge')) bad.push(`day ${n}/${k} row ${i} no way through`);
        if (i) {
          const gap = r.c - rows[i - 1].c, v = R.speedAt(z), t = gap / (v + R.VD);
          z += gap * v / (v + R.VD);
          minT = Math.min(minT, t);
        }
        if (z < 40 && men.some(t => t !== 'wedge')) bad.push(`day ${n}/${k} row ${i}: a ${men.join('/')} at ${Math.round(z)} yds`);
        if (z < 60 && men.length > 1) bad.push(`day ${n}/${k} row ${i}: ${men.length} men at ${Math.round(z)} yds`);
      });
    }
    const pass = day1 && same && differ && !bad.length && minT >= R.GAP.min - .01;
    return {pass, detail: `day 1 ${day1}; same ${same}, differ ${differ}; closest rows ${minT.toFixed(2)} s; ${bad.length ? bad.slice(0, 4).join('; ') : 'every row has a way through'}`};
  });
  check('Return Man: every kickoff can be run back forever: a returner who reads it right gets 1,500 yards on all three kickoffs of days 1-5; standing still, he\'s down inside the first 200', () => {
    const out = [], down = [];
    for (let n = 1; n <= 5; n++) for (let k = 0; k < R.RETURNS; k++) {
      const b = bot(n, k, 1500);
      if (b.over) out.push(`day ${n}/${k} down at ${Math.round(b.z)} (${b.why})`);
      const idle = R.startRun(n, k);
      for (let i = 0; i < 60 * 60 && !idle.over; i++) R.step(idle, 1 / 60);
      down.push(idle.over ? Math.round(idle.z) : 9999);
    }
    const pass = !out.length && down.every(z => z < 200);
    return {pass, detail: out.length ? out.join('; ') : `15 kickoffs to 1,500 yards; standing still, down at ${down.join(', ')}`};
  });
  check('Return Man: the rows fill up and come quicker with the yards: early on one man a row and about 1.3 seconds apart; past 450 yards mostly two or three men and well under a second', () => {
    const early = [], late = [];
    for (let n = 1; n <= 6; n++) {
      const rows = R.rowsTo(R.course(n, 0), 2500);
      let z = 0;
      rows.forEach((r, i) => {
        if (i) { const v = R.speedAt(z), gap = r.c - rows[i - 1].c; z += gap * v / (v + R.VD); (z < 60 ? early : z > 450 ? late : []).push({men: r.lanes.filter(Boolean).length, t: gap / (v + R.VD)}); }
      });
    }
    const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
    const eMen = avg(early, x => x.men), lMen = avg(late, x => x.men), eT = avg(early, x => x.t), lT = avg(late, x => x.t);
    const pass = eMen === 1 && lMen > 1.8 && eT > 1.2 && lT < .95;
    return {pass, detail: `first 60 yds: ${eMen.toFixed(2)} men a row, ${eT.toFixed(2)} s apart; past 450: ${lMen.toFixed(2)} men, ${lT.toFixed(2)} s`};
  });
  // ------------------------------------------------------------------------------------------- the moves
  check('Return Man: the moves: a juke takes him a lane over (not off the field); a hurdle beats a man diving at his legs, a spin a wrap-up, and neither beats the other or a wedge; doing nothing in a man\'s lane ends it; leaving his lane late is a juke', () => {
    const lanes = t => [null, t, null];
    const r = {
      dive: [meet(lanes('diver'), 'up'), meet(lanes('diver'), 'down'), meet(lanes('diver'), null)],
      wrap: [meet(lanes('wrap'), 'down'), meet(lanes('wrap'), 'up'), meet(lanes('wrap'), null)],
      wedge: [meet(lanes('wedge'), 'up'), meet(lanes('wedge'), 'down'), meet(lanes('wedge'), 'left', .25)],
      empty: meet([null, null, null], null),
      early: meet(lanes('diver'), 'up', 1.2)
    };
    const edge = R.startRun(1, 0);
    edge.lane = 0;
    const walls = !R.move(edge, 'left') && R.move(edge, 'right') && edge.lane === 1;
    const want = 'hurdled,tackled,tackled|spun,tackled,tackled|tackled,tackled,juked|passed|tackled';
    const got = [r.dive.join(), r.wrap.join(), r.wedge.join(), r.empty, r.early].join('|');
    return {pass: got === want && walls, detail: `dive: ${r.dive.join(', ')}; wrap: ${r.wrap.join(', ')}; wedge: ${r.wedge.join(', ')}; an empty row ${r.empty}; a hurdle a second early ${r.early}; the edge ${walls}`};
  });
  check('Return Man: speed and touchdowns: from a jog (9.5 yards a second) to a sprint (19) by about a thousand yards; a touchdown at 100, then every 110 (an end zone and a field); where a return ends reads like a field ("your own 34", "the 50", "their 23", "the end zone")', () => {
    const v = [0, 100, 400, 1000, 5000].map(z => R.speedAt(z));
    const speed = v[0] === 9.5 && v[1] > 11 && v[2] > 15 && v[3] > 18 && v[4] <= 19 && v.every((x, i) => !i || x > v[i - 1] || x === 19);
    const tds = [0, 99, 100, 209, 210, 330, 1000].map(R.tdsAt).join();
    const spots = [0, 34, 50, 77, 99, 104, 144, 160].map(R.spotOf).join(' | ');
    const pass = speed && tds === '0,0,1,1,2,3,9' && spots === 'your own 1 | your own 34 | the 50 | their 23 | their 1 | the end zone | your own 34 | the 50';
    return {pass, detail: `speed ${v.map(x => x.toFixed(1)).join(', ')}; TDs ${tds}; ${spots}`};
  });
  // ------------------------------------------------------------------------------------------- a day
  check('Return Man: a day is three returns and all their yards count (the longest and the touchdowns go with it); it counts once all three are run; bad yards are left out', () => {
    const s = R.score([174, 312, 45]);
    const off = R.officialOf({r: [174, 312, 45], at: 9}), part = R.officialOf({r: [174, 312]}), bad = R.officialOf({r: [174, -5, 'x', 312, 45]});
    const pass = s.yards === 531 && s.longest === 312 && s.tds === 3 && off && off.yards === 531 && off.at === 9 && part === null && bad && bad.yards === 531;
    return {pass, detail: `${s.yards} yards, longest ${s.longest}, ${s.tds} TDs; two returns: ${part}; with junk in it: ${bad && bad.yards}`};
  });
  check('Return Man: no Play again (the owner tests with Test play): no restart; a return left under way counts where it got to (keepLive/settle), so no kickoff is run twice', () => {
    const gone = !('restart' in R) && !('canReplay' in R) && !('restartDay' in R);
    const kept = typeof R.keepLive === 'function' && typeof R.settle === 'function' && typeof R.live === 'function' && typeof R.setTest === 'function';
    return {pass: gone && kept, detail: `restart gone ${gone}; a left return counts ${kept}`};
  });
  // ------------------------------------------------------------------------------------------- the scoreboard
  const doc = (id, nick, rm, extra = {}) => Object.assign({id, nick, total: 0, last: 1, rm1: rm}, extra);
  const e = (y, l, td, t) => ({y, l, td, t});
  check('Return Man: the scoreboard ranks the day by yards, then the longest return, then touchdowns (ties share a rank); a member on two phones is one row, their first finished day; bad entries are left out', () => {
    const docs = [
      doc('rm-a', 'Mason', {1: e(400, 210, 2, 50)}),
      doc('rm-b', 'Jacob', {1: e(400, 250, 2, 40)}),
      doc('rm-c', 'Tommy', {1: e(400, 250, 2, 60)}),
      doc('rm-d', 'Evan', {1: e(612, 300, 3, 70)}),
      doc('rm-e', 'Mason', {1: e(90, 40, 0, 10)}, {last: 2}),
      doc('rm-f', 'Dresden', {1: {y: 50, l: 80, td: 0, t: 1}}),
      doc('rm-g', 'John', {2: e(300, 120, 1, 5)})
    ];
    const rows = R.boardRows(1, docs), sig = rows.map(r => `${r.rank}.${r.name.split(' ')[0]} ${r.y}/${r.l}`).join(', ');
    return {pass: sig === '1.Evan 612/300, 2.Jacob 400/250, 2.Tommy 400/250, 4.Mason 90/40', detail: sig};
  });
  check('Return Man: the week (Tuesday to Monday) adds up each person\'s yards over its days, then the longest; last week\'s days don\'t count', () => {
    // day 1 (Oct 20 2026) is a Tuesday: days 1-7 are a week, day 8 starts the next
    const wd = R.weekDays(1, 8).join() === '1,2,3,4,5,6,7' && R.weekDays(8, 8).join() === '8' && R.weekDays(3, 3).join() === '1,2,3';
    const docs = [
      doc('rw-a', 'Mason', {6: e(200, 100, 1, 1), 7: e(150, 90, 0, 2)}),
      doc('rw-b', 'Jacob', {7: e(300, 160, 1, 2)}),
      doc('rw-c', 'Tommy', {8: e(900, 400, 4, 1)})
    ];
    const rows = R.weekRows(7, docs, 8), sig = rows.map(r => `${r.rank}.${r.name.split(' ')[0]} ${r.y}/${r.l}/${r.played}`).join(', ');
    return {pass: wd && sig === '1.Mason 350/100/2, 2.Jacob 300/160/1', detail: `days ${wd}; ${sig}`};
  });
  check('Return Man: THE RULE (CLAUDE.md): the scoreboard reads the board as this phone may see it (daily.LB.raw), never every doc: a guest on the board only on their own phones and the league owner\'s; Ryan D for everyone', async () => {
    const LB = daily.LB, raw = LB.raw, all = LB.all, players = LB.players;
    const member = doc('rr-m', 'Mason', {1: e(300, 150, 1, 1)}), guest = doc('rr-g', 'Zed Q', {1: e(900, 500, 4, 1)}, {g: true});
    const ryanD = doc('rr-d', 'Ryan Dow', {1: e(200, 90, 0, 1)});
    let out;
    try {
      LB.all = [member, guest, ryanD];
      LB.raw = LB.all.filter(p => daily.boardShows(p, false)); // a league phone's board
      LB.players = LB.raw;
      const rows = R.boardRows(1), week = R.weekRows(1, undefined, 1);
      out = {rows: rows.map(r => r.name).join(), week: week.map(r => r.name).join(), shown: daily.boardShows(guest, false), owner: daily.boardShows(guest, true), ryan: rows.some(r => r.name === 'Ryan D')};
    } finally { LB.raw = raw; LB.all = all; LB.players = players; }
    const files = ['./return.js', '../views/return.js'];
    const srcs = await Promise.all(files.map(f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '')));
    const reads = srcs.map((s, i) => (s && !s.split('\n').some(l => /LB\.all\b/.test(l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))) ? '' : files[i])).filter(Boolean);
    const pass = !out.shown && out.owner && !/Zed/.test(out.rows) && !/Zed/.test(out.week) && out.ryan && /Mason/.test(out.rows) && !reads.length;
    return {pass, detail: `rows ${out.rows}; week ${out.week}; guest shown ${out.shown} (on the owner's phone ${out.owner}); ${reads.length ? 'reads LB.all: ' + reads.join() : 'no LB.all reads'}`};
  });
  check('Return Man is everyone\'s: /puzzles/return opens its page on any phone', () => {
    const g = gameFor('return');
    return {pass: g === 'return', detail: `gameFor('return') ${g}`};
  });
  check('Return Man: its stylesheet (css/views/return.css) is linked: the version mark is on :root', () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--rm-css').trim();
    return {pass: v !== '', detail: `--rm-css ${v || 'missing'}`};
  });
}
