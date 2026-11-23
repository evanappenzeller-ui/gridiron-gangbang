// One game in depth (the Scores tab's game page, views/game.js; Nov 22 2026, the owner: "Make the scores tab include
// college football ... Users should be able to click on a live game and get taken to a more in depth view with box
// scores, latest plays, scoring plays, etc."): ESPN's public game summary (the same site API as the scoreboards, CORS
// allowed, no key) for an NFL or a college game, read into one plain object, and a watcher that keeps it fresh while
// the game is on. No DOM. Owner: LIVE.
//
//   LEAGUES                 -> {nfl: {...}, cfb: {...}}: each league's summary URL and its period names
//   parseSummary(json, lg)  -> the game (below), or throws on something that isn't a summary (pure; for the checks)
//   watchGame(lg, id, fn)   -> stop; fn({game, at, stale, error}) now and on every update: every 20 s while the game is
//                              on, every 5 min before it (and just after kickoff), once a minute for 10 minutes after
//                              the final whistle (ESPN fills in the last plays' stats), then never; not at all while the
//                              page is hidden. A failed fetch keeps the last game with stale: true; with nothing at
//                              all, game is null and error is 'offline'.
//   periodName(lg, n)       -> '1st' | '2nd' | '3rd' | '4th' | 'OT' | '2OT' ...
//   CONFERENCES             -> [{id, label}] the FBS conferences (ESPN's group ids), for the college list's chips
//
// The game: {league, id, state: 'pre'|'in'|'post', status, detail ('0:20 - 3rd'), period, clock, final, kickoff: Date,
//   tbd, home, away, venue: {name, city}, weather ('40°, Mostly cloudy' | ''), attendance (number | null), tv,
//   note ('College Football Playoff ...' | ''), odds: {text ('DEN -11.5'), ou, ml: {home, away}} | null,
//   predictor: {home, away} (ESPN's pregame chances, 0-100) | null,
//   wp: {home (0-1, now), series: [home 0-1 after each play]} | null,
//   sit: {side ('home'|'away'), text ('1st & Goal'), spot ('LV 4'), toGo, x (the ball from the away goal line, 0-100),
//         last (the last play's words), lastType} | null (only while it's on),
//   scoring: [{id, period, clock, side, type ('Rushing Touchdown'), abbr ('TD'), text, away, home}],
//   drives: [{id, side, result ('Touchdown'), short ('TD'), desc ('10 plays, 72 yards, 4:53'), start ('DEN 28'),
//            live (the drive on now), score (ended in points), plays: [{id, period, clock, text, type, down
//            ('3rd & 7 at LV 22'), scoring, away, home, yds}] (oldest first)}] (newest first),
//   stats: [{key, label, away, home}] (team stats; before kickoff ESPN's season averages: seasonStats true),
//   box: [{key, label, away: {labels, rows: [{id, name, short, jersey, head, stats}], totals}, home}],
//   leaders: [{key, label, away: {name, short, head, pos, line}|null, home}] (season leaders before kickoff)}
// A team: {id, abbr, name, short, logo, color, alt, rank (college Top 25, else null), record, score (null before
//   kickoff), lines: [points each period], winner, poss (has the ball), to (timeouts left, null when unknown)}.

const API = 'https://site.api.espn.com/apis/site/v2/sports/football/';
export const LEAGUES = {
  nfl: {id: 'nfl', path: 'nfl', label: 'NFL', periods: 4},
  cfb: {id: 'cfb', path: 'college-football', label: 'College', periods: 4}
};
export const summaryURL = (lg, id) => `${API}${(LEAGUES[lg] || LEAGUES.nfl).path}/summary?event=${encodeURIComponent(id)}`;
export const okLeague = lg => Object.prototype.hasOwnProperty.call(LEAGUES, lg);
export const okId = id => /^[0-9]{1,12}$/.test(String(id == null ? '' : id));

// The FBS conferences by ESPN's group id (competitors' team.conferenceId on the college scoreboard).
export const CONFERENCES = [
  {id: '8', label: 'SEC'}, {id: '5', label: 'Big Ten'}, {id: '4', label: 'Big 12'}, {id: '1', label: 'ACC'},
  {id: '9', label: 'Pac-12'}, {id: '151', label: 'American'}, {id: '17', label: 'Mountain West'}, {id: '37', label: 'Sun Belt'},
  {id: '15', label: 'MAC'}, {id: '12', label: 'CUSA'}, {id: '18', label: 'Independents'}
];

const LIVE_MS = 20e3, IDLE_MS = 5 * 60e3, SETTLE_MS = 60e3, SETTLE_FOR = 10 * 60e3, RETRY_MS = 45e3, TIMEOUT = 12e3;

// ---------------------------------------------------------------------------------------------- Parsing (pure)
const arr = v => (Array.isArray(v) ? v : []);
const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = v => {
  if (v && typeof v === 'object') v = v.value != null ? v.value : v.displayValue;
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
};
const hex = v => (/^[0-9a-f]{6}$/i.test(str(v)) ? '#' + str(v).toLowerCase() : null);
const https = v => (/^https:\/\//.test(str(v)) ? str(v) : null);
const logoOf = t => {
  if (!t) return null;
  if (https(t.logo)) return t.logo;
  const ls = arr(t.logos);
  const def = ls.find(l => l && arr(l.rel).includes('default') && !arr(l.rel).includes('dark')) || ls[0];
  return def ? https(def.href) : null;
};
const headOf = a => {
  const h = a && a.headshot && (typeof a.headshot === 'string' ? a.headshot : a.headshot.href);
  return https(h);
};
const ORD = ['', '1st', '2nd', '3rd', '4th'];
export function periodName(lg, n) {
  const p = Number(n) || 0, reg = (LEAGUES[lg] || LEAGUES.nfl).periods;
  if (p >= 1 && p <= reg) return ORD[p] || `Q${p}`;
  if (p > reg) return p - reg === 1 ? 'OT' : `${p - reg}OT`;
  return '';
}

function teamOf(c, state) {
  const t = (c && c.team) || {};
  const recs = arr(c && c.record).concat(arr(c && c.records));
  const rec = recs.find(r => r && (r.type === 'total' || r.name === 'overall')) || recs[0];
  const rk = num(c && (c.rank != null ? c.rank : c.curatedRank && c.curatedRank.current));
  const lines = arr(c && c.linescores).map(x => num(x && (x.displayValue != null ? x.displayValue : x.value)));
  const used = num(c && c.timeoutsUsed);
  return {
    id: str(t.id || (c && c.id)), abbr: str(t.abbreviation).toUpperCase(),
    name: str(t.displayName || [t.location, t.name].filter(Boolean).join(' ') || t.abbreviation),
    short: str(t.shortDisplayName || t.nickname || t.name || t.abbreviation),
    logo: logoOf(t), color: hex(t.color), alt: hex(t.alternateColor),
    rank: rk != null && rk >= 1 && rk <= 25 ? rk : null,
    record: rec ? str(rec.summary || rec.displayValue).replace(/-/g, '–') : '',
    score: state === 'pre' ? null : num(c && c.score),
    lines: state === 'pre' ? [] : lines.map(v => (v == null ? 0 : v)),
    winner: state === 'post' && !!(c && c.winner === true),
    poss: !!(c && c.possession === true),
    to: used != null && used >= 0 && used <= 3 ? 3 - used : null
  };
}

// A play: {id, period, clock, text, type, abbr, down, scoring, away, home, yds, side (the offense, when known)}.
function playOf(p, sideOf) {
  if (!p || typeof p !== 'object') return null;
  const text = str(p.text).trim();
  if (!text) return null;
  const st = p.start || {};
  return {
    id: str(p.id), period: num(p.period && p.period.number) || 0, clock: str(p.clock && p.clock.displayValue),
    text, type: str(p.type && p.type.text), abbr: str(p.type && p.type.abbreviation),
    down: str(st.downDistanceText), scoring: p.scoringPlay === true,
    away: num(p.awayScore), home: num(p.homeScore), yds: num(p.statYardage),
    side: sideOf(st.team && st.team.id) || null
  };
}

const LEADER_LABEL = {passingYards: 'Passing', rushingYards: 'Rushing', receivingYards: 'Receiving', sacks: 'Sacks', totalTackles: 'Tackles', interceptions: 'Interceptions'};
const BOX_LABEL = {passing: 'Passing', rushing: 'Rushing', receiving: 'Receiving', fumbles: 'Fumbles', defensive: 'Defense', interceptions: 'Interceptions',
  kickReturns: 'Kick returns', puntReturns: 'Punt returns', kicking: 'Kicking', punting: 'Punting'};
const BOX_ORDER = Object.keys(BOX_LABEL);

export function parseSummary(j, lg = 'nfl') {
  const h = j && j.header, comp = h && arr(h.competitions)[0];
  if (!comp || !Array.isArray(comp.competitors)) throw new Error('Not an ESPN game summary.');
  const st = comp.status || {}, ty = st.type || {};
  const state = ty.state === 'in' || ty.state === 'post' ? ty.state : 'pre';
  const cs = comp.competitors;
  const home = teamOf(cs.find(x => x && x.homeAway === 'home') || cs[0], state);
  const away = teamOf(cs.find(x => x && x.homeAway === 'away') || cs[1], state);
  const ids = {[home.id]: 'home', [away.id]: 'away'};
  const abbrs = {[home.abbr]: 'home', [away.abbr]: 'away'};
  const sideOf = id => ids[str(id)] || null;
  const sideOfTeam = t => (t ? sideOf(t.id) || abbrs[str(t.abbreviation).toUpperCase()] || null : null);
  const status = str(ty.name);
  const final = state === 'post' && ty.completed !== false && !/POSTPONED|CANCEL|SUSPENDED/.test(status);
  if (final && !home.winner && !away.winner && home.score != null && away.score != null && home.score !== away.score) (home.score > away.score ? home : away).winner = true;
  const kickoff = new Date(Date.parse(comp.date || comp.startDate || '') || 0);

  // Game info: the venue, the weather, the crowd, the TV.
  const gi = j.gameInfo || {}, ven = gi.venue || comp.venue || {}, addr = ven.address || {};
  const w = gi.weather || null;
  const weather = w && num(w.temperature) != null ? `${num(w.temperature)}°${w.conditionId || w.displayValue ? ', ' + str(w.conditionId || w.displayValue) : ''}` : '';
  const tv = [...new Set(arr(comp.broadcasts).concat(arr(j.broadcasts)).flatMap(b => {
    if (!b) return [];
    if (Array.isArray(b.names)) return b.names;
    const m = b.media && (b.media.shortName || b.media.name);
    return m ? [m] : [];
  }).filter(x => typeof x === 'string' && x))].join(' / ');
  const note = str((arr(comp.notes)[0] || {}).headline);

  // The line: the first book's spread, total and moneylines.
  const pk = arr(j.pickcenter).find(o => o && (o.details || o.spread != null)) || arr(comp.odds).find(o => o && o.details) || null;
  const odds = pk ? {text: str(pk.details), ou: num(pk.overUnder),
    ml: {home: num(pk.homeTeamOdds && pk.homeTeamOdds.moneyLine), away: num(pk.awayTeamOdds && pk.awayTeamOdds.moneyLine)}} : null;
  const pr = j.predictor;
  const predictor = pr && pr.homeTeam && pr.awayTeam && num(pr.homeTeam.gameProjection) != null
    ? {home: num(pr.homeTeam.gameProjection), away: num(pr.awayTeam.gameProjection)} : null;

  // Win probability, play by play (ESPN's home chance after each).
  const series = arr(j.winprobability).map(x => num(x && x.homeWinPercentage)).filter(v => v != null && v >= 0 && v <= 1);
  const wp = state !== 'pre' && series.length ? {home: final ? (home.winner ? 1 : away.winner ? 0 : .5) : series[series.length - 1], series} : null;

  // Scoring plays, in order.
  const scoring = arr(j.scoringPlays).map(sp => {
    if (!sp || !str(sp.text)) return null;
    return {id: str(sp.id), period: num(sp.period && sp.period.number) || 0, clock: str(sp.clock && sp.clock.displayValue),
      side: sideOfTeam(sp.team), type: str(sp.type && sp.type.text), abbr: str(sp.type && sp.type.abbreviation),
      text: str(sp.text), away: num(sp.awayScore), home: num(sp.homeScore)};
  }).filter(Boolean);

  // Drives, newest first; the one on now leads while the game is on.
  const D = j.drives || {}, cur = state === 'in' && D.current && typeof D.current === 'object' ? D.current : null;
  const driveOf = (d, live) => {
    if (!d || typeof d !== 'object') return null;
    const plays = arr(d.plays).map(p => playOf(p, sideOf)).filter(Boolean);
    return {id: str(d.id), side: sideOfTeam(d.team), result: str(d.displayResult || d.result), short: str(d.shortDisplayResult || d.result),
      desc: str(d.description), start: str(d.start && d.start.text), live: !!live, score: d.isScore === true, plays};
  };
  const prev = arr(D.previous).map(d => driveOf(d, false)).filter(Boolean);
  let drives = prev.slice().reverse();
  if (cur) {
    const c = driveOf(cur, true);
    drives = [c].concat(drives.filter(d => d.id !== c.id));
  }

  // Where the ball is: the last play of the drive on now (its end), or the competitors' possession flag.
  let sit = null;
  if (state === 'in') {
    const lastDrive = cur || arr(D.previous)[arr(D.previous).length - 1] || null;
    const lp = lastDrive ? arr(lastDrive.plays)[arr(lastDrive.plays).length - 1] : null;
    const end = (lp && lp.end) || {};
    const side = sideOf(end.team && end.team.id) || (home.poss ? 'home' : away.poss ? 'away' : null);
    const toGo = num(end.yardsToEndzone);
    sit = {side, text: str(end.shortDownDistanceText), spot: str(end.possessionText),
      toGo: toGo != null && toGo >= 0 && toGo <= 100 ? toGo : null,
      x: toGo != null && side ? (side === 'away' ? 100 - toGo : toGo) : null,
      last: str(lp && lp.text), lastType: str(lp && lp.type && lp.type.text)};
    if (side) { home.poss = side === 'home'; away.poss = side === 'away'; }
  } else { home.poss = false; away.poss = false; }

  // Team stats (before kickoff: ESPN's season averages).
  const bx = j.boxscore || {};
  const tstat = side => {
    const t = arr(bx.teams).find(x => x && (x.homeAway === side || sideOfTeam(x.team) === side));
    const m = new Map();
    arr(t && t.statistics).forEach(s => { if (s && s.name && !m.has(s.name)) m.set(s.name, {label: str(s.label || s.displayName || s.name), v: str(s.displayValue)}); });
    return m;
  };
  const ha = tstat('away'), hh = tstat('home');
  const stats = [...new Set([...ha.keys(), ...hh.keys()])].map(k => ({key: k, label: (ha.get(k) || hh.get(k)).label, away: (ha.get(k) || {}).v || '–', home: (hh.get(k) || {}).v || '–'}));

  // Player box scores, category by category, both teams.
  const pcat = side => {
    const t = arr(bx.players).find(x => x && sideOfTeam(x.team) === side);
    const m = new Map();
    arr(t && t.statistics).forEach(c => {
      if (!c || !BOX_LABEL[c.name]) return;
      const rows = arr(c.athletes).map(x => {
        const a = x && x.athlete;
        if (!a || !a.displayName || !Array.isArray(x.stats)) return null;
        return {id: str(a.id), name: str(a.displayName), short: str(a.shortName || a.displayName), jersey: str(a.jersey), head: headOf(a), stats: x.stats.map(str)};
      }).filter(Boolean);
      if (rows.length) m.set(c.name, {labels: arr(c.labels).map(str), rows, totals: arr(c.totals).map(str)});
    });
    return m;
  };
  const pa = pcat('away'), ph = pcat('home');
  const box = BOX_ORDER.filter(k => pa.has(k) || ph.has(k)).map(k => ({key: k, label: BOX_LABEL[k], away: pa.get(k) || null, home: ph.get(k) || null}));

  // Leaders (season leaders before kickoff).
  const lead = side => {
    const t = arr(j.leaders).find(x => x && sideOfTeam(x.team) === side);
    const m = new Map();
    arr(t && t.leaders).forEach(g => {
      const top = g && arr(g.leaders)[0], a = top && top.athlete;
      if (!a || !LEADER_LABEL[g.name]) return;
      m.set(g.name, {name: str(a.displayName), short: str(a.shortName || a.displayName), head: headOf(a),
        pos: str(a.position && a.position.abbreviation), jersey: str(a.jersey), line: str(top.displayValue)});
    });
    return m;
  };
  const la = lead('away'), lh = lead('home');
  const leaders = Object.keys(LEADER_LABEL).filter(k => la.has(k) || lh.has(k)).map(k => ({key: k, label: LEADER_LABEL[k], away: la.get(k) || null, home: lh.get(k) || null}));

  return {
    league: okLeague(lg) ? lg : 'nfl', id: str(h.id || comp.id), state, status,
    detail: str(ty.shortDetail || ty.detail || ty.description), period: num(st.period), clock: str(st.displayClock),
    final, kickoff, tbd: h.timeValid === false || comp.timeValid === false, home, away,
    venue: {name: str(ven.fullName), city: [addr.city, addr.state].filter(Boolean).map(str).join(', ')},
    weather, attendance: num(gi.attendance), tv, note,
    odds, predictor, wp, sit, scoring, drives, stats, seasonStats: state === 'pre', box, leaders
  };
}

// ---------------------------------------------------------------------------------------------- Watching
async function getJSON(url) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const tm = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : 0;
  try {
    const r = await fetch(url, Object.assign({cache: 'no-store'}, ctl ? {signal: ctl.signal} : {}));
    if (!r.ok) throw new Error('ESPN answered ' + r.status);
    return await r.json();
  } finally { clearTimeout(tm); }
}

/** The raw summary too (views/game.js reads the fantasy lines from it with core/gameday.js parseBox). */
export function watchGame(lg, id, fn) {
  let dead = false, timer = 0, last = null, raw = null, finalAt = 0, busy = false;
  const hidden = () => { try { return document.visibilityState === 'hidden'; } catch (_) { return false; } };
  const emit = o => { try { fn(o); } catch (e) { console.error(e); } };
  if (!okLeague(lg) || !okId(id)) {
    queueMicrotask(() => { if (!dead) emit({game: null, raw: null, at: 0, stale: false, error: 'missing'}); });
    return () => { dead = true; };
  }
  const arm = () => {
    clearTimeout(timer); timer = 0;
    if (dead || hidden()) return;
    const g = last && last.game;
    let ms;
    if (!g) ms = RETRY_MS;
    else if (last.stale) ms = RETRY_MS;
    else if (g.state === 'in') ms = LIVE_MS;
    else if (g.state === 'pre') {
      const t = g.kickoff.getTime() - Date.now();
      ms = t > 0 ? Math.min(IDLE_MS, Math.max(5e3, t + 15e3)) : 60e3;
    } else {
      if (!finalAt) finalAt = Date.now();
      if (Date.now() - finalAt > SETTLE_FOR) return; // settled: nothing more to fetch
      ms = SETTLE_MS;
    }
    timer = setTimeout(pull, ms);
  };
  const pull = async () => {
    if (dead || busy) return;
    busy = true;
    try {
      const j = await getJSON(summaryURL(lg, id));
      const game = parseSummary(j, lg);
      if (dead) return;
      raw = j;
      last = {game, raw, at: Date.now(), stale: false, error: null};
    } catch (e) {
      if (dead) return;
      last = last && last.game ? Object.assign({}, last, {stale: true}) : {game: null, raw: null, at: 0, stale: true, error: 'offline'};
    } finally { busy = false; }
    emit(last);
    arm();
  };
  const onVis = () => { if (hidden()) { clearTimeout(timer); timer = 0; } else if (!dead) { const g = last && last.game; if (!g || g.state !== 'post' || !finalAt || Date.now() - finalAt <= SETTLE_FOR) pull(); } };
  try { document.addEventListener('visibilitychange', onVis); } catch (_) {}
  pull();
  return () => { dead = true; clearTimeout(timer); try { document.removeEventListener('visibilitychange', onVis); } catch (_) {} };
}
