// A visit to another player's realm (the owner's ask, Oct 23 2026: "Users should be able to view other players bases. Add
// a visit button"), over Keepfall (a cover over Daily Games, #/realm/visit/<profile key>), from Visit by Lore on the home
// screen. Their realm as they see it at home (core/realm.js visitable: the freshest copy on the board, its builders'
// finished work counted; views/realm-3d.js draws it in their scenery, their heroes and keeper about it): drag to look
// round, pinch (or the wheel) to zoom, All to see the whole of it again. Their house, name and Castle level at
// the top, what defends it under them; tap a building for what it is and does. Back goes home. Looking only: nothing
// here changes anything, and players' realms are never raided. Who can be visited follows the scoreboards' rule
// (CLAUDE.md): checked again whenever the board or this phone's profile changes.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as F from '../core/realm.js';
import * as daily from '../core/daily.js';
import {MY_HOUSE, houseName, factsOf} from './realm.js';
import {defensesOf} from './realm-scout.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ST = new WeakMap();
let D3 = null;
const plural = (t, n) => { const nm = F.KINDS[t].name; return n === 1 ? nm : nm === 'Archer Tower' ? 'Archer Towers' : `${nm}s`; };
const dur = ms => { const m = Math.max(1, Math.ceil(ms / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${Math.floor(m / 1440)}d${Math.floor(m / 60) % 24 ? ` ${Math.floor(m / 60) % 24}h` : ''}`; };

function shellHTML() {
  return `<div class="rl rlr rls rlv" data-no-swipe>`
    + `<div class="rl-gl" aria-hidden="true"><div class="rl-loading">Riding over…</div></div>`
    + `<div class="rlr-top"><button type="button" class="rlr-quit is-back" data-rlv-back>Back</button><div class="rlr-who" data-rlv-who></div></div>`
    + `<div class="rls-def" data-rlv-def></div>`
    + `<div class="rls-zoom" role="group" aria-label="Zoom">`
    + `<button type="button" class="is-all" data-rlv-zoom="all" aria-label="See the whole realm">All</button></div>`
    + `<div class="rl-sel" data-rlv-sel hidden></div>`
    + `<div class="rls-bar" data-rlv-bar><p class="rls-hint">Visiting · drag to look round · pinch to zoom · tap a building</p></div>`
    + `<div class="rlr-msg" data-rlv-msg hidden></div></div>`;
}

/** The selected building's card on a visited realm: what it is, its level, what it does (and the work going on it). */
export function visitSelHTML(b, now = Date.now()) {
  const K = F.KINDS[b.t], work = b.u > now ? `<p class="rl-sel-job">${b.l < 1 ? 'Being built' : `Upgrading to level ${b.l + 1}`} · done in ${dur(b.u - now)}</p>` : '';
  return `<div class="rl-sel-h"><div><b>${esc(K.name)}</b><span class="rl-sel-lv">Level ${Math.max(1, b.l)}</span></div>${ui.iconButton({icon: 'close', label: 'Done', cls: 'rl-sel-x', attrs: 'data-rlv-unsel'})}</div>`
    + `<p class="rl-sel-what">${factsOf(b, {own: true, whose: 'their'}).map(esc).join(' · ')}</p>${work}`
    + `<p class="rl-sel-blurb">${esc(K.blurb.replace(/\byour\b/g, 'their').replace(/\byou’re\b/g, 'they’re').replace(/\bYour\b/g, 'Their').replace(/\byou\b/g, 'they'))}</p>`;
}
function select(st, id) {
  const b = id != null && st.T ? st.T.state.b.find(x => x.i === id) : null;
  st.sel = b ? b.i : null;
  const box = st.el.querySelector('[data-rlv-sel]'), bar = st.el.querySelector('[data-rlv-bar]');
  box.hidden = !b; bar.hidden = !!b;
  box.innerHTML = b ? visitSelHTML(b) : '';
  if (!st.v) return;
  st.v.select(st.sel);
  const sv = b && F.KINDS[b.t].role === 'def' ? F.stat(b.t, b.l) : null, sz = b ? F.KINDS[b.t].size : 0;
  st.v.showReach(sv ? {x: b.x + sz / 2, y: b.y + sz / 2, out: sv.range + sz / 2, min: sv.min} : null);
}

function fitAll(st) { const bx = F.boxOf(st.T.state); st.v.frame(bx.x0 - 3, bx.y0 - 3, bx.x1 + 3, bx.y1 + 3, 1); }

/** What the top shows: their Castle level, house and name; and what defends their realm. */
function header(st) {
  const T = st.T, house = houseName(T.state, T);
  st.el.querySelector('[data-rlv-who]').innerHTML = `<span class="rl-tg-lv">${T.th}</span><span><b>${esc(house)}</b><small>${esc(T.name)}’s realm${T.guest ? ' · Guest' : ''}</small></span>`;
  st.el.querySelector('[data-rlv-def]').innerHTML = defensesOf(T.state).map(d => `<span class="rls-chip">${d.n} ${esc(plural(d.t, d.n))}</span>`).join('') || '<span class="rls-chip">No defenses</span>';
}
function gone(st, why) {
  st.T = null;
  if (st.v) { st.v.dispose(); st.v = null; }
  st.el.querySelector('.rl-gl').innerHTML = '';
  ['[data-rlv-who]', '[data-rlv-def]'].forEach(q => { st.el.querySelector(q).innerHTML = ''; });
  st.el.querySelector('[data-rlv-sel]').hidden = true;
  st.el.querySelector('[data-rlv-bar]').hidden = true;
  const msg = st.el.querySelector('[data-rlv-msg]');
  msg.hidden = false; msg.textContent = why;
}

async function start3d(st) {
  if (st.starting) return;
  st.starting = true;
  try {
    if (!D3) D3 = await import('./realm-3d.js');
    if (st.dead || !st.T) return;
    if (await D3.load(F.sceneryOf(st.T.state))) build3d(st);
    else if (!st.dead && st.T) st.el.querySelector('.rl-gl').innerHTML = '<div class="rl-loading">This phone can’t show the realm in 3D.</div>';
  } finally { st.starting = false; }
}
function build3d(st) {
  if (st.dead || !st.T || st.v) return;
  const theme = F.sceneryOf(st.T.state);
  const host = st.el.querySelector('.rl-gl');
  host.innerHTML = '';
  st.v = D3.create(host, {house: MY_HOUSE, zoom: 60, scenery: theme, village: true,
    isActive: () => !st.dead && !!st.T && F.mayPlay(),
    onTap: hit => select(st, hit.id == null || hit.id === st.sel ? null : hit.id)});
  if (!st.v) return;
  st.v.setLot(st.T.state, {now: Date.now(), house: MY_HOUSE});
  st.v.frameVillage();
  st.el.querySelector('.rlv').__rl = st; // (for the checks' and tests' hands)
}

/** The visited realm again from the board (a newer copy, or this phone's profile changed: who may be seen with it). */
function load(st) {
  if (st.dead) return;
  if (!F.mayPlay()) { gone(st, 'Choose your profile to visit other realms.'); return; }
  const T = F.visitOf(st.key);
  if (!T) { gone(st, 'That realm isn’t here to visit.'); return; }
  const changed = !!st.T && T.at !== st.T.at;
  st.T = T;
  st.el.querySelector('[data-rlv-msg]').hidden = true;
  header(st);
  if (st.sel != null && !T.state.b.some(b => b.i === st.sel)) select(st, null);
  else if (st.sel != null) st.el.querySelector('[data-rlv-sel]').innerHTML = visitSelHTML(T.state.b.find(b => b.i === st.sel));
  if (!st.v) start3d(st);
  else if (changed) st.v.setLot(T.state, {now: Date.now(), house: MY_HOUSE});
}

export default {
  id: 'realm-visit',
  chrome: 'none',
  title: 'Visit',

  render() { return F.mayPlay() ? shellHTML() : '<div class="rl rl-none"></div>'; },

  mount(el, ctx) {
    if (!F.mayPlay()) return;
    const key = decodeURIComponent((ctx.params && ctx.params.key) || '');
    const st = {el, ctx, key, v: null, T: null, sel: null, dead: false, stops: []};
    ST.set(ctx, st);
    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-rlv-back]')) { ctx.back(); return; }
      if (t.closest('[data-rlv-unsel]')) { select(st, null); return; }
      const z = t.closest('[data-rlv-zoom]');
      if (z && st.v) { const k = z.dataset.rlvZoom; if (k === 'all') fitAll(st); ui.haptic('selection'); }
    });
    // (another profile on this phone, here or in another tab: who may be visited goes with it)
    st.stops.push(data.subscribe(type => { if (type === 'me') { st.T = null; if (st.v) { st.v.dispose(); st.v = null; } load(st); } }));
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') load(st); }));
    if (daily.LB.ready) load(st);
    else { const msg = el.querySelector('[data-rlv-msg]'); msg.hidden = false; msg.textContent = 'Riding over…'; }
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    if (st.v) st.v.dispose();
    ST.delete(ctx);
  }
};
