// The Daily: puzzles, saved progress, scoring, share text and the Firebase league board.
// Logic moved unchanged from the old single-file app. No DOM rendering here.
// Owner: foundation (core).

import {DATA, nf, norm, me as dataMe} from './data.js';

export {nf, norm};

// ---------------------------------------------------------------------------
// Constants (unchanged)
export const TA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
export const POSN = {QB:'Quarterback', RB:'Running back', WR:'Wide receiver', TE:'Tight end', OL:'Offensive lineman', DL:'Defensive lineman', LB:'Linebacker', DB:'Defensive back', K:'Kicker', P:'Punter', LS:'Long snapper', ST:'Special teams'};
export const SK = ['pass_yards','pass_tds','pass_ints','rush_yards','rush_tds','receptions','rec_yards','rec_tds','def_sacks','def_ints','games'];
export const SL = {pass_yards:'passing yards', pass_tds:'touchdown passes', rush_yards:'rushing yards', rush_tds:'rushing touchdowns', receptions:'catches', rec_yards:'receiving yards', rec_tds:'touchdown catches', def_sacks:'sacks', def_ints:'interceptions'};
export const PTS = {col: 40, grid: 50, who: 50};
export const PROMPTS = {
  col: 'Pick the college each player was drafted out of. 40 points each.',
  who: 'Name the player. Each wrong guess or skipped clue shows another one. Fewer clues means more points.',
  grid: 'Name a player who fits each row and column. One guess per square, 50 points each. Franchise history counts, so a Houston Oilers season counts for the Titans.'
};

// Local development never writes to the real league board unless the URL has ?post=1 (exactly).
// "Local" covers loopback, *.localhost / *.test / *.local names, and private LAN addresses
// (a phone on the same Wi-Fi reaching the dev server by IP). Production (github.io) is unaffected.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
export const isDevHost = h => LOCAL_HOSTS.includes(h)
  || /\.(localhost|test|local)$/.test(h)
  || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(h);
let postParam = false;
try { postParam = new URLSearchParams(location.search).get('post') === '1'; } catch (_) {}
export const DEV_NO_POST = isDevHost(location.hostname) && !postParam;

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
  return ds;
}

function readDS(key) {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { raw = {}; }
  return freshDS(raw);
}

export function saveDS() { try { localStorage.setItem(SKEY, JSON.stringify(DS)); } catch (_) {} }

function initDay(pz) {
  PZ = pz;
  PP = PZ.P;
  dayIndex = indexFor(PZ.start, new Date());
  PNUM = dayIndex + 1;
  DAY = PZ.days[dayIndex % PZ.days.length];
  TODAY_LABEL = new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
  SKEY = 'gg-daily-' + PNUM;
  DS = readDS(SKEY);
  seenIndex = dayIndex;
  deepCache.clear();
  NW = null; // the search index belongs to this PP
}

// Date (local midnight) of a puzzle day number: PZ.start + (pnum - 1) days.
export function dateOf(pnum) {
  const [y, m, d] = PZ.start.split('-').map(Number);
  return new Date(y, m - 1, d + (pnum - 1));
}

let seenIndex = null;
// Recomputes the local day index; emits 'newday' (once per change) when it moved on.
export function checkDay() {
  if (!PZ) return false;
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
export function searchPlayers(q) {
  if (!PZ) return []; // puzzles not loaded yet: never build an index over the empty PP
  const t = norm(q).split(' ').filter(Boolean);
  if (!t.length) return [];
  buildIndexSync();
  const out = [];
  for (let i = 0; i < PP.length; i++) {
    const w = NW[i];
    if (t.every(tok => w.some(x => x.startsWith(tok)))) out.push(i);
  }
  out.sort((a, b) => PP[b][7] - PP[a][7]);
  return out.slice(0, 8);
}

export function exampleFor(r, c, exclude) {
  let best = -1;
  for (let i = 0; i < PP.length; i++) {
    if (exclude.has(i)) continue;
    const p = PP[i];
    if (critOk(r, p) && critOk(c, p) && (best < 0 || p[7] > PP[best][7])) best = i;
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
// Scoring: 1,000 points a day. Every function reads the live DS/DAY by default;
// pass a DS-shaped object (and a day) to score something else without touching state.
export const gridDone = (ds = DS) => ds.grid.over || ds.grid.cells.every(Boolean);
export const gridScore = (ds = DS) => ds.grid.cells.filter(c => c && c.ok).length;
export const colDone = (ds = DS) => ds.col.a.length >= 5;
export const colScore = (ds = DS, day = DAY) => ds.col.a.filter((a, r) => a === day.c[r][2]).length;
export const whoDone = (ds = DS) => ds.who.done;
export const ptsCol = (ds = DS, day = DAY) => colScore(ds, day) * PTS.col;
export const ptsWho = (ds = DS) => ds.who.won ? (8 - ds.who.clues) * PTS.who : 0;
export const ptsGrid = (ds = DS) => gridScore(ds) * PTS.grid;
export const totalPts = (ds = DS, day = DAY) => ptsCol(ds, day) + ptsWho(ds) + ptsGrid(ds);
export const STEPS = [
  {id: 'col', done: colDone, started: (ds = DS) => ds.col.a.length > 0, pts: ptsCol, max: 200, label: 'College', result: (ds = DS, day = DAY) => `${colScore(ds, day)} of 5`},
  {id: 'who', done: whoDone, started: (ds = DS) => ds.who.g.length > 0 || ds.who.clues > 1, pts: ptsWho, max: 350, label: 'Mystery player', result: (ds = DS) => ds.who.won ? `Clue ${ds.who.clues} of 7` : 'Stumped'},
  {id: 'grid', done: gridDone, started: (ds = DS) => ds.grid.cells.some(Boolean), pts: ptsGrid, max: 450, label: 'Grid', result: (ds = DS) => `${gridScore(ds)} of 9`}
];
export const allDone = (ds = DS) => STEPS.every(s => s.done(ds));
export const anyStarted = (ds = DS) => STEPS.some(s => s.started(ds) || s.done(ds));
export const firstOpen = (ds = DS) => { const i = STEPS.findIndex(s => !s.done(ds)); return i < 0 ? 0 : i; };

// Route slugs for the three puzzles
const SLUGS = ['college', 'mystery', 'grid'];
export const slug = stepIndex => SLUGS[stepIndex] || null;
export const stepOf = s => SLUGS.indexOf(s);

// ---------------------------------------------------------------------------
// Actions. Each mutates DS exactly as the old click handlers did, saves, and emits 'progress'.
function changed(action, extra) { saveDS(); emit('progress', Object.assign({action}, extra)); }

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

// Locks in the score as it is. The caller then runs maybeAutoPost() (the old flow).
export function lockIn() {
  DS.grid.over = true;
  while (DS.col.a.length < 5) DS.col.a.push(-1);
  if (!DS.who.done) { DS.who.done = true; DS.who.won = false; }
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
    if (!DEV_NO_POST) LB.save = body => fs.setDoc(fs.doc(db, 'players', LB.uid), body);
    fs.onSnapshot(fs.collection(db, 'players'), snap => {
      const prev = LB.players;
      LB.players = snap.docs.map(d => Object.assign({id: d.id}, d.data()));
      LB.ready = true;
      const mine = LB.players.find(p => p.id === LB.uid);
      if (mine && mine.nick) LB.nick = mine.nick;
      if (mine && mine.days && mine.days[PNUM]) DS.posted = true;
      lbChanged('snapshot', prev);
      maybeAutoPost();
    }, err => { LB.err = err.code; LB.ready = true; lbChanged('error'); });
  } catch (_) { LB.off = true; LB.ready = true; lbChanged('off'); }
}

export const displayName = p => (p.nick || 'Someone');

export function maybeAutoPost() {
  if (!allDone() || DS.posted || !LB.save || LB.posting || LB.status === 'denied') return;
  if (LB.nick) postScore(LB.nick);
}

export async function postScore(nick) {
  if (!LB.save || LB.posting) return;
  LB.posting = true; LB.status = 'posting'; lbChanged('status');
  const me = LB.players.find(p => p.id === LB.uid);
  const days = Object.assign({}, me && me.days);
  if (!days[PNUM]) days[PNUM] = {p: totalPts(), g: gridScore(), c: colScore(), w: DS.who.won ? DS.who.clues : 0};
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
export function shareText(ds = DS, day = DAY) {
  const leagueName = DATA && DATA.league ? DATA.league.name : 'Gridiron Gangbang';
  const lines = [`${leagueName} daily, ${new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}: ${nf(totalPts(ds, day))} pts`];
  if (colDone(ds)) lines.push('College ' + ds.col.a.map((a, r) => a === day.c[r][2] ? '🟩' : '🟥').join(''));
  if (whoDone(ds)) lines.push(ds.who.won ? `Mystery player: clue ${ds.who.clues} of 7` : 'Mystery player: stumped');
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

function tieRanks(rows, key) {
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r[key] !== prev) { rank = i + 1; prev = r[key]; } r.rank = rank; });
  return rows;
}

// Board rows exactly as the old leaderboardHTML built them (same sub strings, sort and tie ranks),
// plus {rank, me, managerId, move}. mode: 'today' | 'season' | 'streaks' (default LB.mode).
// players defaults to LB.players (pass a list to compute rows for something else).
export function boardRows(mode = LB.mode, players = LB.players) {
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
      const d = p.days && p.days[PNUM];
      return d ? {id: p.id, name: displayName(p), pts: d.p, sub: `College ${d.c}/5, grid ${d.g}/9, ${d.w ? 'ID on clue ' + d.w : 'no ID'}`} : null;
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
      const t = p.days && p.days[PNUM];
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
export function social(players = LB.players) {
  const played = boardRows('today', players);
  // A regular has posted at least once (played > 0, last >= 1) within the last 7 puzzle days.
  // Without the played/last guard, docs that never posted count as regulars in the first week (PNUM <= 7).
  const recent = p => (p.played || 0) > 0 && (p.last || 0) >= 1 && p.last >= PNUM - 7;
  const today = p => !!(p.days && p.days[PNUM]);
  const regulars = players.filter(p => recent(p) || today(p)).length;
  const stillToPlay = players.filter(p => recent(p) && !today(p)).map(p => ({id: p.id, name: displayName(p), managerId: managerFor(p), me: p.id === LB.uid}));
  const leaderRow = played[0] || null;
  return {played, regulars, stillToPlay, leader: leaderRow ? leaderRow.name : null, leaderRow};
}

function dsComplete(ds) {
  return ds.col.a.length >= 5 && ds.who.done && (ds.grid.over || ds.grid.cells.every(Boolean));
}
// Points for a saved day (DS-shaped object) on puzzle day pnum, or null before puzzles load.
export function pointsFor(ds, pnum = PNUM) {
  if (!PZ) return null;
  const day = PZ.days[(pnum - 1) % PZ.days.length];
  return totalPts(freshDS(ds), day);
}

// Streak from this phone's saved days (localStorage gg-daily-N).
export function streakLocal() {
  const done = new Set(), perfect = new Set();
  const consider = (n, ds) => {
    if (!(n >= 1 && n <= PNUM) || !dsComplete(ds)) return;
    done.add(n);
    if (pointsFor(ds, n) === 1000) perfect.add(n);
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

// Grade ladder (spec 7.7). Display only.
export function gradeFor(total) {
  const t = Number(total) || 0;
  return t >= 1000 ? 'PERFECT DAY' : t >= 850 ? 'ALL-PRO' : t >= 650 ? 'PRO BOWL' : t >= 450 ? 'STARTER' : t >= 250 ? 'PRACTICE SQUAD' : 'CUT DAY';
}

// DEEP CUT: player i is a valid answer for the square, its fame is at or below the 25th
// percentile of all valid answers for that square, and the square has at least 8 valid answers.
// r and c are criteria strings (e.g. 't:5'), or row/column indexes 0-2 into today's grid.
const deepCache = new Map();
export function deepCut(r, c, i) {
  if (!PZ || i == null || !PP[i]) return false;
  const R = typeof r === 'number' ? DAY.g[r] : r, C = typeof c === 'number' ? DAY.g[3 + c] : c;
  const key = R + '|' + C;
  let cut = deepCache.get(key);
  if (cut === undefined) {
    const fames = [];
    for (let j = 0; j < PP.length; j++) if (critOk(R, PP[j]) && critOk(C, PP[j])) fames.push(PP[j][7]);
    fames.sort((a, b) => a - b);
    cut = fames.length >= 8 ? fames[Math.ceil(0.25 * fames.length) - 1] : null;
    deepCache.set(key, cut);
  }
  if (cut == null) return false;
  return critOk(R, PP[i]) && critOk(C, PP[i]) && PP[i][7] <= cut;
}
