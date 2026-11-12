// Questions league members send the manager (Nov 11 2026, Evan: "Add a section in the press conference where league
// members can submit questions to the manager"). A real browser on a local server (Firebase off, so saves go to the
// dev stand-in in this browser; the week's Matchup of the Week loser is faked with press.__dev.loser): the Press Room
// kit checks on Mason's, Ben's and a visitor's profile; then the "Ask {loser}" section for the latest finished week
// without a presser: Mason sends, changes and takes back questions (three a week at most) from the ask sheet, which a
// profile change closes; the loser sees them and can't ask himself; a visitor reads them with no Ask; once the presser is
// posted the section goes and the questions sit under its "Questions from the press". Phone (390) and tablet (820).
// Screenshots: ../output/press-ask-*.png.   Run: node tools/press/check-ask.cjs
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
const LOSER = 'ben', OPP = 'mason';

// Opens the Press Room as `me` with the stand-in stores carried over, the target week's loser faked before it loads.
async function open(browser, url, me, stores = {}, viewport = {width: 390, height: 844}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, serviceWorkers: 'block', isMobile: viewport.width < 600, hasTouch: true});
  await context.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === url || ['data:', 'blob:'].includes(u.protocol) ? r.continue() : r.abort(); });
  await context.addInitScript(([me, stores]) => {
    if (window.top !== window) return; // (a blocked YouTube frame has no storage)
    if (me) localStorage.setItem('gg-me', me);
    localStorage.setItem('gg-welcome', '1');
    ['evan', 'mason', 'ben', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    if (!sessionStorage.getItem('ask-seeded')) { Object.entries(stores).forEach(([k, v]) => { if (v) localStorage.setItem(k, v); }); sessionStorage.setItem('ask-seeded', '1'); }
    sessionStorage.setItem('gg-skip-title', '1');
  }, [me, stores]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto(url + '/#/');
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  const target = await page.evaluate(async ([who, opp]) => {
    const press = await import('/js/core/press.js');
    await press.loadSeed();
    const d = press.defaultWeek(), key = `${d.year}-w${d.week}`;
    press.__dev.loser(key, {who, opp, key, voted: true});
    return {key, week: d.week, over: press.weekOver(d.year, d.week)};
  }, [LOSER, OPP]);
  await page.evaluate(() => { location.hash = '#/press'; });
  await page.locator('.pr-main [data-pr-sec="arch"], .pr-main [data-pr-sec="empty"]').first().waitFor({timeout: 20000});
  await page.waitForTimeout(400);
  return {context, page, errors, target};
}
const stores = page => page.evaluate(() => ({'gg-dev-press-sent': localStorage.getItem('gg-dev-press-sent'), 'gg-dev-press': localStorage.getItem('gg-dev-press')}));
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
async function ask(page, text) {
  await page.locator('[data-pr-sask]').click();
  const sheet = page.locator('.sh-ask');
  await sheet.waitFor();
  assert.equal(await sheet.locator('[data-ask-send]').isDisabled(), true, 'Send stays off till there is a question');
  await sheet.locator('#pq-q').fill(text);
  await sheet.locator('[data-ask-send]').click();
  await sheet.waitFor({state: 'detached'});
  await page.locator('.pr-ask .pr-q.is-mine').filter({hasText: text}).waitFor({timeout: 10000});
}

(async () => {
  const srv = await server(), url = `http://127.0.0.1:${srv.address().port}`, out = path.resolve(root, '../output');
  fs.mkdirSync(out, {recursive: true});
  const {chromium} = playwright();
  let browser;
  for (const channel of ['chrome', undefined]) { try { browser = await chromium.launch({...(channel ? {channel} : {}), headless: true}); break; } catch (_) {} }
  try {
    for (const me of ['mason', 'ben', '']) {
      const {context, page, errors} = await open(browser, url, me);
      const res = await kit(page), bad = res.filter(r => !r.pass), q = res.find(r => /questions members send/.test(r.name));
      console.log(`${me || 'visitor'}: ${res.length - bad.length}/${res.length} Press Room checks pass; sent questions: ${q ? q.detail : 'missing'}`);
      bad.forEach(r => console.log('  FAIL', r.name, '\n   ', r.detail.slice(0, 400)));
      assert.equal(bad.length, 0, 'Every Press Room kit check passes for ' + (me || 'visitor'));
      assert.deepEqual(errors, [], 'No browser exceptions');
      await context.close();
    }

    // Mason asks Ben
    const M = await open(browser, url, 'mason'), page = M.page, T = M.target;
    assert.ok(T.over, `the target week (${T.key}) is finished`);
    const sec = page.locator('.pr-ask');
    await sec.waitFor({timeout: 20000});
    assert.match(await sec.locator('#pr-ask-h').innerText(), /^Ask Ben$/);
    assert.match(await sec.innerText(), new RegExp(`Ben faces the media for week ${T.week}[\\s\\S]*No questions yet`));
    await page.screenshot({path: path.join(out, 'press-ask-empty.png'), fullPage: false});
    await sec.scrollIntoViewIfNeeded();
    await page.locator('[data-pr-sask]').click();
    await page.locator('.sh-ask').waitFor();
    await page.locator('.sh-ask #pq-q').fill('Coach, why start a kicker at flex?');
    await page.waitForTimeout(350);
    await page.screenshot({path: path.join(out, 'press-ask-sheet.png')});
    await page.locator('.sh-ask [data-ask-send]').click();
    await page.locator('.sh-ask').waitFor({state: 'detached'});
    await sec.locator('.pr-q.is-mine').filter({hasText: 'kicker at flex'}).waitFor({timeout: 10000});
    assert.match(await sec.innerText(), /Mason \(you\)[\s\S]*kicker at flex/);
    console.log(`PASS: Mason sent Ben a question for ${T.key} from the ask sheet`);

    await ask(page, 'Second question');
    await ask(page, 'Third question');
    assert.equal(await page.locator('[data-pr-sask]').count(), 0, 'No Ask after three');
    assert.match(await sec.innerText(), /You’ve sent 3, the most for a week/);
    await sec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({path: path.join(out, 'press-ask-three.png')});
    console.log('PASS: three a week, then the Ask button gives way to a note');

    await sec.locator('.pr-q.is-mine').filter({hasText: 'Second question'}).locator('[data-pr-sedit]').click();
    const sheet = page.locator('.sh-ask');
    await sheet.waitFor();
    assert.equal(await sheet.locator('#pq-q').inputValue(), 'Second question');
    await sheet.locator('#pq-q').fill('Second, changed');
    await sheet.locator('[data-ask-send]').click();
    await sheet.waitFor({state: 'detached'});
    await sec.locator('.pr-q.is-mine').filter({hasText: 'Second, changed'}).waitFor({timeout: 10000});
    await sec.locator('.pr-q.is-mine').filter({hasText: 'Third question'}).locator('[data-pr-sedit]').click();
    await sheet.waitFor();
    await sheet.locator('[data-ask-del]').click();
    await page.locator('.as-btn.is-destructive').click();
    await sheet.waitFor({state: 'detached'});
    await page.waitForTimeout(400);
    assert.equal(await sec.locator('.pr-q').count(), 2, 'Two left after taking one back');
    assert.equal(await page.locator('[data-pr-sask]').count(), 1, 'Ask is back');
    console.log('PASS: changed one, took one back; Ask another question is back');

    // A profile change closes the sheet without sending
    await page.locator('[data-pr-sask]').click();
    await sheet.waitFor();
    await sheet.locator('#pq-q').fill('Never sent');
    await page.evaluate(async () => { (await import('/js/core/data.js')).setMe('jaymin'); });
    await sheet.waitFor({state: 'detached', timeout: 5000});
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.pr-ask .pr-q').filter({hasText: 'Never sent'}).count(), 0);
    assert.equal(await page.locator('.pr-ask .pr-q.is-mine').count(), 0, 'Jaymin owns none of Mason’s');
    console.log('PASS: a profile change closes the ask sheet without sending; Mason’s rows stop being editable');
    const st = await stores(page);
    assert.deepEqual(M.errors, [], 'No browser exceptions (Mason)');
    await M.context.close();

    // Ben, the loser: reads them, can't ask himself
    const B = await open(browser, url, 'ben', st);
    const bs = B.page.locator('.pr-ask');
    await bs.locator('.pr-q').first().waitFor({timeout: 20000});
    assert.match(await bs.innerText(), new RegExp(`your week ${T.week} press conference[\\s\\S]*kicker at flex[\\s\\S]*Second, changed`));
    assert.equal(await B.page.locator('[data-pr-sask], [data-pr-sedit]').count(), 0, 'Ben has no Ask or edit');
    const self = await B.page.evaluate(async key => (await (await import('/js/core/press.js')).sendQuestion({week: key, q: 'x', to: 'ben'})).r, T.key);
    assert.equal(self, 'self');
    await bs.scrollIntoViewIfNeeded();
    await B.page.screenshot({path: path.join(out, 'press-ask-loser.png')});
    console.log('PASS: Ben sees the league’s questions for him, with no Ask (and the core refuses him: self)');
    assert.deepEqual(B.errors, []);
    await B.context.close();

    // A visitor (tablet): reads them, no Ask
    const V = await open(browser, url, '', st, {width: 820, height: 1180});
    const vs = V.page.locator('.pr-ask');
    await vs.locator('.pr-q').first().waitFor({timeout: 20000});
    assert.equal(await V.page.locator('[data-pr-sask], [data-pr-sedit]').count(), 0);
    assert.match(await vs.innerText(), /League members can send questions from their own profile/);
    await vs.scrollIntoViewIfNeeded();
    await V.page.screenshot({path: path.join(out, 'press-ask-visitor-tablet.png')});
    console.log('PASS: a visitor reads them (tablet), with no Ask');
    assert.deepEqual(V.errors, []);
    await V.context.close();

    // Evan posts Ben's presser: the questions close and move under it
    const E = await open(browser, url, 'evan', st);
    await E.page.locator('.pr-ask [data-pr-sask]').waitFor({timeout: 20000});
    const posted = await E.page.evaluate(async key => {
      const press = await import('/js/core/press.js'), [y, w] = key.split('-w').map(Number);
      return press.post({year: y, week: w, vid: 'dQw4w9WgXcQ', who: 'ben', title: 'Ben faces the media'});
    }, T.key);
    assert.equal(posted, 'dev');
    await E.page.evaluate(key => { location.hash = '#/press/' + key; }, T.key);
    await E.page.locator('.pr-qs:not(.pr-ask) .pr-q').filter({hasText: 'kicker at flex'}).waitFor({timeout: 20000});
    await E.page.waitForTimeout(500);
    assert.equal(await E.page.locator('.pr-ask').count(), 0, 'The Ask section goes once the presser is posted');
    assert.equal(await E.page.locator('.pr-qs:not(.pr-ask) .pr-q').filter({hasText: /kicker at flex|Second, changed/}).count(), 2);
    const closed = await E.page.evaluate(async key => (await (await import('/js/core/press.js')).sendQuestion({week: key, q: 'Late', to: 'ben'})).r, T.key);
    assert.equal(closed, 'closed');
    await E.page.locator('.pr-qs:not(.pr-ask)').scrollIntoViewIfNeeded();
    await E.page.screenshot({path: path.join(out, 'press-ask-posted.png')});
    console.log('PASS: posted: the Ask section goes, the sent questions sit under Questions from the press, and new ones are closed');
    assert.deepEqual(E.errors, []);
    await E.context.close();
    console.log('PASS: no browser exceptions');
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
