// The Lay's live tracking: reads each leg's free text ("Josh Allen 35+ Rush Yards", "Bills -3.5", "Lions Panthers
// Over 51.5"), then scores it against that NFL week's games (nfl.js scoreboard) and ESPN's box scores (the public
// summary endpoint, per game, once it has kicked off). No DOM. Owner: LAY.
//
//   parseLeg(text, teams)        -> a bet {kind, ...} or null (can't read it; the slip shows it without tracking)
//   track(year, week, fn)        -> unsubscribe; fn(T) now and on every update, T = {games, boxes, at}
//   evaluate(text, T)            -> {st: 'pre'|'live'|'hit'|'miss'|'na', note, v, n, op, game}
//   describe(text, games)        -> the leg in standard sportsbook wording ("James Cook Anytime TD Scorer",
//                                   "Buffalo Bills -3.5"), which reads back as the same bet; null when unreadable
//   loadPlayers()                -> Promise: the current players (data/nfl-players.json) for names and suggestions
//   suggest(text, games, max)    -> autofill: [{text, label, sub}] (players and teams while the name is typed, then
//                                   bets for that player or team)
//
// Names: nicknames ("CMC", "JSN", "ARSB", "Sun God"), a lone first or last name that clearly means one current player
// ("Bijan TD", "Kittle 5+ rec") and small typos ("McCafferey", "Smith Njigba") all read as the player's real name.
//
// Bets it reads: a player's anytime TD ("TD", "Anytime", "N+ TD"), passing TDs ("2+ Pass TD"), receptions ("3+ Rec",
// "over 4.5 Rec"), receiving / rushing / passing yards ("50+ Rec Yards", "over 46.5 Rush Yards"; plain "Yards" is
// passing yards for a QB, else rushing + receiving), a team's moneyline ("ML"), spread ("-3.5"; "spread" alone takes
// ESPN's line), team total ("team total over 19.5"; over when unsaid) and a game total ("Lions Panthers Over 51.5").
// "N+" means at least N, "over X" more than X, "under X" less than X. Overs hit the moment they get there; unders,
// moneylines and spreads wait for the final. A player missing from every finished box score stays unsettled ('na').
import * as nfl from './nfl.js';

const SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=';
const LIVE_TTL = 30e3;
const LS = 'gg-box-';

// ---------------------------------------------------------------------------------------------- Text
const norm = s => String(s || '').replace(/[−–—]/g, '-').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[’'`]/g, '').replace(/\.(?!\d)/g, '').replace(/[^a-z0-9+\-. ]+/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim();
const ALIAS = {niners: '49ers', pats: 'patriots', jags: 'jaguars', bucs: 'buccaneers', fins: 'dolphins', hawks: 'seahawks'};
const STOP = /^(\d|\+|-|over\b|under\b|o\d|u\d|alt\b|anytime\b|atd\b|td\b|tds\b|touchdown|to\b|rec\b|recs\b|reception|receiving|rush|rushing|pass|passing|yards?\b|yds\b|ml\b|moneyline|spread|team\b|total)/;

// City and nickname of every NFL team (ESPN's names are used too; these cover a feed that sends abbreviations only).
const NFL_TEAMS = {ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns', DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers', HOU: 'Houston Texans', IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs', LV: 'Las Vegas Raiders', LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams', MIA: 'Miami Dolphins', MIN: 'Minnesota Vikings', NE: 'New England Patriots',
  NO: 'New Orleans Saints', NYG: 'New York Giants', NYJ: 'New York Jets', PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers', SF: 'San Francisco 49ers', SEA: 'Seattle Seahawks', TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans', WSH: 'Washington Commanders'};

/** Every team of the week's games, as {abbr, words: [normalized names it goes by]}. A city shared by two teams that
 *  week (New York, Los Angeles) names neither. */
function teamsOf(games) {
  const out = new Map(), city = new Map();
  // No games to hand (the week's scoreboard not loaded yet): every NFL team.
  if (!games || !games.length) games = [{home: null, away: null}].concat(Object.keys(NFL_TEAMS).map(abbr => ({home: {abbr, name: NFL_TEAMS[abbr], short: NFL_TEAMS[abbr].split(' ').pop()}, away: null})));
  games.forEach(g => [g.home, g.away].forEach(t => {
    if (!t || out.has(t.abbr)) return;
    const known = NFL_TEAMS[t.abbr] || '';
    const full = norm(known || t.name), short = known ? full.split(' ').pop() : norm(t.short);
    const loc = full.endsWith(' ' + short) ? full.slice(0, -short.length - 1) : '';
    out.set(t.abbr, {abbr: t.abbr, words: [...new Set([full, short, norm(t.name), norm(t.short), t.abbr.toLowerCase()])]});
    if (loc) city.set(loc, city.has(loc) ? null : t.abbr);
  }));
  city.forEach((abbr, loc) => { if (abbr) out.get(abbr).words.push(loc); });
  Object.keys(ALIAS).forEach(a => out.forEach(t => { if (t.words.includes(ALIAS[a])) t.words.push(a); }));
  return [...out.values()];
}
const has = (s, w) => new RegExp(`(^| )${w.replace(/[+.]/g, '\\$&')}( |$)`).test(s);
function teamsIn(s, teams) {
  const hits = [];
  teams.forEach(t => {
    const w = t.words.filter(x => x && has(s, x)).sort((a, b) => b.length - a.length)[0];
    if (w) hits.push({abbr: t.abbr, at: s.indexOf(w)});
  });
  return hits.sort((a, b) => a.at - b.at).map(h => h.abbr);
}

/** The line of an over / under / N+ bet: {op: 'gte'|'gt'|'lt', n} or null. */
function lineIn(s, dflt) {
  let m = /(\d+(?:\.\d+)?) ?\+/.exec(s);
  if (m) return {op: 'gte', n: +m[1]};
  m = /\b(?:over|o) ?(\d+(?:\.\d+)?)/.exec(s);
  if (m) return {op: 'gt', n: +m[1]};
  m = /\b(?:under|u) ?(\d+(?:\.\d+)?)/.exec(s);
  if (m) return {op: 'lt', n: +m[1]};
  if (dflt && /\b(over|under)\b/.test(s) === false) { m = /(\d+(?:\.\d+)?)/.exec(s); if (m) return {op: dflt, n: +m[1]}; }
  return null;
}

// ---------------------------------------------------------------------------------------------- Players and nicknames
// The current skill players (QB, RB, WR, TE, K) from data/nfl-players.json: [name, ESPN team, position, relevance].
const PLAYERS_URL = new URL('../../data/nfl-players.json', import.meta.url).href;
let PL = null, plP = null;
const nk = x => unhyph(norm(x)); // a name's matching form: normalized, hyphens as spaces
export function loadPlayers() {
  if (PL) return Promise.resolve(PL);
  if (plP) return plP;
  plP = fetch(PLAYERS_URL).then(r => { if (!r.ok) throw new Error('players ' + r.status); return r.json(); }).then(j => {
    const list = (Array.isArray(j.p) ? j.p : []).map(([name, team, pos, score]) => {
      const k = nk(name), w = k.split(' ');
      return {name, team, pos, score: +score || 0, k, first: w[0], last: w.slice(1).join(' '), words: w};
    });
    const first = new Map(), last = new Map();
    list.forEach(p => {
      (first.get(p.first) || first.set(p.first, []).get(p.first)).push(p);
      (last.get(p.last) || last.set(p.last, []).get(p.last)).push(p);
      const lw = p.words[p.words.length - 1];
      if (lw !== p.last) (last.get(lw) || last.set(lw, []).get(lw)).push(p);
    });
    PL = {list, first, last, byK: new Map(list.map(p => [p.k, p]))};
    return PL;
  }).catch(e => { plP = null; throw e; });
  return plP;
}
export const playersReady = () => !!PL;
// Nicknames people type for current players (a nickname whose player isn't on a roster now is skipped).
const NICK = {
  'cmc': 'Christian McCaffrey', 'jsn': 'Jaxon Smith-Njigba', 'ajb': 'A.J. Brown', 'arsb': 'Amon-Ra St. Brown', 'sun god': 'Amon-Ra St. Brown',
  'mhj': 'Marvin Harrison Jr.', 'btj': 'Brian Thomas Jr.', 'scary terry': 'Terry McLaurin', 'tmac': 'Tetairoa McMillan', 't mac': 'Tetairoa McMillan', 'tet': 'Tetairoa McMillan',
  'hock': 'T.J. Hockenson', 'dk': 'DK Metcalf', 'deebo': 'Deebo Samuel Sr.', 'jettas': 'Justin Jefferson', 'jjettas': 'Justin Jefferson', 'jj': 'Justin Jefferson',
  'cheetah': 'Tyreek Hill', 'etn': 'Travis Etienne', 'jt': 'Jonathan Taylor', 'hollywood': 'Marquise Brown', 'zay': 'Zay Flowers',
  'dhop': 'DeAndre Hopkins', 'd hop': 'DeAndre Hopkins', 'nuk': 'DeAndre Hopkins', 'obj': 'Odell Beckham Jr.', 'tlaw': 'Trevor Lawrence', 't law': 'Trevor Lawrence',
  'jk': 'J.K. Dobbins', 'kw3': 'Kenneth Walker III', 'ken walker': 'Kenneth Walker III', 'tua': 'Tua Tagovailoa', 'mvs': 'Marquez Valdes-Scantling',
  'joey b': 'Joe Burrow', 'joey burrow': 'Joe Burrow', 'bucky': 'Bucky Irving', 'saquads': 'Saquon Barkley', 'pat mahomes': 'Patrick Mahomes',
  'jamo': 'Jameson Williams', 'jd5': 'Jayden Daniels', 'cj': 'C.J. Stroud', 'kyler': 'Kyler Murray', 'jaylen waddle': 'Jaylen Waddle', 'waddle': 'Jaylen Waddle',
  'dj moore': 'DJ Moore', 'aj brown': 'A.J. Brown', 'tj hockenson': 'T.J. Hockenson', 'cj stroud': 'C.J. Stroud', 'jk dobbins': 'J.K. Dobbins'
};
function byName(name) {
  if (!PL) return null;
  const k = nk(name);
  return PL.byK.get(k) || PL.list.find(p => p.k.replace(/ (jr|sr|ii|iii|iv|v)$/, '') === k.replace(/ (jr|sr|ii|iii|iv|v)$/, '')) || null;
}
const nickOf = key => { const t = NICK[key] || NICK[key.replace(/ /g, '')]; return t ? (byName(t) || (PL ? null : {name: t})) : null; };
// One current player a lone name clearly means: the only one with it, or one far better known than the rest.
function clearOne(list) {
  if (!list || !list.length) return null;
  const s = list.slice().sort((a, b) => b.score - a.score);
  return s.length === 1 || (s[0].score >= 40 && s[0].score >= 2.5 * Math.max(1, s[1].score)) ? s[0] : null;
}
/** The leg with the player's real name in front, when it starts with a nickname, a lone first or last name, or a
 *  slightly misspelled name. Team bets and unknown names come back as typed. */
export function expandLeg(text) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const words = raw.split(/\s+/);
  const s = nk(raw);
  if (teamsIn(s, teamsOf(null)).length && teamsOf(null).some(t => t.words.some(w => w && s.startsWith(w + ' ') || s === w))) {
    // starts with a team ("Bills -3.5", "Dallas Cowboys ML"); a player whose name starts with a city ("Dallas Goedert") is checked first
    if (!PL || !PL.list.some(p => s === p.k || s.startsWith(p.k + ' '))) return raw;
  }
  const put = (k, name) => [name].concat(words.slice(k)).join(' ');
  // Already a current player's full name: keep it (with the official spelling).
  if (PL) {
    const full = PL.list.filter(p => s === p.k || s.startsWith(p.k + ' ')).sort((a, b) => b.k.length - a.k.length)[0];
    if (full) {
      // how many typed words make up the name (hyphens may have been typed as spaces)
      for (let k = 1; k <= Math.min(5, words.length); k++) if (nk(words.slice(0, k).join(' ')) === full.k) return put(k, full.name);
    }
  }
  // A nickname (up to three words): "CMC", "Sun God", "Joey B".
  for (let k = Math.min(3, words.length); k >= 1; k--) {
    const p = nickOf(nk(words.slice(0, k).join(' ')));
    if (p) return put(k, p.name);
  }
  if (!PL) return raw;
  // A name of two or three words that is a near miss (missing hyphen, a typo): the one current player it matches.
  const nameLen = (() => { let n = 0; for (const w of nk(raw).split(' ')) { if (STOP.test(w)) break; n++; } return n; })();
  if (nameLen >= 2) {
    const want = nk(words.slice(0, nameLen).join(' '));
    const near = PL.list.filter(p => sameMan(p.k, want) && p.first === want.split(' ')[0]);
    const one = near.length === 1 ? near[0] : clearOne(PL.list.filter(p => nearMan(p.k, want)));
    if (one) for (let k = 1; k <= words.length; k++) if (nk(words.slice(0, k).join(' ')) === want) return put(k, one.name);
    return raw;
  }
  // A lone first or last name ("Bijan", "Kittle").
  const w0 = nk(words[0]);
  if (w0.length >= 4 && !STOP.test(w0)) {
    const one = clearOne([...new Set([...(PL.first.get(w0) || []), ...(PL.last.get(w0) || [])])]);
    if (one) return put(1, one.name);
  }
  return raw;
}

/** Reads a leg's text. teams: teamsOf(the week's games) (team bets need them). */
export function parseLeg(text, teams = []) {
  text = expandLeg(text);
  const s = norm(text);
  if (!s) return null;
  const T = teamsIn(s, teams);
  const signed = /(^| )([+-]\d+(?:\.\d+)?)( |$)/.exec(s);
  const teamy = /\b(ml|moneyline|spread|team total|win|wins)\b/.test(s) || signed;
  // Game total: two teams and an over / under.
  if (T.length >= 2 && /\b(over|under|o\d|u\d)/.test(s)) {
    const ln = lineIn(s);
    return ln ? {kind: 'gameTotal', teams: T.slice(0, 2), ...ln} : null;
  }
  if (T.length && teamy && s.indexOf(teams.find(t => t.abbr === T[0]).words.find(w => has(s, w))) === 0) {
    const team = T[0];
    if (/\bteam total\b/.test(s)) { const ln = /\bunder\b/.test(s) ? lineIn(s) : lineIn(s.replace(/\bover\b/, ''), 'gt'); return ln ? {kind: 'teamTotal', team, ...ln} : null; }
    if (/\b(ml|moneyline|win|wins)\b/.test(s)) return {kind: 'ml', team};
    if (signed) return {kind: 'spread', team, pts: +signed[2]};
    if (/\bspread\b/.test(s)) return {kind: 'spread', team, pts: null}; // ESPN's line
    return null;
  }
  // A player prop: the name is the words before the first number or bet word.
  const words = s.split(' '), name = [];
  for (const w of words) { if (STOP.test(w)) break; name.push(w); }
  if (name.length < 2) return null;
  const rest = ' ' + words.slice(name.length).join(' ') + ' ';
  const player = name.join(' ');
  // The name as typed (capitalized when typed in lowercase), for the standard wording.
  const raw = String(text).trim().split(/\s+/).slice(0, name.length).map(w => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
  const yds = /\b(yards?|yds)\b/.test(rest);
  let stat = null;
  if (/\bpass(ing)?\b/.test(rest) && /\b(td|tds|touchdowns?)\b/.test(rest)) stat = 'passTd';
  else if (/\b(td|tds|touchdowns?|anytime|atd)\b/.test(rest)) stat = 'td';
  else if (/\brec(eiving)?\b/.test(rest) && yds) stat = 'recYds';
  else if (/\brush(ing)?\b/.test(rest) && yds) stat = 'rushYds';
  else if (/\bpass(ing)?\b/.test(rest) && yds) stat = 'passYds';
  else if (/\b(rec|recs|receptions?|catches)\b/.test(rest)) stat = 'rec';
  else if (yds) stat = 'yds';
  if (!stat) return null;
  // "Over Rec" with no number: the over (or under) on the sportsbook's line, which ESPN doesn't give. Tracked live,
  // settled by hand (n: null).
  const bare = /\bover\b/.test(rest) ? {op: 'gt', n: null} : /\bunder\b/.test(rest) ? {op: 'lt', n: null} : null;
  // A plain number with no over / under: "JSN 100 rec yds" is 100+, "Kelce 4.5 rec" is over 4.5.
  const num = bare ? null : /(?:^| )(\d+(?:\.\d+)?)(?= )/.exec(rest);
  const plain = num ? {op: num[1].includes('.') ? 'gt' : 'gte', n: +num[1]} : null;
  const ln = lineIn(rest) || plain || (stat === 'td' || stat === 'passTd' ? {op: 'gte', n: 1} : bare);
  return ln ? {kind: 'prop', player, raw, stat, ...ln} : null;
}

// ---------------------------------------------------------------------------------------------- Box scores
// A box: {players: [{key (normalized name), name, team (abbr), s: {passAtt, passYds, passTd, rushYds, rushTd, rec,
// recYds, recTd}}]}.
const FIELDS = {
  passing: {passYds: ['passingYards', 'YDS'], passTd: ['passingTouchdowns', 'TD'], passAtt: ['completions/passingAttempts', 'C/ATT']},
  rushing: {rushYds: ['rushingYards', 'YDS'], rushTd: ['rushingTouchdowns', 'TD']},
  receiving: {rec: ['receptions', 'REC'], recYds: ['receivingYards', 'YDS'], recTd: ['receivingTouchdowns', 'TD']}
};
const toNum = (f, v) => {
  if (f === 'passAtt') { const m = /\/(\d+)/.exec(String(v)); return m ? +m[1] : 0; }
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
};
export function parseBox(j) {
  const P = new Map();
  const teams = (j && j.boxscore && Array.isArray(j.boxscore.players)) ? j.boxscore.players : [];
  teams.forEach(tm => {
    const abbr = String((tm.team && tm.team.abbreviation) || '').toUpperCase();
    (Array.isArray(tm.statistics) ? tm.statistics : []).forEach(cat => {
      const F = FIELDS[cat && cat.name];
      if (!F) return;
      const keys = Array.isArray(cat.keys) ? cat.keys : [], labels = Array.isArray(cat.labels) ? cat.labels : [];
      const idx = Object.fromEntries(Object.entries(F).map(([f, [k, lb]]) => [f, keys.indexOf(k) >= 0 ? keys.indexOf(k) : labels.indexOf(lb)]));
      (Array.isArray(cat.athletes) ? cat.athletes : []).forEach(a => {
        const nm = a && a.athlete && a.athlete.displayName;
        if (!nm || !Array.isArray(a.stats)) return;
        const key = norm(nm) + '|' + abbr;
        const p = P.get(key) || {key: norm(nm), name: nm, team: abbr, s: {}};
        Object.entries(idx).forEach(([f, i]) => { if (i >= 0) p.s[f] = toNum(f, a.stats[i]); });
        P.set(key, p);
      });
    });
  });
  return {players: [...P.values()]};
}

// A final game's box is kept for good only once it was fetched SETTLE after the game was first seen final (ESPN
// finishes the last plays' stats a few minutes after the final whistle); until then it is refetched like a live one.
const BOX = new Map(); // gameId -> {box, at, final}
const FINAL_SEEN = new Map(); // gameId -> when this page first saw it final
const SETTLE = 15 * 60e3;
function lsBox(id) { try { const o = JSON.parse(localStorage.getItem(LS + id) || 'null'); return o && Array.isArray(o.players) ? o : null; } catch (_) { return null; } }
const boxDone = id => { const c = BOX.get(id); return !!c && c.final; };
async function getBox(g, force) {
  const c = BOX.get(g.id);
  if (c && (c.final || (!force && Date.now() - c.at < LIVE_TTL))) return c.box;
  if (!c && g.final) { const b = lsBox(g.id); if (b) { BOX.set(g.id, {box: b, at: Date.now(), final: true}); return b; } }
  if (g.final && !FINAL_SEEN.has(g.id)) FINAL_SEEN.set(g.id, Date.now());
  try {
    const r = await fetch(SUMMARY + encodeURIComponent(g.id), {cache: 'no-store'});
    if (!r.ok) throw new Error('summary ' + r.status);
    const box = parseBox(await r.json());
    const settled = !!g.final && Date.now() - FINAL_SEEN.get(g.id) >= SETTLE;
    BOX.set(g.id, {box, at: Date.now(), final: settled});
    if (settled) { try { localStorage.setItem(LS + g.id, JSON.stringify(box)); } catch (_) {} }
    return box;
  } catch (_) {
    return c ? c.box : null;
  }
}

// A player's team before his game has a box score (so a prop shows its kickoff): ESPN's team rosters, read team by
// team (the week's teams) until every wanted name is found. Kept per name for a week ('gg-pteam': {name: [abbr, at]}),
// misses retried after 6 h.
const ROSTER = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/';
const PT_LS = 'gg-pteam3', PT_TTL = 7 * 864e5, PT_MISS = 6 * 36e5;
function ptLoad() { try { const o = JSON.parse(localStorage.getItem(PT_LS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } }
const PT = ptLoad();
const ptFresh = e => Array.isArray(e) && Date.now() - e[1] < (e[0] ? PT_TTL : PT_MISS);
// Names match with hyphens as spaces ("Jaxon Smith Njigba" is Jaxon Smith-Njigba): full name, else first initial + last.
const unhyph = x => x.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
const sameMan = (key, want) => {
  key = unhyph(key); want = unhyph(want);
  const [f, ...l] = want.split(' ');
  return key === want || (key.endsWith(' ' + l.join(' ')) && key[0] === f[0]);
};
// A typo in the last name ("Christian McCafferey"): the same first name and a last name one or two letters off (one
// for short names). Used only when no exact match exists, and only when it points at one player.
function editDist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const nearMan = (key, want) => {
  const [kf, ...kl] = unhyph(key).split(' '), [wf, ...wl] = unhyph(want).split(' ');
  const a = kl.join(' '), b = wl.join(' ');
  if (kf !== wf || !a || !b || a === b) return false;
  return editDist(a, b) <= (b.length >= 7 ? 2 : b.length >= 4 ? 1 : 0);
};
const ROSTERS = new Map(); // team id -> [normalized names]
async function rosterOf(t) {
  if (ROSTERS.has(t.id)) return ROSTERS.get(t.id);
  const r = await fetch(ROSTER + encodeURIComponent(t.id) + '/roster');
  if (!r.ok) throw new Error('roster ' + r.status);
  const j = await r.json(), names = [];
  (Array.isArray(j.athletes) ? j.athletes : []).forEach(g => (Array.isArray(g && g.items) ? g.items : [g]).forEach(a => {
    const nm = a && (a.displayName || a.fullName);
    if (nm) names.push(norm(nm));
  }));
  ROSTERS.set(t.id, names);
  return names;
}
let ptBusy = null, ptFailAt = 0;
// Not async: "nothing to look up" must be a plain null, not a promise (the Lay redraws when a promise settles, and a
// redraw asks again: a promise here every time would redraw without end).
function findTeams(names, games) {
  const need = new Set(names.filter(n => !ptFresh(PT[n])));
  if (!need.size || ptBusy) return ptBusy || null;
  if (Date.now() - ptFailAt < 60e3) return null; // a roster failed to load: try again in a minute
  ptBusy = (async () => {
    const teams = [];
    games.forEach(g => [g.home, g.away].forEach(t => { if (t && t.id && !teams.some(x => x.id === t.id)) teams.push(t); }));
    let failed = false;
    const near = new Map(); // name -> teams with a near match (a typo), used when no roster has it exactly
    for (let i = 0; i < teams.length && need.size; i += 4) {
      const got = await Promise.all(teams.slice(i, i + 4).map(t => rosterOf(t).then(n => [t, n], () => { failed = true; return [t, null]; })));
      got.forEach(([t, list]) => (list || []).forEach(k => need.forEach(n => {
        if (sameMan(k, n)) { PT[n] = [t.abbr, Date.now()]; need.delete(n); }
        else if (nearMan(k, n)) { if (!near.has(n)) near.set(n, new Set()); near.get(n).add(t.abbr); }
      })));
    }
    need.forEach(n => { const ts = near.get(n); if (ts && ts.size === 1) { PT[n] = [[...ts][0], Date.now()]; need.delete(n); } });
    // Not on any roster: remembered as a miss (retried in 6 h) only when every roster loaded; else retried soon.
    const found = names.some(n => PT[n] && PT[n][0]);
    if (failed) ptFailAt = Date.now();
    else need.forEach(n => { PT[n] = [null, Date.now()]; });
    try { localStorage.setItem(PT_LS, JSON.stringify(PT)); } catch (_) {}
    return found;
  })().finally(() => { ptBusy = null; });
  return ptBusy;
}

// Spreads typed without a number ("Tampa Bay spread") use ESPN's line, kept from before kickoff (ESPN can drop it).
const LINE_LS = 'gg-line-';
function lineFor(g) {
  if (g.line && (g.line.pts || g.line.fav === null)) { try { localStorage.setItem(LINE_LS + g.id, JSON.stringify(g.line)); } catch (_) {} return g.line; }
  try { return JSON.parse(localStorage.getItem(LINE_LS + g.id) || 'null'); } catch (_) { return null; }
}

/** Looks up the teams of the players in these legs' texts who have no box score yet in T (so a prop before kickoff
 *  can show its game). A Promise of true once a team was found (false: none), or null when there is nothing to look up. */
export function lookupPlayers(bets, T) {
  if (!T || !Array.isArray(T.games) || !T.games.length) return null;
  const teams = teamsOf(T.games), want = [];
  (bets || []).forEach(t => {
    const b = parseLeg(t, teams);
    if (b && b.kind === 'prop' && !ptFresh(PT[b.player]) && !findIn(T, b.player).length) want.push(b.player);
  });
  return want.length ? findTeams(want, T.games) : null;
}

/** Follows an NFL week for the Lay: fn({games, boxes: Map(gameId -> box), at}) on every scoreboard update, once the
 *  box scores of the started games are in, and every 30 s on its own while a game is live (or just final): the
 *  scoreboard only speaks when a score or the clock changes, and the box score can move without either (a timeout,
 *  a review, stats ESPN fills in late). Paused while the page is hidden; refreshed at once when it is shown again. */
export function track(year, wk, fn) {
  let dead = false, seq = 0, games = null, timer = 0;
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const busyGames = () => (games || []).filter(g => g.state === 'in' || (g.state === 'post' && !boxDone(g.id)));
  const pull = force => {
    if (dead || !games) return;
    const my = ++seq, gs = games;
    const go = gs.filter(g => g.state === 'in' || g.state === 'post');
    Promise.all(go.map(g => getBox(g, force).then(b => [g.id, b]))).then(list => {
      if (dead || my !== seq) return;
      fn({games: gs, boxes: new Map(list.filter(x => x[1])), at: Date.now()});
      arm();
    });
  };
  const arm = () => {
    clearTimeout(timer); timer = 0;
    if (dead || hidden() || !busyGames().length) return;
    timer = setTimeout(() => pull(true), LIVE_TTL);
  };
  const stop = nfl.watch(year, wk, d => {
    if (dead || !d || !Array.isArray(d.games)) return;
    games = d.games;
    games.forEach(lineFor);
    pull(false);
  });
  const onVis = () => { if (hidden()) { clearTimeout(timer); timer = 0; } else if (busyGames().length) pull(true); };
  try { document.addEventListener('visibilitychange', onVis); } catch (_) {}
  return () => { dead = true; clearTimeout(timer); stop(); try { document.removeEventListener('visibilitychange', onVis); } catch (_) {} };
}

// ---------------------------------------------------------------------------------------------- Scoring
function findIn(T, player) {
  const all = [];
  T.boxes.forEach((box, id) => box.players.forEach(p => all.push({p, g: T.games.find(x => x.id === id)})));
  const hit = all.filter(x => unhyph(x.p.key) === unhyph(player));
  if (hit.length) return hit;
  const same = all.filter(x => sameMan(x.p.key, player));
  if (same.length) return same;
  const near = all.filter(x => nearMan(x.p.key, player));
  return near.length === 1 ? near : [];
}
const OPS = {gte: (v, n) => v >= n, gt: (v, n) => v > n, lt: (v, n) => v < n};
const lineTxt = b => b.n == null ? (b.op === 'lt' ? 'under' : 'over') : b.op === 'gte' ? `${b.n}+` : (b.op === 'gt' ? 'o' : 'u') + b.n;
const STAT_TXT = {td: 'TD', passTd: 'pass TD', rec: 'rec', recYds: 'rec yds', rushYds: 'rush yds', passYds: 'pass yds', yds: 'yds'};
const clockOf = g => g.state === 'post' ? 'Final' : /half/i.test(g.detail) ? 'Half' : g.period ? `Q${g.period > 4 ? 'OT' : g.period} ${g.clock}`.trim() : 'Live';
const kickTxt = g => g.kickoff.toLocaleString('en-US', {weekday: 'short', hour: 'numeric', minute: '2-digit'});
function statOf(p, stat) {
  const s = p.s;
  if (stat === 'td') return (s.rushTd || 0) + (s.recTd || 0);
  if (stat === 'yds') return (s.passAtt || 0) >= 5 ? (s.passYds || 0) : (s.rushYds || 0) + (s.recYds || 0);
  return s[stat] || 0;
}
// Whether an over / under on a live number is already decided, else still going.
function settle(b, v, over) {
  const ok = OPS[b.op](v, b.n);
  if (over) return ok ? 'hit' : 'miss';
  if (b.op === 'lt') return ok ? 'live' : 'miss';
  return ok ? 'hit' : 'live';
}

/** Scores a leg's text against a tracked week. */
/** A leg the way a sportsbook slip shows it: {pick (bold: "Over 5.5", "100+", "Chicago Bears"), market ("Parker
 *  Washington Receptions", "Moneyline", "Total")}, or null when it can't be read. */
export function slipParts(text, games) {
  const b = parseLeg(text, teamsOf(games));
  if (!b) return null;
  const ou = b.op === 'lt' ? 'Under' : 'Over';
  if (b.kind === 'prop') {
    if (b.stat === 'td') return b.op === 'gte' && b.n === 1 ? {pick: b.raw, market: 'Anytime TD Scorer'} : {pick: lineWords(b), market: `${b.raw} Anytime TDs`};
    return {pick: lineWords(b), market: `${b.raw} ${STAT_WORDS[b.stat]}`};
  }
  if (b.kind === 'gameTotal') return {pick: `${ou} ${b.n}`, market: 'Total'};
  if (b.kind === 'teamTotal') return {pick: `${ou} ${b.n}`, market: `${teamWords(b.team)}: Team Total Points`};
  if (b.kind === 'ml') return {pick: teamWords(b.team), market: 'Moneyline'};
  const d = describe(text, games) || '';
  return {pick: d.replace(/ Spread$/, ''), market: 'Spread'};
}
export function evaluate(text, T) {
  if (!T || !Array.isArray(T.games) || !T.games.length) return {st: 'na', note: ''};
  const teams = teamsOf(T.games), b = parseLeg(text, teams);
  if (!b) return {st: 'na', note: "Can't track this one"};
  const gameOf = abbr => T.games.find(g => g.home.abbr === abbr || g.away.abbr === abbr);
  if (b.kind !== 'prop') {
    const g = gameOf(b.kind === 'gameTotal' ? b.teams[0] : b.team);
    if (!g || (b.kind === 'gameTotal' && g.home.abbr !== b.teams[1] && g.away.abbr !== b.teams[1])) return {st: 'na', note: 'No such game this week'};
    if (g.state === 'pre') return {st: 'pre', note: kickTxt(g), game: g};
    const over = g.state === 'post';
    if (over && !g.final) return {st: 'na', note: g.detail || 'No result'};
    const me = b.team && (g.home.abbr === b.team ? g.home : g.away), opp = b.team && (me === g.home ? g.away : g.home);
    const sc = `${g.away.abbr} ${g.away.score || 0}–${g.home.score || 0} ${g.home.abbr}`;
    if (b.kind === 'gameTotal') {
      const v = (g.home.score || 0) + (g.away.score || 0);
      return {st: settle(b, v, over), note: `${v} total pts · needs ${lineTxt(b)} · ${clockOf(g)}`, v, n: b.n, op: b.op, game: g};
    }
    if (b.kind === 'teamTotal') return {st: settle(b, me.score || 0, over), note: `${me.abbr} has ${me.score || 0} · needs ${lineTxt(b)} · ${clockOf(g)}`, v: me.score || 0, n: b.n, op: b.op, game: g};
    let pts = b.pts;
    if (b.kind === 'spread' && pts == null) {
      const l = lineFor(g);
      if (!l) return {st: 'na', note: 'No line from ESPN'};
      pts = !l.fav ? 0 : (l.fav === (me === g.home ? 'home' : 'away') ? -l.pts : l.pts);
    }
    const m = (me.score || 0) - (opp.score || 0) + (b.kind === 'spread' ? pts : 0);
    const st = !over ? 'live' : m > 0 ? 'hit' : m < 0 ? 'miss' : 'na';
    const tag = b.kind === 'spread' ? `${me.abbr} ${pts > 0 ? '+' : pts < 0 ? '−' : ''}${pts ? Math.abs(pts) : 'PK'} · ` : '';
    return {st, note: `${tag}${sc} · ${clockOf(g)}${over && st === 'na' ? ' · push' : ''}`, game: g, margin: m};
  }
  // A player: find him in the started games' box scores (full name, else first initial + last name).
  const hit = findIn(T, b.player);
  const lineT = `${lineTxt(b)} ${STAT_TXT[b.stat]}`;
  if (!hit.length) {
    // Not in a box score yet: his game from the rosters (kickoff before it starts; 0 so far once it has).
    // his team: the roster lookup, else the current player list (fills in until the lookup answers)
    const e = PT[b.player], known = byName(b.player), team = e && e[0] ? e[0] : known ? known.team : null;
    const g = team ? gameOf(team) : null;
    if (g && g.state === 'pre') return {st: 'pre', note: kickTxt(g), game: g};
    if (g && g.state === 'in') {
      const u = STAT_TXT[b.stat];
      return b.n == null ? {st: 'live', note: `0 ${u} · ${b.op === 'lt' ? 'under' : 'over'}, no line given · ${clockOf(g)}`, v: 0, game: g, unit: u}
        : {st: settle(b, 0, false), note: `0 ${u} · needs ${lineTxt(b)} · ${clockOf(g)}`, v: 0, n: b.n, op: b.op, game: g, unit: u};
    }
    const started = T.games.filter(g => g.state !== 'pre');
    if (started.length === T.games.length && T.games.every(g => g.state === 'post')) return {st: 'na', note: `Not in a box score · ${lineT}`};
    return {st: 'pre', note: 'Not started'};
  }
  const {p, g} = hit[0], v = statOf(p, b.stat);
  const over = !!g && g.state === 'post';
  if (b.n == null) {
    const u = STAT_TXT[b.stat], side = b.op === 'lt' ? 'under' : 'over';
    return over ? {st: 'na', note: `Final: ${v} ${u} · ${side} with no line, settled by the league`, v, game: g, unit: u}
      : {st: 'live', note: `${v} ${u} · ${side}, no line given · ${clockOf(g)}`, v, game: g, unit: u};
  }
  return {st: settle(b, v, over), note: `${v} ${STAT_TXT[b.stat]} · needs ${lineTxt(b)} · ${clockOf(g)}`, v, n: b.n, op: b.op, game: g, unit: STAT_TXT[b.stat]};
}

// ---------------------------------------------------------------------------------------------- Wording
const STAT_WORDS = {passTd: 'Passing TDs', rec: 'Receptions', recYds: 'Receiving Yards', rushYds: 'Rushing Yards', passYds: 'Passing Yards', yds: 'Yards'};
const lineWords = b => b.op === 'gte' ? `${b.n}+` : `${b.op === 'gt' ? 'Over' : 'Under'}${b.n == null ? '' : ' ' + b.n}`;
const teamWords = abbr => NFL_TEAMS[abbr] || abbr;
const signed = n => (n > 0 ? '+' : n < 0 ? '-' : '+') + Math.abs(n);
/** A leg in standard sportsbook wording, or null when it can't be read. games: the week's games (for game order and
 *  ESPN's spread when the leg says just "spread"); optional. */
export function describe(text, games) {
  const b = parseLeg(text, teamsOf(games));
  if (!b) return null;
  const G = games || [];
  if (b.kind === 'prop') {
    if (b.stat === 'td') return `${b.raw} ${b.op === 'gte' && b.n === 1 ? 'Anytime TD Scorer' : lineWords(b) + ' Anytime TDs'}`;
    return `${b.raw} ${lineWords(b)} ${STAT_WORDS[b.stat]}`;
  }
  if (b.kind === 'gameTotal') {
    const g = G.find(x => [x.home.abbr, x.away.abbr].includes(b.teams[0]) && [x.home.abbr, x.away.abbr].includes(b.teams[1]));
    const [a, h] = g ? [g.away.abbr, g.home.abbr] : b.teams;
    return `${teamWords(a)} @ ${teamWords(h)} ${b.op === 'lt' ? 'Under' : 'Over'} ${b.n}`;
  }
  if (b.kind === 'teamTotal') return `${teamWords(b.team)} Team Total ${b.op === 'lt' ? 'Under' : 'Over'} ${b.n}`;
  if (b.kind === 'ml') return `${teamWords(b.team)} Moneyline`;
  let pts = b.pts;
  if (pts == null) {
    const g = G.find(x => x.home.abbr === b.team || x.away.abbr === b.team), l = g && lineFor(g);
    if (l) pts = !l.fav ? 0 : l.fav === (g.home.abbr === b.team ? 'home' : 'away') ? -l.pts : l.pts;
  }
  return pts == null ? `${teamWords(b.team)} Spread` : `${teamWords(b.team)} ${signed(pts)}`;
}

// ---------------------------------------------------------------------------------------------- Autofill
// Bet ideas per position (the tracker reads every one of them); a number typed after the name replaces the default.
const IDEAS = {
  QB: [['passYds', 250], ['passTd', 2], ['rushYds', 25], ['td', 1]],
  RB: [['td', 1], ['rushYds', 60], ['rushYds', 80], ['rec', 3], ['recYds', 25], ['td', 2]],
  WR: [['td', 1], ['recYds', 50], ['recYds', 75], ['recYds', 100], ['rec', 4], ['rec', 6]],
  TE: [['td', 1], ['recYds', 40], ['recYds', 60], ['rec', 3], ['rec', 5]]
};
const SYN = {yds: 'yards', yd: 'yards', yard: 'yards', tds: 'td', touchdown: 'td', touchdowns: 'td', atd: 'anytime', rush: 'rushing', pass: 'passing',
  rec: 'rec', recs: 'receptions', catches: 'receptions', ml: 'moneyline', money: 'moneyline', o: 'over', u: 'under', tt: 'team'};
const propText = (name, stat, n, op = 'gte') => {
  if (stat === 'td') return n === 1 && op === 'gte' ? `${name} Anytime TD Scorer` : `${name} ${op === 'gte' ? n + '+' : (op === 'gt' ? 'Over ' : 'Under ') + n} Anytime TDs`;
  return `${name} ${op === 'gte' ? n + '+' : (op === 'gt' ? 'Over ' : 'Under ') + n} ${STAT_WORDS[stat]}`;
};
// Every typed word (after the name) must start a word of the suggestion (synonyms allowed: "yds" for yards, ...).
function fits(sug, rest) {
  const have = nk(sug).split(' ');
  return rest.every(w => /^\d/.test(w) || have.some(h => h.startsWith(w) || h.startsWith(SYN[w] || '\u0000') || (w === 'rec' && /^rec/.test(h))));
}
const posName = {QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', K: 'K'};
// Numbers that make sense for each bet (so "CMC 80" offers 80+ rushing yards, not 80+ touchdowns).
const OK_N = {td: [1, 4], passTd: [1, 6], rec: [1, 15], recYds: [10, 250], rushYds: [10, 250], passYds: [100, 500]};
const okN = (st, n) => !OK_N[st] || (n >= OK_N[st][0] && n <= OK_N[st][1]);
/** Autofill for the leg box: up to `max` suggestions [{text (what the box becomes), label, sub, kind: 'player' |
 *  'team' | 'bet'}]. While a name is being typed: matching current players (best known first) and teams; once it
 *  names a player or a team: bets for it, shaped by whatever was typed after the name (a number, "rec", "over", ...). */
export function suggest(text, games, max = 6) {
  const raw = String(text || '');
  const q = nk(raw);
  if (!q) return [];
  const G = games || [];
  const out = [], seen = new Set();
  const push = (t, sub, kind = 'bet') => { const k = nk(t); if (!seen.has(k) && out.length < max) { seen.add(k); out.push({text: t, label: t.trim(), sub: sub || '', kind}); } };
  const gameOf = abbr => G.find(g => g.home.abbr === abbr || g.away.abbr === abbr);
  const when = g => g ? `${g.away.abbr} @ ${g.home.abbr} · ${g.state === 'pre' ? kickTxt(g) : clockOf(g)}` : '';
  // 1. A player named in front (nicknames and near misses read as the real name)
  const ex = expandLeg(raw);
  const en = nk(ex);
  let player = PL && PL.list.filter(p => en === p.k || en.startsWith(p.k + ' ')).sort((a, b) => b.k.length - a.k.length)[0];
  // A single word still being typed ("chris") isn't a player yet, unless it is a nickname ("CMC") or a full name.
  if (player && !/\s$/.test(raw) && q.split(' ').length === 1 && q !== player.k && !nickOf(q)) player = null;
  if (player && IDEAS[player.pos]) {
    const restW = en.slice(player.k.length).trim().split(' ').filter(Boolean).map(w => w.replace(/\+$/, ''));
    const num = (en.slice(player.k.length).match(/(\d+(?:\.\d+)?)/) || [])[1];
    const op = /\bunder\b|\bu\d/.test(en) ? 'lt' : /\bover\b|\bo\d/.test(en) ? 'gt' : 'gte';
    const sub = `${posName[player.pos]} · ${player.team}${gameOf(player.team) ? ' · ' + when(gameOf(player.team)) : ''}`;
    const ideas = IDEAS[player.pos];
    const stats = [...new Set(ideas.map(i => i[0]))];
    if (num != null) stats.forEach(st => { const t = propText(player.name, st, +num, op); if (okN(st, +num) && fits(t, restW)) push(t, sub); });
    // "Kelce over": the over (or under) with no number yet, the way the league often enters it ("Over Rec")
    else if (op !== 'gte') stats.filter(st => st !== 'td').forEach(st => { const t = `${player.name} ${op === 'gt' ? 'Over' : 'Under'} ${STAT_WORDS[st]}`; if (fits(t, restW)) push(t, sub); });
    else ideas.forEach(([st, n]) => { const t = propText(player.name, st, n); if (fits(t, restW)) push(t, sub); });
    return out;
  }
  // 2. A team named in front: moneyline, ESPN's spread, the game total, a team total
  const T = teamsOf(G.length ? G : null);
  const lead = T.map(t => ({t, w: t.words.filter(w => w && (q === w || q.startsWith(w + ' '))).sort((a, b) => b.length - a.length)[0]})).filter(x => x.w)
    .sort((a, b) => b.w.length - a.w.length)[0];
  if (lead && !(PL && PL.list.some(p => q.startsWith(p.k)))) {
    const abbr = lead.t.abbr, name = teamWords(abbr), g = gameOf(abbr);
    const restW = q.slice(lead.w.length).trim().split(' ').filter(Boolean);
    const num = (q.slice(lead.w.length).match(/(\d+(?:\.\d+)?)/) || [])[1];
    const sub = g ? when(g) : 'No game found this week';
    const l = g && lineFor(g);
    const base = [`${name} Moneyline`];
    if (l && l.fav !== undefined) { const pts = !l.fav ? 0 : l.fav === (g.home.abbr === abbr ? 'home' : 'away') ? -l.pts : l.pts; base.push(`${name} ${signed(pts)}`); }
    const n = num != null ? +num : null;
    const spread = n != null && n <= 25 ? [`${name} -${num}`, `${name} +${num}`] : [];
    const tt = n != null && n >= 7 && n <= 40 ? [`${name} Team Total Over ${num}`, `${name} Team Total Under ${num}`] : [];
    const ou = !g ? null : n != null ? (n >= 25 && n <= 75 ? num : null) : g.line && g.line.ou;
    const m = g && `${teamWords(g.away.abbr)} @ ${teamWords(g.home.abbr)}`, gt = ou != null ? [`${m} Over ${ou}`, `${m} Under ${ou}`] : [];
    // A typed number leads with the bets it fits: a small one is a spread, a bigger one a team or game total.
    const cands = n == null ? [...base, ...gt, `${name} Team Total Over `] : n < 10 ? [...spread, ...tt, ...gt, ...base] : [...tt, ...gt, ...spread, ...base];
    cands.forEach(t => { if (fits(t, restW.filter(w => !/^[+-]?\d/.test(w)))) push(t, sub); });
    return out;
  }
  // 3. Still typing a name: players whose name words start with every typed word (best known first), then teams
  const toks = q.split(' ');
  // (a nickname typed in full leads; one only begun ranks with the rest)
  const exact = nickOf(q);
  const nick = Object.keys(NICK).filter(k => k.startsWith(q) || k.replace(/ /g, '').startsWith(q.replace(/ /g, ''))).map(k => byName(NICK[k])).filter(Boolean);
  const hits = PL ? PL.list.filter(p => toks.every(t => p.words.some(w => w.startsWith(t)))) : [];
  [...(exact && exact.pos ? [exact] : []), ...[...new Set([...nick, ...hits])].sort((a, b) => b.score - a.score)].forEach(p => push(p.name + ' ', `${posName[p.pos] || p.pos} · ${p.team}${gameOf(p.team) ? ' · ' + when(gameOf(p.team)) : ''}`, 'player'));
  T.filter(t => t.words.some(w => w && toks.every(x => w.split(' ').some(y => y.startsWith(x))))).forEach(t => push(teamWords(t.abbr) + ' ', gameOf(t.abbr) ? when(gameOf(t.abbr)) : 'Team', 'team'));
  return out;
}

/** True for an over / under typed without its number ("Over Rec"): tracked, but settled by hand. */
export const needsLine = text => { const b = parseLeg(text, teamsOf(null)); return !!b && b.kind === 'prop' && b.n == null; };

export const __test = {teamsOf, norm};
/** A game's time for a slip header: its kickoff ("Sun 1:25 PM") before it starts, else the clock ("Q3 4:12", "Half", "Final"). */
export const gameClock = g => g.state === 'pre' ? kickTxt(g) : clockOf(g);
