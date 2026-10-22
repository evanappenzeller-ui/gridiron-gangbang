// A raid, played out (core/realm.js: the Realm). The raider drops their army round the edge of a realm's lot; each
// soldier heads for what he goes after (the nearest building, the nearest defense, a wall, the gold and grain),
// finding his way round buildings and through walls (breaking one when that's quicker than going round), and goes at
// it; a dragon flies straight there over everything. The defenses shoot back at whoever's nearest in their reach (the
// trebuchet and the pitch cauldron hit everyone round where it lands, and can't reach a dragon). Fixed steps of DT,
// nothing random: the same drops at the same moments play out the same every time. What a building holds comes out
// as it's knocked down (its share by the damage done).
// makeBattle(base, loot, army) → {t, over, deploy(t, x, y), step1(), canDrop(x, y), pct(), stars(), result(), ...};
// replay(...) plays a recorded raid again; defend(s, now) plays the computer's raids on your realm since you last
// looked (a few a day).
import {KINDS, TROOPS, TROOP_ORDER, HEROES, HERO_ORDER, heroLevels, heroStat, mayPlay, stat, N, RAID_S, BOTS, rng, boxOf, keepOf, lootOf, takeRaid, HOUR} from './realm.js';

export const DT = .1;
const HIT_EVERY = 1;   // seconds between a soldier's hits
const REACH = .55;     // how far past his range a soldier still hits (a tile's half and a bit: where his path ends)
const FLIGHT = {cannon: .3, ballista: .35, tower: .25, trebuchet: 1.2, cauldron: .15};

// ---- a heap for the path search
function Heap() { this.k = []; this.v = []; }
Heap.prototype.push = function (key, val) {
  const k = this.k, v = this.v;
  let i = k.length;
  k.push(key); v.push(val);
  while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
  k[i] = key; v[i] = val;
};
Heap.prototype.pop = function () {
  const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
  if (n) {
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && k[c + 1] < k[c]) c++;
      if (k[c] >= lk) break;
      k[i] = k[c]; v[i] = v[c]; i = c;
    }
    k[i] = lk; v[i] = lv;
  }
  return top;
};

/** The distance from (x, y) to a building's footprint (0 inside it). */
const distTo = (b, x, y) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.size)), Math.max(b.y - y, 0, y - (b.y + b.size)));

/**
 * A raid on base (a realm state: its buildings), with loot {by: {buildingId: {gold, grain}}}, by an army
 * ({troop: n}). options.heroes is the attacker's permanent-level snapshot, keyed knight/wizard. Defenders come
 * from base.hr. Hero units use hero_knight/hero_wizard so ordinary trained knights keep their original behavior.
 */
export function makeBattle(base, loot, army, options = {}) {
  const heroes = mayPlay() ? Object.fromEntries(HERO_ORDER.filter(k => heroStat(k, options?.heroes?.[k])).map(k => [k, options.heroes[k]])) : {};
  const defending = heroLevels(base);
  const left = Object.fromEntries(TROOP_ORDER.filter(t => Number.isInteger(army?.[t]) && army[t] > 0).map(t => [t, army[t]]));
  Object.keys(heroes).forEach(k => { left[HEROES[k].troop] = 1; });
  const B = {t: 0, step: 0, over: false, why: '', bl: [], tr: [], defenders: [], heroes, shots: [], fx: [], left, used: {}, got: {gold: 0, grain: 0}, gotBy: {}, seq: 0, drops: []};
  const combatStats = u => u.stats || TROOPS[u.t];
  const occ = new Int32Array(N * N).fill(-1);
  (base.b || []).forEach(b => {
    if (b.l < 1) return;
    const K = KINDS[b.t], st = stat(b.t, b.l), size = K.size;
    const e = {i: b.i, t: b.t, l: b.l, x: b.x, y: b.y, size, cx: b.x + size / 2, cy: b.y + size / 2, hp: st.hp, max: st.hp,
      wall: K.role === 'wall', def: K.role === 'def' ? st : null, cd: 0, loot: (loot && loot.by && loot.by[b.i]) || null,
      took: {gold: 0, grain: 0}, dead: false, money: K.role === 'make' || K.role === 'store', aim: 0};
    const idx = B.bl.length;
    B.bl.push(e);
    for (let y = b.y; y < b.y + size; y++) for (let x = b.x; x < b.x + size; x++) if (x >= 0 && y >= 0 && x < N && y < N) occ[y * N + x] = idx;
  });
  const total = B.bl.filter(b => !b.wall).length || 1;
  B.total = total;
  // where nothing can be dropped: on or next to a building that's standing
  B.canDrop = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= N || y >= N) return false;
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = tx + dx, Y = ty + dy;
      if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      const o = occ[Y * N + X];
      if (o >= 0 && !B.bl[o].dead) return false;
    }
    return true;
  };
  B.pct = () => Math.round(100 * B.bl.filter(b => !b.wall && b.dead).length / total);
  B.stars = () => {
    const p = B.pct(), hall = B.bl.find(b => b.t === 'keep');
    return (p >= 50 ? 1 : 0) + (hall && hall.dead ? 1 : 0) + (p >= 100 ? 1 : 0);
  };
  B.fieldLeft = () => B.tr.some(u => !u.dead) || Object.values(B.left).some(n => n > 0);

  // Champions muster on clear tiles beside the Keep. They occupy no building footprint and never affect stars,
  // loot or destruction percentage. A fixed search order gives every replay the same starting positions.
  const keep = B.bl.find(b => b.t === 'keep');
  Object.entries(defending).forEach(([hero, level], i) => {
    if (!keep) return;
    let home = null, best = Infinity;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (occ[y * N + x] >= 0 || B.defenders.some(u => u.x === x + .5 && u.y === y + .5)) continue;
      const score = (x + .5 - (keep.cx + (i ? 1.5 : -1.5))) ** 2 + (y + .5 - keep.y - keep.size - 1) ** 2;
      if (score < best) { best = score; home = {x: x + .5, y: y + .5}; }
    }
    if (!home) return;
    const stats = heroStat(hero, level);
    B.defenders.push({id: 'def_' + hero, i: 'def_' + hero, t: HEROES[hero].troop, hero, l: level, level, stats,
      x: home.x, y: home.y, cx: home.x, cy: home.y, size: .6, home, hp: stats.hp, max: stats.hp,
      targetHero: true, cd: 0, dead: false, face: 0, hitAt: -9, born: 0, path: [], pi: 0, nextPath: 0});
  });
  const targetDistance = (b, x, y) => b.targetHero ? Math.hypot(b.x - x, b.y - y) : distTo(b, x, y);

  // ---- choosing a target
  const pick = u => {
    const T = combatStats(u);
    const champion = B.defenders.filter(h => !h.dead && targetDistance(h, u.x, u.y) <= 7)
      .sort((a, b) => targetDistance(a, u.x, u.y) - targetDistance(b, u.x, u.y))[0];
    if (champion) return champion;
    const alive = B.bl.filter(b => !b.dead);
    let pool;
    if (T.aim === 'def') pool = alive.filter(b => b.def);
    else if (T.aim === 'loot') pool = alive.filter(b => b.money);
    if (!pool || !pool.length) pool = alive.filter(b => !b.wall);
    let best = null, bd = Infinity;
    pool.forEach(b => { const d = distTo(b, u.x, u.y); if (d < bd) { bd = d; best = b; } });
    return best;
  };
  // ---- finding the way: tile to tile (diagonals too), round buildings, through walls at the time it takes to break
  // them, to any tile from which the target is in reach
  const path = (u, tg) => {
    const T = combatStats(u), reach = T.range + REACH - .05, dps = T.dps || 30;
    const sx = Math.max(0, Math.min(N - 1, Math.floor(u.x))), sy = Math.max(0, Math.min(N - 1, Math.floor(u.y)));
    const g = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    const tgIdx = B.bl.indexOf(tg);
    const H = (x, y) => Math.max(0, targetDistance(tg, x + .5, y + .5) - reach);
    const heap = new Heap(), s = sy * N + sx;
    g[s] = 0;
    heap.push(H(sx, sy), s);
    let goal = -1, guard = 0;
    while (heap.k.length && guard++ < 6000) {
      const c = heap.pop();
      if (closed[c]) continue;
      closed[c] = 1;
      const cx = c % N, cy = (c / N) | 0;
      if (targetDistance(tg, cx + .5, cy + .5) <= reach) { goal = c; break; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const X = cx + dx, Y = cy + dy;
        if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
        const n = Y * N + X, o = occ[n];
        let cost = dx && dy ? 1.414 : 1;
        if (o >= 0 && !B.bl[o].dead && o !== tgIdx) {
          const b = B.bl[o];
          if (!b.wall || u.targetHero) continue;
          cost += b.hp / dps * T.speed;
          // (no squeezing between two walls on a diagonal)
        }
        if (dx && dy) {
          const a = occ[cy * N + X], b2 = occ[Y * N + cx];
          if ((a >= 0 && !B.bl[a].dead && (!B.bl[a].wall || u.targetHero) && a !== tgIdx) || (b2 >= 0 && !B.bl[b2].dead && (!B.bl[b2].wall || u.targetHero) && b2 !== tgIdx)) continue;
        }
        const ng = g[c] + cost;
        if (ng < g[n]) { g[n] = ng; from[n] = c; heap.push(ng + H(X, Y), n); }
      }
    }
    if (goal < 0) return [];
    const out = [];
    for (let c = goal; c !== s && c >= 0; c = from[c]) out.push(c);
    return out.reverse();
  };
  const retarget = u => {
    u.tg = pick(u);
    u.path = u.tg && !combatStats(u).fly ? path(u, u.tg) : [];
    u.pi = 0;
    u.wallAt = null;
  };

  // ---- hits
  const takeLoot = (b, d) => {
    if (!b.loot) return;
    ['gold', 'grain'].forEach(c => {
      const want = Math.floor(b.loot[c] * Math.min(1, (b.max - Math.max(0, b.hp)) / b.max)), add = Math.max(0, want - b.took[c]);
      if (add > 0) { b.took[c] += add; B.got[c] += add; (B.gotBy[b.i] = B.gotBy[b.i] || {gold: 0, grain: 0})[c] += add; B.fx.push({k: 'coin', t: B.t, x: b.cx, y: b.cy, c, n: add}); }
    });
  };
  const hurt = (b, d) => {
    if (b.dead || d <= 0) return;
    if (b.targetHero) { hurtTroop(b, d); return; }
    b.hp -= d;
    takeLoot(b, d);
    if (b.hp <= 0) {
      b.hp = 0; b.dead = true;
      if (b.loot) { b.hp = 0; takeLoot(b, 0); }
      B.fx.push({k: 'boom', t: B.t, x: b.cx, y: b.cy, i: b.i, wall: b.wall, size: b.size});
    }
  };
  const hurtTroop = (u, d) => {
    if (u.dead) return;
    u.hp -= d;
    if (u.hp <= 0) { u.hp = 0; u.dead = true; B.fx.push({k: 'down', t: B.t, x: u.x, y: u.y, id: u.id}); }
  };

  // ---- sending a soldier
  B.deploy = (t, x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    // Store and use the same coordinates when heroes participate, including automatic defense simulations.
    if (Object.keys(heroes).length || B.defenders.length) { x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10; }
    if (B.over || !(B.left[t] > 0) || !B.canDrop(x, y)) return null;
    const hero = HERO_ORDER.find(k => HEROES[k].troop === t), T = hero ? heroStat(hero, heroes[hero]) : TROOPS[t];
    if (!T || (hero && !mayPlay())) return null;
    B.left[t]--;
    B.used[t] = (B.used[t] || 0) + 1;
    const u = {id: ++B.seq, t, x, y, hp: T.hp, max: T.hp, tg: null, path: [], pi: 0, cd: 0, dead: false, face: 0, hitAt: -9, wallAt: null, born: B.t};
    if (hero) Object.assign(u, {hero, l: heroes[hero], level: heroes[hero], stats: T});
    B.tr.push(u);
    B.drops.push([B.step, t, Math.round(x * 10), Math.round(y * 10)]);
    retarget(u);
    return u;
  };

  // ---- a step
  B.step1 = () => {
    if (B.over) return;
    B.t = +(B.t + DT).toFixed(3);
    B.step++;
    // the soldiers
    B.tr.forEach(u => {
      if (u.dead) return;
      const T = combatStats(u);
      if (!u.tg || u.tg.dead || (B.defenders.length && B.step % 10 === 0)) retarget(u);
      const tg = u.tg;
      if (!tg) return;
      u.cd = Math.max(0, u.cd - DT);
      // a wall in the way: break it first
      let foe = u.wallAt && !u.wallAt.dead ? u.wallAt : null;
      if (!foe && targetDistance(tg, u.x, u.y) <= T.range + REACH) foe = tg;
      if (foe) {
        u.face = Math.atan2(foe.cy - u.y, foe.cx - u.x);
        if (u.cd <= 0) {
          u.cd = HIT_EVERY;
          u.hitAt = B.t;
          const d = T.dps * HIT_EVERY * (u.t === 'thief' && foe.money ? 2 : 1);
          if (T.range > 1) B.shots.push({k: u.t, from: u.id, x0: u.x, y0: u.y, x1: foe.cx, y1: foe.cy, t0: B.t, t1: B.t + .3, b: foe.i, h: foe.targetHero ? foe.id : null, d, splash: T.splash || 0, foe: false});
          else {
            hurt(foe, d);
            B.fx.push({k: 'hit', t: B.t, x: foe.cx, y: foe.cy, id: u.id});
          }
        }
        if (foe === u.wallAt && foe.dead) u.wallAt = null;
        return;
      }
      // flying: straight at it, over everything
      if (T.fly) {
        const px = tg.targetHero ? tg.x : Math.max(tg.x, Math.min(tg.x + tg.size, u.x)), py = tg.targetHero ? tg.y : Math.max(tg.y, Math.min(tg.y + tg.size, u.y));
        const dx = px - u.x, dy = py - u.y, d = Math.hypot(dx, dy), go = Math.min(T.speed * DT, Math.max(0, d - T.range));
        u.face = Math.atan2(dy, dx);
        if (d > 1e-6) { u.x += dx / d * go; u.y += dy / d * go; }
        return;
      }
      // walking
      if (u.pi >= u.path.length) { u.path = path(u, tg); u.pi = 0; if (!u.path.length) return; }
      const c = u.path[u.pi], nx = c % N + .5, ny = ((c / N) | 0) + .5;
      const o = occ[c];
      if (o >= 0 && !B.bl[o].dead && B.bl[o] !== tg && B.bl[o].wall) { u.wallAt = B.bl[o]; return; }
      const dx = nx - u.x, dy = ny - u.y, d = Math.hypot(dx, dy), go = T.speed * DT;
      u.face = Math.atan2(dy, dx);
      if (d <= go) { u.x = nx; u.y = ny; u.pi++; }
      else { u.x += dx / d * go; u.y += dy / d * go; }
    });
    // Heroes defend on the ground, walking around their own buildings and walls. The Wizard can target flyers;
    // the Knight cannot. Both can be attacked and defeated, and return unharmed to the permanent roster afterward.
    B.defenders.forEach(h => {
      if (h.dead) return;
      const T = combatStats(h);
      h.cd = Math.max(0, h.cd - DT);
      const foe = B.tr.filter(u => !u.dead && (T.air || !combatStats(u).fly) && Math.hypot(u.x - h.home.x, u.y - h.home.y) <= 14)
        .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      const target = foe || h.home, distance = Math.hypot(target.x - h.x, target.y - h.y);
      h.face = Math.atan2(target.y - h.y, target.x - h.x);
      if (foe && distance <= T.range + REACH) {
        if (h.cd <= 0) {
          h.cd = HIT_EVERY; h.hitAt = B.t;
          if (T.range > 1) B.shots.push({k: h.t, from: h.id, x0: h.x, y0: h.y, x1: foe.x, y1: foe.y,
            t0: B.t, t1: B.t + .3, u: foe.id, d: T.dps, splash: T.splash, air: T.air, foe: true, high: !!combatStats(foe).fly});
          else { hurtTroop(foe, T.dps); B.fx.push({k: 'hit', t: B.t, x: foe.x, y: foe.y, id: h.id}); }
        }
        return;
      }
      if (!foe && distance < .7) return;
      if (B.step >= h.nextPath) {
        h.path = path(h, {x: target.x, y: target.y, targetHero: true}); h.pi = 0; h.nextPath = B.step + 10;
      }
      const c = h.path[h.pi];
      if (c == null) return;
      const nx = c % N + .5, ny = Math.floor(c / N) + .5, dx = nx - h.x, dy = ny - h.y, d = Math.hypot(dx, dy), go = T.speed * DT;
      if (d <= go) { h.x = nx; h.y = ny; h.pi++; }
      else { h.x += dx / d * go; h.y += dy / d * go; }
      h.cx = h.x; h.cy = h.y;
    });
    // the defenses
    B.bl.forEach(b => {
      if (b.dead || !b.def) return;
      b.cd = Math.max(0, b.cd - DT);
      if (b.cd > 0) return;
      let best = null, bd = Infinity;
      B.tr.forEach(u => {
        if (u.dead || (combatStats(u).fly && !b.def.air)) return;
        const d = Math.hypot(u.x - b.cx, u.y - b.cy);
        if (d <= b.def.range + b.size / 2 && d >= (b.def.min || 0) && d < bd) { bd = d; best = u; }
      });
      if (!best) return;
      b.cd = b.def.every;
      b.aim = Math.atan2(best.y - b.cy, best.x - b.cx);
      const fl = FLIGHT[b.t] || .3;
      B.shots.push({k: b.t, from: b.i, x0: b.cx, y0: b.cy, x1: best.x, y1: best.y, t0: B.t, t1: B.t + fl, u: best.id, d: b.def.dps * b.def.every, splash: b.def.splash || 0, air: b.def.air, foe: true, high: !!combatStats(best).fly});
    });
    // shots landing
    B.shots = B.shots.filter(s => {
      if (s.t1 > B.t + 1e-6) return true;
      if (s.foe) {
        if (s.splash) B.tr.forEach(u => { if (!u.dead && (!combatStats(u).fly || s.air) && Math.hypot(u.x - s.x1, u.y - s.y1) <= s.splash) hurtTroop(u, s.d); });
        else { const u = B.tr.find(q => q.id === s.u); if (u) hurtTroop(u, s.d); }
        B.fx.push({k: 'land', t: B.t, x: s.x1, y: s.y1, of: s.k, splash: s.splash});
      } else {
        const b = s.h ? B.defenders.find(q => q.id === s.h) : B.bl.find(q => q.i === s.b);
        if (b) {
          if (s.splash) [...B.bl, ...B.defenders].forEach(q => { if (!q.dead && targetDistance(q, s.x1, s.y1) <= s.splash) hurt(q, s.d); });
          else hurt(b, s.d);
          B.fx.push({k: 'hit', t: B.t, x: s.x1, y: s.y1, of: s.k});
        }
      }
      return false;
    });
    // the end: the clock, everything down, or no one left to send
    if (B.t >= RAID_S) end('time');
    else if (B.pct() >= 100) end('all');
    else if (B.tr.length && !B.fieldLeft()) end('out');
  };
  const end = why => { B.over = true; B.why = why; };
  B.end = () => end('quit');
  /** Runs the clock to t seconds (steps of DT). */
  B.run = t => { while (!B.over && B.t + DT <= t + 1e-9) B.step1(); };
  B.result = () => ({stars: B.stars(), pct: B.pct(), got: Object.assign({}, B.got), gotBy: JSON.parse(JSON.stringify(B.gotBy)), used: Object.assign({}, B.used), t: B.t, drops: B.drops.slice(), heroes: {...heroes}});
  return B;
}

/** Plays a recorded raid again from its drops ([[step, troop, x*10, y*10]]): the same raid. */
export function replay(base, loot, army, drops, until = Infinity, options = {}) {
  const B = makeBattle(base, loot, army, options);
  let k = 0;
  while (!B.over && B.t < until) {
    while (k < drops.length && drops[k][0] <= B.step) { const d = drops[k++]; B.deploy(d[1], d[2] / 10, d[3] / 10); }
    B.step1();
  }
  return B;
}

// ---------------------------------------------------------------------------------------------------- raids on you
// The computer's realms raid yours (the Realm is the owner's alone, so they're the only ones who can): at most one in
// each half of the day (12 hours from midnight), at an hour of it that's the same on every phone; none in your
// realm's first day or before your Keep is level 2, none during a truce (12 hours after one that took a star), and no
// more than the last two while you were away. The raiders are the realm a level below yours, an army a little smaller
// than yours could be, all coming from one side: knights and dragons first, the rest a moment later.
export const TRUCE_H = 12, WINDOW_H = 12;
/** When the raids on s since it last looked fall (ms), the last two at most. */
export function raidsDue(s, now = Date.now()) {
  const from = Math.max(s.lr || 0, (s.born || 0) + 24 * HOUR, now - 2 * 24 * HOUR), out = [];
  const d0 = new Date(from); d0.setHours(0, 0, 0, 0);
  for (let w = d0.getTime(); w <= now; w += WINDOW_H * HOUR) {
    const d = new Date(w), R = rng(d.getFullYear() * 1000 + (d.getMonth() + 1) * 40 + d.getDate() + Math.floor(d.getHours() / WINDOW_H) * 17 + 7);
    const at = Math.round(w + (1 + R() * (WINDOW_H - 2)) * HOUR);
    if (at > from && at <= now) out.push(at);
  }
  return out.slice(-2);
}
/** The army a computer realm raids a Keep of level th with. */
export function raidArmy(th) {
  const room = 10 + th * 5, a = {};
  let left = room;
  const add = (t, n) => { n = Math.min(n, Math.floor(left / TROOPS[t].room)); if (n > 0) { a[t] = (a[t] || 0) + n; left -= n * TROOPS[t].room; } };
  if (th >= 7) add('dragon', 1);
  if (th >= 3) add('knight', Math.floor(th / 2));
  if (th >= 5) add('thief', 4);
  add('archer', Math.floor(left * .45));
  add('footman', left);
  return a;
}
/** Plays the raids on s that are due (raidsDue) and takes each off it (core/realm.js takeRaid). Mutates s; returns
 *  the raids played. */
export function defend(s, now = Date.now()) {
  if (keepOf(s) < 2) { s.lr = Math.max(s.lr || 0, now); return []; }
  const out = [];
  raidsDue(s, now).forEach(at => {
    s.lr = at;
    if (at < (s.sh || 0)) return;
    const th = keepOf(s), bot = BOTS[Math.max(0, Math.min(BOTS.length - 1, th - 2))], army = raidArmy(th);
    const B = makeBattle(s, lootOf(s, at), army), box = boxOf(s), R = rng(at % 2147483647);
    const side = Math.floor(R() * 4);
    // a spot on that side, outside the walls' reach, spread along it
    const spot = (f, out0) => {
      for (let o = out0; o < out0 + 6; o += 1) {
        const along = box.x0 + f * (box.x1 - box.x0), across = box.y0 + f * (box.y1 - box.y0);
        const p = side === 0 ? [along, box.y0 - o] : side === 1 ? [box.x1 + o, across] : side === 2 ? [along, box.y1 + o] : [box.x0 - o, across];
        if (B.canDrop(p[0], p[1])) return p;
      }
      return null;
    };
    const first = ['dragon', 'knight'], plan = [];
    Object.entries(army).forEach(([t, n]) => { for (let i = 0; i < n; i++) plan.push([first.includes(t) ? 0 : 25, t, (i + .5) / n]); });
    plan.sort((a, b) => a[0] - b[0]);
    let k = 0;
    while (!B.over) {
      while (k < plan.length && plan[k][0] <= B.step) { const [, t, f] = plan[k++], p = spot(.2 + f * .6, 1.5); if (p) B.deploy(t, p[0], p[1]); }
      B.step1();
      if (k >= plan.length && !B.fieldLeft()) break;
    }
    const r = B.result(), ls = [0, 0], lb = {};
    Object.entries(r.gotBy).forEach(([id, v]) => {
      const b = s.b.find(x => x.i === Number(id));
      if (b && KINDS[b.t].role === 'make') lb[id] = [v.gold, v.grain];
      else { ls[0] += v.gold; ls[1] += v.grain; }
    });
    const rec = {id: 'd' + at.toString(36), at, by: bot.name, th: bot.th, st: r.stars, pc: r.pct, lt: [r.got.gold, r.got.grain], ls, lb, td: r.stars ? -r.stars * th * 3 : th * 3,
      hr: heroLevels(s)};
    takeRaid(s, rec);
    if (r.stars) s.sh = at + TRUCE_H * HOUR;
    out.push(rec);
  });
  return out;
}
