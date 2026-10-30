// Pure deck-builder checks with the real catalog and battle rules; no browser, saves or remote writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');

(async () => {
  const B = await import(pathToFileURL(path.join(root, 'js/core/dynasty-battle.js')));
  const source = fs.readFileSync(path.join(root, 'js/core/dynasty.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  const box = vm.createContext({B, REAL: {}});
  vm.runInContext(source + '\nthis.api = {setData, strategyDeck, STRATEGIES, card, fresh, get cards() { return CARDS; }};', box);
  const D = box.api;
  D.setData(JSON.parse(fs.readFileSync(path.join(root, 'data/dynasty.json'), 'utf8')));
  const owned = Object.fromEntries([...D.cards.map(c => c.id), ...Object.keys(B.TRAINERS)].map(id => [id, 2]));
  const before = JSON.stringify(owned);
  for (const [id, type] of [['air', 'A'], ['ground', 'G']]) {
    const built = D.strategyDeck(id, owned);
    assert.equal(built.ok, true, `${id}: full collection produces a legal deck`);
    assert.equal(built.ids.length, 20);
    assert.equal(B.checkDeck(built.ids, owned).ok, true);
    assert.equal(B.deckTypes(built.ids).length, 1, `${id}: one consistent energy supply`);
    const playerIds = built.ids.filter(cid => D.card(cid));
    assert.ok(playerIds.length >= 10 && playerIds.length <= 12);
    assert.ok(playerIds.every(cid => B.stats(cid).type === type));
    assert.ok(built.ids.some(cid => B.TRAINERS[cid]?.kind === 'item'), `${id}: usable item support`);
    assert.ok(built.ids.some(cid => B.TRAINERS[cid]?.kind === 'coach'), `${id}: usable coach support`);
    for (const cid of playerIds) if (!B.isBasic(cid)) {
      assert.ok(playerIds.some(base => B.isBasic(base) && B.stats(base).from === B.stats(cid).from), `${id}: ${cid} has its Basic`);
    }
    assert.equal(JSON.stringify(D.strategyDeck(id, owned).ids), JSON.stringify(built.ids), 'deterministic selection');
    const thin = Object.fromEntries(built.ids.map(cid => [cid, 1]));
    const thinBuilt = D.strategyDeck(id, thin);
    const used = {};
    thinBuilt.ids.forEach(cid => { used[cid] = (used[cid] || 0) + 1; });
    assert.ok(Object.entries(used).every(([cid, count]) => count <= thin[cid]), 'never invents a second owned copy');
    const orphans = Object.fromEntries(D.cards.filter(c => !B.isBasic(c.id)).map(c => [c.id, 2]));
    Object.assign(orphans, Object.fromEntries(Object.keys(B.TRAINERS).map(cid => [cid, 2])));
    assert.equal(D.strategyDeck(id, orphans).ok, false, 'evolutions alone cannot create a deck');
    assert.equal(D.strategyDeck(id, {}).ok, false, 'empty collection remains unavailable');
    assert.equal(D.strategyDeck(id, D.fresh().o).ok, false, 'unopened starter never gains players');
    console.log(`PASS: ${id} legal owned-only deck, coherent energy, support, evolution bases and repeatability`);
  }
  assert.equal(JSON.stringify(owned), before, 'building does not mutate collection');
  assert.equal(D.strategyDeck('unknown', owned).ok, false);
  console.log('PASS: no cards granted, no collection mutations, unavailable reasons');
})().catch(e => { console.error(e); process.exitCode = 1; });
