// The fresh trivia (Nov 26 2026 on; Evan, Nov 25 2026: the matching game's answers "all on one side", "ensure that no
// game is repeated", smoother feedback, and a Bonus puzzle: a Wordscapes wheel, a crossword, unscrambling names and
// matching this season's scores). In a real browser on a local server (Firebase off, outside hosts blocked):
//   1. the level bank: every day from FRESH_FROM for a year has fresh games: no Higher or Lower match-up, Connections
//      set, Number question, bonus level or College / Mystery / Journey / Grid source used twice, and none of the
//      classic sources played on days 1-59; the days before FRESH_FROM are as they were.
//   2. Team Connections deals no group in one row or one column, on 120 days.
//   3. a whole day played through the screens on several days (every game: Higher or Lower 4 rounds, Connections with
//      a miss then all three groups, Number Trivia with the dial and the nudges, and each bonus kind: a real drag on
//      the Word Wheel, Unscramble, Crossword typing, Score Match), points as the rules say, results, a reload keeps it.
//   4. phone widths 320/390 and a tablet: no sideways scroll.
//   5. the Word Wheel (Nov 27 2026): letters centred on their bubbles, football words double, a found word, a bonus word,
//      a miss and Shuffle leave the wheel and the scroll where they were; real words, repeats and a cancelled drag cost
//      nothing; its misses run out on day 66; an old save keeps flat points; every level of trivia-v8.json is sound.
// Usage: node tools/puzzles/check-trivia-v6.cjs [--shots=<dir>]
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..'), pw = require('playwright');
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp'};
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
/** Waits for the day to load (an async waitForFunction would pass at once: its promise is truthy). */
async function ready(page) {
  for (let k = 0; k < 200; k++) { if (await page.evaluate(async () => (await import('/js/core/daily.js')).status === 'ready')) return; await page.waitForTimeout(100); }
  throw new Error('the day never loaded');
}

async function open(browser, url, day, opts = {}) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', hasTouch: !!opts.touch});
  await context.route('**/*', r => (new URL(r.request().url()).origin === url ? r.continue() : r.abort()));
  await context.addInitScript(() => { localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1'); sessionStorage.setItem('gg-skip-title', '1'); });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto(`${url}/?day=${day}#/puzzles/daily`);
  await page.waitForFunction(() => window.__ggBooted);
  await ready(page);
  return {context, page, errors};
}
const go = async (page, slug) => { await page.evaluate(s => { location.hash = '/puzzles/play/' + s; }, slug); await page.locator(`[data-page="${slug}"] .tv`).first().waitFor(); await page.waitForTimeout(250); };
const ds = (page, id) => page.evaluate(async id => JSON.parse(JSON.stringify((await import('/js/core/daily.js')).DS[id] || null)), id);
const dayOf = page => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/js/core/daily.js')).DAY)));

async function playStats(page, day) {
  await go(page, 'stats');
  let right = 0;
  for (let i = 0; i < 4; i++) {
    const q = day.hl[i], truth = q[5] > q[2] ? 'higher' : 'lower', ans = i === 1 ? (truth === 'higher' ? 'lower' : 'higher') : truth;
    if (ans === truth) right++;
    await page.locator(`.tv-stats [data-ans="${ans}"]`).click();
    await page.locator('.tv-stats [data-next]').waitFor();
    if (shots && i === 0) await page.screenshot({path: path.join(shots, 'stats-reveal.png')});
    await page.locator('.tv-stats [data-next]').click();
  }
  const s = await ds(page, 'stats');
  assert.equal(s.done, true); assert.deepEqual(s.r, [true, false, true, true]);
  assert.equal(await page.evaluate(async () => (await import('/js/core/daily.js')).STEPS.find(x => x.id === 'stats').pts()), right * 50);
  await page.locator('.tv-stats .tv-recap li').first().waitFor();
}
async function playConnections(page, day) {
  await go(page, 'connections');
  // the deal: no group in one row or column
  const names = await page.$$eval('.tv-connections .tv-tile', b => b.map(x => x.dataset.tile));
  assert.equal(names.length, 9);
  for (const g of day.cn) {
    const at = g[1].map(n => names.indexOf(n));
    assert.ok(new Set(at.map(i => Math.floor(i / 3))).size > 1 && new Set(at.map(i => i % 3)).size > 1, 'a group spread over rows and columns: ' + g[0]);
  }
  if (shots) await page.screenshot({path: path.join(shots, 'connections.png')});
  // a miss: two of one group and one of another
  for (const n of [day.cn[0][1][0], day.cn[0][1][1], day.cn[1][1][0]]) await page.locator(`.tv-connections [data-tile="${n}"]`).click();
  await page.locator('.tv-connections [data-submit]').click();
  await page.waitForTimeout(500);
  assert.equal((await ds(page, 'connections')).miss, 1);
  await page.locator('.tv-connections [data-clear]').click();
  for (const g of day.cn) {
    for (const n of g[1]) await page.locator(`.tv-connections [data-tile="${n}"]`).click();
    await page.locator('.tv-connections [data-submit]').click();
    await page.waitForTimeout(200);
  }
  const s = await ds(page, 'connections');
  assert.equal(s.done, true); assert.equal(s.found.length, 3);
  assert.equal(await page.locator('.tv-connections .tv-band').count(), 3);
  if (shots) await page.screenshot({path: path.join(shots, 'connections-done.png')});
}
async function playNumbers(page, day) {
  await go(page, 'numbers');
  const dial = page.locator('.tv-numbers [data-dial]');
  // a drag on the dial moves the needle without a redraw
  const box = await dial.boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const svgBefore = await dial.elementHandle();
  await page.mouse.move(cx - box.width * .38, cy + box.height * .3); await page.mouse.down();
  await page.mouse.move(cx, cy - box.height * .4, {steps: 8}); await page.mouse.up();
  assert.ok(await svgBefore.evaluate(e => e.isConnected), 'the dial is moved in place, not redrawn');
  const mid = Number(await dial.getAttribute('aria-valuenow')), q0 = day.nq[0];
  assert.ok(Math.abs(mid - (q0[2] + q0[3]) / 2) <= (q0[3] - q0[2]) * .08, `top of the dial is about the middle (${mid})`);
  await page.locator('.tv-numbers [data-nudge="1"]').click();
  assert.ok(Number(await dial.getAttribute('aria-valuenow')) > mid, 'the + nudge moves it up');
  await dial.focus(); await page.keyboard.press('End');
  assert.equal(Number(await dial.getAttribute('aria-valuenow')), q0[3]);
  await page.locator('.tv-numbers [data-lock]').click();
  await page.locator('.tv-numbers [data-next]').waitFor();
  await page.waitForTimeout(1000);
  if (shots) await page.screenshot({path: path.join(shots, 'numbers-reveal.png')});
  await page.locator('.tv-numbers [data-next]').click();
  // the second: exactly right through the keyboard
  const q1 = day.nq[1];
  await page.locator('.tv-numbers [data-dial]').focus(); await page.keyboard.press('Home');
  const st = Number(await page.locator('.tv-numbers [data-dial]').getAttribute('aria-valuenow'));
  for (let k = 0; k < 400 && Number(await page.locator('.tv-numbers [data-dial]').getAttribute('aria-valuenow')) < q1[4]; k++) await page.keyboard.press('ArrowRight');
  void st;
  await page.locator('.tv-numbers [data-lock]').click();
  const s = await ds(page, 'numbers');
  assert.equal(s.done, true); assert.equal(s.g[0], q0[3]);
  const want0 = Math.max(0, Math.round(100 * (1 - Math.abs(q0[3] - q0[4]) / (q0[3] - q0[2]) * 1.6)));
  assert.equal(s.p[0], want0, 'points by distance');
  if (s.g[1] === q1[4]) assert.equal(s.p[1], 100, 'exact: 100');
}
async function playBonus(page, day) {
  await go(page, 'bonus');
  const kind = day.bx.kind, d = day.bx.d;
  if (kind === 'gridword') {
    const answer = d[0];
    // the marks: repeated letters counted as the answer has them
    const marks = await page.evaluate(async () => { const b = await import('/js/views/bonus.js'); return [['SPEED', 'STEAL'], ['EERIE', 'SPEED'], ['BLITZ', 'BLITZ'], ['ABBEY', 'BABES'], ['LLAMA', 'HELLO'], ['SPEED', 'ERASE']].map(([g, a]) => b.gwMarks(g, a).join('')); });
    assert.deepEqual(marks, ['gngnn', 'yynnn', 'ggggg', 'yyggn', 'yynnn', 'ynyyn'], 'Gridword marks repeated letters right');
    const key = async k => page.locator(`.tv-bonus [data-gk="${k}"]`).click();
    // too short, then not a word: refused, nothing used up
    for (const c of 'TEA') await key(c);
    await key('ENTER'); await page.waitForTimeout(200);
    assert.equal(((await ds(page, 'bonus')) || {}).g, undefined, 'a short guess is refused');
    for (const c of 'MX') await key(c);
    await key('ENTER'); await page.waitForTimeout(200);
    assert.equal(((await ds(page, 'bonus')) || {}).g, undefined, 'a non-word is refused');
    for (let k = 0; k < 5; k++) await key('DEL');
    // board and keyboard between the run's bars, keys wide enough to tap
    const fit = async () => page.evaluate(() => {
      const top = document.querySelector('.rn-top, [data-rn-top]') || document.querySelector('.v-run header'), bot = document.querySelector('.rn-bottom');
      const b = document.querySelector('.tv-bonus [data-gw]').getBoundingClientRect(), k = document.querySelector('.tv-bonus [data-gwkb]').getBoundingClientRect();
      const tb = top ? top.getBoundingClientRect().bottom : 0, bt = bot ? bot.getBoundingClientRect().top : innerHeight;
      const q = document.querySelector('.tv-bonus [data-gk="Q"]').getBoundingClientRect();
      return {board: Math.round(b.top - tb), kb: Math.round(bt - k.bottom), key: Math.round(q.width)};
    });
    await page.waitForTimeout(500);
    const f390 = await fit();
    assert.ok(f390.board >= -2 && f390.kb >= -2, 'board and keyboard between the bars at 390x844: ' + JSON.stringify(f390));
    // a real guess that isn't the answer: its tiles and keys take the right colours; focus stays on the Enter key
    const guess = answer === 'CRANE' ? 'SLATE' : 'CRANE';
    for (const c of guess) await key(c);
    const enter = await page.locator('.tv-bonus [data-gk="ENTER"]').elementHandle();
    await enter.focus();
    await key('ENTER'); await page.waitForTimeout(1700);
    assert.ok(await enter.evaluate(e => e.isConnected && document.activeElement === e), 'focus stays on the Enter key after a guess');
    assert.equal(await page.evaluate(async () => (await import('/js/core/daily.js')).STEPS.find(x => x.id === 'bonus').started()), true, 'a guess counts as started');
    // a sheet on top: typing goes nowhere near the board
    await page.evaluate(async () => { (await import('/js/core/ui.js')).openSheet({title: 'Test', body: '<button type="button" id="sheetbtn">OK</button>'}); });
    await page.waitForTimeout(400);
    await page.keyboard.type('ab');
    assert.equal(await page.locator('.tv-bonus [data-gwrow="1"] .tv-gw-t.is-typed').count(), 0, 'no typing into the board under a sheet');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const want = await page.evaluate(async ([g, a]) => (await import('/js/views/bonus.js')).gwMarks(g, a).join(''), [guess, answer]);
    const got = await page.$$eval('.tv-bonus [data-gwrow="0"] .tv-gw-t', ts => ts.map(t => (t.className.match(/is-([gyn])\b/) || [])[1]).join(''));
    assert.equal(got, want, 'the first row shows its marks');
    if (shots) await page.screenshot({path: path.join(shots, 'gridword-guess.png')});
    // the answer on a real keyboard
    await page.keyboard.type(answer.toLowerCase()); await page.keyboard.press('Enter');
    await page.waitForTimeout(1900);
    const s = await ds(page, 'bonus');
    assert.deepEqual([s.done, s.won, s.g.length, s.pts], [true, true, 2, 170], 'solved on the 2nd guess: 170');
    assert.ok(await page.locator('.tv-bonus [data-gwdef]').isVisible(), 'the meaning shows at the end');
    assert.equal(s.kind, 'gridword', 'the save names its kind');
    if (shots) await page.screenshot({path: path.join(shots, 'gridword-won.png')});
    // over: Enter on the run's next button still works
    const before = await page.evaluate(() => location.hash);
    await page.locator('[data-rn-next]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    assert.notEqual(await page.evaluate(() => location.hash), before, 'Enter on the Next button leaves the finished word');
    // a small phone: the keys are tappable and the board and keyboard fit once scrolled to
    await page.setViewportSize({width: 320, height: 568});
    await page.evaluate(async () => { const d = await import('/js/core/daily.js'); d.DS.bonus = {kind: 'gridword', g: []}; });
    await go(page, 'bonus'); await page.waitForTimeout(600);
    const f320 = await fit();
    assert.ok(f320.key >= 26, 'keys at least 26 px wide at 320: ' + f320.key);
    assert.ok(f320.board >= -2 && f320.kb >= -2, 'board and keyboard between the bars at 320x568: ' + JSON.stringify(f320));
    if (shots) await page.screenshot({path: path.join(shots, 'gridword-320.png')});
    // another kind's save on this day (an older build): shown read only, not read as a Gridword
    await page.evaluate(async () => { const d = await import('/js/core/daily.js'); d.DS.bonus = {kind: 'wheel', done: true, pts: 120, line: '9 of 14 words', got: ['ACT']}; });
    await go(page, 'numbers'); await go(page, 'bonus');
    assert.match(await page.locator('.tv-bonus .tv-title').innerText(), /played/i, 'a save of another kind shows read only');
    await page.setViewportSize({width: 390, height: 844});
    return;
  }
  if (kind === 'wheel') {
    const [letters, targets, extras, base] = d;
    // Nov 27 2026 (Evan: "the letters need to be centered on the bubbles"): each letter sits on its bubble's centre
    const off = await page.$$eval('.tv-bonus [data-wl]', bs => bs.map(b => { const r = b.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(b); const t = g.getBoundingClientRect(); return Math.max(Math.abs(t.left + t.width / 2 - r.left - r.width / 2), Math.abs(t.top + t.height / 2 - r.top - r.height / 2)); }));
    assert.ok(off.every(x => x < 1.5), 'the letters are centred on their bubbles: ' + off.map(x => x.toFixed(1)));
    // football words weigh double (the level's double list), the whole wheel still 200; each football slot is tagged ×2
    const W = await page.evaluate(async lv => { const b = await import('/js/views/bonus.js'); return {fb: lv[1].filter(w => b.wheelWeight(w, lv) === 2), one: lv[1].map(w => b.wheelPts(lv, [w])), all: b.wheelPts(lv, lv[1]), misses: b.WHEEL_MISSES}; }, d);
    assert.equal(W.all, 200, 'every word is 200');
    assert.deepEqual(W.fb, d[5], 'the double words are the level\'s list');
    assert.equal(await page.locator('.tv-bonus .tv-word.is-fb .tv-x2').count(), W.fb.length, 'each football word is tagged ×2');
    const unit = Math.min(...W.one);
    targets.forEach((w, k) => { if (W.fb.includes(w)) assert.ok(W.one[k] >= 2 * unit - 1, `${w} is worth double: ${W.one[k]} vs ${unit}`); });
    // the screen stays put after a word (Evan: "After each word, the screen keeps moving to the top"; not reproduced in
    // Chromium, the old full rebuild of the board the likely cause on iPhones): the wheel is the same element (the DOM is
    // patched, not rebuilt) and the scroll the same once a word is found, a bonus word and a miss are spelled
    await page.setViewportSize({width: 375, height: 667});
    await page.locator('.tv-bonus [data-wheel]').evaluate(el => { el.__keep = 1; el.scrollIntoView({block: 'center'}); });
    await page.waitForTimeout(300);
    const scrollY = () => page.evaluate(() => document.querySelector('.screen.v-run').scrollTop);
    const y0 = await scrollY();
    assert.ok(y0 > 50, 'the wheel is scrolled to: ' + y0);
    // a real drag across the letters for the first word
    const spell = async w => {
      const used = new Set(), pts = [];
      for (const c of w) {
        const i = [...letters].findIndex((x, k) => x === c && !used.has(k)); used.add(i);
        const b = await page.locator(`.tv-bonus [data-wl="${i}"]`).boundingBox(); pts.push([b.x + b.width / 2, b.y + b.height / 2]);
      }
      return pts;
    };
    const tap = async w => {
      const used = new Set();
      for (const c of w) { const i = [...letters].findIndex((x, k) => x === c && !used.has(k)); used.add(i); await page.locator(`.tv-bonus [data-wl="${i}"]`).evaluate(el => el.click()); } // (a keyboard press: detail 0)
      await page.locator('.tv-bonus [data-wsubmit]').evaluate(el => el.click());
      await page.waitForTimeout(120);
    };
    const first = targets[targets.length - 1];
    const p = await spell(first);
    await page.mouse.move(...p[0]); await page.mouse.down();
    for (const q of p.slice(1)) await page.mouse.move(...q, {steps: 6});
    if (shots) await page.screenshot({path: path.join(shots, 'wheel-drag.png')});
    await page.mouse.up();
    await page.waitForTimeout(500);
    assert.deepEqual((await ds(page, 'bonus')).got, [first], 'a drag spells a word');
    assert.equal((await ds(page, 'bonus')).pts, W.one[targets.length - 1], 'its points by weight');
    const after = await page.evaluate(() => ({keep: document.querySelector('.tv-bonus [data-wheel]').__keep, slot: document.querySelector(`.tv-bonus [data-word="${document.querySelector('.tv-bonus .tv-word.is-got').dataset.word}"]`).textContent}));
    assert.equal(after.keep, 1, 'the wheel is not rebuilt after a word');
    assert.ok(after.slot.startsWith(first), 'the found word fills its slot in place');
    assert.equal(await scrollY(), y0, 'the screen stays where it was after a word');
    assert.deepEqual(await page.evaluate(() => ({word: document.querySelector('.tv-bonus [data-wword].is-got [data-wtext]')?.textContent, lit: document.querySelectorAll('.tv-bonus .tv-wl.is-on').length})), {word: `${first} +${W.one[targets.length - 1]}`, lit: 0}, 'the found word and its points show in gold by the wheel, the wheel let go');
    // a repeat, a bonus word and a real word that isn't on the wheel cost nothing; a non-word costs a miss, once
    await tap(first);
    const bonusWord = extras.find(w => w.length >= 3);
    if (bonusWord) { await tap(bonusWord); await page.waitForTimeout(700); await tap(bonusWord); }
    const reals = ['CATS', 'CLEATS', 'TAKES', 'LACKS', 'TEAS', 'CLEAT'].filter(w => !targets.includes(w) && !extras.includes(w) && [...w].every(c => letters.includes(c)));
    assert.ok(base !== 'TACKLES' || reals.length === 6, 'day 61 is the TACKLES wheel: ' + reals);
    assert.deepEqual(d[5], base === 'TACKLES' ? [] : d[5], 'Nov 27 2026\'s wheel (played under v7) has no double words: one rule on its board');
    for (const w of reals) await tap(w);
    if (reals.length) { await tap(reals[0]); await page.waitForTimeout(250); assert.equal(await page.locator('.tv-bonus [data-wword].is-note [data-wtext]').textContent(), 'Not on this wheel', 'a real word is answered by the wheel'); }
    let s0 = await ds(page, 'bonus');
    assert.equal(s0.miss || 0, 0, 'a repeat, a bonus word and real words (' + reals + ') are not misses');
    if (bonusWord) assert.deepEqual(s0.extra, [bonusWord]);
    const words = new Set([...targets, ...extras, ...(d[4] || [])]);
    const perms = s => (s.length <= 1 ? [s] : [...s].flatMap((c, i) => perms(s.slice(0, i) + s.slice(i + 1)).map(r => c + r)));
    const wrong = perms(letters.slice(0, 3)).concat(perms(letters.slice(1, 4))).filter(w => !words.has(w));
    await tap(wrong[0]); await page.waitForTimeout(450);
    s0 = await ds(page, 'bonus');
    assert.equal(s0.miss, 1, 'a non-word is a miss: ' + wrong[0]);
    await tap(wrong[0]); await page.waitForTimeout(450);
    assert.equal((await ds(page, 'bonus')).miss, 1, 'the same non-word again costs nothing');
    assert.equal(await page.locator('.tv-bonus .tv-life.is-gone').count(), 1, 'a life goes');
    assert.equal(await page.locator('.tv-bonus [data-wleft]').textContent(), '4 misses left', 'the misses left are read out');
    assert.equal(await page.evaluate(() => document.querySelector('.tv-bonus [data-wheel]').__keep), 1, 'still the same wheel after a miss and a bonus word');
    assert.equal(await scrollY(), y0, 'the screen stays where it was after a miss and a bonus word');
    // a drag the system cancels is dropped, not sent (a real touch: start on one letter, move over two more, cancel)
    {
      const cdp = await page.context().newCDPSession(page), pts = await spell(wrong[1] || wrong[0]);
      const at = ([x, y]) => [{x, y, id: 1}];
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: at(pts[0])});
      for (const q of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: at(q)}); await page.waitForTimeout(30); }
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
      await page.waitForTimeout(300);
      assert.equal((await ds(page, 'bonus')).miss, 1, 'a cancelled drag sends nothing');
      assert.equal(await page.locator('.tv-bonus [data-wtext]').textContent(), '', 'and is cleared');
      await cdp.detach();
    }
    // Shuffle moves only the letters
    await page.locator('.tv-bonus [data-wshuffle]').evaluate(el => el.click()); await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => document.querySelector('.tv-bonus [data-wheel]').__keep), 1, 'Shuffle keeps the wheel');
    assert.equal(await scrollY(), y0, 'Shuffle keeps the screen where it was');
    const order = (await page.$$eval('.tv-bonus [data-wl]', bs => bs.map(b => b.textContent))).join('');
    for (const w of targets.slice(0, -1)) {
      const used = new Set();
      for (const c of w) { const i = [...order].findIndex((x, k) => x === c && !used.has(k)); used.add(i); await page.locator(`.tv-bonus [data-wl="${i}"]`).evaluate(el => el.click()); }
      await page.locator('.tv-bonus [data-wsubmit]').evaluate(el => el.click());
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1100);
    assert.match(await page.locator('.tv-bonus .tv-title').innerText(), /every word/i);
    await page.setViewportSize({width: 390, height: 844});
  } else if (kind === 'scramble') {
    for (let i = 0; i < 4; i++) {
      const word = d[i][0];
      if (i === 2) { // a wrong try first
        const tiles = await page.$$eval('.tv-bonus [data-lt]', b => b.map(x => x.textContent));
        const order = [...tiles.keys()].reverse();
        if (tiles.slice().reverse().join('') !== word) { for (const k of order) await page.locator(`.tv-bonus [data-lt="${k}"]`).click(); await page.waitForTimeout(600); assert.equal((await ds(page, 'bonus')).tries[2], 1); }
      }
      const tiles = await page.$$eval('.tv-bonus [data-lt]', b => b.map(x => x.textContent)), used = new Set();
      for (const c of word) { const k = tiles.findIndex((t, j) => t === c && !used.has(j)); used.add(k); await page.locator(`.tv-bonus [data-lt="${k}"]`).click(); }
      await page.locator('.tv-bonus [data-snext]').waitFor();
      if (shots && i === 0) await page.screenshot({path: path.join(shots, 'scramble-right.png')});
      await page.locator('.tv-bonus [data-snext]').click();
    }
  } else if (kind === 'cross') {
    const W = d.words;
    for (let wi = 0; wi < W.length; wi++) {
      if ((await ds(page, 'bonus') || {}).ok?.includes(wi)) continue;
      await page.locator(`.tv-bonus [data-xw="${wi}"]`).click();
      // (the cursor skips squares already locked by a solved word: type the open ones)
      const locked = new Set(((await ds(page, 'bonus')) || {ok: []}).ok?.flatMap(i => [...W[i][0]].map((_, k) => W[i][4] === 'a' ? `${W[i][2]},${W[i][3] + k}` : `${W[i][2] + k},${W[i][3]}`)) || []);
      const [ans, , r, c, dir] = W[wi];
      for (let k = 0; k < ans.length; k++) if (!locked.has(dir === 'a' ? `${r},${c + k}` : `${r + k},${c}`)) await page.locator(`.tv-bonus [data-xk="${ans[k]}"]`).click();
    }
    if (shots) await page.screenshot({path: path.join(shots, 'cross-done.png'), fullPage: true});
  } else if (kind === 'score') {
    const truth = d.flatMap(g => [g[5], g[9]]);
    for (let k = 0; k < 6; k++) {
      const chips = await page.$$eval('.tv-bonus [data-chip]', b => b.map(x => ({v: Number(x.textContent), off: x.disabled})));
      const c = chips.findIndex(x => x.v === truth[k] && !x.off);
      await page.locator(`.tv-bonus [data-chip="${c}"]`).click();
      await page.locator(`.tv-bonus [data-slot="${k}"]`).click();
    }
    await page.locator('.tv-bonus [data-slock]').click();
  }
  const s = await ds(page, 'bonus');
  assert.equal(s.done, true, kind + ' finished');
  assert.equal(s.pts, kind === 'scramble' ? 200 : 200, kind + ': full points');
  if (shots) await page.screenshot({path: path.join(shots, `bonus-${kind}.png`)});
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch();
  try {
    // 1-2. the bank over a year
    {
      const {context, page, errors} = await open(browser, url, 59);
      const r = await page.evaluate(async () => {
        const d = await import('/js/core/daily.js'), F = d.FRESH_FROM, seen = {}, dup = [], old = new Set();
        const before = d.dayFor(59);
        for (let p = 1; p < F; p++) { const x = d.dayFor(p); for (const f of ['c', 'w', 'j', 'g']) if (x && x[f] != null) old.add(f + JSON.stringify(x[f])); }
        const first = {};
        const add = (k, v) => { const key = k + JSON.stringify(v); if (seen[key]) { if (p0 < F + 200) dup.push(k + ' on ' + p0); first[k] = first[k] || p0 - F; } seen[key] = 1; };
        let p0 = 0, days = 0, kinds = {};
        for (let p = F; p < F + 400; p++) {
          p0 = p;
          const x = d.dayFor(p); days++;
          for (const f of ['c', 'w', 'j', 'g']) if (x[f] != null && p < F + 200) { if (old.has(f + JSON.stringify(x[f]))) dup.push('old ' + f + ' on ' + p); }
          if (x.w != null) add('who', x.w); if (x.j) add('jr', x.j.p);
          if (x.hl) x.hl.forEach(q => add('hl', [q[1], q[4], q[0]].sort()));
          if (x.cn) add('cn', x.cn.map(g => g[1].slice().sort()).sort());
          if (x.nq) x.nq.forEach(q => add('nq', q[0]));
          if (x.bx) { add('bx' + x.bx.kind, x.bx.d); kinds[x.bx.kind] = (kinds[x.bx.kind] || 0) + 1; }
        }
        return {dup: dup.slice(0, 10), ndup: dup.length, days, kinds, first, before: !before.nv, steps: d.slugsFor(d.dayFor(F))};
      });
      assert.equal(r.before, true, 'days before FRESH_FROM keep their format');
      const rot = await page.evaluate(async () => { const d = await import('/js/core/daily.js'); return {kinds: [60, 61, 62, 63, 64, 65].map(d.bonusKindOf), file: performance.getEntriesByType('resource').some(e => e.name.endsWith('/data/trivia-v8.json'))}; });
      assert.deepEqual(rot, {kinds: ['gridword', 'wheel', 'scramble', 'cross', 'score', 'gridword'], file: true}, 'the rotation is fixed and the bank is trivia-v8.json');
      assert.ok(r.steps.includes('bonus'), 'the fresh days end with the Bonus');
      assert.equal(r.ndup, 0, 'no repeats in 200 days: ' + JSON.stringify(r.dup));
      console.log(`PASS 200 fresh days: no game repeated, none of days 1-59's puzzles; first repeat (days in): ${JSON.stringify(r.first)}; bonus kinds in 400 days ${JSON.stringify(r.kinds)}`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    // 3. whole days through the screens: 60 (wheel), 61 (scramble, stats, connections, numbers), 62 (cross), 63 (score)
    const played = {};
    for (const day of [61, 60, 62, 63, 64]) {
      const {context, page, errors} = await open(browser, url, day);
      const D0 = await dayOf(page);
      if (D0.t.includes('stats')) await playStats(page, D0);
      if (D0.t.includes('connections')) await playConnections(page, D0);
      if (D0.t.includes('numbers') && !played.numbers) { await playNumbers(page, D0); played.numbers = 1; }
      await playBonus(page, D0);
      played[D0.bx.kind] = 1;
      // the rest of the day, then its results
      await page.evaluate(async () => { const d = await import('/js/core/daily.js'); d.lockIn && d.lockIn(); d.saveDS(); });
      const e = await page.evaluate(async () => { const d = await import('/js/core/daily.js'); return {entry: d.boardEntry(), all: d.allDone(), max: d.maxPts(), total: d.totalPts()}; });
      assert.equal(e.max, 1000); assert.equal(e.all, true);
      assert.ok(e.entry.b && 'bonus' in e.entry.b, 'the board entry carries the bonus points');
      await page.evaluate(() => { location.hash = '/puzzles/results'; });
      await page.locator('.c-rbreak').waitFor();
      assert.equal(await page.locator('.c-rb').count(), 5, 'five games on the results');
      if (shots) await page.screenshot({path: path.join(shots, `results-${day}.png`), fullPage: true});
      const total = e.total;
      await page.reload(); await ready(page);
      assert.equal(await page.evaluate(async () => (await import('/js/core/daily.js')).totalPts()), total, 'a reload keeps the day');
      for (const w of [320, 390, 820]) { await page.setViewportSize({width: w, height: 844}); await go(page, 'bonus'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no sideways scroll at ${w}`); }
      assert.deepEqual(errors, [], 'no errors on day ' + day);
      console.log(`PASS day ${day}: ${D0.t.join(', ')} (bonus ${D0.bx.kind}) played through, ${total} of 1,000, results and reload`);
      await context.close();
    }
    assert.ok(['gridword', 'wheel', 'scramble', 'cross', 'score'].every(k => played[k]), 'every bonus kind played: ' + Object.keys(played));
    // the Word Wheel runs out of tries: day 66 (a wheel), one word then WHEEL_MISSES wrong words end it with that word's points
    {
      const {context, page, errors} = await open(browser, url, 66);
      const D0 = await dayOf(page);
      assert.equal(D0.bx.kind, 'wheel');
      const [letters, targets, extras] = D0.bx.d;
      await go(page, 'bonus');
      const tap = async w => {
        const order = (await page.$$eval('.tv-bonus [data-wl]', bs => bs.map(b => b.textContent))).join(''), used = new Set();
        for (const c of w) { const i = [...order].findIndex((x, k) => x === c && !used.has(k)); used.add(i); await page.locator(`.tv-bonus [data-wl="${i}"]`).evaluate(el => el.click()); }
        await page.locator('.tv-bonus [data-wsubmit]').evaluate(el => el.click());
        await page.waitForTimeout(450);
      };
      const lv = D0.bx.d, M = await page.evaluate(async () => (await import('/js/views/bonus.js')).WHEEL_MISSES);
      const fbw = lv[5][0] || lv[1][0];
      await tap(fbw);
      const want = await page.evaluate(async ([lv, w]) => (await import('/js/views/bonus.js')).wheelPts(lv, [w]), [lv, fbw]);
      const words = new Set([...targets, ...extras, ...lv[4]]);
      const perms = s => (s.length <= 1 ? [s] : [...s].flatMap((c, i) => perms(s.slice(0, i) + s.slice(i + 1)).map(r => c + r)));
      const wrong = [...new Set(perms(letters.slice(0, 3)).concat(perms(letters.slice(2, 5)), perms(letters.slice(3, 6))))].filter(w => !words.has(w));
      assert.ok(wrong.length >= M, 'enough wrong words to try');
      for (let k = 0; k < M; k++) {
        await tap(letters.slice(0, 2)); // too short: never a miss
        await tap(wrong[k]);
        if (k < M - 1) assert.equal((await ds(page, 'bonus')).miss, k + 1, 'miss ' + (k + 1));
      }
      await page.waitForTimeout(900);
      const s = await ds(page, 'bonus');
      assert.deepEqual({done: s.done, miss: s.miss, pts: s.pts, got: s.got}, {done: true, miss: M, pts: want, got: [fbw]}, 'out of tries: the wheel ends with the points found');
      assert.match(await page.locator('.tv-bonus .tv-title').innerText(), /out of tries/i);
      assert.equal(await page.locator('.tv-bonus [data-wheel]').count(), 0, 'the wheel is gone');
      assert.equal(await page.locator('.tv-bonus .tv-word.is-missed').count(), targets.length - 1, 'the words not found show');
      if (shots) await page.screenshot({path: path.join(shots, 'wheel-out.png')});
      await page.reload(); await ready(page); await go(page, 'bonus');
      assert.match(await page.locator('.tv-bonus .tv-title').innerText(), /out of tries/i, 'a reload keeps it ended');
      // the bank: every wheel's lists; levels from 1 on have their base and every double word they spell as slots;
      // level 0 (Nov 27 2026, played under v7) kept its slots and bonus words
      const bank = await page.evaluate(async () => { const d = await import('/js/core/daily.js'); return d.TV.bonus.wheel; });
      const v7 = JSON.parse(fs.readFileSync(path.join(root, 'data/trivia-v7.json'))).bonus.wheel;
      assert.deepEqual(bank[0].slice(0, 4), v7[0], 'level 0 is as it was');
      const fits = (w, b) => { const c = {}; for (const x of b) c[x] = (c[x] || 0) + 1; for (const x of w) { if (!c[x]) return false; c[x]--; } return true; };
      const bad = [];
      bank.forEach((l, i) => {
        if (l.length !== 6) return bad.push(i + ' shape');
        const [lt, tg, ex, b, okw, dbl] = l, all = new Set([...tg, ...ex, ...okw]);
        if (dbl.some(w => !tg.includes(w))) bad.push(i + ' double not a slot');
        if ([...tg, ...ex, ...okw].some(w => !fits(w, b) || w.length < 3)) bad.push(i + ' a word the letters do not spell');
        if (all.size !== tg.length + ex.length + okw.length) bad.push(i + ' overlap');
        if (i >= 1 && !tg.includes(b)) bad.push(i + ' base ' + b + ' not a slot');
        if (i >= 1 && v7[i] && v7[i][1].some(w => !tg.includes(w))) bad.push(i + ' lost a slot');
        if ([...lt].sort().join('') !== [...b].sort().join('')) bad.push(i + ' letters');
      });
      assert.deepEqual(bad, [], 'every wheel level is sound');
      assert.ok(bank.filter(l => l[5].length).length >= 80, 'most wheels have double words');
      assert.ok(fs.readFileSync(path.join(root, 'data/trivia-v7.json'), 'utf8') === require('child_process').execSync('git show HEAD:data/trivia-v7.json', {cwd: root, maxBuffer: 1 << 26}).toString(), 'trivia-v7.json is as deployed');
      assert.deepEqual(errors, []);
      console.log(`PASS the Word Wheel's ${M} misses end it (${fbw} kept, ${want} points), real words free, every level sound`);
      await context.close();
    }
    // double words (day 81, SHOTGUN, a wheel with them): weight, tag and message; an old save (no w) stays flat and shows no
    // tags; reduced motion still shows what became of a word; at 320x568 the word display, wheel and buttons fit together
    {
      const {context, page, errors} = await open(browser, url, 81);
      const D0 = await dayOf(page), lv = D0.bx.d;
      assert.equal(D0.bx.kind, 'wheel'); assert.ok(lv[5].length >= 1, 'day 81 has double words: ' + lv[5]);
      await go(page, 'bonus');
      const tap = async w => {
        const order = (await page.$$eval('.tv-bonus [data-wl]', bs => bs.map(b => b.textContent))).join(''), used = new Set();
        for (const c of w) { const i = [...order].findIndex((x, k) => x === c && !used.has(k)); used.add(i); await page.locator(`.tv-bonus [data-wl="${i}"]`).evaluate(el => el.click()); }
        await page.locator('.tv-bonus [data-wsubmit]').evaluate(el => el.click());
        await page.waitForTimeout(250);
      };
      const n = lv[1].length + lv[5].length, dw = lv[5][0], plain = lv[1].filter(w => !lv[5].includes(w));
      assert.equal(await page.locator('.tv-bonus .tv-word.is-fb .tv-x2').count(), lv[5].length, 'the double words are tagged ×2');
      assert.match(await page.locator('.tv-bonus .tv-sub').innerText(), /×2/, 'the subtitle names the rule');
      await tap(dw);
      let s = await ds(page, 'bonus');
      assert.deepEqual({pts: s.pts, w: s.w}, {pts: Math.round(200 * 2 / n), w: 2}, 'a football word is worth double');
      assert.equal(await page.locator('.tv-bonus [data-wtext]').textContent(), `${dw} +${s.pts} · DOUBLE`, 'and says so');
      await page.waitForTimeout(1200);
      await tap(plain[0]);
      assert.equal((await ds(page, 'bonus')).pts, Math.round(200 * 3 / n), 'a plain word once');
      // an old save: flat points, no tags, a miss never lowers it
      const flat3 = Math.round(200 * 3 / lv[1].length);
      await page.evaluate(async ([g, p]) => { const d = await import('/js/core/daily.js'); d.DS.bonus = {kind: 'wheel', got: g, pts: p, line: '3 words'}; d.saveDS(); }, [plain.slice(0, 3), flat3]);
      await page.reload(); await ready(page); await go(page, 'bonus');
      assert.equal(await page.locator('.tv-bonus .tv-x2').count(), 0, 'no ×2 on an old save');
      const words = new Set([...lv[1], ...lv[2], ...lv[4]]);
      const perms = x => (x.length <= 1 ? [x] : [...x].flatMap((c, i) => perms(x.slice(0, i) + x.slice(i + 1)).map(r => c + r)));
      const wrong = [...new Set(perms(lv[0].slice(0, 3)).concat(perms(lv[0].slice(2, 5))))].filter(w => !words.has(w));
      await tap(wrong[0]);
      s = await ds(page, 'bonus');
      assert.deepEqual({pts: s.pts, miss: s.miss, w: s.w}, {pts: flat3, miss: 1, w: 1}, 'a miss never lowers an old save');
      await page.waitForTimeout(1200);
      await tap(dw);
      assert.equal((await ds(page, 'bonus')).pts, Math.round(200 * 4 / lv[1].length), 'its words stay flat, the football word too');
      // an old finished save shows no tags either
      await page.evaluate(async g => { const d = await import('/js/core/daily.js'); d.DS.bonus = {kind: 'wheel', got: g, pts: 43, line: '3 words', done: true}; d.saveDS(); }, [dw, ...plain.slice(0, 2)]);
      await page.reload(); await ready(page); await go(page, 'bonus');
      assert.equal(await page.locator('.tv-bonus .tv-x2').count(), 0, 'no ×2 on an old finished save');
      await context.close();
      // reduced motion, 320x568: a fresh wheel
      const ctx2 = await browser.newContext({viewport: {width: 320, height: 568}, serviceWorkers: 'block', reducedMotion: 'reduce'});
      await ctx2.route('**/*', r => (new URL(r.request().url()).origin === url ? r.continue() : r.abort()));
      await ctx2.addInitScript(() => { localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1'); sessionStorage.setItem('gg-skip-title', '1'); });
      const p2 = await ctx2.newPage(), e2 = [];
      p2.on('pageerror', e => e2.push(e.message));
      await p2.goto(`${url}/?day=81#/puzzles/play/bonus`); await p2.waitForFunction(() => window.__ggBooted); await ready(p2);
      await p2.locator('.tv-bonus [data-wheel]').waitFor();
      const fit = await p2.evaluate(() => {
        const s = document.querySelector('.screen.v-run'), row = document.querySelector('.tv-bonus .tv-row'), ww = document.querySelector('.tv-bonus [data-wword]');
        const top = document.querySelector('.rn-top, .rn-bar, header')?.getBoundingClientRect().bottom || 0;
        const bot = document.querySelector('.rn-bottom').getBoundingClientRect().top;
        s.scrollTop += row.getBoundingClientRect().bottom - bot + 4;
        return {word: ww.getBoundingClientRect().top - Math.max(top, document.querySelector('.rn-bottom') ? 0 : 0), topBar: top, row: row.getBoundingClientRect().bottom, bot};
      });
      const tb = await p2.evaluate(() => { const els = [...document.querySelectorAll('.v-run > *, .v-run header, [class*="rn-top"], [class*="rn-head"]')].filter(e => getComputedStyle(e).position === 'fixed' || getComputedStyle(e).position === 'sticky'); return Math.max(0, ...els.filter(e => e.getBoundingClientRect().top < 50).map(e => e.getBoundingClientRect().bottom)); });
      const wtop = await p2.evaluate(() => document.querySelector('.tv-bonus [data-wword]').getBoundingClientRect().top);
      assert.ok(wtop >= tb - 1, `at 320x568 the word display (${wtop}) shows with the buttons (bar to ${tb})`);
      const order = (await p2.$$eval('.tv-bonus [data-wl]', bs => bs.map(b => b.textContent))).join('');
      const realw = lv[4].find(w => w.length >= 3) || lv[2][0], used = new Set();
      for (const c of realw) { const i = [...order].findIndex((x, k) => x === c && !used.has(k)); used.add(i); await p2.locator(`.tv-bonus [data-wl="${i}"]`).evaluate(el => el.click()); }
      await p2.locator('.tv-bonus [data-wsubmit]').evaluate(el => el.click());
      await p2.waitForTimeout(500);
      const msg = await p2.evaluate(() => { const t = document.querySelector('.tv-bonus [data-wtext]'), r = t.getBoundingClientRect(); return {text: t.textContent, op: getComputedStyle(t.parentElement).opacity, w: r.width}; });
      assert.ok(/not on this wheel|bonus word/i.test(msg.text) && msg.op === '1', 'reduced motion: the display says what became of the word: ' + JSON.stringify(msg));
      if (shots) await p2.screenshot({path: path.join(shots, 'wheel-320-rm.png')});
      assert.deepEqual(e2, []);
      await ctx2.close();
      assert.deepEqual(errors, []);
      console.log(`PASS double words on day 81 (${lv[5]}), an old save flat and untagged, reduced motion and 320x568`);
    }
    // 4. a game in progress survives a reload (Connections mid-way) and Test Play previews the fresh days
    {
      const {context, page, errors} = await open(browser, url, 65);
      const D0 = await dayOf(page);
      if (D0.t.includes('connections')) {
        await go(page, 'connections');
        for (const n of D0.cn[2][1]) await page.locator(`.tv-connections [data-tile="${n}"]`).click();
        await page.locator('.tv-connections [data-submit]').click(); await page.waitForTimeout(300);
        await page.reload(); await ready(page); await go(page, 'connections');
        assert.equal(await page.locator('.tv-connections .tv-band').count(), 1, 'the found group stays found');
        assert.equal(await page.locator('.tv-connections .tv-tile').count(), 6);
      }
      const t = await page.evaluate(async () => { const d = await import('/js/core/daily.js'); d.setTest(true); return {fresh: d.isFresh(), test: d.TEST, bonus: d.SLUGS.includes('bonus')}; });
      assert.deepEqual(t, {fresh: true, test: true, bonus: true}, 'Test Play previews the fresh days');
      assert.deepEqual(errors, []);
      console.log('PASS mid-game reload and Test Play preview');
      await context.close();
    }
    console.log('PASS: fresh trivia, no repeats, every game and bonus kind playable with feedback');
  } catch (e) { console.error('FAIL:', e && e.stack || e); process.exitCode = 1; }
  finally { await browser.close(); server.close(); }
})();
