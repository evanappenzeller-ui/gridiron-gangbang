// Real offline browser checks for the v7 duel and deck builder. Firebase is removed
// from the served HTML and external requests are blocked: no production reads/writes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const shots = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
if (shots) fs.mkdirSync(shots, {recursive:true});
function serve() {
  const server = http.createServer((req,res) => {
    let file;
    try { const u = new URL(req.url,'http://127.0.0.1'); file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname)); }
    catch {res.writeHead(400).end();return;}
    if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    fs.readFile(file,(err,bytes)=>{
      if(err){res.writeHead(404).end();return;}
      if(file.endsWith('index.html')) bytes=Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
    });
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}
const state = page => page.evaluate(async()=>{const S=await import('/js/core/dynasty-solo.js');const x=S.current();return x?{mid:x.mid||x.id,state:x.state,G:x.G}:null;});
async function settled(page) {
  for (let attempt=0;attempt<450;attempt++) {
    const x=await state(page);
    if (!x || ['setup','yours','over'].includes(x.state)) return;
    await page.waitForTimeout(100);
  }
  throw Error('CPU decision did not finish');
}
async function fit(page,width,stage) {
  await page.setViewportSize({width,height:width===320?568:844});
  await page.waitForTimeout(120);
  const measurement=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,
    body:[...document.querySelectorAll('.rp-battle,.rp-arena,.rp-top,.rp-field,.pocket-decks,.pd-editor,.sheet')].map(el=>({cls:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))}));
  assert(measurement.page<=measurement.viewport+1,`${stage} page fits ${width}: ${JSON.stringify(measurement)}`);
  assert(measurement.body.every(b=>b.left>=-1&&b.right<=width+1),`${stage} containers fit ${width}: ${JSON.stringify(measurement)}`);
  if(await page.locator('.rp-arena').count()) {
    const layout=await page.evaluate(()=>{
      const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      return {opBench:box('.rp-side.is-opponent .rp-bench'),opActive:box('.rp-side.is-opponent .rp-active'),
        active:box('.rp-side.is-mine .rp-active'),bench:box('.rp-side.is-mine .rp-bench'),hand:box('.rp-hand'),
        rows:[...document.querySelectorAll('.rp-bench')].map(el=>[...el.children].map(slot=>{const r=slot.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height};})),
        handCards:[...document.querySelectorAll('.rp-hand [data-rp-hand]')].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}),height:innerHeight};
    });
    assert(layout.opBench.y<layout.opActive.y&&layout.opActive.y<layout.active.y&&layout.active.y<layout.bench.y&&layout.bench.y<layout.hand.y,
      `${stage} face-to-face board order at ${width}: ${JSON.stringify(layout)}`);
    assert(Math.abs(layout.active.x-width/2)<2,`${stage} arena stays centered after hand interactions at ${width}`);
    assert(Math.abs(layout.opActive.x-layout.active.x)<25,`${stage} Active athletes face each other on the centerline`);
    for(const row of layout.rows) {
      assert.equal(row.length,3,`${stage} keeps three Bench slots`);
      assert(row.every(r=>r.width>=44&&r.height>=44),`${stage} Bench slots remain tappable at ${width}`);
      assert(row[0].x<row[1].x&&row[1].x<row[2].x&&Math.max(...row.map(r=>r.y))-Math.min(...row.map(r=>r.y))<6,
        `${stage} Bench remains a horizontal row at ${width}`);
    }
    assert(layout.handCards.some(c=>c.top<layout.height-35&&c.bottom>0),`${stage} hand is visible without scrolling at ${width}`);
    // Both scoreboards stay visible: nothing (the fanned hand, the Bench, the menu) covers them.
    const boards=await page.evaluate(()=>[...document.querySelectorAll('.rp-manager')].map(el=>{
      const r=el.getBoundingClientRect(),pts=[[r.left+4,r.top+4],[r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4],[r.left+r.width/2,r.top+r.height/2]];
      return {cls:el.className,inside:r.left>=-1&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight,clear:pts.every(([x,y])=>el.contains(document.elementFromPoint(x,y)))};
    }));
    assert.equal(boards.length,2);
    for(const b of boards)assert(b.inside&&b.clear,`${stage} ${b.cls} scoreboard is fully visible at ${width}: ${JSON.stringify(boards)}`);
  }
  if(shots) await page.screenshot({path:path.join(shots,`${stage}-${width}.png`)});
}
// A fanned card's center can be covered by its neighbor. Tap an actually exposed
// part of the card, just as a player does, while retaining keyboard setup below.
async function tapHandCard(page,index) {
  const hit=await page.evaluate(index=>{
    const card=document.querySelector(`.rp-hand [data-rp-hand="${index}"]`),r=card.getBoundingClientRect();
    for(let y=Math.max(0,r.top)+8;y<Math.min(innerHeight,r.bottom)-4;y+=8)
      for(let x=Math.max(0,r.left)+8;x<Math.min(innerWidth,r.right)-4;x+=8)
        if(document.elementFromPoint(x,y)?.closest('[data-rp-hand]')===card)return {x,y};
    return null;
  },index);
  assert(hit,`fanned hand card ${index} has an exposed pointer target`);
  await page.mouse.click(hit.x,hit.y);
}
async function gameSnapshot(page) {
  return page.evaluate(async()=>JSON.stringify((await import('/js/core/dynasty-solo.js')).get(window.__pocketMid).G));
}
async function closeSheet(page) {
  const close=page.locator('.sheet .sheet-close').last();if(await close.count()) await close.click();
  await page.waitForFunction(()=>!document.querySelector('.sheet'));
}
async function run(url) {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
    await ctx.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
    await ctx.addInitScript(()=>{
      if(!localStorage.getItem('gg-me')) localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');sessionStorage.setItem('gg-skip-title','1');
      ['evan','mason','user%3Aryan-stewart','visitor'].forEach(k=>localStorage.setItem('gg-release-3.0:'+k,'1'));
      localStorage.setItem('gg-rivals-music:m_evan:v1',JSON.stringify({on:false,level:0}));
      localStorage.setItem('gg-rivals-sfx:m_evan:v1',JSON.stringify({on:false,level:0}));
    });
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e.stack||e)));
    await page.goto(url+'/#/puzzles');
    await page.waitForFunction(()=>window.__ggBooted,null,{timeout:30000});
    assert.equal(await page.evaluate(async()=>(await import('/js/core/fire.js')).canWrite()),false,'production writes disabled');
    const initial=await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),C=await import('/js/core/dynasty-pocket-cards.js'),S=await import('/js/core/dynasty-solo.js');
      await D.load(); const selected=D.usePocketDeck('rental'); if(!selected.ok) throw Error(selected.why);
      let r;
      // A deterministic feature assertion needs an optional Bench choice. Choose a
      // naturally dealt opening with two Bases; this never edits a game's hand.
      for(let n=0;n<30;n++) {r=S.start('g1');if(!r.ok)throw Error(r.why);if(S.get(r.mid).G.p[0].hand.filter(id=>C.card(id)?.stage==='Base').length>=2)break;}
      window.__pocketMid=r.mid; const x=S.get(r.mid);
      await (await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+r.mid);
      return {mid:r.mid,hand:x.G.p[0].hand,bases:x.G.p[0].hand.map((id,i)=>C.card(id)?.stage==='Base'?i:-1).filter(i=>i>=0)};
    });
    assert(initial.bases.length>=2,'opening with an Active and optional Bench athlete');
    await page.waitForSelector('.rp-battle [data-rp-ready]');
    assert(await page.locator('[data-rp-ready]').isDisabled(),'manager must choose opening Active');
    assert.equal(await page.locator('.rp-side.is-opponent [data-rp-slot]').count(),0,'opposing setup remains face down');
    for(const width of [390,320])await fit(page,width,'setup');
    await page.setViewportSize({width:390,height:844});
    const beforeVisualControls=await gameSnapshot(page);
    await page.locator('[data-rp-expand-hand]').click();
    assert.equal(await page.locator('.rp-sheet [data-rp-hand]').count(),initial.hand.length,'expanded hand makes every card accessible');
    await closeSheet(page);
    await page.locator('[data-rp-menu]').click();
    for(const selector of ['[data-rp-log]','[data-rp-table]','[data-rp-settings]','[data-rp-concede]'])
      assert(await page.locator('.rp-sheet '+selector).isVisible(),`battle menu preserves ${selector}`);
    await page.locator('.rp-sheet [data-rp-log]').click();
    await page.waitForSelector('.rp-log');await closeSheet(page);
    assert.equal(await gameSnapshot(page),beforeVisualControls,'hand and menu inspection do not alter the match');
    await page.locator(`.rp-hand [data-rp-hand="${initial.bases[0]}"]`).focus();await page.keyboard.press('Enter');
    await page.waitForSelector('[data-rp-place="active"]');
    await page.locator('[data-rp-place="active"]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!document.querySelector('.sheet'));
    await tapHandCard(page,initial.bases[1]);
    await page.locator('[data-rp-place="bench"]').click();
    await page.waitForFunction(()=>!document.querySelector('.sheet'));
    await page.locator('[data-rp-ready]').click();await settled(page);
    assert.equal(await page.locator('.rp-side.is-opponent [data-rp-hand]').count(),0,'no opponent hand cards in DOM');
    assert.equal(await page.locator('.rp-opponent-hand [data-rp-hand],.rp-opponent-hand [data-rp-slot]').count(),0,'opponent hand contains no inspectable identities');
    const publicCounts=await page.evaluate(async()=>{const G=(await import('/js/core/dynasty-solo.js')).get(window.__pocketMid).G;return {deck:G.p[1].deck.length,hand:G.p[1].hand.length};});
    assert.match(await page.locator('.rp-deck.is-opponent').getAttribute('aria-label'),new RegExp(`\\b${publicCounts.deck}\\b`),'opponent deck shows its public count');
    assert.match(await page.locator('.rp-opponent-hand').getAttribute('aria-label'),new RegExp(`\\b${publicCounts.hand}\\b`),'opponent hand shows only its public count');
    let attachments=0,attacks=0,turns=0;
    for(let step=0;step<24&&turns<6;step++) {
      await settled(page);
      const move=await page.evaluate(async()=>{
        const S=await import('/js/core/dynasty-solo.js'),B=await import('/js/core/dynasty-pocket.js');const x=S.get(window.__pocketMid);
        if(x.state==='over')return null;
        const legal=B.legalActions(x.G,0),m=legal.find(m=>m.a==='promote'||m.a==='choose-switch')
          ||legal.find(m=>m.a==='energy'&&m.on===x.G.p[0].active?.u)||legal.find(m=>m.a==='attack')||legal.find(m=>m.a==='end');
        return m?{...m,active:x.G.p[0].active?.u}:null;
      });
      if(!move)break;
      if(move.a==='energy'||move.a==='attack') {
        if(move.a==='energy') {
          const before=await page.evaluate(async()=>(await import('/js/core/dynasty-solo.js')).get(window.__pocketMid).G.p[0].used.energy);
          assert(!before,'Energy is still available before the drag');
          if(attachments===0) {
            // A pointer tap only explains the gesture; it never opens a chooser or attaches.
            await page.locator('[data-rp-energy]').click();
            assert.equal(await page.locator('.rp-sheet').count(),0,'tapping the Energy Zone does not open a chooser');
            await page.locator(`[data-rp-slot="${move.on}"][data-rp-side="0"]`).click();await page.waitForSelector('.rp-preview');
            assert.equal(await page.locator('.rp-preview button').filter({hasText:/Attach/}).count(),0,'the card preview offers no Attach Energy button');
            // Details keeps the full card sheet, which offers no Attach Energy button either.
            await page.locator('[data-rp-preview-details]').click();await page.waitForSelector('.rp-sheet');
            assert.equal(await page.locator('.rp-preview').count(),0,'opening details sets the preview down');
            assert.equal(await page.locator('.rp-sheet [data-rp-move]').filter({hasText:/^Attach /}).count(),0,'card details offer no Attach Energy button');
            await page.locator('.sheet .sheet-close').last().click();await page.waitForFunction(()=>!document.querySelector('.sheet'));
          }
          if(attachments===1) {
            // Keyboard managers keep an accessible route through the Energy Zone.
            await page.locator('[data-rp-energy]').focus();await page.keyboard.press('Enter');
            await page.locator('.rp-sheet [data-rp-move]').filter({hasText:/^Attach /}).first().click();
          } else {
            const zone=await page.locator('[data-rp-energy]').boundingBox(),slot=await page.locator(`[data-rp-slot="${move.on}"][data-rp-side="0"]`).boundingBox();
            const from={x:zone.x+zone.width/2,y:zone.y+zone.height/3},to={x:slot.x+slot.width/2,y:slot.y+slot.height/2};
            await page.mouse.move(from.x,from.y);await page.mouse.down();
            for(let i=1;i<=10;i++)await page.mouse.move(from.x+(to.x-from.x)*i/10,from.y+(to.y-from.y)*i/10);
            assert(await page.locator('.rp-energy-ghost').count(),'dragging lifts an Energy orb');
            assert(await page.locator(`[data-rp-slot="${move.on}"].is-drop-valid`).count(),'eligible athletes highlight during the drag');
            await page.mouse.up();
            assert.equal(await page.locator('.rp-energy-ghost').count(),0,'dropping removes the Energy ghost');
          }
          await page.waitForFunction(async()=>(await import('/js/core/dynasty-solo.js')).get(window.__pocketMid).G.p[0].used.energy||(await import('/js/core/dynasty-solo.js')).get(window.__pocketMid).state!=='yours');
          attachments++;
        } else {
          await page.locator(`[data-rp-slot="${move.active}"][data-rp-side="0"]`).click();await page.waitForSelector('.rp-preview');
          await page.locator('.rp-preview [data-rp-preview-act]:not([disabled])').first().click();
          await page.waitForFunction(()=>!document.querySelector('.rp-preview'));
          attacks++;turns++;
        }
      } else if(move.a==='promote'||move.a==='choose-switch') await page.locator('[data-rp-choice]').first().click();
      else {await page.locator('[data-rp-end]').click();turns++;}
    }
    assert(attachments>=3,`manual attachments executed: ${attachments}`);
    assert(attacks>=1,`attacks executed: ${attacks}`);
    await settled(page);
    for(const width of [320,390])await fit(page,width,'battle');
    const saved=await page.evaluate(async()=>{
      const S=await import('/js/core/dynasty-solo.js'),x=S.get(window.__pocketMid);
      return {mid:window.__pocketMid,state:JSON.stringify(x.G),collection:JSON.stringify((await import('/js/core/dynasty.js')).mine().o)};
    });
    await page.reload();await page.waitForSelector('.rp-arena .rp-manager');await settled(page);
    assert.equal(await page.evaluate(async mid=>JSON.stringify((await import('/js/core/dynasty-solo.js')).get(mid).G),saved.mid),saved.state,'reload replays identical v7 state');
    assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/core/dynasty.js')).mine().o)),saved.collection,'battle never consumes collection cards');
    await page.locator('[data-rp-help]').click();await page.waitForSelector('.rp-rules');
    assert.match(await page.locator('.rp-sheet').innerText(),/First to at least three|Score three knockout points/);
    await closeSheet(page);
    console.log('PASS v7 battle: keyboard/touch setup, arena Energy, attacks, hidden hand, menus, replay and 320/390 portrait layouts');

    await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),C=await import('/js/core/dynasty-pocket-cards.js');
      // Local-only collection fixture gives the builder two real, owned athletes.
      for(const name of ['Patrick Mahomes','Justin Jefferson']){const c=C.allCards().find(c=>!c.rentalOnly&&c.stage==='Base'&&c.athlete===name);if(!c)throw Error('Missing '+name);D.mine().o[c.id]=2;}
      await(await import('/js/app.js')).nav('/puzzles/dynasty');
    });
    if(await page.locator('.pk-start').count()){await page.waitForSelector('.pk-start.is-ready');await page.locator('.pk-start').focus();await page.keyboard.press('Enter');}
    await page.locator('.pk-nav [data-dy-tab="decks"]').click();await page.waitForSelector('.pocket-decks');
    for(const width of [390,320])await fit(page,width,'decks');
    await page.locator('[data-pd-new]').click();await page.waitForSelector('.pd-editor');
    await page.locator('[data-pd-name]').fill('Browser QA deck');
    await page.locator('[data-pd-auto]').click();
    assert.match(await page.locator('[data-pd-count]').innerText(),/^20\/20 · Ready/);
    for(const width of [320,390])await fit(page,width,'builder');
    await page.locator('[data-pd-minus="P7-film"]').click();
    assert.match(await page.locator('[data-pd-count]').innerText(),/^19\/20/);
    await page.locator('[data-pd-plus="P7-film"]').click();
    assert(await page.locator('[data-pd-plus="P7-film"]').isDisabled(),'canonical two-copy limit visible');
    await page.locator('[data-pd-energy="Water"]').check();await page.locator('[data-pd-energy="Grass"]').check();
    assert(await page.locator('[data-pd-energy="Metal"]').isDisabled(),'at most three Energy types');
    await page.locator('[data-pd-energy="Water"]').uncheck();await page.locator('[data-pd-energy="Grass"]').uncheck();
    await page.locator('[data-pd-save]').click();await page.waitForFunction(()=>!document.querySelector('.sheet'));
    const deck=await page.evaluate(async()=>(await import('/js/core/dynasty.js')).pocketLoadouts().find(d=>d.name==='Browser QA deck'));
    assert(deck&&deck.ids.length===20,'builder saves exact20');
    await page.locator(`[data-pd-deck="${deck.id}"]`).click();await page.locator('[data-pd-use]').click();
    await page.waitForFunction(()=>!document.querySelector('.sheet'));
    assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty.js')).pocketDeck().id),deck.id,'builder selection used for new battles');
    await page.reload();await page.waitForSelector('.pk-start.is-ready');await page.locator('.pk-start').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('.pk-start'));
    await page.locator('.pk-nav [data-dy-tab="decks"]').click();await page.waitForSelector('.pocket-decks');
    assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty.js')).pocketDeck().id),deck.id,'selected deck survives reload');
    await page.locator(`[data-pd-deck="${deck.id}"]`).click();await page.locator('[data-pd-edit]').click();await page.waitForSelector('.pd-editor');
    await page.evaluate(async()=>(await import('/js/core/data.js')).setMe('mason'));
    await page.waitForFunction(()=>!document.querySelector('.pd-editor,.pocket-decks'));
    assert.equal(await page.locator('.rp-battle,.pocket-decks,.pd-editor,.rp-sheet').count(),0,'profile switch closes editor and Rivals');
    const gate=await page.evaluate(async()=>{const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');return {select:D.usePocketDeck('rental').ok,start:S.start('g1').ok};});
    assert.deepEqual(gate,{select:false,start:false},'ineligible profile cannot call v7 mutations');
    await page.evaluate(async()=>{const d=await import('/js/core/data.js');d.setMe('evan');});
    // __pocketMid is intentionally absent after reload: navigate with the retained ID.
    await page.evaluate(async mid=>{await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+mid);},saved.mid);
    await page.waitForSelector('.rp-arena .rp-manager');
    assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty.js')).pocketDeck().id),deck.id,'profile return preserves saved selected deck');
    assert.deepEqual(errors,[],'no browser exceptions');
    console.log('PASS v7 decks: owned20, edit/save/select/reload, Energy settings, keyboard and profile gate');
    await ctx.close();
  } finally {await browser.close();}
}
(async()=>{const server=await serve();try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
