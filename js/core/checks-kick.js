// Kick It checks for the dev gallery (#/_kit): the day's kicks (core/kick.js: the same on every phone, longer, wider
// and windier as the run goes, things in the way from the fifth), the kick's physics and its calls (good, wide, off an
// upright or the bar, short, blocked; the wind's push; the swipe's shape bending it), the swipe read as a kick, every
// kick makeable, a run's numbers, and the league scoreboard's rows (on crafted board docs),
// which read the board as this phone may see it (THE RULE, CLAUDE.md). checks.js (owner: core) imports kickChecks and
// calls it with its own check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here writes to storage
// or the database. Owner: KICK.

import * as K from './kick.js';
import * as daily from './daily.js';
import {gamesFor, gameFor} from '../views/puzzles.js';

const calm = (d, gx = 0) => ({i: 0, d, gx, w: 0, dir: 0});
const straight = (k, v = 30) => K.fly(k, {theta: Math.atan(k.gx / k.d), v});
/** The leg (yards a second) that puts the ball at height y over the bar's plane (bisection; the kick straight). */
function legFor(k, y) {
  let lo = 13, hi = 30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, c = straight(k, mid);
    if (c.at && c.at.y >= y) hi = mid; else lo = mid;
  }
  return hi;
}

export async function kickChecks(check) {
  // 1. The day's kicks
  check('Kick It: day 1 is Oct 18 2026; a day\'s 40 kicks are the same every time (the same on every phone) and differ day to day; distances 18-62 yards, the first three chip shots near the middle, the posts wandering further off and the kicks getting longer and windier as the run goes; wind 0-14 mph, any heading: a breeze from the first kick, about 3 mph on average by kicks 4-10, twice that late in a run', () => {
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
          && Number.isInteger(k.w) && k.w >= 0 && k.w <= 14 && k.dir >= 0 && k.dir <= 360;
        if (!ok && bad.length < 3) bad.push(`day ${n} kick ${i}: ${JSON.stringify(k)}`);
        shape = shape && ok;
      });
      shape = shape && ks.slice(0, 3).every(k => k.d <= 29 && Math.abs(k.gx) <= 5);
    }
    const avg = (n, from, to, f) => { let s = 0, m = 0; for (let d = 1; d <= n; d++) K.kicks(d).slice(from, to).forEach(k => { s += f(k); m++; }); return s / m; };
    const grows = avg(30, 25, 40, k => k.d) > avg(30, 0, 10, k => k.d) + 20 && avg(30, 25, 40, k => k.w) > avg(30, 0, 10, k => k.w) * 2
      && avg(30, 25, 40, k => Math.abs(k.gx)) > avg(30, 0, 10, k => Math.abs(k.gx)) * 2;
    const early = avg(30, 3, 10, k => k.w);
    const pass = one && same && shape && grows && early >= 2.5;
    return {pass, detail: `days ${one}; same ${same}; in range ${shape}${bad.length ? ' (' + bad.join('; ') + ')' : ''}; harder later ${grows}; wind on kicks 4-10 ${early.toFixed(1)} mph`};
  });

  // 2. The kick
  check('Kick It: a kick at the posts with a strong leg is good, a weak one short; aimed off it goes wide on that side; one that meets an upright is off the upright, one that just clips the bar is off the crossbar; a good kick is called as it crosses the bar', () => {
    const k30 = calm(30), good = straight(k30), weak = straight(k30, 17);
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
  check('Kick It: the wind is the big factor: 7 mph across blows a straight 40-yarder 4 or 5 yards its way; a kick aimed into it hangs up (in a 7 mph wind to the left a 40-yarder can\'t get far to the right, though in calm air it could go 20 yards that way), a bend into it is blown out (it barely gets right at all) while a bend with it keeps its arc; aiming into it just enough makes it good, and the call says what the wind did; even a chip shot moves; a tailwind carries a kick short in calm air over the bar, a headwind knocks a good one down', () => {
    const k = (w, dir, d = 40) => ({i: 0, d, gx: 0, w, dir, obs: []});
    const toR = straight(k(7, 90)), toL = straight(k(7, 270)), drift = toR.at ? toR.at.x : 0;
    const furthest = kk => { let far = -99; for (let th = 0; th <= 1.05; th += .01) { const c = K.fly(kk, {theta: th, v: 28, bend: 0, tilt: 0}); if (c.at) far = Math.max(far, c.at.x); } return far; };
    const hungRight = furthest(k(7, 270)), calmRight = furthest(calm(40));
    const most = (c, f) => { let m = 0; for (let t = 0; t < c.tEnd; t += .02) m = f(m, c.pos(t).x); return m; };
    const bendIn = most(K.fly(k(7, 270), {theta: 0, v: 28, bend: .4, tilt: 0}), Math.max), bendWith = most(K.fly(k(7, 270), {theta: 0, v: 28, bend: -.4, tilt: 0}), Math.min);
    // aim into it just enough: the aim where it crosses the middle
    let lo = 0, hi = 1;
    for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2, c = K.fly(k(7, 90), {theta: -m, v: 28, bend: 0, tilt: 0}); if (c.at && c.at.x > 0) lo = m; else hi = m; }
    const intoL = {theta: -(lo + hi) / 2, v: 28, bend: 0, tilt: 0}, into = K.fly(k(7, 90), intoL);
    const says = [K.windCall(k(7, 90), {theta: 0, v: 28}, toR), K.windCall(k(7, 90), intoL, into), K.windCall(calm(40), {theta: 0, v: 28}, straight(calm(40), 28))].join();
    const chip = straight(k(4, 90, 20), 28), chipDrift = chip.at ? chip.at.x : 0;
    const vShort = legFor(calm(40), K.POST.bar) - .6, calmShort = straight(calm(40), vShort);
    const tail = straight(k(10, 0), vShort), head = straight(k(10, 180), vShort + 1.2), calmOk = straight(calm(40), vShort + 1.2);
    const pass = toR.why === 'wide-r' && toL.why === 'wide-l' && drift > 3.5 && drift < 5.5 && hungRight < 11 && calmRight > 20
      && bendIn < .5 && bendWith < -4 && into.made && says === 'took,carried,' && chipDrift > .8
      && calmShort.why === 'short' && tail.made && calmOk.made && !head.made;
    return {pass, detail: `7 mph across: ${toR.why} (${drift.toFixed(2)} yds), the other way ${toL.why}; into a 7 mph wind to the left it gets ${hungRight.toFixed(1)} yds right at most (calm ${calmRight.toFixed(1)}); a bend into it ${bendIn.toFixed(2)} yds right, with it ${bendWith.toFixed(1)}; aimed into it ${(intoL.theta * 57.3).toFixed(0)} deg: ${into.why}; the call: ${says}; a 20-yarder in 4 mph moves ${chipDrift.toFixed(2)} yds; leg ${vShort.toFixed(1)}: calm ${calmShort.why}, tailwind ${tail.why}; a little more: calm ${calmOk.why}, headwind ${head.why}`};
  });
  check('Kick It: however strong the wind and wherever the wall is, every kick can be made: on days 1-8, each one has a leg, a bend and an aim that go through, with room to spare (at least 2 degrees of aim in one unbroken run)', () => {
    let worst = 9, where = '', none = [];
    for (let n = 1; n <= 8; n++) K.kicks(n).forEach(k => {
      let best = 0;
      [30, 28.5, 27, 25.5].forEach(v => [0, -.15, .15, -.3, .3, -.45, .45].forEach(bend => {
        if (best >= .06) return; // plenty already
        let lo = null;
        for (let th = -1.1; th <= 1.1; th += .006) {
          if (K.fly(k, {theta: th, v, bend, tilt: 0}).made) { if (lo == null) lo = th; best = Math.max(best, th - lo); } else lo = null;
        }
      }));
      if (!best) none.push(`day ${n} kick ${k.i + 1}`);
      else if (best < worst) { worst = best; where = `day ${n} kick ${k.i + 1} (${k.d} yds, ${k.w} mph, ${k.obs.map(o => o.t).join('+') || 'nothing in the way'})`; }
    });
    const deg = worst * 180 / Math.PI;
    return {pass: !none.length && deg >= 2, detail: none.length ? `can't be made: ${none.slice(0, 4).join(', ')}` : `the tightest: ${deg.toFixed(1)} degrees, ${where}`};
  });
  check('Kick It: from the fifth kick a brick wall stands in the goal, flush with an upright, closing a quarter or half of the opening, as tall as the uprights: a quarter through the ninth kick, half most of the time from the twentieth; nothing else on the field', () => {
    let ok = true, halves = 0, lates = 0;
    const bad = [], seen = new Set();
    for (let n = 1; n <= 20; n++) K.kicks(n).forEach(k => {
      let fine = k.i < K.OBS_FROM ? !k.obs.length : k.obs.length === 1 && k.obs[0].t === 'wall';
      k.obs.forEach(w => {
        seen.add(w.t);
        const inner = w.x - w.face * w.half, upright = k.gx + w.face * K.POST.half, outer = w.x + w.face * w.half;
        const closes = Math.abs(upright - inner) / (K.POST.half * 2), half = Math.abs(closes - .5) < .03;
        fine = fine && Math.abs(w.z - (k.d - .6)) < .06 && (Math.abs(closes - .25) < .03 || half) && Math.abs(Math.abs(outer - upright) - K.WALL_OUT) < .06 && w.h >= K.POST.top;
        if (k.i < 9) fine = fine && !half;
        if (k.i >= 19) { lates++; if (half) halves++; }
      });
      if (!fine && bad.length < 3) bad.push(`day ${n} kick ${k.i + 1}: ${JSON.stringify(k.obs)}`);
      ok = ok && fine;
    });
    const pass = ok && [...seen].join() === 'wall' && Object.keys(K.OBSTACLES).join() === 'wall' && K.OBS_FROM === 4 && halves > lates * .45;
    return {pass, detail: `kinds seen ${[...seen].join(', ')}; from kick 20 half the opening ${halves} of ${lates}${bad.length ? '; ' + bad.join('; ') : ''}`};
  });
  check('Kick It: the line of scrimmage is 7 yards out: a kick too soft to reach any posts is blocked there (called when it hits, with what stopped it), a real kick clears it; a wall across half the goal stops a kick at that half, the open half goes; the swipe\'s shape bends the kick: an even arc comes back to the line at the posts, a lopsided swipe doesn\'t', () => {
    const open = calm(40), soft = K.fly(open, {theta: 0, v: 13, bend: 0, tilt: 0}), chip = straight(calm(18), 20);
    const blocked = soft.why === 'blocked' && !!soft.hit && soft.hit.t === 'line' && soft.tHit > 0 && soft.tCross == null && soft.tEnd > soft.tHit && soft.hit.says === K.LINE.says && !!K.CALLS.blocked;
    // the softest leg that gets over the bar from the closest posts there are still clears the line with room
    const least = legFor(calm(18), K.POST.bar), over = K.fly(calm(18), {theta: 0, v: least, bend: 0, tilt: 0});
    // and so does it in the strongest tailwind (which brings the ball to the line sooner, lower)
    const tail = {i: 0, d: 18, gx: 0, w: 14, dir: 0}, tailOver = K.fly(tail, {theta: 0, v: legFor(tail, K.POST.bar), bend: 0, tilt: 0});
    const clears = !over.hit && over.pos(over.tCross * K.LINE.reach / 18).y > K.LINE.h + .3 && !tailOver.hit && tailOver.made && K.LINE.z === 7;
    const wall = {i: 9, d: 40, gx: 0, w: 0, dir: 0, obs: [{t: 'wall', x: -(K.POST.half + K.WALL_OUT) / 2, z: 39.4, half: (K.POST.half + K.WALL_OUT) / 2, h: 10.4, face: -1, share: .5}]};
    const wallL = K.fly(wall, {theta: Math.atan(-1.5 / 40), v: 24, bend: 0, tilt: 0}), wallR = K.fly(wall, {theta: Math.atan(1.5 / 40), v: 24, bend: 0, tilt: 0});
    // on an open field: an even bend lands where a straight kick does; a lopsided one doesn't
    const at = l => K.fly(open, Object.assign({theta: 0, v: 26}, l)).at.x;
    const even = Math.abs(at({bend: .35, tilt: 0}) - at({bend: 0, tilt: 0})) < .01, mid = Math.abs(K.fly(open, {theta: 0, v: 26, bend: .35, tilt: 0}).pos(.8).x) > 2;
    const lop = Math.abs(at({bend: .2, tilt: .12}) - at({bend: 0, tilt: 0}));
    // the shapes read off a swipe
    const swipe = f => Array.from({length: 40}, (_, j) => { const u = j / 39; return {x: 200 + f(u) * 220, y: 600 - u * 220}; });
    const st = K.curveOf(swipe(() => 0)), arc = K.curveOf(swipe(u => .25 * 4 * u * (1 - u))), semi = K.curveOf(swipe(u => -Math.sqrt(u * (1 - u))));
    const skew = K.curveOf(swipe(u => 1.8 * Math.pow(u, 3) * (1 - u))), wob = K.curveOf(swipe(u => .02 * Math.sin(u * 19)));
    const wobL = K.launchOf({dx: 0, dy: -220, speed: 1, curve: wob});
    const shapes = st.bend === 0 && st.tilt === 0 && Math.abs(arc.bend - .25) < .01 && Math.abs(arc.tilt) < 1e-9 && semi.bend <= -.45 && Math.abs(semi.tilt) < 1e-9
      && skew.tilt > .08 && wobL.bend === 0 && wobL.tilt === 0;
    const pass = blocked && clears && chip.made && wallL.why === 'blocked' && wallR.made && even && mid && lop > .5 && shapes;
    return {pass, detail: `the softest leg: ${soft.why}${soft.hit ? ' (' + soft.hit.says + ')' : ''}; just enough for an 18-yarder (${least.toFixed(1)}): ${over.why}, over the line by ${(over.pos(over.tCross * K.LINE.reach / 18).y - K.LINE.h).toFixed(1)} yds (in a 14 mph tailwind ${tailOver.why}); a chip shot ${chip.why}; at the walled half ${wallL.why}, the open half ${wallR.why}; even arc back on the line ${even} (out ${mid}); lopsided ends ${lop.toFixed(2)} yds off; shapes: arc ${arc.bend.toFixed(2)}/${arc.tilt.toFixed(2)}, half circle ${semi.bend.toFixed(2)}/${semi.tilt.toFixed(2)}, lopsided tilt ${skew.tilt.toFixed(2)}, a wobble reads straight ${wobL.bend === 0 && wobL.tilt === 0}`};
  });
  check('Kick It: a flick reads as a kick: one that doesn\'t go up the screen isn\'t one; straight up goes straight, to the right goes right; a faster flick is a stronger leg (about 14-30 yards a second); the screen\'s aim through the crossbar is used when given', () => {
    const none = K.launchOf({dx: 0, dy: 30, speed: 2}) === null && K.launchOf({dx: 40, dy: -10, speed: 2}) === null;
    const up = K.launchOf({dx: 0, dy: -200, speed: 1}), right = K.launchOf({dx: 60, dy: -200, speed: 1}), left = K.launchOf({dx: -60, dy: -200, speed: 1});
    const slow = K.launchOf({dx: 0, dy: -200, speed: .05}), fast = K.launchOf({dx: 0, dy: -200, speed: 9}), mid = K.launchOf({dx: 0, dy: -200, speed: 1.2});
    const aimed = K.launchOf({dx: 999, dy: -200, speed: 1, aim: .1});
    const pass = none && up.theta === 0 && right.theta > 0 && left.theta < 0 && Math.abs(right.theta + left.theta) < 1e-9
      && slow.v < 15 && fast.v === 30 && mid.v > slow.v && mid.v < fast.v && Math.abs(aimed.theta - Math.atan(.1)) < 1e-9;
    return {pass, detail: `not a kick ${none}; straight ${up.theta}, right ${right.theta.toFixed(3)}, left ${left.theta.toFixed(3)}; legs ${slow.v}/${mid.v.toFixed(1)}/${fast.v}; aim ${aimed.theta.toFixed(3)}`};
  });

  // 3. A run's numbers
  check('Kick It: a run\'s numbers count the made kicks, the misses (three end it), the longest and the yards made', () => {
    const s = K.score([['good', 20], ['short', 30], ['good', 45], ['wide-l', 50], ['post', 52]]), z = K.score([]);
    const pass = s.made === 2 && s.missed === 3 && s.longest === 45 && s.yards === 65 && K.STRIKES === 3 && z.made === 0 && z.longest === 0
      && Object.keys(K.CALLS).join() === 'good,wide-l,wide-r,post,bar,short,blocked';
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
  check('Kick It is the owner\'s alone for now ("Build this for me only"): the picker shows it only on Evan\'s phones, and /puzzles/kick opens it only there (Daily Puzzles for anyone else, a guest or an app user); the other three games for everyone', () => {
    const evan = gamesFor('evan').join(), mason = gamesFor('mason').join(), none = gamesFor(null).join();
    const routes = [gameFor('kick', 'evan'), gameFor('kick', 'mason'), gameFor('kick', null), gameFor('drill', 'mason'), gameFor('17-0', null), gameFor('nope', 'evan')].join();
    const pass = evan === 'puzzles,17-0,drill,kick' && mason === 'puzzles,17-0,drill' && none === mason && routes === 'kick,puzzles,puzzles,drill,17-0,puzzles';
    return {pass, detail: `Evan ${evan}; Mason ${mason}; no one ${none}; routes ${routes}`};
  });
  check('Kick It: unlimited tries for the owner only (to test it): he can start the day\'s run over as often as he likes, and his first finished run stays the one that counts (and posts); a run started over before any finished keeps nothing', () => {
    const who = [K.canReplay('evan'), K.canReplay('mason'), K.canReplay(null)].join();
    const run1 = {r: [['good', 20], ['short', 24], ['blocked', 24], ['wide-l', 22]], done: true, at: 111};
    const again = K.restartDay(run1), twice = K.restartDay(Object.assign({}, again, {r: [['good', 20], ['good', 24], ['good', 24]]}));
    const off1 = K.officialOf(run1), off2 = K.officialOf(again), off3 = K.officialOf(twice);
    const mid = K.restartDay({r: [['good', 20]]});
    const pass = who === 'true,false,false' && again.r.length === 0 && again.tries === 2 && twice.tries === 3
      && off1.made === 1 && off1.missed === 3 && off2.made === 1 && off2.at === 111 && off3.made === 1 && off3.at === 111
      && !mid.first && K.officialOf(mid) === null && K.officialOf({r: [['good', 20]]}) === null;
    return {pass, detail: `can replay (Evan, Mason, no one): ${who}; the first run counts after one and two restarts: ${off2 && off2.made}/${off3 && off3.made} made; started over mid-run keeps ${mid.first ? 'a run' : 'nothing'}`};
  });
  check('Kick It: its stylesheet (css/views/kick.css) is linked: the version mark is on :root', () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--kk-css').trim();
    return {pass: v !== '', detail: `--kk-css ${v || 'missing'}`};
  });
}
