// League tab root (#/league/standings, #/league/trophies, #/league/records[/<focus>], #/league/shame[?y=<year>],
// #/league/draft[/trades|/repeats|/<year>]: the Draft segment, league-draft.js):
// the large title "League" (your avatar button trailing: app.js opens the You sheet on a [data-you] tap and redraws it
// after a 'me' change) over a segmented control Standings · Trophies · Records · Shame · Draft. The segments live in standings.js,
// hall-trophies.js, hall-records.js (Record of the day on top) and hall-shame.js: {render, mount, unmount} plus
// optional show/params/me hooks, and actions/onAction for the compact-bar buttons (Standings' Sort and table/list).
// This module owns the title, the control, segment swaps (a quick cross-fade that keeps the control in view; a segment
// opened again from the control gets back its own scroll position), quiet
// rebuilds on a data reload (page and rail positions kept) and the idle prefetch of Shame's stats.
// Route params (app.js): {seg: 'standings' | 'trophies' | 'records' | 'shame', focus?: '<section>.<item>'} with the
// query {y?: '<year>'} for Shame; a missing seg is read from the path, then defaults to Standings. hall.js re-exports
// this view, so a registry entry under either id works. Owner: LEAGUE (was the Standings and Hall tab roots).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import {youButtonHTML} from './you.js';
import * as standings from './standings.js';
import * as trophies from './hall-trophies.js';
import * as records from './hall-records.js';
import * as shame from './hall-shame.js';
import * as draft from './league-draft.js';

const SEGS = {standings, trophies, records, shame, draft};
const SEG_IDS = ['standings', 'trophies', 'records', 'shame', 'draft'];
const SEG_ITEMS = [{id: 'standings', label: 'Standings'}, {id: 'trophies', label: 'Trophies'}, {id: 'records', label: 'Records'}, {id: 'shame', label: 'Shame'}, {id: 'draft', label: 'Draft'}];
/** Canonical path of a segment's plain route. */
export const segPath = seg => '/league/' + (SEG_IDS.includes(seg) ? seg : 'standings');

function segOf(ctx) {
  const s = ctx && ctx.params && ctx.params.seg;
  if (SEG_IDS.includes(s)) return s;
  const m = /^\/(?:league|hall)\/([a-z]+)/.exec(String((ctx && (ctx.path || ctx.route)) || ''));
  return m && SEG_IDS.includes(m[1]) ? m[1] : 'standings';
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Per-screen state, keyed by the screen's ctx (one League root exists, but a retry builds a new one).
const ST = new WeakMap();

// Eyebrow "2021–2026" (the league's span, was Standings'; every tab root has an eyebrow, so the title and the avatar
// button sit at the same height on all five) over the subtitle "12 managers · 4 champions" (the Hall's title count).
function eyebrow() {
  const sp = data.span;
  if (sp.first == null) return '';
  return sp.first === sp.last ? String(sp.first) : `${sp.first}–${sp.last}`;
}
function subtitle() {
  const sp = data.span;
  if (sp.first == null) return '';
  const parts = [plural(sp.managers, 'manager')];
  const c = new Set(data.DONE.map(x => x.champion).filter(Boolean)).size;
  if (c) parts.push(plural(c, 'champion'));
  return parts.join(' · ');
}

function segHTML(value) {
  return `<div class="hl-seg">${ui.seg({name: 'league-seg', items: SEG_ITEMS, value, label: 'League section'})}</div>`;
}

// Keep the segmented control on screen after a segment change that came from outside the control
// (a deep link, a legacy #records hash) while the old segment was scrolled far down, and for a segment the control
// opens for the first time (see restoreTop for the ones it has shown before).
function clampScroll(st, ctx) {
  const scr = ctx.screen, seg = st.el.querySelector('.hl-seg');
  if (!scr || !seg) return;
  const nav = scr.querySelector(':scope > .nav');
  const navH = nav ? nav.offsetHeight : 44;
  const top = seg.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop;
  const max = Math.max(0, top - navH - 8);
  if (scr.scrollTop > max) scr.scrollTop = max;
}

// Horizontal rails (and the all-time table) keep their position across a quiet rebuild (a data reload).
const RAILS = ['.ff-rail', '.sc-rail', '.sm-rail', '.std-rail', '.std-tscroll'];
function railPos(st) {
  return RAILS.map(sel => { const r = st.body.querySelector(sel); return r ? r.scrollLeft : 0; });
}
function restoreRails(st, pos) {
  RAILS.forEach((sel, i) => { const r = st.body.querySelector(sel); if (r && pos[i]) r.scrollLeft = pos[i]; });
}

// Each segment keeps its own place (st.tops: seg -> scrollTop, noted as it is left): going back to one with the
// control lands where you were in it, clamped to its height now. Deep links from outside still clamp instead.
function restoreTop(st, ctx, seg) {
  const scr = ctx.screen, top = st.tops[seg];
  if (!scr || top == null) return false;
  scr.scrollTop = Math.max(0, Math.min(top, scr.scrollHeight - scr.clientHeight));
  return true;
}

function unmountSeg(st, ctx) {
  try { SEGS[st.seg].unmount(st.body, ctx); } catch (e) { console.error(e); }
}
function swap(st, ctx, seg, {fade}) {
  unmountSeg(st, ctx);
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

// Warm what the other segments load on demand (Shame's numbers come from stats.js), so they open filled in.
function prefetch(seg) {
  ui.onIdle(() => { if (seg !== 'shame') shame.prefetch().catch(() => {}); });
}

export default {
  id: 'league',
  title: 'League',

  // Standings' Sort and table/list while it shows; the Hall segments have none.
  actions(ctx) {
    const seg = segOf(ctx);
    return SEGS[seg].actions ? SEGS[seg].actions(ctx) : [];
  },

  render(ctx) {
    const seg = segOf(ctx);
    return ui.largeTitle({eyebrow: eyebrow(), title: 'League', subtitle: subtitle(), trailing: youButtonHTML()})
      + segHTML(seg)
      + `<div class="hl-body" data-seg="${seg}">${SEGS[seg].render(ctx)}</div>`;
  },

  mount(el, ctx) {
    // The stylesheets are scoped to .v-league; the screen carries it under either registry id.
    if (ctx.screen) ctx.screen.classList.add('v-league');
    const seg = segOf(ctx);
    const st = {el, body: el.querySelector('.hl-body'), seg, path: ctx.path, tops: {}, fromCtl: null};
    ST.set(ctx, st);
    el.addEventListener('ui:change', e => {
      if (!e.detail || e.detail.name !== 'league-seg') return;
      st.fromCtl = e.detail.value; // update() restores that segment's own place
      ctx.replace(segPath(e.detail.value));
    });
    SEGS[seg].mount(st.body, ctx);
    if (ctx.first) ui.stagger(el);
    prefetch(seg);
  },

  update(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    const seg = segOf(ctx);
    const sub = st.el.querySelector('.lt-sub');
    if (sub) { const t = subtitle(); if (sub.textContent !== t) sub.textContent = t; }
    const eb = st.el.querySelector('.lt-eyebrow');
    if (eb) { const t = eyebrow(); if (eb.textContent !== t) eb.textContent = t; }
    const segEl = st.el.querySelector('.hl-seg > .seg');
    if (segEl) ui.setSeg(segEl, seg, {animate: ctx.visible});
    // 'params' also arrives for a link to the route already shown (same path): re-run the focus then.
    const routed = ctx.reason === 'params' || ctx.path !== st.path;
    st.path = ctx.path;
    const fromCtl = st.fromCtl === seg;
    st.fromCtl = null;
    if (seg !== st.seg && ctx.screen) st.tops[st.seg] = ctx.screen.scrollTop; // the segment being left
    if (ctx.reason === 'data') {
      // league.json changed: rebuild the segment quietly, keeping the page and rail positions.
      const same = seg === st.seg;
      if (!same) clampScroll(st, ctx);
      const top = ctx.screen ? ctx.screen.scrollTop : 0;
      const rails = same ? railPos(st) : null;
      swap(st, ctx, seg, {fade: false});
      if (ctx.screen) ctx.screen.scrollTop = top;
      if (rails) restoreRails(st, rails);
      if (routed && SEGS[seg].params) SEGS[seg].params(ctx, 'params');
      return;
    }
    if (routed) {
      if (seg === st.seg) {
        // Same segment, new params (a different record in focus, another Shame scope).
        if (SEGS[seg].params) SEGS[seg].params(ctx, 'params');
      } else if (fromCtl && st.tops[seg] != null) {
        swap(st, ctx, seg, {fade: true});
        restoreTop(st, ctx, seg);
      } else {
        clampScroll(st, ctx); // before the swap, so a record focused by the new segment's mount keeps its scroll
        swap(st, ctx, seg, {fade: true});
        // The new segment's mount skips the focus param under 'me'; apply it as the route change it is.
        if (ctx.reason !== 'params' && SEGS[seg].params) SEGS[seg].params(ctx, 'params');
      }
    }
    // 'me': Standings rebuilds (your rows), Trophies patches its highlights in place (the rails and the champion
    // moment are left alone), Shame refills quietly; Records has nothing that depends on it.
    if (ctx.reason === 'me' && SEGS[st.seg].me) SEGS[st.seg].me(ctx);
  },

  onShow(ctx) {
    const st = ST.get(ctx);
    if (st && SEGS[st.seg].show) SEGS[st.seg].show(ctx);
  },

  onAction(id, ctx) {
    const st = ST.get(ctx);
    if (st && SEGS[st.seg].onAction) return SEGS[st.seg].onAction(id, ctx);
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    unmountSeg(st, ctx);
    ST.delete(ctx);
  }
};
