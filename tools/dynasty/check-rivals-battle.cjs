// Local browser smoke test. Firebase and external requests are disabled.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2'};
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost'), file = path.resolve(root, '.' + (u.pathname === '/' ? '/index.html' : u.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => {
    if (err) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
async function main(url) {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  try {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await ctx.route('https://**/*', r => r.abort());
    await ctx.addInitScript(() => { localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1'); });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);
    await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), SOLO = await import('/js/core/dynasty-solo.js'), app = await import('/js/app.js');
      await D.load();
      const s = D.mine(), players = D.CARDS.filter(c => c.s === 'L' && c.pos === 'QB').slice(0, 9).map(c => c.id);
      const deck = [...players.flatMap(id => [id, id]), 'I-water', 'I-water'];
      deck.forEach(id => { s.o[id] = 2; }); D.setDeck(deck);
      const r = SOLO.start('rookie-camp'); if (!r.ok) throw Error(r.why);
      window.battleTestMid = r.mid;
      await app.nav('/puzzles/dynasty/battle/' + r.mid);
    });
    await page.waitForSelector('.db-card');
    const first = await page.evaluate(async () => {
      const B = await import('/js/core/dynasty-battle.js'), SOLO = await import('/js/core/dynasty-solo.js');
      return SOLO.get(window.battleTestMid).G.p[0].hand.findIndex(B.isBasic);
    });
    await page.locator(`[data-db-hand="${first}"]`).click();
    assert.match(await page.locator('.db-status').innerText(), /Bench:/);
    await page.locator('[data-db-ready]').click();
    await page.waitForFunction(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).state === 'yours', null, {timeout: 25000});
    await page.waitForSelector('.db-play');
    assert.equal(await page.locator('.db-play').count(), 2);
    assert.match(await page.locator('.db-play.is-signature').innerText(), /Spend 1 energy/);
    assert.ok(await page.locator('.db-card').first().evaluate(n => n.getBoundingClientRect().width) >= 110);
    const pick = await page.evaluate(async () => {
      const B = await import('/js/core/dynasty-battle.js'), SOLO = await import('/js/core/dynasty-solo.js'), me = SOLO.get(window.battleTestMid).G.p[0];
      return {i: me.hand.findIndex(B.isBasic), n: me.bench.length};
    });
    assert.ok(pick.i >= 0);
    await page.locator(`[data-db-hand="${pick.i}"]`).click();
    assert.equal(await page.locator('.db-selection').count(), 1);
    assert.equal(await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.p[0].bench.length), pick.n, 'preview does not play card');
    await page.locator('[data-db-play-hand]').click();
    assert.equal(await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.p[0].bench.length), pick.n + 1);
    assert.equal(await page.locator('.db-selection').count(), 0);
    if (!(await page.locator('[data-db-energy]').count())) {
      const turn = await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.p[0].n);
      await page.locator('[data-db-end]').click();
      await page.locator('.as-btn[data-as="0"]').click();
      await page.waitForFunction(async turn => { const x = (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid); return x.state === 'yours' && x.G.p[0].n > turn; }, turn, {timeout: 25000});
    }
    await page.locator('[data-db-energy]').waitFor({state: 'visible', timeout: 15000});
    await page.locator('[data-db-energy]').click();
    await page.waitForSelector('.db-slot.is-pick');
    assert.ok(await page.locator('.db-slot.is-pick').count() >= 2);
    await page.locator('.is-active.is-me .db-slot.is-pick').click();
    await page.waitForFunction(() => { const b = document.querySelector('[data-db-attack="0"]'); return b && !b.disabled; }, null, {timeout: 10000});
    fs.mkdirSync(path.join(root, 'output'), {recursive: true});
    await page.waitForSelector('.toast', {state: 'detached', timeout: 10000});
    await page.evaluate(() => { document.querySelector('.v-dynasty-battle').scrollTop = 0; });
    await page.screenshot({path: path.join(root, 'output/rivals-battle.png'), fullPage: true});
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({width, height: width === 320 ? 640 : 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow at ' + width);
      if (width === 320) await page.screenshot({path: path.join(root, 'output/rivals-battle-320.png'), fullPage: true});
    }
    const quick = page.locator('[data-db-attack="0"]');
    assert.equal(await quick.isEnabled(), true, 'quick attack is available after attaching energy');
    const before = await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.ev.filter(e => e.k === 'attack').length);
    await quick.click();
    assert.ok(await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.ev.filter(e => e.k === 'attack').length) > before, 'inline attack always executes');
    assert.deepEqual(errors, []);
    console.log('PASS Rivals match: setup, preview, explicit play, energy targets, inline attacks, responsive widths.');
    await ctx.close();
  } finally { await browser.close(); }
}
srv.listen(0, '127.0.0.1', () => main('http://127.0.0.1:' + srv.address().port).then(() => srv.close(), e => { console.error(e); srv.close(); process.exitCode = 1; }));
