// Offline binder regression: energy groups, secondary sorting, paging, filters and card labels.
// Firebase is removed from served HTML and every nonlocal request is blocked.
// Usage: node tools/dynasty/check-binder-energy.cjs [--shots=<dir>] [--profile=evan]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
let pw;
try { pw = require('playwright'); }
catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const shots = process.argv.find(arg => arg.startsWith('--shots='))?.slice(8);
const only = process.argv.find(arg => arg.startsWith('--profile='))?.slice(10);
if (shots) fs.mkdirSync(shots, {recursive: true});
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  let file;
  try { const pathname = new URL(req.url, 'http://localhost').pathname; file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname)); }
  catch { return res.writeHead(400).end(); }
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  const relative = path.relative(root, file);
  if (process.env.RIVALS_ASSET_ROOT && !fs.existsSync(file) && ['img', 'fonts', 'icons'].includes(relative.split(path.sep)[0])) file = path.join(process.env.RIVALS_ASSET_ROOT, relative);
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(bytes);
  });
});
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function enter(page, url) {
  await page.goto(url + '/#/puzzles');
  await page.waitForFunction(() => window.__ggBooted);
  await page.evaluate(async () => {
    if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes must remain disabled');
    await (await import('/js/app.js')).nav('/puzzles/dynasty');
  });
  await page.waitForSelector('.pk-start.is-ready');
  await page.locator('.pk-start').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.pk-start'));
}
async function seed(page) {
  return page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js'), PC = await import('/js/core/dynasty-pocket-cards.js');
    const order = [...PC.ENERGY_TYPES, 'Colorless', 'Dragon'];
    const kinds = order.filter(type => D.CARDS.some(c => PC.card(c.id)?.types[0] === type));
    const first = kinds.find(type => D.CARDS.filter(c => PC.card(c.id)?.types[0] === type).length > 60);
    if (!first) throw Error('Need one energy group larger than a binder page');
    const selected = kinds.flatMap(type => D.CARDS.filter(c => PC.card(c.id)?.types[0] === type).slice(0, type === first ? 75 : 8));
    const s = D.mine(); s.o = Object.fromEntries(selected.map((c, i) => [c.id, i % 3 + 1]));
    D.TRAINER_IDS.slice(0, 3).forEach(id => { s.o[id] = 2; });
    s.nw = []; D.touch();
    return {first, size: selected.length + 3, before: JSON.stringify(s)};
  });
}
async function expected(page, sort, filter = {}) {
  return page.evaluate(async ({sort, filter}) => {
    const D = await import('/js/core/dynasty.js'), PC = await import('/js/core/dynasty-pocket-cards.js');
    const s = D.mine(), energyOrder = [...PC.ENERGY_TYPES, 'Colorless', 'Dragon'];
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];
    const norm = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = norm(filter.q || '');
    const players = D.CARDS.filter(c => (filter.all || s.o[c.id] > 0) && (!filter.pos || c.pos === filter.pos) && (!filter.rar || c.r === filter.rar)
      && (!q || norm(`${c.name} ${c.team} ${D.teamOf(c.team).name}`).includes(q)));
    const best = (a, b) => b.o - a.o || D.SERIES_ORDER.indexOf(a.s) - D.SERIES_ORDER.indexOf(b.s) || a.name.localeCompare(b.name);
    const secondary = (a, b) => sort === 'team' ? D.teamOf(a.team).name.localeCompare(D.teamOf(b.team).name)
      : sort === 'pos' ? positions.indexOf(a.pos) - positions.indexOf(b.pos)
      : sort === 'rar' ? D.RARITY.indexOf(b.r) - D.RARITY.indexOf(a.r) : 0;
    players.sort((a, b) => energyOrder.indexOf(PC.card(a.id).types[0]) - energyOrder.indexOf(PC.card(b.id).types[0]) || secondary(a, b) || best(a, b));
    const trainers = filter.pos ? [] : D.TRAINER_IDS.map(D.trainer).filter(t => (filter.all || s.o[t.id] > 0) && (!filter.rar || t.r === filter.rar)
      && (!q || norm(`${t.name} ${t.text}`).includes(q)));
    // Trainers are separate from player-energy groups; preserve their existing order when Best is selected.
    if (sort) trainers.sort((a, b) => D.RARITY.indexOf(b.r) - D.RARITY.indexOf(a.r) || a.name.localeCompare(b.name));
    const kinds = [...new Set(players.map(c => PC.card(c.id).types[0]))];
    return {ids: [...players, ...trainers].map(c => c.id), groups: Object.fromEntries(kinds.map(type => [type, players.filter(c => PC.card(c.id).types[0] === type).length]))};
  }, {sort, filter});
}
async function inspect(page, want, label) {
  const got = await page.evaluate(() => ({
    ids: [...document.querySelectorAll('[data-dy-grid] [data-dy-card]')].map(c => c.dataset.dyCard),
    headings: [...document.querySelectorAll('h3[data-dy-energy]')].map(h => ({type: h.dataset.dyEnergy, count: Number(h.querySelector('small')?.textContent.replace(/,/g, ''))})),
    labels: [...document.querySelectorAll('[data-dy-grid] .pk-card:not(.pk-trainer)')].map(c => ({id: c.dataset.dyCard, energy: c.querySelector('.pk-c-energy')?.dataset.cardEnergy, text: c.querySelector('.pk-c-energy > b')?.firstChild?.textContent, caption:c.querySelector('.pk-c-energy small')?.textContent}))
  }));
  assert.deepEqual(got.ids, want.ids.slice(0, got.ids.length), label + ': displayed cards follow energy then secondary order');
  assert.equal(new Set(got.ids).size, got.ids.length, label + ': one card per owned player, copies stacked');
  assert.equal(new Set(got.headings.map(h => h.type)).size, got.headings.length, label + ': no repeated energy headings across pages');
  for (const h of got.headings) if (want.groups[h.type] != null) assert.equal(h.count, want.groups[h.type], label + ': heading counts filtered cards for ' + h.type);
  const names = await page.evaluate(async ids => { const PC = await import('/js/core/dynasty-pocket-cards.js'); return Object.fromEntries(ids.map(id => [id, PC.card(id)?.types[0]])); }, got.labels.map(c => c.id));
  for (const c of got.labels) { assert.equal(c.energy, names[c.id], label + ': card badge matches group'); assert.equal(c.text, names[c.id]); assert.equal(c.caption, 'Energy'); }
  return got.ids.length;
}
async function chooseSort(page, sort) {
  await page.locator(`[data-dy-sort="${sort}"]`).click();
  await settle(page);
  assert.equal(await page.locator(`[data-dy-sort="${sort}"]`).getAttribute('aria-pressed'), 'true');
}
async function filterChip(page, name, value) {
  await page.locator('[data-dy-filter]').click();
  await page.locator(`[data-chips="dy-${name}"] [data-value="${value}"]`).click();
  await page.locator('.sheet.pk-sheet .sheet-close').click();
  await settle(page);
}
async function clearFilters(page) {
  await page.locator('[data-dy-filter]').click();
  await page.locator('[data-dy-clearf]').click();
  await settle(page);
}
async function run(url) {
  const browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined)});
  const profiles = [['evan', '', 'evan'], ['jayton', '', 'jayton'], ['none', 'Ryan Stewart', 'ryan-stewart'], ['none', 'Ryan Younggreen', 'ryan-younggreen']].filter(p => !only || p[2] === only);
  assert(profiles.length, 'requested profile exists');
  try {
    for (const [member, guest, label] of profiles) {
      const context = await browser.newContext({viewport: {width:390, height:844}, serviceWorkers:'block', reducedMotion:'reduce'});
      await context.route('**/*', route => route.request().url().startsWith(url + '/') ? route.continue() : route.abort());
      await context.addInitScript(({member, guest}) => {
        localStorage.setItem('gg-me', member); localStorage.setItem('gg-guest', guest); localStorage.setItem('gg-welcome', '1');
        ['evan', 'jayton', 'user%3Aryan-stewart', 'user%3Aryan-younggreen', 'visitor'].forEach(key => localStorage.setItem('gg-release-3.0:' + key, '1'));
      }, {member, guest});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await enter(page, url);
      const fixture = await seed(page);
      await page.locator('.pk-nav [data-dy-tab="cards"]').click();
      await page.waitForSelector('[data-dy-energy]');
      assert.equal(await page.locator('.pk-energy-note').filter({hasText:'Grouped by energy type'}).count(), 1);
      assert.equal(await page.getByRole('group', {name:'Sort within energy types', exact:true}).count(), 1);
      for (const sort of ['', 'team', 'pos', 'rar']) {
        await chooseSort(page, sort);
        const want = await expected(page, sort);
        let shown = await inspect(page, want, `${label}/${sort || 'best'}`);
        assert.equal(shown, 60, 'first binder page stays bounded');
        await page.evaluate(() => { window.firstBinderCard = document.querySelector('[data-dy-grid] [data-dy-card]'); });
        while (await page.locator('[data-dy-more]').count()) {
          await page.locator('[data-dy-more]').click(); await settle(page);
          shown = await inspect(page, want, `${label}/${sort || 'best'} more`);
          assert.equal(await page.evaluate(() => window.firstBinderCard === document.querySelector('[data-dy-grid] [data-dy-card]')), true, 'paging appends instead of rebuilding');
        }
        assert.equal(shown, fixture.size, 'paging reaches every owned card');
      }
      const stack = await page.locator('[data-dy-grid] .pk-stack').first().evaluate(el => ({count: el.querySelector('.pk-stack-n').textContent, id: el.querySelector('[data-dy-card]').dataset.dyCard}));
      assert.equal(Number(stack.count), await page.evaluate(async id => (await import('/js/core/dynasty.js')).mine().o[id], stack.id), 'copy badge retains actual ownership');
      const query = await page.evaluate(async () => (await import('/js/core/dynasty.js')).CARDS.find(c => (window.firstBinderCard?.dataset.dyCard) === c.id)?.name || 'Patrick');
      await page.locator('input[name="dy-q"]').fill(query); await page.waitForTimeout(220);
      await inspect(page, await expected(page, 'rar', {q:query}), label + ' search');
      await page.locator('input[name="dy-q"]').fill('no-such-athlete-314159'); await page.waitForTimeout(220);
      assert.equal(await page.locator('[data-dy-grid] [data-dy-card]').count(), 0, 'empty search hides stale groups/cards');
      assert.equal(await page.locator('[data-dy-energy]').count(), 0);
      await page.locator('input[name="dy-q"]').fill(''); await page.waitForTimeout(220);
      await filterChip(page, 'pos', 'QB');
      await inspect(page, await expected(page, 'rar', {pos:'QB'}), label + ' position filter');
      await clearFilters(page);
      const rarity = await page.evaluate(async () => { const D = await import('/js/core/dynasty.js'); return D.CARDS.find(c => D.mine().o[c.id] > 0).r; });
      await filterChip(page, 'rar', rarity);
      await inspect(page, await expected(page, 'rar', {rar:rarity}), label + ' rarity filter');
      await clearFilters(page);
      await page.locator('[data-dy-all]').click(); await settle(page);
      await inspect(page, await expected(page, 'rar', {all:true}), label + ' all cards');
      await page.locator('[data-dy-all]').click(); await settle(page);
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({width, height:width === 320 ? 568 : 844}); await settle(page);
        const fit = await page.evaluate(() => {
          const pane = document.querySelector('.pk-pane');
          const badges = [...document.querySelectorAll('[data-dy-grid] .pk-c-energy')].slice(0, 8);
          return {fits:pane.scrollWidth <= pane.clientWidth + 1, badges:badges.every(el => {
            const r = el.getBoundingClientRect(), card = el.closest('.pk-card'), face = card.querySelector('.pk-c-face').getBoundingClientRect(), art = card.querySelector('.pk-c-art').getBoundingClientRect();
            return r.width > 25 && r.height > 10 && r.left >= face.left - 1 && r.right <= face.right + 1 && r.bottom <= art.top + 1 && el.scrollWidth <= el.clientWidth + 1;
          })};
        });
        assert.deepEqual(fit, {fits:true, badges:true}, label + ' visible energy badges and binder fit ' + width);
        if (shots && label === 'evan') await page.screenshot({path:path.join(shots, 'binder-' + width + '.png')});
      }
      assert.equal(await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine())), fixture.before, label + ': sorting, filtering and paging never change collection, deck or balances');
      await page.setViewportSize({width:390, height:844});
      await enter(page, url);
      await page.locator('.pk-nav [data-dy-tab="cards"]').click(); await settle(page);
      assert.equal(await page.locator('[data-dy-sort="rar"]').getAttribute('aria-pressed'), 'true', label + ': saved secondary sort is restored');
      await inspect(page, await expected(page, 'rar'), label + ' reload');
      assert.deepEqual(errors, [], label + ': no browser errors');
      await context.close();
      console.log('PASS ' + label + ': energy groups, secondary sorts, paging, filters, copy stacks, badges, phone layouts and unchanged saves');
    }
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
