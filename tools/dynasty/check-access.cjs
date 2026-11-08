// Jayton's approved admin/Rivals access and unlimited coins. Local server only; no live reads or writes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
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
let pw;
try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await pw.chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {channel:'chrome'}), headless:true});
    const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block', reducedMotion:'reduce'});
    await context.route('**/*', r => new URL(r.request().url()).origin === url ? r.continue() : r.abort());
    await context.addInitScript(() => {
      if (!localStorage.getItem('gg-me')) localStorage.setItem('gg-me','jayton');
      localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
      ['evan','jayton','mason','visitor','user%3Aryan-stewart'].forEach(k => localStorage.setItem('gg-release-3.0:' + k,'1'));
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/#/puzzles');
    await page.waitForFunction(() => window.__ggBooted);
    const results = await page.evaluate(async () => {
      const data = await import('/js/core/data.js'), F = await import('/js/core/features.js');
      const D = await import('/js/core/dynasty.js'), lay = await import('/js/core/lay.js');
      const daily = await import('/js/core/daily.js'), week = await import('/js/core/week.js');
      const fire = await import('/js/core/fire.js'), app = await import('/js/app.js');
      const games = await import('/js/views/games.js');
      const ok = (v, msg) => { if (!v) throw Error(msg); }, passed = [];
      ok(!fire.canWrite(), 'Live writes must be disabled');
      await D.load();
      for (const id of data.ids) {
        ok(lay.isAdmin(id) === ['evan','jayton'].includes(id), id + ': admin permission');
        ok(F.dynastyOpen(id) === ['evan','jayton'].includes(id), id + ': Rivals permission');
        ok(games.gamesFor(id).some(g => g.id === 'dynasty'), id + ': game case');
        ok(F.coinsUnlimited('m_' + id) === (id === 'jayton'), id + ': unlimited coins');
      }
      for (const user of data.USERS) {
        ok(F.dynastyOpen(null,user) === ['ryan-stewart','ryan-younggreen'].includes(user.id), user.id + ': access unchanged');
        ok(!F.coinsUnlimited('u_' + user.id) && !lay.isAdmin(user.id), user.id + ': no new privileges');
      }
      for (const id of [null,'','Jayton','Jayton Hull','unknown']) ok(!lay.isAdmin(id), 'No display-name admin: ' + id);
      ok(D.mayPlay() && lay.isAdmin() && !data.isOwner(), 'Jayton is an admin and player, not the owner');
      ok(D.tableOpen() && D.bossLadderOpen(), 'Jayton receives completed Rivals features without owner privileges');
      ok(app.parseRoute('/puzzles/dynasty').view === 'dynasty', 'Game route');
      ok(app.parseRoute('/puzzles/dynasty/battle/b1234abcd').view === 'dynasty-battle', 'Battle route');
      passed.push('all member/app-user permissions, game case, routes and owner boundaries');

      const lw = lay.liveWeek(); ok(lw, 'Live week fixture');
      week.__dev.setNow(lay.closeTime(lw.year,lw.week).getTime() + 1000);
      ok(lay.isClosed(lw.year,lw.week), 'Legs have closed');
      ok(await lay.setLeg('mason','Test admin leg') === 'dev', 'Jayton can add another member’s closed leg');
      ok(await lay.setLeg('mason','Edited admin leg') === 'dev', 'Jayton can edit it');
      ok(await lay.setLeg('mason',null) === 'dev', 'Jayton can remove it');
      data.setMe('mason');
      ok(await lay.setLeg('evan','Denied') === 'notyours', 'Regular members cannot edit others');
      ok(await lay.setLeg('mason','Closed') === 'closed', 'Regular members remain closed');
      data.setMe('jayton'); week.__dev.setNow(null);
      passed.push('actual admin add/edit/delete after closing and ordinary-member restrictions');

      const s = D.mine(); s.cr = 91; s.sp = D.STARTER_COINS + 91; s.tr = 37; s.so = {g1:1};
      s.pk = {start:1}; s.dd = D.dayKey(new Date()); D.touch();
      const before = {sp:s.sp, cr:s.cr, tr:s.tr, so:JSON.stringify(s.so)};
      ok(D.unlimitedCoins() && D.balance(s) === Infinity, 'Empty saved wallet is unlimited');
      for (let i = 0; i < 40; i++) ok(D.buy('prem').ok, 'Repeated expensive purchases work');
      ok(s.pk.prem === 40 && s.sp === before.sp && s.cr === before.cr, 'Purchases never spend or fabricate coins');
      ok(D.buy('team').ok && D.open('team',{team:'KC'}).ok, 'Team packs work');
      ok(D.open('start').ok && !D.open('start').ok, 'Starter pack stays one-time');
      ok(!D.buy('leg').ok && !D.buy('invalid').ok, 'Retired and invalid packs remain unavailable');
      ok(s.tr === before.tr && JSON.stringify(s.so) === before.so, 'Existing progress retained');
      let body;
      Object.assign(daily.LB,{ready:true,synced:true,off:false,uid:'access-test',raw:[],all:[],put:async b => { body=b; }});
      ok(await D.flush() && body.dy1.m_jayton, 'Jayton can sync under his existing profile key');
      ok(body.dy1.m_jayton.sp === before.sp && body.dy1.m_jayton.cr === before.cr, 'Cloud ledger unchanged');
      const finite = v => typeof v === 'number' ? Number.isFinite(v) : v && typeof v === 'object' ? Object.values(v).every(finite) : true;
      ok(finite(body) && finite(JSON.parse(localStorage.getItem('gg-dy1-m_jayton'))), 'No Infinity saved locally or remotely');
      const docs = [{id:'jayton-fixture',nick:data.name('jayton'),dy1:{m_jayton:s}}];
      data.setMe('evan');
      ok(D.others(docs).some(p => p.key === 'm_jayton'), 'Jayton appears as a Rivals opponent');
      ok(Number.isFinite(D.balance()) && D.unlimited(), 'Evan retains finite coins and unlimited packs');
      data.setGuest('Ryan Stewart');
      ok(D.mayPlay() && Number.isFinite(D.balance()) && D.unlimited(), 'Ryan retains his existing wallet and packs');
      const normal = D.mine(); normal.sp = D.STARTER_COINS + normal.cr; D.earned(normal,true);
      ok(!D.buy('prem').ok, 'Ordinary empty wallet still cannot buy an Epic pack');
      data.setMe('none'); data.setGuest('Jayton Hull');
      ok(!lay.isAdmin() && !D.mayPlay() && !D.unlimitedCoins(), 'Typed guest name grants nothing');
      data.setGuest(null); data.setMe(null);
      ok(!lay.isAdmin() && !D.mayPlay() && !D.unlimitedCoins(), 'Unselected profile grants nothing');
      data.setMe('jayton');
      ok(D.balance() === Infinity && D.mine().pk.prem === 40, 'Switching back restores Jayton’s saved progress');
      passed.push('unlimited purchases, finite local/cloud saves, opponent visibility and live profile switching');
      await app.nav('/puzzles/dynasty');
      return passed;
    });
    results.forEach(r => console.log('PASS: ' + r));
    await page.locator('.pk-start.is-ready').waitFor();
    await page.evaluate(async () => (await import('/js/core/dynasty.js')).finishTutorial('skipped', (await import('/js/core/realm-active.js')).profileKey()));
    await page.locator('.pk-start').click({position:{x:195,y:640}});
    await page.waitForFunction(() => !document.querySelector('.pk-start'));
    assert.equal(await page.locator('.pk-coin-n[aria-label="Unlimited coins"] b').textContent(),'∞');
    assert.deepEqual(await page.locator('.pk-tab').allTextContents(),['Home','Battle','Packs','Collection','Decks']);
    await page.locator('.pk-tab[data-dy-tab="packs"]').click();
    await page.locator('[data-dy-menu]').click();await page.locator('[data-dy-m="coins"]').click();
    await page.getByText('You have unlimited coins. Pack purchases leave your earned coins untouched.').waitFor();
    await page.locator('.sheet.pk-sheet .sheet-close').click();
    await page.locator('.sheet.pk-sheet').waitFor({state:'detached'});
    const pointsBefore = await page.evaluate(async () => (await import('/js/core/dynasty.js')).mine().pp);
    await page.locator('.pk-pack-buy[data-dy-openhere]').click();
    await page.getByRole('button',{name:'Open for 1,000',exact:true}).click();
    await page.waitForFunction(async before => (await import('/js/core/dynasty.js')).mine().pp === before + 5, pointsBefore);
    assert.equal(await page.evaluate(async () => (await import('/js/core/dynasty.js')).mine().sp),2591);
    console.log('PASS: phone UI shows unlimited coins, explains them and opens a purchased pack');
    await page.reload();
    await page.locator('.pk-start.is-ready').waitFor();
    const saved = await page.evaluate(async () => {
      const D = await import('/js/core/dynasty.js'), s = D.mine();
      return {unlimited:D.unlimitedCoins(), infinite:D.balance() === Infinity, sp:s.sp, cr:s.cr, packs:s.pk.prem, tr:s.tr};
    });
    assert.deepEqual(saved,{unlimited:true,infinite:true,sp:2591,cr:91,packs:40,tr:37});
    assert.deepEqual(errors,[],'No browser exceptions');
    console.log('PASS: unlimited coins and all existing progress survive reload');
    await context.close();
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
