// The Daily: puzzles, saved progress, scoring, share text and the Firebase league board.
// Logic moved unchanged from the old single-file app. No DOM rendering here.
// Puzzles v2: a day entry with `v: 2` has five puzzles (College, Silhouettes, Mystery, Journey, Grid; 1,500
// points). Days without `v` are v1 (three puzzles, 1,000 points) and behave exactly as before.
// Puzzles v3 (the short daily, from Sep 30 2026): `v: 3` days have the same five puzzles with one or two items each
// (2 College players, 2 faces, 1 Mystery player, 1 Journey, a 1 x 2 grid; 1,000 points). Counts come from the day:
// day.c.length, day.s.length and gridShape(day). v1 and v2 days keep their exact behavior.
// Puzzles v4 (the three-puzzle daily, from Oct 1 2026): `v: 4` days play three of the five v3 puzzles, named by the
// day's `t` (e.g. ['col', 'sil', 'who']) and always listed in the canonical order col, sil, who, jr, grid; each is
// exactly its v3 short format and points (600 a day). The day carries only its puzzles' fields. STEPS / SLUGS, board
// entries, board strings, share text and streaks follow the day's three steps. v1, v2 and v3 days keep their exact
// behavior.
// Owner: foundation (core).

import {DATA, nf, norm, me as dataMe, name as dataName} from './data.js';
import {getFire, canWrite, isDevHost, devDayFrom, DEV_DAY as fireDevDay} from './fire.js';

export {nf, norm};

// ---------------------------------------------------------------------------
// Constants (unchanged)
export const TA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
export const POSN = {QB:'Quarterback', RB:'Running back', WR:'Wide receiver', TE:'Tight end', OL:'Offensive lineman', DL:'Defensive lineman', LB:'Linebacker', DB:'Defensive back', K:'Kicker', P:'Punter', LS:'Long snapper', ST:'Special teams'};
export const SK = ['pass_yards','pass_tds','pass_ints','rush_yards','rush_tds','receptions','rec_yards','rec_tds','def_sacks','def_ints','games'];
export const SL = {pass_yards:'passing yards', pass_tds:'touchdown passes', rush_yards:'rushing yards', rush_tds:'rushing touchdowns', receptions:'catches', rec_yards:'receiving yards', rec_tds:'touchdown catches', def_sacks:'sacks', def_ints:'interceptions'};
// Points per item, by day version (ptsTable(day)). v1/v2 days: col per College player, grid per square, who = the
// Mystery step (solved on clue n scores (8 - n) x 50), sil per silhouette round, jr = Journey points when solved on
// guess 1, 2, 3 (v2 days only). v3 days: 100 per College player, face and grid square; who = 30, the cost of each
// extra clue (Mystery scores 200 on clue 1, then 170, 140 ... 20: whoWorth()); Journey 200 / 120 / 60. v4 days use the
// v3 table.
const PTS_V2 = {col: 40, grid: 50, who: 50, sil: 50, jr: [250, 150, 75]};
const PTS_V3 = {col: 100, grid: 100, who: 30, sil: 100, jr: [200, 120, 60]};
const WHO_V3 = [200, 170, 140, 110, 80, 50, 20]; // v3 Mystery points when solved on clue 1..7
// Live binding: the points table of the day being played (set when puzzles load; v1/v2 values until then).
export let PTS = PTS_V2;
const PROMPTS_V2 = {
  col: 'Pick the college each player was drafted out of. 40 points each.',
  who: 'Name the player. Each wrong guess or skipped clue shows another one. Fewer clues means more points.',
  grid: 'Name a player who fits each row and column. One guess per square, 50 points each. Franchise history counts, so a Houston Oilers season counts for the Titans.',
  sil: 'Name the player from his silhouette. Four choices and one pick per round, 50 points each.',
  jr: 'Follow his path from college to the team he plays for now, then name him. Three guesses: 250, 150, then 75 points.'
};
// v3 copy: the same prompts with the short daily's points (v4 days use it too).
const PROMPTS_V3 = {
  col: 'Pick the college each player was drafted out of. 100 points each.',
  who: PROMPTS_V2.who,
  grid: 'Name a player who fits the row and the column of each square. One guess per square, 100 points each. Franchise history counts, so a Houston Oilers season counts for the Titans.',
  sil: 'Name the player from his silhouette. Four choices and one pick per round, 100 points each.',
  jr: 'Follow his path from college to the team he plays for now, then name him. Three guesses: 200, 120, then 60 points.'
};
// Live binding: the prompt copy for the day being played (promptsFor(day) for any other day).
export let PROMPTS = PROMPTS_V2;
// "Audience" players for the examples shown under missed grid squares: played in 2010 or later.
export const AUDIENCE_YEAR = 2010;

// Local development never writes to the real league board unless the URL has ?post=1 (exactly).
// The dev-host classifier, the ?day= preview parser and the write guard live in fire.js (the shared Firebase
// layer); the values below are unchanged. "Local" covers loopback, *.localhost / *.test / *.local names, and
// private LAN addresses. Production (github.io) is unaffected.
// Dev preview: on a dev host, ?day=<PNUM> in location.search (before the #) plays that puzzle day instead of
// today's, so v2 days can be tested early. Production hosts ignore it. null when not overridden.
const devDay = fireDevDay;
export {isDevHost};
export const DEV_DAY = devDay;
// A previewed day never posts, even with ?post=1: its score would land on the real board under a future day.
export const DEV_NO_POST = !canWrite();

// The puzzle file has its own name per format generation: data/puzzles-v4.json holds the v1/v2/v3 days (Sep 28-30 2026)
// unchanged and the v4 days from Oct 1 2026 on. data/puzzles-v3.json (v3 from Sep 30) and data/puzzles.json (v2
// throughout) stay as they were for phones still running an earlier build: the service worker answers a slow request
// from its cache, keyed by path, so new code must never meet an old file under the same name (it would play Oct 1 as a
// v3 day) and old code must never meet the new one (it can't read v4 days). A new path has no cached copy, so the
// worker always waits for the network. Install new data here (and bump the name again if a future format changes days
// that older builds could still load). The file is generated by the scratchpad script nfl/v4.js from puzzles-v3.json.
const PUZZLES_URL = new URL('../../data/puzzles-v4.json', import.meta.url).href;

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

// Normalizes a saved-progress object (in place) for a day. The grid has one cell per square of the day's grid
// (9 on v1/v2 days and when no day is given; gridShape(day).n on v3 and v4 days, where a stored list is cut or padded:
// 2, or 0 on a v4 day without the Grid). Every part exists on every day, whether the day plays it or not.
function freshDS(raw, day) {
  let ds = raw;
  if (!ds || typeof ds !== 'object' || Array.isArray(ds)) ds = {};
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const v3 = isShort(day), n = v3 ? gridShape(day).n : 9;
  ds.grid = ds.grid || {cells: Array(n).fill(null), over: false};
  if (v3) {
    if (!obj(ds.grid)) ds.grid = {cells: Array(n).fill(null), over: false};
    if (!Array.isArray(ds.grid.cells)) ds.grid.cells = Array(n).fill(null);
    const c = ds.grid.cells;
    if (c.length > n) c.length = n;
    while (c.length < n) c.push(null);
  }
  ds.col = ds.col || {a: []};
  ds.who = ds.who || {g: [], clues: 1, done: false, won: false};
  ds.hl = ds.hl || {a: []};
  // v2 parts, filled for any day (v1 days never read or write them). A partial or hand-edited object keeps what it
  // has and gets the missing arrays, so the actions never meet an undefined list.
  if (!obj(ds.jr) || !Array.isArray(ds.jr.g)) ds.jr = {g: [], done: !!(obj(ds.jr) && ds.jr.done), won: !!(obj(ds.jr) && ds.jr.won)};
  if (!obj(ds.sil) || !Array.isArray(ds.sil.a)) ds.sil = {a: []};
  return ds;
}

// Progress saved for a v2, v3 or v4 day is stamped with the day's version; progress with another stamp (or none) was
// saved against an earlier version of that day and never counts for it.
// A day swapped for a new puzzle after it went live (RERELEASED) also needs that release's stamp (r).
const stampOk = (raw, day, pnum) => {
  const v = dayVersion(day);
  if (pnum != null && relOf(pnum) !== ((raw && raw.r) || 0)) return false;
  return v < 2 || !!(raw && raw.v === v);
};
// Puzzle days replaced with a new puzzle after release: pnum -> release number. Progress and board entries carry that
// number (r); anything from the old puzzle (no r, or another r) no longer counts for the day.
// Day 4 (Thu Oct 1 2026) was swapped for a new puzzle when the league reset the board (see SCORE_FROM).
export const RERELEASED = {4: 1};
export const relOf = pnum => RERELEASED[pnum] || 0;

function readDS(key, day, pnum) {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { raw = {}; }
  return loadDS(raw, day, pnum);
}
// Saved progress (parsed) -> DS for a day. A day re-released in another format (Sep 29 2026 went v1 -> v2 mid-day)
// drops progress saved against its old version: v2 progress is stamped v: 2, v3 progress v: 3 and v4 progress v: 4;
// anything else on such a day starts over.
function loadDS(raw, day, pnum) {
  const v = dayVersion(day);
  if (!stampOk(raw, day, pnum)) raw = {};
  const ds = freshDS(raw, day);
  if (v >= 2) ds.v = v;
  if (pnum != null && relOf(pnum)) ds.r = relOf(pnum);
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
  PTS = ptsTable(DAY);
  PROMPTS = promptsFor(DAY);
  TODAY_LABEL = devDay ? dayLabel(PNUM, {long: true}) : new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
  SKEY = 'gg-daily-' + PNUM;
  DS = readDS(SKEY, DAY, PNUM);
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
/** exampleFor() for every square of a day's grid in one pass over the players (row-major over gridShape(day):
 *  nine on v1/v2 days, two on v3/v4 days; -1 when none). Same rule and pick as exampleFor (exampleRank order, first
 *  index on ties). */
export function examplesFor(exclude = new Set(), day = DAY) {
  const best = Array(day ? gridShape(day).n : 9).fill(-1);
  if (!PZ || !day) return best;
  const rk = exampleRanks();
  const ex = exclude instanceof Set ? exclude : new Set(exclude);
  const shape = gridShape(day);
  const R = shape.rows.map(critFn), C = shape.cols.map(critFn), nr = R.length, nc = C.length;
  for (let i = 0; i < PP.length; i++) {
    if (ex.has(i)) continue;
    const p = PP[i];
    let rm = 0, cm = 0;
    for (let r = 0; r < nr; r++) if (R[r](p)) rm |= 1 << r;
    if (!rm) continue;
    for (let c = 0; c < nc; c++) if (C[c](p)) cm |= 1 << c;
    if (!cm) continue;
    for (let r = 0; r < nr; r++) {
      if (!(rm & (1 << r))) continue;
      for (let c = 0; c < nc; c++) {
        if (!(cm & (1 << c))) continue;
        const k = r * nc + c;
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
// Scoring: 1,000 points a day (v1 days: College, Mystery, Grid), 1,500 (v2 days, `v: 2`: College, Silhouettes,
// Mystery, Journey, Grid), 1,000 (v3 days, `v: 3`: the same five puzzles, one or two items each) or 600 (v4 days,
// `v: 4`: three of the v3 puzzles, named by the day's `t`).
// Every function reads the live DS/DAY by default; pass a DS-shaped object (and a day) to score something else
// without touching state.

/** Puzzle format of a day entry: 1 (no `v`: three puzzles), 2 (`v: 2`: five puzzles, 1,500 points), 3 (`v: 3`:
 *  five short puzzles, 1,000 points) or 4 (`v: 4`: three short puzzles from `t`, 600 points). 1 for null (and for an
 *  unknown `v`). */
export const dayVersion = (day = DAY) => !day ? 1 : day.v === 4 ? 4 : day.v === 3 ? 3 : day.v === 2 ? 2 : 1;
/** True on five-puzzle days (v2 AND v3): the day has Silhouettes and a Journey. False on v4 days (three puzzles: ask
 *  hasStep('sil') / hasStep('jr')). Use dayVersion() for anything that depends on the point scale or the item counts. */
export const isV2 = (day = DAY) => { const v = dayVersion(day); return v === 2 || v === 3; };
// The short formats (v3 and v4 days): 1-2 items per puzzle, a 1 x 2 grid, the v3 points and prompts.
const isShort = day => dayVersion(day) >= 3;
/** True on short-daily days: v3, and v4 (whose puzzles are exactly the v3 short formats: 1 x 2 grid, v3 points). */
export const isV3 = (day = DAY) => isShort(day);
/** True on v4 (three-puzzle) days only. */
export const isV4 = (day = DAY) => dayVersion(day) === 4;
/** Most points a day can score: 1,000 (v1, v3), 1,500 (v2), 600 (v4: its three steps at 200). */
export const maxPts = (day = DAY) => dayVersion(day) === 4 ? stepsFor(day).reduce((t, s) => t + s.max, 0) : dayVersion(day) === 2 ? 1500 : 1000;
/** Points per item for a day: {col, grid, who, sil, jr: [guess 1, 2, 3]} (see PTS). Shared objects: never mutate. */
export const ptsTable = (day = DAY) => isShort(day) ? PTS_V3 : PTS_V2;
/** Prompt copy for a day: {col, who, grid, sil, jr}. v1/v2 days share one fixed set; a v3 or v4 day's grid line only
 *  explains franchise history when one of its squares is the Titans (memoized per day entry, frozen). */
export function promptsFor(day = DAY) {
  if (!isShort(day)) return PROMPTS_V2;
  let p = PROMPTS_BY_DAY.get(day);
  if (!p) {
    const s = gridShape(day);
    const titans = [...s.rows, ...s.cols].some(c => critKind(c) === 't' && !!PZ && /Titans/.test(PZ.teams[+String(c).split(':')[1]] || ''));
    p = Object.freeze(Object.assign({}, PROMPTS_V3, {grid: titans ? PROMPTS_V3.grid : PROMPTS_V3.grid.replace(/ Franchise history counts.*$/, '')}));
    PROMPTS_BY_DAY.set(day, p);
  }
  return p;
}
const PROMPTS_BY_DAY = new WeakMap();
/** Mystery points when solved on clue `clues` (1-7): v1/v2 (8 - clues) x 50 (350 ... 50), v3/v4 200 ... 20. */
export const whoWorth = (clues, day = DAY) => isShort(day) ? WHO_V3[Math.min(7, Math.max(1, Math.floor(clues) || 1)) - 1] : (8 - clues) * PTS_V2.who;
/** Number of College players on a day (5 on v1/v2 days, 2 on v3/v4 days; 5 when unknown). */
export const colCount = (day = DAY) => (day && Array.isArray(day.c)) ? day.c.length : 5;

// Grid shape: v1/v2 days are 3 x 3 (rows g[0..2], columns g[3..5]); v3 and v4 days are 1 x 2 (row g[0], columns
// g[1..]; a v4 day without the Grid has no g: 0 x 0).
// Squares are numbered row-major: square k is rows[floor(k / cols.length)] x cols[k % cols.length].
const SHAPES = new WeakMap();
const NO_SHAPE = Object.freeze({rows: Object.freeze([]), cols: Object.freeze([]), n: 0});
/** {rows: [criterion], cols: [criterion], n: squares} for a day ({rows: [], cols: [], n: 0} for null). Memoized per
 *  day entry and frozen. */
export function gridShape(day = DAY) {
  if (!day || typeof day !== 'object') return NO_SHAPE;
  let s = SHAPES.get(day);
  if (!s) {
    const g = Array.isArray(day.g) ? day.g : [];
    const v3 = isShort(day);
    const rows = Object.freeze(v3 ? g.slice(0, 1) : g.slice(0, 3)), cols = Object.freeze(v3 ? g.slice(1) : g.slice(3, 6));
    s = Object.freeze({rows, cols, n: rows.length * cols.length});
    SHAPES.set(day, s);
  }
  return s;
}
/** Square k of a day's grid: {k, r, c, row, col} (r / c are row and column indexes, row / col their criteria), or
 *  null when k is not a square of that grid. */
export function gridSquare(k, day = DAY) {
  const s = gridShape(day);
  k = typeof k === 'number' ? k : Number(k);
  if (!Number.isInteger(k) || k < 0 || k >= s.n) return null;
  const r = Math.floor(k / s.cols.length), c = k % s.cols.length;
  return {k, r, c, row: s.rows[r], col: s.cols[c]};
}

export const gridDone = (ds = DS) => ds.grid.over || ds.grid.cells.every(Boolean);
export const gridScore = (ds = DS) => ds.grid.cells.filter(c => c && c.ok).length;
export const colDone = (ds = DS, day = DAY) => ds.col.a.length >= colCount(day);
export const colScore = (ds = DS, day = DAY) => ds.col.a.filter((a, r) => a === day.c[r][2]).length;
export const whoDone = (ds = DS) => ds.who.done;
export const ptsCol = (ds = DS, day = DAY) => colScore(ds, day) * ptsTable(day).col;
export const ptsWho = (ds = DS, day = DAY) => ds.who.won ? whoWorth(ds.who.clues, day) : 0;
export const ptsGrid = (ds = DS, day = DAY) => gridScore(ds) * ptsTable(day).grid;

// Silhouettes (v2/v3): DS.sil.a holds the option position picked per round (0-3; -1 = locked in unanswered).
const silA = ds => (ds && ds.sil && Array.isArray(ds.sil.a)) ? ds.sil.a : [];
export const silRounds = (day = DAY) => (day && Array.isArray(day.s)) ? day.s.length : 5;
export const silDone = (ds = DS, day = DAY) => silA(ds).length >= silRounds(day);
export const silScore = (ds = DS, day = DAY) => silA(ds).filter((a, r) => !!(day && day.s && day.s[r]) && a === day.s[r].a).length;
export const ptsSil = (ds = DS, day = DAY) => silScore(ds, day) * ptsTable(day).sil;

// Journey (v2/v3): DS.jr = {g: [wrong guesses, like who.g], done, won}. Solved on guess g.length + 1.
const JR0 = {g: [], done: false, won: false};
const jrOf = ds => (ds && ds.jr && Array.isArray(ds.jr.g)) ? ds.jr : JR0;
export const jrDone = (ds = DS) => !!jrOf(ds).done;
/** Guess number (1-3) the Journey was solved on, 0 when missed or unsolved. */
export const jrGuessNo = (ds = DS) => { const j = jrOf(ds); return j.won ? Math.min(j.g.length + 1, 3) : 0; };
export const ptsJr = (ds = DS, day = DAY) => { const n = jrGuessNo(ds); return n ? ptsTable(day).jr[n - 1] : 0; };

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
// v3 (short daily): 200 points a step. Results follow the day's counts: '1 of 2', '2 of 2', 'Clue 3 of 7',
// 'Guess 1 of 3', '1 of 2'.
const V3_STEPS = [
  Object.assign({}, V1_STEPS[0], {max: 200, result: (ds = DS, day = DAY) => `${colScore(ds, day)} of ${colCount(day)}`}),
  Object.assign({}, V2_STEPS[1], {max: 200}),
  Object.assign({}, V1_STEPS[1], {max: 200}),
  Object.assign({}, V2_STEPS[3], {max: 200}),
  Object.assign({}, V1_STEPS[2], {max: 200, result: (ds = DS, day = DAY) => `${gridScore(ds)} of ${gridShape(day).n}`})
];
const V1_SLUGS = ['college', 'mystery', 'grid'];
const V2_SLUGS = ['college', 'silhouette', 'mystery', 'journey', 'grid'];
// v4 (three puzzles): the v3 steps (same objects: formats, 200 points each, results) whose ids are in the day's `t`, in
// the canonical order col, sil, who, jr, grid whatever order `t` lists them in (unknown ids and repeats are ignored).
// Memoized per day entry and frozen, so stepsFor(day) === stepsFor(day) and STEPS === stepsFor(DAY).
const V4_SETS = new WeakMap();
function v4Set(day) {
  let s = V4_SETS.get(day);
  if (!s) {
    const t = Array.isArray(day.t) ? day.t : [];
    const steps = V3_STEPS.filter(x => t.includes(x.id));
    s = {steps: Object.freeze(steps), slugs: Object.freeze(steps.map(x => V2_SLUGS[V3_STEPS.indexOf(x)]))};
    V4_SETS.set(day, s);
  }
  return s;
}
/** The step list (v1: 3 steps, v2 and v3: 5, v4: the day's 3) for a day entry. The arrays are shared: never mutate
 *  them. */
export const stepsFor = (day = DAY) => { const v = dayVersion(day); return v === 4 ? v4Set(day).steps : v === 3 ? V3_STEPS : v === 2 ? V2_STEPS : V1_STEPS; };
/** Route slugs in step order for a day entry (v2 and v3 days share the five slugs; a v4 day has its three:
 *  'college' | 'silhouette' | 'mystery' | 'journey' | 'grid'). */
export const slugsFor = (day = DAY) => dayVersion(day) === 4 ? v4Set(day).slugs : isV2(day) ? V2_SLUGS : V1_SLUGS;
/** True when the day plays the step `id` ('col' | 'sil' | 'who' | 'jr' | 'grid'): v1 days col, who, grid; v2/v3 days
 *  all five; v4 days the three in `t`. */
export const hasStep = (id, day = DAY) => stepsFor(day).some(s => s.id === id);

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
// answered, j is not a valid option index, or the day has no College (a v4 day without it).
export function colPick(j) {
  j = toInt(j);
  const row = DS.col.a.length;
  if (!DAY || !hasStep('col') || row >= DAY.c.length) return null;
  if (!Number.isInteger(j) || j < 0 || j >= DAY.c[row][1].length) return null;
  DS.col.a.push(j);
  const ans = DAY.c[row][2];
  const out = {row, correct: j === ans, ans};
  changed('colPick', out);
  return out;
}

// Mystery: show the next clue (only while unsolved and clues < 7, on a day with the Mystery). Returns true when a
// clue was added.
export function whoNextClue() {
  if (!hasStep('who') || DS.who.done || DS.who.clues >= 7) return false;
  DS.who.clues++;
  changed('whoNextClue', {clues: DS.who.clues});
  return true;
}

// Mystery: guess player i. Returns 'win' | 'dup' | 'wrong' | 'stumped' (null when already finished,
// i is not a player index, or the day has no Mystery).
export function whoGuess(i) {
  i = toInt(i);
  if (!Number.isInteger(i) || !PP[i] || !hasStep('who')) return null;
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

// Grid: guess player i for square k (row-major over gridShape(): 0-8 on v1/v2 days, 0-1 on v3/v4 days; none on a v4
// day without the Grid). Returns 'dup' | 'ok' | 'no' ('dup' does not mutate; null when the square is taken, the grid
// is over, or k/i are invalid).
export function gridGuess(k, i) {
  k = toInt(k); i = toInt(i);
  if (!Number.isInteger(k) || !Number.isInteger(i) || !PP[i]) return null;
  const sq = gridSquare(k);
  if (!sq || gridDone() || DS.grid.cells[k]) return null;
  const r = sq.row, c = sq.col;
  if (DS.grid.cells.some(x => x && x.p === i)) return 'dup';
  const ok = critOk(r, PP[i]) && critOk(c, PP[i]);
  DS.grid.cells[k] = {p: i, ok};
  const result = ok ? 'ok' : 'no';
  changed('gridGuess', {result, k, i});
  return result;
}

// Ends the grid (nothing on a day without the Grid).
export function gridGiveUp() {
  if (!hasStep('grid')) return;
  DS.grid.over = true;
  changed('gridGiveUp');
}

// Silhouettes (v2/v3 days, v4 days with them): answer round `round` (0 to rounds - 1, in order: round must equal
// DS.sil.a.length) with option position j (0-3). Returns {round, correct, ans, p} (ans = the right option position,
// p = the answer's player index), or null on a day without Silhouettes (v1), when the round is out of order, already
// answered or out of range, or j is not an option position.
export function silPick(round, j) {
  round = toInt(round); j = toInt(j);
  if (!hasStep('sil') || !Array.isArray(DAY.s) || !Number.isInteger(round) || !Number.isInteger(j)) return null;
  const a = DS.sil.a, S = DAY.s;
  if (round !== a.length || round < 0 || round >= S.length) return null;
  if (j < 0 || j >= S[round].o.length) return null;
  a.push(j);
  const ans = S[round].a;
  const out = {round, correct: j === ans, ans, p: S[round].p};
  changed('silPick', out);
  return out;
}

// Journey (v2/v3 days, v4 days with it): guess player i. Returns 'win' | 'dup' | 'wrong' | 'lost' (lost = the
// third wrong guess), or null on a day without a Journey (v1), when already finished, or i is not a player index.
// Wrong guesses are kept in DS.jr.g (like DS.who.g); 'dup' (a player already guessed) does not mutate.
export function journeyGuess(i) {
  i = toInt(i);
  if (!hasStep('jr') || !DAY.j || !Number.isInteger(i) || !PP[i]) return null;
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
/** Both Journey hints for a day, earned or not: [['Position', 'Running back'], ['Draft', '2022, round 2' | 'Undrafted']].
 *  [] on a day without a Journey. */
export function journeyClues(day = DAY) {
  if (!hasStep('jr', day) || !day.j || !PP[day.j.p]) return [];
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
 *  'Chiefs'] (career order), current: 'Chiefs' (last team, null when none)}. null on a day without a Journey (v1). */
export function journeyPath(day = DAY) {
  if (!hasStep('jr', day) || !day.j) return null;
  const colleges = Array.isArray(day.j.col) ? day.j.col.slice() : [];
  const teams = [...String(day.j.t || '')].map(c => PZ.teams[TA.indexOf(c)]).filter(Boolean);
  return {colleges, teams, current: teams.length ? teams[teams.length - 1] : null};
}

// Locks in the score as it is. The caller then runs maybeAutoPost() (the old flow).
// Ends every step the day plays: the grid is over, unanswered College players (and, on v2/v3 days and v4 days with
// them, silhouette rounds) become -1 (wrong), the Mystery (and the Journey) end unsolved. A v4 day's other parts are
// left alone (v1 days: the old lockIn exactly).
export function lockIn() {
  if (hasStep('grid')) DS.grid.over = true;
  if (hasStep('col')) while (DS.col.a.length < colCount()) DS.col.a.push(-1);
  if (hasStep('who') && !DS.who.done) { DS.who.done = true; DS.who.won = false; }
  if (hasStep('sil')) while (DS.sil.a.length < silRounds()) DS.sil.a.push(-1);
  if (hasStep('jr') && !DS.jr.done) { DS.jr.done = true; DS.jr.won = false; }
  changed('lockIn');
}

// ---------------------------------------------------------------------------
// League leaderboard (Firebase Firestore, one document per player, anonymous sign-in)
export const LB = {save: null, uid: null, players: [], names: {}, ready: false, off: false, status: '', posting: false, mode: 'today', dev: DEV_NO_POST};
try { LB.nick = localStorage.getItem('gg-nick') || ''; } catch (_) { LB.nick = ''; }

function lbChanged(why, prev) { emit('lb', {prev: prev || LB.players, why}); }

// Scoring starts on puzzle day 4 (Thu Oct 1 2026, re-released with a new puzzle): the league reset the board there
// (it was day 3, Sep 30, before), so earlier days' scores and the old Oct 1 puzzle's never count on the boards, in
// totals, in streaks or on this phone's streak. Every board doc is read through scoredDoc(): days before SCORE_FROM,
// and entries of a re-released day without its release stamp, are dropped and total / played / last are recomputed
// from the rest. Older docs keep those days in Firestore until that player posts again (postScore writes the
// filtered days back).
export const SCORE_FROM = 4;
export function scoredDoc(p) {
  const days = {};
  Object.keys((p && p.days) || {}).forEach(k => {
    const e = p.days[k];
    if (Number(k) >= SCORE_FROM && e && (e.r || 0) === relOf(Number(k))) days[k] = e;
  });
  const vals = Object.values(days), keys = Object.keys(days).map(Number);
  return Object.assign({}, p, {days, total: vals.reduce((s, d) => s + (Number(d.p) || 0), 0), played: vals.length, last: keys.length ? Math.max(...keys) : 0});
}

// Board rows taken off the leaderboard (players/{uid} doc ids): duplicates from a second phone. The rules only let a
// phone delete its own row, so the league hides them here; the doc can also be deleted in the Firebase console.
const HIDDEN = new Set([
  'xCgRRWXbr6gmvj8hXsZDSpPC2Ug1', // Mitch's second row (250, Sep 30): his 350 row stays
  'Hf23Et9J6rhZbYrHiMfWVJeLDI53'  // Mason's second phone (440, Oct 1, played after his 210): the 210 stands
]);

// One score per member per day: a member who plays again on another phone (a second board row under their name)
// gets nothing for it. Per member (managerFor) and day, the first entry posted counts (entries carry `t`, the
// phone's clock when posted; older entries without one count as earliest) and later ones are dropped from their
// rows (totals recomputed). This phone also never posts a day its member already has from another phone
// (maybeAutoPost: LB.status 'dupe').
export function onePerMember(players) {
  const best = new Map(); // 'manager|day' -> {id, t}
  players.forEach(p => {
    const m = managerFor(p);
    if (!m) return;
    Object.keys(p.days || {}).forEach(k => {
      const t = Number(p.days[k] && p.days[k].t) || 0, key = m + '|' + k, b = best.get(key);
      if (!b || t < b.t || (t === b.t && String(p.id) < String(b.id))) best.set(key, {id: p.id, t});
    });
  });
  return players.map(p => {
    const m = managerFor(p);
    if (!m) return p;
    const drop = Object.keys(p.days || {}).filter(k => best.get(m + '|' + k).id !== p.id);
    if (!drop.length) return p;
    const days = Object.assign({}, p.days);
    drop.forEach(k => { delete days[k]; });
    return scoredDoc(Object.assign({}, p, {days}));
  });
}
// Another phone's row already holds today's score for this phone's member (so this one never posts).
function dupeAt(list) {
  const me = list.find(p => p.id === LB.uid);
  const m = me ? managerFor(me) : (dataMe() || managerOfNick(LB.nick));
  if (!m) return false;
  return list.some(p => p.id !== LB.uid && managerFor(p) === m && !!entryFor(p));
}
export const dupeToday = () => !!LB.ready && dupeAt(LB.raw || LB.players);

let fbStarted = false;
// The app, anonymous sign-in and Firestore come from the shared layer (fire.js); no config or a failed
// import / sign-in turns the board off, exactly as before.
async function startFirebase() {
  if (fbStarted) return;
  fbStarted = true;
  try {
    const {fs, db, uid} = await getFire();
    LB.uid = uid;
    if (canWrite()) LB.save = body => fs.setDoc(fs.doc(db, 'players', LB.uid), body);
    fs.onSnapshot(fs.collection(db, 'players'), snap => {
      const prev = LB.players;
      const all = snap.docs.map(d => scoredDoc(Object.assign({id: d.id}, d.data())));
      LB.raw = all.filter(p => !HIDDEN.has(p.id));
      LB.players = onePerMember(LB.raw);
      LB.ready = true;
      const mine = all.find(p => p.id === LB.uid);
      if (mine && mine.nick) LB.nick = mine.nick;
      if (entryFor(mine)) DS.posted = true;
      lbChanged('snapshot', prev);
      maybeAutoPost();
    }, err => { LB.err = err.code; LB.ready = true; lbChanged('error'); });
  } catch (_) { LB.off = true; LB.ready = true; lbChanged('off'); }
}

export const displayName = p => (p.nick || 'Someone');

/** Format of a board day entry: 4 (carries v: 4), 3 (carries v: 3), 2 (carries s, no v), 1 (neither: {p, g, c, w});
 *  0 for none. */
export const entryVersion = d => !d ? 0 : d.v === 4 ? 4 : d.v === 3 ? 3 : d.s != null ? 2 : 1;

// A player's posted entry for puzzle day pnum, or null. On a v2, v3 or v4 day an entry counts only when its format
// matches the day's version: one without the v2 fields was posted for the day's earlier three-puzzle version
// (Sep 29 2026 was re-released mid-day), so it no longer counts as played that day, and posting the new score
// replaces it. v1 days take any entry, as before.
// `day` (default: puzzle day pnum's entry) is the day the entry is judged against.
export function entryFor(p, pnum = PNUM, day = PZ ? PZ.days[(pnum - 1) % PZ.days.length] : null) {
  const d = p && p.days && p.days[pnum];
  if (!d || (d.r || 0) !== relOf(pnum)) return null;
  const v = dayVersion(day);
  return v >= 2 && entryVersion(d) !== v ? null : d;
}

/** The board day entry postScore() writes for a DS on a day: v1 {p, g, c, w}; v2 {p, g, c, w, j, s};
 *  v3 {v: 3, p, c, s, w, j, g}; v4 {v: 4, p, ...} with only the fields of the day's three steps, in the v3 order
 *  (e.g. {v: 4, p, c, s, w} or {v: 4, p, w, j, g}). c / s / g = College players, faces and grid squares right; w = the
 *  Mystery clue it was solved on (0 = stumped); j = the Journey guess it was solved on (0 = missed). */
export function boardEntry(ds = DS, day = DAY) {
  const w = ds.who.won ? ds.who.clues : 0;
  if (dayVersion(day) === 4) {
    const e = {v: 4, p: totalPts(ds, day)}, has = id => hasStep(id, day);
    if (has('col')) e.c = colScore(ds, day);
    if (has('sil')) e.s = silScore(ds, day);
    if (has('who')) e.w = w;
    if (has('jr')) e.j = jrGuessNo(ds);
    if (has('grid')) e.g = gridScore(ds);
    return e;
  }
  if (dayVersion(day) === 3) return {v: 3, p: totalPts(ds, day), c: colScore(ds, day), s: silScore(ds, day), w, j: jrGuessNo(ds), g: gridScore(ds)};
  const e = {p: totalPts(ds, day), g: gridScore(ds), c: colScore(ds, day), w};
  if (isV2(day)) { e.j = jrGuessNo(ds); e.s = silScore(ds, day); } // Journey guess no (0 = missed), faces right
  return e;
}

// Posting is automatic (there is no Post button): a finished day posts once the board has loaded (so the post keeps
// the days already on your doc), under your leaderboard name: the nick, else the member picked on the welcome
// screen. A failed post retries by itself when the phone comes back online, when the app is shown again, and on a
// backoff timer (15 s, doubling to 5 min).
let retryT = 0, retryMs = 0;
function postName() {
  if (LB.nick) return LB.nick;
  const m = dataMe();
  return m ? dataName(m) : '';
}
function scheduleRetry() {
  clearTimeout(retryT);
  retryMs = Math.min(retryMs ? retryMs * 2 : 15000, 300000);
  retryT = setTimeout(maybeAutoPost, retryMs);
}
try {
  addEventListener('online', () => maybeAutoPost());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') maybeAutoPost(); });
} catch (_) {}

export function maybeAutoPost() {
  if (!allDone() || DS.posted || !LB.save || !LB.ready || LB.posting || LB.status === 'denied' || LB.status === 'full') return;
  // Already on the board today from another of this member's phones: the first score stands.
  if (dupeAt(LB.raw || LB.players)) { if (LB.status !== 'dupe') { LB.status = 'dupe'; lbChanged('status'); } return; }
  postScore(postName());
}

export async function postScore(nick) {
  if (!LB.save || LB.posting) return;
  LB.posting = true; LB.status = 'posting'; lbChanged('status');
  const me = LB.players.find(p => p.id === LB.uid);
  const days = Object.assign({}, me && me.days);
  if (!entryFor(me)) days[PNUM] = Object.assign(boardEntry(), relOf(PNUM) ? {r: relOf(PNUM)} : null, {t: Date.now()});
  const vals = Object.values(days);
  const body = {nick: (nick || '').trim().slice(0, 24), days, total: vals.reduce((s, d) => s + (d.p || 0), 0), played: vals.length, last: PNUM};
  try {
    await LB.save(body);
    DS.posted = true; saveDS(); LB.status = 'posted'; LB.nick = body.nick;
    try { localStorage.setItem('gg-nick', body.nick); } catch (_) {}
    clearTimeout(retryT); retryMs = 0;
  } catch (e) {
    LB.status = e && e.code === 'permission-denied' ? 'denied' : e && e.code === 'resource-exhausted' ? 'full' : 'failed';
    if (LB.status === 'failed') scheduleRetry();
  }
  LB.posting = false; lbChanged('status');
}

// ---------------------------------------------------------------------------
// Share
// v1 days: the exact old text. v2 days add a "Faces" line after College and a "Journey" line after Mystery.
// v3 days: the v2 lines with two squares each for College and Faces, and the grid's squares on one "Grid" line.
// v4 days: the v3 lines of the day's three steps only, in step order (a step's line once it is done).
export function shareText(ds = DS, day = DAY) {
  const leagueName = DATA && DATA.league ? DATA.league.name : 'Gridiron Gangbang';
  const ver = dayVersion(day), v2 = ver >= 2;
  const sq = c => c && c.ok ? '🟩' : '🟥';
  // The header date is today's (a dev ?day= preview shows the previewed puzzle day's date instead).
  const when = devDay && PZ ? dateOf(PNUM) : new Date();
  const lines = [`${leagueName} daily, ${when.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}: ${nf(totalPts(ds, day))} pts`];
  if (ver === 4) {
    const line = {
      col: () => 'College ' + ds.col.a.map((a, r) => day.c[r] && a === day.c[r][2] ? '🟩' : '🟥').join(''),
      sil: () => 'Faces ' + silA(ds).map((a, r) => day.s[r] && a === day.s[r].a ? '🟩' : '🟥').join(''),
      who: () => ds.who.won ? `Mystery player: clue ${ds.who.clues} of 7` : 'Mystery player: stumped',
      jr: () => jrGuessNo(ds) ? `Journey: guess ${jrGuessNo(ds)} of 3` : 'Journey: missed',
      grid: () => 'Grid ' + ds.grid.cells.slice(0, gridShape(day).n).map(sq).join('')
    };
    stepsFor(day).forEach(s => { if (s.done(ds, day)) lines.push(line[s.id]()); });
    return lines.join('\n');
  }
  if (colDone(ds, day)) lines.push('College ' + ds.col.a.map((a, r) => a === day.c[r][2] ? '🟩' : '🟥').join(''));
  if (v2 && silDone(ds, day)) lines.push('Faces ' + silA(ds).map((a, r) => day.s[r] && a === day.s[r].a ? '🟩' : '🟥').join(''));
  if (whoDone(ds)) lines.push(ds.who.won ? `Mystery player: clue ${ds.who.clues} of 7` : 'Mystery player: stumped');
  if (v2 && jrDone(ds)) lines.push(jrGuessNo(ds) ? `Journey: guess ${jrGuessNo(ds)} of 3` : 'Journey: missed');
  if (gridDone(ds)) {
    if (ver === 3) lines.push('Grid ' + ds.grid.cells.slice(0, gridShape(day).n).map(sq).join(''));
    else { lines.push(`Grid ${gridScore(ds)}/9`); for (let r = 0; r < 3; r++) lines.push(ds.grid.cells.slice(r * 3, r * 3 + 3).map(sq).join('')); }
  }
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
// (they carry s and/or j): the five parts in play order. v3 entries (v: 3): the same five parts out of the day's
// counts: 'College 1/2, faces 2/2, ID on clue 3, path on guess 1, grid 1/2'. v4 entries (v: 4): the parts of the
// day's three steps only, the first one capitalized: 'College 1/2, faces 2/2, ID on clue 3',
// 'Faces 2/2, ID on clue 3, path on guess 2', 'No ID, path on guess 2, grid 1/2' (the entry's own fields when the day
// is not a v4 day).
function daySub(d, day) {
  const id = d.w ? 'ID on clue ' + d.w : 'no ID';
  if (d.v === 4) {
    const F = {col: 'c', sil: 's', who: 'w', jr: 'j', grid: 'g'};
    const ids = dayVersion(day) === 4 ? stepsFor(day).map(s => s.id) : V3_STEPS.map(s => s.id).filter(k => d[F[k]] != null);
    const nc = day && Array.isArray(day.c) ? day.c.length : 2, ns = day && Array.isArray(day.s) ? day.s.length : 2;
    const ng = day && gridShape(day).n || 2;
    const part = {col: () => `College ${d.c || 0}/${nc}`, sil: () => `faces ${d.s || 0}/${ns}`, who: () => id,
      jr: () => d.j ? 'path on guess ' + d.j : 'no path', grid: () => `grid ${d.g || 0}/${ng}`};
    const s = ids.map(k => part[k]()).join(', ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (d.v === 3) {
    const nc = day && Array.isArray(day.c) ? day.c.length : 2, ns = day && Array.isArray(day.s) ? day.s.length : 2;
    const ng = day && gridShape(day).n || 2;
    return `College ${d.c}/${nc}, faces ${d.s || 0}/${ns}, ${id}, ${d.j ? 'path on guess ' + d.j : 'no path'}, grid ${d.g}/${ng}`;
  }
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
// players defaults to LB.players (pass a list to compute rows for something else); pnum defaults to today; day (today's
// mode only) defaults to puzzle day pnum's entry.
export function boardRows(mode = LB.mode, players = LB.players, pnum = PNUM, day = dayFor(pnum)) {
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
      const d = entryFor(p, pnum, day);
      return d ? {id: p.id, name: displayName(p), pts: d.p, sub: daySub(d, day)} : null;
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

// Points for a saved day (DS-shaped object) on puzzle day pnum, or null before puzzles load. On a v3 or v4 day only
// progress stamped with that version (v: 3, v: 4) counts (as when it is loaded: anything else scores 0).
export function pointsFor(ds, pnum = PNUM) {
  if (!PZ) return null;
  const day = PZ.days[(pnum - 1) % PZ.days.length];
  if ((dayVersion(day) >= 3 || relOf(pnum)) && !stampOk(ds, day, pnum)) ds = {};
  return totalPts(freshDS(ds, day), day);
}

// Streak from this phone's saved days (localStorage gg-daily-N). A day counts when every step of that
// day's version is done (3, 5, 5 or the v4 day's 3); it is perfect when its points equal that day's maxPts (1,000,
// 1,500, 1,000 or 600). On v3 and v4 days only progress stamped with the day's version counts. Days before
// SCORE_FROM never count.
export function streakLocal() {
  const done = new Set(), perfect = new Set();
  const consider = (n, ds) => {
    if (!(n >= SCORE_FROM && n <= PNUM)) return;
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
      if (!raw || typeof raw !== 'object') continue;
      const day = PZ ? dayFor(+m[1]) : null;
      if ((dayVersion(day) >= 3 || relOf(+m[1])) && !stampOk(raw, day, +m[1])) continue;
      consider(+m[1], freshDS(raw, day));
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
// 45% STARTER, 25% PRACTICE SQUAD. max defaults to today's maxPts() (1,000 on v1 days, so the v1 ladder is unchanged; 600 on v4 days).
// Display only. Used as an array callback (arr.map(gradeFor)) the index is ignored.
export function gradeFor(total, max) {
  const t = Number(total) || 0;
  let m = Number(max);
  if (!(m > 0) || arguments.length > 2) m = maxPts();
  const at = x => t * 1000 >= x * m; // t / m >= x / 1000, exact in integers
  return at(1000) ? 'PERFECT DAY' : at(850) ? 'ALL-PRO' : at(650) ? 'PRO BOWL' : at(450) ? 'STARTER' : at(250) ? 'PRACTICE SQUAD' : 'CUT DAY';
}

// DEEP CUT: player i is a valid answer for the square, its fame is at or below the 25th
// percentile of all valid answers for that square, and the square has at least 8 valid answers.
// r and c are criteria strings (e.g. 't:5'), or row/column indexes into today's gridShape() (rows and columns
// 0-2 on v1/v2 days; row 0 and columns 0-1 on v3/v4 days).
const deepCache = new Map();
const squareCrit = (r, c) => {
  if (typeof r !== 'number' && typeof c !== 'number') return [r, c];
  const s = gridShape();
  return [typeof r === 'number' ? s.rows[r] : r, typeof c === 'number' ? s.cols[c] : c];
};
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
/** Computes today's DEEP CUT cutoffs (every square of gridShape(): nine on v1/v2 days, two on v3/v4 days), one square
 *  per idle callback, then calls done(). ensure() runs it at idle, so render-time deepCut() calls are normally free. */
export function warmDeepCuts(done) {
  if (!PZ || !DAY) { if (done) done(); return; }
  const day = DAY, todo = [], sq = k => gridSquare(k, day);
  for (let k = 0; k < gridShape(day).n; k++) if (!deepReady(sq(k).r, sq(k).c)) todo.push(k);
  const step = () => {
    if (DAY !== day) return;
    const k = todo.shift();
    if (k == null) { if (done) done(); return; }
    const [R, C] = squareCrit(sq(k).r, sq(k).c);
    deepCutoff(R, C);
    idle(step);
  };
  if (!todo.length) { if (done) done(); return; }
  idle(step);
}

// Debug only (never called by the app): emit a synthetic event, e.g.
// daily.__dev.emit('lb', {prev: daily.LB.players, why: 'snapshot'}) after editing LB.players in the console.
// __dev.scratch(day, ds, fn) runs fn() synchronously with DAY/DS/STEPS/SLUGS/PTS/PROMPTS swapped for a scratch
// day and DS (freshDS-normalized for that day), with saving and 'progress' events muted, then restores everything;
// returns fn's result. For core checks (actions on crafted v2 / v3 / v4 days) only.
export const __dev = {
  emit: (type, detail) => emit(type, detail),
  devDayFrom,
  freshDS: (raw, day) => freshDS(raw, day),
  scratch(day, ds, fn) {
    const keep = {DAY, DS, STEPS, SLUGS, PTS, PROMPTS, muted};
    DAY = day; DS = freshDS(ds, day); STEPS = stepsFor(day); SLUGS = slugsFor(day); PTS = ptsTable(day); PROMPTS = promptsFor(day); muted = true;
    try { return fn(DS); } finally { DAY = keep.DAY; DS = keep.DS; STEPS = keep.STEPS; SLUGS = keep.SLUGS; PTS = keep.PTS; PROMPTS = keep.PROMPTS; muted = keep.muted; }
  },
  // The saved-progress rule for a crafted day (the stamp check + freshDS) without localStorage: for the core checks.
  loadDS: (raw, day) => loadDS(raw, day)
};
