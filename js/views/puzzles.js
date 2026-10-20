// Daily Games tab (tab id 'puzzles'; tabs-v4 contract §3, replaces the Today hub). Two kinds of screen:
// - The tab root, /puzzles: the large title (the date, "Daily Games", the streak pill and your avatar button from
//   you.js), then the list of games (views/games.js: one big card per game, each turning into that game's scoreboard
//   once it's played today).
// - A game's own page, pushed over it (params.game): /puzzles/daily is Daily Puzzles' hero card and the league
//   leaderboard; /puzzles/17-0, /puzzles/drill, /puzzles/kick and /puzzles/return hold the pane modules
//   views/seventeen.js, views/drill.js, views/kick.js and views/return.js, each imported the first time its page opens.
// The Daily Puzzles hero has three states: not started ("Play"), started ("Continue", a thin progress bar with one
// segment per puzzle, "1 of 3 done") and finished (the score ring, the grade, "See results" and "Share", the midnight
// countdown). Play opens the run cover at the first unfinished puzzle. Works for every day version (three puzzles on
// v1 and v4 days, five on v2 and v3): everything is driven by daily.STEPS.
// Also exports badge() for the tab bar: today's puzzles aren't finished (and a 'gg:badge' event when that changes).
// Owner: PUZZLES (tabs-v4).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {mountBoard, streakPillHTML, stepParts, zeroParts, gradeGold, stepIcon, whenVisible, countdownHTML,
  msToMidnight, ensureDefs, ringHTML, maxPts, dayLabel} from './board.js';
import {youButtonHTML, settingsButtonHTML, openStreakSheet} from './you.js';
import {canTest, testRowHTML} from './testplay.js';
import {GAMES, gameOpen, gamePath, dailyKind, progHTML, fracOf, perfectOf, doneCount, listHTML, mountList} from './games.js';

const esc = data.esc;
const nf = n => data.nf(n);
const COPIED = 'Results copied. Paste them in the league chat.';

// Module memory for this page session: what the hero last showed, so its count-up and the streak roll start there.
const shown = {pnum: 0, total: 0, parts: null, streak: null};
const HUB = new WeakMap(); // ctx → hub state

const localLabel = () => new Date().toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'});
const ready = () => daily.status === 'ready' && !!daily.DAY;
const READY_KINDS = new Set(['new', 'started', 'done']);
const heroKind = dailyKind; // 'error' | 'loading' | 'new' | 'started' | 'played' | 'done' (views/games.js)

// ============================================================================ Tab badge
/** True while today's puzzles aren't all finished. Never loads anything: before puzzles.json is in it reads what
 *  this phone last showed today (the tab bar's gg-ring cache: {date, parts, left}), else no dot. */
export function badge() {
  try {
    if (ready()) {
      // The day moved on while the app was open: today's puzzles are waiting (a dev ?day= preview is pinned).
      if (daily.DEV_DAY == null && daily.dateOf(daily.PNUM).toDateString() !== new Date().toDateString()) return true;
      return !daily.allDone();
    }
    const v = JSON.parse(ui.lsGet('gg-ring') || 'null');
    return !!(v && v.date === new Date().toDateString() && v.left > 0);
  } catch (_) { return false; }
}
let lastBadge = null;
function emitBadge() {
  const b = badge();
  if (b === lastBadge) return;
  lastBadge = b;
  try { document.dispatchEvent(new CustomEvent('gg:badge', {bubbles: true, detail: {tab: 'puzzles', on: b}})); } catch (_) {}
}
// Module level, so the badge follows the puzzles whichever screen is showing.
daily.subscribe(type => { if (type === 'ready' || type === 'progress' || type === 'newday' || type === 'error') emitBadge(); });

// ============================================================================ Markup: title
function pillState() {
  if (!ready()) return null;
  const s = daily.streakLocal();
  return (!s.current && !s.best) ? null : s;
}
const pillSig = s => (s ? [s.current, s.best, s.atRisk].join('|') : '');
function trailHTML() {
  const s = pillState();
  return `<span class="c-spill-slot" data-sig="${pillSig(s)}">${s ? streakPillHTML(s, {attrs: 'data-streak'}) : ''}</span>`
    // The gear (Settings) and your avatar button: app.js opens the sheets on [data-settings] / [data-you].
    + settingsButtonHTML() + youButtonHTML();
}

// ============================================================================ Markup: hero
const lineText = () => 'Daily Puzzles';
function typesHTML() {
  const S = daily.STEPS;
  const label = `Today: ${daily.andList(S.map(s => s.label))}`;
  return `<div class="c-hero-types" role="img" aria-label="${esc(label)}">`
    + S.map((s, i) => `<span class="c-hero-ti${s.done() ? ' is-done' : ''}" data-i="${i}">${ui.icon(stepIcon(i), {size: 18})}</span>`).join('')
    + `</div>`;
}
/** The finished score: ring + total at what this session last showed (sync() then animates to the live values),
 *  and the grade word. */
function scoreHTML() {
  const pnum = daily.PNUM;
  const fresh = shown.pnum === pnum && shown.parts && shown.parts.length === daily.STEPS.length;
  const parts = fresh ? shown.parts : (ui.RM ? stepParts() : zeroParts());
  const total = fresh ? shown.total : (ui.RM ? daily.totalPts() : 0);
  const live = daily.totalPts(), max = nf(maxPts());
  const grade = daily.gradeFor(live), gold = gradeGold(grade);
  const ring = ringHTML(parts, {
    size: 168, stroke: 12,
    center: `<span class="n2 c-hero-total">${esc(nf(total))}</span><span class="c-hero-of">of ${esc(max)}</span>`,
    label: `Today: ${nf(live)} of ${max} points`, cls: 'c-hero-ring'
  });
  return `<div class="c-hero-ringw">${ring}</div>`
    + `<p class="ovl c-hero-grade${gold ? ' is-gold' : ''}">${gold ? ui.icon('trophy', {size: 16}) : ''}<span>${esc(grade)}</span></p>`;
}
function topHTML(k) {
  if (k === 'done') return scoreHTML();
  return `<p class="c-hero-line">${esc(lineText())}</p>${typesHTML()}`;
}
const CTA = {new: 'Play', started: 'Continue', done: 'See results'};
function ctaInner(k) {
  return `${k === 'done' ? '' : ui.icon('play-fill', {cls: 'c-cta-ic'})}<span class="btn-label">${esc(CTA[k])}</span>`;
}
const ctaHTML = k => `<button type="button" class="btn btn-primary c-hero-cta${k === 'done' ? '' : ' is-big'}" data-cta>${ctaInner(k)}</button>`;
const shareHTML = () => `<button type="button" class="btn btn-secondary c-hero-share" data-share>${ui.icon('share')}<span class="btn-label">Share</span></button>`;
const ovlText = () => `${daily.TEST ? 'Test play · ' : ''}${dayLabel()} · ${nf(maxPts())} points`;
const ovlHTML = () => `<p class="card-ovl c-hero-o" id="c-hero-o">${esc(ovlText())}</p>`;

function readyCard(k) {
  return `<section class="card card-hero c-hero is-${k}" data-kind="${k}" aria-labelledby="c-hero-o">`
    + ovlHTML()
    + `<div class="c-hero-top">${topHTML(k)}</div>`
    + `<div class="c-hero-ctas">${ctaHTML(k)}${k === 'done' ? shareHTML() : ''}</div>`
    + `<div class="c-hero-prog">${k === 'started' ? progHTML() : ''}</div>`
    // The countdown shows once the day is finished; the "New puzzles are here" banner in any state (timer tick).
    + `<div class="c-cd-host" data-k="${k === 'done' ? 'cd' : ''}">${k === 'done' ? countdownHTML(false) : ''}</div>`
    + `</section>`;
}
// Puzzle icons before puzzles.json arrives: as many as this phone showed today (the tab bar's gg-ring cache, same
// local date), else the count the calendar implies (three through Sep 28 2026, five on Sep 29 and 30, three from
// Oct 1), so the card does not jump.
function loadingCount() {
  try {
    const v = JSON.parse(ui.lsGet('gg-ring') || 'null');
    if (v && v.date === new Date().toDateString() && Array.isArray(v.parts) && (v.parts.length === 3 || v.parts.length === 5)) return v.parts.length;
  } catch (_) {}
  const now = new Date();
  return now >= new Date(2026, 8, 29) && now < new Date(2026, 9, 1) ? 5 : 3;
}
function loadingCard() {
  const dots = '<span class="sk c-hero-ti"></span>'.repeat(loadingCount());
  return `<section class="card card-hero c-hero is-loading" data-kind="loading" aria-busy="true">`
    + `<p class="c-hero-o" aria-hidden="true"><span class="sk sk-line c-sk-ovl"></span></p>`
    + `<div class="c-hero-top" aria-hidden="true"><span class="sk sk-line c-sk-line"></span><div class="c-hero-types">${dots}</div></div>`
    + `<div class="c-hero-ctas">${ui.button({label: 'Loading puzzles', kind: 'primary', disabled: true, cls: 'c-hero-cta is-big'})}</div>`
    + `</section>`;
}
function errorCard() {
  return `<section class="card card-hero c-hero is-error" data-kind="error">${ui.empty({icon: 'football', title: 'Puzzles need a connection the first time.', body: 'League history works offline.', action: {label: 'Try again', attrs: {'data-retry': ''}}})}</section>`;
}
// Today's score is already on the board under this member's name (another phone, or this one before its progress
// was lost): one attempt a day, so no Play button, just the score that counts.
function playedCard() {
  const e = daily.playedElsewhere() || {};
  return `<section class="card card-hero c-hero is-played" data-kind="played" aria-labelledby="c-hero-o">`
    + ovlHTML()
    + `<div class="c-hero-top"><p class="n2 c-hero-total">${esc(nf(Number(e.p) || 0))}</p></div>`
    + `<div class="c-cd-host" data-k="cd">${countdownHTML(false)}</div>`
    + `</section>`;
}
function cardHTML(k = heroKind()) {
  if (k === 'error') return errorCard();
  if (k === 'played') return playedCard();
  if (k === 'loading') return loadingCard();
  return readyCard(k);
}

// ============================================================================ Game pages
/** The game a page shows ('puzzles', '17-0', 'drill', 'kick', 'return'), or null on the list (the tab root). Every game
 *  is everyone's (games.js gameOpen: Kick It opened to the league Oct 2026, Return Man too, in beta); a game the owner
 *  keeps to himself would show anyone else the list. */
export function gameFor(g, who) {
  return GAMES.some(x => x.id === g) && gameOpen(g, who) ? g : null;
}
const gameOf = ctx => gameFor(ctx && ctx.params && ctx.params.game);
let SV = null; // views/seventeen.js, once imported
const loadSV = () => (SV ? Promise.resolve(SV) : import('./seventeen.js').then(m => (SV = m)));
const svLoading = () => `<div class="sv-loading" aria-busy="true">${ui.skeleton('rows', 4, {label: 'Loading 17\u20130.'})}</div>`;
// A phone that has played 17-0 sends its seasons to the league scoreboard (and the lineups of the ones it sent before
// lineups were kept) from any visit to this tab, not only once the 17-0 pane opens: core/seventeen.js posts on each
// board snapshot once it is loaded.
let svSynced = false;
function syncSeventeen() {
  if (svSynced) return;
  svSynced = true;
  import('../core/seventeen.js')
    .then(sv => (sv.totals().played ? sv.load().then(() => sv.autoPost()) : null))
    .catch(() => { svSynced = false; });
}

/** The 17-0 pane: imported and mounted the first time it shows; later shows only sync its board to the route. */
function showSV(st) {
  const pane = st.el.querySelector('.c-sv-pane');
  if (!pane) return;
  if (st.sv === 'on') { SV.params(pane, st.ctx); return; }
  if (st.sv === 'loading') return;
  st.sv = 'loading';
  if (!pane.firstElementChild) pane.innerHTML = svLoading();
  loadSV().then(() => {
    if (HUB.get(st.ctx) !== st) return;
    pane.innerHTML = SV.render(st.ctx);
    SV.mount(pane, st.ctx, {});
    ui.hydrate(pane);
    st.sv = 'on';
  }, err => {
    console.error(err);
    if (HUB.get(st.ctx) !== st) return;
    st.sv = null;
    pane.innerHTML = ui.empty({icon: 'football', title: '17\u20130 didn\u2019t load.', action: {label: 'Try again', attrs: {'data-sv-load': ''}}});
    ui.hydrate(pane);
  });
}
let DR = null; // views/drill.js, once imported
const loadDR = () => (DR ? Promise.resolve(DR) : import('./drill.js').then(m => (DR = m)));
const drLoading = () => `<div class="dr-loading" aria-busy="true">${ui.skeleton('rows', 4, {label: 'Loading the Two-Minute Drill.'})}</div>`;
// Like 17-0: a phone with a finished game posts it from any visit to this tab.
let drSynced = false;
function syncDrill() {
  if (drSynced) return;
  drSynced = true;
  import('../core/drill.js')
    .then(m => (m.totals().played ? m.load().then(() => m.autoPost()) : null))
    .catch(() => { drSynced = false; });
}
/** The Two-Minute Drill pane: like showSV. */
function showDR(st) {
  const pane = st.el.querySelector('.c-dr-pane');
  if (!pane) return;
  if (st.dr === 'on') { DR.params(pane, st.ctx); return; }
  if (st.dr === 'loading') return;
  st.dr = 'loading';
  if (!pane.firstElementChild) pane.innerHTML = drLoading();
  loadDR().then(() => {
    if (HUB.get(st.ctx) !== st) return;
    pane.innerHTML = DR.render(st.ctx);
    DR.mount(pane, st.ctx, {});
    ui.hydrate(pane);
    st.dr = 'on';
  }, err => {
    console.error(err);
    if (HUB.get(st.ctx) !== st) return;
    st.dr = null;
    pane.innerHTML = ui.empty({icon: 'football', title: 'The Two-Minute Drill didn\u2019t load.', action: {label: 'Try again', attrs: {'data-dr-load': ''}}});
    ui.hydrate(pane);
  });
}
let KK = null; // views/kick.js, once imported
const loadKK = () => (KK ? Promise.resolve(KK) : import('./kick.js').then(m => (KK = m)));
const kkLoading = () => `<div class="kk-loading" aria-busy="true">${ui.skeleton('rows', 4, {label: 'Loading Kick It.'})}</div>`;
// Like the others: a phone with a finished run posts it from any visit to this tab.
let kkSynced = false;
function syncKick() {
  if (kkSynced) return;
  kkSynced = true;
  import('../core/kick.js')
    .then(m => (m.totals().played ? m.autoPost() : null))
    .catch(() => { kkSynced = false; });
}
/** The Kick It pane: like showSV. */
function showKK(st) {
  const pane = st.el.querySelector('.c-kk-pane');
  if (!pane) return;
  if (st.kk === 'on') { KK.params(pane, st.ctx); return; }
  if (st.kk === 'loading') return;
  st.kk = 'loading';
  if (!pane.firstElementChild) pane.innerHTML = kkLoading();
  loadKK().then(() => {
    if (HUB.get(st.ctx) !== st) return;
    pane.innerHTML = KK.render(st.ctx);
    KK.mount(pane, st.ctx);
    ui.hydrate(pane);
    st.kk = 'on';
  }, err => {
    console.error(err);
    if (HUB.get(st.ctx) !== st) return;
    st.kk = null;
    pane.innerHTML = ui.empty({icon: 'football', title: 'Kick It didn\u2019t load.', action: {label: 'Try again', attrs: {'data-kk-load': ''}}});
    ui.hydrate(pane);
  });
}
let RM = null; // views/return.js, once imported
const loadRM = () => (RM ? Promise.resolve(RM) : import('./return.js').then(m => (RM = m)));
const rmLoading = () => `<div class="rm-loading" aria-busy="true">${ui.skeleton('rows', 4, {label: 'Loading Return Man.'})}</div>`;
// Like the others: a phone with a finished day posts it from any visit to this tab.
let rmSynced = false;
function syncReturn() {
  if (rmSynced || !gameOpen('return')) return;
  rmSynced = true;
  import('../core/return.js')
    .then(m => (m.totals().played ? m.autoPost() : null))
    .catch(() => { rmSynced = false; });
}
/** The Return Man pane: like showSV. */
function showRM(st) {
  const pane = st.el.querySelector('.c-rm-pane');
  if (!pane) return;
  if (st.rm === 'on') { RM.params(pane, st.ctx); return; }
  if (st.rm === 'loading') return;
  st.rm = 'loading';
  if (!pane.firstElementChild) pane.innerHTML = rmLoading();
  loadRM().then(() => {
    if (HUB.get(st.ctx) !== st) return;
    pane.innerHTML = RM.render(st.ctx);
    RM.mount(pane, st.ctx);
    ui.hydrate(pane);
    st.rm = 'on';
  }, err => {
    console.error(err);
    if (HUB.get(st.ctx) !== st) return;
    st.rm = null;
    pane.innerHTML = ui.empty({icon: 'football', title: 'Return Man didn\u2019t load.', action: {label: 'Try again', attrs: {'data-rm-load': ''}}});
    ui.hydrate(pane);
  });
}

// ============================================================================ Patching
function sameParts(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((p, i) => p.frac === b[i].frac && !!p.perfect === !!b[i].perfect && !!p.doneZero === !!b[i].doneZero);
}
function focusQuiet(el) {
  if (!el) return;
  if (!el.matches('button, a[href], input, [tabindex]')) el.setAttribute('tabindex', '-1');
  try { el.focus({preventScroll: true}); } catch (_) {}
}

/** Brings the hero up to date. Between the three ready states the card morphs in place and keeps its primary button
 *  (the element that opened the cover gets focus back on dismiss); loading and error states rebuild the card. */
function sync(st, animate = true) {
  const wrap = st.el.querySelector('.c-hero-wrap');
  const card = wrap && wrap.querySelector('.c-hero');
  if (!card) return;
  const k = heroKind(), old = card.dataset.kind;
  const anim = animate && !ui.RM && st.ctx.visible;
  if (old !== k && !(READY_KINDS.has(old) && READY_KINDS.has(k))) {
    const hadFocus = wrap.contains(document.activeElement);
    const go = () => { wrap.innerHTML = cardHTML(k); ui.hydrate(wrap); };
    if (anim && old !== 'loading') ui.crossfade(wrap, go, {duration: 200}); else go();
    if (anim && old === 'loading') ui.animate(wrap, [{opacity: .4}, {opacity: 1}], {duration: 240, easing: 'linear'});
    if (hadFocus) focusQuiet(wrap.querySelector('[data-cta]:not(:disabled), [data-retry]') || wrap.querySelector('.c-hero'));
  } else if (old !== k) {
    const go = () => morph(card, k);
    if (anim) ui.crossfade(card, go, {duration: 200}); else go();
  } else if (k === 'started') {
    patchProgress(card, anim);
  }
  if (k === 'done') syncScore(st, animate);
  tickCd(st, anim);
  patchPill(st, animate);
}

function morph(card, k) {
  card.dataset.kind = k;
  card.className = `card card-hero c-hero is-${k}`;
  card.querySelector('.c-hero-top').innerHTML = topHTML(k);
  const cta = card.querySelector('[data-cta]');
  cta.innerHTML = ctaInner(k);
  cta.classList.toggle('is-big', k !== 'done');
  const share = card.querySelector('[data-share]');
  if (k === 'done' && !share) cta.insertAdjacentHTML('afterend', shareHTML());
  if (k !== 'done' && share) share.remove();
  card.querySelector('.c-hero-prog').innerHTML = k === 'started' ? progHTML() : '';
  ui.hydrate(card);
}

function patchProgress(card, anim) {
  const S = daily.STEPS;
  card.querySelectorAll('.c-prog-f').forEach((b, i) => {
    if (!S[i]) return;
    const tf = `scaleX(${fracOf(i)})`;
    if (b.style.transform !== tf) b.style.transform = tf;
    b.classList.toggle('is-perfect', perfectOf(i));
  });
  card.querySelectorAll('.c-hero-ti[data-i]').forEach(t => {
    const i = +t.dataset.i, d = !!(S[i] && S[i].done());
    if (t.classList.contains('is-done') === d) return;
    t.classList.toggle('is-done', d);
    if (d && anim) ui.stamp(t, {from: .6});
  });
  const txt = card.querySelector('.c-prog-t'), v = `${doneCount()} of ${S.length} done`;
  if (txt && txt.textContent !== v) {
    txt.textContent = v;
    if (anim) ui.animate(txt, [{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: 240, easing: 'cubic-bezier(.22,1,.36,1)'});
  }
}

// The finished ring and total count up from what was last shown (once per change, when the ring is on screen).
function syncScore(st, animate) {
  const card = st.el.querySelector('.c-hero.is-done');
  if (!card) return;
  const ring = card.querySelector('.ring'), tot = card.querySelector('.c-hero-total');
  const parts = stepParts(), total = daily.totalPts(), max = nf(maxPts());
  if (ring) ring.setAttribute('aria-label', `Today: ${nf(total)} of ${max} points`);
  const g = card.querySelector('.c-hero-grade');
  const grade = daily.gradeFor(total);
  if (g && g.textContent !== grade) {
    g.classList.toggle('is-gold', gradeGold(grade));
    g.innerHTML = `${gradeGold(grade) ? ui.icon('trophy', {size: 16}) : ''}<span>${esc(grade)}</span>`;
  }
  const same = shown.pnum === daily.PNUM && shown.total === total && sameParts(shown.parts, parts);
  shown.pnum = daily.PNUM; shown.total = total; shown.parts = parts;
  if (same || !ring || !tot) return;
  if (st.cancelRing) { st.cancelRing(); st.cancelRing = null; }
  const from = Number(String(tot.textContent).replace(/[^\d]/g, '')) || 0;
  if (!animate || ui.RM) {
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

// Countdown host: "New puzzles in 4h 46m" once the day is finished; "New puzzles are here · Load" in any state once
// the local day changed (a dev ?day= preview never changes day).
function newDay() { try { return ready() && daily.checkDay(); } catch (_) { return false; } }
function tickCd(st, animate) {
  const host = st.el.querySelector('.c-hero .c-cd-host');
  if (!host) return;
  const k = newDay() ? 'new' : (heroKind() === 'done' || heroKind() === 'played') ? 'cd' : '';
  if (host.dataset.k !== k) {
    host.dataset.k = k;
    host.innerHTML = k ? countdownHTML(k === 'new') : '';
    const b = host.querySelector('.c-cd-new');
    if (b && animate && !ui.RM) ui.animate(b, [{opacity: 0, transform: 'scale(.94)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy'});
    return;
  }
  if (k !== 'cd') return;
  const v = host.querySelector('.c-cd-v'), t = ui.untilText(msToMidnight());
  if (v && v.textContent !== t) v.textContent = t;
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

function patchEyebrow(st) {
  const e = st.el.querySelector('.lt-eyebrow');
  const t = ready() ? daily.TODAY_LABEL : localLabel();
  if (e && t && e.textContent !== t) e.textContent = t;
}

// ============================================================================ Events
function onClick(st, e) {
  if (st.game === null && onListClick(st, e)) return;
  // The 17-0 pane handles its own taps (views/seventeen.js), all but "Try again" after its import failed.
  const load = e.target.closest('[data-sv-load]');
  if (load) { showSV(st); return; }
  if (e.target.closest('[data-dr-load]')) { showDR(st); return; }
  if (e.target.closest('[data-kk-load]')) { showKK(st); return; }
  if (e.target.closest('[data-rm-load]')) { showRM(st); return; }
  if (e.target.closest('.c-sv-pane, .c-dr-pane, .c-kk-pane, .c-rm-pane')) return;
  const t = e.target.closest('[data-cta], [data-share], [data-streak], [data-retry], [data-cd-load], [data-pz-test]');
  if (!t || !st.el.contains(t)) return;
  const {ctx} = st;
  if (t.hasAttribute('data-cta')) { playPuzzles(ctx); return; }
  if (t.hasAttribute('data-share')) {
    if (!ready()) return;
    // ui.share runs synchronously inside the tap (iOS user activation); without a share sheet it copies.
    ui.share({text: daily.shareText()}).then(r => {
      if (r === 'copied') { ui.toast(COPIED, {icon: 'check-circle'}); ui.haptic('success'); }
      else if (r === 'unavailable') ui.toast("Couldn't copy the results.", {action: {label: 'See results', fn: () => ctx.nav('/puzzles/results')}});
    });
    return;
  }
  if (t.hasAttribute('data-streak')) { openStreakSheet(); return; }
  if (t.hasAttribute('data-pz-test')) { testPlay(st, t.dataset.pzTest === 'on'); return; }
  if (t.hasAttribute('data-retry')) { retry(st); return; }
  if (t.hasAttribute('data-cd-load')) location.reload();
}

/** Daily Puzzles' Play / Continue: the run cover at the first unfinished puzzle; finished: the results cover. */
function playPuzzles(ctx) {
  if (!ready()) return;
  ctx.nav(daily.allDone() ? '/puzzles/results' : '/puzzles/play/' + daily.slug(daily.firstOpen()));
}
/** The list's taps (true when handled): Play on a card opens that game (Daily Puzzles straight into the run), a
 *  finished card's buttons open its results or page, and a tap anywhere else on a card opens the game's page. */
function onListClick(st, e) {
  const {ctx} = st;
  const play = e.target.closest('[data-gm-play]');
  if (play) {
    ui.haptic('light');
    if (play.dataset.gmPlay === 'puzzles' && ready()) playPuzzles(ctx); else ctx.nav(gamePath(play.dataset.gmPlay));
    return true;
  }
  const open = e.target.closest('[data-gm-open]');
  if (open) { ctx.nav(gamePath(open.dataset.gmOpen)); return true; }
  if (e.target.closest('[data-gm-results]')) { if (ready()) ctx.nav('/puzzles/results'); return true; }
  if (e.target.closest('[data-gm-retry]')) {
    daily.ensure().catch(() => ui.toast("Still can't reach the puzzles.")).finally(() => { if (st.list) st.list.refresh(true); });
    return true;
  }
  // (the cases on the shelf are the shelf's own: games.js mountList)
  return false;
}

/** The owner's Test play (views/testplay.js): today's puzzles fresh in the sandbox (never posted, never counted toward
 *  the streak), or back to the real day's progress as it was. */
function testPlay(st, on) {
  if (!ready() || !canTest()) return;
  daily.setTest(on);
  patchTest(st);
  ui.haptic('medium');
  ui.announce(on ? 'Test play: today’s puzzles, fresh. It won’t count.' : 'Test play over: back to your real puzzles.');
}
function patchTest(st) {
  const h = st.el.querySelector('[data-pz-tp]'), o = st.el.querySelector('#c-hero-o');
  if (o && ready() && o.textContent !== ovlText()) o.textContent = ovlText();
  if (!h) return;
  const html = ready() ? testRowHTML(daily.TEST, 'data-pz-test') : '';
  if (h.dataset.sig === html) return;
  h.dataset.sig = html;
  h.innerHTML = html;
  ui.hydrate(h);
}

// "Try again": the loading card stays up at least RETRY_HOLD so the tap visibly does something (offline, the
// fetch fails within a frame); a second failure says so. Focus follows to the new card's button.
const RETRY_HOLD = 600;
function retry(st) {
  const wrap = st.el.querySelector('.c-hero-wrap');
  if (!wrap || st.retrying) return;
  st.retrying = true;
  const hadFocus = wrap.contains(document.activeElement);
  const go = () => { wrap.innerHTML = loadingCard(); };
  if (!ui.RM && st.ctx.visible) ui.crossfade(wrap, go, {duration: 160}); else go();
  if (hadFocus) focusQuiet(wrap.querySelector('.c-hero')); else ui.announce('Loading puzzles.');
  Promise.allSettled([daily.ensure(), new Promise(r => setTimeout(r, RETRY_HOLD))]).then(() => {
    st.retrying = false;
    if (HUB.get(st.ctx) !== st) return;
    patchEyebrow(st);
    sync(st, st.ctx.visible);
    if (daily.status === 'error') ui.toast("Still can't reach the puzzles.");
    if (hadFocus) focusQuiet(wrap.querySelector('[data-retry], [data-cta]'));
  });
}

function onDaily(st, type) {
  if (st.game === null) {
    // The list: its cards follow the day and the board; the title's date and streak pill too.
    if (type === 'ready' || type === 'error') patchEyebrow(st);
    if (!st.ctx.visible) { st.pending = true; return; }
    if (st.list) st.list.refresh(type !== 'ready');
    patchPill(st, true);
    return;
  }
  if (st.game !== 'puzzles') return;
  if (type === 'ready' || type === 'error') {
    if (st.retrying) return;
    patchEyebrow(st);
    sync(st, st.ctx.visible);
    patchTest(st);
    return;
  }
  if (type === 'progress' || type === 'lb') { if (st.ctx.visible) sync(st, true); else st.pending = true; return; }
  if (type === 'newday') tickCd(st, st.ctx.visible);
}

// ============================================================================ View
export default {
  id: 'puzzles',
  chrome: 'nav',
  // The list is Daily Games; a game's page is named for its game (its back button reads "Daily Games").
  title: ctx => { const g = gameOf(ctx); return g ? GAMES.find(x => x.id === g).title : 'Daily Games'; },

  render(ctx) {
    const g = gameOf(ctx);
    if (g === null) {
      return ui.largeTitle({eyebrow: ready() ? daily.TODAY_LABEL : localLabel(), title: 'Daily Games', trailing: trailHTML()})
        + listHTML();
    }
    if (g === 'puzzles') {
      return `<div class="c-pz-pane">`
        + `<div class="c-hero-wrap" data-key="hero" data-enter>${cardHTML()}</div>`
        + `<div class="c-board-host" data-key="board" data-enter></div>`
        // the owner's Test play row at the bottom (views/testplay.js)
        + `<div class="c-tp-host" data-pz-tp>${ready() ? testRowHTML(daily.TEST, 'data-pz-test') : ''}</div></div>`;
    }
    if (g === '17-0') return `<div class="c-sv-pane sv-pane">${SV ? SV.render(ctx) : svLoading()}</div>`;
    if (g === 'drill') return `<div class="c-dr-pane dr-pane">${DR ? DR.render(ctx) : drLoading()}</div>`;
    if (g === 'return') return `<div class="c-rm-pane rm-pane">${RM ? RM.render(ctx) : rmLoading()}</div>`;
    return `<div class="c-kk-pane kk-pane">${KK ? KK.render(ctx) : kkLoading()}</div>`;
  },

  mount(el, ctx) {
    ensureDefs();
    const st = {el, ctx, board: null, list: null, pending: false, cancelRing: null, retrying: false, game: gameOf(ctx), sv: null, dr: null, kk: null, rm: null};
    HUB.set(ctx, st);
    el.addEventListener('click', e => onClick(st, e));
    if (st.game === null) {
      st.list = mountList(el.querySelector('.gm-list'), ctx, {play: id => (id === 'puzzles' && ready() ? playPuzzles(ctx) : ctx.nav(gamePath(id)))});
      ctx.setBackTitle('Games'); // a game page's back button: short, so its title has the room
      // A phone with a finished game posts it from any visit to this tab.
      ui.whenIdle(syncSeventeen);
      ui.whenIdle(syncDrill);
      ui.whenIdle(syncKick);
      ui.whenIdle(syncReturn);
      ctx.on('daily', type => onDaily(st, type));
      ctx.timer(() => { st.list.tick(); st.list.refresh(false); }, 20000);
      if (ready()) patchPill(st, false);
      else if (daily.status !== 'error') daily.ensure().catch(() => {});
      emitBadge();
      if (ctx.first) ui.stagger(el);
      return;
    }
    if (st.game === 'puzzles') {
      st.board = mountBoard(el.querySelector('.c-board-host'), {mode: 'today', ctx});
      ctx.on('daily', type => onDaily(st, type));
      ctx.timer(() => tickCd(st, ctx.visible), 20000);
      if (ready()) sync(st, false);
      else if (daily.status !== 'error') daily.ensure().catch(() => {});
      return;
    }
    if (st.game === '17-0') showSV(st);
    else if (st.game === 'drill') showDR(st);
    else if (st.game === 'return') showRM(st);
    else showKK(st);
  },

  onShow(ctx) {
    const st = HUB.get(ctx);
    if (!st) return;
    st.pending = false;
    // Back on the list from a game's page: its card catches up (a game just finished turns into its scoreboard).
    if (st.game === null) { if (st.list) st.list.refresh(true); patchPill(st, true); return; }
    if (st.game === 'puzzles' && ready()) sync(st, true);
  },

  update(ctx) {
    const st = HUB.get(ctx);
    if (!st) return;
    if (st.game === null) { if (st.list) st.list.refresh(false); return; }
    if (st.game === 'puzzles') { if (ctx.reason !== 'params' && st.board) st.board.refresh({animate: false}); return; }
    if (st.game === '17-0') showSV(st);
    else if (st.game === 'drill') showDR(st);
    else if (st.game === 'return') showRM(st);
    else showKK(st);
  },

  unmount(el, ctx) {
    const st = HUB.get(ctx);
    if (!st) return;
    if (st.list) st.list.destroy();
    if (st.cancelRing) st.cancelRing();
    if (st.board) st.board.destroy();
    if (st.sv === 'on' && SV) SV.unmount(el.querySelector('.c-sv-pane'), ctx);
    if (st.dr === 'on' && DR) DR.unmount(el.querySelector('.c-dr-pane'), ctx);
    if (st.kk === 'on' && KK) KK.unmount(el.querySelector('.c-kk-pane'), ctx);
    if (st.rm === 'on' && RM) RM.unmount(el.querySelector('.c-rm-pane'), ctx);
    HUB.delete(ctx);
  }
};
