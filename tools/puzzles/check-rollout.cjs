const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),pw=require('playwright');
const server=http.createServer((req,res)=>{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();if(p.endsWith('index.html'))b=Buffer.from(b.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(p)]||'application/octet-stream');res.end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const url='http://127.0.0.1:'+server.address().port;
  browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
  await context.addInitScript(()=>{localStorage.setItem('gg-me','mason');localStorage.setItem('gg-welcome','1');localStorage.setItem('gg-release-3.0:mason','1');sessionStorage.setItem('gg-skip-title','1');});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const open=async day=>{await page.goto(url+'/?day='+day+'#/puzzles/daily');await page.waitForFunction(()=>window.__ggBooted);await page.waitForFunction(async()=>(await import('/js/core/daily.js')).status==='ready');};
  await open(46);
  assert.equal(await page.evaluate(async()=>(await import('/js/core/daily.js')).dayVersion()),4,'November 12 stays unchanged');
  assert.equal(await page.locator('[data-challenge]').count(),0,'No preview for another profile today');
  await open(47);
  assert.equal(await page.evaluate(async()=>(await import('/js/core/daily.js')).dayVersion()),5,'November 13 activates shared rollout');
  assert.equal(await page.locator('[data-puzzle-jump]').count(),8);
  await page.locator('[data-cta]').click();
  const slugs=['college','mystery','journey','grid','stats','timeline','connections','numbers'];
  for(const [i,slug] of slugs.entries()){
   await page.waitForFunction(s=>location.hash.endsWith('/play/'+s),slug);await page.locator(`[data-page="${slug}"]`).waitFor();
   if(i<4)await page.evaluate(async s=>{const d=await import('/js/core/daily.js');if(s==='college')while(!d.colDone())d.colPick(0);if(s==='mystery')d.whoGuess(d.DAY.w);if(s==='journey')d.journeyGuess(d.DAY.j.p);if(s==='grid')d.gridGiveUp();},slug);
   if(slug==='stats')await page.locator('[data-answer="higher"]').click();
   if(slug==='timeline')for(const k of [0,1,2,3])await page.locator(`[data-stop="${k}"]`).click();
   if(slug==='connections')for(const g of [[0,1,2],[3,4,5]]){for(const k of g)await page.locator(`[data-player="${k}"]`).click();await page.locator('[data-check]').click();}
   if(slug==='numbers'){
    const dial=page.locator('[data-number-dial]');assert.equal(await dial.getAttribute('aria-valuemax'),'5000');
    const box=await dial.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height*.1);
    assert.equal(await dial.getAttribute('aria-valuenow'),'2500','Top of dial is midpoint');
    await page.mouse.move(box.x+box.width*.1,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.9,box.y+box.height/2,{steps:4});await page.mouse.up();assert.ok(Number(await dial.getAttribute('aria-valuenow'))>4000,'Dragging updates the dial');
    await dial.press('End');assert.equal(await dial.getAttribute('aria-valuenow'),'5000');
    await dial.press('ArrowLeft');assert.equal(await dial.getAttribute('aria-valuenow'),'4999');
    await dial.press('Home');assert.equal(await dial.getAttribute('aria-valuenow'),'0');
    await dial.press('End');
    await page.waitForTimeout(400);if(process.env.TRIVIA_SCREENSHOT)await page.screenshot({path:process.env.TRIVIA_SCREENSHOT,fullPage:true});
    await page.locator('[data-number-submit]').click();assert.ok((await page.locator('.dc-feedback').textContent()).includes('185 / 200 points'));
   }
   await page.waitForTimeout(350);await page.locator('[data-rn-next]').click();
  }
  await page.locator('.c-rbreak').waitFor();assert.equal(await page.locator('.c-rb').count(),8);
  const score=await page.evaluate(async()=>{const d=await import('/js/core/daily.js');const e=d.boardEntry();return {e,p:d.totalPts(),max:d.maxPts(),entry:d.entryFor({days:{47:e}},47),old:d.entryFor({days:{47:{v:4,p:600}}},47),text:d.shareText(),points:d.pointsFor(JSON.parse(JSON.stringify(d.DS)),47),rows:d.boardRows('today',[{id:'sample',nick:'Mason',days:{47:e}}],47)};});
  assert.equal(score.e.v,5);assert.equal(score.e.b.numbers,185);assert.equal(score.e.p,score.p);assert.equal(score.max,1600);assert.deepEqual(score.entry,score.e);assert.equal(score.old,null);assert.equal(score.points,score.p);assert.equal(score.rows.length,1);assert.ok(score.text.includes('Number Trivia'));assert.ok(!score.text.includes('Test day'));
  await page.reload();await page.locator('.c-rbreak').waitFor();assert.equal(await page.locator('.c-rb').count(),8,'Real completion survives reload');
  await open(48);await page.locator('[data-puzzle-jump="7"]').click();const dial=page.locator('[data-number-dial]');await dial.waitFor();assert.equal(await dial.getAttribute('aria-valuemax'),'10','Championship question changes scale');await dial.press('Home');for(let i=0;i<6;i++)await dial.press('ArrowRight');await page.locator('[data-number-submit]').click();assert.ok((await page.locator('.dc-feedback').textContent()).includes('200 / 200 points'));
  const scoring=await page.evaluate(async()=>{const {NUMBER_QUESTIONS:q,numberPoints:p}=await import('/js/views/number-trivia.js');return q.map(x=>[p(x,x.answer),p(x,x.answer-1),p(x,0)]);});for(const [exact,near,far]of scoring){assert.equal(exact,200);assert.ok(exact>=near&&near>far);}
  assert.deepEqual(errors,[]);console.log('PASS: Nov 13 shared rollout, full real day, adaptive dial, proximity scoring, versioned board entries and persistence');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
