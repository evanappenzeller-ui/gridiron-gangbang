// Peaceful schedules and courtyard routing against the real building catalog.
// No browser, network or player saves.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const uri = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const pay = uri(read('js/core/realm-pay.js')), catalog = uri(read('js/core/realm-dragons.js'));
const realm = uri(read('js/core/realm.js')
  .replace("import * as daily from './daily.js';", 'const daily={LB:{}};')
  .replace("import * as data from './data.js';", 'const data={subscribe:()=>()=>{}};')
  .replaceAll("from './realm-pay.js'", 'from ' + JSON.stringify(pay))
  .replaceAll("from './realm-dragons.js'", 'from ' + JSON.stringify(catalog)));
const npcs = uri(read('js/views/realm-npcs.js')
  .replace("import * as features from '../core/features.js';", 'const features={available:()=>true};')
  .replace("import * as data from '../core/data.js';", 'const data={subscribe:()=>()=>{}};')
  .replace("from '../core/realm.js'", 'from ' + JSON.stringify(realm))
  .replace("import {isDragonKind, BADGE_ON_TOP} from './realm-dragon.js';", 'const isDragonKind=()=>false,BADGE_ON_TOP=1;'));
(async () => {
  const F = await import(realm), {npcPaths} = await import(npcs);
  const {routineRoute, homeRoutine} = await import(uri(read('js/views/realm-routines.js')));
  const base = F.fresh(), grid = npcPaths(base.b);
  const route = routineRoute(grid, base.b[0], {u: .5, v: 2.5}, F.KINDS.keep.size, .3);
  assert(route.length > 1 && route.length <= 5);
  const variants = new Set();
  for (const building of ['keep', 'mine', 'hut', 'barracks']) {
    for (const phase of [0, .19, .57, .99]) {
      const options = {role: 'work', building, phase};
      let previous, idle = 0;
      for (let t = 0; t < 160; t += .05) {
        const result = homeRoutine(route, options, t);
        assert(!['attack', 'hit', 'death', 'run'].includes(result.state));
        assert(!grid.blocked[Math.floor(result.point.y) * F.N + Math.floor(result.point.x)]);
        if (previous) assert(Math.hypot(result.point.x - previous.x, result.point.y - previous.y) < .032, 'No jumps at routine transitions');
        previous = result.point;
        if (result.state === 'idle') idle++;
        if (result.state.startsWith('work')) {
          variants.add(result.state);
          assert.deepEqual(result.point, route[0], 'Work only at the assigned station');
          assert.notEqual(building, 'keep', 'General residents do not chop or hammer');
        }
      }
      assert(idle > 900, 'Residents spend substantial time resting');
      assert.deepEqual(homeRoutine(route, options, 0, true), homeRoutine(route, options, 160, true));
    }
  }
  assert.deepEqual([...variants].sort(), ['work', 'work_b', 'work_c']);
  const divided = npcPaths(Array.from({length: F.N}, (_, y) => ({t: 'wall', x: 22, y})));
  const safe = divided.route({x: 20.5, y: 20.5}, {x: 25.5, y: 20.5});
  assert(safe.every(p => p.x < 22), 'Unreachable destination stays on the same side of walls');
  assert.equal(homeRoutine([], {role: 'work', building: 'mine'}, 50).point, null);
  const manifest = JSON.parse(read('models/realm/western-v2/manifest.json'));
  const bytes = fs.readFileSync(path.join(root, 'models/realm/western-v2/worker.glb'));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  for (const name of variants) {
    assert(gltf.animations.some(a => a.name === name));
    assert(manifest.units.worker.animations.find(a => a.name === name).loop);
  }
  console.log('PASS: three job clips, restful varied routines, continuous walking, stationary work, walls and reduced motion');
})().catch(e => { console.error(e); process.exitCode = 1; });
