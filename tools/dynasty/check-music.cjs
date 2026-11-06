// Real Web Audio output and route/profile lifecycle, entirely offline with Firebase disabled.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (process.env.RIVALS_ASSET_ROOT && !fs.existsSync(file) && ['img','fonts','icons'].includes(path.relative(root,file).split(path.sep)[0])) file = path.join(process.env.RIVALS_ASSET_ROOT,path.relative(root,file));
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    const headers = {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length':bytes.length};
    if (file.endsWith('.mp3')) {
      headers['Accept-Ranges']='bytes';
      const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        const start=Number(range[1]),end=Math.min(bytes.length-1,range[2] ? Number(range[2]) : bytes.length-1);
        if (start>end) return res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`}).end();
        return res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${bytes.length}`}).end(bytes.subarray(start,end+1));
      }
    }
    res.writeHead(200, headers).end(bytes);
  });
});
const KEY = 'gg-rivals-music:m_evan:v1';
async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await context.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
    await context.addInitScript(() => {
      if (!localStorage.getItem('gg-me')) localStorage.setItem('gg-me', 'evan');
      localStorage.setItem('gg-welcome', '1'); sessionStorage.setItem('gg-skip-title', '1');
      ['evan','mason','user%3Aryan-stewart','visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      // Isolate music lifecycle assertions from independently controlled effects.
      localStorage.setItem('gg-rivals-sfx:m_evan:v1', JSON.stringify({enabled:false,volume:55}));
      window.audioProbes = [];
      Object.defineProperty(navigator, 'audioSession', {configurable: true, value: {type: 'ambient'}});
      window.mediaHandlers = {};
      const setHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (action, fn) => { mediaHandlers[action] = fn; return setHandler(action, fn); };
      window.mediaProbes = []; const OriginalAudio = window.Audio;
      window.Audio = class extends OriginalAudio { constructor(...args) { super(...args); window.mediaProbes.push(this); } };
      const AC = window.AudioContext;
      window.AudioContext = class extends AC {
        constructor(...args) {
          super(...args);
          const analyser = this.createAnalyser(); analyser.fftSize = 2048;
          const create = this.createGain.bind(this);
          this.createGain = () => {
            const node = create(), connect = node.connect.bind(node);
            node.connect = to => {
              const result = connect(to);
              if (to === this.destination) { connect(analyser); window.musicGain = node; }
              if (to === window.musicGain) window.sceneGain = node;
              return result;
            };
            return node;
          };
          window.audioProbes.push({ctx: this, analyser});
        }
      };
    });
    const page = await context.newPage(), errors = [], trackRequests = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', r => { if (/\.mp3$/.test(r.url())) trackRequests.push(r.url()); });
    const nav = route => page.evaluate(async route => (await import('/js/app.js')).nav(route), route);
    const state = () => page.evaluate(async () => (await import('/js/core/dynasty-music.js')).state());
    const upNext = () => page.evaluate(async () => (await import('/js/core/dynasty-music.js')).upNext());
    const part = n => new RegExp(`cyber-funkwave-v1-${String(n + 1).padStart(2, '0')}\\.mp3$`);
    const playing = () => page.waitForFunction(async () => (await import('/js/core/dynasty-music.js')).state().playing);
    const silent = () => page.waitForFunction(() => audioProbes.every(p => p.ctx.state !== 'running') && mediaProbes.every(m => m.paused));
    const watchFade = () => page.evaluate(() => {
      window.fadeSamples = [];
      window.fadeTimer = setInterval(() => {
        if (!mediaProbes[0].paused && mediaProbes[0].readyState >= 3) fadeSamples.push(sceneGain.gain.value);
      }, 30);
    });
    const checkFade = async () => {
      await page.waitForFunction(() => {
        const quiet = fadeSamples.findIndex(v => v < .2);
        const rising = fadeSamples.findIndex((v, i) => i > quiet && v > .3 && v < .7);
        return quiet >= 0 && rising > quiet && fadeSamples.slice(rising).includes(1);
      }, null, {timeout: 8000});
      await page.evaluate(() => clearInterval(fadeTimer));
    };
    const level = async value => {
      await page.evaluate(async () => { window.soundTest = await import('/js/core/dynasty-music.js'); });
      await page.waitForFunction(value => soundTest.state().volume === value, value, {timeout:3000});
    };
    const touch = await context.newCDPSession(page);
    const holdVolume = async selector => {
      const box = await page.locator(selector).boundingBox();
      const point = {x:box.x + box.width / 2, y:box.y + box.height / 2};
      const send = (type, p = point) => touch.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{...p, id:1}]});
      await send('touchStart');
      assert.equal(await page.locator('.pk-sound-level:visible').count(), 0, 'bar stays hidden on initial press');
      await page.waitForSelector('.pk-sound-level:visible');
      return {point, send};
    };
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
    assert.equal(trackRequests.length, 0, 'no MP3 download before interaction');
    await page.locator('[data-dy-music-menu]').click();
    // The jukebox is shuffled: the opening song is the first of a fresh pass over all 31 songs.
    const opening = (await state()).track, pass = [opening.id, ...(await upNext()).songs];
    assert.equal(new Set(pass).size, 31, 'a play-through holds every song once: ' + pass);
    assert.equal(await page.locator('.pk-mini-player:visible [data-mini-title]').innerText(), opening.title);
    assert.equal(await page.locator('.pk-mini-player:visible [data-mini-artist]').innerText(), opening.artist);
    assert.equal(trackRequests.length, 0, 'opening song controls does not start playback');
    await page.locator('[data-dy-music-menu]').click();
    assert.equal(await page.locator('.pk-mini-player:visible').count(), 0);
    await page.locator('[data-dy-sound]').click();
    assert.equal((await state()).enabled, false, 'corner mute saves the same preference as Settings');
    assert.equal(trackRequests.length, 0, 'muting on the title never briefly starts the track');
    assert.equal(await page.locator('.pk-start').count(), 1, 'speaker does not start the game');
    await page.locator('[data-dy-sound]').focus(); await page.keyboard.press('Enter'); await playing();
    assert.equal(await page.locator('[data-dy-sound]').getAttribute('aria-label'), 'Mute sound');
    await page.locator('.pk-start').focus(); await page.keyboard.press('Enter'); await playing();
    for (const [width, height] of [[320,568], [390,844], [768,1024], [1280,800]]) {
      await page.setViewportSize({width,height});
      const button = await page.locator('[data-dy-sound]').boundingBox();
      const chevron = await page.locator('[data-dy-music-menu]').boundingBox();
      assert(chevron.x >= 0 && chevron.x + chevron.width <= button.x, 'chevron sits beside speaker');
      assert(button.width >= 44 && button.height >= 44 && button.x >= 0 && button.x + button.width <= width);
      assert(button.y >= 0 && button.y + button.height <= height);
      for (const tab of await page.locator('.pk-nav button').all()) {
        const box = await tab.boundingBox();
        assert(box.x + box.width <= chevron.x, 'song controls clear bottom navigation');
      }
    }
    await page.setViewportSize({width:390,height:844});
    if (process.env.SOUND_SHOTS) { fs.mkdirSync(process.env.SOUND_SHOTS,{recursive:true}); await page.screenshot({path:path.join(process.env.SOUND_SHOTS,'hub.png')}); }
    await page.locator('[data-dy-sound]').click(); await silent();
    assert.equal(await page.locator('[data-dy-sound]').getAttribute('aria-label'), 'Unmute sound');
    await page.locator('[data-dy-sound]').focus(); await page.keyboard.press('Space'); await playing();
    await page.locator('[data-dy-music-menu]').focus(); await page.keyboard.press('Enter');
    await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).seek(30));
    const skipTo = (await upNext()).songs[0];
    await page.locator('.pk-mini-player [data-dy-music-skip]').click();
    assert((await state()).position < 2, 'skip starts the next song from its beginning');
    assert.equal((await state()).track.id, skipTo, 'skip moves to the next song in the shuffle');
    await page.waitForFunction(title => document.querySelector('.pk-mini-player [data-mini-title]')?.textContent === title, (await state()).track.title);
    await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).selectTrack('sundress'));
    assert.equal((await state()).track.id, 'sundress');
    assert.equal((await state()).volume, 8, 'skip preserves the quiet default');
    assert.equal(await page.locator('.pk-mini-player:visible').count(), 1, 'skip keeps panel open');
    for (const [width,height] of [[320,568],[390,844],[768,1024]]) {
      await page.setViewportSize({width,height});
      const panel = await page.locator('.pk-mini-player:visible').boundingBox();
      assert(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= width && panel.y + panel.height <= height);
      if (process.env.SOUND_SHOTS && width < 400) await page.screenshot({path:path.join(process.env.SOUND_SHOTS,`song-panel-${width}.png`)});
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-dy-music-skip]').focus(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.pk-mini-player:visible').count(), 0);
    assert.equal(await page.locator('[data-dy-music-menu]').evaluate(b => b === document.activeElement), true);
    await page.locator('[data-dy-music-menu]').click();
    // Exercise both drag directions away from the zero-volume boundary.
    await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).setVolume(35));
    const held = await holdVolume('[data-dy-sound]');
    assert.equal(await page.locator('.pk-mini-player:visible').count(), 0, 'volume gesture dismisses song panel');
    const initial = (await state()).volume;
    await held.send('touchMove', {x:held.point.x - 30, y:held.point.y});
    await level(initial - 20);
    assert.equal((await state()).volume, initial - 20, 'left drag lowers volume');
    await held.send('touchMove', {x:held.point.x, y:held.point.y});
    await level(initial);
    assert.equal((await state()).volume, initial, 'right drag raises volume');
    await held.send('touchMove', {x:held.point.x, y:held.point.y - 60});
    await level(initial + 40);
    assert.equal((await state()).volume, initial + 40, 'up drag raises volume');
    await held.send('touchMove', {x:held.point.x, y:held.point.y - 30});
    await level(initial + 20);
    assert.equal((await state()).volume, initial + 20, 'down drag lowers volume');
    if (process.env.SOUND_SHOTS) await page.screenshot({path:path.join(process.env.SOUND_SHOTS,'volume-held.png')});
    await held.send('touchEnd');
    assert.equal(await page.locator('.pk-sound-level:visible').count(), 0, 'release hides bar');
    assert.equal(await page.locator('[data-dy-sound]:visible').count(), 1, 'release keeps speaker');
    assert.equal((await state()).enabled, true, 'long press does not trigger mute on release');
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), KEY)).volume, initial + 20);
    await page.locator('[data-dy-sound]').focus(); await page.keyboard.down('ArrowDown');
    assert.equal(await page.locator('.pk-sound-level:visible').count(), 1, 'keyboard exposes volume bar');
    await page.keyboard.up('ArrowDown');
    assert.equal((await state()).volume, initial + 15);
    assert.equal(await page.locator('.pk-sound-level:visible').count(), 0);
    const cancel = await holdVolume('[data-dy-sound]'); await cancel.send('touchCancel');
    assert.equal(await page.locator('.pk-sound-level:visible').count(), 0, 'canceled touch closes bar');
    await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).setVolume(35));
    console.log('PASS: real touch hold, both drag axes, release, saved level, keyboard and touch cancellation');
    await page.waitForFunction(() => navigator.mediaSession.playbackState === 'playing');
    assert.equal(await page.evaluate(() => navigator.audioSession.type), 'playback');
    assert.deepEqual(await page.evaluate(() => ({title:navigator.mediaSession.metadata.title, artist:navigator.mediaSession.metadata.artist, state:navigator.mediaSession.playbackState})), {title:'Sundress',artist:'A$AP Rocky',state:'playing'});
    await page.waitForFunction(() => audioProbes.some(p => {
      const samples = new Float32Array(p.analyser.fftSize); p.analyser.getFloatTimeDomainData(samples);
      return samples.some(n => Math.abs(n) > .0001);
    }));
    const track = await page.evaluate(() => ({duration: mediaProbes[0].duration, loop: mediaProbes[0].loop, src: mediaProbes[0].currentSrc}));
    assert(track.duration > 158 && track.duration < 159, 'the supplied full-length MP3 decoded');
    assert.equal(track.loop, false); assert.match(track.src, /\/audio\/rivals\/sundress-v1\.mp3$/);
    // Picking Sundress started a new shuffle from it; its end plays the next song in that shuffle.
    const following = (await upNext()).songs[0];
    assert.notEqual(following, 'sundress');
    await page.evaluate(() => { mediaProbes[0].currentTime = mediaProbes[0].duration - .15; });
    await page.waitForFunction(id => mediaProbes[0].currentSrc.endsWith(`/audio/rivals/${id}-v1.mp3`) && !mediaProbes[0].paused && mediaProbes[0].currentTime < 5, following, {timeout: 15000});
    assert.equal((await state()).track.id, following);
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), KEY)).track, following, 'the playing song is saved');
    console.log('PASS: uploaded MP3 decodes, produces actual audio, and moves on to the next shuffled song at its end');
    // Never the same play-through twice: skip through several whole passes (muted, so nothing downloads), including with a
    // stubbed Math.random that would deal the same shuffle every time.
    const passes = await page.evaluate(async () => {
      const m = await import('/js/core/dynasty-music.js'); m.setEnabled(false);
      const run = () => { const out = []; for (let p = 0; p < 4; p++) { while (m.upNext().songs.length) m.skipTrack(); m.skipTrack(); out.push([m.state().track.id, ...m.upNext().songs]); } return out; };
      const real = run(); const random = Math.random; Math.random = () => .5;
      try { return {real, stubbed: run()}; } finally { Math.random = random; m.setEnabled(true); }
    });
    for (const list of [passes.real, passes.stubbed]) {
      assert.equal(new Set(list.map(p => p.join())).size, list.length, 'every play-through is a new order');
      list.forEach((p, i) => { assert.equal(new Set(p).size, 31); if (i) assert.notEqual(p[0], list[i - 1][30], 'a pass never opens with the song that just played'); });
    }
    const heard = await page.evaluate(() => JSON.parse(localStorage.getItem('gg-rivals-shuffle:m_evan:v1')));
    assert(heard.songs.length >= 9 && new Set(heard.songs).size === heard.songs.length, 'the profile remembers its recent play-throughs, all different');
    await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).selectTrack('sundress')); await playing();
    console.log('PASS: shuffled jukebox: every pass a new order, never opening with the last song, with or without real randomness');
    await settings();
    assert.equal(await page.getByRole('dialog', {name:'Settings',exact:true}).count(),1);
    assert.equal(await page.locator('[data-dy-music-title]').innerText(),'Sundress');
    assert.equal(await page.locator('[data-dy-music-artist]').innerText(),'A$AP Rocky');
    assert.equal(await page.locator('[data-dy-music-track="sundress"][aria-pressed="true"]').count(),1);
    assert.equal(await page.locator('.pk-music input[type="range"]').count(),2);
    await page.locator('[data-dy-music-seek]').fill('60');
    const sought = await state();
    assert(sought.position >= 59.9 && sought.position < 62, 'song-position slider seeks: ' + JSON.stringify(sought));
    await page.locator('[data-dy-music-seek]').focus(); await page.keyboard.press('ArrowRight');
    assert((await state()).position >= 60.9,'keyboard can scrub');
    await page.locator('[data-dy-music-restart]').click(); assert((await state()).position < 2,'restart returns to beginning');
    await page.evaluate(() => mediaHandlers.seekto({seekTime:75})); assert((await state()).position >= 75,'native seek works');
    await page.evaluate(() => mediaHandlers.pause()); await silent();
    assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState),'paused');
    await page.locator('[data-dy-music-seek]').fill('30'); await silent();
    assert.equal((await state()).enabled,false,'seeking while paused stays paused');
    await page.evaluate(() => mediaHandlers.play()); await playing();
    await page.locator('[data-dy-music-toggle]').click(); await silent();
    await page.locator('[data-dy-music-track="sundress"]').click(); await playing();
    assert.equal(await page.locator('[data-dy-music-track]').count(), 31, 'the menu jukebox lists the 31 songs, not the battle mix');
    await page.locator('[data-dy-music-track="lpfj2"]').click(); await playing();
    assert.match(await page.evaluate(() => mediaProbes[0].currentSrc), /\/audio\/rivals\/lpfj2-v1\.mp3$/);
    assert.equal(await page.locator('[data-dy-music-title]').innerText(), 'Lord Pretty Flacko Jodye 2');
    assert.equal(await page.evaluate(() => navigator.mediaSession.metadata.title), 'Lord Pretty Flacko Jodye 2');
    await page.locator('[data-dy-music-track="sundress"]').click(); await playing();
    assert.match(await page.evaluate(() => mediaProbes[0].currentSrc), /\/audio\/rivals\/sundress-v1\.mp3$/);
    console.log('PASS: named jukebox, track selection, seek/restart, native play/pause/seek and playback audio-session type');
    await page.locator('[data-dy-music-volume]').fill('62');
    assert.equal((await state()).volume, 62);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({width, height: 844});
      const box = await page.locator('.pk-music').evaluate(el => { const r = el.getBoundingClientRect(); return {fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, top: Math.round(r.top), bottom: Math.round(r.bottom), list: Math.round(el.querySelector('.pk-juke ul').getBoundingClientRect().height)}; });
      assert(box.fits, `settings fit at ${width}px: ` + JSON.stringify(box));
    }
    fs.mkdirSync(path.join(root, 'output/rivals-music'), {recursive: true});
    await page.setViewportSize({width:320,height:568});
    for (const selector of ['[data-dy-music-toggle]','[data-dy-music-seek]','[data-dy-music-volume]','[data-dy-music-track]','[data-dy-music-track]:last-of-type >> nth=-1']) {
      await page.locator(selector).first().scrollIntoViewIfNeeded();
      const r=await page.locator(selector).first().boundingBox(); assert(r.x>=0 && r.x+r.width<=321 && r.y>=0 && r.y+r.height<=569, 'compact phone can reach '+selector);
    }
    await page.screenshot({path:path.join(root,'output/rivals-music/settings-320.png')});
    await page.setViewportSize({width: 390, height: 844});
    await page.locator('.pk-juke-now').scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(root, 'output/rivals-music/settings-390.png')});
    await page.locator('[data-dy-music-toggle]').click(); await silent();
    const pausedAt = await page.evaluate(() => mediaProbes[0].currentTime);
    await page.waitForTimeout(250);
    assert(Math.abs(await page.evaluate(() => mediaProbes[0].currentTime) - pausedAt) < .02, 'mute pauses track position');
    await page.locator('[data-dy-music-toggle]').click(); await playing();
    assert(await page.evaluate(() => mediaProbes[0].currentTime) >= pausedAt - .05, 'unmute resumes from the paused position');
    await page.locator('[data-dy-music-toggle]').click(); await silent();
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY), {enabled: false, volume: 62, track:'sundress'});
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
    assert.equal(await page.evaluate(() => navigator.audioSession.type),'ambient','restore previous session type on hide');
    assert.equal(await page.evaluate(() => navigator.mediaSession.metadata),null,'release native controls on hide');
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
    // A battle starts the battle mix at a random spot: half way through the 38:45 mix is part 4, 276.5 s in.
    const hubAt = await page.evaluate(() => mediaProbes[0].currentTime);
    await page.evaluate(() => { window.realRandom = Math.random; Math.random = () => .5; });
    // Delay the incoming mix longer than its fade: the audible ramp must wait for playback.
    await page.route('**/cyber-funkwave-v1-04.mp3', async route => {
      await new Promise(resolve => setTimeout(resolve, 2300));
      await route.continue();
    }, {times: 1});
    await watchFade();
    await nav('/puzzles/dynasty/battle/' + mid); await playing();
    await checkFade();
    await page.evaluate(() => { Math.random = window.realRandom; });
    const mixAt = await page.evaluate(async () => { const s = (await import('/js/core/dynasty-music.js')).state(); return {src: mediaProbes[0].currentSrc, at: mediaProbes[0].currentTime, id: s.track.id, position: s.position, duration: s.duration, title: navigator.mediaSession.metadata.title}; });
    assert.match(mixAt.src, /\/audio\/rivals\/cyber-funkwave-v1-04\.mp3$/, 'battle plays the mix: ' + JSON.stringify(mixAt));
    assert(mixAt.at > 276 && mixAt.at < 290, 'the mix starts at the random spot: ' + JSON.stringify(mixAt));
    assert(Math.abs(mixAt.duration - 2324.9) < 1 && mixAt.position > 1162 && mixAt.id === 'battle' && mixAt.title === 'Cyber Funkwave', JSON.stringify(mixAt));
    // The mix plays at slider × .7 × its loudness level (-14.2 LUFS brought to -16).
    await page.waitForFunction(async () => { const v = (await import('/js/core/dynasty-music.js')).state().volume;
      return Math.abs(musicGain.gain.value - v / 100 * .7 * 10 ** ((-16 + 14.2) / 20)) < .002; });
    // The mix's parts are shuffled too: a pass from the part the battle started in, then the other six in a random order.
    const parts = (await upNext()).parts;
    assert.deepEqual([3, ...parts].slice().sort(), [0, 1, 2, 3, 4, 5, 6], 'a pass of the mix holds every part once: ' + parts);
    await page.evaluate(() => { mediaProbes[0].currentTime = mediaProbes[0].duration - .3; });
    await page.waitForFunction(re => new RegExp(re).test(mediaProbes[0].currentSrc) && mediaProbes[0].readyState >= 3 && !mediaProbes[0].paused && mediaProbes[0].currentTime < 5, part(parts[0]).source);
    // Seeking into another part starts a new shuffle from it; a part's end moves on in the shuffle.
    await page.evaluate(async () => (await import('/js/core/dynasty-music.js')).seek(2324.4));
    const afterLast = (await upNext()).parts[0];
    assert(Number.isInteger(afterLast) && afterLast !== 6, 'the part after the last one comes from the shuffle');
    await page.waitForFunction(re => new RegExp(re).test(mediaProbes[0].currentSrc) && !mediaProbes[0].paused && mediaProbes[0].currentTime < 5, part(afterLast).source);
    await playing();
    console.log('PASS: battle mix from a random spot, through its parts in a shuffled order');
    await page.waitForFunction(() => !document.querySelector('[data-db-skip]'), null, {timeout: 15000});
    const battleSound = page.locator('.v-dynasty-battle [data-dy-sound]');
    for (const [width,height] of [[320,568],[390,844],[768,1024]]) {
      await page.setViewportSize({width,height});
      const sound = await battleSound.boundingBox();
      const menu = await page.locator('.v-dynasty-battle [data-dy-music-menu]').boundingBox();
      assert(sound.y >= 0 && sound.y + sound.height <= height && sound.x + sound.width <= width);
      const bar = page.locator('.db-bar, .rp-bottom-actions');
      for (const action of await bar.locator('button').all()) {
        const b = await action.boundingBox();
        assert(!b || b.x + b.width <= menu.x || b.y + b.height <= sound.y || b.y >= sound.y + sound.height, 'sound does not cover battle actions');
      }
    }
    await page.setViewportSize({width:390,height:844});
    if (process.env.SOUND_SHOTS) await page.screenshot({path:path.join(process.env.SOUND_SHOTS,'battle.png')});
    await battleSound.click(); await silent();
    await page.locator('.v-dynasty-battle [data-dy-music-menu]').click();
    const skipPart = (await upNext()).parts[0];
    await page.locator('.v-dynasty-battle [data-dy-music-skip]').click();
    assert.equal((await state()).enabled, false, 'skip preserves mute');
    assert.match(await page.evaluate(() => mediaProbes[0].src), part(skipPart), 'skip in a battle moves on to the next part of the shuffle');
    assert.equal((await state()).track.id, 'battle');
    await page.locator('.db-match-title, .rp-top b').click();
    assert.equal(await page.locator('.pk-mini-player:visible').count(), 0, 'outside tap closes panel');
    await battleSound.click(); await playing();
    const battleHold = await holdVolume('.v-dynasty-battle [data-dy-sound]');
    await battleHold.send('touchMove', {x:battleHold.point.x, y:battleHold.point.y - 180});
    await level(100);
    assert.equal((await state()).volume, 100, 'volume clamps at 100');
    await battleHold.send('touchMove', {x:battleHold.point.x - 180, y:battleHold.point.y - 180});
    await level(0);
    assert.equal((await state()).volume, 0, 'volume clamps at zero');
    await battleHold.send('touchEnd'); await silent();
    await battleSound.click(); await playing();
    if(await page.locator('[data-rp-settings]').count()) await page.locator('[data-rp-settings]').click();
    else {await page.locator('[data-db-more]').click(); await page.getByRole('button', {name: 'Settings', exact: true}).click();}
    await page.waitForSelector('[data-dy-music-toggle]');
    assert.equal(await page.locator('[data-dy-music-track]').count(), 32, 'the battle jukebox heads with the mix');
    assert.equal(await page.locator('[data-dy-music-track="battle"][aria-pressed="true"]').count(), 1);
    assert.equal(await page.locator('[data-dy-music-title]').innerText(), 'Cyber Funkwave');
    await page.waitForTimeout(800); await page.screenshot({path: path.join(root, 'output/rivals-music/battle-settings-390.png')});
    const mixWas = await page.evaluate(() => ({src: mediaProbes[0].src, at: mediaProbes[0].currentTime}));
    await page.locator('[data-dy-music-track="troy"]').click(); await playing();
    assert.match(await page.evaluate(() => mediaProbes[0].currentSrc), /\/audio\/rivals\/troy-v1\.mp3$/, 'a song picked in battle plays');
    await page.locator('[data-dy-music-track="battle"]').click(); await playing();
    const mixNow = await page.evaluate(() => ({src: mediaProbes[0].src, at: mediaProbes[0].currentTime}));
    assert(mixNow.src === mixWas.src && mixNow.at >= mixWas.at - .5, 'and the mix comes back where it was: ' + JSON.stringify({mixWas, mixNow}));
    await page.locator('[data-dy-music-track="sundress"]').click(); await playing();
    assert(await page.evaluate(() => mediaProbes[0].currentTime) >= hubAt - .5, 'the menu song carries on from where the battle interrupted it');
    await close();
    await watchFade();
    await page.goBack(); await page.waitForSelector('.pk-hdr'); await playing();
    await checkFade();
    assert.match(await page.evaluate(() => mediaProbes[0].currentSrc), /\/audio\/rivals\/sundress-v1\.mp3$/, 'the menus play the picked song');
    // Leave a fresh battle while its mix is still fading. Home gets its own full fade.
    await nav('/puzzles/dynasty/battle/' + mid); await playing();
    assert.equal((await state()).track.id, 'battle');
    await watchFade();
    await page.goBack(); await page.waitForSelector('.pk-hdr'); await playing();
    await checkFade();
    assert.equal((await state()).track.id, 'sundress');
    console.log('PASS: delayed battle music and both same-song and mix-to-Home returns fade up during playback');
    console.log('PASS: battle jukebox: pick a song, back to the mix, menu song resumes');
    assert.equal(await page.evaluate(() => audioProbes.length), 1, 'hub/battle/back share transport');
    await nav('/puzzles'); await silent();
    assert.equal((await state()).playing, false);
    await nav('/puzzles/dynasty');
    if (await page.locator('.pk-start').count()) await page.locator('.pk-start').click({position: {x: 170, y: 420}});
    await settings(); await playing();
    await page.evaluate(async () => (await import('/js/core/data.js')).setGuest('Ryan Stewart'));
    await silent(); await page.waitForFunction(() => !document.querySelector('[data-dy-music-toggle]'));
    assert.equal(await page.evaluate(() => navigator.audioSession.type),'ambient');
    assert.equal(await page.evaluate(() => Object.values(mediaHandlers).every(fn => fn === null)),true,'profile change clears native actions');
    await page.evaluate(async () => { (await import('/js/core/data.js')).setMe('mason'); const m = await import('/js/core/dynasty-music.js'); m.setEnabled(true); m.start(); });
    assert.equal(await page.locator('[data-dy-sound], [data-dy-music-menu], .pk-mini-player').count(), 0, 'leaving Rivals access removes the controls');
    await silent();
    console.log('PASS: battle menu, route/back/exit, one transport, immediate profile-switch silence');
    assert.deepEqual(errors, []);
    await context.close();
    // Fresh non-owner sessions never create audio or expose its new settings, even with an owner-like guest name.
    for (const profile of [{me:'none',guest:'Ryan Dow'}, {me:'mason'}, {me:'none'}, {me:'none',guest:'Evan Appenzeller'}]) {
      const ctx = await browser.newContext({serviceWorkers:'block', reducedMotion:'reduce'});
      await ctx.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
      await ctx.addInitScript(p => {
        localStorage.setItem('gg-me', p.me); if (p.guest) localStorage.setItem('gg-guest', p.guest);
        localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
        ['mason','user%3Aryan-stewart','visitor'].forEach(k => localStorage.setItem('gg-release-3.0:'+k,'1'));
        window.audioCount = 0; const AC = window.AudioContext;
        window.AudioContext = class extends AC { constructor(...args) { super(...args); window.audioCount++; } };
      }, profile);
      const p = await ctx.newPage(), downloads = [];
      p.on('request', r => { if (/\.mp3$/.test(r.url())) downloads.push(r.url()); });
      await p.goto(url+'/#/puzzles'); await p.waitForFunction(() => window.__ggBooted);
      await p.evaluate(async () => (await import('/js/app.js')).nav('/puzzles/dynasty'));
      if (await p.locator('.pk-start').count()) { await p.waitForSelector('.pk-start.is-ready'); await p.locator('.pk-start').click({position:{x:170,y:420}}); await p.locator('.pk-hdr [data-dy-menu]').click(); }
      assert.equal(await p.locator('[data-dy-m="music"], .pk-music, [data-dy-sound]').count(), 0);
      await p.evaluate(async () => { const m = await import('/js/core/dynasty-music.js'); m.start(); m.setVolume(100); (await import('/js/views/dynasty-music.js')).musicSheet(); });
      assert.equal(await p.evaluate(() => audioCount), 0); assert.equal(await p.locator('.pk-music').count(), 0);
      assert.equal(downloads.length, 0, 'other profiles never request the MP3');
      assert.equal(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gg-rivals-shuffle:')).length), 0, 'nor save a shuffle');
      await ctx.close();
    }
    console.log('PASS: Ryan Dow, another member, visitor and owner-name guest retain existing silent behavior');
    for (const mode of ['unavailable', 'blocked-resume', 'blocked-media', 'track-failed', 'slow-download', 'storage-denied', 'webkit', 'no-system-api', 'system-api-errors']) {
      const ctx = await browser.newContext({serviceWorkers:'block', reducedMotion:'reduce'});
      await ctx.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
      if (mode === 'track-failed') await ctx.route('**/audio/rivals/*.mp3', r => r.abort());
      if (mode === 'slow-download') await ctx.route('**/audio/rivals/*.mp3', async r => { await new Promise(resolve => setTimeout(resolve,1500)); await r.continue(); });
      await ctx.addInitScript(mode => {
        localStorage.setItem('gg-me','evan'); localStorage.setItem('gg-welcome','1');
        localStorage.setItem('gg-release-3.0:evan','1'); sessionStorage.setItem('gg-skip-title','1');
        localStorage.setItem('gg-rivals-music:m_evan:v1', '{broken');
        if (mode === 'no-system-api') {
          Object.defineProperty(navigator,'audioSession',{value:undefined}); Object.defineProperty(navigator,'mediaSession',{value:undefined});
        }
        if (mode === 'system-api-errors') {
          Object.defineProperty(navigator,'audioSession',{value:{get type(){return 'auto'},set type(v){throw Error('unsupported')}}});
          Object.defineProperty(navigator,'mediaSession',{value:{setActionHandler(){throw Error('unsupported')},setPositionState(){throw Error('unsupported')},set metadata(v){throw Error('unsupported')},set playbackState(v){throw Error('unsupported')}}});
        }
        const NativeAudio = window.Audio;
        window.Audio = class extends NativeAudio { constructor(...args) { super(...args); window.lastMusicMedia = this; } };
        if (mode === 'unavailable') { window.AudioContext = undefined; window.webkitAudioContext = undefined; }
        if (mode === 'blocked-resume') {
          const AC = window.AudioContext;
          window.AudioContext = class extends AC { constructor() { super(); this.suspend(); } resume() { return Promise.reject(new Error('Playback blocked')); } };
        }
        if (mode === 'webkit') { window.webkitAudioContext = window.AudioContext; window.AudioContext = undefined; }
        if (mode === 'blocked-media') {
          window.mediaAttempts = 0;
          HTMLMediaElement.prototype.play = () => { window.mediaAttempts++; return Promise.reject(new DOMException('Playback blocked', 'NotAllowedError')); };
        }
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
      assert.equal(await p.locator('[data-dy-music-volume]').inputValue(), '8', mode + ': quiet default');
      if (mode === 'unavailable') assert.equal(await p.locator('[data-dy-music-toggle]').isDisabled(), true);
      else if (mode === 'blocked-resume' || mode === 'blocked-media') assert.match(await p.locator('[data-dy-music-status]').innerText(), /play to retry/);
      else if (mode === 'track-failed') assert.match(await p.locator('[data-dy-music-status]').innerText(), /couldn’t load/);
      else if (mode === 'slow-download') {
        await p.evaluate(async () => (await import('/js/core/data.js')).setGuest('Ryan Stewart'));
        await p.waitForTimeout(1800);
        assert.equal(await p.evaluate(() => lastMusicMedia.paused),true,'late download cannot start after changing profiles');
        assert.equal(await p.evaluate(async () => (await import('/js/core/dynasty-music.js')).state().playing),false);
      }
      else await p.waitForFunction(async () => (await import('/js/core/dynasty-music.js')).state().playing);
      if (mode === 'blocked-media') {
        const attempts = await p.evaluate(() => mediaAttempts); await p.waitForTimeout(300);
        assert.equal(await p.evaluate(() => mediaAttempts), attempts, 'blocked media does not enter an automatic retry loop');
      }
      assert.deepEqual(failures, [], mode + ': gameplay survives audio/storage failure'); await ctx.close();
    }
    console.log('PASS: missing audio API, blocked media/context, failed/delayed download, malformed/denied storage and WebKit API fallback');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());
