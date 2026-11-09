// Rivals preview permissions, rendered cases and direct routes; no browser or live writes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
(async () => {
  const league = JSON.parse(read('data/league.json'));
  const dataSource = read('js/core/data.js');
  const USERS = vm.runInNewContext(dataSource.match(/export const USERS = ([\s\S]*?);/)[1]);
  let member = null, user = null;
  const errors = [];
  const ctx = vm.createContext({console:{error:e => errors.push(String(e))}, URLSearchParams, URL, setTimeout, clearTimeout});
  const noop = () => '';
  const data = {OWNER:'evan', ids:league.managers.map(m => m.id), me:() => member, user:() => user, USERS,
    esc:s => String(s ?? ''), nf:String, name:id => id, subscribe:() => noop};
  const ui = {lsGet:() => null, icon:noop, button:({label}) => '<button>' + label + '</button>', ordinal:String};
  const daily = {status:'loading', LB:{raw:[]}};
  const named = names => Object.fromEntries(names.split(' ').map(n => [n,noop]));
  const stub = (values, id) => new vm.SyntheticModule(Object.keys(values), function() {
    for (const [k,v] of Object.entries(values)) this.setExport(k,v);
  }, {context:ctx, identifier:id});
  const stubs = {
    'data.js':stub(data,'data'), 'ui.js':stub(ui,'ui'), 'daily.js':stub(daily,'daily'),
    'board.js':stub(named('ringHTML stepParts maxPts gradeGold msToMidnight countdownHTML itemCount shortSub'),'board'),
    'game-case.js':stub({...named('turnable shelfTurner'), shellHTML:noop},'case'),
    'realm-pay.js':stub({RANKED:[],aleFor:noop},'pay'),
    'realm-active.js':stub({profileKey:() => member ? 'm_' + member : user ? 'u_' + user.id : ''},'profile'),
    'opening.js':stub({active:() => false, hold:noop, done:() => Promise.resolve(), release:noop},'opening')
  };
  const featureSource = read('js/core/features.js'), gameSource = read('js/views/games.js');
  const F = new vm.SourceTextModule(featureSource,{context:ctx,identifier:'features'});
  const link = spec => spec.endsWith('/features.js') ? F : stubs[spec.split('/').pop()];
  await F.link(link); await F.evaluate();
  const games = new vm.SourceTextModule(gameSource,{context:ctx,identifier:'games'});
  await games.link(link); await games.evaluate();
  const appSource = read('js/app.js');
  const routing = appSource.slice(appSource.indexOf('export const APP_VERSION'), appSource.indexOf('// ============================================================================ State'));
  const routes = new vm.SourceTextModule("import {available, dynastyOpen} from './core/features.js';\n" + routing,{context:ctx,identifier:'routes'});
  await routes.link(link); await routes.evaluate();
  const f=F.namespace, g=games.namespace, r=routes.namespace;
  const cases = [
    ...data.ids.map(id => ({member:id,user:null,play:['evan','jayton'].includes(id),visible:true})),
    ...USERS.map(u => ({member:null,user:u,play:['ryan-stewart','ryan-younggreen'].includes(u.id),visible:['ryan-stewart','ryan-younggreen'].includes(u.id)})),
    {member:null,user:null,play:false,visible:false},
    {member:'unknown',user:null,play:false,visible:false},
    {member:'Ryan Younggreen',user:null,play:false,visible:false},
    {member:null,user:{id:'guest',name:'Ryan Younggreen'},play:false,visible:false}
  ];
  for (const c of cases) {
    member=c.member; user=c.user;
    const label=member || user?.id || 'visitor';
    assert.equal(f.dynastyOpen(),c.play,label + ' permission');
    assert.equal(f.rivalsUpdated(),c.play,label + ' shared Rivals updates');
    assert.equal(g.gameOpen('dynasty'),c.play,label + ' play gate');
    assert.equal(g.gamesFor().some(x => x.id === 'dynasty'),c.visible,label + ' visible case');
    const key=member ? 'm_' + member : user ? 'u_' + user.id : 'g_guest';
    assert.equal(f.dynastyKey(key),c.play,label + ' save/opponent key');
    const html=g.listHTML();
    const cards=[...html.matchAll(/<button[^>]*data-gm="dynasty"[^>]*>/g)].map(m => m[0]);
    assert.equal(cards.length,c.visible ? 3 : 0,label + ' carousel copies');
    if (c.visible) {
      assert.equal(html.includes('COMING SOON'),!c.play,label + ' sticker');
      for (const card of cards) {
        assert.equal(card.includes('aria-disabled="true"'),!c.play,label + ' accessible availability');
        assert.equal(card.includes('Coming Soon'),!c.play,label + ' accessible label');
      }
    }
    assert.equal(r.parseRoute('/puzzles/dynasty').view === 'dynasty',c.play,label + ' direct hub URL');
    assert.equal(r.parseRoute('/puzzles/dynasty/battle/b1234abcd').view === 'dynasty-battle',c.play,label + ' direct battle URL');
    for (const game of ['puzzles','17-0','drill','kick','return','keep']) assert.equal(g.gameOpen(game),true,label + ' unchanged ' + game);
    assert.equal(f.packsUnlimited(key),['m_evan','u_ryan-stewart'].includes(key),label + ' pack privilege');
    assert.equal(f.coinsUnlimited(key),key === 'm_jayton',label + ' coin privilege');
  }
  assert.equal(cases.filter(c => c.play).length,4,'Exactly four permitted profiles');
  assert.deepEqual(errors,[],'Rendering has no caught errors');
  // Review the async handoff and profile invalidation at their call sites.
  assert.match(gameSource,/if \(!g \|\| !gameOpen\(id\) \|\| st.zoom\) return/);
  assert.match(gameSource,/type === 'me'[\s\S]*?closeZoom\(true\); refresh\(false\)/);
  assert.match(gameSource,/if \(!gameOpen\(id\)\) \{ closeZoom\(true\); return; \}/);
  assert.equal((gameSource.match(/!gameOpen\(id\) \|\| !z.isConnected/g)||[]).length,2,'Async launch rechecks');
  for (const file of ['js/core/checks-dynasty.js','sw.js']) new vm.SourceTextModule(read(file),{context:ctx});
  console.log('PASS: ' + cases.length + ' profile cases; exactly four can play, league preview stickers, direct hub/battle routes, save/opponent keys and unchanged privileges.');
  console.log('PASS: profile-switch cancellation and both asynchronous launch guards; modified JavaScript parses.');
})().catch(e => { console.error(e); process.exitCode=1; });
