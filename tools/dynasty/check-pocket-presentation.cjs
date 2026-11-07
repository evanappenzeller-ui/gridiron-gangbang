// Offline real-browser regression for the presentation missing from the v7 battle.
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
let pw;try{pw=require('playwright');}catch{pw=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/rivals-presentation');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,bytes)=>{
    if(err)return res.writeHead(404).end();
    if(file.endsWith('index.html'))bytes=Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);
  });
});
async function drain(page){
  for(let i=0;i<150;i++){
    const skip=page.locator('[data-rp-skip]');if(await skip.count())await skip.click();
    const done=await page.evaluate(async()=>{const x=(await import('/js/core/dynasty-solo.js')).current();return x.state!=='theirs'&&!document.querySelector('.rp-cinema');});
    if(done)return;
    await page.waitForTimeout(100);
  }
  throw Error('Battle presentation did not settle');
}
async function run(url){
  const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    for(const [member,guest,label] of [['evan','','evan'],['jayton','','jayton'],['none','Ryan Stewart','ryan-stewart'],['none','Ryan Younggreen','ryan-younggreen']]){
      const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
      await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
      await ctx.addInitScript(({member,guest})=>{localStorage.setItem('gg-me',member);localStorage.setItem('gg-guest',guest);localStorage.setItem('gg-welcome','1');sessionStorage.setItem('gg-skip-title','1');['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen','visitor'].forEach(k=>localStorage.setItem('gg-release-3.0:'+k,'1'));}, {member,guest});
      const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(url+'/#/puzzles');await page.waitForFunction(()=>window.__ggBooted);
      await page.evaluate(async()=>{
        const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');await D.load();
        if(!(await import('/js/core/features.js')).rivalsUpdated())throw Error('wrong profile');
        if((await import('/js/core/fire.js')).canWrite())throw Error('live writes enabled');
        D.usePocketDeck('rental');const r=S.start('g1');if(!r.ok)throw Error(r.why);window.testMid=r.mid;
        await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+r.mid);
      });
      await page.waitForSelector('.rp-hidden .rp-card-back img');
      const backs=await page.locator('.rp-card-back img').evaluateAll(async imgs=>{await Promise.all(imgs.map(img=>img.decode()));return imgs.map(img=>({src:img.getAttribute('src'),width:img.naturalWidth,paint:getComputedStyle(img).display}));});
      assert(backs.length>=4);assert(backs.every(x=>x.src==='img/rivals/card-back-v1.webp'&&x.width>0&&x.paint!=='none'),label+' printed back loads in opening, hand and decks');
      if(label==='evan')await page.screenshot({path:path.join(out,'card-backs.png')});
      await page.evaluate(async()=>{
        const S=await import('/js/core/dynasty-solo.js'),B=await import('/js/core/dynasty-pocket.js');const x=S.get(window.testMid);
        const m=B.legalActions(x.G,0).find(m=>m.a==='setup');const r=S.move(window.testMid,m);if(!r.ok)throw Error(r.why);
      });
      let attacked=false;
      for(let step=0;step<35&&!attacked;step++){
        await drain(page);
        const move=await page.evaluate(async()=>{
          const S=await import('/js/core/dynasty-solo.js'),B=await import('/js/core/dynasty-pocket.js');const x=S.get(window.testMid),legal=B.legalActions(x.G,0);
          const m=legal.find(m=>['promote','choose-switch'].includes(m.a))||legal.find(m=>m.a==='energy'&&m.on===x.G.p[0].active?.u)||legal.find(m=>m.a==='attack')||legal.find(m=>m.a==='end');
          return m?{m,u:x.G.p[0].active?.u}:null;
        });
        assert(move,label+' has a legal move');
        if(move.m.a==='attack'){
          await page.locator(`[data-rp-slot="${move.u}"][data-rp-side="0"]`).click();
          await page.locator('.rp-sheet [data-rp-move]').filter({hasText:/^Attack:/}).first().click();
          await page.waitForSelector('[data-rp-scene="attack"]');
          const expected=await page.evaluate(async()=>(await import('/js/core/dynasty-solo.js')).get(window.testMid).G.events.filter(e=>e.k==='attack'&&e.who===0).at(-1));
          assert.equal(await page.locator('.rp-cinema .db-cinema-result strong').innerText(),expected.damage+' DAMAGE');
          assert.equal(await page.locator('.rp-cinema .db-athlete').count(),2);
          assert(await page.locator('.rp-cinema').evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running')),'stadium animations run');
          assert(await page.locator('[data-rp]').evaluate(el=>el.inert),'table cannot send moves during scenes');
          if(label==='evan')await page.screenshot({path:path.join(out,'attack.png')});
          assert(await page.evaluate(async()=>{
            const S=await import('/js/core/dynasty-solo.js'),before=JSON.stringify(S.get(window.testMid).G);
            document.querySelector('[data-rp-skip]').click();return before===JSON.stringify(S.get(window.testMid).G);
          }),'skipping never changes damage, RNG, turns or rewards');
          attacked=true;
        }else await page.evaluate(async m=>{const r=(await import('/js/core/dynasty-solo.js')).move(window.testMid,m);if(!r.ok)throw Error(r.why);},move.m);
      }
      assert(attacked,label+' uses animated attacks');await drain(page);
      // Isolate presentation edge cases on the real screen without changing the match.
      await page.evaluate(async()=>{
        const P=await import('/js/views/dynasty-pocket-presentation.js'),S=await import('/js/core/dynasty-solo.js');
        window.testPresentation=P.attachPresentation(document.querySelector('.v-dynasty-battle'),{enabled:()=>true,cancelHand:()=>{},sound:()=>{}});
        window.testX=S.get(window.testMid);window.testBefore=JSON.stringify(window.testX.G);
        window.testSheet=(await import('/js/core/ui.js')).openSheet({title:'Inspection',body:'Keep this sheet open',cls:'pk-sheet'});
        window.testPresentation.enqueue([{k:'coin',who:0,heads:false,reason:'Recorded result'}],window.testX);
      });
      await page.waitForTimeout(180);assert.equal(await page.locator('.rp-cinema').count(),0,'open sheets defer incoming scenes');
      await page.evaluate(()=>window.testSheet.close());await page.waitForSelector('[data-rp-scene="coin"]');
      assert.match(await page.locator('.rp-cinema').innerText(),/TAILS/);
      await page.keyboard.press('Escape');assert.equal(await page.locator('.rp-cinema').count(),0);
      // A played support card rises to center, flashes and bursts, without changing the match.
      const support=await page.evaluate(async()=>{
        const C=await import('/js/core/dynasty-pocket-cards.js'),p=window.testX.G.p[0];
        const id=[...p.hand,...p.deck,...p.discard].find(id=>['item','supporter'].includes(C.card(id)?.kind));
        window.testPresentation.enqueue([{k:'support',who:0,id,text:'Recorded play'},{k:'support',who:1,id,text:'Recorded play'}],window.testX);
        return C.card(id).name;
      });
      await page.waitForSelector('[data-rp-scene="support"].rp-play-flash.is-mine');
      assert((await page.locator('.rp-play-flash .rp-flash-card').innerText()).includes(support),'the played card is shown');
      assert.equal(await page.locator('.rp-play-flash .rp-flash-ring').count(),1);
      assert(await page.locator('.rp-play-flash .rp-flash-spark').count()>=8,'sparkles burst from the card');
      assert(await page.locator('.rp-play-flash').evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.animationName==='rp-flash-white')),'the card flashes');
      assert(await page.locator('[data-rp]').evaluate(el=>el.inert),'table cannot send moves during the flash');
      if(label==='evan'){await page.waitForTimeout(950);await page.screenshot({path:path.join(out,'support-flash.png')});}
      await page.locator('[data-rp-skip]').click();
      await page.waitForSelector('[data-rp-scene="support"].rp-play-flash.is-theirs');
      await page.waitForFunction(()=>!document.querySelector('.rp-cinema'),null,{timeout:4000});
      assert.equal(await page.locator('[data-rp]').evaluate(el=>el.inert),false,'the flash ends on its own');
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(()=>window.testPresentation.enqueue([{k:'coin',who:0,heads:true}],window.testX));
      assert.equal(await page.locator('.rp-cinema').count(),0,'reduced motion keeps the table and its status');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>{window.testPresentation.enqueue([{k:'draw',who:1,id:'PRIVATE'},{k:'search',who:1,id:'PRIVATE'}],window.testX);});
      assert.equal(await page.locator('.rp-cinema').count(),0,'hidden cards never enter presentation');
      assert(await page.evaluate(async()=>window.testBefore===JSON.stringify((await import('/js/core/dynasty-solo.js')).get(window.testMid).G)),'presentation leaves saved state unchanged');
      await page.evaluate(()=>{window.testPresentation.enqueue([{k:'coin',who:0,heads:true}],window.testX);window.testPresentation.stop();});
      assert.equal(await page.locator('.rp-cinema').count(),0,'cleanup removes scenes');
      assert.equal(await page.locator('[data-rp]').evaluate(el=>el.inert),false);
      await page.reload();await page.waitForSelector('.rp-arena');assert.equal(await page.locator('.rp-cinema').count(),0,'resume never replays historical animations');
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS '+label+': printed backs, actual animated attack, exact damage, support flash, skip, sheet queue, reduced motion, privacy, cleanup and reload');
    }
  }finally{await browser.close();}
}
fs.mkdirSync(out,{recursive:true});server.listen(0,'127.0.0.1',()=>run(`http://127.0.0.1:${server.address().port}`).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close()));
