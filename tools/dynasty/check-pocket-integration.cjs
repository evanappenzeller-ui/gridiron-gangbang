// v7 profile rollout, additive deck saves, real Solo logs, reloads and one-time rewards.
// Offline: actual game/persistence modules, in-memory storage, no Firebase or network.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const snap = value => JSON.stringify(value);
const copy = value => JSON.parse(snap(value));
const LEAGUE = JSON.parse(read('data/league.json')).managers.map(m => m.id);
const USERS = vm.runInNewContext(read('js/core/data.js').match(/export const USERS = ([\s\S]*?);/)[1]);
const profiles = [
  {member:'evan', key:'m_evan'}, {member:'jayton', key:'m_jayton'},
  {user:{id:'ryan-stewart',name:'Ryan Stewart'}, key:'u_ryan-stewart'},
  {user:{id:'ryan-younggreen',name:'Ryan Younggreen'}, key:'u_ryan-younggreen'}
];
let fixtureNumber = 0;

async function fixture(profile = profiles[0], initial = []) {
  profile = copy(profile);
  const storage = new Map(initial), timers = new Map(), errors = [];
  let tid = 0, clock = 0, randomSeed = ++fixtureNumber, now = 1793923200000 + fixtureNumber * 1000;
  const fixedMath = Object.create(Math);
  fixedMath.random = () => { randomSeed = (Math.imul(randomSeed,1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now++; } }
  const localStorage = {
    getItem:key => storage.get(key) ?? null,
    setItem:(key,value) => storage.set(key,String(value)),
    removeItem:key => storage.delete(key)
  };
  const ctx = vm.createContext({console:{log(){},warn(){},error:e=>errors.push(String(e))},
    Date:Clock, Math:fixedMath, JSON, URL, URLSearchParams, structuredClone, localStorage,
    setTimeout:(fn,delay)=>{ const id=++tid; timers.set(id,{fn,delay,at:clock+Number(delay || 0)}); return id; },
    clearTimeout:id=>timers.delete(id), addEventListener(){},
    fetch:async url=>{
      assert.equal(url,'data/dynasty.json','only the bundled catalogue may load');
      return {ok:true,json:async()=>JSON.parse(read('data/dynasty.json'))};
    }
  });
  const mods = new Map();
  function stub(file, exports) {
    const id=path.join(root,'js/core',file);
    mods.set(id,new vm.SyntheticModule(Object.keys(exports),function(){
      for(const [key,value] of Object.entries(exports))this.setExport(key,value);
    },{context:ctx,identifier:id}));
  }
  stub('data.js',{OWNER:'evan',me:()=>profile.member||null,user:()=>profile.user||null,
    isOwner:()=>profile.member==='evan',guest:()=>profile.member?null:profile.user?.name||profile.guestName||'',name:id=>id,
    subscribe:()=>()=>{},ids:LEAGUE,USERS});
  stub('realm-active.js',{profileKey:()=>profile.key,visitWho:()=>null});
  stub('daily.js',{LB:{raw:[],all:[],ready:false,synced:false,off:true},boardKey:()=>null,
    asGuest:()=>!profile.member,subscribe:()=>()=>{}});
  function moduleAt(id) {
    if(!mods.has(id))mods.set(id,new vm.SourceTextModule(fs.readFileSync(id,'utf8'),{context:ctx,identifier:id}));
    return mods.get(id);
  }
  async function get(file) {
    const mod=moduleAt(path.join(root,'js/core',file));
    if(mod.status==='unlinked')await mod.link((spec,parent)=>moduleAt(path.resolve(path.dirname(parent.identifier),spec)));
    if(mod.status==='linked')await mod.evaluate();
    return mod.namespace;
  }
  const S=await get('dynasty-solo.js'), D=await get('dynasty.js');
  await D.load();
  const B=await get('dynasty-battle.js'), P=await get('dynasty-pocket.js');
  const C=await get('dynasty-pocket-cards.js'), T=await get('dynasty-table.js'), F=await get('features.js');
  let autoPlayback = null;
  function advance(ms) {
    const end=clock+ms;
    for(let count=0;;count++) {
      assert.ok(count<10000,'timer clock settles without runaway callbacks');
      const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!next)break;
      clock=next[1].at;timers.delete(next[0]);next[1].fn();
    }
    clock=end;
  }
  return {D,S,B,P,C,T,F,storage,errors,profile,
    advance, pending:delay=>[...timers].filter(([,t])=>delay==null||t.delay===delay),
    record:()=>JSON.parse(storage.get('gg-dys2-'+profile.key)||'null'),
    cpuStep(){
      const mid=S.current()?.mid;
      if(autoPlayback?.mid!==mid){autoPlayback?.stop();autoPlayback={mid,stop:S.watchPlayback(mid,()=>true)};}
      const next=[...timers].find(([,t])=>t.delay===S.CPU_STEP_MS);assert.ok(next,'CPU turn scheduled');
      advance(next[1].at-clock);
    }
  };
}

function startCpuTurn(f) {
  const {S,P}=f, opened=S.start('g1');assert.equal(opened.ok,true,opened.why);
  let x=S.get(opened.mid);
  assert.equal(S.move(opened.mid,P.nextMove(x.G,0,30)).ok,true,'human setup is legal');
  x=S.get(opened.mid);
  if(x.state==='yours')assert.equal(S.move(opened.mid,{a:'end'}).ok,true,'human yields the opening turn');
  assert.equal(S.get(opened.mid).state,'theirs');
  return opened.mid;
}

async function checkPacing() {
  for(const profile of profiles) {
    const f=await fixture(profile), {S}=f, mid=startCpuTurn(f), beat=S.CPU_STEP_MS;
    assert.equal(beat,2000,'CPU actions have a two-second reading interval');
    const before=snap(f.record());
    f.advance(beat*4);
    assert.equal(snap(f.record()),before,profile.key+' reading a saved match without playback never advances it');
    const blocked={scene:true,sheet:false,hidden:false};
    const stop=S.watchPlayback(mid,()=>!Object.values(blocked).some(Boolean));
    for(const reason of ['scene','sheet','hidden']) {
      Object.keys(blocked).forEach(k=>blocked[k]=k===reason);
      f.advance(beat*4);
      assert.equal(snap(f.record()),before,profile.key+' CPU waits while '+reason+' blocks playback');
    }
    blocked.hidden=false;
    // The next readiness poll starts a fresh beat; time spent blocked never accrues.
    f.advance(100);
    f.advance(beat-1);
    assert.equal(snap(f.record()),before,profile.key+' resuming still gives a complete reading interval');
    f.advance(1);
    assert.equal(f.record().log.length,JSON.parse(before).log.length+1,profile.key+' resuming applies exactly one CPU action');
    const after=snap(f.record());
    f.advance(beat-1);
    assert.equal(snap(f.record()),after,profile.key+' later actions cannot catch up in a burst');
    stop();f.advance(beat*4);
    assert.equal(snap(f.record()),after,profile.key+' leaving playback stops the pending turn');
    assert.deepEqual(f.errors,[]);
  }

  const f=await fixture(), {S}=f, mid=startCpuTurn(f), beat=S.CPU_STEP_MS;
  const oldStop=S.watchPlayback(mid,()=>true), oldTimer=f.pending(beat)[0][1].fn;
  const before=snap(f.record());
  let ready=false;
  const stop=S.watchPlayback(mid,()=>ready);
  oldStop();oldTimer();
  f.advance(beat*2);
  assert.equal(snap(f.record()),before,'a stale timer cannot bypass the replacement playback blocker');
  ready=true;f.advance(100+beat);
  assert.equal(f.record().log.length,JSON.parse(before).log.length+1,'disposing the old lease leaves the replacement lease active');
  stop();

  const delayed=startCpuTurn(f);let sheetOpen=false;
  const delayedStop=S.watchPlayback(delayed,()=>!sheetOpen), delayedBefore=snap(f.record());
  f.advance(beat/2);sheetOpen=true;
  f.advance(beat*3);
  assert.equal(snap(f.record()),delayedBefore,'a sheet opened during the countdown blocks the already scheduled move');
  sheetOpen=false;f.advance(100+beat-1);
  assert.equal(snap(f.record()),delayedBefore,'closing a mid-countdown sheet restarts the entire reading interval');
  f.advance(1);
  assert.equal(f.record().log.length,JSON.parse(delayedBefore).log.length+1,'mid-countdown resume commits one move');
  delayedStop();

  const replaced=startCpuTurn(f), replacedStop=S.watchPlayback(replaced,()=>true);
  const replacedTimer=f.pending(beat)[0][1].fn, current=startCpuTurn(f), currentBefore=snap(f.record());
  replacedTimer();f.advance(beat*3);
  assert.equal(snap(f.record()),currentBefore,'a replaced match cannot inherit its predecessor’s scheduled move or lease');
  const currentStop=S.watchPlayback(current,()=>true);
  replacedStop();replacedTimer();f.advance(beat);
  assert.equal(f.record().log.length,JSON.parse(currentBefore).log.length+1,'stale match cleanup leaves the new match’s timer intact');
  currentStop();

  const source=startCpuTurn(f), sourceStop=S.watchPlayback(source,()=>true);
  const staleTimer=f.pending(beat)[0][1].fn, sourceRecord=snap(f.record());
  const other=copy(f.record());other.id='cpu-other-profile';
  f.storage.set('gg-dys2-m_jayton',snap(other));
  f.profile.member='jayton';f.profile.key='m_jayton';
  S.get(other.id);staleTimer();f.advance(beat*3);
  assert.equal(f.storage.get('gg-dys2-m_evan'),sourceRecord,'profile change leaves the prior match untouched');
  assert.equal(snap(f.record()),snap(other),'profile change cannot advance the new profile from the old timer');
  const otherStop=S.watchPlayback(other.id,()=>true);
  sourceStop();staleTimer();f.advance(beat);
  assert.equal(f.record().log.length,other.log.length+1,'the new profile plays only after its own full delay');
  otherStop();
  assert.deepEqual(f.errors,[]);
  console.log('PASS CPU pacing: four-profile reading intervals, scene/sheet/background pauses, no catch-up, cancellation and stale match/profile timers.');
}

function legacyRecord(B, deck) {
  const seed='pocket-legacy-v6', chemistry={v:1,team:'KC'}, roundEnergy=2;
  const G=B.newGame(seed,[deck,deck],6,chemistry,roundEnergy), log=[];
  for(let who=0;who<2;who++) {
    const hand=G.p[who].hand.filter(id=>B.basicIn(id,6));
    const move={a:'setup',act:hand[0],bench:hand.slice(1,4)};
    assert.equal(B.play(G,who,move).ok,true);log.push([who,move]);
  }
  for(let i=0;i<6&&G.phase!=='over';i++) {
    const who=B.toMove(G), move=B.check(G,who,{a:'attack',n:0}).ok?{a:'attack',n:0}:{a:'end'};
    assert.equal(B.play(G,who,move).ok,true);log.push([who,move]);
  }
  return {G,record:{id:'cpu-legacy-v6',opp:'g1',seed,v:6,decks:[deck,deck],chemistry,roundEnergy,log,at:1,z:'',paid:0,pay:null}};
}

(async()=>{
  await checkPacing();
  for(const profile of profiles) {
    const f=await fixture(profile), {D,S,F,C}=f, s=D.mine();
    const before=snap(s), deck=D.pocketDeck();
    assert.equal(F.rivalsUpdated(),true,profile.key+' enabled');
    assert.equal(deck.ok,true,'new collection has a playable rental');
    assert.equal(deck.ids.length,20);assert.equal(deck.rental,true);
    assert.equal(snap(s),before,'reading new decks never alters collection or legacy save');
    assert.equal(C.checkDeck(deck.ids,null,deck.energy).ok,true);
    assert.equal(S.start('g2').ok,false,'ladder lock remains enforced');
    const start=S.start('g1');assert.equal(start.ok,true,start.why);
    const x=S.get(start.mid), record=f.record();
    assert.equal(x.G.v,7,profile.key+' new match uses v7');
    assert.equal(record.v,7);assert.equal(record.decks[0].length,20);assert.equal(record.decks[1].length,20);
    assert.equal(record.chemistry,undefined,'no automatic team bonus in new games');
    assert.equal(record.roundEnergy,undefined,'no legacy automatic attachments');
    assert.equal(snap(s),before,'starting with a rental grants or consumes no cards');
    assert.equal(F.packsUnlimited(profile.key),['m_evan','u_ryan-stewart'].includes(profile.key));
    assert.equal(F.coinsUnlimited(profile.key),profile.key==='m_jayton');
    const resumed=await fixture(profile,[...f.storage]);
    assert.equal(snap(resumed.S.get(start.mid).G),snap(x.G),'v7 initial log reloads identically');
    assert.deepEqual(f.errors,[]);
    assert.equal(D.tutorialDue(),true,profile.key+' gets first-time practice');
    assert.equal(D.finishTutorial('completed','m_someone-else'),false,'stale profile cannot mark a receipt');
    assert.equal(D.finishTutorial('skipped',profile.key),true);
    assert.equal(D.tutorialDue(),false);
    assert.equal(D.clean(D.mine()).tutorial.result,'skipped','receipt survives save cleaning');
    const skipped=await fixture(profile,[...f.storage]);
    assert.equal(skipped.D.tutorialDue(),false,'receipt survives reload');
    assert.equal(D.finishTutorial('completed',profile.key),true);
    assert.equal(D.finishTutorial('skipped',profile.key),true);
    assert.equal(D.mine().tutorial.result,'completed','replay Skip never downgrades completion');
    const kept=copy(D.mine()),was=JSON.parse(before);delete kept.tutorial;delete kept.at;delete was.at;
    assert.deepEqual(kept,was,'tutorial receipt preserves existing progress and real battle');
  }
  // Rivals is everyone's (Nov 10 2026): a member outside the preview and a named guest play; a phone with no profile can't.
  for(const profile of [{member:'mason',key:'m_mason'}, {key:'g_pat',guestName:'Pat'}]) {
    const f=await fixture(profile), {D,S,F}=f;
    assert.equal(F.rivalsUpdated(),true,profile.key+' plays');assert.equal(D.tutorialDue(),true);
    const start=S.start('g1');assert.equal(start.ok,true,start.why);assert.equal(S.get(start.mid).G.v,7);
    assert.equal(F.packsUnlimited(profile.key),false);assert.equal(F.coinsUnlimited(profile.key),false);
  }
  for(const profile of [{key:''}]) {
    const {D,S,F,storage}=await fixture(profile), s=D.fresh(), before=snap(s);
    assert.equal(F.rivalsUpdated(),false);assert.equal(S.start('g1').ok,false);assert.equal(S.get(),null);
    assert.equal(D.tutorialDue(),false);assert.equal(D.finishTutorial('completed',profile.key),false);
    assert.equal(D.savePocketDeck({name:'forbidden',ids:[],energy:['Fire']},s).ok,false);
    assert.equal(D.usePocketDeck('rental',s).ok,false);assert.equal(D.deletePocketDeck('x',s),false);
    assert.equal(snap(s),before,'denied deck mutations leave save unchanged');assert.equal(storage.size,0);
  }

  const f=await fixture(), {D,B,C,T}=f, s=D.mine();
  s.o=Object.fromEntries([...D.CARDS.map(c=>c.id),...Object.keys(B.TRAINERS)].map(id=>[id,2]));
  s.dk=D.autoDeck(s.o);s.table={v:1,deck:T.deck(s).ids,finish:'felt'};
  const cleanBase=D.clean(copy(s)), preserved=snap({o:cleanBase.o,dk:cleanBase.dk,table:cleanBase.table});
  const owned=D.pocketDeck(cleanBase);assert.equal(owned.ok,true);assert.equal(owned.rental,false);
  const saved=D.savePocketDeck({name:'Built from collection',ids:owned.ids,energy:owned.energy},cleanBase);
  assert.equal(saved.ok,true,saved.why);assert.equal(D.usePocketDeck(saved.id,cleanBase).ok,true);
  assert.equal(D.deletePocketDeck(saved.id,cleanBase),false,'active deck cannot be deleted');
  assert.equal(snap({o:cleanBase.o,dk:cleanBase.dk,table:cleanBase.table}),preserved,'new loadout does not replace legacy data');
  const restored=D.clean(copy(cleanBase));
  assert.equal(snap(restored.pocket),snap(cleanBase.pocket),'loadout and Energy choices round trip');
  assert.equal(snap(D.pocketDeck(restored).ids),snap(owned.ids));
  const draft=D.savePocketDeck({name:'Draft',ids:[],energy:['Fire']},restored);
  assert.equal(draft.ok,true);assert.equal(D.usePocketDeck(draft.id,restored).ok,false,'incomplete draft cannot enter a match');
  assert.equal(D.deletePocketDeck(draft.id,restored),true);
  const empty=D.fresh(), rental=C.rentalDeck(), rentalBefore=snap(empty);
  assert.equal(D.savePocketDeck({...rental,rental:true},empty).ok,false,'rental cannot be edited');
  assert.equal(D.savePocketDeck({...rental,rental:false},empty).ok,false,'rentals cannot bypass ownership by changing a flag');
  assert.equal(snap(empty),rentalBefore,'rental rejection never grants cards');
  assert.equal(D.usePocketDeck('rental',restored).ok,true);
  assert.equal(D.pocketDeck(restored).rental,true);assert.equal(D.deletePocketDeck('rental',restored),false);
  assert.equal(D.savePocketDeck({name:'Bad energy',ids:owned.ids,energy:['Colorless']},restored).ok,false);
  assert.equal(D.savePocketDeck({name:'Duplicates',ids:Array(20).fill(owned.ids[0]),energy:['Fire']},restored).ok,false);
  const dependency=D.fresh(), source=D.CARDS[0].id;
  dependency.o={[source]:1};
  dependency.table={decks:[{id:'empty',name:'Empty legacy draft',ids:[]}],active:'empty'};
  assert.equal(D.savePocketDeck({name:'Development draft',ids:[source+'~prime'],energy:['Fire']},dependency).ok,true);
  assert.equal(D.sell(source,1,dependency).ok,false,'the last owned Base stays available for a saved development card');
  assert.equal(dependency.o[source],1);

  const old=legacyRecord(B,T.deck(s).ids), oldStorage=[['gg-dy2-m_evan',snap(cleanBase)],['gg-dys2-m_evan',snap(old.record)]];
  const legacy=await fixture(profiles[0],oldStorage), unchanged=legacy.S.get(old.record.id);
  assert.equal(snap(unchanged.G),snap(old.G),'saved v6 rules and full move log replay unchanged');
  assert.equal(legacy.storage.get('gg-dys2-m_evan'),snap(old.record),'opening old game never rewrites its record');
  assert.equal(snap(legacy.D.mine().table),snap(cleanBase.table),'old 40-card deck remains byte-identical');
  assert.equal(snap(legacy.D.mine().o),snap(cleanBase.o),'old owned collection preserved');

  // Real Solo moves (including the scheduled CPU) must terminate and replay from the saved log.
  let victories=0;
  for(let attempt=0;attempt<10;attempt++) {
    const game=await fixture(), {D,S,P}=game;
    const opened=S.start('g1');assert.equal(opened.ok,true,opened.why);
    let x=S.get(opened.mid), actions=0;
    while(x.state!=='over'&&actions++<1600) {
      if(x.state==='theirs')game.cpuStep();
      else {const move=P.nextMove(x.G,0,30);assert.equal(P.check(x.G,0,move).ok,true,'AI human move legal');const out=S.move(opened.mid,move);assert.equal(out.ok,true,out.why);}
      x=S.get(opened.mid);
    }
    assert.equal(x.state,'over','complete game terminates through normal rules');
    const r=game.record();
    assert.equal(r.paid,1);assert.ok(r.log.length>4,'complete persisted move log');
    const paid=snap(D.mine()), money=D.mine().cr;
    S.get(opened.mid);S.get(opened.mid);assert.equal(snap(D.mine()),paid,'same result pays exactly once');
    const reload=await fixture(profiles[0],[...game.storage]), rx=reload.S.get(opened.mid);
    assert.equal(snap(rx.G),snap(x.G),'complete v7 game replays identically');
    assert.equal(reload.D.mine().cr,money,'reload pays no duplicate coins');
    assert.equal(snap(reload.D.mine().o),snap(D.mine().o),'match damage/discards do not consume collection cards');
    if(x.result==='w') {victories++;assert.equal(S.unlocked('g2'),true);assert.equal(S.unlocked('g3'),false);}
    assert.deepEqual(game.errors,[]);
  }
  assert.ok(victories>0,'the rental can win a real first-ladder match');

  for(const stage of ['g5','g10']) {
    let won=false;
    for(let attempt=0;attempt<30&&!won;attempt++) {
      const game=await fixture(), {D,S,P}=game, state=D.mine(), level=Number(stage.slice(1));
      for(let n=1;n<level;n++)state.so['g'+n]=1;
      D.touch();
      const cards=snap(state.o), packs=copy(state.pk), boss=D.soloBoss(stage).id;
      const opened=S.start(stage);assert.equal(opened.ok,true,opened.why);
      let x=S.get(opened.mid), actions=0;
      assert.equal(x.boss,boss,'new boss reward identity retained');
      assert.equal(x.G.p[1].active.id,boss,'CPU actually fields its featured boss');
      while(x.state!=='over'&&actions++<1600) {
        if(x.state==='theirs')game.cpuStep();
        else {const move=P.nextMove(x.G,0,30), out=S.move(opened.mid,move);assert.equal(out.ok,true,out.why);}
        x=S.get(opened.mid);
      }
      assert.equal(x.state,'over','boss match terminates');
      if(x.result!=='w') {assert.equal(snap(state.o),cards,'loss grants no boss card');assert.equal(state.bossRewards?.[stage],undefined);continue;}
      won=true;
      if(stage==='g5') {
        assert.equal(x.pay.bossPack,'std');assert.equal(state.pk.std,packs.std+1);assert.equal(snap(state.o),cards);
      } else {
        assert.equal(x.pay.card,boss);assert.equal(state.o[boss],(JSON.parse(cards)[boss]||0)+1);assert.equal(snap(state.pk),snap(packs));
      }
      const count=snap({o:state.o,pk:state.pk,cr:state.cr,bossRewards:state.bossRewards});
      const reload=await fixture(profiles[0],[...game.storage]);reload.S.get(opened.mid);reload.S.get(opened.mid);
      const restored=reload.D.mine();
      assert.equal(snap({o:restored.o,pk:restored.pk,cr:restored.cr,bossRewards:restored.bossRewards}),count,'boss reward is not duplicated by reload');
      assert.equal(reload.S.unlocked('g'+(level+1)),true,'boss win unlocks next ladder battle');
    }
    assert.equal(won,true,'rental reaches a legal winning boss log for '+stage);
  }
  console.log('PASS v7 for the four preview profiles, a new member and a guest, denied profile-less phone, unchanged privileges, legal rentals and owned loadouts, save round trips, v6 replay and old deck preservation.');
  console.log('PASS ten complete saved Solo matches, legal AI moves, deterministic reloads, one-time rewards, real pack/card boss wins and ladder unlocks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
