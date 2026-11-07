// Real touch input against an offline Rivals fixture. Never reads or writes Firebase.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const width = Number(process.argv.find(a=>a.startsWith('--width='))?.slice(8)) || 390, height = width === 320 ? 568 : 844;
const shots = process.argv.find(a=>a.startsWith('--shots='))?.slice(8);
if (shots) fs.mkdirSync(shots,{recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
async function serve() {
  const server=http.createServer((req,res)=>{
    let file;
    try {const u=new URL(req.url,'http://127.0.0.1');file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));}
    catch {res.writeHead(400).end();return;}
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(err,bytes)=>{
      if(err){res.writeHead(404).end();return;}
      if(file.endsWith('index.html'))bytes=Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server;
}
async function snapshot(page,mid) {
  return page.evaluate(async mid=>JSON.stringify((await import('/js/core/dynasty-solo.js')).get(mid).G),mid);
}
async function settled(page,mid) {
  for(let n=0;n<450;n++) {
    if(await page.evaluate(async mid=>['setup','yours','over'].includes((await import('/js/core/dynasty-solo.js')).get(mid).state),mid))return;
    await page.waitForTimeout(100);
  }
  throw Error('CPU turn did not finish');
}
async function exposed(page,index) {
  const p=await page.evaluate(index=>{
    const c=document.querySelector(`.rp-hand [data-rp-hand="${index}"]`);if(!c)return null;
    const r=c.getBoundingClientRect();
    for(let y=Math.max(0,r.top)+6;y<Math.min(innerHeight,r.bottom)-4;y+=6)
      for(let x=Math.max(0,r.left)+6;x<Math.min(innerWidth,r.right)-4;x+=6)
        if(document.elementFromPoint(x,y)?.closest('[data-rp-hand]')===c)return {x,y};
    return null;
  },index);
  assert(p,`hand card ${index} exposes a touch target`);return p;
}
async function center(page,selector) {
  const r=await page.locator(selector).first().boundingBox();assert(r,`target ${selector} exists`);
  return {x:r.x+r.width/2,y:r.y+r.height/2};
}
async function closeSheet(page) {
  await page.locator('.sheet .sheet-close').last().click();
  await page.waitForFunction(()=>!document.querySelector('.sheet'));
}
async function run(url) {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'});
    await ctx.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
    await ctx.addInitScript(()=>{
      localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');sessionStorage.setItem('gg-skip-title','1');
      ['evan','mason','visitor'].forEach(k=>localStorage.setItem('gg-release-3.0:'+k,'1'));
      for(const kind of ['music','sfx'])localStorage.setItem('gg-rivals-'+kind+':m_evan:v1',JSON.stringify({on:false,level:0}));
    });
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e.stack||e)));
    const cdp=await ctx.newCDPSession(page);
    const touch=async(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{id:1,x:p.x,y:p.y,radiusX:3,radiusY:3,force:1}]:[]});
    const move=async(from,to,steps=8)=>{for(let i=1;i<=steps;i++){await touch('touchMove',{x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps});await page.waitForTimeout(15);}};
    const drag=async(index,target,{hold=false,cancel=false}={})=>{
      const from=await exposed(page,index);await touch('touchStart',from);
      if(hold)await page.waitForTimeout(320);
      await move(from,target);await page.waitForSelector('.rp-drag-ghost');
      await touch(cancel?'touchCancel':'touchEnd');await page.waitForTimeout(180);
      assert.equal(await page.locator('.rp-drag-ghost').count(),0,'finished or cancelled drag removes its ghost');
    };
    await page.goto(url+'/#/puzzles');await page.waitForFunction(()=>window.__ggBooted,null,{timeout:30000});
    assert.equal(await page.evaluate(async()=>(await import('/js/core/fire.js')).canWrite()),false,'production writes disabled');
    const initial=await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),C=await import('/js/core/dynasty-pocket-cards.js'),S=await import('/js/core/dynasty-solo.js');
      await D.load();const selected=D.usePocketDeck('rental');if(!selected.ok)throw Error(selected.why);
      let r,x;
      for(let n=0;n<40;n++){r=S.start('g1');if(!r.ok)throw Error(r.why);x=S.get(r.mid);if(x.G.p[0].hand.filter(id=>C.card(id)?.stage==='Base').length>=2)break;}
      await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+r.mid);
      const hand=x.G.p[0].hand;
      return {mid:r.mid,hand,bases:hand.map((id,i)=>C.card(id)?.stage==='Base'?i:-1).filter(i=>i>=0),cards:hand.map(id=>C.card(id))};
    });
    const mid=initial.mid;
    assert(initial.bases.length>=2,'naturally dealt opening supports Active and Bench');
    await page.waitForSelector('.rp-hand .rp-card-print .pk-card');
    const opening=await snapshot(page,mid),first=initial.bases[0],second=initial.bases[1];
    const start=await exposed(page,0);
    const beforeLift=await page.locator('.rp-hand [data-rp-hand="0"]').boundingBox();
    await touch('touchStart',start);await page.waitForTimeout(360);
    assert(await page.locator('.rp-hand.is-browsing [data-rp-hand="0"].is-held').count(),'holding lifts the selected card');
    const afterLift=await page.locator('.rp-hand [data-rp-hand="0"]').boundingBox();
    assert(afterLift.y<beforeLift.y-5,'held card visibly rises above the hand');
    assert.equal(await page.locator('.sheet').count(),0,'holding does not open a modal');
    const last=await center(page,`.rp-hand [data-rp-hand="${initial.hand.length-1}"]`);
    await move(start,{x:Math.min(width-6,last.x),y:start.y});
    assert.equal(await page.locator('.rp-hand .is-preview').getAttribute('data-rp-hand'),String(initial.hand.length-1),'sliding across the fan previews another card');
    if(shots)await page.screenshot({path:path.join(shots,'touch-fan-preview.png')});
    await touch('touchEnd');await page.waitForTimeout(180);
    assert.equal(await snapshot(page,mid),opening,'hold and slide never play a card');
    assert.equal(await page.locator('.sheet').count(),0,'releasing a browse does not trigger a synthetic tap');

    // A normal touch tap brings the actual printed card into a centered focus view.
    const tap=await exposed(page,first);await touch('touchStart',tap);await page.waitForTimeout(35);await touch('touchEnd');
    await page.waitForSelector('.rp-card-focus .rp-inspect-card .pk-card');
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.rp-card-focus')).opacity)>.99);
    const printed=page.locator('.rp-card-focus .rp-inspect-card .pk-card');
    assert.equal(await printed.locator('.pk-c-face,.pk-c-head,.pk-c-body').count(),3,'inspection uses the actual collection card frame');
    assert.equal((await printed.locator('.pk-c-stage').innerText()).trim().toLowerCase(),'base','printed stage matches the card');
    assert.equal(Number(await printed.locator('.pk-c-hp b').innerText()),initial.cards[first].hp,'printed HP matches v7 balance');
    for(const attack of initial.cards[first].attacks)assert((await printed.innerText()).includes(attack.name),'actual card prints every attack');
    const focusBox=await page.locator('.rp-card-focus').boundingBox();
    assert(Math.abs(focusBox.x+focusBox.width/2-width/2)<24,'focused card modal is horizontally centered');
    assert(focusBox.y<height/2&&focusBox.y+focusBox.height>height/2,'focused card modal spans the center of the screen');
    const hero=await page.locator('.rp-card-focus .rp-inspect-card').boundingBox();
    assert(Math.abs(hero.x+hero.width/2-width/2)<24&&Math.abs(hero.y+hero.height/2-height/2)<30,'the actual card is centered in the viewport');
    if(shots)await page.screenshot({path:path.join(shots,'touch-card-focus.png')});
    await closeSheet(page);assert.equal(await snapshot(page,mid),opening,'tapping to inspect does not mutate the match');

    // Full-card rendering must not borrow Base HP, stage, attacks or point value for Prime.
    const form=await page.evaluate(async()=>{
      const C=await import('/js/core/dynasty-pocket-cards.js'),D=await import('/js/core/dynasty.js'),V=await import('/js/views/dynasty-pocket-card.js');
      const c=C.card('R7-mahomes~prime'),original=D.card(c.sourceId),before=JSON.stringify(original),el=document.createElement('div');
      el.innerHTML=V.printedCard(c.id);
      return {stage:el.querySelector('.pk-c-stage')?.textContent,hp:el.querySelector('.pk-c-hp b')?.textContent,
        attacks:el.querySelector('.pk-c-body')?.textContent,points:el.querySelector('.pk-c-meta')?.textContent,
        expected:{stage:c.stage,hp:c.hp,attack:c.attacks[0].name,points:C.pointValue(c)},unchanged:before===JSON.stringify(original)};
    });
    assert.equal(form.stage.trim().toLowerCase(),form.expected.stage.toLowerCase(),'Prime keeps its printed development stage');
    assert.equal(Number(form.hp),form.expected.hp,'Prime keeps its own HP');
    assert(form.attacks.includes(form.expected.attack),'Prime keeps its own attack');
    assert(form.points.includes(String(form.expected.points)),'Prime prints its knockout value');
    assert(form.unchanged,'battle renderer does not modify collection cards');

    const opponent=await center(page,'.rp-side.is-opponent .rp-active');
    await drag(first,opponent,{hold:true});
    assert.equal(await snapshot(page,mid),opening,'dropping on the opponent does not play a card');
    assert(await page.locator('[data-rp-ready]').isDisabled(),'invalid drop leaves opening Active unchosen');
    assert.equal(await page.locator('.sheet').count(),0,'invalid drag does not open a tap preview');
    const active=await center(page,'.rp-side.is-mine .rp-active');
    await drag(first,active,{cancel:true});
    assert(await page.locator('[data-rp-ready]').isDisabled(),'pointer cancellation never commits the drop');
    assert.equal(await snapshot(page,mid),opening,'pointer cancellation preserves state');

    // Route hiding cancels a live drag before its captured pointer can finish.
    const routeFrom=await exposed(page,first);await touch('touchStart',routeFrom);await move(routeFrom,active);
    await page.waitForSelector('.rp-drag-ghost');
    await page.evaluate(async()=>{await(await import('/js/app.js')).nav('/puzzles');});
    await touch('touchEnd');await page.waitForTimeout(100);
    assert.equal(await page.locator('.rp-drag-ghost').count(),0,'leaving the route cleans up a captured drag');
    await page.evaluate(async mid=>{await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+mid);},mid);
    await page.waitForSelector('.rp-hand');assert.equal(await snapshot(page,mid),opening,'route cancellation preserves the game');

    // Both a held drag and a quick vertical drag can place a legal opening card.
    await drag(first,await center(page,'.rp-side.is-mine .rp-active'),{hold:true});
    assert.equal(await page.locator('.rp-side.is-mine .rp-active [data-rp-hand]').getAttribute('data-rp-hand'),String(first),'Active drop chooses the dragged athlete');
    assert.equal(await page.locator('.sheet').count(),0,'successful drop does not accidentally open inspection');
    await drag(second,await center(page,'.rp-side.is-mine .rp-bench'));
    assert.equal(await page.locator('.rp-side.is-mine .rp-bench [data-rp-hand]').getAttribute('data-rp-hand'),String(second),'Bench drop chooses the dragged athlete');
    assert.equal(await snapshot(page,mid),opening,'opening drag choices remain provisional until confirmed');
    // Return the optional Bench choice to hand, then exercise a real in-play drop.
    await page.locator('.rp-side.is-mine .rp-bench [data-rp-hand]').tap();
    await page.locator('[data-rp-place="remove"]').tap();
    await page.waitForFunction(()=>!document.querySelector('.sheet'));
    await page.locator('[data-rp-ready]').tap();await settled(page,mid);
    const played=await page.evaluate(async mid=>{const x=(await import('/js/core/dynasty-solo.js')).get(mid);return {phase:x.G.phase,active:x.G.p[0].active?.id,bench:x.G.p[0].bench.map(s=>s.id)};},mid);
    assert.notEqual(played.phase,'setup','confirmation applies the legal opening setup');
    assert.equal(played.active,initial.hand[first],'the confirmed Active matches the touch selection');
    assert.equal(played.bench.length,0,'removing the optional opening Bench leaves it in hand');
    const benchMove=await page.evaluate(async({mid,id})=>{
      const x=(await import('/js/core/dynasty-solo.js')).get(mid),B=await import('/js/core/dynasty-pocket.js');
      return {legal:B.check(x.G,0,{a:'bench',id}).ok,index:x.G.p[0].hand.indexOf(id),count:x.G.p[0].hand.length,
        collection:JSON.stringify((await import('/js/core/dynasty.js')).mine().o)};
    },{mid,id:initial.hand[second]});
    assert(benchMove.legal&&benchMove.index>=0,'a real Bench move is legal on the manager’s turn');
    await drag(benchMove.index,await center(page,'.rp-side.is-mine .rp-bench'));
    const afterBench=await page.evaluate(async mid=>{const x=(await import('/js/core/dynasty-solo.js')).get(mid);return {bench:x.G.p[0].bench.map(s=>s.id),hand:x.G.p[0].hand.length,
      collection:JSON.stringify((await import('/js/core/dynasty.js')).mine().o)};},mid);
    assert(afterBench.bench.includes(initial.hand[second]),'a legal in-play drop benches the dragged athlete');
    assert.equal(afterBench.hand,benchMove.count-1,'the real drop plays exactly one hand card');
    assert.equal(afterBench.collection,benchMove.collection,'dragging never consumes collection ownership');
    assert.equal(await page.locator('.sheet').count(),0,'real drop does not open an accidental tap modal');
    if(shots)await page.screenshot({path:path.join(shots,'touch-setup-complete.png')});

    // Energy: a real touch drag from the Energy Zone onto a highlighted athlete; a miss attaches nothing.
    const energyReady=async()=>page.evaluate(async mid=>{const x=(await import('/js/core/dynasty-solo.js')).get(mid),B=await import('/js/core/dynasty-pocket.js');
      return x.state==='yours'&&B.legalActions(x.G,0).some(m=>m.a==='energy');},mid);
    if(!await energyReady()){await page.locator('[data-rp-end]').tap();await settled(page,mid);}
    assert(await energyReady(),'Energy is available on the manager’s turn');
    const activeEnergy=async()=>page.evaluate(async mid=>(await import('/js/core/dynasty-solo.js')).get(mid).G.p[0].active.en.length,mid);
    const zone=await center(page,'[data-rp-energy]'),beforeEnergy=await activeEnergy(),beforeMiss=await snapshot(page,mid);
    await touch('touchStart',zone);await move(zone,await center(page,'.rp-side.is-opponent .rp-active'));
    await page.waitForSelector('.rp-energy-ghost');
    assert.equal(await page.locator('.rp-side.is-opponent .is-energy-target').count(),0,'opposing athletes never highlight for your Energy');
    await touch('touchEnd');await page.waitForTimeout(400);
    assert.equal(await page.locator('.rp-energy-ghost').count(),0,'a missed Energy drop floats back');
    assert.equal(await snapshot(page,mid),beforeMiss,'a missed Energy drop attaches nothing');
    await touch('touchStart',zone);await move(zone,await center(page,'.rp-side.is-mine .rp-active [data-rp-slot]'));
    await page.waitForSelector('.rp-side.is-mine .rp-active .is-energy-target.is-drop-hover');
    await touch('touchCancel');await page.waitForTimeout(400);
    assert.equal(await snapshot(page,mid),beforeMiss,'a cancelled Energy drag attaches nothing');
    await touch('touchStart',zone);await move(zone,await center(page,'.rp-side.is-mine .rp-active [data-rp-slot]'));
    await page.waitForSelector('.rp-side.is-mine .rp-active .is-energy-target.is-drop-hover');
    if(shots)await page.screenshot({path:path.join(shots,'touch-energy-drag.png')});
    await touch('touchEnd');await page.waitForTimeout(250);
    assert.equal(await activeEnergy(),beforeEnergy+1,'dropping the Energy on your Active attaches it');
    assert.equal(await page.locator('.sheet,.rp-energy-ghost').count(),0,'a successful Energy drop opens nothing');

    // A stale gesture cannot cross the profile boundary or continue playing on return.
    const beforeProfile=await snapshot(page,mid),profileFrom=await exposed(page,0);
    await touch('touchStart',profileFrom);await move(profileFrom,{x:profileFrom.x,y:profileFrom.y-100});
    await page.waitForSelector('.rp-drag-ghost');
    await page.waitForTimeout(850);
    assert.equal(await page.locator('.rp-drag-ghost').count(),1,'a deferred CPU check with no move leaves a live hand gesture intact');
    await page.evaluate(async()=>(await import('/js/core/data.js')).setMe('mason'));
    await touch('touchEnd');await page.waitForFunction(()=>!document.querySelector('.rp-battle,.rp-drag-ghost,.rp-card-focus'));
    await page.evaluate(async mid=>{(await import('/js/core/data.js')).setMe('evan');await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+mid);},mid);
    await page.waitForSelector('.rp-hand');
    assert.equal(await snapshot(page,mid),beforeProfile,'profile switching cancels the drag without a move');
    assert.deepEqual(errors,[],'no touch interaction browser exceptions');
    console.log('PASS v7 touch: actual cards, centered tap, hold lift, sliding fan, valid/invalid drops, Energy drag/miss/cancel, cancellation and profile cleanup');
    await ctx.close();
  } finally {await browser.close();}
}
(async()=>{const server=await serve();try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
