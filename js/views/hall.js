// Hall tab: Trophies | Records (spec 7.13, 7.14). Owner: hall package.
// This module owns the large title and the segmented control; the two segments live in
// hall-trophies.js and hall-records.js ({render, mount, unmount} plus optional show/params hooks).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as trophies from './hall-trophies.js';
import * as records from './hall-records.js';

const SEGS = {trophies, records};
const segOf = ctx => (ctx && ctx.params && ctx.params.seg === 'records') ? 'records' : 'trophies';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Per-screen state, keyed by the screen's ctx (one Hall root exists, but a retry builds a new one).
const ST = new WeakMap();

function subtitle() {
  const s = data.DONE.length;
  if (!s) return 'No titles decided yet.';
  const c = new Set(data.DONE.map(x => x.champion)).size;
  return `${plural(s, 'season')} · ${c} different champion${c === 1 ? '' : 's'}`;
}

function segHTML(value) {
  return `<div class="hl-seg">${ui.seg({name: 'hall-seg', items: [{id: 'trophies', label: 'Trophies'}, {id: 'records', label: 'Records'}], value, label: 'Hall section'})}</div>`;
}

// Keep the segmented control on screen after a segment change that came from outside the control
// (a deep link, a legacy #records hash) while the old segment was scrolled far down.
function clampScroll(st, ctx) {
  const scr = ctx.screen, seg = st.el.querySelector('.hl-seg');
  if (!scr || !seg) return;
  const nav = scr.querySelector(':scope > .nav');
  const navH = nav ? nav.offsetHeight : 44;
  const top = seg.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop;
  const max = Math.max(0, top - navH - 8);
  if (scr.scrollTop > max) scr.scrollTop = max;
}

function swap(st, ctx, seg, {fade}) {
  try { SEGS[st.seg].unmount(); } catch (e) { console.error(e); }
  const body = st.body;
  const put = () => {
    body.innerHTML = SEGS[seg].render(ctx);
    body.dataset.seg = seg;
    st.seg = seg;
    SEGS[seg].mount(body, ctx);
  };
  if (fade && ctx.visible && !ui.RM) ui.crossfade(body, put, {duration: 120});
  else put();
}

export default {
  id: 'hall',
  title: 'Hall',

  render(ctx) {
    const seg = segOf(ctx);
    return ui.largeTitle({title: 'Hall', subtitle: subtitle()})
      + segHTML(seg)
      + `<div class="hl-body" data-seg="${seg}">${SEGS[seg].render(ctx)}</div>`;
  },

  mount(el, ctx) {
    const seg = segOf(ctx);
    const st = {el, body: el.querySelector('.hl-body'), seg};
    ST.set(ctx, st);
    el.addEventListener('ui:change', e => {
      if (!e.detail || e.detail.name !== 'hall-seg') return;
      ctx.replace(e.detail.value === 'records' ? '/hall/records' : '/hall/trophies');
    });
    SEGS[seg].mount(st.body, ctx);
    if (ctx.first) ui.stagger(el);
  },

  update(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    const seg = segOf(ctx);
    const sub = st.el.querySelector('.lt-sub');
    if (sub) { const t = subtitle(); if (sub.textContent !== t) sub.textContent = t; }
    const segEl = st.el.querySelector('.hl-seg > .seg');
    if (segEl) ui.setSeg(segEl, seg, {animate: ctx.visible});
    if (ctx.reason === 'params') {
      if (seg === st.seg) {
        // Same segment, new params (a different record in focus).
        if (SEGS[seg].params) SEGS[seg].params(ctx);
        return;
      }
      clampScroll(st, ctx); // before the swap, so a record focused by the new segment's mount keeps its scroll
      swap(st, ctx, seg, {fade: true});
      return;
    }
    // 'data' (league.json changed) or 'me': rebuild the segment quietly, keeping the scroll position.
    const top = ctx.screen ? ctx.screen.scrollTop : 0;
    swap(st, ctx, seg, {fade: false});
    if (ctx.screen) ctx.screen.scrollTop = top;
  },

  onShow(ctx) {
    const st = ST.get(ctx);
    if (st && SEGS[st.seg].show) SEGS[st.seg].show(ctx);
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    try { SEGS[st.seg].unmount(); } catch (e) { console.error(e); }
    ST.delete(ctx);
  }
};
