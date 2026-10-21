// Return Man's player (models/return-player.glb, views/return-3d.js) from "American Football Player" by blakeallen25
// (https://sketchfab.com/3d-models/american-football-player-10bf41a1c05a4c9cb74676b7dd8cb18e, CC-BY-4.0; Sketchfab's
// glTF download, Mixamo-rigged): his bones named as the game knows them (mixamorig:Hips...; the rig's extra bones
// xtra_...), set at his bind pose; the helmet (the shell, the face mask, its pads and straps, the visor: loose in the
// download, kept on by keys) hung on his head; stood on the ground at 1.88 m with the helmet on; his own clip dropped
// (tools/return/mixamo-clip.mjs puts the game's in); each mesh simplified to its share of ~38,000 triangles (the
// helmet's shell made again: wrap()), the textures shrunk, and quantized.
//   npm i three@0.160.0 @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
//   node tools/return/player-model.mjs american_football_player.glb models/return-player.glb
//   node tools/return/mixamo-clip.mjs Fast_Run.fbx run models/return-player.glb .99
//   node tools/return/mixamo-clip.mjs xbot.glb:idle idle models/return-player.glb
// (xbot.glb: the X Bot model this one replaced, with its idle: git show 1736347:models/return-player.glb)
import * as T from 'three';
import sharp from 'sharp';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, weld, quantize, simplifyPrimitive, joinPrimitives} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
const [,, IN, OUT] = process.argv;
const HEIGHT = 1.88;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN);
const root = doc.getRoot(), scene = root.listScenes()[0];
root.listAnimations().forEach(a => a.dispose());
const mat4 = n => new T.Matrix4().compose(new T.Vector3(...n.getTranslation()), new T.Quaternion(...n.getRotation()), new T.Vector3(...n.getScale()));
const world = n => { const m = new T.Matrix4(); for (let x = n; x; x = x.getParentNode()) m.premultiply(mat4(x)); return m; };
/** Smooth normals for an indexed primitive (each vertex's: the faces round it, by their area). */
function normals(p) {
  const pos = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray(), n = new Float32Array(pos.length);
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    const [i0, i1, i2] = [idx[i], idx[i + 1], idx[i + 2]];
    a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3).sub(a); c.fromArray(pos, i2 * 3).sub(a); b.cross(c);
    for (const j of [i0, i1, i2]) { n[j * 3] += b.x; n[j * 3 + 1] += b.y; n[j * 3 + 2] += b.z; }
  }
  for (let j = 0; j < n.length; j += 3) { a.fromArray(n, j).normalize().toArray(n, j); }
  return doc.createAccessor().setType('VEC3').setArray(n).setBuffer(root.listBuffers()[0]);
}
/** The helmet's shell (two skins, out and in, one on the other, in many small patches: nothing simplifies it cleanly)
 *  made again: a sphere's grid shrunk onto it from its middle, each point where a ray out from there last leaves it;
 *  where a ray finds none (the face) the grid's left open. */
function wrap(p) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(p.getAttribute('POSITION').getArray()), 3));
  g.setIndex(new T.BufferAttribute(new Uint32Array(p.getIndices().getArray()), 1));
  g.computeBoundingBox();
  const mesh = new T.Mesh(g, new T.MeshBasicMaterial({side: T.DoubleSide})), mid = g.boundingBox.getCenter(new T.Vector3()), ray = new T.Raycaster();
  const W = 72, H = 40, pos = [], hit = [];
  for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) {
    const th = Math.PI * j / H, ph = 2 * Math.PI * i / W, d = new T.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
    ray.set(mid, d);
    const all = ray.intersectObject(mesh), far = all[all.length - 1];
    pos.push(...(far ? far.point.toArray() : mid.toArray())); hit.push(!!far);
  }
  const idx = [], at = (i, j) => j * (W + 1) + i;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
    if (hit[a] && hit[b] && hit[c]) idx.push(a, b, c);
    if (hit[a] && hit[c] && hit[d]) idx.push(a, c, d);
  }
  p.getAttribute('POSITION').setArray(new Float32Array(pos));
  p.getIndices().setArray(new Uint32Array(idx));
}
const set = (n, m) => { const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); m.decompose(p, q, s); n.setTranslation(p.toArray()).setRotation(q.toArray()).setScale(s.toArray()); };

// the bones: named, and set at the pose the skin was bound in (three's way: the mesh's world, then each bone's)
const skin = root.listSkins()[0], joints = skin.listJoints(), ibm = skin.getInverseBindMatrices().getArray();
const skinned = root.listNodes().find(n => n.getSkin() === skin), M = world(skinned);
const head = joints.find(j => /^mixamorig_Head_\d+$/.test(j.getName()));
const helmet = root.listNodes().find(n => n.getName() === 'Null_1');
const helmetOn = new T.Matrix4().copy(world(head)).invert().multiply(world(helmet)); // (where it sits on his head, as it stands)
const bind = new Map(joints.map((j, i) => [j, M.clone().multiply(new T.Matrix4().fromArray(ibm.slice(i * 16, i * 16 + 16)).invert())]));
const depth = n => { let d = 0; for (let x = n; x; x = x.getParentNode()) d++; return d; };
// (the tips, which nothing's bound to, have no bind of their own to go by: each kept where it was on its bone)
const tip = j => /(_End|4)_\d+$/.test(j.getName()), was = new Map(joints.filter(tip).map(j => [j, mat4(j)]));
[...joints].sort((a, b) => depth(a) - depth(b)).forEach(j => {
  const p = j.getParentNode();
  if (tip(j)) { set(j, was.get(j)); bind.set(j, bind.get(p).clone().multiply(was.get(j))); return; }
  set(j, (bind.has(p) ? bind.get(p).clone() : world(p)).invert().multiply(bind.get(j)));
});
joints.forEach(j => {
  const n = j.getName(), x = n.match(/^mixamorig_(.+?)_(\d+)_(\d+)$/), m = n.match(/^mixamorig_(.+?)_(\d+)$/);
  if (x) j.setName(`xtra_${x[1]}_${x[3]}`); else if (m) j.setName('mixamorig:' + m[1]);
});
helmet.getParentNode().removeChild(helmet);
head.addChild(helmet);
set(helmet, helmetOn);
helmet.setName('helmet');

// stood on the ground, HEIGHT tall, his hips over the middle
const box = new T.Box3(), v = new T.Vector3();
for (const n of root.listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const m = n.getSkin() ? M : world(n);
  for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i += 3) box.expandByPoint(v.fromArray(a.getElement(i, [])).applyMatrix4(m)); }
}
const k = HEIGHT / (box.max.y - box.min.y), hips = new T.Vector3().setFromMatrixPosition(bind.get(joints.find(j => j.getName() === 'mixamorig:Hips')));
const player = doc.createNode('player').setScale([k, k, k]).setTranslation([-hips.x * k, -box.min.y * k, -hips.z * k]);
scene.listChildren().forEach(n => { scene.removeChild(n); player.addChild(n); });
scene.addChild(player);

// the materials: his skin opaque (it has no see-through bits), the clearcoat only on the helmet's shell
for (const m of root.listMaterials()) {
  if (m.getAlphaMode() === 'BLEND') m.setAlphaMode('OPAQUE');
  if (m.getName() !== 'Mat.3') m.setExtension('KHR_materials_clearcoat', null);
}
// each mesh to its share of triangles; what nothing draws with (tangents, the extra UV sets) left out
const SHARE = [[/^shoes/, 2500], [/pants/, 3500], [/^Body_2_Bodymat/, 6000], [/^shirt/, 6000], [/^helmet/, 3000], [/Plastic Matte_0/, 2500], [/^covers/, 900]];
// (the helmet's parts and the cleats come as loose triangles, each with its own normals: welded without them, and
// smoothed after)
await MeshoptSimplifier.ready;
const loose = new Set();
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const m = p.getMaterial(), textured = m && (m.getBaseColorTexture() || m.getNormalTexture() || m.getMetallicRoughnessTexture());
  p.listSemantics().filter(s => s === 'TANGENT' || /^TEXCOORD_[1-9]/.test(s) || (s === 'TEXCOORD_0' && !textured)).forEach(s => p.setAttribute(s, null));
  if (p.getAttribute('POSITION').getCount() > p.getIndices().getCount() / 3) { p.setAttribute('NORMAL', null); loose.add(p); }
}
// (the helmet's shell comes in three pieces, the most vertices a piece could hold once: one again)
const shells = root.listNodes().filter(n => /^helmet_1/.test(n.getMesh()?.getName() || ''));
shells.forEach(n => n.getMesh().listPrimitives().forEach(p => { p.setAttribute('NORMAL', null); p.getIndices().setArray(new Uint32Array(p.getIndices().getArray())); }));
const shell = joinPrimitives(shells.flatMap(n => n.getMesh().listPrimitives()));
shells.slice(1).forEach(n => n.dispose());
shells[0].setMesh(doc.createMesh('helmet_shell').addPrimitive(shell));
loose.add(shell);
wrap(shell);
await doc.transform(weld());
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const share = SHARE.find(([re]) => re.test(mesh.getName())), tris = p.getIndices().getCount() / 3;
  if (share && tris > share[1]) simplifyPrimitive(p, {simplifier: MeshoptSimplifier, ratio: share[1] / tris, error: .2, lockBorder: false});
  if (loose.has(p)) p.setAttribute('NORMAL', normals(p));
}
// the textures: the jersey, the pants and his face kept sharp; the rest smaller
const SIZE = {'shirt_0:base': 1024, 'pants:base': 1024, 'Bodymat:base': 1024, 'sepatu_key.obj:base': 512, 'Bodymat:normal': 512, 'shirt_0:normal': 512};
for (const t of root.listTextures()) {
  const m = t.listParents().find(p => p.propertyType === 'Material');
  const slot = m.getBaseColorTexture() === t ? 'base' : m.getNormalTexture() === t ? 'normal' : 'mr';
  const w = SIZE[m.getName() + ':' + slot] || 256, img = sharp(Buffer.from(t.getImage())), {width, height} = await img.metadata();
  const s = Math.min(1, w / width), out = img.resize(Math.round(width * s), Math.round(height * s));
  t.setImage(new Uint8Array(await out.jpeg({quality: slot === 'base' ? 86 : 80}).toBuffer())).setMimeType('image/jpeg');
}
await doc.transform(dedup(), prune(), quantize({quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12}), prune());
root.getAsset().extras = {...root.getAsset().extras, made: 'tools/return/player-model.mjs'};
await io.write(OUT, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
const fs = await import('fs');
console.log(OUT, fs.statSync(OUT).size, 'bytes; tris', tris, '; scale', k.toFixed(4));
