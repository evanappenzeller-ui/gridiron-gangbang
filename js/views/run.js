// Puzzle run cover (route /puzzles/play/:puzzle; spec 7.2, tabs-v4 contract §4): its own top bar (close, the day and
// the points pill; under them big ‹ › arrows flanking the puzzle's title, "2 of 3" and one dot per puzzle), the
// puzzle header (the PROMPTS copy), the puzzle module and a sticky bottom bar (to the next unfinished puzzle, named by
// its destination: "Next: Grid ›", "‹ Finish College", "Skip to Grid"; or "See results"). The arrows move freely
// between the day's puzzles (no wrapping); so do a horizontal swipe
// on the bar or the header (never on the puzzle body) and the Left / Right keys. Switching puzzles is an in-place
// update with the direction-aware inner-swap motion. Owner: PUZZLES (tabs-v4; was the puzzle-run package).
//
// A v1 day has three puzzles (college, mystery, grid); v2 and v3 days five (college, silhouette, mystery, journey,
// grid; v3 days have one or two items in each); a v4 day three of the five (daily.SLUGS, in canonical order).
// The day's order comes from daily.SLUGS / daily.STEPS (live bindings); this view keys everything by slug.
//
// Puzzle modules (college.js, silhouette.js, mystery.js, journey.js, grid.js) export {render(ctx), mount(el, ctx, api)
// → instance}. render is pure (reads daily state only); mount wires one instance and returns {unmount()}.
// api = {refreshChrome(), busy(promise?), reveal(el), screen, ctx}.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import college from './college.js';
import silhouette from './silhouette.js';
import mystery from './mystery.js';
import journey from './journey.js';
import grid from './grid.js';
import plays from './plays.js';

const esc = data.esc;
const MODS = {college, silhouette, mystery, journey, grid, plays};
const SLUG_ID = {college: 'col', silhouette: 'sil', mystery: 'who', journey: 'jr', grid: 'grid', plays: 'play'};
// Labels before puzzles load (then daily.STEPS[i].label).
const SLUG_LABEL = {college: 'College', silhouette: 'Silhouettes', mystery: 'Mystery player', journey: 'Journey', grid: 'Grid', plays: 'Name the play'};
const EASE_IN = 'cubic-bezier(.4,0,1,1)', EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const PLAY = slug => '/puzzles/play/' + slug;

const ready = () => daily.status === 'ready' && !!daily.DAY && !!daily.DS && !!daily.DS.col;
const isSlug = s => Object.prototype.hasOwnProperty.call(MODS, s);
/** The route's slug, made canonical for the loaded day (a slug the day doesn't have, such as an old five-puzzle link
 *  on a three-puzzle day → its first unfinished puzzle, or its first when every one is finished). */
function slugOf(ctx) {
  const s = ctx && ctx.params && ctx.params.puzzle;
  const v = isSlug(s) ? s : 'college';
  return ready() && daily.stepOf(v) < 0 ? daily.slug(daily.firstOpen()) : v;
}
/** Slugs in play order: the day's (before puzzles load only the route's own puzzle is known). */
const order = slug => (ready() ? daily.SLUGS : [slug]);
const idxOf = slug => Math.max(0, order(slug).indexOf(slug));
const labelOf = slug => (ready() && daily.stepOf(slug) >= 0 ? daily.STEPS[daily.stepOf(slug)].label : SLUG_LABEL[slug] || '');
/** The puzzle next to slug (d = -1 / 1), or null at either end (no wrapping) and before puzzles load. */
const adjSlug = (slug, d) => (ready() ? daily.SLUGS[idxOf(slug) + d] || null : null);
/** Where "Next puzzle" goes from slug: the first unfinished puzzle after it (wrapping around), null when every other
 *  puzzle is finished (the button then reads "See results"). */
function nextSlug(slug) {
  if (!ready()) return null;
  const S = daily.STEPS, i = idxOf(slug), n = S.length;
  for (let k = 1; k < n; k++) { const j = (i + k) % n; if (!S[j].done()) return daily.slug(j); }
  return null;
}
const perfectOf = j => daily.STEPS[j].done() && daily.STEPS[j].pts() === daily.STEPS[j].max;

// Per screen state, keyed by ctx (a run screen can briefly coexist with another during a results swap).
const ST = new WeakMap();

// ---------------------------------------------------------------------------------------------- markup
function arrowState(d, slug) {
  const to = adjSlug(slug, d);
  const base = d < 0 ? 'Previous puzzle' : 'Next puzzle';
  return {label: to ? `${base}: ${labelOf(to)}` : base, off: !to};
}
function arrowHTML(d, slug) {
  const a = arrowState(d, slug);
  return `<button type="button" class="rn-arrow ${d < 0 ? 'rn-prev' : 'rn-fwd'}" data-rn-go="${d}" aria-label="${esc(a.label)}"${a.off ? ' aria-disabled="true"' : ''}>`
    + `${ui.icon(d < 0 ? 'chevron-left' : 'chevron-right')}</button>`;
}
/** "2 of 3", one dot per puzzle (finished: tint, gold when perfect; the current one wider) and the same for screen
 *  readers. Empty before puzzles load. */
function subHTML(slug) {
  if (!ready()) return '';
  const i = idxOf(slug), S = daily.STEPS, n = S.length, done = S.filter(s => s.done()).length;
  return `<span class="rn-count" aria-hidden="true">${i + 1} of ${n}</span>`
    + `<span class="rn-dots" aria-hidden="true">${S.map((s, j) => `<i class="${dotCls(j, i)}"></i>`).join('')}</span>`
    + `<span class="sr-only">${esc(`Puzzle ${i + 1} of ${n}, ${done} finished`)}</span>`;
}
const dotCls = (j, i) => `rn-dot${j === i ? ' is-cur' : ''}${daily.STEPS[j].done() ? ' is-done' : ''}${perfectOf(j) ? ' is-perfect' : ''}`;

function topHTML(slug) {
  const r = ready();
  const t = r ? daily.totalPts() : 0;
  return `<div class="rn-top" data-hscroll><div class="rn-bg bar" aria-hidden="true"></div>`
    + `<div class="rn-row">`
    + ui.iconButton({icon: 'close', label: 'Close puzzles', cls: 'rn-close', attrs: 'data-back'})
    + `<p class="rn-date" aria-hidden="true">${r ? esc(daily.dayLabel()) : ''}</p>`
    + `<span class="rn-pts${r ? '' : ' is-pending'}" role="img" aria-label="${esc(data.nf(t))} points"${r ? '' : ' aria-hidden="true"'}><span class="n5 rn-pn" aria-hidden="true">${esc(data.nf(t))}</span><span class="rn-pu" aria-hidden="true">pts</span></span>`
    + `</div>`
    + `<div class="rn-nav">${arrowHTML(-1, slug)}`
    + `<div class="rn-title"><p class="rn-t">${esc(labelOf(slug))}</p><p class="rn-sub">${subHTML(slug)}</p></div>`
    + `${arrowHTML(1, slug)}</div>`
    + `</div>`;
}

function skeletonHTML() {
  return `<div class="rn-sk">${ui.skeleton('lines', 1, {label: 'Loading puzzles.'})}${ui.skeleton('cards', 1)}<div class="rn-sk-grid">${'<span class="sk"></span>'.repeat(4)}</div></div>`;
}
function errorHTML() {
  return `<div class="rn-err">${ui.empty({icon: 'football', title: 'Puzzles need a connection the first time.', body: 'League history works offline.', action: {label: 'Try again', attrs: {'data-rn-retry': ''}}})}</div>`;
}

function pageHTML(slug, ctx) {
  const r = ready();
  const body = r ? MODS[slug].render(ctx) : skeletonHTML();
  // The title sits in the bar; the page keeps a heading for screen readers (before puzzles load: the name alone).
  const h = r ? `Puzzle ${idxOf(slug) + 1} of ${daily.STEPS.length}: ${labelOf(slug)}` : labelOf(slug);
  return `<section class="rn-page" data-page="${slug}" aria-labelledby="rn-h-${slug}" tabindex="-1">`
    + `<header class="rn-head"><h1 class="sr-only" id="rn-h-${slug}">${esc(h)}</h1>`
    + `<p class="rn-prompt t-sub">${esc(daily.PROMPTS[SLUG_ID[slug]] || '')}</p></header>`
    + `<div class="rn-body">${body}</div></section>`;
}

/** The bottom button, named by where it goes so it never reads like the › arrow (which only steps to the adjacent
 *  puzzle): "See results" when every other puzzle is finished; while this one is unfinished "Skip to Grid"; once it is
 *  finished "Next: Grid ›", or "‹ Finish College" when the first unfinished one is earlier. dir: the glyph's side. */
function nextInfo(slug) {
  const to = nextSlug(slug);
  if (!to) return {label: 'See results', aria: 'See results', dir: 0};
  const name = labelOf(to), back = idxOf(to) < idxOf(slug);
  const dir = back ? -1 : 1;
  if (!daily.STEPS[idxOf(slug)].done()) return {label: `Skip to ${name}`, aria: `Skip to ${name}`, dir};
  return back ? {label: `Finish ${name}`, aria: `Back to ${name}, not finished yet`, dir}
    : {label: `Next: ${name}`, aria: `Next puzzle: ${name}`, dir};
}
function nextInner(slug) {
  const n = nextInfo(slug);
  return (n.dir < 0 ? ui.icon('chevron-left', {cls: 'rn-next-ic is-back'}) : '')
    + `<span class="btn-label">${esc(n.label)}</span>`
    + (n.dir > 0 ? ui.icon('chevron-right', {cls: 'rn-next-ic'}) : '');
}
const nextAria = slug => nextInfo(slug).aria;
function bottomHTML(slug) {
  const r = ready();
  const done = r && daily.STEPS[idxOf(slug)].done();
  return `<div class="rn-bottom"${r ? '' : ' hidden'}><div class="rn-bg bar" aria-hidden="true"></div>`
    + `<button type="button" class="btn btn-${done ? 'primary' : 'secondary'} btn-block rn-next" data-rn-next aria-label="${esc(nextAria(slug))}">${nextInner(slug)}</button>`
    + `</div>`;
}

// ---------------------------------------------------------------------------------------------- behavior
function checkBars(st) {
  if (st.dead) return;
  const s = st.ctx.screen;
  st.top.classList.toggle('is-scrolled', s.scrollTop > 1);
  st.bottom.classList.toggle('is-over', s.scrollTop + s.clientHeight < s.scrollHeight - 1);
}

/** Scrolls the screen the least amount so el (or the union of several elements) sits between the two bars.
 *  When it does not fit, its top wins. */
function reveal(st, el, {smooth = true} = {}) {
  if (!el || st.dead) return;
  const els = (Array.isArray(el) ? el : [el]).filter(x => x && x.isConnected && !x.hidden);
  if (!els.length) return;
  const rs = els.map(x => x.getBoundingClientRect());
  const r = {top: Math.min(...rs.map(x => x.top)), bottom: Math.max(...rs.map(x => x.bottom))};
  const s = st.ctx.screen, sr = s.getBoundingClientRect();
  const lo = sr.top + st.top.offsetHeight + 8, hi = sr.bottom - st.bottom.offsetHeight - 8;
  let dy = 0;
  if (r.bottom > hi) dy = r.bottom - hi;
  if (r.top - dy < lo) dy = r.top - lo;
  // Never leave the page header (the prompt) sliced under the top bar: scroll past it completely when the target
  // still fits, else keep it whole.
  const head = st.stage.querySelector('.rn-page:not(.is-out) .rn-head');
  const edge = sr.top + st.top.offsetHeight;
  if (head && dy > 1) {
    const h = head.getBoundingClientRect();
    if (h.top - dy < edge && h.bottom - dy > edge) {
      const past = h.bottom - edge;
      if (r.top - past >= edge) dy = past;
      else dy = Math.max(0, h.top - edge);
    }
  }
  if (Math.abs(dy) > 1) s.scrollBy({top: dy, behavior: (smooth && !ui.RM) ? 'smooth' : 'auto'});
}

function setPts(st, animate) {
  const t = daily.totalPts();
  if (t === st.shown) return;
  const from = st.shown;
  st.shown = t;
  st.pill.setAttribute('aria-label', `${data.nf(t)} points`);
  if (animate && !ui.RM && t > from) {
    ui.countUp(st.pn, t, {from, duration: 700, format: 'int'});
    ui.animate(st.pill, [{transform: 'scale(1.1)'}, {transform: 'none'}], {spring: 'bouncy'});
  } else st.pn.textContent = data.nf(t);
}

/** Title, "2 of 3" and the dots: patched in place (a newly finished puzzle's dot pops), rebuilt when the count
 *  changes (the skeleton knew only the route's puzzle). */
function patchTitle(st, animate) {
  const t = labelOf(st.slug);
  if (st.tEl.textContent !== t) st.tEl.textContent = t;
  const r = ready(), i = idxOf(st.slug);
  const dots = [...st.subEl.querySelectorAll('.rn-dot')];
  if (!r || dots.length !== daily.STEPS.length) {
    const h = subHTML(st.slug);
    if (st.subEl.innerHTML !== h) st.subEl.innerHTML = h;
    return;
  }
  dots.forEach((dot, j) => {
    const c = dotCls(j, i);
    if (dot.className === c) return;
    const pop = animate && !ui.RM && !dot.classList.contains('is-done') && daily.STEPS[j].done();
    dot.className = c;
    if (pop) ui.stamp(dot, {from: .3});
  });
  const cnt = st.subEl.querySelector('.rn-count'), sr = st.subEl.querySelector('.sr-only');
  const n = daily.STEPS.length, done = daily.STEPS.filter(s => s.done()).length;
  if (cnt && cnt.textContent !== `${i + 1} of ${n}`) cnt.textContent = `${i + 1} of ${n}`;
  if (sr) sr.textContent = `Puzzle ${i + 1} of ${n}, ${done} finished`;
}

function patchArrows(st) {
  [[st.prev, -1], [st.fwd, 1]].forEach(([b, d]) => {
    const a = arrowState(d, st.want || st.slug);
    if (b.getAttribute('aria-label') !== a.label) b.setAttribute('aria-label', a.label);
    if (a.off) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
  });
}

function refreshChrome(st, {swap = false, animate = true} = {}) {
  if (st.dead) return;
  const r = ready();
  const i = idxOf(st.slug);
  patchTitle(st, animate && !swap);
  patchArrows(st);
  if (r) setPts(st, animate && !swap);
  const btn = st.next;
  const done = r && daily.STEPS[i].done() && !(st.inst && st.inst.holdCta && st.inst.holdCta());
  const wasPrimary = btn.classList.contains('btn-primary');
  btn.classList.toggle('btn-primary', done);
  btn.classList.toggle('btn-secondary', !done);
  const inner = nextInner(st.slug);
  if (btn.dataset.inner !== inner) { btn.dataset.inner = inner; btn.innerHTML = inner; }
  btn.setAttribute('aria-label', nextAria(st.slug));
  if (done && !wasPrimary && !swap && animate) {
    ui.animate(btn, [{transform: 'scale(.94)'}, {transform: 'none'}], {spring: 'bouncy'});
  }
  checkBars(st);
}

function makeApi(st) {
  return {
    refreshChrome: o => refreshChrome(st, o),
    busy: p => st.ctx.busy(p),
    reveal: (el, o) => reveal(st, el, o),
    get screen() { return st.ctx.screen; },
    get ctx() { return st.ctx; }
  };
}

function mountModule(st, page) {
  const body = page.querySelector('.rn-body');
  try {
    st.inst = MODS[st.slug].mount(body, st.ctx, st.api) || null;
  } catch (e) {
    console.error(e);
    body.innerHTML = ui.empty({icon: 'football', title: "This puzzle didn't load.", action: {label: 'Close', attrs: 'data-back'}});
    st.inst = null;
  }
}
function unmountModule(st) {
  const inst = st.inst;
  st.inst = null;
  if (inst && inst.unmount) { try { inst.unmount(); } catch (e) { console.error(e); } }
}

function makePage(st, slug) {
  const t = document.createElement('div');
  t.innerHTML = pageHTML(slug, st.ctx);
  return t.firstElementChild;
}

/** A link to a puzzle the loaded day does not have (a five-puzzle link on a three-puzzle day) shows the first
 *  puzzle; the address follows quietly (same view, same slug: update() is a no-op). */
function canonical(st) {
  if (!ready() || st.dead || !st.ctx.params || st.ctx.params.puzzle === st.slug) return;
  Promise.resolve(st.ctx.replace(PLAY(st.slug))).catch(() => {});
}

function fill(st) {
  if (st.dead) return;
  finishSwap(st);
  unmountModule(st);
  st.slug = slugOf(st.ctx);
  const page = makePage(st, st.slug);
  st.stage.replaceChildren(page);
  if (ready()) {
    mountModule(st, page);
    if (st.slug !== 'grid' && grid.warm) grid.warm();
    if (silhouette.warm) silhouette.warm(); // the day's photos, before (or while) Silhouettes opens
  }
  ui.hydrate(page);
  st.date.textContent = daily.dayLabel();
  st.shown = ready() ? daily.totalPts() : 0;
  st.pn.textContent = data.nf(st.shown);
  st.pill.setAttribute('aria-label', `${data.nf(st.shown)} points`);
  if (st.pill.classList.contains('is-pending')) {
    st.pill.classList.remove('is-pending');
    st.pill.removeAttribute('aria-hidden');
    ui.animate(st.pill, [{opacity: 0, transform: 'scale(.9)'}, {opacity: 1, transform: 'none'}], {spring: 'snappy'});
  }
  st.bottom.hidden = false;
  refreshChrome(st, {swap: true});
  ui.animate(page, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
  if (!ui.RM) ui.animate(st.subEl, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
  canonical(st);
}

function showError(st) {
  if (st.dead) return;
  finishSwap(st);
  unmountModule(st);
  st.stage.innerHTML = errorHTML();
  st.bottom.hidden = true;
  refreshChrome(st, {swap: true});
}

function load(st, {retry = false} = {}) {
  daily.ensure().then(() => fill(st), () => {
    showError(st);
    if (retry && !st.dead) ui.toast("Still can't reach the puzzles.");
  });
}

function finishSwap(st) {
  const sw = st.swap;
  if (!sw) return;
  st.swap = null;
  sw.anims.forEach(a => { try { a.finish(); } catch (_) {} });
  sw.old.remove();
  sw.release();
}

function swapTo(st, ns) {
  finishSwap(st);
  const os = st.slug;
  if (ns === os) return;
  // › slides the pages left, ‹ slides them right (spec 5.2 inner swap, mirrored for an earlier puzzle).
  const dir = idxOf(ns) > idxOf(os) ? 1 : -1;
  const old = st.stage.firstElementChild;
  const hadFocus = !!(old && old.contains(document.activeElement));
  unmountModule(st);
  st.slug = ns;
  const page = makePage(st, ns);
  st.stage.appendChild(page);
  if (ready()) mountModule(st, page);
  ui.hydrate(page);
  refreshChrome(st, {swap: true});
  const s = st.ctx.screen;
  const y = s.scrollTop;
  s.scrollTop = 0;
  ui.announce(`Puzzle ${idxOf(ns) + 1} of ${order(ns).length}, ${labelOf(ns)}.`);
  // Focus inside the old page (a key press on a choice) moves to the new page rather than to <body>.
  if (hadFocus) { try { page.focus({preventScroll: true}); } catch (_) {} }
  if (!ui.RM) ui.animate(st.titleEl, [{opacity: 0, transform: `translateX(${14 * dir}px)`}, {opacity: 1, transform: 'none'}], {duration: 240, easing: EASE_OUT});
  if (!old) return;
  old.classList.add('is-out');
  old.setAttribute('aria-hidden', 'true');
  old.inert = true;
  if (ui.RM) {
    old.remove();
    ui.animate(page, [{opacity: 0}, {opacity: 1}], {duration: 180, easing: 'linear'});
    checkBars(st);
    return;
  }
  const a1 = ui.animate(old, [{opacity: 1, transform: `translate(0px, ${-y}px)`}, {opacity: 0, transform: `translate(${-24 * dir}px, ${-y}px)`}], {duration: 160, easing: EASE_IN, fill: 'forwards'});
  const a2 = ui.animate(page, [{opacity: 0, transform: `translateX(${24 * dir}px)`}, {opacity: 1, transform: 'none'}], {duration: 240, easing: EASE_OUT, delay: 120, fill: 'backwards'});
  const sw = {anims: [a1, a2], old, release: st.ctx.busy()};
  st.swap = sw;
  // Settle on the animations, or after 600 ms at the latest (a hidden page produces no frames).
  Promise.race([Promise.all([a1.finished.catch(() => {}), a2.finished.catch(() => {})]), new Promise(r => setTimeout(r, 600))]).then(() => {
    if (st.swap !== sw) return;
    st.swap = null;
    old.remove();
    sw.release();
    checkBars(st);
  });
}

/** Moves one puzzle left (-1) or right (1): the arrows, a header swipe and the arrow keys. Rapid moves chain from
 *  the puzzle last asked for (st.want) until the replace lands. At either end nothing moves; the title nudges. */
function go(st, d) {
  if (!ready() || st.dead) return;
  const from = st.want || st.slug;
  const to = adjSlug(from, d);
  if (!to) { nudge(st, d); return; }
  st.want = to;
  ui.haptic('selection');
  patchArrows(st);
  Promise.resolve(st.ctx.replace(PLAY(to))).catch(() => {}).finally(() => {
    if (st.want !== to) return;
    st.want = null;
    if (!st.dead) patchArrows(st);
  });
}
function nudge(st, d) {
  if (ui.RM || st.dead) return;
  ui.animate(st.titleEl, [{transform: 'none'}, {transform: `translateX(${6 * d}px)`, offset: .35}, {transform: 'none'}], {duration: 280, easing: 'ease-out'});
}

// Horizontal swipe on the top bar or the page header (touch-action: pan-y there): 48 px, or a quick 24 px flick,
// moves one puzzle; a mostly vertical move is left to scrolling. The puzzle body never swipes.
function wireSwipe(st) {
  const el = st.el;
  el.addEventListener('pointerdown', e => {
    st.sw = null;
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !ready()) return;
    const zone = e.target.closest && e.target.closest('.rn-top, .rn-head');
    if (!zone || !el.contains(zone) || zone.closest('.is-out')) return;
    st.sw = {x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, h: false};
  });
  el.addEventListener('pointermove', e => {
    const s = st.sw;
    if (!s || e.pointerId !== s.id || s.h) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) s.h = true;
    else if (Math.abs(dy) > 10) st.sw = null;
  });
  el.addEventListener('pointerup', e => {
    const s = st.sw;
    st.sw = null;
    if (!s || e.pointerId !== s.id || !s.h) return;
    const dx = e.clientX - s.x, dt = Math.max(1, performance.now() - s.t);
    if (Math.abs(dx) >= 48 || (Math.abs(dx) >= 24 && Math.abs(dx) / dt > .4)) {
      st.swipedAt = performance.now(); // the click that may follow on a button under the finger is not a tap
      go(st, dx < 0 ? 1 : -1);
    }
  });
  el.addEventListener('pointercancel', () => { st.sw = null; });
}

// Left / Right keys, while this cover is the visible screen and no sheet is open; never while typing, on a segmented
// control or on a horizontal scroller (they use the keys themselves).
function onKey(st, e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (st.dead || !st.ctx.visible || ui.sheetCount()) return;
  const t = e.target;
  if (t && t !== document && t !== document.body && t !== document.documentElement && !st.ctx.screen.contains(t)) return;
  if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="tab"], [role="slider"], .chips')) return;
  e.preventDefault();
  go(st, e.key === 'ArrowRight' ? 1 : -1);
}

function onClick(st, e) {
  if (st.swipedAt && performance.now() - st.swipedAt < 400) { st.swipedAt = 0; return; }
  const arrow = e.target.closest('[data-rn-go]');
  if (arrow) {
    const d = +arrow.dataset.rnGo;
    if (arrow.getAttribute('aria-disabled') === 'true') { nudge(st, d); return; }
    go(st, d);
    return;
  }
  if (e.target.closest('[data-rn-next]')) {
    // The bar stays put while the page swaps under it: a double tap must not skip a puzzle. Locked until the
    // replace has settled (+300 ms; under reduced motion there is no swap to wait for).
    if (st.navPending || st.swap) return;
    st.navPending = true;
    // The next unfinished puzzle (finished ones are skipped, wrapping around), else the results.
    const next = nextSlug(st.slug);
    Promise.resolve(st.ctx.replace(next ? PLAY(next) : '/puzzles/results'))
      .catch(() => {})
      .finally(() => setTimeout(() => { st.navPending = false; }, 300));
    if (!next && ready()) daily.maybeAutoPost();
    return;
  }
  const retry = e.target.closest('[data-rn-retry]');
  if (retry) {
    ui.setLoading(retry, true);
    load(st, {retry: true});
  }
}

// One attempt a day: when the board shows today's score is already in under this member's name (and this phone
// hasn't finished the day itself), the cover closes back to Puzzles, whose card shows that score.
function kickIfPlayed(st) {
  if (st.dead || st.kicked || !ready() || !daily.playedElsewhere()) return;
  st.kicked = true;
  setTimeout(() => { if (!st.dead) st.ctx.back(); }, 0);
}

export default {
  id: 'run',
  chrome: 'none',
  title: ctx => labelOf(slugOf(ctx)) || 'Puzzles',

  render(ctx) {
    const slug = slugOf(ctx);
    return topHTML(slug) + `<div class="rn-stage">${pageHTML(slug, ctx)}</div>` + bottomHTML(slug);
  },

  mount(el, ctx) {
    const st = {
      el, ctx, slug: slugOf(ctx), inst: null, dead: false, swap: null, want: null, sw: null, swipedAt: 0,
      top: el.querySelector('.rn-top'), stage: el.querySelector('.rn-stage'), bottom: el.querySelector('.rn-bottom'),
      pill: el.querySelector('.rn-pts'), pn: el.querySelector('.rn-pn'), next: el.querySelector('[data-rn-next]'),
      date: el.querySelector('.rn-date'), titleEl: el.querySelector('.rn-title'), tEl: el.querySelector('.rn-t'),
      subEl: el.querySelector('.rn-sub'), prev: el.querySelector('.rn-prev'), fwd: el.querySelector('.rn-fwd'),
      shown: ready() ? daily.totalPts() : 0
    };
    st.next.dataset.inner = st.next.innerHTML;
    st.api = makeApi(st);
    ST.set(ctx, st);
    el.addEventListener('click', e => onClick(st, e));
    wireSwipe(st);
    st.onKey = e => onKey(st, e);
    document.addEventListener('keydown', st.onKey);
    st.onScroll = () => checkBars(st);
    ctx.screen.addEventListener('scroll', st.onScroll, {passive: true});
    st.onResize = () => checkBars(st);
    addEventListener('resize', st.onResize, {passive: true});
    if (ready()) {
      const page = st.stage.querySelector('.rn-page');
      if (page) mountModule(st, page);
      if (st.slug !== 'grid' && grid.warm) grid.warm(); // DEEP CUT scans happen at idle, before the Grid is opened
      if (silhouette.warm) silhouette.warm(); // the day's photos, before (or while) Silhouettes opens
      canonical(st);
    } else {
      load(st); // cold deep link: skeleton until daily.ensure() resolves (a failed earlier load retries here)
    }
    checkBars(st);
    ctx.on('daily', type => { if (type === 'lb' || type === 'ready') kickIfPlayed(st); });
    kickIfPlayed(st);
  },

  update(ctx) {
    const st = ST.get(ctx);
    if (!st || st.dead || ctx.reason !== 'params') return;
    const ns = slugOf(ctx);
    if (ns !== st.slug) swapTo(st, ns);
    canonical(st);
  },

  onShow(ctx) {
    const st = ST.get(ctx);
    if (st) checkBars(st);
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    finishSwap(st);
    unmountModule(st);
    document.removeEventListener('keydown', st.onKey);
    ctx.screen.removeEventListener('scroll', st.onScroll);
    removeEventListener('resize', st.onResize);
    ST.delete(ctx);
  }
};
