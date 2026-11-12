const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),pw=require('playwright');
const server=http.createServer((req,res)=>{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();if(p.endsWith('index.html'))b=Buffer.from(b.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(p)]||'application/octet-stream');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{const url='http://127.0.0.1:'+server.address().port;browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());await context.addInitScript(()=>{localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');localStorage.setItem('gg-release-3.0:evan','1');sessionStorage.setItem('gg-skip-title','1');});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/'+(process.env.PUZZLE_DAY?'?day='+process.env.PUZZLE_DAY:'')+'#/puzzles/daily');await page.waitForFunction(()=>window.__ggBooted);await page.locator('[data-challenge="stats"]').waitFor();
if(process.env.CHALLENGE_SCREENSHOT)await page.screenshot({path:process.env.CHALLENGE_SCREENSHOT,fullPage:true});
const before=await page.evaluate(async()=>JSON.stringify((await import('/js/core/daily.js')).DS));
for(const type of ['stats','connections','numbers']){await page.locator(`[data-challenge="${type}"]`).click();if(type==='numbers'){await page.locator('[data-number-dial]').press('End');await page.locator('[data-number-submit]').click();}if(type==='stats')await page.locator('[data-answer="higher"]').click();if(type==='connections')for(const group of [[0,1,2],[3,4,5]]){for(const i of group)await page.locator(`[data-player="${i}"]`).click();await page.locator('[data-check]').click();}assert.ok(await page.locator('.dc-feedback').count());await page.locator('[data-close]').click();}
assert.equal(await page.locator('.dc-state').allTextContents().then(x=>x.filter(t=>t.includes('Done')).length),3);
assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/core/daily.js')).DS)),before,'Bonus puzzles cannot alter ranked score');await page.reload();await page.locator('[data-challenge="stats"]').waitFor();assert.equal((await page.locator('.dc-state').allTextContents()).filter(t=>t.includes('Done')).length,3,'Completion persists');
for(const width of [320,390,820]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');}
const real = await page.evaluate(async()=>{const d=await import('/js/core/daily.js');return {steps:d.SLUGS,save:localStorage.getItem(d.SKEY)};});
await page.locator('[data-pz-test="on"]').click();
await page.locator('[data-test-day]').waitFor();
const sandbox = await page.evaluate(async()=>{const d=await import('/js/core/daily.js');return {test:d.TEST,steps:d.SLUGS,history:d.slugsFor(d.dayFor()),max:d.maxPts()};});
const slugs=['college','stats','connections','numbers'];
assert.ok(sandbox.test);assert.deepEqual(sandbox.steps,slugs);assert.deepEqual(sandbox.history,real.steps);assert.equal(sandbox.max,800);
await page.locator('[data-test-day]').click();
for(const [index,slug] of slugs.entries()) {
  await page.waitForFunction(s=>location.hash.endsWith('/play/'+s),slug);
  await page.locator(`[data-page="${slug}"]`).waitFor();
  assert.ok((await page.locator('.rn-count').textContent()).includes(`${index+1} of 4`));
  if(['college','mystery','journey','grid'].includes(slug)) await page.evaluate(async s=>{const d=await import('/js/core/daily.js');if(s==='college')while(!d.colDone())d.colPick(0);if(s==='mystery')d.whoGuess(d.DAY.w);if(s==='journey')d.journeyGuess(d.DAY.j.p);if(s==='grid')d.gridGiveUp();},slug);
  if(slug==='numbers'){await page.locator('[data-number-dial]').press('End');await page.locator('[data-number-submit]').click();}
  if(slug==='stats')await page.locator('[data-answer="higher"]').click();
  if(slug==='connections')for(const group of [[0,1,2],[3,4,5]]){for(const i of group)await page.locator(`[data-player="${i}"]`).click();await page.locator('[data-check]').click();}
  assert.equal(await page.evaluate(async i=>(await import('/js/core/daily.js')).STEPS[i].done(),index),true);
  // Verify that re-entering a new puzzle preserves its full-day result.
  await page.waitForTimeout(350);
  await page.locator('[data-rn-next]').click();
}
await page.waitForFunction(()=>location.hash==='#/puzzles/results');
await page.locator('.c-rbreak').waitFor();
assert.equal(await page.locator('.c-rb').count(),4,'All four games appear on the results screen');
assert.equal(await page.evaluate(async()=>(await import('/js/core/daily.js')).allDone()),true);
await page.evaluate(()=>{location.hash='/puzzles/daily';});await page.locator('[data-sample-refresh]').waitFor();
const sampleBefore=await page.evaluate(async()=>JSON.stringify((await import('/js/core/daily.js')).DAY));
await page.locator('[data-sample-refresh]').click();
assert.equal(await page.evaluate(async()=>(await import('/js/core/daily.js')).anyStarted()),false,'Fresh full day clears every game');
assert.notEqual(await page.evaluate(async()=>JSON.stringify((await import('/js/core/daily.js')).DAY)),sampleBefore);
await page.locator('[data-pz-test="off"]').click();
await page.waitForFunction(()=>[...document.querySelectorAll('.dc-state')].filter(x=>x.textContent.includes('Done')).length===3);
assert.deepEqual(await page.evaluate(async()=>{const d=await import('/js/core/daily.js');return {steps:d.SLUGS,save:localStorage.getItem(d.SKEY)};}),real,'Leaving Test Play restores real steps and save');
await page.locator('[data-pz-test="on"]').click();
await page.evaluate(async()=>{(await import('/js/views/daily-challenges.js')).openChallenge('numbers');});await page.evaluate(async()=>{(await import('/js/core/data.js')).setMe('mason');});
assert.equal(await page.evaluate(async()=>(await import('/js/core/daily.js')).TEST),false,'Profile change ends test play');await page.waitForFunction(()=>!document.querySelector('.dc-game'));assert.equal(await page.evaluate(async()=>(await import('/js/views/daily-challenges.js')).challengesHTML()),'','Pilot hidden for other profiles');assert.deepEqual(errors,[]);console.log('PASS: featured four-game test day, results, navigation, reset, save isolation and profile boundary');}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
