// Local-only browser regression runner for Realm. No production requests or storage.
// Usage: node tools/realm/check-ui.cjs [--serve | --url=http://127.0.0.1:4179] [--navigation]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};

function server(port = 4179) {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      // Disable Firebase initialization even in another browser using this test server.
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      if (req.method === 'HEAD') res.end(); else res.end(bytes);
    });
  });
  return new Promise(resolve => s.listen(port, '127.0.0.1', () => resolve(s)));
}

function playwright() {
  try { return require('playwright'); }
  catch (_) { return require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
}

async function uiChecks(page, context, url) {
  const output = path.resolve(root, '../output');
  fs.mkdirSync(output, {recursive: true});
  await page.evaluate(async () => {
    const F = await import('/js/core/realm.js');
    const app = await import('/js/app.js');
    const s = F.fresh(Date.now());
    s.b.find(b => b.t === 'keep').l = 2;
    s.sc = 'forest';
    s.r = {gold: 1000, grain: 1200}; s.xo = {gold: 0, grain: 0};
    for (const b of s.b) if (F.KINDS[b.t].role === 'make') b.c = Date.now() - 6 * F.HOUR;
    F._set(s);
    await app.nav('/realm');
  });
  await page.waitForSelector('.rl-home canvas');
  await page.waitForFunction(() => !document.querySelector('.rl-home .rl-loading'));
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#tabbar').isVisible(), false, 'Hub navigation collapses in village');
  assert.equal(await page.locator('[data-rl-objective]').isVisible(), true, 'A next step is visible');
  const count = await page.locator('.rl-tag.is-made').count();
  assert(count > 0, 'Mature mine has collect indicator');
  const tag = page.locator('.rl-tag.is-made').first();
  const tagbox = await tag.boundingBox();
  assert(tagbox.width >= 44 && tagbox.height >= 44, 'Collection retains 44px touch target');
  const disc = page.locator('.rl-collect-disc').first();
  const beforeDisc = await disc.boundingBox();
  await page.screenshot({path: path.join(output, 'realm-home-390.png')});
  await page.mouse.move(195, 380);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  const afterDisc = await disc.boundingBox();
  assert(afterDisc.width < beforeDisc.width, 'Collection disc shrinks with zoom out');
  await page.screenshot({path: path.join(output, 'realm-overview-390.png')});
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(150);
  const beforeGold = await page.evaluate(async () => (await import('/js/core/realm.js')).mine().r.gold);
  await page.locator('.rl-tag.is-made.is-gold').click();
  await page.waitForFunction(() => /\+\d.*Gold/.test(document.querySelector('[data-rl-announcement]').textContent));
  const effects = await page.locator('.rl-effects').innerText();
  assert(/\+120 Gold/.test(effects), 'Collection feedback names earned amount and resource');
  assert(await page.locator('.rl-flying-coin').count() > 0, 'Collection flies toward resource counter');
  const afterGold = await page.evaluate(async () => (await import('/js/core/realm.js')).mine().r.gold);
  assert.equal(afterGold - beforeGold, 120, 'Collecting changes stored Gold once');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.rl-effects').innerText(), '', 'Collection feedback is cleaned up');

  // Give the suggested building upgrade a valid scenario without changing saved or remote user data.
  const pure = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js');
    const view = await import('/js/views/realm.js');
    const s = F.mine(), mine = s.b.find(b => b.t === 'mine');
    for (const type of ['farm', 'barracks', 'camp', 'cannon']) if (!s.b.some(b => b.t === type)) {
      const p = F.spotFor(s, type);
      s.b.push({i: s.nb++, t: type, l: 1, x: p.x, y: p.y, u: 0, c: Date.now()});
    }
    s.ar.footman = 1;
    const before = JSON.stringify(s), goal = view.nextObjective(s), benefit = view.upgradeBenefit(mine);
    const unchanged = JSON.stringify(s) === before;
    F.touch();
    return {goal, benefit, unchanged};
  });
  assert(pure.unchanged && pure.goal.kind === 'select' && /Gold Mine/.test(pure.goal.title), 'Objective is useful and does not spend resources');
  assert(/20 → 35/.test(pure.benefit), 'Upgrade benefit compares current and next production');
  await page.locator('[data-rl-objective]').click();
  await page.waitForSelector('[data-rl-card] [data-tile="rate"]');
  const selection = await page.locator('[data-rl-sel]').innerText();
  // (the building's card, Oct 22 2026: the rate's tile, 20 an hour, with the next level's +15 in green)
  assert(/Gold Mine/.test(selection) && /Level 1/.test(selection) && /\b20\b/.test(selection) && /\+15\/hour/.test(selection) && /300/.test(selection) && /5m/.test(selection), 'Card shows name, level, benefit, cost and time');
  await page.screenshot({path: path.join(output, 'realm-selected-390.png')});
  await page.locator('[data-rl-unsel]').click();
  await page.locator('[data-rl-shop]').click();
  await page.locator('[data-rl-buy="treasury"]').click();
  await page.waitForSelector('[data-rl-place]');
  await page.screenshot({path: path.join(output, 'realm-build-390.png')});
  await page.locator('[data-rl-cancel]').click();
  assert.equal(await page.locator('[data-rl-place]').count(), 0, 'Build placement cancels');
  // Walls go down 1 or 10 at a time (tens up to what the Keep allows), in a line, all for the one Build.
  const wallsBefore = await page.evaluate(async () => { const F = await import('/js/core/realm.js'), s = F.mine(); s.r.gold = 5000; return {n: F.countOf(s, 'wall'), gold: s.r.gold, cap: F.allowed(s, 'wall')}; });
  await page.locator('[data-rl-shop]').click();
  await page.locator('[data-rl-buy="wall"]').click();
  await page.waitForSelector('[data-rl-qty]');
  assert(/\b1\s*wall\b/.test(await page.locator('.rl-qty-n').innerText()), 'Walls start at one');
  await page.locator('[data-rl-qty="1"]').click();
  assert(/\b10\s*walls\b/.test(await page.locator('.rl-qty-n').innerText()), 'Plus goes to 10 walls');
  assert(/500/.test(await page.locator('[data-rl-place]').innerText()), 'Build shows the cost of all 10');
  assert.equal(await page.locator('[data-rl-qty="1"]').isDisabled(), wallsBefore.cap - wallsBefore.n < 20, 'No more tens than the Keep allows');
  await page.locator('[data-rl-turn]').click();
  await page.screenshot({path: path.join(output, 'realm-walls-390.png')});
  await page.locator('[data-rl-place]').click();
  const wallsAfter = await page.evaluate(async () => { const F = await import('/js/core/realm.js'), s = F.mine(), w = s.b.filter(b => b.t === 'wall'); return {n: w.length, gold: s.r.gold, xs: new Set(w.slice(-10).map(b => b.x)).size}; });
  assert(wallsAfter.n - wallsBefore.n === 10 && wallsBefore.gold - wallsAfter.gold === 500 && wallsAfter.xs === 1, 'Ten walls built down one line for 500 Gold');
  await page.locator('[data-rl-cancel]').click();
  await page.setViewportSize({width: 320, height: 740});
  await page.waitForTimeout(150);
  const overflow = await page.locator('[data-rl-log]').evaluate(el => ({outer: el.getBoundingClientRect().right, inner: el.lastElementChild.scrollWidth - el.lastElementChild.clientWidth}));
  assert(overflow.outer <= 320 && overflow.inner <= 1, 'Chronicle fits a 320px screen');
  await page.screenshot({path: path.join(output, 'realm-home-320.png')});
  await page.locator('.rl-hub').click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-realm-playing'));
  assert.equal(await page.locator('#tabbar').isVisible(), true, 'Hub navigation returns outside village');
  await page.evaluate(async () => (await import('/js/app.js')).nav('/realm'));
  await page.waitForSelector('.rl-home canvas');
  await page.locator('[data-rl-shop]').click();
  await page.waitForSelector('.sh-rl');
  await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-realm-playing') && !document.querySelector('.rl-home canvas') && !document.querySelector('.sh-rl'));
  assert.equal(await page.locator('#tabbar').isVisible(), true, 'Profile switch restores Hub navigation');
  await page.evaluate(async () => { (await import('/js/core/data.js')).setMe('evan'); await (await import('/js/app.js')).nav('/realm'); });
  await page.waitForSelector('.rl-home canvas');
  // A second tab changing the profile must clear the owner-only screen immediately.
  const second = await context.newPage();
  await second.goto(url + '/data/league.json');
  await second.evaluate(() => localStorage.setItem('gg-me', 'none'));
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-realm-playing') && !document.querySelector('.rl-home canvas'));
  await second.close();
  console.log('PASS: village HUD, zoom indicators, collection, upgrade preview, building cancellation, 320px layout, Hub return and same/cross-tab owner cleanup');
}

async function loadingGuard(browser, url) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
  let release, requested;
  const reached = new Promise(resolve => { requested = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
    const target = new URL(route.request().url());
    if (target.origin !== new URL(url).origin && !['data:', 'blob:'].includes(target.protocol)) return route.abort();
    if (/\/scenery\/(layout-coast|world-coast-v[23])\.json$/.test(target.pathname)) { requested(); await gate; }
    return route.continue();
  });
  await context.addInitScript(() => {
    localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '3');
    sessionStorage.setItem('gg-skip-title', '1');
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);
    await page.evaluate(async () => (await import('/js/app.js')).nav('/realm'));
    let timeout;
    try { await Promise.race([reached, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Expected scenery load did not begin')), 15000); })]); }
    finally { clearTimeout(timeout); }
    await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
    release();
    await page.waitForTimeout(1300);
    assert.equal(await page.locator('.rl-home canvas').count(), 0, 'Pending owner scene cannot mount after profile change');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-realm-playing')), false, 'Pending load cannot collapse navigation after profile change');
    assert.deepEqual(errors, [], 'Pending asset load fails safely after profile change');
    console.log('PASS: profile change while scenery is loading does not restore owner UI');
    await page.evaluate(async () => { (await import('/js/core/data.js')).setMe('evan'); await (await import('/js/app.js')).nav('/realm'); });
    await page.waitForSelector('.rl-home canvas');
    await page.waitForTimeout(500);
    await page.screenshot({path: path.resolve(root, '../output/realm-coast-390.png')});
    const camera = await page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), D3 = await import('/js/views/realm-3d.js');
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;inset:0;width:390px;height:844px'; document.body.appendChild(host);
      const v = D3.create(host, {village: true, scenery: 'coast'}), s = F.fresh();
      const bounds = () => s.b.flatMap(b => [b.x, b.x + F.KINDS[b.t].size].flatMap(x => [b.y, b.y + F.KINDS[b.t].size].map(y => v.project(x, y))));
      // The outer scenery can limit padding on a full-width village; every footprint must still stay on-screen.
      const inside = () => bounds().every(p => p.x >= 8 && p.x <= host.clientWidth - 8 && p.y >= 100 && p.y <= host.clientHeight - 140);
      try {
        v.setLot(s); v.frameVillage();
        const small = inside(), initialZoom = v.zoom;
        host.style.width = '320px'; host.style.height = '740px'; v.resize();
        const resized = inside() && Math.abs(initialZoom - v.zoom) > .1;
        for (const [x, y] of [[2, 2], [2, 41], [41, 2], [41, 41]]) s.b.push({i: s.nb++, t: 'wall', l: 1, x, y, u: 0});
        v.setLot(s);
        const grown = inside(), grownBounds = bounds(), grownZoom = v.zoom;
        // Test a manual position inside the valid scenery range, not a zoom beyond its farthest boundary.
        v.zoomBy(.8); const manualZoom = v.zoom;
        host.style.width = '390px'; host.style.height = '844px'; v.resize();
        const manualKept = Math.abs(manualZoom - v.zoom) < .1;
        return {small, resized, grown, manualKept, detail: {grownZoom, minX: Math.min(...grownBounds.map(p => p.x)), maxX: Math.max(...grownBounds.map(p => p.x)), minY: Math.min(...grownBounds.map(p => p.y)), maxY: Math.max(...grownBounds.map(p => p.y)), manualZoom, afterResize: v.zoom}};
      } finally { v.dispose(); host.remove(); }
    });
    const {detail, ...checks} = camera;
    if (!Object.values(checks).every(Boolean)) console.log('Camera bounds:', detail);
    assert.deepEqual(checks, {small: true, resized: true, grown: true, manualKept: true}, 'Camera frames starter and full-width villages, fits resize, and respects manual zoom');
    console.log('PASS: starter/grown village framing, automatic resize and manual camera preservation');
    assert.deepEqual(errors, [], 'Owner can return after interrupted loading');
  } finally { release(); await context.close(); }
}

// Exercise the real sheet, cover and history operations without depending on 3D asset or launch artwork checks.
async function navigationChecks(browser, url) {
  const scoutPath = '/realm/scout/bot%3A1';
  for (const profile of ['evan', 'mason', 'none']) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', serviceWorkers: 'block'});
    await context.route('**/*', route => {
      const target = new URL(route.request().url());
      return target.origin === new URL(url).origin || ['data:', 'blob:'].includes(target.protocol) ? route.continue() : route.abort();
    });
    await context.addInitScript(profile => {
      localStorage.setItem('gg-me', profile);
      localStorage.setItem('gg-welcome', '1');
      localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '3');
      sessionStorage.setItem('gg-skip-title', '1');
    }, profile);
    const page = await context.newPage(), errors = [], artLoads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text()); });
    page.on('request', request => { if (/\/img\/realm\/.+\.(webp|png|jpg)(\?|$)/.test(request.url())) artLoads.push(request.url()); });
    const settled = async (path, tab, cover = null) => {
      await page.waitForFunction(() => window.__ggBooted);
      await page.evaluate(async () => { window.__navigationRouter = (await import('/js/app.js')).__dev; });
      await page.waitForFunction(({path, tab, cover}) => {
        const __dev = window.__navigationRouter, S = __dev.S;
        return !__dev.queueBusy && location.hash === '#' + path && S.tab === tab
          && (S.cover ? S.cover.route.view : null) === cover && !S.sheets.length;
      }, {path, tab, cover});
    };
    const ownKeep = async (message, sameScreen = false) => {
      await settled('/realm', 'realm');
      assert.equal(await page.locator('.rl-home').isVisible(), true, message + ': own keep is visible');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-realm-playing')), true, message + ': game mode remains active');
      assert.equal(await page.locator('#tabbar').isVisible(), false, message + ': Hub navigation stays collapsed');
      if (sameScreen) assert.equal(await page.evaluate(() => window.__navigationKeep === document.querySelector('.rl-home')), true, message + ': original keep is retained');
    };
    const openScout = async () => {
      await page.locator('[data-rl-raid]').click();
      await page.locator('[data-rl-scout="bot:1"]').click();
      await settled(scoutPath, 'realm', 'realm-scout');
      await page.locator('[data-rls-back]').waitFor({state: 'visible'});
      assert.equal(await page.locator('[data-rls-back]').isVisible(), true, 'Scout Back control is available');
    };
    try {
      await page.goto(url + '/#/puzzles');
      await settled('/puzzles', 'puzzles');
      assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Navigation checks cannot write remote data');
      if (profile === 'evan') {
        await page.evaluate(async () => {
          const F = await import('/js/core/realm.js'), s = F.fresh();
          s.ar.footman = 1; F._set(s);
          await (await import('/js/app.js')).nav('/realm');
          window.__navigationKeep = document.querySelector('.rl-home');
        });
        await ownKeep('Opening Realm');
        await openScout();
        await page.locator('[data-rls-back]').click();
        await ownKeep('Scout UI Back', true);

        await openScout();
        await page.goBack();
        await ownKeep('Browser Back from scout', true);
        await page.goForward();
        await settled(scoutPath, 'realm', 'realm-scout');
        await page.goBack();
        await ownKeep('Browser Back after Forward', true);

        await openScout();
        await page.locator('[data-rls-attack]').click();
        await settled('/realm/raid/bot%3A1', 'realm', 'realm-raid');
        await page.locator('[data-rls-back]').waitFor({state: 'detached'});
        assert.equal(await page.locator('[data-rls-back]').count(), 0, 'Attack replaces the scout');
        await page.locator('[data-rlr-quit]').click();
        await ownKeep('Leaving an unstarted raid', true);

        await openScout();
        await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/results'));
        await settled('/puzzles/results', 'puzzles', 'results');
        await page.locator('.c-rbar-done').click();
        await settled('/puzzles', 'puzzles');
        assert.equal(await page.locator('#tabbar').isVisible(), true, 'Switching cover families returns to the puzzle cover home');

        // Cold links and reloads must establish the same own-keep history entry as ordinary scouting.
        await page.goto(url + '/data/league.json');
        await page.goto(url + '/#' + scoutPath);
        await settled(scoutPath, 'realm', 'realm-scout');
        await page.reload();
        await settled(scoutPath, 'realm', 'realm-scout');
        await page.locator('[data-rls-back]').click();
        await ownKeep('Back after reloading a scout link');
        console.log('PASS: Scout UI Back, browser Back/Forward, raid replacement, cover home switching, cold scout links and reloads');
      } else {
        for (const target of ['/realm', scoutPath, '/realm/raid/bot%3A1']) {
          await page.evaluate(async path => (await import('/js/app.js')).nav(path), target);
          await settled('/puzzles', 'puzzles');
        }
        await page.goto(url + '/data/league.json');
        await page.goto(url + '/#' + scoutPath);
        await settled('/puzzles', 'puzzles');
        assert.equal(await page.locator('.rl-home, .rls, .rlr').count(), 0, 'Non-owner cannot render Realm screens');
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-realm-playing')), false, 'Non-owner retains normal Hub layout');
        assert.equal(artLoads.length, 0, 'Non-owner navigation loads no Realm artwork');
        console.log('PASS: ' + profile + ' Realm navigation and cold links remain owner-only');
      }

      // Puzzle covers still return to Daily Games when opened from another tab, for every profile.
      await page.evaluate(async () => {
        const app = await import('/js/app.js');
        await app.nav('/league/standings');
        await app.nav('/puzzles/results');
      });
      await settled('/puzzles/results', 'puzzles', 'results');
      await page.locator('.c-rbar-done').click();
      await settled('/puzzles', 'puzzles');
      assert.equal(await page.locator('#tabbar').isVisible(), true, 'Puzzle exit restores Hub navigation for ' + profile);
      assert.deepEqual(errors, [], 'Navigation raises no browser exceptions for ' + profile);
    } finally { await context.close(); }
  }
  console.log('PASS: existing puzzle cover returns remain unchanged for owner, member and unselected profiles');
}

async function run(url) {
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname), 'Only loopback test URLs are allowed');
  const {chromium} = playwright();
  const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    if (process.argv.includes('--navigation')) { await navigationChecks(browser, url); return; }
    if (process.argv.includes('--camera')) { await loadingGuard(browser, url); return; }
    for (const profile of ['evan', 'mason', 'none']) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, serviceWorkers: 'block'});
      await context.route('**/*', route => {
        const target = new URL(route.request().url());
        return target.origin === new URL(url).origin || ['data:', 'blob:'].includes(target.protocol) ? route.continue() : route.abort();
      });
      await context.addInitScript(profile => {
        localStorage.setItem('gg-me', profile);
        localStorage.setItem('gg-welcome', '1');
        localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '3');
        sessionStorage.setItem('gg-skip-title', '1');
      }, profile);
      const page = await context.newPage();
      const errors = [];
      const artLoads = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.method() === 'GET' && /\/img\/realm\//.test(request.url())) artLoads.push(request.url()); });
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted, {timeout: 30000});
      const results = await page.evaluate(async () => {
        const {canWrite} = await import('/js/core/fire.js');
        const {realmChecks} = await import('/js/core/checks-realm.js');
        const checks = [];
        await realmChecks((name, fn) => checks.push({name, fn}));
        const out = [];
        for (const {name, fn} of checks) {
          try { const got = await fn(); out.push({name, pass: got === true || !!got.pass, detail: got.detail || ''}); }
          catch (error) { out.push({name, pass: false, detail: error.stack}); }
        }
        return {writes: canWrite(), out};
      });
      assert.equal(results.writes, false, 'Local test writes must remain disabled');
      const failed = results.out.filter(check => !check.pass);
      console.log(`${profile}: ${results.out.length - failed.length}/${results.out.length} existing Realm checks pass`);
      failed.forEach(check => console.error(check.name + '\n' + check.detail));
      assert.equal(failed.length, 0, 'Existing Realm checks failed for ' + profile);
      if (profile === 'evan' && process.argv.includes('--ui')) {
        try { await uiChecks(page, context, url); }
        catch (error) {
          await page.screenshot({path: path.resolve(root, '../output/realm-ui-failure.png')});
          console.error('Browser exceptions:', errors);
          throw error;
        }
      }
      if (profile !== 'evan') {
        // The checks fetch metadata for asset validation; runtime image loads remain owner-only.
        assert.equal(artLoads.filter(file => /\.(webp|png|jpg)(\?|$)/.test(file)).length, 0, 'Non-owner profiles never load Realm artwork');
      }
      assert.deepEqual(errors, [], 'Unexpected browser exceptions');
      await context.close();
    }
    if (process.argv.includes('--ui')) await loadingGuard(browser, url);
  } finally { await browser.close(); }
}

(async () => {
  if (process.argv.includes('--serve')) { const port = +(process.argv.find(arg => arg.startsWith('--port=')) || '--port=4179').slice(7); await server(port); console.log(`Realm test server http://127.0.0.1:${port} (Firebase disabled)`); return; }
  const existing = process.argv.find(arg => arg.startsWith('--url='));
  const s = existing ? null : await server(0);
  try { await run(existing ? existing.slice(6).replace(/\/$/, '') : `http://127.0.0.1:${s.address().port}`); }
  finally { if (s) await new Promise(resolve => s.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
