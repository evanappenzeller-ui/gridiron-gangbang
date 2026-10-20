// Return Man (Daily Games, its own page /puzzles/return; core/return.js): the endless kick return, after Subway Surfers.
// The camera rides behind the returner as he runs out of the stadium and on into a new place every 100 yards (the
// tailgate, the city, the frozen tundra, the desert, the farmers market, the beach, outer space, the farm: a touchdown
// under the goalposts into each), the barricades and banners across the lanes a row at a time (no coverage men: the
// owner's ask, Oct 2026) and the vehicles parked in them. A swipe on the stage (or the arrow keys) jukes a lane over,
// jumps (a barricade; up onto a low vehicle) or slides (under a banner; in the air, it drops him first). Ramps take him
// up onto the roofs. The power-ups he runs through: smelling salts (shake the linebacker off once), painkillers
// (nothing stops him for a bit) and booze (double yards for a bit, and the camera sways). A linebacker chases him down
// from behind (core CHASE): a hit (a barricade or banner he didn't clear, a vehicle he ran into) staggers him, slows
// him and puts the linebacker on his back, the screen's edges red; run on clean and the linebacker drops out of sight
// below. A hit while he's there (at the catch he starts there too) and he tackles him: a card says where, with Run it
// again (as many runs as you like, the best of the day counts: the owner's ask, Oct 2026), the scoreboard under it.
// Every 100 yards is a touchdown.
// The scene is drawn on a canvas (views/return-world.js: the places, the vehicles, the power-ups); the players are drawn
// and animated in it (views/return-runner.js: running, jumping, sliding, spinning, stumbling, going down), ours in navy,
// the linebacker in red. A power-up, picked up, says what it is and what it does.
// Exports: render(ctx), mount(el, ctx), params(el, ctx), unmount(el, ctx). Owner: RETURN.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as R from '../core/return.js';
import * as RP from './return-runner.js';
import * as W from './return-world.js';
import {seeded} from './stadium.js';
import {msToMidnight} from './board.js';
import {canTest, testRowHTML} from './testplay.js';

const esc = data.esc;
const nf = n => data.nf(n);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The version mark css/views/return.css carries (--rm-css): an older cached stylesheet gets the new one linked.
const CSS_V = '4';
function ensureCss() {
  try {
    if (getComputedStyle(document.documentElement).getPropertyValue('--rm-css').trim() === CSS_V) return;
    if (document.querySelector('link[data-rm-css]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.dataset.rmCss = '';
    l.href = new URL(`../../css/views/return.css?v=${CSS_V}`, import.meta.url).href;
    document.head.appendChild(l);
  } catch (_) {}
}
const STATE = new WeakMap(); // pane → its state
// Where a return ended, in a sentence ("Wrapped up in the Wild West").
const WHERE = {stadium: 'in the stadium', tailgate: 'at the tailgate', city: 'in the city', tundra: 'on the frozen tundra', desert: 'in the desert',
  market: 'at the farmers market', beach: 'on the beach', space: 'in outer space', farm: 'on the farm'};

// ============================================================================ Markup
/** A power-up's picture (the one on the road), as an image for the HUD and the cards. */
const ICON_URL = {};
function iconURL(kind) {
  if (ICON_URL[kind]) return ICON_URL[kind];
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'); c.translate(32, 34); c.scale(56, 56);
    W.ICONS[kind](c, .4);
    ICON_URL[kind] = cv.toDataURL();
  } catch (_) { ICON_URL[kind] = ''; }
  return ICON_URL[kind];
}
const iconHTML = (kind, size = 28) => `<img class="rm-ic" src="${iconURL(kind)}" width="${size}" height="${size}" alt="" draggable="false">`;
function keysHTML() {
  const k = (cls, label, what) => `<li class="rm-key"><span class="rm-kk ${cls}" aria-hidden="true">${label}</span><span>${what}</span></li>`;
  const pw = (kind, name, what) => `<li class="rm-pk">${iconHTML(kind, 34)}<b>${name}</b><span>${what}</span></li>`;
  return `<ul class="rm-keys" aria-label="How to play">`
    + k('is-lr', '← →', 'Swipe to juke a lane')
    + k('is-up', '↑', 'Jump a barricade, or onto a low one')
    + k('is-dn', '↓', 'Slide under a banner')
    + k('is-ramp', '◢', 'Run up a ramp onto the roofs')
    + k('is-chase', '!', 'The linebacker’s on your heels at the catch and after any hit. Hit something while he’s there: tackled')
    + `</ul><ul class="rm-pks" aria-label="Power-ups">`
    + pw('salts', 'Smelling salts', 'Shake the linebacker')
    + pw('pills', 'Painkillers', 'Feel nothing')
    + pw('booze', 'Booze', 'Double yards')
    + `</ul>`;
}
// Return Man is in beta (open to the league while the owner works on it, Oct 2026): a BETA tag on the cards before a
// kickoff, and a word about it on the first.
const BETA = '<span class="rm-beta">Beta</span>';
const betaLine = () => `<p class="rm-card-s rm-beta-l">${esc(`Still being worked on: ${(data.M[data.OWNER] || {name: 'the commissioner'}).name}’s tuning it, so it may change.`)}</p>`;
// The eyebrow over a kickoff: today's first, or which run of the day (as many as you like: the best one counts).
const koLabel = k => (k ? `Run ${k + 1} today` : 'Today’s kickoff');
/** The card over the stage: before a kickoff (the first of the day: how to play), after he's run down, or paused. */
function cardHTML(st) {
  const d = st.day, k = d.next;
  if (st.mode === 'paused') {
    return `<div class="rm-card-in"><p class="rm-card-o">${koLabel(st.run.k)}</p><h2 class="rm-card-t">Paused</h2>`
      + `<p class="rm-card-s">${esc(`${nf(Math.floor(st.run.yards))} yards and counting.`)}</p>`
      + ui.button({label: 'Keep running', icon: 'play-fill', attrs: {'data-rm-resume': ''}, cls: 'rm-go'}) + `</div>`;
  }
  // as many runs as you like (the owner's ask, Oct 2026): each ends with Run it again; the day's best is what counts
  const again = (label = 'Run it again') => ui.button({label, icon: 'play-fill', attrs: {'data-rm-go': ''}, cls: 'rm-go'});
  const sb = () => ui.button({label: 'See the scoreboard', kind: 'secondary', attrs: {'data-rm-sb': ''}, cls: 'rm-go'});
  const note = R.testing() ? '<p class="rm-card-s">Test play: not counted, not on the scoreboard.</p>' : '';
  if (st.mode === 'tackled') {
    const run = st.run, y = Math.floor(run.yards), tds = R.tdsAt(run.z), th = R.zoneAt(run.co, run.z).theme;
    const prev = d.list.slice(0, -1).reduce((m, e) => Math.max(m, e.y), 0); // (the best before this run)
    const best = d.runs > 1 && y > prev ? '<p class="rm-card-best">New best today!</p>'
      : d.runs > 1 ? `<p class="rm-card-s">${esc(`Your best today: ${nf(d.best)} yards`)}</p>` : '';
    return `<div class="rm-card-in"><p class="rm-card-o">${koLabel(run.k)}</p>`
      + `<p class="rm-big"><span class="n1">${esc(nf(y))}</span><small>yards</small></p>`
      + `<p class="rm-card-s">${esc(`${R.endOf(run)} ${WHERE[th.id]}.${tds ? ` ${plural(tds, 'touchdown')}!` : ''}`)}</p>`
      + best + note + again() + sb() + `</div>`;
  }
  if (k > 0) {
    // back for another: today's best to beat, and when the course changes
    return `<div class="rm-card-in is-day"><p class="rm-card-o">Return Man · ${esc(R.dayLabel(st.n))}${R.testing() ? ' · Test play' : ''} ${BETA}</p>`
      + `<p class="rm-big"><span class="n1">${esc(nf(d.best))}</span><small>yards, your best today</small></p>`
      + `<h2 class="rm-card-t">Run it back</h2>`
      + `<p class="rm-card-s">As many runs as you like. Your best one counts.</p>`
      + note + again('Field the kick') + sb()
      + `<p class="rm-card-t2">${ui.icon('clock', {size: 14})}<span data-rm-next>${esc(`New course in ${ui.untilText(msToMidnight())}`)}</span></p></div>`;
  }
  return `<div class="rm-card-in is-first"><p class="rm-card-o">${koLabel(0)}${R.testing() ? ' · Test play' : ''} ${BETA}</p>`
    + `<h2 class="rm-card-t">Take it to the house</h2>`
    + keysHTML() + betaLine()
    + again('Field the kick') + `</div>`;
}
function hudHTML() {
  return `<div class="rm-hud" aria-hidden="true">`
    + `<div class="rm-chip rm-yds" data-rm-ychip><span class="rm-yn" data-rm-yds>0</span><span class="rm-yu" data-rm-yu>yds</span></div>`
    // today's best (this run once it's beaten it)
    + `<span></span><div class="rm-chip rm-tot"><span class="rm-tn" data-rm-tot>0</span><span class="rm-yu">best</span></div>`
    + `<div class="rm-pows" data-rm-pows></div>`
    + `<div class="rm-got" data-rm-got hidden></div></div>`;
}
const SB_MODES = [{id: 'today', label: 'Today'}, {id: 'week', label: 'Week'}];
function rowHTML(r, mode) {
  const sub = mode === 'today' ? `Longest ${nf(r.l)}${r.td ? ` · ${plural(r.td, 'TD')}` : ''}` : `${plural(r.played, 'day')} · longest ${nf(r.l)}`;
  const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}${r.guest ? ', guest' : ''}: ${nf(r.y)} yards. ${sub}.`;
  return `<div class="c-brow-w" role="listitem"><div class="row c-brow rm-brow${r.me ? ' is-me' : ''}" aria-label="${esc(label)}">`
    + `<span class="c-brank n4${r.rank <= 3 ? ' is-r' + r.rank : ''}" aria-hidden="true">${r.rank}</span>`
    + `<span class="row-lead" aria-hidden="true">${ui.nickAvatar(r.name, {size: 36, managerId: r.managerId, you: r.me, crown: r.rank === 1 && r.y > 0})}</span>`
    + `<span class="row-main" aria-hidden="true"><span class="row-title"><span class="c-bnick">${esc(r.name)}</span>${r.me ? ui.badge('you') : r.guest ? ui.badge('guest') : ''}</span><span class="row-sub">${esc(sub)}</span></span>`
    + `<span class="row-trail" aria-hidden="true"><span class="n4 c-bval rm-bval">${esc(nf(r.y))}</span></span></div></div>`;
}
function boardBodyHTML(st) {
  const state = R.boardState();
  if (state === 'loading') return `<div class="c-board-sk">${ui.skeleton('rows', 3, {label: 'Loading the scoreboard.'})}</div>`;
  if (state !== 'ready') return `<p class="c-board-note">The scoreboard isn't connected right now.</p>`;
  let rows = [];
  try { rows = st.sbMode === 'week' ? R.weekRows(st.n) : R.boardRows(st.n); } catch (e) { console.error(e); }
  if (!rows.length) return `<div class="c-board-empty"><p class="c-board-et">${st.sbMode === 'week' ? 'No returns this week yet.' : 'Nobody’s run one back yet today.'}</p><p class="c-board-eb">Run yours back to put the first score up.</p></div>`;
  return `<p class="rm-sb-sum">${esc(st.sbMode === 'week' ? 'Return yards this week (Tuesday to Monday)' : `${plural(rows.length, 'returner')} today`)}</p>`
    + `<div class="c-brows" role="list" aria-label="${esc(st.sbMode === 'week' ? 'This week' : 'Today')}">${rows.map(r => rowHTML(r, st.sbMode)).join('')}</div>`;
}
function boardHTML(st) {
  return `<section class="card c-board rm-board" aria-labelledby="rm-sb-t"><div class="c-board-head"><h2 class="c-board-t" id="rm-sb-t">Scoreboard</h2></div>`
    + ui.seg({name: 'rm-sb', items: SB_MODES, value: st.sbMode, small: true, label: 'Scoreboard', cls: 'c-board-seg'})
    + `<div data-rm-sbody>${boardBodyHTML(st)}</div></section>`;
}
// While a return's on (or before the day's first), the scoreboard waits under the stage; between runs it shows.
const playing = st => !st.day.runs || st.mode === 'run' || st.mode === 'catch' || st.mode === 'paused';
function bodyHTML(st) {
  return `<div class="rm${playing(st) ? ' is-playing' : ''}" data-rm>`
    + `<div class="rm-stage" data-rm-stage data-hscroll aria-label="Return Man: swipe left or right to juke, up to jump, down to slide">`
    + `<canvas class="rm-cv" data-rm-cv></canvas>${hudHTML()}`
    + `<div class="rm-pop" data-rm-pop aria-hidden="true"></div>`
    + `<div class="rm-card" data-rm-card role="group" aria-live="polite">${cardHTML(st)}</div></div>`
    + `<div class="rm-fill" data-rm-fill></div>`
    + `<div class="rm-board-w" data-rm-board>${boardHTML(st)}</div>`
    + `<div data-rm-tp>${testRowHTML(R.testing(), 'data-rm-test')}</div></div>`;
}

// ============================================================================ The scene
// The world in yards (core/return.js): x across, y up, z ahead. The camera rides st.back behind the returner and
// st.camH up, looking ahead; it follows him across a lane only part of the way (so the lanes either side stay in
// view) and rises when he's up on a roof. The horizon is a third of the way down; his feet a fifth of the way up.
function screenRoom(st) {
  const scr = st.ctx && st.ctx.screen, tb = document.getElementById('tabbar');
  if (!scr) return 0;
  const nav = scr.querySelector(':scope > .nav'), top = nav ? nav.getBoundingClientRect().bottom : scr.getBoundingClientRect().top;
  const bottom = tb && tb.offsetHeight ? tb.getBoundingClientRect().top : (innerHeight || 0);
  return Math.round(bottom - top - 16);
}
function size(st) {
  const cv = st.cv, Wd = cv.parentElement.clientWidth || 360;
  const room = screenRoom(st);
  const H = Math.round(room > 300 ? Math.max(380, Math.min(860, room)) : Math.max(400, Math.min(640, Wd * 1.4, (innerHeight || 800) - 170)));
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(Wd * dpr); cv.height = Math.round(H * dpr);
  cv.style.height = H + 'px';
  st.W = Wd; st.H = H; st.dpr = dpr;
  st.f = Wd * 1.05;
  st.back = 7;
  st.y0 = Math.max(120, H * .32);
  const yRun = H - Math.max(96, H * .19);
  st.camH0 = (yRun - st.y0) * st.back / st.f;
  st.camH = st.camH0 + (st.lift || 0);
}
const P = (st, x, y, z) => W.P(st, x, y, z);

// ---------------------------------------------------------------- The players
// Each is drawn at his feet (views/return-runner.js), a man about 2 yards tall, with a shadow on what's under him.
const TALL_YD = 2.05, PAST = 1.8;
function shadow(st, c, x, y, z, w = .55) {
  if (z < st.camZ + W.NEAR) return;
  const p = P(st, x, y, z), r = P(st, x + w, y, z);
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(p.x, p.y, Math.abs(r.x - p.x), Math.max(1, Math.abs(r.x - p.x) * .3), 0, 0, Math.PI * 2); c.fill();
}
/** A player (kit K, pose J, o: how he's turned, leaned, pitched; views/return-runner.js draw) at his feet (x, y, z);
 *  see-through (alpha) drawn whole off to the side first, so his arms don't show through him. */
function player(st, c, K, J, x, y, z, o, alpha = 1) {
  if (z < st.camZ + W.NEAR + .3) return;
  const p = P(st, x, y, z);
  if (p.y < st.y0 - 40 || p.s * TALL_YD < 2) return;
  if (alpha >= 1) { RP.draw(st, c, x, y, z, K, J, o); return; }
  if (!st.ghost) st.ghost = document.createElement('canvas');
  const g = st.ghost, cv = st.cv;
  if (g.width !== cv.width || g.height !== cv.height) { g.width = cv.width; g.height = cv.height; }
  const gc = g.getContext('2d'), m = c.getTransform();
  // (just the box he's in, in the canvas's pixels)
  const xs = [], ys = [];
  [[p.x - 1.7 * p.s, p.y - 2.8 * p.s], [p.x + 1.7 * p.s, p.y - 2.8 * p.s], [p.x - 1.7 * p.s, p.y + .8 * p.s], [p.x + 1.7 * p.s, p.y + .8 * p.s]]
    .forEach(([a, b]) => { xs.push(m.a * a + m.c * b + m.e); ys.push(m.b * a + m.d * b + m.f); });
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const w = Math.min(g.width, Math.ceil(Math.max(...xs))) - x0, h = Math.min(g.height, Math.ceil(Math.max(...ys))) - y0;
  if (w <= 0 || h <= 0) return;
  gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(x0, y0, w, h);
  gc.setTransform(m);
  RP.draw(st, gc, x, y, z, K, J, o);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha;
  c.drawImage(g, x0, y0, w, h, x0, y0, w, h);
  c.restore();
}
function hint(st, c, type, x, z) {
  // Over a barricade or a banner (once it's close enough to read and not on top of you): the move that beats it, an
  // arrow up (jump) or down (slide).
  const p = P(st, x, type === 'bar' ? 3.05 : 1.6, z), r = Math.max(7, Math.min(15, p.s * .34));
  if (p.y < st.y0 + 4) return;
  const up = type === 'hurdle';
  c.fillStyle = up ? 'rgba(62,240,143,.92)' : 'rgba(255,205,74,.92)';
  c.beginPath(); c.arc(p.x, p.y - r, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#06210A'; c.lineWidth = Math.max(1.4, r * .2); c.lineCap = 'round'; c.lineJoin = 'round';
  const s = up ? 1 : -1, cy = p.y - r;
  c.beginPath(); c.moveTo(p.x - r * .42, cy + s * r * .2); c.lineTo(p.x, cy - s * r * .38); c.lineTo(p.x + r * .42, cy + s * r * .2); c.stroke();
  c.beginPath(); c.moveTo(p.x, cy - s * r * .3); c.lineTo(p.x, cy + s * r * .5); c.stroke();
}
/** The returner now (views/return-runner.js): his pose and how he's turned, leaned and pitched. Waiting for the kick,
 *  under it; then running (the ball tucked away), leaning into a juke and turning with it, spinning past a thing he's
 *  just juked, tucked up over a jump, landing in his knees, sliding in, staggering after a hit; going down. */
function runnerFig(st, now) {
  const run = st.run, t = now / 1000;
  if (!run || st.mode === 'ready') return {J: RP.stand(t), o: {}};
  if (st.mode === 'catch') return {J: RP.catching((now - st.catchAt) / CATCH_MS), o: {}};
  if (run.over) {
    // (forward and twisting to the side as he goes, so he lands across the screen, not straight away from us)
    const k = Math.min(1, (now - st.downAt) / 420);
    return {J: RP.mix(RP.run(run.z / 1.5 * Math.PI, {carry: true}), RP.sprawl({carry: true}), Math.min(1, k * 2.5)), o: {pitch: 1.5 * k * k, lift: .14 * k, turn: fallDir(run) * 1.1 * k}};
  }
  const g = R.groundAt(run.co, R.laneOf(run), run.z, run.y), h = run.y - g;
  const stum = run.slow > 0 ? run.slow / R.CHASE.slow : 0, land = st.landAt ? 1 - (now - st.landAt) / 170 : 0;
  let J = RP.run(run.z / 1.5 * Math.PI, {carry: true, lean: .2 + .25 * stum, stride: 1 - .25 * stum, sink: land > 0 ? .13 * land : 0});
  if (stum) RP.flail(J, stum, t);
  if (h > .02 || run.vy > 0) J = RP.mix(J, RP.air(h / .7, {carry: true}), Math.min(1, Math.max(h / .2, run.vy > 0 ? .6 : 0)));
  if (run.slide > 0) J = RP.mix(J, RP.slide(), Math.min(1, (R.MOVE.slide - run.slide) / .1, run.slide / .12));
  const cut = Math.max(-1, Math.min(1, (R.xOf(run, run.lane) - run.x) / R.LANE)), sp = st.spinAt ? (now - st.spinAt) / SPIN_MS : 1;
  return {J, o: {turn: .45 * cut + (sp < 1 ? st.spinDir * Math.PI * 2 * sp * sp * (3 - 2 * sp) : 0),
    roll: .28 * cut + stum * .2 * Math.sin(run.slow * 22)}};
}
const SPIN_MS = 380;
const fallDir = run => (run.x > .5 ? -1 : 1); // (which way he goes down: toward the middle, or to his right)
/** The dust he kicks up sliding in (k: how far into it), off his feet and his seat. */
function dust(st, c, x, y, z, now, k) {
  for (let i = 0; i < 6; i++) {
    const age = (now / 330 + i / 6) % 1, side = i % 2 ? 1 : -1;
    const q = P(st, x + side * (.2 + .5 * age), y + .08 + .45 * age, z + .9 - 1.3 * age - (i % 3) * .2);
    c.fillStyle = `rgba(226,214,190,${(.3 * (1 - age) * k).toFixed(3)})`;
    c.beginPath(); c.arc(q.x, q.y, (.1 + .26 * age) * q.s, 0, Math.PI * 2); c.fill();
  }
}
/** Everything in the lanes, far to near: the vehicles, the gates, the power-ups, the barricades and banners, him and
 *  the linebacker behind him. */
function drawLanes(st, c, now) {
  const run = st.run, t = now / 1000, list = [];
  const rz = run ? run.z : 0, rx = run ? run.x : 0, ry = run ? run.y : 0;
  if (run) {
    const A = R.ahead(run, 120, PAST + 2);
    A.sets.forEach(({set}) => set.plats.forEach(p => { const X = R.xOf(run, p.lane), w = p.hi ? 1.25 : 1.15; list.push({z: p.z1, veh: {x0: X - w, x1: X + w, z0: p.z0 - (p.ramp || 0), z1: p.z1}, x0: X - w, x1: X + w, draw: () => W.vehicle(st, c, p)}); }));
    A.items.forEach(({item}) => { if (!st.got.has(item.i)) { const X = R.xOf(run, item.lane); list.push({z: item.z, x0: X - .4, x1: X + .4, draw: () => W.item(st, c, item, t)}); } });
    A.rows.forEach(({row, d}) => row.lanes.forEach((type, l) => {
      if (!type || d < -PAST) return;
      // a barricade or banner where it stands (knocked flying when he hit it, or smashed through on painkillers)
      const knocked = st.knocked.get(`${row.i}:${l}`), k = knocked ? Math.min(1, (now - knocked.at) / 650) : 0;
      if (k >= 1) return;
      const z = rz + d, x = R.xOf(run, l);
      list.push({z, x0: x - 1.4, x1: x + 1.4, draw: () => {
        W.obstacle(st, c, type, l, z, k);
        if (!k && !run.over && d > 2.5 && d < 40 && st.mode === 'run' && ry < 1.2) hint(st, c, type, x, z);
      }});
    }));
    // the gates into the places ahead
    for (let g = Math.ceil((rz - st.back) / R.ZONE) * R.ZONE; g < rz + 140; g += R.ZONE) if (g > 0) list.push({z: g, draw: () => W.gate(st, c, g, R.zoneAt(run.co, g).theme, t)});
  } else {
    list.push({z: R.ZONE, draw: () => W.gate(st, c, R.ZONE, R.zoneAt(st.co, R.ZONE).theme, t)});
  }
  // the linebacker, chasing: just behind him (a step to the side, so he doesn't hide him) after a hit, then dropping away
  // below the screen as he runs on clean; diving at his back when he runs him down
  if (run) {
    const gap = R.gapOf(run), cz = rz - gap;
    if (cz > st.camZ + W.NEAR + .4) {
      const want = rx + (rx > .5 ? -1 : 1) * (run.over ? .35 : .95);
      st.chX = st.chX == null ? want : st.chX + (want - st.chX) * Math.min(1, (st.dt || .016) * 8);
      const caught = run.over && run.why === 'caught', cx = st.chX;
      // running him down (set while the kick's in the air); diving at his back when he gets there
      const k = caught ? Math.min(1, (now - st.downAt) / 380) : 0;
      const J = caught ? RP.mix(RP.run(cz / 1.4 * Math.PI, {pump: 1.25, lean: .3}), RP.dive(), Math.min(1, k * 3))
        : st.mode === 'catch' ? RP.stand(t) : RP.run(cz / 1.4 * Math.PI, {pump: 1.25, lean: .3});
      const o = caught ? {pitch: .3 + 1.2 * k * k * (3 - 2 * k), lift: .5 * Math.sin(Math.PI * k) + .1 * k, turn: fallDir(run) * .8 * k} : {turn: Math.max(-.3, Math.min(.3, (rx - cx) * .15))};
      list.push({z: cz, x0: cx - .5, x1: cx + .5, draw: () => {
        shadow(st, c, cx, 0, cz);
        player(st, c, RP.KITS.them, J, cx, 0, cz, o);
      }});
    }
  }
  const fig = runnerFig(st, now), g = run ? R.groundAt(run.co, R.laneOf(run), rz, ry) : 0, us = RP.KITS.us;
  list.push({z: rz, me: true, draw: () => {
    shadow(st, c, rx, g, rz, .5);
    if (run && !run.over && run.pills > 0) {
      // painkillers: he burns hot, a ring round his feet
      const k = Math.min(1, run.pills / .6), q = P(st, rx, ry + 1, rz), r = q.s * (1.45 + .15 * Math.sin(now / 90));
      const gr = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      gr.addColorStop(0, `rgba(255,190,80,${(.8 * k).toFixed(2)})`); gr.addColorStop(.45, `rgba(255,110,30,${(.4 * k).toFixed(2)})`); gr.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = gr; c.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      const f = P(st, rx, g, rz), rw = f.s * (.75 + .12 * Math.sin(now / 70));
      c.strokeStyle = `rgba(255,150,50,${(.85 * k).toFixed(2)})`; c.lineWidth = Math.max(1.5, f.s * .07);
      c.beginPath(); c.ellipse(f.x, f.y, rw, rw * .3, 0, 0, Math.PI * 2); c.stroke();
    }
    // booze: he's seeing double
    if (run && !run.over && run.booze > 0) player(st, c, us, fig.J, rx + .45 * Math.sin(now / 430), ry, rz + .2, fig.o, .32 * Math.min(1, run.booze / .8));
    // back up after the salts: he flickers while nothing can touch him
    const blink = run && !run.over && run.shield > 0 && !run.pills && Math.floor(now / 70) % 2;
    player(st, c, us, fig.J, rx, ry, rz, fig.o, blink ? .35 : 1);
    if (run && !run.over && run.slide > 0) dust(st, c, rx, g, rz, now, Math.min(1, run.slide / .25));
  }});
  // Far to near; but whatever stands beyond a vehicle's side from the camera (in a lane further over, beside it) goes
  // before that vehicle, so its body hides them, however long it is.
  list.forEach(it => { it.key = it.z; });
  const vehs = list.filter(it => it.veh);
  for (let pass = 0; pass < 2; pass++) list.forEach(it => {
    if (it.x0 == null) return;
    vehs.forEach(v => {
      if (v === it) return;
      const V = v.veh, dir = st.camX < V.x0 ? 1 : st.camX > V.x1 ? -1 : 0;
      if (!dir || !(dir > 0 ? it.x0 >= V.x1 - .01 : it.x1 <= V.x0 + .01)) return;
      const near = it.veh ? it.veh.z0 < V.z1 && it.veh.z1 > V.z0 : it.z >= V.z0 - 1 && it.z <= V.z1 + 1;
      if (near && it.key <= v.key) it.key = v.key + .001;
    });
  });
  list.sort((a, b) => b.key - a.key || b.z - a.z || (a.me ? 1 : b.me ? -1 : 0));
  list.forEach(it => it.draw());
  // the kick coming down into his hands
  if (st.mode === 'catch') {
    const p = Math.min(1, (now - st.catchAt) / CATCH_MS), y = TALL_YD * .55 + (1 - p) * (1 - p) * 26, z = rz + .3 + (1 - p) * 6;
    const q = P(st, rx + .15, y, z), sz = Math.max(4, q.s * .32);
    c.save(); c.translate(q.x, q.y); c.rotate(p * 9);
    c.fillStyle = '#7A3B1B'; c.beginPath(); c.ellipse(0, 0, sz, sz * .6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#F4F0E6'; c.lineWidth = Math.max(.8, sz * .12); c.beginPath(); c.moveTo(-sz * .35, 0); c.lineTo(sz * .35, 0); c.stroke();
    c.restore();
  }
}
/** Speed lines at the sides once he's flying. */
function drawSpeed(st, c, now) {
  const run = st.run;
  if (!run || st.mode !== 'run') return;
  const v = R.speedAt(run.z), k = Math.max(0, (v - 13) / 6) + (run.pills > 0 ? .6 : 0);
  if (k <= 0) return;
  const r = seeded(Math.floor(now / 70));
  c.strokeStyle = `rgba(255,255,255,${(.18 * Math.min(1.3, k)).toFixed(2)})`; c.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, x = st.W / 2 + side * (st.W * (.36 + r() * .16)), y = st.y0 + (st.H - st.y0) * (.2 + r() * .7), len = 18 + r() * 40 * k;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + side * len * .25, y + len); c.stroke();
  }
}
function draw(st, now = performance.now()) {
  const c = st.c2;
  if (!c || !st.W) return;
  c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  const run = st.run, dt = st.dt || .016;
  st.co = run ? run.co : R.course(st.n, 0);
  // the camera: behind him, following him across part of the way; up when he's up top; a jolt off a vehicle's side
  const bump = run && run.t - run.bump < .22 ? Math.sin((run.t - run.bump) * 60) * .25 * (1 - (run.t - run.bump) / .22) : 0;
  const sh = st.hitAt ? (now - st.hitAt) / 320 : 1, shake = sh < 1 ? Math.sin(sh * 26) * .3 * (1 - sh) : 0; // a stumble's jolt
  const tx = (run ? run.x : 0) * .6 + bump + shake;
  st.camX = st.camX == null ? tx : st.camX + (tx - st.camX) * Math.min(1, dt * 9);
  const lift = run && !run.over ? R.groundAt(run.co, R.laneOf(run), run.z, run.y) * .8 : st.lift || 0;
  st.lift = (st.lift || 0) + (lift - (st.lift || 0)) * Math.min(1, dt * 3.5);
  st.camH = st.camH0 + st.lift;
  st.camZ = (run ? run.z : 0) - st.back;
  const z = run ? run.z : 0, t = now / 1000;
  st.t = t;
  // booze: the world sways
  const drunk = run && !run.over ? Math.min(1, run.booze / .8) : 0;
  if (drunk > 0) {
    c.fillStyle = '#1A1408'; c.fillRect(0, 0, st.W, st.H);
    c.translate(st.W / 2, st.H * .62); c.rotate(.045 * drunk * Math.sin(t * 1.7)); c.scale(1.07, 1.07); c.translate(-st.W / 2 + 6 * drunk * Math.sin(t * 1.1), -st.H * .62);
  }
  W.sky(st, c, t, z);
  W.ground(st, c);
  W.sides(st, c);
  drawSpeed(st, c, now);
  drawLanes(st, c, now);
  W.weather(st, c, t, z);
  c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  if (!st.vig || st.vig.w !== st.W || st.vig.h !== st.H) {
    const g = c.createRadialGradient(st.W / 2, st.H * .55, st.H * .3, st.W / 2, st.H * .55, st.H * .85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    st.vig = {w: st.W, h: st.H, g};
  }
  c.fillStyle = st.vig.g; c.fillRect(0, 0, st.W, st.H);
  // the power-ups' tints: booze warm at the edges, painkillers hot; the salts' flash
  const edge = (col, a) => { const g = c.createRadialGradient(st.W / 2, st.H * .55, st.H * .28, st.W / 2, st.H * .55, st.H * .8); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a.toFixed(2)})`); c.fillStyle = g; c.fillRect(0, 0, st.W, st.H); };
  if (drunk > 0) edge('214,150,40', .35 * drunk);
  if (run && !run.over && run.pills > 0) edge('255,110,40', .42 * Math.min(1, run.pills / .8) * (.75 + .25 * Math.sin(t * 9)));
  // the linebacker on your back (at the catch and after a hit, till you've lost him: a hit now is a tackle): red at the
  // edges, beating faster the closer he is
  if (R.chasing(run)) {
    const close = .35 + .65 * (1 - (R.gapOf(run) - R.CHASE.near) / (R.CHASE.edge - R.CHASE.near));
    edge('214,24,40', .5 * close * (.7 + .3 * Math.sin(t * (6 + 6 * close))));
  }
  const flash = st.flashAt ? 1 - (now - st.flashAt) / 450 : 0;
  if (flash > 0) { c.fillStyle = `rgba(235,250,255,${(.75 * flash).toFixed(2)})`; c.fillRect(0, 0, st.W, st.H); }
}

// ============================================================================ Play
const CATCH_MS = 750;
function setDay(st, n) {
  st.n = n;
  st.day = R.dayState(n);
}
function patchHud(st) {
  const el = st.el, run = st.run, live = run && st.mode !== 'ready', y = live ? Math.floor(run.yards) : 0;
  const yd = el.querySelector('[data-rm-yds]'); if (yd && yd.textContent !== String(y)) yd.textContent = String(y);
  const tot = el.querySelector('[data-rm-tot]'), t = nf(Math.max(st.day.best, run && !run.over && st.mode !== 'ready' ? y : 0));
  if (tot && tot.textContent !== t) tot.textContent = t;
  // the power-ups he's carrying: the salts, and what's left of the painkillers and the booze
  const on = live && !run.over, x2 = on && run.booze > 0;
  const chip = el.querySelector('[data-rm-ychip]'); if (chip) chip.classList.toggle('is-x2', !!x2);
  const yu = el.querySelector('[data-rm-yu]'); if (yu && yu.textContent !== (x2 ? 'yds ×2' : 'yds')) yu.textContent = x2 ? 'yds ×2' : 'yds';
  const pw = el.querySelector('[data-rm-pows]');
  if (pw) {
    const list = on ? [run.salts > 0 && 'salts', run.pills > 0 && 'pills', run.booze > 0 && 'booze'].filter(Boolean) : [];
    const key = list.join() + (on ? run.salts : '');
    if (pw.dataset.key !== key) {
      pw.dataset.key = key;
      pw.innerHTML = list.map(k => `<span class="rm-chip rm-pw is-${k}">${iconHTML(k, 22)}${k === 'salts' ? `<b>×${run.salts}</b>` : `<i class="rm-bar"><b data-rm-bar="${k}"></b></i>`}</span>`).join('');
    }
    if (on) pw.querySelectorAll('[data-rm-bar]').forEach(b => { const k = b.dataset.rmBar; b.style.transform = `scaleX(${Math.max(0, Math.min(1, run[k] / R.POWER[k].s)).toFixed(3)})`; });
  }
}
function setCard(st, show) {
  const card = st.el.querySelector('[data-rm-card]');
  if (!card) return;
  if (show) { card.innerHTML = cardHTML(st); ui.hydrate(card); }
  card.hidden = !show;
  st.el.querySelector('[data-rm]').classList.toggle('is-playing', playing(st));
  if (show && !ui.RM) ui.animate(card.firstElementChild, [{opacity: 0, transform: 'translateY(10px) scale(.98)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
}
function pop(st, text, cls = '', sub = '') {
  const el = st.el.querySelector('[data-rm-pop]');
  if (!el) return;
  el.textContent = text;
  if (sub) { const sm = document.createElement('small'); sm.textContent = sub; el.appendChild(sm); }
  el.className = 'rm-pop' + (cls ? ' ' + cls : '');
  void el.offsetWidth;
  el.classList.add('is-on');
}
/** A kickoff: the ball comes down into his hands, then he's off. */
function go(st) {
  if (st.mode === 'run' || st.mode === 'catch') return;
  st.run = R.startRun(st.n, st.day.next);
  st.knocked = new Map(); st.got = new Set(); st.flashAt = 0; st.hitAt = 0; st.chX = null; st.spinAt = 0; st.landAt = 0;
  ungot(st);
  st.co = st.run.co;
  W.warm(st, 0);
  st.mode = 'catch'; st.catchAt = performance.now();
  setCard(st, false);
  patchHud(st);
  ui.haptic('light');
  fitScreen(st, true);
  loop(st);
}
function tackled(st) {
  st.mode = 'tackled'; st.downAt = performance.now();
  ungot(st);
  ui.haptic('error');
  st.day = R.record(st.n, st.run.k, st.run.yards, st.run.z) || R.dayState(st.n);
  R.autoPost();
  patchHud(st);
  st.later = setTimeout(() => { if (!st.dead) { setCard(st, true); patchBoard(st); } }, ui.RM ? 200 : 950);
}
/** A power-up he's just picked up: what it is and what it does, under the HUD for a moment. */
const GOT_MS = 3200;
function got(st, kind) {
  const el = st.el.querySelector('[data-rm-got]'), p = R.POWER[kind];
  if (!el) return;
  el.className = 'rm-got is-' + kind;
  el.innerHTML = `${iconHTML(kind, 40)}<span class="rm-got-t"><b>${esc(p.name)}</b><span>${esc(p.is)}</span><strong>${esc(p.does)}</strong></span>`;
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('is-on');
  clearTimeout(st.gotT);
  st.gotT = setTimeout(() => { el.hidden = true; }, ui.RM ? 4500 : GOT_MS);
}
function ungot(st) {
  clearTimeout(st.gotT);
  const el = st.el && st.el.querySelector('[data-rm-got]');
  if (el) el.hidden = true;
}
function onEvents(st, evs) {
  const now = performance.now();
  evs.forEach(e => {
    // a touchdown is the way into the next place: the call says both
    if (e.type === 'td') {
      const into = evs.find(x => x.type === 'zone');
      pop(st, 'TOUCHDOWN!', 'is-td', into ? `Welcome to ${into.theme.name.replace(/^The /, 'the ')}` : '');
      st.cheer = now + 2600; ui.haptic('success'); ui.announce(`Touchdown! ${plural(e.n, 'touchdown')}.${into ? ` ${into.theme.name}.` : ''}`);
    }
    else if (e.type === 'zone') { W.warm(st, e.z); if (!evs.some(x => x.type === 'td')) pop(st, e.theme.name.toUpperCase(), 'is-zone'); }
    else if (e.type === 'juked') { pop(st, 'SPIN MOVE!'); st.spinAt = now; st.spinDir = Math.sign(R.xOf(st.run, st.run.lane) - st.run.jFrom) || 1; }
    else if (e.type === 'hurdled') { pop(st, 'HURDLE!'); ui.haptic('light'); }
    else if (e.type === 'slid') { pop(st, 'SLIDE!'); ui.haptic('light'); }
    else if (e.type === 'pickup') { st.got.add(e.item.i); got(st, e.kind); ui.haptic('success'); ui.announce(`${R.POWER[e.kind].name}: ${R.POWER[e.kind].is}. ${R.POWER[e.kind].does}.`); }
    else if (e.type === 'landed') st.landAt = now;
    else if (e.type === 'trucked') { st.knocked.set(`${e.row.i}:${e.lane}`, {at: now}); pop(st, 'SMASHED!', 'is-pills'); ui.haptic('medium'); }
    else if (e.type === 'vaulted') { pop(st, 'OVER THE TOP!', 'is-pills'); ui.haptic('medium'); }
    else if (e.type === 'stumbled') {
      st.hitAt = now; pop(st, 'STUMBLE!', 'is-hit', 'The linebacker’s on you'); ui.haptic('warning');
      ui.announce(`${R.hitLine(e)}. The linebacker’s on you: another hit now and he’ll tackle you.`);
      if (e.row) st.knocked.set(`${e.row.i}:${e.lane}`, {at: now});
    }
    else if (e.type === 'shoved') { if (e.row) st.knocked.set(`${e.row.i}:${e.lane}`, {at: now}); }
    else if (e.type === 'revived') {
      st.flashAt = now; pop(st, 'SHOOK HIM!', 'is-salts', 'The smelling salts'); ui.haptic('warning');
      if (e.row) st.knocked.set(`${e.row.i}:${e.lane}`, {at: now});
    }
    else if (e.type === 'tackled') tackled(st);
  });
}
function frame(st, now) {
  const dt = Math.min(.05, Math.max(0, (now - (st.last || now)) / 1000));
  st.last = now; st.dt = dt;
  // off screen (another tab, a sheet over it): the return waits
  if ((st.mode === 'run' || st.mode === 'catch') && !st.ctx.visible) { pause(st); return; }
  if (st.mode === 'catch' && now - st.catchAt >= CATCH_MS) st.mode = 'run';
  if (st.mode === 'run') {
    const bumped = st.run.bump;
    onEvents(st, R.step(st.run, dt));
    if (st.run.bump !== bumped) ui.haptic('medium');
    if (st.mode === 'run' && now - (st.kept || 0) > 500) { st.kept = now; keep(st); }
  }
  draw(st, now);
  patchHud(st);
}
const keep = st => R.keepLive(st.n, st.run.k, st.run.yards, st.run.z);
function loop(st) {
  if (st.raf || st.dead) return;
  st.last = 0;
  const tick = now => {
    st.raf = 0;
    if (st.dead) return;
    frame(st, now);
    const moving = st.mode === 'run' || st.mode === 'catch' || (st.mode === 'tackled' && now - st.downAt < 1400);
    if (moving) st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}
function pause(st) {
  if (st.mode !== 'run' && st.mode !== 'catch') return;
  st.mode = 'paused';
  if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
  keep(st);
  setCard(st, true);
}
function resume(st) {
  if (st.mode !== 'paused') return;
  st.mode = 'run';
  setCard(st, false);
  fitScreen(st, true);
  loop(st);
}
/** A swipe (or a key): the move. */
function swipe(st, dir) {
  if (st.mode !== 'run' || !st.run) return;
  if (R.move(st.run, dir)) ui.haptic(dir === 'left' || dir === 'right' ? 'selection' : 'light');
}
// ---------------------------------------------------------------- Input
const SWIPE = 22; // px before a drag counts as a swipe (it goes the moment it does, not on lifting)
function onDown(st, e) {
  // only on the field while a return's on (a card's buttons keep their taps: a captured pointer would take them)
  if (e.button > 0 || !e.isPrimary || (st.mode !== 'run' && st.mode !== 'catch') || e.target.closest('[data-rm-card]')) return;
  st.ptr = {id: e.pointerId, x: e.clientX, y: e.clientY, fired: false};
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
}
function onMove(st, e) {
  const p = st.ptr;
  if (!p || p.id !== e.pointerId || p.fired) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
  p.fired = true;
  swipe(st, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
}
function onUp(st, e) {
  const p = st.ptr;
  if (!p || p.id !== e.pointerId) return;
  st.ptr = null;
  if (p.fired) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= 12) swipe(st, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
}
const KEYS = {ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ' ': 'up', ArrowDown: 'down', s: 'down', S: 'down'};
function onKey(st, e) {
  if (!st.ctx.visible || e.metaKey || e.ctrlKey || e.altKey) return;
  const dir = KEYS[e.key];
  if (!dir || (st.mode !== 'run' && st.mode !== 'catch')) return;
  if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
  e.preventDefault();
  swipe(st, dir);
}

// ---------------------------------------------------------------- The page
/** While a return's on, the stage fills the screen between the nav bar and the tab bar. */
function fitScreen(st, smooth) {
  const scr = st.ctx.screen, stage = st.el.querySelector('[data-rm-stage]');
  if (!scr || !stage || !st.ctx.visible) return;
  const nav = scr.querySelector(':scope > .nav'), navB = nav ? nav.getBoundingClientRect().bottom : scr.getBoundingClientRect().top;
  const want = scr.scrollTop + stage.getBoundingClientRect().top - navB - 8;
  const fill = st.el.querySelector('[data-rm-fill]');
  const max = scr.scrollHeight - scr.clientHeight;
  if (fill && want > max) fill.style.height = Math.ceil(want - max + (parseFloat(fill.style.height) || 0)) + 'px';
  if (Math.abs(scr.scrollTop - want) > 2) scr.scrollTo({top: want, behavior: smooth && !ui.RM ? 'smooth' : 'auto'});
}
function patchBoard(st) {
  const b = st.el.querySelector('[data-rm-sbody]');
  if (!b) return;
  const html = boardBodyHTML(st);
  if (b.dataset.html === html) return;
  b.dataset.html = html;
  b.innerHTML = html;
  ui.hydrate(b);
}
/** The owner's Test play (views/testplay.js): today's kickoff fresh in the sandbox, or back to the real day. */
function testPlay(st, on) {
  if (!canTest() || st.mode === 'run' || st.mode === 'catch') return;
  R.setTest(on, st.n);
  clearTimeout(st.later);
  st.run = null; st.mode = 'ready';
  setDay(st, st.n);
  const tp = st.el.querySelector('[data-rm-tp]');
  if (tp) { tp.innerHTML = testRowHTML(R.testing(), 'data-rm-test'); ui.hydrate(tp); }
  setCard(st, true);
  patchHud(st); patchBoard(st); draw(st);
  ui.haptic('medium');
  fitScreen(st, true);
  ui.announce(on ? 'Test play: today’s kickoff, fresh. It won’t count.' : 'Test play over: back to your real day.');
}
function onClick(st, e) {
  const t = e.target.closest('[data-rm-go], [data-rm-resume], [data-rm-sb], [data-rm-test]');
  if (!t || !st.el.contains(t)) return;
  if (t.hasAttribute('data-rm-go')) { if (st.mode === 'tackled') { st.mode = 'ready'; st.run = null; } go(st); return; }
  if (t.hasAttribute('data-rm-resume')) { resume(st); return; }
  if (t.hasAttribute('data-rm-sb')) { const b = st.el.querySelector('[data-rm-board]'); if (b) b.scrollIntoView({behavior: ui.RM ? 'auto' : 'smooth', block: 'start'}); return; }
  if (t.hasAttribute('data-rm-test')) testPlay(st, t.dataset.rmTest === 'on');
}
function tick(st) {
  // a new day at midnight: the next kickoff
  if (R.todayNumber() !== st.n && st.mode !== 'run' && st.mode !== 'catch') {
    st.run = null; st.mode = 'ready'; setDay(st, R.todayNumber()); setCard(st, true); patchHud(st); patchBoard(st); draw(st);
  }
  const nx = st.el.querySelector('[data-rm-next]');
  if (nx) nx.textContent = `New course in ${ui.untilText(msToMidnight())}`;
}

export function render(ctx) {
  const st = {n: R.todayNumber(), mode: 'ready', sbMode: 'today', run: null};
  setDay(st, st.n);
  return bodyHTML(st);
}
export function mount(el, ctx) {
  ensureCss();
  const st = {el, ctx, mode: 'ready', sbMode: 'today', run: null, knocked: new Map(), got: new Set(), dead: false, raf: 0, camX: null, cheer: 0, lift: 0};
  STATE.set(el, st);
  // a return left under way (the app closed mid-run) ends where it was
  R.settle(R.todayNumber());
  setDay(st, R.todayNumber());
  el.innerHTML = bodyHTML(st);
  ui.hydrate(el);
  st.cv = el.querySelector('[data-rm-cv]');
  st.c2 = st.cv.getContext('2d');
  st.cv.__rm = st; // (for the tests: the return under way)
  size(st); patchHud(st); draw(st);
  const stage = el.querySelector('[data-rm-stage]');
  st.on = {
    down: e => onDown(st, e), move: e => onMove(st, e), up: e => onUp(st, e), key: e => onKey(st, e), click: e => onClick(st, e),
    change: e => {
      if (!e.detail || e.detail.name !== 'rm-sb') return;
      e.stopPropagation();
      const m = e.detail.value;
      if (!SB_MODES.some(x => x.id === m) || m === st.sbMode) return;
      st.sbMode = m;
      const seg = el.querySelector('.rm-board .c-board-seg');
      if (seg) ui.setSeg(seg, m, {animate: true});
      patchBoard(st);
    },
    resize: () => { size(st); draw(st); fitScreen(st, false); },
    vis: () => { if (document.visibilityState === 'hidden') pause(st); },
    leave: () => { if (st.run && (st.mode === 'run' || st.mode === 'catch' || st.mode === 'paused')) keep(st); }
  };
  stage.addEventListener('pointerdown', st.on.down);
  stage.addEventListener('pointermove', st.on.move);
  stage.addEventListener('pointerup', st.on.up);
  stage.addEventListener('pointercancel', st.on.up);
  el.addEventListener('click', st.on.click);
  el.addEventListener('ui:change', st.on.change);
  addEventListener('keydown', st.on.key);
  addEventListener('resize', st.on.resize, {passive: true});
  addEventListener('pagehide', st.on.leave);
  document.addEventListener('visibilitychange', st.on.vis);
  st.unsub = daily.subscribe(type => { if (type === 'lb' || type === 'ready' || type === 'error') patchBoard(st); });
  st.stopTick = ctx.timer(() => tick(st), 20000);
  // the stands twinkle while nothing's moving
  st.stopLife = ctx.timer(() => { if (!st.raf && !ui.RM && st.cv.getBoundingClientRect().bottom > 0) draw(st); }, 90);
  R.autoPost();
  requestAnimationFrame(() => { if (st.dead) return; size(st); draw(st); fitScreen(st, true); });
}
export function params(el, ctx) {
  const st = STATE.get(el);
  if (!st) return;
  requestAnimationFrame(() => { if (st.dead) return; size(st); draw(st); fitScreen(st, true); });
  tick(st); patchBoard(st);
}
export function unmount(el, ctx) {
  const st = STATE.get(el);
  if (!st) return;
  // a return under way when the page goes: it counts where it got to (no kickoff run twice)
  if (st.run && (st.mode === 'run' || st.mode === 'catch' || st.mode === 'paused')) { keep(st); R.settle(st.n); R.autoPost(); }
  st.dead = true;
  clearTimeout(st.later); clearTimeout(st.gotT);
  if (st.raf) cancelAnimationFrame(st.raf);
  const stage = el.querySelector('[data-rm-stage]');
  if (stage) {
    stage.removeEventListener('pointerdown', st.on.down);
    stage.removeEventListener('pointermove', st.on.move);
    stage.removeEventListener('pointerup', st.on.up);
    stage.removeEventListener('pointercancel', st.on.up);
  }
  el.removeEventListener('click', st.on.click);
  el.removeEventListener('ui:change', st.on.change);
  removeEventListener('keydown', st.on.key);
  removeEventListener('resize', st.on.resize);
  removeEventListener('pagehide', st.on.leave);
  document.removeEventListener('visibilitychange', st.on.vis);
  if (st.unsub) st.unsub();
  if (st.stopTick) st.stopTick();
  if (st.stopLife) st.stopLife();
  STATE.delete(el);
}
