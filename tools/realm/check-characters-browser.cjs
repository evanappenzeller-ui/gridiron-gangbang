// Local, isolated QA for Keepfall's imported characters. Never connects to Firebase or user saves.
// Desktop Chrome with mobile viewports is a compatibility/performance smoke test, not a physical-phone benchmark.
// Run: node tools/realm/check-characters-browser.cjs [--quick] [--software]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../character-qa-release');
const quick = process.argv.includes('--quick');
const fallbackOnly = process.argv.includes('--fallback-only');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary'};
const fixture = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Keepfall character QA</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#273421;font:13px system-ui}#host{position:absolute;inset:0}#label{position:fixed;top:8px;left:8px;padding:7px 10px;background:#131b20dc;color:#fff;border-radius:6px;pointer-events:none;z-index:10}canvas{display:block}</style>
<div id="host"></div><div id="label">Keepfall · isolated character check</div><script type="module" src="/__character-fixture.js"></script>`;
const fixtureJS = `
import * as data from '/js/core/data.js';
import * as features from '/js/core/features.js';
import * as F from '/js/core/realm.js';
import * as D3 from '/js/views/realm-3d.js';
import * as C from '/js/views/realm-characters.js';
import * as T from '/js/vendor/three/three.module.min.js';
import {makeBattle, replay} from '/js/core/realm-battle.js';
await data.load();
const profile = new URL(location.href).searchParams.get('profile') || 'evan';
data.setMe(profile);
let view, base, battle, animFrame;
const raider={pri:0x7a1f2b,sec:0xd4a63a,sigil:'crown'};
window.qa = {data, F, D3, C, T, ready: false, metrics: {intervals: [], frameWork: [], calls: [], triangles: [], live: []}};
const label = text => document.querySelector('#label').textContent = text;
qa.snapshot = () => {
  const {scene, renderer, camera, raid} = window.__characterRender || {};
  if (!scene) return null;
  const models = [], meshes = [], characters = [];
  scene.traverse(o => {
    if (o.isSkinnedMesh && o.visible) meshes.push({name:o.name, vertices:o.geometry.attributes.position.count});
    if (o.name && /western|character/.test(o.name)) models.push({name:o.name,visible:o.visible,position:o.position.toArray(),scale:o.scale.toArray()});
    if (o.userData.character) characters.push({name:o.name,kind:o.userData.character,visible:o.visible});
  });
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {zoom:view?.zoom, calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, geometries:renderer.info.memory.geometries, textures:renderer.info.memory.textures,
    skinnedMeshes:meshes.length, meshes, models, characters, armyKinds:Object.fromEntries(Object.entries(raid?.meshes||{}).map(([k,m])=>[k,{characters:m.characters?.size||0,sprites:m.art?.count||0}])),heroKnight:!!scene.getObjectByName('keep-npc-knight'),dragonModels:scene.getObjectByName('keep-battle-dragons')?.children.filter(o=>o.name==='keep-dragon').length||0,
    camera:{position:camera.position.toArray(),fov:camera.fov}, gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
};
qa.village = async () => {
  view?.dispose();
  base = F.fresh(); base.b[0].l = 3;
  base.b.push({i:6,t:'tower',l:2,x:27,y:25,u:0},{i:7,t:'barracks',l:1,x:16,y:26,u:Date.now()+600000});
  view = D3.create(document.querySelector('#host'), {village:true,isActive:()=>features.available()});
  view.setLot(base); view.frameVillage();
  qa.view=view; qa.base=base; label('Keepfall · workers at village camera scale');
};
qa.battle = async () => {
  view?.dispose();
  base=F.botBase(8); const capacity=F.COUNT.camp[7]*F.stat('camp',6).room;
  battle=makeBattle(base,null,{footman:capacity/2,archer:capacity/2});
  view=D3.create(document.querySelector('#host'),{isActive:()=>features.available()});
  view.setLot(base); const box=F.boxOf(base); view.frame(box.x0-3,box.y0-3,box.x1+3,box.y1+3,1);
  view.raidStart(battle,raider);
  for(let n=0;n<capacity;n++) {
    const side=n%4, p=3+(Math.floor(n/4)%38), x=side===0?2:side===1?41:p, y=side===2?2:side===3?41:p;
    if(!battle.deploy(n<capacity/2?'footman':'archer',x+.2,y+.2)) throw Error('Full-army deployment failed at '+n);
  }
  battle.run(.1); view.raidFrame(.1); view.want();
  qa.view=view; qa.base=base; qa.B=battle; qa.capacity=capacity;
  qa.metrics={intervals:[],frameWork:[],calls:[],triangles:[],live:[]};
  label('Keepfall · '+capacity+' troops · actual raid camera');
  return {capacity,deployed:battle.tr.length};
};
qa.animate = (speed=1) => {
  let start, prev, initial=battle.t;
  view.setAnim(now=>{
    if(start==null)start=now; const wall=(now-start)/1000, t=initial+wall*speed;
    const work=performance.now();
    battle.run(t);view.raidFrame(Math.min(t,battle.t+.1),now);
    if(wall>1 && prev!=null) {
      qa.metrics.intervals.push(now-prev);qa.metrics.frameWork.push(performance.now()-work);
      qa.metrics.calls.push(window.__characterRender.renderer.info.render.calls);
      qa.metrics.triangles.push(window.__characterRender.renderer.info.render.triangles);
      qa.metrics.live.push(battle.tr.filter(u=>!u.dead).length);
    }
    prev=now;
    if(battle.over){qa.finished=true;return false;}
    return true;
  });
};
qa.finish = () => {
  view.setAnim(null); battle.run(Infinity); view.raidFrame(battle.t+.1);view.want();
  const result=battle.result(), check=replay(base,null,{footman:qa.capacity/2,archer:qa.capacity/2},result.drops,Infinity).result();
  qa.finished=true; return {result,deterministic:JSON.stringify(result)===JSON.stringify(check)};
};
qa.finishRendered=async()=>{
  view.setAnim(null);let frames=0,lastGone=-1;
  while(!battle.over){
    battle.run(battle.t+.5);
    const gone=new Set(battle.bl.filter(b=>b.dead).map(b=>b.i));
    if(gone.size!==lastGone){view.setLot(base,{gone});lastGone=gone.size;}
    view.raidFrame(battle.t+.05);view.want();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));frames++;
  }
  return {...qa.finish(),renderedFrames:frames};
};
qa.restartRegression=async()=>{
  view.setAnim(null);view.setLot(base);
  const b=makeBattle(base,null,{footman:100,archer:100,knight:1,thief:1},{rules:2,heroes:{knight:3,dragon:3}});
  for(const [i,kind] of ['footman','archer','knight','thief','hero_knight','hero_dragon'].entries()){
    if(!b.deploy(kind,5+i,3))throw Error('Regression deployment failed '+kind);
  }
  view.raidRestart(b,raider);b.run(.1);view.raidFrame(.1);view.want();
  await new Promise(resolve=>setTimeout(resolve,1400));view.raidFrame(.2);view.want();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const first=qa.snapshot();
  const next=makeBattle(base,null,{footman:100,archer:100});next.deploy('archer',7,3);next.run(.1);
  view.raidRestart(next,raider);view.raidFrame(.1);view.want();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return {first,second:qa.snapshot()};
};
qa.dispose=()=>{view?.dispose();view=null;};
qa.animationChecks=()=>{
  const results=[];
  for(const kind of ['footman','archer','worker']){
    const actor=C.create(kind,{height:1.05}), bones=[];
    if(!actor)throw Error('No '+kind+' actor');
    actor.root.traverse(o=>{if(o.isBone)bones.push(o);});
    const pose=()=>bones.flatMap(o=>[...o.position.toArray(),...o.quaternion.toArray()]);
    actor.pose('walk',0);actor.pose('walk',.16);const a=pose();actor.pose('walk',.49);const b=pose();
    const changed=a.some((n,i)=>Math.abs(n-b[i])>.0001);
    actor.pose('death',1);actor.pose('death',100);const dead=pose();actor.pose('death',101);
    const deathClamps=dead.every((n,i)=>Math.abs(n-pose()[i])<.0001);
    results.push({kind,bones:bones.length,changed,deathClamps});actor.dispose();
  }
  return results;
};
qa.loaded=await D3.load('coast');
qa.ready=true;
`;

async function server() {
  const s = http.createServer((req,res) => {
    const url = new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/__character-qa.html') return res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);
    if(url.pathname==='/__character-fixture.js') return res.writeHead(200,{'Content-Type':'text/javascript'}).end(fixtureJS);
    // No board service is present in this fixture; pure realm/battle functions are the production implementations.
    if(url.pathname==='/js/core/daily.js') return res.writeHead(200,{'Content-Type':'text/javascript'}).end('export const LB={raw:[],ready:false,off:true}; export const PNUM={};');
    let file;
    try {file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch(_){return res.writeHead(400).end();}
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.readFile(file,(error,bytes)=>{
      if(error)return res.writeHead(404).end();
      if(url.pathname==='/js/views/realm-3d.js') bytes=Buffer.from(bytes.toString().replace('renderer.render(scene, cam);','renderer.render(scene, cam); window.__characterRender={scene,renderer,camera:cam,raid};'));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
    });
  });
  await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));return s;
}
function playwright(){try{return require('playwright');}catch(_){return require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}}
async function isolated(browser,url,{profile='evan',width=390,height=844,fail=false,disabled=false}={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  const requests=[], errors=[], warnings=[];
  await context.route('**/*',route=>{
    const target=new URL(route.request().url());
    if(disabled && target.pathname==='/js/core/features.js')return route.fulfill({contentType:'text/javascript',body:'export const available=()=>false;'});
    if(fail && /\/models\/realm\/western\//.test(target.pathname))return route.fulfill({status:404,body:'Intentional missing character asset'});
    return target.origin===url||['data:','blob:'].includes(target.protocol)?route.continue():route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text());});
  await page.goto(url+'/__character-qa.html?profile='+profile);
  await page.waitForFunction(()=>window.qa?.ready,{},{timeout:90000});
  return {context,page,requests,errors,warnings};
}
function metrics(values){const s=[...values].sort((a,b)=>a-b);return {samples:s.length,median:s[Math.floor(s.length*.5)]||0,p95:s[Math.floor(s.length*.95)]||0,max:s.at(-1)||0};}
async function main(){
  fs.mkdirSync(output,{recursive:true});const local=await server(),url='http://127.0.0.1:'+local.address().port;
  const args=process.argv.includes('--software')?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true,args});
  const report={environment:'Desktop Chrome, mobile viewport emulation; not a physical-phone benchmark',softwareRequested:!!args.length,results:[]};
  try{
    for(const size of fallbackOnly?[]:quick?[[390,844]]:[[390,844],[844,390]]){
      const test=await isolated(browser,url,{width:size[0],height:size[1]}),{page}=test;
      try{
        assert.equal(await page.evaluate(()=>qa.loaded),true,'3D engine loads');
        const animation=await page.evaluate(()=>qa.animationChecks());
        animation.forEach(a=>{assert(a.bones>0,a.kind+' has bones');assert(a.changed,a.kind+' walk animates skeleton');assert(a.deathClamps,a.kind+' death holds its final pose');});
        await page.evaluate(()=>qa.village());await page.waitForTimeout(1300);
        const village=await page.evaluate(()=>qa.snapshot());
        await page.screenshot({path:path.join(output,'workers-'+size.join('x')+'.png')});
        assert(village.skinnedMeshes>0,'Village includes imported animated workers');
        await page.evaluate(()=>qa.view.look(20,22,14));await page.waitForTimeout(200);
        await page.screenshot({path:path.join(output,'workers-close-'+size.join('x')+'.png')});
        const deployed=await page.evaluate(()=>qa.battle());
        assert.equal(deployed.capacity,200,'Maximum current army capacity');assert.equal(deployed.deployed,200);
        await page.waitForTimeout(600);
        const initial=await page.evaluate(()=>qa.snapshot());
        assert(initial.skinnedMeshes>=200,'Both full-army unit types use imported meshes');
        await page.evaluate(()=>qa.animate(1));await page.waitForTimeout(quick?2500:6500);
        await page.screenshot({path:path.join(output,'battle-'+size.join('x')+'.png')});
        const raw=await page.evaluate(()=>qa.metrics), battle=await page.evaluate(()=>qa.snapshot());
        await page.evaluate(()=>{const u=qa.B.tr.find(x=>!x.dead);if(u)qa.view.look(u.x,u.y,14);});await page.waitForTimeout(200);
        await page.screenshot({path:path.join(output,'battle-close-'+size.join('x')+'.png')});
        const completed=await page.evaluate(()=>qa.finishRendered());
        assert.equal(completed.deterministic,true,'Rendering leaves full battle outcome and replay unchanged');
        assert(completed.result.t>0,'Battle runs to completion');
        assert(completed.renderedFrames>0,'Whole battle is rendered through its final state');
        const restart=await page.evaluate(()=>qa.restartRegression());
        assert.equal(restart.first.armyKinds.footman.characters,1);assert.equal(restart.first.armyKinds.archer.characters,1);
        assert.equal(restart.first.armyKinds.knight.sprites,1,'Existing Knight troop stays visible');assert.equal(restart.first.armyKinds.thief.sprites,1,'Existing Thief stays visible');
        assert.equal(restart.first.heroKnight,true,'Knight Hero remains visible');assert.equal(restart.first.dragonModels,1,'Dragon Hero remains visible');
        assert.equal(restart.second.armyKinds.footman.characters,0,'Restart clears earlier footmen');assert.equal(restart.second.armyKinds.archer.characters,1,'Restart renders only the new archer');
        assert.equal(restart.second.heroKnight,false,'Restart clears prior hero');
        const result={viewport:size,animation,village,initial,battle,timing:{frameIntervalsMs:metrics(raw.intervals),simulationAndAnimationMs:metrics(raw.frameWork),drawCalls:metrics(raw.calls),triangles:metrics(raw.triangles),liveUnits:metrics(raw.live)},completed:completed.result,renderedCompletionFrames:completed.renderedFrames,restart,warnings:test.warnings};
        report.results.push(result);
        assert.deepEqual(test.errors,[],'No page exceptions');
        await page.evaluate(()=>qa.dispose());
        assert.equal(await page.locator('#host canvas').count(),0,'View disposes its canvas');
        const shared=await page.evaluate(()=>{const a=qa.C.create('worker');qa.data.setMe('mason');const next=qa.C.create('worker');const out={visible:a.root.visible,ready:qa.C.ready('worker'),newActor:next!==null};a.dispose();next?.dispose();return out;});
        assert.deepEqual(shared,{visible:true,ready:true,newActor:true},'Profile switch retains shared character access');
        console.log('PASS:',size.join('x'),'200 deployed, battle deterministic; frame interval median',result.timing.frameIntervalsMs.median.toFixed(1),'ms');
      }finally{await test.context.close();}
    }
    for(const profile of ['mason','none']){
      const test=await isolated(browser,url,{profile});
      try{
        assert.equal(await test.page.evaluate(()=>qa.loaded),true,'Shared Keepfall scene loads for every profile');
        assert.equal(test.requests.filter(u=>/\/models\/realm\/western\/.*\.glb/.test(u)).length,3,'Every profile can load the three imported characters');
        await test.page.evaluate(()=>qa.village());await test.page.waitForTimeout(250);
        assert((await test.page.evaluate(()=>qa.snapshot())).skinnedMeshes>0,'Shared scene uses imported workers');
        assert.deepEqual(test.errors,[]);console.log('PASS:',profile,'shared imported character access');
      }finally{await test.context.close();}
    }
    const disabled=await isolated(browser,url,{disabled:true});
    try{
      assert.equal(await disabled.page.evaluate(()=>qa.loaded),false,'Unavailable feature does not load Keepfall');
      assert.equal(disabled.requests.filter(u=>/\/models\/realm\/western\//.test(u)).length,0,'Unavailable feature does not request character assets');
      assert.deepEqual(disabled.errors,[]);console.log('PASS: unavailable feature makes no character requests');
    }finally{await disabled.context.close();}
    const fail=await isolated(browser,url,{fail:true});
    try{
      assert.equal(await fail.page.evaluate(()=>qa.loaded),true,'Missing character assets preserve 3D scene');
      await fail.page.evaluate(()=>qa.village());await fail.page.waitForTimeout(300);
      await fail.page.evaluate(()=>qa.battle());await fail.page.waitForTimeout(300);
      const snapshot=await fail.page.evaluate(()=>qa.snapshot());
      assert.equal(snapshot.skinnedMeshes,0,'Missing character assets use fallback army');
      await fail.page.evaluate(()=>qa.animate());await fail.page.waitForTimeout(600);
      await fail.page.screenshot({path:path.join(output,'missing-assets-fallback.png')});
      assert.deepEqual(fail.errors,[]);report.fallback=snapshot;
      console.log('PASS: missing GLBs preserve village and full army fallback');
    }finally{await fail.context.close();}
  }finally{
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    await browser.close();await new Promise(resolve=>local.close(resolve));
  }
  console.log('Report:',path.join(output,'report.json'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
