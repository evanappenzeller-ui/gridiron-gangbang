// NFL Pick'em (#/pickem, optional ?week=N): pick the winner of every real NFL game of the week. The Pick'em tab's root
// (tabs-v4: links to /pickem switch to the tab; nothing pushes it any more). Owner: SHELL (was PICKEM-VIEWS).
//   Large title (eyebrow "NFL · Week 4", your avatar button trailing) · sticky week chips (week 1 through the current
//   one) · summary card (your progress, your record, next kickoff or games live, the week's leader; opens the
//   leaderboard) · games grouped by
//   slot (Thursday night, Sunday morning (international), Sunday early, Sunday late, Sunday night, Monday night),
//   each a card: away and home as two big tap targets with logos, records and the kickoff in local time; after
//   kickoff a lock, the live score and clock, then Final with your pick marked right or wrong, the pick split bar and
//   who picked whom (sheet). Previous weeks are read-only results. Leaderboard sheet: This week / Season.
//   Pick, then submit: a tap drafts a pick on this phone (dashed, "Not submitted"; kept in localStorage per week, see
//   Drafts) and the Submit bar above the tab bar sends every change at once (week.submitPicks). Only submitted picks
//   count anywhere: the summary, others' counts, the reveal, grading and the leaderboard.
//   Lock in (this week only): once you have a pick, "Lock in" (the summary's lock-ins row; a lock at the end of the
//   Submit bar submits first) makes the week's picks final after a confirm sheet ("Which one are you?" first when this
//   phone never said: a lock binds your manager on every phone; drafts are submitted first and the lock only goes in
//   when every one did: week.lockPicks). Locked: the cards stop taking taps, no Submit bar, no tab dot; Undo for
//   week.LOCK_UNDO_MS (week.unlockPicks). The same row says how many have locked in ("5 of 12 locked in": a sheet of
//   who has and hasn't) and the week's leaderboard marks them; nobody's picks show early either way.
// Speed: the screen stays mounted while another tab shows (patched in place when shown again, never a skeleton once
//   it has had data), week.js keeps the week's picks listener open a minute after the screen stops following it,
//   and the current week's games and your side of its picks are kept on this phone ('gg-pk-last', Last-known week)
//   so a cold open paints at once and refreshes underneath. warm() (app.js, at idle) finds the week ahead of a visit.
// Data: js/core/nfl.js (ESPN scoreboard: scoreboard, currentWeek, watch) and js/core/week.js (pickemWeek,
//   subscribeNflPicks, pickChanges, submitPicks, lockPicks, unlockPicks, nflWeekResults, nflStandings). Nothing here
//   writes anywhere but through week.js (dev hosts save to its local stand-in).
// Exports: badge() (the tab bar's dot: open games you haven't submitted a pick for, or unsubmitted drafts; never
//   while you are locked in; from the last-known week on a cold open; a 'gg:badge' event when it may have changed)
//   and badgeText() (its label), warm(), drafts / pruneDrafts() / badgeFrom() / cacheSave() / cacheLoad() / lockIns()
//   (checks-pickem.js tests them), and for other screens summarize(), leaderText(), follow(), currentWeek(),
//   logoURL(), kickText(), recText().
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as week from '../core/week.js';
import * as nfl from '../core/nfl.js';
import {youButtonHTML} from './you.js';

// Two leagues, one screen: this module is the NFL pick'em, and the same file loaded again as './pickem.js?sport=cfb'
// is the College pick'em (ESPN's Top 25 games; nfl.cfb, week.js's 'cfb' sport): a second module instance with its
// own state, caches and keys. The NFL instance's default export (the Pick'em tab's view) shows one of the two and
// switches between them with the NFL / College tabs under the large title (see "League switch" at the bottom).
export const SPORT = new URL(import.meta.url).searchParams.get('sport') === 'cfb' ? 'cfb' : 'nfl';
const CFB = SPORT === 'cfb';
const FEED = CFB ? nfl.cfb : nfl;
const LEAGUE = CFB ? 'College' : 'NFL';
const SFX = CFB ? '-cfb' : ''; // localStorage keys of the college instance

const esc = data.esc;
const PICK_OFF = "Pick'em isn't switched on yet.";
const LOCKED_MSG = 'That game has kicked off. Picks are locked.';
const TBD_MSG = "No kickoff time yet. This game takes picks again once it's set.";
const SUBMIT_FAIL = "Couldn't save your pick. Try again.";
const OFF_NOTE = "Kept on this phone. Saved once pick'em is switched on.";
const LOCK_OFF = "Locking isn't switched on yet.";
const LOCK_FAIL = "Couldn't lock in. Try again.";
const lockedMsg = w => `Your picks are locked in for week ${w}.`;
const URGENT_MS = 60 * 60e3; // the Submit bar turns urgent this long before a drafted game kicks off
const WEEKS = FEED.REG_WEEKS; // regular season
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const andJoin = l => l.length < 2 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const nowMs = () => { try { return typeof week.now === 'function' ? +week.now() : Date.now(); } catch (_) { return Date.now(); } };
const toMs = t => t == null ? 0 : typeof t === 'number' ? t : t instanceof Date ? t.getTime()
  : typeof t.toMillis === 'function' ? t.toMillis() : typeof t.seconds === 'number' ? t.seconds * 1000 : (+new Date(t) || 0);

// ============================================================================ Time
const clean = s => String(s).replace(/[  ]/g, ' ');
const fmtCache = new Map();
function fmt(o) {
  const k = JSON.stringify(o);
  let f = fmtCache.get(k);
  if (!f) { try { f = new Intl.DateTimeFormat('en-US', o); } catch (_) { f = new Intl.DateTimeFormat('en-US', Object.assign({}, o, {timeZone: undefined})); } fmtCache.set(k, f); }
  return f;
}
const dayShort = d => clean(fmt({weekday: 'short'}).format(d));
const timeShort = d => clean(fmt({hour: 'numeric', minute: '2-digit'}).format(d));
const dateShort = d => clean(fmt({month: 'short', day: 'numeric'}).format(d));
/** "Thu 5:15 PM" (with the date when it is more than 6 days away). */
export function kickText(d, at = nowMs()) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const far = Math.abs(d.getTime() - at) > 6 * 864e5;
  return far ? `${dayShort(d)}, ${dateShort(d)} · ${timeShort(d)}` : `${dayShort(d)} ${timeShort(d)}`;
}
// NFL slots are Eastern-time conventions (1 PM early window, 4 PM late, 8 PM night).
function etParts(d) {
  try {
    const p = fmt({timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23'}).formatToParts(d);
    const g = t => (p.find(x => x.type === t) || {}).value;
    return {dow: g('weekday'), h: +g('hour') % 24};
  } catch (_) {
    const u = new Date(d.getTime() - 4 * 36e5);
    return {dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][u.getUTCDay()], h: u.getUTCHours()};
  }
}
const DAY_NAME = {Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday'};
// A game without a set time (ESPN: timeValid false) sits at a placeholder, midnight Eastern on its Sunday: never
// shown as a kickoff. Those games get their own slot after the dated ones.
const TBD_SLOT = {key: 'tbd', label: 'Time TBD'};
function slotOf(g) {
  if (g.tbd) return TBD_SLOT;
  const {dow, h} = etParts(g.kickoff);
  // College: Saturday's noon, afternoon and night windows (Eastern); other days by name.
  if (CFB) {
    if (dow === 'Sat') return h < 15 ? {key: 'sat-noon', label: 'Saturday early'} : h < 19 ? {key: 'sat-pm', label: 'Saturday afternoon'} : {key: 'sat-night', label: 'Saturday night'};
    return {key: dow || 'x', label: `${DAY_NAME[dow] || 'Games'}${h >= 19 ? ' night' : ''}`};
  }
  if (dow === 'Sun') {
    if (h < 12) return {key: 'sun-am', label: 'Sunday morning'};
    if (h < 16) return {key: 'sun-early', label: 'Sunday early'};
    if (h < 19) return {key: 'sun-late', label: 'Sunday late'};
    return {key: 'sun-night', label: 'Sunday night'};
  }
  if (dow === 'Thu') return h >= 19 ? {key: 'thu-night', label: 'Thursday night'} : {key: 'thu', label: 'Thursday'};
  if (dow === 'Mon') return {key: 'mon', label: 'Monday night'};
  return {key: dow || 'x', label: DAY_NAME[dow] || 'Games'};
}

// ============================================================================ Games (normalized from nfl.js)
const STATES = ['pre', 'in', 'post'];
function normTeam(t) {
  if (!t) return null;
  const abbr = String(t.abbr || t.abbreviation || '').toUpperCase().slice(0, 6);
  const sc = t.score;
  return {
    abbr, name: String(t.name || t.displayName || abbr), short: String(t.short || t.shortName || t.shortDisplayName || t.name || abbr),
    logo: typeof t.logo === 'string' ? t.logo : '', score: sc == null || sc === '' || !isFinite(+sc) ? null : +sc,
    winner: t.winner === true, record: typeof t.record === 'string' ? t.record : '',
    rank: Number.isInteger(t.rank) && t.rank >= 1 && t.rank <= 25 ? t.rank : null
  };
}
// nfl.js games: {id, kickoff, tbd, state, status, detail, period, clock, final, tie, winner: 'home'|'away'|null,
// home, away, neutral, site, city, country, intl, note, tv}. Copied into the plain shape the markup relies on.
function normGame(g) {
  if (!g || g.id == null || !g.home || !g.away) return null;
  const k = g.kickoff instanceof Date ? g.kickoff : new Date(g.kickoff || g.date);
  if (isNaN(k)) return null;
  const home = normTeam(g.home), away = normTeam(g.away);
  if (!home.abbr || !away.abbr) return null;
  const state = STATES.includes(g.state) ? g.state : 'pre';
  const final = g.final != null ? !!g.final : state === 'post' && !/postpon|cancel|suspend/i.test(String(g.detail || ''));
  let winner = g.winner === 'home' || g.winner === 'away' ? g.winner : home.winner ? 'home' : away.winner ? 'away' : null;
  if (!final) winner = null;
  // off: over without a result (postponed, suspended, canceled: ESPN sends state 'post' and scores of 0). over: done
  // for good (final or canceled; a postponed game can come back).
  const off = state === 'post' && !final;
  const over = state === 'post' && (final || /cancel/i.test(String(g.status || '') + ' ' + String(g.detail || '')));
  return {id: String(g.id), kickoff: k, tbd: !!g.tbd, state, final, off, over, winner, detail: String(g.detail || ''),
    period: g.period != null && isFinite(+g.period) ? +g.period : null, clock: typeof g.clock === 'string' ? g.clock : '',
    // ESPN capitalizes connecting words in some venue cities ("Rio De Janeiro").
    line: g.line && typeof g.line === 'object' && (g.line.fav === 'home' || g.line.fav === 'away' || g.line.fav === null) && isFinite(+g.line.pts)
      ? {fav: g.line.fav, pts: +g.line.pts, text: String(g.line.text || '')} : null,
    home, away, where: g.intl ? String(g.city || g.intl).replace(/ (De|Da|Do|Del|La) /g, m => m.toLowerCase()) : '', tv: typeof g.tv === 'string' ? g.tv : ''};
}
function normBoard(b) {
  if (!b) return null;
  const games = (Array.isArray(b.games) ? b.games : []).map(normGame).filter(Boolean).sort((x, y) => x.kickoff - y.kickoff || x.id.localeCompare(y.id));
  return {year: +b.year || null, week: +b.week || null, games, stale: !!b.stale, error: b.error || null};
}
const lockedGame = (g, at = nowMs()) => !!g && (g.state !== 'pre' || at >= g.kickoff.getTime());
// A game without a set time stops taking picks 36 hours before its placeholder kickoff (week.pickDeadline: the rules
// would refuse the pick), until ESPN sets the time. Not locked: it hasn't kicked off.
const tbdShut = (g, at = nowMs()) => {
  if (!g || !g.tbd || lockedGame(g, at)) return false;
  let d = null;
  try { d = typeof week.pickDeadline === 'function' ? week.pickDeadline(g) : null; } catch (_) { d = null; }
  return d != null && at >= d;
};
// Open for picks (and drafts that can be submitted): not kicked off, and not a time-TBD game past its early lock.
const pickable = (g, at = nowMs()) => !lockedGame(g, at) && !tbdShut(g, at);
// The winning team's abbreviation once a game is final; null before, and for a tie or a game that never finished.
const winnerOf = g => g && g.state === 'post' && g.final && g.winner ? g[g.winner].abbr : null;
// Scores show while a game is on and once it is final; a game that never finished shows none (ESPN sends 0–0).
const showScore = g => g.state === 'in' || (g.state === 'post' && g.final);
const scoreLine = g => `${g.away.short} ${g.away.score ?? 0}, ${g.home.short} ${g.home.score ?? 0}`;
export const recText = r => String(r || '').replace(/-/g, '–');

// Team logos: ESPN's 500 px logos are 4096 px PNGs (300-500 KB each). The combiner resizes them on ESPN's side
// (about 5 KB) and the 500-dark set reads on the app's dark surfaces (Cowboys, Giants, Jets, Titans...).
export function logoURL(t, px = 64) {
  // College logos are by ESPN team id ('/teamlogos/ncaa/500/251.png').
  const nc = t && typeof t.logo === 'string' ? /\/teamlogos\/ncaa\/500(?:-dark)?\/(\d+)\.png/i.exec(t.logo) : null;
  if (nc) return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${nc[1]}.png&h=${Math.round(px)}&w=${Math.round(px)}`;
  if (CFB) return '';
  const abbr = t && t.abbr ? String(t.abbr).toLowerCase().replace(/[^a-z]/g, '') : '';
  const m = t && typeof t.logo === 'string' ? /\/teamlogos\/nfl\/500(?:-dark)?\/(?:scoreboard\/)?([a-z]+)\.png/i.exec(t.logo) : null;
  const slug = (m && m[1].toLowerCase()) || abbr;
  if (!slug) return '';
  const s = Math.round(px);
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500-dark/scoreboard/${slug}.png&h=${s}&w=${s}`;
}
function logoHTML(t, size = 32, cls = '') {
  const src = logoURL(t, size * 2);
  return `<span class="c-pk-logo${cls ? ' ' + cls : ''}" style="--lg:${size}px" aria-hidden="true">`
    + (src ? `<img src="${esc(src)}" alt="" width="${size}" height="${size}" decoding="async" referrerpolicy="no-referrer" draggable="false">` : '')
    + `<b>${esc(t ? t.abbr : '')}</b></span>`;
}

// ============================================================================ Picks (from week.subscribeNflPicks)
function myUid() { try { return typeof week.myUid === 'function' ? week.myUid() : null; } catch (_) { return null; } }
// Your submitted picks in a snapshot, as the server has confirmed them ({gameId: team}): a submit still on its way
// shows in snap.mine at once (Firestore's local echo), but only counts once the server has it (snap.saved).
const savedOf = snap => (snap && (snap.saved || snap.mine)) || {};
// A picker as drawn: their manager when `me` is one, else their nick on a neutral initials disc.
function who(v) {
  v = v || {};
  const w = v.who && typeof v.who === 'object' ? Object.assign({}, v.who, {you: v.you != null ? v.you : v.who.you}) : v;
  const id = w.me && data.M[w.me] ? w.me : (w.managerId && data.M[w.managerId] ? w.managerId : null);
  const nick = typeof w.nick === 'string' && w.nick.trim() ? w.nick.trim() : typeof w.name === 'string' ? w.name.trim() : typeof v.who === 'string' ? v.who.trim() : '';
  const uid = myUid();
  const you = w.you === true || (!!uid && w.uid === uid) || (!!id && id === data.me());
  return {id, name: id ? data.name(id) : (nick || 'Someone'), you, key: id ? 'm:' + id : 'u:' + (w.uid || nick)};
}
const whoAvatar = (w, size, o = {}) => w.id ? ui.avatar(w.id, Object.assign({size, you: w.you}, o)) : ui.nickAvatar(w.name, Object.assign({size, you: w.you}, o));
const stackItem = w => w.id ? {id: w.id, you: w.you} : {nick: w.name, you: w.you};

// One pick per person per game (a manager on two phones counts once: their latest). -> Map(gameId -> Map(key -> pick))
function pickIndex(snap) {
  const out = new Map();
  (snap && Array.isArray(snap.picks) ? snap.picks : []).forEach(p => {
    if (!p || p.game == null || typeof p.team !== 'string') return;
    const w = who(p);
    const gid = String(p.game);
    let m = out.get(gid);
    if (!m) out.set(gid, m = new Map());
    const b = m.get(w.key);
    if (!b || toMs(p.at) >= toMs(b.p.at)) m.set(w.key, {p, w});
  });
  return out;
}

/**
 * The week at a glance, for the screen and any other screen that follows the week:
 * {n, picked, right, wrong, decided (final untied games), live, open (not kicked off), done (all final),
 *  next (Date of the next kickoff or null), allIn (every open game picked), leaders: [{w, right, wrong}], best,
 *  people (pickers seen so far), mineMap}
 * Your picks are the submitted ones the server has confirmed (savedOf); `mine` overrides them (the screen's
 * just-submitted picks).
 */
export function summarize(games, snap, {mine, at = nowMs()} = {}) {
  const G = (games || []).map(g => g && g.kickoff instanceof Date && g.home && g.home.abbr ? g : normGame(g)).filter(Boolean);
  const M = mine || savedOf(snap);
  let picked = 0, right = 0, wrong = 0, decided = 0, live = 0, open = 0, openPicked = 0, next = null;
  G.forEach(g => {
    const t = M[g.id];
    const mineOk = t === g.home.abbr || t === g.away.abbr;
    if (mineOk) picked++;
    // The next kickoff skips games whose time isn't set (their date is a placeholder).
    if (!lockedGame(g, at)) { open++; if (mineOk) openPicked++; if (!g.tbd && (!next || g.kickoff < next)) next = g.kickoff; }
    if (g.state === 'in') live++;
    const win = winnerOf(g);
    if (win) { decided++; if (mineOk) { if (t === win) right++; else wrong++; } }
  });
  // The league: right/wrong per person over decided games. week.js grades the week in the subscription (snap.rows:
  // one row per manager across phones, late picks dropped); the revealed picks are the fallback.
  let rows;
  if (snap && Array.isArray(snap.rows)) {
    rows = snap.rows.map(r => ({w: who(r), right: +r.right || 0, wrong: +r.wrong || 0, picked: +r.picked || 0}));
  } else {
    const idx = pickIndex(snap), m2 = new Map();
    G.forEach(g => {
      const win = winnerOf(g);
      (idx.get(g.id) || new Map()).forEach(({p, w}) => {
        let r = m2.get(w.key);
        if (!r) m2.set(w.key, r = {w, right: 0, wrong: 0, picked: 0});
        r.picked++;
        if (w.you) r.w.you = true;
        if (win) { if (p.team === win) r.right++; else r.wrong++; }
      });
    });
    rows = [...m2.values()];
  }
  const graded = rows.filter(r => r.right + r.wrong > 0).sort((x, y) => y.right - x.right || x.wrong - y.wrong || x.w.name.localeCompare(y.w.name));
  const best = graded.length && graded[0].right > 0 ? graded[0] : null;
  const leaders = best ? graded.filter(r => r.right === best.right && r.wrong === best.wrong) : [];
  const overOf = g => (g.over != null ? g.over : g.state === 'post' && (g.final || /CANCEL/.test(String(g.status || ''))));
  return {n: G.length, picked, right, wrong, decided, live, open, done: G.length > 0 && G.every(overOf),
    next, allIn: open > 0 && openPicked === open, leaders, best, people: rows.filter(r => r.picked > 0).length, mineMap: M};
}
/** "Mitch leads at 8–1" / "Mitch and you lead at 8–1" / "Mitch won the week at 12–4". '' when nothing is graded. */
export function leaderText(s, {done} = {}) {
  if (!s || !s.leaders.length) return '';
  const names = s.leaders.map(r => r.w.you ? 'you' : r.w.name);
  const list = names.length > 3 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : andJoin(names);
  const rec = `${s.best.right}–${s.best.wrong}`;
  if (done || s.done) return `${cap(list)} ${names.length > 1 ? 'tied for the week' : 'won the week'} at ${rec}`;
  return `${cap(list)} ${names.length > 1 || names[0] === 'you' ? 'lead' : 'leads'} at ${rec}`;
}

// ============================================================================ Following a week (the screen, others)
// Module memo: the last board and picks per week, so a re-mounted screen paints at once (nfl.js keeps its own caches).
const memo = {cur: null, boards: new Map(), snaps: new Map()};
const wkey = (y, w) => `${y}-w${w}`;
let curP = null, curT = 0;
/** The pick'em week (nfl.js / week.js decide: the current ESPN week, or the next one once every game is final). */
export function currentWeek(force) {
  if (!force && curP && Date.now() - curT < 60e3) return curP;
  curT = Date.now();
  // Asked at once, not a tick later: nfl.js then knows a current-week request is out before anything asks it for the
  // week's scores (the watch follow() starts from the last-known week), and serves both from that one request.
  let p;
  try { p = Promise.resolve(typeof week.pickemWeek === 'function' ? week.pickemWeek(SPORT) : FEED.currentWeek()); } catch (e) { p = Promise.reject(e); }
  curP = p.then(r => {
    if (!r || !isFinite(+r.week)) throw new Error('No pick\'em week');
    memo.cur = {year: +r.year, week: +r.week};
    drafts.sweep(memo.cur);
    if (Array.isArray(r.games)) { const b = normBoard(r); if (b.games.length || !memo.boards.has(wkey(b.year, b.week))) memo.boards.set(wkey(memo.cur.year, memo.cur.week), b); }
    return memo.cur;
  });
  curP.catch(() => { curP = null; });
  return curP;
}
function seasonYear() {
  if (memo.cur) return memo.cur.year;
  const s = data.SEASONS && data.SEASONS.find(x => x.live);
  if (s) return s.year;
  const d = new Date();
  return d.getMonth() < 2 ? d.getFullYear() - 1 : d.getFullYear();
}

// ============================================================================ Last-known week (this phone)
// The current week's games and your side of its picks as this phone last saw them, kept in localStorage so a cold
// open paints the screen (and the tab dot) at once and refreshes underneath (stale-while-revalidate):
// {v, k: '2026-w4', year, week, at (saved), board: {games}, snap}. board: the screen's own normalized games; snap:
// what the screen reads of a subscription payload (your submitted picks, the counts and the picks the reveal rule
// already shows, the week's table, the locks). Read back as `cached`: a cached board's live dots rest, and a cached
// snap is never taken for an answer about drafts (sweepDrafts waits for the server). Not read back once it is more
// than 8 days old or its games are over (the pick'em has moved on to the next slate).
const LAST_KEY = 'gg-pk-last' + SFX, LAST_V = 1;
const SNAP_KEEP = ['key', 'year', 'week', 'mine', 'saved', 'byGame', 'rows', 'count', 'locks', 'lockedMe', 'lockedCount', 'locksError'];
/** Keep a week ({year, week, board, snap}) on this phone. -> saved (false when storage refuses). */
export function cacheSave({year, week: w, board, snap}, key = LAST_KEY) {
  if (!board || !Array.isArray(board.games) || !board.games.length) return false;
  const s = {};
  if (snap) SNAP_KEEP.forEach(f => { if (snap[f] !== undefined) s[f] = snap[f]; });
  if (s.lockedMe && s.lockedMe.pending) s.lockedMe = null; // a lock on its way doesn't outlive the page (nor its write)
  const games = board.games.map(g => Object.assign({}, g, {kickoff: g.kickoff instanceof Date ? g.kickoff.toISOString() : g.kickoff}));
  let v;
  try { v = JSON.stringify({v: LAST_V, k: wkey(year, w), year, week: w, board: {games}, snap: snap ? s : null}); } catch (_) { return false; }
  // Nothing new (the same week as kept, whenever it was saved): left alone, not written again.
  const was = ui.lsGet(key);
  if (was && was.replace(/,"at":\d+\}$/, '}') === v) return true;
  return ui.lsSet(key, v.slice(0, -1) + `,"at":${Date.now()}}`);
}
/** The week kept on this phone -> {year, week, board (cached), snap (cached, or null)} or null. */
export function cacheLoad(key = LAST_KEY, at = Date.now()) {
  let o = null;
  try { o = JSON.parse(ui.lsGet(key) || 'null'); } catch (_) { o = null; }
  if (!o || o.v !== LAST_V || !isFinite(+o.year) || !isFinite(+o.week) || o.k !== wkey(+o.year, +o.week) || !o.board || !Array.isArray(o.board.games)) return null;
  if (!(at - (+o.at || 0) < 8 * 864e5)) return null;
  const games = o.board.games.map(g => (g && typeof g.id === 'string' && g.home && g.away && g.home.abbr && g.away.abbr
    ? Object.assign({}, g, {kickoff: new Date(g.kickoff)}) : null));
  if (!games.length || games.some(g => !g || isNaN(g.kickoff))) return null;
  // Over, or surely over by now (8 hours after the last kickoff): the pick'em has moved on to the next slate.
  if (games.every(g => g.over) || at > Math.max(...games.map(g => g.kickoff.getTime())) + 8 * 3600e3) return null;
  const board = {year: +o.year, week: +o.week, games, stale: false, error: null, cached: true};
  const snap = o.snap && typeof o.snap === 'object' ? Object.assign({picks: [], byGame: {}, rows: [], locks: []}, o.snap, {cached: true, ready: false}) : null;
  return {year: +o.year, week: +o.week, board, snap};
}
// Read back once, when the module loads (app.js imports it at idle after launch): render() and badge() have the
// week before anything is fetched.
(function hydrate() {
  const c = cacheLoad();
  if (!c) return;
  const k = wkey(c.year, c.week);
  memo.cur = {year: c.year, week: c.week};
  memo.boards.set(k, c.board);
  if (c.snap) memo.snaps.set(k, c.snap);
})();
// Save the current week soon after it changes (coalesced), and on the way out. Only what the server has answered:
// the kept week itself (cached), a snapshot still waiting on the server and one with an error leave it alone.
let lastT = 0;
function keepLast(y, w) {
  if (!memo.cur || memo.cur.year !== y || memo.cur.week !== w || lastT) return;
  lastT = setTimeout(saveLast, 1000);
}
function saveLast() {
  clearTimeout(lastT); lastT = 0;
  const c = memo.cur;
  if (!c) return;
  const k = wkey(c.year, c.week), b = memo.boards.get(k), s = memo.snaps.get(k);
  if (!b || b.cached || !s || s.cached || s.error || s.ready === false) return;
  cacheSave({year: c.year, week: c.week, board: b, snap: s});
}
try { addEventListener('pagehide', () => { if (lastT) saveLast(); }); } catch (_) {}

/**
 * Follow a week's games (nfl.watch: live polling) and picks (week.subscribeNflPicks).
 * target: {year, week}, or null for the current pick'em week (re-resolved when that week is all final, so Tuesday
 * rolls over to the next slate). fn({year, week, board, snap, cur, error}) on every change. -> stop()
 */
export function follow(target, fn) {
  let dead = false, unW = null, unS = null, y = null, w = null, rollT = 0;
  const emit = (extra = {}) => {
    if (dead) return;
    const k = wkey(y, w);
    try { fn(Object.assign({year: y, week: w, board: memo.boards.get(k) || null, snap: memo.snaps.get(k) || null, cur: memo.cur}, extra)); } catch (e) { console.error(e); }
  };
  const stopInner = () => {
    if (unW) { try { unW(); } catch (_) {} unW = null; }
    if (unS) { try { unS(); } catch (_) {} unS = null; }
  };
  const start = (yy, ww) => {
    stopInner();
    y = yy; w = ww;
    const k = wkey(y, w);
    emit();
    try {
      unW = FEED.watch(y, w, b => {
        if (dead) return;
        const nb = normBoard(Object.assign({year: y, week: w}, Array.isArray(b) ? {games: b} : b));
        const old = memo.boards.get(k);
        // A failed poll keeps the last good games (nfl.js reports stale; never blank a painted slate).
        if (!nb.games.length && old && old.games.length && (nb.stale || nb.error)) memo.boards.set(k, Object.assign({}, old, {stale: true}));
        else memo.boards.set(k, nb);
        keepLast(y, w);
        emit();
        if (!target && nb.games.length && nb.games.every(g => g.state === 'post')) roll();
      });
    } catch (e) { console.error(e); emit({error: 'games'}); }
    try {
      if (typeof week.subscribeNflPicks === 'function') {
        unS = week.subscribeNflPicks(y, w, s => {
          if (dead || !s) return;
          // A listener the server hasn't answered yet (a cold open, or back after more than a minute away) knows less
          // than what is on screen (the last snapshot, or the week kept on this phone): that stays until it does.
          const prev = memo.snaps.get(k);
          if (s.ready === false && !s.error && prev && (prev.cached || prev.ready !== false)) return;
          memo.snaps.set(k, s);
          keepLast(y, w);
          emit();
        }, SPORT);
      }
    } catch (e) { console.error(e); }
  };
  // The followed current week finished: ask ESPN again (fresh), and move on once the pick'em week has; else try
  // again in 10 minutes (nothing polls a finished week).
  const roll = (ms = 1500) => {
    if (rollT || dead) return;
    rollT = setTimeout(() => {
      rollT = 0;
      Promise.resolve().then(() => FEED.currentWeek({fresh: true})).catch(() => null).then(() => currentWeek(true))
        .then(c => { if (dead) return; if (c.year !== y || c.week !== w) start(c.year, c.week); else roll(10 * 60e3); }, () => { if (!dead) roll(10 * 60e3); });
    }, ms);
  };
  // Finding the current week failed (ESPN unreachable, nothing saved): say so, then try again with a backoff (15 s,
  // 30 s, 1 min ... 5 min) and at once when the phone comes back online.
  let retryT = 0, tries = 0;
  const resolve = () => {
    retryT = 0;
    currentWeek(tries > 0).then(c => { tries = 0; if (!dead && (c.year !== y || c.week !== w)) start(c.year, c.week); },
      e => {
        if (dead) return;
        if (!tries) console.warn('pickem week', e);
        if (y == null) emit({error: 'week'});
        tries++;
        retryT = setTimeout(resolve, Math.min(300e3, 15e3 * 2 ** (tries - 1)));
      });
  };
  const onOnline = () => { if (!dead && retryT) { clearTimeout(retryT); resolve(); } };
  if (target) start(+target.year, +target.week);
  else {
    // The week is asked for first, then the last-known week (if any) paints and follows at once: its scores come from
    // the same ESPN request (nfl.scoreboard waits for a currentWeek() already out).
    const known = memo.cur;
    resolve();
    if (known && y == null) start(known.year, known.week);
    try { addEventListener('online', onOnline); } catch (_) {}
  }
  return () => {
    dead = true; clearTimeout(rollT); clearTimeout(retryT);
    try { removeEventListener('online', onOnline); } catch (_) {}
    stopInner();
  };
}

/**
 * At idle after launch (app.js): find the pick'em week and its games ahead of a first visit, the request the screen
 * would make on arrival anyway (nfl.js keeps it for minutes), so the first switch to the tab has nothing to wait for
 * and the tab dot knows which week it is. Picks come from the week kept on this phone until the screen follows it.
 */
export function warm() {
  // The College pick'em last chosen on this phone: its module and week too, so the tab opens on it at once.
  if (!CFB && host.sport === 'cfb') loadCfb().then(m => m.warm(), () => {});
  return currentWeek().then(() => { keepLast(memo.cur.year, memo.cur.week); armDrafts(); signalBadge(); }, () => {});
}

// ============================================================================ Screen state
// One Pick'em root exists (the tab), but each mounted screen keeps its own state (screens: ctx -> state; a retry
// builds a new screen before the old one goes). The helpers below all read `st`, the screen being worked on: every
// entry point (lifecycle hooks, events, timers, data callbacks) runs through on(state, fn), which points `st` at that
// screen for the call and restores it after.
let st = null;
const screens = new Map();
function on(s, fn) {
  if (!s || s.dead) return undefined;
  const prev = st;
  st = s;
  try { return fn(); } finally { st = prev; }
}

// ============================================================================ Drafts
// A tap drafts a pick on this phone; nothing is written until Submit (week.submitPicks). Drafts live in localStorage
// per week ('gg-pk-draft-2026-w4': {gameId: team | ''}, '' = clear the submitted pick), so leaving the screen or
// reloading never loses them; weeks before the current one are swept. A draft equal to the submitted pick is no change
// (week.pickChanges). A game that kicks off takes its draft with it: it never counts (sweepDrafts says which).
const DRAFT_KEY = 'gg-pk-draft-' + (CFB ? 'cfb-' : '');
const draftMem = new Map(); // '2026-w4' -> {gameId: team | ''}
function cleanDrafts(o) {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    Object.keys(o).forEach(id => { const t = o[id]; if (/^[0-9]{1,12}$/.test(id) && typeof t === 'string' && /^[A-Za-z0-9&-]{0,6}$/.test(t)) out[id] = t.toUpperCase(); });
  }
  return out;
}
/** The draft store: get(year, week, {fresh}) -> a copy; set(year, week, map) -> saved; sweep({year, week}). */
export const drafts = {
  key: (y, w) => DRAFT_KEY + wkey(y, w),
  get(y, w, {fresh} = {}) {
    const k = wkey(y, w);
    if (fresh || !draftMem.has(k)) {
      let o = null;
      try { o = JSON.parse(ui.lsGet(DRAFT_KEY + k) || 'null'); } catch (_) { o = null; }
      draftMem.set(k, cleanDrafts(o));
    }
    return Object.assign({}, draftMem.get(k));
  },
  set(y, w, map) {
    const k = wkey(y, w), o = cleanDrafts(map);
    draftMem.set(k, o);
    return ui.lsSet(DRAFT_KEY + k, Object.keys(o).length ? JSON.stringify(o) : null);
  },
  // Drafts of weeks before `cur` are gone for good (their games are over).
  sweep(cur) {
    if (!cur) return 0;
    let keys = [];
    try { keys = Object.keys(localStorage).filter(k => k.startsWith(DRAFT_KEY)); } catch (_) { keys = []; }
    let n = 0;
    keys.forEach(k => {
      const m = /^(\d{4})-w(\d{1,2})$/.exec(k.slice(DRAFT_KEY.length));
      if (m && (+m[1] < cur.year || (+m[1] === cur.year && +m[2] < cur.week))) { ui.lsSet(k, null); draftMem.delete(m[1] + '-w' + m[2]); n++; }
    });
    return n;
  }
};
// Save a week's drafts and tell everything that follows them (the tab dot, the kickoff timer).
function putDrafts(y, w, map) {
  drafts.set(y, w, map);
  signalBadge();
  armDrafts();
}
/**
 * What a week's drafts can still use -> {keep: {gameId: team | ''}, dropped: [game]}. Drafts for games that have
 * kicked off never count and go (`dropped`: those that were changes, for the toast naming them); so do drafts for
 * games no longer on the slate, and, once the submitted picks are known (saved not null), drafts equal to them.
 */
export function pruneDrafts(dr, games, saved, at = nowMs()) {
  const G = new Map((games || []).map(g => [String(g.id), g]));
  const ch = saved ? week.pickChanges(dr, saved) : null;
  const keep = {}, dropped = [];
  Object.keys(dr || {}).forEach(id => {
    const g = G.get(id);
    if (!g) return;
    if (lockedGame(g, at)) { if (ch && id in ch) dropped.push(g); return; }
    if (ch && !(id in ch)) return;
    keep[id] = dr[id];
  });
  return {keep, dropped};
}
// Your submitted picks for a week as this phone knows them: the subscription's, with a screen's just-submitted ones
// on top (until the snapshot shows them).
function savedFor(y, w) {
  const saved = Object.assign({}, savedOf(memo.snaps.get(wkey(y, w))));
  screens.forEach(s => {
    if (s.dead || s.year !== y || s.week !== w) return;
    s.pending.forEach((p, gid) => { if (p.team) saved[gid] = p.team; else delete saved[gid]; });
  });
  return saved;
}
const gameName = g => `${g.away.short} at ${g.home.short}`;
const teamOf = (g, abbr) => (g.home.abbr === abbr ? g.home : g.away.abbr === abbr ? g.away : null);
// Submits on their way, per week ('2026-w4' -> count): their drafts stay put until the answer (submit() settles them).
const sending = new Map();
// Drop what the current week's drafts can no longer use, with a toast naming the games that kicked off before their
// draft was submitted. Runs on every patch, on new data and at each drafted game's kickoff (armDrafts), whichever
// tab is showing.
function sweepDrafts() {
  const c = memo.cur;
  if (!c) return;
  const k = wkey(c.year, c.week);
  const b = memo.boards.get(k), snap = memo.snaps.get(k);
  if (!b || !b.games.length || sending.get(k)) return;
  const dr = drafts.get(c.year, c.week);
  const n = Object.keys(dr).length;
  if (!n) return;
  // Only once the picks are really known (not the first snapshot from the empty cache): a draft equal to what is
  // submitted is no loss, and a cold open after a kickoff still names the game. Until then a kicked-off game's draft
  // is simply ignored (vm).
  if (!snap || snap.ready === false || snap.error) return;
  const saved = savedFor(c.year, c.week);
  // Locked in (here, or on another of your phones; confirmed): nothing drafted can go in any more.
  if (snap.lockedMe && !snap.lockedMe.pending) {
    const lost = changesOf(b.games, dr, saved, nowMs());
    putDrafts(c.year, c.week, {});
    const cw = wordsOf(lost, saved);
    if (cw.n) ui.toast(`${lockedMsg(c.week)} Your unsubmitted ${cw.n === 1 ? cw.noun : cw.noun + 's'} didn't count.`, {icon: 'lock', duration: 4000});
    return;
  }
  const {keep, dropped} = pruneDrafts(dr, b.games, saved);
  if (Object.keys(keep).length === n) return;
  putDrafts(c.year, c.week, keep);
  if (!dropped.length) return;
  const names = dropped.map(gameName);
  // A drafted change or clear that never went in leaves the submitted pick standing (named when it's one game); a
  // drafted new pick simply didn't count.
  const stands = dropped.filter(g => saved[g.id]);
  const one = dropped.length === 1;
  const was = one && stands.length ? teamOf(dropped[0], saved[dropped[0].id]) : null;
  const what = !stands.length ? `Your unsubmitted ${one ? "pick didn't" : "picks didn't"} count.`
    : stands.length < dropped.length ? "Unsubmitted changes didn't count. Your submitted picks stand."
    : was ? `Your ${was.short} pick stands.` : `Your submitted ${one ? 'pick stands' : 'picks stand'}.`;
  ui.toast(`${andJoin(names)} kicked off. ${what}`, {icon: 'lock', duration: 4000});
}
// One wake-up for the drafts: the next drafted game's urgent hour (the bar turns urgent) or its kickoff (the draft
// goes). The screen's own 15 s tick covers the rest while it shows; this one runs whichever tab is showing.
let draftT = 0;
function armDrafts() {
  clearTimeout(draftT);
  draftT = 0;
  const c = memo.cur;
  const b = c ? memo.boards.get(wkey(c.year, c.week)) : null;
  if (!b) return;
  const dr = drafts.get(c.year, c.week), at = nowMs();
  let next = Infinity;
  b.games.forEach(g => {
    if (!(g.id in dr) || lockedGame(g, at)) return;
    const kt = g.kickoff.getTime();
    [kt - URGENT_MS, kt].forEach(t => { if (t > at && t < next) next = t; });
  });
  const ms = Math.max(1000, next - at + 250); // (a frozen dev clock never reaches `next`: no tight loop)
  if (isFinite(ms) && ms < 2 ** 31 - 1) {
    draftT = setTimeout(() => { draftT = 0; sweepDrafts(); screens.forEach(s => on(s, () => patch())); signalBadge(); armDrafts(); }, ms);
  }
}

// ============================================================================ Tab badge
/**
 * The Pick'em tab's dot (app.js polls it): this week has games still open (not kicked off) that you haven't
 * submitted a pick for, or drafts you haven't submitted; never once you are locked in. Reads only what the screen
 * already fetched (the module memo, your drafts and a mounted screen's just-submitted picks), never a request;
 * kickoffs since the last poll lock games by the clock. On a cold open (the app opens on Puzzles) the memo holds the
 * week kept on this phone (Last-known week), so the dot is right from the moment this module loads; without one,
 * what it last saw stays in DUE_KEY (the kickoff times of those open games) until those games kick off. Nothing
 * known (never opened on this phone, or a new week not seen yet) -> no dot. Picks made on another phone count once
 * this screen has loaded the week again.
 */
const DUE_KEY = 'gg-pickem-due' + SFX; // {k: '2026-w4', due: [kickoff ms, ...], un: [kickoff ms of games with a draft]}
let dueMem, unMem;               // undefined until read
function readDue() {
  if (dueMem !== undefined) return;
  try {
    const o = JSON.parse(ui.lsGet(DUE_KEY) || 'null');
    dueMem = o && Array.isArray(o.due) ? o.due.filter(Number.isFinite) : null;
    unMem = o && Array.isArray(o.un) ? o.un.filter(Number.isFinite) : [];
  } catch (_) { dueMem = null; unMem = []; }
}
function savedDue(at) {
  readDue();
  return !!dueMem && dueMem.some(t => t > at);
}
function saveDue(k, due, un) {
  dueMem = due; unMem = un;
  const v = JSON.stringify({k, due, un});
  if (ui.lsGet(DUE_KEY) !== v) ui.lsSet(DUE_KEY, v);
}
// Another tab of the app on this phone saw the week, or changed a draft: read it again.
try {
  addEventListener('storage', ev => {
    if (ev.key === DUE_KEY || ev.key === null) { dueMem = undefined; signalBadge(); }
    if (ev.key === null || (ev.key && ev.key.startsWith(DRAFT_KEY))) {
      draftMem.clear();
      signalBadge();
      screens.forEach(s => on(s, () => patch()));
    }
  });
} catch (_) {}
/**
 * The dot from what is known -> {on, due: [kickoff ms], unsent (games with a draft that isn't submitted)}. Open games
 * count when nothing is submitted for them, or when a draft differs from what is (a draft alone is not a pick).
 * locked: you have locked in the week (nothing is due, and drafts can't go in).
 */
export function badgeFrom({games, saved, drafts: dr, at = nowMs(), locked = false}) {
  if (locked) return {on: false, due: [], unsent: 0, un: []};
  const S = saved || {};
  const ch = week.pickChanges(dr || {}, S);
  const open = (games || []).filter(g => pickable(g, at));
  const un = open.filter(g => g.id in ch);
  const due = open.filter(g => g.id in ch || (S[g.id] !== g.home.abbr && S[g.id] !== g.away.abbr));
  const ms = l => l.map(g => g.kickoff.getTime()).filter(Number.isFinite);
  return {on: due.length > 0, due: ms(due), unsent: un.length, un: ms(un)};
}
const UNSENT = 'picks not saved';
let why = null; // the words for what badge() last decided; null: it went by what this phone saw before (readDue)
export function badge() {
  const c = memo.cur, at = nowMs();
  why = null;
  if (!c) return savedDue(at);
  const k = wkey(c.year, c.week);
  const b = memo.boards.get(k), snap = memo.snaps.get(k);
  if (snap && snap.error) {
    // Pick'em switched off: no dot. The picks can't be read: what's due is unknown, but drafts live on this phone,
    // so unsubmitted changes (against the last picks seen) still light it.
    why = '';
    if (/denied/.test(String(snap.error)) || !b || !b.games.length) return false;
    const r = badgeFrom({games: b.games, saved: savedFor(c.year, c.week), drafts: drafts.get(c.year, c.week), at});
    if (r.unsent) why = UNSENT;
    return r.unsent > 0;
  }
  // This week's games or your picks still on the way (a first snapshot from the empty local cache is not an answer;
  // the week kept on this phone is, until the server has one).
  if (!b || !b.games.length || !snap || (snap.ready === false && !snap.cached)) return savedDue(at);
  const r = badgeFrom({games: b.games, saved: savedFor(c.year, c.week), drafts: drafts.get(c.year, c.week), at, locked: !!snap.lockedMe});
  if (!snap.cached) saveDue(k, r.due, r.un);
  why = r.unsent ? UNSENT : r.on ? 'games to pick' : '';
  return r.on;
}
/** The dot's words for the tab's label (app.js): unsubmitted drafts first. '' when there is no dot. */
export function badgeText() {
  if (why != null) return why;
  readDue();
  const at = nowMs();
  if (unMem && unMem.some(t => t > at)) return UNSENT;
  return dueMem && dueMem.some(t => t > at) ? 'games to pick' : '';
}
// Tell the tab bar to look again (it coalesces; badge() itself decides).
const signalBadge = () => { try { document.dispatchEvent(new CustomEvent('gg:badge', {detail: {tab: 'pickem'}})); } catch (_) {} };

function targetOf(ctx) {
  const q = ctx.query && ctx.query.week;
  const n = /^\d{1,2}$/.test(q || '') ? +q : null;
  return n && n >= 1 && n <= WEEKS ? n : null;
}
// The week this screen shows: ?week=N (never past the current week), else the current one.
function shownWeek(ctx) {
  const t = targetOf(ctx);
  const c = memo.cur;
  if (t && (!c || t <= c.week)) return {year: seasonYear(), week: t, explicit: true};
  return c ? {year: c.year, week: c.week, explicit: false} : {year: seasonYear(), week: t, explicit: !!t};
}
const isCurrent = v => !!memo.cur && v.year === memo.cur.year && v.week === memo.cur.week;

// When this phone asked for its lock ('2026-w4' -> ms, nowMs's clock): Undo goes LOCK_UNDO_MS after it, a moment before
// the server's window closes whatever this phone's clock says (the lock's `at` is the server's time). Unknown (a lock
// from before a reload): the lock's `at`.
const lockAsked = new Map();
// The view model: the week's board and picks. saved: your submitted picks (with just-submitted ones on top until the
// snapshot shows them); changes: your drafts that differ from them, open games of the current week only (none once
// you are locked in); mine: what the cards show (saved with the changes on top). The summary and everything others
// see count saved only. lock: your lock ({at, n, uid, own, pending}) or null; locked: this week's picks are final (or
// on their way to it: lockPending, "Locking in…"); lockBusy: a lock-in is under way on this screen. loadingPicks: the
// picks haven't answered yet (nothing kept on this phone either); while online only, so an offline open still shows
// what this phone has.
function vm() {
  const k = wkey(st.year, st.week);
  const board = st.week ? memo.boards.get(k) || null : null;
  const snap = st.week ? memo.snaps.get(k) || null : null;
  const saved = Object.assign({}, savedOf(snap));
  st.pending.forEach((p, gid) => { if (p.team) saved[gid] = p.team; else delete saved[gid]; });
  const at = nowMs();
  const games = board ? board.games : [];
  const current = isCurrent({year: st.year, week: st.week});
  const lock = (snap && snap.lockedMe) || null;
  const locked = current && !!lock;
  const lockPending = locked && !!lock.pending;
  const changes = current && !locked ? changesOf(games, drafts.get(st.year, st.week), saved, at) : {};
  const mine = Object.assign({}, saved);
  Object.keys(changes).forEach(gid => { if (changes[gid]) mine[gid] = changes[gid]; else delete mine[gid]; });
  const sum = summarize(games, snap, {mine: saved, at});
  const err = snap && snap.error ? String(snap.error) : '';
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  const undoEnd = lock ? (lockAsked.has(k) ? lockAsked.get(k) : lock.at) + week.LOCK_UNDO_MS : 0;
  return {board, snap, games, saved, mine, changes, at, sum, current, lock, locked, lockPending, lockBusy: !!st.locking,
    undo: locked && !lockPending && lock.own && at < undoEnd, undoEnd,
    off: st.off || /denied/.test(err), picksErr: err && !/denied/.test(err) ? err : '',
    loadingPicks: !snap || (snap.ready === false && !snap.cached && !snap.error && online)};
}
// Picks the cards show (drafts included), and the open games without one.
const isTeam = (g, t) => !!t && (t === g.home.abbr || t === g.away.abbr);
const pickCount = v => v.games.filter(g => isTeam(g, v.mine[g.id])).length;
const unpickedOpen = v => v.games.filter(g => pickable(g, v.at) && !isTeam(g, v.mine[g.id])).length;
// "Lock in" shows for this week once you have a pick (submitted or drafted), while a game is still open, pick'em is
// switched on and the locks can be read (refused: the rules don't know locks yet, so a lock would be too).
const canLock = v => v.current && !v.locked && !v.off && !v.loadingPicks && !(v.snap && v.snap.locksError) && v.sum.open > 0 && pickCount(v) > 0;
// The drafts that are changes to submit, games still open for picks only -> {gameId: team | ''}.
function changesOf(games, dr, saved, at) {
  const ch = week.pickChanges(dr, saved), out = {};
  (games || []).forEach(g => { if (g.id in ch && pickable(g, at)) out[g.id] = ch[g.id]; });
  return out;
}
// Changes as words: 'picks' while every one is a new pick, else 'changes' ("Submit 3 picks", "Submit 1 change").
function wordsOf(changes, saved) {
  const ids = Object.keys(changes);
  const noun = ids.every(id => changes[id] && !saved[id]) ? 'pick' : 'change';
  return {n: ids.length, noun, text: plural(ids.length, noun)};
}
const changeWords = v => wordsOf(v.changes, v.saved);
// The drafted game kicking off first within the hour (the Submit bar's warning), or null.
function urgentOf(v) {
  let first = null;
  v.games.forEach(g => {
    if (!(g.id in v.changes) || g.tbd) return;
    const left = g.kickoff.getTime() - v.at;
    if (left > 0 && left <= URGENT_MS && (!first || g.kickoff < first.kickoff)) first = g;
  });
  return first;
}

// ============================================================================ Markup
// The eyebrow: "NFL · Week 4" (the season before the week is known).
const eyebrowText = () => (st && st.week ? `${LEAGUE} · Week ${st.week}` : `${LEAGUE} · ${st && st.year ? st.year : seasonYear()}`);
function titleHTML() {
  return ui.largeTitle({eyebrow: eyebrowText(), title: "Pick'em", trailing: youButtonHTML()});
}
// The league tabs under the title (the NFL app's Home / Replays row): NFL · College, the active one bright with a bar
// under it. A tap switches the screen to the other league (League switch, at the bottom).
const LEAGUES = [{id: 'nfl', label: 'NFL'}, {id: 'cfb', label: 'College'}];
function leagueTabsHTML() {
  return `<div class="pk-lg" role="tablist" aria-label="League">${LEAGUES.map(l => `<button type="button" role="tab" class="pk-lg-t" data-pk-sport="${l.id}"`
    + ` aria-selected="${l.id === SPORT}"${l.id === SPORT ? '' : ' tabindex="-1"'}><span class="pk-lg-l">${l.label}</span><span class="pk-lg-u" aria-hidden="true"></span></button>`).join('')}</div>`;
}
// The week chips: from the season's first pick'em week (weeks before it never had picks) to the current week. Hidden
// while there is only one week to show.
const FIRST_WEEK = CFB ? {2026: 6} : {2026: 4};
function chipWeeks() {
  const c = memo.cur;
  if (!c || !st || !st.week) return [];
  const from = Math.max(1, Math.min(FIRST_WEEK[c.year] || 1, st.year === c.year ? st.week : c.week));
  const out = [];
  for (let w = from; w <= c.week; w++) out.push(w);
  return out.length > 1 ? out : [];
}
function chipsHTML() {
  const c = memo.cur, weeks = chipWeeks();
  if (!weeks.length) return '';
  const live = memo.boards.get(wkey(c.year, c.week));
  const dot = !!(live && live.games.some(g => g.state === 'in'));
  const items = weeks.map(w => ({id: String(w), label: `Wk ${w}`, dot: w === c.week && dot}));
  return `<div class="accessory pk-acc">${ui.chips({name: 'pk-week', items, value: String(st.week), label: 'Week'})}</div>`;
}

// Progress strip: one segment per game, in kickoff order.
function stripHTML(v) {
  return `<span class="pk-strip" aria-hidden="true">${v.games.map(g => {
    const t = v.mine[g.id], win = winnerOf(g);
    const picked = t === g.home.abbr || t === g.away.abbr;
    // A draft: outlined (a drafted pick) or hollow with a ring (a submitted pick drafted away).
    const draft = draftShown(g, v) ? (picked ? 'is-draft' : 'is-clr') : '';
    const c = win && picked ? (t === win ? 'is-right' : 'is-wrong') : draft || (picked ? 'is-on' : g.state === 'in' ? 'is-live' : '');
    return `<i class="${c}" data-seg="${esc(g.id)}"></i>`;
  }).join('')}</span>`;
}
function sumHTML(v) {
  const s = v.sum;
  const played = s.right + s.wrong;
  const past = !v.current;
  const cw = changeWords(v);
  // Your picks still on their way (a first visit with nothing kept on this phone): placeholders where the numbers
  // and the leader go, so nothing claims "0 of 16" or "Nobody has picked yet" before it is known.
  const wait = v.loadingPicks;
  const skN = '<span class="sk pk-sk-n"></span>';
  // Tile 1: submitted picks only ("16 of 16 Submitted ✓", "12 of 16 Submitted"; drafts are counted on the Submit bar
  // and outlined in the strip). Tile 2: your record. Tile 3: what's next.
  const allIn = !past && s.allIn && !cw.n && !wait;
  const t1 = `<div class="pk-tile${allIn ? ' is-all' : ''}"><span class="pk-tv">${wait ? skN : `<span class="n2 pk-pc">${s.picked}</span><span class="pk-of">of ${s.n}</span>`}</span>`
    + `<span class="pk-tl">${allIn ? `Picked${ui.icon('check')}` : 'Picked'}</span></div>`;
  const t2 = `<div class="pk-tile"><span class="pk-tv">${wait ? skN : `<span class="n2${played ? '' : ' ink3'}">${played ? `${s.right}–${s.wrong}` : '0–0'}</span>`}</span>`
    + `<span class="pk-tl">${!past && !s.done && played ? 'So far' : 'Your record'}</span></div>`;
  let t3;
  const stale = !!(v.board && v.board.stale);
  if (s.live) t3 = `<div class="pk-tile is-live"><span class="pk-tv"><span class="n2">${s.live}</span><span class="pk-of"><i class="c-pk-dot" aria-hidden="true"></i>live</span></span><span class="pk-tl">${stale ? 'Last seen live' : 'In progress'}</span></div>`;
  else if (s.next && !past) t3 = `<div class="pk-tile"><span class="pk-tv pk-tv-t"><span class="pk-nd">${esc(dayShort(s.next))}</span><span class="pk-nt">${esc(timeShort(s.next))}</span></span><span class="pk-tl">Next kickoff</span></div>`;
  else if (s.open && !past) t3 = `<div class="pk-tile"><span class="pk-tv pk-tv-t"><span class="pk-nd">Time</span><span class="pk-nt">TBD</span></span><span class="pk-tl">Next kickoff</span></div>`;
  else t3 = `<div class="pk-tile"><span class="pk-tv"><span class="n2">${s.decided}</span><span class="pk-of">of ${s.n}</span></span><span class="pk-tl">Final</span></div>`;
  const lead = leaderText(s, {done: s.done || past});
  const leadTxt = lead || (s.people ? (past || s.done ? 'Nobody called a winner' : s.decided ? 'Nobody has called a winner yet' : 'No results yet this week')
    : (past ? 'Nobody picked this week' : 'Nobody has picked yet'));
  const leadRow = `<button type="button" class="pk-lead" data-pk-board aria-haspopup="dialog" aria-label="${esc(wait ? 'Leaderboard' : `Leaderboard. ${leadTxt}`)}">`
    + (s.leaders.length ? `<span class="pk-lead-av">${ui.avatarStack(s.leaders.slice(0, 3).map(r => stackItem(r.w)), {max: 3, size: 28})}</span>` : `<span class="pk-lead-av is-ic">${ui.icon('medal')}</span>`)
    + `<span class="pk-lead-tx"><span class="ovl pk-lead-o">Leaderboard</span>${wait ? '<span class="sk sk-line pk-sk-t"></span>' : `<span class="pk-lead-t">${esc(leadTxt)}</span>`}</span>`
    + ui.icon('chevron-right', {cls: 'chev'}) + `</button>`;
  const say = wait ? 'Loading your picks.' : `${s.picked} of ${s.n} picked.${cw.n && st.retry ? ` ${cw.text} not saved yet.` : ''}${v.locked ? (v.lockPending ? ' Locking in.' : ' Locked in.') : ''} ${played ? `Your record ${s.right} and ${s.wrong}.` : ''} ${s.live ? `${plural(s.live, 'game')} ${stale ? 'last seen live' : 'live'}.` : s.next && !past ? `Next kickoff ${kickText(s.next)}.` : s.open && !past ? 'Kickoff times to be decided.' : ''}`;
  return `<div class="card pk-sum" data-enter><p class="sr-only">${esc(say)}</p><div class="pk-tiles" aria-hidden="true">${t1}${t2}${t3}</div>${stripHTML(v)}`
    + `${lockRowHTML(v)}${leadRow}</div>`;
}
// The league's lock-ins -> {list: who has ({w, at, n}, oldest first), not: who hasn't ({w, picked}), count, total}
// ("5 of 12": the league's managers, plus anyone else who has locked in or picked). The rule is week.js's: a lock
// binds its manager, or (a phone without one) only that phone, so a lock never marks the manager a nick names.
function leagueIds() {
  const s = data.SEASONS && data.SEASONS.find(x => x.live);
  const ids = s && s.teams ? Object.keys(s.teams).filter(id => data.M[id]) : [];
  return ids.length ? ids : (data.ids || []).slice();
}
// The manager a nick names (its first word, letters only: the leaderboard's rule), or null.
function nickManager(nick) {
  const k = (String(nick || '').trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^\p{L}]/gu, '');
  return k ? (data.ids || []).find(id => String(data.name(id)).toLowerCase() === k) || null : null;
}
/** Who has locked in and who hasn't, from a subscription payload ({locks, rows}). Exported for the checks. */
export function lockIns(snap) {
  snap = snap || {};
  const list = [], done = new Set();
  (Array.isArray(snap.locks) ? snap.locks : []).forEach(l => {
    const w = who(l);
    if (!done.has(w.key)) { done.add(w.key); list.push({w, at: +l.at || 0, n: +l.n || 0}); }
  });
  const picked = new Map();
  (Array.isArray(snap.rows) ? snap.rows : []).forEach(r => {
    let w = who(r);
    // Locked in: the row's person, or a phone without a manager whose own lock went in under one (its picks are that
    // lock's person).
    if (done.has(w.key) || (!w.id && r.locked != null)) return;
    // A phone without a manager that hasn't locked in counts as the manager its nick names while that manager hasn't
    // either, so it doesn't make a thirteenth manager. Once the manager has, it stays itself: that lock doesn't bind it.
    if (!w.id) { const id = nickManager(w.name); if (id && !done.has('m:' + id)) w = who({me: id, you: w.you}); }
    const p = picked.get(w.key), n = +r.picked || 0;
    if (!p || n > p.picked) picked.set(w.key, {w, picked: n});
  });
  const not = leagueIds().map(id => 'm:' + id).filter(k => !done.has(k))
    .map(k => picked.get(k) || {w: who({me: k.slice(2)}), picked: 0});
  picked.forEach((p, k) => { if (!k.startsWith('m:')) not.push(p); });
  not.sort((x, y) => (y.w.you - x.w.you) || x.w.name.localeCompare(y.w.name));
  return {list, not, count: list.length, total: list.length + not.length};
}
// Lock-ins, one row of the summary: the league's ("5 of 12 locked in" with who; the row opens the lock-ins sheet) and
// yours at its end: "Lock in" while you can, or once you have, your lock on the row's first line ("Locked in · Wed
// 1:05 AM", "Locking in…" until the server has it) with Undo for its first minutes. This week only, until every game
// is over; hidden while the locks can't be read (unless you are locked in); a placeholder of its height while the
// picks load.
// Your lock-in row (this week only). Locking in is optional and private: the row says only where you stand (a Lock
// in button, or "Locked in · Thu 7:40 PM" with Undo for its first minutes), never who else has or hasn't.
function lockRowHTML(v) {
  if (!v.current || (v.sum.done && !v.locked)) return '';
  if (v.loadingPicks) return `<div class="pk-ll is-sk" aria-hidden="true"><span class="sk pk-sk-av"></span><span class="sk sk-line pk-sk-t"></span></div>`;
  if (!v.locked && v.snap && v.snap.locksError) return '';
  let lead, line, said, trail = '';
  if (v.locked) {
    const when = v.lockPending ? '' : kickText(new Date(v.lock.at), v.at);
    lead = `<span class="pk-ll-av is-me"><span class="pk-lk-ic">${v.lockPending ? '<span class="spin" aria-hidden="true"></span>' : ui.icon('lock')}</span></span>`;
    line = `<span class="pk-ll-mt">${v.lockPending ? 'Locking in…' : `Locked in<span class="pk-lk-w"> · ${esc(when)}</span>`}</span>`
      + `<span class="pk-ll-t"><span>No changes this week, even before kickoff</span></span>`;
    said = v.lockPending ? 'Locking in your picks' : `You're locked in, ${when}`;
    if (v.undo) trail = `<button type="button" class="pk-lk-undo" data-pk-unlock${st.unlocking ? ' aria-disabled="true"' : ''} aria-label="Undo lock in">Undo</button>`;
  } else {
    if (!canLock(v)) return '';
    lead = `<span class="pk-ll-av is-ic">${ui.icon('lock')}</span>`;
    line = `<span class="pk-ll-t"><span>Make picks final early</span></span>`;
    said = 'Locking in is optional';
    trail = ui.button({label: 'Lock in', kind: 'secondary', size: 's', icon: 'lock', loading: !!st.locking, cls: 'pk-lk-go',
      attrs: {'data-pk-lock': '', 'aria-haspopup': 'dialog', 'aria-label': 'Lock in your picks'}});
  }
  return `<div class="pk-ll${v.locked ? ' is-in' : ''}"><div class="pk-ll-b" role="group" aria-label="${esc(said)}">`
    + `${lead}<span class="pk-ll-tx">${line}</span></div>${trail}</div>`;
}
function bannerHTML(v) {
  const out = [];
  if (v.board && v.board.stale) out.push(`<p class="pk-banner is-stale">${ui.icon('clock')}<span>Scores may be out of date.</span></p>`);
  if (v.off) out.push(`<p class="pk-banner">${ui.icon('info')}<span>${esc(PICK_OFF)}</span></p>`);
  else if (v.picksErr) out.push(`<p class="pk-banner">${ui.icon('info')}<span>Picks didn't load. Check your connection.</span></p>`);
  // A past week: the way back to this week's slate (with how many picks it still needs).
  const c = memo.cur;
  if (c && !v.current && st.year === c.year && st.week < c.week) {
    const b = memo.boards.get(wkey(c.year, c.week));
    const saved = savedFor(c.year, c.week);
    const s = b ? summarize(b.games, memo.snaps.get(wkey(c.year, c.week)) || null, {mine: saved}) : null;
    const un = b ? wordsOf(changesOf(b.games, drafts.get(c.year, c.week), saved, v.at), saved) : null;
    const txt = un && un.n && st.retry ? `Week ${c.week}: ${un.text} not saved`
      : s && s.open && !s.allIn ? (s.picked ? `Week ${c.week}: ${s.picked} of ${s.n} picked` : `Week ${c.week} picks are open`) : `Back to week ${c.week}`;
    out.push(`<button type="button" class="pk-banner is-go" data-pk-week="${c.week}">${ui.icon('football')}<span>${esc(txt)}</span>${ui.icon('chevron-right', {cls: 'chev'})}</button>`);
  }
  return out.join('');
}
function noteHTML(v) {
  if (!v.current || v.sum.done) return v.sum.n ? `<p class="pk-note">${v.current ? 'Every game is final.' : `Week ${st.week} is final.`} A point for every winner you called; a tie counts for nobody.</p>` : '';
  if (!v.sum.open || v.off) return '';
  if (v.lockPending) return `<p class="pk-note">Locking in your picks for week ${st.week}…</p>`;
  if (v.locked) return `<p class="pk-note">Your picks are locked in for week ${st.week}. Nothing changes now but the scores.</p>`;
  return `<p class="pk-note">Tap a team to pick it, tap again to clear. Picks save as you tap and can change until each game kicks off.</p>`;
}

// Status column: kickoff time, the live clock, or Final.
function statHTML(g, v) {
  const locked = lockedGame(g, v.at);
  // Kicked off: a quiet lock. Not yet, but you are locked in: your lock, in tint.
  const lock = locked ? ui.icon('lock', {cls: 'pk-lock'}) : v.locked && g.state === 'pre' ? ui.icon('lock', {cls: 'pk-lock is-in'}) : '';
  if (g.state === 'in') {
    const [a, b] = clockOf(g);
    return `${lock}<span class="pk-s1 is-live"><i class="c-pk-dot" aria-hidden="true"></i>${esc(a)}</span>${b ? `<span class="pk-s2">${esc(b)}</span>` : ''}`;
  }
  if (g.state === 'post') {
    if (!g.final) return `<span class="pk-s1 is-final">${esc(offWord(g))}</span>`;
    const ot = /OT/i.test(g.detail) || (g.period || 0) > 4;
    const tie = !g.winner;
    return `<span class="pk-s1 is-final">Final</span>${tie || ot ? `<span class="pk-s2">${[tie ? 'Tie' : '', ot ? 'OT' : ''].filter(Boolean).join(' · ')}</span>` : ''}`;
  }
  if (locked) return `${lock}<span class="pk-s1">${/postpon|delay|suspend|cancel/i.test(g.detail) ? esc(offWord(g)) : 'Starting'}</span>`;
  if (g.tbd) return `${lock}<span class="pk-s1">Kickoff</span><span class="pk-s2">TBD</span>`;
  if (g.kickoff.getTime() - v.at > 6 * 864e5) return `${lock}<span class="pk-s1">${esc(dateShort(g.kickoff))}</span><span class="pk-s2">${esc(timeShort(g.kickoff))}</span>`;
  // The slot header already names the day (and the time when every game in the slot shares it): the card shows the
  // TV network in the day's place, and drops a time that is the same for the whole slot.
  const sl = slotInfo(g, v), tv = tvShort(g.tv);
  const s1 = sl.oneDay ? tv : dayShort(g.kickoff);
  const s2 = sl.oneDay && sl.oneTime && s1 ? '' : timeShort(g.kickoff);
  return lock + (s1 ? `<span class="pk-s1">${esc(s1)}</span>` : '') + (s2 ? `<span class="pk-s2">${esc(s2)}</span>` : '');
}
// Per slot of the view model: {oneDay (every game on the same local day), oneTime (the same kickoff)}.
function slotInfo(g, v) {
  if (!v.slots) {
    v.slots = new Map();
    slotsOf(v.games).forEach(s => v.slots.set(s.key, {
      oneDay: new Set(s.games.map(x => dayShort(x.kickoff))).size === 1,
      oneTime: new Set(s.games.map(x => x.kickoff.getTime())).size === 1
    }));
  }
  return v.slots.get(slotOf(g).key) || {oneDay: false, oneTime: false};
}
// 'CBS', 'FOX', 'Prime', 'ESPN' (the first network of 'ESPN / ABC').
const tvShort = tv => String(tv || '').split(' / ')[0].trim().replace(/^Prime Video$/i, 'Prime').replace(/^NFL Network$/i, 'NFL Net');
const offWord = g => (/cancel/i.test(g.detail) ? 'Canceled' : /suspend/i.test(g.detail) ? 'Suspended' : /delay/i.test(g.detail) ? 'Delayed' : 'Postponed');
// The live clock as two short lines: ['Q3', '4:12'], ['Half', ''], ['End', 'Q3'], ['OT', '2:01'].
function clockOf(g) {
  const d = g.detail || '';
  const q = p => (p > 4 ? (p === 5 ? 'OT' : `${p - 4}OT`) : `Q${p}`);
  if (/half/i.test(d)) return ['Half', ''];
  const p = g.period || (/(\d)(st|nd|rd|th)/i.exec(d) || [])[1] || null;
  if (/^end/i.test(d)) return ['End', p ? q(+p) : ''];
  if (p && g.clock) return [q(+p), g.clock];
  const m = /^(\d{1,2}:\d{2})\s*-\s*(\d)(?:st|nd|rd|th)/i.exec(d);
  if (m) return [q(+m[2]), m[1]];
  return [d ? d.split(/\s+-\s+/)[0] : 'Live', ''];
}
// A game you can still pick: this week's, open for picks, pick'em switched on, and you haven't locked in (nor are
// locking in right now).
const canPick = (g, v) => v.current && !v.off && !v.locked && !v.lockBusy && pickable(g, v.at);
function markHTML(g, t, v) {
  const mine = v.mine[g.id];
  const win = winnerOf(g);
  if (mine === t.abbr) {
    if (win) return mine === win ? `<span class="pk-mk is-right">${ui.icon('check')}</span>` : `<span class="pk-mk is-wrong">${ui.icon('x')}</span>`;
    // A tie (or a game that never finished) grades as no pick: a neutral mark.
    if (g.state === 'post') return `<span class="pk-mk is-push">${ui.icon('check')}</span>`;
    // Drafted, not submitted: an outlined mark (a submitted pick is the filled one).
    if (draftShown(g, v)) return `<span class="pk-mk is-draft">${ui.icon('check')}</span>`;
    return `<span class="pk-mk is-on">${ui.icon('check')}</span>`;
  }
  return canPick(g, v) ? `<span class="pk-mk is-open"></span>` : '';
}
// A side's draft state: 'draft' (drafted, not submitted), 'cleared' (your submitted pick, cleared by a draft), 'was'
// (your submitted pick, swapped for the other side by a draft: it still counts until you submit) or ''.
// Picks save as they are tapped: a pick on its way looks like any pick; only one a save failed on (st.retry) looks
// drafted.
const draftShown = (g, v) => !!(st && st.retry) && g.id in v.changes;
function draftOf(g, t, v) {
  if (!draftShown(g, v)) return '';
  if (v.mine[g.id] === t.abbr) return 'draft';
  if (v.saved[g.id] !== t.abbr) return '';
  return v.changes[g.id] === '' ? 'cleared' : 'was';
}
function teamLabel(g, t, side, v) {
  const other = side === 'away' ? g.home : g.away;
  const mine = v.mine[g.id];
  const win = winnerOf(g);
  const d = draftOf(g, t, v);
  const bits = [`${t.rank ? `Number ${t.rank} ` : ''}${t.name}${t.record ? `, ${recText(t.record)}` : ''}`];
  if (showScore(g) && t.score != null) bits.push(`${t.score} points${win === t.abbr ? ', won' : ''}`);
  const sp = spreadOf(g, side);
  if (sp) bits.push(sp === 'PK' ? 'Spread: pick\'em' : `Spread ${sp.replace('−', 'minus ').replace('+', 'plus ')}`);
  if (mine === t.abbr) bits.push(win ? (win === t.abbr ? 'Your pick, right' : 'Your pick, wrong') : g.state === 'post' ? 'Your pick. No result, so it counts for nobody' : d ? 'Your pick, not saved yet' : 'Your pick');
  else if (d === 'cleared') bits.push('Your saved pick, cleared but not saved yet');
  else if (d === 'was') bits.push(`Your saved pick, changing to the ${other.short} once it saves`);
  if (canPick(g, v)) bits.push(mine === t.abbr ? 'Tap to clear' : `Pick to beat the ${other.short}`);
  else if (v.locked && !lockedGame(g, v.at)) bits.push(v.lockPending ? 'Locking in' : 'Locked in');
  else if (v.current && !v.off && tbdShut(g, v.at)) bits.push('Picks open again once the kickoff time is set');
  return bits.join('. ');
}
function sideCls(g, t, v) {
  const mine = v.mine[g.id];
  const win = winnerOf(g);
  const d = draftOf(g, t, v);
  // Before kickoff the side you didn't pick steps back; after it, winning and losing carry the emphasis.
  return `pk-t${mine === t.abbr ? ' is-on' : mine && g.state === 'pre' ? ' is-dim' : ''}${d ? ' is-' + d : ''}${win ? (win === t.abbr ? ' is-win' : ' is-lose') : ''}${canPick(g, v) ? '' : ' is-locked'}`;
}
// The line under the team name: its record, and a marker on a draft: NOT SUBMITTED on the drafted side, CLEAR NOT
// SUBMITTED on a submitted pick drafted away, SUBMITTED (neutral) on a submitted pick a draft would swap.
// The spread for a side ('-3.5' on the favorite, '+3.5' on the underdog, 'PK' both ways), from ESPN's current
// line; '' when there is none. Shown until the game is over.
const spreadOf = (g, side) => {
  const l = g.line;
  if (!l || g.state === 'post') return '';
  if (!l.fav || !l.pts) return 'PK';
  return (l.fav === side ? '−' : '+') + String(l.pts);
};
function subHTML(g, t, v) {
  const d = draftOf(g, t, v);
  const ns = d === 'draft' ? 'Not saved' : d === 'cleared' ? 'Clear not saved' : d === 'was' ? 'Saved' : '';
  const sp = spreadOf(g, g.home === t ? 'home' : 'away');
  const fav = sp.startsWith('−');
  return `<span class="pk-trec">${esc(recText(t.record))}</span>${sp ? `<span class="pk-sp n5${fav ? ' is-fav' : ''}">${esc(sp)}</span>` : ''}${ns ? `<span class="pk-ns">${ns}</span>` : ''}`;
}
function sideHTML(g, side, v) {
  const t = g[side];
  const sc = showScore(g) && t.score != null ? String(t.score) : '';
  return `<button type="button" class="${sideCls(g, t, v)}" data-pick="${esc(g.id)}" data-team="${esc(t.abbr)}" data-side="${side}" aria-pressed="${v.mine[g.id] === t.abbr}"`
    + `${canPick(g, v) ? '' : ' aria-disabled="true"'} aria-label="${esc(teamLabel(g, t, side, v))}">`
    + logoHTML(t, 32)
    + `<span class="pk-tn"><span class="pk-tnm">${t.rank ? `<span class="pk-rk n5">${t.rank}</span>` : ''}${esc(t.short)}</span><span class="pk-tsub">${subHTML(g, t, v)}</span></span>`
    + `<span class="pk-mkw">${markHTML(g, t, v)}</span>`
    + `<span class="pk-sc n3">${esc(sc)}</span>`
    + `</button>`;
}
// Others' picks for a game show once ESPN has it started (week.js: byGame.revealed, never the phone's clock); until
// then only how many are in. A game can be locked (kickoff time passed) a minute before its picks show.
function revealedOf(g, v) {
  const b = v.snap && v.snap.byGame ? v.snap.byGame[g.id] : null;
  return b && b.revealed != null ? !!b.revealed : g.state !== 'pre';
}
// Revealed picks for a game: {home: [who], away: [who], n}. Before the reveal only the count is known.
function crowdOf(g, v) {
  const b = v.snap && v.snap.byGame ? v.snap.byGame[g.id] : null;
  const vo = b && b.voters ? b.voters : {};
  const map = side => (Array.isArray(vo[side]) ? vo[side] : []).map(who).sort((x, y) => (y.you - x.you) || x.name.localeCompare(y.name));
  const home = map('home'), away = map('away');
  let n = b ? (b.n != null ? +b.n || 0 : (+b.home || 0) + (+b.away || 0)) : 0;
  if (!b && v.snap && Array.isArray(v.snap.picks)) n = (pickIndex(v.snap).get(g.id) || new Map()).size;
  // Your just-submitted pick shows in the count before the server has it (a draft never does: nobody else sees it).
  const inSnap = v.snap && v.snap.mine ? v.snap.mine[g.id] : null;
  const eff = v.saved[g.id];
  if (!lockedGame(g, v.at)) n = Math.max(0, n - (inSnap ? 1 : 0) + (eff ? 1 : 0));
  return {home, away, n: Math.max(n, home.length + away.length)};
}
function barHTML(share, mine) {
  const a = Math.max(0, Math.min(1, share));
  return `<span class="c-pk-bar${mine ? ' is-' + mine : ''}" aria-hidden="true"><i class="a" style="transform:scaleX(${a})"></i><i class="h" style="transform:scaleX(${1 - a})"></i></span>`;
}
function footHTML(g, v) {
  const c = crowdOf(g, v);
  if (!revealedOf(g, v)) {
    if (v.loadingPicks) return `<span class="pk-f-in"><span class="pk-f-sk"></span></span>`;
    const locked = lockedGame(g, v.at);
    return `<span class="pk-f-in">${ui.icon(locked ? 'lock' : 'person')}<span>${c.n ? `${plural(c.n, 'pick')} in` : locked ? 'No picks' : 'No picks yet'}</span></span><span class="pk-f-r">Revealed at kickoff</span>`;
  }
  const n = c.home.length + c.away.length;
  if (!n) return `<span class="pk-f-in">${ui.icon('lock')}<span>${v.loadingPicks ? 'Locked' : 'Nobody picked this game'}</span></span>`;
  const share = c.away.length / n;
  const mine = v.mine[g.id];
  return `<span class="pk-f-cs a">${ui.avatarStack(c.away.map(stackItem), {max: 2, size: 24})}</span>`
    + `<span class="pk-f-mid"><span class="pk-f-p n5${mine === g.away.abbr ? ' tint' : ''}">${Math.round(share * 100)}%</span>${barHTML(share, mine === g.away.abbr ? 'a' : mine === g.home.abbr ? 'h' : '')}<span class="pk-f-p n5${mine === g.home.abbr ? ' tint' : ''}">${100 - Math.round(share * 100)}%</span></span>`
    + `<span class="pk-f-cs h">${ui.avatarStack(c.home.map(stackItem), {max: 2, size: 24})}</span>`;
}
function footLabel(g, v) {
  const c = crowdOf(g, v);
  if (!revealedOf(g, v)) return c.n ? `${plural(c.n, 'pick')} in. Revealed at kickoff.` : 'No picks yet.';
  const names = l => l.map(w => w.you ? 'you' : w.name);
  const n = c.home.length + c.away.length;
  if (!n) return 'Nobody picked this game.';
  return `${g.away.short}: ${c.away.length ? andJoin(names(c.away)) : 'nobody'}. ${g.home.short}: ${c.home.length ? andJoin(names(c.home)) : 'nobody'}. See who picked whom`;
}
function gameCls(g, v) {
  const mine = v.mine[g.id], win = winnerOf(g);
  const res = win && (mine === g.home.abbr || mine === g.away.abbr) ? (mine === win ? ' is-right' : ' is-wrong') : '';
  return `pk-g is-${g.state}${g.off ? ' is-off' : ''}${lockedGame(g, v.at) ? ' is-locked' : ''}${res}`;
}
function gameHTML(g, v) {
  const where = g.where ? `<span class="pk-where">${esc(g.where)}</span>` : '';
  return `<li class="${gameCls(g, v)}" data-g="${esc(g.id)}">`
    + `<div class="pk-g-main" role="group" aria-label="${esc(`${g.away.name} at ${g.home.name}. ${statText(g, v)}`)}">`
    + `<div class="pk-sides">${sideHTML(g, 'away', v)}${sideHTML(g, 'home', v)}</div>`
    + `<div class="pk-stat">${statHTML(g, v)}</div></div>`
    + (revealedOf(g, v)
      ? `<button type="button" class="pk-foot" data-pk-who="${esc(g.id)}" aria-haspopup="dialog" aria-label="${esc(footLabel(g, v))}">${where}${footHTML(g, v)}</button>`
      : `<div class="pk-foot">${where}${footHTML(g, v)}</div>`)
    + `</li>`;
}
function statText(g, v) {
  if (g.state === 'in') return `Live, ${clockOf(g).filter(Boolean).join(' ')}. ${scoreLine(g)}`;
  if (g.state === 'post') return g.final ? `Final${/OT/i.test(g.detail) ? ' in overtime' : ''}. ${scoreLine(g)}` : `${offWord(g)}. No result`;
  if (lockedGame(g, v.at)) return 'Kicked off. Picks are locked';
  return (v.locked ? (v.lockPending ? 'Locking in. ' : 'Locked in. ') : '') + (g.tbd ? 'Kickoff time to be decided' : `Kickoff ${kickText(g.kickoff, v.at)}`);
}
// Games grouped by slot in kickoff order; games without a set time last.
function slotsOf(games) {
  const out = [], at = new Map();
  games.forEach(g => {
    const s = slotOf(g);
    let x = at.get(s.key);
    if (!x) { x = Object.assign({games: []}, s); at.set(s.key, x); out.push(x); }
    x.games.push(g);
  });
  return out.sort((a, b) => (a.key === TBD_SLOT.key) - (b.key === TBD_SLOT.key));
}
function slotHead(s, v) {
  const first = s.games[0].kickoff;
  const live = s.games.some(g => g.state === 'in');
  const done = s.games.every(g => g.state === 'post');
  const right = done || (s.key === TBD_SLOT.key && !live) ? '' : live ? '<span class="pk-sl-r is-live"><i class="c-pk-dot" aria-hidden="true"></i>Live</span>' : `<span class="pk-sl-r">${esc(kickText(first, v.at))}</span>`;
  return `<h2 class="pk-sl-h"><span class="ovl">${esc(s.label)}</span>${right}</h2>`;
}
function gamesHTML(v) {
  return slotsOf(v.games).map((s, i) => `<section class="pk-slot" data-slot="${esc(s.key)}"${i < 3 ? ' data-enter' : ''}>${slotHead(s, v)}`
    + `<ol class="pk-list">${s.games.map(g => gameHTML(g, v)).join('')}</ol></section>`).join('');
}
function devNote() {
  let dev = false;
  try { dev = !!(week.__dev && typeof week.__dev.standIn === 'function' && week.__dev.standIn()); } catch (_) { dev = false; }
  return dev ? `<p class="pk-dev">Test mode: picks are saved in this browser only.</p>` : '';
}
function bodyHTML() {
  if (!st || !st.week) {
    if (st && st.err) return errHTML();
    return loadingHTML();
  }
  const v = vm();
  if (!v.board) return st.err ? errHTML() : loadingHTML();
  if (!v.games.length) {
    return (v.board.stale || v.board.error ? errHTML() : ui.empty({icon: 'calendar', title: 'No games this week.', body: CFB ? `Week ${st.week} has no Top 25 games on the schedule.` : `Week ${st.week} has no NFL games on the schedule.`}));
  }
  return sumHTML(v) + `<div class="pk-banners">${bannerHTML(v)}</div>` + noteHTML(v) + `<div class="pk-games">${gamesHTML(v)}</div>` + devNote();
}
function loadingHTML() {
  return `<div class="card pk-sum is-sk" aria-hidden="true"><div class="pk-tiles"><span class="sk sk-line"></span><span class="sk sk-line"></span><span class="sk sk-line"></span></div></div>`
    + ui.skeleton('cards', 4, {label: "Loading this week's games."});
}
function errHTML() {
  return ui.empty({icon: 'football', title: "Games didn't load.", body: 'Check your connection and try again.', action: {label: 'Try again', attrs: {'data-pk-retry': ''}}});
}

// ============================================================================ Submit bar
// Sticky above the tab bar while this week has changes: Discard (every draft goes; a toast offers them back) and Submit
// (all of them at once). Within the hour before a drafted game kicks off it turns urgent and says which game. While
// pick'em is switched off it steps back (muted Submit, a note that the drafts are kept): a submit would be refused.
function submitState(v) {
  if (!v || !v.current || !v.games.length) return null;
  const cw = changeWords(v);
  if (!cw.n) return null;
  const u = v.off ? null : urgentOf(v);
  const note = v.off ? OFF_NOTE : u ? `Save before ${gameName(u)} kicks off at ${timeShort(u.kickoff)}` : '';
  return {cw, label: `Save ${cw.text}`, undo: `Discard ${cw.text}, not saved`, note, kind: v.off ? 'off' : u ? 'urgent' : '',
    urgent: u ? note : ''};
}
const NOTE_ICON = {urgent: 'clock', off: 'info'};
// Picks save as they are tapped (autoSave), so the bar only shows when a save didn't go through (st.retry): Save tries
// those picks again, Discard drops them.
const barState = v => (st && st.retry ? submitState(v) : null);
function submitBarHTML(v) {
  const b = barState(v);
  const kind = b ? b.kind : '';
  return `<div class="pk-sb${kind ? ' is-' + kind : ''}" role="region" aria-label="Unsubmitted picks"${b ? '' : ' hidden'}><div class="pk-sb-card">`
    + `<p class="pk-sb-msg" id="pk-sb-msg" data-kind="${kind}"${kind ? '' : ' hidden'}>${ui.icon(NOTE_ICON[kind] || 'clock')}<span>${esc(b ? b.note : '')}</span></p>`
    + `<div class="pk-sb-row">`
    + ui.button({label: 'Discard', kind: 'secondary', cls: 'pk-sb-undo', attrs: {'data-pk-undo': '', 'aria-label': b ? b.undo : 'Discard'}})
    + ui.button({label: b ? b.label : 'Submit picks', kind: 'primary', cls: 'pk-sb-go', attrs: {'data-pk-submit': '', 'aria-describedby': kind ? 'pk-sb-msg' : null}})
    // The second step, a lock at Submit's end: submit, then lock the week in (the confirm sheet first). Only when "Lock
    // in" is offered at all (canLock: a pick to lock, locks switched on, pick'em switched on).
    + `<button type="button" class="pk-sb-lk" data-pk-sublock aria-haspopup="dialog" aria-label="Submit and lock in"${v && canLock(v) ? '' : ' hidden'}>${ui.icon('lock')}</button>`
    + `</div></div></div>`;
}
// Bring the bar in line with the view model: shown or hidden (it rises in and drops away), its count, urgency and
// the loading state while a submit is on its way.
function syncSubmitBar(v) {
  const bar = st.el && st.el.querySelector('.pk-sb');
  if (!bar) return;
  const b = !st.retry ? null : st.busy && v && v.current ? st.busy.b : submitState(v);
  const show = !!b;
  const card = bar.querySelector('.pk-sb-card');
  if (show) {
    const go = bar.querySelector('[data-pk-submit]'), undo = bar.querySelector('[data-pk-undo]');
    const lab = go && go.querySelector('.btn-label');
    if (lab && lab.textContent !== b.label) {
      const was = lab.textContent;
      lab.textContent = b.label;
      if (!bar.hidden && was && st.ctx.visible) ui.animate(lab, [{transform: 'translateY(5px)', opacity: .3}, {transform: 'none', opacity: 1}], {spring: 'snappy'});
    }
    if (undo && undo.getAttribute('aria-label') !== b.undo) undo.setAttribute('aria-label', b.undo);
    ui.setLoading(go, !!st.busy);
    if (undo) { if (st.busy || st.locking) undo.setAttribute('aria-disabled', 'true'); else undo.removeAttribute('aria-disabled'); }
    const lk = bar.querySelector('[data-pk-sublock]');
    if (lk) {
      const off = !(st.busy || st.locking) && !canLock(v);
      if (lk.hidden !== off) lk.hidden = off;
      if (st.busy || st.locking) lk.setAttribute('aria-disabled', 'true'); else lk.removeAttribute('aria-disabled');
    }
    // A lock-in under way (its drafts go in first): Submit waits for it.
    if (go) { if (st.locking && !st.busy) go.setAttribute('aria-disabled', 'true'); else go.removeAttribute('aria-disabled'); }
    // The note line: urgent (a drafted game kicks off within the hour) or off (pick'em isn't switched on).
    const msg = bar.querySelector('.pk-sb-msg'), mt = msg && msg.querySelector('span');
    if (msg && (msg.hidden !== !b.kind || msg.dataset.kind !== b.kind || mt.textContent !== b.note)) {
      const first = !!b.kind && (msg.hidden || msg.dataset.kind !== b.kind);
      if (b.kind && msg.dataset.kind !== b.kind) { const ic = msg.querySelector(':scope > .ic'); if (ic) ic.outerHTML = ui.icon(NOTE_ICON[b.kind]); }
      msg.hidden = !b.kind;
      msg.dataset.kind = b.kind;
      mt.textContent = b.note;
      bar.classList.toggle('is-urgent', b.kind === 'urgent');
      bar.classList.toggle('is-off', b.kind === 'off');
      if (go) { if (b.kind) go.setAttribute('aria-describedby', 'pk-sb-msg'); else go.removeAttribute('aria-describedby'); }
      if (first) {
        if (b.kind === 'urgent') ui.announce(b.note);
        if (!bar.hidden && st.ctx.visible) ui.animate(msg, [{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: 240, easing: 'cubic-bezier(.22,1,.36,1)'});
      }
    }
    if (bar.hidden || bar.dataset.leaving) {
      if (st.barAnim) { try { st.barAnim.cancel(); } catch (_) {} st.barAnim = null; }
      delete bar.dataset.leaving;
      bar.hidden = false;
      if (st.ctx.visible) ui.animate(card, [{transform: 'translateY(24px) scale(.96)', opacity: 0}, {transform: 'none', opacity: 1}], {spring: 'smooth'});
    }
  } else if (!bar.hidden && !bar.dataset.leaving) {
    // Focus on a button that is going away moves to the screen (not lost on <body>).
    if (bar.contains(document.activeElement)) { try { st.ctx.screen.focus({preventScroll: true}); } catch (_) {} }
    ui.setLoading(bar.querySelector('[data-pk-submit]'), false);
    const undo = bar.querySelector('[data-pk-undo]');
    if (undo) undo.removeAttribute('aria-disabled');
    if (!st.ctx.visible) { bar.hidden = true; return; }
    // The card drops away while the space it held closes with it, so a list scrolled to its end settles down smoothly
    // instead of jumping when the bar goes.
    const s0 = st, cs = getComputedStyle(bar);
    bar.dataset.leaving = '1';
    const a = ui.animate(card, [{transform: 'none', opacity: 1}, {transform: 'translateY(16px) scale(.98)', opacity: 0}], {duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'});
    const a2 = ui.animate(bar, [{height: bar.offsetHeight + 'px', marginTop: cs.marginTop, marginBottom: cs.marginBottom}, {height: '0px', marginTop: '0px', marginBottom: '0px'}],
      {duration: 240, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'});
    const anim = {cancel() { try { a.cancel(); } catch (_) {} try { a2.cancel(); } catch (_) {} }};
    st.barAnim = anim;
    let n = 2;
    const done = () => {
      if (--n > 0) return;
      if (bar.dataset.leaving) { delete bar.dataset.leaving; bar.hidden = true; }
      if (s0.barAnim === anim) { s0.barAnim = null; anim.cancel(); }
    };
    a.finished.then(done, done);
    a2.finished.then(done, done);
  }
}

// ============================================================================ Patching
function morph(el, html) {
  if (!el || el._html === html) return false;
  const f = document.activeElement;
  let sel = null;
  if (f && el.contains(f)) {
    for (const a of ['data-pk-who', 'data-pk-board', 'data-pk-week', 'data-pk-retry']) if (f.hasAttribute(a)) { sel = `[${a}="${CSS.escape(f.getAttribute(a))}"]`; break; }
  }
  el.innerHTML = html;
  el._html = html;
  if (sel) { const n = el.querySelector(sel); if (n) n.focus({preventScroll: true}); }
  return true;
}
// Render the body afresh (week switch, me change, first data, a new slate).
function renderBody({fade} = {}) {
  if (!st) return;
  sweepDrafts();
  const main = st.el.querySelector('.pk-main');
  if (!main) return;
  const put = () => {
    main.innerHTML = bodyHTML();
    st.shape = shapeKey();
    ui.hydrate(main);
    markShown(main);
  };
  if (fade && st.ctx.visible && !ui.RM) ui.crossfade(main, put, {duration: 120}); else put();
  syncChrome();
}
// The structure the body was rendered for: a change means render afresh, else patch.
function shapeKey() {
  if (!st || !st.week) return 'none|' + (st && st.err ? 'err' : '');
  const v = vm();
  if (!v.board) return 'load|' + (st.err ? 'err' : '');
  return `${st.year}-${st.week}|${v.games.map(g => g.id + ':' + slotOf(g).key).join(',')}|${v.current}`;
}
function markShown(root) {
  if (!st) return;
  const v = st.week ? vm() : null;
  root.querySelectorAll('.pk-g').forEach(li => {
    const g = v && v.games.find(x => x.id === li.dataset.g);
    if (g) st.seen.set(g.id, {state: g.state, locked: lockedGame(g, v.at), revealed: revealedOf(g, v)});
  });
}
// Patch in place: every card's classes, marks, scores, status and footer; the summary and banners.
// pop: a tapped pick ({id, team}); all: every open game just got submitted; committed: game ids just submitted.
// st.lockPop (when you just locked in, ms): the locks arrive on the first patch that shows the lock confirmed (the
// server's answer and the snapshot showing it come in either order), within 10 s.
const SUM_CTLS = ['data-pk-board', 'data-pk-locks', 'data-pk-lock', 'data-pk-unlock'];
function patch({pop = null, all = false, committed = null} = {}) {
  if (!st) return;
  sweepDrafts();
  if (shapeKey() !== st.shape) { renderBody(); return; }
  if (!st.week) return;
  const v = vm();
  if (!v.board || !v.games.length) return;
  let lockPop = false;
  if (st.lockPop) {
    if (v.locked && !v.lockPending) { lockPop = true; st.lockPop = 0; } else if (Date.now() - st.lockPop > 10e3) st.lockPop = 0;
  }
  const el = st.el;
  const sum = el.querySelector('.pk-sum');
  if (sum) {
    const t = document.createElement('template');
    t.innerHTML = sumHTML(v);
    const n = t.content.firstElementChild;
    n.removeAttribute('data-enter');
    const html = n.innerHTML;
    if (sum._html !== html) {
      // Focus on a control in the card stays on it (or, when locking in took the button away, lands on what replaced it).
      const af = document.activeElement;
      const had = af && af.closest && sum.contains(af) ? SUM_CTLS.find(a => af.closest(`[${a}]`)) : null;
      sum.innerHTML = html;
      sum._html = html;
      if (had) {
        const b = sum.querySelector(`[${had}]`) || (had === 'data-pk-lock' || had === 'data-pk-unlock' ? sum.querySelector('[data-pk-unlock], [data-pk-lock], [data-pk-locks]') : null);
        if (b) b.focus({preventScroll: true});
      }
    }
    if (lockPop && st.ctx.visible) {
      const ic = sum.querySelector('.pk-lk-ic');
      if (ic) ui.stamp(ic, {from: .4});
    }
  }
  morph(el.querySelector('.pk-banners'), bannerHTML(v));
  const note = el.querySelector('.pk-note');
  const nh = noteHTML(v);
  if (note && !nh) note.remove();
  else if (note) { const t = document.createElement('template'); t.innerHTML = nh; if (note.textContent !== t.content.textContent) note.textContent = t.content.textContent; }
  else if (nh) { const b = el.querySelector('.pk-banners'); if (b) b.insertAdjacentHTML('afterend', nh); }
  el.querySelectorAll('.pk-slot').forEach(sec => {
    const s = slotsOf(v.games).find(x => x.key === sec.dataset.slot);
    const h = sec.querySelector('.pk-sl-h');
    if (s && h) { const t = document.createElement('template'); t.innerHTML = slotHead(s, v); const nh2 = t.content.firstElementChild.innerHTML; if (h.innerHTML !== nh2) h.innerHTML = nh2; }
  });
  el.querySelectorAll('.pk-g').forEach(li => {
    const g = v.games.find(x => x.id === li.dataset.g);
    if (g) patchGame(li, g, v, pop && pop.id === g.id ? pop : null);
  });
  if (pop) {
    const seg = el.querySelector(`.pk-strip > i[data-seg="${CSS.escape(pop.id)}"]`);
    if (seg && pop.team) ui.stamp(seg, {from: .2});
  }
  if (all) {
    const pc = el.querySelector('.pk-pc');
    if (pc) ui.stamp(pc, {from: 1.35});
  }
  // Locked in: each open card's lock arrives, in kickoff order.
  if (lockPop && st.ctx.visible) {
    let i = 0;
    el.querySelectorAll('.pk-lock.is-in').forEach(lk => { if (i < 12) ui.animate(lk, [{transform: 'scale(.3)', opacity: 0}, {transform: 'scale(1)', opacity: 1}], {spring: 'bouncy', delay: i++ * 30}); });
  }
  // Submitted: each outlined mark turns solid with a small pop, in kickoff order.
  if (committed && committed.length && st.ctx.visible) {
    let i = 0;
    v.games.forEach(g => {
      if (!committed.includes(g.id)) return;
      const m = el.querySelector(`.pk-g[data-g="${CSS.escape(g.id)}"] .pk-mk.is-on`);
      if (m) ui.animate(m, [{transform: 'scale(.6)'}, {transform: 'scale(1)'}], {spring: 'bouncy', delay: Math.min(i++, 8) * 30});
    });
  }
  syncChrome();
}
function patchGame(li, g, v, pop) {
  const prev = st.seen.get(g.id);
  const locked = lockedGame(g, v.at);
  const cls = gameCls(g, v);
  if (li.className !== cls) li.className = cls;
  const main = li.querySelector('.pk-g-main');
  if (main) main.setAttribute('aria-label', `${g.away.name} at ${g.home.name}. ${statText(g, v)}`);
  ['away', 'home'].forEach(side => {
    const b = li.querySelector(`.pk-t[data-side="${side}"]`);
    if (!b) return;
    const t = g[side];
    const c = sideCls(g, t, v);
    if (b.className.replace(/\s*is-pressed/, '') !== c) b.className = c + (b.classList.contains('is-pressed') ? ' is-pressed' : '');
    b.setAttribute('aria-pressed', String(v.mine[g.id] === t.abbr));
    if (!canPick(g, v)) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    b.setAttribute('aria-label', teamLabel(g, t, side, v));
    const mk = b.querySelector('.pk-mkw');
    const mh = markHTML(g, t, v);
    if (mk && mk._html !== mh && mk.innerHTML !== mh) { mk.innerHTML = mh; mk._html = mh; }
    morph(b.querySelector('.pk-tsub'), subHTML(g, t, v));
    const sc = b.querySelector('.pk-sc');
    const s = showScore(g) && t.score != null ? String(t.score) : '';
    if (sc && sc.textContent !== s) {
      const bump = sc.textContent !== '' && s !== '' && st.ctx.visible;
      sc.textContent = s;
      if (bump) ui.animate(sc, [{transform: 'translateY(-6px)', opacity: 0}, {transform: 'none', opacity: 1}], {spring: 'smooth'});
    }
    if (pop && pop.team === t.abbr) {
      const m = b.querySelector('.pk-mk');
      if (m) ui.stamp(m, {from: .2});
      const ns = b.querySelector('.pk-ns');
      if (ns) ui.animate(ns, [{opacity: 0, transform: 'translateX(-4px)'}, {opacity: 1, transform: 'none'}], {duration: 200, easing: 'cubic-bezier(.22,1,.36,1)'});
      const lg = b.querySelector('.c-pk-logo');
      if (lg) ui.animate(lg, [{transform: 'scale(.86)'}, {transform: 'scale(1)'}], {spring: 'bouncy'});
    }
  });
  morph(li.querySelector('.pk-stat'), statHTML(g, v));
  // Footer: a div until the picks are revealed, a button (who picked whom) after.
  const foot = li.querySelector('.pk-foot');
  const where = g.where ? `<span class="pk-where">${esc(g.where)}</span>` : '';
  const fh = where + footHTML(g, v);
  const revealed = revealedOf(g, v);
  const wantBtn = revealed;
  if (foot && (foot.tagName === 'BUTTON') !== wantBtn) {
    const t = document.createElement('template');
    t.innerHTML = gameHTML(g, v);
    foot.replaceWith(t.content.firstElementChild.querySelector('.pk-foot'));
  } else if (foot) {
    morph(foot, fh);
    if (wantBtn) foot.setAttribute('aria-label', footLabel(g, v));
  }
  // Live moments seen on screen: kickoff reveals the split; the final whistle stamps your result.
  if (prev && st.ctx.visible) {
    if (!prev.revealed && revealed) {
      const bar = li.querySelector('.c-pk-bar');
      if (bar) bar.querySelectorAll('i').forEach(i => { const to = i.style.transform; ui.animate(i, [{transform: 'scaleX(0)'}, {transform: to}], {spring: 'smooth'}); });
    }
    if (!prev.locked && locked) {
      const lk = li.querySelector('.pk-lock');
      if (lk) ui.stamp(lk, {from: .4});
    }
    if (prev.state !== 'post' && g.state === 'post') {
      const m = li.querySelector('.pk-mk.is-right, .pk-mk.is-wrong');
      if (m) ui.stamp(m, {from: 1.6});
      const mine = v.mine[g.id], win = winnerOf(g);
      if (mine && win) ui.announce(`Final: ${g[g.winner].short} won. ${mine === win ? 'You got it right.' : 'You missed that one.'}`);
    }
  }
  st.seen.set(g.id, {state: g.state, locked, revealed});
}

// Compact title and actions (and the tab badge: every render and patch lands here).
function syncChrome() {
  if (!st) return;
  signalBadge();
  const t = st.week ? `Pick'em · Week ${st.week}` : "Pick'em";
  if (t !== st.titleShown) { st.titleShown = t; st.ctx.setTitle(t); }
  // Scores may be out of date (or come from this phone, refreshing): the live dots stop pulsing (they would claim a
  // game is live right now).
  const bd = st.week ? memo.boards.get(wkey(st.year, st.week)) || {} : {};
  const stale = !!(bd.stale || bd.cached);
  if (st.el.classList.contains('pk-stale') !== stale) st.el.classList.toggle('pk-stale', stale);
  const acc = st.el.querySelector('.pk-acc');
  const want = chipsHTML();
  if (acc && !want) { acc.remove(); st.ctx.refreshChrome(); }
  else if (!acc && want) {
    const lt = st.el.querySelector('.lt');
    if (lt) { lt.insertAdjacentHTML('afterend', want); st.ctx.refreshChrome(); }
  } else if (acc && want) {
    const chips = acc.querySelector('[data-chips]');
    const ids = chips ? [...chips.querySelectorAll('.chip')].map(c => c.dataset.value).join() : '';
    if (!chips || ids !== chipWeeks().join()) { const t2 = document.createElement('template'); t2.innerHTML = want; acc.replaceWith(t2.content.firstElementChild); st.ctx.refreshChrome(); }
    else {
      const sel = chips.querySelector('.chip[aria-pressed="true"]');
      if (!sel || sel.dataset.value !== String(st.week)) ui.setChips(chips, String(st.week), {scroll: true});
      const last = chips.querySelector(`.chip[data-value="${memo.cur.week}"]`);
      const b = memo.boards.get(wkey(memo.cur.year, memo.cur.week));
      const live = !!(b && b.games.some(g => g.state === 'in'));
      if (last && !!last.querySelector('.chip-dot') !== live) {
        if (live) last.insertAdjacentHTML('afterbegin', '<span class="chip-dot" aria-hidden="true"></span>'); else last.querySelector('.chip-dot').remove();
      }
    }
  }
  const lt = st.el.querySelector('.lt-eyebrow');
  const eb = eyebrowText();
  if (lt && lt.textContent !== eb) lt.textContent = eb;
  const v = st.week ? vm() : null;
  syncSubmitBar(v);
  // Undo goes when its minutes are up.
  clearTimeout(st.undoT);
  if (v && v.undo) { const s0 = st; st.undoT = setTimeout(() => on(s0, () => patch()), Math.max(1000, v.undoEnd - v.at + 250)); }
}

// ============================================================================ Picking
function gameById(id) {
  const b = st && st.week ? memo.boards.get(wkey(st.year, st.week)) : null;
  return b ? b.games.find(g => g.id === id) || null : null;
}
function tapTeam(gid, team) {
  if (!st) return;
  const g = gameById(gid);
  if (!g || (team !== g.home.abbr && team !== g.away.abbr)) return;
  const v = vm();
  if (!v.current) {
    const over = memo.cur && (st.year < memo.cur.year || st.week < memo.cur.week);
    ui.toast(over ? `Week ${st.week} is over. Picks are closed.` : `Picks for week ${st.week} aren't open yet.`, {icon: 'lock'});
    return;
  }
  if (lockedGame(g, v.at)) { ui.toast(LOCKED_MSG, {icon: 'lock'}); return; }
  if (v.lockBusy && !v.locked) { ui.toast('Locking in your picks…', {icon: 'lock'}); return; }
  if (v.locked) {
    // Locked in: the card's lock answers the tap (a small shake), and the toast says why.
    const lk = st.el.querySelector(`.pk-g[data-g="${CSS.escape(gid)}"] .pk-lock.is-in`);
    if (lk && st.ctx.visible) ui.animate(lk, [{transform: 'none'}, {transform: 'rotate(-16deg)', offset: .3}, {transform: 'rotate(12deg)', offset: .6}, {transform: 'none'}], {duration: 360, easing: 'ease-out'});
    ui.toast(v.lockPending ? 'Locking in your picks…' : lockedMsg(st.week), {icon: 'lock'});
    return;
  }
  if (tbdShut(g, v.at)) { ui.toast(TBD_MSG, {icon: 'clock'}); return; }
  if (v.off) { ui.toast(PICK_OFF, {icon: 'info'}); return; }
  // A draft on this phone, nothing written: back to what is submitted means no change (the draft goes).
  const next = (v.mine[gid] || '') === team ? '' : team;
  const dr = drafts.get(st.year, st.week);
  if (next === (v.saved[gid] || '')) delete dr[gid]; else dr[gid] = next;
  if (st.busy) st.busy.touched.add(gid); // drafted again while a submit is out: the answer leaves this one alone
  const was = submitState(v);
  putDrafts(st.year, st.week, dr);
  const v2 = vm(), cw = changeWords(v2), now2 = submitState(v2);
  ui.haptic(next ? 'light' : 'selection');
  patch({pop: next ? {id: gid, team: next} : null});
  const tm = next ? teamOf(g, next) : null;
  // The tap's announcement carries the urgent line when this tap raised it (the bar's own would be cut off by it).
  const urgent = now2 && now2.urgent && (!was || was.urgent !== now2.urgent) ? ` ${now2.urgent}.` : '';
  ui.announce(`${next ? `${tm.short} to win.` : 'Pick cleared.'}${st.retry && cw.n ? ` ${cw.text} not saved yet.` : ''}${urgent}`);
  autoSave();
}
// Save what was just tapped at once (quietly: the card already shows it). A save already on its way takes the next
// one when it answers (submit: busy.touched).
function autoSave() {
  if (!st || st.locking) return;
  if (st.busy) return; // its answer saves what was tapped meanwhile
  submit({quiet: true});
}

// Submit every change at once (week.submitPicks). The button spins meanwhile and can't be pressed again; taps on the
// cards still draft (a draft that changed meanwhile stays a draft). -> Promise of the result (null: nothing sent).
// quiet: no toast when every change went in (locking in says so instead); anything else is still said. forLock: the
// submit a lock-in makes first (any other waits while a lock-in is under way: its picks are the ones being locked).
function submit({quiet = false, forLock = false} = {}) {
  if (!st || st.busy || (st.locking && !forLock)) return Promise.resolve(null);
  const v = vm();
  const b = submitState(v);
  if (!b) return Promise.resolve(null);
  // Tried even when pick'em looks switched off: the answer ('denied') says so, and the drafts stay either way.
  const y = st.year, w = st.week, k = wkey(y, w), s0 = st, sent = Object.assign({}, v.changes), wasAll = v.sum.allIn;
  const busy = st.busy = {b, touched: new Set()};
  const nav = st.ctx.nav;
  sending.set(k, (sending.get(k) || 0) + 1);
  ui.haptic('light');
  syncSubmitBar(v);
  let p;
  try { p = week.submitPicks(y, w, sent, {games: v.games, sport: SPORT}); } catch (e) { p = Promise.reject(e); }
  return Promise.resolve(p).then(r => r && Array.isArray(r.ok) ? r : Promise.reject(new Error('submitPicks: ' + r)))
    .catch(e => { console.error(e); return {ok: [], locked: [], lockedIn: [], failed: Object.keys(sent), code: 'failed'}; })
    .then(r => {
      if (!Array.isArray(r.lockedIn)) r.lockedIn = [];
      const left = (sending.get(k) || 1) - 1;
      if (left) sending.set(k, left); else sending.delete(k);
      // The drafts first (whatever became of the screen): submitted ones match now, kicked-off ones never count (nor
      // do any once you are locked in), and the ones that didn't go through are back as they were sent unless drafted
      // again meanwhile.
      const dr = drafts.get(y, w);
      r.ok.forEach(id => { if (dr[id] === sent[id]) delete dr[id]; });
      r.locked.concat(r.lockedIn).forEach(id => { delete dr[id]; });
      r.failed.forEach(id => { if (id in sent && !busy.touched.has(id)) dr[id] = sent[id]; });
      putDrafts(y, w, dr);
      const hush = quiet && wentIn(r, sent);
      if (!on(s0, () => { settled(r, sent, wasAll, b.cw, hush); return true; }) && !hush) toastResult(r, b.cw, nav, w);
      // Taps made while this save was out go now.
      if (busy.touched.size && !r.failed.length) on(s0, () => { if (Object.keys(vm().changes).length) submit({quiet: true}); });
      return r;
    });
}
// Every change sent went in.
const wentIn = (r, sent) => !!r && !r.locked.length && !(r.lockedIn || []).length && !r.failed.length && r.ok.length === Object.keys(sent || {}).length;
function settled(r, sent, wasAll, cw, hush) {
  const s0 = st;
  st.busy = null;
  // Held as saved until the snapshot shows them confirmed (a write the server acknowledged may reach the snapshot a
  // moment after its answer); a quiet fallback after 4 s.
  r.ok.forEach(id => {
    const pd = {team: sent[id] || null, seq: ++st.seq, saved: true};
    if (snapHas(id, pd.team)) return;
    st.pending.set(id, pd);
    setTimeout(() => on(s0, () => { if (st.pending.get(id) === pd) { st.pending.delete(id); patch(); } }), 4000);
  });
  if (r.code === 'denied') st.off = true;
  // A save that didn't go through leaves those picks unsaved on this phone: the Save bar offers them again.
  st.retry = !!r.failed.length && r.code !== 'denied';
  if (r.ok.length) { dropLeaveToast(); leaveSig = ''; }
  const v = vm();
  const all = !!r.ok.length && v.sum.allIn && !wasAll && !Object.keys(v.changes).length;
  if (!hush) toastResult(r, cw, st.ctx.visible ? null : st.ctx.nav, st.week);
  patch({committed: r.ok, all});
  if (r.ok.length && !r.failed.length && !hush) ui.announce(`${v.sum.picked} of ${v.sum.n} picked.`);
}
// The toast (and haptic) for a submit's result. cw: the submitted changes as words. review: a way back to the screen
// (ctx.nav) when the answer lands while it isn't showing: anything left to submit gets a Review button. w: the week.
function toastResult(r, cw, review, w) {
  const lockedGames = r.locked.map(id => gameById(id) || (memo.cur && (memo.boards.get(wkey(memo.cur.year, memo.cur.week)) || {games: []}).games.find(g => g.id === id))).filter(Boolean);
  const names = lockedGames.map(gameName);
  const noun = cw ? cw.noun : 'pick';
  const act = review ? {action: {label: 'Review', fn: () => review('/pickem')}, duration: 4500} : {};
  if (r.code === 'denied') { ui.haptic('warning'); ui.toast(PICK_OFF, {icon: 'info'}); return; }
  // You are locked in (on another phone, or the lock hadn't shown here yet): nothing went in, and nothing will.
  const inN = (r.lockedIn || []).length;
  if (inN) {
    ui.haptic('warning');
    ui.toast(`${lockedMsg(w)} ${inN === 1 ? `That ${noun} didn't` : `Those ${noun}s didn't`} go in.`, {icon: 'lock', duration: 4500});
    return;
  }
  if (!r.ok.length && !r.locked.length) { ui.haptic('warning'); ui.toast(SUBMIT_FAIL, Object.assign({icon: 'x-circle'}, act)); return; }
  if (r.locked.length || r.failed.length) {
    // Some went in, some didn't: say which (kicked off: never counts; didn't go through: still a draft, try again).
    ui.haptic('warning');
    const bits = [];
    if (r.locked.length) {
      const them = r.locked.length === 1 ? (names[0] || 'That game') : names.length === r.locked.length ? andJoin(names) : plural(r.locked.length, 'game');
      bits.push(`${r.ok.length ? `${r.ok.length === 1 ? cap(noun) : cap(noun) + 's'} saved, but ${them}` : them} had already kicked off.`);
      bits.push(`${r.locked.length === 1 ? "That pick didn't" : "Those picks didn't"} count.`);
    } else bits.push(`${plural(r.ok.length, noun)} saved.`);
    if (r.failed.length) bits.push(`${plural(r.failed.length, noun)} didn't go through. Try again.`);
    ui.toast(bits.join(' '), Object.assign({icon: r.locked.length ? 'lock' : 'x-circle', duration: 4500}, r.failed.length ? act : {}));
    return;
  }
  ui.haptic('success');
  const done = r.ok.length === 1 ? (noun === 'change' ? 'Change saved.' : 'Pick saved.') : 'Picks saved.';
  ui.toast(r.code === 'dev' ? `${done} Saved on this device (dev).` : done, {icon: 'check-circle'});
}
// Discard: every draft of the week goes; the toast can bring them back (as long as nothing was drafted since).
function discard() {
  if (!st || st.busy || st.locking) return;
  const v = vm();
  const cw = changeWords(v);
  if (!cw.n) return;
  const y = st.year, w = st.week, before = drafts.get(y, w);
  putDrafts(y, w, {});
  dropLeaveToast(); leaveSig = '';
  ui.haptic('selection');
  patch();
  ui.toast(`${cw.n === 1 ? `${cap(cw.noun)} discarded` : `${cw.text} discarded`}.`, {icon: 'x-circle', duration: 4000, action: {label: 'Restore', fn: () => {
    putDrafts(y, w, Object.assign(before, drafts.get(y, w)));
    screens.forEach(s => on(s, () => patch()));
    ui.haptic('selection');
  }}});
}
// The snapshot shows this pick as submitted and confirmed.
function snapHas(gid, team) {
  const s = st && memo.snaps.get(wkey(st.year, st.week));
  return (savedOf(s)[gid] || null) === (team || null);
}

// ============================================================================ Locking in
// "Lock in" (the summary's lock-ins row, and the lock at the end of the Submit bar): who you are first when this phone
// never said (a lock binds your manager on every phone), then a confirm sheet, then any drafts are submitted (quietly
// when they all go in; when any don't, the submit's own toast says so and nothing is locked), then week.lockPicks.
// The button spins meanwhile, and the cards and Submit wait. Undo (on the toast, and a link in the lock-ins row) takes
// it back within week.LOCK_UNDO_MS: week.unlockPicks. from: the control that asked (focus goes back to it on "Not yet").
async function lockIn(from) {
  if (!st || st.busy || st.locking) return;
  const s0 = st, y = st.year, w = st.week;
  const ready = () => on(s0, () => {
    const v = vm();
    if (!v.current || v.locked || st.busy || st.locking) return null;
    if (v.off) { ui.toast(PICK_OFF, {icon: 'info'}); return null; }
    // The locks can't be read (the rules don't know them yet): say so before anything is submitted.
    if (v.snap && /denied/.test(String(v.snap.locksError || ''))) { ui.haptic('warning'); ui.toast(LOCK_OFF, {icon: 'info'}); return null; }
    return pickCount(v) > 0 ? v : null; // nothing to lock (drafts clearing every pick): not offered either
  });
  if (!ready()) return;
  // Focus back on the control that asked (or its twin after a re-render), else on what took its place.
  const kind = from && ['data-pk-sublock', 'data-pk-lock'].find(a => from.hasAttribute(a));
  const back = () => {
    if (s0.dead) return null;
    if (from && from.isConnected) return from;
    for (const q of [kind ? `[${kind}]:not([hidden])` : '', '[data-pk-unlock]', '[data-pk-lock]', '[data-pk-locks]', '[data-pk-submit]']) {
      const n = q && s0.el.querySelector(q);
      if (n) return n;
    }
    return null;
  };
  // "Which one are you?" never answered on this phone: asked now ("Not in the league" locks this phone only).
  if (!week.myManager() && data.meRaw() !== 'none') {
    ui.haptic('light');
    const id = await ui.pickManager({title: 'Which one are you?', allowNone: true, returnFocus: back,
      note: 'Locking in counts for you on every phone you use. Only saved on this phone.'});
    if (!id || s0.dead) return;
    data.setMe(id);
  }
  const v = ready();
  if (!v) return;
  const cw = changeWords(v), n = pickCount(v), un = unpickedOpen(v);
  const message = [`They'll be final for week ${w} — no changes, even before kickoff.`,
    cw.n ? `Your ${cw.n === 1 ? `unsubmitted ${cw.noun} goes` : `${cw.n} unsubmitted ${cw.noun}s go`} in first.` : '',
    un ? `${plural(un, 'game')} ${un === 1 ? "isn't" : "aren't"} picked. ${un === 1 ? "It'll" : "They'll"} stay unpicked.` : ''].filter(Boolean).join(' ');
  ui.haptic('light');
  const a = await ui.actionSheet({title: `Lock in your ${plural(n, 'pick')}?`, message, cls: 'sh-pk-lock',
    actions: [{label: 'Lock in', value: 'lock', role: 'primary'}, {label: 'Not yet', value: null, role: 'cancel'}], returnFocus: back});
  if (a !== 'lock' || s0.dead) return;
  ui.haptic('warning');
  if (on(s0, () => { if (st.busy || st.locking || vm().locked) return false; st.locking = true; patch(); return true; }) !== true) return;
  let ok = true;
  if (on(s0, () => Object.keys(vm().changes).length) > 0) {
    const r = await on(s0, () => submit({quiet: true, forLock: true}));
    ok = !r || (!r.locked.length && !r.failed.length && !(r.lockedIn || []).length);
  }
  let res = null;
  const asked = nowMs();
  if (ok) { try { res = await week.lockPicks(y, w, {n, sport: SPORT}); } catch (e) { console.error(e); res = 'failed'; } }
  const pop = res === 'ok' || res === 'dev';
  if (pop) { lockAsked.set(wkey(y, w), asked); putDrafts(y, w, {}); } // nothing drafted can go in any more
  if (!on(s0, () => { st.locking = false; st.lockPop = pop ? Date.now() : 0; patch(); return true; })) screens.forEach(s => on(s, () => patch()));
  if (res) lockResult(res, w, n, () => unlock(y, w));
}
function lockResult(res, w, n, undo) {
  if (res === 'ok' || res === 'dev') {
    dropLeaveToast(); leaveSig = ''; // (the confirm already buzzed: 'warning', as the Daily's lock-in does)
    const what = `Locked in. ${n === 1 ? 'Your pick is' : `All ${n} picks are`} final.`;
    ui.toast(res === 'dev' ? `${what} Saved on this device (dev).` : what, {icon: 'lock', duration: 6000, action: {label: 'Undo', fn: undo}});
    ui.announce(`${what} You can undo it for two minutes.`);
    return;
  }
  ui.haptic('warning');
  // Sent, not answered yet: Firestore delivers it once the connection lets it (the row says "Locking in…" until then).
  if (res === 'queued') ui.toast('Still locking in. It goes through once your connection does.', {icon: 'clock', duration: 4500});
  else if (res === 'denied') ui.toast(LOCK_OFF, {icon: 'info'});
  else ui.toast(LOCK_FAIL, {icon: 'x-circle'});
}
// Undo (the toast's, or the lock-ins row's link), whichever screen shows the week.
async function unlock(y, w) {
  const mine = [...screens.values()].filter(s => !s.dead && s.year === y && s.week === w);
  if (mine.some(s => s.unlocking)) return;
  mine.forEach(s => on(s, () => { st.unlocking = true; patch(); }));
  let r;
  try { r = await week.unlockPicks(y, w, {sport: SPORT}); } catch (e) { console.error(e); r = 'failed'; }
  if (r === 'ok' || r === 'dev') lockAsked.delete(wkey(y, w));
  mine.forEach(s => on(s, () => { st.unlocking = false; patch(); }));
  signalBadge();
  if (r === 'ok' || r === 'dev') {
    ui.haptic('selection');
    ui.toast('Unlocked. Your picks can change until kickoff.', {icon: 'check-circle'});
    ui.announce('Unlocked. Your picks can change until kickoff.');
  } else if (r === 'locked') {
    ui.haptic('warning');
    ui.toast(`Too late to undo. ${lockedMsg(w)}`, {icon: 'lock'});
  } else if (r === 'queued') {
    ui.haptic('warning');
    ui.toast('Still undoing. Check your connection.', {icon: 'clock'});
  } else {
    ui.haptic('warning');
    ui.toast(r === 'denied' ? LOCK_OFF : "Couldn't undo. Try again.", {icon: r === 'denied' ? 'info' : 'x-circle'});
  }
}

// ============================================================================ Leave reminder
// The leave reminder ("3 picks not submitted yet." with Review): one per set of changes (leaving again with the same
// drafts doesn't repeat it), gone as soon as the screen shows again or the drafts are submitted or discarded.
let leaveToast = null, leaveSig = '';
function dropLeaveToast() { if (leaveToast) { leaveToast.dismiss(); leaveToast = null; } }

// ============================================================================ Sheets
function whoSheet(gid) {
  const g = gameById(gid);
  if (!g) return;
  const v = vm();
  const c = crowdOf(g, v);
  const win = winnerOf(g);
  const col = side => {
    const t = g[side], l = c[side];
    return `<div class="pk-wc${win === t.abbr ? ' is-win' : ''}"><div class="pk-wc-h">${logoHTML(t, 28)}<span class="pk-wc-n">${esc(t.short)}</span><span class="n4 pk-wc-c">${l.length}</span></div>`
      + (l.length ? `<ul class="pk-wc-l">${l.map(w => `<li>${whoAvatar(w, 24)}<span>${esc(w.you ? `${w.name} (you)` : w.name)}</span></li>`).join('')}</ul>` : '<p class="pk-wc-none">Nobody</p>')
      + `</div>`;
  };
  // 'Final · Packers 24, Buccaneers 21.' / 'Q4 2:00 · Packers 24, Buccaneers 21.' / 'Postponed.'
  const when = g.state === 'in' ? clockOf(g).filter(Boolean).join(' ') : g.final ? `Final${/OT/i.test(g.detail) ? '/OT' : ''}` : offWord(g);
  const line = g.state === 'pre' ? '' : showScore(g) ? `${when} · ${scoreLine(g)}.` : `${when}.`;
  const body = `<p class="pk-sh-sub">${esc([line, `${plural(c.home.length + c.away.length, 'pick')}.`].filter(Boolean).join(' '))}</p><div class="pk-wg">${col('away')}${col('home')}</div>`;
  const s = ui.openSheet({title: `${g.away.short} at ${g.home.short}`, body, cls: 'sh-pk sh-pk-who', detents: ['medium', 'large']});
  return s;
}
// Who has locked in this week (and when, and how many picks) and who hasn't (with how many they've picked so far:
// the leaderboard shows as much). Never whose picks are whose.
function locksSheet() {
  if (!st || !st.week) return;
  const v = vm();
  const L = lockIns(v.snap);
  const nm = x => (x.w.you ? `${x.w.name} (you)` : x.w.name);
  const done = L.list.map(x => ui.row({lead: whoAvatar(x.w, 32), title: nm(x), sub: `${kickText(new Date(x.at), v.at)}${x.n ? ` · ${plural(x.n, 'pick')}` : ''}`,
    trail: `<span class="pk-ls-lk">${ui.icon('lock', {label: 'Locked in'})}</span>`, me: x.w.you, key: x.w.key})).join('');
  const not = L.not.map(x => ui.row({lead: whoAvatar(x.w, 32), title: nm(x), sub: x.picked ? `${plural(x.picked, 'pick')} submitted` : 'No picks yet',
    me: x.w.you, key: x.w.key})).join('');
  const sub = L.count ? `${L.count} of ${L.total} locked in for week ${st.week}.` : `Nobody's locked in for week ${st.week} yet.`;
  const body = `<p class="pk-sh-sub">${esc(sub)} Picks stay hidden until kickoff either way.</p>`
    + (done ? ui.group(done, {header: 'Locked in', cls: 'pk-ls-list'}) : '')
    + (not ? ui.group(not, {header: 'Not yet', cls: 'pk-ls-list'}) : '');
  ui.openSheet({title: 'Locked in', body, cls: 'sh-pk sh-pk-locks', detents: ['medium', 'large']});
}
const BOARD_SEGS = [{id: 'week', label: 'This week'}, {id: 'season', label: 'Season'}];
function boardSheet() {
  if (!st) return;
  let mode = ui.ssGet('gg-pk-board') === 'season' ? 'season' : 'week';
  const res = {week: null, season: null};
  const y = st.year, w = st.week;
  const body = () => `<div class="pk-bs-seg">${ui.seg({name: 'pk-board', items: BOARD_SEGS, value: mode, small: true, label: 'Leaderboard'})}</div><div class="pk-bs-body">${boardBody(mode, res[mode], y, w)}</div>`;
  const s = ui.openSheet({title: "Pick'em leaderboard", body: body(), cls: 'sh-pk sh-pk-board', detents: ['medium', 'large']});
  const fill = animate => {
    const b = s.body.querySelector('.pk-bs-body');
    if (!b) return;
    const put = () => { b.innerHTML = boardBody(mode, res[mode], y, w); ui.hydrate(b); };
    if (animate && !ui.RM) ui.crossfade(b, put); else put();
  };
  const load = (m, force) => {
    if (res[m] && !force) return;
    res[m] = null;
    let p;
    try { p = m === 'week' ? week.nflWeekResults(y, w, SPORT) : week.nflStandings(y, SPORT); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(r => { res[m] = Array.isArray(r) ? r : {error: (r && r.error) || 'failed'}; if (r && r.error && Array.isArray(r)) res[m].error = r.error; },
      e => { console.warn('pickem board', e); res[m] = {error: 'failed'}; })
      .then(() => { if (mode === m && s.el.isConnected) fill(true); });
  };
  s.el.addEventListener('ui:change', e => {
    if (!e.detail || e.detail.name !== 'pk-board') return;
    mode = e.detail.value === 'season' ? 'season' : 'week';
    ui.ssSet('gg-pk-board', mode);
    // Still loading: swap straight to the placeholder (no fade), so the table's arrival is the only dissolve.
    fill(res[mode] !== null);
    load(mode);
  });
  s.el.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-pk-board-retry]')) { ui.haptic('light'); load(mode, true); fill(false); } });
  load(mode);
  // The other table loads alongside, so switching to it shows it at once (no placeholder flash).
  load(mode === 'week' ? 'season' : 'week');
}
// Leaderboard rows: {who, right, decided, picked, weeks, rank}. `who` may be the person or the row itself.
function boardBody(mode, res, y, w) {
  if (res === null) return ui.skeleton('rows', 5, {label: 'Loading the leaderboard.'});
  // week.js returns an array that carries .error: 'denied' (pick'em not switched on), 'off' / 'failed' (the picks
  // didn't load), 'scores' (some week's games didn't load: those weeks are missing); .stale: old scores.
  const err = res && res.error ? String(res.error) : '';
  const retry = {label: 'Try again', attrs: {'data-pk-board-retry': ''}};
  const rows = (Array.isArray(res) ? res : []).filter(r => r && (+r.picked > 0 || +r.decided > 0 || +r.right > 0));
  if (/denied/.test(err)) return ui.empty({icon: 'info', title: PICK_OFF});
  if (err && (!Array.isArray(res) || (!rows.length && err !== 'scores'))) {
    return ui.empty({icon: 'info', title: "The leaderboard didn't load.", body: 'Check your connection and try again.', action: retry});
  }
  if (err === 'scores' && !rows.length) {
    return ui.empty({icon: 'info', title: "The games didn't load.", body: `The table needs the ${CFB ? 'college' : 'NFL'} scores. Check your connection and try again.`, action: retry});
  }
  const warn = err ? (mode === 'season' ? "Some weeks couldn't load, so this table may be incomplete." : "Some picks couldn't load, so this table may be incomplete.")
    : res && res.stale ? 'Scores may be out of date.' : '';
  const warnHTML = warn ? `<button type="button" class="pk-bs-warn" data-pk-board-retry>${ui.icon('info')}<span>${esc(warn)}</span><span class="pk-bs-warn-a">Try again</span></button>` : '';
  if (!rows.length) {
    return ui.empty({icon: 'list-number', title: mode === 'week' ? 'No picks this week yet.' : 'No standings yet.',
      body: mode === 'week' ? `The table fills in as week ${w} games go final.` : 'The table starts once a week with picks is played.'});
  }
  const list = rows.map(r => {
    const right = +r.right || 0, dec = Math.max(+r.decided || 0, right);
    return {r, w: who(r), right, lost: dec - right, dec, picked: +r.picked || 0, weeks: r.weeks};
  });
  // A phone without a manager shows as the manager its nick names (their avatar, not a grey initial) while that
  // manager has no row of their own, as on the lock-ins row; otherwise it stays itself.
  const ids = new Set(list.filter(x => x.w.id).map(x => x.w.id));
  list.forEach(x => {
    if (x.w.id) return;
    const id = nickManager(x.w.name);
    if (id && !ids.has(id)) { ids.add(id); x.w = Object.assign(who({me: id}), {you: x.w.you || id === data.me(), key: x.w.key}); }
  });
  if (list.some(x => x.r.rank == null)) {
    list.sort((a, b) => b.right - a.right || a.lost - b.lost || a.w.name.localeCompare(b.w.name));
    let rank = 0;
    list.forEach((x, i) => { if (!i || x.right !== list[i - 1].right || x.lost !== list[i - 1].lost) rank = i + 1; x.rank = rank; });
  } else list.forEach(x => { x.rank = +x.r.rank; });
  const html = list.map(x => {
    const top = x.rank === 1 && x.right > 0;
    const lead = `<span class="n5 pk-bs-rk${top ? ' gold' : ''}">${x.rank}</span>${whoAvatar(x.w, 32, {crown: top})}`;
    const wk = x.weeks != null ? (Array.isArray(x.weeks) ? x.weeks.length : +x.weeks || 0) : null;
    const pct = x.dec ? `${Math.round(100 * x.right / x.dec)}% right` : '';
    const sub = mode === 'week' ? [x.picked ? `${x.picked} picked` : '', pct].filter(Boolean).join(' · ') : [wk != null ? plural(wk, 'week') : '', pct].filter(Boolean).join(' · ');
    // This week: a lock beside the name of whoever has locked in.
    const nm = x.w.you ? `${x.w.name} (you)` : x.w.name;
    const title = nm; // who has locked in is nobody's business: no marks here
    return ui.row({lead, title, sub,
      trail: `<span class="pk-bs-v"><span class="n4">${x.right}–${x.lost}</span></span>`, me: x.w.you, key: x.w.key});
  }).join('');
  const sub = mode === 'week' ? `Week ${w}. A point for every winner called; ties count for nobody.` : `${y} season, every week with picks.`;
  return `<p class="pk-sh-sub">${esc(sub)}</p>` + warnHTML + ui.group(html, {cls: 'pk-bs-list'});
}

// ============================================================================ Lifecycle helpers
function startFollow() {
  if (!st || st.stop) return;
  const s0 = st;
  const target = st.explicit && st.week ? {year: st.year, week: st.week} : null;
  // Data-driven DOM work waits for the push animation and for scrolling to settle (ui.whenIdle).
  const later = fn => {
    if (s0.idle) s0.idle();
    s0.idle = ui.whenIdle(() => on(s0, () => { st.idle = null; fn(); schedule(); }));
  };
  st.stop = follow(target, u => on(s0, () => {
    if (u.error && u.year == null) { st.err = u.error; later(() => renderBody()); return; }
    st.err = u.error || null;
    if (!st.explicit && u.week != null && (u.week !== st.week || u.year !== st.year)) {
      // First resolution of the current week (or Tuesday's roll to the next slate).
      const had = st.week;
      st.year = u.year; st.week = u.week; st.pending.clear(); st.seen.clear();
      later(() => renderBody({fade: !!had}));
      return;
    }
    // Pick'em switched on while the screen is open (the rules got deployed): taps work again.
    if (u.snap && !u.snap.error) st.off = false;
    // Your saved picks came back: drop the optimistic copies they confirm.
    st.pending.forEach((p, gid) => { if (p.saved && snapHas(gid, p.team)) st.pending.delete(gid); });
    armDrafts(); // kickoffs may have moved; the drafts' wake-up follows the games
    later(() => patch());
  }));
  // A ?week= link opened before the current week was known: never show a week that hasn't started. A link to the
  // current week (or past it: the current week is what shows) settles on the canonical /pickem.
  if (st.explicit || targetOf(st.ctx) != null) {
    currentWeek().then(c => on(s0, () => {
      if (!st.stop) return; // hidden or gone meanwhile
      const t = targetOf(st.ctx);
      if (t != null && st.year === c.year && t >= c.week) { st.ctx.replace('/pickem'); return; }
      later(() => patch());
    }), () => {});
  }
}
function stopFollow() {
  if (!st) return;
  if (st.stop) { st.stop(); st.stop = null; }
  if (st.idle) { st.idle(); st.idle = null; }
}
// A precise wake-up at the next kickoff (the lock), on top of the 15 s tick.
function schedule() {
  if (!st) return;
  clearTimeout(st.kickT);
  const b = st.week ? memo.boards.get(wkey(st.year, st.week)) : null;
  if (!b) return;
  const at = nowMs();
  const next = b.games.filter(g => !lockedGame(g, at)).map(g => g.kickoff.getTime()).sort((x, y) => x - y)[0];
  if (next == null) return;
  const ms = next - at + 250;
  if (ms > 0 && ms < 2 ** 31 - 1) { const s0 = st; st.kickT = setTimeout(() => on(s0, () => { patch(); schedule(); }), ms); }
}
function setWeekFromCtx(ctx) {
  const sw = shownWeek(ctx);
  st.year = sw.year;
  st.week = sw.week;
  st.explicit = !!sw.explicit && !(memo.cur && sw.week === memo.cur.week && sw.year === memo.cur.year);
}
function newState(ctx, el) {
  // pending: picks just submitted, held as saved until the snapshot shows them; busy: {b} while a submit is out;
  // locking / unlocking: a lock or its undo on its way (undoT: when Undo goes; lockPop: when you just locked in, see patch).
  const s = {ctx, el, year: null, week: null, explicit: false, pending: new Map(), seen: new Map(), off: false, err: null, seq: 0,
    stop: null, idle: null, kickT: 0, shape: null, titleShown: null, busy: null, barAnim: null, locking: false, unlocking: false, undoT: 0, lockPop: 0};
  const prev = st;
  st = s;
  setWeekFromCtx(ctx);
  st = prev;
  return s;
}
function goWeek(n) {
  if (!st) return;
  const c = memo.cur;
  const path = c && +n === c.week ? '/pickem' : `/pickem?week=${n}`;
  if (st.ctx.path === path) return;
  st.ctx.replace(path);
}

function onClick(e) {
  const t = e.target.closest && e.target.closest('[data-pk-sport], [data-pick], [data-pk-who], [data-pk-board], [data-pk-retry], [data-pk-week], [data-pk-submit], [data-pk-undo], [data-pk-lock], [data-pk-sublock], [data-pk-unlock], [data-pk-locks]');
  if (!t || !st) return;
  if (t.hasAttribute('data-pk-sport')) { if (t.dataset.pkSport !== SPORT && switcher) switcher(t.dataset.pkSport, t); return; }
  if (t.hasAttribute('data-pick')) tapTeam(t.dataset.pick, t.dataset.team);
  else if (t.hasAttribute('data-pk-submit')) submit();
  else if (t.hasAttribute('data-pk-undo')) discard();
  else if (t.hasAttribute('data-pk-lock') || t.hasAttribute('data-pk-sublock')) { if (t.getAttribute('aria-disabled') !== 'true') lockIn(t); }
  else if (t.hasAttribute('data-pk-unlock')) { if (t.getAttribute('aria-disabled') !== 'true') unlock(st.year, st.week); }
  else if (t.hasAttribute('data-pk-locks')) { ui.haptic('light'); locksSheet(); }
  else if (t.hasAttribute('data-pk-who')) { ui.haptic('light'); whoSheet(t.dataset.pkWho); }
  else if (t.hasAttribute('data-pk-board')) { ui.haptic('light'); boardSheet(); }
  else if (t.hasAttribute('data-pk-week')) { ui.haptic('light'); goWeek(t.dataset.pkWeek); }
  else if (t.hasAttribute('data-pk-retry')) {
    ui.haptic('light');
    st.err = null;
    stopFollow();
    renderBody();
    currentWeek(true).catch(() => {});
    startFollow();
  }
}

// ============================================================================ View
// This league's screen. The tab's view is ROOT below, which shows this one or the other league's.
const VIEW = {
  id: 'pickem',
  title: ctx => {
    const q = ctx && ctx.query && ctx.query.week;
    return /^\d{1,2}$/.test(q || '') ? `Pick'em · Week ${+q}` : "Pick'em";
  },
  actions: () => [{id: 'board', icon: 'medal', label: 'Leaderboard'}],

  render(ctx) {
    // render is pure: it reads the module memo (filled by an earlier visit) and the route, nothing else.
    // The markup helpers read the screen state `st`: a throwaway one for this route (restored right after).
    const prev = st;
    st = newState(ctx, null);
    try { return titleHTML() + leagueTabsHTML() + chipsHTML() + `<div class="pk-main">${bodyHTML()}</div>` + submitBarHTML(st.week ? vm() : null); } finally { st = prev; }
  },

  mount(el, ctx) {
    const s = newState(ctx, el);
    screens.set(ctx, s);
    s.onClick = e => on(s, () => onClick(e));
    el.addEventListener('click', s.onClick);
    // A logo that fails to load falls back to the team's abbreviation.
    el.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && i.closest('.c-pk-logo')) i.closest('.c-pk-logo').classList.add('is-broken'); }, true);
    el.addEventListener('ui:change', e => {
      if (!e.detail || e.detail.name !== 'pk-week') return;
      on(s, () => goWeek(e.detail.value));
    });
    on(s, () => {
      st.shape = shapeKey();
      markShown(el);
      syncChrome();
    });
    if (ctx.first) ui.stagger(el);
    // Kickoffs lock games while you watch: re-check every 15 s (paused while hidden) and at each kickoff.
    s.untick = ctx.timer(() => on(s, () => patch()), 15000);
    on(s, startFollow); // async: the first data lands through ui.whenIdle, after the push
  },

  onShow(ctx) {
    on(screens.get(ctx), () => {
      dropLeaveToast(); // back here: the Submit bar says it now
      if (!st.stop) startFollow();
      schedule();
    });
  },

  onHide(ctx) {
    // Stop polling ESPN while the screen is out of sight (it restarts, from the cache, when shown again).
    on(screens.get(ctx), () => {
      stopFollow();
      clearTimeout(st.kickT);
      // Leaving with drafts that aren't submitted: say so on the way out, once per set of changes (the tab's dot stays
      // on until they are). Not while a submit is out (its answer says what's left, with a way back) nor while
      // pick'em is switched off (nothing could be submitted).
      const v = st.week && !st.busy && st.retry ? vm() : null;
      const cw = v && !v.off ? changeWords(v) : null;
      if (!cw || !cw.n) return;
      const sig = wkey(st.year, st.week) + JSON.stringify(v.changes);
      if (sig === leaveSig) return;
      dropLeaveToast();
      leaveSig = sig;
      leaveToast = ui.toast(`${cw.text} not saved yet.`, {icon: 'clock', duration: 3500, action: {label: 'Review', fn: () => ctx.nav('/pickem')}});
    });
  },

  update(ctx) {
    on(screens.get(ctx), () => updateScreen(ctx));
  },

  onAction(id, ctx) {
    if (id === 'board') on(screens.get(ctx), boardSheet);
  },

  unmount(el, ctx) {
    const s = screens.get(ctx);
    if (!s) return;
    on(s, () => {
      el.removeEventListener('click', s.onClick);
      stopFollow();
      clearTimeout(st.kickT);
      clearTimeout(st.undoT);
      if (s.untick) s.untick();
    });
    s.dead = true;
    screens.delete(ctx);
  }
};

// A route change (?week=), a new "me" or new data, for the screen `st`.
function updateScreen(ctx) {
  if (ctx.reason === 'params') {
    const was = `${st.year}-${st.week}-${st.explicit}`;
    setWeekFromCtx(ctx);
    // A ?week= link to the current week (or past it) shows the current week: its address is /pickem.
    if (!st.explicit && targetOf(ctx) != null && memo.cur) ctx.replace('/pickem');
    if (`${st.year}-${st.week}-${st.explicit}` === was && st.week) { patch(); return; }
    stopFollow();
    st.pending.clear(); st.seen.clear(); st.err = null;
    renderBody({fade: true});
    const sc = ctx.screen, acc = st.el.querySelector('.pk-acc'), main = st.el.querySelector('.pk-main');
    if (sc && acc && main) {
      const nav = sc.querySelector(':scope > .nav');
      const top = main.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (nav ? nav.offsetHeight : 44) - acc.offsetHeight - 8;
      if (sc.scrollTop > top) sc.scrollTop = Math.max(0, top);
    }
    if (ctx.visible) startFollow();
    return;
  }
  // 'me' (your ring and "(you)") and 'data': render afresh in place.
  renderBody();
}

// ============================================================================ League switch
// The Pick'em tab's view (the NFL instance's default export): the league last chosen on this phone ('gg-pk-sport'),
// NFL unless it was College. A tap on the other league's tab unmounts this screen and mounts the other instance's in
// the same screen body (a cross-fade; the tab bar slides over); ?week= belongs to the league left behind and goes.
export const view = VIEW;
let switcher = null;
/** The league tabs' handler (the root sets it on both instances): fn(sport, tabButton). */
export function setSwitcher(fn) { switcher = fn; }

const SPORT_KEY = 'gg-pk-sport';
const host = {sport: ui.lsGet(SPORT_KEY) === 'cfb' ? 'cfb' : 'nfl', cfb: null, cfbP: null, on: VIEW, el: null, ctx: null};
function loadCfb() {
  if (!host.cfbP) {
    host.cfbP = import('./pickem.js?sport=cfb').then(m => { host.cfb = m; m.setSwitcher(switchTo); return m; });
    host.cfbP.catch(() => { host.cfbP = null; });
  }
  return host.cfbP;
}
const shown = () => (host.sport === 'cfb' && host.cfb ? host.cfb.view : VIEW);
async function switchTo(sport) {
  sport = sport === 'cfb' ? 'cfb' : 'nfl';
  ui.lsSet(SPORT_KEY, sport);
  host.sport = sport;
  if (sport === 'cfb') {
    try { await loadCfb(); } catch (e) { console.error(e); ui.toast("College didn't load. Try again.", {icon: 'x-circle'}); host.sport = 'nfl'; ui.lsSet(SPORT_KEY, 'nfl'); return; }
  }
  swap(true);
}
function swap(animate) {
  const el = host.el, ctx = host.ctx, next = shown();
  if (!el || !ctx || !el.isConnected || next === host.on) return;
  const tab = sp => el.querySelector(`.pk-lg-t[data-pk-sport="${sp}"] .pk-lg-u`);
  const from = tab(next === VIEW ? 'cfb' : 'nfl');
  const r0 = from && from.getBoundingClientRect();
  const old = host.on;
  try { if (old.onHide) old.onHide(ctx); old.unmount(el, ctx); } catch (e) { console.error(e); }
  host.on = next;
  const put = () => { el.innerHTML = next.render(ctx); ui.hydrate(el); next.mount(el, ctx); };
  if (animate && ctx.visible && !ui.RM) ui.crossfade(el, put, {duration: 160}); else put();
  if (ctx.query && ctx.query.week) ctx.replace('/pickem');
  ctx.refreshChrome();
  if (ctx.visible && next.onShow) next.onShow(ctx);
  // The bar under the tabs slides from the league left to the new one.
  const to = tab(host.sport);
  if (animate && r0 && to && ctx.visible && !ui.RM) {
    const r1 = to.getBoundingClientRect();
    if (r1.width) ui.animate(to, [{transform: `translateX(${r0.left - r1.left}px) scaleX(${r0.width / r1.width})`}, {transform: 'none'}], {spring: 'snappy'});
  }
  if (animate) { ui.haptic('selection'); ui.announce(`${next === VIEW ? 'NFL' : 'College'} pick'em.`); }
}
setSwitcher(switchTo);

const ROOT = {
  id: 'pickem',
  title: ctx => shown().title(ctx),
  actions: ctx => VIEW.actions(ctx),
  render(ctx) { host.on = shown(); return host.on.render(ctx); },
  mount(el, ctx) {
    host.el = el; host.ctx = ctx;
    host.on.mount(el, ctx);
    // College was last chosen but isn't loaded yet: NFL shows meanwhile, then College takes over.
    if (host.sport === 'cfb' && !host.cfb) loadCfb().then(() => swap(false), () => { host.sport = 'nfl'; });
  },
  onShow(ctx) { if (host.on.onShow) host.on.onShow(ctx); },
  onHide(ctx) { if (host.on.onHide) host.on.onHide(ctx); },
  update(ctx) { if (host.on.update) host.on.update(ctx); },
  onAction(id, ctx) { if (host.on.onAction) host.on.onAction(id, ctx); },
  unmount(el, ctx) { host.on.unmount(el, ctx); if (host.el === el) { host.el = null; host.ctx = null; } }
};
export default CFB ? VIEW : ROOT;
