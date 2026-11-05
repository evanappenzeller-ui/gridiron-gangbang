// Press Room questions added in the app (Nov 5 2026, Evan: "Add a section in the press room for me to manually add
// questions in and tie them to the manager that asked"). A real browser on a local server (Firebase off, so saves go
// to the dev stand-in in this browser): the Press Room kit checks on Evan's, Mason's and a visitor's profile; then, on
// Evan's, Add a question (week, who asked, the question, a note), the question under the featured week's questions,
// changed and deleted from its own sheet; Mason sees it and has no Add or edit. Screenshots: ../output/press-q-*.png.
// Run: node tools/press/check-questions.cjs
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.rules': 'text/plain'};
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

async function open(browser, url, me, store = null) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, serviceWorkers: 'block', isMobile: true, hasTouch: true});
  await context.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === url || ['data:', 'blob:'].includes(u.protocol) ? r.continue() : r.abort(); });
  await context.addInitScript(([me, store]) => {
    if (me) localStorage.setItem('gg-me', me);
    localStorage.setItem('gg-welcome', '1');
    ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    if (store && !sessionStorage.getItem('pq-seeded')) { localStorage.setItem('gg-dev-press-qs', store); sessionStorage.setItem('pq-seeded', '1'); }
    sessionStorage.setItem('gg-skip-title', '1');
  }, [me, store]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url + '/#/press');
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  return {context, page, errors};
}
async function kit(page) {
  return page.evaluate(async () => {
    const {pressChecks} = await import('/js/core/checks-press.js'), out = [];
    const list = [];
    await pressChecks((name, fn) => list.push({name, fn}));
    for (const {name, fn} of list) {
      try { const r = await fn(); out.push({name, pass: r === true || !!(r && r.pass), detail: (r && r.detail) || ''}); }
      catch (e) { out.push({name, pass: false, detail: String(e && e.stack || e)}); }
    }
    return out;
  });
}

(async () => {
  const srv = await server(), url = `http://127.0.0.1:${srv.address().port}`, out = path.resolve(root, '../output');
  fs.mkdirSync(out, {recursive: true});
  const {chromium} = playwright();
  let browser;
  for (const channel of ['chrome', undefined]) { try { browser = await chromium.launch({...(channel ? {channel} : {}), headless: true}); break; } catch (_) {} }
  try {
    // The kit checks, each profile
    for (const me of ['evan', 'mason', '']) {
      const {context, page, errors} = await open(browser, url, me);
      const res = await kit(page), bad = res.filter(r => !r.pass), q = res.find(r => /questions added in the app/.test(r.name));
      console.log(`${me || 'visitor'}: ${res.length - bad.length}/${res.length} Press Room checks pass; added questions: ${q ? q.detail : 'missing'}`);
      bad.forEach(r => console.log('  FAIL', r.name, '\n   ', r.detail.slice(0, 400)));
      assert.ok(q && q.pass, 'The added-questions check passes for ' + (me || 'visitor'));
      assert.deepEqual(errors, [], 'No browser exceptions');
      await context.close();
    }

    // Evan adds, changes and deletes a question
    const E = await open(browser, url, 'evan'), page = E.page;
    const add = page.locator('[data-pr-qadd]');
    await add.waitFor({timeout: 20000});
    const week = await add.getAttribute('data-pr-qadd');
    const before = await page.locator('.pr-qs .pr-q').count();
    await add.scrollIntoViewIfNeeded();
    await add.click();
    const sheet = page.locator('.sh-pq');
    await sheet.waitFor();
    assert.equal(await sheet.locator('[data-pq-save]').isDisabled(), true, 'Add stays off till who and what');
    await sheet.locator('[data-chips="pq-who"] .chip[data-value="mason"]').click();
    await sheet.locator('#pq-q').fill('Coach, walk us through benching your QB1 for a kicker?');
    await sheet.locator('#pq-note').fill('Asked in the league chat');
    await page.waitForTimeout(400);
    await page.screenshot({path: path.join(out, 'press-q-sheet.png')});
    await sheet.locator('[data-pq-save]').click();
    await sheet.waitFor({state: 'detached'});
    const mine = page.locator('.pr-q.is-mine').filter({hasText: 'benching your QB1'});
    await mine.waitFor({timeout: 10000});
    assert.equal(await page.locator('.pr-qs .pr-q').count(), before + 1);
    assert.match(await mine.innerText(), /Mason[\s\S]*benching your QB1[\s\S]*Asked in the league chat/);
    await mine.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({path: path.join(out, 'press-q-added.png')});
    console.log(`PASS: Evan added Mason's question to ${week}; it shows last under Questions from the press`);

    await mine.locator('[data-pr-qedit]').click();
    await sheet.waitFor();
    assert.equal(await sheet.locator('#pq-q').inputValue(), 'Coach, walk us through benching your QB1 for a kicker?');
    assert.equal(await sheet.locator('[data-chips="pq-who"] .chip[data-value="mason"]').getAttribute('aria-pressed'), 'true');
    await sheet.locator('[data-chips="pq-who"] .chip[data-value="ben"]').click();
    await sheet.locator('#pq-q').fill('Coach, why bench your QB1?');
    await sheet.locator('[data-pq-save]').click();
    await sheet.waitFor({state: 'detached'});
    await page.locator('.pr-q.is-mine').filter({hasText: 'why bench your QB1'}).waitFor({timeout: 10000});
    assert.match(await page.locator('.pr-q.is-mine').innerText(), /Ben/);
    console.log('PASS: changed it (asked by Ben now, new wording)');

    const stored = await page.evaluate(() => localStorage.getItem('gg-dev-press-qs'));
    await E.context.close();

    // Mason sees it, with no Add and no edit
    const M = await open(browser, url, 'mason', stored);
    await M.page.locator('.pr-qs .pr-q').filter({hasText: 'why bench your QB1'}).waitFor({timeout: 20000});
    assert.equal(await M.page.locator('[data-pr-qadd], [data-pr-qedit]').count(), 0, 'Mason has no Add or edit');
    console.log('PASS: Mason sees the question, and no Add or edit');
    assert.deepEqual(M.errors, [], 'No browser exceptions (Mason)');
    await M.context.close();

    // Evan deletes it
    const E2 = await open(browser, url, 'evan', stored), p2 = E2.page;
    const row = p2.locator('.pr-q.is-mine').filter({hasText: 'why bench your QB1'});
    await row.waitFor({timeout: 20000});
    await row.locator('[data-pr-qedit]').click();
    await p2.locator('.sh-pq [data-pq-del]').click();
    await p2.locator('.as-btn.is-destructive').click();
    await p2.locator('.sh-pq').waitFor({state: 'detached'});
    await p2.waitForTimeout(500);
    assert.equal(await p2.locator('.pr-q.is-mine').count(), 0, 'Deleted');
    console.log('PASS: Evan deleted it');
    assert.deepEqual([...E.errors, ...E2.errors], [], 'No browser exceptions (Evan)');
    await E2.context.close();
    console.log('PASS: no browser exceptions');
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
