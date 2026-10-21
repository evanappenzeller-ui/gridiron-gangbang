// A Mixamo clip put into Return Man's player (models/return-player.glb, made by tools/return/player-model.mjs) as one
// of its clips (views/return-3d.js: idle, run, or one of MOVES), in place of the one there. The clip: an FBX from
// mixamo.com ("In Place"; any Mixamo character), or a clip in another glTF of a Mixamo rig (file.glb:clip).
// Retargeted, not copied: the two rigs stand differently at rest (the player's in an A-pose, Mixamo's clips' rigs in a
// T-pose; each bone turned its own way), so each bone gets the turn it makes in the world from its rest, put on the
// player's rest turned to point the way the clip's rig's bone does at rest; the hips' movement scaled to his height.
// Any forward travel left in it is taken out (he runs on the spot; the ground moves under him); the cycle can be turned
// round (SHIFT, of the cycle: where it starts, to keep the game's phase where the clip it replaces had it). Prints the
// yards one cycle covers, by how fast his planted foot goes back under him (views/return-3d.js STRIDE).
//   npm i three@0.160.0 @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4
//   node tools/return/mixamo-clip.mjs Fast_Run.fbx run models/return-player.glb .99
//   node tools/return/mixamo-clip.mjs xbot.glb:idle idle models/return-player.glb
import fs from 'fs';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {resample, prune} from '@gltf-transform/functions';
const [,, SRC, NAME, GLB, SHIFT = '0', FPS = '60'] = process.argv;
const bare = n => n.replace(/^mixamorig:?/, '');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const mat4 = n => new T.Matrix4().compose(new T.Vector3(...n.getTranslation()), new T.Quaternion(...n.getRotation()), new T.Vector3(...n.getScale()));
const worldOf = n => { const m = new T.Matrix4(); for (let x = n; x; x = x.getParentNode()) m.premultiply(mat4(x)); return m; };
const rotOf = m => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(m));

/** A rig: {bone: {parent (a bone's name, or null), q (its turn at rest, local), t (its place at rest, local)}}, the
 *  world over its hips (top: a matrix), and each bone's rest in the world (wq turn, wp place). */
function rig(bones, top) {
  const out = {bones, top, wq: {}, wp: {}, order: []};
  const walk = (k, m) => {
    out.order.push(k);
    const w = m.clone().multiply(new T.Matrix4().compose(bones[k].t, bones[k].q, bones[k].s || new T.Vector3(1, 1, 1)));
    out.wq[k] = rotOf(w); out.wp[k] = new T.Vector3().setFromMatrixPosition(w);
    Object.keys(bones).filter(c => bones[c].parent === k).forEach(c => walk(c, w));
  };
  walk('Hips', top);
  return out;
}
// the clip's rig and its keys
let src, dur, track = {};
if (/\.fbx$/i.test(SRC)) {
  const buf = fs.readFileSync(SRC), fbx = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  let skin = null;
  fbx.traverse(o => { if (o.isSkinnedMesh && !skin) skin = o.skeleton; }); // (its bones are the ones in their rest)
  const bones = {};
  skin.bones.forEach(b => { bones[bare(b.name)] = {parent: b.parent?.isBone ? bare(b.parent.name) : null, q: b.quaternion.clone(), t: b.position.clone()}; });
  const hips = skin.bones.find(b => bare(b.name) === 'Hips');
  hips.parent.updateMatrixWorld(true);
  src = rig(bones, hips.parent.matrixWorld.clone());
  const clip = fbx.animations.find(a => a.tracks.length);
  dur = clip.duration;
  clip.tracks.forEach(tr => { const [n, prop] = bare(tr.name).split('.'); track[n + '.' + prop] = tr.createInterpolant(); });
} else {
  const [file, clipName] = SRC.split(':'), sdoc = await io.read(file), r = sdoc.getRoot(), bones = {};
  const nodes = r.listNodes().filter(n => /^mixamorig/.test(n.getName()));
  nodes.forEach(n => { const p = n.getParentNode(); bones[bare(n.getName())] = {parent: p && /^mixamorig/.test(p.getName()) ? bare(p.getName()) : null, q: new T.Quaternion(...n.getRotation()), t: new T.Vector3(...n.getTranslation()), s: new T.Vector3(...n.getScale())}; });
  src = rig(bones, worldOf(nodes.find(n => bare(n.getName()) === 'Hips').getParentNode()));
  const anim = r.listAnimations().find(a => a.getName() === clipName);
  anim.listChannels().forEach(c => {
    const s = c.getSampler(), tm = Array.from(s.getInput().getArray()), path = c.getTargetPath();
    const Tr = path === 'rotation' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
    track[bare(c.getTargetNode().getName()) + '.' + (path === 'rotation' ? 'quaternion' : path === 'translation' ? 'position' : 'scale')] = new Tr('x', tm, Array.from(s.getOutput().getArray())).createInterpolant();
    dur = Math.max(dur || 0, tm[tm.length - 1]);
  });
}
// the player's rig
const doc = await io.read(GLB), root = doc.getRoot(), node = {};
root.listNodes().filter(n => /^mixamorig:/.test(n.getName())).forEach(n => { node[bare(n.getName())] = n; });
const tb = {};
Object.entries(node).forEach(([k, n]) => { const p = n.getParentNode(); tb[k] = {parent: p && /^mixamorig:/.test(p.getName()) ? bare(p.getName()) : null, q: new T.Quaternion(...n.getRotation()), t: new T.Vector3(...n.getTranslation()), s: new T.Vector3(...n.getScale())}; });
const top = worldOf(node.Hips.getParentNode());
const tgt = rig(tb, top);
// each of his bones at rest, turned to point the way the clip's rig's does (from it to its one child both rigs have;
// a bone with none, as its parent's turned; the hips as they are)
const turn = {}, G = {};
tgt.order.forEach(k => {
  const kids = Object.keys(tb).filter(c => tb[c].parent === k && src.bones[c]);
  const c = kids.length === 1 ? kids[0] : kids.find(x => x === 'Neck');
  turn[k] = k === 'Hips' || !src.bones[k] ? new T.Quaternion() : c
    ? new T.Quaternion().setFromUnitVectors(tgt.wp[c].clone().sub(tgt.wp[k]).normalize(), src.wp[c].clone().sub(src.wp[k]).normalize())
    : turn[tb[k].parent].clone();
  G[k] = turn[k].clone().multiply(tgt.wq[k]);
});
const height = (r, k) => r.wp[k].y - Math.min(...['LeftToeBase', 'RightToeBase'].map(t => r.wp[t].y));
const scale = height(tgt, 'Hips') / height(src, 'Hips'); // (his hips' height over the clip's rig's)
const srcTop = rotOf(src.top), tgtTop = rotOf(top), topInv = top.clone().invert();
const hipsAt = u => new T.Vector3().fromArray(track['Hips.position'] ? track['Hips.position'].evaluate(u * dur) : src.bones.Hips.t.toArray()).applyMatrix4(src.top);
const drift = hipsAt(1).sub(hipsAt(0)); drift.y = 0;
/** His pose u of the way round the cycle: {bone: local turn}, and the hips' place (local). */
function frame(u) {
  const ws = {}, wt = {}, q = {};
  tgt.order.forEach(k => {
    const s = src.bones[k];
    if (s) ws[k] = (s.parent ? ws[s.parent] : srcTop).clone().multiply(track[k + '.quaternion'] ? new T.Quaternion().fromArray(track[k + '.quaternion'].evaluate(u * dur)) : s.q);
    wt[k] = s ? ws[k].clone().multiply(src.wq[k].clone().invert()).multiply(G[k]) : (tb[k].parent ? wt[tb[k].parent] : tgtTop).clone().multiply(tb[k].q);
    q[k] = (tb[k].parent ? wt[tb[k].parent] : tgtTop).clone().invert().multiply(wt[k]);
  });
  const hp = hipsAt(u).sub(drift.clone().multiplyScalar(u)).sub(src.wp.Hips).multiplyScalar(scale).add(tgt.wp.Hips).applyMatrix4(topInv);
  return {q, hips: hp.toArray()};
}
// the clip, sampled round from SHIFT
const n = Math.round(dur * +FPS), times = new Float32Array(n + 1).map((_, i) => i / n * dur);
const frames = Array.from({length: n + 1}, (_, i) => frame((+SHIFT + i / n) % 1));
root.listAnimations().filter(a => a.getName() === NAME).forEach(a => a.dispose());
const anim = doc.createAnimation(NAME), buffer = root.listBuffers()[0];
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
tgt.order.filter(k => src.bones[k] && !/_End$|4$/.test(k)).forEach(k => channel(k, 'rotation', 4, f => f.q[k].toArray()));
channel('Hips', 'translation', 3, f => f.hips);
// the stride: his feet (metres), the lower one's speed back under him while it's down, over the cycle
const feet = frames.map(f => ['LeftToeBase', 'RightToeBase'].map(toe => {
  const chain = []; for (let k = toe; k; k = tb[k].parent) chain.unshift(k);
  const m = top.clone();
  chain.forEach(k => m.multiply(new T.Matrix4().compose(k === 'Hips' ? new T.Vector3().fromArray(f.hips) : tb[k].t, f.q[k], tb[k].s)));
  return new T.Vector3().setFromMatrixPosition(m);
}));
const floor = Math.min(...feet.flat().map(p => p.y)), up = .04 * (tgt.wp.Head.y - floor);
let back = 0, down = 0;
for (let i = 1; i <= n; i++) [0, 1].forEach(s => { if (feet[i][s].y < floor + up && feet[i - 1][s].y < floor + up) { back += feet[i - 1][s].z - feet[i][s].z; down += 1; } });
const travel = down ? back / down * n : 0;
await doc.transform(resample({tolerance: 1e-4}), prune());
await io.write(GLB, doc);
console.log(GLB, fs.statSync(GLB).size, 'bytes;', NAME, dur.toFixed(3), 's,', anim.listChannels().length, 'channels; travel', travel.toFixed(2), 'm a cycle =', (travel * 1.12).toFixed(2), 'yards (at SCALE 1.12)');
