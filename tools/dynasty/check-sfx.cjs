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
// Probe real AudioBufferSourceNodes while preserving actual Web Audio playback.
async function main() {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  fs.mkdirSync(path.join(root,'output'),{recursive:true});
  const url='http://127.0.0.1:'+server.address().port;
  const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
    await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
    await context.addInitScript(()=>{
      localStorage.setItem('gg-me',localStorage.getItem('test-profile') || 'evan');
      localStorage.setItem('gg-welcome','1'); sessionStorage.setItem('gg-skip-title','1');
      localStorage.setItem('gg-release-3.0:evan','1');
      localStorage.setItem('gg-rivals-music:m_evan:v1',JSON.stringify({enabled:false,volume:35}));
      window.sfxProbes=[];window.sfxContexts=[];
      const AC=window.AudioContext;
      window.AudioContext=class extends AC {
        constructor(...args){ super(...args);sfxContexts.push(this);
          // Music's gain feeds the destination. Effects' gain feeds their limiter (a compressor).
          const gain=this.createGain.bind(this);
          this.createGain=()=>{const node=gain(),connect=node.connect.bind(node);node.connect=to=>{
            if(to===this.destination)window.musicOutputGain=node;
            else if(to instanceof DynamicsCompressorNode)window.effectsGain=node;
            return connect(to);
          };return node;};
          const original=this.createBufferSource.bind(this);
          this.createBufferSource=()=>{const s=original(),start=s.start.bind(s),stop=s.stop.bind(s);
            s.start=(...args)=>{const samples=s.buffer.getChannelData(0); let peak=0,energy=0;
              for(const n of samples){peak=Math.max(peak,Math.abs(n));energy+=n*n;}
              const probe={duration:s.buffer.duration,peak,rms:Math.sqrt(energy/samples.length),stopped:false,at:performance.now()};sfxProbes.push(probe);
              s.stop=(...a)=>{probe.stopped=true;return stop(...a);}; return start(...args);};return s;};
        }
      };
    });
    const page=await context.newPage(),errors=[]; page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(url+'/#/puzzles');await page.waitForFunction(()=>window.__ggBooted);
    await page.evaluate(async()=>{window.fx=await import('/js/core/dynasty-sfx.js');});
    await page.evaluate(async()=> (await import('/js/app.js')).nav('/puzzles/dynasty'));
    await page.waitForSelector('.pk-start.is-ready');
    assert.equal(await page.evaluate(()=>sfxContexts.length),0,'no context before a gesture');
    await page.locator('.pk-start').click();
    await page.waitForSelector('[data-dy-menu]');
    await page.evaluate(()=>{window.testFx=fx.attach(document.body);});
    // Each cue is bounded, non-silent PCM, without clipping or additional media downloads.
    for(const cue of await page.evaluate(()=>fx.CUES)) {
      const n=await page.evaluate(()=>sfxProbes.length);
      await page.evaluate(cue=>testFx.play(cue),cue);
      await page.waitForFunction(n=>sfxProbes.length>n,n);
      const p=await page.evaluate(()=>sfxProbes.at(-1));
      assert(p.peak>.02 && p.peak<.71 && p.rms>.005 && p.duration<1.6,cue+JSON.stringify(p));
      await page.evaluate(()=>testFx.hush());
    }
    await page.evaluate(async()=>{
      const music=await import('/js/core/dynasty-music.js');music.setVolume(8);music.setEnabled(true);
    });
    await page.waitForFunction(async()=>(await import('/js/core/dynasty-music.js')).state().playing);
    // Music sits under the effects and they never lower it (the owner, Nov 5 2026): its gain is slider × .7 × the song's
    // loudness level (its LUFS brought to -16; the menus shuffle, so whichever song is playing), held steady while a card
    // and an impact overlap.
    const musicGain=await page.evaluate(async()=>{const s=(await import('/js/core/dynasty-music.js')).state();return .08*.7*s.track.level;});
    await page.waitForFunction(g=>Math.abs(musicOutputGain.gain.value-g)<.0005,musicGain);
    const cuesBefore=await page.evaluate(()=>sfxProbes.length);
    await page.evaluate(()=>{window.endCard=testFx.play('card');window.endImpact=testFx.play('heavy');window.gainSeen=[];
      const t=setInterval(()=>gainSeen.push(musicOutputGain.gain.value),10);setTimeout(()=>clearInterval(t),450);});
    await page.waitForFunction(n=>sfxProbes.length>=n+2,cuesBefore);
    await page.waitForTimeout(500);
    const seen=await page.evaluate(()=>gainSeen);
    assert(seen.length>20 && seen.every(g=>Math.abs(g-musicGain)<.0005),'effects never lower the music: '+JSON.stringify(seen.slice(0,6)));
    assert(Math.abs(await page.evaluate(()=>effectsGain.gain.value)-1.1)<.01,'effects play at slider 55% × 2 (was × .65)');
    await page.evaluate(()=>{endCard();endImpact();});
    await page.evaluate(async()=>{const m=await import('/js/core/dynasty-music.js');if(m.state().volume!==8)throw Error('effect changed slider');m.setEnabled(false);});
    console.log('PASS: music holds steady under overlapping card and impact sounds; effects play well above it');
    const quietCount=await page.evaluate(()=>sfxProbes.length);
    await page.evaluate(()=>{fx.setVolume(0);testFx.play('victory');});await page.waitForTimeout(80);
    assert.equal(await page.evaluate(()=>sfxProbes.length),quietCount,'zero volume skips playback');
    await page.evaluate(()=>fx.setVolume(55));
    await page.evaluate(()=>{testFx.play('mythic',{delay:1});dispatchEvent(new PageTransitionEvent('pagehide'));});
    await page.waitForFunction(()=>sfxProbes.every(p=>p.stopped));
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
    console.log(`PASS: all ${(await page.evaluate(()=>fx.CUES)).length} cues create non-silent, peak-limited audio buffers; zero volume and background silence`);
    await page.evaluate(()=>{testFx.play('mythic',{delay:1});testFx.hush();});
    const count=await page.evaluate(()=>sfxProbes.length);await page.waitForTimeout(80);
    assert.equal(await page.evaluate(()=>sfxProbes.length),count,'cancel pending resume');
    await page.evaluate(()=>testFx.stop());
    await page.locator('[data-dy-menu]').click();await page.locator('[data-dy-m="music"]').click();
    await page.locator('[data-dy-sfx-volume]').fill('23');
    assert.equal(await page.evaluate(()=>fx.state().volume),23);
    await page.locator('[data-dy-sfx-toggle]').click();
    assert.equal(await page.evaluate(()=>fx.state().enabled),false);
    assert.equal(await page.evaluate(async()=>(await import('/js/core/dynasty-music.js')).state().enabled),false);
    await page.reload();await page.waitForFunction(()=>window.__ggBooted);
    assert.deepEqual(await page.evaluate(async()=>{const s=(await import('/js/core/dynasty-sfx.js')).state();return [s.enabled,s.volume];}),[false,23]);
    await page.waitForSelector('.pk-start.is-ready');await page.locator('.pk-start').click();
    await page.locator('[data-dy-menu]').click();await page.locator('[data-dy-m="music"]').click();
    await page.locator('[data-dy-sfx-toggle]').click();await page.locator('.sheet-close').last().click();
    await page.evaluate(async()=>{window.fx=await import('/js/core/dynasty-sfx.js');window.testFx=fx.attach(document.body);});
    await page.locator('[data-dy-menu]').click();await page.locator('.sheet-close').last().click();
    await page.evaluate(()=>{testFx.play('mythic');});
    await page.waitForFunction(()=>sfxProbes.some(p=>!p.stopped));
    await page.evaluate(async()=>(await import('/js/core/data.js')).setMe('mason'));
    await page.waitForFunction(()=>sfxProbes.every(p=>p.stopped));
    const before=await page.evaluate(()=>sfxProbes.length);await page.evaluate(()=>testFx.play('victory'));await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>sfxProbes.length),before);
    console.log('PASS: separate controls persist; pending/active audio cancels; profile switch immediately silences effects');
    await page.evaluate(async()=>{localStorage.removeItem('test-profile');(await import('/js/core/data.js')).setMe('evan');fx.setEnabled(true);fx.setVolume(55);testFx.stop();});
    const fixture=await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),B=await import('/js/core/dynasty-battle.js'),T=await import('/js/core/dynasty-table.js');
      await D.load(); const s=D.mine(), players=D.CARDS.filter(c=>c.pos==='QB').slice(0,20).map(c=>c.id);
      players.forEach(id=>s.o[id]=2);D.setDeck([...players.slice(0,9).flatMap(id=>[id,id]),'C-twomin','C-twomin']);
      // This regression intentionally resumes a v6 table to verify its existing cues.
      // New v7 starts and manual Energy are covered by check-pocket-integration.cjs.
      const old=JSON.stringify(s.dk);
      const deck=[...players.slice(0,16).flatMap(id=>[id,id]),...Object.keys(T.PLAYBOOK).flatMap(id=>[id,id])];
      let g,seed;for(let n=0;n<5000;n++){seed='ui'+n;g=B.newGame(seed,[deck,deck],6);const h=g.p[0].hand;if(g.first===0&&h.includes('I-charge')&&h.includes('I-draw')&&h.filter(B.isBasic).length>=2)break;}
      const h=g.p[0].hand;if(!h.includes('I-charge')||!h.includes('I-draw'))throw Error('no fixture seed');
      const move={a:'setup',act:g.p[1].hand.find(B.isBasic),bench:[]};
      localStorage.setItem('gg-dys-m_evan',JSON.stringify({id:'cputable',opp:'g1',seed,v:6,decks:[deck,deck],log:[[1,move]],at:Date.now(),z:'',paid:0}));
      D.touch();D.flush();return {players:h.map((id,i)=>B.isBasic(id)?i:null).filter(i=>i!=null),charge:h.indexOf('I-charge'),draw:h.indexOf('I-draw'),friend:old};
    });

    await page.goto(url+'/#/puzzles/dynasty/battle/cputable'); await page.reload(); await page.waitForSelector('.is-owner-table');
    await page.locator('[data-db-coin]').click();await page.waitForFunction(()=>sfxProbes.some(p=>Math.abs(p.duration-.65)<.001));
    await page.locator('[data-db-skip]').click();
    await page.locator(`[data-db-hand="${fixture.players[0]}"]`).click();
    await page.locator('[data-db-lineup="act"]').click();
    await page.locator('[data-db-ready]').click();await page.waitForTimeout(500);
    const charge=await page.evaluate(async()=>(await import('/js/core/dynasty-solo.js')).get('cputable').G.p[0].hand.indexOf('I-charge'));
    await page.locator(`[data-db-hand="${charge}"]`).click();
    await page.waitForSelector('[data-db-play-hand]');await page.locator('[data-db-play-hand]').click();
    const target=page.locator('.is-me .is-active [data-db-slot]');
    if(await target.getAttribute('class').then(c=>c.includes('is-pick')))await target.click();
    await page.waitForFunction(()=>sfxProbes.some(p=>Math.abs(p.duration-.5)<.001));
    await page.waitForTimeout(1200);
    await page.locator('.is-me .is-active [data-db-slot]').click();
    await page.locator('[data-db-attack="2"]').click();await page.waitForSelector('[data-db-coin]');
    const attack=await page.evaluate(async()=>(await import('/js/core/dynasty-solo.js')).get('cputable').G.ev.filter(e=>e.k==='attack').at(-1));
    const countBefore=await page.evaluate(()=>sfxProbes.length);
    await page.locator('[data-db-coin]').click();
    await page.waitForFunction(n=>sfxProbes.length>=n+2,countBefore);
    const expected=attack.missed || !attack.dmg?.valueOf() ? .24 : attack.dmg>=70 ? .4 : .25;
    assert(Math.abs((await page.evaluate(()=>sfxProbes.at(-1).duration))-expected)<.001,'resolved attack cue matches hit/miss');
    await page.locator('[data-db-skip]').click();await page.waitForTimeout(1800);
    await page.evaluate(async()=>(await import('/js/core/dynasty-solo.js')).resign('cputable'));
    await page.waitForFunction(()=>sfxProbes.some(p=>Math.abs(p.duration-.9)<.001));
    await page.reload();await page.waitForSelector('.is-owner-table');await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>sfxProbes.length),0,'saved match does not replay sounds');
    console.log('PASS: real coin, card, item and attack cues; saved matches do not replay sounds');
    await page.evaluate(async()=> (await import('/js/app.js')).nav('/puzzles/dynasty'));
    await page.waitForSelector('.pk-start.is-ready');await page.locator('.pk-start').click();
    await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'), V=await import('/js/views/dynasty.js'), O=await import('/js/views/dynasty-open.js');await D.load();
      const card=D.CARDS.find(c=>c.r==='mythic');
      O.openScene({kind:'std',cards:[card.id],dup:{},cardHTML:V.anyHTML,onClose:()=>{}});
    });
    await page.locator('[data-dy-carousel]').focus();await page.keyboard.press('Enter');
    await page.waitForSelector('[data-dy-tear]:not([hidden])');await page.locator('[data-dy-tear]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>sfxProbes.some(p=>Math.abs(p.duration-.55)<.001));
    await page.waitForFunction(()=>sfxProbes.some(p=>Math.abs(p.duration-1.4)<.001));
    await page.keyboard.press('Escape');await page.waitForTimeout(80);
    assert(await page.evaluate(()=>sfxProbes.every(p=>p.stopped)),'closing pack cancels its sounds');
    await page.locator('[data-dy-menu]').click();await page.locator('[data-dy-m="music"]').click();
    await page.waitForSelector('[data-dy-sfx-volume]');
    await page.locator('[data-dy-sfx-volume]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'settings fit phone width');
    await page.screenshot({path:path.join(root,'output/rivals-sfx-settings.png')});
    await page.locator('.sheet-close').last().click();
    await page.evaluate(async()=>{window.fx=await import('/js/core/dynasty-sfx.js');window.testFx=fx.attach(document.body);testFx.play('mythic',{delay:1});testFx.visible(false);});
    const hiddenCount=await page.evaluate(()=>sfxProbes.length);await page.waitForTimeout(80);
    assert.equal(await page.evaluate(()=>sfxProbes.length),hiddenCount,'hidden client drops queued effects');
    await page.evaluate(()=>testFx.stop());
    await page.evaluate(async()=> (await import('/js/app.js')).nav('/puzzles'));
    await page.waitForFunction(()=>sfxContexts.every(c=>c.state!=='running'));
    console.log('PASS: foil tear and mythic reveal in actual pack flow; close, hide, and navigation cancel audio');
    // Other profiles, guests and unselected players never create an effects context.
    for(const profile of ['mason','user:ryan-dow','guest:Sound Test','guest:Evan Appenzeller','']) {
      await page.evaluate(profile=>localStorage.setItem('test-profile',profile || 'none'),profile);
      await page.reload();await page.waitForFunction(()=>window.__ggBooted);
      await page.evaluate(async profile=>{
        const data=await import('/js/core/data.js');data.setGuest(null);
        if(profile.startsWith('user:')) data.setGuest(data.USERS.find(u=>u.id===profile.slice(5)).name);
        else if(profile.startsWith('guest:')) data.setGuest(profile.slice(6));
        else data.setMe(profile || null);
        if(data.isOwner())throw Error('Non-owner fixture selected the owner');
        if(profile.startsWith('user:') && data.user()?.id!==profile.slice(5))throw Error('App-user fixture missing');
        window.fx=await import('/js/core/dynasty-sfx.js');window.testFx=fx.attach(document.body);
      },profile);
      await page.locator('body').click({position:{x:5,y:5}});
      await page.evaluate(()=>testFx.play('victory'));
      assert.equal(await page.evaluate(()=>sfxProbes.length),0,profile);
      assert.equal(await page.evaluate(()=>sfxContexts.length),0,profile);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: non-owner profiles and visitors stay silent; no browser exceptions');
    await context.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
    await page.reload();await page.waitForFunction(()=>window.__ggBooted);
    await page.evaluate(async()=>{(await import('/js/core/data.js')).setMe('evan');window.fx=await import('/js/core/dynasty-sfx.js');window.testFx=fx.attach(document.body);});
    await page.locator('body').click({position:{x:5,y:5}});await page.evaluate(()=>testFx.play('victory'));
    assert.equal(await page.evaluate(()=>fx.state().supported),false);
    assert.deepEqual(errors,[],'unsupported audio remains playable');
    console.log('PASS: missing Web Audio support fails silently without blocking the game');
    await context.close();
  } finally {await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
