// Kick It checks for the dev gallery (#/_kit): the day's kicks (core/kick.js: the same on every phone, longer and
// wider as the run goes; the wind and the wall by makes), the kick's physics and its calls (good, wide, off an upright
// or the bar, short, blocked; the wind's push, the ball riding it, no curve), the swipe read as a kick, every kick
// makeable, a run's numbers, and the league scoreboard's rows (on crafted board docs),
// which read the board as this phone may see it (THE RULE, CLAUDE.md). checks.js (owner: core) imports kickChecks and
// calls it with its own check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here writes to storage
// or the database. Owner: KICK.

import * as K from './kick.js';
import * as daily from './daily.js';
import * as data from './data.js';
import {gameFor} from '../views/puzzles.js';
import {keepHTML, burstHTML} from '../views/kick.js';

/** Names for crafted board docs: self, the profile this phone is on (the boards take this phone's own doc as that
 *  profile's, whatever name it carries, so "his" other docs must carry the same; Evan with no profile picked), and
 *  other, another league member's (never this profile's or the owner's). */
function fixtureNames() {
  const M = (data.DATA && data.DATA.managers) || [], mine = M.find(m => m.id === data.me());
  const self = mine ? mine.name : 'Evan';
  const other = (M.find(m => m.name !== self && m.id !== data.OWNER) || {}).name || (self === 'Mason' ? 'Jacob' : 'Mason');
  return {self, other};
}

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
  // 1. The day's kicks, and the weather by makes
  check('Kick It: day 1 is Oct 18 2026; a day\'s 40 kicks are the same every time (the same on every phone) and differ day to day; the ball always on or between the hash marks (high school\'s, 8.89 yards out), the first few near the middle, wandering out toward them as the run goes (a third of the later kicks right on one); the kicks themselves are in calm air (how far back, the wind and the wall go by makes)', () => {
    const one = K.todayNumber(new Date(2026, 9, 18, 9)) === 1 && K.todayNumber(new Date(2026, 9, 19, 23, 59)) === 2 && K.todayNumber(new Date(2026, 9, 1)) === 1
      && K.dateOf(3).getDate() === 20;
    const a = K.kicks(5), b = K.kicks(5), c = K.kicks(6);
    const same = JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && a.length === K.MAX_KICKS;
    let shape = true;
    const bad = [];
    for (let n = 1; n <= 40; n++) {
      const ks = K.kicks(n);
      ks.forEach((k, i) => {
        const ok = k.i === i && Math.abs(k.dj) <= 2 && Math.abs(k.gx) <= Math.min(K.HASH, 2 + i * .5) + 1e-9 && k.w === 0 && !k.obs.length;
        if (!ok && bad.length < 3) bad.push(`day ${n} kick ${i}: ${JSON.stringify(k)}`);
        shape = shape && ok;
      });
      shape = shape && ks.slice(0, 3).every(k => Math.abs(k.gx) <= 5);
    }
    const avg = (n, from, to, f) => { let s = 0, m = 0; for (let d = 1; d <= n; d++) K.kicks(d).slice(from, to).forEach(k => { s += f(k); m++; }); return s / m; };
    const wider = avg(30, 25, 40, k => Math.abs(k.gx)) > avg(30, 0, 10, k => Math.abs(k.gx)) * 2;
    const onHash = avg(30, 14, 40, k => (Math.abs(k.gx) === K.HASH ? 1 : 0));
    const pass = one && same && shape && wider && K.HASH === 8.89 && onHash > .22 && onHash < .45;
    return {pass, detail: `days ${one}; same ${same}; inside the hashes, calm, a couple of yards' give ${shape}${bad.length ? ' (' + bad.join('; ') + ')' : ''}; wider later ${wider}; on a hash from kick 15: ${(onHash * 100).toFixed(0)}%`};
  });
  check('Kick It: how far back goes by makes ("jump from a 20 yarder to 30-40 quickly"): a chip shot (18-22 yards) till the first make, then about 30 and three yards more a make to about 39 by the fourth, then a yard and a half more a make, 62 the longest; a miss doesn\'t move it back', () => {
    const range = made => { let lo = 99, hi = 0; for (let n = 1; n <= 30; n++) for (let i = made; i < K.MAX_KICKS; i++) { const d = K.kickFor(n, i, made).d; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
    const r = [0, 1, 2, 3, 4, 8, 20].map(range);
    const fits = ([lo, hi], a, b) => lo >= a && hi <= b;
    const steps = fits(r[0], 18, 22) && fits(r[1], 28, 32) && fits(r[2], 31, 35) && fits(r[3], 34, 38) && fits(r[4], 37, 41) && fits(r[5], 41, 47) && r[6][1] <= 62 && r[6][0] >= 58;
    const miss = K.nextKick(3, [['good', 20], ['short', 31]]).d === K.kickFor(3, 2, 1).d && Math.abs(K.nextKick(3, [['good', 20], ['short', 31]]).d - 30) <= 2;
    return {pass: steps && miss, detail: `${[0, 1, 2, 3, 4, 8, 20].map((m, k) => `${m} made ${r[k][0]}-${r[k][1]}`).join(', ')} yds; after a miss the same band ${miss}`};
  });
  check('Kick It: the weather goes by makes: calm air for the first three makes; then wind (4-8 mph) till the fifth make; from the fifth it picks up with every make (to 26 mph at most, never more than leaves the kick makeable); from the seventh make the wall; the same kick with the same makes is the same on every phone', () => {
    const avg = (made, f) => { let s = 0, m = 0; for (let n = 1; n <= 20; n++) for (let i = made; i < Math.min(K.MAX_KICKS, made + 4); i++) { s += f(K.kickFor(n, i, made)); m++; } return s / m; };
    const wind = m => avg(m, k => k.w), walls = m => avg(m, k => k.obs.length);
    let calm = true, breeze = true, cap = true;
    for (let n = 1; n <= 20; n++) for (let i = 0; i < K.MAX_KICKS; i += 3) {
      [0, 1, 2].forEach(m => { const k = K.kickFor(n, i, m); calm = calm && k.w === 0 && !k.obs.length; });
      [3, 4].forEach(m => { const k = K.kickFor(n, i, m); breeze = breeze && k.w <= 8 && !k.obs.length; });
      [5, 9, 14, 20].forEach(m => { const k = K.kickFor(n, i, m); cap = cap && k.w <= K.WIND_MAX && k.dir >= 0 && k.dir <= 360 && Number.isInteger(k.w); });
    }
    // (by 12 made the kicks are 50 yards and more: keeping them makeable takes a little off the wind)
    const rising = wind(3) >= 4 && wind(5) > wind(4) + 2 && wind(7) > wind(5) + 2 && wind(10) > wind(7) + 3 && wind(12) > 16;
    const wall = walls(6) === 0 && walls(7) === 1 && walls(12) === 1;
    const same = JSON.stringify(K.kickFor(4, 9, 6)) === JSON.stringify(K.kickFor(4, 9, 6)) && K.nextKick(4, [['good', 20], ['good', 22], ['short', 25], ['good', 30]]).w === K.kickFor(4, 4, 3).w;
    const consts = K.WIND_FROM === 3 && K.WIND_GROWS === 5 && K.WALL_FROM === 7;
    const pass = calm && breeze && cap && rising && wall && same && consts;
    return {pass, detail: `calm till 3 made ${calm}; a breeze at 3-4 ${breeze} (${wind(3).toFixed(1)}, ${wind(4).toFixed(1)} mph); then ${[5, 7, 10, 12].map(m => `${m} made ${wind(m).toFixed(1)}`).join(', ')} mph; capped ${cap}; walls at 6 / 7 / 12 made ${walls(6)} / ${walls(7)} / ${walls(12)}; the same ${same}`};
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
  check('Kick It: the ball rides the wind, and it\'s the big factor: 7 mph across blows a straight 40-yarder 6 to 8 yards its way, 15 mph twice that; the flight curves (off the foot on its line, bending more and more: halfway there under a third of the drift); aiming into it just enough makes it good, and the call says what the wind did; even a chip shot moves; a tailwind carries a kick short in calm air over the bar, a headwind knocks a good one down; the swipe\'s shape doesn\'t bend it', () => {
    const k = (w, dir, d = 40) => ({i: 0, d, gx: 0, w, dir, obs: []});
    const toR = straight(k(7, 90), 28), toL = straight(k(7, 270), 28), drift = toR.at ? toR.at.x : 0;
    const strong = straight(k(15, 90), 28), drift15 = strong.at ? strong.at.x : 0;
    // curved, not a straight line at an angle: halfway to the posts (in time) it's drifted under a third of the way
    const half = toR.tCross ? toR.pos(toR.tCross / 2).x / drift : 1;
    // aim into it just enough: the aim where it crosses the middle
    let lo = 0, hi = 1;
    for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2, c = K.fly(k(7, 90), {theta: -m, v: 28}); if (c.at && c.at.x > 0) lo = m; else hi = m; }
    const intoL = {theta: -(lo + hi) / 2, v: 28}, into = K.fly(k(7, 90), intoL);
    const says = [K.windCall(k(7, 90), {theta: 0, v: 28}, toR), K.windCall(k(7, 90), intoL, into), K.windCall(calm(40), {theta: 0, v: 28}, straight(calm(40), 28))].join();
    const chip = straight(k(4, 90, 20), 28), chipDrift = chip.at ? chip.at.x : 0;
    const vShort = legFor(calm(40), K.POST.bar) - .6, calmShort = straight(calm(40), vShort);
    const tail = straight(k(10, 0), vShort), head = straight(k(10, 180), vShort + 1.2), calmOk = straight(calm(40), vShort + 1.2);
    // no curving it: a launch is its aim and its leg; a bend passed in does nothing
    const L = K.launchOf({dx: 0, dy: -220, speed: 1, curve: {bend: .4, tilt: .2}});
    const noBend = Object.keys(L).sort().join() === 'theta,v' && K.fly(calm(40), {theta: 0, v: 26, bend: .4, tilt: .2}).at.x === K.fly(calm(40), {theta: 0, v: 26}).at.x && !('curveOf' in K);
    const pass = toR.why === 'wide-r' && toL.why === 'wide-l' && drift > 6 && drift < 8 && drift15 > drift * 1.9 && half > .1 && half < 1 / 3 && into.made && says === 'took,carried,' && chipDrift > .8
      && calmShort.why === 'short' && tail.made && calmOk.made && !head.made && noBend;
    return {pass, detail: `7 mph across: ${toR.why} (${drift.toFixed(2)} yds), the other way ${toL.why}; 15 mph ${drift15.toFixed(1)} yds; halfway ${(half * 100).toFixed(0)}% of the drift; aimed into it ${(intoL.theta * 57.3).toFixed(0)} deg: ${into.why}; the call: ${says}; a 20-yarder in 4 mph moves ${chipDrift.toFixed(2)} yds; leg ${vShort.toFixed(1)}: calm ${calmShort.why}, tailwind ${tail.why}; a little more: calm ${calmOk.why}, headwind ${head.why}; no bend ${noBend}`};
  });
  check('Kick It: however strong the wind and wherever the wall is, every kick can be made: on days 1-6, every kick with any number of makes before it has a leg and an aim that go through, with room to spare (at least 2 degrees of aim in one unbroken run)', () => {
    let worst = 9, where = '', none = [];
    for (let n = 1; n <= 6; n++) for (let i = 0; i < K.MAX_KICKS; i++) for (const made of [0, 3, 5, 7, 10, 14, 20].filter(m => m <= i)) {
      const k = K.kickFor(n, i, made);
      let best = 0;
      [30, 28.5, 27, 25.5, 24, 22.5].forEach(v => {
        if (best >= .06) return; // plenty already
        let lo = null;
        for (let th = -1.1; th <= 1.1; th += .006) {
          if (K.fly(k, {theta: th, v}).made) { if (lo == null) lo = th; best = Math.max(best, th - lo); } else lo = null;
        }
      });
      if (!best) none.push(`day ${n} kick ${i + 1} (${made} made)`);
      else if (best < worst) { worst = best; where = `day ${n} kick ${i + 1} (${made} made: ${k.d} yds, ${k.w} mph, ${k.obs.map(o => o.t).join('+') || 'nothing in the way'})`; }
    }
    const deg = worst * 180 / Math.PI;
    return {pass: !none.length && deg >= 2, detail: none.length ? `can't be made: ${none.slice(0, 4).join(', ')}` : `the tightest: ${deg.toFixed(1)} degrees, ${where}`};
  });
  check('Kick It: from the seventh make a brick wall stands in the goal\'s opening, on the crossbar and up to the uprights\' tops against one upright, closing a quarter or half of the opening: a quarter for the first three makes with it, half most of the time from six more; nothing else on the field', () => {
    let ok = true, halves = 0, lates = 0;
    const bad = [], seen = new Set();
    for (let n = 1; n <= 20; n++) for (let i = 0; i < K.MAX_KICKS; i++) [6, 7, 9, 13, 16].forEach(made => {
      if (made > i) return;
      const k = K.kickFor(n, i, made);
      let fine = made < K.WALL_FROM ? !k.obs.length : k.obs.length === 1 && k.obs[0].t === 'wall';
      k.obs.forEach(w => {
        seen.add(w.t);
        const inner = w.x - w.face * w.half, upright = k.gx + w.face * K.POST.half, outer = w.x + w.face * w.half;
        const closes = Math.abs(upright - inner) / (K.POST.half * 2), half = Math.abs(closes - .5) < .03;
        fine = fine && Math.abs(w.z - (k.d - .05)) < .06 && (Math.abs(closes - .25) < .03 || half) && Math.abs(outer - upright) < .01
          && w.y0 === K.POST.bar && w.h === K.POST.top;
        if (made < K.WALL_FROM + 3) fine = fine && !half;
        if (made >= K.WALL_FROM + 6) { lates++; if (half) halves++; }
      });
      if (!fine && bad.length < 3) bad.push(`day ${n} kick ${i + 1} (${made} made): ${JSON.stringify(k.obs)}`);
      ok = ok && fine;
    });
    const pass = ok && [...seen].join() === 'wall' && Object.keys(K.OBSTACLES).join() === 'wall' && halves > lates * .45;
    return {pass, detail: `kinds seen ${[...seen].join(', ')}; from 13 made half the opening ${halves} of ${lates}${bad.length ? '; ' + bad.join('; ') : ''}`};
  });
  check('Kick It: the line of scrimmage is 7 yards out: a kick too soft to reach any posts is blocked there (called when it hits, with what stopped it), a real kick clears it; a wall across half the opening stops a kick at that half, the open half goes, a kick under the bar is short (the wall is above it) and one high enough clears the wall', () => {
    const open = calm(40), soft = K.fly(open, {theta: 0, v: 13}), chip = straight(calm(18), 20);
    const blocked = soft.why === 'blocked' && !!soft.hit && soft.hit.t === 'line' && soft.tHit > 0 && soft.tCross == null && soft.tEnd > soft.tHit && soft.hit.says === K.LINE.says && !!K.CALLS.blocked;
    // the softest leg that gets over the bar from the closest posts there are still clears the line with room
    const least = legFor(calm(18), K.POST.bar), over = K.fly(calm(18), {theta: 0, v: least});
    // and so does it in the strongest tailwind (which brings the ball to the line sooner, lower)
    const tail = {i: 0, d: 18, gx: 0, w: K.WIND_MAX, dir: 0}, tailOver = K.fly(tail, {theta: 0, v: legFor(tail, K.POST.bar)});
    const clears = !over.hit && over.pos(over.tCross * K.LINE.reach / 18).y > K.LINE.h + .3 && !tailOver.hit && tailOver.made && K.LINE.z === 7;
    const W = d => ({i: 9, d, gx: 0, w: 0, dir: 0, obs: [{t: 'wall', x: -K.POST.half / 2, z: d - .05, half: K.POST.half / 2, y0: K.POST.bar, h: K.POST.top, face: -1, share: .5}]});
    const wallL = K.fly(W(40), {theta: Math.atan(-1.5 / 40), v: 24}), wallR = K.fly(W(40), {theta: Math.atan(-1.5 / 40) * -1, v: 24});
    const under = K.fly(W(40), {theta: Math.atan(-1.5 / 40), v: legFor(calm(40), K.POST.bar - .5)});
    // a 30-yarder hit as hard as a leg can is still high at the posts: over the wall's top
    const high = K.fly(W(30), {theta: Math.atan(-1.5 / 30), v: 30});
    const pass = blocked && clears && chip.made && wallL.why === 'blocked' && wallL.hit && wallL.hit.t === 'wall' && wallR.made && under.why !== 'blocked' && !under.made
      && !!high.at && high.at.y > K.POST.top && high.made;
    return {pass, detail: `the softest leg: ${soft.why}${soft.hit ? ' (' + soft.hit.says + ')' : ''}; just enough for an 18-yarder (${least.toFixed(1)}): ${over.why}, over the line by ${(over.pos(over.tCross * K.LINE.reach / 18).y - K.LINE.h).toFixed(1)} yds (in a ${K.WIND_MAX} mph tailwind ${tailOver.why}); a chip shot ${chip.why}; at the walled half ${wallL.why}, the open half ${wallR.why}; under the bar at the wall ${under.why}; a 30-yarder at full leg crosses ${high.at ? high.at.y.toFixed(1) : '?'} yds up: ${high.why}`};
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
  check('Kick It: THE RULE (CLAUDE.md): the scoreboard reads the board as this phone may see it (daily.LB.raw), never every doc: everyone on it on every phone (Oct 24 2026: a guest, Ryan S, Ryan D, the members), a row that is no one\'s nowhere', async () => {
    const LB = daily.LB, raw = LB.raw, all = LB.all, players = LB.players;
    const member = doc('kr-m', 'Mason', {1: e(4, 30, 100, 1)}), guest = doc('kr-g', 'Zed Q', {1: e(20, 60, 900, 1)}, {g: true});
    const nobody = doc('kr-x', 'Setup test', {1: e(1, 10, 50, 1)});
    const ryanD = doc('kr-d', 'Ryan Dow', {1: e(6, 40, 200, 1)});
    let out;
    try {
      LB.all = [member, guest, ryanD, nobody];
      LB.raw = LB.all.filter(p => daily.boardShows(p, false)); // a league phone's board
      LB.players = LB.raw;
      const rows = K.boardRows(1), week = K.weekRows(1, undefined, 1);
      const names = rows.map(r => r.name).join();
      out = {rows: names, week: week.map(r => r.name).join(), shown: daily.boardShows(guest, false), owner: daily.boardShows(guest, true), ryan: rows.some(r => r.name === 'Ryan D'), nobody: daily.boardShows(nobody, false) || daily.boardShows(nobody, true)};
    } finally { LB.raw = raw; LB.all = all; LB.players = players; }
    // and the code: the game's files never read LB.all (comments aside)
    const files = ['./kick.js', '../views/kick.js'];
    const srcs = await Promise.all(files.map(f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '')));
    // (split on CRLF too: a Windows checkout's line ends would otherwise keep a comment from being stripped)
    const reads = srcs.map((s, i) => (s && !s.split(/\r?\n/).some(l => /LB\.all\b/.test(l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))) ? '' : files[i])).filter(Boolean);
    const pass = out.shown && out.owner && /Zed/.test(out.rows) && /Zed/.test(out.week) && out.ryan && /Mason/.test(out.rows) && !out.nobody && !/Setup/.test(out.rows) && !reads.length;
    return {pass, detail: `rows ${out.rows}; week ${out.week}; guest shown ${out.shown} (on the owner's phone ${out.owner}); no one's row shown ${out.nobody}; ${reads.length ? 'reads LB.all: ' + reads.join() : 'no LB.all reads'}`};
  });
  check('Kick It is open to everyone (Oct 2026): /puzzles/kick opens its page on any phone (the owner\'s, a member\'s, a guest\'s), like the other three games; an unknown game is the list of games', () => {
    const routes = ['kick', 'drill', '17-0', 'puzzles', 'nope', undefined].map(g => String(gameFor(g))).join();
    const anyone = ['evan', 'mitch', null].every(who => gameFor('kick', who) === 'kick');
    return {pass: routes === 'kick,drill,17-0,puzzles,null,null' && anyone, detail: `routes ${routes}; on any phone ${anyone}`};
  });
  check('Kick It: no Play again (the owner tests with Test play): no restart; a day still holding one of his old practice runs counts its first finished run', () => {
    const gone = !('restart' in K) && !('canReplay' in K) && !('restartDay' in K);
    const old = {r: [['good', 20], ['good', 31]], tries: 2, first: {r: [['good', 20], ['short', 30], ['wide-l', 31], ['bar', 30]], at: 111}};
    const off = K.officialOf(old), plain = K.officialOf({r: [['good', 20], ['short', 31], ['short', 31], ['post', 30]], done: true, at: 222});
    const pass = gone && off.made === 1 && off.at === 111 && plain.made === 1 && plain.at === 222 && K.officialOf({r: [['good', 20]]}) === null;
    return {pass, detail: `restart gone ${gone}; an old practice day counts its first run: ${off && off.made} made at ${off && off.at}`};
  });
  // 5. Keepfall's Gold (the owner's alone)
  check('Kick It: Keepfall\'s Gold (the owner\'s alone, Oct 21 2026; paid from Thu Oct 22, the day realm.js NEW_PAY switches Kick It, his Test play showing it any day): the day\'s counting run pays 500 whatever it made (the base, Oct 22 2026) and every 5th make 3,000 Gold more (500 + floor(makes / 5) x 3,000, 24,500 at most), the burst ("+3,000") comes on the 5th, 10th, 15th... make and no other (and not on a run when one from another of his phones already counts); the day\'s pay is the counting entry\'s makes (kk1[n].m: the first finished run, across a person\'s phones the earliest posted; Test play is never posted); the final card says "+N Gold for Keepfall" on the owner\'s profile (never "No Gold" for a real run: the base) and nothing (the card as it was) on anyone else\'s; the burst is drawn, no picture', async () => {
    const gold = [0, 4, 5, 9, 10, 14, 15, 39, 40, 41, -3, 'x'].map(K.goldOf).join();
    const goldOk = gold === '500,500,3500,3500,6500,6500,9500,21500,24500,24500,500,500' && K.GOLD.every === 5 && K.GOLD.each === 3000 && K.GOLD.base === 500;
    const bursts = [];
    for (let m = 0; m <= K.MAX_KICKS + 1; m++) if (K.goldMake(m)) bursts.push(m);
    const burstOk = bursts.join() === '5,10,15,20,25,30,35,40' && bursts.length * K.GOLD.each + K.GOLD.base === K.goldOf(K.MAX_KICKS) && !K.goldMake(5.5);
    // the counting entry: a person's earliest posted run across their phones, never someone else's
    const LB = daily.LB, uid = LB.uid, nick = LB.nick;
    let run, none, entryM;
    // (the boards take this phone's own doc as the profile the kit runs on, whatever its name: "his" docs carry that
    // profile's name, someone else's another member's)
    const {self, other: else1} = fixtureNames();
    try {
      LB.uid = 'kg-me1'; LB.nick = self;
      const docs = [doc('kg-me1', self, {9: e(12, 50, 500, 50)}), doc('kg-me2', self, {9: e(4, 40, 120, 20)}), doc('kg-x', else1, {9: e(30, 60, 900, 5)})];
      run = K.countingRun(9, docs);
      none = K.countingRun(999, []);
      entryM = K.entryOf(docs[0], 9).m;
    } finally { LB.uid = uid; LB.nick = nick; }
    const runOk = !!run && run.m === 4 && run.from === 'board' && none === null && entryM === 12;
    // the final card's line
    const plain = txt => txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const others = [{made: 10}, {made: 10, test: true}, {made: 3, run}].every(o => keepHTML(Object.assign({owner: false}, o)) === '');
    const ten = plain(keepHTML({owner: true, made: 10})), three = plain(keepHTML({owner: true, made: 3}));
    const other = plain(keepHTML({owner: true, made: 10, run: {m: 4, from: 'board'}})), test = plain(keepHTML({owner: true, made: 15, test: true}));
    const cardOk = others && ten === '+6,500 Gold for Keepfall 500 for the run + 3,000 for every 5th field goal.' && three === '+500 Gold for Keepfall 500 for the run + 3,000 for every 5th field goal.'
      && other === '+500 Gold for Keepfall From your first run today: 4 field goals.' && /^\+9,500 Gold Test play/.test(test) && !/No Gold/.test(ten + three + other + test);
    const b = burstHTML();
    const drawn = (b.match(/kk-coin-f/g) || []).length === 14 && plain(b) === '+3,000' && !/url\(|<img|\.webp|\.png/.test(b);
    // and the code: the burst checks the profile itself (nothing for anyone else), and goes when the profile changes
    const src = await fetch(new URL('../views/kick.js', import.meta.url)).then(r => r.text()).catch(() => '');
    const gated = /function coinBurst\(st\) \{[^]*?if \(st\.dead \|\| !stage \|\| !data\.isOwner\(\)\) return false;/.test(src)
      && /keepShows\(st\) && !otherRunCounts\(st\) && coinBurst\(st\)/.test(src)
      && /const keepShows = st => data\.isOwner\(\) && \(K\.testing\(\) \|\| K\.goldDay\(st\.n\)\);/.test(src)
      && /data\.subscribe\(type => \{ if \(type === 'me'\) patchKeep\(st\); \}\)/.test(src) && /if \(!data\.isOwner\(\)\) clearBurst\(st\);/.test(src);
    // from the day Keepfall's pay switched (core/realm.js NEW_PAY.kick: Thu Oct 22 2026, day 5); the days before it
    // keep the old pay and show nothing of this
    const F = await import('./realm.js').catch(() => null), from = F && F.NEW_PAY ? F.NEW_PAY.kick : null;
    const dayOk = K.GOLD.from === from && K.dateOf(K.GOLD.from).getDate() === 22 && !K.goldDay(4) && K.goldDay(5) && K.goldDay(40) && !K.goldDay('5');
    const pass = goldOk && burstOk && runOk && cardOk && drawn && gated && dayOk;
    return {pass, detail: `from day ${K.GOLD.from} (${K.dayLabel(K.GOLD.from)}; realm.js NEW_PAY.kick ${from}): ${dayOk}; gold ${gold}; bursts at ${bursts.join(', ')}; counting run ${run && run.m} (${run && run.from}), none ${none}; the card: "${ten}" / "${three}" / "${other}" / "${test}", others' card unchanged ${others}; drawn ${drawn}; gated ${gated}`};
  });
  check('Kick It: its stylesheet (css/views/kick.css) is linked: the version mark is on :root', () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--kk-css').trim();
    return {pass: v !== '', detail: `--kk-css ${v || 'missing'}`};
  });
}
