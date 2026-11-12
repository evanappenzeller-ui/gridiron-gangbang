// Deterministic lesson progression through the real engine, with no browser or saves.
const assert = require('node:assert/strict');
(async () => {
  const B = await import('../../js/core/dynasty-pocket.js');
  const {createTutorial} = await import('../../js/core/dynasty-tutorial.js');
  const oldInterval = global.setInterval, oldClear = global.clearInterval;
  let tick, cleared = false;
  global.setInterval = fn => { tick = fn; return 1; };
  global.clearInterval = () => { cleared = true; };
  try {
    const session = createTutorial(), G = session.get().G;
    assert.equal(G.phase, 'setup'); assert.equal(session.step, 0);
    G.p.forEach(p => assert(B.checkDeck([...p.hand, ...p.deck, ...B.slots(p).map(s => s.id)], ['Fire']).ok));
    const before = JSON.stringify(G);
    assert.equal(session.move('tutorial', {a:'end'}).ok, false);
    assert.equal(JSON.stringify(G), before);
    let ready = false;
    const stop = session.watchPlayback('tutorial', () => ready);
    session.begin();
    const apply = m => { const step = session.step; assert(session.move('tutorial',m).ok, `lesson ${step}`); assert.equal(session.step,step+1); };
    const cpu = () => { let n=0; while(G.who===1 && n++<10) tick(); assert.equal(G.who,0); };
    apply({a:'setup',act:'R7-mahomes',bench:['R7-lamb']});
    tick(); assert.equal(G.who,1,'hidden/blocked playback does not run');
    ready=true;cpu(); assert.equal(G.p[0].en,'Fire');
    apply({a:'energy',on:G.p[0].active.u});
    apply({a:'support',id:'P7-film'});
    apply({a:'attack',n:0});cpu();
    assert.equal(G.p[0].active.dmg,30); assert.equal(G.p[0].active.en.length,1);
    apply({a:'evolve',id:'R7-mahomes~breakout',on:G.p[0].active.u});
    assert.equal(G.p[0].active.dmg,30); assert.equal(G.p[0].active.en.length,1);
    apply({a:'energy',on:G.p[0].active.u});
    apply({a:'attack',n:0});cpu();
    assert.equal(G.p[0].points,1);assert.equal(G.p[1].active.id,'R7-lamb');
    apply({a:'energy',on:G.p[0].bench[0].u});
    apply({a:'retreat',to:G.p[0].bench[0].u});
    assert.equal(G.p[0].active.id,'R7-lamb'); assert.equal(G.p[0].discardedEnergy.length,1);
    apply({a:'attack',n:0});assert.equal(session.step,11);
    const complete = JSON.stringify(G); tick();assert.equal(JSON.stringify(G),complete,'coach stops after lesson completion');
    stop();assert(cleared);assert.equal(createTutorial().step,0,'replay starts a fresh practice only');
    console.log('PASS tutorial: legal 20-card practice, ten lessons, damage/Energy, KO, promotion, retreat, playback boundaries and replay');
  } finally { global.setInterval=oldInterval;global.clearInterval=oldClear; }
})().catch(e=>{console.error(e);process.exitCode=1;});
