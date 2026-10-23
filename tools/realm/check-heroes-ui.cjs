// Local-only end-to-end checks for the owner's Keep heroes. No production requests or saves.
// Usage: node tools/realm/check-heroes-ui.cjs [--url=http://127.0.0.1:4179]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../output');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};

async function localServer() {
  const s = http.createServer((req, res) => {
    let file;
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    } catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => {
      if (error) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      if (req.method === 'HEAD') res.end(); else res.end(bytes);
    });
  });
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  return s;
}

function playwright() {
  try { return require('playwright'); }
  catch (_) { return require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
}

async function isolatedPage(browser, url, profile) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  await context.route('**/*', route => {
    const target = new URL(route.request().url());
    return target.origin === new URL(url).origin || ['data:', 'blob:'].includes(target.protocol) ? route.continue() : route.abort();
  });
  await context.addInitScript(profile => {
    localStorage.setItem('gg-me', profile);
    localStorage.setItem('gg-welcome', '1');
    localStorage.setItem('gg-realm-seen', '1'); localStorage.setItem('gg-keepfall-lore-seen', '3');
    sessionStorage.setItem('gg-skip-title', '1');
  }, profile);
  const page = await context.newPage(), errors = [], artLoads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE\.WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (/\/img\/realm\/.+\.(webp|png|jpg)(\?|$)/.test(request.url())) artLoads.push(request.url()); });
  await page.goto(url + '/#/puzzles');
  await page.waitForFunction(() => window.__ggBooted);
  assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Checks cannot write remote saves');
  return {context, page, errors, artLoads};
}

async function readyVillage(page) {
  await page.waitForSelector('.rl-home canvas');
  await page.waitForFunction(() => !document.querySelector('.rl-home .rl-loading'));
}

async function closeSheet(page) {
  await page.locator('.sh-rl [data-sheet-close]').click();
  await page.waitForSelector('.sh-rl', {state: 'detached'});
}

async function residentChecks(page) {
  const result = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), T = await import('/js/vendor/three/three.module.min.js');
    const {createHomeNPCs} = await import('/js/views/realm-npcs.js');
    const scene = new T.Scene(), residents = createHomeNPCs(T, scene), s = F.fresh();
    const counts = () => ({...residents.counts});
    residents.setLot(s); residents.update(0, {zoom: 50});
    const starter = counts();
    const guards = () => residents.group.children.filter(x => x.userData.npc === 'guard');
    const startPositions = guards().map(g => [g.position.x, g.position.z]);
    residents.update(9, {zoom: 50});
    const moved = guards().some((g, i) => Math.hypot(g.position.x - startPositions[i][0], g.position.z - startPositions[i][1]) > .1);
    let clearPaths = true;
    for (let t = 0; t <= 120; t += .25) {
      residents.update(t, {zoom: 50});
      for (const g of guards()) {
        const x = g.position.x + F.N / 2, y = g.position.z + F.N / 2;
        if (s.b.some(b => x >= b.x && x < b.x + F.KINDS[b.t].size && y >= b.y && y < b.y + F.KINDS[b.t].size)) clearPaths = false;
      }
    }
    // (Castle 4: the Dragon Hatchery unlocks there from Oct 22 2026, was 6; a stale Wizard on the roster draws nothing)
    s.b.find(b => b.t === 'keep').l = 4;
    s.hr = {knight: 2, wizard: 2};
    residents.setLot(s); residents.update(0, {zoom: 50});
    const unlocked = counts(), keeper = () => residents.group.children.find(x => x.userData.npc === 'keeper');
    const waiting = keeper().position.clone();
    const p = F.spotFor(s, 'hatchery');
    s.b.push({i: s.nb++, t: 'hatchery', l: 1, x: p.x, y: p.y, u: 0, c: Date.now()});
    residents.setLot(s); residents.update(0, {zoom: 50});
    const keeperMoved = keeper().position.distanceTo(waiting) > 1;
    const positions = () => residents.group.children.map(x => [x.position.x, x.position.z]);
    const beforeHidden = positions();
    const inactive = residents.update(70, {zoom: 50, active: false});
    const hidden = !residents.group.visible && !inactive && JSON.stringify(positions()) === JSON.stringify(beforeHidden);
    const distant = !residents.update(70, {zoom: 180}) && !residents.group.visible;
    const placement = !residents.update(70, {zoom: 50, placement: true}) && !residents.group.visible;
    residents.update(0, {zoom: 50});
    window.__residentCheck = {residents, scene, s, positions};
    return {starter, unlocked, moved, clearPaths, keeperMoved, hidden, distant, placement};
  });
  assert.equal(result.starter.guards, 2, 'A starter Keep has two patrolling guards');
  assert.equal(result.starter.heroes, 0, 'Unrecruited heroes do not appear in the village');
  assert.equal(result.starter.keeper, false, 'Dragon keeper is absent before the hatchery unlock');
  assert(result.moved && result.clearPaths, 'Guards move for two simulated minutes without entering building footprints');
  assert.equal(result.unlocked.heroes, 1, 'The recruited Knight Hero appears in the village; no Wizard (retired Oct 22 2026)');
  assert.equal(result.unlocked.keeper, true, 'Dragon keeper arrives when Castle 4 unlocks the hatchery');
  assert(result.keeperMoved, 'Dragon keeper moves from the Keep to the completed hatchery');
  assert(result.hidden && result.distant && result.placement, 'Inactive, distant and building-placement views hide and pause residents');
  await page.emulateMedia({reducedMotion: 'reduce'});
  const reduced = await page.evaluate(() => {
    const t = window.__residentCheck;
    const a = t.residents.update(0, {zoom: 50}), before = JSON.stringify(t.positions());
    const b = t.residents.update(100, {zoom: 50});
    return !a && !b && before === JSON.stringify(t.positions());
  });
  assert(reduced, 'Reduced motion leaves residents stationary without requesting animation');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const cleanup = await page.evaluate(async () => {
    const t = window.__residentCheck, data = await import('/js/core/data.js');
    data.setMe('mason');
    const removed = !t.residents.group.children.length && !t.residents.group.visible;
    t.residents.setLot(t.s); const blocked = !t.residents.group.children.length;
    t.residents.dispose(); const detached = !t.scene.children.length;
    data.setMe('evan'); delete window.__residentCheck;
    return {removed, blocked, detached};
  });
  assert.deepEqual(cleanup, {removed: true, blocked: true, detached: true}, 'Owner loss clears residents, blocks re-creation and disposes their group');
  console.log('PASS: guards patrol clear paths; hero residents (no Wizard), Castle 4 dragon keeper arrival/relocation, hidden/placement/reduced motion and owner cleanup');
}

async function ownerChecks(test, url) {
  const {page, context, errors} = test;
  await page.evaluate(async () => {
    const F = await import('/js/core/realm.js');
    // (a realm of today's, not one from before the testing reset (TEST_RESET), which a reload would start over; not a testing one either: Gold is spent)
    F._set(Object.assign(F.fresh(), {rs: F.TEST_RESET}));
    await (await import('/js/app.js')).nav('/realm');
  });
  await readyVillage(page);
  await page.locator('[data-rl-army]').first().click();
  assert.equal(await page.locator('[data-rl-hero-card]').count(), 2, 'Both named heroes appear in Army');
  assert.match(await page.locator('[data-rl-hero-card="knight"]').innerText(), /Castle\s*(level\s*)?4/i, 'Knight unlock is explained (Castle 4 from Oct 22 2026)');
  assert.match(await page.locator('[data-rl-hero-card="dragon"]').innerText(), /Build a Dragon Hatchery \(Castle level 4\)/i, 'Dragon unlock is explained (his hatchery, Castle 4)');
  assert.equal(await page.locator('[data-rl-hero-card="wizard"]').count(), 0, 'no Wizard Hero');
  await page.screenshot({path: path.join(output, 'realm-heroes-locked-390.png')});
  await closeSheet(page);

  await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), s = F.mine();
    s.b.find(b => b.t === 'keep').l = 8;
    s.r = {gold: 160000, grain: 10000};
    s.ar = {};
    F.touch();
  });
  await page.locator('[data-rl-army]').first().click();
  const before = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), s = F.mine();
    return {gold: s.r.gold, grain: s.r.grain, costs: F.HERO_ORDER.map(k => F.canRecruitHero(s, k).cost)};
  });
  assert.equal(await page.locator('[data-rl-recruit-hero="dragon"], [data-rl-upgrade-hero="dragon"]').count(), 0, 'no Gold button for the Dragon Hero');
  for (const hero of ['knight']) {
    await page.locator(`[data-rl-recruit-hero="${hero}"]`).click();
    await page.waitForFunction(async hero => {
      const F = await import('/js/core/realm.js'); return F.heroLevel(F.mine(), hero) === 1;
    }, hero);
  }
  const recruited = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), s = F.mine();
    return {levels: F.heroLevels(s), gold: s.r.gold, grain: s.r.grain, costs: F.HERO_ORDER.map(k => F.canUpgradeHero(s, k).cost)};
  });
  assert.deepEqual(recruited.levels, {knight: 1}, 'Recruiting creates the persistent Knight Hero');
  assert.equal(before.gold - recruited.gold, before.costs.reduce((a, b) => a + b, 0), 'Recruiting spends the displayed Gold costs once');
  assert.equal(recruited.grain, before.grain, 'Hero recruitment leaves Ale (grain) unchanged');
  for (const hero of ['knight']) {
    await page.locator(`[data-rl-upgrade-hero="${hero}"]`).click();
    await page.waitForFunction(async hero => {
      const F = await import('/js/core/realm.js'); return F.heroLevel(F.mine(), hero) === 2;
    }, hero);
  }
  // (the Dragon Hero: a Dragon Hatchery built (level 2 here) hatches him at its level, Gold untouched)
  const hatchGold = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), s = F.mine(), p = F.spotFor(s, 'hatchery');
    s.b.push({i: s.nb++, t: 'hatchery', l: 2, x: p.x, y: p.y, u: 0}); F.touch();
    return s.r.gold;
  });
  await page.waitForFunction(() => /Hatched at your Dragon Hatchery · level 2/.test(document.querySelector('[data-rl-hero-card="dragon"]')?.textContent || ''));
  const upgraded = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), s = F.mine();
    return {levels: F.heroLevels(s), gold: s.r.gold, army: s.ar};
  });
  assert.equal(upgraded.gold, hatchGold, 'the Dragon Hero costs no Gold');
  assert.deepEqual(upgraded.levels, {knight: 2, dragon: 2}, 'The Knight levels up with Gold; the Dragon has his hatchery’s level');
  assert.equal(recruited.gold - upgraded.gold, recruited.costs.reduce((a, b) => a + b, 0), 'Leveling spends each displayed cost once');
  assert.deepEqual(upgraded.army, {}, 'Heroes do not create expendable army troops');
  await page.locator('[data-rl-upgrade-hero="knight"]').focus();
  await page.evaluate(async () => { const F = await import('/js/core/realm.js'); F.mine().r.grain--; F.touch(); });
  await page.waitForFunction(() => /Ale 9,999/.test(document.querySelector('[data-rl-armybody]').textContent));
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.rlUpgradeHero), 'knight', 'Army auto-refresh preserves keyboard focus on a hero action');
  await page.screenshot({path: path.join(output, 'realm-heroes-army-390.png')});
  await page.setViewportSize({width: 320, height: 740});
  const fit = await page.locator('[data-rl-hero-card]').evaluateAll(cards => cards.every(card => {
    const bounds = card.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth + 1 && card.scrollWidth <= card.clientWidth + 1;
  }));
  assert(fit, 'Both hero cards fit a 320px mobile viewport');
  await page.screenshot({path: path.join(output, 'realm-heroes-army-320.png')});
  await closeSheet(page);
  await page.reload();
  await page.waitForFunction(() => window.__ggBooted);
  await readyVillage(page);
  const persisted = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), s = F.mine();
    return {levels: F.heroLevels(s), gold: s.r.gold};
  });
  assert.deepEqual(persisted, {levels: upgraded.levels, gold: upgraded.gold}, 'Heroes, upgrades and spent Gold survive a real reload');
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: path.join(output, 'realm-heroes-village-390.png')});
  console.log('PASS: real UI recruitment, exact Gold spending, both upgrades, 320px cards and reload persistence');

  await page.locator('[data-rl-raid]').click();
  assert.equal(await page.locator('[data-rl-go="bot:1"]').isEnabled(), true, 'Heroes alone enable Attack from the target list');
  await page.locator('[data-rl-scout="bot:1"]').click();
  await page.waitForSelector('[data-rls-attack]');
  assert.equal(await page.locator('[data-rls-attack]').isEnabled(), true, 'Heroes alone enable Attack from scouting');
  await page.locator('[data-rls-attack]').click();
  await page.waitForFunction(() => document.querySelector('.rlr')?.__rl?.v && document.querySelector('.rlr')?.__rl?.B);
  assert.equal(await page.locator('[data-rlr-pick="hero_knight"]').count(), 1, 'Knight is in the raid deployment tray');
  assert.equal(await page.locator('[data-rlr-pick="hero_dragon"]').count(), 1, 'Dragon Hero is in the raid deployment tray');
  assert.equal(await page.locator('[data-rlr-pick="hero_wizard"], [data-rlr-pick="dragon"]').count(), 0, 'no Wizard Hero or trained dragon in it');
  const dropPoint = await page.evaluate(() => {
    const st = document.querySelector('.rlr').__rl, rect = st.v.canvas.getBoundingClientRect(), options = [];
    for (let y = 1.5; y < 43; y++) for (let x = 1.5; x < 43; x++) {
      if (!st.B.canDrop(x, y)) continue;
      const p = st.v.project(x, y), sx = rect.left + p.x, sy = rect.top + p.y;
      if (sx > 20 && sx < innerWidth - 20 && sy > 180 && sy < innerHeight - 180) options.push({x: sx, y: sy, d: Math.abs(sx - innerWidth / 2) + Math.abs(sy - innerHeight / 2)});
    }
    return options.sort((a, b) => a.d - b.d)[0];
  });
  assert(dropPoint, 'A legal visible deployment tile is available');
  for (const hero of ['knight', 'dragon']) {
    await page.locator(`[data-rlr-pick="hero_${hero}"]`).click();
    await page.mouse.click(dropPoint.x, dropPoint.y);
    await page.waitForFunction(hero => document.querySelector('.rlr').__rl.B.used['hero_' + hero] === 1, hero);
  }
  const battle = await page.evaluate(() => {
    const B = document.querySelector('.rlr').__rl.B;
    return {used: B.used, units: B.tr.map(t => ({t: t.t, max: t.max})), levels: B.result().heroes};
  });
  assert.equal(battle.used.hero_knight, 1, 'A real canvas tap deploys the Knight exactly once');
  assert.equal(battle.used.hero_dragon, 1, 'A real canvas tap deploys the Dragon Hero exactly once');
  assert.deepEqual(battle.levels, {knight: 2, dragon: 2}, 'Raid keeps the heroes’ levels');
  await page.screenshot({path: path.join(output, 'realm-heroes-raid-390.png')});
  await page.locator('[data-rlr-quit]').click();
  await page.waitForSelector('[data-rlr-home]');
  await page.locator('[data-rlr-home]').click();
  await readyVillage(page);
  assert.deepEqual(await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'); return F.heroLevels(F.mine());
  }), upgraded.levels, 'Finishing a raid retains both persistent heroes and levels');
  console.log('PASS: heroes alone enter raids through target/scout controls, deploy through actual canvas taps, and return after battle');

  await page.locator('[data-rl-army]').first().click();
  await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
  await page.waitForFunction(() => !document.querySelector('.rl-home canvas, .sh-rl, .rlr') && !document.documentElement.classList.contains('is-realm-playing'));
  assert.equal(await page.locator('[data-rl-hero-card]').count(), 0, 'Owner hero controls disappear on profile change');
  await page.evaluate(async () => {
    (await import('/js/core/data.js')).setMe('evan');
    await (await import('/js/app.js')).nav('/realm');
  });
  await readyVillage(page);
  await page.locator('[data-rl-army]').first().click();
  const second = await context.newPage();
  await second.goto(url + '/data/league.json');
  await second.evaluate(() => localStorage.setItem('gg-me', 'none'));
  await page.waitForFunction(() => !document.querySelector('.rl-home canvas, .sh-rl, .rlr') && !document.documentElement.classList.contains('is-realm-playing'));
  await second.close();
  assert.deepEqual(errors, [], 'Owner UI, battles and profile changes have no browser exceptions');
  console.log('PASS: same-tab and cross-tab profile changes clear the hero sheet and owner scene');
}

async function nonOwnerChecks(test, profile) {
  const {page, errors, artLoads} = test;
  await page.evaluate(async () => (await import('/js/app.js')).nav('/realm'));
  const denied = await page.evaluate(async () => {
    const F = await import('/js/core/realm.js'), s = F.fresh();
    s.b.find(b => b.t === 'keep').l = 8; s.r.gold = 160000;
    const before = JSON.stringify(s), recruit = F.recruitHero(s, 'knight');
    const recruitmentUnchanged = JSON.stringify(s) === before;
    s.hr = {knight: 1, dragon: 5};
    const ownedBefore = JSON.stringify(s), upgrade = F.upgradeHero(s, 'knight') || F.upgradeHero(s, 'dragon');
    return {recruit, recruitmentUnchanged, upgrade, upgradeUnchanged: JSON.stringify(s) === ownedBefore};
  });
  assert.deepEqual(denied, {recruit: false, recruitmentUnchanged: true, upgrade: false, upgradeUnchanged: true}, profile + ': direct hero mutations are denied');
  assert.equal(await page.locator('.rl-home, .rlr, [data-rl-hero-card]').count(), 0, profile + ': no hero or Keep UI mounts');
  assert.deepEqual(artLoads, [], profile + ': no owner artwork is requested');
  assert.deepEqual(errors, [], profile + ': no browser exceptions');
  console.log('PASS: ' + profile + ' cannot mount hero UI, load artwork or change hero state');
}

async function run(url) {
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname), 'Only loopback test URLs are allowed');
  fs.mkdirSync(output, {recursive: true});
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    for (const profile of ['evan', 'mason', 'none']) {
      const test = await isolatedPage(browser, url, profile);
      try { if (profile === 'evan') { await residentChecks(test.page); await ownerChecks(test, url); } else await nonOwnerChecks(test, profile); }
      catch (error) { await test.page.screenshot({path: path.join(output, 'realm-heroes-failure.png')}); throw error; }
      finally { await test.context.close(); }
    }
  } finally { await browser.close(); }
}

(async () => {
  const existing = process.argv.find(arg => arg.startsWith('--url='));
  const server = existing ? null : await localServer();
  try { await run(existing ? existing.slice(6).replace(/\/$/, '') : `http://127.0.0.1:${server.address().port}`); }
  finally { if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
