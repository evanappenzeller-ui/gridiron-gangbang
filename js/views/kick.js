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
const CSS_V = '2';
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
function hudHTML(st) {
  const k = st.kicks[st.i] || st.kicks[st.kicks.length - 1], day = st.day;
  return `<div class="kk-hud-l"><span class="kk-kno">${esc(`Kick ${Math.min(st.i + 1, K.MAX_KICKS)}`)}</span><b class="kk-dist">${k.d}<small> yds</small></b></div>`
    + `<div class="kk-wind${k.w ? '' : ' is-calm'}" style="--wd:${k.dir}deg" aria-label="${esc(windWords(k))}">${k.w ? windArrow : ''}<span>${k.w ? `${k.w} mph` : 'Calm'}</span></div>`
    + `<div class="kk-hud-r"><span class="kk-made"><b>${day.made}</b> made</span><span class="kk-xs" aria-label="${esc(`${day.missed} ${day.missed === 1 ? 'miss' : 'misses'} of ${K.STRIKES}`)}">${strikesHTML(day.missed)}</span></div>`;
}
function overHTML(st) {
  const d = st.day;
  const head = d.made >= 20 ? 'Automatic.' : d.made >= 12 ? 'Pro Bowl leg.' : d.made >= 7 ? 'Solid day at the office.' : d.made >= 3 ? 'Shanked a few.' : 'Cut after practice.';
  return `<div class="kk-over-card"><p class="kk-over-k">${esc(`Kick It · ${K.dayLabel(st.n)}`)}</p>`
    + `<p class="kk-over-n"><b>${d.made}</b><span>${d.made === 1 ? 'field goal' : 'field goals'}</span></p>`
    + `<p class="kk-over-h">${esc(head)}</p>`
    + `<p class="kk-over-s">${esc(d.longest ? `Longest ${d.longest} yds · ${d.yards} yds in all · ${plural(d.list.length, 'kick')}` : `${plural(d.list.length, 'kick')}, none through`)}</p>`
    + `<p class="kk-over-t">${ui.icon('clock', {size: 14})}<span>${esc(`New kicks in ${ui.untilText(msToMidnight())}`)}</span></p></div>`;
}
// How to kick, under the stage: always there, three short steps.
const HOW = `<section class="kk-steps" aria-labelledby="kk-steps-t"><h2 class="kk-steps-t" id="kk-steps-t">How to kick</h2><ol>`
  + `<li><span><b>Touch the ball</b> on the tee.</span></li>`
  + `<li><span><b>Slide up</b> toward the posts and let go. The faster you flick, the farther it flies.</span></li>`
  + `<li><span><b>Mind the wind.</b> The arrow up top and the flags on the posts show which way it blows, so aim into it.</span></li>`
  + `</ol></section>`;
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
function bodyHTML(st) {
  return `<div class="kk">`
    + `<div class="kk-stage" data-kk-stage><canvas class="kk-cv" data-kk-cv role="img" aria-label="The field from behind the tee, the posts down the field."></canvas>`
    // the kicking pad: the stage's lower part, around the ball, takes the flick; the rest scrolls the page as usual
    + `<div class="kk-pad" data-kk-pad aria-hidden="true"></div>`
    + `<div class="kk-hud" data-kk-hud>${hudHTML(st)}</div>`
    + `<p class="kk-call" data-kk-call aria-live="polite"></p>`
    + `<div class="kk-guide" data-kk-guide hidden aria-hidden="true"><i class="kk-guide-trail"></i><span class="kk-guide-hand">${HAND}</span></div>`
    + `<p class="kk-hint" data-kk-hint hidden>${ui.icon('arrow-up', {size: 16})}<span>Slide up from the ball to kick</span></p>`
    + `<div class="kk-over" data-kk-over${st.day.done ? '' : ' hidden'}>${st.day.done ? overHTML(st) : ''}</div></div>`
    + HOW
    + `<p class="kk-how">${esc(`Three misses ends your run. New kicks every day, the same for everyone.`)}</p>`
    + `<div data-kk-board>${boardHTML(st)}</div></div>`;
}

// ============================================================================ The scene
// The world in yards (core/kick.js): x across, y up, z downfield from the tee; the camera K.CAM.back behind the tee
// and K.CAM.h up. The posts stand at the middle of the field: a kick from off to the side has the field off to the side.
const FIELD = {half: 26.67, hash: 3.083};
function size(st) {
  const cv = st.cv, W = cv.parentElement.clientWidth || 360;
  // as tall as fits between the nav bar and the tab bar (a small phone scrolls a little), within limits
  const H = Math.round(Math.max(380, Math.min(620, W * 1.3, (innerHeight || 800) - 170)));
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.height = H + 'px';
  st.W = W; st.H = H; st.dpr = dpr;
  st.f = W * 1.05;
  st.y0 = H - 64 - st.f * (K.CAM.h - .15) / K.CAM.back; // the horizon: the tee's ball sits 64 px off the bottom
}
function proj(st, x, y, z) {
  const Z = Math.max(.25, z + K.CAM.back);
  return {x: st.W / 2 + st.f * x / Z, y: st.y0 + st.f * (K.CAM.h - y) / Z, s: st.f / Z};
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
    const len = Math.max(10, 1.6 * at.s), flap = Math.sin(t * 9 + k) * .25 * s;
    const ex = at.x + Math.sin(a) * len * (.25 + s), ey = at.y + len * (1 - s * .85) * .9 + flap * len - Math.cos(a) * s * len * .25;
    c.strokeStyle = '#FF6A2B'; c.lineWidth = Math.max(2, .09 * at.s);
    c.beginPath(); c.moveTo(at.x, at.y); c.quadraticCurveTo((at.x + ex) / 2 + flap * len, (at.y + ey) / 2 - flap * len * .3, ex, ey); c.stroke();
  });
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
  const behind = f && ball.z > sc.d;
  if (f) drawTrail(st, c, f);
  if (st.ballOn !== false && behind) drawBall(st, c, ball, spin, false);
  drawPosts(st, c, sc, t);
  if (st.ballOn !== false && !behind) drawBall(st, c, ball, spin, !f);
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
function placeGuide(st) {
  const g = st.el.querySelector('[data-kk-guide]');
  if (!g || !st.scene) return;
  const ball = proj(st, 0, .15, 0), cb = proj(st, st.scene.gx, K.POST.bar, st.scene.d);
  let dx = cb.x - ball.x, dy = cb.y - ball.y;
  const len = Math.hypot(dx, dy) || 1, go = Math.min(len * .8, st.H * .42);
  dx *= go / len; dy *= go / len;
  g.style.cssText = `--x0:${ball.x.toFixed(1)}px;--y0:${ball.y.toFixed(1)}px;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--len:${go.toFixed(1)}px;--ang:${Math.atan2(dx, -dy).toFixed(4)}rad`;
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
  if (!st.day.list.length || !K.totals().played) guide(st, true);
  else st.guideT = setTimeout(() => guide(st, true), GUIDE_IDLE);
}

// ============================================================================ Play
const callWords = call => (call.made ? K.CALLS.good : call.why === 'short' ? 'Short' : K.CALLS[call.why]);
function setScene(st, k) { st.scene = {d: k.d, gx: k.gx, w: k.w, dir: k.dir}; }
function patchHud(st) {
  const h = st.el.querySelector('[data-kk-hud]');
  if (h) h.innerHTML = hudHTML(st);
  const cv = st.cv, k = st.kicks[st.i];
  if (cv && k) cv.setAttribute('aria-label', `Kick ${st.i + 1}: ${k.d} yards, the posts ${k.gx > 1 ? `${Math.round(k.gx)} yards to the right` : k.gx < -1 ? `${Math.round(-k.gx)} yards to the left` : 'straight ahead'}. ${windWords(k)}.`);
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
      if (!f.called && f.call.tCross != null && f.t >= f.call.tCross) { f.called = true; showCall(st, f.call); }
      // down: the ball's gone until the next one's on the tee
      if (f.t >= f.call.tEnd) { if (!f.called) { f.called = true; showCall(st, f.call); } st.flight = null; st.ballOn = false; settle(st, f.call); }
      else more = true;
    }
    if (st.move) {
      const m = st.move, p = Math.min(1, (now - m.t0) / m.ms), e = 1 - Math.pow(1 - p, 3);
      st.scene = {d: m.a.d + (m.b.d - m.a.d) * e, gx: m.a.gx + (m.b.gx - m.a.gx) * e, w: m.b.w, dir: m.b.dir};
      if (p >= 1) { st.move = null; armGuide(st); } else more = true;
    }
    if (st.drag) more = true;
    draw(st, now);
    if (more) st.raf = requestAnimationFrame(step);
  };
  st.raf = requestAnimationFrame(step);
}
function showCall(st, call) {
  const el = st.el.querySelector('[data-kk-call]');
  if (!el) return;
  el.textContent = callWords(call);
  el.className = `kk-call is-in ${call.made ? 'is-good' : 'is-miss'}`;
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
    st.move = {a: from, b: {d: k.d, gx: k.gx, w: k.w, dir: k.dir}, t0: performance.now(), ms: ui.RM ? 1 : 650};
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
/** A flick: from the ball, up the screen. Its direction aims; its speed over the last few frames is the leg. */
function onDown(st, e) {
  if (st.busy || st.day.done || st.flight || st.move || !e.isPrimary) return;
  const r = st.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  st.drag = {id: e.pointerId, x0: x, y0: y, pts: [{x, y, t: performance.now()}]};
  try { st.pad.setPointerCapture(e.pointerId); } catch (_) {}
  guide(st, false);
  loop(st);
}
function onMove(st, e) {
  const g = st.drag;
  if (!g || e.pointerId !== g.id) return;
  const r = st.cv.getBoundingClientRect();
  g.pts.push({x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now()});
  if (g.pts.length > 24) g.pts.shift();
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
  const launch = e.type === 'pointercancel' ? null : K.launchOf({dx, dy, speed, aim});
  if (!launch) { draw(st); guide(st, true); return; }
  const call = K.fly(k, launch);
  // saved the moment it's kicked, so leaving (or reloading) with the ball in the air doesn't take it back
  st.after = K.record(st.n, st.i, call) || K.dayState(st.n);
  st.busy = true;
  st.flight = {call, t0: now, t: 0, called: false};
  loop(st);
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
  st.onResize = () => { if (!st.dead) { size(st); draw(st); placeGuide(st); } };
  addEventListener('resize', st.onResize, {passive: true});
  st.unsub = daily.subscribe(type => { if (type === 'lb' || type === 'ready' || type === 'error') patchBoard(st); });
  st.stopTick = ctx.timer(() => tick(st), 20000);
  K.autoPost();
  armGuide(st);
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
  st.el.querySelector('[data-kk-over]').hidden = !st.day.done;
  patchHud(st);
  patchBoard(st);
  draw(st);
}
export function params(el, ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  // shown again: its size may have changed while hidden
  requestAnimationFrame(() => { if (!st.dead) { size(st); draw(st); placeGuide(st); } });
  tick(st);
  patchBoard(st);
}
export function unmount(el, ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  st.dead = true;
  st.timers.forEach(clearTimeout);
  clearTimeout(st.guideT);
  if (st.raf) cancelAnimationFrame(st.raf);
  if (st.pad) {
    st.pad.removeEventListener('pointerdown', st.onDown);
    st.pad.removeEventListener('pointermove', st.onMove);
    st.pad.removeEventListener('pointerup', st.onUp);
    st.pad.removeEventListener('pointercancel', st.onUp);
  }
  el.removeEventListener('ui:change', st.onChange);
  removeEventListener('resize', st.onResize);
  if (st.unsub) st.unsub();
  if (st.stopTick) st.stopTick();
  ST.delete(ctx);
}
