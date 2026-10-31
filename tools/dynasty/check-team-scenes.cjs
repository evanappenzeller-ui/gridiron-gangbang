// Team graphic coverage and resilience. Local fixture only; remote portraits are deliberately failed.
// Usage: node tools/dynasty/check-team-scenes.cjs [--shots=<directory>]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
const css = ['tokens', 'base', 'components', 'views/dynasty', 'views/dynasty-open', 'views/dynasty-rivals', 'views/dynasty-rarity'];
const fixture = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
  + css.map(f => `<link rel="stylesheet" href="/css/${f}.css">`).join('')
  + '<style>html,body{height:auto;overflow:auto;background:#edf2f6}main{display:flex;flex-wrap:wrap;gap:20px;padding:20px}figure{margin:0;flex:none}</style><main class="pk-sheet"></main>';
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/__teams') return res.writeHead(200, {'Content-Type': 'text/html'}).end(fixture);
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(pathname)); }
  catch (_) { return res.writeHead(400).end(); }
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => err ? res.writeHead(404).end() : res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}).end(bytes));
});

async function run(url) {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const context = await browser.newContext({viewport: {width: 1200, height: 1000}, reducedMotion: 'reduce', serviceWorkers: 'block'});
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url + '/__teams');
    const coverage = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), V = await import('/js/views/dynasty.js'), S = await import('/js/views/dynasty-team-scenes.js');
      await D.load();
      const box = document.createElement('div'), bad = [], series = new Set(), teams = Object.keys(D.TEAMS).sort();
      for (const card of D.CARDS) {
        box.innerHTML = V.cardHTML(card, {tag: false});
        if (box.querySelector('[data-team-scene]')?.dataset.teamScene !== card.team) bad.push(card.id);
        series.add(card.s);
      }
      const trainers = D.TRAINER_IDS.map(id => D.trainer(id));
      for (const card of trainers) {
        box.innerHTML = V.trainerHTML(card, {tag: false});
        const scene = box.querySelector('[data-team-scene]');
        if (card.team ? scene?.dataset.teamScene !== card.team : !!scene) bad.push(card.id);
      }
      const source = D.CARDS.find(c => c.r === 'common');
      box.innerHTML = V.cardHTML({...source, team: 'UNKNOWN'}, {tag: false});
      const unknown = !box.querySelector('[data-team-scene]') && !box.querySelector('.pk-c-city') && !box.firstElementChild.style.getPropertyValue('--team-scene');
      document.querySelector('main').innerHTML = teams.map(team => {
        const card = D.CARDS.find(c => c.team === team && c.s === 'L') || D.CARDS.find(c => c.team === team);
        return `<figure style="width:280px">${V.cardHTML(card, {tag: false, size: 'l'})}</figure>`;
      }).join('');
      return {teams, registered: Object.keys(S.TEAM_SCENES).sort(), bad, count: D.CARDS.length, series: [...series], trainers: trainers.filter(t => t.team).length, unknown};
    });
    assert.equal(coverage.teams.length, 32, 'The catalog contains all 32 NFL teams');
    assert.deepEqual(coverage.registered, coverage.teams, 'Every team has a scene');
    assert.deepEqual(coverage.bad, [], 'Every series and team-specific trainer follows its card team');
    assert.equal(coverage.unknown, true, 'Unknown teams retain rarity fallback without an invalid asset URL');
    await page.locator('.pk-c-ph').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
    await page.waitForFunction(() => !document.querySelector('.pk-c-ph'));
    await page.evaluate(() => document.fonts.ready);
    const assets = await page.locator('[data-team-scene]').evaluateAll(async scenes => Promise.all(scenes.map(async scene => {
      const card = scene.closest('.pk-card'), style = getComputedStyle(card);
      const url = /url\(["']?([^"')]+)["']?\)/.exec(style.getPropertyValue('--team-scene'))?.[1];
      const image = new Image(); image.src = url || '';
      let decoded = false;
      try { await image.decode(); decoded = image.naturalWidth === 500 && image.naturalHeight === 500; } catch (_) {}
      // Graphic layers may be stacked on the scene or its decorative pseudo-elements.
      const background = [getComputedStyle(scene), getComputedStyle(scene, '::before'), getComputedStyle(scene, '::after')]
        .map(layer => layer.backgroundImage).join(' ');
      const plasmaStyle = getComputedStyle(scene, '::before'), plasmaBackground = plasmaStyle.backgroundImage;
      const plasmaUrl = /url\(["']?([^"')]+\/team-graphics-v2\/plasma\.webp)["']?\)/.exec(plasmaBackground)?.[1];
      const plasma = new Image(); plasma.src = plasmaUrl || '';
      let plasmaDecoded = false;
      try { await plasma.decode(); plasmaDecoded = plasma.naturalWidth >= 500 && plasma.naturalHeight >= 200; } catch (_) {}
      return {team: scene.dataset.teamScene, url, decoded, background, plasmaUrl, plasmaDecoded, plasmaBlend: plasmaStyle.backgroundBlendMode};
    })));
    assert.equal(new Set(assets.map(a => a.url)).size, 32, 'Each franchise has its own image URL, including shared cities');
    const hashes = assets.map(a => {
      assert.equal(a.decoded, true, a.team + ': local 500px team graphic decodes');
      assert.match(new URL(a.url).pathname, /\/img\/rivals\/team-graphics-v2\/[a-z]+\.png$/, a.team + ': uses the versioned graphic asset');
      assert.ok(a.background.includes(a.url), a.team + ': the team graphic is applied to the visible scenery');
      assert.equal(a.plasmaDecoded, true, a.team + ': visible plasma layer is backed by a decoded local texture');
      assert.equal(a.plasmaBlend.split(',').at(-1).trim(), 'normal', a.team + ': the base plasma texture is not multiplied into its black backing');
      const file = path.resolve(root, '.' + new URL(a.url).pathname);
      assert.ok(file.startsWith(root + path.sep), a.team + ': asset is part of the deployed app');
      return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    });
    assert.equal(new Set(hashes).size, 32, 'All 32 team graphics have distinct contents');
    assert.equal(new Set(assets.map(a => a.plasmaUrl)).size, 1, 'All teams reuse the same local plasma texture');
    const labels = await page.locator('[data-team-scene]').evaluateAll(scenes => Object.fromEntries(scenes.map(scene =>
      [scene.dataset.teamScene, scene.parentElement.querySelector('.pk-c-city')?.textContent])));
    assert.equal(labels.BAL, 'RAVENS', 'Baltimore displays its franchise nickname');
    assert.equal(labels.MIN, 'VIKINGS', 'Minnesota displays its franchise nickname');
    for (const [viewport, width] of [[1200, 280], [390, 160], [390, 92]]) {
      await page.setViewportSize({width: viewport, height: 900});
      await page.locator('figure').evaluateAll((figures, width) => figures.forEach(f => {
        f.style.width = width + 'px'; const c = f.querySelector('.pk-card');
        c.classList.toggle('sz-l', width === 280); c.classList.toggle('sz-s', width !== 280);
      }), width);
      const geometry = await page.locator('[data-team-scene]').evaluateAll(scenes => scenes.map(scene => {
        const card = scene.closest('.pk-card'), art = scene.parentElement, city = art.querySelector('.pk-c-city');
        const rect = el => { const r = el.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height}; };
        return {team: scene.dataset.teamScene, art: rect(art), scene: rect(scene), city: rect(city),
          fallbackVisible: getComputedStyle(art.querySelector('.pk-c-num')).display !== 'none',
          pointerEvents: getComputedStyle(scene).pointerEvents,
          motion: card.getAnimations({subtree: true}).some(a => a.playState === 'running')};
      }));
      for (const g of geometry) {
        assert.ok(g.scene.width > 20 && g.scene.height > 20, g.team + ': scene stays visible at ' + width + 'px');
        assert.ok(g.scene.left >= g.art.left - 1 && g.scene.right <= g.art.right + 1 && g.scene.top >= g.art.top - 1 && g.scene.bottom <= g.art.bottom + 1, g.team + ': background stays inside art');
        assert.ok(g.city.left >= g.art.left - 1 && g.city.right <= g.art.right + 1, g.team + ': franchise label fits at ' + width + 'px');
        assert.equal(g.fallbackVisible, true, g.team + ': failed portrait leaves number and scenery visible');
        assert.equal(g.pointerEvents, 'none', g.team + ': scenery does not block card interaction');
        assert.equal(g.motion, false, g.team + ': collection scenery stays still');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Gallery fits the ' + viewport + 'px viewport');
      if (shots) await page.locator('main').screenshot({path: path.join(shots, `teams-${width}.png`)});
    }
    // An unsupported team still gets a visible rarity stadium, never a broken graphic reference.
    const fallback = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), V = await import('/js/views/dynasty.js');
      const c = {...D.CARDS.find(c => c.r === 'common'), team: 'UNKNOWN'};
      document.querySelector('main').innerHTML = `<figure style="width:280px">${V.cardHTML(c, {tag: false})}</figure>`;
      return getComputedStyle(document.querySelector('.pk-c-scenery')).backgroundImage;
    });
    assert.match(fallback, /field-common\.svg/, 'Unknown teams display the edition fallback');
    assert.deepEqual(errors, [], 'No browser errors');
    console.log(`PASS: 32 distinct decoded team graphics; ${coverage.count} cards across ${coverage.series.length} series; ${coverage.trainers} team trainers`);
    console.log('PASS: 280px, 160px and 92px cards; failed portraits; unknown-team fallback; still, nonblocking scenery');
    await context.close();
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
