// Offline visual regression: energy identifies the whole player face across rarity and size.
// Uses the real renderer with fixture-only energy variants. No Firebase or remote requests.
// Usage: node tools/dynasty/check-energy-faces.cjs [--shots=<directory>]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); }
catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const shots = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
if (shots) fs.mkdirSync(shots, {recursive:true});
const css = ['tokens','base','components','views/dynasty','views/dynasty-open','views/dynasty-rivals','views/dynasty-rarity','views/dynasty-pocket'];
const fixture = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
  + css.map(f => `<link rel="stylesheet" href="/css/${f}.css">`).join('')
  + '<style>html,body{height:auto;overflow:auto;background:#eaf3f8}main{display:flex;flex-wrap:wrap;gap:20px;padding:20px}figure{flex:none;margin:0}</style><main class="pk-sheet"></main>';
const mime = {'.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (pathname === '/__energy') return res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);
  let file; try { file = path.resolve(root,'.'+decodeURIComponent(pathname)); }
  catch { return res.writeHead(400).end(); }
  if (!file.startsWith(root+path.sep)) return res.writeHead(403).end();
  fs.readFile(file,(error,bytes) => error ? res.writeHead(404).end() : res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes));
});

// Read real text ink as well as CSS boxes: a large name can overflow its line box
// without scrollWidth/scrollHeight revealing that the last letters were clipped.
async function nameGeometry(page, label) {
  const result=await page.locator('figure .pk-card').evaluateAll(cards=>cards.map(card=>{
    const q=s=>card.querySelector(s),rect=el=>el.getBoundingClientRect();
    const name=q('.pk-c-name'),hp=q('.pk-c-hp'),head=rect(q('.pk-c-head'));
    const banner=rect(q('.pk-c-energy')),art=rect(q('.pk-c-art')),face=q('.pk-c-face');
    const nr=rect(name),hr=rect(hp),nameStyle=getComputedStyle(name);
    const range=document.createRange();range.selectNodeContents(name);const ink=rect(range);
    return {name:card.getAttribute('aria-label'),headline:parseFloat(nameStyle.fontSize)>parseFloat(getComputedStyle(hp).fontSize),
      nameFits:ink.left>=head.left-1 && ink.right<=head.right+1 && ink.top>=head.top-1 && ink.bottom<=head.bottom+1,
      separated:nr.right<=hr.left+1 && ink.right<=hr.left+1 && head.bottom<=banner.top+1 && banner.bottom<=art.top+1,
      unclipped:nameStyle.textOverflow!=='ellipsis' && (nameStyle.overflowX==='visible' || name.scrollWidth<=name.clientWidth+1) && (nameStyle.overflowY==='visible' || name.scrollHeight<=name.clientHeight+1),
      faceFits:face.scrollHeight<=face.clientHeight+1 && face.scrollWidth<=face.clientWidth+1,
      inkOverflow:{left:head.left-ink.left,right:ink.right-head.right,top:head.top-ink.top,bottom:ink.bottom-head.bottom},
      faceOverflow:{x:face.scrollWidth-face.clientWidth,y:face.scrollHeight-face.clientHeight}};
  }));
  const failures=result.filter(row=>!row.headline || !row.nameFits || !row.separated || !row.unclipped || !row.faceFits);
  assert.equal(failures.length,0,label+': every full player name is the headline, with separate HP, banner and portrait; '+JSON.stringify(failures.slice(0,8)));
  return result.length;
}

async function run(url) {
  const browser = await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined)});
  try {
    const context = await browser.newContext({viewport:{width:1200,height:950},serviceWorkers:'block',reducedMotion:'reduce'});
    await context.route('**/*', route => route.request().url().startsWith(url+'/') ? route.continue() : route.abort());
    await context.addInitScript(() => {localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');});
    const page = await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(url+'/__energy');
    const matrix = await page.evaluate(async () => {
      const D=await import('/js/core/dynasty.js'), PC=await import('/js/core/dynasty-pocket-cards.js'), V=await import('/js/views/dynasty.js');
      await (await import('/js/core/data.js')).load(); await D.load();
      if ((await import('/js/core/fire.js')).canWrite()) throw Error('Live writes enabled');
      const energies=['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Colorless','Dragon'];
      const cards=D.RARITY.map(r=>D.CARDS.find(c=>c.r===r && c.s!=='X'));
      const widths=[280,160,92];
      document.querySelector('main').innerHTML=widths.map(width=>energies.map(energy=>cards.map(c=>{
        const pc={...PC.card(c.id),types:[energy]};
        return `<figure data-energy="${energy}" data-rarity="${c.r}" data-width="${width}" style="width:${width}px">${V.cardHTML(c,{size:width===280?'l':'s',tag:false,noCount:true,pocketCard:pc})}</figure>`;
      }).join('')).join('')).join('');
      return {energies,rarities:D.RARITY,widths};
    });
    await page.evaluate(()=>document.fonts.ready);
    await nameGeometry(page,'Energy/rarity/size matrix');
    const rows=await page.locator('figure').evaluateAll(figures=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
      const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
      const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      return figures.map(figure=>{
        const card=figure.querySelector('.pk-card'),face=card.querySelector('.pk-c-face'),badge=card.querySelector('.pk-c-energy'),logo=badge?.querySelector('svg');
        const rect=el=>el.getBoundingClientRect(),cr=rect(card),br=rect(badge),lr=rect(logo),art=rect(card.querySelector('.pk-c-art'));
        const head=card.querySelector('.pk-c-head'),name=card.querySelector('.pk-c-name'),attack=card.querySelector('.pk-c-atk>b');
        const bg=el=>rgb(getComputedStyle(el).backgroundColor),ink=el=>rgb(getComputedStyle(el).color);
        const paper=bg(face),header=bg(head),body=bg(card.querySelector('.pk-c-body'));
        return {...figure.dataset,marked:card.classList.contains('pk-energy-card'),badge:badge.dataset.cardEnergy,visibleLabel:!!badge.querySelector('b,small'),symbolLabel:badge.querySelector('.pk-e')?.title,accessibleLabel:card.getAttribute('aria-label'),
          paper,header,body,nameContrast:contrast(ink(name),header),attackContrast:contrast(ink(attack),body),bannerRatio:br.height/cr.width,
          logoRatio:Math.min(lr.width,lr.height)/cr.width,vector:!!logo.querySelector('path,circle'),
          fits:face.scrollHeight<=face.clientHeight+1 && face.scrollWidth<=face.clientWidth+1,
          badgeFits:br.left>=cr.left && br.right<=cr.right && br.bottom<=art.top+1 && badge.scrollWidth<=badge.clientWidth+1,
          foil:!!card.querySelector('.pk-c-foil'),motion:card.getAnimations({subtree:true}).some(a=>a.playState==='running')};
      });
    });
    assert.equal(rows.length,matrix.energies.length*matrix.rarities.length*matrix.widths.length);
    for (const r of rows) {
      const label=`${r.energy}/${r.rarity}/${r.width}`;
      assert(r.marked,label+': authorized energy face'); assert.equal(r.badge,r.energy,label);
      assert.equal(r.visibleLabel,false,label+': banner has no visible Energy text');
      assert.equal(r.symbolLabel,r.energy,label+': symbol keeps its Energy title');
      assert(r.accessibleLabel.includes(r.energy),label+': accessible card name retains Energy');
      for(const [part,color] of [['paper',r.paper],['header',r.header],['body',r.body]]) {
        assert.equal(color[3],255,label+': opaque '+part);assert(Math.min(...color.slice(0,3))<230,label+': '+part+' is visibly tinted');
      }
      assert(r.nameContrast>=4.5,label+': name contrast '+r.nameContrast);assert(r.attackContrast>=4.5,label+': attack contrast '+r.attackContrast);
      assert(r.bannerRatio<=.18,label+': slimmer banner gives the portrait more room');
      assert(r.logoRatio>=.095 && r.vector,label+': prominent vector logo');assert(r.fits && r.badgeFits,label+': content remains inside card');
      assert.equal(r.foil,r.rarity!=='common',label+': rarity finish retained');assert.equal(r.motion,false,label+': reduced motion');
    }
    for(const energy of matrix.energies) assert.equal(new Set(rows.filter(r=>r.energy===energy).map(r=>r.paper.join(','))).size,1,energy+': same energy paper across every rarity and size');
    assert.equal(new Set(rows.filter(r=>r.width==='280' && r.rarity==='common').map(r=>r.paper.join(','))).size,10,'all ten energy colors stay distinct');
    if(shots) await page.screenshot({path:path.join(shots,'energy-cards.png'),fullPage:false});

    // All real names, plus their development forms. The same proportional layout must
    // survive the smallest collection cards and a phone's full detail card.
    let catalogCount=0;
    for(const width of [92,280]) {
      catalogCount=await page.evaluate(async width=>{
        const D=await import('/js/core/dynasty.js'),PC=await import('/js/core/dynasty-pocket-cards.js'),V=await import('/js/views/dynasty.js');
        const base=D.CARDS;
        const long=[...base].sort((a,b)=>b.name.length-a.name.length).slice(0,12);
        const samples=base.map(c=>({c,pc:PC.card(c.id)})).concat(long.flatMap(c=>['breakout','prime'].map(form=>({c,pc:PC.card(c.id+'~'+form)}))));
        document.querySelector('main').innerHTML=samples.map(({c,pc})=>`<figure style="width:${width}px">${V.cardHTML(c,{size:width===280?'l':'s',tag:false,pocketCard:pc})}</figure>`).join('');
        return samples.length;
      },width);
      await page.evaluate(()=>document.fonts.ready);
      await nameGeometry(page,'Catalog at '+width+'px');
      const portraitMinimum=await page.locator('figure .pk-card').evaluateAll(cards=>Math.min(...cards.map(card=>card.querySelector('.pk-c-art').getBoundingClientRect().height/card.getBoundingClientRect().width)));
      assert(portraitMinimum>=.345,'Normal catalog portraits retain at least 35% of card width (allowing subpixel rounding)');
    }
    // A failed font download must not make the longest athletes unreadable.
    const fallback=await page.addStyleTag({content:'.pk-c-head .pk-c-name{font-family:Arial,sans-serif!important}'});
    await nameGeometry(page,'Catalog with fallback font');
    await fallback.evaluate(el=>el.remove());

    const artwork=await page.evaluate(async energies=>{
      const {energyBannerUrl}=await import('/js/views/dynasty-energy.js');
      return Promise.all(energies.map(async energy=>{
        const image=new Image(),src=energyBannerUrl(energy);image.src=src;
        try {await image.decode();return {energy,src,ok:true,width:image.naturalWidth,height:image.naturalHeight};}
        catch {return {energy,src,ok:false};}
      }));
    },matrix.energies);
    for(const art of artwork) {
      assert(art.ok,art.energy+': calling-card artwork loads from '+art.src);
      assert(art.width>=640 && art.width/art.height>=3,art.energy+': sufficiently detailed panoramic art');
    }
    assert.equal(new Set(artwork.map(a=>a.src)).size,matrix.energies.length,'each current Energy has its own illustrated banner');

    // Phone reference shots and missing-art fallback use actual athletes, not renamed fixtures.
    for(const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(async width=>{
        const D=await import('/js/core/dynasty.js'),V=await import('/js/views/dynasty.js');
        const players=[D.CARDS.find(c=>c.name==='Brett Favre'),D.CARDS.find(c=>c.name==='T.J. Watt'),[...D.CARDS].sort((a,b)=>b.name.length-a.name.length)[0]];
        document.querySelector('main').innerHTML=players.map(c=>`<figure style="width:${width-40}px">${V.cardHTML(c,{size:'l',tag:false,eager:true})}</figure>`).join('');
      },width);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.pk-c-energy-art')].map(img=>img.decode()));await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
      await nameGeometry(page,'Phone '+width);
      if(shots) {
        await page.screenshot({path:path.join(shots,'calling-cards-'+width+'.png'),fullPage:true});
        await page.locator('figure').first().screenshot({path:path.join(shots,'brett-favre-'+width+'.png')});
        await page.locator('figure').nth(1).screenshot({path:path.join(shots,'tj-watt-'+width+'.png')});
      }
    }
    await page.route('**/energy-banners/*',route=>route.abort());
    await page.evaluate(()=>document.querySelectorAll('.pk-c-energy-art').forEach(img=>{img.src += '?unavailable';}));
    await page.waitForFunction(()=>!document.querySelector('.pk-c-energy-art'));
    await nameGeometry(page,'Unavailable banner artwork');
    assert(await page.locator('.pk-c-energy').evaluateAll(banners=>banners.every(b=>!b.querySelector('b,small') && b.querySelector('.pk-e')?.title===b.dataset.cardEnergy && b.querySelector('svg')?.getBoundingClientRect().width>0)),'Energy symbols and accessible names survive missing art without visible labels');
    if(shots) await page.screenshot({path:path.join(shots,'calling-cards-fallback.png'),fullPage:true});

    // Compact contact sheet shows all ten visual identities and their Energy symbols.
    if(shots) {
      await page.unroute('**/energy-banners/*');
      await page.setViewportSize({width:900,height:900});
      await page.evaluate(async energies=>{
        const D=await import('/js/core/dynasty.js'),PC=await import('/js/core/dynasty-pocket-cards.js'),V=await import('/js/views/dynasty.js');
        const c=D.CARDS.find(c=>c.name==='Brett Favre');
        const main=document.querySelector('main');
        main.innerHTML=energies.map(energy=>`<figure style="width:400px">${V.cardHTML(c,{size:'l',tag:false,eager:true,pocketCard:{...PC.card(c.id),types:[energy]}})}</figure>`).join('');
        main.querySelectorAll('.pk-c-face').forEach(face=>[...face.children].filter(el=>!el.matches('.pk-c-energy')).forEach(el=>el.remove()));
      },matrix.energies);
      const sheet=await page.addStyleTag({content:'.pk-card.pk-rivals-card{aspect-ratio:auto!important;height:64px!important}.pk-card.pk-rivals-card .pk-c-face{padding:0!important;background:transparent!important;box-shadow:none!important}.pk-c-energy{margin:0!important;height:100%!important}'});
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.pk-c-energy-art')].map(img=>img.decode()));});
      await page.screenshot({path:path.join(shots,'energy-banners.png'),fullPage:true});
      await sheet.evaluate(el=>el.remove());
    }
    const scope=await page.evaluate(async()=>{
      const data=await import('/js/core/data.js'),D=await import('/js/core/dynasty.js'),V=await import('/js/views/dynasty.js');
      const c=D.CARDS[0],out=[];
      for(const [member,guest,allowed] of [['evan','',true],['jayton','',true],[null,'Ryan Stewart',true],[null,'Ryan Younggreen',true],['mason','',false],[null,'Evan Appenzeller',false],[null,'',false]]) {
        data.setMe(member);data.setGuest(guest);if(member)data.setMe(member);
        const before=JSON.stringify(D.mine()),markup=V.cardHTML(c,{tag:false});
        out.push({member,guest,allowed,marked:markup.includes('pk-energy-card'),unchanged:JSON.stringify(D.mine())===before});
      }
      return out;
    });
    for(const row of scope){assert.equal(row.marked,row.allowed,JSON.stringify(row));assert(row.unchanged,'rendering does not change saves');}
    assert.deepEqual(errors,[]);
    console.log('PASS 120 player faces: ten distinct energy colors across four rarities and three sizes, readable contrast, prominent logos, intact geometry, rarity foil and reduced motion.');
    console.log('PASS '+catalogCount+' catalog/development names at compact and detail sizes, fallback fonts, ten panoramic assets, 320/390px phone cards and unavailable-art fallback.');
    console.log('PASS four-profile energy presentation, excluded member/guest/unselected boundaries, and unchanged saves.');
    await context.close();
  } finally {await browser.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
