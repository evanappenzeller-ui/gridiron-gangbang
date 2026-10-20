// Return Man (Daily Games, its own page /puzzles/return; core/return.js): the endless kick return, after Subway Surfers.
// The camera rides behind the returner as he runs out of the stadium and on into a new place every 100 yards (the
// tailgate, the city, the frozen tundra, the desert, the farmers market, the beach, outer space, the farm: a touchdown
// under the goalposts into each), the coverage team coming at him a row at a time and the vehicles parked in the
// lanes. A swipe on the stage (or the arrow keys) jukes a lane over, jumps (over a man diving at his legs, up onto a low one),
// or spins out of a wrap-up (and in the air, drops him). Ramps take him up onto the roofs. The power-ups he runs
// through: smelling salts (back up after the next hit), painkillers (nothing stops him for a bit) and booze (double
// yards for a bit, and the camera sways). The first hit he can't take ends the return: a card says what got him and
// where, and the next kickoff waits for a tap. Three kickoffs a day; after the third the stage holds the day's card
// and the scoreboard shows under it. Every 100 yards is a touchdown.
// The scene is drawn on a canvas (views/return-world.js: the places, the vehicles, the power-ups); the players are the
// Two-Minute Drill's pictures (views/drill-sprites.js), ours in navy, theirs in red, with drawn ones till those load.
// Exports: render(ctx), mount(el, ctx), params(el, ctx), unmount(el, ctx). Owner: RETURN.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as R from '../core/return.js';
import * as SP from './drill-sprites.js';
import * as W from './return-world.js';
import {seeded} from './stadium.js';
import {msToMidnight} from './board.js';
import {canTest, testRowHTML} from './testplay.js';

const esc = data.esc;
const nf = n => data.nf(n);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The version mark css/views/return.css carries (--rm-css): an older cached stylesheet gets the new one linked.
const CSS_V = '3';
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
const US = ['#1D3F8F'], THEM = ['#C8102E'];
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
const KO_WORDS = ['Take it to the house', 'Second kickoff', 'Last kickoff'];
function keysHTML() {
  const k = (cls, label, what) => `<li class="rm-key"><span class="rm-kk ${cls}" aria-hidden="true">${label}</span><span>${what}</span></li>`;
  const pw = (kind, name, what) => `<li class="rm-pk">${iconHTML(kind, 34)}<b>${name}</b><span>${what}</span></li>`;
  return `<ul class="rm-keys" aria-label="How to play">`
    + k('is-lr', '← →', 'Swipe to juke a lane')
    + k('is-up', '↑', 'Jump: over a dive, onto a low one')
    + k('is-dn', '↓', 'Spin out of a wrap-up')
    + k('is-ramp', '◢', 'Run up a ramp onto the roofs')
    + `</ul><ul class="rm-pks" aria-label="Power-ups">`
    + pw('salts', 'Smelling salts', 'Get back up')
    + pw('pills', 'Painkillers', 'Feel nothing')
    + pw('booze', 'Booze', 'Double yards')
    + `</ul>`;
}
const soFar = list => list.length ? `So far: ${list.map(e => nf(e.y)).join(' + ')}${list.length > 1 ? ` = ${nf(R.score(list).yards)}` : ''} yards` : '';
/** The card over the stage: before a kickoff, after a tackle, paused, or the day's last word. */
function cardHTML(st) {
  const d = st.day, k = d.next;
  if (st.mode === 'paused') {
    return `<div class="rm-card-in"><p class="rm-card-o">Kickoff ${st.run.k + 1} of ${R.RETURNS}</p><h2 class="rm-card-t">Paused</h2>`
      + `<p class="rm-card-s">${esc(`${nf(Math.floor(st.run.yards))} yards and counting.`)}</p>`
      + ui.button({label: 'Keep running', icon: 'play-fill', attrs: {'data-rm-resume': ''}, cls: 'rm-go'}) + `</div>`;
  }
  if (st.mode === 'tackled') {
    const run = st.run, y = Math.floor(run.yards), tds = R.tdsAt(run.z), th = R.zoneAt(run.co, run.z).theme;
    const next = d.done ? ui.button({label: 'See the day', attrs: {'data-rm-day': ''}, cls: 'rm-go'})
      : ui.button({label: `Next kickoff (${k + 1} of ${R.RETURNS})`, icon: 'play-fill', attrs: {'data-rm-go': ''}, cls: 'rm-go'});
    return `<div class="rm-card-in"><p class="rm-card-o">Kickoff ${run.k + 1} of ${R.RETURNS}</p>`
      + `<p class="rm-big"><span class="n1">${esc(nf(y))}</span><small>yards</small></p>`
      + `<p class="rm-card-s">${esc(`${R.endOf(run)} ${WHERE[th.id]}.${tds ? ` ${plural(tds, 'touchdown')}!` : ''}`)}</p>`
      + `${next}</div>`;
  }
  if (d.done) {
    const s = d.official || d, head = s.yards >= 1500 ? 'Unstoppable.' : s.yards >= 800 ? 'House call machine.' : s.yards >= 400 ? 'Electric.'
      : s.yards >= 180 ? 'Great field position.' : s.yards >= 80 ? 'Solid returns.' : 'Fair catch next time?';
    return `<div class="rm-card-in is-day"><p class="rm-card-o">Return Man · ${esc(R.dayLabel(st.n))}</p>`
      + `<p class="rm-big"><span class="n1">${esc(nf(s.yards))}</span><small>yards</small></p>`
      + `<h2 class="rm-card-t">${esc(head)}</h2>`
      + `<p class="rm-card-s">${esc(`${s.list.map(e => nf(e.y)).join(' + ')}. Longest ${nf(s.longest)}${s.tds ? ` · ${plural(s.tds, 'touchdown')}` : ''}.`)}</p>`
      + (R.testing() ? '<p class="rm-card-s">Test play: not counted, not on the scoreboard.</p>' : '')
      + ui.button({label: 'See the scoreboard', kind: 'secondary', attrs: {'data-rm-sb': ''}, cls: 'rm-go'})
      + `<p class="rm-card-t2">${ui.icon('clock', {size: 14})}<span data-rm-next>${esc(`New kickoffs in ${ui.untilText(msToMidnight())}`)}</span></p></div>`;
  }
  return `<div class="rm-card-in${k === 0 ? ' is-first' : ''}"><p class="rm-card-o">Kickoff ${k + 1} of ${R.RETURNS}${R.testing() ? ' · Test play' : ''}</p>`
    + `<h2 class="rm-card-t">${esc(KO_WORDS[k] || KO_WORDS[0])}</h2>`
    + (k === 0 ? keysHTML() : `<p class="rm-card-s">${esc(soFar(d.list))}</p>`)
    + ui.button({label: 'Field the kick', icon: 'play-fill', attrs: {'data-rm-go': ''}, cls: 'rm-go'}) + `</div>`;
}
function hudHTML() {
  return `<div class="rm-hud" aria-hidden="true">`
    + `<div class="rm-chip rm-yds" data-rm-ychip><span class="rm-yn" data-rm-yds>0</span><span class="rm-yu" data-rm-yu>yds</span></div>`
    + `<div class="rm-chip rm-kos" data-rm-kos></div>`
    + `<div class="rm-chip rm-tot"><span class="rm-tn" data-rm-tot>0</span><span class="rm-yu">today</span></div>`
    + `<div class="rm-pows" data-rm-pows></div></div>`;
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
  if (!rows.length) return `<div class="c-board-empty"><p class="c-board-et">${st.sbMode === 'week' ? 'No returns this week yet.' : 'Nobody’s run one back yet today.'}</p><p class="c-board-eb">Run your three to put the first score up.</p></div>`;
  return `<p class="rm-sb-sum">${esc(st.sbMode === 'week' ? 'Return yards this week (Tuesday to Monday)' : `${plural(rows.length, 'returner')} today`)}</p>`
    + `<div class="c-brows" role="list" aria-label="${esc(st.sbMode === 'week' ? 'This week' : 'Today')}">${rows.map(r => rowHTML(r, st.sbMode)).join('')}</div>`;
}
function boardHTML(st) {
  return `<section class="card c-board rm-board" aria-labelledby="rm-sb-t"><div class="c-board-head"><h2 class="c-board-t" id="rm-sb-t">Scoreboard</h2></div>`
    + ui.seg({name: 'rm-sb', items: SB_MODES, value: st.sbMode, small: true, label: 'Scoreboard', cls: 'c-board-seg'})
    + `<div data-rm-sbody>${boardBodyHTML(st)}</div></section>`;
}
function bodyHTML(st) {
  return `<div class="rm${st.day.done ? '' : ' is-playing'}" data-rm>`
    + `<div class="rm-stage" data-rm-stage data-hscroll aria-label="Return Man: swipe left or right to juke, up to jump, down to spin">`
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
// Each is drawn at his feet, his height by how far he is (a man is 2 yards), with a shadow on what's under him. While
// the pictures load, drawn ones stand in.
const TALL_YD = 2.05, PAST = 1.8, CHARGE = 16;
function shadow(st, c, x, y, z, w = .55) {
  if (z < st.camZ + W.NEAR) return;
  const p = P(st, x, y, z), r = P(st, x + w, y, z);
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(p.x, p.y, Math.abs(r.x - p.x), Math.max(1, Math.abs(r.x - p.x) * .3), 0, 0, Math.PI * 2); c.fill();
}
/** mo: how he's moving (drill-sprites.js giveOf: his stride, a lean, a jump). */
function sprite(st, c, f, flip, team, x, y, z, alpha = 1, mo = null) {
  if (z < st.camZ + W.NEAR) return;
  const p = P(st, x, y, z), tall = p.s * TALL_YD;
  if (p.y < st.y0 - 40 || tall < 2) return;
  c.globalAlpha = alpha;
  if (SP.ready() && SP.hasFrame(f)) {
    // (the pictures draw in device pixels: through the camera's sway, if any)
    const m = c.getTransform(), k = Math.hypot(m.a, m.b);
    SP.draw(c, {f, flip}, team, true, m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f, tall * k, mo);
    c.setTransform(m);
  } else {
    const low = /dive|flat|down|fallen/.test(f);
    c.fillStyle = team[0];
    if (low) { c.beginPath(); c.ellipse(p.x, p.y - tall * .12, tall * .42, tall * .12, 0, 0, Math.PI * 2); c.fill(); }
    else {
      c.beginPath(); c.roundRect ? c.roundRect(p.x - tall * .17, p.y - tall * .78, tall * .34, tall * .5, tall * .08) : c.rect(p.x - tall * .17, p.y - tall * .78, tall * .34, tall * .5); c.fill();
      c.fillStyle = '#EDEFF5'; c.fillRect(p.x - tall * .13, p.y - tall * .3, tall * .26, tall * .3);
      c.fillStyle = team[0]; c.beginPath(); c.arc(p.x, p.y - tall * .88, tall * .11, 0, Math.PI * 2); c.fill();
    }
  }
  c.globalAlpha = 1;
}
/** A coverage man's picture: running at us, then (close) his move: arms out to wrap up, or the dive. Past us: on the
 *  turf or grabbing at air. */
const manPh = (t, i) => (t * 7 + i * 1.7) * Math.PI;
function manPose(type, d, t, i, beaten) {
  const stride = Math.floor(manPh(t, i) / Math.PI) & 1;
  if (d < -0.3) return type === 'diver' ? 'def.flat' : type === 'wedge' ? `ol.r_f${stride}` : beaten === 'spun' ? 'def.fallen' : 'def.juked';
  if (type === 'diver') return d < 8 ? 'def.dive' : `def.r_f${stride}`;
  if (type === 'wrap') return d < 12 ? 'def.reach' : `def.r_f${stride}`;
  return `ol.r_f${stride}`;
}
function hint(st, c, type, x, z) {
  // Over a man you beat with a move (once he's close enough to read and not on top of you): the move.
  const p = P(st, x, TALL_YD + .55, z), r = Math.max(7, Math.min(15, p.s * .34));
  if (p.y < st.y0 + 4) return;
  c.fillStyle = type === 'diver' ? 'rgba(62,240,143,.92)' : 'rgba(255,205,74,.92)';
  c.beginPath(); c.arc(p.x, p.y - r, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#06210A'; c.fillStyle = '#06210A'; c.lineWidth = Math.max(1.4, r * .2); c.lineCap = 'round'; c.lineJoin = 'round';
  if (type === 'diver') {
    c.beginPath(); c.moveTo(p.x - r * .42, p.y - r * .8); c.lineTo(p.x, p.y - r * 1.38); c.lineTo(p.x + r * .42, p.y - r * .8); c.stroke();
    c.beginPath(); c.moveTo(p.x, p.y - r * 1.3); c.lineTo(p.x, p.y - r * .5); c.stroke();
  } else {
    c.beginPath(); c.arc(p.x, p.y - r, r * .48, -Math.PI * .1, Math.PI * 1.45); c.stroke();
    const ax = p.x + r * .48 * Math.cos(-Math.PI * .1), ay = p.y - r + r * .48 * Math.sin(-Math.PI * .1);
    c.beginPath(); c.moveTo(ax + r * .28, ay - r * .02); c.lineTo(ax - r * .02, ay - r * .32); c.lineTo(ax - r * .12, ay + r * .12); c.closePath(); c.fill();
  }
}
/** The returner's picture now: his stride; the juke, the jump and the spin; going down. */
function runnerPose(st) {
  const run = st.run;
  if (!run || st.mode === 'ready' || st.mode === 'catch') return {f: st.mode === 'catch' ? 'rb.stiff_b' : 'rb.r_b0', flip: false};
  if (run.over) return {f: performance.now() - st.downAt > 380 ? 'rb.down' : 'rb.falling', flip: run.x < 0};
  const g = R.groundAt(run.co, R.laneOf(run), run.z, run.y);
  if (run.spin > 0) {
    const p = 1 - run.spin / R.MOVE.spin, seq = [['rb.r_r0', false], ['rb.r_f0', false], ['rb.r_l0', false], ['rb.r_b1', false]];
    const [f, flip] = seq[Math.min(3, Math.floor(p * 4))];
    return {f, flip};
  }
  if (run.y > g + .12 || run.vy > 0) return {f: 'rb.hurdle', flip: false};
  if (run.jt < 1) return {f: 'rb.juke', flip: R.xOf(run, run.lane) > run.jFrom};
  return {f: `rb.r_b${Math.floor(run.z / 1.5) & 1}`, flip: false};
}
/** How he moves in his picture now (drill-sprites.js giveOf): his stride (the picture changes every 1.5 yards, as a
 *  foot comes down), a lean into a juke, stretched going up in a jump and squashed landing. */
function runnerGive(st, now) {
  const run = st.run, t = now / 1000, land = st.landAt ? (now - st.landAt) / 1000 : null;
  if (!run || run.over || st.mode !== 'run') return {t, land};
  const g = R.groundAt(run.co, R.laneOf(run), run.z, run.y), air = run.y > g + .12 || run.vy > 0;
  return {ph: air || run.spin > 0 ? null : run.z / 1.5 * Math.PI, lean: (R.xOf(run, run.lane) - run.x) / 1.2,
    vy: air ? run.vy / 8 : null, t, land};
}
/** How far ahead a coverage man is drawn now: he waits at his spot till you're CHARGE yards off, then runs at you. */
const manD = (run, d) => d + R.VD * Math.min(Math.max(d, 0), CHARGE) / R.speedAt(run.z) + (d < 0 ? d * R.VD / R.speedAt(run.z) : 0);
/** Everything in the lanes, far to near: the vehicles, the gates, the power-ups, the men and him. */
function drawLanes(st, c, now) {
  const run = st.run, t = now / 1000, list = [];
  const rz = run ? run.z : 0, rx = run ? run.x : 0, ry = run ? run.y : 0;
  if (run) {
    const A = R.ahead(run, 120, PAST + 2);
    A.sets.forEach(({set}) => set.plats.forEach(p => { const X = R.xOf(run, p.lane), w = p.hi ? 1.25 : 1.15; list.push({z: p.z1, veh: {x0: X - w, x1: X + w, z0: p.z0 - (p.ramp || 0), z1: p.z1}, x0: X - w, x1: X + w, draw: () => W.vehicle(st, c, p)}); }));
    A.items.forEach(({item}) => { if (!st.got.has(item.i)) { const X = R.xOf(run, item.lane); list.push({z: item.z, x0: X - .4, x1: X + .4, draw: () => W.item(st, c, item, t)}); } });
    A.rows.forEach(({row, d}) => row.lanes.forEach((type, l) => {
      if (!type) return;
      const key = `${row.i}:${l}`, beat = st.beaten.get(row.i), knocked = st.knocked.get(key);
      const tackler = run.over && run.by && run.by.row === row && run.by.lane === l;
      const dd = tackler ? Math.max(.4, d) : manD(run, d), z = tackler ? rz + .5 : rz + dd, x = R.xOf(run, l);
      if (!tackler && d < -PAST) return;
      const w = type === 'wedge' ? 1.1 : .5;
      list.push({z, x0: x - w, x1: x + w, draw: () => {
        const alpha = d < 0 && !tackler ? Math.max(0, 1 + d / PAST) : 1;
        if (knocked) {
          // trucked: sent flying off to the side
          const k = Math.min(1.2, (now - knocked.at) / 1000), side = l === 0 ? -1 : l === 2 ? 1 : (row.i % 2 ? 1 : -1);
          sprite(st, c, 'def.fallen', side > 0, THEM, x + side * k * 7, Math.max(0, 6 * k - 9 * k * k) + .2, knocked.z + k * 3, Math.max(0, 1 - k));
          return;
        }
        const f = tackler ? (type === 'wedge' ? 'ol.r_f0' : type === 'diver' ? 'def.dive' : 'def.reach') : manPose(type, dd, t, row.i + l, beat);
        if (type === 'wedge') {
          // two big men shoulder to shoulder, out of step
          [-.62, .62].forEach((o, j) => { const fj = j && /r_f/.test(f) ? f.replace(/\d$/, m => String(1 - Number(m))) : f; shadow(st, c, x + o, 0, z, .6); sprite(st, c, fj, false, THEM, x + o, 0, z, alpha, {ph: manPh(t, row.i + l) + j * Math.PI, t, seed: j}); });
        } else {
          shadow(st, c, x, 0, z);
          sprite(st, c, f, (row.i + l) % 2 === 1, THEM, x, f === 'def.dive' ? .35 : 0, z, alpha, {ph: manPh(t, row.i + l), t, seed: row.i + l});
          if (!run.over && d > 2.5 && d < 40 && st.mode === 'run' && ry < 1.2) hint(st, c, type, x, z);
        }
      }});
    }));
    // the gates into the places ahead
    for (let g = Math.ceil((rz - st.back) / R.ZONE) * R.ZONE; g < rz + 140; g += R.ZONE) if (g > 0) list.push({z: g, draw: () => W.gate(st, c, g, R.zoneAt(run.co, g).theme, t)});
  } else {
    list.push({z: R.ZONE, draw: () => W.gate(st, c, R.ZONE, R.zoneAt(st.co, R.ZONE).theme, t)});
  }
  const pose = runnerPose(st), g = run ? R.groundAt(run.co, R.laneOf(run), rz, ry) : 0, give = runnerGive(st, now);
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
    if (run && !run.over && run.booze > 0) sprite(st, c, pose.f, pose.flip, US, rx + .45 * Math.sin(now / 430), ry, rz + .2, .32 * Math.min(1, run.booze / .8), give);
    // back up after the salts: he flickers while nothing can touch him
    const blink = run && !run.over && run.shield > 0 && !run.pills && Math.floor(now / 70) % 2;
    sprite(st, c, pose.f, pose.flip, US, rx, ry, rz, blink ? .35 : 1, give);
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
  st.co = run ? run.co : R.course(st.n, st.day.next < R.RETURNS ? st.day.next : 0);
  // the camera: behind him, following him across part of the way; up when he's up top; a jolt off a vehicle's side
  const bump = run && run.t - run.bump < .22 ? Math.sin((run.t - run.bump) * 60) * .25 * (1 - (run.t - run.bump) / .22) : 0;
  const tx = (run ? run.x : 0) * .6 + bump;
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
  const tot = el.querySelector('[data-rm-tot]'), t = nf(st.day.yards + (run && !run.over && st.mode !== 'ready' ? y : 0));
  if (tot && tot.textContent !== t) tot.textContent = t;
  const kos = el.querySelector('[data-rm-kos]');
  if (kos) {
    const cur = st.mode === 'ready' || st.day.done ? -1 : (run ? run.k : -1);
    const html = Array.from({length: R.RETURNS}, (_, i) => `<i class="rm-ko${i < st.day.list.length ? ' is-done' : ''}${i === cur && i >= st.day.list.length ? ' is-cur' : ''}"></i>`).join('');
    if (kos.dataset.html !== html) { kos.dataset.html = html; kos.innerHTML = html; }
  }
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
  st.el.querySelector('[data-rm]').classList.toggle('is-playing', !st.day.done || st.mode === 'tackled');
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
  if (st.day.done || st.mode === 'run' || st.mode === 'catch') return;
  st.run = R.startRun(st.n, st.day.next);
  st.beaten = new Map(); st.knocked = new Map(); st.got = new Set(); st.flashAt = 0;
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
  ui.haptic('error');
  st.day = R.record(st.n, st.run.k, st.run.yards, st.run.z) || R.dayState(st.n);
  R.autoPost();
  patchHud(st);
  st.later = setTimeout(() => { if (!st.dead) { setCard(st, true); patchBoard(st); } }, ui.RM ? 200 : 950);
}
const GOT = {salts: 'SMELLING SALTS!', pills: 'PAINKILLERS!', booze: 'BOOZE! ×2'};
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
    else if (e.type === 'juked') { pop(st, 'JUKE!'); st.beaten.set(e.row.i, 'juked'); }
    else if (e.type === 'hurdled') { pop(st, 'HURDLE!'); st.beaten.set(e.row.i, 'hurdled'); ui.haptic('light'); }
    else if (e.type === 'spun') { pop(st, 'SPIN!'); st.beaten.set(e.row.i, 'spun'); ui.haptic('light'); }
    else if (e.type === 'pickup') { st.got.add(e.item.i); pop(st, GOT[e.kind], 'is-' + e.kind); ui.haptic('success'); ui.announce(`${R.POWER[e.kind].name}: ${R.POWER[e.kind].says}.`); }
    else if (e.type === 'landed') st.landAt = now;
    else if (e.type === 'trucked') { st.knocked.set(`${e.row.i}:${e.lane}`, {at: now, z: e.z + .6}); pop(st, 'TRUCKED!', 'is-pills'); ui.haptic('medium'); }
    else if (e.type === 'vaulted') { pop(st, 'OVER THE TOP!', 'is-pills'); ui.haptic('medium'); }
    else if (e.type === 'revived') {
      st.flashAt = now; pop(st, 'BACK UP!', 'is-salts'); ui.haptic('warning');
      if (e.row) st.knocked.set(`${e.row.i}:${e.lane}`, {at: now, z: e.z + .6});
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
  if (!scr || !stage || !st.ctx.visible || (st.day.done && st.mode !== 'tackled')) return;
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
/** The owner's Test play (views/testplay.js): today's kickoffs fresh in the sandbox, or back to the real day. */
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
  ui.announce(on ? 'Test play: today’s kickoffs, fresh. They won’t count.' : 'Test play over: back to your real day.');
}
function onClick(st, e) {
  const t = e.target.closest('[data-rm-go], [data-rm-resume], [data-rm-day], [data-rm-sb], [data-rm-test]');
  if (!t || !st.el.contains(t)) return;
  if (t.hasAttribute('data-rm-go')) { if (st.mode === 'tackled') { st.mode = 'ready'; st.run = null; } go(st); return; }
  if (t.hasAttribute('data-rm-resume')) { resume(st); return; }
  if (t.hasAttribute('data-rm-day')) { st.mode = 'ready'; st.run = null; setCard(st, true); patchHud(st); draw(st); return; }
  if (t.hasAttribute('data-rm-sb')) { const b = st.el.querySelector('[data-rm-board]'); if (b) b.scrollIntoView({behavior: ui.RM ? 'auto' : 'smooth', block: 'start'}); return; }
  if (t.hasAttribute('data-rm-test')) testPlay(st, t.dataset.rmTest === 'on');
}
function tick(st) {
  // a new day at midnight: the next three kickoffs
  if (R.todayNumber() !== st.n && st.mode !== 'run' && st.mode !== 'catch') {
    st.run = null; st.mode = 'ready'; setDay(st, R.todayNumber()); setCard(st, true); patchHud(st); patchBoard(st); draw(st);
  }
  const nx = st.el.querySelector('[data-rm-next]');
  if (nx) nx.textContent = `New kickoffs in ${ui.untilText(msToMidnight())}`;
}

export function render(ctx) {
  const st = {n: R.todayNumber(), mode: 'ready', sbMode: 'today', run: null};
  setDay(st, st.n);
  return bodyHTML(st);
}
export function mount(el, ctx) {
  ensureCss();
  const st = {el, ctx, mode: 'ready', sbMode: 'today', run: null, beaten: new Map(), knocked: new Map(), got: new Set(), dead: false, raf: 0, camX: null, cheer: 0, lift: 0};
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
  SP.load().then(() => { if (!st.dead) draw(st); });
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
  clearTimeout(st.later);
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
