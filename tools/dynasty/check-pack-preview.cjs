// Pack headliners must be canonical, top-rated players that the real drawCard can return.
// Local modules/data only; no saves, randomness, network or Firebase.
// Run: node tools/dynasty/check-pack-preview.cjs
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
(async () => {
  const B = await import(pathToFileURL(path.join(root, 'js/core/dynasty-battle.js')));
  const TABLE = await import(pathToFileURL(path.join(root, 'js/core/dynasty-table.js')));
  const POCKET = await import(pathToFileURL(path.join(root, 'js/core/dynasty-pocket-cards.js')));
  const ctx = vm.createContext({B, TABLE, POCKET, REAL: {}, ACTION: {}});
  vm.runInContext(source('js/core/dynasty.js') + '\nthis.api={setData,drawCard,PACKS,SCALE,drawPack,rng,anyCard,PACK_ORDER,get CARDS(){return CARDS},get TEAMS(){return TEAMS}}', ctx);
  const D = ctx.api;
  D.setData(JSON.parse(fs.readFileSync(path.join(root, 'data/dynasty.json'))));
  const preview = vm.createContext({D});
  vm.runInContext(source('js/views/dynasty-pack-preview.js') + '\nthis.top=packTopPlayers;this.next=nextPackPreview;', preview);
  const top = preview.top, before = JSON.stringify(D.CARDS), packBefore = JSON.stringify(D.PACKS);
  const ids = cards => Array.from(cards, c => c.id);
  const order = (a,b) => b.o-a.o || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  let advertised = 0;
  for (const kind of ['start', 'std', 'team', 'prem']) {
    for (const team of kind === 'team' ? [null, ...Object.keys(D.TEAMS)] : [null]) {
      const cards = top(kind, {team}), all = top(kind, {team, limit: 10000});
      assert.equal(cards.length, 4, `${kind}/${team}: four previews`);
      assert.equal(new Set(cards.map(c => c.p)).size, cards.length, 'No repeated player');
      assert.deepEqual(ids(cards), ids([...all].sort(order).slice(0,4)), 'Highest OVR first, deterministic ties');
      for (const c of cards) {
        assert.ok(D.CARDS.includes(c), 'Canonical card');
        assert.notEqual(c.s, 'X', 'Legends are unavailable in active pack pools');
        if (team) assert.equal(c.team, team, 'Selected team restriction');
        // Find a real weighted slot and prove the actual draw returns this card. For `all`,
        // its L branch draws every active player's canonical card (not only series L).
        const slot = D.PACKS[kind].slots.find(s => ['live','all'].includes(s.pool) && s.odds[c.r] > 0);
        assert.ok(slot, c.name + ' has an eligible player slot');
        const odds = Object.entries(slot.odds), total = odds.reduce((n, [,w]) => n+w, 0);
        const at = odds.findIndex(([rar]) => rar === c.r);
        const rarityRoll = (odds.slice(0,at).reduce((n, [,w]) => n+w, 0) + slot.odds[c.r]/2) / total;
        const pool = D.CARDS.filter(p => p.s !== 'X' && p.r === c.r && (!team || p.team === team));
        const rolls = [rarityRoll, ...(slot.pool === 'all' ? [0] : []), (pool.indexOf(c)+.5)/pool.length];
        assert.equal(D.drawCard(slot, {team, R:() => rolls.shift()}).id, c.id, 'Actual draw can yield ' + c.name);
        advertised++;
      }
      if (kind === 'prem') assert.ok(all.every(c => c.o >= D.SCALE.epic), 'Epic preview contains no common cards');
    }
  }
  for (const kind of ['std','start','team','prem']) for (const team of kind === 'team' ? Object.keys(D.TEAMS) : [null]) for(let i=0;i<100;i++) {
    const cards = D.drawPack(kind,{team,R:D.rng(kind+team+i)}).map(D.anyCard);
    assert.equal(new Set(cards.map(c=>c.p || c.id)).size,cards.length);
    assert.ok(cards.every(c=>kind === 'prem' || (kind === 'team' ? c.r !== 'mythic' : ['common','epic'].includes(c.r))));
    if(team) assert.ok(cards.every(c=>c.team===team));
  }
  const memory = new Map(), next = key => preview.next(key,k=>memory.get(k),(k,v)=>memory.set(k,v));
  const a=next('m_evan'), b=next('m_evan');
  for(const k of ['std','team','prem','start']) {assert.notDeepEqual(ids(a[k]),ids(b[k]));assert.ok(b[k].every(c=>top(k,{limit:12}).includes(c)));}
  assert.deepEqual(ids(next('m_jayton').std),ids(a.std));
  assert.equal(top('team', {team:'invalid'}).length, 0);
  for (const kind of ['gday','leg','invalid']) assert.equal(top(kind).length, 0, 'Unavailable packs have no preview');
  assert.equal(top('std', {limit:0}).length, 0);
  assert.equal(top('std', {limit:-1}).length, 0);
  assert.equal(JSON.stringify(D.CARDS), before, 'Preview never reorders or changes cards');
  assert.equal(JSON.stringify(D.PACKS), packBefore, 'Odds and prices stay unchanged');
  const original = ids(top('std')); D.CARDS.reverse();
  assert.deepEqual(ids(top('std')), original, 'Tied headliners do not depend on data ordering');
  console.log(`PASS: ${advertised} top-player draw witnesses across active packs and all 32 teams; canonical cards, deterministic ranking, unique players and read-only previews.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
