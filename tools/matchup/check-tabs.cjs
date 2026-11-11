// The Matchup tab's header tabs (Nov 11 2026, Evan, with the Scores tab's NFL · League buttons: "Use the header tabs
// design for the matchup section. There should be a tab for matchup of the week, press conferences, and a recap
// section for each week"). A real browser on a local server (Firebase off): on Evan's, Mason's and a visitor's
// profile, phone (390) and tablet (820): three scoreboard buttons across the full width; MOTW shows the vote, the past
// picks and head to head; Press shows the whole Press Room embedded (featured presser, archive, Ask the loser, Post)
// and an archive row stays on #/matchup; Recap lists every week's Wrap, newest first, each opening its Wrap, with
// season chips; arrow keys move between tabs; the tab is remembered across a reload; ?s=press and ?s=wrap open theirs.
// Screenshots with --shots=<dir>.   Run: node tools/matchup/check-tabs.cjs
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8) || null;
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

async function open(browser, url, me, hash, viewport) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, serviceWorkers: 'block', isMobile: viewport.width < 600, hasTouch: true});
  await context.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === url || ['data:', 'blob:'].includes(u.protocol) ? r.continue() : r.abort(); });
  await context.addInitScript(me => {
    if (window.top !== window) return; // (a blocked YouTube frame has no storage)
    if (me) localStorage.setItem('gg-me', me);
    localStorage.setItem('gg-welcome', '1');
    ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    sessionStorage.setItem('gg-skip-title', '1');
  }, me);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto(url + '/' + hash);
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  await page.locator('.v-rivals .rv-sw').waitFor({timeout: 20000});
  return {context, page, errors};
}
const sel = (page) => page.evaluate(() => [...document.querySelectorAll('.v-rivals [data-rv-mode]')].filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.dataset.rvMode).join());
const shown = (page) => page.evaluate(() => [...document.querySelectorAll('.v-rivals [data-rv-pane]')].filter(p => !p.hidden && !p.closest('[inert]') && p.getClientRects().length).map(p => p.dataset.rvPane).join());
const shot = (page, name) => shots ? page.screenshot({path: path.join(shots, `matchup-tabs-${name}.png`)}) : null;

(async () => {
  const srv = await server(), url = `http://127.0.0.1:${srv.address().port}`;
  if (shots) fs.mkdirSync(shots, {recursive: true});
  const {chromium} = playwright();
  let browser;
  for (const channel of ['chrome', undefined]) { try { browser = await chromium.launch({...(channel ? {channel} : {}), headless: true}); break; } catch (_) {} }
  try {
    for (const [me, vp] of [['evan', {width: 390, height: 844}], ['mason', {width: 320, height: 700}], ['', {width: 820, height: 1180}]]) {
      const who = `${me || 'visitor'} @${vp.width}`;
      const {context, page, errors} = await open(browser, url, me, '#/matchup', vp);
      // Three buttons across the full width, MOTW first
      const g = await page.evaluate(() => {
        const sw = document.querySelector('.v-rivals .rv-sw'), r = sw.getBoundingClientRect(), bs = [...sw.querySelectorAll('[data-rv-mode]')].map(b => b.getBoundingClientRect());
        return {n: bs.length, w: r.width, body: sw.parentElement.getBoundingClientRect().width, cols: getComputedStyle(sw).gridTemplateColumns.split(' ').length,
          last: bs.length ? bs[bs.length - 1].right - r.left : 0, h: Math.min(...bs.map(b => b.height)), minW: Math.min(...bs.map(b => b.width))};
      });
      assert.equal(g.n, 3, who + ': three tabs');
      assert.equal(g.cols, 3, who + ': three columns');
      assert.ok(Math.abs(g.last - g.w) < 2 && g.w > g.body * .85, `${who}: the tabs span the width (${g.last} of ${g.w})`);
      assert.ok(g.h >= 44 && g.minW >= 44, who + ': touch targets');
      assert.equal(await sel(page), 'motw'); assert.equal(await shown(page), 'motw');
      await page.locator('#rv-h2h').waitFor({state: 'attached'});
      assert.ok(await page.locator('[data-rv-pane="motw"] .rv-hdr').isVisible(), who + ': head to head on MOTW');
      await shot(page, `${me || 'visitor'}-${vp.width}-motw`);

      // Press: the Press Room embedded
      await page.locator('[data-rv-mode="press"]').click();
      assert.equal(await sel(page), 'press'); assert.equal(await shown(page), 'press');
      const pr = page.locator('[data-rv-pane="press"] .pr-embed');
      await pr.locator('.pr-sec-arch .pr-row').first().waitFor({timeout: 20000});
      assert.ok(await pr.locator('.pr-sec-feat .c-press').count() >= 1, who + ': the featured presser');
      assert.ok(await pr.locator('.pr-embed-post').isVisible(), who + ': Post');
      const rows = pr.locator('.pr-sec-arch .pr-row[data-pr-key]');
      const second = await rows.nth(1).getAttribute('data-pr-key');
      await rows.nth(1).click();
      await page.waitForFunction(k => { const f = document.querySelector('.v-rivals .pr-sec-feat .c-press'); return f && f.dataset.pressKey === k; }, second, {timeout: 10000});
      assert.match(await page.evaluate(() => location.hash), /^#\/matchup/, who + ': an archive row stays on Matchup');
      await page.waitForFunction(() => { const r = document.querySelector('.v-rivals .pr-sec-feat .c-press').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight / 2; }, null, {timeout: 5000});
      await shot(page, `${me || 'visitor'}-${vp.width}-press`);

      // Recap: every week's Wrap
      await page.locator('[data-rv-mode="recap"]').click();
      assert.equal(await sel(page), 'recap'); assert.equal(await shown(page), 'recap');
      const cards = page.locator('[data-rv-pane="recap"] .rv-recap');
      await cards.first().waitFor({timeout: 20000});
      const weeks = await cards.evaluateAll(a => a.map(x => +x.getAttribute('href').split('/').pop()));
      assert.ok(weeks.length >= 2 && weeks.every((w, i) => !i || w < weeks[i - 1]), `${who}: weeks newest first (${weeks})`);
      const expect = await page.evaluate(async () => { const s = await import('/js/core/stats.js'), d = await import('/js/core/data.js'); const y = (d.SEASONS.find(x => x.live) || d.SEASONS[0]).year; return s.wrapWeeks(y).filter(w => (s.wrap(y, w) || {}).headline).length; });
      assert.equal(weeks.length, expect, who + ': a recap for each week');
      assert.equal(await page.locator('.rv-paper').count(), me === 'evan' ? weeks.length : 0, who + ': newspaper covers belong to Evan');
      if (me === 'evan') {
        assert.match(await cards.first().textContent(), /The Gridiron.*Latest edition.*Read full recap/s);
        for (const width of [320, 390, 820]) {
          await page.setViewportSize({width, height: 1000});
          const layout = await cards.first().evaluate(el => {
            const r = el.getBoundingClientRect(), h = el.querySelector('.rv-paper-headline');
            return {left: r.left, right: r.right, width: innerWidth, fits: el.scrollWidth <= el.clientWidth + 1,
              headingFits: getComputedStyle(h).overflowY === 'visible' && getComputedStyle(h).webkitLineClamp === 'none',
              headline: parseFloat(getComputedStyle(h).fontSize)};
          });
          assert.ok(layout.left >= 0 && layout.right <= layout.width + 1 && layout.fits && layout.headingFits && layout.headline >= 36,
            `Newspaper fits at ${width}px with a complete, prominent headline: ${JSON.stringify(layout)}`);
          if (shots) await cards.first().screenshot({path: path.join(shots, `recap-front-page-${width}.png`)});
        }
        await page.setViewportSize(vp);
        await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
        await page.waitForFunction(() => !document.querySelector('.rv-paper') && !!document.querySelector('.rv-recap-lines'));
        await page.evaluate(async () => (await import('/js/core/data.js')).setMe('evan'));
        await page.locator('.rv-paper').first().waitFor();
      }
      const chips = page.locator('[data-rv-pane="recap"] [data-chips="rv-recap-year"] .chip');
      if (await chips.count() > 1) {
        const y2 = await chips.nth(1).getAttribute('data-value');
        await chips.nth(1).click();
        await page.waitForFunction(y => [...document.querySelectorAll('.v-rivals .rv-recap')].every(a => a.getAttribute('href').includes(`/${y}/wrap/`)), y2, {timeout: 10000});
        await chips.nth(0).click();
        await page.waitForTimeout(200);
      }
      await shot(page, `${me || 'visitor'}-${vp.width}-recap`);
      const href = await cards.first().getAttribute('href');
      const full = await page.evaluate(async href => {
        const [y, w] = href.match(/standings\/(\d+)\/wrap\/(\d+)/).slice(1).map(Number);
        const r = (await import('/js/core/stats.js')).wrap(y, w);
        return {headline: r.headline, stories: r.items.map(it => it.body).filter(Boolean)};
      }, href);
      if (me === 'evan') { await cards.first().focus(); await page.keyboard.press('Enter'); }
      else await cards.first().click();
      await page.waitForFunction(h => location.hash === h, href, {timeout: 10000});
      await page.locator('.v-wrap .wr-list').waitFor();
      const article = await page.locator('.v-wrap').innerText();
      assert.ok(article.includes(full.headline) && full.stories.every(text => article.includes(text)), who + ': opens the entire recap');
      if (me === 'evan') await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
      await page.goBack();
      await page.locator('[data-rv-pane="recap"]:not([hidden])').waitFor({timeout: 10000});
      if (me === 'evan') {
        await page.waitForFunction(() => !document.querySelector('.rv-paper') && !!document.querySelector('.rv-recap-lines'));
        await page.evaluate(async () => (await import('/js/core/data.js')).setMe('evan'));
        await page.locator('.rv-paper').first().waitFor();
      }

      // Arrow keys, then a reload remembers the tab
      await page.locator('[data-rv-mode="recap"]').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await sel(page), 'motw', who + ': ArrowRight wraps to MOTW');
      await page.keyboard.press('End');
      assert.equal(await sel(page), 'recap');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await sel(page), 'press');
      await page.reload();
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      await page.locator('.v-rivals [data-rv-mode="press"][aria-selected="true"]').waitFor({timeout: 20000});
      assert.equal(await shown(page), 'press', who + ': remembered across a reload');
      assert.deepEqual(errors, [], who + ': no browser exceptions');
      console.log(`PASS ${who}: tabs ${g.w}px wide; Press embedded (featured ${second}); ${weeks.length} recaps; keys and reload`);
      await context.close();
    }
    // Links open their tab
    for (const [q, mode] of [['press', 'press'], ['wrap', 'recap'], ['motw', 'motw']]) {
      const {context, page, errors} = await open(browser, url, 'mason', '#/matchup?s=' + q, {width: 390, height: 844});
      await page.waitForTimeout(800);
      assert.equal(await sel(page), mode, `?s=${q} opens ${mode}`);
      assert.equal(await shown(page), mode);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: ?s=press, ?s=wrap and ?s=motw open their tabs');
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
