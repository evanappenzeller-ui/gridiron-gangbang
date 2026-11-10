// Offline regression: replacement choices never cover scores or menu controls.
// Fixtures are legal seeded replays, with three Benched choices when available.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..'), shots = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
if (shots) fs.mkdirSync(shots, {recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  });
});
async function run(url) {
  const browser = await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const ctx = await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block',reducedMotion:'reduce'});
    await ctx.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    await ctx.addInitScript(() => {
      localStorage.setItem('gg-me','evan'); localStorage.setItem('gg-welcome','1');
      sessionStorage.setItem('gg-skip-title','1'); localStorage.setItem('gg-release-3.0:evan','1');
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url + '/#/puzzles'); await page.waitForFunction(() => window.__ggBooted);
    const fixtures = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'); await D.load();
      if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes enabled');
      const B = await import('/js/core/dynasty-pocket.js'), C = await import('/js/core/dynasty-pocket-cards.js');
      const dk = C.rentalDeck(), decks = [dk.ids,dk.ids], energy = [dk.energy,dk.energy], found = {};
      for (let seed=0; seed<200 && Object.keys(found).length<2; seed++) {
        const G = B.newGame('choice-diagnosis-' + seed, decks, {energy,rev:2}), log = [];
        const apply = (who,m) => { const result=B.apply(G,who,m); if (!result.ok) throw Error(result.why); log.push([who,m]); };
        apply(0,B.nextMove(G,0,10)); apply(1,B.nextMove(G,1,10));
        for (let i=0; i<300 && G.phase !== 'over'; i++) {
          const kind = G.who === 0 && G.p[0].bench.length === 3 && (G.p[0].promote ? 'promote' : G.pending?.who === 0 ? 'switch' : '');
          if (kind && !found[kind]) found[kind] = JSON.parse(JSON.stringify({id:'cpufelt' + kind,opp:'g1',seed:G.seed,v:7,rev:2,decks,energy,log,at:Date.now(),z:'',paid:0,pay:null}));
          if (Object.keys(found).length === 2) break;
          const actions = B.legalActions(G,G.who);
          // Choose the legal support card when it can produce the widest choice row.
          const switchMove = G.who === 1 && G.p[0].bench.length === 3 && actions.find(m => m.a === 'support' && m.id === 'P7-matchup');
          const move = switchMove || B.nextMove(G,G.who,10); if (!move) break;
          apply(G.who,move);
        }
      }
      if (!found.promote || !found.switch) throw Error('Missing legal three-choice fixture');
      return found;
    });
    for (const [kind, record] of Object.entries(fixtures)) for (const [width,height] of [[320,568],[390,844]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(record => localStorage.setItem('gg-dys2-m_evan',JSON.stringify(record)), record);
      await page.goto(url + '/?felt-choice=' + kind + width + '#/puzzles/dynasty/battle/' + record.id);
      await page.waitForSelector('.rp-turn-action.is-choice');
      await page.waitForFunction(() => window.__ggBooted);
      await page.waitForTimeout(350); // Let the initial route transition finish before screenshots/hit tests.
      const before = await page.evaluate(async mid => {
        const S = await import('/js/core/dynasty-solo.js'), B = await import('/js/core/dynasty-pocket.js'), x = S.get(mid);
        return {move:B.legalActions(x.G,0)[2],collection:JSON.stringify((await import('/js/core/dynasty.js')).mine().o),log:JSON.parse(localStorage.getItem('gg-dys2-m_evan')).log.length};
      }, record.id);
      assert.equal(before.move.a, kind === 'promote' ? 'promote' : 'choose-switch');
      assert.equal(await page.locator('[data-rp-choice]').count(),3,'all three replacements remain available');
      assert.equal(await page.locator('[data-rp-end]').count(),0,'choice replaces unavailable End turn');
      const geometry = await page.evaluate(() => {
        const selectors = ['.rp-manager.is-mine','.rp-manager.is-opponent','.rp-menu','[data-rp-choice="0"]','[data-rp-choice="1"]','[data-rp-choice="2"]'];
        return selectors.map(selector => {
          const el=document.querySelector(selector), r=el.getBoundingClientRect();
          const cx=r.left+r.width/2,cy=r.top+r.height/2;
          const pts=el.tagName === 'BUTTON' ? [[r.left+5,cy],[r.right-5,cy],[cx,r.top+5],[cx,r.bottom-5],[cx,cy]]
            : [[r.left+5,r.top+5],[r.right-5,r.top+5],[r.left+5,r.bottom-5],[r.right-5,r.bottom-5],[cx,cy]];
          return {selector,width:r.width,height:r.height,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,clear:pts.every(([x,y])=>el.contains(document.elementFromPoint(x,y))),textFits:el.scrollHeight<=el.clientHeight+1};
        });
      });
      for (const target of geometry) {
        assert(target.inside && target.clear,`${kind} ${width}: uncovered target ${JSON.stringify(target)}`);
        if (target.selector.includes('data-rp-choice')) assert(target.width>=44&&target.height>=44&&target.textFits,`${kind} ${width}: readable tappable choice ${JSON.stringify(target)}`);
      }
      if (shots) await page.screenshot({path:path.join(shots,`${kind}-${width}.png`)});
      await page.locator('[data-rp-choice="2"]').click();
      const after = await page.evaluate(async mid => {
        const x=(await import('/js/core/dynasty-solo.js')).get(mid);
        return {active:x.G.p[0].active.u,promote:x.G.p[0].promote,pending:x.G.pending,collection:JSON.stringify((await import('/js/core/dynasty.js')).mine().o),record:JSON.parse(localStorage.getItem('gg-dys2-m_evan'))};
      }, record.id);
      assert.equal(after.active,before.move.u,'the tapped replacement becomes Active');
      assert.equal(after.promote,false); assert.equal(after.pending,null);
      assert.equal(after.record.log.length,before.log+1,'one tap resolves one move');
      assert.deepEqual(after.record.log.at(-1),[0,before.move]);
      assert.equal(after.collection,before.collection,'replacement does not alter collection');
      assert.equal(await page.locator('.rp-turn-action.is-choice').count(),0,'normal footer returns after selection');
      console.log(`PASS ${kind}: three readable choices, uncovered scores/menu, correct move at ${width}px`);
    }
    assert.deepEqual(errors,[],'no browser exceptions');
    await ctx.close();
  } finally { await browser.close(); }
}
server.listen(0,'127.0.0.1',async()=>{try{await run('http://127.0.0.1:'+server.address().port);}catch(error){console.error(error);process.exitCode=1;}finally{server.close();}});
