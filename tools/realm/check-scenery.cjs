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
    localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '1');
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

async function assetsCheck(page) {
  const layouts = await page.evaluate(async themes => {
    const D3 = await import('/js/views/realm-3d.js');
    const result = [];
    for (const theme of themes) {
      const file = D3.WORLD_FILES[theme].tall;
      const lay = await fetch('/img/realm/scenery/' + file).then(r => r.json());
      const background = lay.assets[lay.scene.background_asset_id];
      const image = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve({width: im.naturalWidth, height: im.naturalHeight});
        im.onerror = () => reject(new Error('Missing scenery: ' + background.pic.file));
        im.src = '/img/realm/scenery/' + background.pic.file;
      });
      let sleigh = null;
      if (theme === 'christmas') {
        const asset = Object.values(lay.assets).find(a => /\/santa-sleigh-v1\.webp$/.test(a.pic.file));
        if (asset) {
          const im = await new Promise((resolve, reject) => {
            const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Missing Santa sleigh artwork'));
            img.src = '/img/realm/scenery/' + asset.pic.file;
          });
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
          const ctx = canvas.getContext('2d'); ctx.drawImage(im, 0, 0, 64, 64);
          const pixels = ctx.getImageData(0, 0, 64, 64).data;
          const alpha = Array.from({length: 64 * 64}, (_, i) => pixels[i * 4 + 3]);
          sleigh = {file: asset.pic.file, width: im.naturalWidth, height: im.naturalHeight, transparent: alpha.some(a => a === 0), painted: alpha.some(a => a > 0)};
        }
      }
      const polygon = lay.build_zone_polygon;
      const inside = ([x, y]) => {
        const signs = polygon.map((p, i) => {
          const q = polygon[(i + 1) % polygon.length];
          return Math.sign((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]));
        }).filter(Boolean);
        return signs.every(s => s === signs[0]);
      };
      const lot = D3.sceneryLot(lay.lot), halfHeight = lot.h / 2, halfWidth = halfHeight / Math.sin(D3.PITCH);
      if (Math.abs(halfWidth - lay.lot.h / (2 * Math.sin(.9))) > 1e-8) throw Error("Scenery clearing width changed");
      const lotCorners = [[lay.lot.cx - halfWidth, lay.lot.cy], [lay.lot.cx, lay.lot.cy - halfHeight], [lay.lot.cx + halfWidth, lay.lot.cy], [lay.lot.cx, lay.lot.cy + halfHeight]];
      result.push({theme, file, background: background.pic.file, image, scene: lay.scene, sleigh,
        lotHeightFraction: lay.lot.h / lay.scene.height,
        lotWidthFraction: halfWidth * 2 / lay.scene.width,
        lotInside: lotCorners.every(inside),
        zoneInside: polygon.every(([x, y]) => x >= 0 && y >= 0 && x <= lay.scene.width && y <= lay.scene.height),
        intrusions: lay.instances.filter(it => inside([it.rect.x + it.rect.width / 2, it.rect.y + it.rect.height])).map(it => it.id)});
    }
    return result;
  }, themes);
  const hashes = new Set();
  for (const lay of layouts) {
    assert(/world-v[23]\.webp$/.test(lay.background), lay.theme + ': uses the expanded world artwork');
    assert(lay.image.width >= 850 && lay.image.height >= 1700, lay.theme + ': world artwork preserves the generated portrait detail');
    assert.deepEqual(lay.image, {width: lay.scene.width, height: lay.scene.height}, lay.theme + ': layout matches actual image dimensions');
    assert(lay.image.height > lay.image.width, lay.theme + ': world supports the portrait playfield');
    assert(lay.lotWidthFraction <= .4 && lay.lotHeightFraction <= .18, lay.theme + ': entire playable plot is small relative to its world');
    assert(lay.lotInside && lay.zoneInside, lay.theme + ': playable plot and reserved area stay inside the world');
    assert.deepEqual(lay.intrusions, [], lay.theme + ': scenery props do not block the playable plot');
    if (lay.theme === 'christmas') assert(lay.sleigh && lay.sleigh.width > 128 && lay.sleigh.height > 128 && lay.sleigh.transparent && lay.sleigh.painted, 'Christmas includes a visible Santa sleigh image with transparent surroundings');
    hashes.add(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'img/realm/scenery', lay.background))).digest('hex'));
  }
  assert.equal(hashes.size, themes.length, 'Every scenery has distinct world artwork');
  console.log(`PASS: ${themes.length} distinct high-resolution worlds, compact playable plots, valid build zones and no prop intrusions`);
}

async function cameraChecks(page) {
  for (const theme of themes) {
    const result = await page.evaluate(async theme => {
      const D3 = await import('/js/views/realm-3d.js'), F = await import('/js/core/realm.js');
      if (!await D3.load(theme)) throw new Error('3D failed to load for ' + theme);
      const host = document.createElement('div');
      host.id = 'scenery-test-host';
      host.style.cssText = 'position:fixed;inset:0;z-index:9999;width:390px;height:844px;background:#142431';
      document.body.appendChild(host);
      const v = D3.create(host, {village: true, scenery: theme}), s = F.fresh();
      const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const footprint = () => s.b.flatMap(b => [b.x, b.x + F.KINDS[b.t].size].flatMap(x => [b.y, b.y + F.KINDS[b.t].size].map(y => v.project(x, y))));
      const width = points => Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
      v.setLot(s); v.frameVillage(); await settle();
      const near = footprint(), villageZoom = v.zoom;
      const villageInside = near.every(p => p.x >= 8 && p.x <= 382 && p.y >= 100 && p.y <= 704);
      v.frameWorld();
      await settle();
      const far = footprint(), worldZoom = v.zoom;
      const plotCorners = [[0, 0], [0, F.N], [F.N, 0], [F.N, F.N]].map(([x, y]) => v.project(x, y));
      window.__sceneryCheck = {v, host, settle};
      return {theme, villageInside, villageZoom, worldZoom,
        villageWidth: width(near), worldVillageWidth: width(far), plotWidth: width(plotCorners),
        worldInside: plotCorners.every(p => p.on && p.x >= 0 && p.x <= 390 && p.y >= 0 && p.y <= 844), overview: v.overview};
    }, theme);
    try {
      assert(result.villageInside, theme + ': starter buildings are usable at village zoom');
      assert(result.worldZoom > result.villageZoom * 3, theme + ': world view gives a substantially wider scale');
      assert(result.worldVillageWidth < result.villageWidth / 3, theme + ': starter village becomes tiny at world zoom');
      assert(result.worldInside && result.plotWidth < 200 && result.overview, theme + ': the whole plot fits comfortably inside the world overview');
      if (process.argv.includes('--screenshots')) {
        await page.screenshot({path: path.join(output, 'realm-scenery-' + theme + '-overview.png')});
        await page.evaluate(async () => { window.__sceneryCheck.v.frameVillage(); await window.__sceneryCheck.settle(); });
        await page.screenshot({path: path.join(output, 'realm-scenery-' + theme + '-village.png')});
      }
    } catch (error) {
      console.error('Camera measurements:', result);
      await page.screenshot({path: path.join(output, 'realm-scenery-' + theme + '-failure.png')});
      throw error;
    } finally {
      await page.evaluate(() => { window.__sceneryCheck.v.dispose(); window.__sceneryCheck.host.remove(); delete window.__sceneryCheck; });
    }
  }
  console.log(`PASS: all ${themes.length} worlds keep the village usable up close and tiny within the full overview`);
}

async function christmasAspectChecks(page) {
  for (const size of [{width: 720, height: 720}, {width: 960, height: 540}]) {
    await page.setViewportSize(size);
    const result = await page.evaluate(async size => {
      const D3 = await import('/js/views/realm-3d.js'), F = await import('/js/core/realm.js');
      await D3.load('christmas');
      const host = document.createElement('div');
      host.style.cssText = `position:fixed;inset:0;z-index:9999;width:${size.width}px;height:${size.height}px`;
      document.body.appendChild(host);
      const v = D3.create(host, {village: true, scenery: 'christmas'}), s = F.fresh();
      const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      try {
        v.setLot(s); v.frameVillage(); await settle();
        const villageZoom = v.zoom;
        v.frameWorld(); await settle();
        const corners = [[0, 0], [0, F.N], [F.N, 0], [F.N, F.N]].map(([x, y]) => v.project(x, y));
        const width = Math.max(...corners.map(p => p.x)) - Math.min(...corners.map(p => p.x));
        return {villageZoom, worldZoom: v.zoom, width,
          inside: corners.every(p => p.on && p.x >= 0 && p.x <= size.width && p.y >= 0 && p.y <= size.height)};
      } finally { v.dispose(); host.remove(); }
    }, size);
    assert(result.inside && result.width < size.width * .4, `Christmas ${size.width}×${size.height}: the complete plot stays small and visible`);
    assert(result.worldZoom > result.villageZoom * 3, `Christmas ${size.width}×${size.height}: wide overview remains available`);
  }
  await page.setViewportSize({width: 390, height: 844});
  console.log('PASS: Christmas scenery keeps its full plot small and visible in square and wide viewports');
}

async function wildlifeChecks(page) {
  const all = await page.evaluate(async themes => {
    const T = await import('/js/vendor/three/three.module.min.js');
    const {createWildlife} = await import('/js/views/realm-wildlife.js');
    const ground = {w: 1024, h: 1536, per: .5, lot: {cx: 512, cy: 870, h: 160},
      under: (x, y) => new T.Vector3((x - 512) * .5, 0, (y - 870) * .5)};
    const result = [];
    for (const theme of themes) {
      const scene = new T.Scene(), wildlife = createWildlife(T, scene, {theme, ground});
      const group = scene.getObjectByName('realm-ambient-wildlife');
      const meshes = group.children.slice(), disposed = {geometry: 0, material: 0, instance: 0};
      meshes.forEach(mesh => {
        mesh.geometry.addEventListener('dispose', () => disposed.geometry++);
        mesh.material.addEventListener('dispose', () => disposed.material++);
        mesh.addEventListener('dispose', () => disposed.instance++);
      });
      const animated = wildlife.update(0, {zoom: 400});
      const before = Object.fromEntries(meshes.map(mesh => [mesh.name, Array.from(mesh.instanceMatrix.array)]));
      wildlife.update(4, {zoom: 400});
      const moving = meshes.filter(mesh => mesh.instanceMatrix.array.some((value, i) => Math.abs(value - before[mesh.name][i]) > .001)).map(mesh => mesh.name);
      const finite = meshes.every(mesh => Array.from(mesh.instanceMatrix.array).every(Number.isFinite));
      const ray = new T.Raycaster(new T.Vector3(0, 1000, 0), new T.Vector3(0, -1, 0));
      const targets = ray.intersectObject(group, true).length;
      wildlife.update(5, {zoom: 400, active: false});
      const inactiveHidden = !group.visible && !wildlife.counts.visible;
      wildlife.update(6, {zoom: 50});
      const nearHidden = !group.visible && !wildlife.counts.visible;
      wildlife.update(7, {zoom: 400});
      const returned = group.visible && wildlife.counts.visible;
      const counts = {...wildlife.counts};
      wildlife.dispose(); wildlife.dispose();
      result.push({theme, animated, moving, finite, targets, inactiveHidden, nearHidden, returned, counts,
        disposed, removed: !scene.children.length && !group.children.length, stopped: wildlife.update(9, {zoom: 400}) === false});
    }
    // A shifted, smaller clearing catches wildlife exclusion that was tied to a
    // previous background's center or size instead of the current layout.
    const shifted = {...ground, lot: {cx: .47 * ground.w, cy: .50 * ground.h, h: .08 * ground.h}};
    const tightZone = [{x: .47, y: .50, rx: .14, ry: .09}];
    const testScene = new T.Scene();
    const nearLot = createWildlife(T, testScene, {theme: 'forest', ground: shifted, wildlife: {birds: tightZone, dragons: tightZone, animals: tightZone}});
    let insidePlot = 0, visibleBodies = 0;
    for (let time = 0; time < 100; time += 4) {
      nearLot.update(time, {zoom: 400});
      for (const name of ['realm-birds', 'realm-dragons', 'realm-grazing-animals']) {
        const mesh = testScene.getObjectByName(name), matrix = new T.Matrix4();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          const m = matrix.elements;
          if (Math.hypot(m[0], m[1], m[2]) < .001) continue;
          visibleBodies++;
          const px = m[12] / .5 + 512, py = m[14] / .5 + 870 - m[13] * Math.cos(.9) / .5;
          if (Math.abs(px - shifted.lot.cx) / (shifted.lot.h / (2 * Math.sin(.9))) + Math.abs(py - shifted.lot.cy) / (shifted.lot.h / 2) <= 1) insidePlot++;
        }
      }
    }
    nearLot.dispose();
    const scene = new T.Scene();
    let changes = 0;
    const wildlife = createWildlife(T, scene, {theme: 'forest', ground, onChange: () => changes++});
    wildlife.update(1, {zoom: 400});
    window.__wildlifeCheck = {T, createWildlife, ground, scene, wildlife, changes: () => changes};
    return {result, insidePlot, visibleBodies};
  }, themes);
  assert.equal(all.insidePlot, 0, 'Wildlife stays outside the actual plot when its clearing changes size and position');
  assert(all.visibleBodies > 0, 'Plot exclusion retains wildlife around the shifted clearing');
  for (const r of all.result) {
    assert(r.animated && r.finite, r.theme + ': wildlife has a valid animation frame');
    assert(r.counts.birds > 0 && r.counts.dragons > 0 && r.counts.animals > 0 && r.counts.drawCalls <= 8, r.theme + ': birds, dragons and ground animals use a bounded number of draw calls');
    assert(['realm-birds', 'realm-bird-wings', 'realm-dragons', 'realm-dragon-wings', 'realm-grazing-animals'].every(name => r.moving.includes(name)), r.theme + ': wildlife and wings move between frames');
    assert.equal(r.targets, 0, r.theme + ': decorative wildlife never intercepts game picking');
    assert(r.inactiveHidden && r.nearHidden && r.returned, r.theme + ': wildlife hides near the village and on inactive views, then returns');
    assert(r.removed && r.stopped, r.theme + ': disposal removes wildlife and prevents more updates');
    assert.deepEqual(r.disposed, {geometry: 7, material: 7, instance: 7}, r.theme + ': all wildlife GPU resources are disposed once');
  }
  const visibility = await page.evaluate(() => {
    const {scene, wildlife, changes} = window.__wildlifeCheck;
    const group = scene.getObjectByName('realm-ambient-wildlife');
    const original = Object.getOwnPropertyDescriptor(document, 'hidden');
    try {
      Object.defineProperty(document, 'hidden', {configurable: true, value: true});
      document.dispatchEvent(new Event('visibilitychange'));
      const stopped = !group.visible && !wildlife.counts.visible && wildlife.update(12, {zoom: 400}) === false;
      Object.defineProperty(document, 'hidden', {configurable: true, value: false});
      document.dispatchEvent(new Event('visibilitychange'));
      return {stopped, resumed: group.visible && wildlife.counts.visible && changes() > 0};
    } finally {
      if (original) Object.defineProperty(document, 'hidden', original); else delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  assert.deepEqual(visibility, {stopped: true, resumed: true}, 'Hidden documents suspend wildlife and request a redraw when shown again');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.waitForFunction(() => window.__wildlifeCheck.wildlife.counts.reducedMotion);
  const reduced = await page.evaluate(() => {
    const {scene, wildlife} = window.__wildlifeCheck;
    const group = scene.getObjectByName('realm-ambient-wildlife');
    const first = wildlife.update(10, {zoom: 400});
    const before = group.children.map(mesh => Array.from(mesh.instanceMatrix.array));
    const second = wildlife.update(30, {zoom: 400});
    return {first, second, still: group.children.every((mesh, j) => mesh.instanceMatrix.array.every((v, i) => v === before[j][i])), visible: group.visible};
  });
  assert.deepEqual(reduced, {first: false, second: false, still: true, visible: true}, 'Reduced motion keeps visible wildlife still and stops animation requests');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.waitForFunction(() => !window.__wildlifeCheck.wildlife.counts.reducedMotion);
  const cleanup = await page.evaluate(async () => {
    const data = await import('/js/core/data.js');
    const {T, createWildlife, ground, scene, wildlife} = window.__wildlifeCheck;
    data.setMe('mason');
    const ownerGone = !scene.children.length && !wildlife.counts.visible && wildlife.update(40, {zoom: 400}) === false;
    const other = createWildlife(T, scene, {theme: 'coast', ground});
    const otherEmpty = !scene.children.length && other.counts.drawCalls === 0 && other.update(40, {zoom: 400}) === false;
    other.dispose(); wildlife.dispose(); delete window.__wildlifeCheck;
    data.setMe('evan');
    return {ownerGone, otherEmpty};
  });
  assert.deepEqual(cleanup, {ownerGone: true, otherEmpty: true}, 'Owner loss immediately disposes wildlife; non-owners cannot create it');
  console.log(`PASS: ${themes.length}-theme wildlife motion, actual-plot exclusion, picking isolation, draw-call bound, hidden-tab pause, reduced motion, owner guard and complete resource disposal`);
}

async function sleighChecks(page) {
  const result = await page.evaluate(async () => {
    const T = await import('/js/vendor/three/three.module.min.js');
    const {createWildlife} = await import('/js/views/realm-wildlife.js');
    const image = await new Promise((resolve, reject) => {
      const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('Santa artwork failed to load'));
      im.src = '/img/realm/scenery/christmas/santa-sleigh-v1.webp';
    });
    const ground = {w: 887, h: 1774, per: .5, lot: {cx: 443, cy: 887, h: 140}, under: (x, y) => new T.Vector3((x - 443) * .5, 0, (y - 887) * .5)};
    const scene = new T.Scene(), wildlife = createWildlife(T, scene, {theme: 'christmas', ground, sleighImage: image});
    const sprite = scene.getObjectByName('realm-santa-sleigh'), group = scene.getObjectByName('realm-ambient-wildlife');
    const disposed = {material: 0, texture: 0};
    sprite.material.addEventListener('dispose', () => disposed.material++);
    sprite.material.map.addEventListener('dispose', () => disposed.texture++);
    wildlife.update(0, {zoom: 400});
    const before = sprite.position.clone();
    wildlife.update(20, {zoom: 400});
    const moving = before.distanceTo(sprite.position) > 1;
    const targets = new T.Raycaster(new T.Vector3(0, 1000, 0), new T.Vector3(0, -1, 0)).intersectObject(sprite).length;
    wildlife.update(21, {zoom: 50}); const hiddenNear = !group.visible;
    wildlife.update(22, {zoom: 400}); const visibleFar = group.visible && sprite.visible;
    const otherScene = new T.Scene(), other = createWildlife(T, otherScene, {theme: 'coast', ground, sleighImage: image});
    const christmasOnly = !otherScene.getObjectByName('realm-santa-sleigh'); other.dispose();
    window.__sleighCheck = {T, createWildlife, image, ground, scene, wildlife, sprite, disposed};
    return {moving, targets, hiddenNear, visibleFar, christmasOnly, santa: wildlife.counts.santa, drawCalls: wildlife.counts.drawCalls, realImage: sprite.material.map.image === image};
  });
  assert(result.moving && result.realImage && result.santa === 1 && result.drawCalls === 8, 'Christmas renders one moving Santa sleigh from the actual supplied image with one extra draw call');
  assert(result.hiddenNear && result.visibleFar && result.christmasOnly && result.targets === 0, 'Santa appears only in Christmas overview and never intercepts gameplay picking');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.waitForFunction(() => window.__sleighCheck.wildlife.counts.reducedMotion);
  const still = await page.evaluate(() => {
    const {wildlife, sprite} = window.__sleighCheck;
    const first = wildlife.update(40, {zoom: 400}), p = sprite.position.clone(), angle = sprite.material.rotation;
    const second = wildlife.update(80, {zoom: 400});
    return !first && !second && p.equals(sprite.position) && angle === sprite.material.rotation;
  });
  assert(still, 'Reduced motion freezes Santa’s flight and requests no animation frame');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const cleanup = await page.evaluate(async () => {
    const data = await import('/js/core/data.js');
    const {T, createWildlife, image, ground, scene, wildlife, disposed} = window.__sleighCheck;
    data.setMe('mason'); wildlife.dispose(); wildlife.dispose();
    const removed = scene.children.length === 0 && wildlife.update(90, {zoom: 400}) === false;
    const other = createWildlife(T, scene, {theme: 'christmas', ground, sleighImage: image});
    const denied = scene.children.length === 0 && other.counts.drawCalls === 0; other.dispose();
    data.setMe('evan'); delete window.__sleighCheck;
    return {removed, denied, disposed};
  });
  assert.deepEqual(cleanup, {removed: true, denied: true, disposed: {material: 1, texture: 1}}, 'Profile changes remove Santa, dispose the image texture/material once, and deny non-owner recreation');
  console.log('PASS: actual Santa artwork, Christmas-only animated flight, reduced motion, picking isolation and owner-safe GPU cleanup');
}

async function ambienceChecks(page) {
  const results = await page.evaluate(async themes => {
    const T = await import('/js/vendor/three/three.module.min.js');
    const D3 = await import('/js/views/realm-3d.js');
    const {createAmbience, AMBIENCE_REGIONS} = await import('/js/views/realm-ambience.js');
    const width = 256, height = 512;
    const renderer = new T.WebGLRenderer({antialias: false}); renderer.setSize(width, height); renderer.setPixelRatio(1);
    const target = new T.WebGLRenderTarget(width, height, {depthBuffer: false, stencilBuffer: false});
    target.texture.colorSpace = T.SRGBColorSpace;
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 10); camera.position.z = 2;
    const changes = (a, b, lot, regions, w, h) => {
      const out = {all: 0, protected: 0, water: 0, lights: 0, outside: 0};
      const inRegions = (x, y, list) => list.some(r => ((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2 < 1);
      for (let i = 0; i < width * height; i++) {
        const j = i * 4;
        if (Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2])) <= 1) continue;
        out.all++;
        const x = (i % width + .5) / width, y = 1 - (Math.floor(i / width) + .5) / height;
        if (Math.abs(x - lot.cx / w) / (lot.h / (2 * Math.sin(.9)) / w) + Math.abs(y - lot.cy / h) / (lot.h / 2 / h) <= .98) out.protected++;
        const wet = inRegions(x, y, regions.water), lit = inRegions(x, y, regions.lights);
        if (wet) out.water++;
        if (lit) out.lights++;
        if (!wet && !lit) out.outside++;
      }
      return out;
    };
    const result = [];
    for (const theme of themes) {
      const lay = await fetch('/img/realm/scenery/' + D3.WORLD_FILES[theme].tall).then(r => r.json());
      const image = await new Promise((resolve, reject) => {
        const im = new Image(); im.onload = () => resolve(im); im.onerror = reject;
        im.src = '/img/realm/scenery/' + lay.assets[lay.scene.background_asset_id].pic.file;
      });
      const texture = new T.Texture(image); texture.colorSpace = T.SRGBColorSpace; texture.needsUpdate = true;
      const geometry = new T.PlaneGeometry(2, 2), material = new T.MeshBasicMaterial({map: texture, toneMapped: false});
      const originalCompile = material.onBeforeCompile, mesh = new T.Mesh(geometry, material), scene = new T.Scene(); scene.add(mesh);
      const ground = {mesh, w: lay.scene.width, h: lay.scene.height, lot: lay.lot};
      const ambience = createAmbience(T, ground, {theme}), regions = AMBIENCE_REGIONS[theme];
      const frame = (seconds, active = true) => {
        const more = ambience.update(seconds, {zoom: 400, active});
        renderer.setRenderTarget(target); renderer.render(scene, camera);
        const pixels = new Uint8Array(width * height * 4); renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
        return {more, pixels};
      };
      const first = frame(17), second = frame(18.37), pausedA = frame(30, false), pausedB = frame(60, false);
      const movement = changes(first.pixels, second.pixels, lay.lot, regions, ground.w, ground.h);
      const paused = changes(pausedA.pixels, pausedB.pixels, lay.lot, regions, ground.w, ground.h);
      const row = {theme, compiled: !!ambience.counts.compiled, programsValid: renderer.info.programs.every(p => !p.diagnostics || p.diagnostics.runnable !== false),
        movement, paused: paused.all === 0 && !pausedA.more && !pausedB.more, waterRegions: regions.water.length, lightRegions: regions.lights.length};
      const dispose = () => { ambience.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); };
      if (theme !== themes[themes.length - 1]) {
        ambience.dispose(); row.stopped = ambience.update(80, {zoom: 400, active: true}) === false;
        row.restored = material.onBeforeCompile === originalCompile; dispose();
      } else {
        window.__ambienceCheck = {ambience, frame, dispose, renderer, target, changes, ground, regions, originalCompile, material};
        row.stopped = row.restored = true; // The last instance is checked after browser reduced-motion changes below.
      }
      result.push(row);
    }
    return result;
  }, themes);
  for (const r of results) {
    assert(r.compiled && r.programsValid, r.theme + ': ambience shader compiles in a real WebGL renderer');
    assert(r.waterRegions > 0 && r.movement.water > 0, r.theme + ': actual pixels move in calibrated water/lava regions');
    assert(r.lightRegions > 0 && r.movement.lights > 0, r.theme + ': actual pixels flicker in calibrated light regions');
    assert.equal(r.movement.protected, 0, r.theme + ': the playable plot remains completely static');
    assert.equal(r.movement.outside, 0, r.theme + ': scenery outside authored water and light regions stays static');
    assert(r.paused && r.stopped && r.restored, r.theme + ': inactive or disposed ambience stops and restores its shader hook');
  }
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.waitForFunction(() => window.__ambienceCheck.ambience.counts.reducedMotion);
  const reduced = await page.evaluate(() => {
    const s = window.__ambienceCheck, a = s.frame(100), b = s.frame(120);
    const delta = s.changes(a.pixels, b.pixels, s.ground.lot, s.regions, s.ground.w, s.ground.h);
    return !a.more && !b.more && delta.all === 0;
  });
  assert(reduced, 'Reduced motion renders unchanged scenery pixels and requests no animation');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const cleanup = await page.evaluate(async () => {
    const s = window.__ambienceCheck, data = await import('/js/core/data.js');
    data.setMe('mason');
    const stopped = s.ambience.update(130, {zoom: 400, active: true}) === false;
    const ownerRestored = s.material.onBeforeCompile === s.originalCompile;
    s.dispose(); const restored = s.material.onBeforeCompile === s.originalCompile;
    s.target.dispose(); s.renderer.dispose(); s.renderer.forceContextLoss();
    data.setMe('evan'); delete window.__ambienceCheck;
    return {stopped, ownerRestored, restored};
  });
  assert.deepEqual(cleanup, {stopped: true, ownerRestored: true, restored: true}, 'Owner loss immediately removes ambience and restores the original material');
  console.log('PASS: all scenery shaders compile; actual water/light pixels animate while the base stays static; pause, reduced motion and owner cleanup work');
}

async function hiddenViewCheck(page) {
  await page.evaluate(async () => {
    const D3 = await import('/js/views/realm-3d.js'), F = await import('/js/core/realm.js');
    await D3.load('coast');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:9999;width:390px;height:844px';
    document.body.appendChild(host);
    let active = true, calls = 0, cameraChanges = 0, ticks = 0, drawnTicks = 0, drew = false, monitor = 0;
    const view = D3.create(host, {village: true, scenery: 'coast', isActive: () => active, onCamera: () => cameraChanges++});
    const gl = view.canvas.getContext('webgl2') || view.canvas.getContext('webgl');
    const originals = {};
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      if (typeof gl[name] !== 'function') continue;
      originals[name] = gl[name];
      gl[name] = function (...args) { calls++; drew = true; return originals[name].apply(this, args); };
    }
    const observe = () => { ticks++; if (drew) drawnTicks++; drew = false; monitor = requestAnimationFrame(observe); };
    monitor = requestAnimationFrame(observe);
    const stats = () => ({calls, cameraChanges, zoom: view.zoom, width: view.canvas.width, height: view.canvas.height});
    window.__hiddenViewCheck = {view, host, stats, cadence: () => ({ticks, drawnTicks, now: performance.now()}),
      pause() { active = false; host.style.display = 'none'; view.resize(); view.want(); return stats(); },
      resume() { active = true; host.style.display = 'block'; view.want(); },
      dispose() { cancelAnimationFrame(monitor); view.dispose(); host.remove(); for (const [name, fn] of Object.entries(originals)) gl[name] = fn; }};
    view.setLot(F.fresh()); view.frameWorld();
  });
  try {
    await page.waitForFunction(() => window.__hiddenViewCheck.stats().calls > 0);
    const running = await page.evaluate(() => window.__hiddenViewCheck.stats());
    await page.waitForFunction(before => window.__hiddenViewCheck.stats().calls > before, running.calls);
    const continuing = await page.evaluate(() => window.__hiddenViewCheck.stats());
    assert.equal(continuing.cameraChanges, running.cameraChanges, 'Ambient animation does not repeat unchanged camera DOM updates');
    const paused = await page.evaluate(() => window.__hiddenViewCheck.pause());
    await page.waitForTimeout(350);
    const hidden = await page.evaluate(() => window.__hiddenViewCheck.stats());
    assert.deepEqual(hidden, paused, 'A hidden inactive Realm produces no GL draws and preserves its camera/canvas size');
    await page.evaluate(() => window.__hiddenViewCheck.resume());
    await page.waitForFunction(before => window.__hiddenViewCheck.stats().calls > before, paused.calls);
    const resumed = await page.evaluate(() => window.__hiddenViewCheck.stats());
    assert.equal(resumed.zoom, paused.zoom, 'Returning to the Realm preserves the saved zoom');
    assert.equal(resumed.width, paused.width, 'Returning to the Realm restores the same canvas width');
    assert.equal(resumed.height, paused.height, 'Returning to the Realm restores the same canvas height');
    const quietStart = await page.evaluate(async () => {
      window.__hiddenViewCheck.view.frameVillage();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.__hiddenViewCheck.cadence();
    });
    await page.waitForTimeout(1200);
    const quietEnd = await page.evaluate(() => window.__hiddenViewCheck.cadence());
    const available = quietEnd.ticks - quietStart.ticks, drawn = quietEnd.drawnTicks - quietStart.drawnTicks;
    assert(available >= 5 && drawn > 0 && drawn <= Math.ceil((quietEnd.now - quietStart.now) / 1000 * 25) + 2, `Village grass uses a bounded animation cadence (${drawn} frames)`);
  } finally {
    await page.evaluate(() => { window.__hiddenViewCheck.dispose(); delete window.__hiddenViewCheck; });
  }
  console.log('PASS: actual GL draws stop for hidden views, resume with saved camera state, avoid repeated DOM updates and keep village grass animation at a bounded cadence');
}

async function profileChecks(browser, url) {
  for (const profile of ['mason', 'none']) {
    const test = await isolatedPage(browser, url, profile);
    try {
      await test.page.evaluate(async () => (await import('/js/app.js')).nav('/realm'));
      await test.page.waitForTimeout(500);
      assert.equal(await test.page.locator('.rl-home canvas').count(), 0, profile + ': owner scene cannot mount');
      const directLoad = await test.page.evaluate(async () => (await import('/js/views/realm-3d.js')).load('coast'));
      assert.equal(directLoad, false, profile + ': direct renderer load denies owner-only artwork');
      const christmasLoad = await test.page.evaluate(async () => (await import('/js/views/realm-3d.js')).load('christmas'));
      assert.equal(christmasLoad, false, profile + ': direct Christmas artwork loading is denied');
      assert.deepEqual(test.images, [], profile + ': owner scenery artwork is not requested');
      assert.deepEqual(test.errors, [], profile + ': no browser exceptions');
    } finally { await test.context.close(); }
  }
  const test = await isolatedPage(browser, url, 'evan');
  try {
    await test.page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), s = F.fresh();
      for (const b of s.b) if (F.KINDS[b.t].role === 'make') b.c = Date.now() - 6 * F.HOUR;
      F._set(s);
      await (await import('/js/app.js')).nav('/realm');
    });
    await test.page.waitForSelector('.rl-home canvas');
    await test.page.waitForFunction(() => !document.querySelector('.rl-home .rl-loading'));
    assert(test.images.some(file => /world-v[23]\.webp/.test(file)), 'Owner loads expanded scenery');
    const spacing = () => test.page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const a = new DOMMatrix(document.querySelector('[data-rl-tag="3"]').style.transform);
      const b = new DOMMatrix(document.querySelector('[data-rl-tag="4"]').style.transform);
      return Math.hypot(a.m41 - b.m41, a.m42 - b.m42);
    });
    const village = await spacing();
    if (process.argv.includes('--screenshots')) await test.page.screenshot({path: path.join(output, 'realm-scenery-ui-village.png')});
    await test.page.locator('[data-rl-world]').click();
    const overview = await spacing();
    assert(overview < village / 3, 'Whole realm button moves from the village to the expanded world');
    if (process.argv.includes('--screenshots')) await test.page.screenshot({path: path.join(output, 'realm-scenery-ui-overview.png')});
    await test.page.locator('[data-rl-zoom="in"]').click();
    const closer = await spacing();
    assert(closer > overview * 1.05, 'Plus button zooms into the world');
    await test.page.locator('[data-rl-zoom="out"]').click();
    const further = await spacing();
    assert(further < closer * .95, 'Minus button zooms back out');
    await test.page.locator('[data-rl-frame]').click();
    const centered = await spacing();
    assert(centered > overview * 3 && Math.abs(centered - village) < 2, 'Village button restores the useful close view');
    await test.page.locator('[data-rl-world]').click();
    await test.page.evaluate(() => {
      const canvas = document.querySelector('.rl-home canvas'), gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      let calls = 0;
      const originals = {};
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        if (typeof gl[name] !== 'function') continue;
        originals[name] = gl[name];
        gl[name] = function (...args) { calls++; return originals[name].apply(this, args); };
      }
      window.__hubDraws = {canvas, calls: () => calls, restore() { for (const [name, fn] of Object.entries(originals)) gl[name] = fn; }};
    });
    await test.page.waitForFunction(() => window.__hubDraws.calls() > 0);
    await test.page.locator('.rl-hub').click();
    await test.page.waitForFunction(() => !document.documentElement.classList.contains('is-realm-playing'));
    const hubCalls = await test.page.evaluate(() => window.__hubDraws.calls());
    await test.page.waitForTimeout(350);
    assert.equal(await test.page.evaluate(() => window.__hubDraws.calls()), hubCalls, 'Returning to the Hub stops the real village canvas drawing');
    await test.page.evaluate(async () => (await import('/js/app.js')).nav('/realm'));
    await test.page.waitForSelector('.rl-home canvas');
    const sameCanvas = await test.page.evaluate(() => document.querySelector('.rl-home canvas') === window.__hubDraws.canvas);
    if (sameCanvas) await test.page.waitForFunction(before => window.__hubDraws.calls() > before, hubCalls);
    await test.page.evaluate(() => { window.__hubDraws.restore(); delete window.__hubDraws; });
    await test.page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
    await test.page.waitForFunction(() => !document.querySelector('.rl-home canvas') && !document.documentElement.classList.contains('is-realm-playing'));
    assert.equal(await test.page.locator('#tabbar').isVisible(), true, 'Same-tab profile change restores normal navigation');
    await test.page.evaluate(async () => { (await import('/js/core/data.js')).setMe('evan'); await (await import('/js/app.js')).nav('/realm'); });
    await test.page.waitForSelector('.rl-home canvas');
    const second = await test.context.newPage();
    await second.goto(url + '/data/league.json');
    await second.evaluate(() => localStorage.setItem('gg-me', 'none'));
    await test.page.waitForFunction(() => !document.querySelector('.rl-home canvas') && !document.documentElement.classList.contains('is-realm-playing'));
    await second.close();
    assert.deepEqual(test.errors, [], 'Profile changes do not raise browser exceptions');
  } finally { await test.context.close(); }
  console.log('PASS: actual Whole realm/Village/zoom controls, Hub rendering pause/resume, owner-only world loading and same-tab/cross-tab scene cleanup');
}

async function christmasSelectionCheck(browser, url) {
  const test = await isolatedPage(browser, url, 'evan');
  try {
    await test.page.evaluate(async () => {
      const F = await import('/js/core/realm.js'); F._set(F.fresh());
      await (await import('/js/app.js')).nav('/realm');
    });
    await test.page.waitForSelector('.rl-home canvas');
    await test.page.waitForFunction(() => !document.querySelector('.rl-home .rl-loading'));
    assert.equal(await test.page.evaluate(async () => { const F = await import('/js/core/realm.js'); return F.keepOf(F.mine()); }), 1, 'Christmas selection is exercised with an unupgraded Keep');
    await test.page.locator('[data-rl-house]').click();
    const holiday = test.page.locator('[data-rl-scn="christmas"]');
    assert.notEqual(await holiday.getAttribute('aria-disabled'), 'true', 'Christmas Kingdom is selectable at Keep 1');
    await holiday.click();
    await test.page.waitForFunction(async () => { const F = await import('/js/core/realm.js'); return F.sceneryOf(F.mine()) === 'christmas'; });
    await test.page.evaluate(async () => (await import('/js/views/realm-3d.js')).load('christmas'));
    assert.equal(await holiday.getAttribute('aria-pressed'), 'true', 'Christmas choice is marked as selected');
    if (process.argv.includes('--screenshots')) await test.page.screenshot({path: path.join(output, 'realm-scenery-christmas-selection.png')});
    await test.page.locator('.sh-rl [data-sheet-close]').click();
    await test.page.locator('[data-rl-world]').click();
    await test.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert(test.images.some(file => /\/christmas\/world-v2\.webp/.test(file)), 'Selecting Christmas loads its own expanded world art');
    assert(test.images.some(file => /\/christmas\/santa-sleigh-v1\.webp/.test(file)), 'Selecting Christmas loads Santa’s owner-only sleigh artwork');
    if (process.argv.includes('--screenshots')) await test.page.screenshot({path: path.join(output, 'realm-scenery-christmas-ui-overview.png')});
    await test.page.reload();
    await test.page.waitForFunction(() => window.__ggBooted);
    await test.page.waitForSelector('.rl-home canvas');
    const saved = await test.page.evaluate(async () => { const F = await import('/js/core/realm.js'); return {theme: F.sceneryOf(F.mine()), keep: F.keepOf(F.mine())}; });
    assert.deepEqual(saved, {theme: 'christmas', keep: 1}, 'Christmas selection persists through a real page reload');
    await test.page.locator('[data-rl-house]').click();
    await test.page.locator('[data-rl-scn="coast"]').click();
    const returned = await test.page.evaluate(async () => { const F = await import('/js/core/realm.js'); return {theme: F.sceneryOf(F.mine()), sc: F.mine().sc}; });
    assert.deepEqual(returned, {theme: 'coast', sc: ''}, 'The owner can return from Christmas to the default coast');
    assert.deepEqual(test.errors, [], 'Christmas selection and reload produce no browser exceptions');
  } finally { await test.context.close(); }
  console.log('PASS: owner-only Christmas at Keep 1, UI selection, dedicated artwork, persisted reload and return to the coast');
}

async function interruptedLoadCheck(browser, url) {
  let release, requested;
  const gate = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { requested = resolve; });
  const test = await isolatedPage(browser, url, 'evan', async (_route, target) => {
    if (/\/coast\/world-v[23]\.webp$/.test(target.pathname)) { requested(); await gate; }
  });
  try {
    await test.page.evaluate(async () => { void (await import('/js/app.js')).nav('/realm'); });
    let timeout;
    try { await Promise.race([reached, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Owner world image was not requested')), 15000); })]); }
    finally { clearTimeout(timeout); }
    await test.page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
    release();
    await test.page.waitForTimeout(1000);
    assert.equal(await test.page.locator('.rl-home canvas').count(), 0, 'An owner image finishing after profile change cannot restore the scene');
    assert.equal(await test.page.evaluate(() => document.documentElement.classList.contains('is-realm-playing')), false, 'An interrupted load cannot collapse non-owner navigation');
    assert.deepEqual(test.errors, [], 'Interrupted owner artwork load fails safely');
  } finally { release(); await test.context.close(); }
  console.log('PASS: pending world images cannot recreate owner scenery after a profile change');
}

async function run(url) {
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname), 'Only loopback test URLs are allowed');
  precacheCheck();
  fs.mkdirSync(output, {recursive: true});
  const onlyWildlife = process.argv.includes('--wildlife'), onlyAmbience = process.argv.includes('--ambience');
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    const owner = await isolatedPage(browser, url, 'evan');
    try {
      if (!onlyWildlife && !onlyAmbience) {
        await assetsCheck(owner.page);
        await cameraChecks(owner.page);
        await christmasAspectChecks(owner.page);
        await hiddenViewCheck(owner.page);
      }
      if (!onlyAmbience) await wildlifeChecks(owner.page);
      if (!onlyWildlife && !onlyAmbience) await sleighChecks(owner.page);
      if (!onlyWildlife) await ambienceChecks(owner.page);
      assert.deepEqual(owner.errors, [], 'Scenery validation has no browser exceptions');
    } finally { await owner.context.close(); }
    if (!onlyWildlife && !onlyAmbience) {
      await profileChecks(browser, url);
      await christmasSelectionCheck(browser, url);
      await interruptedLoadCheck(browser, url);
    }
  } finally { await browser.close(); }
}

(async () => {
  const existing = process.argv.find(arg => arg.startsWith('--url='));
  const server = existing ? null : await localServer();
  try { await run(existing ? existing.slice(6).replace(/\/$/, '') : `http://127.0.0.1:${server.address().port}`); }
  finally { if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
