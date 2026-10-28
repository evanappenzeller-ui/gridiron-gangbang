// Isolated surface regression. Optional --baseline=<git-ref> captures a matched before/after.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {server,isolated,playwright}=require('./check-characters-browser.cjs');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,'../keepfall-materials-qa');
const baseline=process.argv.find(x=>x.startsWith('--baseline='))?.slice(11);
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const local=await server(),url='http://127.0.0.1:'+local.address().port;
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const report={};
  try {
    for(const phase of baseline?['before','after']:['after']){
      const t=await isolated(browser,url),{page}=t;
      if(phase==='before'){
        for(const f of ['realm-buildings.js','realm-walls.js','realm-world.js']){
          const body=cp.execFileSync('git',['show',baseline+':js/views/'+f],{cwd:root,encoding:'utf8'});
          await page.route('**/js/views/'+f,r=>r.fulfill({contentType:'text/javascript',body}));
        }
        await page.reload();await page.waitForFunction(()=>qa.ready,null,{timeout:90000});
      }
      await page.evaluate(async()=>{
        await qa.village();qa.base=qa.F.botBase(5);qa.before=JSON.stringify(qa.base);
        qa.view.setLot(qa.base);qa.view.look(22,22,50);document.querySelector('#label').textContent='Keepfall materials and terrain';
      });
      await page.waitForTimeout(4500);report[phase]=[];
      for(const [name,width,height,dist] of [['mobile',390,844,50],['detail',1000,800,24]]){
        await page.setViewportSize({width,height});await page.evaluate(d=>qa.view.look(22,22,d),dist);await page.waitForTimeout(1000);
        await page.screenshot({path:path.join(out,phase+'-'+name+'.png'),timeout:90000});
        report[phase].push(await page.evaluate(name=>{
          const {scene,renderer}=window.__characterRender,mats=new Set();
          scene.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())mats.add(m)});
          const enhanced=[...mats].filter(m=>m.userData.keepSurface);
          return{name,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,
            surfaces:enhanced.map(m=>({name:m.name,...m.userData.keepSurface,normal:!!m.normalMap,bump:!!m.bumpMap,linear:!m.bumpMap||m.bumpMap.colorSpace==='',roughness:!!m.roughnessMap})),
            progressUnchanged:qa.before===JSON.stringify(qa.base),shaderErrors:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};
        },name));
      }
      assert.deepEqual(t.errors,[]);assert(!t.warnings.some(s=>/Shader Error|VALIDATE_STATUS|INVALID_OPERATION/.test(s)),t.warnings.join('\n'));
      await t.context.close();
    }
    assert(report.after.every(s=>s.surfaces.length>8&&s.surfaces.every(m=>m.bump&&m.linear&&m.roughness)&&s.progressUnchanged&&!s.shaderErrors));
    assert(report.after.every(s=>['mat_brick','timber','mat_floorTile'].every(n=>s.surfaces.some(m=>m.name===n&&m.normal))),'authored relief loads');
    const fail=await isolated(browser,url);
    await fail.page.route('**/models/realm/surfaces-v1/**',r=>r.fulfill({status:404,body:'Intentional optional texture failure'}));
    await fail.page.reload();await fail.page.waitForFunction(()=>qa.ready);
    const fallback=await fail.page.evaluate(async()=>{
      const B=await import('/js/views/realm-buildings.js'),m=B.create('treasury',3,3),mats=[];
      m.traverse(o=>{if(o.isMesh)mats.push(...[o.material].flat())});
      return{imported:!!m.userData.importedBuilding,bump:mats.some(m=>m.name==='mat_brick'&&m.bumpMap&&!m.normalMap)};
    });
    assert(fallback.imported&&fallback.bump,'optional normal failure retains imported building and derived bump');
    assert.deepEqual(fail.errors,[]);await fail.context.close();
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log('PASS surface maps, shaders, unchanged progress, optional texture fallback',JSON.stringify(Object.fromEntries(Object.entries(report).map(([p,list])=>[p,list.map(({surfaces,...r})=>({...r,surfaces:surfaces.length}))]))));
    console.log('Screenshots:',out);
  }finally{await browser.close();await new Promise(r=>local.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});

