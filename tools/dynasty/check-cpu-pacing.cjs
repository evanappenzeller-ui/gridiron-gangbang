// Real offline browser checks: CPU turns wait for the player to see each resolved play.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err,bytes) => {
    if (err) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
const record = page => page.evaluate(() => JSON.parse(localStorage.getItem(window.pacingKey)));
const count = async page => (await record(page)).log.length;
async function unchanged(page, n, ms, message) {
  await page.waitForTimeout(ms);
  assert.equal(await count(page), n, message);
}
async function skipScenes(page) {
  for (let i=0; i<12 && await page.locator('[data-rp-skip]').count(); i++) await page.locator('[data-rp-skip]').click();
  assert.equal(await page.locator('.rp-cinema').count(), 0);
}
async function run(url) {
  const browser = await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const profiles = [['evan','','evan'],['jayton','','jayton'],['none','Ryan Stewart','ryan-stewart'],['none','Ryan Younggreen','ryan-younggreen']];
    for (const [member,guest,label] of profiles) {
      const reduce = label === 'ryan-younggreen';
      const ctx = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:reduce ? 'reduce' : 'no-preference'});
      await ctx.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
      await ctx.addInitScript(({member,guest}) => {
        localStorage.setItem('gg-me', member); localStorage.setItem('gg-guest', guest);
        localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
        ['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen'].forEach(k => localStorage.setItem('gg-release-3.0:'+k,'1'));
      }, {member,guest});
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(url + '/#/puzzles'); await page.waitForFunction(() => window.__ggBooted);
      // Build a legal seeded replay just before a plain player attack, followed by a
      // multi-action CPU turn. Reload it through the production persistence layer.
      const fixture = await page.evaluate(async () => {
        const D = await import('/js/core/dynasty.js'); await D.load();
        if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes enabled');
        const B = await import('/js/core/dynasty-pocket.js'), C = await import('/js/core/dynasty-pocket-cards.js');
        const deck = C.rentalDeck(), decks = [deck.ids,deck.ids], energy = [deck.energy,deck.energy];
        for (let seed=0; seed<60; seed++) {
          const G = B.newGame('cpu-pacing-'+seed, decks, {energy,rev:2}), log = [];
          const apply = (who,m) => { if (!B.apply(G,who,m).ok) throw Error('Illegal fixture'); log.push([who,m]); };
          apply(0,B.nextMove(G,0,1)); apply(1,B.nextMove(G,1,1));
          for (let i=0; i<100 && G.phase !== 'over'; i++) {
            if (G.who === 0) {
              for (const attack of B.legalActions(G,0).filter(m => m.a === 'attack')) {
                if (B.attacksOf(G,G.p[0].active.id)[attack.n].effect) continue;
                const after = structuredClone(G);
                if (!B.apply(after,0,attack).ok || after.phase === 'over' || after.who !== 1 || after.pending) continue;
                const next = B.nextMove(after,1,1);
                if (!next || ['attack','end'].includes(next.a)) continue;
                if (!B.apply(after,1,next).ok || after.who !== 1) continue;
                const saved = {id:'cpupacing',opp:'g1',seed:G.seed,v:7,rev:2,decks,energy,log,at:Date.now(),z:'',paid:0,pay:null};
                const key = 'gg-dys2-' + (await import('/js/core/realm-active.js')).profileKey();
                localStorage.setItem(key,JSON.stringify(saved));
                return {key,attack};
              }
            }
            apply(G.who,B.nextMove(G,G.who,1));
          }
        }
        throw Error('No pacing fixture');
      });
      await page.goto(url + '/?cpu-pacing=' + label + '#/puzzles/dynasty/battle/cpupacing');
      await page.waitForSelector('.rp-arena');
      await page.evaluate(key => { window.pacingKey = key; }, fixture.key);
      assert.equal(await page.locator('.rp-opponent-hand .pk-card').count(),0,'opponent hand stays face down');
      await page.evaluate(async attack => {
        const result = (await import('/js/core/dynasty-solo.js')).move('cpupacing',attack);
        if (!result.ok) throw Error(result.why);
      }, fixture.attack);
      let n = await count(page);
      if (!reduce) {
        await page.waitForSelector('[data-rp-scene="attack"]');
        await unchanged(page,n,2100,label + ': CPU waits for the player attack result');
        await skipScenes(page);
      } else {
        assert.equal(await page.locator('.rp-cinema').count(),0,'reduced motion omits scenes');
        await unchanged(page,n,1100,'reduced motion retains the slower CPU beat');
      }
      // Inspecting the CPU athlete pauses its turn without changing any saved move.
      await page.locator('.rp-side.is-opponent .rp-active [data-rp-slot]').click();
      await page.waitForSelector('.rp-preview');
      await unchanged(page,n,2300,label + ': CPU waits for the card preview');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.rp-preview'));
      await unchanged(page,n,1500,label + ': closing the preview does not cause a catch-up move');
      await page.locator('[data-rp-menu]').click();
      await page.waitForSelector('.sheet');
      await unchanged(page,n,2300,label + ': CPU waits for the menu');
      await page.locator('.sheet [data-sheet-close]').last().click();
      await page.waitForFunction(() => !document.querySelector('.sheet'));
      await unchanged(page,n,1500,label + ': menu dismissal keeps a readable pause');
      await page.waitForFunction(n => JSON.parse(localStorage.getItem(window.pacingKey)).log.length === n+1,n,{timeout:3000});
      n++;
      const showingResult = await page.locator('.rp-cinema').count() > 0;
      await unchanged(page,n,showingResult ? 2100 : 1500,label + ': CPU plays only one action per beat');
      if (showingResult) assert.equal(await page.locator('.rp-cinema').count(),1,label + ': opponent result remains visible for reading');
      if (label === 'evan') {
        // Backgrounding and leaving the route preserve the active turn; reopening
        // resumes it instead of playing unseen moves or replaying old results.
        await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
        await unchanged(page,n,2300,'backgrounded match does not advance');
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await unchanged(page,n,1500,'foreground resume has a full pause');
        await page.evaluate(async () => { await (await import('/js/app.js')).nav('/puzzles/dynasty'); });
        const left = await count(page);
        await unchanged(page,left,2300,'Rivals hub does not play an unseen CPU turn');
        await page.evaluate(async () => { await (await import('/js/app.js')).nav('/puzzles/dynasty/battle/cpupacing'); });
        await page.waitForSelector('.rp-arena');
        await page.locator('[data-rp-menu]').click(); await page.waitForSelector('.sheet');
        const saved = await record(page);
        await page.evaluate(async () => { (await import('/js/core/data.js')).setMe('mason'); });
        await page.waitForFunction(() => !document.querySelector('.rp-battle'));
        await page.waitForTimeout(2300);
        assert.deepEqual(await record(page),saved,'profile switch cancels the old match timer');
      }
      assert.deepEqual(errors,[],label + ': no browser exceptions');
      console.log('PASS CPU pacing: ' + label + (reduce ? ' (reduced motion)' : '') + ', results, preview, menu, one action per beat');
      await ctx.close();
    }
  } finally { await browser.close(); }
}
(async () => { await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); try { await run('http://127.0.0.1:'+server.address().port); } finally { await new Promise(resolve => server.close(resolve)); } })().catch(e => { console.error(e); process.exitCode=1; });
