// Rivals: head to head for any two managers (spec 7.12, delight 8.12). Owner: rivals package.
// Mounts once, then patches: series numbers roll (odometer), the split bar re-splits, the tape and the
// meeting log cross-fade, and "{A} against everyone" reorders with FLIP.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as motw from '../core/motw.js';

const esc = s => data.esc(s);
const nm = id => data.name(id);
const SHARE = [{id: 'share', icon: 'share', label: 'Share this rivalry'}];
const FOOTNOTE = 'Includes playoff and consolation games. Tap a name to see that matchup.';
const USER_VIA = ['swap', 'pick', 'list', 'ext']; // pair changes the person asked for (announced)

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
// What a screen reader hears when the pair changes (swap, pick, list row, outside link).
function spoken(m) {
  if (!m.n) return `${nm(m.a)} and ${nm(m.b)} haven't played each other yet.`;
  const {h} = m;
  const w = n => `${n} ${n === 1 ? 'win' : 'wins'}`;
  return `${nm(m.a)} against ${nm(m.b)}. ${nm(m.a)} ${w(h.aw)}, ${nm(m.b)} ${w(h.bw)}. ${footText(m)}`;
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
    const bugs = s.games.map(g => ui.scoreBug(g, {compact: true, a: m.a, attrs: {role: 'listitem'}})).join('');
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
  return `<div class="rv-sec rv-list" data-enter>${ui.sectionHeader({title: `${nm(m.a)} against everyone`})}<div class="rv-list-w">${listHTML(m)}</div><p class="group-f">${FOOTNOTE}</p></div>`;
}

// ============================================================================ Matchup of the Week
// The next scheduled week's games, ranked (core/motw.js), so the league has a shortlist to vote on. Tapping a
// game loads it into the head to head below. Shows the top 3 until "Show all".
const LENS_KEY = 'gg-motw-lens';
function readLens() {
  try { const v = localStorage.getItem(LENS_KEY); return motw.LENSES.some(l => l.id === v) ? v : 'overall'; } catch (_) { return 'overall'; }
}
function saveLens(v) { try { localStorage.setItem(LENS_KEY, v); } catch (_) {} }
const SHOWN = 3;
const LENS_SUB = {overall: 'Standings and history, blended.', standings: 'Where both teams sit right now.', history: 'How close and storied each series is.'};
const lensSub = lens => `${LENS_SUB[lens] || LENS_SUB.overall} Tap a game for the full history.`;
const recOf = x => x.rank ? `#${x.rank} · ${data.recStr(x.w, x.l, x.t)}` : 'No games yet';

function mcSide(id, x, side, size) {
  return `<span class="rv-mc-side ${side}">${ui.avatar(id, {size, you: id === data.me()})}`
    + `<span class="rv-mc-txt"><span class="rv-mc-n">${esc(nm(id))}</span><span class="rv-mc-r">${esc(recOf(x))}</span></span></span>`;
}
function mcRow(c) {
  const top = c.place === 1;
  const label = `${c.place}. ${nm(c.a)} versus ${nm(c.b)}. Hype ${c.hype}.${c.tags.length ? ' ' + c.tags.join('. ') + '.' : ''} Show this rivalry`;
  return `<li class="rv-mc${top ? ' is-top' : ''}${c.place > SHOWN ? ' is-more' : ''}" data-key="${esc(c.a + '|' + c.b)}">`
    + `<button type="button" class="rv-mc-hit" data-motw="${esc(c.a + '|' + c.b)}" aria-label="${esc(label)}"></button>`
    + `<span class="rv-mc-place n5" aria-hidden="true">${c.place}</span>`
    + `<span class="rv-mc-pair" aria-hidden="true">${mcSide(c.a, c.A, 'a', top ? 44 : 28)}<span class="rv-mc-vs ovl">vs</span>${mcSide(c.b, c.B, 'b', top ? 44 : 28)}</span>`
    + `<span class="rv-mc-hype" aria-hidden="true"><span class="${top ? 'n3' : 'n4'}">${c.hype}</span><span class="ovl">Hype</span><i style="transform:scaleX(${c.hype / 100})"></i></span>`
    + (c.tags.length ? `<span class="rv-mc-tags" aria-hidden="true">${c.tags.map(t => `<span class="rv-mc-tag">${esc(t)}</span>`).join('')}</span>` : '')
    + `</li>`;
}
function motwRows(res) { return res.list.map(mcRow).join(''); }
function motwHTML(lens) {
  const res = motw.candidates(lens);
  if (!res || !res.list.length) return '';
  const more = res.list.length > SHOWN;
  return `<section class="rv-motw" data-enter aria-labelledby="rv-motw-h">`
    + `<div class="rv-motw-head"><h2 class="t-2" id="rv-motw-h">Matchup of the Week</h2><span class="ovl rv-motw-wk">Week ${res.week}</span></div>`
    + `<p class="rv-motw-sub">${esc(lensSub(res.lens))}</p>`
    + ui.seg({name: 'motw-lens', items: motw.LENSES, value: res.lens, small: true, label: 'Rank by', cls: 'rv-motw-seg'})
    + `<div class="card rv-motw-card"><ol class="rv-motw-list" aria-label="${esc(`Week ${res.week} games, best first`)}">${motwRows(res)}</ol>`
    + `<div class="rv-motw-foot">`
    + (more ? ui.button({label: `Show all ${res.list.length}`, kind: 'plain', size: 's', attrs: {'data-motw-more': '', 'aria-expanded': 'false'}}) : '<span></span>')
    + ui.button({label: 'Share for the vote', kind: 'secondary', size: 's', icon: 'share', attrs: {'data-motw-share': ''}})
    + `</div></div></section>`;
}
// Re-rank in place (lens change, new data, new "me"). FLIP moves rows that change places.
function patchMotw(animate) {
  const sec = st && st.el.querySelector('.rv-motw');
  const res = motw.candidates(st ? st.lens : readLens());
  if (!sec) {
    // A reload brought a schedule where there was none: add the section above the head to head.
    if (res && res.list.length && st && st.r.hdr) {
      st.r.hdr.insertAdjacentHTML('beforebegin', motwHTML(st.lens));
      if (st.all) toggleMore(true);
    }
    return;
  }
  if (!res || !res.list.length) { sec.remove(); return; }
  const list = sec.querySelector('.rv-motw-list');
  const wk = sec.querySelector('.rv-motw-wk');
  if (wk) wk.textContent = `Week ${res.week}`;
  const put = () => { list.innerHTML = motwRows(res); };
  if (animate) ui.flip(list, put); else put();
}
function toggleMore(on) {
  const sec = st && st.el.querySelector('.rv-motw');
  if (!sec) return;
  st.all = on;
  sec.classList.toggle('is-all', on);
  const b = sec.querySelector('[data-motw-more]');
  if (b) {
    const n = sec.querySelectorAll('.rv-mc').length;
    b.setAttribute('aria-expanded', String(on));
    const lab = b.querySelector('.btn-label');
    if (lab) lab.textContent = on ? 'Show top 3' : `Show all ${n}`;
  }
  if (on) sec.querySelectorAll('.rv-mc.is-more').forEach(li => ui.animate(li, [{opacity: 0, transform: 'translateY(-6px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: 'ease-out'}));
}
function chooseMotw(key) {
  if (!st || st.swapping || !st.m) return;
  let [a, b] = key.split('|');
  if (!data.M[a] || !data.M[b]) return;
  if (b === data.me()) [a, b] = [b, a]; // your side on the left
  ui.haptic('selection');
  const same = (st.m.a === a && st.m.b === b) || (st.m.a === b && st.m.b === a);
  if (!same) go(a, b, 'list');
  // Bring the head to head into view, just under the bar.
  const scr = st.ctx.screen, hdr = st.r.hdr;
  if (hdr) {
    const nav = scr.querySelector(':scope > .nav');
    const top = hdr.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - (nav ? nav.offsetHeight : 44) - 8;
    scr.scrollTo({top: Math.max(0, top), behavior: ui.RM ? 'auto' : 'smooth'});
  }
  focusPicker('b');
}
function shareMotw() {
  const res = motw.candidates(st ? st.lens : readLens());
  if (!res) return;
  const text = motw.shareText(res, ui.absLink('/rivals')); // ui.share runs inside the tap (iOS user activation)
  return ui.share({text}).then(r => {
    if (r === 'copied') ui.toast('Shortlist copied. Paste it in the league chat.', {icon: 'check-circle'});
    else if (r === 'unavailable') ui.toast("Couldn't copy the shortlist.");
  });
}

function pageHTML(m) {
  if (!m || !m.b) {
    return ui.largeTitle({title: 'Rivals'})
      + ui.empty({icon: 'versus', title: 'No rivals yet.', body: 'Rivals needs at least two managers in the league.'});
  }
  return ui.largeTitle({title: 'Rivals'})
    + motwHTML(st ? st.lens : readLens())
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
// target (a second ui.odometer call mid-roll would restart the columns from its own start value).
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
  const nav = scr.querySelector(':scope > .nav');
  const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect();
  const top = nav ? nav.getBoundingClientRect().bottom : s.top + 20;
  return r.top >= top - 4 && r.top < s.bottom - 80;
}
// Runs fn once el scrolls on screen: a list tap (or a pair arriving from another screen) scrolls back to
// the top first, so the header pops and the numbers roll where they can be seen. Falls back once the
// scroll has stopped (no scroll event for 160 ms, 250 ms when none came yet, AND no movement across the
// next frame: on a slow phone a long task can starve scroll events mid-scroll) or after 1.6 s.
// One pending wait at a time: a newer one flushes the older (its patch lands at once, never lost);
// unmount drops it (stop() without flush).
function whenSeen(el, fn) {
  const scr = st && st.ctx.screen;
  if (!el || !scr) return fn();
  if (st.seen) st.seen(true);
  let idle = 0, max = 0, raf = 0;
  const stop = flush => {
    scr.removeEventListener('scroll', onScroll);
    clearTimeout(idle); clearTimeout(max); cancelAnimationFrame(raf);
    if (st && st.seen === stop) st.seen = null;
    if (flush === true && el.isConnected) fn();
  };
  const go = () => { stop(); if (el.isConnected) fn(); };
  const settle = () => {
    const y = scr.scrollTop;
    raf = requestAnimationFrame(() => { raf = 0; if (scr.scrollTop === y) go(); else arm(160); });
  };
  const arm = ms => { clearTimeout(idle); cancelAnimationFrame(raf); idle = setTimeout(settle, ms); };
  const onScroll = () => { if (onScreen(el)) go(); else arm(160); };
  scr.addEventListener('scroll', onScroll, {passive: true});
  arm(250);
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

// A new manager lands in a header slot: the avatar pops (stamp), its glow fades up and the name rises.
function arrive(btn) {
  if (!btn || !btn.isConnected) return;
  btn.classList.remove('is-arriving');
  ui.stamp(btn.querySelector('.rv-av'), {from: .6});
  ui.animate(btn.querySelector('.rv-glow'), [{opacity: 0}, {opacity: 1}], {duration: 420, easing: 'ease-out'});
  ui.animate(btn.querySelector('.rv-pname'), [{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: 240, easing: 'cubic-bezier(.22,1,.36,1)'});
}

// Returns the header buttons whose arrival is held back (defer: the header is off screen; the caller plays
// arrive() once it scrolls into view). Until then .is-arriving keeps the new avatar hidden, so it never shows
// up still and then blinks into the pop. Every patch rewrites className, so the class can never stick.
function patchHeader(m, {animate, via, defer}) {
  const hdr = st.r.hdr;
  const held = [];
  if (!hdr) return held;
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
      if (defer) { btn.classList.add('is-arriving'); held.push(btn); } else arrive(btn);
    }
  });
  // The swap's crossing avatars land exactly where the new content sits: drop them in the same frame.
  if (st.swapAnims) { st.swapAnims.forEach(a => { try { a.cancel(); } catch (_) {} }); st.swapAnims = null; }
  return held;
}

function patchBoard(animate, via) {
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
  // Delight 8.12: a hot streak's flame flickers when it first shows, when the streak changes, and on a swap.
  const flare = hot && animate && (via === 'swap' || fw.hidden || st.flameKey !== key);
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

// The compact title reads "{A} {aw}–{bw} {B}". Screens pushed on top keep the plain "‹ Rivals" back label
// (ctx.setBackTitle in mount), never "‹ Ben 8–0 Say…".
function chrome(m) {
  st.title = titleOf(m);
  st.ctx.setTitle(st.title);
  st.ctx.setActions(m && m.b && m.n ? null : []);
}

// Apply a (possibly new) pair. Phase 1 (this frame): the matchup header, the scoreboard and the title, so a
// swap or a pick lands at once. Phase 2 (next frame): the tape, the meeting log and the list, which sit
// below the fold; splitting keeps each task short on slow phones.
// via: 'swap' | 'pick' | 'list' (a row in "{A} against everyone") | 'ext' (the route moved from outside,
// e.g. a profile's Rivalries link over Rivals) | null (data, me, canonicalizing).
function apply(pair, {animate = true, via = null} = {}) {
  const prev = st.m;
  const m = model(pair.a, pair.b);
  const main = st.r.main, hdr = st.r.hdr;
  const board = main.querySelector('.rv-board');
  const both = !!(prev && prev.n && m.n);
  // 'list' and 'ext' scroll back to the top: the header's arrival and the roll wait until they are in view.
  // (layout reads, before any write; the header sits above the board, so it is the one to watch)
  const far = animate && (via === 'list' || via === 'ext');
  const waitOn = !far ? null : !onScreen(hdr) ? hdr : (both && !onScreen(board)) ? board : null;
  st.m = m;
  const held = patchHeader(m, {animate, via, defer: !!waitOn});
  st.meKey = `${data.me()}|${reigning()}`;
  let later = null;
  if (both) {
    if (waitOn) later = () => patchBoard(true, via);
    else patchBoard(animate, via);
  } else if (!prev || prev.a !== m.a || prev.b !== m.b || !!prev.n !== !!m.n) {
    const put = () => { main.innerHTML = mainHTML(m); markRendered(main); };
    if (animate) {
      ui.crossfade(main, put, {duration: 160});
      const nb = main.querySelector('.rv-board');
      if (nb) ui.splitIn(nb);
    } else put();
  }
  if (waitOn) whenSeen(waitOn, () => { held.forEach(arrive); if (later) later(); });
  chrome(m);
  schedule2(animate);
  if (!USER_VIA.includes(via)) return;
  // Spec 9: the new matchup is only drawn (the score is aria-hidden, .rv-sr is silent), so say it.
  ui.announce(spoken(m));
  // A list row or a link on a pushed profile leaves focus at the bottom of the page, on the screen, or in
  // another tab's now hidden layer while the page scrolls to the top: move it to the opponent picker, which
  // now names the new opponent.
  if ((via === 'list' || via === 'ext') && st.ctx.visible) {
    const f = document.activeElement;
    if (!f || f === document.body || f === st.ctx.screen || (st.r.listSec && st.r.listSec.contains(f))
      || !f.getClientRects().length || !!f.closest('.tab-layer[hidden]')) focusPicker('b');
  }
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
// preventScroll: a smooth scroll to the top that is under way carries on.
function focusPicker(side) {
  const b = st && st.r.hdr && st.r.hdr.querySelector('.rv-pick.' + side);
  if (b) b.focus({preventScroll: true});
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
  if (id === st.m.b) {
    scrollTop();
    if (st.r.listSec && st.r.listSec.contains(document.activeElement)) focusPicker('b');
    return;
  }
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
  const t = e.target.closest && e.target.closest('[data-swap], [data-pick], [data-opp], [data-motw], [data-motw-more], [data-motw-share]');
  if (!t || !st) return;
  if (t.hasAttribute('data-motw')) chooseMotw(t.dataset.motw);
  else if (t.hasAttribute('data-motw-more')) { ui.haptic('light'); toggleMore(!st.all); }
  else if (t.hasAttribute('data-motw-share')) shareMotw();
  else if (t.hasAttribute('data-swap')) swap();
  else if (t.hasAttribute('data-pick')) {
    const side = t.dataset.pick === 'a' ? 'a' : 'b';
    // The no-games card's button is gone once the pick lands: let the header picker own the sheet, so
    // focus has somewhere to come back to (openSheet returns it to document.activeElement at open).
    if (t.closest('.rv-none')) focusPicker(side);
    pick(side);
  }
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
      cleanups: [], entrance: false, shown: false, lens: readLens(), all: false};
    el.addEventListener('click', onClick);
    const onLens = e => {
      if (!st || !e.detail || e.detail.name !== 'motw-lens') return;
      st.lens = e.detail.value;
      saveLens(st.lens);
      const sub = el.querySelector('.rv-motw-sub');
      if (sub) sub.textContent = lensSub(st.lens);
      patchMotw(true);
    };
    el.addEventListener('ui:change', onLens);
    st.cleanups.push(() => el.removeEventListener('ui:change', onLens));
    ctx.setBackTitle('Rivals');
    // A year header stuck under the nav merges with it (rivals.css): mark it on scroll, once per frame. Headers in
    // skipped (content-visibility) years are never measured.
    const scr = ctx.screen;
    let raf = 0;
    const markStuck = () => {
      raf = 0;
      if (!st || st.ctx !== ctx) return;
      const nav = scr.querySelector(':scope > .nav');
      const line = scr.getBoundingClientRect().top + (nav ? nav.offsetHeight : 44);
      scr.querySelectorAll('.rv-yh').forEach(h => {
        let on = false;
        if (typeof h.checkVisibility !== 'function' || h.checkVisibility({contentVisibilityAuto: true})) {
          const r = h.getBoundingClientRect();
          on = r.height > 0 && r.top <= line && r.bottom > line;
        }
        if (h.classList.contains('is-stuck') !== on) h.classList.toggle('is-stuck', on);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(markStuck); };
    scr.addEventListener('scroll', onScroll, {passive: true});
    st.cleanups.push(() => { scr.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); });
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

  update(ctx) {
    if (!st || st.ctx !== ctx) return;
    const el = st.el;
    const own = ctx.path === st.expect; // a replace this screen made (a tap, or canonicalizing the URL)
    if (own) st.expect = null;
    const shown = st.m && st.m.b ? canon(st.m.a, st.m.b) : null;
    let via = own ? st.via : null;
    st.via = null;
    let p;
    if (ctx.reason === 'params' || (!own && ctx.path !== shown)) {
      // The second case: app.js folds a pending 'params' into 'me'/'data' for a hidden screen.
      p = resolvePair(ctx.params);
      if (!own) {
        // From outside (a profile's Rivalries link over Rivals, a typed link): handled like a list tap,
        // so the new matchup is brought into view instead of landing far above a scrolled-down page.
        st.isDefault = p.isDefault;
        if (st.m && st.m.b && p.a && p.b && (st.m.a !== p.a || st.m.b !== p.b)) via = 'ext';
      }
    } else if (st.isDefault) {
      // A default pair follows "Which one are you?" and new games. Re-run on 'data' too: a hidden screen's
      // pending 'me' is folded into 'data' when a reload lands before it is shown.
      p = resolvePair({});
    } else {
      p = st.m && data.M[st.m.a] && data.M[st.m.b] ? {a: st.m.a, b: st.m.b} : resolvePair(ctx.params);
    }
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
      if (via === 'ext') scrollTop();
    } else {
      chrome(null);
    }
    if (ok) {
      const path = canon(p.a, p.b);
      if (ctx.path !== path) { st.expect = path; ctx.replace(path); }
    }
    // New games or a new schedule re-rank the week; a new "me" moves the you-ring.
    if (ctx.reason === 'data' || ctx.reason === 'me') patchMotw(false);
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
