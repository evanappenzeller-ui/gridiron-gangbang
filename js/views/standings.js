// Standings root (#/standings): seasons rail, all-time list (FLIP on sort) or table, sort sheet.
// Owner: standings package. Spec 7.9.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = data.esc;
const VIEW_KEY = 'gg-std-view';

// Sort options (spec 7.9). Semantics as the old table: default {pct, -1}; name starts ascending;
// choosing the current key flips the direction; ties break by win % descending.
const SORTS = [
  {key: 'pct', label: 'Win %'},
  {key: 'w', label: 'Record'},
  {key: 'ppg', label: 'Points per game'},
  {key: 'po', label: 'Playoff trips'},
  {key: 'titles', label: 'Titles'},
  {key: 'name', label: 'Name'}
];
const COLS = [
  {k: 'name', l: 'Manager'}, {k: 'w', l: 'Record'}, {k: 'pct', l: 'Win %'},
  {k: 'ppg', l: 'Pts/game'}, {k: 'po', l: 'Playoffs'}, {k: 'titles', l: 'Titles'}
];
const labelOf = k => (SORTS.find(s => s.key === k) || SORTS[0]).label;
const dirText = ({key, dir}) => key === 'name' ? (dir > 0 ? 'A to Z' : 'Z to A') : (dir < 0 ? 'high to low' : 'low to high');

// Per-screen state (keyed by ctx). The last sort survives re-renders within the session.
const S = new WeakMap();
let lastSort = {key: 'pct', dir: -1};

const readView = () => ui.lsGet(VIEW_KEY) === 'table' ? 'table' : 'list';
const stateOf = ctx => S.get(ctx) || {sort: {...lastSort}, view: readView()};

function pickSort(cur, k) {
  return cur.key === k ? {key: k, dir: -cur.dir} : {key: k, dir: k === 'name' ? 1 : -1};
}
function sortedRows({key, dir}) {
  return data.AT.filter(r => r.gp > 0).slice().sort((x, y) => {
    if (key === 'name') return dir * data.name(x.id).localeCompare(data.name(y.id)) || (y.pct - x.pct);
    return dir * (x[key] - y[key]) || (y.pct - x.pct);
  });
}

// ---------------------------------------------------------------- Pieces
function metric(r, key) {
  const rec = data.recStr(r.w, r.l, r.t);
  const pc = data.pct(r.pct);
  switch (key) {
    case 'w': return {v: rec, cap: pc, a: `record ${rec}, win percentage ${pc}`};
    case 'ppg': return {v: r.ppg.toFixed(1), cap: rec, a: `${r.ppg.toFixed(1)} points per game, ${rec}`};
    case 'po': return {v: String(r.po), cap: rec, a: `${r.po} playoff trips, ${rec}`};
    case 'titles': return {v: String(r.titles), cap: rec, a: `${r.titles} titles, ${rec}`};
    default: return {v: pc, cap: rec, a: `win percentage ${pc}, ${rec}`};
  }
}
const metricHtml = m => `<span class="std-metric" aria-hidden="true"><span class="n4">${esc(m.v)}</span><span class="std-cap">${esc(m.cap)}</span></span>`;

function trophies(n) {
  if (!n) return '';
  const ic = ui.icon('trophy-fill', {size: 14});
  const inner = n > 3 ? `${ic}<span class="std-trx">×${n}</span>` : ic.repeat(n);
  return `<span class="std-tro" aria-hidden="true">${inner}</span>`;
}

function rowLabel(r, i, m) {
  const t = r.titles ? `, ${r.titles} title${r.titles > 1 ? 's' : ''}` : '';
  const tm = data.team(r.id);
  return `${i + 1}. ${data.name(r.id)}${t}${tm ? ', ' + tm : ''}. ${m.a}`;
}

function rowHtml(r, i, key, meId) {
  const m = metric(r, key);
  return ui.row({
    key: r.id,
    cls: 'row-72 std-row',
    me: r.id === meId,
    lead: `<span class="std-rank n5" aria-hidden="true">${i + 1}</span>${ui.avatar(r.id, {size: 40, you: r.id === meId, attrs: {'data-morph-from': ''}})}`,
    title: ui.raw(`<span class="std-nm">${esc(data.name(r.id))}</span>${trophies(r.titles)}`),
    sub: data.team(r.id),
    trail: metricHtml(m),
    attrs: {'data-nav': '/managers/' + r.id, 'aria-label': rowLabel(r, i, m)}
  });
}

const noGames = () => ui.empty({icon: 'list-number', title: 'No games yet.', body: 'The all-time table fills in after week 1.'});

function listHtml(sort) {
  const rows = sortedRows(sort);
  if (!rows.length) return noGames();
  const meId = data.me();
  return `<div class="group-wrap" data-enter>${ui.group(rows.map((r, i) => rowHtml(r, i, sort.key, meId)).join(''), {cls: 'std-group'})}<p class="group-f">Regular season record.</p></div>`;
}

function thHtml(c, sort) {
  const on = sort.key === c.k;
  const arrow = on ? ui.icon(sort.dir < 0 ? 'arrow-down' : 'arrow-up', {size: 12, cls: 'std-arr'}) : '';
  const as = on ? ` aria-sort="${sort.dir < 0 ? 'descending' : 'ascending'}"` : '';
  return `<th scope="col" class="${c.k === 'name' ? 'std-c1' : ''}${on ? ' is-sorted' : ''}"${as}><button type="button" data-sort="${c.k}" data-press="none">${esc(c.l)}${arrow}</button></th>`;
}
function trHtml(r, meId) {
  const titles = r.titles ? `<span class="std-tt">${ui.icon('trophy-fill', {size: 13})}${r.titles}</span>` : '0';
  const tm = data.team(r.id);
  return `<tr data-key="${esc(r.id)}" data-nav="/managers/${esc(r.id)}" data-press="row"${r.id === meId ? ' class="is-me"' : ''}>`
    + `<th scope="row" class="std-c1"><a class="std-tman" href="#/managers/${esc(r.id)}">${ui.avatar(r.id, {size: 24, you: r.id === meId, attrs: {'data-morph-from': ''}})}<span class="std-tnm"><b>${esc(data.name(r.id))}</b>${tm ? `<small>${esc(tm)}</small>` : ''}</span></a></th>`
    + `<td class="n5">${data.recStr(r.w, r.l, r.t)}</td><td class="n5">${data.pct(r.pct)}</td><td class="n5">${r.ppg.toFixed(1)}</td>`
    + `<td class="n5">${r.po}</td><td class="n5">${titles}</td></tr>`;
}
function tableHtml(sort) {
  const rows = sortedRows(sort);
  if (!rows.length) return noGames();
  const meId = data.me();
  return `<div class="std-tcard"><div class="std-tscroll" data-hscroll tabindex="0" role="region" aria-label="All-time table, scrolls sideways"><table class="std-table">`
    + `<caption class="sr-only">All-time standings, regular season record</caption>`
    + `<thead><tr>${COLS.map(c => thHtml(c, sort)).join('')}</tr></thead>`
    + `<tbody>${rows.map(r => trHtml(r, meId)).join('')}</tbody></table></div></div>`
    + `<p class="group-f">Regular season record. Tap a column to sort.</p>`;
}

function seasonCard(s) {
  if (s.live) {
    const tw = data.throughWeek(s);
    return `<a class="std-scard is-live" href="#/standings/${s.year}" aria-label="${s.year} season, in progress, ${tw ? `through week ${tw}` : `no games yet`}">`
      + `<span class="std-sy n3">${s.year}</span><span class="std-sbot std-sbot-live">${ui.badge('progress')}<span class="std-sthru">${tw ? `Through wk ${tw}` : `No games yet`}</span></span></a>`;
  }
  const c = s.champion;
  if (!c) {
    return `<a class="std-scard" href="#/standings/${s.year}" aria-label="${s.year} season"><span class="std-sy n3">${s.year}</span></a>`;
  }
  return `<a class="std-scard ${data.color(c).cls}" href="#/standings/${s.year}" aria-label="${s.year} season, won by ${esc(data.name(c))}">`
    + `<span class="std-sy n3">${s.year}</span>`
    + `<span class="std-sbot">${ui.avatar(c, {size: 24})}<span class="std-swho"><b>${esc(data.name(c))}</b>${ui.badge('champ')}</span></span></a>`;
}
function railHtml() {
  if (!data.SEASONS.length) return '';
  return `${ui.sectionHeader({title: 'Seasons'})}<div class="std-rail" data-hscroll data-enter role="list" aria-label="Seasons">${data.SEASONS.map(s => `<div role="listitem" class="std-li">${seasonCard(s)}</div>`).join('')}</div>`;
}

function sortBtnLabel(sort) {
  return ui.raw(`<span class="std-sl">${esc(labelOf(sort.key))}</span>${ui.icon(sort.dir < 0 ? 'arrow-down' : 'arrow-up', {size: 15})}`);
}
function allHeader(sort) {
  return ui.sectionHeader({title: 'All-time', action: {label: sortBtnLabel(sort), attrs: {'data-sort-open': '', 'aria-label': `Sort: ${labelOf(sort.key)}, ${dirText(sort)}`}}});
}

function subtitle() {
  const sp = data.span;
  if (sp.first == null) return '';
  return `${sp.first === sp.last ? sp.first : `${sp.first}–${sp.last}`} · ${sp.managers} managers`;
}

function bodyHtml(st) {
  return ui.largeTitle({title: 'Standings', subtitle: subtitle()})
    + `<section class="std-seasons">${railHtml()}</section>`
    + `<section class="std-alltime"><div class="std-ah">${allHeader(st.sort)}</div><div class="std-all" data-view="${st.view}">${st.view === 'table' ? tableHtml(st.sort) : listHtml(st.sort)}</div></section>`;
}

// ---------------------------------------------------------------- Behavior
function syncTableEdges(root) {
  root.querySelectorAll('.std-tscroll').forEach(sc => {
    const max = sc.scrollWidth - sc.clientWidth;
    sc.classList.toggle('is-scrolled', sc.scrollLeft > 1);
    sc.classList.toggle('is-end', max <= 1 || sc.scrollLeft >= max - 1);
  });
}

// Patch the sort button in place, so focus (returned to it when the sort sheet closes) is never lost.
function patchHeader(st) {
  const b = st.el.querySelector('[data-sort-open]');
  if (!b) { const h = st.el.querySelector('.std-ah'); if (h) h.innerHTML = allHeader(st.sort); return; }
  (b.querySelector('.btn-label') || b).innerHTML = sortBtnLabel(st.sort).__html;
  b.setAttribute('aria-label', `Sort: ${labelOf(st.sort.key)}, ${dirText(st.sort)}`);
}

async function applySort(ctx, sort) {
  const st = S.get(ctx);
  if (!st) return;
  const prevKey = st.sort.key;
  st.sort = sort;
  lastSort = {...sort};
  patchHeader(st);
  const rows = sortedRows(sort);
  const meId = data.me();
  const box = st.el.querySelector('.std-all');
  const rel = ctx.busy();
  try {
    if (st.view === 'list') {
      const g = box && box.querySelector('.std-group');
      if (!g) return;
      const byId = new Map([...g.querySelectorAll(':scope > .row')].map(n => [n.dataset.key, n]));
      if (rows.length !== byId.size || rows.some(r => !byId.has(r.id))) { box.innerHTML = listHtml(sort); return; }
      const changed = [];
      await ui.flip(g, () => {
        rows.forEach((r, i) => {
          const n = byId.get(r.id);
          const m = metric(r, sort.key);
          n.querySelector('.std-rank').textContent = String(i + 1);
          const tr = n.querySelector('.row-trail');
          if (tr && prevKey !== sort.key) { tr.innerHTML = metricHtml(m); changed.push(tr); }
          n.setAttribute('aria-label', rowLabel(r, i, m));
          g.appendChild(n);
        });
        changed.forEach(tr => ui.animate(tr, [{opacity: 0}, {opacity: 1}], {duration: 220, easing: 'ease-out'}));
      });
    } else {
      const tb = box && box.querySelector('tbody');
      if (!tb) return;
      // Patch the header cells in place (keeps keyboard focus on the tapped column button).
      box.querySelectorAll('thead th').forEach(th => {
        const btn = th.querySelector('button[data-sort]');
        const c = btn && COLS.find(x => x.k === btn.dataset.sort);
        if (!c) return;
        const on = sort.key === c.k;
        th.classList.toggle('is-sorted', on);
        if (on) th.setAttribute('aria-sort', sort.dir < 0 ? 'descending' : 'ascending'); else th.removeAttribute('aria-sort');
        btn.innerHTML = esc(c.l) + (on ? ui.icon(sort.dir < 0 ? 'arrow-down' : 'arrow-up', {size: 12, cls: 'std-arr'}) : '');
      });
      const byId = new Map([...tb.querySelectorAll(':scope > tr')].map(n => [n.dataset.key, n]));
      if (rows.length !== byId.size || rows.some(r => !byId.has(r.id))) { tb.innerHTML = rows.map(r => trHtml(r, meId)).join(''); return; }
      await ui.flip(tb, () => rows.forEach(r => tb.appendChild(byId.get(r.id))));
    }
  } finally {
    rel();
  }
  ui.announce(`Sorted by ${labelOf(sort.key)}, ${dirText(sort)}.`);
}

async function openSort(ctx) {
  const st = S.get(ctx);
  if (!st) return;
  const cur = st.sort;
  const v = await ui.actionSheet({
    title: 'Sort all-time',
    cls: 'sh-sort',
    message: `${labelOf(cur.key)}, ${dirText(cur)}. Choose it again to reverse.`,
    actions: SORTS.map(s => ({label: s.label, value: s.key, checked: s.key === cur.key}))
  });
  if (v == null || S.get(ctx) !== st) return;
  await applySort(ctx, pickSort(st.sort, v));
}

function setView(ctx, view) {
  const st = S.get(ctx);
  if (!st || st.view === view) return;
  st.view = view;
  ui.lsSet(VIEW_KEY, view);
  ui.haptic('selection');
  const box = st.el.querySelector('.std-all');
  if (!box) return;
  ui.crossfade(box, () => {
    box.dataset.view = view;
    box.innerHTML = view === 'table' ? tableHtml(st.sort) : listHtml(st.sort);
  }, {duration: 160});
  syncTableEdges(box);
  ui.announce(view === 'table' ? 'Showing the table.' : 'Showing the list.');
}

export default {
  id: 'standings',
  title: 'Standings',
  actions(ctx) {
    const v = stateOf(ctx).view;
    return [
      {id: 'sort', icon: 'sort', label: 'Sort'},
      v === 'table' ? {id: 'list', icon: 'list', label: 'Show as list'} : {id: 'table', icon: 'table', label: 'Show as table'}
    ];
  },
  render(ctx) {
    return bodyHtml(stateOf(ctx));
  },
  mount(el, ctx) {
    const prev = S.get(ctx);
    const st = {el, sort: prev ? prev.sort : {...lastSort}, view: prev ? prev.view : readView()};
    S.set(ctx, st);
    el.addEventListener('click', e => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-sort-open]')) { openSort(ctx); return; }
      const th = t.closest('button[data-sort]');
      if (th) { ui.haptic('selection'); applySort(ctx, pickSort(st.sort, th.dataset.sort)); }
    });
    el.addEventListener('scroll', e => {
      if (e.target && e.target.classList && e.target.classList.contains('std-tscroll')) syncTableEdges(el);
    }, {capture: true, passive: true});
    if (ctx.first) ui.stagger(el);
  },
  onShow(ctx) {
    const st = S.get(ctx);
    if (st) syncTableEdges(st.el);
  },
  update(ctx) {
    const st = S.get(ctx);
    if (!st) return;
    // 'data' (a reload found changes) or 'me' (your highlight): rebuild, keeping sort, view and rail scroll.
    const rail = st.el.querySelector('.std-rail');
    const rl = rail ? rail.scrollLeft : 0;
    st.el.innerHTML = bodyHtml(st);
    const nr = st.el.querySelector('.std-rail');
    if (nr) nr.scrollLeft = rl;
    syncTableEdges(st.el);
  },
  onAction(id, ctx) {
    if (id === 'sort') return openSort(ctx);
    // app.js re-renders the trail after this and keeps keyboard focus on the swapped button.
    if (id === 'table' || id === 'list') setView(ctx, id);
  }
};
