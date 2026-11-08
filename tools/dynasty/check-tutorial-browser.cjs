// Offline UI exercise: real first launch, gestures, all lessons, receipts and profile boundaries.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let pw;try{pw=require('playwright');}catch{pw=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'../..'),shots=path.join(root,'output/tutorial');
const phone=process.argv.includes('--phone');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
  let file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(file)&&process.env.RIVALS_ASSET_ROOT&&/^(img|fonts|icons)\//.test(rel))file=path.join(process.env.RIVALS_ASSET_ROOT,rel);
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}if(rel==='index.html')bytes=Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);});
});
const settle=async p=>{await p.waitForFunction(()=>!document.querySelector('.sheet'));if(phone)await p.waitForTimeout(250);await p.waitForFunction(()=>!document.querySelector('.rp-cinema')&&!document.querySelector('[data-rp]')?.inert);};
const waitStep=async(p,n)=>{await p.waitForSelector(`[data-rt-step="${n}"]`);await settle(p);};
const nav=(p,url)=>p.evaluate(async url=>(await import('/js/app.js')).nav(url),url);
const snapshot=p=>p.evaluate(async()=>{const D=await import('/js/core/dynasty.js');return {save:JSON.stringify(D.mine()),solo:localStorage.getItem('gg-dys-m_evan')};});
const inspectHand=async(p,name)=>{await settle(p); // Accessible labels are stable across artwork.
  const target=p.locator('.rp-hand [data-rp-hand]').and(p.getByRole('button',{name:new RegExp('Inspect '+name)})).first();await target.focus();await p.keyboard.press('Enter');await p.waitForSelector('.rp-sheet');};
const inspectActive=async p=>{await settle(p);await p.locator('.rp-side.is-mine .rp-active [data-rp-slot]').click();await p.waitForSelector('[data-rp-preview-act]');};
async function energy(p,bench=false){
  await p.waitForFunction(()=>!document.querySelector('.sheet,.rp-cinema')&&!document.querySelector('[data-rp]')?.inert);
  await p.waitForSelector('.rp-energy-zone.is-mine.is-ready');
  await p.waitForFunction(()=>!document.querySelector('.sheet,.rp-cinema')&&!document.querySelector('[data-rp]')?.inert);
  const zone=p.locator('[data-rp-energy]'),target=p.locator(`.rp-side.is-mine ${bench?'.rp-bench':'.rp-active'} [data-rp-slot]`).first();
  await zone.scrollIntoViewIfNeeded();const a=await zone.boundingBox(),b=await target.boundingBox();
  if(phone){
    const cdp=await p.context().newCDPSession(p),from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...from,radiusX:3,radiusY:3,force:1}]});
    for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12,radiusX:3,radiusY:3,force:1}]});await p.waitForTimeout(15);}
    await p.waitForSelector('.rp-energy-ghost.is-valid');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await p.mouse.up();}
}
async function launch(p){await nav(p,'/puzzles/dynasty');await p.waitForSelector('.pk-start.is-ready');await p.locator('.pk-start').focus();await p.keyboard.press('Enter');await waitStep(p,0);}
async function run(url){
  const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  let debugPage;
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:phone,serviceWorkers:'block',reducedMotion:phone?'no-preference':'reduce'});
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
    await ctx.addInitScript(()=>{if(!localStorage.getItem('gg-me'))localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');['evan','jayton','mason','user%3Aryan-stewart','user%3Aryan-younggreen','visitor'].forEach(k=>localStorage.setItem('gg-release-3.0:'+k,'1'));});
    const p=await ctx.newPage(),errors=[];debugPage=p;p.on('pageerror',e=>errors.push(String(e.stack||e)));fs.mkdirSync(shots,{recursive:true});
    await p.goto(url+'/#/puzzles');await p.waitForFunction(()=>window.__ggBooted);
    await p.evaluate(async()=>{const D=await import('/js/core/dynasty.js');await D.load();D.mine();});
    const original=await snapshot(p);await launch(p);assert.deepEqual(await snapshot(p),original,'opening practice preserves save and Solo');
    await p.screenshot({path:path.join(shots,'welcome.png')});
    await p.locator('[data-rt-start]').click();await waitStep(p,1);
    for(const width of [320,390,768]){await p.setViewportSize({width,height:width===320?568:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(shots,`setup-${width}.png`)});}
    await p.setViewportSize(phone?{width:320,height:568}:{width:390,height:844});
    await inspectHand(p,'Patrick Mahomes');await p.locator('[data-rp-place="active"]').click();
    await inspectHand(p,'CeeDee Lamb');await p.locator('[data-rp-place="bench"]').click();
    await p.locator('[data-rp-ready]').click();await waitStep(p,2);await energy(p);await waitStep(p,3);
    await inspectHand(p,'Film Study');await p.locator('[data-rp-move]').filter({hasText:'Play Film Study'}).click();await waitStep(p,4);
    await inspectActive(p);await p.locator('[data-rp-preview-act="0"]').click();await waitStep(p,5);
    await p.waitForFunction(()=>document.querySelector('.rt-coach h2')?.textContent==='Develop your player');
    await inspectHand(p,'Patrick Mahomes - Breakout');await p.locator('[data-rp-move]').filter({hasText:'Develop'}).click();await waitStep(p,6);
    await energy(p);await waitStep(p,7);await inspectActive(p);await p.locator('[data-rp-preview-act="0"]').click();await waitStep(p,8);
    await p.waitForFunction(()=>document.querySelector('.rt-coach h2')?.textContent==='Prepare your next attacker');
    assert.match(await p.locator('.rp-manager.is-mine').getAttribute('aria-label'),/1 of 3/);
    await p.screenshot({path:path.join(shots,'first-knockout.png')});
    await energy(p,true);await waitStep(p,9);await inspectActive(p);await p.locator('[data-rp-preview-retreat]').click();await waitStep(p,10);
    await inspectActive(p);await p.locator('[data-rp-preview-act="0"]').click();await waitStep(p,11);
    assert.deepEqual(await snapshot(p),original,'all practice actions leave real progress untouched');
    await p.screenshot({path:path.join(shots,phone?'complete-phone.png':'complete.png')});await p.locator('[data-rt-finish]').click();await p.waitForFunction(()=>location.hash==='#/puzzles/dynasty');
    const finished=await snapshot(p),saved=JSON.parse(finished.save);assert.deepEqual(saved.tutorial,{v:1,result:'completed'});delete saved.tutorial;delete saved.at;const old=JSON.parse(original.save);delete old.at;assert.deepEqual(saved,old);assert.equal(finished.solo,original.solo);
    await p.reload();await p.waitForFunction(()=>window.__ggBooted);await p.waitForSelector('.pk-start.is-ready');await p.locator('.pk-start').click({position:{x:180,y:400}});await p.waitForFunction(()=>!document.querySelector('.pk-start'));assert.equal(await p.locator('.rt-coach').count(),0,'completion survives reload');
    await p.locator('[data-dy-guide]').first().click();await p.locator('[data-dy-tutorial]').click();await waitStep(p,0);await p.locator('[data-rt-skip]').click();await p.waitForFunction(()=>location.hash==='#/puzzles/dynasty');assert.equal(JSON.parse((await snapshot(p)).save).tutorial.result,'completed','replay Skip cannot downgrade completion');
    for(const [member,guest,key] of [['jayton','', 'm_jayton'],['','Ryan Stewart','u_ryan-stewart'],['','Ryan Younggreen','u_ryan-younggreen']]){
      await p.evaluate(async({member,guest})=>{const d=await import('/js/core/data.js');member?d.setMe(member):d.setGuest(guest);},{member,guest});await nav(p,'/puzzles');await launch(p);await p.locator('[data-rt-skip]').click();await p.waitForFunction(()=>location.hash==='#/puzzles/dynasty');
      assert.equal(await p.evaluate(async()=>(await import('/js/core/dynasty.js')).mine().tutorial.result),'skipped',key+' has own Skip receipt');
      await p.reload();await p.waitForFunction(()=>window.__ggBooted);await p.waitForSelector('.pk-start.is-ready');await p.locator('.pk-start').click({position:{x:180,y:400}});await p.waitForFunction(()=>!document.querySelector('.pk-start'));assert.equal(await p.locator('.rt-coach').count(),0);
    }
    await nav(p,'/puzzles/dynasty/battle/tutorial');await waitStep(p,0);await p.locator('[data-rt-start]').click();
    await p.evaluate(async()=>(await import('/js/core/data.js')).setMe('mason'));await p.waitForFunction(()=>!document.querySelector('.rt-coach'));await nav(p,'/puzzles/dynasty/battle/tutorial');await p.waitForFunction(()=>location.hash==='#/puzzles');
    assert.equal(await p.evaluate(async()=>(await import('/js/core/dynasty.js')).finishTutorial('completed','u_ryan-younggreen')),false,'stale profile cannot save');
    assert.deepEqual(errors,[]);await ctx.close();console.log('PASS tutorial browser: first entry, full gameplay, phone/tablet, save isolation, reload, Skip, replay and all four profiles');
  }catch(e){if(debugPage&&!debugPage.isClosed()){await debugPage.screenshot({path:path.join(shots,'failure.png')});console.error(await debugPage.evaluate(()=>({hash:location.hash,focus:document.activeElement?.outerHTML.slice(0,300),starts:[...document.querySelectorAll('.pk-start')].map(e=>({cls:e.className,inert:!!e.closest('[inert]')})),text:document.body.innerText.slice(-1500)})));}throw e;}finally{await browser.close();}
}
server.listen(0,'127.0.0.1',()=>run(`http://127.0.0.1:${server.address().port}`).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close()));
