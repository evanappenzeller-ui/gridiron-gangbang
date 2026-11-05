// Real Web Audio output and route/profile lifecycle, entirely offline with Firebase disabled.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
const KEY = 'gg-rivals-music:m_evan:v1';
async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await context.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
    await context.addInitScript(() => {
      if (!localStorage.getItem('gg-me')) localStorage.setItem('gg-me', 'evan');
      localStorage.setItem('gg-welcome', '1'); sessionStorage.setItem('gg-skip-title', '1');
      ['evan','mason','user%3Aryan-stewart','visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      window.audioProbes = [];
      const AC = window.AudioContext;
      window.AudioContext = class extends AC {
        constructor(...args) {
          super(...args);
          const analyser = this.createAnalyser(); analyser.fftSize = 2048;
          const create = this.createDynamicsCompressor.bind(this);
          this.createDynamicsCompressor = () => {
            const node = create(), connect = node.connect.bind(node);
            node.connect = to => { const result = connect(to); if (to === this.destination) connect(analyser); return result; };
            return node;
          };
          window.audioProbes.push({ctx: this, analyser});
        }
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    const nav = route => page.evaluate(async route => (await import('/js/app.js')).nav(route), route);
    const state = () => page.evaluate(async () => (await import('/js/core/dynasty-music.js')).state());
    const playing = () => page.waitForFunction(async () => (await import('/js/core/dynasty-music.js')).state().playing);
    const silent = () => page.waitForFunction(() => audioProbes.every(p => p.ctx.state !== 'running'));
    const close = async () => { await page.locator('.sheet-close').last().click(); await page.waitForFunction(() => !document.querySelector('.sheet')); };
    const settings = async () => {
      await page.locator('.pk-hdr [data-dy-menu]').click();
      await page.locator('[data-dy-m="music"]').click();
      await page.waitForSelector('[data-dy-music-toggle]');
    };
    await page.goto(url + '/#/puzzles'); await page.waitForFunction(() => window.__ggBooted);
    assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false);
    await nav('/puzzles/dynasty'); await page.waitForSelector('.pk-start.is-ready');
    assert.equal(await page.evaluate(() => audioProbes.length), 0, 'no audio context or autoplay before interaction');
    await page.locator('.pk-start').focus(); await page.keyboard.press('Enter'); await playing();
    await page.waitForFunction(() => audioProbes.some(p => {
      const samples = new Float32Array(p.analyser.fftSize); p.analyser.getFloatTimeDomainData(samples);
      return samples.some(n => Math.abs(n) > .0001);
    }));
    console.log('PASS: keyboard start produces actual non-silent Web Audio output');
    await settings();
    await page.locator('[data-dy-music-volume]').fill('62');
    assert.equal((await state()).volume, 62);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({width, height: 844});
      const fits = await page.locator('.pk-music').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
      assert(fits, `settings fit at ${width}px`);
    }
    await page.setViewportSize({width: 390, height: 844});
    fs.mkdirSync(path.join(root, 'output/rivals-music'), {recursive: true});
    await page.screenshot({path: path.join(root, 'output/rivals-music/settings-390.png')});
    await page.locator('[data-dy-music-toggle]').click(); await silent();
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY), {enabled: false, volume: 62});
    await page.reload(); await page.waitForFunction(() => window.__ggBooted); await page.waitForSelector('.pk-start.is-ready');
    await page.locator('.pk-start').click({position: {x: 170, y: 420}});
    assert.equal(await page.evaluate(() => audioProbes.length), 0, 'saved mute prevents context creation');
    await settings(); assert.equal(await page.locator('[data-dy-music-volume]').inputValue(), '62');
    await page.locator('[data-dy-music-toggle]').click(); await playing();
    await page.locator('[data-dy-music-volume]').fill('0'); await silent();
    await page.locator('[data-dy-music-volume]').fill('35'); await playing();
    // Rapid settings changes exercise overlapping suspend/resume promises.
    await page.evaluate(async () => { const m = await import('/js/core/dynasty-music.js'); for (let i = 0; i < 6; i++) { m.setEnabled(false); m.setEnabled(true); } });
    await playing();
    await close();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable: true, value: true}); document.dispatchEvent(new Event('visibilitychange')); });
    await silent();
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }); await playing();
    await page.evaluate(() => dispatchEvent(new Event('pagehide'))); await silent();
    await page.evaluate(() => dispatchEvent(new Event('pageshow'))); await playing();
    await page.locator('.pk-nav [data-dy-tab="packs"]').click(); await playing();
    assert.equal(await page.evaluate(() => audioProbes.length), 1, 'pane changes reuse a single audio context');
    console.log('PASS: saved mute/volume, rapid toggles, zero volume, phone/tablet fit, background and page lifecycle');
    const mid = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), B = await import('/js/core/dynasty-battle.js'), S = await import('/js/core/dynasty-solo.js');
      const s = D.mine(); D.CARDS.forEach(c => s.o[c.id] = 2); Object.keys(B.TRAINERS).forEach(id => s.o[id] = 2);
      s.dk = D.autoDeck(s.o); D.touch(); const r = S.start('g1'); if (!r.ok) throw Error(r.why); return r.mid;
    });
    await nav('/puzzles/dynasty/battle/' + mid); await playing();
    await page.waitForFunction(() => !document.querySelector('[data-db-skip]'), null, {timeout: 15000});
    await page.locator('[data-db-more]').click(); await page.getByRole('button', {name: 'Music', exact: true}).click();
    await page.waitForSelector('[data-dy-music-toggle]'); await close();
    await page.goBack(); await page.waitForSelector('.pk-hdr'); await playing();
    assert.equal(await page.evaluate(() => audioProbes.length), 1, 'hub/battle/back share transport');
    await nav('/puzzles'); await silent();
    assert.equal((await state()).playing, false);
    await nav('/puzzles/dynasty');
    if (await page.locator('.pk-start').count()) await page.locator('.pk-start').click({position: {x: 170, y: 420}});
    await settings(); await playing();
    await page.evaluate(async () => (await import('/js/core/data.js')).setGuest('Ryan Stewart'));
    await silent(); await page.waitForFunction(() => !document.querySelector('[data-dy-music-toggle]'));
    await page.evaluate(async () => { const m = await import('/js/core/dynasty-music.js'); m.setEnabled(true); m.start(); });
    await silent();
    console.log('PASS: battle menu, route/back/exit, one transport, immediate profile-switch silence');
    assert.deepEqual(errors, []);
    await context.close();
    // Fresh non-owner sessions never create audio or expose its new settings, even with an owner-like guest name.
    for (const profile of [{me:'none',guest:'Ryan Stewart'}, {me:'mason'}, {me:'none'}, {me:'none',guest:'Evan Appenzeller'}]) {
      const ctx = await browser.newContext({serviceWorkers:'block', reducedMotion:'reduce'});
      await ctx.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
      await ctx.addInitScript(p => {
        localStorage.setItem('gg-me', p.me); if (p.guest) localStorage.setItem('gg-guest', p.guest);
        localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
        ['mason','user%3Aryan-stewart','visitor'].forEach(k => localStorage.setItem('gg-release-3.0:'+k,'1'));
        window.audioCount = 0; const AC = window.AudioContext;
        window.AudioContext = class extends AC { constructor(...args) { super(...args); window.audioCount++; } };
      }, profile);
      const p = await ctx.newPage(); await p.goto(url+'/#/puzzles'); await p.waitForFunction(() => window.__ggBooted);
      await p.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
      if (await p.locator('.pk-start').count()) { await p.waitForSelector('.pk-start.is-ready'); await p.locator('.pk-start').click({position:{x:170,y:420}}); await p.locator('.pk-hdr [data-dy-menu]').click(); }
      assert.equal(await p.locator('[data-dy-m="music"], .pk-music').count(), 0);
      await p.evaluate(async () => { const m = await import('/js/core/dynasty-music.js'); m.start(); m.setVolume(100); (await import('/js/views/dynasty-music.js')).musicSheet(); });
      assert.equal(await p.evaluate(() => audioCount), 0); assert.equal(await p.locator('.pk-music').count(), 0);
      await ctx.close();
    }
    console.log('PASS: Ryan Stewart, another member, visitor and owner-name guest retain existing silent behavior');
    for (const mode of ['unavailable', 'blocked-resume', 'storage-denied', 'webkit']) {
      const ctx = await browser.newContext({serviceWorkers:'block', reducedMotion:'reduce'});
      await ctx.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
      await ctx.addInitScript(mode => {
        localStorage.setItem('gg-me','evan'); localStorage.setItem('gg-welcome','1');
        localStorage.setItem('gg-release-3.0:evan','1'); sessionStorage.setItem('gg-skip-title','1');
        localStorage.setItem('gg-rivals-music:m_evan:v1', '{broken');
        if (mode === 'unavailable') { window.AudioContext = undefined; window.webkitAudioContext = undefined; }
        if (mode === 'blocked-resume') {
          const AC = window.AudioContext;
          window.AudioContext = class extends AC { constructor() { super(); this.suspend(); } resume() { return Promise.reject(new Error('Playback blocked')); } };
        }
        if (mode === 'webkit') { window.webkitAudioContext = window.AudioContext; window.AudioContext = undefined; }
        if (mode === 'storage-denied') {
          const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
          Storage.prototype.getItem = function(key) { if (key.startsWith('gg-rivals-music:')) throw Error('Storage denied'); return get.call(this,key); };
          Storage.prototype.setItem = function(key,value) { if (key.startsWith('gg-rivals-music:')) throw Error('Storage denied'); return set.call(this,key,value); };
        }
      }, mode);
      const p = await ctx.newPage(), failures = []; p.on('pageerror', e => failures.push(String(e)));
      await p.goto(url+'/#/puzzles'); await p.waitForFunction(() => window.__ggBooted);
      await p.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
      await p.waitForSelector('.pk-start.is-ready'); await p.locator('.pk-start').click({position:{x:170,y:420}});
      await p.locator('.pk-hdr [data-dy-menu]').click(); await p.locator('[data-dy-m="music"]').click();
      await p.waitForSelector('[data-dy-music-toggle]');
      assert.equal(await p.locator('[data-dy-music-volume]').inputValue(), '35', mode + ': safe default');
      if (mode === 'unavailable') assert.equal(await p.locator('[data-dy-music-toggle]').isDisabled(), true);
      else if (mode === 'blocked-resume') assert.match(await p.locator('[data-dy-music-status]').innerText(), /try playback again/);
      else await p.waitForFunction(async () => (await import('/js/core/dynasty-music.js')).state().playing);
      assert.deepEqual(failures, [], mode + ': gameplay survives audio/storage failure'); await ctx.close();
    }
    console.log('PASS: missing audio API, blocked playback, malformed/denied storage and WebKit API fallback');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());
