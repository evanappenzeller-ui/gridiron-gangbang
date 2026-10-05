// Draft: Drafts, Trades, Repeats and player search (spec 7.15), shown as League's Draft segment (views/league-draft.js
// wraps this view; it was a tab of its own). Owner: SHELL (was the moves package).
// Routes: /league/draft (the latest draft), /league/draft/<year>, /league/draft/trades, /league/draft/repeats (players
// a manager had in more than one season), optional ?m=<managerId> on each (the old /draft and /moves links redirect
// here in app.js). Route params: {seg: 'draft', sub: 'drafts' | 'trades' | 'repeats', year?}.
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
// Search results: rows are 63 tall; the first RES_FIRST (about a phone screen) are laid out at once and the rest sit in
// content-visibility chunks, so a keystroke only styles and lays out what can be on screen.
const RES_ROW_H = 63, RES_FIRST = 12, RES_CHUNK = 10;

// ============================================================================ Derived lists
// Cached per DATA object: data.reload() assigns a new DATA, so a stale cache can never be read.
let CACHE = null;
function lists() {
  const D = data.DATA;
  if (CACHE && CACHE.src === D) return CACHE;
  const drafts = ((D && D.drafts) || []).slice().sort((a, b) => b.year - a.year);
  // Old order: year descending, then week descending (stable, so same-week trades keep file order).
  const trades = ((D && D.trades) || []).map((t, i) => ({t, i})).sort((a, b) => b.t.year - a.t.year || b.t.week - a.t.week);
  CACHE = {src: D, drafts, trades, idx: null, repeats: null};
  return CACHE;
}
// Repeats: the same player on the same manager's team in two or more seasons, however he got there: drafted, traded
// for, or picked up (league.json `pickups`: [{year, week, manager, player}], when the file has them). Names are matched
// loosely (case, punctuation, accents, Jr./Sr./II/III), so a name written two ways across years still counts once.
// -> [{key, player (the latest spelling), manager, picks: [{year, how: ['R3' | 'trade' | 'waivers', ...]}] oldest
// first}], most seasons first, then the most recent season, then the player's name.
const SUFFIX = /\b(jr|sr|ii|iii|iv|v)\b/g;
const playerKey = name => data.norm(String(name || '')).replace(SUFFIX, '').replace(/\s+/g, ' ').trim();
function repeats() {
  const L = lists();
  if (L.repeats) return L.repeats;
  const by = new Map();
  const add = (manager, player, year, how) => {
    const k = String(manager || '') + '|' + playerKey(player);
    if (!playerKey(player) || !data.M[manager] || !year) return;
    let e = by.get(k);
    if (!e) by.set(k, e = {key: k, player: String(player || ''), manager: String(manager), picks: [], latest: 0});
    let y = e.picks.find(x => x.year === year);
    if (!y) e.picks.push(y = {year, how: []});
    if (!y.how.includes(how)) y.how.push(how);
    if (year >= e.latest) { e.latest = year; e.player = String(player || ''); }
  };
  L.drafts.forEach(d => (d.picks || []).forEach(p => add(p.manager, p.player, d.year, 'R' + p.round)));
  L.trades.forEach(({t}) => (t.sides || []).forEach(x => (x.got || []).forEach(pl => add(x.manager, pl, t.year, 'trade'))));
  (((data.DATA && data.DATA.pickups) || [])).forEach(p => add(p.manager, p.player, Number(p.year), 'waivers'));
  L.repeats = [...by.values()].filter(e => e.picks.length > 1)
    .map(e => Object.assign(e, {picks: e.picks.sort((a, b) => a.year - b.year)}))
    .sort((a, b) => b.picks.length - a.picks.length || b.latest - a.latest || a.player.localeCompare(b.player));
  return L.repeats;
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
  const sub = p.sub || p.seg;
  const seg = sub === 'trades' || sub === 'repeats' ? sub : 'drafts';
  const latest = latestYear();
  const year = p.year != null && isFinite(p.year) ? Number(p.year) : latest;
  const m = q.m && data.M[q.m] ? String(q.m) : null;
  return {seg, year, latest, m};
}
const sameState = (a, b) => a.seg === b.seg && a.year === b.year && a.m === b.m && a.latest === b.latest;
const draftsPath = (year, m) => (year == null || year === latestYear() ? '/league/draft' : '/league/draft/' + year) + qs(m);
const tradesPath = m => '/league/draft/trades' + qs(m);
const repeatsPath = m => '/league/draft/repeats' + qs(m);
const hasDraft = y => lists().drafts.some(d => d.year === y);

const ST = new WeakMap(); // ctx → per-screen state

// ============================================================================ Markup
function headHTML() {
  // "Cancel" slides in beside the field while it is focused or holds text (the iOS search bar pattern).
  return `<div class="mv-q">${ui.searchField({name: 'q', placeholder: 'Search players', label: 'Search players'})}`
    + `<button type="button" class="mv-cancel" data-mv-cancel tabindex="-1" aria-hidden="true">Cancel</button></div>`;
}
function segHTML(s) {
  return `<div class="mv-segwrap">${ui.seg({name: 'mv-seg', label: 'Drafts, trades or repeats', value: s.seg,
    items: [{id: 'drafts', label: 'Drafts'}, {id: 'trades', label: 'Trades'}, {id: 'repeats', label: 'Repeats'}]})}</div>`;
}
function contentHTML(s) { return s.seg === 'trades' ? tradesHTML(s) : s.seg === 'repeats' ? repeatsHTML(s) : draftsHTML(s); }
const listHTML = s => (s.seg === 'trades' ? tradeListHTML(s) : s.seg === 'repeats' ? repeatListHTML(s) : draftListHTML(s));

function railHTML(kind, m) {
  const me = data.me();
  const what = kind === 'trades' ? 'trades' : kind === 'repeats' ? 'repeats' : 'picks';
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
  // The manager rail comes first in both segments, so it never moves when Drafts and Trades switch.
  return `${railHTML('drafts', s.m)}<div class="accessory mv-acc">${chips}</div><div class="mv-list">${draftListHTML(s)}</div>`;
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
  // Entrance: whole round sections rise as one (a header plus its inset group); rows never move inside a static card.
  let n = 0;
  const E = () => (n++ < 3 ? ' data-enter' : '');
  const secs = keys.map(r => {
    const list = rounds.get(r);
    const h = HEAD_H + 4 + list.length * ROW_H; // content size: the section's 16 px bottom padding is added on top
    return `<section class="mv-sec"${E()} style="contain-intrinsic-size:auto ${h}px"><h3 class="mv-sh"><span class="ovl">Round ${esc(r)}</span></h3>` +
      `<ol class="group mv-picks">${list.map(p => pickHTML(d.year, p, me, '')).join('')}</ol></section>`;
  }).join('');
  const sum = s.m ? `${who(s.m)} · ${count(picks.length, 'pick', 'picks')} in ${d.year}` : `${count(picks.length, 'pick', 'picks')} · ${count(keys.length, 'round', 'rounds')}`;
  return sumHTML(sum) + secs;
}
const pickKey = (year, round, pick) => `${year}-${round}.${pad2(pick)}`;
function pickHTML(year, p, me, enter) {
  const id = String(p.manager || '');
  const pk = `${p.round}.${pad2(p.pick)}`;
  // The whole row is the link to the manager's profile: one 56 px target, so the name line and the manager line
  // never disagree about what a tap does. The 20 px avatar is the morph source.
  return `<li class="mv-pick${me && id === me ? ' is-mine' : ''}" data-pk="${esc(pickKey(year, p.round, p.pick))}" data-m="${esc(id)}"${enter}>` +
    `<a class="mv-row" href="#/managers/${esc(encodeURIComponent(id))}">` +
    `<span class="mv-tile n5" aria-hidden="true">${esc(pk)}</span>` +
    `<span class="mv-main"><span class="mv-player"><span class="sr-only">Round ${esc(p.round)}, pick ${esc(p.pick)}: </span>${esc(p.player)}</span>` +
    `<span class="mv-by"><span class="sr-only">, drafted by </span>${ui.avatar(id, {size: 20, attrs: {'data-morph-from': true}})}<span class="mv-by-n">${esc(data.name(id))}</span></span></span>` +
    (p.pos ? `<span class="pill mv-pos"><span class="sr-only">, </span>${esc(p.pos)}</span>` : '') +
    `</a></li>`;
}

// ---- Repeats
function repeatsHTML(s) {
  const L = lists();
  if (!L.drafts.length) return ui.empty({icon: 'list-number', title: 'No draft history added yet.'});
  return `${railHTML('repeats', s.m)}<div class="mv-list">${repeatListHTML(s)}</div>`;
}
function repeatListHTML(s) {
  const all = repeats();
  const rows = all.filter(e => !s.m || e.manager === s.m);
  if (!rows.length) {
    return ui.empty({icon: 'person', title: s.m ? `${data.name(s.m)} hasn't had anyone twice.` : 'No repeats yet.',
      body: 'A player on the same manager\u2019s team in two or more seasons (drafted or traded for) shows up here.',
      action: s.m ? {label: 'Show everyone', attrs: {'data-mv-go': repeatsPath(null)}} : null});
  }
  const groups = [];
  rows.forEach(e => { const g = groups[groups.length - 1]; if (g && g.n === e.picks.length) g.rows.push(e); else groups.push({n: e.picks.length, rows: [e]}); });
  const me = data.me();
  let n = 0;
  const E = () => (n++ < 3 ? ' data-enter' : '');
  const secs = groups.map(g => {
    const h = HEAD_H + 4 + g.rows.length * (ROW_H + 20);
    return `<section class="mv-sec"${E()} style="contain-intrinsic-size:auto ${h}px"><h3 class="mv-sh"><span class="ovl">${g.n} seasons</span> <span class="mv-yn">· ${count(g.rows.length, 'player', 'players')}</span></h3>` +
      `<ol class="group mv-picks">${g.rows.map(e => repeatHTML(e, me)).join('')}</ol></section>`;
  }).join('');
  const top = rows[0];
  const sum = s.m ? `${who(s.m)} · ${count(rows.length, 'player', 'players')} in more than one season`
    : `${count(rows.length, 'repeat', 'repeats')} · most: <b>${esc(top.player)}</b> (${esc(data.name(top.manager))}), ${top.picks.length} seasons`;
  return sumHTML(sum) + secs;
}
function repeatHTML(e, me) {
  const id = e.manager;
  const seasons = e.picks.map(p => `${p.year} ${p.how.join(' + ')}`).join(' · ');
  return `<li class="mv-pick mv-rep${me && id === me ? ' is-mine' : ''}" data-pk="${esc('r:' + e.key)}" data-m="${esc(id)}">` +
    `<a class="mv-row" href="#/managers/${esc(encodeURIComponent(id))}">` +
    `<span class="mv-tile n5" aria-hidden="true">${e.picks.length}×</span>` +
    `<span class="mv-main"><span class="mv-player">${esc(e.player)}</span>` +
    `<span class="mv-by"><span class="sr-only">, on the team of </span>${ui.avatar(id, {size: 20, attrs: {'data-morph-from': true}})}<span class="mv-by-n">${esc(data.name(id))}</span></span>` +
    `<span class="mv-rep-yrs"><span class="sr-only">, in </span>${esc(seasons)}</span></span>` +
    `</a></li>`;
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
    const h = HEAD_H + 4 + y.rows.reduce((a, r) => a + estTrade(r.t) + 12, 0) - 12; // content size, padding excluded
    return `<section class="mv-sec" style="contain-intrinsic-size:auto ${h}px"><h3 class="mv-sh"${E()}><span class="mv-yr n5">${esc(y.year)}</span> <span class="mv-yn">· ${count(y.rows.length, 'trade', 'trades')}</span></h3>` +
      `<div class="mv-cards">${y.rows.map(r => tradeHTML(r, me, E(), s.m)).join('')}</div></section>`;
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
function tradeHTML({t, i}, me, enter, m) {
  // Filtered to a manager: that manager's side leads (left, or first in a stack), so every card reads the same way.
  const raw = t.sides || [];
  const sides = m ? raw.filter(x => x.manager === m).concat(raw.filter(x => x.manager !== m)) : raw;
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
// The first `plain` rows go straight in; the rest in chunks of RES_CHUNK that content-visibility skips while off screen.
function chunked(rows, plain) {
  let h = rows.slice(0, plain).join('');
  for (let i = Math.max(0, plain); i < rows.length; i += RES_CHUNK) {
    const part = rows.slice(i, i + RES_CHUNK);
    h += `<div class="mv-chunk" style="contain-intrinsic-size:auto ${part.length * RES_ROW_H}px">${part.join('')}</div>`;
  }
  return h;
}
function resultsHTML(r) {
  if (!r.d.length && !r.t.length) return ui.empty({icon: 'search', title: 'No players match.', body: 'Check the spelling.'});
  const me = data.me();
  const foot = n => (n > SEARCH_MAX ? `First ${SEARCH_MAX} of ${data.nf(n)}. Keep typing.` : null);
  let h = '', plain = RES_FIRST;
  if (r.d.length) {
    const rows = r.d.slice(0, SEARCH_MAX).map((e, k) => ui.row({
      lead: ui.avatar(e.manager, {size: 24}),
      title: ui.raw(highlight(e.player, r.toks)),
      sub: `${e.year} · ${e.round}.${pad2(e.pick)} · ${data.name(e.manager)}`,
      chevron: true, cls: me && e.manager === me ? 'mv-mine' : '',
      attrs: {'data-mv-hit': 'd:' + k}
    }));
    h += ui.group(chunked(rows, plain), {header: `Drafted · ${data.nf(r.d.length)}`, footer: foot(r.d.length)});
    plain -= rows.length;
  }
  if (r.t.length) {
    const rows = r.t.slice(0, SEARCH_MAX).map((e, k) => ui.row({
      lead: ui.avatar(e.manager, {size: 24}),
      title: ui.raw(highlight(e.player, r.toks)),
      sub: `${e.year} ${e.week < 1 ? 'Preseason' : 'wk ' + e.week} · to ${data.name(e.manager)}`,
      chevron: true, cls: me && e.manager === me ? 'mv-mine' : '',
      attrs: {'data-mv-hit': 't:' + k}
    }));
    h += ui.group(chunked(rows, plain), {header: `Traded · ${data.nf(r.t.length)}`, footer: foot(r.t.length)});
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
  st.q0 = el.querySelector('.mv-q');
  st.cancel = el.querySelector('[data-mv-cancel]');
}
// Search bar state: active while the field is focused or holds text. The field keeps its box (compositor-only):
// its fill and focus ring scale to make room, the clear button moves in, and Cancel slides into the gap.
function setActive(st, on) {
  const q = st.q0;
  if (!q || q.classList.contains('is-active') === on) return;
  if (on) {
    const w = q.offsetWidth, cw = st.cancel.offsetWidth + 8;
    if (w) { q.style.setProperty('--mv-cw', cw + 'px'); q.style.setProperty('--mv-k', ((w - cw) / w).toFixed(4)); }
  }
  q.classList.toggle('is-active', on);
  st.cancel.tabIndex = on ? 0 : -1;
  if (on) st.cancel.removeAttribute('aria-hidden'); else st.cancel.setAttribute('aria-hidden', 'true');
}
function cancelSearch(st) {
  if (st.input.value) { st.input.value = ''; st.input.dispatchEvent(new Event('input', {bubbles: true})); }
  st.input.blur();
  setActive(st, false);
}
const navH = st => { const n = st.ctx.screen.querySelector(':scope > .nav'); return (n && n.offsetHeight) || 44; };
const accH = st => { const a = st.content.querySelector('.accessory'); return a && !st.below.hidden ? a.offsetHeight : 0; };
const tabH = () => { const t = document.getElementById('tabbar'); return (t && t.offsetHeight) || 0; };

// Sticky section headers: a solid bar layer fades in only while a header is stuck (like .accessory.is-pinned).
// The observer covers ordinary scrolling. It says nothing about a header whose section content-visibility was
// skipping at the moment of a jump (scrollbar drag, programmatic scroll), so a cheap re-check runs once scrolling
// settles: skipped sections are off screen (never stuck), the rest are measured.
function unobserveHeads(st) {
  if (st.hio) { st.hio.disconnect(); st.hio = null; }
  if (st.recheck) {
    const scr = st.ctx.screen;
    scr.removeEventListener('scrollend', st.recheck);
    scr.removeEventListener('scroll', st.recheckSoon);
    clearTimeout(st.recheckT);
    st.recheck = st.recheckSoon = null;
  }
}
function observeHeads(st) {
  unobserveHeads(st);
  const heads = [...st.content.querySelectorAll('.mv-sh')];
  if (!heads.length) return;
  const top = parseFloat(getComputedStyle(heads[0]).top) || 0;
  const scr = st.ctx.screen;
  if (typeof IntersectionObserver === 'function') {
    st.hio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.rootBounds || !e.rootBounds.height || !ui.rendered(scr)) return; // hidden tab layer: keep the state
      e.target.classList.toggle('is-stuck', e.isIntersecting && e.intersectionRatio < 1 && e.boundingClientRect.top <= e.rootBounds.top + 1);
    }), {root: scr, rootMargin: `-${Math.round(top + 1)}px 0px 0px 0px`, threshold: [0, 1]});
    heads.forEach(h => st.hio.observe(h));
  }
  const skipped = h => typeof h.checkVisibility === 'function' && !h.checkVisibility({contentVisibilityAuto: true});
  st.recheck = () => {
    if (st.dead || st.below.hidden) return;
    const line = scr.getBoundingClientRect().top + top + 1; // the observer's root top edge
    for (const h of heads) {
      if (skipped(h)) { h.classList.remove('is-stuck'); continue; } // measuring would force the skipped section's layout
      const r = h.getBoundingClientRect();
      // Same rule as the observer: crossing the line (stuck, or being pushed out by the next section).
      h.classList.toggle('is-stuck', r.height > 0 && r.top < line && r.bottom > line);
    }
  };
  if ('onscrollend' in window) scr.addEventListener('scrollend', st.recheck, {passive: true});
  else {
    st.recheckSoon = () => { clearTimeout(st.recheckT); st.recheckT = setTimeout(st.recheck, 150); };
    scr.addEventListener('scroll', st.recheckSoon, {passive: true});
  }
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

// A 'data' update rebuilds the list, so remembered section sizes are gone: keep the first visible pick or card
// at the same place on screen. Only sections near the viewport are measured (the rest stay skipped).
function visibleAnchor(st) {
  const scr = st.ctx.screen;
  const sr = scr.getBoundingClientRect();
  const line = sr.top + navH(st) + accH(st) + HEAD_H; // under the sticky chrome and a stuck section header
  for (const sec of st.content.querySelectorAll('.mv-sec')) {
    const r = sec.getBoundingClientRect();
    if (r.bottom <= line) continue;
    if (r.top >= sr.bottom) break;
    for (const it of sec.querySelectorAll('[data-pk], [data-tk]')) {
      const ir = it.getBoundingClientRect();
      if (ir.bottom > line) return {sel: it.dataset.pk != null ? `[data-pk="${CSS.escape(it.dataset.pk)}"]` : `[data-tk="${CSS.escape(it.dataset.tk)}"]`, top: ir.top};
    }
  }
  return null;
}
function restoreAnchor(st, a) {
  const el = st.content.querySelector(a.sel);
  if (!el) return;
  const d = Math.round(el.getBoundingClientRect().top - a.top);
  if (d) st.ctx.screen.scrollTop += d;
}

// Focus survives a patch (spec 10): when the focused control is replaced, focus its twin in the new markup
// (same manager button, the pressed year chip, the same search hit), else a persistent control.
function focusTwin(a) {
  if (!a || !a.matches) return null;
  if (a.matches('[data-mv-m]')) return `[data-mv-m="${CSS.escape(a.dataset.mvM || '')}"]`;
  if (a.closest('[data-chips="mv-year"]')) return '[data-chips="mv-year"] [aria-pressed="true"]';
  if (a.matches('[data-mv-hit]')) return `[data-mv-hit="${CSS.escape(a.dataset.mvHit)}"]`;
  const pick = a.closest('[data-pk]');
  if (pick && a.matches('.mv-row')) return `[data-pk="${CSS.escape(pick.dataset.pk)}"] .mv-row`;
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
  const html = listHTML(s);
  keepFocus(st, list, () => ui.crossfade(list, () => { list.innerHTML = html; }));
}
function swapContent(st, s, {fade = true} = {}) {
  const put = () => { st.content.innerHTML = contentHTML(s); st.content.dataset.seg = s.seg; };
  keepFocus(st, st.content, () => { if (fade) ui.crossfade(st.content, put); else put(); });
}

const go = (st, path) => st.ctx.replace(path);

// ---- Search
function warmIndex(st, timeout = 2000) {
  if (lists().idx) return;
  ui.onIdle(() => { if (!st.dead) index(); }, timeout); // index() is a no-op once built
}
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
  // The Drafts/Trades control means nothing to mixed results: dimmed and out of reach until the search ends.
  const sw = st.segEl && st.segEl.parentElement;
  if (sw) { sw.classList.add('is-off'); sw.inert = true; }
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
  const sw = st.segEl && st.segEl.parentElement;
  if (sw) { sw.classList.remove('is-off'); sw.inert = false; }
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
  if (st.input && document.activeElement !== st.input) setActive(st, false);
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
  st.hitNav = true;
  try { await go(st, path); } finally { st.hitNav = false; }
  if (st.dead) return;
  if (st.searching) exitSearch(st, true); // same route: update() did not run
  reveal(st, sel);
}
function reveal(st, sel) {
  const el = st.content.querySelector(sel);
  if (!el) return;
  // Lay out the target's section and every section above it for real, so the measured position is exact:
  // skipped sections only carry estimated heights, and a long name that wraps would shift the target later.
  // Back to auto afterwards; contain-intrinsic-size:auto remembers the real sizes from now on.
  const sec = el.closest('.mv-sec');
  const secs = [...st.content.querySelectorAll('.mv-sec')];
  const shown = secs.slice(0, sec ? secs.indexOf(sec) + 1 : 0);
  shown.forEach(x => { x.style.contentVisibility = 'visible'; });
  const scr = st.ctx.screen;
  const place = () => {
    const top = navH(st) + accH(st) + HEAD_H;
    const sr = scr.getBoundingClientRect(), r = el.getBoundingClientRect();
    const avail = scr.clientHeight - tabH() - top;
    const y = scr.scrollTop + (r.top - sr.top) - top - Math.max(0, (avail - r.height) / 2);
    return Math.max(0, Math.min(Math.round(y), scr.scrollHeight - scr.clientHeight));
  };
  const y = place();
  const smooth = !ui.RM && Math.abs(y - scr.scrollTop) > 2 && Math.abs(y - scr.scrollTop) < scr.clientHeight * 1.5;
  scr.scrollTo({top: y, behavior: smooth ? 'smooth' : 'auto'});
  const release = st.ctx.busy();
  let done = false, fallback = 0;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(fallback);
    scr.removeEventListener('scrollend', finish);
    release();
    shown.forEach(x => { x.style.contentVisibility = ''; });
    if (st.dead) return;
    el.classList.remove('is-hit');
    void el.offsetWidth;
    el.classList.add('is-hit');
    const f = el.querySelector('.mv-row') || el; // a pick's row link; a trade card itself
    if (f === el) el.tabIndex = -1;
    try { f.focus({preventScroll: true}); } catch (_) {}
    clearTimeout(st.hitT);
    st.hitT = setTimeout(() => el.classList.remove('is-hit'), 1300);
  };
  // Flash once the scroll has settled (scrollend where supported) and the list's 120 ms cross-fade is over.
  if (smooth && 'onscrollend' in window) {
    scr.addEventListener('scrollend', finish, {once: true});
    fallback = setTimeout(finish, 900);
  } else {
    fallback = setTimeout(finish, smooth ? 480 : 160);
  }
}

// ---- Events
function onChange(st, e) {
  const {name, value} = e.detail || {};
  if (name === 'mv-seg') {
    if (value === 'trades') go(st, tradesPath(st.s.m));
    else if (value === 'repeats') go(st, repeatsPath(st.s.m));
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
    go(st, st.s.seg === 'trades' ? tradesPath(next) : st.s.seg === 'repeats' ? repeatsPath(next) : draftsPath(st.s.year, next)).finally(() => { st.railTap = false; });
    return;
  }
  if (t.closest('[data-mv-cancel]')) { cancelSearch(st); return; }
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

/** Called by app.js when the Draft tab is re-tapped at scroll top. Runs inside the tap (iOS raises the keyboard). */
export function focusSearch(ctx) {
  const st = ctx && ST.get(ctx);
  const inp = (st && st.input) || (ctx && ctx.screen && ctx.screen.querySelector('.mv-q input'));
  if (!inp) return;
  try { inp.focus({preventScroll: true}); } catch (_) { inp.focus(); }
  if (inp.value) inp.select();
}

export default {
  id: 'moves',
  title: 'Draft',
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
    // The search index is built off the keystroke path: at idle after mount, and again when the field takes focus
    // (a no-op once built; after a data reload it rebuilds for the new DATA).
    el.addEventListener('focusin', e => { if (e.target === st.input) { warmIndex(st, 150); setActive(st, true); } });
    // Cancel stays while the field holds text (a scroll that hides the keyboard keeps the search open).
    el.addEventListener('focusout', e => {
      if (e.target !== st.input) return;
      setTimeout(() => { if (!st.dead && document.activeElement !== st.input && document.activeElement !== st.cancel && !st.input.value) setActive(st, false); }, 0);
    });
    observeHeads(st);
    scrollRail(st);
    if (ctx.first) ui.stagger(el);
    warmIndex(st);
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
      // The first visible pick or card stays where it was on screen.
      const anchor = st.searching ? null : visibleAnchor(st);
      swapContent(st, s, {fade: false});
      ui.setSeg(st.segEl, s.seg, {animate: false});
      if (anchor) restoreAnchor(st, anchor);
      observeHeads(st);
      scrollRail(st);
      if (st.searching && st.q) runSearch(st, {announce: false});
      warmIndex(st);
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
    // A search hit scrolls to its own target (reveal); anything else (chips, rail, a "See all" link that
    // lands while a search was open) brings the top of the new list under the sticky chrome.
    if (!st.hitNav) scrollToContent(st);
    scrollRail(st, 'smooth', {chipsOnly: !!st.railTap && prev.seg === s.seg});
  },
  onAction(id, ctx) { if (id === 'focus-search') focusSearch(ctx); },
  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    clearTimeout(st.timer);
    clearTimeout(st.hitT);
    unobserveHeads(st);
    ST.delete(ctx);
  }
};

// Debug hooks for the console (read-only helpers).
export const __moves = {search, index, lists, resolve, resultsHTML, state: ctx => ST.get(ctx), reset: () => { CACHE = null; }};
