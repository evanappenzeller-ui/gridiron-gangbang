// The home screen's apps and the tab bar in a real browser (views/puzzles.js appsToBar / barToApps, puzzles.css).
// Local only: the app is served from this folder with Firebase disabled, so nothing reaches the live board.
// For Evan, a member and a visitor: the apps wear the tab bar's material (no colours of their own); an app's tap opens
// its tab as its icons fly into the bar (stand-ins over the screens, the bar bare under them), and the bar is whole
// once they land; the Daily Games tab brings the bar's icons back up into the apps. With reduced motion: no stand-ins.
// Usage: node tools/puzzles/check-home-browser.cjs [--shots=<dir>]   (Playwright's Chromium; screenshots when --shots)
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
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(bytes);
    });
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(s)));
}
const PROFILES = [
  {tag: 'evan', me: 'evan'},
  {tag: 'mason', me: 'mason'},
  {tag: 'visitor', me: 'none'}
];
const html = page => page.evaluate(() => document.documentElement.className);
const state = page => page.evaluate(() => {
  const bar = document.getElementById('tabbar'), cs = getComputedStyle(bar);
  return {home: document.documentElement.classList.contains('is-home'), morph: document.documentElement.classList.contains('hm-morph'),
    layer: document.querySelectorAll('.hm-morph-layer').length, ghosts: document.querySelectorAll('.hm-morph-layer .hm-ghost').length,
    bar: cs.visibility === 'visible' && +cs.opacity > .99, hash: location.hash};
});

async function run(url) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const p of PROFILES) for (const reduced of (p.tag === 'evan' ? [false, true] : [false])) {
      const T = p.tag + (reduced ? ' (reduced motion)' : '');
      const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference'});
      await context.route('https://**/*', route => route.abort());
      await context.addInitScript(p => {
        localStorage.setItem('gg-me', p.me);
        localStorage.setItem('gg-welcome', '1');
        ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      }, p);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e));
      page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      await page.waitForSelector('.hm-app', {timeout: 15000});
      await page.waitForTimeout(600);
      const shot = name => (shots && !reduced ? page.screenshot({path: path.join(shots, `${p.tag}-${name}.png`)}) : Promise.resolve());

      // Home: the apps in the bar's material, no colours of their own; the bar away.
      let s = await state(page);
      assert.equal(s.home, true, T + ': home');
      assert.equal(s.bar, false, T + ': no bar at home');
      const look = await page.evaluate(() => {
        const ic = [...document.querySelectorAll('.hm-ic')].map(e => getComputedStyle(e));
        return {bgs: new Set(ic.map(c => c.backgroundColor + c.backgroundImage)).size, img: ic[0].backgroundImage,
          glyph: ic[0].color, bar: getComputedStyle(document.getElementById('tabbar')).backgroundColor, tile: ic[0].backgroundColor,
          off: getComputedStyle(document.querySelector('#tabbar .tab:not([aria-current="page"])')).color};
      });
      assert.equal(look.bgs, 1, T + ': every app the same tile');
      assert.equal(look.img, 'none', T + ': no gradient');
      assert.equal(look.tile, look.bar, T + ': the tile is the bar’s colour');
      assert.equal(look.glyph, look.off, T + ': the glyph in the bar’s ink');
      await shot('0-home');

      // An app's tap: its icons fly into the bar as Pick'em opens.
      await page.click('.hm-app[data-go-tab="pickem"]');
      s = await state(page);
      if (reduced) assert.equal(s.layer, 0, T + ': no stand-ins with reduced motion');
      else {
        assert.equal(s.layer, 1, T + ': the stand-ins fly');
        assert.ok(s.ghosts >= 6, T + ': an icon for every tab');
        assert.equal(s.morph, true, T + ': the bar bare under them');
        await page.waitForTimeout(140); await shot('1-out-early');
        await page.waitForTimeout(120); await shot('2-out-mid');
      }
      await page.waitForTimeout(900);
      s = await state(page);
      assert.equal(s.hash, '#/pickem', T + ': Pick’em opened');
      assert.deepEqual([s.home, s.morph, s.layer, s.bar], [false, false, 0, true], T + ': the bar whole once they land');
      await shot('3-pickem');

      // The Daily Games tab: the bar's icons rise back into the apps.
      await page.click('#tabbar .tab[data-tab="puzzles"]');
      let seen = false;
      for (let i = 0; i < 40 && !reduced; i++) {
        s = await state(page);
        if (s.layer) { seen = true; break; }
        await page.waitForTimeout(25);
      }
      if (!reduced) {
        assert.ok(seen, T + ': the bar rises into the apps');
        await page.waitForTimeout(150); await shot('4-in-mid');
      }
      await page.waitForTimeout(1000);
      s = await state(page);
      assert.equal(s.hash, '#/puzzles', T + ': home again');
      assert.deepEqual([s.home, s.morph, s.layer, s.bar], [true, false, 0, false], T + ': the apps whole, the bar away');
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.hm-ic')).opacity), '1', T + ': the apps show');
      await shot('5-home');

      // A quick double: tap an app and straight back home mid-flight.
      await page.click('.hm-app[data-go-tab="lay"]');
      await page.waitForTimeout(80);
      await page.click('#tabbar .tab[data-tab="puzzles"]', {force: true}).catch(() => {});
      await page.waitForTimeout(1600);
      s = await state(page);
      assert.equal(s.layer, 0, T + ': nothing left flying');
      assert.equal(s.morph, false, T + ': the bar whole');
      assert.equal(s.home, s.hash === '#/puzzles', T + ': the bar matches the screen (' + s.hash + ')');
      assert.deepEqual(errors, [], T + ': unexpected browser exceptions');
      console.log(`${T}: apps ⇄ bar ok (${await html(page)})`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('PASS: the home screen’s apps and the tab bar');
}

(async () => {
  const s = await server();
  try { await run(`http://127.0.0.1:${s.address().port}`); }
  finally { await new Promise(resolve => s.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
