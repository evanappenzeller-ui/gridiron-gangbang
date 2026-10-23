// The Dragon Hero (the owner, Oct 22 2026: "The dragon should be used as a hero in place of the wizzard. the dragon is
// unlocked through the hatchery and gets stronger with each upgrade to the hatchery"). Isolated core checks: no browser,
// storage, timers, network or Firebase writes.
// Run: node tools/realm/check-dragon-hero.cjs
// - his level is the Dragon Hatchery's, 1–10, stronger every level; no Gold; nothing saved forges him
// - the hatchery from Castle 4 (one), its costs and Castle levels
// - trained dragons and the Wizard Hero retired: refunded once
// - the computer's raids from Castle 7 bring its Dragon Hero, never a trained dragon; the example raids' ladder
// - every replay recorded before (js/core/checks-realm.js RP_FIXTURE_V2, made by main 6ae4ae3) plays exactly as recorded
// - balance on the real battle engine (attacks on the computer's realms): printed, and one Dragon Hero alone never
//   takes a computer realm of his Castle's level
// - off the owner's phone: no Dragon Hero anywhere
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const uri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const realmUri = uri(fs.readFileSync(path.join(root, 'js/core/realm.js'), 'utf8')
  .replace("import * as daily from './daily.js';", 'const daily = {LB: {}};')
  .replace("import * as data from './data.js';", 'const data = {isOwner: () => globalThis.__dragonOwner === true, me: () => globalThis.__dragonSelected === false ? null : globalThis.__dragonOwner ? "evan" : "ben", guest: () => null, user: () => null};'));
const battleUri = uri(fs.readFileSync(path.join(root, 'js/core/realm-battle.js'), 'utf8').replace("from './realm.js'", 'from ' + JSON.stringify(realmUri)));
const fixture = (() => {
  const m = /^const RP_FIXTURE_V2 = (\{.*\});\r?$/m.exec(fs.readFileSync(path.join(root, 'js/core/checks-realm.js'), 'utf8'));
  assert(m, 'the replay fixture is in js/core/checks-realm.js');
  return JSON.parse(m[1]);
})();

(async () => {
  globalThis.__dragonOwner = true;
  const F = await import(realmUri), B = await import(battleUri);
  const T0 = Date.UTC(2026, 9, 22, 12), DAY = 24 * F.HOUR;
  const realm = (th, hatch = null, extra = {}) => {
    const s = F.fresh(T0 - 3 * DAY); s.b[0].l = th;
    if (hatch != null) { const p = F.spotFor(s, 'hatchery'); s.b.push(Object.assign({i: s.nb++, t: 'hatchery', l: hatch, x: p.x, y: p.y, u: 0}, extra)); }
    return s;
  };

  // ---- the hero
  assert.deepEqual(F.HERO_ORDER, ['knight', 'dragon']);
  assert.equal(F.HEROES.dragon.troop, 'hero_dragon');
  assert(!F.HEROES.wizard, 'the Wizard Hero is gone');
  assert.equal(F.heroLevel(realm(4), 'dragon'), 0, 'no hatchery, no Dragon Hero');
  assert.equal(F.heroLevel(realm(4, 0, {u: T0 + F.HOUR}), 'dragon'), 0, 'not while the first hatchery is going up');
  for (let l = 1; l <= 10; l++) assert.equal(F.heroLevel(realm(8, l), 'dragon'), l, 'his level is the hatchery’s');
  assert.equal(F.heroLevel(realm(8, 4, {u: T0 + F.HOUR}), 'dragon'), 4, 'a hatchery being upgraded counts at the level it has');
  const st = Array.from({length: 10}, (_, i) => F.heroStat('dragon', i + 1));
  st.forEach((x, i) => {
    assert(x.fly && x.air && x.aim === 'any' && x.splash > 0 && x.room === 0);
    if (i) assert(x.hp > st[i - 1].hp && x.dps > st[i - 1].dps && x.range >= st[i - 1].range && x.splash >= st[i - 1].splash, 'strictly stronger every level');
  });
  const wiz = [1, 2].map(l => F.heroStat('wizard', l, 1));
  assert(st[0].hp > wiz[1].hp && st[0].dps > wiz[1].dps && st[0].dps < wiz[1].dps * 1.25, 'level 1 a little stronger than the Wizard Hero was at 2');
  assert(st[9].hp > F.TROOPS.dragon.hp * 2 && st[9].dps > F.TROOPS.dragon.dps * 2, 'level 10 well past a trained dragon');
  for (const bad of [0, 11, 1.5, '3', null]) assert.equal(F.heroStat('dragon', bad), null);
  // (no Gold)
  const rich = realm(8, 3); rich.r = {gold: 1e6, grain: 1e6};
  const snap = JSON.stringify(rich);
  for (const fn of [F.recruitHero, F.upgradeHero]) assert.equal(fn(rich, 'dragon'), false);
  for (const fn of [F.canRecruitHero, F.canUpgradeHero]) { const c = fn(rich, 'dragon'); assert(!c.ok && !c.cost && /Dragon Hatchery/.test(c.why)); }
  assert.equal(JSON.stringify(rich), snap, 'no Gold spent on him');
  // (forging)
  const forged = realm(8); forged.hr = {knight: 3, dragon: 10};
  assert.equal(F.heroLevel(forged, 'dragon'), 0);
  assert.deepEqual(F.heroLevels(forged), {knight: 3});
  const low = realm(8, 2); low.hr = {dragon: 9};
  assert.equal(F.heroLevel(low, 'dragon'), 2, 'hr.dragon can’t raise him');
  assert.deepEqual(F.clean(forged).hr, {knight: 3}, 'clean() drops hr.dragon');
  console.log('PASS: the Dragon Hero hatches with the hatchery, levels with it (L1–10 ' + st.map(x => `${x.hp}/${x.dps}`).join(' ') + '), no Gold, no forging');

  // ---- the hatchery
  assert.deepEqual(F.COUNT.hatchery, [0, 0, 0, 1, 1, 1, 1, 1], 'one from Castle 4');
  assert.deepEqual(F.KINDS.hatchery.th, [4, 4, 5, 5, 6, 6, 7, 7, 8, 8], 'the Wizard Hero’s old caps');
  assert.deepEqual(F.KINDS.hatchery.cost.slice(0, 2), [12000, 25000]);
  assert.deepEqual([4, 5, 6, 7, 8].map(th => F.heroCap(realm(th), 'dragon')), [2, 4, 6, 8, 10]);
  const c3 = realm(3); c3.r.grain = 1e6;
  assert(!F.canBuild(c3, 'hatchery', T0).ok);
  const c4 = realm(4); c4.r.grain = 12000;
  assert(F.canBuild(c4, 'hatchery', T0).ok, 'a Castle 4 realm builds one with 12,000 Ale');
  const hb = F.build(c4, 'hatchery', ...Object.values(F.spotFor(c4, 'hatchery')), T0);
  assert(hb && c4.r.grain === 0 && F.heroLevel(c4, 'dragon') === 0);
  F.tick(c4, T0 + F.KINDS.hatchery.time[0] * 1000);
  assert.equal(F.heroLevel(c4, 'dragon'), 1, 'he hatches when it’s built');
  assert(!F.canBuild(c4, 'hatchery', T0 + DAY).ok, 'only one');
  console.log('PASS: the hatchery from Castle 4, 12,000 then 25,000 Ale, levels by Castle 4/5/6/7/8 to 2/4/6/8/10');

  // ---- retired: trained dragons and the Wizard Hero, refunded once
  const old = realm(8, 2);
  Object.assign(old, {ar: {footman: 3, dragon: 2, kicker: 1}, q: [['kicker', 1], ['dragon', 2], ['archer', 1]], qs: T0 - 1000, hr: {knight: 4, wizard: 6}});
  old.b.push({i: old.nb++, t: 'barracks', l: 8, x: 3, y: 3, u: 0}, {i: old.nb++, t: 'camp', l: 6, x: 3, y: 9, u: 0});
  const once = F.clean(old), twice = F.clean(once);
  assert.equal(once.xo.grain, old.xo.grain + 6 * 3000, 'trained and queued dragons (kickers too) refunded 3,000 Ale each');
  assert.equal(once.xo.gold, old.xo.gold + [8000, 10000, 16000, 24000, 36000, 52000].reduce((a, b) => a + b), 'the Wizard’s Gold for levels 1–6');
  assert.deepEqual(once.ar, {footman: 3});
  assert.deepEqual(once.q, [['archer', 1]]);
  assert.equal(once.qs, 0, 'the line starts afresh when its head was a dragon');
  assert.deepEqual(once.hr, {knight: 4});
  assert.deepEqual(twice, once, 'once only');
  const s5 = realm(5); s5.hr = {wizard: 10};
  assert.equal(F.clean(s5).xo.gold, s5.xo.gold + 8000 + 10000 + 16000 + 24000, 'a Wizard is refunded the level his Castle let him have');
  for (const t of ['dragon', 'kicker']) {
    const s = realm(8, 3); s.b.push({i: s.nb++, t: 'barracks', l: 8, x: 3, y: 3, u: 0}, {i: s.nb++, t: 'camp', l: 6, x: 3, y: 9, u: 0}); s.r.grain = 1e5;
    const before = JSON.stringify(s);
    assert(!F.canTrain(s, t).ok); assert.equal(F.train(s, t), false); assert.equal(F.untrain(s, t), false);
    assert.equal(JSON.stringify(s), before);
  }
  console.log('PASS: trained dragons (ready, training, kickers) and the Wizard Hero refunded once; dragons can’t be trained');

  // ---- the computer's raids
  for (let th = 1; th <= 8; th++) {
    const a = B.raidArmy(th), h = B.raidHeroes(th);
    assert(!('dragon' in a));
    assert.equal(F.roomOf(a), 10 + th * 5);
    if (th >= 7) assert.equal(h.dragon, F.botDragon(th - 1)); else assert.deepEqual(h, {});
  }
  const d7 = realm(7, 4); d7.hr = {knight: 5}; d7.r = {gold: 9000, grain: 9000};
  const done = B.defend(d7, T0);
  assert(done.length >= 1);
  done.forEach(r => {
    const P = F.decodeReplay(r.rp, d7);
    assert(P && P.hr.dragon === B.raidHeroes(7).dragon && P.dh.dragon === 4 && P.dh.knight === 5 && !P.army.dragon);
    assert(P.drops.some(d => d[1] === 'hero_dragon') && !P.drops.some(d => d[1] === 'dragon'));
    const R = B.replayBattle(P); R.play(Infinity);
    assert(R.stars() === r.st && R.pct() === r.pc, 'a raid with the computer’s Dragon Hero replays the same');
  });
  console.log('PASS: the computer raids from Castle 7 with its Dragon Hero (L' + B.raidHeroes(7).dragon + ', L' + B.raidHeroes(8).dragon + ' at 8), no trained dragons, armies fill their room; ' + done.map(r => `${r.st}★ ${r.pc}%`).join(', '));

  // ---- the example raids: a Castle 4 realm (the computer's Castle 4 lot as his), Castle 8 test realms, and full Castle 7
  // and 8 lots (the computer's) with his Knight and Dragon Hero as high as they go there (Oct 23 2026: these had only
  // raids driven off, the biggest army 190 troops)
  const lotOf = (th, max) => {
    const s = F.fresh(T0 - 3 * DAY), b = F.botBase(th); s.b = b.b.map(x => Object.assign({}, x, F.KINDS[x.t].role === 'make' ? {c: T0 - 6 * F.HOUR} : {})); s.nb = Math.max(...s.b.map(x => x.i)) + 1; s.r = {gold: 30000, grain: 20000}; s.hr = {knight: Math.min(10, th)};
    if (max) { s.b.filter(x => x.t === 'hatchery').forEach(x => { x.l = F.topLevel('hatchery', th); }); s.hr.knight = F.heroCap(s, 'knight'); }
    return s;
  };
  const exOn = {'Castle 4 (its computer lot)': lotOf(4), 'Castle 4 (new)': realm(4, 2), 'Castle 8 test realm (new)': realm(8), 'Castle 8 test realm with a hatchery': realm(8, 10),
    'Castle 7 (its computer lot, Knight and Dragon Hero at the top)': lotOf(7, true), 'Castle 8 (its computer lot, Knight and Dragon Hero at 10)': lotOf(8, true)};
  for (const [name, s] of Object.entries(exOn)) {
    const t0 = Date.now(), ex = B.exampleRaids(s, T0);
    const rows = ex.map(r => ({r, P: F.decodeReplay(r.rp, s)}));
    console.log(`  examples, ${name} (defending: ${JSON.stringify(F.heroLevels(s))}): ${rows.map(({r, P}) => `${r.st}★ ${r.pc}% (${Object.entries(P.army).map(([t, n]) => `${t} ${n}`).join(', ')}${P.hr.dragon ? `, Dragon Hero ${P.hr.dragon}` : ''})`).join(' · ')} in ${Date.now() - t0} ms`);
    assert.equal(ex.map(r => r.st).join(), '0,1,3', name + ': a raid driven off, one taking a star, one breaking through');
    assert(rows.every(({P}) => P && !P.army.dragon), 'no trained dragons');
  }
  console.log('PASS: the example raids still find 0, 1 and 3 stars on Castle 4 and Castle 8 test realms and full Castle 7 and 8 lots, without trained dragons');

  // ---- every replay recorded before plays exactly as recorded
  assert.equal(F.battleMark(1), fixture.mark, 'the old rules’ mark is the one they were recorded under');
  assert.notEqual(F.battleMark(), fixture.mark);
  const lots = {lots: fixture.lots};
  for (const r of fixture.recs) {
    const P = F.decodeReplay(r.rp, lots);
    assert(P && P.rules === 1, r.n + ' reads under the old rules');
    const R = B.replay(P.base, P.loot, P.army, P.drops, Infinity, P.opts), x = R.result();
    const S = B.replayBattle(P);
    for (let t = 0, g = 0; !S.over && g < 8000; g++) { t += .05 + (g % 3) * .01; S.play(t); }
    for (const [how, Q] of [['all at once', R], ['frame by frame', S]]) {
      assert.deepEqual([Q.stars(), Q.pct(), Q.got.gold, Q.got.grain, Q.step, Q.why], [r.st, r.pc, r.got[0], r.got[1], r.step, r.why], `${r.n} (${how}) plays as recorded`);
    }
    assert.deepEqual(x.used, r.used); assert.deepEqual(x.heroes, r.hr);
  }
  console.log(`PASS: ${fixture.recs.length} replays recorded before the Dragon Hero (wizards and trained dragons among them) play exactly as recorded`);

  // ---- balance: the real engine, attacks on the computer's realms (the best of four sides)
  const attack = (th, army, heroes, side, rules) => {
    const T = F.realmOf('bot:' + th, null, T0), A = B.makeBattle(T.base, T.loot, army, {heroes, rules}), box = F.boxOf(T.base);
    const at = (f, o) => side === 0 ? [box.x0 + f * (box.x1 - box.x0), box.y0 - o] : side === 1 ? [box.x1 + o, box.y0 + f * (box.y1 - box.y0)] : side === 2 ? [box.x0 + f * (box.x1 - box.x0), box.y1 + o] : [box.x0 - o, box.y0 + f * (box.y1 - box.y0)];
    const drop = (t, f) => { for (let o = 1.5; o < 6; o++) { const p = at(f, o); if (A.canDrop(p[0], p[1])) { A.deploy(t, p[0], p[1]); return; } } };
    Object.keys(A.heroes).forEach((k, i) => drop(F.rulesOf(rules).hero[k].troop, .45 + i * .1));
    ['dragon', 'knight', 'thief', 'archer', 'footman'].forEach(t => { const n = army[t] || 0; for (let i = 0; i < n; i++) drop(t, .15 + .7 * (i + .5) / n); });
    A.run(F.RAID_S);
    return {st: A.stars(), pc: A.pct()};
  };
  const best = (...a) => [0, 1, 2, 3].map(side => attack(a[0], a[1], a[2], side, a[3])).sort((p, q) => q.st - p.st || q.pc - p.pc)[0];
  const ARMY = {4: {footman: 30, archer: 25, knight: 3}, 5: {footman: 30, archer: 26, knight: 4, thief: 4}, 6: {footman: 50, archer: 45, knight: 6, thief: 4},
    7: {footman: 55, archer: 50, knight: 7, thief: 6}, 8: {footman: 70, archer: 70, knight: 10, thief: 10}};
  const f = r => `${r.st}★ ${r.pc}%`;
  for (const th of [4, 5, 6, 7, 8]) {
    const dl = F.heroCap(realm(th), 'dragon'), kl = F.HEROES.knight.cap[th - 1], wl = [0, 0, 0, 2, 4, 6, 8, 10][th - 1];
    const solo = best(th, {}, {dragon: dl}), army = best(th, ARMY[th], {knight: kl}), both = best(th, ARMY[th], {knight: kl, dragon: dl});
    const wizSolo = best(th, {}, {wizard: wl}, 1), oldDragon = best(th, {dragon: 1}, {}, 1), wizArmy = best(th, ARMY[th], {knight: kl, wizard: wl}, 1);
    console.log(`  Castle ${th} vs the computer’s Castle ${th}: Dragon Hero L${dl} alone ${f(solo)}; army + Knight L${kl} ${f(army)}, with the Dragon ${f(both)} | before: Wizard L${wl} alone ${f(wizSolo)}, a trained dragon alone ${f(oldDragon)}, army + Knight + Wizard ${f(wizArmy)}`);
    assert(solo.st === 0 && solo.pc < 50, `one Dragon Hero alone doesn't take a Castle ${th} computer realm`);
    assert(both.pc >= army.pc, 'he adds to an army');
  }
  console.log('PASS: balance on the real battle engine');

  // ---- off the owner's phone
  globalThis.__dragonOwner = false;
  assert.deepEqual(F.heroLevels(realm(8, 6)), {dragon: 6}, 'Another selected player has the Dragon Hero');
  globalThis.__dragonSelected = false;
  const s = realm(8, 6);
  assert.deepEqual(F.heroLevels(s), {});
  assert.deepEqual(F.heroArmy(s), {});
  const M = B.makeBattle(s, null, {footman: 1}, {heroes: {dragon: 6}});
  assert.equal(M.defenders.length, 0); assert.equal(M.deploy('hero_dragon', 1, 1), null);
  assert.deepEqual(B.exampleRaids(realm(8, 6), T0), []);
  assert.equal(await F.flush(), false);
  console.log('PASS: without a selected profile, no Dragon Hero, no example raids, no save');
  delete globalThis.__dragonOwner; delete globalThis.__dragonSelected;
})().catch(error => { console.error(error); process.exitCode = 1; });
