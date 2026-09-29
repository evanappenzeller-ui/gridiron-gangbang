// The Daily: puzzles, saved progress, scoring, share text and the Firebase league board.
// Logic moved unchanged from the old single-file app. No DOM rendering here.
// Puzzles v2: a day entry with `v: 2` has five puzzles (College, Silhouettes, Mystery, Journey, Grid; 1,500
// points). Days without `v` are v1 (three puzzles, 1,000 points) and behave exactly as before.
// Owner: foundation (core).

import {DATA, nf, norm, me as dataMe} from './data.js';

export {nf, norm};

// ---------------------------------------------------------------------------
// Constants (unchanged)
export const TA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
export const POSN = {QB:'Quarterback', RB:'Running back', WR:'Wide receiver', TE:'Tight end', OL:'Offensive lineman', DL:'Defensive lineman', LB:'Linebacker', DB:'Defensive back', K:'Kicker', P:'Punter', LS:'Long snapper', ST:'Special teams'};
export const SK = ['pass_yards','pass_tds','pass_ints','rush_yards','rush_tds','receptions','rec_yards','rec_tds','def_sacks','def_ints','games'];
export const SL = {pass_yards:'passing yards', pass_tds:'touchdown passes', rush_yards:'rushing yards', rush_tds:'rushing touchdowns', receptions:'catches', rec_yards:'receiving yards', rec_tds:'touchdown catches', def_sacks:'sacks', def_ints:'interceptions'};
// sil: points per silhouette round. jr: Journey points when solved on guess 1, 2, 3 (v2 days only).
export const PTS = {col: 40, grid: 50, who: 50, sil: 50, jr: [250, 150, 75]};
export const PROMPTS = {
  col: 'Pick the college each player was drafted out of. 40 points each.',
  who: 'Name the player. Each wrong guess or skipped clue shows another one. Fewer clues means more points.',
  grid: 'Name a player who fits each row and column. One guess per square, 50 points each. Franchise history counts, so a Houston Oilers season counts for the Titans.',
  sil: 'Name the player from his silhouette. Four choices and one pick per round, 50 points each.',
  jr: 'Follow his path from college to the team he plays for now, then name him. Three guesses: 250, 150, then 75 points.'
};
// "Audience" players for the examples shown under missed grid squares: played in 2010 or later.
export const AUDIENCE_YEAR = 2010;

// Local development never writes to the real league board unless the URL has ?post=1 (exactly).
// "Local" covers loopback, *.localhost / *.test / *.local names, and private LAN addresses
// (a phone on the same Wi-Fi reaching the dev server by IP). Production (github.io) is unaffected.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
export const isDevHost = h => LOCAL_HOSTS.includes(h)
  || /\.(localhost|test|local)$/.test(h)
  || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(h);
let postParam = false;
try { postParam = new URLSearchParams(location.search).get('post') === '1'; } catch (_) {}

// Dev preview: on a dev host, ?day=<PNUM> in location.search (before the #) plays that puzzle day instead of
// today's, so v2 days can be tested early. Production hosts ignore it. null when not overridden.
function devDayFrom(search, host) {
  if (!isDevHost(host)) return null;
  let v = null;
  try { v = new URLSearchParams(search || '').get('day'); } catch (_) { v = null; }
  return v && /^[1-9]\d{0,3}$/.test(v) ? +v : null;
}
let devDay = null;
try { devDay = devDayFrom(location.search, location.hostname); } catch (_) { devDay = null; }
export const DEV_DAY = devDay;
// A previewed day never posts, even with ?post=1: its score would land on the real board under a future day.
export const DEV_NO_POST = isDevHost(location.hostname) && (!postParam || devDay != null);

const PUZZLES_URL = new URL('../../data/puzzles.json', import.meta.url).href;

// ---------------------------------------------------------------------------
// Live bindings, assigned when ensure() finishes
export let status = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
export let loadError = null;
export let PZ = null;
export let PP = [];         // [name, teams, pos, draft, firstYear, lastYear, colleges, fame]
export let dayIndex = 0;
export let PNUM = 0;
export let DAY = null;
export let TODAY_LABEL = '';
export let SKEY = '';
export let DS = {};

// ---------------------------------------------------------------------------
// Events: 'ready', 'progress', 'lb', 'newday' (and 'error' when ensure() fails)
const subs = new Set();
export function subscribe(fn) {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
function emit(type, detail) {
  [...subs].forEach(fn => { try { fn(type, detail); } catch (e) { console.error(e); } });
}

// ---------------------------------------------------------------------------
// Idle helper (requestIdleCallback with a setTimeout fallback)
const idle = fn => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, {timeout: 2000});
  else setTimeout(fn, 200);
};

// ---------------------------------------------------------------------------
// Day math and saved progress
function indexFor(start, t) {
  const [y, m, d] = start.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}

function freshDS(raw) {
  let ds = raw;
  if (!ds || typeof ds !== 'object' || Array.isArray(ds)) ds = {};
  ds.grid = ds.grid || {cells: Array(9).fill(null), over: false};
  ds.col = ds.col || {a: []};
  ds.who = ds.who || {g: [], clues: 1, done: false, won: false};
  ds.hl = ds.hl || {a: []};
  // v2 parts, filled for any day (v1 days never read or write them). A partial or hand-edited object keeps what it
  // has and gets the missing arrays, so the actions never meet an undefined list.
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  if (!obj(ds.jr) || !Array.isArray(ds.jr.g)) ds.jr = {g: [], done: !!(obj(ds.jr) && ds.jr.done), won: !!(obj(ds.jr) && ds.jr.won)};
  if (!obj(ds.sil) || !Array.isArray(ds.sil.a)) ds.sil = {a: []};
  return ds;
}

function readDS(key, day) {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { raw = {}; }
  // A day re-released in the five-puzzle format (Sep 29 2026 went v1 -> v2 mid-day) drops progress saved against its
  // old version: v2 progress is stamped v: 2, anything else on a v2 day starts over.
  if (isV2(day) && raw && raw.v !== 2) raw = {};
  const ds = freshDS(raw);
  if (isV2(day)) ds.v = 2;
  return ds;
}

export function saveDS() { try { localStorage.setItem(SKEY, JSON.stringify(DS)); } catch (_) {} }

function initDay(pz) {
  PZ = pz;
  PP = PZ.P;
  dayIndex = devDay ? devDay - 1 : indexFor(PZ.start, new Date());
  PNUM = dayIndex + 1;
  DAY = PZ.days[dayIndex % PZ.days.length];
  STEPS = stepsFor(DAY);
  SLUGS = slugsFor(DAY);
  TODAY_LABEL = devDay ? dayLabel(PNUM, {long: true}) : new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
  SKEY = 'gg-daily-' + PNUM;
  DS = readDS(SKEY, DAY);
  seenIndex = dayIndex;
  deepCache.clear();
  NW = null; // the search index belongs to this PP
}

// Date (local midnight) of a puzzle day number: PZ.start + (pnum - 1) days.
export function dateOf(pnum) {
  const [y, m, d] = PZ.start.split('-').map(Number);
  return new Date(y, m - 1, d + (pnum - 1));
}

// The puzzle entry (days[i]) for a puzzle day number, or null before puzzles load.
export function dayFor(pnum = PNUM) {
  if (!PZ || !(pnum >= 1)) return null;
  return PZ.days[(pnum - 1) % PZ.days.length];
}

// Label for a puzzle day (local date): 'Tue, Sep 29', or with {long: true} 'Tuesday, September 29'.
// Replaces "Daily #n" in the UI. Before puzzles load it labels today's date.
export function dayLabel(pnum = PNUM, {long = false} = {}) {
  const o = long ? {weekday: 'long', month: 'long', day: 'numeric'} : {weekday: 'short', month: 'short', day: 'numeric'};
  let d = new Date();
  if (PZ && Number(pnum) >= 1) d = dateOf(Number(pnum));
  return d.toLocaleDateString('en-US', o);
}

let seenIndex = null;
// Recomputes the local day index; emits 'newday' (once per change) when it moved on.
// A dev ?day= override pins the day, so it never reports a new day.
export function checkDay() {
  if (!PZ || devDay) return false;
  const i = indexFor(PZ.start, new Date());
  if (i === dayIndex) return false;
  if (i !== seenIndex) {
    seenIndex = i;
    emit('newday', {dayIndex: i, PNUM: i + 1, was: PNUM});
  }
  return true;
}

// ---------------------------------------------------------------------------
// Player helpers (unchanged)
export const teamsOf = i => [...PP[i][1]].map(c => PZ.teams[TA.indexOf(c)]);
export const andList = a => a.length <= 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
export const yrs = i => PP[i][4] === PP[i][5] ? `${PP[i][4]}` : `${PP[i][4]}–${PP[i][5]}`;
export const stat = (i, k) => PZ.N[i][7][SK.indexOf(k)];
export function playerLine(i) { return `${POSN[PP[i][2]] || PP[i][2]}, ${yrs(i)}. ${andList(teamsOf(i))}.`; }

// Criteria
export function critOk(c, p) {
  const [k, v] = c.split(':');
  if (k === 't') return p[1].includes(TA[+v]);
  if (k === 'p') return p[2] === v;
  if (k === 'd') return p[3] === v;
  if (k === 'c') return p[6].includes(TA[+v]);
  return false;
}
export function critLabel(c) {
  const [k, v] = c.split(':');
  if (k === 't') return PZ.teams[+v];
  if (k === 'p') return 'Played ' + v;
  if (k === 'd') return v === '1' ? '1st-round pick' : 'Undrafted';
  return PZ.colleges[+v];
}
// 't' team, 'p' position, 'd' draft, 'c' college
export const critKind = c => String(c).split(':')[0];

// Player search. The NW index is built at idle in 8 ms chunks, or synchronously on first use.
let NW = null;
function buildIndexSync() { if (!NW || NW.length !== PP.length) NW = PP.map(p => norm(p[0]).split(' ')); }
function buildIndexIdle() {
  const out = new Array(PP.length), src = PP;
  let i = 0;
  const step = () => {
    if (NW || src !== PP) return;
    const t0 = performance.now();
    while (i < src.length && performance.now() - t0 < 8) { out[i] = norm(src[i][0]).split(' '); i++; }
    if (i < src.length) idle(step);
    else if (!NW) NW = out;
  };
  idle(step);
}
// {audienceFirst: true} (Journey and Mystery, whose answers are always audience players) lists audience players
// before older namesakes, so the answer is never behind a 1990s player with his name.
export function searchPlayers(q, {audienceFirst = false} = {}) {
  if (!PZ) return []; // puzzles not loaded yet: never build an index over the empty PP
  const t = norm(q).split(' ').filter(Boolean);
  if (!t.length) return [];
  buildIndexSync();
  const out = [];
  for (let i = 0; i < PP.length; i++) {
    const w = NW[i];
    if (t.every(tok => w.some(x => x.startsWith(tok)))) out.push(i);
  }
  if (audienceFirst) out.sort((a, b) => (isAudienceIdx(b) - isAudienceIdx(a)) || PP[b][7] - PP[a][7]);
  else out.sort((a, b) => PP[b][7] - PP[a][7]);
  return out.slice(0, 8);
}

// Audience (contract): last season AUDIENCE_YEAR or later, or a famous Hall of Famer (N says Hall of Fame and fame
// >= 45 at QB/RB/WR/TE or >= 60 elsewhere; a 1980s start needs fame >= 68 or QB). The generator uses the same rule.
const SKILLPOS = new Set(['QB', 'RB', 'WR', 'TE']);
const NOT_FAMOUS_HOF = new Set(['Mike Singletary', 'Aeneas Williams']);
function famousHOF(i) {
  const p = PP[i], n = PZ && PZ.N && PZ.N[i];
  return !!(p && n && n[6]) && p[7] >= (SKILLPOS.has(p[2]) ? 45 : 60) && (p[4] >= 1990 || p[7] >= 68 || p[2] === 'QB') && !NOT_FAMOUS_HOF.has(p[0]);
}
/** True for players a 26-27 year old fan can know: played in AUDIENCE_YEAR or later, or a famous Hall of Famer. */
export const isAudienceIdx = i => !!PP[i] && (PP[i][5] >= AUDIENCE_YEAR || famousHOF(i));

// Example pick order under a missed grid square (display only): the player this audience most likely knows.
// 1. audience players first (contract), 2. not a specialist (K, P, LS, ST), 3. a career that began in 2000 or
// later (or a famous Hall of Famer), 4. recognizability: honors (fame minus seasons) weighted by the share of the
// career played since 2008, plus a position-weighted longevity term, draft capital (round 1 or 2) and a flat bonus
// for famous Hall of Famers (the puzzle generator's score without its league-draft term).
// The first index wins ties. Blocked names are never shown while any other player fits.
const EX_BLOCK = new Set(['Darren Sharper']);
// Players whose Pro Bowls came on special teams (returners, gunners): honors ignored, ranked with the specialists.
// The puzzle generator (scratchpad nfl/generate.js ST_NAMES) uses the same list.
const EX_ST = new Set(['Andre Roberts', 'Justin Bethel', 'Matthew Slater', 'Miles Killebrew', 'Devin Duvernay', 'Dwayne Harris',
  'Jakeem Grant', 'Leon Washington', 'KaVontae Turpin', 'Josh Cribbs', 'J.T. Gray', 'Jeremy Reaves', 'Ashton Dulin', 'George Odum',
  'Jalen Reeves-Maybin', 'Keisean Nixon', 'Braxton Berrios', 'Deonte Harty', 'Jamal Agnew', 'Corey Graham', 'Brendon Ayanbadejo',
  'Kassim Osgood', 'Montell Owens', 'Eric Weems', 'Marcus Jones', 'Nate Ebner', 'Dexter McCluster', 'Cody Davis', 'Kene Nwangwu',
  'Mike Thomas', 'Deonte Thompson', 'Ameer Abdullah', 'Brandon Powell', 'Isaiah McKenzie', 'Tremon Smith', 'Chris Board']);
const EX_POSW = {QB: 1.6, RB: 2, WR: 2, TE: 1.6, DL: 1, LB: 1, DB: 1, OL: 0.4, K: 0.6, P: 0.3, LS: 0, ST: 0};
const EX_SPECIAL = new Set(['K', 'P', 'LS', 'ST']);
let EXR = null, EXR_PP = null;
function exampleRanks() {
  if (EXR && EXR_PP === PP) return EXR;
  const last = new Date().getFullYear() - 1; // seasons played through last year
  EXR = new Float64Array(PP.length);
  for (let i = 0; i < PP.length; i++) {
    const p = PP[i];
    if (EX_BLOCK.has(p[0])) { EXR[i] = -1; continue; }
    const hof = famousHOF(i);
    const st = EX_SPECIAL.has(p[2]) || (p[5] >= 2005 && EX_ST.has(p[0]));
    const s = Math.max(0, Math.min(p[5], last) - p[4] + 1);
    const se = Math.max(0, Math.min(p[5], last) - Math.max(p[4], 2008) + 1);
    const honors = st ? 0 : Math.max(0, p[7] - s);
    const skill = SKILLPOS.has(p[2]);
    const draft = !se ? 0 : p[3] === '1' ? (p[2] === 'QB' ? 8 : skill ? 4 : 2.5) : p[3] === '2' ? (p[2] === 'QB' ? 3 : skill ? 2 : 1) : 0;
    const v = honors * (0.4 + 0.6 * (s ? se / s : 1)) + (EX_POSW[p[2]] || 0) * Math.sqrt(Math.min(se, 9)) + draft + (hof ? 30 : 0);
    EXR[i] = (isAudienceIdx(i) ? 4e6 : 0) + (st ? 0 : 2e6) + (p[4] >= 2000 || hof ? 1e6 : 0) + Math.min(v, 9e5);
  }
  EXR_PP = PP;
  return EXR;
}
/** The example rank of player i (higher shows first). Exported for the core checks. */
export const exampleRank = i => exampleRanks()[i];

export function exampleFor(r, c, exclude = new Set()) {
  const rk = exampleRanks();
  let best = -1;
  for (let i = 0; i < PP.length; i++) {
    if (exclude.has(i)) continue;
    const p = PP[i];
    if (critOk(r, p) && critOk(c, p) && (best < 0 || rk[i] > rk[best])) best = i;
  }
  return best;
}

// critOk with the criterion parsed once (for scans over every player).
function critFn(c) {
  const [k, v] = String(c).split(':');
  if (k === 't') { const ch = TA[+v]; return p => p[1].includes(ch); }
  if (k === 'p') return p => p[2] === v;
  if (k === 'd') return p => p[3] === v;
  if (k === 'c') { const ch = TA[+v]; return p => p[6].includes(ch); }
  return () => false;
}
/** exampleFor() for all nine squares of today's grid in one pass over the players (row-major, -1 when none).
 *  Same rule and pick as exampleFor (exampleRank order, first index on ties). */
export function examplesFor(exclude = new Set(), day = DAY) {
  const best = Array(9).fill(-1);
  if (!PZ || !day) return best;
  const rk = exampleRanks();
  const ex = exclude instanceof Set ? exclude : new Set(exclude);
  const R = day.g.slice(0, 3).map(critFn), C = day.g.slice(3, 6).map(critFn);
  for (let i = 0; i < PP.length; i++) {
    if (ex.has(i)) continue;
    const p = PP[i];
    let rm = 0, cm = 0;
    for (let r = 0; r < 3; r++) if (R[r](p)) rm |= 1 << r;
    if (!rm) continue;
    for (let c = 0; c < 3; c++) if (C[c](p)) cm |= 1 << c;
    if (!cm) continue;
    for (let r = 0; r < 3; r++) {
      if (!(rm & (1 << r))) continue;
      for (let c = 0; c < 3; c++) {
        if (!(cm & (1 << c))) continue;
        const k = r * 3 + c;
        if (best[k] < 0 || rk[i] > rk[best[k]]) best[k] = i;
      }
    }
  }
  return best;
}

export function whoClues(i) {
  const n = PZ.N[i], p = PP[i], pos = p[2], S = k => stat(i, k);
  let line;
  if (pos === 'QB') line = `${nf(S('pass_yards'))} passing yards, ${S('pass_tds')} touchdown passes, ${S('pass_ints')} interceptions`;
  else if (pos === 'RB') line = `${nf(S('rush_yards'))} rushing yards, ${S('rush_tds')} rushing touchdowns, ${nf(S('receptions'))} catches`;
  else if (pos === 'WR' || pos === 'TE') line = `${nf(S('receptions'))} catches, ${nf(S('rec_yards'))} receiving yards, ${S('rec_tds')} touchdown catches`;
  else if (pos === 'DB') line = `${S('def_ints')} interceptions in ${S('games')} games`;
  else line = `${S('def_sacks')} sacks in ${S('games')} games`;
  const honors = [n[4] ? `${n[4]} Pro Bowl${n[4] > 1 ? 's' : ''}` : 'No Pro Bowls', n[5] ? `${n[5]} first-team All-Pro nod${n[5] > 1 ? 's' : ''}` : '', n[6] ? 'Hall of Fame' : ''].filter(Boolean).join(', ');
  const initials = p[0].split(' ').filter(w => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)).map(w => w[0] + '.').join(' ');
  return [
    ['Position', `${POSN[pos]}, played ${yrs(i)}`],
    ['Career', line],
    ['Honors', honors],
    ['Draft', `${n[0]}, round ${n[1]}, pick ${n[2]}`],
    ['College', n[8]],
    ['Teams', andList(teamsOf(i))],
    ['Initials', initials]
  ];
}

// ---------------------------------------------------------------------------
// Scoring: 1,000 points a day (v1 days: College, Mystery, Grid) or 1,500 (v2 days, `v: 2`: College,
// Silhouettes, Mystery, Journey, Grid). Every function reads the live DS/DAY by default;
// pass a DS-shaped object (and a day) to score something else without touching state.
export const isV2 = (day = DAY) => !!(day && day.v === 2);
export const maxPts = (day = DAY) => isV2(day) ? 1500 : 1000;

export const gridDone = (ds = DS) => ds.grid.over || ds.grid.cells.every(Boolean);
export const gridScore = (ds = DS) => ds.grid.cells.filter(c => c && c.ok).length;
export const colDone = (ds = DS) => ds.col.a.length >= 5;
export const colScore = (ds = DS, day = DAY) => ds.col.a.filter((a, r) => a === day.c[r][2]).length;
export const whoDone = (ds = DS) => ds.who.done;
export const ptsCol = (ds = DS, day = DAY) => colScore(ds, day) * PTS.col;
export const ptsWho = (ds = DS) => ds.who.won ? (8 - ds.who.clues) * PTS.who : 0;
export const ptsGrid = (ds = DS) => gridScore(ds) * PTS.grid;

// Silhouettes (v2): DS.sil.a holds the option position picked per round (0-3; -1 = locked in unanswered).
const silA = ds => (ds && ds.sil && Array.isArray(ds.sil.a)) ? ds.sil.a : [];
export const silRounds = (day = DAY) => (day && Array.isArray(day.s)) ? day.s.length : 5;
export const silDone = (ds = DS, day = DAY) => silA(ds).length >= silRounds(day);
export const silScore = (ds = DS, day = DAY) => silA(ds).filter((a, r) => !!(day && day.s && day.s[r]) && a === day.s[r].a).length;
export const ptsSil = (ds = DS, day = DAY) => silScore(ds, day) * PTS.sil;

// Journey (v2): DS.jr = {g: [wrong guesses, like who.g], done, won}. Solved on guess g.length + 1.
const JR0 = {g: [], done: false, won: false};
const jrOf = ds => (ds && ds.jr && Array.isArray(ds.jr.g)) ? ds.jr : JR0;
export const jrDone = (ds = DS) => !!jrOf(ds).done;
/** Guess number (1-3) the Journey was solved on, 0 when missed or unsolved. */
export const jrGuessNo = (ds = DS) => { const j = jrOf(ds); return j.won ? Math.min(j.g.length + 1, 3) : 0; };
export const ptsJr = (ds = DS) => { const n = jrGuessNo(ds); return n ? PTS.jr[n - 1] : 0; };

const V1_STEPS = [
  {id: 'col', done: colDone, started: (ds = DS) => ds.col.a.length > 0, pts: ptsCol, max: 200, label: 'College', result: (ds = DS, day = DAY) => `${colScore(ds, day)} of 5`},
  {id: 'who', done: whoDone, started: (ds = DS) => ds.who.g.length > 0 || ds.who.clues > 1, pts: ptsWho, max: 350, label: 'Mystery player', result: (ds = DS) => ds.who.won ? `Clue ${ds.who.clues} of 7` : 'Stumped'},
  {id: 'grid', done: gridDone, started: (ds = DS) => ds.grid.cells.some(Boolean), pts: ptsGrid, max: 450, label: 'Grid', result: (ds = DS) => `${gridScore(ds)} of 9`}
];
const V2_STEPS = [
  V1_STEPS[0],
  {id: 'sil', done: silDone, started: (ds = DS) => silA(ds).length > 0, pts: ptsSil, max: 250, label: 'Silhouettes', result: (ds = DS, day = DAY) => `${silScore(ds, day)} of ${silRounds(day)}`},
  V1_STEPS[1],
  {id: 'jr', done: jrDone, started: (ds = DS) => jrOf(ds).g.length > 0 || jrOf(ds).done, pts: ptsJr, max: 250, label: 'Journey', result: (ds = DS) => jrGuessNo(ds) ? `Guess ${jrGuessNo(ds)} of 3` : 'Missed'},
  V1_STEPS[2]
];
const V1_SLUGS = ['college', 'mystery', 'grid'];
const V2_SLUGS = ['college', 'silhouette', 'mystery', 'journey', 'grid'];
/** The step list (v1: 3 steps, v2: 5) for a day entry. The arrays are shared: never mutate them. */
export const stepsFor = (day = DAY) => isV2(day) ? V2_STEPS : V1_STEPS;
/** Route slugs in step order for a day entry. */
export const slugsFor = (day = DAY) => isV2(day) ? V2_SLUGS : V1_SLUGS;

// Live bindings: today's step set and route slugs (set in initDay; the v1 set until puzzles load).
export let STEPS = V1_STEPS;
export let SLUGS = V1_SLUGS;

export const totalPts = (ds = DS, day = DAY) => stepsFor(day).reduce((t, s) => t + s.pts(ds, day), 0);
export const allDone = (ds = DS, day = DAY) => stepsFor(day).every(s => s.done(ds, day));
export const anyStarted = (ds = DS, day = DAY) => stepsFor(day).some(s => s.started(ds, day) || s.done(ds, day));
export const firstOpen = (ds = DS, day = DAY) => { const i = stepsFor(day).findIndex(s => !s.done(ds, day)); return i < 0 ? 0 : i; };

// Route slugs for today's puzzles
export const slug = stepIndex => SLUGS[stepIndex] || null;
export const stepOf = s => SLUGS.indexOf(s);

// ---------------------------------------------------------------------------
// Actions. Each mutates DS exactly as the old click handlers did, saves, and emits 'progress'.
let muted = false; // __dev.scratch(): actions run on a scratch DS/DAY without saving or emitting
function changed(action, extra) { if (muted) return; saveDS(); emit('progress', Object.assign({action}, extra)); }

// Actions coerce their arguments to integers first (views read data-* attributes, which are strings;
// the old handlers did `+t.dataset.x`), so DS always stores numbers and === comparisons hold.
const toInt = x => (typeof x === 'number' ? x : (x === '' || x == null ? NaN : Number(x)));

// College: answer the next player with option j. Returns {row, correct, ans}, or null when all 5 are
// answered or j is not a valid option index.
export function colPick(j) {
  j = toInt(j);
  const row = DS.col.a.length;
  if (!DAY || row >= DAY.c.length) return null;
  if (!Number.isInteger(j) || j < 0 || j >= DAY.c[row][1].length) return null;
  DS.col.a.push(j);
  const ans = DAY.c[row][2];
  const out = {row, correct: j === ans, ans};
  changed('colPick', out);
  return out;
}

// Mystery: show the next clue (only while unsolved and clues < 7). Returns true when a clue was added.
export function whoNextClue() {
  if (DS.who.done || DS.who.clues >= 7) return false;
  DS.who.clues++;
  changed('whoNextClue', {clues: DS.who.clues});
  return true;
}

// Mystery: guess player i. Returns 'win' | 'dup' | 'wrong' | 'stumped' (null when already finished
// or i is not a player index).
export function whoGuess(i) {
  i = toInt(i);
  if (!Number.isInteger(i) || !PP[i]) return null;
  const st = DS.who;
  if (st.done) return null;
  if (i === DAY.w) { st.done = true; st.won = true; changed('whoGuess', {result: 'win', i}); return 'win'; }
  if (st.g.includes(i)) return 'dup';
  st.g.push(i);
  let result;
  if (st.clues >= 7) { st.done = true; st.won = false; result = 'stumped'; }
  else { st.clues++; result = 'wrong'; }
  changed('whoGuess', {result, i});
  return result;
}

// Grid: guess player i for square k (0-8, row-major). Returns 'dup' | 'ok' | 'no'
// ('dup' does not mutate; null when the square is taken, the grid is over, or k/i are invalid).
export function gridGuess(k, i) {
  k = toInt(k); i = toInt(i);
  if (!Number.isInteger(k) || !Number.isInteger(i) || !PP[i]) return null;
  if (!(k >= 0 && k < 9) || gridDone() || DS.grid.cells[k]) return null;
  const g = DAY.g, r = g[Math.floor(k / 3)], c = g[3 + (k % 3)];
  if (DS.grid.cells.some(x => x && x.p === i)) return 'dup';
  const ok = critOk(r, PP[i]) && critOk(c, PP[i]);
  DS.grid.cells[k] = {p: i, ok};
  const result = ok ? 'ok' : 'no';
  changed('gridGuess', {result, k, i});
  return result;
}

export function gridGiveUp() {
  DS.grid.over = true;
  changed('gridGiveUp');
}

// Silhouettes (v2 days): answer round `round` (0-4, in order: round must equal DS.sil.a.length) with
// option position j (0-3). Returns {round, correct, ans, p} (ans = the right option position, p = the
// answer's player index), or null on a v1 day, when the round is out of order, already answered or out
// of range, or j is not an option position.
export function silPick(round, j) {
  round = toInt(round); j = toInt(j);
  if (!isV2() || !Array.isArray(DAY.s) || !Number.isInteger(round) || !Number.isInteger(j)) return null;
  const a = DS.sil.a, S = DAY.s;
  if (round !== a.length || round < 0 || round >= S.length) return null;
  if (j < 0 || j >= S[round].o.length) return null;
  a.push(j);
  const ans = S[round].a;
  const out = {round, correct: j === ans, ans, p: S[round].p};
  changed('silPick', out);
  return out;
}

// Journey (v2 days): guess player i. Returns 'win' | 'dup' | 'wrong' | 'lost' (lost = the third wrong
// guess), or null on a v1 day, when already finished, or i is not a player index. Wrong guesses are
// kept in DS.jr.g (like DS.who.g); 'dup' (a player already guessed) does not mutate.
export function journeyGuess(i) {
  i = toInt(i);
  if (!isV2() || !DAY.j || !Number.isInteger(i) || !PP[i]) return null;
  const st = DS.jr;
  if (st.done) return null;
  if (i === DAY.j.p) { st.done = true; st.won = true; changed('journeyGuess', {result: 'win', i, n: st.g.length + 1}); return 'win'; }
  if (st.g.includes(i)) return 'dup';
  st.g.push(i);
  let result = 'wrong';
  if (st.g.length >= 3) { st.done = true; st.won = false; result = 'lost'; }
  changed('journeyGuess', {result, i});
  return result;
}

// Journey draft line: the day's optional frozen j.d = [draftYear, round | 'U'], else the N entry, else the
// P entry (round, with the first season as the year), else 'Unknown'.
function jrDraftText(day) {
  const p = day.j.p, d = day.j.d;
  if (Array.isArray(d) && d.length) return d[1] === 'U' || d[0] === 'U' || !d[1] ? 'Undrafted' : `${d[0]}, round ${d[1]}`;
  const n = PZ && PZ.N && PZ.N[p];
  if (n && n[0] && n[1]) return `${n[0]}, round ${n[1]}`;
  const r = PP[p] ? PP[p][3] : '';
  if (r === 'U') return 'Undrafted';
  if (/^\d+$/.test(r)) return `${PP[p][4]}, round ${r}`;
  return 'Unknown';
}
/** Both Journey hints for a day, earned or not: [['Position', 'Running back'], ['Draft', '2022, round 2' | 'Undrafted']]. */
export function journeyClues(day = DAY) {
  if (!isV2(day) || !day.j || !PP[day.j.p]) return [];
  const pos = PP[day.j.p][2];
  return [['Position', POSN[pos] || pos], ['Draft', jrDraftText(day)]];
}
/** The hint strings earned so far (one per wrong guess, at most 2): 'Position: Running back', then
 *  'Draft: 2022, round 2' (or 'Draft: Undrafted'). [] on a v1 day. */
export function journeyHints(ds = DS, day = DAY) {
  const n = Math.min(jrOf(ds).g.length, 2);
  return journeyClues(day).slice(0, n).map(([k, v]) => `${k}: ${v}`);
}
/** The Journey path: {colleges: ['Wake Forest', 'Michigan State'] (earliest first), teams: ['Seahawks',
 *  'Chiefs'] (career order), current: 'Chiefs' (last team, null when none)}. null on a v1 day. */
export function journeyPath(day = DAY) {
  if (!isV2(day) || !day.j) return null;
  const colleges = Array.isArray(day.j.col) ? day.j.col.slice() : [];
  const teams = [...String(day.j.t || '')].map(c => PZ.teams[TA.indexOf(c)]).filter(Boolean);
  return {colleges, teams, current: teams.length ? teams[teams.length - 1] : null};
}

// Locks in the score as it is. The caller then runs maybeAutoPost() (the old flow).
// On v2 days it also fills the unanswered silhouette rounds with -1 (wrong) and ends the Journey.
export function lockIn() {
  DS.grid.over = true;
  while (DS.col.a.length < 5) DS.col.a.push(-1);
  if (!DS.who.done) { DS.who.done = true; DS.who.won = false; }
  if (isV2()) {
    while (DS.sil.a.length < silRounds()) DS.sil.a.push(-1);
    if (!DS.jr.done) { DS.jr.done = true; DS.jr.won = false; }
  }
  changed('lockIn');
}

// ---------------------------------------------------------------------------
// League leaderboard (Firebase Firestore, one document per player, anonymous sign-in)
export const LB = {save: null, uid: null, players: [], names: {}, ready: false, off: false, status: '', posting: false, mode: 'today', dev: DEV_NO_POST};
try { LB.nick = localStorage.getItem('gg-nick') || ''; } catch (_) { LB.nick = ''; }

function lbChanged(why, prev) { emit('lb', {prev: prev || LB.players, why}); }

let fbStarted = false;
async function startFirebase() {
  if (fbStarted) return;
  fbStarted = true;
  let FB = {};
  try { FB = JSON.parse(document.getElementById('firebase-config').textContent) || {}; } catch (_) { FB = {}; }
  if (!FB.apiKey || !FB.projectId) { LB.off = true; LB.ready = true; lbChanged('off'); return; }
  try {
    const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const [{initializeApp}, {getAuth, signInAnonymously}, fs] = await Promise.all([
      import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js')
    ]);
    const app = initializeApp(FB);
    LB.uid = (await signInAnonymously(getAuth(app))).user.uid;
    const db = fs.getFirestore(app);
    if (!DEV_NO_POST && devDay == null) LB.save = body => fs.setDoc(fs.doc(db, 'players', LB.uid), body);
    fs.onSnapshot(fs.collection(db, 'players'), snap => {
      const prev = LB.players;
      LB.players = snap.docs.map(d => Object.assign({id: d.id}, d.data()));
      LB.ready = true;
      const mine = LB.players.find(p => p.id === LB.uid);
      if (mine && mine.nick) LB.nick = mine.nick;
      if (entryFor(mine)) DS.posted = true;
      lbChanged('snapshot', prev);
      maybeAutoPost();
    }, err => { LB.err = err.code; LB.ready = true; lbChanged('error'); });
  } catch (_) { LB.off = true; LB.ready = true; lbChanged('off'); }
}

export const displayName = p => (p.nick || 'Someone');

// A player's posted entry for puzzle day pnum, or null. On a five-puzzle day an entry without the v2 fields was
// posted for the day's earlier three-puzzle version (Sep 29 2026 was re-released mid-day): it no longer counts as
// played today, and posting the new score replaces it.
export function entryFor(p, pnum = PNUM) {
  const d = p && p.days && p.days[pnum];
  if (!d) return null;
  const day = PZ ? PZ.days[(pnum - 1) % PZ.days.length] : null;
  return isV2(day) && d.s == null ? null : d;
}

export function maybeAutoPost() {
  if (!allDone() || DS.posted || !LB.save || LB.posting || LB.status === 'denied') return;
  if (LB.nick) postScore(LB.nick);
}

export async function postScore(nick) {
  if (!LB.save || LB.posting) return;
  LB.posting = true; LB.status = 'posting'; lbChanged('status');
  const me = LB.players.find(p => p.id === LB.uid);
  const days = Object.assign({}, me && me.days);
  if (!entryFor(me)) {
    days[PNUM] = {p: totalPts(), g: gridScore(), c: colScore(), w: DS.who.won ? DS.who.clues : 0};
    if (isV2()) { days[PNUM].j = jrGuessNo(); days[PNUM].s = silScore(); } // Journey guess no (0 = missed), faces right
  }
  const vals = Object.values(days);
  const body = {nick: (nick || '').trim().slice(0, 24), days, total: vals.reduce((s, d) => s + (d.p || 0), 0), played: vals.length, last: PNUM};
  try {
    await LB.save(body);
    DS.posted = true; saveDS(); LB.status = 'posted'; LB.nick = body.nick;
    try { localStorage.setItem('gg-nick', body.nick); } catch (_) {}
  } catch (e) {
    LB.status = e && e.code === 'permission-denied' ? 'denied' : e && e.code === 'resource-exhausted' ? 'full' : 'failed';
  }
  LB.posting = false; lbChanged('status');
}

// ---------------------------------------------------------------------------
// Share
// v1 days: the exact old text. v2 days add a "Faces" line after College and a "Journey" line after Mystery.
export function shareText(ds = DS, day = DAY) {
  const leagueName = DATA && DATA.league ? DATA.league.name : 'Gridiron Gangbang';
  const v2 = isV2(day);
  // The header date is today's (a dev ?day= preview shows the previewed puzzle day's date instead).
  const when = devDay && PZ ? dateOf(PNUM) : new Date();
  const lines = [`${leagueName} daily, ${when.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}: ${nf(totalPts(ds, day))} pts`];
  if (colDone(ds)) lines.push('College ' + ds.col.a.map((a, r) => a === day.c[r][2] ? '🟩' : '🟥').join(''));
  if (v2 && silDone(ds, day)) lines.push('Faces ' + silA(ds).map((a, r) => day.s[r] && a === day.s[r].a ? '🟩' : '🟥').join(''));
  if (whoDone(ds)) lines.push(ds.who.won ? `Mystery player: clue ${ds.who.clues} of 7` : 'Mystery player: stumped');
  if (v2 && jrDone(ds)) lines.push(jrGuessNo(ds) ? `Journey: guess ${jrGuessNo(ds)} of 3` : 'Journey: missed');
  if (gridDone(ds)) { lines.push(`Grid ${gridScore(ds)}/9`); for (let r = 0; r < 3; r++) lines.push(ds.grid.cells.slice(r * 3, r * 3 + 3).map(c => c && c.ok ? '🟩' : '🟥').join('')); }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Loading
let ensureP = null;
// Idempotent. Fetches puzzles.json, sets the day values and DS, emits 'ready'; then at idle
// builds the search index and starts Firebase. Rejects on failure (the next call retries).
export function ensure() {
  if (ensureP) return ensureP;
  status = 'loading';
  loadError = null;
  ensureP = fetch(PUZZLES_URL).then(r => {
    if (!r.ok) throw new Error('puzzles.json HTTP ' + r.status);
    return r.json();
  }).then(pz => {
    initDay(pz);
    status = 'ready';
    emit('ready', {PNUM});
    buildIndexIdle();
    idle(() => { startFirebase(); });
    idle(() => warmDeepCuts());
  }).catch(e => {
    status = 'error';
    loadError = e;
    ensureP = null;
    emit('error', {error: e});
    throw e;
  });
  return ensureP;
}

// ---------------------------------------------------------------------------
// Derivations (read-only)

// Manager id for a leaderboard nick: first word, letters only, equal to a manager's name.
function managerOfNick(nick) {
  const w = String(nick || '').trim().split(/\s+/)[0] || '';
  const k = w.toLowerCase().replace(/[^\p{L}]/gu, '');
  if (!k || !DATA || !DATA.managers) return null;
  const m = DATA.managers.find(x => String(x.name).toLowerCase() === k);
  return m ? m.id : null;
}
function managerFor(p) {
  if (p.id === LB.uid && LB.uid) return dataMe() || managerOfNick(displayName(p));
  return managerOfNick(displayName(p));
}

// Today-mode sub line for a board day entry. v1 entries ({p, g, c, w}): the exact old text. v2 entries
// (they carry s and/or j): the five parts in play order.
function daySub(d) {
  const id = d.w ? 'ID on clue ' + d.w : 'no ID';
  if (d.s == null && d.j == null) return `College ${d.c}/5, grid ${d.g}/9, ${id}`;
  return `College ${d.c}/5, faces ${d.s || 0}/5, ${id}, ${d.j ? 'path on guess ' + d.j : 'no path'}, grid ${d.g}/9`;
}

function tieRanks(rows, key) {
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r[key] !== prev) { rank = i + 1; prev = r[key]; } r.rank = rank; });
  return rows;
}

// Board rows exactly as the old leaderboardHTML built them (same sub strings, sort and tie ranks),
// plus {rank, me, managerId, move}. mode: 'today' | 'season' | 'streaks' (default LB.mode).
// players defaults to LB.players (pass a list to compute rows for something else); pnum defaults to today.
export function boardRows(mode = LB.mode, players = LB.players, pnum = PNUM) {
  if (mode === 'streaks') {
    const rows = players.map(p => {
      const s = streakOf(p);
      if (!s.best) return null;
      return {id: p.id, name: displayName(p), current: s.current, best: s.best, me: p.id === LB.uid, managerId: managerFor(p)};
    }).filter(Boolean).sort((a, b) => b.current - a.current || b.best - a.best);
    let rank = 0, pc = null, pb = null;
    rows.forEach((r, i) => { if (r.current !== pc || r.best !== pb) { rank = i + 1; pc = r.current; pb = r.best; } r.rank = rank; });
    return rows;
  }
  const rows = players.map(p => {
    if (mode === 'today') {
      const d = entryFor(p, pnum);
      return d ? {id: p.id, name: displayName(p), pts: d.p, sub: daySub(d)} : null;
    }
    if (!p.played) return null;
    return {id: p.id, name: displayName(p), pts: p.total || 0, sub: `${p.played} day${p.played === 1 ? '' : 's'} played, ${Math.round((p.total || 0) / p.played)} a day`};
  }).filter(Boolean).sort((a, b) => b.pts - a.pts);
  tieRanks(rows, 'pts');
  const byId = new Map(players.map(p => [p.id, p]));
  let before = null;
  if (mode === 'season') {
    // Rank by total before today's points; players whose only day is today are 'new'.
    const prevRows = players.map(p => {
      if (!p.played) return null;
      const t = p.days && p.days[pnum];
      if (p.played - (t ? 1 : 0) <= 0) return null;
      return {id: p.id, pts: (p.total || 0) - ((t && t.p) || 0)};
    }).filter(Boolean).sort((a, b) => b.pts - a.pts);
    tieRanks(prevRows, 'pts');
    before = new Map(prevRows.map(r => [r.id, r.rank]));
  }
  rows.forEach(r => {
    const p = byId.get(r.id);
    r.me = r.id === LB.uid;
    r.managerId = managerFor(p);
    r.move = mode === 'season' ? (before.has(r.id) ? before.get(r.id) - r.rank : 'new') : null;
  });
  return rows;
}

// Social line: today's players (board rows, highest first), how many regulars there are,
// who is still to play, and the leader's name.
export function social(players = LB.players, pnum = PNUM) {
  const played = boardRows('today', players, pnum);
  // A regular has posted at least once (played > 0, last >= 1) within the last 7 puzzle days.
  // Without the played/last guard, docs that never posted count as regulars in the first week (PNUM <= 7).
  const recent = p => (p.played || 0) > 0 && (p.last || 0) >= 1 && p.last >= pnum - 7;
  const today = p => !!entryFor(p, pnum);
  const regulars = players.filter(p => recent(p) || today(p)).length;
  const stillToPlay = players.filter(p => recent(p) && !today(p)).map(p => ({id: p.id, name: displayName(p), managerId: managerFor(p), me: p.id === LB.uid}));
  const leaderRow = played[0] || null;
  return {played, regulars, stillToPlay, leader: leaderRow ? leaderRow.name : null, leaderRow};
}

// Points for a saved day (DS-shaped object) on puzzle day pnum, or null before puzzles load.
export function pointsFor(ds, pnum = PNUM) {
  if (!PZ) return null;
  const day = PZ.days[(pnum - 1) % PZ.days.length];
  return totalPts(freshDS(ds), day);
}

// Streak from this phone's saved days (localStorage gg-daily-N). A day counts when every step of that
// day's version is done (3 or 5); it is perfect when its points equal that day's maxPts (1,000 or 1,500).
export function streakLocal() {
  const done = new Set(), perfect = new Set();
  const consider = (n, ds) => {
    if (!(n >= 1 && n <= PNUM)) return;
    const day = dayFor(n);
    if (!day || !allDone(ds, day)) return;
    done.add(n);
    if (pointsFor(ds, n) === maxPts(day)) perfect.add(n);
  };
  try {
    for (let k = 0; k < localStorage.length; k++) {
      const key = localStorage.key(k);
      const m = /^gg-daily-(\d+)$/.exec(key || '');
      if (!m || +m[1] === PNUM) continue;
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(key)); } catch (_) { raw = null; }
      if (raw && typeof raw === 'object') consider(+m[1], freshDS(raw));
    }
  } catch (_) {}
  if (PNUM) consider(PNUM, DS);
  const todayDone = done.has(PNUM);
  let current = 0;
  for (let n = todayDone ? PNUM : PNUM - 1; n >= 1 && done.has(n); n--) current++;
  return {current, best: bestRun(done), atRisk: !todayDone && current > 0, done, perfect};
}

function bestRun(set) {
  let best = 0;
  set.forEach(n => {
    if (set.has(n - 1)) return;
    let len = 0;
    while (set.has(n + len)) len++;
    if (len > best) best = len;
  });
  return best;
}

// Streak from a leaderboard doc's days keys. The current streak ends at PNUM or PNUM-1.
export function streakOf(doc) {
  const set = new Set(Object.keys((doc && doc.days) || {}).map(Number).filter(n => n > 0));
  let current = 0;
  const start = set.has(PNUM) ? PNUM : PNUM - 1;
  for (let n = start; n >= 1 && set.has(n); n--) current++;
  return {current, best: bestRun(set)};
}

// Grade ladder (spec 7.7), applied to total / max: 100% PERFECT DAY, 85% ALL-PRO, 65% PRO BOWL,
// 45% STARTER, 25% PRACTICE SQUAD. max defaults to today's maxPts() (1,000 on v1 days, so the v1 ladder is
// unchanged). Display only. Used as an array callback (arr.map(gradeFor)) the index is ignored.
export function gradeFor(total, max) {
  const t = Number(total) || 0;
  let m = Number(max);
  if (!(m > 0) || arguments.length > 2) m = maxPts();
  const at = x => t * 1000 >= x * m; // t / m >= x / 1000, exact in integers
  return at(1000) ? 'PERFECT DAY' : at(850) ? 'ALL-PRO' : at(650) ? 'PRO BOWL' : at(450) ? 'STARTER' : at(250) ? 'PRACTICE SQUAD' : 'CUT DAY';
}

// DEEP CUT: player i is a valid answer for the square, its fame is at or below the 25th
// percentile of all valid answers for that square, and the square has at least 8 valid answers.
// r and c are criteria strings (e.g. 't:5'), or row/column indexes 0-2 into today's grid.
const deepCache = new Map();
const squareCrit = (r, c) => [typeof r === 'number' ? DAY.g[r] : r, typeof c === 'number' ? DAY.g[3 + c] : c];
// The fame cutoff for a square (one scan over every player, ~5 ms; memoized).
function deepCutoff(R, C) {
  const key = R + '|' + C;
  let cut = deepCache.get(key);
  if (cut === undefined) {
    const fr = critFn(R), fc = critFn(C);
    const fames = [];
    for (let j = 0; j < PP.length; j++) if (fr(PP[j]) && fc(PP[j])) fames.push(PP[j][7]);
    fames.sort((a, b) => a - b);
    cut = fames.length >= 8 ? fames[Math.ceil(0.25 * fames.length) - 1] : null;
    deepCache.set(key, cut);
  }
  return cut;
}
export function deepCut(r, c, i) {
  if (!PZ || i == null || !PP[i]) return false;
  const [R, C] = squareCrit(r, c);
  const cut = deepCutoff(R, C);
  if (cut == null) return false;
  return critOk(R, PP[i]) && critOk(C, PP[i]) && PP[i][7] <= cut;
}
/** True when deepCut() for this square is already computed (a call costs nothing). */
export function deepReady(r, c) {
  if (!PZ || !DAY) return false;
  const [R, C] = squareCrit(r, c);
  return deepCache.has(R + '|' + C);
}
/** Computes today's nine DEEP CUT cutoffs, one square per idle callback, then calls done().
 *  ensure() runs it at idle, so render-time deepCut() calls are normally free. */
export function warmDeepCuts(done) {
  if (!PZ || !DAY) { if (done) done(); return; }
  const day = DAY, todo = [];
  for (let k = 0; k < 9; k++) if (!deepReady(Math.floor(k / 3), k % 3)) todo.push(k);
  const step = () => {
    if (DAY !== day) return;
    const k = todo.shift();
    if (k == null) { if (done) done(); return; }
    const [R, C] = squareCrit(Math.floor(k / 3), k % 3);
    deepCutoff(R, C);
    idle(step);
  };
  if (!todo.length) { if (done) done(); return; }
  idle(step);
}

// Debug only (never called by the app): emit a synthetic event, e.g.
// daily.__dev.emit('lb', {prev: daily.LB.players, why: 'snapshot'}) after editing LB.players in the console.
// __dev.scratch(day, ds, fn) runs fn() synchronously with DAY/DS/STEPS/SLUGS swapped for a scratch day and
// DS (freshDS-normalized), with saving and 'progress' events muted, then restores everything; returns
// fn's result. For core checks (actions on a crafted v2 day) only.
export const __dev = {
  emit: (type, detail) => emit(type, detail),
  devDayFrom,
  scratch(day, ds, fn) {
    const keep = {DAY, DS, STEPS, SLUGS, muted};
    DAY = day; DS = freshDS(ds); STEPS = stepsFor(day); SLUGS = slugsFor(day); muted = true;
    try { return fn(DS); } finally { DAY = keep.DAY; DS = keep.DS; STEPS = keep.STEPS; SLUGS = keep.SLUGS; muted = keep.muted; }
  }
};
