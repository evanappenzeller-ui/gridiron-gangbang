// The Media Room (views/media.js, Nov 24 2026, Evan: "Create a new disc on the Home Screen for the media room. This should
// include all the videos in the app from the happy meal challenge to the weekly press conferences. Make this look like a
// Netflix or HBO app ... get rid of the media archive section"). In a real browser, Firebase off, nothing off-site:
//   its case is on the Home shelf (last, NEW) for a member, an app user, a guest and an unselected phone, and opens it;
//   the page lists every press conference (newest first, the week 7 no-show among them) and every Happy Meal (in draft
//   order, its pick in big numbers) and the draft order; Play opens the title page with the app's own player (the video
//   in the app) or YouTube's (a presser with only a link); More Episodes swaps and plays; closing stops the video;
//   Continue Watching shows a video part way through, with its red bar, and Resume; the filters list every episode; League
//   has no Media segment and its old link lands in the Media Room; the Media Room swipes back to Daily Games.
// Usage: node tools/media/check-media-room.cjs [--shots=<directory>]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.mp4': 'video/mp4'};
function server() {
  const s = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    let f;
    try { f = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)); } catch (_) { r.writeHead(400).end(); return; }
    if (!f.startsWith(root + path.sep)) { r.writeHead(403).end(); return; }
    fs.readFile(f, (e, b) => {
      if (e) { r.writeHead(404).end(); return; }
      if (f.endsWith('index.html')) b = Buffer.from(b.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      r.writeHead(200, {'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      r.end(b);
    });
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const pressers = JSON.parse(fs.readFileSync(path.join(root, 'data/pressers.json'))).pressers;
const meals = JSON.parse(fs.readFileSync(path.join(root, 'data/media.json'))).happyMeals;
(async () => {
  const srv = await server(), url = `http://127.0.0.1:${srv.address().port}`;
  const {chromium} = require('playwright');
  const b = await chromium.launch();
  if (shots) fs.mkdirSync(shots, {recursive: true});
  try {
    async function phone(me, {w = 390, h = 844} = {}) {
      const c = await b.newContext({viewport: {width: w, height: h}, serviceWorkers: 'block', hasTouch: true, isMobile: w < 700});
      await c.route('https://**/*', r => r.abort());
      await c.addInitScript(me => {
        if (window !== window.top) return; // (the YouTube frame, blocked here)
        if (me) localStorage.setItem('gg-me', me);
        localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:' + (me || 'visitor'), '1'); localStorage.setItem('gg-release-3.0:evan', '1');
      }, me);
      const p = await c.newPage(), errors = [];
      p.on('pageerror', e => errors.push(e.message));
      return {c, p, errors};
    }
    const boot = async (p, hash) => { await p.goto(url + '/' + hash); await p.waitForFunction(() => window.__ggBooted, null, {timeout: 30000}); };

    // ---- the case on the shelf, for everyone
    for (const me of ['evan', 'mason', 'ryan-dow', null]) {
      const {c, p, errors} = await phone(me);
      await boot(p, '#/puzzles');
      await p.waitForSelector('.gm-slot:not([data-gm-clone])[data-gm-slot="media"] .gm-case', {state: 'attached', timeout: 20000});
      const ids = await p.$eval('.gm-list', el => el.dataset.ids);
      assert.ok(/ media$/.test(ids), `${me}: the Media Room is last on the shelf (${ids})`);
      const label = await p.$eval('.gm-slot:not([data-gm-clone])[data-gm-slot="media"] .gm-case', el => el.getAttribute('aria-label'));
      assert.match(label, /Media Room \(new\)\. Open the case to watch/, `${me}: its label`);
      assert.deepEqual(errors, [], `${me}: no errors`);
      await c.close();
    }

    // ---- the page (Ben: a member with a Happy Meal and a presser)
    const {c, p, errors} = await phone('ben');
    await boot(p, '#/puzzles');
    await p.waitForSelector('.gm-slot:not([data-gm-clone])[data-gm-slot="media"] .gm-case', {state: 'attached', timeout: 20000});
    await p.evaluate(() => { location.hash = '#/puzzles/media'; });
    await p.waitForSelector('.v-media .mr-hero:not(.is-empty) .mr-hero-t', {timeout: 20000});
    await p.waitForSelector('.v-media .mr-top', {timeout: 20000});
    await p.waitForTimeout(500);
    const page = await p.evaluate(() => {
      const scr = document.querySelector('section.screen.v-media');
      return {
        hero: scr.querySelector('.mr-hero-t').textContent,
        press: [...scr.querySelectorAll('.mr-row')].find(r => /Press Conferences/.test(r.querySelector('.mr-row-h').textContent)).querySelectorAll('.mr-card').length,
        noshow: scr.querySelectorAll('.mr-card.is-noshow').length,
        tops: [...scr.querySelectorAll('.mr-top .mr-top-n')].map(n => n.textContent),
        draft: scr.querySelectorAll('.mr-dr').length, me: scr.querySelector('.mr-dr.is-me b')?.textContent,
        bg: getComputedStyle(scr).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth || scr.scrollWidth > scr.clientWidth,
        nav: !!scr.querySelector(':scope > .nav')
      };
    });
    const newest = pressers.slice().sort((a, b) => +b.key.split('-w')[1] - +a.key.split('-w')[1])[0];
    assert.match(page.hero, new RegExp(newest.who, 'i'), 'the billboard is the newest press conference');
    assert.equal(page.press, pressers.length + 1, 'every press conference and the no-show in its row');
    assert.equal(page.noshow, 1, "Corbin's week 7 no-show");
    assert.deepEqual(page.tops, Array.from({length: meals.length}, (_, i) => String(i + 1)), 'every Happy Meal in draft order (the shared one at 11)');
    // every pick's numeral shows whole beside its poster (Nov 25 2026, Evan: "10 and 11 happy meals are hidden and look like 1"):
    // the poster covers at most the last digit's edge (22 px)
    const hidden = await p.evaluate(() => [...document.querySelectorAll('section.screen.v-media .mr-top')].map(t => {
      const n = t.querySelector('.mr-top-n'), r = document.createRange(); r.selectNodeContents(n);
      const g = r.getBoundingClientRect(), art = t.querySelector('.mr-art').getBoundingClientRect();
      return {n: n.textContent, covered: Math.round(Math.max(0, g.right - art.left))};
    }).filter(x => x.covered > 22));
    assert.deepEqual(hidden, [], 'no pick number hides behind its poster');
    assert.equal(page.draft, 12, 'the draft order, every manager');
    assert.equal(page.me, 'Ben', 'your row highlighted');
    assert.equal(page.bg, 'rgb(11, 11, 13)', 'dark');
    assert.equal(page.nav, false, 'its own bar');
    assert.equal(page.overflow, false, 'no sideways page scroll');
    if (shots) { await p.waitForTimeout(2500); await p.screenshot({path: path.join(shots, 'media-phone.png')}); }
    await p.evaluate(() => document.querySelector('section.screen.v-media').scrollTo(0, 900));
    await p.waitForTimeout(400);
    assert.equal(await p.$eval('.v-media .mr-bar', el => el.classList.contains('is-solid')), true, 'the bar turns solid once scrolled');
    if (shots) await p.screenshot({path: path.join(shots, 'media-phone-rows.png')});
    await p.evaluate(() => document.querySelector('section.screen.v-media').scrollTo(0, 0));

    // ---- a Happy Meal's title page: the app's own player
    await p.locator('.v-media .mr-top').first().click();
    await p.waitForSelector('.sheet.mr-sheet .mr-v video', {timeout: 5000});
    await p.waitForTimeout(1000);
    const t1 = await p.evaluate(() => {
      const sh = document.querySelector('.sheet.mr-sheet'), v = sh.querySelector('video');
      return {title: sh.querySelector('.mr-d-t').textContent, src: v.getAttribute('src'), times: sh.querySelectorAll('.mr-times li').length,
        more: sh.querySelectorAll('[data-mr-swap]').length, skip: sh.querySelectorAll('[data-mr-skip]').length, seek: !!sh.querySelector('.mr-v-seek'), fs: !!sh.querySelector('[data-mr-fs]')};
    });
    assert.match(t1.title, /Corbin's Happy Meal/, 'the 1st pick');
    assert.match(t1.src, /video\/media\/hm-corbin-v1\.mp4$/);
    assert.equal(t1.times, 1, 'its time');
    assert.equal(t1.more, meals.length - 1, 'More Happy Meals');
    assert.ok(t1.skip === 2 && t1.seek && t1.fs, 'back 10, forward 10, the slider and full screen');
    if (shots) await p.screenshot({path: path.join(shots, 'media-title.png')});
    await p.locator('.sheet.mr-sheet [data-mr-swap]').first().click();
    await p.waitForTimeout(400);
    assert.match(await p.$eval('.sheet.mr-sheet .mr-d-t', el => el.textContent), /John's Happy Meal/, 'More Happy Meals swaps to the next');
    assert.match(await p.$eval('.sheet.mr-sheet video', el => el.getAttribute('src')), /hm-john-v1\.mp4$/, 'and plays it');
    await p.locator('.sheet.mr-sheet .mr-x').click();
    await p.waitForTimeout(700);
    assert.equal(await p.$$eval('.sheet.mr-sheet video', v => v.length), 0, 'closing stops the video');

    // ---- a press conference with only a YouTube link: YouTube's player; one in the app: questions from the press
    const yt = pressers.find(x => !x.file);
    if (yt) {
      await p.evaluate(() => { localStorage.setItem('gg-media-filter', 'press'); });
      await p.locator('.v-media [data-mr-filter="press"]').click();
      await p.waitForTimeout(500);
      const eps = await p.$$eval('.v-media .mr-ep', e => e.length);
      assert.equal(eps, pressers.length + 1, 'Press Conferences lists every episode and the no-show');
      await p.locator(`.v-media .mr-ep[data-mr-open="press:${yt.key}"]`).click();
      await p.waitForSelector('.sheet.mr-sheet .mr-ifr', {timeout: 5000});
      assert.match(await p.$eval('.sheet.mr-sheet .mr-ifr', f => f.src), /youtube-nocookie\.com\/embed\//);
      await p.locator('.sheet.mr-sheet .mr-x').click();
      await p.waitForTimeout(700);
    }
    await p.locator('.v-media .mr-ep[data-mr-open="press:2026-w3"]').click();
    await p.waitForSelector('.sheet.mr-sheet .mr-qs li', {timeout: 5000});
    assert.ok(await p.$$eval('.sheet.mr-sheet .mr-qs li', l => l.length) >= 3, 'the press questions');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(700);
    await p.locator('.v-media [data-mr-filter="meals"]').click();
    await p.waitForTimeout(500);
    assert.equal(await p.$$eval('.v-media .mr-ep', e => e.length), meals.length, 'Happy Meals lists every one');
    await p.locator('.v-media [data-mr-filter="all"]').click();
    await p.waitForTimeout(500);

    // ---- Continue Watching: a video part way through
    await p.evaluate(() => localStorage.setItem('gg-media-watch:ben', JSON.stringify({'meal:hm-ben': {t: 40, d: 113, at: Date.now(), done: false}})));
    await p.reload();
    await p.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
    await p.waitForSelector('.v-media .mr-row.is-cont .mr-card', {timeout: 20000});
    const cont = await p.evaluate(() => {
      const r = document.querySelector('.v-media .mr-row.is-cont');
      return {n: r.querySelectorAll('.mr-card').length, id: r.querySelector('.mr-card').dataset.mrId, bar: r.querySelector('.mr-prog i').style.width, left: r.querySelector('.mr-card-s').textContent};
    });
    assert.deepEqual([cont.n, cont.id, cont.left], [1, 'meal:hm-ben', '1 min left']);
    assert.equal(cont.bar, '35.4%');
    await p.locator('.v-media .mr-row.is-cont .mr-card').click();
    await p.waitForSelector('.sheet.mr-sheet video', {timeout: 5000});
    assert.match(await p.$eval('.sheet.mr-sheet [data-mr-main-play]', b => b.textContent), /Resume from 0:40|Start over|Play/);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(700);

    // ---- League: no Media segment; its old link goes to the Media Room
    await p.evaluate(() => { location.hash = '#/league/standings'; });
    await p.waitForSelector('.v-league .hl-seg', {timeout: 20000});
    assert.equal(await p.$$eval('.v-league .hl-seg [data-value="media"], .v-league .hl-seg button', bs => bs.filter(b => /media/i.test(b.textContent)).length), 0, 'no Media in League');
    await p.evaluate(() => { location.hash = '#/league/media'; });
    await p.waitForFunction(() => location.hash === '#/puzzles/media', null, {timeout: 20000});
    await p.waitForTimeout(1200);
    assert.ok(await p.evaluate(() => [...document.querySelectorAll('section.screen.v-media .mr-hero')].some(h => h.getBoundingClientRect().width > 0 && h.closest('section.screen').getBoundingClientRect().left >= 0)), 'League’s old Media link opens the Media Room');
    assert.deepEqual(errors, [], 'no page errors');
    await c.close();

    // ---- swipe back to Daily Games; a tablet's layout
    {
      const {c, p, errors} = await phone('evan');
      await boot(p, '#/puzzles');
      await p.waitForSelector('.gm-slot:not([data-gm-clone])[data-gm-slot="media"] .gm-case', {state: 'attached', timeout: 20000});
      await p.waitForTimeout(1500);
      await p.evaluate(() => { location.hash = '#/puzzles/media'; });
      await p.waitForSelector('.v-media .mr-top', {timeout: 20000});
      await p.waitForTimeout(1500);
      const cdp = await c.newCDPSession(p);
      const pts = (x, y) => ({touchPoints: [{x, y}]});
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', ...pts(120, 300)});
      for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', ...pts(120 + 20 * i, 300)}); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      await p.waitForTimeout(1200);
      assert.equal(await p.evaluate(() => location.hash), '#/puzzles', 'a swipe right goes back to Daily Games');
      assert.deepEqual(errors, []);
      await c.close();
    }
    if (shots) {
      const {c, p} = await phone('evan', {w: 820, h: 1180});
      await boot(p, '#/puzzles/media');
      await p.waitForSelector('.v-media .mr-top', {timeout: 20000});
      await p.waitForTimeout(3500);
      await p.screenshot({path: path.join(shots, 'media-tablet.png')});
      await c.close();
    }
    console.log('PASS: Media Room case for everyone, every video (pressers, no-show, Happy Meals in draft order, draft order), title pages and players, Continue Watching, filters, League link, swipe back');
  } finally { await b.close(); srv.close(); }
})().catch(e => { console.error(e); process.exit(1); });
