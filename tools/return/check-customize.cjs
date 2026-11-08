#!/usr/bin/env node
// Offline wallet invariants and real Customize interactions; never reaches production saves.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'output/return-customize'), origin = 'http://127.0.0.1:8765';
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await pw.chromium.launch({channel:'msedge',headless:true});
  const errors = [], external = [];
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}), page = await context.newPage();
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin) { external.push(u.href); return route.abort(); }
      if (u.pathname === '/check') return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0;background:#132538}button{font:inherit}</style><button id="entry">Customize</button>'});
      const file = path.resolve(root,'.'+decodeURIComponent(u.pathname));
      assert(!path.relative(root,file).startsWith('..'));
      try { return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)}); }
      catch (error) { errors.push(error.message); return route.fulfill({status:404,body:'missing'}); }
    });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin+'/check');
    const report = await page.evaluate(async () => {
      const [D,C,V] = await Promise.all([import('/js/core/data.js'),import('/js/core/return-customize.js'),import('/js/views/return-customize.js')]);
      await D.load(); window.qa = {D,C,V};
      const ok = (condition, message) => { if (!condition) throw Error(message); };
      localStorage.clear(); D.setMe('evan');
      localStorage.setItem('gg-v3-ret2',JSON.stringify({days:{19:{r:[{y:10000,d:10000,c:1000}]}}}));
      localStorage.setItem('gg-v3-fr1-m_evan','preserved realm');
      ok(C.snapshot().coins === 0 && C.snapshot().skin === 'home','does not attribute old device-wide scores to selected profile');
      ok(C.snapshot().number === '22' && C.kitFor().num === '22','new lockers start at number 22');
      const oldLocker = {v:1,coins:75,owned:['home','outlaw'],skin:'outlaw',ride:'hoverboard',receipts:{'18:0':135}};
      localStorage.setItem(C.storageKey(),JSON.stringify(oldLocker));
      const oldBytes = localStorage.getItem(C.storageKey()), oldState = C.snapshot();
      ok(oldState.number==='22' && oldState.coins===75 && oldState.skin==='outlaw' && oldState.ride==='hoverboard' && oldState.owned.includes('outlaw'),'pre-number saves retain coins, outfit, ride and ownership');
      ok(localStorage.getItem(C.storageKey())===oldBytes,'reading a pre-number save does not rewrite it');
      ok(C.setNumber('00').ok && JSON.stringify(JSON.parse(localStorage.getItem(C.storageKey())).receipts)===JSON.stringify(oldLocker.receipts),'adding a number preserves old coin receipts');
      localStorage.removeItem(C.storageKey());
      for (const number of ['0','00','7','99']) ok(C.setNumber(number).ok && C.snapshot().number===number && C.kitFor().num===number,'chosen number reaches the equipped kit: '+number);
      const numberBytes = localStorage.getItem(C.storageKey());
      for (const number of ['',-1,100,1.5,NaN,null,true,'1e1','<b>7</b>']) ok(C.setNumber(number).reason==='number' && localStorage.getItem(C.storageKey())===numberBytes,'invalid jersey number never changes the save: '+number);
      ok(C.setNumber('7').ok && C.snapshot().coins===0,'changing number is free');
      ok(!C.buySkin('outlaw').ok && !C.equipSkin('neon').ok,'no negative balance or unowned equipment');
      const run = {n:19,k:0}, session = C.beginRun(run,{practice:false});
      ok(C.credit(session,35).added===35 && C.credit(session,20).added===0 && C.credit(session,35).added===0,'cumulative awards never duplicate or subtract');
      ok(C.credit(session,100).added===65 && C.snapshot().coins===100,'only new pickups credit');
      const purchase = C.buySkin('outlaw');
      ok(purchase.ok && purchase.state.coins===40 && purchase.state.skin==='outlaw','purchase debits once and equips');
      ok(C.buySkin('outlaw').ok && C.snapshot().coins===40,'repeat purchase never charges again');
      ok(!C.buySkin('neon').ok && C.snapshot().coins===40,'insufficient coins preserve wallet');
      ok(C.equipSkin('home').ok && C.equipSkin('outlaw').ok && C.equipRide('hoverboard').ok,'owned cosmetics and free rides equip');
      const repeat = C.beginRun({n:19,k:0},{practice:false});
      ok(C.credit(repeat,100).added===0 && C.credit(repeat,110).added===10,'new session uses durable receipt');
      ok(!C.credit(C.beginRun({n:20,k:0},{practice:true}),999).ok,'practice never earns');
      ok(!C.credit(C.beginRun({n:20,k:0}),999).ok,'missing practice flag fails closed');
      ok(!C.credit(C.beginRun({n:20,k:1},{practice:false}),999).ok,'extra daily attempts never earn');
      ok(!C.credit({},999).ok && !C.credit(session,NaN).ok && !C.credit(session,-1).ok,'invalid receipts and totals rejected');
      run.elsewhere=true;
      ok(!C.credit(session,200).ok,'later cross-device disqualification stops earning');
      C.credit(repeat,250);
      const stable = JSON.stringify(C.snapshot()), originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem=function(){throw Error('quota');};
      ok(!C.equipSkin('home').ok && !C.equipRide('scooter').ok,'storage failure does not equip unsaved cosmetics');
      ok(C.setNumber('88').reason==='storage' && C.snapshot().number==='7','failed number write retains the equipped number');
      ok(C.buySkin('neon').reason==='storage','failed paid purchase never grants or charges an unsaved skin');
      ok(!C.credit(repeat,500).ok,'storage failure does not report earned coins');
      Storage.prototype.setItem=originalSet;
      ok(JSON.stringify(C.snapshot())===stable,'write failures preserve saved balance, equipment and receipts');
      const teams = C.SKINS.filter(s=>s.category==='team'), catalog = (await (await fetch('/data/dynasty.json')).json()).teams;
      ok(teams.length===32 && new Set(teams.map(t=>t.team)).size===32,'every NFL team has exactly one jersey');
      ok(teams.every(t=>catalog[t.team]?.[0]===t.name && t.price===200 && t.kit.pattern==='team' && t.kit.team===t.team),'team jerseys retain franchise identity and the same price');
      ok(C.SKINS.filter(s=>s.category==='skin').length===7,'the seven original outfits remain available');
      D.setMe('none'); D.setGuest('Jersey Catalog QA');
      for(let day=30;day<37;day++) C.credit(C.beginRun({n:day,k:0},{practice:false}),1000);
      for(const team of teams) {
        const before = C.snapshot().coins;
        ok(C.buySkin(team.id).ok && C.snapshot().coins===before-200 && C.kitFor().team===team.team,'team purchase equips and charges once: '+team.team);
        ok(C.buySkin(team.id).ok && C.snapshot().coins===before-200,'owned team jersey never charges again: '+team.team);
      }
      ok(C.setNumber('00').ok && C.kitFor().num==='00' && C.snapshot().owned.length===33,'all purchased jerseys share the chosen number');
      const allTeamsBytes = localStorage.getItem(C.storageKey());
      ok(C.equipSkin(teams[0].id).ok && C.kitFor().team===teams[0].team && C.kitFor().num==='00','switching team keeps the chosen number');
      localStorage.setItem(C.storageKey(),allTeamsBytes);
      ok(C.snapshot().owned.length===33 && C.snapshot().number==='00','clean/read retains every team jersey and number');
      localStorage.removeItem(C.storageKey()); D.setMe('evan');
      const ownerKey=C.profileKey(), ownerState=JSON.stringify(C.snapshot()), profiles=[];
      for (const id of D.ids) { D.setMe(id); profiles.push(C.profileKey()); if(id!=='evan') ok(C.snapshot().coins===0 && C.snapshot().number==='22','new member has own wallet and number: '+id); }
      for (const user of D.USERS) { D.setMe('none'); D.setGuest(user.name); profiles.push(C.profileKey()); ok(C.profileKey()==='u_'+user.id && C.snapshot().coins===0 && C.snapshot().number==='22','stable app-user wallet and number: '+user.id); }
      D.setMe('none'); D.setGuest('Locker Guest'); const guestKey=C.profileKey();
      ok(guestKey.startsWith('g_') && C.snapshot().coins===0,'named guest wallet');
      ok(!C.credit(repeat,500).ok,'profile switch cannot redirect old run coins');
      C.credit(C.beginRun({n:19,k:0},{practice:false}),7);
      D.setGuest(null); profiles.push(C.profileKey());
      ok(C.profileKey()==='visitor' && C.snapshot().coins===0,'unselected player separate from named guests');
      C.credit(C.beginRun({n:19,k:0},{practice:false}),9);
      D.setGuest('Locker Guest'); ok(C.snapshot().coins===7,'guest coins survive other profile');
      D.setMe('evan'); ok(C.profileKey()===ownerKey && JSON.stringify(C.snapshot())===ownerState,'owner cosmetics survive all profile transitions');
      ok(localStorage.getItem('gg-v3-fr1-m_evan')==='preserved realm','Keepfall currency untouched');
      C.credit(C.beginRun({n:20,k:0},{practice:false}),600);
      window.qa.persisted = C.snapshot();
      return {passed:true,profiles:profiles.length+1,skins:C.SKINS.length,rides:C.RIDES.length};
    });
    const persisted = await page.evaluate(() => window.qa.persisted);
    await page.reload();
    assert.deepEqual(await page.evaluate(async()=>{const [C,D]=await Promise.all([import('/js/core/return-customize.js'),import('/js/core/data.js')]);await D.load();return C.snapshot();}), persisted, 'wallet and equipment persist on reload');
    await page.evaluate(async()=>{
      const [C,V,D]=await Promise.all([import('/js/core/return-customize.js'),import('/js/views/return-customize.js'),import('/js/core/data.js')]);
      await D.load(); window.qa={C,V,D,changes:0,closed:0};
      document.querySelector('#entry').onclick=()=>V.open({onChange:()=>window.qa.changes++,onClose:()=>window.qa.closed++});
    });
    await page.locator('#entry').click();
    await page.waitForFunction(()=>document.querySelector('.rmc-dialog') && getComputedStyle(document.querySelector('.rmc-dialog')).borderRadius==='24px');
    for (const [width,height] of [[390,844],[320,568],[768,1024]]) {
      await page.setViewportSize({width,height});
      assert(await page.evaluate(()=>{const d=document.querySelector('.rmc-dialog'),r=d.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth+1;}),'modal fits '+width);
      await page.screenshot({path:path.join(output,'skins-'+width+'.png')});
    }
    await page.setViewportSize({width:390,height:844});
    const before = await page.evaluate(()=>window.qa.C.snapshot().coins);
    await page.locator('[data-rmc-skin="neon"]').click();
    assert(await page.evaluate(()=>window.qa.C.snapshot().skin==='neon'&&window.qa.changes===1),'real purchase equips and notifies renderer');
    assert.equal(await page.evaluate(()=>window.qa.C.snapshot().coins),before-100);
    await page.locator('#rmc-skins-tab').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#rmc-jerseys-tab').getAttribute('aria-selected'),'true','keyboard reaches the jersey tab');
    assert.equal(await page.locator('[data-rmc-skin]').count(),32,'jersey tab contains every team');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#rmc-rides-tab').getAttribute('aria-selected'),'true','keyboard tab navigation');
    await page.locator('[data-rmc-ride="scooter"]').click();
    assert(await page.evaluate(()=>window.qa.C.snapshot().ride==='scooter'&&window.qa.changes===2),'real free ride equips');
    await page.screenshot({path:path.join(output,'rides-390.png')});
    await page.keyboard.press('Escape');
    assert(await page.evaluate(()=>!window.qa.V.isOpen()&&window.qa.closed===1&&document.activeElement.id==='entry'),'escape closes and restores launcher focus');
    await page.locator('#entry').click();
    await page.evaluate(()=>window.qa.D.setMe('ben'));
    assert(await page.evaluate(()=>!window.qa.V.isOpen()&&window.qa.closed===2&&!document.querySelector('.rmc-dialog')),'profile change closes old wallet UI');
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log('PASS Customize: cumulative receipts, purchase/equip/reload, insufficient funds, storage failures, practice exclusion, all profile keys, phone/tablet layout, keyboard, free rides and profile cleanup.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
