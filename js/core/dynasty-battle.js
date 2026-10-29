// Gridiron Dynasty's card battles (the owner's asks, Oct 28 2026: "Pokémon trading cards game. Battle with player cards
// that have special attacks or abilities", "Pocket style"; only multiplayer, in turns like chess). Pure: no DOM and no
// imports (node runs it too); the cards come in through setCards(). Everything follows from a match's seed, the two decks
// and the moves each player made, so every phone replays the same game (core/dynasty-match.js keeps the moves).
//
// THE RULES, after Pokémon TCG Pocket:
// - A deck is 20 cards: players, Coach cards (one a turn) and Stadiums; at most 2 of a player (any of his cards) or of
//   a Coach or Stadium card; at least one Basic player. You open with 5 cards (always a Basic among them), put a Basic
//   out as your active player and up to 3 more on your bench.
// - Each turn: draw a card; take the turn's energy from your Energy Zone (a Play Call of one of your deck's types, the
//   next turn's shown beside it; none on the first player's first turn) and attach it to one of your players; put
//   Basics on your bench; evolve (a Gameday or Prime card on the same player's Basic, not on the turn he came out nor on
//   your first turn); play Item cards (as many as you like), one Coach card (Pocket's Supporters) and a Stadium; switch
//   your active out once (his retreat cost in energy); then attack, which ends your turn (or end it without).
// - Version 2 (Oct 28 2026, the owner: "the gameplay ... to match the Pokémon app"): each turn's energy is known a turn
//   ahead (the Energy Zone's next), and Item cards. A match made before keeps version 1's energy draw (newGame's v).
// - Knock out the other side's active player for a touchdown (a Legend or Prime: two). Three wins it, as does knocking
//   out their last player. 50 turns between you and it's whoever's ahead.
// - Types (football's own logic): Air (QB, WR, TE) beats Blitz, Ground (RB, OL) beats Coverage, Blitz (DL, LB) beats
//   Ground, Coverage (CB, S) beats Air: +20 against the type it beats. Kickers are Special Teams: any energy, no weakness.
// - Every player card's HP, attacks and retreat come from his rating and position (stats(): the strongest of his card
//   attributes picks his second attack's trick); Legends, Prime and Award cards carry an Ability.

// ---------------------------------------------------------------------------------------------------- types
export const TYPES = {
  A: {name: 'Air', e: 'P', color: '#3FA9F5'},
  G: {name: 'Ground', e: 'R', color: '#2FB86B'},
  B: {name: 'Blitz', e: 'B', color: '#E5484D'},
  C: {name: 'Coverage', e: 'C', color: '#A970FF'},
  S: {name: 'Special Teams', e: '*', color: '#C9A227'}
};
export const ENERGY = {P: 'Pass', R: 'Run', B: 'Blitz', C: 'Coverage', '*': 'Any'};
export const ENERGY_TYPE = {P: 'A', R: 'G', B: 'B', C: 'C'};
export const POS_TYPE = {QB: 'A', WR: 'A', TE: 'A', RB: 'G', OL: 'G', DL: 'B', LB: 'B', CB: 'C', S: 'C', K: 'S'};
/** What each type is weak to (takes +20 from). */
export const WEAK = {A: 'C', G: 'B', B: 'A', C: 'G'};
export const WEAK_BONUS = 20;
export const DECK_SIZE = 20, HAND_START = 5, BENCH_MAX = 3, WIN_POINTS = 3, MAX_COPIES = 2, TURN_CAP = 50;

// ---------------------------------------------------------------------------------------------------- Coach and Stadium cards
// (C-: Coach cards, one a turn, Pokémon's Supporters; I-: Items, any number a turn; S-: Stadiums, in play for both sides
// till another replaces them)
export const TRAINERS = {
  'I-recruit': {kind: 'item', name: 'Recruit', r: 'epic', text: 'Put a random Basic player from your deck into your hand.'},
  'I-water': {kind: 'item', name: 'Water Bottle', r: 'epic', text: 'Heal 20 damage from one of your players.', target: 'mine'},
  'I-cleats': {kind: 'item', name: 'Speed Cleats', r: 'epic', text: 'During this turn, your active player’s switch-out costs 1 less energy.'},
  'C-timeout': {kind: 'coach', name: 'Timeout', r: 'epic', text: 'Heal 40 damage from one of your players.', target: 'mine'},
  'C-audible': {kind: 'coach', name: 'Audible', r: 'epic', text: 'Switch your active player with one on your bench.', target: 'bench'},
  'C-twomin': {kind: 'coach', name: 'Two-Minute Warning', r: 'epic', text: 'Draw 2 cards.'},
  'C-scout': {kind: 'coach', name: 'Scouting Report', r: 'epic', text: 'Put a random Basic player from your deck into your hand.'},
  'C-flag': {kind: 'coach', name: 'Penalty Flag', r: 'legendary', text: 'Discard an energy from your opponent’s active player.'},
  'C-hail': {kind: 'coach', name: 'Hail Mary', r: 'legendary', text: 'Flip 3 coins. 30 damage to your opponent’s active player for each heads.'},
  'C-plan': {kind: 'coach', name: 'Game Plan', r: 'legendary', text: 'Your active player’s attacks do 30 more damage this turn.'},
  'C-count': {kind: 'coach', name: 'Hard Count', r: 'legendary', text: 'Flip a coin. Heads: your opponent’s active player is Stunned.'},
  'C-room': {kind: 'coach', name: 'Trainer’s Room', r: 'epic', text: 'Heal 20 damage from each of your players and clear their conditions.'},
  'C-fourth': {kind: 'coach', name: 'Fourth and Inches', r: 'legendary', text: 'Move all the energy from one of your benched players to your active player.', target: 'bench'},
  'S-lambeau': {kind: 'stadium', name: 'Lambeau Field', team: 'GB', r: 'legendary', text: 'Frozen tundra: Ground attacks do 10 more damage.', boost: {G: 10}},
  'S-arrowhead': {kind: 'stadium', name: 'Arrowhead Stadium', team: 'KC', r: 'legendary', text: 'The loudest stadium: Blitz attacks do 10 more damage.', boost: {B: 10}},
  'S-sofi': {kind: 'stadium', name: 'SoFi Stadium', team: 'LA', r: 'legendary', text: 'Perfect conditions: Air attacks do 10 more damage.', boost: {A: 10}},
  'S-lumen': {kind: 'stadium', name: 'Lumen Field', team: 'SEA', r: 'legendary', text: 'The 12th Man: Coverage attacks do 10 more damage.', boost: {C: 10}},
  'S-milehigh': {kind: 'stadium', name: 'Empower Field at Mile High', team: 'DEN', r: 'legendary', text: 'Thin air: Special Teams attacks do 20 more damage.', boost: {S: 20}},
  'S-lucasoil': {kind: 'stadium', name: 'Lucas Oil Stadium', team: 'IND', r: 'legendary', text: 'Fresh legs: at the start of each turn, heal 10 damage from that player’s active player.', heal: 10}
};
export const isTrainer = id => !!TRAINERS[id];

// ---------------------------------------------------------------------------------------------------- abilities
export const ABILITY = {
  boost: {name: 'Field General', text: 'Your other Air players’ attacks do 10 more damage.'},
  juke: {name: 'Juke', text: 'When this player is attacked, flip a coin. Heads: the attack does nothing.'},
  speed: {name: 'Speed to Burn', text: 'This player can switch to the bench for free.'},
  tough: {name: 'Anchor', text: 'This player takes 20 less damage from attacks.'},
  strip: {name: 'Strip Sack', text: 'When this player damages a quarterback, that quarterback loses an energy.'},
  counter: {name: 'Lockdown', text: 'When this player is damaged by an attack, the attacker takes 20 damage (never enough to knock him out).'},
  clutch: {name: 'Ice in the Veins', text: 'This player’s attacks do 30 more damage.'}
};
const POS_ABILITY = {QB: 'boost', RB: 'speed', WR: 'speed', TE: 'tough', OL: 'tough', DL: 'strip', LB: 'strip', CB: 'counter', S: 'counter', K: 'clutch'};
// (a few Legends their own)
const LEGEND_ABILITY = {'Barry Sanders': 'juke', 'Walter Payton': 'juke', 'Deion Sanders': 'speed', 'Randy Moss': 'speed'};

// ---------------------------------------------------------------------------------------------------- a card's battle side
let CARD = () => null;
/** Gives the engine the card lookup (core/dynasty.js card()). */
export function setCards(fn) { CARD = fn; STATS.clear(); }
const STATS = new Map();
const BASE_HP = {QB: 70, RB: 80, WR: 60, TE: 80, OL: 110, DL: 100, LB: 90, CB: 70, S: 80, K: 50};
const r10 = x => Math.round(x / 10) * 10;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
// Each position's attacks: the first (one energy), then the second by his strongest attribute: [name, effect, value].
// Effects: coin (flip: heads + value), draw, heal (heal value from himself), shield (takes value less next turn),
// strip (the defender loses an energy), stun (flip: heads the defender is Stunned), injure (the defender is Injured),
// qb (+value against a quarterback), vs (+value against the type in the value's .t), plus (+value), finish (+value
// against a player already hurt).
const MOVES = {
  QB: {a: 'Quick Slant', b: {ARM: ['Deep Ball', 'coin', 40], ACC: ['Back-Shoulder Dime', 'plus', 10], IQ: ['Read the Defense', 'draw', 1], RUN: ['QB Scramble', 'shield', 20]}},
  RB: {a: 'Off Tackle', b: {RUN: ['Power Run', 'plus', 10], BRK: ['Breakaway', 'coin', 40], REC: ['Screen Pass', 'draw', 1], TD: ['Goal-Line Dive', 'finish', 30]}},
  WR: {a: 'Curl Route', b: {CTH: ['Contested Catch', 'plus', 10], RTE: ['Route Tree', 'draw', 1], YAC: ['Catch and Run', 'coin', 30], DEEP: ['Go Route', 'coin', 40]}},
  TE: {a: 'Seam Route', b: {CTH: ['Sure Hands', 'plus', 10], RTE: ['Chip and Release', 'shield', 20], YAC: ['Rumble', 'coin', 30], DEEP: ['Seam Buster', 'coin', 40]}},
  OL: {a: 'Pancake', b: {PBK: ['Pass Pro', 'shield', 30], RBK: ['Drive Block', 'plus', 0], DUR: ['Iron Man', 'heal', 30]}},
  DL: {a: 'Swim Move', b: {PRS: ['Sack', 'qb', 40], TKL: ['Run Stuff', 'vs', {t: 'G', n: 30}], COV: ['Batted Ball', 'strip', 0]}},
  LB: {a: 'Fill the Gap', b: {TKL: ['Big Hit', 'stun', 0], PRS: ['Blitz', 'qb', 40], COV: ['Robber', 'strip', 0]}},
  CB: {a: 'Press Jam', b: {COV: ['Pick Six', 'coin', 40], TKL: ['Open-Field Tackle', 'plus', 10], PRS: ['Corner Blitz', 'qb', 40]}},
  S: {a: 'Thump', b: {COV: ['Ball Hawk', 'strip', 0], TKL: ['Enforcer', 'injure', 0], PRS: ['Safety Blitz', 'qb', 40]}},
  K: {a: 'Extra Point', b: {PWR: ['Field Goal', 'plus', 10], ACC: ['Chip Shot', 'plus', 0], CLU: ['Game-Winner', 'coin', 30]}}
};
/** A player card's battle side: {type, hp, stage (0 Basic, 1 evolves from his Basic), ex (two touchdowns), from (player
 *  key his evolution goes on), retreat, ability (key), attacks [{name, cost: [energy], dmg, fx, v, flat}]}, or null for a
 *  card that isn't a player. */
export function stats(id) {
  if (STATS.has(id)) return STATS.get(id);
  const c = CARD(id);
  if (!c) return null;
  const pos = c.pos, t = POS_TYPE[pos] || 'G', e = TYPES[t].e, o = c.o;
  const stage = c.s === 'G' || c.s === 'P' ? 1 : 0, ex = c.s === 'X' || c.s === 'P';
  const hp = clamp(r10(BASE_HP[pos] + (o - 65) * 1.2) + (stage ? 30 : 0) + (c.s === 'X' ? 40 : 0), 40, 240);
  const keys = (MOVES[pos] && Object.keys(MOVES[pos].b)) || [];
  // (his best attribute among the ones his position's moves use, in his card's own order)
  let best = keys[0], bv = -1;
  const order = {QB: ['ARM', 'ACC', 'IQ', 'RUN'], RB: ['RUN', 'BRK', 'REC', 'TD'], WR: ['CTH', 'RTE', 'YAC', 'DEEP'], TE: ['CTH', 'RTE', 'YAC', 'DEEP'],
    K: ['ACC', 'PWR', 'CLU'], DL: ['PRS', 'TKL', 'COV'], LB: ['TKL', 'PRS', 'COV'], CB: ['COV', 'TKL', 'PRS'], S: ['COV', 'TKL', 'PRS'], OL: ['PBK', 'RBK', 'DUR']}[pos] || [];
  order.forEach((k, i) => { const v = c.a[i] || 0; if (keys.includes(k) && v > bv) { bv = v; best = k; } });
  const [bName, fx, v] = (MOVES[pos] && MOVES[pos].b[best]) || ['Big Play', 'plus', 0];
  const bonus = (c.s === 'G' || c.s === 'P' ? 20 : 0) + (c.s === 'X' ? 20 : 0);
  let d1 = Math.max(10, r10(10 + (o - 50) * 0.6)), d2 = Math.max(20, r10(30 + (o - 50) * 1.3)) + bonus;
  if (fx === 'coin') d2 -= 10;
  if (fx === 'draw' || fx === 'strip' || fx === 'stun' || fx === 'injure' || fx === 'shield' || fx === 'heal') d2 -= 10;
  if (pos === 'OL') { d1 = Math.max(10, d1 - 10); d2 -= 10; }
  let attacks;
  if (pos === 'K') attacks = [{name: MOVES.K.a, cost: ['*'], dmg: Math.max(10, r10(10 + (o - 50) * 0.4)), fx: '', v: 0, flat: true},
    {name: bName, cost: ['*', '*'], dmg: Math.max(30, r10(20 + (o - 50) * 0.9)) + bonus, fx, v, flat: true}];
  else attacks = [{name: MOVES[pos].a, cost: [e], dmg: d1, fx: '', v: 0},
    {name: c.s === 'G' && c.t ? c.t : bName, cost: [e, e, '*'], dmg: Math.max(10, d2), fx, v, note: c.s === 'G' ? c.ln[0] : ''}];
  const ability = c.s === 'X' ? (LEGEND_ABILITY[c.name] || POS_ABILITY[pos]) : c.s === 'P' || c.s === 'A' ? POS_ABILITY[pos] : null;
  const retreat = ability === 'speed' ? 0 : pos === 'K' ? 0 : pos === 'OL' || pos === 'DL' ? 2 : 1;
  const st = {id, type: t, hp, stage, ex, from: c.p, retreat, ability, attacks, weak: WEAK[t] || null};
  STATS.set(id, st);
  return st;
}
/** Words for an attack's trick. */
export function fxText(a) {
  const v = a.v;
  switch (a.fx) {
    case 'coin': return `Flip a coin. Heads: ${v} more damage.`;
    case 'draw': return 'Draw a card.';
    case 'heal': return `Heal ${v} damage from this player.`;
    case 'shield': return `This player takes ${v} less damage during your opponent’s next turn.`;
    case 'strip': return 'Discard an energy from your opponent’s active player.';
    case 'stun': return 'Flip a coin. Heads: your opponent’s active player is Stunned.';
    case 'injure': return 'Your opponent’s active player is now Injured.';
    case 'qb': return `${v} more damage against a quarterback.`;
    case 'vs': return `${v.n} more damage against a ${TYPES[v.t].name} player.`;
    case 'plus': return v ? '' : '';
    case 'finish': return `${v} more damage if the defender is already hurt.`;
    default: return '';
  }
}
export const isBasic = id => { const s = stats(id); return !!s && s.stage === 0; };

// ---------------------------------------------------------------------------------------------------- decks
/** Whether a deck is legal: {ok, why, types (its energy types)}. */
export function checkDeck(ids, owned = null) {
  if (!Array.isArray(ids)) return {ok: false, why: 'No deck.', types: []};
  if (ids.length !== DECK_SIZE) return {ok: false, why: `A deck is ${DECK_SIZE} cards (this one has ${ids.length}).`, types: deckTypes(ids)};
  const per = {}, have = {};
  for (const id of ids) {
    const st = stats(id), tr = TRAINERS[id];
    if (!st && !tr) return {ok: false, why: 'A card in it isn’t a game card.', types: []};
    const k = st ? 'p:' + st.from : id;
    per[k] = (per[k] || 0) + 1;
    if (per[k] > MAX_COPIES) return {ok: false, why: `At most ${MAX_COPIES} of any player or card.`, types: deckTypes(ids)};
    have[id] = (have[id] || 0) + 1;
    if (owned && have[id] > (owned[id] || 0)) return {ok: false, why: 'It uses cards you don’t have.', types: deckTypes(ids)};
  }
  if (!ids.some(isBasic)) return {ok: false, why: 'It needs at least one Basic player.', types: deckTypes(ids)};
  return {ok: true, why: '', types: deckTypes(ids)};
}
/** A deck's energy types: its players' (kickers' aside), the most played first, at most 3. */
export function deckTypes(ids) {
  const n = {};
  (ids || []).forEach(id => { const s = stats(id); if (s && s.type !== 'S') n[TYPES[s.type].e] = (n[TYPES[s.type].e] || 0) + 1; });
  const out = Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b)).slice(0, 3);
  return out.length ? out : ['P'];
}

// ---------------------------------------------------------------------------------------------------- randomness
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// (a number in [0, 1) from the seed and a counter: a game's coin flips, energy and shuffles)
function rand(G) {
  let t = (hash(G.seed + '|' + (G.rn++)) + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const coin = G => rand(G) < 0.5;
function shuffle(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------------------------------------------------------------------------------------------- a game
// G: {seed, rn (the randomness counter), phase 'setup'|'play'|'over', first (who goes first: 0 or 1), cur (whose turn),
//  turn (turns played between them), uid (the next slot id), stadium {id, by} | null, over {win: 0|1|-1 (a draw), why},
//  ev (everything that happened: [{n: turn, who, k, ...}]), p: [side, side]}
// side: {deck, hand, disc, active, bench, pts, types, en (this turn's energy, null when none or used), n (his turns so
//  far), set (setup done), used {energy, coach, stadium, retreat}, promote (his active was knocked out: he picks one
//  first), plan (Game Plan's +30 this turn)}
// slot: {u (id), id (the card on top), under (what it evolved from), dmg, en [energy], stun, inj, shield, at (the turn it
//  came into play)}
/** A new game: seed (the match id), decks [[ids], [ids]]. */
export function newGame(seed, decks, v = 1) {
  const G = {seed: String(seed), v: v >= 2 ? 2 : 1, rn: 0, phase: 'setup', first: 0, cur: 0, turn: 0, uid: 1, stadium: null, over: null, ev: [], p: []};
  G.first = coin(G) ? 0 : 1; G.cur = G.first;
  for (let i = 0; i < 2; i++) {
    const deck = shuffle(G, (decks[i] || []).slice());
    // (the opening hand always holds a Basic: the first in the deck swapped in)
    if (!deck.slice(0, HAND_START).some(isBasic)) {
      const j = deck.findIndex(isBasic);
      if (j >= 0) [deck[HAND_START - 1], deck[j]] = [deck[j], deck[HAND_START - 1]];
    }
    G.p.push({deck, hand: deck.splice(0, HAND_START), disc: [], active: null, bench: [], pts: 0, types: deckTypes(decks[i]), en: null, next: null, n: 0, set: false,
      used: {}, promote: false, plan: 0, cleats: 0});
  }
  return G;
}
const say = (G, who, k, o = {}) => { G.ev.push({n: G.turn, who, k, ...o}); };
const other = who => 1 - who;
export const hpOf = slot => (stats(slot.id) ? stats(slot.id).hp : 0);
export const slots = side => [side.active, ...side.bench].filter(Boolean);
const findSlot = (side, u) => slots(side).find(s => s.u === u) || null;
const takeFromHand = (side, id) => { const i = side.hand.indexOf(id); if (i < 0) return false; side.hand.splice(i, 1); return true; };
function newSlot(G, id) { return {u: G.uid++, id, under: [], dmg: 0, en: [], stun: false, inj: false, shield: 0, at: G.turn}; }
/** Whether an attack's cost is paid by the energy on a slot. */
export function canPay(cost, en) {
  const pool = en.slice();
  for (const c of cost) { if (c === '*') continue; const i = pool.indexOf(c); if (i < 0) return false; pool.splice(i, 1); }
  return pool.length >= cost.filter(c => c === '*').length;
}
/** A player's switch-out cost (side: his side, for Speed Cleats played this turn). */
export const retreatCost = (slot, side = null) => Math.max(0, (stats(slot.id) ? stats(slot.id).retreat : 1) - ((side && side.cleats) || 0));

/** Whose move it is: the side that must act now (a setup still owed by either, else whose turn), or -1 when it's over. */
export function toMove(G) {
  if (G.phase === 'over') return -1;
  if (G.phase === 'setup') return !G.p[G.first].set ? G.first : !G.p[other(G.first)].set ? other(G.first) : G.cur;
  return G.cur;
}

// (version 2: a side's energy for its turn n, drawn from the seed alone, so the next one is known a turn ahead)
function energyFor(G, who, n) {
  const T = G.p[who].types;
  let t = (hash(`${G.seed}|e|${who}|${n}`) + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return T[Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * T.length)];
}
function startTurn(G) {
  const who = G.cur, me = G.p[who];
  me.n++; me.used = {}; me.plan = 0; me.cleats = 0;
  say(G, who, 'turn');
  // (the Stadium's heal, then an Injured active's 10, at the start of his side's turn)
  if (G.stadium && TRAINERS[G.stadium.id].heal && me.active) me.active.dmg = Math.max(0, me.active.dmg - TRAINERS[G.stadium.id].heal);
  if (me.active && me.active.inj) {
    me.active.dmg += 10; say(G, who, 'injury', {u: me.active.u, id: me.active.id, dmg: 10});
    if (me.active.dmg >= hpOf(me.active)) knockOut(G, who);
    if (G.phase === 'over') return;
  }
  if (me.deck.length) { const c = me.deck.shift(); me.hand.push(c); say(G, who, 'draw', {id: c}); }
  if (G.v >= 2) {
    me.en = G.turn === 0 && who === G.first ? null : energyFor(G, who, me.n);
    me.next = energyFor(G, who, me.n + 1);
  } else me.en = G.turn === 0 && who === G.first ? null : me.types[Math.floor(rand(G) * me.types.length)];
}
function endTurn(G) {
  const who = G.cur, me = G.p[who];
  if (me.active) me.active.stun = false; // (Stunned for his own next turn: that turn's over)
  slots(G.p[other(who)]).forEach(s => { s.shield = 0; }); // (the other side's shields lasted through this turn)
  me.en = null; me.plan = 0; me.cleats = 0;
  G.turn++;
  if (G.turn >= TURN_CAP) {
    const [a, b] = [G.p[0].pts, G.p[1].pts];
    finish(G, a === b ? -1 : a > b ? 0 : 1, 'time');
    return;
  }
  G.cur = other(who);
  startTurn(G);
}
function finish(G, win, why) { G.phase = 'over'; G.over = {win, why}; say(G, win, 'over', {why}); }
/** His active player is knocked out: the touchdown to the other side, the cards to his discard. */
function knockOut(G, who) {
  const me = G.p[who], s = me.active, st = stats(s.id), pts = st && st.ex ? 2 : 1;
  me.disc.push(...s.under, s.id); me.active = null;
  G.p[other(who)].pts += pts;
  say(G, who, 'ko', {id: s.id, u: s.u, pts});
  if (G.p[other(who)].pts >= WIN_POINTS) { finish(G, other(who), 'points'); return; }
  if (!me.bench.length) { finish(G, other(who), 'empty'); return; }
  me.promote = true;
}

/** Plays one move for side who: {a: 'setup', act, bench} | 'promote' {u} | 'bench' {id} | 'evolve' {id, on} |
 *  'energy' {on} | 'item' {id, on?} | 'coach' {id, on?} | 'stadium' {id} | 'retreat' {to} | 'attack' {n} | 'end'.
 *  Returns {ok, why}. */
export function play(G, who, m) {
  const r = check(G, who, m);
  if (!r.ok) return r;
  doMove(G, who, m);
  return {ok: true};
}
/** Whether move m is allowed now (nothing changes). */
export function check(G, who, m) {
  const no = why => ({ok: false, why});
  if (!m || typeof m !== 'object') return no('No move.');
  if (G.phase === 'over') return no('The game is over.');
  const me = G.p[who], opp = G.p[other(who)];
  if (m.a === 'setup') {
    if (G.phase !== 'setup' || me.set) return no('Already set up.');
    const want = [m.act, ...(m.bench || [])], hand = me.hand.slice();
    if (!m.act || (m.bench || []).length > BENCH_MAX) return no('Pick an active player and up to 3 on the bench.');
    for (const id of want) { const i = hand.indexOf(id); if (i < 0 || !isBasic(id)) return no('Only Basic players from your hand.'); hand.splice(i, 1); }
    return {ok: true};
  }
  if (G.phase !== 'play') return no('Both sides set up first.');
  if (G.cur !== who) return no('It isn’t your turn.');
  if (me.promote && m.a !== 'promote') return no('Pick your new active player first.');
  switch (m.a) {
    case 'promote': return me.promote && me.bench.some(s => s.u === m.u) ? {ok: true} : no('Pick one of your bench players.');
    case 'bench': return me.hand.includes(m.id) && isBasic(m.id) && me.bench.length < BENCH_MAX ? {ok: true} : no(me.bench.length >= BENCH_MAX ? 'Your bench is full.' : 'Only Basic players go on the bench.');
    case 'evolve': {
      const st = stats(m.id), s = findSlot(me, m.on);
      if (!me.hand.includes(m.id) || !st || st.stage !== 1 || !s) return no('That can’t evolve.');
      if (stats(s.id).stage !== 0 || stats(s.id).from !== st.from) return no(`Only onto ${CARD(m.id) ? CARD(m.id).name : 'the same player'}’s Basic card.`);
      if (me.n <= 1 || s.at === G.turn) return no('Not on your first turn or the turn he came out.');
      return {ok: true};
    }
    case 'energy': return me.en && !me.used.energy && findSlot(me, m.on) ? {ok: true} : no(me.used.energy ? 'You’ve attached this turn’s energy.' : 'No energy this turn.');
    case 'coach': {
      const T = TRAINERS[m.id];
      if (!T || T.kind !== 'coach' || !me.hand.includes(m.id)) return no('Not a Coach card in your hand.');
      if (me.used.coach) return no('One Coach card a turn.');
      if (T.target === 'mine' && !findSlot(me, m.on)) return no('Pick one of your players.');
      if (T.target === 'bench' && !me.bench.some(s => s.u === m.on)) return no('Pick one of your bench players.');
      if ((m.id === 'C-flag' || m.id === 'C-hail' || m.id === 'C-count') && !opp.active) return no('Their side has no active player.');
      if (m.id === 'C-audible' && !me.active) return no('No active player.');
      return {ok: true};
    }
    case 'item': {
      const T = TRAINERS[m.id];
      if (G.v < 2 || !T || T.kind !== 'item' || !me.hand.includes(m.id)) return no('Not an Item card in your hand.');
      if (T.target === 'mine' && !findSlot(me, m.on)) return no('Pick one of your players.');
      if (m.id === 'I-cleats' && !me.active) return no('No active player.');
      return {ok: true};
    }
    case 'stadium': {
      const T = TRAINERS[m.id];
      if (!T || T.kind !== 'stadium' || !me.hand.includes(m.id)) return no('Not a Stadium in your hand.');
      if (me.used.stadium) return no('One Stadium a turn.');
      if (G.stadium && G.stadium.id === m.id) return no('That Stadium is already in play.');
      return {ok: true};
    }
    case 'retreat': {
      if (me.used.retreat) return no('One switch a turn.');
      if (!me.active || !me.bench.some(s => s.u === m.to)) return no('Pick a bench player to come in.');
      if (me.active.stun) return no('He’s Stunned.');
      if (me.active.en.length < retreatCost(me.active, me)) return no(`It costs ${retreatCost(me.active, me)} energy.`);
      return {ok: true};
    }
    case 'attack': {
      const a = me.active && stats(me.active.id) && stats(me.active.id).attacks[m.n];
      if (!a) return no('No such attack.');
      if (me.active.stun) return no('He’s Stunned this turn.');
      if (!canPay(a.cost, me.active.en)) return no('Not enough energy.');
      if (!opp.active) return no('Their side has no active player.');
      return {ok: true};
    }
    case 'end': return {ok: true};
    default: return no('Unknown move.');
  }
}
function doMove(G, who, m) {
  const me = G.p[who], opp = G.p[other(who)];
  switch (m.a) {
    case 'setup': {
      takeFromHand(me, m.act); me.active = newSlot(G, m.act);
      (m.bench || []).forEach(id => { takeFromHand(me, id); me.bench.push(newSlot(G, id)); });
      me.set = true; say(G, who, 'setup', {act: m.act, bench: (m.bench || []).slice()});
      if (G.p[0].set && G.p[1].set) { G.phase = 'play'; G.cur = G.first; startTurn(G); }
      return;
    }
    case 'promote': {
      const i = me.bench.findIndex(s => s.u === m.u);
      me.active = me.bench.splice(i, 1)[0]; me.promote = false;
      say(G, who, 'promote', {u: m.u, id: me.active.id}); return;
    }
    case 'bench': takeFromHand(me, m.id); me.bench.push(newSlot(G, m.id)); say(G, who, 'bench', {id: m.id}); return;
    case 'evolve': {
      const s = findSlot(me, m.on), from = s.id;
      takeFromHand(me, m.id); s.under.push(s.id); s.id = m.id; s.stun = false; s.inj = false; s.at = G.turn;
      say(G, who, 'evolve', {u: s.u, from, id: m.id}); return;
    }
    case 'energy': { const s = findSlot(me, m.on); s.en.push(me.en); say(G, who, 'energy', {u: s.u, id: s.id, e: me.en}); me.en = null; me.used.energy = true; return; }
    case 'coach': {
      takeFromHand(me, m.id); me.disc.push(m.id); me.used.coach = true;
      const o = {id: m.id};
      if (m.id === 'C-timeout') { const s = findSlot(me, m.on); o.heal = Math.min(40, s.dmg); s.dmg -= o.heal; o.u = s.u; }
      else if (m.id === 'C-audible') { const i = me.bench.findIndex(s => s.u === m.on); const out = me.active; me.active = me.bench[i]; me.bench[i] = out; out.stun = false; out.inj = false; o.u = me.active.u; }
      else if (m.id === 'C-twomin') { o.n = 0; for (let k = 0; k < 2 && me.deck.length; k++) { me.hand.push(me.deck.shift()); o.n++; } }
      else if (m.id === 'C-scout') { const b = me.deck.filter(isBasic); if (b.length) { const id = b[Math.floor(rand(G) * b.length)]; me.deck.splice(me.deck.indexOf(id), 1); me.hand.push(id); o.got = id; } }
      else if (m.id === 'C-flag') { if (opp.active.en.length) { o.e = opp.active.en.pop(); } }
      else if (m.id === 'C-hail') {
        const flips = [coin(G), coin(G), coin(G)], dmg = flips.filter(Boolean).length * 30;
        o.flips = flips; o.dmg = dmg; opp.active.dmg += dmg;
        say(G, who, 'coach', o);
        if (opp.active.dmg >= hpOf(opp.active)) knockOut(G, other(who));
        return;
      } else if (m.id === 'C-plan') me.plan = 30;
      else if (m.id === 'C-count') { o.heads = coin(G); if (o.heads) opp.active.stun = true; }
      else if (m.id === 'C-room') slots(me).forEach(s => { s.dmg = Math.max(0, s.dmg - 20); s.stun = false; s.inj = false; });
      else if (m.id === 'C-fourth') { const s = me.bench.find(x => x.u === m.on); if (me.active) { o.n = s.en.length; me.active.en.push(...s.en); s.en = []; } }
      say(G, who, 'coach', o); return;
    }
    case 'item': {
      takeFromHand(me, m.id); me.disc.push(m.id);
      const o = {id: m.id};
      if (m.id === 'I-recruit') { const b = me.deck.filter(isBasic); if (b.length) { const id = b[Math.floor(rand(G) * b.length)]; me.deck.splice(me.deck.indexOf(id), 1); me.hand.push(id); o.got = id; } }
      else if (m.id === 'I-water') { const s = findSlot(me, m.on); o.heal = Math.min(20, s.dmg); s.dmg -= o.heal; o.u = s.u; }
      else if (m.id === 'I-cleats') me.cleats = 1;
      say(G, who, 'item', o); return;
    }
    case 'stadium': {
      takeFromHand(me, m.id);
      if (G.stadium) G.p[G.stadium.by].disc.push(G.stadium.id);
      G.stadium = {id: m.id, by: who}; me.used.stadium = true; say(G, who, 'stadium', {id: m.id}); return;
    }
    case 'retreat': {
      const cost = retreatCost(me.active, me), out = me.active, i = me.bench.findIndex(s => s.u === m.to);
      out.en.splice(0, cost); out.stun = false; out.inj = false;
      me.active = me.bench[i]; me.bench[i] = out; me.used.retreat = true;
      say(G, who, 'retreat', {from: out.id, to: me.active.id, cost}); return;
    }
    case 'attack': attack(G, who, m.n); if (G.phase !== 'over') endTurn(G); return;
    case 'end': say(G, who, 'end'); endTurn(G);
  }
}
/** An attack: the damage (its own, the trick's, the Stadium's, Field General's, Game Plan's, the weakness; less a
 *  shield or Anchor), then its trick, Lockdown, and a knockout. */
function attack(G, who, n) {
  const me = G.p[who], opp = G.p[other(who)], A = me.active, D = opp.active;
  const sa = stats(A.id), sd = stats(D.id), a = sa.attacks[n];
  const o = {u: A.u, id: A.id, n, name: a.name, target: D.id, tu: D.u};
  let dmg = a.dmg;
  if (a.fx === 'coin') { o.heads = coin(G); if (o.heads) dmg += a.v; }
  if (a.fx === 'plus') dmg += a.v;
  if (a.fx === 'qb' && CARD(D.id) && CARD(D.id).pos === 'QB') dmg += a.v;
  if (a.fx === 'vs' && sd.type === a.v.t) dmg += a.v.n;
  if (a.fx === 'finish' && D.dmg > 0) dmg += a.v;
  if (!a.flat && G.stadium && TRAINERS[G.stadium.id].boost) dmg += TRAINERS[G.stadium.id].boost[sa.type] || 0;
  if (a.flat && G.stadium && TRAINERS[G.stadium.id].boost && TRAINERS[G.stadium.id].boost.S) dmg += TRAINERS[G.stadium.id].boost.S;
  if (sa.type === 'A' && slots(me).some(s => s !== A && stats(s.id).ability === 'boost')) dmg += 10;
  if (sa.ability === 'clutch') dmg += 30;
  dmg += me.plan;
  if (!a.flat && sd.weak === sa.type) { dmg += WEAK_BONUS; o.weak = true; }
  if (sd.ability === 'tough') dmg -= 20;
  dmg -= D.shield;
  if (sd.ability === 'juke') { o.juke = coin(G); if (o.juke) { dmg = 0; o.missed = true; } }
  dmg = Math.max(0, dmg);
  D.dmg += dmg; o.dmg = dmg;
  if (!o.missed) {
    if (a.fx === 'draw' && me.deck.length) { me.hand.push(me.deck.shift()); o.drew = true; }
    if (a.fx === 'heal') { o.heal = Math.min(a.v, A.dmg); A.dmg -= o.heal; }
    if (a.fx === 'shield') A.shield = a.v;
    if (a.fx === 'strip' && D.en.length) o.strip = D.en.pop();
    if (a.fx === 'stun') { o.stunned = coin(G); if (o.stunned) D.stun = true; }
    if (a.fx === 'injure') { D.inj = true; o.injured = true; }
    if (sa.ability === 'strip' && dmg > 0 && CARD(D.id) && CARD(D.id).pos === 'QB' && D.en.length) o.sack = D.en.pop();
    if (sd.ability === 'counter' && dmg > 0) { const hit = Math.min(20, Math.max(0, hpOf(A) - 10 - A.dmg)); A.dmg += hit; o.counter = hit; }
  }
  say(G, who, 'attack', o);
  if (D.dmg >= hpOf(D)) knockOut(G, other(who));
}

/** A match's game from its moves: seed, decks [[ids], [ids]], moves [[move lists of side 0's turns], [side 1's]] (each
 *  side's list: its setup first, then one list a turn), v (the rules' version: newGame's). Replays them in order (a
 *  turn's moves until it ends) and stops at the first bad move. Returns {G, bad: null | {who, i, why}}. */
export function replay(seed, decks, moves, v = 1) {
  const G = newGame(seed, decks, v);
  const at = [0, 0]; // (each side's next turn in its list)
  const run = (who, list) => {
    for (const m of list || []) { const r = play(G, who, m); if (!r.ok) return r.why; }
    return null;
  };
  // setups, the first player's then the other's
  for (const who of [G.first, other(G.first)]) {
    const m = (moves[who] || [])[0];
    if (!m) continue;
    const why = run(who, [m]); at[who] = 1;
    if (why) return {G, bad: {who, i: 0, why}};
  }
  while (G.phase === 'play') {
    const who = G.cur, list = (moves[who] || [])[at[who]];
    if (!list) break;
    at[who]++;
    const turn = G.turn, why = run(who, list);
    if (why) return {G, bad: {who, i: at[who] - 1, why}};
    if (G.phase === 'play' && G.turn === turn) break; // (a turn not ended: still going)
  }
  return {G, bad: null};
}
