// Home chrome must follow the committed route, even while pages are loading or gestures are canceled.
// Local browser fixture, Firebase disabled. CHROMIUM_PATH may select an installed Chromium browser.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
// Optional comparison against the published source, useful when proving this catches the original race.
const baseline = process.env.HOME_BASELINE_REF;
const baselineFiles = new Set(['js/app.js','js/views/puzzles.js','css/views/puzzles.css']);
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  let file;
  try { const p = new URL(req.url, 'http://localhost').pathname; file = path.resolve(root, '.' + decodeURIComponent(p === '/' ? '/index.html' : p)); }
  catch (_) { return res.writeHead(400).end(); }
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    const relative = path.relative(root,file).replaceAll('\\','/');
    if (baseline && baselineFiles.has(relative)) bytes = execFileSync('git',['show',baseline+':'+relative],{cwd:root});
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  });
});
async function boot(browser, url, {route = '/puzzles', reduced = false, holdLay = false} = {}) {
  const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,serviceWorkers:'block',reducedMotion:reduced ? 'reduce' : 'no-preference'});
  await context.route('https://**/*', route => route.abort());
  let releaseLoad = () => {}, loadRequested = false;
  if (holdLay) {
    const ready = new Promise(resolve => { releaseLoad = resolve; });
    await context.route('**/js/views/lay.js', async route => { loadRequested = true; await ready; await route.continue(); });
  }
  await context.addInitScript(() => {
    localStorage.setItem('gg-me','evan'); localStorage.setItem('gg-welcome','1'); localStorage.setItem('gg-tab-hint','2');
    for (const id of ['evan','mason','visitor']) localStorage.setItem('gg-release-3.0:'+id,'1');
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url + '/#' + route);
  await page.waitForFunction(() => window.__ggBooted);
  await page.evaluate(async () => { window.navApp = await import('/js/app.js'); });
  assert.equal(await page.evaluate(async () => (await import('/js/core/fire.js')).canWrite()), false, 'Fixture cannot write live data');
  return {page,context,errors,releaseLoad,loadRequested:() => loadRequested};
}
async function settled(page, tab, {home = tab === 'puzzles', hash} = {}) {
  await page.waitForFunction(({tab,home,hash}) => {
    const app = window.navApp, bar = document.getElementById('tabbar'), style = getComputedStyle(bar);
    return app.__dev.S.tab === tab && !app.__dev.queueBusy && !document.querySelector('#stage.is-cards')
      && !document.querySelector('.hm-morph-layer') && !document.documentElement.classList.contains('hm-morph')
      && document.documentElement.classList.contains('is-home') === home
      && (home ? style.visibility === 'hidden' : style.visibility === 'visible' && +style.opacity > .99)
      && (!hash || location.hash === hash);
  }, {tab,home,hash}, {timeout:6000});
  assert.deepEqual(await page.locator('#stage > .tab-layer:not([hidden])').evaluateAll(layers => layers.map(l => l.dataset.tab)), [tab], 'Only the committed tab remains visible');
  assert.equal(await page.locator('.hm-morph-layer').count(), 0, 'No orphan flight layer');
}
async function click(page, selector) {
  await page.evaluate(selector => {
    const button = document.querySelector(selector); if (!button) throw Error('Missing navigation button: '+selector); button.click();
  }, selector);
}
async function swipe(page, context, {cancel = false, dx = 210} = {}) {
  const session = await context.newCDPSession(page);
  const start = await page.evaluate(({dx}) => {
    const stage = document.getElementById('stage'), r = stage.getBoundingClientRect(), x = r.left + r.width * (dx > 0 ? .2 : .8);
    const no = 'input,textarea,select,[contenteditable="true"],[role="slider"],[data-no-swipe],[data-hscroll],.dr-field.is-anim,.dr-cam,#tabbar';
    for (const y of [r.top+110,r.top+165,r.top+220,r.top+280]) {
      const el = document.elementFromPoint(x,y); if (!el || !stage.contains(el) || el.closest(no)) continue;
      let own = false;
      for (let n = el; n && n !== stage; n = n.parentElement) {
        const cs = getComputedStyle(n); if (['pan-y','none'].includes(cs.touchAction) || (n.scrollWidth > n.clientWidth+2 && ['auto','scroll'].includes(cs.overflowX))) own = true;
      }
      if (!own && x+dx > r.left+10 && x+dx < r.right-10) return {x,y};
    }
    throw Error('No suitable navigation swipe target');
  }, {dx});
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
  for (let i=1;i<=10;i++) {
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*i/10,y:start.y,id:1}]});
    await page.waitForTimeout(12);
  }
  assert.equal(await page.locator('#stage.is-cards').count(), 1, 'Real touch gesture owns the pager');
  await session.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  await session.detach();
}
async function run(url) {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
  try {
    // Keep a destination's cold import pending. Home remains usable until a real page is ready.
    const fixture = await boot(browser,url,{holdLay:true}), {page,context,errors} = fixture;
    await settled(page,'puzzles');
    await click(page,'.hm-app[data-go-tab="lay"]');
    await page.waitForTimeout(120);
    assert.equal(fixture.loadRequested(),true,'The cold destination import is held');
    assert.equal(await page.locator('.hm-morph-layer').count(),0,'No flight starts before destination is ready');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-home')),true,'Cold loading retains home chrome');
    fixture.releaseLoad();
    await settled(page,'lay');
    console.log('PASS: cold destination loading preserves the home grid and completes cleanly');

    // Coordinate the icon handoff with the page, using only composited properties.
    await click(page,'#tabbar .tab[data-tab="puzzles"]');
    await page.waitForSelector('.hm-morph-layer',{state:'attached'});
    const animation = await page.evaluate(() => [...document.querySelector('.hm-morph-layer').getAnimations({subtree:true})].map(a => ({
      duration:a.effect.getComputedTiming().endTime,
      keys:[...new Set(a.effect.getKeyframes().flatMap(f => Object.keys(f)))],
      blur:getComputedStyle(a.effect.target).backdropFilter
    })));
    assert.ok(animation.length,'The visible grid has an icon handoff');
    for (const a of animation) {
      assert.ok(a.duration <= 300,'The handoff finishes with the page slide, without a staggered tail');
      assert.deepEqual(a.keys.filter(k => !['offset','computedOffset','easing','composite','transform','opacity'].includes(k)),[],'Morph only animates transform/opacity');
      assert.equal(a.blur,'none','Flying elements do not redraw backdrop blur');
    }
    await page.waitForTimeout(70);
    const painted = await page.evaluate(() => {
      const layer = document.querySelector('.hm-morph-layer');
      return [...layer.querySelectorAll('.hm-ghost')].map(ghost => {
        const r = ghost.getBoundingClientRect(), s = getComputedStyle(ghost), l = getComputedStyle(layer);
        const glyphs = [...ghost.querySelectorAll('.ic')].map(icon => ({opacity:+getComputedStyle(icon).opacity,visibility:getComputedStyle(icon).visibility}));
        const lr = layer.getBoundingClientRect();
        return {x:r.x,y:r.y,w:r.width,h:r.height,opacity:+s.opacity,visibility:s.visibility,layerOpacity:+l.opacity,layerVisibility:l.visibility,z:+l.zIndex,layer:{x:lr.x,y:lr.y,w:lr.width,h:lr.height},
          inViewport:r.right>0 && r.bottom>0 && r.left<innerWidth && r.top<innerHeight,glyphs};
      });
    });
    assert.ok(painted.filter(g => g.inViewport && g.w>10 && g.h>10 && g.opacity>.3 && g.visibility==='visible' && g.layerOpacity>.3 && g.layerVisibility==='visible' && g.z>1 && g.glyphs.some(i=>i.opacity>.3 && i.visibility==='visible')).length>=6,'At least six flying glyphs are painted within the viewport above the pages');
    const timeline = await page.evaluate(() => {
      const ghost = document.querySelector('.hm-morph-layer .hm-ghost');
      return {transform:getComputedStyle(ghost).transform,animation:ghost.getAnimations().map(a=>({time:a.currentTime,start:a.startTime,state:a.playState,pending:a.pending,frames:a.effect.getKeyframes()}))};
    });
    assert.ok(timeline.animation.some(a=>a.time>0 && !a.pending),'Connected ghost animation advances during the page slide');
    if (process.env.HOME_SHOTS) {
      const session = await context.newCDPSession(page);
      const capture = await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.mkdirSync(process.env.HOME_SHOTS,{recursive:true});
      fs.writeFileSync(path.join(process.env.HOME_SHOTS,'inbound-direct.png'),Buffer.from(capture.data,'base64'));
      fs.writeFileSync(path.join(process.env.HOME_SHOTS,'inbound-geometry.json'),JSON.stringify({painted,timeline},null,2));
      await session.detach();
    }
    await settled(page,'puzzles');
    await click(page,'.hm-app[data-go-tab="pickem"]');
    await page.waitForTimeout(60);
    await click(page,'#tabbar .tab[data-tab="puzzles"]');
    await settled(page,'puzzles');
    assert.equal(await page.evaluate(() => location.hash),'#/puzzles','A quick return preserves the latest requested destination');
    console.log('PASS: short compositor-only handoff and rapid return to home');

    // A newer public navigation intent wins even when it returns to the still-committed source route.
    await click(page,'.hm-app[data-go-tab="lay"]');
    await page.waitForTimeout(60);
    await page.evaluate(async () => window.navApp.nav('/puzzles'));
    await settled(page,'puzzles');
    await click(page,'.hm-app[data-go-tab="lay"]');
    await page.waitForTimeout(60);
    await page.evaluate(async () => window.navApp.nav('/league/standings'));
    await settled(page,'league');
    await page.evaluate(async () => window.navApp.nav('/puzzles'));
    await settled(page,'puzzles');
    console.log('PASS: newer direct navigation overrides an in-flight tab slide');

    // A grid outside the viewport must fade to the bar, not fly ghosts in from clipped coordinates.
    await page.evaluate(() => { document.querySelector('.hm-apps').style.transform='translateY(1000px)'; });
    await click(page,'.hm-app[data-go-tab="pickem"]');
    await page.waitForTimeout(60);
    assert.equal(await page.locator('.hm-morph-layer').count(),0,'Offscreen grid uses the quiet bar fallback');
    await settled(page,'pickem');
    await page.evaluate(() => { document.querySelector('.hm-apps').style.transform=''; });
    await page.evaluate(async () => window.navApp.nav('/puzzles'));
    await settled(page,'puzzles');

    // The home preview in a canceled gesture must not seize global navigation state.
    await page.evaluate(async () => window.navApp.nav('/pickem'));
    await settled(page,'pickem');
    await page.waitForTimeout(350);
    await swipe(page,context,{cancel:true});
    await settled(page,'pickem');
    await swipe(page,context);
    await settled(page,'puzzles');
    await page.evaluate(async () => window.navApp.nav('/puzzles/daily'));
    await settled(page,'puzzles',{home:false,hash:'#/puzzles/daily'});
    await page.evaluate(async () => window.navApp.back());
    await settled(page,'puzzles');
    console.log('PASS: offscreen-grid fallback, canceled/committed home swipes and pushed-screen Back');

    // Interrupt a flight by changing geometry and preference; both settle to the committed route.
    await click(page,'.hm-app[data-go-tab="lay"]');
    await page.waitForTimeout(60);
    await page.setViewportSize({width:430,height:780});
    await settled(page,'lay');
    await click(page,'#tabbar .tab[data-tab="puzzles"]');
    await page.waitForTimeout(60);
    await page.emulateMedia({reducedMotion:'reduce'});
    await settled(page,'puzzles');
    await click(page,'.hm-app[data-go-tab="pickem"]');
    await settled(page,'pickem');
    assert.equal(await page.locator('.hm-morph-layer').count(),0,'Reduced motion never leaves flights');
    await page.evaluate(async () => (await import('/js/core/data.js')).setMe('mason'));
    await page.waitForTimeout(350);
    await settled(page,'pickem');
    assert.deepEqual(errors,[],'No browser exceptions');
    await context.close();
    console.log('PASS: resize, reduced-motion changes and hidden-home refresh keep navigation consistent');

    // Cold direct links may warm a hidden home screen; warming must never hide their bar.
    const direct = await boot(browser,url,{route:'/pickem'});
    await settled(direct.page,'pickem');
    await direct.page.waitForTimeout(800);
    await settled(direct.page,'pickem');
    assert.deepEqual(direct.errors,[]);
    await direct.context.close();
    console.log('PASS: cold direct link and background home warm-up');
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
