// Keepfall (the owner's ask, Oct 2026: a Clash of Clans of his own, in a medieval fantasy, a game case on Daily Games; his
// alone: data.isOwner()). Your realm is a lot with your Castle at its heart. The daily games pay for it: every result
// you've posted to the board from the day your realm began (its born; the owner, Oct 22 2026: "count from the start
// day") comes in as Gold and Ale (from Oct 22 2026: Ale
// for your place on three boards, Gold from Kick It and Return Man; incomeOf), waiting in your coffers until the
// treasuries and cellars have room. Gold mines dig Gold and breweries brew Ale while you're
// away. Your builder raises and upgrades one thing at a time (the owner, Oct 2026), on a clock. Ale trains an army at the barracks; the army raids the
// computer's realms for what they hold. The computer's realms raid you too (core/realm-battle.js defend), a few times
// a day, which is what your walls and towers are for.
//
// Names (the owner, Oct 21 2026): the game was the Realm, its second currency Grain, made by farms and held in
// granaries, its main building the Keep. On screen they're now Keepfall (the game), Ale, breweries, cellars and the
// Castle; in the code and in every save they keep their old ids (route #/realm, view 'realm', 'grain', 'farm',
// 'granary', 'keep', fr1, gg-fr1), so every save loads as it was. Only the words people read changed: CUR_NAME,
// KINDS' names and blurbs, and the views' text.
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
export const CUR_NAME = {gold: 'Gold', grain: 'Ale'};
/** Whether this phone may have Keepfall at all: the owner's alone. */
export const mayPlay = () => !!(data.isOwner && data.isOwner());
// Testing (the owner, Oct 22 2026): his realm started over at Castle level 1 with unlimited Gold and Ale and no
// building time. A realm marked tst spends nothing and builds and upgrades at once; one saved before TEST_RESET is
// started over (keeping its house name and scenery) when it loads, on whichever phone loads it first.
export const TEST_RESET = '2026-10-22-lore-restart';
export const testing = s => !!(s && s.tst);
const afford = (s, c, n) => testing(s) || n <= s.r[c];
const spend = (s, c, n) => { if (!testing(s)) s.r[c] -= n; };

// ---------------------------------------------------------------------------------------------------- the buildings
// Per level (index level - 1): cost (to build it, then to reach each level), time (seconds: each level takes longer
// than the last, minutes at first, a day or two at the top; the owner, Oct 2026), hp, th (the Castle level it needs);
// and what it does: rate (an hour) and hold (hours of it: a day's, 24, from Oct 22 2026, was 10, so a day away isn't
// lost) for mines and breweries; cap for treasuries and cellars; store
// for the Castle; room (soldiers) for war camps; dps, range, every (seconds a shot), splash, min, air (can it hit a
// dragon) for defenses; for the hatchery, its level is the Dragon Hero's (HEROES.dragon). pay: what it's paid for in.
// size: tiles square. (keep is the Castle, farm the Brewery, granary the Cellar: the ids from before, the names now.)
export const KINDS = {
  keep: {name: 'Castle', size: 4, pay: 'gold', role: 'hall',
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
    rate: [20, 35, 50, 70, 90, 115, 140, 170, 200, 240, 280, 330], hold: 24},
  farm: {name: 'Brewery', size: 3, pay: 'gold', role: 'make', makes: 'grain',
    blurb: 'Brews Ale while you’re away: it piles up until you collect it.',
    cost: [150, 300, 700, 1400, 3000, 6000, 12000, 24000, 45000, 80000, 140000, 220000],
    time: [10, 300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 64800, 86400, 129600],
    hp: [400, 440, 480, 520, 560, 600, 640, 680, 720, 780, 840, 900],
    th: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    rate: [20, 35, 50, 70, 90, 115, 140, 170, 200, 240, 280, 330], hold: 24},
  treasury: {name: 'Treasury', size: 3, pay: 'grain', role: 'store', holds: 'gold',
    blurb: 'Holds your Gold. More room means bigger upgrades, and more for raiders to take.',
    cost: [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 180000, 300000],
    time: [10, 600, 1800, 3600, 7200, 14400, 28800, 43200, 64800, 86400, 129600],
    hp: [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
    th: [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    cap: [3000, 7500, 15000, 30000, 50000, 80000, 120000, 170000, 240000, 330000, 450000]},
  granary: {name: 'Cellar', size: 3, pay: 'gold', role: 'store', holds: 'grain',
    blurb: 'Holds your Ale. More room means bigger upgrades, and more for raiders to take.',
    cost: [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 180000, 300000],
    time: [10, 600, 1800, 3600, 7200, 14400, 28800, 43200, 64800, 86400, 129600],
    hp: [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
    th: [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    cap: [3000, 7500, 15000, 30000, 50000, 80000, 120000, 170000, 240000, 330000, 450000]},
  barracks: {name: 'Barracks', size: 4, pay: 'grain', role: 'train',
    blurb: 'Trains your army with Ale. Higher levels open new kinds of soldier; each barracks trains alongside the others.',
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
  // The Dragon Hero's (the owner, Oct 22 2026: "the dragon is unlocked through the hatchery and gets stronger with each
  // upgrade to the hatchery"): built, it hatches him; his level is its level. From Castle 4 (was 6), the Wizard Hero's
  // old caps (Castle 4: levels 1–2, 5: 4, 6: 6, 7: 8, 8: 10); its first two levels cost less (12,000 and 25,000 Ale,
  // were 20,000 and 40,000), so a Castle 4 realm (10–15,000 Ale a day from the games) hatches him in a day and has
  // level 2 a couple of days on. (Only cost, time, th and the words changed: hp stays, it's in battleMark.)
  hatchery: {name: 'Dragon Hatchery', size: 4, pay: 'grain', role: 'hatch',
    blurb: 'Where your Dragon Hero hatches and grows. Build it and he hatches; every level it goes up makes him stronger.',
    cost: [12000, 25000, 70000, 110000, 160000, 220000, 300000, 400000, 520000, 660000],
    time: [3600, 10800, 21600, 32400, 43200, 64800, 86400, 108000, 129600, 172800],
    hp: [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700],
    th: [4, 4, 5, 5, 6, 6, 7, 7, 8, 8]},
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
// How many of each a Castle level allows (index Castle level - 1).
export const COUNT = {
  keep: [1, 1, 1, 1, 1, 1, 1, 1],
  hut: [2, 2, 3, 3, 4, 4, 5, 5],
  mine: [1, 2, 3, 4, 5, 6, 6, 6],
  farm: [1, 2, 3, 4, 5, 6, 6, 6],
  treasury: [1, 1, 2, 2, 2, 3, 4, 4],
  granary: [1, 1, 2, 2, 2, 3, 4, 4],
  barracks: [1, 2, 2, 3, 3, 3, 4, 4],
  camp: [1, 1, 2, 2, 3, 3, 4, 4],
  hatchery: [0, 0, 0, 1, 1, 1, 1, 1],
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
  if (K.role === 'hatch') o.dragon = i + 1; // (the Dragon Hero's level: heroStat('dragon', it))
  if (K.role === 'def') Object.assign(o, {dps: K.dps[i], range: K.range, every: K.every, splash: K.splash || 0, min: K.min || 0, air: !!K.air});
  return o;
}

// ---------------------------------------------------------------------------------------------------- the army
// hp, dps, speed (tiles a second), range (tiles), room (war camp space), cost (Ale: s.r.grain), time (seconds to train),
// at (the barracks level that opens it), aim (what it goes for first: any building, defenses, walls, or where the gold
// and ale are). A thief does double to money buildings; an
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
    blurb: 'Goes for the gold and ale: mines, breweries, treasuries and cellars, double damage on them.'},
  // (retired Oct 22 2026, when the Dragon Hero took the Wizard Hero's place: no longer trained (not in TROOP_ORDER), the
  // ones a save had refunded once (clean()); kept here, as it was, only so a raid recorded before then plays again as it
  // did (RULES[1]), and its picture draws the Dragon Hero)
  dragon: {name: 'Dragon', hp: 900, dps: 60, speed: 1.4, range: 2.5, room: 10, cost: 3000, time: 120, at: 6, aim: 'any', splash: .9, fly: true,
    blurb: 'Retired: dragons hatch as your Dragon Hero now.'}
};
/** The troops the barracks train (the Dragon's retired: TROOPS.dragon). */
export const TROOP_ORDER = ['footman', 'archer', 'knight', 'thief'];
/** The retired troops (their old Franchise names too), and the Ale each one a save still has comes back with once
 *  (clean()): the sapper 600, the dragon what it cost, 3,000. */
export const RETIRED = Object.freeze({sapper: 600, fullback: 600, dragon: 3000, kicker: 3000});

// Unique champions live outside the trained army; a fallen hero returns home after the raid and can march again. The
// ordinary Knight troop remains a separate, expendable soldier.
// Castle 4 unlocks (the owner, Oct 22 2026: "Level 4 is where the user unlocks raids and other items such as wizard and
// knight"): the Knight Hero is recruited from Castle level 4 (was 2) and Gold buys his levels; one recruited before keeps
// his level (heroLevel: the cap table is as it was, so a Castle 2 or 3 Knight Hero stays).
// The Dragon Hero (the owner, Oct 22 2026: "The dragon should be used as a hero in place of the wizzard. the dragon is
// unlocked through the hatchery and gets stronger with each upgrade to the hatchery"): no Gold buys him or his levels.
// He hatches when the first Dragon Hatchery is built, and his level IS the hatchery's (1–10; one being upgraded counts
// at the level it has): worked out from the buildings every time (heroLevel), never read from the roster, so nothing
// saved can make or raise him. He flies (no wall or building stops him; only ballistas and archer towers reach him),
// his fire splashes, he goes for anything and can hit flyers. His numbers (hp, dps, range, splash: one a level) grow
// every level: at 1 a little more than the Wizard Hero was at 2; at 10 well past a trained Dragon (900 hp, 60 a second),
// but one of him alone doesn't take a computer realm of his Castle's level (tools/realm/check-dragon-hero.cjs).
// The Wizard Hero is gone (a recruited one's Gold refunded once: clean()); kept in RULES[1] for old replays only.
export const HERO_ORDER = ['knight', 'dragon'];
export const HEROES = {
  knight: {name: 'Knight Hero', at: 4, troop: 'hero_knight', hp: 500, dps: 24, speed: 1.5, range: .8, aim: 'def', air: false,
    cap: [0, 2, 3, 4, 6, 8, 9, 10], cost: [1500, 2200, 4000, 7000, 12000, 20000, 32000, 50000, 75000, 110000],
    blurb: 'A champion in heavy armor. Leads your attacks and meets ground raiders with sword and shield.'},
  dragon: {name: 'Dragon Hero', at: 4, troop: 'hero_dragon', hatch: 'hatchery', speed: 1.5, aim: 'any', air: true, fly: true,
    hp: [420, 520, 640, 780, 950, 1140, 1370, 1650, 2000, 2400],
    dps: [38, 44, 50, 57, 66, 75, 86, 99, 113, 130],
    range: [2.5, 2.5, 2.5, 2.5, 2.75, 2.75, 2.75, 3, 3, 3],
    splash: [.8, .8, .8, .9, .9, .9, 1, 1, 1, 1.1],
    blurb: 'Hatched at your Dragon Hatchery and as strong as it is high. Flies over walls, burns crowds and buildings, and only ballistas and archer towers can reach him.'}
};
// ---- the rules a raid is played under: 2 now; 1 till Oct 22 2026 (the Wizard Hero and the trained Dragon), kept only
// so a raid recorded then plays again exactly as it did (decodeReplay: a replay says which it was played under)
const WIZARD = {name: 'Wizard Hero', at: 4, troop: 'hero_wizard', hp: 230, dps: 30, speed: 1.7, range: 4.5, aim: 'any', air: true, splash: 1.2,
  cap: [0, 0, 0, 2, 4, 6, 8, 10], cost: [8000, 10000, 16000, 24000, 36000, 52000, 75000, 105000, 145000, 200000]};
export const RULES_V = 2;
export const RULES = Object.freeze({
  1: Object.freeze({battle: 1, troops: Object.freeze(['footman', 'archer', 'knight', 'thief', 'dragon']), heroes: Object.freeze(['knight', 'wizard']),
    hero: Object.freeze({knight: HEROES.knight, wizard: WIZARD}), hatch: Object.freeze({count: [0, 0, 0, 0, 0, 1, 1, 1], th: [6, 6, 6, 7, 7, 7, 8, 8, 8, 8]})}),
  2: Object.freeze({troops: TROOP_ORDER, heroes: HERO_ORDER, hero: HEROES, hatch: null}) // (its battle version: BATTLE_V)
});
/** A rule set (RULES) by its number: today's for anything else. */
export const rulesOf = v => RULES[v] || RULES[RULES_V];
const heroKind = (k, v = RULES_V) => { const R = rulesOf(v); return R.heroes.includes(k) ? R.hero[k] : null; };
/** The Dragon Hatchery's level in realm s (the best one standing; one being upgraded counts at the level it has). */
export const hatchLevel = s => Math.min(10, Math.max(0, ...((s && Array.isArray(s.b) ? s.b : []).filter(b => b && b.t === 'hatchery' && Number.isInteger(b.l) && b.l >= 1).map(b => b.l))));
/** The highest level hero k can have at this Castle: the Knight's cap; the Dragon's, the hatchery's top level there. */
export const heroCap = (s, k) => { const H = heroKind(k); return !H ? 0 : H.hatch ? topLevel(H.hatch, keepOf(s)) : (H.cap[keepOf(s) - 1] || 0); };
// (a realm's roster: every realm has one, fresh() and clean(); the computer's lots (botBase) have none, so no heroes)
const roster = s => !!(s && s.hr && typeof s.hr === 'object' && !Array.isArray(s.hr));
/** A hero's level in realm s: the Knight's, recruited and restricted to the current Castle's cap (bad or unknown entries
 *  cannot create one); the Dragon's, his hatchery's (never s.hr's). 0: none. */
export function heroLevel(s, k) {
  const H = heroKind(k);
  if (!H || !roster(s)) return 0;
  if (H.hatch) return hatchLevel(s);
  const l = s.hr[k];
  return Number.isInteger(l) && l > 0 ? Math.min(l, 10, heroCap(s, k)) : 0;
}
/** Snapshot this roster for a raid/replay. Eligibility is checked again when battle units are created. */
export const heroLevels = s => mayPlay() ? Object.fromEntries(HERO_ORDER.map(k => [k, heroLevel(s, k)]).filter(([, l]) => l > 0)) : {};
export const heroArmy = s => Object.fromEntries(Object.keys(heroLevels(s)).map(k => [HEROES[k].troop, 1]));
/** A hero's combat stats at a level (1–10), under rules v (RULES: today's by default), or null. Copied, so a battle
 *  never changes the permanent roster. */
export function heroStat(k, level, v = RULES_V) {
  const H = heroKind(k, v);
  if (!H || !Number.isInteger(level) || level < 1 || level > 10) return null;
  if (H.hatch) {
    const i = level - 1;
    return {hp: H.hp[i], dps: H.dps[i], speed: H.speed, range: H.range[i], aim: H.aim, air: H.air, splash: H.splash[i], room: 0, fly: true};
  }
  return {hp: Math.round(H.hp * (1 + .18 * (level - 1))), dps: Math.round(H.dps * (1 + .16 * (level - 1))),
    speed: H.speed, range: H.range, aim: H.aim, air: H.air, splash: H.splash || 0, room: 0};
}
function heroChange(s, k, recruit) {
  const H = heroKind(k), level = H ? heroLevel(s, k) : 0, to = recruit ? 1 : level + 1;
  const o = {ok: false, why: '', cost: H && !H.hatch ? (H.cost[to - 1] || 0) : 0, pay: 'gold', to};
  if (!mayPlay()) return {...o, why: 'Keepfall is available on Evan’s profile'};
  if (!H) return {...o, why: 'Unknown hero'};
  // (the Dragon Hero: no Gold; his hatchery's upgrades are his)
  if (H.hatch) return {...o, why: level ? 'He grows with the Dragon Hatchery: upgrade it' : `He hatches at a Dragon Hatchery (Castle level ${H.at})`};
  if (keepOf(s) < H.at) return {...o, why: `Needs Castle level ${H.at}`};
  if (recruit && level) return {...o, why: 'Already recruited'};
  if (!recruit && !level) return {...o, why: 'Recruit this hero first'};
  if (to > 10) return {...o, why: 'At the top hero level'};
  if (to > heroCap(s, k)) {
    const need = H.cap.findIndex(n => n >= to) + 1;
    return {...o, why: `Needs Castle level ${need}`};
  }
  if (!testing(s) && (!s.r || !Number.isFinite(s.r.gold) || s.r.gold < o.cost)) return {...o, why: 'Not enough Gold'};
  return {...o, ok: true};
}
export const canRecruitHero = (s, k) => heroChange(s, k, true);
export const canUpgradeHero = (s, k) => heroChange(s, k, false);
function changeHero(s, k, recruit) {
  const check = heroChange(s, k, recruit);
  if (!check.ok) return false;
  spend(s, 'gold', check.cost);
  if (!s.hr || typeof s.hr !== 'object' || Array.isArray(s.hr)) s.hr = {};
  s.hr[k] = check.to;
  return true;
}
export const recruitHero = (s, k) => changeHero(s, k, true);
export const upgradeHero = (s, k) => changeHero(s, k, false);

// ---------------------------------------------------------------------------------------------------- what the games pay
// Two rules, by the day (the owner, Oct 21 2026: "the user's spot in the leaderboard for the following games give the
// player ale: daily puzzle, 17-0, and 2:00 drill. In the field goal game, there should be one in every 5 field goals
// will earn them coins. the return man game should have coins"; and "coins are only available on the 1st attempt"):
// - Every game day before NEW_PAY (each game's own day numbers) keeps the old pay exactly: the day's result, in Gold and
//   Ale alike (PAY), so nothing already paid ever drops.
// - From NEW_PAY on, Ale (the 'grain' id) is your place on the day's final league board in Daily Puzzles, 17–0 and the
//   Two-Minute Drill (ALE_BY_PLACE: tied rows share the higher place), ranked as each game's own board ranks it (the
//   league's board, the members' and Ryan D's rows: never the guests and app users the owner's phone also shows; a
//   person once across their phones), paid once that game's day is over (the next morning) and then frozen (the realm's
//   pd: freezePaid), so a late post on that day's board can't take it back; today's place is pending till then. Gold is
//   Kick It's run that counts (the day's first finished: kickGold, KICK_BASE for the run and KICK_GOLD for every 5th
//   make) and Return Man's day (RETURN_BASE for a day with a run on the board, and COIN_GOLD a coin, up to
//   COIN_PAID_MAX of them, on the day's first run: coinGold, the coins that run's board entry carries, COIN_FIELD),
//   paid as soon as the run is on the board. Those three pay no Gold now, these two no Ale.
// - Competitive pay (the owner, Oct 22 2026: "Playing games alone should give the users a good amount of resources.
//   This should get their castle to level four"): from the same first day (NEW_PAY: Oct 22, so it only ever raised
//   what that day paid), Kick It pays 500 + 3,000 for every 5th make (was 1,000 a 5th) and Return Man 500 a day with a
//   run + 25 a coin, the first 200 (was 10 a coin). Ale by place is as it was.
export const PAY = {
  puzzles: e => 400 + 5 * Math.max(0, Math.min(600, Number(e.p) || 0)),
  '17-0': e => 400 + 150 * e.w + (e.w === 17 ? 500 : 0),
  drill: e => (e.r === 'W' ? 3000 : e.r === 'T' ? 2000 : 1000),
  kick: e => 400 + 200 * Math.min(15, e.m),
  return: e => 400 + Math.min(3000, 3 * e.y)
};
export const GAME_NAME = {puzzles: 'Daily Puzzles', '17-0': '17–0', drill: 'Two-Minute Drill', kick: 'Kick It', return: 'Return Man'};
// The first day of the new pay in each game's numbering: Thu Oct 22 2026, the first day played after it shipped (the
// owner asked for it on the evening of Wed Oct 21, by when he'd played all five of that day's games under the old pay:
// they keep it). The Daily Puzzles count from Sep 28, 17–0 from Oct 9, the Drill from Oct 15, Kick It from Oct 18,
// Return Man from Oct 20. Written down once, never worked out from the clock, so no earlier day is ever paid the new way.
export const NEW_PAY = Object.freeze({puzzles: 25, '17-0': 14, drill: 8, kick: 5, return: 3});
/** That day, for the words (the coffers say when it starts while a game's still on the old pay). */
export const NEW_PAY_DATE = '2026-10-22';
/** Whether a game is still on the old pay today (E: incomeOf()'s, its day numbers). */
export const oldPayToday = E => Object.keys(NEW_PAY).some(g => { const n = ((E && E.day) || {})[g]; return n > 0 && n < NEW_PAY[g]; });
/** The games that pay Ale by your place on their board, and the two that pay Gold. */
export const RANKED = ['puzzles', '17-0', 'drill'];
export const GOLD_GAMES = ['kick', 'return'];
/** Ale for a day's place (index place - 1; 7th or lower, having played at all, the last). */
export const ALE_BY_PLACE = Object.freeze([5000, 4000, 3200, 2600, 2100, 1700, 1200]);
export const aleFor = place => (Number.isInteger(place) && place >= 1 ? ALE_BY_PLACE[Math.min(place, ALE_BY_PLACE.length) - 1] : 0);
/** Kick It (core/kick.js GOLD, goldOf: the same numbers, the kit checks they agree): KICK_BASE for the day's counting
 *  run whatever it made (0 makes included), KICK_GOLD for every KICK_EVERY-th make, KICK_MOST makes at most (40). */
export const KICK_EVERY = 5, KICK_GOLD = 3000, KICK_BASE = 500, KICK_MOST = 40;
/** Return Man (core/return.js COIN.gold the same): RETURN_BASE for a day with a run on the board, and COIN_GOLD a coin
 *  on the day's first run, the first COIN_PAID_MAX coins. */
export const COIN_GOLD = 25, RETURN_BASE = 500, COIN_PAID_MAX = 200;
/** Return Man's coins on a day's board entry (the day's first run's: core/return.js puts them there, dayCoins reads them),
 *  and the most a run can carry (Return Man's own bound, COIN.most). */
export const COIN_FIELD = 'c', COIN_MAX = 1000;
/** Gold for the day's counting Kick It run of `made` makes: 500, and 3,000 for every 5th (40 makes at most: 24,500). */
export const kickGold = made => KICK_BASE + KICK_GOLD * Math.floor(Math.min(KICK_MOST, Math.max(0, Math.floor(Number(made) || 0))) / KICK_EVERY);
/** Gold for a Return Man first run's coins: 25 a coin, the first 200 (5,000 at most; nothing for none or a bad number).
 *  The day's RETURN_BASE comes on top (returnGold). */
export const coinGold = coins => { const c = Math.floor(Number(coins) || 0); return c > 0 ? COIN_GOLD * Math.min(c, COIN_PAID_MAX) : 0; };
/** What a Return Man day with a run on the board pays: RETURN_BASE + coinGold(its first run's coins). */
export const returnGold = coins => RETURN_BASE + coinGold(coins);
const STARTER = 1500; // (of each, for a new realm, on top of what its games have paid)
const FIELD = {'17-0': 's17', drill: 'dr5', kick: 'kk1', return: 'rm2'};
const MOD = {'17-0': 'sv', drill: 'dr', kick: 'kk', return: 'rm'};
// a game's day number for a date (its days start at local midnight, day 1 on start: 'YYYY-MM-DD'), as the games count
const dayNo = (start, t) => {
  const [y, m, d] = String(start).split('-').map(Number);
  return 1 + Math.max(0, Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000));
};
/** Each game's day number on date at (default: now, by the clock, past midnight too), 0 for a game whose days aren't
 *  loaded yet. */
export function todayNumbers(mods = {}, at = null) {
  const out = {puzzles: daily.PZ && daily.PZ.start ? dayNo(daily.PZ.start, at || new Date()) : 0};
  Object.keys(MOD).forEach(g => { const M = mods[MOD[g]]; let n = 0; try { n = M && M.todayNumber ? M.todayNumber(at || new Date()) : 0; } catch (_) { n = 0; } out[g] = n || 0; });
  return out;
}
// Count from the start day (the owner, Oct 22 2026): a realm is paid for the game days from the day it began on (its
// born, in each game's own numbering: todayNumbers), never for the results before it, so a new realm doesn't open with
// the whole season's pay. A testing realm started over (testRealm) is a new realm, born that moment: it counts from
// the day it started over. What's already been taken from the coffers stays where it went (pending: never below nothing).
/** Each game's day number on the day a realm began (from: ms, its born), the first day it's paid for (a game that began
 *  after it: its day 1), or Infinity for a game whose days aren't loaded yet (nothing paid for it till they are). */
export function startNumbers(mods = {}, from) {
  const n = todayNumbers(mods, new Date(Number(from) || 0));
  return Object.fromEntries(Object.entries(n).map(([g, v]) => [g, Number.isInteger(v) && v >= 1 ? v : Infinity]));
}

/**
 * What a person's games have paid, from their board docs (docs: all of them one person's):
 *   {total: {gold, grain}, by: {game: {gold, grain}}, today: {game: {gold, grain}} (what came in today: today's Gold,
 *    and the Ale for yesterday's place, paid this morning; on a game's last days of the old pay, today's in both),
 *    pending: {game: {n, place, of, grain}} (today's place on a ranked game's board, paid tomorrow if it holds), last:
 *    {game: {n, place, of, grain}} (the latest place paid), days, day: {game: today's day number} (todayNumbers()),
 *    fresh: {game: {n: place}} (the places paid now that weren't frozen yet: paidPlaces keeps them)}
 * mods: the loaded game cores {sv, dr, kk, rm} (entryOf, todayNumber, boardRows); a missing one pays nothing yet. The
 * Daily Puzzles' board is daily.js's own. Options: board (the docs the places are ranked among: default daily.LB.raw;
 * either way only the rows the LEAGUE's boards show count, daily.boardShows(p, false): the members' and Ryan D's, never
 * a guest's or another app user's, which the owner's phone shows him but which aren't on the league's boards; his docs
 * are counted on it whether or not it has them), me (whose row is his on the boards: a board key, default this
 * phone's, myKey()), at (the moment: default now), paid (the places already paid, frozen: {game: {n: place}}, a
 * realm's pd; a day there pays that place whatever its board says now), from (when the realm began, ms: its born; only
 * the game days from that day on are paid, startNumbers; none given: every day). Per game and day the entry that counts
 * is the boards' own (old days: the first finished across his phones, Return Man's best run).
 */
export function incomeOf(docs, mods = {}, {board = null, me, at = null, paid = null, from = null} = {}) {
  docs = (docs || []).filter(p => p && typeof p === 'object');
  // (the league's board: never the guests and app users his phone shows him, so none of them can push his place down)
  const list = (board || daily.LB.raw || []).filter(p => p && daily.boardShows(p, false));
  docs.forEach(p => { if (!list.some(q => q.id === p.id)) list.push(p); });
  if (me === undefined) me = myKey();
  const myIds = new Set(docs.map(p => p.id));
  const byId = new Map(list.map(p => [p.id, p]));
  const isMine = id => myIds.has(id) || (!!me && byId.has(id) && daily.boardKey(byId.get(id)) === me);
  const zero = () => ({gold: 0, grain: 0});
  const total = zero(), by = {}, today = {}, pending = {}, last = {}, fresh = {};
  let days = 0;
  const tn = todayNumbers(mods, at);
  // (count from the start day: a day before the realm began pays nothing, old pay or new)
  const sn = Number(from) > 0 ? startNumbers(mods, from) : null;
  const counts = (g, n) => !sn || n >= sn[g];
  // (a day of today's is in today's, if it paid nothing: a Kick It run without a 5th make)
  const pay = (g, c, v, isToday) => {
    if (isToday) today[g] = today[g] || zero();
    if (!(v > 0)) return;
    (by[g] = by[g] || zero())[c] += v;
    total[c] += v;
    if (isToday) today[g][c] += v;
  };
  // (the old pay: the day's result in both alike)
  const old = (g, v, n) => { pay(g, 'gold', v, n === tn[g]); pay(g, 'grain', v, n === tn[g]); days++; };
  // (the new pay for a ranked game: his place on day n's board, rows from the game's own boardRows; a day already paid,
  // its place frozen in paid, pays that place: a late post on its board can't take back what came in)
  const place = (g, n, rowsOf, mine) => {
    if (!tn[g] || n > tn[g]) return;
    const was = n < tn[g] && paid && paid[g] && typeof paid[g] === 'object' ? paid[g][n] : null;
    let o;
    if (Number.isInteger(was) && was >= 1) o = {n, place: was, of: 0, grain: aleFor(was)};
    else {
      let rows = [];
      try { rows = rowsOf() || []; } catch (e) { rows = []; }
      const r = rows.find(mine);
      if (!r || !Number.isInteger(r.rank) || r.rank < 1) return;
      o = {n, place: r.rank, of: rows.length, grain: aleFor(r.rank)};
      if (n < tn[g]) (fresh[g] = fresh[g] || {})[n] = r.rank;
    }
    if (n === tn[g]) { pending[g] = o; return; }
    pay(g, 'grain', o.grain, n === tn[g] - 1);
    days++;
    if (!last[g] || n > last[g].n) last[g] = o;
  };
  // Daily Puzzles: old days the first finished across his docs; new days his place on daily.js's board (one score a
  // member a day: onePerMember, as the board has it)
  const pz = new Map();
  docs.forEach(p => Object.keys(p.days || {}).forEach(k => {
    const e = p.days[k], t = Number(e && e.t) || 0, was = pz.get(k);
    if (e && (!was || t < was.t)) pz.set(k, {e, t});
  }));
  let players = null;
  pz.forEach(({e}, k) => {
    const n = Number(k);
    if (!(n >= 1) || !counts('puzzles', n)) return;
    if (n < NEW_PAY.puzzles) { old('puzzles', PAY.puzzles(e), n); return; }
    place('puzzles', n, () => daily.boardRows('today', players || (players = daily.onePerMember(list)), n, daily.dayFor(n)), r => isMine(r.id));
  });
  ['17-0', 'drill', 'kick', 'return'].forEach(g => {
    const M = mods[MOD[g]], F = FIELD[g];
    if (!M || !M.entryOf) return;
    const keys = new Set();
    docs.forEach(p => Object.keys((p[F] && typeof p[F] === 'object' && p[F]) || {}).forEach(k => keys.add(Number(k))));
    keys.forEach(n => {
      if (!Number.isInteger(n) || n < 1 || !counts(g, n)) return;
      const entries = [];
      docs.forEach(p => { let e = null; try { e = M.entryOf(p, n); } catch (_) { e = null; } if (e) entries.push({e, p}); });
      if (!entries.length) return;
      if (n < NEW_PAY[g]) {
        // (as the old pay picked it: the first finished across his docs, Return Man's best run, the earlier of equals)
        const pick = entries.reduce((b, x) => (g === 'return' ? x.e.y > b.e.y || (x.e.y === b.e.y && (x.e.t || 0) < (b.e.t || 0)) : (x.e.t || 0) < (b.e.t || 0)) ? x : b);
        old(g, PAY[g](pick.e), n);
        return;
      }
      // the run that counts on the board: the first finished across his docs (the earliest, then the lower doc id)
      const first = entries.slice().sort((a, b) => (a.e.t || 0) - (b.e.t || 0) || (String(a.p.id) < String(b.p.id) ? -1 : 1))[0];
      if (g === '17-0') { place(g, n, () => M.boardRows('today', n, list), r => r.key === me || myIds.has(r.uid)); return; }
      if (g === 'drill') { place(g, n, () => M.boardRows(n, list), r => r.key === me || myIds.has(r.uid)); return; }
      if (tn[g] && n > tn[g]) return;
      // (Kick It's own rule when its core has it, goldOf: what its end card promises is what's paid)
      if (g === 'kick') pay(g, 'gold', (typeof M.goldOf === 'function' ? M.goldOf : kickGold)(first.e.m), n === tn[g]);
      else pay(g, 'gold', returnGold(typeof M.dayCoins === 'function' ? M.dayCoins(docs, n) : firstCoins(entries, n, M)), n === tn[g]);
      days++;
    });
  });
  return {total, by, today, pending, last, days, day: tn, fresh, from: sn ? Number(from) : 0};
}
/** Freezes the places incomeOf has just paid (its fresh) into a realm (s.pd: {game: {n: place}}), so a day's Ale, once
 *  paid, stays what it was; only from the board as it really is (loaded, and this realm the board's or taken up from
 *  it), never from a board not yet in (where he'd look first on every day). Mutates s; true if anything was added. */
export function freezePaid(s, fresh) {
  if (PROVISIONAL || !boardKnown() || daily.LB.err) return false;
  return freezeInto(s, fresh);
}
/** freezePaid's work, whatever the board: each place in fresh not frozen yet goes into s.pd. True if any did. */
export function freezeInto(s, fresh) {
  if (!s || !fresh || typeof fresh !== 'object') return false;
  let added = false;
  s.pd = s.pd && typeof s.pd === 'object' ? s.pd : {};
  RANKED.forEach(g => Object.entries(fresh[g] || {}).forEach(([n, place]) => {
    if (!Number.isInteger(place) || place < 1 || !(Number(n) >= 1)) return;
    const m = s.pd[g] || (s.pd[g] = {});
    if (m[n] == null) { m[n] = place; added = true; }
  }));
  return added;
}
/** Return Man: the coins of a person's first run of a day, from their entries that day ([{e, p}]: entryOf's, and its
 *  doc), when the game's core doesn't say (its dayCoins, the same rule): COIN_FIELD on their entries (the first run's
 *  coins: on the phone that ran it, and carried on by their others), the most any of them says, or 0; never more than
 *  the day's course lays out within the most yards they posted, when the core can say (its coinsWithin). */
function firstCoins(entries, n, M) {
  const most = entries.reduce((m, {e, p}) => {
    const raw = p[FIELD.return] && typeof p[FIELD.return] === 'object' ? p[FIELD.return][n] : null;
    const c = Number.isInteger(e[COIN_FIELD]) ? e[COIN_FIELD] : raw && typeof raw === 'object' ? raw[COIN_FIELD] : null;
    return Number.isInteger(c) && c >= 0 && c <= COIN_MAX ? Math.max(m, c) : m;
  }, 0);
  const far = entries.reduce((m, {e}) => Math.max(m, Number(e.y) || 0), 0);
  return most > 0 && M && typeof M.coinsWithin === 'function' ? Math.min(most, M.coinsWithin(n, far)) : most;
}

// ---------------------------------------------------------------------------------------------------- the scenery
// Where your realm lies (views/realm-3d.js draws it, img/realm/scenery/): the coast from the start; the rest unlocked by
// raising the Castle (the owner's ask, Oct 2026), each yours to pick (the house card) once it is.
export const SCENERIES = [
  {k: 'coast', name: 'The Coast', at: 1, blurb: 'A meadow by the sea, pines along the shore, mountains and lakes beyond', ownerName: 'Twilight Highlands', ownerBlurb: 'Rolling hills and torchlit gates beneath the last light of sunset'},
  {k: 'christmas', name: 'Christmas Kingdom', at: 1, ownerOnly: true, blurb: 'A snowy kingdom of festive castles, glowing village streets, decorated firs and wandering reindeer'},
  {k: 'forest', name: 'Enchanted Forest', at: 2, blurb: 'A glade in a moonlit wood, glowing streams and blooms all round'},
  {k: 'tundra', name: 'Frozen Tundra', at: 3, blurb: 'A snowfield by an icy sea, pines and mountains all round'},
  {k: 'ocean', name: 'Ocean Sanctuary', at: 5, blurb: 'An island of grass and palms in a turquoise sea'},
  {k: 'desert', name: 'Amber Desert', at: 6, blurb: 'Sand under a setting sun, red rock and an oasis beyond'},
  {k: 'infernal', name: 'Infernal Wastes', at: 7, blurb: 'Scorched ground ringed by rivers of lava, a volcano beyond'}
];
/** Whether scenery k is open to this realm (its Castle high enough and profile eligible). */
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
// n (the lot it's laid out on, N; none: N_WAS), pd (the Ale places already paid, frozen: {game: {day: place}},
// freezePaid), ex (the example raids: realm-battle.js exampleRaids; none when there are none), exv (EX_V once they've been
// made, or cleared)}. A raid record (rd, df, ex) may carry rp, its replay (snapOf).
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
    ar: {}, hr: {}, q: [], qs: 0, tp: 0, rd: [], df: [], lr: now, sh: 0, bt: {}, nb: 6};
}
// The Franchise's names (v1, Oct 2026), taken up as the Realm's (now Keepfall's: the same ids).
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
  o.rs = typeof o.rs === 'string' ? o.rs : '';
  if (o.tst) o.tst = 1; else delete o.tst;
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
  // Retire sappers (including their old fullback name), returning their Ale (grain) to the coffers; and from Oct 22 2026
  // the trained dragons (their old kicker name too: the Dragon Hero took their place), 3,000 Ale each, what one cost
  // (RETIRED). Ready or still in training, each comes back once: none is left to count again.
  // Credit before alias normalization so mixed old/new names cannot lose a refund.
  const retired = t => Object.prototype.hasOwnProperty.call(RETIRED, t);
  const count = n => Math.max(0, Math.floor(num(n)));
  const training = Array.isArray(o.q) ? o.q : [];
  const refund = Object.entries(o.ar || {}).reduce((n, [t, v]) => n + (retired(t) ? count(v) * RETIRED[t] : 0), 0)
    + training.reduce((n, x) => n + (Array.isArray(x) && retired(x[0]) ? count(x[1]) * RETIRED[x[0]] : 0), 0);
  o.xo.grain += refund;
  if (Array.isArray(training[0]) && retired(training[0][0])) o.qs = 0;
  const troops = (m) => Object.fromEntries(Object.entries(m || {}).map(([t, n]) => [OLD_TROOP[t] || t, n]));
  o.ar = Object.fromEntries(Object.entries(troops(o.ar)).filter(([t, n]) => TROOP_ORDER.includes(t) && num(n) > 0).map(([t, n]) => [t, num(n) | 0]));
  // The Wizard Hero, retired Oct 22 2026 (the Dragon Hero took his place): one recruited has the Gold paid for his levels
  // (his recruiting and each upgrade, to the level he had: the Castle's cap then, as heroLevel read it) back once, into
  // the coffers; then he's gone, and so is anything else on the roster but the Knight's (the Dragon's is his hatchery's).
  const hr = o.hr && typeof o.hr === 'object' && !Array.isArray(o.hr) ? o.hr : {}, wiz = hr.wizard;
  if (Number.isInteger(wiz) && wiz > 0) o.xo.gold += WIZARD.cost.slice(0, Math.min(wiz, 10, WIZARD.cap[keepOf(o) - 1] || 0)).reduce((a, c) => a + c, 0);
  o.hr = Object.fromEntries(HERO_ORDER.filter(k => !HEROES[k].hatch).map(k => [k, heroLevel(o, k)]).filter(([, l]) => l > 0));
  o.q = (Array.isArray(o.q) ? o.q : []).map(x => (Array.isArray(x) ? [OLD_TROOP[x[0]] || x[0], x[1]] : x))
    .filter(x => Array.isArray(x) && TROOP_ORDER.includes(x[0]) && num(x[1]) > 0).map(([t, n]) => [t, num(n) | 0]);
  o.qs = o.q.length ? num(o.qs) : 0; o.tp = Math.max(0, num(o.tp)); o.lr = num(o.lr) || o.at; o.sh = num(o.sh);
  // (the lots the replays were played on, kept once: {key: packed lot}; only what a replay points at stays, gcLots)
  if (o.lots && typeof o.lots === 'object' && !Array.isArray(o.lots)) o.lots = Object.fromEntries(Object.entries(o.lots).filter(([, t]) => typeof t === 'string' && t.length <= LOT_MAX && RP_TEXT.test(t)));
  else delete o.lots;
  o.rd = keepReplays(Array.isArray(o.rd) ? o.rd.filter(r => r && typeof r.id === 'string' && String(r.vs).startsWith('bot:')).slice(-40) : [], o);
  o.df = keepReplays(Array.isArray(o.df) ? o.df.filter(r => r && Number(r.at)).slice(-20) : [], o);
  // (the example raids, each with its replay, and whether they've been made: exampleRaids; none, nothing saved)
  const ex = Array.isArray(o.ex) ? o.ex.filter(r => r && r.ex === true && typeof r.id === 'string' && Number(r.at) && rpWhole(r.rp, o)).slice(-EX_MAX) : [];
  if (ex.length) o.ex = ex; else delete o.ex;
  if (isInt(o.exv) && o.exv > 0) o.exv = Math.min(o.exv, EX_V); else delete o.exv;
  gcLots(o);
  o.bt = o.bt && typeof o.bt === 'object' ? o.bt : {};
  // (the Ale places already paid, frozen: incomeOf's paid, freezePaid)
  const pd = o.pd && typeof o.pd === 'object' ? o.pd : {};
  o.pd = {};
  RANKED.forEach(g => {
    const m = pd[g] && typeof pd[g] === 'object' ? Object.entries(pd[g]).filter(([n, v]) => Number(n) >= 1 && Number.isInteger(v) && v >= 1) : [];
    if (m.length) o.pd[g] = Object.fromEntries(m);
  });
  delete o.ap;
  o.nb = Math.max(num(o.nb), ...o.b.map(b => b.i + 1), 1);
  return o;
}
export const keepOf = s => { const h = s.b.find(b => b.t === 'keep'); return h ? Math.max(1, h.l) : 1; };
/** The highest level kind k can go to at this Castle level. */
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
// (what the games have paid, of each: incomeOf()'s total, {gold, grain}; a single number, as it was before the games paid
// each their own, is the same of both)
const earnedOf = e => (e && typeof e === 'object' ? {gold: Number(e.gold) || 0, grain: Number(e.grain) || 0} : {gold: Number(e) || 0, grain: Number(e) || 0});
/** The coffers: what's waiting there, of each (the games' pay and the rest, less what's been taken into storage). Never
 *  below nothing. */
export function pending(s, earned) {
  const e = earnedOf(earned);
  return {gold: Math.max(0, e.gold + s.xo.gold - s.cl.gold), grain: Math.max(0, e.grain + s.xo.grain - s.cl.grain)};
}
/** Moves what's waiting in the coffers into storage, as far as there's room. Mutates s; returns what moved. */
export function claim(s, earned) {
  const p = pending(s, earned), cap = capOf(s), moved = {gold: 0, grain: 0};
  CUR.forEach(c => {
    const m = Math.max(0, Math.min(p[c], testing(s) ? Infinity : cap[c] - s.r[c]));
    if (m > 0) { s.r[c] += m; s.cl[c] += m; moved[c] = m; }
  });
  return moved;
}
/** Collects a mine or farm into storage, as far as there's room (the rest stays in it). Returns what came in. */
export function collect(s, id, now = Date.now()) {
  const b = s.b.find(x => x.i === id);
  if (!b || KINDS[b.t].role !== 'make') return 0;
  const c = KINDS[b.t].makes, have = made(b, now), room = testing(s) ? Infinity : Math.max(0, capOf(s)[c] - s.r[c]), take = Math.min(have, room);
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
  const cost = costOf(s, k, 1), o = {ok: false, why: '', cost, pay: K.pay, time: testing(s) ? 0 : K.time[0]};
  if (k === 'keep') return Object.assign(o, {why: 'You have one'});
  if (k === 'hut') return Object.assign(o, {why: 'One builder does it all'});
  if (n >= cap) {
    const next = COUNT[k].findIndex(c => c > n);
    return Object.assign(o, {why: next < 0 ? `All ${cap} built` : `Castle level ${next + 1} for another`});
  }
  if (!afford(s, K.pay, cost)) return Object.assign(o, {why: `Not enough ${CUR_NAME[K.pay]}`});
  if (o.time > 0 && builders(s, now).free < 1) return Object.assign(o, {why: 'Your builder is busy'});
  if (!spotFor(s, k)) return Object.assign(o, {why: 'No room on the lot'});
  return Object.assign(o, {ok: true});
}
/** Builds kind k at (x, y): paid now, up when its time's done (at once for walls and huts). The new building, or null
 *  if it can't. */
export function build(s, k, x, y, now = Date.now()) {
  const K = KINDS[k], chk = canBuild(s, k, now);
  if (!chk.ok || !fits(s, K.size, x, y)) return null;
  spend(s, K.pay, chk.cost);
  const b = {i: s.nb++, t: k, l: 0, x, y, u: now + chk.time * 1000};
  if (!chk.time || k === 'hut') { b.l = 1; b.u = 0; }
  if (K.role === 'make') b.c = b.u || now;
  s.b.push(b);
  return b;
}
/** Whether building id can go up a level now: {ok, why, cost, pay, time, to}. */
export function canUpgrade(s, id, now = Date.now()) {
  const b = s.b.find(x => x.i === id);
  if (!b) return {ok: false, why: 'Gone'};
  const K = KINDS[b.t], to = b.l + 1, o = {ok: false, why: '', to, pay: K.pay, cost: K.cost[to - 1], time: testing(s) ? 0 : K.time[to - 1]};
  if (b.u > now) return Object.assign(o, {why: b.l ? 'Being upgraded' : 'Going up'});
  if (to > maxLevel(b.t) || b.t === 'hut') return Object.assign(o, {why: 'At its top level'});
  if (to > topLevel(b.t, keepOf(s))) return Object.assign(o, {why: `Needs Castle level ${K.th[to - 1]}`});
  if (!afford(s, K.pay, o.cost)) return Object.assign(o, {why: `Not enough ${CUR_NAME[K.pay]}`});
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
  spend(s, chk.pay, chk.cost);
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
  // (the Dragon isn't trained from Oct 22 2026: he hatches as the Dragon Hero, HEROES.dragon)
  if (!TROOP_ORDER.includes(t)) return {ok: false, why: t === 'dragon' ? 'Dragons hatch as your Dragon Hero now' : 'Unknown troop'};
  if (!trainers(s)) return {ok: false, why: 'Build barracks first'};
  if (barracksLevel(s) < T.at) return {ok: false, why: `Barracks level ${T.at}`};
  if (roomOf(s.ar) + queued(s) + T.room * n > armyRoom(s)) return {ok: false, why: armyRoom(s) ? 'The war camps are full' : 'Build a war camp first'};
  if (!afford(s, 'grain', T.cost * n)) return {ok: false, why: `Not enough ${CUR_NAME.grain}`};
  return {ok: true};
}
export function train(s, t, n = 1, now = Date.now()) {
  if (!canTrain(s, t, n).ok) return false;
  spend(s, 'grain', TROOPS[t].cost * n);
  const last = s.q[s.q.length - 1];
  if (last && last[0] === t) last[1] += n; else s.q.push([t, n]);
  if (!s.qs) s.qs = now;
  return true;
}
/** Takes one of troop t out of training (the last in line), its Ale back. */
export function untrain(s, t, now = Date.now()) {
  if (!TROOP_ORDER.includes(t)) return false;
  for (let i = s.q.length - 1; i >= 0; i--) {
    if (s.q[i][0] !== t) continue;
    s.q[i][1]--;
    if (!testing(s)) s.r.grain += TROOPS[t].cost;
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
// Keep, treasuries and granaries by how much each holds; from mines and farms, a quarter of what's piled up in each.
// (Oct 22 2026, the owner's competitive pay: a tenth of storage, was .15, and a quarter of the piles, was half, so what
// the games pay mostly stays his.)
export const STORE_SHARE = .10, MADE_SHARE = .25;
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
 *  up, the glory, the raid on the record (rd, the last 40), the realm raided for today. B: the battle it was
 *  (core/realm-battle.js makeBattle, played out), when there's one: the record keeps its replay (rp: snapOf(B)), so it
 *  can be watched again (the newest RP_KEEP attacks keep theirs). Returns the record. */
export function finishRaid(s, rec, used, now = Date.now(), B = null) {
  if (B && !rec.rp) { const rp = snapOf(B, {into: s}); if (rp) rec.rp = rp; }
  const cap = capOf(s);
  CUR.forEach((c, i) => {
    const got = rec.lt[i] || 0, fit = Math.max(0, Math.min(got, cap[c] - s.r[c]));
    s.r[c] += fit;
    s.xo[c] += got - fit;
  });
  Object.entries(used || {}).forEach(([t, n]) => { if (!TROOP_ORDER.includes(t)) return; s.ar[t] = Math.max(0, (s.ar[t] || 0) - n); if (!s.ar[t]) delete s.ar[t]; });
  s.tp = Math.max(0, s.tp + (rec.ta || 0));
  s.bt[rec.vs] = dayKey(now);
  s.rd.push(rec);
  s.rd = keepReplays(s.rd.slice(-40), s);
  gcLots(s);
  return rec;
}
/** A raid on your realm, taken off it: what it took from storage and the mines' and farms' piles, the glory. Its
 *  replay (rec.rp, core/realm-battle.js defend records it, its lot in s.lots) stays on the newest RP_KEEP. */
export function takeRaid(s, rec) {
  const ls = rec.ls || [0, 0], at = Number(rec.at) || Date.now();
  s.r.gold = Math.max(0, s.r.gold - (ls[0] || 0));
  s.r.grain = Math.max(0, s.r.grain - (ls[1] || 0));
  Object.entries(rec.lb || {}).forEach(([id, v]) => {
    const b = s.b.find(x => x.i === Number(id));
    if (!b || KINDS[b.t].role !== 'make' || !b.c) return;
    const took = (v && (v[0] || v[1])) || 0, st = stat(b.t, b.l), rate = st.rate;
    // (a full pile stops growing, so its start comes up first to where it was just full (st.hold: the most it holds):
    // then what was taken really comes off it, Oct 22 2026; till then a pile left a day took nothing off)
    if (took > 0 && rate > 0) b.c = Math.max(b.c, at - st.hold / rate * HOUR) + took / rate * HOUR;
  });
  s.tp = Math.max(0, s.tp + (Number(rec.td) || 0));
  s.df.push(rec);
  s.df = keepReplays(s.df.slice(-20), s);
  gcLots(s);
}
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ---- the computer's realms: one at each Castle level, the same lot every day, full again every morning
export const BOTS = [
  {k: 'bot:1', name: 'Thornfield Hamlet', th: 1}, {k: 'bot:2', name: 'Briarwatch', th: 2}, {k: 'bot:3', name: 'Mossgate', th: 3},
  {k: 'bot:4', name: 'Cinderholt', th: 4}, {k: 'bot:5', name: 'Stonebrook Hold', th: 5}, {k: 'bot:6', name: 'Duskmere Castle', th: 6},
  {k: 'bot:7', name: 'Ironvale Citadel', th: 7}, {k: 'bot:8', name: 'The Obsidian Spire', th: 8}
];
export const BOT_LOOT = [2500, 6000, 12000, 22000, 40000, 65000, 100000, 150000];
export function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
/** A computer realm's lot (a realm state, nothing stored: its take is BOT_LOOT, spread like a raid's). v: the rules
 *  (RULES) it's laid out under, today's by default: under 1 (a replay recorded before Oct 22 2026) its hatchery is as it
 *  was then (from Castle 6, its old levels), so the lot is the one that raid was played on. It has no roster (hr): the
 *  computer's realms have no heroes defending them. */
export function botBase(th, v = RULES_V) {
  const R = rng(9000 + th * 77), s = {b: [], r: {gold: 0, grain: 0}}, H = rulesOf(v).hatch;
  let i = 1;
  const put = (t, l, x, y) => { if (fits(s, KINDS[t].size, x, y)) { s.b.push({i: i++, t, l, x, y, u: 0, c: 0}); return true; } return false; };
  // (the hatchery's count and top level under those rules)
  const many = t => (t === 'hatchery' && H ? H.count : COUNT[t])[th - 1];
  const topOf = t => (t === 'hatchery' && H ? H.th.reduce((a, need, j) => (need <= th ? j + 1 : a), 0) : topLevel(t, th));
  put('keep', th, N / 2 - 2, N / 2 - 2);
  const ring = (t, n, r0, r1) => {
    for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
      const a = R() * Math.PI * 2, r = r0 + R() * (r1 - r0), sz = KINDS[t].size;
      const x = Math.round(N / 2 + Math.cos(a) * r - sz / 2), y = Math.round(N / 2 + Math.sin(a) * r - sz / 2);
      if (put(t, Math.max(1, topOf(t) - (R() < .5 ? 1 : 0)), x, y)) k++;
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
  ['barracks', 'camp', 'hatchery', 'hut'].forEach(t => ring(t, Math.min(2, many(t)), 11, 15));
  return s;
}
/** The computer's Dragon Hero, when one leads its raid (realm-battle.js raidArmy's heroes): the level of the hatchery on
 *  that computer realm's lot (botBase(th)), 0 when it has none. */
export const botDragon = th => (th >= 1 && th <= MAX_KEEP ? hatchLevel(botBase(th)) : 0);
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

// ---- Castle 4 unlocks (the owner, Oct 22 2026: "Level 4 is where the user unlocks raids and other items such as wizard
// and knight"): attacking and scouting the computer's realms open at Castle level ATTACK_AT, and then only the realms up
// to a level above your Castle's (canTarget). The computer raiding you starts at Castle DEFEND_AT (realm-battle.js defend;
// the owner, Oct 22 2026: level 3, was 2).
export const ATTACK_AT = 4, DEFEND_AT = 3;
const botOf = bot => (typeof bot === 'string' ? BOTS.find(b => b.k === bot) : bot && BOTS.find(b => b.k === bot.k)) || null;
/** Whether realm s can attack (and scout) at all: its Castle at ATTACK_AT or higher. */
export const attackOpen = s => !!(s && Array.isArray(s.b)) && keepOf(s) >= ATTACK_AT;
/** The Castle level a computer realm (a BOTS entry or its key) can be attacked from: ATTACK_AT, or a level below its own. */
export const targetAt = bot => { const b = botOf(bot); return b ? Math.max(ATTACK_AT, b.th - 1) : Infinity; };
/** Whether realm s may attack that computer realm now: attacks open, and its level no more than one above s's Castle. */
export const canTarget = (s, bot) => { const b = botOf(bot); return !!b && attackOpen(s) && b.th <= keepOf(s) + 1; };
/** Why s can't attack that realm ('' when it can): "Raids open at Castle level 4" before then, "Castle level N" for a
 *  realm too strong yet (N: targetAt), or that it isn't there. For scouting (scout: true), only the first. */
export function attackWhy(s, bot, {scout = false} = {}) {
  const b = botOf(bot);
  if (!b) return 'That realm isn’t there.';
  if (!attackOpen(s)) return `Raids open at Castle level ${ATTACK_AT}`;
  if (!scout && !canTarget(s, b)) return `Castle level ${targetAt(b)}`;
  return '';
}

/** A realm you can scout or attack, by its key: {key, name, th, base, loot} or {why, locked}. The computer's, for now
 *  (Keepfall is the owner's alone: no one else's realm is anywhere in it). mine: the realm doing it; when it's given,
 *  Castle 4's rule holds (attackWhy: refused with locked: true before Castle 4 and, unless scout, for a realm out of
 *  reach); without it (null: the checks, a look at a lot), any realm. */
export function realmOf(key, mine, now = Date.now(), {scout = false} = {}) {
  const bot = BOTS.find(b => b.k === key);
  if (!bot) return {why: 'That realm isn’t there.'};
  if (mine && Array.isArray(mine.b)) { const why = attackWhy(mine, bot, {scout}); if (why) return {why, locked: true}; }
  const base = botBase(bot.th);
  return {key, name: bot.name, th: bot.th, base, loot: botLoot(bot, base, mine, now)};
}

// ---------------------------------------------------------------------------------------------------- replays
// Raid replays (the owner, Oct 22 2026: "Provide raid replays of both being raided and attacking another player"). A
// battle is deterministic (core/realm-battle.js: the same lot, take, army and drops play out the same every time), so a
// record keeps what it needs to be played again, as rp. The realm rides on the owner's board doc, which every phone in
// the league downloads on each save, so rp is small: a few short text fields, the numbers packed (varints, base64url),
// never an object or a number a building:
//   rp = {v: RP_V, bv: battleMark() (the battle's rules it was played under), p: the packed raid (the step it ended on,
//     the army that marched, the heroes on each side, each building's take, the drops), and the lot it was played on:
//     L: 'b<th>.<hash>' (a computer realm's lot, botBase(th): rebuilt, not kept, and the hash says it's still the same),
//     or L: <key> (one of his lots, kept once in the realm's lots, {key: packed lot}: the raids on his realm and the
//     examples mostly share one), or b: the packed lot itself (a replay made with no realm to keep it in); sc (the
//     defending realm's scenery, for raids on his)}
// snapOf(B) makes one from a battle played out; decodeReplay(rp, s) / replayOf(rec, s) turn it back into what makeBattle
// and replay take (s: the realm whose lots it may point at). Only the newest RP_KEEP of each list (rd: his attacks, df:
// the raids on his) keep theirs, and the lots no replay points at go (gcLots); older records, and every record from
// before replays, have none. Example raids (realm-battle.js exampleRaids) live in s.ex, flagged ex: true, every one with
// its replay. A replay played under other rules than today's (a stat changed, or BATTLE_V) is kept but not shown: it
// would no longer play out as the raid did.
// Versions (Oct 22 2026, the Dragon Hero): rp.v says how p is packed and so which rules it was played under (RP_RULES):
// v 2, every replay made before the Dragon Hero, packs the five troops then trained and the Knight and Wizard Heroes
// (RULES[1]) and plays again under those rules (the Wizard, the trained Dragon, the computer's lots as they were then:
// botBase(th, 1)), checked by their mark (battleMark(1), the same mark they were made with); v 3, from then on, packs
// today's (RULES[2]: four troops, the Knight and Dragon Heroes). decodeReplay hands the battle the rules (opts.rules).
export const RP_V = 3, RP_KEEP = 10, EX_V = 1, EX_MAX = 3;
const RP_RULES = Object.freeze({2: 1, 3: 2});
/** Bump it with any change to how a raid plays out in core/realm-battle.js (its steps, targeting, paths, shots, the
 *  end): the replays recorded before then stop showing their ▶. (The stats here are in battleMark by themselves.) 2 from
 *  Oct 22 2026 (a flying hero); a rule set's own (RULES[v].battle) goes in its mark, so the replays made under 1 keep
 *  theirs. */
export const BATTLE_V = 2;
// (fixed: a kind or unit added later goes on the end, so an old replay still reads the same)
const RP_KINDS = Object.freeze(['keep', 'hut', 'mine', 'farm', 'treasury', 'granary', 'barracks', 'camp', 'hatchery', 'cannon', 'ballista', 'tower', 'trebuchet', 'cauldron', 'wall']);
const RP_UNITS = Object.freeze(['footman', 'archer', 'knight', 'thief', 'dragon', 'hero_knight', 'hero_wizard', 'hero_dragon']);
const isInt = v => Number.isInteger(v);
const heroMap = (h, v = RULES_V) => Object.fromEntries(rulesOf(v).heroes.filter(k => h && isInt(h[k]) && h[k] >= 1 && h[k] <= 10).map(k => [k, h[k]]));
// ---- packing: numbers as varints (zigzag for the ones that can go down), the bytes as base64url text
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_AT = Object.fromEntries([...B64].map((c, i) => [c, i]));
const RP_TEXT = /^[A-Za-z0-9_-]*$/, LOT_MAX = 12000;
function toB64(a) {
  let o = '';
  for (let i = 0; i < a.length; i += 3) {
    const n = (a[i] << 16) | ((a[i + 1] || 0) << 8) | (a[i + 2] || 0), k = a.length - i;
    o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (k > 1 ? B64[(n >> 6) & 63] : '') + (k > 2 ? B64[n & 63] : '');
  }
  return o;
}
function fromB64(t) {
  if (typeof t !== 'string' || !RP_TEXT.test(t) || t.length % 4 === 1) return null;
  const a = [];
  for (let i = 0; i < t.length; i += 4) {
    const c = [0, 1, 2, 3].map(j => (i + j < t.length ? B64_AT[t[i + j]] : -1));
    const n = (c[0] << 18) | (c[1] << 12) | (Math.max(0, c[2]) << 6) | Math.max(0, c[3]);
    a.push((n >> 16) & 255);
    if (c[2] >= 0) a.push((n >> 8) & 255);
    if (c[3] >= 0) a.push(n & 255);
  }
  return a;
}
function writer() {
  const a = [];
  const uv = v => { v = Math.max(0, Math.floor(v)); while (v >= 128) { a.push((v % 128) | 128); v = Math.floor(v / 128); } a.push(v); };
  return {a, uv, u8: v => a.push(v & 255), sv: v => uv(v < 0 ? -2 * v - 1 : 2 * v)};
}
function reader(a) {
  let i = 0, bad = !a;
  const u8 = () => { if (bad || i >= a.length) { bad = true; return 0; } return a[i++]; };
  const uv = () => { let v = 0, m = 1; for (let k = 0; k < 8; k++) { const b = u8(); v += (b & 127) * m; if (!(b & 128)) return v; m *= 128; } bad = true; return 0; };
  return {u8, uv, sv: () => { const v = uv(); return v % 2 ? -(v + 1) / 2 : v / 2; }, get bad() { return bad; }, get end() { return !bad && i === a.length; }};
}
/** A short, stable hash of a text (FNV-1a, 32 bits, in base 36, with the text's length). */
function hashOf(t) {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36) + t.length.toString(36);
}
/** A lot (its standing buildings in the battle's order, {i, t, l, x, y}) packed, or '' when it isn't one. */
function packLot(list) {
  const w = writer();
  w.uv(list.length);
  let pi = 0;
  for (const e of list) {
    const k = RP_KINDS.indexOf(e.t);
    if (k < 0 || ![e.i, e.l, e.x, e.y].every(isInt) || e.i < 0 || e.l < 1 || e.l > 16 || e.x < 0 || e.y < 0) return '';
    w.sv(e.i - pi); pi = e.i;
    w.u8(k * 16 + e.l - 1); w.uv(e.x); w.uv(e.y);
  }
  return toB64(w.a);
}
/** A packed lot back as buildings ({i, t, l, x, y, u: 0}), or null when it isn't one that fits the lot. */
function unpackLot(t) {
  if (typeof t !== 'string' || !t || t.length > LOT_MAX) return null;
  const r = reader(fromB64(t)), n = r.uv(), b = [], seen = new Set();
  if (r.bad || n < 1 || n > 1000) return null;
  let i = 0;
  for (let j = 0; j < n; j++) {
    i += r.sv();
    const kl = r.u8(), x = r.uv(), y = r.uv(), kind = RP_KINDS[kl >> 4], l = (kl & 15) + 1;
    if (r.bad || !kind || l > maxLevel(kind) || i < 0 || seen.has(i) || x + KINDS[kind].size > N || y + KINDS[kind].size > N) return null;
    seen.add(i);
    b.push({i, t: kind, l, x, y, u: 0});
  }
  return r.end ? b : null;
}
// (the computer's lots, packed: botBase is the same every day, so a replay of an attack keeps only which one; under each
// rule set, RULES: a replay recorded before Oct 22 2026 was played on the lot as it was then)
const BOT_LOTS = {};
const botLots = (v = RULES_V) => BOT_LOTS[v] || (BOT_LOTS[v] = new Map(BOTS.map(x => [x.th, packLot(botBase(x.th, v).b.filter(b => b.l >= 1))])));
const botLotOf = text => { for (const [th, t] of botLots()) if (t === text) return th; return 0; };
// (a his-lot replay's key; a lot kept once in the realm, whichever records point at it)
const isBotRef = L => /^b[1-9]\.[0-9a-z]+$/.test(L);
function putLot(s, text) {
  if (!s.lots || typeof s.lots !== 'object' || Array.isArray(s.lots)) s.lots = {};
  const k0 = hashOf(text);
  for (let n = 0; n < 50; n++) {
    const k = n ? `${k0}x${n}` : k0;
    if (s.lots[k] === text || s.lots[k] == null) { s.lots[k] = text; return k; }
  }
  return '';
}
const MARK = {};
/** The battle's rules as a short mark (BATTLE_V, the lot's size, the clock, every stat a raid reads): a replay played
 *  under another mark wouldn't play out as the raid did. v: the rule set (RULES; today's by default): under 1, the mark
 *  every replay made before Oct 22 2026 carries (its battle version, its heroes' stats: the Knight's and the Wizard's,
 *  and the same buildings and troops, the trained Dragon among them, which is why TROOPS.dragon stays as it was). */
export function battleMark(v = RULES_V) {
  v = RULES[v] ? Number(v) : RULES_V;
  if (MARK[v]) return MARK[v];
  const skip = new Set(['name', 'blurb', 'cost', 'time', 'pay', 'th', 'at']), R = rulesOf(v);
  const rules = {v: v === RULES_V ? BATTLE_V : R.battle, N, RAID_S, KINDS, TROOPS, heroes: R.heroes.map(k => Array.from({length: 10}, (_, l) => heroStat(k, l + 1, v)))};
  MARK[v] = hashOf(JSON.stringify(rules, (k, x) => (skip.has(k) ? undefined : x)));
  return MARK[v];
}
/**
 * A battle played out (core/realm-battle.js makeBattle's B, over or ended) as a record's replay, rp; null when it isn't
 * one. o.sc: the defending realm's scenery (a raid on his); o.into: the realm a lot that isn't one of the computer's is
 * kept in (its lots, once: the replay points at it), else the replay carries it (b). (For backward calls, o may be the
 * scenery's id.) B may be a battle called off part way (realm-battle.js's examples: its drops to then, step then).
 */
export function snapOf(B, o = {}) {
  if (typeof o === 'string') o = {sc: o};
  o = o || {};
  if (!B || !Array.isArray(B.bl) || !Array.isArray(B.drops) || !isInt(B.step) || B.step < 0) return null;
  const lot = packLot(B.bl);
  if (!lot) return null;
  // (packed as today's rules have it, RP_V: a battle played under older rules, a replay's, isn't one to keep again)
  if (B.rules && B.rules !== RULES_V) return null;
  const w = writer();
  w.uv(B.step);
  TROOP_ORDER.forEach(t => w.uv(((B.left && B.left[t]) || 0) + ((B.used && B.used[t]) || 0)));
  const h = heroMap(B.heroes), dh = heroMap(Object.fromEntries((B.defenders || []).map(u => [u.hero, u.level])));
  HERO_ORDER.forEach(k => w.uv(h[k] || 0));
  HERO_ORDER.forEach(k => w.uv(dh[k] || 0));
  const take = v => Math.max(0, Math.floor(Number(v) || 0));
  const lo = B.bl.filter(e => e.loot && (take(e.loot.gold) || take(e.loot.grain)));
  w.uv(lo.length);
  let pi = 0;
  lo.forEach(e => { w.sv(e.i - pi); pi = e.i; w.uv(take(e.loot.gold)); w.uv(take(e.loot.grain)); });
  w.uv(B.drops.length);
  let ps = 0, px = 0, py = 0;
  for (const d of B.drops) {
    const u = RP_UNITS.indexOf(d[1]);
    if (u < 0 || ![d[0], d[2], d[3]].every(isInt) || d[0] < ps || d[2] < 0 || d[3] < 0) return null;
    w.uv(d[0] - ps); w.u8(u); w.sv(d[2] - px); w.sv(d[3] - py);
    ps = d[0]; px = d[2]; py = d[3];
  }
  const rp = {v: RP_V, bv: battleMark(), p: toB64(w.a)}, th = botLotOf(lot);
  if (th) rp.L = `b${th}.${hashOf(lot)}`;
  else if (o.into && typeof o.into === 'object') { const k = putLot(o.into, lot); if (!k) return null; rp.L = k; }
  else rp.b = lot;
  if (o.sc && typeof o.sc === 'string') rp.sc = o.sc;
  return rp;
}
/** A replay read whole (whatever rules it was played under), or null when it's broken: {b: the lot, rules (RULES: the
 *  ones its packing says it was played under, RP_RULES), rest}. s: the realm whose lots it may point at. */
function readReplay(p, s) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || !RP_RULES[p.v] || typeof p.bv !== 'string' || typeof p.p !== 'string' || p.p.length > 8000) return null;
  const rules = RP_RULES[p.v], Ru = rulesOf(rules);
  let b = null, bot = 0;
  if (typeof p.L === 'string') {
    if (isBotRef(p.L)) { bot = Number(p.L[1]); b = []; }
    else { const t = s && s.lots && typeof s.lots === 'object' ? s.lots[p.L] : null; b = unpackLot(t); }
  } else if (typeof p.b === 'string') b = unpackLot(p.b);
  if (!b) return null;
  const r = reader(fromB64(p.p)), end = r.uv(), army = {}, hr = {}, dh = {};
  Ru.troops.forEach(t => { const n = r.uv(); if (n > 0) army[t] = n; });
  Ru.heroes.forEach(k => { const l = r.uv(); if (l >= 1 && l <= 10) hr[k] = l; });
  Ru.heroes.forEach(k => { const l = r.uv(); if (l >= 1 && l <= 10) dh[k] = l; });
  const by = {}, total = {gold: 0, grain: 0}, nl = r.uv();
  if (r.bad || nl > 1000) return null;
  let i = 0;
  for (let j = 0; j < nl; j++) {
    i += r.sv();
    const g = r.uv(), a = r.uv();
    if (r.bad || by[i]) return null;
    by[i] = {gold: g, grain: a}; total.gold += g; total.grain += a;
  }
  const nd = r.uv(), drops = [];
  if (r.bad || nd > 5000) return null;
  let st = 0, x = 0, y = 0;
  for (let j = 0; j < nd; j++) {
    st += r.uv();
    const u = RP_UNITS[r.u8()];
    x += r.sv(); y += r.sv();
    if (r.bad || !u || x < 0 || y < 0) return null;
    drops.push([st, u, x, y]);
  }
  if (!r.end) return null;
  return {b, bot, rules, end, army, hr, dh, loot: {by, total}, drops, sc: typeof p.sc === 'string' && SCENERIES.some(q => q.k === p.sc) ? p.sc : ''};
}
/** Whether rp reads whole (the lot it points at kept in s): what a save keeps (clean, keepReplays). */
const rpWhole = (p, s) => !!readReplay(p, s);
/**
 * A replay's data (rp, snapOf's) as the battle engine takes it, or null when it isn't one, or was played under other
 * rules than today's (battleMark; a computer's lot that's since changed): s, the realm whose lots it may point at.
 *   {base: {b: [{i, t, l, x, y, u: 0}], hr: the defending heroes, r, sc?} (the lot as it was: draw it, and battle it),
 *    loot: {by: {id: {gold, grain}}, total}, army: {troop: n}, drops: [[step, troop, x*10, y*10]], hr: the raider's
 *    heroes, dh: the defenders', end (the step it ended on), dur (its length, seconds), sc (scenery, or ''), rules (the
 *    rule set it was played under, RULES: 1 for one made before the Dragon Hero), opts: {heroes: hr, defenders: dh, end,
 *    rules} (makeBattle's and replay's options)}
 * Pure and for anyone (the checks); views use replayOf(rec, s), the owner's alone.
 */
export function decodeReplay(p, s = null) {
  const R = readReplay(p, s);
  if (!R || p.bv !== battleMark(R.rules)) return null;
  let b = R.b;
  if (R.bot) {
    const t = botLots(R.rules).get(R.bot);
    if (!t || p.L !== `b${R.bot}.${hashOf(t)}`) return null;
    b = unpackLot(t);
    if (!b) return null;
  }
  const ids = new Set(b.map(x => x.i));
  if (Object.keys(R.loot.by).some(i => !ids.has(Number(i)))) return null;
  const base = {b, hr: R.dh, r: {gold: 0, grain: 0}};
  if (R.sc) base.sc = R.sc;
  // (dur: a step is a tenth of a second, realm-battle.js DT)
  return {base, loot: R.loot, army: R.army, drops: R.drops, hr: R.hr, dh: R.dh, end: R.end, dur: R.end / 10, sc: R.sc, rules: R.rules,
    opts: {heroes: R.hr, defenders: R.dh, end: R.end, rules: R.rules}};
}
/** Whether a record has a replay to watch (its rp reads back under today's rules: decodeReplay). For the log's ▶. s:
 *  the realm it's on (its lots), the owner's in memory when not given. */
export const hasReplay = (rec, s = MINE) => !!(rec && rec.rp && decodeReplay(rec.rp, s));
/** A record's replay (decodeReplay of its rp, s's lots), on the owner's phone; null elsewhere or when it has none. */
export const replayOf = (rec, s = MINE) => (mayPlay() && rec && rec.rp ? decodeReplay(rec.rp, s) : null);
/** Keeps rp on the newest RP_KEEP records of a list (the end of it) and drops it, or a broken one, from the rest. s: the
 *  realm the list is on (its lots). Mutates the records; returns the list. */
export function keepReplays(list, s = null) {
  if (!Array.isArray(list)) return [];
  list.forEach((r, j) => { if (r && r.rp && (j < list.length - RP_KEEP || !rpWhole(r.rp, s))) delete r.rp; });
  return list;
}
/** The lots no replay points at any more, gone (and lots itself, when that's all of them). Mutates s. */
export function gcLots(s) {
  if (!s || typeof s !== 'object') return;
  if (!s.lots || typeof s.lots !== 'object' || Array.isArray(s.lots)) { delete s.lots; return; }
  const used = new Set();
  ['rd', 'df', 'ex'].forEach(k => (Array.isArray(s[k]) ? s[k] : []).forEach(r => { const L = r && r.rp && r.rp.L; if (typeof L === 'string' && !isBotRef(L)) used.add(L); }));
  Object.keys(s.lots).forEach(k => { if (!used.has(k) || typeof s.lots[k] !== 'string') delete s.lots[k]; });
  if (!Object.keys(s.lots).length) delete s.lots;
}
/** A record by its id, from the raids on his realm (df), his attacks (rd) or the example raids (ex): {rec, kind: 'df' |
 *  'rd' | 'ex'}, or null. */
export function findRaid(s, id) {
  if (!s || typeof id !== 'string' || !id) return null;
  for (const kind of ['df', 'rd', 'ex']) {
    const rec = Array.isArray(s[kind]) ? s[kind].find(r => r && r.id === id) : null;
    if (rec) return {rec, kind};
  }
  return null;
}
/** Puts example raids on s (s.ex, the newest EX_MAX; s.exv = EX_V), each record's lot from lots (the realm they were
 *  played on: realm-battle.js exampleRaids, which may play them on a copy) kept in s's. Mutates s; returns s.ex. */
export function putExamples(s, recs, lots = null) {
  const out = [];
  (recs || []).forEach(r => {
    if (!r || !r.rp) return;
    const rec = copy(r), L = rec.rp.L;
    if (typeof L === 'string' && !isBotRef(L)) {
      const t = lots && typeof lots[L] === 'string' ? lots[L] : (s.lots && s.lots[L]);
      const k = t ? putLot(s, t) : '';
      if (!k) return;
      rec.rp.L = k;
    }
    out.push(rec);
  });
  s.ex = out.slice(-EX_MAX);
  if (!s.ex.length) delete s.ex;
  s.exv = EX_V;
  gcLots(s);
  return s.ex || [];
}
/** Clears the example raids (s.ex), leaving them cleared: they aren't made again by themselves (exv stays). Mutates s;
 *  true if there were any. Touches nothing else (but the lots only they pointed at). */
export function clearExamples(s) {
  if (!s) return false;
  const had = Array.isArray(s.ex) && s.ex.length > 0;
  delete s.ex;
  s.exv = EX_V;
  gcLots(s);
  return had;
}
/** When sync takes a newer copy of the realm from the board (remote) over this phone's (local): what of this phone's to
 *  keep. The example raids, when the newer copy was saved by a phone that never had them (no exv: one still on an older
 *  version of the app, or one that hadn't made them yet), and a record's replay the newer copy lacks; each with the lot
 *  it points at. Mutates remote; true if it kept anything (the realm's to be saved again, with them). */
export function keepMine(remote, local) {
  if (!remote || !local || remote === local) return false;
  let kept = false;
  // (the lot a replay points at, from this phone's lots into the newer copy's; false when they'd clash)
  const lot = rp => {
    const L = rp && rp.L;
    if (typeof L !== 'string' || isBotRef(L)) return !!rp;
    const t = local.lots && local.lots[L];
    if (typeof t !== 'string') return false;
    if (remote.lots && remote.lots[L] != null) return remote.lots[L] === t;
    if (!remote.lots || typeof remote.lots !== 'object' || Array.isArray(remote.lots)) remote.lots = {};
    remote.lots[L] = t;
    return true;
  };
  if (!('exv' in remote) && local.exv === EX_V && Array.isArray(local.ex) && local.ex.length) {
    const ex = local.ex.filter(r => r && r.rp && lot(r.rp)).map(copy);
    if (ex.length) { remote.ex = ex; remote.exv = local.exv; kept = true; }
  }
  ['rd', 'df'].forEach(k => {
    if (!Array.isArray(remote[k])) return;
    const had = new Map((Array.isArray(local[k]) ? local[k] : []).filter(r => r && r.rp && typeof r.id === 'string').map(r => [r.id, r]));
    const got = new Set(), list = remote[k];
    // (only where the newer copy would keep one: its newest RP_KEEP)
    list.forEach((r, j) => { const m = j >= list.length - RP_KEEP && r && !r.rp && had.get(r.id); if (m && lot(m.rp)) { r.rp = copy(m.rp); got.add(r); } });
    remote[k] = keepReplays(list, remote);
    if (remote[k].some(r => got.has(r) && r.rp)) kept = true;
  });
  gcLots(remote);
  return kept;
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
/** The testing realm (TEST_RESET): a fresh one at Castle level 1, marked tst, with old's house name and scenery. */
export function testRealm(old, now = Date.now()) {
  const s = fresh(now);
  s.rs = TEST_RESET; s.tst = 1;
  if (old) { s.nm = old.nm || ''; if (old.sc) s.sc = old.sc; }
  return s;
}
// (a realm saved before the reset is never taken up again, here or from the board)
const current = s => (s && s.rs === TEST_RESET ? s : null);
// A phone still on the previous release must not hide another phone's new progress.
const currentRemote = () => clean(freshest(myDocs().filter(p => current(p.fr1))));
/** This phone's realm (loaded once: the freshest of this phone's copy and the owner's docs), brought up to now. */
export function mine(now = Date.now()) {
  if (!MINE) {
    const local0 = readLocal(), remote0 = clean(freshest(myDocs()));
    const local = current(local0), remote = currentRemote();
    MINE = (remote && (!local || remote.at > local.at)) ? remote : local;
    // (this phone's example raids and replays the newer copy lacks, kept, and saved again: see sync)
    if (MINE === remote && local && keepMine(remote, local)) { writeLocal(MINE); dirty = true; clearTimeout(saveT); saveT = setTimeout(flush, 1500); }
    if (!MINE) {
      // (started over for testing: kept here at once, on the board as soon as it's known)
      const old = [local0, remote0].filter(Boolean).sort((a, b) => b.at - a.at)[0];
      MINE = testRealm(old, now); PROVISIONAL = !boardKnown();
      if (old) { writeLocal(MINE); dirty = true; }
    }
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
  const remote = currentRemote();
  let kept = false;
  if (remote && (PROVISIONAL || remote.at > s.at + 1000)) {
    // (this phone's example raids and replays the newer copy lacks, kept: one saved by a phone on an older version)
    kept = !PROVISIONAL && keepMine(remote, s);
    MINE = remote; tick(MINE, now); changed = true; writeLocal(MINE);
  }
  if (boardKnown()) { if (PROVISIONAL && !remote) dirty = true; PROVISIONAL = false; }
  if (changed) emit('sync');
  if (kept) touch();
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
