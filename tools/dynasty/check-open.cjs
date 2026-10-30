// Gridiron Dynasty's packs in a real browser (the real app, Firebase off, Evan's profile with a seeded Dynasty): opens a
// pack the way a player does (Open, then a swipe across its top), records the whole thing as a video and cuts it into
// contact sheets, then goes through the cards (a touch swipe, a mouse swipe, then taps; a tap mid-reveal finishes it) to
// the results and Done, checking each step moves one card on and that closing leaves nothing running. --gallery instead
// draws every pack design big, side by side.
//   node tools/dynasty/check-open.cjs [--kind std|team|prem|gday|leg|start] [--out DIR] [--dpr 2] [--reduced] [--size 390x844]
//     [--mix d1,t3,d4,s1,s2,c1] (opens those marks straight through openScene: d diamonds, s stars, c crown, t a Trainer's ◆s)
//     [--hold] (holds ⏩ on the second card: through the rest to the results) [--sheet] (a card's sheet up close, tilted)
//     [--keys] (by keyboard: Enter rips it, Enter and the arrows go on, Skip, then Escape closes; focus goes back)
//     [--stills] (stills along the opening and the reveals too: a still stalls the page about a second, so they and the
//     video lose true time; without it the opening and reveals are only filmed, and the log says which sheet has what)
//   node tools/dynasty/check-open.cjs --gallery [--only leg,gday] [--tile 116] [--out DIR] [--dpr 2]
// --kind start opens a drawn Starter Pack (20 cards) straight through openScene too. Prints where it put things. Fails on
// any uncaught page error.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const ONLY = String(arg('only', '')).split(',').filter(Boolean), TILE = +arg('tile', 116);
const KEYS = !!arg('keys', false), STILLS = !!arg('stills', false), MIX = String(arg('mix', '')), HOLD = !!arg('hold', false), SHEET = !!arg('sheet', false), SIZE = String(arg('size', '390x844')).split('x').map(Number);
const KIND = arg('kind', 'leg'), OUT = path.resolve(arg('out', path.join(root, '../dynasty-qa'))), DPR = +arg('dpr', 2), REDUCED = !!arg('reduced', false), GALLERY = !!arg('gallery', false);
fs.mkdirSync(OUT, {recursive: true});
let pw;
try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, bytes) => {
    // (a route like /puzzles/dynasty is the app's page)
    if (err && !path.extname(file)) return fs.readFile(path.join(root, 'index.html'), (e2, b2) => send(path.join(root, 'index.html'), b2));
    if (err) { res.writeHead(404).end(); return; }
    send(file, bytes);
  });
  function send(file, bytes) {
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(bytes);
  }
});
// A Dynasty begun with its Starter Pack opened: some cards, coins, no packs waiting (Evan's packs are unlimited anyway).
const SAVE = {v: 1, born: Date.now() - 864e5, at: Date.now(), o: {'C-timeout': 2, 'C-twomin': 2, 'C-audible': 2, 'C-scout': 1, 'C-flag': 1, 'I-recruit': 2, 'I-water': 2},
  pk: {}, cl: {}, dk: [], nw: [], lp: [], pp: 40, sp: 0, cr: 50000, dd: '', kit: 1, kit2: 1, kit3: 1, tr: 0, rec: {w: 0, l: 0}, nm: ''};

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch();
  const vid = path.join(OUT, 'video');
  fs.rmSync(vid, {recursive: true, force: true});
  const context = await browser.newContext({viewport: {width: SIZE[0], height: SIZE[1]}, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    reducedMotion: REDUCED ? 'reduce' : 'no-preference', ...(GALLERY ? {} : {recordVideo: {dir: vid, size: {width: SIZE[0], height: SIZE[1]}}})});
  await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [], T0 = Date.now();
  const mark = what => console.log(`${what}: ${((Date.now() - T0) / 1000).toFixed(1)} s, sheet-${String(Math.floor((Date.now() - T0) / 1000 * 1.2)).padStart(2, '0')}`);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  // (counts the window's keydown listeners and the frames asked for, to see that closing leaves nothing behind)
  await page.addInitScript(() => {
    const add = window.addEventListener, rem = window.removeEventListener, raf = window.requestAnimationFrame;
    window.__wl = 0; window.__raf = 0;
    window.addEventListener = function (t, f, o) { if (t === 'keydown') window.__wl++; return add.call(this, t, f, o); };
    window.removeEventListener = function (t, f, o) { if (t === 'keydown') window.__wl--; return rem.call(this, t, f, o); };
    window.requestAnimationFrame = function (f) { window.__raf++; return raf.call(this, f); };
  });
  await page.addInitScript(save => {
    sessionStorage.setItem('gg-skip-title', '1');
    localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-tab-hint', '2'); localStorage.setItem('gg-release-3.0:evan', '1'); localStorage.setItem('gg-dynasty-seen', '1');
    if (!localStorage.getItem('gg-dy1-m_evan')) localStorage.setItem('gg-dy1-m_evan', JSON.stringify(save));
  }, SAVE);
  await page.goto(url);
  await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
  await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
  await page.locator('.pk-bigpack').waitFor({timeout: 30000});
  // (the title screen on entering, Oct 29 2026, views/dynasty.js startHTML: a tap through it once the cards are in)
  if (await page.locator('.pk-start').count()) {
    await page.locator('.pk-start.is-ready').waitFor({timeout: 30000});
    await page.locator('.pk-start').click({position: {x: Math.round(SIZE[0] / 2), y: Math.round(SIZE[1] * .76)}}); // (low on the screen, whatever its size)
    await page.waitForFunction(() => !document.querySelector('.pk-start'), null, {timeout: 10000});
  }
  await page.waitForTimeout(600);
  let shotMs = 0, shots = 0;
  const shot = async name => { const f = path.join(OUT, name + '.png'), t0 = Date.now(); await page.screenshot({path: f}); shotMs += Date.now() - t0; shots++; return f; };
  const made = [];
  if (GALLERY) {
    // every design of every pack, big, on Pocket's ground (views/dynasty-packs.js: DESIGNS when it has them)
    await page.evaluate(async ({only, tile}) => {
      const P = await import('/js/views/dynasty-packs.js'), D = await import('/js/core/dynasty.js');
      const kinds = ['start', ...D.PACK_ORDER].filter(k => !only.length || only.includes(k));
      const n = k => (P.designsOf ? P.designsOf(k).length : 1);
      const el = document.createElement('div');
      el.id = 'qa-gallery';
      el.style.cssText = 'position:fixed;inset:0;z-index:999;overflow:auto;background:#E9EFF4;padding:12px;display:flex;flex-direction:column;gap:14px';
      el.innerHTML = kinds.map(k => `<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap"><b style="width:100%;font:800 13px system-ui">${k}</b>`
        + Array.from({length: n(k)}, (_, i) => `<span style="width:${tile}px;display:block">${P.packHTML(k, {big: true, design: i})}</span>`).join('') + '</div>').join('');
      el.querySelectorAll('.pk-pack').forEach(p => { p.style.width = '100%'; });
      document.body.appendChild(el);
    }, {only: ONLY, tile: TILE});
    await page.waitForTimeout(800);
    const h = await page.evaluate(() => document.getElementById('qa-gallery').scrollHeight);
    const w = await page.evaluate(() => document.getElementById('qa-gallery').scrollWidth);
    await page.setViewportSize({width: Math.max(390, w), height: Math.min(4000, h + 24)});
    await page.waitForTimeout(400);
    // (the whole gallery, however tall: the element itself, not the viewport)
    const gf = path.join(OUT, 'gallery.png');
    await page.locator('#qa-gallery').screenshot({path: gf});
    made.push(gf);
    // the Packs home with its big pack, and the picker sheet
    await page.evaluate(() => document.getElementById('qa-gallery').remove());
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(300);
    made.push(await shot('home'));
    await page.locator('.pk-pill[data-dy-packs]').click();
    await page.waitForTimeout(700);
    made.push(await shot('picker'));
  } else {
    const DIRECT = !!MIX || KIND === 'start';
    const rafRate = () => page.evaluate(() => new Promise(res => { const a = window.__raf; setTimeout(() => res(window.__raf - a), 1000); }));
    const before = {wl: await page.evaluate(() => window.__wl), raf: await rafRate()};
    if (!DIRECT) {
      // (the pack asked for, picked from the other booster packs: the Packs home may show another first)
      await page.locator('.pk-pill[data-dy-packs]').click();
      await page.locator(`[data-dy-pick="${KIND}"]`).click();
      await page.waitForTimeout(500);
    }
    made.push(await shot('0-home'));
    if (DIRECT) {
      // (straight through openScene: the cards asked for by their marks, or a drawn pack; nothing saved)
      await page.evaluate(async ({kind, mix}) => {
        const D = await import('/js/core/dynasty.js'), O = await import('/js/views/dynasty-open.js'), V = await import('/js/views/dynasty.js');
        const pick = m => {
          const n = +m.slice(1);
          if (m[0] === 't') return D.TRAINER_IDS.find(id => D.markOf(D.trainer(id)).n === n);
          const c = D.CARDS.find(x => { const k = D.markOf(x); return k.kind === m[0] && k.n === n; });
          return c && c.id;
        };
        const ids = mix ? mix.split(',').map(pick).filter(Boolean) : D.drawPack(kind);
        window.__dyClosed = 0;
        const was = document.querySelector('[data-dy-openhere]'); // (focus there before, to see it come back)
        if (was) was.focus();
        O.openScene({kind: D.PACKS[kind] ? kind : 'prem', design: 0, cards: ids, dup: {[ids[0]]: true}, cardHTML: V.anyHTML, onClose: () => { window.__dyClosed++; }});
      }, {kind: KIND, mix: MIX});
    } else {
      await page.locator('button.pk-open[data-dy-openhere]').click();
      if (KIND === 'team') { await page.locator('[data-dy-team]').first().click(); }
    }
    // Pocket's carousel: the packs sweep in; a swipe turns the ring, a tap takes the one in front (it spins, then grows)
    await page.locator('[data-dy-carousel]').waitFor();
    await page.waitForTimeout(500); made.push(await shot('1-carousel-in'));
    await page.waitForTimeout(1300); made.push(await shot('1-carousel'));
    const ring = () => page.evaluate(() => [...document.querySelectorAll('.dy-pp')].findIndex(e => e.classList.contains('is-front')));
    const f0 = await ring();
    await page.mouse.move(300, 380); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(300 - 170 * i / 8, 380); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(600);
    assert.notEqual(await ring(), f0, 'a swipe turns the carousel');
    await page.touchscreen.tap(195, 360);
    await page.waitForTimeout(420); made.push(await shot('1-carousel-spin'));
    await page.locator('[data-dy-tear]').waitFor();
    assert.equal(await page.evaluate(() => document.querySelector('div.pk-open').dataset.phase), 'rip', 'the chosen pack comes up for the rip');
    await page.waitForTimeout(900);
    made.push(await shot('1-pack'));
    await page.waitForTimeout(700); // (the film steadies after a still)
    const box = await page.locator('.dy-rip').boundingBox();
    const y = box.y + box.height * 0.13, x0 = box.x + box.width * 0.06, x1 = box.x + box.width * 1.02;
    const torn = () => page.evaluate(() => document.querySelector('.dy-open-pack').classList.contains('is-torn'));
    // (a plain tap: the pack shivers and the hint shows; a short swipe: the strip springs back)
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    assert.ok(await page.evaluate(() => document.querySelector('.dy-open-pack').classList.contains('is-nudge')), 'a tap on the pack nudges it');
    await page.mouse.move(x0, y); await page.mouse.down();
    for (let i = 1; i <= 4; i++) { await page.mouse.move(x0 + box.width * .3 * i / 4, y); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(400);
    assert.ok(!(await torn()) && await page.evaluate(() => document.querySelector('.dy-rip').style.getPropertyValue('--p')) === '0.000', 'short of far enough, it springs back');
    if (KEYS) {
      await page.keyboard.press('Enter');
    } else {
      // the swipe across the top: the tear line is 13% down the pack
      await page.mouse.move(x0, y); await page.mouse.down();
      for (let i = 1; i <= 14; i++) { await page.mouse.move(x0 + (x1 - x0) * i / 14, y); await page.waitForTimeout(16); }
      await page.mouse.up();
    }
    // (the tear's tween runs on frames: on a busy machine it can take longer than a fixed wait)
    await page.waitForFunction(() => document.querySelector('.dy-open-pack').classList.contains('is-torn'), null, {timeout: 3000}).catch(() => {});
    assert.ok(await torn(), 'it rips');
    mark('ripped');
    if (KEYS) {
      // (Enter during the opening: straight to the first card; then the arrows; Skip; Escape)
      const n = () => page.evaluate(() => document.querySelector('.pk-deal-n').textContent);
      await page.keyboard.press('Enter'); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.querySelector('div.pk-open').dataset.phase), 'deal', 'Enter skips the opening');
      const s1 = await n();
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
      await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100);
      console.log(`keys: ${s1} -> ${await n()} (a reveal takes one press to finish)`);
      await page.locator('[data-dy-skip]').click();
      await page.waitForTimeout(500);
      made.push(await shot('4-results'));
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      assert.equal(await page.locator('div.pk-open').count(), 0, 'Escape closes it');
      if (DIRECT) assert.equal(await page.evaluate(() => window.__dyClosed), 1, 'onClose once');
      const back = await page.evaluate(() => document.activeElement === document.body ? 'body' : document.activeElement.outerHTML.slice(0, 80));
      console.log('focus back on:', back, DIRECT ? '' : '(through the app: views/dynasty.js openPack draws the Packs screen again first, so it can only come back to focusBack)');
      if (DIRECT) assert.ok(back.includes('data-dy-openhere'), 'focus goes back');
    }
    // the opening plays (stills along the way with --stills)
    let t = 0;
    if (STILLS) for (const ms of [120, 300, 520, 800, 1100, 1350, 1600, 2000]) { await page.waitForTimeout(ms - t); t = ms; made.push(await shot(`2-open-${ms}ms`)); }
    const state = () => page.evaluate(() => { const o = document.querySelector('div.pk-open'); return o ? {phase: o.dataset.phase, rv: o.dataset.rv || '', n: (o.querySelector('.pk-deal-n') || {}).textContent || ''} : null; });
    const until = async (f, ms = 4000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await state(); if (f(s)) return s; await page.waitForTimeout(60); } return s; };
    const mid = async () => { const b = await page.locator('.dy-deck').boundingBox(); return {x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width}; };
    const cdp = await context.newCDPSession(page);
    const touchSwipe = async (dx) => {
      const m = await mid();
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: m.x, y: m.y}]});
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: m.x + dx * i / 10, y: m.y + i}]}); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    };
    const mouseSwipe = async (dx) => {
      const m = await mid();
      await page.mouse.move(m.x, m.y); await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(m.x + dx * i / 10, m.y - i); await page.waitForTimeout(16); }
      await page.mouse.up();
    };
    const num = s => parseInt(String(s && s.n), 10) || 0;
    // through the cards: a still of each (a rare one's reveal along the way), then on: a touch swipe left, a mouse swipe
    // right, then taps; one rare card is tapped mid-reveal (it finishes, no card moves), and each move is one card
    let card = 0, rares = 0;
    if (!KEYS) await until(s => !s || s.phase === 'deal');
    for (let guard = 0; guard < 40 && !KEYS; guard++) {
      const s = await state();
      if (!s || s.phase !== 'deal') break;
      card = num(s);
      mark(`card ${card}${s.rv ? ' (a reveal, tier ' + s.rv + ')' : ''}`);
      if (s.rv) {
        rares++;
        if (rares === 2 && !REDUCED) {
          const m = await mid();
          await page.waitForTimeout(500);
          await page.touchscreen.tap(m.x, m.y);
          const a = await until(x => !x.rv, 800);
          assert.ok(a.phase === 'deal' && !a.rv && num(a) === card, `a tap mid-reveal finishes it and stays on card ${card} (got ${JSON.stringify(a)})`);
          await page.waitForTimeout(300); made.push(await shot(`3-card-${card}-finished`));
        } else {
          let t1 = 0;
          if (STILLS) for (const ms of REDUCED ? [200, 500, 900] : [250, 550, 800, 1000, 1250, 1500, 1800, 2200]) { await page.waitForTimeout(ms - t1); t1 = ms; made.push(await shot(`3-card-${card}-rv-${ms}ms`)); }
          await until(x => !x.rv, 3200);
          await page.waitForTimeout(300); made.push(await shot(`3-card-${card}`));
        }
      } else { await page.waitForTimeout(800); made.push(await shot(`3-card-${card}`)); }
      if (HOLD && card === 2) {
        const ff = await page.locator('[data-dy-ff]').boundingBox();
        await page.mouse.move(ff.x + ff.width / 2, ff.y + ff.height / 3); await page.mouse.down(); await page.waitForTimeout(300);
        made.push(await shot('3-hold')); await page.waitForTimeout(500); await page.mouse.up();
        await until(x => !x || x.phase === 'results', 8000);
        break;
      }
      if (card === 1 && !REDUCED) {
        // (the top card tilts toward the pointer; a short drag springs back and moves nothing)
        const m = await mid(), top = () => page.evaluate(() => { const e = document.querySelector('.dy-dc.is-top'); return {ry: +e.style.getPropertyValue('--ry'), tf: e.style.transform}; });
        await page.mouse.move(m.x + m.w * .4, m.y - m.w * .5, {steps: 3}); await page.waitForTimeout(500);
        const tl = await top();
        assert.ok(tl.ry > 4, `the card tilts toward the pointer (--ry ${tl.ry})`);
        if (STILLS) made.push(await shot('3-card-1-tilt'));
        await page.mouse.down();
        for (let i = 1; i <= 5; i++) { await page.mouse.move(m.x + m.w * .4 - i * 10, m.y - m.w * .5); await page.waitForTimeout(60); }
        await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(500);
        assert.equal(num(await state()), 1, 'a short drag moves no card');
        assert.equal((await top()).tf, '', 'and the card springs back');
        await page.mouse.move(5, 5); await page.waitForTimeout(300);
      }
      if (card === 1) await touchSwipe(-(await mid()).w * .7);
      else if (card === 2) await mouseSwipe((await mid()).w * .7);
      else { const m = await mid(); await page.touchscreen.tap(m.x, m.y); }
      const a = await until(x => !x || x.phase !== 'deal' || num(x) !== card, 2000);
      if (a && a.phase === 'deal') assert.equal(num(a), card + 1, `one move, one card (from ${card})`);
      if (STILLS) { await page.waitForTimeout(80); made.push(await shot(`3-card-${card}-away`)); }
    }
    if (!KEYS) {
      await until(s => !s || s.phase === 'results', 3000);
      mark('results');
      await page.waitForTimeout(1200);
      made.push(await shot('4-results'));
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.dyDone !== undefined), true, 'Next has focus');
      await page.locator('[data-dy-done]').click();
      // (the grand total counting up, then the card dex with new ones: swipe them up, each lands in its slot)
      await page.waitForTimeout(1300); made.push(await shot('5-total'));
      const ph = () => page.evaluate(() => { const o = document.querySelector('div.pk-open'); return o ? o.dataset.phase : ''; });
      await page.waitForFunction(() => { const o = document.querySelector('div.pk-open'); return !o || o.dataset.phase === 'dex'; }, null, {timeout: 6000});
      if (await ph() === 'dex') {
        await page.waitForTimeout(500); made.push(await shot('6-dex-swipe'));
        const b = await page.locator('[data-dy-reg]').boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height * .6); await page.mouse.down();
        for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x + b.width / 2, b.y + b.height * .6 - 160 * i / 8); await page.waitForTimeout(16); }
        await page.mouse.up();
        await page.waitForSelector('.dy-dx-t.is-new', {timeout: 4000});
        await page.waitForTimeout(400); made.push(await shot('6-dex'));
        assert.ok(await page.evaluate(() => +document.querySelector('[data-dy-dexn]').textContent.replace(/,/g, '') > 0), 'the dex counts the card in');
      }
      await page.waitForFunction(() => !document.querySelector('div.pk-open'), null, {timeout: 30000});
      await page.waitForTimeout(400);
      assert.equal(await page.locator('div.pk-open').count(), 0, 'the overlay is gone');
      if (DIRECT) assert.equal(await page.evaluate(() => window.__dyClosed), 1, 'onClose once');
    }
    const after = {wl: await page.evaluate(() => window.__wl), raf: await rafRate()};
    console.log(`keydown listeners on window ${before.wl} -> ${after.wl}; frames a second ${before.raf} -> ${after.raf}`);
    assert.equal(after.wl, before.wl, 'the keydown listener is removed');
    assert.ok(after.raf <= before.raf + 2, 'no frames left running');
    if (SHEET) {
      // a card up close, tilted toward the pointer (views/dynasty-open.js holo)
      const c = page.locator('[data-dy-card]').first();
      if (await c.count()) {
        await c.click(); await page.locator('.pk-zoom > .pk-card').waitFor({timeout: 5000}); await page.waitForTimeout(600);
        const b = await page.locator('.pk-zoom > .pk-card').boundingBox();
        await page.mouse.move(b.x + b.width * .85, b.y + b.height * .2, {steps: 6}); await page.waitForTimeout(500);
        made.push(await shot('5-sheet-tilt'));
        await page.mouse.move(b.x + b.width * .5, b.y + b.height + 60, {steps: 4}); await page.waitForTimeout(700);
        made.push(await shot('5-sheet-flat'));
        console.log('sheet card transform:', await page.evaluate(() => getComputedStyle(document.querySelector('.pk-zoom > .pk-card')).transform));
      } else console.log('sheet: no card button on this screen to open');
    }
  }
  assert.deepEqual(errors, [], 'no uncaught errors');
  const video = GALLERY ? null : await page.video().path();
  await context.close(); await browser.close(); server.close();
  if (video) {
    // contact sheets of the opening: 12 frames a second, 10 to a sheet
    const fr = path.join(OUT, 'frames'); fs.rmSync(fr, {recursive: true, force: true}); fs.mkdirSync(fr);
    execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', 'fps=12,scale=195:-1', path.join(fr, 'f_%04d.png')]);
    const n = fs.readdirSync(fr).length;
    for (let s = 0; s * 10 < n; s++) execFileSync('ffmpeg', ['-v', 'error', '-y', '-start_number', String(s * 10 + 1), '-i', path.join(fr, 'f_%04d.png'), '-frames:v', '1', '-vf', 'tile=10x1:padding=2:color=red', path.join(OUT, `sheet-${String(s).padStart(2, '0')}.png`)]);
    console.log(`video: ${video}\nframes: ${n} at 12 fps in ${fr}; sheets: ${OUT}/sheet-NN.png (10 frames each, ${(10 / 12).toFixed(2)} s a sheet)`);
  }
  console.log(`a still takes ${Math.round(shotMs / Math.max(1, shots))} ms (the stills' times are when they began; the sheets keep true time)`);
  console.log('stills:\n' + made.filter(x => typeof x === 'string').join('\n'));
  console.log('PASS');
})().catch(e => { console.error(e); process.exit(1); });
