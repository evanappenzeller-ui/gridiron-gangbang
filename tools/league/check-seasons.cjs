// League › Seasons (Nov 28 2026; Evan: "Add a regular season standings and playoff bracket for previous seasons under the
// league tab"). In a real browser on a local server (Firebase off, outside hosts blocked):
//   1. the League tab has five segments (Standings · Seasons · Trophies · Records · Shame), none cut off at 320/360/390;
//   2. Seasons lists every finished season, newest first and chosen; its Standings is each season's regular-season
//      table, checked against the league file's games (records, points, seeds by record then points, the bye and
//      playoff lines), and the seeds match the real bracket (byes 1 and 2, quarterfinals 3 v 6 and 4 v 5);
//   3. its Bracket draws every season's playoffs: each semifinal under the quarterfinal that fed it, the byes, the
//      championship with the champion crowned and his path in gold, third place and the consolation games;
//   4. a game opens its matchup sheet; the year chips and the view switch keep the link (?y=&v=) and this phone's
//      choice; a deep link opens its season and view; no sideways scroll at 320/390/820; the tree fits at 320.
// Usage: node tools/league/check-seasons.cjs [--shots=<dir>]
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..'), pw = require('playwright');
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg'};
const server = http.createServer((req, res) => {
  let p = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (!p.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(p, (e, b) => {
    if (e) return res.writeHead(404).end();
    if (p.endsWith('index.html')) b = Buffer.from(b.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.setHeader('Content-Type', mime[path.extname(p)] || 'application/octet-stream'); res.end(b);
  });
});
const LEAGUE = JSON.parse(fs.readFileSync(path.join(root, 'data/league.json'), 'utf8'));
const DONE = LEAGUE.seasons.filter(s => !s.inProgress && (s.matchups || []).some(g => g.type === 'final'));

/** The regular-season table from the file's games alone: record (ties half), then points for. */
function tableOf(s) {
  const T = {};
  const row = id => (T[id] = T[id] || {id, w: 0, l: 0, t: 0, pf: 0, pa: 0});
  for (const g of s.matchups.filter(x => !x.type || x.type === 'reg')) {
    const a = row(g.a), b = row(g.b);
    a.pf += g.sa; a.pa += g.sb; b.pf += g.sb; b.pa += g.sa;
    if (g.sa > g.sb) { a.w++; b.l++; } else if (g.sb > g.sa) { b.w++; a.l++; } else { a.t++; b.t++; }
  }
  return Object.values(T).sort((x, y) => (y.w + y.t / 2) - (x.w + x.t / 2) || y.pf - x.pf);
}

async function open(browser, url, hash, vp = {width: 390, height: 844}, init = {}) {
  const context = await browser.newContext({viewport: vp, serviceWorkers: 'block'});
  await context.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === url || ['data:', 'blob:'].includes(u.protocol) ? r.continue() : r.abort(); });
  await context.addInitScript(o => {
    localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1'); sessionStorage.setItem('gg-skip-title', '1');
    for (const [k, v] of Object.entries(o)) if (!sessionStorage.getItem('seeded-' + k)) { localStorage.setItem(k, v); sessionStorage.setItem('seeded-' + k, '1'); }
  }, init);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto(`${url}/#${hash}`);
  await page.waitForFunction(() => window.__ggBooted);
  await page.locator('.v-league .hl-body').waitFor();
  await page.waitForTimeout(500);
  return {context, page, errors};
}
const body = page => page.locator('.v-league .hl-body[data-seg="seasons"]');

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch();
  try {
    // 1. five segments, none cut off
    for (const w of [320, 360, 390]) {
      const {context, page, errors} = await open(browser, url, '/league/standings', {width: w, height: 800});
      const segs = await page.$$eval('.hl-seg .seg > button', bs => bs.map(b => [b.textContent, b.scrollWidth - b.clientWidth]));
      assert.deepEqual(segs.map(x => x[0]), ['Standings', 'Seasons', 'Trophies', 'Records', 'Shame'], 'the League segments');
      assert.ok(segs.every(x => x[1] <= 0), `no segment cut off at ${w}: ` + JSON.stringify(segs));
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS five League segments, none cut off at 320/360/390');

    // 2-3. every finished season's standings and bracket
    const {context, page, errors} = await open(browser, url, '/league/seasons', {width: 390, height: 844});
    const chips = await page.$$eval('[data-chips="ls-year"] > .chip', bs => bs.map(b => [Number(b.dataset.value), b.getAttribute('aria-pressed')]));
    const years = DONE.map(s => s.year).sort((a, b) => b - a);
    assert.deepEqual(chips.map(c => c[0]), years, 'every finished season, newest first');
    assert.equal(chips[0][1], 'true', 'the newest season is chosen');
    for (const s of DONE) {
      // standings
      await page.locator(`[data-chips="ls-year"] > .chip[data-value="${s.year}"]`).click();
      await page.locator('[data-seg="ls-view"] > button[data-value="standings"]').click();
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => location.hash), `#/league/seasons?y=${s.year}&v=standings`, 'the link follows');
      const rows = await body(page).locator('.sea-row').evaluateAll(rs => rs.map(r => ({id: r.dataset.key, seed: Number(r.querySelector('.sea-seed').textContent), rec: r.querySelector('.sea-trail .n4').textContent, pf: r.querySelector('.sea-pf').textContent})));
      const want = tableOf(s);
      assert.equal(rows.length, want.length, `${s.year}: every team`);
      want.forEach((w, i) => {
        const rec = w.t ? `${w.w}–${w.l}–${w.t}` : `${w.w}–${w.l}`;
        assert.equal(rows[i].id, w.id, `${s.year} seed ${i + 1} is ${w.id}`);
        assert.equal(rows[i].seed, i + 1);
        assert.equal(rows[i].rec.replace(/-/g, '–'), rec, `${s.year} ${w.id} record`);
        assert.ok(rows[i].pf.includes(w.pf.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})), `${s.year} ${w.id} points for: ${rows[i].pf}`);
      });
      const lines = await body(page).locator('.sea-line').evaluateAll(ls => ls.map(l => l.textContent.trim()));
      assert.deepEqual(lines, ['Bye line', 'Playoff line'], `${s.year}: the bye and playoff lines`);
      // the seeds are the real bracket's: byes 1 and 2, quarterfinals 3 v 6 and 4 v 5
      const seed = Object.fromEntries(want.map((w, i) => [w.id, i + 1]));
      const qf = s.matchups.filter(g => g.type === 'quarter').map(g => [seed[g.a], seed[g.b]].sort((a, b) => a - b).join('v')).sort();
      assert.deepEqual(qf, ['3v6', '4v5'], `${s.year}: the quarterfinals match the seeds`);
      // bracket
      await page.locator('[data-seg="ls-view"] > button[data-value="bracket"]').click();
      await page.waitForTimeout(250);
      const br = await body(page).evaluate(b => ({
        cards: [...b.querySelectorAll('.ls-tree .ls-m')].map(m => [...m.querySelectorAll('.ls-side')].map(x => x.querySelector('.ls-nm').textContent.trim())),
        crown: (b.querySelector('.ls-m.is-final .ls-side.is-win .c-crown') || {}).closest ? b.querySelector('.ls-m.is-final .ls-side.is-win .ls-nm').textContent.trim() : null,
        champ: (b.querySelector('.ls-champ b') || {}).textContent,
        byes: [...b.querySelectorAll('.ls-bye b')].map(x => x.textContent),
        gold: b.querySelectorAll('.ls-tree .is-champ').length,
        third: b.querySelectorAll('.ls-third .ls-m').length,
        consol: b.querySelectorAll('.ls-consol [data-game]').length,
        labels: [...b.querySelectorAll('.ls-rd, .ls-mid-t')].map(x => x.textContent)
      }));
      const nm = id => LEAGUE.managers.find(m => m.id === id).name;
      const win = g => (g.sa > g.sb ? g.a : g.b);
      const fin = s.matchups.find(g => g.type === 'final'), sfs = s.matchups.filter(g => g.type === 'semi'), qfs = s.matchups.filter(g => g.type === 'quarter');
      assert.equal(br.cards.length, qfs.length + sfs.length + 1, `${s.year}: the tree's games`);
      assert.equal(br.crown, nm(win(fin)), `${s.year}: the champion is crowned`);
      assert.equal(br.champ, nm(win(fin)), `${s.year}: and named`);
      assert.deepEqual(br.byes.slice().sort(), [nm(want[0].id), nm(want[1].id)].sort(), `${s.year}: the byes`);
      // each semifinal sits under the quarterfinal that fed it (same column)
      const cols = await body(page).evaluate(b => [...b.querySelectorAll('.ls-tree > .ls-cell')].map(c => { const m = c.querySelector('.ls-m'); return m ? [Math.round(m.getBoundingClientRect().left), [...m.querySelectorAll('.ls-nm')].map(x => x.textContent.trim())] : null; }).filter(Boolean));
      for (const q of qfs) {
        const qc = cols.find(c => c[1].includes(nm(q.a)) && c[1].includes(nm(q.b)));
        const sc = cols.find(c => c !== qc && c[1].includes(nm(win(q))) && sfs.some(x => [x.a, x.b].includes(win(q))) && c[1].length === 2 && !(c[1].includes(nm(q.a)) && c[1].includes(nm(q.b))));
        assert.ok(qc && sc && qc[0] === sc[0], `${s.year}: ${nm(win(q))}'s quarterfinal feeds the semifinal under it`);
      }
      // the champion's path in gold: his semifinal half of the join, and his quarterfinal's line if he played one
      const champQf = qfs.some(q => win(q) === win(fin));
      assert.equal(br.gold, 1 + (champQf ? 1 : 0), `${s.year}: the champion's path is gold`);
      assert.equal(br.third, s.matchups.some(g => g.type === 'third') ? 1 : 0, `${s.year}: third place`);
      assert.equal(br.consol, s.matchups.filter(g => g.type === 'consol').length, `${s.year}: every consolation game`);
      assert.ok(br.labels.some(l => /Quarterfinals/.test(l)) && br.labels.some(l => /Semifinals/.test(l)) && br.labels.some(l => /Championship/.test(l)), `${s.year}: every round labelled`);
      if (shots) await page.screenshot({path: path.join(shots, `bracket-${s.year}.png`), fullPage: true});
    }
    console.log(`PASS ${DONE.length} seasons: standings checked against the games, seeds match the brackets, every bracket drawn`);
    // 4. a game opens its matchup sheet
    await page.locator('.ls-m.is-final').click();
    await page.locator('.sheet .mu-bug, .sheet .bug').first().waitFor({timeout: 5000});
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    // the choice is kept: reload
    const before = await page.evaluate(() => location.hash);
    await page.reload(); await page.waitForFunction(() => window.__ggBooted); await body(page).waitFor(); await page.waitForTimeout(400);
    assert.equal(await page.locator('[data-chips="ls-year"] > .chip[aria-pressed="true"]').getAttribute('data-value'), new URL('http://x/' + before.slice(2)).searchParams.get('y'), 'a reload keeps the season');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS a game opens its matchup; a reload keeps the season');

    // deep link, a phone's saved choice, widths
    {
      const {context, page, errors} = await open(browser, url, '/league/seasons?y=2022&v=bracket');
      assert.equal(await page.locator('[data-chips="ls-year"] > .chip[aria-pressed="true"]').getAttribute('data-value'), '2022');
      assert.equal(await page.locator('[data-seg="ls-view"] > button[aria-selected="true"]').getAttribute('data-value'), 'bracket');
      assert.ok(await body(page).locator('.ls-tree').count() === 1, 'the deep link opens the bracket');
      // the segment control from Standings comes back to the phone's last season and view
      await page.locator('.hl-seg .seg > button[data-value="standings"]').click(); await page.waitForTimeout(400);
      await page.locator('.hl-seg .seg > button[data-value="seasons"]').click(); await page.waitForTimeout(400);
      assert.equal(await page.locator('[data-chips="ls-year"] > .chip[aria-pressed="true"]').getAttribute('data-value'), '2022', 'back to the season left');
      assert.equal(await page.locator('[data-seg="ls-view"] > button[aria-selected="true"]').getAttribute('data-value'), 'bracket', 'and its view');
      for (const w of [320, 390, 820]) {
        await page.setViewportSize({width: w, height: 900}); await page.waitForTimeout(250);
        const fit = await page.evaluate(() => ({side: document.documentElement.scrollWidth - innerWidth, cards: Math.max(...[...document.querySelectorAll('.ls-m')].map(m => m.getBoundingClientRect().right)) - innerWidth, names: [...document.querySelectorAll('.ls-tree .ls-nm')].filter(n => n.scrollWidth > n.clientWidth + 1).length}));
        assert.ok(fit.side <= 1 && fit.cards <= -8, `no sideways scroll and the tree fits at ${w}: ` + JSON.stringify(fit));
        if (shots && w === 320) await page.screenshot({path: path.join(shots, 'bracket-320.png')});
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS deep link, the season and view kept across segments, no sideways scroll, the tree fits at 320');
    }
    console.log('PASS: League › Seasons');
  } catch (e) {
    console.error('FAIL:', e); process.exitCode = 1;
  } finally { await browser.close(); server.close(); }
})();
