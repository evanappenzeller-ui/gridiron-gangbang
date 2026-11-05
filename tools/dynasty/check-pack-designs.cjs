// Offline pack presentation QA: profile boundaries, Epic preservation, mobile layouts and tear pieces.
// Optional --baseline=<git-ref> compares all non-owner markup and Epic exactly with that release.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), {execFileSync} = require('node:child_process');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/pack-designs');
fs.mkdirSync(out, {recursive: true});
const ref = process.argv.find(a => a.startsWith('--baseline='))?.slice(11);
const baseline = ref ? execFileSync('git', ['show', `${ref}:js/views/dynasty-packs.js`], {cwd: root}) : null;
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (baseline && p.endsWith('dynasty-packs-baseline.js')) return res.writeHead(200, {'Content-Type': 'text/javascript'}).end(baseline);
  fs.readFile(p, (err, buf) => {
    if (err) return res.writeHead(404).end();
    if (p.endsWith('index.html')) buf = Buffer.from(buf.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(p)] || 'application/octet-stream'}).end(buf);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block'});
    await context.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem('gg-skip-title', '1'); localStorage.setItem('gg-me', 'evan');
      localStorage.setItem('gg-tab-hint', '2'); localStorage.setItem('gg-release-3.0:evan', '1');
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForFunction(() => window.__ggBooted);
    await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
    await page.locator('.pk-start.is-ready').waitFor(); await page.locator('.pk-start').click();
    await page.locator('.pk-tab[data-dy-tab="packs"]').click(); await page.locator('.pk-pack-shop').waitFor();
    const boundaries = await page.evaluate(async hasBaseline => {
      const data = await import('/js/core/data.js'), P = await import('/js/views/dynasty-packs.js');
      const old = hasBaseline ? await import('/js/views/dynasty-packs-baseline.js') : null;
      const norm = s => s.replace(/pa[0-9a-z]+_/g, 'pack_');
      const rows = [];
      for (const who of ['evan', 'jayton', 'mason', 'none']) {
        data.setMe(who);
        for (const kind of ['std', 'team', 'start', 'prem', 'gday', 'leg']) {
          for (let i = 0; i < P.designsOf(kind).length; i++) {
            const html = P.packHTML(kind, {big: true, count: 3, design: i});
            const changed = who === 'evan' && ['std', 'team', 'start'].includes(kind);
            rows.push({who, kind, i, gate: html.includes('is-printed') === changed,
              same: changed || !old || norm(html) === norm(old.packHTML(kind, {big: true, count: 3, design: i}))});
          }
        }
      }
      data.setMe('none'); data.setGuest('Ryan Stewart');
      const ryan = ['std', 'team', 'start', 'prem'].every(kind => !P.packHTML(kind).includes('is-printed')
        && (!old || norm(P.packHTML(kind)) === norm(old.packHTML(kind))));
      data.setGuest(''); data.setMe('evan');
      return {rows, ryan};
    }, !!baseline);
    assert(boundaries.ryan); assert(boundaries.rows.every(r => r.gate && r.same), JSON.stringify(boundaries));
    // Profile changes legitimately navigate away from the game; enter again as the restored owner.
    await page.reload(); await page.waitForFunction(() => window.__ggBooted);
    await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
    await page.locator('.pk-start.is-ready').waitFor(); await page.locator('.pk-start').click();
    await page.locator('.pk-tab[data-dy-tab="packs"]').click(); await page.locator('.pk-pack-shop').waitFor();
    // A scoped gallery also checks all SVG assets loaded and every small picker label remains legible.
    await page.setViewportSize({width: 1040, height: 1200});
    await page.evaluate(async () => {
      const P = await import('/js/views/dynasty-packs.js'), D = await import('/js/core/dynasty.js');
      const g = document.createElement('div'); g.id = 'pack-qa'; g.className = 'v-dynasty';
      g.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e9eeec;padding:28px;overflow:auto;';
      g.innerHTML = ['std', 'team', 'start', 'prem'].map(kind => `<section style="display:flex;gap:22px;align-items:center;margin-bottom:26px"><h2 style="width:100px;font:700 18px system-ui">${D.PACKS[kind].name}</h2>${P.designsOf(kind).map((d, i) => `<div>${P.packHTML(kind, {big:true, design:i})}</div>`).join('')}</section>`).join('');
      g.querySelectorAll('.pk-pack').forEach(p => p.style.width = '160px'); document.body.append(g);
    });
    await page.waitForTimeout(700); await page.locator('#pack-qa').screenshot({path: path.join(out, 'all-designs.png')});
    await page.evaluate(() => document.querySelector('#pack-qa').remove());
    const selectKind = async kind => {
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(350);
        if (await page.locator('.pk-pack-slot.is-cur').getAttribute('data-pack-kind') === kind) return;
        await page.locator('.pk-pack-shelf').press('ArrowRight');
      }
      assert.fail('Could not select ' + kind);
    };
    for (const width of [320, 390, 430, 768]) {
      await page.setViewportSize({width, height: width === 768 ? 1024 : 844});
      for (const kind of ['std', 'team', 'prem']) {
        await selectKind(kind);
        const state = await page.locator('.pk-pack-slot.is-cur .pk-pack').evaluate(p => {
          const r = p.getBoundingClientRect(), a = p.querySelector('.pk-pack-art').getBoundingClientRect();
          return {fits: r.left >= 0 && r.right <= innerWidth && a.width > 0 && a.height > 0,
            printed: p.classList.contains('is-printed'), foil: !!p.querySelector('.pk-pack-wrap, .pk-pack-foil, .pk-pack-spark')};
        });
        assert(state.fits, `${kind} fits at ${width}`); assert.equal(state.printed, kind !== 'prem'); assert.equal(state.foil, kind === 'prem');
        if (width === 390) await page.screenshot({path: path.join(out, `${kind}-phone.png`)});
      }
    }
    await page.setViewportSize({width: 390, height: 844});
    await selectKind('std');
    await page.locator('.pk-pack-buy').click();
    await page.locator('[data-dy-carousel]').press('Enter');
    await page.locator('.dy-rip').waitFor();
    assert.equal(await page.locator('.dy-rip .pk-pack.is-printed.k-std').count(), 3, 'all tear pieces use the new standard');
    await page.screenshot({path: path.join(out, 'standard-opening.png')});
    assert.deepEqual(errors, []);
    console.log(`PASS: ${boundaries.rows.length} profile/design comparisons, Ryan, unchanged Epic, four viewport sizes, shelf and opening. Screenshots: ${out}`);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
