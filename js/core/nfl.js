// NFL scoreboard client: the real games of an NFL week, from ESPN's public site API (CORS allowed, no key).
// Feeds the NFL pick'em (week.js). Parsing, fetch, caches and polling only: no DOM rendering, no Firebase.
// Owner: PICKEM-CORE.
//
//   scoreboard(year, week, {fresh})  -> Promise<{year, week, games, stale, at}>
//   currentWeek({fresh})             -> Promise<{year, week, espnWeek, seasontype, weeks, advanced, stale}>
//   watch(year, week, fn)            -> unsubscribe; fn({year, week, games, stale, at, error})
//   lookup(gameId)                   -> {year, week, game} from what is already in memory, or null
//   parse(json, want), pickWeek(board), gameStarted(game, at)   (pure; exported for the checks)
//
// A game:  {id ('401872964'), kickoff: Date, tbd (time not set yet), state: 'pre'|'in'|'post', status (ESPN's
//           STATUS_* name), detail ('10/1 - 8:15 PM EDT' | '4:12 - 3rd' | 'Halftime' | 'Final' | 'Final/OT'),
//           period, clock ('4:12'), final (a real result: post and completed, not postponed or canceled),
//           tie (final with no winner), winner: 'home'|'away'|null, home, away, label ('PIT @ CLE'),
//           name ('Pittsburgh Steelers at Cleveland Browns'), neutral, site, city, country, intl (the country
//           when it is not the USA, e.g. 'England', else ''), note ('NFL London Games' or ''), tv ('Prime Video')}
// A team:  {id, abbr ('PIT'), name ('Pittsburgh Steelers'), short ('Steelers'), logo (https://a.espncdn.com/...),
//           color ('#000000' or null), alt, score (number; null before kickoff: ESPN sends '0'), winner (bool,
//           final games only), record ('2–1', en dash; '' when ESPN has none)}
// Games are sorted by kickoff (ESPN's order within a kickoff). Treat everything returned as read-only.
//
// "This week" for the pick'em (currentWeek): ESPN's current regular-season week, or the next one once every game
// in it is over (the Tuesday after Monday night already shows next week; a postponed game waits for ESPN). Preseason -> week 1; postseason and
// offseason -> the last regular-season week (the pick'em is regular season only for now).
//
// Caches: in memory per week (20 s while a game is live or due to start, 5 min otherwise, for good once every
// game is over: final or canceled, never postponed or suspended), plus localStorage 'gg-nfl-<year>-w<week>' for
// weeks where every game is over (never fetched again) and 'gg-nfl-cur' (the last pick'em week and ESPN's calendar, for an offline start). A failed fetch keeps
// the last data and reports stale: true. The service worker never caches ESPN (cross-origin).
//
// College (the College pick'em): `cfb` is the same client for ESPN's college-football scoreboard, its own caches
// ('gg-cfb-...') and pollers: cfb.scoreboard / currentWeek / watch / lookup / __dev / REG_WEEKS. Only Top 25 games
// count there (a ranked team on either side; parse's opts.top25), and a college team carries rank (1-25, else null).
// College abbreviations can be longer or carry & or - ('TA&M', 'M-OH').

import {canWrite} from './fire.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const CFB_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
export const REG_WEEKS = 18;
const LIVE_TTL = 20e3, IDLE_TTL = 5 * 60e3;
const POLL_LIVE = 30e3, POLL_IDLE = 5 * 60e3, POLL_RETRY = 60e3;
const DUE_MS = 6 * 3600e3;   // a game still 'pre' up to 6 h after its kickoff time counts as about to start
const TIMEOUT = 12e3;
const LS = 'gg-nfl-';
const DEV = !canWrite();     // dev hooks (patches, forced offline) only on pages that cannot write for real

export const weekId = (year, week) => `${year}-w${week}`;
const okWeek = (y, w) => Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(w) && w >= 1 && w <= REG_WEEKS;

function toMs(t) {
  if (t == null) return NaN;
  if (typeof t === 'number') return t;
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'string') return Date.parse(t);
  if (typeof t.toMillis === 'function') { try { return t.toMillis(); } catch (_) { return NaN; } }
  return NaN;
}

// ---------------------------------------------------------------------------
// Parsing (pure)

const hex = v => (/^[0-9a-f]{6}$/i.test(String(v || '')) ? '#' + String(v).toLowerCase() : null);
const num = v => {
  if (v && typeof v === 'object') v = v.value != null ? v.value : v.displayValue;
  if (v == null || v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};

// College abbreviations: up to 6 characters, with & or - ('TA&M', 'M-OH').
const ABBR = /^[A-Z]{2,4}$/, CFB_ABBR = /^[A-Z0-9][A-Z0-9&-]{1,5}$/;
function teamOf(c, state, o = {}) {
  if (!c || typeof c !== 'object') return null;
  const t = c.team && typeof c.team === 'object' ? c.team : {};
  const abbr = String(t.abbreviation || '').toUpperCase();
  if (!(o.cfb ? CFB_ABBR : ABBR).test(abbr)) return null;
  const rk = num(c.curatedRank && c.curatedRank.current);
  const recs = Array.isArray(c.records) ? c.records : [];
  const rec = recs.find(r => r && (r.type === 'total' || r.name === 'overall')) || null;
  return {
    id: String(t.id || c.id || ''),
    abbr,
    name: String(t.displayName || [t.location, t.name].filter(Boolean).join(' ') || abbr),
    short: String(t.shortDisplayName || t.name || abbr),
    logo: /^https:\/\//.test(String(t.logo || '')) ? t.logo : null,
    color: hex(t.color), alt: hex(t.alternateColor),
    score: state === 'pre' ? null : num(c.score),
    winner: state === 'post' && c.winner === true,
    record: rec && typeof rec.summary === 'string' ? rec.summary.replace(/-/g, '–') : '',
    rank: rk != null && rk >= 1 && rk <= 25 ? rk : null
  };
}

const OFF = /POSTPONED|CANCEL|SUSPENDED/;

function eventOf(e, o = {}) {
  if (!e || typeof e !== 'object') return null;
  const id = String(e.id == null ? '' : e.id);
  if (!/^[0-9]{1,12}$/.test(id)) return null;
  const c = Array.isArray(e.competitions) ? e.competitions[0] : null;
  if (!c || typeof c !== 'object') return null;
  const st = c.status || e.status || {}, ty = st.type || {};
  const state = ty.state === 'in' || ty.state === 'post' ? ty.state : 'pre';
  const t = Date.parse(e.date || c.date || c.startDate || '');
  if (!isFinite(t)) return null;
  const comps = Array.isArray(c.competitors) ? c.competitors : [];
  const home = teamOf(comps.find(x => x && x.homeAway === 'home'), state, o);
  const away = teamOf(comps.find(x => x && x.homeAway === 'away'), state, o);
  if (!home || !away || home.abbr === away.abbr) return null;
  const status = String(ty.name || '');
  const final = state === 'post' && ty.completed !== false && !OFF.test(status);
  let winner = null;
  if (final) {
    if (home.winner && !away.winner) winner = 'home';
    else if (away.winner && !home.winner) winner = 'away';
    else if (!home.winner && !away.winner && home.score != null && away.score != null && home.score !== away.score) {
      winner = home.score > away.score ? 'home' : 'away'; // ESPN flagged nobody but the score says otherwise
      (winner === 'home' ? home : away).winner = true;
    }
  }
  if (!final) { home.winner = false; away.winner = false; }
  const addr = (c.venue && c.venue.address) || {};
  const country = String(addr.country || '');
  const notes = (Array.isArray(c.notes) ? c.notes : []).map(n => n && n.headline).filter(x => typeof x === 'string' && x);
  const tv = [...new Set((Array.isArray(c.broadcasts) ? c.broadcasts : []).flatMap(b => (b && Array.isArray(b.names) ? b.names : [])).filter(x => typeof x === 'string' && x))];
  const game = {
    id, kickoff: new Date(t), tbd: c.timeValid === false, state, status,
    detail: String(ty.shortDetail || ty.detail || ty.description || ''),
    period: num(st.period), clock: typeof st.displayClock === 'string' ? st.displayClock : '',
    final, tie: final && !winner, winner, home, away,
    label: String(e.shortName || `${away.abbr} @ ${home.abbr}`),
    name: String(e.name || `${away.name} at ${home.name}`),
    neutral: c.neutralSite === true,
    site: String((c.venue && c.venue.fullName) || ''), city: String(addr.city || ''), country,
    intl: country && !/^(USA|US|United States)$/i.test(country) ? country : '',
    note: notes[0] || '', tv: tv.join(' / '),
    line: lineOf(c, home, away)
  };
  return o.cfb ? againstSpread(game) : game;
}

// The College pick'em is against the spread: a final college game's winner is the team that covered (its score
// plus its side of the line beats the other's), tie when it lands on the number (a push). The line is ESPN's
// (the closing line once the game starts), else the last one this phone saw before kickoff ('gg-cfb-line-<id>');
// a final game with neither is a push. The straight-up result stays on su: {winner, tie}; ats: true marks the game.
const LINE_LS = 'gg-cfb-line-';
function againstSpread(g) {
  let l = g.line;
  try {
    if (l && g.state === 'pre') localStorage.setItem(LINE_LS + g.id, JSON.stringify(l));
    if (!l) { const v = JSON.parse(localStorage.getItem(LINE_LS + g.id) || 'null'); if (v && (v.fav === 'home' || v.fav === 'away' || v.fav === null) && isFinite(+v.pts)) l = v; }
  } catch (_) {}
  g.line = l || null;
  g.ats = true;
  g.su = {winner: g.winner, tie: g.tie};
  if (!g.final) return g;
  const hs = !l ? null : !l.fav ? 0 : l.fav === 'home' ? -l.pts : l.pts; // home's side of the line
  const m = hs == null ? 0 : (g.home.score || 0) - (g.away.score || 0) + hs;
  g.winner = m > 0 ? 'home' : m < 0 ? 'away' : null;
  g.tie = !g.winner;
  g.noLine = hs == null;
  g.home.winner = g.winner === 'home';
  g.away.winner = g.winner === 'away';
  return g;
}

// The game's betting line from ESPN's odds (the scoreboard carries the current one, so it moves as the polls do):
// {fav: 'home' | 'away' | null (a pick'em), pts (the spread, positive: 3.5), ou (the total, or null), text ('KC -3.5',
// 'EVEN')} or null when ESPN has none. Read from `details` ('KC -3.5'), else the favorite flags and `spread`.
export function lineOf(c, home, away) {
  const list = c && Array.isArray(c.odds) ? c.odds : [];
  const o = list.find(x => x && (typeof x.details === 'string' || x.spread != null));
  if (!o || !home || !away) return null;
  const ou = num(o.overUnder);
  const det = typeof o.details === 'string' ? o.details.trim() : '';
  if (/^(even|pk|pick)/i.test(det)) return {fav: null, pts: 0, ou, text: 'EVEN'};
  const m = /^([A-Z0-9&-]{2,6})\s+([+-]?\d+(?:\.\d+)?)$/i.exec(det);
  if (m) {
    const ab = m[1].toUpperCase(), pts = Math.abs(Number(m[2]));
    const fav = ab === home.abbr ? 'home' : ab === away.abbr ? 'away' : null;
    if (fav) return pts ? {fav, pts, ou, text: det} : {fav: null, pts: 0, ou, text: 'EVEN'};
  }
  const sp = num(o.spread);
  const hf = o.homeTeamOdds && o.homeTeamOdds.favorite === true, af = o.awayTeamOdds && o.awayTeamOdds.favorite === true;
  if (sp != null && (hf || af) && Math.abs(sp)) {
    const fav = hf ? 'home' : 'away';
    return {fav, pts: Math.abs(sp), ou, text: `${(fav === 'home' ? home : away).abbr} -${Math.abs(sp)}`};
  }
  return null;
}

function calendarOf(j) {
  const L = Array.isArray(j.leagues) ? j.leagues[0] : null;
  const cal = L && Array.isArray(L.calendar) ? L.calendar : [];
  const reg = cal.find(x => x && String(x.value) === '2');
  return (reg && Array.isArray(reg.entries) ? reg.entries : [])
    .map(x => ({week: Number(x && x.value), start: Date.parse(x && x.startDate), end: Date.parse(x && x.endDate)}))
    .filter(x => Number.isInteger(x.week) && x.week >= 1 && isFinite(x.start) && isFinite(x.end));
}

// ESPN scoreboard JSON -> {year, week, seasontype, games, weeks (regular-season weeks), cal: [{week, start, end}]}.
// `want` ({year, week}) fills in what the payload leaves out. Throws on something that is not a scoreboard.
// opts: {cfb (college abbreviations), top25 (only games with a ranked team)}.
export function parse(j, want = {}, opts = {}) {
  if (!j || typeof j !== 'object' || !Array.isArray(j.events)) throw new Error('Not an ESPN scoreboard.');
  const season = j.season && typeof j.season === 'object' ? j.season : {};
  const L = Array.isArray(j.leagues) ? j.leagues[0] : null;
  const ls = (L && L.season) || {};
  const year = Number(season.year || ls.year) || want.year || null;
  const seasontype = Number(season.type || (ls.type && ls.type.type)) || 2;
  const week = Number(j.week && j.week.number) || want.week || null;
  const seen = new Set(), games = [];
  j.events.forEach(e => {
    const g = eventOf(e, opts);
    if (g && !seen.has(g.id) && (!opts.top25 || g.home.rank || g.away.rank)) { seen.add(g.id); games.push(g); }
  });
  games.sort((a, b) => a.kickoff - b.kickoff); // stable: ESPN's order within one kickoff
  const cal = calendarOf(j);
  return {year, week, seasontype, games, weeks: cal.length || opts.weeks || REG_WEEKS, cal};
}

// The pick'em week for a parsed default scoreboard (see the header).
export function pickWeek(b, reg = REG_WEEKS) {
  const weeks = (b && b.weeks) || reg;
  const year = b && b.year;
  if (!b || !year) return null;
  if (b.seasontype === 1) return {year, week: 1, espnWeek: null, seasontype: 1, weeks, advanced: false};
  if (b.seasontype !== 2 || !b.week) return {year, week: weeks, espnWeek: null, seasontype: b.seasontype, weeks, advanced: false};
  const done = weekOver(b.games); // a postponed game holds the week until ESPN's own calendar moves on
  const week = done && b.week < weeks ? b.week + 1 : b.week;
  return {year, week, espnWeek: b.week, seasontype: 2, weeks, advanced: week !== b.week};
}

// A game is locked (no picks, no changes) once it has kicked off: its kickoff time has come, or ESPN already
// shows it started (or over).
export function gameStarted(g, at = Date.now()) {
  if (!g) return true;
  return g.state !== 'pre' || toMs(at) >= toMs(g.kickoff);
}

// A game is over for good once it is final or canceled. ESPN sends a postponed or suspended game as state 'post'
// with completed false; it can come back (a new date, then a real result), so it never settles a week.
export const gameOver = g => !!g && g.state === 'post' && (g.final === true || /CANCEL/.test(String(g.status || '')));
// Every game of the week is over: the week is cached for good, stops polling, and the pick'em moves on from it.
export const weekOver = games => Array.isArray(games) && games.length > 0 && games.every(gameOver);
const allPost = weekOver;
const liveOrDue = (games, t = Date.now()) => games.some(g => g.state === 'in' || (g.state === 'pre' && t >= toMs(g.kickoff) && t - toMs(g.kickoff) < DUE_MS));

// ---------------------------------------------------------------------------
// One feed per league (cfg: {base (ESPN scoreboard URL), ls (localStorage prefix), weeks (regular-season weeks),
// dev (sessionStorage key for the dev patches), opts (parse options)}): its own caches, current week and pollers.
function makeFeed(cfg) {
  const okW = (y, w) => Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(w) && w >= 1 && w <= cfg.weeks;
  // ---------------------------------------------------------------------------
  // Storage (never throws)

  function lsGet(k) { try { const v = localStorage.getItem(cfg.ls + k); return v ? JSON.parse(v) : null; } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(cfg.ls + k, JSON.stringify(v)); return true; } catch (_) { return false; } }
  const ser = g => Object.assign({}, g, {kickoff: g.kickoff.toISOString()});
  function revive(o) {
    if (!o || !Array.isArray(o.games)) return null;
    const games = o.games.map(g => (g && typeof g.kickoff === 'string' ? Object.assign({}, g, {kickoff: new Date(g.kickoff)}) : null));
    return games.every(g => g && isFinite(g.kickoff.getTime()) && g.home && g.away) ? games : null;
  }
  function lsWeek(year, week) {
    const o = lsGet(weekId(year, week));
    if (!o || o.year !== year || o.week !== week) return null;
    const games = revive(o);
    return games && allPost(games) ? {year, week, games, at: o.at || 0} : null;
  }

  // ---------------------------------------------------------------------------
  // Fetching

  let devOffline = false;
  if (DEV) { try { devOffline = sessionStorage.getItem(cfg.dev + '-off') === '1'; } catch (_) {} }

  async function getJSON(url) {
    if (devOffline) throw Object.assign(new Error('Offline (dev).'), {code: 'offline'});
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : 0;
    try {
      const r = await fetch(url, ctl ? {signal: ctl.signal} : undefined);
      if (!r.ok) throw Object.assign(new Error('ESPN answered ' + r.status), {code: 'failed'});
      return await r.json();
    } finally { clearTimeout(tm); }
  }
  const offline = err => Object.assign(new Error('Scores are unavailable: ' + ((err && err.message) || err)), {code: 'offline', cause: err});

  const mem = new Map();      // weekId -> {t (fetched), data: {year, week, games, at}}
  const inflight = new Map(); // weekId -> Promise

  function fresh(m, t = Date.now()) {
    if (!m) return false;
    const g = m.data.games;
    if (allPost(g)) return true;
    return t - m.t < (liveOrDue(g, t) ? LIVE_TTL : IDLE_TTL);
  }

  function putWeek(year, week, games) {
    const data = {year, week, games, at: Date.now()};
    mem.set(weekId(year, week), {t: data.at, data});
    if (allPost(games)) lsSet(weekId(year, week), {year, week, at: data.at, games: games.map(ser)});
    return data;
  }

  // The games of a regular-season week. Weeks where every game is final come from localStorage without a request.
  // opt.fresh skips the memory cache (the watch's polls). A failed request returns the last data with stale: true,
  // and rejects (err.code 'offline') only when there is nothing at all.
  async function scoreboard(year, week, opt = {}) {
    year = Number(year); week = Number(week);
    if (!okW(year, week)) throw Object.assign(new Error(`No such week: ${year} week ${week}.`), {code: 'failed'});
    const id = weekId(year, week);
    const m = mem.get(id);
    if (m && allPost(m.data.games)) return view(m.data);
    if (!m) { const l = lsWeek(year, week); if (l) { mem.set(id, {t: Date.now(), data: l}); return view(l); } }
    if (!opt.fresh && fresh(m)) return view(m.data);
    // A currentWeek() request on its way brings ESPN's current week too (a cold open asks for both at once): wait for
    // it rather than asking twice.
    if (!opt.fresh && curP && !inflight.has(id)) {
      try { await curP; } catch (_) {}
      const m2 = mem.get(id);
      if (fresh(m2)) return view(m2.data);
    }
    if (inflight.has(id)) return inflight.get(id);
    const p = (async () => {
      try {
        const b = parse(await getJSON(`${cfg.base}?seasontype=2&week=${week}&dates=${year}`), {year, week}, cfg.opts);
        if (b.year !== year || b.week !== week) throw new Error(`ESPN answered ${b.year} week ${b.week}`);
        return view(putWeek(year, week, b.games));
      } catch (err) {
        const last = mem.get(id);
        if (last) return view(last.data, true);
        throw offline(err);
      } finally { inflight.delete(id); }
    })();
    inflight.set(id, p);
    return p;
  }

  let cur = null, curP = null; // {t, v, games}

  // The pick'em week (see the header): {year, week, espnWeek, seasontype, weeks, advanced, stale}. Warms the week
  // cache with the games ESPN sent. Offline: the last known answer (moved on by ESPN's calendar when that week is
  // over), stale: true; rejects only when nothing was ever saved.
  async function currentWeek(opt = {}) {
    if (!opt.fresh && cur && Date.now() - cur.t < (liveOrDue(cur.games) ? LIVE_TTL : IDLE_TTL)) return Object.assign({}, cur.v);
    if (curP) return curP;
    curP = (async () => {
      try {
        const b = parse(await getJSON(cfg.base), {}, cfg.opts);
        if (b.seasontype === 2 && okW(b.year, b.week)) putWeek(b.year, b.week, b.games);
        const v = pickWeek(b, cfg.weeks);
        if (!v) throw new Error('ESPN sent no season');
        v.stale = false;
        cur = {t: Date.now(), v, games: b.games};
        lsSet('cur', {v, cal: b.cal, at: cur.t});
        return Object.assign({}, v);
      } catch (err) {
        const saved = lsGet('cur');
        const v = saved && saved.v && okW(saved.v.year, saved.v.week) ? fromCalendar(saved) : null;
        if (v) return Object.assign(v, {stale: true});
        throw offline(err);
      } finally { curP = null; }
    })();
    return curP;
  }

  // Offline: ESPN's week for today from the saved calendar (moved on when that week is final in the cache), else
  // the last answer.
  function fromCalendar(saved, t = Date.now()) {
    const v = Object.assign({}, saved.v);
    const e = (Array.isArray(saved.cal) ? saved.cal : []).find(x => t >= x.start && t <= x.end);
    if (!e || v.seasontype !== 2) return v;
    const done = lsWeek(v.year, e.week);
    const week = done && e.week < (v.weeks || cfg.weeks) ? e.week + 1 : e.week;
    return week > v.week ? Object.assign(v, {week, espnWeek: e.week, advanced: week !== e.week}) : v;
  }

  // A game already in memory (no request): {year, week, game} or null.
  function lookup(gameId) {
    const id = String(gameId);
    for (const m of mem.values()) {
      const g = m.data.games.find(x => x.id === id);
      if (g) return {year: m.data.year, week: m.data.week, game: patched(m.data.year, m.data.week, [g])[0]};
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Watching a week

  const watchers = new Map(); // weekId -> {year, week, fns, data, sig, timer, busy, last}
  const hidden = () => { try { return document.visibilityState === 'hidden'; } catch (_) { return false; } };

  const sigOf = d => (d ? (d.stale ? 's' : '') + (d.error || '') + d.games.map(g => [g.id, g.state, g.detail, g.home.score, g.away.score, g.winner, toMs(g.kickoff), g.line ? g.line.text : ''].join(',')).join(';') : '');

  function emitW(w) {
    if (!w.data) return;
    const s = sigOf(w.data);
    if (s === w.sig) return;
    w.sig = s;
    [...w.fns].forEach(fn => { try { fn(w.data); } catch (err) { console.error(err); } });
  }

  function schedule(w) {
    clearTimeout(w.timer); w.timer = 0;
    if (!w.fns.size || hidden()) return; // resumed by visibilitychange
    const d = w.data;
    const games = d ? d.games : [];
    if (d && !d.stale && allPost(games)) return; // over: nothing left to poll
    const t = Date.now();
    let ms = !d || d.stale ? POLL_RETRY : liveOrDue(games, t) ? POLL_LIVE : POLL_IDLE;
    // Wake up just after the next kickoff, so the lock and the first score show up on time.
    const next = games.filter(g => g.state === 'pre' && toMs(g.kickoff) > t).map(g => toMs(g.kickoff)).sort((a, b) => a - b)[0];
    if (next) ms = Math.min(ms, Math.max(5e3, next - t + 15e3));
    w.timer = setTimeout(() => tick(w, true), ms);
  }

  async function tick(w, force) {
    if (w.busy || !w.fns.size) return;
    w.busy = true;
    try {
      w.data = await scoreboard(w.year, w.week, {fresh: force});
    } catch (err) {
      w.data = w.data ? Object.assign({}, w.data, {stale: true}) : {year: w.year, week: w.week, games: [], stale: true, at: 0, error: 'offline'};
    } finally {
      w.busy = false;
      w.last = Date.now();
    }
    if (!w.fns.size) return;
    emitW(w);
    schedule(w);
  }

  // Live games of a week: fn({year, week, games, stale, at, error}) soon after subscribing (from cache when it can)
  // and again whenever a state, clock or score changes. Polls every 30 s while a game is live (or due to start) and
  // the page is visible, every 5 min otherwise, not at all while hidden or once every game is final. A failed poll
  // keeps the last data with stale: true (retried every minute); with no data at all games is [] and
  // error 'offline'. One poller per week however many watchers.
  function watch(year, week, fn) {
    year = Number(year); week = Number(week);
    if (typeof fn !== 'function') return () => {};
    if (!okW(year, week)) {
      queueMicrotask(() => { try { fn({year, week, games: [], stale: false, at: 0, error: 'failed'}); } catch (err) { console.error(err); } });
      return () => {};
    }
    const id = weekId(year, week);
    let w = watchers.get(id);
    if (!w) { w = {year, week, fns: new Set(), data: null, sig: '', timer: 0, busy: false, last: 0}; watchers.set(id, w); }
    w.fns.add(fn);
    if (w.data) queueMicrotask(() => { if (w.fns.has(fn)) { try { fn(w.data); } catch (err) { console.error(err); } } });
    else if (!w.busy) tick(w, false);
    return () => {
      w.fns.delete(fn);
      if (w.fns.size) return;
      clearTimeout(w.timer);
      if (watchers.get(id) === w) watchers.delete(id);
    };
  }

  try {
    document.addEventListener('visibilitychange', () => {
      if (hidden()) { watchers.forEach(w => { clearTimeout(w.timer); w.timer = 0; }); return; }
      watchers.forEach(w => {
        const d = w.data, games = d ? d.games : [];
        const due = !d || d.stale || Date.now() - w.last >= (liveOrDue(games) ? POLL_LIVE : POLL_IDLE)
          || games.some(g => g.state === 'pre' && toMs(g.kickoff) <= Date.now());
        if (due) tick(w, true); else schedule(w);
      });
    });
    addEventListener('online', () => watchers.forEach(w => { if (!w.data || w.data.stale) tick(w, true); }));
  } catch (_) {}

  // ---------------------------------------------------------------------------
  // Dev patches: fake live states and results on top of the real feed (pages that cannot write only; kept for the
  // tab in sessionStorage). From the console:
  //   const nfl = await import('/js/core/nfl.js');
  //   nfl.__dev.patch(2026, 4, {'401872964': {state: 'in', detail: '4:12 - 3rd', home: 17, away: 10}})
  //   nfl.__dev.patch(2026, 4, {'401872964': {state: 'post', home: 20, away: 20}})   // a tie (winner from the score)
  //   nfl.__dev.patch(2026, 4, {'401872977': {kickoff: '2026-10-04T04:00Z', tbd: true}})  // time not set yet (ESPN's placeholder)
  //   nfl.__dev.patch(2026, 4, null)      // drop that week's patches; nfl.__dev.patch(null) drops all
  //   nfl.__dev.offline(true)             // every request fails (stale states); false restores
  //   nfl.__dev.clear()                   // forget every cached scoreboard (memory + localStorage)

  let patches = {};
  if (DEV) { try { patches = JSON.parse(sessionStorage.getItem(cfg.dev) || '{}') || {}; } catch (_) { patches = {}; } }

  function patchGame(g, p) {
    const state = p.state === 'in' || p.state === 'post' || p.state === 'pre' ? p.state : g.state;
    const sc = (v, was) => { const n = v && typeof v === 'object' ? num(v.score) : num(v); return n != null ? n : was != null ? was : 0; };
    const home = Object.assign({}, g.home, {score: state === 'pre' ? null : sc(p.home, g.home.score)});
    const away = Object.assign({}, g.away, {score: state === 'pre' ? null : sc(p.away, g.away.score)});
    const final = state === 'post' && !p.off;
    let winner = null;
    if (final) winner = p.winner === 'home' || p.winner === 'away' ? p.winner : p.winner === 'tie' ? null : home.score > away.score ? 'home' : away.score > home.score ? 'away' : null;
    home.winner = winner === 'home'; away.winner = winner === 'away';
    const kick = p.kickoff != null ? new Date(toMs(p.kickoff)) : g.kickoff;
    return Object.assign({}, g, {
      state, final, tie: final && !winner, winner, home, away, kickoff: isFinite(kick.getTime()) ? kick : g.kickoff, tbd: p.tbd != null ? !!p.tbd : g.tbd,
      status: p.off ? 'STATUS_POSTPONED' : state === 'pre' ? 'STATUS_SCHEDULED' : state === 'in' ? 'STATUS_IN_PROGRESS' : 'STATUS_FINAL',
      detail: typeof p.detail === 'string' ? p.detail : state === 'in' ? 'In progress' : state === 'post' ? (p.off ? 'Postponed' : 'Final') : g.detail,
      period: p.period != null ? num(p.period) : g.period, clock: typeof p.clock === 'string' ? p.clock : g.clock
    });
  }
  function patched(year, week, games) {
    const P = DEV && patches[weekId(year, week)];
    return P ? games.map(g => (P[g.id] ? patchGame(g, P[g.id]) : g)) : games;
  }
  function view(d, stale = false) {
    return {year: d.year, week: d.week, games: patched(d.year, d.week, d.games.slice()), stale: !!stale, at: d.at};
  }

  function reemit() {
    watchers.forEach(w => {
      const m = mem.get(weekId(w.year, w.week));
      if (m) w.data = view(m.data, !!(w.data && w.data.stale));
      emitW(w);
      schedule(w);
    });
  }

  const __dev = {
    patch(year, week, map) {
      if (!DEV) return false;
      if (year === null) patches = {};
      else {
        const id = weekId(Number(year), Number(week));
        if (map == null) delete patches[id];
        else patches[id] = Object.assign({}, patches[id], map);
      }
      try { sessionStorage.setItem(cfg.dev, JSON.stringify(patches)); } catch (_) {}
      reemit();
      return patches;
    },
    offline(on) {
      if (!DEV) return false;
      devOffline = !!on;
      try { if (devOffline) sessionStorage.setItem(cfg.dev + '-off', '1'); else sessionStorage.removeItem(cfg.dev + '-off'); } catch (_) {}
      if (!devOffline) watchers.forEach(w => tick(w, true));
      return devOffline;
    },
    clear() {
      mem.clear(); cur = null;
      try { Object.keys(localStorage).filter(k => k.startsWith(cfg.ls)).forEach(k => localStorage.removeItem(k)); } catch (_) {}
      return true;
    },
    state: () => ({mem: [...mem.keys()], watchers: [...watchers.keys()].map(k => ({k, n: watchers.get(k).fns.size, timer: !!watchers.get(k).timer})), cur: cur && cur.v, patches, offline: devOffline})
  };

  return {scoreboard, currentWeek, watch, lookup, __dev, REG_WEEKS: cfg.weeks};
}

const NFL = makeFeed({base: BASE, ls: LS, weeks: REG_WEEKS, dev: 'gg-dev-nfl', opts: {}});
export const {scoreboard, currentWeek, watch, lookup, __dev} = NFL;
/** College football (the College pick'em): the same API on ESPN's college scoreboard, Top 25 games only. */
export const cfb = Object.assign(makeFeed({base: CFB_BASE, ls: 'gg-cfb-', weeks: 16, dev: 'gg-dev-cfb', opts: {cfb: true, top25: true, weeks: 16}}),
  {gameStarted, gameOver, weekOver, weekId});
