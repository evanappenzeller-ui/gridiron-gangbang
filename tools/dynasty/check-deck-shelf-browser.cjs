// Offline browser flow: v7 create/edit/select, saved v6 replay, immutable legacy decks, reload and profile boundaries.
// Historical themed-deck mechanics remain covered by check-deck-shelf.cjs.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let pw;try{pw=require('playwright')}catch{pw=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/rivals-decks');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();if(p.endsWith('index.html'))b=Buffer.from(b.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'}).end(b)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  await ctx.addInitScript(()=>{if(!localStorage.getItem('gg-me'))localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');sessionStorage.setItem('gg-skip-title','1');['evan','jayton','mason','user%3Aryan-stewart','visitor'].forEach(k=>localStorage.setItem('gg-release-3.0:'+k,'1'))});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url+'/#/puzzles');await page.waitForFunction(()=>window.__ggBooted);
  const legacy = await page.evaluate(async()=>{
    const D=await import('/js/core/dynasty.js'),B=await import('/js/core/dynasty-battle.js'),T=await import('/js/core/dynasty-table.js');
    await D.load();if((await import('/js/core/fire.js')).canWrite())throw Error('live writes enabled');
    const s=D.mine();D.CARDS.forEach(c=>s.o[c.id]=2);Object.keys(B.TRAINERS).forEach(id=>s.o[id]=2);s.dk=D.autoDeck(s.o);
    const recipe=D.themedDeck('KC');if(!recipe.ok)throw Error(recipe.why);D.setTableDeck(recipe.ids);D.touch();
    const record={id:'cpulegacydeck',opp:'g1',seed:'legacy-deck-shelf-v6',v:6,decks:[recipe.ids.slice(),T.cpuDeck(s.dk,D.CARDS.map(c=>c.id))],log:[],at:Date.now(),z:'',paid:0,pay:null,roundEnergy:2,chemistry:{v:1,team:'KC'}};
    const G=B.newGame(record.seed,record.decks,6,record.chemistry,record.roundEnergy),bases=G.p[1].hand.filter(id=>B.basicIn(id,6));
    const setup={a:'setup',act:bases[0],bench:bases.slice(1,4)};if(!B.play(G,1,setup).ok)throw Error('Invalid legacy setup fixture');record.log.push([1,setup]);
    localStorage.setItem('gg-dys-m_evan',JSON.stringify(record));
    return {table:JSON.stringify(s.table),collection:JSON.stringify(s.o),mid:record.id,record:JSON.stringify(record),themes:D.deckThemes().length};
  });
  assert.equal(legacy.themes,16,'legacy themed recipes remain available to saved rules');
  await page.reload();await page.waitForFunction(()=>window.__ggBooted);
  const open=async()=>{await page.evaluate(async()=>{await(await import('/js/app.js')).nav('/puzzles/dynasty')});if(await page.locator('.pk-start').count()){await page.waitForSelector('.pk-start.is-ready');await page.locator('.pk-start').click({position:{x:170,y:420}})}await page.locator('.pk-tab[data-dy-tab="decks"]').click();await page.waitForSelector('.pocket-decks')};
  const close=async()=>{await page.locator('.sheet-close').last().click();await page.waitForFunction(()=>!document.querySelector('.sheet'))};
  await open();
  assert.equal(await page.locator('[data-pd-deck]').count(),2,'rental and collection loadout');
  assert.equal(await page.locator('[data-rd-theme],.rd-chem-tag').count(),0,'new decks have no automatic team or position bonus');
  assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/core/dynasty.js')).mine().table)),legacy.table,'viewing v7 shelf preserves legacy deck');
  const beforeControls=await page.evaluate(async()=>JSON.stringify((await import('/js/core/dynasty.js')).mine()));
  await page.getByRole('button',{name:'Deck-building help'}).focus();await page.keyboard.press('Enter');
  await page.waitForSelector('.pocket-deck-sheet');assert.match(await page.locator('.pd-detail').innerText(),/Exactly 20 cards/);await close();
  await page.getByRole('button',{name:'Edit',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-pd-edit-mode]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-pd-deck]:not([data-pd-deck="rental"])').first().click();await page.waitForSelector('[data-pd-name]');await close();
  await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.locator('[data-pd-edit-mode]').getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/core/dynasty.js')).mine())),beforeControls,'opening help/edit and cancelling never alters a save');
  await page.evaluate(async mid=>{await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+mid)},legacy.mid);
  await page.waitForSelector('.db');
  assert.equal(await page.evaluate(async mid=>(await import('/js/core/dynasty-solo.js')).get(mid).G.v,legacy.mid),6,'saved v6 keeps its engine and screen');
  assert.equal(await page.evaluate(()=>localStorage.getItem('gg-dys-m_evan')),legacy.record,'opening legacy match does not rewrite its record');
  await open();
  await page.locator('[data-pd-new]').click();await page.locator('[data-pd-name]').fill('Sunday Squad');await page.locator('[data-pd-auto]').click();
  assert.match(await page.locator('[data-pd-count]').innerText(),/^20\/20 · Ready/);
  await page.locator('[data-pd-save]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-pd-deck]').length===3);
  await page.getByRole('button',{name:/Sunday Squad,/}).click();await page.locator('[data-pd-use]').click();await page.waitForFunction(()=>document.querySelector('.pd-deck.is-active')?.textContent.includes('Sunday Squad'));
  await page.locator('.pd-deck.is-active').click();await page.locator('[data-pd-edit]').click();await page.locator('[data-pd-name]').fill('Sunday Starters');
  await page.locator('[data-pd-energy="Water"]').check();await page.locator('[data-pd-save]').click();await page.waitForFunction(()=>document.querySelector('.pd-deck.is-active')?.textContent.includes('Sunday Starters'));
  const snapshot=await page.evaluate(async()=>{const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');const r=S.start('g1');if(!r.ok)throw Error(r.why);const record=JSON.parse(localStorage.getItem('gg-dys-m_evan'));return{pocket:JSON.stringify(D.mine().pocket),table:JSON.stringify(D.mine().table),collection:JSON.stringify(D.mine().o),mid:r.mid,record,G:JSON.stringify(S.get(r.mid).G)}});
  assert.equal(snapshot.record.v,7);assert.equal(snapshot.record.decks[0].length,20);assert.equal(snapshot.record.chemistry,undefined);assert.equal(snapshot.record.roundEnergy,undefined);
  assert(snapshot.record.energy[0].includes('Water'),'selected Energy Zone is saved');assert.equal(snapshot.table,legacy.table);assert.equal(snapshot.collection,legacy.collection);
  await page.reload();await page.waitForFunction(()=>window.__ggBooted);await open();
  const restored=await page.evaluate(async()=>{const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');return{pocket:JSON.stringify(D.mine().pocket),table:JSON.stringify(D.mine().table),G:JSON.stringify(S.current().G)}});
  assert.equal(restored.pocket,snapshot.pocket);assert.equal(restored.table,legacy.table);assert.equal(restored.G,snapshot.G,'reloaded v7 state is identical');
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await page.locator('[data-pd-new]').scrollIntoViewIfNeeded();const metrics=await page.evaluate(()=>{const grid=document.querySelector('.pd-shelf'),a=grid.children[0].getBoundingClientRect(),b=grid.children[1].getBoundingClientRect();return{columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth,sameRow:Math.abs(a.top-b.top)<2}});assert.equal(metrics.overflow,false);assert.equal(metrics.sameRow,true);assert.equal(metrics.columns,width>=650?3:2);if(width!==320)await page.screenshot({path:path.join(out,'decks-'+width+'.png')});}
  await page.setViewportSize({width:390,height:844});
  const showcase=await page.evaluate(async()=>{
    const D=await import('/js/core/dynasty.js'),C=await import('/js/core/dynasty-pocket-cards.js'),s=D.mine();
    const support=C.rentalDeck().ids.filter(id=>C.card(id)?.kind!=='player');
    return ['Fire','Water','Grass','Lightning','Psychic','Fighting'].map(type=>{
      const players=C.availableCards(s.o).filter(c=>c.kind==='player'&&c.stage==='Base'&&c.types.includes(type))
        .sort((a,b)=>Number(String(D.card(b.sourceId)?.head).startsWith('a:'))-Number(String(D.card(a.sourceId)?.head).startsWith('a:'))||(D.card(b.sourceId)?.o||0)-(D.card(a.sourceId)?.o||0)).slice(0,4);
      const ids=[...players.flatMap(c=>[c.id,c.id]),...support],r=D.savePocketDeck({name:type+' lineup',ids,energy:[type]});
      if(!r.ok)throw Error(r.why);return {id:r.id,type};
    });
  });
  await open();
  for(const {id,type} of showcase){const tile=page.locator(`[data-pd-deck="${id}"]`);assert.equal(await tile.getAttribute('data-deck-energy'),type);assert(await tile.locator('.pd-box-front .pk-card').count(),'deck cover uses the actual printed card');assert.match(await tile.getAttribute('aria-label'),new RegExp(type+' Energy'));}
  await page.evaluate(id=>{const tile=document.querySelector(`[data-pd-deck="${id}"]`),pane=tile.closest('.pk-pane');pane.scrollTop+=tile.getBoundingClientRect().top-pane.getBoundingClientRect().top-10},showcase[0].id);
  await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'energy-decks-390.png')});
  await page.locator('[data-pd-deck="rental"]').click();assert.equal(await page.locator('[data-pd-edit]').count(),0,'fixed rental cannot be edited');await page.locator('[data-pd-use]').click();await page.waitForFunction(()=>!document.querySelector('.sheet'));
  assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty.js')).pocketDeck().id),'rental');
  assert.equal(await page.locator('[data-rd-friends]').count(),0,'friend battles remain paused');
  await page.locator('[data-pd-new]').focus();await page.keyboard.press('Enter');await page.waitForSelector('[data-pd-name]');await page.locator('[data-pd-name]').fill('Work in progress');await page.locator('[data-pd-minus="P7-film"]').click();await page.locator('[data-pd-save]').click();
  await page.getByRole('button',{name:/Work in progress,/}).click();assert.equal(await page.locator('[data-pd-use]').isDisabled(),true,'a 19-card draft cannot be selected');await close();
  await page.locator('[data-pd-new]').click();await page.waitForSelector('.pd-editor');
  await page.evaluate(async()=>{(await import('/js/core/data.js')).setMe('jayton')});await page.waitForFunction(()=>!document.querySelector('.pd-editor'));
  assert.equal(await page.evaluate(async()=>{const D=await import('/js/core/dynasty.js');return D.savePocketDeck({name:'Jayton draft',ids:[],energy:['Fire']}).ok}),true);
  await page.reload();await page.waitForFunction(()=>window.__ggBooted);await open();
  assert.equal(await page.getByRole('button',{name:/Sunday Starters,/}).count(),0,'decks stay profile-specific');
  await page.getByRole('button',{name:'Deck-building help'}).click();await page.waitForSelector('.pocket-deck-sheet');
  const other=await page.evaluate(async()=>{const data=await import('/js/core/data.js'),D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');data.setGuest('Ryan Stewart');await D.load();D.usePocketDeck('rental');const r=S.start('g1');return{ok:r.ok,v:S.get(r.mid).G.v}});assert.equal(other.ok,true);assert.equal(other.v,7);
  await page.waitForFunction(()=>!document.querySelector('.pocket-deck-sheet'));
  await page.evaluate(async()=>{const data=await import('/js/core/data.js');data.setGuest('');data.setMe(null)});await page.waitForFunction(()=>!document.querySelector('.pocket-decks'));assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty.js')).tableOpen()),false);
  assert.deepEqual(errors,[]);console.log('PASS v7 phone/tablet shelf, create/edit/select, preserved v6 replay/decks, save/reload, fixed rental, drafts, keyboard and profile boundaries');await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
