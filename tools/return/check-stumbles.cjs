#!/usr/bin/env node
// Offline Return Man checks: real browser modules/CSS/data, no server or Firebase.
// Run: node tools/return/check-stumbles.cjs [--suite-only | --regressions-only]
// The app shell alone is stubbed to prevent its unrelated boot through views/you.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../output/return-man/stumble-qa');
const origin = 'http://127.0.0.1:8765';
let playwright;
try { playwright = require('playwright'); } catch (_) {
  playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const mime = {'.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
function source(url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  assert.ok(!pathname.includes('\0'));
  const candidate = path.resolve(root, '.' + pathname), relative = path.relative(root, candidate);
  assert.ok(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'fixture path stays inside app');
  const file = fs.realpathSync(candidate), realRelative = path.relative(fs.realpathSync(root), file);
  assert.ok(realRelative !== '..' && !realRelative.startsWith('..' + path.sep) && !path.isAbsolute(realRelative), 'resolved fixture path stays inside app');
  return {contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file)};
}
async function launch() {
  const options = {headless: true};
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) return playwright.chromium.launch({...options, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  const failures = [];
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await playwright.chromium.launch({...options, ...(channel ? {channel} : {})}); }
    catch (error) { failures.push(`${channel || 'bundled'}: ${error.message.split('\n')[0]}`); }
  }
  throw new Error('No Chromium browser available: ' + failures.join('; '));
}
async function main() {
  fs.mkdirSync(output, {recursive: true});
  const browser = await launch();
  const errors = [], external = [], registered = [], targeted = [];
  const report = {registered, targeted, errors, external};
  try {
    const context = await browser.newContext({serviceWorkers: 'block', timezoneId: 'America/Phoenix'});
    const page = await context.newPage();
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (!url.startsWith(origin + '/')) { external.push(url); return route.abort(); }
      const pathname = new URL(url).pathname;
      if (pathname === '/__stumble_check__') return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Return Man offline checks</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/css/views/return.css">'});
      if (pathname === '/js/app.js') return route.fulfill({contentType: 'text/javascript', body: 'export const APP_VERSION="offline-check", installEvent=null; export async function promptInstall(){return false;}'});
      try { return await route.fulfill(source(url)); }
      catch (error) { errors.push(`${pathname}: ${error.message}`); return route.fulfill({status: 404, body: error.message}); }
    });
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    // Only unrelated idle warmups (search index/deep cuts/Firebase) are postponed.
    await page.addInitScript(() => { window.requestIdleCallback = () => 1; window.cancelIdleCallback = () => {}; });
    await page.goto(origin + '/__stumble_check__');
    await page.evaluate(async () => {
      const [D, daily, R, checks] = await Promise.all([import('/js/core/data.js'), import('/js/core/daily.js'), import('/js/core/return.js'), import('/js/core/checks-return.js')]);
      await D.load(); D.setMe('evan'); await daily.ensure();
      const registered = [];
      await checks.returnChecks((name, fn) => registered.push({name, fn}));
      window.stumbleCheck = {R, registered};
    });
    const names = await page.evaluate(() => window.stumbleCheck.registered.map(check => check.name));
    assert.ok(names.length >= 20, 'all registered Return Man checks loaded');
    if (!process.argv.includes('--regressions-only')) {
      for (let index = 0; index < names.length; index++) {
        const result = await page.evaluate(async index => {
          const {name, fn} = window.stumbleCheck.registered[index], started = performance.now();
          try { const result = await fn(); return {name, pass: result === true || result?.pass === true, detail: result?.detail || '', ms: Math.round(performance.now() - started)}; }
          catch (error) { return {name, pass: false, detail: error.stack || error.message, ms: Math.round(performance.now() - started)}; }
        }, index);
        registered.push(result);
        console.log(`${result.pass ? 'PASS' : 'FAIL'} registered ${index + 1}/${names.length}: ${result.name.split(':')[0]} (${result.ms} ms)${result.pass ? '' : '\n' + result.detail}`);
      }
    }
    if (!process.argv.includes('--suite-only')) targeted.push(...await page.evaluate(() => {
      const {R} = window.stumbleCheck, results = [], dt = 1 / 120;
      const require = (condition, message) => { if (!condition) throw new Error(message); };
      function field(hard = true, lane = 1) {
        const run = R.startRun(1, 0, hard);
        run.co = {n: 0, k: 0, hard, order: [0, 1, 2, 3, 4], rows: [], sets: [], items: [], r: () => 0, z: 1e9, itemAt: 1e9, done: 1e9, first: {}};
        run.t = R.CHASE.window + 1; run.lane = lane; run.x = R.xOf(run, lane);
        return run;
      }
      function rowHit(run, ob = 'hurdle') {
        const row = {i: run.co.rows.length, z: run.z + .02, lanes: [null, null, null], th: 'stadium'};
        row.lanes[run.lane] = ob; run.co.rows.push(row);
        const events = [];
        for (let i = 0; i < 120 && !run.over && run.next <= row.i; i++) events.push(...R.step(run, dt));
        return events;
      }
      function wait(run, seconds) { const events = []; for (let i = 0; i < seconds * 120 && !run.over; i++) events.push(...R.step(run, dt)); return events; }
      function first(run) { require(rowHit(run).some(e => e.type === 'stumbled') && run.hits === 1 && !run.over, 'first collision should stumble'); }
      function tackled(run, events) { require(run.over && run.why === 'caught' && events.some(e => e.type === 'tackled'), 'distinct second collision should tackle'); }
      function test(name, fn) { try { results.push({name, pass: true, detail: fn() || 'ok'}); } catch (error) { results.push({name, pass: false, detail: error.message}); } }
      test('Owner: second obstacle tackles after a long clean stretch', () => {
        const r = field(); first(r); wait(r, R.CHASE.window + R.CHASE.drop + 1);
        require(R.chasing(r) && R.gapOf(r) <= R.CHASE.edge, 'linebacker should stay on your heels'); const gap = R.gapOf(r), events = rowHit(r, 'bar'); tackled(r, events);
        return `gap before second hit ${gap}; ${events.map(e => e.type).join(', ')}`;
      });
      test('Owner: distinct second obstacle inside grace tackles', () => {
        const r = field(); first(r); const grace = r.grace; require(grace > 0, 'inside grace'); tackled(r, rowHit(r, 'bar'));
        return `second obstacle within ${grace.toFixed(3)}s grace`;
      });
      test('Regular course: spaced collisions remain two stumbles', () => {
        const r = field(false); first(r); wait(r, R.CHASE.window + R.CHASE.drop + 1); const events = rowHit(r, 'bar');
        require(!r.over && r.hits === 2 && events.some(e => e.type === 'stumbled'), 'regular course changed');
      });
      test('Regular course: grace still suppresses a nearby second obstacle', () => {
        const r = field(false); first(r); const events = rowHit(r, 'bar'); require(!r.over && r.hits === 1 && events.some(e => e.type === 'shoved'), 'regular grace changed');
      });
      test('Owner: edge stumble followed by an obstacle inside grace tackles', () => {
        const r = field(true, 0); require(!R.move(r, 'left'), 'edge swipe refused'); require(R.step(r, dt).some(e => e.type === 'stumbled'), 'edge should stumble'); tackled(r, rowHit(r));
      });
      test('Owner: duplicate edge contact during grace is one stumble', () => {
        const r = field(true, 0); R.move(r, 'left'); R.step(r, dt); R.move(r, 'left'); const events = R.step(r, dt);
        require(!r.over && r.hits === 1 && events.some(e => e.type === 'shoved'), 'same edge contact counted twice');
      });
      test('Owner: vehicle side then different row inside grace tackles', () => {
        const r = field(true, 0), p = {lane: 1, kind: 'teambus', part: 0, z0: 0, z1: 50, h: R.HIGH_H, b: 0, ramp: 0, hi: true};
        r.co.sets = [{i: 0, zs: 0, ze: 50, plats: [p]}]; require(!R.move(r, 'right'), 'vehicle side refused');
        require(R.step(r, dt).some(e => e.type === 'stumbled'), 'side should stumble'); tackled(r, rowHit(r));
      });
      test('Owner: painkillers still protect against every row obstacle', () => {
        for (const ob of ['hurdle', 'bar', 'hole', 'sled']) {
          const r = field(); first(r); r.pills = 1; const events = rowHit(r, ob);
          require(!r.over && r.hits === 1 && events.some(e => e.type === 'trucked'), `${ob}: painkiller protection lost`);
        }
      });
      test('Owner: a legacy shield cannot suppress a distinct collision', () => {
        const r = field(); first(r); r.shield = R.SHIELD; tackled(r, rowHit(r, 'bar'));
      });
      test('Owner: the salts pickup burst leaves every row obstacle active', () => {
        for (const ob of ['hurdle', 'bar', 'hole', 'sled']) {
          const r = field();
          r.co.items = [{i: 0, z: .02, lane: 1, top: false, kind: 'salts'}];
          require(R.step(r, dt).some(e => e.type === 'pickup') && r.salts === 1 && r.burst > 9 && r.shield === 0, `${ob}: pickup should give speed and a stored life`);
          const events = rowHit(r, ob);
          require(events.some(e => e.type === 'stumbled') && r.hits === 1 && r.salts === 1 && !r.over, `${ob}: pickup must not protect against a stumble`);
          require(!events.some(e => e.type === 'trucked') && r.burst > 0, `${ob}: burst must not truck an obstacle`);
        }
      });
      test('Owner: salts save one collision; the immediate next obstacle tackles', () => {
        const r = field(); first(r); r.salts = 1;
        require(rowHit(r, 'bar').some(e => e.type === 'revived') && !r.over && r.salts === 0, 'salts should save the second hit');
        require(r.shield === 0 && r.burst > 9 && !r.stumblePending, 'revival should reset the penalty and give speed without a shield');
        tackled(r, rowHit(r));
      });
      test('Owner: a clean stretch after salts revival permits a fresh stumble', () => {
        const r = field(); first(r); wait(r, R.CHASE.window + R.CHASE.drop + 1); r.salts = 1;
        require(rowHit(r, 'bar').some(e => e.type === 'revived') && !r.over && r.salts === 0, 'salts should save the second hit');
        require(r.shield === 0, 'revival must not grant a shield');
        wait(r, R.CHASE.window + R.CHASE.drop + 1);
        require(rowHit(r, 'bar').some(e => e.type === 'stumbled') && !r.over, 'salts revival should reset the stumble penalty');
        tackled(r, rowHit(r));
      });
      test('Owner: two stored salts are spent on distinct consecutive collisions', () => {
        const r = field(); first(r); r.salts = 2;
        for (const remaining of [1, 0]) {
          require(rowHit(r, 'bar').some(e => e.type === 'revived') && r.salts === remaining && !r.over, 'each collision should spend one stored life');
          require(r.shield === 0, 'neither stored life should grant a shield');
        }
        tackled(r, rowHit(r, 'sled'));
      });
      test('Owner: a tall-front salts revival leaves the next edge collision active', () => {
        const r = field(true, 0), p = {lane: 0, kind: 'teambus', part: 0, z0: .02, z1: 50, h: R.HIGH_H, b: 0, ramp: 0, hi: true};
        r.co.sets = [{i: 0, zs: 0, ze: 50, plats: [p]}]; r.salts = 1;
        const saved = R.step(r, dt);
        require(saved.some(e => e.type === 'revived' && e.wall) && !r.over && r.salts === 0, 'salts should still save the tall-front collision');
        require(r.shield === 0 && r.burst > 9, 'tall-front revival should give speed without a shield');
        require(!R.move(r, 'left'), 'edge swipe should remain blocked'); tackled(r, R.step(r, dt));
      });
      test('Owner: a tall vehicle immediately after salts revival still crashes', () => {
        const r = field(); first(r); r.salts = 1;
        require(rowHit(r, 'bar').some(e => e.type === 'revived'), 'salts should revive');
        const p = {lane: 1, kind: 'teambus', part: 0, z0: r.z + .02, z1: r.z + 50, h: R.HIGH_H, b: 0, ramp: 0, hi: true};
        r.co.sets = [{i: 0, zs: r.z, ze: r.z + 50, plats: [p]}];
        const events = R.step(r, dt);
        require(r.over && r.why === 'crash' && events.some(e => e.type === 'crashed'), 'revival must not vault the next tall vehicle');
      });
      test('Owner: a vehicle side immediately after salts revival still tackles', () => {
        const r = field(true, 0); first(r); r.salts = 1;
        require(rowHit(r, 'bar').some(e => e.type === 'revived'), 'salts should revive');
        const p = {lane: 1, kind: 'teambus', part: 0, z0: 0, z1: r.z + 50, h: R.HIGH_H, b: 0, ramp: 0, hi: true};
        r.co.sets = [{i: 0, zs: 0, ze: r.z + 50, plats: [p]}];
        require(!R.move(r, 'right'), 'vehicle side should remain blocked'); tackled(r, R.step(r, dt));
      });
      test('Regular course: salts revival retains its shield and next-obstacle protection', () => {
        const r = field(false); first(r); wait(r, R.CHASE.grace + .1); r.salts = 1;
        require(rowHit(r, 'bar').some(e => e.type === 'revived') && !r.over && r.salts === 0 && r.shield > 0, 'regular revival shield changed');
        require(rowHit(r).some(e => e.type === 'trucked') && !r.over, 'regular shield should still protect the next obstacle');
      });
      test('Owner: repeated vehicle contact is one stumble; a different vehicle tackles', () => {
        const r = field(true, 0), p = {lane: 1, kind: 'citybus', part: 0, z0: 0, z1: 50, h: R.HIGH_H, b: 0, ramp: 0, hi: true};
        r.co.sets = [{i: 0, zs: 0, ze: 50, plats: [p]}];
        R.move(r, 'right'); require(R.step(r, dt).some(e => e.type === 'stumbled'), 'first bus side contact stumbles');
        R.move(r, 'right'); require(R.step(r, dt).some(e => e.type === 'shoved') && !r.over, 'same bus contact ignored during grace');
        r.co.sets[0].plats = [{...p, kind: 'teambus'}];
        R.move(r, 'right'); tackled(r, R.step(r, dt));
      });
      test('Owner: two distinct obstacles in one step(.25) tackle exactly once', () => {
        const r = field();
        r.co.rows = [.1, .2].map((z, i) => ({i, z, lanes: [null, 'hurdle', null]}));
        const events = R.step(r, .25);
        tackled(r, events);
        require(events.filter(e => e.type === 'stumbled').length === 1 && events.filter(e => e.type === 'tackled').length === 1, 'one stumble then one tackle');
      });
      test('Owner: salts cannot shield close obstacles within the same step(.25)', () => {
        const r = field(); r.salts = 1;
        r.co.rows = [.1, .2, .3].map((z, i) => ({i, z, lanes: [null, 'hurdle', null]}));
        const events = R.step(r, .25);
        tackled(r, events);
        require(events.filter(e => ['stumbled', 'revived', 'trucked', 'tackled'].includes(e.type)).map(e => e.type).join(',') === 'stumbled,revived,tackled', 'one stumble, one saved collision, then one tackle');
        require(r.salts === 0 && r.shield === 0, 'same-step revival must spend the life without a shield');
      });
      return results;
    }));
    for (const result of targeted) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`);
    report.registeredCount = names.length;
    report.firebaseRequests = external.filter(url => /firebase|gstatic|googleapis/.test(url));
    assert.deepEqual(external, [], 'offline checks make no external requests');
    assert.deepEqual(errors, [], 'no browser/fixture errors');
    const failed = [...registered, ...targeted].filter(result => !result.pass);
    assert.equal(failed.length, 0, failed.map(result => `${result.name}\n${result.detail}`).join('\n\n'));
    console.log(`PASS: ${registered.length}/${names.length} registered checks executed; ${targeted.length} targeted collision checks; no external requests.`);
  } finally {
    fs.writeFileSync(path.join(output, 'stumble-checks.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
