// Kick It: the Daily Games' fourth game (a pane of views/puzzles.js; route /puzzles/kick), after Paper Toss. The field
// from behind the tee, at night under the lights; the posts stand somewhere new for every kick (distance and angle), the
// flags on the uprights and the wind arrow show the wind. Flick the ball at the posts: the flick's direction aims and
// its speed is the leg; the wind carries the ball in the air. "It's good!", or wide, short, off the bar or off an
// upright; the third miss ends the day's run. Then the run's numbers and the league's scoreboard (Today / Week).
// The physics, the day's kicks, memory and the board are core/kick.js; this draws (one canvas) and takes the flick.
// For now only on the owner's phones (puzzles.js gamesFor). A finger on the field shows how to kick (the guide), and
// three steps under it say it.
// Exports: render(ctx), mount(el, ctx, {anchor}), params(el, ctx), unmount(el, ctx). Owner: KICK.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as K from '../core/kick.js';
import {msToMidnight} from './board.js';

const esc = data.esc;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ST = new WeakMap(); // ctx -> pane state

// The stylesheet's mark (--kk-css on :root): a home-screen app open across an update adds the current file.
const CSS_V = '6';
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
// The wind's strength on the HUD: a breeze (orange), 10 mph and up (amber), 18 and up (red).
const windTier = k => (!k.w ? ' is-calm' : k.w >= 18 ? ' is-strong' : k.w >= 10 ? ' is-breezy' : '');
// Gusts: streaks blowing across the field the wind's way, more and faster the stronger it is (CSS animates them; the
// box is turned to the wind's heading, like the arrow: 0 toward the posts, up the screen).
function gustsHTML(k) {
  if (!k || !k.w) return '';
  const n = Math.min(24, Math.max(4, Math.round(k.w * .95)));
  return Array.from({length: n}, (_, j) => `<i style="left:${((j * 61.8 + 7) % 100).toFixed(1)}%;--gl:${28 + (j * 17) % 40}px;--gk:${(-((j * .377) % 1)).toFixed(3)}"></i>`).join('');
}
function patchGusts(st) {
  const g = st.el.querySelector('[data-kk-gusts]'), k = st.kicks[st.i];
  if (!g || !k) return;
  const sig = `${k.w}@${k.dir}`;
  if (g.dataset.sig === sig) return;
  g.dataset.sig = sig;
  g.style.setProperty('--wd', `${k.dir}deg`);
  g.style.setProperty('--gs', `${Math.max(.55, 3 - k.w * .1).toFixed(2)}s`);
  g.style.setProperty('--go', Math.min(.7, .24 + k.w * .02).toFixed(3));
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
  const k = st.kicks[st.i] || st.kicks[st.kicks.length - 1], day = st.day;
  return `<div class="kk-hud-l"><span class="kk-kno">${esc(`Kick ${Math.min(st.i + 1, K.MAX_KICKS)}`)}</span><b class="kk-dist">${k.d}<small> yds</small></b></div>`
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
    + (K.canReplay() ? ui.button({label: 'Play again', kind: 'primary', icon: 'play-fill', cls: 'kk-again', attrs: {'data-kk-again': ''}}) : '')
    + ui.button({label: 'See the scoreboard', kind: K.canReplay() ? 'secondary' : 'primary', icon: 'trophy', cls: 'kk-sb-go', attrs: {'data-kk-sb': ''}})
    + `<p class="kk-over-t">${ui.icon('clock', {size: 14})}<span>${esc(`New kicks in ${ui.untilText(msToMidnight())}`)}</span></p></div>`;
}
// Unlimited tries (core/kick.js canReplay: the owner, to test it): "Start over" on the field while a run is on.
const redoHTML = st => (K.canReplay() && !st.day.done ? `<button type="button" class="kk-redo" data-kk-again>Start over</button>` : '');
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
    + `<span data-kk-redo>${redoHTML(st)}</span>`
    + `<div class="kk-over" data-kk-over${st.day.done ? '' : ' hidden'}>${st.day.done ? overHTML(st) : ''}</div></div>`
    + `<div class="kk-fill" data-kk-fill aria-hidden="true"></div>`
    + `<div class="kk-board-w" data-kk-board>${boardHTML(st)}</div></div>`;
}

// ============================================================================ The scene
// The world in yards (core/kick.js): x across, y up, z downfield from the tee; the camera K.CAM.back behind the tee
// and st.camH up (K.CAM.h, higher on a tall stage). The posts stand at the middle of the field: a kick from off to the
// side has the field off to the side.
const FIELD = {half: 26.67, hash: 3.083};
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
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.height = H + 'px';
  st.W = W; st.H = H; st.dpr = dpr;
  placeGusts(st);
  st.f = W * 1.05;
  // The horizon about 38% of the way down, the tee's ball 64 px off the bottom: on a taller stage the camera rises a
  // little (looking down on more of the field) rather than showing more sky.
  st.camH = Math.max(K.CAM.h, Math.min(4.6, (H * .62 - 64) * K.CAM.back / st.f + .15));
  st.y0 = H - 64 - st.f * (st.camH - .15) / K.CAM.back;
}
function proj(st, x, y, z) {
  const Z = Math.max(.25, z + K.CAM.back);
  return {x: st.W / 2 + st.f * x / Z, y: st.y0 + st.f * (st.camH - y) / Z, s: st.f / Z};
}
function quad(c, a, b, d, e) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); }
// The sky and the stands don't move: drawn once per size into their own canvas, then copied in each frame.
function backdrop(st) {
  const {W, H, y0, dpr} = st;
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round((y0 + 2) * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, y0);
  g.addColorStop(0, '#03060F'); g.addColorStop(.55, '#0A1430'); g.addColorStop(1, '#16275A');
  c.fillStyle = g; c.fillRect(0, 0, W, y0 + 2);
  // the stands: an upper and a lower deck, the crowd a speckle of shirts and phone lights
  const sTop = y0 - Math.max(40, H * .12), mid = sTop + (y0 - sTop) * .45;
  const sg = c.createLinearGradient(0, sTop, 0, y0);
  sg.addColorStop(0, '#0B1330'); sg.addColorStop(1, '#070C1C');
  c.fillStyle = sg; c.fillRect(0, sTop, W, y0 - sTop + 1);
  c.fillStyle = 'rgba(150,180,255,.32)'; c.fillRect(0, sTop, W, 1.5);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, mid - 2, W, 4);
  c.fillStyle = 'rgba(150,180,255,.16)'; c.fillRect(0, mid + 2, W, 1);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const COLS = ['rgba(200,210,235,.20)', 'rgba(200,210,235,.14)', 'rgba(255,90,78,.30)', 'rgba(62,240,143,.22)', 'rgba(120,200,255,.28)', 'rgba(255,214,120,.30)'];
  for (let i = 0, n = Math.round(W * (y0 - sTop) / 22); i < n; i++) {
    const py = sTop + 3 + r() * (y0 - sTop - 10);
    c.fillStyle = COLS[Math.floor(r() * COLS.length)];
    c.fillRect(r() * W, py, 1.6, 1.6);
  }
  for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(r() * W, sTop + 3 + r() * (y0 - sTop - 10), 1.2, 1.2); }
  // the ribbon boards along the front of the lower deck
  const rb = c.createLinearGradient(0, 0, W, 0);
  rb.addColorStop(0, '#0B3D2A'); rb.addColorStop(.5, '#0E5A3A'); rb.addColorStop(1, '#0B3D2A');
  c.fillStyle = rb; c.fillRect(0, y0 - 7, W, 6);
  c.fillStyle = 'rgba(62,240,143,.55)'; c.fillRect(0, y0 - 7, W, 1);
  // the lights: two banks on their towers, glowing over the rim
  [.14, .86].forEach(fx => {
    const lx = W * fx, ly = sTop - Math.max(34, H * .09);
    c.fillStyle = 'rgba(20,30,60,.9)'; c.fillRect(lx - 1.5, ly, 3, sTop - ly);
    const halo = c.createRadialGradient(lx, ly, 2, lx, ly, W * .42);
    halo.addColorStop(0, 'rgba(220,232,255,.55)'); halo.addColorStop(.1, 'rgba(160,190,255,.2)'); halo.addColorStop(1, 'rgba(120,150,255,0)');
    c.fillStyle = halo; c.fillRect(0, 0, W, y0);
    c.fillStyle = 'rgba(28,36,64,1)'; c.fillRect(lx - 19, ly - 9, 38, 14);
    c.fillStyle = 'rgba(240,246,255,.97)';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) c.fillRect(lx - 17 + i * 7.2, ly - 7 + j * 6, 5.4, 4);
  });
  return cv;
}
function drawSky(st, c) {
  if (!st.bg || st.bg.w !== st.W || st.bg.h !== st.H) st.bg = {w: st.W, h: st.H, cv: backdrop(st)};
  c.drawImage(st.bg.cv, 0, 0, st.W, st.y0 + 2);
}
function drawField(st, c, sc) {
  const {d, gx} = sc, zFar = d + 60, zNear = -2.8, gl = d - 10;
  // beyond the sidelines, out to the stands
  c.fillStyle = '#0E3A22'; c.fillRect(0, st.y0, st.W, st.H - st.y0);
  // the field in 5-yard stripes back from the goal line; the end zone; past the end line, the turf beyond
  const F = (z0, z1, col) => { c.fillStyle = col; quad(c, proj(st, gx - FIELD.half, 0, z0), proj(st, gx + FIELD.half, 0, z0), proj(st, gx + FIELD.half, 0, z1), proj(st, gx - FIELD.half, 0, z1)); c.fill(); };
  for (let j = 0; gl - j * 5 > zNear - 5; j++) F(Math.max(zNear, gl - (j + 1) * 5), gl - j * 5, j % 2 ? '#1E7A3E' : '#228645');
  F(gl, d, '#17633A');
  F(d, zFar, '#145A33');
  // a soft light pool down the middle
  const lp = proj(st, gx, 0, d * .6);
  const rg = c.createRadialGradient(lp.x, lp.y, 4, lp.x, lp.y, st.W * .8);
  rg.addColorStop(0, 'rgba(255,255,255,.08)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg; c.fillRect(0, st.y0, st.W, st.H - st.y0);
  // lines: the yard lines, goal line, end line, sidelines; the hashes
  c.strokeStyle = 'rgba(255,255,255,.82)';
  const across = (z, w = .12, x0 = gx - FIELD.half, x1 = gx + FIELD.half) => {
    if (z < zNear) return;
    const a = proj(st, x0, 0, z), b = proj(st, x1, 0, z);
    c.lineWidth = Math.max(1, w * a.s * .55); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  };
  for (let j = 5; gl - j > zNear; j += 5) across(gl - j);
  across(gl, .2); across(d, .2);
  c.lineWidth = 1.5;
  [-1, 1].forEach(s => { const a = proj(st, gx + s * FIELD.half, 0, zNear), b = proj(st, gx + s * FIELD.half, 0, d); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
  c.strokeStyle = 'rgba(255,255,255,.55)';
  for (let j = 1; gl - j > zNear; j++) {
    if (j % 5 === 0) continue;
    [-1, 1].forEach(s => across(gl - j, .08, gx + s * FIELD.hash - .35, gx + s * FIELD.hash + .35));
  }
}
function drawPosts(st, c, sc, t) {
  const {d, gx, w, dir} = sc, {half, bar, top} = K.POST;
  const P = (x, y, z) => proj(st, x, y, z);
  const base = P(gx, 0, d + 2), neck = P(gx, bar, d + 2), mid = P(gx, bar, d);
  const lw = s => Math.max(2, .16 * s);
  c.lineCap = 'round';
  const pole = (a, b) => {
    c.strokeStyle = '#B8901A'; c.lineWidth = lw(a.s) + 1.5; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    c.strokeStyle = '#FFD23F'; c.lineWidth = lw(a.s); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  };
  // the padding at the base
  c.fillStyle = '#1F3F8A'; const pb = P(gx, 2, d + 2); c.fillRect(base.x - lw(base.s) * 1.3, pb.y, lw(base.s) * 2.6, base.y - pb.y);
  pole(base, neck); pole(neck, mid);
  pole(P(gx - half, bar, d), P(gx + half, bar, d));
  pole(P(gx - half, bar, d), P(gx - half, top, d));
  pole(P(gx + half, bar, d), P(gx + half, top, d));
  // the ribbons on top: blown with the wind (sideways and toward or away), flapping a little
  const a = dir * Math.PI / 180, s = Math.min(1, w / 18);
  [-1, 1].forEach(k => {
    const at = P(gx + k * half, top, d);
    const len = Math.max(13, 2.4 * at.s) * (.55 + .75 * s), flap = Math.sin(t * 9 + k) * .25 * s;
    const ex = at.x + Math.sin(a) * len * (.25 + s), ey = at.y + len * (1 - s * .85) * .9 + flap * len - Math.cos(a) * s * len * .25;
    c.strokeStyle = '#FF6A2B'; c.lineWidth = Math.max(2.5, .12 * at.s);
    c.beginPath(); c.moveTo(at.x, at.y); c.quadraticCurveTo((at.x + ex) / 2 + flap * len, (at.y + ey) / 2 - flap * len * .3, ex, ey); c.stroke();
  });
}
// ---------------------------------------------------------------- The things in the way
// Each drawn standing on the turf, facing us, in yards from its foot (x across, y up: the canvas is flipped so y runs
// up), scaled by how far off it is; pop (0-1) grows it in when the posts move to a new kick.
const OB_DRAW = {
  wall(c, o) {
    const hw = o.half, h = o.h, row = h / 20;
    const g = c.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, '#C0503A'); g.addColorStop(.6, '#A63D2A'); g.addColorStop(1, '#7E2C1D');
    c.fillStyle = g; c.fillRect(-hw, 0, hw * 2, h);
    // mortar: the courses and the joints, every other course offset by half a brick
    c.strokeStyle = 'rgba(236,214,186,.6)'; c.lineWidth = row * .14;
    c.beginPath();
    for (let j = 1; j < 20; j++) { c.moveTo(-hw, j * row); c.lineTo(hw, j * row); }
    for (let j = 0; j < 20; j++) for (let x = -hw + (j % 2 ? .55 : 0) + 1.1; x < hw - .05; x += 1.1) { c.moveTo(x, j * row); c.lineTo(x, (j + 1) * row); }
    c.stroke();
    // the coping on top, and a sign
    c.fillStyle = '#D9C9B0'; c.fillRect(-hw - .15, h - .35, hw * 2 + .3, .45);
    const sw = Math.min(3.2, hw * 1.7), sk = sw / 3.2;
    c.fillStyle = '#F4F1EA'; c.fillRect(-sw / 2, h * .55, sw, 1.3 * sk);
    c.save(); c.scale(.05 * sk, -.05 * sk); c.fillStyle = '#C8102E'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 12.4px "Barlow Condensed", "Arial Narrow", sans-serif`; c.fillText('NO KICKING', 0, -(h * .55 + .65 * sk) * 20 / sk); c.restore();
  },
  dino(c, o, t) {
    // a T-rex side on, in a 100 x 100 box (y down), facing o.face
    const s = o.h / 100, w = o.half * 2 / 100;
    c.save(); c.scale(o.face * w, -s); c.translate(-50, -100);
    const P = [[98, 12], [99, 19], [93, 21], [80, 21], [80, 25], [95, 28], [93, 34], [74, 35], [70, 41], [73, 46], [81, 50], [80, 54], [70, 51],
      [66, 59], [62, 67], [60, 80], [63, 95], [72, 100], [51, 100], [51, 91], [47, 79], [44, 92], [47, 100], [30, 100], [33, 87], [35, 73],
      [29, 67], [0, 74], [3, 65], [27, 50], [39, 33], [54, 22], [60, 8], [75, 2], [91, 4]];
    c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    const g = c.createLinearGradient(0, 0, 0, 100);
    g.addColorStop(0, '#5BC160'); g.addColorStop(1, '#2F8A3C');
    c.fillStyle = g; c.fill();
    c.strokeStyle = '#1E5E28'; c.lineWidth = 1.6; c.stroke();
    // the belly, the teeth, the eye (blinking now and then)
    c.fillStyle = 'rgba(214,240,170,.55)'; c.beginPath(); c.ellipse(60, 52, 9, 13, -.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    for (let x = 82; x < 94; x += 4) { c.beginPath(); c.moveTo(x, 21); c.lineTo(x + 2, 24); c.lineTo(x + 4, 21); c.fill(); }
    const blink = (t % 3.2) < .12;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(83, 10, 3.4, blink ? .6 : 3, 0, 0, Math.PI * 2); c.fill();
    if (!blink) { c.fillStyle = '#111'; c.beginPath(); c.arc(84.2, 10.4, 1.6, 0, Math.PI * 2); c.fill(); }
    c.restore();
  },
  duck(c, o) {
    const f = o.face, hw = o.half;
    c.save(); c.scale(1, o.h / 10.3); // drawn 10.3 tall
    const yel = c.createLinearGradient(0, 0, 0, 10.3);
    yel.addColorStop(0, '#E8A900'); yel.addColorStop(.5, '#FFD21F'); yel.addColorStop(1, '#FFE873');
    c.fillStyle = yel;
    // body and tail, then the head
    c.beginPath(); c.ellipse(0, 3.2, hw, 3.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-f * hw * .7, 4.6); c.quadraticCurveTo(-f * hw * 1.15, 7.2, -f * hw * .95, 7.4); c.quadraticCurveTo(-f * hw * .6, 6, -f * hw * .3, 5.6); c.fill();
    c.beginPath(); c.arc(f * hw * .32, 7.8, hw * .78, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(200,140,0,.45)'; c.beginPath(); c.ellipse(-f * hw * .15, 3.5, hw * .5, 1.2, f * .25, 0, Math.PI * 2); c.fill();
    // the beak, the eye, a shine
    c.fillStyle = '#FF7A1A'; c.beginPath(); c.ellipse(f * hw * 1.05, 7.4, hw * .42, .55, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(f * hw * .62, 8.4, .36, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(f * hw * .66, 8.55, .12, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(f * hw * .12, 7.8 + hw * .42, hw * .28, hw * .12, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  },
  tube(c, o, t) {
    // an inflatable tube man, flailing: the blower at its foot, the tube waving, arms everywhere
    c.fillStyle = '#5B6474'; c.fillRect(-1.1, 0, 2.2, 1.1);
    const wave = y => Math.sin(y * .55 - t * 6) * .55 * (y / o.h);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const tube = (col, wdt) => { c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); for (let y = 1; y <= o.h - .6; y += .4) (y === 1 ? c.moveTo(wave(y), y) : c.lineTo(wave(y), y)); c.stroke(); };
    tube('#C81E14', 1.25); tube('#FF3B30', .95);
    const sy = o.h * .72, sx = wave(sy);
    [-1, 1].forEach(k => {
      const ang = Math.sin(t * 7 + k * 1.7) * .9;
      const mx = sx + k * 1.1, my = sy + .6 + Math.cos(t * 5 + k) * .4, ex = mx + k * Math.cos(ang) * 1.1, ey = my + Math.sin(ang) * 1.3 + .4;
      c.strokeStyle = '#FF3B30'; c.lineWidth = .55; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
    });
    // the face, the hair
    const hx = wave(o.h - .9), hy = o.h - 1.1;
    c.fillStyle = '#fff'; [-1, 1].forEach(k => { c.beginPath(); c.arc(hx + k * .22, hy + .15, .2, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = '#111'; [-1, 1].forEach(k => { c.beginPath(); c.arc(hx + k * .22, hy + .12, .09, 0, Math.PI * 2); c.fill(); });
    c.strokeStyle = '#111'; c.lineWidth = .08; c.beginPath(); c.arc(hx, hy - .2, .28, Math.PI * 1.15, Math.PI * 1.85, true); c.stroke();
    c.strokeStyle = '#FFD21F'; c.lineWidth = .18;
    c.beginPath(); for (let k = -3; k <= 3; k++) { c.moveTo(hx + k * .12, o.h - .5); c.lineTo(hx + k * .2 + Math.sin(t * 9 + k) * .12, o.h + .25); } c.stroke();
  },
  cactus(c, o) {
    const g = c.createLinearGradient(-1, 0, 1, 0);
    g.addColorStop(0, '#3DB86A'); g.addColorStop(1, '#22803F');
    c.lineCap = 'round'; c.lineJoin = 'round';
    const limb = (pts, wdt) => {
      c.strokeStyle = '#1C6B35'; c.lineWidth = wdt + .2; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.strokeStyle = g; c.lineWidth = wdt; c.stroke();
    };
    const hw = o.half;
    limb([[0, .5], [0, o.h - .8]], 1.6);
    limb([[0, o.h * .39], [-hw + .55, o.h * .39], [-hw + .55, o.h * .66]], 1.05);
    limb([[0, o.h * .54], [hw - .55, o.h * .54], [hw - .55, o.h * .8]], 1.05);
    // the ribs, and a flower on top
    c.strokeStyle = 'rgba(200,255,210,.35)'; c.lineWidth = .08;
    c.beginPath(); [-.35, 0, .35].forEach(x => { c.moveTo(x, .6); c.lineTo(x, o.h - .9); }); c.stroke();
    c.fillStyle = '#FF5FA2'; c.beginPath(); c.arc(0, o.h - .1, .45, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#FFE14D'; c.beginPath(); c.arc(0, o.h - .1, .17, 0, Math.PI * 2); c.fill();
  }
};
function drawObstacle(st, c, o, t, pop, shake) {
  const b = proj(st, o.x, 0, o.z);
  if (b.s <= 0 || pop <= 0) return;
  // its shadow on the turf
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(b.x, b.y, o.half * b.s * 1.05, Math.max(2, o.half * b.s * .16), 0, 0, Math.PI * 2); c.fill();
  c.save();
  c.translate(b.x + (shake ? Math.sin(t * 60) * shake * b.s * .25 : 0), b.y);
  c.scale(b.s * pop, -b.s * pop); // yards, y up
  try { (OB_DRAW[o.t] || OB_DRAW.wall)(c, o, t); } finally { c.restore(); }
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
  if (onTee) { c.fillStyle = '#FF7A1A'; c.beginPath(); c.moveTo(sh.x - Wd * .5, sh.y); c.lineTo(sh.x + Wd * .5, sh.y); c.lineTo(sh.x + Wd * .18, sh.y - L * .28); c.lineTo(sh.x - Wd * .18, sh.y - L * .28); c.closePath(); c.fill(); }
  // tumbling end over end, seen from behind: as wide as the ball always, as tall as it shows its length
  const tall = Math.max(Wd, L * Math.abs(Math.cos(spin)));
  c.save(); c.translate(p.x, p.y - (onTee ? L * .2 : 0));
  const g = c.createLinearGradient(-Wd / 2, -tall / 2, Wd / 2, tall / 2);
  g.addColorStop(0, '#B45A2A'); g.addColorStop(.55, '#7A3415'); g.addColorStop(1, '#4E200C');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, Wd / 2, tall / 2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke();
  if (tall > Wd * 1.25) { // the laces, when it shows its side
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = Math.max(1, Wd * .07);
    c.beginPath(); c.moveTo(0, -tall * .22); c.lineTo(0, tall * .22); c.stroke();
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-Wd * .1, i * tall * .08); c.lineTo(Wd * .1, i * tall * .08); c.stroke(); }
  }
  c.restore();
}
// The ball's streak: where it was over the last third of a second, fading out behind it.
function drawTrail(st, c, f) {
  const n = 14, span = Math.min(f.t, .35);
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
  drawSky(st, c);
  drawField(st, c, sc);
  // the ball behind the posts is drawn before them, in front after
  const f = st.flight, ball = f ? f.call.pos(f.t) : {x: 0, y: .15, z: 0};
  const spin = f ? f.t * 12 : 0;
  if (f) drawTrail(st, c, f);
  // far to near: the posts, the things in the way, the ball where it is among them; then a ghost of the posts over
  // anything hiding them, so the target always shows
  const obs = sc.obs || [], hitOb = f && f.call.hit && f.t >= f.call.tHit ? f.call.hit : null;
  const items = [{z: sc.d + .01, draw: () => drawPosts(st, c, sc, t)}]
    .concat(obs.map(o => ({z: o.z, ob: true, draw: () => drawObstacle(st, c, o, t, sc.pop == null ? 1 : sc.pop, o === hitOb ? Math.max(0, 1 - (f.t - f.call.tHit) * 2.5) : 0)})));
  if (st.ballOn !== false) items.push({z: ball.z, draw: () => drawBall(st, c, ball, spin, !f)});
  items.sort((p, q) => q.z - p.z);
  const lastOb = items.map(x => !!x.ob).lastIndexOf(true);
  items.forEach((x, i) => {
    x.draw();
    if (i === lastOb) { c.save(); c.globalAlpha = .4; drawPosts(st, c, sc, t); c.restore(); }
  });
  if (f && f.call.hit) drawBonk(st, c, f);
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
/** Which way to bend around what's in the way: away from the first thing's side of the line to the posts (or from
 *  the second thing's, when the first stands square on it). -1 left, +1 right; 0 with nothing in the way. */
const inGoal = o => (K.OBSTACLES[o.t] || {}).at === 'goal';
/** Where to aim in the goal: its middle, or the middle of what the wall leaves open (world x). */
function openX(k) {
  const w = (k.obs || []).find(inGoal);
  if (!w) return k.gx;
  const inner = w.x - w.face * w.half; // the wall's edge in the opening (it's flush with the upright on side face)
  return (inner + k.gx - w.face * K.POST.half) / 2;
}
function bendSide(k) {
  const obs = (k.obs || []).filter(o => !inGoal(o)).sort((a, b) => a.z - b.z);
  if (!obs.length) return 0;
  const off = o => o.x - k.gx * o.z / k.d;
  if (Math.abs(off(obs[0])) > .3) return off(obs[0]) > 0 ? -1 : 1;
  return obs[1] ? (off(obs[1]) > 0 ? -1 : 1) : -1;
}
function placeGuide(st) {
  const g = st.el.querySelector('[data-kk-guide]'), k = st.kicks[st.i];
  if (!g || !st.scene || !k) return;
  const ball = proj(st, 0, .15, 0), cb = proj(st, openX(k) + st.scene.gx - k.gx, K.POST.bar, st.scene.d);
  let dx = cb.x - ball.x, dy = cb.y - ball.y;
  const len = Math.hypot(dx, dy) || 1, go = Math.min(len * .8, st.H * .42);
  dx *= go / len; dy *= go / len;
  // an even arc, bowed a third of its length to the free side (a quadratic's control point sits twice as far out)
  const side = bendSide(k), nx = -dy / go, ny = dx / go, out = side * go * .3 * 2;
  const ex = ball.x + dx, ey = ball.y + dy, qx = ball.x + dx / 2 + nx * out, qy = ball.y + dy / 2 + ny * out;
  const d = side ? `M${ball.x.toFixed(1)} ${ball.y.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}` : `M${ball.x.toFixed(1)} ${ball.y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`;
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
  if (t) t.textContent = side ? 'Swipe in an arc to bend it around' : (k.obs || []).some(inGoal) ? 'Aim for the open side of the goal' : 'Slide up from the ball to kick';
}
/** "Look out!": the first kick with something in the way, once a run, for a few seconds (or till a finger's down). */
function alertFor(st, on) {
  const a = st.el.querySelector('[data-kk-alert]');
  if (!a) return;
  clearTimeout(st.alertT);
  const k = st.kicks[st.i], t = a.querySelector('[data-kk-alert-t]');
  if (on && t && k) {
    const front = (k.obs || []).some(o => !inGoal(o)), wall = (k.obs || []).some(inGoal);
    t.textContent = front && wall ? 'Bend the ball around what’s in front, and aim for the open side of the goal.'
      : wall ? 'A wall’s blocking part of the goal. Aim for the open side.' : 'Something’s in the way. Swipe in an even arc to bend the ball around it.';
  }
  a.hidden = !on;
  if (on) st.alertT = setTimeout(() => { a.hidden = true; }, 4500);
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
  const first = st.i === K.OBS_FROM;
  if (first) alertFor(st, true);
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
  const cv = st.cv, k = st.kicks[st.i];
  const inWay = k && k.obs && k.obs.length ? ` In the way: ${k.obs.map(o => (inGoal(o) ? `a brick wall across ${o.share === .5 ? 'half' : 'a quarter'} of the goal, on the ${o.face < 0 ? 'left' : 'right'}` : `a ${(K.OBSTACLES[o.t] || {}).name} out in front`)).join('; ')}.` : '';
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
      f.t = Math.min(f.call.tEnd, (now - f.t0) / 1000);
      const callAt = f.call.tCross != null ? f.call.tCross : f.call.tHit;
      if (!f.called && callAt != null && f.t >= callAt) { f.called = true; showCall(st, f.call, f.wind); }
      // down: the ball's gone until the next one's on the tee
      if (f.t >= f.call.tEnd) { if (!f.called) { f.called = true; showCall(st, f.call, f.wind); } st.flight = null; st.ballOn = false; settle(st, f.call); }
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
const WIND_SAYS = {took: 'The wind took it', carried: 'The wind carried it through'};
function showCall(st, call, wind) {
  const el = st.el.querySelector('[data-kk-call]');
  if (!el) return;
  // the line under it: what stopped it, or what the wind did
  const note = call.hit ? (K.OBSTACLES[call.hit.t] || {}).says : wind ? WIND_SAYS[wind] : '';
  el.innerHTML = `<span>${esc(callWords(call))}</span>${note ? `<span class="kk-call-w">${esc(note)}</span>` : ''}`;
  el.className = `kk-call is-in ${call.made ? 'is-good' : 'is-miss'}${note ? ' has-w' : ''}`;
  ui.haptic(call.made ? 'success' : 'error');
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
    const k = st.kicks[st.i];
    st.move = {a: from, b: {d: k.d, gx: k.gx, w: k.w, dir: k.dir, obs: k.obs || []}, t0: performance.now(), ms: ui.RM ? 1 : (k.obs && k.obs.length ? 900 : 650)};
    st.ballOn = true;
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
/** A swipe: from the ball, up the screen. Its line aims; its speed over the last few frames is the leg; its shape bends
 *  the kick (an even arc curves the ball around and back to the posts; a lopsided one doesn't come back true). */
function onDown(st, e) {
  if (st.busy || st.day.done || st.flight || st.move || !e.isPrimary) return;
  const r = st.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  st.drag = {id: e.pointerId, x0: x, y0: y, pts: [{x, y, t: performance.now()}]};
  try { st.pad.setPointerCapture(e.pointerId); } catch (_) {}
  guide(st, false);
  alertFor(st, false);
  loop(st);
}
function onMove(st, e) {
  const g = st.drag;
  if (!g || e.pointerId !== g.id) return;
  const r = st.cv.getBoundingClientRect();
  g.pts.push({x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now()});
  if (g.pts.length > 400) g.pts.splice(1, 1); // the whole swipe: its shape bends the kick
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
  const k = st.kicks[st.i], dx = end.x - g.x0, dy = end.y - g.y0;
  // where the flick points at the posts: its line from the ball, at the crossbar's height on screen
  let aim;
  const ball = proj(st, 0, .15, 0), cb = proj(st, k.gx, K.POST.bar, k.d);
  if (dy < 0 && cb.y < ball.y) aim = ((ball.x + dx * (cb.y - ball.y) / dy - st.W / 2) * (k.d + K.CAM.back) / st.f) / k.d;
  const launch = e.type === 'pointercancel' ? null : K.launchOf({dx, dy, speed, aim, curve: K.curveOf(g.pts)});
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
  const box = st.el.querySelector('[data-kk]'), redo = st.el.querySelector('[data-kk-redo]');
  if (box) box.classList.toggle('is-playing', !st.day.done);
  if (redo) redo.innerHTML = redoHTML(st);
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
/** Start the day's run over (a tester): today's kicks from the first, three misses again; the first finished run stays
 *  the one on the scoreboard. Not while a kick is in the air. */
function startOver(st) {
  if (st.flight || st.drag || !K.canReplay()) return;
  const day = K.restart(st.n);
  if (!day) return;
  st.timers.forEach(clearTimeout); st.timers = [];
  st.move = null; st.after = null; st.busy = false;
  setDay(st, st.n);
  const over = st.el.querySelector('[data-kk-over]'), call = st.el.querySelector('[data-kk-call]');
  if (over) { over.hidden = true; over.innerHTML = ''; }
  if (call) call.className = 'kk-call';
  setMode(st);
  patchHud(st);
  draw(st);
  armGuide(st);
  ui.haptic('light');
  fitScreen(st, true);
}

// ============================================================================ Board
function patchBoard(st) {
  const body = st.el.querySelector('[data-kk-sbody]');
  if (body) body.innerHTML = boardBodyHTML(st);
}
function setDay(st, n) {
  st.n = n;
  st.kicks = K.kicks(n);
  st.day = K.dayState(n);
  st.i = Math.min(st.day.next, K.MAX_KICKS - 1);
  // a finished run shows the last kick's spot; one under way, the next
  setScene(st, st.kicks[st.day.done ? Math.max(0, st.day.list.length - 1) : st.i]);
  st.ballOn = !st.day.done;
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
    if (e.target.closest('[data-kk-again]')) { startOver(st); return; }
    if (e.target.closest('[data-kk-sb]')) { const b = st.el.querySelector('[data-kk-board]'); if (b) b.scrollIntoView({block: 'start', behavior: ui.RM ? 'auto' : 'smooth'}); }
  };
  el.addEventListener('click', st.onClick);
  st.onResize = () => { if (!st.dead) { size(st); draw(st); placeGuide(st); fitScreen(st); } };
  addEventListener('resize', st.onResize, {passive: true});
  st.unsub = daily.subscribe(type => { if (type === 'lb' || type === 'ready' || type === 'error') patchBoard(st); });
  st.stopTick = ctx.timer(() => tick(st), 20000);
  K.autoPost();
  armGuide(st);
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
  if (st.stopTick) st.stopTick();
  ST.delete(ctx);
}
