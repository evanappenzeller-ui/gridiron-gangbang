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
// On the hard course a pothole (an orange cone just before each, kicked flying if he runs through it) is the one thing
// he falls into: down into it, the camera dipping, and scrambling out (FALL; the owner's ask, Oct 2026).
// On his first run of the day there, lines of gold coins to run through (core COIN; the owner's ask, Oct 21 2026): a
// sparkle and a tick of the counter beside the yards for each, and on the end card what they pay Keepfall.
// Every 100 yards is a touchdown.
// The scene is in real 3D (the owner's ask, Oct 2026): the world (views/return-3dworld.js: each place's ground, what
// stands beside the road, the gates, the barricades and banners, the vehicles, the power-ups) and the players
// (views/return-3d.js: a rigged, animated athlete in each side's uniform, smooth at the screen's frame rate: running,
// cutting, spinning, leaping, sliding, stumbling, the tackle; ours in navy, the linebacker in red), lit, with shadows,
// rendered over the sky (views/return-world.js's painting) on the stage's canvas, the hints and the dust over that.
// Till that loads (or on a phone without WebGL) it's all drawn in 2D (views/return-world.js), the players the owner's
// sprite sheets (views/drill-sprites.js). A power-up, picked up, says what it is and what it does.
// Exports: render(ctx), mount(el, ctx), params(el, ctx), unmount(el, ctx). Owner: RETURN.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as R from '../core/return.js';
import * as SP from './drill-sprites.js';
import * as D3 from './return-3d.js';
import * as W from './return-world.js';
import * as style from './return-style.js';
import {seeded} from './stadium.js';
import {msToMidnight} from './board.js';
import {canTest, testRowHTML} from './testplay.js';

const esc = data.esc;
const nf = n => data.nf(n);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The version mark css/views/return.css carries (--rm-css): an older cached stylesheet gets the new one linked.
const CSS_V = '7';
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
let iconOwner = null;
function iconURL(kind) {
  const owner = data.isOwner();
  if (iconOwner !== owner) { Object.keys(ICON_URL).forEach(k => delete ICON_URL[k]); iconOwner = owner; }
  if (ICON_URL[kind]) return ICON_URL[kind];
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = owner ? 128 : 64;
    const c = cv.getContext('2d'); c.translate(owner ? 64 : 32, owner ? 64 : 34); c.scale(owner ? 112 : 56, owner ? 112 : 56);
    W.ICONS[kind](c, .4);
    ICON_URL[kind] = cv.toDataURL();
  } catch (_) { ICON_URL[kind] = ''; }
  return ICON_URL[kind];
}
const iconHTML = (kind, size = 28) => `<img class="rm-ic" data-rm-icon="${kind}" src="${iconURL(kind)}" width="${size}" height="${size}" alt="" draggable="false">`;
function keysHTML(hard) {
  const k = (cls, label, what) => `<li class="rm-key"><span class="rm-kk ${cls}" aria-hidden="true">${label}</span><span>${what}</span></li>`;
  const pw = (kind, name, what) => `<li class="rm-pk">${iconHTML(kind, 34)}<b>${name}</b><span>${what}</span></li>`;
  return `<ul class="rm-keys" aria-label="How to play">`
    + k('is-lr', '← →', 'Swipe to juke a lane. Off the edge, you stumble')
    + k('is-up', '↑', hard ? 'Jump a barricade or a pothole, or onto a low one' : 'Jump a barricade, or onto a low one')
    + k('is-dn', '↓', 'Slide under a banner')
    + k('is-ramp', '◢', hard ? 'Run up a ramp onto the roofs. Head on into a bus: down' : 'Run up a ramp onto the roofs')
    + k('is-chase', '!', hard ? 'The linebacker starts close. After a stumble, your next unprotected hit tackles you—even after a clean stretch' : 'The linebacker’s on your heels at the catch and after any hit. Hit something while he’s there: tackled')
    + `</ul><ul class="rm-pks" aria-label="Power-ups">`
    + pw('salts', 'Smelling salts', hard ? '10-second speed burst + extra life' : 'Speed burst + extra life')
    + pw('pills', 'Painkillers', hard ? 'Hit anything, no stumble' : 'Feel nothing')
    + pw('booze', 'Booze', hard ? 'Double yards, but blurry' : 'Double yards')
    + `</ul>`;
}
// Return Man is in beta (open to the league while the owner works on it, Oct 2026): a BETA tag on the cards before a
// kickoff, and a word about it on the first.
const BETA = '<span class="rm-beta">Beta</span>';
const betaLine = () => `<p class="rm-card-s rm-beta-l">${esc(`Still being worked on: ${(data.M[data.OWNER] || {name: 'the commissioner'}).name}’s tuning it, so it may change.`)}</p>`;
// The players' model's credit (its licence asks for one: views/return-3d.js)
const creditLine = () => '<p class="rm-card-s rm-beta-l rm-credit">Players: <a href="https://sketchfab.com/3d-models/american-football-player-10bf41a1c05a4c9cb74676b7dd8cb18e" target="_blank" rel="noopener">American Football Player</a> by blakeallen25, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, recoloured</p>';
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
  const note = (R.testing() ? '<p class="rm-card-s">Test play: not counted, not on the scoreboard.</p>' : '')
    + (data.isOwner() ? '<p class="rm-card-s">Hard course: faster, potholes, and a bus head on ends it. Just your profile for now.</p>' : '');
  if (st.mode === 'tackled') {
    const run = st.run, y = Math.floor(run.yards), tds = R.tdsAt(run.z), th = R.zoneAt(run.co, run.z).theme;
    const prev = d.list.slice(0, -1).reduce((m, e) => Math.max(m, e.y), 0); // (the best before this run)
    const best = d.runs > 1 && y > prev ? '<p class="rm-card-best">New best today!</p>'
      : d.runs > 1 ? `<p class="rm-card-s">${esc(`Your best today: ${nf(d.best)} yards`)}</p>` : '';
    return `<div class="rm-card-in"><p class="rm-card-o">${koLabel(run.k)}</p>`
      + `<p class="rm-big"><span class="n1">${esc(nf(y))}</span><small>yards</small></p>`
      + `<p class="rm-card-s">${esc(`${R.endOf(run)} ${WHERE[th.id]}.${tds ? ` ${plural(tds, 'touchdown')}!` : ''}`)}</p>`
      + coinsLine(st, run) + best + note + again() + sb() + `</div>`;
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
  // the owner's: no how-to-play, the day's first kickoff starts on its own (autoGo); this only shows if it couldn't
  if (data.isOwner()) {
    // (his day's first run, the one with the coins, waiting for the board to say it's the first: autoGo)
    const wait = R.coinsWait(st.n, 0, true) ? '<p class="rm-card-s rm-card-wait">Getting the scoreboard: it tells this is your first run today, the one with the coins. It kicks off as soon as it’s in; field it now and this run has none.</p>' : '';
    return `<div class="rm-card-in is-first"><p class="rm-card-o">${koLabel(0)}${R.testing() ? ' · Test play' : ''} ${BETA}</p>`
      + wait + again('Field the kick') + creditLine() + `</div>`;
  }
  return `<div class="rm-card-in is-first"><p class="rm-card-o">${koLabel(0)}${R.testing() ? ' · Test play' : ''} ${BETA}</p>`
    + `<h2 class="rm-card-t">Take it to the house</h2>`
    + keysHTML(data.isOwner()) + note + betaLine()
    + again('Field the kick') + creditLine() + `</div>`;
}
// The gold coins (core COIN: the owner's hard course, his first run of the day alone; the owner's ask, Oct 21 2026):
// on the end card, what the run's coins pay Keepfall (COIN.gold Gold each); on his later runs, that they're only on the
// first. Nobody else's card changes.
const coinGlyph = '<i class="rm-coin" aria-hidden="true"></i>';
function coinsLine(st, run) {
  if (!data.isOwner() || !run || !run.co.hard) return '';
  if (!R.testing() && st.n < R.COIN.fromDay) return ''; // (before the coins' first day: nothing to say of them)
  if (!run.coins) {
    // (why a run has none: a later run; his first today was on another phone (the board says so); or, his first here,
    // the board wasn't in to tell it was the day's first)
    const why = run.k > 0 ? 'Coins are only on your first run.' : run.elsewhere ? 'Your first run today was on another phone: its coins are the ones that count.'
      : 'No coins this run: the scoreboard wasn’t in to tell it was your first today.';
    return `<p class="rm-card-s rm-card-nocoins">${esc(why)}</p>`;
  }
  const c = run.c, gold = nf(c * R.COIN.gold);
  if (!c) return `<p class="rm-card-coins">${coinGlyph}<span>No coins this run</span></p>`;
  const pay = R.testing() ? `${gold} Gold (test play: not paid)` : `${gold} Gold for Keepfall`;
  return `<p class="rm-card-coins">${coinGlyph}<span>${esc(`${nf(c)} ${c === 1 ? 'coin' : 'coins'} · ${pay}`)}</span></p>`;
}
function hudHTML() {
  // (the coin counter beside the yards: shown on a coin run alone, patchHud)
  return `<div class="rm-hud" aria-hidden="true"><div class="rm-hl">`
    + `<div class="rm-chip rm-yds" data-rm-ychip><span class="rm-yn" data-rm-yds>0</span><span class="rm-yu" data-rm-yu>yds</span></div>`
    + `<div class="rm-chip rm-coins" data-rm-coins hidden>${coinGlyph}<span class="rm-cn" data-rm-cn>0</span></div></div>`
    // today's best (this run once it's beaten it)
    + `<span></span><div class="rm-chip rm-tot"><span class="rm-tn" data-rm-tot>0</span><span class="rm-yu">best</span></div>`
    + `<div class="rm-pows" data-rm-pows></div>`
    + `<div class="rm-got" data-rm-got hidden></div></div>`;
}
const SB_MODES = [{id: 'today', label: 'Today'}, {id: 'week', label: 'Week'}];
// How many attempts each player has made (the day's runs, or the week's: core attemptsOf), on the owner's scoreboard
// alone (his ask, Oct 22 2026); a row from before attempts were posted says nothing of them.
const attemptsSub = r => (data.isOwner() && r.a != null ? ` · ${plural(r.a, 'attempt')}` : '');
function rowHTML(r, mode) {
  const sub = (mode === 'today' ? `Longest ${nf(r.l)}${r.td ? ` · ${plural(r.td, 'TD')}` : ''}` : `${plural(r.played, 'day')} · longest ${nf(r.l)}`) + attemptsSub(r);
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
// On the owner's profile the day's first kickoff (and Test play's) starts on its own when the page opens, no card
// first (the owner's ask, Oct 2026). Everyone else still taps Field the kick.
// His day's first run, a coin run, waits for the board (core coinsWait: only it can tell the run's the first across his
// phones, coinsOpen): the stage a moment (BOARD_WAIT_MS), then his card saying so; it kicks off as the board comes in
// (the 'lb' in mount).
const autoGoes = st => data.isOwner() && st.mode === 'ready' && !st.day.next;
const BOARD_WAIT_MS = 2500;
function autoGo(st) {
  if (st.dead) return;
  if (autoGoes(st) && document.visibilityState !== 'hidden') {
    if (R.coinsWait(st.n, st.day.next, true)) {
      if (!st.waitT && !st.waited) st.waitT = setTimeout(() => { st.waitT = 0; st.waited = true; if (!st.dead && st.mode === 'ready') setCard(st, true); }, BOARD_WAIT_MS);
      return;
    }
    clearTimeout(st.waitT); st.waitT = 0;
    go(st);
    return;
  }
  if (st.mode === 'ready') setCard(st, true); // (not now: the card, with its button)
}
// While a return's on (or before the day's first), the scoreboard waits under the stage; between runs it shows.
const playing = st => !st.day.runs || st.mode === 'run' || st.mode === 'catch' || st.mode === 'paused';
function bodyHTML(st) {
  return `<div class="rm${playing(st) ? ' is-playing' : ''}" data-rm>`
    + `<div class="rm-stage" data-rm-stage data-hscroll aria-label="Return Man: swipe left or right to juke, up to jump, down to slide">`
    + `<canvas class="rm-cv" data-rm-cv></canvas>${hudHTML()}`
    + `<div class="rm-pop" data-rm-pop aria-hidden="true"></div>`
    + `<div class="rm-card" data-rm-card role="group" aria-live="polite"${autoGoes(st) ? ' hidden' : ''}>${cardHTML(st)}</div></div>`
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
/** The view the sky's painted for: in 3D the world's bent (return-world.js BEND), its horizon down at the brow. */
const skyView = st => (st.bend ? Object.assign({}, st, {y0: W.horizonOf(st)}) : st);

// ---------------------------------------------------------------- The players
// The owner's sprite sheets (views/drill-sprites.js: the Two-Minute Drill's players), ours in navy and the linebacker
// in red, animated (runnerAnim, chaserAnim: the owner's ask, Oct 2026): each move a run of its pictures in order, with
// its own arc, lean and squeeze. Each is drawn at his feet, his height by how far he is (a man is 2 yards), with a
// shadow on what's under him. While the pictures load, drawn ones stand in.
const US = ['#1D3F8F'], THEM = ['#C8102E'];
const TALL_YD = 2.05, PAST = 1.8;
function shadow(st, c, x, y, z, w = .55) {
  if (z < st.camZ + W.NEAR) return;
  const p = P(st, x, y, z), r = P(st, x + w, y, z);
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(p.x, p.y, Math.abs(r.x - p.x), Math.max(1, Math.abs(r.x - p.x) * .3), 0, 0, Math.PI * 2); c.fill();
}
/** A picture of a move (a: {f, flip, mo (his stride's give: drill-sprites.js giveOf), ex (the move's own lift, squeeze,
 *  lean)}) at his feet (x, y, z). */
function sprite(st, c, a, team, x, y, z, alpha = 1) {
  if (z < st.camZ + W.NEAR) return;
  const p = P(st, x, y, z), tall = p.s * TALL_YD;
  if (p.y < st.y0 - 40 || tall < 2) return;
  c.globalAlpha = alpha;
  if (SP.ready() && SP.hasFrame(a.f)) {
    // (the pictures draw in device pixels: through the camera's sway, if any)
    const m = c.getTransform(), k = Math.hypot(m.a, m.b);
    SP.draw(c, {f: a.f, flip: !!a.flip}, team, true, m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f, tall * k, a.mo || null, a.ex || null);
    c.setTransform(m);
  } else {
    const low = /dive|flat|down|fallen/.test(a.f);
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
const HINT_YDS = 50;
function hint(st, c, type, x, z) {
  // Over a barricade or a banner (once it's close enough to read and not on top of you): the move that beats it, an
  // arrow up (jump) or down (slide). Only on the first HINT_YDS yards: after that you know (the owner's ask, Oct 2026).
  // On the hard course, a pothole's and a sled's first HINT_YDS yards too (from the first one: an arrow up; the sled's
  // either way).
  const first = st.co && st.co.first && st.co.first[type];
  if (z >= HINT_YDS && !(first != null && z < first + HINT_YDS)) return;
  const p = P(st, x, type === 'bar' ? 3.05 : type === 'sled' ? 2.1 : type === 'hole' ? 1 : 1.6, z), r = Math.max(7, Math.min(15, p.s * .34));
  if (p.y < st.y0 + 4) return;
  const up = type === 'hurdle' || type === 'hole';
  c.fillStyle = type === 'sled' ? 'rgba(120,200,255,.92)' : up ? 'rgba(62,240,143,.92)' : 'rgba(255,205,74,.92)';
  c.beginPath(); c.arc(p.x, p.y - r, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#06210A'; c.lineWidth = Math.max(1.4, r * .2); c.lineCap = 'round'; c.lineJoin = 'round';
  if (type === 'sled') {
    const cy = p.y - r;
    [-1, 1].forEach(s => { c.beginPath(); c.moveTo(p.x + s * r * .2, cy - r * .32); c.lineTo(p.x + s * r * .55, cy); c.lineTo(p.x + s * r * .2, cy + r * .32); c.stroke(); });
    return;
  }
  const s = up ? 1 : -1, cy = p.y - r;
  c.beginPath(); c.moveTo(p.x - r * .42, cy + s * r * .2); c.lineTo(p.x, cy - s * r * .38); c.lineTo(p.x + r * .42, cy + s * r * .2); c.stroke();
  c.beginPath(); c.moveTo(p.x, cy - s * r * .3); c.lineTo(p.x, cy + s * r * .5); c.stroke();
}
// The moves, picture by picture (ms, or seconds where it says): the spin goes round his facings (from behind, to his
// right, three-quarters, the front, three-quarters, to his left, and back to behind), squeezed as he turns out of each.
const FACE = [['rb.r_b0', false], ['rb.r_r0', false], ['rb.spin', true], ['rb.r_f0', false], ['rb.spin', false], ['rb.r_l0', false]];
const SPIN_MS = 420, CUT_S = .22, EDGE_MS = 320, CATCH_HANDS = .8;
const smooth = v => v * v * (3 - 2 * v);
const fallDir = run => (run.x > .5 ? -1 : 1); // (which way he goes down, or lurches: toward the middle, or to his right)
/** His stride from behind: the ball in the same arm both steps (drill-sprites.js MADE). */
const strideOf = z => (Math.floor(z / 1.5) & 1 ? 'rb.r_b1x' : 'rb.r_b0');
/** Off the edge of the road (a hit): out toward it and back, -1 to 1 (0 when he isn't). */
const edgeBounce = (st, now) => (st.edgeAt && now - st.edgeAt < EDGE_MS ? st.edgeDir * Math.sin(Math.PI * (now - st.edgeAt) / EDGE_MS) : 0);
/** The returner now: {f, flip, mo, ex, dz (yards on from where he is: thrown forward in the tackle), ghosts
 *  ([{f, flip, dx, a}]: afterimages of a cut or a spin)}. Waiting for the kick; reaching up for it; then running with
 *  it tucked away: cutting a lane over (side on), spinning past a thing he's just juked, leaping (arms up, then the
 *  legs reaching for the ground), sliding in low on his side, lurching and staggering after a hit (into the edge of
 *  the road first, side on); tackled, driven forward off his feet and down. */
function runnerAnim(st, now) {
  const run = st.run, t = now / 1000;
  if (!run || st.mode === 'ready') return {f: 'wr.r_b1', mo: {t}};
  if (st.mode === 'catch') {
    const p = (now - st.catchAt) / CATCH_MS;
    return p < CATCH_HANDS ? {f: 'wr.r_b1', mo: {t}} : {f: 'wr.high', ex: {lift: .04 * Math.sin(Math.PI * Math.min(1, (p - CATCH_HANDS) / (1 - CATCH_HANDS)))}};
  }
  const fl = fallOf(st, now);
  if (run.over) {
    const e = now - st.downAt, dir = fallDir(run);
    if (fl) return {f: 'rb.stiff_b', flip: dir < 0, ex: {rot: dir * .3 * Math.min(1, e / 300)}}; // (tackled in a pothole: over forward)
    if (e < 140) return {f: 'rb.lunge', flip: dir < 0, ex: {rot: dir * .14 * e / 140}};
    const k = Math.min(1, (e - 140) / 380);
    return {f: 'rb.dive', flip: dir < 0, dz: .9 * smooth(k), ex: {lift: .2 * Math.sin(Math.PI * k)}};
  }
  const g = R.groundAt(run.co, R.laneOf(run), run.z, run.y), h = run.y - g, ph = run.z / 1.5 * Math.PI;
  // (a stumble: he staggers, side to side, as he gets going again)
  const wob = run.slow > 0 ? Math.sin(run.slow * 22) * .7 * run.slow / R.CHASE.slow : 0;
  const mo = {ph, t, land: st.landAt ? (now - st.landAt) / 1000 : null, lean: (R.xOf(run, run.lane) - run.x) / 1.2 + wob};
  // in a pothole (from behind, the ball tucked): dropping in and caught in it, an arm out onto its far rim, then
  // stepping up out of it
  if (fl && fl.pose) return fl.u < .8 ? {f: 'rb.stiff_b', flip: run.x > .5, ex: {rot: (run.x > .5 ? -1 : 1) * .05 * fl.k}} : {f: strideOf(run.steps), mo, ex: {sy: 1.04}};
  const ee = st.edgeAt ? now - st.edgeAt : 1e9, he = st.hitAt ? now - st.hitAt : 1e9, low = h < .1 && !run.slide;
  if (ee < 110) return {f: st.edgeDir > 0 ? 'rb.r_r0' : 'rb.r_l0', ex: {rot: st.edgeDir * .22}};
  if (he < 150 && low) return {f: 'rb.lunge', flip: st.hitDir < 0};
  if (he < 320 && low) return {f: 'rb.juke', flip: st.hitDir > 0, ex: {rot: .07 * Math.sin(he / 38)}};
  if (run.slide > 0) {
    const into = R.MOVE.slide - run.slide, left = run.x < -.5;
    return into < .09 || run.slide < .1 ? {f: 'rb.lunge', flip: !left} : {f: 'rb.down', flip: left, ex: {rot: .018 * Math.sin(t * 50)}};
  }
  if (h > .05 || run.vy > 0) return run.vy > -2.5 ? {f: 'wr.high', ex: {sy: 1 + .05 * Math.max(0, run.vy / R.JUMP_V), rot: .04 * mo.lean}} : {f: 'rb.r_b0', ex: {sx: .96, sy: 1.06}};
  const sp = st.spinAt ? (now - st.spinAt) / SPIN_MS : 1;
  if (sp < 1) {
    const n = FACE.length - 1, pos = sp * n, i = Math.floor(pos), at = k => FACE[st.spinDir > 0 ? 1 + k : n - k];
    const [f, flip] = at(i), prev = i > 0 ? at(i - 1) : null;
    return {f, flip, ex: {sx: .78 + .22 * Math.sin(Math.PI * (pos - i)), lift: .05 * Math.sin(Math.PI * sp)}, ghosts: prev ? [{f: prev[0], flip: prev[1], dx: 0, a: .28}] : []};
  }
  const dir = Math.sign(R.xOf(run, run.lane) - run.jFrom);
  if (dir && run.t - run.lastJuke < CUT_S) {
    const f = (dir > 0 ? 'rb.r_r' : 'rb.r_l') + (Math.floor(run.steps / 1.5) & 1), back = run.jFrom - run.x;
    return {f, mo, ghosts: run.jt < 1 ? [{f, dx: back * .35, a: .3}, {f, dx: back * .7, a: .14}] : []};
  }
  return {f: strideOf(run.steps), mo};
}
/** The linebacker now (z: where he is): running him down (set while the kick's in the air); when he gets there, up
 *  off his feet and flat out through the air, down on top of him. */
function chaserAnim(st, now, z) {
  const run = st.run, t = now / 1000;
  if (run.over && run.why === 'caught') {
    const e = now - st.downAt;
    if (e < 150) return {f: 'def.r_b1', ex: {lift: .1 * e / 150, sy: 1.06}};
    const k = Math.min(1, (e - 150) / 330);
    return {f: 'def.flat', dz: .4 + .7 * smooth(k), ex: {lift: .3 * (1 - k * k)}};
  }
  if (st.mode === 'catch' || st.mode === 'ready') return {f: 'def.r_b0', mo: {t, seed: 7}};
  return {f: `def.r_b${Math.floor(z / 1.4) & 1}`, mo: {ph: z / 1.4 * Math.PI, t, seed: 7}};
}
// In 3D (views/return-3d.js, once it's loaded; the pictures above till then, or on a phone without WebGL): the same
// moments as its moves' clips, cross-faded one into the next (the run's keeping pace with the yards).
// A juke's side-step and lean (the owner's ask, Oct 2026: snappier, Subway Surfers' way) take SIDE_S: into the lean
// quick, out of it slower.
const SIDE_S = .32;
const leanOf = u => (u < 0 || u >= 1 ? 0 : u < .35 ? smooth(u / .35) : 1 - smooth((u - .35) / .65));
// A pothole stepped in (core fallsIn: the only thing he falls into, the owner's ask, Oct 2026): he drops into it to
// his waist (deep yards), is held in it a moment (bent over its far rim, both hands out on it, the ball kept tucked),
// climbs out over that rim and runs on, a puff of the hole's dust and bits of its rim kicked up. Its timing is core's
// (R.FALL, fallPlan, fallAt: over within CHASE.grace, and well before whatever's next, so nothing coming is ever judged
// from a picture held back): the picture's held back with him, never more than R.FALL.lag yards, the camera with it
// (so he stays where he always is on the screen), and the camera dips (dip yards, back up easier than it went down).
// With reduced motion the camera does neither: it stays on where he really is. Hit on his way up in a jump (too late
// to clear it), it's the usual lurch. Tackled in it, he goes over forward onto its rim, still down in it. The hit
// itself is the same as ever (core: a stumble, the linebacker, a tackle if he's on him); every other hit keeps its own
// stumble (and eases the picture back onto him in out ms, if one comes while it's held back).
const FALL = {deep: .9, dip: .7, out: 120, splash: .5};
const clamp01 = v => Math.max(0, Math.min(1, v));
/** Starts the fall into a pothole for a hit (only a pothole's: core fallsIn; any other hit ends one). Whether it did. */
function fallIn(st, e, now) {
  const run = st.run;
  if (!R.fallsIn(e) || (run.vy > 0 && run.y > .02)) { endFall(st, now); return false; }
  st.fall = {at: now, t: run.t, z: e.row.z, x: R.xOf(run, e.lane), th: e.row.th, i: e.row.i, plan: R.fallPlan(run, e.row)};
  st.splash = {t: run.t, z: e.row.z, x: st.fall.x, th: e.row.th, i: e.row.i};
  return true;
}
/** Ends a fall early (another hit), the picture eased back onto him rather than snapped. */
function endFall(st, now) {
  if (st.fall && st.lag > 0) st.lagOut = {v: st.lag, at: now};
  st.fall = null;
}
/** Yards he's drawn back from where he is while a fall cut short eases out (draw's st.lag then): with the camera, so
 *  he keeps his place on the screen and the world eases on round him (in a fall, fallOf's z says where he shows). */
const easeBack = st => (st.fall ? 0 : st.lag || 0);
/** The fall into a pothole now, or null: {k (how far down he is, 0 to 1), lag (yards the picture's held back), z (where
 *  he shows), pose (whether he's in its moves: in it or climbing out), u (0 to 1 through them: the 3D clip's), s
 *  (seconds since), over (tackled in it), hole (its middle)}. */
function fallOf(st, now) {
  const f = st.fall, run = st.run;
  if (!f || !run) return null;
  if (run.over) {
    // tackled in it: still down in it (his feet short of its middle), driven over forward onto its far rim
    const k = smooth(clamp01((now - f.at) / 140));
    return {k, lag: 0, z: f.z - .3, pose: true, u: .5, s: (now - f.at) / 1000, over: true, hole: f.z};
  }
  const s = run.t - f.t, F = R.fallAt(f.plan, s, run.z - f.z);
  if (F.done) { st.fall = null; return null; }
  // (up out of it at once if he's left it: jumped out, or juked out of its side)
  const k = F.k * clamp01((1.15 - Math.abs(run.x - f.x)) / .35) * clamp01(1 - run.y / .45);
  return {k, lag: F.lag, z: run.z - F.lag - .25 * k, pose: k > .02 && !(run.vy > 0), u: F.u, s, hole: f.z};
}
/** The returner's 3D pose now (return-3d.js pose's spec; dz: yards on from where he is, thrown forward going down). */
function runner3(st, now) {
  const run = st.run, t = now / 1000;
  if (!run || st.mode === 'ready') return {move: 'idle', t};
  if (st.mode === 'catch') {
    // reaching up for it as it comes down; the ball his once it's there, and in it comes
    const p = Math.min(1, (now - st.catchAt) / CATCH_MS), q = Math.max(0, (p - CATCH_HANDS) / (1 - CATCH_HANDS));
    return {move: 'idle', t, catch: Math.min(1, p / .3) * (1 - .5 * q), carry: .5 * q, ball: p >= CATCH_HANDS};
  }
  const off = Math.min(1, Math.max(0, (now - st.catchAt - CATCH_MS) / 240)); // (out of the catch, into his stride)
  const o = {move: 'run', phase: run.steps / D3.STRIDE, t, carry: .5 + .5 * off, catch: .5 * (1 - off), ball: true};
  const fl = fallOf(st, now);
  if (run.over) {
    const k = Math.min(1, (now - st.downAt) / 420);
    // (tackled in a pothole: down in it to his waist, his chest driven over forward onto its far rim)
    if (fl) return Object.assign(o, {move: 'fallin', u: .5, carry: .3, pitch: .2 + .45 * smooth(k), lift: -FALL.deep * fl.k, turn: 0, roll: 0, dz: fl.z - run.z});
    return Object.assign(o, {move: 'fall', u: k, pitch: 1.48 * k * k, lift: .15 * k, turn: fallDir(run) * .55 * k, dz: .25 * k});
  }
  // in a pothole: dropped in, bent over its far rim with both hands on it, climbing out (held back with the camera: dz)
  if (fl) o.dz = fl.z - run.z;
  if (fl && fl.pose) return Object.assign(o, {move: 'fallin', u: fl.u, carry: .2, lift: -FALL.deep * fl.k, pitch: .12 + .28 * fl.k, turn: 0, roll: 0});
  const g = R.groundAt(run.co, R.laneOf(run), run.z, run.y), h = run.y - g;
  const js = (run.t - run.lastJuke) / SIDE_S, dir = js < 1 ? Math.sign(R.xOf(run, run.lane) - run.jFrom) : 0;
  // the move: a slide; in the air (the jump's clip by how fast he's going up or down: tucked at the top, reaching for
  // the ground coming down); a juke's side-step; or running
  if (run.slide > 0) { o.move = 'slide'; o.u = 1 - run.slide / R.MOVE.slide; }
  else if (h > .02 || run.vy > 0) { o.move = 'jump'; o.u = Math.max(0, Math.min(1, (R.JUMP_V - run.vy) / (2 * R.JUMP_V))); }
  else if (dir) { o.move = dir > 0 ? 'sideR' : 'sideL'; o.u = js; }
  const stum = run.slow > 0 ? run.slow / R.CHASE.slow : 0, he = st.hitAt ? now - st.hitAt : 1e9;
  if (stum) o.stumble = stum;
  o.pitch = .1 + .3 * R.burstOf(run) + (he < 320 ? .38 * Math.sin(Math.PI * he / 320) : 0); // (leaning into his run, more in a burst; a hit: he lurches forward)
  // a juke: turned and leaned into it, eased in and out; a spin goes all the way round
  const lean = dir * leanOf(js), sp = st.spinAt ? (now - st.spinAt) / SPIN_MS : 1;
  o.turn = .38 * lean + (sp < 1 ? st.spinDir * Math.PI * 2 * smooth(sp) : 0);
  o.roll = .2 * lean + stum * .16 * Math.sin(run.slow * 22) + .45 * edgeBounce(st, now);
  return o;
}
/** The linebacker's 3D pose (z: where he is): running him down; set while the kick's in the air; the dive. */
function chaser3(st, now, z) {
  const run = st.run, t = now / 1000;
  if (run.over && run.why === 'caught') {
    const k = Math.min(1, (now - st.downAt) / 380);
    return {move: 'fall', u: k, phase: z / D3.STRIDE, t, pitch: .3 + 1.22 * smooth(k), lift: .45 * Math.sin(Math.PI * k) + .1 * k, turn: fallDir(run) * .4 * k, dz: .45 * smooth(k)};
  }
  if (st.mode === 'catch' || st.mode === 'ready') return {move: 'idle', t: t + 1.3};
  return {move: 'run', phase: z / D3.STRIDE, t, pitch: .12};
}
/** The dust he kicks up sliding in (k: how far into it), off his feet and his seat. */
function dust(st, c, x, y, z, now, k) {
  for (let i = 0; i < 6; i++) {
    const age = (now / 330 + i / 6) % 1, side = i % 2 ? 1 : -1;
    const q = P(st, x + side * (.2 + .5 * age), y + .08 + .45 * age, z + .9 - 1.3 * age - (i % 3) * .2);
    c.fillStyle = `rgba(226,214,190,${(.3 * (1 - age) * k).toFixed(3)})`;
    c.beginPath(); c.arc(q.x, q.y, (.1 + .26 * age) * q.s, 0, Math.PI * 2); c.fill();
  }
}
/** A puff of dust where he comes down (age 0 to 1): a ring of it spreading out and fading. */
function puff(st, c, x, y, z, age, w = 1) {
  if (age < 0 || age >= 1) return;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, r = (.25 + .9 * age) * w;
    const q = P(st, x + Math.cos(a) * r, y + .1 + .25 * age, z + Math.sin(a) * r * .6);
    c.fillStyle = `rgba(226,214,190,${(.38 * (1 - age)).toFixed(3)})`;
    c.beginPath(); c.arc(q.x, q.y, (.14 + .22 * age) * w * q.s, 0, Math.PI * 2); c.fill();
  }
}
/** Everything in the lanes, far to near: the vehicles, the gates, the power-ups, the barricades and banners, him and
 *  the linebacker behind him. */
function drawLanes(st, c, now) {
  const run = st.run, t = now / 1000, list = [];
  const rz = run ? run.z : 0, rx = run ? run.x : 0, ry = run ? run.y : 0;
  if (run) {
    const lag = st.lag || 0, A = R.ahead(run, 120, PAST + 2 + lag); // (further back while he's held back in a pothole)
    A.sets.forEach(({set}) => set.plats.forEach(p => { const X = R.xOf(run, p.lane), w = p.hi ? 1.25 : 1.15; list.push({z: p.z1, veh: {x0: X - w, x1: X + w, z0: p.z0 - (p.ramp || 0), z1: p.z1}, x0: X - w, x1: X + w, draw: () => W.vehicle(st, c, p)}); }));
    A.items.forEach(({item}) => { if (!st.got.has(item.i)) { const X = R.xOf(run, item.lane); list.push({z: item.z, x0: X - .4, x1: X + .4, draw: () => W.item(st, c, item, t)}); } });
    // the coins (the owner's first run of the day: core COIN), till he runs through them
    if (coinsShown(st)) A.coins.forEach(({coin}) => { if (!st.coinGot.has(coin.i)) { const X = R.xOf(run, coin.lane); list.push({z: coin.z, x0: X - .35, x1: X + .35, draw: () => W.coin(st, c, coin, t)}); } });
    A.rows.forEach(({row, d}) => row.lanes.forEach((type, l) => {
      if (!type) return;
      // a pothole's cone just before it (kicked flying when he ran through it)
      if (type === 'hole') {
        const kc = st.knocked.get(`cone:${row.i}:${l}`), u = kc ? Math.min(1, (now - kc.at) / W.CONE_MS) : 0, zc = R.coneZ(row), xc = R.xOf(run, l);
        if (u < 1) list.push({z: zc + W.coneFly(u, 0, kc && kc.ahead).z, x0: xc - .4, x1: xc + .4, draw: () => W.cone(st, c, l, zc, u, kc ? kc.side : 0, kc && kc.ahead)});
      }
      if (d < -PAST - lag) return;
      // a barricade or banner where it stands (knocked flying when he hit it, or smashed through on painkillers)
      const knocked = type !== 'hole' && st.knocked.get(`${row.i}:${l}`), k = knocked ? Math.min(1, (now - knocked.at) / 650) : 0;
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
  const ch = chaserAt(st);
  if (ch) {
    const a = chaserAnim(st, now, ch.cz), cx = ch.cx, az = ch.cz + (a.dz || 0), e = run.over ? now - st.downAt : -1;
    list.push({z: az, x0: cx - .5, x1: cx + .5, draw: () => {
      shadow(st, c, cx, 0, az);
      sprite(st, c, a, THEM, cx, 0, az);
      puff(st, c, cx, 0, az + .6, (e - 480) / 450, 1.2); // (down on top of him)
    }});
  }
  const an = runnerAnim(st, now), g = run ? R.groundAt(run.co, R.laneOf(run), rz, ry) : 0, fl = run ? fallOf(st, now) : null;
  // (bouncing off the edge of the road; thrown forward; held back in a pothole)
  // (a picture, cut off at the road: to about his waist, as in 3D)
  const bx = rx + .5 * edgeBounce(st, now), az = (fl ? fl.z : rz - easeBack(st)) + (an.dz || 0), sink = fl ? FALL.deep * .9 * fl.k : 0;
  // (down in a pothole he's drawn after it, the part of him under the road cut away)
  list.push({z: fl ? Math.min(az, fl.hole - R.HOLE_LEN / 2 - .01) : az, me: true, draw: () => {
    if (sink < .1) shadow(st, c, bx, g, az, .5);
    pillsGlow(st, c, now, g);
    c.save();
    if (sink > 0) { const road = P(st, bx, 0, az).y; c.beginPath(); c.rect(-1e4, -1e4, 2e4, road + 1e4); c.clip(); }
    const me = (x, z, alpha) => sprite(st, c, an, US, x, ry - sink, z, alpha);
    // a cut's and a spin's afterimages, behind him
    (an.ghosts || []).forEach(gh => sprite(st, c, {f: gh.f, flip: gh.flip, mo: an.mo, ex: an.ex}, US, bx + gh.dx, ry, az + .05, gh.a));
    // booze: he's seeing double
    if (run && !run.over && run.booze > 0) me(bx + .45 * Math.sin(now / 430), az + .2, .32 * Math.min(1, run.booze / .8));
    // back up after the salts: he flickers while nothing can touch him
    const blink = run && !run.over && run.shield > 0 && !run.pills && Math.floor(now / 70) % 2;
    me(bx, az, blink ? .35 : 1);
    c.restore();
    runnerFx(st, c, now, bx, g, az);
    coinFx(st, c, now, bx, az);
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
  kickBall(st, c, now);
}
/** The kick coming down into his hands (up over his head: from there his picture, or his 3D hands, have it). */
function kickBall(st, c, now) {
  if (st.mode !== 'catch' || now - st.catchAt >= CATCH_MS * CATCH_HANDS) return;
  const run = st.run, rz = run ? run.z : 0, rx = run ? run.x : 0;
  const p = Math.min(1, (now - st.catchAt) / CATCH_MS / CATCH_HANDS), y = TALL_YD * 1.1 + (1 - p) * (1 - p) * 26, z = rz + .05 + (1 - p) * 6;
  const q = P(st, rx, y, z), sz = Math.max(4, q.s * .32);
  c.save(); c.translate(q.x, q.y); c.rotate(p * 9);
  c.fillStyle = '#7A3B1B'; c.beginPath(); c.ellipse(0, 0, sz, sz * .6, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#F4F0E6'; c.lineWidth = Math.max(.8, sz * .12); c.beginPath(); c.moveTo(-sz * .35, 0); c.lineTo(sz * .35, 0); c.stroke();
  c.restore();
}
/** Where the linebacker is (chasing: just behind him, a step to the side so he doesn't hide him, after a hit; dropping
 *  away below the screen as he runs on clean; on top of him when he runs him down), or null when he's out of sight. */
function chaserAt(st) {
  const run = st.run;
  if (!run) return null;
  const g = R.gapOf(run), cz = run.z - g - (st.lag || 0); // (held back with him in a pothole)
  if (g >= R.CHASE.seen || cz <= st.camZ + W.NEAR + .4) return null; // (out of the picture: a hit's no tackle then)
  let want = run.x + (run.x > .5 ? -1 : 1) * (run.over ? (st.fall ? .1 : .35) : .95); // (down in a pothole: onto his back)
  // (round a pothole, not across it: the one he's just been down in, say)
  if (!run.over && run.co.hard) {
    const rows = run.co.rows;
    for (let i = Math.max(0, run.next - 6); i < rows.length && rows[i].z < cz + R.HOLE_LEN; i++) {
      if (rows[i].z < cz - R.HOLE_LEN) continue;
      rows[i].lanes.forEach((t, l) => {
        const hx = R.xOf(run, l);
        if (t === 'hole' && Math.abs(want - hx) < 1.75) want = hx + (want >= hx ? 1 : -1) * 1.75;
      });
    }
  }
  st.chX = st.chX == null ? want : st.chX + (want - st.chX) * Math.min(1, (st.dt || .016) * 8);
  return {cx: st.chX, cz};
}
/** Painkillers: he burns hot, a ring round his feet (g: the ground under him). */
function pillsGlow(st, c, now, g) {
  const run = st.run;
  if (!run || run.over || !(run.pills > 0)) return;
  const rx = run.x, ry = run.y, rz = run.z;
  const k = Math.min(1, run.pills / .6), q = P(st, rx, ry + 1, rz), r = q.s * (1.45 + .15 * Math.sin(now / 90));
  const gr = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
  gr.addColorStop(0, `rgba(255,190,80,${(.8 * k).toFixed(2)})`); gr.addColorStop(.45, `rgba(255,110,30,${(.4 * k).toFixed(2)})`); gr.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = gr; c.fillRect(q.x - r, q.y - r, r * 2, r * 2);
  const f = P(st, rx, g, rz), rw = f.s * (.75 + .12 * Math.sin(now / 70));
  c.strokeStyle = `rgba(255,150,50,${(.85 * k).toFixed(2)})`; c.lineWidth = Math.max(1.5, f.s * .07);
  c.beginPath(); c.ellipse(f.x, f.y, rw, rw * .3, 0, 0, Math.PI * 2); c.stroke();
}
/** The dust he kicks up: sliding in, landing a jump, going down. */
function runnerFx(st, c, now, bx, g, az) {
  const run = st.run;
  if (!run) return;
  if (!run.over && run.slide > 0) dust(st, c, run.x, g, run.z, now, Math.min(1, run.slide / .25));
  if (!run.over && st.landAt) puff(st, c, run.x, g, run.z, (now - st.landAt) / 350, .7); // (landing a jump)
  if (run.over) puff(st, c, bx, g, az + .5, (now - st.downAt - 520) / 450, 1.1); // (down)
  // (dropping into a pothole: bits of its rim kicked up off its near and far edges, up and down again, in its colours;
  // each hole's own, the same every time)
  const sp = st.splash, s = sp ? run.t - sp.t : 1e9;
  if (sp && s >= 0 && s < FALL.splash) {
    const age = s / FALL.splash, cols = (W.HOLE_COL[sp.th] || W.HOLE_COL.city).map(rgbOf), r = seeded(sp.i * 31 + 7);
    for (let i = 0; i < 9; i++) {
      const side = r() < .55 ? 1 : -1, a = (r() - .5) * 1.9, vy = 2.2 + r() * 2.8, out = .6 + r() * 1.3, sz = .035 + .075 * r(), rgb = cols[r() < .7 ? 0 : 1];
      const y = vy * s - 14 * s * s;
      if (y < 0) continue;
      const q = P(st, sp.x + Math.sin(a) * (1 + out * s), y, sp.z + side * Math.cos(a) * (.95 + out * s) + 1.2 * s);
      c.fillStyle = `rgba(${rgb},${(.95 * (1 - age * age)).toFixed(3)})`;
      c.beginPath(); c.arc(q.x, q.y, Math.max(.8, sz * q.s), 0, Math.PI * 2); c.fill();
    }
  }
}
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
// ---------------------------------------------------------------- The coins (the owner's first run of the day)
// core COIN: lines of gold coins on his hard course, his first run of the day alone. Each one he runs through goes in a
// little sparkle where it was on him (SPARK_MS), the counter beside the yards ticks up, and a tap of haptics; no words
// (the owner's rule: only a pickup's catchphrase pops up, and coins come too often for one).
const SPARK_MS = 380, COIN_BUZZ_MS = 70;
/** Whether the coins show: a coin run, on the owner's profile (off it, even from another tab, they're hidden: none
 *  drawn, none counted (onEvents)). */
const coinsShown = st => !!(st.run && st.run.coins && data.isOwner());
/** A coin run under way, looked at again on his profile (the board's come in, or he's back on it): no longer the
 *  day's first as the board sees it (another of his phones has a run of the day on it), and its coins are gone. A
 *  profile change alone hides them (coinsShown), and ends a run on his hard course where it is (frame), keeping the
 *  ones he's taken (runCoins). */
function recheckCoins(st) {
  const run = st.run;
  if (!run || !run.coins || run.over || R.testing() || !data.isOwner()) return;
  if (!R.ranElsewhere(st.n)) return;
  R.dropCoins(run);
  st.coinGot = new Set(); st.sparks = [];
  patchHud(st);
}
/** He's run through a coin: its sparkle (where it was on him: it rides with him), the counter's tick, a tap. */
function coinGot(st, e, now) {
  const run = st.run;
  st.coinGot.add(e.coin.i);
  st.sparks.push({at: now, dx: R.xOf(run, e.coin.lane) - run.x, dy: e.coin.y - run.y, i: e.coin.i});
  if (st.sparks.length > 10) st.sparks.shift();
  const chip = st.el.querySelector('[data-rm-coins]');
  if (chip && !ui.RM && chip.animate) chip.animate([{transform: 'scale(1.16)'}, {transform: 'none'}], {duration: 200, easing: 'cubic-bezier(.2,.9,.3,1)'});
  if (!(now - (st.coinBuzz || 0) < COIN_BUZZ_MS)) { st.coinBuzz = now; ui.haptic('selection'); }
}
/** The coins' sparkles, on him (bx, az: where he's drawn; y: his height): a gold glow and little stars flying out. */
function coinFx(st, c, now, bx, az) {
  const run = st.run;
  if (!run || !st.sparks.length) return;
  st.sparks = st.sparks.filter(s => now - s.at < SPARK_MS);
  if (!st.sparks.length || !coinsShown(st)) return;
  c.save();
  // (try/finally: whatever happens, the canvas is never left adding light; and a spark's age is never below nothing,
  // since its time is the pickup's, performance.now(), and a frame's can be a little behind it, as puff's guard knows)
  try {
    c.globalCompositeOperation = 'lighter';
    st.sparks.forEach(s => {
      const a = Math.min(1, Math.max(0, (now - s.at) / SPARK_MS)), q = P(st, bx + s.dx, run.y + s.dy, az + .15), k = 1 - a;
      if (!(q.s > 0)) return;
      const gr = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, (.3 + .45 * a) * q.s);
      gr.addColorStop(0, `rgba(255,236,140,${(.75 * k).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,190,40,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(q.x, q.y, (.3 + .45 * a) * q.s, 0, Math.PI * 2); c.fill();
      if (ui.RM) return;
      const out = 1 - (1 - a) ** 3, r = seeded(s.i * 13 + 5);
      for (let i = 0; i < 6; i++) {
        const ang = i / 6 * Math.PI * 2 + r() * .8, dist = (.18 + .62 * out) * q.s, sz = (.05 + .1 * k) * q.s;
        const x = q.x + Math.cos(ang) * dist, y = q.y + Math.sin(ang) * dist * .8 - .25 * out * q.s;
        c.fillStyle = i % 2 ? `rgba(255,214,70,${k.toFixed(3)})` : `rgba(255,250,215,${k.toFixed(3)})`;
        c.beginPath(); c.moveTo(x, y - sz); c.lineTo(x + sz * .28, y - sz * .28); c.lineTo(x + sz, y); c.lineTo(x + sz * .28, y + sz * .28);
        c.lineTo(x, y + sz); c.lineTo(x - sz * .28, y + sz * .28); c.lineTo(x - sz, y); c.lineTo(x - sz * .28, y - sz * .28); c.closePath(); c.fill();
      }
    });
  } finally { c.restore(); }
}
/** The world and the players in 3D (views/return-3d.js and return-3dworld.js), laid over the sky; then what's drawn
 *  over them: the painkillers' glow, the dust, the hints over what's coming, the kick coming down. */
function draw3(st, c, now) {
  const run = st.run, rz = run ? run.z : 0, rx = run ? run.x : 0, ry = run ? run.y : 0;
  const us = runner3(st, now), bx = rx + .5 * edgeBounce(st, now), az = rz + (us.dz || 0) - easeBack(st);
  const blink = run && !run.over && run.shield > 0 && !run.pills && Math.floor(now / 70) % 2;
  const who = {us: {spec: us, x: bx, y: ry, z: az, show: !blink}};
  // booze: he's seeing double
  if (run && !run.over && run.booze > 0) who.ghost = {spec: us, x: bx + .45 * Math.sin(now / 430), y: ry, z: az + .2, alpha: .32 * Math.min(1, run.booze / .8)};
  const ch = chaserAt(st);
  if (ch) { const a = chaser3(st, now, ch.cz); who.them = {spec: a, x: ch.cx, y: 0, z: ch.cz + (a.dz || 0)}; }
  c.drawImage(D3.render(st, now, who), 0, 0, st.W, st.H);
  // down in a pothole: the pit's shadow on him, darkest at the road where it cuts him off
  const fl = run ? fallOf(st, now) : null;
  if (fl && fl.k > .05) {
    const q = P(st, bx, 0, az + .25 * fl.k), r = .62 * q.s;
    c.save(); c.translate(q.x, q.y); c.scale(1, .6);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(0,0,0,${(.62 * fl.k).toFixed(3)})`); gr.addColorStop(.55, `rgba(0,0,0,${(.32 * fl.k).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  const g = run ? R.groundAt(run.co, R.laneOf(run), rz, ry) : 0;
  pillsGlow(st, c, now, g);
  runnerFx(st, c, now, bx, g, az);
  coinFx(st, c, now, bx, az);
  if (ch && run.over) puff(st, c, ch.cx, 0, ch.cz + .6, (now - st.downAt - 480) / 450, 1.2);
  // over a barricade or a banner coming up: the move that beats it
  if (run && !run.over && st.mode === 'run' && ry < 1.2) {
    R.ahead(run, 40, 0).rows.forEach(({row, d}) => row.lanes.forEach((type, l) => {
      if (type && d > 2.5 && d < 40 && !st.knocked.get(`${row.i}:${l}`)) hint(st, c, type, R.xOf(run, l), rz + d);
    }));
  }
  kickBall(st, c, now);
}
/** Speed lines at the sides once he's flying. */
function drawSpeed(st, c, now) {
  const run = st.run;
  if (!run || st.mode !== 'run') return;
  const v = R.speedAt(run.z, run.co.hard), k = Math.min(2, Math.max(0, (v - 13) / 6)) + (run.pills > 0 ? .6 : 0) + 3 * R.burstOf(run);
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
  st.co = run ? run.co : R.course(st.n, 0, data.isOwner());
  // the camera: behind him, following him across part of the way a beat behind (a spring, critically damped: it sets
  // off easy and settles without swinging past); up when he's up top; a jolt off a vehicle's side, a stumble's
  const bump = run && run.t - run.bump < .22 ? Math.sin((run.t - run.bump) * 60) * .25 * (1 - (run.t - run.bump) / .22) : 0;
  const sh = st.hitAt ? (now - st.hitAt) / 320 : 1, shake = sh < 1 ? Math.sin(sh * 26) * .3 * (1 - sh) : 0;
  const tx = (run ? run.x : 0) * .6;
  if (st.camF == null) { st.camF = tx; st.camV = 0; }
  else { st.camV += (CAM_W * CAM_W * (tx - st.camF) - 2 * CAM_W * st.camV) * dt; st.camF += st.camV * dt; }
  st.camX = st.camF + .2 * bump + .35 * shake;
  const lift = run && !run.over ? R.groundAt(run.co, R.laneOf(run), run.z, run.y) * .8 : st.lift || 0;
  st.lift = (st.lift || 0) + (lift - (st.lift || 0)) * Math.min(1, dt * 3.5);
  // (down into a pothole with him: the picture's held back with him (core fallAt: a moment, a yard or two), the camera
  // too, and it dips, down quick and back up easier; with reduced motion it does neither: it stays on where he is)
  const fl = run ? fallOf(st, now) : null, lo = st.lagOut && !fl ? 1 - (now - st.lagOut.at) / FALL.out : 0;
  st.lag = fl ? fl.lag : lo > 0 ? st.lagOut.v * smooth(lo) : 0;
  const dip = fl && !ui.RM ? FALL.dip * fl.k : 0;
  st.dip = (st.dip || 0) + (dip - (st.dip || 0)) * Math.min(1, dt * (dip > (st.dip || 0) ? 30 : 10));
  st.camH = st.camH0 + st.lift - st.dip;
  st.camZ = (run ? run.z : 0) - st.back - (ui.RM ? 0 : st.lag);
  const z = run ? run.z : 0, t = now / 1000;
  st.t = t;
  // booze: the world sways (on the hard course, the owner's ask, Oct 2026: further, up and down too, and blurred)
  const drunk = run && !run.over ? Math.min(1, run.booze / .8) : 0, hardDrunk = drunk > 0 && run.co.hard;
  if (drunk > 0) {
    const [rot, sc, dx, dy] = hardDrunk ? [.085, 1.13, 15, 9] : [.045, 1.07, 6, 0];
    c.fillStyle = '#1A1408'; c.fillRect(0, 0, st.W, st.H);
    c.translate(st.W / 2, st.H * .62); c.rotate(rot * drunk * Math.sin(t * 1.7)); c.scale(sc, sc);
    c.translate(-st.W / 2 + dx * drunk * Math.sin(t * 1.1), -st.H * .62 + dy * drunk * Math.sin(t * 1.35 + 1));
  }
  // (the blur's on the canvas itself, so the score and the power-ups over it stay sharp)
  const blur = hardDrunk ? (Math.round((1.8 + .9 * Math.sin(t * 2.3)) * drunk * 10) / 10) : 0;
  if (blur !== (st.blur || 0)) { st.blur = blur; c.canvas.style.filter = blur ? `blur(${blur}px)` : ''; }
  st.bend = D3.ready() ? W.BEND : 0;
  if (!(D3.ready() && style.sky(skyView(st), c, t, z))) W.sky(skyView(st), c, t, z);
  if (D3.ready()) { draw3(st, c, now); drawSpeed(st, c, now); }
  else { W.ground(st, c); W.sides(st, c); drawSpeed(st, c, now); drawLanes(st, c, now); }
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
  if (run && !run.over && run.burst > 0) edge('120,220,255', 1.2 * R.burstOf(run)); // (the salts' burst: cold air rushing by)
  // the linebacker on your back (at the catch and after a hit, till you've lost him: a hit now is a tackle): red at the
  // edges, beating faster the closer he is
  if (R.chasing(run)) {
    const C = R.CHASE, g = R.gapOf(run), cl = v => Math.max(0, Math.min(1, v));
    const close = .35 + .65 * (1 - cl((g - C.near) / (C.edge - C.near))), coming = cl((C.far - g) / (C.far - C.edge)); // (rising as he runs up)
    edge('214,24,40', .5 * close * coming * (.7 + .3 * Math.sin(t * (6 + 6 * close))));
  }
  const flash = st.flashAt ? 1 - (now - st.flashAt) / 450 : 0;
  if (flash > 0) { c.fillStyle = `rgba(235,250,255,${(.75 * flash).toFixed(2)})`; c.fillRect(0, 0, st.W, st.H); }
}

// ============================================================================ Play
const CATCH_MS = 750;
const CAM_W = 8; // (the camera's spring across: half way there in about a fifth of a second)
function setDay(st, n) {
  st.n = n;
  st.day = R.dayState(n);
}
function patchHud(st) {
  const el = st.el, run = st.run, live = run && st.mode !== 'ready', y = live ? Math.floor(run.yards) : 0;
  const yd = el.querySelector('[data-rm-yds]'); if (yd && yd.textContent !== String(y)) yd.textContent = String(y);
  const tot = el.querySelector('[data-rm-tot]'), t = nf(Math.max(st.day.best, run && !run.over && st.mode !== 'ready' ? y : 0));
  if (tot && tot.textContent !== t) tot.textContent = t;
  // the coins he's run through (a coin run, on the owner's profile, alone)
  const cc = el.querySelector('[data-rm-coins]'), coins = live && coinsShown(st);
  if (cc) {
    if (cc.hidden === coins) cc.hidden = !coins;
    const cn = cc.querySelector('[data-rm-cn]'), cv = coins ? nf(run.c) : '0';
    if (cn && cn.textContent !== cv) cn.textContent = cv;
  }
  // the power-ups he's carrying: the salts, and what's left of the painkillers and the booze
  const on = live && !run.over, x2 = on && run.booze > 0;
  const chip = el.querySelector('[data-rm-ychip]'); if (chip) chip.classList.toggle('is-x2', !!x2);
  const yu = el.querySelector('[data-rm-yu]'); if (yu && yu.textContent !== (x2 ? 'yds ×2' : 'yds')) yu.textContent = x2 ? 'yds ×2' : 'yds';
  const pw = el.querySelector('[data-rm-pows]');
  if (pw) {
    // (the salts: how many he's got, and the burst's time left while he's bursting)
    const list = on ? [(run.salts > 0 || run.burst > 0) && 'salts', run.pills > 0 && 'pills', run.booze > 0 && 'booze'].filter(Boolean) : [];
    const key = list.join() + (on ? run.salts + (run.burst > 0 ? 'b' : '') : '');
    if (pw.dataset.key !== key) {
      pw.dataset.key = key;
      pw.innerHTML = list.map(k => `<span class="rm-chip rm-pw is-${k}">${iconHTML(k, 22)}${k === 'salts' ? (run.salts > 0 ? `<b>×${run.salts}</b>` : '') + (run.burst > 0 ? '<i class="rm-bar"><b data-rm-bar="burst"></b></i>' : '') : `<i class="rm-bar"><b data-rm-bar="${k}"></b></i>`}</span>`).join('');
    }
    if (on) pw.querySelectorAll('[data-rm-bar]').forEach(b => { const k = b.dataset.rmBar, of = k === 'burst' ? R.burstSecs(run) : R.POWER[k].s; b.style.transform = `scaleX(${Math.max(0, Math.min(1, run[k] / of)).toFixed(3)})`; });
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
  clearTimeout(st.waitT); st.waitT = 0; st.waited = false;
  // (a run of the day's left under way here and never ended (paused, then dropped some other way): it counts where it
  // got to first, so no kickoff is run twice, nor the day's first run with its coins)
  if (R.live(st.n)) { R.settle(st.n); if (!R.testing()) R.autoPost(); setDay(st, st.n); }
  // (the owner's: the hard course; the coins on the day's first run alone, core coinsOpen)
  const own = data.isOwner(), k = st.day.next, coins = own && R.coinsOpen(st.n, k, own);
  st.run = R.startRun(st.n, k, own, coins);
  // (his first run here, but the board shows another of his phones ran the day's first: the end card says so)
  if (own && !coins && !k && !R.testing() && R.ranElsewhere(st.n)) st.run.elsewhere = true;
  st.knocked = new Map(); st.got = new Set(); st.flashAt = 0; st.hitAt = 0; st.chX = null; st.spinAt = 0; st.landAt = 0; st.edgeAt = 0; st.fall = null; st.splash = null; st.lagOut = null; st.dip = 0;
  st.coinGot = new Set(); st.sparks = [];
  ungot(st);
  clearPickupPop(st);
  st.co = st.run.co;
  W.warm(skyView(st), 0);
  st.mode = 'catch'; st.catchAt = performance.now();
  setCard(st, false);
  patchHud(st);
  ui.haptic('light');
  fitScreen(st, true);
  loop(st);
}
function tackled(st) {
  st.mode = 'tackled'; st.downAt = performance.now();
  ungot(st); clearPickupPop(st);
  ui.haptic('error');
  st.day = R.record(st.n, st.run.k, st.run.yards, st.run.z, runCoins(st)) || R.dayState(st.n);
  R.autoPost();
  patchHud(st);
  st.later = setTimeout(() => { if (!st.dead) { setCard(st, true); patchBoard(st); } }, ui.RM ? 200 : 950);
}
/** A power-up he's just picked up: what it is and what it does, under the HUD for a moment. */
const GOT_MS = 3200;
function got(st, kind) {
  const el = st.el.querySelector('[data-rm-got]'), p = R.powerOf(kind, st.run && st.run.co.hard);
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
// On the hard course (the owner's, for now) the only words that pop up over his run are a pickup's catchphrase (the
// owner's ask, Oct 2026: "only catch phrases when something is picked up ... when the smelling salts are picked up the
// screen says, Woooo"): no place names, move calls, hit words or the pickup's card. The haptics, the red edges and the
// screen reader's words stay.
const CATCHPHRASE = {salts: 'WOOOO!', pills: 'CAN’T FEEL A THING!', booze: 'HOLD MY BEER!'};
// A shuffled deck per pickup keeps the owner's jokes fresh across runs in this view.
const PICKUP_LINES = {
  salts: ['WOOOO! TERMS APPLY.', 'SECOND WIND. SAME EGO.', 'WARRANTY EXTENDED', 'BACK ON THE PAYROLL', 'DEATH CALL OVERTURNED', 'TOO AWAKE FOR THIS'],
  pills: ['PAIN CLAIM DENIED', 'HR SAYS YOU’RE FINE', 'COMPLAINTS MUTED', 'SIX SECONDS OF DENIAL', 'CLEARED BY THE INTERN', 'TEAM DOCTOR: LOL'],
  booze: ['CREATIVE YARD ACCOUNTING', 'DOUBLE YARDS. HALF A PLAN.', 'THE REPLAY LOOKED SOBER', 'STATS UP. STANDARDS DOWN.', 'HOLD MY OTHER BEER!', 'BAD IDEAS. GREAT STATS.']
};
function pickupLine(st, kind) {
  const lines = PICKUP_LINES[kind];
  if (!lines) return CATCHPHRASE[kind] || 'WOOOO!';
  const decks = st.pickupLines || (st.pickupLines = {}), deck = decks[kind] || (decks[kind] = {left: [], last: null});
  if (!deck.left.length) {
    deck.left = lines.slice();
    for (let i = deck.left.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck.left[i], deck.left[j]] = [deck.left[j], deck.left[i]];
    }
    // Do not repeat the last joke when the next shuffled deck starts.
    const end = deck.left.length - 1;
    if (end > 0 && deck.left[end] === deck.last) [deck.left[0], deck.left[end]] = [deck.left[end], deck.left[0]];
  }
  return deck.last = deck.left.pop();
}
function clearPickupPop(st) {
  const el = st.el.querySelector('[data-rm-pop].is-quippy');
  if (el) { el.className = 'rm-pop'; el.textContent = ''; }
}
function catchphrase(st, kind) {
  ungot(st);
  const owner = data.isOwner(), line = owner ? pickupLine(st, kind) : CATCHPHRASE[kind] || 'WOOOO!';
  pop(st, line, `is-${kind} is-catch${owner ? ' is-quippy' : ''}`);
  return owner ? line : '';
}
function onEvents(st, evs) {
  const now = performance.now();
  const quiet = !!(st.run && st.run.co && st.run.co.hard), say = (...a) => { if (!quiet) pop(st, ...a); };
  evs.forEach(e => {
    // a juke off the edge of the road (a hit): he bounces off it
    if (e.edge) { st.edgeAt = now; st.edgeDir = e.edge === 'right' ? 1 : -1; }
    // a touchdown is the way into the next place: no pop for it (the owner's ask, Oct 2026), just the crowd and the call
    if (e.type === 'td') {
      const into = evs.find(x => x.type === 'zone');
      st.cheer = now + 2600; ui.haptic('success'); ui.announce(`Touchdown! ${plural(e.n, 'touchdown')}.${into ? ` ${into.theme.name}.` : ''}`);
    }
    else if (e.type === 'zone') { W.warm(skyView(st), e.z); if (!evs.some(x => x.type === 'td')) say(e.theme.name.toUpperCase(), 'is-zone'); }
    // a juke past something: he spins all the way round (not on the owner's phone, his ask, Oct 2026: just the cut)
    else if (e.type === 'juked') { if (!data.isOwner()) { say('SPIN MOVE!'); st.spinAt = now; st.spinDir = Math.sign(R.xOf(st.run, st.run.lane) - st.run.jFrom) || 1; } }
    else if (e.type === 'hurdled') { say(e.ob === 'hole' ? 'HOP!' : 'HURDLE!'); ui.haptic('light'); }
    else if (e.type === 'slid') { say('SLIDE!'); ui.haptic('light'); }
    else if (e.type === 'pickup') {
      const pw = R.powerOf(e.kind, st.run.co.hard); st.got.add(e.item.i);
      const line = quiet ? catchphrase(st, e.kind) : '';
      if (!quiet) got(st, e.kind);
      ui.haptic('success'); ui.announce(`${line ? line + '. ' : ''}${pw.name}: ${pw.is}. ${pw.does}.`);
    }
    else if (e.type === 'landed') st.landAt = now;
    // (a coin: his, on his profile; off it, where they're hidden, it isn't counted)
    else if (e.type === 'coin') { if (coinsShown(st)) coinGot(st, e, now); else if (st.run) st.run.c = Math.max(0, st.run.c - 1); }
    // a pothole's cone he ran through: kicked flying, off to the side (his lane's, or the way he's juking); nothing more
    else if (e.type === 'coned') {
      const run = st.run, dir = run.t - run.lastJuke < SIDE_S ? Math.sign(R.xOf(run, run.lane) - run.jFrom) : 0;
      // (kicked on ahead at most of his speed, slowing as it goes: return-world.js coneFly)
      st.knocked.set(`cone:${e.row.i}:${e.lane}`, {at: now, side: e.lane === 0 ? -1 : e.lane === 2 ? 1 : dir || (e.row.i % 2 ? 1 : -1), ahead: W.coneAhead(R.speedAt(run.z, run.co.hard))});
    }
    else if (e.type === 'trucked') { st.knocked.set(`${e.row.i}:${e.lane}`, {at: now}); say('SMASHED!', 'is-pills'); ui.haptic('medium'); }
    else if (e.type === 'vaulted') { say('OVER THE TOP!', 'is-pills'); ui.haptic('medium'); }
    // a hit: he lurches (into a pothole: he falls in it)
    else if (e.type === 'stumbled') {
      if (!fallIn(st, e, now)) { st.hitAt = now; st.hitDir = fallDir(st.run); }
      say('STUMBLE!', 'is-hit', st.run.co.hard ? 'Next hit: tackled' : 'The linebacker’s on you'); ui.haptic('warning');
      ui.announce(`${R.hitLine(e)}. ${st.run.co.hard ? 'Your next unprotected hit will be a tackle, even after a clean stretch.' : 'The linebacker’s on you: another hit now and he’ll tackle you.'}`);
      if (e.row) st.knocked.set(`${e.row.i}:${e.lane}`, {at: now});
    }
    else if (e.type === 'shoved') { if (e.row) st.knocked.set(`${e.row.i}:${e.lane}`, {at: now}); }
    else if (e.type === 'revived') {
      st.flashAt = now;
      if (!fallIn(st, e, now)) { st.hitAt = now; st.hitDir = fallDir(st.run); }
      say('SHOOK HIM!', 'is-salts', 'Smelling salts: burst!'); ui.haptic('warning');
      if (e.row) st.knocked.set(`${e.row.i}:${e.lane}`, {at: now});
    }
    else if (e.type === 'tackled' || e.type === 'crashed') { fallIn(st, e, now); tackled(st); }
  });
}
function frame(st, now) {
  const dt = Math.min(.05, Math.max(0, (now - (st.last || now)) / 1000));
  st.last = now; st.dt = dt;
  // off screen (another tab, a sheet over it): the return waits
  if ((st.mode === 'run' || st.mode === 'catch') && !st.ctx.visible) { pause(st); return; }
  if (st.mode === 'catch' && now - st.catchAt >= CATCH_MS) st.mode = 'run';
  // (the hard course is the owner's alone: off his profile, even from another tab, a return on it ends where it is)
  if ((st.mode === 'run' || st.mode === 'catch' || st.mode === 'paused') && st.run.co.hard && !data.isOwner()) { R.stop(st.run); tackled(st); }
  if (st.mode === 'run') {
    const bumped = st.run.bump;
    onEvents(st, R.step(st.run, dt));
    if (st.run.bump !== bumped) ui.haptic('medium');
    if (st.mode === 'run' && now - (st.kept || 0) > 500) { st.kept = now; keep(st); }
  }
  draw(st, now);
  patchHud(st);
}
/** The run's coins to keep with it (a coin run's), else undefined. Taken on his profile alone (off it they're hidden and
 *  uncounted, onEvents, and a run on his hard course is whistled dead at the next frame, frame), so a run ended by a
 *  profile change keeps the ones he took: they're posted only from his profile (core coinsToPost). */
const runCoins = st => (st.run && st.run.coins ? st.run.c : undefined);
const keep = st => R.keepLive(st.n, st.run.k, st.run.yards, st.run.z, runCoins(st));
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
  endPaused(st);
  R.setTest(on, st.n);
  clearTimeout(st.later); clearTimeout(st.waitT); st.waitT = 0;
  st.run = null; st.mode = 'ready';
  setDay(st, st.n);
  const tp = st.el.querySelector('[data-rm-tp]');
  if (tp) { tp.innerHTML = testRowHTML(R.testing(), 'data-rm-test'); ui.hydrate(tp); }
  const auto = on && autoGoes(st); // (the owner's Test play kicks off on its own; back to the real day waits for him)
  if (!auto) setCard(st, true);
  patchHud(st); patchBoard(st); draw(st);
  ui.haptic('medium');
  fitScreen(st, true);
  ui.announce(on ? 'Test play: today’s kickoff, fresh. It won’t count.' : 'Test play over: back to your real day.');
  if (auto) go(st);
}
function onClick(st, e) {
  const t = e.target.closest('[data-rm-go], [data-rm-resume], [data-rm-sb], [data-rm-test]');
  if (!t || !st.el.contains(t)) return;
  if (t.hasAttribute('data-rm-go')) { if (st.mode === 'tackled') { st.mode = 'ready'; st.run = null; } go(st); return; }
  if (t.hasAttribute('data-rm-resume')) { resume(st); return; }
  if (t.hasAttribute('data-rm-sb')) { const b = st.el.querySelector('[data-rm-board]'); if (b) b.scrollIntoView({behavior: ui.RM ? 'auto' : 'smooth', block: 'start'}); return; }
  if (t.hasAttribute('data-rm-test')) testPlay(st, t.dataset.rmTest === 'on');
}
/** A run paused here, ended where it got to (as leaving the page ends one) before it's put aside for Test play or a new
 *  day: never just dropped, so neither a kickoff nor the day's first run, with its coins, can be run again. */
function endPaused(st) {
  if (!st.run || st.mode !== 'paused') return;
  keep(st); R.settle(st.n);
  if (!R.testing()) R.autoPost();
}
function tick(st) {
  // a new day at midnight: the next kickoff
  if (R.todayNumber() !== st.n && st.mode !== 'run' && st.mode !== 'catch') {
    endPaused(st);
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
  const st = {el, ctx, mode: 'ready', sbMode: 'today', run: null, knocked: new Map(), got: new Set(), coinGot: new Set(), sparks: [], dead: false, raf: 0, camX: null, camF: null, cheer: 0, lift: 0};
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
  st.unsub = daily.subscribe(type => {
    if (type === 'lb' || type === 'ready' || type === 'error') patchBoard(st);
    if (type !== 'lb' || st.dead) return;
    recheckCoins(st); // (the board's in: the day's first run may have been on another of his phones)
    if ((st.waitT || st.waited) && autoGoes(st)) autoGo(st); // (his first kickoff, waiting for it: off it goes, with the coins or without)
  });
  // Profile changes also arrive from other tabs. Refresh existing HUD/card images immediately.
  st.iconOwner = data.isOwner();
  st.unsubIcons = data.subscribe(type => {
    if (type !== 'me' || st.dead || st.iconOwner === data.isOwner()) return;
    st.iconOwner = data.isOwner();
    clearPickupPop(st); st.pickupLines = null;
    el.querySelectorAll('[data-rm-icon]').forEach(img => { img.src = iconURL(img.dataset.rmIcon); });
    recheckCoins(st);
    // (an end card's coins line is the owner's: off his profile it goes)
    const card = el.querySelector('[data-rm-card]');
    if (card && !card.hidden && st.mode === 'tackled') { card.innerHTML = cardHTML(st); ui.hydrate(card); }
    patchHud(st);
    draw(st);
  });
  st.stopTick = ctx.timer(() => tick(st), 20000);
  // the stands twinkle while nothing's moving
  st.stopLife = ctx.timer(() => { if (!st.raf && !ui.RM && st.cv.getBoundingClientRect().bottom > 0) draw(st); }, 90);
  R.autoPost();
  SP.load().then(() => { if (!st.dead) draw(st); });
  D3.load().then(ok => { if (ok && !st.dead) draw(st); });
  requestAnimationFrame(() => { if (st.dead) return; size(st); draw(st); fitScreen(st, true); autoGo(st); });
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
  clearTimeout(st.later); clearTimeout(st.gotT); clearTimeout(st.waitT);
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
  if (st.unsubIcons) st.unsubIcons();
  if (st.stopTick) st.stopTick();
  if (st.stopLife) st.stopLife();
  STATE.delete(el);
}
