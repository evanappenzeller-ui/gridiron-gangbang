// Gridiron Dynasty (the owner's ask, Oct 27 2026: "most comparable to Ultimate Team in Madden. Players can earn points to
// open packs to unlock players. Players are based on real life [players]... inspiration [from] how MLB The Show does
// their player cards with different types and collections"). A persistent game on Daily Games, everyone's (CLAUDE.md).
//
// The cards (data/dynasty.json, tools/dynasty/build.py): real NFL players from nflverse, in six series after The Show's
// card types: Live Series (every active player, OVR from his 2025 and 2026 play), Rookie, Prime, Gameday (a week's best
// real games, The Show's Topps Now), Awards (2025's leaders) and Legends. Rarity by OVR as The Show's: Diamond 85+,
// Gold 80-84, Silver 75-79, Bronze 65-74, Common.
//
// Coins: the Daily Games pay them (earnedOf: every game day you play from the day your Dynasty began, read from your
// board docs, so nothing is paid twice and every phone agrees), with a free Standard Pack a day, quick-selling cards,
// collection rewards and games won. Spent coins and credits are kept (sp, cr): your balance is starter + earned + cr - sp.
// Packs (PACKS, their odds shown in the store), the collection (o: card id -> copies), collections (COLLECTIONS, their
// rewards claimed once: cl), your squad (sq: slot -> card id, 23 starters: SLOTS), games against the computer's teams
// (three a day) and against other players' squads (once a day each): sim().
//
// Where it lives: this phone's board doc (players/{uid}, daily.js) as dy1 under the profile's own key (profileKey: m_<member>,
// u_<app user>, g_<guest>), so a player's Dynasty is the same on every phone of theirs; locally under gg-dy1-<key>. Other
// players' squads and the Dynasty board follow the scoreboards' rule (CLAUDE.md): everyone to everyone, read from
// daily.LB.raw (never LB.all, except for finding your own saved copy, as Keepfall does).
import * as daily from './daily.js';
import * as data from './data.js';
import {profileKey, visitWho} from './realm-active.js';

export const FIELD = 'dy1';
export const VERSION = 1;
export const SEASON_MARK = 'gridiron-hub-v3';
export const STARTER_COINS = 2500;
export const DAILY_PACK = 'std';
const LOCAL = key => `gg-dy1-${key}`;

/** Whether this phone can play: a member, an app user or a guest picked. */
export const mayPlay = () => !!(data.me() || data.guest());

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
export const RARITY = ['common', 'bronze', 'silver', 'gold', 'diamond'];
export const RARITY_NAME = {common: 'Common', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond'};
export const rarityOf = ovr => (ovr >= 85 ? 'diamond' : ovr >= 80 ? 'gold' : ovr >= 75 ? 'silver' : ovr >= 65 ? 'bronze' : 'common');
export const POS_NAME = {QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', OL: 'Offensive line', DL: 'Defensive line',
  LB: 'Linebacker', CB: 'Cornerback', S: 'Safety', K: 'Kicker'};
export const ATTR_NAME = {ARM: 'Arm', ACC: 'Accuracy', IQ: 'Decisions', RUN: 'Rushing', BRK: 'Breakaway', REC: 'Receiving', TD: 'Scoring',
  CTH: 'Hands', RTE: 'Routes', YAC: 'After catch', DEEP: 'Deep threat', PWR: 'Power', CLU: 'Clutch', PRS: 'Pass rush', TKL: 'Tackling',
  COV: 'Coverage', PBK: 'Pass block', RBK: 'Run block', DUR: 'Durability'};

export let DATA = null;     // data/dynasty.json as loaded
export let CARDS = [];      // every card: {id, s, p, o, a, ln, t, tm, w, r, name, pos, team, num, head, college, exp}
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
      name: pl[0], team: c[7] || pl[1], pos: pl[2], num: pl[3], head: pl[4], exp: pl[5], college: pl[6], draft: pl[7]};
    card.r = rarityOf(card.o);
    BY_ID.set(card.id, card);
    return card;
  });
  POOLS.clear();
  COLLECTIONS = buildCollections();
}
export const card = id => BY_ID.get(id) || null;
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
  std: {name: 'Standard Pack', price: 1000, blurb: 'Five Live Series cards.', color: '#2F6FDE',
    slots: [{n: 5, pool: 'live', odds: {common: 34, bronze: 38, silver: 18, gold: 8, diamond: 2}}]},
  team: {name: 'Team Pack', price: 1500, blurb: 'Five Live Series cards from the team you pick.', color: '#1E9E6A', team: true,
    slots: [{n: 5, pool: 'live', odds: {common: 25, bronze: 40, silver: 22, gold: 10, diamond: 3}}]},
  prem: {name: 'Premium Pack', price: 3000, blurb: 'Six cards, the last one Gold or better. Rookies and specials inside.', color: '#8B3FD9',
    slots: [{n: 5, pool: 'all', odds: {common: 10, bronze: 35, silver: 30, gold: 18, diamond: 7}}, {n: 1, pool: 'all', odds: {gold: 75, diamond: 25}}]},
  gday: {name: 'Gameday Pack', price: 4000, blurb: 'A Gameday card from a real game, and two Gold-or-better cards.', color: '#E0702A',
    slots: [{n: 1, pool: 'gameday', odds: {diamond: 100}}, {n: 2, pool: 'live', odds: {gold: 80, diamond: 20}}]},
  leg: {name: 'Legends Pack', price: 12000, blurb: 'A 90+ special card (Legend, Prime, Award or Gameday) and two Diamonds.', color: '#C9A227',
    slots: [{n: 1, pool: 'elite', odds: {diamond: 100}}, {n: 2, pool: 'live', odds: {diamond: 100}}]}
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
/** One card for a slot of a pack: R the randomness (luck by default). */
export function drawCard(slot, {team = null, R = luck} = {}) {
  const rar = pickW(Object.keys(slot.odds), r => slot.odds[r], R);
  let list = [];
  if (slot.pool === 'live') list = poolOf('live', team, rar);
  else if (slot.pool === 'gameday') {
    // (the latest week's cards three times as likely as an older week's)
    const all = poolOf('gameday', null, ''), lw = lastWeek();
    return pickW(all, c => (c.w === lw ? 3 : 1), R);
  } else if (slot.pool === 'elite') {
    const s = pickW(Object.keys(ELITE_MIX), x => ELITE_MIX[x], R);
    list = CARDS.filter(c => c.s === s && c.o >= 90);
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
  const out = [];
  P.slots.forEach(sl => { for (let i = 0; i < sl.n; i++) out.push(drawCard(sl, {team, R}).id); });
  return out;
}
/** The odds a pack shows: per slot group, each rarity's chance in percent. */
export const packOdds = kind => (PACKS[kind] ? PACKS[kind].slots.map(sl => {
  const tot = Object.values(sl.odds).reduce((a, b) => a + b, 0);
  return {n: sl.n, pool: sl.pool, odds: RARITY.filter(r => sl.odds[r]).map(r => ({r, pct: Math.round(sl.odds[r] / tot * 1000) / 10}))};
}) : []);

// ---------------------------------------------------------------------------------------------------- quick sell
const SELL = {common: 10, bronze: 40, silver: 150, gold: 500, diamond: 1500};
const SELL_SPECIAL = {R: 1.5, G: 2, A: 2.5, P: 2.5, X: 4};
/** What a card quick-sells for, in coins. */
export const sellValue = c => (c ? Math.round((SELL[c.r] || 0) * (c.s === 'L' ? 1 : SELL_SPECIAL[c.s] || 1)) : 0);

// ---------------------------------------------------------------------------------------------------- the squad
// 23 starters: the offense (QB, RB, three WRs, TE, five on the line), the defense (four down linemen, three backers,
// two corners, two safeties) and the kicker. Each slot's weight in the team's OVR (the quarterback's the most).
export const SLOTS = [
  {id: 'QB', pos: 'QB', side: 'off', w: 3}, {id: 'RB', pos: 'RB', side: 'off', w: 1.3},
  {id: 'WR1', pos: 'WR', side: 'off', w: 1.3}, {id: 'WR2', pos: 'WR', side: 'off', w: 1.1}, {id: 'WR3', pos: 'WR', side: 'off', w: 0.9},
  {id: 'TE', pos: 'TE', side: 'off', w: 1},
  {id: 'LT', pos: 'OL', side: 'off', w: 0.9}, {id: 'LG', pos: 'OL', side: 'off', w: 0.7}, {id: 'C', pos: 'OL', side: 'off', w: 0.7},
  {id: 'RG', pos: 'OL', side: 'off', w: 0.7}, {id: 'RT', pos: 'OL', side: 'off', w: 0.8},
  {id: 'DL1', pos: 'DL', side: 'def', w: 1.1}, {id: 'DL2', pos: 'DL', side: 'def', w: 0.9}, {id: 'DL3', pos: 'DL', side: 'def', w: 0.9}, {id: 'DL4', pos: 'DL', side: 'def', w: 1.1},
  {id: 'LB1', pos: 'LB', side: 'def', w: 1}, {id: 'LB2', pos: 'LB', side: 'def', w: 0.9}, {id: 'LB3', pos: 'LB', side: 'def', w: 0.8},
  {id: 'CB1', pos: 'CB', side: 'def', w: 1.2}, {id: 'CB2', pos: 'CB', side: 'def', w: 1},
  {id: 'S1', pos: 'S', side: 'def', w: 1}, {id: 'S2', pos: 'S', side: 'def', w: 0.9},
  {id: 'K', pos: 'K', side: 'st', w: 0.5}
];
export const SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]));
const EMPTY_OVR = 40; // (an empty slot plays as a 40)
/** A squad's ratings: {ovr, off, def, st}: weighted averages of its starters' OVRs. sq: slot -> card id. */
export function squadRating(sq) {
  const acc = {all: [0, 0], off: [0, 0], def: [0, 0], st: [0, 0]};
  SLOTS.forEach(s => {
    const c = card(sq && sq[s.id]), o = c && c.pos === s.pos ? c.o : EMPTY_OVR;
    acc.all[0] += o * s.w; acc.all[1] += s.w;
    acc[s.side][0] += o * s.w; acc[s.side][1] += s.w;
  });
  const r = k => (acc[k][1] ? Math.round(acc[k][0] / acc[k][1]) : EMPTY_OVR);
  return {ovr: r('all'), off: r('off'), def: r('def'), st: r('st')};
}
/** The best squad out of a collection: each slot the best card of its position not already in (one card of a player). */
export function bestSquad(owned) {
  const ids = Object.keys(owned || {}).filter(id => owned[id] > 0 && card(id));
  const byPos = {};
  ids.map(card).sort((a, b) => b.o - a.o || a.name.localeCompare(b.name)).forEach(c => (byPos[c.pos] = byPos[c.pos] || []).push(c));
  const used = new Set(), sq = {};
  SLOTS.slice().sort((a, b) => b.w - a.w).forEach(s => {
    const c = (byPos[s.pos] || []).find(x => !used.has(x.p));
    if (c) { sq[s.id] = c.id; used.add(c.p); }
  });
  return sq;
}
/** Whether card id can go in slot (its position) without the same player twice. */
export function fits(sq, slot, id) {
  const c = card(id), s = SLOT[slot];
  if (!c || !s || c.pos !== s.pos) return false;
  return !SLOTS.some(o => o.id !== slot && sq[o.id] && card(sq[o.id]) && card(sq[o.id]).p === c.p);
}

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
// {v, rs, born, at, sp (coins spent), cr (coins credited: sales, rewards, wins, the daily bonus), o {card id: copies},
//  pk {pack kind: unopened}, cl {collection id: when claimed}, sq {slot: card id}, dd (the last day the daily pack was
//  taken, YYYY-MM-DD), gm {d: the day, c: {cpu level: result}, h: {opponent key: result}}, rec {w, l}, nm (team name),
//  lp (the latest pulls, newest first: 24 at most), nw (cards pulled for the first time and not looked at yet: NEW)}
export const dayKey = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
/** A new Dynasty: the starter squad (a Common or Bronze card at every slot, the same for this profile on any phone),
 *  and the welcome packs. */
export function fresh(key = '', now = Date.now()) {
  const R = rng('starter|' + key), o = {}, used = new Set();
  SLOTS.forEach(s => {
    const all = CARDS.filter(c => c.s === 'L' && c.pos === s.pos && !used.has(c.p));
    // (a Common or low Bronze; a position with none, its lowest five)
    let list = all.filter(c => c.o >= 58 && c.o <= 66);
    if (!list.length) list = all.slice().sort((a, b) => a.o - b.o).slice(0, 5);
    const c = list.length ? list[Math.floor(R() * list.length)] : null;
    if (c) { o[c.id] = 1; used.add(c.p); }
  });
  const s = {v: VERSION, rs: SEASON_MARK, born: now, at: now, sp: 0, cr: 0, o, pk: {std: 2, prem: 1}, cl: {}, sq: {}, dd: '', gm: {d: '', c: {}, h: {}},
    rec: {w: 0, l: 0}, nm: '', lp: [], nw: []};
  s.sq = bestSquad(o);
  return s;
}
/** A save as it should be (anything missing or broken put right), or null when it isn't one. */
export function clean(s) {
  if (!s || typeof s !== 'object' || s.rs !== SEASON_MARK) return null;
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const n = x => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.floor(Number(x)) : 0);
  const out = {v: VERSION, rs: SEASON_MARK, born: n(s.born) || Date.now(), at: n(s.at), sp: n(s.sp), cr: n(s.cr), o: {}, pk: {}, cl: {}, sq: {},
    dd: typeof s.dd === 'string' ? s.dd : '', gm: {d: '', c: {}, h: {}}, rec: {w: n(s.rec && s.rec.w), l: n(s.rec && s.rec.l)},
    nm: typeof s.nm === 'string' ? s.nm.slice(0, 24) : '', lp: Array.isArray(s.lp) ? s.lp.filter(x => typeof x === 'string').slice(0, 24) : [], nw: []};
  Object.entries(obj(s.o)).forEach(([k, v]) => { if (n(v) > 0) out.o[k] = Math.min(99, n(v)); });
  Object.entries(obj(s.pk)).forEach(([k, v]) => { if (PACKS[k] && n(v) > 0) out.pk[k] = Math.min(999, n(v)); });
  Object.entries(obj(s.cl)).forEach(([k, v]) => { if (v) out.cl[k] = n(v) || 1; });
  Object.entries(obj(s.sq)).forEach(([k, v]) => { if (SLOT[k] && typeof v === 'string' && out.o[v] > 0) out.sq[k] = v; });
  if (Array.isArray(s.nw)) out.nw = [...new Set(s.nw.filter(k => typeof k === 'string' && out.o[k] > 0))].slice(0, 60);
  const g = obj(s.gm);
  if (typeof g.d === 'string') out.gm = {d: g.d, c: obj(g.c), h: obj(g.h)};
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
  if (!P) return {ok: false, why: 'No such pack.'};
  if (!spend(s, P.price)) return {ok: false, why: `You need ${data.nf(P.price - balance(s))} more coins.`};
  addPacks(s, {[kind]: 1}); touch(); return {ok: true};
}
/** Opens one of your packs: its cards go in your collection. {ok, cards: [ids], dup: {id: true}} (team: a Team Pack's). */
export function open(kind, {team = null} = {}, s = mine()) {
  if (!(s.pk[kind] > 0)) return {ok: false, why: 'You have none of those to open.'};
  if (PACKS[kind].team && !TEAMS[team]) return {ok: false, why: 'Pick a team first.'};
  const ids = drawPack(kind, {team});
  const dup = {};
  ids.forEach(id => { if (s.o[id] > 0) dup[id] = true; else if (!s.nw.includes(id)) s.nw.unshift(id); addCard(s, id); });
  s.nw = s.nw.slice(0, 60);
  s.pk[kind] -= 1; if (!s.pk[kind]) delete s.pk[kind];
  s.lp = [...ids.slice().reverse(), ...s.lp].slice(0, 24);
  touch('open');
  return {ok: true, cards: ids, dup};
}
/** Quick-sells copies of a card (a squad starter keeps one). {ok, coins}. */
export function sell(id, n = 1, s = mine()) {
  const c = card(id), have = s.o[id] || 0;
  const keep = Object.values(s.sq).includes(id) ? 1 : 0;
  n = Math.min(n, have - keep);
  if (!c || n <= 0) return {ok: false, coins: 0};
  s.o[id] = have - n; if (!s.o[id]) { delete s.o[id]; s.nw = s.nw.filter(x => x !== id); }
  const coins = sellValue(c) * n; credit(s, coins); touch(); return {ok: true, coins};
}
/** Every spare copy (beyond the first) of every card: [{id, n, coins}] and the total. */
export function spares(s = mine()) {
  const list = Object.entries(s.o).filter(([id, n]) => n > 1 && card(id)).map(([id, n]) => ({id, n: n - 1, coins: sellValue(card(id)) * (n - 1)}));
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
/** Puts a card in a slot (null: empties it). True if it went. */
export function setSlot(slot, id, s = mine()) {
  if (id == null) { delete s.sq[slot]; touch(); return true; }
  if (!(s.o[id] > 0) || !fits(s.sq, slot, id)) return false;
  s.sq[slot] = id; touch(); return true;
}
export function autoSquad(s = mine()) { s.sq = bestSquad(s.o); touch(); return s.sq; }
export const markSeen = (ids, s = mine()) => { const was = s.nw.length; s.nw = s.nw.filter(id => !ids.includes(id)); if (s.nw.length !== was) { writeLocal(s); dirty = true; later(); } };
export const isNew = (id, s = mine()) => s.nw.includes(id);
/** The unique cards held, and of how many. */
export const owned = (s = mine()) => ({have: Object.keys(s.o).filter(id => card(id)).length, of: CARDS.length});

// ---------------------------------------------------------------------------------------------------- games
// Three games a day against the computer (CPU: a squad of about that OVR, its name and colours a city's), and one a
// day against each other player's squad (their saved one, as it is now). A game is simulated drive by drive from the
// two squads' ratings (sim): the same two squads on the same day play the same game on every phone.
export const CPU = [
  {id: 'rookie', name: 'Rookie', ovr: 70, win: 300, loss: 75},
  {id: 'pro', name: 'Pro', ovr: 79, win: 500, loss: 100},
  {id: 'allpro', name: 'All-Pro', ovr: 87, win: 900, loss: 150}
];
export const H2H_PAY = {win: 600, loss: 150};
const CPU_NAMES = ['Ironclads', 'Thunder', 'Outlaws', 'Comets', 'Grizzlies', 'Sentinels', 'Vipers', 'Mustangs', 'Blizzard', 'Marauders', 'Hammerheads', 'Wildcats'];
const CPU_COLORS = [['#2B2D42', '#EF233C'], ['#1B4332', '#95D5B2'], ['#3A0CA3', '#F72585'], ['#7F5539', '#EDE0D4'], ['#0B132B', '#5BC0BE'], ['#6A040F', '#FFBA08']];
/** The computer's team of a level for a day: {key, name, pri, sec, sq, ovr}. */
export function cpuTeam(level, day = dayKey()) {
  const L = CPU.find(c => c.id === level) || CPU[0], R = rng(`cpu|${level}|${day}`);
  const sq = {}, used = new Set();
  SLOTS.forEach(s => {
    const near = CARDS.filter(c => c.s === 'L' && c.pos === s.pos && Math.abs(c.o - L.ovr) <= 3 && !used.has(c.p));
    const list = near.length ? near : CARDS.filter(c => c.s === 'L' && c.pos === s.pos && !used.has(c.p));
    const c = list[Math.floor(R() * list.length)];
    if (c) { sq[s.id] = c.id; used.add(c.p); }
  });
  const [pri, sec] = CPU_COLORS[Math.floor(R() * CPU_COLORS.length)];
  return {key: 'cpu:' + level, name: `${L.name} ${CPU_NAMES[Math.floor(R() * CPU_NAMES.length)]}`, pri, sec, sq, ovr: squadRating(sq).ovr, cpu: L};
}

/** Simulates a game: a and b {name, sq}; seed for its randomness. Returns {a: points, b: points, plays: [{q, side, text,
 *  score: [a, b], big}], mvp: card id, win: 'a'|'b'}. Overtime breaks a tie (a field goal). */
export function sim(A, B, seed) {
  const R = rng(seed);
  const side = T => {
    const at = slot => card(T.sq && T.sq[slot]) || null;
    const ov = slot => { const c = at(slot); return c && c.pos === SLOT[slot].pos ? c.o : EMPTY_OVR; };
    const avg = list => list.reduce((t, s) => t + ov(s), 0) / list.length;
    return {T, at, ol: avg(['LT', 'LG', 'C', 'RG', 'RT']), qb: ov('QB'), rb: ov('RB'), rec: avg(['WR1', 'WR2', 'WR3', 'TE']),
      dl: avg(['DL1', 'DL2', 'DL3', 'DL4']), lb: avg(['LB1', 'LB2', 'LB3']), db: avg(['CB1', 'CB2', 'S1', 'S2']), k: ov('K')};
  };
  const S = {a: side(A), b: side(B)}, pts = {a: 0, b: 0}, plays = [], credit = {};
  // (any given Sunday: each side's form on the day, up to 4 points of OVR either way)
  S.a.form = (R() - 0.5) * 8; S.b.form = (R() - 0.5) * 8;
  const nm = c => (c ? c.name : 'A backup');
  const give = (c, n) => { if (c) credit[c.id] = (credit[c.id] || 0) + n; };
  const pick = (o, slots) => { const cs = slots.map(o.at).filter(Boolean); return cs.length ? pickW(cs, c => Math.pow(c.o, 3), R) : null; };
  const drive = (q, who) => {
    const O = S[who], D = S[who === 'a' ? 'b' : 'a'];
    const pass = 0.5 * O.qb + 0.35 * O.rec + 0.15 * O.ol, run = 0.5 * O.rb + 0.35 * O.ol + 0.15 * O.qb;
    const pd = 0.6 * D.db + 0.4 * (0.6 * D.dl + 0.4 * D.lb), rd = 0.5 * D.dl + 0.4 * D.lb + 0.1 * D.db;
    const passing = R() < 0.58;
    // (the matchup on this drive, each side's form on the day counted: about -1.5 .. 1.5)
    const edge = ((passing ? pass - pd : run - rd) + O.form - D.form + 1) / 10;
    const td = clamp(0.21 + 0.065 * edge, 0.07, 0.42), fg = clamp(0.17 + 0.02 * edge + 0.02 * ((O.k - 75) / 10), 0.08, 0.3);
    const to = clamp(0.12 - 0.025 * edge, 0.05, 0.22);
    const r = R(), qb = O.at('QB');
    const yds = () => 1 + Math.floor(R() * (R() < 0.3 ? 70 : 28));
    let text = '', big = false, n = 0;
    if (r < td) {
      n = 7;
      if (passing) {
        const to2 = pick(O, ['WR1', 'WR2', 'WR3', 'TE', 'RB']), y = yds();
        text = `${nm(qb)} finds ${nm(to2)} for a ${y}-yard touchdown.`; give(qb, 4); give(to2, 6); big = y >= 40;
      } else {
        const ball = R() < 0.85 ? O.at('RB') : qb, y = Math.max(1, Math.floor(yds() / 2));
        text = `${nm(ball)} runs it in from ${y} yard${y === 1 ? '' : 's'} out.`; give(ball, 6); big = y >= 30;
      }
    } else if (r < td + fg) {
      n = 3;
      const k = O.at('K'), y = 22 + Math.floor(R() * (O.k >= 85 ? 36 : 30));
      text = `${nm(k)} hits from ${y}.`; give(k, 2); big = y >= 50;
    } else if (r < td + fg + to) {
      if (passing) { const d = pick(D, ['CB1', 'CB2', 'S1', 'S2', 'LB1']); text = `${nm(d)} picks off ${nm(qb)}.`; give(d, 5); big = true; }
      else { const d = pick(D, ['DL1', 'DL2', 'DL3', 'DL4', 'LB1', 'LB2']); text = `${nm(d)} forces a fumble, and the defense recovers.`; give(d, 5); }
    } else {
      const d = R() < 0.45 ? pick(D, ['DL1', 'DL2', 'DL3', 'DL4', 'LB1', 'LB2', 'LB3']) : null;
      if (d && passing) { text = `${nm(d)} sacks ${nm(qb)} on third down. Punt.`; give(d, 3); }
      else if (d) { text = `${nm(d)} stuffs ${nm(O.at('RB'))} on third and short. Punt.`; give(d, 2); }
      else text = [`Three and out for ${O.T.name}.`, `${nm(qb)}’s drive stalls near midfield. Punt.`, `${O.T.name} can’t convert on third down. Punt.`][Math.floor(R() * 3)];
    }
    pts[who] += n;
    plays.push({q, side: who, text, score: [pts.a, pts.b], n, big, quiet: !n && r >= td + fg + to});
  };
  // (about eleven drives each, as an NFL game has: the ball changes hands every drive, the second half kicked to the
  // team that didn't get the first)
  const first = R() < 0.5 ? 'a' : 'b', other = w => (w === 'a' ? 'b' : 'a');
  let who = first;
  for (let q = 1; q <= 4; q++) {
    if (q === 3) who = other(first);
    const n = 5 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) { drive(q, who); who = other(who); }
  }
  if (pts.a === pts.b) {
    const who = (S.a.k + S.a.qb) / 2 + (R() - 0.5) * 20 > (S.b.k + S.b.qb) / 2 ? 'a' : 'b', k = S[who].at('K');
    pts[who] += 3; give(k, 5);
    plays.push({q: 5, side: who, text: `Overtime: ${nm(k)} wins it from ${30 + Math.floor(R() * 20)}.`, score: [pts.a, pts.b], n: 3, big: true});
  }
  const win = pts.a > pts.b ? 'a' : 'b';
  const winners = new Set(SLOTS.map(s => S[win].T.sq && S[win].T.sq[s.id]).filter(Boolean));
  const mvp = Object.entries(credit).filter(([id]) => winners.has(id)).sort((x, y) => y[1] - x[1])[0];
  return {a: pts.a, b: pts.b, plays, mvp: mvp ? mvp[0] : null, win};
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function gamesToday(s, t = new Date()) {
  const d = dayKey(t);
  if (s.gm.d !== d) s.gm = {d, c: {}, h: {}};
  return s.gm;
}
/** Today's results: {c: {level: result}, h: {key: result}}. */
export const todayGames = (s = mine()) => (s.gm.d === dayKey() ? s.gm : {d: dayKey(), c: {}, h: {}});
/** Plays a game today: vs 'cpu:<level>' or another player's profile key. {ok, why, game: sim()'s, pay, opp}. */
export function play(vs, s = mine()) {
  const gm = gamesToday(s), me = {name: teamName(s), sq: s.sq};
  let opp, kind, pay;
  if (vs.startsWith('cpu:')) {
    const lvl = vs.slice(4);
    if (gm.c[lvl]) return {ok: false, why: 'Already played today.'};
    opp = cpuTeam(lvl, gm.d); kind = 'c'; pay = opp.cpu;
  } else {
    if (gm.h[vs]) return {ok: false, why: 'You’ve played them today.'};
    const o = others().find(x => x.key === vs);
    if (!o) return {ok: false, why: 'That squad isn’t on the board.'};
    opp = {key: o.key, name: o.team, sq: o.state.sq, ovr: o.rating.ovr}; kind = 'h'; pay = H2H_PAY;
  }
  const g = sim(me, opp, `${gm.d}|${PROFILE}|${vs}|${JSON.stringify(s.sq)}`);
  const won = g.win === 'a', coins = won ? pay.win : pay.loss;
  const res = {u: g.a, o: g.b, w: won ? 1 : 0, at: Date.now(), n: opp.name};
  if (kind === 'c') gm.c[vs.slice(4)] = res; else gm.h[vs] = res;
  s.rec[won ? 'w' : 'l'] += 1;
  credit(s, coins);
  touch('game');
  return {ok: true, game: g, coins, opp, won};
}

// ---------------------------------------------------------------------------------------------------- other players
/** Your team's name: the one you gave it, else yours and Dynasty (Evan's Dynasty). */
export function teamName(s = mine(), who = null) {
  if (s && s.nm) return s.nm;
  const n = who ? who.name : data.me() ? data.name(data.me()) : (data.user() && (data.user().board || data.user().name)) || data.guest() || 'Your';
  return `${String(n).split(/\s+/)[0]}’s Dynasty`;
}
/** Everyone else's Dynasty this phone may see (the scoreboards' rule: everyone, from daily.LB.raw), the freshest copy
 *  of each: [{key, name, member, guest, team, state, rating, cards, cols}], the best squad first. */
export function others(docs = daily.LB.raw || [], {withMe = false} = {}) {
  const own = profileKey(), best = new Map();
  for (const p of docs) {
    const all = p && p[FIELD];
    if (!all || typeof all !== 'object') continue;
    for (const key of Object.keys(all)) {
      if (!key || (!withMe && key === own)) continue;
      const s = clean(all[key]), who = s && visitWho(key, p);
      if (who && (!best.has(key) || s.at > best.get(key).s.at)) best.set(key, {s, who});
    }
  }
  if (withMe && mayPlay() && MINE && own) best.set(own, {s: MINE, who: {name: data.me() ? data.name(data.me()) : data.guest() || 'You', member: data.me() || null}, me: true});
  const out = [];
  best.forEach(({s, who, me}, key) => {
    out.push({key, me: !!me || key === own, name: who.name, member: who.member || null, guest: !!who.guest, team: teamName(s, who), state: s,
      rating: squadRating(s.sq), cards: Object.keys(s.o).filter(id => card(id)).length, cols: Object.keys(s.cl).length, rec: s.rec, at: s.at});
  });
  return out.sort((a, b) => b.rating.ovr - a.rating.ovr || b.cards - a.cards || a.name.localeCompare(b.name));
}
