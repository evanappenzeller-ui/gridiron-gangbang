// Today hub (spec 7.1): large title with the streak pill and You button, "Which one are you?" onboarding,
// the Daily card (three-arc ring, status line, CTA, puzzle rows), the league board, the midnight countdown
// and Record of the day. Renders history-independent content at once and the Daily once puzzles load.
// Owner: daily-hub package.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {mountBoard, streakPillHTML, stepParts, ZERO_PARTS, gradeTitle, PUZZLE_ICON, whenVisible,
  countdownHTML, tickCountdown, ensureDefs} from './board.js';
import {openYouSheet, openStreakSheet} from './you.js';

const esc = data.esc;
const nf = n => data.nf(n);
const SUBS = ['5 players · up to 200', '7 clues · up to 350', '9 squares · up to 450'];
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

function onbHTML() {
  const cells = data.ids.map(id => `<button type="button" class="c-onb-av" data-onb="${esc(id)}" aria-pressed="false">${ui.avatar(id, {size: 40})}<span class="c-onb-n">${esc(data.name(id))}</span></button>`).join('');
  return `<section class="card c-onb" data-key="onb" data-enter aria-labelledby="c-onb-t">
<h2 class="c-onb-t" id="c-onb-t">Which one are you?</h2>
<p class="c-onb-s">We'll highlight you across the app. Only saved on this phone.</p>
<div class="c-onb-rail" data-hscroll role="group" aria-label="Managers">${cells}</div>
<div class="c-onb-foot"><button type="button" class="btn btn-plain c-onb-skip" data-onb-skip>Skip</button></div>
</section>`;
}

function statusLine() {
  const S = daily.STEPS;
  if (daily.allDone()) return `Locked in. ${gradeTitle(daily.gradeFor(daily.totalPts()))}.`;
  if (!daily.anyStarted()) return 'Three puzzles. 1,000 points.';
  const open = S[daily.firstOpen()];
  let last = null;
  S.forEach(s => { if (s.done()) last = s; });
  return last ? `${last.label} done. ${open.label} is up.` : `${open.label} is up.`;
}
function ctaInfo() {
  if (daily.allDone()) return {label: 'See your results', path: '/today/results'};
  const i = daily.firstOpen();
  const path = '/today/play/' + daily.slug(i);
  if (!daily.anyStarted()) return {label: "Start today's three", path};
  return {label: `Resume · ${daily.STEPS[i].label}`, path};
}
function progressText(i) {
  const ds = daily.DS;
  if (i === 0) return `${ds.col.a.length} of 5`;
  if (i === 1) return `Clue ${ds.who.clues}`;
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
  return `${s.label}, ${SUBS[i].replace(' · ', ', ')} points, ${st}`;
}
function pzRowHTML(i) {
  const x = pzState(i);
  return `<button type="button" class="row c-pz" data-go="/today/play/${daily.slug(i)}" data-pz="${i}" data-sig="${esc(JSON.stringify(x))}" aria-label="${esc(pzLabel(i, x))}">`
    + `<span class="row-lead"><span class="c-pz-tile">${ui.icon(PUZZLE_ICON[i], {size: 22})}</span></span>`
    + `<span class="row-main"><span class="row-title">${esc(daily.STEPS[i].label)}</span><span class="row-sub">${esc(SUBS[i])}</span></span>`
    + `<span class="row-trail c-pz-trail">${pzTrail(x)}</span></button>`;
}

function readyCard() {
  const pnum = daily.PNUM;
  const fresh = shown.pnum === pnum && shown.parts;
  // The ring and total render at what this session last showed; onShow animates them to the live values.
  const parts = fresh ? shown.parts : (ui.RM ? stepParts() : ZERO_PARTS);
  const total = fresh ? shown.total : (ui.RM ? daily.totalPts() : 0);
  const cta = ctaInfo();
  const ring = ui.ring(parts, {
    center: `<span class="n2 c-dc-total">${esc(nf(total))}</span><span class="c-dc-of">of 1,000</span>`,
    label: `Today: ${nf(daily.totalPts())} of 1,000`, cls: 'c-dc-ring'
  });
  return `<section class="card card-hero c-dc is-ready" aria-labelledby="c-dc-o">
<div class="c-dc-top"><p class="card-ovl" id="c-dc-o">Daily #${esc(pnum)}</p></div>
<div class="c-dc-ringw">${ring}</div>
<p class="c-dc-status">${esc(statusLine())}</p>
${ui.button({label: cta.label, kind: 'primary', attrs: {'data-go': cta.path}, cls: 'c-dc-cta'})}
<div class="c-dc-rows">${[0, 1, 2].map(pzRowHTML).join('')}</div>
</section>`;
}
function loadingCard() {
  const rows = [0, 1, 2].map(i => `<div class="row c-pz c-pz-sk" aria-hidden="true"><span class="row-lead"><span class="sk c-sk-tile"></span></span><span class="row-main"><span class="sk sk-line" style="width:${[42, 58, 34][i]}%"></span><span class="sk sk-line c-sk-sub" style="width:${[56, 48, 60][i]}%"></span></span></div>`).join('');
  return `<section class="card card-hero c-dc is-loading" aria-busy="true">
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
  if (!a || !b) return false;
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
  if (ring) ring.setAttribute('aria-label', `Today: ${nf(total)} of 1,000`);
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

// Onboarding card: the tapped avatar pops, the card fades, and the cards below slide up (FLIP).
function removeOnb(st) {
  const card = st.el.querySelector('.c-onb');
  if (!card || data.meRaw() == null || card.dataset.leaving) return;
  card.dataset.leaving = '1';
  const id = st.onbTap;
  st.onbTap = null;
  const hadFocus = card.contains(document.activeElement);
  const after = () => { if (hadFocus) { try { st.ctx.screen.focus({preventScroll: true}); } catch (_) {} } };
  if (!st.ctx.visible || ui.RM) { card.remove(); after(); return; }
  const rel = st.ctx.busy();
  const btn = id && id !== 'none' ? card.querySelector(`[data-onb="${CSS.escape(id)}"]`) : null;
  let wait = 0;
  if (btn) {
    btn.setAttribute('aria-pressed', 'true');
    const av = btn.querySelector('.av');
    if (av) { av.classList.add('av-you'); ui.animate(av, [{transform: 'scale(.78)'}, {transform: 'none'}], {spring: 'bouncy'}); }
    wait = 360;
  }
  setTimeout(() => {
    const a = ui.animate(card, [{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'scale(.97)'}], {duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'});
    a.finished.catch(() => {}).then(() => ui.flip(st.el, () => card.remove(), {selector: ':scope > [data-key]'})).then(() => { rel(); after(); }, () => { rel(); after(); });
  }, wait);
}

// gg-me cleared (another tab, or storage wiped): ask again.
function restoreOnb(st) {
  if (data.meRaw() != null || st.el.querySelector('.c-onb')) return;
  const lt = st.el.querySelector('.lt');
  if (!lt) return;
  const t = document.createElement('template');
  t.innerHTML = onbHTML();
  const card = t.content.firstElementChild;
  ui.flip(st.el, () => lt.after(card), {selector: ':scope > [data-key]'});
}

// ============================================================================ Events
function onClick(st, e) {
  const t = e.target.closest('[data-go], [data-you], [data-streak], [data-onb], [data-onb-skip], [data-retry], [data-cd-load]');
  if (!t || !st.el.contains(t)) return;
  const {ctx} = st;
  if (t.hasAttribute('data-go')) { ctx.nav(t.dataset.go); return; }
  if (t.hasAttribute('data-you')) { openYouSheet(); return; }
  if (t.hasAttribute('data-streak')) { openStreakSheet(); return; }
  if (t.hasAttribute('data-onb')) {
    if (st.el.querySelector('.c-onb[data-leaving]')) return;
    st.onbTap = t.dataset.onb;
    ui.haptic('selection');
    data.setMe(t.dataset.onb);
    return;
  }
  if (t.hasAttribute('data-onb-skip')) { st.onbTap = 'none'; data.setMe('none'); return; }
  if (t.hasAttribute('data-retry')) {
    const wrap = st.el.querySelector('.c-dc-wrap');
    if (wrap) wrap.innerHTML = loadingCard();
    daily.ensure().catch(() => {});
    return;
  }
  if (t.hasAttribute('data-cd-load')) { location.reload(); }
}

function onDaily(st, type) {
  if (type === 'ready' || type === 'error') { swapDaily(st); return; }
  if (type === 'progress') { if (st.ctx.visible) sync(st, true); else st.pending = true; return; }
  if (type === 'newday') tickCountdown(st.el.querySelector('.c-cd-host'), {animate: st.ctx.visible});
}

// ============================================================================ View
export default {
  id: 'today',
  chrome: 'nav',
  title: 'Today',

  render() {
    const onb = data.meRaw() == null ? onbHTML() : '';
    const r = rotdPick();
    return ui.largeTitle({eyebrow: ready() ? daily.TODAY_LABEL : localLabel(), title: 'Today', trailing: trailHTML()})
      + onb
      + `<div class="c-dc-wrap" data-key="daily" data-enter>${dailyCardHTML()}</div>`
      + `<div class="c-board-host" data-key="board" data-enter></div>`
      + `<div class="c-cd-host" data-key="cd" data-enter>${countdownHTML()}</div>`
      + `<div class="c-rotd-host" data-key="rotd" data-enter data-sig="${esc(rotdSig(r))}">${rotdHTML(r)}</div>`;
  },

  mount(el, ctx) {
    ensureDefs();
    const st = {el, ctx, board: null, pending: false, cancelRing: null, onbTap: null};
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
    removeOnb(st);
    restoreOnb(st);
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
