// Actual GLBs/materials and production home/battle renderers in an isolated
// Chromium fixture. All requests stay on localhost; no player saves or Firebase.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), output = path.resolve(root, '../dragon-render-qa');
const fixture = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#233728}canvas{display:block}</style><script type="module" src="/__fixture.js"></script>`;
const script = `
import * as T from '/js/vendor/three/three.module.min.js';
import * as A from '/js/views/realm-dragon-assets.js';
import * as D from '/js/views/realm-dragon.js';
import * as F from '/js/core/realm.js';
import * as data from '/js/core/data.js';
import {DRAGON_ORDER,DRAGONS} from '/js/core/realm-dragons.js';
import {makeBattle} from '/js/core/realm-battle.js';
await data.load();data.setMe('mason');
const scene=new T.Scene();scene.background=new T.Color(0x64745b);
scene.add(new T.HemisphereLight(0xddeaff,0x3b4129,2));const sun=new T.DirectionalLight(0xffe6c9,3);sun.position.set(5,12,8);scene.add(sun);
const plane=new T.Mesh(new T.PlaneGeometry(44,44),new T.MeshStandardMaterial({color:0x526a45,roughness:1}));plane.rotation.x=-Math.PI/2;plane.position.y=-.03;scene.add(plane);
const camera=new T.PerspectiveCamera(36,innerWidth/innerHeight,.1,150);camera.position.set(25,28,30);camera.lookAt(0,0,0);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const state=F.fresh();state.b=[{i:1,t:'keep',l:7,x:19,y:19,u:0},...DRAGON_ORDER.map((species,i)=>({i:10+i,t:'hatchery',l:i+1,x:12+(i%2)*15,y:12+Math.floor(i/2)*15,u:0,dragon:{species,color:DRAGONS[species].colors[i%4]}}))];state.hr={};
const originalState=JSON.stringify(state);
const levels=F.heroLevels(state),choices=F.heroDragons(state);
const make=()=>{const b=makeBattle(state,null,{}, {heroes:levels,dragons:choices});DRAGON_ORDER.forEach((s,i)=>{if(!b.deploy(DRAGONS[s].troop,3+i*6,4))throw Error('deploy failed '+s)});b.run(.1);return b;};
const locate=u=>({x:u.x,y:u.y,moving:false});
window.qa={A,D,T,F,data,state,scene,camera,renderer,ready:false};
qa.load=async()=>{const out=[];for(const species of DRAGON_ORDER)for(const color of DRAGONS[species].colors){if(!await A.loadDragonAsset(species,color))throw Error('load '+species+'/'+color);const a=A.createDragonAsset(species,color);const bones=[];a.model.traverse(o=>{if(o.isBone)bones.push(o)});const fingerprint=()=>bones.flatMap(o=>[...o.position.toArray(),...o.quaternion.toArray()]);a.pose('run',0);const p=fingerprint();a.pose('run',.4);const q=fingerprint();out.push({species,color,bones:bones.length,animated:q.some((v,i)=>Math.abs(v-p[i])>.001),map:a.meshes[0].material.map.image.src,mouth:a.mouth(new T.Vector3()).toArray(),span:a.nativeSpan});a.dispose();}return out;};
qa.battle=()=>{qa.home?.dispose();qa.home=null;qa.battleView?.dispose();const B=make();const v=D.createBattleDragons(T,scene);v.update(B,.1,locate,100);v.update(B,.2,locate,200);renderer.render(scene,camera);qa.B=B;qa.battleView=v;return {counts:v.counts,actors:[...v.speciesActors.values()].map(a=>({species:a.species,color:a.color,y:a.body?.root.position.y,key:a.u.id,mouth:v.mouth((a.u.targetHero?'d:':'a:')+a.u.id,new T.Vector3())?.toArray()}))};};
qa.death=()=>{const u=qa.B.tr.find(u=>u.species==='nightmare');u.dead=true;qa.battleView.update(qa.B,1,locate,1000);qa.battleView.update(qa.B,1.5,locate,1500);const a=[...qa.battleView.speciesActors.values()].find(a=>a.u===u);const mid={state:a.body.state,y:a.body.root.position.y};qa.battleView.update(qa.B,12,locate,12000);return {mid,gone:a.gone,model:!!a.body};};
qa.restart=()=>{qa.battleView.reset();const empty=qa.battleView.speciesActors.size;const B=make();qa.battleView.update(B,.1,locate,100);qa.B=B;return {empty,counts:qa.battleView.counts};};
qa.homeCheck=()=>{qa.battleView?.dispose();qa.battleView=null;qa.home?.dispose();qa.home=D.createHomeDragon(T,scene,{renderer,camera});qa.home.setLot(state);qa.home.update(2,{camera});renderer.render(scene,camera);return {counts:qa.home.counts,actors:[...qa.home.entries.values()].map(e=>({species:e.species,color:e.color,level:e.level,id:e.id,position:e.actor?.root.position.toArray(),span:e.actor?.root.scale.x*e.actor?.nativeSpan}))};};
qa.visit=()=>{const other=structuredClone(state);other.b.filter(b=>b.dragon).forEach(b=>{b.dragon.color=DRAGONS[b.dragon.species].colors.at(-1);b.l=8});qa.home.setLot(other);qa.home.update(3,{camera});renderer.render(scene,camera);return {counts:qa.home.counts,sourceUnchanged:JSON.stringify(state)===originalState,actors:[...qa.home.entries.values()].map(e=>({species:e.species,color:e.color,level:e.level,span:e.actor.root.scale.x*e.actor.nativeSpan}))};};
qa.unassigned=()=>{const base=structuredClone(state);base.b.forEach(b=>delete b.dragon);qa.home.setLot(base);qa.home.update(4,{camera});return qa.home.counts.models;};
qa.full=async()=>{
  qa.home?.dispose();qa.home=null;qa.fullView?.dispose();qa.fullHost?.remove();data.setMe('mason');
  const D3=await import('/js/views/realm-3d.js');await D3.load('coast');
  const host=document.createElement('div');host.style='position:fixed;inset:0';document.body.append(host);qa.fullHost=host;
  const base=F.botBase(8);base.hr={};base.b=base.b.filter(b=>b.t!=='hatchery');base.b.push(...structuredClone(state.b.filter(b=>b.t==='hatchery')).map(b=>({...b,i:b.i+100})));
  const heroes=F.heroLevels(base),dragons=F.heroDragons(base),B=makeBattle(base,null,{footman:100,archer:100},{heroes,dragons});
  const v=D3.create(host,{isActive:()=>true});qa.fullView=v;v.setLot(base);const box=F.boxOf(base);v.frame(box.x0-3,box.y0-3,box.x1+3,box.y1+3,1);v.raidStart(B,{pri:0x7a1f2b,sec:0xd4a63a});
  for(let n=0;n<200;n++){const side=n%4,p=3+(Math.floor(n/4)%38),x=side===0?2:side===1?41:p,y=side===2?2:side===3?41:p;if(!B.deploy(n<100?'footman':'archer',x+.2,y+.2))throw Error('deploy '+n);}
  DRAGON_ORDER.forEach((s,i)=>{if(!B.deploy(DRAGONS[s].troop,3+i*7,2.2))throw Error('hero deploy '+s)});
  B.run(.1);v.raidFrame(.1);v.want();for(let i=0;i<4;i++)await new Promise(resolve=>requestAnimationFrame(resolve));await new Promise(resolve=>setTimeout(resolve,1000));
  let first,last;const times=[],work=[];await new Promise(resolve=>v.setAnim(now=>{if(first==null)first=now;const elapsed=(now-first)/1000,start=performance.now();B.run(elapsed+.1);v.raidFrame(elapsed+.1,now);if(elapsed>1&&last!=null){times.push(now-last);work.push(performance.now()-start);}last=now;if(elapsed>5){resolve();return false;}return true;}));
  const result={troops:B.tr.length,defenders:B.defenders.length,dragonModels:v.dragons.battle.counts.models,frameMs:times,simulationAnimationMs:work,calls:v.dragons.renderer.info.render.calls,triangles:v.dragons.renderer.info.render.triangles};return result;
};
qa.fallback=async()=>{const D3=await import('/js/views/realm-3d.js');await D3.load('coast');const host=document.createElement('div');host.style='position:fixed;inset:0';document.body.append(host);const v=D3.create(host,{isActive:()=>true});const B=make();v.setLot(state);v.raidStart(B,{pri:0x7a1f2b,sec:0xd4a63a});v.raidFrame(.2);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const R=window.__dragonRaid,M=R.meshes.dragon,mat=new T.Matrix4();M.art.getMatrixAt(0,mat);M.art.geometry.computeBoundingBox();const box=M.art.geometry.boundingBox,world=new T.Vector3(box.min.x,box.min.y,0).applyMatrix4(mat);const out={counts:R.dragons.counts,groundBottom:world.y,nightmareFlies:D.dragonCanFly('hero_dragon_nightmare')};v.dispose();return out;};
qa.dispose=()=>{qa.fullView?.dispose();qa.fullHost?.remove();qa.home?.dispose();qa.battleView?.dispose();D._letGo();renderer.dispose();};qa.ready=true;
`;
const mime={'.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/')return res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);
  if(url.pathname==='/__fixture.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end(script);
  if(url.pathname==='/js/core/daily.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end('export const LB={raw:[],ready:false,off:true};export const PNUM={};');
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,bytes)=>{if(error)return res.writeHead(404).end();if(url.pathname==='/js/views/realm-3d.js')bytes=Buffer.from(bytes.toString().replace('R.shadow.count = nShadow;','window.__dragonRaid=R; R.shadow.count = nShadow;'));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);});
});
async function main(){
  fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  const browser=await chromium.launch({channel:'chrome',headless:true});const report={};
  try{
    for(const fallback of [false,true]){
      const context=await browser.newContext({viewport:{width:1000,height:800},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.error('Browser fixture:',e.message);});
      await context.route('**/*',route=>{const target=new URL(route.request().url());if(fallback&&/\/models\/realm\/dragons-v1\//.test(target.pathname))return route.fulfill({status:404,body:'intentional missing model'});return target.origin===url||['data:','blob:'].includes(target.protocol)?route.continue():route.abort();});
      await page.goto(url);await page.waitForFunction(()=>window.qa?.ready,{},{timeout:60000});
      if(fallback){report.fallback=await page.evaluate(()=>qa.fallback());assert.equal(report.fallback.counts.models,0);assert.equal(report.fallback.nightmareFlies,false);assert(Math.abs(report.fallback.groundBottom)<.02,'Nightmare fallback is anchored to terrain');}
      else{
        report.assets=await page.evaluate(()=>qa.load());assert.equal(report.assets.length,16);report.assets.forEach(a=>{assert(a.animated,a.species+' animates');assert(a.map.endsWith(a.species+'-'+a.color+'.webp'));assert(a.mouth.every(Number.isFinite));});
        report.battle=await page.evaluate(()=>qa.battle());assert.equal(report.battle.counts.models,8);assert.equal(report.battle.counts.heroes,8);report.battle.actors.forEach(a=>assert(a.species==='nightmare'?a.y===0:a.y>1,a.species+' altitude'));
        await page.screenshot({path:path.join(output,'eight-dragons-battle.png')});
        report.death=await page.evaluate(()=>qa.death());assert.equal(report.death.mid.state,'death');assert.equal(report.death.mid.y,0);assert(report.death.gone&&!report.death.model);
        report.restart=await page.evaluate(()=>qa.restart());assert.equal(report.restart.empty,0);assert.equal(report.restart.counts.models,8);
        report.home=await page.evaluate(()=>qa.homeCheck());assert.equal(report.home.counts.models,4);assert.equal(report.home.actors.find(a=>a.species==='nightmare').position[1],0);assert.equal(new Set(report.home.actors.map(a=>a.id)).size,4);
        await page.screenshot({path:path.join(output,'four-dragons-home.png')});
        report.visit=await page.evaluate(()=>qa.visit());assert.equal(report.visit.counts.models,4);assert(report.visit.sourceUnchanged);report.visit.actors.forEach(a=>{assert.equal(a.level,8);assert(a.span>report.home.actors.find(b=>b.species===a.species).span);});
        assert.equal(await page.evaluate(()=>qa.unassigned()),0,'Unassigned current hatcheries show no dragon');
        await page.evaluate(()=>qa.data.setMe('none'));assert.equal(await page.evaluate(()=>qa.A.dragonAssetReady('nightmare','red')),true,'Shared assets survive profile switch');
        report.full=[];for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});const full=await page.evaluate(()=>qa.full());assert.equal(full.troops,204);assert.equal(full.defenders,4);assert.equal(full.dragonModels,8);full.viewport={width,height};report.full.push(full);await page.screenshot({path:path.join(output,'full-'+width+'x'+height+'.png')});}
      }
      assert.deepEqual(errors,[]);await page.evaluate(()=>qa.dispose());await context.close();
    }
    console.log('PASS: 16 textured colors animate, 8 battle dragons, 4 home dragons, visited colors/levels, death/replay reset, grounded missing-asset fallback; 200 troops + 8 dragons at both mobile viewport orientations');
  }finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
