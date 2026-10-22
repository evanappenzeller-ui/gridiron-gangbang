// The Realm (the owner's ask, Oct 2026: a Clash of Clans of his own, in a medieval fantasy, the tab at the right; his
// alone: data.isOwner()). Your realm is a lot with your Keep at its heart. The daily games pay for it: every result
// you've posted to the board this season (and every one from here on) comes in as Gold and Grain, both, waiting in
// your coffers until the treasuries and granaries have room. Gold mines dig Gold and farms grow Grain while you're
// away. Your builder raises and upgrades one thing at a time (the owner, Oct 2026), on a clock. Grain trains an army at the barracks; the army raids the
// computer's realms for what they hold. The computer's realms raid you too (core/realm-battle.js defend), a few times
// a day, which is what your walls and towers are for.
//
// Where it lives: the owner's board doc (players/{uid}, daily.js) as fr1 (its name from when this was the Franchise;
// the football names of then are taken up as this realm's: clean()), so his realm is the same on every phone of his.
// No one else's realm exists or shows: it's his alone, and it raids only the computer's.
// Everything here is plain data and pure functions of it and the clock, except the sync at the bottom.
import * as daily from './daily.js';
import * as data from './data.js';

export const N = 44;               // the lot: N x N tiles (36 till Oct 2026: more room on the base, the owner's ask; clean())
const N_WAS = 36;                  // (a save from then, laid out on the smaller lot)
export const EDGE = 2;             // buildings keep this many tiles off the lot's sides
export const HOUR = 3600e3;
export const MAX_KEEP = 8;
export const RAID_S = 180;         // a raid's clock, seconds
export const CUR = ['gold', 'grain'];
export const CUR_NAME = {gold: 'Gold', grain: 'Grain'};
/** Whether this phone may have the Realm at all: the owner's alone. */
export const mayPlay = () => !!(data.isOwner && data.isOwner());

// ---------------------------------------------------------------------------------------------------- the buildings
// Per level (index level - 1): cost (to build it, then to reach each level), time (seconds: each level takes longer
// than the last, minutes at first, a day or two at the top; the owner, Oct 2026), hp, th (the Keep level it needs);
// and what it does: rate (an hour) and hold (hours of it) for mines and farms; cap for treasuries and granaries; store
// for the Keep; room (soldiers) for war camps; dps, range, every (seconds a shot), splash, min, air (can it hit a
// dragon) for defenses; the dragons it has room for (a level each) for the hatchery. pay: what it's paid for in.
// size: tiles square.
export const KINDS = {
  keep: {name: 'Keep', size: 4, pay: 'gold', role: 'hall',
    blurb: 'The heart of your realm. Its level decides how many of everything you can build and how far each can go.',
    cost: [0, 2500, 10000, 40000, 120000, 300000, 650000, 1200000],
    time: [0, 1800, 7200, 21600, 43200, 86400, 129600, 172800],
    hp: [1500, 1700, 2000, 2400, 2900, 3500, 4200, 5000],
    th: [1, 1, 2, 3, 4, 5, 6, 7],
    store: [2500, 5000, 10000, 20000, 40000, 80000, 120000, 160000]},
  mine: {name: 'Gold Mine', size: 3, pay: 'grain', role: 'make', makes: 'gold',
    blurb: 'Digs Gold while you’re away: it piles up until you collect it.',
    cost: [150, 300, 700, 1400, 3000, 6000, 12000, 24000, 45000, 80000, 140000, 220000],
    time: [10, 300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 64800, 86400, 129600],
    hp: [400, 440, 480, 520, 560, 600, 640, 680, 720, 780, 840, 900],
    th: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    rate: [20, 35, 50, 70, 90, 115, 140, 170, 200, 240, 280, 330], hold: 10},
  farm: {name: 'Farm', size: 3, pay: 'gold', role: 'make', makes: 'grain',
    blurb: 'Grows Grain while you’re away: it piles up until you collect it.',
    cost: [150, 300, 700, 1400, 3000, 6000, 12000, 24000, 45000, 80000, 140000, 220000],
    time: [10, 300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 64800, 86400, 129600],
    hp: [400, 440, 480, 520, 560, 600, 640, 680, 720, 780, 840, 900],
    th: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    rate: [20, 35, 50, 70, 90, 115, 140, 170, 200, 240, 280, 330], hold: 10},
  treasury: {name: 'Treasury', size: 3, pay: 'grain', role: 'store', holds: 'gold',
    blurb: 'Holds your Gold. More room means bigger upgrades, and more for raiders to take.',
    cost: [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 180000, 300000],
    time: [10, 600, 1800, 3600, 7200, 14400, 28800, 43200, 64800, 86400, 129600],
    hp: [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
    th: [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    cap: [3000, 7500, 15000, 30000, 50000, 80000, 120000, 170000, 240000, 330000, 450000]},
  granary: {name: 'Granary', size: 3, pay: 'gold', role: 'store', holds: 'grain',
    blurb: 'Holds your Grain. More room means bigger upgrades, and more for raiders to take.',
    cost: [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 180000, 300000],
    time: [10, 600, 1800, 3600, 7200, 14400, 28800, 43200, 64800, 86400, 129600],
    hp: [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
    th: [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    cap: [3000, 7500, 15000, 30000, 50000, 80000, 120000, 170000, 240000, 330000, 450000]},
  barracks: {name: 'Barracks', size: 4, pay: 'grain', role: 'train',
    blurb: 'Trains your army with Grain. Higher levels open new kinds of soldier; each barracks trains alongside the others.',
    cost: [200, 1000, 4000, 12000, 30000, 70000, 140000, 260000],
    time: [10, 900, 3600, 10800, 21600, 43200, 64800, 86400],
    hp: [250, 290, 330, 370, 420, 470, 520, 580],
    th: [1, 2, 3, 4, 5, 6, 7, 8]},
  camp: {name: 'War Camp', size: 4, pay: 'grain', role: 'camp',
    blurb: 'Where your army waits to march. Its room is how big an army you can take.',
    cost: [250, 2500, 10000, 40000, 100000, 200000],
    time: [10, 1800, 10800, 28800, 57600, 86400],
    hp: [250, 270, 290, 310, 330, 350],
    th: [1, 2, 3, 5, 6, 7],
    room: [20, 30, 35, 40, 45, 50]},
  hatchery: {name: 'Dragon Hatchery', size: 4, pay: 'grain', role: 'hatch',
    blurb: 'Where your dragons hatch and grow. You need one to train a dragon, and each level is room for one more.',
    cost: [20000, 40000, 70000, 110000, 160000, 220000, 300000, 400000, 520000, 660000],
    time: [3600, 10800, 21600, 32400, 43200, 64800, 86400, 108000, 129600, 172800],
    hp: [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700],
    th: [6, 6, 6, 7, 7, 7, 8, 8, 8, 8]},
  hut: {name: 'Builder’s Hut', size: 2, pay: 'gold', role: 'builder',
    blurb: 'Where your builder lives. He raises or upgrades one thing at a time, however many huts you have.',
    cost: [0], time: [10], hp: [250], th: [1]},
  cannon: {name: 'Cannon', size: 3, pay: 'gold', role: 'def', air: false,
    blurb: 'Its crew fires iron shot at one attacker at a time, hard and quick. Can’t hit a dragon.',
    cost: [250, 1000, 4000, 10000, 25000, 60000, 120000, 220000, 380000, 600000],
    time: [10, 600, 1800, 5400, 14400, 28800, 43200, 72000, 108000, 172800],
    hp: [420, 470, 520, 570, 620, 680, 750, 830, 920, 1020],
    th: [1, 1, 2, 3, 4, 5, 6, 7, 8, 8],
    dps: [11, 14, 18, 23, 29, 36, 45, 54, 63, 72], range: 8, every: .9},
  ballista: {name: 'Ballista', size: 3, pay: 'gold', role: 'def', air: true,
    blurb: 'Looses great bolts at one attacker at a time, on the ground or in the air.',
    cost: [250, 1000, 4000, 10000, 25000, 60000, 120000, 220000, 380000, 600000],
    time: [10, 600, 1800, 5400, 14400, 28800, 43200, 72000, 108000, 172800],
    hp: [420, 470, 520, 570, 620, 680, 750, 830, 920, 1020],
    th: [1, 1, 2, 3, 4, 5, 6, 7, 8, 8],
    dps: [9, 11, 15, 19, 25, 31, 40, 48, 56, 64], range: 9, every: .8},
  tower: {name: 'Archer Tower', size: 3, pay: 'gold', role: 'def', air: true,
    blurb: 'Reaches farther than anything and picks attackers off, dragons too.',
    cost: [1000, 2000, 5000, 15000, 35000, 70000, 140000, 250000, 400000, 600000],
    time: [15, 900, 3600, 7200, 18000, 32400, 50400, 72000, 108000, 172800],
    hp: [380, 420, 460, 500, 540, 580, 630, 690, 750, 810],
    th: [2, 2, 3, 4, 5, 5, 6, 7, 8, 8],
    dps: [11, 15, 19, 25, 30, 35, 42, 48, 56, 63], range: 10, every: 1},
  trebuchet: {name: 'Trebuchet', size: 3, pay: 'gold', role: 'def', air: false,
    blurb: 'Hurls boulders a long way into a crowd. Slow, and it can’t hit anyone right next to it, or in the air.',
    cost: [8000, 20000, 60000, 150000, 300000, 550000],
    time: [600, 7200, 21600, 43200, 86400, 129600],
    hp: [400, 450, 500, 550, 600, 650],
    th: [3, 4, 5, 6, 7, 8],
    dps: [4, 5, 6, 7, 9, 11], range: 11, min: 4, every: 5, splash: 1.5},
  cauldron: {name: 'Pitch Cauldron', size: 3, pay: 'gold', role: 'def', air: false,
    blurb: 'Pours burning pitch on everyone close by. Short reach, hits a crowd on the ground.',
    cost: [60000, 120000, 220000, 360000, 520000, 720000],
    time: [3600, 21600, 43200, 72000, 108000, 172800],
    hp: [620, 660, 700, 750, 800, 850],
    th: [4, 5, 6, 7, 8, 8],
    dps: [11, 13, 16, 20, 24, 32], range: 7, every: 1.3, splash: 1},
  wall: {name: 'Wall', size: 1, pay: 'gold', role: 'wall',
    blurb: 'Keeps attackers out until they break through: a palisade, then stone. Goes up at once; its upgrades take your builder a while.',
    cost: [50, 1000, 5000, 10000, 20000, 40000, 80000, 150000],
    time: [0, 60, 300, 900, 1800, 3600, 7200, 14400],
    hp: [300, 500, 700, 900, 1400, 2000, 2500, 3000],
    th: [2, 2, 3, 4, 5, 6, 7, 8]}
};
export const ORDER = ['keep', 'hut', 'mine', 'farm', 'treasury', 'granary', 'barracks', 'camp', 'hatchery', 'cannon', 'ballista', 'tower', 'trebuchet', 'cauldron', 'wall'];
// How many of each a Keep level allows (index Keep level - 1).
export const COUNT = {
  keep: [1, 1, 1, 1, 1, 1, 1, 1],
  hut: [2, 2, 3, 3, 4, 4, 5, 5],
  mine: [1, 2, 3, 4, 5, 6, 6, 6],
  farm: [1, 2, 3, 4, 5, 6, 6, 6],
  treasury: [1, 1, 2, 2, 2, 3, 4, 4],
  granary: [1, 1, 2, 2, 2, 3, 4, 4],
  barracks: [1, 2, 2, 3, 3, 3, 4, 4],
  camp: [1, 1, 2, 2, 3, 3, 4, 4],
  hatchery: [0, 0, 0, 0, 0, 1, 1, 1],
  cannon: [1, 1, 2, 2, 3, 3, 4, 4],
  ballista: [2, 2, 2, 3, 3, 4, 5, 5],
  tower: [0, 1, 1, 2, 3, 3, 4, 5],
  trebuchet: [0, 0, 1, 1, 1, 2, 3, 3],
  cauldron: [0, 0, 0, 1, 2, 2, 3, 3],
  wall: [0, 25, 50, 75, 100, 125, 175, 225]
};
// A builder's hut costs more the more you have (the first comes with the realm).
export const HUT_COST = [0, 1000, 10000, 50000, 150000];
export const maxLevel = k => KINDS[k].cost.length;
/** A kind's numbers at a level (1 up). */
export function stat(k, l) {
  const K = KINDS[k], i = Math.max(0, Math.min(K.cost.length, l) - 1), o = {hp: K.hp[i]};
  if (K.role === 'make') { o.rate = K.rate[i]; o.hold = K.rate[i] * K.hold; }
  if (K.role === 'store') o.cap = K.cap[i];
  if (K.role === 'hall') o.store = K.store[i];
  if (K.role === 'camp') o.room = K.room[i];
  if (K.role === 'hatch') o.dragons = i + 1;
  if (K.role === 'def') Object.assign(o, {dps: K.dps[i], range: K.range, every: K.every, splash: K.splash || 0, min: K.min || 0, air: !!K.air});
  return o;
}

// ---------------------------------------------------------------------------------------------------- the army
// hp, dps, speed (tiles a second), range (tiles), room (war camp space), cost (Grain), time (seconds to train), at (the
// barracks level that opens it), aim (what it goes for first: any building, defenses, walls, or where the gold and
// grain are). A thief does double to money buildings; an
// archer's arrows and a dragon's fire go over walls; a dragon flies (fly: no wall or building stops it; only
// ballistas and archer towers can reach it) and burns everything round where its fire lands (splash).
export const TROOPS = {
  footman: {name: 'Footman', hp: 50, dps: 9, speed: 2, range: .6, room: 1, cost: 25, time: 5, at: 1, aim: 'any',
    blurb: 'Sword and shield, quick and cheap. Goes for whatever’s closest.'},
  archer: {name: 'Archer', hp: 22, dps: 8, speed: 2.2, range: 3.5, room: 1, cost: 50, time: 6, at: 2, aim: 'any',
    blurb: 'Shoots from range, over walls. Can’t take a hit.'},
  knight: {name: 'Knight', hp: 320, dps: 12, speed: 1.2, range: .8, room: 5, cost: 250, time: 30, at: 3, aim: 'def',
    blurb: 'Heavy plate. Goes only for the defenses and takes their fire.'},
  thief: {name: 'Thief', hp: 30, dps: 11, speed: 3, range: .5, room: 1, cost: 40, time: 7, at: 5, aim: 'loot',
    blurb: 'Goes for the gold and grain: mines, farms, treasuries and granaries, double damage on them.'},
  dragon: {name: 'Dragon', hp: 900, dps: 60, speed: 1.4, range: 2.5, room: 10, cost: 3000, time: 120, at: 6, aim: 'any', splash: .9, fly: true,
    blurb: 'Flies over walls and burns everything where its fire lands. Only ballistas and archer towers can reach it. Needs a hatchery.'}
};
export const TROOP_ORDER = ['footman', 'archer', 'knight', 'thief', 'dragon'];

// ---------------------------------------------------------------------------------------------------- what the games pay
// Each day's result, in Gold and in Grain alike (a strong day across the five games is about 12,000 of each).
export const PAY = {
  puzzles: e => 400 + 5 * Math.max(0, Math.min(600, Number(e.p) || 0)),
  '17-0': e => 400 + 150 * e.w + (e.w === 17 ? 500 : 0),
  drill: e => (e.r === 'W' ? 3000 : e.r === 'T' ? 2000 : 1000),
  kick: e => 400 + 200 * Math.min(15, e.m),
  return: e => 400 + Math.min(3000, 3 * e.y)
};
export const GAME_NAME = {puzzles: 'Daily Puzzles', '17-0': '17–0', drill: 'Two-Minute Drill', kick: 'Kick It', return: 'Return Man'};
const STARTER = 1500; // (of each, for a new realm, on top of what its games have paid)

/**
 * What a person's games have paid, from their board docs (all of them one person's): {total, by: {game: amount},
 * today: {game: amount}, days: count}. mods: the loaded game cores {sv, dr, kk, rm} (their entryOf, todayNumber); a
 * missing one pays nothing yet. Per game and day the entry that counts is the boards' own (the first finished across
 * their phones, Return Man's best run).
 */
export function incomeOf(docs, mods = {}) {
  const by = {}, today = {};
  let total = 0, days = 0;
  const add = (g, v, isToday) => { by[g] = (by[g] || 0) + v; total += v; days++; if (isToday) today[g] = (today[g] || 0) + v; };
  const pz = new Map();
  docs.forEach(p => Object.keys((p && p.days) || {}).forEach(k => {
    const e = p.days[k], t = Number(e && e.t) || 0, was = pz.get(k);
    if (e && (!was || t < was.t)) pz.set(k, {e, t});
  }));
  const pnum = daily.PNUM;
  pz.forEach(({e}, k) => add('puzzles', PAY.puzzles(e), Number(k) === pnum));
  const games = [['17-0', mods.sv, 's17', false], ['drill', mods.dr, 'dr5', false], ['kick', mods.kk, 'kk1', false], ['return', mods.rm, 'rm2', true]];
  games.forEach(([g, M, F, best]) => {
    if (!M || !M.entryOf) return;
    const keys = new Set();
    docs.forEach(p => Object.keys((p && p[F]) || {}).forEach(k => keys.add(k)));
    let now = 0;
    try { now = M.todayNumber(); } catch (_) {}
    keys.forEach(k => {
      const n = Number(k);
      let pick = null;
      docs.forEach(p => {
        let e = null;
        try { e = M.entryOf(p, n); } catch (_) { e = null; }
        if (!e) return;
        if (!pick) { pick = e; return; }
        if (best ? (e.y > pick.y || (e.y === pick.y && (e.t || 0) < (pick.t || 0))) : (e.t || 0) < (pick.t || 0)) pick = e;
      });
      if (pick) add(g, PAY[g](pick), n === now);
    });
  });
  return {total, by, today, days};
}

// ---------------------------------------------------------------------------------------------------- the scenery
// Where your realm lies (views/realm-3d.js draws it, img/realm/scenery/): the coast from the start; the rest unlocked by
// raising the Keep (the owner's ask, Oct 2026), each yours to pick (the house card) once it is.
export const SCENERIES = [
  {k: 'coast', name: 'The Coast', at: 1, blurb: 'A meadow by the sea, pines along the shore, mountains and lakes beyond', ownerName: 'Twilight Highlands', ownerBlurb: 'Rolling hills and torchlit gates beneath the last light of sunset'},
  {k: 'christmas', name: 'Christmas Kingdom', at: 1, ownerOnly: true, blurb: 'A snowy kingdom of festive castles, glowing village streets, decorated firs and wandering reindeer'},
  {k: 'forest', name: 'Enchanted Forest', at: 2, blurb: 'A glade in a moonlit wood, glowing streams and blooms all round'},
  {k: 'tundra', name: 'Frozen Tundra', at: 3, blurb: 'A snowfield by an icy sea, pines and mountains all round'},
  {k: 'ocean', name: 'Ocean Sanctuary', at: 5, blurb: 'An island of grass and palms in a turquoise sea'},
  {k: 'desert', name: 'Amber Desert', at: 6, blurb: 'Sand under a setting sun, red rock and an oasis beyond'},
  {k: 'infernal', name: 'Infernal Wastes', at: 7, blurb: 'Scorched ground ringed by rivers of lava, a volcano beyond'}
];
/** Whether scenery k is open to this realm (its Keep high enough and profile eligible). */
export const sceneryOpen = (s, k) => { const x = SCENERIES.find(q => q.k === k); return !!x && (!x.ownerOnly || data.isOwner()) && keepOf(s) >= x.at; };
/** The scenery this realm lies in: the one picked, while it's open to it; else the coast. */
export const sceneryOf = s => (s && s.sc && sceneryOpen(s, s.sc) ? s.sc : 'coast');
/** Picks scenery k (true), if it's open. */
export function pickScenery(s, k) {
  if (!sceneryOpen(s, k)) return false;
  s.sc = k === 'coast' ? '' : k;
  return true;
}

// ---------------------------------------------------------------------------------------------------- a realm
// State: {v, at (saved, ms), nm (the house's name, or none: "House <last name>"), b: [{i, t (kind), l (level; 0
// while first going up), x, y (its top-left tile), u (when the job on it is done, ms; 0: none), c (mines and farms:
// when what's in it started piling up, ms)}], r: {gold, grain} (stored), cl: {gold, grain} (taken from the coffers so
// far), xo: {gold, grain} (into the coffers besides the games: the starter, raids' overflow), ar: {troop: n} (the army
// in the war camps), q: [[troop, n]] (training), qs (when the first in line started, ms), tp (glory), rd: [raids
// made], df: [raids on you], lr (when the computer last raided you: core/realm-battle.js defend), sh (a truce until,
// ms), bt: {realm: day raided}, nb (the next building id), born (ms), sc (the scenery picked: SCENERIES; none: the coast),
// n (the lot it's laid out on, N; none: N_WAS)}.
export function fresh(now = Date.now()) {
  const M = N / 2;
  const b = [
    {i: 1, t: 'keep', l: 1, x: M - 2, y: M - 2, u: 0},
    {i: 2, t: 'hut', l: 1, x: M - 1, y: M - 6, u: 0},
    {i: 3, t: 'mine', l: 1, x: M - 7, y: M - 2, u: 0, c: now},
    {i: 4, t: 'farm', l: 1, x: M + 4, y: M - 2, u: 0, c: now},
    {i: 5, t: 'ballista', l: 1, x: M - 1, y: M + 3, u: 0}
  ];
  return {v: 2, n: N, at: now, born: now, nm: '', b, r: {gold: 0, grain: 0}, cl: {gold: 0, grain: 0}, xo: {gold: STARTER, grain: STARTER},
    ar: {}, q: [], qs: 0, tp: 0, rd: [], df: [], lr: now, sh: 0, bt: {}, nb: 6};
}
// The Franchise's names (v1, Oct 2026), taken up as the Realm's.
const OLD_KIND = {stadium: 'keep', office: 'hut', booth: 'mine', cooler: 'farm', vault: 'treasury', tank: 'granary', practice: 'barracks',
  locker: 'camp', cannon: 'ballista', pressbox: 'tower', jugs: 'trebuchet', shower: 'cauldron', fence: 'wall'};
const OLD_TROOP = {receiver: 'footman', qb: 'archer', lineman: 'knight', fullback: 'sapper', mascot: 'thief', kicker: 'dragon'};
const OLD_CUR = {gold: 'cash', grain: 'juice'};
const copy = s => JSON.parse(JSON.stringify(s));
/** A realm from storage, made whole (the Franchise's names taken up, missing fields, bad numbers), or null when it
 *  isn't one. */
export function clean(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.b)) return null;
  const o = copy(s);
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const old = !(Number(o.v) >= 2);
  o.v = 2; o.at = num(o.at); o.born = num(o.born) || o.at;
  o.nm = typeof o.nm === 'string' ? o.nm.slice(0, 28) : '';
  o.sc = SCENERIES.some(x => x.k === o.sc) ? o.sc : '';
  // (laid out on a smaller lot: everything moved over together, so it's in the middle of this one as it was in that)
  const was = Number.isInteger(o.n) && o.n > 0 ? o.n : N_WAS, by = Math.floor((N - was) / 2);
  o.n = N;
  o.b = o.b.map(b => (b && by && Number.isInteger(b.x) && Number.isInteger(b.y) ? Object.assign({}, b, {x: b.x + by, y: b.y + by}) : b));
  o.b = o.b.map(b => (b && old && OLD_KIND[b.t] ? Object.assign({}, b, {t: OLD_KIND[b.t]}) : b))
    .filter(b => b && KINDS[b.t] && Number.isInteger(b.x) && Number.isInteger(b.y))
    .map(b => ({i: num(b.i), t: b.t, l: Math.max(0, Math.min(maxLevel(b.t), num(b.l) | 0)), x: b.x, y: b.y, u: num(b.u), ...(KINDS[b.t].role === 'make' ? {c: num(b.c)} : {})}));
  if (!o.b.some(b => b.t === 'keep')) return null;
  // nothing on the same ground as anything else, nothing off the base (an old save, or one from before a rule): one
  // that doesn't fit where it is goes to the nearest spot it does (the Keep first, then the rest in order), or, with
  // nowhere left, off the lot
  const laid = {b: []};
  [...o.b].sort((a, b) => (b.t === 'keep') - (a.t === 'keep')).forEach(b => {
    if (!fits(laid, KINDS[b.t].size, b.x, b.y)) { const p = spotFor(laid, b.t, {x: b.x, y: b.y}); if (!p) return; b.x = p.x; b.y = p.y; }
    laid.b.push(b);
  });
  o.b = o.b.filter(b => laid.b.includes(b));
  ['r', 'cl', 'xo'].forEach(f => {
    const v = o[f] || {};
    o[f] = Object.fromEntries(CUR.map(c => [c, Math.max(0, num(v[c] != null ? v[c] : (old ? v[OLD_CUR[c]] : 0)))]));
  });
  // Retire sappers (including their old fullback name), returning their Grain to the coffers.
  // Credit before alias normalization so mixed old/new names cannot lose a refund.
  const retired = t => t === 'sapper' || t === 'fullback';
  const count = n => Math.max(0, Math.floor(num(n)));
  const training = Array.isArray(o.q) ? o.q : [];
  const removed = Object.entries(o.ar || {}).reduce((n, [t, v]) => n + (retired(t) ? count(v) : 0), 0)
    + training.reduce((n, x) => n + (Array.isArray(x) && retired(x[0]) ? count(x[1]) : 0), 0);
  o.xo.grain += removed * 600;
  if (Array.isArray(training[0]) && retired(training[0][0])) o.qs = 0;
  const troops = (m) => Object.fromEntries(Object.entries(m || {}).map(([t, n]) => [OLD_TROOP[t] || t, n]));
  o.ar = Object.fromEntries(Object.entries(troops(o.ar)).filter(([t, n]) => TROOPS[t] && num(n) > 0).map(([t, n]) => [t, num(n) | 0]));
  o.q = (Array.isArray(o.q) ? o.q : []).map(x => (Array.isArray(x) ? [OLD_TROOP[x[0]] || x[0], x[1]] : x))
    .filter(x => Array.isArray(x) && TROOPS[x[0]] && num(x[1]) > 0).map(([t, n]) => [t, num(n) | 0]);
  o.qs = o.q.length ? num(o.qs) : 0; o.tp = Math.max(0, num(o.tp)); o.lr = num(o.lr) || o.at; o.sh = num(o.sh);
  o.rd = Array.isArray(o.rd) ? o.rd.filter(r => r && typeof r.id === 'string' && String(r.vs).startsWith('bot:')).slice(-40) : [];
  o.df = Array.isArray(o.df) ? o.df.filter(r => r && Number(r.at)).slice(-20) : [];
  o.bt = o.bt && typeof o.bt === 'object' ? o.bt : {};
  delete o.ap;
  o.nb = Math.max(num(o.nb), ...o.b.map(b => b.i + 1), 1);
  return o;
}
export const keepOf = s => { const h = s.b.find(b => b.t === 'keep'); return h ? Math.max(1, h.l) : 1; };
/** The highest level kind k can go to at this Keep level. */
export function topLevel(k, th) {
  const K = KINDS[k];
  if (k === 'keep') return MAX_KEEP;
  let top = 0;
  K.th.forEach((need, i) => { if (need <= th) top = i + 1; });
  return k === 'hut' ? 1 : top;
}
export const countOf = (s, k) => s.b.filter(b => b.t === k).length;
export const allowed = (s, k) => COUNT[k][keepOf(s) - 1] || 0;
const busy = (b, now) => b.u > now;
/** Mines and farms: what's piled up in one now (nothing while it's going up or being upgraded). */
export function made(b, now = Date.now()) {
  const K = KINDS[b.t];
  if (K.role !== 'make' || b.l < 1 || busy(b, now)) return 0;
  const st = stat(b.t, b.l);
  return Math.max(0, Math.min(st.hold, Math.floor(st.rate * (now - (b.c || now)) / HOUR)));
}
/** Room for each: the Keep's store and the treasuries' or granaries' caps (one being upgraded holds its level's). */
export function capOf(s) {
  const o = {gold: 0, grain: 0};
  s.b.forEach(b => {
    if (b.l < 1) return;
    const K = KINDS[b.t], st = stat(b.t, b.l);
    if (K.role === 'hall') { o.gold += st.store; o.grain += st.store; }
    if (K.role === 'store') o[K.holds] += st.cap;
  });
  return o;
}
/** Builders: how many there are (huts up) and how many are on a job now. */
export function builders(s, now = Date.now()) {
  const working = s.b.filter(b => busy(b, now)).length;
  return {total: 1, busy: working, free: Math.max(0, 1 - working)};
}
/** Dragons the hatcheries have room for (a level each). */
export const hatchRoom = s => s.b.filter(b => b.t === 'hatchery' && b.l >= 1).reduce((a, b) => a + stat('hatchery', b.l).dragons, 0);
export const armyRoom = s => s.b.filter(b => b.t === 'camp' && b.l >= 1).reduce((a, b) => a + stat('camp', b.l).room, 0);
export const roomOf = list => Object.entries(list || {}).reduce((a, [t, n]) => a + (TROOPS[t] ? TROOPS[t].room * n : 0), 0);
export const queued = s => s.q.reduce((a, [t, n]) => a + TROOPS[t].room * n, 0);
/** Soldiers the barracks have opened (the best one's level). */
export const barracksLevel = s => Math.max(0, ...s.b.filter(b => b.t === 'barracks').map(b => b.l));
const trainers = s => s.b.filter(b => b.t === 'barracks' && b.l >= 1 && b.u === 0).length;
/** Seconds one of troop t takes to train now (the barracks share the work), Infinity with none. */
export const trainTime = (s, t) => (trainers(s) ? TROOPS[t].time / trainers(s) : Infinity);

/** Brings a realm up to now: jobs done (a mine or farm starts piling up again when its upgrade's done), the army
 *  trained. Mutates s; true if anything changed. */
export function tick(s, now = Date.now()) {
  let changed = false;
  s.b.filter(b => b.u && b.u <= now).sort((a, b) => a.u - b.u).forEach(b => {
    b.l = Math.min(maxLevel(b.t), b.l + 1);
    if (KINDS[b.t].role === 'make') b.c = b.u;
    b.u = 0;
    changed = true;
  });
  while (s.q.length) {
    const [t] = s.q[0], each = trainTime(s, t) * 1000;
    if (!Number.isFinite(each)) break;
    if (!s.qs) { s.qs = now; changed = true; break; }
    if (now < s.qs + each) break;
    s.qs += each;
    s.ar[t] = (s.ar[t] || 0) + 1;
    s.q[0][1]--;
    if (s.q[0][1] <= 0) s.q.shift();
    changed = true;
  }
  if (!s.q.length && s.qs) { s.qs = 0; changed = true; }
  return changed;
}
/** The coffers: what's waiting there (the games' pay and the rest, less what's been taken into storage). */
export function pending(s, earned) {
  return {gold: Math.max(0, earned + s.xo.gold - s.cl.gold), grain: Math.max(0, earned + s.xo.grain - s.cl.grain)};
}
/** Moves what's waiting in the coffers into storage, as far as there's room. Mutates s; returns what moved. */
export function claim(s, earned) {
  const p = pending(s, earned), cap = capOf(s), moved = {gold: 0, grain: 0};
  CUR.forEach(c => {
    const m = Math.max(0, Math.min(p[c], cap[c] - s.r[c]));
    if (m > 0) { s.r[c] += m; s.cl[c] += m; moved[c] = m; }
  });
  return moved;
}
/** Collects a mine or farm into storage, as far as there's room (the rest stays in it). Returns what came in. */
export function collect(s, id, now = Date.now()) {
  const b = s.b.find(x => x.i === id);
  if (!b || KINDS[b.t].role !== 'make') return 0;
  const c = KINDS[b.t].makes, have = made(b, now), room = Math.max(0, capOf(s)[c] - s.r[c]), take = Math.min(have, room);
  if (take <= 0) return 0;
  s.r[c] += take;
  const rate = stat(b.t, b.l).rate;
  b.c = take >= have ? now : (b.c || now) + take / rate * HOUR;
  return take;
}

// ---- placing, building, upgrading
/** Whether a size x size footprint fits at (x, y): on the lot, clear of everything else (but id). */
export function fits(s, size, x, y, id = null) {
  if (x < EDGE || y < EDGE || x + size > N - EDGE || y + size > N - EDGE) return false;
  return !s.b.some(b => b.i !== id && x < b.x + KINDS[b.t].size && b.x < x + size && y < b.y + KINDS[b.t].size && b.y < y + size);
}
/** Somewhere k fits, nearest the middle of the lot (or near), or null. */
export function spotFor(s, k, near = null) {
  const sz = KINDS[k].size, c = near || {x: N / 2 - sz / 2, y: N / 2 - sz / 2};
  let best = null, bd = Infinity;
  for (let y = EDGE; y + sz <= N - EDGE; y++) for (let x = EDGE; x + sz <= N - EDGE; x++) {
    const d = (x - c.x) ** 2 + (y - c.y) ** 2;
    if (d < bd && fits(s, sz, x, y)) { bd = d; best = {x, y}; }
  }
  return best;
}
/** The box the buildings stand in (tiles), for framing the lot. */
export function boxOf(s) {
  if (!s.b.length) return {x0: N / 2 - 4, y0: N / 2 - 4, x1: N / 2 + 4, y1: N / 2 + 4};
  const x0 = Math.min(...s.b.map(b => b.x)), y0 = Math.min(...s.b.map(b => b.y));
  const x1 = Math.max(...s.b.map(b => b.x + KINDS[b.t].size)), y1 = Math.max(...s.b.map(b => b.y + KINDS[b.t].size));
  return {x0, y0, x1, y1};
}
const costOf = (s, k, toLevel) => (k === 'hut' ? HUT_COST[Math.min(HUT_COST.length - 1, countOf(s, 'hut'))] : KINDS[k].cost[toLevel - 1]);
/** Whether kind k can be built now: {ok, why, cost, pay, time}. */
export function canBuild(s, k, now = Date.now()) {
  const K = KINDS[k], n = countOf(s, k), cap = allowed(s, k);
  const cost = costOf(s, k, 1), o = {ok: false, why: '', cost, pay: K.pay, time: K.time[0]};
  if (k === 'keep') return Object.assign(o, {why: 'You have one'});
  if (k === 'hut') return Object.assign(o, {why: 'One builder does it all'});
  if (n >= cap) {
    const next = COUNT[k].findIndex(c => c > n);
    return Object.assign(o, {why: next < 0 ? `All ${cap} built` : `Keep level ${next + 1} for another`});
  }
  if (cost > s.r[K.pay]) return Object.assign(o, {why: `Not enough ${CUR_NAME[K.pay]}`});
  if (K.time[0] > 0 && builders(s, now).free < 1) return Object.assign(o, {why: 'Your builder is busy'});
  if (!spotFor(s, k)) return Object.assign(o, {why: 'No room on the lot'});
  return Object.assign(o, {ok: true});
}
/** Builds kind k at (x, y): paid now, up when its time's done (at once for walls and huts). The new building, or null
 *  if it can't. */
export function build(s, k, x, y, now = Date.now()) {
  const K = KINDS[k], chk = canBuild(s, k, now);
  if (!chk.ok || !fits(s, K.size, x, y)) return null;
  s.r[K.pay] -= chk.cost;
  const b = {i: s.nb++, t: k, l: 0, x, y, u: now + K.time[0] * 1000};
  if (!K.time[0] || k === 'hut') { b.l = 1; b.u = 0; }
  if (K.role === 'make') b.c = b.u || now;
  s.b.push(b);
  return b;
}
/** Whether building id can go up a level now: {ok, why, cost, pay, time, to}. */
export function canUpgrade(s, id, now = Date.now()) {
  const b = s.b.find(x => x.i === id);
  if (!b) return {ok: false, why: 'Gone'};
  const K = KINDS[b.t], to = b.l + 1, o = {ok: false, why: '', to, pay: K.pay, cost: K.cost[to - 1], time: K.time[to - 1]};
  if (b.u > now) return Object.assign(o, {why: b.l ? 'Being upgraded' : 'Going up'});
  if (to > maxLevel(b.t) || b.t === 'hut') return Object.assign(o, {why: 'At its top level'});
  if (to > topLevel(b.t, keepOf(s))) return Object.assign(o, {why: `Needs Keep level ${K.th[to - 1]}`});
  if (o.cost > s.r[K.pay]) return Object.assign(o, {why: `Not enough ${CUR_NAME[K.pay]}`});
  if (o.time > 0 && builders(s, now).free < 1) return Object.assign(o, {why: 'Your builder is busy'});
  if (b.t === 'barracks' && s.q.length) return Object.assign(o, {why: 'Training’s under way there'});
  return Object.assign(o, {ok: true});
}
/** Starts building id's upgrade (paid now; mines and farms are collected first and stop while it's under way). */
export function upgrade(s, id, now = Date.now()) {
  const chk = canUpgrade(s, id, now);
  if (!chk.ok) return false;
  const b = s.b.find(x => x.i === id);
  if (KINDS[b.t].role === 'make') collect(s, id, now);
  s.r[chk.pay] -= chk.cost;
  if (chk.time > 0) b.u = now + chk.time * 1000;
  else b.l = chk.to;
  return true;
}
export function move(s, id, x, y) {
  const b = s.b.find(q => q.i === id);
  if (!b || !fits(s, KINDS[b.t].size, x, y, id)) return false;
  b.x = x; b.y = y;
  return true;
}
// ---- the army
/** Whether n of troop t can go into training now: {ok, why}. */
export function canTrain(s, t, n = 1) {
  const T = TROOPS[t];
  if (!TROOP_ORDER.includes(t)) return {ok: false, why: 'Unknown troop'};
  if (!trainers(s)) return {ok: false, why: 'Build barracks first'};
  if (barracksLevel(s) < T.at) return {ok: false, why: `Barracks level ${T.at}`};
  if (t === 'dragon') {
    const room = hatchRoom(s), have = (s.ar.dragon || 0) + s.q.reduce((a, [k, m]) => a + (k === 'dragon' ? m : 0), 0);
    if (have + n > room) return {ok: false, why: room ? 'The hatchery is full: upgrade it' : 'Build a dragon hatchery first'};
  }
  if (roomOf(s.ar) + queued(s) + T.room * n > armyRoom(s)) return {ok: false, why: armyRoom(s) ? 'The war camps are full' : 'Build a war camp first'};
  if (T.cost * n > s.r.grain) return {ok: false, why: 'Not enough Grain'};
  return {ok: true};
}
export function train(s, t, n = 1, now = Date.now()) {
  if (!canTrain(s, t, n).ok) return false;
  s.r.grain -= TROOPS[t].cost * n;
  const last = s.q[s.q.length - 1];
  if (last && last[0] === t) last[1] += n; else s.q.push([t, n]);
  if (!s.qs) s.qs = now;
  return true;
}
/** Takes one of troop t out of training (the last in line), its Grain back. */
export function untrain(s, t, now = Date.now()) {
  if (!TROOP_ORDER.includes(t)) return false;
  for (let i = s.q.length - 1; i >= 0; i--) {
    if (s.q[i][0] !== t) continue;
    s.q[i][1]--;
    s.r.grain += TROOPS[t].cost;
    if (s.q[i][1] <= 0) { s.q.splice(i, 1); if (i === 0) s.qs = s.q.length ? now : 0; }
    return true;
  }
  return false;
}
/** When the line will be done (ms), or 0. */
export function trainedBy(s, now = Date.now()) {
  if (!s.q.length) return 0;
  let t = s.qs || now;
  s.q.forEach(([k, n]) => { t += trainTime(s, k) * 1000 * n; });
  return t;
}

// ---------------------------------------------------------------------------------------------------- raids
// What a raid can take: from storage, a share of what's stored (up to a cap for the Keep's level), spread over the
// Keep, treasuries and granaries by how much each holds; from mines and farms, half of what's piled up in each.
export const STORE_SHARE = .15, MADE_SHARE = .5;
export const LOOT_CAP = [5000, 10000, 20000, 40000, 70000, 100000, 140000, 180000];
/** Each building's take in a raid on s: {by: {bid: {gold, grain}}, total}. */
export function lootOf(s, now = Date.now()) {
  const th = keepOf(s), by = {}, total = {gold: 0, grain: 0};
  CUR.forEach(c => {
    const stored = Math.min(s.r[c] * STORE_SHARE, LOOT_CAP[th - 1]);
    const holders = s.b.filter(b => b.l >= 1 && (KINDS[b.t].role === 'hall' || (KINDS[b.t].role === 'store' && KINDS[b.t].holds === c)));
    const size = b => (KINDS[b.t].role === 'hall' ? stat(b.t, b.l).store : stat(b.t, b.l).cap);
    const room = holders.reduce((a, b) => a + size(b), 0) || 1;
    holders.forEach(b => {
      const v = Math.floor(stored * size(b) / room);
      if (v <= 0) return;
      (by[b.i] = by[b.i] || {gold: 0, grain: 0})[c] += v;
      total[c] += v;
    });
  });
  s.b.forEach(b => {
    if (KINDS[b.t].role !== 'make') return;
    const v = Math.floor(made(b, now) * MADE_SHARE);
    if (v <= 0) return;
    (by[b.i] = by[b.i] || {gold: 0, grain: 0})[KINDS[b.t].makes] += v;
    total[KINDS[b.t].makes] += v;
  });
  return {by, total};
}
/** Glory a raid on a computer realm of level th brings (by stars). */
export const gloryFor = (stars, th) => stars * th * 4;
/** A raid's end, on your realm: the take into storage (what won't fit, to your coffers), the army that marched used
 *  up, the glory, the raid on the record (rd, the last 40), the realm raided for today. Returns the record. */
export function finishRaid(s, rec, used, now = Date.now()) {
  const cap = capOf(s);
  CUR.forEach((c, i) => {
    const got = rec.lt[i] || 0, fit = Math.max(0, Math.min(got, cap[c] - s.r[c]));
    s.r[c] += fit;
    s.xo[c] += got - fit;
  });
  Object.entries(used || {}).forEach(([t, n]) => { s.ar[t] = Math.max(0, (s.ar[t] || 0) - n); if (!s.ar[t]) delete s.ar[t]; });
  s.tp = Math.max(0, s.tp + (rec.ta || 0));
  s.bt[rec.vs] = dayKey(now);
  s.rd.push(rec);
  s.rd = s.rd.slice(-40);
  return rec;
}
/** A raid on your realm, taken off it: what it took from storage and the mines' and farms' piles, the glory. */
export function takeRaid(s, rec) {
  const ls = rec.ls || [0, 0];
  s.r.gold = Math.max(0, s.r.gold - (ls[0] || 0));
  s.r.grain = Math.max(0, s.r.grain - (ls[1] || 0));
  Object.entries(rec.lb || {}).forEach(([id, v]) => {
    const b = s.b.find(x => x.i === Number(id));
    if (!b || KINDS[b.t].role !== 'make' || !b.c) return;
    const took = (v && (v[0] || v[1])) || 0, rate = stat(b.t, b.l).rate;
    if (took > 0 && rate > 0) b.c += took / rate * HOUR;
  });
  s.tp = Math.max(0, s.tp + (Number(rec.td) || 0));
  s.df.push(rec);
  s.df = s.df.slice(-20);
}
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ---- the computer's realms: one at each Keep level, the same lot every day, full again every morning
export const BOTS = [
  {k: 'bot:1', name: 'Thornfield Hamlet', th: 1}, {k: 'bot:2', name: 'Briarwatch', th: 2}, {k: 'bot:3', name: 'Mossgate', th: 3},
  {k: 'bot:4', name: 'Cinderholt', th: 4}, {k: 'bot:5', name: 'Stonebrook Hold', th: 5}, {k: 'bot:6', name: 'Duskmere Castle', th: 6},
  {k: 'bot:7', name: 'Ironvale Citadel', th: 7}, {k: 'bot:8', name: 'The Obsidian Spire', th: 8}
];
export const BOT_LOOT = [2500, 6000, 12000, 22000, 40000, 65000, 100000, 150000];
export function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
/** A computer realm's lot (a realm state, nothing stored: its take is BOT_LOOT, spread like a raid's). */
export function botBase(th) {
  const R = rng(9000 + th * 77), s = {b: [], r: {gold: 0, grain: 0}};
  let i = 1;
  const put = (t, l, x, y) => { if (fits(s, KINDS[t].size, x, y)) { s.b.push({i: i++, t, l, x, y, u: 0, c: 0}); return true; } return false; };
  put('keep', th, N / 2 - 2, N / 2 - 2);
  const ring = (t, n, r0, r1) => {
    for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
      const a = R() * Math.PI * 2, r = r0 + R() * (r1 - r0), sz = KINDS[t].size;
      const x = Math.round(N / 2 + Math.cos(a) * r - sz / 2), y = Math.round(N / 2 + Math.sin(a) * r - sz / 2);
      if (put(t, Math.max(1, topLevel(t, th) - (R() < .5 ? 1 : 0)), x, y)) k++;
    }
  };
  ['cannon', 'ballista', 'tower', 'trebuchet', 'cauldron'].forEach(t => ring(t, COUNT[t][th - 1], 4, 7.5));
  ['treasury', 'granary'].forEach(t => ring(t, COUNT[t][th - 1], 5, 9));
  if (th >= 2) {
    const lo = N / 2 - 9, hi = N / 2 + 8, top = topLevel('wall', th);
    let n = COUNT.wall[th - 1];
    for (let d = lo; d <= hi && n > 0; d++) [[d, lo], [d, hi], [lo, d], [hi, d]].forEach(([x, y]) => { if (n > 0 && put('wall', Math.max(1, top - 1), x, y)) n--; });
  }
  ['mine', 'farm'].forEach(t => ring(t, COUNT[t][th - 1], 10, 14));
  ['barracks', 'camp', 'hatchery', 'hut'].forEach(t => ring(t, Math.min(2, COUNT[t][th - 1]), 11, 15));
  return s;
}
/** A computer realm's take today: BOT_LOOT across its money buildings, or nothing once raided today. */
export function botLoot(bot, base, mine, now = Date.now()) {
  const full = (mine && mine.bt && mine.bt[bot.k] === dayKey(now)) ? 0 : BOT_LOOT[bot.th - 1];
  const holders = base.b.filter(b => ['hall', 'store', 'make'].includes(KINDS[b.t].role));
  const by = {}, total = {gold: 0, grain: 0};
  CUR.forEach(c => {
    const hs = holders.filter(b => KINDS[b.t].role === 'hall' || KINDS[b.t].holds === c || KINDS[b.t].makes === c);
    hs.forEach((b, j) => { const v = Math.floor(full / hs.length) + (j === 0 ? full % hs.length : 0); (by[b.i] = by[b.i] || {gold: 0, grain: 0})[c] += v; total[c] += v; });
  });
  return {by, total};
}

/** A realm you can scout or attack, by its key: {key, name, th, base, loot} or {why}. The computer's, for now (the
 *  Realm is the owner's alone: no one else's realm is anywhere in it). */
export function realmOf(key, mine, now = Date.now()) {
  const bot = BOTS.find(b => b.k === key);
  if (!bot) return {why: 'That realm isn’t there.'};
  const base = botBase(bot.th);
  return {key, name: bot.name, th: bot.th, base, loot: botLoot(bot, base, mine, now)};
}

// ---------------------------------------------------------------------------------------------------- the owner's
const LS = 'gg-fr1';
// PROVISIONAL: this phone started a new realm before the board said whether the owner has one (a new phone, a cleared
// browser): it gives way to his as soon as the board shows it, and isn't put on the board before then.
let MINE = null, saveT = 0, dirty = false, PROVISIONAL = false;
const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
const emit = why => subs.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } });
function readLocal() { try { return clean(JSON.parse(localStorage.getItem(LS) || 'null')); } catch (_) { return null; } }
function writeLocal(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (_) {} }
const boardKnown = () => !!(daily.LB.ready && !daily.LB.off && daily.LB.uid);
export const myKey = () => (daily.LB.uid ? daily.boardKey({id: daily.LB.uid, nick: daily.LB.nick}) : null);
/** The owner's docs on the board (all his phones'). */
export function myDocs(list = daily.LB.raw || []) {
  const k = myKey();
  return k ? list.filter(p => daily.boardKey(p) === k || p.id === daily.LB.uid) : [];
}
/** The freshest realm among a person's docs (raw fr1), or null. */
export function freshest(docs) {
  let best = null;
  docs.forEach(p => { const f = p && p.fr1; if (f && Array.isArray(f.b) && (!best || (Number(f.at) || 0) > (Number(best.at) || 0))) best = f; });
  return best;
}
/** This phone's realm (loaded once: the freshest of this phone's copy and the owner's docs), brought up to now. */
export function mine(now = Date.now()) {
  if (!MINE) {
    const local = readLocal(), remote = clean(freshest(myDocs()));
    MINE = (remote && (!local || remote.at > local.at)) ? remote : local;
    if (!MINE) { MINE = fresh(now); PROVISIONAL = !boardKnown(); }
  }
  // (what the clock does — a job done, a soldier trained — is kept here only: every phone works it out the same from
  // the times on the realm, so it isn't worth a trip to the board)
  if (tick(MINE, now)) { writeLocal(MINE); emit('change'); }
  return MINE;
}
/** Picks up a newer copy from the owner's other phone. True if it changed. */
export function sync(now = Date.now()) {
  const s = mine(now);
  let changed = false;
  const remote = clean(freshest(myDocs()));
  if (remote && (PROVISIONAL || remote.at > s.at + 1000)) { MINE = remote; tick(MINE, now); changed = true; writeLocal(MINE); }
  if (boardKnown()) { if (PROVISIONAL && !remote) dirty = true; PROVISIONAL = false; }
  if (changed) emit('sync');
  return changed;
}
/** Marks the realm changed: saved here at once, to the board a moment later. */
export function touch() {
  if (!MINE) return;
  MINE.at = Date.now();
  writeLocal(MINE);
  dirty = true;
  clearTimeout(saveT);
  saveT = setTimeout(flush, 1500);
  emit('change');
}
/** Puts the realm on the owner's board doc now (when the board takes posts). Never anyone else's. */
export async function flush() {
  clearTimeout(saveT);
  const LB = daily.LB;
  if (!dirty || !MINE || PROVISIONAL || !mayPlay() || !LB.put || !LB.ready || LB.off || !LB.uid) return false;
  dirty = false;
  const body = {fr1: MINE}, fields = ['fr1'];
  const own = (LB.raw || []).find(p => p.id === LB.uid);
  if (!own) { Object.assign(body, {nick: (daily.postName() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0}); fields.push('nick', 'g', 'total'); }
  try { await LB.put(body, fields); return true; } catch (e) { dirty = true; return false; }
}
try {
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('online', () => flush());
} catch (_) {}
/** For the checks: start over from a given state (or none). */
export function _set(s) { MINE = s; PROVISIONAL = false; }
