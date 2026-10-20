// Return Man (Daily Games, its own page /puzzles/return; core/return.js): the endless kick return, after Subway Surfers.
// The camera rides behind the returner as he runs up the field, the coverage team coming at him a row at a time; a
// swipe on the stage (or the arrow keys) jukes a lane over, hurdles a man diving at his legs or spins out of a wrap-up.
// The first man who gets him ends the return: a card says where, and the next kickoff waits for a tap. Three kickoffs
// a day; after the third the stage holds the day's card and the scoreboard shows under it. Every 100 yards is a
// touchdown, and the field goes on.
// The scene is drawn on a canvas: the stadium at the far end (views/stadium.js, shared with Kick It), the field in
// mowed stripes running away to it with the yard lines, the hashes (the lanes) and the numbers, the sideline walls; the
// players are the Two-Minute Drill's pictures (views/drill-sprites.js), ours in navy, theirs in red, with drawn ones
// till those load. Exports: render(ctx), mount(el, ctx), params(el, ctx), unmount(el, ctx). Owner: RETURN.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as R from '../core/return.js';
import * as SP from './drill-sprites.js';
import {backdrop, bowl, seeded, sparkle} from './stadium.js';
import {msToMidnight} from './board.js';
import {canTest, testRowHTML} from './testplay.js';

const esc = data.esc;
const nf = n => data.nf(n);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The version mark css/views/return.css carries (--rm-css): an older cached stylesheet gets the new one linked.
const CSS_V = '1';
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
const WORDS = ['RETURN MAN', '★', 'GRIDIRON', '★', 'KICKOFF', '★'];
const STATE = new WeakMap(); // pane → its state

// ============================================================================ Markup
const KO_WORDS = ['Take it to the house', 'Second kickoff', 'Last kickoff'];
function keysHTML() {
  const k = (cls, label, what) => `<li class="rm-key"><span class="rm-kk ${cls}" aria-hidden="true">${label}</span><span>${what}</span></li>`;
  return `<ul class="rm-keys" aria-label="How to play">`
    + k('is-lr', '← →', 'Swipe to juke a lane')
    + k('is-up', '↑', 'Swipe up to hurdle a dive')
    + k('is-dn', '↓', 'Swipe down to spin out of a wrap-up')
    + k('is-wall', '▮▮', 'Two shoulder to shoulder: go around')
    + `</ul>`;
}
const soFar = list => list.length ? `So far: ${list.map(y => nf(y)).join(' + ')}${list.length > 1 ? ` = ${nf(R.score(list).yards)}` : ''} yards` : '';
/** The card over the stage: before a kickoff, after a tackle, paused, or the day's last word. */
function cardHTML(st) {
  const d = st.day, k = d.next;
  if (st.mode === 'paused') {
    return `<div class="rm-card-in"><p class="rm-card-o">Kickoff ${st.run.k + 1} of ${R.RETURNS}</p><h2 class="rm-card-t">Paused</h2>`
      + `<p class="rm-card-s">${esc(`${nf(Math.floor(st.run.z))} yards and counting.`)}</p>`
      + ui.button({label: 'Keep running', icon: 'play-fill', attrs: {'data-rm-resume': ''}, cls: 'rm-go'}) + `</div>`;
  }
  if (st.mode === 'tackled') {
    const run = st.run, y = Math.floor(run.z), tds = R.tdsAt(run.z);
    const next = d.done ? ui.button({label: 'See the day', attrs: {'data-rm-day': ''}, cls: 'rm-go'})
      : ui.button({label: `Next kickoff (${k + 1} of ${R.RETURNS})`, icon: 'play-fill', attrs: {'data-rm-go': ''}, cls: 'rm-go'});
    return `<div class="rm-card-in"><p class="rm-card-o">Kickoff ${run.k + 1} of ${R.RETURNS}</p>`
      + `<p class="rm-big"><span class="n1">${esc(nf(y))}</span><small>yards</small></p>`
      + `<p class="rm-card-s">${esc(`${R.MEN[run.why].says} at ${R.spotOf(run.z)}.${tds ? ` ${plural(tds, 'touchdown')}!` : ''}`)}</p>`
      + `${next}</div>`;
  }
  if (d.done) {
    const s = d.official || d, head = s.yards >= 1000 ? 'Unstoppable.' : s.yards >= 600 ? 'House call machine.' : s.yards >= 300 ? 'Electric.'
      : s.yards >= 150 ? 'Great field position.' : s.yards >= 60 ? 'Solid returns.' : 'Fair catch next time?';
    return `<div class="rm-card-in is-day"><p class="rm-card-o">Return Man · ${esc(R.dayLabel(st.n))}</p>`
      + `<p class="rm-big"><span class="n1">${esc(nf(s.yards))}</span><small>yards</small></p>`
      + `<h2 class="rm-card-t">${esc(head)}</h2>`
      + `<p class="rm-card-s">${esc(`${s.list.map(y => nf(y)).join(' + ')}. Longest ${nf(s.longest)}${s.tds ? ` · ${plural(s.tds, 'touchdown')}` : ''}.`)}</p>`
      + (R.testing() ? '<p class="rm-card-s">Test play: not counted, not on the scoreboard.</p>' : '')
      + ui.button({label: 'See the scoreboard', kind: 'secondary', attrs: {'data-rm-sb': ''}, cls: 'rm-go'})
      + `<p class="rm-card-t2">${ui.icon('clock', {size: 14})}<span data-rm-next>${esc(`New kickoffs in ${ui.untilText(msToMidnight())}`)}</span></p></div>`;
  }
  return `<div class="rm-card-in"><p class="rm-card-o">Kickoff ${k + 1} of ${R.RETURNS}${R.testing() ? ' · Test play' : ''}</p>`
    + `<h2 class="rm-card-t">${esc(KO_WORDS[k] || KO_WORDS[0])}</h2>`
    + (k === 0 ? keysHTML() : `<p class="rm-card-s">${esc(soFar(d.list))}</p>`)
    + ui.button({label: 'Field the kick', icon: 'play-fill', attrs: {'data-rm-go': ''}, cls: 'rm-go'}) + `</div>`;
}
function hudHTML() {
  return `<div class="rm-hud" aria-hidden="true">`
    + `<div class="rm-chip rm-yds"><span class="rm-yn" data-rm-yds>0</span><span class="rm-yu">yds</span></div>`
    + `<div class="rm-chip rm-kos" data-rm-kos></div>`
    + `<div class="rm-chip rm-tot"><span class="rm-tn" data-rm-tot>0</span><span class="rm-yu">today</span></div></div>`;
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
    + `<div class="rm-stage" data-rm-stage data-hscroll aria-label="Return Man: swipe left or right to juke, up to hurdle, down to spin">`
    + `<canvas class="rm-cv" data-rm-cv></canvas>${hudHTML()}`
    + `<div class="rm-pop" data-rm-pop aria-hidden="true"></div>`
    + `<div class="rm-card" data-rm-card role="group" aria-live="polite">${cardHTML(st)}</div></div>`
    + `<div class="rm-fill" data-rm-fill></div>`
    + `<div class="rm-board-w" data-rm-board>${boardHTML(st)}</div>`
    + `<div data-rm-tp>${testRowHTML(R.testing(), 'data-rm-test')}</div></div>`;
}

// ============================================================================ The scene
// The world in yards (core/return.js): x across, y up, z up the field. The camera rides st.back behind the returner and
// st.camH up, looking up the field; it follows him across a lane only part of the way (so the lanes either side stay
// in view). The horizon is a third of the way down; the returner's feet a fifth of the way up.
const FIELD_HALF = 26.67, WALL_X = 31;
function screenRoom(st) {
  const scr = st.ctx && st.ctx.screen, tb = document.getElementById('tabbar');
  if (!scr) return 0;
  const nav = scr.querySelector(':scope > .nav'), top = nav ? nav.getBoundingClientRect().bottom : scr.getBoundingClientRect().top;
  const bottom = tb && tb.offsetHeight ? tb.getBoundingClientRect().top : (innerHeight || 0);
  return Math.round(bottom - top - 16);
}
function size(st) {
  const cv = st.cv, W = cv.parentElement.clientWidth || 360;
  const room = screenRoom(st);
  const H = Math.round(room > 300 ? Math.max(380, Math.min(860, room)) : Math.max(400, Math.min(640, W * 1.4, (innerHeight || 800) - 170)));
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.height = H + 'px';
  st.W = W; st.H = H; st.dpr = dpr;
  st.f = W * 1.05;
  st.back = 7;
  st.y0 = Math.max(120, H * .32);
  const yRun = H - Math.max(96, H * .19);
  st.camH = (yRun - st.y0) * st.back / st.f;
}
function proj(st, x, y, z) {
  const Z = Math.max(.2, z - st.camZ);
  return {x: st.W / 2 + st.f * (x - st.camX) / Z, y: st.y0 + st.f * (st.camH - y) / Z, s: st.f / Z};
}
function quad(c, a, b, d, e) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); }

// ---------------------------------------------------------------- The stadium and the sky
function drawSky(st, c, t) {
  if (!st.bg || st.bg.w !== st.W || st.bg.h !== st.H || st.bg.dpr !== st.dpr) {
    const B = bowl(st), r = seeded(31);
    const sparks = Array.from({length: 7}, () => { const x = r() * st.W; return {x, y: 6 + r() * Math.max(8, B.rim(x) - 18), s: 3 + r() * 3.5, v: 1 + r() * 1.8, ph: r() * 6.3}; });
    st.bg = {w: st.W, h: st.H, dpr: st.dpr, cv: backdrop(st, WORDS), bowl: B, sparks};
  }
  c.drawImage(st.bg.cv, 0, 0, st.W, st.y0 + 2);
  st.bg.sparks.forEach(s => { const a = Math.max(0, Math.sin(t * s.v + s.ph)); if (a > .05) sparkle(c, s.x, s.y, s.s * (.6 + .4 * a), a * .9); });
  // phones flashing in the stands, a burst of them after a touchdown
  const B = st.bg.bowl, cheer = st.cheer > performance.now(), r = seeded(1 + Math.floor(t * (cheer ? 14 : 5)));
  for (let i = 0, n = cheer ? 22 : 3; i < n; i++) {
    const x = r() * st.W, top = B.rim(x) + B.Sh * .1, y = top + r() * (B.wall(x) - 2 - top), a = .55 + r() * .45;
    c.fillStyle = `rgba(255,255,255,${(a * .28).toFixed(2)})`; c.beginPath(); c.arc(x, y, 3.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; c.fillRect(x - .9, y - .9, 1.8, 1.8);
  }
}
function drawBeams(st, c) {
  st.bg.bowl.lights.forEach(L => {
    if (L.r < 1) return;
    const tx = st.W / 2 + (L.x - st.W / 2) * .2, spread = st.W * .24;
    const g = c.createLinearGradient(0, L.y, 0, st.H);
    g.addColorStop(0, 'rgba(215,228,255,.12)'); g.addColorStop(.55, 'rgba(215,228,255,.04)'); g.addColorStop(1, 'rgba(215,228,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(L.x - 7, L.y); c.lineTo(L.x + 7, L.y); c.lineTo(tx + spread, st.H); c.lineTo(tx - spread, st.H); c.closePath(); c.fill();
  });
}

// ---------------------------------------------------------------- The field
// A field is 100 yards and an end zone 10, over and over (core/return.js): where z falls in that, and the yard line
// it is on its field (0 at the goal line you started from, 50 at midfield).
const PERIOD = R.FIELD + R.ENDZONE;
const inEndZone = z => (z < 0 ? z >= -R.ENDZONE : (((z % PERIOD) + PERIOD) % PERIOD) >= R.FIELD);
const yardOf = z => { const f = ((z % PERIOD) + PERIOD) % PERIOD; return f >= R.FIELD ? null : f; };
function drawField(st, c) {
  const {W, H, y0} = st, z0 = st.camZ + 3.2, z1 = st.camZ + 140;
  // the turf off the field and toward the horizon
  const g = c.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, '#0E2A1A'); g.addColorStop(.25, '#16492A'); g.addColorStop(1, '#1F6A37');
  c.fillStyle = g; c.fillRect(0, y0, W, H - y0);
  // the field in 5-yard stripes (and the end zones in navy), near to far
  const first = Math.floor(z0 / 5) * 5;
  for (let z = first; z < z1; z += 5) {
    const a = Math.max(z, z0), b = Math.min(z + 5, z1);
    if (b <= a) continue;
    const ez = inEndZone(z + 2.5), fy = yardOf(z + 2.5);
    if (z + 2.5 < -R.ENDZONE) continue;
    const L1 = proj(st, -FIELD_HALF, 0, a), R1 = proj(st, FIELD_HALF, 0, a), R2 = proj(st, FIELD_HALF, 0, b), L2 = proj(st, -FIELD_HALF, 0, b);
    c.fillStyle = ez ? '#16357A' : (Math.floor((fy == null ? 0 : fy) / 5) % 2 ? '#2B8A45' : '#257D3E');
    quad(c, L1, R1, R2, L2); c.fill();
  }
  // the lanes: three faint mowed strips down the field, the returner's lit a little more
  for (let l = 0; l < R.LANES; l++) {
    const x = R.xOf(null, l), w = .95;
    const a1 = proj(st, x - w, 0, z0), b1 = proj(st, x + w, 0, z0), b2 = proj(st, x + w, 0, z1), a2 = proj(st, x - w, 0, z1);
    c.fillStyle = st.run && R.laneOf(st.run) === l && st.mode === 'run' ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.035)';
    quad(c, a1, b1, b2, a2); c.fill();
  }
  // the yard lines (the goal lines heavier), the hashes and the sidelines
  for (let z = Math.ceil(z0); z < z1; z++) {
    const fy = yardOf(z), zz = z;
    const p = proj(st, 0, 0, zz), fade = Math.max(0, Math.min(1, 1.15 - (zz - st.camZ) / 120));
    if (fade <= 0) continue;
    const goal = fy === 0 || (fy == null && yardOf(z - 1) != null) || z === 0;
    if (fy != null && fy % 5 === 0 || goal) {
      const a = proj(st, -FIELD_HALF, 0, zz), b = proj(st, FIELD_HALF, 0, zz);
      c.strokeStyle = `rgba(255,255,255,${(goal ? .95 : .75) * fade})`; c.lineWidth = Math.max(.6, p.s * (goal ? .22 : .11));
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    if (fy != null) {
      // a hash mark on each lane line between the lanes' strips: the hashes at their real spot, every yard
      c.strokeStyle = `rgba(255,255,255,${.7 * fade})`; c.lineWidth = Math.max(.5, p.s * .08);
      [-R.LANE, R.LANE].forEach(hx => { const a = proj(st, hx - .33, 0, zz), b = proj(st, hx + .33, 0, zz); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
    }
  }
  [-FIELD_HALF, FIELD_HALF].forEach(x => {
    const a = proj(st, x, 0, z0), b = proj(st, x, 0, z1);
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  });
  // the numbers every ten, by the sidelines, standing up to us
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  for (let z = Math.ceil(z0 / 10) * 10; z < st.camZ + 90; z += 10) {
    const fy = yardOf(z);
    if (fy == null || fy === 0) continue;
    const num = String(fy <= 50 ? fy : 100 - fy), fade = Math.max(0, Math.min(1, 1.2 - (z - st.camZ) / 80));
    [-1, 1].forEach(side => {
      const p = proj(st, side * (FIELD_HALF - 7), 0, z);
      if (p.x < -60 || p.x > st.W + 60) return;
      c.save(); c.translate(p.x, p.y); c.scale(1, .45);
      c.font = `800 ${Math.max(6, p.s * 2).toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      c.fillStyle = `rgba(255,255,255,${(.8 * fade).toFixed(2)})`; c.fillText(num, 0, 0);
      c.restore();
    });
  }
  // the sideline walls, lit along the top
  [-1, 1].forEach(side => {
    const x = side * WALL_X, a = proj(st, x, 0, z0), b = proj(st, x, 0, z1), b2 = proj(st, x, 2.4, z1), a2 = proj(st, x, 2.4, z0);
    const wg = c.createLinearGradient(0, b2.y, 0, a.y);
    wg.addColorStop(0, '#0B1430'); wg.addColorStop(1, '#16224A');
    c.fillStyle = wg; quad(c, a, b, b2, a2); c.fill();
    c.strokeStyle = 'rgba(62,240,143,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a2.x, a2.y); c.lineTo(b2.x, b2.y); c.stroke();
    // the stands above it, rising away
    const t1 = proj(st, x + side * 12, 14, z0), t2 = proj(st, x + side * 12, 14, z1);
    const sg = c.createLinearGradient(0, t2.y, 0, a2.y);
    sg.addColorStop(0, '#060B1E'); sg.addColorStop(1, '#0F1A3C');
    c.fillStyle = sg; quad(c, a2, b2, t2, t1); c.fill();
  });
  // haze at the far end, so the field fades into the stadium
  const hz = c.createLinearGradient(0, y0, 0, y0 + (H - y0) * .22);
  hz.addColorStop(0, 'rgba(14,26,58,.85)'); hz.addColorStop(1, 'rgba(14,26,58,0)');
  c.fillStyle = hz; c.fillRect(0, y0, W, (H - y0) * .22);
}

// ---------------------------------------------------------------- The players
// Each is drawn at his feet, his height by how far he is (a man is 2 yards), with a shadow on the turf. While the
// pictures load, drawn ones stand in.
const TALL_YD = 2.05, PAST = 1.8;
function shadow(st, c, x, z, w = .55) {
  const p = proj(st, x, 0, z), r = proj(st, x + w, 0, z);
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(p.x, p.y, Math.abs(r.x - p.x), Math.max(1, Math.abs(r.x - p.x) * .3), 0, 0, Math.PI * 2); c.fill();
}
function sprite(st, c, f, flip, team, x, y, z, alpha = 1) {
  const p = proj(st, x, y, z), tall = p.s * TALL_YD;
  if (p.y < st.y0 - 2 || tall < 2) return;
  c.globalAlpha = alpha;
  if (SP.ready() && SP.hasFrame(f)) {
    SP.draw(c, {f, flip}, team, true, p.x * st.dpr, p.y * st.dpr, tall * st.dpr);
    c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  } else {
    // a stand-in: a body in the team's colour, a helmet
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
function manPose(type, d, t, i, beaten) {
  const stride = (Math.floor(t * 7 + i * 1.7) & 1);
  if (d < -0.3) return type === 'diver' ? 'def.flat' : type === 'wedge' ? `ol.r_f${stride}` : beaten === 'spun' ? 'def.fallen' : 'def.juked';
  if (type === 'diver') return d < 8 ? 'def.dive' : `def.r_f${stride}`;
  if (type === 'wrap') return d < 12 ? 'def.reach' : `def.r_f${stride}`;
  return `ol.r_f${stride}`;
}
function hint(st, c, type, x, z) {
  // Over a man you beat with a move (once he's close enough to read and not on top of you): the move.
  const p = proj(st, x, TALL_YD + .55, z), r = Math.max(7, Math.min(15, p.s * .34));
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
/** The returner's picture now: his stride; the juke, the hurdle and the spin; going down. */
function runnerPose(st) {
  const run = st.run;
  if (!run || st.mode === 'ready' || st.mode === 'catch') return {f: st.mode === 'catch' ? 'rb.stiff_b' : 'rb.r_b0', flip: false, y: 0};
  if (run.over) return {f: performance.now() - st.downAt > 380 ? 'rb.down' : 'rb.falling', flip: run.x < 0, y: 0};
  if (run.air > 0) { const p = 1 - run.air / R.MOVE.hurdle; return {f: 'rb.hurdle', flip: false, y: 1.15 * Math.sin(Math.PI * p)}; }
  if (run.spin > 0) {
    const p = 1 - run.spin / R.MOVE.spin, seq = [['rb.r_r0', false], ['rb.r_f0', false], ['rb.r_l0', false], ['rb.r_b1', false]];
    const [f, flip] = seq[Math.min(3, Math.floor(p * 4))];
    return {f, flip, y: 0};
  }
  if (run.jt < 1) return {f: 'rb.juke', flip: R.xOf(run, run.lane) > run.jFrom, y: 0};
  return {f: `rb.r_b${Math.floor(run.z / 1.5) & 1}`, flip: false, y: 0};
}
function drawPlayers(st, c, now) {
  const run = st.run, t = now / 1000;
  const rz = run ? run.z : 0, rx = run ? run.x : 0;
  const items = [];
  if (run) {
    // (men he's passed only while they're still beside him: any further back they'd fill the screen)
    R.ahead(run, 90, PAST).forEach(({row, d}) => row.lanes.forEach((type, l) => {
      if (!type) return;
      const x = R.xOf(run, l), z = rz + d, beaten = st.beaten.get(row.i);
      const tackler = run.over && run.by && run.by.row === row && run.by.lane === l;
      items.push({z, draw: () => {
        const dd = tackler ? Math.max(.4, d) : d;
        const f = tackler ? (type === 'wedge' ? 'ol.r_f0' : type === 'diver' ? 'def.dive' : 'def.reach') : manPose(type, dd, t, row.i + l, beaten);
        const zz = tackler ? rz + .5 : z, alpha = d < 0 && !tackler ? Math.max(0, 1 + d / PAST) : 1;
        if (type === 'wedge') {
          // two big men shoulder to shoulder, out of step
          [-.62, .62].forEach((o, j) => { const fj = j && /r_f/.test(f) ? f.replace(/\d$/, m => String(1 - Number(m))) : f; shadow(st, c, x + o, zz, .6); sprite(st, c, fj, false, THEM, x + o, 0, zz, alpha); });
        } else {
          shadow(st, c, x, zz);
          sprite(st, c, f, (row.i + l) % 2 === 1, THEM, x, f === 'def.dive' ? .35 : 0, zz, alpha);
          if (!run.over && d > 2.5 && d < 46 && st.mode === 'run') hint(st, c, type, x, zz);
        }
      }});
    }));
  }
  const pose = runnerPose(st);
  items.push({z: rz, me: true, draw: () => { shadow(st, c, rx, rz, .5); sprite(st, c, pose.f, pose.flip, US, rx, pose.y, rz); }});
  items.sort((a, b) => b.z - a.z || (a.me ? 1 : -1));
  items.forEach(it => it.draw());
  // the kick coming down into his hands
  if (st.mode === 'catch') {
    const p = Math.min(1, (now - st.catchAt) / CATCH_MS), y = TALL_YD * .55 + (1 - p) * (1 - p) * 26, z = rz + .3 + (1 - p) * 6;
    const q = proj(st, rx + .15, y, z), sz = Math.max(4, q.s * .32);
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
  const v = R.speedAt(run.z), k = Math.max(0, (v - 13) / 6);
  if (k <= 0) return;
  const r = seeded(Math.floor(now / 70));
  c.strokeStyle = `rgba(255,255,255,${(.18 * k).toFixed(2)})`; c.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, x = st.W / 2 + side * (st.W * (.36 + r() * .16)), y = st.y0 + (st.H - st.y0) * (.2 + r() * .7), len = 18 + r() * 40 * k;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + side * len * .25, y + len); c.stroke();
  }
}
function draw(st, now = performance.now()) {
  const c = st.c2;
  if (!c || !st.W) return;
  c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  const run = st.run;
  // the camera: behind him, following him across part of the way
  const tx = (run ? run.x : 0) * .6;
  st.camX = st.camX == null ? tx : st.camX + (tx - st.camX) * Math.min(1, st.dt * 9 || 1);
  st.camZ = (run ? run.z : 0) - st.back;
  drawSky(st, c, now / 1000);
  drawField(st, c);
  drawBeams(st, c);
  drawSpeed(st, c, now);
  drawPlayers(st, c, now);
  if (!st.vig || st.vig.w !== st.W || st.vig.h !== st.H) {
    const g = c.createRadialGradient(st.W / 2, st.H * .55, st.H * .3, st.W / 2, st.H * .55, st.H * .85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    st.vig = {w: st.W, h: st.H, g};
  }
  c.fillStyle = st.vig.g; c.fillRect(0, 0, st.W, st.H);
}

// ============================================================================ Play
const CATCH_MS = 750;
function setDay(st, n) {
  st.n = n;
  st.day = R.dayState(n);
}
function patchHud(st) {
  const el = st.el, run = st.run, y = run && st.mode !== 'ready' ? Math.floor(run.z) : 0;
  const yd = el.querySelector('[data-rm-yds]'); if (yd && yd.textContent !== String(y)) yd.textContent = String(y);
  const tot = el.querySelector('[data-rm-tot]'), t = nf(st.day.yards + (run && !run.over && st.mode !== 'ready' ? y : 0));
  if (tot && tot.textContent !== t) tot.textContent = t;
  const kos = el.querySelector('[data-rm-kos]');
  if (kos) {
    const cur = st.mode === 'ready' || st.day.done ? -1 : (run ? run.k : -1);
    const html = Array.from({length: R.RETURNS}, (_, i) => `<i class="rm-ko${i < st.day.list.length ? ' is-done' : ''}${i === cur && i >= st.day.list.length ? ' is-cur' : ''}"></i>`).join('');
    if (kos.dataset.html !== html) { kos.dataset.html = html; kos.innerHTML = html; }
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
function pop(st, text, cls = '') {
  const el = st.el.querySelector('[data-rm-pop]');
  if (!el) return;
  el.textContent = text;
  el.className = 'rm-pop' + (cls ? ' ' + cls : '');
  void el.offsetWidth;
  el.classList.add('is-on');
}
/** A kickoff: the ball comes down into his hands, then he's off. */
function go(st) {
  if (st.day.done || st.mode === 'run' || st.mode === 'catch') return;
  st.run = R.startRun(st.n, st.day.next);
  st.beaten = new Map();
  st.mode = 'catch'; st.catchAt = performance.now();
  setCard(st, false);
  patchHud(st);
  ui.haptic('light');
  fitScreen(st, true);
  loop(st);
}
function tackled(st, ev) {
  st.mode = 'tackled'; st.downAt = performance.now();
  ui.haptic('error');
  const y = Math.floor(st.run.z);
  st.day = R.record(st.n, st.run.k, y) || R.dayState(st.n);
  R.autoPost();
  patchHud(st);
  st.later = setTimeout(() => { if (!st.dead) { setCard(st, true); patchBoard(st); } }, ui.RM ? 200 : 950);
}
function onEvents(st, evs) {
  evs.forEach(e => {
    if (e.type === 'td') { pop(st, 'TOUCHDOWN!', 'is-td'); st.cheer = performance.now() + 2600; ui.haptic('success'); ui.announce(`Touchdown! ${plural(e.n, 'touchdown')}.`); }
    else if (e.type === 'juked') { pop(st, 'JUKE!'); st.beaten.set(e.row.i, 'juked'); }
    else if (e.type === 'hurdled') { pop(st, 'HURDLE!'); st.beaten.set(e.row.i, 'hurdled'); ui.haptic('light'); }
    else if (e.type === 'spun') { pop(st, 'SPIN!'); st.beaten.set(e.row.i, 'spun'); ui.haptic('light'); }
    else if (e.type === 'tackled') tackled(st, e);
  });
}
function frame(st, now) {
  const dt = Math.min(.05, Math.max(0, (now - (st.last || now)) / 1000));
  st.last = now; st.dt = dt;
  // off screen (another tab, a sheet over it): the return waits
  if ((st.mode === 'run' || st.mode === 'catch') && !st.ctx.visible) { pause(st); return; }
  if (st.mode === 'catch' && now - st.catchAt >= CATCH_MS) st.mode = 'run';
  if (st.mode === 'run') {
    onEvents(st, R.step(st.run, dt));
    if (st.mode === 'run' && now - (st.kept || 0) > 500) { st.kept = now; R.keepLive(st.n, st.run.k, st.run.z); }
  }
  draw(st, now);
  patchHud(st);
}
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
  R.keepLive(st.n, st.run.k, st.run.z);
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
  const st = {el, ctx, mode: 'ready', sbMode: 'today', run: null, beaten: new Map(), dead: false, raf: 0, camX: null, cheer: 0};
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
    leave: () => { if (st.run && (st.mode === 'run' || st.mode === 'catch' || st.mode === 'paused')) R.keepLive(st.n, st.run.k, st.run.z); }
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
  if (st.run && (st.mode === 'run' || st.mode === 'catch' || st.mode === 'paused')) { R.keepLive(st.n, st.run.k, st.run.z); R.settle(st.n); R.autoPost(); }
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
