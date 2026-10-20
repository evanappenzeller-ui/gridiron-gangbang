// The Daily Games list (the tab's root, views/puzzles.js; the owner's ask, Oct 2026): one big card per game, Daily
// Puzzles, 17-0, the Two-Minute Drill, Kick It and Return Man, each about the size of the old score card, with its thumbnail
// (img/games/*.webp: captures of the games themselves), its name, how it plays and Play (Continue once it's started).
// Play opens the game: Daily Puzzles straight into today's run, the others on their own page (/puzzles/<game>,
// pushed); a tap anywhere else on a card opens the game's page too (Daily Puzzles' has its leaderboard).
// A game finished today turns its card into that game's scoreboard: your result, your place today and the top of
// today's league board, the way to the rest and the countdown to the next one. The rows come from each game's core
// (boardRows: daily.LB.raw / LB.players, the board as this phone may see it: THE RULE, CLAUDE.md).
// 17-0's, the drill's, Kick It's and Return Man's cores load at idle (17-0's and the drill's with their day files);
// until then their cards offer Play. Return Man is the owner's alone while he tests it (gameOpen, below).
// Exports: GAMES, gameOpen(id), gamesFor(), gamePath(id), dailyKind(), progHTML() (and its fracOf, perfectOf, doneCount),
// miniRows(rows), listHTML(), mountList(el, ctx) → {refresh(animate), tick(), destroy()}.
// Owner: PUZZLES.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {ringHTML, stepParts, maxPts, gradeGold, msToMidnight, countdownHTML, itemCount} from './board.js';

const esc = data.esc;
const nf = n => data.nf(n);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// The games in list order. art: the card's thumbnail; badge: the pixel scoreboard badge (tools/seventeen/badges.py);
// title: the game page's nav title; cd: the countdown's words once it's played.
export const GAMES = [
  {id: 'puzzles', name: 'Daily Puzzles', title: 'Daily Puzzles', art: 'img/games/puzzles-art.webp', badge: 'img/puzzles.webp', cd: 'New puzzles in'},
  {id: '17-0', name: '17–0', title: '17–0', art: 'img/games/seventeen-art.webp', badge: 'img/seventeen.webp', cd: 'New board in'},
  {id: 'drill', name: 'Two-Minute Drill', title: 'Two-Minute Drill', art: 'img/games/drill-art.webp', badge: 'img/drill.webp', cd: 'Next drill in'},
  {id: 'kick', name: 'Kick It', title: 'Kick It', art: 'img/games/kick-art.webp', badge: 'img/kick.webp', cd: 'New kicks in'},
  {id: 'return', name: 'Return Man', title: 'Return Man', art: 'img/games/return-art.webp', badge: 'img/return.webp', cd: 'New kickoffs in'}
];
const byId = id => GAMES.find(g => g.id === id);
// Return Man is the owner's alone for now (his ask, Oct 2026: "exclusive to me for testing"): on the list, and its page
// opens, only on his phones (data.OWNER); nobody else's phone loads it or posts it. To open it to the league, drop it
// from ONLY (and turn its kit check, checks-return.js, back to "everyone's").
const ONLY = {return: [data.OWNER]};
/** Whether game id is open on this phone (who: the phone's member). */
export const gameOpen = (id, who = data.me()) => !ONLY[id] || (!!who && ONLY[id].includes(who));
/** The games this phone's list shows, in order. */
export const gamesFor = (who = data.me()) => GAMES.filter(g => gameOpen(g.id, who));
/** A game's page (pushed over the list): Daily Puzzles' is /puzzles/daily. */
export const gamePath = id => (id === 'puzzles' ? '/puzzles/daily' : `/puzzles/${id}`);

// ============================================================================ Daily Puzzles
const ready = () => daily.status === 'ready' && !!daily.DAY;
/** 'error' | 'loading' | 'new' (nothing played) | 'started' | 'played' (today's score came from another phone) |
 *  'done' (every puzzle finished). */
export function dailyKind() {
  if (daily.status === 'error') return 'error';
  if (!ready()) return 'loading';
  if (daily.allDone()) return 'done';
  if (daily.playedElsewhere()) return 'played';
  return daily.anyStarted() ? 'started' : 'new';
}
/** Progress of step i as a fraction (the run cover's rule): items answered for College, Silhouettes and Grid; 1 when
 *  done for the rest. */
export function fracOf(i) {
  const s = daily.STEPS[i], ds = daily.DS;
  if (s.done()) return 1;
  if (s.id === 'col') return Math.min(1, ds.col.a.length / (itemCount('col') || 1));
  if (s.id === 'sil') return Math.min(1, ((ds.sil && ds.sil.a) || []).length / (itemCount('sil') || 1));
  if (s.id === 'grid') return Math.min(1, ds.grid.cells.filter(Boolean).length / (itemCount('grid') || 1));
  return 0;
}
export const perfectOf = i => daily.STEPS[i].done() && daily.STEPS[i].pts() === daily.STEPS[i].max;
export const doneCount = () => daily.STEPS.filter(s => s.done()).length;
/** One segment per puzzle, filled as far as it's played, and "1 of 3 done". */
export function progHTML() {
  const S = daily.STEPS;
  return `<div class="c-prog" aria-hidden="true">${S.map((_, i) => `<i class="c-prog-s"><b class="c-prog-f${perfectOf(i) ? ' is-perfect' : ''}" style="transform:scaleX(${fracOf(i)})"></b></i>`).join('')}</div>`
    + `<p class="c-prog-t">${esc(`${doneCount()} of ${S.length} done`)}</p>`;
}
function dailyBoard() {
  if (daily.status === 'error') return 'wait';
  if (daily.LB.off || daily.LB.err) return 'off';
  return daily.LB.ready ? 'ready' : 'loading';
}
function socialHTML() {
  if (dailyBoard() !== 'ready') return '';
  let s;
  try { s = daily.social(); } catch (_) { return ''; }
  const n = s.played.length;
  if (!n) return '';
  const list = s.played.map(r => ({managerId: r.managerId, nick: r.name, you: r.me}));
  const leader = s.leader ? ` ${s.leader} leads.` : '';
  return `<div class="gm-social">${ui.avatarStack(list, {max: 4, size: 22})}<span>${esc(`${n} of ${Math.max(n, s.regulars)} have played today.${leader}`)}</span></div>`;
}
function puzzlesState() {
  const k = dailyKind(), test = !!daily.TEST;
  const sub = ready() ? `${daily.andList(daily.STEPS.map(s => s.label))}. ${nf(maxPts())} points.` : 'Today’s puzzles: a few minutes, every day.';
  if (k === 'loading') return {kind: 'loading', sub};
  if (k === 'error') return {kind: 'error', sub: 'Puzzles need a connection the first time.'};
  if (k === 'new') return {kind: 'new', test, sub, meta: socialHTML()};
  if (k === 'started') return {kind: 'started', test, sub, meta: `<div class="gm-prog">${progHTML()}</div>`};
  const rows = dailyBoard() === 'ready' ? safe(() => daily.boardRows('today')).map(r => ({...r, val: nf(r.pts)})) : [];
  const base = {kind: 'done', test, board: dailyBoard(), rows};
  if (k === 'played') {
    const e = daily.playedElsewhere() || {};
    return {...base, vis: tileHTML(nf(Number(e.p) || 0), 'points'), head: `${nf(Number(e.p) || 0)} points`, lines: ['Played on another phone'],
      actions: [{label: 'See the leaderboard', kind: 'secondary', attrs: {'data-gm-open': 'puzzles'}}]};
  }
  const total = daily.totalPts(), max = nf(maxPts()), grade = daily.gradeFor(total);
  const ring = ringHTML(stepParts(), {size: 88, stroke: 8, center: `<span class="gm-ringn">${esc(nf(total))}</span>`,
    label: `Today: ${nf(total)} of ${max} points`, cls: 'gm-ring'});
  return {...base, vis: ring, head: grade, gold: gradeGold(grade), lines: [`${nf(total)} of ${max} points`],
    actions: [{label: 'See results', kind: 'primary', attrs: {'data-gm-results': ''}},
      {label: 'Share', kind: 'secondary', icon: 'share', attrs: {'data-share': ''}}]};
}
const safe = f => { try { return f() || []; } catch (e) { console.error(e); return []; } };

// ============================================================================ 17-0, the drill, Kick It
// Their cores, once loaded (17-0's and the drill's need their day files).
const C = {sv: null, dr: null, kk: null, rm: null};
let coresAsked = false;
function loadCores(then) {
  if (coresAsked) return;
  coresAsked = true;
  import('../core/seventeen.js').then(m => m.load().then(() => { C.sv = m; then(); })).catch(() => {});
  import('../core/drill.js').then(m => m.load().then(() => { C.dr = m; then(); })).catch(() => {});
  import('../core/kick.js').then(m => { C.kk = m; then(); }).catch(() => {});
  if (gameOpen('return')) import('../core/return.js').then(m => { C.rm = m; then(); }).catch(() => {});
}
const boardOf = m => safe(() => [m.boardState()])[0] || 'loading';
const SUBS = {
  '17-0': 'Five players, one budget, one season. Can your team go 17–0?',
  drill: 'Down late with the ball. Call every play to the final whistle.',
  kick: 'Field goals that get longer with every make. Three misses and you’re done.',
  return: 'A new world every 100 yards, from the beach to outer space. Juke, jump, ride the roofs.'
};
function drillSub(dr, n) {
  try {
    const s = dr.scenario(n), o = dr.team(s.o).n, d = dr.team(s.d).n;
    const clock = `${Math.floor(s.t / 60)}:${String(s.t % 60).padStart(2, '0')}`;
    const where = s.us < s.them ? `The ${o} trail the ${d} ${s.them}–${s.us}.` : s.us > s.them ? `The ${o} lead the ${d} ${s.us}–${s.them}.` : `The ${o} and the ${d}, tied at ${s.us}.`;
    return `${where} ${clock} left, your ball.`;
  } catch (_) { return SUBS.drill; }
}
// A season's word on its card (the season screen's verdicts, views/seventeen.js, cut to a headline).
const SEASON = [[17, 'Perfect season'], [16, 'One from perfect'], [14, 'A juggernaut'], [11, 'Playoff team'], [8, 'On the bubble'], [5, 'Rebuilding year'], [0, 'Top-three pick']];
function seventeenState() {
  const sv = C.sv;
  if (!sv) return {kind: 'new', sub: SUBS['17-0']};
  const n = sv.todayNumber(), day = sv.dayState(n), test = sv.testing();
  const rows = boardOf(sv) === 'ready' ? safe(() => sv.boardRows('today', n)).map(r => ({...r, val: `${r.w}–${r.l}`})) : [];
  const mine = rows.find(r => r.me);
  const res = day.played || (!test && mine ? {w: mine.w, l: mine.l, ppg: mine.p} : null);
  if (!res) {
    const k = day.pick.filter(x => x != null).length;
    return k ? {kind: 'started', test, sub: SUBS['17-0'], meta: `<p class="gm-note">${esc(`${k} of 5 picked`)}</p>`} : {kind: 'new', test, sub: SUBS['17-0']};
  }
  return {kind: 'done', test, board: boardOf(sv), rows, gold: res.w === 17,
    vis: tileHTML(`${res.w}–${res.l}`, 'record', res.w === 17 ? 'is-gold' : ''),
    head: SEASON.find(([w]) => res.w >= w)[1],
    lines: [`${(Number(res.ppg) || 0).toFixed(1)} points a game`],
    actions: [{label: 'See your season', kind: 'secondary', attrs: {'data-gm-open': '17-0'}}]};
}
function drillState() {
  const dr = C.dr;
  if (!dr) return {kind: 'new', sub: SUBS.drill};
  const n = dr.todayNumber(), day = dr.dayState(n), test = dr.testing();
  const rows = boardOf(dr) === 'ready' ? safe(() => dr.boardRows(n)).map(r => ({...r, val: `${r.r} ${r.u}–${r.h}`})) : [];
  const mine = rows.find(r => r.me);
  if (!day.result && !(mine && !test)) {
    return day.acts ? {kind: 'started', test, sub: drillSub(dr, n), meta: '<p class="gm-note">Under way. Pick up where you left off.</p>'}
      : {kind: 'new', test, sub: drillSub(dr, n)};
  }
  const r = day.result || mine.r;
  let us = mine && mine.u, them = mine && mine.h, how = '', grade = mine ? mine.grade : null;
  if (day.result) {
    try {
      const s = dr.game(n), t = dr.resultText(s);
      us = s.us; them = s.them; how = t.sub;
      grade = dr.gradeOf(n, day.acts).grade;
    } catch (e) { console.error(e); }
  }
  const head = r === 'W' ? 'You win' : r === 'T' ? 'Tied. Overtime' : 'You lose';
  const letter = grade == null ? '' : dr.gradeLetter(grade);
  return {kind: 'done', test, board: boardOf(dr), rows,
    vis: tileHTML(r, us != null ? `${us}–${them}` : '', 'is-' + r),
    head, lines: [[letter && `Grade ${letter}`, how].filter(Boolean).join(' · ')].filter(Boolean),
    actions: [{label: 'See the game', kind: 'secondary', attrs: {'data-gm-open': 'drill'}}]};
}
function kickState() {
  const K = C.kk;
  if (!K) return {kind: 'new', sub: SUBS.kick};
  const n = K.todayNumber(), day = K.dayState(n), test = K.testing();
  const rows = boardOf(K) === 'ready' ? safe(() => K.boardRows(n)).map(r => ({...r, val: String(r.m)})) : [];
  const mine = rows.find(r => r.me);
  const off = day.official || (!test && mine ? {made: mine.m, longest: mine.l} : null);
  if (!off) {
    return day.list.length ? {kind: 'started', test, sub: SUBS.kick, meta: `<p class="gm-note">${esc(`${day.made} made, ${day.missed} missed so far`)}</p>`}
      : {kind: 'new', test, sub: SUBS.kick};
  }
  return {kind: 'done', test, board: boardOf(K), rows,
    vis: tileHTML(String(off.made), 'made'),
    head: plural(off.made, 'field goal'), lines: [off.longest ? `Longest ${off.longest} yds` : 'No makes today'],
    actions: [{label: 'See your kicks', kind: 'secondary', attrs: {'data-gm-open': 'kick'}}]};
}
function returnState() {
  const RM = C.rm;
  if (!RM) return {kind: 'new', sub: SUBS.return};
  const n = RM.todayNumber(), day = RM.dayState(n), test = RM.testing();
  const rows = boardOf(RM) === 'ready' ? safe(() => RM.boardRows(n)).map(r => ({...r, val: nf(r.y)})) : [];
  const mine = rows.find(r => r.me);
  const off = day.official || (!test && mine ? {yards: mine.y, longest: mine.l, tds: mine.td} : null);
  if (!off) {
    return day.list.length || RM.live(n) ? {kind: 'started', test, sub: SUBS.return, meta: `<p class="gm-note">${esc(day.list.length ? `${plural(day.list.length, 'return')} run: ${nf(day.yards)} yards so far` : 'A return under way.')}</p>`}
      : {kind: 'new', test, sub: SUBS.return};
  }
  return {kind: 'done', test, board: boardOf(RM), rows,
    vis: tileHTML(nf(off.yards), 'yards'),
    head: off.tds ? plural(off.tds, 'touchdown') : off.yards >= 180 ? 'Great field position' : 'Three returns',
    lines: [`Longest ${nf(off.longest)} yards`],
    actions: [{label: 'See your returns', kind: 'secondary', attrs: {'data-gm-open': 'return'}}]};
}
const STATE = {puzzles: puzzlesState, '17-0': seventeenState, drill: drillState, kick: kickState, return: returnState};

// ============================================================================ Markup
const tileHTML = (big, small, cls = '') => `<span class="gm-tile ${cls}"><b class="n2">${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span>`;
const imgHTML = (src, cls, w, h) => `<img class="${cls}" src="${src}" alt="" width="${w}" height="${h}" decoding="async" draggable="false">`;
const chipHTML = () => '<span class="gm-chip">Test play</span>';

function ctaHTML(g, s) {
  if (s.kind === 'loading') return ui.button({label: 'Loading puzzles', kind: 'primary', block: true, disabled: true, cls: 'gm-cta'});
  if (s.kind === 'error') return ui.button({label: 'Try again', kind: 'primary', block: true, attrs: {'data-gm-retry': ''}, cls: 'gm-cta'});
  const label = s.kind === 'started' ? 'Continue' : 'Play';
  return `<button type="button" class="btn btn-primary btn-block gm-cta" data-gm-play="${g.id}" aria-label="${esc(`${label} ${g.name}`)}">`
    + `${ui.icon('play-fill', {cls: 'gm-cta-ic'})}<span class="btn-label">${label}</span></button>`;
}
/** Not played yet (or under way): the thumbnail, the name and how it plays, Play. */
function playInner(g, s) {
  return `<div class="gm-art">${imgHTML(g.art, 'gm-art-img', 358, 201)}${s.test ? chipHTML() : ''}</div>`
    + `<div class="gm-info"><div class="gm-head">${imgHTML(g.badge, 'gm-badge', 44, 44)}`
    + `<div class="gm-tt"><h2 class="gm-t" id="gm-t-${g.id}">${esc(g.name)}</h2><p class="gm-sub">${esc(s.sub)}</p></div></div>`
    + (s.meta ? `<div class="gm-meta">${s.meta}</div>` : '')
    + `<div class="gm-ctas">${ctaHTML(g, s)}</div></div>`;
}
function rowHTML(r) {
  const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}${r.guest ? ', guest' : ''}: ${r.val}`;
  return `<div class="gm-row${r.me ? ' is-me' : ''}" role="listitem" aria-label="${esc(label)}">`
    + `<span class="gm-rk${r.rank <= 3 ? ' is-r' + r.rank : ''}" aria-hidden="true">${r.rank}</span>`
    + `<span class="gm-av" aria-hidden="true">${ui.nickAvatar(r.name, {size: 28, managerId: r.managerId || null, you: r.me})}</span>`
    + `<span class="gm-nm" aria-hidden="true"><span class="gm-nmt">${esc(r.name)}</span>${r.me ? ui.badge('you') : r.guest ? ui.badge('guest') : ''}</span>`
    + `<span class="gm-val n4" aria-hidden="true">${esc(r.val)}</span></div>`;
}
/** The rows a scoreboard card shows (null: a gap): today's top three with you among them. You lead the people you're
 *  tied with, and when you're further down the top two come first, then a gap, then you. */
export function miniRows(rows) {
  const ord = rows.map((r, i) => ({r, i})).sort((a, b) => a.r.rank - b.r.rank || (b.r.me ? 1 : 0) - (a.r.me ? 1 : 0) || a.i - b.i).map(x => x.r);
  const me = ord.find(r => r.me), top = ord.slice(0, 3);
  return !me || top.includes(me) ? top : [...ord.slice(0, 2), ...(ord.indexOf(me) > 2 ? [null] : []), me];
}
function miniHTML(s) {
  if (s.board === 'loading') return `<div class="gm-mini is-loading">${ui.skeleton('rows', 3, {label: 'Loading the scoreboard.'})}</div>`;
  if (s.board !== 'ready') return `<p class="gm-note gm-mini-note">The scoreboard isn’t connected right now.</p>`;
  if (!s.rows.length) return `<p class="gm-note gm-mini-note">You’re the first on today’s board once it posts.</p>`;
  const list = miniRows(s.rows);
  return `<div class="gm-mini" role="list" aria-label="Today’s scoreboard">`
    + list.map(r => (r ? rowHTML(r) : '<div class="gm-gap" aria-hidden="true">⋯</div>')).join('') + `</div>`;
}
function placeText(s) {
  const me = s.rows && s.rows.find(r => r.me);
  return me ? `${ui.ordinal(me.rank)} of ${s.rows.length} today` : '';
}
function cdHTML(g) {
  if (g.id === 'puzzles' && newDay()) return `<div class="gm-cdw">${countdownHTML(true)}</div>`;
  return `<p class="gm-cd">${ui.icon('clock', {size: 15})}<span>${esc(g.cd)} <span class="gm-cd-v" data-gm-cd>${esc(ui.untilText(msToMidnight()))}</span></span></p>`;
}
function newDay() { try { return ready() && daily.checkDay(); } catch (_) { return false; } }
/** Played today: the card is that game's scoreboard. */
function boardInner(g, s) {
  const place = placeText(s);
  return `<header class="gm-sbh">${imgHTML(g.badge, 'gm-badge is-s', 32, 32)}<h2 class="gm-sbt" id="gm-t-${g.id}">${esc(g.name)}</h2>`
    + `${s.test ? chipHTML() : '<span class="gm-final">Final</span>'}</header>`
    + `<div class="gm-res"><div class="gm-vis">${s.vis}</div><div class="gm-rt">`
    + `<p class="gm-rh${s.gold ? ' is-gold' : ''}">${s.gold ? ui.icon('trophy', {size: 16}) : ''}<span>${esc(s.head)}</span></p>`
    + s.lines.map(l => `<p class="gm-rl">${esc(l)}</p>`).join('')
    + (place ? `<p class="gm-place">${esc(place)}</p>` : '') + `</div></div>`
    + miniHTML(s)
    + `<div class="gm-ctas">${s.actions.map(a => ui.button({label: a.label, kind: a.kind, icon: a.icon, attrs: a.attrs, cls: 'gm-act'})).join('')}</div>`
    + cdHTML(g);
}
const innerHTML = (g, s) => (s.kind === 'done' ? boardInner(g, s) : playInner(g, s));
function stateOf(g) {
  try { return STATE[g.id](); } catch (e) { console.error(e); return {kind: 'new', sub: SUBS[g.id] || ''}; }
}
function cardHTML(g, s = stateOf(g)) {
  return `<article class="card gm-card is-${s.kind}" data-gm="${g.id}" data-kind="${s.kind}" aria-labelledby="gm-t-${g.id}">${innerHTML(g, s)}</article>`;
}
/** The list as it stands now (the cores that haven't loaded yet show Play). */
export function listHTML() {
  const list = gamesFor();
  return `<div class="gm-list" data-key="games" data-enter data-ids="${list.map(g => g.id).join(' ')}">${list.map(g => cardHTML(g)).join('')}</div>`;
}

// ============================================================================ Behavior
/** Wires the list in el: the cores load at idle; refresh(animate) brings every card up to date (a card that changed
 *  state crossfades), tick() moves the countdowns. */
export function mountList(el, ctx) {
  const st = {dead: false};
  const refresh = (animate = true) => {
    if (st.dead) return;
    // a change of who this phone is can add or take away a game (Return Man): the list is drawn again
    const ids = gamesFor().map(g => g.id).join(' ');
    if (el.dataset.ids !== ids) {
      el.dataset.ids = ids;
      el.innerHTML = gamesFor().map(g => cardHTML(g)).join('');
      ui.hydrate(el);
      if (gameOpen('return')) { coresAsked = false; loadCores(() => refresh(true)); }
      return;
    }
    gamesFor().forEach(g => {
      const card = el.querySelector(`.gm-card[data-gm="${g.id}"]`);
      if (!card) return;
      const s = stateOf(g), html = innerHTML(g, s);
      if (shown.get(card) === html) return;
      const was = card.dataset.kind;
      const go = () => {
        card.className = `card gm-card is-${s.kind}`;
        card.dataset.kind = s.kind;
        card.innerHTML = html;
        shown.set(card, html);
        ui.hydrate(card);
      };
      if (animate && was !== s.kind && ctx.visible && !ui.RM) ui.crossfade(card, go, {duration: 200}); else go();
    });
  };
  const shown = new WeakMap(); // card → the markup it shows
  el.querySelectorAll('.gm-card').forEach(card => { const g = byId(card.dataset.gm); if (g) shown.set(card, innerHTML(g, stateOf(g))); });
  ui.whenIdle(() => loadCores(() => refresh(true)));
  const tick = () => {
    const t = ui.untilText(msToMidnight());
    el.querySelectorAll('[data-gm-cd]').forEach(v => { if (v.textContent !== t) v.textContent = t; });
  };
  return {refresh, tick, destroy() { st.dead = true; }};
}
