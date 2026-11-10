// Real browser checks for saved song inclusion, tap-to-play, empty/small rotations and profile boundaries.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..'), shots = path.join(root, 'output/rivals-jukebox');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length':bytes.length}).end(bytes);
  });
});
const profiles = [{me:'evan', key:'m_evan'}, {me:'jayton', key:'m_jayton'}, {me:'none', guest:'Ryan Stewart', key:'u_ryan-stewart'}, {me:'none', guest:'Ryan Younggreen', key:'u_ryan-younggreen'}];
async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  fs.mkdirSync(shots, {recursive:true});
  try {
    for (const [index, profile] of profiles.entries()) {
      const ctx = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block', reducedMotion:'reduce'});
      await ctx.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
      await ctx.addInitScript(p => {
        if (!localStorage.getItem('gg-me')) { localStorage.setItem('gg-me',p.me); if (p.guest) localStorage.setItem('gg-guest',p.guest); }
        localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
        for (const key of ['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen']) localStorage.setItem('gg-release-3.0:'+key,'1');
        localStorage.setItem('gg-rivals-sfx:'+p.key+':v1', JSON.stringify({enabled:false}));
        const Native = window.Audio; window.mediaProbes = [];
        window.Audio = class extends Native { constructor(...a) { super(...a); mediaProbes.push(this); } };
      }, profile);
      const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
      const state = () => page.evaluate(async () => (await import('/js/core/dynasty-music.js')).state());
      const play = () => page.waitForFunction(async () => { const s = (await import('/js/core/dynasty-music.js')).state(); return s.playing && s.duration > 0; });
      // (the media element itself loaded: a tap reloads it, and the module's state can still be the song before for a moment)
      const loaded = () => page.waitForFunction(() => mediaProbes[0] && mediaProbes[0].readyState >= 1 && Number.isFinite(mediaProbes[0].duration) && !mediaProbes[0].paused);
      const settings = async () => {
        await page.locator('.pk-hdr [data-dy-menu]').click(); await page.locator('[data-dy-m="music"]').click();
        await page.waitForSelector('.pk-jukebox-sheet');
      };
      const close = async () => { await page.locator('.sheet-close').last().click(); await page.waitForFunction(() => !document.querySelector('.sheet')); };
      const enter = async () => {
        await page.waitForFunction(() => window.__ggBooted);
        await page.evaluate(async () => {
          const D = await import('/js/core/dynasty.js'); await D.load();
          D.finishTutorial('skipped',(await import('/js/core/realm-active.js')).profileKey());
          (await import('/js/app.js')).nav('/puzzles/dynasty');
        });
        await page.waitForSelector('.pk-start.is-ready'); await page.locator('.pk-start').click({position:{x:170,y:420}});
        await settings();
      };
      await page.goto(url+'/#/puzzles'); await enter();
      const gameBefore = await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine()));
      const tracks = await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).TRACKS.map(t => t.id));
      assert.equal(await page.locator('[data-dy-song-enabled]:checked').count(), tracks.length, 'old preferences default to all songs');
      await page.locator('[data-dy-music-track="sundress"]').click(); await play();
      await page.locator('[data-dy-song-enabled="lost"]').uncheck();
      assert.equal((await state()).track.id, 'sundress', 'checkbox does not start the clicked song');
      await page.locator('[data-dy-song-enabled="sundress"]').uncheck(); await play();
      assert(!['sundress','lost'].includes((await state()).track.id), 'disabling current track advances to an included song');
      const savedKey = 'gg-rivals-music:'+profile.key+':v1';
      assert.deepEqual((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), savedKey)).excluded.sort(), ['lost','sundress']);
      await page.reload(); await enter();
      assert.equal(await page.locator('[data-dy-song-enabled="sundress"]').isChecked(), false);
      assert.equal(await page.locator('[data-dy-song-enabled="lost"]').isChecked(), false);
      assert(!['sundress','lost'].includes((await state()).track.id), 'reload deals only enabled songs');
      await page.locator('[data-dy-music-track="sundress"]').click(); await play();
      assert.equal(await page.locator('[data-dy-song-enabled="sundress"]').isChecked(), true, 'tap enables and plays the excluded song');
      assert.equal((await state()).track.id,'sundress');
      await page.evaluate(async on => (await import('/js/core/dynasty-music.js')).setPlaylistEnabled('songs', on), false);
      await page.waitForFunction(async () => { const s = (await import('/js/core/dynasty-music.js')).state(); return s.empty && !s.playing && mediaProbes.every(m => m.paused); });
      assert.equal(await page.locator('[data-dy-song-enabled]:checked').count(),0);
      assert.match(await page.locator('[data-dy-music-status]').innerText(),/No songs enabled/);
      await page.reload(); await enter();
      assert.equal((await state()).empty,true,'empty rotation survives reload');
      assert.equal(await page.evaluate(() => mediaProbes.length),0,'empty rotation never requests audio');
      await page.locator('[data-dy-music-track="lost"]').click(); await play();
      assert.equal((await state()).track.id,'lost');
      assert.equal(await page.locator('[data-dy-song-enabled]:checked').count(),1);
      assert.equal(await page.evaluate(() => mediaProbes[0].loop),true,'one song repeats');
      await page.locator('[data-dy-song-enabled="sundress"]').focus(); await page.keyboard.press('Space');
      assert.equal((await state()).track.id,'lost','keyboard toggle does not play the row');
      assert.equal(await page.evaluate(() => mediaProbes[0].loop),false,'adding a second song stops single-song looping');
      // End-to-end: an actual media end and then repeated skips must never pick a disabled song.
      await loaded(); await page.evaluate(() => { mediaProbes[0].currentTime = mediaProbes[0].duration - .2; });
      await page.waitForFunction(async () => (await import('/js/core/dynasty-music.js')).state().track.id === 'sundress'); await play();
      const sequence = await page.evaluate(async () => {
        const m = await import('/js/core/dynasty-music.js'); m.setEnabled(false);
        const out = [];
        for (let i=0;i<10;i++) { m.skipTrack(); out.push(m.state().track.id); }
        return out;
      });
      sequence.forEach((id, i) => { assert(['sundress','lost'].includes(id)); if(i) assert.notEqual(id,sequence[i-1],'two songs alternate even after shuffle history is exhausted'); });
      if (index === 0) {
        // Sundress has a damaged final MP3 frame on some decoders. A one-song rotation must recover and repeat.
        await page.evaluate(async on => (await import('/js/core/dynasty-music.js')).setPlaylistEnabled('songs', on), false);
        await page.locator('[data-dy-music-track="sundress"]').click(); await play();
        await loaded(); await page.evaluate(() => { mediaProbes[0].currentTime = mediaProbes[0].duration - .15; });
        await page.waitForFunction(async () => { const s = (await import('/js/core/dynasty-music.js')).state(); return s.playing && s.position < 3 && !s.failure; });
        // Cross-tab preferences remove the active song without forcing the tab's selected track.
        await page.evaluate(async key => {
          const m = await import('/js/core/dynasty-music.js'); m.setEnabled(true);
          const s = JSON.parse(localStorage.getItem(key)); s.excluded = m.TRACKS.filter(t => t.id !== 'lost').map(t => t.id);
          localStorage.setItem(key,JSON.stringify(s)); dispatchEvent(new StorageEvent('storage',{key}));
        }, savedKey);
        await play(); assert.equal((await state()).track.id,'lost');
        await page.evaluate(async on => (await import('/js/core/dynasty-music.js')).setPlaylistEnabled('songs', on), true);
        await page.locator('[data-dy-music-track="sundress"]').click(); await play();
        for (const [width,height] of [[320,568],[390,844],[768,1024],[844,390]]) {
          await page.setViewportSize({width,height});
          await page.locator('.pk-juke-brand').scrollIntoViewIfNeeded();
          await page.locator('.pk-juke ul').first().evaluate(el => el.scrollTop=0);
          await page.screenshot({path:path.join(shots,`jukebox-${width}.png`)});
          const overflow = await page.locator('.sheet-body').evaluate(el => el.scrollWidth > el.clientWidth+1);
          assert.equal(overflow,false,'no horizontal overflow at '+width);
          for (const selector of ['[data-dy-music-toggle]',`[data-dy-song-enabled="${tracks.at(-1)}"]`,`[data-dy-music-track="${tracks.at(-1)}"]`]) {
            await page.locator(selector).scrollIntoViewIfNeeded();
            const b = await page.locator(selector).boundingBox();
            assert(b.x>=0 && b.x+b.width<=width+1 && b.y>=0 && b.y+b.height<=height+1, 'reachable at '+width+': '+selector);
          }
        }
        await page.setViewportSize({width:390,height:844});
        await close();
        const mid = await page.evaluate(async () => {
          const S = await import('/js/core/dynasty-solo.js'); const r = S.start('g1'); if (!r.ok) throw Error(r.why); return r.mid;
        });
        await page.evaluate(async mid => (await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+mid),mid); await play();
        await page.locator('[data-rp-menu]').click(); await page.locator('[data-rp-settings]').click();
        await page.locator('.pk-juke-battle summary').click();
        await page.locator('[data-dy-battle-track="green-hill"]').click(); await play();
        assert.equal((await state()).track.song,'green-hill'); assert((await state()).position<3,'direct battle selection begins at the start');
        await page.locator('[data-dy-song-enabled="green-hill"]').uncheck(); await play();
        assert.notEqual((await state()).track.song,'green-hill');
        await page.locator('[data-dy-juke-none="battle"]').click();
        assert.equal((await state()).empty,true);
        await page.locator('[data-dy-battle-track="green-hill"]').click(); await play();
        assert.equal((await state()).track.song,'green-hill');
        await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).skipTrack()); await play();
        assert.equal((await state()).track.song,'green-hill','one battle theme survives Skip');
        await close(); await page.goBack(); await page.waitForSelector('.pk-hdr'); await settings();
      }
      await page.evaluate(async on => (await import('/js/core/dynasty-music.js')).setPlaylistEnabled('songs', on), false);
      const ownerPrefs = await page.evaluate(key => localStorage.getItem(key),savedKey);
      const gameAfter = await page.evaluate(async () => JSON.stringify((await import('/js/core/dynasty.js')).mine()));
      if (index > 0) assert.equal(gameAfter,gameBefore,'jukebox leaves collection, balances and saved matches unchanged');
      await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
      await page.waitForFunction(() => !document.querySelector('.pk-jukebox-sheet'));
      assert.equal(await page.evaluate(() => mediaProbes.every(m => m.paused)),true,'profile change halts immediately');
      await page.evaluate(async () => {
        const m = await import('/js/core/dynasty-music.js'); m.setPlaylistEnabled('songs',false); m.selectTrack('lost');
        (await import('/js/views/dynasty-music.js')).musicSheet();
      });
      assert.equal(await page.locator('.pk-jukebox-sheet').count(),0);
      assert.equal(await page.evaluate(() => localStorage.getItem('gg-rivals-music:m_mason:v1')),null);
      assert.equal(await page.evaluate(key => localStorage.getItem(key),savedKey),ownerPrefs);
      assert.deepEqual(errors,[]); await ctx.close();
      console.log('PASS jukebox '+profile.key+': toggles, tap-to-play, save/reload, zero/one/two songs, end/skip, keyboard and profile boundaries');
    }
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode=1; }).finally(() => server.close());
