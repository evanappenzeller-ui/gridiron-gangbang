// A raid, played out (core/realm.js: The Keep). The raider drops their army round the edge of a realm's lot; each
// soldier heads for what he goes after (the nearest building, the nearest defense, a wall, the gold and ale),
// finding his way round buildings and through walls (breaking one when that's quicker than going round), and goes at
// it; a dragon flies straight there over everything. The defenses shoot back at whoever's nearest in their reach (the
// trebuchet and the pitch cauldron hit everyone round where it lands, and can't reach a dragon). Fixed steps of DT,
// nothing random: the same drops at the same moments play out the same every time. What a building holds comes out
// as it's knocked down (its share by the damage done).
// makeBattle(base, loot, army) → {t, over, deploy(t, x, y), step1(), canDrop(x, y), pct(), stars(), result(), ...};
// replay(...) plays a recorded raid again; replayRaid(rec) / replayBattle(P) give one to watch, a step at a time;
// defend(s, now) plays the computer's raids on your realm since you last looked (a few a day); exampleRaids(s, now)
// plays three on your realm as it is, for show (the owner's ask, Oct 22 2026), taking nothing.
import {KINDS, TROOPS, HEROES, RULES_V, rulesOf, heroLevels, heroDragons, dragonSnapshot, heroStat, mayPlay, stat, N, RAID_S, BOTS, rng, boxOf, keepOf, lootOf, takeRaid, HOUR,
  snapOf, replayOf, sceneryOf, putExamples, EX_V, DEFEND_AT, botDragon, topLevel, DRAGONS, DRAGON_ORDER, dragonExamplesForMe, profileKey} from './realm.js';

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

/** The distance from (x, y) to a building's footprint (0 inside it). (Math.hypot only when it's off a corner: beside a
 *  side, hypot(d, 0) is d to the last bit, so the shortcut changes nothing; hypot is slow, and the way-finding asks
 *  this hundreds of thousands of times a raid.) */
const distTo = (b, x, y) => {
  const dx = Math.max(b.x - x, 0, x - (b.x + b.size)), dy = Math.max(b.y - y, 0, y - (b.y + b.size));
  return dx === 0 ? dy : dy === 0 ? dx : Math.hypot(dx, dy);
};
// The way-finding's scratch (path, in makeBattle), shared by every battle (a search runs through without a break, so two
// never use it at once): the cost so far and where from, good while its stamp is this search's (no clearing a
// lot-sized grid three times a search: most searches end in a few tiles); a tile's done when its other stamp is.
const WAY = {g: null, from: null, at: null, done: null, n: 0, heap: new Heap()};
const way = size => {
  if (!WAY.g || WAY.g.length !== size) Object.assign(WAY, {g: new Float32Array(size), from: new Int32Array(size), at: new Uint32Array(size), done: new Uint32Array(size), n: 0});
  if (++WAY.n >= 0xffffffff) { WAY.at.fill(0); WAY.done.fill(0); WAY.n = 1; }
  WAY.heap.k.length = 0; WAY.heap.v.length = 0;
  return WAY;
};

/**
 * A raid on base (a realm state: its buildings), with loot {by: {buildingId: {gold, grain}}}, by an army
 * ({troop: n}). options.heroes is the attacker's permanent-level snapshot, keyed knight/dragon. Defenders come
 * from base's own (heroLevels: the Knight's roster, the Dragon's hatchery), or options.defenders when given (a replay's:
 * the levels they had then, whatever the Castle's caps are now). Hero units use hero_knight/hero_dragon so ordinary
 * trained knights keep their original behavior. options.rules: the rule set (core/realm.js RULES) it's played under,
 * today's by default; 1 for a replay recorded before Oct 22 2026 (its troops, the trained Dragon among them, and its
 * heroes, the Knight and the Wizard), so it plays out exactly as it did.
 */
export function makeBattle(base, loot, army, options = {}) {
  const rules = options && rulesOf(options.rules) !== rulesOf(RULES_V) ? Number(options.rules) : RULES_V, R = rulesOf(rules);
  const heroStatOf = (k, l) => heroStat(k, l, rules);
  const heroes = mayPlay() ? Object.fromEntries(R.heroes.filter(k => heroStatOf(k, options?.heroes?.[k])).map(k => [k, options.heroes[k]])) : {};
  const fixed = options && options.defenders && typeof options.defenders === 'object' ? options.defenders : null;
  const defending = fixed ? (mayPlay() ? Object.fromEntries(R.heroes.filter(k => heroStatOf(k, fixed[k])).map(k => [k, fixed[k]])) : {}) : rules === 1 ? {} : heroLevels(base, rules);
  const dragons = rules >= 3 ? dragonSnapshot(heroes, options.dragons) : {};
  const defenderDragons = rules >= 3 ? dragonSnapshot(defending, fixed ? options.defenderDragons : heroDragons(base)) : {};
  const left = Object.fromEntries(R.troops.filter(t => Number.isInteger(army?.[t]) && army[t] > 0).map(t => [t, army[t]]));
  Object.keys(heroes).forEach(k => { left[R.hero[k].troop] = 1; });
  const B = {t: 0, step: 0, over: false, why: '', bl: [], tr: [], defenders: [], heroes, dragons, defenderDragons, shots: [], fx: [], left, used: {}, got: {gold: 0, grain: 0}, gotBy: {}, seq: 0, drops: [], rules};
  const combatStats = u => u.stats || TROOPS[u.t];
  // (who can hit a flying hero defending, the Dragon: those who shoot, archers, and those who hit flyers, the Dragon Hero)
  const reachesAir = T => !!T.air || T.range > 1;
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

  // The Knight musters beside the Castle. Each chosen dragon guards its own hatchery; flyers hover over it,
  // while Nightmare starts on clear ground beside it. Historical rules retain their original Castle positions.
  // Heroes never affect stars, loot or destruction percentage. The search order is deterministic for replays.
  const keep = B.bl.find(b => b.t === 'keep');
  Object.entries(defending).forEach(([hero, level], i) => {
    if (!keep) return;
    const stats = heroStatOf(hero, level), nest = rules >= 3 && B.bl.find(b => b.t === 'hatchery' && b.i === defenderDragons[hero]?.buildingId);
    const anchor = nest || keep;
    let home = nest && stats.fly ? {x: nest.cx, y: nest.cy} : null, best = Infinity;
    if (!home) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (occ[y * N + x] >= 0 || B.defenders.some(u => u.x === x + .5 && u.y === y + .5)) continue;
        const score = (x + .5 - (anchor.cx + (nest ? 0 : i ? 1.5 : -1.5))) ** 2 + (y + .5 - anchor.y - anchor.size - 1) ** 2;
        if (score < best) { best = score; home = {x: x + .5, y: y + .5}; }
      }
    }
    if (!home) return;
    B.defenders.push({id: 'def_' + hero, i: 'def_' + hero, t: R.hero[hero].troop, hero, l: level, level, stats, ...defenderDragons[hero],
      x: home.x, y: home.y, cx: home.x, cy: home.y, size: .6, home, hp: stats.hp, max: stats.hp,
      targetHero: true, cd: 0, dead: false, face: 0, hitAt: -9, born: 0, path: [], pi: 0, nextPath: 0});
  });
  const targetDistance = (b, x, y) => b.targetHero ? Math.hypot(b.x - x, b.y - y) : distTo(b, x, y);

  // ---- choosing a target
  const pick = u => {
    const T = combatStats(u);
    // (a hero defending in the air, the Dragon, only for those who can reach him: the rest go on with the raid)
    const champion = B.defenders.filter(h => !h.dead && (!h.stats.fly || reachesAir(T)) && targetDistance(h, u.x, u.y) <= 7)
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
  // (a search that found no way, from that tile to that building (or to a hero where he stands) for a soldier of that
  // kind, finds none again till a building falls — what can be walked through is all it depends on, when it went
  // everywhere it could — or, when it gave up first, till a wall is hit as well (the cost of breaking through), so it
  // isn't made again meanwhile: a soldier with no way to his target stands and asks every step, and on a full lot that
  // was most of a raid's work. Oct 23 2026, with the scratch below and distTo's shortcut: every battle plays exactly as
  // it did, step for step, a few times quicker on a full lot)
  let falls = 0, ways = 0;
  const noWay = new Map();
  // (and a way found is the same way again, from that tile to that target for that kind, till anything that can be
  // walked through or broken changes: `ways` counts every such change. With heroes defending, every soldier asks again
  // every 10 steps, mostly from where he asked last time. Oct 24 2026: every battle still plays exactly as it did)
  const found = new Map();
  let foundAt = 0;
  const path = (u, tg) => {
    const T = combatStats(u), reach = T.range + REACH - .05, dps = T.dps || 30;
    const sx = Math.max(0, Math.min(N - 1, Math.floor(u.x))), sy = Math.max(0, Math.min(N - 1, Math.floor(u.y)));
    // (in reach where he stands: the search would end on its first tile, with no way to go)
    if (targetDistance(tg, sx + .5, sy + .5) <= reach) return [];
    const tgIdx = B.bl.indexOf(tg), key = `${sx},${sy},${tg.targetHero ? `h${tg.id}@${tg.x},${tg.y}` : tgIdx},${reach},${dps},${T.speed},${u.targetHero ? 1 : 0}`;
    const was = noWay.get(key);
    if (was && (was[2] ? was[0] === falls : was[1] === ways)) return [];
    if (foundAt !== ways) { found.clear(); foundAt = ways; }
    const known = found.get(key);
    if (known) return known.slice();
    const W = way(N * N), g = W.g, from = W.from, at = W.at, done = W.done, now = W.n;
    const H = (x, y) => Math.max(0, targetDistance(tg, x + .5, y + .5) - reach);
    const heap = W.heap, s = sy * N + sx;
    g[s] = 0; at[s] = now;
    heap.push(H(sx, sy), s);
    let goal = -1, guard = 0;
    while (heap.k.length && guard++ < 6000) {
      const c = heap.pop();
      if (done[c] === now) continue;
      done[c] = now;
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
        if (at[n] !== now || ng < g[n]) { g[n] = ng; at[n] = now; from[n] = c; heap.push(ng + H(X, Y), n); }
      }
    }
    if (goal < 0) { noWay.set(key, [falls, ways, !heap.k.length]); return []; }
    const out = [];
    for (let c = goal; c !== s && c >= 0; c = from[c]) out.push(c);
    out.reverse();
    found.set(key, out.slice());
    return out;
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
    if (b.wall) ways++;
    takeLoot(b, d);
    if (b.hp <= 0) {
      b.hp = 0; b.dead = true; ways++; falls++;
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
    // Every drop lands where its record says (a tenth of a tile: drops keep x*10, y*10), so a replay of it is the
    // same raid (Oct 22 2026: with or without heroes; till then only with them).
    x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10;
    if (B.over || !(B.left[t] > 0) || !B.canDrop(x, y)) return null;
    const hero = R.heroes.find(k => R.hero[k].troop === t), T = hero ? heroStatOf(hero, heroes[hero]) : TROOPS[t];
    if (!T || (hero && !mayPlay())) return null;
    B.left[t]--;
    B.used[t] = (B.used[t] || 0) + 1;
    const u = {id: ++B.seq, t, x, y, hp: T.hp, max: T.hp, tg: null, path: [], pi: 0, cd: 0, dead: false, face: 0, hitAt: -9, wallAt: null, born: B.t};
    if (hero) Object.assign(u, {hero, l: heroes[hero], level: heroes[hero], stats: T}, dragons[hero]);
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
          if (T.range > 1) B.shots.push({k: u.t, from: u.id, x0: u.x, y0: u.y, x1: foe.cx, y1: foe.cy, t0: B.t, t1: B.t + .3, b: foe.i, h: foe.targetHero ? foe.id : null, d, splash: T.splash || 0, foe: false,
            ...(u.species ? {species: u.species, color: u.color} : {}),
            ...(foe.targetHero && foe.stats && foe.stats.fly ? {high: true} : {})});
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
    // Heroes defend: the Knight on the ground, walking around their own buildings and walls, and can't target flyers;
    // the Dragon (and, in replays from before Oct 22 2026, the Wizard) can. The Dragon flies straight over everything,
    // and only archers and flyers' fire reach him (pick). All can be attacked and defeated, and return unharmed to the
    // permanent roster afterward.
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
          if (T.range > 1) B.shots.push({k: h.t, from: h.id, x0: h.x, y0: h.y, x1: foe.x, y1: foe.y, ...(h.species ? {species: h.species, color: h.color} : {}),
            t0: B.t, t1: B.t + .3, u: foe.id, d: T.dps, splash: T.splash, air: T.air, foe: true, high: !!combatStats(foe).fly});
          else { hurtTroop(foe, T.dps); B.fx.push({k: 'hit', t: B.t, x: foe.x, y: foe.y, id: h.id}); }
        }
        return;
      }
      if (!foe && distance < .7) return;
      if (T.fly) {
        const go = Math.min(T.speed * DT, Math.max(0, distance - (foe ? T.range : 0)));
        if (distance > 1e-6) { h.x += (target.x - h.x) / distance * go; h.y += (target.y - h.y) / distance * go; }
        h.cx = h.x; h.cy = h.y;
        return;
      }
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
  B.result = () => ({stars: B.stars(), pct: B.pct(), got: Object.assign({}, B.got), gotBy: JSON.parse(JSON.stringify(B.gotBy)), used: Object.assign({}, B.used), t: B.t, drops: B.drops.slice(), heroes: {...heroes},
    ...(rules >= 3 ? {dragons: dragonSnapshot(heroes, dragons), defenderDragons: dragonSnapshot(defending, defenderDragons)} : {})});
  return B;
}

/** Plays a recorded raid again from its drops ([[step, troop, x*10, y*10]]): the same raid. options.end: the step it
 *  ended on (a raid called off, End, or the computer's when no one was left: realm.js decodeReplay's end), where this one
 *  ends too. */
export function replay(base, loot, army, drops, until = Infinity, options = {}) {
  const B = makeBattle(base, loot, army, options);
  const stop = Number.isInteger(options && options.end) ? options.end : Infinity;
  let k = 0;
  while (!B.over && B.t < until) {
    while (k < drops.length && drops[k][0] <= B.step) { const d = drops[k++]; B.deploy(d[1], d[2] / 10, d[3] / 10); }
    if (B.step >= stop) { B.end(); break; }
    B.step1();
  }
  return B;
}
/**
 * A recorded raid to watch (P: realm.js replayOf(rec) / decodeReplay(rp)): makeBattle's battle B on the recorded lot,
 * take and army, with B.play(t) to run its clock to t seconds (the drops go in at their steps, as they did; it ends
 * where it did), B.dur (its length, seconds) and B.P (P). Draw it as a live raid's (views/realm-3d.js raidStart(B),
 * then raidFrame(t) each frame); to start over, make another. null without a replay.
 */
export function replayBattle(P) {
  if (!P || !P.base || !Array.isArray(P.drops)) return null;
  const B = makeBattle(P.base, P.loot, P.army, P.opts || {}), drops = P.drops;
  const stop = Number.isInteger(P.end) ? P.end : Infinity;
  let k = 0;
  const feed = () => { while (k < drops.length && drops[k][0] <= B.step) { const d = drops[k++]; B.deploy(d[1], d[2] / 10, d[3] / 10); } };
  B.P = P;
  B.dur = Number.isFinite(stop) ? stop * DT : RAID_S;
  B.play = t => {
    while (!B.over && B.t + DT <= t + 1e-9) { feed(); if (B.step >= stop) { B.end(); break; } B.step1(); }
    if (!B.over) { feed(); if (B.step >= stop) B.end(); }
    return B;
  };
  return B;
}
/** A record's replay to watch (replayBattle(replayOf(rec, s))): the owner's alone; null for a record without one. s: the
 *  realm it's on (its lots), the owner's in memory when not given. */
export const replayRaid = (rec, s) => replayBattle(replayOf(rec, s));

// ---------------------------------------------------------------------------------------------------- raids on you
// The computer's realms raid yours (The Keep is the owner's alone, so they're the only ones who can): at most one in
// each half of the day (12 hours from midnight), at an hour of it that's the same on every phone; none in your
// realm's first day or before your Castle is level DEFEND_AT (3: the owner, Oct 22 2026, was 2; the example raids aren't
// held to it), none during a truce (12 hours after one that took a star), and no
// more than the last two while you were away. The raiders are the realm a level below yours, an army a little smaller
// than yours could be, all coming from one side: knights (and from Castle 7 the computer's Dragon Hero: raidHeroes) first,
// the rest a moment later.
export const TRUCE_H = 12, WINDOW_H = 12;
const WARM = 8;
/** When the raids on s since it last looked fall (ms), the last two at most. A half day that already has a raid on the
 *  record (s.df) has no other (the hour moved on Oct 22 2026: that day's morning raid had come at the old hour). */
export function raidsDue(s, now = Date.now()) {
  const from = Math.max(s.lr || 0, (s.born || 0) + 24 * HOUR, now - 2 * 24 * HOUR), out = [];
  const had = (Array.isArray(s.df) ? s.df : []).map(r => Number(r && r.at)).filter(Number.isFinite);
  const d0 = new Date(from); d0.setHours(0, 0, 0, 0);
  for (let w = d0.getTime(); w <= now; w += WINDOW_H * HOUR) {
    const d = new Date(w), R = rng(d.getFullYear() * 1000 + (d.getMonth() + 1) * 40 + d.getDate() + Math.floor(d.getHours() / WINDOW_H) * 17 + 7);
    // (one day's seed is the next's but for a little, and the first draw from seeds that close is nearly the same: the
    // raids came at about 05:26 and 17:26 every day till Oct 22 2026. A few draws thrown away first, and the hour moves.)
    for (let j = 0; j < WARM; j++) R();
    const at = Math.round(w + (1 + R() * (WINDOW_H - 2)) * HOUR);
    if (had.some(t => t >= w && t < w + WINDOW_H * HOUR)) continue;
    if (at > from && at <= now) out.push(at);
  }
  return out.slice(-2);
}
/** The army a computer realm raids a Castle of level th with (its trained troops; raidHeroes, who leads it). From Oct 22
 *  2026 no trained dragon (the room it took goes to the rest): from Castle 7 the computer's Dragon Hero leads it instead. */
export function raidArmy(th) {
  const room = 10 + th * 5, a = {};
  let left = room;
  const add = (t, n) => { n = Math.min(n, Math.floor(left / TROOPS[t].room)); if (n > 0) { a[t] = (a[t] || 0) + n; left -= n * TROOPS[t].room; } };
  if (th >= 3) add('knight', Math.floor(th / 2));
  if (th >= 5) add('thief', 4);
  add('archer', Math.floor(left * .45));
  add('footman', left);
  return a;
}
/** The heroes leading the computer's raid on a Castle of level th ({hero: level}): from Castle 7 (where a trained dragon
 *  came till Oct 22 2026) the raiding realm's Dragon Hero (the realm a level below, defend's), at the level of the
 *  hatchery on its lot (core/realm.js botDragon); none below. */
export function raidHeroes(th) {
  const l = th >= 7 ? botDragon(Math.max(1, Math.min(BOTS.length, th - 1))) : 0;
  return l ? {dragon_soul_eater: l} : {};
}
/** The computer's army raiding realm s at moment at (its lot and take then), all from one side (0 top, 1 right, 2
 *  bottom, 3 left): its heroes (raidHeroes: {hero: level}) and knights first, the rest 25 steps later, spread along
 *  it. Played out a step at a time (a generator: it yields after each step; raidOn runs it through), the battle
 *  returned; B.ms[k]: the step it first had k stars, and what it had then (pct, got, gotBy), when it came on a step of
 *  its own. Reads s, never changes it. */
function* raidSteps(s, at, army, side, heroes = {}, dragons = {}) {
  const B = makeBattle(s, lootOf(s, at), army, {heroes, dragons}), box = boxOf(s);
  // a spot on that side, outside the walls' reach, spread along it
  const spot = (f, out0) => {
    for (let o = out0; o < out0 + 6; o += 1) {
      const along = box.x0 + f * (box.x1 - box.x0), across = box.y0 + f * (box.y1 - box.y0);
      const p = side === 0 ? [along, box.y0 - o] : side === 1 ? [box.x1 + o, across] : side === 2 ? [along, box.y1 + o] : [box.x0 - o, across];
      if (B.canDrop(p[0], p[1])) return p;
    }
    return null;
  };
  const first = ['knight'], plan = [];
  // (its heroes lead, at the middle of that side)
  const leaders = Object.keys(B.heroes), spread = Object.keys(dragons).length > 0;
  leaders.forEach((k, i) => plan.push([0, HEROES[k].troop, spread ? (i + .5) / leaders.length : .5]));
  Object.entries(army).forEach(([t, n]) => { for (let i = 0; i < n; i++) plan.push([first.includes(t) ? 0 : 25, t, (i + .5) / n]); });
  plan.sort((a, b) => a[0] - b[0]);
  let k = 0, had = 0;
  B.ms = [];
  while (!B.over) {
    while (k < plan.length && plan[k][0] <= B.step) { const [, t, f] = plan[k++], p = spot(.2 + f * .6, 1.5); if (p) B.deploy(t, p[0], p[1]); }
    B.step1();
    const st = B.stars();
    if (st > had) { had = st; B.ms[st] = {step: B.step, pct: B.pct(), got: Object.assign({}, B.got), gotBy: JSON.parse(JSON.stringify(B.gotBy))}; }
    if (k >= plan.length && !B.fieldLeft()) break;
    yield;
  }
  return B;
}
/** raidSteps played through at once. */
function raidOn(s, at, army, side, heroes = {}) {
  const g = raidSteps(s, at, army, side, heroes);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
/** A raid on s as a record (defend's and exampleRaids'), its replay with it (rp: s's lot then, kept in into's lots, and
 *  the computer's drops). */
function recordOf(s, B, at, bot, id, into = s) {
  const r = B.result(), ls = [0, 0], lb = {}, th = keepOf(s);
  Object.entries(r.gotBy).forEach(([bid, v]) => {
    const b = s.b.find(x => x.i === Number(bid));
    if (b && KINDS[b.t].role === 'make') lb[bid] = [v.gold, v.grain];
    else { ls[0] += v.gold; ls[1] += v.grain; }
  });
  const rec = {id, at, by: bot.name, th: bot.th, st: r.stars, pc: r.pct, lt: [r.got.gold, r.got.grain], ls, lb, td: r.stars ? -r.stars * th * 3 : th * 3,
    hr: heroLevels(s), dragons: dragonSnapshot(B.heroes, B.dragons),
    defenderDragons: dragonSnapshot(Object.fromEntries(B.defenders.map(u => [u.hero, u.level])), B.defenderDragons)};
  const rp = snapOf(B, {sc: s.sc ? sceneryOf(s) : '', into});
  if (rp) rec.rp = rp;
  return rec;
}
/** Plays the raids on s that are due (raidsDue) and takes each off it (core/realm.js takeRaid), each on the record with
 *  its replay (rp: realm.js snapOf; the newest RP_KEEP keep theirs). Mutates s; returns the raids played. */
export function defend(s, now = Date.now()) {
  if (keepOf(s) < DEFEND_AT) { s.lr = Math.max(s.lr || 0, now); return []; }
  const out = [];
  raidsDue(s, now).forEach(at => {
    s.lr = at;
    if (at < (s.sh || 0)) return;
    const th = keepOf(s), bot = BOTS[Math.max(0, Math.min(BOTS.length - 1, th - 2))], army = raidArmy(th), R = rng(at % 2147483647);
    const B = raidOn(s, at, army, Math.floor(R() * 4), raidHeroes(th));
    const rec = recordOf(s, B, at, bot, 'd' + at.toString(36));
    takeRaid(s, rec);
    if (rec.st) s.sh = at + TRUCE_H * HOUR;
    out.push(rec);
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------- example raids
// The owner's ask (Oct 22 2026): "Provide examples of computer raids for me". Three of the computer's raids on his realm
// as it is now, played for real by the same engine and recorded like real ones (with their replays), for him to watch:
// one driven off (no star), one that takes a star, one that breaks through (three). Each outcome is found, the same every
// time for the same realm, on a fixed ladder of armies, small to large, each from a side of its own: a raid takes more the
// bigger it is, so halving the ladder finds where the stars start and where it breaks through in a few raids (it played a
// dozen or more, a few seconds' work at Castle 5 with his heroes defending). Where the ladder has no raid that took just
// one star, one that took more is called off on the step it first had one (its replay ends there; no raid played again);
// where none was driven off or broke through, the other sides of the smallest or the biggest army; failing all that, the
// nearest found. They're played a slice at a time on the owner's phone (exampleRaidsAsync), so Keepfall stays in his hand.
// They're for show: in s.ex (never s.df), ex: true, td 0, and nothing is ever taken off his realm (lt is what the raid
// would have carried off), no glory moves and no truce starts.
const EX_WANT = [0, 1, 3];
/** The armies the examples try, weakest first, for a Castle of level th: [{army, heroes}] (raidSteps'). From Oct 22 2026
 *  no trained dragons (the top rungs had 1, 3, 6, 12 and 24): more knights and archers in their place, led by the
 *  computer's Dragon Hero (at the level a hatchery reaches a Castle above his, rising to the top). Without a flock of
 *  dragons a full Castle 7 or 8 lot, his Knight and Dragon Hero at 10 defending it, held out against 190 troops, so the
 *  ladder goes on to two hosts the size of a siege (300 and 430 troops) that break through it from most sides. */
function exLadder(th) {
  const dl = Math.max(1, topLevel('hatchery', Math.min(BOTS.length, th + 1))), up = l => ({dragon_soul_eater: Math.max(1, Math.min(10, l))});
  const raid = t => ({army: raidArmy(t), heroes: raidHeroes(t)});
  return [{army: {footman: 2}}, {army: {footman: 4}}, {army: {footman: 6, archer: 3}}, raid(Math.max(1, th - 1)), raid(th), raid(th + 1),
    {army: {footman: 20, archer: 15, knight: 4}}, {army: {footman: 25, archer: 22, knight: 7}, heroes: up(dl)}, {army: {footman: 30, archer: 30, knight: 10}, heroes: up(dl)},
    {army: {footman: 35, archer: 45, knight: 16}, heroes: up(dl + 2)}, {army: {footman: 40, archer: 70, knight: 26}, heroes: up(dl + 4)},
    {army: {footman: 50, archer: 100, knight: 40}, heroes: up(10)}, {army: {footman: 80, archer: 160, knight: 60}, heroes: up(10)},
    {army: {footman: 100, archer: 250, knight: 80}, heroes: up(10)}];
}
/** A battle called off on the step it first had k stars (raidSteps' B.ms): what a record and its replay read of it, as
 *  if it had ended there (its drops till then). null when it never had k on a step of its own. */
function cutAt(B, k) {
  const m = B.ms && B.ms[k];
  if (!m) return null;
  return {bl: B.bl, step: m.step, drops: B.drops.filter(d => d[0] < m.step), left: B.left, used: B.used, heroes: B.heroes, defenders: B.defenders, dragons: B.dragons, defenderDragons: B.defenderDragons, rules: B.rules,
    stars: () => k, result: () => ({stars: k, pct: m.pct, got: Object.assign({}, m.got), gotBy: JSON.parse(JSON.stringify(m.gotBy))})};
}
/** The search for the example raids on s at now, a battle step at a time (a generator: exampleRaids runs it through at
 *  once, exampleRaidsAsync a slice at a time). Reads s, never changes it. Returns {recs, lots}: the records (ex: true,
 *  taking nothing) and the lot they were played on (lots, {key: packed}: putExamples keeps it on the realm). */
function* exampleSearch(s, now) {
  const th = keepOf(s), ladder = exLadder(th), L = ladder.length, seen = new Map();
  // (an army from a side, played out once: the same battle isn't played twice; st -1: nowhere to send it)
  function* play(j, side) {
    const key = `${j}:${side}`;
    if (!seen.has(key)) { const B = yield* raidSteps(s, now, ladder[j].army, side, ladder[j].heroes || {}); seen.set(key, {j, side, B, st: B.drops.length ? B.stars() : -1, pc: B.pct()}); }
    return seen.get(key);
  }
  // (the smallest army up to hi, each from a side of its own, that takes k stars or more; hi + 1 when none does)
  function* first(k, hi) {
    let lo = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1, x = yield* play(m, m % 4); if (x.st >= k) hi = m - 1; else lo = m + 1; }
    return lo;
  }
  const j3 = yield* first(3, L - 1);
  yield* first(1, Math.min(j3, L - 1));
  const all = () => [...seen.values()], pick = {};
  // (driven off: the biggest army that was; none, even the smallest took a star: it from the other sides)
  pick[0] = all().filter(x => x.st === 0).sort((a, b) => b.j - a.j || a.side - b.side)[0] || null;
  for (let q = 1; q < 4 && !pick[0]; q++) { const x = yield* play(0, q); if (x.st === 0) pick[0] = x; }
  // (broken through: the smallest army that did; none: the biggest from the other sides)
  pick[3] = all().filter(x => x.st === 3).sort((a, b) => a.j - b.j || a.side - b.side)[0] || null;
  for (let q = 1; q < 4 && !pick[3]; q++) { const x = yield* play(L - 1, (L - 1 + q) % 4); if (x.st === 3) pick[3] = x; }
  // (a star: the smallest army that took just the one; none: the smallest that took more, called off as it took it)
  pick[1] = all().filter(x => x.st === 1).sort((a, b) => a.j - b.j || a.side - b.side)[0] || null;
  if (!pick[1]) {
    const over = all().filter(x => x.st > 1 && x.B.ms[1]).sort((a, b) => a.j - b.j || a.side - b.side)[0];
    if (over) pick[1] = {j: over.j, side: over.side, B: cutAt(over.B, 1), st: 1, pc: over.B.ms[1].pct};
  }
  const shown = new Set(), recs = [], hold = {};
  EX_WANT.forEach((want, n) => {
    // (else the nearest found that isn't already one of them, one that did more before one that did less: on a lot where
    // the Castle falls with half of it, the first star comes with the second, and a raid that took two shows more than
    // another driven off; of those as near, for a star or the sacking the one that went furthest (most knocked down, then
    // the bigger army: Oct 23 2026, it was the smallest, and a full lot's examples were three raids driven off, one of
    // them 5%), for the one driven off the one that did least)
    const got = pick[want] || all().filter(x => x.st >= 0 && !shown.has(x)).sort((a, b) => Math.abs(a.st - want) - Math.abs(b.st - want) || b.st - a.st
      || (want ? b.pc - a.pc || b.j - a.j : a.pc - b.pc || a.j - b.j))[0];
    if (!got) return;
    shown.add(got);
    // (the raiders: a realm below his for the one driven off, his own level's for the star, above his for the sacking)
    const bot = BOTS[Math.max(0, Math.min(BOTS.length - 1, th - 2 + n))];
    const rec = recordOf(s, got.B, now, bot, `x${now.toString(36)}${n}`, hold);
    if (rec.rp) recs.push(Object.assign(rec, {ls: [0, 0], lb: {}, td: 0, ex: true}));
  });
  return {recs, lots: hold.lots || {}};
}
/** Three explicit demonstrations on a snapshot of Evan's base. They use the
 * real simulator and replay format, but never apply their loot or destruction. */
function* dragonExampleSearch(s, now) {
  const th = keepOf(s), level = Math.max(1, topLevel('hatchery', th));
  const chosen = heroDragons(s), colors = {nightmare: 'green', 'soul-eater': 'purple', 'terror-bringer': 'albino', usurper: 'black'};
  const scenes = [
    {name: 'Nightmare & Soul Eater', species: ['nightmare', 'soul-eater'], army: {footman: 24, archer: 16}, side: 0, level},
    {name: 'Terror Bringer & Usurper', species: ['terror-bringer', 'usurper'], army: {footman: 30, archer: 30, knight: 8}, side: 1, level},
    {name: 'Four-Dragon Siege', species: DRAGON_ORDER, army: {footman: 80, archer: 80, knight: 40}, side: 2, level: Math.min(10, level + 2)}
  ];
  const recs = [], hold = {};
  for (const [i, scene] of scenes.entries()) {
    const heroes = {}, dragons = {};
    for (const species of scene.species) {
      const D = DRAGONS[species]; heroes[D.hero] = scene.level;
      dragons[D.hero] = {species, color: chosen[D.hero]?.color || colors[species]};
    }
    const B = yield* raidSteps(s, now, scene.army, scene.side, heroes, dragons);
    const rec = recordOf(s, B, now, {name: scene.name, th}, `xd${now.toString(36)}${i}`, hold);
    if (rec.rp) recs.push({...rec, ls: [0, 0], lb: {}, td: 0, ex: true, demo: 'dragons-v1'});
  }
  return {recs, lots: hold.lots || {}};
}
/**
 * Makes the three example raids on s at now (EX_WANT: 0, 1 and 3 stars, as far as his realm allows), into s.ex (and
 * s.exv = EX_V, the lot they were played on in s.lots), all at once (the checks; the owner's phone uses
 * exampleRaidsAsync); the owner's alone (elsewhere: nothing made, nothing changed, []). Touches nothing else of s: not its
 * stores, the mines' piles, glory, the truce or when it was last raided. Returns the records (s.ex).
 */
export function exampleRaids(s, now = Date.now()) {
  if (!mayPlay() || !s || !Array.isArray(s.b)) return [];
  const g = exampleSearch(s, now);
  let r;
  do { r = g.next(); } while (!r.done);
  return putExamples(s, r.value.recs, r.value.lots);
}
// (a generator run a slice at a time, about budget ms each with the page's own work between, while ok() holds: its
// result, or null when ok() stopped holding)
function sliced(gen, ok, budget) {
  return new Promise((done, fail) => {
    const go = () => {
      try {
        if (!ok()) { done(null); return; }
        const t0 = performance.now();
        for (;;) { const r = gen.next(); if (r.done) { done(r.value); return; } if (performance.now() - t0 >= budget) break; }
        setTimeout(go, 0);
      } catch (e) { fail(e); }
    };
    setTimeout(go, 0);
  });
}
let EX_RUN = null;
/**
 * exampleRaids a slice at a time (a battle step or a few, about budget ms, then the page's own work: played at once, a
 * dozen battles held Keepfall still for seconds), on a copy of s as it is now, and put (putExamples) on into() — the
 * realm as it is when they're done (s by default; it may have been synced or changed meanwhile, or say no: null) — only
 * if still() holds then and all along (Keepfall open) and it's still the owner's phone. Resolves to the records, or null
 * when stopped. One at a time: asked again while one runs, the same promise.
 */
export function exampleRaidsAsync(s, now = Date.now(), {still = () => true, into = () => s, budget = 8, dragonDemo = false} = {}) {
  if (EX_RUN) return EX_RUN;
  if (!mayPlay() || !s || !Array.isArray(s.b)) return Promise.resolve(null);
  const profile = profileKey(), showDragons = dragonDemo && dragonExamplesForMe();
  const ok = () => mayPlay() && profileKey() === profile && !!still();
  const gen = (showDragons ? dragonExampleSearch : exampleSearch)(JSON.parse(JSON.stringify(s)), now);
  EX_RUN = sliced(gen, ok, budget).then(res => {
    if (!res || !ok()) return null;
    const t = into();
    return t && Array.isArray(t.b) ? putExamples(t, res.recs, res.lots) : null;
  }).finally(() => { EX_RUN = null; });
  return EX_RUN;
}
/** Whether example raids are being made now (exampleRaidsAsync). */
export const examplesBusy = () => !!EX_RUN;
/** Makes the example raids once (the owner opening Keepfall after they shipped: s.exv not yet EX_V); true if it did (the
 *  realm changed: save it). Never again by itself once made or cleared ("New examples": exampleRaids). All at once: the
 *  checks; the owner's phone uses ensureExamplesAsync. */
export function ensureExamples(s, now = Date.now()) {
  if (!mayPlay() || !s || s.exv === EX_V) return false;
  exampleRaids(s, now);
  return true;
}
/** ensureExamples a slice at a time (exampleRaidsAsync): resolves true if it made them, on into() (the realm when they're
 *  done, unless it has had them made or cleared meanwhile, on another phone). */
export function ensureExamplesAsync(s, now = Date.now(), {still = () => true, into = () => s, budget = 8, dragonDemo = false} = {}) {
  const showDragons = dragonDemo && dragonExamplesForMe(), current = t => showDragons ? t.exdv === 1 : t.exv === EX_V;
  if (!mayPlay() || !s || current(s) || EX_RUN) return Promise.resolve(false);
  return exampleRaidsAsync(s, now, {still, budget, dragonDemo: showDragons, into: () => { const t = into(); return t && !current(t) ? t : null; }}).then(r => !!r);
}
