#!/usr/bin/env node
// Exercise the real power-up renderers without app boot, network, or score posting.
// Run: node tools/return/check-powerups.cjs
// Public/guest/unselected profiles are compared with pre-redesign commit fb3dd1b.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = fs.realpathSync(path.resolve(__dirname, '../..'));
const output = process.env.RETURN_POWERUPS_TEST_OUTPUT || path.resolve(root, '../output/return-man/powerups-qa');
const baseline = execFileSync('git', ['rev-parse', '--verify', `${process.env.RETURN_POWERUPS_BASELINE || 'fb3dd1b'}^{commit}`], {cwd: root, encoding: 'utf8'}).trim();
const origin = 'http://127.0.0.1:8765', sourceCache = new Map();
const kinds = ['booze', 'pills', 'salts'];
fs.mkdirSync(output, {recursive: true});
let playwright;
try { playwright = require('playwright'); }
catch (_) { playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary'};
function contained(file) {
  const rel = path.relative(root, file);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function source(url, legacy) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  if (pathname.includes('\0')) throw new Error('Invalid path');
  const file = path.resolve(root, '.' + pathname);
  if (!contained(file)) throw new Error('Path outside checkout');
  const relative = path.relative(root, file).split(path.sep).join('/');
  const key = `${legacy ? baseline : 'working'}:${relative}`;
  if (!sourceCache.has(key)) {
    if (legacy) sourceCache.set(key, execFileSync('git', ['show', `${baseline}:${relative}`], {cwd: root, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}));
    else {
      const real = fs.realpathSync(file);
      if (!contained(real) || !fs.statSync(real).isFile()) throw new Error('Invalid local source');
      sourceCache.set(key, fs.readFileSync(real));
    }
  }
  return {body: sourceCache.get(key), contentType: mime[path.extname(file)] || 'application/octet-stream'};
}
async function launch() {
  const options = {headless: true, args: ['--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas']};
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) return playwright.chromium.launch({...options, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await playwright.chromium.launch({...options, ...(channel ? {channel} : {})}); } catch (_) {}
  }
  throw new Error('No Chromium browser found; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.');
}
async function fixture(browser, legacy = false) {
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
  await context.addInitScript(() => { performance.now = () => 1234; });
  const page = await context.newPage(), errors = [], external = [], failed = [];
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin + '/')) { external.push(url); return route.abort('blockedbyclient'); }
    if (new URL(url).pathname === '/__powerups_check__') return route.fulfill({contentType: 'text/html', body:
      '<!doctype html><title>Return Man power-ups</title><link rel="icon" href="data:,"><style>body{margin:0;background:#0a1420;color:#f4f1e9;font-family:Arial,sans-serif}canvas{position:absolute;inset:0;width:1280px;height:800px}#copy{position:absolute;inset:0;pointer-events:none}h1{font-size:32px;letter-spacing:1px;margin:44px 50px 10px}p{margin:0 50px;color:#9cacbf;font-size:16px}.captions{position:absolute;left:0;right:0;bottom:65px;display:flex;text-align:center}.captions div{width:33.333%;font-size:23px;font-weight:700}.captions small{display:block;margin-top:10px;color:#91a4ba;font-size:14px;font-weight:400}</style><div id="copy"><h1>RETURN MAN / POWER-UPS</h1><p>Floating arcade pickups</p><div class="captions"><div>BOOZE<small>Beer bottle</small></div><div>PAINKILLER<small>Prescription bottle</small></div><div>SMELLING SALTS<small>Sideline packet</small></div></div></div>'});
    try { return await route.fulfill({status: 200, ...source(url, legacy)}); }
    catch (error) { errors.push(`Serving ${url}: ${error.message}`); return route.fulfill({status: 404, body: 'Missing local source'}); }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failed.push({url: request.url(), error: request.failure()?.errorText}));
  await page.goto(origin + '/__powerups_check__');
  await page.evaluate(async () => {
    const [T, D, R, W3, W, style] = await Promise.all([import('/js/vendor/three/three.module.min.js'), import('/js/core/data.js'),
      import('/js/core/return.js'), import('/js/views/return-3dworld.js'), import('/js/views/return-world.js'), import('/js/views/return-style.js')]);
    await D.load(); D.setMe('ben');
    const kinds = ['booze', 'pills', 'salts'];
    const scene = new T.Scene(), hemi = new T.HemisphereLight(0xe1f0ff, 0x46351e, 2), sun = new T.DirectionalLight(0xffe8c2, 2);
    sun.position.set(-3, 7, 6); scene.add(hemi, sun, sun.target); scene.fog = new T.Fog(0x8899aa, 70, 150);
    W3.init(T, scene, {});
    const sky = document.createElement('canvas'); sky.width = 1280; sky.height = 800; document.body.prepend(sky);
    const skyContext = sky.getContext('2d');
    const renderer = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.setSize(1280, 800); renderer.setPixelRatio(1); document.body.insertBefore(renderer.domElement, document.querySelector('#copy'));
    const camera = new T.PerspectiveCamera();
    const st = {W: 1280, H: 800, dpr: 1, f: 1280 * 1.05, y0: 256, camX: 0, camZ: 0, camH: 4.4,
      camH0: 4.4, back: 7, bend: W.BEND, t: 1.234, cheer: 0, got: new Set(), knocked: new Map()};
    camera.position.set(st.camX, st.camH, -st.camZ);
    camera.projectionMatrix.makePerspective(-st.W / 2 / st.f * .1, st.W / 2 / st.f * .1, st.y0 / st.f * .1, -(st.H - st.y0) / st.f * .1, .1, 400);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const icon = document.createElement('canvas'); icon.width = 512; icon.height = 512;
    const iconContext = icon.getContext('2d', {willReadFrequently: true});
    const fallback = document.createElement('canvas'); fallback.width = 1280; fallback.height = 800;
    const fallbackContext = fallback.getContext('2d', {willReadFrequently: true});
    const hashBytes = bytes => { let h = 2166136261; for (const b of bytes) h = Math.imul(h ^ b, 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
    const hashArray = array => hashBytes(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    const sha = async object => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(object)))), b => b.toString(16).padStart(2, '0')).join('');
    function canvasMetric(ctx) {
      const w = ctx.canvas.width, h = ctx.canvas.height, rgba = ctx.getImageData(0, 0, w, h).data;
      let count = 0, minX = w, minY = h, maxX = -1, maxY = -1;
      for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] > 8) {
        count++; const x = (i / 4) % w, y = Math.floor(i / 4 / w);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      return {hash: hashBytes(rgba), count, bounds: [minX, minY, maxX, maxY]};
    }
    const textures = new WeakMap();
    function texture(tex) {
      if (!tex) return null;
      if (!textures.has(tex)) {
        const image = tex.image, cv = document.createElement('canvas'); cv.width = image?.width || 1; cv.height = image?.height || 1;
        const ctx = cv.getContext('2d', {willReadFrequently: true}); if (image?.width) ctx.drawImage(image, 0, 0);
        textures.set(tex, {width: image?.width, height: image?.height, hash: hashBytes(ctx.getImageData(0, 0, cv.width, cv.height).data)});
      }
      return {...textures.get(tex), wrapS: tex.wrapS, wrapT: tex.wrapT, mag: tex.magFilter, min: tex.minFilter, space: tex.colorSpace,
        flipY: tex.flipY, repeat: tex.repeat.toArray(), offset: tex.offset.toArray()};
    }
    function material(m) {
      return {type: m.type, color: m.color?.getHex(), emissive: m.emissive?.getHex(), roughness: m.roughness, metalness: m.metalness,
        opacity: m.opacity, transparent: m.transparent, side: m.side, depthWrite: m.depthWrite, depthTest: m.depthTest,
        vertexColors: m.vertexColors, toneMapped: m.toneMapped, blending: m.blending, map: texture(m.map), alphaMap: texture(m.alphaMap)};
    }
    function roots() {
      return st.co.items.map(it => scene.getObjectByName('world').children.find(o =>
        Math.abs(o.position.x - R.xOf(null, it.lane)) < .0001 && Math.abs(o.position.z + it.z) < .0001));
    }
    function frame(now = 1234) { st.t = now / 1000; for (let i = 0; i < 12; i++) W3.update(st, now); scene.updateMatrixWorld(true); }
    function prepare({hard = false, roof = false} = {}) {
      const co = R.course(960001, 0, hard); co.order = [0]; co.z = Infinity; co.done = Infinity; co.rows = []; co.sets = [];
      co.items = kinds.map((kind, i) => ({i, kind, lane: i, z: 14}));
      if (roof) co.sets = [{i: 0, zs: 9, ze: 23, plats: kinds.map((_, lane) => ({lane, kind: 'teambus', part: 0, z0: 9, z1: 23, h: 2.5, b: 0, ramp: 0, hi: true}))}];
      st.co = co; st.got = new Set(); st.run = {co, z: 7, x: 0, next: 0, nextItem: 0}; frame();
    }
    async function snapshot() {
      frame(); const items = {};
      for (const [i, obj] of roots().entries()) {
        if (!obj) throw new Error('Missing pickup ' + kinds[i]);
        const records = [], problems = []; let vertices = 0, meshCount = 0, maps = 0;
        obj.traverse(o => {
          if (![...o.position.toArray(), ...o.scale.toArray(), ...o.quaternion.toArray(), ...o.matrixWorld.toArray()].every(Number.isFinite)) problems.push('nonfinite transform');
          if (!o.isMesh && !o.isSprite) return; meshCount++;
          const attributes = {};
          for (const [name, a] of Object.entries(o.geometry?.attributes || {})) {
            attributes[name] = {size: a.itemSize, count: a.count, hash: hashArray(a.array)};
            if (!a.array.every(Number.isFinite)) problems.push('nonfinite ' + name);
            if (name === 'position') vertices += a.count;
          }
          const materials = (Array.isArray(o.material) ? o.material : [o.material]).map(material); maps += materials.filter(m => m.map).length;
          records.push({type: o.type, name: o.name, attributes, index: o.geometry?.index ? hashArray(o.geometry.index.array) : null,
            matrix: o.matrixWorld.toArray(), visible: o.visible, castShadow: o.castShadow, receiveShadow: o.receiveShadow, materials});
        });
        const body = obj.children[0], box = new T.Box3().setFromObject(body), size = box.getSize(new T.Vector3());
        iconContext.reset(); iconContext.translate(256, 256); iconContext.scale(180, 180); W.ICONS[kinds[i]](iconContext, st.t);
        fallbackContext.reset(); W.item({...st, bend: 0}, fallbackContext, st.co.items[i], st.t);
        items[kinds[i]] = {hash: await sha(records), meshCount, vertices, maps, problems, visible: obj.visible,
          ground: R.groundAt(st.co, i, 14), root: obj.position.toArray(), bodyBounds: [box.min.toArray(), box.max.toArray()], bodySize: size.toArray(),
          icon: canvasMetric(iconContext), fallback: canvasMetric(fallbackContext)};
      }
      return {owner: D.isOwner(), hard: !!st.co.hard, items};
    }
    function hiddenStatus() {
      const world = scene.getObjectByName('world'); let visibleMeshes = 0;
      world.traverseVisible(o => { if (o.isMesh || o.isSprite) visibleMeshes++; });
      return {owner: D.isOwner(), pickupRoots: roots().filter(Boolean).length, visibleMeshes};
    }
    function motion() {
      const samples = [];
      for (const t of [0, .25, 1, 2, 3, 5, 10, 17]) {
        frame(t * 1000);
        samples.push({t, items: roots().map((o, i) => {
          const body = o.children[0], box = new T.Box3().setFromObject(body);
          const forward = new T.Vector3(0, 0, 1).applyQuaternion(body.getWorldQuaternion(new T.Quaternion()));
          const towardCamera = camera.position.clone().sub(body.getWorldPosition(new T.Vector3())); towardCamera.y = 0; towardCamera.normalize();
          return {kind: kinds[i], minY: box.min.y, maxY: box.max.y, ground: o.position.y, facing: forward.dot(towardCamera), center: box.getCenter(new T.Vector3()).toArray()};
        })});
      }
      frame(); return samples;
    }
    function collect() { st.got = new Set([0, 1, 2]); frame(); return roots().map(o => o.visible); }
    function renderBoard() {
      prepare(); frame(); const board = new T.Scene(); board.background = new T.Color('#0a1420');
      const boardHemi = new T.HemisphereLight(0xeaf5ff, 0x584225, 2.1), key = new T.DirectionalLight(0xfff0d4, 2.4);
      key.position.set(-4, 7, 8); board.add(boardHemi, key);
      roots().forEach((o, i) => { const clone = o.clone(); clone.position.set((i - 1) * 3.8, 0, 0); clone.children[0].rotation.y = -.12; board.add(clone); });
      const cam = new T.OrthographicCamera(-5.7, 5.7, 3.5625, -3.5625, .1, 100); cam.position.set(0, 3.6, 14); cam.lookAt(0, 1.5, 0);
      W3.BEND_U.value = 0; renderer.render(board, cam); document.querySelector('#copy').style.display = ''; skyContext.clearRect(0, 0, 1280, 800);
    }
    function renderGame(mobile = false) {
      st.W = mobile ? 390 : 1280; st.H = mobile ? 700 : 800; st.f = st.W * 1.05; st.y0 = st.H * .32;
      st.camH0 = st.camH = mobile ? (st.H - Math.max(96, st.H * .19) - st.y0) * st.back / st.f : 4.4;
      camera.position.set(st.camX, st.camH, -st.camZ);
      camera.projectionMatrix.makePerspective(-st.W / 2 / st.f * .1, st.W / 2 / st.f * .1, st.y0 / st.f * .1, -(st.H - st.y0) / st.f * .1, .1, 400);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.setSize(st.W, st.H); sky.width = st.W; sky.height = st.H; sky.style.width = st.W + 'px'; sky.style.height = st.H + 'px';
      prepare({hard: mobile}); frame(); W3.BEND_U.value = st.bend;
      const light = W3.look(st, st.run.z); hemi.color.copy(light.sky); hemi.groundColor.copy(light.ground); hemi.intensity = light.hemi;
      sun.color.copy(light.sun); sun.intensity = light.sunI; sun.position.set(light.at[0] * 6, light.at[1] * 6, -11 + light.at[2] * 6);
      sun.target.position.set(0, 0, -11); sun.target.updateMatrixWorld(); scene.fog.color.copy(light.haze);
      skyContext.reset(); const skyView = {...st, y0: W.horizonOf(st)};
      if (!style.sky(skyView, skyContext, st.t, st.run.z)) W.sky(skyView, skyContext, st.t, st.run.z);
      renderer.render(scene, camera); document.querySelector('#copy').style.display = 'none';
      return roots().map((o, i) => {
        const b = new T.Box3().setFromObject(o.children[0]), points = [];
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) points.push(W.P(st, x, y, -z));
        const xs = points.map(p => p.x), ys = points.map(p => p.y);
        return {kind: kinds[i], width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
          bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]};
      });
    }
    function fallbackBoard() {
      const c = fallbackContext; c.reset(); c.fillStyle = '#0a1420'; c.fillRect(0, 0, 1280, 800);
      c.fillStyle = '#f4f1e9'; c.font = '700 32px Arial'; c.fillText('RETURN MAN / 2D POWER-UPS', 50, 70);
      c.fillStyle = '#9cacbf'; c.font = '16px Arial'; c.fillText('Matching HUD and fallback artwork', 50, 105);
      kinds.forEach((kind, i) => { c.save(); c.translate((i + .5) * 1280 / 3, 390); c.scale(175, 175); W.ICONS[kind](c, st.t); c.restore();
        c.fillStyle = '#f4f1e9'; c.font = '700 23px Arial'; c.textAlign = 'center'; c.fillText(['BOOZE', 'PAINKILLER', 'SMELLING SALTS'][i], (i + .5) * 1280 / 3, 690); });
      return fallback.toDataURL('image/png');
    }
    window.powerupsCheck = {identity: id => D.setMe(id), prepare, snapshot, hiddenStatus, motion, collect, renderBoard, renderGame, fallbackBoard};
    prepare();
  }).catch(error => { error.message += '\nFixture diagnostics: ' + JSON.stringify({legacy, errors, failed, external}); throw error; });
  return {page, context,
    identity: id => page.evaluate(id => window.powerupsCheck.identity(id), id),
    async snapshot(options) { await page.evaluate(options => window.powerupsCheck.prepare(options), options || {}); return page.evaluate(() => window.powerupsCheck.snapshot()); },
    clean() { assert.deepEqual({errors, external, failed}, {errors: [], external: [], failed: []}, 'No browser or network errors'); },
    close: () => context.close()};
}
function unchanged(actual, expected, label) {
  assert.equal(actual.owner, false, label + ': public profile');
  for (const kind of kinds) {
    assert.equal(actual.items[kind].hash, expected.items[kind].hash, label + ': exact ' + kind + ' 3D geometry/materials');
    assert.deepEqual(actual.items[kind].icon, expected.items[kind].icon, label + ': exact ' + kind + ' HUD icon');
    assert.deepEqual(actual.items[kind].fallback, expected.items[kind].fallback, label + ': exact ' + kind + ' 2D pickup');
  }
}
function redesigned(actual, expected) {
  assert.equal(actual.owner, true);
  const modelHashes = new Set(), iconHashes = new Set();
  for (const kind of kinds) {
    const a = actual.items[kind], b = expected.items[kind]; modelHashes.add(a.hash); iconHashes.add(a.icon.hash);
    assert.deepEqual(a.problems, [], kind + ': finite geometry and transforms');
    assert.equal(a.visible, true); assert.notEqual(a.hash, b.hash, kind + ': new 3D model');
    assert.notEqual(a.icon.hash, b.icon.hash, kind + ': new HUD art'); assert.notEqual(a.fallback.hash, b.fallback.hash, kind + ': new 2D pickup');
    assert.ok(a.bodySize[1] >= b.bodySize[1] * 1.6 && a.bodySize[1] > 1.6, kind + ': visibly larger physical icon');
    assert.ok(a.bodySize[0] > .5, kind + ': substantial readable silhouette');
    assert.ok(a.vertices > 100 && a.meshCount > 2, kind + ': actual 3D artwork');
    assert.equal(a.root[1], a.ground, kind + ': anchors to current ground/roof');
    assert.ok(a.bodyBounds[0][1] > a.ground + .15, kind + ': floats clear of surface');
    assert.ok(a.icon.count > 2000 && a.fallback.count > 2000, kind + ': visible 2D artwork');
  }
  assert.equal(modelHashes.size, 3, 'Three distinct 3D designs'); assert.equal(iconHashes.size, 3, 'Three distinct HUD designs');
}

(async () => {
  const browser = await launch(), report = {baseline, public: {}, passed: false};
  try {
    const old = await fixture(browser, true);
    try { report.original = {normal: await old.snapshot(), hard: await old.snapshot({hard: true})}; old.clean(); }
    finally { await old.close(); }
    const f = await fixture(browser);
    try {
      for (const id of ['ben', null, 'none', 'evan-invalid', 'ryan-dow']) {
        await f.identity(id); const label = id === null ? 'unselected' : id;
        report.public[label] = {normal: await f.snapshot(), hard: await f.snapshot({hard: true})};
        unchanged(report.public[label].normal, report.original.normal, label + ' normal'); unchanged(report.public[label].hard, report.original.hard, label + ' hard');
      }
      await f.identity('evan'); report.owner = await f.snapshot(); redesigned(report.owner, report.original.normal);
      report.ownerHard = await f.snapshot({hard: true}); redesigned(report.ownerHard, report.original.normal);
      report.roof = await f.snapshot({roof: true}); redesigned(report.roof, report.original.normal);
      for (const kind of kinds) assert.equal(report.roof.items[kind].ground, 2.5, kind + ': roof fixture is elevated');
      report.motion = await f.page.evaluate(() => window.powerupsCheck.motion());
      for (const sample of report.motion) for (const item of sample.items) {
        assert.ok(item.facing > .5, item.kind + ': readable toward camera at t=' + sample.t);
        assert.ok(item.minY > item.ground + .15, item.kind + ': animated model clears roof at t=' + sample.t);
        assert.ok(item.maxY < item.ground + 5, item.kind + ': sensible floating height');
      }
      assert.deepEqual(await f.page.evaluate(() => window.powerupsCheck.collect()), [false, false, false], 'Collected pickups disappear');
      await f.page.evaluate(() => window.powerupsCheck.renderBoard()); await f.page.screenshot({path: path.join(output, 'owner-powerups-board.png')});
      const fallback = await f.page.evaluate(() => window.powerupsCheck.fallbackBoard()); fs.writeFileSync(path.join(output, 'owner-powerups-2d.png'), Buffer.from(fallback.split(',')[1], 'base64'));
      await f.page.evaluate(() => window.powerupsCheck.renderGame()); await f.page.screenshot({path: path.join(output, 'owner-powerups-gameplay.png')});
      await f.page.setViewportSize({width: 390, height: 700});
      report.mobile = await f.page.evaluate(() => window.powerupsCheck.renderGame(true));
      for (const item of report.mobile) {
        assert.ok(item.width > 20 && item.height > 40, item.kind + ': substantial portrait gameplay icon');
        assert.ok(item.bounds[0] >= 0 && item.bounds[1] >= 0 && item.bounds[2] <= 390 && item.bounds[3] <= 700, item.kind + ': fully framed on mobile');
      }
      await f.page.screenshot({path: path.join(output, 'owner-powerups-mobile.png')});
      await f.page.setViewportSize({width: 1280, height: 800}); await f.page.evaluate(() => window.powerupsCheck.renderGame());
      await f.identity('ben'); report.hiddenSwitch = await f.page.evaluate(() => window.powerupsCheck.hiddenStatus());
      assert.deepEqual(report.hiddenSwitch, {owner: false, pickupRoots: 0, visibleMeshes: 0}, 'Hidden view removes owner artwork before another frame');
      unchanged(await f.snapshot(), report.original.normal, 'owner to public restoration');
      await f.identity('evan'); redesigned(await f.snapshot(), report.original.normal);
      const sibling = await f.context.newPage();
      try {
        await sibling.goto(origin + '/__powerups_check__'); await sibling.evaluate(() => localStorage.setItem('gg-me', 'none'));
        await f.page.waitForFunction(() => !window.powerupsCheck.hiddenStatus().owner);
        report.crossTabSwitch = await f.page.evaluate(() => window.powerupsCheck.hiddenStatus());
        assert.deepEqual(report.crossTabSwitch, {owner: false, pickupRoots: 0, visibleMeshes: 0}, 'Cross-tab switch removes hidden owner art before another frame');
        unchanged(await f.snapshot(), report.original.normal, 'cross-tab guest restoration');
      } finally { await sibling.close(); }
      f.clean(); report.passed = true;
    } finally { await f.close(); }
  } finally { fs.writeFileSync(path.join(output, 'powerups-checks.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
  console.log('PASS: owner power-ups, public/guest/unselected exact baselines, 2D art, size/readability, ground/roof placement, collection, and hidden/cross-tab profile restoration.');
  console.log('Screenshots and metrics: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; });
