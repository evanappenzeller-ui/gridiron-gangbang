// Isolated retirement checks: no browser, storage, timers or remote writes.
// Run: node tools/realm/check-sappers.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const uri = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const realmUri = uri(fs.readFileSync(path.join(root, 'js/core/realm.js'), 'utf8')
  .replace("import * as daily from './daily.js';", 'const daily = {};')
  .replace("import * as data from './data.js';", 'const data = {isOwner: () => globalThis.__sapperOwner === true};'));
const battleUri = uri(fs.readFileSync(path.join(root, 'js/core/realm-battle.js'), 'utf8')
  .replace("from './realm.js'", 'from ' + JSON.stringify(realmUri)));

(async () => {
  globalThis.__sapperOwner = true;
  const F = await import(realmUri), B = await import(battleUri);
  const now = Date.UTC(2026, 9, 22, 12);
  const state = () => {
    const s = F.fresh(now); s.b[0].l = 8;
    s.b.push({i: 6, t: 'barracks', l: 6, x: 5, y: 5, u: 0}, {i: 7, t: 'camp', l: 1, x: 10, y: 5, u: 0});
    s.r.grain = 10000;
    return s;
  };
  assert.deepEqual(F.TROOP_ORDER, ['footman', 'archer', 'knight', 'thief'], 'the trained Dragon is retired too (Oct 22 2026: tools/realm/check-dragon-hero.cjs)');
  const saved = state();
  saved.ar = {footman: 2, sapper: 3, fullback: 2};
  saved.q = [['sapper', 2], ['fullback', 1], ['archer', 2]]; saved.qs = now - 5000;
  const before = JSON.stringify(saved), clean = F.clean(saved);
  assert.deepEqual(clean.ar, {footman: 2});
  assert.deepEqual(clean.q, [['archer', 2]]);
  assert.equal(clean.qs, 0, 'removing the head starts remaining training afresh');
  assert.equal(clean.xo.grain, saved.xo.grain + 8 * 600, 'all retired units refund once, including mixed aliases');
  assert.deepEqual(clean.r, saved.r, 'refund cannot overfill storage');
  assert.deepEqual(F.clean(clean), clean, 'migration is idempotent');
  assert.equal(JSON.stringify(saved), before, 'clean does not mutate source saves');
  F.tick(clean, now);
  F.tick(clean, now + 6000);
  assert.equal(clean.ar.archer, 1, 'remaining troops still complete training');

  const later = state(); later.q = [['archer', 2], ['sapper', 1], ['footman', 1]]; later.qs = now - 3000;
  const next = F.clean(later);
  assert.equal(next.qs, later.qs, 'removing a later group preserves current progress');
  F.tick(next, now + 3000);
  assert.equal(next.ar.archer, 1);
  const only = state(); only.q = [['sapper', 3]]; only.qs = now;
  assert.equal(F.clean(only).qs, 0);
  assert.deepEqual(F.clean(only).q, []);
  const old = state(); old.v = 1; old.ar = {receiver: 4, fullback: 2}; old.q = [['fullback', 1], ['qb', 2]];
  const migrated = F.clean(old);
  assert.deepEqual(migrated.ar, {footman: 4});
  assert.deepEqual(migrated.q, [['archer', 2]]);
  assert.equal(migrated.xo.grain, old.xo.grain + 1800);
  for (const retired of ['sapper', 'fullback']) {
    const s = state(), snapshot = JSON.stringify(s);
    assert.equal(F.canTrain(s, retired).ok, false);
    assert.equal(F.train(s, retired), false);
    assert.equal(F.untrain(s, retired), false);
    assert.equal(JSON.stringify(s), snapshot, 'retired requests cannot spend resources');
  }
  for (let th = 1; th <= F.MAX_KEEP; th++) {
    const army = B.raidArmy(th);
    assert(!('sapper' in army));
    assert.equal(F.roomOf(army), 10 + th * 5, 'computer army still fills its allotted space');
  }
  const battle = B.makeBattle(F.botBase(1), null, {sapper: 2, footman: 1});
  assert(!('sapper' in battle.left), 'stale battle armies cannot retain retired troops');
  assert.equal(battle.deploy('sapper', 0, 0), null);
  assert(battle.deploy('footman', 0, 0));
  battle.run(Infinity);
  assert(!battle.tr.some(t => t.t === 'sapper'));
  assert.equal(F.mayPlay(), true);
  globalThis.__sapperOwner = false;
  assert.equal(F.mayPlay(), false, 'The Keep remains unavailable outside the owner profile');
  assert.equal(await F.flush(), false);
  console.log('PASS: sapper retirement, legacy saves, refunds, queue progress, training rejection, computer armies, combat and owner access');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
