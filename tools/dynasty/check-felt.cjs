// Offline browser regression for unlockable felt and real v7 turn changes.
// Usage: node tools/dynasty/check-felt.cjs [--motion=normal] [--shots=output/rivals-felt]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..'), shots = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
const motion = process.argv.includes('--motion=normal') ? 'no-preference' : 'reduce';
if (shots) fs.mkdirSync(shots, {recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(bytes);
  });
});
const profiles = [{me:'evan', key:'m_evan'}, {me:'jayton', key:'m_jayton'},
  {guest:'Ryan Stewart', key:'u_ryan-stewart'}, {guest:'Ryan Younggreen', key:'u_ryan-younggreen'}];
const rgb = hex => 'rgb(' + hex.slice(1).match(/../g).map(n => parseInt(n,16)).join(', ') + ')';
async function closeSheet(page) {
  await page.locator('.sheet .sheet-close').last().click();
  await page.waitForFunction(() => !document.querySelector('.sheet'));
}
async function waitForTable(page) {
  // A resolved CPU attack can already return the rules to the player while its
  // queued scene is just about to mount. Require a quiet interval, not one frame.
  let quiet=0;
  for(let i=0;i<600;i++) {
    const ready=await page.evaluate(async()=>{
      const x=(await import('/js/core/dynasty-solo.js')).current();
      return x.state==='yours' && !document.querySelector('.rp-cinema') && !document.querySelector('[data-rp]').inert;
    });
    quiet=ready?quiet+1:0;if(quiet===6)return;
    await page.waitForTimeout(100);
  }
  throw Error('The CPU and its queued scenes did not return control');
}
async function snapshot(page) {
  return page.evaluate(async() => {
    const D = await import('/js/core/dynasty.js'), S = await import('/js/core/dynasty-solo.js'), s = D.mine();
    return {game:JSON.stringify(S.get(window.feltMid).G), finish:s.table.finish,
      progress:JSON.stringify({o:s.o, pk:s.pk, so:s.so, cr:s.cr, sp:s.sp, tr:s.tr, dk:s.dk, pocket:s.pocket,
        table:{...s.table, finish:undefined}})};
  });
}
async function colorMatches(page, turn, finish) {
  const expected = rgb(turn === 'opponent' ? finish.away : finish.color);
  await page.waitForFunction(({turn,id,expected}) => {
    const host = document.querySelector('[data-rp]'), arena = document.querySelector('.rp-arena');
    return host?.dataset.turn === turn && host?.dataset.finish === id && getComputedStyle(arena, '::before').backgroundColor === expected;
  }, {turn,id:finish.id,expected});
  const current = await page.evaluate(async() => {
    const x = (await import('/js/core/dynasty-solo.js')).get(window.feltMid);
    return {state:x.state, turn:document.querySelector('[data-rp]').dataset.turn};
  });
  assert.equal(current.turn, current.state === 'theirs' ? 'opponent' : 'you', 'felt follows the manager currently making a decision');
}
async function geometry(page, label, clear = true) {
  const result = await page.evaluate(clear => {
    const rect = el => {const r = el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const inside = r => r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
    const uncovered = el => {const r=rect(el),x=r.left+r.width/2,y=r.top+r.height/2;return [[r.left+4,y],[r.right-4,y],[x,r.top+4],[x,r.bottom-4],[x,y]].every(([x,y])=>el.contains(document.elementFromPoint(x,y)));};
    const actions = [...document.querySelectorAll('.rp-turn-action button')].map(el => {const r=rect(el);return {...r,inside:inside(r),clear:!clear || el.disabled || uncovered(el),hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.className};});
    const cards = [...document.querySelectorAll('.rp-hand>.rp-card')].map(rect);
    return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,
      footer:rect(document.querySelector('.rp-turn-action')),actions,handBottom:Math.max(...cards.map(c=>c.bottom)),
      badges:[...document.querySelectorAll('.rp-manager')].map(el=>({inside:inside(rect(el)),clear:!clear || uncovered(el), direction:getComputedStyle(el).flexDirection, dots:[...el.querySelectorAll('.rp-points i')].map(rect)})),
      bench:[...document.querySelectorAll('.rp-bench>*')].map(rect)};
  }, clear);
  assert(result.scroll <= result.width + 1, label + ': no horizontal overflow');
  if(shots && result.actions.some(b=>!b.inside||!b.clear))await capture(page,'failure-'+label.replace(/[^a-z0-9]+/gi,'-'));
  assert(result.actions.length && result.actions.every(b => b.inside && b.clear && b.height >= 44), label + ': footer buttons remain visible and tappable: '+JSON.stringify(result.actions));
  assert(result.handBottom < Math.min(...result.actions.map(b=>b.top)), label + ': the entire resting hand stays above the footer buttons');
  assert.equal(result.badges.length,2);
  assert(result.badges.every(b => b.inside && b.clear && b.direction === 'column' && b.dots.length === 3 && b.dots.every(d=>d.width === 13 && d.height === 13)), label + ': both stacked score badges stay clear');
  assert(result.bench.every(b=>b.width >= 44 && b.height >= 44), label + ': every Bench target remains tappable');
}
async function capture(page, name, paused = false) {
  if (!shots) return;
  // The genuine options sheet pauses the CPU. Hide only that overlay in the
  // screenshot so the actual opponent-turn table beneath it can be reviewed.
  await page.screenshot({path:path.join(shots,name+'.png'), ...(paused ? {style:'.sheet,.sheet-scrim{visibility:hidden!important}'} : {})});
}
async function run(url) {
  const browser = await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    for (const profile of profiles) {
      const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:motion});
      await context.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
      await context.addInitScript(p => {
        if (!localStorage.getItem('gg-me')) {localStorage.setItem('gg-me',p.me || 'none');if(p.guest)localStorage.setItem('gg-guest',p.guest);}
        localStorage.setItem('gg-welcome','1');sessionStorage.setItem('gg-skip-title','1');
        for (const k of ['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen','visitor']) localStorage.setItem('gg-release-3.0:'+k,'1');
        for (const kind of ['music','sfx']) localStorage.setItem('gg-rivals-'+kind+':'+p.key+':v1',JSON.stringify({enabled:false,volume:0}));
      },profile);
      const page = await context.newPage(), errors = []; page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(url+'/#/puzzles'); await page.waitForFunction(()=>window.__ggBooted);
      const seeded = await page.evaluate(async() => {
        const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js'),C=await import('/js/core/dynasty-pocket-cards.js'),T=await import('/js/core/dynasty-table.js');await D.load();
        if((await import('/js/core/fire.js')).canWrite())throw Error('Production writes must remain disabled');
        if(!(await import('/js/core/features.js')).rivalsUpdated())throw Error('Wrong profile');
        const s=D.mine(),before=JSON.stringify(s),locked=D.setTableFinish('gold');
        if(locked||JSON.stringify(s)!==before)throw Error('Locked finish selection changed the save');
        // An existing-progress fixture, using the same fields as actual wins and
        // pack openings. No collection grants or game-state edits are needed.
        s.so={g1:3,g10:1};s.table={...T.clean(s.table),packs:5,finish:'club'};D.touch('felt-fixture');
        const unlocked=D.tableFinishes().filter(f=>f.unlocked).map(f=>f.id);
        const r=D.usePocketDeck('rental');if(!r.ok)throw Error(r.why);
        let start,x;
        for(let i=0;i<80;i++) {start=S.start('g1');if(!start.ok)throw Error(start.why);x=S.get(start.mid);
          if(x.G.first===0&&x.G.p[0].hand.filter(id=>C.card(id)?.stage==='Base').length>=2)break;}
        if(x.G.first!==0||x.G.p[0].hand.filter(id=>C.card(id)?.stage==='Base').length<2)throw Error('No naturally dealt first turn with a reserve');
        window.feltMid=start.mid;await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+start.mid);
        D.flush();return {unlocked,club:D.tableFinish(),wine:D.tableFinishes().find(f=>f.id==='wine')};
      });
      assert.deepEqual(seeded.unlocked,['club','blue','purple','wine'],profile.key+': existing challenge and pack unlocks');
      await page.waitForSelector('[data-rp-ready]'); await colorMatches(page,'you',seeded.club);
      for(const width of [390,320]) {
        await page.setViewportSize({width,height:width===320?568:844});await geometry(page,profile.key+' setup '+width);
        if(profile.me==='evan')await capture(page,'setup-'+width);
      }
      await page.setViewportSize({width:390,height:844});
      const beforeEquip=await snapshot(page);
      await page.locator('[data-rp-menu]').click();await page.locator('[data-rp-table]').click();await page.waitForSelector('[data-rt-finish="wine"]');
      assert(await page.locator('[data-rt-finish="gold"]').isDisabled(),'locked Champions Club cannot be equipped');
      await page.locator('[data-rt-finish="wine"]').click();
      await colorMatches(page,'you',seeded.wine);
      assert.equal(await page.locator('[data-rt-finish="wine"]').getAttribute('aria-pressed'),'true','equipped finish is marked');
      if(profile.me==='evan')await capture(page,'picker-390');
      await closeSheet(page);
      const afterEquip=await snapshot(page);
      assert.equal(afterEquip.finish,'wine');assert.equal(afterEquip.game,beforeEquip.game,'equipping never changes the match');
      assert.equal(afterEquip.progress,beforeEquip.progress,'equipping preserves collection, balances, progression and decks');
      await page.reload();await page.waitForSelector('[data-rp-ready]');await colorMatches(page,'you',seeded.wine);
      assert.deepEqual(await snapshot(page),afterEquip,'finish and all existing progress survive reload');
      await page.evaluate(async()=>{
        const S=await import('/js/core/dynasty-solo.js'),C=await import('/js/core/dynasty-pocket-cards.js');
        const bases=S.get(window.feltMid || (window.feltMid=S.current().mid)).G.p[0].hand.filter(id=>C.card(id)?.stage==='Base');
        const r=S.move(window.feltMid,{a:'setup',act:bases[0],bench:bases.slice(1,4)});if(!r.ok)throw Error(r.why);
      });
      await page.waitForSelector('[data-rp-end]:not([disabled])');await colorMatches(page,'you',seeded.wine);
      for(const width of [320,390]) {
        await page.setViewportSize({width,height:width===320?568:844});await geometry(page,profile.key+' home '+width);
        if(profile.me==='evan')await capture(page,'home-'+width);
      }
      // End the actual turn through its public control. The live options sheet
      // pauses the real CPU, allowing stable measurements of the opposing felt.
      await page.locator('[data-rp-end]').click();await page.locator('[data-rp-menu]').click();
      await colorMatches(page,'opponent',seeded.wine);
      const away=await snapshot(page);assert.notEqual(away.game,afterEquip.game,'ending the turn advances the actual match');
      for(const width of [390,320]) {
        await page.setViewportSize({width,height:width===320?568:844});await geometry(page,profile.key+' away '+width,false);
        if(profile.me==='evan')await capture(page,'away-'+width,true);
      }
      assert.equal((await snapshot(page)).game,away.game,'open options pause the opposing manager');
      await closeSheet(page);
      await waitForTable(page);
      await colorMatches(page,'you',seeded.wine);await geometry(page,profile.key+' returned home');
      const returned=await snapshot(page);assert.notEqual(returned.game,away.game,'CPU actually played before returning the felt');
      assert.equal(returned.progress,afterEquip.progress,'turn presentation preserves collection and unlock progress');
      await page.reload();await page.waitForSelector('[data-rp-end]');await colorMatches(page,'you',seeded.wine);
      assert.deepEqual(await snapshot(page),returned,'in-progress replay and selected felt survive reload');
      assert.deepEqual(errors,[],profile.key+' browser errors');
      console.log('PASS '+profile.key+' ('+motion+'): locked/unlocked finishes, equip/reload, actual home→CPU→home felt, preserved saves and 320/390 controls');
      await context.close();
    }
  } finally {await browser.close();}
}
server.listen(0,'127.0.0.1',()=>run('http://127.0.0.1:'+server.address().port).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close()));
