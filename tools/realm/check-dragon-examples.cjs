// Personal dragon demonstrations: isolated state, real simulation and replay.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), read = p => fs.readFileSync(path.join(root, p), 'utf8');
const uri = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
let profile = 'evan', guest = null;
globalThis.__demoProfile = () => profile; globalThis.__demoGuest = () => guest;
const realm = uri(read('js/core/realm.js')
  .replace("import * as daily from './daily.js';", 'const daily={LB:{}};')
  .replace("import * as data from './data.js';", 'const data={me:()=>globalThis.__demoProfile(),guest:()=>globalThis.__demoGuest(),user:()=>null,isOwner:()=>globalThis.__demoProfile()===\'evan\',subscribe:()=>()=>{}};')
  .replaceAll("from './realm-pay.js'", 'from ' + JSON.stringify(uri(read('js/core/realm-pay.js'))))
  .replaceAll("from './realm-dragons.js'", 'from ' + JSON.stringify(uri(read('js/core/realm-dragons.js')))));
const battle = uri(read('js/core/realm-battle.js').replace("from './realm.js'", 'from ' + JSON.stringify(realm)));
const clone = s => JSON.parse(JSON.stringify(s));
const gameplay = s => Object.fromEntries(Object.entries(s).filter(([k]) => !['ex', 'exv', 'exdv', 'lots'].includes(k)));
(async () => {
  const F = await import(realm), B = await import(battle), now = Date.UTC(2026, 9, 26, 12);
  for (const castle of [1, 8]) {
    const s = F.fresh(now); s.b[0].l = castle; s.exv = F.EX_V;
    if (castle === 8) for (const [i, species] of F.DRAGON_ORDER.entries()) {
      const p = F.spotFor(s, 'hatchery');
      s.b.push({i:s.nb++,t:'hatchery',l:i+2,x:p.x,y:p.y,u:0,dragon:{species,color:F.DRAGONS[species].colors[1]}});
    }
    const before = clone(gameplay(s));
    assert(await B.ensureExamplesAsync(s, now, {dragonDemo:true, budget:100}));
    assert.equal(s.ex.length,3); assert.equal(s.exdv,1); assert.deepEqual(gameplay(s),before);
    assert.deepEqual(s.ex.map(r=>r.by),['Nightmare & Soul Eater','Terror Bringer & Usurper','Four-Dragon Siege']);
    const all = new Set();
    for (const [i, rec] of s.ex.entries()) {
      assert.equal(rec.demo,'dragons-v1'); assert.equal(rec.ex,true); assert.equal(rec.td,0);
      assert.deepEqual(rec.ls,[0,0]); assert.deepEqual(rec.lb,{});
      const P=F.decodeReplay(rec.rp,s); assert(P);
      const dragons=Object.values(P.dragons); assert.equal(dragons.length,i===2?4:2);
      for(const d of dragons){all.add(d.species);assert(P.drops.some(drop=>drop[1]===F.DRAGONS[d.species].troop));
        assert.equal(d.color,castle===8?F.DRAGONS[d.species].colors[1]:({nightmare:'green','soul-eater':'purple','terror-bringer':'albino',usurper:'black'})[d.species]);}
      const replay=B.replay(P.base,P.loot,P.army,P.drops,Infinity,P.opts);
      assert.deepEqual([replay.stars(),replay.pct(),replay.got.gold,replay.got.grain],[rec.st,rec.pc,...rec.lt]);
      assert.deepEqual(replay.dragons,P.dragons);
    }
    assert.deepEqual([...all].sort(),[...F.DRAGON_ORDER].sort());
    const saved=F.clean(s); assert.equal(saved.ex.length,3); assert.equal(saved.exdv,1);
    assert.equal(await B.ensureExamplesAsync(saved,now+1,{dragonDemo:true}),false,'No repeated automatic generation');
    F.clearExamples(saved);assert.equal(await B.ensureExamplesAsync(saved,now+2,{dragonDemo:true}),false,'Clear stays cleared');
    assert.equal((await B.exampleRaidsAsync(saved,now+3,{dragonDemo:true,budget:100})).length,3,'Manual regeneration works');
    console.log('PASS: Castle '+castle+' three dragon samples, all species/colors, exact replays, unchanged gameplay and persistence');
  }
  for(const p of ['mason',null]){
    profile=p;guest=p?null:'Guest';const s=F.fresh(now);s.exv=F.EX_V;const before=clone(s);
    assert.equal(await B.ensureExamplesAsync(s,now,{dragonDemo:true}),false);assert.deepEqual(s,before);
    const normal=await B.exampleRaidsAsync(s,now,{dragonDemo:true,budget:100});assert(normal.every(r=>!r.demo));
  }
  profile=null;guest=null;assert.equal(await B.ensureExamplesAsync(F.fresh(now),now,{dragonDemo:true}),false);
  profile='evan';const s=F.fresh(now),before=clone(s),pending=B.exampleRaidsAsync(s,now,{dragonDemo:true,budget:1});
  profile='mason';assert.equal(await pending,null);assert.deepEqual(s,before,'Profile switch cancels without saving examples');
  console.log('PASS: Evan-only generation; other profiles retain normal examples; switching profiles cancels pending work');
})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1;});
