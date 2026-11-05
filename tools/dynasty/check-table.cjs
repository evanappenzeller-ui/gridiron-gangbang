// Owner table rules and offline browser interactions. Never contacts the live board.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/rivals-table');
fs.mkdirSync(out, {recursive: true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
  if (!p.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(p,(err,buf) => { if (err) return res.writeHead(404).end();
    if (p.endsWith('index.html')) buf=Buffer.from(buf.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));
    res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'}).end(buf);
  });
});
async function rules() {
  const B = await import(pathToFileURL(path.join(root,'js/core/dynasty-battle.js')));
  const T = await import(pathToFileURL(path.join(root,'js/core/dynasty-table.js')));
  const cards = Object.fromEntries(Array.from({length:20},(_,i)=>['p'+i,{id:'p'+i,p:'p'+i,name:'Player '+i,s:i===1?'X':'L',pos:'QB',o:90,a:[99,70,70,70],ln:[]}]));
  B.setCards(id=>cards[id]||null);
  const s = {o:Object.fromEntries(Object.keys(cards).map(id=>[id,2])),dk:Object.keys(cards),so:{},table:{packs:0}};
  const before=JSON.stringify(s), dk=T.deck(s);
  assert.equal(dk.ok,true); assert.equal(dk.ids.length,40); assert.equal(JSON.stringify(s),before);
  assert.equal(T.check([...dk.ids.slice(0,39),'invalid'],s).ok,false);
  assert.equal(T.check(Array(40).fill('I-charge'),s).ok,false);
  assert.equal(B.checkDeck([...Array(18).fill('p0'),'I-charge','I-draw']).ok,false);
  const G=B.newGame('kos',[dk.ids,dk.ids],6);
  for(let w=0;w<2;w++) assert.equal(B.play(G,w,{a:'setup',act:G.p[w].hand.find(B.isBasic),bench:[]}).ok,true);
  for(let k=1;k<=3;k++) {
    G.cur=0; G.p[0].active.en=['P','P','P']; G.p[1].active.id='p1'; G.p[1].active.dmg=B.hpOf(G.p[1].active)-10;
    assert.equal(B.play(G,0,{a:'attack',n:0}).ok,true);
    assert.equal(G.p[0].pts,k,'each Legend knockout counts exactly once');
    if(k<3) { assert.equal(G.phase,'play'); G.cur=1; assert.equal(B.play(G,1,{a:'promote',u:G.p[1].bench[0].u}).ok,true); }
  }
  assert.deepEqual(G.over,{win:0,why:'points'});
  const results=new Set();
  for(let i=0;i<40;i++) {
    const g=B.newGame('flip'+i,[dk.ids,dk.ids],6);
    for(let w=0;w<2;w++) B.play(g,w,{a:'setup',act:g.p[w].hand.find(B.isBasic),bench:[]});
    g.cur=0; g.p[0].active.en=['P','P']; g.p[0].plan=100;
    const p=B.attackPreview(g,0,2); assert.equal(p.min,0); const rn=g.rn;
    B.attackPreview(g,0,2); assert.equal(g.rn,rn);
    B.play(g,0,{a:'attack',n:2}); const ev=g.ev.find(e=>e.k==='attack'); results.add(ev.heads);
    assert.equal(ev.dmg,ev.heads?p.max:0);
  }
  assert.equal(results.size,2);
  const a=B.newGame('items',[dk.ids,dk.ids],6);
  for(let w=0;w<2;w++) B.play(a,w,{a:'setup',act:a.p[w].hand.find(B.isBasic),bench:[]});
  a.cur=0; a.p[0].hand.push('I-charge','I-draw'); const en=a.p[0].active.en.length, hand=a.p[0].hand.length;
  assert.equal(B.play(a,0,{a:'item',id:'I-charge',on:999}).ok,false);
  B.play(a,0,{a:'item',id:'I-charge',on:a.p[0].active.u}); assert.equal(a.p[0].active.en.length,en+2);
  B.play(a,0,{a:'item',id:'I-draw'}); assert.equal(a.p[0].hand.length,hand); assert.equal(a.cur,0);
  s.table.packs=5; s.so={g1:3,g10:1};
  assert.equal(T.finishes(s).filter(f=>f.unlocked).length,4);
  assert.equal(T.clean({finish:'bad',packs:-1,deck:['p1']}).finish,'club');
  console.log('PASS table rules: 40 owned cards, instant items, three actual KOs, reserve promotion, coin heads/tails, unlocks');
}
async function browserTest(url) {
  const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
    await ctx.addInitScript(()=>{sessionStorage.setItem('gg-skip-title','1');if(!localStorage.getItem('gg-me'))localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');localStorage.setItem('gg-release-3.0:evan','1');});
    const page=await ctx.newPage(), errors=[]; page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE',String(e));});
    page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR|firebase|navigator\.vibrate/i.test(m.text()))errors.push(m.text());});
    await page.goto(url+'/#/puzzles'); await page.waitForFunction(()=>window.__ggBooted);
    const fixture=await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),B=await import('/js/core/dynasty-battle.js'),S=await import('/js/core/dynasty-solo.js'),T=await import('/js/core/dynasty-table.js');
      await D.load(); const s=D.mine(), players=D.CARDS.filter(c=>c.pos==='QB').slice(0,20).map(c=>c.id);
      players.forEach(id=>s.o[id]=2);D.setDeck([...players.slice(0,9).flatMap(id=>[id,id]),'C-twomin','C-twomin']);
      const old=JSON.stringify(s.dk),newgame=S.start('g1');if(!newgame.ok)throw Error(newgame.why);
      const check=S.get(newgame.mid);if(check.G.v!==6||check.G.p[0].deck.length+check.G.p[0].hand.length!==40)throw Error('owner start needs v6/40');
      const deck=[...players.slice(0,16).flatMap(id=>[id,id]),...Object.keys(T.PLAYBOOK).flatMap(id=>[id,id])];
      let g,seed;for(let n=0;n<5000;n++){seed='ui'+n;g=B.newGame(seed,[deck,deck],6);const h=g.p[0].hand;if(g.first===0&&h.includes('I-charge')&&h.includes('I-draw')&&h.filter(B.isBasic).length>=2)break;}
      const h=g.p[0].hand;if(!h.includes('I-charge')||!h.includes('I-draw'))throw Error('no fixture seed');
      const move={a:'setup',act:g.p[1].hand.find(B.isBasic),bench:[]};
      localStorage.setItem('gg-dys-m_evan',JSON.stringify({id:'cputable',opp:'g1',seed,v:6,decks:[deck,deck],log:[[1,move]],at:Date.now(),z:'',paid:0}));
      D.touch();D.flush();return {players:h.map((id,i)=>B.isBasic(id)?i:null).filter(i=>i!=null),charge:h.indexOf('I-charge'),draw:h.indexOf('I-draw'),friend:old};
    });
    await page.goto(url+'/#/puzzles/dynasty/battle/cputable'); await page.reload(); await page.waitForSelector('.is-owner-table');
    await page.waitForSelector('[data-db-coin]'); await page.screenshot({path:path.join(out,'coin.png')});
    await page.locator('[data-db-coin]').click(); assert.match(await page.locator('[data-db-coin-result]').innerText(),/You go first/);
    await page.locator('[data-db-skip]').click();await page.screenshot({path:path.join(out,'before-drag.png')});
    const snapshot=()=>page.evaluate(async()=>{const x=(await import('/js/core/dynasty-solo.js')).get('cputable');return JSON.parse(JSON.stringify(x.G));});
    const client=await ctx.newCDPSession(page);
    async function drag(from,to,{outside=false,cancel=false,browseFrom=null}={}) {
      const a=await page.locator(from).boundingBox(), b=to?await page.locator(to).first().boundingBox():null;
      assert.ok(a,from); const x=a.x+a.width*.5,y=a.y+a.height*.35;
      const start=browseFrom?await page.locator(browseFrom).boundingBox():a;
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+start.width*.5,y:start.y+start.height*.35}]}); await page.waitForTimeout(400);
      assert.equal(await page.locator('.db-hand-pop').count(),1,'holding lifts just the card');
      assert.equal(await page.locator('.db-peek,.db-focus').count(),0,'holding a hand card never opens details');
      if(browseFrom) {
        const original=await page.locator('.db-hand-pop').getAttribute('data-card'), before=await snapshot();
        await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
        assert.equal(await page.locator(from).evaluate(el=>el.classList.contains('is-held')),true,'sliding selects the card under the finger');
        assert.notEqual(await page.locator('.db-hand-pop').getAttribute('data-card'),original,'sliding updates the large preview');
        assert.equal(await page.locator('.db-drag-ghost').count(),0,'browsing stays a preview');
        assert.deepEqual(await snapshot(),before,'browsing never plays a card');
        await page.screenshot({path:path.join(out,'hand-browse.png')});
      }
      if(cancel){await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});return;}
      const tx=outside?6:b.x+b.width/2,ty=outside?6:b.y+b.height/2;
      for(let step=1;step<=8;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*step/8,y:y+(ty-y)*step/8}]});
      await page.waitForTimeout(60);
      if(!outside)assert.equal(await page.locator('.is-drop-over').count(),1,'legal destination glows');
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(600);
    }
    for(const height of [812,667]) {
      await page.setViewportSize({width:375,height});
      await drag(`[data-db-hand="${fixture.players[0]}"]`,'[data-db-drop="active"]',{browseFrom:`[data-db-hand="${fixture.charge}"]`,cancel:true});
      assert.equal(await page.locator('.db-peek,.db-hand-pop,.db-drag-ghost,.is-held').count(),0,'cancel clears browsing');
      const card=page.locator(`[data-db-hand="${fixture.players[0]}"]`), bb=await card.boundingBox(), before=await snapshot();
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bb.x+bb.width/2,y:bb.y+bb.height*.35}]});
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.db-hand-pop').count(),1);
      assert.ok(await page.locator('.is-drop-ready').count(),'legal spaces glow while held');
      assert.equal(await page.locator('.db-peek,.db-focus').count(),0);
      const pop=await page.locator('.db-hand-pop').boundingBox();
      assert.ok(pop.y>=0 && pop.x>=0 && pop.x+pop.width<=375 && pop.y+pop.height<bb.y+bb.height,'lifted card stays on screen and above the hand');
      await page.screenshot({path:path.join(out,`hand-pop-${height}.png`)});
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(600);
      assert.equal(await page.locator('.db-hand-pop,.db-focus,.is-drop-ready').count(),0,'release returns card without opening details');
      assert.deepEqual(await snapshot(),before,'hold and release do not play a card');
      await card.tap(); await page.waitForSelector('.sheet.db-focus .pk-info');
      assert.equal(await page.locator('[data-db-putback]').count(),0,'no Put back: the details sheet closes');
      await page.locator('.sheet.db-focus [data-sheet-close]').click(); await page.waitForSelector('.sheet.db-focus',{state:'detached'});
    }
    await drag(`[data-db-hand="${fixture.players[0]}"]`,'[data-db-drop="active"]',{browseFrom:`[data-db-hand="${fixture.charge}"]`});
    assert.equal(await page.locator('.is-me .is-active [data-db-slot]').count(),1);
    await drag(`[data-db-hand="${fixture.players[1]}"]`,'[data-db-drop="bench"]',{cancel:true});
    assert.equal(await page.locator('.db-peek,.db-hand-pop,.db-drag-ghost').count(),0);
    await drag(`[data-db-hand="${fixture.players[1]}"]`,'[data-db-drop="bench"]',{outside:true});
    assert.equal(await page.locator('.is-me .is-bench [data-db-slot]').count(),0);
    await drag(`[data-db-hand="${fixture.players[1]}"]`,'[data-db-drop="bench"]');
    await page.screenshot({path:path.join(out,'setup.png')});
    await page.locator('[data-db-ready]').click(); await page.waitForTimeout(500);
    let g=await snapshot(); assert.equal(g.cur,0);const oldEn=g.p[0].active.en.length;
    let charge=g.p[0].hand.indexOf('I-charge');
    await drag(`[data-db-hand="${charge}"]`,'.is-me .is-active [data-db-slot]');
    await page.waitForTimeout(1200);g=await snapshot();assert.equal(g.p[0].active.en.length,oldEn+2);
    const beforeDraw=g.p[0].hand.length, draw=g.p[0].hand.indexOf('I-draw');
    await drag(`[data-db-hand="${draw}"]`,'[data-db-drop="play"]');
    await page.waitForTimeout(1200);g=await snapshot();assert.equal(g.p[0].hand.length,beforeDraw+1);
    // A stationary long hold inspects the opponent; it never submits a move.
    const opponent=page.locator('.is-opp .is-active [data-db-slot]'), bb=await opponent.boundingBox(), rev=g.ev.length;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bb.x+bb.width/2,y:bb.y+bb.height/2}]});await page.waitForTimeout(400);
    await page.screenshot({path:path.join(out,'inspect.png')});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForSelector('.db-focus');assert.equal((await snapshot()).ev.length,rev);assert.equal(await page.locator('[data-db-attack]:not(:disabled)').count(),0);
    await page.waitForTimeout(600);await page.locator('.sheet.db-focus [data-sheet-close]').click();await page.waitForSelector('.sheet.db-focus',{state:'detached'});
    await page.screenshot({path:path.join(out,'table.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal page overflow');
    const retained=await snapshot();await page.reload();await page.waitForSelector('.is-owner-table');assert.deepEqual(await snapshot(),retained,'exact saved match replay');
    // Finish unlocks and selection are saved, and failed opens do not advance packs.
    const unlock=await page.evaluate(async()=>{const D=await import('/js/core/dynasty.js');const s=D.mine();s.so.g1=3;s.so.g10=1;D.touch();for(let i=0;i<5;i++)D.open('std');const n=s.table.packs;D.open('bad');return {packs:s.table.packs,same:n===s.table.packs,unlocked:D.tableFinishes().filter(f=>f.unlocked).map(f=>f.id),chosen:D.setTableFinish('wine'),friend:JSON.stringify(s.dk)};});
    assert.equal(unlock.same,true);assert.ok(unlock.unlocked.includes('wine'));assert.equal(unlock.chosen,true);assert.equal(unlock.friend,fixture.friend);
    await page.reload();await page.waitForSelector('.is-owner-table[data-finish="wine"]');
    await page.setViewportSize({width:320,height:667});await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'small-phone.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(out,'desktop.png')});
    await page.locator('.is-me .is-active [data-db-slot]').click();
    await page.locator('[data-db-attack="2"]').click();await page.waitForSelector('[data-db-coin]');
    const combat=await snapshot(), attack=combat.ev.find(e=>e.k==='attack'&&e.who===0);
    assert.ok(attack && typeof attack.heads==='boolean');
    await page.locator('[data-db-coin]').click();
    assert.match(await page.locator('[data-db-coin-result]').innerText(),attack.heads?/heads/:/tails/);
    assert.deepEqual((await snapshot()).ev.find(e=>e.k==='attack'&&e.who===0),attack,'revealing never rerolls');
    await page.locator('[data-db-skip]').click();
    // Full deterministic matches at every ladder level, replayed from the same seed and legal moves.
    const simulations=await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),B=await import('/js/core/dynasty-battle.js'),S=await import('/js/core/dynasty-solo.js'),T=await import('/js/core/dynasty-table.js');
      let count=0, draws=0;
      for(let n=1;n<=30;n++)for(let rep=0;rep<2;rep++){
        const decks=[D.tableDeck().ids,T.cpuDeck(S.deckFor('g'+n,S.mainType(D.tableDeck().ids)),D.CARDS.map(c=>c.id))];
        if(decks[1].length!==40)throw Error('CPU needs 40 cards at '+n);
        const counts={};for(const id of decks[1]){counts[id]=(counts[id]||0)+1;if(counts[id]>2)throw Error('CPU duplicate limit at '+n);}
        const seed='complete-'+n+'-'+rep,g=B.newGame(seed,decks,6),log=[];
        for(let step=0;step<1500&&g.phase!=='over';step++){
          const w=B.toMove(g),m=S.nextMove(g,w,w===0?'exp':n),r=B.play(g,w,m);if(!r.ok)throw Error('Invalid CPU move '+n+': '+r.why);log.push([w,m]);
        }
        if(g.phase!=='over')throw Error('match stalled');
        if(g.over.win>=0&&g.p[g.over.win].pts!==3)throw Error('match ended before three KOs');
        if(g.over.win<0)draws++;
        const replay=B.newGame(seed,decks,6);for(const[w,m]of log){if(!B.play(replay,w,m).ok)throw Error('replay rejected');}
        if(JSON.stringify(replay)!==JSON.stringify(g))throw Error('non-deterministic replay');count++;
      }
      return {count,draws};
    });
    assert.equal(simulations.count,60);console.log('PASS complete ladder matches and deterministic replays:',simulations);
    await page.evaluate(async()=>{const app=await import('/js/app.js');await app.nav('/puzzles/dynasty');});
    if(await page.locator('.pk-start').count())await page.locator('.pk-start').click();
    await page.locator('.pk-tab[data-dy-tab="decks"]').click();await page.locator('.rd-tile.is-active').click();await page.locator('[data-rd-edit]').click();
    await page.waitForSelector('[data-rt-save]');assert.equal(await page.locator('[data-rt-save]').isDisabled(),false);await page.locator('[data-rt-save]').click();
    await page.waitForTimeout(500);
    const savedDeck=await page.evaluate(async()=>{const D=await import('/js/core/dynasty.js');const s=D.mine();return {saved:s.table.deck,clean:D.clean(s).table.deck};});
    assert.equal(savedDeck.saved.length,40);assert.deepEqual(savedDeck.saved,savedDeck.clean);
    assert.deepEqual(errors,[]);
    console.log('PASS owner touch browser: setup drag, cancel, invalid drop, energy, draw, inspect, reload, finishes, deck editor, responsive layout');
    // Baseline scopes use separate pages/storage and no owner-only state.
    for(const profile of ['ryan-stewart','mason','guest','visitor']){
      const c=await browser.newContext({serviceWorkers:'block'});await c.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
      await c.addInitScript(p=>{localStorage.setItem('gg-me',p==='mason'?'mason':'none');if(p==='ryan-stewart')localStorage.setItem('gg-guest','Ryan Stewart');if(p==='guest')localStorage.setItem('gg-guest','Evan Appenzeller');localStorage.setItem('gg-welcome','1');},profile);
      const q=await c.newPage();await q.goto(url+'/#/puzzles');await q.waitForFunction(()=>window.__ggBooted);
      const result=await q.evaluate(async()=>{const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');await D.load();if(!D.mayPlay())return {owner:D.tableOpen(),plays:false};const s=D.mine();D.open('start',{free:false});const r=S.start('g1');return {owner:D.tableOpen(),plays:true,ok:r.ok,v:r.ok?S.get(r.mid).G.v:0,table:s.table||null};});
      assert.equal(result.owner,false,profile);if(profile==='ryan-stewart'){assert.equal(result.ok,true);assert.equal(result.v,5);assert.equal(result.table,null);}else assert.equal(result.plays,false);
      await c.close();
    }
    console.log('PASS scope: Ryan keeps v5/20 cards, other members/guests/visitors unchanged, typed owner name does not unlock');
    await ctx.close();
  } finally { await browser.close(); }
}
(async()=>{await rules();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await browserTest('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
