// Local-only Keepfall regression checks. Firebase and external requests are disabled.
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'), out=path.resolve(root,'../keepfall-qa');
let playwright; try {playwright=require('playwright')} catch {playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
const LORE=[
'Yharmin was once united under a single High King, ruling from one great keep. In a single night, that keep was breached and the crown was lost. With no king left to hold it together, Yharmin split into rival houses, each building its own stronghold and fighting to claim the broken throne. That night is remembered as the Keepfall.',
'Now every house builds, raids, and wars for one goal: to rebuild what was lost and rule Yharmin.'
];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const nav=(p,r)=>p.evaluate(async r=>(await import('/js/app.js')).nav(r),r);
const marker=p=>p.evaluate(()=>localStorage.getItem('gg-keepfall-lore-seen'));
const closeLore=async p=>{await p.locator('[data-intro-skip]').click();await p.locator('.sh-rl-lore').waitFor({state:'detached'})};
async function lore(p){
 await p.locator('.sh-rl-lore').waitFor();
 assert.equal(await p.locator('.sh-rl-lore').count(),1);
 assert.equal(await p.locator('.rl-intro-brand').textContent(),'Keepfall');
 assert.equal(await p.locator('.rl-intro-slide').count(),7);
 const texts=await p.locator('.rl-intro-copy').allTextContents();
 assert(texts[0].includes('single High King')&&texts[1].includes('breached')&&texts[2].includes('crown was lost')&&texts[3].includes('rival houses')&&texts[4].includes('broken throne')&&texts[5].includes('remembered as the Keepfall')&&texts[6]===LORE[1]);
}
const snap=p=>p.evaluate(async()=>{const s=(await import('/js/core/realm.js')).mine();return JSON.parse(JSON.stringify({nm:s.nm,b:s.b,r:s.r,cl:s.cl,xo:s.xo,ar:s.ar,hr:s.hr,tp:s.tp,nb:s.nb,sc:s.sc}))});
const seed=p=>p.evaluate(async()=>{const F=await import('/js/core/realm.js'),s=F.testRealm(null);s.nm='House regression';s.sc='coast';s.b.find(b=>b.t==='keep').l=3;s.b.find(b=>b.t==='mine').l=2;s.r={gold:432,grain:654};s.xo={gold:0,grain:0};s.tp=73;s.hr={knight:1};s.sh=Date.now()+7*24*F.HOUR;F._set(s);F.touch()});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,buf)=>{if(err)return res.writeHead(404).end();if(file.endsWith('index.html'))buf=Buffer.from(buf.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(buf)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await playwright.chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const env=async(profile='evan',oldSeen=false,guest=null)=>{
  const c=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  await c.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===url||['data:','blob:'].includes(u.protocol)?r.continue():r.abort()});
  await c.addInitScript(({profile,oldSeen,guest})=>{if(localStorage.getItem('__lore-seeded'))return;localStorage.setItem('__lore-seeded','1');localStorage.setItem('gg-me',profile);localStorage.setItem('gg-welcome','1');if(oldSeen)localStorage.setItem('gg-realm-seen','1');if(guest)localStorage.setItem('gg-guest',guest);sessionStorage.setItem('gg-skip-title','1');sessionStorage.setItem('gg-shelf','keep')},{profile,oldSeen,guest});
  const p=await c.newPage(),errors=[],assets=[],failed=[];p.setDefaultTimeout(20000);
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/\/img\/(?:realm\/|games\/keepfall-)/.test(r.url()))assets.push(r.url())});
  p.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400)failed.push(r.url())});
  await p.goto(url+'/#/puzzles');await p.waitForFunction(()=>window.__ggBooted);
  assert.equal(await p.evaluate(async()=>(await import('/js/core/fire.js')).canWrite()),false);
  return {c,p,errors,assets,failed};
 };
 try{
  {const {c,p,errors,failed}=await env();
   try{
    await p.waitForFunction(()=>document.querySelector('.gm-list')?.dataset.ids.includes('keep'));
    const kase=p.locator('.gm-slot:not([data-gm-clone]) .gm-case[data-gm="keep"]');
    assert((await kase.getAttribute('aria-label')).includes('Keepfall'));
    await nav(p,'/realm');await lore(p);
    assert.equal(await marker(p),null);
    await p.waitForTimeout(500);const before=await snap(p);
    const visible=()=>p.locator('.rl-intro-slide:not([hidden])');
    const title=()=>visible().locator('h2').innerText();
    assert.equal(await title(),'One kingdom');
    await p.keyboard.press('ArrowRight');assert.equal(await title(),'One night');
    await p.keyboard.press('Home');assert.equal(await title(),'One kingdom');
    await p.keyboard.press('ArrowLeft');assert.equal(await title(),'One kingdom');
    const session=await c.newCDPSession(p);
    const swipe=async(dx,dy=0,target='.rl-intro-stage')=>{
     const b=await p.locator(target).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,turn:window.GGLock.turn()}}),x=b.x+b.width/2-dx/2,y=b.y+Math.min(240,b.height/2),v=p.viewportSize();
     const point=(ax,ay)=>b.turn===90?{x:v.width-ay,y:ax}:b.turn===-90?{x:ay,y:v.height-ax}:{x:ax,y:ay};
     await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(x,y)]});
     for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x+dx*i/6,y+dy*i/6)]});
     await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    await swipe(-140);assert.equal(await title(),'One night');
    await swipe(140);assert.equal(await title(),'One kingdom');
    await swipe(0,110);await lore(p);assert.equal(await title(),'One kingdom');
    await swipe(-20);assert.equal(await title(),'One kingdom');
    for(let i=0;i<7;i++){
     await p.locator('[data-intro-slide="'+i+'"]').click();
     await visible().locator('img').evaluate(img=>img.decode());
     assert.equal(await visible().count(),1);assert.equal(await p.locator('.rl-intro-slide[hidden][inert]').count(),6);
     await p.screenshot({path:path.join(out,'keepfall-slide-'+(i+1)+'-390.png')});
    }
    assert.equal(await p.locator('[data-intro-next]').innerText(),'Begin your reign');
    await p.keyboard.press('ArrowRight');assert.equal(await title(),'Your house. Your reign.');
    for(const [width,height] of [[320,740],[390,844],[1280,900],[844,390],[320,568]]){
     await p.setViewportSize({width,height});
     for(const i of [0,2,6]){
      await p.locator('[data-intro-slide="'+i+'"]').click();await p.waitForTimeout(80);
      const geo=await p.locator('.rl-intro').evaluate(el=>{
       const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
       return {width:innerWidth,height:innerHeight,turn:window.GGLock.turn(),root:rect(el),cap:rect(el.querySelector('.rl-intro-slide:not([hidden]) .rl-intro-caption')),stage:rect(el.querySelector('.rl-intro-stage')),over:el.scrollWidth-el.clientWidth,doc:document.documentElement.scrollWidth-innerWidth,
        controls:[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(rect)}
      });
      assert(geo.over<=1&&(geo.turn||geo.doc<=1)&&geo.root.x>=-1&&geo.root.right<=geo.width+1,JSON.stringify(geo));
      assert(geo.cap.y>=52&&geo.cap.bottom<=geo.stage.bottom+1,JSON.stringify(geo));
      assert(geo.controls.every(b=>b.h>=44&&b.x>=-1&&b.right<=geo.width+1&&b.y>=-1&&b.bottom<=geo.height+1),JSON.stringify(geo));
      await p.screenshot({path:path.join(out,'keepfall-slide-'+(i+1)+'-'+width+'x'+height+'.png')});
     }
    }
    await p.setViewportSize({width:844,height:390});await p.waitForFunction(()=>window.GGLock.turn()!==0);
    await p.keyboard.press('Home');await swipe(-140);assert.equal(await title(),'One night');await swipe(140);assert.equal(await title(),'One kingdom');
    await p.locator('[data-intro-help]').click();await swipe(0,-140,'.rl-intro-help');assert(await p.locator('.rl-intro-help').evaluate(el=>el.scrollTop>0),'Sideways help touch scrolling');await p.locator('[data-intro-resume]').click();
    await p.setViewportSize({width:320,height:740});await p.keyboard.press('End');
    await p.locator('[data-intro-help]').click();
    const help=await p.locator('.rl-intro-help').innerText();for(const t of ['Your coffers','Gold mines','Your builder','Attack','Heroes','Your people','Defend','pinch to zoom'])assert(help.includes(t),t);
    const scroll=await p.locator('.rl-intro-help').evaluate(el=>{el.scrollTop=el.scrollHeight;return {top:el.scrollTop,over:el.scrollWidth-el.clientWidth}});assert(scroll.top>0&&scroll.over<=1);
    await p.locator('[data-intro-resume]').click();assert.equal(await title(),'Your house. Your reign.');
    await p.locator('[data-intro-next]').click();await p.locator('.sh-rl-lore').waitFor({state:'detached'});
    assert.equal(await marker(p),'2');assert.deepEqual(await snap(p),before);
    await p.locator('[data-rl-lore]').click();await lore(p);assert.equal(await title(),'One kingdom');
    await p.keyboard.press('End');assert.equal(await p.locator('[data-intro-next]').innerText(),'Return to your realm');
    await p.keyboard.press('Home');await closeLore(p);assert.deepEqual(await snap(p),before);
    await p.reload();await p.waitForFunction(()=>window.__ggBooted);await p.locator('[data-rl-lore]').waitFor();
    assert.equal(await p.locator('.sh-rl-lore').count(),0);assert.equal(await marker(p),'2');
    await p.locator('[data-rl-lore]').click();await lore(p);await p.keyboard.press('Escape');await p.locator('.sh-rl-lore').waitFor({state:'detached'});
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    console.log('PASS: seven illustrated slides, real touch swipes, vertical-drag protection, keyboard, boundaries, skip/finish/replay, responsive layout, help, saved progress and reload');
   }finally{await c.close()}
  }
  {const {c,p,errors}=await env('evan',true);
   try{
    await seed(p);await p.evaluate(()=>localStorage.setItem('gg-keepfall-lore-seen','1'));const before=await snap(p);await nav(p,'/realm');await lore(p);await closeLore(p);assert.deepEqual(await snap(p),before);
    await p.reload();await p.waitForFunction(()=>window.__ggBooted);await p.locator('[data-rl-lore]').waitFor();assert.equal(await p.locator('.sh-rl-lore').count(),0);assert.deepEqual(await snap(p),before);
    assert.deepEqual(errors,[]);console.log('PASS: existing owners receive lore once without resetting their saved realm');
   }finally{await c.close()}
  }
  {const {c,p,errors}=await env('evan',true);
   try{
    await seed(p);await nav(p,'/realm');await lore(p);await nav(p,'/puzzles');await p.locator('.sh-rl-lore').waitFor({state:'detached'});assert.equal(await marker(p),null);
    await nav(p,'/realm');await lore(p);await p.evaluate(async()=>(await import('/js/core/data.js')).setMe('mason'));await p.locator('.sh-rl-lore').waitFor({state:'detached'});assert.equal(await marker(p),null);assert.equal(await p.locator('.rl-home canvas').count(),0);
    await p.evaluate(async()=>{(await import('/js/core/data.js')).setMe('evan');await(await import('/js/app.js')).nav('/realm')});await lore(p);
    const second=await c.newPage();await second.goto(url+'/data/league.json');await second.evaluate(()=>localStorage.setItem('gg-me','none'));await p.locator('.sh-rl-lore').waitFor({state:'detached'});assert.equal(await marker(p),null);assert.equal(await p.locator('.rl-home canvas').count(),0);await second.close();assert.deepEqual(errors,[]);
    console.log('PASS: route and same/cross-tab profile cleanup leave unread lore unacknowledged');
   }finally{await c.close()}
  }
  {const {c,p,errors}=await env('evan',true);
   try{
    await seed(p);await nav(p,'/realm');await lore(p);
    await p.evaluate(async()=>{const F=await import('/js/core/realm.js'),d=await import('/js/core/daily.js'),s=JSON.parse(JSON.stringify(F.mine())),now=Date.now();s.nm='Late synced house';s.at=now+10000;s.born=now-72*F.HOUR;s.lr=now-48*F.HOUR;s.sh=0;Object.assign(d.LB,{uid:'local-lore',nick:'Evan Appenzeller',ready:true,off:false,put:null,raw:[{id:'local-lore',nick:'Evan Appenzeller',fr1:s}]});d.__dev.emit('lb',{why:'local lore check'})});
    await p.waitForFunction(async()=>(await import('/js/core/realm.js')).mine().nm==='Late synced house');await p.waitForTimeout(1200);await lore(p);assert.equal(await p.locator('.sheet').count(),1);
    const due=await p.evaluate(async()=>{const F=await import('/js/core/realm.js'),B=await import('/js/core/realm-battle.js');return {due:B.raidsDue(F.mine()).length,played:F.mine().df.length}});assert(due.due>0&&due.played===0);
    await closeLore(p);await p.locator('.sheet-title').filter({hasText:'While you were away'}).waitFor();assert.equal(await marker(p),'2');assert.deepEqual(errors,[]);
    console.log('PASS: late sync and due raids cannot cover unread lore; defense report resumes after dismissal');
   }finally{await c.close()}
  }
  {const {c,p,errors}=await env();
   try{
    await p.route('**/img/realm/lore-v2/**',r=>r.abort());
    await nav(p,'/realm');await lore(p);
    await p.waitForFunction(()=>document.querySelector('.rl-intro-slide:not([hidden]) img').hidden);
    assert((await p.locator('.rl-intro-slide:not([hidden])').innerText()).includes('Yharmin was once united'));
    await p.keyboard.press('End');await p.locator('[data-intro-next]').click();await p.locator('.sh-rl-lore').waitFor({state:'detached'});
    assert.equal(await marker(p),'2');assert.deepEqual(errors,[]);
    console.log('PASS: failed artwork keeps the story readable and navigation usable');
   }finally{await c.close()}
  }
  for(const [profile,guest] of [['mason',null],['none',null],['none','Local QA guest']]){
   const {c,p,errors,assets}=await env(profile,false,guest);
   try{
    assert.equal(await p.locator('[data-gm="keep"]').count(),0);
    for(const r of ['/puzzles/keep','/realm','/realm/scout/bot%3A1','/realm/raid/bot%3A1']){await nav(p,r);await p.waitForFunction(()=>location.hash==='#/puzzles');assert.equal(await p.locator('.rl-home,.rls,.rlr,.sh-rl-lore').count(),0)}
    await p.goto(url+'/#/realm');await p.waitForFunction(()=>window.__ggBooted&&location.hash==='#/puzzles');
    assert.equal(await marker(p),null);assert.equal(assets.length,0);assert.deepEqual(errors,[]);console.log('PASS: owner gate, routes and asset isolation for '+(guest?'guest':profile));
   }finally{await c.close()}
  }
 }finally{await browser.close();await new Promise(r=>server.close(r))}
 console.log('Keepfall checks passed. Screenshots: '+out);
})().catch(e=>{console.error(e);process.exitCode=1});
