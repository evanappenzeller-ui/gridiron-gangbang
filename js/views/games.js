import * as features from '../core/features.js';
// The Daily Games list (the tab's root, views/puzzles.js; the owner's asks, Oct 2026): a shelf of retro game cases, one
// a game (Daily Puzzles, 17-0, the Two-Minute Drill, Kick It, Return Man, and the owner's Keep), swiped along; under it the one you're on.
// A game is started from its case (the owner's ask, Oct 2026): a tap on its front brings it up close and opens it, and
// Start (Continue once it's started) in the tray over the disc opens the game: Daily Puzzles straight into today's run,
// the others on their own page (/puzzles/<game>, pushed).
// Evan's profile has the physical green case skin, a full-size Play / Continue control below the open case,
// and a cancellable disc-to-console transition before that same game route opens.
// A game finished today turns its case round: on its back, your result, your place and the top of today's league
// board; tap it and it comes up close with the whole board, Today's or the Season's. The rows come from each game's core
// (boardRows: daily.LB.raw / LB.players, the board as this phone may see it: THE RULE, CLAUDE.md).
// 17-0's, the drill's, Kick It's and Return Man's cores load at idle (17-0's and the drill's with their day files);
// until then their cases open to Start. Return Man is open to the league in beta (a BETA tag on its case: GAMES beta).
// Exports: GAMES, gameOpen(id), gamesFor(), gamePath(id), dailyKind(), progHTML() (and its fracOf, perfectOf, doneCount),
// miniRows(rows), listHTML(), mountList(el, ctx) → {refresh(animate), tick(), destroy()}, testingAll(), testAll(on).
// Owner: PUZZLES.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {ringHTML, stepParts, maxPts, gradeGold, msToMidnight, countdownHTML, itemCount} from './board.js';
import {turnable, shelfTurner, shellHTML} from './game-case.js';

const esc = data.esc;
const nf = n => data.nf(n);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// The games in list order. art: its case's cover (the owner's art, Oct 2026); book, disc: the booklet in its lid and
// the disc in it (the owner's art too, cut out of his photos: the disc round, its clear middle see-through); badge: the
// pixel scoreboard badge (tools/seventeen/badges.py); title: the game page's nav title; cd: the countdown's words once
// it's played; beta: still being worked on (a BETA tag on its case, the owner's ask, Oct 2026: Return Man, open to the
// league while he works on it).
export const GAMES = [
  {id: 'puzzles', name: 'Daily Puzzles', title: 'Daily Puzzles', art: 'img/games/puzzles-cover.webp', book: 'img/games/puzzles-book.webp', disc: 'img/games/puzzles-disc.webp', badge: 'img/puzzles.webp', cd: 'New puzzles in'},
  {id: '17-0', name: '17–0', title: '17–0', art: 'img/games/seventeen-cover.webp', book: 'img/games/seventeen-book.webp', disc: 'img/games/seventeen-disc.webp', badge: 'img/seventeen.webp', cd: 'New board in'},
  {id: 'drill', name: 'Two-Minute Drill', title: 'Two-Minute Drill', art: 'img/games/drill-cover.webp', book: 'img/games/drill-book.webp', disc: 'img/games/drill-disc.webp', badge: 'img/drill.webp', cd: 'Next drill in'},
  {id: 'kick', name: 'Kick It', title: 'Kick It', art: 'img/games/kick-cover.webp', book: 'img/games/kick-book.webp', disc: 'img/games/kick-disc.webp', badge: 'img/kick.webp', cd: 'New kicks in'},
  {id: 'return', name: 'Return Man', title: 'Return Man', art: 'img/games/return-cover.webp', book: 'img/games/return-book.webp', disc: 'img/games/return-disc.webp', badge: 'img/return.webp', cd: 'Next kickoff in', beta: true},
  {id: 'keep', name: 'Keepfall', title: 'Keepfall', art: 'img/games/keepfall-cover-v1.webp', book: 'img/games/keepfall-book-v1.webp', disc: 'img/games/keepfall-disc-v1.webp'}
];
const byId = id => GAMES.find(g => g.id === id);
// A game the owner keeps to himself while he builds it: id -> the members whose phones list it and open its page
// (nobody else's phone loads it or posts it). Keepfall remains the owner's alone; the other games are the league's.
const ONLY = {};
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
  if (k === 'loading') return {kind: 'loading'};
  if (k === 'error') return {kind: 'error', meta: '<p class="gm-note">Puzzles need a connection the first time.</p>'};
  if (k === 'new') return {kind: 'new', test, meta: socialHTML()};
  if (k === 'started') return {kind: 'started', test, meta: `<div class="gm-prog">${progHTML()}</div>`};
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
export const __dev = {cores: C}; // (the kit's checks build the shelf with a core in place)
let coresAsked = false;
function loadCores(then) {
  if (coresAsked) return;
  coresAsked = true;
  const got = (k, m) => { C[k] = m; if (TEST_ALL && !m.testing()) m.setTest(true); then(); }; // (one loaded in test mode joins it)
  import('../core/seventeen.js').then(m => m.load().then(() => got('sv', m))).catch(() => {});
  import('../core/drill.js').then(m => m.load().then(() => got('dr', m))).catch(() => {});
  import('../core/kick.js').then(m => got('kk', m)).catch(() => {});
  if (gameOpen('return')) import('../core/return.js').then(m => got('rm', m)).catch(() => {});
}

// ============================================================================ The owner's test mode
// One button for every game (the owner's ask, Oct 2026: at the top right of Daily Games, on his phones only): each
// game's Test play (views/testplay.js) at once, today's games started fresh in their sandboxes, never posted and never
// counted (the Franchise's pay too comes only from what's posted); on again, they all start fresh again; off, the real
// day comes back as it was.
let TEST_ALL = false;
/** Whether any of today's games is in its sandbox. */
export const testingAll = () => !!daily.TEST || Object.values(C).some(m => m && m.testing());
/** Every game fresh in its sandbox (on), or all back to the real day (off). */
export function testAll(on) {
  TEST_ALL = !!on;
  if (!daily.setTest(TEST_ALL) && TEST_ALL) daily.ensure().then(() => { if (TEST_ALL && !daily.TEST) daily.setTest(true); }, () => {});
  Object.values(C).forEach(m => { if (m) m.setTest(TEST_ALL); });
}
const boardOf = m => safe(() => [m.boardState()])[0] || 'loading';
// A season's word on its card (the season screen's verdicts, views/seventeen.js, cut to a headline).
const SEASON = [[17, 'Perfect season'], [16, 'One from perfect'], [14, 'A juggernaut'], [11, 'Playoff team'], [8, 'On the bubble'], [5, 'Rebuilding year'], [0, 'Top-three pick']];
function seventeenState() {
  const sv = C.sv;
  if (!sv) return {kind: 'new'};
  const n = sv.todayNumber(), day = sv.dayState(n), test = sv.testing();
  const rows = boardOf(sv) === 'ready' ? safe(() => sv.boardRows('today', n)).map(r => ({...r, val: `${r.w}–${r.l}`})) : [];
  const mine = rows.find(r => r.me);
  const res = day.played || (!test && mine ? {w: mine.w, l: mine.l, ppg: mine.p} : null);
  if (!res) {
    const k = day.pick.filter(x => x != null).length;
    return k ? {kind: 'started', test, meta: `<p class="gm-note">${esc(`${k} of 5 picked`)}</p>`} : {kind: 'new', test};
  }
  return {kind: 'done', test, board: boardOf(sv), rows, gold: res.w === 17,
    vis: tileHTML(`${res.w}–${res.l}`, 'record', res.w === 17 ? 'is-gold' : ''),
    head: SEASON.find(([w]) => res.w >= w)[1],
    lines: [`${(Number(res.ppg) || 0).toFixed(1)} points a game`],
    actions: [{label: 'See your season', kind: 'secondary', attrs: {'data-gm-open': '17-0'}}]};
}
function drillState() {
  const dr = C.dr;
  if (!dr) return {kind: 'new'};
  const n = dr.todayNumber(), day = dr.dayState(n), test = dr.testing();
  const rows = boardOf(dr) === 'ready' ? safe(() => dr.boardRows(n)).map(r => ({...r, val: `${r.r} ${r.u}–${r.h}`})) : [];
  const mine = rows.find(r => r.me);
  if (!day.result && !(mine && !test)) {
    return day.acts ? {kind: 'started', test, meta: '<p class="gm-note">Under way. Pick up where you left off.</p>'}
      : {kind: 'new', test};
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
  if (!K) return {kind: 'new'};
  const n = K.todayNumber(), day = K.dayState(n), test = K.testing();
  const rows = boardOf(K) === 'ready' ? safe(() => K.boardRows(n)).map(r => ({...r, val: String(r.m)})) : [];
  const mine = rows.find(r => r.me);
  const off = day.official || (!test && mine ? {made: mine.m, longest: mine.l} : null);
  if (!off) {
    return day.list.length ? {kind: 'started', test, meta: `<p class="gm-note">${esc(`${day.made} made, ${day.missed} missed so far`)}</p>`}
      : {kind: 'new', test};
  }
  return {kind: 'done', test, board: boardOf(K), rows,
    vis: tileHTML(String(off.made), 'made'),
    head: plural(off.made, 'field goal'), lines: [off.longest ? `Longest ${off.longest} yds` : 'No makes today'],
    actions: [{label: 'See your kicks', kind: 'secondary', attrs: {'data-gm-open': 'kick'}}]};
}
function returnState() {
  // Return Man is replayed as often as you like (the owner's ask, Oct 2026): its case keeps its front, opened to Start again,
  // your best today (and where it puts you) under the shelf; the scoreboard is on its page.
  // Its case turns round too, played today or not (turns: the owner's ask, Oct 22 2026, for everyone: "the game is
  // repeatable"): today's leaderboard on its back (shelfTurner's .is-turns), standing on its front to play.
  const RM = C.rm;
  if (!RM) return {kind: 'new'};
  const n = RM.todayNumber(), day = RM.dayState(n), test = RM.testing(), board = boardOf(RM);
  const rows = board === 'ready' ? safe(() => RM.boardRows(n)).map(r => ({...r, val: nf(r.y)})) : [];
  const mine = rows.find(r => r.me), best = day.official ? day.official.yards : !test && mine ? mine.y : null;
  const back = {turns: true, board, rows, tag: 'TODAY',
    vis: best == null ? '' : tileHTML(nf(best), 'yds'),
    head: best == null ? 'No runs yet today' : 'Your best today', lines: best == null ? ['Run it back as often as you like'] : []};
  if (RM.live(n)) return {kind: 'started', test, meta: '<p class="gm-note">A return under way.</p>', ...back};
  if (best == null) return {kind: 'new', test, ...back};
  const place = mine && !test ? ` · ${ui.ordinal(mine.rank)} of ${rows.length} today` : '';
  return {kind: 'new', test, again: true, played: true, meta: `<p class="gm-note">${esc(`Your best today: ${nf(best)} yards${place}`)}</p>`, ...back};
}
function keepState() {
  // The existing first-visit marker follows the same saved realm. This is a persistent game: no daily final,
  // countdown or league board, and showing its case never starts or mutates the realm.
  return {kind: ui.lsGet('gg-realm-seen') === '1' ? 'started' : 'new',
    meta: '<p class="gm-note">Raise your Castle. Train your army. Defend your realm.</p>'};
}
const STATE = {puzzles: puzzlesState, '17-0': seventeenState, drill: drillState, kick: kickState, return: returnState, keep: keepState};

// ============================================================================ The cases
// The list is a shelf of game cases (the owner's ask, Oct 2026, after a console's shelf of box art): you swipe along
// it; the case in the middle is the one you're on, its Play under it. Each case is a green case, the Gridiron Hub
// band across its top and the game's cover under it (the owner's art). Played today, a case turns round:
// its back is the leaderboard. Tap the back and it comes up close, Today's and the Season's to switch between.
// ACCENT: each game's colour on its back (the tag, the switch), out of its cover.
const ACCENT = {puzzles: '#B5452F', '17-0': '#A0721F', drill: '#D23B2F', kick: '#C9A227', return: '#A31F34', keep: '#AEB9BD'};
// The band: the name in the middle, a BETA tag at its left end for a game still being worked on, a tag or the close
// button at its right.
const bandHTML = (end = '', beta = false) => `<span class="gm-band">${beta ? '<span class="gm-beta">BETA</span>' : ''}<span class="gm-band-t">GRIDIRON HUB</span>${end}</span>`;
const tileHTML = (big, small, cls = '') => `<span class="gm-tile ${cls}"><b class="n2">${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span>`;
// A line under each row: what it was today, or over the season.
const SUB_TODAY = {
  puzzles: r => r.sub || '',
  '17-0': r => `${(Number(r.p) || 0).toFixed(1)} points a game`,
  drill: r => (r.grade != null ? `Call grade ${Math.round(r.grade)}` : ''), // (its letter is by the score)
  kick: r => (r.l ? `Longest ${r.l} yds` : ''),
  return: r => (r.td ? plural(r.td, 'touchdown') : '') // (one kickoff a day: its yards are the row's)
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
const isKeepCase = g => g.id === 'keep' && features.available();
const GLOSS = '<span class="gm-z-gl" aria-hidden="true"></span>'; // (the shine on a case up close)
/** A case's sides, its name down the spine (views/game-case.js: the case is solid, turned on the shelf or up close). */
const sidesHTML = g => shellHTML(`<span class="gm-spine"><b>GRIDIRON HUB</b><span>${esc(g.name)}</span></span>`);
/** A case's front: the band, the cover (a sticker on it while it's under way). up: the case up close (a tap on it
 *  opens it, a shine moves over it as it turns). */
function frontHTML(g, s, up = false) {
  const stk = s.test ? sticker('is-test', 'TEST PLAY') : s.kind === 'started' ? sticker('is-go', 'IN PROGRESS') : '';
  return `<div class="gm-face gm-front${up ? ' gm-z-front" data-gm-zfront aria-hidden="true' : ''}">${bandHTML('', g.beta)}<span class="gm-art"><img class="gm-img" src="${g.art}" alt="" decoding="async" draggable="false">${stk}</span>${up ? `<span class="gm-z-foot"><i></i>${ui.icon('football')}</span>${GLOSS}` : ''}</div>`;
}
/** A board row. who: a tap shows the row's team (17-0's board up close: a button, data-gm-who its key). */
function rowHTML(r, {sub = false, who = false} = {}) {
  const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}${r.guest ? ', guest' : ''}: ${r.val}${r.letter ? `, grade ${r.letter}` : ''}${sub && r.sub ? `. ${r.sub}` : ''}`;
  // a graded game (the Two-Minute Drill) shows its letter by the score, coloured as on the drill's own board
  const grade = r.letter ? `<span class="gm-r-gr is-${esc(String(r.letter)[0])}" aria-hidden="true">${esc(r.letter)}</span>` : '';
  const open = who && r.key
    ? `<div class="gm-r-w" role="listitem"><button type="button" class="gm-r is-tap${r.me ? ' is-me' : ''}" data-gm-who="${esc(r.key)}" aria-label="${esc(`${label}. Show ${r.me ? 'your' : 'their'} team.`)}">`
    : `<div class="gm-r${r.me ? ' is-me' : ''}" role="listitem" aria-label="${esc(label)}">`;
  return open
    + `<span class="gm-r-rk${r.rank <= 3 ? ' is-r' + r.rank : ''}" aria-hidden="true">${r.rank}</span>`
    + `<span class="gm-r-av" aria-hidden="true">${ui.nickAvatar(r.name, {size: sub ? 30 : 22, managerId: r.managerId || null, you: r.me})}</span>`
    + `<span class="gm-r-nm" aria-hidden="true"><span class="gm-r-t">${esc(r.name)}${r.me ? ' <i class="gm-r-you">YOU</i>' : r.guest ? ' <i class="gm-r-you is-g">GUEST</i>' : ''}</span>${sub && r.sub ? `<span class="gm-r-s">${esc(r.sub)}</span>` : ''}</span>`
    + `${grade}<span class="gm-r-v" aria-hidden="true">${esc(r.val)}</span>${who && r.key ? '</button></div>' : '</div>'}`;
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
/** A case's back: the band, the result, today's leaderboard (no name: the owner's ask, Oct 2026, for the room; the
 *  case's label still says it, and up close it's in the band). */
function backHTML(g, s) {
  const place = placeText(s), note = boardNote(s.board, s.rows || []);
  const rows = note || `<div class="gm-scr-rows" role="list" aria-label="Today’s leaderboard">${miniRows(s.rows, 5).map(r => (r ? rowHTML(r) : '<div class="gm-r-gap" aria-hidden="true">· · ·</div>')).join('')}</div>`;
  return `<div class="gm-face gm-back" style="--gc:${ACCENT[g.id]}">${bandHTML(`<span class="gm-bk-tag">${s.test ? 'TEST' : s.tag || 'FINAL'}</span>`, g.beta)}`
    + `<span class="gm-bk-in">`
    + `<span class="gm-bk-res"><span class="gm-bk-vis">${s.vis || ''}</span><span class="gm-bk-tt"><b class="gm-bk-h${s.gold ? ' is-gold' : ''}">${esc(s.head || '')}</b>`
    + `${(s.lines || []).map(l => `<small>${esc(l)}</small>`).join('')}${place ? `<em>${esc(place)}</em>` : ''}</span></span>`
    + `<span class="gm-scr"><span class="gm-scr-h">Today’s leaderboard</span>${rows}</span>`
    + `<span class="gm-bk-foot"><span class="gm-bk-tap">Tap for the full leaderboard ›</span></span></span></div>`;
}
/** Keepfall has a printed back in every play state, never a league scoreboard. */
function keepBackHTML(g, up = false) {
  return `<div class="gm-face gm-back gm-keep-back${up ? ' gm-z-back' : ''}">${bandHTML()}
    <span class="gm-keep-print">
      <span class="gm-keep-hero"><img src="${g.book}" alt="" decoding="async" draggable="false">
        <span class="gm-keep-pitch"><strong>YOUR REALM.<br>YOUR RULE.</strong><span>Raise your Castle. Rally your army.<br>Defend what is yours.</span></span>
      </span>
      <span class="gm-keep-scenes"><img src="img/games/keep-back-scenes-v1.webp" alt="A sunlit castle, an army under red banners, and a dragon above snowy ramparts" decoding="async" draggable="false">
        <span class="gm-keep-captions"><b>BUILD</b><b>COMMAND</b><b>CONQUER</b></span>
      </span>
      <span class="gm-keep-signature"><span aria-hidden="true">✧</span><strong>KEEPFALL</strong><small>A kingdom worth fighting for.</small></span>
      <span class="gm-keep-footer"><b>1 PLAYER</b><span>STRATEGY · FANTASY</span><i class="gm-keep-barcode" aria-hidden="true"></i></span>
    </span>${up ? GLOSS : ''}</div>`;
}
const caseLabel = (g, s) => {
  const name = `${g.name}${g.beta ? ' (beta)' : ''}`;
  if (s.kind === 'done') return `${name}: played today${placeText(s) ? `, ${placeText(s)}` : ''}. Show the leaderboard`;
  return `${name}${s.kind === 'started' ? ', under way' : ''}${s.kind === 'loading' || s.kind === 'error' ? '' : '. Open the case to play'}`;
};
/** A case's faces: its front, and its back when it has one (a game finished; one that turns before it's played). */
const facesHTML = (g, s) => sidesHTML(g) + frontHTML(g, s) + (isKeepCase(g) ? keepBackHTML(g) : s.kind === 'done' || s.turns ? backHTML(g, s) : '');
function caseHTML(g, s, i, n, clone) {
  const done = s.kind === 'done';
  const what = caseLabel(g, s);
  const slot = clone ? 'aria-hidden="true" data-gm-clone' : `role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}"`;
  return `<div class="gm-slot" ${slot} data-gm-slot="${g.id}">`
    + `<button type="button" class="gm-case${done ? ' is-done' : s.turns ? ' is-turns' : ''}${isKeepCase(g) ? ' is-swivel' : ''}" data-gm="${g.id}" data-kind="${s.kind}" aria-label="${esc(what)}"${clone ? ' tabindex="-1"' : ''}>`
    + `<span class="gm-flip">${facesHTML(g, s)}</span><span class="gm-gloss" aria-hidden="true"></span>`
    + ['t', 'b', 'l', 'r'].map(k => `<span class="gm-grip is-${k}" aria-hidden="true"></span>`).join('') + `</button></div>`; // (views/game-case.js shelfTurner)
}

// ---------------------------------------------------------------- What's under the shelf: the game you're on
// (no Play here: a game starts from its case, the owner's ask, Oct 2026; a line under the shelf says so)
function ctaHTML(s) {
  if (s.kind === 'loading') return `<div class="gm-ctas">${ui.button({label: 'Loading puzzles', kind: 'primary', block: true, disabled: true, cls: 'gm-cta'})}</div>`;
  if (s.kind === 'error') return `<div class="gm-ctas">${ui.button({label: 'Try again', kind: 'primary', block: true, attrs: {'data-gm-retry': ''}, cls: 'gm-cta'})}</div>`;
  return `<p class="gm-cd gm-tap">${ui.icon('play-fill', {size: 15})}<span>Tap the case to play</span></p>` + flipHTML(s);
}
// (a case that turns before it's played, Return Man: a button under it turns it round to its leaderboard and back, the
// owner's ask, Oct 22 2026, his profile only: "Add a view scoreboard or flip case button"; mountList's syncFlip keeps
// its words to the side the case is on)
const flipHTML = s => (s.turns && s.kind !== 'done' && features.available()
  ? `<div class="gm-flipw">${ui.button({label: 'View scoreboard', kind: 'secondary', size: 's', icon: 'trophy', attrs: {'data-gm-flip': '', 'aria-pressed': 'false'}, cls: 'gm-flipb'})}</div>` : '');
function cdHTML(g) {
  if (g.id === 'puzzles' && newDay()) return `<div class="gm-cdw">${countdownHTML(true)}</div>`;
  return `<p class="gm-cd">${ui.icon('clock', {size: 15})}<span>${esc(g.cd)} <span class="gm-cd-v" data-gm-cd>${esc(ui.untilText(msToMidnight()))}</span></span></p>`;
}
function newDay() { try { return ready() && daily.checkDay(); } catch (_) { return false; } }
function selHTML(g, s) {
  const done = s.kind === 'done';
  // (no words over the buttons, the owner's ask, Oct 2026: the case says the game and, played, the result; the name
  // stays for screen readers). A game played today has no buttons here: its case's back is the leaderboard, a tap
  // on it brings the whole board up close (with the way into the game's own page).
  return `<h2 class="sr-only">${esc(g.name)}</h2>`
    + (!done && s.meta ? `<div class="gm-meta">${s.meta}</div>` : '')
    + (done ? cdHTML(g) : ctaHTML(s));
}
function stateOf(g) {
  try { return STATE[g.id](); } catch (e) { console.error(e); return {kind: 'new'}; }
}
/** The shelf as it stands now (the cores that haven't loaded yet show Play). It goes round in a circle (the owner's
 *  ask, Oct 2026): the games three times over, the real ones in the middle and a copy each side (data-gm-clone, hidden
 *  from screen readers), so past the last game comes the first again; mountList moves you back to the middle row
 *  whenever the shelf comes to rest out on a copy. */
export function listHTML() {
  const list = gamesFor(), states = list.map(stateOf);
  const row = clone => list.map((g, i) => caseHTML(g, states[i], i, list.length, clone)).join('');
  return `<div class="gm-list" data-key="games" data-enter data-ids="${list.map(g => g.id).join(' ')}">`
    + `<div class="gm-shelf" data-hscroll role="region" aria-roledescription="carousel" aria-label="Daily games: swipe across" tabindex="0">`
    + row(true) + row(false) + row(true) + `</div>`
    + `<div class="gm-pips" aria-hidden="true">${list.map((g, i) => `<i class="gm-pip${states[i].kind === 'done' || states[i].played ? ' is-done' : ''}" data-gm-pip="${g.id}"></i>`).join('')}</div>`
    + `<div class="gm-sel" data-gm-sel aria-live="polite">${selHTML(list[0], states[0])}</div></div>`;
}

// ============================================================================ Behavior
const SHELF_KEY = 'gg-shelf';
/** Wires the shelf in el: the cores load at idle; refresh(animate) brings every case (and what's under the shelf) up to
 *  date (a game just finished turns its case round), tick() moves the countdown. opts.play(id): open a game. */
export function mountList(el, ctx, opts = {}) {
  // st.cur: the slot in the middle, counting every copy (slots()); its game is list()[st.cur % n()]
  const st = {dead: false, cur: 0, zoom: null, raf: 0, saved: 0, settle: 0, touch: false, owner: null, assets: null, styles: []};
  const shelf = el.querySelector('.gm-shelf'), sel = el.querySelector('[data-gm-sel]');
  const turner = shelfTurner(shelf, {rest: () => syncFlip()}); // (a case grabbed by its edge turns where it stands)
  const list = () => gamesFor().filter(g => el.querySelector(`.gm-slot[data-gm-slot="${g.id}"]`));
  const slots = () => [...el.querySelectorAll('.gm-slot')];
  const n = () => Math.max(1, list().length);
  const curCase = id => { const sl = slots()[st.cur]; return sl && sl.dataset.gmSlot === id ? sl.querySelector('.gm-case') : el.querySelector(`.gm-slot:not([data-gm-clone]) .gm-case[data-gm="${id}"]`); };
  const shown = new Map(); // id → the markup its case shows
  // Owner preview: request the new styles and launch module only for Evan's profile.
  // Removing the links and cancelling the overlay also handles profile changes from another tab.
  function syncOwner() {
    const owner = features.available();
    if (st.owner === owner) return;
    if (st.zoom) closeZoom(true);
    st.owner = owner;
    el.classList.toggle('gm-owner', owner);
    st.styles.forEach(({link, cancel}) => { cancel(); link.remove(); });
    st.styles = [];
    st.assets = null;
    if (!owner) return;
    const css = ['game-case-owner', 'game-case-controls', 'game-launch'].map(name => new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL(`../../css/views/${name}.css`, import.meta.url).href;
      let timer;
      const done = ok => { clearTimeout(timer); link.onload = link.onerror = null; resolve(ok); };
      link.onload = () => done(true);
      link.onerror = () => done(false);
      timer = setTimeout(() => done(false), 5000);
      st.styles.push({link, cancel: () => done(false)});
      document.head.appendChild(link);
    }));
    st.assets = Promise.all([import('./game-launch.js'), ...css]).then(([mod, ...ready]) => ready.every(Boolean) ? mod : null).catch(() => null);
  }
  const unprofile = data.subscribe(type => { if (type === 'me' && !st.dead) refresh(false); });
  syncOwner();
  const sig = (g, s) => `${isKeepCase(g) ? keepBackHTML(g) : ''}|${s.kind}|${s.test ? 1 : 0}|${s.again ? 1 : 0}|${s.meta || ''}|${s.kind === 'done' ? backHTML(g, s) : frontHTML(g, s)}${s.turns ? '|' + backHTML(g, s) : ''}`; // (Return Man: its front stays, its line under the shelf and its back move)
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
    if (best !== st.cur) {
      const was = st.cur;
      st.cur = best;
      if (was < 0 || was % n() !== best % n()) setCur(best % n());
      // a case turned in your hand goes back the way it stands once it's no longer the one in the middle
      const off = was >= 0 && slots()[was];
      if (off) turner.home(off.querySelector('.gm-case'));
    }
  };
  // Straight to a place on the shelf, nothing to see in between. The snapping is off for the moment it takes: Safari
  // otherwise puts a snapping scroller back on the case it last came to rest on (so the shelf could start out on the
  // copy at the far left, with nothing before it, and go round one way only).
  const jumpTo = left => {
    shelf.style.scrollSnapType = 'none';
    shelf.scrollLeft = left;
    void shelf.scrollLeft; // (taken before the snapping comes back)
    requestAnimationFrame(() => { shelf.style.scrollSnapType = ''; });
  };
  // Round the circle: at rest on a copy, the same case in the middle row takes its place (no movement to see: the
  // copies look the same). Never under a finger, and not before the shelf has stopped.
  const settle = () => {
    st.settle = 0;
    if (st.dead || st.touch || !shelf.clientWidth) return;
    layout();
    const k = n(), j = st.cur;
    if (j < 0 || (j >= k && j < 2 * k)) return;
    const all = slots(), to = k + (j % k);
    if (!all[j] || !all[to]) return;
    jumpTo(shelf.scrollLeft + all[to].offsetLeft - all[j].offsetLeft);
    st.cur = to;
    layout();
  };
  const onScroll = () => {
    if (!st.raf) st.raf = requestAnimationFrame(layout);
    clearTimeout(st.settle);
    st.settle = setTimeout(settle, 140);
    clearTimeout(st.saved);
    st.saved = setTimeout(() => { const g = list()[st.cur % n()]; if (g) try { sessionStorage.setItem(SHELF_KEY, g.id); } catch (_) {} }, 200);
  };
  const onDown = () => { st.touch = true; };
  const onUp = () => { st.touch = false; clearTimeout(st.settle); st.settle = setTimeout(settle, 140); };
  function setCur(i, animate = true) {
    const g = list()[i];
    if (!g) return;
    el.querySelectorAll('[data-gm-pip]').forEach(p => p.classList.toggle('is-cur', p.dataset.gmPip === g.id));
    const html = selHTML(g, stateOf(g));
    if (sel.dataset.html === html) { syncFlip(); return; }
    const go = () => { sel.dataset.html = html; sel.innerHTML = html; ui.hydrate(sel); syncFlip(); };
    if (animate && ctx.visible && !ui.RM) ui.crossfade(sel, go, {duration: 140}); else go();
  }
  // The flip button under a case that turns (flipHTML) says what it'll do: to the scoreboard, or back to the cover
  // (and a tap on the case, turned round, brings the whole board up close)
  function syncFlip() {
    const b = sel.querySelector('[data-gm-flip]');
    if (!b || st.dead) return;
    const g = list()[st.cur % n()], cs = g && curCase(g.id), on = !!cs && turner.back(cs);
    if (b.getAttribute('aria-pressed') === String(on)) return;
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('.btn-label').textContent = on ? 'Flip to the cover' : 'View scoreboard';
    b.querySelector('use')?.setAttribute('href', on ? '#i-swap' : '#i-trophy');
    const tap = sel.querySelector('.gm-tap span');
    if (tap) tap.textContent = on ? 'Tap the case for the whole board' : 'Tap the case to play';
  }
  // i: a slot, counting every copy
  const center = (i, smooth = true) => {
    const sl = slots()[i];
    if (!sl) return;
    const left = sl.offsetLeft + sl.offsetWidth / 2 - shelf.clientWidth / 2;
    if (smooth && !ui.RM) shelf.scrollTo({left, behavior: 'smooth'}); else jumpTo(left);
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
      + (note || `<div class="gm-scr-rows" role="list" aria-label="${mode === 'season' ? 'The season' : 'Today'}">${rows.map(r => rowHTML(r, {sub: true, who: g.id === '17-0'})).join('')}</div>`)
      + (g.id === '17-0' && mode === 'today' ? bestHTML() : '');
  }
  // Under 17-0's Today up close, the board's best possible team (the owner's ask, Oct 2026; the case is up close only
  // once you've played, so it gives nothing away): its five players and its season; a tap shows it whole.
  function bestHTML() {
    const sv = C.sv;
    if (!sv) return '';
    let b, top, s;
    try { b = sv.board(sv.todayNumber()); top = sv.best(b); s = sv.season(b, top.pick); } catch (e) { console.error(e); return ''; }
    const last = n => { const i = String(n).indexOf(' '); return i < 0 ? String(n) : n.slice(i + 1); };
    const names = top.pick.map((r, c) => last(sv.card(b, c, r).n)).join(' · ');
    const sub = `${s.ppg.toFixed(1)} points a game · $${sv.cost(b, top.pick)} team`;
    return `<p class="gm-z-me gm-z-bh">Best possible team</p>`
      + `<button type="button" class="gm-r is-tap gm-z-best" data-gm-best aria-label="${esc(`The best possible team: ${names}. ${sv.rec(s)}, ${sub}. Show it.`)}">`
      + `<span class="gm-r-rk" aria-hidden="true">${ui.icon('trophy')}</span>`
      + `<span class="gm-r-nm" aria-hidden="true"><span class="gm-r-t">${esc(names)}</span><span class="gm-r-s">${esc(sub)}</span></span>`
      + `<span class="gm-r-v${s.w === 17 ? ' is-gold' : ''}" aria-hidden="true">${esc(sv.rec(s))}</span></button>`;
  }
  // The whole board fits on the back (the owner's ask, Oct 2026: no scrolling, a finger anywhere but the Today / Season
  // switch turns the case): the rows come down in size till they fit, then lose their lines under the names.
  function fitBoard(body) {
    if (!body) return;
    body.classList.remove('is-tight');
    body.style.removeProperty('--zr');
    const over = () => body.scrollHeight > body.clientHeight + 1;
    if (!body.clientHeight || !over()) return;
    let r = 1;
    const shrink = min => { for (let i = 0; i < 6 && over() && r > min; i++) { r = Math.max(min, r * body.clientHeight / body.scrollHeight - .01); body.style.setProperty('--zr', r.toFixed(3)); } };
    shrink(.74);
    if (!over()) return;
    body.classList.add('is-tight');
    r = 1;
    body.style.removeProperty('--zr');
    shrink(.45);
  }
  // The case up close (the owner's ask, Oct 2026): a real case to turn in your hand (views/game-case.js), its back the
  // whole board, its front the cover; turned to the front it opens, the disc inside. play: a game not played yet, to
  // start: it comes up facing front (no back to turn to) and opens, Start in the tray's top right over the disc.
  // The owner's launch control sits directly below the case, at full touch size even when the case scales.
  const goLabel = s => (s.kind === 'started' ? 'Continue' : 'Start');
  const ownerGoHTML = (g, s) => `<button type="button" class="gm-z-go" data-gm-zgo disabled aria-label="${esc(`${goLabel(s)}: ${g.name}`)}">`
    + `${ui.icon('play-fill')}<span class="gm-z-go-word" aria-hidden="true">${goLabel(s)}</span></button>`;
  function caseUpHTML(g, s, play = false) {
    // (the game's name up in the black band, where the cover has GRIDIRON HUB: the owner's ask, Oct 2026)
    const band = `<span class="gm-band is-z">${g.beta ? '<span class="gm-beta">BETA</span>' : ''}<span class="gm-bk-name" id="gm-z-t">${esc(g.name)}</span>`
      + `<span class="gm-bk-tag">${s.test ? 'TEST' : s.tag || 'FINAL'}</span></span>`;
    const back = isKeepCase(g) ? keepBackHTML(g, true) : play ? '' : `<div class="gm-face gm-back gm-z-back">${band}<div class="gm-bk-in">`
      + `<div class="gm-bk-res"><span class="gm-bk-vis">${s.vis || ''}</span><span class="gm-bk-tt"><b class="gm-bk-h${s.gold ? ' is-gold' : ''}">${esc(s.head || '')}</b>${(s.lines || []).map(l => `<small>${esc(l)}</small>`).join('')}</span></div>`
      + `<div class="gm-z-tog" role="tablist" aria-label="Leaderboard"><button type="button" role="tab" aria-selected="true" data-gm-zmode="today">Today</button><button type="button" role="tab" aria-selected="false" data-gm-zmode="season">Season</button></div>`
      + `<div class="gm-scr is-z"><div class="gm-z-body" data-gm-zbody>${zoomBody(g, 'today')}</div></div></div>${GLOSS}</div>`;
    // its sides (the spine with the name down it), the tray inside with the disc on its hub, the cover on its hinge
    // (the cover outside, inside the booklet held in by two clips)
    const img = src => `<img src="${src}" alt="" decoding="async" draggable="false">`;
    const sides = sidesHTML(g);
    const inside = `<div class="gm-z-tray" aria-hidden="true"><span class="gm-z-emb">GRIDIRON HUB</span></div>`
      + `<div class="gm-z-disc" data-gm-zdisc aria-hidden="true"><span class="gm-z-lab">${img(g.disc)}</span><span class="gm-z-sheen"></span></div>`
      + `<span class="gm-z-hub" aria-hidden="true"></span>`
      + (play && !features.available() ? `<button type="button" class="gm-z-go" data-gm-zgo disabled aria-label="${esc(`${goLabel(s)} ${g.name}`)}">${ui.icon('play-fill')}<span>${goLabel(s)}</span></button>` : '');
    const lid = `<div class="gm-z-lid">${frontHTML(g, s, true)}`
      + `<div class="gm-z-in" aria-hidden="true"><span class="gm-z-bk"><span class="gm-z-book">${img(g.book)}</span>`
      + `<span class="gm-z-clip is-t"></span><span class="gm-z-clip is-b"></span></span></div></div>`;
    return `<div class="gm-z-stage" style="--gc:${ACCENT[g.id]}"><div class="gm-z-obj">${back}${sides}${inside}${lid}</div></div>`;
  }
  const HINT = {back: 'Drag to turn it · it opens from the front', front: 'Tap the cover to open it', open: 'Tap the case to close it'};
  // board: a game that turns before it's done (Return Man, s.turns) up close by its back, the whole board, as a
  // finished one comes up; opened from its front it comes up again to play (replay), Start inside.
  function openZoom(id, {board = false} = {}) {
    syncOwner();
    const g = byId(id), cs = curCase(id);
    if (!g || !gameOpen(id) || st.zoom) return;
    const s = stateOf(g), replay = board && !!s.turns && s.kind !== 'done', play = s.kind !== 'done' && !replay, keep = isKeepCase(g);
    const hints = keep ? {back: 'Drag or turn over to see the cover', front: 'Drag to turn · tap the cover to open', open: 'Ready to play · drag or turn over to see the back'} : play ? {front: HINT.front, open: features.available() ? 'Ready to play' : `Press ${goLabel(s)} to play`}
      : replay ? {...HINT, back: 'Drag to turn it · open it from the front to play', front: 'Tap the cover to play'}
      : id === '17-0' ? {...HINT, back: 'Tap a name for their team · drag to turn it'} : HINT;
    const z = document.createElement('div');
    const owner = features.available();
    z.className = `gm-zoom${owner ? ' gm-owner' : ''}${owner && play ? ' gm-has-play' : ''}`;
    z.innerHTML = `<div class="gm-z-scrim" data-gm-zclose></div>`
      + `<div class="gm-z-dlg" role="dialog" aria-modal="true" ${owner ? `aria-label="${esc(g.name)} game case"` : 'aria-labelledby="gm-z-t"'} tabindex="-1">`
      + ui.iconButton({icon: 'close', label: 'Close', cls: 'gm-z-x', filled: true, attrs: 'data-gm-zclose'})
      + caseUpHTML(g, s, play)
      + (owner && play ? ownerGoHTML(g, s) : '')
      + `<div class="gm-z-ctl">${play && !keep ? '' : ui.button({label: 'Turn over', kind: 'secondary', size: 's', icon: 'swap', attrs: 'data-gm-zturn'})}`
      + `${ui.button({label: 'Open the case', kind: 'secondary', size: 's', attrs: 'data-gm-zlid', disabled: !play})}</div>`
      + `<p class="gm-z-hint" data-gm-zhint>${play ? hints.front : hints.back}</p></div>`;
    (document.getElementById('overlays') || document.body).appendChild(z);
    ui.hydrate(z);
    const dlg = z.querySelector('.gm-z-dlg'), stage = z.querySelector('.gm-z-stage'), app = document.getElementById('app');
    const lidBtn = z.querySelector('[data-gm-zlid]'), hint = z.querySelector('[data-gm-zhint]'), goBtn = z.querySelector('[data-gm-zgo]');
    const turnBtn = z.querySelector('[data-gm-zturn]');
    // what the case can do now: open (facing front), close (open), neither (turned away); Start only while it's open.
    // Open, the one button under it is a small red Close Case (the owner's ask, Oct 2026)
    const said = ({front, open}) => {
      lidBtn.disabled = !open && !front;
      lidBtn.querySelector('.btn-label').textContent = open ? 'Close Case' : 'Open the case';
      lidBtn.classList.toggle('is-close', open);
      if (turnBtn) turnBtn.hidden = open && !keep;
      hint.textContent = hints[open ? 'open' : front ? 'front' : 'back'];
      if (goBtn) goBtn.disabled = !open;
    };
    const T = turnable(z, dlg, said, {still: play && !keep, front: play, closeOnDrag: keep, compact: owner});
    st.zoom = {el: z, id, mode: 'today', play, owner, launching: false, launch: null, launchTimer: 0, app, prev: app ? app.inert : false, turn: T, fit: () => fitBoard(z.querySelector('[data-gm-zbody]')),
      n: history.state && history.state.n, team: false};
    st.zoom.fit();
    addEventListener('resize', st.zoom.fit, {passive: true});
    if (app && !z.closest('#app')) app.inert = true;
    // from the case on the shelf up to the middle of the screen
    if (cs && !ui.RM) {
      const a = cs.getBoundingClientRect(), b = stage.getBoundingClientRect();
      const sx = a.width / b.width, sy = a.height / b.height, dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
      ui.animate(stage, [{transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: .6}, {transform: 'none', opacity: 1}], {duration: 420, easing: 'cubic-bezier(.22,1,.36,1)'});
      ui.animate(z.querySelector('.gm-z-scrim'), [{opacity: 0}, {opacity: 1}], {duration: 300, easing: 'linear'});
      [z.querySelector('.gm-z-ctl'), hint, z.querySelector('.gm-z-x')].forEach(el => ui.animate(el, [{opacity: 0}, {opacity: 1}], {duration: 260, delay: 220, easing: 'linear', fill: 'backwards'}));
    }
    // a game to start: the touch on its front that brought it up opens it, once it's up
    if (play) setTimeout(() => { if (st.zoom && st.zoom.turn === T) T.lid(true); }, cs && !ui.RM ? 380 : 0);
    const start = async () => {
      const Z = st.zoom;
      if (!Z || Z.el !== z || Z.launching || st.dead || ctx.visible === false) return;
      if (owner && !features.available()) { closeZoom(true); return; }
      ui.haptic('light');
      if (!owner) { closeZoom(true); if (opts.play) opts.play(id); return; }
      Z.launching = true;
      T.stop();
      dlg.focus({preventScroll: true});
      if (goBtn) { goBtn.disabled = true; goBtn.setAttribute('aria-busy', 'true'); }
      lidBtn.disabled = true;
      hint.textContent = `Preparing ${g.name}…`;
      const finish = () => {
        if (st.zoom !== Z || st.dead || ctx.visible === false || !features.available() || !z.isConnected) return;
        closeZoom(true);
        if (opts.play) opts.play(id);
      };
      // Artwork/network trouble must never strand the player behind a loading screen.
      const mod = await Promise.race([st.assets, new Promise(resolve => { Z.launchTimer = setTimeout(() => resolve(null), 1500); })]);
      clearTimeout(Z.launchTimer);
      if (st.zoom !== Z || st.dead || ctx.visible === false || !features.available() || !z.isConnected) return;
      if (!mod) { finish(); return; }
      try { Z.launch = mod.launchGame({host: z, game: g, reducedMotion: ui.RM, onComplete: finish}); }
      catch (_) { finish(); }
    };
    // (replay: opened from its front, it comes up again to play, the case on the shelf back on its front)
    const toPlay = () => { closeZoom(true); const c = curCase(id); if (c) turner.home(c); openZoom(id); };
    z.addEventListener('click', e => {
      if (e.target.closest('[data-gm-zclose]')) { closeZoom(); return; }
      if (st.zoom?.launching) return;
      if (replay && (e.target.closest('[data-gm-zlid]') || (T.state.front && !T.state.open && e.target.closest('[data-gm-zfront]')))) { toPlay(); return; }
      if (e.target.closest('[data-gm-zgo]')) { if (T.state.open) start(); return; }
      if (e.target.closest('[data-gm-zturn]')) { T.turn(1); return; }
      if (e.target.closest('[data-gm-zlid]')) { T.lid(); return; }
      const who = e.target.closest('[data-gm-who], [data-gm-best]');
      if (who) {
        const key = who.dataset.gmWho, mode = st.zoom.mode === 'season' ? 'all' : 'today';
        if (!T.state.front && !T.state.open) overCase((m, n, o) => (key ? m.showTeam(key, mode, n, o) : m.showBest(n, o)));
        return;
      }
      const m = e.target.closest('[data-gm-zmode]');
      if (m) {
        if (m.dataset.gmZmode === st.zoom.mode) return;
        st.zoom.mode = m.dataset.gmZmode;
        z.querySelectorAll('[data-gm-zmode]').forEach(b => b.setAttribute('aria-selected', String(b === m)));
        const body = z.querySelector('[data-gm-zbody]');
        const go = () => { body.innerHTML = zoomBody(g, st.zoom.mode); ui.hydrate(body); fitBoard(body); };
        if (!ui.RM) ui.crossfade(body, go, {duration: 140}); else go();
        ui.haptic('selection');
        return;
      }
      // open, a tap on the disc gives it a spin, anywhere else on the case shuts it; shut, a tap on the cover opens it
      if (T.state.open) {
        const lab = e.target.closest('[data-gm-zdisc]') && z.querySelector('.gm-z-lab');
        if (lab) { if (!ui.RM) ui.animate(lab, [{transform: 'rotate(0deg)'}, {transform: 'rotate(360deg)'}], {duration: 1100, easing: 'cubic-bezier(.15,.7,.3,1)'}); ui.haptic('light'); }
        else if (e.target.closest('.gm-z-obj')) T.lid(false);
        return;
      }
      if (e.target.closest('[data-gm-zfront]')) T.lid(true);
    });
    z.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeZoom(); return; }
      if (owner && e.key === 'Tab') {
        const buttons = [...dlg.querySelectorAll('button:not(:disabled):not([hidden])')].filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden');
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (first && ((!e.shiftKey && (e.target === last || e.target === dlg)) || (e.shiftKey && (e.target === first || e.target === dlg)))) {
          e.preventDefault(); (e.shiftKey ? last : first).focus();
        }
      }
      if (st.zoom?.launching) return;
      if (e.target !== dlg) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); T.turn(e.key === 'ArrowLeft' ? -1 : 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (play && T.state.open) start(); else if (replay && T.state.front) toPlay(); else T.lid(); }
    });
    dlg.focus({preventScroll: true});
    ui.haptic('light');
  }
  // A name on 17-0's board up close: that person's team (views/seventeen.js's sheet, the one its own scoreboard opens);
  // the best possible team: its sheet. Over the case, the case left as it was under it. open(m, n, o): the sheet from
  // views/seventeen.js m for today's board n, o its options.
  function overCase(open) {
    const Z = st.zoom;
    if (!Z || !C.sv) return;
    import('./seventeen.js').then(m => {
      if (st.zoom !== Z) return;
      const sh = open(m, C.sv.todayNumber(), {onClose: () => { Z.el.inert = false; }});
      if (!sh) return;
      // (sheets stack from z-index 1 in the overlays; the case up close sits at 900)
      sh.el.style.zIndex = '902';
      if (sh.el.previousElementSibling) sh.el.previousElementSibling.style.zIndex = '901';
      Z.el.inert = true;
      Z.team = true;
    }).catch(e => console.error(e));
  }
  function closeZoom(fast) {
    const Z = st.zoom;
    if (!Z) return;
    const restoreFocus = !fast;
    st.zoom = null;
    clearTimeout(Z.launchTimer);
    if (Z.launch) Z.launch.cancel();
    if (Z.launching) fast = true;
    if (Z.app) Z.app.inert = Z.prev;
    Z.turn.stop();
    removeEventListener('resize', Z.fit);
    const cs = curCase(Z.id), stage = Z.el.querySelector('.gm-z-stage');
    if (fast || ui.RM || !cs || !stage) { Z.el.remove(); if (cs && restoreFocus) cs.focus({preventScroll: true}); return; }
    // shut and turned round to its back (as it stands on the shelf) on its way back down
    const obj = Z.el.querySelector('.gm-z-obj'), lid = Z.el.querySelector('.gm-z-lid'), rest = Z.turn.rest();
    [[obj, rest.obj], [lid, rest.lid]].forEach(([el, to]) => {
      const from = el.style.transform;
      el.style.transform = to;
      if (from && from !== to) ui.animate(el, [{transform: from}, {transform: to}], {duration: 300, easing: 'cubic-bezier(.4,0,.6,1)'});
    });
    const a = cs.getBoundingClientRect(), b = stage.getBoundingClientRect();
    const sx = a.width / b.width, sy = a.height / b.height, dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    ui.animate(Z.el.querySelector('.gm-z-scrim'), [{opacity: 1}, {opacity: 0}], {duration: 260, easing: 'linear'});
    [Z.el.querySelector('.gm-z-ctl'), Z.el.querySelector('.gm-z-hint'), Z.el.querySelector('.gm-z-x')].forEach(el => ui.animate(el, [{opacity: 1}, {opacity: 0}], {duration: 140, easing: 'linear', fill: 'forwards'}));
    const an = ui.animate(stage, [{transform: 'none', opacity: 1}, {transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: .4}], {duration: 320, easing: 'cubic-bezier(.4,0,.6,1)'});
    const done = () => { Z.el.remove(); cs.focus({preventScroll: true}); };
    if (an && an.finished) an.finished.then(done, done); else setTimeout(done, 320);
  }
  // ---------------------------------------------------------------- taps, keys
  const onClick = e => {
    if (e.target.closest('[data-gm-flip]')) { // (the case in the middle turns round, and back)
      const g = list()[st.cur % n()], c = g && curCase(g.id);
      if (c && turner.flip(c) != null) { ui.haptic('light'); syncFlip(); }
      return;
    }
    const cs = e.target.closest('.gm-case[data-gm]');
    if (!cs) return;
    const i = slots().indexOf(cs.closest('.gm-slot'));
    if (i >= 0 && i !== st.cur) { ui.haptic('selection'); center(i); return; }
    if (cs.dataset.kind === 'loading') return;
    if (cs.dataset.kind === 'error') { const b = sel.querySelector('[data-gm-retry]'); if (b) b.click(); return; }
    // (played: its board; not yet: it opens, Start inside; Return Man turned round to its back: its board)
    openZoom(cs.dataset.gm, {board: cs.classList.contains('is-turns') && turner.back(cs)});
  };
  const onKey = e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    center(st.cur + (e.key === 'ArrowLeft' ? -1 : 1)); // round the circle (settle brings it back to the middle row)
  };
  shelf.addEventListener('scroll', onScroll, {passive: true});
  shelf.addEventListener('pointerdown', onDown, {passive: true});
  shelf.addEventListener('touchstart', onDown, {passive: true});
  addEventListener('pointerup', onUp, {passive: true});
  addEventListener('touchend', onUp, {passive: true});
  addEventListener('touchcancel', onUp, {passive: true});
  if ('onscrollend' in shelf) shelf.addEventListener('scrollend', onUp);
  shelf.addEventListener('keydown', onKey);
  el.addEventListener('click', onClick);
  const onResize = () => { center(st.cur, false); layout(); };
  addEventListener('resize', onResize, {passive: true});
  // (a team sheet opened over the case pushes a history entry: its back comes down to where the case was opened, and
  // leaves the case up)
  const onPop = e => {
    const Z = st.zoom;
    if (Z && Z.team && e && e.state && Z.n != null && e.state.n === Z.n) return;
    closeZoom(true);
  };
  addEventListener('popstate', onPop);
  addEventListener('hashchange', onPop);
  // where you were on the shelf, else the first game you haven't played today
  const start = () => {
    let id = null;
    try { id = sessionStorage.getItem(SHELF_KEY); } catch (_) {}
    const gs = list();
    let i = gs.findIndex(g => g.id === id);
    if (i < 0) i = Math.max(0, gs.findIndex(g => stateOf(g).kind !== 'done'));
    center(n() + i, false); // in the middle row
    st.cur = -1;
    layout();
    // and still there once the page has settled (fonts, the covers, the panel under the shelf): back to the middle
    // row if anything moved it out to a copy
    [400, 1200].forEach(ms => setTimeout(settle, ms));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(settle, 50), () => {});
  };
  requestAnimationFrame(start);

  const refresh = (animate = true) => {
    if (st.dead) return;
    syncOwner();
    // A profile change can add or remove Keepfall, including from a hidden shelf.
    const ids = gamesFor().map(g => g.id).join(' ');
    if (el.dataset.ids !== ids) {
      const t = document.createElement('div');
      t.innerHTML = listHTML();
      el.dataset.ids = ids;
      shelf.innerHTML = t.querySelector('.gm-shelf').innerHTML;
      el.querySelector('.gm-pips').innerHTML = t.querySelector('.gm-pips').innerHTML;
      sel.innerHTML = t.querySelector('[data-gm-sel]').innerHTML;
      delete sel.dataset.html;
      shown.clear();
      ui.hydrate(shelf);
      if (gameOpen('return')) { coresAsked = false; loadCores(() => refresh(true)); }
      requestAnimationFrame(start);
      return;
    }
    list().forEach((g, i) => {
      const css = [...el.querySelectorAll(`.gm-case[data-gm="${g.id}"]`)]; // the game and its copies
      if (!css.length) return;
      const s = stateOf(g), key = sig(g, s);
      if (shown.get(g.id) === key) return;
      shown.set(g.id, key);
      css.forEach(cs => {
        const flipNow = s.kind === 'done' && cs.dataset.kind !== 'done';
        cs.dataset.kind = s.kind;
        const fl = cs.querySelector('.gm-flip');
        fl.innerHTML = facesHTML(g, s);
        cs.classList.toggle('is-swivel', isKeepCase(g));
        ui.hydrate(fl);
        cs.classList.toggle('is-turns', !!s.turns && s.kind !== 'done');
        // a game just finished: its case turns round to the leaderboard
        if (flipNow && animate && ctx.visible && !ui.RM) requestAnimationFrame(() => requestAnimationFrame(() => cs.classList.add('is-done')));
        else cs.classList.toggle('is-done', s.kind === 'done');
        cs.setAttribute('aria-label', caseLabel(g, s));
      });
      const pip = el.querySelector(`[data-gm-pip="${g.id}"]`);
      if (pip) pip.classList.toggle('is-done', s.kind === 'done' || !!s.played);
      if (i === st.cur % n()) setCur(i, animate);
    });
    if (st.zoom && !st.zoom.play) {
      const body = st.zoom.el.querySelector('[data-gm-zbody]'), g = byId(st.zoom.id), html = zoomBody(g, st.zoom.mode);
      if (body && body.dataset.html !== html) { body.dataset.html = html; body.innerHTML = html; ui.hydrate(body); fitBoard(body); }
    }
  };
  list().forEach(g => shown.set(g.id, sig(g, stateOf(g))));
  ui.whenIdle(() => loadCores(() => refresh(true)));
  const tick = () => {
    const t = ui.untilText(msToMidnight());
    el.querySelectorAll('[data-gm-cd]').forEach(v => { if (v.textContent !== t) v.textContent = t; });
  };
  return {refresh, tick, hide() { if (st.zoom?.owner) closeZoom(true); }, destroy() {
    st.dead = true;
    closeZoom(true);
    unprofile();
    st.styles.forEach(({link, cancel}) => { cancel(); link.remove(); });
    st.styles = [];
    st.assets = null;
    el.classList.remove('gm-owner');
    turner.stop();
    clearTimeout(st.settle);
    shelf.removeEventListener('scroll', onScroll);
    shelf.removeEventListener('pointerdown', onDown);
    shelf.removeEventListener('touchstart', onDown);
    shelf.removeEventListener('scrollend', onUp);
    removeEventListener('pointerup', onUp);
    removeEventListener('touchend', onUp);
    removeEventListener('touchcancel', onUp);
    shelf.removeEventListener('keydown', onKey);
    el.removeEventListener('click', onClick);
    removeEventListener('resize', onResize);
    removeEventListener('popstate', onPop);
    removeEventListener('hashchange', onPop);
    if (st.raf) cancelAnimationFrame(st.raf);
  }};
}
