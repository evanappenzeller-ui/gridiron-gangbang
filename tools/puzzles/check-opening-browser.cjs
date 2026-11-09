// The opening waits for the app (index.html #title, js/core/opening.js; Nov 9 2026, Evan: "The app lags when first
// entered. Fix this so the app has sufficient time to load during the opening animation so that it runs smoothly. Lags
// include glitching with the game cases and screen flashes"). In a real browser, on a phone-sized screen with the CPU
// slowed down like a phone's:
//  - the fly-through starts only once the home screen is whole: the loading skeleton gone, the cases drawn in their
//    own styles with their game states in, the covers on screen decoded; and nothing janks while we fly in;
//  - the cases stay as they were revealed (no cover recreated, no case restyled or turned round after the reveal);
//  - the work that isn't for the first screen (Rivals live, warming the other tabs) waits until the opening is gone;
//  - a slow start holds the logo, breathing, until the app is ready; one that's far too slow goes on after the cap;
//  - a tap skips it; reduced motion holds without the breathing; an update reload has no opening and still warms up;
//  - a cold link to another tab is released too.
// For Evan, a member and a visitor. Local only: the app is served from this folder with Firebase disabled.
// Usage: node tools/puzzles/check-opening-browser.cjs [--throttle=4]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
const THROTTLE = +((process.argv.find(a => a.startsWith('--throttle=')) || '').slice(11) || 4);

// slow: path → extra ms before it's served (the league file late: the app slow to start)
let slow = {};
function server() {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      setTimeout(() => {
        res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
        res.end(bytes);
      }, slow[url.pathname] || 0);
    });
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(s)));
}

// Watches the launch from the first script on: when the fly-through starts (ts-in) and what the app looks like then,
// when the opening goes, the long frames, and every cover picture node.
function probe() {
  const W = window.__op = {t: {}, frames: [], atIn: null, atGone: null, held: 0, breath: 0};
  const now = () => performance.now();
  const look = () => {
    const shelf = document.querySelector('.gm-shelf');
    const vis = im => { const r = im.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    const covers = shelf ? [...shelf.querySelectorAll('.gm-front .gm-img')].filter(vis) : [];
    covers.forEach((im, i) => { im.__op = im.__op || ('c' + Math.random()); });
    const link = document.querySelector('link[data-gm-static="game-case-owner"]');
    return {
      boot: !!document.getElementById('boot'),
      inert: !!document.getElementById('app')?.inert,
      cases: document.querySelectorAll('.gm-slot:not([data-gm-clone]) .gm-case').length,
      kinds: [...document.querySelectorAll('.gm-slot:not([data-gm-clone]) .gm-case')].map(c => c.dataset.gm + ':' + c.dataset.kind),
      covers: covers.length,
      decoded: covers.filter(im => im.complete && im.naturalWidth > 0).length,
      coverIds: covers.map(im => im.__op),
      sheet: !!(link && link.sheet),
      owner: !!document.querySelector('.gm-list.gm-owner'),
      skeleton: document.querySelectorAll('.sk').length,
      home: !!document.querySelector('.hm-app'),
      hash: location.hash
    };
  };
  W.look = look;
  new MutationObserver(() => {
    const c = document.documentElement.classList;
    if (c.contains('ts-in') && !W.atIn) { W.t.in = now(); W.atIn = look(); }
    const t = document.getElementById('title');
    if (t) W.seen = true;
    if (!t && W.seen && W.t.gone == null) { W.t.gone = now(); W.atGone = look(); }
  }).observe(document, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  // held: the opening's animations paused; breath: its breathing (scale / translate) running
  const poll = () => {
    const t = document.getElementById('title');
    if (t && t.getAnimations) {
      const as = t.getAnimations({subtree: true});
      if (as.some(a => a.playState === 'paused')) W.held++;
      if (as.some(a => a.effect && a.effect.getKeyframes && a.effect.getKeyframes().some(k => 'scale' in k || 'translate' in k) && a.playState === 'running')) W.breath++;
    }
    if (window.__ggBooted && W.t.booted == null) W.t.booted = now();
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  try {
    new PerformanceObserver(l => l.getEntries().forEach(e => W.frames.push([e.startTime, e.duration]))).observe({type: 'long-animation-frame', buffered: true});
  } catch (_) {
    new PerformanceObserver(l => l.getEntries().forEach(e => W.frames.push([e.startTime, e.duration]))).observe({type: 'longtask', buffered: true});
  }
}

async function launch(browser, url, {me = 'evan', reduced = false, skipTitle = false, hash = '#/puzzles', throttle = THROTTLE} = {}) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference'});
  await context.route('https://**/*', route => route.abort());
  await context.addInitScript(({me, skipTitle}) => {
    localStorage.setItem('gg-me', me);
    localStorage.setItem('gg-welcome', '1');
    ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    if (skipTitle) sessionStorage.setItem('gg-skip-title', '1');
  }, {me, skipTitle});
  await context.addInitScript(probe);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
  if (throttle > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', {rate: throttle}); }
  await page.goto(url + '/' + hash);
  return {context, page, errors};
}
const gone = page => page.waitForFunction(() => window.__op.t.gone != null, null, {timeout: 20000});
const op = page => page.evaluate(() => ({t: window.__op.t, atIn: window.__op.atIn, atGone: window.__op.atGone, frames: window.__op.frames, held: window.__op.held, breath: window.__op.breath}));
// When a module was first fetched (ms from navigation), or null.
const fetchedAt = (page, name) => page.evaluate(n => { const e = performance.getEntriesByType('resource').find(r => r.name.includes(n)); return e ? e.startTime : null; }, name);

async function run(url) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    // 1. Every profile: the reveal shows the whole home screen, flies in smoothly, and nothing changes after it.
    for (const me of ['evan', 'mason', 'none']) {
      const T = `${me === 'none' ? 'visitor' : me} (CPU ×${THROTTLE})`;
      const {context, page, errors} = await launch(browser, url, {me});
      await gone(page);
      const o = await op(page);
      const a = o.atIn;
      assert.ok(a, T + ': the fly-through ran');
      assert.equal(a.boot, false, T + ': no loading skeleton at the reveal');
      assert.equal(a.inert, false, T + ': the app is awake as we fly in');
      assert.ok(a.home, T + ': the home screen is drawn at the reveal');
      assert.ok(a.cases >= 5, T + ': the cases are on the shelf at the reveal');
      assert.ok(a.sheet && a.owner, T + ': the cases wear their own styles at the reveal');
      assert.ok(!a.kinds.some(k => /:loading$/.test(k)), T + ': every case has its game state at the reveal: ' + a.kinds.join(' '));
      assert.ok(a.covers >= 1 && a.decoded === a.covers, T + `: the covers on screen are decoded at the reveal (${a.decoded}/${a.covers})`);
      assert.ok(o.t.booted != null && o.t.booted <= o.t.in, T + ': the app started before the fly-through');
      // the fly-through itself: no long frame from the reveal to the end of the fly-in (420 ms)
      const during = o.frames.filter(([s, d]) => s + d > o.t.in && s < o.t.gone + 150);
      assert.ok(during.every(([, d]) => d < 100), T + ': no long frame while flying in: ' + JSON.stringify(during.map(([s, d]) => [Math.round(s - o.t.in), Math.round(d)])));
      // nothing for later loaded under the fly-through
      const live = await fetchedAt(page, 'rivals-live.js');
      assert.ok(live == null || live >= o.t.gone, T + ': Rivals live waits for the opening to go');
      // after the reveal: the same cover pictures (none recreated, so none flashed empty) and the same cases
      await page.waitForTimeout(2500);
      const after = await page.evaluate(() => window.__op.look());
      assert.deepEqual(after.coverIds.filter(id => a.coverIds.includes(id)), a.coverIds.filter(id => after.coverIds.includes(id)), T + ': covers in order');
      assert.ok(a.coverIds.every(id => after.coverIds.includes(id)), T + ': the revealed covers are still the same pictures');
      assert.deepEqual(after.kinds, a.kinds, T + ': no case changed after the reveal');
      assert.ok(await fetchedAt(page, 'rivals-live.js') != null || me === 'none', T + ': the deferred warm-up ran after the opening');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ts-on') || document.documentElement.classList.contains('ts-in')), false, T + ': the opening’s classes are gone');
      assert.deepEqual(errors, [], T + ': no errors');
      console.log(`${T}: revealed whole at ${Math.round(o.t.in)} ms, opening gone at ${Math.round(o.t.gone)} ms, ok`);
      await context.close();
    }

    // 2. A slow start: the opening holds, breathing, until the app is in; then flies through to the whole screen.
    {
      slow = {'/data/league.json': 3500};
      const {context, page, errors} = await launch(browser, url, {throttle: 1});
      await gone(page);
      const o = await op(page);
      assert.ok(o.held > 0, 'slow start: the opening held');
      assert.ok(o.breath > 0, 'slow start: the logo breathed while it held');
      assert.ok(o.t.in > o.t.booted, 'slow start: the fly-through waited for the app');
      assert.ok(o.atIn && !o.atIn.boot && o.atIn.cases >= 5 && o.atIn.decoded === o.atIn.covers, 'slow start: revealed whole');
      assert.deepEqual(errors, [], 'slow start: no errors');
      console.log(`slow start: held, breathing, revealed at ${Math.round(o.t.in)} ms (app started at ${Math.round(o.t.booted)} ms), ok`);
      await context.close();
    }

    // 3. Far too slow: the opening goes on after its cap (7 s) to the app's own loading screen, and the app still starts.
    {
      slow = {'/data/league.json': 11000};
      const {context, page, errors} = await launch(browser, url, {throttle: 1});
      await gone(page);
      const o = await op(page);
      assert.ok(o.t.gone > 7000 && o.t.gone < 10500, 'cap: the opening went on after its cap: ' + Math.round(o.t.gone));
      assert.ok(o.atGone && o.atGone.boot && !o.atGone.inert, 'cap: the loading screen shows, awake');
      await page.waitForFunction(() => window.__ggBooted && document.querySelector('.gm-case'), null, {timeout: 20000});
      assert.deepEqual(errors, [], 'cap: no errors');
      console.log(`cap: went on at ${Math.round(o.t.gone)} ms, then the app started, ok`);
      await context.close();
    }

    // 4. A tap while it holds skips it at once.
    {
      slow = {'/data/league.json': 4000};
      const {context, page, errors} = await launch(browser, url, {throttle: 1});
      await page.waitForFunction(() => window.__op.held > 0, null, {timeout: 10000});
      const t0 = await page.evaluate(() => performance.now());
      await page.mouse.click(195, 420);
      await gone(page);
      const o = await op(page);
      assert.ok(o.t.gone - t0 < 600, 'skip: gone within a moment of the tap: ' + Math.round(o.t.gone - t0));
      assert.equal(await page.evaluate(() => document.getElementById('app').inert), false, 'skip: the app is awake');
      await page.waitForFunction(() => window.__ggBooted && document.querySelector('.gm-case'), null, {timeout: 15000});
      assert.deepEqual(errors, [], 'skip: no errors');
      console.log('skip: a tap while holding ends it at once, ok');
      await context.close();
    }

    // 5. Reduced motion: holds without breathing, then reveals the whole screen.
    {
      slow = {'/data/league.json': 2500};
      const {context, page, errors} = await launch(browser, url, {reduced: true, throttle: 1});
      await gone(page);
      const o = await op(page);
      assert.ok(o.held > 0, 'reduced motion: held for the app');
      assert.equal(o.breath, 0, 'reduced motion: no breathing');
      assert.ok(o.atGone && !o.atGone.boot && o.atGone.cases >= 5, 'reduced motion: revealed whole');
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ts-in')), false, 'reduced motion: no fly-in class left behind');
      assert.deepEqual(errors, [], 'reduced motion: no errors');
      console.log('reduced motion: held without breathing, revealed whole, ok');
      await context.close();
    }
    slow = {};

    // 6. An update reload (no opening): the app starts at once and the deferred warm-up still runs.
    {
      const {context, page, errors} = await launch(browser, url, {skipTitle: true, throttle: 1});
      await page.waitForFunction(() => window.__ggBooted && document.querySelector('.gm-case'), null, {timeout: 15000});
      assert.equal(await page.evaluate(() => !!document.getElementById('title') || !window.__ggTitle.gone), false, 'update reload: no opening');
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => r.name.includes('rivals-live.js')), null, {timeout: 10000});
      assert.deepEqual(errors, [], 'update reload: no errors');
      console.log('update reload: no opening, warm-up ran, ok');
      await context.close();
    }

    // 7. A cold link to another tab is released too.
    {
      const {context, page, errors} = await launch(browser, url, {hash: '#/league/standings'});
      await gone(page);
      const o = await op(page);
      assert.ok(o.atIn && !o.atIn.boot, 'cold link: the skeleton was gone at the reveal');
      assert.ok(o.t.gone < 9000, 'cold link: released, not capped: ' + Math.round(o.t.gone));
      assert.deepEqual(errors, [], 'cold link: no errors');
      console.log(`cold link to League: revealed at ${Math.round(o.t.in)} ms, ok`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  const s = await server();
  try {
    await run(`http://127.0.0.1:${s.address().port}`);
    console.log('PASS: the opening waits for the app, then flies in smoothly');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    s.close();
  }
})();
