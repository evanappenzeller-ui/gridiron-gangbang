// Return Man checks for the dev gallery (#/_kit): the day's courses (core/return.js: the same on every phone, one thing a
// row at first, fuller and quicker as the yards go, the vehicles in the lanes always leaving a way through, never across
// the line into the next place), the places in their order, the moves (a juke a lane over, a jump over a barricade and
// up onto a low vehicle, a slide under a banner), the vehicles (a tall one a hit, its ramp the
// way up, a roof to run along and juke off), the linebacker chasing (a hit a stumble, two close together the catch), the
// power-ups (salts, painkillers, booze), the speed and the touchdowns,
// a day's numbers, and the league scoreboard's rows (on crafted board docs), which read the board as this phone may see
// it (THE RULE, CLAUDE.md). checks.js (owner: core) imports returnChecks and calls it with its own check(name, fn)
// helper; every fn returns true or {pass, detail}. Nothing here writes to storage or the database. Owner: RETURN.

import * as R from './return.js';
import * as daily from './daily.js';
import {gameFor} from '../views/puzzles.js';
import {gamesFor, listHTML, GAMES} from '../views/games.js';

/** A returner who sees the course and plans: each twentieth of a second, a search for the swipes that keep him up for
 *  the next 1.3 seconds (power-ups taken away, so it's the course alone that lets him through). Runs till he's down or
 *  to maxZ yards. */
function bot(n, k, maxZ) {
  const ACTS = [null, 'up', 'down', 'left', 'right'], TICK = .05, DEPTH = 26;
  const strip = r => { r.salts = 0; r.pills = 0; r.shield = 0; };
  const run = R.startRun(n, k);
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
/** A run on a course of its own: the rows, vehicle sets and power-ups given (nothing else), from z 0 in the lane. */
function field({rows = [], sets = [], items = []}, lane = 1) {
  const run = R.startRun(1, 0);
  run.co = {n: 0, k: 0, order: [0, 1, 2, 3, 4], rows, sets, items, r: () => 0, z: 1e9, itemAt: 1e9, done: 1e9};
  run.lane = lane; run.x = R.xOf(run, lane);
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
  check('Return Man: the vehicles always leave a way through: at most two side by side (an open lane always), never across the line into the next place; beside one the rows stand only in the open lanes; a power-up every 90 to 180 yards or so, the ones up top on a tall one\'s roof', () => {
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
    const per = items / 24, pass = !bad.length && hi > 0 && lo > 0 && ramps > 0 && roofs > 0 && per >= 2900 / 200 && per <= 2900 / 80;
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
  check('Return Man: the moves: a juke takes him a lane over (not off the road); a jump clears a barricade, a slide goes under a banner, and neither beats the other; doing nothing in its lane is a hit (a stumble); leaving its lane late is a juke; a jump swiped in the air goes the moment he lands; a slide under a hover pad he\'d hit standing', () => {
    const lanes = t => [null, t, null];
    const r = {
      dive: [meet(lanes('hurdle'), 'up'), meet(lanes('hurdle'), 'down'), meet(lanes('hurdle'), null)],
      wrap: [meet(lanes('bar'), 'down'), meet(lanes('bar'), 'up'), meet(lanes('bar'), null)],
      wedge: [meet(lanes('bar'), 'left', .25)],
      empty: meet([null, null, null], null),
      early: meet(lanes('hurdle'), 'up', 1.2)
    };
    const edge = field({});
    edge.lane = 0; edge.x = R.xOf(edge, 0);
    const walls = !R.move(edge, 'left') && R.move(edge, 'right') && edge.lane === 1;
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
    return {pass: got === want && walls && again && under, detail: `barricade: ${r.dive.join(', ')}; banner: ${r.wrap.join(', ')}; left late ${r.wedge.join(', ')}; an empty row ${r.empty}; a jump a second early ${r.early}; the edge ${walls}; the jump on landing ${again}; under a pad in a slide ${under}`};
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
  check('Return Man: the power-ups: smelling salts shake the linebacker off when he\'d catch him (once each; he carries two at most); painkillers carry him through barricades and banners and up onto vehicles for a few seconds; booze makes every yard count double for a few; picked up only in his lane, at his height', () => {
    const wedge = z => ({i: z, z, lanes: [null, 'hurdle', null]});
    const salts = play({items: [{i: 0, z: 20, lane: 1, top: false, kind: 'salts'}], rows: [wedge(40), wedge(60), wedge(80)]}, 10);
    const s1 = salts.ev.includes('pickup') && salts.ev.join().includes('stumbled,revived') && salts.run.over && salts.run.why === 'caught' && Math.round(salts.run.z) >= 80;
    const two = field({items: [0, 1, 2].map(i => ({i, z: 20 + i * 5, lane: 1, top: false, kind: 'salts'}))});
    for (let i = 0; i < 400; i++) R.step(two, 1 / 120);
    const pills = play({items: [{i: 0, z: 20, lane: 1, top: false, kind: 'pills'}], rows: [wedge(40)], sets: [set(plat(1, 55, 70, true))]}, 7);
    const p1 = pills.ev.includes('trucked') && pills.ev.includes('vaulted') && !pills.run.over;
    const late = play({items: [{i: 0, z: 20, lane: 1, top: false, kind: 'pills'}], rows: [wedge(20 + R.speedAt(20) * (R.POWER.pills.s + .5))]}, 9);
    const booze = field({items: [{i: 0, z: 10, lane: 1, top: false, kind: 'booze'}]});
    for (let i = 0; i < 120 * 3; i++) R.step(booze, 1 / 120);
    const b1 = booze.yards - 10 > (booze.z - 10) * 1.9; // (double from where he picked it up)
    const miss = play({items: [{i: 0, z: 20, lane: 0, top: false, kind: 'booze'}]}, 3);
    const pass = s1 && two.salts === R.SALTS_MAX && p1 && late.ev.includes('stumbled') && b1 && !miss.ev.includes('pickup');
    return {pass, detail: `salts: shook him off ${s1}, carries ${two.salts}; painkillers: through a barricade and onto a bus ${p1}, worn off (a hit again) ${late.ev.includes('stumbled')}; booze: ${Math.round(booze.yards)} yards for ${Math.round(booze.z)} run; another lane's left ${!miss.ev.includes('pickup')}`};
  });
  check('Return Man: the linebacker chases him down: a hit (a barricade, a banner, a vehicle) slows him and puts the linebacker right behind him; run on clean and he falls back out of sight; a second hit while he\'s still close (inside CHASE.window seconds) and he\'s run down; one after he\'s gone is just another stumble', () => {
    const wedge = z => ({i: z, z, lanes: [null, 'hurdle', null]});
    const C = R.CHASE;
    // one hit: slowed, the linebacker near, then back to speed and the linebacker gone
    const one = field({rows: [wedge(30)]});
    let v0 = null, vSlow = null, gNear = null;
    for (let i = 0; i < 120 * 9 && !one.over; i++) {
      const z = one.z, evs = R.step(one, 1 / 120);
      if (evs.some(e => e.type === 'stumbled')) { gNear = R.gapOf(one); v0 = R.speedAt(z); }
      else if (gNear != null && vSlow == null) vSlow = (one.z - z) * 120;
    }
    const slowed = vSlow < v0 * (1 - C.slowBy * .9) && gNear === C.near && !one.over && Math.abs(R.gapOf(one) - C.far) < 1e-9;
    // two hits close together: caught; two far apart: two stumbles
    const at = s => 30 + R.speedAt(30) * s * .9;
    const quick = play({rows: [wedge(30), wedge(at(2))]}, 8), slow = play({rows: [wedge(30), wedge(at(C.window + 2))]}, 12);
    const caught = quick.run.over && quick.run.why === 'caught' && R.endOf(quick.run) === 'Run down from behind by the linebacker' && quick.ev.join().includes('stumbled');
    const twice = !slow.run.over && slow.ev.filter(e => e === 'stumbled').length === 2;
    // a juke into a bus's side counts, then a banner right after: caught
    const side = field({sets: [set(plat(1, 10, 60, true))], rows: [{i: 0, z: 36, lanes: ['bar', null, null]}]}, 0);
    side.z = 20; R.move(side, 'right');
    for (let i = 0; i < 120 * 4 && !side.over; i++) R.step(side, 1 / 120);
    const sideHit = side.over && side.why === 'caught';
    return {pass: slowed && caught && twice && sideHit, detail: `a hit: ${Math.round(vSlow * 10) / 10} yds/s from ${Math.round(v0 * 10) / 10}, the linebacker ${gNear} yds back, gone after ${C.window} s ${slowed}; two in ${2} s: ${quick.run.why || 'not caught'}; two ${C.window + 2} s apart: ${twice ? 'two stumbles' : 'WRONG'}; a bus's side then a banner: ${sideHit ? 'caught' : 'WRONG'}`};
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
    const all = lists.every(l => l === 'puzzles,17-0,drill,kick,return');
    const host = document.createElement('div');
    host.innerHTML = listHTML();
    const tagged = [...host.querySelectorAll('.gm-slot:not([data-gm-clone])')].filter(sl => sl.querySelector('.gm-front .gm-beta')).map(sl => sl.dataset.gmSlot).join();
    const beta = tagged === 'return' && GAMES.filter(g => g.beta).map(g => g.id).join() === 'return';
    return {pass: open && all && beta, detail: `opens on every phone ${open}; lists ${lists.join(' | ')}; BETA on ${tagged || 'none'}`};
  });
  check('Return Man: its stylesheet (css/views/return.css) is linked: the version mark is on :root', () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--rm-css').trim();
    return {pass: v !== '', detail: `--rm-css ${v || 'missing'}`};
  });
}
