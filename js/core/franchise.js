// The Franchise (the owner's ask, Oct 2026: a Clash of Clans of our own, in the tab at the right): each person runs a
// football franchise on a lot, its Stadium the heart of it. The daily games pay for it: every result posted to the
// board this season (and every one from here on) comes in as Cash and Juice, both, waiting in the front office until
// the vaults and tanks have room. Ticket booths make Cash and Gatorade coolers make Juice while you're away (the mines
// and collectors). Coaches build and upgrade, one job each, on a clock. Juice trains a team at the practice field;
// the team raids another franchise (a league member's, or a computer's) for some of what it has stored.
//
// Where it lives: each phone's board doc (players/{uid}, daily.js), as fr1 (the rules let a phone write only its own
// doc, so everything a raid does to someone else is written on the raider's doc, and the raided phone takes it off
// its own franchise when it next sees it: applyRaids). A person's franchise is the freshest fr1 across their phones.
// THE RULE (CLAUDE.md): the franchises listed, ranked and raidable are the league's (members and Ryan D); a guest's or
// any other app user's franchise is theirs alone (they raid the computer's), and the owner sees every one listed.
// Everything here is plain data and pure functions of it and the clock, except the sync at the bottom.
import * as daily from './daily.js';
import * as data from './data.js';

export const N = 36;               // the lot: N x N tiles
export const EDGE = 2;             // buildings keep this many tiles off the lot's sides
export const HOUR = 3600e3;
export const MAX_STADIUM = 8;
export const SHIELD_H = 12;        // hours a raided franchise can't be raided again
export const RAID_S = 180;         // a raid's clock, seconds
export const CUR = ['cash', 'juice'];
export const CUR_NAME = {cash: 'Cash', juice: 'Juice'};

// ---------------------------------------------------------------------------------------------------- the buildings
// Per level (index level - 1): cost (to build it, then to reach each level), time (seconds), hp, th (the Stadium level
// it needs); and what it does: rate (an hour) and hold (hours of it) for booths and coolers; cap for vaults and
// tanks; store for the Stadium; room (players) for locker rooms; dps, range, every (seconds a shot), splash, min
// for defenses. pay: what it's paid for in. size: tiles square.
const L = (o) => o;
export const KINDS = {
  stadium: L({name: 'Stadium', size: 4, pay: 'cash', role: 'hall',
    blurb: 'The heart of your franchise. Its level decides how many of everything you can build and how far each can go.',
    cost: [0, 2500, 10000, 40000, 120000, 300000, 650000, 1200000],
    time: [0, 60, 900, 3600, 14400, 28800, 57600, 86400],
    hp: [1500, 1700, 2000, 2400, 2900, 3500, 4200, 5000],
    th: [1, 1, 2, 3, 4, 5, 6, 7],
    store: [2500, 5000, 10000, 20000, 40000, 80000, 120000, 160000]}),
  booth: L({name: 'Ticket Booth', size: 3, pay: 'juice', role: 'make', makes: 'cash',
    blurb: 'Sells tickets while you’re away: Cash piles up until you collect it.',
    cost: [150, 300, 700, 1400, 3000, 6000, 12000, 24000, 45000, 80000, 140000, 220000],
    time: [10, 60, 300, 900, 1800, 3600, 7200, 14400, 21600, 36000, 50400, 72000],
    hp: [400, 440, 480, 520, 560, 600, 640, 680, 720, 780, 840, 900],
    th: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    rate: [20, 35, 50, 70, 90, 115, 140, 170, 200, 240, 280, 330], hold: 10}),
  cooler: L({name: 'Gatorade Cooler', size: 3, pay: 'cash', role: 'make', makes: 'juice',
    blurb: 'Mixes Juice while you’re away: it fills until you collect it.',
    cost: [150, 300, 700, 1400, 3000, 6000, 12000, 24000, 45000, 80000, 140000, 220000],
    time: [10, 60, 300, 900, 1800, 3600, 7200, 14400, 21600, 36000, 50400, 72000],
    hp: [400, 440, 480, 520, 560, 600, 640, 680, 720, 780, 840, 900],
    th: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    rate: [20, 35, 50, 70, 90, 115, 140, 170, 200, 240, 280, 330], hold: 10}),
  vault: L({name: 'Vault', size: 3, pay: 'juice', role: 'store', holds: 'cash',
    blurb: 'Holds your Cash. More room means bigger upgrades, and more for raiders to take.',
    cost: [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 180000, 300000],
    time: [10, 120, 600, 1800, 3600, 7200, 14400, 21600, 36000, 57600, 86400],
    hp: [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
    th: [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    cap: [3000, 7500, 15000, 30000, 50000, 80000, 120000, 170000, 240000, 330000, 450000]}),
  tank: L({name: 'Juice Tank', size: 3, pay: 'cash', role: 'store', holds: 'juice',
    blurb: 'Holds your Juice. More room means bigger upgrades, and more for raiders to take.',
    cost: [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 180000, 300000],
    time: [10, 120, 600, 1800, 3600, 7200, 14400, 21600, 36000, 57600, 86400],
    hp: [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
    th: [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8],
    cap: [3000, 7500, 15000, 30000, 50000, 80000, 120000, 170000, 240000, 330000, 450000]}),
  practice: L({name: 'Practice Field', size: 4, pay: 'juice', role: 'train',
    blurb: 'Trains your team with Juice. Each level opens a new position; each field trains alongside the others.',
    cost: [200, 1000, 4000, 12000, 30000, 70000, 140000, 260000],
    time: [10, 300, 1800, 7200, 14400, 28800, 43200, 72000],
    hp: [250, 290, 330, 370, 420, 470, 520, 580],
    th: [1, 2, 3, 4, 5, 6, 7, 8]}),
  locker: L({name: 'Locker Room', size: 4, pay: 'juice', role: 'camp',
    blurb: 'Where your team waits for a raid. Its room is how big a team you can take.',
    cost: [250, 2500, 10000, 40000, 100000, 200000],
    time: [10, 600, 7200, 14400, 28800, 57600],
    hp: [250, 270, 290, 310, 330, 350],
    th: [1, 2, 3, 5, 6, 7],
    room: [20, 30, 35, 40, 45, 50]}),
  office: L({name: 'Coach’s Office', size: 2, pay: 'cash', role: 'coach',
    blurb: 'Each office is a coach: one coach builds or upgrades one thing at a time.',
    cost: [0], time: [10], hp: [250], th: [1]}),
  cannon: L({name: 'T-Shirt Cannon', size: 3, pay: 'cash', role: 'def',
    blurb: 'Fires rolled-up shirts at raiders on the ground, one at a time.',
    cost: [250, 1000, 4000, 10000, 25000, 60000, 120000, 220000, 380000, 600000],
    time: [10, 120, 900, 3600, 10800, 21600, 36000, 57600, 86400, 129600],
    hp: [420, 470, 520, 570, 620, 680, 750, 830, 920, 1020],
    th: [1, 1, 2, 3, 4, 5, 6, 7, 8, 8],
    dps: [9, 11, 15, 19, 25, 31, 40, 48, 56, 64], range: 9, every: .8}),
  pressbox: L({name: 'Press Box', size: 3, pay: 'cash', role: 'def',
    blurb: 'Up on stilts, it reaches farther than anything and picks raiders off.',
    cost: [1000, 2000, 5000, 15000, 35000, 70000, 140000, 250000, 400000, 600000],
    time: [15, 300, 1800, 3600, 10800, 21600, 36000, 57600, 86400, 129600],
    hp: [380, 420, 460, 500, 540, 580, 630, 690, 750, 810],
    th: [2, 2, 3, 4, 5, 5, 6, 7, 8, 8],
    dps: [11, 15, 19, 25, 30, 35, 42, 48, 56, 63], range: 10, every: 1}),
  jugs: L({name: 'JUGS Machine', size: 3, pay: 'cash', role: 'def',
    blurb: 'Lobs footballs a long way into a crowd. Slow, and it can’t hit anyone right next to it.',
    cost: [8000, 20000, 60000, 150000, 300000, 550000],
    time: [600, 3600, 14400, 28800, 57600, 86400],
    hp: [400, 450, 500, 550, 600, 650],
    th: [3, 4, 5, 6, 7, 8],
    dps: [4, 5, 6, 7, 9, 11], range: 11, min: 4, every: 5, splash: 1.5}),
  shower: L({name: 'Gatorade Shower', size: 3, pay: 'cash', role: 'def',
    blurb: 'Dumps the bucket on everyone close by. Short reach, hits a crowd.',
    cost: [60000, 120000, 220000, 360000, 520000, 720000],
    time: [3600, 14400, 28800, 43200, 72000, 108000],
    hp: [620, 660, 700, 750, 800, 850],
    th: [4, 5, 6, 7, 8, 8],
    dps: [11, 13, 16, 20, 24, 32], range: 7, every: 1.3, splash: 1}),
  fence: L({name: 'Fence', size: 1, pay: 'cash', role: 'wall',
    blurb: 'Keeps raiders out until they break through. Goes up at once, no coach needed.',
    cost: [50, 1000, 5000, 10000, 20000, 40000, 80000, 150000],
    time: [0, 0, 0, 0, 0, 0, 0, 0],
    hp: [300, 500, 700, 900, 1400, 2000, 2500, 3000],
    th: [2, 2, 3, 4, 5, 6, 7, 8]})
};
export const ORDER = ['stadium', 'office', 'booth', 'cooler', 'vault', 'tank', 'practice', 'locker', 'cannon', 'pressbox', 'jugs', 'shower', 'fence'];
// How many of each a Stadium level allows (index stadium level - 1).
export const COUNT = {
  stadium: [1, 1, 1, 1, 1, 1, 1, 1],
  office: [2, 2, 3, 3, 4, 4, 5, 5],
  booth: [1, 2, 3, 4, 5, 6, 6, 6],
  cooler: [1, 2, 3, 4, 5, 6, 6, 6],
  vault: [1, 1, 2, 2, 2, 3, 4, 4],
  tank: [1, 1, 2, 2, 2, 3, 4, 4],
  practice: [1, 2, 2, 3, 3, 3, 4, 4],
  locker: [1, 1, 2, 2, 3, 3, 4, 4],
  cannon: [2, 2, 2, 3, 3, 4, 5, 5],
  pressbox: [0, 1, 1, 2, 3, 3, 4, 5],
  jugs: [0, 0, 1, 1, 1, 2, 3, 3],
  shower: [0, 0, 0, 1, 2, 2, 3, 3],
  fence: [0, 25, 50, 75, 100, 125, 175, 225]
};
// A coach's office costs more the more you have (the first comes with the franchise).
export const OFFICE_COST = [0, 1000, 10000, 50000, 150000];
export const maxLevel = k => KINDS[k].cost.length;
/** A kind's numbers at a level (1 up). */
export function stat(k, l) {
  const K = KINDS[k], i = Math.max(0, Math.min(K.cost.length, l) - 1), o = {hp: K.hp[i]};
  if (K.role === 'make') { o.rate = K.rate[i]; o.hold = K.rate[i] * K.hold; }
  if (K.role === 'store') o.cap = K.cap[i];
  if (K.role === 'hall') o.store = K.store[i];
  if (K.role === 'camp') o.room = K.room[i];
  if (K.role === 'def') Object.assign(o, {dps: K.dps[i], range: K.range, every: K.every, splash: K.splash || 0, min: K.min || 0});
  return o;
}

// ---------------------------------------------------------------------------------------------------- the team
// hp, dps, speed (tiles a second), range (tiles), room (locker room space), cost (Juice), time (seconds to train), at
// (the practice field level that opens it), aim (what it goes for first: any building, defenses, fences, or where the
// money is). A fullback's blast breaks fences (blast, once, then he's done); a mascot does double to money buildings; a
// kicker's kick lands on everything round where it lands (splash).
export const TROOPS = {
  receiver: {name: 'Receiver', hp: 50, dps: 9, speed: 2, range: .6, room: 1, cost: 25, time: 5, at: 1, aim: 'any',
    blurb: 'Quick and cheap. Goes for whatever’s closest.'},
  qb: {name: 'Quarterback', hp: 22, dps: 8, speed: 2.2, range: 3.5, room: 1, cost: 50, time: 6, at: 2, aim: 'any',
    blurb: 'Throws from range, over fences. Can’t take a hit.'},
  lineman: {name: 'Lineman', hp: 320, dps: 12, speed: 1.2, range: .8, room: 5, cost: 250, time: 30, at: 3, aim: 'def',
    blurb: 'Big and slow. Ignores everything but the defenses, and soaks up their fire.'},
  fullback: {name: 'Fullback', hp: 24, dps: 0, blast: 260, speed: 2.4, range: .5, room: 2, cost: 600, time: 15, at: 4, aim: 'wall',
    blurb: 'Lead blocks straight into a fence and blows a hole in it (he’s done after).'},
  mascot: {name: 'Mascot', hp: 30, dps: 11, speed: 3, range: .5, room: 1, cost: 40, time: 7, at: 5, aim: 'loot',
    blurb: 'Goes for the money: booths, coolers, vaults and tanks, double damage on them.'},
  kicker: {name: 'Kicker', hp: 75, dps: 50, speed: 1.5, range: 3, room: 4, cost: 1200, time: 40, at: 6, aim: 'any', splash: .5,
    blurb: 'Boots it from range and hits everything where it lands.'}
};
export const TROOP_ORDER = ['receiver', 'qb', 'lineman', 'fullback', 'mascot', 'kicker'];

// ---------------------------------------------------------------------------------------------------- what the games pay
// Each day's result, in Cash and in Juice alike (a strong day across the five games is about 12,000 of each).
export const PAY = {
  puzzles: e => 400 + 5 * Math.max(0, Math.min(600, Number(e.p) || 0)),
  '17-0': e => 400 + 150 * e.w + (e.w === 17 ? 500 : 0),
  drill: e => (e.r === 'W' ? 3000 : e.r === 'T' ? 2000 : 1000),
  kick: e => 400 + 200 * Math.min(15, e.m),
  return: e => 400 + Math.min(3000, 3 * e.y)
};
export const GAME_NAME = {puzzles: 'Daily Puzzles', '17-0': '17–0', drill: 'Two-Minute Drill', kick: 'Kick It', return: 'Return Man'};
const STARTER = 1500; // (of each, for a new franchise, on top of what its games have paid)

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
  // Daily Puzzles: docs' days (scored, one per member per day: daily.js)
  const pz = new Map();
  docs.forEach(p => Object.keys((p && p.days) || {}).forEach(k => {
    const e = p.days[k], t = Number(e && e.t) || 0, was = pz.get(k);
    if (e && (!was || t < was.t)) pz.set(k, {e, t});
  }));
  const pnum = daily.PNUM;
  pz.forEach(({e}, k) => add('puzzles', PAY.puzzles(e), Number(k) === pnum));
  // The others: each core's own reading of its entries
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

// ---------------------------------------------------------------------------------------------------- a franchise
// State: {v, at (saved, ms), b: [{i, t (kind), l (level; 0 while first going up), x, y (its top-left tile), u (when the
// job on it is done, ms; 0: none), c (booths and coolers: when what's in it started piling up, ms)}], r: {cash, juice}
// (stored), cl: {cash, juice} (taken from the front office so far), xo: {cash, juice} (into the front office besides
// the games: the starter, raids' overflow), ar: {troop: n} (the team in the locker rooms), q: [[troop, n]] (training),
// qs (when the first in line started, ms), tp (trophies), ap: [raid ids taken off], rd: [raids made], bt: {bot: day
// raided}, nb (the next building id), born (ms)}.
export function fresh(now = Date.now()) {
  const b = [
    {i: 1, t: 'stadium', l: 1, x: 16, y: 16, u: 0},
    {i: 2, t: 'office', l: 1, x: 17, y: 12, u: 0},
    {i: 3, t: 'booth', l: 1, x: 11, y: 16, u: 0, c: now},
    {i: 4, t: 'cooler', l: 1, x: 22, y: 16, u: 0, c: now},
    {i: 5, t: 'cannon', l: 1, x: 17, y: 21, u: 0}
  ];
  return {v: 1, at: now, born: now, b, r: {cash: 0, juice: 0}, cl: {cash: 0, juice: 0}, xo: {cash: STARTER, juice: STARTER},
    ar: {}, q: [], qs: 0, tp: 0, ap: [], rd: [], bt: {}, nb: 6};
}
const copy = s => JSON.parse(JSON.stringify(s));
/** A franchise from storage, made whole (missing fields, bad numbers), or null when it isn't one. */
export function clean(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.b)) return null;
  const o = copy(s);
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  o.v = 1; o.at = num(o.at); o.born = num(o.born) || o.at;
  o.b = o.b.filter(b => b && KINDS[b.t] && Number.isInteger(b.x) && Number.isInteger(b.y)).map(b => ({i: num(b.i), t: b.t, l: Math.max(0, Math.min(maxLevel(b.t), num(b.l) | 0)), x: b.x, y: b.y, u: num(b.u), ...(KINDS[b.t].role === 'make' ? {c: num(b.c)} : {})}));
  if (!o.b.some(b => b.t === 'stadium')) return null;
  ['r', 'cl', 'xo'].forEach(f => { o[f] = {cash: Math.max(0, num(o[f] && o[f].cash)), juice: Math.max(0, num(o[f] && o[f].juice))}; });
  o.ar = Object.fromEntries(Object.entries(o.ar || {}).filter(([t, n]) => TROOPS[t] && num(n) > 0).map(([t, n]) => [t, num(n) | 0]));
  o.q = (Array.isArray(o.q) ? o.q : []).filter(x => Array.isArray(x) && TROOPS[x[0]] && num(x[1]) > 0).map(([t, n]) => [t, num(n) | 0]);
  o.qs = num(o.qs); o.tp = num(o.tp);
  o.ap = Array.isArray(o.ap) ? o.ap.filter(x => typeof x === 'string').slice(-300) : [];
  o.rd = Array.isArray(o.rd) ? o.rd.filter(r => r && typeof r.id === 'string') : [];
  o.bt = o.bt && typeof o.bt === 'object' ? o.bt : {};
  o.nb = Math.max(num(o.nb), ...o.b.map(b => b.i + 1), 1);
  return o;
}
/** The box the buildings stand in (tiles), for framing the lot. */
export function boxOf(s) {
  if (!s.b.length) return {x0: N / 2 - 4, y0: N / 2 - 4, x1: N / 2 + 4, y1: N / 2 + 4};
  const x0 = Math.min(...s.b.map(b => b.x)), y0 = Math.min(...s.b.map(b => b.y));
  const x1 = Math.max(...s.b.map(b => b.x + KINDS[b.t].size)), y1 = Math.max(...s.b.map(b => b.y + KINDS[b.t].size));
  return {x0, y0, x1, y1};
}
export const stadiumOf = s => { const h = s.b.find(b => b.t === 'stadium'); return h ? Math.max(1, h.l) : 1; };
/** The highest level kind k can go to at this Stadium level. */
export function topLevel(k, th) {
  const K = KINDS[k];
  if (k === 'stadium') return MAX_STADIUM;
  let top = 0;
  K.th.forEach((need, i) => { if (need <= th) top = i + 1; });
  return k === 'office' ? 1 : top;
}
export const countOf = (s, k) => s.b.filter(b => b.t === k).length;
export const allowed = (s, k) => COUNT[k][stadiumOf(s) - 1] || 0;
const busy = (b, now) => b.u > now;
/** Booths and coolers: what's piled up in one now (nothing while it's going up or being upgraded). */
export function made(b, now = Date.now()) {
  const K = KINDS[b.t];
  if (K.role !== 'make' || b.l < 1 || busy(b, now)) return 0;
  const st = stat(b.t, b.l);
  return Math.max(0, Math.min(st.hold, Math.floor(st.rate * (now - (b.c || now)) / HOUR)));
}
/** Room for each currency: the Stadium's store and the vaults' or tanks' caps (one being upgraded holds its level's). */
export function capOf(s) {
  const o = {cash: 0, juice: 0};
  s.b.forEach(b => {
    if (b.l < 1) return;
    const K = KINDS[b.t], st = stat(b.t, b.l);
    if (K.role === 'hall') { o.cash += st.store; o.juice += st.store; }
    if (K.role === 'store') o[K.holds] += st.cap;
  });
  return o;
}
/** Coaches: how many there are (offices up) and how many are on a job now. */
export function coaches(s, now = Date.now()) {
  const total = s.b.filter(b => b.t === 'office' && b.l >= 1).length;
  const working = s.b.filter(b => busy(b, now)).length;
  return {total, busy: working, free: Math.max(0, total - working)};
}
export const armyRoom = s => s.b.filter(b => b.t === 'locker' && b.l >= 1).reduce((a, b) => a + stat('locker', b.l).room, 0);
export const roomOf = list => Object.entries(list || {}).reduce((a, [t, n]) => a + TROOPS[t].room * n, 0);
export const queued = s => s.q.reduce((a, [t, n]) => a + TROOPS[t].room * n, 0);
/** Positions the practice fields have opened (the best field's level). */
export const fieldLevel = s => Math.max(0, ...s.b.filter(b => b.t === 'practice').map(b => b.l));
const fields = s => s.b.filter(b => b.t === 'practice' && b.l >= 1 && b.u === 0).length;
/** Seconds one of troop t takes to train now (the fields share the work), Infinity with none. */
export const trainTime = (s, t) => (fields(s) ? TROOPS[t].time / fields(s) : Infinity);

/** Brings a franchise up to now: jobs done (a booth or cooler starts piling up again when its upgrade's done), the
 *  team trained. Mutates s; true if anything changed. */
export function tick(s, now = Date.now()) {
  let changed = false;
  s.b.filter(b => b.u && b.u <= now).sort((a, b) => a.u - b.u).forEach(b => {
    b.l = Math.min(maxLevel(b.t), b.l + 1);
    if (KINDS[b.t].role === 'make') b.c = b.u;
    b.u = 0;
    changed = true;
  });
  // training: one at a time down the line, each taking its time
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
/** The front office: what's waiting there (the games' pay and the rest, less what's been taken into storage). */
export function pending(s, earned) {
  return {cash: Math.max(0, earned + s.xo.cash - s.cl.cash), juice: Math.max(0, earned + s.xo.juice - s.cl.juice)};
}
/** Moves what's waiting in the front office into storage, as far as there's room. Mutates s; returns what moved. */
export function claim(s, earned) {
  const p = pending(s, earned), cap = capOf(s), moved = {cash: 0, juice: 0};
  CUR.forEach(c => {
    const m = Math.max(0, Math.min(p[c], cap[c] - s.r[c]));
    if (m > 0) { s.r[c] += m; s.cl[c] += m; moved[c] = m; }
  });
  return moved;
}
/** Collects a booth or cooler into storage, as far as there's room (the rest stays in it). Returns what came in. */
export function collect(s, id, now = Date.now()) {
  const b = s.b.find(x => x.i === id);
  if (!b || KINDS[b.t].role !== 'make') return 0;
  const c = KINDS[b.t].makes, have = made(b, now), room = Math.max(0, capOf(s)[c] - s.r[c]), take = Math.min(have, room);
  if (take <= 0) return 0;
  s.r[c] += take;
  const rate = stat(b.t, b.l).rate;
  // (what's left stays: the start moves up by what was taken)
  b.c = take >= have ? now : (b.c || now) + take / rate * HOUR;
  return take;
}

// ---- placing, building, upgrading
/** Whether a size x size footprint fits at (x, y): on the lot, clear of everything else (but id). */
export function fits(s, size, x, y, id = null) {
  if (x < EDGE || y < EDGE || x + size > N - EDGE || y + size > N - EDGE) return false;
  return !s.b.some(b => b.i !== id && x < b.x + KINDS[b.t].size && b.x < x + size && y < b.y + KINDS[b.t].size && b.y < y + size);
}
/** Somewhere k fits, nearest the middle of the lot (for a new one, before it's dragged where it goes), or null. */
export function spotFor(s, k, near = null) {
  const sz = KINDS[k].size, c = near || {x: N / 2 - sz / 2, y: N / 2 - sz / 2};
  let best = null, bd = Infinity;
  for (let y = EDGE; y + sz <= N - EDGE; y++) for (let x = EDGE; x + sz <= N - EDGE; x++) {
    const d = (x - c.x) ** 2 + (y - c.y) ** 2;
    if (d < bd && fits(s, sz, x, y)) { bd = d; best = {x, y}; }
  }
  return best;
}
const costOf = (s, k, toLevel) => (k === 'office' ? OFFICE_COST[Math.min(OFFICE_COST.length - 1, countOf(s, 'office'))] : KINDS[k].cost[toLevel - 1]);
/** Whether kind k can be built now: {ok, why, cost, pay, time}. */
export function canBuild(s, k, now = Date.now()) {
  const K = KINDS[k], th = stadiumOf(s), n = countOf(s, k), cap = allowed(s, k);
  const cost = costOf(s, k, 1), o = {ok: false, why: '', cost, pay: K.pay, time: K.time[0]};
  if (k === 'stadium') return Object.assign(o, {why: 'You have one'});
  if (n >= cap) {
    const next = COUNT[k].findIndex(c => c > n);
    return Object.assign(o, {why: next < 0 ? `All ${cap} built` : `Stadium level ${next + 1} for another`});
  }
  if (cost > s.r[K.pay]) return Object.assign(o, {why: `Not enough ${CUR_NAME[K.pay]}`});
  if (K.time[0] > 0 && k !== 'office' && coaches(s, now).free < 1) return Object.assign(o, {why: 'Every coach is busy'});
  if (!spotFor(s, k)) return Object.assign(o, {why: 'No room on the lot'});
  return Object.assign(o, {ok: true, th});
}
/** Builds kind k at (x, y): paid now, up when its time's done (at once for fences and offices). The new building, or
 *  null if it can't. */
export function build(s, k, x, y, now = Date.now()) {
  const K = KINDS[k], chk = canBuild(s, k, now);
  if (!chk.ok || !fits(s, K.size, x, y)) return null;
  s.r[K.pay] -= chk.cost;
  const b = {i: s.nb++, t: k, l: 0, x, y, u: now + K.time[0] * 1000};
  if (!K.time[0] || k === 'office') { b.l = 1; b.u = 0; }
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
  if (to > maxLevel(b.t) || b.t === 'office') return Object.assign(o, {why: 'At its top level'});
  const th = stadiumOf(s);
  if (to > topLevel(b.t, th)) return Object.assign(o, {why: `Needs Stadium level ${K.th[to - 1]}`});
  if (o.cost > s.r[K.pay]) return Object.assign(o, {why: `Not enough ${CUR_NAME[K.pay]}`});
  if (o.time > 0 && coaches(s, now).free < 1) return Object.assign(o, {why: 'Every coach is busy'});
  if (b.t === 'practice' && s.q.length) return Object.assign(o, {why: 'Training’s under way there'});
  return Object.assign(o, {ok: true});
}
/** Starts building id's upgrade (paid now; booths and coolers are collected first and stop while it's under way). */
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
// ---- the team
/** Whether n of troop t can go into training now: {ok, why}. */
export function canTrain(s, t, n = 1) {
  const T = TROOPS[t];
  if (!fields(s)) return {ok: false, why: 'Build a practice field first'};
  if (fieldLevel(s) < T.at) return {ok: false, why: `Practice field level ${T.at}`};
  if (roomOf(s.ar) + queued(s) + T.room * n > armyRoom(s)) return {ok: false, why: armyRoom(s) ? 'The locker rooms are full' : 'Build a locker room first'};
  if (T.cost * n > s.r.juice) return {ok: false, why: 'Not enough Juice'};
  return {ok: true};
}
export function train(s, t, n = 1, now = Date.now()) {
  if (!canTrain(s, t, n).ok) return false;
  s.r.juice -= TROOPS[t].cost * n;
  const last = s.q[s.q.length - 1];
  if (last && last[0] === t) last[1] += n; else s.q.push([t, n]);
  if (!s.qs) s.qs = now;
  return true;
}
/** Takes one of troop t out of training (the last in line), its Juice back. */
export function untrain(s, t, now = Date.now()) {
  for (let i = s.q.length - 1; i >= 0; i--) {
    if (s.q[i][0] !== t) continue;
    s.q[i][1]--;
    s.r.juice += TROOPS[t].cost;
    if (s.q[i][1] <= 0) { s.q.splice(i, 1); if (i === 0) s.qs = s.q.length ? now : 0; }
    return true;
  }
  return false;
}
/** When the line will be done (ms), or 0. */
export function trainedBy(s, now = Date.now()) {
  if (!s.q.length) return 0;
  let t = s.qs || now;
  s.q.forEach(([k, n], i) => { t += trainTime(s, k) * 1000 * n; });
  return t;
}

// ---------------------------------------------------------------------------------------------------- raids
// What a raid can take: from storage, a share of what's stored (up to a cap for the Stadium's level), spread over the
// Stadium, vaults and tanks by how much each holds; from booths and coolers, half of what's piled up in each.
export const STORE_SHARE = .15, MADE_SHARE = .5;
export const LOOT_CAP = [5000, 10000, 20000, 40000, 70000, 100000, 140000, 180000];
/** Each building's take in a raid on s: {bid: {cash, juice}}, and the totals. */
export function lootOf(s, now = Date.now()) {
  const th = stadiumOf(s), by = {}, total = {cash: 0, juice: 0};
  CUR.forEach(c => {
    const stored = Math.min(s.r[c] * STORE_SHARE, LOOT_CAP[th - 1]);
    const holders = s.b.filter(b => b.l >= 1 && (KINDS[b.t].role === 'hall' || (KINDS[b.t].role === 'store' && KINDS[b.t].holds === c)));
    const room = holders.reduce((a, b) => a + (KINDS[b.t].role === 'hall' ? stat(b.t, b.l).store : stat(b.t, b.l).cap), 0) || 1;
    holders.forEach(b => {
      const v = Math.floor(stored * (KINDS[b.t].role === 'hall' ? stat(b.t, b.l).store : stat(b.t, b.l).cap) / room);
      if (v <= 0) return;
      (by[b.i] = by[b.i] || {cash: 0, juice: 0})[c] += v;
      total[c] += v;
    });
  });
  s.b.forEach(b => {
    if (KINDS[b.t].role !== 'make') return;
    const v = Math.floor(made(b, now) * MADE_SHARE);
    if (v <= 0) return;
    (by[b.i] = by[b.i] || {cash: 0, juice: 0})[KINDS[b.t].makes] += v;
    total[KINDS[b.t].makes] += v;
  });
  return {by, total};
}
/** Trophies a raid moves (to the raider; the raided lose as many, or gain them when it took no stars). */
export function trophiesFor(stars, att, def) {
  if (stars > 0) return Math.round(Math.max(10, Math.min(50, 30 + (def - att) / 10)) * stars / 3);
  return -Math.round(Math.max(5, Math.min(30, 15 + (att - def) / 10)));
}
/** Takes raids made on s off it (each once): what they took from storage and the booths and coolers, the trophies.
 *  Mutates s; returns the raids taken. */
export function applyRaids(s, raids) {
  const done = new Set(s.ap), out = [];
  raids.slice().sort((a, b) => a.at - b.at).forEach(r => {
    if (done.has(r.id)) return;
    done.add(r.id);
    s.ap.push(r.id);
    const ls = r.ls || [0, 0];
    s.r.cash = Math.max(0, s.r.cash - (ls[0] || 0));
    s.r.juice = Math.max(0, s.r.juice - (ls[1] || 0));
    Object.entries(r.lb || {}).forEach(([id, v]) => {
      const b = s.b.find(x => x.i === Number(id));
      if (!b || KINDS[b.t].role !== 'make' || !b.c) return;
      const took = (v && (v[0] || v[1])) || 0, rate = stat(b.t, b.l).rate;
      if (took > 0 && rate > 0) b.c += took / rate * HOUR;
    });
    s.tp = Math.max(0, s.tp + (Number(r.td) || 0));
    out.push(r);
  });
  if (s.ap.length > 300) s.ap = s.ap.slice(-300);
  return out;
}
/** A raid's end, on the raider's franchise: the take into storage (what won't fit to the front office), the team
 *  that went in used up, the trophies, the raid on the record (rd, the last 40, two weeks). Returns the record. */
export function finishRaid(s, rec, used, now = Date.now()) {
  const cap = capOf(s);
  CUR.forEach((c, i) => {
    const got = rec.lt[i] || 0, fit = Math.max(0, Math.min(got, cap[c] - s.r[c]));
    s.r[c] += fit;
    s.xo[c] += got - fit;
  });
  Object.entries(used || {}).forEach(([t, n]) => { s.ar[t] = Math.max(0, (s.ar[t] || 0) - n); if (!s.ar[t]) delete s.ar[t]; });
  s.tp = Math.max(0, s.tp + (rec.ta || 0));
  if (String(rec.vs).startsWith('bot:')) s.bt[rec.vs] = dayKey(now);
  s.rd.push(rec);
  s.rd = s.rd.filter(r => now - r.at < 14 * 24 * HOUR).slice(-40);
  return rec;
}
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ---- the computer's franchises: one at each Stadium level, the same lot every day, full again every morning
export const BOTS = [
  {k: 'bot:1', name: 'Pee Wee Pioneers', th: 1}, {k: 'bot:2', name: 'JV Jackrabbits', th: 2}, {k: 'bot:3', name: 'Varsity Vipers', th: 3},
  {k: 'bot:4', name: 'Juco Juggernauts', th: 4}, {k: 'bot:5', name: 'Small School Stallions', th: 5}, {k: 'bot:6', name: 'Bowl Game Bulldogs', th: 6},
  {k: 'bot:7', name: 'Playoff Pirates', th: 7}, {k: 'bot:8', name: 'Dynasty Dragons', th: 8}
];
export const BOT_LOOT = [2500, 6000, 12000, 22000, 40000, 65000, 100000, 150000];
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
/** A computer franchise's lot (a franchise state, nothing stored: its take is BOT_LOOT, spread like a raid's). */
export function botBase(th) {
  const R = rng(9000 + th * 77), s = {b: [], r: {cash: 0, juice: 0}};
  let i = 1;
  const put = (t, l, x, y) => { if (fits(s, KINDS[t].size, x, y)) { s.b.push({i: i++, t, l, x, y, u: 0, c: 0}); return true; } return false; };
  put('stadium', th, 16, 16);
  // defenses round the Stadium, the money further out, the rest at the edge; fences ring the middle from level 2
  const ring = (t, n, r0, r1) => {
    for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
      const a = R() * Math.PI * 2, r = r0 + R() * (r1 - r0), sz = KINDS[t].size;
      const x = Math.round(N / 2 + Math.cos(a) * r - sz / 2), y = Math.round(N / 2 + Math.sin(a) * r - sz / 2);
      if (put(t, Math.max(1, topLevel(t, th) - (R() < .5 ? 1 : 0)), x, y)) k++;
    }
  };
  ['cannon', 'pressbox', 'jugs', 'shower'].forEach(t => ring(t, COUNT[t][th - 1], 4, 7.5));
  ['vault', 'tank'].forEach(t => ring(t, COUNT[t][th - 1], 5, 9));
  if (th >= 2) {
    // a fence round the middle (a square, its corners cut), as far as the count goes
    const lo = 9, hi = 26, top = topLevel('fence', th);
    let n = COUNT.fence[th - 1];
    for (let d = lo; d <= hi && n > 0; d++) [[d, lo], [d, hi], [lo, d], [hi, d]].forEach(([x, y]) => { if (n > 0 && put('fence', Math.max(1, top - 1), x, y)) n--; });
  }
  ['booth', 'cooler'].forEach(t => ring(t, COUNT[t][th - 1], 10, 14));
  ['practice', 'locker', 'office'].forEach(t => ring(t, Math.min(2, COUNT[t][th - 1]), 11, 15));
  return s;
}
/** A computer franchise's take today: BOT_LOOT across its money buildings, or nothing once raided today. */
export function botLoot(bot, base, mine, now = Date.now()) {
  const full = (mine && mine.bt && mine.bt[bot.k] === dayKey(now)) ? 0 : BOT_LOOT[bot.th - 1];
  const holders = base.b.filter(b => ['hall', 'store', 'make'].includes(KINDS[b.t].role));
  const by = {}, total = {cash: 0, juice: 0};
  CUR.forEach(c => {
    const hs = holders.filter(b => KINDS[b.t].role === 'hall' || KINDS[b.t].holds === c || KINDS[b.t].makes === c);
    hs.forEach((b, j) => { const v = Math.floor(full / hs.length) + (j === 0 ? full % hs.length : 0); (by[b.i] = by[b.i] || {cash: 0, juice: 0})[c] += v; total[c] += v; });
  });
  return {by, total};
}

// ---------------------------------------------------------------------------------------------------- the league
// People on the board as this phone may see it (daily.LB.raw: THE RULE), each with their freshest franchise.
const LEAGUE_USERS = () => (data.USERS || []).filter(u => u.league).map(u => 'user:' + u.id);
/** Whether a board key is the league's (a member, or an app user marked league: Ryan D): raids are between these. */
export const leagueKey = k => !!k && (!!daily.keyManager(k) || LEAGUE_USERS().includes(k));
export const myKey = () => (daily.LB.uid ? daily.boardKey({id: daily.LB.uid, nick: daily.LB.nick}) : null);
/** The freshest franchise among a person's docs (raw fr1), or null. */
export function freshest(docs) {
  let best = null;
  docs.forEach(p => { const f = p && p.fr1; if (f && Array.isArray(f.b) && (!best || (Number(f.at) || 0) > (Number(best.at) || 0))) best = f; });
  return best;
}
/** Every raid on the board (from every franchise's record), each with its raider's key, once each. */
export function raidsOn(list) {
  const seen = new Map();
  list.forEach(p => {
    const f = p && p.fr1;
    if (!f || !Array.isArray(f.rd)) return;
    const by = daily.boardKey(p);
    f.rd.forEach(r => { if (r && typeof r.id === 'string' && !seen.has(r.id)) seen.set(r.id, Object.assign({}, r, {from: by})); });
  });
  return [...seen.values()];
}
/** When key's shield runs out (ms; 0: none): SHIELD_H after the last raid on them that took a star, unless they've
 *  raided someone since. */
export function shieldOf(key, raids) {
  const hit = raids.filter(r => r.vs === key && (r.st || 0) >= 1).reduce((a, r) => Math.max(a, r.at), 0);
  if (!hit) return 0;
  const went = raids.filter(r => r.from === key && r.at > hit && !String(r.vs).startsWith('bot:')).reduce((a, r) => Math.min(a || r.at, r.at), 0);
  const end = hit + SHIELD_H * HOUR;
  return went ? Math.min(end, went) : end;
}
/** A person's franchise as it stands now for everyone else: their saved one, the raids on it they haven't taken off
 *  yet taken off, brought up to now. */
export function standing(f, key, raids, now = Date.now()) {
  const s = clean(f);
  if (!s) return null;
  applyRaids(s, raids.filter(r => r.vs === key));
  tick(s, now);
  return s;
}

// ---------------------------------------------------------------------------------------------------- this phone's
const LS = 'gg-fr1';
// PROVISIONAL: this phone started a new franchise before the board said whether this person has one (a new phone, a
// cleared browser): it gives way to theirs as soon as the board shows it, and isn't put on the board before then.
let MINE = null, saveT = 0, dirty = false, PROVISIONAL = false;
const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
const emit = why => subs.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } });
function readLocal() { try { return clean(JSON.parse(localStorage.getItem(LS) || 'null')); } catch (_) { return null; } }
function writeLocal(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (_) {} }
/** Whether the board has loaded with this phone's identity (so a franchise not on it isn't on it). */
const boardKnown = () => !!(daily.LB.ready && !daily.LB.off && daily.LB.uid);
/** This person's docs on the board (all their phones'). */
export function myDocs(list = daily.LB.raw || []) {
  const k = myKey();
  return k ? list.filter(p => daily.boardKey(p) === k || p.id === daily.LB.uid) : [];
}
/** This phone's franchise (loaded once: the freshest of this phone's copy and its person's docs), brought up to now. */
export function mine(now = Date.now()) {
  if (!MINE) {
    const local = readLocal(), remote = clean(freshest(myDocs()));
    MINE = (remote && (!local || remote.at > local.at)) ? remote : local;
    if (!MINE) { MINE = fresh(now); PROVISIONAL = !boardKnown(); }
  }
  // (what the clock does — a job done, a player trained — is kept here only: every phone works it out the same from
  // the times on the franchise, so it isn't worth a trip to the board)
  if (tick(MINE, now)) { writeLocal(MINE); emit('change'); }
  return MINE;
}
/** Picks up a newer copy from this person's other phone, and the raids on it (each once). True if it changed. */
export function sync(now = Date.now()) {
  const s = mine(now), list = daily.LB.raw || [];
  let changed = false;
  const remote = clean(freshest(myDocs(list)));
  if (remote && (PROVISIONAL || remote.at > s.at + 1000)) { MINE = remote; tick(MINE, now); changed = true; writeLocal(MINE); }
  if (boardKnown()) { if (PROVISIONAL && !remote) dirty = true; PROVISIONAL = false; }
  const k = myKey();
  if (k && leagueKey(k)) {
    const hit = applyRaids(MINE, raidsOn(list).filter(r => r.vs === k));
    if (hit.length) { changed = true; touch(); }
  }
  if (changed) emit('sync');
  return changed;
}
/** Marks the franchise changed: saved here at once, to the board a moment later. */
export function touch() {
  if (!MINE) return;
  MINE.at = Date.now();
  writeLocal(MINE);
  dirty = true;
  clearTimeout(saveT);
  saveT = setTimeout(flush, 1500);
  emit('change');
}
/** Puts this phone's franchise on its board doc now (when the board takes posts). */
export async function flush() {
  clearTimeout(saveT);
  const LB = daily.LB;
  if (!dirty || !MINE || PROVISIONAL || !LB.put || !LB.ready || LB.off || !LB.uid) return false;
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
