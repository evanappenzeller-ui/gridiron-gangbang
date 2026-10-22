#!/usr/bin/env node
// Real-model integration checks for Evan's player kit. No HTTP server required.
// Run: node tools/return/check-player-style.cjs
// Only the test response appends read-only exports for inspecting module internals.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../output/return-man/player-style-qa');
const origin = 'http://127.0.0.1:8765';
const stylePath = '/js/views/return-player-style.js';
const baseline = process.env.RETURN_PLAYER_BASELINE || 'ae4ea87';
const oldPlayerSource = execFileSync('git', ['show', `${baseline}:js/views/return-3d.js`], {cwd: root, encoding: 'utf8'});
fs.mkdirSync(output, {recursive: true});
let playwright;
try { playwright = require('playwright'); } catch (_) {
  playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const mime = {'.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp'};
function localSource(url, legacy) {
  const pathname = decodeURIComponent(new URL(url).pathname), candidate = path.resolve(root, '.' + pathname);
  const relative = path.relative(root, candidate);
  assert.ok(!pathname.includes('\0') && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
  const real = fs.realpathSync(candidate), resolved = path.relative(fs.realpathSync(root), real);
  assert.ok(resolved !== '..' && !resolved.startsWith('..' + path.sep) && !path.isAbsolute(resolved));
  let body = fs.readFileSync(real);
  if (pathname === '/js/views/return-3d.js') body = (legacy ? oldPlayerSource : body.toString('utf8')) +
    (legacy ? '\nexport {GL}; export const ownerStyle = null;\n' : '\nexport {GL, ownerStyle, syncPlayerStyle};\n');
  return {status: 200, contentType: mime[path.extname(real)] || 'application/octet-stream', body};
}
async function serviceWorkerCheck() {
  const handlers = {}, added = [], stored = [], fetched = [], scope = 'https://example.test/gridiron-gangbang/';
  const response = {ok: true, type: 'basic', clone() { return this; }};
  const cache = {add: async request => added.push(request.url), put: async request => stored.push(request.url || request)};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
    self: {location: {origin: 'https://example.test'}, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {}, clients: {claim: async () => {}}},
    caches: {open: async () => cache, match: async () => null, keys: async () => [], delete: async () => true},
    fetch: async request => { fetched.push(request.url || request); return response; },
    Request: class extends Request { constructor(url, options) { super(new URL(url, scope), options); } }, Response, URL, setTimeout
  });
  let done;
  handlers.install({waitUntil(p) { done = p; }}); await done;
  assert.ok(!added.some(url => url.endsWith(stylePath)), 'owner kit module is not precached');
  handlers.fetch({request: new Request(scope + stylePath.slice(1)), respondWith(p) { done = p; }}); await done;
  assert.equal(fetched.length, 1); assert.equal(stored.length, 0, 'owner kit module stays outside shared runtime cache');
}
async function launch() {
  const options = {headless: true, args: ['--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas']};
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) return playwright.chromium.launch({...options, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await playwright.chromium.launch({...options, ...(channel ? {channel} : {})}); } catch (_) {}
  }
  throw new Error('No Chromium browser available');
}
async function fixture(browser, {legacy = false, delay = false, fail = false} = {}) {
  const context = await browser.newContext({viewport: {width: 900, height: 900}, serviceWorkers: 'block'});
  const page = await context.newPage(), errors = [], external = [], requests = [];
  let release; const held = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin + '/')) { external.push(url); return route.abort(); }
    const pathname = new URL(url).pathname;
    if (pathname === '/__player_check__') return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Return Man player check</title><link rel="icon" href="data:,"><style>@font-face{font-family:Barlow Condensed;src:url(/fonts/barlow-condensed-800.woff2);font-weight:800}body{margin:0;background:#dcecf3}canvas{display:block}</style>'});
    if (pathname === stylePath) { requests.push(url); if (delay) await held; if (fail) return route.fulfill({status: 503, body: 'Test: unavailable style'}); }
    try { return await route.fulfill(localSource(url, legacy)); } catch (error) { errors.push(error.message); return route.fulfill({status: 404, body: error.message}); }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !(fail && message.text().includes('503'))) errors.push(message.text()); });
  await page.goto(origin + '/__player_check__');
  await page.evaluate(async () => {
    const [T, D, R, D3] = await Promise.all([import('/js/vendor/three/three.module.min.js'), import('/js/core/data.js'), import('/js/core/return.js'), import('/js/views/return-3d.js')]);
    await D.load(); D.setMe('ben');
    if (!await D3.load()) throw new Error('Real player model failed to load');
    document.body.append(D3.GL.canvas);
    const co = R.course(940001, 0); co.order = [0]; co.z = Infinity; co.rows = []; co.sets = []; co.items = [];
    const st = {co, W: 900, H: 900, dpr: 1, f: 980, y0: 380, camX: 0, camZ: 0, camH: 1.3, camH0: 1.3, back: 7, bend: 0,
      run: {co, x: 0, z: 7, next: 0, nextItem: 0}, got: new Set(), knocked: new Map()};
    let now = 1000, watched = null;
    const hashArray = array => { let h = 2166136261; for (const byte of new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) h = Math.imul(h ^ byte, 16777619); return h >>> 0; };
    const sha = async object => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(object)))), b => b.toString(16).padStart(2, '0')).join('');
    const helmet = P => !!P.model.getObjectByName('arcade-helmet');
    function frame(phase = .2, move = 'run', u = .5, extra = {}) {
      for (const sample of [(phase + .99) % 1, phase]) {
        now += 100;
        const spec = {move, u, phase: sample, t: now / 1000, carry: 1, ball: true, ...extra};
        D3.render(st, now, {us: {spec, x: 0, y: 0, z: 4.5}, them: {spec: {...spec, carry: 0, ball: false}, x: 3.2, y: 0, z: 8},
          ghost: {spec, x: -3.2, y: 0, z: 8, alpha: .22}});
      }
    }
    async function player(P) {
      const meshes = [];
      P.root.updateWorldMatrix(true, true);
      P.root.traverse(o => {
        if (!o.isMesh) return;
        const mat = m => ({name: m.name, type: m.type, color: m.color?.getHex(), roughness: m.roughness, metalness: m.metalness,
          opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite, map: m.map ? {width: m.map.image?.width, height: m.map.image?.height, flipY: m.map.flipY, space: m.map.colorSpace} : null});
        meshes.push({name: o.name, visible: o.visible, attributes: Object.fromEntries(Object.entries(o.geometry.attributes).map(([key, a]) => [key, hashArray(a.array)])),
          material: (Array.isArray(o.material) ? o.material : [o.material]).map(mat)});
      });
      const clips = Object.fromEntries(await Promise.all(Object.entries(P.act).map(async ([name, action]) => {
        const c = action.getClip(); return [name, await sha({name: c.name, duration: c.duration, tracks: c.tracks.map(t => ({name: t.name, times: hashArray(t.times), values: hashArray(t.values)}))})];
      })));
      const bones = Object.values(P.B).map(b => [...b.position.toArray(), ...b.quaternion.toArray()]);
      const ballDistance = P.ball ? P.ball.getWorldPosition(new T.Vector3()).distanceTo(P.B.RightHand.getWorldPosition(new T.Vector3())) : null;
      return {styled: helmet(P), meshCount: meshes.length, meshHash: await sha(meshes), clips, finite: bones.flat().every(Number.isFinite),
        ball: P.ball?.visible || false, ballDistance, runDuration: P.run.getClip().duration};
    }
    function monitor() {
      const styleGeometry = new Set(), styleMaterial = new Set(), baseGeometry = new Set(), baseMaterial = new Set();
      const collect = (obj, geometries, materials) => obj.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
      for (const key of ['us', 'ghost']) {
        const P = D3.GL.players[key];
        P.root.traverse(o => { if (/^(arcade-helmet|arcade-shoulder-|cleat-details-)/.test(o.name)) collect(o, styleGeometry, styleMaterial); });
        collect(D3.GL.basePlayers[key].root, baseGeometry, baseMaterial);
      }
      watched = {styleGeometry: 0, styleMaterial: 0, baseGeometry: 0, baseMaterial: 0,
        expectedGeometry: styleGeometry.size, expectedMaterial: styleMaterial.size};
      for (const [name, items] of Object.entries({styleGeometry, styleMaterial, baseGeometry, baseMaterial})) items.forEach(item => item.addEventListener('dispose', () => { watched[name]++; }));
      return {...watched};
    }
    window.playerCheck = {
      identity(id) { D.setMe(id); }, frame,
      status() { return {owner: D.isOwner(), styled: helmet(D3.GL.players.us), ghostStyled: helmet(D3.GL.players.ghost),
        originalRefs: !D3.GL.basePlayers || D3.GL.players.us === D3.GL.basePlayers.us, ready: D3.ready()}; },
      async snapshot() { frame(); return Object.fromEntries(await Promise.all(Object.entries(D3.GL.players).map(async ([key, P]) => [key, await player(P)]))); },
      async moves() {
        const samples = [];
        for (let i = 0; i < 12; i++) { frame(i / 12); samples.push({move: 'run', phase: i / 12, ...(await player(D3.GL.players.us))}); }
        for (const move of ['jump', 'slide', 'sideL', 'sideR', 'fall']) for (const u of [0, .5, 1]) {
          frame(.2, move, u); samples.push({move, u, ...(await player(D3.GL.players.us))});
        }
        frame(.2, 'run', .5, {catch: 1}); samples.push({move: 'catch', ...(await player(D3.GL.players.us))});
        return {samples, ghostAlpha: D3.GL.ghost.map(m => ({transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite}))};
      }, monitor, disposal() { return watched; },
      screenshot(view) {
        frame(); const gl = D3.GL;
        gl.players.them.root.visible = false; gl.players.ghost.root.visible = false;
        if (view === 'game') { gl.renderer.render(gl.scene, gl.camera); return; }
        gl.scene.getObjectByName('world').visible = false;
        gl.scene.background = new T.Color('#dcecf3');
        const camera = new T.PerspectiveCamera(32, 1, .1, 100);
        camera.position.set(...(view === 'front' ? [0, 1.4, -9.2] : view === 'side' ? [4.7, 1.4, -4.5] : [0, 1.4, .2]));
        camera.lookAt(0, 1.08, -4.5); gl.renderer.render(gl.scene, camera);
        gl.scene.getObjectByName('world').visible = true; gl.scene.background = null;
      }
    };
    frame();
  });
  return {page, context, requests, errors, external, release,
    identity: id => page.evaluate(id => window.playerCheck.identity(id), id),
    snapshot: () => page.evaluate(() => window.playerCheck.snapshot()),
    status: () => page.evaluate(() => window.playerCheck.status()),
    async styled() { await page.waitForFunction(() => { window.playerCheck.frame(); return window.playerCheck.status().styled; }); },
    async screenshot(name, view) { await page.evaluate(view => window.playerCheck.screenshot(view), view); await page.screenshot({path: path.join(output, name + '.png')}); },
    clean() { assert.deepEqual(errors, []); assert.deepEqual(external, []); },
    async close() { release(); await context.close(); }
  };
}
function original(actual, expected) { for (const key of ['us', 'them', 'ghost']) { assert.equal(actual[key].meshHash, expected[key].meshHash, key + ' original model/materials'); assert.deepEqual(actual[key].clips, expected[key].clips, key + ' original animations'); } }
async function waitRequests(f) { const end = Date.now() + 10000; while (!f.requests.length) { assert.ok(Date.now() < end, 'style import was requested'); await new Promise(resolve => setTimeout(resolve, 20)); } }

(async () => {
  await serviceWorkerCheck(); const browser = await launch(), report = {baseline, passed: false};
  try {
    const old = await fixture(browser, {legacy: true});
    try { report.original = await old.snapshot(); old.clean(); } finally { await old.close(); }
    const f = await fixture(browser);
    try {
      original(await f.snapshot(), report.original); assert.equal(f.requests.length, 0);
      for (const id of [null, 'none', 'evan-invalid', 'ben']) { await f.identity(id); original(await f.snapshot(), report.original); }
      assert.equal(f.requests.length, 0, 'other profiles never load owner kit module');
      await f.identity('evan'); await f.styled(); report.owner = await f.snapshot();
      assert.equal(f.requests.length, 1); assert.equal(report.owner.us.styled, true); assert.equal(report.owner.ghost.styled, true);
      assert.equal(report.owner.them.meshHash, report.original.them.meshHash, 'linebacker remains unchanged');
      assert.notEqual(report.owner.us.meshHash, report.original.us.meshHash);
      for (const key of ['us', 'them', 'ghost']) assert.deepEqual(report.owner[key].clips, report.original[key].clips, key + ' animations remain current');
      report.moves = await f.page.evaluate(() => window.playerCheck.moves());
      for (const sample of report.moves.samples) { assert.equal(sample.finite, true, sample.move + ' finite pose'); assert.equal(sample.ball, true); assert.ok(sample.ballDistance < .6, sample.move + ' keeps ball at hand'); }
      assert.ok(report.moves.ghostAlpha.every(m => m.transparent && m.opacity === .22 && !m.depthWrite));
      for (const view of ['game', 'rear', 'front', 'side']) await f.screenshot('owner-player-' + view, view);
      const observed = await f.page.evaluate(() => window.playerCheck.monitor()); assert.ok(observed.expectedGeometry > 0 && observed.expectedMaterial > 0);
      await f.identity('ben'); assert.deepEqual(await f.status(), {owner: false, styled: false, ghostStyled: false, originalRefs: true, ready: true});
      report.disposal = await f.page.evaluate(() => window.playerCheck.disposal());
      assert.equal(report.disposal.styleGeometry, report.disposal.expectedGeometry); assert.equal(report.disposal.styleMaterial, report.disposal.expectedMaterial);
      assert.equal(report.disposal.baseGeometry, 0); assert.equal(report.disposal.baseMaterial, 0);
      original(await f.snapshot(), report.original);
      await f.identity('evan'); await f.styled(); assert.equal(f.requests.length, 1, 'module is reused on switch back');
      const sibling = await f.context.newPage(); await sibling.goto(origin + '/__player_check__');
      await sibling.evaluate(() => localStorage.setItem('gg-me', 'none'));
      await f.page.waitForFunction(() => !window.playerCheck.status().owner);
      assert.equal((await f.status()).styled, false); original(await f.snapshot(), report.original); await sibling.close(); f.clean();
    } finally { await f.close(); }
    const race = await fixture(browser, {delay: true});
    try {
      await race.identity('evan'); await waitRequests(race); await race.identity('ben'); race.release();
      await race.page.evaluate(async () => { await import('/js/views/return-player-style.js'); await new Promise(resolve => requestAnimationFrame(resolve)); });
      assert.equal((await race.status()).styled, false); original(await race.snapshot(), report.original);
      await race.identity('evan'); await race.styled(); assert.equal(race.requests.length, 1); race.clean();
    } finally { await race.close(); }
    const failed = await fixture(browser, {fail: true});
    try {
      await failed.identity('evan'); await waitRequests(failed);
      await failed.page.evaluate(async () => { try { await import('/js/views/return-player-style.js'); } catch (_) {} });
      for (let i = 0; i < 5; i++) original(await failed.snapshot(), report.original);
      assert.equal(failed.requests.length, 1, 'failed import retains original kit without a request loop'); failed.clean();
    } finally { await failed.close(); }
    report.passed = true;
    console.log('PASS: owner-only real-model kit, unchanged animations/public model, moves, disposal, account races, failure fallback, and SW exclusion.');
  } finally { fs.writeFileSync(path.join(output, 'player-style-checks.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
