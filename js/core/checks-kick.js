// Kick It checks for the dev gallery (#/_kit): the day's kicks (core/kick.js: the same on every phone, longer, wider
// and windier as the run goes), the kick's physics and its calls (good, wide, off an upright or the bar, short; the
// wind's push), the flick read as a kick, a run's numbers, and the league scoreboard's rows (on crafted board docs),
// which read the board as this phone may see it (THE RULE, CLAUDE.md). checks.js (owner: core) imports kickChecks and
// calls it with its own check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here writes to storage
// or the database. Owner: KICK.

import * as K from './kick.js';
import * as daily from './daily.js';

const calm = (d, gx = 0) => ({i: 0, d, gx, w: 0, dir: 0});
const straight = (k, v = 30) => K.fly(k, {theta: Math.atan(k.gx / k.d), v});
/** The leg (yards a second) that puts the ball at height y over the bar's plane (bisection; the kick straight). */
function legFor(k, y) {
  let lo = 14, hi = 33;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, c = straight(k, mid);
    if (c.at && c.at.y >= y) hi = mid; else lo = mid;
  }
  return hi;
}

export async function kickChecks(check) {
  // 1. The day's kicks
  check('Kick It: day 1 is Oct 18 2026; a day\'s 40 kicks are the same every time (the same on every phone) and differ day to day; distances 18-62 yards, the first three chip shots near the middle, the posts wandering further off and the kicks getting longer and windier as the run goes; wind 0-24 mph, any heading', () => {
    const one = K.todayNumber(new Date(2026, 9, 18, 9)) === 1 && K.todayNumber(new Date(2026, 9, 19, 23, 59)) === 2 && K.todayNumber(new Date(2026, 9, 1)) === 1
      && K.dateOf(3).getDate() === 20;
    const a = K.kicks(5), b = K.kicks(5), c = K.kicks(6);
    const same = JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && a.length === K.MAX_KICKS;
    let shape = true;
    const bad = [];
    for (let n = 1; n <= 40; n++) {
      const ks = K.kicks(n);
      ks.forEach((k, i) => {
        const ok = k.i === i && Number.isInteger(k.d) && k.d >= 18 && k.d <= 62 && Math.abs(k.gx) <= Math.min(17, 3 + i * .9) + 1e-9
          && Number.isInteger(k.w) && k.w >= 0 && k.w <= 24 && k.dir >= 0 && k.dir <= 360;
        if (!ok && bad.length < 3) bad.push(`day ${n} kick ${i}: ${JSON.stringify(k)}`);
        shape = shape && ok;
      });
      shape = shape && ks.slice(0, 3).every(k => k.d <= 29 && Math.abs(k.gx) <= 5);
    }
    const avg = (n, from, to, f) => { let s = 0, m = 0; for (let d = 1; d <= n; d++) K.kicks(d).slice(from, to).forEach(k => { s += f(k); m++; }); return s / m; };
    const grows = avg(30, 25, 40, k => k.d) > avg(30, 0, 10, k => k.d) + 20 && avg(30, 25, 40, k => k.w) > avg(30, 0, 10, k => k.w) * 2
      && avg(30, 25, 40, k => Math.abs(k.gx)) > avg(30, 0, 10, k => Math.abs(k.gx)) * 2;
    const pass = one && same && shape && grows;
    return {pass, detail: `days ${one}; same ${same}; in range ${shape}${bad.length ? ' (' + bad.join('; ') + ')' : ''}; harder later ${grows}`};
  });

  // 2. The kick
  check('Kick It: a kick at the posts with a strong leg is good, a weak one short; aimed off it goes wide on that side; one that meets an upright is off the upright, one that just clips the bar is off the crossbar; a good kick is called as it crosses the bar', () => {
    const k30 = calm(30), good = straight(k30), weak = straight(k30, 14);
    const off = K.fly(k30, {theta: .2, v: 30}), offL = K.fly(k30, {theta: -.2, v: 30});
    const post = K.fly(k30, {theta: Math.atan(K.POST.half / 30), v: 30});
    const vBar = legFor(k30, K.POST.bar - .12), bar = straight(k30, vBar), justOver = straight(k30, legFor(k30, K.POST.bar + .05));
    const k45 = calm(45, -9), angled = straight(k45, 31);
    const pass = good.made && good.why === 'good' && good.tCross > 0 && good.at.y >= K.POST.bar && good.tEnd > good.tCross
      && !weak.made && weak.why === 'short' && off.why === 'wide-r' && offL.why === 'wide-l' && post.why === 'post'
      && bar.why === 'bar' && justOver.made && angled.made
      && Math.abs(good.pos(good.tCross).z - 30) < 1e-6 && good.pos(0).y === 0;
    return {pass, detail: `good ${good.why} (${good.at && good.at.y.toFixed(1)} yds up), weak ${weak.why}, right ${off.why}, left ${offL.why}, upright ${post.why}, bar ${bar.why}, just over ${justOver.why}, 45 from the left hash ${angled.why}`};
  });
  check('Kick It: the wind carries the ball: 20 mph across blows a straight 40-yarder wide its way (about 5 yards at full leg), aiming into it makes it good; a tailwind carries a kick that falls short in calm air over the bar, a headwind knocks a good one down', () => {
    const k = (w, dir) => ({i: 0, d: 40, gx: 0, w, dir});
    const toR = straight(k(20, 90)), toL = straight(k(20, 270));
    const drift = toR.at ? toR.at.x : 0;
    const into = K.fly(k(20, 90), {theta: -Math.atan(drift / 40), v: 30});
    const vShort = legFor(calm(40), K.POST.bar) - .6, calmShort = straight(calm(40), vShort);
    const tail = straight(k(20, 0), vShort), head = straight(k(20, 180), vShort + 1.2), calmOk = straight(calm(40), vShort + 1.2);
    const pass = toR.why === 'wide-r' && toL.why === 'wide-l' && drift > 4 && drift < 6.5 && into.made
      && calmShort.why === 'short' && tail.made && calmOk.made && !head.made;
    return {pass, detail: `across to the right ${toR.why} (${drift.toFixed(2)} yds), to the left ${toL.why}, aimed into it ${into.why}; leg ${vShort.toFixed(1)}: calm ${calmShort.why}, tailwind ${tail.why}; a little more: calm ${calmOk.why}, headwind ${head.why}`};
  });
  check('Kick It: a flick reads as a kick: one that doesn\'t go up the screen isn\'t one; straight up goes straight, to the right goes right; a faster flick is a stronger leg (14-33 yards a second); the screen\'s aim through the crossbar is used when given', () => {
    const none = K.launchOf({dx: 0, dy: 30, speed: 2}) === null && K.launchOf({dx: 40, dy: -10, speed: 2}) === null;
    const up = K.launchOf({dx: 0, dy: -200, speed: 1}), right = K.launchOf({dx: 60, dy: -200, speed: 1}), left = K.launchOf({dx: -60, dy: -200, speed: 1});
    const slow = K.launchOf({dx: 0, dy: -200, speed: .05}), fast = K.launchOf({dx: 0, dy: -200, speed: 9}), mid = K.launchOf({dx: 0, dy: -200, speed: 1.2});
    const aimed = K.launchOf({dx: 999, dy: -200, speed: 1, aim: .1});
    const pass = none && up.theta === 0 && right.theta > 0 && left.theta < 0 && Math.abs(right.theta + left.theta) < 1e-9
      && slow.v === 14 && fast.v === 33 && mid.v > slow.v && mid.v < fast.v && Math.abs(aimed.theta - Math.atan(.1)) < 1e-9;
    return {pass, detail: `not a kick ${none}; straight ${up.theta}, right ${right.theta.toFixed(3)}, left ${left.theta.toFixed(3)}; legs ${slow.v}/${mid.v.toFixed(1)}/${fast.v}; aim ${aimed.theta.toFixed(3)}`};
  });

  // 3. A run's numbers
  check('Kick It: a run\'s numbers count the made kicks, the misses (three end it), the longest and the yards made', () => {
    const s = K.score([['good', 20], ['short', 30], ['good', 45], ['wide-l', 50], ['post', 52]]), z = K.score([]);
    const pass = s.made === 2 && s.missed === 3 && s.longest === 45 && s.yards === 65 && K.STRIKES === 3 && z.made === 0 && z.longest === 0
      && Object.keys(K.CALLS).join() === 'good,wide-l,wide-r,post,bar,short';
    return {pass, detail: JSON.stringify(s)};
  });

  // 4. The scoreboard
  const doc = (id, nick, kk, extra = {}) => Object.assign({id, nick, total: 0, last: 1, kk1: kk}, extra);
  const e = (m, l, y, t, k = m + 3) => ({m, l, y, k, t});
  check('Kick It: the scoreboard ranks the day by field goals made, then the longest, then yards (ties share a rank); a member on two phones is one row, their first finished run; bad entries are left out', () => {
    const docs = [
      doc('kk-a', 'Mason', {1: e(9, 44, 300, 50)}),
      doc('kk-b', 'Jacob', {1: e(9, 51, 280, 40)}),
      doc('kk-c', 'Tommy', {1: e(9, 51, 280, 60)}),
      doc('kk-d', 'Evan', {1: e(12, 38, 340, 70)}),
      doc('kk-e', 'Mason', {1: e(2, 20, 40, 10)}, {last: 2}),
      doc('kk-f', 'Dresden', {1: {m: 99, l: 30, y: 1, k: 1, t: 1}}),
      doc('kk-g', 'John', {2: e(5, 30, 120, 5)})
    ];
    const rows = K.boardRows(1, docs), sig = rows.map(r => `${r.rank}.${r.name.split(' ')[0]} ${r.m}/${r.l}`).join(', ');
    return {pass: sig === '1.Evan 12/38, 2.Jacob 9/51, 2.Tommy 9/51, 4.Mason 2/20', detail: sig};
  });
  check('Kick It: the week (Tuesday to Monday) adds up each person\'s made kicks over its days, then the longest; last week\'s days don\'t count', () => {
    const wd = K.weekDays(2, 5).join() === '1,2' && K.weekDays(3, 5).join() === '3,4,5' && K.weekDays(5, 5).join() === '3,4,5';
    const docs = [
      doc('kw-a', 'Mason', {2: e(8, 40, 200, 1), 3: e(4, 33, 100, 2), 4: e(5, 41, 150, 3)}),
      doc('kw-b', 'Jacob', {3: e(10, 50, 330, 2)}),
      doc('kw-c', 'Tommy', {1: e(30, 60, 900, 1)})
    ];
    const rows = K.weekRows(4, docs, 5), sig = rows.map(r => `${r.rank}.${r.name.split(' ')[0]} ${r.m}/${r.l}/${r.played}`).join(', ');
    const pass = wd && sig === '1.Jacob 10/50/1, 2.Mason 9/41/2';
    return {pass, detail: `days ${wd}; ${sig}`};
  });
  check('Kick It: THE RULE (CLAUDE.md): the scoreboard reads the board as this phone may see it (daily.LB.raw), never every doc: a guest or Ryan S on the board only on their own phones; Ryan D for everyone', async () => {
    const LB = daily.LB, raw = LB.raw, all = LB.all, players = LB.players;
    const member = doc('kr-m', 'Mason', {1: e(4, 30, 100, 1)}), guest = doc('kr-g', 'Zed Q', {1: e(20, 60, 900, 1)}, {g: true});
    const ryanD = doc('kr-d', 'Ryan Dow', {1: e(6, 40, 200, 1)});
    let out;
    try {
      LB.all = [member, guest, ryanD];
      LB.raw = LB.all.filter(p => daily.boardShows(p));
      LB.players = LB.raw;
      const rows = K.boardRows(1), week = K.weekRows(1, undefined, 1);
      const names = rows.map(r => r.name).join();
      out = {rows: names, week: week.map(r => r.name).join(), shown: daily.boardShows(guest), ryan: rows.some(r => r.name === 'Ryan D')};
    } finally { LB.raw = raw; LB.all = all; LB.players = players; }
    // and the code: the game's files never read LB.all (comments aside)
    const files = ['./kick.js', '../views/kick.js'];
    const srcs = await Promise.all(files.map(f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '')));
    const reads = srcs.map((s, i) => (s && !s.split('\n').some(l => /LB\.all\b/.test(l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))) ? '' : files[i])).filter(Boolean);
    const pass = !out.shown && !/Zed/.test(out.rows) && !/Zed/.test(out.week) && out.ryan && /Mason/.test(out.rows) && !reads.length;
    return {pass, detail: `rows ${out.rows}; week ${out.week}; guest shown ${out.shown}; ${reads.length ? 'reads LB.all: ' + reads.join() : 'no LB.all reads'}`};
  });
  check('Kick It: its stylesheet (css/views/kick.css) is linked: the version mark is on :root', () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--kk-css').trim();
    return {pass: v !== '', detail: `--kk-css ${v || 'missing'}`};
  });
}
