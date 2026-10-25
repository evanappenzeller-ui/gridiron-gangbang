const assert=require('node:assert/strict');
module.exports=async function checkNavigation(page,context){
  await page.evaluate(async()=>{window.releaseApp=await import('/js/app.js');});
  await page.evaluate(async()=>{localStorage.setItem('gg-tab-hint','2');for(const id of (await import('/js/core/data.js')).ids)localStorage.setItem('gg-release-3.0:'+id,'1');});
  const settled=async tab=>{
    await page.waitForFunction(tab=>{const app=window.releaseApp;return app.__dev.S.tab===tab&&!app.__dev.queueBusy&&!document.querySelector('#stage.is-cards')&&[...document.querySelectorAll('.tab-layer')].every(el=>!el.style.transform&&!el.style.willChange);},tab,{timeout:10000});
    const visible=await page.locator('#stage > .tab-layer:not([hidden])').evaluateAll(es=>es.map(e=>e.dataset.tab));
    assert.deepEqual(visible,[tab],'One visible tab after '+tab);
  };
  await page.evaluate(async()=>(await import('/js/app.js')).nav('/puzzles'));await settled('puzzles');
  const tabs=await page.locator('#tabbar .tab:not([hidden])').evaluateAll(es=>es.map(e=>e.dataset.tab));
  assert.deepEqual(tabs,['puzzles','pickem','lay','live','matchup','league','draft']);
  for(const tab of tabs){await page.locator('#tabbar .tab[data-tab="'+tab+'"]').click();await settled(tab);assert.equal(await page.locator('.tab-layer:not([hidden])').getByText("This screen didn't load.",{exact:true}).count(),0);}
  const begin=Date.now();
  await page.evaluate(()=>{for(const tab of [...['puzzles','pickem','lay','live','matchup','league','draft'],...['puzzles','pickem','lay','live','matchup','league','draft'],'puzzles'])document.querySelector('#tabbar .tab[data-tab="'+tab+'"]').click();});
  await settled('puzzles');assert(Date.now()-begin<2500,'Rapid taps converge without replaying old targets');
  console.log('PASS navigation: seven tabs and rapid latest-target convergence.');
  const cdp=await context.newCDPSession(page);
  async function swipe({dx=-230,dy=0,cancel=false}={}){
    const start=await page.evaluate(({dx,dy})=>{
      const stage=document.getElementById('stage'),r=stage.getBoundingClientRect(),x=r.left+r.width*(dx<0?.8:.2);
      const no='input,textarea,select,[contenteditable="true"],[role="slider"],[data-no-swipe],[data-hscroll],.dr-field.is-anim,.dr-cam,#tabbar';
      for(const y of [r.top+110,r.top+165,r.top+220,r.top+280]){
        const el=document.elementFromPoint(x,y);if(!el||!stage.contains(el)||el.closest(no))continue;
        let own=false;for(let n=el;n&&n!==stage;n=n.parentElement){const cs=getComputedStyle(n);if(['pan-y','none'].includes(cs.touchAction)||(n.scrollWidth>n.clientWidth+2&&['auto','scroll'].includes(cs.overflowX)))own=true;}
        if(!own&&x+dx>r.left+10&&x+dx<r.right-10&&y+dy>r.top+10&&y+dy<r.bottom-100)return{x,y};
      }throw Error('No navigation swipe target');
    },{dx,dy});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
    for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*i/12,y:start.y+dy*i/12,id:1}]});await page.waitForTimeout(12);}
    if(Math.abs(dx)>Math.abs(dy))assert(await page.locator('#stage.is-cards').count(),'Real touch owns pager');
    await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  }
  await page.evaluate(async()=>(await import('/js/app.js')).nav('/pickem'));await settled('pickem');await page.waitForTimeout(450);
  await swipe();await settled('lay');await page.waitForTimeout(450);
  await swipe({dx:230});await settled('pickem');await page.waitForTimeout(450);
  await swipe({cancel:true});await settled('pickem');await page.waitForTimeout(450);
  await swipe({dx:-8,dy:170});await settled('pickem');
  console.log('PASS navigation: genuine touch swipes, cancellation, vertical-scroll axis, clean transforms.');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#tabbar .tab[data-tab="league"]').click();await settled('league');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(async()=>(await import('/js/app.js')).nav('/puzzles'));await settled('puzzles');
  await page.evaluate(async()=>(await import('/js/app.js')).nav('/puzzles/daily'));
  await page.waitForFunction(()=>window.releaseApp.__dev.S.stacks.puzzles.length===2);
  await page.locator('.tab-layer:not([hidden]) .screen:not([data-under]) .nav-back').click();await settled('puzzles');
  assert.equal(await page.evaluate(async()=>(await import('/js/app.js')).__dev.S.stacks.puzzles.length),1);
  console.log('PASS navigation: reduced-motion switch and Back.');
  await page.evaluate(async()=>{const data=await import('/js/core/data.js');data.setMe('evan');await(await import('/js/app.js')).nav('/realm');window.previousRealmScreen=(await import('/js/app.js')).__dev.allMounted().find(s=>s.entry.route.view==='realm')?.el;});
  await page.waitForFunction(()=>!!window.previousRealmScreen);
  await page.evaluate(async()=>(await import('/js/core/data.js')).setMe('mason'));
  await page.waitForFunction(()=>{const app=window.releaseApp;return!app.__dev.queueBusy&&!app.__dev.allMounted().some(s=>s.entry.route.view.startsWith('realm'));});
  assert.equal(await page.evaluate(()=>window.previousRealmScreen.isConnected),false,'Prior realm unmounted');
  await page.evaluate(async()=>(await import('/js/app.js')).nav('/realm'));
  await page.waitForFunction(()=>window.releaseApp.__dev.allMounted().some(s=>s.entry.route.view==='realm'));
  assert(await page.evaluate(async()=>(await import('/js/app.js')).__dev.allMounted().find(s=>s.entry.route.view==='realm').el!==window.previousRealmScreen),'Independent new profile screen');
  await page.evaluate(async()=>(await import('/js/app.js')).back());await settled('puzzles');await cdp.detach();
  console.log('PASS navigation: private Keepfall disposed on profile change; another member can open it.');
};
