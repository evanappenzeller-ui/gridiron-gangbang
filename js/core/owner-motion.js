// Optional interface polish for every profile. Cards stay readable if observation or animation is unavailable.
import {available} from './features.js';
import * as ui from './ui.js';

const CARDS = '[data-enter], .card, .std-scard, .pk-slot';
const EASE = 'cubic-bezier(.22,1,.36,1)';
const screens = new Map();
let visits = new WeakMap();
let sheet = null, rootObserver = null, started = false, motionAllowed = false;
const allowed = () => started && available() && !ui.RM && !document.documentElement.classList.contains('rm') && !document.hidden;

// A card replaced by a live score refresh keeps its place in the reveal history.
function cardKey(el, body) {
  const path = [];
  for (let n = el; n && n !== body; n = n.parentElement) {
    const key = n.id || n.getAttribute('data-key') || n.getAttribute('data-slot');
    path.push(key || `${n.tagName}:${Array.prototype.indexOf.call(n.parentElement.children, n)}`);
  }
  return path.reverse().join('/');
}
function clear(record) {
  record.io?.disconnect();
  record.mo?.disconnect();
  cancelAnimationFrame(record.frame);
  record.frame = 0;
  record.io = record.mo = null;
  record.pending.clear();
  record.animations.forEach(a => a.cancel());
  record.animations.clear();
}
function reveal(record, el, delay) {
  if (!allowed() || !record.scr.visible || record.scr.dead || !el.isConnected) return;
  // A local view may own a chart, flip or section crossfade already.
  for (let n = el; n && n !== record.scr.el; n = n.parentElement) {
    if (n.getAnimations?.().some(a => a.playState === 'running')) return;
  }
  const a = ui.animate(el, [
    {opacity: 0, translate: '0 12px'},
    {opacity: 1, translate: '0 0'}
  ], {duration: 340, delay, easing: EASE, fill: 'backwards'});
  record.animations.add(a);
  const done = () => { record.animations.delete(a); a.cancel(); };
  a.finished.then(done, done);
}
function scan(record, quiet = false) {
  if (!allowed() || !record.scr.visible || record.scr.dead || !record.io) return;
  const body = record.scr.body;
  const path = record.scr.ctx.path;
  if (record.path !== path) {
    clear(record);
    record.path = path;
    record.seen = new Set();
    visits.set(record.scr, {path, seen: record.seen});
    watch(record, quiet);
    return;
  }
  for (const el of record.pending.keys()) {
    if (!body.contains(el)) { record.io.unobserve(el); record.pending.delete(el); }
  }
  const nodes = [...body.querySelectorAll(CARDS)];
  const set = new Set(nodes);
  nodes.forEach(el => {
    // Reveal a containing card/section once, never move all of its children again.
    for (let p = el.parentElement; p && p !== body; p = p.parentElement) if (set.has(p)) return;
    if (el.closest('[hidden], [aria-hidden="true"], .gm-z, .gm-slot, .pf-chart, .pf-names')) return;
    const key = cardKey(el, body);
    if (record.seen.has(key) || record.pending.has(el)) return;
    if (quiet) {
      const rect = el.getBoundingClientRect(), viewport = record.scr.el.getBoundingClientRect();
      if (rect.height && rect.bottom > viewport.top && rect.top < viewport.bottom) {
        record.seen.add(key);
        return;
      }
    }
    record.pending.set(el, key);
    record.io.observe(el);
  });
}
function watch(record, quiet = false) {
  if (!allowed() || record.io || typeof IntersectionObserver === 'undefined') return;
  record.io = new IntersectionObserver(entries => {
    if (!allowed() || !record.scr.visible || record.scr.dead) { clear(record); return; }
    let order = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting || !entry.boundingClientRect.height) return;
      const el = entry.target, key = record.pending.get(el);
      if (key == null) return;
      record.pending.delete(el);
      record.io.unobserve(el);
      if (record.seen.has(key)) return;
      record.seen.add(key);
      reveal(record, el, Math.min(order++ * 35, 140));
    });
  }, {root: record.scr.el, threshold: 0, rootMargin: '0px 0px -20px 0px'});
  if (typeof MutationObserver !== 'undefined') {
    // (only new elements can be new cards: a game's counters changing text every frame never need a scan)
    const addsElements = list => list.some(m => { for (const n of m.addedNodes) if (n.nodeType === 1) return true; return false; });
    record.mo = new MutationObserver(list => {
      if (record.frame || !addsElements(list)) return;
      record.frame = requestAnimationFrame(() => { record.frame = 0; scan(record); });
    });
    record.mo.observe(record.scr.body, {childList: true, subtree: true});
  }
  scan(record, quiet);
}
function syncPreference() {
  const next = allowed();
  if (next === motionAllowed) return;
  motionAllowed = next;
  screens.forEach(record => { if (next) watch(record); else clear(record); });
}
export function start() {
  if (!available() || started) return;
  started = true;
  sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('../../css/owner-motion.css', import.meta.url).href;
  document.head.appendChild(sheet);
  rootObserver = new MutationObserver(syncPreference);
  rootObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
  document.addEventListener('visibilitychange', syncPreference);
  syncPreference();
}
export function stop() {
  started = motionAllowed = false;
  screens.forEach(clear);
  screens.clear();
  visits = new WeakMap();
  rootObserver?.disconnect();
  rootObserver = null;
  document.removeEventListener('visibilitychange', syncPreference);
  sheet?.remove();
  sheet = null;
}
export function show(scr) {
  if (!started || !available() || !scr.visible || scr.dead || scr.entry.kind === 'cover') return;
  if (screens.has(scr)) return;
  let visit = visits.get(scr);
  if (!visit || visit.path !== scr.ctx.path) {
    visit = {path: scr.ctx.path, seen: new Set()};
    visits.set(scr, visit);
  }
  const record = {scr, body: scr.body, path: visit.path, seen: visit.seen, pending: new Map(), animations: new Set(), io: null, mo: null, frame: 0};
  screens.set(scr, record);
  watch(record);
}
export function hide(scr) {
  const record = screens.get(scr);
  if (record) clear(record);
  screens.delete(scr);
}
export function refresh(scr, quiet = false) {
  const record = screens.get(scr);
  if (!record) return;
  if (record.body !== scr.body) {
    clear(record);
    record.body = scr.body;
    watch(record, quiet);
    return;
  }
  scan(record, quiet);
}
