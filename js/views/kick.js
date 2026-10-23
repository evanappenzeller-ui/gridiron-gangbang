import * as features from '../core/features.js';
// Kick It: the Daily Games' fourth game (a pane of views/puzzles.js; route /puzzles/kick), after Paper Toss. The field
// from behind and above the kicker and the holder (third person), at night under the lights; the posts stand somewhere
// new for every kick (distance and angle), the flags on the uprights and the wind arrow show the wind. Flick the ball
// at the posts: the flick's direction aims and its speed is the leg; the ball flies straight and rides the wind (calm
// for the first three makes, then wind, stronger with every make from the fifth; from the seventh make a brick wall
// in the goal's opening). "It's good!", or wide, short, off the bar or off an upright; the third miss ends the day's
// run. Then the run's numbers and the league's scoreboard (Today / Week).
// The physics, the day's kicks, memory and the board are core/kick.js; this draws (one canvas) and takes the flick.
// A finger on the field shows how to kick (the guide), and three steps under it say it.
// Keepfall's Gold (the owner's alone, Oct 21 2026): on his profile every 5th, 10th, 15th... make bursts coins up from
// the posts with "+3,000" (and the game's haptic, its celebration pattern; not when a run from another of his phones
// already counts today: only the first run pays), and the run's final card says what the day pays Keepfall ("+6,500
// Gold for Keepfall": 500 for the run and 3,000 for every 5th make, Oct 22 2026; core/kick.js goldOf, countingRun).
// From the first day paid this way (Thu Oct 22 2026: goldDay); his Test play shows it any day, saying it isn't paid.
// Everyone else's game is as it was:
// nothing of it is drawn, added to the page or said on their phones, and it goes the moment the profile changes.
// Exports: render(ctx), mount(el, ctx, {anchor}), params(el, ctx), unmount(el, ctx); keepHTML, burstHTML (the kit
// checks). Owner: KICK.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as K from '../core/kick.js';
import {msToMidnight} from './board.js';
import {canTest, testRowHTML} from './testplay.js';
import {backdrop, bowl, seeded, sparkle, fan, SKIN} from './stadium.js';

const esc = data.esc;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ST = new WeakMap(); // ctx -> pane state

// The stylesheet's mark (--kk-css on :root): a home-screen app open across an update adds the current file.
const CSS_V = '8';
function ensureCss() {
  try {
    if (getComputedStyle(document.documentElement).getPropertyValue('--kk-css').trim() === CSS_V || document.querySelector('link[data-kk-css]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL(`../../css/views/kick.css?v=${CSS_V}`, import.meta.url).href;
    l.setAttribute('data-kk-css', '');
    document.head.appendChild(l);
  } catch (_) {}
}

// ============================================================================ Markup
const strikesHTML = missed => Array.from({length: K.STRIKES}, (_, i) => `<i class="kk-x${i < missed ? ' is-out' : ''}"></i>`).join('');
const windArrow = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l6 8h-4v10h-4V11H6z" fill="currentColor"/></svg>`;
const windWords = k => {
  if (!k.w) return 'No wind';
  const a = ((k.dir % 360) + 360) % 360;
  const side = a > 20 && a < 160 ? 'to the right' : a > 200 && a < 340 ? 'to the left' : '';
  const along = a <= 45 || a >= 315 ? 'behind you' : a >= 135 && a <= 225 ? 'in your face' : '';
  return `${k.w} mph wind${along ? `, ${along}` : ''}${side ? `${along ? ' and' : ','} blowing ${side}` : ''}`;
};
// The wind's strength on the HUD: a breeze (orange), 9 mph and up (amber), 15 and up (red).
const windTier = k => (!k.w ? ' is-calm' : k.w >= 15 ? ' is-strong' : k.w >= 9 ? ' is-breezy' : '');
/** Kick i of the day's run as it's played: its wind and its wall go by the kicks made before it (core/kick.js
 *  kickFor); kickNow, the one on the tee. */
const kickAt = (st, i) => K.kickFor(st.n, Math.min(i, K.MAX_KICKS - 1), K.score(st.day.list.slice(0, i)).made);
const kickNow = st => kickAt(st, st.i);
// Gusts: streaks blowing across the field the wind's way, more and faster the stronger it is (CSS animates them; the
// box is turned to the wind's heading, like the arrow: 0 toward the posts, up the screen).
function gustsHTML(k) {
  if (!k || !k.w) return '';
  const n = Math.min(24, Math.max(5, Math.round(k.w * 1.8)));
  return Array.from({length: n}, (_, j) => `<i style="left:${((j * 61.8 + 7) % 100).toFixed(1)}%;--gl:${28 + (j * 17) % 40}px;--gk:${(-((j * .377) % 1)).toFixed(3)}"></i>`).join('');
}
function patchGusts(st) {
  const g = st.el.querySelector('[data-kk-gusts]'), k = kickNow(st);
  if (!g || !k) return;
  const sig = `${k.w}@${k.dir}`;
  if (g.dataset.sig === sig) return;
  g.dataset.sig = sig;
  g.style.setProperty('--wd', `${k.dir}deg`);
  g.style.setProperty('--gs', `${Math.max(.55, 2.8 - k.w * .18).toFixed(2)}s`);
  g.style.setProperty('--go', Math.min(.7, .26 + k.w * .035).toFixed(3));
  g.innerHTML = gustsHTML(k);
}
function placeGusts(st) {
  const g = st.el.querySelector('[data-kk-gusts]');
  if (!g) return;
  const D = Math.ceil(Math.hypot(st.W, st.H));
  Object.assign(g.style, {width: D + 'px', height: D + 'px', left: Math.round((st.W - D) / 2) + 'px', top: Math.round((st.H - D) / 2) + 'px'});
  g.style.setProperty('--gd', D + 'px');
}
function hudHTML(st) {
  const k = kickNow(st), day = st.day;
  return `<div class="kk-hud-l"><span class="kk-kno">${esc(`${K.testing() ? 'Test · ' : ''}Kick ${Math.min(st.i + 1, K.MAX_KICKS)}`)}</span><b class="kk-dist">${k.d}<small> yds</small></b></div>`
    + `<div class="kk-wind${windTier(k)}" style="--wd:${k.dir}deg" aria-label="${esc(windWords(k))}">${k.w ? windArrow : ''}<span>${k.w ? `${k.w} mph` : 'Calm'}</span></div>`
    + `<div class="kk-hud-r"><span class="kk-made"><b>${day.made}</b> made</span><span class="kk-xs" aria-label="${esc(`${day.missed} ${day.missed === 1 ? 'miss' : 'misses'} of ${K.STRIKES}`)}">${strikesHTML(day.missed)}</span></div>`;
}
function overHTML(st) {
  const d = st.day;
  const head = d.made >= 20 ? 'Automatic.' : d.made >= 12 ? 'Pro Bowl leg.' : d.made >= 7 ? 'Solid day at the office.' : d.made >= 3 ? 'Shanked a few.' : 'Cut after practice.';
  return `<div class="kk-over-card"><p class="kk-over-k">${esc(`Kick It · ${K.dayLabel(st.n)}`)}</p>`
    + `<p class="kk-over-n"><b>${d.made}</b><span>${d.made === 1 ? 'field goal' : 'field goals'}</span></p>`
    + `<p class="kk-over-h">${esc(head)}</p>`
    + `<p class="kk-over-s">${esc(d.longest ? `Longest ${d.longest} yds · ${d.yards} yds in all · ${plural(d.list.length, 'kick')}` : `${plural(d.list.length, 'kick')}, none through`)}</p>`
    + (d.practice && d.official ? `<p class="kk-over-p">${esc(`Practice run. Your first run today (${plural(d.official.made, 'field goal')}) is the one on the scoreboard.`)}</p>` : '')
    + (st.keepSig = keepNow(st))
    + ui.button({label: 'See the scoreboard', kind: 'primary', icon: 'trophy', cls: 'kk-sb-go', attrs: {'data-kk-sb': ''}})
    + `<p class="kk-over-t">${ui.icon('clock', {size: 14})}<span>${esc(`New kicks in ${ui.untilText(msToMidnight())}`)}</span></p></div>`;
}
// ---------------------------------------------------------------- Keepfall's Gold (the owner's alone)
const COIN = '<i class="kk-coin" aria-hidden="true"></i>';
const num = v => Number(v).toLocaleString('en-US');
/** Keepfall's line on the run's final card: what the day pays in Gold ("+6,500 Gold for Keepfall": the base for the
 *  run, 500, whatever it made, and 3,000 for every 5th make: core/kick.js goldOf). The owner's alone: '' on anyone
 *  else's profile, so their card is as it was. o: {owner, test (Test play: shown, never paid), made (this run's makes),
 *  run (core/kick.js countingRun: the run that pays, which on another phone may be another run), practice (an old
 *  practice run: its own note already says which run counts)}. */
export function keepHTML({owner, test, made, run, practice} = {}) {
  if (!owner) return '';
  const g = K.goldOf(test || !run ? made : run.m);
  // (a real run always pays the base: never "No Gold" for one)
  const words = test ? `+${num(g)} Gold` : `+${num(g)} Gold for Keepfall`;
  const sub = test ? 'Test play: nothing’s paid to Keepfall.'
    : run && run.m !== made && !practice ? `From your first run today: ${plural(run.m, 'field goal')}.`
    : `${num(K.GOLD.base)} for the run + ${num(K.GOLD.each)} for every ${K.GOLD.every}th field goal.`;
  return `<p class="kk-over-g${g ? '' : ' is-none'}${test ? ' is-test' : ''}" data-kk-gold>${COIN}<span>${esc(words)}</span></p>`
    + (sub ? `<p class="kk-over-gs">${esc(sub)}</p>` : '');
}
/** Whether this run shows Keepfall's Gold: the owner's, on a day paid this way (core/kick.js goldDay: from Thu Oct 22
 *  2026), or his Test play (a sandbox: it shows what a real run would, on any day). */
const keepShows = st => features.available() && (K.testing() || K.goldDay(st.n));
/** keepHTML for this phone now: '' unless it's the owner's (and the day pays this way). */
function keepNow(st) {
  const owner = keepShows(st), test = K.testing();
  return keepHTML({owner, test, made: st.day.made, run: owner && !test ? K.countingRun(st.n) : null, practice: !!(st.day.practice && st.day.official)});
}
/** The coin burst's insides: coins flying up and out from the posts (each its own way, spin and delay, the same every
 *  time) and "+3,000" (GOLD.each) under the call. */
export function burstHTML(amount = K.GOLD.each) {
  const N = 14, coins = Array.from({length: N}, (_, j) => {
    const a = j / (N - 1) * 2 - 1, dx = Math.round(a * 120 + ((j * 37) % 23) - 11), dy = -Math.round(105 + ((j * 53) % 70));
    const r = ((j * 97) % 540) - 270, d = (j * 29) % 170, s = 16 + (j * 7) % 10;
    return `<i class="kk-coin kk-coin-f" style="--dx:${dx}px;--dy:${dy}px;--r:${r}deg;--d:${d}ms;--s:${s}px"></i>`;
  }).join('');
  return `${coins}<b class="kk-coins-n">${COIN}<span>+${esc(num(amount))}</span></b>`;
}
/** A make that pays (the 5th, 10th...): coins burst up from the crossbar, "+3,000" under the call. The owner's alone;
 *  false (nothing shown) on anyone else's profile. */
function coinBurst(st) {
  const stage = st.el.querySelector('[data-kk-stage]');
  if (st.dead || !stage || !features.available()) return false;
  clearBurst(st);
  const sc = st.scene || kickNow(st), p = proj(st, sc.gx, K.POST.bar, sc.d), call = st.el.querySelector('[data-kk-call]');
  const under = call ? call.offsetTop + call.offsetHeight + 12 : st.H * .5;
  const b = document.createElement('div');
  b.className = 'kk-coins';
  b.setAttribute('data-kk-coins', '');
  b.setAttribute('aria-hidden', 'true');
  b.style.setProperty('--ox', `${Math.round(Math.max(40, Math.min(st.W - 40, p.x)))}px`);
  b.style.setProperty('--oy', `${Math.round(Math.max(60, Math.min(st.H * .6, p.y)))}px`);
  b.style.setProperty('--ly', `${Math.round(Math.min(st.H - 140, under))}px`);
  b.innerHTML = burstHTML();
  stage.appendChild(b);
  st.timers.push(setTimeout(() => b.remove(), 1800));
  ui.announce(`Plus ${num(K.GOLD.each)} Gold for Keepfall.`);
  return true;
}
const clearBurst = st => st.el.querySelectorAll('[data-kk-coins]').forEach(x => x.remove());
/** Whether, while this run is played, today's run that pays is already another's: one posted from another of the
 *  owner's phones (this phone posts its run only once it's finished). Test play (a sandbox) shows the Gold as a real
 *  first run would. */
const otherRunCounts = st => !K.testing() && !st.day.done && (K.countingRun(st.n) || {}).from === 'board';
/** The profile changed (here or in another tab), or the board did on the owner's phone: the final card again, with or
 *  without Keepfall's line; a burst on the field goes if it's no longer the owner's. */
function patchKeep(st) {
  if (st.dead) return;
  if (!features.available()) clearBurst(st);
  const over = st.el.querySelector('[data-kk-over]');
  if (over && !over.hidden && st.day.done && keepNow(st) !== st.keepSig) over.innerHTML = overHTML(st);
}
// The guide's finger (a hand, index finger up; the ring at its tip is where it touches).
const HAND = `<svg viewBox="0 0 44 56"><circle class="kk-guide-ring" cx="17" cy="7" r="7"/>`
  + `<path class="kk-guide-fing" d="M12 10a5 5 0 0 1 10 0v15h2v-4a4.5 4.5 0 0 1 9 0v3a4.5 4.5 0 0 1 8 2.8V38c0 9.4-6.6 16-15.5 16h-1.6c-5.2 0-9.5-2.8-12-7.3L4.6 36.4a4.3 4.3 0 0 1 7.2-4.6l.2.3z"/></svg>`;
const SB_MODES = [{id: 'today', label: 'Today'}, {id: 'week', label: 'Week'}];
function rowHTML(r, mode) {
  const sub = mode === 'today' ? (r.l ? `Longest ${r.l} yds · ${plural(r.k || 0, 'kick')}` : plural(r.k || 0, 'kick')) : `${plural(r.played, 'day')} · longest ${r.l} yds`;
  const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}${r.guest ? ', guest' : ''}: ${plural(r.m, 'field goal')}. ${sub}.`;
  return `<div class="c-brow-w" role="listitem"><div class="row c-brow kk-brow${r.me ? ' is-me' : ''}" aria-label="${esc(label)}">`
    + `<span class="c-brank n4${r.rank <= 3 ? ' is-r' + r.rank : ''}" aria-hidden="true">${r.rank}</span>`
    + `<span class="row-lead" aria-hidden="true">${ui.nickAvatar(r.name, {size: 36, managerId: r.managerId, you: r.me, crown: r.rank === 1 && r.m > 0})}</span>`
    + `<span class="row-main" aria-hidden="true"><span class="row-title"><span class="c-bnick">${esc(r.name)}</span>${r.me ? ui.badge('you') : r.guest ? ui.badge('guest') : ''}</span><span class="row-sub">${esc(sub)}</span></span>`
    + `<span class="row-trail" aria-hidden="true"><span class="n4 c-bval kk-bval">${r.m}</span></span></div></div>`;
}
function boardBodyHTML(st) {
  const state = K.boardState();
  if (state === 'loading') return `<div class="c-board-sk">${ui.skeleton('rows', 3, {label: 'Loading the scoreboard.'})}</div>`;
  if (state !== 'ready') return `<p class="c-board-note">The scoreboard isn't connected right now.</p>`;
  let rows = [];
  try { rows = st.sbMode === 'week' ? K.weekRows(st.n) : K.boardRows(st.n); } catch (e) { console.error(e); }
  if (!rows.length) return `<div class="c-board-empty"><p class="c-board-et">${st.sbMode === 'week' ? 'No kicks this week yet.' : 'Nobody’s kicked yet today.'}</p><p class="c-board-eb">Finish your run to put the first score up.</p></div>`;
  return `<p class="kk-sb-sum">${esc(st.sbMode === 'week' ? 'Field goals made this week (Tuesday to Monday)' : `${plural(rows.length, 'kicker')} today`)}</p>`
    + `<div class="c-brows" role="list" aria-label="${esc(st.sbMode === 'week' ? 'This week' : 'Today')}">${rows.map(r => rowHTML(r, st.sbMode)).join('')}</div>`;
}
function boardHTML(st) {
  return `<section class="card c-board kk-board" aria-labelledby="kk-sb-t"><div class="c-board-head"><h2 class="c-board-t" id="kk-sb-t">Scoreboard</h2></div>`
    + ui.seg({name: 'kk-sb', items: SB_MODES, value: st.sbMode, small: true, label: 'Scoreboard', cls: 'c-board-seg'})
    + `<div class="c-board-body" data-kk-sbody>${boardBodyHTML(st)}</div></section>`;
}
// While a run is on the field is the whole screen (between the nav bar and the tab bar) and nothing sits under it;
// once it's finished, the scoreboard shows below.
function bodyHTML(st) {
  return `<div class="kk${st.day.done ? '' : ' is-playing'}" data-kk>`
    + `<div class="kk-stage" data-kk-stage><canvas class="kk-cv" data-kk-cv role="img" aria-label="The field from behind the tee, the posts down the field."></canvas>`
    // the kicking pad: the stage's lower part, around the ball, takes the flick; the rest scrolls the page as usual
    + `<div class="kk-pad" data-kk-pad aria-hidden="true"></div>`
    + `<div class="kk-gusts" data-kk-gusts aria-hidden="true"></div>`
    + `<div class="kk-hud" data-kk-hud>${hudHTML(st)}</div>`
    + `<p class="kk-call" data-kk-call aria-live="polite"></p>`
    + `<div class="kk-guide" data-kk-guide hidden aria-hidden="true"><svg class="kk-guide-svg"><path class="kk-guide-trail" d="M0 0"/></svg><span class="kk-guide-hand">${HAND}</span></div>`
    + `<p class="kk-hint" data-kk-hint hidden>${ui.icon('arrow-up', {size: 16})}<span data-kk-hint-t>Slide up from the ball to kick</span></p>`
    + `<p class="kk-alert" data-kk-alert hidden role="status"><b>Look out!</b><span data-kk-alert-t></span></p>`
    + `<div class="kk-over" data-kk-over${st.day.done ? '' : ' hidden'}>${st.day.done ? overHTML(st) : ''}</div></div>`
    + `<div class="kk-fill" data-kk-fill aria-hidden="true"></div>`
    + `<div class="kk-board-w" data-kk-board>${boardHTML(st)}</div>`
    // the owner's Test play row at the bottom (views/testplay.js): under the field while a run is on
    + `<div data-kk-tp>${testRowHTML(K.testing(), 'data-kk-test')}</div></div>`;
}

// ============================================================================ The scene
// The world in yards (core/kick.js): x across, y up, z downfield from the tee. The camera is third person: st.back
// (K.CAM.back) behind the ball and st.camH up (about K.CAM.h, set so the stage fits), looking down on the kicker, the
// holder, the line and the posts. The posts stand at the middle of the field: a kick from off to the side has the
// field off to the side.
const FIELD = {half: 26.67, hash: K.HASH}; // (the hashes: core/kick.js, the ball on or between them)
/** The height between the screen's nav bar and the tab bar (0 when it can't be measured). */
function screenRoom(st) {
  const scr = st.ctx && st.ctx.screen, tb = document.getElementById('tabbar');
  if (!scr) return 0;
  const nav = scr.querySelector(':scope > .nav'), top = nav ? nav.getBoundingClientRect().bottom : scr.getBoundingClientRect().top;
  const bottom = tb && tb.offsetHeight ? tb.getBoundingClientRect().top : (innerHeight || 0);
  return Math.round(bottom - top - 16);
}
function size(st) {
  const cv = st.cv, W = cv.parentElement.clientWidth || 360;
  // the whole screen between the nav bar and the tab bar (8 px clear of each), within limits
  const room = screenRoom(st);
  const H = Math.round(room > 300 ? Math.max(360, Math.min(860, room)) : Math.max(380, Math.min(620, W * 1.3, (innerHeight || 800) - 170)));
  // (2x at most: at 3x the stage and its three cached layers are over twice the memory, and every frame's fill)
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.height = H + 'px';
  st.W = W; st.H = H; st.dpr = dpr;
  placeGusts(st);
  st.f = W * 1.05;
  st.back = K.CAM.back;
  // The ball about a seventh of the way up (clear of the buttons under it), the horizon about a third of the way
  // down: the camera rises to fit, so a taller stage looks down on more of the field rather than showing more sky.
  const yBall = H - Math.max(84, H * .14), yHor = Math.max(110, H * .34);
  st.camH = Math.max(4, Math.min(9, .15 + (yBall - yHor) * st.back / st.f));
  st.y0 = yBall - st.f * (st.camH - .15) / st.back;
  cv.dataset.kkCam = [st.f, st.back, st.camH, st.y0].map(v => v.toFixed(3)).join(); // (for the tests)
}
function proj(st, x, y, z) {
  const Z = Math.max(.25, z + st.back);
  return {x: st.W / 2 + st.f * x / Z, y: st.y0 + st.f * (st.camH - y) / Z, s: st.f / Z};
}
function quad(c, a, b, d, e) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); }
// ---------------------------------------------------------------- The stadium and the sky
// Drawn once per size into their own canvas (st.bg), then copied in each frame: the night sky and its stars; the bowl
// of stands, its rim curving up toward us at the sides, with the upper deck, the suites, a ribbon board, the lower deck
// and the wall at field level; the fans in rows; four banks of lights on the rim. Over it each frame (drawSky): a few
// stars twinkling and phones flashing in the crowd (a burst after a good kick); after the field, the lights' beams.
// (the stadium itself: views/stadium.js, shared with Return Man)
function drawSky(st, c, t) {
  if (!st.bg || st.bg.w !== st.W || st.bg.h !== st.H || st.bg.dpr !== st.dpr) {
    const B = bowl(st), r = seeded(23);
    const sparks = Array.from({length: 7}, () => { const x = r() * st.W; return {x, y: 6 + r() * Math.max(8, B.rim(x) - 18), s: 3 + r() * 3.5, v: 1 + r() * 1.8, ph: r() * 6.3}; });
    st.bg = {w: st.W, h: st.H, dpr: st.dpr, cv: backdrop(st), bowl: B, sparks};
  }
  c.drawImage(st.bg.cv, 0, 0, st.W, st.y0 + 2);
  st.bg.sparks.forEach(s => { const a = Math.max(0, Math.sin(t * s.v + s.ph)); if (a > .05) sparkle(c, s.x, s.y, s.s * (.6 + .4 * a), a * .9); });
  // phones and cameras going off in the stands, a lot of them after a good kick
  const B = st.bg.bowl, cheer = st.cheer > performance.now(), r = seeded(1 + Math.floor(t * (cheer ? 14 : 5)));
  for (let i = 0, n = cheer ? 18 : 3; i < n; i++) {
    const x = r() * st.W, top = B.rim(x) + B.Sh * .1, y = top + r() * (B.wall(x) - 2 - top), a = .55 + r() * .45;
    c.fillStyle = `rgba(255,255,255,${(a * .28).toFixed(2)})`; c.beginPath(); c.arc(x, y, 3.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; c.fillRect(x - .9, y - .9, 1.8, 1.8);
  }
}
/** The lights' beams, down across the stands and the field. */
function drawBeams(st, c) {
  st.bg.bowl.lights.forEach(L => {
    if (L.r < 1) return;
    const tx = st.W / 2 + (L.x - st.W / 2) * .2, spread = st.W * .24;
    const g = c.createLinearGradient(0, L.y, 0, st.H);
    g.addColorStop(0, 'rgba(215,228,255,.14)'); g.addColorStop(.55, 'rgba(215,228,255,.05)'); g.addColorStop(1, 'rgba(215,228,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(L.x - 7, L.y); c.lineTo(L.x + 7, L.y); c.lineTo(tx + spread, st.H); c.lineTo(tx - spread, st.H); c.closePath(); c.fill();
  });
}

// ---------------------------------------------------------------- The field
// Drawn into its own canvas (st.fl) for the posts' spot and redrawn only when that moves: the turf in mowed stripes;
// the white border round it; the end zone in navy with the name across it, its letters laid flat on the turf, and a
// pylon at each corner; the lines and hashes; the line of scrimmage in blue, as on TV; behind the end zone, the wall
// and the stands. Over it, a texture of blades (drawTurf: finer toward the far end), the same whatever the spot.
let GRASS = null;
function grass() {
  if (GRASS) return GRASS;
  const n = 128, cv = document.createElement('canvas'), r = seeded(11);
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  c.lineCap = 'round';
  for (let i = 0; i < 1500; i++) {
    const x = r() * n, y = r() * n, l = 2 + r() * 4, a = (r() - .5) * .6;
    c.strokeStyle = r() < .55 ? `rgba(0,30,0,${(.12 + r() * .16).toFixed(2)})` : `rgba(190,255,170,${(.06 + r() * .1).toFixed(2)})`;
    c.lineWidth = 1 + r() * .7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); c.stroke();
  }
  return (GRASS = cv);
}
/** The blades over the turf: a layer drawn once per size, laid over the field up to the wall behind the end zone. */
function drawTurf(st, c, sc) {
  const top = Math.floor(st.y0);
  if (!st.tex || st.tex.w !== st.W || st.tex.h !== st.H || st.tex.dpr !== st.dpr) {
    const cv = document.createElement('canvas'), H = st.H - top;
    cv.width = Math.round(st.W * st.dpr); cv.height = Math.round(H * st.dpr);
    const tc = cv.getContext('2d'), pat = tc.createPattern(grass(), 'repeat');
    tc.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    for (let i = 0, n = 6; i < n && pat; i++) {
      const ya = H * Math.pow(i / n, 1.5), yb = H * Math.pow((i + 1) / n, 1.5), k = .14 + .8 * (i + .5) / n;
      try { pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0])); } catch (_) {}
      tc.globalAlpha = .38 + .3 * i / n; tc.fillStyle = pat; tc.fillRect(0, ya, st.W, yb - ya + .5);
    }
    st.tex = {w: st.W, h: st.H, dpr: st.dpr, cv};
  }
  const from = Math.min(st.H - 1, Math.max(top, Math.ceil(proj(st, sc.gx, 0, sc.d + 10).y)));
  c.drawImage(st.tex.cv, 0, (from - top) * st.dpr, st.tex.cv.width, (st.H - from) * st.dpr, 0, from, st.W, st.H - from);
}
function drawField(st, c, sc) {
  const fonts = (document.fonts && document.fonts.status) || '';
  const key = `${st.W}x${st.H}@${st.dpr}:${sc.d.toFixed(2)},${sc.gx.toFixed(2)}:${fonts}`;
  if (!st.fl || st.fl.key !== key) {
    const top = Math.floor(st.y0), h = st.H - top;
    const cv = st.fl ? st.fl.cv : document.createElement('canvas'), cw = Math.round(st.W * st.dpr), ch = Math.round(h * st.dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const fc = cv.getContext('2d');
    fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(0, 0, cw, ch);
    fc.setTransform(st.dpr, 0, 0, st.dpr, 0, -top * st.dpr);
    paintField(st, fc, sc, top);
    st.fl = {key, cv, top, h};
  }
  c.drawImage(st.fl.cv, 0, st.fl.top, st.W, st.fl.h);
}
function paintField(st, c, sc, top) {
  const {d, gx} = sc, {W, H, y0} = st, zFar = d + 60, zNear = -2.8, gl = d - 10, hw = FIELD.half;
  const F = (z0, z1, col, x0 = gx - hw, x1 = gx + hw) => { c.fillStyle = col; quad(c, proj(st, x0, 0, z0), proj(st, x1, 0, z0), proj(st, x1, 0, z1), proj(st, x0, 0, z1)); c.fill(); };
  // beyond the sidelines; the white border round the field
  c.fillStyle = '#0C3420'; c.fillRect(0, y0, W, H - y0);
  F(zNear - 6, d + 2, '#E6EBE6', gx - hw - 2, gx + hw + 2);
  // the field in 5-yard stripes back from the goal line, cut across in lighter lanes; the end zone; past the end line
  for (let j = 0; gl - j * 5 > zNear - 5; j++) F(Math.max(zNear - 6, gl - (j + 1) * 5), gl - j * 5, j % 2 ? '#1D7A3D' : '#238847');
  for (let j = -5; j < 5; j += 2) F(zNear - 6, gl, 'rgba(255,255,255,.035)', gx + j * hw / 5, gx + (j + 1) * hw / 5);
  F(gl, d, '#17295E');
  F(d + 2, zFar, '#0F4429', gx - hw - 2, gx + hw + 2);
  endZoneName(st, c, sc, top);
  // a soft pool of light down the middle, darker toward the edges
  const lp = proj(st, gx, 0, d * .6);
  const rg = c.createRadialGradient(lp.x, lp.y, 4, lp.x, lp.y, W * .8);
  rg.addColorStop(0, 'rgba(255,255,255,.09)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg; c.fillRect(0, y0, W, H - y0);
  endStands(st, c, sc);
  // lines: the yard lines, goal line, end line, sidelines; the hashes
  c.strokeStyle = 'rgba(255,255,255,.85)';
  const across = (z, w = .12, x0 = gx - hw, x1 = gx + hw) => {
    if (z < zNear) return;
    const a = proj(st, x0, 0, z), b = proj(st, x1, 0, z);
    c.lineWidth = Math.max(1, w * a.s * .55); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  };
  for (let j = 5; gl - j > zNear; j += 5) across(gl - j);
  across(gl, .22); across(d, .22);
  // the line of scrimmage, as on TV
  c.strokeStyle = 'rgba(70,160,255,.85)'; across(K.LINE.z, .16);
  c.strokeStyle = 'rgba(255,255,255,.85)';
  c.lineWidth = 1.5;
  [-1, 1].forEach(s => { const a = proj(st, gx + s * hw, 0, zNear), b = proj(st, gx + s * hw, 0, d); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
  c.strokeStyle = 'rgba(255,255,255,.6)';
  for (let j = 1; gl - j > zNear; j++) {
    if (j % 5 === 0) continue;
    [-1, 1].forEach(s => across(gl - j, .08, gx + s * FIELD.hash - .35, gx + s * FIELD.hash + .35));
  }
  // the pylons at the end zone's corners
  [gl, d].forEach(z => [-1, 1].forEach(s => {
    const x = gx + s * (hw + .06), p = proj(st, x, 0, z), q = proj(st, x, .5, z), w = Math.max(1.6, .14 * p.s);
    if (p.x < -10 || p.x > W + 10) return;
    c.fillStyle = '#FF6A1A'; c.fillRect(p.x - w / 2, q.y, w, p.y - q.y);
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(p.x - w / 2, q.y + (p.y - q.y) * .4, w, Math.max(.7, (p.y - q.y) * .12));
  }));
}
// The fans behind the end zone, drawn once: rows of them on a strip STRIP.half yards either side of the middle, k px a
// yard (each row's shoulders .8 of the way down its band).
const STRIP = {k: 28, half: 80, rows: 8, cv: null};
function crowdStrip() {
  if (STRIP.cv) return STRIP.cv;
  const cv = document.createElement('canvas'), K2 = STRIP.k, r = seeded(31);
  cv.width = STRIP.half * 2 * K2; cv.height = STRIP.rows * K2;
  const c = cv.getContext('2d');
  for (let j = 0; j < STRIP.rows; j++) {
    const base = (j + .8) * K2;
    c.fillStyle = 'rgba(120,150,230,.12)'; c.fillRect(0, base + K2 * .2, cv.width, 1.5);
    for (let x = r() * 10; x < cv.width; x += K2 * .62 * (.9 + r() * .25)) { if (r() >= .07) fan(c, x, base, K2 * .58, r); }
  }
  return (STRIP.cv = cv);
}
/** Ten yards behind the end line: the wall round the field (padded, a ribbon board along it) and the first rows of the
 *  stands rising back from it, up to the horizon (where the backdrop's stands carry on). The fans stay put as the
 *  field moves (each seat is a spot in the world). */
function endStands(st, c, sc) {
  const {d, gx} = sc, {W, y0, f, back} = st, zw = d + 10;
  const w0 = proj(st, gx, 0, zw), w1 = proj(st, gx, 1.3, zw);
  if (w1.y <= y0 + 1) return;
  c.fillStyle = '#0A1129'; c.fillRect(0, y0, W, w1.y - y0 + .5);
  // the rows, back to front: each a strip of fans (crowdStrip) scaled to its distance
  const strip = crowdStrip(), rows = [];
  for (let j = 0; j < 60; j++) {
    const z = zw + .8 + j * .85, y = 1.8 + j * .48;
    if (proj(st, gx, y, z).y < y0 - 3) break;
    rows.push({j, z, y});
  }
  rows.reverse().forEach(({j, z, y}) => {
    const p = proj(st, -STRIP.half, y, z), k = p.s / STRIP.k, h = STRIP.k * k;
    c.drawImage(strip, 0, (j % STRIP.rows) * STRIP.k, strip.width, STRIP.k, p.x, p.y - .8 * h, strip.width * k, h);
  });
  // the light reaches the front rows more than the back
  const lg = c.createLinearGradient(0, y0, 0, w1.y);
  lg.addColorStop(0, 'rgba(3,6,18,.42)'); lg.addColorStop(1, 'rgba(3,6,18,.16)');
  c.fillStyle = lg; c.fillRect(0, y0, W, w1.y - y0);
  // the wall: navy padding, a ribbon board lit along its top, words going round
  const wh = w0.y - w1.y;
  c.fillStyle = '#14214F'; c.fillRect(0, w1.y, W, wh);
  const rbH = wh * .45;
  c.fillStyle = '#062016'; c.fillRect(0, w1.y + wh * .12, W, rbH);
  c.fillStyle = 'rgba(62,240,143,.65)'; c.fillRect(0, w1.y + wh * .12, W, Math.max(.6, wh * .03));
  c.fillStyle = 'rgba(170,190,255,.45)'; c.fillRect(0, w1.y, W, Math.max(.6, wh * .04));
  if (rbH >= 4) {
    c.font = `800 ${(rbH * .8).toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textBaseline = 'middle'; c.textAlign = 'center';
    const words = ['KICK IT', '★', 'GRIDIRON', '★'], every = 7, Z = zw + back, k0 = Math.floor(-W / 2 * Z / f / every) - 1, k1 = Math.ceil(W / 2 * Z / f / every) + 1;
    for (let k = k0; k <= k1; k++) {
      const w = words[((k % 4) + 4) % 4], p = proj(st, k * every, 0, zw);
      c.fillStyle = w === '★' ? '#F2C94C' : '#3EF08F'; c.fillText(w, p.x, w1.y + wh * .12 + rbH * .55);
    }
  }
  c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, w0.y, W, Math.max(1, wh * .12));
}
/** The name across the end zone, white with a navy edge, each letter laid flat on the turf where it lies. */
function endZoneName(st, c, sc, top) {
  const {d, gx} = sc, gl = d - 10, word = 'GRIDIRON', S = 100, za = gl + 2.8, zb = gl + 7.2, span = 26;
  c.save();
  c.globalAlpha = .88;
  c.font = `800 ${S}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  const ws = [...word].map(ch => c.measureText(ch).width + S * .1), tot = ws.reduce((a, b) => a + b, 0), kx = span / tot, kz = (zb - za) / (S * .72);
  let left = gx - span / 2;
  [...word].forEach((ch, i) => {
    const cx = left + ws[i] * kx / 2;
    left += ws[i] * kx;
    const p0 = proj(st, cx, 0, za), zm = (za + zb) / 2, pm = proj(st, cx, 0, zm), p1 = proj(st, cx + 1, 0, zm), pz = proj(st, cx, 0, zb);
    if (p0.x < -60 || p0.x > st.W + 60) return;
    const ax = (p1.x - pm.x) * kx, ay = (p1.y - pm.y) * kx, bx = (pz.x - p0.x) / (zb - za) * kz, by = (pz.y - p0.y) / (zb - za) * kz;
    c.setTransform(st.dpr * ax, st.dpr * ay, -st.dpr * bx, -st.dpr * by, st.dpr * p0.x, st.dpr * (p0.y - top));
    c.lineWidth = S * .12; c.strokeStyle = '#0A1435'; c.strokeText(ch, 0, 0);
    c.fillStyle = '#F2F5FB'; c.fillText(ch, 0, 0);
  });
  c.restore();
}
function drawPosts(st, c, sc, t) {
  const {d, gx, w, dir} = sc, {half, bar, top} = K.POST;
  const P = (x, y, z) => proj(st, x, y, z);
  const lw = s => Math.max(2, .16 * s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // a pole: its dark edge, the gold, a shine down its left side (the top of the crossbar)
  const pole = (path, w0, flat) => {
    c.strokeStyle = '#8A680A'; c.lineWidth = w0 + 1.8; path(0, 0); c.stroke();
    c.strokeStyle = '#F6C624'; c.lineWidth = w0; path(0, 0); c.stroke();
    c.strokeStyle = 'rgba(255,248,205,.9)'; c.lineWidth = Math.max(.8, w0 * .28); path(flat ? 0 : -w0 * .22, flat ? -w0 * .22 : 0); c.stroke();
  };
  const seg = (a, b) => (ox, oy) => { c.beginPath(); c.moveTo(a.x + ox, a.y + oy); c.lineTo(b.x + ox, b.y + oy); };
  // the gooseneck: up from behind the end line, curving forward to the middle of the crossbar
  const base = P(gx, 0, d + 2), knee = P(gx, bar - 1.2, d + 2), bend = P(gx, bar, d + 2), mid = P(gx, bar, d);
  pole((ox, oy) => { c.beginPath(); c.moveTo(base.x + ox, base.y + oy); c.lineTo(knee.x + ox, knee.y + oy); c.quadraticCurveTo(bend.x + ox, bend.y + oy, mid.x + ox, mid.y + oy); }, lw(base.s) * 1.2);
  // the padding round its foot: navy, rounded by the light, two white bands
  const pt = P(gx, 2.1, d + 2), pw = Math.max(3, lw(base.s) * 1.7), ph = base.y - pt.y;
  const pg = c.createLinearGradient(base.x - pw, 0, base.x + pw, 0);
  pg.addColorStop(0, '#2A4185'); pg.addColorStop(.3, '#3D5AAE'); pg.addColorStop(1, '#121D47');
  c.fillStyle = pg; c.fillRect(base.x - pw, pt.y, pw * 2, ph);
  c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillRect(base.x - pw, pt.y + ph * .1, pw * 2, Math.max(.8, ph * .05)); c.fillRect(base.x - pw, pt.y + ph * .82, pw * 2, Math.max(.8, ph * .05));
  // the crossbar and the uprights
  const L = P(gx - half, bar, d), R = P(gx + half, bar, d);
  pole(seg(L, R), lw(L.s), true);
  pole(seg(L, P(gx - half, top, d)), lw(L.s));
  pole(seg(R, P(gx + half, top, d)), lw(R.s));
  // the ribbons on top: blown with the wind (sideways and toward or away), flapping a little
  const a = dir * Math.PI / 180, s = Math.min(1, w / 10);
  [-1, 1].forEach(k => {
    const at = P(gx + k * half, top, d);
    const len = Math.max(13, 2.4 * at.s) * (.55 + .75 * s), flap = Math.sin(t * 9 + k) * .25 * s;
    const ex = at.x + Math.sin(a) * len * (.25 + s), ey = at.y + len * (1 - s * .85) * .9 + flap * len - Math.cos(a) * s * len * .25;
    const cx = (at.x + ex) / 2 + flap * len, cy = (at.y + ey) / 2 - flap * len * .3;
    c.strokeStyle = '#E2531C'; c.lineWidth = Math.max(3, .14 * at.s);
    c.beginPath(); c.moveTo(at.x, at.y); c.quadraticCurveTo(cx, cy, ex, ey); c.stroke();
    c.strokeStyle = '#FF9A4A'; c.lineWidth = Math.max(1, .05 * at.s);
    c.beginPath(); c.moveTo(at.x - .8, at.y); c.quadraticCurveTo(cx - .8, cy, ex - .8, ey); c.stroke();
  });
}
// ---------------------------------------------------------------- The wall in the goal
// Drawn standing on the turf, facing us, in yards from its foot (x across, y up: the canvas is flipped so y runs up),
// scaled by how far off it is; pop (0-1) grows it in when the posts move to a new kick.
// Drawn from its foot up (y0: the wall's on the crossbar, in the goal's opening).
const OB_DRAW = {
  wall(c, o) {
    const hw = o.half, h = o.h - (o.y0 || 0), row = h / 14;
    const g = c.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, '#C0503A'); g.addColorStop(.6, '#A63D2A'); g.addColorStop(1, '#7E2C1D');
    c.fillStyle = g; c.fillRect(-hw, 0, hw * 2, h);
    // mortar: the courses and the joints, every other course offset by half a brick
    c.strokeStyle = 'rgba(236,214,186,.6)'; c.lineWidth = row * .14;
    c.beginPath();
    for (let j = 1; j < 14; j++) { c.moveTo(-hw, j * row); c.lineTo(hw, j * row); }
    for (let j = 0; j < 14; j++) for (let x = -hw + (j % 2 ? .55 : 0) + 1.1; x < hw - .05; x += 1.1) { c.moveTo(x, j * row); c.lineTo(x, (j + 1) * row); }
    c.stroke();
    // the coping on top, and a sign
    c.fillStyle = '#D9C9B0'; c.fillRect(-hw - .15, h - .35, hw * 2 + .3, .45);
    const sw = Math.min(3.2, hw * 1.7), sk = sw / 3.2;
    c.fillStyle = '#F4F1EA'; c.fillRect(-sw / 2, h * .55, sw, 1.3 * sk);
    c.save(); c.scale(.05 * sk, -.05 * sk); c.fillStyle = '#C8102E'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 12.4px "Barlow Condensed", "Arial Narrow", sans-serif`; c.fillText('NO KICKING', 0, -(h * .55 + .65 * sk) * 20 / sk); c.restore();
  },
};
function drawObstacle(st, c, o, t, pop, shake) {
  const b = proj(st, o.x, o.y0 || 0, o.z);
  if (b.s <= 0 || pop <= 0) return;
  // its shadow on the turf (one standing on the ground)
  if (!o.y0) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(b.x, b.y, o.half * b.s * 1.05, Math.max(2, o.half * b.s * .16), 0, 0, Math.PI * 2); c.fill(); }
  c.save();
  c.translate(b.x + (shake ? Math.sin(t * 60) * shake * b.s * .25 : 0), b.y);
  c.scale(b.s * pop, -b.s * pop); // yards, y up
  try { (OB_DRAW[o.t] || OB_DRAW.wall)(c, o, t); } finally { c.restore(); }
}
// ---------------------------------------------------------------- The players
// Flat, shaded figures after a field-goal illustration: ours in navy jerseys with white sleeve caps and numbers, gray
// pants with a navy stripe, white socks, black cleats, navy helmets with a white stripe; the rush in red and white. The
// light comes from the upper left. Seven yards out (core/kick.js LINE): our line, backs to us (the snapper, guards,
// tackles, ends, and a wing set back at each end), the rush across from them; crouched till the kick, then the
// blockers rise and the rush leaps with arms up. All in yards from a player's feet, y up (the canvas is flipped).
const KIT = {
  us: {jersey: '#1B2A5C', shade: '#111B3F', hem: '#0C1430', cap: '#E8EBF2', capShade: '#B9C0CF', num: '#FFFFFF', numEdge: '#6E7FB3',
    pants: '#CDD2DC', pantsShade: '#A8AFBD', stripe: '#1B2A5C', sock: '#F3F4F7', cleat: '#14161B',
    helmet: '#1B2A5C', helmetStripe: '#F4F6FA', mask: '#C4CAD4', glove: '#151C36'},
  them: {jersey: '#B3201F', shade: '#851618', hem: '#5E0F11', cap: '#FFFFFF', capShade: '#D7D8DE', num: '#FFFFFF', numEdge: '#6E0E10',
    pants: '#F3F3F5', pantsShade: '#D0D2D9', stripe: '#B3201F', sock: '#B3201F', cleat: '#14161B',
    helmet: '#F2F3F5', helmetStripe: '#B3201F', mask: '#4E535C', glove: '#F4F4F6'}
};
const US = [[-4.05, 85, .7], [-3.15, 87], [-2.1, 77], [-1.05, 64], [0, 48], [1.05, 66], [2.1, 71], [3.15, 82], [4.05, 89, .7]]; // x, number, set back
const THEM = [[-4.75, 56], [-3.7, 91], [-2.65, 97], [-1.6, 93], [-.55, 99], [.55, 95], [1.6, 98], [2.65, 94], [3.7, 90], [4.75, 54]];
const skinOf = n => SKIN[(n * 7) % SKIN.length];
const mixP = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
function limb(c, a, b, w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
function oval(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
/** A jersey number, white with an edge, centered at (x, y), h yards tall. */
function numberAt(c, k, num, x, y, h) {
  if (h < .07) return;
  c.save(); c.translate(x, y); c.scale(h / 72 * .85, -h / 72);
  c.font = '800 100px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = k.numEdge; c.strokeText(String(num), 0, 5);
  c.fillStyle = k.num; c.fillText(String(num), 0, 5);
  c.restore();
}
/** The jersey's body, waist to shoulders, shaded down its right side; the pads across the top; the sleeve caps. */
function jersey(c, k, waist, sh, lean = 0) {
  c.fillStyle = k.jersey;
  c.beginPath(); c.moveTo(-.31, waist); c.lineTo(.31, waist); c.lineTo(.45 + lean, sh - .03); c.quadraticCurveTo(lean, sh + .1, -.45 + lean, sh - .03); c.closePath(); c.fill();
  c.fillStyle = k.shade;
  c.beginPath(); c.moveTo(.13, waist); c.lineTo(.31, waist); c.lineTo(.45 + lean, sh - .03); c.quadraticCurveTo(.32 + lean, sh + .03, .2 + lean, sh + .05); c.closePath(); c.fill();
  c.fillStyle = k.hem; c.fillRect(-.31, waist, .62, .045);
  [-1, 1].forEach(s => oval(c, s * .41 + lean, sh - .05, .13, .1, s < 0 ? k.cap : k.capShade));
}
function pantsSeat(c, k, waist, low) {
  c.fillStyle = k.pants;
  c.beginPath(); c.moveTo(-.32, waist + .02); c.lineTo(.32, waist + .02); c.quadraticCurveTo(.37, low + .04, .19, low); c.lineTo(-.19, low); c.quadraticCurveTo(-.37, low + .04, -.32, waist + .02); c.fill();
  c.fillStyle = 'rgba(0,0,0,.1)';
  c.beginPath(); c.moveTo(.06, waist + .02); c.lineTo(.32, waist + .02); c.quadraticCurveTo(.37, low + .04, .19, low); c.lineTo(.06, low); c.fill();
}
/** An arm: the white sleeve, the bare arm, the glove. */
function arm(c, k, skin, s, sp, el, hd) {
  limb(c, sp, el, .19, skin); limb(c, el, hd, .16, skin);
  limb(c, sp, mixP(sp, el, .42), .22, s < 0 ? k.cap : k.capShade);
  oval(c, hd[0], hd[1], .09, .085, k.glove);
}
/** Legs: thighs in the pants down past the knee, socks to the cleats, a stripe down the outside. */
function legs(c, k, hip, kx, ky, fx) {
  [-1, 1].forEach(s => {
    const hj = [s * .16, hip - .04], kn = [s * kx, ky], an = [s * fx, .13];
    limb(c, kn, an, .18, k.sock);
    oval(c, s * fx, .06, .12, .072, k.cleat);
    limb(c, hj, kn, .27, s < 0 ? k.pants : k.pantsShade);
    limb(c, kn, mixP(kn, an, .22), .22, s < 0 ? k.pants : k.pantsShade);
    limb(c, [s * .28, hip - .02], [s * (kx + .1), ky + .08], .035, k.stripe);
  });
}
function helmetBack(c, k, x, y) {
  oval(c, x, y, .2, .205, k.helmet);
  c.save(); c.beginPath(); c.ellipse(x, y, .2, .205, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x + .07, y - .25, .2, .5);
  c.fillStyle = k.helmetStripe; c.fillRect(x - .045, y - .25, .09, .5);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - .25, y - .22, .5, .06);
  c.restore();
  oval(c, x - .09, y + .08, .045, .07, 'rgba(255,255,255,.3)');
}
function helmetFront(c, k, skin, x, y) {
  oval(c, x, y, .2, .205, k.helmet);
  c.save(); c.beginPath(); c.ellipse(x, y, .2, .205, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(x + .08, y - .25, .2, .5);
  c.fillStyle = k.helmetStripe; c.fillRect(x - .035, y + .07, .07, .2);
  c.restore();
  // the face in the helmet's shadow, behind the mask
  oval(c, x, y - .06, .12, .1, skin);
  c.fillStyle = 'rgba(0,0,0,.38)'; c.fillRect(x - .12, y - .02, .24, .05);
  c.strokeStyle = k.mask; c.lineWidth = .032;
  c.beginPath();
  c.moveTo(x - .15, y - .02); c.lineTo(x + .15, y - .02);
  c.moveTo(x - .13, y - .1); c.lineTo(x + .13, y - .1);
  c.moveTo(x, y - .02); c.lineTo(x, y - .18);
  c.moveTo(x - .15, y - .02); c.quadraticCurveTo(x - .14, y - .16, x - .05, y - .19);
  c.moveTo(x + .15, y - .02); c.quadraticCurveTo(x + .14, y - .16, x + .05, y - .19);
  c.stroke();
  oval(c, x - .09, y + .09, .045, .06, 'rgba(255,255,255,.4)');
}
/** One of ours on the line, from behind: crouch 1 is set in the stance, less as the player rises to block. */
function drawBack(c, k, skin, num, crouch) {
  const hip = .98 - .36 * crouch, sh = hip + .74 - .4 * crouch, head = sh + .19 + .07 * (1 - crouch), waist = hip + .1;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // the arms reach ahead: behind the body, but for the elbows out at the sides
  [-1, 1].forEach(s => arm(c, k, skin, s, [s * .38, sh - .06], [s * (.58 - .05 * crouch), sh - .3 + .12 * (1 - crouch)], [s * .3, sh - .42 + .2 * (1 - crouch)]));
  legs(c, k, hip, .31 + .07 * crouch, .5 - .12 * crouch, .3 + .05 * crouch);
  pantsSeat(c, k, waist, hip - .2);
  jersey(c, k, waist - .02, sh);
  numberAt(c, k, num, 0, (waist + sh) / 2, Math.min(.4, (sh - waist) * .6));
  if (head - sh > .21) limb(c, [0, sh], [0, head - .1], .14, skin);
  helmetBack(c, k, 0, head);
}
/** One of the rush, from the front: crouched in the stance, hands down; up with arms high (arms 0-1) as it's kicked. */
function drawFront(c, k, skin, num, crouch, arms) {
  const hip = .98 - .36 * crouch, sh = hip + .72 - .38 * crouch, head = sh + .19 + .07 * (1 - crouch), waist = hip + .1;
  c.lineCap = 'round'; c.lineJoin = 'round';
  legs(c, k, hip, .3 + .08 * crouch, .5 - .1 * crouch, .28 + .05 * crouch);
  pantsSeat(c, k, waist, hip - .18);
  jersey(c, k, waist - .02, sh);
  numberAt(c, k, num, 0, (waist + sh) / 2 + .02, Math.min(.4, (sh - waist) * .6));
  if (head - sh > .21) limb(c, [0, sh], [0, head - .1], .14, skin);
  helmetFront(c, k, skin, 0, head);
  [-1, 1].forEach(s => arm(c, k, skin, s, [s * .4, sh - .06], mixP([s * .5, sh - .32], [s * .56, sh + .32], arms), mixP([s * .3, Math.max(.1, sh - .68)], [s * .44, sh + .74], arms)));
}
function drawLine(st, c, side, f, sec) {
  if (spritesReady()) { drawLineArt(st, c, side === 'us', f, sec); return; } // (the drawn players below till the pictures load)
  const us = side === 'us', k = KIT[side], t = f ? f.t : 0;
  // the rush leaps as the ball's kicked, pushing in a little, and comes back down; the blockers rise out of their stance
  const arms = f && !us ? Math.min(1, t / .15) : 0, jump = f && !us ? Math.max(0, Math.sin(Math.min(1, t / .8) * Math.PI)) : 0;
  const crouch = us ? (f ? Math.max(.45, 1 - t * 2) : 1) : 1 - arms * .8, surge = f && !us ? Math.min(1, t / .5) * .35 : 0;
  (us ? US : THEM).map(([x, num, back = 0]) => ({x, num, z: K.LINE.z + (us ? -.5 - back : .6 - surge)})).sort((a, b) => b.z - a.z).forEach(p => {
    const b = proj(st, p.x, 0, p.z);
    if (b.s <= 0 || b.x < -b.s || b.x > st.W + b.s) return;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(b.x, b.y, .55 * b.s, .13 * b.s, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(b.x, b.y - jump * .5 * b.s); c.scale(b.s, -b.s);
    if (us) drawBack(c, k, skinOf(p.num), p.num, crouch); else drawFront(c, k, skinOf(p.num), p.num, crouch, arms);
    c.restore();
  });
}
// ---------------------------------------------------------------- The kicker, the holder, the line and the ball (sprites)
// Pictures in img/kick/ (built by tools/kick/sprites.py, preloaded once), seen from behind like the camera, but for the
// rush: the holder kneels at the ball's right, a hand on it (the ball in the picture is the ball on the spot; once it's
// kicked, the same holder with the hand empty); the kicker waits back and to the left (a right-footed kicker's
// approach) winding up, steps in as it's kicked, plants beside the ball and follows through, the kicking leg high, till
// the next kick is set; the line (line.webp, a pose
// from LINE_ART for each player, by how long since the kick); the ball in the air, tumbling end over end. Each is placed
// by its anchor (in the picture's pixels: the ball's tip, the kicker's planted foot, a lineman's feet) at a spot in the
// world, px a yard (yd) its scale; never stretched.
const SPRITES = {
  holder: {src: 'holder', ax: 25.5, ay: 264.5, yd: 249.4},
  empty: {src: 'holder-empty', ax: 25.5, ay: 264.5, yd: 249.4},
  kicker: {src: 'kicker', ax: 366.6, ay: 468.6, yd: 246.5},
  follow: {src: 'kicker-follow', ax: 234.6, ay: 479.5, yd: 246.5},
  line: {src: 'line', yd: 88},
  ball: {src: 'football', ax: 100, ay: 55, yd: 200 / .38}
};
// The line's poses in line.webp, [x, y, w, h, ax, ay] px. 0-7 ours, from behind: 0, 3 and 7 set, 1 rising, 2 and 6 hands
// up, 4 and 5 stepping into a block. 8-15 the rush, from the front: 8 and 12 set, 9 and 10 charging, 11 hands up, 13 and
// 14 leaping with their arms up, 15 landed, arms still up.
const LINE_ART = [[4, 4, 127, 122, 63.3, 122], [135, 4, 131, 154, 64.7, 153.5], [270, 4, 128, 156, 63.5, 155], [402, 4, 129, 122, 65.7, 121.5],
  [4, 164, 156, 147, 84.1, 146.5], [164, 164, 138, 142, 63.1, 141], [306, 164, 130, 146, 66.1, 145.5], [440, 164, 116, 121, 58.8, 120.5],
  [4, 315, 134, 115, 65.8, 114.5], [142, 315, 118, 139, 58, 138.5], [264, 315, 110, 140, 59.2, 139], [378, 315, 116, 135, 57.3, 134.5],
  [4, 459, 126, 110, 62.3, 110], [134, 459, 76, 154, 38.4, 154], [214, 459, 78, 142, 38.9, 141.5], [296, 459, 104, 124, 51.4, 123]];
let SPRITES_LOADING = null;
function loadSprites() {
  if (!SPRITES_LOADING) {
    SPRITES_LOADING = Promise.all(Object.values(SPRITES).map(sp => {
      const im = new Image();
      im.decoding = 'async';
      im.src = new URL(`../../img/kick/${sp.src}.webp`, import.meta.url).href;
      sp.im = im;
      return (im.decode ? im.decode() : new Promise((ok, no) => { im.onload = ok; im.onerror = no; })).catch(() => {});
    }));
  }
  return SPRITES_LOADING;
}
const spritesReady = () => Object.values(SPRITES).every(sp => sp.im && sp.im.complete && sp.im.naturalWidth > 0);
/** A sprite with its anchor at world (x, y, z); rot turns it about the anchor, sx and sy stretch it from there. */
function drawSprite(st, c, sp, x, y, z, rot = 0, sx = 1, sy = 1) {
  const b = proj(st, x, y, z), k = b.s / sp.yd;
  c.save();
  c.translate(b.x, b.y);
  if (rot) c.rotate(rot);
  if (sx !== 1 || sy !== 1) c.scale(sx, sy);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(sp.im, -sp.ax * k, -sp.ay * k, sp.im.naturalWidth * k, sp.im.naturalHeight * k);
  c.restore();
}
function shadowAt(st, c, x, z, w) {
  const b = proj(st, x, 0, z);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(b.x, b.y, w * b.s, w * .2 * b.s, 0, 0, Math.PI * 2); c.fill();
}
// Two pictures each for the kicker and the holder would hold still between them; drawn with a body's give they move.
// Waiting, the kicker rocks on his feet and breathes, the holder too; the kick drives the kicker down into his plant
// (squashed) and up through it (stretched) and he hops forward off it, leaning away with the swing, then settles;
// the holder flinches as the ball leaves his hand. None of it with reduced motion. (t: seconds; the kick's pose.)
const spring = (k, w = 14, d = 6) => Math.exp(-d * k) * Math.cos(w * k); // 1 at the kick, ringing down to 0
function kickerGive(pose, t) {
  if (ui.RM) return {lift: 0, rot: 0, sx: 1, sy: 1};
  if (!pose || pose.t < KICKER.through) {
    const b = Math.sin(t * 2.4), r = Math.sin(t * 1.15);
    return {lift: 0, rot: .018 * r, sx: 1 - .005 * b, sy: 1 + .012 * b};
  }
  const k = pose.t - KICKER.through, s = spring(k), hop = k > .08 && k < .4 ? Math.sin((k - .08) / .32 * Math.PI) : 0;
  return {lift: .12 * hop, rot: -.045 * (1 - Math.exp(-10 * k)) * Math.exp(-1.6 * k), sx: 1 + .035 * s, sy: 1 - .06 * s};
}
function holderGive(pose, t) {
  if (ui.RM) return {rot: 0, sx: 1, sy: 1};
  if (!pose) { const b = Math.sin(t * 2.1 + 1.3); return {rot: 0, sx: 1, sy: 1 + .01 * b}; }
  const s = spring(pose.t, 18, 7);
  return {rot: .03 * s, sx: 1 - .02 * s, sy: 1 + .03 * s};
}
const HOLD = {z: .02};
function drawHolder(st, c, held, pose, t) {
  const v = holderGive(pose, t);
  shadowAt(st, c, .62, HOLD.z, .62);
  drawSprite(st, c, held ? SPRITES.holder : SPRITES.empty, 0, 0, HOLD.z, v.rot, v.sx, v.sy);
}
// Where the kicker's planted foot is: waiting back and to the left, then (as it's kicked, over `step` seconds) in
// beside the ball; through it from `through` on (the follow-through picture).
const KICKER = {wait: {x: -1.1, z: -.85}, plant: {x: -.42, z: -.06}, step: .09, through: .07};
function kickerAt(pose) {
  const u = pose ? Math.min(1, pose.t / KICKER.step) : 0, e = 1 - (1 - u) * (1 - u), {wait: a, plant: b} = KICKER;
  return {x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e, e};
}
function drawKicker(st, c, pose, t) {
  const k = kickerAt(pose), through = !!pose && pose.t >= KICKER.through, v = kickerGive(pose, t);
  shadowAt(st, c, k.x + (through ? .12 : .3), k.z, .55 * (1 - 1.5 * v.lift));
  drawSprite(st, c, through ? SPRITES.follow : SPRITES.kicker, k.x, v.lift, k.z, (through ? 0 : -.06 * k.e) + v.rot, v.sx, v.sy);
}
// A player's pose (LINE_ART): ours set in their stance (a wing in a two-point stance), up out of it at the kick, then
// blocking (hands up, or stepping in); the rush set, charging off the ball, leaping with their arms up, landing.
function poseOf(us, i, f, wing) {
  const t = f ? f.t : 0;
  if (us) return !f ? (wing ? 7 : [0, 3, 0, 7, 3][i % 5]) : t < .12 ? 1 : [2, 4, 6, 5][i % 4];
  return !f ? (i % 3 === 1 ? 12 : 8) : t < .14 ? (i % 2 ? 10 : 9) : t < .8 ? (i % 2 ? 14 : 13) : (i % 2 ? 11 : 15);
}
/** A lineman's give (sec: seconds; i: which of them): set, he breathes; ours strain in their blocks; the rush, landed,
 *  heave for breath. None with reduced motion. */
function lineGive(us, i, f, sec) {
  if (ui.RM) return {rot: 0, sy: 1};
  const t = f ? f.t : 0, ph = sec + i * 1.7;
  if (us && f && t >= .12) return {rot: .03 * Math.sin(ph * 7), sy: 1 + .012 * Math.sin(ph * 12)};
  if (!us && f && t >= .8) return {rot: 0, sy: 1 + .02 * Math.sin(ph * 4)};
  return {rot: 0, sy: f ? 1 : 1 + .01 * Math.sin(ph * 2.3)};
}
function drawLineArt(st, c, us, f, sec = 0) {
  const t = f ? f.t : 0, sp = SPRITES.line;
  const leap = f && !us && t >= .14 && t < .8 ? Math.sin((t - .14) / .66 * Math.PI) * .45 : 0, surge = f && !us ? Math.min(1, t / .5) * .35 : 0;
  // (spread a little wider than the drawn players: the pictures are broader)
  (us ? US : THEM).map(([x, num, back = 0], i) => ({x: x * 1.18, i, wing: !!back, z: K.LINE.z + (us ? -.5 - back : .6 - surge)})).sort((a, b) => b.z - a.z).forEach(p => {
    const b = proj(st, p.x, 0, p.z), fr = LINE_ART[poseOf(us, p.i, f, p.wing)], k = b.s / sp.yd;
    if (b.s <= 0 || b.x < -b.s * 1.5 || b.x > st.W + b.s * 1.5) return;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(b.x, b.y, .5 * b.s, .12 * b.s, 0, 0, Math.PI * 2); c.fill();
    c.save();
    const v = lineGive(us, p.i, f, sec);
    c.translate(b.x, b.y - leap * b.s);
    if (v.rot) c.rotate(v.rot);
    c.scale(p.i % 2 ? -1 : 1, v.sy); // every other one the other way round, so the line isn't all the same
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(sp.im, fr[0], fr[1], fr[2], fr[3], -fr[4] * k, -fr[5] * k, fr[2] * k, fr[3] * k);
    c.restore();
  });
}
/** The ball in the air: tumbling end over end (seen from behind, as long as it shows its length), never too small to follow. */
function drawFlying(st, c, b, spin) {
  const p = proj(st, b.x, b.y, b.z), sh = proj(st, b.x, 0, b.z), sp = SPRITES.ball;
  const len = Math.max(11, .38 * p.s), k = len / sp.im.naturalWidth;
  c.fillStyle = `rgba(0,0,0,${.38 * Math.max(0, 1 - b.y / 9)})`;
  c.beginPath(); c.ellipse(sh.x, sh.y, len * .38, len * .11, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 2 + .12); c.scale(Math.max(.5, Math.abs(Math.cos(spin))), 1);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(sp.im, -sp.im.naturalWidth * k / 2, -sp.im.naturalHeight * k / 2, sp.im.naturalWidth * k, sp.im.naturalHeight * k);
  c.restore();
}
// A bonk: a star where the ball hit, for a moment.
function drawBonk(st, c, f) {
  const u = f.t - f.call.tHit;
  if (!(u >= 0 && u < .45)) return;
  const q = f.call.pos(f.call.tHit), p = proj(st, q.x, q.y, q.z), r = Math.max(10, .9 * p.s) * (.6 + u * 2), a = 1 - u / .45;
  c.save(); c.translate(p.x, p.y); c.rotate(u * 3);
  c.fillStyle = `rgba(255,236,120,${a})`; c.beginPath();
  for (let k = 0; k < 16; k++) { const rr = k % 2 ? r * .45 : r; c.lineTo(Math.cos(k * Math.PI / 8) * rr, Math.sin(k * Math.PI / 8) * rr); }
  c.closePath(); c.fill(); c.restore();
}
const BALL = {len: .36, wid: .22};
function drawBall(st, c, b, spin, onTee) {
  const p = proj(st, b.x, b.y, b.z), sh = proj(st, b.x, 0, b.z);
  // never smaller than a few pixels, so a long kick can be followed all the way
  const L = Math.max(10, BALL.len * p.s), Wd = Math.max(6.5, BALL.wid * p.s);
  // the shadow on the turf, fading as it climbs
  c.fillStyle = `rgba(0,0,0,${.38 * Math.max(0, 1 - b.y / 9)})`;
  c.beginPath(); c.ellipse(sh.x, sh.y, Wd * .7, Wd * .22, 0, 0, Math.PI * 2); c.fill();
  // tumbling end over end, seen from behind: as wide as the ball always, as tall as it shows its length (held: on its
  // tip on the turf, under the holder's finger). The leather lit from the upper left, darker to its ends; the seams
  // down its length; the laces when they're on the side toward us.
  const tall = Math.max(Wd, L * Math.abs(Math.cos(spin))), long = tall > Wd * 1.25;
  c.save(); c.translate(p.x, onTee ? sh.y - L / 2 : p.y);
  const g = c.createRadialGradient(-Wd * .18, -tall * .2, Wd * .04, 0, 0, Math.max(Wd, tall) * .6);
  g.addColorStop(0, '#D2874D'); g.addColorStop(.5, '#96471D'); g.addColorStop(1, '#4C1F0A');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, Wd / 2, tall / 2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(30,10,2,.55)'; c.lineWidth = 1; c.stroke();
  const fine = L >= 13;
  if (fine) {
    c.strokeStyle = 'rgba(35,12,3,.5)'; c.lineWidth = Math.max(.7, Wd * .03);
    if (long) { c.beginPath(); c.ellipse(0, 0, Wd * .22, tall * .47, 0, 0, Math.PI * 2); c.stroke(); }
    else { c.beginPath(); c.moveTo(-Wd * .32, 0); c.lineTo(Wd * .32, 0); c.moveTo(0, -tall * .32); c.lineTo(0, tall * .32); c.stroke(); }
  }
  if (long && (onTee || Math.sin(spin) >= 0)) {
    c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(1, Wd * .07); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(0, -tall * .24); c.lineTo(0, tall * .24); c.stroke();
    const n = fine ? 7 : 5;
    c.lineWidth = Math.max(.8, Wd * .05);
    for (let i = 0; i < n; i++) { const y = -tall * .2 + tall * .4 * i / (n - 1); c.beginPath(); c.moveTo(-Wd * .11, y); c.lineTo(Wd * .11, y); c.stroke(); }
  }
  // a shine
  c.fillStyle = 'rgba(255,228,196,.32)'; c.beginPath(); c.ellipse(-Wd * .17, -tall * .17, Wd * .1, tall * .15, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}
// The ball's tracer: its whole flight so far, fading back toward the foot, so the bend in the wind shows as it flies.
function drawTrail(st, c, f) {
  const n = 40, span = f.t;
  if (span <= .02) return;
  c.lineCap = 'round';
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const q = f.call.pos(f.t - span + span * i / n), p = proj(st, q.x, q.y, q.z);
    if (prev) {
      c.strokeStyle = `rgba(255,255,255,${.5 * i / n})`;
      c.lineWidth = Math.max(1.5, .12 * p.s) * (.4 + .6 * i / n);
      c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke();
    }
    prev = p;
  }
}
function draw(st, now = performance.now()) {
  const c = st.c2;
  if (!c) return;
  c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  c.clearRect(0, 0, st.W, st.H);
  const sc = st.scene, t = now / 1000;
  drawSky(st, c, t);
  drawField(st, c, sc);
  drawTurf(st, c, sc);
  drawBeams(st, c);
  // the ball behind the posts is drawn before them, in front after
  const f = st.flight, ball = f ? f.call.pos(f.t) : {x: 0, y: .15, z: 0};
  const spin = f ? f.t * 12 : 0;
  if (f) drawTrail(st, c, f);
  // far to near: the posts, the wall, the line, the holder, the ball where it is among them; then a ghost of the posts
  // over anything that could hide them (the wall, the rush's arms), so the target always shows
  const obs = sc.obs || [], hitOb = f && f.call.hit && f.t >= f.call.tHit ? f.call.hit : null;
  const items = [{z: sc.d + .01, draw: () => drawPosts(st, c, sc, t)}]
    .concat(obs.map(o => ({z: o.z, ob: true, draw: () => drawObstacle(st, c, o, t, sc.pop == null ? 1 : sc.pop, o === hitOb ? Math.max(0, 1 - (f.t - f.call.tHit) * 2.5) : 0)})));
  // the players as the kick left them, till the next one's set up
  const pose = f || st.spent || null;
  items.push({z: K.LINE.z + .6, ob: true, draw: () => drawLine(st, c, 'them', pose, t)}, {z: K.LINE.z - .5, draw: () => drawLine(st, c, 'us', pose, t)});
  // the holder (with the ball on the spot in hand, till it's kicked) and the kicker; the ball in the air
  const held = st.ballOn !== false && !f, sprites = spritesReady();
  if (sprites) items.push({z: HOLD.z, draw: () => drawHolder(st, c, held, pose, t)}, {z: kickerAt(pose).z, draw: () => drawKicker(st, c, pose, t)});
  if (st.ballOn !== false && (f || !sprites)) items.push({z: ball.z, draw: () => (sprites ? drawFlying(st, c, ball, spin) : drawBall(st, c, ball, spin, !f))});
  items.sort((p, q) => q.z - p.z);
  const lastOb = items.map(x => !!x.ob).lastIndexOf(true);
  items.forEach((x, i) => {
    x.draw();
    if (i === lastOb) { c.save(); c.globalAlpha = .4; drawPosts(st, c, sc, t); c.restore(); }
  });
  if (f && f.call.hit) drawBonk(st, c, f);
  // the corners in shadow
  if (!st.vig || st.vig.w !== st.W || st.vig.h !== st.H) {
    const R = Math.hypot(st.W, st.H) / 2, g = c.createRadialGradient(st.W / 2, st.H * .52, R * .45, st.W / 2, st.H * .52, R * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
    st.vig = {w: st.W, h: st.H, g};
  }
  c.fillStyle = st.vig.g; c.fillRect(0, 0, st.W, st.H);
  // the flick's trail while the finger is down
  if (st.drag && st.drag.pts.length > 1) {
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); st.drag.pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.stroke();
  }
}

// ============================================================================ The guide
// A finger slides up from the ball toward the posts, with "Slide up from the ball to kick": on every kick of a first run
// (nothing finished on this phone yet) and on the first kick of every run, as soon as the ball is on the tee; on the
// others after a few idle seconds; and at once after a touch that wasn't a kick. Gone the moment a finger is down.
const GUIDE_IDLE = 5000;
const canKick = st => !st.dead && !st.busy && !st.day.done && !st.flight && !st.move && !st.drag;
let PATH_OK = null; // the finger rides the path (CSS offset-path); without it, it waits at the ball
const wallOf = k => (k.obs || []).find(o => o.t === 'wall');
/** Where to aim in the goal: its middle, or the middle of what the wall leaves open (world x). */
function openX(k) {
  const w = wallOf(k);
  if (!w) return k.gx;
  const inner = w.x - w.face * w.half; // the wall's edge in the opening (it's flush with the upright on side face)
  return (inner + k.gx - w.face * K.POST.half) / 2;
}
function placeGuide(st) {
  const g = st.el.querySelector('[data-kk-guide]'), k = kickNow(st);
  if (!g || !st.scene || !k) return;
  const ball = proj(st, 0, .15, 0), cb = proj(st, openX(k) + st.scene.gx - k.gx, K.POST.bar, st.scene.d);
  let dx = cb.x - ball.x, dy = cb.y - ball.y;
  const len = Math.hypot(dx, dy) || 1, go = Math.min(len * .8, st.H * .42);
  dx *= go / len; dy *= go / len;
  const d = `M${ball.x.toFixed(1)} ${ball.y.toFixed(1)} L${(ball.x + dx).toFixed(1)} ${(ball.y + dy).toFixed(1)}`;
  const path = g.querySelector('.kk-guide-trail'), hand = g.querySelector('.kk-guide-hand');
  path.setAttribute('d', d);
  let pl = go;
  try { pl = path.getTotalLength() || go; } catch (_) {}
  g.style.setProperty('--pl', pl.toFixed(1));
  if (PATH_OK == null) { try { PATH_OK = CSS.supports('offset-path', "path('M0 0 L1 1')"); } catch (_) { PATH_OK = false; } }
  if (PATH_OK) { hand.style.offsetPath = `path('${d}')`; hand.style.left = hand.style.top = '0px'; }
  else { hand.style.left = `${(ball.x - 17).toFixed(1)}px`; hand.style.top = `${(ball.y - 7).toFixed(1)}px`; }
  g.classList.toggle('no-path', !PATH_OK);
  const t = st.el.querySelector('[data-kk-hint-t]');
  if (t) t.textContent = wallOf(k) ? 'Aim for the open side of the goal' : 'Slide up from the ball to kick';
}
/** "Look out!": the first kick with wind, and the first with the wall in the goal, once a run each, for a few seconds
 *  (or till a finger's down). what: 'wind' | 'wall' (falsy: hide it). */
const ALERTS = {wind: ['Wind’s up!', 'The ball rides it now. Aim into the wind.'], wall: ['Look out!', 'A wall’s blocking part of the goal. Aim for the open side.']};
function alertFor(st, what) {
  const a = st.el.querySelector('[data-kk-alert]');
  if (!a) return;
  clearTimeout(st.alertT);
  const t = a.querySelector('[data-kk-alert-t]'), h = a.querySelector('b');
  if (what && t && h) { h.textContent = ALERTS[what][0]; t.textContent = ALERTS[what][1]; }
  a.hidden = !what;
  if (what) st.alertT = setTimeout(() => { a.hidden = true; }, 4500);
}
function guide(st, on) {
  const g = st.el.querySelector('[data-kk-guide]'), h = st.el.querySelector('[data-kk-hint]');
  clearTimeout(st.guideT);
  if (!g || !h) return;
  on = on && canKick(st);
  if (on) {
    placeGuide(st);
    // restart the loop from the ball
    g.classList.remove('is-on'); void g.offsetWidth; g.classList.add('is-on');
  }
  g.hidden = !on; h.hidden = !on;
}
/** The ball's on the tee: the guide now, or after a few idle seconds. */
function armGuide(st) {
  clearTimeout(st.guideT);
  if (!canKick(st)) return;
  // the first kick of the run with wind, or with the wall
  const k = kickNow(st), was = st.i ? kickAt(st, st.i - 1) : null;
  const first = k.obs.length && !(was && was.obs.length) ? 'wall' : k.w && was && !was.w ? 'wind' : null;
  if (first) alertFor(st, first);
  if (!st.day.list.length || !K.totals().played || first) guide(st, true);
  else st.guideT = setTimeout(() => guide(st, true), GUIDE_IDLE);
}

// ============================================================================ Play
const callWords = call => (call.made ? K.CALLS.good : call.why === 'short' ? 'Short' : K.CALLS[call.why]);
function setScene(st, k) { st.scene = {d: k.d, gx: k.gx, w: k.w, dir: k.dir, obs: k.obs || [], pop: 1}; }
function patchHud(st) {
  const h = st.el.querySelector('[data-kk-hud]');
  if (h) h.innerHTML = hudHTML(st);
  patchGusts(st);
  const cv = st.cv, k = kickNow(st);
  const w = k && wallOf(k), inWay = w ? ` A brick wall across ${w.share === .5 ? 'half' : 'a quarter'} of the goal, on the ${w.face < 0 ? 'left' : 'right'}.` : '';
  if (cv && k) cv.setAttribute('aria-label', `Kick ${st.i + 1}: ${k.d} yards, the posts ${k.gx > 1 ? `${Math.round(k.gx)} yards to the right` : k.gx < -1 ? `${Math.round(-k.gx)} yards to the left` : 'straight ahead'}. ${windWords(k)}.${inWay}`);
}
function loop(st) {
  if (st.raf) return;
  const step = now => {
    st.raf = 0;
    if (st.dead) return;
    let more = false;
    if (st.flight) {
      const f = st.flight;
      f.t = Math.max(0, Math.min(f.call.tEnd, (now - f.t0) / 1000)); // a frame stamped before the kick is at 0
      const callAt = f.call.tCross != null ? f.call.tCross : f.call.tHit;
      if (!f.called && callAt != null && f.t >= callAt) { f.called = true; showCall(st, f.call, f.wind); }
      // down: the ball's gone until the next one's on the tee
      if (f.t >= f.call.tEnd) { if (!f.called) { f.called = true; showCall(st, f.call, f.wind); } st.flight = null; st.spent = f; st.ballOn = false; settle(st, f.call); }
      else more = true;
    }
    if (st.move) {
      const m = st.move, p = Math.min(1, (now - m.t0) / m.ms), e = 1 - Math.pow(1 - p, 3);
      // the new kick's things pop up once the posts have nearly arrived
      const pp = Math.max(0, Math.min(1, (p - .45) / .55)), pop = pp >= 1 ? 1 : 1 + 2.2 * Math.pow(pp - 1, 3) + 1.2 * Math.pow(pp - 1, 2);
      st.scene = {d: m.a.d + (m.b.d - m.a.d) * e, gx: m.a.gx + (m.b.gx - m.a.gx) * e, w: m.b.w, dir: m.b.dir, obs: m.b.obs, pop: Math.max(0, pop)};
      if (p >= 1) { st.move = null; armGuide(st); } else more = true;
    }
    if (st.drag) more = true;
    draw(st, now);
    if (more) st.raf = requestAnimationFrame(step);
  };
  st.raf = requestAnimationFrame(step);
}
/** Between kicks, a frame now and then (about 14 a second) so the flags flap, the stars twinkle and the crowd's phones
 *  flash; not while the field is off the screen, and not at all with reduced motion. */
function idle(st) {
  if (st.dead || st.raf || ui.RM || !st.cv) return;
  const r = st.cv.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
  draw(st);
}
const WIND_SAYS = {took: 'The wind took it', carried: 'The wind carried it through'};
function showCall(st, call, wind) {
  const el = st.el.querySelector('[data-kk-call]');
  if (!el) return;
  // the line under it: what stopped it, or what the wind did
  const note = call.hit ? call.hit.says || (K.OBSTACLES[call.hit.t] || {}).says : wind ? WIND_SAYS[wind] : '';
  el.innerHTML = `<span>${esc(callWords(call))}</span>${note ? `<span class="kk-call-w">${esc(note)}</span>` : ''}`;
  el.className = `kk-call is-in ${call.made ? 'is-good' : 'is-miss'}${note ? ' has-w' : ''}`;
  if (call.made) st.cheer = performance.now() + 2600; // the crowd's phones go off
  // the 5th, 10th, 15th... make on the owner's profile: Keepfall's Gold (coinBurst does nothing on anyone else's);
  // not when a run from another of his phones already counts today (this one pays nothing: only the first run pays)
  const pays = call.made && K.goldMake((st.after || st.day).made) && keepShows(st) && !otherRunCounts(st) && coinBurst(st);
  ui.haptic(call.made ? (pays ? 'celebrate' : 'success') : 'error');
}
function settle(st, call) {
  // saved when it was kicked (onUp); shown now it's down
  if (st.after) { st.day = st.after; st.after = null; }
  st.timers.push(setTimeout(() => {
    if (st.dead) return;
    const el = st.el.querySelector('[data-kk-call]');
    if (el) el.className = 'kk-call';
    if (st.day.done) { finish(st); return; }
    // the next kick: the posts move to their new spot, the ball back on the tee
    const from = st.scene;
    st.i = st.day.next;
    const k = kickNow(st);
    st.move = {a: from, b: {d: k.d, gx: k.gx, w: k.w, dir: k.dir, obs: k.obs || []}, t0: performance.now(), ms: ui.RM ? 1 : (k.obs && k.obs.length ? 900 : 650)};
    st.ballOn = true;
    st.spent = null;
    st.busy = false;
    patchHud(st);
    loop(st);
  }, 1250));
  patchHud(st);
}
function finish(st) {
  st.busy = true;
  guide(st, false);
  setMode(st);
  fitScreen(st);
  patchHud(st);
  const over = st.el.querySelector('[data-kk-over]');
  if (over) {
    over.innerHTML = overHTML(st);
    over.hidden = false;
    if (!ui.RM) ui.animate(over.firstElementChild, [{opacity: 0, transform: 'scale(.94)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
  }
  K.autoPost();
  patchBoard(st);
}
/** A swipe: from the ball, up the screen. Its line aims; its speed over the last few frames is the leg. Its shape
 *  doesn't matter: the ball flies straight and rides the wind. */
function onDown(st, e) {
  if (st.busy || st.day.done || st.flight || st.move || !e.isPrimary) return;
  const r = st.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  st.drag = {id: e.pointerId, x0: x, y0: y, pts: [{x, y, t: performance.now()}]};
  try { st.pad.setPointerCapture(e.pointerId); } catch (_) {}
  guide(st, false);
  alertFor(st, null);
  loop(st);
}
function onMove(st, e) {
  const g = st.drag;
  if (!g || e.pointerId !== g.id) return;
  const r = st.cv.getBoundingClientRect();
  g.pts.push({x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now()});
  if (g.pts.length > 400) g.pts.splice(1, 1); // (the swipe as drawn while the finger's down)
}
function onUp(st, e) {
  const g = st.drag;
  if (!g || e.pointerId !== g.id) return;
  st.drag = null;
  const r = st.cv.getBoundingClientRect(), now = performance.now();
  const end = {x: e.clientX - r.left, y: e.clientY - r.top, t: now};
  g.pts.push(end);
  const recent = g.pts.filter(q => now - q.t < 90), a = recent.length > 1 ? recent[0] : g.pts[0];
  const dt = Math.max(8, end.t - a.t), speed = Math.hypot(end.x - a.x, end.y - a.y) / dt;
  const k = kickNow(st), dx = end.x - g.x0, dy = end.y - g.y0;
  // where the flick points at the posts: its line from the ball, at the crossbar's height on screen
  let aim;
  const ball = proj(st, 0, .15, 0), cb = proj(st, k.gx, K.POST.bar, k.d);
  if (dy < 0 && cb.y < ball.y) aim = ((ball.x + dx * (cb.y - ball.y) / dy - st.W / 2) * (k.d + st.back) / st.f) / k.d;
  const launch = e.type === 'pointercancel' ? null : K.launchOf({dx, dy, speed, aim});
  if (!launch) { draw(st); guide(st, true); return; }
  const call = K.fly(k, launch);
  // saved the moment it's kicked, so leaving (or reloading) with the ball in the air doesn't take it back
  st.after = K.record(st.n, st.i, call) || K.dayState(st.n);
  st.busy = true;
  st.flight = {call, t0: now, t: 0, called: false, wind: K.windCall(k, launch, call)};
  loop(st);
}

/** Playing (the field is the screen, nothing under it) or finished (the scoreboard below). */
function setMode(st) {
  const box = st.el.querySelector('[data-kk]');
  if (box) box.classList.toggle('is-playing', !st.day.done);
}
/** While a run is on: scroll so the field sits just under the nav bar and fills the screen to the tab bar (a spacer under
 *  it makes the room to scroll that far). */
function fitScreen(st, smooth) {
  const scr = st.ctx && st.ctx.screen, stage = st.el.querySelector('[data-kk-stage]'), fill = st.el.querySelector('[data-kk-fill]');
  if (!scr || !stage || !fill || st.dead) return;
  fill.style.height = '0px';
  if (st.day.done || !st.ctx.visible || !stage.offsetHeight) return;
  const nav = scr.querySelector(':scope > .nav'), navB = nav ? nav.getBoundingClientRect().bottom : scr.getBoundingClientRect().top;
  const target = Math.max(0, Math.round(scr.scrollTop + stage.getBoundingClientRect().top - navB - 8));
  const max = scr.scrollHeight - scr.clientHeight;
  if (target > max) fill.style.height = `${Math.ceil(target - max)}px`;
  if (Math.abs(scr.scrollTop - target) > 2) scr.scrollTo({top: target, behavior: smooth && !ui.RM ? 'smooth' : 'auto'});
}
/** The owner's Test play (views/testplay.js): today's kicks fresh in the sandbox (never posted, never counted), or back
 *  to the real run as it was. Not while a kick is in the air. */
function testPlay(st, on) {
  if (st.flight || st.drag || !canTest()) return;
  K.setTest(on, st.n);
  st.timers.forEach(clearTimeout); st.timers = [];
  clearBurst(st);
  guide(st, false); // (a finished day's card has no guide under it: armGuide below only shows one)
  st.move = null; st.after = null;
  setDay(st, st.n);
  st.busy = st.day.done;
  const over = st.el.querySelector('[data-kk-over]'), call = st.el.querySelector('[data-kk-call]'), tp = st.el.querySelector('[data-kk-tp]');
  if (over) { over.hidden = !st.day.done; over.innerHTML = st.day.done ? overHTML(st) : ''; }
  if (call) call.className = 'kk-call';
  if (tp) { tp.innerHTML = testRowHTML(K.testing(), 'data-kk-test'); ui.hydrate(tp); }
  setMode(st);
  patchHud(st);
  patchBoard(st);
  draw(st);
  armGuide(st);
  ui.haptic('medium');
  fitScreen(st, true);
  ui.announce(on ? 'Test play: today’s kicks, fresh. It won’t count.' : 'Test play over: back to your real run.');
}

// ============================================================================ Board
function patchBoard(st) {
  const body = st.el.querySelector('[data-kk-sbody]');
  if (body) body.innerHTML = boardBodyHTML(st);
}
function setDay(st, n) {
  st.n = n;
  st.day = K.dayState(n);
  st.i = Math.min(st.day.next, K.MAX_KICKS - 1);
  // a finished run shows the last kick's spot; one under way, the next
  setScene(st, kickAt(st, st.day.done ? Math.max(0, st.day.list.length - 1) : st.i));
  st.ballOn = !st.day.done;
  st.spent = null;
}

// ============================================================================ Lifecycle
export function render(ctx) {
  const st = ST.get(ctx);
  if (st) return bodyHTML(st);
  const tmp = {sbMode: 'today'};
  setDay(tmp, K.todayNumber());
  return bodyHTML(tmp);
}
export function mount(el, ctx) {
  ensureCss();
  const st = {el, ctx, sbMode: 'today', timers: [], dead: false, busy: false, flight: null, move: null, drag: null, raf: 0};
  setDay(st, K.todayNumber());
  ST.set(ctx, st);
  el.innerHTML = bodyHTML(st);
  ui.hydrate(el);
  st.cv = el.querySelector('[data-kk-cv]');
  st.c2 = st.cv.getContext('2d');
  st.pad = el.querySelector('[data-kk-pad]');
  size(st);
  patchHud(st);
  draw(st);
  if (st.day.done) st.busy = true;
  st.onDown = e => onDown(st, e);
  st.onMove = e => onMove(st, e);
  st.onUp = e => onUp(st, e);
  st.pad.addEventListener('pointerdown', st.onDown);
  st.pad.addEventListener('pointermove', st.onMove);
  st.pad.addEventListener('pointerup', st.onUp);
  st.pad.addEventListener('pointercancel', st.onUp);
  st.onChange = e => {
    if (!e.detail || e.detail.name !== 'kk-sb') return;
    e.stopPropagation();
    const m = e.detail.value;
    if (!SB_MODES.some(x => x.id === m) || m === st.sbMode) return;
    st.sbMode = m;
    const seg = el.querySelector('.kk-board .c-board-seg');
    if (seg) ui.setSeg(seg, m, {animate: true});
    patchBoard(st);
  };
  el.addEventListener('ui:change', st.onChange);
  st.onClick = e => {
    const tp = e.target.closest('[data-kk-test]');
    if (tp) { testPlay(st, tp.dataset.kkTest === 'on'); return; }
    if (e.target.closest('[data-kk-sb]')) { const b = st.el.querySelector('[data-kk-board]'); if (b) b.scrollIntoView({block: 'start', behavior: ui.RM ? 'auto' : 'smooth'}); }
  };
  el.addEventListener('click', st.onClick);
  st.onResize = () => { if (!st.dead) { size(st); draw(st); placeGuide(st); fitScreen(st); } };
  addEventListener('resize', st.onResize, {passive: true});
  st.unsub = daily.subscribe(type => {
    if (type === 'lb' || type === 'ready' || type === 'error') patchBoard(st);
    // the owner's card says what the run that counts pays: it may have come in from another of his phones
    if (type === 'lb' && features.available()) patchKeep(st);
  });
  // Keepfall's Gold is the owner's alone: a profile change (here or in another tab) puts it on or takes it off
  st.unme = data.subscribe(type => { if (type === 'me') patchKeep(st); });
  st.stopTick = ctx.timer(() => tick(st), 20000);
  st.stopLife = ctx.timer(() => idle(st), 70);
  K.autoPost();
  armGuide(st);
  loadSprites().then(() => { if (!st.dead) draw(st); });
  // laid out: the field fills the screen while a run is on
  requestAnimationFrame(() => { if (!st.dead) { size(st); draw(st); placeGuide(st); fitScreen(st, true); } });
}
/** Midnight: the new day's kicks (unless a kick is in the air). */
function tick(st) {
  if (st.dead || st.flight) return;
  const n = K.todayNumber();
  if (n === st.n) {
    if (st.day.done) { const t = st.el.querySelector('.kk-over-t span'); if (t) t.textContent = `New kicks in ${ui.untilText(msToMidnight())}`; }
    return;
  }
  setDay(st, n);
  st.busy = st.day.done;
  armGuide(st);
  setMode(st);
  fitScreen(st);
  st.el.querySelector('[data-kk-over]').hidden = !st.day.done;
  patchHud(st);
  patchBoard(st);
  draw(st);
}
export function params(el, ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  // shown again: its size may have changed while hidden
  requestAnimationFrame(() => { if (!st.dead) { size(st); draw(st); placeGuide(st); fitScreen(st, true); } });
  tick(st);
  patchBoard(st);
}
export function unmount(el, ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  st.dead = true;
  st.timers.forEach(clearTimeout);
  clearTimeout(st.guideT);
  clearTimeout(st.alertT);
  if (st.raf) cancelAnimationFrame(st.raf);
  if (st.pad) {
    st.pad.removeEventListener('pointerdown', st.onDown);
    st.pad.removeEventListener('pointermove', st.onMove);
    st.pad.removeEventListener('pointerup', st.onUp);
    st.pad.removeEventListener('pointercancel', st.onUp);
  }
  el.removeEventListener('ui:change', st.onChange);
  el.removeEventListener('click', st.onClick);
  removeEventListener('resize', st.onResize);
  if (st.unsub) st.unsub();
  if (st.unme) st.unme();
  if (st.stopTick) st.stopTick();
  if (st.stopLife) st.stopLife();
  // (iOS frees a canvas's memory late, and caps the total: the stage and its cached layers go now)
  [st.cv, st.bg && st.bg.cv, st.tex && st.tex.cv, st.fl && st.fl.cv].forEach(cv => { if (cv) cv.width = cv.height = 0; });
  st.bg = st.tex = st.fl = null;
  ST.delete(ctx);
}
