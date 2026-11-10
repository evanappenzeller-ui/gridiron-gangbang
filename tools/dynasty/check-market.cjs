// Rivals marketplace: real-browser wallet, inventory, saved-deck and profile checks.
// Local server only. Firebase is disabled and all external requests are blocked.
// NODE_PATH=<Playwright modules> CHROMIUM_PATH=<Chromium> node tools/dynasty/check-market.cjs [--shots=<dir>]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2'};
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive:true});
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => {
    if (err) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(bytes);
  });
});
let pw;
try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await pw.chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {channel:'chrome'}), headless:true});
    const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block', reducedMotion:'reduce'});
    await context.route('**/*', r => new URL(r.request().url()).origin === url ? r.continue() : r.abort());
    await context.addInitScript(() => {
      if (!localStorage.getItem('gg-me')) localStorage.setItem('gg-me','evan');
      localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
      ['evan','jayton','mason','visitor','user%3Aryan-stewart'].forEach(k => localStorage.setItem('gg-release-3.0:' + k,'1'));
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);
    const result = await page.evaluate(async () => {
      const data = await import('/js/core/data.js'), D = await import('/js/core/dynasty.js');
      const fire = await import('/js/core/fire.js'), R = await import('/js/core/realm-active.js');
      const PC = await import('/js/core/dynasty-pocket-cards.js');
      const ok = (v, msg) => { if (!v) throw Error(msg); }, passed = [];
      const same = (a,b,msg) => ok(JSON.stringify(a) === JSON.stringify(b),msg);
      ok(!fire.canWrite(), 'Live writes disabled'); await D.load();
      const cards = D.CARDS, common = cards.find(c => c.r === 'common'), epic = cards.find(c => c.r === 'epic');
      const noDecks = s => { s.dk = []; s.table = {decks:[{id:'empty-table',name:'Empty',ids:[]}],active:'empty-table'}; s.pocket = {v:1,decks:[{id:'empty-pocket',name:'Empty',ids:[],energy:['Fire']}],active:'empty-pocket'}; };
      const reset = () => { const s = D.mine(); Object.assign(s,D.fresh()); noDecks(s); s.cr = 2000000; D.touch(); return s; };
      for (const c of [...cards,...D.TRAINER_IDS.map(D.trainer)]) {
        const q = D.marketQuote(c);
        ok(q && Object.values(q).every(x => Number.isSafeInteger(x) && x > 0), c.id + ': positive integer quotes');
        ok(q.buy > q.sell && q.sell > q.quick, c.id + ': buy > market sale > quick sale');
        ok(q.quick === D.sellValue(c), c.id + ': binder and market quick sell agree');
        if (c.s) {
          const range = {common:[1,11999],epic:[12000,16000],legendary:[60000,90000],mythic:[750000,1200000]}[c.r];
          ok(q.buy >= range[0] && q.buy <= range[1], c.id + ': rarity price band');
        }
        same(D.marketQuote({...c,o:99,r:'mythic'}),q,c.id + ': supplied metadata cannot change quote');
      }
      ok(D.marketQuote(null) === null && D.marketQuote('missing') === null, 'Unknown cards have no quote');
      passed.push('all player and trainer prices, rarity bands, strict resale spread and authoritative quotes');

      for (const profile of [...data.ids.map(id => ({id})),...data.USERS.map(u => ({guest:u.name})),{guest:'Market visitor'}]) {
        if (profile.id) data.setMe(profile.id); else data.setGuest(profile.guest);
        const s = reset(), q = D.marketQuote(common), before = {sp:s.sp,cr:s.cr};
        ok(D.mayPlay() && D.buyCard(common.id).ok, R.profileKey() + ': can buy');
        ok(s.o[common.id] === 1, 'One purchased copy');
        ok(s.sp === before.sp + (profile.id === 'jayton' ? 0 : q.buy), 'Only Jayton retains unlimited spending');
        ok(D.sellCard(common.id).ok && !s.o[common.id], 'Market removes exactly one owned copy');
        ok(s.cr === before.cr + q.sell, 'Market credits advertised offer');
        ok(!D.sellCard(common.id).ok, 'Cannot resell removed copy');
        ok(!D.unlimited(), 'Marketplace does not restore unlimited packs');
      }
      passed.push('buy and sell for every member, app user and a named guest; existing coin privileges unchanged');

      data.setMe('evan'); let s = reset();
      s.cr = 0; s.sp = D.STARTER_COINS; D.touch();
      let before = JSON.stringify(s);
      ok(!D.buyCard(epic.id).ok, 'Insufficient funds rejected'); same(JSON.stringify(s),before,'Failed purchase changes nothing');
      s.cr = 2000000; s.o[epic.id] = 99; D.touch(); before = JSON.stringify(s);
      ok(!D.buyCard(epic.id).ok, 'Inventory limit rejected'); same(JSON.stringify(s),before,'Full inventory never charges');
      const alias = D.ALIAS.keys().next().value;
      for (const id of ['missing','I-charge','P7-ground',alias].filter(Boolean)) {
        before = JSON.stringify(s);
        ok(!D.buyCard(id).ok && !D.sellCard(id).ok, id + ': invalid/retired/reusable cards rejected');
        same(JSON.stringify(s),before,id + ': no ledger or inventory changes');
      }
      passed.push('insufficient funds, 99-copy limit, unknown cards, aliases and reusable playbook rejection');

      s = reset(); s.o = {[epic.id]:3}; s.dk = [epic.id];
      s.table.decks[0].ids = [epic.id,epic.id]; s.pocket.decks[0].ids = [epic.id];
      ok(D.sellableCount(epic.id,s) === 1, 'Maximum copies across every saved deck reserved');
      const quote = D.marketQuote(epic), cr = s.cr;
      ok(D.sellCard(epic.id).ok && s.o[epic.id] === 2 && s.cr === cr + quote.sell, 'Only spare copy sold');
      before = JSON.stringify(s);
      ok(!D.sellCard(epic.id).ok && !D.sell(epic.id).ok, 'Both sale paths protect saved decks');
      same(JSON.stringify(s),before,'Protected sale cannot alter save');
      s.table.decks[0].ids = []; s.dk = []; s.pocket.decks[0].ids = [epic.id,epic.id];
      ok(D.sellableCount(epic.id,s) === 0 && !D.sellCard(epic.id).ok, 'Inactive Pocket deck also protects copies');
      const developed = PC.allCards().find(c => c.development && c.collectionId === epic.id);
      if (developed) {
        s.o[epic.id] = 1; s.pocket.decks[0].ids = [developed.id];
        ok(D.sellableCount(epic.id,s) === 0, 'Development card reserves its owned base');
      }
      noDecks(s); s.o = {[epic.id]:3}; const initialCredit = s.cr;
      ok(D.sell(epic.id,1).coins === quote.quick && s.o[epic.id] === 2, 'Quick sale credits lower offer');
      const spare = D.spares(s); ok(spare.list.length === 1 && spare.coins === quote.quick, 'Bulk spares uses same quote');
      ok(D.sellSpares(s) === quote.quick && s.o[epic.id] === 1 && s.cr === initialCredit + quote.quick * 2, 'Bulk sale keeps first copy');
      for (const n of [NaN,Infinity,-1,0,0.5]) {
        before = JSON.stringify(s); ok(!D.sell(epic.id,n).ok,'Invalid quick-sell quantity rejected'); same(JSON.stringify(s),before,'Invalid quantity leaves save unchanged');
      }
      passed.push('legacy/table/Pocket deck protection, single and bulk quick-sell payouts, invalid quantities');

      const stale = s, staleBefore = JSON.stringify(stale); data.setMe('mason'); const currentBefore = JSON.stringify(D.mine());
      ok(!D.buyCard(common.id,stale).ok && !D.sellCard(epic.id,stale).ok,'Switched profile rejects stale save');
      same(JSON.stringify(stale),staleBefore,'Old profile untouched'); same(JSON.stringify(D.mine()),currentBefore,'New profile untouched');
      data.setGuest(null); data.setMe(null); before = JSON.stringify(D.mine());
      ok(!D.buyCard(common.id).ok && !D.sellCard(epic.id).ok,'Unselected profile cannot trade');
      same(JSON.stringify(D.mine()),before,'Unselected profile remains unchanged');
      passed.push('stale save and unselected profile transactions fail without mutations');

      data.setMe('evan'); s = reset(); s.o = {}; s.cr = 50000; s.so = {g1:2}; s.tr = 17; s.cl = {sentinel:1};
      ok(D.buyCard(epic.id).ok,'Purchase for persistence'); D.finishTutorial('skipped',R.profileKey());
      const snapshot = {o:s.o,sp:s.sp,cr:s.cr,so:s.so,tr:s.tr,cl:s.cl,pk:s.pk};
      return {passed,card:{id:common.id,name:common.name,quote:D.marketQuote(common)},snapshot};
    });
    result.passed.forEach(r => console.log('PASS: ' + r));
    await page.reload(); await page.waitForFunction(() => window.__ggBooted);
    const persisted = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'); await D.load(); const s = D.mine();
      return {o:s.o,sp:s.sp,cr:s.cr,so:s.so,tr:s.tr,cl:s.cl,pk:s.pk};
    });
    assert.deepEqual(persisted,result.snapshot,'Wallet, inventory and unrelated progress survive reload');
    console.log('PASS: purchased cards, wallet and existing packs/rewards/ladder survive reload');

    await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
    await page.locator('.pk-start.is-ready').waitFor();
    await page.locator('.pk-start').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.pk-start'));
    await page.locator('[data-dy-tab="market"]').first().click();
    const focused = async (selector, message) => assert.ok(await page.evaluate(sel => document.activeElement?.matches(sel),selector),message);
    await page.locator('[data-market-rarity]').focus();
    await page.locator('[data-market-rarity]').selectOption('common');
    await focused('[data-market-rarity]','Rarity selection retains keyboard focus after redraw');
    await page.locator('[data-market-sort]').focus();
    await page.locator('[data-market-sort]').selectOption('low');
    await focused('[data-market-sort]','Sort selection retains keyboard focus after redraw');
    const firstCount = await page.locator('.rm-card').count();
    await page.locator('[data-market-more]').focus(); await page.keyboard.press('Enter');
    assert.ok(await page.locator('.rm-card').count() > firstCount,'Keyboard Show more adds cards');
    await focused('[data-market-more]','Show more retains focus while more pages remain');
    await page.locator('[data-market-search]').fill(result.card.name);
    const tile = page.locator(`[data-market-card="${result.card.id}"]`).first();
    await tile.waitFor();
    // Simulate the shared earned-coins cache still containing a richer board snapshot.
    // The market banner, app header and confirmation must recalculate before displaying affordability.
    const staleWallet = async () => page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), daily = await import('/js/core/daily.js'), data = await import('/js/core/data.js');
      const s = D.mine();
      if (!window.__marketWalletRestore) window.__marketWalletRestore = {raw:daily.LB.raw,sp:s.sp};
      s.sp = D.STARTER_COINS + s.cr - 300;
      daily.LB.raw = [{id:'market-wallet-fixture',nick:data.name('evan'),days:{[D.dayNumbers().puzzles]:{p:600,t:Date.now()}}}];
      const earned = D.earned(s,true).total;
      daily.LB.raw = [];
      return earned;
    });
    assert.equal(await staleWallet(),440,'Daily-result fixture seeds earned cache');
    await page.locator('[data-market-mode="buy"]').click();
    assert.equal(await page.locator('.rm-wallet b').textContent(),'300','Marketplace banner uses current earnings');
    assert.equal(await page.locator('.pk-coin-n b').textContent(),'300','Header wallet uses current earnings');
    assert.equal(await staleWallet(),440,'Re-seed stale cache before opening an offer');
    await tile.click();
    assert.ok(await page.locator('[data-market-confirm="buy"]').isDisabled(),'Offer cannot use stale earned coins to enable a purchase');
    await page.locator('[data-market-cancel]').click();
    await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), daily = await import('/js/core/daily.js');
      D.mine().sp = window.__marketWalletRestore.sp; daily.LB.raw = window.__marketWalletRestore.raw;
      delete window.__marketWalletRestore; D.earned(D.mine(),true);
    });
    console.log('PASS: current earned coins determine both wallet displays and purchase affordability');
    const wallet = async () => page.evaluate(async id => {
      const D = await import('/js/core/dynasty.js'), s = D.mine(); return {sp:s.sp,cr:s.cr,n:s.o[id] || 0};
    },result.card.id);
    let before = await wallet();
    await tile.click(); await page.locator('[data-market-confirm="buy"]').click();
    await page.waitForFunction(async id => (await import('/js/core/dynasty.js')).mine().o[id] === 1,result.card.id);
    assert.deepEqual(await wallet(),{sp:before.sp + result.card.quote.buy,cr:before.cr,n:before.n + 1});
    await page.locator('[data-market-mode="sell"]').click();
    await focused('[data-market-mode="sell"]','Sell view retains focus after redraw');
    await tile.click(); await page.locator('[data-market-confirm="sell"]').click();
    await page.waitForFunction(async id => !(await import('/js/core/dynasty.js')).mine().o[id],result.card.id);
    assert.deepEqual(await wallet(),{sp:before.sp + result.card.quote.buy,cr:before.cr + result.card.quote.sell,n:before.n});
    console.log('PASS: phone purchase and market-sale confirmation update one copy and exact wallet amounts');

    await page.locator('[data-market-mode="buy"]').click();
    await focused('[data-market-mode="buy"]','Buy view retains focus after redraw');
    await tile.click(); await page.locator('[data-market-confirm="buy"]').click();
    await page.locator('[data-market-mode="sell"]').click();
    before = await wallet();
    await tile.click(); await page.locator('[data-market-confirm="quick"]').click();
    await page.waitForFunction(async id => !(await import('/js/core/dynasty.js')).mine().o[id],result.card.id);
    assert.deepEqual(await wallet(),{sp:before.sp,cr:before.cr + result.card.quote.quick,n:before.n - 1});
    console.log('PASS: quick-sale confirmation pays less than the displayed market offer');

    await page.locator('[data-market-mode="buy"]').click();
    await page.locator('[data-market-search]').fill(''); await page.locator('[data-market-rarity]').selectOption('mythic');
    await page.locator('[data-market-more]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-market-more]').count(),0,'Final results page has no Show more button');
    await focused('.rm-card:last-child [data-market-card]','Final Show more hands focus to a remaining card');
    console.log('PASS: rarity, sort, Buy/Sell and both pagination states preserve usable keyboard focus');
    for (const size of [{width:320,height:740},{width:390,height:844},{width:820,height:1180}]) {
      await page.setViewportSize(size); await page.locator('[data-market-card]').first().waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),'No horizontal overflow at ' + size.width);
      if (shots) await page.screenshot({path:path.join(shots,`market-${size.width}.png`)});
    }
    console.log('PASS: marketplace fits 320px and 390px phones and an 820px tablet');

    await page.locator('[data-market-rarity]').selectOption('common');
    await page.locator('[data-market-search]').fill(result.card.name); await tile.click();
    const oldSave = await page.evaluate(() => localStorage.getItem('gg-dy2-m_evan'));
    await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
    const staleButton = page.locator('[data-market-confirm="buy"]');
    if (await staleButton.count()) await staleButton.click({force:true});
    assert.equal(await page.evaluate(() => localStorage.getItem('gg-dy2-m_evan')),oldSave,'Profile switch cancels pending trade');
    assert.deepEqual(errors,[],'No browser exceptions');
    console.log('PASS: profile change cannot commit a pending marketplace confirmation');
    await context.close();
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
