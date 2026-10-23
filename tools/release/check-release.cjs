// Real-browser launch notice checks. Firebase is disabled on the local test server.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '../..');
let pw;
try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, bytes) => {
    if (err) { res.writeHead(404).end(); return; }
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(bytes);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  let browser;
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { browser = await pw.chromium.launch({headless:true, ...(channel ? {channel} : {})}); break; } catch (_) {}
  }
  if (!browser) throw new Error('No Chromium browser available');
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { sessionStorage.setItem('gg-skip-title', '1'); });
    await page.goto(url);
    await page.locator('.welcome').waitFor();
    await page.evaluate(async () => (await import('/js/core/release.js')).showReleaseNotice());
    assert.equal(await page.locator('.sh-release').count(),0,'No notice over welcome picker');
    await page.locator('[data-wl-skip]').click();
    await page.getByRole('dialog',{name:'Gridiron Hub v3.0'}).waitFor().catch(async e => {
      console.log('Notice diagnostic', errors, await page.evaluate(async () => ({hidden:document.hidden, title:!!document.getElementById('title'), welcome:!!document.querySelector('.welcome'), sheets:[...document.querySelectorAll('[role="dialog"]')].map(el=>({label:el.getAttribute('aria-label'),text:el.textContent.slice(0,120)})),busy:(await import('/js/core/ui.js')).busy.count,seen:localStorage.getItem('gg-release-3.0:visitor')})));
      throw e;
    });
    assert.equal(await page.locator('.release-copy p').count(),4,'Four-sentence summary');
    await page.waitForFunction(() => {
      const el = document.querySelector('.sh-release');
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.y >= 0 && b.bottom <= innerHeight + 1;
    }, null, {timeout:5000});
    const box = await page.locator('.sh-release').boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845,'Notice fits mobile');
    const output = path.resolve(root, '../v3-qa'); fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,'release-notice-390.png')});
    await page.getByRole('button',{name:'Let’s play'}).click();
    await page.locator('.sh-release').waitFor({state:'detached'});
    assert.equal(await page.evaluate(() => localStorage.getItem('gg-release-3.0:visitor')),'1');
    await page.reload();
    await page.waitForFunction(() => window.__ggBooted);
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.sh-release').count(),0,'Dismissal persists after reload');
    await page.evaluate(async () => (await import('/js/core/data.js')).setMe('evan'));
    await page.getByRole('dialog',{name:'Gridiron Hub v3.0'}).waitFor();
    await page.getByRole('button',{name:'Let’s play'}).click();
    await page.locator('.sh-release').waitFor({state:'detached'});
    await page.evaluate(async () => { const data = await import('/js/core/data.js'); data.setMe(data.ids.find(id => id !== 'evan')); });
    await page.getByRole('dialog',{name:'Gridiron Hub v3.0'}).waitFor();
    await page.getByRole('button',{name:'Let’s play'}).click();
    await page.locator('.sh-release').waitFor({state:'detached'});
    assert.equal(await page.evaluate(() => document.getElementById('stage').inert),false,'Closing restores navigation');
    assert.deepEqual(errors,[],'No uncaught errors');
    console.log('PASS release notice: welcome ordering, four sentences, mobile fit, profile delivery, persistence, restored navigation.');
    await require('./check-state.cjs')(page);
    await require('./check-navigation.cjs')(page, context);
    await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles'));
    const realmResults = await page.evaluate(async () => {
      const checks = [];
      await (await import('/js/core/checks-realm.js')).realmChecks((name, fn) => checks.push({name, fn}));
      const selected = checks.filter(c => /Keepfall v3:|Keepfall: the lands|Keepfall: the dragon in 3D|Keepfall: the dragon model’s life/.test(c.name));
      if (selected.length !== 4) throw Error('Missing shared Keepfall checks');
      for (const c of selected) { const r = await c.fn(); if (!(r === true || r.pass)) throw Error(c.name + ': ' + r.detail); }
      return 'PASS shared Keepfall: public access, scenery, Dragon model rendering, animations and cleanup.';
    });
    console.log(realmResults);
    assert.deepEqual(errors, [], 'No uncaught errors during reset and navigation');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; }).finally(() => server.close());
