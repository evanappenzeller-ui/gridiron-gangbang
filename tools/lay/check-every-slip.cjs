// The Lay's "Every slip" keeps every week (Nov 23 2026, Evan: "Ensure the lay shows up on the 'every slip' section after
// each week"): a week whose legs are only in the app (not in data/lay.json yet) still gets its slip after the league
// moves on, graded from ESPN's box scores (views/lay.js wantWeeks/ensureWatched, core/laytrack.js). In a real browser on
// a local server (Firebase off: the legs are the dev stand-in's, 'gg-dev-lay'), for Evan and a visitor:
//   1. data/lay.json served without weeks 9 and 10, their legs in the app instead, ESPN answering from
//      tools/lay/fixtures (2026 weeks 9 and 10, trimmed): both weeks have their slip, each leg graded as data/lay.json
//      grades it (Dresden's two legs, players who never played, stay open), with what it came to under it;
//   2. the real data/lay.json: weeks 1-10 each have exactly one slip, as before.
// Usage: node tools/lay/check-every-slip.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const FIX = path.join(__dirname, 'fixtures');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2'};
const LAY = JSON.parse(fs.readFileSync(path.join(root, 'data/lay.json'), 'utf8'));
const NFL = {9: JSON.parse(fs.readFileSync(path.join(FIX, 'nfl-2026-w9.json'), 'utf8')), 10: JSON.parse(fs.readFileSync(path.join(FIX, 'nfl-2026-w10.json'), 'utf8'))};
const OTHER_SB = JSON.parse(fs.readFileSync(path.join(root, 'tools/live/fixtures/nfl-scoreboard.json'), 'utf8'));
const APP_WEEKS = [9, 10];

function server(layOverride) {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/data/lay.json' && layOverride) { res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(layOverride)); return; }
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
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}
function espn(u) {
  if (/\/nfl\/scoreboard$/.test(u.pathname)) {
    const wk = Number(u.searchParams.get('week'));
    return NFL[wk] ? NFL[wk].scoreboard : OTHER_SB;
  }
  if (/\/nfl\/summary$/.test(u.pathname)) {
    const id = u.searchParams.get('event');
    const hit = [9, 10].map(w => NFL[w].summaries[id]).find(Boolean);
    return hit || null;
  }
  return null;
}
// Every leg of weeks 9 and 10, as the app would hold them (by slot: the leg's manager, or whom it was entered for).
function appLegs() {
  const out = {};
  LAY.weeks.filter(w => w.year === 2026 && APP_WEEKS.includes(w.week)).forEach(w => {
    const k = `2026-w${w.week}`;
    out[k] = {};
    w.legs.forEach(l => { out[k][l.for || l.by] = {bet: l.bet, me: l.by, nick: l.by, at: '2026-11-08T12:00:00Z'}; });
  });
  return out;
}
async function open(browser, url, me, legs) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
  await context.route('https://**/*', route => {
    const u = new URL(route.request().url());
    const j = u.hostname === 'site.api.espn.com' ? espn(u) : null;
    if (j) return route.fulfill({json: j, headers: {'access-control-allow-origin': '*'}});
    if (u.hostname === 'site.api.espn.com') return route.fulfill({status: 404, json: {}, headers: {'access-control-allow-origin': '*'}});
    return route.abort();
  });
  await context.addInitScript(([me, legs]) => {
    if (me) localStorage.setItem('gg-me', me);
    localStorage.setItem('gg-welcome', '1');
    ['evan', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    if (legs) localStorage.setItem('gg-dev-lay', JSON.stringify(legs));
  }, [me, legs]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto(url + '/#/lay');
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  return {context, page, errors};
}
const slips = page => page.evaluate(() => [...document.querySelectorAll('[data-ly-slip]')].map(d => d.dataset.lySlip));

(async () => {
  const {chromium} = require('playwright');
  const browser = await chromium.launch();
  let srv = null;
  try {
    // 1. Weeks 9 and 10 only in the app.
    const file = Object.assign({}, LAY, {weeks: LAY.weeks.filter(w => !(w.year === 2026 && APP_WEEKS.includes(w.week)))});
    srv = await server(file);
    const url = `http://127.0.0.1:${srv.address().port}`;
    for (const me of ['evan', '']) {
      const tag = me || 'visitor';
      const {context, page, errors} = await open(browser, url, me, appLegs());
      for (const wk of APP_WEEKS) {
        const want = LAY.weeks.find(w => w.year === 2026 && w.week === wk);
        const hits = want.legs.filter(l => l.hit === true).length, miss = want.legs.filter(l => l.hit === false).length;
        await page.waitForFunction(([wk, res]) => { const r = document.querySelector(`[data-ly-slip="2026-${wk}"] .ly-slip-res`); return r && r.textContent === res; },
          [wk, `${hits}/12`], {timeout: 60000});
        const got = await page.evaluate(wk => [...document.querySelectorAll(`[data-ly-slip="2026-${wk}"] .ly-cl`)].map(li => ({
          bet: li.querySelector('.ly-cl-bet').textContent, st: li.classList.contains('is-hit') ? true : li.classList.contains('is-miss') ? false : null,
          stat: (li.querySelector('.ly-cl-stat') || {}).textContent || ''})), wk);
        assert.equal(got.length, 12, `${tag}: week ${wk} has twelve legs`);
        want.legs.forEach(l => {
          const g = got.find(x => x.bet === l.bet && x.st === l.hit);
          assert.ok(g, `${tag}: week ${wk} "${l.bet}" graded ${l.hit} as in data/lay.json (got ${JSON.stringify(got.filter(x => x.bet === l.bet))})`);
          if (l.hit !== null) assert.ok(g.stat, `${tag}: week ${wk} "${l.bet}" says what it came to`);
        });
        const sub = await page.locator(`[data-ly-slip="2026-${wk}"] .ly-slip-sub`).innerText();
        assert.match(sub, new RegExp(`${miss} missed`), `${tag}: week ${wk} ${miss} missed`);
        console.log(`PASS ${tag}: week ${wk} from the app's legs: ${hits}/12, ${miss} missed, ${12 - hits - miss} open`);
      }
      const ids = await slips(page);
      assert.deepEqual(ids.filter(k => /^2026-/.test(k)).map(k => +k.split('-')[1]).filter(w => w <= 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `${tag}: weeks 1-10 in order, once each`);
      assert.deepEqual(errors, [], `${tag}: no browser exceptions`);
      await context.close();
    }
    srv.close();
    // 2. The real file: one slip a week, as before.
    srv = await server(null);
    const url2 = `http://127.0.0.1:${srv.address().port}`;
    const {context, page, errors} = await open(browser, url2, 'evan', null);
    await page.waitForSelector('[data-ly-slip="2026-10"]', {timeout: 30000});
    await page.waitForTimeout(1500);
    const ids = await slips(page);
    assert.deepEqual(ids.filter(k => /^2026-/.test(k)).map(k => +k.split('-')[1]).filter(w => w <= 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the real file: weeks 1-10 once each');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS the real data/lay.json: weeks 1-10, one slip each');
    console.log('PASS: every week keeps its slip');
  } catch (e) {
    console.error('FAIL:', e && e.stack || e);
    process.exitCode = 1;
  } finally { await browser.close(); if (srv) srv.close(); }
})();
