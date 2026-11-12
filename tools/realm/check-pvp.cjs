// Raiding other players' realms (Nov 5 2026, Evan: "Players should have the option to attack other player's bases in
// Keepfall, not just cpu bases"; everyone's). A real browser on a local server (Firebase off), the board seeded in memory:
// Evan opens Attack and sees Mason's realm listed, scouts it, raids it (the raid view's own End), and the raid posts on his
// save; then the phone switches to Mason, whose realm takes the raid off itself once (a toast, the Chronicle's "Raids on
// your realm" with ▶ Watch), and Evan's Attack list shows Mason raided today. Screenshots go to ../output/realm-pvp-*.png.
// Run: node tools/realm/check-pvp.cjs
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm'};
function server() {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); } catch (_) { res.writeHead(400).end(); return; }
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
const playwright = () => { try { return require('playwright'); } catch (_) { return require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); } };

(async () => {
  const srv = await server(), url = `http://127.0.0.1:${srv.address().port}`, out = path.resolve(root, '../output');
  fs.mkdirSync(out, {recursive: true});
  const {chromium} = playwright();
  let browser;
  for (const channel of ['chrome', undefined]) {
    try { browser = await chromium.launch({...(channel ? {channel} : {}), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}); break; } catch (_) {}
  }
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, serviceWorkers: 'block'});
    await context.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === url || ['data:', 'blob:'].includes(u.protocol) ? r.continue() : r.abort(); });
    await context.addInitScript(() => {
      localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1');
      ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '3');
      sessionStorage.setItem('gg-skip-title', '1');
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});

    // The board: Evan's realm (Castle 5, an army) on his doc, Mason's (Castle 5, full storage) on his.
    await page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), daily = await import('/js/core/daily.js');
      const now = Date.now(), at = (l, extra) => { const s = F.fresh(now - 3 * 864e5); s.rs = F.TEST_RESET; s.at = now - 864e5; s.b.find(b => b.t === 'keep').l = l; return Object.assign(s, extra); };
      const evan = at(5, {ar: {footman: 40, archer: 20}, exv: F.EX_V, nm: ''}), mason = at(5, {r: {gold: 60000, grain: 50000}, tp: 200, exv: F.EX_V});
      window.__pvp = {mason};
      Object.assign(daily.LB, {ready: true, synced: true, off: false, uid: 'doc-evan'});
      daily.LB.all = daily.LB.raw = [{id: 'doc-evan', nick: 'Evan', fr3: {m_evan: evan}}, {id: 'doc-mason', nick: 'Mason', fr3: {m_mason: JSON.parse(JSON.stringify(mason))}}];
      F._set(null);
      (await import('/js/app.js')).nav('/realm');
    });
    await page.locator('[data-rl-raid], button:has-text("Attack")').first().waitFor({timeout: 30000});
    await page.waitForTimeout(1500);
    // (a sheet the app opens by itself, the release notice or the coffers: closed first)
    for (let i = 0; i < 4 && await page.locator('#overlays [data-sheet-close]:visible').count(); i++) {
      await page.locator('#overlays [data-sheet-close]:visible').last().click();
      await page.waitForTimeout(600);
    }
    await page.locator('[data-rl-raid]').click();
    const row = page.locator('.rl-tg.is-player').filter({hasText: 'House Hulse'});
    await row.waitFor({timeout: 10000});
    assert.equal(await row.locator('[data-rl-go="p:m_mason"]').count(), 1, 'Mason’s realm can be attacked');
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(out, 'realm-pvp-attack-list.png')});
    console.log('PASS: Attack lists other players’ realms (House Hulse, Castle 5) with Scout and Attack');

    await row.locator('[data-rl-scout]').click();
    await page.locator('.rls [data-rls-who]').filter({hasText: 'House Hulse'}).waitFor({timeout: 15000});
    assert.match(await page.locator('[data-rls-who]').innerText(), /Mason’s realm/);
    assert.equal(await page.locator('[data-rls-attack]').count(), 1, 'Scout offers Attack');
    await page.waitForTimeout(2500);
    await page.screenshot({path: path.join(out, 'realm-pvp-scout.png')});
    console.log('PASS: Scout shows Mason’s realm and Attack');

    await page.locator('[data-rls-attack]').click();
    await page.waitForFunction(() => { const r = document.querySelector('.rlr:not(.rls)'); return r && r.__rl && r.__rl.B && r.__rl.v; }, null, {timeout: 30000});
    // (the army sent round the lot, as taps do; then the raid view's own End)
    await page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), st = document.querySelector('.rlr:not(.rls)').__rl, box = F.boxOf(st.T.base);
      for (let i = 0; i < 40; i++) st.B.deploy('footman', i % 2 ? box.x1 + 1.4 : box.x0 - 1.6, box.y0 + (i % 20) * .7);
      st.t0 = performance.now(); st.speed = 4;
      st.B.run(170);
    });
    await page.waitForTimeout(800);
    // (the realm all down ends the raid by itself; else End)
    if (!await page.locator('[data-rlr-end] .rlr-card').count()) await page.locator('[data-rlr-quit]').click({force: true});
    await page.locator('[data-rlr-end] .rlr-card').waitFor({timeout: 15000});
    await page.screenshot({path: path.join(out, 'realm-pvp-raid-end.png')});
    const posted = await page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), s = F.mine(), r = s.rd[s.rd.length - 1];
      return {vs: r.vs, by: r.by, bw: r.bw, st: r.st, lt: r.lt, ls: r.ls, rp: !!r.rp, bt: s.bt['p:m_mason'] === F.dayKey()};
    });
    assert.equal(posted.vs, 'p:m_mason'); assert.ok(posted.st >= 1 && posted.lt[0] > 0 && posted.rp && posted.bt, JSON.stringify(posted));
    console.log('PASS: the raid ended and posted on Evan’s save:', JSON.stringify(posted));

    // Mason's phone: Evan's save on the board, his own realm takes the raid off itself, once.
    const taken = await page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), daily = await import('/js/core/daily.js'), data = await import('/js/core/data.js'), app = await import('/js/app.js');
      const evan = JSON.parse(JSON.stringify(F.mine()));
      app.nav('/puzzles');
      await new Promise(r => setTimeout(r, 400));
      data.setMe('mason');
      Object.assign(daily.LB, {uid: 'doc-mason'});
      daily.LB.all = daily.LB.raw = [{id: 'doc-evan', nick: 'Evan', fr3: {m_evan: evan}}, {id: 'doc-mason', nick: 'Mason', fr3: {m_mason: JSON.parse(JSON.stringify(window.__pvp.mason))}}];
      F._set(null);
      app.nav('/realm');
      await new Promise(r => setTimeout(r, 300));
      const s = F.mine(), d = s.df[s.df.length - 1];
      const again = F.takeIncoming(s, 'm_mason').length;
      return {gold: s.r.gold, grain: s.r.grain, was: window.__pvp.mason.r, pk: d && d.pk, by: d && d.by, bw: d && d.bw, lt: d && d.lt, replay: !!(d && F.hasReplay(d, s)), again, raw: evan.rd[evan.rd.length - 1].ls};
    });
    assert.equal(taken.pk, 'm_evan'); assert.equal(taken.again, 0);
    assert.equal(taken.gold, taken.was.gold - taken.raw[0]); assert.equal(taken.grain, taken.was.grain - taken.raw[1]);
    assert.ok(taken.replay, 'The raid can be watched from Mason’s Chronicle');
    await page.locator('.toast, [role="status"]').filter({hasText: 'raided your realm'}).first().waitFor({timeout: 10000});
    await page.screenshot({path: path.join(out, 'realm-pvp-defender-toast.png')});
    console.log('PASS: Mason’s realm took it off once:', JSON.stringify(taken));

    await page.waitForTimeout(2500);
    await page.evaluate(() => { const b = document.querySelector('[data-rl-log]'); b.click(); });
    const log = page.locator('.rl-log').filter({hasText: 'House Appenzeller'});
    await log.first().waitFor({timeout: 10000});
    assert.equal(await log.first().locator('[data-rl-watch]').count(), 1, 'Watch on the raid by Evan');
    await page.waitForTimeout(900);
    await page.screenshot({path: path.join(out, 'realm-pvp-chronicle.png')});
    console.log('PASS: Mason’s Chronicle lists House Appenzeller’s raid with Watch');
    assert.deepEqual(errors, [], 'No browser exceptions');
    console.log('PASS: no browser exceptions');
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
