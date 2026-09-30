// NFL Pick'em (#/pickem, optional ?week=N): pick the winner of every real NFL game of the week. Pushed on any tab.
// Owner: PICKEM-VIEWS.
//   Large title (eyebrow "NFL · Week 4") · sticky week chips (week 1 through the current one) · summary card (your
//   progress, your record, next kickoff or games live, the week's leader; opens the leaderboard) · games grouped by
//   slot (Thursday night, Sunday morning (international), Sunday early, Sunday late, Sunday night, Monday night),
//   each a card: away and home as two big tap targets with logos, records and the kickoff in local time; after
//   kickoff a lock, the live score and clock, then Final with your pick marked right or wrong, the pick split bar and
//   who picked whom (sheet). Previous weeks are read-only results. Leaderboard sheet: This week / Season.
// Data: js/core/nfl.js (ESPN scoreboard: scoreboard, currentWeek, watch) and js/core/week.js (pickemWeek,
//   subscribeNflPicks, pickGame, clearPick, nflWeekResults, nflStandings). Nothing here writes anywhere but through
//   week.js (dev hosts save to its local stand-in).
// Exports (the Rivals card uses them; Today may): summarize(), leaderText(), follow(), currentWeek(), logoURL(),
//   kickText(), recText().
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as week from '../core/week.js';
import * as nfl from '../core/nfl.js';

const esc = data.esc;
const PICK_OFF = "Pick'em isn't switched on yet.";
const LOCKED_MSG = 'That game has kicked off. Picks are locked.';
const WEEKS = 18; // regular season
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
  const abbr = String(t.abbr || t.abbreviation || '').toUpperCase().slice(0, 4);
  const sc = t.score;
  return {
    abbr, name: String(t.name || t.displayName || abbr), short: String(t.short || t.shortName || t.shortDisplayName || t.name || abbr),
    logo: typeof t.logo === 'string' ? t.logo : '', score: sc == null || sc === '' || !isFinite(+sc) ? null : +sc,
    winner: t.winner === true, record: typeof t.record === 'string' ? t.record : ''
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
    home, away, where: g.intl ? String(g.city || g.intl).replace(/ (De|Da|Do|Del|La) /g, m => m.toLowerCase()) : '', tv: typeof g.tv === 'string' ? g.tv : ''};
}
function normBoard(b) {
  if (!b) return null;
  const games = (Array.isArray(b.games) ? b.games : []).map(normGame).filter(Boolean).sort((x, y) => x.kickoff - y.kickoff || x.id.localeCompare(y.id));
  return {year: +b.year || null, week: +b.week || null, games, stale: !!b.stale, error: b.error || null};
}
const lockedGame = (g, at = nowMs()) => !!g && (g.state !== 'pre' || at >= g.kickoff.getTime());
// The winning team's abbreviation once a game is final; null before, and for a tie or a game that never finished.
const winnerOf = g => g && g.state === 'post' && g.final && g.winner ? g[g.winner].abbr : null;
// Scores show while a game is on and once it is final; a game that never finished shows none (ESPN sends 0–0).
const showScore = g => g.state === 'in' || (g.state === 'post' && g.final);
const scoreLine = g => `${g.away.short} ${g.away.score ?? 0}, ${g.home.short} ${g.home.score ?? 0}`;
export const recText = r => String(r || '').replace(/-/g, '–');

// Team logos: ESPN's 500 px logos are 4096 px PNGs (300-500 KB each). The combiner resizes them on ESPN's side
// (about 5 KB) and the 500-dark set reads on the app's dark surfaces (Cowboys, Giants, Jets, Titans...).
export function logoURL(t, px = 64) {
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
 * The week at a glance, for the screen, the Rivals card and Today:
 * {n, picked, right, wrong, decided (final untied games), live, open (not kicked off), done (all final),
 *  next (Date of the next kickoff or null), allIn (every open game picked), leaders: [{w, right, wrong}], best,
 *  people (pickers seen so far), mineMap}
 * `mine` overrides snap.mine (the screen's optimistic picks).
 */
export function summarize(games, snap, {mine, at = nowMs()} = {}) {
  const G = (games || []).map(g => g && g.kickoff instanceof Date && g.home && g.home.abbr ? g : normGame(g)).filter(Boolean);
  const M = mine || (snap && snap.mine) || {};
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

// ============================================================================ Following a week (screen, Rivals, Today)
// Module memo: the last board and picks per week, so a re-mounted screen paints at once (nfl.js keeps its own caches).
const memo = {cur: null, boards: new Map(), snaps: new Map()};
const wkey = (y, w) => `${y}-w${w}`;
let curP = null, curT = 0;
/** The pick'em week (nfl.js / week.js decide: the current ESPN week, or the next one once every game is final). */
export function currentWeek(force) {
  if (!force && curP && Date.now() - curT < 60e3) return curP;
  curT = Date.now();
  const get = typeof week.pickemWeek === 'function' ? () => week.pickemWeek() : () => nfl.currentWeek();
  curP = Promise.resolve().then(get).then(r => {
    if (!r || !isFinite(+r.week)) throw new Error('No pick\'em week');
    memo.cur = {year: +r.year, week: +r.week};
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
      unW = nfl.watch(y, w, b => {
        if (dead) return;
        const nb = normBoard(Object.assign({year: y, week: w}, Array.isArray(b) ? {games: b} : b));
        const old = memo.boards.get(k);
        // A failed poll keeps the last good games (nfl.js reports stale; never blank a painted slate).
        if (!nb.games.length && old && old.games.length && (nb.stale || nb.error)) memo.boards.set(k, Object.assign({}, old, {stale: true}));
        else memo.boards.set(k, nb);
        emit();
        if (!target && nb.games.length && nb.games.every(g => g.state === 'post')) roll();
      });
    } catch (e) { console.error(e); emit({error: 'games'}); }
    try {
      if (typeof week.subscribeNflPicks === 'function') {
        unS = week.subscribeNflPicks(y, w, s => { if (dead || !s) return; memo.snaps.set(k, s); emit(); });
      }
    } catch (e) { console.error(e); }
  };
  // The followed current week finished: ask ESPN again (fresh), and move on once the pick'em week has; else try
  // again in 10 minutes (nothing polls a finished week).
  const roll = (ms = 1500) => {
    if (rollT || dead) return;
    rollT = setTimeout(() => {
      rollT = 0;
      Promise.resolve().then(() => nfl.currentWeek({fresh: true})).catch(() => null).then(() => currentWeek(true))
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
    if (memo.cur) start(memo.cur.year, memo.cur.week);
    resolve();
    try { addEventListener('online', onOnline); } catch (_) {}
  }
  return () => {
    dead = true; clearTimeout(rollT); clearTimeout(retryT);
    try { removeEventListener('online', onOnline); } catch (_) {}
    stopInner();
  };
}

// ============================================================================ Screen state
// A Pick'em screen can be pushed on more than one tab at once (Today's This week card, the Rivals card), so each
// mounted screen keeps its own state (screens: ctx -> state). The helpers below all read `st`, the screen being
// worked on: every entry point (lifecycle hooks, events, timers, data callbacks) runs through on(state, fn), which
// points `st` at that screen for the call and restores it after.
let st = null;
const screens = new Map();
function on(s, fn) {
  if (!s || s.dead) return undefined;
  const prev = st;
  st = s;
  try { return fn(); } finally { st = prev; }
}

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

// The view model: the week's board and picks, with your optimistic picks on top.
function vm() {
  const k = wkey(st.year, st.week);
  const board = st.week ? memo.boards.get(k) || null : null;
  const snap = st.week ? memo.snaps.get(k) || null : null;
  const mine = Object.assign({}, snap && snap.mine ? snap.mine : {});
  st.pending.forEach((p, gid) => { if (p.team) mine[gid] = p.team; else delete mine[gid]; });
  const at = nowMs();
  const games = board ? board.games : [];
  const sum = summarize(games, snap, {mine, at});
  const err = snap && snap.error ? String(snap.error) : '';
  return {board, snap, games, mine, at, sum, current: isCurrent({year: st.year, week: st.week}),
    off: st.off || /denied/.test(err), picksErr: err && !/denied/.test(err) ? err : '', loadingPicks: !snap};
}

// ============================================================================ Markup
// The eyebrow: "NFL · Week 4" (the season before the week is known).
const eyebrowText = () => (st && st.week ? `NFL · Week ${st.week}` : `NFL · ${st && st.year ? st.year : seasonYear()}`);
function titleHTML() {
  return ui.largeTitle({eyebrow: eyebrowText(), title: "Pick'em"});
}
// The week chips: from the season's first pick'em week (weeks before it never had picks) to the current week. Hidden
// while there is only one week to show.
const FIRST_WEEK = {2026: 4};
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
    const c = win && picked ? (t === win ? 'is-right' : 'is-wrong') : picked ? 'is-on' : g.state === 'in' ? 'is-live' : '';
    return `<i class="${c}" data-seg="${esc(g.id)}"></i>`;
  }).join('')}</span>`;
}
function sumHTML(v) {
  const s = v.sum;
  const played = s.right + s.wrong;
  const past = !v.current;
  // Tile 1: progress. Tile 2: your record. Tile 3: what's next.
  const allIn = !past && s.allIn;
  const t1 = `<div class="pk-tile${allIn ? ' is-all' : ''}"><span class="pk-tv"><span class="n2 pk-pc">${s.picked}</span><span class="pk-of">of ${s.n}</span></span>`
    + `<span class="pk-tl">${allIn ? `${ui.icon('check')}All in` : 'Picked'}</span></div>`;
  const t2 = `<div class="pk-tile"><span class="pk-tv"><span class="n2${played ? '' : ' ink3'}">${played ? `${s.right}–${s.wrong}` : '0–0'}</span></span>`
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
  const leadRow = `<button type="button" class="pk-lead" data-pk-board aria-haspopup="dialog" aria-label="${esc(`Leaderboard. ${leadTxt}`)}">`
    + (s.leaders.length ? `<span class="pk-lead-av">${ui.avatarStack(s.leaders.slice(0, 3).map(r => stackItem(r.w)), {max: 3, size: 28})}</span>` : `<span class="pk-lead-av is-ic">${ui.icon('medal')}</span>`)
    + `<span class="pk-lead-tx"><span class="ovl pk-lead-o">Leaderboard</span><span class="pk-lead-t">${esc(leadTxt)}</span></span>`
    + ui.icon('chevron-right', {cls: 'chev'}) + `</button>`;
  const say = `${s.picked} of ${s.n} picked. ${played ? `Your record ${s.right} and ${s.wrong}.` : ''} ${s.live ? `${plural(s.live, 'game')} ${stale ? 'last seen live' : 'live'}.` : s.next && !past ? `Next kickoff ${kickText(s.next)}.` : s.open && !past ? 'Kickoff times to be decided.' : ''}`;
  return `<div class="card pk-sum" data-enter><p class="sr-only">${esc(say)}</p><div class="pk-tiles" aria-hidden="true">${t1}${t2}${t3}</div>${stripHTML(v)}${leadRow}</div>`;
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
    const s = b ? summarize(b.games, memo.snaps.get(wkey(c.year, c.week)) || null) : null;
    const txt = s && s.open && !s.allIn ? (s.picked ? `Week ${c.week}: ${s.picked} of ${s.n} picked` : `Week ${c.week} picks are open`) : `Back to week ${c.week}`;
    out.push(`<button type="button" class="pk-banner is-go" data-pk-week="${c.week}">${ui.icon('football')}<span>${esc(txt)}</span>${ui.icon('chevron-right', {cls: 'chev'})}</button>`);
  }
  return out.join('');
}
function noteHTML(v) {
  if (!v.current || v.sum.done) return v.sum.n ? `<p class="pk-note">${v.current ? 'Every game is final.' : `Week ${st.week} is final.`} A point for every winner you called; a tie counts for nobody.</p>` : '';
  if (!v.sum.open || v.off) return '';
  return `<p class="pk-note">Tap a team to pick it. Tap again to clear. Each game locks at kickoff.</p>`;
}

// Status column: kickoff time, the live clock, or Final.
function statHTML(g, v) {
  const locked = lockedGame(g, v.at);
  const lock = locked ? ui.icon('lock', {cls: 'pk-lock'}) : '';
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
  if (g.tbd) return `<span class="pk-s1">Kickoff</span><span class="pk-s2">TBD</span>`;
  if (g.kickoff.getTime() - v.at > 6 * 864e5) return `<span class="pk-s1">${esc(dateShort(g.kickoff))}</span><span class="pk-s2">${esc(timeShort(g.kickoff))}</span>`;
  // The slot header already names the day (and the time when every game in the slot shares it): the card shows the
  // TV network in the day's place, and drops a time that is the same for the whole slot.
  const sl = slotInfo(g, v), tv = tvShort(g.tv);
  const s1 = sl.oneDay ? tv : dayShort(g.kickoff);
  const s2 = sl.oneDay && sl.oneTime && s1 ? '' : timeShort(g.kickoff);
  return (s1 ? `<span class="pk-s1">${esc(s1)}</span>` : '') + (s2 ? `<span class="pk-s2">${esc(s2)}</span>` : '');
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
// A game you can still pick: this week's, not kicked off, pick'em switched on.
const canPick = (g, v) => v.current && !v.off && !lockedGame(g, v.at);
function markHTML(g, t, v) {
  const mine = v.mine[g.id];
  const win = winnerOf(g);
  if (mine === t.abbr) {
    if (win) return mine === win ? `<span class="pk-mk is-right">${ui.icon('check')}</span>` : `<span class="pk-mk is-wrong">${ui.icon('x')}</span>`;
    // A tie (or a game that never finished) grades as no pick: a neutral mark.
    if (g.state === 'post') return `<span class="pk-mk is-push">${ui.icon('check')}</span>`;
    return `<span class="pk-mk is-on">${ui.icon('check')}</span>`;
  }
  return canPick(g, v) ? `<span class="pk-mk is-open"></span>` : '';
}
function teamLabel(g, t, side, v) {
  const other = side === 'away' ? g.home : g.away;
  const mine = v.mine[g.id];
  const win = winnerOf(g);
  const bits = [`${t.name}${t.record ? `, ${recText(t.record)}` : ''}`];
  if (showScore(g) && t.score != null) bits.push(`${t.score} points${win === t.abbr ? ', won' : ''}`);
  if (mine === t.abbr) bits.push(win ? (win === t.abbr ? 'Your pick, right' : 'Your pick, wrong') : g.state === 'post' ? 'Your pick. No result, so it counts for nobody' : 'Your pick');
  if (canPick(g, v)) bits.push(mine === t.abbr ? 'Tap to clear' : `Pick to beat the ${other.short}`);
  return bits.join('. ');
}
function sideCls(g, t, v) {
  const mine = v.mine[g.id];
  const win = winnerOf(g);
  // Before kickoff the side you didn't pick steps back; after it, winning and losing carry the emphasis.
  return `pk-t${mine === t.abbr ? ' is-on' : mine && g.state === 'pre' ? ' is-dim' : ''}${win ? (win === t.abbr ? ' is-win' : ' is-lose') : ''}${canPick(g, v) ? '' : ' is-locked'}`;
}
function sideHTML(g, side, v) {
  const t = g[side];
  const sc = showScore(g) && t.score != null ? String(t.score) : '';
  return `<button type="button" class="${sideCls(g, t, v)}" data-pick="${esc(g.id)}" data-team="${esc(t.abbr)}" data-side="${side}" aria-pressed="${v.mine[g.id] === t.abbr}"`
    + `${canPick(g, v) ? '' : ' aria-disabled="true"'} aria-label="${esc(teamLabel(g, t, side, v))}">`
    + logoHTML(t, 32)
    + `<span class="pk-tn"><span class="pk-tnm">${esc(t.short)}</span><span class="pk-trec">${esc(recText(t.record))}</span></span>`
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
  // Your own tap shows in the count before the server has it.
  const saved = v.snap && v.snap.mine ? v.snap.mine[g.id] : null;
  const eff = v.mine[g.id];
  if (!lockedGame(g, v.at)) n = Math.max(0, n - (saved ? 1 : 0) + (eff ? 1 : 0));
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
  return g.tbd ? 'Kickoff time to be decided' : `Kickoff ${kickText(g.kickoff, v.at)}`;
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
    return (v.board.stale || v.board.error ? errHTML() : ui.empty({icon: 'calendar', title: 'No games this week.', body: `Week ${st.week} has no NFL games on the schedule.`}));
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
function patch({pop = null, all = false} = {}) {
  if (!st) return;
  if (shapeKey() !== st.shape) { renderBody(); return; }
  if (!st.week) return;
  const v = vm();
  if (!v.board || !v.games.length) return;
  const el = st.el;
  const sum = el.querySelector('.pk-sum');
  if (sum) {
    const t = document.createElement('template');
    t.innerHTML = sumHTML(v);
    const n = t.content.firstElementChild;
    n.removeAttribute('data-enter');
    const html = n.innerHTML;
    if (sum._html !== html) {
      const focusBoard = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-pk-board]');
      sum.innerHTML = html;
      sum._html = html;
      if (focusBoard) { const b = sum.querySelector('[data-pk-board]'); if (b) b.focus({preventScroll: true}); }
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

// Compact title and actions.
function syncChrome() {
  if (!st) return;
  const t = st.week ? `Pick'em · Week ${st.week}` : "Pick'em";
  if (t !== st.titleShown) { st.titleShown = t; st.ctx.setTitle(t); }
  // Scores may be out of date: the live dots stop pulsing (they would claim a game is live right now).
  const stale = !!(st.week && (memo.boards.get(wkey(st.year, st.week)) || {}).stale);
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
  if (v.off) { ui.toast(PICK_OFF, {icon: 'info'}); return; }
  const was = v.mine[gid] || null;
  const next = was === team ? null : team;
  const seq = ++st.seq;
  st.pending.set(gid, {team: next, seq});
  const after = vm();
  const all = !!next && after.sum.allIn && !v.sum.allIn;
  ui.haptic(all ? 'success' : next ? 'light' : 'selection');
  patch({pop: next ? {id: gid, team: next} : null, all});
  const tm = next ? (next === g.home.abbr ? g.home : g.away) : null;
  ui.announce(next ? `${tm.short} to win. ${all ? `All ${after.sum.open} open games picked.` : `${after.sum.picked} of ${after.sum.n} picked.`}` : `Pick cleared. ${after.sum.picked} of ${after.sum.n} picked.`);
  let p;
  try { p = next ? week.pickGame(gid, next) : week.clearPick(gid); } catch (e) { console.error(e); p = 'failed'; }
  const s0 = st;
  Promise.resolve(p).then(r => r, e => { console.error(e); return 'failed'; }).then(r => on(s0, () => {
    const pd = st.pending.get(gid);
    if (!pd || pd.seq !== seq) return; // a newer tap owns this game
    if (r === 'ok' || r === 'dev') {
      // Held until the snapshot shows it (Firestore echoes local writes at once); a quiet fallback after 4 s.
      pd.saved = true;
      if (snapHas(gid, next)) { st.pending.delete(gid); patch(); }
      else setTimeout(() => on(s0, () => { if (st.pending.get(gid) === pd) { st.pending.delete(gid); patch(); } }), 4000);
      return;
    }
    st.pending.delete(gid);
    if (r === 'locked') { ui.toast(LOCKED_MSG, {icon: 'lock'}); }
    else if (r === 'denied') { st.off = true; ui.toast(PICK_OFF, {icon: 'info'}); }
    else ui.toast("Couldn't save your pick. Try again.", {icon: 'x-circle'});
    ui.announce(r === 'locked' ? LOCKED_MSG : r === 'denied' ? PICK_OFF : "Couldn't save your pick.");
    patch();
  }));
}
function snapHas(gid, team) {
  const s = st && memo.snaps.get(wkey(st.year, st.week));
  const m = s && s.mine ? s.mine[gid] || null : null;
  return m === (team || null);
}

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
    try { p = m === 'week' ? week.nflWeekResults(y, w) : week.nflStandings(y); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(r => { res[m] = Array.isArray(r) ? r : {error: (r && r.error) || 'failed'}; if (r && r.error && Array.isArray(r)) res[m].error = r.error; },
      e => { console.warn('pickem board', e); res[m] = {error: 'failed'}; })
      .then(() => { if (mode === m && s.el.isConnected) fill(true); });
  };
  s.el.addEventListener('ui:change', e => {
    if (!e.detail || e.detail.name !== 'pk-board') return;
    mode = e.detail.value === 'season' ? 'season' : 'week';
    ui.ssSet('gg-pk-board', mode);
    fill(true);
    load(mode);
  });
  s.el.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-pk-board-retry]')) { ui.haptic('light'); load(mode, true); fill(false); } });
  load(mode);
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
    return ui.empty({icon: 'info', title: "The games didn't load.", body: 'The table needs the NFL scores. Check your connection and try again.', action: retry});
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
    return ui.row({lead, title: x.w.you ? `${x.w.name} (you)` : x.w.name, sub,
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
    later(() => patch());
  }));
  // A ?week= link opened before the current week was known: never show a week that hasn't started.
  if (st.explicit) {
    currentWeek().then(c => on(s0, () => {
      if (!st.stop) return; // hidden or gone meanwhile
      if (st.year === c.year && st.week > c.week) { st.ctx.replace('/pickem'); return; }
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
  const s = {ctx, el, year: null, week: null, explicit: false, pending: new Map(), seen: new Map(), off: false, err: null, seq: 0,
    stop: null, idle: null, kickT: 0, shape: null, titleShown: null};
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
  const t = e.target.closest && e.target.closest('[data-pick], [data-pk-who], [data-pk-board], [data-pk-retry], [data-pk-week]');
  if (!t || !st) return;
  if (t.hasAttribute('data-pick')) tapTeam(t.dataset.pick, t.dataset.team);
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
export default {
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
    try { return titleHTML() + chipsHTML() + `<div class="pk-main">${bodyHTML()}</div>`; } finally { st = prev; }
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
    ctx.timer(() => on(s, () => patch()), 15000);
    on(s, startFollow); // async: the first data lands through ui.whenIdle, after the push
  },

  onShow(ctx) {
    on(screens.get(ctx), () => {
      if (!st.stop) startFollow();
      schedule();
    });
  },

  onHide(ctx) {
    // Stop polling ESPN while the screen is out of sight (it restarts, from the cache, when shown again).
    on(screens.get(ctx), () => {
      stopFollow();
      clearTimeout(st.kickT);
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
