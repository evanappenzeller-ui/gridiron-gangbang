// Rivals rules: legacy replays, signature costs, honest previews, and saved-version round trips.
// Run: node tools/dynasty/check-rivals-rules.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
const card = (id, pos, attrs, extra = {}) => ({id, p: id, name: id, s: 'L', o: 80, pos, a: attrs, ln: [], ...extra});
const cards = [
  card('pass', 'QB', [70, 99, 70, 70]), card('deep', 'QB', [99, 70, 70, 70]),
  card('read', 'QB', [70, 70, 99, 70]), card('screen', 'RB', [70, 70, 99, 70]),
  card('run', 'RB', [99, 70, 70, 70]), card('finish', 'RB', [70, 70, 70, 99]),
  card('sack', 'DL', [99, 70, 70]), card('stuff', 'DL', [70, 99, 70]),
  card('strip', 'DL', [70, 70, 99]), card('stun', 'LB', [99, 70, 70]),
  card('injure', 'S', [70, 99, 70]), card('shield', 'OL', [99, 70, 70]),
  card('heal', 'OL', [70, 70, 99]), card('kick', 'K', [99, 70, 70]),
  card('general', 'QB', [70, 99, 70, 70], {s: 'A'}),
  card('anchor', 'OL', [99, 70, 70], {s: 'A'}),
  card('counter', 'CB', [99, 70, 70], {s: 'A'}),
  card('juke', 'RB', [99, 70, 70, 70], {s: 'X', name: 'Barry Sanders'})
];
const byId = Object.fromEntries(cards.map(c => [c.id, c]));
const decks = [
  ['pass', 'deep', 'read', 'run', 'juke', 'screen', 'finish', 'general', 'kick', 'pass', 'deep', 'run', 'I-recruit', 'I-water', 'C-plan', 'C-flag', 'C-twomin', 'C-scout', 'C-hail', 'S-sofi'],
  ['sack', 'stuff', 'strip', 'stun', 'injure', 'shield', 'heal', 'anchor', 'counter', 'juke', 'sack', 'stun', 'I-water', 'I-cleats', 'C-plan', 'C-count', 'C-hail', 'C-room', 'C-timeout', 'S-arrowhead']
];
const clone = x => JSON.parse(JSON.stringify(x));
function loadIsolated(file, deps, names) {
  // Run the production module with in-memory storage/board dependencies, without Firebase or browser timers.
  const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/^import .*;$/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(deps), src + '\nreturn {' + names.join(',') + '};')(...Object.values(deps));
}
function simulate(B, version, seed) {
  const G = B.newGame(seed, decks, version), log = [[], []], pending = [[], []];
  const move = (who, m) => {
    const before = G.turn;
    assert.equal(B.play(G, who, m).ok, true);
    if (m.a === 'setup') log[who].push(m);
    else {
      pending[who].push(m);
      if (G.turn !== before || G.phase === 'over') { log[who].push(pending[who]); pending[who] = []; }
    }
  };
  for (const who of [G.first, 1 - G.first]) {
    const basics = G.p[who].hand.filter(B.isBasic);
    move(who, {a: 'setup', act: basics[0], bench: basics.slice(1, 4)});
  }
  for (let i = 0; i < 500 && G.phase !== 'over'; i++) {
    const who = G.cur, me = G.p[who], opp = G.p[1 - who];
    if (me.promote) { move(who, {a: 'promote', u: me.bench[0].u}); continue; }
    const options = [];
    if (me.en) options.push({a: 'energy', on: me.active.u});
    me.hand.forEach(id => {
      if (B.isBasic(id)) options.push({a: 'bench', id});
      const t = B.TRAINERS[id];
      if (t) options.push({a: t.kind, id, on: t.target === 'bench' ? me.bench[0]?.u : me.active?.u});
    });
    options.push({a: 'attack', n: 1}, {a: 'attack', n: 0}, {a: 'end'});
    move(who, options.find(m => B.check(G, who, m).ok));
  }
  assert.equal(G.phase, 'over', 'simulation reaches an outcome');
  const replayed = B.replay(seed, decks, log, version);
  assert.equal(replayed.bad, null);
  assert.deepEqual(replayed.G, G, 'saved turns replay exactly');
  return G;
}
function board(B, version = 3, attacker = 'pass', defender = 'anchor') {
  const G = B.newGame('preview', decks, version);
  const slot = (id, u) => ({id, u, under: [], dmg: 0, en: ['P', 'P', 'R'], stun: false, inj: false, shield: 0, at: 0});
  G.phase = 'play'; G.cur = 0; G.turn = 4;
  G.p.forEach((p, i) => { p.active = slot(i ? defender : attacker, i + 1); p.bench = [slot('anchor', i + 3)]; p.set = true; p.n = 3; p.used = {}; p.plan = 0; });
  G.p[0].active.en = B.stats(attacker).attacks[1].cost.map(e => e === '*' ? 'R' : e);
  return G;
}
(async () => {
  const B = await import(pathToFileURL(path.join(root, 'js/core/dynasty-battle.js')));
  B.setCards(id => byId[id]);
  assert.equal(B.newGame('default', decks).v, 1, 'unversioned multiplayer replay keeps its legacy default');
  // These hashes were captured from the pre-Rivals engine for 12 full matches per version, including all events/RNG.
  const golden = {1: '3c217d21abee8a4f6af4fd2822ba264873d2ad273df77f6b00e4a932cd154579', 2: '709d68cea5d4ad61ba35628f22c42e410a0ca867cf49c5188ae838746bea3ed9'};
  for (const v of [1, 2]) {
    const games = Array.from({length: 12}, (_, i) => simulate(B, v, `legacy-${i}`));
    const hash = crypto.createHash('sha256').update(JSON.stringify(games)).digest('hex');
    assert.equal(hash, golden[v], `version ${v} results and RNG remain unchanged`);
  }
  for (const v of [1, 2, 3]) {
    const G = board(B, v), original = G.p[0].active.en.slice();
    B.play(G, 0, {a: 'attack', n: 1});
    assert.equal(G.p[0].active.en.length, original.length - (v === 3 ? 1 : 0));
    if (v === 3) {
      assert.deepEqual(G.p[0].active.en, ['P', 'R'], 'signature spends matching energy first');
      B.play(G, 1, {a: 'end'});
      assert.equal(B.check(G, 0, {a: 'attack', n: 1}).ok, false, 'signature must be rebuilt');
      assert.equal(B.check(G, 0, {a: 'attack', n: 0}).ok, true, 'quick play remains available');
      G.p[0].en = 'P';
      assert.equal(B.play(G, 0, {a: 'energy', on: G.p[0].active.u}).ok, true);
      assert.equal(B.check(G, 0, {a: 'attack', n: 1}).ok, true);
    }
    const quick = board(B, v);
    B.play(quick, 0, {a: 'attack', n: 0});
    assert.equal(quick.p[0].active.en.length, 3, 'quick plays preserve energy');
  }
  // Every attack effect and defensive modifier: the preview is honest and does not advance the random stream.
  for (const v of [1, 2, 3]) for (const attacker of cards.map(c => c.id)) for (const defender of ['anchor', 'juke', 'counter', 'pass']) for (const n of [0, 1]) {
    const G = board(B, v, attacker, defender);
    G.p[0].plan = 30; G.p[1].active.shield = 10; G.p[1].active.dmg = 10;
    G.stadium = {id: 'S-sofi', by: 0}; G.p[0].bench[0].id = 'general';
    const before = JSON.stringify(G), preview = B.attackPreview(G, 0, n);
    assert.equal(JSON.stringify(G), before, 'preview never changes state or RNG');
    assert.equal(preview.ok, true);
    assert.equal(B.play(G, 0, {a: 'attack', n}).ok, true);
    const ev = G.ev.find(e => e.k === 'attack');
    assert.ok(ev.dmg >= preview.min && ev.dmg <= preview.max, `${v}/${attacker}/${defender}/${n}: damage within preview`);
    if (preview.min === preview.max) assert.equal(ev.dmg, preview.min);
  }
  const juke = board(B, 3, 'pass', 'juke'), plain = clone(juke);
  plain.p[1].active.id = 'run';
  assert.equal(B.attackPreview(juke, 0, 1).max, B.attackPreview(plain, 0, 1).max - 30);
  assert.equal(B.attackPreview(juke, 0, 0).max, B.attackPreview(plain, 0, 0).max, 'quick plays bypass Juke');
  assert.match(B.abilityText('juke', 2), /flip a coin/i);
  assert.match(B.abilityText('juke', 3), /30 less/);
  for (let i = 0; i < 12; i++) simulate(B, 3, `rivals-${i}`);

  // Production persistence adapters must retain the rules version through cleaning, storage and reload.
  const storage = new Map(); let profile = 'm_evan';
  const localStorage = {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k)};
  const D = {status: 'ready', mayPlay: () => true, mine: () => ({}), deckOf: () => ({ok: true, ids: decks[0]}), CARDS: cards,
    FIELD: 'dy1', autoDeck: () => decks[1], rng: () => () => .5, payBattle: () => {}, paySolo: () => null};
  const shared = {B, D, localStorage, profileKey: () => profile, setTimeout: () => 1, clearTimeout: () => {}};
  const S = loadIsolated('js/core/dynasty-solo.js', shared, ['get', 'start', 'nextMove']);
  const cpu = board(B, 3, 'kick', 'juke');
  cpu.p[0].hand = []; cpu.p[0].en = null; cpu.p[0].used.retreat = true;
  assert.equal(S.nextMove(cpu, 0, 'int').n, 0, 'CPU keeps its energy when Juke makes the signature no better');
  const finish = board(B, 3);
  finish.p[0].hand = []; finish.p[0].en = null; finish.p[0].used.retreat = true;
  finish.p[1].active.dmg = B.hpOf(finish.p[1].active) - 5;
  assert.equal(S.nextMove(finish, 0, 'int').n, 0, 'CPU uses a quick knockout without spending signature energy');
  storage.set('gg-dys-m_evan', JSON.stringify({id: 'cpu-old', opp: 'rookie-camp', seed: 'old', decks, log: [], at: 1}));
  assert.equal(S.get('cpu-old').G.v, 2, 'unversioned solo saves stay v2');
  assert.equal(S.start('rookie-camp').ok, true);
  const saved = JSON.parse(storage.get('gg-dys-m_evan'));
  assert.equal(saved.v, 3, 'new solo records explicitly save v3');
  profile = 'u_ryan-stewart'; S.get(); profile = 'm_evan';
  assert.equal(S.get(saved.id).G.v, 3, 'solo reload preserves v3');
  const daily = {LB: {raw: [], all: [], ready: false}};
  const data = {subscribe: () => {}, M: {evan: {}, 'ryan-stewart': {}}, name: id => id};
  const M = loadIsolated('js/core/dynasty-match.js', {...shared, daily, data, dynastyKey: () => true, visitWho: () => ({name: 'Opponent'})}, ['cleanSide', 'challenge', 'get']);
  for (const v of [1, 2, 3]) assert.equal(M.cleanSide({o: 'other', v}).v || 1, v, 'cleanSide preserves supported versions');
  const challenge = M.challenge('u_ryan-stewart');
  assert.equal(challenge.ok, true);
  assert.equal(JSON.parse(storage.get('gg-dyb-m_evan'))[challenge.mid].v, 3, 'new multiplayer challenge saves v3');
  daily.LB.raw.push({id: 'opponent', dyb: {'u_ryan-stewart': {[challenge.mid]: {o: 'm_evan', k: decks[1], m: [], ch: 0, c: 1, at: 1}}}});
  assert.equal(M.get(challenge.mid).G.v, 3, 'the accepter inherits the challenger’s version for replay');
  console.log('PASS Rivals rules: legacy v1/v2 snapshots, v3 energy/Juke, 432 previews, replay, and save-version round trips');
})().catch(e => { console.error(e); process.exitCode = 1; });
