#!/usr/bin/env node
// Offline gameplay, scope and mobile render checks; never posts a score.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'output/return-motion');
const baseline = process.env.RETURN_MOTION_BASELINE || '93d3d2e';
const origin = 'http://127.0.0.1:8765';
let playwright;
try { playwright = require('playwright'); } catch (_) { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2'};
async function main() {
  fs.mkdirSync(output, {recursive: true});
  const browser = await playwright.chromium.launch({channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader']});
  const errors = [], external = [], report = {};
  try {
    const context = await browser.newContext({viewport: {width: 430, height: 820}, serviceWorkers: 'block'});
    const page = await context.newPage();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.href); return route.abort(); }
      if (url.pathname === '/check') return route.fulfill({contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/css/views/return.css"><style>body{margin:0;background:#112333;font-family:system-ui;color:white}.rm-pane{width:430px}.rm-stage{height:820px!important;max-height:none!important}.rm-card{display:none!important}</style><main class="rm-pane"></main>'});
      if (url.pathname === '/js/app.js') return route.fulfill({contentType: 'text/javascript', body: 'export const APP_VERSION="offline-check", installEvent=null; export async function promptInstall(){return false;}'});
      try {
        let body;
        if (url.pathname === '/js/core/return-baseline.js') body = execFileSync('git', ['show', `${baseline}:js/core/return.js`], {cwd: root});
        else {
          const file = path.resolve(root, '.' + decodeURIComponent(url.pathname)), rel = path.relative(root, file);
          assert(!rel.startsWith('..') && !path.isAbsolute(rel));
          body = fs.readFileSync(file);
          if (url.pathname === '/js/views/return.js') body += '\nexport {runner3, runnerAnim, draw, patchHud, frame};';
          if (url.pathname === '/js/views/return-3d.js') body += '\nexport {GL};';
        }
        return route.fulfill({contentType: mime[path.extname(url.pathname)] || 'application/octet-stream', body});
      } catch (e) { errors.push(e.message); return route.fulfill({status: 404, body: e.message}); }
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { window.requestIdleCallback = () => 1; window.cancelIdleCallback = () => {}; });
    await page.goto(origin + '/check');
    report.gameplay = await page.evaluate(async () => {
      const [D, R, old, V, D3] = await Promise.all([import('/js/core/data.js'), import('/js/core/return.js'), import('/js/core/return-baseline.js'), import('/js/views/return.js'), import('/js/views/return-3d.js')]);
      await D.load();
      window.qa = {D, R, V, D3};
      const results = [], ok = (b, s) => { if (!b) throw new Error(s); }, eq = (a, b, s) => ok(JSON.stringify(a) === JSON.stringify(b), s);
      const test = (name, fn) => { fn(); results.push(name); };
      const tick = (r, seconds, dt = 1 / 60) => { const e = []; for (let t = 0; t < seconds - 1e-7 && !r.over; t += dt) e.push(...R.step(r, dt)); return e; };
      function empty() {
        D.setMe('evan'); const r = R.startRun(70001, 0, true, false, true);
        r.co = {...r.co, rows: [], sets: [], items: [], traffic: [], z: 1e9, done: 1e9}; r.t = 10;
        return r;
      }
      function train(r, lane = 1, d = 1) {
        const p = {i: 'test', lane, kind: 'express', z0: r.z + d, z1: r.z + d + R.TRAFFIC.length, h: R.TRAFFIC.height, b: 0, ramp: 0, hi: true};
        r.trains.push(p); return p;
      }
      function pickup(r) { r.co.items = [{i: 0, kind: 'jetpack', lane: 1, z: r.z + .01}]; return tick(r, .02); }
      test('Other member, app user, guest name and unselected courses/movement match deployed baseline', () => {
        for (const profile of ['ben', 'Ryan Stewart', 'Evan Appenzeller', null]) {
          D.setMe(profile === 'ben' ? 'ben' : 'none'); D.setGuest(profile === 'ben' ? null : profile);
          for (const n of [1, 16, 500]) {
            const a = R.fill(R.course(n, 0, true, true), 3000), b = old.fill(old.course(n, 0, true), 3000);
            ok(!a.enhanced && !a.traffic && !a.items.some(i => i.kind === 'jetpack'), 'no new gameplay outside owner profile');
            eq(a, b, 'same complete course');
          }
          const a = R.startRun(12, 0, true, false, true), b = old.startRun(12, 0, true, false);
          for (let i = 0; i < 300; i++) {
            if (i % 40 === 0) { R.move(a, 'up'); old.move(b, 'up'); }
            eq(R.step(a, 1 / 60), old.step(b, 1 / 60), 'same events');
            eq([a.z, a.y, a.steps, a.yards, a.over], [b.z, b.y, b.steps, b.yards, b.over], 'same motion');
          }
        }
      });
      D.setGuest(null); D.setMe('evan');
      test('Owner stride covers more ground per cycle and remains capped under salts', () => {
        const a = empty(), b = empty(); b.co.enhanced = false; a.burst = b.burst = 10;
        tick(a, 1); tick(b, 1); ok(a.z === b.z && a.yards === b.yards, 'score and forward speed unchanged');
        ok(a.steps < b.steps * .7 && R.strideRate(100) === 10.5, 'slower legs and bounded cadence');
        const st = {run: a, mode: 'run'}; a.steps = 1.25;
        ok(V.runner3(st, 10000).lift > .16, 'springy visible lift');
      });
      test('Train corridors always leave an open lane and have no stationary blockers', () => {
        for (let n = 1; n <= 30; n++) {
          const c = R.fill(R.course(n, 0, true, true), 6000);
          ok(c.traffic.length > 8, 'repeated incoming encounters');
          ok(c.items[0].kind === 'jetpack', 'early jetpack');
          for (const p of c.items.filter(p => p.kind === 'jetpack')) ok(!p.top && R.groundAt(c, p.lane, p.z) === 0, 'jetpacks reachable on the road');
          for (const t of c.traffic) {
            ok(t.lanes.length < 3, 'escape lane');
            ok(!c.rows.some(r => r.z >= t.trigger && r.z < t.trigger + 107.99), 'no rows inside encounter');
            ok(!c.sets.some(s => s.ze > t.trigger && s.zs < t.trigger + 107.99), 'no parked vehicles inside encounter');
          }
        }
      });
      test('Incoming trains advance, crash head-on, and can be dodged', () => {
        const a = empty(); const p = train(a, 1, 5), start = p.z0; tick(a, .1); ok(p.z0 < start, 'object travels toward player');
        const events = tick(a, 1); ok(a.over && events.some(e => e.type === 'crashed'), 'head-on crash');
        const b = empty(); train(b, 1, 12); R.move(b, 'left'); tick(b, 2); ok(!b.over && b.lane === 0, 'lane dodge');
        const c = empty(); train(c, 0, -2); ok(!R.move(c, 'left'), 'cannot juke through train side');
        c.salts = 1; tick(c, .02); ok(!c.over, 'existing side-hit revival rules');
      });
      test('Trains respect pills and salts without repeated impacts', () => {
        const a = empty(); train(a); a.salts = 1; const ev = tick(a, 2);
        ok(!a.over && a.salts === 0 && ev.filter(e => e.type === 'revived').length === 1, 'one salts revival for one train');
        const b = empty(); train(b); b.pills = 6; tick(b, 2); ok(!b.over && b.hits === 0, 'painkillers protect');
      });
      test('Jetpack pickup, ascent, steering, collision protection and safe expiry', () => {
        const a = empty(); ok(pickup(a).some(e => e.type === 'pickup'), 'collected');
        tick(a, 1); ok(a.y > 6 && R.flying(a), 'above all obstacles');
        const spec = V.runner3({run: a, mode: 'run'}, 10000); ok(spec.jetpack && spec.move === 'idle', 'flying pose');
        ok(!R.move(a, 'down') && !R.move(a, 'up'), 'vertical swipes cannot cancel flight');
        ok(R.move(a, 'right'), 'steering'); tick(a, .2); ok(a.lane === 2, 'changed lane');
        train(a, 2); tick(a, 2); ok(!a.over && a.y > 6, 'clears train');
        const phase = a.steps; tick(a, .5); ok(a.steps === phase, 'legs stop cycling in flight');
        const events = tick(a, 4.4); ok(!a.over && a.jetpack === 0 && a.y < .02 && events.some(e => e.type === 'jetlanded'), 'safe automatic landing');
        ok(a.landing > 0, 'short landing buffer'); tick(a, 1); train(a, 2); tick(a, 1); ok(a.over, 'protection expires');
      });
      test('Flight handles simultaneous booze, salts and landing on a roof', () => {
        const a = empty(); a.booze = 8; a.burst = 10; pickup(a); tick(a, 6.8);
        const z = a.z; a.co.sets = [{i: 0, zs: z, ze: z + 100, plats: [{lane: 1, kind: 'teambus', z0: z, z1: z + 100, h: 3, b: 0, ramp: 0, hi: true}]}];
        tick(a, 1.2); ok(!a.over && Math.abs(a.y - 3) < .05 && a.yards > a.z, 'roof landing and double yards');
      });
      test('Traffic state belongs to each run and simulation is frame-rate independent', () => {
        const a = empty(), b = empty(); a.co.traffic = b.co.traffic = [{i: 0, trigger: 0, lanes: [0]}];
        tick(a, 2, 1 / 30); tick(b, 2, 1 / 120);
        ok(Math.abs(a.z - b.z) < .001 && Math.abs(a.trains[0].z0 - b.trains[0].z0) < .001, 'equal time equal movement');
        ok(a.trains[0] !== b.trains[0], 'independent train objects');
        const before = JSON.stringify(a); R.step(a, 0); eq(JSON.stringify(a), before, 'paused state does not advance');
      });
      test('Changing profile terminates an enhanced run', () => {
        const a = empty(); pickup(a); D.setMe('ben'); R.step(a, .1); ok(a.over && a.why === 'stopped' && !R.flying(a), 'no owner flight on other profile'); D.setMe('evan');
      });
      return results;
    });
    console.log(report.gameplay.map(x => 'PASS ' + x).join('\n'));
    await page.evaluate(async () => {
      const {D, R, V, D3} = window.qa; D.setMe('evan');
      if (!await D3.load()) throw new Error('3D player failed to load');
      const el = document.querySelector('main'); el.innerHTML = V.render({});
      const cv = el.querySelector('[data-rm-cv]'), fx = el.querySelector('[data-rm-fx]');
      cv.width = fx.width = 430; cv.height = fx.height = 820; cv.style.height = '820px';
      const run = R.startRun(98999, 0, true, false, true);
      run.co = {...run.co, order: [2], rows: [], sets: [], items: [], traffic: [], z: 1e9, done: 1e9};
      run.z = run.yards = 200; run.t = 12; run.steps = 1.25;
      run.trains = [{i: 'visual', lane: 2, kind: 'express', part: 0, z0: 211, z1: 231, h: R.TRAFFIC.height, b: 0, ramp: 0, hi: true}];
      const st = {el, cv, fx, c2: cv.getContext('2d'), c3: fx.getContext('2d'), layers: el.querySelector('[data-rm-layers]'), glHost: el.querySelector('[data-rm-gl]'), ctx: {visible: true},
        run, co: run.co, n: run.n, day: {best: 0}, mode: 'run', W: 430, H: 820, dpr: 1, f: 451.5, y0: 230, camH0: 4.4, back: 7,
        dt: 1 / 60, got: new Set(), knocked: new Map(), coinGot: new Set(), sparks: [], trafficUntil: 15, trafficLane: 'SWIPE TO DODGE'};
      window.qa.st = st;
      window.qa.render = () => { V.draw(st, 12000); V.patchHud(st); };
      window.qa.render();
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { for (let i = 0; i < 12; i++) window.qa.render(); });
    await page.screenshot({path: path.join(output, 'incoming-train.png')});
    report.render = await page.evaluate(() => {
      const {st, R, V, D3} = window.qa;
      const start = D3.GL.players.us.root.position.y;
      st.run.jetpack = 5; st.run.jetAge = 3; st.run.y = R.JETPACK.height;
      for (let i = 0; i < 120; i++) window.qa.render();
      const p = D3.GL.players.us;
      if (!p.jetpack?.visible || !st.el.querySelector('.is-jetpack') || !Number.isFinite(p.root.position.y)) throw new Error('Flight visual missing');
      return {bounce: start, packVisible: p.jetpack.visible, flightY: p.root.position.y, cameraY: st.camH, hud: st.el.querySelector('[data-rm-flight-note]').textContent};
    });
    await page.screenshot({path: path.join(output, 'jetpack-flight.png')});
    // Exercise the actual full 2D fallback with the same run and controls.
    await page.evaluate(async () => {
      const {st, V} = window.qa;
      await (await import('/js/views/drill-sprites.js')).load();
      st.flat = true; st.run.co.items = [{i: 99, lane: 0, z: st.run.z + 12, kind: 'jetpack'}];
      V.draw(st, 12000);
      const c = st.c2;
      if (!c.getImageData(0, 0, 430, 820).data.some((v, i) => i % 4 === 3 && v)) throw new Error('2D fallback empty');
    });
    await page.screenshot({path: path.join(output, 'fallback-gear.png')});
    await page.evaluate(() => {
      const {R, V} = window.qa; R.setTest(true);
      const el = document.querySelector('main'), ctx = {visible: true, timer: () => () => {}};
      window.qa.ctx = ctx; V.mount(el, ctx);
    });
    await page.waitForFunction(() => document.querySelector('[data-rm-cv]').__rm.mode === 'run');
    await page.evaluate(() => {
      const {R} = window.qa, st = document.querySelector('[data-rm-cv]').__rm, r = st.run;
      r.co = {...r.co, rows: [], sets: [], items: [{i: 0, z: r.z + .1, lane: 1, kind: 'jetpack'}], traffic: [], z: 1e9, done: 1e9};
      r.next = r.nextItem = r.nextCone = 0;
      window.qa.mounted = st;
    });
    await page.waitForFunction(() => window.qa.R.flying(window.qa.mounted.run));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.qa.mounted.run.lane === 2 && window.qa.mounted.run.jt === 1);
    await page.locator('[data-rm-stage]').dispatchEvent('pointerdown', {pointerId: 1, isPrimary: true, button: 0, clientX: 270, clientY: 600});
    await page.locator('[data-rm-stage]').dispatchEvent('pointermove', {pointerId: 1, isPrimary: true, clientX: 180, clientY: 600});
    await page.locator('[data-rm-stage]').dispatchEvent('pointerup', {pointerId: 1, isPrimary: true, clientX: 180, clientY: 600});
    await page.waitForFunction(() => window.qa.mounted.run.lane === 1);
    await page.evaluate(() => { window.qa.ctx.visible = false; });
    await page.waitForFunction(() => window.qa.mounted.mode === 'paused');
    const paused = await page.evaluate(() => [window.qa.mounted.run.t, window.qa.mounted.run.jetpack]);
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => [window.qa.mounted.run.t, window.qa.mounted.run.jetpack]), paused, 'pause freezes fuel and movement');
    await page.evaluate(() => { window.qa.ctx.visible = true; });
    await page.locator('[data-rm-resume]').evaluate(b => b.click());
    await page.waitForFunction(() => window.qa.mounted.mode === 'run');
    await page.evaluate(() => { window.qa.D.setMe('ben'); });
    assert(await page.evaluate(() => window.qa.mounted.run.over && !document.querySelector('.is-jetpack')), 'live profile change stops flight and removes HUD');
    await page.evaluate(() => { window.qa.V.unmount(document.querySelector('main'), window.qa.ctx); });
    report.input = 'Keyboard, pointer swipe, pause/resume and live profile change passed';
    console.log('PASS ' + report.input);
    assert.deepEqual(external, [], 'no network/score posting'); assert.deepEqual(errors, [], 'no runtime errors');
    report.passed = true; console.log('PASS mobile 3D train, flight, HUD and 2D fallback render');
  } finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({...report, errors, external}, null, 2)); await browser.close(); }
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
