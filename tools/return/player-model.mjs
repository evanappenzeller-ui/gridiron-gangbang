// Return Man's player (models/return-player.glb, views/return-3d.js) from Xbot.glb (the three.js examples'
// examples/models/gltf/Xbot.glb, a Mixamo character): the idle and run clips (rotations, and the hips' translation),
// and the moves' if it has them (views/return-3d.js MOVES: jump, slide, sideL, sideR, fall; Mixamo clips on the same
// skeleton, renamed to those; without them the game keys its own), the mesh welded, simplified (to ratio of its
// triangles) and quantized.
//   npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer
//   node tools/return/player-model.mjs Xbot.glb models/return-player.glb .4
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, weld, simplify, quantize, resample} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
const [,, IN, OUT, RATIO = '.5'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN);
const root = doc.getRoot();
for (const a of root.listAnimations()) {
  if (!['idle', 'run', 'jump', 'slide', 'sideL', 'sideR', 'fall'].includes(a.getName())) { a.dispose(); continue; }
  for (const c of a.listChannels()) {
    const n = c.getTargetNode().getName(), p = c.getTargetPath();
    if (p === 'scale' || (p === 'translation' && n !== 'mixamorig:Hips') || /Eye|_End|Thumb4|Index4|Middle4|Ring4|Pinky4/.test(n)) { const s = c.getSampler(); c.dispose(); s.dispose(); }
  }
}
await MeshoptSimplifier.ready;
await doc.transform(
  resample({tolerance: 1e-4}),
  weld(),
  simplify({simplifier: MeshoptSimplifier, ratio: +RATIO, error: 0.002}),
  dedup(),
  prune(),
  quantize({quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12})
);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices() ? p.getIndices().getCount() / 3 : 0;
await io.write(OUT, doc);
const fs = await import('fs');
console.log(OUT, fs.statSync(OUT).size, 'bytes; tris', tris, 'anims', root.listAnimations().map(a => a.getName() + ':' + a.listChannels().length));
