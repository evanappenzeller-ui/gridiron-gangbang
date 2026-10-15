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
// 'gg-drill2': {days: {n: {a (actions), r ('W'|'T'|'L' once over), at}} (the last KEEP days), played, wins,
//              surv: {run: {seed, i (its drive number, 0 first), a (this drive's actions), streak, over}, best, runs}}
// (The first version's single-letter actions lived under 'gg-2m'; they don't replay in this engine, so it's left be.)
const KEY = 'gg-drill2', KEEP = 60;
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
const cleanActs = a => (typeof a === 'string' && /^[a-z0-9+,]{0,1200}$/.test(a) ? a : '');
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
export const lastName = n => { const i = String(n).indexOf(' '); return i < 0 ? n : n.slice(i + 1); };
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
const SIDE = {s: 'strong side', w: 'weak side'};
const routeName = r => (E.ROUTES[r] ? E.ROUTES[r].name.toLowerCase() : 'route');
const article = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');
/** A token in words: "Pass to Moore, dig, play action", "Run, weak side, get out of bounds". s: the drive (for names). */
export function tokenLabel(s, t) {
  const a = E.parse(t);
  if (!a) return '';
  const fl = a.flags || {};
  const extra = [fl.a ? 'play action' : '', fl.r ? 'roll out' : '', fl.o ? 'get out of bounds' : ''].filter(Boolean);
  let base;
  if (a.kind === 'pass') base = `Pass to ${lastName(offName(s, a.slot))}, ${routeName(a.route)}`;
  else if (a.kind === 'run') base = `Run, ${SIDE[a.dir]}`;
  else if (a.kind === 'rpo') base = `RPO, ${SIDE[a.dir]}`;
  else base = {trick: 'Trick play', spike: 'Spike', timeout: 'Timeout', fg: 'Field goal', kick: 'Kick the extra point'}[a.kind];
  return [base].concat(extra).join(', ');
}
/** A token in few words, for the list of every option: "Moore dig (PA)", "Run weak", "RPO strong (OOB)". */
export function tokenShort(s, t) {
  const a = E.parse(t);
  if (!a) return '';
  const fl = a.flags || {};
  const extra = [fl.a ? 'PA' : '', fl.r ? 'roll' : '', fl.o ? 'OOB' : ''].filter(Boolean).join(', ');
  const tail = extra ? ` (${extra})` : '';
  if (a.kind === 'pass') return `${lastName(offName(s, a.slot))} ${routeName(a.route)}${tail}`;
  if (a.kind === 'run' || a.kind === 'rpo') return `${a.kind === 'run' ? 'Run' : 'RPO'} ${a.dir === 's' ? 'strong' : 'weak'}${tail}`;
  return {trick: 'Trick play', spike: 'Spike', timeout: 'Timeout', fg: 'Field goal', kick: 'Extra point'}[a.kind];
}
const tailOf = p => [p.first ? 'first down' : '', p.oob ? 'out of bounds' : '', p.warn ? 'two-minute warning' : '',
  p.kind === 'timeout' ? '' : p.after.running ? 'clock running' : 'clock stopped'].filter(Boolean).join(', ');
/** One play in words: {head ("Incomplete", "+14", "Touchdown"), line (what happened, broadcast style), tone ('good' |
 *  'bad' | 'flat' | 'score')}. */
export function playText(s, p) {
  const qb = lastName(offName(s, 'QB'));
  const tail = tailOf(p);
  const route = p.route ? routeName(p.route) : '';
  const to = p.who ? `${short(offName(s, p.who))}` : '';
  const on = route ? ` on ${article(route)} ${route}` : '';
  const two = p.two ? 'Two-point try: ' : '';
  switch (p.kind) {
    case 'timeout': return {head: 'Timeout', line: `Clock stopped at ${clockText(p.after.clock)}. ${p.after.tos} left.`, tone: 'flat'};
    case 'spike': return {head: 'Spiked', line: `${qb} spikes it to stop the clock: ${downText(p.after.down, p.after.togo, p.after.ball)}, ${clockText(p.after.clock)} left.`, tone: 'flat'};
    case 'expired': return {head: 'Time', line: 'The clock ran out before the snap. A timeout or a spike would have stopped it.', tone: 'bad'};
    case 'fg': return {head: 'It’s good', line: `${p.dist}-yard field goal by ${lastName(s.U.o.k.n)}. ${s.result === 'W' ? 'That wins it.' : 'All tied up.'}`, tone: 'score'};
    case 'fgx': return {head: 'No good', line: `${p.dist}-yard field goal by ${lastName(s.U.o.k.n)} misses.`, tone: 'bad'};
    case 'xp': return {head: 'Tied', line: 'The extra point is good. Overtime.', tone: 'score'};
    case '2good': return {head: 'Two!', line: `${two}${twoLine(s, p)} That wins it.`, tone: 'score'};
    case '2fail': return {head: 'Stopped', line: `${two}${twoLine(s, p)}`, tone: 'bad'};
    case 'int': return {head: 'Intercepted', line: p.trick ? `The trick play: ${qb} heaves it deep and ${defName(s, p.by)} picks it off.` : `${qb} looks for ${to}${on}: picked off by ${defName(s, p.by)}.`, tone: 'bad'};
    case 'fum': return {head: 'Fumble', line: p.who === 'RB' ? `${lastName(offName(s, 'RB'))} fumbles and ${defName(s, p.by)} recovers.` : `Strip sack by ${defName(s, p.by)}. Their ball.`, tone: 'bad'};
    case 'sack': return {head: `Sack ${p.gain}`, line: `${defName(s, p.by)} sacks ${qb} for a loss of ${Math.abs(p.gain)}: ${tail}.`, tone: 'bad'};
    case 'inc': return {head: 'Incomplete', line: p.trick ? `The trick play falls incomplete: ${tail}.` : `${qb} looks for ${to}${on}: incomplete, ${tail}.`, tone: 'flat'};
    case 'catch': {
      const who = lastName(offName(s, p.who));
      if (p.td) return {head: 'Touchdown', line: `${p.trick ? 'The trick play! ' : ''}${qb} finds ${to}${p.trick ? '' : on} for a ${p.gain}-yard touchdown.${s.phase === 'pat' ? ' Down one: kick to tie, or go for two to win.' : ''}`, tone: 'score'};
      const g = p.gain >= 0 ? `+${p.gain}` : `${p.gain}`;
      const what = p.read === 'pass' ? `RPO: ${qb} pulls it and fires to ${to} on a slant` : p.trick ? `The trick play! ${qb} hits ${to} deep` : `${qb} hits ${to}${on}`;
      return {head: g, line: `${what} for ${p.gain >= 0 ? yds(p.gain) : 'a loss of ' + Math.abs(p.gain)}${p.broke ? ', breaking a tackle' : ''}: ${tail}.`, tone: p.first || p.gain >= 10 ? 'good' : p.gain <= 2 ? 'flat' : 'good'};
    }
    case 'run': {
      const who = lastName(offName(s, 'RB'));
      const keep = p.read === 'run' ? 'RPO, handed off: ' : '';
      if (p.td) return {head: 'Touchdown', line: `${keep}${who} runs it in from ${p.gain} out on the ${SIDE[p.dir]}.${s.phase === 'pat' ? ' Down one: kick to tie, or go for two to win.' : ''}`, tone: 'score'};
      const head = p.gain > 0 ? `+${p.gain}` : p.gain === 0 ? 'No gain' : `${p.gain}`;
      const line = p.gain > 0 ? `${keep}${who} runs ${SIDE[p.dir]} for ${yds(p.gain)}${p.broke ? ', breaking a tackle' : ''}: ${tail}.`
        : `${keep}${who} is ${p.gain === 0 ? 'stopped for no gain' : `dropped for a loss of ${Math.abs(p.gain)}`} by ${defName(s, p.by)}: ${tail}.`;
      return {head, line, tone: p.gain <= 0 ? 'bad' : p.first || p.gain >= 8 ? 'good' : 'flat'};
    }
    default: return {head: '', line: tokenLabel(s, p.act), tone: 'flat'};
  }
}
function twoLine(s, p) {
  const qb = lastName(offName(s, 'QB'));
  if (p.res === 'catch') return `${qb} finds ${short(offName(s, p.who))} in the end zone.`;
  if (p.res === 'run') return p.gain >= 2 ? `${lastName(offName(s, 'RB'))} punches it in.` : `${lastName(offName(s, 'RB'))} is stopped short.`;
  if (p.res === 'inc') return `${qb}’s pass for ${short(offName(s, p.who))} falls incomplete.`;
  if (p.res === 'sack') return `${qb} is sacked.`;
  if (p.res === 'int') return `${qb} is picked off.`;
  return 'No good.';
}
/** What the defense was really in and how it met your play: {text, good (it played into your hands)}, or null. */
export function callText(s, p) {
  const C = E.CALLS[p.dcall];
  if (!C || !p.look) return null;
  const look = E.LOOKS[p.look].name.toLowerCase();
  const is = `The ${look} was ${C.name} (${C.what})`;
  const a = E.parse(p.act) || {};
  if (p.kind === 'sack' || (p.kind === 'fum' && p.who !== 'RB')) {
    const pa = a.flags && a.flags.a && !(E.FX[p.dcall].pa || p.look === 'box');
    return {text: `${is}. The rush got home${pa ? ': play action held the ball too long' : a.flags && a.flags.r ? ' even on the roll out' : ''}.`, good: false};
  }
  if (a.kind === 'pass' || (a.kind === 'rpo' && p.read === 'pass')) {
    const route = a.kind === 'pass' ? a.route : 'slant', slot = a.kind === 'pass' ? a.slot : 'WR3';
    const cat = E.ROUTES[route].cat, fx = E.FX[p.dcall].cat[cat][0];
    const the = `the ${routeName(route)} to ${short(offName(s, slot))}`;
    if (a.kind === 'rpo') return {text: `${is}: the QB read it and threw. ${fx >= 0 ? 'Right read.' : 'It was waiting for the quick throw.'}`, good: fx >= 0};
    return fx >= 0.03 ? {text: `${is}, and ${the} was the answer to it.`, good: true}
      : fx <= -0.03 ? {text: `${is}, set up to stop ${the}.`, good: false}
      : {text: `${is}. Nothing special against ${the}.`, good: true};
  }
  if (a.kind === 'run' || a.kind === 'rpo') {
    const into = a.dir === p.shade;
    const fxr = E.FX[p.dcall].run + (into ? -1.2 : 1.6);
    const lean = into ? 'and you ran right at the side it leaned to' : 'and you ran away from its lean';
    return {text: `${is}, ${lean}.`, good: fxr >= 0};
  }
  if (a.kind === 'trick') {
    const t = E.FX[p.dcall].trick;
    return {text: `${is}. ${t >= 0.45 ? 'Aggressive: the kind a trick play fools.' : 'Patient: the kind a trick play doesn’t fool.'}`, good: t >= 0.45};
  }
  return null;
}
export const CALL_LABEL = {pass: 'Pass', run: 'Run', rpo: 'RPO', trick: 'Trick play', spike: 'Spike', timeout: 'Timeout', fg: 'Field goal', kick: 'Extra point'};
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
// The league's drives ride on each phone's Daily board doc (players/{uid}, daily.js), like 17-0's: dr2: {n: {r ('W'|
// 'T'|'L'), c (seconds left), p (plays), y (furthest the ball got, yards from your own goal), k (the actions), t
// (when)}} and drb2: {b (best Survivor run), t}. A finished day posts by itself (autoPost) once the board has loaded,
// and again after a failed post. One drive per member per day: across a member's phones the first finished counts.
// (These are the second engine's fields; the first one's d2m and d2s don't replay in it.)
const F = 'dr2', FS = 'drb2', POST_BACK = 7;
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
