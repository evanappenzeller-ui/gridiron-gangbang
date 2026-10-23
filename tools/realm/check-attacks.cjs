// Isolated Keepfall raid-art regression tests. Production traffic and remote writes are disabled.
// Usage: node tools/realm/check-attacks.cjs [--url=http://127.0.0.1:4179]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../output');
const ART = '/img/realm/army/attacks-v1/';
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};

async function localServer() {
  const server = http.createServer((req, res) => {
    let file;
    try { const url = new URL(req.url, 'http://127.0.0.1'); file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => {
      if (error) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      if (req.method === 'HEAD') res.end(); else res.end(bytes);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}
function playwright() {
  try { return require('playwright'); }
  catch (_) { return require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
}
async function isolatedPage(browser, url, profile, viewport = {width: 1200, height: 900}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, serviceWorkers: 'block'});
  await context.route('**/*', route => {
    const target = new URL(route.request().url());
    return target.origin === new URL(url).origin || ['data:', 'blob:'].includes(target.protocol) ? route.continue() : route.abort();
  });
  await context.addInitScript(profile => {
    localStorage.setItem('gg-me', profile); localStorage.setItem('gg-welcome', '1');
    localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '2');
    sessionStorage.setItem('gg-skip-title', '1');
  }, profile);
  const page = await context.newPage(), errors = [], loads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE\.WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (request.url().includes(ART)) loads.push(request.url()); });
  await page.goto(url + '/#/puzzles');
  await page.waitForFunction(() => window.__ggBooted);
  assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Tests cannot write remote saves');
  return {page, context, errors, loads};
}
async function frames(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function assertClean(test, label) { assert.deepEqual(test.errors, [], label + ': no page or shader errors'); }

async function nonOwnerChecks(browser, url) {
  for (const profile of ['mason', 'none']) {
    const test = await isolatedPage(browser, url, profile);
    try {
      const result = await test.page.evaluate(async () => {
        const T = await import('/js/vendor/three/three.module.min.js'), {createRaidAttacks} = await import('/js/views/realm-attack-art.js');
        const scene = new T.Scene(), attacks = createRaidAttacks(T, scene, {camera: new T.PerspectiveCamera(), pitch: Math.asin(.54)});
        const loaded = await attacks.load();
        attacks.update({t: 1, tr: [], shots: [], defenders: []}, 1);
        const result = {loaded, ready: attacks.ready(), sheet: !!attacks.sheet('footman'), children: scene.children.length};
        attacks.dispose(); return result;
      });
      assert.deepEqual(result, {loaded: false, ready: false, sheet: false, children: 0}, profile + ': direct artwork API stays inactive');
      await test.page.evaluate(async () => (await import('/js/app.js')).nav('/realm'));
      assert.equal(await test.page.locator('.rl-home canvas, .rlr').count(), 0, profile + ': no owner raid view mounts');
      assert.deepEqual(test.loads, [], profile + ': no attack artwork requests');
      await assertClean(test, profile);
    } finally { await test.context.close(); }
  }
  console.log('PASS: member and unselected profiles cannot mount raids or request new attack artwork');
}

async function moduleChecks(test) {
  const result = await test.page.evaluate(async () => {
    const T = await import('/js/vendor/three/three.module.min.js');
    const {createRaidAttacks} = await import('/js/views/realm-attack-art.js');
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1, .1, 100);
    camera.position.set(12, 12, 16); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const attacks = createRaidAttacks(T, scene, {camera}), loaded = await attacks.load();
    const sheetKinds = ['footman', 'knight', 'archer', 'dragon', 'effects'];
    const sheets = sheetKinds.map(k => attacks.sheet(k));
    const validSheets = sheets.every(s => s && s.texture.image.width > 0 && s.cols > 1 && s.rows > 1);
    const unit = (id, t, x, y, hitAt = 1) => ({id, t, x, y, hitAt, face: Math.PI, dead: false, hp: 100, max: 100, cd: .9});
    const units = [unit(1, 'footman', 25, 23), unit(2, 'footman', 25, 25, .8), unit(3, 'knight', 23, 25), unit(4, 'hero_knight', 22, 26)];
    const shot = (k, from, x0, y0) => ({k, from, x0, y0, x1: 22, y1: 22, t0: 1, t1: 1.3, d: 10, b: 1, foe: false});
    const shots = [shot('archer', 5, 27, 22), shot('dragon', 6, 27, 25), shot('hero_wizard', 7, 24, 27)];
    units.push(unit(5, 'archer', 27, 22), unit(6, 'dragon', 27, 25), unit(7, 'hero_wizard', 24, 27));
    const B = {t: 1.1, tr: units, defenders: [], shots, step: 11};
    const original = JSON.stringify(B);
    const mesh = () => scene.getObjectByName('realm-raid-attack-effects');
    const counts = () => ({...mesh().userData.counts});
    attacks.update(B, .95);
    const future = counts();
    attacks.update(B, 1.04);
    const independentFrames = [attacks.frame(units[0], 1.04), attacks.frame(units[1], 1.04)];
    const releaseFrames = ['footman', 'knight', 'archer', 'dragon'].map(t => attacks.frame(unit(8, t, 25, 25), 1));
    attacks.update(B, 1.12);
    const all = counts(), unchanged = JSON.stringify(B) === original;
    const handled = ['archer', 'dragon', 'hero_wizard', 'tower', 'cannon'].map(k => attacks.handlesShot({k}));
    // Compile and draw the real effect shader; browser console collection catches GLSL failures.
    const renderer = new T.WebGLRenderer({alpha: true, preserveDrawingBuffer: true});
    renderer.setSize(512, 512); renderer.render(scene, camera);
    const programCount = renderer.info.programs.length;
    B.shots = []; B.t = 1.4;
    attacks.update(B, 1.27);
    const retained = counts();
    attacks.update(B, 1.35);
    const landed = counts();
    attacks.update(B, 1.6);
    const expired = mesh().count;
    B.shots = shots; attacks.restart(B); attacks.update(B, 1.12);
    const replay = counts();
    const textureUUIDs = sheets.map(s => s.texture.uuid);
    attacks.restart(B);
    const restart = mesh().count === 0 && sheets.every((s, i) => s.texture.uuid === textureUUIDs[i]);
    let released = 0;
    sheets.forEach(s => s.texture.addEventListener('dispose', () => released++));
    const effectMesh = mesh(); let meshReleased = false;
    effectMesh.addEventListener('dispose', () => { meshReleased = true; });
    attacks.dispose(); attacks.dispose();
    const disposed = scene.children.length === 0 && released === 5 && meshReleased && !attacks.ready() && !attacks.handlesShot(shots[0]);
    renderer.dispose(); renderer.forceContextLoss();
    return {loaded, validSheets, future, independentFrames, releaseFrames, all, unchanged, handled, programCount, retained, landed, expired, replay, restart, disposed};
  });
  assert(result.loaded && result.validSheets, 'Owner loads all four troop sheets and effect atlas');
  assert.equal(result.future.arrow + result.future.dragon + result.future.fireball, 0, 'Future simulation shots never release early');
  assert.notEqual(result.independentFrames[0], result.independentFrames[1], 'Two same-kind soldiers keep independent attack poses');
  assert.deepEqual(result.releaseFrames, [2, 2, 3, 2], 'Each unit releases on its manifest-authored contact frame');
  assert(result.all.sword >= 3 && result.all.arrow === 1 && result.all.dragon === 1 && result.all.fireball === 1, 'Footmen, trained knight, hero knight, archers, dragons and wizard all show effects');
  assert(result.unchanged, 'Visual updates do not mutate combat state');
  assert.deepEqual(result.handled, [true, true, true, false, false], 'Only supported troop shots replace the existing projectiles');
  assert(result.programCount > 0, 'Effect shader compiles in WebGL');
  assert.deepEqual([result.retained.arrow, result.retained.dragon, result.retained.fireball], [1, 1, 1], 'Copied shots remain visible through landing after the simulation removes them');
  assert.deepEqual([result.landed.arrow, result.landed.dragon, result.landed.fireball], [0, 1, 1], 'Arrows end on landing; fire persists briefly at impact');
  assert.equal(result.expired, 0, 'Old effects expire');
  assert.deepEqual(result.replay, result.all, 'Restart recreates the same weapon effects at the same battle time');
  assert(result.restart && result.disposed, 'Replay keeps GPU assets; final disposal releases them once');
  await assertClean(test, 'Attack module');
  console.log('PASS: independent poses, authored releases, every weapon effect, real shader, landing retention, replay and GPU cleanup');
}

async function profileChecks(browser, url) {
  for (const mode of ['same-tab', 'cross-tab-clear', 'pending-load']) {
    const test = await isolatedPage(browser, url, 'evan');
    let release, firstImage;
    const requested = new Promise(resolve => { firstImage = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    if (mode === 'pending-load') await test.context.route('**/attacks-v1/*.webp', async route => { firstImage(); await gate; await route.continue(); });
    try {
      await test.page.evaluate(async () => {
        const T = await import('/js/vendor/three/three.module.min.js'), {createRaidAttacks} = await import('/js/views/realm-attack-art.js');
        const scene = new T.Scene(), attacks = createRaidAttacks(T, scene, {camera: new T.PerspectiveCamera()});
        window.__profileAttack = {scene, attacks, load: attacks.load()};
      });
      if (mode === 'pending-load') await requested;
      else assert(await test.page.evaluate(() => window.__profileAttack.load), 'Profile test initially loads artwork');
      if (mode === 'cross-tab-clear') {
        const second = await test.context.newPage();
        await second.goto(url + '/data/league.json'); await second.evaluate(() => localStorage.clear());
        await test.page.waitForFunction(() => !window.__profileAttack.attacks.ready() && window.__profileAttack.scene.children.length === 0);
        await second.close();
      } else await test.page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
      release();
      const result = await test.page.evaluate(async () => {
        const {scene, attacks, load} = window.__profileAttack, loaded = await load;
        return {loaded, ready: attacks.ready(), children: scene.children.length, sheet: !!attacks.sheet('footman')};
      });
      assert.deepEqual({ready: result.ready, children: result.children, sheet: result.sheet}, {ready: false, children: 0, sheet: false}, mode + ': owner artwork cleared');
      if (mode === 'pending-load') assert.equal(result.loaded, false, 'Late loading cannot install owner artwork after profile switch');
      await assertClean(test, mode);
    } finally { release(); await test.context.close(); }
  }
  console.log('PASS: same-tab switch, cross-tab storage clear and in-flight image loads dispose owner artwork');
}

async function startRaid(test, blocked = false) {
  const {page} = test;
  if (blocked) await test.context.route('**/attacks-v1/**', route => route.fulfill({status: 404, body: ''}));
  await page.evaluate(async () => {
    const T = await import('/js/vendor/three/three.module.min.js');
    const add = T.Scene.prototype.add;
    window.__attackScenes = [];
    T.Scene.prototype.add = function (...objects) { if (!window.__attackScenes.includes(this)) window.__attackScenes.push(this); return add.apply(this, objects); };
    const F = await import('/js/core/realm.js'), s = F.fresh();
    s.b.find(b => b.t === 'keep').l = 8; s.ar = {footman: 6, knight: 4, archer: 4, dragon: 2}; s.hr = {knight: 2, wizard: 2};
    F._set(s); await (await import('/js/app.js')).nav('/realm/raid/bot%3A1');
  });
  await page.waitForFunction(() => document.querySelector('.rlr')?.__rl?.v && document.querySelector('.rlr')?.__rl?.B);
  if (!blocked) await page.waitForFunction(() => window.__attackScenes.some(scene => scene.getObjectByName('raid-attack-dragon')));
  await page.evaluate(() => { document.querySelector('.rlr').__rl.v.setAnim(null); });
  await frames(page);
}

async function stageRaid(page) {
  return page.evaluate(async () => {
    const F = await import('/js/core/realm.js');
    const st = document.querySelector('.rlr').__rl, B = st.B;
    const target = B.bl.find(b => b.t === 'keep');
    const unit = (id, t, x, y, hitAt = 2) => ({id, t, x, y, hp: 500, max: 500, dead: false, hitAt, cd: .8, born: 0, face: Math.atan2(target.cy - y, target.cx - x), tg: target});
    B.tr = [unit(1, 'footman', 21, 24.7), unit(2, 'footman', 19.8, 23.5, 1.8), unit(3, 'knight', 24.7, 21), unit(4, 'archer', 27, 21), unit(5, 'dragon', 28.5, 24), unit(6, 'hero_knight', 22.5, 26.7), unit(7, 'hero_wizard', 23.5, 29)];
    for (const u of B.tr.filter(u => u.t.startsWith('hero_'))) Object.assign(u, {hero: u.t.slice(5), level: 2, l: 2, stats: F.heroStat(u.t.slice(5), 2)});
    B.shots = B.tr.filter(u => ['archer', 'dragon', 'hero_wizard'].includes(u.t)).map(u => ({k: u.t, from: u.id, x0: u.x, y0: u.y, x1: target.cx, y1: target.cy, t0: 2, t1: 2.3, b: target.i, foe: false, d: 10}));
    B.t = 2.2; B.step = 22; B.defenders = [];
    st.v.look(23.7, 24.5, 36); st.v.raidFrame(2.12); st.v.want();
    return B.tr.map(u => u.t);
  });
}

async function integrationChecks(browser, url) {
  const test = await isolatedPage(browser, url, 'evan');
  try {
    await startRaid(test); await stageRaid(test.page); await frames(test.page);
    const rendered = await test.page.evaluate(() => {
      const scene = window.__attackScenes.find(s => s.getObjectByName('raid-attack-dragon'));
      window.__raidArtScene = scene;
      const troop = kind => scene.getObjectByName('raid-attack-' + kind), foot = troop('footman');
      return {counts: ['footman', 'knight', 'archer', 'dragon'].map(k => troop(k).count),
        frames: [foot.geometry.getAttribute('raidAttackFrame').getX(0), foot.geometry.getAttribute('raidAttackFrame').getX(1)],
        effects: {...scene.getObjectByName('realm-raid-attack-effects').userData.counts}};
    });
    assert.deepEqual(rendered.counts, [2, 1, 1, 1], 'Real raid renderer draws every animated troop');
    assert.notEqual(rendered.frames[0], rendered.frames[1], 'Actual instanced mesh sends different frames to two footmen');
    assert.deepEqual([rendered.effects.arrow, rendered.effects.dragon, rendered.effects.fireball], [1, 1, 1], 'All ranged effects render together in the raid');
    await test.page.screenshot({path: path.join(output, 'realm-attack-sprites-desktop.png')});
    await test.page.setViewportSize({width: 390, height: 844}); await stageRaid(test.page); await frames(test.page);
    await test.page.screenshot({path: path.join(output, 'realm-attack-sprites-mobile.png')});
    const replay = await test.page.evaluate(async () => {
      const st = document.querySelector('.rlr').__rl, scene = window.__raidArtScene, {MY_HOUSE} = await import('/js/views/realm.js');
      const foot = scene.getObjectByName('raid-attack-footman'), before = foot.uuid;
      st.B.shots = []; for (const u of st.B.tr) u.hitAt = -9;
      st.v.raidRestart(st.B, MY_HOUSE);
      const cleared = foot.count === 0 && scene.getObjectByName('realm-raid-attack-effects').count === 0;
      st.v.raidFrame(0);
      return {cleared, reused: scene.getObjectByName('raid-attack-footman').uuid === before, effects: scene.getObjectByName('realm-raid-attack-effects').count};
    });
    assert.deepEqual(replay, {cleared: true, reused: true, effects: 0}, 'Real replay restart reuses sheets and clears old effects');
    const otherTab = await test.context.newPage();
    await otherTab.goto(url + '/data/league.json');
    await otherTab.evaluate(() => localStorage.clear());
    await test.page.waitForFunction(() => !window.__raidArtScene.getObjectByName('raid-attack-footman') && !window.__raidArtScene.getObjectByName('realm-raid-attack-effects'));
    await otherTab.close();
    const disposed = await test.page.evaluate(() => !window.__raidArtScene.getObjectByName('raid-attack-footman') && !window.__raidArtScene.getObjectByName('realm-raid-attack-effects'));
    assert(disposed, 'Cross-tab storage clear disposes atlas and effect meshes in the actual raid scene');
    await assertClean(test, 'Real raid');
  } catch (error) { await test.page.screenshot({path: path.join(output, 'realm-attack-failure.png')}); throw error; }
  finally { await test.context.close(); }
  console.log('PASS: real desktop/mobile raid, independent atlas shader frames, combined weapon effects, replay and profile cleanup');

  const fallback = await isolatedPage(browser, url, 'evan');
  try {
    await startRaid(fallback, true); await stageRaid(fallback.page); await frames(fallback.page);
    const result = await fallback.page.evaluate(() => {
      const scenes = window.__attackScenes, seen = [], projectiles = [];
      for (const scene of scenes) scene.traverse(o => { if (o.isInstancedMesh && o.count && /\/army\/footman\.webp/.test(o.material?.map?.image?.src || '')) seen.push(o.count); });
      return {count: seen.reduce((a, b) => a + b, 0), atlas: scenes.some(s => s.getObjectByName('raid-attack-footman')), effects: scenes.some(s => s.getObjectByName('realm-raid-attack-effects'))};
    });
    assert.deepEqual(result, {count: 2, atlas: false, effects: false}, 'Unavailable artwork retains existing troop rendering');
    await assertClean(fallback, 'Unavailable artwork fallback');
  } finally { await fallback.context.close(); }
  console.log('PASS: unavailable attack artwork preserves existing troops and projectile fallback');
}

async function run(url) {
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname), 'Only loopback test URLs are allowed');
  fs.mkdirSync(output, {recursive: true});
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    const owner = await isolatedPage(browser, url, 'evan');
    try { await moduleChecks(owner); } finally { await owner.context.close(); }
    await profileChecks(browser, url);
    await nonOwnerChecks(browser, url);
    await integrationChecks(browser, url);
  } finally { await browser.close(); }
}
(async () => {
  const existing = process.argv.find(arg => arg.startsWith('--url='));
  const server = existing ? null : await localServer();
  try { await run(existing ? existing.slice(6).replace(/\/$/, '') : `http://127.0.0.1:${server.address().port}`); }
  finally { if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
