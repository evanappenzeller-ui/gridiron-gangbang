// Live Rivals battles in two real browsers (Evan's phone and Jayton's), joined by a stand-in board: each phone's
// daily.LB.put lands in this script's copy of the players collection, which goes back to both phones as their board.
// Firebase is removed from the served HTML and external requests are blocked: no production reads or writes.
// Covers presence (green dot), a challenge waiting out a Return Man run, the notice, accepting, both phones opening
// the battle, the same game on both phones move by move, the pause while one manager is away, and claiming the win.
// Usage: node tools/dynasty/check-live.cjs [--shots=dir]   (CHROMIUM_PATH: a Chrome/Chromium binary)
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg'};
const shots = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});
function serve() {
  const server = http.createServer((req, res) => {
    let file;
    try { const u = new URL(req.url, 'http://127.0.0.1'); file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); res.end(bytes);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, what, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw Error('Timed out: ' + what); await wait(100); }
}

(async () => {
  const server = await serve(), url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  const docs = {}, pages = {}, errors = [];
  const board = () => Object.entries(docs).map(([id, d]) => ({id, ...JSON.parse(JSON.stringify(d))}));
  async function deliver() {
    const all = board();
    await Promise.all(Object.values(pages).map(p => p.evaluate(async all => {
      const daily = await import('/js/core/daily.js'), L = await import('/js/core/rivals-live.js');
      daily.LB.all = all; L.refresh();
    }, all).catch(() => {})));
  }
  async function phone(uid, member) {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await ctx.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
    await ctx.addInitScript(member => {
      localStorage.setItem('gg-me', member); localStorage.setItem('gg-welcome', '1'); sessionStorage.setItem('gg-skip-title', '1');
      [member, 'evan', 'jayton'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      localStorage.setItem(`gg-rivals-music:m_${member}:v1`, JSON.stringify({on: false, level: 0}));
      localStorage.setItem(`gg-rivals-sfx:m_${member}:v1`, JSON.stringify({on: false, level: 0}));
    }, member);
    await ctx.exposeBinding('__rlvPut', (_src, body, fields) => {
      const d = docs[uid] || (docs[uid] = {nick: member, total: 0});
      for (const f of fields) d[f] = body[f] === undefined ? null : JSON.parse(JSON.stringify(body[f]));
      setTimeout(deliver, 30);
      return true;
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${member}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(`${member}: ${m.text()}`); });
    await page.goto(url + '/#/puzzles');
    // (the board turns itself off without Firebase; then this script's board stands in)
    await page.waitForFunction(async () => (await import('/js/core/daily.js')).LB.ready, null, {timeout: 20000});
    await page.evaluate(async uid => {
      const daily = await import('/js/core/daily.js'), D = await import('/js/core/dynasty.js');
      // (held: the app's own board start may still turn it off a moment later)
      for (const [k, v] of Object.entries({off: false, ready: true, synced: true, uid, put: (body, fields) => window.__rlvPut(body, fields)})) Object.defineProperty(daily.LB, k, {configurable: true, get: () => v, set: () => {}});
      daily.LB.all = [];
      await D.load(); D.finishTutorial('skipped', (await import('/js/core/realm-active.js')).profileKey());
    }, uid);
    pages[uid] = page;
    return page;
  }
  try {
    const A = await phone('phoneA', 'evan'), B = await phone('phoneB', 'jayton');
    // (Evan's tablet, open and idle: his battle must still be read from the phone that holds it)
    await phone('tabletA', 'evan');
    await deliver();
    await until(() => docs.phoneA?.rlv?.k === 'm_evan' && docs.phoneB?.rlv?.k === 'm_jayton' && docs.tabletA?.rlv?.k === 'm_evan', 'every device publishes its presence').catch(async e => {
      console.log(JSON.stringify(docs), errors, await A.evaluate(async () => { const L = await import('/js/core/rivals-live.js'), daily = await import('/js/core/daily.js'), r = await import('/js/core/realm-active.js'); return {key: r.profileKey(), enabled: L.enabled(), my: L.myKey(), lb: {ready: daily.LB.ready, synced: daily.LB.synced, off: daily.LB.off, uid: daily.LB.uid, put: !!daily.LB.put}}; }));
      throw e;
    });
    assert.equal(docs.phoneA.rlv.on, 1, 'an open app is on');

    // The lobby: Jayton in the app, with a green dot.
    await A.evaluate(() => { location.hash = '#/puzzles/dynasty'; });
    await A.locator('[data-dy-start], [data-dy-live]').first().waitFor({timeout: 20000});
    if (await A.locator('[data-dy-start]').count()) { await A.locator('[data-dy-start]').click(); await A.locator('[data-dy-start]').waitFor({state: 'detached', timeout: 10000}); }
    await A.locator('[data-dy-live]').first().waitFor({timeout: 20000});
    assert.match(await A.locator('[data-dy-live]').first().innerText(), /1 manager in the app now/);
    await A.locator('[data-dy-live]').first().click();
    const row = A.locator('.rlv-row', {hasText: 'Jayton'});
    await row.waitFor();
    assert.equal(await row.locator('.rlv-dot.is-on').count(), 1, 'Jayton shows a green dot');
    const offline = A.locator('.rlv-row', {hasText: /Ryan/}).first();
    assert.equal(await offline.locator('.rlv-dot.is-off').count(), 1, 'a manager not in the app shows grey');
    assert(await offline.locator('[data-lv-challenge]').isDisabled(), 'someone not in the app cannot be challenged');
    if (shots) { await wait(800); await A.screenshot({path: path.join(shots, 'lobby.png')}); }

    // Jayton is on a Return Man run (the real Return Man screen, its run state set directly): the challenge waits.
    await B.evaluate(() => { location.hash = '#/puzzles/return'; });
    await B.waitForFunction(() => document.querySelector('[data-rm-cv]')?.__rm, null, {timeout: 20000});
    assert.equal(await B.evaluate(async () => (await import('/js/core/busy.js')).busy()), '', 'Return Man before Play is not busy');
    await B.evaluate(() => { document.querySelector('[data-rm-cv]').__rm.mode = 'run'; });
    assert.equal(await B.evaluate(async () => (await import('/js/core/busy.js')).busy()), 'rm', 'a Return Man run is busy');
    await until(() => docs.phoneB.rlv.b === 'rm', 'the run shows as busy', 8000);
    await row.locator('.rlv-copy small.is-busy').waitFor();
    assert.match(await row.innerText(), /Playing Return Man/);
    await row.locator('[data-lv-challenge]').click();
    await until(() => docs.phoneA.rlv.i?.to === 'm_jayton', 'the challenge is posted');
    assert.match(await row.innerText(), /when their Return Man run ends/);
    await wait(3500);
    assert.equal(await B.locator('.rlv-notice').count(), 0, 'no notice during the run');

    // The run ends (tackled): the notice drops in over the Return Man screen.
    await B.evaluate(() => { document.querySelector('[data-rm-cv]').__rm.mode = 'tackled'; });
    await B.locator('.rlv-notice.is-in').waitFor({timeout: 8000});
    assert.match(await B.locator('.rlv-notice').innerText(), /Evan challenged you/);
    if (shots) await B.screenshot({path: path.join(shots, 'notice.png')});
    await B.locator('.rlv-notice [data-lv-accept]').click();

    // Both phones open the same battle.
    const id = docs.phoneA.rlv.i?.id || docs.phoneB.rlv.m.id;
    await until(() => docs.phoneA.rlv.m?.id === id && docs.phoneB.rlv.m?.id === id, 'both sides of the battle are up');
    for (const p of [A, B]) {
      await p.waitForFunction(id => location.hash.endsWith('/dynasty/battle/' + id), id, {timeout: 15000});
      await p.locator('.rp-arena').waitFor({timeout: 20000});
    }
    if (shots) await A.screenshot({path: path.join(shots, 'battle-a.png')});
    const view = p => p.evaluate(async id => { const M = await import('/js/core/rivals-live-match.js'); const x = M.get(id); return x && {state: x.state, you: x.you, away: x.away, result: x.result, G: x.G && {phase: x.G.phase, turn: x.G.turn, who: x.G.who, points: x.G.p.map(s => s.points), hands: x.G.p.map(s => s.hand.length), events: x.G.events.length, active: x.G.p.map(s => s.active && s.active.id)}}; }, id);
    const play = p => p.evaluate(async id => {
      const M = await import('/js/core/rivals-live-match.js'), B = await import('/js/core/dynasty-pocket.js');
      const x = M.get(id); if (!x || !['setup', 'yours'].includes(x.state)) return null;
      const m = B.nextMove(x.G, x.you, 15) || {a: 'end'};
      return {m, r: M.move(id, m)};
    }, id);
    // Both lineups first (either order), then the turns, until both phones agree on two dozen moves.
    let moves = 0;
    for (let guard = 0; moves < 24 && guard < 400; guard++) {
      let moved = false;
      for (const p of [B, A]) { const r = await play(p); if (r) { assert(r.r.ok, 'a legal move goes through: ' + JSON.stringify(r)); moves++; moved = true; await wait(80); } }
      if (!moved) await wait(120);
      const [a, b] = [await view(A), await view(B)];
      if (a.state === 'over' || b.state === 'over') break;
    }
    await wait(400);
    const [va, vb] = [await view(A), await view(B)];
    assert(moves >= 10, 'the battle got going: ' + moves);
    assert.deepEqual({...va.G}, {...vb.G}, 'both phones show the same game');
    assert.notEqual(va.you, vb.you, 'one seat each');
    console.log(`ok - ${moves} moves, turn ${va.G.turn}, the same game on both phones`);

    // Jayton leaves the app: Evan's battle pauses and no move goes through.
    assert.notEqual(va.state, 'over', 'the battle is still on for the away checks');
    {
      await B.evaluate(() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'}); Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange')); });
      await until(() => docs.phoneB.rlv.on === 0, 'the away phone posts it is off');
      await A.locator('.rp-live-away').waitFor({timeout: 8000});
      assert.match(await A.locator('.rp-live-away').innerText(), /Jayton left the app/);
      assert.equal(await A.locator('[data-rp-live-claim]').count(), 0, 'no claim before two minutes');
      const blocked = await A.evaluate(async id => { const M = await import('/js/core/rivals-live-match.js'); return M.move(id, {a: 'end'}); }, id);
      assert.equal(blocked.ok, false, 'moves wait while the other manager is away');
      if (shots) await A.screenshot({path: path.join(shots, 'away.png')});
      // Back: the battle carries on.
      await B.evaluate(() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'}); Object.defineProperty(document, 'hidden', {configurable: true, get: () => false}); document.dispatchEvent(new Event('visibilitychange')); });
      await A.locator('.rp-live-away').waitFor({state: 'detached', timeout: 8000});
      // Gone two minutes: Evan may take the win.
      await B.evaluate(() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'}); Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange')); });
      await A.locator('.rp-live-away').waitFor({timeout: 8000});
      await A.evaluate(() => { const real = Date.now.bind(Date); Date.now = () => real() + 125000; });
      await A.locator('[data-rp-live-claim]').waitFor({timeout: 8000});
      await A.locator('[data-rp-live-claim]').click();
      await until(async () => (await view(A)).result === 'w', 'Evan takes the win');
      await until(async () => (await view(B)).result === 'l', 'Jayton sees the result');
      await until(() => docs.phoneA.rlv.b === '' && docs.phoneA.rlv.m.over === 1, 'the battle no longer keeps Evan busy');
      console.log('ok - away pause, return, claim after two minutes');
    }
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS: live Rivals battles');
  } finally {
    await browser.close(); server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
