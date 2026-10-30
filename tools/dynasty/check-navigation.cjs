// Rivals navigation: benchmark under 4x CPU throttling and check reusable panes without stale saves.
// Local only; Firebase is disabled and remote requests are blocked.
// Usage: node tools/dynasty/check-navigation.cjs [--baseline]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const baseline = process.argv.includes('--baseline');
// Read committed assets once without reverting or overwriting the implementation in progress.
const baselineFiles = new Map((baseline ? ['js/views/dynasty.js', 'css/views/dynasty.css'] : [])
  .map(file => [path.join(root, file), execFileSync('git', ['show', 'HEAD:' + file], {cwd: root})]));
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  let file;
  try { const p = new URL(req.url, 'http://127.0.0.1').pathname; file = path.resolve(root, '.' + decodeURIComponent(p === '/' ? '/index.html' : p)); }
  catch (_) { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    if (baselineFiles.has(file)) bytes = baselineFiles.get(file);
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}).end(bytes);
  });
});
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const tab = async (page, name) => {
  await page.locator(`.pk-nav [data-dy-tab="${name}"]`).click();
  await settle(page);
};
async function run(url) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await context.route('https://**/*', route => route.abort());
    await context.addInitScript(() => { localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1'); });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);
    assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false);
    await page.evaluate(async () => { await (await import('/js/app.js')).nav('/puzzles/dynasty'); });
    await page.waitForSelector('.pk-start.is-ready');
    await page.locator('.pk-start').click({position: {x: 195, y: 640}});
    await page.waitForFunction(() => !document.querySelector('.pk-start'));
    await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), s = D.mine();
      D.open('start', {free: true});
      D.CARDS.slice(0, 180).forEach(c => { s.o[c.id] = 3; });
      D.setDeck(D.autoDeck(s.o));
    });
    await settle(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    // Warm each pane, then measure click-to-next-frame on the same isolated catalog/save.
    for (const name of ['cards', 'decks', 'battle', 'packs']) await tab(page, name);
    const timings = await page.evaluate(async () => {
      const out = {cards: [], decks: [], battle: [], packs: []};
      for (let pass = 0; pass < 5; pass++) for (const name of Object.keys(out)) {
        const start = performance.now();
        document.querySelector(`.pk-nav [data-dy-tab="${name}"]`).click();
        await new Promise(resolve => requestAnimationFrame(resolve));
        out[name].push(performance.now() - start);
      }
      return Object.fromEntries(Object.entries(out).map(([name, values]) => [name, {medianMs: +values.sort((a, b) => a - b)[2].toFixed(1), maxMs: +Math.max(...values).toFixed(1)}]));
    });
    console.log((baseline ? 'BASELINE' : 'CURRENT') + ' navigation at 4x CPU: ' + JSON.stringify(timings));
    if (!baseline) {
      await tab(page, 'cards');
      await page.evaluate(() => {
        window.navFirstCard = document.querySelector('[data-dy-grid] .pk-card');
        document.querySelector('.pk-pane').scrollTop = 250;
        window.navScrollTop = document.querySelector('.pk-pane').scrollTop;
      });
      await tab(page, 'cards');
      assert.equal(await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card') === window.navFirstCard), true, 'same-tab tap keeps card nodes');
      await tab(page, 'decks');
      await tab(page, 'cards');
      assert.equal(await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card') === window.navFirstCard), true, 'returning to unchanged binder reuses card nodes');
      assert.equal(await page.evaluate(() => document.querySelector('.pk-pane').scrollTop), await page.evaluate(() => window.navScrollTop), 'returning to binder restores its scroll');
      const beforeMore = await page.locator('[data-dy-grid] .pk-card').count();
      await page.locator('[data-dy-more]').click();
      assert.ok(await page.locator('[data-dy-grid] .pk-card').count() > beforeMore, 'Show more adds cards');
      assert.equal(await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card') === window.navFirstCard), true, 'Show more appends without recreating existing cards');
      // Mutate the save while its binder is cached. Returning must show the actual current copy count.
      const sold = await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card').dataset.dyCard);
      await tab(page, 'decks');
      const soldResult = await page.evaluate(async id => {
        const D = await import('/js/core/dynasty.js'), s = D.mine();
        s.dk = s.dk.filter(x => x !== id);
        const r = D.sell(id, 1);
        return {ok: r.ok, count: s.o[id] || 0};
      }, sold);
      assert.equal(soldResult.ok, true, 'test card was sold');
      await tab(page, 'cards');
      assert.equal(await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card') === window.navFirstCard), false, 'save mutation invalidates cached binder');
      assert.equal((await page.locator(`[data-dy-grid] [data-dy-card="${sold}"] .pk-c-cnt`).textContent()).trim(), String(soldResult.count), 'returning binder shows changed ownership');
      // A pack opening also invalidates a cached binder and its totals.
      await page.evaluate(() => { window.navFirstCard = document.querySelector('[data-dy-grid] .pk-card'); });
      await tab(page, 'packs');
      assert.equal(await page.evaluate(async () => (await import('/js/core/dynasty.js')).open('std', {free: true}).ok), true);
      await tab(page, 'cards');
      assert.equal(await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card') === window.navFirstCard), false, 'pack opening invalidates cached binder');
      // The pushed battle hides the hub. A save event must not rebuild its hidden DOM.
      await page.evaluate(async () => {
        const D = await import('/js/core/dynasty.js'), SOLO = await import('/js/core/dynasty-solo.js'), app = await import('/js/app.js');
        D.setDeck(D.autoDeck(D.mine().o));
        const r = SOLO.start(SOLO.OPPONENTS[0].id);
        if (!r.ok) throw Error(r.why);
        await app.nav('/puzzles/dynasty/battle/' + r.mid);
      });
      await page.waitForSelector('.db');
      await settle(page);
      await page.evaluate(async () => {
        window.hiddenNavChanges = 0;
        window.hiddenNavObserver = new MutationObserver(records => { window.hiddenNavChanges += records.length; });
        window.hiddenNavObserver.observe(document.querySelector('.v-dynasty .pk-pane'), {childList: true, subtree: true});
        (await import('/js/core/dynasty.js')).touch('sync');
      });
      await settle(page);
      assert.equal(await page.evaluate(() => window.hiddenNavChanges), 0, 'hidden hub does not redraw on save events');
      await page.evaluate(() => window.hiddenNavObserver.disconnect());
      await page.goBack();
      await page.waitForSelector('.pk-pane');
      await settle(page);
      assert.equal(await page.locator('.pk-start').count(), 0, 'returning from battle keeps title screen dismissed');
      console.log('PASS: pane reuse, scroll restoration, append pagination, save/open invalidation and hidden-screen updates');
    }
    assert.deepEqual(errors, [], 'unexpected browser errors');
    await context.close();
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
