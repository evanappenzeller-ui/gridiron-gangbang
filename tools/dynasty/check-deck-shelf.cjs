// Saved deck lifecycle, owned-only team recipes, bounded chemistry, legacy replay and owner boundaries.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
(async () => {
  const B = await import(pathToFileURL(path.join(root, 'js/core/dynasty-battle.js')));
  const TABLE = await import(pathToFileURL(path.join(root, 'js/core/dynasty-table.js')));
  const POCKET = await import(pathToFileURL(path.join(root, 'js/core/dynasty-pocket-cards.js')));
  let owner = true;
  const src = fs.readFileSync(path.join(root, 'js/core/dynasty.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const ctx = vm.createContext({B, TABLE, POCKET, REAL: {}, ACTION: {}, data: {isOwner: () => owner}, rivalsUpdated: () => owner});
  vm.runInContext(src + '\nthis.api={setData,fresh,clean,themedDeck,deckThemes,attrKeys,savedDecks,saveDeckSlot,useDeckSlot,deleteDeckSlot,tableDeck,spares,sell,get cards(){return CARDS},get teams(){return TEAMS}}', ctx);
  const D = ctx.api; D.setData(JSON.parse(fs.readFileSync(path.join(root, 'data/dynasty.json'))));
  const s = D.fresh(); s.o = Object.fromEntries([...D.cards.map(c => c.id), ...Object.keys(B.TRAINERS)].map(id => [id, 2]));
  s.dk = D.cards.slice(0, 10).flatMap(c => [c.id, c.id]);
  const original = JSON.stringify(s), current = JSON.stringify(D.tableDeck(s).ids);
  assert.equal(D.savedDecks(s).length, 1); assert.equal(JSON.stringify(s), original, 'opening shelf never mutates a save');
  for (const team of Object.keys(D.teams)) {
    const t = D.themedDeck(team, s); assert.equal(t.ok, true, team); assert.equal(t.ids.length, 40); assert.equal(B.teamChemistry(t.ids), team);
    const used = {}; t.ids.forEach(id => used[id] = (used[id] || 0) + 1);
    assert.ok(Object.entries(used).every(([id, n]) => n <= Math.min(2, TABLE.available(s)[id] || 0)));
  }
  assert.equal(JSON.stringify(s), original, 'recipes grant no cards or progress');
  const themes = D.deckThemes(); assert.equal(themes.length, 16); assert.equal(new Set(themes.map(t => t.id)).size, 16);
  for (const theme of themes) {
    const recipe = D.themedDeck(theme.id, s), used = {};
    assert.equal(recipe.ok, true, theme.name); assert.equal(recipe.ids.length, 40); assert.equal(TABLE.check(recipe.ids, s).ok, true);
    recipe.ids.forEach(id => used[id] = (used[id] || 0) + 1);
    const players = recipe.ids.map(id => D.cards.find(c => c.id === id)).filter(Boolean);
    assert.ok(players.length >= 12 && new Set(players.map(c => c.p)).size >= 6);
    for (const c of players) {
      assert.ok(theme.positions.includes(c.pos), `${theme.id}: ${c.name} position`);
      for (const [attr, min] of Object.entries(theme.attrs)) assert.ok(c.a[D.attrKeys(c.pos).indexOf(attr)] >= min, `${theme.id}: ${c.name} ${attr}`);
      if (c.s === 'X' && theme.legends) assert.ok(theme.legends.includes(c.p));
    }
    assert.ok(Object.entries(used).every(([id, n]) => n <= Math.min(2, TABLE.available(s)[id] || 0)));
    assert.equal(JSON.stringify(D.themedDeck(theme.id, s).ids), JSON.stringify(recipe.ids), 'recipes are deterministic');
    const empty = D.themedDeck(theme.id, D.fresh()); assert.equal(empty.ok, false); assert.equal(empty.matching, 0);
    assert.ok(empty.why.includes('0/12 cards')); assert.ok(D.cards.some(c => c.id === empty.cover), 'empty collection still has a matching cover');
    const single = D.fresh(); single.o = {...s.o}; Object.keys(single.o).forEach(id => { if (D.cards.some(c => c.id === id)) single.o[id] = 1; });
    const oneEach = D.themedDeck(theme.id, single); assert.equal(oneEach.ok, true, theme.id + ' with single copies');
    assert.equal(new Set(oneEach.ids.filter(id => D.cards.some(c => c.id === id))).size, oneEach.matching);
  }
  assert.equal(JSON.stringify(s), original, 'new recipes never alter saves, decks, cards or balances');
  const guns = D.themedDeck('gunslingers', s), draftTheme = D.fresh();
  const six = [...new Set(guns.ids.filter(id => D.cards.some(c => c.id === id)))].slice(0, 6);
  draftTheme.o = {...TABLE.PLAYBOOK, ...Object.fromEntries(six.map(id => [id, 2]))};
  const shortTheme = D.themedDeck('gunslingers', draftTheme); assert.equal(shortTheme.ok, false); assert.equal(shortTheme.matching, 12); assert.match(shortTheme.why, /40 cards/);
  // High OVR and the wrong position never bypass a recipe's actual attribute threshold.
  const qb = D.cards.find(c => c.pos === 'QB'), attr = D.attrKeys('QB').indexOf('ARM'), arm = qb.a[attr];
  qb.a[attr] = 84; const below = D.fresh(); below.o = {[qb.id]: 2}; assert.equal(D.themedDeck('gunslingers', below).matching, 0);
  qb.a[attr] = 85; assert.equal(D.themedDeck('gunslingers', below).matching, 2); qb.a[attr] = arm;
  const mobile = D.fresh(), brady = D.cards.find(c => c.p === 'xtombrady'); mobile.o = {[brady.id]: 2}; assert.equal(D.themedDeck('dual-threat', mobile).matching, 0);
  assert.equal(D.themedDeck('unknown-theme', s).ok, false);
  assert.equal(D.themedDeck('KC', D.fresh()).ok, false);
  const themed = D.themedDeck('KC', s), added = D.saveDeckSlot({name: 'Chiefs', ids: themed.ids}, s);
  assert.equal(added.ok, true); assert.equal(JSON.stringify(D.tableDeck(s).ids), current, 'saving keeps current active deck');
  assert.equal(D.savedDecks(s).length, 2); assert.equal(D.useDeckSlot(added.id, s).ok, true);
  const restored = D.clean(JSON.parse(JSON.stringify(s)));
  assert.equal(JSON.stringify(restored.table), JSON.stringify(s.table), 'slots, active deck and original round trip');
  assert.equal(JSON.stringify(D.tableDeck(restored).ids), JSON.stringify(themed.ids));
  assert.equal(D.deleteDeckSlot(added.id, s), false, 'cannot delete active deck');
  const draft = D.saveDeckSlot({name: 'Draft', ids: []}, s); assert.equal(draft.ok, true); assert.equal(D.useDeckSlot(draft.id, s).ok, false);
  assert.equal(D.deleteDeckSlot(draft.id, s), true); assert.equal(D.savedDecks(s).length, 2);
  const keep = themed.ids.find(id => D.cards.some(c => c.id === id));
  assert.equal(D.sell(keep, 2, s).ok, false, 'saved cards cannot be sold out of a deck');
  assert.ok(!D.spares(s).list.some(c => c.id === keep));
  const bad = [...themed.ids]; bad[0] = 'non-card'; assert.equal(D.saveDeckSlot({name:'Bad',ids:bad},s).ok,false);
  owner = false; const before = JSON.stringify(s);
  assert.equal(D.deckThemes().length, 0); for (const theme of themes) assert.equal(D.themedDeck(theme.id, s).ok, false);
  assert.equal(D.savedDecks(s).length, 0); assert.equal(D.saveDeckSlot({name:'No',ids:themed.ids},s).ok,false);
  assert.equal(D.useDeckSlot(added.id,s).ok,false); assert.equal(D.deleteDeckSlot('original',s),false); assert.equal(JSON.stringify(s),before);
  owner = true;
  while (D.savedDecks(s).length < 30) assert.equal(D.saveDeckSlot({name:'Draft',ids:[]},s).ok,true);
  assert.equal(D.saveDeckSlot({name:'Overflow',ids:[]},s).ok,false);
  const players = themed.ids.filter(id => B.stats(id)), different = players.find(id => B.stats(id).from !== B.stats(players[0]).from);
  const make = (seed, chemistry) => {
    const g = B.newGame(seed, [themed.ids, themed.ids], 6, chemistry);
    for(let w=0;w<2;w++) B.play(g,w,{a:'setup',act:g.p[w].hand.find(B.isBasic),bench:[]});
    g.cur=0; g.p[0].n=2; g.p[0].active.id=players[0]; g.p[0].active.en=['P','P','R','R','B','B','C','C'];
    g.p[0].bench=[{...structuredClone(g.p[0].active),id:different,u:80}]; return g;
  };
  const chem={v:1,team:'KC'}, g=make('chem',chem), old=make('chem',null);
  assert.equal(B.chemistryBonus(g,0),5); assert.equal(B.chemistryBonus(old,0),0);
  assert.equal(B.attackPreview(g,0,0).max-B.attackPreview(old,0,0).max,5);
  const expected=B.attackPreview(g,0,0).max; assert.equal(B.play(g,0,{a:'attack',n:0}).ok,true);
  assert.equal(g.ev.find(e=>e.k==='attack').dmg,expected); assert.equal(g.ev.find(e=>e.k==='attack').chemistry,5);
  const capped=make('cap',chem); capped.p[0].bench.push({...capped.p[0].bench[0],u:81},{...capped.p[0].bench[0],u:82}); assert.equal(B.chemistryBonus(capped,0),5);
  capped.p[0].n=1; assert.equal(B.chemistryBonus(capped,0),0); capped.p[0].n=2;
  capped.p[0].bench.forEach(p=>p.id=capped.p[0].active.id); assert.equal(B.chemistryBonus(capped,0),0);
  assert.equal(B.chemistryBonus(make('wrong',{v:1,team:'BUF'}),0),0);
  assert.equal(B.chemistryBonus(make('future',{v:2,team:'KC'}),0),0);
  const mixed=[...themed.ids]; mixed[0]=D.cards.find(c=>c.team!=='KC').id; assert.equal(B.teamChemistry(mixed),null);
  assert.equal(B.teamChemistry(players.slice(0,10)),null);
  const outcomes=new Set();
  for(let i=0;i<40;i++){const x=make('risk'+i,chem),p=B.attackPreview(x,0,2);assert.equal(p.min,0);B.play(x,0,{a:'attack',n:2});const e=x.ev.find(e=>e.k==='attack');outcomes.add(e.heads);assert.equal(e.dmg,e.heads?p.max:0);if(!e.heads)assert.equal(e.chemistry,undefined);}
  assert.equal(outcomes.size,2);
  // Reconstruct actual legal moves from saved inputs, with no hidden mutations or RNG calls from previews.
  const a=B.newGame('replay',[themed.ids,themed.ids],6,chem),log=[];
  for(let w=0;w<2;w++){const hand=a.p[w].hand.filter(B.isBasic),m={a:'setup',act:hand[0],bench:hand.slice(1,4)};B.play(a,w,m);log.push([w,m]);}
  for(let i=0;i<8&&a.phase==='play';i++){const who=a.cur;let m={a:'attack',n:0};if(!B.check(a,who,m).ok)m={a:'end'};B.attackPreview(a,who,0);B.play(a,who,m);log.push([who,m]);}
  const b=B.newGame('replay',[themed.ids,themed.ids],6,JSON.parse(JSON.stringify(chem)));log.forEach(([w,m])=>assert.equal(B.play(b,w,m).ok,true));assert.deepEqual(a,b);
  console.log('PASS saved deck lifecycle, 32 team + 16 position/attribute recipes, exact traits, missing cards, single copies, owner boundary, sale protection, +5 cap and deterministic replay');
})().catch(e=>{console.error(e);process.exitCode=1});
