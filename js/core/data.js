// League data: loading, derivations moved unchanged from the old single-file app,
// plus the shared derivations the views use (colors, holders, finishes, "me").
// Owner: foundation (core). No DOM rendering here.

// ---------------------------------------------------------------------------
// Live bindings. load() assigns them; importers always see the current value.
export let DATA = null;
export let M = {};
export let GAMES = [];
export let SEASONS = [];
export let DONE = [];
export let AT = [];
export let FACTS = [];
export let ids = [];
export let span = {first: null, last: null, seasons: 0, managers: 0};
export let lastLoad = 0;

const LEAGUE_URL = new URL('../../data/league.json', import.meta.url).href;

// ---------------------------------------------------------------------------
// Formatting helpers (identical to the old app)
export const name = id => (M[id] ? M[id].name : (id || '—'));
export const team = id => (M[id] ? M[id].team : '');
export const fmt = n => Number(n).toFixed(2);
export const pct = x => x.toFixed(3).replace(/^0/, '');
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const recStr = (w, l, t) => t ? `${w}–${l}–${t}` : `${w}–${l}`;
export const nf = n => Number(n).toLocaleString('en-US');
export const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
export const ROUND = {reg:'', quarter:'Quarterfinal', semi:'Semifinal', final:'Championship', third:'Third-place game', consol:'Consolation'};
export const BRACKET = ['quarter', 'semi', 'final', 'third'];

// Team names change every year, so show the one a manager used that season.
export const teamIn = (s, id) => (s && s.teams[id]) || team(id);

// ---------------------------------------------------------------------------
// Events
const subs = new Set();
export function subscribe(fn) {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
function emit(type, detail) {
  [...subs].forEach(fn => { try { fn(type, detail); } catch (e) { console.error(e); } });
}

// ---------------------------------------------------------------------------
// Derivation (moved unchanged)
function deriveGames() {
  const G = [];
  DATA.seasons.forEach(s => (s.matchups || []).forEach(g => G.push(Object.assign({}, g, {year: s.year}))));
  G.sort((x, y) => x.year - y.year || x.week - y.week);
  G.forEach(g => {
    g.tie = g.sa === g.sb;
    g.win = g.sa > g.sb ? g.a : g.b;
    g.lose = g.sa > g.sb ? g.b : g.a;
    g.ws = Math.max(g.sa, g.sb);
    g.ls = Math.min(g.sa, g.sb);
    g.margin = g.ws - g.ls;
    g.reg = !g.type || g.type === 'reg';
    g.playoff = BRACKET.includes(g.type);
  });
  return G;
}

function deriveSeasons() {
  return DATA.seasons.map(s => {
    const games = GAMES.filter(g => g.year === s.year);
    const rows = {};
    const row = id => rows[id] || (rows[id] = {id, w:0, l:0, t:0, pf:0, pa:0});
    games.filter(g => g.reg).forEach(g => {
      const A = row(g.a), B = row(g.b);
      A.pf += g.sa; A.pa += g.sb; B.pf += g.sb; B.pa += g.sa;
      if (g.tie) { A.t++; B.t++; }
      else if (g.win === g.a) { A.w++; B.l++; }
      else { B.w++; A.l++; }
    });
    const table = Object.values(rows).sort((x, y) => (y.w + y.t/2) - (x.w + x.t/2) || y.pf - x.pf);
    table.forEach((r, i) => r.seed = i + 1);
    const fin = games.find(g => g.type === 'final');
    const third = games.find(g => g.type === 'third');
    const live = !!s.inProgress;
    return {
      year: s.year, games, table, live, teams: s.teams || {},
      champion: s.champion || (fin ? fin.win : null),
      runnerUp: s.runnerUp || (fin ? fin.lose : null),
      thirdPlace: s.thirdPlace || (third ? third.win : null),
      lastPlace: s.lastPlace || (!live && table.length ? table[table.length - 1].id : null),
      playoffTeams: new Set(games.filter(g => g.playoff).flatMap(g => [g.a, g.b]))
    };
  }).sort((a, b) => b.year - a.year);
}

export function allTime() {
  const r = {};
  DATA.managers.forEach(m => r[m.id] = {id:m.id, w:0, l:0, t:0, pf:0, pa:0, gp:0, po:0, pw:0, pl:0, titles:0, seconds:0, lasts:0, seasons:0});
  SEASONS.forEach(s => {
    s.table.forEach(t => { const x = r[t.id]; if (!x) return; x.w += t.w; x.l += t.l; x.t += t.t; x.pf += t.pf; x.pa += t.pa; x.gp += t.w + t.l + t.t; x.seasons++; });
    s.playoffTeams.forEach(id => r[id] && r[id].po++);
    s.games.filter(g => g.playoff && !g.tie).forEach(g => { r[g.win] && r[g.win].pw++; r[g.lose] && r[g.lose].pl++; });
    if (r[s.champion]) r[s.champion].titles++;
    if (r[s.runnerUp]) r[s.runnerUp].seconds++;
    if (r[s.lastPlace]) r[s.lastPlace].lasts++;
  });
  return Object.values(r).map(x => Object.assign(x, {pct: x.gp ? (x.w + x.t/2) / x.gp : 0, ppg: x.gp ? x.pf / x.gp : 0}));
}

export function h2h(a, b) {
  const games = GAMES.filter(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)).map(g => {
    const my = g.a === a ? g.sa : g.sb, their = g.a === a ? g.sb : g.sa;
    return Object.assign({}, g, {my, their});
  });
  const o = {games, aw:0, bw:0, t:0, ap:0, bp:0, apw:0, bpw:0, aBig:null, bBig:null};
  games.forEach(g => {
    o.ap += g.my; o.bp += g.their;
    if (g.my > g.their) { o.aw++; if (g.playoff) o.apw++; if (!o.aBig || g.my - g.their > o.aBig.m) o.aBig = {m: g.my - g.their, g}; }
    else if (g.their > g.my) { o.bw++; if (g.playoff) o.bpw++; if (!o.bBig || g.their - g.my > o.bBig.m) o.bBig = {m: g.their - g.my, g}; }
    else o.t++;
  });
  let streak = 0, who = null;
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i]; const w = g.my > g.their ? a : g.their > g.my ? b : null;
    if (!w) break;
    if (!who) who = w;
    if (w !== who) break;
    streak++;
  }
  o.streak = {who, n: streak};
  return o;
}

// Memoized h2h, keyed "a|b". Treat the result as read-only. Cleared on reload.
const h2hCache = new Map();
export function h2hC(a, b) {
  const k = a + '|' + b;
  let r = h2hCache.get(k);
  if (!r) { r = h2h(a, b); h2hCache.set(k, r); }
  return r;
}

export function defaultOpponent(a) {
  const others = DATA.managers.map(m => m.id).filter(id => id !== a);
  let best = others[0], bestScore = -1;
  others.forEach(id => {
    const r = h2hC(a, id); const score = r.games.length * 100 - Math.abs(r.aw - r.bw);
    if (score > bestScore) { bestScore = score; best = id; }
  });
  return best;
}

export function computeFacts() {
  const reg = GAMES.filter(g => g.reg);
  const F = [];
  const scores = GAMES.flatMap(g => [{id:g.a, s:g.sa, opp:g.b, g}, {id:g.b, s:g.sb, opp:g.a, g}]);
  const when = g => `${g.year}, week ${g.week}`;
  if (!scores.length) return F;
  const hi = scores.reduce((m, x) => x.s > m.s ? x : m);
  const lo = scores.reduce((m, x) => x.s < m.s ? x : m);
  F.push({label:'Highest score in a week', val:fmt(hi.s), detail:`${name(hi.id)} vs ${name(hi.opp)}, ${when(hi.g)}`});
  F.push({label:'Lowest score in a week', val:fmt(lo.s), detail:`${name(lo.id)} vs ${name(lo.opp)}, ${when(lo.g)}`});
  const decided = GAMES.filter(g => !g.tie);
  if (decided.length) {
    const blow = decided.reduce((m, g) => g.margin > m.margin ? g : m);
    const close = decided.reduce((m, g) => g.margin < m.margin ? g : m);
    F.push({label:'Biggest blowout', val:fmt(blow.margin), unit:'points', detail:`${name(blow.win)} beat ${name(blow.lose)} ${fmt(blow.ws)} to ${fmt(blow.ls)}, ${when(blow)}`});
    F.push({label:'Closest game', val:fmt(close.margin), unit:'points', detail:`${name(close.win)} edged ${name(close.lose)} ${fmt(close.ws)} to ${fmt(close.ls)}, ${when(close)}`});
    const bl = decided.reduce((m, g) => g.ls > m.ls ? g : m);
    const fw = decided.reduce((m, g) => g.ws < m.ws ? g : m);
    F.push({label:'Most points in a loss', val:fmt(bl.ls), detail:`${name(bl.lose)} lost to ${name(bl.win)}, ${when(bl)}`});
    F.push({label:'Fewest points in a win', val:fmt(fw.ws), detail:`${name(fw.win)} still beat ${name(fw.lose)}, ${when(fw)}`});
  }

  let bw = {n:0}, blst = {n:0};
  DATA.managers.forEach(m => {
    let w = 0, l = 0, ws = null, ls = null;
    reg.filter(g => g.a === m.id || g.b === m.id).forEach(g => {
      if (g.tie) { w = 0; l = 0; return; }
      if (g.win === m.id) { if (!w) ws = g; w++; l = 0; if (w > bw.n) bw = {n:w, id:m.id, from:ws, to:g}; }
      else { if (!l) ls = g; l++; w = 0; if (l > blst.n) blst = {n:l, id:m.id, from:ls, to:g}; }
    });
  });
  const spanTxt = s => s.from.year === s.to.year ? `${s.from.year}, weeks ${s.from.week} to ${s.to.week}` : `${when(s.from)} to ${when(s.to)}`;
  if (bw.n) F.push({label:'Longest winning streak', val:bw.n, unit:'games', detail:`${name(bw.id)}, ${spanTxt(bw)}`});
  if (blst.n) F.push({label:'Longest losing streak', val:blst.n, unit:'games', detail:`${name(blst.id)}, ${spanTxt(blst)}`});

  // Completed seasons only; a first-year league (just the in-progress season) has none yet.
  const seasonRows = DONE.flatMap(s => s.table.map(r => Object.assign({year:s.year, s}, r)));
  if (seasonRows.length) {
    const best = seasonRows.reduce((m, r) => ((r.w + r.t/2) - (m.w + m.t/2) || r.pf - m.pf) > 0 ? r : m);
    const mostPf = seasonRows.reduce((m, r) => r.pf > m.pf ? r : m);
    const unlucky = seasonRows.reduce((m, r) => r.pa > m.pa ? r : m);
    const bestFinish = best.id === best.s.champion ? 'and won the title' : `but ${best.id === best.s.runnerUp ? 'lost in the championship' : 'didn\u2019t win the title'}`;
    F.push({label:'Best regular season', val:recStr(best.w, best.l, best.t), detail:`${name(best.id)} in ${best.year}, ${bestFinish}`});
    F.push({label:'Most points in a season', val:fmt(mostPf.pf), detail:`${name(mostPf.id)} in ${mostPf.year}`});
    F.push({label:'Toughest schedule', val:fmt(unlucky.pa), unit:'points against', detail:`${name(unlucky.id)} in ${unlucky.year}, went ${recStr(unlucky.w, unlucky.l, unlucky.t)}`});
  }

  const top = (k) => AT.slice().sort((x, y) => y[k] - x[k])[0];
  const ru = top('seconds'); if (ru && ru.seconds > 1) F.push({label:'Most runner-up finishes', val:ru.seconds, detail:name(ru.id)});
  const lp = top('lasts'); if (lp && lp.lasts > 0) F.push({label:'Most last-place finishes', val:lp.lasts, detail:name(lp.id)});

  const tc = {}; (DATA.trades || []).forEach(t => t.sides.forEach(s => tc[s.manager] = (tc[s.manager] || 0) + 1));
  const tt = Object.entries(tc).sort((a, b) => b[1] - a[1])[0];
  if (tt) F.push({label:'Most trades made', val:tt[1], detail:name(tt[0])});

  const latestYear = SEASONS.length ? SEASONS[0].year : 0;
  const droughts = AT.filter(x => x.seasons).map(x => {
    const won = SEASONS.filter(s => s.champion === x.id).map(s => s.year);
    return won.length ? {id:x.id, n: latestYear - Math.max(...won), last: Math.max(...won)} : {id:x.id, n: x.seasons, never:true};
  }).sort((a, b) => b.n - a.n || (b.never ? 1 : 0) - (a.never ? 1 : 0));
  if (droughts[0]) {
    const d = droughts[0];
    F.push({label:'Longest title drought', val:d.n, unit:'seasons', detail: d.never ? `${name(d.id)} hasn't won one yet` : `${name(d.id)}, last title in ${d.last}`});
  }
  return F;
}

// ---------------------------------------------------------------------------
// Loading
let sig = ''; // the last league.json text we derived from (reload compares it exactly; ~130 KB)
let loadP = null;

function derive(json) {
  DATA = json;
  DATA.managers.sort((x, y) => x.name.localeCompare(y.name));
  M = Object.assign(Object.create(null), Object.fromEntries(DATA.managers.map(m => [m.id, m]))); // null prototype: route ids like "constructor" are not managers
  ids = DATA.managers.map(m => m.id);
  h2hCache.clear();
  flatCache = null;
  GAMES = deriveGames();
  SEASONS = deriveSeasons();
  DONE = SEASONS.filter(s => s.champion);
  AT = allTime();
  try { FACTS = computeFacts(); } catch (e) { console.error(e); FACTS = []; }
  const ys = SEASONS.map(s => s.year);
  span = {
    first: ys.length ? Math.min(...ys) : null,
    last: ys.length ? Math.max(...ys) : null,
    seasons: SEASONS.length,
    managers: DATA.managers.length
  };
}

function current() {
  const s = SEASONS.find(x => x.live) || SEASONS[0] || null;
  return {throughWeek: s ? throughWeek(s) : 0, year: s ? s.year : null};
}

async function fetchLeague(opts) {
  const res = await fetch(LEAGUE_URL, opts);
  if (!res.ok) throw new Error('league.json HTTP ' + res.status);
  const text = await res.text();
  const json = JSON.parse(text);
  return {text, json};
}

// Fetches data/league.json and derives everything. Idempotent: once loaded it resolves
// immediately; after a failure the next call fetches again (for a Retry button).
export function load() {
  if (loadP) return loadP;
  loadP = fetchLeague().then(r => {
    derive(r.json);
    sig = r.text;
    lastLoad = Date.now();
    return DATA;
  }).catch(e => { loadP = null; throw e; });
  return loadP;
}

// Refetches with cache:'no-cache'. Any change to the file text (a score correction, a records line,
// a trade, a new week) re-derives and emits 'data'. Resolves {changed, newWeek, throughWeek, year}:
// `newWeek` is true only when the current season gained a week (or a new season started), so
// "Week {n} is in." is shown only then; other edits are applied quietly.
export async function reload() {
  const r = await fetchLeague({cache: 'no-cache'});
  lastLoad = Date.now();
  const prev = DATA ? current() : {throughWeek: 0, year: null};
  const changed = !DATA || r.text !== sig;
  if (changed) {
    derive(r.json);
    sig = r.text;
    loadP = Promise.resolve(DATA);
  }
  const cur = current();
  const newWeek = changed && (cur.year !== prev.year ? cur.throughWeek > 0 : cur.throughWeek > prev.throughWeek);
  const out = Object.assign({changed, newWeek}, cur);
  if (changed) emit('data', out);
  return out;
}

// ---------------------------------------------------------------------------
// Seasons
export function seasonByYear(y) {
  const n = Number(y);
  return SEASONS.find(s => s.year === n) || null;
}
const asSeason = s => (s && typeof s === 'object') ? s : seasonByYear(s);

// Max regular-season week of a season (object or year).
export function throughWeek(season) {
  const s = asSeason(season);
  if (!s) return 0;
  return Math.max(0, ...s.games.filter(g => g.reg).map(g => g.week));
}

// Same logic and precedence as the old finish(): champion, runner-up, third, playoffs, worst record, missed.
export function finishOf(season, id) {
  const s = asSeason(season);
  if (!s) return 'missed';
  return id === s.champion ? 'champion'
    : id === s.runnerUp ? 'runnerUp'
    : id === s.thirdPlace ? 'third'
    : s.playoffTeams.has(id) ? 'playoffs'
    : id === s.lastPlace ? 'last' : 'missed';
}

// ---------------------------------------------------------------------------
// Manager colors (spec 4.2)
export const PALETTE = [
  {id:'ben',     mc:'#FF8A4C', deep:'#35231A', mono:'BE'},
  {id:'corbin',  mc:'#4C8DFF', deep:'#182337', mono:'CO'},
  {id:'dresden', mc:'#FFD84D', deep:'#352F1B', mono:'DR'},
  {id:'evan',    mc:'#9D7BFF', deep:'#252037', mono:'EV'},
  {id:'jackson', mc:'#FF6B9E', deep:'#351E28', mono:'JX'},
  {id:'jacob',   mc:'#2ED3BE', deep:'#132E2D', mono:'JB'},
  {id:'jaymin',  mc:'#D6B08A', deep:'#2E2924', mono:'JM'},
  {id:'jayton',  mc:'#3CC0F5', deep:'#152B36', mono:'JT'},
  {id:'john',    mc:'#EE6BDB', deep:'#321E31', mono:'JN'},
  {id:'mason',   mc:'#8C9EFF', deep:'#222637', mono:'MA'},
  {id:'mitch',   mc:'#C77DFF', deep:'#2C2137', mono:'MI'},
  {id:'sayer',   mc:'#9EB1C8', deep:'#25292E', mono:'SA'}
];
const PAL = Object.assign(Object.create(null), Object.fromEntries(PALETTE.map(p => [p.id, p])));
const colorCache = new Map();

export function color(id) {
  const key = id == null ? '' : String(id);
  const hit = colorCache.get(key);
  if (hit && (PAL[key] || hit.nm === name(id))) return hit.c;
  let c;
  if (PAL[key]) {
    const p = PAL[key];
    c = {mc: p.mc, deep: p.deep, cls: 'mc-' + key, mono: p.mono};
  } else {
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    const n = sum % 12, p = PALETTE[n];
    const letters = String(key ? name(id) : '').replace(/[^\p{L}\p{N}]/gu, '');
    c = {mc: p.mc, deep: p.deep, cls: 'mc-x' + n, mono: (letters.slice(0, 2) || '?').toUpperCase()};
  }
  colorCache.set(key, {c, nm: name(id)});
  return c;
}

function hue(hex) {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16 & 255) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
// True when the two managers' accent hues are within 35 degrees.
export function hueClose(a, b) {
  const d = Math.abs(hue(color(a).mc) - hue(color(b).mc)) % 360;
  return Math.min(d, 360 - d) <= 35;
}

// ---------------------------------------------------------------------------
// Record holders
const QN = s => String(s).replace(/[’‘`]/g, "'");

// Whitespace-free copy of s plus a map from its positions back to s.
function squeeze(s) {
  let out = '';
  const pos = [];
  for (let i = 0; i < s.length; i++) if (!/\s/.test(s[i])) { out += s[i]; pos.push(i); }
  return {out, pos};
}

function findIn(str, map, year, words) {
  const S = QN(str), SL = S.toLowerCase();
  let SQ = null;
  const found = [];
  Object.keys(map).forEach(id => {
    const t = map[id];
    if (!t) return;
    const T = QN(t);
    let at = -1, len = T.length;
    if (words) {
      const m = new RegExp('(^|[^\\p{L}\\p{N}])' + T.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'u').exec(S);
      if (m) at = m.index + m[1].length;
    } else {
      at = S.indexOf(T);
      if (at < 0) at = SL.indexOf(T.toLowerCase());
      if (at < 0) {
        // Last resort: ignore whitespace ("Tuten and Fannin it💨" vs "Tuten and Fannin it 💨").
        const TQ = T.toLowerCase().replace(/\s+/g, '');
        if (TQ.length >= 4) {
          SQ = SQ || squeeze(SL);
          const k = SQ.out.indexOf(TQ);
          if (k >= 0) { at = SQ.pos[k]; len = SQ.pos[k + TQ.length - 1] + 1 - at; }
        }
      }
    }
    if (at >= 0) found.push({id, team: t, year, at, len});
  });
  const kept = found.filter(a => !found.some(b => b !== a && b.len > a.len && b.at <= a.at && b.at + b.len >= a.at + a.len));
  kept.sort((a, b) => a.at - b.at || b.len - a.len);
  return kept.map(({id, team, year, at}) => ({id, team, year, at}));
}

// Managers whose team name appears in a holder line, in order of position.
// The year is the last 19xx/20xx in the string; that season's team names are used.
export function holders(str) {
  if (!DATA) return [];
  const s = String(str == null ? '' : str);
  const ys = s.match(/\b(19|20)\d\d\b/g);
  const year = ys ? Number(ys[ys.length - 1]) : null;
  const season = year != null ? seasonByYear(year) : null;
  const map = {};
  ids.forEach(id => { map[id] = teamIn(season, id); });
  return findIn(s, map, year, false);
}

// Same result shape as holders(), matching manager first names (whole words) instead of team names.
function namesIn(str) {
  const s = String(str == null ? '' : str);
  const ys = s.match(/\b(19|20)\d\d\b/g);
  const year = ys ? Number(ys[ys.length - 1]) : null;
  const map = {};
  ids.forEach(id => { map[id] = name(id); });
  return findIn(s, map, year, true);
}

let flatCache = null;
function flatItem(key, section, r, lines, match) {
  const matches = lines.map(match);
  const prim = matches.map(m => (m[0] ? m[0].id : null));
  return {
    key, section, label: r.label, val: r.val, unit: r.unit || '',
    holders: lines,
    matches,
    primary: prim[0] || null,
    ids: [...new Set(prim.filter(Boolean))]
  };
}
export function recordsFlat() {
  if (flatCache) return flatCache;
  if (!DATA) return [];
  const out = [];
  const R = DATA.records;
  if (R && R.sections) {
    R.sections.forEach((s, si) => (s.items || []).forEach((r, i) => out.push(flatItem(`${si}.${i}`, s.title, r, (r.holders || []).map(String), holders))));
  }
  if (!out.length) {
    FACTS.forEach((f, i) => out.push(flatItem('f.' + i, 'League records', f, [String(f.detail)], namesIn)));
  }
  flatCache = out;
  return out;
}

// ---------------------------------------------------------------------------
// "Me" (gg-me): which manager this phone belongs to
let meMem;
function meRead() {
  if (meMem !== undefined) return meMem;
  try { meMem = localStorage.getItem('gg-me'); } catch (_) { meMem = null; }
  return meMem;
}
// The raw stored value: a manager id, "none", or null when never chosen.
export function meRaw() { return meRead(); }
// The manager id from gg-me, or null ("none", unknown ids and unset all count as null).
export function me() {
  const v = meRead();
  return v && v !== 'none' && M[v] ? v : null;
}
export function setMe(idOrNone) {
  const v = idOrNone == null ? null : String(idOrNone);
  meMem = v;
  try {
    if (v == null) localStorage.removeItem('gg-me');
    else localStorage.setItem('gg-me', v);
  } catch (_) {}
  emit('me', {id: me(), raw: v});
}
try {
  addEventListener('storage', e => {
    if (e.key !== 'gg-me') return;
    meMem = e.newValue;
    emit('me', {id: me(), raw: e.newValue});
  });
} catch (_) {}
