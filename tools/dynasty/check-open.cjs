// Gridiron Dynasty's packs in a real browser (the real app, Firebase off, Evan's profile with a seeded Dynasty): opens a
// pack the way a player does (Open, then a swipe across its top), records the whole thing as a video and cuts it into
// contact sheets, then taps through the cards to the results. --gallery instead draws every pack design big, side by side.
//   node tools/dynasty/check-open.cjs [--kind std|team|prem|gday|leg|start] [--out DIR] [--dpr 2] [--reduced]
//   node tools/dynasty/check-open.cjs --gallery [--only leg,gday] [--tile 116] [--out DIR] [--dpr 2]
// Prints where it put things. Fails on any uncaught page error.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const ONLY = String(arg('only', '')).split(',').filter(Boolean), TILE = +arg('tile', 116);
const KIND = arg('kind', 'leg'), OUT = path.resolve(arg('out', path.join(root, '../dynasty-qa'))), DPR = +arg('dpr', 2), REDUCED = !!arg('reduced', false), GALLERY = !!arg('gallery', false);
fs.mkdirSync(OUT, {recursive: true});
let pw;
try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, bytes) => {
    // (a route like /puzzles/dynasty is the app's page)
    if (err && !path.extname(file)) return fs.readFile(path.join(root, 'index.html'), (e2, b2) => send(path.join(root, 'index.html'), b2));
    if (err) { res.writeHead(404).end(); return; }
    send(file, bytes);
  });
  function send(file, bytes) {
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(bytes);
  }
});
// A Dynasty begun with its Starter Pack opened: some cards, coins, no packs waiting (Evan's packs are unlimited anyway).
const SAVE = {v: 1, born: Date.now() - 864e5, at: Date.now(), o: {'C-timeout': 2, 'C-twomin': 2, 'C-audible': 2, 'C-scout': 1, 'C-flag': 1, 'I-recruit': 2, 'I-water': 2},
  pk: {}, cl: {}, dk: [], nw: [], lp: [], pp: 40, sp: 0, cr: 50000, dd: '', kit: 1, kit2: 1, kit3: 1, tr: 0, rec: {w: 0, l: 0}, nm: ''};

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch();
  const vid = path.join(OUT, 'video');
  fs.rmSync(vid, {recursive: true, force: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    reducedMotion: REDUCED ? 'reduce' : 'no-preference', ...(GALLERY ? {} : {recordVideo: {dir: vid, size: {width: 390, height: 844}}})});
  await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.addInitScript(save => {
    sessionStorage.setItem('gg-skip-title', '1');
    localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-tab-hint', '2'); localStorage.setItem('gg-release-3.0:evan', '1'); localStorage.setItem('gg-dynasty-seen', '1');
    if (!localStorage.getItem('gg-dy1-m_evan')) localStorage.setItem('gg-dy1-m_evan', JSON.stringify(save));
  }, SAVE);
  await page.goto(url);
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
  await page.locator('.pk-bigpack').waitFor({timeout: 30000});
  // (the title screen on entering, Oct 29 2026, views/dynasty.js startHTML: a tap through it once the cards are in)
  if (await page.locator('.pk-start').count()) {
    await page.locator('.pk-start.is-ready').waitFor({timeout: 30000});
    await page.locator('.pk-start').click({position: {x: 195, y: 640}});
    await page.waitForFunction(() => !document.querySelector('.pk-start'), null, {timeout: 10000});
  }
  await page.waitForTimeout(600);
  const shot = async name => { const f = path.join(OUT, name + '.png'); await page.screenshot({path: f}); return f; };
  const made = [];
  if (GALLERY) {
    // every design of every pack, big, on Pocket's ground (views/dynasty-packs.js: DESIGNS when it has them)
    await page.evaluate(async ({only, tile}) => {
      const P = await import('/js/views/dynasty-packs.js'), D = await import('/js/core/dynasty.js');
      const kinds = ['start', ...D.PACK_ORDER].filter(k => !only.length || only.includes(k));
      const n = k => (P.designsOf ? P.designsOf(k).length : 1);
      const el = document.createElement('div');
      el.id = 'qa-gallery';
      el.style.cssText = 'position:fixed;inset:0;z-index:999;overflow:auto;background:#E9EFF4;padding:12px;display:flex;flex-direction:column;gap:14px';
      el.innerHTML = kinds.map(k => `<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap"><b style="width:100%;font:800 13px system-ui">${k}</b>`
        + Array.from({length: n(k)}, (_, i) => `<span style="width:${tile}px;display:block">${P.packHTML(k, {big: true, design: i})}</span>`).join('') + '</div>').join('');
      el.querySelectorAll('.pk-pack').forEach(p => { p.style.width = '100%'; });
      document.body.appendChild(el);
    }, {only: ONLY, tile: TILE});
    await page.waitForTimeout(800);
    const h = await page.evaluate(() => document.getElementById('qa-gallery').scrollHeight);
    const w = await page.evaluate(() => document.getElementById('qa-gallery').scrollWidth);
    await page.setViewportSize({width: Math.max(390, w), height: Math.min(4000, h + 24)});
    await page.waitForTimeout(400);
    made.push(await shot('gallery'));
    // the Packs home with its big pack, and the picker sheet
    await page.evaluate(() => document.getElementById('qa-gallery').remove());
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(300);
    made.push(await shot('home'));
    await page.locator('[data-dy-packs]').click();
    await page.waitForTimeout(700);
    made.push(await shot('picker'));
  } else {
    if (KIND !== 'std') {
      await page.locator('[data-dy-packs]').click();
      await page.locator(`[data-dy-pick="${KIND}"]`).click();
      await page.waitForTimeout(500);
    }
    made.push(await shot('0-home'));
    await page.locator('button.pk-open[data-dy-openhere]').click();
    if (KIND === 'team') { await page.locator('[data-dy-team]').first().click(); }
    await page.locator('[data-dy-tear]').waitFor();
    await page.waitForTimeout(900);
    made.push(await shot('1-pack'));
    // the swipe across the top: the tear line is 13% down the pack
    const box = await page.locator('.dy-rip').boundingBox();
    const y = box.y + box.height * 0.13, x0 = box.x + box.width * 0.06, x1 = box.x + box.width * 1.02;
    await page.mouse.move(x0, y); await page.mouse.down();
    for (let i = 1; i <= 14; i++) { await page.mouse.move(x0 + (x1 - x0) * i / 14, y); await page.waitForTimeout(16); }
    await page.mouse.up();
    // the opening plays: stills along the way
    for (const ms of [150, 450, 900, 1500, 2300, 3200]) { await page.waitForTimeout(ms - (made.t || 0)); made.t = ms; made.push(await shot(`2-open-${ms}ms`)); }
    // through the cards: a tap each, a still of each card settled, then the results
    for (let i = 0; i < 25; i++) {
      if (await page.locator('.pk-results:not([hidden])').count()) break;
      await page.waitForTimeout(2600);
      made.push(await shot(`3-card-${i + 1}`));
      const next = page.locator('[data-dy-next]');
      if (await next.count() && await next.isVisible()) await next.click(); else await page.mouse.click(195, 420);
    }
    await page.waitForTimeout(1200);
    made.push(await shot('4-results'));
  }
  assert.deepEqual(errors, [], 'no uncaught errors');
  const video = GALLERY ? null : await page.video().path();
  await context.close(); await browser.close(); server.close();
  if (video) {
    // contact sheets of the opening: 12 frames a second, 10 to a sheet
    const fr = path.join(OUT, 'frames'); fs.rmSync(fr, {recursive: true, force: true}); fs.mkdirSync(fr);
    execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', 'fps=12,scale=195:-1', path.join(fr, 'f_%04d.png')]);
    const n = fs.readdirSync(fr).length;
    for (let s = 0; s * 10 < n; s++) execFileSync('ffmpeg', ['-v', 'error', '-y', '-start_number', String(s * 10 + 1), '-i', path.join(fr, 'f_%04d.png'), '-frames:v', '1', '-vf', 'tile=10x1:padding=2:color=red', path.join(OUT, `sheet-${String(s).padStart(2, '0')}.png`)]);
    console.log(`video: ${video}\nframes: ${n} at 12 fps in ${fr}; sheets: ${OUT}/sheet-NN.png (10 frames each, ${(10 / 12).toFixed(2)} s a sheet)`);
  }
  console.log('stills:\n' + made.filter(x => typeof x === 'string').join('\n'));
  console.log('PASS');
})().catch(e => { console.error(e); process.exit(1); });
