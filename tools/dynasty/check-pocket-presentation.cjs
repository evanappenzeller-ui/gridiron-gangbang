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
          // The tapped Active rises into the card preview: its attacks glow over the printed ones.
          const before=await page.evaluate(async()=>JSON.stringify((await import('/js/core/dynasty-solo.js')).get(window.testMid).G));
          await page.locator(`[data-rp-slot="${move.u}"][data-rp-side="0"]`).click();await page.waitForSelector('.rp-preview');
          const shown=await page.evaluate(async()=>{
            const S=await import('/js/core/dynasty-solo.js'),B=await import('/js/core/dynasty-pocket.js'),x=S.get(window.testMid);
            return {attacks:B.attacksOf(x.G,x.G.p[0].active.id).map((a,n)=>({name:a.name,legal:B.check(x.G,0,{a:'attack',n}).ok})),
              banners:[...document.querySelectorAll('.rp-preview [data-rp-preview-act]')].map(b=>({name:b.querySelector('b').textContent,on:!b.disabled})),
              retreat:!!document.querySelector('.rp-preview [data-rp-preview-retreat]'),hp:document.querySelector('.rp-preview-hp b').textContent};
          });
          assert.deepEqual(shown.banners,shown.attacks.map(a=>({name:a.name,on:a.legal})),label+' preview banners match the printed attacks and the engine’s legality');
          assert(shown.retreat,'the Active preview has a Retreat bar');
          assert(await page.locator('.rp-preview-banners').evaluate(el=>{const card=el.closest('.rp-preview-card'),b=el.getBoundingClientRect(),a=card.querySelector('.pk-c-art').getBoundingClientRect(),r=card.querySelector('.rp-preview-retreat').getBoundingClientRect();return b.top>=a.bottom-1&&r.top>=b.bottom-1&&r.bottom<=innerHeight&&b.bottom<=innerHeight;}),'banners sit under the player’s picture, Retreat under them, all on screen');
          await page.mouse.click(8,(await page.viewportSize()).height/2);
          await page.waitForFunction(()=>!document.querySelector('.rp-preview'));
          assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/core/dynasty-solo.js')).get(window.testMid).G)),before,'tapping outside sets the card down without a move');
          await page.locator(`[data-rp-slot="${move.u}"][data-rp-side="0"]`).click();await page.waitForSelector('.rp-preview');
          await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.rp-preview'));
          await page.locator(`[data-rp-slot="${move.u}"][data-rp-side="0"]`).click();await page.waitForSelector('.rp-preview');
          if(label==='evan'){await page.waitForTimeout(350);await page.screenshot({path:path.join(out,'preview.png')});}
          await page.locator('.rp-preview [data-rp-preview-act]:not([disabled])').first().click();
          await page.waitForSelector('[data-rp-scene="attack"]');
          assert.equal(await page.locator('.rp-preview').count(),0,'attacking sets the preview down');
          const expected=await page.evaluate(async()=>(await import('/js/core/dynasty-solo.js')).get(window.testMid).G.events.filter(e=>e.k==='attack'&&e.who===0).at(-1));
          assert.equal(await page.locator('.rp-attack-scene .rp-attack-name').innerText(),expected.name,'the attack’s name crosses the screen');
          if(expected.damage>0)assert.equal(await page.locator('.rp-attack-scene .rp-attack-damage').innerText(),String(expected.damage));
          assert.equal(await page.locator('.rp-attack-scene .rp-attack-card').count(),2,'attacker and defender cards play the scene');
          assert(await page.locator('.rp-cinema').evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.animationName==='rp-attack-band')),'the attack banner sweeps across');
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
      assert.equal(await page.locator('.rp-coin-result b').innerText(),'TAILS');
      const spin=await page.locator('.rp-coin3d').evaluate(async el=>{const a=el.style.transform;await new Promise(r=>setTimeout(r,200));return [a,el.style.transform];});
      assert.notEqual(spin[0],spin[1],'the coin spins');
      await page.waitForSelector('.rp-coin-scene.is-landed',{timeout:3000});
      assert(await page.locator('.rp-coin-scene').evaluate(el=>!el.classList.contains('is-up-heads')),'a tails coin lands tails up, with the cool tint');
      await page.keyboard.press('Escape');assert.equal(await page.locator('.rp-cinema').count(),0);
      // The Checkup flip names the reason and its outcome; a new condition shows a pill and Z's.
      const sleeper=await page.evaluate(()=>{const id=window.testX.G.p[1].active.id;window.testPresentation.enqueue([{k:'condition',who:1,id,condition:'asleep'},{k:'coin',who:1,heads:true,reason:'Sleep recovery',id}],window.testX);return id;});
      await page.waitForSelector('[data-rp-scene="condition"].is-asleep');
      const name=await page.evaluate(async id=>{const c=(await import('/js/core/dynasty-pocket-cards.js')).card(id);return c.athlete||c.name;},sleeper);
      assert.equal(await page.locator('.rp-status-pill').innerText(),name+' is now Asleep');
      assert.equal(await page.locator('.rp-status-scene .rp-status-z').count(),3,'sleep drifts in Z’s');
      assert.equal(await page.locator('.rp-status-scene .rp-status-badge.is-asleep').count(),1);
      if(label==='evan'){await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'asleep.png')});}
      await page.locator('.rp-status-scene').click({position:{x:30,y:300}});
      await page.waitForSelector('[data-rp-scene="coin"].is-heads');
      assert.equal(await page.locator('.rp-coin-pill').innerText(),'Checkup — Asleep');
      await page.waitForSelector('.rp-coin-scene.is-landed',{timeout:3000});
      assert.match(await page.locator('.rp-coin-result').innerText(),new RegExp('HEADS[\\s\\S]*'+name+' wakes up'));
      assert(await page.locator('.rp-coin-scene').evaluate(el=>el.classList.contains('is-up-heads')),'heads lands with the warm tint');
      if(label==='evan')await page.screenshot({path:path.join(out,'coin.png')});
      await page.waitForFunction(()=>!document.querySelector('.rp-cinema'),null,{timeout:4000});
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
      if(label==='evan'){
        // A real Sleep attack from the card preview: the name banner, the Asleep pill and the Checkup flip,
        // and the table agrees with the seeded flip (still Asleep on tails, awake on heads).
        const sleepMid=await page.evaluate(async()=>{
          const S=await import('/js/core/dynasty-solo.js'),B=await import('/js/core/dynasty-pocket.js');
          for(let i=0;i<120;i++){
            const r=S.start('g1'),x=S.get(r.mid);
            if(x.G.first!==1||!x.G.p[0].hand.includes('R7-jefferson'))continue;
            if(!S.move(r.mid,{a:'setup',act:'R7-jefferson',bench:[]}).ok)continue;
            return r.mid;
          }
          throw Error('no Jefferson opening');
        });
        await page.evaluate(async mid=>{window.testMid=mid;await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+mid);},sleepMid);
        await page.waitForSelector('.rp-arena');await drain(page);
        const ready=await page.evaluate(async()=>{
          const S=await import('/js/core/dynasty-solo.js'),B=await import('/js/core/dynasty-pocket.js'),x=S.get(window.testMid),p=x.G.p[0];
          if(p.active.id!=='R7-jefferson'||x.state!=='yours')return null;
          const e=B.legalActions(x.G,0).find(m=>m.a==='energy'&&m.on===p.active.u);if(e&&!S.move(window.testMid,e).ok)return null;
          return p.active.u;
        });
        assert(ready,'Jefferson is ready to attack');await drain(page);
        await page.locator(`[data-rp-slot="${ready}"][data-rp-side="0"]`).click();await page.waitForSelector('.rp-preview');
        await page.locator('.rp-preview [data-rp-preview-act]').filter({hasText:'Double Move'}).click();
        await page.waitForSelector('[data-rp-scene="attack"]');
        assert.equal(await page.locator('.rp-attack-name').innerText(),'Double Move');
        await page.locator('[data-rp-skip]').click();
        await page.waitForSelector('[data-rp-scene="condition"].is-asleep');
        await page.locator('[data-rp-skip]').click();
        await page.waitForSelector('[data-rp-scene="coin"]');
        assert.equal(await page.locator('.rp-coin-pill').innerText(),'Checkup — Asleep');
        const flip=await page.evaluate(async()=>{const G=(await import('/js/core/dynasty-solo.js')).get(window.testMid).G;const e=G.events.find(e=>e.k==='coin'&&e.reason==='Sleep recovery');return {heads:e.heads,u:G.p[1].active.u,asleep:!!G.p[1].active.conditions.asleep};});
        assert.equal(flip.asleep,!flip.heads,'only heads wakes the sleeper');
        assert.equal(await page.locator('.rp-coin-result b').innerText(),flip.heads?'HEADS':'TAILS');
        await page.locator('[data-rp-skip]').click();
        if(!flip.heads){
          await page.waitForFunction(()=>!document.querySelector('.rp-cinema'));
          assert.equal(await page.locator(`[data-rp-slot="${flip.u}"][data-rp-side="1"] .rp-status-badge.is-asleep`).count(),1,'the sleeping athlete wears the zZ badge');
        }
      }
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS '+label+': printed backs, card preview banners/retreat/set down, attack name banner, exact damage, Sleep pill and Z’s, coin toss tint and outcome, support flash, skip, sheet queue, reduced motion, privacy, cleanup and reload'+(label==='evan'?', real Sleep attack':''));
    }
  }finally{await browser.close();}
}
fs.mkdirSync(out,{recursive:true});server.listen(0,'127.0.0.1',()=>run(`http://127.0.0.1:${server.address().port}`).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close()));
