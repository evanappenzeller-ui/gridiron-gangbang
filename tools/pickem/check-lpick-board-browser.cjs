// The League pick'em leaderboard (views/lpick.js, core/lpick.js) in a real browser, for Evan, another member and a
// visitor. Local only: the app is served from this folder with Firebase disabled; crafted board docs carry League
// picks for weeks 7 and 8 (both final in the league file), so the Season table has rows while this week is open.
// Checks: the summary card's Leaderboard row (your place this season) opens the sheet (This week / Season, rank 1 in
// gold with a crown, % right, weeks and weeks won); the inline board defaults to Season while the week is open; then
// the kit checks "League pick'em".
// Usage: node tools/pickem/check-lpick-board-browser.cjs [--shots=<dir>]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
const snap = (page, name) => (shots ? page.screenshot({path: path.join(shots, name + '.png')}) : Promise.resolve());

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

const PROFILES = [{tag: 'evan', me: 'evan'}, {tag: 'mason', me: 'mason'}, {tag: 'visitor', me: 'none'}];

async function run(url) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const p of PROFILES) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'dark'});
      await context.route('https://**/*', route => route.abort());
      await context.addInitScript(p => {
        localStorage.setItem('gg-me', p.me);
        localStorage.setItem('gg-welcome', '1');
        ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      }, p);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e));
      page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
      await page.goto(url + '/#/pickem');
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      await page.waitForSelector('[data-pk-sport="lg"]', {timeout: 20000});
      await page.locator('[data-pk-sport="lg"]').first().click();
      await page.waitForSelector('.lp-main .lp-sum', {timeout: 20000});
      // The board: crafted docs (the visitor sees everyone; Evan's and Mason's own rows are theirs).
      const seeded = await page.evaluate(async me => {
        const daily = await import('/js/core/daily.js'), LP = await import('/js/core/lpick.js'), week = await import('/js/core/week.js'), data = await import('/js/core/data.js');
        const y = 2026, H = 36e5;
        const side = (wk, n) => Object.fromEntries(LP.gamesOf(y, wk).map((g, i) => { const r = LP.resultOf(y, wk, g.a, g.b); const w = r.winner || g.a; return [g.id, i < n ? w : (w === g.a ? g.b : g.a)]; }));
        const doc = (id, mid, weeks) => ({id, nick: data.name(mid), total: 0, [LP.F]: Object.fromEntries(weeks.map(([wk, n]) => [week.weekKey(y, wk), {p: side(wk, n), t: week.lockTime(y, wk).getTime() - H}]))});
        const list = [doc('u-jayton', 'jayton', [[7, 6], [8, 3]]), doc('u-mitch', 'mitch', [[7, 4], [8, 5]]), doc('u-john', 'john', [[8, 5]])];
        if (me !== 'none') list.push(doc('u-me', me, [[7, 5], [8, 4]]));
        daily.LB.uid = me !== 'none' ? 'u-me' : 'u-visitor';
        daily.LB.raw = list; daily.LB.players = list;
        daily.__dev.emit('lb', {prev: [], why: 'snapshot'});
        return {open: !!LP.current() && !LP.current().locked, rows: LP.seasonRows(y).map(r => `${r.rank}. ${r.name} ${r.right}-${r.wrong} won ${r.won}`)};
      }, p.me);
      await page.waitForSelector('.lp-board .lp-r', {timeout: 10000});
      const inline = await page.evaluate(() => ({
        seg: document.querySelector('.lp-board [aria-checked="true"], .lp-board [aria-selected="true"], .lp-board .is-on') && document.querySelector('.lp-board [aria-checked="true"], .lp-board [aria-selected="true"], .lp-board .is-on').textContent.trim(),
        rows: [...document.querySelectorAll('.lp-board .lp-r')].map(r => r.textContent), gold: document.querySelectorAll('.lp-board .lp-r-k.gold').length,
        crown: document.querySelectorAll('.lp-board .av-crown').length, link: document.querySelector('.lp-sum-more') && document.querySelector('.lp-sum-more').getAttribute('aria-label')}));
      assert.equal(inline.rows.length, p.me === 'none' ? 3 : 4, p.tag + ': everyone with picks on the season board ' + JSON.stringify(inline.rows));
      if (seeded.open) assert.match(inline.seg || '', /Season/, p.tag + ': Season while the week is open');
      assert.ok(inline.gold >= 1 && inline.crown >= 1, p.tag + ': the leader in gold with a crown');
      assert.ok(inline.rows.some(r => /% right/.test(r) && /won/.test(r)), p.tag + ': % right and weeks won ' + JSON.stringify(inline.rows));
      assert.match(inline.link, p.me === 'none' ? /Leaderboard: .+ leads, \d+–\d+ this season/ : /Leaderboard: You're \d+(st|nd|rd|th) of 4 this season/, p.tag + ': the summary row ' + inline.link);
      await snap(page, p.tag + '-lpick');
      await page.locator('.lp-board').scrollIntoViewIfNeeded();
      await snap(page, p.tag + '-lpick-board');
      await page.locator('.lp-sum-more').click();
      await page.waitForSelector('.sh-lp-board .lp-r', {timeout: 10000});
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.sh-lp-board .lp-r').count(), inline.rows.length, p.tag + ': the sheet’s season table');
      assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.sh-lp-board .lp-r')).display === 'flex'), p.tag + ': the sheet’s rows are styled');
      await snap(page, p.tag + '-lpick-sheet');
      await page.locator('.sh-lp-board .seg button, .sh-lp-board .seg [role="radio"], .sh-lp-board .seg [role="tab"]').filter({hasText: 'This week'}).first().click();
      await page.waitForTimeout(400);
      const wk = await page.evaluate(() => document.querySelector('.sh-lp-board .lp-bs-body').textContent);
      if (seeded.open) assert.match(wk, /show here once they lock/, p.tag + ': this week stays hidden until the lock');
      await snap(page, p.tag + '-lpick-sheet-week');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      console.log(`${p.tag}: ${inline.rows.length} rows; ${inline.link.trim()}`);
      if (p.tag === 'evan') {
        const out = await page.evaluate(async () => {
          const {runChecks} = await import('/js/core/checks.js');
          return (await runChecks()).filter(c => /^League pick'em/.test(c.name)).map(c => ({name: c.name.slice(0, 60), pass: c.pass, detail: c.detail}));
        });
        out.forEach(c => console.log(`${c.pass ? 'pass' : 'FAIL'} ${c.name}… ${c.detail}`));
        assert.ok(out.length >= 3 && out.every(c => c.pass), 'kit checks pass');
      }
      assert.deepEqual(errors, [], p.tag + ': unexpected browser exceptions');
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('PASS: the League pick’em leaderboard');
}

server().then(async s => {
  try { await run(`http://127.0.0.1:${s.address().port}`); }
  catch (e) { console.error(e); process.exitCode = 1; }
  finally { s.close(); }
});
