#!/usr/bin/env node
// Offline before/after event profiling. CPU timings are diagnostic; cold shader creation and layout flushes are asserted.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'output/return-performance');
const origin = 'http://127.0.0.1:8765', baseline = '385bafd';
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2'};
async function fixture(browser, legacy) {
  const ctx = await browser.newContext({viewport: {width: 430, height: 820}, serviceWorkers: 'block'}), page = await ctx.newPage(), errors = [], cache = new Map();
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin !== origin) { errors.push('External request ' + u.href); return route.abort(); }
    if (u.pathname === '/check') return route.fulfill({contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/css/views/return.css"><style>body{margin:0}.rm-pane{width:430px}.rm-stage{height:820px!important;max-height:none!important}</style><main class="rm-pane"></main>'});
    if (u.pathname === '/js/app.js') return route.fulfill({contentType: 'text/javascript', body: 'export const APP_VERSION="test",installEvent=null,TABS=[];export const promptInstall=async()=>false;'});
    try {
      const file = decodeURIComponent(u.pathname).slice(1), local = path.resolve(root, file);
      assert(!path.relative(root, local).startsWith('..'));
      if (!cache.has(file)) cache.set(file, legacy ? execFileSync('git', ['show', baseline + ':' + file], {cwd: root, maxBuffer: 32 * 1024 * 1024}) : fs.readFileSync(local));
      let body = cache.get(file);
      if (file === 'js/views/return.js') body += '\nexport {draw,patchHud,onEvents};';
      if (file === 'js/views/return-3d.js') body += '\nexport {GL};';
      await route.fulfill({body, contentType: mime[path.extname(file)] || 'application/octet-stream'});
    } catch (e) { errors.push(e.message); await route.fulfill({status: 404, body: 'missing'}); }
  });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { requestIdleCallback = () => 1; cancelIdleCallback = () => {}; });
  await page.goto(origin + '/check');
  await page.evaluate(async legacy => {
    const [D, R, V, D3, W3] = await Promise.all([import('/js/core/data.js'), import('/js/core/return.js'), import('/js/views/return.js'), import('/js/views/return-3d.js'), import('/js/views/return-3dworld.js')]);
    await D.load(); D.setMe(legacy ? 'evan' : 'ben'); R.setTest(true); if (!await D3.load()) throw Error('3D load');
    const el = document.querySelector('main'); el.innerHTML = V.render({}); el.querySelector('[data-rm-card]').hidden = true;
    const cv = el.querySelector('[data-rm-cv]'), fx = el.querySelector('[data-rm-fx]'); cv.width = fx.width = 430; cv.height = fx.height = 820;
    const st = {el, cv, fx, c2: cv.getContext('2d'), c3: fx.getContext('2d'), layers: el.querySelector('[data-rm-layers]'), glHost: el.querySelector('[data-rm-gl]'), ctx: {visible: true},
      n: 88888, day: {best: 0}, mode: 'run', W: 430, H: 820, dpr: 1, f: 451.5, y0: 230, camH0: 4.4, back: 7, dt: 1 / 60, got: new Set(), knocked: new Map(), coinGot: new Set(), sparks: []};
    const reset = () => { const r = R.startRun(st.n, 0, true, false, true); r.co = {...r.co, order: [2], rows: [], items: [], sets: [], traffic: [], z: 1e9, done: 1e9}; r.t = 10; r.z = 200; st.run = r; st.co = r.co; st.mode = 'run'; st.hitAt = st.flashAt = 0; return r; };
    reset(); window.qa = {D, R, V, D3, W3, st, reset};
    for (let i = 0; i < 12; i++) V.draw(st, performance.now());
  }, legacy);
  await page.waitForFunction(() => window.qa.W3.sceneryReady('city'));
  await page.evaluate(async () => {
    const {D3, W3, V, st} = window.qa; W3.renewScenery(); for (let i = 0; i < 12; i++) V.draw(st, performance.now());
    if (D3.prepare) await D3.prepare(st);
    for (let i = 0; i < 4; i++) { V.draw(st, performance.now()); await new Promise(requestAnimationFrame); }
  });
  const result = await page.evaluate(async () => {
    const {D3, R, V, st, reset} = window.qa, gl = D3.GL.renderer.getContext(), oldCreate = gl.createProgram;
    let programs = 0, flushes = 0, uploads = 0; gl.createProgram = function(...a) { programs++; return oldCreate.apply(this, a); };
    for (const name of ['texImage2D', 'texSubImage2D']) { const old = gl[name]; gl[name] = function(...a) { uploads++; return old.apply(this, a); }; }
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, get() { flushes++; return width.get.call(this); }});
    const report = {};
    for (const kind of ['collision', 'pills', 'booze', 'salts', 'jetpack']) {
      const r = reset(); V.draw(st, performance.now()); V.patchHud(st); const before = {programs, flushes, uploads};
      if (kind === 'collision') r.co.rows = [{i: 0, z: r.z + .01, lanes: [null, 'hurdle', null]}];
      else r.co.items = [{i: 0, z: r.z + .01, lane: 1, kind}];
      const times = [], events = [];
      for (let i = 0; i < 12; i++) {
        const start = performance.now(), e = R.step(r, 1 / 60); events.push(...e.map(x => x.type));
        V.onEvents(st, e); V.draw(st, performance.now()); V.patchHud(st); times.push(performance.now() - start);
        await new Promise(requestAnimationFrame);
      }
      report[kind] = {programs: programs - before.programs, textureUploads: uploads - before.uploads, layoutReads: flushes - before.flushes, firstMs: +times[0].toFixed(2), maxMs: +Math.max(...times).toFixed(2), events};
    }
    return report;
  });
  assert.deepEqual(errors, [], 'no browser errors'); await ctx.close(); return result;
}
(async () => {
  fs.mkdirSync(output, {recursive: true}); const browser = await pw.chromium.launch({channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader']});
  try {
    const report = {baseline: await fixture(browser, true), current: await fixture(browser, false)};
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    for (const kind of Object.keys(report.current)) {
      const a = report.baseline[kind], b = report.current[kind]; console.log(`${kind}: cold shaders ${a.programs} -> ${b.programs}; textures ${a.textureUploads} -> ${b.textureUploads}; forced layout reads ${a.layoutReads} -> ${b.layoutReads}; first frame ${a.firstMs} -> ${b.firstMs} ms (software GPU)`);
      assert.equal(b.layoutReads, 0, kind + ': no forced layout during event');
      assert.equal(b.programs, 0, kind + ': no cold shaders during event');
    }
    console.log('PASS pickup and stumble paths use prepared graphics without synchronous layout reads.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
