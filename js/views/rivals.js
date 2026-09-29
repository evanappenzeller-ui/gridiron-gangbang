// Rivals: head to head for any two managers (spec 7.12, delight 8.12). Owner: rivals package.
// Mounts once, then patches: series numbers roll (odometer), the split bar re-splits, the tape and the
// meeting log cross-fade, and "{A} against everyone" reorders with FLIP.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = s => data.esc(s);
const nm = id => data.name(id);
const SHARE = [{id: 'share', icon: 'share', label: 'Share this rivalry'}];
const FOOTNOTE = 'Includes playoff and consolation games. Tap a name to see that matchup.';

// One Rivals screen exists at a time (it is the Rivals tab root); its live state lives here and is reset
// in mount/unmount. Nothing derived from data.* outlives a reload: the model is rebuilt on every update.
let st = null;

// ============================================================================ Pair resolution
function lookup(id) {
  if (id == null || id === '') return null;
  const s = String(id);
  if (data.M[s]) return s;
  const l = s.toLowerCase();
  return data.M[l] ? l : null;
}
function reigning() {
  const s = data.DONE[0];
  return s && s.champion && data.M[s.champion] ? s.champion : null;
}
function defaultA() {
  return data.me() || reigning() || data.ids[0] || null;
}
function opponentFor(a) {
  if (!a) return null;
  let b = data.defaultOpponent(a);
  if (!b || b === a || !data.M[b]) b = data.ids.find(x => x !== a) || null;
  return b;
}
// Valid params win; a missing or unknown side falls back to the defaults (spec 7.12): A = gg-me, else the
// reigning champion, else the first id; B = defaultOpponent(A), recomputed when it would equal A.
function resolvePair(params = {}) {
  const pa = lookup(params.a), pb = lookup(params.b);
  const a = pa || defaultA();
  if (!a) return {a: null, b: null, isDefault: true};
  const b = (pb && pb !== a) ? pb : opponentFor(a);
  return {a, b, isDefault: !pa && !pb};
}
const canon = (a, b) => '/rivals/' + encodeURIComponent(a + '-vs-' + b);

// ============================================================================ Model
function streakSentence(h) {
  return h.streak.n ? `${nm(h.streak.who)} has won the last ${h.streak.n === 1 ? 'meeting' : h.streak.n + ' meetings'}` : 'Last meeting ended in a tie';
}
function model(a, b) {
  const h = data.h2hC(a, b);
  const n = h.games.length;
  return {
    a, b, h, n,
    pct: n ? Math.round(100 * (h.aw + h.t / 2) / n) : 50,
    lead: h.aw > h.bw ? 'a' : h.bw > h.aw ? 'b' : null,
    close: data.hueClose(a, b)
  };
}
const clsA = m => data.color(m.a).cls;
const clsB = m => m.close ? 'mc-ink' : data.color(m.b).cls;
function footText(m) {
  return `${m.n} ${m.n === 1 ? 'game' : 'games'}${m.h.t ? `, ${m.h.t} tied` : ''}. ${streakSentence(m.h)}.`;
}
function srSummary(m) {
  const {h} = m;
  return `Series: ${nm(m.a)} ${h.aw} ${h.aw === 1 ? 'win' : 'wins'}, ${nm(m.b)} ${h.bw} ${h.bw === 1 ? 'win' : 'wins'}${h.t ? `, ${h.t} ${h.t === 1 ? 'tie' : 'ties'}` : ''}. ${nm(m.a)} has won ${m.pct} percent of games.`;
}
function titleOf(m) {
  if (!m || !m.b) return 'Rivals';
  return m.n ? `${nm(m.a)} ${m.h.aw}–${m.h.bw} ${nm(m.b)}` : `${nm(m.a)} vs ${nm(m.b)}`;
}
function shareText(m) {
  const link = ui.absLink(`/rivals/${m.a}-vs-${m.b}`);
  if (m.lead) {
    const L = m.lead === 'a' ? m.a : m.b, T = m.lead === 'a' ? m.b : m.a;
    const w = Math.max(m.h.aw, m.h.bw), l = Math.min(m.h.aw, m.h.bw);
    return `${nm(L)} leads ${nm(T)} ${w}–${l} all-time. ${streakSentence(m.h)}. ${link}`;
  }
  return `${nm(m.a)} and ${nm(m.b)} are even at ${m.h.aw}–${m.h.bw}. ${link}`;
}
// "{A} against everyone": same rows and order as the old screen.
function opponents(a) {
  return data.ids.filter(id => id !== a).map(id => {
    const x = data.h2hC(a, id);
    return {id, w: x.aw, l: x.bw, t: x.t, n: x.games.length};
  }).filter(x => x.n).sort((x, y) => (y.w - y.l) - (x.w - x.l) || y.n - x.n);
}
// Meetings grouped by season, newest first (games newest first inside a season).
function bySeason(h) {
  const out = [], at = new Map();
  for (let i = h.games.length - 1; i >= 0; i--) {
    const g = h.games[i];
    let s = at.get(g.year);
    if (!s) { s = {year: g.year, games: [], aw: 0, bw: 0, t: 0}; at.set(g.year, s); out.push(s); }
    s.games.push(g);
    if (g.my > g.their) s.aw++; else if (g.their > g.my) s.bw++; else s.t++;
  }
  return out;
}
function seasonLine(s, m) {
  if (s.aw > s.bw) return `${nm(m.a)} ${data.recStr(s.aw, s.bw, s.t)}`;
  if (s.bw > s.aw) return `${nm(m.b)} ${data.recStr(s.bw, s.aw, s.t)}`;
  return s.aw ? `Split ${data.recStr(s.aw, s.bw, s.t)}` : (s.t === 1 ? 'Tied' : `Tied ${s.t}`);
}

// ============================================================================ Markup
const FLAME_DEFS = `<svg class="rv-defs" aria-hidden="true" focusable="false" width="0" height="0"><defs><linearGradient id="rv-flame-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--flame-2)"/><stop offset="1" style="stop-color:var(--flame-1)"/></linearGradient></defs></svg>`;

function pickInner(id) {
  return `<span class="rv-glow" aria-hidden="true"></span>`
    + `<span class="rv-av">${ui.avatar(id, {size: 72, hero: true, you: id === data.me(), crown: id === reigning()})}</span>`
    + `<span class="rv-pname"><span class="rv-pn">${esc(nm(id))}</span>${ui.icon('chevron-down', {cls: 'rv-dd'})}</span>`
    + `<span class="rv-pteam">${esc(data.team(id)) || '&nbsp;'}</span>`;
}
const pickLabel = (id, side) => `${side === 'a' ? 'Manager' : 'Opponent'}: ${nm(id)}. Choose another`;
// The header glow is identity (the avatar's own color); the 35-degree rule applies to the data below it.
function pickBtn(m, side) {
  const id = m[side];
  const c = data.color(id).cls;
  return `<button type="button" class="rv-pick ${side} ${c}" data-pick="${side}" data-id="${esc(id)}" aria-haspopup="dialog" aria-label="${esc(pickLabel(id, side))}">${pickInner(id)}</button>`;
}
function headerHTML(m) {
  return `<div class="rv-hdr" data-enter>${pickBtn(m, 'a')}<div class="rv-mid"><button type="button" class="rv-swap" data-swap aria-label="Swap managers">${ui.icon('swap', {cls: 'rv-swap-ic'})}</button></div>${pickBtn(m, 'b')}</div>`;
}

function whoLink(id, side, size = 24) {
  return `<a class="rv-who ${side}" href="#/managers/${encodeURIComponent(id)}" aria-label="${esc(nm(id))}, profile">${ui.avatar(id, {size, you: id === data.me(), attrs: {'data-morph-from': true}})}<span class="rv-who-n">${esc(nm(id))}</span></a>`;
}

function boardHTML(m) {
  const {h} = m;
  const sideCls = s => m.lead === s ? ' is-lead' : m.lead ? ' is-trail' : '';
  const hot = h.streak.n >= 3;
  return `<div class="card card-hero rv-board" data-enter role="group" aria-label="Series record">`
    + `<i class="rv-wash a ${clsA(m)}" aria-hidden="true"></i><i class="rv-wash b ${clsB(m)}" aria-hidden="true"></i>`
    + `<p class="sr-only rv-sr">${esc(srSummary(m))}</p>`
    + `<div class="rv-score" aria-hidden="true">`
    + `<div class="rv-side a ${clsA(m)}${sideCls('a')}"><span class="n1 rv-num" data-num="a">${h.aw}</span><span class="ovl rv-wl">${h.aw === 1 ? 'Win' : 'Wins'}</span></div>`
    + `<div class="rv-dash"><span class="ovl">Series</span></div>`
    + `<div class="rv-side b ${clsB(m)}${sideCls('b')}"><span class="n1 rv-num" data-num="b">${h.bw}</span><span class="ovl rv-wl">${h.bw === 1 ? 'Win' : 'Wins'}</span></div>`
    + `</div>`
    + `<div class="rv-split">${ui.splitBar(m.a, m.b, m.pct / 100)}</div>`
    + `<p class="rv-foot"><span class="rv-flame-w"${hot ? '' : ' hidden'}>${FLAME_DEFS}${ui.icon('flame', {cls: 'rv-flame'})}</span><span class="rv-foot-t">${esc(footText(m))}</span></p>`
    + `</div>`;
}

function tapeHTML(m) {
  const {h, n, a, b} = m;
  const better = (x, y) => x > y ? 'a' : y > x ? 'b' : null;
  const S = v => ui.raw(ui.score(v));
  const big = B => B ? S(B.m) : '—';
  const bigSub = B => B ? `${B.g.year}, wk ${B.g.week}` : '';
  const rows = [
    ui.tape({label: 'Total points', a: S(h.ap), b: S(h.bp), better: better(h.ap, h.bp), aId: a, bId: b}),
    ui.tape({label: 'Average score', a: S(h.ap / n), b: S(h.bp / n), better: better(h.ap / n, h.bp / n), aId: a, bId: b}),
    ui.tape({label: 'Biggest win', a: big(h.aBig), b: big(h.bBig), aSub: bigSub(h.aBig), bSub: bigSub(h.bBig), better: better(h.aBig ? h.aBig.m : -1, h.bBig ? h.bBig.m : -1), aId: a, bId: b}),
    ui.tape({label: 'Playoff wins', a: String(h.apw), b: String(h.bpw), better: better(h.apw, h.bpw), aId: a, bId: b})
  ];
  return ui.group(`<div class="rv-thead">${whoLink(a, 'a')}${whoLink(b, 'b')}</div>` + rows.join(''), {cls: 'rv-tape'});
}

function logHTML(m) {
  const seasons = bySeason(m.h);
  const head = `<div class="rv-mhead">${whoLink(m.a, 'a')}<span class="ovl rv-mcount">${m.n} ${m.n === 1 ? 'meeting' : 'meetings'}</span>${whoLink(m.b, 'b')}</div>`;
  return head + seasons.map(s => {
    const bugs = s.games.map(g => ui.scoreBug(g, {compact: true, a: m.a, cls: g.sa === g.sb ? 'is-tie' : '', attrs: {role: 'listitem'}})).join('');
    return `<section class="rv-yr" style="contain-intrinsic-size:auto ${48 + s.games.length * 48}px">`
      + `<h3 class="rv-yh"><span class="n5 rv-yy">${esc(s.year)}</span><span class="sr-only">, </span><span class="rv-ysum">${esc(seasonLine(s, m))}</span></h3>`
      + ui.group(bugs, {attrs: {role: 'list', 'aria-label': `${s.year} meetings`}})
      + `</section>`;
  }).join('');
}

function noneHTML(m) {
  return `<div class="card card-hero rv-none" data-enter>`
    + ui.empty({icon: 'versus', body: `${nm(m.a)} and ${nm(m.b)} haven't played each other yet. Pick another opponent.`,
      action: {label: 'Pick an opponent', kind: 'secondary', attrs: {'data-pick': 'b'}}})
    + `</div>`;
}

function mainHTML(m) {
  if (!m.n) return noneHTML(m);
  return boardHTML(m)
    + `<div class="rv-sec" data-enter>${ui.sectionHeader({title: 'Tale of the tape'})}<div class="rv-tape-w">${tapeHTML(m)}</div></div>`
    + `<div class="rv-sec" data-enter>${ui.sectionHeader({title: 'Every meeting'})}<div class="rv-log">${logHTML(m)}</div></div>`;
}

function oppRow(a, x, sel) {
  const share = x.n ? (x.w + x.t / 2) / x.n : 0;
  const tone = x.w > x.l ? 'tint' : x.w < x.l ? 'wrong' : 'ink2';
  const rec = data.recStr(x.w, x.l, x.t);
  const on = x.id === sel;
  return `<li class="rv-opp${on ? ' is-selected' : ''}" data-key="${esc(x.id)}">`
    + `<button type="button" class="rv-opp-hit" data-opp="${esc(x.id)}" aria-pressed="${on}" aria-label="${esc(`${nm(x.id)}, ${rec}`)}"></button>`
    + `<a class="rv-opp-av" href="#/managers/${encodeURIComponent(x.id)}" aria-label="${esc(nm(x.id))}, profile">${ui.avatar(x.id, {size: 32, you: x.id === data.me(), attrs: {'data-morph-from': true}})}</a>`
    + `<span class="rv-opp-n" aria-hidden="true">${esc(nm(x.id))}</span>`
    + `<span class="rv-opp-rec n4 ${tone}" aria-hidden="true">${esc(rec)}</span>`
    + `<span class="rv-opp-bar ${data.color(a).cls}" aria-hidden="true"><i data-share="${share}" style="transform:scaleX(${share})"></i></span>`
    + ui.icon('chevron-right', {cls: 'chev'})
    + `</li>`;
}
function listHTML(m) {
  const rows = opponents(m.a);
  if (!rows.length) return `<p class="note rv-nobody">${esc(nm(m.a))} hasn't played anyone yet.</p>`;
  return `<ul class="group rv-opps" aria-label="${esc(`${nm(m.a)} against everyone`)}">${rows.map(x => oppRow(m.a, x, m.b)).join('')}</ul>`;
}
function listSecHTML(m) {
  return `<div class="rv-sec rv-list" data-enter>${ui.sectionHeader({title: `${nm(m.a)} against everyone`})}<div class="rv-list-w">${listHTML(m)}</div><p class="note">${FOOTNOTE}</p></div>`;
}

function pageHTML(m) {
  if (!m || !m.b) {
    return ui.largeTitle({title: 'Rivals'})
      + ui.empty({icon: 'versus', title: 'No rivals yet.', body: 'Rivals needs at least two managers in the league.'});
  }
  return ui.largeTitle({title: 'Rivals'})
    + headerHTML(m)
    + `<div class="rv-main">${mainHTML(m)}</div>`
    + listSecHTML(m);
}

// ============================================================================ Patching
function grab(el) {
  st.r = {
    hdr: el.querySelector('.rv-hdr'),
    main: el.querySelector('.rv-main'),
    listSec: el.querySelector('.rv-list'),
    listW: el.querySelector('.rv-list-w')
  };
  markRendered(el);
  st.listA = st.m ? st.m.a : null;
  st.listMe = st.meKey;
}
// Record what freshly rendered markup shows, so later patches can diff against it.
function markRendered(root) {
  root.querySelectorAll('.rv-num').forEach(n => { n._shown = +n.textContent || 0; });
  if (st.m && st.m.n) root.querySelectorAll('.rv-tape-w, .rv-log').forEach(x => { x._html = x.classList.contains('rv-log') ? logHTML(st.m) : tapeHTML(st.m); });
  st.flameKey = st.m && st.m.n ? `${st.m.h.streak.who}|${st.m.h.streak.n}` : null;
  st.secKey = st.m ? st.m.a + '|' + st.m.b : null;
}

// Odometer, serialized per element: a roll that is still running finishes, then rolls on to the latest
// target (two overlapping ui.odometer calls on one element would leave the first one's final value).
function rollTo(el, to, animate) {
  if (!el) return;
  to = Math.max(0, Math.round(Number(to) || 0));
  el._to = to;
  if (el._rolling) return;
  const from = el._shown != null ? el._shown : (+el.textContent || 0);
  if (!animate || ui.RM || from === to || !el.isConnected) {
    el.textContent = String(to);
    el._shown = to;
    return;
  }
  el._rolling = true;
  ui.odometer(el, from, to).then(() => {
    el._rolling = false;
    el._shown = to;
    if (el._to !== to) rollTo(el, el._to, true);
  });
}

// Is el's top on screen below the nav bar? (a layout read: call it before any DOM writes)
function onScreen(el) {
  const scr = st && st.ctx.screen;
  if (!el || !scr) return true;
  const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect();
  return r.top >= s.top + 20 && r.top < s.bottom - 80;
}
// Runs fn once el scrolls on screen: a list tap scrolls back to the top first, so the numbers roll where
// they can be seen. Falls back once the scroll has settled (160 ms without scroll events) or after 1.6 s.
// One pending wait at a time (a newer one replaces it; patchBoard always renders the latest pair).
function whenSeen(el, fn) {
  const scr = st && st.ctx.screen;
  if (!el || !scr) return fn();
  if (st.seen) st.seen();
  let idle = 0, max = 0;
  const stop = () => {
    scr.removeEventListener('scroll', onScroll);
    clearTimeout(idle); clearTimeout(max);
    if (st && st.seen === stop) st.seen = null;
  };
  const go = () => { stop(); if (el.isConnected) fn(); };
  const onScroll = () => {
    if (onScreen(el)) { go(); return; }
    clearTimeout(idle);
    idle = setTimeout(go, 160);
  };
  scr.addEventListener('scroll', onScroll, {passive: true});
  max = setTimeout(go, 1600);
  st.seen = stop;
}

function flicker(el) {
  if (!el || ui.RM) return;
  ui.animate(el, [
    {opacity: 1, transform: 'scale(1)'}, {opacity: .35, transform: 'scale(.84)'},
    {opacity: 1, transform: 'scale(1.14)'}, {opacity: .4, transform: 'scale(.88)'},
    {opacity: 1, transform: 'scale(1.1)'}, {opacity: .45, transform: 'scale(.9)'},
    {opacity: 1, transform: 'scale(1)'}
  ], {duration: 960, easing: 'ease-in-out'});
}

function patchHeader(m, {animate, via}) {
  const hdr = st.r.hdr;
  if (!hdr) return;
  const meChanged = `${data.me()}|${reigning()}` !== st.meKey;
  ['a', 'b'].forEach(side => {
    const btn = hdr.querySelector('.rv-pick.' + side);
    if (!btn) return;
    const id = m[side];
    btn.className = `rv-pick ${side} ${data.color(id).cls}`;
    const changed = btn.dataset.id !== id;
    if (!changed && !meChanged) return;
    btn.innerHTML = pickInner(id);
    btn.dataset.id = id;
    btn.setAttribute('aria-label', pickLabel(id, side));
    if (changed && animate && via !== 'swap') {
      ui.stamp(btn.querySelector('.rv-av'), {from: .6});
      ui.animate(btn.querySelector('.rv-glow'), [{opacity: 0}, {opacity: 1}], {duration: 420, easing: 'ease-out'});
      ui.animate(btn.querySelector('.rv-pname'), [{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: 240, easing: 'cubic-bezier(.22,1,.36,1)'});
    }
  });
  // The swap's crossing avatars land exactly where the new content sits: drop them in the same frame.
  if (st.swapAnims) { st.swapAnims.forEach(a => { try { a.cancel(); } catch (_) {} }); st.swapAnims = null; }
}

function patchBoard(animate) {
  const m = st && st.m;
  const board = m && st.r.main && st.r.main.querySelector('.rv-board');
  if (!board || !m.n) return;
  const {h} = m;
  // Split bar first: splitUpdate reads the old share from computed style, which is free before any writes.
  const split = board.querySelector('.split');
  if (split) {
    ui.splitUpdate(split, m.pct / 100, {animate});
    const segA = split.querySelector('.split-a'), segB = split.querySelector('.split-b');
    if (segA) segA.className = `split-a ${clsA(m)}`;
    if (segB) segB.className = `split-b ${clsB(m)}`;
    const bar = split.querySelector('.split-bar');
    if (bar) bar.setAttribute('aria-label', `${nm(m.a)} ${m.pct} percent, ${nm(m.b)} ${100 - m.pct} percent`);
  }
  const sideCls = s => m.lead === s ? ' is-lead' : m.lead ? ' is-trail' : '';
  const sa = board.querySelector('.rv-side.a'), sb = board.querySelector('.rv-side.b');
  sa.className = `rv-side a ${clsA(m)}${sideCls('a')}`;
  sb.className = `rv-side b ${clsB(m)}${sideCls('b')}`;
  sa.querySelector('.rv-wl').textContent = h.aw === 1 ? 'Win' : 'Wins';
  sb.querySelector('.rv-wl').textContent = h.bw === 1 ? 'Win' : 'Wins';
  board.querySelector('.rv-wash.a').className = `rv-wash a ${clsA(m)}`;
  board.querySelector('.rv-wash.b').className = `rv-wash b ${clsB(m)}`;
  board.querySelector('.rv-sr').textContent = srSummary(m);
  rollTo(sa.querySelector('.rv-num'), h.aw, animate);
  rollTo(sb.querySelector('.rv-num'), h.bw, animate);
  const t = board.querySelector('.rv-foot-t');
  const txt = footText(m);
  if (t.textContent !== txt) t.textContent = txt;
  const fw = board.querySelector('.rv-flame-w');
  const hot = h.streak.n >= 3;
  const key = `${h.streak.who}|${h.streak.n}`;
  const flare = hot && animate && (fw.hidden || st.flameKey !== key);
  fw.hidden = !hot;
  if (flare) flicker(fw.querySelector('.rv-flame'));
  st.flameKey = key;
}

function patchSections(m, {animate, pairChanged}) {
  const main = st.r.main;
  const fade = animate && pairChanged;
  [['.rv-tape-w', tapeHTML(m)], ['.rv-log', logHTML(m)]].forEach(([sel, html]) => {
    const w = main.querySelector(sel);
    if (!w || w._html === html) return;
    const put = () => { w.innerHTML = html; w._html = html; };
    if (fade) ui.crossfade(w, put); else put();
  });
}

function patchRow(li, a, x, sel, animate, meChanged) {
  const share = x.n ? (x.w + x.t / 2) / x.n : 0;
  const tone = x.w > x.l ? 'tint' : x.w < x.l ? 'wrong' : 'ink2';
  const rec = data.recStr(x.w, x.l, x.t);
  const on = x.id === sel;
  li.classList.toggle('is-selected', on);
  const hit = li.querySelector('.rv-opp-hit');
  hit.setAttribute('aria-pressed', String(on));
  hit.setAttribute('aria-label', `${nm(x.id)}, ${rec}`);
  const r = li.querySelector('.rv-opp-rec');
  if (r.textContent !== rec) r.textContent = rec;
  r.className = `rv-opp-rec n4 ${tone}`;
  const bar = li.querySelector('.rv-opp-bar');
  bar.className = `rv-opp-bar ${data.color(a).cls}`;
  const i = bar.querySelector('i');
  const old = parseFloat(i.dataset.share);
  if (!(Math.abs(old - share) < 1e-6)) {
    i.dataset.share = share;
    i.style.transform = `scaleX(${share})`;
    if (animate && isFinite(old)) ui.animate(i, [{transform: `scaleX(${old})`}, {transform: `scaleX(${share})`}], {spring: 'smooth'});
  }
  if (meChanged) li.querySelector('.rv-opp-av').innerHTML = ui.avatar(x.id, {size: 32, you: x.id === data.me(), attrs: {'data-morph-from': true}});
}

function patchList(m, {animate, meChanged}) {
  const sec = st.r.listSec;
  if (!sec) return;
  const title = `${nm(m.a)} against everyone`;
  const h2 = sec.querySelector('.sh > h2');
  if (h2 && h2.textContent !== title) {
    h2.textContent = title;
    if (animate) ui.animate(h2, [{opacity: 0}, {opacity: 1}], {duration: 160, easing: 'linear'});
  }
  const w = st.r.listW;
  const ul = w.querySelector('.rv-opps');
  const rows = opponents(m.a);
  if (!ul || !rows.length) { w.innerHTML = listHTML(m); return; }
  ul.setAttribute('aria-label', title);
  const have = new Map([...ul.children].map(li => [li.dataset.key, li]));
  const els = rows.map(x => {
    const li = have.get(x.id);
    if (li) { patchRow(li, m.a, x, m.b, animate, meChanged); return li; }
    const t = document.createElement('template');
    t.innerHTML = oppRow(m.a, x, m.b);
    return t.content.firstElementChild;
  });
  const same = els.length === ul.children.length && els.every((li, i) => ul.children[i] === li);
  if (!same) ul.replaceChildren(...els);
}

// The compact title reads "{A} {aw}–{bw} {B}" while Rivals is on screen. setTitle also labels the back
// button of screens pushed on top, so onHide restores the plain "Rivals" (a clean "‹ Rivals" back label
// instead of "‹ Ben 8–0 Say…"); onShow puts the matchup back. Both run before the push/pop's first frame.
function chrome(m) {
  st.title = titleOf(m);
  if (st.ctx.visible) st.ctx.setTitle(st.title);
  st.ctx.setActions(m && m.b && m.n ? null : []);
}

// Apply a (possibly new) pair. Phase 1 (this frame): the matchup header, the scoreboard and the title, so a
// swap or a pick lands at once. Phase 2 (next frame): the tape, the meeting log and the list, which sit
// below the fold; splitting keeps each task short on slow phones.
function apply(pair, {animate = true, via = null} = {}) {
  const prev = st.m;
  const m = model(pair.a, pair.b);
  const main = st.r.main;
  const board = main.querySelector('.rv-board');
  const both = !!(prev && prev.n && m.n);
  const deferBoard = both && animate && via === 'list' && !onScreen(board); // a layout read, before any write
  st.m = m;
  patchHeader(m, {animate, via});
  st.meKey = `${data.me()}|${reigning()}`;
  if (both) {
    if (deferBoard) whenSeen(board, () => patchBoard(true));
    else patchBoard(animate);
  } else if (!prev || prev.a !== m.a || prev.b !== m.b || !!prev.n !== !!m.n) {
    const put = () => { main.innerHTML = mainHTML(m); markRendered(main); };
    if (animate) {
      ui.crossfade(main, put, {duration: 160});
      const nb = main.querySelector('.rv-board');
      if (nb) ui.splitIn(nb);
    } else put();
  }
  chrome(m);
  schedule2(animate);
}

// Phase 2. Idempotent: always brings the lower sections up to date with st.m.
function phase2(animate) {
  if (!st || !st.m || !st.m.b) return;
  const m = st.m;
  const key = m.a + '|' + m.b;
  if (m.n) patchSections(m, {animate, pairChanged: st.secKey !== key});
  st.secKey = key;
  const meKey = st.meKey;
  const run = () => { patchList(m, {animate, meChanged: st.listMe !== meKey}); st.listA = m.a; st.listMe = meKey; };
  const ul = st.r.listW && st.r.listW.querySelector('.rv-opps');
  if (animate && ul && st.listA !== m.a) ui.flip(ul, run); else run();
}
// After the next frame paints (rAF, then a task), with a timer fallback for frameless background tabs.
function schedule2(animate) {
  if (st.p2) st.p2();
  let dead = false, raf = 0, t1 = 0, t2 = 0;
  const cancel = () => { dead = true; cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); if (st && st.p2 === cancel) st.p2 = null; };
  const go = () => { if (dead) return; cancel(); phase2(animate); };
  raf = requestAnimationFrame(() => { t1 = setTimeout(go, 0); });
  t2 = setTimeout(go, 250);
  st.p2 = cancel;
}

// ============================================================================ Interactions
function go(a, b, via) {
  const path = canon(a, b);
  st.expect = path;
  st.isDefault = false;
  st.via = via;
  return st.ctx.replace(path);
}

function scrollTop() {
  const scr = st.ctx.screen;
  if (scr.scrollTop > 0) scr.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
}

async function pick(side) {
  if (!st || st.swapping || !st.m || !st.m.b) return;
  const ctx = st.ctx;
  const cur = st.m[side], other = side === 'a' ? st.m.b : st.m.a;
  const id = await ui.pickManager({title: 'Pick a manager', selected: cur, disabled: [other]});
  if (!st || st.ctx !== ctx || !st.m || !id || id === 'none' || !data.M[id]) return;
  const a = side === 'a' ? id : st.m.a, b = side === 'b' ? id : st.m.b;
  if (a === b || (a === st.m.a && b === st.m.b)) return;
  go(a, b, 'pick');
}

function swap() {
  if (!st || st.swapping || !st.m || !st.m.b) return;
  const ctx = st.ctx;
  const {a, b} = st.m;
  const hdr = st.r.hdr;
  const pa = hdr.querySelector('.rv-pick.a'), pb = hdr.querySelector('.rv-pick.b');
  ui.haptic('light');
  st.swapping = true;
  const release = ctx.busy();
  const dx = pb.getBoundingClientRect().left - pa.getBoundingClientRect().left;
  const cross = (el, d, s) => ui.animate(el, [
    {transform: 'translateX(0) scale(1)'},
    {transform: `translateX(${d / 2}px) scale(${s})`, offset: .5},
    {transform: `translateX(${d}px) scale(1)`}
  ], {spring: 'snappy', fill: 'forwards'});
  const anims = [cross(pa, dx, .88), cross(pb, -dx, 1.08)];
  ui.animate(hdr.querySelector('.rv-swap-ic'), [{transform: 'rotate(0deg)'}, {transform: 'rotate(180deg)'}], {spring: 'snappy'});
  // The captions dip while the avatars pass each other, so the two names never smear across one another.
  hdr.querySelectorAll('.rv-pname, .rv-pteam').forEach(t => ui.animate(t, [{opacity: 1}, {opacity: .15, offset: .35}, {opacity: .15, offset: .6}, {opacity: 1}], {duration: 300, easing: 'linear'}));
  st.swapAnims = anims;
  Promise.all(anims.map(x => x.finished.catch(() => {})))
    .then(() => (st && st.ctx === ctx) ? go(b, a, 'swap') : null)
    .finally(() => {
      if (st && st.ctx === ctx) {
        if (st.swapAnims) { st.swapAnims.forEach(x => { try { x.cancel(); } catch (_) {} }); st.swapAnims = null; }
        st.swapping = false;
      }
      release();
    });
}

function chooseOpp(id) {
  if (!st || st.swapping || !st.m) return;
  if (!data.M[id] || id === st.m.a) return;
  if (id === st.m.b) { scrollTop(); return; }
  ui.haptic('selection');
  // Instant feedback: the tint bar moves before the route update lands.
  const ul = st.r.listW.querySelector('.rv-opps');
  if (ul) [...ul.children].forEach(li => {
    const on = li.dataset.key === id;
    li.classList.toggle('is-selected', on);
    li.querySelector('.rv-opp-hit').setAttribute('aria-pressed', String(on));
  });
  go(st.m.a, id, 'list');
  scrollTop();
}

function onClick(e) {
  const t = e.target.closest && e.target.closest('[data-swap], [data-pick], [data-opp]');
  if (!t || !st) return;
  if (t.hasAttribute('data-swap')) swap();
  else if (t.hasAttribute('data-pick')) pick(t.dataset.pick === 'a' ? 'a' : 'b');
  else if (t.hasAttribute('data-opp')) chooseOpp(t.dataset.opp);
}

// ============================================================================ View
export default {
  id: 'rivals',
  title: 'Rivals',
  actions: () => SHARE,

  render(ctx) {
    const p = resolvePair(ctx.params);
    return pageHTML(p.a && p.b ? model(p.a, p.b) : null);
  },

  mount(el, ctx) {
    const p = resolvePair(ctx.params);
    st = {ctx, el, m: null, r: {}, isDefault: p.isDefault, expect: null, via: null, swapping: false, swapAnims: null,
      meKey: `${data.me()}|${reigning()}`, flameKey: null, secKey: null, listA: null, listMe: null, p2: null, seen: null, title: null,
      cleanups: [], entrance: false, shown: false};
    el.addEventListener('click', onClick);
    if (!p.a || !p.b) { chrome(null); return; }
    st.m = model(p.a, p.b);
    grab(el);
    chrome(st.m);
    // Entrance (first mount this session): the stagger starts now; the numbers roll up from 0, the bar grows
    // from the center and a hot streak's flame flickers once the screen is visible (onShow).
    if (ctx.first) {
      st.entrance = true;
      ui.stagger(el);
      if (!ui.RM) el.querySelectorAll('.rv-board .rv-num').forEach(n => { n.textContent = '0'; n._shown = 0; });
    }
    const path = canon(p.a, p.b);
    if (ctx.path !== path) { st.expect = path; ctx.replace(path); }
  },

  onShow(ctx) {
    if (!st || st.ctx !== ctx) return;
    ctx.setTitle(st.title || 'Rivals');
    if (st.shown) return;
    st.shown = true;
    if (!st.entrance || !st.m || !st.m.n) return;
    const board = st.r.main && st.r.main.querySelector('.rv-board');
    if (!board) return;
    const t = setTimeout(() => {
      if (!st || st.ctx !== ctx || !board.isConnected) return;
      board.querySelectorAll('.rv-num').forEach(n => rollTo(n, n.dataset.num === 'a' ? st.m.h.aw : st.m.h.bw, true));
      ui.splitIn(board);
      if (st.m.h.streak.n >= 3) flicker(board.querySelector('.rv-flame'));
    }, 140);
    st.cleanups.push(() => clearTimeout(t));
  },

  onHide(ctx) {
    if (st && st.ctx === ctx) ctx.setTitle(null);
  },

  update(ctx) {
    if (!st || st.ctx !== ctx) return;
    const el = st.el;
    let p;
    if (ctx.reason === 'params') {
      p = resolvePair(ctx.params);
      if (ctx.path !== st.expect) { st.isDefault = p.isDefault; st.via = null; }
    } else if (ctx.reason === 'me' && st.isDefault) {
      p = resolvePair({});
    } else {
      p = st.m && data.M[st.m.a] && data.M[st.m.b] ? {a: st.m.a, b: st.m.b} : resolvePair(ctx.params);
    }
    const via = st.via;
    st.via = null;
    const ok = !!(p.a && p.b);
    if (ok !== !!(st.m && st.m.b)) {
      // The league gained or lost its second manager: render afresh.
      if (st.p2) st.p2();
      el.innerHTML = pageHTML(ok ? model(p.a, p.b) : null);
      st.m = ok ? model(p.a, p.b) : null;
      st.meKey = `${data.me()}|${reigning()}`;
      if (ok) grab(el); else st.r = {};
      chrome(st.m);
    } else if (ok) {
      apply(p, {animate: true, via});
    } else {
      chrome(null);
    }
    if (ok) {
      const path = canon(p.a, p.b);
      if (ctx.path !== path) { st.expect = path; ctx.replace(path); }
    }
  },

  onAction(id, ctx) {
    if (id !== 'share' || !st || st.ctx !== ctx || !st.m || !st.m.n) return;
    const text = shareText(st.m); // ui.share runs synchronously inside the tap (iOS user activation)
    return ui.share({text}).then(r => {
      if (r === 'copied') ui.toast('Rivalry copied. Paste it in the league chat.', {icon: 'check-circle'});
      else if (r === 'unavailable') ui.toast("Couldn't copy the rivalry.");
    });
  },

  unmount(el, ctx) {
    if (!st || st.ctx !== ctx) return;
    el.removeEventListener('click', onClick);
    st.cleanups.splice(0).forEach(f => { try { f(); } catch (_) {} });
    if (st.p2) st.p2();
    if (st.seen) st.seen();
    if (st.swapAnims) st.swapAnims.forEach(a => { try { a.cancel(); } catch (_) {} });
    st = null;
  }
};
