// Local-only visual/resource checks for the supplied Knight Hero. No app boot, Firebase or remote requests.
// Usage: node tools/realm/check-knight-model.cjs
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), output = path.resolve(root, '../raid-attack-preview');
const mime = {'.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp'};
const playwright = () => { try { return require('playwright'); } catch (_) { return require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); } };
async function server() {
  const s = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname === '/__knight-test') { res.writeHead(200, {'Content-Type': 'text/html'}).end('<!doctype html><html><body style="margin:0;background:#e6dfcc"></body></html>'); return; }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => { if (error) { res.writeHead(404).end(); return; } res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}).end(bytes); });
  });
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve)); return s;
}
async function isolated(browser, url, profile = 'evan', mode = 'normal') {
  const context = await browser.newContext({viewport: {width: 800, height: 800}, serviceWorkers: 'block'});
  const requests = [], errors = []; let release, delayed;
  const gate = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
    const target = new URL(route.request().url());
    if (target.origin !== url && !['data:', 'blob:'].includes(target.protocol)) return route.abort();
    if (target.pathname.endsWith('knight.glb')) { requests.push(target.pathname); if (mode === 'failure') return route.abort(); if (mode === 'pending') { delayed = true; await gate; } }
    return route.continue();
  });
  await context.addInitScript(profile => { localStorage.setItem('gg-me', profile); }, profile);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE.WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text())) errors.push(message.text()); });
  await page.goto(url + '/__knight-test');
  return {page, context, requests, errors, release, isDelayed: () => delayed};
}
async function build(page, two = false) {
  return page.evaluate(async two => {
    await (await import('/js/core/data.js')).load();
    const T = await import('/js/vendor/three/three.module.min.js'), {createNPC} = await import('/js/views/realm-npcs.js');
    const scene = new T.Scene(); scene.background = new T.Color(0xe6dfcc);
    const camera = new T.PerspectiveCamera(36, 1, .01, 100); camera.position.set(3.3, 2.2, 4.1); camera.lookAt(0, .95, 0);
    const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true}); renderer.setSize(800, 800); renderer.setPixelRatio(1);
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02; document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight(0xfff4dc, 0x6b7c78, 2.1));
    const light = new T.DirectionalLight(0xfff5de, 3.2); light.position.set(-3, 6, 5); scene.add(light);
    const {RoomEnvironment} = await import('/js/vendor/three/RoomEnvironment.js'); const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(); const env = pmrem.fromScene(room, .04); scene.environment = env.texture; room.dispose(); pmrem.dispose();
    const floor = new T.Mesh(new T.CircleGeometry(3, 60), new T.MeshStandardMaterial({color: 0x779676, roughness: 1})); floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; scene.add(floor);
    let changes = 0;
    const make = () => createNPC(T, 'knight', {level: 4, house: {pri: 0x8c2639}, onChange: () => { changes++; renderer.render(scene, camera); }});
    const first = make(), second = two ? make() : null; if (first) { scene.add(first.root); first.pose(0, {face: Math.PI / 2, still: true}); } if (second) { second.root.position.x = 2; scene.add(second.root); second.pose(0, {face: Math.PI / 2, still: true}); }
    renderer.render(scene, camera);
    window.__knightTest = {T, scene, camera, renderer, first, second, get changes() { return changes; }, env};
    return {created: !!first, fallback: first ? first.root.children[0].children.every(x => x.visible) : false};
  }, two);
}
async function main() {
  fs.mkdirSync(output, {recursive: true}); const host = await server(), url = 'http://127.0.0.1:' + host.address().port;
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    const live = await isolated(browser, url);
    try {
      assert.deepEqual(await build(live.page, true), {created: true, fallback: true});
      await live.page.waitForFunction(() => window.__knightTest.first.root.getObjectByName('bulky-knight-model') && window.__knightTest.second.root.getObjectByName('bulky-knight-model'));
      const stats = await live.page.evaluate(() => {
        const s = window.__knightTest, a = s.first.root.getObjectByName('bulky-knight-model'), b = s.second.root.getObjectByName('bulky-knight-model');
        s.scene.updateMatrixWorld(true); const bounds = new s.T.Box3().setFromObject(a), size = bounds.getSize(new s.T.Vector3());
        const meshes = [], other = []; a.traverse(o => { if (o.isMesh) meshes.push(o); }); b.traverse(o => { if (o.isMesh) other.push(o); });
        const resources = new Set(); for (const m of meshes) { resources.add(m.geometry); for (const material of Array.isArray(m.material) ? m.material : [m.material]) { resources.add(material); for (const value of Object.values(material)) if (value?.isTexture) resources.add(value); } }
        s.disposals = 0; for (const r of resources) r.addEventListener('dispose', () => s.disposals++); s.resourceCount = resources.size;
        s.second.root.visible = false;
        return {size: size.toArray(), minY: bounds.min.y, meshes: meshes.map(m => m.name), shared: meshes.every((m, i) => m.geometry === other[i].geometry && m.material === other[i].material), changes: s.changes, resources: resources.size};
      });
      assert(Math.abs(stats.size[1] - 1.68) < .001, 'Hero body normalizes to 1.68 world units'); assert(Math.abs(stats.minY) < .001, 'Feet stand on the ground'); assert(stats.shared, 'Two heroes share immutable model assets'); assert.equal(live.requests.length, 1, 'Concurrent hero creation fetches one model');
      const views = {front: [0, 1.1, 5], back: [0, 1.1, -5], quarter: [3.3, 2.2, 4.1], left: [-4.2, 1.4, 2.2]};
      for (const [name, position] of Object.entries(views)) { await live.page.evaluate(position => { const s = window.__knightTest; s.camera.position.fromArray(position); s.camera.lookAt(0, .95, 0); s.renderer.render(s.scene, s.camera); }, position); await live.page.screenshot({path: path.join(output, 'knight-model-' + name + '.png')}); }
      const sharing = await live.page.evaluate(() => { const s = window.__knightTest; s.first.dispose(); const afterFirst = s.disposals; s.second.root.visible = true; s.second.root.position.x = 0; s.second.pose(.3, {face: Math.PI / 2, moving: true, attack: .7}); s.renderer.render(s.scene, s.camera); const stillPresent = !!s.second.root.getObjectByName('bulky-knight-model'); s.second.dispose(); return {afterFirst, afterLast: s.disposals, resources: s.resourceCount, stillPresent}; });
      assert.equal(sharing.afterFirst, 0, 'Removing one hero does not dispose shared model resources'); assert(sharing.stillPresent); assert.equal(sharing.afterLast, sharing.resources, 'Last hero disposes shared resources exactly once'); assert.deepEqual(live.errors, []); console.log('PASS: imported model, authored materials, +Z/front previews, normalized scale, one fetch, shared resources and final cleanup', stats);
    } finally { await live.context.close(); }
    for (const mode of ['failure', 'pending', 'nonowner']) {
      const test = await isolated(browser, url, mode === 'nonowner' ? 'mason' : 'evan', mode);
      try {
        const initial = await build(test.page);
        if (mode === 'nonowner') { assert.equal(initial.created, false); assert.equal(test.requests.length, 0); }
        else if (mode === 'failure') { await test.page.waitForTimeout(300); assert.equal(await test.page.evaluate(() => !!window.__knightTest.first.root.getObjectByName('bulky-knight-model')), false); assert(initial.fallback); }
        else { for (let tries = 0; tries < 50 && !test.isDelayed(); tries++) await test.page.waitForTimeout(20); assert(test.isDelayed(), 'Model request is pending'); await test.page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason')); test.release(); await test.page.waitForResponse(response => response.url().endsWith('knight.glb')); await test.page.waitForTimeout(500); assert.equal(await test.page.evaluate(() => !!window.__knightTest.first.root.getObjectByName('bulky-knight-model')), false); }
        assert.deepEqual(test.errors, []); console.log('PASS: knight model ' + mode);
      } finally { test.release(); await test.context.close(); }
    }
  } finally { await browser.close(); await new Promise(resolve => host.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });