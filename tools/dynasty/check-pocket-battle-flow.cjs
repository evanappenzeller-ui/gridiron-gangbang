// Offline browser regression: presentation must reveal a resolved move in order,
// without applying it twice, and a Solo win offers the next ladder game.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const shots = process.argv.includes('--shots') ? path.join(root,'output/rivals-battle-flow') : null;
if (shots) fs.mkdirSync(shots,{recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => {
    if (err) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
const scene = page => page.locator('[data-rp-scene]');
async function skip(page) {
  await page.evaluate(() => document.querySelector('[data-rp-skip]')?.click());
}
async function animated(page, selector, label) {
  assert(await page.locator(selector).first().evaluate(el => el.getAnimations({subtree:true}).some(a => a.playState === 'running')), label + ' has a running animation');
}
async function screenshot(page, name) {
  if (!shots) return;
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(shots,name + '.png')});
}
async function drain(page) {
  const seen = [];
  for (let i = 0; i < 80; i++) {
    const kind = await page.evaluate(() => document.querySelector('[data-rp-scene]')?.dataset.rpScene);
    if (!kind) return seen;
    seen.push(kind); await skip(page); await page.waitForTimeout(30);
  }
  throw Error('Presentation queue did not drain');
}
async function hp(page, who, uid) {
  return page.locator(`[data-rp-side="${who}"][data-rp-slot="${uid}"] .rp-live-hp`).textContent();
}
async function run(url) {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'});
    await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('gg-me','evan'); localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
      localStorage.setItem('gg-release-3.0:evan','1');
      localStorage.setItem('gg-rivals-music:m_evan:v1',JSON.stringify({on:false,level:0}));
      localStorage.setItem('gg-rivals-sfx:m_evan:v1',JSON.stringify({on:false,level:0}));
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e.stack || e)));
    await page.goto(url + '/#/puzzles'); await page.waitForFunction(() => window.__ggBooted);
    // Find legal replay positions; no mutation of game state or production saves.
    const fixtures = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'); await D.load();
      if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes enabled');
      D.finishTutorial('skipped', (await import('/js/core/realm-active.js')).profileKey()); D.usePocketDeck('rental');
      const B = await import('/js/core/dynasty-pocket.js'), C = await import('/js/core/dynasty-pocket-cards.js');
      const deck = C.rentalDeck(), decks = [deck.ids,deck.ids], energy = [deck.energy,deck.energy], found = {};
      const save = (G, log, m, after) => ({record:{id:'cpuflow',opp:'g1',seed:G.seed,v:7,rev:2,decks,energy,log:structuredClone(log),at:Date.now(),z:'',paid:0,pay:null}, move:m,
        before:structuredClone(G), after, events:after.events.slice(G.events.length)});
      for (let seed = 0; seed < 100 && Object.keys(found).length < 5; seed++) {
        const G = B.newGame('battle-flow-' + seed, decks, {energy,rev:2}), log = [];
        const apply = (who,m) => {if (!B.apply(G,who,m).ok) throw Error('Illegal fixture'); log.push([who,m]);};
        apply(1,B.nextMove(G,1,1));
        const setup = B.nextMove(G,0,1), opening = structuredClone(G); B.apply(opening,0,setup);
        if (!found.setup) found.setup = save(G,log,setup,opening);
        apply(0,setup);
        for (let i = 0; i < 180 && G.phase !== 'over'; i++) {
          if (G.who === 0) for (const m of B.legalActions(G,0)) {
            if (!['attack','bench','retreat'].includes(m.a)) continue;
            const after = structuredClone(G); if (!B.apply(after,0,m).ok) continue;
            const events = after.events.slice(G.events.length);
            if (m.a === 'attack') {
              if (B.attacksOf(G,G.p[0].active.id)[m.n].effect) continue;
              const attack = events.find(e => e.k === 'attack');
              if (!attack?.damage) continue;
              if (!found.attack && !events.some(e => ['ko','coin','condition'].includes(e.k)) && after.phase !== 'over') found.attack = save(G,log,m,after);
              if (!found.win && after.phase === 'over' && after.winner === 0 && events.some(e => e.k === 'ko' && e.who === 1)) found.win = save(G,log,m,after);
            } else if (!found[m.a]) found[m.a] = save(G,log,m,after);
          }
          const m = B.nextMove(G,G.who,1); if (!m) break; apply(G.who,m);
        }
      }
      return found;
    });
    for (const key of ['setup','attack','bench','retreat','win']) assert(fixtures[key], 'legal ' + key + ' fixture found');
    async function load(fixture, opp='g1') {
      await page.evaluate(record => localStorage.setItem('gg-dys-m_evan',JSON.stringify(record)), {...fixture.record,opp});
      await page.goto(url + '/?flow=' + Math.random() + '#/puzzles/dynasty/battle/cpuflow');
      await page.waitForSelector('.rp-arena');
      await drain(page);
    }
    async function move(fixture) {
      await page.evaluate(async m => {const r=(await import('/js/core/dynasty-solo.js')).move('cpuflow',m);if(!r.ok)throw Error(r.why);}, fixture.move);
    }
    await load(fixtures.attack);
    const target = fixtures.attack.before.p[1].active, beforeHP = await hp(page,1,target.u);
    await move(fixtures.attack); await page.waitForSelector('[data-rp-scene="attack"]');
    assert.equal(await hp(page,1,target.u),beforeHP,'defender HP stays unchanged while the attack animates');
    await page.waitForTimeout(800);
    assert.equal(await hp(page,1,target.u),beforeHP,'the attack wind-up cannot reveal damage early');
    const logBeforeSkip = await page.evaluate(() => localStorage.getItem('gg-dys-m_evan'));
    await skip(page);
    assert.equal(await hp(page,1,target.u),String((await page.evaluate(async s=>(await import('/js/core/dynasty-pocket.js')).hpOf(s.G,s.slot), {G:fixtures.attack.after,slot:fixtures.attack.after.p[1].active})) - fixtures.attack.after.p[1].active.dmg),'HP changes after attack completion');
    assert.equal(await page.evaluate(() => localStorage.getItem('gg-dys-m_evan')),logBeforeSkip,'skip does not apply the move twice');
    await drain(page);

    for (const [fixtureKey, expected] of [['bench','bench'],['retreat','switch']]) {
      await load(fixtures[fixtureKey]); await move(fixtures[fixtureKey]);
      await page.waitForSelector(`[data-rp-scene="${expected}"]`);
      await animated(page,'.rp-table-flight',expected);
      assert(await page.locator('[data-rp]').evaluate(el=>el.inert),expected+' locks table while cards move');
      await drain(page);
      const x = await page.evaluate(async()=>(await import('/js/core/dynasty-solo.js')).get('cpuflow'));
      assert.deepEqual(x.G,fixtures[fixtureKey].after,expected+' animation preserves resolved state');
    }
    await load(fixtures.setup); await move(fixtures.setup);
    await page.waitForSelector('[data-rp-scene="battle-start"]');
    await animated(page,'.rp-match-intro','battle intro');
    await screenshot(page,'battle-start-390');
    const openingScenes = await drain(page);
    assert(openingScenes.includes('battle-start'),'confirmed lineups start the battle with an intro');

    await load(fixtures.win); const victim = fixtures.win.before.p[1].active, victimHP = await hp(page,1,victim.u);
    await move(fixtures.win); await page.waitForSelector('[data-rp-scene="attack"]');
    assert.equal(await hp(page,1,victim.u),victimHP,'lethal attacks keep the defender on the table until the strike completes');
    await skip(page); await page.waitForSelector('[data-rp-scene="ko"]');
    await animated(page,'.rp-knockout-card','knockout');
    await screenshot(page,'knockout-390');
    const beforePoints = Math.min(3,fixtures.win.before.p[0].points), afterPoints = Math.min(3,fixtures.win.after.p[0].points);
    assert.equal(await page.locator('.rp-manager.is-mine .is-scored').count(),beforePoints,'score stays unchanged through knockout');
    await skip(page); await page.waitForSelector('[data-rp-scene="points"]');
    await animated(page,'.rp-score-orb','earned points');
    await screenshot(page,'points-390');
    assert.equal(await page.locator('.rp-manager.is-mine .is-scored').count(),beforePoints,'points travel before the scoreboard changes');
    await skip(page);
    assert.equal(await page.locator('.rp-manager.is-mine .is-scored').count(),afterPoints,'score updates when its animation completes');
    await page.waitForSelector('[data-rp-scene="game-over"]');
    await animated(page,'.rp-moment-title','game over');
    await screenshot(page,'game-over-390');
    const endingScenes = await drain(page);
    assert(endingScenes.includes('game-over'),'the game ends with a result animation');
    // The result offers both actions, and each leads to the correct screen.
    await page.locator('[data-rp-next-level]').waitFor();
    await screenshot(page,'solo-win-390');
    await page.setViewportSize({width:320,height:568});
    assert(await page.locator('.rp-solo-victory').evaluate(el=>el.getBoundingClientRect().left>=0 && el.getBoundingClientRect().right<=innerWidth),'victory choices fit 320px phones');
    await screenshot(page,'solo-win-320');
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-rp-next-level]').click();
    await page.waitForFunction(async()=>{const x=(await import('/js/core/dynasty-solo.js')).current();return x?.opp.cpu.id==='g2';});
    assert(await page.locator('.rp-arena').count(),'next level opens its battle table');

    await load(fixtures.win); await move(fixtures.win); await drain(page);
    await page.locator('[data-rp-leave-battles]').click();
    await page.waitForFunction(()=>!location.hash.includes('/battle/'));
    assert.equal(await page.locator('.rp-cinema').count(),0,'leaving dismisses presentation');

    await load(fixtures.win,'g30'); await move(fixtures.win); await drain(page);
    await page.locator('[data-rp-leave-battles]').waitFor();
    assert.equal(await page.locator('[data-rp-next-level]').count(),0,'final level never offers nonexistent game 31');
    await page.locator('[data-rp-leave-battles]').click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await load(fixtures.win); await move(fixtures.win);
    assert.equal(await scene(page).count(),0,'reduced motion bypasses animated scenes');
    await page.locator('[data-rp-next-level]').waitFor();
    await page.locator('[data-rp-leave-battles]').click();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await load(fixtures.attack); await move(fixtures.attack);
    await page.waitForSelector('[data-rp-scene="attack"]');
    const resolvedHP = await page.evaluate(async()=>{
      const S=await import('/js/core/dynasty-solo.js'),B=await import('/js/core/dynasty-pocket.js'),G=S.get('cpuflow').G;
      return String(B.hpOf(G,G.p[1].active)-G.p[1].active.dmg);
    });
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>!document.querySelector('.rp-cinema'));
    assert.equal(await hp(page,1,target.u),resolvedHP,'changing reduced motion during attack releases held HP');
    assert.equal(await page.locator('[data-rp]').evaluate(el=>el.inert),false,'cancelled animation releases the table');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await load(fixtures.win); await move(fixtures.win);
    await page.waitForSelector('[data-rp-scene="attack"]');
    const hiddenSave = await page.evaluate(()=>localStorage.getItem('gg-dys-m_evan'));
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await scene(page).count(),0,'backgrounding clears the winning attack');
    assert.equal(await page.locator('.rp-solo-victory').count(),0,'backgrounded victory waits for the player');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await page.locator('[data-rp-next-level]').waitFor();
    assert.equal(await scene(page).count(),0,'foreground resume does not replay old animations');
    assert.equal(await page.evaluate(()=>localStorage.getItem('gg-dys-m_evan')),hiddenSave,'foreground resume preserves the result and reward');
    await page.locator('[data-rp-leave-battles]').click();
    await load(fixtures.win); await move(fixtures.win);
    await page.waitForSelector('[data-rp-scene="attack"]');
    const finishedSave = await page.evaluate(()=>localStorage.getItem('gg-dys-m_evan'));
    await page.evaluate(async()=>{(await import('/js/core/data.js')).setMe('mason');});
    await page.waitForFunction(()=>!document.querySelector('.rp-battle'));
    await page.waitForTimeout(350);
    assert.equal(await scene(page).count(),0,'profile switch cancels every pending scene');
    assert.equal(await page.locator('.rp-solo-victory').count(),0,'old profile victory popup cannot appear after profile switch');
    assert.equal(await page.evaluate(()=>localStorage.getItem('gg-dys-m_evan')),finishedSave,'profile cancellation preserves the completed match');
    assert.deepEqual(errors,[],'no browser exceptions');
    console.log('PASS Rivals battle flow: attack HP timing, placement, switches, intro, knockout, points, game over, Solo next/leave/final level, reduced motion and cancellation');
    await context.close();
  } finally { await browser.close(); }
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
