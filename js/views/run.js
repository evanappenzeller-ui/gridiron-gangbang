// Puzzle run cover (spec 7.2, route /today/play/:puzzle): its own top bar (close, three progress segments,
// the points pill), the puzzle header (overline + PROMPTS copy), the puzzle module and a sticky bottom bar.
// Switching puzzles is an in-place update with the inner-swap motion. Owner: puzzle-run package.
//
// Puzzle modules (college.js, mystery.js, grid.js) export {render(ctx), mount(el, ctx, api) → instance}.
// render is pure (reads daily state only); mount wires one instance and returns {unmount()}.
// api = {refreshChrome(), busy(promise?), reveal(el), screen, ctx}.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import college from './college.js';
import mystery from './mystery.js';
import grid from './grid.js';

const esc = data.esc;
const SLUGS = ['college', 'mystery', 'grid'];
const MODS = [college, mystery, grid];
const ICONS = ['grad-cap', 'mystery', 'grid-3'];
const PKEY = ['col', 'who', 'grid'];
const EASE_IN = 'cubic-bezier(.4,0,1,1)', EASE_OUT = 'cubic-bezier(.22,1,.36,1)';

const idxOf = ctx => { const i = SLUGS.indexOf(ctx && ctx.params && ctx.params.puzzle); return i < 0 ? 0 : i; };
const labelOf = i => (daily.STEPS[i] && daily.STEPS[i].label) || '';
const ready = () => daily.status === 'ready' && !!daily.DAY && !!daily.DS && !!daily.DS.col;

// Per screen state, keyed by ctx (a run screen can briefly coexist with another during a results swap).
const ST = new WeakMap();

// ---------------------------------------------------------------------------------------------- chrome data
function fracOf(i) {
  const s = daily.STEPS[i], ds = daily.DS;
  if (s.done()) return 1;
  if (i === 0) return Math.min(1, ds.col.a.length / 5);
  if (i === 1) return 0;
  return ds.grid.cells.filter(Boolean).length / 9;
}
const perfectOf = i => daily.STEPS[i].pts() === daily.STEPS[i].max;
function segLabel(i) {
  const base = `Puzzle ${i + 1}, ${labelOf(i)}`;
  if (!ready()) return base;
  const s = daily.STEPS[i];
  return `${base}, ${s.done() ? 'finished' : s.started() ? 'in progress' : 'not started'}`;
}

// ---------------------------------------------------------------------------------------------- markup
function topHTML(i) {
  const r = ready();
  const segs = SLUGS.map((_, j) => {
    const f = r ? fracOf(j) : 0;
    return `<button type="button" class="rn-seg" data-step="${j}" aria-label="${esc(segLabel(j))}"${j === i ? ' aria-current="step"' : ''}${r ? '' : ' disabled'}>`
      + `<span class="rn-track"><span class="rn-fill${r && perfectOf(j) ? ' is-perfect' : ''}" style="transform:scaleX(${f})"></span></span></button>`;
  }).join('');
  const t = r ? daily.totalPts() : 0;
  return `<div class="rn-top"><div class="rn-bg bar" aria-hidden="true"></div>`
    + ui.iconButton({icon: 'close', label: 'Close puzzles', cls: 'rn-close', attrs: 'data-back'})
    + `<nav class="rn-segs" aria-label="Puzzles">${segs}</nav>`
    + `<span class="rn-pts${r ? '' : ' is-pending'}" role="img" aria-label="${esc(data.nf(t))} points"${r ? '' : ' aria-hidden="true"'}><span class="n5 rn-pn" aria-hidden="true">${esc(data.nf(t))}</span><span class="rn-pu" aria-hidden="true">pts</span></span>`
    + `</div>`;
}

function skeletonHTML() {
  return `<div class="rn-sk">${ui.skeleton('lines', 1, {label: 'Loading puzzles.'})}${ui.skeleton('cards', 1)}<div class="rn-sk-grid">${'<span class="sk"></span>'.repeat(4)}</div></div>`;
}
function errorHTML() {
  return `<div class="rn-err">${ui.empty({icon: 'football', title: 'Puzzles need a connection the first time.', body: 'League history works offline.', action: {label: 'Try again', attrs: {'data-rn-retry': ''}}})}</div>`;
}

function pageHTML(i, ctx) {
  const body = ready() ? MODS[i].render(ctx) : skeletonHTML();
  return `<section class="rn-page" data-page="${i}" aria-labelledby="rn-h-${i}">`
    + `<header class="rn-head"><h1 class="rn-ovl ovl" id="rn-h-${i}">${ui.icon(ICONS[i])}<span>Puzzle ${i + 1} of 3 · ${esc(labelOf(i))}</span></h1>`
    + `<p class="rn-prompt t-sub">${esc(daily.PROMPTS[PKEY[i]])}</p></header>`
    + `<div class="rn-body">${body}</div></section>`;
}

function bottomHTML(i) {
  const done = ready() && daily.STEPS[i].done();
  return `<div class="rn-bottom"><div class="rn-bg bar" aria-hidden="true"></div>`
    + ui.button({label: i === 2 ? 'See results' : 'Next puzzle', kind: done ? 'primary' : 'secondary', block: true, attrs: {'data-rn-next': ''}, cls: 'rn-next'})
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

function refreshChrome(st, {swap = false, animate = true} = {}) {
  if (st.dead) return;
  const r = ready();
  st.segs.forEach((b, j) => {
    b.disabled = !r;
    b.setAttribute('aria-label', segLabel(j));
    if (j === st.i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    const fill = b.querySelector('.rn-fill');
    const f = r ? fracOf(j) : 0;
    const tf = `scaleX(${f})`;
    if (fill.style.transform !== tf) fill.style.transform = tf;
    fill.classList.toggle('is-perfect', r && perfectOf(j));
  });
  if (r) setPts(st, animate && !swap);
  const btn = st.next;
  const done = r && daily.STEPS[st.i].done();
  const wasPrimary = btn.classList.contains('btn-primary');
  btn.classList.toggle('btn-primary', done);
  btn.classList.toggle('btn-secondary', !done);
  const lab = st.i === 2 ? 'See results' : 'Next puzzle';
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
    st.inst = MODS[st.i].mount(body, st.ctx, st.api) || null;
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

function makePage(st, i) {
  const t = document.createElement('div');
  t.innerHTML = pageHTML(i, st.ctx);
  return t.firstElementChild;
}

function fill(st) {
  if (st.dead) return;
  finishSwap(st);
  unmountModule(st);
  const page = makePage(st, st.i);
  st.stage.replaceChildren(page);
  if (ready()) {
    mountModule(st, page);
    if (st.i !== 2 && grid.warm) grid.warm();
  }
  ui.hydrate(page);
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

function swapTo(st, ni) {
  finishSwap(st);
  const oi = st.i;
  if (ni === oi) return;
  const dir = ni > oi ? 1 : -1;
  const old = st.stage.firstElementChild;
  unmountModule(st);
  st.i = ni;
  const page = makePage(st, ni);
  st.stage.appendChild(page);
  if (ready()) mountModule(st, page);
  ui.hydrate(page);
  refreshChrome(st, {swap: true});
  const s = st.ctx.screen;
  const y = s.scrollTop;
  s.scrollTop = 0;
  ui.announce(`Puzzle ${ni + 1} of 3, ${labelOf(ni)}.`);
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
    if (seg.disabled) return;
    const j = +seg.dataset.step;
    if (j !== st.i) { ui.haptic('selection'); st.ctx.replace('/today/play/' + SLUGS[j]); }
    return;
  }
  if (e.target.closest('[data-rn-next]')) {
    if (st.i < 2) st.ctx.replace('/today/play/' + SLUGS[st.i + 1]);
    else {
      st.ctx.replace('/today/results');
      if (ready()) daily.maybeAutoPost();
    }
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
  title: ctx => labelOf(idxOf(ctx)) || 'Puzzles',

  render(ctx) {
    const i = idxOf(ctx);
    return topHTML(i) + `<div class="rn-stage">${pageHTML(i, ctx)}</div>` + bottomHTML(i);
  },

  mount(el, ctx) {
    const st = {
      el, ctx, i: idxOf(ctx), inst: null, dead: false, swap: null,
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
      if (st.i !== 2 && grid.warm) grid.warm(); // DEEP CUT scans happen at idle, before the Grid is opened
    } else {
      load(st); // cold deep link: skeleton until daily.ensure() resolves (a failed earlier load retries here)
    }
    checkBars(st);
  },

  update(ctx) {
    const st = ST.get(ctx);
    if (!st || st.dead || ctx.reason !== 'params') return;
    const ni = idxOf(ctx);
    if (ni !== st.i) swapTo(st, ni);
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
