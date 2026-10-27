// The real service worker across an update, then offline (sw.js): a player opens Keepfall online, a new version
// (CACHE bumped) takes over, the phone goes offline, and Keepfall must still draw in 3D. The 3D engine (js/vendor) is
// imported on demand, outside SHELL, so the update has to carry it over from the last cache. Evan, another member and
// a guest. Local server with ETags (as GitHub Pages sends), Firebase off. Run: node tools/release/check-offline-update.cjs
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.resolve(root, '../offline-update-qa');
fs.mkdirSync(out, {recursive: true});
let pw;
try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const CACHE = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE = '([^']+)'/)[1], NEXT = CACHE + '-next';
const VENDOR = ['three.module.min.js', 'GLTFLoader.js', 'RoomEnvironment.js', 'BufferGeometryUtils.js', 'SkeletonUtils.js'];
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2'};
// deployed: the update is live (sw.js names NEXT); online: false drops every request, as with no signal.
let deployed = false, online = true;
const log = [];
const server = http.createServer((req, res) => {
  if (!online) { req.socket.destroy(); return; }
  const u = new URL(req.url, 'http://local');
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, bytes) => {
    if (err) { res.writeHead(404).end(); return; }
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    if (u.pathname === '/sw.js' && deployed) bytes = Buffer.from(bytes.toString().replace(`const CACHE = '${CACHE}'`, `const CACHE = '${NEXT}'`));
    const tag = '"' + crypto.createHash('sha1').update(bytes).digest('hex') + '"', same = req.headers['if-none-match'] === tag;
    log.push({path: u.pathname, status: same ? 304 : 200, deployed});
    if (same) { res.writeHead(304, {ETag: tag}).end(); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', ETag: tag, 'Cache-Control': 'max-age=600'}).end(bytes);
  });
});
const inCache = name => page => page.evaluate(async name => {
  const keys = (await caches.has(name)) ? await (await caches.open(name)).keys() : [];
  const paths = keys.map(r => new URL(r.url).pathname);
  return {js: paths.filter(p => p.endsWith('.js')).length, vendor: paths.filter(p => p.startsWith('/js/vendor/')).map(p => p.slice('/js/vendor/three/'.length)).sort()};
}, name);
// Polls an async check in the page (waitForFunction takes a pending promise for a pass).
async function until(page, fn, arg, what) {
  for (const end = Date.now() + 120000; !(await page.evaluate(fn, arg)); await page.waitForTimeout(500)) {
    if (Date.now() > end) throw new Error('Timed out waiting for ' + what);
  }
}
const realmShown = page => page.waitForFunction(() => document.querySelector('.rl-gl canvas') || /can’t show your realm/.test(document.querySelector('.rl-gl')?.textContent || ''), null, {timeout: 120000});
// The lot as drawn: its screenshot must hold a real picture (many colours), not a blank canvas.
async function drawn(page, file) {
  const shot = await page.locator('.rl-gl').screenshot({path: file});
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data, colours = new Set();
    for (let i = 0; i < px.length; i += 4 * 97) colours.add((px[i] >> 3) << 10 | (px[i + 1] >> 3) << 5 | px[i + 2] >> 3);
    return colours.size;
  }, shot.toString('base64'));
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    for (const profile of ['evan', 'mason', 'guest']) {
      deployed = false; online = true; log.length = 0;
      const context = await browser.newContext({viewport: {width: 390, height: 844}}), page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await context.route(url => url.origin !== origin, r => r.abort());
      await context.addInitScript(profile => {
        sessionStorage.setItem('gg-skip-title', '1'); localStorage.setItem('gg-tab-hint', '2');
        if (profile === 'guest') { localStorage.removeItem('gg-me'); localStorage.setItem('gg-guest', 'Offline QA Guest'); }
        else localStorage.setItem('gg-me', profile);
        for (const p of [profile, 'visitor', 'guest:Offline QA Guest']) localStorage.setItem('gg-release-3.0:' + encodeURIComponent(p), '1');
      }, profile);
      const openRealm = async () => {
        await page.waitForFunction(() => window.__ggBooted, null, {timeout: 60000});
        await page.evaluate(async () => (await import('/js/app.js')).nav('/realm'));
        await realmShown(page);
      };
      // 1. Online: the first worker installs, takes the page, and Keepfall is played (three.js imported, cached).
      await page.goto(origin + '/');
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout: 120000});
      await openRealm();
      assert.equal(await page.locator('.rl-gl canvas').count(), 1, profile + ': Keepfall draws in 3D online');
      await until(page, async ([name, n]) => (await (await caches.open(name)).keys()).filter(r => r.url.includes('/js/vendor/')).length >= n, [CACHE, VENDOR.length], 'the engine in the cache');
      await page.waitForTimeout(4000);
      const before = await inCache(CACHE)(page);
      assert.deepEqual(before.vendor, [...VENDOR].sort(), profile + ': the engine is cached once Keepfall opens');
      // 2. The update: sw.js names a new CACHE; its worker installs, activates (the old cache deleted) and takes over.
      deployed = true;
      const mark = log.length;
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await until(page, async name => { const keys = (await caches.keys()).filter(k => /^(gg-|gridiron-)/.test(k)); const r = await navigator.serviceWorker.getRegistration(); return keys.length === 1 && keys[0] === name && r.active?.state === 'activated' && !r.installing && !r.waiting; }, NEXT, 'the update to take over');
      const after = await inCache(NEXT)(page);
      const fetched = log.slice(mark).filter(e => e.path.startsWith('/js/vendor/'));
      // 3. Offline: reload and open Keepfall again.
      online = false; await context.setOffline(true);
      await page.reload();
      await openRealm();
      const failed = await page.locator('.rl-gl').getByText('This phone can’t show your realm in 3D.').count();
      const colours = await page.locator('.rl-gl canvas').count() ? (await page.waitForTimeout(8000), await drawn(page, path.join(out, profile + '-offline.png'))) : 0;
      console.log(`${profile}: js cached ${before.js} -> ${after.js}; engine ${before.vendor.length} -> ${after.vendor.length} (update asked ${fetched.length}, ${fetched.filter(e => e.status === 304).length} answered 304); offline ${failed ? 'NO 3D' : 'canvas, ' + colours + ' colours'}`);
      assert.deepEqual(after.vendor, before.vendor, profile + ': the update carries the engine over');
      assert(after.js >= before.js, profile + ': no on-demand code lost in the update');
      assert(fetched.length === VENDOR.length && fetched.every(e => e.status === 304), profile + ': each engine file refreshed conditionally (304, unchanged)');
      assert.equal(failed, 0, profile + ': offline after the update, Keepfall does not say it can’t show the realm in 3D');
      assert(colours > 20, profile + ': offline after the update, Keepfall draws its lot in 3D (' + colours + ' colours)');
      await context.close();
    }
    // Precached for no one: a player who never opens Keepfall (or Return Man) never downloads the engine.
    const shell = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert(!/vendor/.test(shell.slice(shell.indexOf('const SHELL'), shell.indexOf('const TIMEOUT'))), 'js/vendor stays out of SHELL');
    console.log('PASS offline update: the engine survives an update, refreshed by ETag, and Keepfall draws in 3D offline (Evan, a member, a guest); never precached.');
  } finally {
    await browser.close(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
