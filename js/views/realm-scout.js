// A look round one of the computer's realms before you attack it (core/realm.js realmOf(); views/realm-3d.js draws
// it), over The Keep (a cover over Daily Games), the owner's alone. The realm fills the screen: drag to look round, pinch (or the wheel, or
// + and −) to zoom, All to see the whole of it again. Its name, Castle level and what it holds today at the top, what
// defends it under them; tap a building for what it is, what it does and what it holds, a defense's reach drawn round
// it. Attack sends your army in (views/realm-raid.js, in its place); Back goes home. Nothing here changes anything.
import * as ui from '../core/ui.js';
import * as F from '../core/realm.js';
import * as daily from '../core/daily.js';
import {houseOf, curHTML, factsOf} from './realm.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const ST = new WeakMap();
let D3 = null;

/** What defends realm base, the strongest first: [{t, n}] (walls last). */
export function defensesOf(base) {
  const n = {};
  base.b.forEach(b => { if (F.KINDS[b.t].role === 'def' || b.t === 'wall') n[b.t] = (n[b.t] || 0) + 1; });
  return ['trebuchet', 'cauldron', 'tower', 'ballista', 'cannon', 'wall'].filter(t => n[t]).map(t => ({t, n: n[t]}));
}
const plural = (t, n) => { const nm = F.KINDS[t].name; return n === 1 ? nm : nm === 'Archer Tower' ? 'Archer Towers' : `${nm}s`; };

function shellHTML() {
  return `<div class="rl rlr rls" data-no-swipe>`
    + `<div class="rl-gl" aria-hidden="true"><div class="rl-loading">Scouting…</div></div>`
    + `<div class="rlr-top"><button type="button" class="rlr-quit is-back" data-rls-back>Back</button><div class="rlr-who" data-rls-who></div></div>`
    + `<div class="rls-def" data-rls-def></div>`
    + `<div class="rls-zoom" role="group" aria-label="Zoom">`
    + `<button type="button" data-rls-zoom="in" aria-label="Zoom in">+</button><button type="button" data-rls-zoom="out" aria-label="Zoom out">−</button>`
    + `<button type="button" class="is-all" data-rls-zoom="all" aria-label="See the whole realm">All</button></div>`
    + `<div class="rl-sel" data-rls-sel hidden></div>`
    + `<div class="rls-bar" data-rls-bar><p class="rls-hint">Drag to look round · pinch to zoom · tap a building</p><div data-rls-go></div></div>`
    + `<div class="rlr-msg" data-rls-msg hidden></div></div>`;
}

// ---- the selected building's card: what it is, what it does, what it holds today
function selHTML(st) {
  const b = st.T.base.b.find(x => x.i === st.sel);
  if (!b) return '';
  const K = F.KINDS[b.t], held = st.T.loot.by[b.i];
  const take = held && (held.gold || held.grain) ? `<p class="rl-sel-job">To take here: ${held.gold ? curHTML('gold', held.gold) : ''} ${held.grain ? curHTML('grain', held.grain) : ''}</p>` : '';
  return `<div class="rl-sel-h"><div><b>${esc(K.name)}</b><span class="rl-sel-lv">Level ${Math.max(1, b.l)}</span></div>${ui.iconButton({icon: 'close', label: 'Done', cls: 'rl-sel-x', attrs: 'data-rls-unsel'})}</div>`
    + `<p class="rl-sel-what">${factsOf(b).map(esc).join(' · ')}</p>${take}`
    + `<p class="rl-sel-blurb">${esc(K.blurb)}</p>`;
}
function select(st, id) {
  const b = id != null ? st.T.base.b.find(x => x.i === id) : null;
  st.sel = b ? b.i : null;
  const box = st.el.querySelector('[data-rls-sel]'), bar = st.el.querySelector('[data-rls-bar]');
  box.hidden = !b; bar.hidden = !!b;
  box.innerHTML = b ? selHTML(st) : '';
  if (!st.v) return;
  st.v.select(st.sel);
  const sv = b && F.KINDS[b.t].role === 'def' ? F.stat(b.t, b.l) : null, sz = b ? F.KINDS[b.t].size : 0;
  st.v.showReach(sv ? {x: b.x + sz / 2, y: b.y + sz / 2, out: sv.range + sz / 2, min: sv.min} : null);
}

function goHTML(key) {
  const s = F.mine(), army = F.roomOf(s.ar) || Object.keys(F.heroArmy(s)).length;
  // (a realm more than a level above your Castle can be looked round, not attacked yet: core/realm.js attackWhy)
  if (F.attackWhy(s, key)) return `<button type="button" class="rl-btn is-raid is-locked" disabled><span class="rl-bi" aria-hidden="true">${ui.icon('lock')}</span><span>Attack</span><em>Opens at Castle level ${F.targetAt(key)}</em></button>`;
  return army ? `<button type="button" class="rl-btn is-raid" data-rls-attack><span class="rl-bi" aria-hidden="true">${ui.icon('versus')}</span><span>Attack</span></button>`
    : `<button type="button" class="rl-btn is-raid" disabled><span class="rl-bi" aria-hidden="true">${ui.icon('versus')}</span><span>Attack</span><em>Recruit or hatch a hero, or train troops</em></button>`;
}

function fitAll(st) { const bx = F.boxOf(st.T.base); st.v.frame(bx.x0 - 3, bx.y0 - 3, bx.x1 + 3, bx.y1 + 3, 1); }

async function start3d(st) {
  const ok = await (D3 ? D3.load() : import('./realm-3d.js').then(m => { D3 = m; return m.load(); }));
  if (st.dead) return;
  const host = st.el.querySelector('.rl-gl');
  if (!ok) { host.innerHTML = '<div class="rl-loading">This phone can’t show the realm in 3D.</div>'; return; }
  host.innerHTML = '';
  const house = houseOf(st.T.key);
  st.v = D3.create(host, {house, zoom: 60, onTap: hit => select(st, hit.id == null || hit.id === st.sel ? null : hit.id)});
  st.v.setLot(st.T.base, {now: Date.now(), house});
  fitAll(st);
  st.el.querySelector('.rls').__rl = st; // (for the checks' and tests' hands)
}

export default {
  id: 'realm-scout',
  chrome: 'none',
  title: 'Scout',

  render() { return F.mayPlay() ? shellHTML() : '<div class="rl rl-none"></div>'; },

  mount(el, ctx) {
    if (!F.mayPlay()) return; // (the owner's alone: nothing here on anyone else's phone)
    const key = decodeURIComponent((ctx.params && ctx.params.key) || '');
    const st = {el, ctx, key, v: null, T: null, sel: null, dead: false};
    ST.set(ctx, st);
    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-rls-back]')) { ctx.back(); return; }
      if (t.closest('[data-rls-unsel]')) { select(st, null); return; }
      if (t.closest('[data-rls-attack]')) { ctx.replace('/realm/raid/' + encodeURIComponent(key)); return; }
      const z = t.closest('[data-rls-zoom]');
      if (z && st.v) { const k = z.dataset.rlsZoom; if (k === 'all') fitAll(st); else st.v.zoomBy(k === 'in' ? .72 : 1.38); ui.haptic('selection'); }
    });
    const begin = () => {
      const msg = el.querySelector('[data-rls-msg]');
      if (!daily.LB.ready) { msg.hidden = false; msg.textContent = 'Riding out…'; const off = ctx.on('daily', type => { if (type === 'lb') { off(); begin(); } }); return; }
      F.sync();
      // (raids, and scouting, open at Castle level 4; then any of the computer's realms can be looked round, the ones
      // more than a level above your Castle too: core/realm.js realmOf's scout)
      const T = F.realmOf(key, F.mine(), Date.now(), {scout: true});
      if (T.why) { msg.hidden = false; msg.textContent = T.locked && !/[.!]$/.test(T.why) ? `${T.why}.` : T.why; el.querySelector('[data-rls-bar]').hidden = true; return; }
      msg.hidden = true;
      st.T = T;
      el.querySelector('[data-rls-who]').innerHTML = `<span class="rl-tg-lv">${T.th}</span><span><b>${esc(T.name)}</b><small>${T.loot.total.gold || T.loot.total.grain ? `To take ${curHTML('gold', T.loot.total.gold)} ${curHTML('grain', T.loot.total.grain)}` : 'Sacked today: nothing left to take'}</small></span>`;
      el.querySelector('[data-rls-def]').innerHTML = defensesOf(T.base).map(d => `<span class="rls-chip">${d.n} ${esc(plural(d.t, d.n))}</span>`).join('') || '<span class="rls-chip">No defenses</span>';
      el.querySelector('[data-rls-go]').innerHTML = goHTML(st.key);
      start3d(st);
    };
    begin();
  },

  onShow(ctx) { const st = ST.get(ctx); if (st && st.T) st.el.querySelector('[data-rls-go]').innerHTML = goHTML(st.key); },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    if (st.v) st.v.dispose();
    ST.delete(ctx);
  }
};
