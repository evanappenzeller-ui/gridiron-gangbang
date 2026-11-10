// Rivals' title screen, play-first navigation and collection flows in a real browser.
// Local only: the app is served from this folder with Firebase disabled, so nothing reaches the live board.
// For Evan and Ryan Stewart (the Dynasty's two players, features.js dynastyOpen): entering shows the title screen over an
// inert shell, the cards drift in once they've loaded, a tap (and Enter) starts, four labeled tabs, the header's Menu and
// counters, the Packs stage (the clock pill, the tags, the round Open), the Play tab (Versus, Solo, Guide,
// Decks, Rankings, Missions), the Menu sheet and its Title screen item, back from a Solo battle without the title screen
// again, and every kit check in checks-dynasty.js. For a member who isn't theirs and a visitor: the link lands on the list.
// Usage: node tools/dynasty/check-start-browser.cjs [--shots=<dir>] [--packs-only | --pack-profiles-only]
// (Playwright's Chromium; --packs-only checks the shelf with normal/reduced motion and all four pack profiles.)
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
const packsOnly = process.argv.includes('--packs-only');
const packProfilesOnly = process.argv.includes('--pack-profiles-only');
if (shots) fs.mkdirSync(shots, {recursive: true});

function server() {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    // A sparse test worktree can read shared assets without linking directories into Git's checkout.
    if (process.env.RIVALS_ASSET_ROOT && !fs.existsSync(file) && ['img','fonts','icons'].includes(path.relative(root,file).split(path.sep)[0])) file = path.join(process.env.RIVALS_ASSET_ROOT,path.relative(root,file));
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      // (Firebase stays off: no live reads or writes from a test)
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(bytes);
    });
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(s)));
}
const PROFILES = [
  {tag: 'evan', me: 'evan', plays: true},
  {tag: 'ryan-stewart', me: 'none', guest: 'Ryan Stewart', plays: true},
  {tag: 'mason', me: 'mason', plays: true}, // (everyone's since Nov 10 2026)
  {tag: 'visitor', me: 'none', plays: false}
];
const snap = (page, name) => (shots ? page.screenshot({path: path.join(shots, name + '.png')}) : Promise.resolve());
// These flows exercise returning players; first-time onboarding has its own full UI check.
const returningPlayer = page => page.evaluate(async () => {
  const D = await import('/js/core/dynasty.js'); await D.load();
  D.finishTutorial('skipped', (await import('/js/core/realm-active.js')).profileKey());
});

async function packPreviews(page) {
  const result = await page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js');
    const {packTopPlayers} = await import('/js/views/dynasty-pack-preview.js');
    const slots = [...document.querySelectorAll('.pk-pack-slot')];
    return slots.map(slot => {
      const kind = slot.dataset.packKind, preview = slot.querySelector('.pk-pack-preview');
      const expected = packTopPlayers(kind, {limit: 12}).map(c => c.name);
      const cards = [...(preview?.querySelectorAll('.pk-pack-preview-card') || [])];
      return {
        kind, label: preview?.getAttribute('aria-label'), expected,
        names: cards.map(w => [...w.children].filter(n => !n.matches('.pk-card')).map(n => n.textContent.trim()).join(' ')),
        cardNames: cards.map(w => w.querySelector('.pk-card')?.getAttribute('aria-label')),
        passive: cards.length === 4 && cards.every(w => w.querySelectorAll('div.pk-card[role="img"]').length === 1)
          && !preview.querySelector('button, a, [tabindex]'),
        cloneHidden: !slot.hasAttribute('data-pack-clone') || slot.getAttribute('aria-hidden') === 'true',
        teamNote: kind !== 'team' || preview.textContent.includes('Across teams · choose at purchase'),
        packName: D.PACKS[kind].name
      };
    });
  });
  assert.ok(result.length >= 9, 'The looping shelf has three copies of every pack option');
  for (const row of result) {
    assert.equal(row.label, `Top available players in ${row.packName}`, row.kind + ': accessible preview label');
    assert.ok(row.expected.length >= 4, row.kind + ': eligible top players');
    assert.equal(row.passive, true, row.kind + ': previews are noninteractive cards');
    assert.equal(row.cloneHidden, true, row.kind + ': duplicate previews remain hidden from assistive technology');
    assert.equal(row.teamNote, true, row.kind + ': team choice is explained');
    row.names.forEach((name, i) => {
      assert.ok(row.expected.includes(name), row.kind + ": eligible rotating player");
      assert.ok(row.names[i]?.includes(name), `${row.kind}: visible caption names ${name}`);
      assert.ok(row.cardNames[i]?.includes(name), `${row.kind}: card face matches ${name}`);
    });
  }
  assert.equal(await page.locator('.pk-pack-studio[aria-hidden="true"]').count(), 1, 'Studio is decorative');
  assert.equal(await page.locator('.pk-pack-studio').evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'Studio cannot intercept swipes or purchase');
}

async function packPreviewFit(page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.pk-pane'), nav = document.querySelector('.pk-nav').getBoundingClientRect();
    const stage = document.querySelector('.pk-pack-stage').getBoundingClientRect();
    const slot = document.querySelector('.pk-pack-slot.is-cur');
    const pack = slot.querySelector('.pk-pack').getBoundingClientRect();
    const preview = slot.querySelector('.pk-pack-preview'), p = preview.getBoundingClientRect();
    const buy = document.querySelector('.pk-pack-buy').getBoundingClientRect();
    const visible = node => { const r = node.getBoundingClientRect(), s = getComputedStyle(node); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
    return {
      fits: pane.scrollHeight <= pane.clientHeight + 1 && pane.scrollWidth <= pane.clientWidth + 1,
      pack: pack.top >= stage.top - 1 && pack.bottom <= stage.bottom + 1,
      preview: visible(preview) && p.top >= stage.top - 1 && p.bottom <= stage.bottom + 1
        && (stage.height <= 300 ? p.right <= pack.left + 1 : p.bottom <= pack.top + 1)
        && p.left >= stage.left - 1 && p.right <= stage.right + 1,
      cards: [...preview.querySelectorAll('.pk-card')].every(card => {
        const r = card.getBoundingClientRect();
        return visible(card) && r.top >= p.top - 1 && r.bottom <= p.bottom + 1 && r.left >= p.left - 1 && r.right <= p.right + 1;
      }) && [...preview.querySelectorAll('.pk-pack-preview-card > span')].every(caption => {
        const r = caption.getBoundingClientRect();
        return visible(caption) && caption.scrollWidth <= caption.clientWidth + 1 && caption.scrollHeight <= caption.clientHeight + 1
          && r.top >= p.top - 1 && r.bottom <= p.bottom + 1;
      }),
      buy: buy.top >= stage.bottom - 1 && buy.bottom <= nav.top + 1 && buy.height >= 44
    };
  });
}

async function kitChecks(page) {
  return page.evaluate(async () => {
    const {dynastyChecks} = await import('/js/core/checks-dynasty.js');
    const checks = [];
    await dynastyChecks((name, fn) => checks.push({name, fn}));
    const out = [];
    for (const {name, fn} of checks) {
      try { const got = await fn(); out.push({name, pass: got === true || !!(got && got.pass), detail: (got && got.detail) || ''}); }
      catch (e) { out.push({name, pass: false, detail: String((e && e.stack) || e)}); }
    }
    return out;
  });
}

async function homeFlow(page, reduced) {
  const nav = tab => page.locator(`.pk-nav [data-dy-tab="${tab}"]`).click();
  await page.waitForFunction(() => document.querySelector('.rh-home-art')?.naturalWidth > 0);
  const before = await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine()));
  for (const [width, height] of [[390, 844], [320, 568], [430, 932], [768, 1024]]) {
    await page.setViewportSize({width, height});
    await page.waitForTimeout(120);
    const layout = await page.evaluate(() => {
      const pane = document.querySelector('.pk-pane'), hdr = document.querySelector('.pk-hdr').getBoundingClientRect(), nav = document.querySelector('.pk-nav').getBoundingClientRect();
      const p = pane.getBoundingClientRect();
      return {fits: pane.scrollWidth <= pane.clientWidth + 1, clear: p.top >= hdr.bottom - 1 && p.bottom <= nav.top + 1,
        taps: [...document.querySelectorAll('.rh-home button, .pk-nav button')].every(b => b.getBoundingClientRect().height >= 44)};
    });
    assert.deepEqual(layout, {fits: true, clear: true, taps: true}, `Home fits ${width} x ${height}`);
    await snap(page, `evan-home-${width}${reduced ? '-rm' : ''}`);
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('.rh-home-battle').focus(); await page.keyboard.press('Enter');
  await page.waitForSelector('.rl-ladder');
  assert.equal(await page.locator('.pk-tab.is-on').getAttribute('data-dy-tab'), 'battle');
  await page.waitForSelector('.pk-solo');
  assert.equal(await page.locator('[data-dy-bv="versus"], .rl-switch').count(), 0, 'friend battles are paused: no Versus switch on the ladder');
  await nav('home');
  await page.locator('.rh-home .is-packs').click(); await page.waitForSelector('.pk-packs');
  await nav('home');
  await page.locator('.rh-home .is-collection').click(); await page.waitForSelector('.pk-binder');
  await nav('home');
  await page.locator('.rh-home-tools [data-dy-tab="decks"]').click(); await page.waitForSelector('.pocket-decks');
  await nav('home');
  await page.locator('.rh-home [data-dy-guide]').click(); await page.waitForSelector('.sheet.pk-sheet');
  await page.locator('.sheet.pk-sheet .sheet-close').click();
  await page.waitForFunction(() => !document.querySelector('.sheet.pk-sheet'));
  assert.doesNotMatch(await page.locator('.rh-home-ribbon').innerText(), /Versus/, 'friend battles are paused: the banner says Solo ladder');
  // A saved link to a friend match shows the paused notice, never the match.
  await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty/battle/paused1'));
  await page.waitForSelector('.db-msg');
  assert.match(await page.locator('.db-msg').innerText(), /Friend battles are paused/);
  await page.evaluate(() => history.back());
  await page.waitForSelector('.rh-home');
  const after = await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine()));
  assert.equal(after, before, 'Home navigation does not change cards, decks, balances or progress');
  // A live profile switch must remove the owner chrome and cached Home, including the new artwork.
  await page.evaluate(async () => { const d = await import('/js/core/data.js'); d.setGuest('Ryan Stewart'); });
  await page.waitForSelector('.pk-start.is-ready');
  assert.deepEqual(await page.locator('.pk-tab').allTextContents(), ['Home', 'Battle', 'Packs', 'Collection', 'Decks']);
  assert.ok(await page.locator('.rh-home-enabled').count(), 'Ryan receives the shared Home after switching');
  await page.evaluate(async () => (await import('/js/core/data.js')).setMe('evan'));
  await page.waitForSelector('.rh-home-enabled');
  // The router remounts the game when the profile changes; its title screen still applies.
  await page.waitForSelector('.pk-start.is-ready');
  await page.locator('.pk-start').click({position: {x: 195, y: 640}});
  await page.waitForFunction(() => !document.querySelector('.pk-start'));
  await nav('home');
  assert.equal(await page.locator('.rh-home').count(), 1);
  console.log('PASS owner Home: responsive layout, keyboard, destinations, saved progress and profile switching');
}

async function ownerPacksFlow(page, reduced) {
  const front = () => page.locator('.pk-pack-buy').getAttribute('aria-label');
  const settle = () => page.waitForTimeout(reduced ? 300 : 650);
  const save = () => page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine()));
  const before = await save();
  assert.equal(await page.locator('.pk-free, .pk-show, .pk-tags, .pk-pts, .pk-actions, .pk-car-dots, .pk-pack-shop .pk-sec').count(), 0, 'The pack shop keeps its compact shelf and checkout');
  assert.equal(await page.locator('.pk-pack-buy').count(), 1);
  await packPreviews(page);
  for (const [width, height] of [[390, 844], [320, 568], [430, 932], [768, 1024], [390, 667], [844, 390]]) {
    await page.setViewportSize({width, height});
    await page.evaluate(notch => {
      document.documentElement.style.setProperty('--sa-t', notch ? '59px' : '0px');
      document.documentElement.style.setProperty('--sa-b', notch ? '34px' : '0px');
    }, height === 667);
    await settle();
    assert.match(await front(), /Starter Pack/, 'Resizing preserves the selected pack');
    await snap(page, `evan-packs-${width}-${height}${reduced ? '-rm' : ''}`);
    const fit = await packPreviewFit(page);
    if (Object.values(fit).some(v => !v)) console.error('Pack layout diagnostics', await page.locator('.pk-pack-slot.is-cur .pk-pack-preview-card').evaluateAll(cards => cards.map(card => {
      const caption = card.querySelector(':scope > span');
      return {name: caption.textContent, width: caption.clientWidth, height: caption.clientHeight, textWidth: caption.scrollWidth, textHeight: caption.scrollHeight,
        card: card.querySelector('.pk-card').getBoundingClientRect().toJSON(), preview: card.closest('.pk-pack-preview').getBoundingClientRect().toJSON()};
    })));
    assert.deepEqual(fit, {fits: true, pack: true, preview: true, cards: true, buy: true}, `Packs and top players fit ${width}x${height}`);
  }
  await page.evaluate(() => { document.documentElement.style.removeProperty('--sa-t'); document.documentElement.style.removeProperty('--sa-b'); });
  await page.setViewportSize({width: 390, height: 844}); await settle();
  const shelf = page.locator('.pk-pack-shelf');
  await shelf.focus();
  for (const name of ['Standard', 'Team', 'Epic', 'Starter', 'Standard']) {
    await page.keyboard.press('ArrowRight'); await settle();
    assert.match(await front(), new RegExp(name + ' Pack'), `Right arrow selects ${name}: ` + JSON.stringify(await shelf.evaluate(el => ({left: el.scrollLeft, current: [...el.children].findIndex(s => s.classList.contains('is-cur')), focus: document.activeElement.className}))));
    assert.deepEqual(await packPreviewFit(page), {fits: true, pack: true, preview: true, cards: true, buy: true}, name + ': preview stays above its own pack after selection');
  }
  for (const name of ['Starter', 'Epic', 'Team', 'Standard', 'Starter']) {
    await page.keyboard.press('ArrowLeft'); await settle();
    assert.match(await front(), new RegExp(name + ' Pack'), 'Left arrow loops through every pack');
  }
  const bb = await shelf.boundingBox();
  await page.mouse.move(bb.x + bb.width * .65, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width * .16, bb.y + bb.height / 2, {steps: 12}); await page.mouse.up(); await settle();
  assert.match(await front(), /Standard Pack/, 'Mouse drag brings the next pack forward');
  // A real native touch pan has momentum and pointer cancellation, unlike a scripted scrollLeft change.
  const cdp = await page.context().newCDPSession(page);
  const y = bb.y + bb.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 300, y}]});
  for (let x = 280; x >= 110; x -= 17) {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y}]});
    await page.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await settle();
  assert.match(await front(), /Team Pack/, 'Touch swipe brings the next pack forward');
  await cdp.detach();
  await shelf.focus(); await page.keyboard.press('ArrowRight'); await settle();
  assert.match(await front(), /Epic Pack/);
  const nav = tab => page.locator(`.pk-nav [data-dy-tab="${tab}"]`).click();
  await nav('home'); await nav('packs'); await settle();
  assert.match(await front(), /Epic Pack/, 'Tab restoration keeps the selected pack');
  assert.equal(await save(), before, 'Browsing packs never changes cards, currency or progress');
  assert.equal(await page.locator('div.pk-open').count(), 0, 'Swipes and selections open nothing');
  await page.locator('.pk-pack-buy').click();
  await page.waitForSelector('div.pk-open');
  assert.notEqual(await save(), before, 'Purchase opens the selected pack through the existing economy');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('div.pk-open'));
  await settle();
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'pk-pack-buy', 'Opening returns focus to Purchase');
  console.log('PASS owner Packs: responsive layout, both loop directions, mouse/touch, tab restore, purchase and focus');
}

async function playerFlow(page, p, {reduced}) {
  const T = p.tag + (reduced ? ' (reduced motion)' : '');
  await page.waitForSelector('.pk-start', {timeout: 15000});
  assert.equal(await page.evaluate(() => location.hash), '#/puzzles/dynasty', T + ': the Dynasty route');
  assert.equal(await page.locator('#tabbar').isVisible(), false, T + ': the app’s tab bar is hidden while playing');
  assert.equal(await page.locator('.pk.is-start').count(), 1, T + ': the shell is held still under the title screen');
  assert.equal(await page.locator('[data-dy-pane][inert], .pk-hdr[inert], .pk-nav[inert]').count(), 3, T + ': the shell is inert under the title screen');
  await page.waitForSelector('.pk-start.is-ready', {timeout: 20000});
  await page.waitForTimeout(reduced ? 200 : 900);
  assert.equal(await page.locator('[data-dy-start-say]').textContent(), 'Tap to Start', T + ': Tap to Start once the cards are in');
  assert.equal(await page.locator('.pk-start-card, .pk-start .pk-card').count(), 0, T + ': no cards on the title screen');
  assert.match(await page.locator('.pk-start-ver').textContent(), /Ver\. 3\.0\.\d+Support ID: [A-Z0-9]{8}/, T + ': the version and a support id');
  assert.equal(await page.locator('.pk-start .gg-exit').count(), 1, T + ': the red X on the title screen');
  assert.equal(await page.locator('.pk-start-logo').textContent(), 'GridironTrading Card GameRivals', T + ': the logo');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-title`);
  // Tap anywhere: Evan's new Home, or the deployed Play hub for Ryan Stewart.
  await returningPlayer(page);
  await page.locator('.pk-start').click({position: {x: 195, y: 640}});
  await page.waitForFunction(() => !document.querySelector('.pk-start'), null, {timeout: 5000});
  assert.equal(await page.locator('.pk.is-start, [inert]').count(), 0, T + ': the shell is live again');
  const owner = p.plays;
  assert.deepEqual(await page.locator('.pk-tab').allTextContents(), owner ? ['Home', 'Battle', 'Packs', 'Collection', 'Decks'] : ['Play', 'Cards', 'Decks', 'Packs'], T + ': profile-scoped navigation');
  assert.equal(await page.locator('.pk-tab.is-on').getAttribute('data-dy-tab'), owner ? 'home' : 'battle', T + ': the right entry destination');
  assert.equal(await page.locator('[data-pk-title]').textContent(), owner ? 'Home' : 'Play', T + ': the current page');
  assert.equal(await page.locator('.rh-home-enabled, .rh-home').count(), owner ? 2 : 0, T + ': Home belongs only to the owner');
  if (p.tag === 'evan' && !packsOnly) await homeFlow(page, reduced);
  assert.equal(await page.locator('.pk-hdr [data-dy-menu]').count(), 1, T + ': Menu is in the header');
  const labels = await page.locator('.pk-tab span:not(.pk-dot)').evaluateAll(nodes => nodes.map(n => {
    const s = getComputedStyle(n), r = n.getBoundingClientRect();
    return s.clip !== 'rect(0px, 0px, 0px, 0px)' && r.width > 8 && r.height >= 10;
  }));
  assert.ok(labels.length >= 4 && labels.every(Boolean), T + ': navigation labels are visually readable');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-play`);
  assert.match((await page.locator('[data-dy-hud]').innerText()).replace(/\s+/g, ' '), p.tag === 'mason' ? /^\d+ [\d,]+ coins$/ : /∞ MAX [\d,]+ coins/, T + ': the header’s counters (packs held or unlimited packs, coins)');
  await page.locator('.pk-tab[data-dy-tab="packs"]').click();
  if (owner) await ownerPacksFlow(page, reduced);
  else {
  assert.equal(await page.locator('.pk-pack-shop, .is-pack-shop').count(), 0, T + ': the new Packs screen stays owner-only');
  for (const sel of ['.pk-packs', '.pk-clock', '.pk-show-tip', '.pk-tags > b', '.pk-round[data-dy-goto="cols"]', '.pk-round[data-dy-earn]', 'button.pk-open.is-round', '.pk-actions .pk-pill[data-dy-odds]', '.pk-actions .pk-pill[data-dy-packs]', '.pk-pts'])
    assert.equal(await page.locator(sel).count(), 1, T + ': the Packs stage has ' + sel);
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-packs`);
  // A short phone with a notch: only the pane scrolls. The header and bottom tabs must stay clear of it, and
  // the Open action must remain reachable. Native iOS status-bar effects still need an on-device check.
  const viewport = page.viewportSize();
  await page.setViewportSize({width: 390, height: 667});
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--sa-t', '59px');
    document.documentElement.style.setProperty('--sa-b', '34px');
  });
  const frame = () => page.evaluate(() => {
    const rect = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return {top: r.top, bottom: r.bottom}; };
    const pane = document.querySelector('.pk-pane');
    return {header: rect('.pk-hdr'), title: rect('.pk-title'), pane: rect('.pk-pane'), nav: rect('.pk-nav'),
      top: pane.scrollTop, outerTop: document.querySelector('.v-dynasty').scrollTop};
  });
  const before = await frame();
  assert.ok(before.title.top >= 59, T + ': header controls clear the notch');
  assert.ok(before.pane.top >= before.header.bottom, T + ': scrolling begins below the opaque header');
  assert.ok(before.pane.bottom <= before.nav.top && before.nav.bottom <= 667, T + ': the pane ends above the visible tabs');
  await page.locator('button.pk-open.is-round').scrollIntoViewIfNeeded();
  const after = await frame();
  assert.ok(after.top > 0, T + ': pack content scrolls on a short phone');
  assert.equal(after.outerTop, 0, T + ': the outer screen does not scroll under the status bar');
  assert.deepEqual(after.header, before.header, T + ': the header stays fixed while the pane scrolls');
  assert.deepEqual(after.nav, before.nav, T + ': the bottom tabs stay fixed while the pane scrolls');
  const open = await page.locator('button.pk-open.is-round').boundingBox();
  assert.ok(open.y >= after.pane.top && open.y + open.height <= after.nav.top, T + ': Open is reachable above the tabs');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-safe-area`);
  await page.locator('.pk-tab[data-dy-tab="battle"]').click();
  assert.equal((await frame()).top, 0, T + ': a tab change resets the pane scroll');
  await page.locator('.pk-tab[data-dy-tab="packs"]').click();
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('--sa-t');
    document.documentElement.style.removeProperty('--sa-b');
  });
  await page.setViewportSize(viewport);
  // the pack stack (the owner, Oct 29 2026: "User should be able to switch packs like the attached"): the packs that
  // follow peek out behind, a swipe left brings the next forward, → and ← step through them, a tap on one behind brings
  // it, the pack list picks one too, and none of it opens a pack
  const front = async () => (await page.locator('.pk-tags > b').textContent()).trim(), settle = () => page.waitForTimeout(reduced ? 500 : 700); // (a tap within 450ms of a swipe is ignored: no settle shorter)
  assert.equal(await front(), 'Starter', T + ': the Starter Pack is in front while it waits');
  assert.deepEqual(await page.locator('.pk-car-bk').evaluateAll(l => l.map(b => b.dataset.dyTo)), ['std', 'team'], T + ': the Standard and Team Packs peek out behind it');
  const bb = await page.locator('.pk-bigpack').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 - 40, bb.y + bb.height / 2, {steps: 4}); await page.mouse.move(bb.x + bb.width / 2 - 130, bb.y + bb.height / 2, {steps: 6});
  await page.mouse.up(); await settle();
  assert.equal(await front(), 'Standard', T + ': a swipe left brings the next pack to the front');
  assert.equal(await page.locator('.dy-rip').count(), 0, T + ': the swipe opened nothing');
  await page.locator('.pk-bigpack').focus(); await page.keyboard.press('ArrowRight'); await settle();
  assert.equal(await front(), 'Team', T + ': → steps to the next pack');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.className), 'pk-bigpack', T + ': the front pack keeps the focus');
  const b2 = await page.locator('.pk-car-bk[data-bk="2"]').boundingBox(); // (its right edge shows past the pack in front)
  await page.mouse.click(b2.x + b2.width * .9, b2.y + b2.height * .5); await settle();
  assert.equal(await front(), 'Starter', T + ': a tap on the second pack behind brings it to the front');
  await page.locator('.pk-bigpack').focus(); await page.keyboard.press('ArrowLeft'); await settle();
  assert.equal(await front(), 'Epic', T + ': ← steps back a pack, round to the last');
  assert.deepEqual(await page.locator('.pk-car-bk').evaluateAll(l => l.map(b => b.dataset.dyTo)), ['start', 'std'], T + ': the stack wraps round to the Starter Pack');
  await page.locator('.pk-actions .pk-pill[data-dy-packs]').click();
  await page.waitForSelector('.pk-pickb.is-on');
  assert.match(await page.locator('.pk-pickb.is-on').textContent(), /Epic Pack/, T + ': the pack list marks the one in front');
  assert.deepEqual(await page.locator('.pk-pickb').evaluateAll(l => l.map(b => b.dataset.dyPick)), ['start', 'std', 'team', 'prem'], T + ': three packs on sale (and the Starter Pack while it waits)');
  await page.locator('.pk-pickb[data-dy-pick="team"]').click(); await settle();
  assert.equal(await front(), 'Team', T + ': the pack list brings a pack to the front');
  assert.deepEqual(await page.locator('.pk-car-bk').evaluateAll(l => l.map(b => b.dataset.dyTo)), ['prem', 'start'], T + ': the Epic and Starter Packs behind it');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-stack`);
  }
  if (packsOnly) return;
  // Play: routes to solo, friend challenges, deck editing, rules and collections.
  await page.locator('.pk-tab[data-dy-tab="battle"]').click();
  await page.waitForSelector(owner ? '.rl-ladder' : '.pk-mode');
  assert.equal(await page.locator('[data-dy-bv="versus"]').count(), 0, T + ': friend battles are paused (features.rivalsVersus)');
  assert.equal(await page.locator(owner ? '.rl-ladder' : '.pk-mode[data-dy-bv="solo"]').count(), 1, T + ': solo opponents are directly accessible');
  assert.deepEqual(await page.locator('.pk-mini span:not(.sr-only)').allTextContents(), ['Rules', 'Decks', 'Rankings', 'Collections'], T + ': Guide, Decks, Rankings, Missions');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-battle`);
  // Missions: the collections
  await page.locator('.pk-mini[data-dy-goto="cols"]').click();
  await page.waitForSelector('.pk-cols');
  assert.equal(await page.locator('.pk-tab.is-on').getAttribute('data-dy-tab'), 'cards', T + ': Missions opens the collections on My Cards');
  // a collection's cards you don't have yet stay face down: no name, picture or stats, and no tap to see them
  await page.locator('[data-dy-col="series-A"]').click();
  await page.waitForSelector('.sheet.pk-sheet .pk-grid');
  const sheetCards = await page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js'), s = D.mine(), col = D.collection('series-A');
    const need = col.need.filter(D.isCard), have = need.filter(id => s.o[id] > 0).length;
    const g = document.querySelector('.sheet.pk-sheet .pk-grid');
    return {need: need.length, have, locked: g.querySelectorAll('.pk-locked').length, open: g.querySelectorAll('[data-dy-card]').length,
      ghost: g.querySelectorAll('.is-ghost').length, names: g.querySelectorAll('.pk-locked .pk-c-name, .pk-locked img').length};
  });
  assert.equal(sheetCards.locked, sheetCards.need - sheetCards.have, T + ': each missing card is a locked slot');
  assert.equal(sheetCards.open, sheetCards.have, T + ': only cards you have show and open');
  assert.equal(sheetCards.ghost + sheetCards.names, 0, T + ': no greyed-out faces, no names or pictures on a locked slot');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-collection`);
  await page.locator('.sheet.pk-sheet [aria-label="Close"], .sheet.pk-sheet .sheet-close').first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForFunction(() => !document.querySelector('.sheet.pk-sheet'), null, {timeout: 5000});
  // a player's card up close: his page (header, bio, tabs), no real cards (the owner, Nov 2 2026; the Starter Pack opened
  // for some players to own)
  await page.evaluate(async () => { const D = await import('/js/core/dynasty.js'); if (D.mine().pk.start) D.open('start', {free: true}); });
  await page.locator('.v-dynasty [data-dy-cv="mine"]').click();
  await page.waitForSelector('.v-dynasty [data-dy-card]');
  const pid = await page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js');
    const b = [...document.querySelectorAll('.v-dynasty [data-dy-card]')].find(x => D.card(x.dataset.dyCard) && x.getClientRects().length);
    if (b) b.scrollIntoView({block: 'center'});
    return b ? b.dataset.dyCard : null;
  });
  assert.ok(pid, T + ': a player card in the binder');
  await page.locator(`.v-dynasty [data-dy-card="${pid}"]`).first().click();
  await page.waitForSelector('.sheet.pk-sheet .pk-ps .pk-ps-bio');
  await page.waitForFunction(() => document.querySelector('.sheet.pk-sheet .pk-ps-bio dt:nth-child(1)') && /Height|Era/.test(document.querySelector('.sheet.pk-sheet .pk-ps-bio').textContent), null, {timeout: 8000});
  assert.equal(await page.locator('.sheet.pk-sheet .pk-real, .sheet.pk-sheet .pk-real-c').count(), 0, T + ': no real cards section');
  assert.ok(await page.locator('.sheet.pk-sheet .pk-ps-col').count() >= 3, T + ': the attribute bars');
  await page.locator('.sheet.pk-sheet [data-seg="dy-ps"] button[data-value="stats"]').click();
  await page.waitForSelector('.sheet.pk-sheet [data-dy-pane] :is(.pk-ps-t, .pk-lines, .pk-ps-none)');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-player`);
  await page.locator('.sheet.pk-sheet [aria-label="Close"], .sheet.pk-sheet .sheet-close').first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForFunction(() => !document.querySelector('.sheet.pk-sheet'), null, {timeout: 5000});
  await page.locator('.v-dynasty [data-dy-cv="cols"]').click();
  // the Menu
  await page.locator('.pk-hdr [data-dy-menu]').click();
  await page.waitForSelector('.pk-menu');
  assert.deepEqual(await page.locator('.pk-menu b').allTextContents(), [...(p.plays ? ['Jukebox', 'Sound'] : []), 'Guide', 'Coins', 'Rankings', 'Offering Rates', 'Title screen', 'Exit Gridiron Rivals'], T + ': the Menu’s items');
  await snap(page, `${p.tag}${reduced ? '-rm' : ''}-menu`);
  await page.locator('[data-dy-m="title"]').click();
  await page.waitForSelector('.pk-start.is-ready', {timeout: 5000});
  await page.waitForTimeout(reduced ? 100 : 500);
  assert.equal(await page.locator('.sheet.pk-sheet').count(), 0, T + ': the Menu closed');
  assert.equal(await page.locator('.pk-start-card, .pk-start .pk-card').count(), 0, T + ': the title screen is back, still without cards');
  // Enter starts too
  await page.locator('.pk-start').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.pk-start'), null, {timeout: 5000});
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.className), 'pk-title', T + ': focus lands on the page title after starting');
  if (reduced) return;
  // back from a Solo battle: no title screen again (the Starter Pack opened, the deck built, the computer's first opponent)
  const mid = await page.evaluate(async () => {
    const D = await import('/js/core/dynasty.js'), SOLO = await import('/js/core/dynasty-solo.js'), app = await import('/js/app.js');
    const s = D.mine();
    if (s.pk.start) D.open('start', {free: true});
    D.setDeck(D.autoDeck(D.mine().o));
    const r = SOLO.start('g1');
    if (!r.ok) return r.why;
    await app.nav('/puzzles/dynasty/battle/' + r.mid);
    return r.mid;
  });
  assert.match(String(mid), /^cpu/, T + ': a Solo battle started: ' + mid);
  await page.waitForSelector('.rp-battle', {timeout: 10000});
  assert.equal(await page.evaluate(async () => (await import('/js/core/dynasty-solo.js')).current().G.v), 7, T + ': new solo matches use v7');
  assert.equal(await page.locator('.pk-start').count(), 0, T + ': no title screen under a battle');
  await page.goBack();
  await page.waitForSelector('.pk-pane', {timeout: 10000});
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.pk-start').count(), 0, T + ': back from a battle, the title screen doesn’t come again');
  assert.equal(await page.evaluate(() => location.hash), '#/puzzles/dynasty', T + ': back on the Dynasty');
  assert.equal(await page.locator('#tabbar').isVisible(), false, T + ': the app’s tab bar stays hidden');
  // the kit checks
  const out = await kitChecks(page);
  const failed = out.filter(c => !c.pass);
  console.log(`${T}: ${out.length - failed.length}/${out.length} Dynasty kit checks pass`);
  failed.forEach(c => console.error('FAIL ' + c.name + '\n  ' + c.detail));
  assert.equal(failed.length, 0, T + ': Dynasty kit checks failed');
}

async function packProfileFlow(browser, url) {
  const profiles = [
    {tag: 'evan', me: 'evan', owner: true, packs: true, coins: false},
    {tag: 'jayton', me: 'jayton', owner: false, packs: false, coins: true},
    {tag: 'ryan-stewart', me: 'none', guest: 'Ryan Stewart', owner: false, packs: true, coins: false},
    {tag: 'ryan-younggreen', me: 'none', guest: 'Ryan Younggreen', owner: false, packs: false, coins: false}
  ];
  for (const p of profiles) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    await context.addInitScript(p => {
      localStorage.setItem('gg-me', p.me);
      if (p.guest) localStorage.setItem('gg-guest', p.guest);
      localStorage.setItem('gg-welcome', '1'); sessionStorage.setItem('gg-skip-title', '1');
      ['evan', 'jayton', 'mason', 'user%3Aryan-stewart', 'user%3Aryan-younggreen'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    }, p);
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted);
      assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Profile checks cannot write live data');
      await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
      await returningPlayer(page);
      await page.waitForSelector('.pk-start.is-ready'); await page.locator('.pk-start').click();
      await page.waitForFunction(() => !document.querySelector('.pk-start'));
      const state = () => page.evaluate(async () => {
        const D = await import('/js/core/dynasty.js'), data = await import('/js/core/data.js');
        return {save: JSON.stringify(D.mine()), owner: data.isOwner(), packs: D.unlimited(), coins: D.unlimitedCoins()};
      });
      const before = await state();
      assert.deepEqual({owner: before.owner, packs: before.packs, coins: before.coins}, {owner: p.owner, packs: p.packs, coins: p.coins}, p.tag + ': individual privileges stay intact');
      await page.locator('.pk-tab[data-dy-tab="packs"]').click();
      await page.waitForSelector('.pk-pack-slot.is-cur .pk-pack-preview'); await page.waitForTimeout(300);
      await packPreviews(page);
      const shelf = page.locator('.pk-pack-shelf'); await shelf.focus();
      for (const name of ['Starter', 'Standard', 'Team', 'Epic']) {
        assert.match(await page.locator('.pk-pack-buy').getAttribute('aria-label'), new RegExp(name + ' Pack'), p.tag + ': correct selected pack');
        assert.deepEqual(await packPreviewFit(page), {fits: true, pack: true, preview: true, cards: true, buy: true}, p.tag + ': ' + name + ' preview fits');
        await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
      }
      const names = () => page.locator('.pk-pack-slot.is-cur .pk-pack-preview-card > span').allTextContents();
      const first = await names();
      await page.locator('.pk-tab[data-dy-tab="home"]').click();
      await page.locator('.pk-tab[data-dy-tab="packs"]').click();
      await page.waitForTimeout(300);
      assert.notDeepEqual(await names(), first, 'Revisiting Packs rotates the featured players');
      await packPreviews(page);
      assert.deepEqual(await state(), before, p.tag + ': browsing top players preserves progress and privileges');
      assert.equal(await page.locator('div.pk-open').count(), 0, p.tag + ': browsing never opens packs');
      await snap(page, p.tag + '-pack-preview');
      await page.evaluate(async () => { const data = await import('/js/core/data.js'); data.setGuest(null); data.setMe('none'); });
      await page.waitForFunction(() => location.hash === '#/puzzles' && !document.querySelector('.pk, .pk-start, .pk-pack-shop, .pk-pack-studio, .pk-pack-preview'));
      assert.equal(await page.locator('.pk, .pk-start').count(), 0, p.tag + ': switching to no profile removes the pack screen');
      assert.deepEqual(errors, [], p.tag + ': preview browser exceptions');
    } finally { await context.close(); }
  }
  console.log('PASS pack previews: four authorized profiles, all pack options, unchanged saves/privileges and live profile switching');
}

async function run(url) {
  let pw;
  try { pw = require('playwright'); }
  catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
  const {chromium} = pw;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
  try {
    for (const p of PROFILES.filter(p => !packProfilesOnly && (!packsOnly || p.tag === 'evan'))) for (const reduced of (p.plays && p.tag === 'evan' ? [false, true] : [false])) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference'});
      await context.route('https://**/*', route => route.abort());
      await context.addInitScript(p => {
        localStorage.setItem('gg-me', p.me);
        if (p.guest) localStorage.setItem('gg-guest', p.guest);
        localStorage.setItem('gg-welcome', '1');
        ['evan', 'mason', 'user%3Aryan-stewart', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      }, p);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e));
      page.on('console', m => { // (Chrome's own notice when a scripted step haptics before any tap isn't the app's)
      if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
      await page.goto(url + '/#/puzzles');
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Local test writes must remain disabled');
      await page.evaluate(async () => { const app = await import('/js/app.js'); await app.nav('/puzzles/dynasty'); });
      await page.waitForTimeout(800);
      if (p.plays) await playerFlow(page, p, {reduced});
      else {
        assert.equal(await page.evaluate(() => location.hash), '#/puzzles', p.tag + ': the Dynasty link lands on Daily Games');
        assert.equal(await page.locator('.pk, .pk-start').count(), 0, p.tag + ': no Dynasty screen');
        // (Daily Games is the home screen: its app icons stand in for the tab bar there, Oct 30 2026)
        assert.equal(await page.locator('.hm-apps').isVisible(), true, p.tag + ': the home screen’s apps stay');
        console.log(`${p.tag}: the Dynasty stays closed`);
      }
      assert.deepEqual(errors, [], p.tag + ': unexpected browser exceptions');
      await context.close();
    }
    await packProfileFlow(browser, url);
  } finally { await browser.close(); }
  console.log(packProfilesOnly ? 'PASS: player previews and access boundaries for all four profiles' : packsOnly ? 'PASS: Packs shelf and player previews in normal/reduced motion and all four profiles' : 'PASS: Rivals title screen, navigation, collections, pack previews and access boundaries');
}

(async () => {
  const s = await server();
  try { await run(`http://127.0.0.1:${s.address().port}`); }
  finally { await new Promise(resolve => s.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
