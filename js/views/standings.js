// Standings root (#/standings): power rankings and playoff odds for the live season, the seasons rail,
// all-time list (FLIP on sort) or table, sort sheet.
// Owner: standings package. Spec 7.9 + week-features contract (Power rankings, Playoff odds).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as stats from '../core/stats.js';

const esc = data.esc;
const VIEW_KEY = 'gg-std-view';
const PR_TOP = 5;    // power rankings rows shown before "Show all"
const ODDS_TOP = 6;  // playoff odds rows shown before "Show all" (the six who'd be in)

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
const stateOf = ctx => S.get(ctx) || {sort: {...lastSort}, view: readView(), prAll: false, oddsAll: false};

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

// ---------------------------------------------------------------- Live season: power rankings
const liveSeason = () => data.SEASONS.find(s => s.live) || null;

function powerData() {
  const s = liveSeason();
  const week = s ? data.throughWeek(s) : 0;
  if (!week) return null;
  let rows = null;
  try { rows = stats.powerRankings(s.year, week); } catch (e) { console.error(e); return null; }
  if (!Array.isArray(rows) || !rows.length) return null;
  rows = rows.filter(r => r && r.id).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  // Scores come as 0..1 or 0..100; show them on a 0..100 scale.
  const max = Math.max(...rows.map(r => Number(r.score) || 0));
  return {year: s.year, week, rows, k: max > 0 && max <= 1.5 ? 100 : 1};
}
function moveOf(r) {
  if (typeof r.move === 'number' && isFinite(r.move)) return r.move;
  return r.prev != null && r.rank != null ? r.prev - r.rank : null;
}
function moveHtml(mv) {
  if (!mv) return `<span class="std-mv">–</span>`;
  return mv > 0 ? `<span class="std-mv is-up">▲${mv}</span>` : `<span class="std-mv is-down">▼${-mv}</span>`;
}
const moveWords = mv => mv == null ? '' : mv === 0 ? ', no change' : mv > 0 ? `, up ${mv}` : `, down ${-mv}`;

function powerRow(r, i, P, meId) {
  const id = r.id;
  const nm = data.name(id);
  const mv = moveOf(r);
  const rec = data.recStr(r.w || 0, r.l || 0, r.t || 0);
  const sc = Math.max(0, (Number(r.score) || 0) * P.k);
  const rank = r.rank || i + 1;
  const why = r.reason ? String(r.reason) : '';
  const label = `${rank}. ${nm}, ${rec}${moveWords(mv)}. Power score ${sc.toFixed(1)}.${why ? ' ' + why + '.' : ''}`.replace(/\.\.$/, '.');
  return `<a class="row std-pr${id === meId ? ' is-me' : ''}${i >= PR_TOP ? ' is-more' : ''}" href="#/managers/${esc(id)}" data-key="pr-${esc(id)}" aria-label="${esc(label)}">`
    + `<span class="row-lead"><span class="std-pr-rk" aria-hidden="true"><span class="n4${rank <= 3 ? ' is-r' + rank : ''}">${rank}</span>${moveHtml(mv)}</span>`
    + `${ui.avatar(id, {size: 40, you: id === meId, attrs: {'data-morph-from': ''}})}</span>`
    + `<span class="row-main"><span class="row-title std-pr-t"><span class="std-nm">${esc(nm)}</span><span class="std-pr-rec">${esc(rec)}</span></span>`
    + (why ? `<span class="std-pr-why">${esc(why)}</span>` : '') + `</span>`
    + `<span class="row-trail std-pr-sc ${data.color(id).cls}" aria-hidden="true"><span class="n4">${sc.toFixed(1)}</span>`
    + `<span class="std-pr-bar"><i style="transform:scaleX(${Math.min(1, sc / 100).toFixed(3)})"></i></span></span></a>`;
}
function moreBtn(which, all, n, top, list) {
  return `<div class="std-more">${ui.button({label: all ? 'Show fewer' : `Show all ${n}`, kind: 'plain', size: 's', attrs: {'data-more': which, 'aria-expanded': String(!!all), 'aria-controls': list}})}</div>`;
}
// Your row below the cut stays visible in the collapsed list, after a gap (like Today's board). Returns the
// class to add to that row and the gap to put before it.
function pinMe(i, top, id, meId) {
  if (id !== meId || i < top) return {cls: '', gap: ''};
  return {cls: ' is-pin', gap: i > top ? `<div class="std-gap is-gap" aria-hidden="true"><span>···</span></div>` : ''};
}
function powerHtml(st) {
  const P = powerData();
  if (!P) return '';
  const meId = data.me();
  return `<section class="std-power${st.prAll ? ' is-all' : ''}" data-enter aria-labelledby="std-pr-h">`
    + `<div class="sh std-xh"><h2 id="std-pr-h">Power rankings</h2><span class="ovl std-xh-o">After week ${P.week}</span></div>`
    + ui.group(P.rows.map((r, i) => { const p = pinMe(i, PR_TOP, r.id, meId); return p.gap + powerRow(r, i, P, meId).replace('class="row std-pr', `class="row std-pr${p.cls}`); }).join(''), {cls: 'std-pr-g', attrs: {id: 'std-pr-list'}})
    + (P.rows.length > PR_TOP ? moreBtn('pr', st.prAll, P.rows.length, PR_TOP, 'std-pr-list') : '')
    + `<p class="group-f std-foot">All-play record, actual record, points per game and the last three weeks.</p>`
    + `</section>`;
}

// ---------------------------------------------------------------- Live season: playoff odds
// Simulated once per derived season object (data.reload() re-derives SEASONS, so a new week starts over).
const oddsMemo = new WeakMap();     // live season object → playoffOdds result
const oddsRunning = new WeakMap();  // live season object → Promise

function oddsSeason() {
  const s = liveSeason();
  const tw = s ? data.throughWeek(s) : 0;
  if (!tw) return null;
  const raw = data.DATA && data.DATA.seasons.find(x => x.year === s.year);
  const left = new Set(((raw && raw.schedule) || []).filter(g => g.week > tw).map(g => g.week));
  return left.size ? {s, tw, weeksLeft: left.size} : null;
}
function runOdds(s) {
  if (oddsMemo.has(s)) return Promise.resolve(oddsMemo.get(s));
  if (oddsRunning.has(s)) return oddsRunning.get(s);
  const args = {year: s.year};
  const p = (typeof stats.playoffOddsAsync === 'function'
    ? Promise.resolve().then(() => stats.playoffOddsAsync(args))
    : new Promise((res, rej) => ui.onIdle(() => { try { res(stats.playoffOdds(args)); } catch (e) { rej(e); } })))
    .then(res => {
      oddsRunning.delete(s);
      if (!res || !Array.isArray(res.rows) || !res.rows.length) throw new Error('playoffOdds returned no rows');
      oddsMemo.set(s, res);
      return res;
    }, e => { oddsRunning.delete(s); throw e; });
  oddsRunning.set(s, p);
  return p;
}

function pctTxt(f) {
  f = Number(f) || 0;
  if (f <= 0) return '–';
  if (f >= 1) return '100%';
  if (f < .005) return '<1%';
  if (f > .995) return '>99%';
  return Math.round(f * 100) + '%';
}
function pctWords(f) {
  f = Number(f) || 0;
  if (f <= 0) return 'none';
  if (f >= 1) return '100 percent';
  if (f < .005) return 'under 1 percent';
  if (f > .995) return 'over 99 percent';
  return Math.round(f * 100) + ' percent';
}
function projRec(r) {
  if (!isFinite(r.projW) || !isFinite(r.projL)) return null;
  const w = Math.round(r.projW);
  return data.recStr(w, Math.max(0, Math.round(r.projW + r.projL) - w), 0);
}
function oddsRow(r, i, s, meId) {
  const id = r.id;
  const nm = data.name(id);
  const t = s.table.find(x => x.id === id);
  const rec = t ? data.recStr(t.w, t.l, t.t) : '';
  const proj = projRec(r);
  const sub = [rec, proj ? `proj. ${proj}` : ''].filter(Boolean).join(' · ');
  const label = `${nm}${rec ? ', ' + rec : ''}${proj ? ', projected ' + proj : ''}. Playoffs ${pctWords(r.playoffs)}, bye ${pctWords(r.bye)}, title ${pctWords(r.title)}.`;
  const po = Math.max(0, Math.min(1, Number(r.playoffs) || 0));
  return `<a class="row std-od${id === meId ? ' is-me' : ''}${i >= ODDS_TOP ? ' is-more' : ''}" href="#/managers/${esc(id)}" data-key="od-${esc(id)}" aria-label="${esc(label)}">`
    + `<span class="row-lead">${ui.avatar(id, {size: 28, you: id === meId, attrs: {'data-morph-from': ''}})}</span>`
    + `<span class="row-main"><span class="row-title">${esc(nm)}</span>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}</span>`
    + `<span class="std-od-c is-po" aria-hidden="true"><span class="n5">${pctTxt(r.playoffs)}</span><span class="std-od-bar"><i style="transform:scaleX(${po.toFixed(3)})"></i></span></span>`
    + `<span class="std-od-c" aria-hidden="true"><span class="n5">${pctTxt(r.bye)}</span></span>`
    + `<span class="std-od-c" aria-hidden="true"><span class="n5">${pctTxt(r.title)}</span></span></a>`;
}
const colHead = () => `<div class="std-od-colh" aria-hidden="true"><span>Playoffs</span><span>Bye</span><span>Title</span></div>`;

function oddsBody(res, O, st) {
  const s = O.s;
  const meId = data.me();
  const rows = res.rows.filter(r => r && r.id).slice().sort((a, b) =>
    (b.playoffs - a.playoffs) || (b.title - a.title) || (b.bye - a.bye) || ((b.projW || 0) - (a.projW || 0)));
  let html = '';
  rows.forEach((r, i) => {
    const p = pinMe(i, ODDS_TOP, r.id, meId);
    html += p.gap + oddsRow(r, i, s, meId).replace('class="row std-od', `class="row std-od${p.cls}`);
    if (i === ODDS_TOP - 1 && i < rows.length - 1) html += `<div class="std-od-line is-more" role="separator" aria-label="Playoff line"><span>Playoff line</span></div>`;
  });
  const anchors = rows.filter(r => (Number(r.last) || 0) >= .05).sort((a, b) => b.last - a.last).slice(0, 2);
  const worst = anchors.length
    ? `<p class="std-od-worst">${ui.icon('anchor', {size: 14})}<span>Worst record watch: ${anchors.map(r => `${esc(data.name(r.id))} ${pctTxt(r.last)}`).join(' · ')}</span></p>`
    : '';
  const sims = res.meta && res.meta.sims ? data.nf(res.meta.sims) : '10,000';
  return colHead()
    + ui.group(html, {cls: 'std-od-g', attrs: {id: 'std-od-list'}})
    + (rows.length > ODDS_TOP ? moreBtn('odds', st.oddsAll, rows.length, ODDS_TOP, 'std-od-list') : '')
    + worst
    + `<p class="group-f std-foot">${sims} simulations of the ${O.weeksLeft} week${O.weeksLeft === 1 ? '' : 's'} left. Top six make it, top two get byes.</p>`;
}
function oddsSkeleton() {
  const w = [44, 58, 38, 52, 47, 40];
  const rows = w.map(x => `<div class="row std-od std-od-skr"><span class="row-lead"><span class="sk std-sk-av"></span></span><span class="row-main"><span class="sk sk-line" style="width:${x}%"></span><span class="sk sk-line std-sk-sub"></span></span><span class="std-od-c"><span class="sk std-sk-c"></span></span><span class="std-od-c"><span class="sk std-sk-c"></span></span><span class="std-od-c"><span class="sk std-sk-c"></span></span></div>`).join('');
  return colHead() + `<div class="group std-od-sk" aria-hidden="true">${rows}</div><span class="sr-only">Simulating the rest of the season.</span>`;
}
function oddsHtml(st) {
  const O = oddsSeason();
  if (!O) return '';
  const res = oddsMemo.get(O.s);
  return `<section class="std-odds${st.oddsAll ? ' is-all' : ''}" data-enter aria-labelledby="std-od-h">`
    + `<div class="sh std-xh"><h2 id="std-od-h">Playoff odds</h2><span class="ovl std-xh-o">${O.weeksLeft} week${O.weeksLeft === 1 ? '' : 's'} left</span></div>`
    + `<div class="std-od-body"${res ? '' : ' aria-busy="true"'}>${res ? oddsBody(res, O, st) : oddsSkeleton()}</div>`
    + `</section>`;
}

// Fill the odds once they are simulated (after the screen settles, so a push or tab switch never stutters).
// A hidden page (app in the background) has nothing to protect, and its animations never finish, so it skips
// the wait.
const afterIdle = (st, fn) => {
  if (st.cancelOdds) st.cancelOdds();
  if (document.hidden) { st.cancelOdds = null; fn(); return; }
  st.cancelOdds = ui.whenIdle(() => { st.cancelOdds = null; fn(); });
};
function kickOdds(ctx, st) {
  const O = oddsSeason();
  if (!O || oddsMemo.has(O.s)) return;
  const live = () => S.get(ctx) === st && st.el.isConnected;
  afterIdle(st, () => runOdds(O.s).then(res => {
    if (!live()) return;
    afterIdle(st, () => {
      const body = st.el.querySelector('.std-od-body');
      const cur = oddsSeason();
      if (!live() || !body || !cur || cur.s !== O.s || !body.hasAttribute('aria-busy')) return;
      const put = () => { body.innerHTML = oddsBody(res, O, st); body.removeAttribute('aria-busy'); };
      if (ctx.visible && !ui.RM && !document.hidden) ui.crossfade(body, put, {duration: 160}); else put();
      ui.hydrate(body);
    });
  }).catch(e => {
    console.error(e);
    if (!live()) return;
    const sec = st.el.querySelector('.std-odds');
    if (sec) sec.remove();
  }));
}

// "Show all" / "Show top n" for either list. Collapsing keeps the button where it was on screen.
function toggleMore(ctx, st, which) {
  const sec = st.el.querySelector(which === 'pr' ? '.std-power' : '.std-odds');
  const b = sec && sec.querySelector(`[data-more="${which}"]`);
  if (!b) return;
  const on = !sec.classList.contains('is-all');
  const y0 = b.getBoundingClientRect().top;
  if (which === 'pr') st.prAll = on; else st.oddsAll = on;
  sec.classList.toggle('is-all', on);
  const n = sec.querySelectorAll('.row').length;
  b.setAttribute('aria-expanded', String(on));
  const lab = b.querySelector('.btn-label');
  if (lab) lab.textContent = on ? 'Show fewer' : `Show all ${n}`;
  ui.haptic('selection');
  if (on) {
    if (!ui.RM) sec.querySelectorAll('.is-more').forEach(x => ui.animate(x, [{opacity: 0, transform: 'translateY(-6px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: 'ease-out'}));
  } else if (ctx.screen) {
    const dy = b.getBoundingClientRect().top - y0;
    if (dy) ctx.screen.scrollTop += dy;
  }
}

function bodyHtml(st) {
  return ui.largeTitle({title: 'Standings', subtitle: subtitle()})
    + powerHtml(st)
    + oddsHtml(st)
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

// The bar's Sort and table/list buttons act on the All-time list, which sits below power rankings, playoff
// odds and the seasons rail: bring its header up under the nav bar (unless it is already in the top half of
// the view), so the change happens where it can be seen.
function revealAll(ctx) {
  const st = S.get(ctx);
  const scr = ctx.screen;
  const head = st && st.el.querySelector('.std-ah');
  if (!head || !scr) return;
  const nav = scr.querySelector(':scope > .nav');
  const sr = scr.getBoundingClientRect();
  const navB = nav ? nav.getBoundingClientRect().bottom : sr.top + 44;
  const top = head.getBoundingClientRect().top;
  if (top >= navB && top < sr.top + sr.height / 2) return;
  const target = Math.min(top - navB + scr.scrollTop - 4, scr.scrollHeight - scr.clientHeight);
  scr.scrollTo({top: Math.max(0, target), behavior: ui.RM ? 'auto' : 'smooth'});
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
    const st = {el, sort: prev ? prev.sort : {...lastSort}, view: prev ? prev.view : readView(),
      prAll: prev ? prev.prAll : false, oddsAll: prev ? prev.oddsAll : false, cancelOdds: null};
    if (prev && prev.cancelOdds) prev.cancelOdds();
    S.set(ctx, st);
    el.addEventListener('click', e => {
      const t = e.target;
      if (!t || !t.closest) return;
      const more = t.closest('[data-more]');
      if (more) { toggleMore(ctx, st, more.dataset.more); return; }
      if (t.closest('[data-sort-open]')) { openSort(ctx); return; }
      const th = t.closest('button[data-sort]');
      if (th) { ui.haptic('selection'); applySort(ctx, pickSort(st.sort, th.dataset.sort)); }
    });
    el.addEventListener('scroll', e => {
      if (e.target && e.target.classList && e.target.classList.contains('std-tscroll')) syncTableEdges(el);
    }, {capture: true, passive: true});
    if (ctx.first) ui.stagger(el);
    kickOdds(ctx, st);
  },
  onShow(ctx) {
    const st = S.get(ctx);
    if (st) syncTableEdges(st.el);
  },
  update(ctx) {
    const st = S.get(ctx);
    if (!st) return;
    // 'data' (a reload found changes) or 'me' (your highlight): rebuild, keeping sort, view, expanded lists
    // and rail scroll. A new week re-derives the live season, so the odds are simulated again.
    const rail = st.el.querySelector('.std-rail');
    const rl = rail ? rail.scrollLeft : 0;
    st.el.innerHTML = bodyHtml(st);
    const nr = st.el.querySelector('.std-rail');
    if (nr) nr.scrollLeft = rl;
    syncTableEdges(st.el);
    kickOdds(ctx, st);
  },
  unmount(el, ctx) {
    const st = S.get(ctx);
    if (st && st.cancelOdds) { st.cancelOdds(); st.cancelOdds = null; }
  },
  onAction(id, ctx) {
    if (id === 'sort') { revealAll(ctx); return openSort(ctx); }
    // app.js re-renders the trail after this and keeps keyboard focus on the swapped button.
    if (id === 'table' || id === 'list') { setView(ctx, id); revealAll(ctx); }
  }
};
