// Binder images must be ready before fast scrolling reaches them, including content-visibility rows.
// Local fixtures only: Firebase is disabled and remote headshots use a delayed local WebP stand-in.
// Usage: node tools/dynasty/check-card-images.cjs [--baseline]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const baseline = process.argv.includes('--baseline');
const oldView = baseline ? execFileSync('git', ['show', '53046e6:js/views/dynasty.js'], {cwd: root}) : null;
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2'};
const standIn = fs.readFileSync(path.join(root, 'img/dynasty/action', fs.readdirSync(path.join(root, 'img/dynasty/action')).find(f => f.endsWith('.webp'))));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
  let file;
  try { const p = new URL(req.url, 'http://localhost').pathname; file = path.resolve(root, '.' + decodeURIComponent(p === '/' ? '/index.html' : p)); }
  catch { return res.writeHead(400).end(); }
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (oldView && file === path.join(root, 'js/views/dynasty.js')) bytes = oldView;
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(bytes);
  });
});
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const imageState = page => page.evaluate(() => {
  // Do not read offscreen geometry: that could unskip content-visibility and hide the lazy-loading regression.
  const images = [...document.querySelectorAll('[data-dy-grid] .pk-c-ph')];
  return {total: images.length, ready: images.filter(img => img.complete && img.naturalWidth > 0).length,
    top: document.querySelector('.pk-pane').scrollTop};
});
const ready = page => page.waitForFunction(() => {
  const images = [...document.querySelectorAll('[data-dy-grid] .pk-c-ph')];
  return images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0);
}, null, {timeout: 8000});
const profiles = [{me:'evan', key:'m_evan'}, {me:'jayton', key:'m_jayton'},
  {guest:'Ryan Stewart', key:'u_ryan-stewart'}, {guest:'Ryan Younggreen', key:'u_ryan-younggreen'}];

async function check(browser, url, profile) {
  const context = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, serviceWorkers:'block', reducedMotion:'reduce'});
  const requested = new Set(), failures = new Set();
  await context.route('**/*', async route => {
    const req = route.request(), href = req.url();
    if (req.resourceType() === 'image') {
      requested.add(href);
      await delay(200);
      if (failures.has(href)) return route.fulfill({status:404, body:''});
      if (!href.startsWith(url)) return route.fulfill({contentType:'image/webp', body:standIn});
    }
    return href.startsWith(url) ? route.continue() : route.abort();
  });
  await context.addInitScript(p => {
    localStorage.setItem('gg-me', p.me || 'none');
    if (p.guest) localStorage.setItem('gg-guest', p.guest);
    localStorage.setItem('gg-welcome', '1');
    for (const k of ['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen']) localStorage.setItem('gg-release-3.0:' + k, '1');
    localStorage.setItem('gg-rivals-music:' + p.key + ':v1', JSON.stringify({enabled:false}));
  }, profile);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);
    const fixture = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), F = await import('/js/core/features.js'), V = await import('/js/views/dynasty.js');
      if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes must be disabled');
      if (!F.rivalsUpdated()) throw Error('Expected an authorized Rivals profile');
      await D.load();
      const action = D.CARDS.filter(c => V.portraitOf(c).action && V.portraitOf(c).url).slice(0,30);
      const heads = D.CARDS.filter(c => c.r === 'common' && String(c.head).startsWith('n:') && V.portraitOf(c).url).slice(0,100);
      if (action.length !== 30 || heads.length !== 100) throw Error('Missing mixed action/headshot fixtures');
      const s = D.mine(); s.o = Object.fromEntries([...action, ...heads].map((c,i) => [c.id, i % 3 + 1])); s.nw = [];
      D.touch();
      await (await import('/js/app.js')).nav('/puzzles/dynasty');
      return {count:130};
    });
    await page.waitForSelector('.pk-start.is-ready');
    await page.locator('.pk-start').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.pk-start'));
    await delay(350);
    requested.clear();
    await page.locator('.pk-nav [data-dy-tab="cards"]').click();
    await settle(page);
    assert.equal(await page.locator('[data-dy-grid] .pk-card').count(), 60);
    if (baseline) {
      await delay(1500);
      const state = await imageState(page);
      assert.equal(state.top, 0, 'baseline remains at the top');
      assert.ok(state.ready < state.total, 'baseline reproduces deferred offscreen portraits');
      console.log('BASELINE: ' + state.ready + '/' + state.total + ' portraits ready before scrolling');
      return;
    }
    await ready(page);
    assert.deepEqual(await imageState(page), {total:60, ready:60, top:0}, profile.key + ': every current-page portrait ready without scrolling');
    const initial = await page.evaluate(async () => {
      window.imageFirstCard = document.querySelector('[data-dy-grid] .pk-card');
      window.imageFirstPortrait = window.imageFirstCard.querySelector('.pk-c-ph');
      const D = await import('/js/core/dynasty.js'), V = await import('/js/views/dynasty.js');
      const all = D.CARDS.filter(c => D.mine().o[c.id]).sort((a,b) => b.o-a.o || D.SERIES_ORDER.indexOf(a.s)-D.SERIES_ORDER.indexOf(b.s) || a.name.localeCompare(b.name));
      return {unshown:all.slice(60).map(c => new URL(V.portraitOf(c).url, location.href).href), save:JSON.stringify(D.mine())};
    });
    assert.ok(initial.unshown.every(href => !requested.has(href)), 'only the rendered 60-card page downloads, not the entire collection');
    await page.evaluate(() => { const pane = document.querySelector('.pk-pane'); pane.scrollTop = pane.scrollHeight; });
    await settle(page);
    const bottom = await imageState(page);
    assert.ok(bottom.top > 1000, 'fast scroll reaches deep offscreen rows');
    assert.equal(bottom.ready, bottom.total, 'fast scroll does not expose pending portraits');
    await page.locator('[data-dy-more]').click();
    await ready(page);
    assert.equal(await page.locator('[data-dy-grid] .pk-card').count(), 120);
    assert.equal((await imageState(page)).ready, 120, 'appended page preloads without scrolling through it');
    assert.ok(initial.unshown.slice(60).every(href => !requested.has(href)), 'unopened third page remains on demand');
    assert.equal(await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card') === imageFirstCard && imageFirstCard.querySelector('.pk-c-ph') === imageFirstPortrait), true, 'Show more preserves loaded image nodes');
    await page.locator('.pk-nav [data-dy-tab="decks"]').click();
    await page.locator('.pk-nav [data-dy-tab="cards"]').click();
    assert.equal(await page.evaluate(() => document.querySelector('[data-dy-grid] .pk-card') === imageFirstCard && imageFirstPortrait.complete), true, 'returning to the cached binder preserves loaded portraits');
    assert.equal(await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine())), initial.save, 'browsing and image loading do not change the save');

    // Force one official headshot to fail, then both sources, through the actual filtered binder.
    const fallback = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), V = await import('/js/views/dynasty.js');
      const c = D.CARDS.find(c => D.mine().o[c.id] && c.r === 'common');
      c.head = 'n:image-test-primary'; c.alt = '987654321';
      return {id:c.id, name:c.name, ...V.portraitOf(c)};
    });
    failures.add(fallback.url);
    await page.locator('input[name="dy-q"]').fill(fallback.name);
    await page.waitForFunction(id => { const cards = document.querySelectorAll('[data-dy-grid] .pk-card'); return cards.length === 1 && cards[0].dataset.dyCard === id; }, fallback.id);
    await ready(page);
    assert.equal(await page.locator('[data-dy-grid] .pk-c-ph').getAttribute('src'), fallback.alt, 'official headshot falls back to ESPN');
    const failed = await page.evaluate(async id => {
      const D = await import('/js/core/dynasty.js'), V = await import('/js/views/dynasty.js'), c = D.card(id);
      c.head = 'n:image-test-failed'; c.alt = '987654322';
      return V.portraitOf(c);
    }, fallback.id);
    failures.add(failed.url); failures.add(failed.alt);
    await page.locator('input[name="dy-q"]').fill(fallback.name + ' ');
    await page.waitForFunction(() => document.querySelectorAll('[data-dy-grid] .pk-c-ph').length === 0);
    assert.equal(await page.locator('[data-dy-grid] .pk-c-num').count(), 1, 'failed sources leave the existing jersey fallback');
    await page.evaluate(async () => { const data = await import('/js/core/data.js'); data.setGuest(null); data.setMe('mason'); });
    await page.waitForFunction(async () => !(await import('/js/core/features.js')).dynastyOpen() && !document.querySelector('[data-dy-grid] .pk-card'));
    assert.deepEqual(errors, [], 'unexpected browser errors');
    console.log('PASS: ' + profile.key + ' delayed local/remote images, fast scrolling, paging, retained nodes, filtering/fallback and profile exit (' + fixture.count + ' cards)');
  } finally { await context.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined)});
    const url = 'http://127.0.0.1:' + server.address().port;
    for (const profile of baseline ? profiles.slice(0,1) : profiles) await check(browser, url, profile);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
