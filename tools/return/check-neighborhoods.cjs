#!/usr/bin/env node
// Dense scenery must never cover the three playable lanes, even in the canvas fallback.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../js/views/return-neighborhoods.js'), 'utf8');
  const N = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const themes = ['stadium', 'tailgate', 'city', 'tundra', 'desert', 'market', 'beach', 'space', 'farm'];
  const rng = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  let count = 0, maxParts = 0;
  for (const theme of themes) for (let tile = 0; tile < 100; tile++) {
    const z0 = tile * 100, fixtures = theme === 'desert' ? [{k:'facade',s:1,x:9.6,z0:z0+6,z1:z0+18,h:5,name:'SALOON',col:'#B86449'}]
      : theme === 'farm' ? [-1, 1].flatMap(s => [{k:'fence2',s,x:6.1,z0,z1:z0+100}, {k:'corn',s,x:8.2,z0,z1:z0+100}]) : [];
    const list = structuredClone(fixtures), again = structuredClone(fixtures);
    N.populate(list, theme, z0, z0 + 100, rng(tile + 7));
    N.populate(again, theme, z0, z0 + 100, rng(tile + 7));
    assert.deepEqual(list, again, theme + ': deterministic art across profiles');
    assert.deepEqual(list.slice(0, fixtures.length), fixtures, 'existing model lots are preserved');
    const additions = list.filter(o => o.k === 'neighborhood');
    if (theme === 'farm') assert(additions.filter(o => o.kind === 'farm').length >= 20, 'fences and corn do not suppress the verge props');
    assert(additions.length >= 20 && additions.length <= 40, theme + ': dense, bounded chunk population');
    const pieces = additions.flatMap(o => o.parts); maxParts = Math.max(maxParts, pieces.length);
    assert(pieces.length < 800, theme + ': bounded geometry recipes');
    for (const p of pieces) {
      assert([p.x,p.y,p.z,p.w,p.h,p.d,p.rx,p.ry,p.rz].every(Number.isFinite), 'finite geometry');
      assert(p.w > 0 && p.h > 0 && p.d > 0, 'nondegenerate geometry');
      const radius = p.shape === 'box' ? p.w / 2 : p.w;
      assert(Math.abs(p.x) - radius >= N.CLEARANCE, theme + ': keep scenery outside all lanes');
    }
    count += pieces.length;
  }
  console.log(`Nine zones / 900 tiles: ${count} pieces checked; clear lanes, stable profile-independent art, preserved lots; max ${maxParts} pieces per tile.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
