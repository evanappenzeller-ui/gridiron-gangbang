// Isolated UI contract checks. All requests stay on localhost; no board backend or saved realm is used.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const fixture = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">
import * as data from '/js/core/data.js';
import * as F from '/js/core/realm.js';
import {realmChecks} from '/js/core/checks-realm.js';
import {dragonPickerHTML} from '/js/views/realm-dragon-picker.js';
await data.load();data.setMe('evan');
const checks=[];await realmChecks((name,run)=>checks.push({name,run}));
window.qa={data,F,checks,dragonPickerHTML,ready:true};
</script>`;
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if(url.pathname === '/')return res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);
  if(url.pathname === '/js/core/daily.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end('export const LB={raw:[],ready:false,off:true};export const PNUM={};');
  const file = path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,bytes)=>{
    if(error)return res.writeHead(404).end();
    if(url.pathname === '/js/core/checks-realm.js') {
      let s=bytes.toString(), a=s.indexOf('  const [kk, rm, sv, dr] = await Promise.all('), b=s.indexOf("  check('",a);
      s=s.slice(0,a)+'  const kk={dateOf:()=>new Date(2026,9,21)},rm={},sv={},dr={};\n'+s.slice(b);bytes=Buffer.from(s);
    }
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream'}).end(bytes);
  });
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin);await page.waitForFunction(()=>window.qa?.ready,{},{timeout:30000});
    const result=await page.evaluate(async()=>{
      const out=[];
      for(const profile of ['evan','mason']) {
        qa.data.setMe(profile);
        for(const c of qa.checks.filter(c=>/Keepfall: raids on him start at Castle 3|Keepfall: a building’s card|Keepfall: Army shows the Knight plus/.test(c.name))) {
          try{out.push({profile,name:c.name,result:await c.run()});}catch(e){out.push({profile,name:c.name,error:e.message});}
        }
      }
      return out;
    });
    assert.equal(result.length,6);
    for(const row of result){assert(!row.error,row.error);assert(row.result===true||row.result.pass,JSON.stringify(row));}
    const picker=await page.evaluate(()=>{
      const F=qa.F,s=F.fresh();s.b[0].l=8;
      const read=(choice={},id=null)=>{const t=document.createElement('template');t.innerHTML=qa.dragonPickerHTML(s,choice,id);return t.content;};
      const blank=read(), chosen=read({species:'nightmare',color:'albino'}), p=F.spotFor(s,'hatchery');
      const b={i:s.nb++,t:'hatchery',l:6,x:p.x,y:p.y,u:0,dragon:{species:'nightmare',color:'albino'}};s.b.push(b);
      const locked=read(b.dragon,b.i), next=read();
      return {species:blank.querySelectorAll('[data-dragon-species]').length,blankDisabled:blank.querySelector('[data-dragon-confirm]').disabled,
        chosenEnabled:!chosen.querySelector('[data-dragon-confirm]').disabled,colors:chosen.querySelectorAll('[data-dragon-color]').length,
        lockedChoices:[...locked.querySelectorAll('[data-dragon-species]')].filter(b=>!b.disabled).map(b=>b.dataset.dragonSpecies),
        nextChoices:[...next.querySelectorAll('[data-dragon-species]')].filter(b=>!b.disabled).map(b=>b.dataset.dragonSpecies)};
    });
    assert.equal(picker.species,4);assert(picker.blankDisabled&&picker.chosenEnabled);assert.equal(picker.colors,4);
    assert.deepEqual(picker.lockedChoices,['nightmare']);assert.deepEqual(picker.nextChoices,['soul-eater','terror-bringer','usurper']);
    assert.deepEqual(errors,[]);console.log('PASS: mobile-width Army, hatchery cards, unlock copy and explicit species/color picker for owner and member; no browser errors');
    await context.close();
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;server.close();});
