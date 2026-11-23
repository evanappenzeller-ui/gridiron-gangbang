// The Scores tab's College screen and a game's own page (views/live-cfb.js, views/game.js, core/espn-game.js; Nov 22
// 2026, the owner: "Make the scores tab include college football ... Users should be able to click on a live game and
// get taken to a more in depth view with box scores, latest plays, scoring plays, etc.") in a real browser.
// Local only: the app is served from this folder with Firebase disabled, and ESPN answers from tools/live/fixtures
// (real ESPN payloads from Nov 22 2026, trimmed: the NFL scoreboard with two games on, every FBS game of college week
// 12, and the summaries of a live, a finished and an upcoming NFL game and a finished college game), so nothing
// reaches the network.
// For Evan, another member and a visitor (phone), and a visitor on a tablet and a 320 px phone:
//   the switch is NFL · College · League; College shows the week (stepper), Top 25 by default (ranked games only), All
//   FBS (every game) and a conference chip; the chip and College are remembered after a reload; a game on now leads its
//   own Live section; a college game opens its page (ranks, records, the score by quarter, Summary with scoring plays,
//   leaders, team stats and game info, Box score by team, Plays by drive; no Fantasy tab); Back returns to College;
//   NFL's live box opens its page with where the ball is, the last play, win probability, Fantasy points and the drive
//   on now open; a drive closed by hand stays closed through an update; a game before kickoff shows the matchup
//   predictor, season leaders and season stats; an unknown game says so; nothing scrolls sideways; no exceptions.
// Usage: node tools/live/check-scores-browser.cjs [--shots=<dir>]   (Playwright's Chromium; screenshots when --shots)
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const FIX = path.join(__dirname, 'fixtures');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
const fx = name => JSON.parse(fs.readFileSync(path.join(FIX, name + '.json'), 'utf8'));
const NFL_SB = fx('nfl-scoreboard'), CFB_SB = fx('cfb-scoreboard');
const SUMMARY = {nfl: {'401873075': 'nfl-live', '401873074': 'nfl-final', '401873077': 'nfl-pre'}, 'college-football': {'401856753': 'cfb-final'}};
const NFL_WEEK = NFL_SB.week.number, CFB_WEEK = CFB_SB.week.number;
let liveTick = 0; // a second fetch of the live game moves its clock (an update)

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
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}
const empty = (sb, week) => Object.assign({}, sb, {week: {number: week}, events: []});
function espn(u) {
  const m = /\/apis\/site\/v2\/sports\/football\/(nfl|college-football)\/(scoreboard|summary)$/.exec(u.pathname);
  if (!m) return null;
  const [, lg, kind] = m;
  if (kind === 'scoreboard') {
    const sb = lg === 'nfl' ? NFL_SB : CFB_SB, wk = u.searchParams.get('week'), want = lg === 'nfl' ? NFL_WEEK : CFB_WEEK;
    return {json: wk && Number(wk) !== want ? empty(sb, Number(wk)) : sb};
  }
  const f = SUMMARY[lg][u.searchParams.get('event')];
  if (!f) return {status: 404, json: {code: 404}};
  const j = fx(f);
  if (f === 'nfl-live' && liveTick++ > 0) j.header.competitions[0].status.displayClock = '11:40';
  return {json: j};
}

const snap = (page, name) => (shots ? page.screenshot({path: path.join(shots, name + '.png')}) : Promise.resolve());
const noSideScroll = page => page.evaluate(() => {
  const sc = document.querySelector('.screen:not([hidden]) , .screen');
  const vis = [...document.querySelectorAll('.screen')].find(s => s.getBoundingClientRect().width && getComputedStyle(s).visibility !== 'hidden' && !s.hidden) || sc;
  return {doc: document.documentElement.scrollWidth <= innerWidth + 1, screen: !vis || vis.scrollWidth <= vis.clientWidth + 1};
});

async function open(browser, url, me, viewport) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, serviceWorkers: 'block', colorScheme: 'dark', hasTouch: viewport.width < 600, isMobile: viewport.width < 600});
  await context.route('https://**/*', route => {
    const u = new URL(route.request().url());
    const r = u.hostname === 'site.api.espn.com' ? espn(u) : null;
    if (r) return route.fulfill({status: r.status || 200, json: r.json, headers: {'access-control-allow-origin': '*'}});
    return route.abort();
  });
  await context.addInitScript(me => {
    if (window.top !== window) return;
    if (me) localStorage.setItem('gg-me', me);
    localStorage.setItem('gg-welcome', '1');
    ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
  }, me);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
  await page.goto(url + '/#/live');
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  await page.keyboard.press('Escape');
  return {context, page, errors};
}
const gameScreen = '.v-game:not([hidden])';

async function college(page, tag) {
  await page.waitForSelector('.v-live .lg-sw [data-lg-mode="cfb"]', {timeout: 20000});
  assert.deepEqual(await page.$$eval('.v-live .lg-sw .pk-lg-t', bs => bs.map(b => b.dataset.lgMode)), ['nfl', 'cfb', 'lg'], tag + ': NFL · College · League');
  await page.locator('.v-live [data-lg-mode="cfb"]').click();
  await page.waitForSelector('.v-live [data-lc]:not([hidden]) .lc-g', {timeout: 20000});
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.v-live [data-lg-nfl]').isHidden(), true, tag + ': NFL hides');
  const eb = await page.locator('.v-live .lt-eyebrow').innerText(); assert.match(eb, new RegExp(`Week ${CFB_WEEK}`, 'i'), tag + ': the eyebrow names the college week: ' + eb);
  assert.match(await page.locator('.v-live .lc-wk-t').innerText(), new RegExp(`Week ${CFB_WEEK}`));
  const chips = await page.$$eval('.v-live [data-chips="lc-f"] .chip', cs => cs.map(c => [c.dataset.value, c.textContent, c.getAttribute('aria-pressed')]));
  assert.equal(chips[0][0], 'top25'); assert.equal(chips[0][2], 'true', tag + ': Top 25 first and on');
  assert.ok(chips.some(c => c[1] === 'SEC') && chips.some(c => c[1] === 'Big Ten'), tag + ': conference chips');
  // Top 25: every game has a ranked team
  const top = await page.$$eval('.v-live .lc-g', gs => gs.map(g => g.querySelectorAll('.lc-rk').length));
  assert.ok(top.length >= 10 && top.every(n => n >= 1), tag + ': Top 25 games only (' + top.length + ')');
  await page.locator('.v-live [data-chips="lc-f"] .chip[data-value="all"]').click();
  await page.waitForFunction(n => document.querySelectorAll('.v-live .lc-g').length > n, top.length, {timeout: 5000});
  const all = await page.locator('.v-live .lc-g').count();
  assert.equal(all, CFB_SB.events.length, tag + ': All FBS shows every game');
  await page.locator('.v-live [data-chips="lc-f"] .chip[data-value="8"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.v-live .lc-g').length > 0 && document.querySelectorAll('.v-live .lc-g').length < 20, null, {timeout: 5000});
  const sec = await page.locator('.v-live .lc-g').count();
  // The week stepper: an empty week, then back.
  await page.locator('.v-live [data-lc-step="1"]').click();
  await page.waitForFunction(w => /Week (\d+)/.exec(document.querySelector('.v-live .lc-wk-t').textContent)[1] === String(w), CFB_WEEK + 1, {timeout: 5000});
  await page.waitForSelector('.v-live [data-lc] .empty, .v-live [data-lc] [class*="empty"]', {timeout: 10000});
  await page.locator('.v-live [data-lc-step="-1"]').click();
  await page.waitForSelector('.v-live [data-lc] .lc-g', {timeout: 10000});
  // College and the chip are remembered after a reload.
  await page.reload();
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  await page.waitForSelector('.v-live [data-lc]:not([hidden]) .lc-g', {timeout: 20000});
  assert.equal(await page.locator('.v-live [data-lg-mode="cfb"]').getAttribute('aria-selected'), 'true', tag + ': College remembered');
  assert.equal(await page.locator('.v-live [data-chips="lc-f"] .chip[data-value="8"]').getAttribute('aria-pressed'), 'true', tag + ': the SEC chip remembered');
  // A game on now leads its own Live section.
  await page.locator('.v-live [data-chips="lc-f"] .chip[data-value="top25"]').click();
  await page.evaluate(async () => {
    const nfl = await import('/js/core/nfl.js');
    nfl.cfbAll.__dev.patch(2026, 12, {'401858528': {state: 'in', detail: '4:12 - 3rd', period: 3, clock: '4:12', home: 21, away: 17,
      sit: {poss: 'away', down: 2, dist: 7, text: '2nd & 7', spot: 'MICH 18', x: 82, toGo: 18, rz: true, last: 'Pass complete for 12 yards.', to: {home: 2, away: 3}}}});
  });
  await page.waitForSelector('.v-live .lc-h-live', {timeout: 5000});
  const firstLive = await page.locator('.v-live .lc-list').first().locator('.lc-g').first().getAttribute('class');
  assert.match(firstLive, /is-in/, tag + ': the live game leads');
  assert.match(await page.locator('.v-live .lc-g.is-in').first().innerText(), /2nd & 7 at MICH 18/);
  await snap(page, tag + '-college');
  const w = await noSideScroll(page);
  assert.ok(w.doc && w.screen, tag + ': College doesn’t scroll sideways');
  await page.evaluate(async () => (await import('/js/core/nfl.js')).cfbAll.__dev.patch(null));
  return {top: top.length, all, sec};
}

async function collegeGame(page, tag) {
  await page.locator('.v-live [data-chips="lc-f"] .chip[data-value="all"]').click();
  await page.locator('.v-live .lc-g[data-nav="/live/game/cfb/401856753"]').click();
  await page.waitForSelector(gameScreen + ' .gm-hero', {timeout: 20000});
  await page.waitForTimeout(500);
  const hero = await page.locator(gameScreen + ' .gm-hero').innerText();
  assert.match(hero, /UGA|Georgia/); assert.match(hero, /34/); assert.match(hero, /Final/);
  assert.equal(await page.locator(gameScreen + ' .gm-hero .gm-rk').count(), 2, tag + ': both ranks');
  assert.match(await page.locator(gameScreen + ' .gm-lines').innerText(), /UGA[\s\S]*3\s+7\s+10\s+14\s+34/);
  const tabs = await page.$$eval(gameScreen + ' [data-seg="gm-tab"] button', bs => bs.map(b => b.textContent));
  assert.deepEqual(tabs, ['Summary', 'Box score', 'Plays'], tag + ': college has no Fantasy tab');
  assert.equal(await page.locator(gameScreen + ' .gm-scoring .gm-sp').count(), 8, tag + ': eight scoring plays');
  assert.ok(await page.locator(gameScreen + ' .gm-leaders .gm-ldr').count() >= 3, tag + ': game leaders');
  assert.match(await page.locator(gameScreen + ' .gm-info').innerText(), /Williams-Brice Stadium/);
  await snap(page, tag + '-cfb-summary');
  await page.locator(gameScreen + ' [data-seg="gm-tab"] button[data-value="box"]').click();
  await page.waitForSelector(gameScreen + ' .gm-cat .gm-tbl', {timeout: 5000});
  const away = await page.locator(gameScreen + ' .gm-cat').first().innerText();
  assert.match(away, /Passing[\s\S]*Stockton/i, tag + ': Georgia passing first');
  await page.locator(gameScreen + ' [data-seg="gm-side"] button[data-value="home"]').click();
  await page.waitForFunction(() => /Sellers/.test(document.querySelector('.v-game:not([hidden]) .gm-cat').innerText), null, {timeout: 5000});
  assert.ok(await page.locator(gameScreen + ' .gm-stats .gm-st').count() >= 10, tag + ': every team stat');
  await snap(page, tag + '-cfb-box');
  await page.locator(gameScreen + ' [data-seg="gm-tab"] button[data-value="plays"]').click();
  await page.waitForSelector(gameScreen + ' .gm-drive', {timeout: 5000});
  assert.equal(await page.locator(gameScreen + ' .gm-drive').count(), 17, tag + ': every drive');
  await page.locator(gameScreen + ' .gm-drive').nth(1).locator('summary').click();
  assert.ok(await page.locator(gameScreen + ' .gm-drive').nth(1).locator('.gm-play').count() > 0, tag + ': a drive opens to its plays');
  const w = await noSideScroll(page);
  assert.ok(w.doc && w.screen, tag + ': the game page doesn’t scroll sideways');
  await page.goBack();
  await page.waitForSelector('.v-live [data-lc]:not([hidden]) .lc-g', {timeout: 10000});
}

async function nflGames(page, tag) {
  await page.locator('.v-live [data-lg-mode="nfl"]').click();
  await page.waitForSelector('.v-live [data-lg-nfl]:not([hidden]) .lg-tile', {timeout: 20000});
  await page.waitForTimeout(500);
  await page.locator('.v-live .lg-tile[data-nav="/live/game/nfl/401873075"]').click();
  await page.waitForSelector(gameScreen + ' .gm-sit', {timeout: 20000});
  await page.waitForTimeout(400);
  const clk = await page.locator(gameScreen + ' .gm-hero .gm-clk').innerText(); assert.match(clk, /4th · 1[12]:[14][20]/i, tag + ': the clock: ' + clk);
  const sit = await page.locator(gameScreen + ' .gm-sit').innerText();
  assert.match(sit, /DEN ball/); assert.match(sit, /Last play/i);
  assert.equal(await page.locator(gameScreen + ' .gm-sit .gm-los').count(), 1, tag + ': the ball on the field');
  assert.match(await page.locator(gameScreen + ' .gm-wp').innerText(), /Win probability[\s\S]*%/i);
  assert.equal(await page.locator(gameScreen + ' .gm-wpc polyline').count(), 1, tag + ': the win probability chart');
  await snap(page, tag + '-nfl-live');
  await page.locator(gameScreen + ' [data-seg="gm-tab"] button[data-value="plays"]').click();
  await page.waitForSelector(gameScreen + ' .gm-drive.is-live[open]', {timeout: 5000});
  assert.equal(await page.locator(gameScreen + ' .gm-drive').first().getAttribute('class').then(c => /is-live/.test(c)), true, tag + ': the drive on now leads');
  // Close it by hand; the next update (the clock moves) keeps it closed.
  await page.locator(gameScreen + ' .gm-drive.is-live > summary').click();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'}); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'}); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => /11:40/.test(document.querySelector('.v-game:not([hidden]) .gm-hero .gm-clk').textContent), null, {timeout: 15000});
  assert.equal(await page.locator(gameScreen + ' .gm-drive.is-live').getAttribute('open'), null, tag + ': a drive closed by hand stays closed');
  assert.equal(await page.locator(gameScreen + ' [data-seg="gm-tab"] button[data-value="plays"]').getAttribute('aria-selected'), 'true', tag + ': the tab stays');
  await page.locator(gameScreen + ' [data-seg="gm-tab"] button[data-value="fan"]').click();
  await page.waitForSelector(gameScreen + ' .gm-fan .gm-fp', {timeout: 5000});
  const fp = await page.locator(gameScreen + ' .gm-fan .gm-fp').count();
  assert.equal(await page.locator(gameScreen + ' [data-seg="gm-tab"] button[data-value="fan"]').getAttribute('aria-selected'), 'true', tag + ': Fantasy selected');
  assert.ok(fp >= 10, tag + ': fantasy points for the game’s players');
  await page.waitForTimeout(500);
  await snap(page, tag + '-nfl-fantasy');
  await page.goBack();
  await page.waitForSelector('.v-live [data-lg-nfl]:not([hidden]) .lg-tile', {timeout: 10000});
  // Before kickoff, and an unknown game.
  await page.goto(page.url().replace(/#.*$/, '#/live/game/nfl/401873077'));
  await page.waitForSelector(gameScreen + ' .gm-hero.is-pre', {timeout: 20000});
  assert.match(await page.locator(gameScreen).innerText(), /Matchup predictor[\s\S]*Season leaders[\s\S]*Season stats/i);
  assert.equal(await page.locator(gameScreen + ' [data-seg="gm-tab"]').count(), 0, tag + ': no tabs before kickoff');
  await snap(page, tag + '-nfl-pre');
  await page.goto(page.url().replace(/#.*$/, '#/live/game/nfl/999'));
  await page.waitForFunction(() => /Couldn’t load the game/.test((document.querySelector('.v-game:not([hidden])') || {}).innerText || ''), null, {timeout: 20000});
  return fp;
}

async function run(url) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const runs = [['evan', 'evan', {width: 390, height: 844}], ['mason', 'mason', {width: 390, height: 844}], ['visitor', '', {width: 390, height: 844}],
      ['tablet', '', {width: 820, height: 1180}], ['phone320', 'mason', {width: 320, height: 640}]];
    for (const [tag, me, vp] of runs) {
      liveTick = 0;
      const {context, page, errors} = await open(browser, url, me, vp);
      const c = await college(page, tag);
      await collegeGame(page, tag);
      const fp = await nflGames(page, tag);
      console.log(`PASS ${tag} (${vp.width}px): College ${c.top} Top 25 · ${c.all} FBS · ${c.sec} SEC games, a live game first, the college game page; NFL live game page, ${fp} fantasy lines, pregame and unknown game`);
      assert.deepEqual(errors, [], tag + ': unexpected browser exceptions');
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('PASS: College scores and the game pages on the Scores tab');
}

(async () => {
  const srv = await server();
  try { await run(`http://127.0.0.1:${srv.address().port}`); }
  catch (e) { console.error('FAIL:', e && e.stack || e); process.exitCode = 1; }
  finally { srv.close(); }
})();
