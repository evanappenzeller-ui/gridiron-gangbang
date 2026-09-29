// Puzzle run cover (spec 7.2, route /today/play/:puzzle): its own top bar (close, one progress segment per puzzle,
// the points pill), the puzzle header (overline + PROMPTS copy), the puzzle module and a sticky bottom bar.
// Switching puzzles is an in-place update with the inner-swap motion. Owner: puzzle-run package.
//
// A v1 day has three puzzles (college, mystery, grid); a v2 day five (college, silhouette, mystery, journey, grid).
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

const esc = data.esc;
const MODS = {college, silhouette, mystery, journey, grid};
const SLUG_ID = {college: 'col', silhouette: 'sil', mystery: 'who', journey: 'jr', grid: 'grid'};
const ICONS = {college: 'grad-cap', silhouette: 'silhouette', mystery: 'mystery', journey: 'route', grid: 'grid-3'};
// Labels before puzzles load (then daily.STEPS[i].label).
const SLUG_LABEL = {college: 'College', silhouette: 'Silhouettes', mystery: 'Mystery player', journey: 'Journey', grid: 'Grid'};
const V1 = ['college', 'mystery', 'grid'], V2 = ['college', 'silhouette', 'mystery', 'journey', 'grid'];
const EASE_IN = 'cubic-bezier(.4,0,1,1)', EASE_OUT = 'cubic-bezier(.22,1,.36,1)';

const ready = () => daily.status === 'ready' && !!daily.DAY && !!daily.DS && !!daily.DS.col;
const isSlug = s => Object.prototype.hasOwnProperty.call(MODS, s);
/** The route's slug, made canonical for the loaded day (a five-puzzle slug on a three-puzzle day → the first puzzle). */
function slugOf(ctx) {
  const s = ctx && ctx.params && ctx.params.puzzle;
  const v = isSlug(s) ? s : 'college';
  return ready() && daily.stepOf(v) < 0 ? daily.slug(0) : v;
}
/** Slugs in play order: the day's, or a best guess before puzzles load (the v2-only slugs imply five). */
const order = slug => (ready() ? daily.SLUGS : (slug === 'silhouette' || slug === 'journey' ? V2 : V1));
const idxOf = slug => Math.max(0, order(slug).indexOf(slug));
const labelAt = (slug, j) => (ready() && daily.STEPS[j] ? daily.STEPS[j].label : SLUG_LABEL[order(slug)[j]] || '');
const labelOf = slug => (ready() && daily.stepOf(slug) >= 0 ? daily.STEPS[daily.stepOf(slug)].label : SLUG_LABEL[slug] || '');
const isLast = slug => idxOf(slug) === order(slug).length - 1;
/** Where "Next puzzle" goes from slug: the first unfinished puzzle after it (wrapping around), null when every other
 *  puzzle is finished (the button then reads "See results"). Before puzzles load: the next index, or null on the last. */
function nextSlug(slug) {
  if (!ready()) return isLast(slug) ? null : order(slug)[idxOf(slug) + 1];
  const S = daily.STEPS, i = idxOf(slug), n = S.length;
  for (let k = 1; k < n; k++) { const j = (i + k) % n; if (!S[j].done()) return daily.slug(j); }
  return null;
}
const ctaLabel = slug => nextSlug(slug) ? 'Next puzzle' : 'See results';

// Per screen state, keyed by ctx (a run screen can briefly coexist with another during a results swap).
const ST = new WeakMap();

// ---------------------------------------------------------------------------------------------- chrome data
function fracOf(j) {
  const s = daily.STEPS[j], ds = daily.DS;
  // Spec 7.2: the Grid segment is filled squares / 9, even after giving up (the label still says "finished").
  if (s.id === 'grid') return ds.grid.cells.filter(Boolean).length / 9;
  if (s.done()) return 1;
  if (s.id === 'col') return Math.min(1, ds.col.a.length / 5);
  if (s.id === 'sil') return Math.min(1, ds.sil.a.length / daily.silRounds());
  return 0; // Mystery player, Journey: 1 when done
}
const perfectOf = j => daily.STEPS[j].pts() === daily.STEPS[j].max;
function segLabel(slug, j) {
  const base = `Puzzle ${j + 1}, ${labelAt(slug, j)}`;
  if (!ready()) return base;
  const s = daily.STEPS[j];
  return `${base}, ${s.done() ? 'finished' : s.started() ? 'in progress' : 'not started'}`;
}

// ---------------------------------------------------------------------------------------------- markup
function segsHTML(slug) {
  const r = ready(), i = idxOf(slug);
  return order(slug).map((_, j) => {
    const f = r ? fracOf(j) : 0;
    return `<button type="button" class="rn-seg" data-step="${j}" aria-label="${esc(segLabel(slug, j))}"${j === i ? ' aria-current="step"' : ''}${r ? '' : ' disabled'}>`
      + `<span class="rn-track"><span class="rn-fill${r && perfectOf(j) ? ' is-perfect' : ''}" style="transform:scaleX(${f})"></span></span></button>`;
  }).join('');
}
function topHTML(slug) {
  const r = ready();
  const t = r ? daily.totalPts() : 0;
  return `<div class="rn-top"><div class="rn-bg bar" aria-hidden="true"></div>`
    + ui.iconButton({icon: 'close', label: 'Close puzzles', cls: 'rn-close', attrs: 'data-back'})
    + `<nav class="rn-segs" aria-label="Puzzles" data-n="${order(slug).length}">${segsHTML(slug)}</nav>`
    + `<span class="rn-pts${r ? '' : ' is-pending'}${r && t >= 1000 && order(slug).length > 3 ? ' is-wide' : ''}" role="img" aria-label="${esc(data.nf(t))} points"${r ? '' : ' aria-hidden="true"'}><span class="n5 rn-pn" aria-hidden="true">${esc(data.nf(t))}</span><span class="rn-pu" aria-hidden="true">pts</span></span>`
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
  // Before puzzles load the count is not known yet: the overline is the puzzle's name alone.
  const ovl = r ? `Puzzle ${idxOf(slug) + 1} of ${daily.STEPS.length} · ${labelOf(slug)}` : labelOf(slug);
  return `<section class="rn-page" data-page="${slug}" aria-labelledby="rn-h-${slug}">`
    + `<header class="rn-head"><h1 class="rn-ovl ovl" id="rn-h-${slug}">${ui.icon(ICONS[slug])}<span>${esc(ovl)}</span></h1>`
    + `<p class="rn-prompt t-sub">${esc(daily.PROMPTS[SLUG_ID[slug]] || '')}</p></header>`
    + `<div class="rn-body">${body}</div></section>`;
}

function bottomHTML(slug) {
  const done = ready() && daily.STEPS[idxOf(slug)].done();
  return `<div class="rn-bottom"><div class="rn-bg bar" aria-hidden="true"></div>`
    + ui.button({label: ctaLabel(slug), kind: done ? 'primary' : 'secondary', block: true, attrs: {'data-rn-next': ''}, cls: 'rn-next'})
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
  // Never leave the page header (overline and prompt) sliced under the top bar: scroll past it completely when the
  // target still fits, else keep it whole.
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

/** Five segments and a four-digit total do not both fit a 360px bar: the "pts" unit drops (the label keeps it). */
function widePill(st, t) { st.pill.classList.toggle('is-wide', t >= 1000 && order(st.slug).length > 3); }

function setPts(st, animate) {
  const t = daily.totalPts();
  if (t === st.shown) return;
  const from = st.shown;
  st.shown = t;
  widePill(st, t);
  st.pill.setAttribute('aria-label', `${data.nf(t)} points`);
  if (animate && !ui.RM && t > from) {
    ui.countUp(st.pn, t, {from, duration: 700, format: 'int'});
    ui.animate(st.pill, [{transform: 'scale(1.1)'}, {transform: 'none'}], {spring: 'bouncy'});
  } else st.pn.textContent = data.nf(t);
}

/** Rebuilds the segments when the day's puzzle count differs from what the skeleton guessed. */
function syncSegs(st) {
  const n = order(st.slug).length;
  if (st.segs.length === n) return;
  const nav = st.top.querySelector('.rn-segs');
  nav.dataset.n = String(n);
  nav.innerHTML = segsHTML(st.slug);
  st.segs = [...nav.querySelectorAll('.rn-seg')];
  if (!ui.RM) ui.animate(nav, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
}

function refreshChrome(st, {swap = false, animate = true} = {}) {
  if (st.dead) return;
  const r = ready();
  const i = idxOf(st.slug);
  st.segs.forEach((b, j) => {
    b.disabled = !r;
    b.setAttribute('aria-label', segLabel(st.slug, j));
    if (j === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    const fill = b.querySelector('.rn-fill');
    const f = r ? fracOf(j) : 0;
    const tf = `scaleX(${f})`;
    if (fill.style.transform !== tf) fill.style.transform = tf;
    fill.classList.toggle('is-perfect', r && perfectOf(j));
  });
  if (r) setPts(st, animate && !swap);
  const btn = st.next;
  const done = r && daily.STEPS[i].done() && !(st.inst && st.inst.holdCta && st.inst.holdCta());
  const wasPrimary = btn.classList.contains('btn-primary');
  btn.classList.toggle('btn-primary', done);
  btn.classList.toggle('btn-secondary', !done);
  const lab = ctaLabel(st.slug);
  const l = btn.querySelector('.btn-label');
  if (l.textContent !== lab) l.textContent = lab;
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
  Promise.resolve(st.ctx.replace('/today/play/' + st.slug)).catch(() => {});
}

function fill(st) {
  if (st.dead) return;
  finishSwap(st);
  unmountModule(st);
  st.slug = slugOf(st.ctx);
  const page = makePage(st, st.slug);
  st.stage.replaceChildren(page);
  syncSegs(st);
  if (ready()) {
    mountModule(st, page);
    if (st.slug !== 'grid' && grid.warm) grid.warm();
    if (silhouette.warm) silhouette.warm(); // the day's five photos, before (or while) Silhouettes opens
  }
  ui.hydrate(page);
  st.shown = ready() ? daily.totalPts() : 0;
  st.pn.textContent = data.nf(st.shown);
  widePill(st, st.shown);
  st.pill.setAttribute('aria-label', `${data.nf(st.shown)} points`);
  if (st.pill.classList.contains('is-pending')) {
    st.pill.classList.remove('is-pending');
    st.pill.removeAttribute('aria-hidden');
    ui.animate(st.pill, [{opacity: 0, transform: 'scale(.9)'}, {opacity: 1, transform: 'none'}], {spring: 'snappy'});
  }
  st.bottom.hidden = false;
  refreshChrome(st, {swap: true});
  ui.animate(page, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
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
  const dir = idxOf(ns) > idxOf(os) ? 1 : -1;
  const old = st.stage.firstElementChild;
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

function onClick(st, e) {
  const seg = e.target.closest('.rn-seg');
  if (seg) {
    if (seg.disabled || !ready()) return;
    const j = +seg.dataset.step;
    if (j !== idxOf(st.slug) && daily.slug(j)) { ui.haptic('selection'); st.ctx.replace('/today/play/' + daily.slug(j)); }
    return;
  }
  if (e.target.closest('[data-rn-next]')) {
    // The bar stays put while the page swaps under it: a double tap must not skip a puzzle. Locked until the
    // replace has settled (+300 ms; under reduced motion there is no swap to wait for).
    if (st.navPending || st.swap) return;
    st.navPending = true;
    // The next unfinished puzzle (finished ones are skipped, wrapping around), else the results.
    const next = nextSlug(st.slug);
    Promise.resolve(st.ctx.replace(next ? '/today/play/' + next : '/today/results'))
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
      el, ctx, slug: slugOf(ctx), inst: null, dead: false, swap: null,
      top: el.querySelector('.rn-top'), stage: el.querySelector('.rn-stage'), bottom: el.querySelector('.rn-bottom'),
      pill: el.querySelector('.rn-pts'), pn: el.querySelector('.rn-pn'), next: el.querySelector('[data-rn-next]'),
      segs: [...el.querySelectorAll('.rn-seg')], shown: ready() ? daily.totalPts() : 0
    };
    st.api = makeApi(st);
    ST.set(ctx, st);
    el.addEventListener('click', e => onClick(st, e));
    st.onScroll = () => checkBars(st);
    ctx.screen.addEventListener('scroll', st.onScroll, {passive: true});
    st.onResize = () => checkBars(st);
    addEventListener('resize', st.onResize, {passive: true});
    if (ready()) {
      const page = st.stage.querySelector('.rn-page');
      if (page) mountModule(st, page);
      if (st.slug !== 'grid' && grid.warm) grid.warm(); // DEEP CUT scans happen at idle, before the Grid is opened
      if (silhouette.warm) silhouette.warm(); // the day's five photos, before (or while) Silhouettes opens
      canonical(st);
    } else {
      load(st); // cold deep link: skeleton until daily.ensure() resolves (a failed earlier load retries here)
    }
    checkBars(st);
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
    ctx.screen.removeEventListener('scroll', st.onScroll);
    removeEventListener('resize', st.onResize);
    ST.delete(ctx);
  }
};
