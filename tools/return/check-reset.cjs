#!/usr/bin/env node
// Offline November 5 replay migration, stale-client protection, real title and score-post checks.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), origin = 'http://127.0.0.1:8765';
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
(async () => {
  const browser = await pw.chromium.launch({channel:'msedge',headless:true});
  const errors = [], external = [];
  try {
    const context = await browser.newContext({timezoneId:'America/Phoenix',serviceWorkers:'block'}), page = await context.newPage();
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin) { external.push(u.href); return route.abort(); }
      if (u.pathname === '/check') return route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><main></main>'});
      if (u.pathname === '/js/app.js') return route.fulfill({contentType:'text/javascript',body:'export const APP_VERSION="reset-test",installEvent=null,TABS=[];export const promptInstall=async()=>false;'});
      const file = path.resolve(root,'.'+decodeURIComponent(u.pathname));
      assert(!path.relative(root,file).startsWith('..'));
      try { return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)}); }
      catch (e) { errors.push(e.message); return route.fulfill({status:404,body:'missing'}); }
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(() => {
      window.requestIdleCallback=()=>1; window.cancelIdleCallback=()=>{};
      const NativeDate=Date, now=Date.parse('2026-11-05T16:00:00Z');
      window.Date=class extends NativeDate { constructor(...a){super(...(a.length?a:[now]));} static now(){return now;} };
    });
    await page.goto(origin+'/check');
    const report = await page.evaluate(async () => {
      const [S,R,D,L,V]=await Promise.all([import('/js/core/score-release.js'),import('/js/core/return.js'),import('/js/core/data.js'),import('/js/core/daily.js'),import('/js/views/return.js')]);
      await D.load();
      const ok=(b,m)=>{if(!b)throw Error(m);}, eq=(a,b,m)=>ok(JSON.stringify(a)===JSON.stringify(b),m);
      const {day:n,key,previousKey,field}=S.RETURN_REPLAY, results=[];
      ok(n===17 && R.todayNumber()===n,'reset is November 5, not a rolling daily reset');
      const retired=S.readScores({nick:'Old phone',days:{17:{p:999}},rm2:{17:{y:999}},pic:'keep'});
      ok(S.SCORE_MAPS.every(k=>!Object.keys(retired[k]).length) && retired.pic==='keep','pre-v3 scores remain retired');
      const otherGames={total:200,days:{17:{p:200}},s17:{17:{w:12}},dr5:{17:{r:'W'}},kk1:{17:{m:9}}};
      const otherWrite=S.writeScores({nick:'Runner',...otherGames,rm2:{16:{y:80},18:{y:90}}});
      for(const [k,v] of Object.entries(otherGames)) eq(otherWrite.scoresV3[k],v,'other-game write preserved: '+k);
      ok(otherWrite.total===200 && otherWrite.scoresV3.rm2[16].y===80 && otherWrite.scoresV3.rm2[18].y===90,'existing rules and other Return Man dates preserved');
      eq(S.scoreFields(['nick','days','total','fr3.m_evan']),['nick','scoresV3.days','scoresV3.total','total','fr3.m_evan'],'other-game narrow field writes preserved');
      const score=(y)=>({y,l:y,td:Math.floor(y/100),t:Date.now()-3600000,c:5,a:1});
      const deepMerge=(to,from)=>{for(const [k,v] of Object.entries(from)){if(v&&typeof v==='object'&&!Array.isArray(v))deepMerge(to[k]||(to[k]={}),v);else to[k]=v;}return to;};
      for(const profile of ['evan','ben','Ryan Stewart','Evan Appenzeller','Guest Runner',null]) {
        L.LB.merge=null; localStorage.clear(); D.setMe(['evan','ben'].includes(profile)?profile:'none'); D.setGuest(['evan','ben'].includes(profile)?null:profile); R.setTest(false);
        const before={r:[{y:111,d:100,c:4}],at:1}, after={r:[{y:222,d:200}],at:3};
        const archive=JSON.stringify({played:4,days:{[n-1]:before,[n]:{r:[{y:900,d:800,c:80},{y:950,d:820}],at:2,live:{k:2,y:1200,d:1000,c:90}},[n+1]:after}});
        localStorage.setItem(previousKey,archive);
        localStorage.setItem('gg-v3-kick1','other-game'); localStorage.setItem('gg-v3-fr1-m_evan','realm-progress');
        const day=R.dayState(n);
        ok(day.next===0 && !day.done && day.best===0 && day.coins===null && !R.live(n) && R.settle(n)===null,'fresh attempt, no saved/live score: '+profile);
        eq(JSON.parse(localStorage.getItem(key)).days,{[n-1]:before,[n+1]:after},'other dates unchanged');
        ok(R.totals().played===2 && localStorage.getItem(previousKey)===archive,'attempt totals reset, original archived');
        ok(localStorage.getItem('gg-v3-kick1')==='other-game' && localStorage.getItem('gg-v3-fr1-m_evan')==='realm-progress','other games and resources untouched');
        const raw={id:'local',nick:profile||'Visitor',g:!D.me(),total:10,pic:'keep',scoresV3:{days:{17:{p:10}},s17:{17:{w:12}},dr5:{17:{r:'W'}},kk1:{17:{m:9}},rm2:{[n-1]:score(111),[n]:score(950)}}};
        const other={id:'other-phone',nick:raw.nick,g:raw.g,total:10,scoresV3:{rm2:{[n]:score(5000)}}};
        const clean=()=>[raw,other].map(S.readScores);
        const first=clean()[0];
        ok(!first.rm2[n] && first.rm2[n-1].y===111,'today old cloud scores excluded, yesterday retained');
        for(const f of ['days','s17','dr5','kk1']) eq(first[f],raw.scoresV3[f],'other cloud game unchanged: '+f);
        ok(first.pic==='keep','profile picture preserved');
        let posted=null;
        Object.assign(L.LB,{ready:true,synced:true,off:false,err:null,uid:'local',nick:raw.nick,raw:clean(),players:clean(),merge:async body=>{posted=S.writeScores(body);deepMerge(raw,posted);L.LB.raw=clean();L.LB.players=L.LB.raw;}});
        ok(!R.boardRows(n).length && R.attemptsOf(L.LB.raw,n)===null && !R.ranElsewhere(n),'today leaderboard and remote attempt limit reset');
        ok(R.weekRows(n).some(row=>row.y===111),'earlier week scores remain');
        ok(R.coinsOpen(n,0,true),'first new attempt eligible under existing coin rules');
        const title=V.render({}); ok(title.includes('rm-start-title') && title.includes('PLAY!') && !title.includes('That’s today’s return'),'real title permits another run');
        ok(R.record(n,0,120,110,3)?.done && R.record(n,1,400,300,6)===null,'exactly one replacement attempt');
        ok(await R.autoPost(),'replacement score posts');
        ok(posted.scoresV3.rm2[field].y===120 && !Object.hasOwn(posted.scoresV3.rm2,n),'replacement uses isolated cloud slot');
        ok(R.entryOf(clean()[0],n).y===120 && R.ranElsewhere(n) && !R.coinsOpen(n,0,true),'new result counts and closes the daily attempt');
        // A stale phone still writes the original slot; it cannot overwrite the replacement round.
        raw.scoresV3.rm2[n]=score(99999);
        localStorage.setItem(previousKey,JSON.stringify({played:99,days:{[n]:{r:[{y:99999,d:99999}]}}}));
        ok(R.entryOf(clean()[0],n).y===120 && R.dayState(n).best===120,'old client writes cannot resurrect or replace reset scores');
        const stable=localStorage.getItem(key); R.dayState(n); R.totals(); ok(localStorage.getItem(key)===stable,'migration is idempotent');
        // A second updated phone with only the old local archive still sees the new cross-device daily lock.
        localStorage.removeItem(key); R.dayState(n); L.LB.raw=clean();
        ok(R.dayState(n).next===0 && R.ranElsewhere(n) && V.render({}).includes('That’s today’s return'),'second phone cannot replay the replacement attempt');
        results.push(profile||'unselected');
      }
      L.LB.merge=null;
      return {passed:true,date:S.RETURN_REPLAY.date,profiles:results};
    });
    await page.reload();
    assert(await page.evaluate(async()=>{const R=await import('/js/core/return.js');return R.dayState(17).next===0 && R.dayState(16).best===0;}),'reload keeps the migrated second-phone store');
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    const out=path.join(root,'output/return-reset');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log('PASS November 5 reset: local/cloud history, one replacement attempt, old-client isolation, cross-device lock, all profiles, title and other-game preservation.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
