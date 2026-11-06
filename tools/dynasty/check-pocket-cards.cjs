// Catalog invariants for the new rules only; no app/browser or collection mutation.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const code = fs.readFileSync(path.join(__dirname, '../../js/core/dynasty-pocket-cards.js'), 'utf8');
  const C = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const fixtures = [
    {id: 'owned-a', name: 'Patrick Mahomes', pos: 'QB', p: 'mahomes', r: 'common', o: 50, team: 'KC'},
    {id: 'owned-a-art', name: 'Patrick Mahomes', pos: 'QB', p: 'mahomes', r: 'mythic', o: 99, team: 'KC'},
    {id: 'owned-b', name: 'Justin Jefferson', pos: 'WR', p: 'jefferson', r: 'epic', o: 80, team: 'MIN'},
    {id: 'owned-c', name: 'Test Athlete', pos: 'RB', p: 'test', r: 'common', o: 55, team: 'X'}
  ];
  const pristine = JSON.stringify(fixtures);
  C.setCards(fixtures);
  assert.equal(JSON.stringify(fixtures), pristine, 'catalog does not mutate collection records');
  const starter = C.rentalDeck();
  assert.equal(starter.ids.length, 20);
  assert(C.checkDeck(starter.ids, null, starter.energy).ok);
  assert(C.isRentalDeck([...starter.ids].reverse(), starter.energy));
  assert(!C.isRentalDeck(starter.ids, ['Water']));
  assert(!C.isRentalDeck([...starter.ids.slice(1), 'R7-henry'], starter.energy));
  assert(!C.checkDeck(starter.ids, {}, starter.energy).ok, 'rentals need an explicit rental selection');
  assert.equal(C.card('R7-jefferson').hp, 120);
  assert.equal(C.card('R7-henry').attacks[0].damage, 100);
  assert.equal(C.pointValue(C.card('R7-mahomes-ex')), 2);
  assert.equal(C.pointValue(C.card('R7-mahomes-mega')), 3);
  assert.equal(C.card('R7-mahomes-mega').stage, 'Base', 'classification does not determine development stage');
  const mechanics = c => ({hp:c.hp,attacks:c.attacks,types:c.types,weakness:c.weakness,retreat:c.retreat,stage:c.stage,classification:c.classification});
  assert.deepEqual(mechanics(C.card('owned-a')), mechanics(C.card('owned-a-art')), 'alternate art/OVR never changes battle strength');
  const before = mechanics(C.card('owned-c'));
  C.setCards(fixtures.map(c => c.id === 'owned-c' ? {...c, r:'mythic', o:99, pos:'QB', team:'Y'} : c));
  assert.deepEqual(mechanics(C.card('owned-c')), before, 'position/team/OVR do not create hidden battle attributes');
  const owned = {'owned-a': 2, 'owned-b': 2};
  const deck = C.defaultDeck(owned);
  assert.equal(deck.rental, false);
  assert(C.checkDeck(deck.ids, owned, deck.energy).ok);
  const counts = deck.ids.reduce((o,id) => (o[id]=(o[id]||0)+1,o),{});
  assert.equal(counts['owned-a'], 2);
  assert.equal(counts['owned-a~breakout'], 2);
  assert.equal(counts['owned-a~prime'], 2);
  assert.equal(C.card('owned-a~prime').predecessor, 'owned-a~breakout');
  assert.equal(C.card('owned-a~breakout').predecessor, 'owned-a');
  assert.equal(C.availableCopies({'owned-a':1}, 'owned-a'), 1);
  assert.equal(C.availableCopies({'owned-a':1}, 'owned-a~prime'), 2);
  assert.equal(C.availableCopies({}, 'owned-a~prime'), 0);
  assert.equal(C.availableCopies({}, 'P7-gear'), 2);
  assert.equal(C.availableCopies({}, 'R7-mahomes'), 0);
  assert(C.defaultDeck({}).rental);
  assert(C.checkDeck(C.defaultDeck({'owned-a':2}).ids, {'owned-a':2}, ['Fire']).ok);
  const over = [...deck.ids]; over[over.indexOf('P7-film')] = 'owned-a-art';
  assert.match(C.checkDeck(over).why, /At most two/);
  assert(!C.checkDeck(deck.ids.slice(1)).ok);
  assert(!C.checkDeck([...deck.ids, 'P7-ground']).ok);
  assert(!C.checkDeck(deck.ids, null, ['Colorless']).ok);
  assert(!C.checkDeck(deck.ids, null, []).ok);
  assert(!C.checkDeck(deck.ids, null, ['Fire','Water','Grass','Metal']).ok);
  assert(!C.checkDeck(deck.ids, null, ['Fire','Fire']).ok);
  assert(C.checkDeck(deck.ids, null, ['Fire','Water','Grass']).ok);
  const noBase = [...C.SUPPORTS.flatMap(c => [c.id,c.id]), 'owned-a~breakout','owned-a~breakout',
    'owned-a~prime','owned-a~prime','owned-b~prime','owned-b~prime'];
  assert.match(C.checkDeck(noBase).why, /at least one Base/);
  for (let level=1; level<=30; level++) {
    const cpu = C.cpuDeck(level);
    assert(C.checkDeck(cpu.ids, null, cpu.energy).ok, `CPU level ${level}`);
  }
  const boss = C.cpuDeck(5, 'owned-a');
  assert.equal(boss.ids.filter(id => id === 'owned-a').length, 2);
  assert(C.checkDeck(boss.ids, null, boss.energy).ok);
  const effects = C.SUPPORTS.map(c=>c.effect.type);
  assert.deepEqual(effects, ['draw','search-base','heal','fast-track','max-hp','matchup-change','base-max-hp']);
  assert(C.card('P7-matchup').text.includes('opponent chooses'));
  assert(C.card('P7-scout').text.includes('random'));
  console.log('PASS Pocket catalog: legal decks, canonical copies, independent metadata, rental ownership and CPU recipes.');
})().catch(e => { console.error(e); process.exitCode = 1; });
