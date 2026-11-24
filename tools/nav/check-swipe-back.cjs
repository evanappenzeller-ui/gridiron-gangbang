// Swipe-back on pushed screens (js/app.js enableSwipeBack; Nov 24 2026, Evan: "On a screen where the user can tap the
// back button, they should also be able to swipe over to go back to the previous page. Right now, swiping will bring
// them back to the home page"). In a real browser as a touch phone (the iOS home-screen app stood in by
// navigator.standalone), Firebase off, ESPN from tools/live/fixtures:
//   a swipe right from mid-screen on a game page goes back one screen (Scores); a swipe left, a vertical scroll and a
//   swipe on a sideways-scrolling box-score table don't; one starting at the left edge does nothing in the app (that
//   edge is iOS's own back swipe, one history step, checked with history.back()); a tab's first screen still swipes to
//   the next tab; the Press Room pushed over Matchup swipes back to it; Return Man's page keeps its own swipes.
// Usage: node tools/nav/check-swipe-back.cjs
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), FIX = path.join(root, 'tools/live/fixtures');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2'};
function server() {
  const s = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    let f;
    try { f = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)); } catch (_) { r.writeHead(400).end(); return; }
    if (!f.startsWith(root + path.sep)) { r.writeHead(403).end(); return; }
    fs.readFile(f, (e, b) => {
      if (e) { r.writeHead(404).end(); return; }
      if (f.endsWith('index.html')) b = Buffer.from(b.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      r.writeHead(200, {'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      r.end(b);
    });
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
(async () => {
  const srv = await server(), url = `http://127.0.0.1:${srv.address().port}`;
  const {chromium} = require('playwright');
  const b = await chromium.launch();
  try {
    const c = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', hasTouch: true, isMobile: true});
    await c.route('https://**/*', r => {
      const u = new URL(r.request().url()), h = {'access-control-allow-origin': '*'};
      if (u.hostname === 'site.api.espn.com' && /nfl\/scoreboard/.test(u.pathname)) return r.fulfill({body: fs.readFileSync(path.join(FIX, 'nfl-scoreboard.json')), contentType: 'application/json', headers: h});
      if (u.hostname === 'site.api.espn.com' && /nfl\/summary/.test(u.pathname)) return r.fulfill({body: fs.readFileSync(path.join(FIX, 'nfl-final.json')), contentType: 'application/json', headers: h});
      return r.abort();
    });
    await c.addInitScript(() => {
      localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1');
      localStorage.setItem('gg-live-mode', 'nfl');
      Object.defineProperty(navigator, 'standalone', {get: () => true});
    });
    const p = await c.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    const cdp = await c.newCDPSession(p);
    const route = () => p.evaluate(() => location.hash);
    async function drag(x0, y0, x1, y1) {
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: x0, y: y0}]});
      for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x0 + (x1 - x0) * i / 12, y: y0 + (y1 - y0) * i / 12}]}); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      await p.waitForTimeout(1200);
    }
    const GAME = '#/live/game/nfl/401873075';
    async function openGame() {
      await p.goto(url + '/#/live');
      await p.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      await p.waitForSelector('.v-live .lg-tile', {timeout: 20000});
      await p.waitForTimeout(400);
      await p.locator('.v-live .lg-tile').first().click();
      await p.waitForSelector('.v-game:not([hidden]) .gm-hero', {timeout: 20000});
      await p.waitForTimeout(700);
      assert.equal(await route(), GAME);
    }
    await openGame(); await drag(120, 500, 360, 500);
    assert.equal(await route(), '#/live', 'a swipe right from mid-screen goes back one screen');
    await p.waitForSelector('.v-live .lg-tile', {timeout: 5000});
    await openGame(); await drag(300, 500, 40, 500);
    assert.equal(await route(), GAME, 'a swipe left stays');
    await openGame(); await drag(200, 600, 224, 250);
    assert.equal(await route(), GAME, 'a vertical scroll stays');
    await openGame(); await drag(6, 500, 330, 500);
    assert.equal(await route(), GAME, 'the left edge is left to the system (no second back from the app)');
    await p.evaluate(() => history.back()); await p.waitForTimeout(1500);
    assert.equal(await route(), '#/live', 'the system back (one history step) lands on Scores, not Daily Games');
    await openGame();
    await p.locator('.v-game:not([hidden]) [data-seg="gm-tab"] button[data-value="box"]').click();
    await p.waitForTimeout(600);
    const box = await p.locator('.v-game:not([hidden]) .gm-tw').first().boundingBox();
    await drag(box.x + 150, box.y + 60, box.x + 380, box.y + 60);
    assert.equal(await route(), GAME, 'a swipe on a sideways-scrolling table stays');
    console.log('PASS game page: mid-screen swipe goes back to Scores; left, vertical, edge and table swipes stay; a system back lands on Scores');
    await p.goto(url + '/#/live'); await p.waitForTimeout(1500); await drag(300, 400, 40, 400);
    assert.match(await route(), /^#\/matchup/, 'a tab root still swipes to the next tab');
    await p.goto(url + '/#/matchup?s=press'); await p.waitForTimeout(2000);
    await p.evaluate(() => { location.hash = '#/press'; }); await p.waitForTimeout(2000);
    assert.equal(await route(), '#/press');
    await drag(120, 300, 360, 300);
    assert.match(await route(), /^#\/matchup/, 'the Press Room swipes back to Matchup');
    console.log('PASS a tab root swipes to the next tab; the Press Room swipes back to Matchup');
    await p.goto(url + '/#/puzzles'); await p.waitForFunction(() => window.__ggBooted);
    await p.evaluate(() => { location.hash = '#/puzzles/return'; }); await p.waitForTimeout(2500);
    assert.equal(await route(), '#/puzzles/return');
    await drag(120, 600, 360, 600);
    assert.equal(await route(), '#/puzzles/return', 'Return Man keeps its own swipes');
    console.log('PASS Return Man keeps its own swipes');
    assert.deepEqual(errors, [], 'no browser exceptions');
    console.log('PASS: swipe-back on pushed screens');
  } catch (e) { console.error('FAIL:', e && e.stack || e); process.exitCode = 1; }
  finally { await b.close(); srv.close(); }
})();
