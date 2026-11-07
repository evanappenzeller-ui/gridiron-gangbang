// Real-browser check of the v7 table motion and sound cues (Nov 7 2026): turn flip, Energy Zone refill, Energy drag
// and tap, attach, cards entering play, draws, attacks, knockouts and points. Offline: Firebase is stripped from the
// served HTML and every external request is blocked. Animations never change the saved match.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const shots = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
function serve() {
  const server = http.createServer((req, res) => {
    let file;
    try { const u = new URL(req.url, 'http://127.0.0.1'); file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}).end(bytes);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
const match = page => page.evaluate(async () => { const x = (await import('/js/core/dynasty-solo.js')).get(window.testMid); return {state: x.state, G: x.G}; });
// Idle: no scene, no moving piece and no held value left on the table.
const quiet = () => !document.querySelector('.rp-cinema,.rp-fx-turn,.rp-fx-card,.rp-fx-energy,.rp-fx-stamp,.rp-fx-final,.rp-fx-ghost,.rp-battle .is-pending,.rp-battle .is-masked');
async function settle(page, {skip = true} = {}) {
  let still = 0;
  for (let i = 0; i < 900; i++) {
    if (skip) { const s = page.locator('[data-rp-skip]'); if (await s.count()) await s.first().click().catch(() => {}); }
    const x = await match(page);
    if (x.state !== 'theirs' && await page.evaluate(quiet)) { if (++still >= 3) return x; } else still = 0;
    await page.waitForTimeout(100);
  }
  throw Error('table motion did not settle');
}
async function center(page, selector) { const b = await page.locator(selector).first().boundingBox(); assert(b, selector + ' exists'); return {x: b.x + b.width / 2, y: b.y + b.height / 2}; }
async function dragMouse(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps); await page.waitForTimeout(16); }
}
async function run(url) {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
  try {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
    await ctx.route('**/*', r => new URL(r.request().url()).origin === url ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      localStorage.setItem('gg-me', 'evan'); localStorage.setItem('gg-welcome', '1'); sessionStorage.setItem('gg-skip-title', '1');
      ['evan', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      localStorage.setItem('gg-rivals-music:m_evan:v1', JSON.stringify({on: false, level: 0}));
      window.__rpCues = []; window.__fxSeen = new Set();
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.parentElement?.matches('.rp-fx')) window.__fxSeen.add(n.className); })))
        .observe(document, {subtree: true, childList: true});
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e.stack || e)));
    await page.goto(url + '/#/puzzles'); await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
    assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'production writes disabled');
    // A naturally dealt match where the computer goes first, so both turn flips and both Energy Zones play.
    const start = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), S = await import('/js/core/dynasty-solo.js');
      await D.load(); const sel = D.usePocketDeck('rental'); if (!sel.ok) throw Error(sel.why);
      let r; for (let i = 0; i < 40; i++) { r = S.start('g1'); if (!r.ok) throw Error(r.why); if (S.get(r.mid).G.first === 1) break; }
      window.testMid = r.mid; await (await import('/js/app.js')).nav('/puzzles/dynasty/battle/' + r.mid);
      return {first: S.get(r.mid).G.first, hand: S.get(r.mid).G.p[0].hand};
    });
    assert.equal(start.first, 1, 'fixture: the computer opens');
    await page.waitForSelector('.rp-hand .rp-card');
    assert.equal(await page.locator('.rp-fx').count(), 1, 'one motion layer');
    assert.equal(await page.locator('.rp-fx > *').count(), 0, 'opening a battle replays nothing');
    // The deck is not a control: tapping it opens nothing and draws nothing.
    for (const side of ['is-mine', 'is-opponent']) assert.equal(await page.locator('.rp-deck.' + side).evaluate(el => getComputedStyle(el).pointerEvents), 'none', side + ' deck ignores taps');
    const deckTap = await center(page, '.rp-deck.is-mine'), beforeDeck = JSON.stringify((await match(page)).G);
    await page.mouse.click(deckTap.x, deckTap.y); await page.waitForTimeout(120);
    assert.equal(JSON.stringify((await match(page)).G), beforeDeck, 'tapping the deck never draws');
    assert.equal(await page.locator('.sheet').count(), 0, 'tapping the deck opens nothing');

    // Opening lineup: choose through the real card sheet, then confirm.
    const bases = await page.evaluate(async () => { const C = await import('/js/core/dynasty-pocket-cards.js'), S = await import('/js/core/dynasty-solo.js'); return S.get(window.testMid).G.p[0].hand.map((id, i) => C.card(id)?.stage === 'Base' ? i : -1).filter(i => i >= 0); });
    assert(bases.length, 'an opening Base');
    await page.locator(`.rp-hand [data-rp-hand="${bases[0]}"]`).click(); await page.locator('[data-rp-place="active"]').click();
    await page.waitForFunction(() => !document.querySelector('.sheet'));
    await page.locator('[data-rp-ready]').click();
    // The opponent's face-down lineup flips over, then the turn flips to the computer.
    await page.waitForSelector('.rp-fx-turn.is-theirs', {timeout: 8000});
    const held = (await match(page)).G.events.length;
    await page.waitForTimeout(400);
    assert.equal((await match(page)).G.events.length, held, 'the computer waits while its turn flip plays');
    assert(await page.locator('.rp-fx-turn.is-theirs').count(), 'turn flip is still showing');
    if (shots) await page.screenshot({path: path.join(shots, 'motion-turn-flip.png')});

    // Your turn: the flip, the draw from the deck and the Energy Zone refill play in order before the table is final.
    await page.waitForSelector('.rp-fx-turn.is-mine', {timeout: 60000});
    const masked = await page.evaluate(() => ({turn: document.querySelector('.rp-arena').dataset.turn, hand: document.querySelectorAll('.rp-hand > .is-pending').length,
      zone: document.querySelector('[data-rp-zone].is-mine').classList.contains('is-pending')}));
    assert.equal(masked.turn, 'theirs', 'the turn ball waits for the flip');
    assert.equal(masked.hand, 1, 'the drawn card waits in the deck until it is dealt');
    assert(masked.zone, 'the Energy Zone refills after the draw');
    await page.waitForSelector('.rp-fx-card', {timeout: 4000});
    if (shots) await page.screenshot({path: path.join(shots, 'motion-draw.png')});
    let x = await settle(page);
    assert.equal(x.state, 'yours');
    assert.equal(await page.locator('.rp-arena').getAttribute('data-turn'), 'mine', 'turn ball crossed to you');
    assert(await page.locator('[data-rp-zone].is-mine.is-ready .rp-energy').count(), 'your Energy is ready in its slot');

    // Drag the Energy onto your Active athlete: lift, highlight, ghost, then fly and attach.
    const active = String(x.G.p[0].active.u), enBefore = x.G.p[0].active.en.length;
    const from = await center(page, '[data-rp-energy]'), to = await center(page, `.rp-side.is-mine [data-rp-slot="${active}"]`);
    // An invalid drop (the opponent's Active) floats back without a move.
    await dragMouse(page, from, await center(page, '.rp-side.is-opponent [data-rp-slot]'));
    assert(await page.locator('.rp-energy-ghost').count(), 'dragging shows the Energy');
    assert.equal(await page.locator('.rp-side.is-opponent .is-energy-target').count(), 0, 'opposing athletes are never targets');
    await page.mouse.up(); await page.waitForTimeout(350);
    assert.equal(await page.locator('.rp-energy-ghost').count(), 0, 'a missed drop returns the Energy');
    assert.equal((await match(page)).G.p[0].active.en.length, enBefore, 'a missed drop attaches nothing');
    await dragMouse(page, from, to);
    assert(await page.locator(`.rp-side.is-mine [data-rp-slot="${active}"].is-energy-target.is-drop-hover`).count(), 'your athlete lights up under the Energy');
    if (shots) await page.screenshot({path: path.join(shots, 'motion-energy-drag.png')});
    await page.mouse.up();
    await page.waitForSelector('.rp-fx-energy', {timeout: 3000});
    x = await settle(page);
    assert.equal(x.G.p[0].active.en.length, enBefore + 1, 'the dropped Energy is attached by the rules engine');
    assert.equal(await page.locator(`.rp-side.is-mine [data-rp-slot="${active}"] .rp-card-energy .rp-energy`).count(), enBefore + 1, 'its pip shows on the card');
    for (const c of ['lift', 'drop', 'attach', 'whoosh', 'turn', 'deal', 'energy', 'flip']) assert(await page.evaluate(c => window.__rpCues.includes(c), c), 'cue ' + c);

    // Play on: bench Base cards from the hand, attach to the Active, attack; until a knockout and its points play.
    let knocked = false, attacked = false, placed = false;
    for (let turn = 0; turn < 40 && x.state !== 'over' && !(knocked && attacked && placed); turn++) {
      x = await settle(page);
      if (x.state === 'over') break;
      const legal = await page.evaluate(async () => { const B = await import('/js/core/dynasty-pocket.js'), S = await import('/js/core/dynasty-solo.js'), x = S.get(window.testMid); return B.legalActions(x.G, 0); });
      const promote = legal.find(m => m.a === 'promote' || m.a === 'choose-switch');
      if (promote) { await page.locator('[data-rp-choice]').first().click(); continue; }
      const bench = legal.find(m => m.a === 'bench');
      if (bench && !placed) {
        const i = x.G.p[0].hand.indexOf(bench.id), card = await center(page, `.rp-hand [data-rp-hand="${i}"]`);
        await dragMouse(page, card, await center(page, '.rp-side.is-mine .rp-bench'));
        await page.mouse.up(); await page.waitForTimeout(60);
        x = await settle(page); placed = x.G.p[0].bench.some(s => s.id === bench.id);
        assert(placed, 'dragging a Base to the Bench places it');
        assert(await page.evaluate(() => window.__rpCues.includes('place')), 'placing a card sounds');
        continue;
      }
      const energy = legal.find(m => m.a === 'energy' && m.on === x.G.p[0].active.u);
      if (energy) { await page.locator('[data-rp-energy]').click(); await page.locator(`.rp-side.is-mine [data-rp-slot="${energy.on}"]`).click(); continue; }
      const attack = legal.find(m => m.a === 'attack');
      if (attack) {
        await page.locator(`.rp-side.is-mine [data-rp-slot="${x.G.p[0].active.u}"]`).click();
        await page.locator('.rp-sheet [data-rp-move]').filter({hasText: /^Attack:/}).first().click();
        await page.waitForSelector('[data-rp-scene="attack"]');
        await page.locator('[data-rp-skip]').click();
        const dmg = (await match(page)).G.events.filter(e => e.k === 'attack' && e.who === 0).at(-1).damage;
        if (dmg) { await page.waitForSelector('.rp-fx-float.is-damage', {timeout: 3000}); assert.equal(await page.locator('.rp-fx-float.is-damage').first().innerText(), '-' + dmg, 'the hit shows the resolved damage'); }
        if (shots && !attacked) await page.screenshot({path: path.join(shots, 'motion-hit.png')});
        attacked = true;
        if (!knocked && await page.waitForSelector('.rp-fx-stamp', {timeout: 2600}).catch(() => null)) {
          knocked = true; await page.waitForTimeout(250);
          if (shots) await page.screenshot({path: path.join(shots, 'motion-knockout.png')});
          await page.waitForSelector('.rp-fx-float.is-point,.rp-fx-float.is-loss', {timeout: 3000});
          if (shots) await page.screenshot({path: path.join(shots, 'motion-point.png')});
        }
        continue;
      }
      await page.locator('[data-rp-end]').click();
      knocked = knocked || await page.evaluate(() => [...window.__fxSeen].some(c => c.includes('rp-fx-stamp')));
    }
    x = await settle(page);
    knocked = knocked || await page.evaluate(() => [...window.__fxSeen].some(c => c.includes('rp-fx-stamp')));
    assert(attacked, 'an attack played on the table'); assert(knocked, 'a knockout played on the table');
    const cues = await page.evaluate(() => window.__rpCues), seen = await page.evaluate(() => [...window.__fxSeen].join(' '));
    for (const c of ['knockout']) assert(cues.includes(c), 'cue ' + c);
    assert(cues.includes('point') || cues.includes('point-lose'), 'a point is won or lost with its cue');
    assert(cues.some(c => ['impact', 'heavy', 'miss'].includes(c)), 'the attack hit sounds');
    for (const fx of ['rp-fx-turn', 'rp-fx-card', 'rp-fx-energy', 'rp-fx-burst', 'rp-fx-stamp', 'rp-fx-ghost']) assert(seen.includes(fx), 'motion ' + fx);
    // After every scene the table shows exactly the saved match.
    const table = await page.evaluate(async () => {
      const x = (await import('/js/core/dynasty-solo.js')).get(window.testMid);
      return {hp: [...document.querySelectorAll('[data-rp-slot]')].every(el => el.querySelector('.rp-live-hp').textContent === el.dataset.rpHp),
        points: [...document.querySelectorAll('[data-rp-points]')].map(p => [p.querySelectorAll('.is-scored:not(.is-masked)').length, x.G.p[Number(p.dataset.rpPoints)].points]),
        deck: [...document.querySelectorAll('[data-rp-deck]')].map(d => [Number(d.querySelector('[data-count]').firstChild.nodeValue), x.G.p[Number(d.dataset.rpDeck)].deck.length]),
        offsets: [...document.querySelectorAll('[data-rp-slot]')].filter(el => el.style.translate).length};
    });
    assert(table.hp, 'HP numbers match the saved match'); assert.equal(table.offsets, 0, 'no athlete is left mid-slide');
    table.points.forEach(([a, b]) => assert.equal(a, b, 'point markers match')); table.deck.forEach(([a, b]) => assert.equal(a, b, 'deck counts match'));

    // An empty deck: the turn begins without a draw, the pile shakes and says so (presentation of a recorded turn).
    const empty = await page.evaluate(async () => {
      const P = await import('/js/views/dynasty-pocket-presentation.js'), S = await import('/js/core/dynasty-solo.js'), B = await import('/js/core/dynasty-pocket.js');
      const x = S.get(window.testMid), before = JSON.stringify(x.G), heard = [];
      const model = {phase: 'play', turnSide: 1, sides: x.G.p.map(p => ({slots: [p.active, ...p.bench].filter(Boolean).map(s => ({u: String(s.u), id: s.id, hp: B.hpOf(x.G, s) - s.dmg, en: s.en.length, active: s === p.active})), points: p.points, hand: p.hand.length, deck: p.deck.length}))};
      const P1 = P.attachPresentation(document.querySelector('.v-dynasty-battle'), {enabled: () => true, cancelHand() {}, sound: c => heard.push(c)});
      P1.enqueue([{k: 'turn', who: 0, turn: 99, energy: 'Fire'}], x, {prev: model, next: model, captured: {slots: {}}});
      for (let i = 0; i < 60 && P1.busy(); i++) await new Promise(r => setTimeout(r, 100));
      const busy = P1.busy(); P1.stop();
      return {heard, busy, same: before === JSON.stringify(S.get(window.testMid).G)};
    });
    assert(!empty.busy, 'the recorded turn finishes');
    assert.deepEqual(empty.heard.filter(c => ['whoosh', 'turn', 'empty', 'energy'].includes(c)), ['whoosh', 'turn', 'empty', 'energy'], 'flip, then empty deck, then Energy');
    assert(empty.same, 'presentation leaves the match unchanged');

    // Reload resumes the exact table without replaying anything.
    await page.reload(); await page.waitForSelector('.rp-arena');
    await page.waitForTimeout(600);
    x = await match(page);
    if (x.state !== 'theirs') assert.equal(await page.locator('.rp-fx > *').count(), 0, 'reload replays no motion');
    // Reduced motion: the table updates at once and one cue still plays.
    x = await settle(page);
    if (x.state === 'yours') {
      await page.emulateMedia({reducedMotion: 'reduce'});
      await page.evaluate(() => { window.__rpCues.length = 0; });
      await page.locator('[data-rp-end]').click(); await page.waitForTimeout(200);
      assert.equal(await page.locator('.rp-fx > *,.rp-cinema').count(), 0, 'reduced motion shows no motion');
      assert((await page.evaluate(() => window.__rpCues)).length >= 1, 'reduced motion still sounds the play');
    }
    assert.deepEqual(errors, [], 'no browser exceptions');
    console.log('PASS v7 motion: turn flips, Energy refill/drag/tap/attach, deals, placements, hits, knockouts, points, empty deck, inert deck, CPU pacing, exact final table, reload and reduced motion');
    await ctx.close();
  } finally { await browser.close(); }
}
serve().then(server => run(`http://127.0.0.1:${server.address().port}`).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close()));
