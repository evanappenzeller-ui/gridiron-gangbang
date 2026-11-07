#!/usr/bin/env node
// Offline ride rules, profile parity and real renderer checks. Never starts the app or posts scores.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'output/return-rides');
let pw;
try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const origin = 'http://127.0.0.1:8765';
const mime = {'.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.woff2':'font/woff2'};
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await pw.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  const errors = [];
  try {
    const context = await browser.newContext({viewport:{width:430,height:820},serviceWorkers:'block'});
    const page = await context.newPage();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { errors.push('External request '+url); return route.abort(); }
      if (url.pathname === '/check') return route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><style>body{margin:0;background:#B8DCED}canvas{position:absolute;inset:0;width:430px;height:820px}</style>'});
      if (url.pathname === '/js/app.js') return route.fulfill({contentType:'text/javascript',body:'export const APP_VERSION="offline-check",installEvent=null; export async function promptInstall(){return false;}'});
      try {
        const file = path.resolve(root,'.'+decodeURIComponent(url.pathname)), rel = path.relative(root,file);
        assert(!rel.startsWith('..')&&!path.isAbsolute(rel));
        let body = fs.readFileSync(file);
        if (url.pathname === '/js/views/return-3d.js') body += '\nexport {GL};';
        return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body});
      } catch (e) { errors.push(e.message); return route.fulfill({status:404,body:e.message}); }
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/check');
    const report = await page.evaluate(async () => {
      const [D,R,D3] = await Promise.all([import('/js/core/data.js'),import('/js/core/return.js'),import('/js/views/return-3d.js')]);
      await D.load();
      const ok=(v,m)=>{if(!v)throw new Error(m);}, tests=[];
      const test=(name,fn)=>{fn();tests.push(name);};
      const tick=(r,s)=>{const e=[];for(let t=0;t<s-1e-8&&!r.over;t+=1/120)e.push(...R.step(r,Math.min(1/120,s-t)));return e;};
      const empty=()=>{const r=R.startRun(70001,0,true,false,true);r.co={...r.co,rows:[],sets:[],items:[],traffic:[],z:1e9,done:1e9};r.t=10;return r;};
      const row=(r,ob='hurdle')=>{r.co.rows.push({i:r.co.rows.length,z:r.z+.01,lanes:[null,ob,null],th:'stadium'});return tick(r,.02);};
      test('Every member, app profile, guest and unselected player can summon both rides',()=>{
        const profiles=[...Object.keys(D.M),...D.USERS.map(u=>u.name),'Guest Runner',null];
        for(const p of profiles){D.setMe(D.M[p]?p:'none');D.setGuest(D.M[p]?null:p);for(const kind of R.RIDE.kinds){const r=empty();ok(R.summonRide(r,kind)&&R.riding(r),'ride for '+p);ok(!R.summonRide(r,kind),'no duplicate summon');}}
        const old=R.startRun(70001,0,true,false,false);ok(!R.summonRide(old),'legacy course untouched');
      });
      D.setGuest(null);D.setMe('evan');
      test('Twelve seconds, frozen while paused, twenty-second recharge, no extra score multiplier',()=>{
        const r=empty(), b=empty();R.summonRide(r,'hoverboard');tick(r,2);tick(b,2);
        ok(r.z===b.z&&r.yards===b.yards&&R.multiplierOf(r)===1,'speed and scoring unchanged');
        const before=JSON.stringify(r.ride);R.step(r,0);ok(before===JSON.stringify(r.ride),'pause does not drain ride');
        const end=tick(r,10);ok(!r.ride&&end.filter(e=>e.type==='rideEnd').length===1,'expires once');
        ok(r.rideCooldown>19.9&&!R.summonRide(r),'recharge begins after expiry');
        tick(r,20.02);ok(R.summonRide(r),'ready after recharge');
        R.stop(r);ok(!R.riding(r)&&!R.summonRide(r),'ended runs cannot ride');
      });
      test('A ride absorbs one hit, protects against walls and preserves the existing pursuit',()=>{
        for(const ob of ['hurdle','bar','hole']){const r=empty();r.hitAt=r.t;R.summonRide(r);const e=row(r,ob);ok(!r.over&&!r.ride&&r.hits===0&&R.chasing(r)&&e.some(e=>e.type==='rideHit'),'one protection for '+ob);ok(row(r).some(e=>e.type==='tackled'),'next distinct obstacle tackles');}
        const r=empty();R.summonRide(r);r.trains=[{i:'test',lane:1,kind:'express',z0:.01,z1:20,h:3.6,b:0,ramp:0,hi:true}];const e=tick(r,.02);ok(!r.over&&e.some(e=>e.type==='rideHit')&&r.trains[0].cleared,'incoming train consumes ride once');
        const wall=empty();wall.hitAt=wall.t;R.summonRide(wall);wall.co.sets=[{i:0,zs:.01,ze:30,plats:[{lane:1,kind:'bus',z0:.01,z1:30,h:3,b:0,ramp:0,hi:true}]}];const contact=tick(wall,1);ok(!wall.over&&contact.filter(e=>e.type==='rideHit').length===1&&wall.y===3,'solid vehicle resolves onto roof without repeating contact after grace');
        const edge=empty();edge.lane=0;edge.x=R.xOf(edge,0);R.summonRide(edge);R.move(edge,'left');tick(edge,.02);R.move(edge,'left');const repeat=tick(edge,.02);ok(!edge.over&&repeat.some(e=>e.type==='shoved'),'duplicate edge contact is one hit');
      });
      test('Painkillers preserve a ride; jetpack stows it; controls and roofs still work',()=>{
        const r=empty();r.pills=5;R.summonRide(r);row(r);ok(R.riding(r),'pills do not waste ride');
        r.co.items=[{i:0,kind:'jetpack',lane:1,z:r.z+.01}];const ev=tick(r,.02);ok(R.flying(r)&&!r.ride&&ev.some(e=>e.type==='rideEnd'&&e.reason==='jetpack'),'jetpack stows');ok(!R.summonRide(r),'no summon in flight');
        const a=empty();R.summonRide(a);ok(R.move(a,'up')&&a.vy>0,'jump');tick(a,.1);ok(R.move(a,'down')&&a.slide>0,'slide');ok(R.move(a,'right'),'steer');
        const b=empty();b.y=3;b.co.sets=[{i:0,zs:0,ze:20,plats:[{lane:1,kind:'bus',z0:0,z1:20,h:3,b:0,ramp:0,hi:true}]}];R.summonRide(b);tick(b,.1);ok(b.y===3&&!b.over,'roof supported');
      });
      window.qa={D,R,D3,empty};return tests;
    });
    console.log(report.map(t=>'PASS '+t).join('\n'));
    await page.evaluate(async()=>{
      const {R,D3,empty}=qa; if(!await D3.load())throw new Error('3D renderer unavailable');
      const run=empty();run.z=run.yards=180;run.steps=1.25;
      const st={run,co:run.co,W:430,H:820,dpr:1,f:451.5,y0:230,camH:4.4,camH0:4.4,camX:0,camZ:173,back:7,bend:.0007,t:12,mode:'run',got:new Set(),knocked:new Map(),coinGot:new Set(),sparks:[],dt:1/60};
      qa.st=st;qa.draw=()=>D3.render(st,12000,{us:{x:run.x,y:run.y,z:run.z,spec:{move:run.slide>0?'slide':'run',phase:.25,t:run.t,u:.4,lift:.2},show:true}});
      qa.draw();document.body.append(D3.canvas());await D3.prepare(st);qa.draw();
    });
    await page.waitForTimeout(500);
    for(const kind of ['scooter','hoverboard']){
      const result=await page.evaluate(kind=>{const {R,D3,st,draw}=qa;st.run.ride=null;st.run.rideCooldown=0;const count=D3.GL.renderer.info.programs.length;R.summonRide(st.run,kind);st.run.ride.age=2;draw();const p=D3.GL.players.us;return {before:count,after:D3.GL.renderer.info.programs.length,visible:p.rides[kind].visible,other:p.rides[kind==='scooter'?'hoverboard':'scooter'].visible,lift:p.wrap.position.y,rootLift:p.root.position.y-st.run.y};},kind);
      assert.equal(result.before,result.after,'summoning must not compile shaders');assert(result.visible&&!result.other&&result.lift===.35&&result.rootLift===0);
      await page.screenshot({path:path.join(output,kind+'.png')});
    }
    const skin=await page.evaluate(async()=>{const {D3,st,draw}=qa;const original=D3.GL.players.us,them=D3.GL.players.them;D3.setSkin({jersey:0x17ABCD,helmet:0xF09920});const changed=D3.GL.players.us;await D3.prepare(st);draw();D3.setSkin(null);return {changed:changed!==original,restored:D3.GL.players.us===original,opponent:D3.GL.players.them===them};});
    assert(skin.changed&&skin.restored&&skin.opponent,'skin changes are isolated and original kit is reused');
    const reduced=await page.evaluate(()=>{const {D3,st,draw}=qa;st.reducedMotion=true;st.run.ride={kind:'scooter',left:10,age:.01};draw();const scooter=D3.GL.players.us.rides.scooter;return {scale:scooter.scale.x,rotation:scooter.getObjectByName('ride-wheel').rotation.x};});
    assert.equal(reduced.scale,1);assert.equal(reduced.rotation,0);
    console.log('PASS 3D scooter/hoverboard, riding pose, prewarmed shaders and isolated reusable skins');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({tests:report,skin},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
