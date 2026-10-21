// A Mixamo clip (an FBX downloaded from mixamo.com, "In Place", on the X Bot or Y Bot: the same bones as
// models/return-player.glb) put into Return Man's player as one of its clips (views/return-3d.js: idle, run, or one of
// MOVES), in place of the one there. Retargeted, not copied: the FBX's bones sit at other rest turns than the model's
// (a Y Bot's legs are turned half round), so each bone is given the turn it makes from its rest in the world, on the
// model's rest. Any forward travel left in it is taken out (he runs on the spot; the ground moves under him); the cycle
// is turned round to start where the clip it replaces did (the legs at the same point in the stride, so the game's phase
// still lines up); the tracks the game doesn't use are left out (as tools/return/player-model.mjs does). Prints the
// yards one cycle covers, by how fast his planted foot goes back under him (views/return-3d.js STRIDE, at SCALE 1.12).
//   npm i three@0.160.0 @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4
//   node tools/return/mixamo-clip.mjs Fast_Run.fbx run models/return-player.glb
import fs from 'fs';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {resample, prune} from '@gltf-transform/functions';
const [,, FBX, NAME, GLB, FPS = '60'] = process.argv;
const bare = n => n.replace(/^mixamorig:?/, '');
const buf = fs.readFileSync(FBX);
const fbx = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const clip = fbx.animations.find(a => a.tracks.length), dur = clip.duration;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(GLB);
const root = doc.getRoot();
// the two skeletons, bone by bone from the hips down (parents first): each one's parent, rest turn and place
const fb = {};
let skin = null;
fbx.traverse(o => { if (o.isSkinnedMesh && !skin) skin = o.skeleton; }); // (its bones are the ones in their rest)
skin.bones.forEach(b => { fb[bare(b.name)] = b; });
const node = {};
root.listNodes().forEach(n => { node[bare(n.getName())] = n; });
const order = [];
(function walk(n) { const k = bare(n.getName()); if (fb[k]) order.push(k); n.listChildren().forEach(walk); })(node.Hips);
const parent = {};
order.forEach(k => { const p = node[k].getParentNode(); parent[k] = p && fb[bare(p.getName())] ? bare(p.getName()) : null; });
const restF = {}, restG = {}, worldF = {}, worldG = {};
order.forEach(k => {
  restF[k] = fb[k].quaternion.clone();
  restG[k] = new T.Quaternion().fromArray(node[k].getRotation());
  worldF[k] = parent[k] ? worldF[parent[k]].clone().multiply(restF[k]) : restF[k].clone();
  worldG[k] = parent[k] ? worldG[parent[k]].clone().multiply(restG[k]) : restG[k].clone();
});
const track = {};
clip.tracks.forEach(tr => { const [n, prop] = bare(tr.name).split('.'); track[n + '.' + prop] = tr.createInterpolant(); });
const scale = node.Hips.getTranslation()[1] / fb.Hips.position.y; // (his hips' height, the model's over the FBX's)
const h0 = track['Hips.position'].evaluate(0).slice(), drift = track['Hips.position'].evaluate(dur).map((v, i) => v - h0[i]);
/** The model's pose u of the way round the cycle: {bone: local turn}, and the hips' place. */
function frame(u) {
  const wf = {}, wt = {}, out = {};
  order.forEach(k => {
    const lf = track[k + '.quaternion'] ? new T.Quaternion().fromArray(track[k + '.quaternion'].evaluate(u * dur)) : restF[k];
    wf[k] = parent[k] ? wf[parent[k]].clone().multiply(lf) : lf.clone();
    wt[k] = wf[k].clone().multiply(worldF[k].clone().invert()).multiply(worldG[k]); // (the turn from rest, on the model's rest)
    out[k] = parent[k] ? wt[parent[k]].clone().invert().multiply(wt[k]) : wt[k].clone();
  });
  const h = Array.from(track['Hips.position'].evaluate(u * dur), (v, i) => (v - drift[i] * u) * scale);
  return {q: out, hips: h};
}
const SKIP = /Eye|_End|Thumb4|Index4|Middle4|Ring4|Pinky4/;
const keep = order.filter(k => !SKIP.test(k));
// where the old clip's stride is: the legs' turn, compared round the cycle
const old = root.listAnimations().find(a => a.getName() === NAME);
let shift = 0;
if (old) {
  const LEGS = ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'];
  const oq = LEGS.map(n => {
    const s = old.listChannels().find(c => c.getTargetNode() === node[n] && c.getTargetPath() === 'rotation').getSampler();
    const tm = s.getInput().getArray();
    return {f: new T.QuaternionKeyframeTrack('x.quaternion', Array.from(tm), Array.from(s.getOutput().getArray())).createInterpolant(), d: tm[tm.length - 1]};
  });
  const nf = Array.from({length: 200}, (_, k) => frame(k / 200).q), qa = new T.Quaternion();
  let best = Infinity;
  for (let k = 0; k < 200; k++) {
    let e = 0;
    for (let j = 0; j < 40; j++) LEGS.forEach((n, i) => { qa.fromArray(oq[i].f.evaluate(j / 40 * oq[i].d)); e += qa.angleTo(nf[(k + j * 5) % 200][n]) ** 2; });
    if (e < best) { best = e; shift = k / 200; }
  }
  old.dispose();
}
// the clip, sampled round from there
const n = Math.round(dur * +FPS), times = new Float32Array(n + 1).map((_, i) => i / n * dur);
const frames = Array.from({length: n + 1}, (_, i) => frame((shift + i / n) % 1));
const anim = doc.createAnimation(NAME);
const buffer = root.listBuffers()[0];
const channel = (k, path, size, get) => {
  const out = new Float32Array((n + 1) * size);
  frames.forEach((f, i) => {
    out.set(get(f), i * size);
    if (size === 4 && i) { // (each key on the same side as the last, so nothing turns the long way round)
      let d = 0; for (let c = 0; c < 4; c++) d += out[i * 4 + c] * out[(i - 1) * 4 + c];
      if (d < 0) for (let c = 0; c < 4; c++) out[i * 4 + c] *= -1;
    }
  });
  const s = doc.createAnimationSampler().setInterpolation('LINEAR')
    .setInput(doc.createAccessor().setType('SCALAR').setArray(times.slice()).setBuffer(buffer))
    .setOutput(doc.createAccessor().setType(size === 4 ? 'VEC4' : 'VEC3').setArray(out).setBuffer(buffer));
  anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node[k]).setTargetPath(path).setSampler(s));
};
keep.forEach(k => channel(k, 'rotation', 4, f => f.q[k].toArray()));
channel('Hips', 'translation', 3, f => f.hips);
// the stride: his feet in the model (metres), the lower one's speed back under him while it's down, over the cycle
const feet = frames.map(f => ['LeftToeBase', 'RightToeBase'].map(toe => {
  const chain = []; for (let k = toe; k; k = parent[k]) chain.unshift(k);
  const m = new T.Matrix4();
  chain.forEach(k => m.multiply(new T.Matrix4().compose(new T.Vector3().fromArray(k === 'Hips' ? f.hips : node[k].getTranslation()), f.q[k], new T.Vector3(1, 1, 1))));
  return new T.Vector3().setFromMatrixPosition(m).multiplyScalar(.01);
}));
const floor = Math.min(...feet.flat().map(p => p.y));
let back = 0, down = 0;
for (let i = 1; i <= n; i++) [0, 1].forEach(s => { if (feet[i][s].y < floor + .04 && feet[i - 1][s].y < floor + .04) { back += feet[i - 1][s].z - feet[i][s].z; down += 1; } });
const travel = down ? back / down * n + Math.hypot(drift[0], drift[2]) / 100 : 0;
await doc.transform(resample({tolerance: 1e-4}), prune());
await io.write(GLB, doc);
console.log(GLB, fs.statSync(GLB).size, 'bytes;', NAME, dur.toFixed(3), 's,', anim.listChannels().length, 'channels; turned round', shift.toFixed(3),
  'of the cycle; travel', travel.toFixed(2), 'm a cycle =', (travel * 1.12).toFixed(2), 'yards');
