// Press Room questions are read only (Nov 18 2026, Evan: "Remove the option to add questions in the app. We are no
// longer doing questions for the press conferences"). A real browser on a local server (Firebase off, so the dev
// stand-in stores hold one question Evan added and one a member sent for week 2, and one sent for the week still
// waiting on its presser; that week's loser is faked with press.__dev.loser): on Evan's, Mason's, Ben's (the loser)
// and a visitor's profile, phone and tablet, every Press Room kit check passes; the Press Room and the Matchup tab's
// Press pane have no Add a question, no Ask {loser}, no question sheet and no editable rows; week 2's presser still
// shows its seeded questions plus the two already in the app, read only; the post prompt for the waiting week stays.
// Screenshots: ../output/press-no-questions-*.png.   Run: node tools/press/check-no-questions.cjs
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
const W2 = '2026-w2', ADDED = 'Coach, an added question from before', SENT = 'Coach, a sent question from before', OPEN_Q = 'Waiting for a presser';
const WRITE = '[data-pr-qadd], [data-pr-qedit], [data-pr-sask], [data-pr-sedit], .pr-ask, .pr-qs-add, .pr-q.is-mine, .sh-pq, .sh-ask';

async function open(browser, url, me, viewport) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, serviceWorkers: 'block', isMobile: viewport.width < 600, hasTouch: true});
  await context.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === url || ['data:', 'blob:'].includes(u.protocol) ? r.continue() : r.abort(); });
  await context.addInitScript(([me, w2, added, sent]) => {
    if (window.top !== window) return;
    if (me) localStorage.setItem('gg-me', me);
    localStorage.setItem('gg-welcome', '1');
    ['evan', 'mason', 'ben', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    localStorage.setItem('gg-dev-press-qs', JSON.stringify({at: 5, w: {[w2]: [{id: 'qa', by: 'jayton', q: added}]}}));
    sessionStorage.setItem('gg-skip-title', '1');
  }, [me, W2, ADDED, SENT]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto(url + '/#/');
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  const target = await page.evaluate(async ([w2, sent, openQ]) => {
    const press = await import('/js/core/press.js');
    await press.loadSeed();
    const d = press.defaultWeek(), key = `${d.year}-w${d.week}`;
    localStorage.setItem('gg-dev-press-sent', JSON.stringify({mason: {at: 7, w: {[w2]: [{id: 'sa', q: sent, t: 1}], [key]: [{id: 'sb', q: openQ, t: 2}]}}}));
    press.__dev.loser(key, {who: 'ben', opp: 'mason', key, voted: true});
    return {key, week: d.week};
  }, [W2, SENT, OPEN_Q]);
  return {context, page, errors, target};
}
async function kit(page) {
  return page.evaluate(async () => {
    const {pressChecks} = await import('/js/core/checks-press.js'), out = [], list = [];
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
    const runs = [['evan', {width: 390, height: 844}], ['mason', {width: 390, height: 844}], ['ben', {width: 390, height: 844}], ['', {width: 820, height: 1180}]];
    for (const [me, vp] of runs) {
      const who = me || 'visitor', {context, page, errors, target} = await open(browser, url, me, vp);
      const res = await kit(page), bad = res.filter(r => !r.pass), ro = res.find(r => /read only/.test(r.name));
      bad.forEach(r => console.log('  FAIL', r.name, '\n   ', r.detail.slice(0, 400)));
      assert.equal(bad.length, 0, 'Every Press Room kit check passes for ' + who);
      assert.ok(ro, 'the read-only kit check is there');
      console.log(`PASS: ${who}: ${res.length}/${res.length} Press Room kit checks (${ro.detail})`);

      // The Press Room on its latest presser: nothing to add, the waiting week's prompt still there
      await page.evaluate(() => { location.hash = '#/press'; });
      await page.locator('.pr-main [data-pr-sec="arch"]').waitFor({timeout: 20000});
      await page.waitForTimeout(500);
      assert.equal(await page.locator(WRITE).count(), 0, `no question controls on the Press Room (${who})`);
      assert.doesNotMatch(await page.locator('.pr-main').innerText(), /Add a question|Ask (Ben|another question)|Send question/, `no question wording (${who})`);
      assert.equal(await page.getByText(OPEN_Q).count(), 0, 'a question sent for the waiting week shows nowhere');
      const prompt = await page.locator('.pr-miss').count();
      console.log(`PASS: ${who}: Press Room has no Add a question / Ask ${'{loser}'}; post prompt for ${target.key}: ${prompt ? 'shown' : 'none'}`);

      // Week 2: the seeded questions and the two already in the app, read only
      await page.evaluate(k => { location.hash = '#/press/' + k; }, W2);
      const qs = page.locator('.pr-qs .pr-q');
      await qs.filter({hasText: SENT}).waitFor({timeout: 20000});
      await page.waitForTimeout(300);
      const n = await qs.count(), text = await page.locator('.pr-qs').innerText();
      assert.equal(n, 5, 'week 2: three seeded + one added + one sent');
      assert.match(text, new RegExp(`${ADDED}[\\s\\S]*${SENT}`), 'the app\'s questions follow the seeded ones');
      assert.equal(await page.locator(WRITE).count(), 0, `week 2's questions are read only (${who})`);
      await page.locator('.pr-qs').scrollIntoViewIfNeeded();
      await page.screenshot({path: path.join(out, `press-no-questions-${who}.png`)});
      console.log(`PASS: ${who}: week 2 shows its ${n} questions, none editable`);

      // The Matchup tab's Press pane
      await page.evaluate(() => { location.hash = '#/matchup?s=press'; });
      await page.locator('[data-pr-sec="arch"]:visible').first().waitFor({timeout: 20000});
      await page.waitForTimeout(400);
      assert.equal(await page.locator(WRITE).count(), 0, `no question controls on Matchup › Press (${who})`);
      console.log(`PASS: ${who}: Matchup › Press has no question controls`);
      assert.deepEqual(errors, [], 'no browser exceptions for ' + who);
      await context.close();
    }
    console.log('PASS: no browser exceptions');
  } finally {
    await browser.close();
    srv.close();
  }
})().catch(e => { console.error('FAIL:', e && e.stack || e); process.exitCode = 1; });
