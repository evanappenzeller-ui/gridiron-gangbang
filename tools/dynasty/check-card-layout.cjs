// Card readability: separate HP/header, uncropped artwork, and attacks. No live Firebase reads or writes.
// Usage: node tools/dynasty/check-card-layout.cjs [--shots=/tmp/rivals-cards]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const fixture = '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/views/dynasty.css"><link rel="stylesheet" href="/css/views/dynasty-open.css"><style>html,body{height:auto;overflow:auto;background:#edf2f6}main{display:flex;flex-wrap:wrap;gap:24px;padding:24px}figure{flex:none}</style><main class="pk-sheet"></main>';
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/__cards') { res.writeHead(200, {'Content-Type': 'text/html'}).end(fixture); return; }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname)); }
  catch (_) { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, bytes) => {
    if (err) { res.writeHead(404).end(); return; }
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}).end(bytes);
  });
});

async function geometry(page, selector) {
  return page.locator(selector).evaluateAll(cards => cards.map(card => {
    const q = s => card.querySelector(s), rect = el => { const r = el.getBoundingClientRect(); return {top: r.top, bottom: r.bottom, left: r.left, right: r.right}; };
    const art = q('.pk-c-art'), body = q('.pk-c-body'), image = q('.pk-c-ph'), after = getComputedStyle(art, '::after');
    return {name: card.getAttribute('aria-label'), card: rect(card), header: rect(q('.pk-c-head')), art: rect(art), body: rect(body),
      repeatedName: !!q('.pk-c-head .pk-c-name'), faceOpacity: getComputedStyle(q('.pk-c-face')).opacity,
      bodyClipped: body.scrollHeight > body.clientHeight + 1, imageFit: image && getComputedStyle(image).objectFit,
      afterVisible: !['none', 'normal'].includes(after.content) && after.display !== 'none' && after.opacity !== '0',
      attacks: [...card.querySelectorAll('.pk-c-atk')].map(rect)};
  }));
}
function checkGeometry(rows) {
  for (const r of rows) {
    assert.equal(r.repeatedName, false, r.name + ': the name is not repeated above the printed card');
    assert.equal(r.faceOpacity, '1', r.name + ': the frame is opaque');
    assert.ok(r.header.bottom <= r.art.top + 1, r.name + ': HP/header does not overlap artwork');
    assert.ok(r.art.bottom <= r.body.top + 1, r.name + ': attacks are below the artwork');
    assert.ok(r.art.left > r.card.left && r.art.right < r.card.right, r.name + ': a border surrounds the artwork');
    assert.ok(r.art.bottom > r.art.top + 5, r.name + ': artwork has visible space');
    assert.equal(r.afterVisible, false, r.name + ': no gradient covers the artwork');
    assert.equal(r.bodyClipped, false, r.name + ': attack text is not clipped');
    if (r.imageFit) assert.equal(r.imageFit, 'contain', r.name + ': the complete image is shown');
    for (const a of r.attacks) assert.ok(a.bottom <= r.card.bottom + 1, r.name + ': attacks remain inside the card');
  }
}
async function run(url) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({viewport: {width: 1000, height: 1000}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'reduce'});
    // Remote headshots are irrelevant to geometry and must not delay these local checks.
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    await page.goto(url + '/__cards');
    const samples = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), B = await import('/js/core/dynasty-battle.js'), {cardHTML} = await import('/js/views/dynasty.js');
      await D.load();
      const cards = [D.CARDS.find(c => c.name === 'Tyler Warren' && c.s === 'L'), D.CARDS.find(c => c.r === 'common'),
        D.CARDS.find(c => c.r === 'rare'), D.CARDS.find(c => B.stats(c.id).ability), D.CARDS.find(c => B.stats(c.id).ex),
        D.CARDS.find(c => c.name === 'Joe Montana')]; // Joe Montana's scan is landscape.
      if (cards.some(c => !c)) throw new Error('Missing representative card');
      document.querySelector('main').innerHTML = [280, 92].map(width => cards.map(c => `<figure style="width:${width}px">${cardHTML(c, {size: width === 280 ? 'l' : 's', tag: false})}</figure>`).join('')).join('');
      return cards.map(c => c.name);
    });
    await page.evaluate(() => document.fonts.ready);
    checkGeometry(await geometry(page, '.pk-card'));
    if (shots) await page.locator('figure').first().screenshot({path: path.join(shots, 'tyler-warren.png')});
    console.log('PASS: large and small cards — ' + samples.join(', '));
    await context.close();

    const mobile = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await mobile.route('https://**/*', route => route.abort());
    await mobile.addInitScript(() => { localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1'); });
    const detail = await mobile.newPage();
    await detail.goto(url + '/#/puzzles');
    await detail.waitForFunction(() => window.__ggBooted);
    assert.equal(await detail.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false);
    await detail.evaluate(async () => { await (await import('/js/app.js')).nav('/puzzles/dynasty'); });
    await detail.waitForSelector('.pk-start.is-ready');
    await detail.locator('.pk-start').click({position: {x: 195, y: 640}});
    await detail.waitForFunction(() => !document.querySelector('.pk-start'));
    const id = await detail.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), c = D.CARDS.find(c => c.name === 'Tyler Warren' && c.s === 'L');
      D.mine().o[c.id] = 1; // Isolated browser save; Firebase remains disabled.
      return c.id;
    });
    await detail.locator('[data-dy-tab="cards"]').click();
    await detail.locator(`[data-dy-card="${id}"]`).click();
    await detail.waitForSelector('.pk-zoom .pk-card');
    await detail.waitForFunction(() => {
      const sheet = document.querySelector('.sheet.pk-sheet');
      return sheet && !sheet.getAnimations().length && getComputedStyle(sheet).opacity === '1';
    });
    checkGeometry(await geometry(detail, '.pk-zoom .pk-card'));
    assert.equal(await detail.locator('.pk-zoom .dy-foil, .pk-zoom .dy-glare').count(), 0, 'Card detail has no foil/glare overlay');
    if (shots) await detail.screenshot({path: path.join(shots, 'tyler-warren-detail.png')});
    console.log('PASS: card detail uses the clear, unobstructed layout');
    await mobile.close();
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
