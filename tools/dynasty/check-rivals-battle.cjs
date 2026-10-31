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
      if (SOLO.start('g2').ok) throw Error('game 2 is locked until game 1 is won');
      const r = SOLO.start('g1'); if (!r.ok) throw Error(r.why);
      window.battleTestMid = r.mid; window.battleSolo = SOLO;
      await app.nav('/puzzles/dynasty/battle/' + r.mid);
    });
    await page.waitForSelector('.db-card');
    const checkScenes = async selector => {
      const scenes = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
        const art = node.querySelector('.db-face-art');
        return {name: node.getAttribute('aria-label'), team: art?.dataset.teamScene, tactic: art?.classList.contains('is-tactic'), background: art && getComputedStyle(art, '::after').backgroundImage};
      }));
      assert.ok(scenes.length > 0, selector + ': cards are present');
      for (const scene of scenes.filter(s => s.team)) assert.ok(scene.background.includes('/team-graphics-v2/' + scene.team.toLowerCase() + '.png'), scene.name + ': battle paints the matching team graphic');
      for (const scene of scenes.filter(s => !s.tactic)) assert.ok(scene.team, scene.name + ': player card has team scenery');
    };
    await checkScenes('[data-db-hand]');
    await checkScenes('.db-slot:not(.is-empty)');
    assert.equal(await page.locator('.db-table').count(), 1, 'both lineups share the table');
    assert.equal(await page.locator('.db-hand-fan').count(), 1, 'the hand is spread along the foot');
    const solo = () => page.evaluate(async () => { const x = (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid); return {state: x.state, me: x.G.p[0], v: x.G.v}; });
    assert.equal((await solo()).v, 4, 'new ladder games use rules v4 (automatic energy)');
    // Setup: a lineup is suggested; a lifted card offers its place, and Put back changes nothing.
    assert.equal(await page.locator('.is-me .is-active .db-slot:not(.is-empty)').count(), 1, 'the suggested lineup has a starter');
    assert.equal(await page.locator('[data-db-ready]').isDisabled(), false, 'Start is ready with the suggestion');
    const handBefore = await page.locator('[data-db-hand]').count();
    await page.locator('.is-me .is-active .db-slot').click();
    await page.waitForSelector('.db-focus');
    await checkScenes('.db-focus-card');
    assert.equal(await page.locator('[data-db-lineup="hand"]').count(), 1, 'the lifted starter can go back to the hand');
    await page.locator('[data-db-putback]').click();
    assert.equal(await page.locator('.db-focus').count(), 0, 'Put back sets the card down');
    assert.equal(await page.locator('[data-db-hand]').count(), handBefore, 'putting back changes nothing');
    await page.locator('.is-me .is-active .db-slot').click();
    await page.locator('[data-db-lineup="hand"]').click();
    assert.equal(await page.locator('[data-db-hand]').count(), handBefore + 1, 'Back to hand returns the starter to the hand');
    await checkScenes('[data-db-hand]');
    const starterIndex = await page.locator('[data-db-hand]').evaluateAll(async cards => {
      const B = await import('/js/core/dynasty-battle.js');
      const hand = window.battleSolo.get(window.battleTestMid).G.p[0].hand;
      return cards.map(card => Number(card.dataset.dbHand)).find(i => B.isBasic(hand[i]));
    });
    assert.notEqual(starterIndex, undefined, 'the returned starter is a Basic player in hand');
    await page.locator(`[data-db-hand="${starterIndex}"]`).click();
    await page.locator('[data-db-lineup="act"]').click();
    assert.equal(await page.locator('[data-db-hand]').count(), handBefore, 'a lifted hand card can start');
    await page.locator('[data-db-ready]').click();
    await page.waitForFunction(() => window.battleSolo.get(window.battleTestMid).state === 'yours', null, {timeout: 25000});
    // Play: energy goes on by itself; the active player shows he can attack.
    for (let i = 0; i < 4 && !(await page.evaluate(async () => { const B = await import('/js/core/dynasty-battle.js'), x = (await import('/js/core/dynasty-solo.js')).get(window.battleTestMid); return B.check(x.G, 0, {a: 'attack', n: 0}).ok; })); i++) {
      const turn = (await solo()).me.n;
      await page.waitForSelector('[data-db-end]:not([disabled])');
      await page.waitForSelector('.db-cinema', {state: 'detached', timeout: 20000});
      await page.locator('[data-db-end]').click();
      if (await page.locator('.as-btn[data-as="0"]').count()) await page.locator('.as-btn[data-as="0"]').click();
      await page.waitForFunction(turn => { const x = window.battleSolo.get(window.battleTestMid); return x.state === 'yours' && x.G.p[0].n > turn; }, turn, {timeout: 25000});
    }
    await page.waitForSelector('.db-cinema', {state: 'detached', timeout: 20000});
    const me = (await solo()).me;
    assert.ok(me.active.en.length >= 1, 'the turn’s energy went on without a tap');
    assert.equal(await page.locator('[data-db-energy]').count(), 0, 'no energy button in a v4 match');
    await page.waitForSelector('.is-me .db-slot.is-ready');
    // A hand card lifts with its play and goes back down untouched.
    if (me.hand.length) {
      await page.locator('[data-db-hand]').first().click();
      await page.waitForSelector('.db-focus [data-db-play-hand]');
      await page.locator('[data-db-putback]').click();
      const after = await solo();
      assert.deepEqual(after.me.hand, me.hand, 'lifting a hand card does not play it');
    }
    // The active player lifts with his plays: the quick play is ready, the signature says what it needs.
    await page.locator('.is-me .db-slot.is-ready').click();
    await page.waitForSelector('.db-focus [data-db-attack]');
    assert.equal(await page.locator('.db-focus [data-db-attack]').count(), 2, 'both plays show on the lifted card');
    assert.equal(await page.locator('.db-focus [data-db-attack="0"]').isEnabled(), true);
    assert.match(await page.locator('.db-focus [data-db-attack="1"]').innerText(), /Spend 1 energy|Needs \d more energy/);
    fs.mkdirSync(path.join(root, 'output'), {recursive: true});
    await page.screenshot({path: path.join(root, 'output/rivals-lifted.png')});
    await page.locator('[data-db-putback]').click();
    await page.evaluate(() => { document.querySelector('.v-dynasty-battle').scrollTop = 0; });
    await page.screenshot({path: path.join(root, 'output/rivals-battle.png'), fullPage: true});
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({width, height: width === 320 ? 640 : 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow at ' + width);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-db-hand]')].every(c => { const r = c.getBoundingClientRect(); return r.left >= -4 && r.right <= innerWidth + 4; })), true, 'every hand card is on screen at ' + width);
      if (width === 320) await page.screenshot({path: path.join(root, 'output/rivals-battle-320.png'), fullPage: true});
      if (width === 1280) await page.screenshot({path: path.join(root, 'output/rivals-battle-desktop.png'), fullPage: true});
    }
    await page.setViewportSize({width: 390, height: 844});
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.locator('.is-me .db-slot.is-ready').click();
    const quick = page.locator('.db-focus [data-db-attack="0"]');
    assert.equal(await quick.isEnabled(), true, 'quick attack is available with the automatic energy');
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
    await page.evaluate(() => document.querySelectorAll('[data-db-slot][data-side="me"], [data-db-attack]').forEach(n => n.click()));
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
    console.log('PASS Rivals table: ladder lock, suggested lineup, lifting and putting back cards, automatic energy, attacks from the lifted card, scene and skip, repeat-action guard, responsive widths, profile boundaries.');
    await ctx.close();
  } finally { await browser.close(); }
}
srv.listen(0, '127.0.0.1', () => main('http://127.0.0.1:' + srv.address().port).then(() => srv.close(), e => { console.error(e); srv.close(); process.exitCode = 1; }));
