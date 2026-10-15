// Two-Minute Drill core: the daily games (data/drill.json, written by tools/drill/build.py and tune.mjs), what this
// phone remembers, the league scoreboard and the words for each play. No DOM. Owner: Drill.
// The engine itself (snaps, possessions, the clock, the dice) is js/core/drill-sim.js.
//
//   load()                      -> Promise<doc> (memoized; a failed load can be retried)
//   todayNumber(), dateOf(n), dayLabel(n), scenario(n)   one game a day, the same for everyone; a new one at midnight
//   game(n)                     today's game so far, replayed from this phone's actions
//   record(n, s)                saves the game's actions after each one; the result once it's over (once a day)
//   Text: spot(s, ball, poss), downText(down, togo), clockText(sec), playText(s, play), callText(s, play),
//     tokenLabel(s, t), tokenShort(s, t), resultText(s), squares(s), shareText(n, s)
//   Coach comp: tendencies(s), coachComp(s) (the NFL head coach since 2018 whose late-game play-calling your calls fit
//     best)
//   Scoreboard: autoPost(), boardState(), boardRows(n) (by result, then call grade: gradeOf, gradeLetter),
//     weekRows(n), weekDays(n), weekLabel(n) (the week's standings), gameOf(key, n)
//   applyResets()               a member's game (or everyone's) cleared once, at the league's ask (RESETS, resetCut)
import {lsGet, lsSet, absLink} from './ui.js';
import * as daily from './daily.js';
import {me as dataMe} from './data.js';
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
/** Game number for a moment (local date): 1 on DOC.start, never below 1. */
export function todayNumber(t = new Date()) {
  const [y, m, d] = startParts();
  return 1 + Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}
export function dateOf(n) {
  const [y, m, d] = startParts();
  return new Date(y, m - 1, d + n - 1);
}
export const dayLabel = (n, o = {month: 'short', day: 'numeric', weekday: 'short'}) => dateOf(n).toLocaleDateString('en-US', o);
/** Day n's scenario: {n, o, d, us, them, t (always 120: 2:00 left), b, to, dto, s, g? (the real game: {wk, h, a, day})}.
 *  Every game starts with your ball. */
export function scenario(n) {
  const d = DOC.days[(n - 1) % DOC.days.length];
  return Object.assign({n}, d);
}
export const team = id => DOC.teams[id];

// ---------------------------------------------------------------------------------------------- memory
// 'gg-drill5': {days: {n: {a (actions), r ('W'|'T'|'L' once over), at}} (the last KEEP days), played, wins}
// (Earlier games, under 'gg-2m' and 'gg-drill2' to 'gg-drill4', were played on other engines or other days' situations
// and don't replay in this one, so they're left be.)
const KEY = 'gg-drill5', KEEP = 60;
function read() {
  let v = null;
  try { v = JSON.parse(lsGet(KEY) || 'null'); } catch (_) { v = null; }
  if (!v || typeof v !== 'object' || !v.days || typeof v.days !== 'object') v = {days: {}};
  if (!Number.isInteger(v.played)) v.played = 0;
  if (!Number.isInteger(v.wins)) v.wins = 0;
  return v;
}
function write(v) {
  const keys = Object.keys(v.days).map(Number).filter(Number.isInteger).sort((a, b) => b - a);
  keys.slice(KEEP).forEach(k => { delete v.days[k]; });
  lsSet(KEY, JSON.stringify(v));
}
const cleanActs = a => (typeof a === 'string' && /^[a-z0-9+,]{0,1600}$/.test(a) ? a : '');
/** Day n on this phone: {acts, result (null until it's over), at}. */
export function dayState(n) {
  const d = read().days[n] || {};
  return {acts: cleanActs(d.a), result: ['W', 'T', 'L'].includes(d.r) ? d.r : null, at: Number(d.at) || 0};
}
/** Day n's game, replayed. */
export function game(n) {
  return E.replay(scenario(n), DOC.teams, dayState(n).acts);
}
/** Saves day n's game after an action. A finished day changes no more. */
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
  return {played: v.played, wins: v.wins};
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
/** Where the ball is (yards from the goal line of the team with it): "DEN 35", "midfield", "SEA 12". */
export function spot(s, ball = s.ball, poss = s.poss) {
  const ids = E.idsFor(s, poss);
  if (ball === 50) return 'midfield';
  return ball < 50 ? `${ids.o} ${ball}` : `${ids.d} ${100 - ball}`;
}
const ORD = ['', '1st', '2nd', '3rd', '4th'];
export function downText(down, togo, ball) {
  const goal = ball != null && 100 - ball <= togo;
  return `${ORD[Math.min(4, down)]} & ${goal ? 'goal' : togo}`;
}
export const clockText = sec => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, Math.round(sec)) % 60).padStart(2, '0')}`;
const yds = g => `${Math.abs(g)} yard${Math.abs(g) === 1 ? '' : 's'}`;
const SIDE = {s: 'strong side', w: 'weak side'};
const routeName = r => (E.ROUTES[r] ? E.ROUTES[r].name.toLowerCase() : 'route');
const article = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const U = (s, p) => E.unitsFor(s, p.poss || 'us');
const offName = (s, p, slot) => U(s, p).o.by[slot].n;
const defName = (s, p, slot) => (U(s, p).d.by[slot] ? U(s, p).d.by[slot].n : '');
/** A token in words: "Mesh: pass to Moore, dig, play action", "HB Toss, weak side", "Cover 2". s: the game (for
 *  names); p: the play it made (for a pass play's name). */
export function tokenLabel(s, t, p = null) {
  const a = E.parse(t);
  if (!a) return '';
  const fl = a.flags || {};
  const extra = [fl.a ? 'play action' : '', fl.r ? 'roll out' : '', fl.o ? 'get out of bounds' : '', fl.h ? 'no huddle' : ''].filter(Boolean);
  let base;
  if (a.kind === 'pass') base = `${p && E.PASS_PLAYS[p.pp] ? `${E.PASS_PLAYS[p.pp].name}: pass` : 'Pass'} to ${lastName(s.mine.by[a.slot].n)}, ${routeName(a.route)}`;
  else if (a.kind === 'run') base = `${E.RUNS[a.play].name}, ${SIDE[a.dir]}`;
  else if (a.kind === 'rpo') base = `${E.RPOS[a.play].name}, ${SIDE[a.dir]}`;
  else if (a.kind === 'trick') base = E.TRICKS[a.play].name;
  else if (a.kind === 'def') base = E.CALLS[a.call].name;
  else base = {spike: 'Spike', timeout: 'Timeout', fg: 'Field goal', kick: 'Kick the extra point', kneel: 'Kneel'}[a.kind];
  return [base].concat(extra).join(', ');
}
/** A token in few words, for the list of every option: "Moore dig (PA)", "HB Draw weak", "Quarters". */
export function tokenShort(s, t) {
  const a = E.parse(t);
  if (!a) return '';
  const fl = a.flags || {};
  const extra = [fl.a ? 'PA' : '', fl.r ? 'roll' : '', fl.o ? 'OOB' : '', fl.h ? 'no huddle' : ''].filter(Boolean).join(', ');
  const tail = extra ? ` (${extra})` : '';
  if (a.kind === 'pass') return `${lastName(s.mine.by[a.slot].n)} ${routeName(a.route)}${tail}`;
  if (a.kind === 'run' || a.kind === 'rpo') return `${(a.kind === 'run' ? E.RUNS : E.RPOS)[a.play].name} ${a.dir === 's' ? 'strong' : 'weak'}${tail}`;
  if (a.kind === 'trick') return E.TRICKS[a.play].name;
  if (a.kind === 'def') return E.CALLS[a.call].name;
  return {spike: 'Spike', timeout: 'Timeout', fg: 'Field goal', kick: 'Extra point', kneel: 'Kneel'}[a.kind];
}
const tailOf = p => [p.first ? 'first down' : '', p.oob ? 'out of bounds' : '', p.warn ? 'two-minute warning' : '',
  p.after && p.after.poss === p.poss && !p.td ? (p.after.running ? 'clock running' : 'clock stopped') : ''].filter(Boolean).join(', ');
/** What happened to the ball after a play: a kickoff, a turnover, a punt. */
function changeText(s, p) {
  const A = p.after;
  if (!A || A.poss === p.poss) return '';
  const ids = E.idsFor(s, A.poss);
  const team = A.poss === 'us' ? 'Your' : `${ids.o}`;
  const where = A.ball === 25 && (p.td || p.kind === 'fg' || p.kind === 'their-fg' || p.kind === 'xp' || p.two) ? 'at the 25 after the kickoff' : `on the ${spot(s, A.ball, A.poss)}`;
  return A.clock > 0 ? ` ${team} ball ${where}, ${clockText(A.clock)} left.` : '';
}
/** One play in words, from your side: {head ("Incomplete", "+14", "Touchdown", "Stop"), line (broadcast style), tone
 *  ('good' | 'bad' | 'flat' | 'score': good or bad for you)}. */
export function playText(s, p) {
  const t = p.poss === 'them' ? theirText(s, p) : ourText(s, p);
  t.line += changeText(s, p);
  return t;
}
const TRICK_LINE = {f: 'The flea flicker', h: 'The halfback pass', r: 'The double reverse'};
const RPO_ROUTE = {s: 'slant', b: 'bubble', g: 'seam'};
const RUN_HOW = {z: 'runs', t: 'takes the toss', d: 'runs the draw'};
function ourText(s, p) {
  const qb = lastName(offName(s, p, 'QB'));
  const trick = TRICK_LINE[p.trick] || 'The trick play';
  const thrower = p.trick === 'h' ? lastName(offName(s, p, 'RB')) : qb;
  const tail = tailOf(p);
  const route = p.route ? routeName(p.route) : '';
  const to = p.who ? short(offName(s, p, p.who)) : '';
  const on = route ? ` on ${article(route)} ${route}` : '';
  const xp = p.xp ? ' Extra point is good.' : '';
  switch (p.kind) {
    case 'timeout': return {head: 'Timeout', line: `Clock stopped at ${clockText(p.after.clock)}. ${p.after.tos} left.`, tone: 'flat'};
    case 'spike': return {head: 'Spiked', line: `${qb} spikes it to stop the clock: ${downText(p.after.down, p.after.togo, p.after.ball)}, ${clockText(p.after.clock)} left.`, tone: 'flat'};
    case 'kneel': return {head: 'Kneel', line: `${qb} takes a knee.`, tone: 'flat'};
    case 'kneelout': return {head: 'Ballgame', line: `${qb} takes a knee and runs out the clock.`, tone: 'score'};
    case 'expired': return {head: 'Time', line: 'The clock ran out before the snap. A timeout or a spike would have stopped it.', tone: 'bad'};
    case 'fg': return {head: 'It’s good', line: `${p.dist}-yard field goal by ${lastName(s.mine.k.n)}.`, tone: 'score'};
    case 'fgx': return {head: 'No good', line: `${p.dist}-yard field goal by ${lastName(s.mine.k.n)} misses.`, tone: 'bad'};
    case 'xp': return {head: 'Extra point', line: 'The extra point is good.', tone: 'score'};
    case '2good': return {head: 'Two!', line: `Two-point try: ${twoLine(s, p)}`, tone: 'score'};
    case '2fail': return {head: 'Stopped', line: `Two-point try: ${twoLine(s, p)}`, tone: 'bad'};
    case 'int': return {head: 'Intercepted', line: p.trick ? `${trick}: ${thrower} heaves it deep and ${defName(s, p, p.by)} picks it off.` : `${qb} looks for ${to}${on}: picked off by ${defName(s, p, p.by)}.`, tone: 'bad'};
    case 'fum': return {head: 'Fumble', line: p.who ? `${p.trick ? `${trick}: ` : ''}${lastName(offName(s, p, p.who))} fumbles and ${defName(s, p, p.by)} recovers.` : `Strip sack by ${defName(s, p, p.by)}.`, tone: 'bad'};
    case 'sack': return {head: `Sack ${p.gain}`, line: p.trick === 'h' ? `${trick}: ${defName(s, p, p.by)} runs down ${thrower} for a loss of ${Math.abs(p.gain)}: ${tail}.` : `${defName(s, p, p.by)} sacks ${qb} for a loss of ${Math.abs(p.gain)}: ${tail}.`, tone: 'bad'};
    case 'inc': return {head: 'Incomplete', line: p.trick ? `${trick} falls incomplete: ${tail}.` : `${qb} looks for ${to}${on}: incomplete, ${tail}.`, tone: 'flat'};
    case 'catch': {
      if (p.td) return {head: 'Touchdown', line: `${p.trick ? `${trick}! ` : ''}${thrower} finds ${to}${p.trick ? '' : on} for a ${p.gain}-yard touchdown.${xp}${s.phase === 'pat' && p === s.plays[s.plays.length - 1] ? ' Now the try: kick it, or go for two.' : ''}`, tone: 'score'};
      const what = p.read === 'pass' ? `RPO: ${qb} pulls it and fires to ${to} on ${article(RPO_ROUTE[p.rpo] || 'slant')} ${RPO_ROUTE[p.rpo] || 'slant'}` : p.trick ? `${trick}! ${thrower} hits ${to} deep` : `${qb} hits ${to}${on}`;
      return {head: p.gain >= 0 ? `+${p.gain}` : `${p.gain}`, line: `${what} for ${p.gain >= 0 ? yds(p.gain) : 'a loss of ' + Math.abs(p.gain)}${p.broke ? ', breaking a tackle' : ''}${p.downs ? ': short, turnover on downs.' : `: ${tail}.`}`, tone: p.downs ? 'bad' : p.first || p.gain >= 10 ? 'good' : p.gain <= 2 ? 'flat' : 'good'};
    }
    case 'run': {
      const who = lastName(offName(s, p, p.who || 'RB'));
      const rev = p.trick === 'r';
      const keep = p.read === 'run' ? 'RPO, handed off: ' : rev ? `${trick}${p.gain > 0 ? '!' : ':'} ` : '';
      const how = rev ? 'comes back the other way' : `${RUN_HOW[p.rk] || 'runs'} ${SIDE[p.dir]}`;
      const pat = s.phase === 'pat' && p === s.plays[s.plays.length - 1] ? ' Now the try: kick it, or go for two.' : '';
      if (p.td) return {head: 'Touchdown', line: `${keep}${who} ${rev ? 'takes it all the way' : `${RUN_HOW[p.rk] || 'runs'} it in`} from ${p.gain} out${rev ? '' : ` on the ${SIDE[p.dir]}`}.${xp}${pat}`, tone: 'score'};
      const head = p.gain > 0 ? `+${p.gain}` : p.gain === 0 ? 'No gain' : `${p.gain}`;
      const end = p.downs ? ': short, turnover on downs.' : `: ${tail}.`;
      const line = p.gain > 0 ? `${keep}${who} ${how} for ${yds(p.gain)}${p.broke ? ', breaking a tackle' : ''}${end}`
        : `${keep}${who} is ${p.gain === 0 ? 'stopped for no gain' : `dropped for a loss of ${Math.abs(p.gain)}`} by ${defName(s, p, p.by)}${end}`;
      return {head, line, tone: p.gain <= 0 || p.downs ? 'bad' : p.first || p.gain >= 8 ? 'good' : 'flat'};
    }
    default: return {head: '', line: tokenLabel(s, p.act), tone: 'flat'};
  }
}
function theirText(s, p) {
  const qb = lastName(offName(s, p, 'QB'));
  const team = E.idsFor(s, 'them').o;
  const tail = tailOf(p);
  const route = p.route ? routeName(p.route) : '';
  const to = p.who ? short(offName(s, p, p.who)) : '';
  const on = route ? ` on ${article(route)} ${route}` : '';
  const pre = p.theirTO ? `${team} calls a timeout first. ` : '';
  const after = p.td ? (p.their2 === true ? ' They go for two and get it.' : p.their2 === false ? ' They go for two and miss.' : ' Extra point is good.') : '';
  switch (p.kind) {
    case 'timeout': return {head: 'Timeout', line: `You stop the clock at ${clockText(p.after.clock)}. ${p.after.tos} left.`, tone: 'flat'};
    case 'kneelout': return {head: 'Ballgame', line: `${qb} takes a knee and ${team} runs out the clock.`, tone: 'bad'};
    case 'their-fg': return {head: 'Field goal', line: `${team} kicks a ${p.dist}-yard field goal.`, tone: 'bad'};
    case 'their-fgx': return {head: 'No good!', line: `${team}’s ${p.dist}-yard try misses.`, tone: 'good'};
    case 'punt': return {head: 'Punt', line: `${team} punts.`, tone: 'good'};
    case 'their-spike': return {head: 'Spike', line: `${qb} spikes it to stop the clock.`, tone: 'flat'};
    case 'expired': return {head: 'Time', line: 'The clock runs out before their snap.', tone: 'good'};
    case 'int': return {head: 'Interception!', line: `${pre}${qb} looks for ${to}${on}: picked off by ${defName(s, p, p.by)}.`, tone: 'score'};
    case 'fum': return {head: 'Fumble!', line: `${pre}${p.who === 'RB' ? `${lastName(offName(s, p, 'RB'))} fumbles and ${defName(s, p, p.by)} recovers.` : `${defName(s, p, p.by)} strips ${qb}: your ball.`}`, tone: 'score'};
    case 'sack': return {head: 'Sack!', line: `${pre}${defName(s, p, p.by)} sacks ${qb} for a loss of ${Math.abs(p.gain)}: ${tail}.`, tone: 'good'};
    case 'inc': return {head: 'Incomplete', line: `${pre}${qb} looks for ${to}${on}: incomplete${p.by ? `, broken up by ${short(defName(s, p, p.by))}` : ''}, ${tail}.`, tone: 'good'};
    case 'catch': {
      if (p.td) return {head: 'Touchdown', line: `${pre}${qb} finds ${to}${on} for a ${p.gain}-yard touchdown.${after}`, tone: 'bad'};
      return {head: p.downs ? 'Stopped!' : `+${p.gain}`, line: `${pre}${qb} hits ${to}${on} for ${yds(p.gain)}${p.broke ? ', breaking a tackle' : ''}${p.downs ? ': short of the sticks, turnover on downs.' : `: ${tail}.`}`, tone: p.downs ? 'good' : p.first || p.gain >= 8 ? 'bad' : 'flat'};
    }
    case 'run': {
      const who = lastName(offName(s, p, 'RB'));
      if (p.td) return {head: 'Touchdown', line: `${pre}${who} runs it in from ${p.gain} out.${after}`, tone: 'bad'};
      const end = p.downs ? ': stopped short, turnover on downs.' : `: ${tail}.`;
      return {head: p.downs ? 'Stopped!' : p.gain > 0 ? `+${p.gain}` : 'Stuffed', line: p.gain > 0 ? `${pre}${who} ${RUN_HOW[p.rk] || 'runs'} for ${yds(p.gain)}${p.broke ? ', breaking a tackle' : ''}${end}` : `${pre}${who} is stopped by ${defName(s, p, p.by)}${p.gain < 0 ? ` for a loss of ${-p.gain}` : ''}${end}`, tone: p.gain <= 1 || p.downs ? 'good' : p.first ? 'bad' : 'flat'};
    }
    default: return {head: '', line: '', tone: 'flat'};
  }
}
function twoLine(s, p) {
  const qb = lastName(offName(s, p, 'QB'));
  const thrower = p.trick === 'h' ? lastName(offName(s, p, 'RB')) : qb;
  if (p.res === 'catch') return `${thrower} finds ${short(offName(s, p, p.who))} in the end zone.`;
  if (p.res === 'run') return p.gain >= 2 ? `${lastName(offName(s, p, p.who || 'RB'))} punches it in.` : `${lastName(offName(s, p, p.who || 'RB'))} is stopped short.`;
  if (p.res === 'inc') return `${qb}’s pass for ${short(offName(s, p, p.who))} falls incomplete.`;
  if (p.res === 'sack') return `${qb} is sacked.`;
  if (p.res === 'int') return `${qb} is picked off.`;
  return 'No good.';
}
/** What the defense was really in and how it met the play: {text, good (for you)}, or null. */
export function callText(s, p) {
  const C = E.CALLS[p.dcall];
  if (!C) return null;
  const a = E.parse(p.act) || {};
  if (p.poss === 'them') {
    const t = p.their || {};
    const cname = `Your ${C.name}`;
    if (p.kind === 'sack' || (p.kind === 'fum' && p.who !== 'RB')) return {text: `${cname} got home: the rush beat the throw.`, good: true};
    if (t.kind === 'pass') {
      const fx = E.FX[p.dcall].cat[E.ROUTES[t.route].cat][0];
      const the = `the ${routeName(t.route)} to ${short(offName(s, p, t.slot))}`;
      return fx <= -0.03 ? {text: `${E.FORMS[p.form] ? `Out of the ${E.FORMS[p.form].name.toLowerCase()}, they` : 'They'} threw ${the}. ${cname} (${C.what}) was built to stop it.`, good: true}
        : fx >= 0.03 ? {text: `They threw ${the}, right where ${cname} (${C.what}) is soft.`, good: false}
        : {text: `They threw ${the}. ${cname} (${C.what}) had no edge either way.`, good: true};
    }
    if (t.kind === 'run') {
      const r = E.FX[p.dcall].run;
      return r <= -1 ? {text: `They ran it, and ${cname} (${C.what}) was waiting.`, good: true}
        : r >= 1.5 ? {text: `They ran it into ${cname} (${C.what}): light up front, room to run.`, good: false}
        : {text: `They ran it against ${cname} (${C.what}).`, good: true};
    }
    return null;
  }
  if (!p.look) return null;
  const look = E.LOOKS[p.look].name.toLowerCase();
  const is = `The ${look} was ${C.name} (${C.what})`;
  if (p.kind === 'sack' || (p.kind === 'fum' && p.who !== 'RB')) {
    const pa = a.flags && a.flags.a && !(E.FX[p.dcall].pa || p.look === 'box');
    return {text: `${is}. The rush got home${pa ? ': play action held the ball too long' : a.flags && a.flags.r ? ' even on the roll out' : ''}.`, good: false};
  }
  if (a.kind === 'pass' || (a.kind === 'rpo' && p.read === 'pass')) {
    const route = a.kind === 'pass' ? a.route : p.route, slot = a.kind === 'pass' ? a.slot : p.who;
    const fx = E.FX[p.dcall].cat[E.ROUTES[route].cat][0];
    const the = `the ${routeName(route)} to ${short(s.mine.by[slot].n)}`;
    if (a.kind === 'rpo') return {text: `${is}: the QB read it and threw. ${fx >= 0 ? 'Right read.' : 'It was waiting for the quick throw.'}`, good: fx >= 0};
    return fx >= 0.03 ? {text: `${is}, and ${the} was the answer to it.`, good: true}
      : fx <= -0.03 ? {text: `${is}, set up to stop ${the}.`, good: false}
      : {text: `${is}. Nothing special against ${the}.`, good: true};
  }
  if (a.kind === 'run' || a.kind === 'rpo') {
    const into = a.dir === p.shade;
    const draw = a.kind === 'run' && a.play === 'd' ? E.DRAW[p.dcall] : 0;
    const fxr = E.FX[p.dcall].run + draw + (into ? -1.2 : 1.0);
    const side = into ? 'you ran right at the side it leaned to' : 'you ran away from its lean';
    if (draw >= 1) return {text: `${is}: a rush and soft coverage, what a draw eats up, and ${side}.`, good: true};
    if (draw <= -1) return {text: `${is}: everyone crashing the line, and a draw takes too long to get going.`, good: false};
    return {text: `${is}, and ${side}.`, good: fxr >= 0};
  }
  if (a.kind === 'trick') {
    const t = E.trickOdds(a.play, p.dcall), name = {f: 'flea flicker', h: 'halfback pass', r: 'double reverse'}[a.play];
    return {text: `${is}. ${t >= 0.45 ? `Aggressive: the kind a ${name} fools.` : `Patient: the kind a ${name} doesn’t fool.`}`, good: t >= 0.45};
  }
  return null;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Your snaps that were plays (timeouts, spikes and kneels not counted). */
export const playCount = s => s.plays.filter(p => p.act && !['timeout', 'spike', 'expired', 'xp', 'kneel'].includes(p.kind)).length;
/** The final: {head ("You win"), score ("24–21"), sub (how it ended)}. you: false for someone else's game. */
export function resultText(s, {you = true} = {}) {
  const score = `${s.us}–${s.them}`;
  const last = s.plays[s.plays.length - 1] || {};
  const ids = E.idsFor(s, 'us');
  let how;
  if (s.why === 'kneel') how = 'Took a knee to end it';
  else if (s.why === 'their-kneel') how = `${ids.d} knelt it out`;
  else if (last.poss === 'them') how = s.result === 'W' ? 'The defense held on' : s.result === 'L' ? `${ids.d} answered` : 'Tied at the end';
  else if (last.kind === 'fg' || last.td || last.kind === 'xp' || last.kind === '2good') how = 'Scored as time ran out';
  else how = 'Time ran out';
  if (s.result === 'W') return {head: you ? 'You win' : 'Won', score, sub: how};
  if (s.result === 'T') return {head: 'Tied. Overtime', score, sub: how};
  return {head: you ? 'You lose' : 'Lost', score, sub: how};
}
/** A square per snap: yours (big gain 🟩, gain 🟨, nothing ⬜, loss 🟥, turnover ❌, score 🏈 or 🥅), then theirs after a
 *  space (stop 🟦, gain 🟧, first down 🟥, takeaway ⭐, their score ❌). */
export function squares(s) {
  let out = '', poss = 'us';
  s.plays.forEach(p => {
    if (p.poss !== poss) { out += ' '; poss = p.poss; }
    if (['timeout', 'xp', 'kneel', 'kneelout', 'their-spike'].includes(p.kind)) return;
    if (p.poss === 'them') {
      if (p.kind === 'int' || p.kind === 'fum' || p.kind === 'their-fgx' || p.downs) out += '⭐';
      else if (p.td || p.kind === 'their-fg') out += '❌';
      else if (p.kind === 'punt') out += '🟦';
      else if (p.kind === 'inc' || p.kind === 'sack' || (p.gain || 0) <= 1) out += '🟦';
      else out += p.first ? '🟥' : '🟧';
      return;
    }
    if (p.kind === 'spike') out += '⏱️';
    else if (p.td || p.kind === '2good') out += '🏈';
    else if (p.kind === 'fg') out += '🥅';
    else if (p.kind === 'int' || p.kind === 'fum' || p.kind === 'fgx' || p.kind === '2fail' || p.kind === 'expired' || p.downs) out += '❌';
    else if (p.kind === 'inc') out += '⬜';
    else if (p.gain < 0) out += '🟥';
    else out += p.first || p.gain >= 10 ? '🟩' : p.gain > 0 ? '🟨' : '⬜';
  });
  return out.trim();
}
/** The final score and a square per snap. No player names. */
export function shareText(n, s) {
  const r = resultText(s), ids = E.idsFor(s, 'us');
  const mark = {W: 'W', T: 'T', L: 'L'}[s.result];
  return [
    `Two-Minute Drill #${n} · ${dayLabel(n)}`,
    `${ids.o} down ${s.sc.them - s.sc.us} with ${clockText(s.sc.t)} left`,
    `Final: ${ids.o} ${s.us}, ${ids.d} ${s.them} (${mark}) · ${r.sub}`,
    squares(s),
    absLink('/puzzles/drill')
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------- coach comp
// Who you called it like: DOC.coaches (tools/drill/coaches.py) has each NFL head coach's late-game play-calling since
// 2018 as counts [k, n] of the same things counted from your calls (drill-sim.js tendencies). His leans are from the
// league's rates, yours from how this game is usually played (DOC.coaches.base: the game counts some things its own
// way), each rate first pulled toward its baseline by DOC.coaches.prior (how much that tendency really varies from
// coach to coach: a short sample, yours or a short career, says little, and so does a thing every coach does alike),
// each lean measured in how far apart coaches really are on it. The comp is the coach who leans the same ways you do,
// in the same mix (the closest direction: the most like you in style, not the most extreme or the most average), and
// the words name the two leans you share with him most.
const PRIOR = 12;
export const TENDENCIES = E.TENDENCIES, tendencies = E.tendencies;
const plays = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** How each tendency reads: [when you did it more than most, when less]. k of n, t: what's typical in n. */
const COMP_WORDS = {
  pass: [(k, n, t) => `threw it on ${k} of ${n} snaps (typical: ${t})`, (k, n, t) => `ran it on ${k} of ${n} snaps (typical: ${t})`],
  deep: [(k, n, t) => `took ${plays(k, 'deep shot')} in ${plays(n, 'throw')} (typical: ${t})`, (k, n, t) => `stayed underneath on ${k} of ${n} throws (typical: ${t})`],
  short: [(k, n, t) => `kept it short on ${k} of ${n} throws (typical: ${t})`, (k, n, t) => `pushed it downfield on ${k} of ${n} throws (typical: ${t})`],
  middle: [(k, n, t) => `attacked the middle on ${k} of ${n} throws (typical: ${t})`, (k, n, t) => `worked the outside on ${k} of ${n} throws (typical: ${t})`],
  oob: [(k, n, t) => `got out of bounds on ${k} of ${n} plays (typical: ${t})`, (k, n, t) => `stayed in bounds on ${k} of ${n} plays (typical: ${t})`],
  spike: [(k, n, t) => `spiked it ${k} of ${n} snaps (typical: ${t})`, (k, n, t) => `never spiked it in ${plays(n, 'snap')} (typical: ${n - t})`],
  hurry: [(k, n, t) => `went no-huddle on ${k} of ${n} snaps with the clock running (typical: ${t})`, (k, n, t) => `huddled up on ${k} of ${n} snaps with the clock running (typical: ${t})`],
  timeout: [(k, n, t) => `burned a timeout on ${k} of ${n} chances to stop the clock (typical: ${t})`, (k, n, t) => `let the clock run with a timeout in hand ${k} of ${n} times (typical: ${t})`],
  two: [(k, n, t) => `went for two ${k} of ${n} times (typical: ${t})`, (k, n, t) => `kicked the extra point ${k} of ${n} times (typical: ${t})`],
  fourth: [(k, n, t) => `went for it on fourth down ${k} of ${n} times (typical: ${t})`, (k, n, t) => `kicked the field goal on fourth down ${k} of ${n} times (typical: ${t})`]
};
/** The coach whose tendencies fit these counts best: {coach (DOC.coaches.list's), lines (the two calls that point to
 *  him most, in words)}, or null (no coaches, or too few snaps to say). */
export function matchCoach(f) {
  const C = DOC && DOC.coaches;
  if (!C || !Array.isArray(C.list) || !C.list.length || f.spike[1] < 3) return null;
  const L = C.league;
  const used = Object.keys(f).filter(k => f[k][1] > 0 && L[k] > 0 && L[k] < 1);
  const K = k => (C.prior && C.prior[k]) || PRIOR;
  const B = k => (C.base && C.base[k] > 0 && C.base[k] < 1 ? C.base[k] : L[k]);
  const pull = ([hit, n], k, mid) => (hit + K(k) * mid) / (n + K(k));
  const rate = (c, k) => pull(c.f[k], k, L[k]);
  const spread = k => Math.sqrt(L[k] * (1 - L[k]) / (K(k) + 1));
  const you = used.map(k => (pull(f[k], k, B(k)) - B(k)) / spread(k));
  let best = null;
  C.list.forEach(c => {
    const his = used.map(k => (rate(c, k) - L[k]) / spread(k));
    const dot = you.reduce((t, x, i) => t + x * his[i], 0), norm = Math.hypot(...his) || 1;
    const v = dot / norm;
    if (!best || v > best.v) best = {c, v};
  });
  const lines = used.map((k, i) => ({k, e: you[i] * (rate(best.c, k) - L[k]) / spread(k)}))
    .filter(x => x.e > 0.01).sort((a, b) => b.e - a.e).slice(0, 2)
    .map(({k}) => {
      const [hit, n] = f[k], more = hit / n >= B(k);
      return more ? COMP_WORDS[k][0](hit, n, Math.round(n * B(k))) : COMP_WORDS[k][1](n - hit, n, Math.round(n * (1 - B(k))));
    });
  return {coach: best.c, lines};
}
/** The comp for a finished game: {name, team (id), teamName, snaps, seasons, text ("Like him, you ...")}, or null.
 *  who: 'you', or someone else's name (the words then say "they"). */
export function coachComp(s, who = 'you') {
  const m = matchCoach(tendencies(s));
  if (!m) return null;
  const c = m.coach, T = DOC.teams[c.t];
  const subj = who === 'you' ? 'you' : 'they';
  const text = m.lines.length ? `Like him, ${subj} ${m.lines.join(', and ')}.` : `${who === 'you' ? 'Your' : 'Their'} calls fit his late-game tendencies best.`;
  const seasons = Array.isArray(c.y) ? (c.y[0] === c.y[1] ? `${c.y[0]}` : `${c.y[0]}–${c.y[1]}`) : DOC.coaches.seasons;
  return {name: c.n, team: c.t, teamName: T ? T.n : c.t, snaps: c.s, seasons, text};
}

// ---------------------------------------------------------------------------------------------- scoreboard
// The league's games ride on each phone's Daily board doc (players/{uid}, daily.js), like 17-0's: dr5: {n: {r ('W'|'T'|
// 'L'), u (your points), h (theirs), p (plays), k (the actions), t (when)}}. A finished day posts by itself (autoPost)
// once the board has loaded, and again after a failed post. One game per member per day: across a member's phones the
// first finished counts. (dr5 is these days'; the earlier dr4, dr3, dr2 and d2m games don't replay in them.)
const F = 'dr5', POST_BACK = 7;
let posting = false;
export function entryOf(p, n) {
  const e = p && p[F] && typeof p[F] === 'object' ? p[F][n] : null;
  if (!e || !['W', 'T', 'L'].includes(e.r) || !Number.isInteger(e.u) || !Number.isInteger(e.h)) return null;
  const want = e.u > e.h ? 'W' : e.u === e.h ? 'T' : 'L';
  if (want !== e.r || (Number(e.t) || 0) < resetCut(n)) return null;
  return {r: e.r, u: e.u, h: e.h, m: e.u - e.h, p: Math.max(0, e.p | 0), k: cleanActs(e.k), t: Number(e.t) || 0};
}
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
  return Object.keys(v.days).map(Number)
    .filter(n => Number.isInteger(n) && n <= top && n > top - POST_BACK && v.days[n].r)
    .filter(n => !theirs.some(p => entryOf(p, n)))
    .sort((a, b) => a - b);
}
export async function autoPost() {
  const LB = daily.LB;
  if (!DOC || posting || !LB.merge || !LB.ready || LB.off || !LB.uid) return false;
  const days = unposted();
  if (!days.length) return false;
  const v = read(), out = {};
  days.forEach(n => {
    const s = E.replay(scenario(n), DOC.teams, v.days[n].a);
    if (!s.result) return;
    out[n] = {r: s.result, u: s.us, h: s.them, p: playCount(s), k: E.actsOf(s), t: Number(v.days[n].at) || Date.now()};
  });
  if (!Object.keys(out).length) return false;
  const body = {[F]: out};
  const mine = docs().find(p => p.id === LB.uid);
  if (!mine) Object.assign(body, {nick: (daily.postName() || '').trim().slice(0, 24), total: 0});
  posting = true;
  try { await LB.merge(body); return true; } catch (_) { return false; } finally { posting = false; }
}
// ---------------------------------------------------------------------------------------------- resets
// A member's game cleared once so they can play the day again, at the league's ask: on that member's phones (once on
// each), on that day only, the saved game goes, and so does the result that phone posted before the reset (so the
// replay's posts in its place; a result posted after the reset stays). 'gg-drill-resets': {id: when it ran here}.
// Or everyone's (who '*', below).
// who '*': the whole league's games that day, as of at (ms): every phone clears a game finished before then, and the
// board drops every result finished before then, whether or not that member's phone has opened since (resetCut).
const RESETS = [{id: 'evan-d1', who: 'evan', n: 1}, {id: 'evan-d1-2', who: 'evan', n: 1}, {id: 'all-d1', who: '*', n: 1, at: 1792099293223},
  {id: 'all-d1-2', who: '*', n: 1, at: 1792101213382}, // again: the rosters updated for injuries
  {id: 'all-d1-3', who: '*', n: 1, at: 1792101841034}]; // and again, at the league's ask
/** When the league's games on day n were last reset (0: never): results finished before it don't count. */
export const resetCut = n => RESETS.reduce((m, r) => (r.who === '*' && r.n === Number(n) && r.at > m ? r.at : m), 0);
const RKEY = 'gg-drill-resets';
function resetsDone() {
  let v = null;
  try { v = JSON.parse(lsGet(RKEY) || 'null'); } catch (_) { v = null; }
  return v && typeof v === 'object' ? v : {};
}
/** Applies a reset meant for this phone's member today. Returns true when it cleared this phone's game (redraw). */
export function applyResets() {
  if (!DOC) return false;
  const LB = daily.LB, n0 = todayNumber();
  let cleared = false;
  RESETS.forEach(r => {
    if (r.n !== n0) return;
    const who = dataMe() || (LB.ready && LB.uid ? meKey() : null);
    if (r.who !== '*' && who !== r.who) return;
    const done = resetsDone();
    if (!done[r.id]) {
      const v = read(), d = v.days[r.n];
      // A league-wide reset keeps a game finished after it.
      if (d && !(r.at && d.r && Number(d.at) >= r.at)) {
        if (d.r) { v.played = Math.max(0, v.played - 1); if (d.r === 'W') v.wins = Math.max(0, v.wins - 1); }
        delete v.days[r.n];
        write(v);
        cleared = true;
      }
      done[r.id] = Date.now();
      lsSet(RKEY, JSON.stringify(done));
    }
    const board = r.id + ':board';
    if (done[board] || !LB.ready || !LB.merge || !LB.uid || LB.off) return;
    const mine = docs().find(p => p.id === LB.uid);
    const e = mine && mine[F] && typeof mine[F] === 'object' ? mine[F][r.n] : null;
    const mark = () => { const d2 = resetsDone(); d2[board] = Date.now(); lsSet(RKEY, JSON.stringify(d2)); };
    if (!e || !(Number(e.t) < (r.at || done[r.id]))) { mark(); return; }
    LB.merge({[F]: {[r.n]: null}}).then(mark, () => {});
  });
  return cleared;
}

try {
  daily.subscribe(type => { if (type === 'lb') { applyResets(); autoPost(); } });
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
// ---------------------------------------------------------------------------------------------- call grades
// How well a game was called (drill-sim.js gradeGame): each pass, run, RPO, trick and defensive call scored against
// the best one at that snap by the play-caller's numbers, the mean out of 100. Worked out from a game's actions, so
// every phone grades every posted game the same way (nothing extra is posted, and a grade can't be made up).
const GRADES = new Map();
/** Day n's game from actions k: {grade (0-100 or null), n (calls rated), lead (a win's go-ahead clock)}. Memoized. */
export function gradeOf(n, k) {
  const key = `${n}|${k}`;
  if (!GRADES.has(key)) {
    let g = {grade: null, n: 0, lead: null};
    try { if (DOC && k) g = E.gradeGame(scenario(n), DOC.teams, k); } catch (_) { /* a game that won't replay: no grade */ }
    GRADES.set(key, g);
  }
  return GRADES.get(key);
}
const LETTERS = [[97, 'A+'], [93, 'A'], [90, 'A−'], [87, 'B+'], [83, 'B'], [80, 'B−'], [77, 'C+'], [73, 'C'], [70, 'C−'], [67, 'D+'], [60, 'D']];
/** A grade's letter: A+ (97 and up) down to F (under 60). */
export const gradeLetter = g => (g == null ? '' : (LETTERS.find(([min]) => Math.round(g) >= min) || [0, 'F'])[1]);
const rowWho = (ds, k) => {
  const mk = meKey(), uid = daily.LB.uid;
  const rep = ds.find(p => p.id === uid) || ds.slice().sort((a, b) => (b.last || 0) - (a.last || 0))[0];
  return {key: k, name: daily.displayName(rep), managerId: k.startsWith('row:') ? null : k, me: ds.some(p => p.id === uid) || (!!mk && k === mk)};
};
/**
 * Day n's scoreboard: one row per member, by the game's final result (wins, then ties, then losses), then within
 * each by the call grade (rounded, best first); then a win by the time left them after the go-ahead score (least
 * first: a walk-off beats leaving them a minute), fewer plays and the bigger margin; a tie by fewer plays; a loss by
 * the closer score and fewer plays. Rows that match on all of them share a rank.
 * Rows: {key, uid, name, managerId, me, r, u, h, m, p, k, grade, letter, lead, rank}. list: board docs (default
 * daily.LB's snapshot).
 */
export function boardRows(n = todayNumber(), list = docs()) {
  const rows = [];
  people(list).forEach((ds, k) => {
    const f = firstOf(ds, n);
    if (!f) return;
    const g = gradeOf(n, f.e.k);
    rows.push(Object.assign(rowWho(ds, k), {uid: f.doc.id}, f.e, {grade: g.grade, letter: gradeLetter(g.grade), lead: g.lead}));
  });
  const gi = r => (r.grade == null ? -1 : Math.round(r.grade)), li = r => (r.lead == null ? 1e9 : r.lead);
  const cmp = (a, b) => RANK[b.r] - RANK[a.r] || gi(b) - gi(a)
    || (a.r === 'W' ? li(a) - li(b) || a.p - b.p || b.m - a.m : a.r === 'L' ? b.m - a.m || a.p - b.p : a.p - b.p);
  rows.sort(cmp);
  rows.forEach((r, i) => { const q = rows[i - 1]; r.rank = q && !cmp(q, r) ? q.rank : i + 1; });
  return rows;
}
// ---------------------------------------------------------------------------------------------- the week
// The week's standings: the NFL week a day's game comes from (its days run Tuesday to Monday; past the season, blocks
// of seven), 3 points a win and 1 a tie, the average call grade breaking ties, and each member's current run of wins.
const weekKey = n => { const d = DOC.days[n - 1]; return d && d.g ? `w${d.g.wk}` : `b${Math.floor((n - 1) / 7)}`; };
/** The days of day n's week played so far (up to today). */
export function weekDays(n = todayNumber(), today = todayNumber()) {
  const key = weekKey(n), top = Math.min(today, DOC.days.length), out = [];
  for (let d = 1; d <= top; d++) if (weekKey(d) === key) out.push(d);
  return out;
}
/** What day n's week is called: "Week 6" (the NFL's), or its first and last days. */
export function weekLabel(n = todayNumber()) {
  const d = DOC.days[n - 1];
  if (d && d.g) return `Week ${d.g.wk}`;
  const ds = weekDays(n);
  return ds.length ? `${dayLabel(ds[0])} to ${dayLabel(ds[ds.length - 1])}` : '';
}
/**
 * Day n's week's standings: one row per member who has played in it, by points (3 a win, 1 a tie), then the average
 * call grade (rounded, best first), then wins. Rows: {key, name, managerId, me, w, t, l, played, pts, avg, best ({day,
 * grade, r, u, h}: the best-called game), streak (wins in a row up to the latest day played), rank}. Also rows.top: the
 * week's best-called game {name, me, day, grade, r, u, h}, or null.
 */
export function weekRows(n = todayNumber(), list = docs(), today = todayNumber()) {
  const days = weekDays(n, today), rows = [];
  let top = null;
  people(list).forEach((ds, k) => {
    const row = Object.assign(rowWho(ds, k), {w: 0, t: 0, l: 0, played: 0, pts: 0, avg: null, best: null, streak: 0});
    const gs = [];
    days.forEach(d => {
      const f = firstOf(ds, d);
      if (!f) return;
      const e = f.e, g = gradeOf(d, e.k).grade;
      row.played++;
      if (e.r === 'W') row.w++; else if (e.r === 'T') row.t++; else row.l++;
      if (g != null) {
        gs.push(g);
        if (!row.best || g > row.best.grade) row.best = {day: d, grade: g, r: e.r, u: e.u, h: e.h};
      }
    });
    if (!row.played) return;
    row.pts = 3 * row.w + row.t;
    row.avg = gs.length ? Math.round(10 * gs.reduce((a, b) => a + b, 0) / gs.length) / 10 : null;
    // The run of wins: back from today (or yesterday, if today's isn't in yet), day by day.
    for (let d = firstOf(ds, today) ? today : today - 1; d >= 1; d--) {
      const f = firstOf(ds, d);
      if (!f || f.e.r !== 'W') break;
      row.streak++;
    }
    if (row.best && (!top || row.best.grade > top.grade)) top = Object.assign({name: row.name, me: row.me}, row.best);
    rows.push(row);
  });
  const ai = r => (r.avg == null ? -1 : Math.round(r.avg));
  const cmp = (a, b) => b.pts - a.pts || ai(b) - ai(a) || b.w - a.w;
  rows.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { const q = rows[i - 1]; r.rank = q && !cmp(q, r) ? q.rank : i + 1; });
  rows.top = top;
  return rows;
}
/** The week's posted games not graded yet, as [day, actions] (for grading them a few at a time while the phone idles). */
export function ungraded(n = todayNumber(), list = docs(), today = todayNumber()) {
  const out = [], days = weekDays(n, today);
  people(list).forEach(ds => days.forEach(d => {
    const f = firstOf(ds, d);
    if (f && f.e.k && !GRADES.has(`${d}|${f.e.k}`)) out.push([d, f.e.k]);
  }));
  return out;
}
/** A member's game on day n (key: a scoreboard row's key), replayed from what they posted, or null. */
export function gameOf(key, n = todayNumber(), list = docs()) {
  const ds = people(list).get(key) || [];
  const f = firstOf(ds, n);
  if (!f) return null;
  return {entry: f.e, s: f.e.k ? E.replay(scenario(n), DOC.teams, f.e.k) : null};
}
