// Gridiron Dynasty's reveals by rarity in a real browser (the owner, Oct 29 2026: "Each player rarity should get a
// different animation when being opened in a pack. The more rare the player, the more exciting the animation";
// views/dynasty-open.js REVEAL, dealHTML). One card of every tier (◆ to ♛) goes through openScene as a pack: the elements
// each tier brings, the card face up at the reveal's end, frames at its key moments (--shots), then a second pass where
// a tap finishes each reveal and the next moves on, and a third with reduced motion (each card simply face up).
// Local only: the app is served from this folder with Firebase disabled, so nothing reaches the live board.
// Then a tap after a Rare's flip moves on at once (no dead tap).
// Usage: node tools/dynasty/check-reveal.cjs [--shots=<dir>]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});

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
const snap = (page, name) => (shots ? page.screenshot({path: path.join(shots, name + '.png')}) : Promise.resolve());

/** Opens a pack of one card a tier on the page; returns the reveals in the order they'll come (openScene deals the best last). */
async function openAll(page) {
  return page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js'), V = await import('/js/views/dynasty.js'), O = await import('/js/views/dynasty-open.js');
    await D.load();
    const pick = f => D.CARDS.find(f);
    const cards = [pick(c => c.r === 'common' && c.s === 'L'), pick(c => c.r === 'rare' && c.s === 'L'), pick(c => c.r === 'epic' && c.s === 'L'), pick(c => c.r === 'legendary' && c.s === 'L'),
      pick(c => c.r === 'mythic' && c.s === 'L'), pick(c => c.s === 'P'), pick(c => c.s === 'X')];
    window.__closed = false;
    // (every burst of confetti noted as its canvas lands, over the overlay or not: the frames take longer than it falls)
    window.__bursts = 0;
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('confetti-canvas') && getComputedStyle(n).zIndex === '201') window.__bursts++; }))).observe(document.body, {childList: true});
    O.openScene({kind: 'leg', cards: cards.map(c => c.id), dup: {[cards[1].id]: true}, cardHTML: V.anyHTML, onClose: () => { window.__closed = true; }});
    return O.dealOrder(cards).map(c => ({id: c.id, name: c.name, ...O.revealOf(c)}));
  });
}
async function rip(page) {
  await page.locator('[data-dy-tear]').waitFor({timeout: 10000});
  await page.locator('[data-dy-tear]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.pk-deal-c').waitFor({timeout: 10000});
}
const dealState = page => page.evaluate(() => {
  const el = document.querySelector('.pk-deal-c:not(.is-gone)');
  if (!el) return null;
  const t = getComputedStyle(el.querySelector('.pk-flip')).transform, m = t === 'none' ? null : new DOMMatrixReadOnly(t);
  const A = el.getAnimations({subtree: true}).filter(a => a.effect.getComputedTiming().endTime !== Infinity);
  const ov = document.querySelector('div.pk-open');
  return {cls: el.className, tier: ov.dataset.tier, lit: !!ov.dataset.lit, tint: ov.dataset.tint || '', dealing: ov.classList.contains('is-dealing'), n: document.querySelector('.pk-deal-n').textContent,
    done: !A.some(a => a.playState === 'running'), bursts: window.__bursts,
    faceUp: !m || (Math.abs(m.m11 - 1) < .01 && Math.abs(m.m13) < .01), ring: !!el.querySelector('.pk-fx-ring'), rays: !!el.querySelector('.pk-fx-rays'), flash: !!el.querySelector('.pk-fx-flash'),
    crown: !!el.querySelector('.pk-fx-crown'), sweep: !!el.querySelector('.pk-fx-sweep'), sparks: el.querySelectorAll('.pk-spk').length, tag: (el.querySelector('.pk-deal-tag') || {}).textContent || '',
    back: !!el.querySelector('.pk-flip-back'), backShown: !!el.querySelector('.pk-flip-back') && getComputedStyle(el.querySelector('.pk-flip-back')).display !== 'none', isNew: !!el.querySelector('.pk-c-new'),
    live: document.querySelectorAll('.pk-deal-stack > .pk-deal-c:not(.is-gone)').length};
});
const tapDeal = page => page.locator('.pk-deal').click({position: {x: 100, y: 100}});

async function timedPass(page, order) {
  for (let i = 0; i < order.length; i++) {
    const R = order[i], T = `tier ${R.tier} (${R.name}, ${R.name === 'common' ? R.id : R.name})`;
    const t0 = Date.now();
    const s0 = await dealState(page), bursts0 = s0.bursts;
    assert(s0, T + ': a card on the deal');
    assert.match(s0.cls, new RegExp(`\\bt-${R.tier}\\b`), T + ': the deal carries its tier');
    assert.equal(s0.tier, String(R.tier), T + ': the ground knows the tier');
    assert.equal(s0.ring, R.tier >= 2, T + ': the ring from Epic');
    assert.equal(s0.rays && s0.flash, R.tier >= 3, T + ': rays and the flash from Legendary');
    assert.equal(s0.sweep, R.tier >= 4, T + ': the sweep from Mythic');
    assert.equal(s0.crown, R.tier >= 6, T + ': the crown for a Legend');
    assert.equal(s0.sparks, R.sparks, T + ': its sparks');
    assert.equal(s0.tag, R.label, T + ': its stamp');
    assert.equal(s0.backShown, R.tier >= 1, T + ': face down past Common');
    assert.equal(s0.isNew, R.tier !== 1, T + ': NEW on every card but the copy held');
    assert.equal(s0.n, `${i + 1} of ${order.length}`, T + ': the count line keeps the rarity a surprise');
    assert.equal(s0.lit, R.tier >= 3, T + ': the ground lit from Legendary');
    if (R.tier >= 3) assert.equal(s0.tint, String(R.tier), T + ': the ground’s colour');
    assert.equal(s0.dealing, true, T + ': the overlay holds still while dealing');
    // (frames at exact moments of the reveal's clock: every animation paused and set to that time, then let run on)
    const frame = async (ms, name) => {
      if (!shots) return;
      await page.evaluate(t => document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = t; } catch (_) {} }), ms);
      await page.waitForTimeout(40); await snap(page, name);
    };
    await frame(120, `t${R.tier}-a-enter`);
    if (R.tier >= 1) { await frame(R.hold - 60, `t${R.tier}-b-hold`); await frame(R.hold + R.flip * .45, `t${R.tier}-c-flip`); await frame(R.hold + R.flip / 2 + 260, `t${R.tier}-c2-sparks`); }
    await frame(R.hold + R.flip + 400, `t${R.tier}-d-after`);
    // (then let the ones still to come run on; a finished one stays at its end, as play() would start it over)
    if (shots) {
      const left = await page.evaluate(() => { let left = 0; document.getAnimations().forEach(a => { try { const end = a.effect.getComputedTiming().endTime; if (end === Infinity || a.currentTime < end) { a.play(); if (end !== Infinity) left = Math.max(left, end - a.currentTime); } } catch (_) {} }); return left; });
      await page.waitForTimeout(left + 80);
    }
    const atMs = async ms => { const w = ms - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); };
    await atMs(R.total + 150);
    // (the frames' screenshots take their own time; the last pieces may still be running out their last frames)
    await page.waitForFunction(() => { const el = document.querySelector('.pk-deal-c:not(.is-gone)'); return !!el && !el.getAnimations({subtree: true}).some(a => a.effect.getComputedTiming().endTime !== Infinity && a.playState === 'running'); }, null, {timeout: 1500}).catch(() => {});
    const s1 = await dealState(page);
    assert.equal(s1.faceUp, true, T + ': face up at the end');
    assert.equal(s1.done, true, T + ': its reveal over');
    assert.equal(s1.bursts - bursts0, R.confetti ? (R.tier >= 6 ? 2 : 1) : 0, T + ': its confetti, over the overlay');
    if (i < order.length - 1) { await tapDeal(page); await page.waitForTimeout(80); }
  }
  await tapDeal(page);
  await page.locator('.pk-results:not([hidden])').waitFor({timeout: 5000});
  assert.equal(await page.evaluate(() => document.querySelector('div.pk-open').dataset.tier), '', 'the ground is plain again on the results');
  await snap(page, 'results');
  await page.locator('[data-dy-next]').click();
  await page.waitForFunction(() => window.__closed, null, {timeout: 5000});
}
async function skipPass(page, order) {
  for (let i = 0; i < order.length; i++) {
    const R = order[i], T = `tier ${R.tier} (${R.name})`;
    await page.waitForTimeout(60);
    const s0 = await dealState(page);
    assert.match(s0.cls, new RegExp(`\\bt-${R.tier}\\b`), T + ': in order');
    if (R.tier >= 1) {
      await tapDeal(page); await page.waitForTimeout(60);
      const s1 = await dealState(page);
      assert.equal(s1.done, true, T + ': a tap while it plays finishes it');
      assert.match(s1.cls, new RegExp(`\\bt-${R.tier}\\b`), T + ': the same card stays');
      assert.equal(s1.faceUp, true, T + ': face up at once');
      assert.equal(s1.live, 1, T + ': no second card');
    }
    await tapDeal(page); await page.waitForTimeout(80);
    if (i < order.length - 1) assert.match((await dealState(page)).cls, new RegExp(`\\bt-${order[i + 1].tier}\\b`), T + ': the next tap moves on');
  }
  await page.locator('.pk-results:not([hidden])').waitFor({timeout: 5000});
  await page.locator('[data-dy-next]').click();
  await page.waitForFunction(() => window.__closed, null, {timeout: 5000});
}
/** After a Rare's flip (0.7 s) a tap must move on, not finish a reveal that's over (the dead tap). */
async function deadTapPass(page, order) {
  const i = order.findIndex(r => r.tier === 1);
  for (let k = 0; k < i; k++) { await page.waitForTimeout(60); await tapDeal(page); await page.waitForTimeout(80); }
  await page.waitForTimeout(order[i].hold + order[i].flip + 250);
  await tapDeal(page); await page.waitForTimeout(80);
  assert.match((await dealState(page)).cls, new RegExp(`\\bt-${order[i + 1].tier}\\b`), 'a tap after a Rare’s flip moves on');
  await page.locator('[data-dy-skip]').click();
  await page.locator('.pk-results:not([hidden])').waitFor({timeout: 5000});
  await page.locator('[data-dy-next]').click();
  await page.waitForFunction(() => window.__closed, null, {timeout: 5000});
}
async function reducedPass(page, order) {
  for (let i = 0; i < order.length; i++) {
    const R = order[i], T = `tier ${R.tier} (${R.name}, reduced motion)`;
    await page.waitForTimeout(60);
    const s = await dealState(page);
    assert.match(s.cls, new RegExp(`\\bt-${R.tier}\\b`), T + ': in order');
    assert.equal(s.faceUp, true, T + ': face up at once');
    assert.equal(s.backShown, false, T + ': no back');
    assert.equal(s.tag, R.label, T + ': its stamp still');
    if (R.tier === 6) await snap(page, 'reduced-t6');
    await tapDeal(page); await page.waitForTimeout(60);
  }
  await page.locator('.pk-results:not([hidden])').waitFor({timeout: 5000});
  await page.locator('[data-dy-next]').click();
  await page.waitForFunction(() => window.__closed, null, {timeout: 5000});
}

async function run(url) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const pass of ['timed', 'skip', 'deadtap', 'reduced']) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: pass === 'reduced' ? 'reduce' : 'no-preference'});
      await context.addInitScript(() => {
        localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); localStorage.setItem('gg-release-3.0:evan', '1');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e));
      // (Chrome's own notice when a scripted step haptics before any tap isn't the app's)
      page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Local test writes must remain disabled');
      await page.evaluate(async () => { const app = await import('/js/app.js'); await app.nav('/puzzles/dynasty'); });
      await page.locator('.pk').waitFor({timeout: 15000});
      const order = await openAll(page);
      assert.deepEqual(order.map(r => r.tier).slice().sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6], 'one card of every tier');
      await rip(page);
      if (pass === 'timed') await timedPass(page, order);
      else if (pass === 'skip') await skipPass(page, order);
      else if (pass === 'deadtap') await deadTapPass(page, order);
      else await reducedPass(page, order);
      assert.deepEqual(errors, [], pass + ': unexpected browser exceptions');
      console.log(`${pass}: ${order.map(r => `${r.tier} ${r.name}`).join(' → ')}`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('PASS: Gridiron Dynasty reveals by rarity');
}

(async () => {
  const s = await server();
  try { await run(`http://127.0.0.1:${s.address().port}`); }
  finally { await new Promise(resolve => s.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
