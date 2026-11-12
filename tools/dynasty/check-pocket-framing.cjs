// Offline, presentation-only stress fixture. No Firebase or external requests.
// Usage: node tools/dynasty/check-pocket-framing.cjs [--diagnostic] [--baseline] [--out=output/rivals-framing] [--compare=output/rivals-framing-before/measurements.json]
// --baseline serves HEAD's Pocket CSS so before/after runs share identical cards.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {execFileSync} = require('node:child_process');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const diagnostic = process.argv.includes('--diagnostic'), baseline = process.argv.includes('--baseline');
const out = path.resolve(root, process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'output/rivals-framing');
fs.mkdirSync(out, {recursive:true});
const baselineCSS = baseline ? execFileSync('git', ['show','HEAD:css/views/dynasty-pocket.css'], {cwd:root}) : null;
const compareFile=process.argv.find(a=>a.startsWith('--compare='))?.slice(10);
const before=compareFile ? JSON.parse(fs.readFileSync(path.resolve(root,compareFile),'utf8')).results : null;
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/,'$1{}$2'));
    if (baselineCSS && file === path.join(root,'css/views/dynasty-pocket.css')) bytes = baselineCSS;
    // Exercise notch/home-indicator reservations consistently in desktop Chromium.
    if (file.endsWith('.css')) bytes = Buffer.from(bytes.toString().replace(/env\(safe-area-inset-(top|right|bottom|left)(?:\s*,[^)]*)?\)/g,(_,edge)=>`var(--framing-sa-${edge}, 0px)`));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  });
});
async function measurements(page) {
  return page.evaluate(() => {
    const rect = el => {const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const inside = r => r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1;
    const overlaps = (a,b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    const hit = el => {const r=rect(el);return [[r.left+Math.min(5,r.width/4),r.top+r.height/2],[r.right-Math.min(5,r.width/4),r.top+r.height/2],[r.left+r.width/2,r.top+Math.min(5,r.height/4)],[r.left+r.width/2,r.bottom-Math.min(5,r.height/4)],[r.left+r.width/2,r.top+r.height/2]].every(([x,y])=>el.contains(document.elementFromPoint(x,y)));};
    const box = (el,label) => ({label,...rect(el),inside:inside(rect(el))});
    const rows = ['.is-opponent>.rp-bench','.is-opponent>.rp-active','.is-mine>.rp-active','.is-mine>.rp-bench'].map((selector,i)=>({selector,items:[...document.querySelectorAll(selector+' > .rp-card')].map((el,j)=>({
      ...box(el,`row${i}-card${j}`),clear:hit(el), hp:box(el.querySelector('.rp-live-hp'),'HP'), energy:box(el.querySelector('.rp-card-energy'),'Energy'),
      fonts:[...el.querySelectorAll('.pk-c-atk>b,.pk-c-atk>em,.pk-c-fx')].map(n=>({text:n.textContent,font:parseFloat(getComputedStyle(n).fontSize),...rect(n)}))
    }))}));
    const selectors = ['.rp-top','.rp-status','.rp-manager.is-mine','.rp-manager.is-opponent','.rp-deck.is-mine','.rp-deck.is-opponent','.rp-discard.is-mine','.rp-discard.is-opponent','.rp-energy-zone.is-mine','.rp-energy-zone.is-opponent','.rp-menu','.rp-stadium','.rp-opponent-hand','.rp-expand-hand','.rp-turn-action','.pk-sound','.pk-sound-menu'];
    const pieces = selectors.flatMap(selector=>[...document.querySelectorAll('.v-dynasty-battle '+selector)].filter(el=>el.getClientRects().length&&rect(el).width>0).map(el=>({...box(el,selector),clear:hit(el),button:el.tagName==='BUTTON'&&!el.disabled})));
    const controls = [...document.querySelectorAll('.rp-top button,.rp-turn-action button,.rp-stadium button')].map((el,i)=>({...box(el,'control'+i+':'+el.textContent.trim()),clear:hit(el),button:!el.disabled}));
    const hand = [...document.querySelectorAll('.rp-hand>.rp-card')].map((el,i)=>box(el,'hand'+i));
    const failures=[];
    if(document.documentElement.scrollWidth>document.documentElement.clientWidth+1) failures.push('horizontal page overflow');
    const screen=document.querySelector('.screen.v-dynasty-battle');
    if(screen.scrollHeight>screen.clientHeight+1) failures.push('battle screen scrolls vertically');
    if(rows.flatMap(r=>r.items).length!==8) failures.push('fixture must show all eight athletes');
    for(const row of rows) for(const card of row.items) {
      if(!card.inside||!card.hp.inside||!card.energy.inside)failures.push(card.label+' or its HP/Energy is clipped');
      if(!card.clear)failures.push(card.label+' is covered');
      if(card.width<44||card.height<44)failures.push(card.label+' is smaller than a touch target');
    }
    for(let i=0;i<rows.length-1;i++)for(const a of rows[i].items)for(const b of rows[i+1].items) {
      const aa=[a,a.hp,a.energy],bb=[b,b.hp,b.energy];
      if(aa.some(ar=>bb.some(br=>overlaps(ar,br))))failures.push(a.label+' overlaps '+b.label+' or its HP/Energy');
    }
    const status=pieces.find(p=>p.label==='.rp-status');
    for(const c of rows.flatMap(r=>r.items))if([c,c.hp,c.energy].some(r=>overlaps(r,status)))failures.push(c.label+' overlaps turn status');
    for(const p of [...pieces,...controls]) {
      if(!p.inside)failures.push(p.label+' is clipped');
      if(p.button&&!p.clear)failures.push(p.label+' is covered');
      if(p.label.includes('rp-manager')&&!p.clear)failures.push(p.label+' is covered');
    }
    // These independent rail pieces must not cover one another, including the
    // noninteractive deck stacks that a pointer-only assertion would overlook.
    const rail=pieces.filter(p=>/rp-(manager|deck|discard|energy-zone|menu|stadium|opponent-hand)/.test(p.label)).map(p=>{
      const label=document.querySelector('.v-dynasty-battle '+p.label+(p.label.includes('rp-deck')?' > b':p.label.includes('rp-opponent-hand')?' > small':' > .framing-no-label'));
      if(!label)return p;const r=rect(label);
      return {...p,left:Math.min(p.left,r.left),right:Math.max(p.right,r.right),top:Math.min(p.top,r.top),bottom:Math.max(p.bottom,r.bottom)};
    });
    for(let i=0;i<rail.length;i++)for(let j=i+1;j<rail.length;j++)if(overlaps(rail[i],rail[j]))failures.push(rail[i].label+' overlaps '+rail[j].label);
    const footer=pieces.find(p=>p.label==='.rp-turn-action');
    for(const h of hand){if(!h.inside)failures.push(h.label+' is clipped');if(h.bottom>footer.top+8)failures.push(h.label+' overlaps footer');}
    return {viewport:{width:innerWidth,height:innerHeight},rows,pieces,rail,controls,hand,failures};
  });
}
async function typography(page) {
  await page.setViewportSize({width:768,height:1024});
  const result=await page.evaluate(async()=>{
    const C=await import('/js/core/dynasty-pocket-cards.js'),{printedCard}=await import('/js/views/dynasty-pocket-card.js');
    const groups=new Map();
    // Every distinct combination of printed attack/effect, stage, point class,
    // Energy/retreat symbols and rarity; longest athlete name breaks ties.
    for(const rev of [1,2])for(const original of C.allCards().filter(c=>c.kind==='player')){
      const c=C.printed(original.id,rev),key=JSON.stringify([rev,c.attacks,c.ability,c.stage,c.classification,c.retreat,c.weakness,c.rarity]);
      if(!groups.has(key)||c.name.length>groups.get(key).card.name.length)groups.set(key,{card:c,rev});
    }
    const length=x=>x.card.attacks.reduce((n,a)=>n+a.name.length+(a.text||'').length,0);
    const sample=[...groups.values()].sort((a,b)=>length(b)-length(a)||b.card.name.length-a.card.name.length||b.rev-a.rev);
    const grid=document.createElement('div');grid.id='framing-type-sweep';grid.style.cssText='position:fixed;inset:0;z-index:1000;display:grid;grid-template-columns:repeat(5,112px);gap:14px;align-content:start;overflow:auto;padding:10px;background:#17694f';
    grid.innerHTML='<div class="rp-field">'+sample.map(({card,rev},i)=>`<div class="rp-card" data-sample="${i}" style="width:112px;height:${112*88/63}px;max-width:none;aspect-ratio:63/88"><span class="rp-card-print">${printedCard(card.id,rev)}</span></div>`).join('')+'</div>';
    document.querySelector('.v-dynasty-battle').append(grid);
    const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const contains=(a,b)=>b.left>=a.left-.75&&b.right<=a.right+.75&&b.top>=a.top-.75&&b.bottom<=a.bottom+.75;
    const results=[...grid.querySelectorAll('[data-sample]')].map(el=>{
      const {card,rev}=sample[Number(el.dataset.sample)],cardBox=rect(el),body=rect(el.querySelector('.pk-c-body')),art=rect(el.querySelector('.pk-c-art'));
      const text=[...el.querySelectorAll('.pk-c-atk>b,.pk-c-atk>em,.pk-c-fx,.pk-c-ab')].map(n=>({text:n.textContent,...rect(n),overflow:n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1}));
      const failures=text.filter(t=>!contains(cardBox,t)||!contains(body,t)||t.top<art.bottom-.75||t.overflow).map(t=>t.text);
      return {id:card.id,name:card.name,rev,classification:card.classification,stage:card.stage,rarity:card.rarity,card:cardBox,body,art,text,failures};
    });
    return {sampleCount:sample.length,results,failures:results.filter(r=>r.failures.length)};
  });
  await page.screenshot({path:path.join(out,'typography-112px.png')});
  await page.evaluate(()=>document.getElementById('framing-type-sweep').remove());
  return result;
}
async function run(url) {
  const browser = await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const report=[];
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
    await context.addInitScript(()=>{
      localStorage.setItem('gg-me','evan');localStorage.setItem('gg-welcome','1');sessionStorage.setItem('gg-skip-title','1');localStorage.setItem('gg-release-3.0:evan','1');
      for(const kind of ['music','sfx'])localStorage.setItem('gg-rivals-'+kind+':m_evan:v1',JSON.stringify({on:false,enabled:false,level:0,volume:0}));
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(url+'/#/puzzles');await page.waitForFunction(()=>window.__ggBooted);
    await page.evaluate(async()=>{
      const D=await import('/js/core/dynasty.js'),S=await import('/js/core/dynasty-solo.js'),C=await import('/js/core/dynasty-pocket-cards.js');await D.load();
      if((await import('/js/core/fire.js')).canWrite())throw Error('Live writes must be disabled');
      D.usePocketDeck('rental');const r=S.start('g1');if(!r.ok)throw Error(r.why);
      window.framingMid=r.mid;const G=S.get(r.mid).G;
      // A deterministic dense rendering fixture only, not a rules/replay fixture.
      // Nothing is submitted, persisted as a move, or sent to a connected account.
      const players=C.allCards().filter(c=>c.kind==='player'&&c.stage==='Base');
      const wanted=['Patrick Mahomes','Justin Jefferson','CeeDee Lamb','Lamar Jackson'];
      const chosen=wanted.map((n,i)=>players.find(c=>c.athlete===n)||players[i]);
      const supports=C.allCards().filter(c=>['item','supporter','stadium'].includes(c.kind));
      window.framingHand=[chosen[0].id,supports[0].id,chosen[1].id,supports[1].id,chosen[2].id,supports[2].id,chosen[3].id];
      G.phase='play';G.who=0;G.turn=9;G.first=0;G.events=[];G.pending=null;
      G.p.forEach((p,who)=>{
        const slots=[chosen[1],chosen[0],chosen[2],chosen[3]].map((c,i)=>({u:++G.uid,id:c.id,dmg:i===0?10:0,en:Array(i===0?3:1).fill('Fire'),stack:[],tool:null,conditions:{},entered:0,developed:-1,abilityTurn:-1}));
        p.active=slots[0];p.bench=slots.slice(1);p.hand=window.framingHand.slice(0,5);p.ready=true;p.turns=5;p.used={};p.en='Fire';p.points=who?2:1;p.promote=false;p.discard=[supports[0].id,supports[1].id,supports[2].id];
      });
      G.stadium={id:supports.find(c=>c.kind==='stadium').id};
      await(await import('/js/app.js')).nav('/puzzles/dynasty/battle/'+r.mid);
    });
    await page.waitForSelector('.rp-field .rp-card');await page.waitForTimeout(350);
    for(const handCount of [5,14]) {
      await page.evaluate(async count=>{
        const S=await import('/js/core/dynasty-solo.js'),app=await import('/js/app.js');
        await app.nav('/puzzles');const G=S.get(window.framingMid).G;
        G.p[0].hand=Array.from({length:count},(_,i)=>window.framingHand[i%window.framingHand.length]);
        await app.nav('/puzzles/dynasty/battle/'+window.framingMid);
      },handCount);
      await page.waitForSelector('.rp-field .rp-card');await page.waitForTimeout(350);
      for(const [width,height,top=0,bottom=0] of [[320,568],[320,568,20,0],[375,667],[390,844],[430,932],[768,1024],[1366,768],[390,844,59,34],[430,932,59,34],[844,390]]) {
        await page.setViewportSize({width,height});
        await page.evaluate(({top,bottom})=>{document.documentElement.style.setProperty('--framing-sa-top',top+'px');document.documentElement.style.setProperty('--framing-sa-bottom',bottom+'px');},{top,bottom});
        await page.waitForTimeout(120);
        const label=`${width}x${height}${top?'-safe':''}-hand${handCount}`, result=await measurements(page);
        const old=before?.find(r=>r.label===label);
        if(old)result.change=result.rows.map((r,i)=>({row:i,widthPercent:(r.items[0].width/old.rows[i].items[0].width-1)*100,attackFontPercent:(r.items[0].fonts[0]?.font/old.rows[i].items[0].fonts[0]?.font-1)*100}));
        result.label=label;report.push(result);
        await page.screenshot({path:path.join(out,label+'.png')});
        const sizes=result.rows.map(r=>Math.round(r.items[0].width)).join('/');
        console.log(`${result.failures.length?'FAIL':'PASS'} ${label}: row widths ${sizes}; ${result.failures.join('; ')}`);
      }
    }
    const type=await typography(page);
    fs.writeFileSync(path.join(out,'typography.json'),JSON.stringify(type,null,2));
    fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({baseline,errors,results:report},null,2));
    console.log(`${type.failures.length?'FAIL':'PASS'} printed typography: ${type.sampleCount} representative layouts at 112px, ${type.failures.length} overflow cases`);
    if(type.failures.length)console.log(type.failures.slice(0,8).map(f=>`${f.name} rev${f.rev}: ${f.failures.join('; ')}`).join('\n'));
    if(errors.length)throw Error(errors.join('\n'));
    const failed=report.filter(r=>r.failures.length);
    if(failed.length&&!diagnostic)throw Error(`${failed.length} framing cases failed. See ${path.join(out,'measurements.json')}`);
    if(type.failures.length&&!diagnostic)throw Error(`${type.failures.length} printed typography cases failed. See ${path.join(out,'typography.json')}`);
    console.log(`${diagnostic?'DIAGNOSTIC':'PASS'} ${report.length} dense-board cases; screenshots and measurements in ${out}`);
  } finally {await browser.close();}
}
server.listen(0,'127.0.0.1',()=>run('http://127.0.0.1:'+server.address().port).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close()));
