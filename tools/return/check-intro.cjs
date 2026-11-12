#!/usr/bin/env node
// Offline real-browser punt/camera checks. No production saves or score posting.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'output/return-intro');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const origin = 'http://127.0.0.1:8765';
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2'};
async function main() {
  fs.mkdirSync(output, {recursive: true});
  const browser = await pw.chromium.launch({channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader']});
  const errors = [], results = [];
  try {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'}), page = await ctx.newPage();
    await ctx.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin) { errors.push('External request ' + u.href); return route.abort(); }
      if (u.pathname === '/check') return route.fulfill({contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/views/return.css"><style>body{margin:0;background:#102230}main{width:100%;max-width:540px;margin:auto}</style><main class="rm-pane"></main>'});
      if (u.pathname === '/js/app.js') return route.fulfill({contentType: 'text/javascript', body: 'export const APP_VERSION="test",installEvent=null,TABS=[];export const promptInstall=async()=>false;'});
      try {
        const file = path.resolve(root, '.' + decodeURIComponent(u.pathname)); assert(!path.relative(root, file).startsWith('..'));
        let body = fs.readFileSync(file);
        if (u.pathname === '/js/views/return.js') body += '\nexport {draw,frame,patchHud,pause,resume,go,onEvents}; export const getRM=()=>ui.RM;';
        if (u.pathname === '/js/views/return-3d.js') body += '\nexport {GL};';
        await route.fulfill({body, contentType: mime[path.extname(file)] || 'application/octet-stream'});
      } catch (e) { errors.push(e.message); await route.fulfill({status: 404, body: 'missing'}); }
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { window.requestIdleCallback = () => 1; window.cancelIdleCallback = () => {}; });
    await page.goto(origin + '/check');
    await page.evaluate(async () => {
      const [D, R, V, D3, I] = await Promise.all([import('/js/core/data.js'), import('/js/core/return.js'), import('/js/views/return.js'), import('/js/views/return-3d.js'), import('/js/views/return-intro.js')]);
      await D.load(); D.setMe('evan'); R.setTest(true);
      const ctx = {visible: true, timer: () => () => {}}; V.mount(document.querySelector('main'), ctx);
      window.qa = {D,R,V,D3,I,ctx};
    });
    await page.waitForFunction(() => document.querySelector('[data-rm-cv]').__rm.warmed);
    assert(await page.evaluate(() => !document.querySelector('[data-rm-cv]').__rm.run), 'does not start before Play');
    for (const [w,h] of [[390,844],[320,568],[768,1024]]) {
      await page.setViewportSize({width:w,height:h});
      const play = await page.locator('[data-rm-go]').boundingBox();
      assert(play && play.y >= 0 && play.y + play.height <= h && play.x >= 0 && play.x + play.width <= w, 'Play fits ' + w);
      await page.screenshot({path: path.join(output, 'title-' + w + '.png')});
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('.rm-start-help summary').click(); assert(await page.locator('.rm-start-help').getAttribute('open') !== null);
    await page.locator('.rm-start-help summary').click();
    await page.locator('[data-rm-sb]').click(); assert(await page.locator('[data-rm-board]').isVisible(), 'scoreboard opens before play');
    await page.locator('[data-rm-go]').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-rm-cv]').__rm.mode === 'catch');
    await page.evaluate(() => { const st = window.qa.st = document.querySelector('[data-rm-cv]').__rm; cancelAnimationFrame(st.raf); st.raf = 0; });
    await page.keyboard.press('ArrowRight');
    assert(await page.evaluate(() => window.qa.st.run.lane === 1), 'input waits for the catch');
    const frames = [];
    for (const [name, elapsed] of [['punt',500],['catch',1180],['turn',1950],['handoff',2599]]) {
      frames.push(await page.evaluate(elapsed => {
        const {V,D3,I,st} = window.qa, now = performance.now(); st.catchAt = now - elapsed; st.last = now; V.frame(st, now);
        const P = D3.GL.players.us, hand = P.B.LeftHand.position.clone();
        P.B.LeftHand.getWorldPosition(hand); const right = hand.clone(); P.B.RightHand.getWorldPosition(right); hand.lerp(right,.5);
        return {mode:st.mode,t:st.run.t,z:st.run.z,yards:st.run.yards, ball:D3.GL.punt.visible, ballDistance:D3.GL.punt.position.distanceTo(hand),
          camera:D3.GL.camera.position.toArray(), rotation:D3.GL.camera.rotation.toArray().slice(0,3), shot:I.shot(st,now),
          ballAt:D3.GL.punt.position.toArray(), ballScreen:D3.GL.punt.position.clone().project(D3.GL.camera).toArray()};
      }, elapsed));
      await page.screenshot({path:path.join(output,name+'.png')});
    }
    assert(frames.every(f => f.mode === 'catch' && f.t === 0 && f.z === 0 && f.yards === 0), 'intro cannot advance score, course, fuel or collisions');
    assert(frames[0].camera[2] < 0 && frames[2].camera[0] > 2 && frames[3].camera[2] > 6.99, 'camera moves front to side to behind');
    assert(frames[0].ball && frames[1].ball && frames[1].ballDistance < .17 && !frames[3].ball, 'ball lands against both gloves and clears before running');
    assert(Math.abs(frames[3].rotation[1]) < .001, 'camera ends facing straight down the course');
    results.push('Explicit Play, phone/tablet layout, help/scoreboard, punt contact, orbit and score freeze');
    await page.evaluate(() => {
      const {V,st} = window.qa; st.catchAt = performance.now() - 800; V.pause(st);
      window.qa.pausedShot = window.qa.I.shot(st,performance.now());
    });
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => JSON.stringify(window.qa.pausedShot) === JSON.stringify(window.qa.I.shot(window.qa.st, performance.now()))), 'paused catch freezes');
    await page.locator('[data-rm-resume]').click();
    assert(await page.evaluate(() => { const {st,I} = window.qa; cancelAnimationFrame(st.raf); st.raf=0; return st.mode==='catch' && Math.abs(I.shot(st,performance.now()).p-800/2600)<.06; }), 'resume continues catch without jump');
    await page.evaluate(() => {
      const {V,st} = window.qa, now=performance.now(); st.catchAt=now-2601; st.last=now-16; V.frame(st,now);
    });
    assert(await page.evaluate(() => { const {st,D3}=window.qa; return st.mode==='run' && st.run.z>0 && !D3.GL.punt.visible && D3.GL.camera.rotation.y===0 && !D3.GL.players.us.ball.visible; }), 'normal gameplay begins with arms free');
    results.push('Pause/resume preserves the shot; normal gameplay and chase camera resume');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(() => window.qa.V.getRM());
    await page.evaluate(() => {
      const {V,st}=window.qa; st.mode='ready'; st.run=null; V.go(st); cancelAnimationFrame(st.raf); st.raf=0;
      const now=performance.now(); st.catchAt=now-600; st.last=now; V.frame(st,now);
    });
    const reduced = await page.evaluate(() => { const {st,D3,I}=window.qa; return {duration:I.duration(st),rotation:D3.GL.camera.rotation.y,ball:D3.GL.punt.visible,mode:st.mode,intro:st.intro,introReduced:st.introReduced}; });
    assert(reduced.duration===1100 && reduced.rotation===0 && reduced.ball, 'reduced motion keeps catch but removes orbit: '+JSON.stringify(reduced));
    await page.screenshot({path:path.join(output,'reduced-motion.png')});
    await page.evaluate(() => {
      const {V,st}=window.qa; st.flat=true; st.introReduced=false;
      const now=performance.now(); st.catchAt=now-900; st.last=now; V.frame(st,now);
    });
    assert(await page.locator('[data-rm-gl]').isHidden(), '2D fallback stays usable');
    await page.screenshot({path:path.join(output,'fallback.png')});
    results.push('Reduced motion and canvas fallback');
    await page.evaluate(() => { const {D,st,I}=window.qa; D.setMe('ben'); if (st.run.over || !I.enabled(st)) throw new Error('profile change must retain shared intro'); });
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForFunction(() => !window.qa.V.getRM());
    for (const profile of ['evan','ben','Ryan Dow','Ryan Stewart','Evan Appenzeller','Guest Runner',null]) {
      const state=await page.evaluate(profile => {
        const {D,V,ctx,I,R}=window.qa; V.unmount(document.querySelector('main'),ctx);
        const member = profile==='evan' || profile==='ben';
        D.setMe(member?profile:'none'); D.setGuest(member?null:profile);
        R.setTest(true);
        const markup=V.render(ctx), probe={intro:true,mode:'catch',catchAt:0};
        V.mount(document.querySelector('main'),ctx);
        return {title:markup.includes('rm-start-title'),help:markup.includes('Smelling salts expire when their speed boost ends.'),shot:!!I.shot(probe,500),duration:I.duration(probe)};
      },profile);
      assert.deepEqual(state,{title:true,help:true,shot:true,duration:2600},'shared opening and help '+profile);
      await page.waitForFunction(() => document.querySelector('[data-rm-cv]').__rm.warmed);
      assert(await page.evaluate(() => { const st=document.querySelector('[data-rm-cv]').__rm; return st.mode==='ready' && !st.run; }), 'explicit Play required for '+profile);
      await page.locator('[data-rm-go]').click();
      await page.evaluate(() => { const st=window.qa.st=document.querySelector('[data-rm-cv]').__rm; cancelAnimationFrame(st.raf); st.raf=0; });
      const shared = await page.evaluate(() => {
        const {V,D3,I,st,R}=window.qa, now=performance.now(); st.catchAt=now-1180; st.last=now; V.frame(st,now);
        const intro = st.mode==='catch' && st.run.co.enhanced && st.run.z===0 && D3.GL.punt.visible && !!I.shot(st,now);
        let item=0;
        for (const kind of ['pills','booze','salts','jetpack']) {
          for (let i=0;i<6;i++) {
            V.onEvents(st,[{type:'pickup',kind,item:{i:item++}}]);
            if (st.el.querySelector('[data-rm-pop]').textContent || !st.el.querySelector('[data-rm-got]').hidden) throw new Error('Pickup must stay text-free: '+kind);
          }
        }
        if(st.el.querySelector('[data-rm-flight-note]')) throw new Error('No gameplay instruction banner');
        return {intro, zone:R.zoneLength(st.run.co), updated:!!st.el.querySelector('.is-updated-return')};
      });
      assert.deepEqual(shared,{intro:true,zone:500,updated:true},'complete updated presentation '+profile);
    }
    results.push('Owner, member, app user, named guest and unselected players share title, preload, intro, course and text-free pickups');
    assert.deepEqual(errors,[]); console.log(results.map(s=>'PASS '+s).join('\n'));
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,results,frames,errors},null,2));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
