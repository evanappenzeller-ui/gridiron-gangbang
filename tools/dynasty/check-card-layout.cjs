// Card readability: clear identity, portraits, key game values, and full detail rules. No live Firebase reads or writes.
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
const fixture = '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/views/dynasty.css"><link rel="stylesheet" href="/css/views/dynasty-open.css"><link rel="stylesheet" href="/css/views/dynasty-rivals.css"><link rel="stylesheet" href="/css/views/dynasty-rarity.css"><style>html,body{height:auto;overflow:auto;background:#edf2f6}main{display:flex;flex-wrap:wrap;gap:24px;padding:24px}figure{flex:none}</style><main class="pk-sheet"></main>';
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
    const art = q('.pk-c-art'), body = q('.pk-c-body'), image = q('.pk-c-ph'), name = q('.pk-c-name');
    const face = q('.pk-c-face'), nameStyle = getComputedStyle(name);
    // Font ink can exceed a tight line box (Segoe UI does by 2px at 280px). Visible overflow is not clipping.
    const nameRange = document.createRange(); nameRange.selectNodeContents(name);
    return {name: card.getAttribute('aria-label'), card: rect(card), header: rect(q('.pk-c-head')), art: rect(art), nameBox: rect(name), hpBox: rect(q('.pk-c-hp')), footer: rect(q('.pk-c-meta')),
      nameVisible: !!name && name.offsetHeight > 0, nameClipped: nameStyle.overflowY !== 'visible' && name.scrollHeight > name.clientHeight + 1,
      nameInk: rect(nameRange), faceOpacity: getComputedStyle(face).opacity,
      faceClipped: face.scrollHeight > face.clientHeight + 1, imageFit: image && getComputedStyle(image).objectFit, isPhoto: !!image && image.classList.contains('is-photo'),
      artFallback: !!q('.pk-c-num'), bodyVisible: getComputedStyle(body).display !== 'none', small: card.classList.contains('sz-s'),
      rarity: q('.pk-c-rar').textContent, hasPrintedScan: !!q('.is-real'),
      vitals: rect(q('.pk-c-hp')), attacks: [...card.querySelectorAll('.pk-c-atk')].map(rect)};
  }));
}
function checkGeometry(rows) {
  for (const r of rows) {
    assert.equal(r.nameVisible, true, r.name + ': visible player name independent of image');
    assert.equal(r.nameClipped, false, r.name + ': player name is not clipped');
    assert.ok(r.nameInk.top >= r.header.top - 1 && r.nameInk.bottom <= r.header.bottom + 1, r.name + ': rendered name stays within its header');
    assert.equal(r.faceOpacity, '1', r.name + ': the frame is opaque');
    assert.equal(r.faceClipped, false, r.name + ': the content fits inside the frame');
    assert.ok(r.header.bottom <= r.art.top + 1, r.name + ': overall/header does not overlap portrait');
    assert.ok(r.nameBox.right <= r.hpBox.left + 1, r.name + ': name and health do not overlap');
    assert.ok(r.footer.bottom <= r.card.bottom + 1, r.name + ': footer remains inside frame');
    assert.ok(r.art.bottom > r.art.top + 5, r.name + ': artwork has visible space');
    assert.equal(r.hasPrintedScan, false, r.name + ': no printed trading card inside the card frame');
    assert.equal(r.artFallback, true, r.name + ': jersey fallback survives failed portrait');
    assert.ok(r.rarity.length > 2, r.name + ': rarity is labelled in words');
    assert.equal(r.bodyVisible, !r.small, r.name + ': small cards omit unreadable attack text');
    assert.ok(r.vitals.bottom <= r.card.bottom + 1, r.name + ': health and type remain inside the card');
    // (a cut-out headshot is never cropped; a Legend's photo is a rectangle that fills the window)
    if (r.imageFit) assert.equal(r.imageFit, r.isPhoto ? 'cover' : 'contain', r.name + (r.isPhoto ? ': a Legend photo fills the window' : ': portrait is not cropped'));
    if (!r.small) for (const a of r.attacks) assert.ok(a.bottom <= r.card.bottom + 1, r.name + ': attacks remain inside the card');
  }
}
async function run(url) {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport: {width: 1000, height: 1000}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'reduce'});
    // Remote headshots are irrelevant to geometry and must not delay these local checks.
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    await page.goto(url + '/__cards');
    const samples = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), B = await import('/js/core/dynasty-battle.js'), {cardHTML} = await import('/js/views/dynasty.js');
      await D.load();
      const cards = [...D.RARITY.map(r => D.CARDS.find(c => c.r === r && c.s === 'L')),
        D.CARDS.find(c => B.stats(c.id).ability), D.CARDS.find(c => c.name === 'Tyler Warren' && c.s === 'L'),
        [...D.CARDS].sort((a, b) => b.name.length - a.name.length)[0], D.CARDS.find(c => c.name === 'Joe Montana'),
        D.CARDS.find(c => c.name === 'Jerry Rice'), D.card('P0033886')];
      if (cards.some(c => !c)) throw new Error('Missing representative card');
      document.querySelector('main').innerHTML = [280, 160, 92].map(width => cards.map(c => `<figure style="width:${width}px">${cardHTML(c, {size: width === 280 ? 'l' : 's', tag: false})}</figure>`).join('')).join('');
      return cards.map(c => c.name);
    });
    await page.evaluate(() => document.fonts.ready);
    checkGeometry(await geometry(page, '.pk-card'));
    if (shots) await page.locator('main').screenshot({path: path.join(shots, 'tyler-warren.png')});
    const finishes = await page.locator('figure:nth-child(-n+5) .pk-card').evaluateAll(cards => cards.map(card => ({
      rarity: card.querySelector('.pk-c-rar').textContent,
      scene: getComputedStyle(card).getPropertyValue('--card-scene'),
      foil: !!card.querySelector('.pk-c-foil'),
      motion: card.getAnimations({subtree: true}).some(a => a.playState === 'running')
    })));
    assert.equal(new Set(finishes.map(c => c.scene)).size, 5, 'Every rarity keeps its own fallback scenery');
    for (const c of finishes) {
      assert.equal(c.foil, c.rarity !== 'common', c.rarity + ': foil starts at Rare');
      assert.equal(c.motion, false, c.rarity + ': reduced motion stays still');
    }
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.evaluate(async () => {
      const {bindCardFoil} = await import('/js/views/dynasty-foil.js');
      window.__stopFoil = bindCardFoil(document.querySelector('main'));
    });
    const rare = page.locator('figure:nth-child(2) .pk-card');
    const bounds = await rare.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .25);
    await page.waitForFunction(() => document.querySelector('figure:nth-child(2) .pk-card').classList.contains('is-foil-active'));
    const shine = await rare.evaluate(card => ({x: parseFloat(card.style.getPropertyValue('--shine-x')), animation: getComputedStyle(card.querySelector('.pk-c-foil')).animationName}));
    assert.ok(shine.x > 70 && shine.x < 90, 'Reflection follows pointer position');
    assert.equal(shine.animation, 'none', 'Idle animation never competes with pointer reflection');
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.waitForFunction(() => !document.querySelector('.is-foil-active'));
    await page.evaluate(() => window.__stopFoil());
    assert.equal(await rare.evaluate(card => card.style.getPropertyValue('--shine-x')), '', 'Interaction cleanup removes reflection coordinates');
    console.log('PASS: five rarity finishes, pointer reflection, reduced motion and cleanup');
    console.log('PASS: large and small cards — ' + samples.join(', '));
    await context.close();

    const mobile = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await mobile.route('https://**/*', route => process.env.CARD_LIVE_PORTRAITS === '1' && new URL(route.request().url()).hostname === 'a.espncdn.com' ? route.continue() : route.abort());
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
      const D = await import('/js/core/dynasty.js'), c = D.card('P0033886');
      if (!c || c.name !== 'T.J. Watt' || c.team !== 'PIT' || c.r !== 'mythic') throw new Error('Missing screenshot card: T.J. Watt Prime Mythic');
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
    const scenery = await detail.locator('.pk-zoom .pk-c-scenery').evaluate(async scene => {
      const background = getComputedStyle(scene).backgroundImage;
      const url = /url\(["']?([^"')]+\/teams-v1\/pit\.webp)["']?\)/.exec(background)?.[1];
      const image = new Image(); image.src = url || ''; await image.decode();
      return {team: scene.dataset.teamScene, url, width: image.naturalWidth};
    });
    assert.equal(scenery.team, 'PIT', 'the reported card uses Pittsburgh scenery in its actual detail sheet');
    assert.ok(scenery.width >= 500 && scenery.url.includes('/teams-v1/pit.webp'), 'Pittsburgh photograph loads in the Mythic card detail');
    assert.ok(await detail.locator('.pk-zoom .pk-c-foil, .pk-zoom .pk-c-glint').evaluateAll(els => els.every(el => getComputedStyle(el).pointerEvents === 'none')), 'Decorative foil never blocks card interaction');
    assert.equal(await detail.locator('.pk-info .pk-atk li').count(), 2, 'Full attack rules remain available in detail');
    assert.equal(await detail.locator('.pk-signature-note').count(), 1, 'Signature energy spend is explained in detail');
    if (process.env.CARD_LIVE_PORTRAITS === '1') await detail.locator('.pk-zoom .pk-c-ph').evaluate(image => image.decode());
    if (shots) await detail.screenshot({path: path.join(shots, 'tj-watt-prime-detail.png')});
    console.log('PASS: T.J. Watt Prime Mythic detail uses its decoded Pittsburgh photograph and clear rules');
    await mobile.close();
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
