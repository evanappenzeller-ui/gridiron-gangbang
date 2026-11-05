// Local-only regression: actual core, routes and attack controls, with Firebase disabled.
// The 3D renderer is stubbed so a canvas click reliably exercises the live troop deployment handler.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.svg':'image/svg+xml'};
const srv = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => {
    if (err) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
const playwright = () => { try { return require('playwright'); } catch (_) { return require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); } };
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  let browser;
  try {
    browser = await playwright().chromium.launch({channel:'chrome', headless:true});
    const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'});
    await context.route('**/*', r => new URL(r.request().url()).origin === url ? r.continue() : r.abort());
    await context.route('**/js/views/realm-3d.js', r => r.fulfill({contentType:'text/javascript', body:`
      export const load = async () => true;
      export const ready = () => false;
      export function create(host, opts) {
        const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 844; host.append(canvas);
        canvas.addEventListener('click', () => opts.onTap({tile:window.__drop || {x:0,y:0}}));
        const noop = () => {};
        return {canvas,zoom:60,setLot:noop,frame:noop,frameVillage:noop,select:noop,setGhost:noop,setTheme:noop,showGrid:noop,
          setCamera:noop,camera:()=>({}),overlayScale:()=>1,look:noop,showReach:noop,showZone:noop,raidStart:noop,
          raidFrame:noop,setAnim:noop,want:noop,dispose:()=>canvas.remove(),project:()=>({x:100,y:100}),tileAt:()=>({x:0,y:0})};
      }`}));
    await context.addInitScript(() => {
      localStorage.setItem('gg-me','evan'); localStorage.setItem('gg-welcome','1');
      localStorage.setItem('gg-release-3.0:evan','1'); sessionStorage.setItem('gg-skip-title','1');
      localStorage.setItem('gg-keepfall-lore-seen','3');
    });
    const page = await context.newPage(), errors = [];
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) { errors.push(msg.text()); console.error('Console:',msg.text()); } });
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:',e.message); });
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);
    const results = await page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), B = await import('/js/core/realm-battle.js');
      const data = await import('/js/core/data.js'), daily = await import('/js/core/daily.js');
      const ok = (v, msg) => { if (!v) throw Error(msg); }, clone = v => JSON.parse(JSON.stringify(v)), passed = [];
      const now = Date.now(), tomorrow = new Date(new Date(now).setHours(24,0,0,0)).getTime();
      const fresh = () => { const s = F.fresh(now); s.rs = F.TEST_RESET; s.b[0].l = 5; s.ar = {footman:10}; s.exv = F.EX_V; return s; };
      const battle = (target = F.realmOf('bot:1', null, now)) => B.makeBattle(target.base, target.loot, {footman:10});
      Object.assign(daily.LB, {ready:true, synced:true, off:false, uid:'local-test', put:async()=>{}});
      daily.LB.all = daily.LB.raw = [{id:'mason-test', nick:'Mason', fr3:{m_mason:fresh()}}];
      const s = fresh(), before = clone(s), fight = battle();
      ok(!F.dailyAttackWhy(s,now), 'Fresh realm can attack');
      ok(!F.deployRaid(s,'bot:1',fight,'footman',22,22,now), 'Invalid drop fails');
      ok(JSON.stringify(s) === JSON.stringify(before), 'Invalid drop spends nothing');
      ok(F.deployRaid(s,'bot:1',fight,'footman',0,0,now), 'First valid drop works');
      ok(F.dailyAttackWhy(s,now), 'First drop spends the daily attack');
      ok(F.deployRaid(s,'bot:1',fight,'footman',0,0,now+1), 'Remaining troops still deploy');
      ok(!F.deployRaid(s,'bot:2',battle(),'footman',0,0,now), 'Second battle cannot deploy');
      for (const key of ['bot:1','bot:2','p:m_mason']) {
        ok(F.realmOf(key,s,now).why === F.DAILY_ATTACK_USED, key + ' is blocked');
        ok(!F.realmOf(key,s,now,{scout:true}).why, key + ' can still be scouted');
      }
      ok(JSON.stringify({...s,bt:{}}) === JSON.stringify(before), 'Start preserves resources, troops, buildings and history');
      passed.push('One daily attack across computer/player targets; invalid drops free; remaining troops and scouting work');
      const heroState = fresh(), heroTarget = F.realmOf('bot:1',null,now);
      const heroBattle = B.makeBattle(heroTarget.base,heroTarget.loot,{}, {heroes:{knight:1}});
      ok(F.deployRaid(heroState,'bot:1',heroBattle,'hero_knight',0,0,now) && F.dailyAttackWhy(heroState,now), 'Hero-only attack spends the daily allowance');
      const pvpState = fresh(), pvpTarget = F.realmOf('p:m_mason',pvpState,now), pvpBattle = battle(pvpTarget);
      ok(F.deployRaid(pvpState,'p:m_mason',pvpBattle,'footman',0,0,now) && F.realmOf('bot:1',pvpState,now).why, 'Player attack spends the same allowance as computer attacks');
      fight.end();
      F.finishRaid(s,{id:'test',vs:'bot:1',at:now,lt:[0,0],ta:0},fight.result().used,now,fight);
      ok(F.dailyAttackWhy(F.clean(clone(s)),now), 'Clean/reload preserves used day');
      ok(!F.dailyAttackWhy(s,tomorrow), 'Local midnight restores the allowance');
      const late = fresh(), lateFight = battle();
      F.deployRaid(late,'bot:1',lateFight,'footman',0,0,tomorrow-1000); lateFight.end();
      F.finishRaid(late,{id:'late',vs:'bot:1',at:tomorrow+1000,lt:[0,0],ta:0},{},tomorrow+1000,lateFight);
      ok(!F.dailyAttackWhy(late,tomorrow+1000), 'Cross-midnight battle counts on its starting day');
      const defense = fresh(); defense.df.push({at:now}); defense.ex = [{at:now}];
      ok(!F.dailyAttackWhy(defense,now), 'Defense and examples do not spend the attack');
      passed.push('Persistence, midnight reset, cross-midnight completion, defense and example exclusions');
      F._set(s); F.touch(); await F.flush(); F._set(null);
      ok(F.dailyAttackWhy(F.mine(),now), 'Local reload keeps the limit');
      const newer = fresh(); newer.at = now + 10000;
      daily.LB.all = daily.LB.raw = [{id:'phone-new',fr3:{m_evan:newer}},{id:'phone-old',fr3:{m_evan:clone(s)}}];
      const untouched = JSON.stringify(daily.LB.all);
      F.sync(); ok(F.dailyAttackWhy(F.mine(),now), 'Newer remote save cannot erase used day');
      ok(JSON.stringify(daily.LB.all) === untouched, 'Sync does not mutate board snapshots');
      localStorage.removeItem('gg-v3-fr1-m_evan'); F._set(null);
      ok(F.dailyAttackWhy(F.mine(),now), 'Older remote copy retains the allowance across newest-save selection');
      daily.LB.all = daily.LB.raw = []; F._set(fresh());
      localStorage.setItem('gg-v3-fr1-m_evan',JSON.stringify(s)); F.sync();
      ok(F.dailyAttackWhy(F.mine(),now), 'Another tab’s saved attack is checked before deployment');
      passed.push('Local reload, multiple remote copies, newer saves and existing tabs preserve the daily limit');
      for (const profile of ['mason','Ryan Stewart','Guest','Evan Appenzeller',null]) {
        if (profile === 'mason') data.setMe(profile); else { data.setMe('none'); data.setGuest(profile); }
        const other = fresh(); other.bt['bot:1'] = F.dayKey(now);
        ok(!F.dailyAttackLimited() && !F.dailyAttackWhy(other,now), 'Existing behavior retained for ' + profile);
        ok(!F.realmOf('bot:2',other,now).why, 'Other profile can still attack ' + profile);
      }
      data.setMe('evan'); daily.LB.all = daily.LB.raw = [];
      Object.assign(daily.LB, {ready:true, synced:true, off:false, uid:'local-test'});
      localStorage.removeItem('gg-v3-fr1-m_evan'); F._set(fresh());
      passed.push('Owner profile scope; member, app user, guest, typed owner name and unselected behavior unchanged');
      return passed;
    });
    results.forEach(msg => console.log('PASS: ' + msg));
    const nav = async route => {
      await page.evaluate(async route => { await (await import('/js/app.js')).nav(route); }, route);
      await page.waitForFunction(route => location.hash === '#' + route, route);
    };
    await nav('/realm/raid/bot%3A1');
    await page.waitForFunction(() => document.querySelector('.rlr')?.__rl?.v).catch(async e => { console.error(await page.locator('body').innerText()); throw e; });
    assert.equal(await page.evaluate(async () => (await import('/js/core/realm.js')).dailyAttackWhy((await import('/js/core/realm.js')).mine())), '');
    await page.locator('[data-rlr-quit]').click();
    await nav('/realm/raid/bot%3A1');
    await page.waitForFunction(() => document.querySelector('.rlr')?.__rl?.v);
    await page.locator('.rlr:not(.rls) .rl-gl canvas').click({position:{x:195,y:400}});
    assert(await page.evaluate(async () => { const F = await import('/js/core/realm.js'); return F.dailyAttackWhy(F.mine()) && JSON.parse(localStorage.getItem('gg-v3-fr1-m_evan')).bt['bot:1'] === F.dayKey(); }));
    await page.locator('[data-rlr-quit]').click();
    await page.locator('.rlr-card').waitFor();
    await nav('/realm/raid/bot%3A2');
    await page.locator('[data-rlr-msg]').filter({hasText:'Daily attack used'}).waitFor();
    assert.equal(await page.locator('.rlr:not(.rls) .rl-gl canvas').count(),0);
    await nav('/realm/scout/bot%3A2');
    await page.locator('[data-rls-go] button').filter({hasText:'Daily attack used'}).waitFor();
    assert.equal(await page.locator('[data-rls-go] button').isDisabled(),true);
    const sheet = await page.evaluate(async () => {
      const F = await import('/js/core/realm.js'), view = await import('/js/views/realm.js');
      const screens = view._screens(F.mine(),Date.now());
      return screens.find(x => x.where === 'Attack').html;
    });
    assert.match(sheet,/Daily attack used/);
    assert(!/data-rl-go="bot:[^"]+"\s*>Attack/.test(sheet), 'All computer attack buttons are disabled');
    await page.reload();
    await page.waitForFunction(() => window.__ggBooted);
    await nav('/realm/raid/bot%3A2');
    await page.locator('[data-rlr-msg]').filter({hasText:'Daily attack used'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: Real deployment handler persists immediately; leaving before deployment is free; ended/reloaded/direct raids blocked; scouting explains the limit');
  } finally { if (browser) await browser.close(); srv.close(); }
})().catch(e => {console.error(e); process.exitCode=1;});
