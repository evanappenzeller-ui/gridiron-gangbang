// Gridiron Dynasty's title screen and Pocket's theme details in a real browser (the owner, Oct 29 2026: "Create a start
// screen when entering the dynasty. Implement more details into the theme of the app similar to the attached images").
// Local only: the app is served from this folder with Firebase disabled, so nothing reaches the live board.
// For Evan and Ryan Stewart (the Dynasty's two players, features.js dynastyOpen): entering shows the title screen over an
// inert shell, the cards drift in once they've loaded, a tap (and Enter) starts, the five tabs with the Menu, the header's
// counters, the Packs stage (the clock pill, the tags, the round Open), the Battle tab (the banner, Versus, Solo, Guide,
// Decks, Rankings, Missions), the Menu sheet and its Title screen item, back from a Solo battle without the title screen
// again, and every kit check in checks-dynasty.js. For a member who isn't theirs and a visitor: the link lands on the list.
// Usage: node tools/dynasty/check-start-browser.cjs [--shots=<dir>]   (Playwright's Chromium; screenshots when --shots)
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});

function server() {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      // (Firebase stays off: no live reads or writes from a test)
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(bytes);
    });
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(s)));
}
const PROFILES = [
  {tag: 'evan', me: 'evan', plays: true},
  {tag: 'ryan-stewart', me: 'none', guest: 'Ryan Stewart', plays: true},
  {tag: 'mason', me: 'mason', plays: false},
  {tag: 'visitor', me: 'none', plays: false}
];
const snap = (page, name) => (shots ? page.screenshot({path: path.join(shots, name + '.png')}) : Promise.resolve());

async function kitChecks(page) {
  return page.evaluate(async () => {
    const {dynastyChecks} = await import('/js/core/checks-dynasty.js');
    const checks = [];
    await dynastyChecks((name, fn) => checks.push({name, fn}));
    const out = [];
    for (const {name, fn} of checks) {
      try { const got = await fn(); out.push({name, pass: got === true || !!(got && got.pass), detail: (got && got.detail) || ''}); }
      catch (e) { out.push({name, pass: false, detail: String((e && e.stack) || e)}); }
    }
    return out;
  });
}

async function playerFlow(page, p, {reduced}) {
  const T = p.tag + (reduced ? ' (reduced motion)' : '');
  await page.waitForSelector('.pk-start', {timeout: 15000});
  assert.equal(await page.evaluate(() => location.hash), '#/puzzles/dynasty', T + ': the Dynasty route');
  assert.equal(await page.locator('#tabbar').isVisible(), false, T + ': the app’s tab bar is hidden while playing');
  assert.equal(await page.locator('.pk.is-start').count(), 1, T + ': the shell is held still under the title screen');
  assert.equal(await page.locator('[data-dy-pane][inert], .pk-hdr[inert], .pk-nav[inert]').count(), 3, T + ': the shell is inert under the title screen');
  await page.waitForSelector('.pk-start.is-ready', {timeout: 20000});
  await page.waitForTimeout(reduced ? 200 : 900);
  assert.equal(await page.locator('[data-dy-start-say]').textContent(), 'Tap to Start', T + ': Tap to Start once the cards are in');
  assert.equal(await page.locator('.pk-start-card').count(), 14, T + ': fourteen cards drift on the title screen');
  assert.match(await page.locator('.pk-start-ver').textContent(), /Ver\. 3\.0\.\d+Support ID: [A-Z0-9]{8}/, T + ': the version and a support id');
  assert.equal(await page.locator('.pk-start .gg-exit').count(), 1, T + ': the red X on the title screen');
  assert.equal(await page.locator('.pk-start-logo').textContent(), 'GridironTrading Card GameRivals', T + ': the logo');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-title`);
  // tap anywhere: the Packs
  await page.locator('.pk-start').click({position: {x: 195, y: 640}});
  await page.waitForFunction(() => !document.querySelector('.pk-start'), null, {timeout: 5000});
  assert.equal(await page.locator('.pk.is-start, [inert]').count(), 0, T + ': the shell is live again');
  assert.equal(await page.locator('.pk-tab').count(), 5, T + ': five tabs at the foot');
  assert.equal(await page.locator('.pk-tab[data-dy-menu]').count(), 1, T + ': the Menu tab');
  assert.match((await page.locator('[data-dy-hud]').innerText()).replace(/\s+/g, ' '), /∞ MAX [\d,]+ coins/, T + ': the header’s counters (unlimited packs, coins)');
  for (const sel of ['.pk-packs', '.pk-clock', '.pk-show-tip', '.pk-tags > b', '.pk-round[data-dy-goto="cols"]', '.pk-round[data-dy-earn]', 'button.pk-open.is-round', '.pk-actions .pk-pill[data-dy-odds]', '.pk-actions .pk-pill[data-dy-packs]', '.pk-pts'])
    assert.equal(await page.locator(sel).count(), 1, T + ': the Packs stage has ' + sel);
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-packs`);
  // the pack stack (the owner, Oct 29 2026: "User should be able to switch packs like the attached"): the packs that
  // follow peek out behind, a swipe left brings the next forward, → and ← step through them, a tap on one behind brings
  // it, the pack list picks one too, and none of it opens a pack
  const front = async () => (await page.locator('.pk-tags > b').textContent()).trim(), settle = () => page.waitForTimeout(reduced ? 500 : 700); // (a tap within 450ms of a swipe is ignored: no settle shorter)
  assert.equal(await front(), 'Starter', T + ': the Starter Pack is in front while it waits');
  assert.deepEqual(await page.locator('.pk-car-bk').evaluateAll(l => l.map(b => b.dataset.dyTo)), ['std', 'team'], T + ': the Standard and Team Packs peek out behind it');
  const bb = await page.locator('.pk-bigpack').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 - 40, bb.y + bb.height / 2, {steps: 4}); await page.mouse.move(bb.x + bb.width / 2 - 130, bb.y + bb.height / 2, {steps: 6});
  await page.mouse.up(); await settle();
  assert.equal(await front(), 'Standard', T + ': a swipe left brings the next pack to the front');
  assert.equal(await page.locator('.dy-rip').count(), 0, T + ': the swipe opened nothing');
  await page.locator('.pk-bigpack').focus(); await page.keyboard.press('ArrowRight'); await settle();
  assert.equal(await front(), 'Team', T + ': → steps to the next pack');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.className), 'pk-bigpack', T + ': the front pack keeps the focus');
  const b2 = await page.locator('.pk-car-bk[data-bk="2"]').boundingBox(); // (its right edge shows past the pack in front)
  await page.mouse.click(b2.x + b2.width * .9, b2.y + b2.height * .5); await settle();
  assert.equal(await front(), 'Gameday', T + ': a tap on the second pack behind brings it to the front');
  await page.locator('.pk-bigpack').focus(); await page.keyboard.press('ArrowLeft'); await settle();
  assert.equal(await front(), 'Premium', T + ': ← steps back a pack');
  assert.deepEqual(await page.locator('.pk-car-bk').evaluateAll(l => l.map(b => b.dataset.dyTo)), ['gday', 'leg'], T + ': the Gameday and Legends Packs peek out behind it');
  await page.locator('.pk-actions .pk-pill[data-dy-packs]').click();
  await page.waitForSelector('.pk-pickb.is-on');
  assert.match(await page.locator('.pk-pickb.is-on').textContent(), /Premium Pack/, T + ': the pack list marks the one in front');
  await page.locator('.pk-pickb[data-dy-pick="leg"]').click(); await settle();
  assert.equal(await front(), 'Legends', T + ': the pack list brings a pack to the front');
  assert.deepEqual(await page.locator('.pk-car-bk').evaluateAll(l => l.map(b => b.dataset.dyTo)), ['start', 'std'], T + ': the stack wraps round to the Starter Pack');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-stack`);
  // the Battle tab
  await page.locator('.pk-tab[data-dy-tab="battle"]').click();
  await page.waitForSelector('.pk-banner-tab');
  assert.equal(await page.locator('.pk-banner-tab').textContent(), 'Battle', T + ': the banner’s tab');
  assert.equal(await page.locator('.pk-banner-orbs .pk-e').count(), 4, T + ': the energy afloat on the banner');
  assert.deepEqual(await page.locator('.pk-mode b').allTextContents(), ['Versus', 'Solo'], T + ': Versus then Solo');
  assert.deepEqual(await page.locator('.pk-mini span:not(.sr-only)').allTextContents(), ['Guide', 'Decks', 'Rankings', 'Missions'], T + ': Guide, Decks, Rankings, Missions');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-battle`);
  // Missions: the collections
  await page.locator('.pk-mini[data-dy-goto="cols"]').click();
  await page.waitForSelector('.pk-cols');
  assert.equal(await page.locator('.pk-tab.is-on').getAttribute('data-dy-tab'), 'cards', T + ': Missions opens the collections on My Cards');
  // a collection's cards you don't have yet stay face down: no name, picture or stats, and no tap to see them
  await page.locator('[data-dy-col="series-A"]').click();
  await page.waitForSelector('.sheet.pk-sheet .pk-grid');
  const sheetCards = await page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js'), s = D.mine(), col = D.collection('series-A');
    const need = col.need.filter(D.isCard), have = need.filter(id => s.o[id] > 0).length;
    const g = document.querySelector('.sheet.pk-sheet .pk-grid');
    return {need: need.length, have, locked: g.querySelectorAll('.pk-locked').length, open: g.querySelectorAll('[data-dy-card]').length,
      ghost: g.querySelectorAll('.is-ghost').length, names: g.querySelectorAll('.pk-locked .pk-c-name, .pk-locked img').length};
  });
  assert.equal(sheetCards.locked, sheetCards.need - sheetCards.have, T + ': each missing card is a locked slot');
  assert.equal(sheetCards.open, sheetCards.have, T + ': only cards you have show and open');
  assert.equal(sheetCards.ghost + sheetCards.names, 0, T + ': no greyed-out faces, no names or pictures on a locked slot');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-collection`);
  await page.locator('.sheet.pk-sheet [aria-label="Close"], .sheet.pk-sheet .sheet-close').first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForFunction(() => !document.querySelector('.sheet.pk-sheet'), null, {timeout: 5000});
  // the Menu
  await page.locator('.pk-tab[data-dy-menu]').click();
  await page.waitForSelector('.pk-menu');
  assert.deepEqual(await page.locator('.pk-menu b').allTextContents(), ['Guide', 'Coins', 'Rankings', 'Offering Rates', 'Title screen', 'Exit Gridiron Dynasty'], T + ': the Menu’s items');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-menu`);
  await page.locator('[data-dy-m="title"]').click();
  await page.waitForSelector('.pk-start.is-ready', {timeout: 5000});
  await page.waitForTimeout(reduced ? 100 : 500);
  assert.equal(await page.locator('.sheet.pk-sheet').count(), 0, T + ': the Menu closed');
  assert.equal(await page.locator('.pk-start-card').count(), 14, T + ': the title screen is back with its cards');
  // Enter starts too
  await page.locator('.pk-start').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.pk-start'), null, {timeout: 5000});
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.className), 'pk-title', T + ': focus lands on the page title after starting');
  if (reduced) return;
  // back from a Solo battle: no title screen again (the Starter Pack opened, the deck built, the computer's first opponent)
  const mid = await page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js'), SOLO = await import('/js/core/dynasty-solo.js'), app = await import('/js/app.js');
    const s = D.mine();
    if (s.pk.start) D.open('start', {free: true});
    D.setDeck(D.autoDeck(D.mine().o));
    const r = SOLO.start(SOLO.OPPONENTS[0].id);
    if (!r.ok) return r.why;
    await app.nav('/puzzles/dynasty/battle/' + r.mid);
    return r.mid;
  });
  assert.match(String(mid), /^cpu/, T + ': a Solo battle started: ' + mid);
  await page.waitForSelector('.db', {timeout: 10000});
  assert.equal(await page.locator('.pk-start').count(), 0, T + ': no title screen under a battle');
  await page.goBack();
  await page.waitForSelector('.pk-pane', {timeout: 10000});
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.pk-start').count(), 0, T + ': back from a battle, the title screen doesn’t come again');
  assert.equal(await page.evaluate(() => location.hash), '#/puzzles/dynasty', T + ': back on the Dynasty');
  assert.equal(await page.locator('#tabbar').isVisible(), false, T + ': the app’s tab bar stays hidden');
  // the kit checks
  const out = await kitChecks(page);
  const failed = out.filter(c => !c.pass);
  console.log(`${T}: ${out.length - failed.length}/${out.length} Dynasty kit checks pass`);
  failed.forEach(c => console.error('FAIL ' + c.name + '\n  ' + c.detail));
  assert.equal(failed.length, 0, T + ': Dynasty kit checks failed');
}

async function run(url) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const p of PROFILES) for (const reduced of (p.plays && p.tag === 'evan' ? [false, true] : [false])) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference'});
      await context.addInitScript(p => {
        localStorage.setItem('gg-me', p.me);
        if (p.guest) localStorage.setItem('gg-guest', p.guest);
        localStorage.setItem('gg-welcome', '1');
        ['evan', 'mason', 'user%3Aryan-stewart', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      }, p);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e));
      page.on('console', m => { // (Chrome's own notice when a scripted step haptics before any tap isn't the app's)
      if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Local test writes must remain disabled');
      await page.evaluate(async () => { const app = await import('/js/app.js'); await app.nav('/puzzles/dynasty'); });
      await page.waitForTimeout(800);
      if (p.plays) await playerFlow(page, p, {reduced});
      else {
        assert.equal(await page.evaluate(() => location.hash), '#/puzzles', p.tag + ': the Dynasty link lands on Daily Games');
        assert.equal(await page.locator('.pk, .pk-start').count(), 0, p.tag + ': no Dynasty screen');
        assert.equal(await page.locator('#tabbar').isVisible(), true, p.tag + ': the app’s tab bar stays');
        console.log(`${p.tag}: the Dynasty stays closed`);
      }
      assert.deepEqual(errors, [], p.tag + ': unexpected browser exceptions');
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('PASS: Gridiron Dynasty title screen and Pocket theme');
}

(async () => {
  const s = await server();
  try { await run(`http://127.0.0.1:${s.address().port}`); }
  finally { await new Promise(resolve => s.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
