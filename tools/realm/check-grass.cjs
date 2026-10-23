// Local-only visual and lifecycle checks for the owner's expanded Realm scenery.
// Usage: node tools/realm/check-scenery.cjs [--url=http://127.0.0.1:4179] [--screenshots | --wildlife | --ambience]
// The temporary browser starts with isolated storage, Firebase disabled, and all external traffic blocked.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const themes = ['coast', 'forest', 'tundra', 'ocean', 'desert', 'infernal', 'christmas'];
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const output = path.resolve(root, '../output');

async function localServer() {
  const s = http.createServer((req, res) => {
    let file;
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    } catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => {
      if (error) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      if (req.method === 'HEAD') res.end(); else res.end(bytes);
    });
  });
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  return s;
}

function playwright() {
  try { return require('playwright'); }
  catch (_) { return require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
}

function precacheCheck() {
  const sandbox = {self: {addEventListener() {}}};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8') + '\nglobalThis.precache = SHELL;', sandbox);
  assert.equal(sandbox.precache.filter(file => /img\/realm\//.test(file)).length, 0, 'Realm artwork must remain outside the shared offline precache');
  console.log('PASS: owner-only scenery is absent from the shared precache');
}

async function isolatedPage(browser, url, profile, onRoute) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  await context.route('**/*', async route => {
    const target = new URL(route.request().url());
    if (target.origin !== new URL(url).origin && !['data:', 'blob:'].includes(target.protocol)) return route.abort();
    if (onRoute) await onRoute(route, target);
    return route.continue();
  });
  await context.addInitScript(profile => {
    localStorage.setItem('gg-me', profile);
    localStorage.setItem('gg-welcome', '1');
    localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '2');
    sessionStorage.setItem('gg-skip-title', '1');
  }, profile);
  const page = await context.newPage(), errors = [], images = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' && /^Realm:/.test(message.text())) console.warn(message.text()); });
  page.on('console', message => { if (message.type() === 'error' && /THREE\.WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text())) errors.push(message.text()); });
  page.on('request', req => { if (/\/img\/realm\/.+\.(webp|png|jpg)(\?|$)/.test(req.url())) images.push(req.url()); });
  await page.goto(url + '/#/puzzles');
  await page.waitForFunction(() => window.__ggBooted);
  assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Test browser must not have remote-write capability');
  return {context, page, errors, images};
}

async function grassChecks(page) {
  const results = await page.evaluate(async () => {
    const T = await import('/js/vendor/three/three.module.min.js');
    const {createGrassWallpaper} = await import('/js/views/realm-grass.js');
    const renderer = new T.WebGLRenderer({antialias: false}); renderer.setSize(512, 256);
    renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = T.SRGBColorSpace;
    const target = new T.WebGLRenderTarget(512, 256), camera = new T.OrthographicCamera(-16, 16, 8, -8, .1, 100);
    camera.position.set(0, 20, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const ground = {lot: {cx: 452, cy: 807, h: 140}, under: (x, y) => new T.Vector3((x - 452) / 10, 0, (y - 807) / 10)};
    const scene = new T.Scene(), grass = createGrassWallpaper(T, scene, ground, {theme: 'coast', color: '#606625'});
    const frame = () => { renderer.setRenderTarget(target); renderer.render(scene, camera); const pixels = new Uint8Array(512 * 256 * 4); renderer.readRenderTargetPixels(target, 0, 0, 512, 256, pixels); renderer.setRenderTarget(null); return pixels; };
    grass.update(0, {camera}); const first = frame();
    for (let i = 1; i <= 40; i++) grass.update(i * .05, {camera});
    const second = frame();
    let changed = 0, outsideChanges = 0;
    for (let i = 0; i < first.length; i += 4) {
      if (Math.max(...[0, 1, 2].map(c => Math.abs(first[i + c] - second[i + c]))) > 2) { changed++; if (first[i + 3] === 0) outsideChanges++; }
    }
    grass.update(4, {active: false}); const pausedA = frame(); grass.update(6, {active: false}); const pausedB = frame();
    const paused = pausedA.every((value, i) => value === pausedB[i]);
    const nonGrass = ['tundra', 'christmas', 'desert', 'infernal'].map(theme => createGrassWallpaper(T, scene, ground, {theme}).counts.drawCalls);
    const centerAlpha = first[(128 * 512 + 256) * 4 + 3], outerAlpha = first[3];
    const dispose = () => {grass.dispose(); target.dispose(); renderer.dispose(); renderer.forceContextLoss();};
    window.__grassTest = {T, scene, ground, grass, camera, frame, createGrassWallpaper, dispose};
    return {changed, outsideChanges, paused, nonGrass, centerAlpha, outerAlpha, calls: renderer.info.render.calls};
  });
  assert(results.changed > 300, 'Actual grass pixels visibly move in the wind');
  assert.equal(results.outsideChanges, 0, 'Motion cannot escape the feathered patch');
  assert(results.centerAlpha > 220 && results.outerAlpha === 0, 'Detailed center blends fully away at the outer edge');
  assert(results.paused, 'Inactive grass remains still');
  assert.deepEqual(results.nonGrass, [0, 0, 0, 0], 'No grass appears on snow, sand, or ash');
  assert.equal(results.calls, 1, 'Wallpaper adds one draw call');
  await page.emulateMedia({reducedMotion: 'reduce'});
  const reduced = await page.evaluate(() => {const s = window.__grassTest; s.grass.update(8, {camera: s.camera}); const a = s.frame(); s.grass.update(10, {camera: s.camera}); const b = s.frame(); return {still: a.every((v, i) => v === b[i]), active: s.grass.counts.active};});
  assert(reduced.still && !reduced.active, 'Reduced motion keeps detailed grass still');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const owner = await page.evaluate(async () => {const s = window.__grassTest; const data = await import('/js/core/data.js'); data.setMe('mason'); const other = s.createGrassWallpaper(s.T, s.scene, s.ground, {theme: 'coast'}); const out = {disposed: s.grass.counts.disposed, children: s.scene.children.length, calls: other.counts.drawCalls}; s.dispose(); delete window.__grassTest; data.setMe('evan'); return out;});
  assert(owner.disposed && owner.children === 0 && owner.calls === 0, 'Profile changes remove the wallpaper and block non-owner creation');
  console.log('PASS: moving grass pixels, feathered edges, one draw call, paused/reduced motion, biome selection and owner cleanup', results);
}

async function previewChecks(page) {
  for (const theme of ['coast', 'forest', 'ocean']) {
    await page.evaluate(async theme => {
      const D = await import('/js/views/realm-3d.js'), F = await import('/js/core/realm.js'); await D.load(theme);
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:99999'; document.body.appendChild(host);
      let active = true; const v = D.create(host, {village: true, scenery: theme, isActive: () => active}); v.setLot(F.fresh()); v.frameVillage();
      const gl = v.canvas.getContext('webgl2'), originals = {}, counts = {draws: 0};
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) { originals[name] = gl[name]; gl[name] = function(...args) { counts.draws++; return originals[name].apply(this, args); }; }
      window.__grassPreview = {v, host, counts, pause() {active = false; host.style.display = 'none';}, resume() {active = true; host.style.display = 'block'; v.want();}, dispose() {v.dispose(); host.remove(); for (const [name, fn] of Object.entries(originals)) gl[name] = fn;}};
    }, theme);
    await page.waitForTimeout(250);
    await page.screenshot({path: path.join(output, 'realm-wind-' + theme + '-village.png')});
    if (theme === 'coast') {
      await page.evaluate(() => window.__grassPreview.v.look(22, 22, 250));
      await page.waitForTimeout(200);
      await page.screenshot({path: path.join(output, 'realm-wind-coast-middle-a.png')});
      await page.waitForTimeout(1200);
      await page.screenshot({path: path.join(output, 'realm-wind-coast-middle-b.png')});
      const paused = await page.evaluate(() => {window.__grassPreview.pause(); return window.__grassPreview.counts.draws;});
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.__grassPreview.counts.draws), paused, 'Hidden village stops all GPU drawing');
      await page.evaluate(() => window.__grassPreview.resume());
      await page.waitForFunction(before => window.__grassPreview.counts.draws > before, paused);
      await page.evaluate(() => window.__grassPreview.v.frameWorld());
      await page.waitForTimeout(200);
      await page.screenshot({path: path.join(output, 'realm-wind-coast-world.png')});
    }
    await page.evaluate(() => {window.__grassPreview.dispose(); delete window.__grassPreview;});
  }
  console.log('PASS: coast, forest and ocean integration, photographed zoom, full-world view, hidden draw pause and resume');
}

(async () => {
  const server = await localServer(), url = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    const test = await isolatedPage(browser, url, 'evan');
    try { await grassChecks(test.page); await previewChecks(test.page); assert.deepEqual(test.errors, [], 'No browser or shader errors'); }
    finally { await test.context.close(); }
    for (const profile of ['mason', 'none']) {
      const test = await isolatedPage(browser, url, profile);
      try { const allowed = await test.page.evaluate(async () => (await import('/js/views/realm-3d.js')).load('coast')); assert.equal(allowed, false); assert.equal(test.images.length, 0); }
      finally { await test.context.close(); }
    }
    console.log('PASS: members and unselected profiles never load the new grass scenery');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error); process.exitCode = 1;});