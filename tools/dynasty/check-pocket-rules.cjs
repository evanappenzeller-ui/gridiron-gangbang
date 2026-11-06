// v7 source-of-truth regressions. Run: node tools/dynasty/check-pocket-rules.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
const clone = value => JSON.parse(JSON.stringify(value));
(async () => {
  const C = await import(pathToFileURL(path.join(root, 'js/core/dynasty-pocket-cards.js')));
  const B = await import(pathToFileURL(path.join(root, 'js/core/dynasty-pocket.js')));
  const deck = C.rentalDeck(), decks = [deck.ids, deck.ids], options = {energy: [deck.energy, deck.energy], first: 0};
  const fixtureCards = new Map(C.allCards().map(c => [c.id, clone(c)]));
  const add = (id, data = {}) => {
    const c = {id, kind: 'player', name: id, canonicalName: id, stage: 'Base', classification: 'regular', predecessor: null,
      hp: 100, type: 'Fire', types: ['Fire'], weakness: null, retreat: 1, attacks: [{name: 'Play', cost: [], damage: 30}], ...data};
    fixtureCards.set(id, c); return c;
  };
  add('zero'); add('ex', {classification: 'ex'}); add('mega', {classification: 'mega-ex'});
  add('breakout', {stage: 'Breakout', predecessor: 'zero', hp: 140}); add('prime', {stage: 'Prime', predecessor: 'breakout', hp: 180});
  add('weak', {weakness: 'Fire'}); add('sleep-hit', {attacks: [{name: 'Sleep play', cost: [], damage: 0, effect: {type: 'condition', condition: 'Asleep'}}]});
  add('paralysis-hit', {attacks: [{name: 'Paralysis play', cost: [], damage: 0, effect: {type: 'condition', condition: 'Paralyzed'}}]});
  add('bench-hit', {attacks: [{name: 'Bench play', cost: [], damage: 30, target: 'bench'}]});
  add('shield-hit', {attacks: [{name: 'Protection Call', cost: [], damage: 30, effect: {type: 'shield', amount: 20}}]});
  add('no-bonus', {attacks: [{name: 'Study', cost: [], damage: 0, effect: {type: 'draw', count: 1}}]});
  add('stadium-two', {kind: 'stadium', name: 'New Field', canonicalName: 'New Field', effect: {type: 'base-max-hp', amount: 0}});
  add('draw-ability', {ability: {name: 'Film Room', effect: {type: 'draw', count: 1}, oncePerTurn: true}});
  add('art-zero', {canonicalName: 'zero'});
  const src = fs.readFileSync(path.join(root, 'js/core/dynasty-pocket.js'), 'utf8').replace(/^import .*;$/gm, '').replace(/^export /gm, '');
  const F = new Function('C', src + '\nreturn {newGame,check,apply,replay,nextMove,legalActions,hpOf,canPay,checkDeck,attackPreview,toMove};')({card: id => fixtureCards.get(id) || null});
  const fresh = seed => F.newGame(seed || 'rules', decks, options);
  const sl = (id, u) => ({u, id, dmg: 0, en: [], stack: [], tool: null, conditions: {}, entered: 0, developed: -1, abilityTurn: -1});
  const board = (attacker = 'zero', defender = 'zero') => {
    const G = fresh(); G.phase = 'play'; G.turn = 5; G.who = 0; G.uid = 4;
    G.p.forEach((p, i) => { p.ready = p.set = true; p.turns = 3; p.used = {}; p.en = 'Fire'; p.hand = []; p.active = sl(i ? defender : attacker, i + 1); p.bench = [sl('zero', i + 3)]; });
    return G;
  };
  const play = (G, who, m) => assert.equal(F.apply(G, who, m).ok, true, JSON.stringify(m));
  const denied = (G, who, m) => { const before = clone(G); assert.equal(F.apply(G, who, m).ok, false, JSON.stringify(m)); assert.deepEqual(G, before, 'invalid action changes no state or RNG'); };
  // Deck identity and energy requirements are independent of rarity, position and athlete.
  assert.equal(B.checkDeck(deck.ids, deck.energy).ok, true);
  assert.equal(B.checkDeck(deck.ids.slice(1)).ok, false);
  assert.equal(B.checkDeck(deck.ids, ['Colorless']).ok, false);
  assert.equal(B.checkDeck(deck.ids, ['Fire', 'Fire']).ok, false);
  assert.equal(F.checkDeck(['zero', 'art-zero', 'zero', ...deck.ids.slice(3)]).ok, false);
  assert.equal(B.canPay(['Fire', 'Fire', 'Colorless'], ['Fire', 'Fire', 'Water']), true);
  assert.equal(B.canPay(['Fire', 'Fire', 'Colorless'], ['Fire', 'Water', 'Water']), false);
  assert.equal(B.canPay(['Fire', 'Fire', 'Colorless'], ['Fire', 'Fire']), false);
  assert.equal(B.canPay([], []), true);
  for (let i = 0; i < 30; i++) {
    const G = B.newGame('opening-' + i, decks, options);
    G.p.forEach(p => { assert.equal(p.hand.length, 5); assert.equal(p.deck.length, 15); assert.ok(p.hand.some(id => C.card(id).stage === 'Base')); });
  }
  {
    const G = fresh(); G.p[0].hand = ['zero', 'breakout', 'P7-film', 'zero', 'zero'];
    denied(G, 0, {a: 'setup', act: 'breakout', bench: []});
    play(G, 0, {a: 'setup', act: 'zero', bench: ['zero']});
    const basic = G.p[1].hand.find(id => C.card(id).stage === 'Base'); play(G, 1, {a: 'setup', act: basic, bench: []});
    assert.equal(G.p[0].turns, 1); assert.equal(G.p[0].en, null); assert.equal(G.p[1].en, null);
    play(G, 0, {a: 'support', id: 'P7-film'});
    denied(G, 0, {a: 'evolve', id: 'breakout', on: G.p[0].active.u});
    denied(G, 0, {a: 'energy', on: G.p[0].active.u});
    play(G, 0, {a: 'attack', n: 0}); // No blanket first-turn attack ban.
    assert.equal(G.who, 1); assert.equal(G.p[1].en, 'Fire');
  }
  {
    const G = board(); const active = G.p[0].active, bench = G.p[0].bench[0];
    play(G, 0, {a: 'energy', on: bench.u}); assert.equal(active.en.length, 0); assert.deepEqual(bench.en, ['Fire']);
    denied(G, 0, {a: 'energy', on: active.u}); active.en = ['Fire', 'Water'];
    play(G, 0, {a: 'attack', n: 0}); assert.deepEqual(active.en, ['Fire', 'Water']); denied(G, 0, {a: 'end'});
    assert.equal(G.p[1].active.dmg, 30);
  }
  {
    const G = board(); const p = G.p[0], s = p.active; s.dmg = 30; s.en = ['Fire']; s.tool = 'P7-gear'; s.conditions = {poisoned: true, asleep: true}; p.hand = ['breakout', 'prime'];
    play(G, 0, {a: 'evolve', id: 'breakout', on: s.u}); assert.equal(s.dmg, 30); assert.deepEqual(s.en, ['Fire']); assert.equal(s.tool, 'P7-gear'); assert.deepEqual(s.conditions, {}); assert.equal(F.hpOf(G, s) - s.dmg, 130);
    denied(G, 0, {a: 'evolve', id: 'prime', on: s.u}); assert.deepEqual(s.stack, ['zero']);
    p.turns++; play(G, 0, {a: 'evolve', id: 'prime', on: s.u}); assert.equal(s.dmg, 30); assert.deepEqual(s.stack, ['zero', 'breakout']);
  }
  {
    const G = board(); const p = G.p[0], s = p.active; p.hand = ['P7-fast-track', 'prime']; s.entered = p.turns;
    denied(G, 0, {a: 'support', id: 'P7-fast-track', on: s.u, prime: 'prime'}); s.entered--;
    play(G, 0, {a: 'support', id: 'P7-fast-track', on: s.u, prime: 'prime'}); assert.equal(s.id, 'prime'); assert.deepEqual(s.stack, ['zero']);
    assert.ok(p.discard.includes('P7-fast-track')); assert.ok(!p.hand.includes('prime'));
  }
  {
    const G = board(); const p = G.p[0]; p.hand = ['P7-film', 'P7-film', 'P7-recovery', 'P7-recovery', 'P7-gear', 'P7-gear']; p.active.dmg = 50;
    play(G, 0, {a: 'support', id: 'P7-film'}); denied(G, 0, {a: 'support', id: 'P7-film'});
    play(G, 0, {a: 'support', id: 'P7-recovery', on: p.active.u}); play(G, 0, {a: 'support', id: 'P7-recovery', on: p.active.u}); assert.equal(p.active.dmg, 10);
    play(G, 0, {a: 'support', id: 'P7-gear', on: p.active.u}); assert.equal(F.hpOf(G, p.active), 120); denied(G, 0, {a: 'support', id: 'P7-gear', on: p.active.u});
    play(G, 0, {a: 'support', id: 'P7-gear', on: p.bench[0].u});
  }
  {
    const G = board(); G.p[0].hand = ['P7-ground', 'stadium-two']; play(G, 0, {a: 'support', id: 'P7-ground'});
    assert.equal(F.hpOf(G, G.p[0].active), 120); assert.equal(F.hpOf(G, G.p[1].active), 120);
    denied(G, 0, {a: 'support', id: 'stadium-two'});
    G.p[0].used.stadium = false; G.p[1].active.dmg = 110; play(G, 0, {a: 'support', id: 'stadium-two'});
    assert.equal(G.p[0].points, 1); assert.equal(G.p[1].promote, true); assert.equal(G.who, 1); assert.ok(G.p[0].discard.includes('P7-ground'));
    play(G, 1, {a: 'promote', u: G.p[1].bench[0].u}); assert.equal(G.who, 0);
  }
  {
    const G = board(); const p = G.p[0], old = p.active; old.en = ['Fire', 'Water']; old.dmg = 30; old.conditions = {poisoned: true};
    play(G, 0, {a: 'retreat', to: p.bench[0].u, energy: [1]}); assert.equal(old.dmg, 30); assert.deepEqual(old.en, ['Fire']); assert.deepEqual(old.conditions, {}); assert.deepEqual(p.discardedEnergy, ['Water']);
    denied(G, 0, {a: 'retreat', to: old.u}); play(G, 0, {a: 'attack', n: 0});
  }
  {
    const G = board(); G.p[0].hand = ['P7-matchup']; const old = G.p[1].active;
    play(G, 0, {a: 'support', id: 'P7-matchup'}); assert.equal(G.who, 1); assert.equal(G.pending.kind, 'switch'); denied(G, 0, {a: 'choose-switch', u: G.p[1].bench[0].u});
    play(G, 1, {a: 'choose-switch', u: G.p[1].bench[0].u}); assert.equal(G.who, 0); assert.equal(G.p[1].bench[0], old); assert.equal(G.p[1].used.retreat, undefined);
  }
  for (const [id, pts] of [['zero', 1], ['ex', 2], ['mega', 3]]) {
    const G = board('zero', id); G.p[1].active.dmg = 80; const beforeTurn = G.turn;
    play(G, 0, {a: 'attack', n: 0}); assert.equal(G.p[0].points, pts);
    if (pts === 3) { assert.equal(G.phase, 'over'); assert.equal(G.winner, 0); }
    else { assert.equal(G.p[1].promote, true); assert.equal(G.turn, beforeTurn); play(G, 1, {a: 'promote', u: G.p[1].bench[0].u}); assert.equal(G.turn, beforeTurn + 1); }
  }
  {
    const G = board(); G.p[1].active.dmg = 80; G.p[1].bench = []; G.p[1].hand = ['zero']; G.p[1].deck = ['zero'];
    play(G, 0, {a: 'attack', n: 0}); assert.equal(G.phase, 'over'); assert.equal(G.winner, 0); assert.equal(G.p[0].points, 1); assert.deepEqual(G.p[1].hand, ['zero']);
  }
  {
    const G = board(); G.p.forEach(p => { p.deck = []; }); play(G, 0, {a: 'end'}); assert.equal(G.phase, 'play'); assert.equal(G.who, 1);
  }
  {
    const G = board('zero', 'weak'); play(G, 0, {a: 'attack', n: 0}); assert.equal(G.p[1].active.dmg, 50);
    const H = board('bench-hit', 'zero'); H.p[1].bench[0].id = 'weak'; play(H, 0, {a: 'attack', n: 0, target: H.p[1].bench[0].u}); assert.equal(H.p[1].bench[0].dmg, 30);
    const N = board('no-bonus', 'weak'); play(N, 0, {a: 'attack', n: 0}); assert.equal(N.p[1].active.dmg, 0);
  }
  {
    const G = board(); G.p[0].active.conditions = {poisoned: true}; play(G, 0, {a: 'end'}); assert.equal(G.p[0].active.dmg, 10); play(G, 1, {a: 'end'}); assert.equal(G.p[0].active.dmg, 20); assert.equal(G.p[0].active.conditions.poisoned, true);
  }
  {
    const G = board(); G.p[0].active.conditions = {burned: true}; const rn = G.rn; play(G, 0, {a: 'end'}); assert.equal(G.p[0].active.dmg, 20); assert.ok(G.rn > rn); assert.ok(G.events.some(e => e.reason === 'Burn recovery'));
  }
  {
    const G = board(); G.p[0].active.conditions = {asleep: true}; denied(G, 0, {a: 'attack', n: 0}); denied(G, 0, {a: 'retreat', to: G.p[0].bench[0].u});
    play(G, 0, {a: 'end'}); assert.ok(G.events.some(e => e.reason === 'Sleep recovery'));
  }
  {
    const G = board('paralysis-hit'); play(G, 0, {a: 'attack', n: 0}); assert.equal(G.p[1].active.conditions.paralyzed, true); denied(G, 1, {a: 'attack', n: 0});
    play(G, 1, {a: 'end'}); assert.equal(G.p[1].active.conditions.paralyzed, undefined);
  }
  {
    let failed = false, hit = false;
    for (let i = 0; i < 30; i++) {
      const G = board(); G.seed = 'confused-' + i; G.p[0].active.conditions.confused = true; play(G, 0, {a: 'attack', n: 0});
      assert.equal(G.p[0].active.dmg, 0); assert.equal(G.who, 1); failed ||= G.p[1].active.dmg === 0; hit ||= G.p[1].active.dmg === 30;
    }
    assert.ok(failed && hit);
  }
  {
    const G = board('paralysis-hit'); G.p[1].active.conditions = {poisoned: true, burned: true, asleep: true, confused: true};
    play(G, 0, {a: 'attack', n: 0}); assert.equal(G.p[1].active.conditions.poisoned, true); assert.equal(G.p[1].active.conditions.asleep, undefined); assert.equal(G.p[1].active.conditions.confused, undefined); assert.equal(G.p[1].active.conditions.paralyzed, true);
  }
  {
    const G = board(); G.p[0].active.conditions.poisoned = true; G.p[0].active.dmg = 90; play(G, 0, {a: 'end'});
    assert.equal(G.p[1].points, 1); assert.equal(G.who, 0); play(G, 0, {a: 'promote', u: G.p[0].bench[0].u}); assert.equal(G.who, 1);
  }
  {
    const G = board('draw-ability'); const n = G.p[0].hand.length; play(G, 0, {a: 'ability', on: G.p[0].active.u}); assert.equal(G.p[0].hand.length, n + 1); denied(G, 0, {a: 'ability', on: G.p[0].active.u}); play(G, 0, {a: 'attack', n: 0});
  }
  // Exact illustrative duel: existing Energy powers later attacks, Henry is prepared on
  // the Bench, Jefferson trades for one point, Mahomes ex gives the final two.
  {
    const G = board('R7-jefferson', 'R7-lamb'); G.who = 1; G.first = 1; G.turn = 1;
    G.p[0].turns = 0; G.p[1].turns = 1; G.p.forEach(p => { p.deck = []; p.en = null; p.bench = []; });
    G.p[0].bench = [sl('R7-henry', 3)]; G.p[1].bench = [sl('R7-mahomes-ex', 4)];
    play(G, 1, {a: 'end'});
    play(G, 0, {a: 'energy', on: 1}); play(G, 0, {a: 'end'});
    play(G, 1, {a: 'energy', on: 2}); play(G, 1, {a: 'attack', n: 0});
    play(G, 0, {a: 'energy', on: 1}); play(G, 0, {a: 'attack', n: 0});
    play(G, 1, {a: 'energy', on: 4}); play(G, 1, {a: 'attack', n: 0});
    play(G, 0, {a: 'energy', on: 3}); play(G, 0, {a: 'attack', n: 0}); play(G, 1, {a: 'promote', u: 4});
    assert.equal(G.p[0].points, 1);
    play(G, 1, {a: 'energy', on: 4}); play(G, 1, {a: 'attack', n: 0}); play(G, 0, {a: 'promote', u: 3});
    play(G, 0, {a: 'energy', on: 3}); play(G, 0, {a: 'end'});
    play(G, 1, {a: 'attack', n: 0}); play(G, 0, {a: 'energy', on: 3}); play(G, 0, {a: 'attack', n: 0});
    play(G, 1, {a: 'attack', n: 0}); assert.equal(F.hpOf(G, G.p[0].active) - G.p[0].active.dmg, 20);
    play(G, 0, {a: 'attack', n: 0}); assert.equal(G.winner, 0); assert.equal(G.p[0].points, 3); assert.equal(G.p[1].points, 1);
  }
  for (let i = 0; i < 24; i++) {
    const cpu = C.cpuDeck(1 + i), ds = [deck.ids, cpu.ids], opts = {energy: [deck.energy, cpu.energy]};
    const G = B.newGame('simulation-' + i, ds, opts), log = [];
    for (let n = 0; n < 1500 && G.phase !== 'over'; n++) {
      const who = B.toMove(G), move = B.nextMove(G, who, 1 + i); assert.ok(move); assert.equal(B.apply(G, who, move).ok, true); log.push([who, move]);
      G.p.forEach(p => { assert.ok(p.bench.length <= 3); assert.ok(p.points >= 0); });
    }
    assert.equal(G.phase, 'over', `CPU match ${i} terminates`);
    const replay = B.replay(G.seed, ds, log, opts); assert.deepEqual(replay, G, 'saved legal moves reproduce the full state and RNG exactly');
  }
  console.log('PASS v7 rules: decks, setup, Energy, development, support limits, retreat/switch, 1/2/3-point KOs, Checkup, all five conditions, exact teaching duel, and 24 deterministic full matches.');
})().catch(error => { console.error(error); process.exitCode = 1; });
