// Moves tab: Drafts, Trades and player search (spec 7.15). Owner: moves package.
// Routes: /moves/drafts[/:year], /moves/trades, optional ?m=<managerId> on both.
// Mount once, then patch: segment, year and filter changes arrive through update(ctx) (reason 'params')
// and swap only the list below the controls with a 120 ms cross-fade.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = s => data.esc(s == null ? '' : String(s));
const pad2 = n => String(n).padStart(2, '0');
const qs = m => (m ? '?m=' + encodeURIComponent(m) : '');
const count = (n, one, many) => `${data.nf(n)} ${n === 1 ? one : many}`;
const SEARCH_MAX = 50;
const DEBOUNCE = 120;
const ROW_H = 56, HEAD_H = 32;

// ============================================================================ Derived lists
// Cached per DATA object: data.reload() assigns a new DATA, so a stale cache can never be read.
let CACHE = null;
function lists() {
  const D = data.DATA;
  if (CACHE && CACHE.src === D) return CACHE;
  const drafts = ((D && D.drafts) || []).slice().sort((a, b) => b.year - a.year);
  // Old order: year descending, then week descending (stable, so same-week trades keep file order).
  const trades = ((D && D.trades) || []).map((t, i) => ({t, i})).sort((a, b) => b.t.year - a.t.year || b.t.week - a.t.week);
  CACHE = {src: D, drafts, trades, idx: null};
  return CACHE;
}
const latestYear = () => { const L = lists(); return L.drafts.length ? L.drafts[0].year : null; };

// Search words: the normalized name, plus its pieces split at hyphens, dots and apostrophes,
// so "scantling" finds Valdes-Scantling and "marr" finds Ja'Marr.
const PIECES = /[-_/.'‐‑–—’]/g;
function wordsOf(name) {
  const s = String(name || '');
  const base = data.norm(s);
  const split = data.norm(s.replace(PIECES, ' '));
  return {full: base, words: [...new Set(base.split(' ').concat(split.split(' ')).filter(Boolean))]};
}
function index() {
  const L = lists();
  if (L.idx) return L.idx;
  const t0 = performance.now();
  const drafted = [], traded = [];
  L.drafts.forEach(d => (d.picks || []).forEach(p => {
    const w = wordsOf(p.player);
    drafted.push({player: String(p.player || ''), year: d.year, round: p.round, pick: p.pick, manager: String(p.manager || ''), words: w.words, full: w.full});
  }));
  L.trades.forEach(({t, i}) => (t.sides || []).forEach(s => (s.got || []).forEach(pl => {
    const w = wordsOf(pl);
    traded.push({player: String(pl || ''), year: t.year, week: t.week, manager: String(s.manager || ''), ti: i, words: w.words, full: w.full});
  })));
  L.idx = {drafted, traded, ms: performance.now() - t0};
  return L.idx;
}
/** Every query token must prefix-match some word of the player's name. Newest first; names that start with the query lead. */
function search(q) {
  const nq = data.norm(String(q || ''));
  const toks = nq.split(' ').filter(Boolean);
  if (!toks.length) return {toks, d: [], t: []};
  const I = index();
  const hit = e => toks.every(t => e.words.some(w => w.startsWith(t)));
  const lead = e => (e.full.startsWith(nq) ? 0 : 1);
  const d = I.drafted.filter(hit), t = I.traded.filter(hit);
  d.sort((a, b) => lead(a) - lead(b));
  t.sort((a, b) => lead(a) - lead(b));
  return {toks, d, t};
}
// Highlight the matched prefixes on the original characters, so accents and punctuation survive.
function hlWord(word, toks) {
  const ch = Array.from(word);
  const nc = ch.map(c => data.norm(c));
  const mark = new Array(ch.length).fill(false);
  const starts = [];
  nc.forEach((n, i) => { if (n && (i === 0 || !nc[i - 1])) starts.push(i); });
  for (const t of toks) {
    for (const s of starts) {
      let k = 0, i = s, ok = true;
      for (; i < ch.length && k < t.length; i++) {
        const n = nc[i];
        if (!n) continue;
        for (const c of n) { if (k >= t.length) break; if (c === t[k]) k++; else { ok = false; break; } }
        if (!ok) break;
      }
      if (ok && k === t.length) for (let j = s; j < i; j++) mark[j] = true;
    }
  }
  let out = '', on = false;
  ch.forEach((c, i) => { if (mark[i] !== on) { out += on ? '</b>' : '<b>'; on = mark[i]; } out += esc(c); });
  return on ? out + '</b>' : out;
}
const highlight = (name, toks) => String(name).split(/(\s+)/).map(w => (!w || /^\s+$/.test(w)) ? esc(w) : hlWord(w, toks)).join('');

// ============================================================================ Routes and state
function resolve(ctx) {
  const p = (ctx && ctx.params) || {}, q = (ctx && ctx.query) || {};
  const seg = p.seg === 'trades' ? 'trades' : 'drafts';
  const latest = latestYear();
  const year = p.year != null && isFinite(p.year) ? Number(p.year) : latest;
  const m = q.m && data.M[q.m] ? String(q.m) : null;
  return {seg, year, latest, m};
}
const sameState = (a, b) => a.seg === b.seg && a.year === b.year && a.m === b.m && a.latest === b.latest;
const draftsPath = (year, m) => (year == null || year === latestYear() ? '/moves/drafts' : '/moves/drafts/' + year) + qs(m);
const tradesPath = m => '/moves/trades' + qs(m);
const hasDraft = y => lists().drafts.some(d => d.year === y);

const ST = new WeakMap(); // ctx → per-screen state

// ============================================================================ Markup
function headHTML() {
  return ui.largeTitle({title: 'Moves'}) +
    `<div class="mv-q">${ui.searchField({name: 'q', placeholder: 'Search players', label: 'Search players'})}</div>`;
}
function segHTML(s) {
  return `<div class="mv-segwrap">${ui.seg({name: 'mv-seg', label: 'Drafts or trades', value: s.seg,
    items: [{id: 'drafts', label: 'Drafts'}, {id: 'trades', label: 'Trades'}]})}</div>`;
}
function contentHTML(s) { return s.seg === 'trades' ? tradesHTML(s) : draftsHTML(s); }

function railHTML(kind, m) {
  const me = data.me();
  const what = kind === 'trades' ? 'trades' : 'picks';
  const all = `<button type="button" class="mv-all" data-mv-m="" aria-pressed="${!m}" aria-label="Show all ${what}">All</button>`;
  const avs = data.ids.map(id => `<button type="button" class="mv-av${id === me ? ' is-you' : ''}" data-mv-m="${esc(id)}" aria-pressed="${id === m}" aria-label="${esc(`Show ${data.name(id)}'s ${what}`)}">${ui.avatar(id, {size: 36})}</button>`).join('');
  return `<div class="mv-rail${m ? ' has-sel' : ''}" role="group" aria-label="Filter by manager" data-hscroll data-enter>${all}${avs}</div>`;
}
const sumHTML = html => `<p class="mv-sum">${html}</p>`;
const who = m => `<b>${esc(data.name(m))}</b>`;

// ---- Drafts
function draftsHTML(s) {
  const L = lists();
  if (!L.drafts.length) return ui.empty({icon: 'list-number', title: 'No draft history added yet.'});
  const chips = ui.chips({name: 'mv-year', label: 'Draft year', value: s.year, items: L.drafts.map(d => ({id: d.year, label: String(d.year)}))});
  return `<div class="accessory mv-acc">${chips}</div>${railHTML('drafts', s.m)}<div class="mv-list">${draftListHTML(s)}</div>`;
}
function draftListHTML(s) {
  const L = lists();
  const d = L.drafts.find(x => x.year === s.year);
  if (!d) {
    const span = L.drafts.length > 1 ? `${L.drafts[L.drafts.length - 1].year}–${L.drafts[0].year}` : String(L.drafts[0].year);
    return ui.empty({icon: 'calendar', title: `No ${s.year} draft on file.`, body: `Drafts on file: ${span}.`,
      action: {label: `See the ${L.drafts[0].year} draft`, attrs: {'data-mv-go': draftsPath(L.drafts[0].year, s.m)}}});
  }
  const picks = (d.picks || []).filter(p => !s.m || p.manager === s.m);
  if (!picks.length) {
    return ui.empty({icon: 'person', title: `${data.name(s.m)} had no picks in ${d.year}.`,
      action: {label: 'Show all picks', attrs: {'data-mv-go': draftsPath(d.year, null)}}});
  }
  const rounds = new Map();
  picks.forEach(p => { const r = Number(p.round) || 0; if (!rounds.has(r)) rounds.set(r, []); rounds.get(r).push(p); });
  const keys = [...rounds.keys()].sort((a, b) => a - b);
  const me = data.me();
  let n = 0;
  const E = () => (n++ < 7 ? ' data-enter' : '');
  const secs = keys.map(r => {
    const list = rounds.get(r);
    const h = HEAD_H + 4 + list.length * ROW_H + 16;
    return `<section class="mv-sec" style="contain-intrinsic-size:auto ${h}px"><h3 class="mv-sh"${E()}><span class="ovl">Round ${esc(r)}</span></h3>` +
      `<ol class="group mv-picks">${list.map(p => pickHTML(d.year, p, me, E())).join('')}</ol></section>`;
  }).join('');
  const sum = s.m ? `${who(s.m)} · ${count(picks.length, 'pick', 'picks')} in ${d.year}` : `${count(picks.length, 'pick', 'picks')} · ${count(keys.length, 'round', 'rounds')}`;
  return sumHTML(sum) + secs;
}
const pickKey = (year, round, pick) => `${year}-${round}.${pad2(pick)}`;
function pickHTML(year, p, me, enter) {
  const id = String(p.manager || '');
  const pk = `${p.round}.${pad2(p.pick)}`;
  return `<li class="mv-pick${me && id === me ? ' is-mine' : ''}" data-pk="${esc(pickKey(year, p.round, p.pick))}" data-m="${esc(id)}"${enter}>` +
    `<span class="mv-tile n5" aria-hidden="true">${esc(pk)}</span>` +
    `<span class="mv-main"><span class="mv-player"><span class="sr-only">Round ${esc(p.round)}, pick ${esc(p.pick)}: </span>${esc(p.player)}</span>` +
    `<a class="mv-by" href="#/managers/${esc(encodeURIComponent(id))}">${ui.avatar(id, {size: 20, attrs: {'data-morph-from': true}})}<span class="mv-by-n">${esc(data.name(id))}</span></a></span>` +
    (p.pos ? `<span class="pill mv-pos">${esc(p.pos)}</span>` : '') +
    `</li>`;
}

// ---- Trades
function tradesHTML(s) {
  const L = lists();
  if (!L.trades.length) return ui.empty({icon: 'swap', title: 'No trades added yet.'});
  return `${railHTML('trades', s.m)}<div class="mv-list">${tradeListHTML(s)}</div>`;
}
function tradeListHTML(s) {
  const L = lists();
  const rows = L.trades.filter(({t}) => !s.m || (t.sides || []).some(x => x.manager === s.m));
  if (!rows.length) {
    return ui.empty({icon: 'swap', title: `${data.name(s.m)} hasn't made a trade.`,
      action: {label: 'Show all trades', attrs: {'data-mv-go': tradesPath(null)}}});
  }
  const years = [];
  rows.forEach(r => { const y = years[years.length - 1]; if (y && y.year === r.t.year) y.rows.push(r); else years.push({year: r.t.year, rows: [r]}); });
  const me = data.me();
  let n = 0;
  const E = () => (n++ < 7 ? ' data-enter' : '');
  const secs = years.map(y => {
    const h = HEAD_H + 4 + y.rows.reduce((a, r) => a + estTrade(r.t) + 12, 0) - 12 + 16;
    return `<section class="mv-sec" style="contain-intrinsic-size:auto ${h}px"><h3 class="mv-sh"${E()}><span class="mv-yr n5">${esc(y.year)}</span> <span class="mv-yn">· ${count(y.rows.length, 'trade', 'trades')}</span></h3>` +
      `<div class="mv-cards">${y.rows.map(r => tradeHTML(r, me, E())).join('')}</div></section>`;
  }).join('');
  const first = rows[rows.length - 1].t.year, last = rows[0].t.year;
  const sum = s.m ? `${who(s.m)} · ${count(rows.length, 'trade', 'trades')}` : `${count(rows.length, 'trade', 'trades')} · ${first === last ? first : `${first}–${last}`}`;
  return sumHTML(sum) + secs;
}
function estTrade(t) {
  const sides = t.sides || [];
  const most = Math.max(1, ...sides.map(x => (x.got || []).length));
  // Measured: a two-sided card is 118 + 20 per line of the longer side; stacked sides are ~64 each.
  return sides.length === 2 ? 118 + most * 20 : 58 + sides.length * (64 + Math.max(0, most - 1) * 22);
}
function tradeHTML({t, i}, me, enter) {
  const sides = t.sides || [];
  const two = sides.length === 2;
  const ids = sides.map(x => String(x.manager || ''));
  const mine = !!me && ids.includes(me);
  const when = (t.week < 1 ? 'Preseason' : `Week ${t.week}`) + (t.date ? ' · ' + t.date : '');
  const side = (x, k) => {
    const id = String(x.manager || '');
    const got = (x.got || []).map(p => `<li>${esc(p)}</li>`).join('');
    return `<div class="mv-side mv-side-${k}"><a class="mv-who" href="#/managers/${esc(encodeURIComponent(id))}">${ui.avatar(id, {size: 32, attrs: {'data-morph-from': true}})}<span class="mv-who-n">${esc(data.name(id))}</span></a>` +
      `<span class="t-cap mv-rcv">received</span><ul class="mv-got" aria-label="${esc(data.name(id) + ' received')}">${got}</ul></div>`;
  };
  const inner = two
    ? side(sides[0], 'a') + `<span class="mv-medal" aria-hidden="true">${ui.icon('swap')}</span>` + side(sides[1], 'b')
    : sides.map(x => side(x, 'm')).join('');
  return `<article class="mv-trade${two ? '' : ' is-multi'}${mine ? ' is-mine' : ''}" data-tk="${i}" data-ms="${esc(ids.join(' '))}"${enter}>` +
    `<p class="ovl mv-when">${esc(when)}</p><div class="mv-sides">${inner}</div></article>`;
}

// ---- Search results
function resultsHTML(r) {
  if (!r.d.length && !r.t.length) return ui.empty({icon: 'search', title: 'No players match.', body: 'Check the spelling.'});
  const me = data.me();
  const foot = n => (n > SEARCH_MAX ? `First ${SEARCH_MAX} of ${data.nf(n)}. Keep typing.` : null);
  let h = '';
  if (r.d.length) {
    h += ui.group(r.d.slice(0, SEARCH_MAX).map((e, k) => ui.row({
      lead: ui.avatar(e.manager, {size: 24}),
      title: ui.raw(highlight(e.player, r.toks)),
      sub: `${e.year} · ${e.round}.${pad2(e.pick)} · ${data.name(e.manager)}`,
      chevron: true, cls: me && e.manager === me ? 'mv-mine' : '',
      attrs: {'data-mv-hit': 'd:' + k}
    })).join(''), {header: `Drafted · ${data.nf(r.d.length)}`, footer: foot(r.d.length)});
  }
  if (r.t.length) {
    h += ui.group(r.t.slice(0, SEARCH_MAX).map((e, k) => ui.row({
      lead: ui.avatar(e.manager, {size: 24}),
      title: ui.raw(highlight(e.player, r.toks)),
      sub: `${e.year} ${e.week < 1 ? 'preseason' : 'wk ' + e.week} · to ${data.name(e.manager)}`,
      chevron: true, cls: me && e.manager === me ? 'mv-mine' : '',
      attrs: {'data-mv-hit': 't:' + k}
    })).join(''), {header: `Traded · ${data.nf(r.t.length)}`, footer: foot(r.t.length)});
  }
  return `<div class="mv-res">${h}</div>`;
}

// ============================================================================ Behavior
function refs(st) {
  const el = st.el;
  st.input = el.querySelector('.mv-q input');
  st.below = el.querySelector('.mv-below');
  st.results = el.querySelector('.mv-results');
  st.segEl = el.querySelector('.mv-segwrap .seg');
  st.content = el.querySelector('.mv-content');
}
const navH = st => { const n = st.ctx.screen.querySelector(':scope > .nav'); return (n && n.offsetHeight) || 44; };
const accH = st => { const a = st.content.querySelector('.accessory'); return a && !st.below.hidden ? a.offsetHeight : 0; };
const tabH = () => { const t = document.getElementById('tabbar'); return (t && t.offsetHeight) || 0; };

// Sticky section headers: a solid bar layer fades in only while a header is stuck (like .accessory.is-pinned).
function observeHeads(st) {
  if (st.hio) { st.hio.disconnect(); st.hio = null; }
  const heads = st.content.querySelectorAll('.mv-sh');
  if (!heads.length || typeof IntersectionObserver !== 'function') return;
  const top = parseFloat(getComputedStyle(heads[0]).top) || 0;
  st.hio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.rootBounds || !e.rootBounds.height) return;
    e.target.classList.toggle('is-stuck', e.isIntersecting && e.intersectionRatio < 1 && e.boundingClientRect.top <= e.rootBounds.top + 1);
  }), {root: st.ctx.screen, rootMargin: `-${Math.round(top + 1)}px 0px 0px 0px`, threshold: [0, 1]});
  heads.forEach(h => st.hio.observe(h));
}

// Bring the selected year chip and manager into view (both rails scroll sideways).
function scrollRail(st, behavior = 'auto', {chipsOnly = false} = {}) {
  let pending = false;
  st.content.querySelectorAll(chipsOnly ? '[data-chips="mv-year"]' : '.mv-rail, [data-chips="mv-year"]').forEach(rail => {
    const p = rail.getBoundingClientRect();
    if (!p.width) { pending = true; return; }
    const b = rail.querySelector('[aria-pressed="true"]');
    if (!b) return;
    const r = b.getBoundingClientRect();
    if (r.left < p.left + 12 || r.right > p.right - 28) {
      rail.scrollTo({left: Math.max(0, rail.scrollLeft + (r.left - p.left) - (p.width - r.width) / 2), behavior: ui.RM ? 'auto' : behavior});
    }
  });
  st.railPending = pending;
}
function patchRail(st, m) {
  const rail = st.content.querySelector('.mv-rail');
  if (!rail) return;
  rail.classList.toggle('has-sel', !!m);
  rail.querySelectorAll('[data-mv-m]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.mvM || null) === (m || null))));
}
function patchMe(st) {
  const me = data.me();
  st.el.querySelectorAll('.mv-pick[data-m]').forEach(r => r.classList.toggle('is-mine', !!me && r.dataset.m === me));
  st.el.querySelectorAll('.mv-trade[data-ms]').forEach(c => c.classList.toggle('is-mine', !!me && c.dataset.ms.split(' ').includes(me)));
  st.el.querySelectorAll('.mv-av[data-mv-m]').forEach(b => b.classList.toggle('is-you', !!me && b.dataset.mvM === me));
  if (st.searching && st.q) runSearch(st, {announce: false});
}

// Scroll so the content (the filter rail) sits right under the sticky chrome, only when we are past it.
function scrollToContent(st) {
  const scr = st.ctx.screen;
  const target = st.content.querySelector('.mv-rail') || st.content;
  const off = navH(st) + accH(st);
  const y = Math.round(scr.scrollTop + target.getBoundingClientRect().top - scr.getBoundingClientRect().top - off);
  if (scr.scrollTop <= y + 1) return;
  const far = scr.scrollTop - y > scr.clientHeight * 1.5;
  scr.scrollTo({top: Math.max(0, y), behavior: ui.RM || far ? 'auto' : 'smooth'});
}

// Focus survives a patch (spec 10): when the focused control is replaced, focus its twin in the new markup
// (same manager button, the pressed year chip, the same search hit), else a persistent control.
function focusTwin(a) {
  if (!a || !a.matches) return null;
  if (a.matches('[data-mv-m]')) return `[data-mv-m="${CSS.escape(a.dataset.mvM || '')}"]`;
  if (a.closest('[data-chips="mv-year"]')) return '[data-chips="mv-year"] [aria-pressed="true"]';
  if (a.matches('[data-mv-hit]')) return `[data-mv-hit="${CSS.escape(a.dataset.mvHit)}"]`;
  return null;
}
function focusHome(st) {
  if (st.searching) return st.input;
  return st.content.querySelector('[data-chips="mv-year"] [aria-pressed="true"]') ||
    st.content.querySelector('.mv-rail [aria-pressed="true"]') ||
    (st.segEl && st.segEl.querySelector('[aria-selected="true"]'));
}
function keepFocus(st, box, mutate) {
  const a = document.activeElement;
  const had = !!a && a !== document.body && box.contains(a);
  const twin = had ? focusTwin(a) : null;
  mutate();
  if (!had || (a.isConnected && !a.closest('[hidden]'))) return;
  const next = (twin && st.el.querySelector(twin)) || focusHome(st);
  if (next && !next.closest('[hidden]')) { try { next.focus({preventScroll: true}); } catch (_) {} }
}

function swapList(st, s) {
  const list = st.content.querySelector('.mv-list');
  if (!list) return swapContent(st, s);
  const html = s.seg === 'trades' ? tradeListHTML(s) : draftListHTML(s);
  keepFocus(st, list, () => ui.crossfade(list, () => { list.innerHTML = html; }));
}
function swapContent(st, s, {fade = true} = {}) {
  const put = () => { st.content.innerHTML = contentHTML(s); st.content.dataset.seg = s.seg; };
  keepFocus(st, st.content, () => { if (fade) ui.crossfade(st.content, put); else put(); });
}

const go = (st, path) => st.ctx.replace(path);

// ---- Search
function onInput(st, e) {
  if (e.target !== st.input) return;
  const v = st.input.value;
  clearTimeout(st.timer);
  if (v.trim().length < 2) {
    st.q = '';
    if (st.searching) exitSearch(st, true);
    return;
  }
  st.timer = setTimeout(() => { st.q = v; runSearch(st); }, DEBOUNCE);
}
function runSearch(st, {announce = true} = {}) {
  const r = search(st.q);
  st.res = r;
  keepFocus(st, st.results, () => { st.results.innerHTML = resultsHTML(r); }); // a 'me' or 'data' refresh under a focused hit
  if (!st.searching) enterSearch(st);
  if (announce) ui.announce(r.d.length || r.t.length ? `${count(r.d.length, 'drafted player', 'drafted players')}, ${count(r.t.length, 'traded player', 'traded players')}.` : 'No players match. Check the spelling.');
}
function enterSearch(st) {
  st.searching = true;
  st.below.hidden = true;
  st.results.hidden = false;
  ui.animate(st.results, [{opacity: 0}, {opacity: 1}], {duration: 120, easing: 'linear'});
  // Keep the field in view when the list below it shrinks to a few results.
  const scr = st.ctx.screen;
  const f = st.input.closest('.search');
  const y = scr.scrollTop + f.getBoundingClientRect().top - scr.getBoundingClientRect().top - navH(st) - 8;
  if (scr.scrollTop > y + 1) scr.scrollTop = Math.max(0, y);
}
function exitSearch(st, fade) {
  st.searching = false;
  st.res = null;
  st.results.hidden = true;
  st.results.innerHTML = '';
  st.below.hidden = false;
  if (fade) ui.animate(st.below, [{opacity: 0}, {opacity: 1}], {duration: 120, easing: 'linear'});
}
function clearQuery(st) {
  clearTimeout(st.timer);
  st.q = '';
  if (st.input) { st.input.value = ''; st.input.parentElement.classList.remove('is-filled'); }
}

// A search hit: jump to that pick (drafts, filtered to its manager) or that trade card, then flash it.
async function openHit(st, key) {
  const [k, n] = String(key).split(':');
  const e = st.res && (k === 'd' ? st.res.d : st.res.t)[+n];
  if (!e) return;
  const path = k === 'd' ? draftsPath(e.year, e.manager) : tradesPath(e.manager);
  const sel = k === 'd' ? `[data-pk="${pickKey(e.year, e.round, e.pick)}"]` : `[data-tk="${e.ti}"]`;
  clearQuery(st);
  st.input.blur();
  await go(st, path);
  if (st.dead) return;
  if (st.searching) exitSearch(st, true); // same route: update() did not run
  reveal(st, sel);
}
function reveal(st, sel) {
  const el = st.content.querySelector(sel);
  if (!el) return;
  const sec = el.closest('.mv-sec');
  if (sec) sec.style.contentVisibility = 'visible';
  const scr = st.ctx.screen;
  const place = () => {
    const top = navH(st) + accH(st) + HEAD_H;
    const sr = scr.getBoundingClientRect(), r = el.getBoundingClientRect();
    const avail = scr.clientHeight - tabH() - top;
    const y = scr.scrollTop + (r.top - sr.top) - top - Math.max(0, (avail - r.height) / 2);
    return Math.max(0, Math.min(Math.round(y), scr.scrollHeight - scr.clientHeight));
  };
  const y = place();
  const smooth = !ui.RM && Math.abs(y - scr.scrollTop) < scr.clientHeight * 1.5;
  scr.scrollTo({top: y, behavior: smooth ? 'smooth' : 'auto'});
  const release = st.ctx.busy();
  const finish = () => {
    release();
    if (st.dead) return;
    const y2 = place(); // sections above may have rendered at their real height meanwhile
    if (Math.abs(y2 - scr.scrollTop) > 2) scr.scrollTop = y2;
    el.classList.remove('is-hit');
    void el.offsetWidth;
    el.classList.add('is-hit');
    el.tabIndex = -1;
    try { el.focus({preventScroll: true}); } catch (_) {}
    clearTimeout(st.hitT);
    st.hitT = setTimeout(() => el.classList.remove('is-hit'), 1300);
  };
  // Flash once the scroll has settled and the list's 120 ms cross-fade is over.
  setTimeout(finish, smooth ? 480 : 160);
}

// ---- Events
function onChange(st, e) {
  const {name, value} = e.detail || {};
  if (name === 'mv-seg') {
    if (value === 'trades') go(st, tradesPath(st.s.m));
    else go(st, draftsPath(st.lastDraftYear != null && hasDraft(st.lastDraftYear) ? st.lastDraftYear : latestYear(), st.s.m));
  } else if (name === 'mv-year') {
    go(st, draftsPath(Number(value), st.s.m));
  }
}
function onClick(st, e) {
  const t = e.target;
  if (!t || !t.closest) return;
  const b = t.closest('[data-mv-m]');
  if (b && st.el.contains(b)) {
    const v = b.dataset.mvM || null;
    const cur = st.s.m;
    const next = v && v === cur ? null : v; // tapping the selected manager again shows everyone
    if (next === cur) return;
    ui.haptic('selection');
    patchRail(st, next); // instant feedback; the list follows through update()
    st.railTap = true; // the rail stays where the finger left it
    go(st, st.s.seg === 'trades' ? tradesPath(next) : draftsPath(st.s.year, next)).finally(() => { st.railTap = false; });
    return;
  }
  const g = t.closest('[data-mv-go]');
  if (g && st.el.contains(g)) { go(st, g.dataset.mvGo); return; }
  const h = t.closest('[data-mv-hit]');
  if (h && st.el.contains(h)) openHit(st, h.dataset.mvHit);
}
function onKey(st, e) {
  if (e.target !== st.input) return;
  if (e.key === 'Enter') { e.preventDefault(); st.input.blur(); }
  else if (e.key === 'Escape' && !ui.sheetCount()) {
    e.preventDefault();
    if (st.input.value) { st.input.value = ''; st.input.dispatchEvent(new Event('input', {bubbles: true})); }
    st.input.blur();
  }
}

/** Called by app.js when the Moves tab is re-tapped at scroll top. Runs inside the tap (iOS raises the keyboard). */
export function focusSearch(ctx) {
  const st = ctx && ST.get(ctx);
  const inp = (st && st.input) || (ctx && ctx.screen && ctx.screen.querySelector('.mv-q input'));
  if (!inp) return;
  try { inp.focus({preventScroll: true}); } catch (_) { inp.focus(); }
  if (inp.value) inp.select();
}

export default {
  id: 'moves',
  title: 'Moves',
  render(ctx) {
    const s = resolve(ctx);
    // The segment stays visible during a search; only the content under it gives way to the results.
    return headHTML() + segHTML(s) +
      `<div class="mv-below"><div class="mv-content" data-seg="${s.seg}">${contentHTML(s)}</div></div>` +
      `<div class="mv-results" role="region" aria-label="Search results" hidden></div>`;
  },
  mount(el, ctx) {
    const s = resolve(ctx);
    const st = {ctx, el, s, q: '', searching: false, res: null, timer: 0, hitT: 0, hio: null, dead: false, railPending: false,
      lastDraftYear: s.seg === 'drafts' ? s.year : null};
    ST.set(ctx, st);
    refs(st);
    el.addEventListener('ui:change', e => onChange(st, e));
    el.addEventListener('click', e => onClick(st, e));
    el.addEventListener('input', e => onInput(st, e));
    el.addEventListener('keydown', e => onKey(st, e));
    observeHeads(st);
    scrollRail(st);
    if (ctx.first) ui.stagger(el);
  },
  onShow(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    observeHeads(st); // re-measure the sticky line (safe areas can change while hidden)
    if (st.railPending) scrollRail(st);
  },
  update(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    if (ctx.reason === 'me') { patchMe(st); return; }
    const prev = st.s, s = resolve(ctx);
    st.s = s;
    if (s.seg === 'drafts') st.lastDraftYear = s.year;
    if (ctx.reason === 'data') {
      // New league.json: recompute everything below the search field in place (app.js waits for idle).
      swapContent(st, s, {fade: false});
      ui.setSeg(st.segEl, s.seg, {animate: false});
      observeHeads(st);
      scrollRail(st);
      if (st.searching && st.q) runSearch(st, {announce: false});
      return;
    }
    // 'params': a segment, year or filter change (ours, or a link from elsewhere such as a profile's "See all").
    const wasSearching = st.searching;
    if (wasSearching) { clearQuery(st); exitSearch(st, false); }
    if (sameState(prev, s)) return;
    if (prev.seg !== s.seg) {
      ui.setSeg(st.segEl, s.seg);
      swapContent(st, s);
    } else {
      const chips = st.content.querySelector('[data-chips="mv-year"]');
      if (chips) ui.setChips(chips, s.year, {scroll: false}); // scrollRail() below brings it into view
      patchRail(st, s.m);
      swapList(st, s);
    }
    observeHeads(st);
    if (!wasSearching) scrollToContent(st);
    scrollRail(st, 'smooth', {chipsOnly: !!st.railTap && prev.seg === s.seg});
  },
  onAction(id, ctx) { if (id === 'focus-search') focusSearch(ctx); },
  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    clearTimeout(st.timer);
    clearTimeout(st.hitT);
    if (st.hio) st.hio.disconnect();
    ST.delete(ctx);
  }
};

// Debug hooks for the console (read-only helpers).
export const __moves = {search, index, lists, resolve, state: ctx => ST.get(ctx)};
