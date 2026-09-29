// Today hub (spec 7.1): large title with the streak pill and You button (picking who you are is the launch welcome screen),
// the Daily card (three-arc ring, status line, CTA, puzzle rows), the league board, the midnight countdown
// and Record of the day. Renders history-independent content at once and the Daily once puzzles load.
// Owner: daily-hub package.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {mountBoard, streakPillHTML, stepParts, zeroParts, gradeTitle, stepIcon, whenVisible,
  countdownHTML, tickCountdown, ensureDefs, ringHTML, maxPts, countWord, dayLabel} from './board.js';
import {openYouSheet, openStreakSheet} from './you.js';

const esc = data.esc;
const nf = n => data.nf(n);
// Row subs by step id (v1: col, who, grid; v2 adds sil and jr).
const SUBS = {col: '5 players · up to 200', sil: '5 faces · up to 250', who: '7 clues · up to 350', jr: '3 guesses · up to 250', grid: '9 squares · up to 450'};
const subOf = i => { const s = daily.STEPS[i]; return SUBS[s.id] || `up to ${nf(s.max)}`; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const CHEV = '<svg class="ic chev" aria-hidden="true" focusable="false"><use href="#i-chevron-right"/></svg>';

// Module memory for this page session: what the hub last showed, so count-ups and the streak roll start from it.
const shown = {pnum: 0, total: 0, parts: null, streak: null};
const HUB = new WeakMap(); // ctx → hub state

const localLabel = () => new Date().toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'});
const ready = () => daily.status === 'ready' && !!daily.DAY;

// ============================================================================ Markup
function youInner() {
  const me = data.me();
  return me ? ui.avatar(me, {size: 32, you: true}) : `<span class="c-you-empty">${ui.icon('person', {size: 18})}</span>`;
}
function pillState() {
  if (!ready()) return null;
  const s = daily.streakLocal();
  return (!s.current && !s.best) ? null : s;
}
function pillSig(s) { return s ? [s.current, s.best, s.atRisk].join('|') : ''; }
function trailHTML() {
  const s = pillState();
  return `<span class="c-spill-slot" data-sig="${pillSig(s)}">${s ? streakPillHTML(s, {attrs: 'data-streak'}) : ''}</span>`
    + `<button type="button" class="c-you" data-you aria-label="You and settings">${youInner()}</button>`;
}

function statusLine() {
  const S = daily.STEPS;
  if (daily.allDone()) return `Locked in. ${gradeTitle(daily.gradeFor(daily.totalPts()))}.`;
  if (!daily.anyStarted()) return `${cap(countWord())} puzzles. ${nf(maxPts())} points.`;
  const open = S[daily.firstOpen()];
  let last = null;
  S.forEach(s => { if (s.done()) last = s; });
  // "Silhouettes are up." (a plural label takes "are")
  const up = `${open.label} ${/s$/.test(open.label) ? 'are' : 'is'} up.`;
  return last ? `${last.label} done. ${up}` : up;
}
function ctaInfo() {
  if (daily.allDone()) return {label: 'See your results', path: '/today/results'};
  const i = daily.firstOpen();
  const path = '/today/play/' + daily.slug(i);
  if (!daily.anyStarted()) return {label: `Start today's ${countWord()}`, path};
  return {label: `Resume · ${daily.STEPS[i].label}`, path};
}
function progressText(i) {
  const ds = daily.DS, id = daily.STEPS[i].id;
  if (id === 'col') return `${ds.col.a.length} of 5`;
  if (id === 'sil') return `${((ds.sil && ds.sil.a) || []).length} of 5`;
  if (id === 'who') return `Clue ${ds.who.clues}`;
  if (id === 'jr') return `Guess ${Math.min(3, ((ds.jr && ds.jr.g) || []).length + 1)} of 3`;
  return `${ds.grid.cells.filter(Boolean).length} of 9`;
}
function pzState(i) {
  const s = daily.STEPS[i];
  if (s.done()) { const p = s.pts(); return {k: 'done', p, perfect: p === s.max}; }
  if (s.started()) return {k: 'started', t: progressText(i)};
  return {k: 'open'};
}
function pzTrail(x) {
  if (x.k === 'done') return `<span class="n4 c-pz-pts${x.p ? '' : ' is-zero'}">${esc(nf(x.p))}</span>${ui.icon('check-circle', {size: 22, cls: 'c-pz-check' + (x.perfect ? ' is-gold' : x.p ? '' : ' is-zero')})}`;
  if (x.k === 'started') return `<span class="c-pz-prog">${esc(x.t)}</span>${CHEV}`;
  return CHEV;
}
function pzLabel(i, x) {
  const s = daily.STEPS[i];
  const st = x.k === 'done' ? `done, ${nf(x.p)} points${x.perfect ? ', perfect' : ''}` : x.k === 'started' ? `in progress, ${x.t}` : 'not started';
  return `${s.label}, ${subOf(i).replace(' · ', ', ')} points, ${st}`;
}
function pzRowHTML(i) {
  const x = pzState(i);
  return `<button type="button" class="row c-pz" data-go="/today/play/${daily.slug(i)}" data-pz="${i}" data-sig="${esc(JSON.stringify(x))}" aria-label="${esc(pzLabel(i, x))}">`
    + `<span class="row-lead"><span class="c-pz-tile">${ui.icon(stepIcon(i), {size: 22})}</span></span>`
    + `<span class="row-main"><span class="row-title">${esc(daily.STEPS[i].label)}</span><span class="row-sub">${esc(subOf(i))}</span></span>`
    + `<span class="row-trail c-pz-trail">${pzTrail(x)}</span></button>`;
}

function readyCard() {
  const pnum = daily.PNUM;
  const fresh = shown.pnum === pnum && shown.parts && shown.parts.length === daily.STEPS.length;
  // The ring and total render at what this session last showed; onShow animates them to the live values.
  const parts = fresh ? shown.parts : (ui.RM ? stepParts() : zeroParts());
  const total = fresh ? shown.total : (ui.RM ? daily.totalPts() : 0);
  const cta = ctaInfo();
  const max = nf(maxPts());
  const ring = ringHTML(parts, {
    center: `<span class="n2 c-dc-total">${esc(nf(total))}</span><span class="c-dc-of">of ${esc(max)}</span>`,
    label: `Today: ${nf(daily.totalPts())} of ${max}`, cls: 'c-dc-ring'
  });
  return `<section class="card card-hero c-dc is-ready${daily.STEPS.length > 3 ? ' is-five' : ''}" aria-labelledby="c-dc-o">
<div class="c-dc-top"><p class="card-ovl" id="c-dc-o">Daily · ${esc(dayLabel(pnum))}</p></div>
<div class="c-dc-ringw">${ring}</div>
<p class="c-dc-status">${esc(statusLine())}</p>
${ui.button({label: cta.label, kind: 'primary', attrs: {'data-go': cta.path}, cls: 'c-dc-cta'})}
<div class="c-dc-rows">${daily.STEPS.map((_, i) => pzRowHTML(i)).join('')}</div>
</section>`;
}
// Puzzle rows before puzzles.json arrives: what this phone showed today (the tab ring's gg-ring cache, same local
// date), else five (every puzzle day from Tue, Sep 29 2026 on is a five-puzzle day), so the card does not jump.
function loadingRows() {
  try {
    const v = JSON.parse(localStorage.getItem('gg-ring') || 'null');
    if (v && v.date === new Date().toDateString() && Array.isArray(v.parts) && (v.parts.length === 3 || v.parts.length === 5)) return v.parts.length;
  } catch (_) {}
  return new Date() < new Date(2026, 8, 29) ? 3 : 5;
}
function loadingCard() {
  const n = loadingRows();
  const rows = Array.from({length: n}, (_, i) => `<div class="row c-pz c-pz-sk" aria-hidden="true"><span class="row-lead"><span class="sk c-sk-tile"></span></span><span class="row-main"><span class="sk sk-line" style="width:${[42, 58, 34, 50, 38][i]}%"></span><span class="sk sk-line c-sk-sub" style="width:${[56, 48, 60, 52, 44][i]}%"></span></span></div>`).join('');
  return `<section class="card card-hero c-dc is-loading${n > 3 ? ' is-five' : ''}" aria-busy="true">
<div class="c-dc-top"><span class="sk sk-line c-sk-ovl" aria-hidden="true"></span></div>
<div class="c-dc-ringw" aria-hidden="true"><span class="sk c-sk-ring"></span></div>
<span class="sk sk-line c-sk-status" aria-hidden="true"></span>
${ui.button({label: 'Loading puzzles', kind: 'primary', disabled: true, cls: 'c-dc-cta'})}
<div class="c-dc-rows">${rows}</div>
</section>`;
}
function errorCard() {
  return `<section class="card card-hero c-dc is-error">${ui.empty({icon: 'football', title: 'Puzzles need a connection the first time.', body: 'League history works offline.', action: {label: 'Try again', attrs: {'data-retry': ''}}})}</section>`;
}
function dailyCardHTML() {
  if (daily.status === 'error') return errorCard();
  if (!ready()) return loadingCard();
  return readyCard();
}

function valHTML(v) {
  const s = String(v == null ? '' : v);
  const m = /^(-?[\d,]+)\.(\d+)$/.exec(s);
  return `<span class="n3">${m ? `${esc(m[1])}<small>.${esc(m[2])}</small>` : esc(s)}</span>`;
}
function rotdPick() {
  if (!ready()) return null;
  let list = [];
  try { list = data.recordsFlat(); } catch (e) { console.error(e); list = []; }
  return list.length ? list[daily.PNUM % list.length] : null;
}
function rotdHTML(r = rotdPick()) {
  if (!r) return '';
  const m0 = (r.matches && r.matches[0]) || [];
  const ids = [...new Set(m0.map(x => x.id))].slice(0, 2);
  const holder = r.holders[0] || '';
  const more = r.holders.length > 1 ? `<span class="c-rotd-more">+${r.holders.length - 1}</span>` : '';
  const label = `Record of the day. ${r.section}: ${r.label}, ${r.val}${r.unit ? ' ' + r.unit : ''}. ${r.holders.join('; ')}`;
  return ui.sectionHeader({title: 'Record of the day'})
    + `<a class="card c-rotd" href="#/hall/records/${esc(r.key)}" aria-label="${esc(label)}">`
    + `<p class="card-ovl">${esc(r.section)}</p>`
    + `<p class="c-rotd-label">${esc(r.label)}</p>`
    + `<p class="c-rotd-val">${valHTML(r.val)}${r.unit ? `<span class="c-rotd-unit">${esc(r.unit)}</span>` : ''}</p>`
    + (holder ? `<p class="c-rotd-h">${ids.length ? ui.avatarStack(ids, {size: 24, max: 2}) : ''}<span class="c-rotd-ht">${esc(holder)}</span>${more}</p>` : '')
    + `${CHEV}</a>`;
}
const rotdSig = r => r ? `${r.key}|${r.label}|${r.val}|${r.holders.join(';')}` : '';

// ============================================================================ Patching
function sameParts(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((p, i) => p.frac === b[i].frac && !!p.perfect === !!b[i].perfect && !!p.doneZero === !!b[i].doneZero);
}
function setText(el, text, animate) {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  if (animate) ui.animate(el, [{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: 240, easing: 'cubic-bezier(.22,1,.36,1)'});
}

// Brings the Daily card up to date: text, CTA, rows, then the ring and total (counting from what was shown).
function sync(st, animate = true) {
  if (!ready()) return;
  const card = st.el.querySelector('.c-dc.is-ready');
  if (!card) return;
  const anim = animate && !ui.RM;
  setText(card.querySelector('.c-dc-status'), statusLine(), anim);
  const cta = card.querySelector('.c-dc-cta');
  const ci = ctaInfo();
  if (cta && (cta.dataset.go !== ci.path || cta.textContent !== ci.label)) {
    cta.dataset.go = ci.path;
    setText(cta.querySelector('.btn-label'), ci.label, anim);
  }
  card.querySelectorAll('.c-pz').forEach(b => {
    const i = +b.dataset.pz, x = pzState(i), sig = JSON.stringify(x);
    if (b.dataset.sig === sig) return;
    const wasDone = (b.dataset.sig || '').includes('"done"');
    b.dataset.sig = sig;
    b.setAttribute('aria-label', pzLabel(i, x));
    const tr = b.querySelector('.c-pz-trail');
    tr.innerHTML = pzTrail(x);
    if (anim) {
      const chk = tr.querySelector('.c-pz-check');
      if (chk && !wasDone) ui.stamp(chk, {from: .3});
      else ui.animate(tr, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
    }
  });

  const parts = stepParts();
  const total = daily.totalPts();
  const ring = card.querySelector('.ring');
  const tot = card.querySelector('.c-dc-total');
  if (ring) ring.setAttribute('aria-label', `Today: ${nf(total)} of ${nf(maxPts())}`);
  const same = shown.pnum === daily.PNUM && shown.total === total && sameParts(shown.parts, parts);
  shown.pnum = daily.PNUM; shown.total = total; shown.parts = parts;
  patchPill(st, animate);
  if (same || !ring || !tot) return;
  if (st.cancelRing) { st.cancelRing(); st.cancelRing = null; }
  const from = Number(String(tot.textContent).replace(/[^\d]/g, '')) || 0;
  if (!anim) {
    ui.ringUpdate(ring, parts, {animate: false});
    tot.innerHTML = esc(nf(total));
    tot.setAttribute('aria-label', nf(total));
    return;
  }
  st.cancelRing = whenVisible(ring, () => {
    st.cancelRing = null;
    ui.ringUpdate(ring, parts, {duration: 1100});
    ui.countUp(tot, total, {from, duration: 1100, format: 'int'});
  });
}

function patchPill(st, animate) {
  const slot = st.el.querySelector('.c-spill-slot');
  if (!slot || !ready()) return;
  const s = pillState();
  const cur = s ? s.current : 0;
  const prev = shown.streak;
  shown.streak = cur;
  const sig = pillSig(s);
  if (slot.dataset.sig !== sig) {
    const had = !!slot.firstElementChild;
    slot.dataset.sig = sig;
    slot.innerHTML = s ? streakPillHTML(s, {attrs: 'data-streak'}) : '';
    if (s && !had && animate && !ui.RM) ui.stamp(slot.firstElementChild, {from: .6});
  }
  // Streak +1: odometer roll and a flame pop.
  if (s && animate && prev != null && cur > prev) {
    const n = slot.querySelector('.c-spill-n'), f = slot.querySelector('.c-flame');
    if (n) ui.odometer(n, prev, cur);
    if (f) ui.stamp(f, {from: .4});
  }
}

function patchYou(st) {
  const b = st.el.querySelector('.c-you');
  if (!b) return;
  const html = youInner();
  if (b.dataset.me === String(data.me())) return;
  b.dataset.me = String(data.me());
  b.innerHTML = html;
  if (st.ctx.visible && !ui.RM) ui.animate(b.firstElementChild, [{transform: 'scale(.6)', opacity: .4}, {transform: 'none', opacity: 1}], {spring: 'snappy'});
}

function patchRotd(st, animate = true) {
  const host = st.el.querySelector('.c-rotd-host');
  if (!host) return;
  const r = rotdPick();
  const sig = rotdSig(r);
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  const go = () => { host.innerHTML = rotdHTML(r); };
  if (animate && !ui.RM && host.firstElementChild) ui.crossfade(host, go, {duration: 160});
  else {
    go();
    if (animate && !ui.RM && host.firstElementChild) ui.animate(host, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.22,1,.36,1)'});
  }
}

function swapDaily(st) {
  const wrap = st.el.querySelector('.c-dc-wrap');
  if (!wrap) return;
  const html = dailyCardHTML();
  const go = () => { wrap.innerHTML = html; ui.hydrate(wrap); };
  if (!ui.RM && st.ctx.visible) ui.crossfade(wrap, go, {duration: 200}); else go();
  if (ready()) {
    patchPill(st, st.ctx.visible);
    patchRotd(st, st.ctx.visible);
    if (st.ctx.visible) sync(st, true); else st.pending = true;
  }
}

// ============================================================================ Events
function onClick(st, e) {
  const t = e.target.closest('[data-go], [data-you], [data-streak], [data-retry], [data-cd-load]');
  if (!t || !st.el.contains(t)) return;
  const {ctx} = st;
  if (t.hasAttribute('data-go')) { ctx.nav(t.dataset.go); return; }
  if (t.hasAttribute('data-you')) { openYouSheet(); return; }
  if (t.hasAttribute('data-streak')) { openStreakSheet(); return; }
  if (t.hasAttribute('data-retry')) { retry(st); return; }
  if (t.hasAttribute('data-cd-load')) { location.reload(); }
}

// "Try again": the loading card stays up at least RETRY_HOLD so the tap visibly does something (offline, the
// fetch fails within a frame); a second failure says so. Focus follows to the new card's button.
const RETRY_HOLD = 600;
function retry(st) {
  const wrap = st.el.querySelector('.c-dc-wrap');
  if (!wrap || st.retrying) return;
  st.retrying = true;
  const hadFocus = wrap.contains(document.activeElement);
  const go = () => { wrap.innerHTML = loadingCard(); };
  if (!ui.RM && st.ctx.visible) ui.crossfade(wrap, go, {duration: 160}); else go();
  if (hadFocus) focusQuiet(wrap.querySelector('.c-dc')); else ui.announce('Loading puzzles.');
  Promise.allSettled([daily.ensure(), new Promise(r => setTimeout(r, RETRY_HOLD))]).then(() => {
    st.retrying = false;
    if (!HUB.has(st.ctx)) return;
    swapDaily(st);
    if (daily.status === 'error') ui.toast("Still can't reach the puzzles.");
    if (hadFocus) focusQuiet(wrap.querySelector('[data-retry], .c-dc-cta'));
  });
}
function focusQuiet(el) {
  if (!el) return;
  if (!el.matches('button, a[href], input, [tabindex]')) el.setAttribute('tabindex', '-1');
  try { el.focus({preventScroll: true}); } catch (_) {}
}

function onDaily(st, type) {
  if (type === 'ready' || type === 'error') { if (!st.retrying) swapDaily(st); return; }
  if (type === 'progress') { if (st.ctx.visible) sync(st, true); else st.pending = true; return; }
  if (type === 'newday') tickCountdown(st.el.querySelector('.c-cd-host'), {animate: st.ctx.visible});
}

// ============================================================================ View
export default {
  id: 'today',
  chrome: 'nav',
  title: 'Today',

  render() {
    const r = rotdPick();
    return ui.largeTitle({eyebrow: ready() ? daily.TODAY_LABEL : localLabel(), title: 'Today', trailing: trailHTML()})
      + `<div class="c-dc-wrap" data-key="daily" data-enter>${dailyCardHTML()}</div>`
      + `<div class="c-board-host" data-key="board" data-enter></div>`
      + `<div class="c-cd-host" data-key="cd" data-enter>${countdownHTML(false)}</div>`
      + `<div class="c-rotd-host" data-key="rotd" data-enter data-sig="${esc(rotdSig(r))}">${rotdHTML(r)}</div>`;
  },

  mount(el, ctx) {
    ensureDefs();
    const st = {el, ctx, board: null, pending: false, cancelRing: null, retrying: false};
    HUB.set(ctx, st);
    const you = el.querySelector('.c-you');
    if (you) you.dataset.me = String(data.me());
    st.board = mountBoard(el.querySelector('.c-board-host'), {mode: 'today', ctx});
    el.addEventListener('click', e => onClick(st, e));
    ctx.on('daily', type => onDaily(st, type));
    ctx.timer(() => tickCountdown(el.querySelector('.c-cd-host'), {animate: ctx.visible}), 20000);
    if (ready()) patchPill(st, false);
    else if (daily.status !== 'error') daily.ensure().catch(() => {});
    if (ctx.first) ui.stagger(el);
  },

  onShow(ctx) {
    const st = HUB.get(ctx);
    if (!st) return;
    st.pending = false;
    if (ready()) sync(st, true);
  },

  update(ctx) {
    const st = HUB.get(ctx);
    if (!st) return;
    patchYou(st);
    if (ctx.reason === 'data') patchRotd(st, ctx.visible);
    if (st.board) st.board.refresh({animate: false});
  },

  unmount(el, ctx) {
    const st = HUB.get(ctx);
    if (!st) return;
    if (st.cancelRing) st.cancelRing();
    if (st.board) st.board.destroy();
    HUB.delete(ctx);
  }
};
