// Local-only Energy selector checks: all choices, inventory gates, Auto-build and saved profiles.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/deck-energy');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
const profiles = [{me:'evan', key:'m_evan'}, {me:'jayton', key:'m_jayton'}, {guest:'Ryan Stewart', key:'u_ryan-stewart'}, {guest:'Ryan Younggreen', key:'u_ryan-younggreen'}];
const close = async page => { await page.locator('.sheet-close').last().click(); await page.waitForFunction(() => !document.querySelector('.sheet')); };
async function run(browser, url, profile, full) {
  const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce', serviceWorkers:'block'});
  await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
  await context.addInitScript(p => {
    if (!localStorage.getItem('gg-me')) { localStorage.setItem('gg-me', p.me || 'none'); if (p.guest) localStorage.setItem('gg-guest', p.guest); }
    localStorage.setItem('gg-welcome', '1'); sessionStorage.setItem('gg-skip-title', '1');
    for (const k of ['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen']) localStorage.setItem('gg-release-3.0:' + k, '1');
    localStorage.setItem('gg-rivals-music:' + p.key + ':v1', JSON.stringify({enabled:false}));
  }, profile);
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  const open = async () => {
    await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
    if (await page.locator('.pk-start').count()) { await page.waitForSelector('.pk-start.is-ready'); await page.locator('.pk-start').focus(); await page.keyboard.press('Enter'); }
    await page.locator('.pk-nav [data-dy-tab="decks"]').click();
  };
  try {
    await page.goto(url + '/#/puzzles'); await page.waitForFunction(() => window.__ggBooted);
    const fixture = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), C = await import('/js/core/dynasty-pocket-cards.js'); await D.load();
      if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes must stay disabled');
      const choose = type => C.allCards().find(c => !c.rentalOnly && c.stage === 'Base' && c.type === type);
      const s = D.mine(), fire = choose('Fire'), water = choose('Water'), grass = choose('Grass');
      s.o = {[fire.id]:2, [water.id]:2, [grass.id]:1}; D.touch();
      return {fire:fire.id, water:water.id, grass:grass.id, types:C.ENERGY_TYPES, owned:JSON.stringify(s.o), save:JSON.stringify(s)};
    });
    await open(); await page.locator('[data-pd-new]').click();
    assert.deepEqual(await page.locator('[data-pd-energy]').evaluateAll(els => els.map(el => el.dataset.pdEnergy)), fixture.types);
    for (const type of fixture.types) assert.equal(await page.locator(`[data-pd-energy="${type}"]`).isDisabled(), !['Fire','Water'].includes(type), type + ': full-deck availability, not merely owning one card');
    assert.equal(await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine())), fixture.save, 'opening/availability never writes a save');
    const originalIds = await page.locator('[data-pd-selected-grid] [data-pd-selected]').evaluateAll(els => els.map(el => el.dataset.pdSelected));
    for (const type of fixture.types) if (await page.locator(`[data-pd-energy="${type}"]`).isChecked()) await page.locator(`[data-pd-energy="${type}"]`).uncheck();
    await page.locator('[data-pd-energy="Water"]').check();
    assert.deepEqual(await page.locator('[data-pd-selected-grid] [data-pd-selected]').evaluateAll(els => els.map(el => el.dataset.pdSelected)), originalIds, 'Energy choice does not silently replace an edited draft');
    await page.locator('[data-pd-auto]').click();
    const selectedTypes = await page.locator('[data-pd-selected-grid] [data-pd-selected]').evaluateAll(async els => {
      const C = await import('/js/core/dynasty-pocket-cards.js'); return els.map(el => C.card(el.dataset.pdSelected)).filter(c => c.kind === 'player').map(c => c.type);
    });
    assert.ok(selectedTypes.length && selectedTypes.every(type => type === 'Water'), 'Auto-build uses the selected Energy');
    assert.match(await page.locator('[data-pd-count]').textContent(), /^20\/20 · Ready/);
    if (full) {
      fs.mkdirSync(out, {recursive:true});
      for (const width of [320,390,768]) {
        await page.setViewportSize({width,height:844}); await page.locator('[data-pd-name]').scrollIntoViewIfNeeded();
        const geometry = await page.evaluate(() => {
          const choices = document.querySelector('.pd-energy-choices'), cards = document.querySelector('[data-pd-selected-grid]');
          const bounds = [...choices.querySelectorAll('label')].map(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1; });
          const locked = choices.querySelector('.is-unavailable'), unlocked = choices.querySelector('.is-selected');
          return {beforeCards:choices.getBoundingClientRect().bottom < cards.getBoundingClientRect().top, bounds,
            locked:getComputedStyle(locked).backgroundColor, unlocked:getComputedStyle(unlocked).backgroundColor};
        });
        assert(geometry.beforeCards && geometry.bounds.every(Boolean), 'all Energy options fit above cards at ' + width);
        const bright = color => color.match(/\d+/g).slice(0,3).map(Number).reduce((a,b) => a+b,0);
        assert(bright(geometry.locked) < bright(geometry.unlocked) / 2, 'unavailable choices are visibly darker');
        await page.screenshot({path:path.join(out, 'choices-' + width + '.png')});
      }
      await page.setViewportSize({width:390,height:844});
      await page.locator('[data-pd-energy="Grass"]').evaluate(el => { el.checked = true; el.dispatchEvent(new Event('change', {bubbles:true})); });
      assert.equal(await page.locator('[data-pd-energy="Grass"]').isChecked(), false, 'change handler rejects a forced unavailable toggle');
      await page.locator('[data-pd-minus]').first().click();
      assert.equal(await page.locator('[data-pd-energy="Water"]').isDisabled(), false, 'availability uses the collection, not an incomplete current draft');
      await page.locator('[data-pd-auto]').click();
    }
    await page.locator('[data-pd-name]').fill('Water collection'); await page.locator('[data-pd-save]').click();
    await page.waitForFunction(() => !document.querySelector('.sheet'));
    const saved = await page.evaluate(async () => (await import('/js/core/dynasty.js')).pocketLoadouts().find(d => d.name === 'Water collection'));
    assert.deepEqual(saved.energy, ['Water']); assert.equal(saved.ids.length, 20);
    await page.reload(); await page.waitForFunction(() => window.__ggBooted); await open();
    assert.deepEqual(await page.evaluate(async id => (await import('/js/core/dynasty.js')).pocketLoadouts().find(d => d.id === id), saved.id), saved, 'chosen Energy and cards survive reload');
    if (full) {
      await page.evaluate(async () => { const D = await import('/js/core/dynasty.js'); D.mine().o = {}; D.touch(); });
      await page.locator('[data-pd-new]').click();
      assert.equal(await page.locator('[data-pd-energy]:disabled').count(), 8, 'empty collection cannot toggle any Energy');
      assert.equal(await page.locator('[data-pd-auto]').isDisabled(), true); assert.equal(await page.locator('[data-pd-save]').isDisabled(), true);
      await close(page);
      await page.locator(`[data-pd-deck="${saved.id}"]`).click(); await page.locator('.pd-detail-actions [data-pd-edit]').click();
      assert.equal(await page.locator('[data-pd-energy="Water"]').isChecked(), true, 'existing saved choices are retained even if inventory changed');
      await page.locator('[data-pd-energy="Water"]').uncheck(); assert.equal(await page.locator('[data-pd-energy="Water"]').isDisabled(), true, 'old unsupported choice can be removed but cannot be selected anew');
    } else await page.locator('[data-pd-new]').click();
    await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
    await page.waitForFunction(() => !document.querySelector('.pd-editor'));
    assert.deepEqual(errors, []); console.log('PASS deck Energy choices, dark/disabled inventory gates, selected Auto-build, save/reload and profile exit: ' + profile.key);
  } finally { await context.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); let browser;
  try { browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH}); for (let i=0;i<profiles.length;i++) await run(browser, 'http://127.0.0.1:' + server.address().port, profiles[i], i===0); }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
