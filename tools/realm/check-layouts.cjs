// Keepfall's base layouts (core/realm-layout.js, views/realm.js layoutSheet): every Castle level's layout fits the lot
// with nothing overlapping; sorting moves buildings only (ids, levels, timers, everything else kept), puts back with
// Undo, and works for the owner, a member and a guest from Buildings › Base layouts. Local only: no production requests.
// Usage: node tools/realm/check-layouts.cjs [--shots] [--only=evan|mason|guest]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary'};

function server() {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(bytes);
    });
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(s)));
}

// (in the page: the rules, on every Castle level's full base and on a realm with its buildings anywhere)
async function rules() {
  const F = await import('/js/core/realm.js'), L = await import('/js/core/realm-layout.js');
  const clear = s => {
    const laid = {b: []};
    return s.b.every(b => { const ok = F.fits(laid, F.KINDS[b.t].size, b.x, b.y); laid.b.push(b); return ok; });
  };
  const out = [];
  for (let th = 1; th <= F.MAX_KEEP; th++) {
    const full = L.fullAt(th), want = Object.values(F.COUNT).reduce((n, c) => n + (c[th - 1] || 0), 0);
    const keep = full.b.find(b => b.t === 'keep');
    out.push({th, ok: full.b.length === want && clear(full) && keep.x === F.N / 2 - 2 && keep.y === F.N / 2 - 2 && L.sorted(full, th)});
    // a realm built up anywhere (spotFor round odd corners), mid-upgrade, with an army and a hatchery's dragon
    const s = F.fresh(Date.UTC(2026, 9, 28));
    s.b = [];
    let i = 1;
    const R = F.rng(th * 31);
    Object.keys(F.COUNT).forEach(t => {
      for (let n = 0; n < (F.COUNT[t][th - 1] || 0); n++) {
        const z = F.KINDS[t].size, near = {x: 2 + Math.floor(R() * 38), y: 2 + Math.floor(R() * 38)}, p = t === 'keep' ? {x: 4, y: 30} : F.spotFor(s, t, near);
        if (p) s.b.push({i: i++, t, l: t === 'keep' ? th : 1 + (n % 2), x: p.x, y: p.y, u: n % 3 ? 0 : 1e13, ...(F.KINDS[t].role === 'make' ? {c: 5} : {}), ...(t === 'hatchery' ? {dragon: {species: 'x' + n, color: 'red'}} : {})});
      }
    });
    s.nb = i; s.ar = {footman: 7}; s.r = {gold: 123, grain: 456};
    const before = JSON.parse(JSON.stringify(s)), strip = o => JSON.stringify({...o, b: o.b.map(({x, y, ...rest}) => rest)});
    const was = L.arrange(s, th), moved = s.b.filter((b, j) => b.x !== before.b[j].x || b.y !== before.b[j].y).length;
    const kept = !!was && strip(s) === strip(before) && clear(s) && L.sorted(s, th) && moved > 0;
    const walls = L.layoutOf(th).walls, onWalls = s.b.filter(b => b.t === 'wall').every((b, j, all) => walls.slice(0, all.length).some(w => w.x === b.x && w.y === b.y));
    const back = L.restore(s, was) && JSON.stringify(s) === JSON.stringify(before);
    // a lower level's layout still places everything; a realm missing buildings still sorts
    const low = JSON.parse(JSON.stringify(before)), lowOk = th === 1 || (!!L.arrange(low, th - 1) && clear(low) && low.b.length === before.b.length);
    const few = JSON.parse(JSON.stringify(before));
    few.b = few.b.filter((b, j) => b.t === 'keep' || j % 3 === 0);
    const fewOk = !!L.arrange(few, th) && clear(few);
    out.push({th, kept, onWalls, back, lowOk, fewOk});
  }
  // the starting realm sorts too, and Undo refuses once the buildings changed
  const s = F.fresh(Date.UTC(2026, 9, 28)), was = L.arrange(s);
  s.b.pop();
  out.push({fresh: !!was && clear(s), stale: L.restore(s, was) === false});
  return out;
}

async function run(url, shots) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch();
  try {
    const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
    for (const profile of ['evan', 'mason', 'guest'].filter(p => !only || p === only)) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}});
      await context.route('**/*', route => {
        const target = new URL(route.request().url());
        return target.origin !== new URL(url).origin && !['data:', 'blob:'].includes(target.protocol) ? route.abort() : route.continue();
      });
      await context.addInitScript(who => {
        if (who === 'guest') localStorage.setItem('gg-guest', 'Visiting Vic'); else localStorage.setItem('gg-me', who);
        localStorage.setItem('gg-release-3.0:' + encodeURIComponent(who === 'guest' ? 'guest:Visiting Vic' : who), '1');
        localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '3');
        sessionStorage.setItem('gg-skip-title', '1');
      }, profile);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted);
      if (profile === 'evan') {
        const res = await page.evaluate(rules);
        res.forEach(r => assert(Object.entries(r).every(([k, v]) => k === 'th' || v === true), 'layout rules: ' + JSON.stringify(r)));
        console.log('rules ok:', res.length, 'cases');
      }
      // a Castle 5 realm, scattered, opened; Buildings › Base layouts › Sort my base, then Undo
      const start = await page.evaluate(async () => {
        const F = await import('/js/core/realm.js'), app = await import('/js/app.js');
        const s = F.fresh(Date.now());
        s.b.find(b => b.t === 'keep').l = 5;
        let i = s.nb;
        [['cannon', 2], ['tower', 2], ['treasury', 1], ['barracks', 1], ['camp', 1], ['mine', 2], ['wall', 30]].forEach(([t, n]) => {
          for (let k = 0; k < n; k++) { const p = F.spotFor(s, t, {x: 6 + (i * 7) % 30, y: 6 + (i * 13) % 30}); s.b.push({i: i++, t, l: 1, x: p.x, y: p.y, u: 0, ...(F.KINDS[t].role === 'make' ? {c: Date.now()} : {})}); }
        });
        s.nb = i;
        F._set(s);
        await app.nav('/realm');
        return JSON.stringify(s.b);
      });
      await page.waitForSelector('.rl-home canvas', {timeout: 30000});
      await page.waitForFunction(() => !document.querySelector('.rl-home .rl-loading'), null, {timeout: 30000});
      await page.locator('[data-rl-buildings]').click();
      await page.locator('[data-rl-layouts]').click();
      await page.waitForSelector('.rl-layout-tabs');
      assert.equal(await page.locator('.rl-layout-tab').count(), 8, 'a layout for each Castle level');
      assert.equal(await page.locator('.rl-layout-tab.is-on').innerText(), '5', 'your own Castle level is picked first');
      if (shots) await page.screenshot({path: path.join(shots, `layouts-${profile}-5.png`)});
      await page.locator('[data-rl-layout="8"]').click();
      assert(await page.locator('[data-rl-arrange]').isDisabled(), 'a later Castle level is only to look at');
      if (shots && profile === 'evan') await page.screenshot({path: path.join(shots, 'layouts-8.png')});
      await page.locator('[data-rl-layout="5"]').click();
      await page.locator('[data-rl-arrange]').click();
      await page.waitForSelector('.toast-act');
      const after = await page.evaluate(async () => { const F = await import('/js/core/realm.js'), L = await import('/js/core/realm-layout.js'); return {b: JSON.stringify(F.mine().b), sorted: L.sorted(F.mine(), 5)}; });
      assert(after.sorted && after.b !== start, 'Sort my base sorts it');
      // (the toast's own button, pressed at once: it springs in, too slowly to settle under software rendering)
      await page.evaluate(() => document.querySelector('.toast-act').click());
      await page.waitForTimeout(200);
      const undone = await page.evaluate(async () => JSON.stringify((await import('/js/core/realm.js')).mine().b));
      assert.equal(undone, start, 'Undo puts the base back as it was');
      if (shots) {
        await page.locator('[data-rl-buildings]').click();
        await page.locator('[data-rl-layouts]').click();
        await page.locator('[data-rl-arrange]').click();
        await page.waitForTimeout(1500);
        await page.screenshot({path: path.join(shots, `layouts-${profile}-sorted.png`)});
      }
      assert.deepEqual(errors, [], 'no browser exceptions');
      console.log(profile, 'ok');
      await context.close();
    }
  } finally { await browser.close(); }
}

(async () => {
  const shots = process.argv.includes('--shots') ? path.resolve(root, '../output') : null;
  if (shots) fs.mkdirSync(shots, {recursive: true});
  const s = await server();
  try { await run(`http://127.0.0.1:${s.address().port}`, shots); }
  finally { await new Promise(resolve => s.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
