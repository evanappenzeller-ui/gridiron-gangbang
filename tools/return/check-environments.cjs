#!/usr/bin/env node
// Owner-only environment regression and screenshot capture. No server required.
// Run: node tools/return/check-environments.cjs
// Baseline modules/assets come from git 337203c; current files come from this checkout.
// Every request is fulfilled locally or blocked. The app boot/score posting never runs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = fs.realpathSync(path.resolve(__dirname, '../..'));
const output = process.env.RETURN_ENV_TEST_OUTPUT || path.resolve(root, '../output/return-man/environment-qa');
const origin = 'http://127.0.0.1:8765';
const baselineRef = process.env.RETURN_ENV_BASELINE || '337203c';
const baseline = execFileSync('git', ['rev-parse', '--verify', `${baselineRef}^{commit}`], {cwd: root, encoding: 'utf8'}).trim();
const themes = ['stadium', 'tailgate', 'city', 'tundra', 'desert', 'market', 'beach', 'space', 'farm'];
const sourceCache = new Map();
fs.mkdirSync(output, {recursive: true});

function playwright() {
  try { return require('playwright'); } catch (_) {}
  return require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const {chromium} = playwright();
const mime = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html',
  '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary'};
function contained(file) {
  const rel = path.relative(root, file);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function source(url, legacy) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  if (pathname.includes('\0')) throw new Error('Invalid path');
  const candidate = path.resolve(root, '.' + pathname);
  if (!contained(candidate)) throw new Error('Path outside checkout');
  const relative = path.relative(root, candidate).split(path.sep).join('/');
  const key = `${legacy ? baseline : 'working'}:${relative}`;
  if (!sourceCache.has(key)) {
    if (legacy) sourceCache.set(key, execFileSync('git', ['show', `${baseline}:${relative}`], {cwd: root, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}));
    else {
      const real = fs.realpathSync(candidate);
      if (!contained(real) || !fs.statSync(real).isFile()) throw new Error('Invalid local file');
      sourceCache.set(key, fs.readFileSync(real));
    }
  }
  return {body: sourceCache.get(key), contentType: mime[path.extname(candidate)] || 'application/octet-stream'};
}
async function launch() {
  const options = {headless: true, args: ['--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas']};
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) return chromium.launch({...options, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await chromium.launch({...options, ...(channel ? {channel} : {})}); } catch (_) {}
  }
  throw new Error('No Chromium browser found; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.');
}

async function fixture(browser, legacy = false) {
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
  await context.addInitScript(() => { performance.now = () => 1234; }); // Match explicit render time, including legacy blinking lamps.
  const page = await context.newPage(), errors = [], external = [], failed = [], imageRequests = [];
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin + '/')) { external.push(url); return route.abort('blockedbyclient'); }
    if (new URL(url).pathname === '/__environment_check__') return route.fulfill({contentType: 'text/html', body:
      '<!doctype html><title>Return Man environment check</title><link rel="icon" href="data:,"><style>body{margin:0;background:#000}canvas{position:absolute;inset:0;width:1280px;height:800px}p{position:absolute;z-index:3;left:16px;top:0;margin:12px 0;padding:9px 14px;border-radius:8px;background:#ffffffe8;color:#18344c;font:16px sans-serif}</style><p id="label"></p>'});
    if (/\.(png|webp|jpe?g)(\?|$)/.test(url)) imageRequests.push(url);
    try { return await route.fulfill({status: 200, ...source(url, legacy)}); }
    catch (error) { errors.push(`Serving ${url}: ${error.message}`); return route.fulfill({status: 404, body: 'Missing fixture source'}); }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failed.push({url: request.url(), error: request.failure()?.errorText}));
  await page.goto(origin + '/__environment_check__');
  await page.evaluate(async legacy => {
    const [T, D, R, W3, W] = await Promise.all([import('/js/vendor/three/three.module.min.js'), import('/js/core/data.js'),
      import('/js/core/return.js'), import('/js/views/return-3dworld.js'), import('/js/views/return-world.js')]);
    const style = legacy ? null : await import('/js/views/return-style.js');
    await D.load(); D.setMe('ben');
    const scene = new T.Scene(), hemi = new T.HemisphereLight(), sun = new T.DirectionalLight();
    scene.add(hemi, sun, sun.target); scene.fog = new T.Fog(0x8899aa, 70, 150);
    W3.init(T, scene, {});
    const sky = document.createElement('canvas'); sky.width = 1280; sky.height = 800; document.body.append(sky);
    const skyContext = sky.getContext('2d');
    const renderer = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.setSize(1280, 800); renderer.setPixelRatio(1); document.body.append(renderer.domElement);
    const camera = new T.PerspectiveCamera();
    const st = {W: 1280, H: 800, dpr: 1, f: 1280 * 1.05, y0: 256, camX: 0, camZ: 0, camH: 4.4,
      camH0: 4.4, back: 7, bend: W.BEND, t: 1.234, cheer: 0, got: new Set(), knocked: new Map()};
    camera.position.set(st.camX, st.camH, -st.camZ);
    camera.projectionMatrix.makePerspective(-st.W / 2 / st.f * .1, st.W / 2 / st.f * .1, st.y0 / st.f * .1, -(st.H - st.y0) / st.f * .1, .1, 400);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const fallback = document.createElement('canvas'); fallback.width = st.W; fallback.height = st.H;
    const fallbackContext = fallback.getContext('2d', {willReadFrequently: true});
    const composite = document.createElement('canvas'); composite.width = st.W; composite.height = st.H;
    const compositeContext = composite.getContext('2d', {willReadFrequently: true});
    const textureHashes = new WeakMap();
    let theme;
    const bytesHash = bytes => { let h = 2166136261; for (const b of bytes) h = Math.imul(h ^ b, 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
    const arrayHash = array => bytesHash(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    const sha = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
    function texture(t) {
      if (!t) return null;
      if (!textureHashes.has(t)) {
        const image = t.image;
        let pixels = null, signature = null;
        if (image?.width && image?.height) {
          const cv = document.createElement('canvas'); cv.width = image.width; cv.height = image.height;
          const ctx = cv.getContext('2d', {willReadFrequently: true}); ctx.drawImage(image, 0, 0);
          const rgba = ctx.getImageData(0, 0, cv.width, cv.height).data;
          pixels = bytesHash(rgba);
          // Large canvas text can vary at antialiased edge pixels across GPU contexts.
          // Compare every pixel through 16x16 tile means, quantized to 2/255; retain
          // the raw hash for diagnostics. Geometry/material settings stay exact.
          const totals = new Float64Array(16 * 16 * 4), counts = new Uint32Array(16 * 16);
          for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
            const tile = Math.floor(y * 16 / cv.height) * 16 + Math.floor(x * 16 / cv.width), from = (y * cv.width + x) * 4;
            counts[tile]++;
            for (let k = 0; k < 4; k++) totals[tile * 4 + k] += rgba[from + k];
          }
          signature = bytesHash(Uint8Array.from(totals, (v, i) => Math.round(v / Math.max(1, counts[i >> 2]) / 2)));
        }
        textureHashes.set(t, {width: image?.width, height: image?.height, pixels, signature});
      }
      return {...textureHashes.get(t), wrapS: t.wrapS, wrapT: t.wrapT, mag: t.magFilter, min: t.minFilter, anisotropy: t.anisotropy,
        colorSpace: t.colorSpace, flipY: t.flipY, repeat: t.repeat.toArray(), offset: t.offset.toArray()};
    }
    function material(m) {
      return {type: m.type, color: m.color?.getHex(), emissive: m.emissive?.getHex(), roughness: m.roughness, metalness: m.metalness,
        opacity: m.opacity, transparent: m.transparent, side: m.side, depthWrite: m.depthWrite, vertexColors: m.vertexColors,
        toneMapped: m.toneMapped, map: texture(m.map), alphaMap: texture(m.alphaMap)};
    }
    function metrics(context) {
      const rgba = context.getImageData(0, 0, st.W, st.H).data, buckets = new Set();
      const tileSums = new Float64Array(32 * 32 * 3), tileCounts = new Uint32Array(32 * 32);
      let opaque = 0, r = 0, g = 0, b = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; if (rgba[i + 3] > 0) opaque++;
        if (i % 64 === 0) buckets.add((rgba[i] >> 4) * 256 + (rgba[i + 1] >> 4) * 16 + (rgba[i + 2] >> 4));
        const pixel = i / 4, tile = Math.floor(Math.floor(pixel / st.W) * 32 / st.H) * 32 + Math.floor((pixel % st.W) * 32 / st.W);
        tileCounts[tile]++;
        for (let k = 0; k < 3; k++) tileSums[tile * 3 + k] += rgba[i + k];
      }
      const count = st.W * st.H;
      return {hash: bytesHash(rgba), coverage: opaque / count, colorBuckets: buckets.size, meanRGB: [r / count, g / count, b / count].map(n => +n.toFixed(2)),
        tiles: Array.from(tileSums, (v, i) => +(v / tileCounts[Math.floor(i / 3)]).toFixed(4))};
    }
    function drawFallback() {
      const flat = {...st, bend: 0};
      fallbackContext.reset(); // Each comparison starts with identical canvas drawing state.
      W.sky(flat, fallbackContext, st.t, st.run.z); W.ground(flat, fallbackContext); W.sides(flat, fallbackContext);
      for (const set of st.co.sets) for (const p of set.plats) W.vehicle(flat, fallbackContext, p);
      for (const row of st.co.rows) row.lanes.forEach((type, lane) => { if (type) W.obstacle(flat, fallbackContext, type, lane, row.z); });
      for (const item of st.co.items) W.item(flat, fallbackContext, item, st.t);
      W.gate(flat, fallbackContext, 100, theme, st.t); W.weather(flat, fallbackContext, st.t, st.run.z);
    }
    function frame() { for (let i = 0; i < 14; i++) W3.update(st, 1234); }
    function render() {
      frame(); W3.BEND_U.value = st.bend;
      const light = W3.look(st, st.run.z);
      hemi.color.copy(light.sky); hemi.groundColor.copy(light.ground); hemi.intensity = light.hemi;
      sun.color.copy(light.sun); sun.intensity = light.sunI;
      sun.target.position.set(0, 0, -11); sun.position.set(light.at[0] * 6, light.at[1] * 6, -11 + light.at[2] * 6);
      sun.target.updateMatrixWorld(); scene.fog.color.copy(light.haze);
      skyContext.clearRect(0, 0, st.W, st.H);
      const skyView = {...st, y0: W.horizonOf(st)};
      if (!style?.sky(skyView, skyContext, st.t, st.run.z)) W.sky(skyView, skyContext, st.t, st.run.z);
      renderer.render(scene, camera);
      compositeContext.clearRect(0, 0, st.W, st.H); compositeContext.drawImage(sky, 0, 0); compositeContext.drawImage(renderer.domElement, 0, 0);
      document.querySelector('#label').textContent = `${theme.name} · ${D.me() === 'evan' ? 'Evan' : D.me() || 'Signed out'} · environment check`;
      drawFallback();
    }
    window.environmentCheck = {
      identity(id) { D.setMe(id); },
      ready() {
        frame();
        return !D.isOwner() || theme.id !== 'city' || !!scene.getObjectByName('city-bus-pilot-body');
      },
      status() {
        let visibleMeshes = 0;
        scene.getObjectByName('world').traverseVisible(o => { if (o.isMesh || o.isSprite) visibleMeshes++; });
        return {owner: D.isOwner(), visibleMeshes};
      },
      prepare(id) {
        const index = R.THEMES.findIndex(t => t.id === id); theme = R.THEMES[index];
        const co = R.course(920000 + index, 0); co.order = [index]; co.z = Infinity;
        co.rows = [{i: 0, z: 34, lanes: [null, 'hurdle', null]}, {i: 1, z: 53, lanes: [null, null, 'bar']}];
        const kind = theme.kinds[0][0];
        const plats = R.KINDS[kind].build(() => .45, .3, 1).map((p, part) => ({lane: 0, kind, part, z0: 20 + p.at, z1: 20 + p.at + p.len, h: p.h, b: p.b || 0, ramp: p.ramp || 0, hi: p.h >= 2}));
        co.sets = [{i: 0, zs: 20, ze: Math.max(...plats.map(p => p.z1)), plats}];
        co.items = ['salts', 'pills', 'booze'].map((kind, i) => ({i, kind, z: 18 + i * 16, lane: 1}));
        st.co = co; st.run = {co, z: 7, x: 0, next: 0, nextItem: 0}; frame();
      },
      async snapshot() {
        render(); const records = [], geometryRecords = [], materialRecords = [], diagnosticMaterials = [], problems = []; let meshes = 0, vertices = 0;
        scene.getObjectByName('world').traverse(o => {
          if (!o.isMesh && !o.isSprite) return;
          meshes++;
          const attributes = {};
          for (const [name, value] of Object.entries(o.geometry?.attributes || {})) {
            attributes[name] = {count: value.count, size: value.itemSize, hash: arrayHash(value.array)};
            if (name === 'position') { vertices += value.count; if (!value.array.every(Number.isFinite)) problems.push('Non-finite position in ' + o.name); }
          }
          const geometry = {type: o.type, attributes, index: o.geometry?.index ? arrayHash(o.geometry.index.array) : null,
            groups: o.geometry?.groups, matrix: o.matrixWorld.toArray(), visible: o.visible, castShadow: o.castShadow, receiveShadow: o.receiveShadow};
          const materials = (Array.isArray(o.material) ? o.material : [o.material]).map(material);
          const stableMaterials = JSON.parse(JSON.stringify(materials, (key, value) => key === 'pixels' ? undefined : value));
          records.push(JSON.stringify({...geometry, materials: stableMaterials}));
          geometryRecords.push(JSON.stringify(geometry)); materialRecords.push(JSON.stringify(stableMaterials));
          diagnosticMaterials.push(JSON.stringify(materials));
        });
        const light = W3.look(st, st.run.z);
        return {theme: theme.id, owner: D.isOwner(), cityPilot: !!scene.getObjectByName('city-bus-pilot-body'), sceneHash: await sha(JSON.stringify(records.sort())),
          geometryHash: await sha(JSON.stringify(geometryRecords.sort())), materialHash: await sha(JSON.stringify(materialRecords.sort())), meshes, vertices, problems,
          materials: [...new Set(diagnosticMaterials)].sort().map(record => JSON.parse(record)),
          light: {...light, sky: light.sky.getHex(), ground: light.ground.getHex(), sun: light.sun.getHex(), haze: light.haze.getHex()},
          pixels: metrics(compositeContext), fallback: metrics(fallbackContext), drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles, memory: {...renderer.info.memory}};
      },
      fallbackImage() { return fallback.toDataURL('image/png'); }
    };
  }, legacy).catch(error => { error.message += '\nFixture diagnostics: ' + JSON.stringify({legacy, errors, failed, external}); throw error; });
  return {page, context, errors, failed, external, imageRequests,
    async identity(id) { await page.evaluate(id => window.environmentCheck.identity(id), id); },
    async snapshot(theme) {
      await page.evaluate(theme => window.environmentCheck.prepare(theme), theme);
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => window.environmentCheck.ready());
      return page.evaluate(() => window.environmentCheck.snapshot());
    },
    async screenshot(theme) { await page.screenshot({path: path.join(output, `owner-${theme}.png`)}); },
    clean(label) { assert.deepEqual({errors, failed, external}, {errors: [], failed: [], external: []}, label + ': browser/network errors'); },
    close() { return context.close(); }
  };
}

function rendered(snapshot, label) {
  assert.deepEqual(snapshot.problems, [], label + ': valid vertices');
  assert.ok(snapshot.meshes > 10 && snapshot.vertices > 100, label + ': world populated');
  assert.ok(snapshot.pixels.coverage > .95 && snapshot.pixels.colorBuckets > 20, label + ': visible 3D scene');
  assert.ok(snapshot.fallback.coverage > .95 && snapshot.fallback.colorBuckets > 20, label + ': visible 2D fallback');
}
function unchanged(actual, expected, label) {
  assert.equal(actual.sceneHash, expected.sceneHash, label + ': original geometry/materials');
  assert.deepEqual(actual.light, expected.light, label + ': original lighting');
  actual.rasterDelta = {};
  for (const kind of ['pixels', 'fallback']) {
    // SwiftShader/canvas edge rounding can change individual bytes between contexts.
    // Every RGB channel in every 40x25 pixel tile must average within 0.1/255.
    const a = actual[kind], b = expected[kind];
    const delta = Math.max(...a.tiles.map((v, i) => Math.abs(v - b.tiles[i])));
    actual.rasterDelta[kind] = +delta.toFixed(4);
    assert.equal(a.coverage, b.coverage, label + ': original ' + kind + ' coverage');
    assert.ok(delta <= .1, label + ': original ' + kind + ' tile means (max RGB delta ' + delta.toFixed(4) + '/255)');
  }
}

(async () => {
  const browser = await launch(), report = {baseline, themes: {}, failures: [], passed: false};
  const compare = (actual, expected, label) => { try { unchanged(actual, expected, label); } catch (error) { report.failures.push(error.message); } };
  try {
    const legacy = await fixture(browser, true);
    try {
      for (const theme of themes) { const s = await legacy.snapshot(theme); rendered(s, 'baseline ' + theme); report.themes[theme] = {baseline: s}; }
      legacy.clean('baseline');
    } finally { await legacy.close(); }
    const current = await fixture(browser);
    try {
      for (const theme of themes) {
        const s = await current.snapshot(theme); report.themes[theme].public = s;
        compare(s, report.themes[theme].baseline, 'nonowner ' + theme);
      }
      assert.equal(current.imageRequests.length, 0, 'public profiles do not request owner art');
      await current.identity('evan');
      for (const theme of themes) {
        const s = await current.snapshot(theme); rendered(s, 'owner ' + theme);
        assert.equal(s.owner, true); assert.notEqual(s.sceneHash, report.themes[theme].baseline.sceneHash, theme + ': owner redesign is present');
        report.themes[theme].owner = s; await current.screenshot(theme);
        console.log(`Owner ${theme}: ${s.drawCalls} draws, ${s.triangles} triangles, ${s.meshes} meshes`);
      }
      const fallback = await current.page.evaluate(() => window.environmentCheck.fallbackImage());
      fs.writeFileSync(path.join(output, 'owner-farm-2d.png'), Buffer.from(fallback.split(',')[1], 'base64'));
      for (const [identity, label] of [['ben', 'restored'], [null, 'signedOut']]) {
        await current.identity(identity);
        if (label === 'restored') {
          const hidden = await current.page.evaluate(() => window.environmentCheck.status());
          assert.deepEqual(hidden, {owner: false, visibleMeshes: 0}, 'hidden world revokes owner art before another frame');
        }
        for (const theme of themes) {
          const s = await current.snapshot(theme); assert.equal(s.owner, false);
          report.themes[theme][label] = s; compare(s, report.themes[theme].baseline, label + ' ' + theme);
        }
      }
      await current.identity('evan'); await current.snapshot('city');
      const sibling = await current.context.newPage();
      try {
        await sibling.goto(origin + '/__environment_check__');
        await sibling.evaluate(() => localStorage.setItem('gg-me', 'ben'));
        await current.page.waitForFunction(() => !window.environmentCheck.status().owner);
        assert.deepEqual(await current.page.evaluate(() => window.environmentCheck.status()), {owner: false, visibleMeshes: 0},
          'cross-tab account switch revokes hidden owner world immediately');
        report.crossTab = await current.snapshot('city');
        compare(report.crossTab, report.themes.city.baseline, 'cross-tab restoration');
      } finally { await sibling.close(); }
      current.clean('current'); assert.equal(report.failures.length, 0, report.failures.join('\n')); report.passed = true;
    } finally { await current.close(); }
  } finally {
    fs.writeFileSync(path.join(output, 'environment-checks.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
  console.log('All nine owner scenes, public/signed-out baselines, role restoration, and 2D fallbacks passed.');
  console.log('Screenshots and metrics: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; });
