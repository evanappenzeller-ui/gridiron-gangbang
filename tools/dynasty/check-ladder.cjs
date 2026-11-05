// Owner boss ladder: actual saved games, one-time rewards, legacy saves and responsive UI. Offline only.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/rivals-ladder');
fs.mkdirSync(out, {recursive: true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(p, (err, buf) => {
    if (err) return res.writeHead(404).end();
    if (p.endsWith('index.html')) buf = Buffer.from(buf.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(p)] || 'application/octet-stream'}).end(buf);
  });
});
async function run(url) {
  const browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const ctx = await browser.newContext({viewport: {width:390,height:844}, serviceWorkers:'block', reducedMotion:'reduce'});
    await ctx.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
    await ctx.addInitScript(() => { if (!localStorage.getItem('gg-me')) localStorage.setItem('gg-me','evan'); localStorage.setItem('gg-welcome','1'); localStorage.setItem('gg-release-3.0:evan','1'); });
    const page = await ctx.newPage(), errors=[];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url+'/#/puzzles'); await page.waitForFunction(() => window.__ggBooted);
    const result = await page.evaluate(async () => {
      const D=await import('/js/core/dynasty.js'), S=await import('/js/core/dynasty-solo.js'), B=await import('/js/core/dynasty-battle.js'), T=await import('/js/core/dynasty-table.js');
      await D.load();
      const ok=(v,m)=>{if(!v)throw Error(m);}, s=D.mine(), snap=x=>JSON.stringify(x), rows=[];
      ok(!(await import('/js/core/fire.js')).canWrite(),'live writes must be off');
      const fresh=D.fresh('m_fixture',1000), original=snap(fresh);
      ok(S.unlocked('g1',fresh)&&!S.unlocked('g2',fresh),'only first game unlocked');
      for(const res of ['l','d']) { const t=D.fresh('m_fixture',1000); D.paySolo('no-'+res,'g1',1,res,t); ok(!S.unlocked('g2',t),'no unlock on loss/draw'); }
      D.paySolo('first','g1',1,'w',fresh); ok(S.unlocked('g2',fresh)&&!S.unlocked('g3',fresh),'win unlocks exactly next');
      ok(S.start('g5').ok===false,'start API rejects locked boss');
      ok(S.start('g6').ok===false,'start API rejects skipping boss');
      for (const [id,cid] of Object.entries(D.SOLO_BOSSES)) {
        const n=Number(id.slice(1)), c=D.soloBoss(id), t=D.fresh('m_boss',1000);
        ok(c?.id===cid&&c.o>=80,'real Epic+ boss '+id);
        const owned=snap(t.o);
        for(const res of ['l','d']) { D.paySolo(id+res,id,n,res,t,cid); ok(snap(t.o)===owned&&!t.bossRewards,'no prize for '+res); }
        // An old fifth-stage win never earns a card; the upgraded boss can still be replayed for it.
        D.paySolo(id+'old',id,n,'w',t); ok(snap(t.o)===owned&&!t.bossRewards,'legacy reward stays unchanged');
        const before=t.o[cid]||0, paid=D.paySolo(id+'new',id,n,'w',t,cid);
        ok(paid.card===cid&&t.o[cid]===before+1&&t.bossRewards[id]===cid,'correct boss card paid');
        ok(t.nw.includes(cid)&&t.lp[0]===cid,'reward discoverable in binder');
        ok(D.paySolo(id+'new',id,n,'w',t,cid)===null,'same match pays once');
        let clean=D.clean(JSON.parse(snap(t)));
        for(let i=0;i<25;i++) D.paySolo(id+'replay'+i,id,n,'w',clean,cid);
        ok(clean.o[cid]===before+1&&clean.bossRewards[id]===cid,'permanent receipt outlives recent-match ledger');
        delete clean.o[cid]; D.paySolo(id+'sold',id,n,'w',clean,cid);
        ok(!clean.o[cid],'selling card cannot re-earn the boss reward');
        rows.push({n,name:c.name,rarity:c.r});
      }
      // Give the isolated fixture an existing collection/deck, keeping the production save mechanics.
      const strongest=D.CARDS.filter(c=>B.POS_TYPE[c.pos]==='A').sort((a,b)=>b.o-a.o).slice(0,18);
      strongest.forEach(c=>s.o[c.id]=2); D.setDeck(D.autoDeck(s.o));
      const selected=strongest.slice(0,16).flatMap(c=>[c.id,c.id]).concat(Object.entries(T.PLAYBOOK).flatMap(([id,n])=>Array(n).fill(id)));
      ok(D.setTableDeck(selected).ok,'valid saved 40-card deck');
      for(let n=1;n<=29;n++)s.so['g'+n]=1;
      D.touch();
      for(const [id,cid] of Object.entries(D.SOLO_BOSSES)) for(const type of ['A','G','B','C']) {
        const deck=S.bossDeckFor(id,type), counts={};deck.forEach(c=>counts[c]=(counts[c]||0)+1);
        ok(deck.length===40&&counts[cid]===2&&Object.values(counts).every(n=>n<=2),'legal boss deck '+id+type);
      }
      for(const [id,cid] of Object.entries(D.SOLO_BOSSES)) {
        const started=S.start(id);ok(started.ok,'start boss '+id);
        const x=S.get(started.mid),r=JSON.parse(localStorage.getItem('gg-dys-m_evan'));
        ok(x.boss===cid&&x.G.p[1].active.id===cid,'boss actually fields reward card '+id);
        const replay=B.newGame(r.seed,r.decks,r.v);r.log.forEach(([who,m])=>ok(B.play(replay,who,m).ok,'replay boss opening'));
        ok(snap(replay)===snap(x.G),'boss setup replays unchanged');
      }
      // A genuine complete winning log, then reload: the normal match reader must award the card exactly once.
      let fixture=null;
      for(let attempt=0;attempt<20&&!fixture;attempt++) {
        S.start('g5');const r=JSON.parse(localStorage.getItem('gg-dys-m_evan'));
        const G=B.newGame(r.seed,r.decks,r.v);r.log.forEach(([who,m])=>ok(B.play(G,who,m).ok,'saved setup'));
        for(let i=0;i<1200&&G.phase!=='over';i++) {
          const who=B.toMove(G), m=S.nextMove(G,who,who===0?'exp':5);
          const got=B.play(G,who,m);ok(got.ok,'simulation legal: '+got.why);r.log.push([who,m]);
        }
        if(G.over?.win===0)fixture=r;
      }
      ok(fixture,'boss fixture reaches a real win');
      // UI begins with four wins: match 5 open, match 6 still locked until the saved victory is settled.
      s.so=Object.fromEntries([1,2,3,4].map(n=>['g'+n,1]));D.touch();
      const count=s.o[D.SOLO_BOSSES.g5]||0;
      localStorage.setItem('gg-dys-m_evan',snap(fixture));
      return {rows,fixture,count};
    });
    console.log('PASS ladder progression, six Epic+ bosses, 24 legal decks, exact featured lineups, one-time rewards and save round trips',result.rows);
    await page.reload();await page.waitForFunction(()=>window.__ggBooted);
    const settled=await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');await D.load();const x=S.get(),s=D.mine();
      S.get();return {state:x.state,result:x.result,card:x.pay.card,count:s.o[x.pay.card],next:S.unlocked('g6'),locked:!S.unlocked('g7'),receipt:s.bossRewards,record:JSON.parse(localStorage.getItem('gg-dys-m_evan'))};
    });
    assert.equal(settled.state,'over');assert.equal(settled.result,'w');assert.equal(settled.card,'L0036322');assert.equal(settled.count,result.count+1);assert.equal(settled.next,true);assert.equal(settled.locked,true);
    await page.evaluate(async()=>{const a=await import('/js/app.js');await a.nav('/puzzles/dynasty');});
    await page.waitForSelector('.pk-start.is-ready');await page.locator('.pk-start').click({position:{x:195,y:640}});await page.waitForFunction(()=>!document.querySelector('.pk-start'));
    await page.locator('.pk-nav [data-dy-tab="battle"]').click();await page.waitForSelector('.rl-ladder');
    await page.waitForFunction(()=>[...document.querySelectorAll('.rl-showcase img')].every(i=>i.complete));
    await page.locator('.rl-showcase img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal(await page.locator('.rl-showcase .pk-c-ph').evaluateAll(imgs=>imgs.length===3&&imgs.every(i=>i.naturalWidth>0)),true,'all showcased boss photos load');
    assert.equal(await page.locator('.rl-match').count(),30);assert.equal(await page.locator('.rl-match.is-boss').count(),6);
    assert.equal(await page.locator('[data-ladder-stage="g5"] .rl-match-reward').textContent(),'Boss card earned');
    assert.equal(await page.locator('[data-dy-solo="g6"]').isEnabled(),true);assert.equal(await page.locator('[data-dy-solo="g7"]').isDisabled(),true);
    for(const [width,height] of [[390,844],[320,568],[430,932],[768,1024]]) {
      await page.setViewportSize({width,height});await page.waitForTimeout(150);
      const fits=await page.evaluate(()=>{const p=document.querySelector('.pk-pane');return p.scrollWidth<=p.clientWidth+1;});assert.equal(fits,true,'no overflow '+width);
      await page.screenshot({path:path.join(out,'ladder-'+width+'.png')});
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-dy-ladder-next]').click();await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>document.querySelector('.pk-hdr').getBoundingClientRect().top>=0),true,'jump keeps the header fixed');
    await page.screenshot({path:path.join(out,'next-battle.png')});
    await page.evaluate(()=>{const p=document.querySelector('.pk-pane'),r=document.querySelector('[data-ladder-stage="g10"]');p.scrollTop+=r.getBoundingClientRect().top-p.getBoundingClientRect().top-80;});
    await page.screenshot({path:path.join(out,'boss-locked.png')});
    await page.locator('[data-dy-solo="g6"]').click();await page.waitForSelector('.db');
    await page.goBack();await page.waitForSelector('.rl-ladder');
    assert.equal(await page.locator('.rl-resume').isVisible(),true);
    // Render the real boss victory after returning from the game without restarting anything.
    await page.evaluate(r=>localStorage.setItem('gg-dys-m_evan',JSON.stringify(r)),settled.record);
    await page.reload();await page.waitForFunction(()=>window.__ggBooted);
    await page.evaluate(async mid=>{const D=await import('/js/core/dynasty.js');await D.load();await (await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+mid);},result.fixture.id);
    await page.waitForSelector('.db-boss-prize');
    assert.match(await page.locator('.db-boss-prize').textContent(),/Justin Jefferson.*Epic/);
    assert.equal(await page.evaluate(async()=>{const D=await import('/js/core/dynasty.js');return D.mine().o.L0036322;}),result.count+1,'reload did not duplicate card');
    await page.screenshot({path:path.join(out,'boss-victory.png')});
    assert.deepEqual(errors,[]);
    await ctx.close();
    // Scope: Ryan retains the deployed list and 20-card game; guests cannot get this pilot by typing Evan's name.
    for(const profile of ['ryan-stewart','mason','guest','visitor']) {
      const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},reducedMotion:'reduce'});
      await c.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
      await c.addInitScript(p=>{localStorage.setItem('gg-me',p==='mason'?'mason':'none');if(p==='ryan-stewart')localStorage.setItem('gg-guest','Ryan Stewart');if(p==='guest')localStorage.setItem('gg-guest','Evan Appenzeller');localStorage.setItem('gg-welcome','1');['evan','mason','user%3Aryan-stewart','visitor'].forEach(k=>localStorage.setItem('gg-release-3.0:'+k,'1'));},profile);
      const q=await c.newPage();await q.goto(url+'/#/puzzles');await q.waitForFunction(()=>window.__ggBooted);
      const scope=await q.evaluate(async()=>{const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');await D.load();if(!D.mayPlay())return {open:D.bossLadderOpen(),boss:D.soloBoss('g5'),plays:false};const s=D.mine();D.open('start',{free:false});for(let n=1;n<=4;n++)s.so['g'+n]=1;const r=S.start('g5'),before=JSON.stringify(s.o);D.paySolo('scope','g5',5,'w',s,D.SOLO_BOSSES.g5);return {open:D.bossLadderOpen(),boss:D.soloBoss('g5'),v:S.get(r.mid).G.v,unchanged:JSON.stringify(s.o)===before,receipt:s.bossRewards||null,plays:true};});
      assert.equal(scope.open,false);assert.equal(scope.boss,null);
      if(profile==='ryan-stewart') {assert.equal(scope.v,5);assert.equal(scope.unchanged,true);assert.equal(scope.receipt,null);
        await q.evaluate(async()=>{await(await import('/js/app.js')).nav('/puzzles/dynasty');});await q.waitForSelector('.pk-start.is-ready');await q.locator('.pk-start').click({position:{x:195,y:640}});await q.waitForFunction(()=>!document.querySelector('.pk-start'));
        await q.locator('[data-dy-bv="solo"]').click();await q.waitForSelector('.pk-solo');assert.equal(await q.locator('.rl-ladder').count(),0);
      } else assert.equal(scope.plays,false);
      await c.close();
    }
    console.log('PASS actual win and reload, visible earned card, next-battle unlock, responsive ladder, resume, Ryan legacy UI and guest boundaries');
  } finally {await browser.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
