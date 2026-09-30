// League › Shame (#/league/shame, #/league/shame?y=2026): the league's worst moments, all-time and this season
// (week-features contract, Hall of Shame). A segment of league.js: {render, mount, unmount, show, params, me, prefetch}.
// The numbers come from stats.shame() / stats.shame({year}) (js/core/stats.js, owned by the STATS builder). stats.js is
// imported on demand, so the Hall segments never wait for it or break with it; league.js warms it at idle.
//
// Layout: scope control (All-time | This season) · "Rock bottom" hero (the lowest score in scope) · "Frequent
// offenders" rail (who shows up most) · "Podium regulars" (most Matchup of the Week press conferences, from
// core/press.js at idle; only once there is one) · sticky section chips with scroll-spy · one inset group per section.
// A row names one manager (avatar, name, that season's team, when, what happened, value tile) and opens that game's
// matchup sheet (single-game lists), the season page (season lists) or the profile (losing streaks). The
// last-place list names each season on its own line instead.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import {openMatchup} from './matchup.js';

const esc = data.esc;
let statsMod = null, statsP = null;
let S = null;          // mounted state
const cache = new Map(); // scope key -> model, dropped when data.reload() swaps GAMES
let cacheGames = null;

/** Start loading stats.js (idempotent). Resolves to the module; a failure can be retried. */
export function prefetch() {
  if (statsMod) return Promise.resolve(statsMod);
  if (!statsP) statsP = import('../core/stats.js').then(m => (statsMod = m), e => { statsP = null; throw e; });
  return statsP;
}

// ------------------------------------------------------------------ Scope
// "This season": the live season, else the latest one.
function seasonScope() {
  const s = data.SEASONS.find(x => x.live) || data.SEASONS[0] || null;
  return s ? {year: s.year, live: !!s.live} : null;
}
// ?y=<year> selects that season; anything else (or an unknown year) is all-time.
function scopeOf(ctx) {
  const q = ctx && ctx.query && ctx.query.y;
  const y = q && /^\d{4}$/.test(q) ? Number(q) : null;
  return y != null && data.seasonByYear(y) ? y : null;
}
const pathOf = y => (y == null ? '/league/shame' : `/league/shame?y=${y}`);

// ------------------------------------------------------------------ Model
const GAME_LISTS = new Set(['low', 'blowout', 'unlucky', 'lucky', 'flops']);
const SEASON_LISTS = new Set(['worst', 'fewest', 'hell']);

function build(y) {
  const res = statsMod.shame(y == null ? undefined : {year: y}) || {};
  const secs = (res.sections || []).map((s, si) => ({
    key: String(s.key || si),
    title: String(s.title || ''),
    note: s.note ? String(s.note) : '',
    items: (s.items || []).map((it, ii) => ({
      key: `${si}.${ii}`,
      label: it.label == null ? '' : String(it.label),
      val: it.val,
      unit: it.unit == null ? '' : String(it.unit),
      holders: (it.holders || []).filter(h => h && h.id).map((h, hi) => ({
        key: `${si}.${ii}.${hi}`,
        id: h.id,
        year: h.year != null && isFinite(+h.year) ? +h.year : null,
        week: h.week != null && isFinite(+h.week) ? +h.week : null,
        team: h.team ? String(h.team) : '',
        detail: h.detail ? String(h.detail) : ''
      }))
    })).filter(it => it.holders.length)
  })).filter(s => s.title && s.items.length);
  return {y, secs};
}

function model(y) {
  if (cacheGames !== data.GAMES) { cache.clear(); cacheGames = data.GAMES; }
  const k = y == null ? 'all' : String(y);
  if (!cache.has(k)) cache.set(k, build(y));
  return cache.get(k);
}

function lookup(m, key) {
  const [si, ii, hi] = String(key).split('.').map(Number);
  const s = m.secs[si], it = s && s.items[ii];
  return it ? {sec: s, it, h: it.holders[hi] || null} : null;
}

// The game a holder points at: the one game that manager played that week (a playoff game over a consolation one).
function gameOf(h) {
  if (h.year == null || h.week == null) return null;
  const list = data.GAMES.filter(x => x.year === h.year && x.week === h.week && (x.a === h.id || x.b === h.id));
  return list.find(x => x.type !== 'consol') || list[0] || null;
}

// Where a row goes: {kind: 'game', g} | {kind: 'href', href, what}
function destOf(sec, h) {
  if (GAME_LISTS.has(sec.key)) { const g = gameOf(h); if (g) return {kind: 'game', g}; }
  if ((SEASON_LISTS.has(sec.key) || sec.key === 'last') && h.year != null && data.seasonByYear(h.year)) return {kind: 'href', href: `#/standings/${h.year}`, what: `the ${h.year} season`};
  return {kind: 'href', href: `#/managers/${encodeURIComponent(h.id)}`, what: 'the profile'};
}

// ------------------------------------------------------------------ Formatting
// Values as stats writes them ("0.00", "1,806.24", "2–12", "14"); decimals render small.
function valHTML(v) {
  const s = String(v == null ? '' : v).trim();
  const m = /^([−-]?[\d,]*\d)(\.\d+)$/.exec(s);
  return m ? `${esc(m[1])}<small>${esc(m[2])}</small>` : esc(s);
}
// The 76 px tile fits about 68 px of .n4; longer values step down (never wrapping mid-number).
function valSize(v) {
  const t = String(v == null ? '' : v), m = /^(.*?)(\.\d+)?$/.exec(t);
  let w = 0;
  for (const ch of m[1]) w += /\d/.test(ch) ? 11.44 : ch === ',' ? 4.9 : /[−–\-]/.test(ch) ? 9.6 : ch === ' ' ? 5 : 10.5;
  for (const ch of (m[2] || '')) w += ch === '.' ? 3.2 : 7.1;
  return w <= 68 ? '' : w * 17 / 22 <= 68 ? ' is-long' : ' is-xlong';
}
const teamOf = h => h.team || (h.year != null ? data.teamIn(data.seasonByYear(h.year), h.id) : data.team(h.id));
const valTile = it => `<span class="rc-v"><span class="n4${valSize(it.val)}">${valHTML(it.val)}</span>${it.unit ? `<span class="t-cap">${esc(it.unit)}</span>` : ''}</span>`;

// ------------------------------------------------------------------ Pieces
function scopeSeg(y) {
  const cur = seasonScope();
  if (!cur) return '';
  const items = [{id: 'all', label: 'All-time'}, {id: String(cur.year), label: cur.live ? 'This season' : String(cur.year)}];
  // A deep link to an older season (?y=2023) adds that year as a third option.
  if (y != null && y !== cur.year) items.push({id: String(y), label: String(y)});
  return `<div class="sm-scope">${ui.seg({name: 'shame-scope', items, value: y == null ? 'all' : String(y), small: true, label: 'Hall of Shame scope'})}</div>`;
}

function heroCard(m) {
  const s = m.secs.find(x => x.key === 'low') || m.secs[0];
  const it = s && s.items[0], h = it && it.holders[0];
  if (!h) return '';
  const nm = data.name(h.id), tm = teamOf(h);
  const d = destOf(s, h);
  const label = `Rock bottom${m.y != null ? ', ' + m.y : ''}: ${nm}, ${tm}. ${it.val} ${it.unit}. ${it.label}. ${h.detail}`;
  const open = d.kind === 'game'
    ? `<button type="button" class="card card-hero sm-hero ${data.color(h.id).cls}" data-h="${esc(h.key)}" aria-haspopup="dialog" aria-label="${esc(label)}" data-enter>`
    : `<a class="card card-hero sm-hero ${data.color(h.id).cls}" href="${d.href}" aria-label="${esc(label)}" data-enter>`;
  return open
    + `<span class="ovl sm-hero-ovl">${ui.icon('anchor', {size: 14})}Rock bottom${m.y != null ? ` · ${m.y}` : ''}</span>`
    + `<span class="sm-hero-top">${ui.avatar(h.id, {size: 56, you: h.id === data.me()})}<span class="sm-hero-who"><span class="sm-hero-name">${esc(nm)}</span><span class="sm-hero-team">${esc(tm)}</span></span></span>`
    + `<span class="sm-hero-val"><span class="n1">${valHTML(it.val)}</span>${it.unit ? `<span class="sm-hero-unit">${esc(it.unit)}</span>` : ''}</span>`
    + `<span class="sm-hero-line"><b>${esc(it.label)}.</b> ${esc(h.detail)}</span>`
    + `</${d.kind === 'game' ? 'button' : 'a'}>`;
}

// Who shows up most across every list in scope (one mention per list entry).
function offenders(m) {
  const n = new Map();
  m.secs.forEach(s => s.items.forEach(it => new Set(it.holders.map(h => h.id)).forEach(id => { if (data.M[id]) n.set(id, (n.get(id) || 0) + 1); })));
  const list = [...n.entries()].sort((a, b) => b[1] - a[1] || data.name(a[0]).localeCompare(data.name(b[0])));
  if (list.length < 2) return '';
  const me = data.me();
  const items = list.map(([id, c]) => `<li class="sm-li"><a class="sm-it" href="#/managers/${encodeURIComponent(id)}" aria-label="${esc(`${data.name(id)}: ${c} ${c === 1 ? 'mention' : 'mentions'}`)}">`
    + ui.avatar(id, {size: 40, you: id === me, attrs: {'data-morph-from': ''}})
    + `<span class="sm-it-n">${esc(data.name(id))}</span><span class="sm-it-c"><span class="n5">${c}</span></span></a></li>`).join('');
  return `<section class="sm-off" data-enter aria-labelledby="hl-sm-off">${ui.sectionHeader({title: 'Frequent offenders', id: 'hl-sm-off'})}`
    + `<ul class="sm-rail" data-hscroll>${items}</ul>`
    + `<p class="note sm-off-note">Times each manager shows up in the lists below.</p></section>`;
}

// Podium regulars: who has faced the media most (the Press Room: the Matchup of the Week loser's press conference).
// PRESS is the latest core/press.js subscribePressers payload (subscribed at idle while Shame is mounted). Scoped like
// the page (all-time, or that season); nothing while loading, with no presser in scope, or on a failure.
let pressP = null, PRESS = null, pressMod = null;
const loadPress = () => pressP || (pressP = import('../core/press.js').then(m => (pressMod = m), e => { pressP = null; throw e; }));
// [[id, n]], most first (press.stats: then the most recent presser, then the name).
function podiumRows(y) {
  const list = PRESS && Array.isArray(PRESS.list) ? PRESS.list.filter(p => p && data.M[p.who] && (y == null || +p.year === y)) : [];
  if (!list.length || !pressMod) return [];
  try { return pressMod.stats(list).top.map(t => [t.id, t.n]); } catch (e) { console.error(e); return []; }
}
const podiumSig = y => podiumRows(y).map(r => r.join(':')).join('|');
function podiumHTML(y) {
  const rows = podiumRows(y);
  if (!rows.length) return '';
  const me = data.me();
  const items = rows.map(([id, c]) => `<li class="sm-li"><a class="sm-it" href="#/managers/${encodeURIComponent(id)}" aria-label="${esc(`${data.name(id)}: ${c} ${c === 1 ? 'press conference' : 'press conferences'}`)}">`
    + ui.avatar(id, {size: 40, you: id === me, attrs: {'data-morph-from': ''}})
    + `<span class="sm-it-n">${esc(data.name(id))}</span><span class="sm-it-c sm-pod-c">${ui.icon('mic', {size: 12})}<span class="n5">${c}</span></span></a></li>`).join('');
  return `<section class="sm-pod" aria-labelledby="hl-sm-pod">${ui.sectionHeader({title: 'Podium regulars', id: 'hl-sm-pod', action: {label: 'Press Room', href: '#/press'}})}`
    + `<ul class="sm-rail" data-hscroll>${items}</ul>`
    + `<p class="note sm-off-note">Press conferences after losing the Matchup of the Week.</p></section>`;
}
const podiumHost = y => `<div class="sm-pod-host" data-sig="${esc(podiumSig(y))}">${podiumHTML(y)}</div>`;
function patchPodium() {
  const host = S && S.body ? S.body.querySelector('.sm-pod-host') : null;
  if (!host) return;
  const sig = podiumSig(S.y);
  if (host.dataset.sig === sig) return;
  const was = !!host.firstElementChild;
  host.dataset.sig = sig;
  host.innerHTML = podiumHTML(S.y);
  if (host.firstElementChild && !was && !ui.RM && S.ctx.visible) ui.animate(host, [{opacity: 0}, {opacity: 1}], {duration: 240});
}
function podiumStart() {
  const mine = S;
  if (!mine || mine.pressWant) return;
  mine.pressWant = true;
  loadPress().then(pr => {
    if (S !== mine || !mine.pressWant) return;
    try {
      mine.pressUnsub = pr.subscribePressers(u => {
        if (S !== mine || !u) return;
        PRESS = u;
        if (mine.idleP) mine.idleP();
        mine.idleP = ui.whenIdle(() => { mine.idleP = null; if (S === mine) patchPodium(); });
      });
    } catch (e) { console.error(e); }
  }, e => { console.warn('shame: Press Room unavailable', e); if (S === mine) mine.pressWant = false; });
}

// One manager, one moment: the whole row is the target.
function oneRow(sec, it) {
  const h = it.holders[0];
  const d = destOf(sec, h);
  const nm = data.name(h.id), tm = teamOf(h), mine = h.id === data.me();
  const label = `${nm}, ${tm}. ${it.val} ${it.unit}. ${it.label}. ${h.detail} Opens ${d.kind === 'game' ? 'the game' : d.what}.`;
  const inner = `<span class="sm-av">${ui.avatar(h.id, {size: 32, you: mine})}</span>`
    + `<span class="sm-main"><span class="sm-name"><b>${esc(nm)}</b><span class="sm-team">${esc(tm)}</span></span>`
    + `<span class="sm-when">${esc(it.label)}</span>`
    + (h.detail ? `<span class="sm-detail">${esc(h.detail)}</span>` : '')
    + `</span>${valTile(it)}`;
  const cls = `sm-row${mine ? ' is-me' : ''}`;
  return d.kind === 'game'
    ? `<button type="button" class="${cls}" data-h="${esc(h.key)}" data-key="${esc(it.key)}" aria-haspopup="dialog" aria-label="${esc(label)}">${inner}</button>`
    : `<a class="${cls}" href="${d.href}" data-key="${esc(it.key)}" aria-label="${esc(label)}">${inner}</a>`;
}

// One manager, several seasons (last-place finishes): the name opens the profile, each season its page. Only
// each season's own team name is shown (the page footer promises names as they were that year).
function multiRow(sec, it) {
  const id = it.holders[0].id, mine = id === data.me();
  const lines = it.holders.map(h => {
    const d = destOf(sec, h);
    return `<a class="sm-line" href="${d.href}" aria-label="${esc(`${h.year != null ? h.year + ': ' : ''}${teamOf(h)}. ${h.detail} Opens ${d.what}.`)}">`
      + `<span class="n5 sm-line-y">${esc(h.year != null ? h.year : '')}</span><span class="sm-line-t"><span class="sm-line-team">${esc(teamOf(h))}</span><span class="sm-line-d">${esc(h.detail)}</span></span></a>`;
  }).join('');
  return `<div class="sm-row sm-multi${mine ? ' is-me' : ''}" data-key="${esc(it.key)}">`
    + `<span class="sm-main"><a class="sm-who" href="#/managers/${encodeURIComponent(id)}" aria-label="${esc(`${data.name(id)}: ${it.val} ${it.unit}. Opens the profile.`)}">${ui.avatar(id, {size: 32, you: mine, attrs: {'data-morph-from': ''}})}<span class="sm-name"><b>${esc(it.label || data.name(id))}</b></span></a>`
    + `<span class="sm-lines">${lines}</span></span>${valTile(it)}</div>`;
}

function sections(m) {
  return m.secs.map((s, i) => `<section class="sm-sec" data-sec="${i}" aria-labelledby="hl-sm-${i}">`
    + ui.sectionHeader({title: s.title, id: 'hl-sm-' + i})
    + ui.group(s.items.map(it => (it.holders.length > 1 || s.key === 'last') ? multiRow(s, it) : oneRow(s, it)).join(''), {cls: 'sm-g'})
    + (s.note ? `<p class="note sm-note">${esc(s.note)}</p>` : '')
    + `</section>`).join('');
}

function contentHTML(y) {
  const m = model(y);
  if (!m.secs.length) {
    return `<div class="hl-empty" data-enter>${ui.empty({icon: 'anchor', title: 'Nothing shameful yet.', body: y != null ? `${y} hasn't produced a low point. Give it a week.` : 'Give it a season.'})}</div>`;
  }
  let h = heroCard(m) + offenders(m) + podiumHost(y);
  if (m.secs.length > 1) {
    h += `<div class="accessory sm-acc">${ui.chips({name: 'hall-shame-sec', items: m.secs.map((s, i) => ({id: String(i), label: s.title})), value: '0', label: 'Shame sections'})}</div>`;
  }
  h += `<div class="sm-list">${sections(m)}</div>`;
  // Which games count differs by list (lowest scores and blowouts include the consolation bracket), so each
  // section's own note says it; this line only scopes the page.
  h += `<p class="note sm-src">${y == null ? 'Every season.' : `${y} only.`} Each list notes which games it counts. Team names as they were that year.</p>`;
  return h;
}

function loadingHTML() {
  return `<div class="sm-loading" aria-busy="true">${ui.skeleton('cards', 1, {label: 'Loading the Hall of Shame.'})}${ui.skeleton('rows', 5)}</div>`;
}
function failedHTML() {
  return `<div class="hl-empty">${ui.empty({icon: 'anchor', title: "The Hall of Shame didn't load.", body: 'Check your connection and try again.', action: {label: 'Try again', attrs: {'data-sm-retry': ''}}})}</div>`;
}
function bodyHTML(y) {
  if (!statsMod) return loadingHTML();
  try { return contentHTML(y); } catch (e) { console.error(e); return failedHTML(); }
}

// ------------------------------------------------------------------ Segment API
export function render(ctx) {
  const y = scopeOf(ctx);
  return `<div class="hl-shame">${scopeSeg(y)}<div class="sm-body">${bodyHTML(y)}</div></div>`;
}

// Geometry of the sticky chrome inside the screen.
function chrome() {
  const scr = S.ctx.screen;
  const nav = scr && scr.querySelector(':scope > .nav');
  return {scr, navH: nav ? nav.offsetHeight : 44, accH: S.acc ? (S.acc.offsetHeight || 44) : 0};
}
const topIn = (scr, node) => node.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop;

// Scroll-spy: the current chip is the last section whose header has reached the band under the chips.
function spy() {
  if (!S || !S.chips || !S.secs.length || performance.now() < S.lockUntil) return;
  const {scr, navH, accH} = chrome();
  if (!scr || !scr.clientHeight || !ui.rendered(scr)) return;
  const band = scr.getBoundingClientRect().top + navH + accH + 12;
  let i = 0;
  S.secs.forEach((s, k) => { if (s.getBoundingClientRect().top <= band) i = k; });
  if (scr.scrollTop > 0 && scr.scrollTop + scr.clientHeight >= scr.scrollHeight - 2) i = S.secs.length - 1; // the end: the last chip
  if (i !== S.active) { S.active = i; ui.setChips(S.chips, String(i), {scroll: true}); }
}

function scrollToSection(i) {
  const sec = S.secs[i];
  if (!sec) return;
  const {scr, navH, accH} = chrome();
  if (!scr) return;
  const hd = sec.querySelector('.sh') || sec;
  const target = Math.min(Math.max(0, Math.round(topIn(scr, hd) - navH - accH - 8)), scr.scrollHeight - scr.clientHeight);
  if (Math.abs(scr.scrollTop - target) < 1) return;
  // The tapped chip stays selected until the scroll ends (scrollend, a touch, or the cap).
  S.lockUntil = performance.now() + (ui.RM ? 150 : 1500);
  scr.scrollTo({top: target, behavior: ui.RM ? 'auto' : 'smooth'});
}

function wire() {
  const root = S.el.querySelector('.hl-shame');
  S.root = root;
  S.body = root && root.querySelector('.sm-body');
  S.acc = root && root.querySelector('.sm-acc');
  S.chips = S.acc && S.acc.querySelector('[data-chips]');
  S.secs = root ? [...root.querySelectorAll('.sm-sec')] : [];
  S.active = 0;
}

// Replace the scope content (a scope switch, stats.js arriving, a data reload, a "me" change).
function fill(ctx, {fade}) {
  if (!S || !S.body) return;
  const body = S.body;
  const html = bodyHTML(S.y);
  const put = () => {
    body.innerHTML = html;
    wire();
    ui.hydrate(body);
    ctx.refreshChrome();
  };
  if (fade && ctx.visible && !ui.RM) ui.crossfade(body, put, {duration: 120}); else put();
}

// Keep the scope control in view after a scope switch from far down the page.
function clampToScope(ctx) {
  const scr = ctx.screen, sc = S.root && S.root.querySelector('.sm-scope');
  if (!scr || !sc) return;
  const nav = scr.querySelector(':scope > .nav');
  const max = Math.max(0, topIn(scr, sc) - (nav ? nav.offsetHeight : 44) - 8);
  if (scr.scrollTop > max) scr.scrollTop = max;
}

function load(ctx) {
  const mine = S;
  prefetch().then(() => {
    if (!S || S !== mine) return;
    fill(ctx, {fade: true});
  }, err => {
    console.error(err);
    if (!S || S !== mine || !S.body) return;
    S.body.innerHTML = failedHTML();
  });
}

export function mount(el, ctx) {
  S = {el, ctx, y: scopeOf(ctx), root: null, body: null, acc: null, chips: null, secs: [], active: 0, lockUntil: 0, raf: 0, ac: new AbortController()};
  const sig = {signal: S.ac.signal};
  wire();

  el.addEventListener('click', e => {
    const t = e.target;
    if (!t || !t.closest || !S) return;
    const h = t.closest('[data-h]');
    if (h && el.contains(h)) {
      const hit = lookup(model(S.y), h.dataset.h);
      const d = hit && hit.h && destOf(hit.sec, hit.h);
      if (d && d.kind === 'game') { ui.haptic('light'); openMatchup(d.g, ctx); }
      return;
    }
    const c = t.closest('.sm-acc .chip');
    if (c) { S.active = +c.dataset.value; scrollToSection(+c.dataset.value); return; }
    if (t.closest('[data-sm-retry]')) {
      if (S.body) S.body.innerHTML = loadingHTML();
      load(ctx);
    }
  }, sig);

  el.addEventListener('ui:change', e => {
    if (!S || !e.detail || e.detail.name !== 'shame-scope') return;
    const v = e.detail.value;
    ctx.replace(pathOf(v === 'all' ? null : Number(v)));
  }, sig);

  const scr = ctx.screen;
  if (scr) {
    const psig = {signal: S.ac.signal, passive: true};
    scr.addEventListener('scroll', () => {
      if (!S || S.raf) return;
      S.raf = requestAnimationFrame(() => { if (!S) return; S.raf = 0; spy(); });
    }, psig);
    scr.addEventListener('scrollend', () => { if (!S) return; S.lockUntil = 0; spy(); }, psig);
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(tp => scr.addEventListener(tp, () => { if (S) S.lockUntil = 0; }, psig));
  }

  if (!statsMod) load(ctx);
  const mine = S;
  ui.onIdle(() => { if (S === mine) podiumStart(); });
}

// A route change inside Shame (the scope query), or a link to /league/shame while it is showing.
export function params(ctx) {
  if (!S) return;
  const y = scopeOf(ctx);
  if (y === S.y) return;
  S.y = y;
  const seg = S.root && S.root.querySelector('.sm-scope > .seg');
  if (seg) {
    // An older year (a deep link) has an option of its own: rebuild the control when the options change;
    // otherwise just slide the thumb.
    const want = scopeSeg(y);
    const count = (want.match(/role="tab"/g) || []).length;
    if (count !== seg.querySelectorAll('[role="tab"]').length || (y != null && !seg.querySelector(`[data-value="${y}"]`))) {
      const tmp = document.createElement('div');
      tmp.innerHTML = want;
      seg.parentNode.replaceWith(tmp.firstElementChild);
    } else ui.setSeg(seg, y == null ? 'all' : String(y), {animate: ctx.visible});
  }
  clampToScope(ctx);
  fill(ctx, {fade: true});
}

export function show() {
  if (S) spy();
}

// "me" changed: you-rings on avatars and your rows. Rebuild the content quietly, keeping the rail and the chip.
export function me(ctx) {
  if (!S || !statsMod || !S.body) return;
  const rail = S.body.querySelector('.sm-rail');
  const left = rail ? rail.scrollLeft : 0;
  const active = S.active;
  fill(ctx, {fade: false});
  const r2 = S.body.querySelector('.sm-rail');
  if (r2 && left) r2.scrollLeft = left;
  if (S.chips && active) { S.active = active; ui.setChips(S.chips, String(active), {scroll: false}); }
}

export function unmount() {
  if (!S) return;
  S.ac.abort();
  if (S.raf) cancelAnimationFrame(S.raf);
  if (S.idleP) S.idleP();
  if (typeof S.pressUnsub === 'function') { try { S.pressUnsub(); } catch (_) {} }
  S = null;
}
