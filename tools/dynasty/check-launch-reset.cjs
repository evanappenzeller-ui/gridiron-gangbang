// Gridiron Rivals launch (Nov 10 2026): everyone plays, the preview's progress is reset and its case leads the shelf
// with NEW. Local server only; no live reads or writes. Optional --shots writes the shelf to output/rivals-launch-*.png.
//   CHROMIUM_PATH=/path/to/chrome node tools/dynasty/check-launch-reset.cjs [--shots]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const shots = process.argv.includes('--shots');
const mime = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => {
    if (err) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
const pw = require('playwright');
const PREVIEW = {v:1, rs:'gridiron-hub-v3', born:1762000000000, at:1762700000000, sp:4000, cr:900, o:{'I-recruit':2}, pk:{prem:7, std:3}, cl:{}, dk:[],
  kit:1, kit2:1, kit3:1, kit4:1, pp:55, dd:'2026-11-09', rec:{w:9, l:2, d:0}, tr:37, bt:{}, so:{g1:1, g2:1, g3:1}, sl:[], nm:'Preview Kings', lp:[], nw:[],
  tutorial:{v:1, result:'completed'}};
const SOLO = {id:'cpu-preview', opp:'g4', seed:'preview', v:7, decks:[[], []], log:[], at:1762700000000};

async function shelf(page, who) {
  await page.evaluate(async who => {
    const data = await import('/js/core/data.js');
    if (who.me) data.setMe(who.me); else { data.setMe(null); data.setGuest(who.guest); }
  }, who);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__ggBooted);
  await page.locator('.gm-shelf .gm-case[data-gm="dynasty"]').first().waitFor({state:'attached'});
  await page.waitForTimeout(1500); // (the shelf settles on its starting case)
  return page.evaluate(() => {
    const shelf = document.querySelector('.gm-shelf'), r = shelf.getBoundingClientRect(), mid = r.left + r.width / 2;
    const near = [...shelf.querySelectorAll('.gm-slot')].map(s => ({s, d: Math.abs(s.getBoundingClientRect().left + s.getBoundingClientRect().width / 2 - mid)})).sort((a, b) => a.d - b.d)[0].s;
    const tag = near.querySelector('.gm-front .gm-band .gm-new');
    const box = tag && tag.getBoundingClientRect(), band = near.querySelector('.gm-front .gm-band').getBoundingClientRect();
    return {front: near.dataset.gmSlot, tag: tag ? tag.textContent : '', label: near.querySelector('.gm-case').getAttribute('aria-label'),
      disabled: near.querySelector('.gm-case').getAttribute('aria-disabled'), sticker: !!near.querySelector('.gm-stk'),
      inBand: !!box && box.width > 0 && box.top >= band.top - 1 && box.bottom <= band.bottom + 1};
  });
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await pw.chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
    const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor: shots ? 2 : 1, serviceWorkers:'block', reducedMotion:'reduce'});
    await context.route('**/*', r => new URL(r.request().url()).origin === url ? r.continue() : r.abort());
    await context.addInitScript(({PREVIEW, SOLO}) => {
      if (!localStorage.getItem('gg-check-seeded')) {
        localStorage.setItem('gg-check-seeded', '1');
        localStorage.setItem('gg-me', 'evan');
        ['m_evan', 'm_jayton', 'u_ryan-stewart', 'u_ryan-younggreen'].forEach(k => {
          localStorage.setItem('gg-dy1-' + k, JSON.stringify({...PREVIEW, nm: 'Preview ' + k}));
          localStorage.setItem('gg-dys-' + k, JSON.stringify(SOLO));
        });
      }
      localStorage.setItem('gg-welcome', '1'); sessionStorage.setItem('gg-skip-title', '1');
      ['evan', 'jayton', 'mason', 'visitor', 'user%3Aryan-stewart', 'user%3Aryan-younggreen', 'Pat'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
    }, {PREVIEW, SOLO});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);

    const reset = await page.evaluate(async ({PREVIEW, SOLO}) => {
      const data = await import('/js/core/data.js'), D = await import('/js/core/dynasty.js'), S = await import('/js/core/dynasty-solo.js');
      const daily = await import('/js/core/daily.js'), fire = await import('/js/core/fire.js');
      const out = [], ok = (v, msg) => { if (!v) throw Error(msg); out.push(msg); };
      ok(!fire.canWrite(), 'Live writes are disabled');
      await D.load();
      const profiles = [{me:'evan', key:'m_evan'}, {me:'jayton', key:'m_jayton'}, {guest:'Ryan Stewart', key:'u_ryan-stewart'}, {guest:'Ryan Younggreen', key:'u_ryan-younggreen'}];
      const docs = profiles.map(p => ({id:'phone-' + p.key, nick:p.key, total:0, dy1:{[p.key]: {...PREVIEW, at: Date.now() + 60000}}}));
      const puts = [];
      Object.assign(daily.LB, {ready:true, synced:true, off:false, uid:'phone-m_evan', raw:docs, all:docs, put:async (b, f) => { puts.push({b, f}); }});
      for (const p of profiles) {
        if (p.me) data.setMe(p.me); else { data.setMe(null); data.setGuest(p.guest); }
        daily.LB.uid = 'phone-' + p.key;
        const s = D.mine();
        ok(D.mayPlay() && s.tr === 0 && !Object.keys(s.so).length && s.rec.w === 0 && !s.tutorial && s.nm === '' && s.pk.start === 1 && s.sp === 0 && s.cr === 0,
          p.key + ': preview progress (cloud and phone) is not loaded; a fresh save with the Starter Pack');
        ok(D.tutorialDue(), p.key + ': the first-play tutorial runs again');
        ok(!S.current() && !S.get(), p.key + ': the preview’s Solo battle is not resumed');
        puts.length = 0; D.touch(); ok(await D.flush(), p.key + ': saves');
        const {b, f} = puts[0];
        ok(b.dy2 && b.dy2[p.key] && !('dy1' in b) && f.every(x => !x.startsWith('dy1')), p.key + ': writes only dy2, leaving the preview’s dy1 untouched');
        ok(localStorage.getItem('gg-dy1-' + p.key).includes('"tr":37') && localStorage.getItem('gg-dys-' + p.key) === JSON.stringify(SOLO), p.key + ': the phone’s preview copies stay archived');
        ok(JSON.parse(localStorage.getItem('gg-dy2-' + p.key)).tr === 0, p.key + ': the fresh save is kept locally under gg-dy2');
      }
      ok(!D.others(docs).length, 'Preview saves never show as opponents');
      const now = [{id:'x', nick:'x', dy2:{m_mason: D.fresh('m_mason')}}];
      data.setMe('evan');
      ok(D.others(now).some(o => o.key === 'm_mason'), 'A new player (Mason) shows to everyone');
      data.setMe('mason');
      ok(D.mayPlay() && D.mine().tr === 0 && D.tableOpen(), 'Mason (never in the preview) plays');
      data.setMe(null); data.setGuest('Pat');
      ok(D.mayPlay(), 'A named guest plays');
      data.setGuest(null);
      ok(!D.mayPlay(), 'A phone that hasn’t said who it is waits for a profile');
      data.setMe('evan');
      ok(D.unlimited() && !D.unlimitedCoins(), 'Evan keeps unlimited packs (an individual privilege)');
      return out;
    }, {PREVIEW, SOLO});
    reset.forEach(r => console.log('PASS: ' + r));

    for (const who of [{me:'mason'}, {me:'evan'}, {guest:'Pat'}, {guest:'Ryan Stewart'}]) {
      const s = await shelf(page, who), name = who.me || who.guest;
      assert.equal(s.front, 'dynasty', name + ': Rivals is the front case');
      assert.equal(s.tag, 'NEW', name + ': NEW on its band');
      assert.ok(s.inBand, name + ': the tag sits inside the top band');
      assert.equal(s.disabled, 'false', name + ': the case opens');
      assert.ok(!s.sticker, name + ': no Coming Soon sticker');
      assert.match(s.label, /Gridiron Rivals \(new\)/, name + ': accessible label');
      console.log(`PASS: ${name}: Rivals leads the shelf with NEW on its band`);
      if (shots) await page.screenshot({path: path.join(root, `output/rivals-launch-${String(name).replace(/\W+/g, '-').toLowerCase()}.png`)});
    }
    await page.locator('.gm-shelf .gm-case[data-gm="dynasty"]:not([tabindex="-1"])').click();
    await page.waitForTimeout(400);
    await page.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
    await page.locator('.pk-start').waitFor();
    console.log('PASS: Ryan Stewart opens Rivals to its title screen');
    assert.deepEqual(errors, [], 'No browser exceptions');
    await context.close();
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
