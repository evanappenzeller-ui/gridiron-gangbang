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
        return {...figure.dataset,marked:card.classList.contains('pk-energy-card'),badge:badge.dataset.cardEnergy,text:badge.querySelector('b').firstChild.textContent,
          paper,header,body,nameContrast:contrast(ink(name),header),attackContrast:contrast(ink(attack),body),badgeContrast:contrast(ink(badge),bg(badge)),
          logoRatio:Math.min(lr.width,lr.height)/cr.width,vector:!!logo.querySelector('path,circle'),
          fits:face.scrollHeight<=face.clientHeight+1 && face.scrollWidth<=face.clientWidth+1,
          badgeFits:br.left>=cr.left && br.right<=cr.right && br.bottom<=art.top+1 && badge.scrollWidth<=badge.clientWidth+1,
          foil:!!card.querySelector('.pk-c-foil'),motion:card.getAnimations({subtree:true}).some(a=>a.playState==='running')};
      });
    });
    assert.equal(rows.length,matrix.energies.length*matrix.rarities.length*matrix.widths.length);
    for (const r of rows) {
      const label=`${r.energy}/${r.rarity}/${r.width}`;
      assert(r.marked,label+': authorized energy face'); assert.equal(r.badge,r.energy,label); assert.equal(r.text,r.energy,label);
      for(const [part,color] of [['paper',r.paper],['header',r.header],['body',r.body]]) {
        assert.equal(color[3],255,label+': opaque '+part);assert(Math.min(...color.slice(0,3))<230,label+': '+part+' is visibly tinted');
      }
      assert(r.nameContrast>=4.5,label+': name contrast '+r.nameContrast);assert(r.attackContrast>=4.5,label+': attack contrast '+r.attackContrast);
      assert(r.badgeContrast>=4.5,label+': energy label contrast '+r.badgeContrast);
      assert(r.logoRatio>=.095 && r.vector,label+': prominent vector logo');assert(r.fits && r.badgeFits,label+': content remains inside card');
      assert.equal(r.foil,r.rarity!=='common',label+': rarity finish retained');assert.equal(r.motion,false,label+': reduced motion');
    }
    for(const energy of matrix.energies) assert.equal(new Set(rows.filter(r=>r.energy===energy).map(r=>r.paper.join(','))).size,1,energy+': same energy paper across every rarity and size');
    assert.equal(new Set(rows.filter(r=>r.width==='280' && r.rarity==='common').map(r=>r.paper.join(','))).size,10,'all ten energy colors stay distinct');
    if(shots) await page.screenshot({path:path.join(shots,'energy-cards.png'),fullPage:false});
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
    console.log('PASS four-profile energy presentation, excluded member/guest/unselected boundaries, and unchanged saves.');
    await context.close();
  } finally {await browser.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
