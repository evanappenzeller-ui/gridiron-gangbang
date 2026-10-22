// Isolated core checks: no browser, storage, timers, network or Firebase writes.
// Run: node tools/realm/check-heroes.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const uri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const realmSource = fs.readFileSync(path.join(root, 'js/core/realm.js'), 'utf8')
  .replace("import * as daily from './daily.js';", 'const daily = {};')
  .replace("import * as data from './data.js';", 'const data = {isOwner: () => globalThis.__keepHeroOwner === true};');
const realmUri = uri(realmSource);
const battleSource = fs.readFileSync(path.join(root, 'js/core/realm-battle.js'), 'utf8').replace("from './realm.js'", 'from ' + JSON.stringify(realmUri));
const clone = x => JSON.parse(JSON.stringify(x));

(async () => {
  globalThis.__keepHeroOwner = true;
  const F = await import(realmUri), {makeBattle, replay, defend, raidsDue} = await import(uri(battleSource));
  const at = Date.UTC(2026, 9, 22, 12);
  const state = (th = 8) => { const s = F.fresh(at); s.b[0].l = th; s.r.gold = 1000000; return s; };
  const fort = (hr = {}, th = 8) => ({b: [{i: 1, t: 'keep', l: th, x: 20, y: 20, u: 0}], hr, r: {gold: 0, grain: 0}});

  const legacy = state(); delete legacy.hr;
  assert.deepEqual(F.clean(legacy).hr, {}, 'old saves migrate without awarding free heroes');
  const dirty = state(); dirty.hr = {knight: 99, wizard: '5', thief: 10};
  assert.deepEqual(F.clean(dirty).hr, {knight: 10}, 'known integer levels clamp; unknown and malformed values are rejected');
  dirty.b[0].l = 2; dirty.hr = {knight: 8, wizard: 4};
  assert.deepEqual(F.clean(dirty).hr, {knight: 2}, 'save roster respects Keep caps and unlocks');
  for (const bad of [null, '', NaN, Infinity, -1, .5, 0, '2', true]) {
    dirty.hr = {knight: bad}; assert.equal(F.heroLevel(dirty, 'knight'), 0);
  }
  const s = state(1), noSpend = s.r.gold;
  assert.equal(F.recruitHero(s, 'knight'), false);
  s.b[0].l = 2;
  assert.equal(F.recruitHero(s, 'knight'), true);
  assert.equal(s.r.gold, noSpend - F.HEROES.knight.cost[0]);
  assert.equal(F.recruitHero(s, 'knight'), false, 'one champion per kind');
  assert.equal(F.upgradeHero(s, 'knight'), true);
  const afterLevel2 = JSON.stringify(s);
  assert.equal(F.upgradeHero(s, 'knight'), false, 'Keep 2 caps the Knight at level 2');
  assert.equal(JSON.stringify(s), afterLevel2, 'rejected upgrades do not spend Gold');
  assert.equal(F.recruitHero(s, 'wizard'), false);
  s.b[0].l = 8;
  assert.equal(F.recruitHero(s, 'wizard'), true);
  for (const k of F.HERO_ORDER) {
    while (F.heroLevel(s, k) < 10) assert.equal(F.upgradeHero(s, k), true);
    assert.equal(F.upgradeHero(s, k), false);
    assert(F.heroStat(k, 10).hp > F.heroStat(k, 1).hp);
    assert(F.heroStat(k, 10).dps > F.heroStat(k, 1).dps);
  }
  assert.deepEqual(F.clean(s).hr, s.hr, 'levels survive save/load');
  assert.deepEqual(F.heroArmy(s), {hero_knight: 1, hero_wizard: 1});
  for (const bad of ['dragon', 'toString', '__proto__', undefined]) {
    assert.equal(F.recruitHero(s, bad), false); assert.equal(F.upgradeHero(s, bad), false);
  }
  const poor = state(4); poor.r.gold = 0;
  assert.equal(F.recruitHero(poor, 'wizard'), false);
  console.log('PASS: legacy saves, strict input validation, recruit costs, uniqueness, upgrades and Keep caps');

  const army = {knight: 1}, options = {heroes: {knight: 7, wizard: 6}};
  const A = makeBattle(fort(), null, army, options);
  assert.equal(A.deploy('hero_knight', NaN, 29), null);
  assert.equal(A.deploy('hero_knight', '20', 29), null);
  assert.equal(A.deploy('hero_wizard', 22, Infinity), null);
  assert.equal(A.deploy('toString', 22, 29), null);
  const champion = A.deploy('hero_knight', 19.333, 29.777);
  assert(champion && champion.hero === 'knight' && champion.level === 7);
  assert.equal(champion.hp, F.heroStat('knight', 7).hp);
  assert.equal(A.deploy('hero_knight', 20, 30), null, 'hero deploys once per raid');
  const wizard = A.deploy('hero_wizard', 23.333, 29.777);
  assert(wizard && wizard.stats.splash > 0);
  assert(A.deploy('knight', 21, 29), 'ordinary Knights still deploy independently');
  options.heroes.knight = 10;
  assert.equal(A.heroes.knight, 7, 'raid snapshots cannot be changed by later upgrades');
  A.run(Infinity);
  assert.equal(A.stars(), 3, 'hero attacks actually damage and destroy the Keep');
  const replayed = replay(fort(), null, army, A.result().drops, Infinity, {heroes: A.result().heroes});
  assert.deepEqual(replayed.result(), A.result(), 'mixed hero/troop replay preserves stats, placement and results');
  const speed = level => {
    const B = makeBattle(fort(), null, {}, {heroes: {knight: level}});
    B.deploy('hero_knight', 20, 29); B.run(30);
    return B.bl[0].hp;
  };
  assert(speed(8) < speed(1), 'higher hero levels deal more damage in simulation');
  s.ar.knight = 3;
  const savedHeroes = clone(s.hr);
  F.finishRaid(s, {id: 'hero-test', vs: 'bot:8', lt: [0, 0], ta: 0}, A.used, at);
  assert.deepEqual(s.hr, savedHeroes, 'heroes survive raid completion');
  assert.equal(s.ar.knight, 2, 'ordinary deployed Knights are consumed');
  assert(!('hero_knight' in s.ar) && !('hero_wizard' in s.ar));
  const again = makeBattle(fort(), null, s.ar, {heroes: F.heroLevels(s)});
  assert.equal(again.left.hero_knight, 1, 'hero is ready again next raid');
  console.log('PASS: scaled hero combat, separate troop Knights, one deployment, reusable roster and deterministic replay');

  const defendWith = (heroes, army, seconds = 20) => {
    const base = fort(heroes), B = makeBattle(base, null, army);
    Object.entries(army).forEach(([t, count]) => { for (let i = 0; i < count; i++) B.deploy(t, 20 + i * .1, 29); });
    B.run(seconds);
    return B;
  };
  const ground = defendWith({knight: 2}, {footman: 12}), undefended = defendWith({}, {footman: 12});
  assert(ground.tr.filter(u => u.dead).length > undefended.tr.filter(u => u.dead).length, 'Knight kills ground raiders');
  assert(ground.bl[0].hp > undefended.bl[0].hp, 'Knight reduces actual damage to the Keep');
  const knightAir = defendWith({knight: 1}, {dragon: 1}, 10), wizardAir = defendWith({wizard: 2}, {dragon: 1}, 10);
  assert.equal(knightAir.tr[0].hp, F.TROOPS.dragon.hp, 'Knight cannot damage flying dragons');
  assert(wizardAir.tr[0].hp < F.TROOPS.dragon.hp, 'Wizard damages flying dragons');
  assert(knightAir.defenders[0].hp < knightAir.defenders[0].max, 'raiders fight and damage defending heroes');
  const splash = defendWith({wizard: 2}, {knight: 3}, 2);
  assert(splash.tr.filter(u => u.hp < u.max).length >= 2, 'Wizard splash hurts grouped enemies');
  const defenseReplay = replay(fort({knight: 2}), null, {footman: 12}, ground.drops, ground.t);
  assert.deepEqual(defenseReplay.result(), ground.result(), 'defense replay is deterministic');
  assert.deepEqual(defenseReplay.defenders.map(h => [h.hp, h.x, h.y]), ground.defenders.map(h => [h.hp, h.x, h.y]));
  const dueState = state(4); dueState.born = at - 72 * F.HOUR; dueState.lr = at - 48 * F.HOUR;
  dueState.hr = {knight: 4, wizard: 2};
  assert(raidsDue(dueState, at).length > 0);
  const raids = defend(dueState, at);
  assert(raids.length && raids.every(r => r.hr.knight === 4 && r.hr.wizard === 2), 'automatic raids include defense roster snapshots');
  assert.deepEqual(dueState.hr, {knight: 4, wizard: 2}, 'defense never consumes heroes');
  console.log('PASS: real ground/air defense, targetable heroes, splash damage and deterministic defense');

  const unknown = makeBattle(fort(), null, {bad: 1, footman: NaN, hero_knight: 10}, {heroes: {knight: 100, wizard: '3'}});
  assert.deepEqual(unknown.left, {});
  assert.equal(unknown.deploy('hero_knight', 1, 1), null);
  for (const owner of [false, undefined]) {
    globalThis.__keepHeroOwner = owner;
    const before = JSON.stringify(s);
    assert.equal(F.recruitHero(s, 'knight'), false);
    assert.equal(F.upgradeHero(s, 'wizard'), false);
    assert.equal(JSON.stringify(s), before);
    assert.deepEqual(F.heroLevels(s), {});
    const B = makeBattle(fort(s.hr), null, {footman: 1}, {heroes: savedHeroes});
    assert.equal(B.defenders.length, 0);
    assert.equal(B.deploy('hero_knight', 1, 1), null);
    assert(B.deploy('footman', 1, 1));
  }
  console.log('PASS: member/guest commands and battles exclude owner-only heroes');
  delete globalThis.__keepHeroOwner;
})().catch(error => { console.error(error); process.exitCode = 1; });
