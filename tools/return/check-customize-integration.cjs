#!/usr/bin/env node
// Offline browser coverage of the real Return Man page, controls and wallet integration.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'output/return-customize-integration');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const origin = 'http://127.0.0.1:8765';
const mime = {'.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
async function main() {
  fs.mkdirSync(output, {recursive:true});
  const browser = await pw.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  const errors = [];
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}), page = await context.newPage();
    await context.route('**/*',async route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin) { errors.push('External request: '+u.href); return route.abort(); }
      if (u.pathname === '/check') return route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/views/return.css"><style>body{margin:0;background:#102230}main{width:100%;max-width:540px;margin:auto}</style><main class="rm-pane"></main>'});
      if (u.pathname === '/js/app.js') return route.fulfill({contentType:'text/javascript',body:'export const APP_VERSION="test",installEvent=null,TABS=[];export const promptInstall=async()=>false;'});
      try {
        const file = path.resolve(root,'.'+decodeURIComponent(u.pathname)); assert(!path.relative(root,file).startsWith('..'));
        let body = fs.readFileSync(file);
        if (u.pathname === '/js/views/return.js') body += '\nexport {draw,frame,patchHud,pause,resume,go,onEvents,setCard};';
        if (u.pathname === '/js/views/return-3d.js') body += '\nexport {GL};';
        await route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
      } catch(e) { errors.push(e.message); await route.fulfill({status:404,body:'missing'}); }
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestIdleCallback=()=>1;window.cancelIdleCallback=()=>{};});
    await page.goto(origin+'/check');
    await page.evaluate(async()=>{
      const [D,R,V,D3,C,L] = await Promise.all([import('/js/core/data.js'),import('/js/core/return.js'),import('/js/views/return.js'),import('/js/views/return-3d.js'),import('/js/core/return-customize.js'),import('/js/views/return-customize.js')]);
      await D.load(); D.setMe('evan'); R.setTest(true);
      const ctx={visible:true,timer:()=>()=>{}}; V.mount(document.querySelector('main'),ctx);
      window.qa={D,R,V,D3,C,L,ctx};
    });
    await page.waitForFunction(()=>document.querySelector('[data-rm-cv]').__rm.warmed);
    for (const [width,height] of [[320,568],[390,844],[768,1024]]) {
      await page.setViewportSize({width,height});
      await page.locator('[data-rm-customize]').click();
      assert(await page.locator('.rmc-dialog').isVisible());
      const bounds=await page.locator('.rmc-dialog').boundingBox();
      assert(bounds.x>=0 && bounds.x+bounds.width<=width+1 && bounds.y>=0 && bounds.y+bounds.height<=height+1,'locker fits '+width);
      assert(await page.evaluate(()=>document.querySelector('.rmc-dialog').scrollWidth<=document.querySelector('.rmc-dialog').clientWidth+1),'no horizontal overflow');
      await page.screenshot({path:path.join(output,'locker-'+width+'.png')});
      await page.keyboard.press('Escape');
      assert(await page.locator('[data-rm-customize]').evaluate(el=>el===document.activeElement),'close restores focus');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{
      const {C,R}=qa; const receipt=C.beginRun(R.startRun(R.todayNumber(),0,true,true,true),{practice:false}); C.credit(receipt,180);
    });
    await page.locator('[data-rm-customize]').click();
    await page.locator('[data-rmc-skin="outlaw"]').click();
    assert(await page.evaluate(()=>qa.C.snapshot().coins===120 && qa.C.snapshot().skin==='outlaw'),'buy and equip spends exact coins');
    assert(await page.evaluate(()=>document.querySelector('[data-rm-cv]').__rm.skin.jersey===qa.C.skinOf('outlaw').kit.jersey),'renderer receives selected skin');
    await page.locator('[data-rmc-tab="rides"]').click();
    await page.locator('[data-rmc-ride="hoverboard"]').click();
    await page.screenshot({path:path.join(output,'rides-menu.png')});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('[data-rm-cv]').__rm.warmed);
    await page.locator('[data-rm-go]').click();
    await page.evaluate(()=>{
      const st=qa.st=document.querySelector('[data-rm-cv]').__rm; cancelAnimationFrame(st.raf); st.raf=0;
      st.mode='run'; st.intro=false; st.run.z=10; qa.V.draw(st); qa.V.patchHud(st);
    });
    // Real touchscreen taps distinguish a single tap, double tap and swipe.
    await page.touchscreen.tap(180,300);
    assert(await page.evaluate(()=>!qa.st.run.ride),'single tap does not summon');
    await page.evaluate(()=>{qa.st.lastTap=null;});
    await page.touchscreen.tap(180,300); await page.touchscreen.tap(180,300);
    assert(await page.evaluate(()=>qa.st.run.ride?.kind==='hoverboard'),'double tap summons equipped ride');
    await page.evaluate(()=>{qa.st.run.ride.age=1; qa.V.draw(qa.st);});
    await page.screenshot({path:path.join(output,'hoverboard-game.png')});
    const paused=await page.evaluate(()=>{qa.V.pause(qa.st); return [qa.st.run.t,qa.st.run.ride.left];});
    await page.waitForTimeout(80);
    assert.deepEqual(await page.evaluate(()=>[qa.st.run.t,qa.st.run.ride.left]),paused,'pause freezes ride');
    await page.locator('[data-rm-resume]').click();
    await page.evaluate(()=>{cancelAnimationFrame(qa.st.raf);qa.st.raf=0;qa.st.run.ride=null;qa.st.run.rideCooldown=0;qa.st.lastTap=null;qa.V.patchHud(qa.st);});
    // Pointer cancellation and a swipe must never become the first half of a double tap.
    await page.locator('[data-rm-stage]').dispatchEvent('pointerdown',{pointerId:77,isPrimary:true,button:0,clientX:180,clientY:300});
    await page.locator('[data-rm-stage]').dispatchEvent('pointercancel',{pointerId:77,isPrimary:true,clientX:180,clientY:300});
    await page.touchscreen.tap(180,300);
    assert(await page.evaluate(()=>!qa.st.run.ride),'cancelled contact does not count as tap');
    await page.evaluate(()=>{qa.st.lastTap=null;});
    await page.mouse.move(180,300);await page.mouse.down();await page.mouse.move(230,300);await page.mouse.up();
    await page.touchscreen.tap(180,300);
    assert(await page.evaluate(()=>!qa.st.run.ride && qa.st.run.lane===2),'swipe changes lane without summoning');
    await page.keyboard.press('r');
    assert(await page.evaluate(()=>qa.R.riding(qa.st.run)),'keyboard summon');
    await page.evaluate(()=>{qa.st.run.ride=null;qa.st.run.rideCooldown=4;qa.V.patchHud(qa.st);});
    assert(await page.locator('[data-rm-ride]').isDisabled(),'recharge disables button');
    await page.keyboard.press('r');assert(await page.evaluate(()=>!qa.st.run.ride),'recharge rejects key');
    await page.evaluate(()=>{qa.st.run.rideCooldown=0;qa.st.cosmetics.ride='scooter';qa.V.patchHud(qa.st);});
    await page.locator('[data-rm-ride]').click();
    assert(await page.evaluate(()=>qa.st.run.ride?.kind==='scooter'),'accessible button summons scooter');
    await page.evaluate(()=>{qa.st.run.ride.age=1;qa.V.draw(qa.st);});
    await page.screenshot({path:path.join(output,'scooter-game.png')});
    await page.evaluate(()=>{qa.st.flat=true;qa.V.draw(qa.st);});
    await page.screenshot({path:path.join(output,'scooter-fallback.png')});
    // The actual pickup callback must bank once and ignore practice.
    const bank=await page.evaluate(()=>{
      const {st,C,R,V}=qa, before=C.snapshot().coins, coin={i:999,lane:1,y:1};
      st.run.c=200; V.onEvents(st,[{type:'coin',coin}]); const practice=C.snapshot().coins;
      st.walletRun=C.beginRun(st.run,{practice:false}); V.onEvents(st,[{type:'coin',coin}]); const earned=C.snapshot().coins;
      V.onEvents(st,[{type:'coin',coin}]); return {before,practice,earned,repeated:C.snapshot().coins};
    });
    assert.deepEqual(bank,{before:120,practice:120,earned:140,repeated:140},'pickup callback counts only new official coins');
    const switched=await page.evaluate(()=>{
      const {D,C,V,st}=qa;
      D.setMe('ben'); st.run.c=220; V.onEvents(st,[{type:'coin',coin:{i:1000,lane:1,y:1}}]);
      const other=C.snapshot().coins;
      D.setMe('evan'); st.run.c=240; V.onEvents(st,[{type:'coin',coin:{i:1001,lane:1,y:1}}]);
      return {other,original:C.snapshot().coins,invalidated:!st.walletRun};
    });
    assert.deepEqual(switched,{other:0,original:140,invalidated:true},'changing away and back cannot bank another profile’s pickups');
    await page.evaluate(()=>{
      const {st,V}=qa; st.mode='ready';st.run=null;V.setCard(st,true);V.patchHud(st);
    });
    await page.locator('[data-rm-customize]').click();
    await page.evaluate(()=>qa.D.setMe('ben'));
    assert(await page.locator('.rmc-dialog').count()===0,'profile switch closes locker');
    assert(await page.evaluate(()=>qa.C.snapshot().coins===0 && qa.st.cosmetics.skin==='home'),'profile wallet and skin isolated');
    await page.evaluate(()=>qa.D.setMe('evan'));
    assert(await page.evaluate(()=>qa.C.snapshot().coins===140 && qa.st.cosmetics.skin==='outlaw'),'profile restores own cosmetics');
    await page.evaluate(()=>qa.V.unmount(document.querySelector('main'),qa.ctx));
    assert.deepEqual(errors,[],'no runtime errors or external writes');
    console.log('PASS Phone/tablet locker, purchase/equip, live renderer skin, rides menu and focus restoration');
    console.log('PASS Real double tap, single tap, swipe, cancellation, keyboard/button, recharge, pause and canvas rides');
    console.log('PASS Pickup wallet hook, no practice earnings, idempotent credit and live profile isolation');
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
