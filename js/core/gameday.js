// The live games tracker's feed (views/live.js, the owner's alone: Oct 25 2026): the NFL week's games (nfl.js, with
// the ball's spot while one is on) and every player's line from ESPN's box scores (the public summary endpoint, per
// game once it has kicked off), with his fantasy points in the league's scoring (PPR). No DOM. Owner: LIVE.
//
//   watch(fn)          -> stop; fn({year, week, games, boxes: Map(gameId -> box), at, stale}) now and on every update:
//                         every 30 s while a game is on (or just final, until its box settles), every 5 min otherwise,
//                         not at all while the page is hidden or once every game is over
//   parseBox(json)     -> {players: [{id, name, team, head, s: {cmp, att, passYds, passTd, int, car, rushYds, rushTd,
//                         tgt, rec, recYds, recTd, fum, fumLost, retTd}}]} (pure; for the checks)
//   points(s)          -> the PPR points of a stat line (2 decimals)
//   statLine(p)        -> "24/31, 288 yds, 3 TD, 1 INT · 6 car, 41 yds" (the parts he has)
//   posOf(p, list)     -> 'QB' | 'RB' | 'WR' | 'TE': the player list's (data/nfl-players.json), else read off his stats
//   loadPositions()    -> Promise of the player list's positions (name|team -> pos)
//   ownersOf(league, year) -> Map(player's name, normalized -> manager id): who has him in the league, from that season's
//                         draft (league.json drafts) and its trades since, in week order. Waiver pickups and drops
//                         aren't on file (no Yahoo rosters yet), so a player picked up off waivers shows no one.
//   ownerOf(owners, p) -> his manager's id, or null
//   pastWeek(year, week) -> Promise<{year, week, games, boxes}>: a finished week's box scores (the waiver wire's week
//                         before), fetched once a session (again only if a box failed to load)
//
// Scoring (PPR, Yahoo's standard, which the league plays): 1 a catch, 0.1 a rushing or receiving yard, 0.04 a passing
// yard, 6 a rushing, receiving or return TD, 4 a passing TD, -1 an interception thrown, -2 a fumble lost. Two-point
// conversions aren't in ESPN's box score; kickers and defenses aren't listed.
import * as nfl from './nfl.js';

const SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=';
const LIVE_MS = 30e3, IDLE_MS = 5 * 60e3, SETTLE = 15 * 60e3;

export const PPR = {passYds: 0.04, passTd: 4, int: -1, rushYds: 0.1, rushTd: 6, rec: 1, recYds: 0.1, recTd: 6, retTd: 6, fumLost: -2};
export function points(s) {
  if (!s) return 0;
  const t = Object.entries(PPR).reduce((a, [k, w]) => a + (Number(s[k]) || 0) * w, 0);
  return Math.round(t * 100) / 100;
}

// ---------------------------------------------------------------------------------------------- Box scores
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`.]/g, '')
  .replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
// ESPN's box score categories: our field -> [ESPN's key, its column label when the key is missing].
const FIELDS = {
  passing: {cmpAtt: ['completions/passingAttempts', 'C/ATT'], passYds: ['passingYards', 'YDS'], passTd: ['passingTouchdowns', 'TD'], int: ['interceptions', 'INT']},
  rushing: {car: ['rushingAttempts', 'CAR'], rushYds: ['rushingYards', 'YDS'], rushTd: ['rushingTouchdowns', 'TD']},
  receiving: {rec: ['receptions', 'REC'], recYds: ['receivingYards', 'YDS'], recTd: ['receivingTouchdowns', 'TD'], tgt: ['receivingTargets', 'TGTS']},
  fumbles: {fum: ['fumbles', 'FUM'], fumLost: ['fumblesLost', 'LOST']},
  kickReturns: {krTd: ['kickReturnTouchdowns', 'TD']},
  puntReturns: {prTd: ['puntReturnTouchdowns', 'TD']}
};
const toNum = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const headOf = a => {
  const h = a && a.headshot && (typeof a.headshot === 'string' ? a.headshot : a.headshot.href);
  if (typeof h === 'string' && /^https:\/\//.test(h)) return h;
  return a && /^\d+$/.test(String(a.id || '')) ? `https://a.espncdn.com/i/headshots/nfl/players/full/${a.id}.png` : null;
};
export function parseBox(j) {
  const P = new Map();
  const teams = j && j.boxscore && Array.isArray(j.boxscore.players) ? j.boxscore.players : [];
  teams.forEach(tm => {
    const team = String((tm && tm.team && tm.team.abbreviation) || '').toUpperCase();
    (Array.isArray(tm && tm.statistics) ? tm.statistics : []).forEach(cat => {
      const F = FIELDS[cat && cat.name];
      if (!F) return;
      const keys = Array.isArray(cat.keys) ? cat.keys : [], labels = Array.isArray(cat.labels) ? cat.labels : [];
      const idx = Object.entries(F).map(([f, [k, lb]]) => [f, keys.indexOf(k) >= 0 ? keys.indexOf(k) : labels.indexOf(lb)]).filter(x => x[1] >= 0);
      (Array.isArray(cat.athletes) ? cat.athletes : []).forEach(x => {
        const a = x && x.athlete, nm = a && a.displayName;
        if (!nm || !Array.isArray(x.stats)) return;
        const key = norm(nm) + '|' + team;
        const p = P.get(key) || {id: a.id ? String(a.id) : '', name: String(nm), key: norm(nm), team, head: headOf(a), s: {}};
        idx.forEach(([f, i]) => {
          const v = x.stats[i];
          if (f === 'cmpAtt') { const m = /^(\d+)\s*\/\s*(\d+)/.exec(String(v || '')); if (m) { p.s.cmp = +m[1]; p.s.att = +m[2]; } }
          else p.s[f] = toNum(v);
        });
        P.set(key, p);
      });
    });
  });
  const players = [...P.values()];
  players.forEach(p => { p.s.retTd = (p.s.krTd || 0) + (p.s.prTd || 0); delete p.s.krTd; delete p.s.prTd; p.pts = points(p.s); });
  return {players};
}

/** His line, the parts he has: passing, then rushing, then receiving, then turnovers and return TDs. */
export function statLine(p) {
  const s = p.s || {}, out = [];
  if (s.att) out.push(`${s.cmp || 0}/${s.att}, ${s.passYds || 0} yds` + (s.passTd ? `, ${s.passTd} TD` : '') + (s.int ? `, ${s.int} INT` : ''));
  if (s.car) out.push(`${s.car} car, ${s.rushYds || 0} yds` + (s.rushTd ? `, ${s.rushTd} TD` : ''));
  if (s.rec || s.tgt || s.recYds) out.push(`${s.rec || 0}${s.tgt ? '/' + s.tgt : ''} rec, ${s.recYds || 0} yds` + (s.recTd ? `, ${s.recTd} TD` : ''));
  if (s.retTd) out.push(`${s.retTd} return TD`);
  if (s.fumLost) out.push(`${s.fumLost} fum lost`);
  return out.join(' · ');
}

// The league's owners: the season's draft, then its trades.
export function ownersOf(league, year) {
  const m = new Map();
  const d = league && Array.isArray(league.drafts) ? league.drafts.find(x => x && x.year === year) : null;
  if (!d) return m;
  (Array.isArray(d.picks) ? d.picks : []).forEach(p => { if (p && p.player && p.manager) m.set(norm(p.player), p.manager); });
  (Array.isArray(league.trades) ? league.trades : []).filter(t => t && t.year === year).sort((a, b) => (a.week || 0) - (b.week || 0))
    .forEach(t => (t.sides || []).forEach(sd => (sd.got || []).forEach(nm => { if (sd.manager) m.set(norm(nm), sd.manager); })));
  return m;
}
export const ownerOf = (owners, p) => (owners && owners.get(norm(p.name))) || null;

// Positions from the current player list (data/nfl-players.json: [name, team, pos, score]).
const POS_URL = new URL('../../data/nfl-players.json', import.meta.url).href;
let posP = null, POS = null;
export function loadPositions() {
  if (!posP) posP = fetch(POS_URL).then(r => { if (!r.ok) throw new Error('nfl-players.json HTTP ' + r.status); return r.json(); }).then(j => {
    const m = new Map();
    (Array.isArray(j && j.p) ? j.p : []).forEach(([name, team, pos]) => {
      if (!/^(QB|RB|WR|TE)$/.test(pos)) return;
      m.set(norm(name) + '|' + team, pos);
      if (!m.has(norm(name))) m.set(norm(name), pos); else if (m.get(norm(name)) !== pos) m.set(norm(name), '');
    });
    POS = m;
    return m;
  }).catch(e => { posP = null; throw e; });
  return posP;
}
export function posOf(p, list = POS) {
  const k = norm(p.name), hit = list && (list.get(k + '|' + p.team) || list.get(k));
  if (hit) return hit;
  const s = p.s || {};
  if ((s.att || 0) >= 5 || ((s.att || 0) > 0 && !(s.car || s.rec))) return 'QB';
  return (s.car || 0) > (s.rec || 0) + 1 ? 'RB' : 'WR';
}

// A game's box: refetched every 30 s while it's on; kept for good once it was fetched SETTLE after it went final
// (ESPN fills in the last plays' stats a few minutes after the final whistle).
const BOX = new Map(), FINAL_SEEN = new Map();
async function getBox(g) {
  const c = BOX.get(g.id);
  if (c && (c.final || Date.now() - c.at < LIVE_MS - 2e3)) return c.box;
  if (g.final && !FINAL_SEEN.has(g.id)) FINAL_SEEN.set(g.id, Date.now());
  try {
    const r = await fetch(SUMMARY + encodeURIComponent(g.id), {cache: 'no-store'});
    if (!r.ok) throw new Error('summary ' + r.status);
    const box = parseBox(await r.json());
    BOX.set(g.id, {box, at: Date.now(), final: !!g.final && Date.now() - FINAL_SEEN.get(g.id) >= SETTLE});
    return box;
  } catch (_) {
    return c ? c.box : null;
  }
}
// A past week's boxes (its games are over: fetched once, kept for the session).
const PAST = new Map();
export function pastWeek(year, week) {
  const k = year + '-w' + week;
  if (!PAST.has(k)) {
    const p = nfl.scoreboard(year, week).then(async d => {
      const go = d.games.filter(g => g.state === 'post');
      const list = await Promise.all(go.map(g => fetch(SUMMARY + encodeURIComponent(g.id))
        .then(r => { if (!r.ok) throw new Error('summary ' + r.status); return r.json(); })
        .then(j => [g.id, parseBox(j)], () => null)));
      const boxes = new Map(list.filter(Boolean));
      if (boxes.size < go.length || d.stale) PAST.delete(k);
      return {year: d.year, week: d.week, games: d.games, boxes};
    });
    p.catch(() => PAST.delete(k));
    PAST.set(k, p);
  }
  return PAST.get(k);
}
const boxDone = id => { const c = BOX.get(id); return !!c && c.final; };

// ---------------------------------------------------------------------------------------------- Watching
export function watch(fn) {
  let dead = false, timer = 0, seq = 0, wk = null, last = null;
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const due = g => g.state === 'pre' && g.kickoff.getTime() <= Date.now() + 60e3;
  const arm = () => {
    clearTimeout(timer); timer = 0;
    if (dead || hidden() || !last) return;
    const gs = last.games;
    const busy = gs.some(g => g.state === 'in' || due(g) || (g.state === 'post' && !boxDone(g.id)));
    if (!busy && !last.stale && gs.length && gs.every(g => g.state === 'post')) return;
    let ms = busy ? LIVE_MS : IDLE_MS;
    const next = gs.filter(g => g.state === 'pre' && g.kickoff.getTime() > Date.now()).map(g => g.kickoff.getTime()).sort((a, b) => a - b)[0];
    if (next) ms = Math.min(ms, Math.max(5e3, next - Date.now() + 15e3));
    timer = setTimeout(pull, ms);
  };
  const pull = async () => {
    if (dead) return;
    const my = ++seq;
    try {
      if (!wk) { const c = await nfl.currentWeek(); wk = {year: c.year, week: c.week}; }
      const d = await nfl.scoreboard(wk.year, wk.week, {fresh: !!last});
      const go = d.games.filter(g => g.state === 'in' || g.state === 'post');
      const list = await Promise.all(go.map(g => getBox(g).then(b => [g.id, b])));
      if (dead || my !== seq) return;
      last = {year: d.year, week: d.week, games: d.games, boxes: new Map(list.filter(x => x[1])), at: Date.now(), stale: !!d.stale};
    } catch (e) {
      if (dead || my !== seq) return;
      last = last ? Object.assign({}, last, {stale: true}) : {year: wk && wk.year, week: wk && wk.week, games: [], boxes: new Map(), at: 0, stale: true, error: 'offline'};
    }
    try { fn(last); } catch (err) { console.error(err); }
    arm();
  };
  const onVis = () => { if (hidden()) { clearTimeout(timer); timer = 0; } else if (last) pull(); };
  try { document.addEventListener('visibilitychange', onVis); } catch (_) {}
  pull();
  return () => { dead = true; clearTimeout(timer); try { document.removeEventListener('visibilitychange', onVis); } catch (_) {} };
}
