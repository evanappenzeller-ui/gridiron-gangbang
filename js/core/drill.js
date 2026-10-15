// Two-Minute Drill core: the daily drives (data/drill.json, written by tools/drill/build.py and tune.mjs), Survivor,
// what this phone remembers, the league scoreboard and the words for each play. No DOM. Owner: Drill.
// The engine itself (snaps, the clock, the dice) is js/core/drill-sim.js.
//
//   load()                      -> Promise<doc> (memoized; a failed load can be retried)
//   todayNumber(), dateOf(n), dayLabel(n), scenario(n)   one drive a day, the same for everyone; a new one at midnight
//   drive(n)                    today's drive so far, replayed from this phone's actions
//   record(n, s)                saves the drive's actions after each one; the result once it's over (once a day)
//   Survivor: survivor() -> {run: {seed, i, a, streak, over}, best, runs}; survivorDrive(); saveSurvivor(s);
//     nextDrive(); newRun()
//   Text: spot(s, ball), downText(down, togo), clockText(sec), playText(s, play), resultText(s), shareText(n, s)
//   Scoreboard: autoPost(), boardState(), boardRows(mode, n), drivesOf(key, n)
import {lsGet, lsSet, absLink} from './ui.js';
import * as daily from './daily.js';
import * as E from './drill-sim.js';

export {E};
const URL_ = new URL('../../data/drill.json', import.meta.url).href;
export let DOC = null;
let loading = null;

export function load() {
  if (DOC) return Promise.resolve(DOC);
  if (loading) return loading;
  loading = fetch(URL_, {cache: 'no-cache'})
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => {
      if (!d || !d.teams || !Array.isArray(d.days) || !d.days.length || !/^\d{4}-\d\d-\d\d$/.test(d.start)) throw new Error('bad drill.json');
      DOC = d;
      return d;
    })
    .finally(() => { loading = null; });
  return loading;
}

// ---------------------------------------------------------------------------------------------- days
const startParts = () => DOC.start.split('-').map(Number);
/** Drive number for a moment (local date): 1 on DOC.start, never below 1. */
export function todayNumber(t = new Date()) {
  const [y, m, d] = startParts();
  return 1 + Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}
export function dateOf(n) {
  const [y, m, d] = startParts();
  return new Date(y, m - 1, d + n - 1);
}
export const dayLabel = (n, o = {month: 'short', day: 'numeric', weekday: 'short'}) => dateOf(n).toLocaleDateString('en-US', o);
/** Day n's scenario: {n, o, d, us, them, t, b, to, s, g? (the real game: {wk, h, a, day})}. */
export function scenario(n) {
  const d = DOC.days[(n - 1) % DOC.days.length];
  return Object.assign({n}, d);
}
export const team = id => DOC.teams[id];

// ---------------------------------------------------------------------------------------------- memory
// 'gg-2m': {days: {n: {a (actions), r ('W'|'T'|'L' once over), at}} (the last KEEP days), played, wins,
//           surv: {run: {seed, i (its drive number, 0 first), a (this drive's actions), streak, over}, best, runs}}
const KEY = 'gg-2m', KEEP = 60;
function read() {
  let v = null;
  try { v = JSON.parse(lsGet(KEY) || 'null'); } catch (_) { v = null; }
  if (!v || typeof v !== 'object' || !v.days || typeof v.days !== 'object') v = {days: {}};
  if (!Number.isInteger(v.played)) v.played = 0;
  if (!Number.isInteger(v.wins)) v.wins = 0;
  if (!v.surv || typeof v.surv !== 'object') v.surv = {run: null, best: 0, runs: 0};
  return v;
}
function write(v) {
  const keys = Object.keys(v.days).map(Number).filter(Number.isInteger).sort((a, b) => b - a);
  keys.slice(KEEP).forEach(k => { delete v.days[k]; });
  lsSet(KEY, JSON.stringify(v));
}
const cleanActs = a => (typeof a === 'string' && /^[a-zA-Z]{0,200}$/.test(a) ? a : '');
/** Day n on this phone: {acts, result (null until it's over), at}. */
export function dayState(n) {
  const d = read().days[n] || {};
  return {acts: cleanActs(d.a), result: ['W', 'T', 'L'].includes(d.r) ? d.r : null, at: Number(d.at) || 0};
}
/** Day n's drive, replayed. */
export function drive(n) {
  return E.replay(scenario(n), DOC.teams, dayState(n).acts);
}
/** Saves day n's drive after an action. A finished day changes no more. */
export function record(n, s) {
  const v = read();
  const d = v.days[n] || (v.days[n] = {});
  if (d.r) return false;
  d.a = E.actsOf(s);
  if (s.result) {
    d.r = s.result;
    d.at = Date.now();
    v.played += 1;
    if (s.result === 'W') v.wins += 1;
  }
  write(v);
  return true;
}
export function totals() {
  const v = read();
  return {played: v.played, wins: v.wins, best: v.surv.best || 0};
}

// ---------------------------------------------------------------------------------------------- Survivor
// Drive after drive with random teams, each spot a little harder (drill-sim.js survivorScenario), until one ends in a
// loss. A tie (overtime) keeps the run going. The best run goes to the league scoreboard.
const ids = () => Object.keys(DOC.teams).sort();
export function survivor() {
  const v = read().surv;
  const run = v.run && Number.isInteger(v.run.seed) ? {seed: v.run.seed, i: v.run.i | 0, a: cleanActs(v.run.a), streak: v.run.streak | 0, over: !!v.run.over} : null;
  return {run, best: v.best | 0, runs: v.runs | 0};
}
export const survivorScenarioOf = run => E.survivorScenario(run.seed, run.i, ids());
export function survivorDrive(run = survivor().run) {
  return run ? E.replay(survivorScenarioOf(run), DOC.teams, run.a) : null;
}
export function newRun() {
  const v = read();
  v.surv.run = {seed: (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0, i: 0, a: '', streak: 0, over: false};
  write(v);
  return survivor().run;
}
/** Saves the current Survivor drive; when it's over, the streak (and the best) move. */
export function saveSurvivor(s) {
  const v = read(), run = v.surv.run;
  if (!run || run.over) return;
  run.a = E.actsOf(s);
  if (s.result) {
    if (s.result === 'L') {
      run.over = true;
      v.surv.runs = (v.surv.runs | 0) + 1;
    } else run.streak = (run.streak | 0) + 1;
    v.surv.best = Math.max(v.surv.best | 0, run.streak | 0);
  }
  write(v);
}
/** After a drive that kept the run alive: the next one. */
export function nextDrive() {
  const v = read(), run = v.surv.run;
  if (!run || run.over) return null;
  const s = survivorDrive(survivor().run);
  if (!s || !s.result) return null;
  run.i = (run.i | 0) + 1;
  run.a = '';
  write(v);
  return survivor().run;
}

// ---------------------------------------------------------------------------------------------- words
const SLOT_POS = {QB: 'QB', RB: 'RB', WR1: 'WR', WR2: 'WR', WR3: 'WR', TE: 'TE'};
export const posOf = slot => SLOT_POS[slot] || slot;
/** "Caleb Williams" -> "C. Williams". */
export const short = n => {
  const i = String(n).indexOf(' ');
  return i < 0 ? String(n) : `${n[0]}. ${n.slice(i + 1)}`;
};
const lastName = n => { const i = String(n).indexOf(' '); return i < 0 ? n : n.slice(i + 1); };
/** Where the ball is: "DEN 35", "midfield", "SEA 12". */
export function spot(s, ball = s.ball) {
  if (ball === 50) return 'midfield';
  return ball < 50 ? `${s.sc.o} ${ball}` : `${s.sc.d} ${100 - ball}`;
}
const ORD = ['', '1st', '2nd', '3rd', '4th'];
export function downText(down, togo, ball) {
  const goal = ball != null && 100 - ball <= togo;
  return `${ORD[Math.min(4, down)]} & ${goal ? 'goal' : togo}`;
}
export const clockText = sec => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, Math.round(sec)) % 60).padStart(2, '0')}`;
const yds = g => `${Math.abs(g)} yard${Math.abs(g) === 1 ? '' : 's'}`;
const offName = (s, slot) => s.U.o.by[slot].n;
const defName = (s, slot) => (s.U.d.by[slot] ? s.U.d.by[slot].n : '');
export const CALL_LABEL = {
  run: 'Run', short: 'Pass short', side: 'Pass to the sideline', deep: 'Deep shot', rpo: 'RPO', trick: 'Trick play',
  spike: 'Spike', timeout: 'Timeout', fg: 'Field goal', kick: 'Kick the extra point',
  run2: 'Two-point run', pass2: 'Two-point pass', rpo2: 'Two-point RPO', trick2: 'Two-point trick play'
};
/** One play in words: {head ("Complete to Odunze for 14"), sub (the details), tone ('good'|'bad'|'flat'|'score')}. */
export function playText(s, p) {
  const after = p.after;
  const clockBit = p.kind === 'timeout' ? '' : after.running ? 'clock running' : 'clock stopped';
  const tail = [p.first ? 'first down' : '', p.oob ? 'out of bounds' : '', p.warn ? 'two-minute warning' : '', clockBit].filter(Boolean).join(' · ');
  switch (p.kind) {
    case 'timeout': return {head: `Timeout. ${after.tos} left`, sub: `Clock stopped at ${clockText(after.clock)}`, tone: 'flat'};
    case 'spike': return {head: 'Spiked to stop the clock', sub: `${downText(after.down, after.togo, after.ball)} · ${clockText(after.clock)} left`, tone: 'flat'};
    case 'expired': return {head: 'The clock ran out before the snap', sub: 'Should have used a timeout or spiked it', tone: 'bad'};
    case 'fg': return {head: `${p.dist}-yard field goal is good`, sub: s.result === 'W' ? 'That wins it' : 'All tied up', tone: 'score'};
    case 'fgx': return {head: `${p.dist}-yard field goal is no good`, sub: `${s.U.o.k.n} missed`, tone: 'bad'};
    case 'xp': return {head: 'Extra point is good', sub: 'Tied. Overtime', tone: 'score'};
    case '2good': return {head: 'Two-point try is good', sub: CALL_LABEL[p.call] + '. That wins it', tone: 'score'};
    case '2fail': return {head: 'Two-point try fails', sub: CALL_LABEL[p.call], tone: 'bad'};
    case 'int': return {head: `Intercepted by ${defName(s, p.by)}`, sub: `${p.trick ? 'The trick play' : 'Intended for ' + offName(s, p.who)}. Game over`, tone: 'bad'};
    case 'fum': return {head: p.who === 'RB' ? `${lastName(offName(s, 'RB'))} fumbles. ${defName(s, p.by)} recovers` : `Strip sack by ${defName(s, p.by)}`, sub: 'Turnover. Game over', tone: 'bad'};
    case 'sack': return {head: `Sacked by ${defName(s, p.by)} for a loss of ${Math.abs(p.gain)}`, sub: tail, tone: 'bad'};
    case 'inc': return {head: p.trick ? 'The trick play falls incomplete' : `Incomplete, intended for ${lastName(offName(s, p.who))}`, sub: `${defName(s, p.by)} in coverage · clock stopped`, tone: 'flat'};
    case 'catch': {
      const who = lastName(offName(s, p.who));
      if (p.td) return {head: `Touchdown! ${p.trick ? 'Trick play, ' : ''}${who} from ${p.gain} out`, sub: s.phase === 'pat' ? 'Down one. Kick to tie, or go for two to win' : s.result === 'W' ? 'That wins it' : '', tone: 'score'};
      const head = `${p.trick ? 'Trick play! ' : ''}${p.read === 'pass' ? 'RPO, ' : ''}${who} for ${p.gain >= 0 ? yds(p.gain) : 'a loss of ' + Math.abs(p.gain)}`;
      return {head, sub: tail, tone: p.first || p.gain >= 10 ? 'good' : p.gain <= 2 ? 'flat' : 'good'};
    }
    case 'run': {
      const who = lastName(offName(s, 'RB'));
      if (p.td) return {head: `Touchdown! ${who} ${p.read === 'run' ? 'on the RPO keeper ' : ''}from ${p.gain} out`, sub: s.phase === 'pat' ? 'Down one. Kick to tie, or go for two to win' : s.result === 'W' ? 'That wins it' : '', tone: 'score'};
      const head = p.gain > 0 ? `${p.read === 'run' ? 'RPO, ' : ''}${who} runs for ${yds(p.gain)}` : p.gain === 0 ? `${who} is stopped for no gain` : `${who} is dropped for a loss of ${Math.abs(p.gain)}`;
      return {head, sub: [p.gain <= 0 ? `${defName(s, p.by)} on the tackle` : '', tail].filter(Boolean).join(' · '), tone: p.gain <= 0 ? 'bad' : p.first || p.gain >= 8 ? 'good' : 'flat'};
    }
    default: return {head: CALL_LABEL[p.call] || '', sub: '', tone: 'flat'};
  }
}
/** The drive's end in words: {head, score, sub}. you: false for someone else's drive (no "You win"). */
export function resultText(s, {you = true} = {}) {
  const score = `${s.us}–${s.them}`;
  const won = you ? 'You win' : 'Won it';
  const W = {td: `Touchdown. ${won}`, fg: `Field goal. ${won}`, '2pt': `Two-point try is good. ${won}`};
  if (s.result === 'W') return {head: W[s.why] || won, score, sub: `${clockText(s.clock)} left · ${plural(playCount(s), 'play')}`};
  if (s.result === 'T') return {head: 'Tied. Overtime', score, sub: s.why === 'fg' ? 'The field goal ties it' : 'The extra point ties it'};
  const L = {clock: 'Time ran out', int: 'Intercepted', fum: 'Fumble', downs: 'Turnover on downs', fgx: 'The kick missed', safety: 'Safety', '2pt': 'The two-point try failed'};
  return {head: L[s.why] || 'Game over', score, sub: s.why === '2pt' ? `${clockText(s.clock)} left` : `Got to the ${spot(s, s.best)}`};
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Snaps that were plays (timeouts and spikes not counted). */
export const playCount = s => s.plays.filter(p => !['timeout', 'spike', 'expired', 'xp'].includes(p.kind)).length;
/** A square per snap: big gain or first down 🟩, a gain 🟨, nothing ⬜, a loss 🟥, a turnover ❌, the score 🏈 or 🥅. */
export function squares(s) {
  return s.plays.map(p => {
    if (p.kind === 'timeout' || p.kind === 'xp') return '';
    if (p.kind === 'spike') return '⏱️';
    if (p.td || p.kind === '2good') return '🏈';
    if (p.kind === 'fg') return '🥅';
    if (p.kind === 'int' || p.kind === 'fum' || p.kind === 'fgx' || p.kind === '2fail' || p.kind === 'expired') return '❌';
    if (p.kind === 'inc') return '⬜';
    if (p.gain < 0) return '🟥';
    return p.first || p.gain >= 10 ? '🟩' : p.gain > 0 ? '🟨' : '⬜';
  }).join('');
}
/** The result and a square per snap. */
export function shareText(n, s) {
  const r = resultText(s);
  const mark = s.result === 'W' ? 'W' : s.result === 'T' ? 'T' : 'L';
  return [
    `Two-Minute Drill #${n} · ${dayLabel(n)}`,
    `${s.sc.o} down ${s.sc.them - s.sc.us}, ${clockText(s.sc.t)} left, ball on the ${spot(s, s.sc.b)}`,
    `${mark} ${s.us}–${s.them} · ${s.result === 'L' ? r.head : r.sub}`,
    squares(s),
    absLink('/puzzles/drill')
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------- scoreboard
// The league's drives ride on each phone's Daily board doc (players/{uid}, daily.js), like 17-0's: d2m: {n: {r ('W'|
// 'T'|'L'), c (seconds left), p (plays), y (furthest the ball got, yards from your own goal), k (the actions), t
// (when)}} and d2s: {b (best Survivor run), t}. A finished day posts by itself (autoPost) once the board has loaded,
// and again after a failed post. One drive per member per day: across a member's phones the first finished counts.
const F = 'd2m', FS = 'd2s', POST_BACK = 7;
let posting = false;
export function entryOf(p, n) {
  const e = p && p[F] && typeof p[F] === 'object' ? p[F][n] : null;
  if (!e || !['W', 'T', 'L'].includes(e.r)) return null;
  return {r: e.r, c: Math.max(0, Number(e.c) || 0), p: Math.max(0, e.p | 0), y: Math.max(0, Math.min(100, e.y | 0)), k: cleanActs(e.k), t: Number(e.t) || 0};
}
const bestOf = p => (p && p[FS] && Number.isInteger(p[FS].b) && p[FS].b >= 0 ? p[FS].b : null);
const docs = () => daily.LB.raw || daily.LB.players || [];
const meKey = () => daily.memberOf({id: daily.LB.uid, nick: daily.LB.nick});
function people(list) {
  const m = new Map();
  list.forEach(p => {
    const k = daily.memberOf(p) || 'row:' + p.id;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  });
  return m;
}
function firstOf(list, n) {
  let out = null;
  list.forEach(p => {
    const e = entryOf(p, n);
    if (e && (!out || e.t < out.e.t || (e.t === out.e.t && String(p.id) < String(out.doc.id)))) out = {e, doc: p};
  });
  return out;
}
function unposted() {
  const list = docs(), mine = list.find(p => p.id === daily.LB.uid), k = meKey();
  const theirs = list.filter(p => p === mine || (k && daily.memberOf(p) === k));
  const v = read(), top = todayNumber();
  const days = Object.keys(v.days).map(Number)
    .filter(n => Number.isInteger(n) && n <= top && n > top - POST_BACK && v.days[n].r)
    .filter(n => !theirs.some(p => entryOf(p, n)))
    .sort((a, b) => a - b);
  const best = v.surv.best | 0;
  const posted = theirs.reduce((m, p) => Math.max(m, bestOf(p) ?? -1), -1);
  return {days, best: best > 0 && best > posted ? best : null};
}
export async function autoPost() {
  const LB = daily.LB;
  if (!DOC || posting || !LB.merge || !LB.ready || LB.off || !LB.uid) return false;
  const {days, best} = unposted();
  if (!days.length && best == null) return false;
  const v = read(), d2m = {};
  days.forEach(n => {
    const s = E.replay(scenario(n), DOC.teams, v.days[n].a);
    if (!s.result) return;
    d2m[n] = {r: s.result, c: s.clock, p: playCount(s), y: s.best, k: E.actsOf(s), t: Number(v.days[n].at) || Date.now()};
  });
  const body = {};
  if (Object.keys(d2m).length) body[F] = d2m;
  if (best != null) body[FS] = {b: best, t: Date.now()};
  if (!Object.keys(body).length) return false;
  const mine = docs().find(p => p.id === LB.uid);
  if (!mine) Object.assign(body, {nick: (daily.postName() || '').trim().slice(0, 24), total: 0});
  posting = true;
  try { await LB.merge(body); return true; } catch (_) { return false; } finally { posting = false; }
}
try {
  daily.subscribe(type => { if (type === 'lb') autoPost(); });
  addEventListener('online', () => autoPost());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoPost(); });
} catch (_) {}

export function boardState() {
  if (daily.status === 'error') return 'wait';
  const LB = daily.LB;
  if (LB.off || LB.err) return 'off';
  if (daily.status !== 'ready' || !LB.ready) return 'loading';
  return 'ready';
}
const RANK = {W: 2, T: 1, L: 0};
function ranked(rows, same) {
  rows.forEach((r, i) => { r.rank = i && same(rows[i - 1], r) ? rows[i - 1].rank : i + 1; });
  return rows;
}
/**
 * Scoreboard rows, one per member, best first, tied rows sharing a rank.
 *   'today':    day n's drives: {key, uid, name, managerId, me, r, c, p, y, k, rank}; wins, then ties, then losses;
 *               a win or tie with more time left first, then fewer plays; a loss that got further first.
 *   'survivor': best runs: {key, uid, name, managerId, me, b, rank}.
 */
export function boardRows(mode = 'today', n = todayNumber(), list = docs()) {
  const mk = meKey(), uid = daily.LB.uid, rows = [];
  people(list).forEach((ds, k) => {
    const mine = ds.some(p => p.id === uid) || (!!mk && k === mk);
    const rep = ds.find(p => p.id === uid) || ds.slice().sort((a, b) => (b.last || 0) - (a.last || 0))[0];
    const base = {key: k, name: daily.displayName(rep), managerId: k.startsWith('row:') ? null : k, me: mine};
    if (mode === 'today') {
      const f = firstOf(ds, n);
      if (f) rows.push(Object.assign(base, {uid: f.doc.id}, f.e));
      return;
    }
    const b = ds.reduce((m, p) => Math.max(m, bestOf(p) ?? -1), -1);
    if (b > 0) rows.push(Object.assign(base, {uid: rep.id, b}));
  });
  if (mode === 'today') {
    const key = r => [RANK[r.r], r.r === 'L' ? r.y : r.c, -r.p];
    rows.sort((a, b) => { const x = key(a), y = key(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; });
    return ranked(rows, (a, b) => a.r === b.r && (a.r === 'L' ? a.y === b.y : a.c === b.c) && a.p === b.p);
  }
  return ranked(rows.sort((a, b) => b.b - a.b), (a, b) => a.b === b.b);
}
/** A member's drive on day n (key: a scoreboard row's key), replayed from what they posted, or null. */
export function driveOf(key, n = todayNumber(), list = docs()) {
  const ds = people(list).get(key) || [];
  const f = firstOf(ds, n);
  if (!f || !f.e.k) return f ? {entry: f.e, s: null} : null;
  return {entry: f.e, s: E.replay(scenario(n), DOC.teams, f.e.k)};
}
