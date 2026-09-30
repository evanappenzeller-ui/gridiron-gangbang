// Boot, router, history projection, tab bar, transitions, swipe-back, scroll memory, view registry.
// Owner: foundation (shell). Spec 3.2-3.5, 5.2, 11, 12.
//
// VIEW CONTRACT (js/views/<id>.js default export):
//   {id, chrome: 'nav' (default) | 'none', title: string | ctx => string, actions?: ctx => [{id, icon, label}] (max 2),
//    render(ctx) → HTML string (pure; goes into .screen-body), mount(el, ctx), update?(ctx), onShow?(ctx), onHide?(ctx),
//    onAction?(id, ctx), unmount?(el, ctx)}
//   el = the .screen-body element; ctx.screen = the <section class="screen v-<id>"> scroll container.
//   update(ctx) runs with ctx.reason 'params' (ctx.replace to the same view), 'data' or 'me'. Without update the
//   screen is re-rendered in place (unmount → render → mount, scrollTop kept). Hidden screens refresh when next shown.
//   A throw in render/mount/update shows "This screen didn't load." with Try again for that screen only.
// CTX: route/path (canonical path string), view, params, query, tab, kind ('root'|'push'|'cover'), screen,
//   transition {type: 'push'|'pop'|'tab'|'cover'|'swap'|'none', morphFrom: DOMRect|null}, reason
//   ('mount'|'params'|'data'|'me'|'show'), first (first mount of this view id this session), visible,
//   nav(path, {morphFrom: element}), replace(path, {dir: 1|-1}), back(), on('data'|'me', fn(detail)) /
//   on('daily', fn(type, detail)) → unsubscribe (auto on unmount), timer(fn, ms) → cancel (interval; paused while
//   hidden; runs fn once on resume), setTitle(s), setBackTitle(s) (the back label of screens pushed on top), setActions(list), refreshChrome() (re-scan [data-collapse] and
//   .accessory after patching the body yourself), busy(promise?) → release(), isBusy().
//   ctx.first is true only for the first mount of a view id this session; it turns false before any refresh.
//   'data' refreshes wait for ui.whenIdle(); 'me' refreshes run synchronously inside data.setMe().
// Declarative navigation: <a href="#/path">, [data-nav="/path"], [data-back] are handled here (animated);
//   put [data-morph-from] on the avatar inside a link to pass its rect as ctx.transition.morphFrom.
import * as ui from './core/ui.js';
import * as data from './core/data.js';
import * as daily from './core/daily.js';
import {needsWelcome, showWelcome} from './views/welcome.js';

export const APP_VERSION = '1.0';

// ============================================================================ Registry and routes
export const REGISTRY = {
  today: () => import('./views/today.js'),
  results: () => import('./views/results.js'),
  run: () => import('./views/run.js'),
  standings: () => import('./views/standings.js'),
  season: () => import('./views/season.js'),
  review: () => import('./views/review.js'),
  wrap: () => import('./views/wrap.js'),
  pickem: () => import('./views/pickem.js'),
  rivals: () => import('./views/rivals.js'),
  hall: () => import('./views/hall.js'),
  moves: () => import('./views/moves.js'),
  profile: () => import('./views/profile.js'),
  _kit: () => import('./views/_kit.js')
};
export const TABS = ['today', 'standings', 'rivals', 'hall', 'moves'];
const ROOTS = {today: '/today', standings: '/standings', rivals: '/rivals', hall: '/hall/trophies', moves: '/moves/drafts'};
const TAB_TITLES = {today: 'Today', standings: 'Standings', rivals: 'Rivals', hall: 'Hall', moves: 'Moves'};
const LEGACY = Object.assign(Object.create(null), {daily: '/today', records: '/hall/records', trophies: '/hall/trophies', standings: '/standings', rivals: '/rivals', moves: '/moves/drafts'}); // null prototype: '#constructor' is not a legacy hash
const PUZZLES = ['college', 'silhouette', 'mystery', 'journey', 'grid']; // v1 days use college, mystery, grid
const BAD_LINK = "That link didn't lead anywhere.";

function matchSegs(p) {
  const [a, b, c, d] = p, n = p.length;
  const R = (view, open, tab, params = {}, home) => ({view, open, tab, params, home: home || (tab === 'any' ? 'standings' : tab)});
  const yr = x => /^\d{4}$/.test(x || '') ? Number(x) : null;
  switch (a) {
    case 'today':
      if (n === 1) return R('today', 'root', 'today');
      if (n === 3 && b === 'play' && PUZZLES.includes(c)) return R('run', 'cover', 'today', {puzzle: c});
      if (n === 2 && b === 'results') return R('results', 'cover', 'today');
      return null;
    case 'standings': {
      if (n === 1) return R('standings', 'root', 'standings');
      const y = yr(b);
      if (y == null) return null;
      if (n === 2) return R('season', 'push', 'any', {year: y, seg: 'table'});
      if (n === 3 && c === 'weeks') return R('season', 'push', 'any', {year: y, seg: 'weeks'});
      if (n === 4 && c === 'weeks' && /^\d{1,2}$/.test(d)) return R('season', 'push', 'any', {year: y, seg: 'weeks', week: Number(d)});
      if (n === 3 && c === 'bracket') return R('season', 'push', 'any', {year: y, seg: 'bracket'});
      if (n === 3 && c === 'review') return R('review', 'push', 'any', {year: y});
      if (n === 4 && c === 'wrap' && /^\d{1,2}$/.test(d)) return R('wrap', 'push', 'any', {year: y, week: Number(d)});
      return null;
    }
    case 'rivals':
      if (n === 1) return R('rivals', 'root', 'rivals');
      if (n === 2) {
        const i = b.indexOf('-vs-');
        if (i > 0 && i + 4 < b.length) return R('rivals', 'root', 'rivals', {a: b.slice(0, i), b: b.slice(i + 4)});
      }
      return null;
    case 'hall':
      if (n === 1) return {redirect: '/hall/trophies'};
      if (n === 2 && b === 'trophies') return R('hall', 'root', 'hall', {seg: 'trophies'});
      if (n === 2 && b === 'records') return R('hall', 'root', 'hall', {seg: 'records'});
      if (n === 2 && b === 'shame') return R('hall', 'root', 'hall', {seg: 'shame'});
      if (n === 3 && b === 'records') return R('hall', 'root', 'hall', {seg: 'records', focus: c});
      return null;
    case 'moves':
      if (n === 1) return {redirect: '/moves/drafts'};
      if (n === 2 && b === 'drafts') return R('moves', 'root', 'moves', {seg: 'drafts'});
      if (n === 3 && b === 'drafts' && yr(c) != null) return R('moves', 'root', 'moves', {seg: 'drafts', year: yr(c)});
      if (n === 2 && b === 'trades') return R('moves', 'root', 'moves', {seg: 'trades'});
      return null;
    case 'managers':
      if (n === 2 && b) return R('profile', 'push', 'any', {id: b});
      return null;
    case 'pickem':
      // NFL Pick'em (optional ?week=N): pushed on any tab; a cold link sits on Rivals (the week's home).
      if (n === 1) return R('pickem', 'push', 'any', {}, 'rivals');
      return null;
    case '_kit':
      if (n === 1) return R('_kit', 'push', 'any', {}, 'today');
      return null;
  }
  return null;
}

/**
 * Parses "#/path?k=v" (or "/path?k=v") into {view, open: 'root'|'push'|'cover', tab, home, params, query, path}.
 * path is canonical (encoded, no trailing slash). Returns null for unknown routes. Redirects are followed.
 */
export function parseRoute(input, depth = 0) {
  let s = String(input == null ? '' : input).trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (LEGACY[s]) s = LEGACY[s]; // legacy hashes (#daily, #records, ...) also work when typed in later
  if (!s || s === '/') s = '/today';
  if (!s.startsWith('/')) s = '/' + s;
  const qi = s.indexOf('?');
  const pathPart = qi < 0 ? s : s.slice(0, qi);
  const qs = qi < 0 ? '' : s.slice(qi + 1);
  const segs = pathPart.split('/').filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch (_) { return x; } });
  const m = matchSegs(segs);
  if (!m) return null;
  if (m.redirect) return depth > 3 ? null : parseRoute(m.redirect + (qs ? '?' + qs : ''), depth + 1);
  const query = {};
  new URLSearchParams(qs).forEach((v, k) => { query[k] = v; });
  const q = new URLSearchParams(query).toString();
  return Object.assign(m, {query, path: '/' + segs.map(encodeURIComponent).join('/') + (q ? '?' + q : '')});
}

// ============================================================================ State
const $ = id => document.getElementById(id);
const layerOf = tab => document.querySelector(`#stage > .tab-layer[data-tab="${tab}"]`);
// Hidden tab layers stay rendered but skipped (content-visibility: hidden in base.css keeps their layout cached, so
// switching back costs no full style and layout pass). Skipped content is also out of the tab order and the a11y
// tree, so no inert (toggling inert restyles the whole subtree: ~10 ms per switch).
function setLayerHidden(layer, h) { if (layer) layer.hidden = h; }
const S = {tab: 'today', stacks: {}, cover: null, sheets: [], n: 0};
let entrySeq = 0;
const newEntry = (route, tab, kind) => ({id: ++entrySeq, route, tab, kind, scr: null});
const topOf = tab => { const st = S.stacks[tab]; return st[st.length - 1]; };
const secMap = new WeakMap();
const seen = new Set();

// ============================================================================ Modules
const mods = new Map();   // view id → default export
const modNS = new Map();  // view id → module namespace
const loading = new Map();
function loadView(id, retry) {
  if (!retry && mods.has(id)) return Promise.resolve(mods.get(id));
  if (!retry && loading.has(id)) return loading.get(id);
  const imp = retry ? import(`./views/${id}.js?retry=${Date.now()}`) : (REGISTRY[id] ? REGISTRY[id]() : Promise.reject(new Error('No view ' + id)));
  const p = imp.then(m => {
    const v = (m && m.default) || {};
    mods.set(id, v); modNS.set(id, m); loading.delete(id);
    return v;
  }, err => { loading.delete(id); throw err; });
  if (!retry) loading.set(id, p);
  return p;
}
async function loadViewSafe(id) {
  try { return {v: await loadView(id), err: null}; } catch (err) { console.error(err); return {v: null, err}; }
}

// ============================================================================ Scroll memory (3.5)
const scrollMap = new Map();
try { Object.entries(JSON.parse(ui.ssGet('gg-scroll') || '{}')).forEach(([k, v]) => scrollMap.set(k, Number(v) || 0)); } catch (_) {}
let persistT = 0;
const inHiddenLayer = scr => !!scr.el.closest('.tab-layer[hidden]');
function saveScroll(scr) {
  if (!scr || inHiddenLayer(scr)) return;
  scrollMap.set(scr.entry.route.path, scr.el.scrollTop);
  clearTimeout(persistT);
  persistT = setTimeout(persistScroll, 500);
}
function persistScroll() {
  allMounted().forEach(s => { if (!inHiddenLayer(s)) scrollMap.set(s.entry.route.path, s.el.scrollTop); });
  while (scrollMap.size > 80) scrollMap.delete(scrollMap.keys().next().value);
  ui.ssSet('gg-scroll', JSON.stringify(Object.fromEntries(scrollMap)));
}
// Hidden tab layers (display:none resets scrollTop): the position lives on the entry itself, so the same
// path mounted on two tabs (a profile on Standings and on Rivals) never shares a slot. The path map is
// still updated for re-created screens (spec 3.5).
function saveLayerScroll(tab) {
  S.stacks[tab].forEach(e => { if (e.scr) { e.savedTop = e.scr.el.scrollTop; scrollMap.set(e.route.path, e.savedTop); } });
}
function restoreLayerScroll(tab) {
  S.stacks[tab].forEach(e => { if (e.scr && e.savedTop != null) e.scr.el.scrollTop = e.savedTop; });
}

// ============================================================================ Screens
function allMounted() {
  const out = [];
  TABS.forEach(t => S.stacks[t].forEach(e => { if (e.scr) out.push(e.scr); }));
  if (S.cover && S.cover.scr) out.push(S.cover.scr);
  return out;
}
function prevEntryOf(e) {
  const st = S.stacks[e.tab];
  const i = st.indexOf(e);
  return i > 0 ? st[i - 1] : null;
}
function viewTitle(view, ctxLike, tab) {
  if (!view) return ''; // the module failed to import: the screen shows "This screen didn't load."
  try {
    const t = typeof view.title === 'function' ? view.title(ctxLike) : view.title;
    if (t != null && t !== '') return String(t);
  } catch (e) { console.error(e); }
  return '';
}
function titleOfEntry(e) {
  if (!e) return '';
  if (e.scr) return e.scr.backTitleOverride != null ? e.scr.backTitleOverride : screenTitle(e.scr);
  const v = mods.get(e.route.view);
  if (v) { const t = viewTitle(v, {params: e.route.params, query: e.route.query, route: e.route.path, path: e.route.path, tab: e.tab}); if (t) return t; }
  return e.kind === 'root' ? TAB_TITLES[e.tab] || '' : '';
}
function screenTitle(scr) {
  if (scr.titleOverride != null) return scr.titleOverride;
  const t = viewTitle(scr.view, scr.ctx);
  return t || (scr.entry.kind === 'root' ? TAB_TITLES[scr.entry.tab] || '' : '');
}
const clip12 = s => s.length > 12 ? s.slice(0, 11).trimEnd() + '…' : s;

function navHTML(e) {
  let lead = '';
  if (e.kind === 'push') {
    const t = clip12(titleOfEntry(prevEntryOf(e)) || 'Back');
    lead = `<button type="button" class="nav-back" data-nav-back aria-label="Back">${ui.icon('chevron-left')}<span class="nav-back-t">${data.esc(t)}</span></button>`;
  } else if (e.kind === 'cover') {
    lead = ui.iconButton({icon: 'close', label: 'Close', attrs: 'data-nav-back'});
  }
  return `<header class="nav"><div class="nav-bg"></div><div class="nav-lead">${lead}</div><div class="nav-title"><span></span></div><div class="nav-trail"></div></header>`;
}
function refreshBackLabels() {
  TABS.forEach(t => S.stacks[t].forEach(e => {
    if (e.kind !== 'push' || !e.scr || !e.scr.nav) return;
    const el = e.scr.nav.querySelector('.nav-back-t');
    const txt = clip12(titleOfEntry(prevEntryOf(e)) || 'Back');
    if (el && el.textContent !== txt) { el.textContent = txt; fitNavTitle(e.scr); }
  }));
}
// The compact title is inset by the wider of the lead and trail slots (symmetric, so it stays centered),
// so a long back label and a long title never overlap at 360 px. Hidden screens (display:none layer)
// measure 0 and are fitted again when shown.
function fitNavTitle(scr) {
  if (!scr || !scr.nav) return;
  const lead = scr.nav.querySelector(':scope > .nav-lead'), trail = scr.nav.querySelector(':scope > .nav-trail');
  const title = scr.nav.querySelector(':scope > .nav-title');
  if (!lead || !trail || !title) return;
  const lw = lead.offsetWidth, tw = trail.offsetWidth;
  if (!lw && !tw) return;
  const inset = Math.max(lw, tw, 44) + 8 + 'px';
  if (title.style.left !== inset) { title.style.left = inset; title.style.right = inset; }
}
function renderActions(scr) {
  if (!scr.nav) return;
  let list = scr.actionsOverride;
  if (!list) { try { list = (scr.view && scr.view.actions && scr.view.actions(scr.ctx)) || []; } catch (e) { console.error(e); list = []; } }
  const html = list.slice(0, 2).map(a => ui.iconButton({icon: a.icon, label: a.label, attrs: {'data-nav-action': a.id}})).join('');
  const trail = scr.nav.querySelector('.nav-trail');
  if (trail._html === html) return;
  // Swapping the buttons destroys a focused one (e.g. "Show as table" becomes "Show as list"): keep keyboard focus
  // in the bar on the button with the same action id, else the one at the same position.
  const a = document.activeElement;
  const had = a && trail.contains(a) ? {id: a.dataset.navAction, i: [...trail.children].indexOf(a)} : null;
  trail.innerHTML = html;
  trail._html = html;
  if (had) {
    const btns = [...trail.querySelectorAll('[data-nav-action]')];
    const next = btns.find(b => b.dataset.navAction === had.id) || btns[Math.min(had.i, btns.length - 1)];
    if (next) focusQuiet(next); else focusQuiet(scr.el);
  }
}
function updateNav(scr) {
  if (!scr.nav) return;
  const t = screenTitle(scr);
  const span = scr.nav.querySelector('.nav-title > span');
  if (span.textContent !== t) span.textContent = t;
  scr.nav.querySelector('.nav-title').setAttribute('aria-hidden', scr.hasLarge ? 'true' : 'false');
  renderActions(scr);
  fitNavTitle(scr);
}

// Collapse: IntersectionObserver on [data-collapse] toggles .is-collapsed; no sentinel = always collapsed.
function observeCollapse(scr) {
  if (scr.io) { scr.io.disconnect(); scr.io = null; }
  if (!scr.nav) { scr.hasLarge = false; return; }
  const s = scr.body.querySelector('[data-collapse]');
  scr.hasLarge = !!s;
  if (!s) { scr.el.classList.add('is-collapsed'); return; }
  const navH = scr.nav.offsetHeight || 44;
  scr.navH = navH;
  scr.io = new IntersectionObserver(es => {
    const e = es[es.length - 1];
    if (!e.rootBounds || !e.rootBounds.height || !ui.rendered(e.target)) return; // hidden layer: keep the state
    scr.el.classList.toggle('is-collapsed', !e.isIntersecting && e.boundingClientRect.bottom <= e.rootBounds.top + 1);
  }, {root: scr.el, rootMargin: `-${navH}px 0px 0px 0px`, threshold: 0});
  scr.io.observe(s);
}
// Sticky accessory: .is-pinned once it sticks under the nav bar.
function observeAccessories(scr) {
  if (scr.aio) { scr.aio.disconnect(); scr.aio = null; }
  const accs = scr.body.querySelectorAll('.accessory');
  if (!accs.length || !scr.nav) return;
  const navH = scr.nav.offsetHeight || 44;
  scr.aio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.rootBounds || !e.rootBounds.height || !ui.rendered(e.target)) return;
    e.target.classList.toggle('is-pinned', e.isIntersecting && e.intersectionRatio > 0 && e.intersectionRatio < 1 && e.boundingClientRect.top <= e.rootBounds.top + 1);
  }), {root: scr.el, rootMargin: `-${navH}px 0px 0px 0px`, threshold: [0, 1]});
  accs.forEach(a => scr.aio.observe(a));
}
function afterContent(scr) { observeCollapse(scr); observeAccessories(scr); updateNav(scr); }
// The nav height feeds the observers' rootMargin; re-observe when it changes (safe-area or late CSS).
function checkNavHeight(scr) {
  if (scr && scr.nav && !scr.dead && scr.nav.offsetHeight && scr.nav.offsetHeight !== scr.navH) { observeCollapse(scr); observeAccessories(scr); }
}

const mkTransition = (type, morphFrom = null) => ({type, morphFrom, toString() { return type; }});
function makeCtx(scr, transition) {
  const e = scr.entry, r = e.route;
  return {
    route: r.path, path: r.path, view: r.view, params: r.params, query: r.query,
    tab: e.tab, kind: e.kind, screen: scr.el, transition, reason: 'mount',
    first: !seen.has(r.view),
    nav: (path, o) => nav(path, o),
    replace: (path, o) => replaceFrom(scr, path, o),
    back: () => back(),
    on: (src, fn) => subscribeFor(scr, src, fn),
    timer: (fn, ms) => timerFor(scr, fn, ms),
    setTitle: s => { scr.titleOverride = s == null ? null : String(s); updateNav(scr); refreshBackLabels(); },
    // The back label of screens pushed on top (default: the compact title). null restores the default.
    setBackTitle: s => { scr.backTitleOverride = s == null ? null : String(s); refreshBackLabels(); },
    setActions: list => { scr.actionsOverride = list || null; renderActions(scr); },
    // Re-scan the body for [data-collapse] and .accessory after patching it outside render/mount/update.
    refreshChrome: () => { if (!scr.dead) afterContent(scr); },
    busy: p => {
      ui.busy.inc();
      let done = false;
      const rel = () => { if (!done) { done = true; ui.busy.dec(); } };
      if (p && typeof p.then === 'function') p.then(rel, rel);
      return rel;
    },
    isBusy: () => ui.busy.count > 0,
    get visible() { return scr.visible; }
  };
}
function subscribeFor(scr, src, fn) {
  let un;
  if (src === 'data' || src === 'me') un = data.subscribe((t, d) => { if (t === src) fn(d); });
  else if (src === 'daily') un = daily.subscribe((t, d) => fn(t, d));
  else throw new Error('ctx.on: unknown source ' + src);
  scr.cleanups.push(un);
  return un;
}
function timerFor(scr, fn, ms) {
  const t = {fn, ms, id: 0};
  scr.timers.add(t);
  if (scr.visible && !document.hidden) startTimer(t);
  return () => { stopTimer(t); scr.timers.delete(t); };
}
function startTimer(t) { if (!t.id) t.id = setInterval(() => { try { t.fn(); } catch (e) { console.error(e); } }, t.ms); }
function stopTimer(t) { if (t.id) { clearInterval(t.id); t.id = 0; } }
function pauseTimers(scr) { scr.timers.forEach(stopTimer); }
function resumeTimers(scr) {
  scr.timers.forEach(t => { if (!t.id) { try { t.fn(); } catch (e) { console.error(e); } startTimer(t); } });
}
function runCleanups(scr) {
  scr.cleanups.splice(0).forEach(f => { try { f(); } catch (_) {} });
  scr.timers.forEach(stopTimer);
  scr.timers.clear();
}

function renderError(scr, err) {
  if (err) console.error(err);
  scr.broken = true;
  scr.body.innerHTML = ui.empty({icon: 'football', title: "This screen didn't load.", action: {label: 'Try again', attrs: {'data-screen-retry': ''}}});
  afterContent(scr);
}
function renderBody(scr) {
  const {view: v, ctx, body} = scr;
  if (!v) return renderError(scr, scr.loadErr);
  let html;
  try { html = v.render ? v.render(ctx) : ''; } catch (e) { return renderError(scr, e); }
  scr.broken = false;
  body.innerHTML = html == null ? '' : String(html);
  try { v.mount && v.mount(body, ctx); } catch (e) { return renderError(scr, e); }
  ui.hydrate(body);
  afterContent(scr);
}
function buildScreen(entry, view, o = {}) {
  const r = entry.route;
  const sec = document.createElement('section');
  sec.className = `screen v-${r.view}`;
  sec.dataset.path = r.path;
  sec.dataset.tab = entry.tab;
  sec.tabIndex = -1;
  const chrome = view && view.chrome === 'none' ? 'none' : 'nav';
  sec.innerHTML = (chrome === 'nav' ? navHTML(entry) : '') + '<div class="screen-body"></div><div class="screen-dim" aria-hidden="true"></div><div class="screen-edge" aria-hidden="true"></div>';
  const scr = {
    entry, view, loadErr: o.err || null, el: sec,
    nav: sec.querySelector(':scope > .nav'), body: sec.querySelector(':scope > .screen-body'),
    dim: sec.querySelector(':scope > .screen-dim'), edge: sec.querySelector(':scope > .screen-edge'),
    ctx: null, visible: false, dirty: null, cleanups: [], timers: new Set(),
    titleOverride: null, backTitleOverride: null, actionsOverride: null, io: null, aio: null, hasLarge: false, broken: false
  };
  scr.ctx = makeCtx(scr, mkTransition(o.transition || 'none', o.morphFrom || null));
  secMap.set(sec, scr);
  entry.scr = scr;
  entry.savedTop = null; // a fresh screen restores from the path map (o.restore), never a stale layer position
  const host = o.container || (entry.kind === 'cover' ? entry.coverEl : layerOf(entry.tab));
  sec.style.zIndex = String(o.z || 1);
  if (o.under) sec.setAttribute('data-under', '');
  if (o.before && o.before.parentNode === host) host.insertBefore(sec, o.before); else host.appendChild(sec);
  renderBody(scr);
  if (o.restore && scrollMap.has(r.path)) sec.scrollTop = scrollMap.get(r.path);
  seen.add(r.view);
  return scr;
}
async function ensureScreen(entry, o = {}) {
  if (entry.scr) return entry.scr;
  const {v, err} = await loadViewSafe(entry.route.view);
  if (entry.scr) return entry.scr;
  return buildScreen(entry, v, Object.assign({}, o, {err}));
}
function ensureScreenSync(entry, o = {}) {
  if (entry.scr) return entry.scr;
  const v = mods.get(entry.route.view);
  return v ? buildScreen(entry, v, o) : null;
}
function unmountScreen(scr, {save = true} = {}) {
  if (!scr || scr.dead) return;
  if (save) saveScroll(scr);
  setVisible(scr, false);
  scr.dead = true;
  try { scr.view && scr.view.unmount && scr.view.unmount(scr.body, scr.ctx); } catch (e) { console.error(e); }
  runCleanups(scr);
  if (scr.io) scr.io.disconnect();
  if (scr.aio) scr.aio.disconnect();
  scr.el.remove();
  if (scr.entry.scr === scr) scr.entry.scr = null;
}
function applyRoute(scr, r) {
  const c = scr.ctx;
  c.route = c.path = r.path; c.params = r.params; c.query = r.query; c.view = r.view;
  scr.el.dataset.path = r.path;
}
// A hidden screen collects every pending reason (a route change then a reload must both reach update()).
function markDirty(scr, reason) { (scr.dirty || (scr.dirty = new Set())).add(reason); }
function flushDirty(scr) {
  const d = scr.dirty;
  scr.dirty = null;
  if (!d || !d.size || scr.dead) return;
  if (!scr.view || !scr.view.update) { refresh(scr, d.has('data') ? 'data' : d.has('params') ? 'params' : 'me'); return; } // one re-render covers all
  ['params', 'data', 'me'].forEach(r => { if (d.has(r) && !scr.dead) refresh(scr, r); });
}
function refresh(scr, reason) {
  scr.dirty = null;
  if (scr.dead) return;
  scr.ctx.reason = reason;
  scr.ctx.first = false; // entrance motion plays on the first mount only, never on refresh/re-render
  if (scr.broken) return;
  if (scr.view.update) {
    try { scr.view.update(scr.ctx); } catch (e) { renderError(scr, e); return; }
    ui.hydrate(scr.body); // idempotent: wires count-ups/search fields the update patched in
    afterContent(scr);
  } else {
    rerender(scr);
  }
}
function rerender(scr) {
  const top = scr.el.scrollTop;
  try { scr.view.unmount && scr.view.unmount(scr.body, scr.ctx); } catch (e) { console.error(e); }
  runCleanups(scr);
  // A fresh .screen-body, so listeners the view attached to `el` in the last mount never pile up.
  const nb = scr.body.cloneNode(false);
  scr.body.replaceWith(nb);
  scr.body = nb;
  renderBody(scr);
  if (scr.visible) scr.timers.forEach(startTimer);
  scr.el.scrollTop = top;
}
async function retryScreen(scr) {
  const e = scr.entry, id = e.route.view;
  let v;
  try { v = await loadView(id, true); } catch (err) { console.error(err); ui.toast("This screen didn't load."); return; }
  const next = scr.el.nextSibling, host = scr.el.parentNode, z = scr.el.style.zIndex, under = scr.el.hasAttribute('data-under');
  unmountScreen(scr, {save: false});
  const ns = buildScreen(e, v, {container: host, z: +z || 1, before: next, under, transition: 'none'});
  syncVisibility();
  return ns;
}

// Visibility: onShow/onHide, timers, deferred refreshes
function visibleScreen() {
  const e = S.cover || topOf(S.tab);
  return e && e.scr;
}
function setVisible(scr, v) {
  if (!scr || scr.visible === v) return;
  if (v && scr.dead) return;
  scr.visible = v;
  if (v) {
    checkNavHeight(scr);
    fitNavTitle(scr);
    if (scr.dirty) flushDirty(scr);
    if (!document.hidden) resumeTimers(scr);
    scr.ctx.reason = 'show';
    try { scr.view && scr.view.onShow && scr.view.onShow(scr.ctx); } catch (e) { console.error(e); }
  } else {
    pauseTimers(scr);
    try { scr.view && scr.view.onHide && scr.view.onHide(scr.ctx); } catch (e) { console.error(e); }
  }
}
function syncVisibility() {
  const top = visibleScreen();
  allMounted().forEach(s => { if (s !== top) setVisible(s, false); });
  if (top) setVisible(top, true);
}

// ============================================================================ Transitions (5.2)
const running = new Set();
function track(list) {
  list = list.filter(Boolean);
  list.forEach(a => { running.add(a); const rm = () => running.delete(a); a.finished.then(rm, rm); });
  // Safety: when no frames are produced (hidden page), finish the transition instead of stalling the op queue.
  let end = 0;
  list.forEach(a => { try { end = Math.max(end, a.effect.getComputedTiming().endTime || 0); } catch (_) {} });
  const guard = setTimeout(() => list.forEach(a => { try { if (a.playState !== 'finished') a.finish(); } catch (_) {} }), end + 400);
  return Promise.all(list.map(a => a.finished.catch(() => {}))).then(() => clearTimeout(guard));
}
/** Jump every running screen transition to its end (a tab tap during a transition). */
export function finishTransitions() { [...running].forEach(a => { try { a.finish(); } catch (_) {} }); }
function pinLayers(scr) { if (!scr) return; const t = scr.el.scrollTop + 'px'; scr.dim.style.top = t; scr.edge.style.top = t; }
function clearInline(scr) {
  if (!scr) return;
  scr.el.style.transform = ''; scr.el.style.opacity = '';
  scr.dim.style.opacity = ''; scr.edge.style.opacity = '';
  scr.el.classList.remove('is-animating');
}
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)', EASE_IN = 'cubic-bezier(.4,0,1,1)';

// ---- Anchored nav bar (push, pop, swipe-back). Each screen owns its sticky .nav, so a bar would slide with its page.
// Instead the bar stays put, as on iOS: for the length of the transition both bars are replaced by inert copies in one
// layer above the screens. The material (background + hairline) never moves; it only cross-fades between the two
// screens' collapse states. The leaving bar's contents fade out over the first 40% (its title drifting 40 px away),
// the arriving bar's fade in over the first 60% (its title arriving from 40 px). p runs 0→1 (from → to).
const XF_OUT = .4, XF_IN = .6;
function navXfade(from, to, dir) {
  if (ui.RM || !from || !to || !from.nav || !to.nav || from.el.parentElement !== to.el.parentElement) return null;
  const layer = to.el.parentElement;
  const lr = layer.getBoundingClientRect(), nr = from.nav.getBoundingClientRect();
  if (!nr.width) return null;
  const wrap = document.createElement('div');
  wrap.className = 'nav-xfade';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.inert = true;
  wrap.style.cssText = `position:absolute;left:${nr.left - lr.left}px;top:${nr.top - lr.top}px;width:${nr.width}px;height:${nr.height}px;z-index:30;pointer-events:none;`;
  const copy = scr => {
    // The collapse state is read from the scroll position now (a re-created screen's observer has not reported yet),
    // and the bar's parts take their settled values for that state (never a CSS transition's first frame).
    const s = scr.hasLarge && scr.body.querySelector('[data-collapse]');
    if (s) scr.el.classList.toggle('is-collapsed', s.getBoundingClientRect().bottom <= scr.el.getBoundingClientRect().top + (scr.navH || scr.nav.offsetHeight) + 1);
    const col = scr.el.classList.contains('is-collapsed');
    const c = scr.nav.cloneNode(true);
    c.style.cssText = 'position:absolute;left:0;top:0;right:0;margin:0;';
    const part = sel => {
      const o = scr.nav.querySelector(':scope > ' + sel), k = c.querySelector(':scope > ' + sel);
      if (!o || !k) return null;
      k.style.transition = 'none';
      return {el: k, o: +getComputedStyle(o).opacity || 0, t: ''};
    };
    const bg = part('.nav-bg'), title = part('.nav-title');
    if (bg) {
      Object.assign(bg, {o: col ? 1 : 0});
      // Keep the material's look outside the screen (e.g. the solid slab of a nav merged with a pinned accessory).
      const cs = getComputedStyle(scr.nav.querySelector(':scope > .nav-bg'));
      Object.assign(bg.el.style, {background: cs.background, boxShadow: cs.boxShadow, backdropFilter: cs.backdropFilter, webkitBackdropFilter: cs.webkitBackdropFilter || cs.backdropFilter});
    }
    if (title) Object.assign(title, {o: col ? 1 : 0, t: col ? '' : 'translateY(4px)'});
    return {c, bg, title, lead: part('.nav-lead'), trail: part('.nav-trail')};
  };
  const A = copy(from), B = copy(to);
  if (!A.bg || !B.bg) return null;
  B.bg.el.style.display = 'none'; // one material layer: A's, cross-faded to B's state
  wrap.append(A.c, B.c);
  layer.appendChild(wrap);
  from.nav.style.visibility = 'hidden';
  to.nav.style.visibility = 'hidden';
  const X = {wrap, A, B, dir, from, to, anims: []};
  X.style = p => {
    const s = [];
    const fo = Math.max(0, 1 - p / XF_OUT), fi = Math.min(1, p / XF_IN);
    s.push([A.bg.el, {opacity: A.bg.o + (B.bg.o - A.bg.o) * p}]);
    for (const k of ['lead', 'trail']) {
      if (A[k]) s.push([A[k].el, {opacity: A[k].o * fo}]);
      if (B[k]) s.push([B[k].el, {opacity: B[k].o * fi}]);
    }
    if (A.title) s.push([A.title.el, {opacity: A.title.o * fo, transform: `translateX(${-40 * dir * Math.min(1, p / XF_OUT)}px) ${A.title.t}`}]);
    if (B.title) s.push([B.title.el, {opacity: B.title.o * fi, transform: `translateX(${40 * dir * (1 - fi)}px) ${B.title.t}`}]);
    return s;
  };
  // Direct styles for a gesture-driven progress (swipe-back).
  X.set = p => X.style(p).forEach(([el, st]) => Object.assign(el.style, st));
  // Spring-driven p0 → p1, sampled into keyframes (the spring eases the whole progress, like the screens).
  X.run = (p0, p1, o = {}) => {
    const N = 10, per = new Map();
    for (let i = 0; i <= N; i++) {
      const p = p0 + (p1 - p0) * i / N;
      X.style(p).forEach(([el, st]) => { if (!per.has(el)) per.set(el, []); per.get(el).push({...st, offset: i / N}); });
    }
    X.set(p1);
    X.anims = [...per].map(([el, kf]) => ui.animate(el, kf, {spring: 'smooth', ...o}));
    return X.anims;
  };
  X.done = () => {
    X.anims.forEach(a => { try { a.cancel(); } catch (_) {} });
    wrap.remove();
    from.nav.style.visibility = '';
    to.nav.style.visibility = '';
  };
  X.set(0);
  return X;
}

async function animPush(inc, out) {
  if (!inc || !out) return;
  pinLayers(inc); pinLayers(out);
  inc.el.classList.add('is-animating'); out.el.classList.add('is-animating');
  const xf = navXfade(out, inc, 1);
  const list = ui.RM
    ? [ui.animate(inc.el, [{opacity: 0}, {opacity: 1}], {duration: 180, easing: 'linear'})]
    : [
      ui.animate(inc.el, [{transform: 'translateX(100%)'}, {transform: 'translateX(0)'}], {spring: 'smooth', fill: 'backwards'}),
      ui.animate(out.el, [{transform: 'translateX(0)'}, {transform: 'translateX(-30%)'}], {spring: 'smooth', fill: 'forwards'}),
      ui.animate(out.dim, [{opacity: 0}, {opacity: .3}], {spring: 'smooth', fill: 'forwards'}),
      ui.animate(inc.edge, [{opacity: 0}, {opacity: 1}], {spring: 'smooth', fill: 'forwards'}),
      ...(xf ? xf.run(0, 1) : [])
    ];
  try { await track(list); } finally { if (xf) xf.done(); }
  if (!out.dead && topOf(out.entry.tab) !== out.entry) out.el.setAttribute('data-under', '');
  list.forEach(a => a.cancel());
  clearInline(inc); clearInline(out);
}
async function animPop(top, under, {v0 = 0} = {}) {
  if (!top) return;
  pinLayers(top); pinLayers(under);
  top.el.classList.add('is-animating');
  if (under) under.el.classList.add('is-animating');
  const xf = under ? navXfade(top, under, -1) : null;
  const list = ui.RM
    ? [ui.animate(top.el, [{opacity: 1}, {opacity: 0}], {duration: 180, easing: 'linear', fill: 'forwards'})]
    : [
      ui.animate(top.el, [{transform: getComputedStyle(top.el).transform === 'none' ? 'translateX(0)' : getComputedStyle(top.el).transform}, {transform: 'translateX(100%)'}], {spring: 'smooth', v0, fill: 'forwards'}),
      under && ui.animate(under.el, [{transform: 'translateX(-30%)'}, {transform: 'translateX(0)'}], {spring: 'smooth', v0}),
      under && ui.animate(under.dim, [{opacity: .3}, {opacity: 0}], {spring: 'smooth', v0}),
      ui.animate(top.edge, [{opacity: 1}, {opacity: 0}], {spring: 'smooth', v0, fill: 'forwards'}),
      ...(xf ? xf.run(0, 1, {v0}) : [])
    ];
  try { await track(list); } finally { if (xf) xf.done(); }
  clearInline(under);
}
async function animCoverIn(wrap, scrim) {
  scrim.style.opacity = '.4';
  const list = ui.RM
    ? [ui.animate(wrap, [{opacity: 0}, {opacity: 1}], {duration: 180, easing: 'linear'}), ui.animate(scrim, [{opacity: 0}, {opacity: .4}], {duration: 180})]
    : [ui.animate(wrap, [{transform: 'translateY(100%)'}, {transform: 'translateY(0)'}], {spring: 'smooth', fill: 'backwards'}), ui.animate(scrim, [{opacity: 0}, {opacity: .4}], {spring: 'smooth'})];
  wrap.classList.add('is-animating');
  await track(list);
  wrap.classList.remove('is-animating');
}
async function animCoverOut(wrap, scrim) {
  wrap.classList.add('is-animating');
  const list = ui.RM
    ? [ui.animate(wrap, [{opacity: 1}, {opacity: 0}], {duration: 180, fill: 'forwards'}), ui.animate(scrim, [{opacity: .4}, {opacity: 0}], {duration: 180, fill: 'forwards'})]
    : [ui.animate(wrap, [{transform: 'translateY(0)'}, {transform: 'translateY(100%)'}], {spring: 'smooth', fill: 'forwards'}), ui.animate(scrim, [{opacity: .4}, {opacity: 0}], {spring: 'smooth', fill: 'forwards'})];
  await track(list);
}
async function animSwap(out, inc, dir = 1) {
  if (!out || !inc) return;
  out.el.classList.add('is-animating'); inc.el.classList.add('is-animating');
  const list = ui.RM
    ? [ui.animate(out.el, [{opacity: 1}, {opacity: 0}], {duration: 120, fill: 'forwards'}), ui.animate(inc.el, [{opacity: 0}, {opacity: 1}], {duration: 180, delay: 60, fill: 'backwards'})]
    : [
      ui.animate(out.el, [{opacity: 1, transform: 'translateX(0)'}, {opacity: 0, transform: `translateX(${-24 * dir}px)`}], {duration: 160, easing: EASE_IN, fill: 'forwards'}),
      ui.animate(inc.el, [{opacity: 0, transform: `translateX(${24 * dir}px)`}, {opacity: 1, transform: 'translateX(0)'}], {duration: 240, easing: EASE_OUT, delay: 120, fill: 'backwards'})
    ];
  await track(list);
  clearInline(inc);
}

// ============================================================================ History projection (3.3)
let waiter = null;
// A silent history.go() whose popstate did not arrive within 400 ms may still land later (slow phones,
// iOS). `late` holds it until it lands or LATE_MS passes: the next history op waits for it first, and the
// landing re-anchors browser history to the projection (reanchor) instead of being ignored, so the app
// state and the browser never drift apart.
let late = null;
let anchor = null; // a late landing ({state}) not yet applied
const LATE_MS = 1600;
const Q = [];
let qBusy = false;
/** Serial op queue: history ops wait for their popstate before the next op runs. Idle queue runs synchronously. */
function run(op) {
  return new Promise(res => { Q.push({op, res}); if (!qBusy) drain(); });
}
async function drain() {
  qBusy = true;
  while (Q.length) {
    const {op, res} = Q.shift();
    let out;
    try { out = await op(); } catch (e) { console.error(e); }
    res(out);
  }
  qBusy = false;
}
const curIndex = () => { const st = history.state; return st && st.gg === 1 && typeof st.n === 'number' ? st.n : S.n; };
function armLate() {
  let resolve;
  const L = {claimed: false, promise: new Promise(r => { resolve = r; })};
  L.resolve = ev => { if (late === L) late = null; resolve(ev || null); };
  late = L;
  setTimeout(() => L.resolve(null), LATE_MS);
}
/** Waits for a pending late traversal (if any) and applies its landing, before a new history op. */
async function settleLate() {
  if (late) { late.claimed = true; await late.promise; }
  applyAnchor();
}
function applyAnchor() { if (!anchor) return; const a = anchor; anchor = null; reanchor(a.state); }
/** Silent history.go(delta): resolves with the popstate event, or null when it did not arrive in 400 ms.
 *  `from`: the current entry's index when history.state cannot tell (a hand-edited entry). */
async function go(delta, from) {
  await settleLate();
  return new Promise(res => {
    let done = false;
    const target = (from != null ? from : curIndex()) + delta;
    const to = setTimeout(() => {
      if (done) return;
      done = true; waiter = null;
      const st = history.state;
      // It landed but the event never reached us: treat it as arrived.
      if (st && st.gg === 1 && st.n === target) { res({state: st, synthetic: true}); return; }
      armLate(); // it may still land: the popstate listener re-anchors history then
      res(null);
    }, 400);
    waiter = ev => { if (done) return; done = true; clearTimeout(to); res(ev); };
    history.go(delta);
  });
}
const safeReplace = (n, path) => { try { history.replaceState({gg: 1, n}, '', '#' + path); } catch (_) {} };
const pushEntry = path => { S.n++; try { history.pushState({gg: 1, n: S.n}, '', '#' + path); } catch (_) {} };
/** A silent traversal landed after we stopped waiting (at entry m): rewrite history from there to the projection. */
function reanchor(state) {
  if (!state || state.gg !== 1 || typeof state.n !== 'number') { run(() => deepLink(location.hash, {warm: true})); return; }
  const P = projection();
  const m = Math.min(state.n, P.length - 1);
  safeReplace(m, P[m].path);
  for (let i = m + 1; i < P.length; i++) { try { history.pushState({gg: 1, n: i}, '', '#' + P[i].path); } catch (_) {} }
  S.n = P.length - 1;
}

function projection() {
  const P = [];
  const st = S.stacks[S.tab];
  if (S.tab === 'today') P.push({kind: 'root', entry: st[0], path: st[0].route.path});
  else {
    P.push({kind: 'base', path: S.stacks.today[0].route.path});
    P.push({kind: 'root', entry: st[0], path: st[0].route.path});
  }
  for (let i = 1; i < st.length; i++) P.push({kind: 'push', entry: st[i], path: st[i].route.path, depth: i});
  if (S.cover) P.push({kind: 'cover', entry: S.cover, path: S.cover.route.path});
  const under = P[P.length - 1].path;
  S.sheets.forEach(rec => P.push({kind: 'sheet', rec, path: under}));
  return P;
}
/** Rewrites browser history to the projection: silent go(-N) to the base, then replace + push. */
async function rebuildHistory() {
  if (S.n > 0) {
    const ev = await go(-S.n);
    if (!ev) {
      const P = projection();
      S.n = P.length - 1;
      safeReplace(S.n, P[S.n].path);
      return;
    }
  }
  const P = projection();
  safeReplace(0, P[0].path);
  for (let i = 1; i < P.length; i++) { try { history.pushState({gg: 1, n: i}, '', '#' + P[i].path); } catch (_) {} }
  S.n = P.length - 1;
}

addEventListener('popstate', e => {
  if (waiter) { const w = waiter; waiter = null; w(e); return; }
  const st = e.state, hash = location.hash;
  if (late) {
    // The late landing of a silent traversal: re-anchor (inline in the op that waits for it, else as an op).
    const L = late;
    anchor = {state: st};
    L.resolve(e);
    if (!L.claimed) run(applyAnchor);
    return;
  }
  run(() => handlePop(st, hash));
});

async function handlePop(state, hash, o = {}) {
  if (!state || state.gg !== 1 || typeof state.n !== 'number') {
    // A hand-edited hash is a new entry right above the current one (index S.n + 1): walk back to the base
    // silently, then rebuild it as a fresh deep link, so no second base entry is left behind.
    const k = S.n + 1;
    await go(-k, k);
    return deepLink(hash, {warm: true});
  }
  const n = state.n;
  if (n > S.n) return forwardTo(n, hash);
  if (n < S.n) await popTo(n, o);
  const P = projection();
  if (P.length - 1 !== n) { await rebuildHistory(); return; }
  S.n = n;
  if (location.hash !== '#' + P[n].path) safeReplace(n, P[n].path);
}

// Forward button (an entry above the current one). One step onto a pushed screen of this tab, or onto the
// cover, re-presents it in place (its entry already exists, so no history change). Anything else is a fresh
// deep link (spec 3.3), rebuilt from the base entry: walk back to it silently first (entry n sits at index n),
// so history never gains a second base entry or stale entries under the new projection.
async function forwardTo(n, hash) {
  const r = parseRoute(hash);
  if (r && n === S.n + 1 && !S.cover && !S.sheets.length) {
    if (r.open === 'push' && topOf(S.tab).route.path !== r.path) { await pushRoute(r, {addEntry: false}); return; }
    if (r.open === 'cover' && S.tab === 'today') { await openCover(r, {addEntry: false}); return; }
  }
  S.n = n;
  await go(-n);
  await deepLink(hash, {warm: true});
}

async function popTo(n, {animate = true} = {}) {
  const P = projection();
  const removed = P.slice(n + 1);
  S.n = n;
  if (!removed.length) return;
  const others = removed.filter(x => x.kind !== 'sheet');
  removed.filter(x => x.kind === 'sheet').reverse().forEach((x, i) => {
    const k = S.sheets.indexOf(x.rec);
    if (k >= 0) S.sheets.splice(k, 1);
    x.rec.dismiss(animate && !others.length && i === 0);
  });
  if (!others.length) return;
  const top = others[others.length - 1];
  const rootGone = others.some(x => x.kind === 'root');
  const target = P[n];
  if (top.kind === 'cover') {
    if (rootGone) { resetStack(S.tab); await switchTabUI('today', {motion: false}); }
    else if (others.some(x => x.kind === 'push')) instantPopTo(S.tab, target.kind === 'push' ? target.depth : 0);
    await dismissCover({animate});
    return;
  }
  if (rootGone) {
    // Back landed on the base entry (#/today): that is Today's root, so Today's remembered pushes go too
    // (otherwise the projection would need new entries the user never navigated to).
    resetStack(S.tab);
    resetStack('today');
    await switchTabUI('today', {motion: animate});
    return;
  }
  await popStack(S.tab, target.kind === 'push' ? target.depth : 0, {animate});
}
function instantPopTo(tab, depth) {
  const st = S.stacks[tab];
  st.splice(depth + 1).forEach(e => e.scr && unmountScreen(e.scr, {save: false}));
}
function resetStack(tab) { instantPopTo(tab, 0); }

async function popStack(tab, depth, {animate = true, v0 = 0} = {}) {
  const st = S.stacks[tab];
  if (st.length - 1 <= depth) return;
  const topE = st[st.length - 1];
  const target = st[depth];
  const middle = st.slice(depth + 1, -1);
  st.length = depth + 1;
  middle.forEach(e => e.scr && unmountScreen(e.scr, {save: true}));
  const topScr = topE.scr;
  const under = target.scr || await ensureScreen(target, {before: topScr ? topScr.el : null, z: depth + 1, transition: 'pop', restore: true, under: false});
  if (under) {
    under.el.removeAttribute('data-under');
    under.el.style.zIndex = String(depth + 1);
    under.ctx.transition = mkTransition('pop');
  }
  if (topScr) setVisible(topScr, false);
  syncVisibility();
  if (animate && topScr && tab === S.tab) await animPop(topScr, under, {v0});
  else clearInline(under);
  // Focus was on the popped screen (its back button): return it to what opened that screen, else the screen.
  const refocus = tab === S.tab && !S.cover && topScr && focusIsIn(topScr.el) && under && !under.dead;
  if (topScr) unmountScreen(topScr, {save: false});
  if (refocus) {
    const tr = [topE, ...middle].map(x => x.trigger).find(t => focusable(t) && under.el.contains(t));
    focusQuiet(tr || under.el);
  }
  refreshBackLabels();
}

// ============================================================================ Operations
async function stripOverlays({keepCover = false} = {}) {
  const sheetsN = S.sheets.length;
  const coverN = S.cover && !keepCover ? 1 : 0;
  const k = sheetsN + coverN;
  if (!k) return;
  S.sheets.splice(0).reverse().forEach(rec => rec.dismiss(false));
  if (coverN) await dismissCover({animate: false});
  if (S.n >= k) {
    const ev = await go(-k);
    S.n -= k;
    if (!ev) { const P = projection(); safeReplace(S.n, P[Math.min(S.n, P.length - 1)].path); }
  }
}

async function switchTabUI(T, {motion = true} = {}) {
  if (T === S.tab) return;
  finishTransitions();
  const st = S.stacks[T];
  const topE = st[st.length - 1];
  if (!topE.scr) await loadViewSafe(topE.route.view);
  const from = S.tab;
  saveLayerScroll(from);
  const fromTop = topOf(from).scr;
  // A link on one tab's screen that switches tabs: focus would be left in the hidden layer (then on <body>).
  const hadFocus = layerOf(from).contains(document.activeElement);
  setLayerHidden(layerOf(from), true);
  S.tab = T;
  setLayerHidden(layerOf(T), false);
  if (!topE.scr) {
    const m = mods.get(topE.route.view);
    buildScreen(topE, m || null, {z: st.length, transition: motion ? 'tab' : 'none', restore: false, err: m ? null : new Error('import failed')});
  } else {
    topE.scr.ctx.transition = mkTransition(motion ? 'tab' : 'none');
  }
  st.forEach((e, i) => { if (e.scr) { e.scr.el.style.zIndex = String(i + 1); if (e === topE) e.scr.el.removeAttribute('data-under'); else e.scr.el.setAttribute('data-under', ''); } });
  restoreLayerScroll(T);
  updateTabBar(T, {animate: motion});
  if (fromTop) setVisible(fromTop, false);
  syncVisibility();
  if (hadFocus && topE.scr) {
    const a = document.activeElement; // onShow may already have placed focus somewhere sensible
    if (!a || a === document.body || a.closest('.tab-layer[hidden]') || !a.getClientRects().length) focusQuiet(topE.scr.el);
  }
  if (motion && topE.scr) {
    // A hint of arrival only (.85→1): a deeper dip reads as the screen blinking on every tab tap.
    track([ui.animate(topE.scr.el, [{opacity: .85}, {opacity: 1}], {duration: 160, easing: EASE_OUT})]);
  }
}

async function setRootRoute(T, r) {
  const root = S.stacks[T][0];
  if (root.route.path === r.path) return;
  const same = root.route.view === r.view;
  root.route = r;
  root.savedTop = null;
  if (!root.scr) return;
  if (same) {
    applyRoute(root.scr, r);
    if (root.scr.visible) refresh(root.scr, 'params'); else markDirty(root.scr, 'params');
  } else {
    unmountScreen(root.scr, {save: false});
  }
}

async function showTop() {
  const st = S.stacks[S.tab];
  const top = st[st.length - 1];
  setLayerHidden(layerOf(S.tab), false);
  if (!top.scr) await ensureScreen(top, {z: st.length, restore: true, transition: 'none'});
  st.forEach((e, i) => {
    if (!e.scr) return;
    e.scr.el.style.zIndex = String(i + 1);
    if (e === top) e.scr.el.removeAttribute('data-under'); else e.scr.el.setAttribute('data-under', '');
  });
  syncVisibility();
}

function evict(tab) {
  const st = S.stacks[tab];
  for (let i = 1; i < st.length - 2; i++) if (st[i].scr) unmountScreen(st[i].scr, {save: true});
}

const focusQuiet = el => { if (!el) return; try { el.focus({preventScroll: true}); } catch (_) { try { el.focus(); } catch (_) {} } };
const focusable = el => !!(el && el.isConnected && typeof el.focus === 'function' && !el.closest('[inert], [hidden], [data-under]'));
const focusIsIn = el => { const a = document.activeElement; return !a || a === document.body || (!!el && el.contains(a)); };

async function pushRoute(r, {morphRect, addEntry = true} = {}) {
  await stripOverlays();
  const tab = S.tab;
  const st = S.stacks[tab];
  // A second tap on the same link (queued behind the first push) never pushes the same screen twice.
  if (st[st.length - 1].route.path === r.path) return;
  const outE = st[st.length - 1];
  if (!outE.scr) await ensureScreen(outE, {z: st.length, restore: true});
  const {v, err} = await loadViewSafe(r.view);
  finishTransitions();
  if (st[st.length - 1].route.path === r.path) return;
  const e = newEntry(r, tab, 'push');
  const out = outE.scr;
  // Remember what opened this screen, so popping it returns focus there.
  if (out && out.el.contains(document.activeElement)) e.trigger = document.activeElement;
  st.push(e);
  const scr = buildScreen(e, v, {z: st.length, transition: 'push', morphFrom: morphRect || null, restore: false, err});
  if (addEntry) pushEntry(r.path); else S.n++;
  evict(tab);
  syncVisibility();
  // Avatar morph: the view calls ui.morph(ctx.transition.morphFrom, heroEl) in mount (already ran above).
  const hadFocus = out && out.el.contains(document.activeElement);
  await animPush(scr, out);
  if (hadFocus && !scr.dead) focusQuiet(scr.el);
}

// A link to the root route a tab already shows (Today's "Record of the day" to the record Hall has in focus,
// a profile's "Nemesis" link to the pair Rivals shows) is still a navigation: the root starts at the top again
// and its view gets update(ctx) with reason 'params' (same ctx.path), so it can re-run deep-link behavior.
async function goRoot(r) {
  await stripOverlays();
  const T = r.tab;
  const root = S.stacks[T][0];
  const again = root.route.path === r.path && !!root.scr;
  if (T === S.tab) {
    const popping = S.stacks[T].length > 1;
    if (again && popping) root.scr.el.scrollTop = 0; // hidden under the pushed screens: reset before the pop
    if (popping) await popStack(T, 0, {animate: true});
    await setRootRoute(T, r);
    if (!topOf(T).scr) await showTop();
    if (again && root.scr && !root.scr.dead) {
      if (!popping && root.scr.el.scrollTop > 0) root.scr.el.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
      if (root.scr.visible) refresh(root.scr, 'params'); else markDirty(root.scr, 'params');
    }
    await rebuildHistory();
    return;
  }
  resetStack(T);
  await setRootRoute(T, r);
  if (again && root.scr) { root.savedTop = 0; markDirty(root.scr, 'params'); } // applied when the tab shows
  await switchTabUI(T, {motion: true});
  await rebuildHistory();
}

function buildCover(r, v, err, transition) {
  const e = newEntry(r, 'today', 'cover');
  const scrim = document.createElement('div');
  scrim.className = 'cover-scrim';
  const wrap = document.createElement('div');
  wrap.className = 'cover';
  $('covers').append(scrim, wrap);
  e.coverEl = wrap; e.scrimEl = scrim;
  S.cover = e;
  buildScreen(e, v, {container: wrap, transition, restore: false, err});
  $('stage').inert = true;
  $('tabbar').inert = true;
  return e;
}
// Covers take focus (the stage and tab bar go inert under them) and give it back to the trigger on dismiss.
function focusCover(e) {
  if (e && e.scr && !e.coverEl.contains(document.activeElement)) focusQuiet(e.scr.el);
}
async function openCover(r, {dir, addEntry = true} = {}) {
  if (S.cover) return swapCover(r, {dir});
  const trigger = document.activeElement;
  await stripOverlays();
  if (S.tab !== 'today') { await switchTabUI('today', {motion: false}); await rebuildHistory(); }
  const {v, err} = await loadViewSafe(r.view);
  finishTransitions();
  const e = buildCover(r, v, err, 'cover');
  e.trigger = trigger && trigger !== document.body ? trigger : null;
  if (addEntry) pushEntry(r.path); else S.n++;
  syncVisibility();
  focusCover(e);
  await animCoverIn(e.coverEl, e.scrimEl);
}
async function dismissCover({animate = true} = {}) {
  const c = S.cover;
  if (!c) return;
  S.cover = null;
  const hadFocus = focusIsIn(c.coverEl);
  $('stage').inert = false;
  $('tabbar').inert = false;
  const top = topOf(S.tab);
  if (!top.scr) await ensureScreen(top, {z: S.stacks[S.tab].length, restore: true});
  if (c.scr) setVisible(c.scr, false);
  syncVisibility();
  if (animate) await animCoverOut(c.coverEl, c.scrimEl);
  if (c.scr) unmountScreen(c.scr, {save: false});
  c.coverEl.remove();
  c.scrimEl.remove();
  if (hadFocus && !S.cover && !ui.sheetCount()) {
    const vis = visibleScreen();
    focusQuiet(focusable(c.trigger) ? c.trigger : vis && vis.el);
  }
}
async function swapCover(r, {dir} = {}) {
  const c = S.cover;
  const old = c.scr;
  const {v, err} = await loadViewSafe(r.view);
  finishTransitions();
  const oldView = c.route.view;
  c.route = r;
  c.scr = null;
  const inc = buildScreen(c, v, {container: c.coverEl, z: 2, transition: 'swap', restore: false, err});
  const k = projection().findIndex(x => x.entry === c);
  if (k === S.n) safeReplace(k, r.path);
  if (old) { old.el.style.zIndex = '1'; setVisible(old, false); }
  syncVisibility();
  const d = dir || (r.view === 'run' && oldView === 'results' ? -1 : 1);
  await animSwap(old, inc, d);
  if (old && old.el.contains(document.activeElement) && !inc.dead) focusQuiet(inc.el);
  if (old) unmountScreen(old, {save: false});
  inc.el.style.zIndex = '1';
}

async function opReplace(scr, path, {dir} = {}) {
  const r = parseRoute(path);
  if (!r) return;
  const e = scr.entry;
  if (e.scr !== scr || scr.dead) return;
  if (r.view === e.route.view) {
    const same = r.path === e.route.path;
    e.route = r;
    applyRoute(scr, r);
    const k = projection().findIndex(x => x.entry === e);
    if (k === S.n) safeReplace(k, r.path);
    if (!same) { if (scr.visible) refresh(scr, 'params'); else markDirty(scr, 'params'); }
    refreshBackLabels();
    return;
  }
  if (e.kind === 'cover') return swapCover(r, {dir});
  // Different view in a tab stack: swap in place with the inner-swap motion.
  const {v, err} = await loadViewSafe(r.view);
  if (e.scr !== scr) return;
  e.route = r;
  e.scr = null;
  const z = +scr.el.style.zIndex || 1;
  const inc = buildScreen(e, v, {z: z + 1, transition: 'swap', restore: false, err, container: scr.el.parentNode});
  const k = projection().findIndex(x => x.entry === e);
  if (k === S.n) safeReplace(k, r.path);
  setVisible(scr, false);
  syncVisibility();
  await animSwap(scr, inc, dir || 1);
  if (scr.el.contains(document.activeElement) && !inc.dead) focusQuiet(inc.el);
  unmountScreen(scr, {save: false});
  inc.el.style.zIndex = String(z);
  refreshBackLabels();
}

/** Deep link (cold boot, hand-edited hash, unknown history entry): rebuild the projection without animation. */
async function deepLink(hash, {warm = false} = {}) {
  let r = parseRoute(hash);
  if (!r) { r = parseRoute('/today'); ui.toast(BAD_LINK); }
  S.sheets.splice(0).reverse().forEach(rec => rec.dismiss(false));
  if (S.cover) await dismissCover({animate: false});
  let T;
  if (r.open === 'root') {
    T = r.tab;
    resetStack(T);
    await setRootRoute(T, r);
  } else if (r.open === 'push') {
    T = warm ? S.tab : r.home;
    resetStack(T);
    S.stacks[T].push(newEntry(r, T, 'push'));
  } else {
    T = 'today';
  }
  if (T !== S.tab) await switchTabUI(T, {motion: false});
  await showTop();
  if (r.open === 'cover') {
    const {v, err} = await loadViewSafe(r.view);
    buildCover(r, v, err, 'none');
    const c = S.cover;
    c.scrimEl.style.opacity = '.4';
    syncVisibility();
    focusCover(c);
  }
  const P = projection();
  safeReplace(0, P[0].path);
  for (let i = 1; i < P.length; i++) { try { history.pushState({gg: 1, n: i}, '', '#' + P[i].path); } catch (_) {} }
  S.n = P.length - 1;
  updateTabBar(S.tab, {animate: false});
}

async function opBack({animate = true} = {}) {
  if (S.n <= 0) {
    const P = projection();
    if (P.length > 1) { await popTo(P.length - 2, {animate}); S.n = 0; safeReplace(0, projection()[0].path); }
    return;
  }
  const ev = await go(-1);
  if (ev) return handlePop(ev.state, location.hash, {animate});
  await popTo(S.n - 1, {animate});
  const P = projection();
  safeReplace(S.n, P[Math.min(S.n, P.length - 1)].path);
}

// ============================================================================ Public navigation API
/** Navigate: tab-root routes switch tabs (resetting that stack), 'any' routes push, cover routes open over Today.
 *  opts.morphFrom: the tapped avatar element (flies to the new screen's [data-morph] element). */
export function nav(path, o = {}) {
  const morphRect = o.morphFrom && o.morphFrom.getBoundingClientRect ? o.morphFrom.getBoundingClientRect() : null;
  return run(async () => {
    const r = parseRoute(path);
    if (!r) { ui.toast(BAD_LINK); return; }
    if (r.open === 'cover') return openCover(r, o);
    if (r.open === 'root') return goRoot(r);
    return pushRoute(r, {morphRect});
  });
}
/** UI back: history.back() through the op queue. */
export function back(o) { return run(() => opBack(o)); }
function replaceFrom(scr, path, o) { return run(() => opReplace(scr, path, o || {})); }

ui._setHistory({
  pushOverlay(rec) {
    run(() => {
      if (rec.state !== 'open') return;
      S.sheets.push(rec);
      const P = projection();
      pushEntry(P[P.length - 1].path);
    });
    return rec;
  },
  // Closes THIS sheet (and any sheet opened over it), not just the topmost one.
  back(rec) {
    return run(async () => {
      const i = S.sheets.indexOf(rec);
      if (i < 0) { if (rec && rec.dismiss) rec.dismiss(true); return; } // its history entry was never pushed
      const depth = S.sheets.length - i;
      const ev = await go(-depth);
      if (ev) return handlePop(ev.state, location.hash);
      await popTo(S.n - depth);
      safeReplace(S.n, projection()[S.n].path);
    });
  }
});

// ============================================================================ Tab bar
let indX = null, indAnim = null;
function moveIndicator(btn, animate) {
  const ind = $('tabbar').querySelector('.tab-ind');
  if (!btn || !ind) return;
  const x = btn.offsetLeft + (btn.offsetWidth - 56) / 2;
  // Start from where the pill is on screen (mid-animation on quick successive taps), not from the last target.
  let from = indX;
  if (indAnim) {
    try { from = new DOMMatrixReadOnly(getComputedStyle(ind).transform).m41; } catch (_) {}
    indAnim.cancel();
    indAnim = null;
  }
  indX = x;
  ind.style.transform = `translateX(${x}px)`;
  ind.classList.add('is-ready');
  if (animate && from != null && Math.abs(from - x) > .5) {
    const a = ui.animate(ind, [{transform: `translateX(${from}px)`}, {transform: `translateX(${x}px)`}], {spring: 'snappy'});
    indAnim = a;
    const clear = () => { if (indAnim === a) indAnim = null; };
    a.finished.then(clear, clear);
  }
}
function updateTabBar(T, {animate = true} = {}) {
  let target = null;
  $('tabbar').querySelectorAll('.tab').forEach(b => {
    if (b.dataset.tab === T) { b.setAttribute('aria-current', 'page'); target = b; } else b.removeAttribute('aria-current');
  });
  moveIndicator(target, animate);
  if (animate && target) {
    ui.animate(target.querySelector('.tab-ic'), [{transform: 'scale(1)'}, {transform: 'scale(.86)', offset: .35}, {transform: 'scale(1)'}], {duration: 360, easing: 'ease-out'});
    ui.haptic('selection');
  }
}
// The tab icon is persistent chrome: until puzzles.json is loaded (a cold open on a history tab loads it at idle)
// it paints what this phone last showed today (gg-ring, same local date), else a neutral ring with no dot, so it
// never flashes a wrong "unfinished" state. The real state replaces it silently on 'ready'.
const RING_KEY = 'gg-ring';
const ringDate = () => new Date().toDateString();
function cachedRing() {
  try {
    const v = JSON.parse(ui.lsGet(RING_KEY) || 'null');
    return v && v.date === ringDate() && Array.isArray(v.parts) && (v.parts.length === 3 || v.parts.length === 5) ? v : null;
  } catch (_) { return null; }
}
// One arc per puzzle: three is ui.ring itself; five (v2 days) uses the same geometry with 64° arcs, so
// ui.ringUpdate keeps working on it. Mirrors ringHTML in views/board.js (kept here so boot never loads a view).
function stepRing(parts, o) {
  const n = parts.length;
  if (n === 3 || !n) return ui.ring(parts, o);
  const S = o.mini ? 24 : (o.size || 200), W = o.mini ? 3 : (o.stroke || 16);
  const r = (S - W) / 2, c = S / 2, trim = (W / 2) / r, slot = 360 / n, rad = d => d * Math.PI / 180;
  let tracks = '', fills = '';
  parts.forEach((p, i) => {
    const a0 = rad(4 + i * slot) + trim, a1 = rad(4 + i * slot + slot - 8) - trim;
    const d = `M${(c + r * Math.sin(a0)).toFixed(3)} ${(c - r * Math.cos(a0)).toFixed(3)}A${r} ${r} 0 0 1 ${(c + r * Math.sin(a1)).toFixed(3)} ${(c - r * Math.cos(a1)).toFixed(3)}`;
    const len = +(r * (a1 - a0)).toFixed(3), f = Math.min(1, Math.max(0, Number(p.frac) || 0));
    tracks += `<path class="ring-track${p.doneZero ? ' is-zero' : ''}" d="${d}" stroke-width="${W}"/>`;
    fills += `<path class="ring-fill${p.perfect ? ' is-perfect' : ''}${f <= 0 ? ' is-empty' : ''}" d="${d}" stroke-width="${W}" data-len="${len}" stroke-dasharray="${len} ${len}" style="stroke-dashoffset:${(len * (1 - f)).toFixed(3)}"/>`;
  });
  return `<div class="ring${o.mini ? ' ring-mini' : ''}" style="--rs:${S}px" aria-hidden="true" data-ring><svg viewBox="0 0 ${S} ${S}" aria-hidden="true" focusable="false">${tracks}${fills}</svg></div>`;
}
function dailyParts() {
  if (daily.status !== 'ready' || !daily.DAY) { const c = cachedRing(); return c ? c.parts : [{frac: 0}, {frac: 0}, {frac: 0}]; }
  // Rings show points: each arc fills with that puzzle's points / max (gold when perfect, ink-4 track when done with 0).
  return daily.STEPS.map(s => {
    const done = s.done(), p = s.pts();
    return {frac: Math.min(1, p / s.max), perfect: p === s.max, doneZero: done && p === 0};
  });
}
function updateTodayIcon(animate = false) {
  const btn = $('tabbar').querySelector('.tab[data-tab="today"]');
  if (!btn) return;
  const holder = btn.querySelector('.tab-ring');
  const parts = dailyParts();
  // A day with a different puzzle count (the cached ring, a v2 day) redraws the arcs; otherwise they update in place.
  if (!holder.firstElementChild || holder.querySelectorAll('.ring-fill').length !== parts.length) holder.innerHTML = stepRing(parts, {mini: true});
  else ui.ringUpdate(holder, parts, {animate});
  const ready = daily.status === 'ready' && !!daily.DAY;
  const cached = ready ? null : cachedRing();
  const left = ready ? daily.STEPS.filter(s => !s.done()).length : cached ? cached.left : null;
  btn.querySelector('.tab-dot').hidden = left == null || left === 0;
  let label = 'Today';
  if (left != null) label = left ? `Today, ${left === 1 ? '1 puzzle' : left + ' puzzles'} left` : 'Today, all puzzles done';
  btn.setAttribute('aria-label', label);
  if (ready && daily.DEV_DAY == null) { // a dev ?day= preview never caches its ring under the real date
    const v = JSON.stringify({date: ringDate(), parts, left});
    if (ui.lsGet(RING_KEY) !== v) ui.lsSet(RING_KEY, v);
  }
}
// Re-tap runs as a queued op: during a push/pop it waits for that op (the tap already finish()ed the motion),
// then acts on the settled stack. With an idle queue it runs synchronously, so focusSearch stays inside the tap.
function retap(T) { return run(() => doRetap(T)); }
async function doRetap(T) {
  if (T !== S.tab || S.cover || S.sheets.length) return;
  const st = S.stacks[T];
  if (st.length > 1) {
    const depth = st.length - 1;
    const ev = await go(-depth);
    if (ev) return handlePop(ev.state, location.hash);
    await popTo(S.n - depth);
    safeReplace(S.n, projection()[S.n].path);
    return;
  }
  const scr = st[0].scr;
  if (!scr) return;
  if (scr.el.scrollTop > 2) { scr.el.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'}); return; }
  if (T === 'moves') {
    const ns = modNS.get('moves');
    try {
      if (ns && typeof ns.focusSearch === 'function') ns.focusSearch(scr.ctx);
      else if (scr.view.onAction) scr.view.onAction('focus-search', scr.ctx);
    } catch (e) { console.error(e); }
  }
}
function setupTabBar() {
  const bar = $('tabbar');
  bar.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    const T = b.dataset.tab;
    finishTransitions();
    if (T === S.tab) { retap(T); return; }
    run(async () => {
      if (T === S.tab) return;
      await stripOverlays();
      await switchTabUI(T, {motion: true});
      await rebuildHistory();
    });
  });
  updateTabBar(S.tab, {animate: false});
  updateTodayIcon(false);
  daily.subscribe(t => { if (t === 'progress' || t === 'ready' || t === 'newday') updateTodayIcon(t === 'progress'); });
  addEventListener('resize', () => {
    const cur = bar.querySelector('.tab[aria-current="page"]');
    if (cur) moveIndicator(cur, false);
    const v = visibleScreen();
    if (v) { checkNavHeight(v); fitNavTitle(v); }
  }, {passive: true});
}

// ============================================================================ Swipe-back (3.4; iOS standalone only)
let swipeOn = false;
/** Enables the edge swipe-back gesture (automatic in the iOS home-screen app). */
export function enableSwipeBack() {
  if (swipeOn) return;
  swipeOn = true;
  const stage = $('stage');
  let g = null;
  const vel = s => {
    if (s.length < 2) return 0;
    const a = s[0], b = s[s.length - 1];
    if (performance.now() - b[0] > 100) return 0; // the finger rested before lifting: no fling
    return b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0;
  };
  stage.addEventListener('touchstart', e => {
    g = null;
    release();
    if (e.touches.length !== 1 || S.cover || S.sheets.length || running.size || qBusy) return;
    const t = e.touches[0];
    const left = stage.getBoundingClientRect().left;
    if (t.clientX - left > 20) return;
    const st = S.stacks[S.tab];
    if (st.length < 2) return;
    if (e.target.closest && e.target.closest('[data-hscroll]')) return;
    g = {x0: t.clientX, y0: t.clientY, locked: false, topE: st[st.length - 1], underE: st[st.length - 2], s: [[performance.now(), t.clientX]], x: 0, p: 0};
    // Only an edge gesture gets a non-passive listener (to preventDefault after the axis lock); every other
    // touch on the stage, and all scrolling, sees passive listeners only (spec 11).
    stage.addEventListener('touchmove', blocker, {passive: false});
  }, {passive: true});
  const blocker = e => { if (g && g.locked && e.cancelable) e.preventDefault(); };
  const release = () => { stage.removeEventListener('touchmove', blocker, {passive: false}); };
  stage.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) || dx <= 0) { g = null; release(); return; }
      const top = g.topE.scr;
      const under = ensureScreenSync(g.underE, {before: top && top.el, z: S.stacks[S.tab].length - 1, restore: true, transition: 'pop'});
      if (!top || !under) { g = null; release(); return; }
      g.top = top; g.under = under; g.w = stage.clientWidth; g.locked = true;
      under.el.removeAttribute('data-under');
      pinLayers(top); pinLayers(under);
      top.el.classList.add('is-animating'); under.el.classList.add('is-animating');
      top.edge.style.opacity = '1';
      g.xf = navXfade(top, under, -1);
      ui.busy.inc();
    }
    // preventDefault happens in `blocker` (registered after this listener, same dispatch).
    g.x = Math.max(0, dx);
    g.p = Math.min(1, g.x / g.w);
    g.top.el.style.transform = `translateX(${g.x}px)`;
    g.under.el.style.transform = `translateX(${-30 * (1 - g.p)}%)`;
    g.under.dim.style.opacity = String(.3 * (1 - g.p));
    if (g.xf) g.xf.set(g.p);
    const now = performance.now();
    g.s.push([now, t.clientX]);
    while (g.s.length > 2 && now - g.s[0][0] > 100) g.s.shift();
  }, {passive: true});
  const end = async () => {
    release();
    if (!g) return;
    const G = g;
    g = null;
    if (!G.locked) return;
    ui.busy.dec();
    const v = vel(G.s);
    const commit = G.p > .5 || v > .35;
    const toX = commit ? G.w : 0;
    const dist = toX - G.x;
    const v0 = dist ? (v * 1000) / dist : 0;
    const uFrom = -30 * (1 - G.p), uTo = commit ? 0 : -30;
    const list = [
      ui.animate(G.top.el, [{transform: `translateX(${G.x}px)`}, {transform: `translateX(${toX}px)`}], {spring: 'smooth', v0, fill: 'forwards'}),
      ui.animate(G.under.el, [{transform: `translateX(${uFrom}%)`}, {transform: `translateX(${uTo}%)`}], {spring: 'smooth', v0, fill: 'forwards'}),
      ui.animate(G.under.dim, [{opacity: .3 * (1 - G.p)}, {opacity: commit ? 0 : .3}], {spring: 'smooth', v0, fill: 'forwards'}),
      ...(G.xf ? G.xf.run(G.p, commit ? 1 : 0, {v0}) : [])
    ];
    G.top.el.style.transform = `translateX(${toX}px)`;
    G.under.el.style.transform = `translateX(${uTo}%)`;
    G.under.dim.style.opacity = commit ? '0' : '.3';
    try { await track(list); } finally { if (G.xf) G.xf.done(); }
    list.forEach(a => a.cancel());
    if (commit) {
      back({animate: false});
    } else {
      G.under.el.setAttribute('data-under', '');
      clearInline(G.under);
      clearInline(G.top);
    }
  };
  stage.addEventListener('touchend', end, {passive: true});
  stage.addEventListener('touchcancel', end, {passive: true});
}

// ============================================================================ Global delegation
document.addEventListener('click', e => {
  if (e.defaultPrevented) return;
  const t = e.target && e.target.closest && e.target.closest('[data-nav-back], [data-back], [data-nav-action], [data-screen-retry], a[href^="#/"], [data-nav]');
  if (!t) return;
  if (t.matches('[data-nav-back], [data-back]')) { e.preventDefault(); back(); return; }
  if (t.matches('[data-screen-retry]')) { const s = secMap.get(t.closest('section.screen')); if (s) retryScreen(s); return; }
  if (t.matches('[data-nav-action]')) {
    const s = secMap.get(t.closest('section.screen'));
    if (!s || !s.view || !s.view.onAction) return;
    let out;
    try { out = s.view.onAction(t.dataset.navAction, s.ctx); } catch (err) { console.error(err); }
    Promise.resolve(out).then(() => renderActions(s), () => renderActions(s));
    return;
  }
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const path = t.getAttribute('data-nav') || (t.getAttribute('href') || '').slice(1);
  if (!path) return;
  e.preventDefault();
  const mf = t.matches('[data-morph-from]') ? t : t.querySelector('[data-morph-from]');
  nav(path, {morphFrom: mf || undefined});
});
// The shell never scrolls. Browsers without overflow:clip let focus() scroll an overflow:hidden box (a button in a
// translated sheet, a screen mid-push), which would shift the whole app: undo it at once.
document.addEventListener('scroll', e => {
  const t = e.target;
  if (!t || t.nodeType !== 1 || !(t.id === 'app' || t.id === 'stage' || t.classList.contains('cover'))) return;
  if (t.scrollTop || t.scrollLeft) { t.scrollTop = 0; t.scrollLeft = 0; }
}, {capture: true, passive: true});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || ui.sheetCount()) return;
  if (S.cover) { e.preventDefault(); back(); }
});

// Data and "me" changes: update visible screens now, the rest when they are next shown.
// 'me' applies at once (it follows a tap); 'data' waits for ui.whenIdle so a reload never swaps
// content in the middle of an animation or a scroll.
data.subscribe(type => {
  if (type !== 'data' && type !== 'me') return;
  const apply = () => {
    allMounted().forEach(s => {
      if (s.visible) refresh(s, type);
      else markDirty(s, type);
    });
    refreshBackLabels();
  };
  if (type === 'data') ui.whenIdle(apply); else apply();
});

// ============================================================================ Install prompt
/** The captured beforeinstallprompt event (live binding), or null. */
export let installEvent = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; });
addEventListener('appinstalled', () => { installEvent = null; });
/** Shows the captured install prompt. Resolves true when accepted. */
export async function promptInstall() {
  const ev = installEvent;
  if (!ev) return false;
  installEvent = null;
  try { ev.prompt(); const r = await ev.userChoice; return !!r && r.outcome === 'accepted'; } catch (_) { return false; }
}

// ============================================================================ Boot
function removeBoot() {
  const b = $('boot');
  if (!b) return;
  b.classList.add('is-out');
  setTimeout(() => b.remove(), 220);
}
function showFatal() {
  removeBoot();
  const f = document.createElement('div');
  f.className = 'fatal';
  f.innerHTML = ui.empty({icon: 'football', title: "Can't load the league. Check your connection.", action: {label: 'Try again', kind: 'primary', attrs: {'data-boot-retry': ''}}});
  $('app').appendChild(f);
  const btn = f.querySelector('[data-boot-retry]');
  btn.addEventListener('click', async () => {
    ui.setLoading(btn, true);
    try { await data.load(); f.remove(); await run(start); }
    catch (_) { ui.setLoading(btn, false); ui.toast("Still can't reach the league."); }
  });
}
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
let lastVisibleCheck = 0;
function onVisibility() {
  const vis = !document.hidden;
  allMounted().forEach(s => { if (vis && s.visible) resumeTimers(s); else pauseTimers(s); });
  if (!vis) { persistScroll(); return; }
  try { daily.checkDay(); } catch (_) {}
  const now = Date.now();
  if (now - (data.lastLoad || 0) > 30 * 60 * 1000 && now - lastVisibleCheck > 60 * 1000) {
    lastVisibleCheck = now;
    // Only a new week earns a toast; other edits (a score correction, a records line) apply quietly.
    data.reload().then(r => { if (r && r.newWeek && r.throughWeek) ui.toast(`Week ${r.throughWeek} is in.`); }).catch(() => {});
  }
}
// A reload on a pushed screen keeps this session's earlier entries below the current one. Boot walks back to
// the base entry silently before rebuilding, so the projection replaces them instead of stacking a second
// base on top. If that walk turns out to be a page load (some browsers), window.name carries the target
// screen across it for a few seconds (no storage keys involved).
const BOOT_MARK = 'gg-boot:';
function takeBootMark() {
  try {
    const nm = String(window.name || '');
    if (!nm.startsWith(BOOT_MARK)) return null;
    const o = JSON.parse(nm.slice(BOOT_MARK.length));
    window.name = o.prev || '';
    return o && Date.now() - o.t < 10000 && typeof o.h === 'string' ? o.h : null;
  } catch (_) { return null; }
}
async function start() {
  let hash0 = location.hash;
  const st0 = history.state;
  const marked = takeBootMark();
  if (marked && st0 && st0.gg === 1 && st0.n === 0) hash0 = marked;
  const first = parseRoute(hash0);
  if (first && first.tab === 'today') daily.ensure().catch(() => {});
  if (st0 && st0.gg === 1 && typeof st0.n === 'number' && st0.n > 0) {
    try { window.name = BOOT_MARK + JSON.stringify({h: hash0, t: Date.now(), prev: window.name || ''}); } catch (_) {}
    S.n = st0.n;
    const ev = await go(-st0.n);
    if (ev) takeBootMark(); else setTimeout(takeBootMark, LATE_MS + 200); // late or never: drop the mark after the window
    S.n = 0;
  }
  await deepLink(hash0, {warm: false});
  removeBoot();
  // First open on this phone: ask who they are (a full-screen picker over whatever screen the link opened).
  if (needsWelcome()) showWelcome();
  setupTabBar();
  if (ui.IOS_STANDALONE) enableSwipeBack();
  requestAnimationFrame(() => ui.onIdle(() => {
    daily.ensure().catch(() => {});
    TABS.forEach(id => loadView(id).catch(() => {}));
    ui.onIdle(() => ['season', 'profile', 'review', 'wrap', 'run', 'results'].forEach(id => loadView(id).catch(() => {})));
    registerSW();
  }));
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pagehide', persistScroll);
  setInterval(() => { if (!document.hidden) { try { daily.checkDay(); } catch (_) {} } }, 60 * 1000);
}
async function boot() {
  const html = document.documentElement;
  if (ui.LITE) html.classList.add('lite');
  if (ui.IOS_STANDALONE) html.classList.add('ios-standalone');
  if (ui.STANDALONE) html.classList.add('standalone');
  ui.installSpringVars();
  try { history.scrollRestoration = 'manual'; } catch (_) {}
  const h = location.hash.replace(/^#/, '');
  if (LEGACY[h]) { try { history.replaceState(null, '', '#' + LEGACY[h]); } catch (_) {} }
  TABS.forEach(t => { S.stacks[t] = [newEntry(parseRoute(ROOTS[t]), t, 'root')]; });
  try { await data.load(); } catch (e) { console.error(e); showFatal(); return; }
  await start();
}

// Debug handle for the dev gallery and manual testing (read-only use).
export const __dev = {S, projection, parseRoute, allMounted, get queueBusy() { return qBusy; }, enableSwipeBack};

run(boot);
