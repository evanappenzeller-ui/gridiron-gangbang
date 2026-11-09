// Case-bottom controls turn the existing shelf case without resizing it or opening the game.
// Offline only: Firebase is removed, external requests are blocked, and scores are local fixtures.
// Usage: node tools/puzzles/check-case-flip.cjs [--shots=/tmp/case-flip]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const shots = process.argv.find(a => a.startsWith('--shots='))?.slice(8) || '/tmp/case-flip';
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.mp3':'audio/mpeg'};
fs.mkdirSync(shots, {recursive:true});

function serve() {
  const server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html')); }
    catch { return res.writeHead(400).end(); }
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, bytes) => {
      if (err) return res.writeHead(404).end();
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(bytes);
    });
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server)); });
}

const current = page => page.locator('.gm-slot.is-cur').first();
const control = page => current(page).locator('.gm-case-control[data-gm-case-flip]');
const geometry = page => current(page).evaluate(slot => {
  const c = slot.querySelector('.gm-case'), shelf = slot.closest('.gm-shelf');
  return {width:c.offsetWidth, height:c.offsetHeight, slotWidth:slot.offsetWidth, slotHeight:slot.offsetHeight,
    shelfHeight:shelf.offsetHeight, cw:getComputedStyle(shelf).getPropertyValue('--cw'), ch:getComputedStyle(shelf).getPropertyValue('--ch')};
});
async function select(page, id) {
  await page.evaluate(id => {
    const slot = document.querySelector(`.gm-slot:not([data-gm-clone])[data-gm-slot="${id}"]`), shelf = slot.closest('.gm-shelf');
    shelf.scrollTo({left:slot.offsetLeft + slot.offsetWidth / 2 - shelf.clientWidth / 2, behavior:'instant'});
  }, id);
  await page.waitForFunction(id => document.querySelector('.gm-slot.is-cur')?.dataset.gmSlot === id, id);
  await page.waitForTimeout(450);
}
async function label(page, expected) {
  await page.waitForFunction(expected => [...document.querySelectorAll('.gm-slot.is-cur [data-gm-case-flip]')].some(b => b.textContent.trim() === expected), expected);
}
async function flip(page, expected, keyboard = false) {
  const before = await geometry(page);
  if (keyboard) { await control(page).focus(); await page.keyboard.press('Enter'); }
  else await control(page).click();
  await label(page, expected);
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.gm-zoom').count(), 0, 'flip never opens enlarged case');
  assert.equal(new URL(page.url()).hash, '#/puzzles', 'flip never launches a game');
  assert.deepEqual(await geometry(page), before, 'case and shelf dimensions remain unchanged');
  assert.equal(await control(page).getAttribute('aria-pressed'), String(expected === 'Front cover'));
}
async function seedDaily(page, populated) {
  return page.evaluate(async populated => {
    const D = await import('/js/core/daily.js');
    await D.ensure();
    const entry = {...D.boardEntry(), p:123, r:D.relOf(D.PNUM)};
    const rows = populated ? [{id:'case-score', nick:'Mason', days:{[D.PNUM]:entry}, total:123, played:1}] : [];
    Object.assign(D.LB, {ready:true, synced:true, off:false, err:null, uid:'case-owner', raw:rows, players:rows, put:null, merge:null});
    D.__dev.emit('lb', {prev:[], why:'offline case fixture'});
    return D.boardRows('today').length;
  }, populated);
}

async function run(url) {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  try {
    for (const viewport of [{width:390,height:844}, {width:320,height:568}]) {
      const context = await browser.newContext({viewport, serviceWorkers:'block', reducedMotion:'reduce'});
      await context.route('**/*', r => new URL(r.request().url()).origin === url ? r.continue() : r.abort());
      await context.addInitScript(() => {
        localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1');
        sessionStorage.setItem('gg-skip-title', '1'); sessionStorage.setItem('gg-shelf', 'dynasty');
        ['evan','jayton','mason','visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted);
      await page.waitForFunction(() => document.querySelector('.gm-slot.is-cur')?.dataset.gmSlot === 'dynasty');
      await page.waitForTimeout(1300);
      const original = await geometry(page);
      assert.equal(await current(page).locator('[data-gm-case-flip]').count(), 0, 'Rivals has no scoreboard control');
      assert.equal(await current(page).locator('.gm-scr').count(), 0, 'Rivals case has no scoreboard');
      assert.equal(await current(page).locator('.gm-dy-print img').getAttribute('src'), 'img/games/dynasty-back-v2.webp', 'Rivals retains its printed back');
      await page.screenshot({path:path.join(shots, `${viewport.width}-rivals-front.png`)});

      await select(page, 'keep');
      await label(page, 'Back cover');
      assert.equal(await control(page).evaluate(b => b.parentElement.classList.contains('gm-slot') && !b.closest('.gm-case')), true, 'control is a sibling, not a nested button');
      await flip(page, 'Front cover');
      await flip(page, 'Back cover', true);

      // Horizontal scrolling away and back resets the case and its button together.
      await flip(page, 'Front cover');
      await select(page, 'dynasty');
      assert.equal(await current(page).locator('[data-gm-case-flip]').count(), 0, 'Rivals stays without a scoreboard after scrolling');
      assert.deepEqual(await geometry(page), original, 'Rivals dimensions stay unchanged');
      await select(page, 'keep');
      await label(page, 'Back cover');

      await select(page, 'puzzles');
      assert.equal(await seedDaily(page, false), 0);
      await page.waitForFunction(() => {
        const slot = document.querySelector('.gm-slot.is-cur');
        return slot && !slot.querySelector('[data-gm-case-flip], .gm-back');
      });
      assert.equal(await current(page).locator('[data-gm-case-flip]').count(), 0, 'no scoreboard button before anyone plays');
      assert.equal(await current(page).locator('.gm-back').count(), 0, 'empty daily scoreboard is not on the back');
      const emptySize = await geometry(page);
      await page.screenshot({path:path.join(shots, `${viewport.width}-daily-empty.png`)});
      assert.equal(await seedDaily(page, true), 1, 'fixture supplies one real daily board row');
      await label(page, 'Scoreboard');
      assert.deepEqual(await geometry(page), emptySize, 'score arrival does not resize the case');
      await page.screenshot({path:path.join(shots, `${viewport.width}-daily-scoreboard-button.png`)});
      await flip(page, 'Front cover');
      assert(await current(page).locator('.gm-back').innerText().then(t => t.includes('Mason')), 'populated back shows existing scoreboard rows');
      await page.screenshot({path:path.join(shots, `${viewport.width}-daily-populated.png`)});
      await flip(page, 'Scoreboard', true);

      // The new general shelf controls stay with Evan; no Rivals profile gets a case scoreboard.
      await page.evaluate(async () => { (await import('/js/core/data.js')).setMe('mason'); });
      await page.waitForFunction(() => !document.querySelector('[data-gm-case-flip]'));
      await page.evaluate(async () => { (await import('/js/core/data.js')).setMe('jayton'); });
      await page.waitForFunction(() => !document.querySelector('[data-gm-case-flip]'));
      await select(page, 'dynasty');
      assert.equal(await page.locator('[data-gm-case-flip]').count(), 0, 'Jayton has no new case controls');
      assert.equal(await current(page).locator('.gm-scr').count(), 0, 'Jayton Rivals case has no scoreboard');
      assert.equal(await current(page).locator('.gm-dy-print img').getAttribute('src'), 'img/games/dynasty-back-v2.webp', 'Jayton retains the Rivals printed back');
      assert.deepEqual(errors, [], 'no browser exceptions');
      console.log(`PASS ${viewport.width}x${viewport.height}: stable case size, shelf flips, keyboard, empty/populated boards, scroll reset and profile boundaries`);
      await context.close();
    }
  } finally { await browser.close(); }
}
(async () => {
  const server = await serve();
  try { await run('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
