// The Daily Games list (the tab's root, views/puzzles.js; the owner's asks, Oct 2026): a shelf of retro game cases, one
// a game (Daily Puzzles, 17-0, the Two-Minute Drill, Kick It, Return Man), swiped along; under it the one you're on,
// its name, how it plays and Play (Continue once it's started). Play (or a tap on the case) opens the game: Daily
// Puzzles straight into today's run, the others on their own page (/puzzles/<game>, pushed).
// A game finished today turns its case round: on its back, your result, your place and the top of today's league
// board; tap it and it comes up close with the whole board, Today's or the Season's. The rows come from each game's core
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

// The games in list order. art: its case's cover (the owner's art, Oct 2026); badge: the pixel scoreboard badge (tools/seventeen/badges.py);
// title: the game page's nav title; cd: the countdown's words once it's played.
export const GAMES = [
  {id: 'puzzles', name: 'Daily Puzzles', title: 'Daily Puzzles', art: 'img/games/puzzles-cover.webp', badge: 'img/puzzles.webp', cd: 'New puzzles in'},
  {id: '17-0', name: '17–0', title: '17–0', art: 'img/games/seventeen-cover.webp', badge: 'img/seventeen.webp', cd: 'New board in'},
  {id: 'drill', name: 'Two-Minute Drill', title: 'Two-Minute Drill', art: 'img/games/drill-cover.webp', badge: 'img/drill.webp', cd: 'Next drill in'},
  {id: 'kick', name: 'Kick It', title: 'Kick It', art: 'img/games/kick-cover.webp', badge: 'img/kick.webp', cd: 'New kicks in'},
  {id: 'return', name: 'Return Man', title: 'Return Man', art: 'img/games/return-cover.webp', badge: 'img/return.webp', cd: 'New kickoffs in'}
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

// ============================================================================ The cases
// The list is a shelf of game cases (the owner's ask, Oct 2026, after a console's shelf of box art): you swipe along
// it; the case in the middle is the one you're on, its name and its Play under it. Each case is a black case, the
// Gridiron Hub band across its top and the game's cover under it (the owner's art). Played today, a case turns round:
// its back is the leaderboard. Tap the back and it comes up close, Today's and the Season's to switch between.
// ACCENT: each game's colour on its back (the tag, the switch), out of its cover.
const ACCENT = {puzzles: '#B5452F', '17-0': '#2F7A4C', drill: '#D23B2F', kick: '#C9A227', return: '#A31F34'};
const bandHTML = (end = '') => `<span class="gm-band"><span class="gm-band-t">GRIDIRON HUB</span>${end}</span>`;
const tileHTML = (big, small, cls = '') => `<span class="gm-tile ${cls}"><b class="n2">${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span>`;
// A line under each row: what it was today, or over the season.
const SUB_TODAY = {
  puzzles: r => r.sub || '',
  '17-0': r => `${(Number(r.p) || 0).toFixed(1)} points a game`,
  drill: r => (r.letter ? `Grade ${r.letter}` : ''),
  kick: r => (r.l ? `Longest ${r.l} yds` : ''),
  return: r => `Longest ${nf(r.l)}${r.td ? ` · ${plural(r.td, 'TD')}` : ''}`
};
/** The season's board for a game (every day so far, the board as this phone may see it): rows with val and sub. */
function seasonRowsOf(id) {
  if (id === 'puzzles') return dailyBoard() === 'ready' ? safe(() => daily.boardRows('season')).map(r => ({...r, val: nf(r.pts)})) : [];
  const M = {'17-0': C.sv, drill: C.dr, kick: C.kk, return: C.rm}[id];
  if (!M || boardOf(M) !== 'ready') return [];
  if (id === '17-0') return safe(() => M.boardRows('all')).map(r => ({...r, val: `${r.w}–${r.l}`, sub: `${plural(r.seasons, 'season')}${r.perfect ? ` · ${r.perfect} perfect` : ''}`}));
  if (id === 'drill') return safe(() => M.seasonRows()).map(r => ({...r, val: `${r.pts} pts`, sub: `${r.w}–${r.l}${r.t ? `–${r.t}` : ''} · ${plural(r.played, 'game')}`}));
  if (id === 'kick') return safe(() => M.seasonRows()).map(r => ({...r, val: `${r.m} made`, sub: `${plural(r.played, 'day')} · longest ${r.l} yds`}));
  return safe(() => M.seasonRows()).map(r => ({...r, val: `${nf(r.y)} yds`, sub: `${plural(r.played, 'day')} · longest ${nf(r.l)}`}));
}
const sticker = (cls, text) => `<span class="gm-stk ${cls}">${esc(text)}</span>`;
/** A case's front: the band, the cover (a sticker on the band while it's under way). */
function frontHTML(g, s) {
  const stk = s.test ? sticker('is-test', 'TEST PLAY') : s.kind === 'started' ? sticker('is-go', 'IN PROGRESS') : '';
  return `<div class="gm-face gm-front">${bandHTML(stk)}<span class="gm-art"><img class="gm-img" src="${g.art}" alt="" decoding="async" draggable="false"></span></div>`;
}
function rowHTML(r, {sub = false} = {}) {
  const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}${r.guest ? ', guest' : ''}: ${r.val}${sub && r.sub ? `. ${r.sub}` : ''}`;
  return `<div class="gm-r${r.me ? ' is-me' : ''}" role="listitem" aria-label="${esc(label)}">`
    + `<span class="gm-r-rk${r.rank <= 3 ? ' is-r' + r.rank : ''}" aria-hidden="true">${r.rank}</span>`
    + `<span class="gm-r-av" aria-hidden="true">${ui.nickAvatar(r.name, {size: sub ? 30 : 22, managerId: r.managerId || null, you: r.me})}</span>`
    + `<span class="gm-r-nm" aria-hidden="true"><span class="gm-r-t">${esc(r.name)}${r.me ? ' <i class="gm-r-you">YOU</i>' : r.guest ? ' <i class="gm-r-you is-g">GUEST</i>' : ''}</span>${sub && r.sub ? `<span class="gm-r-s">${esc(r.sub)}</span>` : ''}</span>`
    + `<span class="gm-r-v" aria-hidden="true">${esc(r.val)}</span></div>`;
}
/** The rows a case's back shows (null: a gap): today's top n with you among them. You lead the people you're tied
 *  with, and when you're further down the top n - 1 come first, then a gap, then you. */
export function miniRows(rows, n = 3) {
  const ord = rows.map((r, i) => ({r, i})).sort((a, b) => a.r.rank - b.r.rank || (b.r.me ? 1 : 0) - (a.r.me ? 1 : 0) || a.i - b.i).map(x => x.r);
  const me = ord.find(r => r.me), top = ord.slice(0, n);
  return !me || top.includes(me) ? top : [...ord.slice(0, n - 1), ...(ord.indexOf(me) > n - 1 ? [null] : []), me];
}
function boardNote(board, rows, season) {
  if (board === 'loading') return `<p class="gm-scr-note">LOADING…</p>`;
  if (board !== 'ready') return `<p class="gm-scr-note">THE SCOREBOARD ISN’T CONNECTED RIGHT NOW</p>`;
  if (!rows.length) return `<p class="gm-scr-note">${season ? 'NO SEASON YET' : 'YOU’RE FIRST ON TODAY’S BOARD ONCE IT POSTS'}</p>`;
  return '';
}
function placeText(s) {
  const me = s.rows && s.rows.find(r => r.me);
  return me ? `${ui.ordinal(me.rank)} of ${s.rows.length} today` : '';
}
/** A case's back: the band, the cover faded behind the name, the result, today's leaderboard, a barcode. */
function backHTML(g, s) {
  const place = placeText(s), note = boardNote(s.board, s.rows || []);
  const rows = note || `<div class="gm-scr-rows" role="list" aria-label="Today’s leaderboard">${miniRows(s.rows, 5).map(r => (r ? rowHTML(r) : '<div class="gm-r-gap" aria-hidden="true">· · ·</div>')).join('')}</div>`;
  return `<div class="gm-face gm-back" style="--gc:${ACCENT[g.id]}">${bandHTML(`<span class="gm-bk-tag">${s.test ? 'TEST' : 'FINAL'}</span>`)}`
    + `<span class="gm-bk-in"><span class="gm-bk-art" style="background-image:url('${g.art}')" aria-hidden="true"></span>`
    + `<span class="gm-bk-name">${esc(g.name)}</span>`
    + `<span class="gm-bk-res"><span class="gm-bk-vis">${s.vis || ''}</span><span class="gm-bk-tt"><b class="gm-bk-h${s.gold ? ' is-gold' : ''}">${esc(s.head || '')}</b>`
    + `${(s.lines || []).map(l => `<small>${esc(l)}</small>`).join('')}${place ? `<em>${esc(place)}</em>` : ''}</span></span>`
    + `<span class="gm-scr"><span class="gm-scr-h">Today’s leaderboard</span>${rows}</span>`
    + `<span class="gm-bk-foot"><span class="gm-bar" aria-hidden="true"></span><span class="gm-bk-tap">Tap for the season ›</span></span></span></div>`;
}
function caseHTML(g, s, i, n) {
  const done = s.kind === 'done';
  const what = done ? `${g.name}: played today${placeText(s) ? `, ${placeText(s)}` : ''}. Show the leaderboard` : `${g.name}${s.kind === 'started' ? ', under way' : ''}`;
  return `<div class="gm-slot" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}" data-gm-slot="${g.id}">`
    + `<button type="button" class="gm-case${done ? ' is-done' : ''}" data-gm="${g.id}" data-kind="${s.kind}" aria-label="${esc(what)}">`
    + `<span class="gm-flip">${frontHTML(g, s)}${done ? backHTML(g, s) : ''}</span><span class="gm-gloss" aria-hidden="true"></span></button></div>`;
}

// ---------------------------------------------------------------- What's under the shelf: the game you're on
function ctaHTML(g, s) {
  if (s.kind === 'loading') return ui.button({label: 'Loading puzzles', kind: 'primary', block: true, disabled: true, cls: 'gm-cta'});
  if (s.kind === 'error') return ui.button({label: 'Try again', kind: 'primary', block: true, attrs: {'data-gm-retry': ''}, cls: 'gm-cta'});
  const label = s.kind === 'started' ? 'Continue' : 'Play';
  return `<button type="button" class="btn btn-primary btn-block gm-cta" data-gm-play="${g.id}" aria-label="${esc(`${label} ${g.name}`)}">`
    + `${ui.icon('play-fill', {cls: 'gm-cta-ic'})}<span class="btn-label">${label}</span></button>`;
}
function cdHTML(g) {
  if (g.id === 'puzzles' && newDay()) return `<div class="gm-cdw">${countdownHTML(true)}</div>`;
  return `<p class="gm-cd">${ui.icon('clock', {size: 15})}<span>${esc(g.cd)} <span class="gm-cd-v" data-gm-cd>${esc(ui.untilText(msToMidnight()))}</span></span></p>`;
}
function newDay() { try { return ready() && daily.checkDay(); } catch (_) { return false; } }
function selHTML(g, s) {
  const done = s.kind === 'done';
  const over = s.test ? 'Test play' : done ? 'Played today' : s.kind === 'started' ? 'Under way' : s.kind === 'loading' ? 'Loading' : 'New today';
  const line = done ? [s.head, ...(s.lines || []), placeText(s)].filter(Boolean).join(' · ') : s.sub;
  const acts = done ? [{label: 'Leaderboard', kind: 'primary', icon: 'trophy', attrs: {'data-gm-zoom': g.id}}, ...s.actions.map(a => ({...a, kind: 'secondary'}))] : null;
  return `<p class="gm-sel-o">${esc(over)}</p><h2 class="gm-sel-t" id="gm-t-${g.id}">${esc(g.name)}</h2><p class="gm-sel-s">${esc(line || '')}</p>`
    + (!done && s.meta ? `<div class="gm-meta">${s.meta}</div>` : '')
    + `<div class="gm-ctas">${acts ? acts.map(a => ui.button({label: a.label, kind: a.kind, icon: a.icon, attrs: a.attrs, cls: 'gm-act'})).join('') : ctaHTML(g, s)}</div>`
    + (done ? cdHTML(g) : '');
}
function stateOf(g) {
  try { return STATE[g.id](); } catch (e) { console.error(e); return {kind: 'new', sub: SUBS[g.id] || ''}; }
}
/** The shelf as it stands now (the cores that haven't loaded yet show Play). */
export function listHTML() {
  const list = gamesFor(), states = list.map(stateOf);
  return `<div class="gm-list" data-key="games" data-enter data-ids="${list.map(g => g.id).join(' ')}">`
    + `<div class="gm-shelf" data-hscroll role="region" aria-roledescription="carousel" aria-label="Daily games: swipe across" tabindex="0">`
    + list.map((g, i) => caseHTML(g, states[i], i, list.length)).join('') + `</div>`
    + `<div class="gm-pips" aria-hidden="true">${list.map((g, i) => `<i class="gm-pip${states[i].kind === 'done' ? ' is-done' : ''}" data-gm-pip="${g.id}"></i>`).join('')}</div>`
    + `<div class="gm-sel" data-gm-sel aria-live="polite">${selHTML(list[0], states[0])}</div></div>`;
}

// ============================================================================ Behavior
const SHELF_KEY = 'gg-shelf';
/** Wires the shelf in el: the cores load at idle; refresh(animate) brings every case (and what's under the shelf) up to
 *  date (a game just finished turns its case round), tick() moves the countdown. opts.play(id): open a game. */
export function mountList(el, ctx, opts = {}) {
  const st = {dead: false, cur: 0, zoom: null, raf: 0, saved: 0};
  const shelf = el.querySelector('.gm-shelf'), sel = el.querySelector('[data-gm-sel]');
  const list = () => gamesFor().filter(g => el.querySelector(`.gm-slot[data-gm-slot="${g.id}"]`));
  const slots = () => [...el.querySelectorAll('.gm-slot')];
  const shown = new Map(); // id → the markup its case shows
  const sig = (g, s) => `${s.kind}|${s.test ? 1 : 0}|${s.kind === 'done' ? backHTML(g, s) : frontHTML(g, s)}`;
  // the case in the middle: bigger and lit, the others smaller and turned a little toward it
  const layout = () => {
    st.raf = 0;
    const box = shelf.getBoundingClientRect(), mid = box.left + box.width / 2;
    let best = 0, bd = Infinity;
    slots().forEach((sl, i) => {
      const r = sl.getBoundingClientRect(), d = (r.left + r.width / 2 - mid) / (r.width || 1), a = Math.min(1, Math.abs(d));
      sl.style.setProperty('--k', a.toFixed(3));
      sl.style.setProperty('--d', Math.max(-1.5, Math.min(1.5, d)).toFixed(3));
      sl.classList.toggle('is-cur', a < .5);
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = i; }
    });
    if (best !== st.cur) setCur(best);
  };
  const onScroll = () => {
    if (!st.raf) st.raf = requestAnimationFrame(layout);
    clearTimeout(st.saved);
    st.saved = setTimeout(() => { const g = list()[st.cur]; if (g) try { sessionStorage.setItem(SHELF_KEY, g.id); } catch (_) {} }, 200);
  };
  function setCur(i, animate = true) {
    st.cur = i;
    const g = list()[i];
    if (!g) return;
    el.querySelectorAll('[data-gm-pip]').forEach(p => p.classList.toggle('is-cur', p.dataset.gmPip === g.id));
    const html = selHTML(g, stateOf(g));
    if (sel.dataset.html === html) return;
    const go = () => { sel.dataset.html = html; sel.innerHTML = html; ui.hydrate(sel); };
    if (animate && ctx.visible && !ui.RM) ui.crossfade(sel, go, {duration: 140}); else go();
  }
  const center = (i, smooth = true) => {
    const sl = slots()[i];
    if (!sl) return;
    shelf.scrollTo({left: sl.offsetLeft + sl.offsetWidth / 2 - shelf.clientWidth / 2, behavior: smooth && !ui.RM ? 'smooth' : 'auto'});
  };
  // ---------------------------------------------------------------- the back, up close
  function rowsFor(g, mode) {
    if (mode === 'season') return {board: g.id === 'puzzles' ? dailyBoard() : boardOf({'17-0': C.sv, drill: C.dr, kick: C.kk, return: C.rm}[g.id] || {boardState: () => 'loading'}), rows: seasonRowsOf(g.id)};
    const s = stateOf(g);
    return {board: s.board, rows: (s.rows || []).map(r => ({...r, sub: SUB_TODAY[g.id](r)}))};
  }
  function zoomBody(g, mode) {
    const {board, rows} = rowsFor(g, mode), note = boardNote(board, rows, mode === 'season');
    const me = rows.find(r => r.me);
    return (me ? `<p class="gm-z-me">You: ${esc(ui.ordinal(me.rank))} of ${rows.length} · ${esc(me.val)}</p>` : '')
      + (note || `<div class="gm-scr-rows" role="list" aria-label="${mode === 'season' ? 'The season' : 'Today'}">${rows.map(r => rowHTML(r, {sub: true})).join('')}</div>`);
  }
  function openZoom(id) {
    const g = byId(id), cs = el.querySelector(`.gm-case[data-gm="${id}"]`);
    if (!g || st.zoom) return;
    const s = stateOf(g);
    const z = document.createElement('div');
    z.className = 'gm-zoom';
    z.innerHTML = `<div class="gm-z-scrim" data-gm-zclose></div>`
      + `<div class="gm-z-case gm-back" style="--gc:${ACCENT[id]}" role="dialog" aria-modal="true" aria-labelledby="gm-z-t" tabindex="-1">`
      + bandHTML(ui.iconButton({icon: 'close', label: 'Close', cls: 'gm-z-x', filled: true, attrs: 'data-gm-zclose'}))
      + `<div class="gm-bk-in"><span class="gm-bk-art" style="background-image:url('${g.art}')" aria-hidden="true"></span><span class="gm-bk-name" id="gm-z-t">${esc(g.name)}</span>`
      + `<div class="gm-bk-res"><span class="gm-bk-vis">${s.vis || ''}</span><span class="gm-bk-tt"><b class="gm-bk-h${s.gold ? ' is-gold' : ''}">${esc(s.head || '')}</b>${(s.lines || []).map(l => `<small>${esc(l)}</small>`).join('')}</span></div>`
      + `<div class="gm-z-tog" role="tablist" aria-label="Leaderboard"><button type="button" role="tab" aria-selected="true" data-gm-zmode="today">Today</button><button type="button" role="tab" aria-selected="false" data-gm-zmode="season">Season</button></div>`
      + `<div class="gm-scr is-z"><div class="gm-z-body" data-gm-zbody>${zoomBody(g, 'today')}</div></div>`
      + `<div class="gm-bk-foot"><span class="gm-bar" aria-hidden="true"></span>`
      + `${ui.button({label: 'Open the game', kind: 'secondary', size: 's', attrs: {'data-gm-open': id}, cls: 'gm-z-open'})}</div></div></div>`;
    (document.getElementById('overlays') || document.body).appendChild(z);
    ui.hydrate(z);
    const card = z.querySelector('.gm-z-case'), app = document.getElementById('app');
    st.zoom = {el: z, id, mode: 'today', app, prev: app ? app.inert : false};
    if (app && !z.closest('#app')) app.inert = true;
    // from the case on the shelf up to the middle of the screen
    if (cs && !ui.RM) {
      const a = cs.getBoundingClientRect(), b = card.getBoundingClientRect();
      const sx = a.width / b.width, sy = a.height / b.height, dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
      ui.animate(card, [{transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: .6}, {transform: 'none', opacity: 1}], {duration: 420, easing: 'cubic-bezier(.22,1,.36,1)'});
      ui.animate(z.querySelector('.gm-z-scrim'), [{opacity: 0}, {opacity: 1}], {duration: 300, easing: 'linear'});
    }
    z.addEventListener('click', e => {
      if (e.target.closest('[data-gm-zclose]')) { closeZoom(); return; }
      const m = e.target.closest('[data-gm-zmode]');
      if (m && m.dataset.gmZmode !== st.zoom.mode) {
        st.zoom.mode = m.dataset.gmZmode;
        z.querySelectorAll('[data-gm-zmode]').forEach(b => b.setAttribute('aria-selected', String(b === m)));
        const body = z.querySelector('[data-gm-zbody]');
        const go = () => { body.innerHTML = zoomBody(g, st.zoom.mode); ui.hydrate(body); body.scrollTop = 0; };
        if (!ui.RM) ui.crossfade(body, go, {duration: 140}); else go();
        ui.haptic('selection');
        return;
      }
      const open = e.target.closest('[data-gm-open]');
      if (open) { closeZoom(true); ctx.nav(gamePath(open.dataset.gmOpen)); }
    });
    z.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeZoom(); } });
    card.focus({preventScroll: true});
    ui.haptic('light');
  }
  function closeZoom(fast) {
    const Z = st.zoom;
    if (!Z) return;
    st.zoom = null;
    if (Z.app) Z.app.inert = Z.prev;
    const cs = el.querySelector(`.gm-case[data-gm="${Z.id}"]`), card = Z.el.querySelector('.gm-z-case');
    if (fast || ui.RM || !cs || !card) { Z.el.remove(); if (cs && !fast) cs.focus({preventScroll: true}); return; }
    const a = cs.getBoundingClientRect(), b = card.getBoundingClientRect();
    const sx = a.width / b.width, sy = a.height / b.height, dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    ui.animate(Z.el.querySelector('.gm-z-scrim'), [{opacity: 1}, {opacity: 0}], {duration: 260, easing: 'linear'});
    const an = ui.animate(card, [{transform: 'none', opacity: 1}, {transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: .4}], {duration: 300, easing: 'cubic-bezier(.4,0,.6,1)'});
    const done = () => { Z.el.remove(); cs.focus({preventScroll: true}); };
    if (an && an.finished) an.finished.then(done, done); else setTimeout(done, 300);
  }
  // ---------------------------------------------------------------- taps, keys
  const onClick = e => {
    const zb = e.target.closest('[data-gm-zoom]');
    if (zb) { openZoom(zb.dataset.gmZoom); return; }
    const cs = e.target.closest('.gm-case[data-gm]');
    if (!cs) return;
    const i = list().findIndex(g => g.id === cs.dataset.gm);
    if (i !== st.cur) { ui.haptic('selection'); center(i); return; }
    if (cs.dataset.kind === 'done') { openZoom(cs.dataset.gm); return; }
    if (cs.dataset.kind === 'loading') return;
    if (cs.dataset.kind === 'error') { const b = sel.querySelector('[data-gm-retry]'); if (b) b.click(); return; }
    ui.haptic('light');
    if (opts.play) opts.play(cs.dataset.gm);
  };
  const onKey = e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = Math.max(0, Math.min(list().length - 1, st.cur + (e.key === 'ArrowLeft' ? -1 : 1)));
    if (i !== st.cur) center(i);
  };
  shelf.addEventListener('scroll', onScroll, {passive: true});
  shelf.addEventListener('keydown', onKey);
  el.addEventListener('click', onClick);
  const onResize = () => { center(st.cur, false); layout(); };
  addEventListener('resize', onResize, {passive: true});
  const onPop = () => closeZoom(true);
  addEventListener('popstate', onPop);
  addEventListener('hashchange', onPop);
  // where you were on the shelf, else the first game you haven't played today
  const start = () => {
    let id = null;
    try { id = sessionStorage.getItem(SHELF_KEY); } catch (_) {}
    const gs = list();
    let i = gs.findIndex(g => g.id === id);
    if (i < 0) i = Math.max(0, gs.findIndex(g => stateOf(g).kind !== 'done'));
    center(i, false);
    st.cur = -1;
    layout();
  };
  requestAnimationFrame(start);

  const refresh = (animate = true) => {
    if (st.dead) return;
    // a change of who this phone is can add or take away a game (Return Man): the shelf is drawn again
    const ids = gamesFor().map(g => g.id).join(' ');
    if (el.dataset.ids !== ids) {
      const t = document.createElement('div');
      t.innerHTML = listHTML();
      el.dataset.ids = ids;
      shelf.innerHTML = t.querySelector('.gm-shelf').innerHTML;
      el.querySelector('.gm-pips').innerHTML = t.querySelector('.gm-pips').innerHTML;
      shown.clear();
      ui.hydrate(shelf);
      if (gameOpen('return')) { coresAsked = false; loadCores(() => refresh(true)); }
      requestAnimationFrame(start);
      return;
    }
    list().forEach((g, i) => {
      const cs = el.querySelector(`.gm-case[data-gm="${g.id}"]`);
      if (!cs) return;
      const s = stateOf(g), key = sig(g, s);
      if (shown.get(g.id) === key) return;
      const was = cs.dataset.kind;
      shown.set(g.id, key);
      const flipNow = s.kind === 'done' && was !== 'done';
      cs.dataset.kind = s.kind;
      const fl = cs.querySelector('.gm-flip');
      fl.innerHTML = frontHTML(g, s) + (s.kind === 'done' ? backHTML(g, s) : '');
      ui.hydrate(fl);
      // a game just finished: its case turns round to the leaderboard
      if (flipNow && animate && ctx.visible && !ui.RM) requestAnimationFrame(() => requestAnimationFrame(() => cs.classList.add('is-done')));
      else cs.classList.toggle('is-done', s.kind === 'done');
      cs.setAttribute('aria-label', s.kind === 'done' ? `${g.name}: played today${placeText(s) ? `, ${placeText(s)}` : ''}. Show the leaderboard` : `${g.name}${s.kind === 'started' ? ', under way' : ''}`);
      const pip = el.querySelector(`[data-gm-pip="${g.id}"]`);
      if (pip) pip.classList.toggle('is-done', s.kind === 'done');
      if (i === st.cur) setCur(i, animate);
    });
    if (st.zoom) {
      const body = st.zoom.el.querySelector('[data-gm-zbody]'), g = byId(st.zoom.id), html = zoomBody(g, st.zoom.mode);
      if (body && body.dataset.html !== html) { body.dataset.html = html; body.innerHTML = html; ui.hydrate(body); }
    }
  };
  list().forEach(g => shown.set(g.id, sig(g, stateOf(g))));
  ui.whenIdle(() => loadCores(() => refresh(true)));
  const tick = () => {
    const t = ui.untilText(msToMidnight());
    el.querySelectorAll('[data-gm-cd]').forEach(v => { if (v.textContent !== t) v.textContent = t; });
  };
  return {refresh, tick, destroy() {
    st.dead = true;
    closeZoom(true);
    shelf.removeEventListener('scroll', onScroll);
    shelf.removeEventListener('keydown', onKey);
    el.removeEventListener('click', onClick);
    removeEventListener('resize', onResize);
    removeEventListener('popstate', onPop);
    removeEventListener('hashchange', onPop);
    if (st.raf) cancelAnimationFrame(st.raf);
  }};
}
