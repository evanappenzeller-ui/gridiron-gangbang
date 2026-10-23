#!/usr/bin/env node
// Browser regression for the shared v3 City bus pilot.
// Run: node tools/return/check-city-bus.cjs (no HTTP server required).
// Uses the real Three.js, account gate, and W3.update; no cloud requests or scores.
// Playwright fulfills the fixture origin directly from this checkout's files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function playwright() {
  try { return require('playwright'); } catch (_) {}
  const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  return require(process.env.PLAYWRIGHT_MODULE || bundled);
}
const {chromium} = playwright();
const origin = process.env.RETURN_BUS_TEST_ORIGIN || 'http://127.0.0.1:8765';
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/, 'The fixture origin must be local');
const appRoot = fs.realpathSync(path.resolve(__dirname, '../..'));
const output = process.env.RETURN_BUS_TEST_OUTPUT || path.resolve(__dirname, '../../../output/return-man/browser-qa');
const isAsset = url => /\/img\/return\/city\/bus-(rear|side|roof)-v1\.webp(\?|$)/.test(url);
const results = [];
fs.mkdirSync(output, {recursive: true});

const mime = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.html': 'text/html', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream'
};
function withinCheckout(file) {
  const relative = path.relative(appRoot, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
async function serveLocal(route, url) {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname);
    if (pathname.includes('\0')) throw new Error('Invalid path');
    const candidate = path.resolve(appRoot, '.' + pathname);
    if (!withinCheckout(candidate)) throw new Error('Path outside checkout');
    const file = fs.realpathSync(candidate);
    if (!withinCheckout(file) || !fs.statSync(file).isFile()) throw new Error('Invalid local file');
    return route.fulfill({status: 200, contentType: mime[path.extname(file).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(file)});
  } catch (error) {
    return route.fulfill({status: 404, contentType: 'text/plain', body: 'Fixture cannot serve ' + new URL(url).pathname + ': ' + error.message});
  }
}

async function launch() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const options = {headless: true, args: ['--enable-unsafe-swiftshader']};
  if (executablePath) return chromium.launch({...options, executablePath});
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await chromium.launch({...options, ...(channel ? {channel} : {})}); } catch (_) {}
  }
  throw new Error('No Chromium browser found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.');
}

async function fixture(browser, {identity = 'ben', theme = 'city', fail = false, delay = false} = {}) {
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
  const page = await context.newPage();
  const requests = [], external = [], errors = [], expectedErrors = [], failedRequests = [];
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin + '/')) {
      external.push(url);
      return route.abort('blockedbyclient');
    }
    if (new URL(url).pathname === '/__return_bus_test__') {
      return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Return Man bus check</title><link rel="icon" href="data:,"/><style>body{margin:0;background:#9dd7ef;color:#122941;font:16px sans-serif}p{position:absolute;top:0;left:16px;padding:9px;background:#ffffffd9}canvas{display:block}</style><p id="label"></p>'});
    }
    if (isAsset(url)) {
      requests.push(url);
      if (delay) await hold;
      if (fail && /bus-roof-v1\./.test(url)) return route.abort('failed');
    }
    return serveLocal(route, url);
  });
  page.on('requestfailed', request => failedRequests.push({url: request.url(), error: request.failure()?.errorText}));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    if (fail && /Failed to load resource/.test(msg.text())) expectedErrors.push(msg.text());
    else errors.push(msg.text());
  });
  await page.goto(origin + '/__return_bus_test__');
  await page.evaluate(async ({identity, theme}) => {
    const [T, D, R, W3] = await Promise.all([
      import('/js/vendor/three/three.module.min.js'), import('/js/core/data.js'),
      import('/js/core/return.js'), import('/js/views/return-3dworld.js')
    ]);
    await D.load();
    D.setMe(identity);
    const scene = new T.Scene();
    scene.background = new T.Color('#9dd7ef');
    scene.add(new T.HemisphereLight(0xdcebff, 0x6a6e74, 1.2));
    const sun = new T.DirectionalLight(0xfff4e2, 2.4);
    sun.position.set(-3, 6, 2); scene.add(sun);
    W3.init(T, scene, {});
    // Keep the production course shape but supply exact lengths at stable positions.
    const co = R.course(900001, 0);
    co.order = [R.THEMES.findIndex(t => t.id === theme)];
    co.rows = []; co.items = []; co.z = Infinity;
    co.sets = [{i: 0, zs: 16, ze: 50, plats: [12, 34].map((length, i) => ({lane: i * 2, kind: 'citybus', part: 0, z0: 16, z1: 16 + length, h: 3, b: 0, ramp: 0, hi: true}))}];
    const st = {co, camZ: 0, run: {co, z: 0, next: 0, nextItem: 0}, got: new Set(), knocked: new Map()};
    const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
    renderer.setSize(1280, 800); renderer.setPixelRatio(1);
    document.body.append(renderer.domElement);
    const camera = new T.PerspectiveCamera(54, 1280 / 800, .1, 400);
    camera.position.set(15, 12, 3); camera.lookAt(0, 1.6, -28);
    let time = 0;
    const hash = array => {
      let h = 2166136261;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (const byte of bytes) h = Math.imul(h ^ byte, 16777619);
      return h >>> 0;
    };
    const vehicles = () => {
      const found = [];
      scene.traverse(o => { if (o.userData.cityBus) found.push(o); });
      return found;
    };
    const fingerprint = group => {
      const meshes = [];
      group.traverse(o => {
        if (!o.isMesh) return;
        meshes.push({attributes: Object.fromEntries(Object.entries(o.geometry.attributes).map(([k, v]) => [k, hash(v.array)])),
          position: o.position.toArray(), rotation: o.rotation.toArray(),
          materials: (Array.isArray(o.material) ? o.material : [o.material]).map(m => ({type: m.type, color: m.color && m.color.getHex(), map: m.map ? (m.map.image?.src || 'canvas') : null}))});
      });
      return meshes;
    };
    const uvRange = (geometry, materialIndex) => {
      const uv = geometry.attributes.uv, index = geometry.index;
      const us = [], vs = [];
      for (const group of geometry.groups.filter(g => g.materialIndex === materialIndex)) {
        for (let i = group.start; i < group.start + group.count; i++) {
          const vertex = index ? index.getX(i) : i;
          us.push(uv.getX(vertex)); vs.push(uv.getY(vertex));
        }
      }
      return [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)];
    };
    window.busCheck = {
      frame() { W3.update(st, time += 16); },
      identity(id) { D.setMe(id); },
      render() { document.querySelector('#label').textContent = `${D.me() || 'Guest'} · ${theme} · 12 and 34 yard buses`; renderer.render(scene, camera); },
      inspect() {
        const buses = vehicles(), pilots = [];
        scene.traverse(o => {
          if (o.name !== 'city-bus-pilot-body') return;
          pilots.push({uv: [0, 1, 2].map(i => uvRange(o.geometry, i)),
            maps: o.material.slice(0, 3).map(m => ({id: m.map.uuid, width: m.map.image?.width, height: m.map.image?.height, wrapS: m.map.wrapS, wrapT: m.map.wrapT}))});
        });
        return {owner: D.isOwner(), buses: buses.length, painted: buses.filter(o => o.userData.cityBusPilot).length, pilots, fingerprints: buses.map(fingerprint)};
      }
    };
    for (let i = 0; i < 12; i++) window.busCheck.frame();
  }, {identity, theme}).catch(error => {
    error.message += '\nFixture diagnostics: ' + JSON.stringify({errors, failedRequests, external});
    throw error;
  });
  return {page, context, requests, external, errors, expectedErrors, release,
    async inspect() { return page.evaluate(() => { window.busCheck.frame(); return window.busCheck.inspect(); }); },
    async identity(id) { await page.evaluate(id => { window.busCheck.identity(id); window.busCheck.frame(); }, id); },
    async loaded() { await page.waitForFunction(() => { window.busCheck.frame(); return window.busCheck.inspect().pilots.length === 2; }); },
    async screenshot(name) { await page.evaluate(() => window.busCheck.render()); await page.screenshot({path: path.join(output, name + '.png')}); },
    async close() { release(); await context.close(); }
  };
}

function clean(f, label) {
  assert.deepEqual(f.external, [], label + ': no cloud requests');
  assert.deepEqual(f.errors, [], label + ': no browser errors');
}
function textureRequests(f, loads = 1) {
  assert.equal(f.requests.length, 3 * loads, 'one request per texture per shared load');
  assert.deepEqual(f.requests.map(u => /bus-(rear|side|roof)-v1\./.exec(u)[1]).sort(),
    Array.from({length: loads}, () => ['rear', 'roof', 'side']).flat().sort());
}

(async () => {
  const browser = await launch();
  try {
    const f = await fixture(browser);
    try {
      await f.loaded(); const baseline = await f.inspect();
      assert.equal(baseline.buses, 2); assert.equal(baseline.pilots.length, 2);
      textureRequests(f);
      await f.screenshot('city-bus-nonowner');
      await f.identity('evan'); await f.loaded();
      const owner = await f.inspect();
      assert.equal(owner.owner, true); assert.equal(owner.painted, 2); textureRequests(f);
      for (const [i, bus] of owner.pilots.entries()) {
        const length = [12, 34][i];
        assert.deepEqual(bus.uv[0], [1, 1], 'rear image must not repeat');
        assert.ok(Math.abs(bus.uv[1][0] - length / 3) < 1e-5, 'side has stable window density');
        assert.ok(Math.abs(bus.uv[2][1] - length / 2.5) < 1e-5, 'roof has stable panel density');
        assert.ok(bus.maps.every(m => m.width > 0 && m.height > 0), 'all three images decoded');
        assert.equal(bus.maps[1].wrapS, 1000, 'side texture repeats');
        assert.equal(bus.maps[2].wrapT, 1000, 'roof texture repeats');
      }
      assert.deepEqual(owner.pilots[0].maps.map(m => m.id), owner.pilots[1].maps.map(m => m.id), 'buses share texture memory');
      await f.screenshot('city-bus-owner');
      for (const id of ['ben', 'none', 'evan-invalid', null]) {
        const immediate = await f.page.evaluate(id => { window.busCheck.identity(id); return window.busCheck.inspect(); }, id);
        assert.equal(immediate.pilots.length, 2, 'shared art persists across profile changes');
        const state = await f.inspect();
        assert.equal(state.owner, false); assert.equal(state.pilots.length, 2);
        assert.deepEqual(state.fingerprints, baseline.fingerprints, 'all profiles share the redesigned geometry and materials');
      }
      await f.identity('evan'); await f.loaded(); textureRequests(f);
      clean(f, 'owner transitions');
      results.push('All-profile loading, decoded images, shared textures, UV density, and account transitions passed.');
    } finally { await f.close(); }

    const nonCity = await fixture(browser, {identity: 'evan', theme: 'stadium'});
    try {
      assert.equal((await nonCity.inspect()).pilots.length, 0);
      assert.equal(nonCity.requests.length, 0, 'non-City areas must not fetch City bus art');
      clean(nonCity, 'non-City'); results.push('Non-City rendering remains unaffected.');
    } finally { await nonCity.close(); }

    const failure = await fixture(browser, {fail: true});
    try {
      const before = await failure.inspect(); await failure.identity('evan');
      await failure.page.waitForLoadState('networkidle');
      await failure.page.evaluate(() => { for (let i = 0; i < 60; i++) window.busCheck.frame(); });
      const after = await failure.inspect(); textureRequests(failure);
      assert.equal(after.pilots.length, 0, 'failed texture must retain legacy bus');
      assert.deepEqual(after.fingerprints, before.fingerprints, 'failure retains original complete bus');
      clean(failure, 'failure fallback'); results.push('Missing roof texture retains the complete original bus.');
    } finally { await failure.close(); }

    const race = await fixture(browser, {delay: true});
    try {
      const baseline = await race.inspect(); await race.identity('evan');
      // Requests are intentionally held before a response. Wait on the server-side
      // route observation, not a timeout that could let this race pass untested.
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 10000;
        const poll = () => race.requests.length === 3 ? resolve() : Date.now() > deadline ? reject(new Error('Texture requests were not started')) : setTimeout(poll, 20);
        poll();
      });
      await race.identity('ben'); race.release();
      await race.page.waitForLoadState('networkidle');
      await race.loaded(); const after = await race.inspect();
      assert.equal(after.pilots.length, 2, 'shared textures finish loading across profile changes');
      assert.equal(after.owner, false); assert.equal(after.buses, baseline.buses);
      await race.identity('evan'); await race.loaded(); textureRequests(race);
      clean(race, 'async account transition'); results.push('Shared art survives account changes during loading without duplicate downloads.');
    } finally { await race.close(); }
    fs.writeFileSync(path.join(output, 'city-bus-checks.json'), JSON.stringify({passed: true, origin, results}, null, 2) + '\n');
    console.log(results.join('\n')); console.log('Screenshots and report: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
