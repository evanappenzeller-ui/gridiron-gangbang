// Gridiron Dynasty (the owner's ask, Oct 27 2026: "most comparable to Ultimate Team in Madden. Players can earn points to
// open packs to unlock players. Players are based on real life [players]... inspiration [from] how MLB The Show does
// their player cards with different types and collections"). A persistent game on Daily Games, Evan's and Ryan
// Stewart's alone (Oct 28 2026: "Make available to Evan and Ryan Stewart's profiles only"; core/features.js
// dynastyOpen): no one else's phone plays it or posts to it, and only their Dynasties show (others()).
//
// The cards (data/dynasty.json, tools/dynasty/build.py): real NFL players from nflverse, in six series after The Show's
// card types: Live Series (every active player, OVR from his 2025 and 2026 play), Rookie, Prime, Gameday (a week's best
// real games, The Show's Topps Now), Awards (2025's leaders) and Legends. The rarities (the owner, Oct 29 2026: "The
// rarities should be common, rare, epic, legendary, and mythic"), on the scale of the real trading cards (Oct 29 2026:
// "the common cards should use the images we have now with the player headshots. use the new cards for the rare and
// above. create a new player ranking scale using this"): a card with a real trading card (core/dynasty-real.js) is Rare
// or better by its OVR, Mythic 95+, Legendary 91-94, Epic 87-90, Rare under 87; every other card is Common, his
// headshot on it (rarityOf, SCALE). And the battles' Coach and Stadium cards (core/dynasty-battle.js
// TRAINERS: Pokémon's Trainer and Stadium cards).
//
// Coins: the Daily Games pay them (earnedOf: every game day you play from the day your Dynasty began, read from your
// board docs, so nothing is paid twice and every phone agrees), with a free Standard Pack a day, quick-selling cards,
// collection rewards and battles. Spent coins and credits are kept (sp, cr): your balance is starter + earned + cr - sp.
// Packs (PACKS, their odds shown in the store), the collection (o: card id -> copies), collections (COLLECTIONS, their
// rewards claimed once: cl), your battle deck (dk: 20 cards, core/dynasty-battle.js checkDeck) and what battles paid
// (bt, tr: trophies, rec). The battles themselves: core/dynasty-match.js.
//
// Where it lives: this phone's board doc (players/{uid}, daily.js) as dy1 under the profile's own key (profileKey: m_<member>,
// u_<app user>, g_<guest>), so a player's Dynasty is the same on every phone of theirs; locally under gg-dy1-<key>. Other
// players' Dynasties and the Dynasty board follow the scoreboards' rule (CLAUDE.md): everyone to everyone, read from
// daily.LB.raw (never LB.all, except for finding your own saved copy, as Keepfall does).
import * as daily from './daily.js';
import * as data from './data.js';
import {profileKey, visitWho} from './realm-active.js';
import * as B from './dynasty-battle.js';
import {dynastyOpen, dynastyKey, packsUnlimited} from './features.js';
import {REAL} from './dynasty-real.js';
import {PHOTO} from './dynasty-legends.js';

export const FIELD = 'dy1';
export const VERSION = 1;
export const SEASON_MARK = 'gridiron-hub-v3';
export const STARTER_COINS = 2500;
export const DAILY_PACK = 'std';
const LOCAL = key => `gg-dy1-${key}`;

/** Whether this phone can play: Evan's profile or Ryan Stewart's (core/features.js dynastyOpen, Oct 28 2026). */
export const mayPlay = () => dynastyOpen();

// ---------------------------------------------------------------------------------------------------- the cards
export const SERIES = {
  L: {name: 'Live Series', short: 'LIVE', blurb: 'Every active player, rated from his real 2025 and 2026 play.'},
  R: {name: 'Rookie', short: 'ROOKIE', blurb: 'The 2026 rookie class, a step above their Live cards.'},
  P: {name: 'Prime', short: 'PRIME', blurb: 'The best at each position, at their very best.'},
  G: {name: 'Gameday', short: 'GAMEDAY', blurb: 'The week’s best real performances, the stat line on the card.'},
  A: {name: 'Awards', short: 'AWARD', blurb: 'The 2025 season’s statistical leaders.'},
  X: {name: 'Legends', short: 'LEGEND', blurb: 'The all-time greats.'}
};
export const SERIES_ORDER = ['X', 'P', 'A', 'G', 'R', 'L'];
export const RARITY = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_NAME = {common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic'};
/** The lowest OVR of each rarity above Rare, for a card with a real trading card (Rare is the rest of them). */
export const SCALE = Object.freeze({mythic: 95, legendary: 91, epic: 87});
/** A card's rarity: by its OVR when it has a real trading card (real), else Common. */
export const rarityOf = (ovr, real) => (!real ? 'common' : ovr >= SCALE.mythic ? 'mythic' : ovr >= SCALE.legendary ? 'legendary' : ovr >= SCALE.epic ? 'epic' : 'rare');
export const POS_NAME = {QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', OL: 'Offensive line', DL: 'Defensive line',
  LB: 'Linebacker', CB: 'Cornerback', S: 'Safety', K: 'Kicker'};
export const ATTR_NAME = {ARM: 'Arm', ACC: 'Accuracy', IQ: 'Decisions', RUN: 'Rushing', BRK: 'Breakaway', REC: 'Receiving', TD: 'Scoring',
  CTH: 'Hands', RTE: 'Routes', YAC: 'After catch', DEEP: 'Deep threat', PWR: 'Power', CLU: 'Clutch', PRS: 'Pass rush', TKL: 'Tackling',
  COV: 'Coverage', PBK: 'Pass block', RBK: 'Run block', DUR: 'Durability'};

export let DATA = null;     // data/dynasty.json as loaded
export let CARDS = [];      // every card: {id, s, p, o, a, ln, t, tm, w, r, name, pos, team, num, head, college, exp, real}
export const BY_ID = new Map();
export let TEAMS = {};      // abbr -> {abbr, name, pri, sec, conf, div, espn}
let loading = null;
export let status = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'

/** Loads the cards (once). */
export function load() {
  if (!loading) {
    status = 'loading';
    loading = fetch('data/dynasty.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => { setData(d); status = 'ready'; emit('data'); return d; })
      .catch(e => { status = 'error'; loading = null; emit('data'); throw e; });
  }
  return loading;
}
/** Takes the card data in (load()'s, or a check's). */
export function setData(d) {
  DATA = d;
  TEAMS = {};
  Object.entries(d.teams || {}).forEach(([k, v]) => { TEAMS[k] = {abbr: k, name: v[0], pri: v[1], sec: v[2], conf: v[3], div: v[4], espn: v[5]}; });
  BY_ID.clear();
  CARDS = (d.cards || []).map(c => {
    const pl = d.players[c[2]] || ['?', '', 'QB', 0, '', 0, '', 0];
    const card = {id: c[0], s: c[1], p: c[2], o: c[3], a: c[4] || [], ln: c[5] || [], t: c[6] || '', tm: c[7] || pl[1], w: c[8] || 0,
      name: pl[0], team: c[7] || pl[1], pos: pl[2], num: pl[3], head: pl[4] || (PHOTO[c[2]] ? 'w:' + c[2] : ''), exp: pl[5], college: pl[6], draft: pl[7], real: null};
    BY_ID.set(card.id, card);
    return card;
  });
  // (his real trading card on each of his cards, the next on each in the order the series run; then the rarity by it)
  const mine = new Map();
  CARDS.forEach(c => { if (REAL[c.p]) { if (!mine.has(c.p)) mine.set(c.p, []); mine.get(c.p).push(c); } });
  mine.forEach((list, p) => {
    list.sort((a, b) => SERIES_ORDER.indexOf(a.s) - SERIES_ORDER.indexOf(b.s) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    list.forEach((c, i) => { c.real = REAL[p][i % REAL[p].length]; });
  });
  CARDS.forEach(c => { c.r = rarityOf(c.o, !!c.real); });
  POOLS.clear();
  B.setCards(card);
  COLLECTIONS = buildCollections();
}
/** A player card (null for anything else: a Coach or Stadium card is trainer()'s). */
export const card = id => BY_ID.get(id) || null;
/** A Coach or Stadium card: {id, kind, name, r, text, ...}. */
export const trainer = id => (B.TRAINERS[id] ? {id, ...B.TRAINERS[id]} : null);
export const TRAINER_IDS = Object.keys(B.TRAINERS);
/** Whether id is a card of the game, a player or a Coach or Stadium card. */
export const isCard = id => !!(card(id) || B.TRAINERS[id]);
export const attrKeys = pos => (DATA && DATA.attrs && DATA.attrs[pos]) || [];
export const teamOf = abbr => TEAMS[abbr] || {abbr, name: abbr, pri: '#333', sec: '#999', conf: '', div: '', espn: abbr};
/** The week the Gameday cards go up to. */
export const lastWeek = () => CARDS.reduce((m, c) => (c.s === 'G' ? Math.max(m, c.w) : m), 0);

// A first name and last name for the card's banner.
export function nameParts(n) {
  const s = String(n || '').trim(), i = s.indexOf(' ');
  return i < 0 ? ['', s] : [s.slice(0, i), s.slice(i + 1)];
}

// ---------------------------------------------------------------------------------------------------- randomness
/** A seeded generator (mulberry32), for what must come out the same on every phone: the starter squad, the computer's
 *  teams and a game's play-by-play. */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// (packs: the browser's own randomness)
const luck = () => {
  try { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; } catch (_) { return Math.random(); }
};
const pickW = (items, weight, R = luck) => {
  const tot = items.reduce((t, x) => t + Math.max(0, weight(x)), 0);
  if (!(tot > 0)) return items[Math.floor(R() * items.length)];
  let r = R() * tot;
  for (const x of items) { r -= Math.max(0, weight(x)); if (r < 0) return x; }
  return items[items.length - 1];
};

// ---------------------------------------------------------------------------------------------------- packs
// Each pack: its price, and its slots: each slot a draw of a rarity by its odds (the store shows them), then a card of
// that rarity from the slot's pool (series, and for a Team Pack the team chosen).
export const PACKS = {
  std: {name: 'Standard Pack', price: 1000, blurb: 'Four Live Series cards and a Trainer card.', color: '#2F6FDE',
    slots: [{n: 4, pool: 'live', odds: {common: 34, rare: 38, epic: 18, legendary: 8, mythic: 2}}, {n: 1, pool: 'trainer', odds: {epic: 70, legendary: 30}}]},
  team: {name: 'Team Pack', price: 1500, blurb: 'Four Live Series cards from the team you pick, and a Trainer card.', color: '#1E9E6A', team: true,
    slots: [{n: 4, pool: 'live', odds: {common: 25, rare: 40, epic: 22, legendary: 10, mythic: 3}}, {n: 1, pool: 'trainer', odds: {epic: 70, legendary: 30}}]},
  prem: {name: 'Premium Pack', price: 3000, blurb: 'Five cards: a Trainer card, and the last one Legendary or better. Rookies and specials inside.', color: '#8B3FD9',
    slots: [{n: 3, pool: 'all', odds: {common: 10, rare: 35, epic: 30, legendary: 18, mythic: 7}}, {n: 1, pool: 'trainer', odds: {epic: 50, legendary: 50}},
      {n: 1, pool: 'all', odds: {legendary: 75, mythic: 25}}]},
  gday: {name: 'Gameday Pack', price: 4000, blurb: 'A Gameday card from a real game, and two Legendary-or-better cards.', color: '#E0702A',
    slots: [{n: 1, pool: 'gameday', odds: {mythic: 100}}, {n: 2, pool: 'live', odds: {legendary: 80, mythic: 20}}]},
  leg: {name: 'Legends Pack', price: 12000, blurb: 'A 90+ special card (Legend, Prime, Award or Gameday) and two Mythics.', color: '#C9A227',
    slots: [{n: 1, pool: 'elite', odds: {mythic: 100}}, {n: 2, pool: 'live', odds: {mythic: 100}}]},
  // (the owner, Oct 29 2026: "Players will get a starter pack when they open the game with 15 common players 4 rare
  // players and one epic or better player": given once (fresh, and kit3 for a Dynasty begun before it), never sold,
  // twenty different players)
  start: {name: 'Starter Pack', price: 0, starter: true, unique: true, blurb: '15 Common players, 4 Rare and one Epic or better.', color: '#D6453D',
    slots: [{n: 15, pool: 'live', odds: {common: 100}}, {n: 4, pool: 'live', odds: {rare: 100}}, {n: 1, pool: 'live', odds: {epic: 75, legendary: 20, mythic: 5}}]}
};
export const PACK_ORDER = ['std', 'team', 'prem', 'gday', 'leg'];
// What each pool holds, and inside 'all' and 'elite' how often each series comes up (out of 100)
const POOLS = new Map();
const ALL_MIX = {L: 86, R: 8, G: 3, P: 1.5, A: 1.5};
const ELITE_MIX = {X: 25, P: 30, A: 20, G: 25};
function poolOf(pool, team, rarity) {
  const k = `${pool}|${team || ''}|${rarity}`;
  if (POOLS.has(k)) return POOLS.get(k);
  let list = [];
  if (pool === 'live') list = CARDS.filter(c => c.s === 'L' && c.r === rarity && (!team || c.team === team));
  else if (pool === 'gameday') list = CARDS.filter(c => c.s === 'G');
  else if (pool === 'series') list = CARDS.filter(c => c.s === team && c.r === rarity);
  POOLS.set(k, list);
  return list;
}
/** One card for a slot of a pack: R the randomness (luck by default). {id, ...} (a Coach or Stadium card: trainer()'s). */
export function drawCard(slot, {team = null, R = luck} = {}) {
  const rar = pickW(Object.keys(slot.odds), r => slot.odds[r], R);
  if (slot.pool === 'trainer') {
    const ids = TRAINER_IDS.filter(id => B.TRAINERS[id].r === rar);
    return trainer((ids.length ? ids : TRAINER_IDS)[Math.floor(R() * (ids.length || TRAINER_IDS.length))]);
  }
  let list = [];
  if (slot.pool === 'live') list = poolOf('live', team, rar);
  else if (slot.pool === 'gameday') {
    // (the latest week's cards three times as likely as an older week's)
    const all = poolOf('gameday', null, ''), lw = lastWeek();
    return pickW(all, c => (c.w === lw ? 3 : 1), R);
  } else if (slot.pool === 'elite') {
    // (a 90+ card with its real trading card where the series has one)
    const s = pickW(Object.keys(ELITE_MIX), x => ELITE_MIX[x], R);
    list = CARDS.filter(c => c.s === s && c.o >= 90 && c.real);
    if (!list.length) list = CARDS.filter(c => c.s === s && c.o >= 90);
    if (!list.length) list = CARDS.filter(c => c.s === s);
  } else if (slot.pool === 'all') {
    const s = pickW(Object.keys(ALL_MIX), x => ALL_MIX[x], R);
    list = s === 'L' ? poolOf('live', null, rar) : poolOf('series', s, rar);
    // (a special series with no card of that rarity: a Live one of it)
    if (!list.length) list = poolOf('live', null, rar);
  }
  if (!list.length) list = poolOf('live', team, 'common').length ? poolOf('live', team, 'common') : CARDS.filter(c => c.s === 'L');
  return list[Math.floor(R() * list.length)];
}
/** A pack's cards (their ids), drawn. */
export function drawPack(kind, {team = null, R = luck} = {}) {
  const P = PACKS[kind];
  if (!P) return [];
  const out = [], seen = new Set();
  P.slots.forEach(sl => {
    for (let i = 0; i < sl.n; i++) {
      let c = drawCard(sl, {team, R});
      // (a pack of different players: drawn again, a few times, when he's in it already)
      for (let k = 0; P.unique && k < 12 && seen.has(c.p || c.id); k++) c = drawCard(sl, {team, R});
      seen.add(c.p || c.id); out.push(c.id);
    }
  });
  return out;
}
/** The odds a pack shows: per slot group, each rarity's chance in percent. */
export const packOdds = kind => (PACKS[kind] ? PACKS[kind].slots.map(sl => {
  const tot = Object.values(sl.odds).reduce((a, b) => a + b, 0);
  return {n: sl.n, pool: sl.pool, odds: RARITY.filter(r => sl.odds[r]).map(r => ({r, pct: Math.round(sl.odds[r] / tot * 1000) / 10}))};
}) : []);

// ---------------------------------------------------------------------------------------------------- quick sell
const SELL = {common: 10, rare: 40, epic: 150, legendary: 500, mythic: 1500};
const SELL_SPECIAL = {R: 1.5, G: 2, A: 2.5, P: 2.5, X: 4};
/** What a card quick-sells for, in coins (c: a player card or a Coach or Stadium card). */
export const sellValue = c => (c ? Math.round((SELL[c.r] || 0) * (c.s === 'L' || !c.s ? 1 : SELL_SPECIAL[c.s] || 1)) : 0);
/** A card of either kind by id. */
export const anyCard = id => card(id) || trainer(id);

// ---------------------------------------------------------------------------------------------------- Pocket's marks
// Rarity marked as Pokémon TCG Pocket marks it (the owner, Oct 28 2026: "match the Pokémon app"): ◆ to ◆◆◆◆ for Common
// to Legendary, ★ for a Mythic, ★★ for the special series (Prime, Gameday, Awards), a crown for a Legend; Trainer cards ◆◆
// (Epic) and ◆◆◆ (Legendary). A Common card (no real trading card: any series) is ◆ and framed round his headshot; every
// Rare or better card is full art, its real card the whole card (Oct 29 2026: "let the entire image be the card with the
// info and moves on top of it").
/** {mark: the symbols, kind: 'd' (diamonds) | 's' (stars) | 'c' (crown), n, full (full art)} */
export function markOf(c) {
  if (!c) return {mark: '', kind: 'd', n: 0, full: false};
  if (!c.s) { const n = c.r === 'legendary' ? 3 : 2; return {mark: '◆'.repeat(n), kind: 'd', n, full: false}; }
  if (c.r === 'common') return {mark: '◆', kind: 'd', n: 1, full: false};
  if (c.s === 'X') return {mark: '♛', kind: 'c', n: 1, full: true};
  if (c.s === 'P' || c.s === 'G' || c.s === 'A') return {mark: '★★', kind: 's', n: 2, full: true};
  if (c.r === 'mythic') return {mark: '★', kind: 's', n: 1, full: true};
  const n = {rare: 2, epic: 3, legendary: 4}[c.r] || 2;
  return {mark: '◆'.repeat(n), kind: 'd', n, full: true};
}
// Pack points (Pocket's): 5 for every pack opened, traded for a card you pick, at Pocket's prices by its mark.
export const PP_PER_PACK = 5;
const PP_COST = {d1: 35, d2: 70, d3: 150, d4: 500, s1: 400, s2: 1250, c1: 2500};
/** What a card costs in pack points. */
export const ppCost = c => { const m = markOf(c); return PP_COST[m.kind + m.n] || 0; };

// ---------------------------------------------------------------------------------------------------- the battle deck
// 20 cards (core/dynasty-battle.js checkDeck: at most 2 of any player or card, a Basic among them).
const COACH_KIT = {'C-timeout': 2, 'C-twomin': 2, 'C-audible': 2, 'C-scout': 1, 'C-flag': 1};
// (Pocket's starters carry Poké Balls and Potions: Recruit and Water Bottle, from Oct 28 2026)
const ITEM_KIT = {'I-recruit': 2, 'I-water': 2};
/** The best deck out of a collection: the two strongest types' best Basic players (and the evolutions he has of them),
 *  a kicker, and the Trainer cards, to 20. */
export function autoDeck(owned) {
  const have = Object.keys(owned || {}).filter(id => owned[id] > 0);
  const players = have.map(card).filter(Boolean).sort((a, b) => b.o - a.o || a.name.localeCompare(b.name));
  const power = {};
  players.filter(c => B.isBasic(c.id) && c.pos !== 'K').slice(0, 30).forEach(c => { const t = B.POS_TYPE[c.pos]; power[t] = (power[t] || 0) + c.o; });
  const types = Object.keys(power).sort((a, b) => power[b] - power[a]).slice(0, 2);
  const deck = [], per = {};
  const add = (id, n = 1) => {
    const st = B.stats(id), k = st ? 'p:' + st.from : id;
    for (let i = 0; i < n && deck.length < B.DECK_SIZE; i++) {
      if ((per[k] || 0) >= B.MAX_COPIES || deck.filter(x => x === id).length >= (owned[id] || 0)) return;
      deck.push(id); per[k] = (per[k] || 0) + 1;
    }
  };
  // (Trainer cards, at most 7: Items first, as Pocket's decks carry Poké Balls and Potions (Recruit, Water Bottle; at
  // most 4 of them), then the best Coach and Stadium cards)
  const ITEM_ORDER = ['I-recruit', 'I-water', 'I-cleats'];
  const rank = id => (B.TRAINERS[id].kind === 'item' ? ITEM_ORDER.indexOf(id) : 10 + (B.TRAINERS[id].r === 'legendary' ? 0 : 1));
  const tr = have.filter(id => B.TRAINERS[id]).sort((a, b) => rank(a) - rank(b));
  let trainers = 0, items = 0;
  tr.forEach(id => {
    const item = B.TRAINERS[id].kind === 'item';
    while (trainers < 7 && (!item || items < 4) && deck.filter(x => x === id).length < Math.min(2, owned[id])) { add(id); trainers++; if (item) items++; }
  });
  // (a player's evolution right after his Basic, when he has both)
  players.filter(c => B.isBasic(c.id) && types.includes(B.POS_TYPE[c.pos])).forEach(c => {
    if (deck.length >= B.DECK_SIZE - 1) return;
    add(c.id);
    const evo = players.find(e => !B.isBasic(e.id) && e.p === c.p);
    if (evo) add(evo.id);
  });
  const k = players.find(c => c.pos === 'K'); if (k) add(k.id);
  players.forEach(c => { if (deck.length < B.DECK_SIZE && B.isBasic(c.id)) add(c.id); });
  // (still short: the rest of the Coach and Stadium cards, then anything)
  tr.forEach(id => { if (deck.length < B.DECK_SIZE) add(id, 2); });
  players.forEach(c => { if (deck.length < B.DECK_SIZE) add(c.id, 2); });
  return deck;
}
/** Optional deck plans built from cards already in your collection. Selecting one never grants cards. */
export const STRATEGIES = [
  {id: 'air', name: 'Air Raid', description: 'Use your quarterbacks and receivers to build toward a signature play. Draw cards and switch to keep options open.',
    weakness: 'Coverage players punish Air. Protect your receiver while you prepare the next play.'},
  {id: 'ground', name: 'Ground Control', description: 'Run behind durable players, use protection and healing, and save your big play for the right moment.',
    weakness: 'Blitz players punish Ground. Use healing and switches to keep your runner in the game.'}
];
const STRATEGY_PLAN = {
  air: {type: 'A', roles: ['QB', 'WR', 'TE'], trainers: ['I-recruit', 'C-twomin', 'C-audible', 'I-cleats', 'C-plan', 'S-sofi', 'C-scout', 'C-fourth', 'I-water', 'C-timeout', 'C-flag', 'C-room']},
  ground: {type: 'G', roles: ['RB', 'OL'], trainers: ['I-water', 'C-timeout', 'I-recruit', 'C-room', 'S-lambeau', 'C-twomin', 'C-audible', 'I-cleats', 'C-plan', 'S-lucasoil', 'C-scout', 'C-flag']}
};
/** A legal, single-energy deck, or an explanation of what's missing. Pure: the save and collection are untouched. */
export function strategyDeck(id, owned = mine().o) {
  const plan = STRATEGY_PLAN[id];
  if (!plan) return {ids: [], ok: false, why: 'Choose an available deck strategy.'};
  const copies = cid => Math.max(0, Math.min(B.MAX_COPIES, Math.floor(Number((owned || {})[cid]) || 0)));
  const pool = CARDS.filter(c => copies(c.id) && B.stats(c.id).type === plan.type);
  const score = c => {
    const st = B.stats(c.id), fx = st.attacks[1].fx;
    // Reward the plan's useful roles and effects, with a bounded rating contribution.
    const fit = id === 'air' ? (st.ability === 'boost' ? 18 : st.ability === 'speed' ? 8 : 0) + (fx === 'draw' ? 12 : 0)
      : (st.ability === 'tough' ? 12 : st.ability === 'juke' ? 8 : 0) + (['heal', 'shield', 'finish'].includes(fx) ? 12 : 0);
    return Math.min(c.o, 90) + fit;
  };
  const rank = (a, b) => score(b) - score(a) || a.id.localeCompare(b.id);
  // Each package has an owned Basic and at most one more card of that same player. An evolution is never orphaned.
  const seen = new Set(), packages = [];
  pool.filter(c => B.isBasic(c.id)).sort(rank).forEach(c => {
    const key = B.stats(c.id).from;
    if (seen.has(key)) return;
    seen.add(key);
    const evolution = pool.filter(e => !B.isBasic(e.id) && B.stats(e.id).from === key).sort(rank)[0];
    const second = evolution || (copies(c.id) > 1 ? c : pool.filter(e => B.isBasic(e.id) && e.id !== c.id && B.stats(e.id).from === key).sort(rank)[0]);
    packages.push({card: c, ids: [c.id, ...(second ? [second.id] : [])]});
  });
  // Start with one package per position, then fill by suitability. Quarterbacks/linemen have a place beside scorers.
  const ordered = [], used = new Set();
  for (const pos of plan.roles) {
    const p = packages.find(x => x.card.pos === pos);
    if (p) { ordered.push(p); used.add(p); }
  }
  ordered.push(...packages.filter(p => !used.has(p)));
  const playerIds = ordered.flatMap(p => p.ids).slice(0, 12);
  const trainers = [];
  // First add a varied support hand; then second copies. Only the plan's compatible stadiums are considered.
  for (let n = 1; n <= B.MAX_COPIES; n++) {
    for (const tid of plan.trainers) if (copies(tid) >= n) trainers.push(tid);
  }
  const supportCount = Math.min(trainers.length, B.DECK_SIZE - playerIds.length);
  const ids = [...playerIds, ...trainers.slice(0, supportCount)];
  if (playerIds.length < 10) return {ids, ok: false, why: `Collect ${10 - playerIds.length} more playable ${B.TYPES[plan.type].name} player card${10 - playerIds.length === 1 ? '' : 's'} to build this plan. Evolutions need their Basic player.`};
  if (ids.length < B.DECK_SIZE) return {ids, ok: false, why: `This plan needs ${B.DECK_SIZE - ids.length} more compatible support card${B.DECK_SIZE - ids.length === 1 ? '' : 's'} from your collection.`};
  const legal = B.checkDeck(ids, owned);
  return {ids, ...legal};
}
/** Your deck and whether it's legal: {ids, ok, why, types}. */
export function deckOf(s = mine()) {
  const r = B.checkDeck(s.dk, s.o);
  return {ids: s.dk.slice(), ...r};
}
export function setDeck(ids, s = mine()) { s.dk = ids.slice(0, B.DECK_SIZE); touch(); return deckOf(s); }

// ---------------------------------------------------------------------------------------------------- collections
// After The Show's: a team's Headliners (its ten best Live cards), a division (its four teams' Headliners), the whole
// league, and the special series. Each pays once, claimed (cl).
export let COLLECTIONS = [];
const HEAD_N = 10;
function buildCollections() {
  const out = [], byTeam = {};
  CARDS.filter(c => c.s === 'L').forEach(c => (byTeam[c.team] = byTeam[c.team] || []).push(c));
  const legends = CARDS.filter(c => c.s === 'X');
  const divs = {};
  Object.values(TEAMS).forEach(t => {
    const list = (byTeam[t.abbr] || []).slice().sort((a, b) => b.o - a.o || a.name.localeCompare(b.name)).slice(0, HEAD_N);
    out.push({id: 'team-' + t.abbr, kind: 'team', name: `${t.name} Headliners`, short: t.name.split(' ').slice(-1)[0], team: t.abbr,
      need: list.map(c => c.id), of: list.length, reward: {coins: 1000, packs: {prem: 1}}});
    (divs[`${t.conf} ${t.div}`] = divs[`${t.conf} ${t.div}`] || []).push(t.abbr);
  });
  Object.keys(divs).sort().forEach(d => {
    const teams = divs[d];
    const leg = legends.filter(c => teams.includes(c.team)).sort((a, b) => b.o - a.o)[0];
    out.push({id: 'div-' + d.replace(' ', '-').toLowerCase(), kind: 'div', name: d, teams, sub: teams.map(t => 'team-' + t), of: teams.length,
      reward: leg ? {coins: 5000, card: leg.id} : {coins: 5000, packs: {leg: 1}}});
  });
  out.push({id: 'league', kind: 'league', name: 'The Whole League', sub: out.filter(c => c.kind === 'div').map(c => c.id), of: 8,
    reward: {coins: 50000, packs: {leg: 5}}});
  const series = (s, name, n, reward) => {
    const need = CARDS.filter(c => c.s === s).map(c => c.id);
    out.push({id: 'series-' + s, kind: 'series', series: s, name, need, of: Math.min(n || need.length, need.length), reward});
  };
  series('P', 'Prime Time', 0, {packs: {leg: 2}});
  series('A', 'Award Winners', 0, {packs: {leg: 2}});
  series('R', 'Rookie Class', 20, {coins: 5000, packs: {prem: 3}});
  series('X', 'Hall of Legends', 10, {coins: 25000, packs: {leg: 3}});
  const tset = (id, name, kind, reward) => {
    const need = TRAINER_IDS.filter(t => B.TRAINERS[t].kind === kind);
    out.push({id, kind: 'series', series: kind, name, need, of: need.length, reward});
  };
  tset('series-coach', 'The Coaching Staff', 'coach', {coins: 5000, packs: {prem: 2}});
  tset('series-stadium', 'Road Trip', 'stadium', {coins: 5000, packs: {gday: 1}});
  const weeks = [...new Set(CARDS.filter(c => c.s === 'G').map(c => c.w))].sort((a, b) => b - a);
  weeks.forEach(w => {
    const need = CARDS.filter(c => c.s === 'G' && c.w === w).map(c => c.id);
    out.push({id: 'week-' + w, kind: 'week', week: w, name: `Week ${w} Gameday`, need, of: Math.min(4, need.length), reward: {coins: 2000, packs: {gday: 1}}});
  });
  return out;
}
export const collection = id => COLLECTIONS.find(c => c.id === id) || null;
/** How far a collection is: {have, of, done, claimed}. A card counts while you hold it; a collection of collections
 *  counts the ones claimed. */
export function progress(col, s) {
  if (!col) return {have: 0, of: 0, done: false, claimed: false};
  const owned = (s && s.o) || {}, cl = (s && s.cl) || {};
  const have = col.sub ? col.sub.filter(id => cl[id]).length : col.need.filter(id => owned[id] > 0).length;
  return {have: Math.min(have, col.of), of: col.of, done: have >= col.of, claimed: !!cl[col.id]};
}
/** The words for a reward. */
export function rewardText(rw) {
  const out = [];
  if (rw.card && card(rw.card)) out.push(`${card(rw.card).name} (${card(rw.card).o} Legend)`);
  Object.entries(rw.packs || {}).forEach(([k, n]) => out.push(`${n > 1 ? n + ' ' : ''}${PACKS[k].name}${n > 1 ? 's' : ''}`));
  if (rw.coins) out.push(`${data.nf(rw.coins)} coins`);
  return out.join(' + ');
}

// ---------------------------------------------------------------------------------------------------- the save
// {v, rs, born, at, sp (coins spent), cr (coins credited: sales, rewards, battles, the daily bonus), o {card id: copies},
//  pk {pack kind: unopened}, cl {collection id: when claimed}, dk [the battle deck's 20 ids], kit (the starter Coach
//  cards given: 1), kit2 (the starter Items given: 1), kit3 (the Starter Pack given: 1), pp (pack points), dd (the last day the daily pack was taken,
//  YYYY-MM-DD), rec {w, l, d}, tr (trophies), bt {match id:
//  'w'|'l'|'d', paid}, so {computer opponent id: Solo wins}, sl [the latest Solo battles paid], nm (team name), lp (the latest pulls, newest first: 24 at most), nw (cards pulled for the first time
//  and not looked at yet: NEW)}
export const dayKey = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
/** A new Dynasty: the starter Coach cards and Items, the Starter Pack to open (its players make the deck: open()), and
 *  the welcome packs. */
export function fresh(key = '', now = Date.now()) {
  const o = {...COACH_KIT, ...ITEM_KIT};
  return {v: VERSION, rs: SEASON_MARK, born: now, at: now, sp: 0, cr: 0, o, pk: {start: 1, std: 2, prem: 1}, cl: {}, dk: [], kit: 1, kit2: 1, kit3: 1,
    pp: 0, dd: '', rec: {w: 0, l: 0, d: 0}, tr: 0, bt: {}, so: {}, sl: [], nm: '', lp: [], nw: []};
}
/** A save as it should be (anything missing or broken put right), or null when it isn't one. */
export function clean(s) {
  if (!s || typeof s !== 'object' || s.rs !== SEASON_MARK) return null;
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const n = x => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.floor(Number(x)) : 0);
  const out = {v: VERSION, rs: SEASON_MARK, born: n(s.born) || Date.now(), at: n(s.at), sp: n(s.sp), cr: n(s.cr), o: {}, pk: {}, cl: {}, dk: [],
    kit: s.kit ? 1 : 0, kit2: s.kit2 ? 1 : 0, kit3: s.kit3 ? 1 : 0, pp: n(s.pp), dd: typeof s.dd === 'string' ? s.dd : '', rec: {w: n(s.rec && s.rec.w), l: n(s.rec && s.rec.l), d: n(s.rec && s.rec.d)},
    tr: n(s.tr), bt: {}, so: {}, sl: Array.isArray(s.sl) ? s.sl.filter(x => typeof x === 'string').slice(0, 20) : [],
    nm: typeof s.nm === 'string' ? s.nm.slice(0, 24) : '', lp: Array.isArray(s.lp) ? s.lp.filter(x => typeof x === 'string').slice(0, 24) : [], nw: []};
  Object.entries(obj(s.o)).forEach(([k, v]) => { if (n(v) > 0) out.o[k] = Math.min(99, n(v)); });
  Object.entries(obj(s.pk)).forEach(([k, v]) => { if (PACKS[k] && n(v) > 0) out.pk[k] = Math.min(999, n(v)); });
  Object.entries(obj(s.cl)).forEach(([k, v]) => { if (v) out.cl[k] = n(v) || 1; });
  if (Array.isArray(s.dk)) out.dk = s.dk.filter(id => typeof id === 'string').slice(0, B.DECK_SIZE);
  if (Array.isArray(s.nw)) out.nw = [...new Set(s.nw.filter(k => typeof k === 'string' && out.o[k] > 0))].slice(0, 60);
  // (the battles paid: the latest 200)
  Object.entries(obj(s.bt)).slice(-200).forEach(([k, v]) => { if (['w', 'l', 'd'].includes(v)) out.bt[k] = v; });
  Object.entries(obj(s.so)).slice(0, 40).forEach(([k, v]) => { if (n(v) > 0) out.so[k] = Math.min(9999, n(v)); });
  return out;
}

// ---------------------------------------------------------------------------------------------------- coins from the games
// What the Daily Games pay (the day's first finished result in each, from the day your Dynasty began): a base for
// playing and more for how well. Read from your board docs, the way Keepfall's pay is (core/realm.js incomeOf), so a
// result is paid once whatever phone it was played on.
export const PAY = {
  puzzles: e => 200 + Math.min(400, Math.round((Number(e.p) || 0) * 0.4)),
  '17-0': e => 200 + 20 * (Number(e.w) || 0) + (e.w === 17 ? 200 : 0),
  drill: e => (e.r === 'W' ? 600 : e.r === 'T' ? 450 : 250),
  kick: e => 200 + 30 * Math.min(15, Number(e.m) || 0),
  return: e => 200 + Math.min(400, Math.floor((Number(e.y) || 0) / 5))
};
export const GAME_NAME = {puzzles: 'Daily Puzzles', '17-0': '17–0', drill: 'Two-Minute Drill', kick: 'Kick It', return: 'Return Man'};
export const PAY_WORDS = {puzzles: '200 + your points ÷ 2.5 (up to 600)', '17-0': '200 + 20 a win (+200 for 17–0)',
  drill: 'Win 600 · Tie 450 · Loss 250', kick: '200 + 30 a make (up to 650)', return: '200 + a coin for every 5 yards (up to 600)'};
// (each game's board field and core: the cores load with loadGames())
const FIELDS = {'17-0': 's17', drill: 'dr5', kick: 'kk1', return: 'rm2'};
const MODS = {};
let modsAsked = null;
/** Loads the game cores the pay reads (their days and results). */
export function loadGames() {
  if (!modsAsked) {
    const take = (g, p) => p.then(m => Promise.resolve(m.load && m.load()).then(() => { MODS[g] = m; }), () => {});
    modsAsked = Promise.all([
      Promise.resolve().then(() => daily.ensure()).catch(() => {}),
      take('17-0', import('./seventeen.js')), take('drill', import('./drill.js')),
      import('./kick.js').then(m => { MODS.kick = m; }, () => {}), import('./return.js').then(m => { MODS.return = m; }, () => {})
    ]).then(() => emit('games'));
  }
  return modsAsked;
}
const dayNo = (start, t) => {
  const [y, m, d] = String(start).split('-').map(Number);
  return 1 + Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
};
/** Each game's day number on date t (0 for a game not loaded). */
export function dayNumbers(t = new Date(), mods = MODS) {
  const out = {puzzles: daily.PZ && daily.PZ.start ? dayNo(daily.PZ.start, t) : 0};
  Object.keys(FIELDS).forEach(g => { let n = 0; try { n = mods[g] && mods[g].todayNumber ? mods[g].todayNumber(t) : 0; } catch (_) { n = 0; } out[g] = n || 0; });
  return out;
}
/** What a person's games have paid since from (ms): {total, by: {game: coins}, today: {game: coins}, days}.
 *  docs: their board docs. */
export function earnedOf(docs, from, {mods = MODS, now = new Date()} = {}) {
  docs = (docs || []).filter(p => p && typeof p === 'object');
  const start = dayNumbers(new Date(Number(from) || 0), mods), today = dayNumbers(now, mods);
  const out = {total: 0, by: {}, today: {}, days: 0};
  const pay = (g, v, n) => {
    if (!(v > 0)) return;
    out.total += v; out.by[g] = (out.by[g] || 0) + v; out.days++;
    if (n === today[g]) out.today[g] = (out.today[g] || 0) + v;
  };
  const counts = (g, n) => Number.isInteger(n) && n >= 1 && start[g] >= 1 && n >= start[g] && (!today[g] || n <= today[g]);
  // Daily Puzzles: the first finished across their docs
  const pz = new Map();
  docs.forEach(p => Object.keys((p.days && typeof p.days === 'object' && p.days) || {}).forEach(k => {
    const e = p.days[k], t = Number(e && e.t) || 0, was = pz.get(k);
    if (e && Number.isFinite(Number(e.p)) && (!was || t < was.t)) pz.set(k, {e, t});
  }));
  pz.forEach(({e}, k) => { const n = Number(k); if (counts('puzzles', n)) pay('puzzles', PAY.puzzles(e), n); });
  Object.keys(FIELDS).forEach(g => {
    const M = mods[g], F = FIELDS[g];
    if (!M || !M.entryOf) return;
    const keys = new Set();
    docs.forEach(p => Object.keys((p[F] && typeof p[F] === 'object' && p[F]) || {}).forEach(k => keys.add(Number(k))));
    keys.forEach(n => {
      if (!counts(g, n)) return;
      const entries = [];
      docs.forEach(p => { let e = null; try { e = M.entryOf(p, n); } catch (_) { e = null; } if (e) entries.push(e); });
      if (!entries.length) return;
      const first = entries.slice().sort((a, b) => (a.t || 0) - (b.t || 0))[0];
      pay(g, PAY[g](first), n);
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------- this phone's Dynasty
let PROFILE = '', MINE = null, dirty = false, saveT = 0;
const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(why) { subs.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } }); }
const allDocs = () => daily.LB.all || daily.LB.raw || [];
const boardKnown = () => !!(daily.LB.ready && daily.LB.synced && !daily.LB.off && daily.LB.uid);
export const myKey = () => data.me() || (data.user() ? 'user:' + data.user().id : daily.LB.uid ? 'row:' + daily.LB.uid : null);
/** This person's board docs (every phone of theirs): what their games paid. */
export function myDocs(list = daily.LB.raw || []) {
  const key = myKey();
  return key ? list.filter(p => daily.boardKey(p) === key || p.id === daily.LB.uid) : [];
}
function selectProfile() {
  const key = profileKey();
  if (key !== PROFILE) { clearTimeout(saveT); MINE = null; dirty = false; PROFILE = key; }
  return key;
}
function readLocal() { try { return clean(JSON.parse(localStorage.getItem(LOCAL(PROFILE)) || 'null')); } catch (_) { return null; } }
function writeLocal(s) { if (PROFILE) { try { localStorage.setItem(LOCAL(PROFILE), JSON.stringify(s)); } catch (_) {} } }
function currentRemote() {
  let best = null;
  for (const p of allDocs()) {
    if (PROFILE.startsWith('g_') && p.id !== daily.LB.uid) continue; // (a guest's only from this phone's own doc)
    const s = clean(p && p[FIELD] && p[FIELD][PROFILE]);
    if (s && (!best || s.at > best.at)) best = s;
  }
  return best;
}
/** Whether this profile has a Dynasty yet (here or saved on the board). */
export function started() {
  if (!mayPlay() || status !== 'ready') return false;
  selectProfile();
  return !!(MINE || readLocal() || currentRemote());
}
/** This profile's Dynasty (begun on first call). */
export function mine() {
  selectProfile();
  if (!MINE) {
    const local = readLocal(), remote = currentRemote();
    MINE = remote && (!local || remote.at > local.at) ? remote : local;
    if (MINE && MINE === local && (!remote || local.at > remote.at)) dirty = true;
    if (!MINE) { MINE = fresh(PROFILE); dirty = true; }
    // (a Dynasty from before the battles, Oct 28 2026: the starter Coach cards, and a deck from what it has)
    if (!MINE.kit) {
      Object.entries(COACH_KIT).forEach(([id, n]) => { MINE.o[id] = (MINE.o[id] || 0) + n; });
      MINE.kit = 1; MINE.dk = autoDeck(MINE.o); dirty = true;
    }
    // (and the starter Items, Oct 28 2026: a 20-card deck that's short of 20 is filled again)
    if (!MINE.kit2) {
      Object.entries(ITEM_KIT).forEach(([id, n]) => { MINE.o[id] = (MINE.o[id] || 0) + n; });
      MINE.kit2 = 1; if (MINE.dk.length < B.DECK_SIZE) MINE.dk = autoDeck(MINE.o); dirty = true;
    }
    // (and the Starter Pack, Oct 29 2026: to open, once)
    if (!MINE.kit3) { addPacks(MINE, {start: 1}); MINE.kit3 = 1; dirty = true; }
    writeLocal(MINE);
    if (dirty) later();
  }
  return MINE;
}
/** Takes in a newer copy from another phone (the board changed). True if it did. */
export function sync() {
  if (!PROFILE || !MINE) return false;
  const remote = currentRemote();
  if (remote && remote.at > MINE.at + 1000) { MINE = remote; writeLocal(MINE); emit('sync'); return true; }
  if (dirty) later();
  return false;
}
const later = () => { clearTimeout(saveT); saveT = setTimeout(flush, 1200); };
/** After a change: stamped, kept here and sent to the board shortly. */
export function touch(why = 'change') {
  if (!MINE || !PROFILE || PROFILE !== profileKey()) return;
  MINE.at = Date.now(); writeLocal(MINE); dirty = true; later(); emit(why);
}
export async function flush() {
  clearTimeout(saveT);
  const LB = daily.LB, key = PROFILE, s = MINE;
  if (!dirty || !s || !key || key !== profileKey() || !mayPlay() || !LB.put || !boardKnown()) return false;
  dirty = false;
  const body = {[FIELD]: {[key]: JSON.parse(JSON.stringify(s))}}, fields = [FIELD + '.' + key];
  const own = allDocs().find(p => p.id === LB.uid);
  if (!own) {
    Object.assign(body, {nick: (data.me() ? data.name(data.me()) : data.guest() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0});
    fields.push('nick', 'g', 'total');
  }
  try { await LB.put(body, fields); return true; } catch (_) { if (PROFILE === key && MINE === s) dirty = true; return false; }
}
try {
  data.subscribe(type => { if (type === 'me') { selectProfile(); emit('profile'); } });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('online', () => { sync(); flush(); });
} catch (_) {}

// ---------------------------------------------------------------------------------------------------- the wallet
let EARNED = {total: 0, by: {}, today: {}, days: 0}, EARNED_AT = 0;
/** What the games have paid this Dynasty (worked out again at most every few seconds). */
export function earned(s = mine(), force = false) {
  if (force || Date.now() - EARNED_AT > 4000) {
    try { EARNED = earnedOf(myDocs(), s.born); } catch (e) { console.error(e); }
    EARNED_AT = Date.now();
  }
  return EARNED;
}
export const balance = (s = mine()) => Math.max(0, STARTER_COINS + earned(s).total + s.cr - s.sp);
const spend = (s, n) => { if (balance(s) < n) return false; s.sp += n; return true; };
const credit = (s, n) => { s.cr += Math.max(0, Math.round(n)); };
const addCard = (s, id) => { s.o[id] = (s.o[id] || 0) + 1; };
const addPacks = (s, packs) => Object.entries(packs || {}).forEach(([k, n]) => { if (PACKS[k]) s.pk[k] = (s.pk[k] || 0) + n; });

/** Whether this Dynasty opens packs without end (Evan's and Ryan Stewart's: core/features.js packsUnlimited, Oct 29 2026). */
export const unlimited = (key = PROFILE) => packsUnlimited(key);
/** Whether today's free pack is waiting. */
export const dailyReady = (s = mine(), t = new Date()) => s.dd !== dayKey(t);
/** Takes today's free Standard Pack. True if it did. */
export function claimDaily(s = mine(), t = new Date()) {
  if (!dailyReady(s, t)) return false;
  s.dd = dayKey(t); addPacks(s, {[DAILY_PACK]: 1}); touch(); return true;
}
/** Buys a pack (kept to open). {ok, why}. */
export function buy(kind, s = mine()) {
  const P = PACKS[kind];
  if (!P || P.starter) return {ok: false, why: 'No such pack.'};
  if (!spend(s, P.price)) return {ok: false, why: `You need ${data.nf(P.price - balance(s))} more coins.`};
  addPacks(s, {[kind]: 1}); touch(); return {ok: true};
}
/** Opens one of your packs: its cards go in your collection. {ok, cards: [ids], dup: {id: true}} (team: a Team Pack's;
 *  free: unlimited packs, one held is used first, then none is needed). */
export function open(kind, {team = null, free = unlimited()} = {}, s = mine()) {
  if (!PACKS[kind]) return {ok: false, why: 'No such pack.'};
  free = free && !PACKS[kind].unique; // (the Starter Pack stays one)
  if (!free && !(s.pk[kind] > 0)) return {ok: false, why: 'You have none of those to open.'};
  if (PACKS[kind].team && !TEAMS[team]) return {ok: false, why: 'Pick a team first.'};
  const ids = drawPack(kind, {team});
  const dup = {};
  ids.forEach(id => { if (s.o[id] > 0) dup[id] = true; else if (!s.nw.includes(id)) s.nw.unshift(id); addCard(s, id); });
  s.nw = s.nw.slice(0, 60);
  if (s.pk[kind] > 0) { s.pk[kind] -= 1; if (!s.pk[kind]) delete s.pk[kind]; }
  s.pp += PP_PER_PACK;
  s.lp = [...ids.slice().reverse(), ...s.lp].slice(0, 24);
  // (the Starter Pack's players make a deck that isn't ready: a new Dynasty's first)
  if (PACKS[kind].starter && !B.checkDeck(s.dk, s.o).ok) s.dk = autoDeck(s.o);
  touch('open');
  return {ok: true, cards: ids, dup};
}
/** Trades pack points for a card. {ok, why}. */
export function exchange(id, s = mine()) {
  const c = anyCard(id), cost = ppCost(c);
  if (!c || !cost) return {ok: false, why: 'That card can’t be traded for.'};
  if (s.pp < cost) return {ok: false, why: `You need ${data.nf(cost - s.pp)} more pack points.`};
  s.pp -= cost;
  if (!(s.o[id] > 0) && !s.nw.includes(id)) s.nw.unshift(id);
  addCard(s, id); s.lp = [id, ...s.lp].slice(0, 24);
  touch('open'); return {ok: true};
}
/** Opens today's free pack straight away (Pocket's daily pack). */
export function openFree(s = mine(), t = new Date()) {
  if (!claimDaily(s, t)) return {ok: false, why: 'Today’s free pack is taken.'};
  return open(DAILY_PACK, {}, s);
}
/** Buys a pack and opens it. */
export function buyOpen(kind, {team = null} = {}, s = mine()) {
  const r = buy(kind, s);
  return r.ok ? open(kind, {team}, s) : r;
}
/** Quick-sells copies of a card (the copies in your deck are kept). {ok, coins}. */
export function sell(id, n = 1, s = mine()) {
  const c = anyCard(id), have = s.o[id] || 0;
  const keep = s.dk.filter(x => x === id).length;
  n = Math.min(n, have - keep);
  if (!c || n <= 0) return {ok: false, coins: 0};
  s.o[id] = have - n; if (!s.o[id]) { delete s.o[id]; s.nw = s.nw.filter(x => x !== id); }
  const coins = sellValue(c) * n; credit(s, coins); touch(); return {ok: true, coins};
}
/** Every spare copy (beyond the first) of every card: [{id, n, coins}] and the total. */
export function spares(s = mine()) {
  // (spares: beyond the first, or beyond as many as your deck uses)
  const list = Object.entries(s.o).map(([id, n]) => ({id, n: n - Math.max(1, s.dk.filter(x => x === id).length)})).filter(x => x.n > 0 && anyCard(x.id))
    .map(x => ({...x, coins: sellValue(anyCard(x.id)) * x.n}));
  return {list, coins: list.reduce((t, x) => t + x.coins, 0)};
}
export function sellSpares(s = mine()) {
  const {list, coins} = spares(s);
  if (!list.length) return 0;
  list.forEach(x => { s.o[x.id] -= x.n; }); credit(s, coins); touch(); return coins;
}
/** Claims a finished collection's reward. {ok, reward}. */
export function claim(id, s = mine()) {
  const col = collection(id), p = progress(col, s);
  if (!col || !p.done || p.claimed) return {ok: false};
  s.cl[id] = Date.now();
  const rw = col.reward;
  if (rw.coins) credit(s, rw.coins);
  addPacks(s, rw.packs);
  if (rw.card) { addCard(s, rw.card); s.lp = [rw.card, ...s.lp].slice(0, 24); }
  touch(); return {ok: true, reward: rw};
}
/** The collections ready to claim. */
export const claimable = (s = mine()) => COLLECTIONS.filter(c => { const p = progress(c, s); return p.done && !p.claimed; });
export const markSeen = (ids, s = mine()) => { const was = s.nw.length; s.nw = s.nw.filter(id => !ids.includes(id)); if (s.nw.length !== was) { writeLocal(s); dirty = true; later(); } };
export const isNew = (id, s = mine()) => s.nw.includes(id);
/** The unique cards held, and of how many. */
export const owned = (s = mine()) => ({have: Object.keys(s.o).filter(isCard).length, of: CARDS.length + TRAINER_IDS.length});

// ---------------------------------------------------------------------------------------------------- battles paid
// What a battle pays, once, when you see it's over (core/dynasty-match.js settle): coins and trophies (never below 0).
export const BATTLE_PAY = {w: {coins: 400, tr: 30}, l: {coins: 100, tr: -15}, d: {coins: 200, tr: 0}};
/** Records a finished battle's result for you ('w', 'l' or 'd'): paid once. True if it was new. */
export function payBattle(mid, res, s = mine()) {
  if (!BATTLE_PAY[res] || s.bt[mid]) return false;
  s.bt[mid] = res; credit(s, BATTLE_PAY[res].coins); s.tr = Math.max(0, s.tr + BATTLE_PAY[res].tr);
  s.rec[res] = (s.rec[res] || 0) + 1;
  touch('battle'); return true;
}

// ---------------------------------------------------------------------------------------------------- Solo battles paid
// (core/dynasty-solo.js, against the computer) A win pays its level's coins, and the first win over each opponent its
// bonus packs too; a draw 50 coins, a loss nothing. Never trophies or the versus record: Rankings are between players.
export const SOLO_PAY = {beg: {coins: 150, first: {std: 1}}, int: {coins: 250, first: {std: 2}}, adv: {coins: 400, first: {prem: 1}}, exp: {coins: 600, first: {prem: 2}}};
/** Pays Solo battle gid (opponent opp at level lv) its result: once. {coins, packs, first} or null when already paid. */
export function paySolo(gid, opp, lv, res, s = mine()) {
  if (!SOLO_PAY[lv] || !['w', 'l', 'd'].includes(res) || s.sl.includes(gid)) return null;
  s.sl = [gid, ...s.sl].slice(0, 20);
  const first = res === 'w' && !s.so[opp];
  const pay = {coins: res === 'w' ? SOLO_PAY[lv].coins : res === 'd' ? 50 : 0, packs: first ? SOLO_PAY[lv].first : null, first};
  if (res === 'w') s.so[opp] = (s.so[opp] || 0) + 1;
  credit(s, pay.coins); if (pay.packs) addPacks(s, pay.packs);
  touch('battle'); return pay;
}

// ---------------------------------------------------------------------------------------------------- other players
/** Your team's saved name, or the Rivals default. Stored names stay unchanged. */
export function teamName(s = mine(), who = null) {
  if (s && s.nm) return s.nm;
  const n = who ? who.name : data.me() ? data.name(data.me()) : (data.user() && (data.user().board || data.user().name)) || data.guest() || 'Your';
  return `${String(n).split(/\s+/)[0]}’s Rivals`;
}
/** Everyone else's Dynasty this phone may see (the scoreboards' rule: everyone, from daily.LB.raw), the freshest copy
 *  of each: [{key, name, member, guest, team, state, tr, cards, cols, rec, deck (a legal deck)}], the most trophies first. */
export function others(docs = daily.LB.raw || [], {withMe = false} = {}) {
  const own = profileKey(), best = new Map();
  for (const p of docs) {
    const all = p && p[FIELD];
    if (!all || typeof all !== 'object') continue;
    for (const key of Object.keys(all)) {
      if (!key || (!withMe && key === own) || !dynastyKey(key)) continue; // (theirs only: features.js dynastyKey)
      const s = clean(all[key]), who = s && visitWho(key, p);
      if (who && (!best.has(key) || s.at > best.get(key).s.at)) best.set(key, {s, who});
    }
  }
  if (withMe && mayPlay() && MINE && own) best.set(own, {s: MINE, who: {name: data.me() ? data.name(data.me()) : data.guest() || 'You', member: data.me() || null}, me: true});
  const out = [];
  best.forEach(({s, who, me}, key) => {
    out.push({key, me: !!me || key === own, name: who.name, member: who.member || null, guest: !!who.guest, team: teamName(s, who), state: s,
      tr: s.tr, cards: Object.keys(s.o).filter(isCard).length, cols: Object.keys(s.cl).length, rec: s.rec, at: s.at, deck: B.checkDeck(s.dk, s.o).ok});
  });
  return out.sort((a, b) => b.tr - a.tr || b.cards - a.cards || a.name.localeCompare(b.name));
}
