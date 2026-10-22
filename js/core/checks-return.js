// Return Man checks for the dev gallery (#/_kit): the day's courses (core/return.js: the same on every phone, one thing a
// row at first, fuller and quicker as the yards go, the vehicles in the lanes always leaving a way through, never across
// the line into the next place), the places in their order, the moves (a juke a lane over, a jump over a barricade and
// up onto a low vehicle, a slide under a banner), the vehicles (a tall one a hit, its ramp the
// way up, a roof to run along and juke off), the linebacker chasing (a hit a stumble, two close together the catch), the
// power-ups (salts, painkillers, booze), the speed and the touchdowns, the hard course (the owner's for now: potholes,
// each with its cone and the one thing he falls into, sleds, a bus head on the end of it, never done speeding up, no
// snow pile on its tundra), its gold coins (the owner's first run of the day alone: their lines, running through them,
// what's kept and posted of them, his profile alone),
// a day's numbers, and the league scoreboard's rows (on crafted board docs), which read the board as this phone may see
// it (THE RULE, CLAUDE.md). checks.js (owner: core) imports returnChecks and calls it with its own check(name, fn)
// helper; every fn returns true or {pass, detail}. Nothing here writes to storage or the database. Owner: RETURN.

import * as R from './return.js';
import * as daily from './daily.js';
import * as data from './data.js';
import {gameFor} from '../views/puzzles.js';
import {gamesFor, listHTML, GAMES, __dev as shelfDev} from '../views/games.js';

/** Names for crafted board docs: self, the profile this phone is on (the boards take this phone's own doc as that
 *  profile's, whatever name it carries, so "his" other docs must carry the same; Evan with no profile picked), and
 *  other, another league member's (never this profile's or the owner's). */
function fixtureNames() {
  const M = (data.DATA && data.DATA.managers) || [], mine = M.find(m => m.id === data.me());
  const self = mine ? mine.name : 'Evan';
  const other = (M.find(m => m.name !== self && m.id !== data.OWNER) || {}).name || (self === 'Mason' ? 'Jacob' : 'Mason');
  return {self, other};
}
/** A returner who sees the course and plans: each twentieth of a second, a search for the swipes that keep him up for
 *  the next 1.3 seconds (power-ups taken away, so it's the course alone that lets him through). Runs till he's down or
 *  to maxZ yards. */
function bot(n, k, maxZ, hard = false) {
  const ACTS = [null, 'up', 'down', 'left', 'right'], TICK = .05, DEPTH = 26;
  const strip = r => { r.salts = 0; r.pills = 0; r.shield = 0; r.burst = 0; };
  const run = R.startRun(n, k, hard);
  while (!run.over && run.z < maxZ && run.t < 400) {
    let nodes = 0;
    const dead = new Set();
    const dfs = (r, d) => {
      if (d >= DEPTH) return [];
      const key = `${d}|${r.lane}|${Math.round(r.x * 4)}|${Math.round(r.y * 8)}|${Math.round(r.vy)}|${r.slide > .05 ? Math.round(r.slide * 10) : 0}|${r.t - r.jumpQ < R.BUFFER ? 1 : 0}`;
      if (dead.has(key)) return null;
      for (const a of ACTS) {
        if (++nodes > 20000) return null;
        const c = {...r};
        if (a && !R.move(c, a)) continue;
        R.step(c, TICK); strip(c);
        if (c.over || c.hits > r.hits) continue; // (a hit: the linebacker gains)
        const rest = dfs(c, d + 1);
        if (rest) return [a, ...rest];
      }
      dead.add(key);
      return null;
    };
    const plan = dfs(run, 0);
    if (plan && plan[0]) R.move(run, plan[0]);
    R.step(run, TICK); strip(run);
  }
  return run;
}
/** A run on a course of its own: the rows, vehicle sets and power-ups given (nothing else), from z 0 in the lane (hard:
 *  the hard course's rules). */
function field({rows = [], sets = [], items = [], hard = false}, lane = 1) {
  const run = R.startRun(1, 0);
  run.co = {n: 0, k: 0, hard, order: [0, 1, 2, 3, 4], rows, sets, items, r: () => 0, z: 1e9, itemAt: 1e9, done: 1e9, first: {}};
  run.lane = lane; run.x = R.xOf(run, lane);
  run.t = R.CHASE.window + 1; // (the linebacker already lost: a hit there is a stumble, not a tackle)
  return run;
}
/** Runs at a row (lanes as given, 30 yards out) with one move made t seconds before it: what happens there. */
function meet(lanes, move, t = .15, lane = 1) {
  const run = field({rows: [{i: 0, z: 30, lanes}]}, lane);
  let out = null, moved = !move;
  for (let i = 0; i < 2000 && !out; i++) {
    if (!moved && (30 - run.z) / R.speedAt(run.z) <= t) { R.move(run, move); moved = true; }
    const ev = R.step(run, 1 / 120).find(e => e.type !== 'td' && e.type !== 'landed');
    if (ev) out = ev.type;
  }
  return out;
}
/** Runs a crafted course for s seconds (moves: [[z, swipe], ...] made as he gets there): the run and what happened. */
function play(course, s, moves = [], lane = 1) {
  const run = field(course, lane), ev = [];
  const todo = moves.slice();
  for (let i = 0; i < s * 120 && !run.over; i++) {
    while (todo.length && run.z >= todo[0][0]) R.move(run, todo.shift()[1]);
    R.step(run, 1 / 120).forEach(e => ev.push(e.type));
  }
  return {run, ev};
}
const plat = (lane, z0, z1, hi, ramp = 0) => ({lane, z0, z1, h: hi ? R.HIGH_H : R.LOW_H, b: 0, hi, ramp, kind: hi ? 'teambus' : 'bench'});
/** One of a kind's things in lane 1 from z 30 (its parts as the course lays them out), and swipes up at the z's given:
 *  how high he got, and whether he ran into it (over: a hit; end: its words). */
function climb(kind, jumps = []) {
  const parts = R.KINDS[kind].build(() => .5, .5, 1.02), from = Math.min(...parts.map(q => q.at - (q.ramp || 0)));
  const plats = parts.map((q, i) => ({lane: 1, kind, part: i, z0: 30 + q.at - from, z1: 30 + q.at - from + q.len, h: q.h, b: q.b || 0, ramp: q.ramp || 0, hi: q.h >= 2}));
  const run = field({sets: [{i: 0, zs: 30, ze: Math.max(...plats.map(p => p.z1)), plats}]}), todo = jumps.slice();
  let top = 0, first = null;
  for (let i = 0; i < 120 * 12 && !run.over && run.z < 70 && !first; i++) {
    while (todo.length && run.z >= todo[0]) { R.move(run, 'up'); todo.shift(); }
    first = R.step(run, 1 / 120).find(e => e.type === 'stumbled') || null;
    top = Math.max(top, run.y);
  }
  return {over: !!first, end: R.hitLine(first), top: Math.round(top * 100) / 100};
}
const set = (...plats) => ({i: 0, zs: Math.min(...plats.map(p => p.z0 - p.ramp)), ze: Math.max(...plats.map(p => p.z1)), plats});
// The regular course (the league's) as it was when the hard course lost its snow pile and gained its cones (Oct 21
// 2026): a fingerprint of days 1-20's first two kickoffs to 1,500 yards (their places' order, rows, vehicle sets
// and power-ups), the same from the generator before that change and after it (compared byte for byte, days 1-40,
// three kickoffs, to 3,000 yards). It changes only when the regular course does: on purpose, never mid-day.
const REG_FP = 'a988e22d';
function regularPrint() {
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); };
  const out = [], lt = z => z < 1500;
  for (let n = 1; n <= 20; n++) for (const k of [0, 1]) {
    const co = R.fill(R.course(n, k), 1500); // (however far it's been worked out already: the first 1,500 yards)
    out.push(JSON.stringify([co.order, co.rows.filter(r => lt(r.z)), co.sets.filter(s => lt(s.zs)), co.items.filter(i => lt(i.z))]));
  }
  return fnv(out.join('\n'));
}
// The hard course (the owner's) as it was before its coins came in (Oct 21 2026): days 1-20's kickoff to 3,000 yards,
// the same with the coins laid out first (they draw from a seed of their own). (Changed Oct 22 2026, the owner's ask:
// the sleds gone, their lanes left open, everything else on it where it was: was 7d9998b7.)
const HARD_FP = '6ac2e402';
// The coins' lines on days 1-20's hard course (to 2,900 yards) when they came in (Oct 21 2026): the same however far
// ahead they're laid out at a time, on every phone. It changes only when the coins' layout does: on purpose, never
// mid-day. (Changed before they first came out, Oct 21 2026: no banner or sled in a line's lane just before it, COIN.look.)
const COIN_FP = 'af842f2f';
const fnv32 = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); };
function hardPrint(coinsFirst) {
  const out = [], lt = z => z < 3000;
  for (let n = 1; n <= 20; n++) {
    const co = R.course(n, 0, true);
    if (coinsFirst) R.coinsTo(co, 3000);
    R.fill(co, 3000);
    out.push(JSON.stringify([co.order, co.rows.filter(r => lt(r.z)), co.sets.filter(s => lt(s.zs)), co.items.filter(i => lt(i.z))]));
  }
  return fnv32(out.join('\n'));
}
function coinPrint(step) {
  const out = [];
  for (let n = 1; n <= 20; n++) {
    const co = R.course(n, 0, true);
    if (step) for (let z = 0; z <= 3000; z += step) R.coinsTo(co, z); else R.coinsTo(co, 3000);
    out.push(JSON.stringify([co.lines.filter(l => l.z0 < 2900), co.coins.filter(c => c.z < 2900)]));
  }
  return fnv32(out.join('\n'));
}
/** Lets go of the courses worked out so far (core keeps a dozen): the next ones asked for are laid out fresh. */
const freshCourses = () => { for (let n = 9000; n < 9015; n++) R.course(n, 0); };
/** A coin run met at one of the day's lines (line, on its hard course co), from just before it in its lane, the
 *  linebacker long gone: jump: yards early (-) or late (+) to jump an arc from its jump point (null: no jump); slide: in
 *  a slide all the way; juke: a lane over at once (either way there's room); hop: a jump just before a flat line; coins:
 *  a coin run or not. Runs to COIN.react s past it: {got (its coins he ran through), hits (before then), juked}. */
function throughLine(co, line, {jump = 0, slide = false, juke = false, hop = false, coins = true} = {}) {
  const run = R.startRun(co.n, 0, true, coins), z0 = line.z0 - 1.2, from = (arr, f) => { const i = arr.findIndex(f); return i < 0 ? arr.length : i; };
  run.co = co;
  Object.assign(run, {z: z0, lane: line.lane, x: R.xOf(run, line.lane), t: 30, hitAt: 0, zone: Math.floor(z0 / R.ZONE), tds: R.tdsAt(z0)});
  run.next = from(co.rows, r => r.z >= z0); run.nextCone = from(co.rows, r => R.coneZ(r) >= z0);
  run.nextItem = from(co.items, it => it.z >= z0); run.nextCoin = from(co.coins, c => c.z >= z0);
  const zEnd = line.end + R.COIN.react * R.speedAt(line.end, true) - .05, v = R.speedAt(line.z0, true);
  let got = 0, hits = 0, jumped = false, juked = false;
  for (let i = 0; i < 6000 && run.z < zEnd && !run.over; i++) {
    if (line.jump != null && jump != null && !jumped && run.z >= line.jump + jump) { R.move(run, 'up'); jumped = true; }
    if (hop && !jumped && run.z >= line.z0 - .3 * v) { R.move(run, 'up'); jumped = true; }
    if (juke && !i) juked = R.move(run, line.lane ? 'left' : 'right') || (line.lane === 1 && R.move(run, 'right'));
    if (slide && run.slide < .05 && run.y < .01) R.move(run, 'down');
    R.step(run, 1 / 120).forEach(e => {
      if (e.type === 'coin' && e.coin.line === line.i) got++;
      if (['stumbled', 'tackled', 'crashed', 'shoved'].includes(e.type) && e.z < zEnd) hits++;
    });
  }
  return {got, hits, juked};
}

export async function returnChecks(check) {
  // ------------------------------------------------------------------------------------------- the course
  check('Return Man: day 1 is Oct 20 2026; a day\'s kickoff (one a day) is the same every time (the same on every phone) and differs day to day; a barricade (jump it) is all you meet for the first 40 yards, one thing a row till 60; every row is barricades and banners (each beaten by its move, so there\'s always a way through); the rows come no closer than GAP.min seconds apart', () => {
    const day1 = R.todayNumber(new Date(2026, 9, 20, 9)) === 1 && R.todayNumber(new Date(2026, 9, 21, 1)) === 2 && R.dayLabel(1, {month: 'short', day: 'numeric'}) === 'Oct 20';
    const sig = (n, k) => { const co = R.fill(R.course(n, k), 800); return JSON.stringify([co.rows.slice(0, 30), co.sets.slice(0, 6), co.items.slice(0, 5)]); };
    const same = sig(3, 0) === sig(3, 0), differ = sig(3, 0) !== sig(4, 0) && sig(4, 0) !== sig(5, 0);
    const bad = [];
    let minT = Infinity;
    for (let n = 1; n <= 24; n++) for (const k of [0]) {
      const rows = R.fill(R.course(n, k), 3000).rows;
      rows.forEach((r, i) => {
        const men = r.lanes.filter(Boolean);
        if (!men.length) bad.push(`day ${n}/${k} row ${i} empty`);
        if (men.some(t => !R.OBST[t])) bad.push(`day ${n}/${k} row ${i}: a ${men.join('/')}`);
        if (i) minT = Math.min(minT, (r.z - rows[i - 1].z) / R.speedAt(rows[i - 1].z));
        if (r.z < 40 && men.some(t => t !== 'hurdle')) bad.push(`day ${n}/${k} row ${i}: a ${men.join('/')} at ${Math.round(r.z)} yds`);
        if (r.z < 60 && men.length > 1) bad.push(`day ${n}/${k} row ${i}: ${men.length} things at ${Math.round(r.z)} yds`);
      });
    }
    const pass = day1 && same && differ && !bad.length && minT >= R.GAP.min - .01;
    return {pass, detail: `day 1 ${day1}; same ${same}, differ ${differ}; closest rows ${minT.toFixed(2)} s; ${bad.length ? bad.slice(0, 4).join('; ') : 'every row has a way through'}`};
  });
  check('Return Man: the vehicles always leave a way through: at most two side by side (an open lane always), never across the line into the next place; beside one the rows stand only in the open lanes; a power-up every 180 to 360 yards or so, the ones up top on a tall one\'s roof', () => {
    const bad = [];
    let sets = 0, hi = 0, lo = 0, ramps = 0, items = 0, roofs = 0;
    for (let n = 1; n <= 24; n++) for (const k of [0]) {
      const co = R.fill(R.course(n, k), 3000);
      co.sets.forEach(s => {
        sets++;
        s.plats.forEach(p => { if (p.hi) hi++; else lo++; if (p.ramp) ramps++; if (p.ramp && p.h < 1.2) bad.push(`day ${n}/${k}: a ramp up to something low`); });
        if (new Set(s.plats.map(p => p.lane)).size > 2) bad.push(`day ${n}/${k} set at ${s.zs}: no open lane`);
        if (Math.floor(s.zs / R.ZONE) !== Math.floor(s.ze / R.ZONE)) bad.push(`day ${n}/${k} set at ${s.zs}: across a gate`);
        co.rows.filter(r => r.z >= s.zs && r.z <= s.ze).forEach(r => r.lanes.forEach((t, l) => {
          if (t && s.plats.some(p => p.lane === l)) bad.push(`day ${n}/${k}: a ${t} in a vehicle's lane at ${r.z}`);
        }));
      });
      const its = co.items.filter(i => i.z < 2900);
      items += its.length;
      its.forEach((it, i) => {
        if (i && it.z - its[i - 1].z < 45) bad.push(`day ${n}/${k}: power-ups ${Math.round(it.z - its[i - 1].z)} yds apart`);
        if (it.top) { roofs++; if (R.groundAt(co, it.lane, it.z) < 1.5) bad.push(`day ${n}/${k}: a roof power-up not up top at ${it.z}`); }
        else if (R.groundAt(co, it.lane, it.z) !== 0) bad.push(`day ${n}/${k}: a road power-up inside a vehicle at ${it.z}`);
      });
    }
    const per = items / 24, pass = !bad.length && hi > 0 && lo > 0 && ramps > 0 && roofs > 0 && per >= 2900 / 400 && per <= 2900 / 160;
    return {pass, detail: `${sets} sets (${hi} tall, ${lo} low, ${ramps} ramps); ${per.toFixed(1)} power-ups a kickoff to 2,900 yds (${roofs} on roofs); ${bad.length ? bad.slice(0, 4).join('; ') : 'all clear'}`};
  });
  check('Return Man: every kickoff can be run back forever: a returner who reads it right (and gets no power-ups) gets 1,500 yards on the kickoffs of days 1-9; standing still (the linebacker gets him at a second hit close after the first), he\'s down inside the first 450, most inside 200', () => {
    const out = [], down = [];
    for (let n = 1; n <= 9; n++) for (const k of [0]) {
      const b = bot(n, k, 1500);
      if (b.over) out.push(`day ${n}/${k} down at ${Math.round(b.z)} (${R.endOf(b)})`);
      const idle = R.startRun(n, k);
      for (let i = 0; i < 60 * 60 && !idle.over; i++) R.step(idle, 1 / 60);
      down.push(idle.over ? Math.round(idle.z) : 9999);
    }
    const mid = down.slice().sort((a, b) => a - b)[Math.floor(down.length / 2)];
    const pass = !out.length && down.every(z => z < 450) && mid < 200;
    return {pass, detail: out.length ? out.join('; ') : `9 kickoffs to 1,500 yards; standing still, down at ${down.join(', ')}`};
  });
  check('Return Man: the rows fill up and come quicker with the yards: early on one thing a row and about 1.3 seconds apart; past 450 yards mostly two or three and well under a second', () => {
    const early = [], late = [];
    for (let n = 1; n <= 6; n++) {
      const co = R.fill(R.course(n, 0), 2500), rows = co.rows;
      rows.forEach((r, i) => {
        if (!i) return;
        const inSet = co.sets.some(s => r.z >= s.zs - 1 && r.z <= s.ze + 40) || co.sets.some(s => rows[i - 1].z >= s.zs - 1 && rows[i - 1].z <= s.ze);
        if (inSet) return; // (beside a vehicle and just after, the rows keep their own spacing)
        (r.z < 60 ? early : r.z > 450 ? late : []).push({men: r.lanes.filter(Boolean).length, t: (r.z - rows[i - 1].z) / R.speedAt(rows[i - 1].z)});
      });
    }
    const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
    const eMen = avg(early, x => x.men), lMen = avg(late, x => x.men), eT = avg(early, x => x.t), lT = avg(late, x => x.t);
    const pass = eMen === 1 && lMen > 1.8 && eT > 1.2 && lT < .95;
    return {pass, detail: `first 60 yds: ${eMen.toFixed(2)} a row, ${eT.toFixed(2)} s apart; past 450: ${lMen.toFixed(2)} a row, ${lT.toFixed(2)} s`};
  });
  check('Return Man: the places: the stadium first, then the tailgate, the city, the frozen tundra, the desert, the farmers market, the beach, outer space and the farm in an order of the day\'s own (each kickoff starting one further on), a new one every 100 yards (a touchdown into each), round and round; each with things of its own in the lanes', () => {
    const N = R.THEMES.length;
    const ids = (n, k) => Array.from({length: N + 1}, (_, i) => R.zoneAt(R.course(n, k), i * R.ZONE + 1).theme.id);
    const a = ids(2, 0), b = ids(2, 1), c = ids(2, 2);
    const first = [a, b, c].every(x => x[0] === 'stadium' && x[N] === 'stadium' && new Set(x.slice(0, N)).size === N);
    const turn = b[1] === a[2] && c[1] === a[3];
    const named = N === 9 && R.THEMES.every(t => t.name && t.kinds.length >= 2 && t.kinds.every(([k]) => R.KINDS[k] && R.KINDS[k].name)) && ['tailgate', 'city', 'tundra', 'desert', 'market', 'beach', 'space', 'farm'].every(id => R.THEMES.some(t => t.id === id));
    const edge = R.ZONE === 100 && R.ZONE === R.TD && R.zoneAt(R.course(2, 0), 99.99).i === 0 && R.zoneAt(R.course(2, 0), 100).i === 1;
    return {pass: first && turn && named && edge, detail: `kickoff 1: ${a.join(' → ')}; kickoff 2 starts ${b[1]}, kickoff 3 ${c[1]}; every ${R.ZONE} yards`};
  });
  // ------------------------------------------------------------------------------------------- the moves
  check('Return Man: the moves: a juke takes him a lane over; one off the edge of the road (either side) is a hit, a stumble (the owner\'s ask, Oct 2026); a jump clears a barricade, a slide goes under a banner, and neither beats the other; doing nothing in its lane is a hit (a stumble); leaving its lane late is a juke; a jump swiped in the air goes the moment he lands; a slide under a hover pad he\'d hit standing', () => {
    const lanes = t => [null, t, null];
    const r = {
      dive: [meet(lanes('hurdle'), 'up'), meet(lanes('hurdle'), 'down'), meet(lanes('hurdle'), null)],
      wrap: [meet(lanes('bar'), 'down'), meet(lanes('bar'), 'up'), meet(lanes('bar'), null)],
      wedge: [meet(lanes('bar'), 'left', .25)],
      empty: meet([null, null, null], null),
      early: meet(lanes('hurdle'), 'up', 1.2)
    };
    // off the edge, either side: he stays in his lane, and it's a hit (a stumble, its words); back in from the edge is a juke
    const wall = dir => {
      const lane = dir === 'left' ? 0 : R.LANES - 1, run = field({}, lane);
      const no = !R.move(run, dir) && run.lane === lane && run.bump === run.t, e = R.step(run, 1 / 120).find(x => x.type === 'stumbled');
      return no && !!e && e.edge === dir && run.hits === 1 && R.laneOf(run) === lane && R.hitLine(e) === `Ran out of room on the ${dir}`;
    };
    const inward = field({}, 0), walls = wall('left') && wall('right') && R.move(inward, 'right') && inward.lane === 1;
    // a jump, and another swiped on the way down: up again as soon as he lands
    const j = field({});
    R.move(j, 'up'); for (let i = 0; i < 54; i++) R.step(j, 1 / 120); R.move(j, 'up');
    let again = false;
    for (let i = 0; i < 60; i++) { R.step(j, 1 / 120); if (j.vy > 0 && j.t > .5) { again = true; break; } }
    const want = 'hurdled,stumbled,stumbled|slid,stumbled,stumbled|juked|passed|stumbled';
    // a pad 1.2 yards up: in his way standing, not in a slide
    const pad = slide => { const run = field({sets: [{i: 0, zs: 30, ze: 34, plats: [{lane: 1, kind: 'hover', part: 1, z0: 30, z1: 34, h: 1.5, b: 1.2, ramp: 0, hi: false}]}]}); let hit = false; for (let i = 0; i < 120 * 5 && run.z < 40; i++) { if (slide && run.z > 27 && run.z < 28) R.move(run, 'down'); if (R.step(run, 1 / 120).some(e => e.type === 'stumbled')) hit = true; } return hit; };
    const under = pad(false) && !pad(true);
    const got = [r.dive.join(), r.wrap.join(), r.wedge.join(), r.empty, r.early].join('|');
    return {pass: got === want && walls && again && under, detail: `barricade: ${r.dive.join(', ')}; banner: ${r.wrap.join(', ')}; left late ${r.wedge.join(', ')}; an empty row ${r.empty}; a jump a second early ${r.early}; off the edge ${walls ? 'a stumble, either side' : 'WRONG'}; the jump on landing ${again}; under a pad in a slide ${under}`};
  });
  check('Return Man: the vehicles: running into a tall one is a hit (a jump won\'t clear it) that knocks him into the open lane beside it; its ramp takes him up onto the roof, he runs along the top over the banners below, and drops off the end; a low one he jumps onto (or runs into, and scrambles up); he can\'t juke into a tall one\'s side (a hit too), but he can juke off a roof', () => {
    const tall = play({sets: [set(plat(1, 30, 50, true))]}, 4), jumped = play({sets: [set(plat(1, 30, 50, true))]}, 4, [[27, 'up']]);
    const crash = tall.ev.filter(e => e === 'stumbled').length === 1 && !tall.run.over && R.laneOf(tall.run) !== 1 && tall.run.y === 0
      && R.hitLine({plat: {kind: 'teambus'}}) === 'Ran into the team bus' && R.hitLine({plat: {kind: 'citybus'}, side: true}) === 'Bounced off the city bus' && jumped.ev.includes('stumbled');
    // up the ramp, along the roof over a banner in his lane, off the end
    const rp = field({sets: [set(plat(1, 30, 60, true, R.RAMP))], rows: [{i: 0, z: 45, lanes: [null, 'bar', null]}]});
    let top = 0, ev = [];
    for (let i = 0; i < 120 * 10 && !rp.over && rp.z < 70; i++) { ev.push(...R.step(rp, 1 / 120).map(e => e.type)); if (rp.z > 40 && rp.z < 58) top = Math.max(top, rp.y); }
    const ramp = !rp.over && Math.abs(top - R.HIGH_H) < .01 && ev.includes('over') && rp.y === 0;
    const low = play({sets: [set(plat(1, 30, 38, false))]}, 6, [[27.5, 'up']]), lowCrash = play({sets: [set(plat(1, 30, 38, false))]}, 6);
    const onLow = !low.run.over && low.ev.includes('landed') && !low.ev.includes('stumbled') && lowCrash.ev.includes('stumbled') && climb('bench').end === 'Ran into the bench';
    // the side: refused (and noted) from the road; off a roof he goes, and comes down
    const side = field({sets: [set(plat(1, 10, 60, true))]}, 0);
    side.z = 20;
    const refused = !R.move(side, 'right') && side.bump === side.t && side.lane === 0
      && (R.step(side, 1 / 120).find(e => e.type === 'stumbled') || {}).side === true;
    const off = field({sets: [set(plat(1, 10, 60, true))]}, 1);
    off.z = 20; off.y = R.HIGH_H;
    const jukeOff = R.move(off, 'left');
    for (let i = 0; i < 120; i++) R.step(off, 1 / 120);
    const down = jukeOff && !off.over && off.y === 0 && R.laneOf(off) === 0;
    return {pass: crash && ramp && onLow && refused && down, detail: `a tall one: ${crash}; the ramp and roof: up to ${top.toFixed(2)}, ${ev.includes('over') ? 'over the banner' : 'not over the banner'}, down ${rp.y === 0}; a low one: ${onLow}; its side refused ${refused}; off a roof ${down}`};
  });
  check('Return Man: the owner\'s sheet (Run, Jump, Climb): three things of their own in each of six places; the climbs work: up the hover pads in three jumps (under the top one on foot; the bottom one in your way), across the gap between the piers (or down into it), up the hay steps, onto the tow truck\'s cab (or into it), over the fence (or into it), up the crates onto the stall\'s awning', () => {
    const sheet = {desert: ['canyon', 'minecart', 'wagonbridge'], city: ['parkedcar', 'ramptruck', 'citybus'], market: ['producecart', 'marketramp', 'awning'], beach: ['lifeguard', 'buggy', 'pier'], space: ['rover', 'cargo', 'hover'], farm: ['hay', 'trailer', 'fence']};
    const places = Object.entries(sheet).every(([id, ks]) => { const th = R.THEMES.find(t => t.id === id); return th && ks.every(k => R.KINDS[k] && th.kinds.some(([x]) => x === k)); });
    const under = (() => {
      const run = field({sets: [{i: 0, zs: 30, ze: 35, plats: [{lane: 1, kind: 'hover', part: 2, z0: 30, z1: 35, h: 2.8, b: 2.55, ramp: 0, hi: true}]}]});
      let hit = false;
      for (let i = 0; i < 120 * 5 && !run.over && run.z < 45; i++) if (R.step(run, 1 / 120).some(e => e.type === 'stumbled')) hit = true;
      return !run.over && !hit;
    })();
    const r = {
      hover: [climb('hover'), climb('hover', [26.5, 29.8, 34.5, 39.3])],
      pier: [climb('pier', [28.6]), climb('pier', [28.6, 34.6])],
      hay: [climb('hay', [28.6]), climb('hay', [26.5, 29.8, 34.4, 38.5])],
      truck: [climb('ramptruck'), climb('ramptruck', [39.5])],
      fence: [climb('fence'), climb('fence', [28.8, 35.8])],
      awning: [climb('awning'), climb('awning', [26.5, 29.8])]
    };
    const ok = (pair, top) => pair[0].over && !pair[1].over && pair[1].top >= top - .01;
    const pass = places && under && ok(r.hover, 2.8) && ok(r.pier, 1) && ok(r.hay, 1.9) && ok(r.truck, 2.6) && ok(r.fence, .5) && ok(r.awning, 2.2)
      && r.hover[0].end === 'Ran into the hover pad' && r.pier[0].end === 'Ran into the pier' && r.truck[0].end === 'Ran into the tow truck';
    return {pass, detail: `the sheet in its places ${places}; under the top pad ${under}; ${Object.entries(r).map(([k, [a, b]]) => `${k}: ${a.over ? a.end : 'through'} / ${b.over ? b.end : 'up to ' + b.top}`).join('; ')}`};
  });
  // ------------------------------------------------------------------------------------------- the power-ups
  check('Return Man: the power-ups: smelling salts give a burst of speed (BURST.k faster for BURST.s seconds, the owner\'s ask, Oct 2026) and shake the linebacker off when he\'d catch him (once each; he carries two at most); painkillers carry him through barricades and banners and up onto vehicles for a few seconds; booze makes every yard count double for a few; picked up only in his lane, at his height', () => {
    const wedge = z => ({i: z, z, lanes: [null, 'hurdle', null]});
    const salts = play({items: [{i: 0, z: 20, lane: 1, top: false, kind: 'salts'}], rows: [wedge(40), wedge(60), wedge(80)]}, 10);
    const s1 = salts.ev.includes('pickup') && salts.ev.join().includes('stumbled,revived') && salts.run.over && salts.run.why === 'caught' && Math.round(salts.run.z) >= 80;
    const two = field({items: [0, 1, 2].map(i => ({i, z: 20 + i * 5, lane: 1, top: false, kind: 'salts'}))});
    for (let i = 0; i < 400; i++) R.step(two, 1 / 120);
    // the burst: faster than he'd be without it, just after; his own speed again once it's over
    const pace = (items, from, secs) => { const r = field({items}); for (let i = 0; i < 120 * from; i++) R.step(r, 1 / 120); const z0 = r.z; for (let i = 0; i < 120 * secs; i++) R.step(r, 1 / 120); return (r.z - z0) / secs; };
    const salt = [{i: 0, z: 5, lane: 1, top: false, kind: 'salts'}];
    const fast = pace(salt, 1, 1) / pace([], 1, 1), after = pace(salt, R.BURST.s + 1.5, 1) / pace([], R.BURST.s + 1.5, 1);
    const burst = Math.abs(fast - (1 + R.BURST.k)) < .03 && Math.abs(after - 1) < .03;
    const pills = play({items: [{i: 0, z: 20, lane: 1, top: false, kind: 'pills'}], rows: [wedge(40)], sets: [set(plat(1, 55, 70, true))]}, 7);
    const p1 = pills.ev.includes('trucked') && pills.ev.includes('vaulted') && !pills.run.over;
    const late = play({items: [{i: 0, z: 20, lane: 1, top: false, kind: 'pills'}], rows: [wedge(20 + R.speedAt(20) * (R.POWER.pills.s + .5))]}, 9);
    const booze = field({items: [{i: 0, z: 10, lane: 1, top: false, kind: 'booze'}]});
    for (let i = 0; i < 120 * 3; i++) R.step(booze, 1 / 120);
    const b1 = booze.yards - 10 > (booze.z - 10) * 1.9; // (double from where he picked it up)
    const miss = play({items: [{i: 0, z: 20, lane: 0, top: false, kind: 'booze'}]}, 3);
    const pass = s1 && burst && two.salts === R.SALTS_MAX && p1 && late.ev.includes('stumbled') && b1 && !miss.ev.includes('pickup');
    return {pass, detail: `salts: shook him off ${s1}, carries ${two.salts}, a burst ${fast.toFixed(2)}× then ${after.toFixed(2)}×; painkillers: through a barricade and onto a bus ${p1}, worn off (a hit again) ${late.ev.includes('stumbled')}; booze: ${Math.round(booze.yards)} yards for ${Math.round(booze.z)} run; another lane's left ${!miss.ev.includes('pickup')}`};
  });
  check('Return Man: the linebacker chases him down: on him at the catch; a hit (a barricade, a banner, a vehicle) slows him and the linebacker runs up from where he was to right behind him; run on clean and he falls back out of sight; a hit while he\'s on him (inside CHASE.window seconds of the catch or the last hit, or while he\'s still in the picture falling away) is a tackle; one after he\'s gone is just another stumble', () => {
    const wedge = z => ({i: z, z, lanes: [null, 'hurdle', null]});
    const C = R.CHASE;
    // one hit: slowed, the linebacker near, then back to speed and the linebacker gone
    const one = field({rows: [wedge(30)]});
    let v0 = null, vSlow = null, gNear = null, gHit = null, hitT = null;
    for (let i = 0; i < 120 * 9 && !one.over; i++) {
      const z = one.z, evs = R.step(one, 1 / 120);
      if (evs.some(e => e.type === 'stumbled')) { gHit = R.gapOf(one); hitT = one.t; v0 = R.speedAt(z); }
      else if (gHit != null && vSlow == null) vSlow = (one.z - z) * 120;
      if (hitT != null && gNear == null && one.t - hitT >= C.runUp) gNear = R.gapOf(one);
    }
    // (he runs up on him from out of sight, not out of nowhere: still far at the hit, near runUp s on)
    const slowed = vSlow < v0 * (1 - C.slowBy * .9) && Math.abs(gHit - C.far) < 1e-9 && Math.abs(gNear - C.near) < 1e-9 && !one.over && Math.abs(R.gapOf(one) - C.far) < 1e-9 && !R.chasing(one);
    // two hits close together: caught; two far apart: two stumbles
    const at = s => 30 + R.speedAt(30) * s * .9;
    const quick = play({rows: [wedge(30), wedge(at(2))]}, 8), slow = play({rows: [wedge(30), wedge(at(C.window + 2))]}, 12);
    const caught = quick.run.over && quick.run.why === 'caught' && R.endOf(quick.run) === 'Tackled from behind by the linebacker' && quick.ev.join().includes('stumbled');
    // at the catch he's on him: a hit in the first CHASE.window seconds is a tackle, no stumble first
    const start = field({rows: [wedge(20)]});
    start.t = 0;
    for (let i = 0; i < 120 * 4 && !start.over; i++) R.step(start, 1 / 120);
    const atCatch = R.chasing(R.startRun(1, 0)) && start.over && start.why === 'caught' && start.hits === 0;
    const twice = !slow.run.over && slow.ev.filter(e => e === 'stumbled').length === 2;
    // past CHASE.window, falling away but still in the picture (under CHASE.seen yards back): a hit's a tackle; once
    // he's out of it, a stumble
    const late = after => { const f = field({rows: [wedge(1)]}); f.t = C.window + after; for (let i = 0; i < 120 && !f.over && !f.hits; i++) R.step(f, 1 / 120); return f; };
    const inFrame = late(.05), gone = late(.3), framed = inFrame.over && inFrame.why === 'caught' && !gone.over && gone.hits === 1;
    // a juke into a bus's side counts, then a banner right after: caught
    const side = field({sets: [set(plat(1, 10, 60, true))], rows: [{i: 0, z: 36, lanes: ['bar', null, null]}]}, 0);
    side.z = 20; R.move(side, 'right');
    for (let i = 0; i < 120 * 4 && !side.over; i++) R.step(side, 1 / 120);
    const sideHit = side.over && side.why === 'caught';
    return {pass: slowed && caught && twice && sideHit && atCatch && framed, detail: `on him at the catch: a hit ${atCatch ? 'a tackle' : 'WRONG'}; falling away still in the picture: ${inFrame.over ? 'a tackle' : 'WRONG'}, out of it: ${gone.hits === 1 && !gone.over ? 'a stumble' : 'WRONG'}; a hit: ${Math.round(vSlow * 10) / 10} yds/s from ${Math.round(v0 * 10) / 10}, the linebacker ${Math.round(gHit * 10) / 10} yds back at the hit, ${Math.round(gNear * 10) / 10} ${C.runUp} s on, gone after ${C.window} s ${slowed}; two in ${2} s: ${quick.run.why || 'not caught'}; two ${C.window + 2} s apart: ${twice ? 'two stumbles' : 'WRONG'}; a bus's side then a banner: ${sideHit ? 'caught' : 'WRONG'}`};
  });
  check('Return Man: speed and touchdowns: from a jog (9.5 yards a second) to a sprint (19) by about a thousand yards; a touchdown every 100 yards run', () => {
    const v = [0, 100, 400, 1000, 5000].map(z => R.speedAt(z));
    const speed = v[0] === 9.5 && v[1] > 11 && v[2] > 15 && v[3] > 18 && v[4] <= 19 && v.every((x, i) => !i || x > v[i - 1] || x === 19);
    const tds = [0, 99, 100, 199, 200, 330, 1000].map(R.tdsAt).join();
    return {pass: speed && tds === '0,0,1,1,2,3,10', detail: `speed ${v.map(x => x.toFixed(1)).join(', ')}; TDs ${tds}`};
  });
  // ------------------------------------------------------------------------------------------- a day
  check('Return Man: as many runs as you like (the owner\'s ask, Oct 2026: replayed, best run counts): every run is kept, on the day\'s one course; the day counts its best run (its yards, the touchdowns by how far he ran) from the first run on; a day kept from before counts its best; bad entries are left out; a day kept before power-ups (plain yards) still reads', () => {
    const list = [{y: 174, d: 174}, {y: 312, d: 240}, {y: 45, d: 45}], s = R.score(list);
    const one = R.officialOf({r: [list[0]], at: 9}), none = R.officialOf({r: []}), three = R.officialOf({r: list, at: 7});
    const bad = R.officialOf({r: [{y: -5, d: 3}, 'x', list[2], list[1]]}), old = R.officialOf({r: [174, 312, 45]});
    const same = R.startRun(4, 0).co === R.startRun(4, 3).co;
    const pass = s.yards === 531 && s.tds === 3 && one && one.yards === 174 && one.at === 9 && none === null
      && three && three.yards === 312 && three.tds === 2 && three.list.length === 1 && bad && bad.yards === 312 && old && old.yards === 312 && same;
    return {pass, detail: `one run: ${one && one.yards}; none run: ${none}; three runs: ${three && three.yards} (the best, ${three && three.tds} TDs); with junk in it: ${bad && bad.yards}; plain yards: ${old && old.yards}; every run the same course ${same}`};
  });
  check('Return Man: a return left under way counts where it got to (keepLive/settle); no restart of a day (Test play is the owner\'s sandbox)', () => {
    const gone = !('restart' in R) && !('canReplay' in R) && !('restartDay' in R);
    const kept = typeof R.keepLive === 'function' && typeof R.settle === 'function' && typeof R.live === 'function' && typeof R.setTest === 'function';
    return {pass: gone && kept, detail: `restart gone ${gone}; a left return counts ${kept}`};
  });
  // ------------------------------------------------------------------------------------------- the scoreboard
  const doc = (id, nick, rm, extra = {}) => Object.assign({id, nick, total: 0, last: 1, rm2: rm}, extra);
  const e = (y, l, td, t) => ({y, l, td, t});
  check('Return Man: the scoreboard ranks the day by yards, then the longest return, then touchdowns (ties share a rank); a member on two phones is one row, their best run; bad entries are left out', () => {
    const docs = [
      doc('rm-a', 'Mason', {1: e(400, 210, 2, 50)}),
      doc('rm-b', 'Jacob', {1: e(400, 250, 2, 40)}),
      doc('rm-c', 'Tommy', {1: e(400, 250, 2, 60)}),
      doc('rm-d', 'Evan', {1: e(612, 300, 3, 70)}),
      doc('rm-e', 'Mason', {1: e(90, 40, 0, 10)}, {last: 2}),
      doc('rm-f', 'Dresden', {1: {y: 50, l: 80, td: 0, t: 1}}),
      doc('rm-g', 'John', {2: e(300, 120, 1, 5)})
    ];
    const rows = R.boardRows(1, docs), sig = rows.map(r => `${r.rank}.${r.name.split(' ')[0]} ${r.y}/${r.l}`).join(', ');
    return {pass: sig === '1.Evan 612/300, 2.Jacob 400/250, 2.Tommy 400/250, 4.Mason 400/210', detail: sig};
  });
  check('Return Man: the week (Tuesday to Monday) adds up each person\'s yards over its days, then the longest; last week\'s days don\'t count', () => {
    // day 1 (Oct 20 2026) is a Tuesday: days 1-7 are a week, day 8 starts the next
    const wd = R.weekDays(1, 8).join() === '1,2,3,4,5,6,7' && R.weekDays(8, 8).join() === '8' && R.weekDays(3, 3).join() === '1,2,3';
    const docs = [
      doc('rw-a', 'Mason', {6: e(200, 100, 1, 1), 7: e(150, 90, 0, 2)}),
      doc('rw-b', 'Jacob', {7: e(300, 160, 1, 2)}),
      doc('rw-c', 'Tommy', {8: e(900, 400, 4, 1)})
    ];
    const rows = R.weekRows(7, docs, 8), sig = rows.map(r => `${r.rank}.${r.name.split(' ')[0]} ${r.y}/${r.l}/${r.played}`).join(', ');
    return {pass: wd && sig === '1.Mason 350/100/2, 2.Jacob 300/160/1', detail: `days ${wd}; ${sig}`};
  });
  check('Return Man attempts (the owner\'s ask, Oct 22 2026: how many attempts each player has made, on his scoreboard alone): a board entry carries a, the runs of the day on that phone; a person\'s phones add up, the day\'s and the week\'s; an entry from before it (or a bad one) has none; shown on the owner\'s rows alone', async () => {
    const ea = (y, a) => Object.assign(e(y, y, 0, 1), a === undefined ? {} : {a});
    const kept = R.entryOf({rm2: {1: ea(300, 4)}}, 1).a === 4 && !('a' in R.entryOf({rm2: {1: ea(300)}}, 1))
      && [0, -1, 2.5, '3', 10000].every(a => !('a' in R.entryOf({rm2: {1: ea(300, a)}}, 1)));
    const docs = [
      doc('ra-a', 'Mason', {1: ea(400, 3), 2: ea(100, 1)}),
      doc('ra-b', 'Mason', {1: ea(200, 2)}, {last: 2}),
      doc('ra-c', 'Jacob', {1: ea(300)}),
      doc('ra-d', 'Tommy', {2: ea(250, 6)})
    ];
    const day = R.boardRows(1, docs).map(r => `${r.name.split(' ')[0]} ${r.y}/${r.a}`).join(', ');
    const week = R.weekRows(2, docs, 2).map(r => `${r.name.split(' ')[0]} ${r.y}/${r.a}`).join(', ');
    const sum = R.attemptsOf(docs.slice(0, 2), 1) === 5 && R.attemptsOf([docs[2]], 1) === null && R.attemptsOf([], 1) === null;
    const view = await fetch(new URL('../views/return.js', import.meta.url)).then(r => r.text()).catch(() => '');
    const gated = /const attemptsSub = r => \(data\.isOwner\(\) && r\.a != null \?/.test(view) && /\+ attemptsSub\(r\);/.test(view);
    const pass = kept && sum && day === 'Mason 400/5, Jacob 300/null' && week === 'Mason 500/6, Jacob 300/null, Tommy 250/6' && gated;
    return {pass, detail: `kept ${kept}; added up ${sum}; day ${day}; week ${week}; on the owner's rows alone ${gated}`};
  });
  check('Return Man: THE RULE (CLAUDE.md): the scoreboard reads the board as this phone may see it (daily.LB.raw), never every doc: a guest on the board only on their own phones and the league owner\'s; Ryan D for everyone', async () => {
    const LB = daily.LB, raw = LB.raw, all = LB.all, players = LB.players;
    const member = doc('rr-m', 'Mason', {1: e(300, 150, 1, 1)}), guest = doc('rr-g', 'Zed Q', {1: e(900, 500, 4, 1)}, {g: true});
    const ryanD = doc('rr-d', 'Ryan Dow', {1: e(200, 90, 0, 1)});
    let out;
    try {
      LB.all = [member, guest, ryanD];
      LB.raw = LB.all.filter(p => daily.boardShows(p, false)); // a league phone's board
      LB.players = LB.raw;
      const rows = R.boardRows(1), week = R.weekRows(1, undefined, 1);
      out = {rows: rows.map(r => r.name).join(), week: week.map(r => r.name).join(), shown: daily.boardShows(guest, false), owner: daily.boardShows(guest, true), ryan: rows.some(r => r.name === 'Ryan D')};
    } finally { LB.raw = raw; LB.all = all; LB.players = players; }
    const files = ['./return.js', '../views/return.js'];
    const srcs = await Promise.all(files.map(f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '')));
    const reads = srcs.map((s, i) => (s && !s.split('\n').some(l => /LB\.all\b/.test(l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))) ? '' : files[i])).filter(Boolean);
    const pass = !out.shown && out.owner && !/Zed/.test(out.rows) && !/Zed/.test(out.week) && out.ryan && /Mason/.test(out.rows) && !reads.length;
    return {pass, detail: `rows ${out.rows}; week ${out.week}; guest shown ${out.shown} (on the owner's phone ${out.owner}); ${reads.length ? 'reads LB.all: ' + reads.join() : 'no LB.all reads'}`};
  });
  check('Return Man is open to the league in beta (Oct 2026): on every phone\'s list and /puzzles/return opens its page (the owner\'s, a member\'s, a guest\'s); its case wears a BETA tag (front and back), the other games\' don\'t', () => {
    const who = ['evan', 'mitch', null];
    const open = who.every(w => gameFor('return', w) === 'return');
    const lists = who.map(w => gamesFor(w).map(g => g.id).join());
    // (the owner's list has The Keep's case too, his alone: views/games.js)
    const all = lists.every(l => l.split(',').filter(g => g !== 'keep').join() === 'puzzles,17-0,drill,kick,return') && lists.slice(1).every(l => !l.split(',').includes('keep'));
    const host = document.createElement('div');
    host.innerHTML = listHTML();
    const tagged = [...host.querySelectorAll('.gm-slot:not([data-gm-clone])')].filter(sl => sl.querySelector('.gm-front .gm-beta')).map(sl => sl.dataset.gmSlot).join();
    const beta = tagged === 'return' && GAMES.filter(g => g.beta).map(g => g.id).join() === 'return';
    return {pass: open && all && beta, detail: `opens on every phone ${open}; lists ${lists.join(' | ')}; BETA on ${tagged || 'none'}`};
  });
  check('Return Man\'s case turns before it\'s played (the owner\'s ask, Oct 22 2026, for everyone: "the game is repeatable"): on the shelf it stands on its front to play, today\'s leaderboard on its back (TODAY, not FINAL), its edges grab to turn it like a finished game\'s; an unplayed game\'s case still doesn\'t turn', async () => {
    const LB = daily.LB, saved = {raw: LB.raw, all: LB.all, players: LB.players, ready: LB.ready, off: LB.off, err: LB.err}, was = shelfDev.cores.rm;
    const n = R.todayNumber(), mason = doc('rt-m', 'Mason', {[n]: e(300, 150, 1, 1)});
    let back = null, cls = '', others = '', board = '';
    try {
      LB.raw = LB.all = LB.players = [mason]; LB.ready = true; LB.off = false; LB.err = undefined;
      shelfDev.cores.rm = R;
      board = R.boardState();
      const host = document.createElement('div');
      host.innerHTML = listHTML();
      const cs = host.querySelector('.gm-slot:not([data-gm-clone]) .gm-case[data-gm="return"]');
      cls = cs ? cs.className : '';
      back = cs && cs.querySelector('.gm-back');
      others = [...host.querySelectorAll('.gm-slot:not([data-gm-clone]) .gm-case.is-turns')].map(c => c.dataset.gm).join();
    } finally { Object.assign(LB, saved); shelfDev.cores.rm = was; }
    const txt = back ? back.textContent : '';
    const shows = /Today’s leaderboard/.test(txt) && /TODAY/.test(txt) && !/FINAL/.test(txt) && (board === 'ready' ? /Mason/.test(txt) : !!back.querySelector('.gm-scr-note'));
    const [turner, css] = await Promise.all(['../views/game-case.js', '../../css/views/puzzles.css'].map(f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '')));
    const turns = /is-turns'\) \? \[FRONT, BACK\]/.test(turner) && /closest\('\.gm-case\.is-done, \.gm-case\.is-turns'\)/.test(turner) && /\.gm-case:not\(\.is-done\):not\(\.is-turns\) \.gm-grip \{ display: none; \}/.test(css);
    const pass = /\bis-turns\b/.test(cls) && !/\bis-done\b/.test(cls) && shows && others === 'return' && turns;
    return {pass, detail: `the case ${cls}; its back ${shows ? 'today\'s leaderboard' : 'WRONG: ' + txt.slice(0, 80)} (board ${board}); cases that turn unplayed: ${others || 'none'}; grabbed and turned like a finished one ${turns}`};
  });
  check('Return Man\'s case has a flip button under it (the owner\'s ask, Oct 22 2026, his profile only: "Add a view scoreboard or flip case button"): View scoreboard turns the case in the middle round to its leaderboard, Flip to the cover turns it back; no one else has the button', async () => {
    const [view, turner] = await Promise.all(['../views/games.js', '../views/game-case.js'].map(f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '')));
    const gated = /const flipHTML = s => \(s\.turns && s\.kind !== 'done' && data\.isOwner\(\)/.test(view) && /<span>Tap the case to play<\/span><\/p>` \+ flipHTML\(s\);/.test(view);
    const wired = /if \(e\.target\.closest\('\[data-gm-flip\]'\)\) \{/.test(view) && /turner\.flip\(c\) != null/.test(view) && /shelfTurner\(shelf, \{rest: \(\) => syncFlip\(\)\}\)/.test(view)
      && /on \? 'Flip to the cover' : 'View scoreboard'/.test(view);
    const flips = /flip\(cs\) \{\s*\n\s*if \(!cs \|\| !cs\.matches\('\.gm-case\.is-done, \.gm-case\.is-turns'\)/.test(turner) && /S\.goal = target\(S\) === BACK \? FRONT : BACK;/.test(turner) && /rest\(S\.cs\);/.test(turner);
    return {pass: gated && wired && flips, detail: `the owner's alone ${gated}; wired to the case in the middle ${wired}; the turner turns it ${flips}`};
  });
  // ------------------------------------------------------------------------------------------- the hard course
  check('Return Man: the hard course (the owner\'s ask, Oct 2026: a run of 90 seconds to 3 minutes, his profile only for now): a course of its own (the regular one as it was); quicker from the start and never done speeding up (past 30 yards a second by 3,000 yards; the regular course tops out at 19); the beats keep closing in; potholes, none in the first 40 yards; no tackling sleds (the owner\'s ask, Oct 22 2026: "Remove the obstacle with the two pillars"), their lanes left open where they were drawn (sl: only with the road open all the way across, never in every lane)', () => {
    const bad = [];
    let holes = 0, sleds = 0, gone = 0, late = [];
    const differ = R.course(3, 0) !== R.course(3, 0, true) && R.course(3, 0, true) === R.course(3, 0, true) && !R.course(3, 0).hard && R.startRun(3, 0).co === R.course(3, 0) && R.startRun(3, 0, true).co.hard === true;
    const v = [0, 300, 1000, 3000, 6000].map(z => R.speedAt(z, true)), v0 = [0, 300, 1000, 3000, 6000].map(z => R.speedAt(z));
    const speed = v.every((x, i) => x > v0[i] && (!i || x >= v[i - 1])) && v[3] > 30 && v[2] > 22 && v0.every(x => x <= 19);
    for (let n = 1; n <= 12; n++) {
      const co = R.fill(R.course(n, 0, true), 4000), rows = co.rows;
      rows.forEach((r, i) => {
        const men = r.lanes.filter(Boolean), sl = (r.sl || []).length;
        holes += r.lanes.filter(t => t === 'hole').length; sleds += r.lanes.filter(t => t === 'sled').length; gone += sl;
        if ((r.sl || []).some(l => r.lanes[l])) bad.push(`day ${n} row ${i}: something where a sled was`);
        if (men.some(t => !R.OBST[t])) bad.push(`day ${n} row ${i}: a ${men.join('/')}`);
        if (r.z < 40 && men.some(t => t !== 'hurdle')) bad.push(`day ${n}: a ${men.join('/')} at ${Math.round(r.z)} yds`);
        if (sl && (sl > 2 || co.sets.some(s => r.z >= s.zs && r.z <= s.ze && s.plats.length))) bad.push(`day ${n}: ${sl} sleds at ${Math.round(r.z)} yds${sl < 3 ? ' beside a vehicle' : ''}`);
        if (i && r.z > 2500 && !co.sets.some(s => r.z >= s.zs - 1 && r.z <= s.ze + 60)) late.push((r.z - rows[i - 1].z) / R.speedAt(rows[i - 1].z, true));
      });
    }
    const lateT = late.reduce((a, x) => a + x, 0) / Math.max(1, late.length);
    const pass = differ && speed && !bad.length && holes > 100 && sleds === 0 && gone > 100 && lateT < .55;
    return {pass, detail: `its own course ${differ}; speed ${v.map(x => x.toFixed(1)).join(', ')} (regular ${v0.map(x => x.toFixed(1)).join(', ')}); ${holes} potholes, ${sleds} sleds (${gone} lanes left open where one was) on 12 days to 4,000 yds; past 2,500 yds the rows ${lateT.toFixed(2)} s apart; ${bad.length ? bad.slice(0, 4).join('; ') : 'every row has a way through'}`};
  });
  check('Return Man: the hard course can always be run: a returner who reads it right (no power-ups) gets 3,000 yards on the hard kickoffs of days 1-5 without a hit', () => {
    const out = [];
    for (let n = 1; n <= 5; n++) { const b = bot(n, 0, 3000, true); if (b.over || b.hits) out.push(`day ${n}: ${b.over ? 'down' : b.hits + ' hits'} at ${Math.round(b.z)} (${R.endOf(b) || 'stumbled'})`); }
    return {pass: !out.length, detail: out.length ? out.join('; ') : '5 hard kickoffs to 3,000 yards, not a hit'};
  });
  check('Return Man: on the hard course, a pothole is jumped (a slide goes in it, so does running on), named for its place ("Stepped in the crater" in space); a tackling sled is juked round (a jump or a slide runs into it); head on into a tall vehicle is the end of the return ("Ran into the team bus"), but the salts shake it off, painkillers take him up onto it, and on the regular course it\'s still a stumble', () => {
    const lanes = t => [null, t, null];
    const hard = (lanes2, move, t = .15) => {
      const run = field({rows: [{i: 0, z: 30, lanes: lanes2, th: 'space'}], hard: true});
      let out = null, moved = !move, e = null;
      for (let i = 0; i < 2000 && !out; i++) {
        if (!moved && (30 - run.z) / R.speedAt(run.z, true) <= t) { R.move(run, move); moved = true; }
        e = R.step(run, 1 / 120).find(x => x.type !== 'td' && x.type !== 'landed' && x.type !== 'coned'); // (the pothole's cone: checked below)
        if (e) out = e;
      }
      return out;
    };
    const hole = [hard(lanes('hole'), 'up'), hard(lanes('hole'), 'down'), hard(lanes('hole'), null)].map(e => e && e.type).join();
    const named = R.hitLine(hard(lanes('hole'), null)) === 'Stepped in the crater' && R.hitLine({ob: 'hole', row: {th: 'city'}}) === 'Stepped in the pothole';
    const sled = [hard(lanes('sled'), 'up'), hard(lanes('sled'), 'down'), hard(lanes('sled'), null), hard(lanes('sled'), 'left', .25)].map(e => e && e.type).join();
    const bus = items => { const r = play({sets: [set(plat(1, 30, 50, true))], items, hard: true}, 4); return r; };
    const crash = bus(), salts = bus([{i: 0, z: 10, lane: 1, top: false, kind: 'salts'}]), pills = bus([{i: 0, z: 10, lane: 1, top: false, kind: 'pills'}]);
    const ended = crash.run.over && crash.run.why === 'crash' && crash.ev.includes('crashed') && !crash.ev.includes('stumbled') && R.endOf(crash.run) === 'Ran into the team bus';
    const saved = !salts.run.over && salts.ev.includes('revived') && !pills.run.over && pills.ev.includes('vaulted');
    const regular = play({sets: [set(plat(1, 30, 50, true))]}, 4), still = !regular.run.over && regular.ev.includes('stumbled');
    const pass = hole === 'hurdled,stumbled,stumbled' && named && sled === 'stumbled,stumbled,stumbled,juked' && ended && saved && still;
    return {pass, detail: `pothole: ${hole} (${named ? 'named for its place' : 'WRONG name'}); sled: ${sled}; head on: ${ended ? 'the end' : 'WRONG'}, salts ${salts.run.over ? 'WRONG' : 'shook it off'}, painkillers ${pills.run.over ? 'WRONG' : 'up onto it'}; regular course ${still ? 'a stumble' : 'WRONG'}`};
  });
  check('Return Man: the hard course\'s power-ups (the owner\'s ask, Oct 2026): the smelling salts burst him on for 10 seconds (4 on the regular course); painkillers carry him through a barricade, a banner, a pothole, a sled and up onto a bus without a stumble; booze doubles his yards for 8 seconds; their words say so', () => {
    // (how much faster than the course's own speed where he is, from seconds after he picks them up)
    const pace = (hard, from) => {
      const r = field({items: [{i: 0, z: 5, lane: 1, top: false, kind: 'salts'}], hard});
      for (let i = 0; i < 120 * from; i++) R.step(r, 1 / 120);
      const z0 = r.z; R.step(r, 1 / 120);
      return (r.z - z0) * 120 / R.speedAt(z0, hard);
    };
    const tenS = R.burstSecs(R.startRun(1, 0, true)) === 10 && R.burstSecs(R.startRun(1, 0)) === R.BURST.s;
    const hard = [pace(true, 8.5), pace(true, 11)], reg = [pace(false, 2.5), pace(false, 5)];
    const burst = Math.abs(hard[0] - (1 + R.BURST.k)) < .01 && Math.abs(hard[1] - 1) < .01 && Math.abs(reg[0] - (1 + R.BURST.k)) < .01 && Math.abs(reg[1] - 1) < .01;
    const row = (z, t) => ({i: z, z, lanes: [null, t, null], th: 'city'});
    const pills = play({items: [{i: 0, z: 10, lane: 1, top: false, kind: 'pills'}], rows: [row(25, 'hurdle'), row(35, 'bar'), row(45, 'hole'), row(55, 'sled')], sets: [set(plat(1, 70, 90, true))], hard: true}, 6);
    const through = !pills.run.over && pills.run.hits === 0 && pills.ev.filter(e => e === 'trucked').length === 4 && pills.ev.includes('vaulted') && !pills.ev.includes('stumbled');
    const booze = field({items: [{i: 0, z: 10, lane: 1, top: false, kind: 'booze'}], hard: true});
    let y8 = 0, z8 = 0;
    for (let i = 0; i < 120 * 12; i++) { R.step(booze, 1 / 120); if (booze.booze > 0) { y8 = booze.yards; z8 = booze.z; } }
    const dbl = R.POWER.booze.s === 8 && y8 - 10 > (z8 - 10) * 1.95 && booze.yards - y8 < (booze.z - z8) * 1.05;
    const words = R.powerOf('salts', true).does.startsWith('A 10-second burst') && R.powerOf('salts', false) === R.POWER.salts && /without stumbling/.test(R.powerOf('pills', true).does) && /blurry/.test(R.powerOf('booze', true).is);
    return {pass: tenS && burst && through && dbl && words, detail: `salts: ${R.burstSecs(R.startRun(1, 0, true))} s hard (${hard.map(x => x.toFixed(2) + '×').join(' then ')}), ${R.BURST.s} s regular (${reg.map(x => x.toFixed(2) + '×').join(' then ')}); painkillers: ${through ? 'through all four and up onto the bus, not a stumble' : 'WRONG ' + pills.ev.join()}; booze: double ${dbl}; words ${words}`};
  });
  check('Return Man: on Evan\'s hard course, the second distinct unprotected collision after a stumble is a tackle, even after a clean stretch or within collision grace; duplicate contact is still ignored; regular courses retain timed recovery', () => {
    const row = (z, ob = 'hurdle', lane = 1) => ({i: z, z, lanes: [0, 1, 2].map(l => l === lane ? ob : null)});
    const distant = play({hard: true, rows: [row(1), row(300, 'bar'), row(301), row(302)]}, 40);
    const rapid = play({hard: true, rows: [row(1), row(2, 'sled'), row(3)]}, 2);
    const regular = play({rows: [row(1), row(300, 'bar')]}, 40);
    const repeat = field({hard: true, rows: [row(1, 'hurdle', 0)]}, 0);
    R.move(repeat, 'left'); const first = R.step(repeat, 1 / 120);
    R.move(repeat, 'left'); const same = R.step(repeat, 1 / 120);
    const duplicate = first.some(e => e.type === 'stumbled') && same.some(e => e.type === 'shoved') && !repeat.over;
    const subsequent = [];
    for (let i = 0; i < 120 && !repeat.over; i++) R.step(repeat, 1 / 120).forEach(e => subsequent.push(e.type));
    const caught = r => r.run.over && r.run.why === 'caught' && r.ev.filter(e => e === 'stumbled').length === 1 && r.ev.filter(e => e === 'tackled').length === 1;
    const waiting = play({hard: true, rows: [row(1)]}, 12).run;
    const visible = R.chasing(waiting) && R.gapOf(waiting) <= R.CHASE.edge;
    const unchanged = !regular.run.over && regular.ev.filter(e => e === 'stumbled').length === 2;
    const pass = caught(distant) && caught(rapid) && duplicate && repeat.why === 'caught' && subsequent.includes('tackled') && visible && unchanged;
    return {pass, detail: `distant ${distant.ev.join(',')}; rapid ${rapid.ev.join(',')}; duplicate ignored ${duplicate}, next object ${repeat.why}; linebacker stays visible ${visible}; regular recovery ${unchanged}`};
  });
  check('Return Man: the hard course\'s stumble penalty survives painkillers but a smelling-salts revival resets it; protected collisions never become extra stumbles', () => {
    const row = z => ({i: z, z, lanes: [null, 'hurdle', null]});
    const saved = field({hard: true, rows: [1, 2, 200, 201].map(row)});
    saved.salts = 1;
    const events = [];
    for (let i = 0; i < 120 * 30 && !saved.over; i++) R.step(saved, 1 / 120).forEach(e => events.push(e.type));
    const life = events.filter(e => ['stumbled', 'revived', 'tackled'].includes(e)).join(',') === 'stumbled,revived,stumbled,tackled' && saved.salts === 0 && saved.shield === 0;
    const protectedRun = field({hard: true, rows: [1, 2, 3, 200].map(row)});
    const protectedEvents = [];
    for (let i = 0; i < 120 * 30 && !protectedRun.over; i++) {
      const ev = R.step(protectedRun, 1 / 120); ev.forEach(e => protectedEvents.push(e.type));
      if (ev.some(e => e.type === 'stumbled')) protectedRun.pills = 6;
    }
    const pills = protectedRun.why === 'caught' && protectedRun.hits === 1 && protectedEvents.filter(e => e === 'trucked').length === 2;
    const fresh = R.startRun(1, 0, true);
    return {pass: life && pills && !fresh.stumblePending && fresh.hits === 0,
      detail: `salts ${events.join(',')}; painkillers ${protectedEvents.join(',')}; new run starts clean ${!fresh.stumblePending}`};
  });
  check('Return Man: Evan\'s smelling salts never shield another obstacle, during the pickup burst or immediately after a revival; the regular course retains its revival protection', () => {
    const row = (z, ob = 'hurdle') => ({i: z, z, lanes: [null, ob, null]});
    const course = {items: [{i: 0, z: 1, lane: 1, kind: 'salts'}], rows: [row(2), row(20, 'bar'), row(21, 'sled')]};
    const owner = play({...course, hard: true}, 4), regular = play(course, 4);
    const hits = owner.ev.filter(e => ['stumbled', 'revived', 'tackled', 'trucked'].includes(e)).join(',');
    const immediate = owner.run.over && owner.run.why === 'caught' && owner.run.shield === 0 && owner.run.burst > 0 && hits === 'stumbled,revived,tackled';
    const unchanged = !regular.run.over && regular.ev.includes('revived') && regular.ev.includes('trucked');
    return {pass: immediate && unchanged, detail: `owner ${hits}, shield ${owner.run.shield}; regular ${regular.ev.join(',')}, shield ${regular.run.shield.toFixed(2)}`};
  });
  // ------------------------------------------------------------------------------------------- the owner's build
  check('Return Man: Evan\'s build (his ask, Oct 21 2026: "the return man football player looks too skinny. add some defined muscles and bulk him up a bit"; views/return-player-bulk.js, on his navy kit alone): sculpted in the bind pose, off the page\'s thread: his limbs a good deal thicker at the belly (each 10-30%), shaped (the biceps and the calf\'s back fuller than their other sides), the skin of his hands, feet and head untouched; UVs, skin weights and faces as they were, no seam opened, every normal whole; the shoulder kept inside its pads; the ball out with his forearm; the ghost given the same at once; undone, his own geometry back and the copies let go; the model itself never touched; his kit the only way in, the offline cache leaving it out', async () => {
    const V = new URL('../vendor/three/', import.meta.url).href;
    const [T, {GLTFLoader}, SK, BU, styleSrc, swSrc] = await Promise.all([import(V + 'three.module.min.js'), import(V + 'GLTFLoader.js'),
      import(V + 'SkeletonUtils.js'), import('../views/return-player-bulk.js'),
      fetch(new URL('../views/return-player-style.js', import.meta.url)).then(r => r.text()), fetch(new URL('../../sw.js', import.meta.url)).then(r => r.text())]);
    const gltf = await new GLTFLoader().loadAsync(new URL('../../models/return-player.glb', import.meta.url).href);
    const bare = n => n.replace(/^mixamorig:?/, '').replace(/^xtra_(.+)_\d+$/, '$1');
    // a player as views/return-3d.js dress() makes him: the model cloned (in its bind pose), the ball on his right forearm
    const make = () => {
      const model = SK.clone(gltf.scene), B = {};
      model.updateMatrixWorld(true);
      model.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
      const at = n => B[n].getWorldPosition(new T.Vector3()), ball = new T.Group();
      B.RightForeArm.add(ball);
      ball.position.copy(B.RightForeArm.worldToLocal(at('RightHand').lerp(at('RightForeArm'), .3).add(new T.Vector3(0, -.02, .07))));
      return {model, B, ball};
    };
    const P = make(), inv = P.model.matrixWorld.clone().invert(), meshes = [];
    P.model.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    const sources = meshes.map(m => m.geometry);
    const sig = g => Object.values(g.attributes).map(a => { const arr = a.isInterleavedBufferAttribute ? a.data.array : a.array; let h = 0; for (let i = 0; i < arr.length; i++) h = (h * 31 + arr[i]) | 0; return h; }).join();
    const kept = sources.map(sig), ballAt = P.ball.position.clone(), ballWas = P.ball.getWorldPosition(new T.Vector3()).applyMatrix4(inv);
    const t0 = performance.now(), undo = BU.bulkUp(P, T), page = performance.now() - t0;
    const ready = await undo.ready, took = performance.now() - t0;
    const moved = meshes.filter((m, i) => m.geometry !== sources[i]), names = moved.map(m => m.material.name);
    // each vertex where the model has it (bind pose), as it came and as sculpted
    const space = (m, g) => {
      const sk = m.skeleton, b = g.attributes.skinIndex.getX(0), D = inv.clone().multiply(sk.bones[b].matrixWorld).multiply(sk.boneInverses[b]);
      const p = g.attributes.position, v = new T.Vector3(), out = new Float64Array(p.count * 3);
      for (let i = 0; i < p.count; i++) v.fromBufferAttribute(p, i).applyMatrix4(D).toArray(out, i * 3);
      return out;
    };
    const FIELDS = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder', ...['Left', 'Right'].flatMap(s => ['Arm', 'ForeArm', 'UpLeg', 'Leg'].map(n => s + n))]);
    const pads = ['Left', 'Right'].map(s => ({c: P.B[s + 'Arm'].getWorldPosition(new T.Vector3()).applyMatrix4(inv).add(new T.Vector3(s === 'Left' ? .008 : -.008, .003, .003)), r: new T.Vector3(.095, .055, .105)}));
    let still = 0, maxStill = 0, kept2 = true, seams = 0, seamGap = 0, norms = true, padOut = 0;
    const gains = {};
    for (const m of moved) {
      const src = sources[meshes.indexOf(m)], g = m.geometry, A0 = space(m, src), A1 = space(m, g), sk = m.skeleton, skin = m.material.name === 'Bodymat';
      const si = src.attributes.skinIndex, sw = src.attributes.skinWeight, nrm = g.attributes.normal, seen = new Map();
      for (const k of ['uv', 'skinIndex', 'skinWeight']) { // (UVs, skin weights: as they were)
        const a = src.attributes[k], b = g.attributes[k], get = ['getX', 'getY', 'getZ', 'getW'].slice(0, a ? a.itemSize : 0);
        for (let i = 0; a && i < a.count && kept2; i++) for (const x of get) if (a[x](i) !== b[x](i)) kept2 = false;
      }
      if (src.index && (src.index.count !== g.index.count || src.index.array.some((x, i) => x !== g.index.array[i]))) kept2 = false;
      for (let i = 0; i < si.count; i++) {
        const d = Math.hypot(A1[i * 3] - A0[i * 3], A1[i * 3 + 1] - A0[i * 3 + 1], A1[i * 3 + 2] - A0[i * 3 + 2]);
        const ws = [[si.getX(i), sw.getX(i)], [si.getY(i), sw.getY(i)], [si.getZ(i), sw.getZ(i)], [si.getW(i), sw.getW(i)]];
        if (skin && ws.every(([b, w]) => !(w > 0) || !FIELDS.has(bare(sk.bones[b].name)))) { still++; maxStill = Math.max(maxStill, d); }
        // a seam's split vertices: one place before, one place after
        const key = [src.attributes.position.getX(i), src.attributes.position.getY(i), src.attributes.position.getZ(i)].join();
        if (seen.has(key)) { const j = seen.get(key); seams++; seamGap = Math.max(seamGap, Math.hypot(A1[i * 3] - A1[j * 3], A1[i * 3 + 1] - A1[j * 3 + 1], A1[i * 3 + 2] - A1[j * 3 + 2])); }
        else seen.set(key, i);
        const n0 = src.attributes.normal, as = Math.abs(nrm.getX(i) - n0.getX(i)) + Math.abs(nrm.getY(i) - n0.getY(i)) + Math.abs(nrm.getZ(i) - n0.getZ(i));
        if (!(Math.abs(Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) - 1) < 1e-3 || as < 1e-6)) norms = false; // (unit, or the model's own)
        for (const pad of pads) {
          const e0 = new T.Vector3(A0[i * 3], A0[i * 3 + 1], A0[i * 3 + 2]).sub(pad.c).divide(pad.r).length();
          if (e0 < 1 && new T.Vector3(A1[i * 3], A1[i * 3 + 1], A1[i * 3 + 2]).sub(pad.c).divide(pad.r).length() >= 1) padOut++;
        }
      }
      // each limb's gain at its belly: the mean distance from its bone before and after, in fifths along it (the
      // fullest fifth); and that fifth's mean push on each side of it (front, outer, back, inner)
      for (const [bone, to] of [['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'], ['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot']]) {
        const j = P.B[bone].getWorldPosition(new T.Vector3()).applyMatrix4(inv), ax = P.B[to].getWorldPosition(new T.Vector3()).applyMatrix4(inv).sub(j), L = ax.length();
        ax.normalize();
        const f = new T.Vector3(0, 0, 1).addScaledVector(ax, -ax.z).normalize(), o = new T.Vector3(1, 0, 0).addScaledVector(ax, -ax.x).addScaledVector(f, -f.x).normalize();
        const bins = Array.from({length: 5}, () => ({r0: 0, r1: 0, n: 0, sides: {}}));
        for (let i = 0; i < si.count; i++) {
          let w = 0;
          for (const [b, x] of [[si.getX(i), sw.getX(i)], [si.getY(i), sw.getY(i)], [si.getZ(i), sw.getZ(i)], [si.getW(i), sw.getW(i)]]) if (bare(sk.bones[b].name) === bone) w += x;
          if (w < .6) continue;
          const v0 = new T.Vector3(A0[i * 3], A0[i * 3 + 1], A0[i * 3 + 2]).sub(j), v1 = new T.Vector3(A1[i * 3], A1[i * 3 + 1], A1[i * 3 + 2]).sub(j), t = v0.dot(ax) / L;
          if (t < 0 || t >= 1) continue;
          const q0 = v0.clone().addScaledVector(ax, -v0.dot(ax)), r0 = q0.length(), r1 = v1.clone().addScaledVector(ax, -v1.dot(ax)).length();
          if (r0 > .13) continue;
          const bin = bins[Math.floor(t * 5)], side = Math.round(Math.atan2(q0.dot(o), q0.dot(f)) / (Math.PI / 2)) & 3;
          bin.r0 += r0; bin.r1 += r1; bin.n++;
          const s = bin.sides[side] || (bin.sides[side] = [0, 0]);
          s[0] += r1 - r0; s[1]++;
        }
        const best = bins.filter(b => b.n > 5).sort((a, b) => b.r1 / b.r0 - a.r1 / a.r0)[0];
        const side = k => (best.sides[k] ? best.sides[k][0] / best.sides[k][1] : 0);
        if (best) gains[bone + '/' + m.material.name] = {gain: best.r1 / best.r0 - 1, front: side(0), outer: side(1), back: side(2), inner: side(3)};
      }
    }
    const arm = gains['LeftArm/Bodymat'], fore = gains['LeftForeArm/Bodymat'], thigh = gains['LeftUpLeg/pants'], calf = gains['LeftLeg/Default'];
    const thick = [arm, fore, thigh, calf].every(x => x && x.gain >= .1 && x.gain <= .3);
    const shaped = !!arm && arm.front > 1.5 * arm.inner && !!calf && calf.back > 2 * calf.front;
    const ballOut = P.ball.getWorldPosition(new T.Vector3()).applyMatrix4(inv).distanceTo(ballWas);
    // the ghost: the same sculpt, at once
    const G = make(), t1 = performance.now(), undoG = BU.bulkUp(G, T), ghostPage = performance.now() - t1, ghostReady = await undoG.ready, gm = [];
    G.model.traverse(o => { if (o.isSkinnedMesh) gm.push(o); });
    const same = gm.every((o, i) => (o.geometry === sources[i] ? meshes[i].geometry === sources[i] : o.geometry.attributes.position.array === meshes[i].geometry.attributes.position.array));
    // undone: his own geometry back, the copies let go
    let freed = 0;
    moved.forEach(m => m.geometry.addEventListener('dispose', () => { freed++; }));
    undo(); undoG();
    const back = meshes.every((m, i) => m.geometry === sources[i]) && P.ball.position.equals(ballAt) && freed === moved.length;
    const untouched = sources.every((g, i) => sig(g) === kept[i]);
    const hook = /import \{bulkUp\} from '\.\/return-player-bulk\.js';/.test(styleSrc) && /restore\.push\(bulkUp\(P, T\)\)/.test(styleSrc);
    const offline = !swSrc.includes("'return-player-bulk'") && swSrc.includes('return-player-(style|bulk)');
    const want = ['Bodymat', 'shirt_0', 'pants', 'Default'].every(n => names.includes(n)) && !names.includes('sepatu_key.obj');
    const pass = ready && want && thick && shaped && maxStill < 1e-6 && kept2 && seamGap < 1e-6 && norms && padOut === 0 && ballOut > .002 && ballOut < .025 &&
      ghostReady && same && back && untouched && hook && offline && page < 25 && ghostPage < 10;
    const pc = x => (x ? Math.round(x.gain * 100) + '%' : 'none'), mm = x => (x * 1000).toFixed(1);
    return {pass, detail: `sculpted ${ready} (${names.join(', ')}); at the belly: upper arm +${pc(arm)}, forearm +${pc(fore)}, thigh +${pc(thigh)}, calf +${pc(calf)}; shaped ${shaped} (biceps ${arm ? mm(arm.front) : '-'} mm, its inner side ${arm ? mm(arm.inner) : '-'}; calf's back ${calf ? mm(calf.back) : '-'}, its front ${calf ? mm(calf.front) : '-'}); skin of his hands, feet and head moved ${(maxStill * 1000).toFixed(3)} mm (${still} vertices); UVs, weights and faces kept ${kept2}; ${seams} seam vertices, the widest apart ${(seamGap * 1000).toFixed(3)} mm; normals whole ${norms}; out of a pad ${padOut}; the ball out ${mm(ballOut)} mm; the ghost the same ${same} (${ghostPage.toFixed(1)} ms); undone ${back}; the model untouched ${untouched}; the kit's hook ${hook}; out of the offline cache ${offline}; ${page.toFixed(1)} ms on the page, sculpted in ${Math.round(took)} ms`};
  });
  // The owner's ask (Oct 21 2026): "remove the snow pile obstacle. add a cone in front of the pothole. this should be the
  // only obstacle you fall into." (His hard course; the league's regular course and board as they were.)
  check('Return Man: no snow pile on the hard course (the owner\'s ask, Oct 2026): its frozen tundra has the snowplow alone (80 days\' kickoffs, never a snowbank); the regular course\'s tundra keeps its snowbanks, and the regular course is just as it was (days 1-20, kickoffs 1 and 2, to 1,500 yards: the same to the byte as before the change, fingerprint ' + REG_FP + ')', () => {
    let snow = 0, plows = 0, regSnow = 0;
    for (let n = 1; n <= 80; n++) {
      R.fill(R.course(n, 0, true), 3000).sets.forEach(s => s.plats.forEach(p => { if (p.kind === 'snowbank') snow++; if (p.kind === 'plow') plows++; }));
      R.fill(R.course(n, 0), 3000).sets.forEach(s => s.plats.forEach(p => { if (p.kind === 'snowbank') regSnow++; }));
    }
    const fp = regularPrint(), th = R.THEMES.find(t => t.id === 'tundra');
    const kinds = th.kinds.some(([k]) => k === 'snowbank') && Array.isArray(th.hard) && th.hard.every(([k]) => k !== 'snowbank') && R.THEMES.every(t => t === th || !t.hard);
    const pass = snow === 0 && plows > 100 && regSnow > 100 && fp === REG_FP && kinds;
    return {pass, detail: `hard tundra: ${plows} plows, ${snow} snowbanks; regular tundra: ${regSnow} snowbanks; regular course ${fp === REG_FP ? 'unchanged' : `CHANGED (${fp})`}; kinds ${kinds}`};
  });
  check('Return Man: a traffic cone just before every pothole, in its lane (the owner\'s ask, Oct 2026): on open road, nothing between it and the hole; no obstacle: running through it knocks it flying (\'coned\') and is never a hit: on foot into the pothole (one hit, the pothole\'s), jumping the pothole (over both), juking out of the lane past it; on painkillers through both', () => {
    const bad = [];
    let holes = 0, regular = 0;
    for (let n = 1; n <= 30; n++) {
      const co = R.fill(R.course(n, 0, true), 3000), rows = co.rows;
      rows.forEach(r => r.lanes.forEach((t, l) => {
        if (t !== 'hole') return;
        holes++;
        const zc = R.coneZ(r);
        if (!(Math.abs(r.z - zc - R.CONE.before) < 1e-9 && R.CONE.before - R.HOLE_LEN / 2 >= .3)) bad.push(`day ${n}: the cone ${(r.z - zc).toFixed(2)} yds before the hole at ${r.z}`);
        if ([-.4, 0, .4].some(dz => R.groundAt(co, l, zc + dz) !== 0)) bad.push(`day ${n}: the cone at ${zc.toFixed(1)} on a vehicle`);
        if (rows.some(o => o !== r && o.lanes[l] && o.z > zc - .6 && o.z <= r.z)) bad.push(`day ${n}: something between the cone and the hole at ${r.z}`);
      }));
      regular += R.fill(R.course(n, 0), 3000).rows.filter(r => r.lanes.includes('hole')).length;
    }
    // a pothole in lane 1 at 30 yards (its cone at 28.25): what happens, and the hits
    const row = {i: 0, z: 30, lanes: [null, 'hole', null], th: 'tundra'};
    const go = (moves, items = []) => {
      const r = field({rows: [row], items, hard: true}), ev = [], todo = moves.slice();
      for (let i = 0; i < 360 && !r.over; i++) { while (todo.length && r.z >= todo[0][0]) R.move(r, todo.shift()[1]); ev.push(...R.step(r, 1 / 120).filter(e => e.type !== 'td' && e.type !== 'landed')); }
      return {r, ev, types: ev.map(e => e.type).join()};
    };
    const foot = go([]), jump = go([[24, 'up']]), juke = go([[28.6, 'left']]), pills = go([], [{i: 0, z: 10, lane: 1, top: false, kind: 'pills'}]);
    // (a jump on his way up as he gets to the cone, however late, is sure to clear the hole: over both; one off after
    // it, through the cone and over the hole)
    const late = go([[R.coneZ(row) - .05, 'up']]), after = go([[R.coneZ(row) + .2, 'up']]);
    const hitAt = foot.ev.find(e => e.type === 'stumbled'), coned = foot.ev.find(e => e.type === 'coned');
    const ok = foot.types === 'coned,stumbled' && foot.r.hits === 1 && hitAt.ob === 'hole' && hitAt.z >= 30 && coned.z < 30 && coned.z >= R.coneZ(row) && coned.lane === 1
      && jump.types === 'hurdled' && jump.r.hits === 0 && late.types === 'hurdled' && after.types === 'coned,hurdled' && after.r.hits === 0
      && juke.types === 'coned,juked' && juke.r.hits === 0 && pills.types === 'pickup,coned,trucked' && pills.r.hits === 0 && !R.OBST.cone;
    const pass = ok && !bad.length && holes > 100 && regular === 0;
    return {pass, detail: `${holes} potholes on 30 hard kickoffs to 3,000 yds, ${bad.length ? bad.slice(0, 3).join('; ') : 'a cone before each, on open road'} (the regular course: ${regular}); on foot: ${foot.types} (${foot.r.hits} hit, at ${hitAt ? hitAt.z.toFixed(1) : '-'}); a jump: ${jump.types}; a jump at the last moment: ${late.types}; one just past the cone: ${after.types}; a juke past it: ${juke.types}; painkillers: ${pills.types}`};
  });
  check('Return Man: the pothole is the only thing he falls into (the owner\'s ask, Oct 2026): a hit on one (a stumble, the salts shaking the linebacker off, the tackle) is a fall in (fallsIn); a barricade, a banner, a sled, a low one\'s front, a bus head on, a bus\'s side, the edge of the road, a cone are not; the hit\'s rules are as they were ("Stepped in the ice hole", a stumble, the linebacker); the game starts its fall from fallsIn alone (views/return.js)', async () => {
    const lanes = t => [null, t, null], row = t => ({i: 0, z: 30, lanes: lanes(t), th: 'tundra'});
    const HIT = ['stumbled', 'revived', 'tackled', 'crashed'];
    const first = (course, lane = 1, setup = null) => {
      const r = field(course, lane);
      if (setup) setup(r);
      for (let i = 0; i < 120 * 6 && !r.over; i++) { const e = R.step(r, 1 / 120).find(x => HIT.includes(x.type)); if (e) return e; }
      return null;
    };
    const salts = [{i: 0, z: 10, lane: 1, top: false, kind: 'salts'}], onHim = r => { r.t = 0; r.hitAt = 0; };
    const hits = {
      barricade: first({rows: [row('hurdle')], hard: true}), banner: first({rows: [row('bar')], hard: true}), sled: first({rows: [row('sled')], hard: true}),
      low: first({sets: [set(plat(1, 30, 38, false))], hard: true}), bus: first({sets: [set(plat(1, 30, 50, true))], hard: true}),
      side: first({sets: [set(plat(1, 10, 60, true))], hard: true}, 0, r => { r.z = 20; R.move(r, 'right'); }),
      edge: first({hard: true}, 0, r => R.move(r, 'left')),
      hole: first({rows: [row('hole')], hard: true}), tackled: first({rows: [row('hole')], hard: true}, 1, onHim),
      shook: first({rows: [row('hole')], items: salts, hard: true}, 1, onHim)
    };
    const fall = Object.fromEntries(Object.entries(hits).map(([k, e]) => [k, R.fallsIn(e)]));
    const types = ['hole', 'tackled', 'shook'].map(k => hits[k] && hits[k].type).join();
    const only = Object.entries(fall).every(([k, f]) => f === ['hole', 'tackled', 'shook'].includes(k)) && Object.values(hits).every(Boolean)
      && !R.fallsIn({type: 'coned', row: row('hole'), lane: 1}) && !R.fallsIn({type: 'trucked', ob: 'hole'}) && !R.fallsIn({type: 'shoved', ob: 'hole'}) && !R.fallsIn(null);
    const rules = types === 'stumbled,tackled,revived' && R.hitLine(hits.hole) === 'Stepped in the ice hole' && hits.bus.type === 'crashed' && hits.barricade.type === 'stumbled';
    // the game: one place starts a fall (fallIn), and only for what fallsIn says
    const src = await fetch(new URL('../views/return.js', import.meta.url)).then(r => r.text()).catch(() => '');
    // (and the fall's moves, 'fallin', only ever drawn from a fall that's on: fallOf's)
    const starts = (src.match(/st\.fall = \{/g) || []).length, guarded = /function fallIn\(st, e, now\) \{\s*(?:const run = st\.run;\s*)?if \(!R\.fallsIn\(e\)/.test(src);
    const clips = src.split('\n').filter(l => l.includes('\'fallin\'')), clip = clips.length >= 1 && clips.every(l => /if \(fl[ )&]/.test(l));
    const game = starts === 1 && guarded && clip;
    return {pass: only && rules && game, detail: `falls in: ${Object.entries(fall).filter(([, f]) => f).map(([k]) => k).join(', ') || 'none'} (not: ${Object.entries(fall).filter(([, f]) => !f).map(([k]) => k).join(', ')}); pothole hits ${types}, "${R.hitLine(hits.hole)}"; the game ${game ? 'starts it from fallsIn alone' : `WRONG (${starts} starts, guarded ${guarded}, clip ${clip})`}`};
  });
  check('Return Man: a fall into a pothole never holds the picture back when it matters (fair play): on 20 hard days\' every pothole run into on foot, the picture (him, the camera, the linebacker) is back on him by CHASE.grace after the hit and a quarter second before he gets to the next thing in any lane (a row, a vehicle, a power-up; with that under half a second on, within a third of a yard of him), held back R.FALL.lag yards at most, and he\'s seen down in the hole each time (part way, when the next thing\'s so close the fall\'s cut short); the game draws its camera and him from core\'s fallAt (views/return.js)', async () => {
    const bad = [];
    let falls = 0, down = 0, tight = 0, maxLag = 0, worst = 0;
    for (let n = 1; n <= 20; n++) {
      const co = R.fill(R.course(n, 0, true), 3060);
      co.rows.forEach((row, ri) => row.lanes.forEach((t, l) => {
        if (t !== 'hole' || row.z > 3000) return;
        // on foot into it, from just short of its cone, the linebacker lost
        const run = R.startRun(n, 0, true);
        Object.assign(run, {co, z: R.coneZ(row) - .3, lane: l, x: R.xOf(run, l), t: 100, hitAt: 0, next: ri, nextCone: ri, zone: Math.floor((R.coneZ(row) - .3) / R.ZONE), tds: 99});
        run.nextItem = co.items.findIndex(it => it.z >= run.z); if (run.nextItem < 0) run.nextItem = co.items.length;
        let hit = null;
        for (let i = 0; i < 120 && !hit && !run.over; i++) hit = R.step(run, 1 / 120).find(e => e.type === 'stumbled' && e.row === row) || null;
        if (!hit) return; // (something else got him first: not this check's)
        falls++;
        const plan = R.fallPlan(run, row), t0 = run.t, z0 = row.z, trace = [];
        // the next thing, in any lane, and when he really gets there (on through everything, at his own speed)
        let next = Infinity;
        co.rows.forEach(r => { if (r.z > z0 + .01 && r.z < next && r.lanes.some(Boolean)) next = r.z; });
        co.sets.forEach(s => { if (s.zs > z0 + .01 && s.zs < next) next = s.zs; });
        co.items.forEach(it => { if (it.z > z0 + .01 && it.z < next) next = it.z; });
        run.pills = 99;
        let kMax = 0;
        for (let i = 0; i < 600 && run.z < next; i++) {
          const s = run.t - t0, F = R.fallAt(plan, s, run.z - z0);
          trace.push([s, F.lag]); kMax = Math.max(kMax, F.k);
          R.step(run, 1 / 120);
        }
        const T = run.t - t0, lagAt = s => { let v = 0; trace.forEach(([ts, lg]) => { if (ts <= s) v = lg; }); return v; };
        const before = lagAt(T - .25), atGrace = R.fallAt(plan, R.CHASE.grace, 99).lag;
        maxLag = Math.max(maxLag, ...trace.map(x => x[1])); worst = Math.max(worst, before);
        // (down in it all the way; at least part way when the next thing's so close the fall's cut short)
        if (kMax > (plan.D > R.FALL.min ? .9 : .4)) down++;
        if (T < .46) tight++;
        if (atGrace > 0 || before > (T < .46 ? .3 : .001) || plan.D > R.CHASE.grace) bad.push(`day ${n} at ${z0}: ${before.toFixed(2)} yds held back a quarter second before the next thing (${T.toFixed(2)} s on)`);
      }));
    }
    const src = await fetch(new URL('../views/return.js', import.meta.url)).then(r => r.text()).catch(() => '');
    const view = /R\.fallAt\(f\.plan, s, run\.z - f\.z\)/.test(src) && /st\.camZ = \(run \? run\.z : 0\) - st\.back - \(ui\.RM \? 0 : st\.lag\)/.test(src);
    const pass = !bad.length && falls > 300 && down === falls && maxLag <= R.FALL.lag + 1e-9 && view;
    return {pass, detail: `${falls} falls: back on him by the grace and a quarter second before what's next ${bad.length ? `WRONG ${bad.length}: ${bad.slice(0, 3).join('; ')}` : 'every time'} (${tight} with the next thing under .46 s on: held back at most ${worst.toFixed(2)} yds then); held back ${maxLag.toFixed(2)} yds at most; seen down in it ${down} of ${falls}; the view ${view ? 'draws from fallAt' : 'WRONG'}`};
  });
  // ------------------------------------------------------------------------------------------- the coins
  // The owner's ask (Oct 21 2026): "the return man game should have coins every so often that line up for the player to
  // run through", and "coins are only available on the 1st attempt". His hard course, his first run of the day; The
  // Keep pays 10 Gold a coin (core/realm.js, from the board entry's c).
  check('Return Man coins (the owner\'s ask, Oct 21 2026): on the hard course alone, lines of 6 to 12 gold coins in one lane at his waist, every few seconds, some arcing up over a barricade or a pothole; never in or on a vehicle or its ramp, never by a power-up, never through anything in the lane but the barricade or pothole an arc goes over (well over its cone), the lane clear COIN.react seconds past the last, and no banner (to hide it) or sled (to juke round) in its lane COIN.look seconds before it starts; the same every time and on every phone (however far ahead they\'re laid out; fingerprint ' + COIN_FP + '), day to day different; the hard course itself unchanged (fingerprint ' + HARD_FP + ', coins laid out first or not) and the regular course with none at all (fingerprint ' + REG_FP + ')', () => {
    const C = R.COIN, bad = [];
    let lines = 0, coins = 0, arcs = 0, gaps = 0, gapN = 0, holes = 0, look = 0;
    for (let n = 1; n <= 20; n++) {
      const co = R.coinsTo(R.course(n, 0, true), 3000), L = co.lines.filter(l => l.z0 < 2900);
      L.forEach((l, li) => {
        const cs = co.coins.filter(c => c.line === l.i), v = R.speedAt(l.z0, true), zb = l.end + C.react * R.speedAt(l.end, true);
        lines++; coins += cs.length;
        if (li) { gaps += (l.z0 - L[li - 1].end) / v; gapN++; }
        if (cs.length !== l.n || l.n < C.min || l.n > C.max || cs.some(c => c.lane !== l.lane)) bad.push(`day ${n} line ${l.i}: ${cs.length} coins`);
        if (cs.some((c, i) => i && c.z <= cs[i - 1].z)) bad.push(`day ${n} line ${l.i}: out of order`);
        const over = l.over == null ? null : co.rows.find(r => r.i === l.over);
        if (over) {
          arcs++;
          if (over.lanes[l.lane] !== 'hurdle' && over.lanes[l.lane] !== 'hole') bad.push(`day ${n} line ${l.i}: arcs over a ${over.lanes[l.lane]}`);
          if (!(Math.max(...cs.map(c => c.y)) > C.y + .8) || cs.some(c => c.y < C.y - 1e-9)) bad.push(`day ${n} line ${l.i}: no arc`);
          if (over.lanes[l.lane] === 'hole') {
            holes++;
            const zc = R.coneZ(over);
            if (cs.some(c => Math.abs(c.z - zc) < R.CONE.r + C.r && c.y - C.r < R.CONE.h)) bad.push(`day ${n} line ${l.i}: through the cone`);
          }
        } else if (cs.some(c => c.y !== C.y)) bad.push(`day ${n} line ${l.i}: not at his waist`);
        cs.forEach(c => {
          if (R.groundAt(co, c.lane, c.z) !== 0 || co.sets.some(s => s.plats.some(p => p.lane === c.lane && c.z >= p.z0 - p.ramp - .5 && c.z <= p.z1 + .5))) bad.push(`day ${n} coin ${c.i}: in a vehicle at ${c.z}`);
          if (co.items.some(it => it.lane === c.lane && Math.abs(it.z - c.z) < C.item)) bad.push(`day ${n} coin ${c.i}: by a power-up`);
        });
        co.rows.forEach(r => { if (r.lanes[l.lane] && r !== over && r.z >= l.z0 - C.clear + .01 && r.z <= zb - .01) bad.push(`day ${n} line ${l.i}: a ${r.lanes[l.lane]} in it at ${r.z}`); });
        // (and no banner hiding it or sled to juke round just before it: COIN.look seconds clear of both)
        const zl = l.z0 - C.look * R.speedAt(l.z0, true);
        co.rows.forEach(r => { const t = r.lanes[l.lane]; if ((t === 'bar' || t === 'sled') && r.z >= zl + .01 && r.z < l.z0) { look++; bad.push(`day ${n} line ${l.i}: a ${t === 'bar' ? 'banner' : 'sled'} ${(l.z0 - r.z).toFixed(1)} yds before it`); } });
      });
    }
    const fp = coinPrint(0);
    freshCourses();
    const fp2 = coinPrint(37); // (fresh courses, laid out 37 yards at a time)
    const day = n => JSON.stringify(R.coinsTo(R.course(n, 0, true), 600).lines.filter(l => l.z0 < 500));
    const differ = day(3) !== day(4) && day(4) !== day(5);
    freshCourses();
    const hard = hardPrint(true), regular = regularPrint(), none = [1, 2, 3].every(n => !R.coinsTo(R.fill(R.course(n, 0), 1500), 1500).coins);
    const avg = gaps / Math.max(1, gapN);
    const pass = !bad.length && lines > 200 && arcs > lines / 5 && arcs < lines && holes > 10 && avg > 3 && avg < 9 && fp === COIN_FP && fp2 === fp && differ && hard === HARD_FP && regular === REG_FP && none;
    return {pass, detail: `${lines} lines on 20 days (${coins} coins; ${arcs} arcing, ${holes} of them over potholes), ${avg.toFixed(1)} s apart on average; ${bad.length ? `WRONG ${bad.length}: ${bad.slice(0, 4).join('; ')}` : 'every one clear of vehicles, power-ups and everything in its lane'}; laid out ${fp === COIN_FP ? 'as ever' : `DIFFERENTLY (${fp})`}, the same a bit at a time ${fp2 === fp}, day to day different ${differ}; the hard course ${hard === HARD_FP ? 'unchanged' : `CHANGED (${hard})`}; the regular course ${regular === REG_FP ? 'unchanged' : `CHANGED (${regular})`}, with no coins ${none}`};
  });
  check('Return Man coins: running through them: in his lane every coin of a line is his (an arc by a jump from its jump point, or a twentieth of a second early or late), and nothing in his lane hits him on the way; a slide through a flat line takes them too; juking out of its lane, or jumping over a flat line, misses them; a run without the coins (startRun\'s coins false: every run but the owner\'s first) takes none, and only the hard course has them', () => {
    const bad = [];
    let lines = 0, all = 0, arcs = 0, edges = 0, flats = 0, slid = 0, jukes = 0, juked = 0, hopped = 0, none = 0;
    for (let n = 1; n <= 8; n++) {
      const co = R.coinsTo(R.course(n, 0, true), 3000);
      co.lines.filter(l => l.z0 < 2900).forEach(l => {
        lines++;
        const a = throughLine(co, l);
        if (a.got === l.n && !a.hits) all++; else if (bad.length < 5) bad.push(`day ${n} line ${l.i}: ${a.got}/${l.n}, ${a.hits} hits`);
        if (l.jump != null) {
          arcs++;
          const v = R.speedAt(l.jump, true);
          if (throughLine(co, l, {jump: -.05 * v}).got === l.n && throughLine(co, l, {jump: .05 * v}).got === l.n) edges++;
        } else {
          flats++;
          if (throughLine(co, l, {slide: true}).got === l.n) slid++;
          const j = throughLine(co, l, {juke: true});
          if (j.juked) { jukes++; if (j.got === 0) juked++; }
          if (throughLine(co, l, {hop: true}).got < l.n) hopped++;
        }
        if (throughLine(co, l, {coins: false}).got === 0) none++;
      });
    }
    const regular = !R.startRun(3, 0, false, true).coins && R.startRun(3, 0, true, true).coins && !R.startRun(3, 0, true).coins;
    const pass = !bad.length && lines > 80 && all === lines && edges === arcs && slid === flats && jukes > flats / 2 && juked === jukes && hopped === flats && none === lines && regular;
    return {pass, detail: `${all} of ${lines} lines all his, without a hit${bad.length ? ` (WRONG: ${bad.join('; ')})` : ''}; ${edges} of ${arcs} arcs early or late too; ${slid} of ${flats} flat lines in a slide; juked out of ${juked} of ${jukes} (missed them all), jumped over ${hopped} of ${flats} (missed some); a run without them took none on ${none}; only the hard course's runs have them ${regular}`};
  });
  check('Return Man coins: the first run of the day alone (the owner\'s word: "coins are only available on the 1st attempt"): coinsOpen says so for run 0 on the hard course while none of this person\'s phones has a run of the day on the board (as the board sees it: this phone\'s doc or another of theirs), never for a later run or the regular course; kept on the first run\'s record (c) and no other (no c ever on anyone else\'s runs: their records as they were); the board entry carries it, and The Keep\'s pay reads the most of a person\'s docs (dayCoins)', () => {
    const LB = daily.LB, raw = LB.raw, all = LB.all, players = LB.players, uid = LB.uid, nick = LB.nick;
    // (the boards take this phone's own doc as the profile the kit runs on, whatever its name: "his" docs carry that
    // profile's name, "someone else's" another member's)
    const {self, other: else1} = fixtureNames();
    const me = (rm2) => ({id: 'rc-me', nick: self, total: 0, last: 1, rm2}), other = rm2 => ({id: 'rc-other', nick: self, total: 0, last: 2, rm2}), them = {id: 'rc-them', nick: else1, total: 0, last: 1, rm2: {5: {y: 300, l: 300, td: 3, t: 1}}};
    const ent = (y, c) => Object.assign({y, l: y, td: 0, t: 1}, c == null ? {} : {c});
    const ready = LB.ready, off = LB.off, err = LB.err;
    let open, wait;
    try {
      LB.uid = 'rc-me'; LB.nick = self; LB.ready = true; LB.off = false; LB.err = undefined;
      const at = list => { LB.raw = list; LB.players = list; LB.all = list; return R.coinsOpen(5, 0, true); };
      open = {fresh: at([me({}), them]), mine: at([me({5: ent(80)}), them]), theirs: at([me({}), other({5: ent(80)}), them]), someoneElse: at([me({}), them]),
        later: R.coinsOpen(5, 1, true), regular: R.coinsOpen(5, 0, false), early: R.coinsOpen(R.COIN.fromDay - 1, 0, true), elsewhere: R.ranElsewhere(5) === false};
      at([me({}), other({5: ent(80)}), them]); open.elsewhere = open.elsewhere && R.ranElsewhere(5) === true;
      wait = {ready: R.coinsWait(5, 0, true)};
      // (the board not in yet: no telling it's the first, so none; the first kickoff waits for it, unless it's off)
      at([me({}), them]); LB.ready = false; LB.raw = undefined; LB.players = [];
      open.loading = R.coinsOpen(5, 0, true); wait.loading = R.coinsWait(5, 0, true); wait.later = R.coinsWait(5, 1, true); wait.regular = R.coinsWait(5, 0, false); wait.early = R.coinsWait(R.COIN.fromDay - 1, 0, true);
      LB.ready = true; LB.off = true; open.off = R.coinsOpen(5, 0, true); wait.off = R.coinsWait(5, 0, true);
      LB.off = false; LB.err = 'unavailable'; open.err = R.coinsOpen(5, 0, true); wait.err = R.coinsWait(5, 0, true);
    } finally { LB.raw = raw; LB.all = all; LB.players = players; LB.uid = uid; LB.nick = nick; LB.ready = ready; LB.off = off; LB.err = err; }
    const gate = open.fresh && !open.mine && !open.theirs && open.someoneElse && !open.later && !open.regular && !open.early && open.elsewhere
      && !open.loading && !open.off && !open.err;
    const waits = !wait.ready && wait.loading && !wait.later && !wait.regular && !wait.early && !wait.off && !wait.err;
    // what's kept
    const e0 = R.runEntry(0, 412.7, 500.2, 84), e1 = R.runEntry(1, 300, 300, 50), plain = R.runEntry(0, 120, 130), junk = R.runEntry(0, 10, 10, -4);
    const kept = JSON.stringify(e0) === '{"y":412,"d":500,"c":84}' && JSON.stringify(e1) === '{"y":300,"d":300}' && JSON.stringify(plain) === '{"y":120,"d":130}' && JSON.stringify(junk) === '{"y":10,"d":10}';
    const first = R.firstCoins({r: [e0, {y: 900, d: 900}]}) === 84 && R.firstCoins({r: [{y: 5, d: 5}, {y: 9, d: 9, c: 40}]}) === null && R.firstCoins({r: []}) === null;
    const best = R.officialOf({r: [e0, {y: 900, d: 900}], at: 3});
    const official = !!best && best.yards === 900;
    // the board entry
    const withC = R.entryOf({rm2: {5: ent(600, 84)}}, 5), without = R.entryOf({rm2: {5: ent(600)}}, 5), badC = R.entryOf({rm2: {5: ent(600, 2.5)}}, 5);
    const board = withC && withC.c === 84 && Object.keys(without).join() === 'y,l,td,t' && !('c' in badC);
    const far = R.coinsWithin(5, 2400);
    const pay = far >= 84 && R.dayCoins([me({5: ent(2400)}), other({5: ent(200, 84)}), me({5: ent(10, 12)})], 5) === 84 && R.dayCoins([me({5: ent(600)})], 5) === 0 && R.dayCoins([], 5) === 0 && R.COIN.gold === 10;
    // (never more than the day's course lays out within the yards he posted: a run's coins are all behind him, and his
    // yards never fall short of how far he's run; past COIN.most, not a number any entry carries)
    const within = R.coinsWithin(5, 300), co5 = R.coinsTo(R.course(5, 0, true), 400);
    const counted = within === co5.coins.filter(c => c.z <= 301).length && R.coinsWithin(5, 0) === 0 && within > 0 && within < 84;
    const bound = R.dayCoins([me({5: ent(300, 999)})], 5) === within && R.dayCoins([me({5: ent(300, 999)}), other({5: ent(2400)})], 5) === Math.min(999, far)
      && R.dayCoins([me({5: ent(300, R.COIN.most + 1)})], 5) === 0 && R.COIN.most === 1000;
    const pass = gate && waits && kept && first && official && board && pay && counted && bound;
    return {pass, detail: `open: a fresh day ${open.fresh}, after a run on this phone ${open.mine}, on another of his ${open.theirs} (ranElsewhere ${open.elsewhere}), someone else's run doesn't count ${open.someoneElse}, run 2 ${open.later}, the regular course ${open.regular}, before the coins' first day (${R.COIN.fromDay}) ${open.early}, the board loading ${open.loading}, off ${open.off}, in error ${open.err}; waits for the board ${JSON.stringify(wait)} (${waits}); kept on the first run alone ${kept}, read back ${first}, the best run still counts ${official}; on the board ${board}; paid from the most of his docs, ${R.COIN.gold} Gold a coin ${pay}; never more than the course lays out within his yards (${within} within 300, ${far} within 2,400) ${counted && bound}`};
  });
  check('Return Man coins: a first run can\'t be run twice for its coins: Test play, or a new day, ends a paused run where it got to (as leaving the page does) before putting it aside, and a kickoff first ends any run of the day left under way (live), so the next is run 2 without coins; the coins\' sparkle can\'t stop the game (its age never below nothing, the canvas always restored)', async () => {
    const view = await fetch(new URL('../views/return.js', import.meta.url)).then(r => r.text()).catch(() => '');
    const ends = /function endPaused\(st\) \{\s*\n\s*if \(!st\.run \|\| st\.mode !== 'paused'\) return;\s*\n\s*keep\(st\); R\.settle\(st\.n\);/.test(view);
    const test = /function testPlay\(st, on\) \{\s*\n[^\n]*\n\s*endPaused\(st\);\s*\n\s*R\.setTest\(on, st\.n\);/.test(view);
    const day = /endPaused\(st\);\s*\n\s*st\.run = null; st\.mode = 'ready'; setDay\(st, R\.todayNumber\(\)\)/.test(view);
    const kickoff = /if \(R\.live\(st\.n\)\) \{ R\.settle\(st\.n\);[^\n]*setDay\(st, st\.n\); \}\s*\n[^\n]*\n\s*const own = data\.isOwner\(\), k = st\.day\.next/.test(view);
    const spark = /const a = Math\.min\(1, Math\.max\(0, \(now - s\.at\) \/ SPARK_MS\)\)/.test(view) && /\} finally \{ c\.restore\(\); \}/.test(view);
    // (the core's side: a run left under way, settled, is the day's run 0, and the next is run 1)
    const left = R.settle.length === 1 && R.live.length === 1;
    const pass = ends && test && day && kickoff && spark && left;
    return {pass, detail: `a paused run ended where it got to ${ends}: before Test play ${test}, at midnight ${day}; a kickoff ends a run left under way first ${kickoff}; the sparkle guarded ${spark}`};
  });
  check('Return Man coins are the owner\'s alone (CLAUDE.md: his profile only): the page starts a coin run only on his profile (and asks coinsOpen), shows the coins, the counter beside the yards and the sparkles only on a coin run on his profile (counting them only there), takes them away when the board shows his first run was on another phone, and on a profile change (another tab too) hides them, the run on his hard course ending where it is with the ones he took kept; his first kickoff waits for the board to tell it\'s the first; its end card says what they pay The Keep (or why a run has none: a later run, his first on another phone, the board not in) on his profile only, from the coins\' first day; the 3D coins are one instanced mesh (one draw call), made only on his profile; no picture to load, nothing new in the offline cache; the counter\'s there for everyone but hidden', async () => {
    const get = f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '');
    const [view, w3, w2, sw] = await Promise.all([get('../views/return.js'), get('../views/return-3dworld.js'), get('../views/return-world.js'), get('../../sw.js')]);
    const start = /coins = own && R\.coinsOpen\(st\.n, k, own\);\s*\n\s*st\.run = R\.startRun\(st\.n, k, own, coins\);/.test(view)
      && /if \(R\.coinsWait\(st\.n, st\.day\.next, true\)\) \{/.test(view); // (his first kickoff waits for the board)
    const shown = /const coinsShown = st => !!\(st\.run && st\.run\.coins && data\.isOwner\(\)\)/.test(view) && /if \(coinsShown\(st\)\) A\.coins\.forEach/.test(view) && /const runCoins = st => \(st\.run && st\.run\.coins \? st\.run\.c : undefined\);/.test(view)
      && /else if \(e\.type === 'coin'\) \{ if \(coinsShown\(st\)\) coinGot\(st, e, now\); else if \(st\.run\) st\.run\.c = Math\.max\(0, st\.run\.c - 1\); \}/.test(view);
    // (taken away when the board shows another of his phones ran first; a profile change hides them and, on his hard
    // course, ends the run where it is (the frame's whistle), keeping the ones he took: kept with the run, runCoins)
    const recheck = /recheckCoins\(st\); \/\/ \(the board's in/.test(view) && /recheckCoins\(st\);\s*\n/.test(view)
      && /if \(!run \|\| !run\.coins \|\| run\.over \|\| R\.testing\(\) \|\| !data\.isOwner\(\)\) return;\s*\n\s*if \(!R\.ranElsewhere\(st\.n\)\) return;\s*\n\s*R\.dropCoins\(run\)/.test(view)
      && /st\.run\.co\.hard && !data\.isOwner\(\)\) \{ R\.stop\(st\.run\); tackled\(st\); \}/.test(view);
    const card = /if \(!data\.isOwner\(\) \|\| !run \|\| !run\.co\.hard\) return '';/.test(view) && /if \(!R\.testing\(\) && st\.n < R\.COIN\.fromDay\) return '';/.test(view)
      && ['Coins are only on your first run.', 'Your first run today was on another phone: its coins are the ones that count.', 'No coins this run', '(test play: not paid)'].every(w => view.includes(w)) && /Gold for The Keep/.test(view);
    const one = (w3.match(/new T\.InstancedMesh\(/g) || []).length === 1 && /function coinsUpdate\(st, A, t\) \{\s*\n\s*if \(!\(A && st\.run && st\.run\.coins && data\.isOwner\(\)\)\)/.test(w3) && /m\.castShadow = false/.test(w3);
    const flat = /export function coin\(st, c, cn, t\)/.test(w2) && !/coin[^'"\n]*\.(png|jpe?g|webp|glb|svg)/i.test(w2 + w3 + view) && !/coin/i.test(sw);
    const host = document.createElement('div');
    host.innerHTML = (await import('../views/return.js')).render({});
    const chip = host.querySelector('.rm-hl [data-rm-ychip] + [data-rm-coins][hidden] [data-rm-cn]');
    const pass = start && shown && recheck && card && one && flat && !!chip;
    return {pass, detail: `started on his profile alone ${start}; shown on his alone ${shown}; taken away on the board or a profile change ${recheck}; the end card's ${card}; one instanced mesh, his alone ${one}; nothing to load or cache ${flat}; the counter beside the yards, hidden ${!!chip}`};
  });
  check('Return Man: its stylesheet (css/views/return.css) is linked: the version mark is on :root', () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--rm-css').trim();
    return {pass: v !== '', detail: `--rm-css ${v || 'missing'}`};
  });
}
