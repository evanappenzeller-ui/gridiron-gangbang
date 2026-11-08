// Offline checks for visible deck cards, grouped copies, empty slots and saved rearrangement.
// Firebase is disabled; screenshots use local player artwork. --details-shot captures only the deck summary.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/visual-decks');
const detailsShot = process.argv.includes('--details-shot');
fs.mkdirSync(out, {recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html')); }
  catch { return res.writeHead(400).end(); }
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
const profiles = [{me:'evan', key:'m_evan'}, {me:'jayton', key:'m_jayton'}, {guest:'Ryan Stewart', key:'u_ryan-stewart'}, {guest:'Ryan Younggreen', key:'u_ryan-younggreen'}];
const close = async page => { await page.locator('.sheet-close').last().click(); await page.waitForFunction(() => !document.querySelector('.sheet')); };
const order = page => page.locator('[data-pd-selected-grid] [data-pd-selected]').evaluateAll(els => els.map(el => el.dataset.pdSelected));
const snapshot = page => page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine()));
async function open(page) {
  await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
  if (await page.locator('.pk-start').count()) { await page.waitForSelector('.pk-start.is-ready'); await page.locator('.pk-start').focus(); await page.keyboard.press('Enter'); }
  await page.locator('.pk-tab[data-dy-tab="decks"]').click();
  await page.waitForSelector('.pocket-decks');
}
async function inspect(page, id) { await page.locator(`[data-pd-deck="${id}"]`).click(); await page.waitForSelector('.pd-detail'); }
async function edit(page, id) { await inspect(page, id); await page.locator('.pd-detail-actions [data-pd-edit]').click(); await page.waitForSelector('[data-pd-selected-grid]'); }
async function visualMetrics(page, selector) {
  return page.locator(selector).evaluateAll(tiles => tiles.map(tile => {
    const card = tile.querySelector('.pk-card'), badge = tile.querySelector('.pd-copy-tag');
    const c = card.getBoundingClientRect(), b = badge?.getBoundingClientRect(), pointer = badge?.style.pointerEvents;
    if (badge) badge.style.pointerEvents = 'auto';
    const visible = !b || document.elementsFromPoint(b.left+b.width/2, b.top+b.height/2).includes(badge);
    if (badge) badge.style.pointerEvents = pointer;
    return {width:c.width, height:c.height, badge:badge?.textContent, upperLeft:!b || b.left < c.left + c.width / 3 && b.top < c.top + c.height / 5,
      badgeVisible:visible, overflow:tile.scrollWidth > tile.clientWidth + 8};
  }));
}
async function run(browser, url, profile, full) {
  const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block', reducedMotion:'reduce', hasTouch:true});
  await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
  await context.addInitScript(p => {
    if (!localStorage.getItem('gg-me')) { localStorage.setItem('gg-me', p.me || 'none'); if (p.guest) localStorage.setItem('gg-guest', p.guest); }
    localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
    for (const k of ['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen','visitor']) localStorage.setItem('gg-release-3.0:' + k,'1');
    localStorage.setItem('gg-rivals-music:' + p.key + ':v1', JSON.stringify({enabled:false}));
  }, profile);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(url + '/#/puzzles'); await page.waitForFunction(() => window.__ggBooted);
    const fixture = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), C = await import('/js/core/dynasty-pocket-cards.js');
      await D.load(); if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes must be disabled');
      const s = D.mine(); D.CARDS.filter(c => String(c.head).startsWith('a:')).forEach(c => { s.o[c.id] = 2; });
      const single = D.CARDS.find(c => !s.o[c.id]); s.o[single.id] = 1;
      const built = C.defaultDeck(s.o); if (built.rental) throw Error('Missing owned deck fixture');
      const result = D.savePocketDeck({...built, name:'Visual lineup'}); if (!result.ok) throw Error(result.why);
      const empty = D.savePocketDeck({name:'Empty visual deck',ids:[],energy:['Fire']});
      return {id:result.id, empty:empty.id, ids:built.ids, single:{id:single.id,name:C.card(single.id).canonicalName}, collection:JSON.stringify(s.o)};
    });
    await open(page); const before = await snapshot(page); await inspect(page, fixture.id);
    assert.equal(await page.locator('.pd-detail .pd-card-tile .pk-card').count(), new Set(fixture.ids).size, 'details show one actual card per group');
    assert.ok(await page.locator('.pd-detail .pk-trainer').count(), 'support cards retain printed faces');
    assert.equal(await page.locator('.pd-detail .pd-add-slot').count(), 0, 'full deck has no empty slot');
    assert.equal(await snapshot(page), before, 'viewing deck cards never saves');
    if (full) {
      await page.waitForFunction(() => document.querySelectorAll('.sheet').length === 1 && getComputedStyle(document.querySelector('.pd-detail').closest('.sheet')).opacity === '1');
      await page.locator('.pd-detail .pk-c-ph').evaluateAll(images => Promise.all(images.map(img => img.decode().catch(() => {}))));
      await page.screenshot({path:path.join(out,'detail-390.png')});
    }
    if (detailsShot) { console.log('PASS visual deck detail screenshot'); return; }
    await page.locator('.pd-detail-actions [data-pd-edit]').click();
    assert.equal(await page.locator('[data-pd-selected-grid] .pk-card').count(), new Set(fixture.ids).size);
    assert.equal(await page.locator('[data-pd-selected-grid] .pd-copy-tag').first().textContent(), '×2');
    assert.ok(await page.locator('[data-pd-rows] .pk-card').count(), 'available cards are also visible');
    assert.ok(await page.locator('[data-pd-rows] [data-pd-add]').evaluateAll(els => els.every(el => el.disabled)), '20-card limit blocks additions');
    if (full) {
      for (const width of [320,390,768]) {
        await page.setViewportSize({width,height:844}); await page.locator('[data-pd-selected-grid]').scrollIntoViewIfNeeded();
        const first = page.locator('[data-pd-selected-grid] .pd-card-tile').first(); await first.scrollIntoViewIfNeeded();
        const metrics = await visualMetrics(page, '[data-pd-selected-grid] .pd-card-tile');
        assert.ok(metrics.every(m => m.width > 90 && Math.abs(m.width/m.height - 63/88) < .02 && m.upperLeft && !m.overflow), 'card proportions, upper-left badges and layout fit ' + width);
        assert.ok(metrics[0].badgeVisible, 'duplicate badge paints above first card at ' + width);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({path:path.join(out,'editor-'+width+'.png')});
      }
      await page.setViewportSize({width:390,height:844});
      const oldOrder = await order(page), handle = page.locator(`[data-pd-move="${oldOrder[0]}"]`);
      await handle.focus(); await page.keyboard.press('ArrowRight');
      assert.deepEqual((await order(page)).slice(0,2), [oldOrder[1],oldOrder[0]], 'keyboard moves duplicate group together');
      assert.equal(await snapshot(page), before, 'rearrangement is only a draft until Save');
      await close(page); await edit(page, fixture.id); assert.deepEqual(await order(page), oldOrder, 'closing discards rearrangement');
      await page.locator(`[data-pd-move="${oldOrder[1]}"]`).click();
      await page.locator(`[data-pd-selected-grid] [data-pd-selected="${oldOrder[0]}"] .pd-card-preview`).click();
      assert.deepEqual((await order(page)).slice(0,2), [oldOrder[1],oldOrder[0]], 'tap Move then a card rearranges');
      const expected = (await order(page)).flatMap(id => fixture.ids.filter(value => value === id));
      await page.locator('[data-pd-save]').click(); await page.waitForFunction(() => !document.querySelector('.sheet'));
      await page.reload(); await page.waitForFunction(() => window.__ggBooted); await open(page); await edit(page, fixture.id);
      assert.deepEqual(await page.evaluate(async id => (await import('/js/core/dynasty.js')).pocketLoadouts().find(d => d.id === id).ids, fixture.id), expected, 'saved reordered copies survive reload');
      const currentOrder = await order(page), move = page.locator(`[data-pd-move="${currentOrder[1]}"]`);
      await move.scrollIntoViewIfNeeded();
      const a = await move.boundingBox(), b = await page.locator(`[data-pd-selected-grid] [data-pd-selected="${currentOrder[0]}"] .pd-card-preview`).boundingBox();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.deepEqual(await order(page),currentOrder,'cancelled touch leaves card order intact');
      assert.equal(await page.locator('.pd-editor .is-moving,.pd-editor .is-drop-target').count(),0,'cancelled touch removes move highlights');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal((await order(page))[0], currentOrder[1], 'touch dragging a handle moves the group');
      await page.locator('[data-pd-minus="P7-film"]').click(); assert.match(await page.locator('[data-pd-count]').textContent(), /^19\/20/);
      assert.equal(await page.locator('[data-pd-add-slot]').count(), 1, 'missing card offers a plus slot');
      await page.locator('[data-pd-add-slot]').click(); assert.equal(await page.locator('[data-pd-search]').evaluate(el => el === document.activeElement), true);
      await page.locator('[data-pd-plus="P7-film"]').click(); assert.ok(await page.locator('[data-pd-plus="P7-film"]').isDisabled(), 'two-copy cap retained');
      assert.equal(await page.locator('[data-pd-add-slot]').count(), 0);
      await page.locator('[data-pd-minus="P7-film"]').click(); await page.locator('[data-pd-minus="P7-film"]').click();
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('.pd-editor')),true,'removing the last copy keeps focus in the editor');
      await page.locator('[data-pd-search]').fill(fixture.single.name); await page.locator(`[data-pd-add="${fixture.single.id}"]`).click();
      assert.match(await page.locator('[data-pd-count]').textContent(), /^19\/20/);
      assert.ok(await page.locator(`[data-pd-plus="${fixture.single.id}"]`).isDisabled(), 'single owned copy cannot be duplicated');
      assert.ok(await page.locator(`[data-pd-add="${fixture.single.id}"]`).isDisabled());
      await close(page); await inspect(page, fixture.empty);
      assert.equal(await page.locator('.pd-detail .pd-add-slot').count(),1); await page.locator('.pd-detail .pd-add-slot').click();
      assert.match(await page.locator('[data-pd-count]').textContent(), /^0\/20/); assert.equal(await page.locator('[data-pd-selected-grid] .pk-card').count(),0);
      await page.waitForFunction(() => document.querySelectorAll('.sheet').length === 1 && getComputedStyle(document.querySelector('.pd-editor').closest('.sheet')).opacity === '1');
      await page.screenshot({path:path.join(out,'empty-deck-390.png')}); await close(page);
      await inspect(page,'rental'); assert.equal(await page.locator('[data-pd-edit], [data-pd-move]').count(),0,'rental stays fixed'); await close(page);
      assert.equal(await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine().o)),fixture.collection,'deck editing never grants or spends collection cards');
      await edit(page,fixture.id);
    }
    await page.evaluate(async () => { const data = await import('/js/core/data.js'); data.setMe('mason'); });
    await page.waitForFunction(() => !document.querySelector('.pd-editor,.pocket-deck-sheet,.pocket-decks'));
    assert.deepEqual(errors,[], 'unexpected browser exceptions');
    console.log('PASS visual deck cards, duplicate badges, editing and profile exit: ' + profile.key + (full ? ' (phone/tablet, touch/keyboard, limits, saved order and cancellation)' : ''));
  } finally { await context.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); let browser;
  try { browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined)});
    const url = 'http://127.0.0.1:' + server.address().port; for (let i=0;i<(detailsShot ? 1 : profiles.length);i++) await run(browser,url,profiles[i],i===0);
  } finally { if(browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
