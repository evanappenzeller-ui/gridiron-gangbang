// The live games tracker's feed (views/live.js, the owner's alone: Oct 25 2026): the NFL week's games (nfl.js, with
// the ball's spot while one is on) and every player's line from ESPN's box scores (the public summary endpoint, per
// game once it has kicked off), with his fantasy points in the league's scoring (PPR). No DOM. Owner: LIVE.
//
//   watch(fn, want)    -> stop; fn({year, week, games, boxes: Map(gameId -> box), at, stale}) now and on every update
//                         (want: {year, week}, that week's games; else the NFL's current week):
//                         every 30 s while a game is on (or just final, until its box settles), every 5 min otherwise,
//                         not at all while the page is hidden or once every game is over
//   parseBox(json)     -> {players: [{id, name, team, head, s: {cmp, att, passYds, passTd, int, car, rushYds, rushTd,
//                         tgt, rec, recYds, recTd, fum, fumLost, retTd, two}}], kickers: [{name, key, team, fg: [yards of
//                         each made], fgAtt, xp, xpAtt, pts}], defs: {TEAM: {sacks, int, fr, td, sfty}}} (pure; for the checks)
//   points(s)          -> the PPR points of a stat line (2 decimals)
//   kPoints(k), defPoints(d, allowed) -> a kicker's points, a defense's (Yahoo's standard; core/fantasy-live.js)
//   norm(name)         -> a player's name as the matches go by (no case, accents, punctuation or Jr/III)
//   statLine(p)        -> "24/31, 288 yds, 3 TD, 1 INT · 6 car, 41 yds" (the parts he has)
//   posOf(p, list)     -> 'QB' | 'RB' | 'WR' | 'TE': the player list's (data/nfl-players.json), else read off his stats
//   loadPositions()    -> Promise of the player list's positions (name|team -> pos); also loads the ranks
//   rankOf(p)          -> {score, ref} once the list loaded: his relevance in the list (PPR points, data/nfl-players.json)
//                         and a starter's at his position (the 12th QB or TE, the 24th RB or WR); else null
//   ownersOf(league, year) -> Map(player's name, normalized -> manager id): who has him in the league, from Yahoo's
//                         rosters (league.json seasons[].rosters, synced twice a day) or, without them, that season's
//                         draft (league.json drafts); then the trades, pickups and drops on file since (league.json
//                         pickups/drops, Yahoo's League Transactions) in time order: a pickup gives him to that manager,
//                         a drop frees him. A move since the last sync still shows the last owner known.
//   ownerOf(owners, p) -> his manager's id, or null
//   pastWeek(year, week) -> Promise<{year, week, games, boxes}>: a finished week's box scores (the waiver wire's week
//                         before), fetched once a session (again only if a box failed to load)
//
// Scoring (PPR, Yahoo's standard, which the league plays): 1 a catch, 0.1 a rushing or receiving yard, 0.04 a passing
// yard, 6 a rushing, receiving or return TD, 4 a passing TD, -1 an interception thrown, -2 a fumble lost, 2 a two-point
// conversion (passer and catcher; read off the scoring plays). Kickers: 3 a field goal under 40 yards, 4 from 40-49,
// 5 from 50+, 1 an extra point. Defenses: 1 a sack, 1 an interception, 2 a fumble recovery, 6 a touchdown (returns and
// blocked kicks too), 2 a safety, and by points allowed: 0 10, 1-6 7, 7-13 4, 14-20 1, 21-27 0, 28-34 -1, 35+ -4.
// Kickers and defenses score only in the league's matchups (core/fantasy-live.js); the Live tab lists the four positions.
import * as nfl from './nfl.js';

const SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=';
const LIVE_MS = 30e3, IDLE_MS = 5 * 60e3, SETTLE = 15 * 60e3;

export const PPR = {passYds: 0.04, passTd: 4, int: -1, rushYds: 0.1, rushTd: 6, rec: 1, recYds: 0.1, recTd: 6, retTd: 6, fumLost: -2, two: 2};
export function points(s) {
  if (!s) return 0;
  const t = Object.entries(PPR).reduce((a, [k, w]) => a + (Number(s[k]) || 0) * w, 0);
  return Math.round(t * 100) / 100;
}

const r2 = n => Math.round(n * 100) / 100;
export function kPoints(k) {
  if (!k) return 0;
  const fg = Array.isArray(k.fg) ? k.fg : [];
  return r2(fg.reduce((a, y) => a + (y >= 50 ? 5 : y >= 40 ? 4 : 3), 0) + (Number(k.xp) || 0));
}
const PA = [[0, 10], [6, 7], [13, 4], [20, 1], [27, 0], [34, -1]];
export function defPoints(d, allowed) {
  const x = d || {}, pa = Number(allowed) || 0;
  const tier = (PA.find(([hi]) => pa <= hi) || [0, -4])[1];
  return r2((x.sacks || 0) + (x.int || 0) + 2 * (x.fr || 0) + 6 * (x.td || 0) + 2 * (x.sfty || 0) + tier);
}

// ---------------------------------------------------------------------------------------------- Box scores
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`.]/g, '')
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
// Kickers' and defenses' columns (core/fantasy-live.js scores them).
const KICK = {fg: ['fieldGoalsMade/fieldGoalAttempts', 'FG'], xp: ['extraPointsMade/extraPointAttempts', 'XP']};
const SACKS = ['sacks', 'SACKS'];
const colOf = (cat, [k, lb]) => { const ks = Array.isArray(cat.keys) ? cat.keys : [], ls = Array.isArray(cat.labels) ? cat.labels : []; return ks.indexOf(k) >= 0 ? ks.indexOf(k) : ls.indexOf(lb); };
const madeOf = v => { const m = /^(\d+)\s*\/\s*(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2]] : [0, 0]; };
// A scoring play's two-point try: "(Joe Burrow Pass to Ja'Marr Chase for Two-Point Conversion)", "(Bijan Robinson Run
// for Two-Point Conversion)"; a failed one scores nothing.
const TWO = /\(([^()]*?)\s+(pass to|run for|rush for|pass for)\s*([^()]*?)\s*(?:for\s+)?two[- ]point conversion\)/i;
const DEF_TD = /return|blocked|interception|defensive/i; // with "touchdown": a pick-six, a fumble or kick return, a blocked kick
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
  players.forEach(p => { p.s.retTd = (p.s.krTd || 0) + (p.s.prTd || 0); delete p.s.krTd; delete p.s.prTd; });
  // Kickers, and each team's sacks (its players' defensive lines).
  const K = new Map(), defs = {}, order = [], byId = {};
  const def = t => defs[t] || (defs[t] = {sacks: 0, int: 0, fr: 0, td: 0, sfty: 0});
  teams.forEach(tm => {
    const team = String((tm && tm.team && tm.team.abbreviation) || '').toUpperCase();
    if (!team) return;
    order.push(team); def(team);
    if (tm.team.id != null) byId[String(tm.team.id)] = team;
    (Array.isArray(tm.statistics) ? tm.statistics : []).forEach(cat => {
      const rows = Array.isArray(cat && cat.athletes) ? cat.athletes : [];
      if (cat && cat.name === 'kicking') {
        const fi = colOf(cat, KICK.fg), xi = colOf(cat, KICK.xp);
        rows.forEach(x => {
          const nm = x && x.athlete && x.athlete.displayName;
          if (!nm || !Array.isArray(x.stats)) return;
          const [fgm, fgAtt] = fi >= 0 ? madeOf(x.stats[fi]) : [0, 0], [xp, xpAtt] = xi >= 0 ? madeOf(x.stats[xi]) : [0, 0];
          K.set(norm(nm) + '|' + team, {name: String(nm), key: norm(nm), team, fg: [], fgm, fgAtt, xp, xpAtt});
        });
      } else if (cat && cat.name === 'defensive') {
        const si = colOf(cat, SACKS);
        if (si >= 0) rows.forEach(x => { if (x && Array.isArray(x.stats)) def(team).sacks += toNum(x.stats[si]); });
      }
    });
  });
  // Takeaways: the other side's interceptions thrown and fumbles lost.
  players.forEach(p => {
    const other = order.length === 2 && order.includes(p.team) ? order.find(t => t !== p.team) : null;
    if (other) { def(other).int += p.s.int || 0; def(other).fr += p.s.fumLost || 0; }
  });
  // The scoring plays: each field goal's distance, two-point conversions, and the defenses' touchdowns and safeties.
  (Array.isArray(j && j.scoringPlays) ? j.scoringPlays : []).forEach(sp => {
    const text = String((sp && sp.text) || ''), type = String((sp && sp.type && sp.type.text) || '');
    const team = String((sp && sp.team && (sp.team.abbreviation || byId[String(sp.team.id)])) || '').toUpperCase();
    const fg = /^(.+?)\s+(\d+)\s*y(?:ar)?ds?\.?\s+field goal/i.exec(text);
    if (fg && !/no good|missed|blocked/i.test(text)) {
      const k = K.get(norm(fg[1]) + '|' + team) || [...K.values()].find(x => x.key === norm(fg[1]));
      if (k && k.fg.length < k.fgm) k.fg.push(+fg[2]);
      return;
    }
    if (defs[team] && /safety/i.test(type) && !/touchdown/i.test(type)) { def(team).sfty++; return; }
    if (defs[team] && /touchdown/i.test(type) && DEF_TD.test(type)) def(team).td++;
    const two = TWO.exec(text);
    if (two && !/fail|no good/i.test(two[0])) {
      (/pass to/i.test(two[2]) ? [two[1], two[3]] : [two[1]]).map(n => n.trim()).filter(Boolean).forEach(n => {
        const k = norm(n);
        const p = players.find(x => x.key === k && (!team || x.team === team)) || players.find(x => x.key === k);
        if (p) p.s.two = (p.s.two || 0) + 1;
        else if (team) players.push({id: '', name: n, key: k, team, head: null, s: {two: 1}});
      });
    }
  });
  const kickers = [...K.values()].map(k => {
    while (k.fg.length < k.fgm) k.fg.push(0); // a made kick the plays don't list (yet): 3
    delete k.fgm;
    return Object.assign(k, {pts: kPoints(k)});
  });
  players.forEach(p => { p.pts = points(p.s); });
  return {players, kickers, defs};
}

/** His line, the parts he has: passing, then rushing, then receiving, then turnovers and return TDs. */
export function statLine(p) {
  const s = p.s || {}, out = [];
  if (s.att) out.push(`${s.cmp || 0}/${s.att}, ${s.passYds || 0} yds` + (s.passTd ? `, ${s.passTd} TD` : '') + (s.int ? `, ${s.int} INT` : ''));
  if (s.car) out.push(`${s.car} car, ${s.rushYds || 0} yds` + (s.rushTd ? `, ${s.rushTd} TD` : ''));
  if (s.rec || s.tgt || s.recYds) out.push(`${s.rec || 0}${s.tgt ? '/' + s.tgt : ''} rec, ${s.recYds || 0} yds` + (s.recTd ? `, ${s.recTd} TD` : ''));
  if (s.retTd) out.push(`${s.retTd} return TD`);
  if (s.two) out.push(`${s.two} 2PT`);
  if (s.fumLost) out.push(`${s.fumLost} fum lost`);
  return out.join(' · ');
}

// The league's owners: Yahoo's rosters when the season has them (seasons[].rosters, synced by tools/yahoo), else the
// season's draft; then the trades, pickups and drops since (all of them after a draft, only later ones after rosters) by
// week and time (a trade's "2026-09-18T20:15", else its "Sep 18" date, a move's "2026-10-21T05:23"; same week and no
// time keeps file order, trades first).
export function ownersOf(league, year) {
  const m = new Map();
  const season = league && Array.isArray(league.seasons) ? league.seasons.find(x => x && x.year === year) : null;
  const ro = season && season.rosters && season.rosters.teams && typeof season.rosters.teams === 'object' ? season.rosters : null;
  const d = league && Array.isArray(league.drafts) ? league.drafts.find(x => x && x.year === year) : null;
  if (!ro && !d) return m;
  if (ro) Object.entries(ro.teams).forEach(([mgr, ps]) => (Array.isArray(ps) ? ps : []).forEach(p => { if (p && p[0]) m.set(norm(p[0]), mgr); }));
  else (Array.isArray(d.picks) ? d.picks : []).forEach(p => { if (p && p.player && p.manager) m.set(norm(p.player), p.manager); });
  const since = ro ? Date.parse(ro.at) || Infinity : -Infinity;
  const list = k => (Array.isArray(league[k]) ? league[k] : []).filter(x => x && x.year === year);
  const ev = [];
  list('trades').forEach(t => ev.push({week: t.week, t: Date.parse(t.at || `${t.date} ${year}`), run: () =>
    (t.sides || []).forEach(sd => (sd.got || []).forEach(nm => { if (sd.manager) m.set(norm(nm), sd.manager); }))}));
  list('drops').forEach(x => ev.push({week: x.week, t: Date.parse(x.at), run: () => { if (x.player) m.delete(norm(x.player)); }}));
  list('pickups').forEach(x => ev.push({week: x.week, t: Date.parse(x.at), run: () => { if (x.player && x.manager) m.set(norm(x.player), x.manager); }}));
  ev.map((e, i) => Object.assign(e, {i, t: e.t || 0})).filter(e => e.t > since).sort((a, b) => (a.week || 0) - (b.week || 0) || a.t - b.t || a.i - b.i).forEach(e => e.run());
  return m;
}
export const ownerOf = (owners, p) => (owners && owners.get(norm(p.name))) || null;

// Positions from the current player list (data/nfl-players.json: [name, team, pos, score]).
const POS_URL = new URL('../../data/nfl-players.json', import.meta.url).href;
let posP = null, POS = null, RANK = null;
const STARTER = {QB: 12, RB: 24, WR: 24, TE: 12};
export function loadPositions() {
  if (!posP) posP = fetch(POS_URL).then(r => { if (!r.ok) throw new Error('nfl-players.json HTTP ' + r.status); return r.json(); }).then(j => {
    const m = new Map(), score = new Map(), by = {};
    (Array.isArray(j && j.p) ? j.p : []).forEach(([name, team, pos, sc]) => {
      if (!/^(QB|RB|WR|TE)$/.test(pos)) return;
      m.set(norm(name) + '|' + team, pos);
      if (!m.has(norm(name))) m.set(norm(name), pos); else if (m.get(norm(name)) !== pos) m.set(norm(name), '');
      const v = Number(sc);
      if (!isFinite(v)) return;
      score.set(norm(name) + '|' + team, v);
      score.set(norm(name), score.has(norm(name)) ? null : v);
      (by[pos] = by[pos] || []).push(v);
    });
    const ref = {};
    Object.entries(by).forEach(([pos, v]) => { v.sort((a, b) => b - a); ref[pos] = v[Math.min(v.length, STARTER[pos]) - 1]; });
    POS = m;
    RANK = {score, ref};
    return m;
  }).catch(e => { posP = null; throw e; });
  return posP;
}
export function rankOf(p) {
  if (!RANK || !p || !RANK.ref[p.pos]) return null;
  const k = norm(p.name), v = RANK.score.has(k + '|' + p.team) ? RANK.score.get(k + '|' + p.team) : RANK.score.get(k);
  return v == null ? null : {score: v, ref: RANK.ref[p.pos]};
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
export function watch(fn, want) {
  let dead = false, timer = 0, seq = 0, wk = want && want.year && want.week ? {year: want.year, week: want.week} : null, last = null;
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
