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

const profiles=[{me:'evan',key:'m_evan'},{me:'jayton',key:'m_jayton'},
  {guest:'Ryan Stewart',key:'u_ryan-stewart'},{guest:'Ryan Younggreen',key:'u_ryan-younggreen'}];
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    for(const [index,profile] of profiles.entries()){
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
      await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
      await context.addInitScript(p=>{
        if(!localStorage.getItem('gg-me')) {localStorage.setItem('gg-me',p.me || 'none');if(p.guest)localStorage.setItem('gg-guest',p.guest);}
        localStorage.setItem('gg-welcome','1');sessionStorage.setItem('gg-skip-title','1');
        for(const k of ['evan','jayton','user%3Aryan-stewart','user%3Aryan-younggreen'])localStorage.setItem('gg-release-3.0:'+k,'1');
        const key='gg-rivals-music:'+p.key+':v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({enabled:false}));
        window.effectStarts=0;const AC=window.AudioContext;window.AudioContext=class extends AC{
          constructor(...a){super(...a);const create=this.createBufferSource.bind(this);this.createBufferSource=()=>{const n=create(),start=n.start.bind(n);n.start=(...a)=>{effectStarts++;return start(...a);};return n;};}
        };
      },profile);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(url+'/#/puzzles');await page.waitForFunction(()=>window.__ggBooted);
      const seed=await page.evaluate(async profile=>{
        const D=await import('/js/core/dynasty.js'), B=await import('/js/core/dynasty-battle.js'), F=await import('/js/core/features.js'),data=await import('/js/core/data.js');await D.load();
        if(!F.rivalsUpdated() || !D.tableOpen() || !D.bossLadderOpen())throw Error('Shared features missing');
        const s=D.mine();D.CARDS.slice(0,36).forEach(c=>s.o[c.id]=2);s.cr=73;s.sp=12;s.tr=19;s.so={g1:2,g2:1,g3:1,g4:1};
        s.pk={std:2,prem:1};s.dd=D.dayKey ? D.dayKey() : '2026-11-05';D.setDeck(D.autoDeck(s.o));D.touch();D.flush();
        const before=JSON.stringify(s),deck=s.dk.slice(),G=B.newGame('old-'+profile.key,[deck,deck],5);
        const move={a:'setup',act:G.p[1].hand.find(B.isBasic),bench:[]};B.play(G,1,move);
        const record={id:'legacy',opp:'g1',seed:'old-'+profile.key,v:5,decks:[deck,deck],log:[[1,move]],at:1,z:'',paid:0};
        localStorage.setItem('gg-dys2-'+profile.key,JSON.stringify(record));
        return {before,game:JSON.stringify(G),record:JSON.stringify(record),owner:data.isOwner(),coins:F.coinsUnlimited(profile.key),packs:F.packsUnlimited(profile.key)};
      },profile);
      assert.equal(seed.owner,profile.me==='evan');assert.equal(seed.coins,profile.me==='jayton');assert.equal(seed.packs,false,'no unlimited packs (Nov 10 2026)');
      await page.reload();await page.waitForFunction(()=>window.__ggBooted);
      const legacy=await page.evaluate(async key=>{
        const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js');await D.load();const x=S.get('legacy');
        return {save:JSON.stringify(D.mine()),game:JSON.stringify(x.G),record:localStorage.getItem('gg-dys2-'+key)};
      },profile.key);
      assert.equal(legacy.save,seed.before,'collections, balances, progress and claims preserved: '+profile.key);
      assert.equal(legacy.game,seed.game,'legacy v5 match unchanged: '+profile.key);assert.equal(legacy.record,seed.record);
      await page.evaluate(async()=>{
        const D = await import('/js/core/dynasty.js'); D.finishTutorial('skipped', (await import('/js/core/realm-active.js')).profileKey());
        (await import('/js/app.js')).nav('/puzzles/dynasty');
      });
      await page.waitForSelector('.pk-start.is-ready');await page.locator('.pk-start').click();
      await page.waitForFunction(()=>effectStarts>0);
      assert.deepEqual(await page.locator('.pk-tab').allTextContents(),['Home','Battle','Packs','Collection','Decks']);
      await page.locator('.pk-tab[data-dy-tab="packs"]').click();await page.waitForSelector('.pk-pack-shop');
      assert(await page.locator('.pk-pack-shop .is-printed').count()>0);
      await page.locator('.pk-tab[data-dy-tab="decks"]').click();await page.waitForSelector('.pocket-decks');
      assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty.js')).deckThemes().length),16);
      await page.locator('.pk-tab[data-dy-tab="battle"]').click();await page.waitForSelector('.rl-ladder');
      const fresh=await page.evaluate(async()=>{const S=await import('/js/core/dynasty-solo.js'),D=await import('/js/core/dynasty.js');const r=S.start('g5');if(!r.ok)throw Error(r.why);const x=S.get(r.mid);return {v:x.G.v,roundEnergy:x.G.roundEnergy,boss:x.boss,cards:x.G.p[0].hand.length+x.G.p[0].deck.length,owned:JSON.stringify(D.mine().o)};});
      assert.equal(fresh.v,7);assert.equal(fresh.roundEnergy,undefined,'manual Energy uses no legacy automatic grant');assert.equal(fresh.cards,20);assert.equal(fresh.boss,'L0036322');assert.equal(fresh.owned,JSON.stringify(JSON.parse(seed.before).o));
      await page.locator('[data-dy-menu]').click();await page.locator('[data-dy-m="music"]').click();await page.waitForSelector('[data-dy-music-volume]');
      assert.equal(await page.locator('[data-dy-music-volume]').inputValue(),'8','default background music');
      assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty-sfx.js')).state().volume),55,'default foreground effects');
      await page.locator('[data-dy-music-volume]').fill(String(20+index));await page.locator('[data-dy-music-toggle]').click();
      await page.waitForFunction(async()=>(await import('/js/core/dynasty-music.js')).state().playing);
      await page.evaluate(async v=>{const fx=await import('/js/core/dynasty-sfx.js');fx.setVolume(v);fx.setEnabled(false);},40+index);
      const prefs=await page.evaluate(key=>({music:JSON.parse(localStorage.getItem('gg-rivals-music:'+key+':v1')),fx:JSON.parse(localStorage.getItem('gg-rivals-sfx:'+key+':v1'))}),profile.key);
      assert.equal(prefs.music.volume,20+index);assert.equal(prefs.fx.volume,40+index);assert.equal(prefs.fx.enabled,false);
      const switched=await page.evaluate(async()=>{
        const data=await import('/js/core/data.js'),music=await import('/js/core/dynasty-music.js'),fx=await import('/js/core/dynasty-sfx.js');
        data.setGuest(null);data.setMe('mason');return {music:music.state(),fx:fx.state()};
      });assert.equal(switched.music.playing,false);assert.equal(switched.fx.volume,55);assert.equal(switched.fx.enabled,true);
      await page.evaluate(async p=>{const data=await import('/js/core/data.js');if(p.me)data.setMe(p.me);else data.setGuest(p.guest);},profile);
      const restored=await page.evaluate(async()=>({music:(await import('/js/core/dynasty-music.js')).state(),fx:(await import('/js/core/dynasty-sfx.js')).state()}));
      assert.equal(restored.music.volume,20+index);assert.equal(restored.music.playing,false);assert.equal(restored.fx.volume,40+index);assert.equal(restored.fx.enabled,false);
      await page.evaluate(async()=>(await import('/js/app.js')).nav('/puzzles/dynasty'));
      await page.reload();await page.waitForFunction(()=>window.__ggBooted);await page.waitForSelector('.pk-start.is-ready');
      assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty-sfx.js')).state().volume),40+index);
      // An open pack belongs to its original profile. Closing it on switch must not clear the next player's new-card flags.
      const other=profiles[(index+1)%profiles.length];
      await page.evaluate(async({profile,other})=>{
        const data=await import('/js/core/data.js'),D=await import('/js/core/dynasty.js');
        const pick=p=>p.me?data.setMe(p.me):data.setGuest(p.guest);
        pick(other);D.mine().o[D.CARDS[0].id]=1;D.mine().nw=[D.CARDS[0].id];D.touch();D.flush();window.nextProfileSave=JSON.stringify(D.mine());
        pick(profile);const O=await import('/js/views/dynasty-open.js'),V=await import('/js/views/dynasty.js');
        O.openScene({kind:'std',cards:[D.CARDS[0].id],dup:{},cardHTML:V.anyHTML,onClose:()=>{}});
        pick(other);
      },{profile,other});
      await page.waitForFunction(()=>!document.querySelector('div.pk-open'));
      const switchedSave=await page.evaluate(async()=>({after:(await import('/js/core/dynasty.js')).mine(),before:JSON.parse(nextProfileSave)}));
      assert.deepEqual(switchedSave.after,switchedSave.before,'pack close never clears another profile new-card flags');
      assert.deepEqual(errors,[]);
      console.log('PASS '+profile.key+': shared Home, packs, decks, ladder, v7 bosses, real music/effects, isolated settings; saves and old v5 match preserved');
      await context.close();
    }
  }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
