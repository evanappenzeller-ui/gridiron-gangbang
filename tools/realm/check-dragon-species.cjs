// Pure integration tests: no browser, network, timers, local storage or remote saves.
// node tools/realm/check-dragon-species.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const uri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const pay = uri(read('js/core/realm-pay.js')), catalog = uri(read('js/core/realm-dragons.js'));
const realm = uri(read('js/core/realm.js')
  .replace("import * as daily from './daily.js';", 'const daily={LB:{}};')
  .replace("import * as data from './data.js';", 'const data={me:()=>globalThis.__profile||null,guest:()=>globalThis.__guest||null,user:()=>null,subscribe:()=>()=>{}};')
  .replaceAll("from './realm-pay.js'", 'from ' + JSON.stringify(pay))
  .replaceAll("from './realm-dragons.js'", 'from ' + JSON.stringify(catalog)));
const battle = uri(read('js/core/realm-battle.js').replace("from './realm.js'", 'from ' + JSON.stringify(realm)));
const clone = x => JSON.parse(JSON.stringify(x));

(async () => {
  globalThis.__profile = 'evan';
  const F = await import(realm), B = await import(battle), D = await import(catalog);
  const NOW = Date.UTC(2026, 9, 26, 12);
  const state = (castle = 8) => { const s = F.fresh(NOW); s.b[0].l = castle; s.r = {gold: 10000000, grain: 10000000}; return s; };
  const hatch = (s, level, choice) => {
    const p = F.spotFor(s, 'hatchery'); assert(p);
    const b = {i: s.nb++, t: 'hatchery', l: level, x: p.x, y: p.y, u: 0};
    if (choice) b.dragon = {...choice}; s.b.push(b); return b;
  };
  assert.deepEqual(D.DRAGON_ORDER, ['nightmare', 'soul-eater', 'terror-bringer', 'usurper']);
  assert.deepEqual(D.DRAGON_ORDER.map(s => D.DRAGONS[s].colors), [
    ['red', 'green', 'blue', 'albino'], ['red', 'purple', 'green', 'blue'], ['red', 'grey', 'green', 'albino'], ['red', 'blue', 'black', 'albino']
  ]);
  assert.deepEqual(Array.from({length: 8}, (_, i) => F.allowed(state(i + 1), 'hatchery')), [0, 0, 0, 1, 2, 3, 4, 4]);
  for (const species of D.DRAGON_ORDER) assert.equal(D.dragonSpeciesOfHero(D.DRAGONS[species].troop), species);
  for (const bad of ['__proto__', 'toString', '', null]) assert.equal(D.dragonHeroKey(bad), null);

  // Existing buildings and construction retain their levels/progress but acquire no invented choice.
  const old = state(), unassigned = hatch(old, 6), constructing = hatch(old, 0);
  constructing.u = NOW + 5000;
  const migrated = F.clean(old);
  assert.equal(migrated.b.find(b => b.i === unassigned.i).l, 6);
  assert.equal(migrated.b.find(b => b.i === constructing.i).u, constructing.u);
  assert.deepEqual(F.heroLevels(migrated), {});
  assert.equal(F.dragonOfBuilding(migrated, unassigned.i), null);
  const assigned = migrated.b.find(b => b.i === unassigned.i);
  assert(F.chooseHatcheryDragon(migrated, assigned.i, 'nightmare', 'albino'));
  assert.equal(F.heroLevel(migrated, 'dragon_nightmare'), 6);
  assert(!F.chooseHatcheryDragon(migrated, assigned.i, 'usurper', 'red'), 'Chosen species cannot change');
  assert(F.chooseHatcheryDragon(migrated, assigned.i, 'nightmare', 'blue'), 'Recolor remains available');
  assert(!F.chooseHatcheryDragon(migrated, constructing.i, 'nightmare', 'red'), 'Cannot duplicate a species');
  assert(!F.chooseHatcheryDragon(migrated, constructing.i, 'usurper', 'green'), 'Reject unsupported colors');
  assert(F.chooseHatcheryDragon(migrated, constructing.i, 'usurper', 'black'));
  assert.equal(F.heroLevel(migrated, 'dragon_usurper'), 0, 'Construction reserves identity but creates no combat hero');
  F.tick(migrated, constructing.u);
  assert.equal(F.heroLevel(migrated, 'dragon_usurper'), 1);
  assigned.u = NOW + 100000;
  assert.equal(F.heroLevel(migrated, 'dragon_nightmare'), 6, 'An upgrade retains the completed level');
  F.tick(migrated, assigned.u);
  assert.equal(F.heroLevel(migrated, 'dragon_nightmare'), 7);

  const dirty = clone(migrated), duplicate = hatch(dirty, 9, {species: 'nightmare', color: 'red'});
  const invalid = hatch(dirty, 5, {species: 'usurper', color: 'green'});
  dirty.b.find(b => b.i === assigned.i).dragon.injected = 'drop';
  const cleaned = F.clean(dirty);
  assert.equal(cleaned.b.find(b => b.i === duplicate.i).l, 9, 'Duplicate building is preserved');
  assert.equal(cleaned.b.find(b => b.i === duplicate.i).dragon, undefined, 'Duplicate identity becomes unassigned');
  assert.equal(cleaned.b.find(b => b.i === invalid.i).dragon, undefined);
  assert.deepEqual(cleaned.b.find(b => b.i === assigned.i).dragon, {species: 'nightmare', color: 'blue'});
  assert.deepEqual(F.clean(cleaned), cleaned, 'Migration is idempotent');

  // Construction requires a reviewable selection before spending, including uniqueness with pending jobs.
  const buildState = state(4), spot = F.spotFor(buildState, 'hatchery'), before = clone(buildState);
  assert.equal(F.build(buildState, 'hatchery', spot.x, spot.y, NOW), null);
  assert.deepEqual(buildState, before, 'Missing choice does not spend or reserve a building ID');
  const made = F.build(buildState, 'hatchery', spot.x, spot.y, NOW, {species: 'soul-eater', color: 'purple'});
  assert(made && made.l === 0 && made.dragon.color === 'purple');
  assert.equal(F.hatcheryChoices(buildState).some(d => d.id === 'soul-eater'), false);
  F.tick(buildState, made.u); assert.equal(F.heroLevel(buildState, 'dragon_soul_eater'), 1);
  assert.equal(F.canBuild(buildState, 'hatchery').ok, false, 'Castle 4 has only one hatchery slot');
  console.log('PASS: catalog, Castle unlocks, explicit selection, uniqueness, recoloring, construction, save migration');

  const home = state(); home.hr.knight = 5;
  D.DRAGON_ORDER.forEach((species, i) => hatch(home, i + 1, {species, color: D.DRAGONS[species].colors[3]}));
  assert.deepEqual(F.heroLevels(home), {knight: 5, dragon_nightmare: 1, dragon_soul_eater: 2, dragon_terror_bringer: 3, dragon_usurper: 4});
  assert.equal(Object.keys(F.heroArmy(home)).length, 5);
  const snapshot = F.heroDragons(home), levels = F.heroLevels(home), A = B.makeBattle(F.botBase(7), null, {footman: 3}, {heroes: levels, dragons: snapshot});
  for (const [i, k] of F.HERO_ORDER.entries()) assert(A.deploy(F.HEROES[k].troop, 3 + i * 2, 3));
  for (const k of F.HERO_ORDER) assert.equal(A.deploy(F.HEROES[k].troop, 3, 3), null, 'Every hero deploys once');
  const nightmare = A.tr.find(u => u.hero === 'dragon_nightmare');
  assert.equal(nightmare.stats.fly, false); assert.equal(nightmare.stats.air, false); assert.equal(nightmare.stats.range, .8);
  assert(A.tr.filter(u => u.species && u.species !== 'nightmare').every(u => u.stats.fly));
  snapshot.dragon_nightmare.color = 'red'; levels.dragon_nightmare = 10;
  assert.equal(nightmare.color, 'albino'); assert.equal(nightmare.level, 1, 'Battle snapshots remain immutable');
  const defense = B.makeBattle(home, null, {footman: 3});
  assert.equal(defense.defenders.length, 5);
  assert.deepEqual(defense.defenders.filter(u => u.species).map(u => [u.species, u.color, u.level]), D.DRAGON_ORDER.map((s, i) => [s, D.DRAGONS[s].colors[3], i + 1]));
  for (const unit of defense.defenders.filter(u => u.species)) {
    const nest = home.b.find(b => b.i === unit.buildingId), size = F.KINDS.hatchery.size;
    if (unit.stats.fly) assert.deepEqual(unit.home, {x: nest.x + size / 2, y: nest.y + size / 2});
    else assert(!home.b.some(b => unit.x >= b.x && unit.y >= b.y && unit.x < b.x + F.KINDS[b.t].size && unit.y < b.y + F.KINDS[b.t].size), 'Nightmare starts on clear ground');
  }
  for (const species of D.DRAGON_ORDER) {
    const k = D.DRAGONS[species].hero;
    for (let level = 2; level <= 10; level++) {
      assert(F.heroStat(k, level).hp > F.heroStat(k, level - 1).hp);
      assert(F.heroStat(k, level).dps > F.heroStat(k, level - 1).dps);
    }
  }

  // Nightmare walks and breaks a real closed wall; a flying species routes over it.
  const walled = {b: [{i: 1, t: 'keep', l: 1, x: 21, y: 21, u: 0}]};
  let bid = 2;
  for (let n = 19; n <= 26; n++) for (const [x, y] of [[19, n], [26, n], [n, 19], [n, 26]]) {
    if (!walled.b.some(b => b.x === x && b.y === y)) walled.b.push({i: bid++, t: 'wall', l: 1, x, y, u: 0});
  }
  const ground = B.makeBattle(walled, null, {}, {heroes: {dragon_nightmare: 1}}), g = ground.deploy('hero_dragon_nightmare', 17, 22);
  const sky = B.makeBattle(walled, null, {}, {heroes: {dragon_soul_eater: 1}}), f = sky.deploy('hero_dragon_soul_eater', 17, 22);
  ground.run(1); sky.run(1); assert(g.path.length > 0); assert.equal(f.path.length, 0);
  ground.run(10); assert(ground.bl.some(b => b.wall && b.hp < b.max), 'Ground dragon attacks its obstructing wall');
  assert.equal(ground.shots.some(s => s.k === g.t), false, 'Nightmare uses melee, not aerial fire');
  sky.run(10); assert(sky.bl.filter(b => b.wall).every(b => b.hp === b.max), 'Flying dragon bypasses walls');
  console.log('PASS: independent levels and deployables, four defenders, immutable choices, grounded Nightmare pathing');

  // A real attack and defense round-trip both dragon rosters, colors, per-building homes and outcomes.
  for (const [base, army, options] of [[F.botBase(6), {archer: 5}, {heroes: F.heroLevels(home), dragons: F.heroDragons(home)}], [home, {footman: 20, archer: 15}, {heroes: {dragon_usurper: 4}, dragons: {dragon_usurper: {species: 'usurper', color: 'black'}}}]]) {
    const fight = B.makeBattle(base, null, army, options);
    for (const [i, hero] of Object.keys(fight.heroes).entries()) fight.deploy(F.HEROES[hero].troop, 3 + i, 3);
    for (const [kind, count] of Object.entries(army)) for (let i = 0; i < count; i++) fight.deploy(kind, 4 + i % 30, 3);
    fight.run(Infinity);
    const rp = F.snapOf(fight), P = F.decodeReplay(rp);
    assert(rp && rp.v === 4 && P && P.rules === 3);
    assert.deepEqual(P.dragons, fight.dragons); assert.deepEqual(P.defenderDragons, fight.defenderDragons);
    const replay = B.replay(P.base, P.loot, P.army, P.drops, Infinity, P.opts);
    assert.deepEqual(replay.result(), fight.result());
    const scrub = B.replayBattle(P); scrub.play(P.dur + 1); assert.deepEqual(scrub.result(), fight.result());
    for (const d of Object.values(P.defenderDragons)) if (d.buildingId != null) assert.deepEqual(P.base.b.find(b => b.i === d.buildingId).dragon, {species: d.species, color: d.color});
    const recolor = home.b.find(b => b.dragon?.species === 'usurper'); recolor.dragon.color = 'blue';
    assert.equal(F.decodeReplay(rp).dragons.dragon_usurper?.color, fight.dragons.dragon_usurper?.color);
  }
  console.log('PASS: new attack/defense replay snapshots retain exact choices, colors, homes and battle outcomes');

  const attackState = state(), record = {vs: 'bot:7', at: NOW, st: 0, pc: 0, lt: [0, 0], ta: 0};
  F.finishRaid(attackState, record, {}, NOW, A);
  const savedChoice = clone(record.dragons);
  A.dragons.dragon_nightmare.color = 'green';
  assert.deepEqual(record.dragons, savedChoice, 'Chronicle choices are copied independently from the live battle');

  const legacy2 = JSON.parse(read('tools/realm/dragon-rules2-fixture.json'));
  assert.equal(F.battleMark(1), legacy2.marks[0]); assert.equal(F.battleMark(2), legacy2.marks[1]);
  assert.deepEqual(F.botBase(7, 2), legacy2.base, 'Rules-2 computer lot remains byte-for-byte compatible');
  const oldP = F.decodeReplay(legacy2.rp); assert(oldP && oldP.rules === 2);
  assert.deepEqual(B.replay(oldP.base, oldP.loot, oldP.army, oldP.drops, Infinity, oldP.opts).result(), legacy2.result);
  const oldHome = state(); hatch(oldHome, 6); oldHome.hr.knight = 3;
  assert.equal(B.makeBattle(oldHome, null, {}, {rules: 1}).defenders.length, 0, 'Rules 1 keeps its original missing-snapshot inference');
  assert.deepEqual(B.makeBattle(oldHome, null, {}, {rules: 2}).defenders.map(u => [u.hero, u.level]), [['knight', 3], ['dragon', 6]]);
  const fixtureMatch = /^const RP_FIXTURE_V2 = (\{.*\});\r?$/m.exec(read('js/core/checks-realm.js'));
  assert(fixtureMatch); const legacy1 = JSON.parse(fixtureMatch[1]);
  for (const rec of legacy1.recs) {
    const P = F.decodeReplay(rec.rp, {lots: legacy1.lots}); assert(P && P.rules === 1, rec.n);
    const r = B.replay(P.base, P.loot, P.army, P.drops, Infinity, P.opts);
    assert.deepEqual([r.stars(), r.pct(), r.got.gold, r.got.grain, r.step, r.why], [rec.st, rec.pc, rec.got[0], rec.got[1], rec.step, rec.why], rec.n);
  }
  console.log('PASS: existing rules-1 fixtures and rules-2 Dragon Hero replay retain exact marks, lots and outcomes');

  // Exercise the corresponding in-app diagnostics too, without loading unrelated games or browser views.
  let kit = read('js/core/checks-realm.js')
    .replace("import * as F from './realm.js';", 'import * as F from ' + JSON.stringify(realm) + ';')
    .replace("import * as daily from './daily.js';", 'const daily={LB:{}};')
    .replace("import * as data from './data.js';", 'const data={me:()=>globalThis.__profile,guest:()=>null};')
    .replace("from './realm-battle.js'", 'from ' + JSON.stringify(battle));
  const preload = kit.indexOf('  const [kk, rm, sv, dr] = await Promise.all('), checksStart = kit.indexOf("  check('", preload);
  assert(preload > 0 && checksStart > preload);
  kit = kit.slice(0, preload) + '  const kk={dateOf:()=>new Date(2026,9,21)}, rm={}, sv={}, dr={};\n' + kit.slice(checksStart);
  const registered = [];
  await (await import(uri(kit))).realmChecks((name, run) => registered.push({name, run}));
  const selected = registered.filter(c => /a dragon flies over|the cannon and the Dragon Hatchery|four unique chosen dragons|retired with the Wizard Hero|the computer’s raids from Castle 7|raid replays recorded before the Dragon Hero/.test(c.name));
  assert.equal(selected.length, 6);
  for (const c of selected) { const result = await c.run(); assert(result === true || result.pass, c.name + '\n' + result.detail); }
  console.log('PASS: six updated in-app core diagnostics, including historical fixtures and generated raid examples');

  for (const profile of ['mason', null]) {
    globalThis.__profile = profile; globalThis.__guest = profile ? null : 'Guest';
    const s = state(), b = hatch(s, 1); assert(F.chooseHatcheryDragon(s, b.i, 'nightmare', 'green')); assert.equal(F.heroLevel(s, 'dragon_nightmare'), 1);
  }
  globalThis.__profile = null; globalThis.__guest = null;
  const denied = state(), b = hatch(denied, 1);
  assert(!F.chooseHatcheryDragon(denied, b.i, 'nightmare', 'red')); assert.deepEqual(F.heroLevels(home), {});
  console.log('PASS: member and guest access; unselected profile cannot mutate selections or deploy heroes');
})().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
