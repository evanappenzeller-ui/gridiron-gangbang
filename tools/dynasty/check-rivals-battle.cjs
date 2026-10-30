// Tabletop hand and battle presentation smoke test. Firebase and external requests are disabled.
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
    assert.equal(await page.locator('.db-table').count(), 1, 'both lineups share the tabletop');
    assert.equal(await page.locator('.db-hand-fan').count(), 1, 'the hand has a fan surface');
    const originalHand = await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.p[0].hand.slice());
    const handIndexes = () => page.locator('[data-db-hand]').evaluateAll(nodes => nodes.map(n => Number(n.dataset.dbHand)));
    for (const order of ['name', 'type', 'power', 'draw']) {
      await page.locator('[data-db-sort]').selectOption(order);
      assert.deepEqual(await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.p[0].hand), originalHand, 'sorting does not reorder the saved hand: ' + order);
      assert.deepEqual((await handIndexes()).sort((a, b) => a - b), originalHand.map((_, i) => i), 'every card, including duplicates, keeps its original hand index');
      if (order === 'name') {
        const names = await page.locator('[data-db-hand] .db-face-name').allTextContents();
        assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b)), 'Name sort orders visible cards alphabetically');
      }
    }
    assert.deepEqual(await handIndexes(), originalHand.map((_, i) => i), 'Draw order restores the original presentation');
    const focusedCard = () => page.evaluate(() => Number(document.activeElement?.dataset.dbHand));
    await page.locator('[data-db-hand="0"]').focus();
    await page.locator('[data-db-browse="1"]').click();
    assert.equal(await focusedCard(), 1, 'Next focuses the second card');
    await page.locator('[data-db-browse="1"]').click();
    assert.equal(await focusedCard(), 2, 'a second Next continues from the remembered card');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await focusedCard(), 1, 'Left arrow browses back one card');
    await page.keyboard.press('End');
    assert.equal(await focusedCard(), originalHand.length - 1, 'End reaches the last card');
    await page.keyboard.press('Home');
    assert.equal(await focusedCard(), 0, 'Home reaches the first card');
    assert.equal(await page.locator('[data-db-hand][aria-pressed="true"]').count(), 0, 'browsing does not select or play a setup card');
    assert.equal(await page.locator('[data-db-ready]').isDisabled(), true, 'browsing alone does not set a starting player');
    const first = await page.evaluate(async () => {
      const B = await import('/js/core/dynasty-battle.js'), SOLO = await import('/js/core/dynasty-solo.js');
      return SOLO.get(window.battleTestMid).G.p[0].hand.findIndex(B.isBasic);
    });
    await page.locator(`[data-db-hand="${first}"]`).click();
    assert.match(await page.locator('.db-status').innerText(), /Bench:/);
    await page.locator('[data-db-sort]').selectOption('name');
    assert.equal(await page.locator(`[data-db-hand="${first}"]`).getAttribute('aria-pressed'), 'true', 'setup selection follows the original card through sorting');
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
    const selectedName = await page.locator('.db-selection-copy > b').textContent();
    await page.locator('[data-db-sort]').selectOption('power');
    assert.equal(await page.locator('.db-selection-copy > b').textContent(), selectedName, 'sorting preserves the selected card preview');
    assert.equal(await page.locator(`[data-db-hand="${pick.i}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.p[0].bench.length), pick.n, 'preview does not play card');
    await page.locator('[data-db-play-hand]').click();
    await page.waitForSelector('.db-cinema', {state: 'detached', timeout: 20000});
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
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({width, height: width === 320 ? 640 : 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow at ' + width);
      if (width === 320) await page.screenshot({path: path.join(root, 'output/rivals-battle-320.png'), fullPage: true});
      if (width === 1280) await page.screenshot({path: path.join(root, 'output/rivals-battle-desktop.png'), fullPage: true});
      if (width === 390 || width === 1280) {
        await page.locator('.db-hand-section').scrollIntoViewIfNeeded();
        await page.screenshot({path: path.join(root, `output/rivals-hand-${width}.png`)});
      }
    }
    await page.emulateMedia({reducedMotion: 'no-preference'});
    const quick = page.locator('[data-db-attack="0"]');
    assert.equal(await quick.isEnabled(), true, 'quick attack is available after attaching energy');
    const ownAttacks = () => page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid).G.ev.filter(e => e.k === 'attack' && e.who === 0));
    const before = (await ownAttacks()).length;
    await page.evaluate(async () => {
      const ui = await import('/js/core/ui.js');
      window.battleTestSheet = ui.openSheet({title: 'Battle details', body: '<p>Keep this sheet open during a match update.</p>', detents: ['fit']});
      // Exercise the view's submission handler while a sheet owns pointer focus.
      document.querySelector('[data-db-attack="0"]').click();
    });
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.db-cinema').count(), 0, 'an attack received under a sheet waits instead of opening an inert dialog');
    await page.evaluate(() => window.battleTestSheet.close());
    await page.waitForSelector('[data-db-scene="attack"]');
    const played = await ownAttacks(), event = played[played.length - 1];
    assert.equal(played.length, before + 1, 'playing an attack resolves it once');
    assert.equal(await page.locator('[data-db]').evaluate(n => n.inert), true, 'the tabletop cannot submit another action during a scene');
    assert.match(await page.locator('.db-cinema-result').textContent(), event.missed ? /JUKED/ : new RegExp(String(event.dmg) + ' DAMAGE'), 'the animation displays the actual resolved damage');
    assert.ok((await page.locator('.db-cinema').innerText()).includes(event.name), 'the animation names the played attack');
    // Programmatic clicks also exercise the guard independently of browser inert behavior.
    await page.locator('[data-db-attack="0"]').evaluate(n => n.click());
    assert.equal((await ownAttacks()).length, before + 1, 'a second action cannot be submitted while the scene is open');
    await page.waitForTimeout(1400);
    await page.screenshot({path: path.join(root, 'output/rivals-cinema.png'), fullPage: true});
    await page.locator('[data-db-skip]').click();
    await page.waitForFunction(() => !document.querySelector('[data-db]')?.inert, null, {timeout: 20000});
    assert.equal((await ownAttacks()).length, before + 1, 'skipping only ends presentation and never applies the attack twice');
    // A member and a visitor still cannot enter the restricted Rivals battle route.
    for (const profile of ['mason', 'none']) {
      await page.evaluate(async profile => {
        const data = await import('/js/core/data.js'), app = await import('/js/app.js');
        data.setMe(profile);
        await app.nav('/puzzles/dynasty/battle/' + window.battleTestMid);
      }, profile);
      await page.waitForFunction(() => !location.hash.includes('/dynasty/battle/'));
      assert.equal(await page.locator('.db-cinema, .db-hand-fan').count(), 0, profile + ' cannot see a battle presentation');
    }
    assert.deepEqual(errors, []);
    console.log('PASS Rivals tabletop: sorting and selection, setup, explicit play, energy, attack scene and skip, repeat-action guard, responsive widths, profile boundaries.');
    await ctx.close();
  } finally { await browser.close(); }
}
srv.listen(0, '127.0.0.1', () => main('http://127.0.0.1:' + srv.address().port).then(() => srv.close(), e => { console.error(e); srv.close(); process.exitCode = 1; }));
