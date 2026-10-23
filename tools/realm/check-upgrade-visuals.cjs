// Local browser verification of all upgrade art; remote requests and writes are disabled.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,'../building-upgrades-qa');
let pw;try{pw=require('playwright')}catch{pw=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
const mime={'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local'),f=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return}if(f.endsWith('index.html'))b=Buffer.from(b.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(b)})});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await pw.chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const report={};
  for(const profile of ['evan','mason','none']){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===url||['data:','blob:'].includes(u.protocol)?route.continue():route.abort()});
   await context.addInitScript(p=>{localStorage.setItem('gg-me',p);localStorage.setItem('gg-welcome','1');localStorage.setItem('gg-realm-seen','1');localStorage.setItem('gg-keepfall-lore-seen','3');sessionStorage.setItem('gg-skip-title','1')},profile);
   const page=await context.newPage(),errors=[],assets=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/img/realm/upgrades-v1/'))assets.push(r.url())});
   await page.goto(url+'/#/realm');await page.waitForFunction(()=>window.__ggBooted);
   assert.equal(await page.evaluate(async()=>(await import('/js/core/fire.js')).canWrite()),false);
   if(profile==='evan'){
    await page.waitForSelector('.rl-home canvas');await page.waitForFunction(()=>!document.querySelector('.rl-home .rl-loading'));
    await page.screenshot({path:path.join(out,'starter-390.png')});
    const growth=await page.evaluate(async()=>{
     const S=await import('/js/views/realm-sprites.js'),F=await import('/js/core/realm.js'),D=await import('/js/views/realm-3d.js');
     await D.load();let count=0;const families={};
     for(const k of S.KINDS){let prev={width:0,height:0};families[k]=[];for(let l=1;l<=F.maxLevel(k);l++){if(S.sourceOf(k)!=='upgrade')throw Error('Missing '+k);const d=S.dimensionsOf(k,l,F.KINDS[k].size);if(d.width<=prev.width||d.height<=prev.height)throw Error('Non growing '+k+l);families[k].push([d.width,d.height]);prev=d;count++}}
     return {count,families};
    });assert.equal(growth.count,121);report.growth=growth;
    // Compare all game thumbnails using their renderer's family-wide fit.
    const gallery=await context.newPage();await gallery.goto(url+'/#/puzzles');await gallery.waitForFunction(()=>window.__ggBooted);
    await gallery.evaluate(async()=>{
     const D=await import('/js/views/realm-3d.js'),S=await import('/js/views/realm-sprites.js'),F=await import('/js/core/realm.js');await D.load();
     document.body.innerHTML='';document.documentElement.style.cssText='height:auto;overflow:visible';document.body.style.cssText='position:static;height:auto;min-height:0;overflow:visible;max-width:none;display:block;margin:0;padding:16px;background:#274732;color:white;font:14px Arial;width:1980px';
     for(const k of S.KINDS){const row=document.createElement('div');row.style.cssText='display:flex;align-items:end;height:190px';for(let l=1;l<=F.maxLevel(k);l++){const cell=document.createElement('div');cell.style.cssText='width:164px;flex:none;text-align:center';const im=new Image();im.src=S.thumbURL(k,l);im.width=im.height=160;cell.append(im,document.createElement('br'),document.createTextNode(F.KINDS[k].name+' '+l));row.append(cell)}document.body.append(row)}
     const row=document.createElement('div');row.style.cssText='display:flex;align-items:end;height:190px';for(let l=1;l<=8;l++){const cell=document.createElement('div');cell.style.cssText='width:164px;text-align:center';const im=new Image();im.src=D.thumb('wall',l,{pri:0x762735,sec:0xE7BE56,sigil:'crown'});im.width=im.height=160;cell.append(im,document.createElement('br'),document.createTextNode('Wall '+l));row.append(cell)}document.body.append(row);
     await Promise.all([...document.images].map(i=>i.decode()));
    });await gallery.setViewportSize({width:2012,height:900});await gallery.screenshot({path:path.join(out,'all-upgrades-game-scale.png'),fullPage:true});await gallery.close();
    for(const max of [false,true]){
     await page.evaluate(async max=>{
      const F=await import('/js/core/realm.js'),s=F.mine(),types=F.ORDER.filter(t=>t!=='wall');s.b=types.map((t,i)=>({i:i+1,t,l:max?F.maxLevel(t):1,x:9+(i%4)*6,y:8+Math.floor(i/4)*6,u:0,c:Date.now()}));
      for(let l=1;l<=8;l++)s.b.push({i:100+l,t:'wall',l,x:10+l,y:34,u:0,c:Date.now()});s.nb=200;F.touch();
     },max);
     await page.locator('[data-rl-frame]').click();await page.waitForTimeout(600);await page.screenshot({path:path.join(out,(max?'maximum':'minimum')+'-390.png')});
    }
    await page.setViewportSize({width:1280,height:900});await page.locator('[data-rl-frame]').click();await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'maximum-1280.png')});
    const released=await page.evaluate(async()=>{const S=await import('/js/views/realm-sprites.js'),data=await import('/js/core/data.js');data.setMe('mason');return !S.ready()&&S.thumbURL('keep',1)===''});assert(released);await page.waitForTimeout(250);assert.equal(await page.locator('.rl-home').count(),0);
    const before=assets.length;await page.evaluate(async()=>{const S=await import('/js/views/realm-sprites.js');await S.load()});assert.equal(assets.length,before);
    report.owner={atlasRequests:assets.length,profileCleanup:true};
   }else{assert.equal(assets.length,0);assert.equal(await page.locator('.rl-home').count(),0);report[profile]={atlasRequests:0}}
   assert.deepEqual(errors,[],profile+' errors');await context.close();
  }
  // Execute service worker handlers to prove owner atlases never enter either shared cache.
  const handlers={},added=[],stored=[],fetched=[],response={ok:true,type:'basic',clone(){return this}},cache={add:async r=>added.push(r.url),put:async r=>stored.push(r.url)};
  const scope='https://example.test/gridiron-gangbang/';
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{self:{location:{origin:'https://example.test'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache,match:async()=>null,keys:async()=>[],delete:async()=>true},fetch:async r=>{fetched.push(r.url);return response},Request:class extends Request{constructor(u,o){super(new URL(u,scope),o)}},Response,URL,setTimeout});
  let done;handlers.install({waitUntil:p=>done=p});await done;assert(!added.some(u=>u.includes('/img/realm/upgrades-v1/')));
  for(const k of Object.keys(report.growth.families)){handlers.fetch({request:new Request(scope+'img/realm/upgrades-v1/'+k+'.webp'),respondWith:p=>done=p});await done}assert.equal(stored.length,0);assert.equal(fetched.length,14);report.sharedCacheExcluded=true;
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log('PASS: all121 decoded sprites, strict size growth, game thumbnails, mobile/desktop rendering, profile cleanup, member/guest denial, shared cache exclusion.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
