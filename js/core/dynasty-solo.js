// Gridiron Dynasty's Solo battles against the computer (the owner, Oct 29 2026: "Provide a solo mode against the
// computer"), as Pokémon TCG Pocket's Solo: twelve computer opponents in four levels (Beginner, Intermediate, Advanced,
// Expert), each with its own deck of two types, stronger players and smarter play the higher the level. The rules are
// core/dynasty-battle.js's; the battle plays on the same screen as a match between players (views/dynasty-battle.js,
// /puzzles/dynasty/battle/cpu…), the computer taking its turn a move at a time so you see it.
// One battle at a time, kept on this phone (localStorage, per profile): {id, opp, seed, decks [yours, its], log [[who,
// move]], at, z ('' | 'resign'), paid, pay}. The game is the replay of the log from the seed. A finished battle pays once
// (core/dynasty.js paySolo: coins for a win, the first win over each opponent its bonus packs); Solo battles never touch
// trophies or the versus record (Rankings are between players).
import * as D from './dynasty.js';
import * as B from './dynasty-battle.js';
import {profileKey} from './realm-active.js';

export const LEVELS = [
  {id: 'beg', name: 'Beginner', blurb: 'Common and Rare players, and a computer that keeps it simple.'},
  {id: 'int', name: 'Intermediate', blurb: 'Rare and Epic players, Trainer cards and a Stadium.'},
  {id: 'adv', name: 'Advanced', blurb: 'Epic, Legendary and Mythic players with their Gameday and Prime evolutions.'},
  {id: 'exp', name: 'Expert', blurb: 'Legends and Prime cards, played to win.'}
];
export const OPPONENTS = [
  {id: 'rookie-camp', lv: 'beg', name: 'Rookie Camp', types: ['A', 'G']},
  {id: 'practice-squad', lv: 'beg', name: 'Practice Squad', types: ['B', 'C']},
  {id: 'scout-team', lv: 'beg', name: 'Scout Team', types: ['A', 'C']},
  {id: 'air-raid', lv: 'int', name: 'Air Raid', types: ['A', 'B']},
  {id: 'ground-and-pound', lv: 'int', name: 'Ground and Pound', types: ['G', 'B']},
  {id: 'no-fly-zone', lv: 'int', name: 'No-Fly Zone', types: ['C', 'G']},
  {id: 'blitz-package', lv: 'adv', name: 'Blitz Package', types: ['B', 'A']},
  {id: 'west-coast', lv: 'adv', name: 'West Coast', types: ['A', 'G']},
  {id: 'steel-curtain', lv: 'adv', name: 'Steel Curtain', types: ['B', 'C']},
  {id: 'prime-time', lv: 'exp', name: 'Prime Time', types: ['A', 'C']},
  {id: 'hall-of-fame', lv: 'exp', name: 'Hall of Fame', types: ['G', 'B']},
  {id: 'the-dynasty', lv: 'exp', name: 'The Dynasty', types: ['A', 'B']}
];
export const opponent = id => OPPONENTS.find(o => o.id === id) || null;

// ---------------------------------------------------------------------------------------------------- its decks
// The same deck for an opponent on every phone (seeded by its id): its two types' Basic Live players in its level's OVR
// range (Expert: Legends too), their Gameday and Prime evolutions from Advanced up, and its level's Trainer cards, built
// as core/dynasty.js autoDeck builds yours.
const RANGE = {beg: [55, 66], int: [68, 79], adv: [78, 88], exp: [84, 99]};
const STADIUM = {A: 'S-sofi', G: 'S-lambeau', B: 'S-arrowhead', C: 'S-lumen'};
const KIT = {
  beg: {'I-recruit': 2, 'I-water': 2, 'C-twomin': 2, 'C-timeout': 1},
  int: {'I-recruit': 2, 'I-water': 2, 'C-twomin': 2, 'C-scout': 1, 'C-timeout': 1, 'C-audible': 1},
  adv: {'I-recruit': 2, 'I-water': 2, 'C-twomin': 2, 'C-plan': 1, 'C-flag': 1, 'C-audible': 1},
  exp: {'I-recruit': 2, 'I-water': 1, 'I-cleats': 1, 'C-twomin': 2, 'C-plan': 2, 'C-flag': 1, 'C-hail': 1}
};
const DECKS = new Map();
export function deckFor(id) {
  const o = opponent(id);
  if (!o || D.status !== 'ready') return [];
  if (DECKS.has(id)) return DECKS.get(id).slice();
  const R = D.rng('solo|' + id), [lo, hi] = RANGE[o.lv], owned = {...KIT[o.lv]};
  if (o.lv !== 'beg') owned[STADIUM[o.types[0]]] = 1;
  const pool = D.CARDS.filter(c => c.s === 'L' && B.isBasic(c.id) && o.types.includes(B.POS_TYPE[c.pos]) && c.o >= lo && c.o <= hi);
  const shuffled = pool.map(c => ({c, k: R()})).sort((a, b) => a.k - b.k).map(x => x.c);
  const picked = [];
  for (const t of o.types) picked.push(...shuffled.filter(c => B.POS_TYPE[c.pos] === t).slice(0, 7));
  picked.forEach(c => { owned[c.id] = 1; });
  if (o.lv === 'adv' || o.lv === 'exp') {
    D.CARDS.filter(c => (c.s === 'G' || c.s === 'P') && picked.some(p => p.p === c.p)).forEach(c => { owned[c.id] = 1; });
  }
  if (o.lv === 'exp') {
    D.CARDS.filter(c => c.s === 'X' && o.types.includes(B.POS_TYPE[c.pos])).map(c => ({c, k: R()})).sort((a, b) => a.k - b.k).slice(0, 4).forEach(x => { owned[x.c.id] = 1; });
  }
  const deck = D.autoDeck(owned);
  DECKS.set(id, deck);
  return deck.slice();
}

// ---------------------------------------------------------------------------------------------------- how it plays
// One move at a time for side who: set up with its best Basics, then each turn Items (Recruit while the bench has room,
// Water Bottle on a hurt player), Basics to the bench, evolutions, the energy where an attack needs it, a Coach card that
// helps now, its Stadium, a switch-out when the active player is about to fall, and the strongest attack it can pay.
// A Beginner keeps it simple: no Items, Coach cards or switching, and the first attack it can pay.
const atkOf = id => (B.stats(id) ? B.stats(id).attacks : []);
const best = id => Math.max(0, ...atkOf(id).map(a => a.dmg));
const left = s => B.hpOf(s) - s.dmg;
const needsEnergy = s => { const a = atkOf(s.id); return a.length && !B.canPay(a[a.length - 1].cost, s.en); };
export function nextMove(G, who, lv = 'int') {
  const me = G.p[who], opp = G.p[1 - who], ok = m => B.check(G, who, m).ok, smart = lv !== 'beg';
  if (G.phase === 'setup') {
    const b = me.hand.filter(B.isBasic).sort((x, y) => (B.stats(y).hp + best(y)) - (B.stats(x).hp + best(x)));
    return {a: 'setup', act: b[0], bench: b.slice(1, 1 + B.BENCH_MAX)};
  }
  if (me.promote) {
    const s = me.bench.slice().sort((x, y) => (y.en.length * 30 + left(y)) - (x.en.length * 30 + left(x)))[0];
    return {a: 'promote', u: s.u};
  }
  const all = B.slots(me), act = me.active, foe = opp.active;
  const tryAll = list => list.find(ok) || null;
  // Items
  let m;
  if (smart && me.hand.includes('I-recruit') && me.bench.length < B.BENCH_MAX && me.deck.some(B.isBasic) && (m = tryAll([{a: 'item', id: 'I-recruit'}]))) return m;
  const hurt = all.filter(s => s.dmg >= 20).sort((x, y) => (y === act) - (x === act) || y.dmg - x.dmg);
  if (smart && me.hand.includes('I-water') && hurt.length && (m = tryAll([{a: 'item', id: 'I-water', on: hurt[0].u}]))) return m;
  // Basics to the bench, then evolutions (the active player first)
  const basic = me.hand.find(id => B.isBasic(id) && ok({a: 'bench', id}));
  if (basic) return {a: 'bench', id: basic};
  for (const id of me.hand.filter(x => B.stats(x) && B.stats(x).stage === 1)) {
    const on = [act, ...me.bench].filter(Boolean).find(s => ok({a: 'evolve', id, on: s.u}));
    if (on) return {a: 'evolve', id, on: on.u};
  }
  // the energy: where the strongest attack still needs it (the active player first), a Beginner's always on its active
  if (me.en && !me.used.energy) {
    const want = act && needsEnergy(act) ? act : me.bench.find(needsEnergy) || act;
    if (want && ok({a: 'energy', on: want.u})) return {a: 'energy', on: want.u};
  }
  // a Coach card that helps now
  if (smart && !me.used.coach) {
    const has = id => me.hand.includes(id);
    const canHit = act && atkOf(act.id).some((a, n) => ok({a: 'attack', n}));
    const cands = [];
    if (has('C-timeout')) { const s = all.filter(x => x.dmg >= 30).sort((x, y) => y.dmg - x.dmg)[0]; if (s) cands.push({a: 'coach', id: 'C-timeout', on: s.u}); }
    if (has('C-twomin') && me.hand.length <= 5 && me.deck.length) cands.push({a: 'coach', id: 'C-twomin'});
    if (has('C-scout') && me.bench.length < B.BENCH_MAX && me.deck.some(B.isBasic)) cands.push({a: 'coach', id: 'C-scout'});
    if (smart) {
      if (has('C-plan') && canHit) cands.push({a: 'coach', id: 'C-plan'});
      if (has('C-flag') && foe && foe.en.length) cands.push({a: 'coach', id: 'C-flag'});
      if (has('C-hail') && foe) cands.push({a: 'coach', id: 'C-hail'});
      if (has('C-count') && foe && canHit) cands.push({a: 'coach', id: 'C-count'});
      if (has('C-room') && all.reduce((t, s) => t + s.dmg, 0) >= 40) cands.push({a: 'coach', id: 'C-room'});
      if (has('C-fourth') && act && needsEnergy(act)) { const s = me.bench.filter(x => x.en.length >= 2).sort((x, y) => y.en.length - x.en.length)[0]; if (s) cands.push({a: 'coach', id: 'C-fourth', on: s.u}); }
      if (has('C-audible') && act && left(act) <= B.hpOf(act) * 0.3) { const s = me.bench.slice().sort((x, y) => left(y) - left(x))[0]; if (s && left(s) > left(act)) cands.push({a: 'coach', id: 'C-audible', on: s.u}); }
    }
    if ((m = tryAll(cands))) return m;
  }
  // its Stadium, when the one in play isn't its own
  const stad = me.hand.find(id => B.TRAINERS[id] && B.TRAINERS[id].kind === 'stadium');
  if (stad && (!G.stadium || G.stadium.id !== stad) && ok({a: 'stadium', id: stad})) return {a: 'stadium', id: stad};
  // a switch-out before the active player falls (when it can't knock theirs out first)
  if (smart && act && me.bench.length && !me.used.retreat && foe && left(act) <= best(foe.id)) {
    const kos = atkOf(act.id).some((a, n) => ok({a: 'attack', n}) && a.dmg >= left(foe));
    const to = me.bench.slice().sort((x, y) => (y.en.length * 30 + left(y)) - (x.en.length * 30 + left(x)))[0];
    if (!kos && to && left(to) > left(act) && ok({a: 'retreat', to: to.u})) return {a: 'retreat', to: to.u};
  }
  // the strongest attack it can pay (a knockout first)
  if (act) {
    const opts = atkOf(act.id).map((a, n) => ({n, dmg: a.dmg})).filter(o => ok({a: 'attack', n: o.n}));
    if (opts.length) {
      if (!smart) return {a: 'attack', n: opts[0].n};
      const ko = foe && opts.find(o => o.dmg >= left(foe));
      return {a: 'attack', n: (ko || opts.sort((x, y) => y.dmg - x.dmg)[0]).n};
    }
  }
  return {a: 'end'};
}

// ---------------------------------------------------------------------------------------------------- the battle
const KEY = () => `gg-dys-${profileKey()}`;
const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
const emit = why => subs.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } });
let PROF = null, REC = null, CACHE = null, timer = 0;
export const isSolo = mid => /^cpu/.test(String(mid || ''));
function rec() {
  const key = profileKey();
  if (PROF !== key) {
    PROF = key; CACHE = null; clearTimeout(timer); timer = 0;
    try { REC = JSON.parse(localStorage.getItem(KEY()) || 'null'); } catch (_) { REC = null; }
    if (REC && (!REC.id || !opponent(REC.opp) || !Array.isArray(REC.log) || !Array.isArray(REC.decks))) REC = null;
  }
  return REC;
}
function write() { try { if (REC) localStorage.setItem(KEY(), JSON.stringify(REC)); else localStorage.removeItem(KEY()); } catch (_) {} }
/** The game from the battle's log (the same one each time: kept while the log is). */
function game(r) {
  if (CACHE && CACHE.id === r.id && CACHE.n === r.log.length) return CACHE.G;
  const G = B.newGame(r.seed, r.decks, 2);
  for (const [w, m] of r.log) { if (!B.play(G, w, m).ok) break; }
  CACHE = {id: r.id, n: r.log.length, G};
  return G;
}
function matchOf(r) {
  const o = opponent(r.opp), G = game(r);
  const base = {mid: r.id, solo: true, opp: {key: 'cpu', name: o.name, member: null, guest: false, cpu: o}, you: 0, G, at: r.at};
  let result = null, why = G.over && G.over.why;
  if (r.z === 'resign') { result = 'l'; why = 'resign'; }
  else if (G.phase === 'over') result = G.over.win === -1 ? 'd' : G.over.win === 0 ? 'w' : 'l';
  if (result) {
    // (paid once: core/dynasty.js paySolo)
    if (!r.paid && D.status === 'ready' && D.mayPlay()) { r.pay = D.paySolo(r.id, o.id, o.lv, result) || null; r.paid = 1; write(); }
    return {...base, state: 'over', result, why, pay: r.pay || null};
  }
  const state = G.phase === 'setup' ? (G.p[0].set ? 'theirs' : 'setup') : B.toMove(G) === 0 ? 'yours' : 'theirs';
  if (state === 'theirs') kick();
  return {...base, state};
}
/** Your Solo battle (the one in play or the last one), as the battle screen reads a match; null when there's none. */
export function get(mid) {
  if (!D.mayPlay() || D.status !== 'ready') return null;
  const r = rec();
  return r && (mid == null || r.id === mid) ? matchOf(r) : null;
}
/** The battle still being played, or null. */
export const current = () => { const x = get(); return x && x.state !== 'over' ? x : null; };
/** A new battle against opponent id with your deck (the one before it is dropped). {ok, why, mid}. */
export function start(id) {
  const o = opponent(id);
  if (!o || !D.mayPlay() || D.status !== 'ready') return {ok: false, why: 'Solo battles aren’t open here.'};
  const dk = D.deckOf();
  if (!dk.ok) return {ok: false, why: `Your deck isn’t ready: ${dk.why}`};
  rec();
  const mid = 'cpu' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  REC = {id: mid, opp: o.id, seed: mid, decks: [dk.ids.slice(), deckFor(o.id)], log: [], at: Date.now(), z: '', paid: 0, pay: null};
  CACHE = null; clearTimeout(timer); timer = 0;
  // (the computer sets up at once)
  const G = game(REC), m = nextMove(G, 1, o.lv);
  if (B.play(G, 1, m).ok) { REC.log.push([1, m]); CACHE.n = REC.log.length; }
  write(); emit('start');
  return {ok: true, mid};
}
/** Your move (core/dynasty-battle.js play's moves); the computer answers on its turn. {ok, why, sent: false}. */
export function move(mid, m) {
  const x = get(mid);
  if (!x || !['setup', 'yours'].includes(x.state)) return {ok: false, why: 'It isn’t your move.'};
  const r = B.play(x.G, 0, m);
  if (!r.ok) return r;
  REC.log.push([0, m]); REC.at = Date.now(); CACHE.n = REC.log.length;
  write(); emit('move'); kick();
  return {ok: true, sent: false};
}
export function resign(mid) {
  const x = get(mid);
  if (!x || x.state === 'over') return {ok: false, why: 'This battle is over.'};
  REC.z = 'resign'; REC.at = Date.now(); clearTimeout(timer); timer = 0; write(); emit('resign');
  return {ok: true};
}
// (the computer's turn: a move every so often, so you see it play)
const STEP_MS = 750;
function kick() { if (!timer) timer = setTimeout(step, STEP_MS); }
function step() {
  timer = 0;
  const r = rec();
  if (!r || r.z || !D.mayPlay()) return;
  const G = game(r);
  if (G.phase === 'over' || B.toMove(G) !== 1) { emit('cpu'); return; }
  const o = opponent(r.opp);
  let m = nextMove(G, 1, o.lv);
  if (!B.play(G, 1, m).ok) { m = {a: 'end'}; if (!B.play(G, 1, m).ok) return; }
  r.log.push([1, m]); r.at = Date.now(); CACHE.n = r.log.length;
  write(); emit('cpu');
  if (G.phase !== 'over' && B.toMove(G) === 1) kick();
}
