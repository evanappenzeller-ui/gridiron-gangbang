// Real Three.js skeleton/mixer checks with an in-memory model and controlled
// loader. No browser, Firebase, user storage or external network is involved.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
const uri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');

(async () => {
  const T = await import(pathToFileURL(path.join(root, 'js/vendor/three/three.module.min.js')));
  const SK = await import(pathToFileURL(path.join(root, 'js/vendor/three/SkeletonUtils.js')));
  let available = false, profile = 'evan', requests = 0, release = null, delayed = false;
  const listeners = new Set(), failed = new Set(), loaded = [];
  const motion = {matches: false};
  globalThis.matchMedia = () => motion;
  const setAvailable = value => { available = value; listeners.forEach(fn => fn('data')); };
  const setProfile = value => { profile = value; listeners.forEach(fn => fn('me')); };
  globalThis.__keepCharacterData = {isOwner: () => profile === 'evan', subscribe: fn => listeners.add(fn)};
  globalThis.__keepCharacterFeatures = {available: () => available};
  function model() {
    const scene = new T.Group(), geometry = new T.BoxGeometry(1, 2, 1);
    const count = geometry.attributes.position.count;
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial());
    const joint = new T.Bone(); joint.name = 'joint'; mesh.add(joint);
    mesh.bind(new T.Skeleton([joint])); mesh.position.y = 1; scene.add(mesh);
    const amounts = {idle: .1, walk: .5, run: 1, attack: 2, hit: -1, death: 3, work: .7};
    const animations = Object.entries(amounts).map(([name, amount]) => new T.AnimationClip(name, 1,
      [new T.NumberKeyframeTrack('joint.rotation[z]', [0, 1], [0, amount])]));
    const result = {scene, animations}; loaded.push(result); return result;
  }
  class GLTFLoader {
    async loadAsync(url) {
      requests++;
      if (delayed) await new Promise(resolve => { const prior = release; release = () => { prior?.(); resolve(); }; });
      if ([...failed].some(kind => url.endsWith('/' + kind + '.glb'))) throw new Error('Intentional unavailable asset');
      return model();
    }
  }
  globalThis.__keepCharacterLoader = {GLTFLoader};
  globalThis.__keepCharacterClone = SK;
  const source = fs.readFileSync(path.join(root, 'js/views/realm-characters.js'), 'utf8')
    .replace("import * as data from '../core/data.js';", 'const data = globalThis.__keepCharacterData;')
    .replace("import * as features from '../core/features.js';", 'const features = globalThis.__keepCharacterFeatures;')
    .replace("new URL('../vendor/three/', import.meta.url).href", "'https://keep.invalid/vendor/'")
    .replace("new URL('../../models/realm/western/', import.meta.url).href", "'https://keep.invalid/characters/'")
    .replace("import(V + 'GLTFLoader.js')", 'Promise.resolve(globalThis.__keepCharacterLoader)')
    .replace("import(V + 'SkeletonUtils.js')", 'Promise.resolve(globalThis.__keepCharacterClone)');
  const C = await import(uri(source));
  const close = (a, b) => assert(Math.abs(a - b) < .00001, `${a} != ${b}`);
  const jointOf = a => a.root.getObjectByName('joint');

  assert.equal(await C.load(T), false);
  assert.equal(requests, 0, 'unavailable feature never loads character assets');
  assert.equal(C.create('footman'), null);
  setAvailable(true);
  assert.equal(await C.load(T), true);
  assert.equal(requests, 3);
  assert.equal(await C.load(T), true); assert.equal(requests, 3, 'session reuses the loaded assets');
  const a = C.create('footman', {height: 1.15, phase: .5}), b = C.create('footman');
  assert.equal(a.durationOf('attack'), 1); assert.equal(a.durationOf('missing'), 1);
  const sharedParent = new T.Group(); sharedParent.add(b.root);
  for (const selected of ['evan', 'another-member', 'guest', null]) {
    setProfile(selected);
    assert.equal(C.ready('footman'), true, `characters available for ${selected}`);
    assert.equal(await C.load(T), true); assert.equal(requests, 3, 'profile changes reuse shared assets');
    assert.equal(b.root.parent, sharedParent, 'profile changes preserve existing actors');
    const shared = C.create('worker'); assert(shared); shared.dispose();
  }
  const meshes = [];
  for (const actor of [a, b]) actor.root.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  assert.equal(meshes[0].geometry, meshes[1].geometry, 'geometry is shared');
  assert.equal(meshes[0].material, meshes[1].material, 'material is shared');
  assert.notEqual(meshes[0].skeleton, meshes[1].skeleton, 'skeletons are independent');
  close(a.root.children[0].scale.y, 1.15 / 2);
  a.root.position.set(3, 0, 7); a.root.rotation.y = .8;
  a.pose('run', 10); a.pose('run', 10.25);
  close(jointOf(a).rotation.z, .75); close(jointOf(b).rotation.z, 0);
  assert.deepEqual(a.root.position.toArray(), [3, 0, 7]); close(a.root.rotation.y, .8);
  a.pose('death', 11, {event: 11});
  a.pose('death', 11.5, {event: 11}); close(jointOf(a).rotation.z, 1.5);
  a.pose('death', 13, {event: 11}); close(jointOf(a).rotation.z, 3);
  a.pose('death', 14, {event: 11}); close(jointOf(a).rotation.z, 3);
  a.pose('attack', 20.5, {event: 20}); close(jointOf(a).rotation.z, 1);
  a.pose('attack', 21, {event: 21}); close(jointOf(a).rotation.z, 0);
  a.pose('attack', 21.5, {event: 21}); close(jointOf(a).rotation.z, 1);
  a.pose('unknown', 30); a.pose('unknown', 30.5); assert.equal(a.state, 'idle');
  motion.matches = true;
  b.pose('work', 40); b.pose('work', 41); const frozen = jointOf(b).rotation.z;
  b.pose('work', 43); close(jointOf(b).rotation.z, frozen);
  motion.matches = false;
  let materialDisposals = 0; meshes[0].material.addEventListener('dispose', () => materialDisposals++);
  a.dispose(); a.dispose(); assert.equal(materialDisposals, 0, 'actor disposal preserves shared resources');
  assert.equal(a.pose('run', 50), false);
  const parent = new T.Group(); parent.add(b.root);
  setAvailable(false);
  assert.equal(b.root.parent, null); assert.equal(b.root.visible, false);
  assert.equal(C.ready('footman'), false); assert.equal(materialDisposals, 1);
  console.log('PASS: shared loading for owner/member/guest/unselected, independent skeletons, real clips, event time, death clamp, reduced motion, resource cleanup');

  setAvailable(true); delayed = true; const oldLoad = C.load(T);
  await new Promise(resolve => setImmediate(resolve));
  setAvailable(false); setAvailable(true); // Re-enabling before completion cannot admit the old request.
  delayed = false; release();
  assert.equal(await oldLoad, false); assert.equal(C.ready(), false);
  failed.add('archer');
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await C.load(T), true); } finally { console.warn = warn; }
  assert.equal(C.ready('footman'), true); assert.equal(C.ready('archer'), false);
  assert.equal(C.create('archer'), null, 'a failed asset leaves integration free to retain its sprite');
  const retained = C.create('footman'), beforeRetry = requests;
  const retainedMeshes = []; retained.root.traverse(o => { if (o.isMesh) retainedMeshes.push(o); });
  failed.delete('archer');
  const recovery = C.load(T), concurrentRecovery = C.load(T);
  assert.equal(recovery, concurrentRecovery, 'concurrent view loads share one retry');
  assert.equal(await recovery, true); assert.equal(C.ready('archer'), true);
  assert.equal(requests, beforeRetry + 1, 'recovery loads only the previously failed kind');
  const afterRecovery = C.create('footman'), recoveredMeshes = [];
  afterRecovery.root.traverse(o => { if (o.isMesh) recoveredMeshes.push(o); });
  assert.equal(retainedMeshes[0].geometry, recoveredMeshes[0].geometry, 'successful assets survive another kind retrying');
  assert.equal(retained.pose('walk', 5), true, 'active actors remain usable during recovery');
  retained.dispose(); afterRecovery.dispose();
  setAvailable(false);
  console.log('PASS: unavailable features revoke stale async completions; partial failure recovers on next view load without replacing successful assets');
})().catch(error => { console.error(error); process.exitCode = 1; });
