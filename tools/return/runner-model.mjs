// Return Man's player (models/return-runner-v1.glb, views/return-3d.js) from KayKit's Adventurers 2.0 (Kay Lousberg,
// CC0, https://kaylousberg.itch.io/kaykit-adventurers; Evan, Nov 4 2026: a cartoony runner, Subway Surfers' style):
// the Barbarian's body (the broadest of the five: a football player's shoulders) with two heads on the one rig, the
// Knight's (the returner: young, clean-shaven) and the Barbarian's own (the linebacker: bald and bearded); the view shows
// one (dress()). The bear hat and every prop are left out.
//  - The rig: KayKit's Rig_Medium, its bones named as the game knows them (mixamorig:Hips... : the clips from Evan's
//    Endless Runner pack go in by tools/return/runner-anims.mjs, and views/return-3d.js aims bones by those names), with a
//    Spine1 (halfway up the spine) and a Neck (most of the way from the chest to the head) put in: they carry no skin of
//    their own, but the game turns them (trunk(), the clips).
//  - Its colours: KayKit paints every face from a 1024² atlas of vertical gradient swatches; here each face is moved to a
//    swatch of a small atlas of its own (16 swatches, 256 x 64): the heads' and the skin's are copied as they were, and the
//    kit's (jersey, shoulder pads, belt, pants, socks, cleats, gloves, wristbands) are swatches of their own that the view
//    repaints in each side's colours (material extras: kit, the swatch of each). Which part of the kit a face is: by the
//    mesh it's on and where it is on him (heights for the body and legs, along the arm for the arms; the numbers below).
//  - Scaled so his head's top is HEAD m up (with the helmet the view gives him, about the old player's 1.88 m).
//   node tools/return/runner-model.mjs "<KayKit_Adventurers_2.0_FREE>/Characters/gltf" models/return-runner-v1.glb
//   node tools/return/runner-anims.mjs "<Endless Runner Animations>/fbx" models/return-runner-v1.glb
import fs from 'node:fs';
import {deflateSync} from 'node:zlib';
import * as T from '../../js/vendor/three/three.module.min.js';
import {image} from './unity-assets.mjs';
const [,, DIR, OUT] = process.argv;
const HEAD = 1.8;
const NAMES = {hips: 'Hips', spine: 'Spine', chest: 'Spine2', head: 'Head', 'upperarm.l': 'LeftArm', 'lowerarm.l': 'LeftForeArm', 'wrist.l': 'LeftHand',
  'upperarm.r': 'RightArm', 'lowerarm.r': 'RightForeArm', 'wrist.r': 'RightHand', 'upperleg.l': 'LeftUpLeg', 'lowerleg.l': 'LeftLeg', 'foot.l': 'LeftFoot',
  'toes.l': 'LeftToeBase', 'upperleg.r': 'RightUpLeg', 'lowerleg.r': 'RightLeg', 'foot.r': 'RightFoot', 'toes.r': 'RightToeBase'};
const boneName = n => (NAMES[n] ? 'mixamorig:' + NAMES[n] : n.replace('.', '_'));
// the kit's swatches (0-7) and their colours as the file has them (the returner's navy 22: views/return-3d.js KITS)
const KIT = ['jersey', 'pads', 'belt', 'pants', 'socks', 'cleats', 'gloves', 'bands'];
const KIT_COL = [0x173b6c, 0x1d4782, 0x102744, 0xdce2dc, 0x173b6c, 0x102744, 0xf0f2e8, 0xf0f2e8];
const SLOTS = 16, AW = 256, AH = 64;

// ---------------------------------------------------------------------------- reading
function read(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jl));
  const bin = b.subarray(28 + jl, 28 + jl + b.readUInt32LE(20 + jl));
  const acc = i => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}[a.type];
    const C = {5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array}[a.componentType];
    if (v.byteStride && v.byteStride !== n * C.BYTES_PER_ELEMENT) throw new Error(file + ': interleaved data');
    const off = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
    return new C(bin.buffer.slice(off, off + a.count * n * C.BYTES_PER_ELEMENT));
  };
  return {json, acc, name: file};
}
const barb = read(`${DIR}/Barbarian.glb`), knight = read(`${DIR}/Knight.glb`);
const TEX = {Barbarian: image(`${DIR}/barbarian_texture.png`), Knight: image(`${DIR}/knight_texture.png`)};

// ---------------------------------------------------------------------------- the rig
// Barbarian's bones (the Knight's are the same: checked below), renamed, with Spine1 and Neck put in
const J = barb.json, rootIdx = J.nodes.findIndex(n => n.name === 'root');
const bones = []; // {name, t, r, s, children (indices into bones), src (KayKit name)}
const byKay = {};
(function walk(i, parent) {
  const n = J.nodes[i], b = {name: boneName(n.name), src: n.name, t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1], children: [], parent};
  const at = bones.length; bones.push(b); byKay[n.name] = at;
  if (parent != null) bones[parent].children.push(at);
  (n.children || []).forEach(c => walk(c, at));
})(rootIdx, null);
function insert(above, below, name, frac) { // a bone between `above` and its child `below`, frac of the way to it
  const a = byKay[above], c = byKay[below], cb = bones[c];
  const t = cb.t.map(v => v * frac), rest = cb.t.map((v, k) => v - t[k]);
  const at = bones.length;
  bones.push({name, src: name, t, r: [0, 0, 0, 1], s: [1, 1, 1], children: [c], parent: a});
  bones[a].children = bones[a].children.map(x => (x === c ? at : x));
  cb.parent = at; cb.t = rest;
  if (Math.abs(bones[a].r[3]) < .9999) throw new Error(above + ' is turned: the inserted bone would be off its line');
}
insert('spine', 'chest', 'mixamorig:Spine1', .5);
insert('chest', 'head', 'mixamorig:Neck', .6);
// each bone's place in the rig's frame, at rest
const world = [];
const local = b => new T.Matrix4().compose(new T.Vector3(...b.t), new T.Quaternion(...b.r), new T.Vector3(...b.s));
(function walk(i, m) { world[i] = m.clone().multiply(local(bones[i])); bones[i].children.forEach(c => walk(c, world[i])); })(0, new T.Matrix4());
// the Knight's rig must be Barbarian's (the head goes on Barbarian's bones as it is)
knight.json.nodes.forEach(n => {
  const i = byKay[n.name];
  if (i == null || !['upperarm.l', 'head', 'hips', 'toes.r'].includes(n.name)) return;
  const d = Math.max(...(n.translation || [0, 0, 0]).map((v, k) => Math.abs(v - J.nodes.find(x => x.name === n.name).translation[k])));
  if (d > 1e-6) throw new Error('The Knight\'s rig differs at ' + n.name);
});
// the skin: every bone but root (KayKit's order of them doesn't matter: the meshes' joints are mapped by name)
const joints = bones.map((_, i) => i).filter(i => bones[i].src !== 'root');
const jointOf = name => joints.findIndex(i => bones[i].src === name);

// ---------------------------------------------------------------------------- the atlas
// a source swatch: KayKit's atlas is 8 x 4 swatches, the second row's first split in two halves
function swatchOf(u, v) {
  const c = Math.min(7, Math.floor(u * 8)), r = Math.min(3, Math.floor(v * 4));
  if (r === 1 && c === 0) return v < .375 ? {key: 'c0r1a', v0: .25, v1: .375} : {key: 'c0r1b', v0: .375, v1: .5};
  return {key: `c${c}r${r}`, c, v0: r / 4, v1: (r + 1) / 4};
}
const atlas = new Uint8Array(AW * AH * 4), slotOf = new Map(); // 'tex|swatch' -> slot
const sw = AW / SLOTS;
const shade = (col, f) => { const k = f < .5 ? 1.12 - f * .24 : 1 - (f - .5) * .7; return [col >> 16 & 255, col >> 8 & 255, col & 255].map(x => Math.round(Math.min(255, x * k))); };
KIT.forEach((_, s) => { for (let y = 0; y < AH; y++) { const c = shade(KIT_COL[s], (y + .5) / AH); for (let x = s * sw; x < (s + 1) * sw; x++) atlas.set([...c, 255], (y * AW + x) * 4); } });
function copied(tex, key, u, v0, v1) { // a source swatch's gradient into a slot of its own
  const id = tex + '|' + key;
  if (slotOf.has(id)) return slotOf.get(id);
  const s = KIT.length + new Set([...slotOf.values()]).size;
  if (s >= SLOTS) throw new Error('Out of swatches');
  const img = TEX[tex], cx = Math.floor((Math.floor(u * 8) + .5) / 8 * img.w);
  for (let y = 0; y < AH; y++) {
    const sy = Math.min(img.h - 1, Math.floor((v0 + (v1 - v0) * (y + .5) / AH) * img.h)), o = (sy * img.w + cx) * 4;
    for (let x = s * sw; x < (s + 1) * sw; x++) atlas.set(img.data.subarray(o, o + 4), (y * AW + x) * 4);
  }
  slotOf.set(id, s);
  return s;
}

// ---------------------------------------------------------------------------- the meshes
// (the numbers: heights in KayKit's metres, at rest; along the arm: 0 its shoulder, 1 its wrist)
const SKIN = new Set(['c0r0']);
function role(part, key, p, along) {
  if (part === 'Body') {
    if (p[1] >= 1.16 && key === 'c7r0') return 'drop'; // (the pelt over his shoulders: the view gives him pads)
    if (p[1] >= .66) return 'jersey';
    if (p[1] >= .5 && ['c6r0', 'c2r1', 'c3r0'].includes(key)) return 'belt';
    return 'pants';
  }
  if (part.startsWith('Arm')) {
    if (along < .45) return 'jersey'; // (his sleeve)
    if (along > .98) return 'gloves';
    if (SKIN.has(key)) return null;
    return 'bands'; // (his bracers and wraps)
  }
  if (part.startsWith('Leg')) return p[1] > .3 ? 'pants' : p[1] > .17 ? 'socks' : 'cleats';
  return null;
}
const PARTS = [['Body', barb, 'Barbarian_Body'], ['ArmLeft', barb, 'Barbarian_ArmLeft'], ['ArmRight', barb, 'Barbarian_ArmRight'],
  ['LegLeft', barb, 'Barbarian_LegLeft'], ['LegRight', barb, 'Barbarian_LegRight'],
  ['HeadReturner', knight, 'Knight_Head'], ['HeadLinebacker', barb, 'Barbarian_Head']];
const shoulder = {l: new T.Vector3().setFromMatrixPosition(world[byKay['upperarm.l']]), r: new T.Vector3().setFromMatrixPosition(world[byKay['upperarm.r']])};
const wrist = {l: new T.Vector3().setFromMatrixPosition(world[byKay['wrist.l']]), r: new T.Vector3().setFromMatrixPosition(world[byKay['wrist.r']])};
const meshes = [], counts = {};
let headTop = 0;
for (const [part, g, name] of PARTS) {
  const m = g.json.meshes.find(x => x.name === name), p = m.primitives[0], tex = g === knight ? 'Knight' : 'Barbarian';
  const pos = g.acc(p.attributes.POSITION), nor = g.acc(p.attributes.NORMAL), uv = g.acc(p.attributes.TEXCOORD_0);
  const jn = g.acc(p.attributes.JOINTS_0), wt = g.acc(p.attributes.WEIGHTS_0), ix = g.acc(p.indices);
  const srcJoints = g.json.skins[0].joints.map(i => g.json.nodes[i].name);
  const side = part.endsWith('Left') ? 'l' : 'r';
  // each face's swatch (by its middle), its role, its slot; the face's vertices given their own copy if a vertex they
  // share with another face goes elsewhere
  const out = {pos: [], nor: [], uv: [], jn: [], wt: [], ix: []}, made = new Map();
  for (let f = 0; f < ix.length / 3; f++) {
    const vs = [ix[f * 3], ix[f * 3 + 1], ix[f * 3 + 2]];
    let u = 0, v = 0; const c = new T.Vector3();
    vs.forEach(i => { u += uv[i * 2] / 3; v += uv[i * 2 + 1] / 3; c.x += pos[i * 3] / 3; c.y += pos[i * 3 + 1] / 3; c.z += pos[i * 3 + 2] / 3; });
    const s = swatchOf(u, v);
    let along = 0;
    if (part.startsWith('Arm')) { const a = wrist[side].clone().sub(shoulder[side]); along = c.clone().sub(shoulder[side]).dot(a) / a.lengthSq(); }
    const r = role(part, s.key, c.toArray(), along);
    if (r === 'drop') { counts[part + ':dropped'] = (counts[part + ':dropped'] || 0) + 1; continue; }
    const slot = r ? KIT.indexOf(r) : copied(tex, s.key, u, s.v0, s.v1);
    counts[part + ':' + (r || s.key)] = (counts[part + ':' + (r || s.key)] || 0) + 1;
    vs.forEach(i => {
      const k = i + '|' + slot;
      if (!made.has(k)) {
        made.set(k, out.pos.length / 3);
        out.pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); out.nor.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
        const fv = Math.max(.01, Math.min(.99, (uv[i * 2 + 1] - s.v0) / (s.v1 - s.v0)));
        out.uv.push((slot + .5) / SLOTS, fv);
        for (let q = 0; q < 4; q++) { out.jn.push(wt[i * 4 + q] > 0 ? jointOf(srcJoints[jn[i * 4 + q]]) : 0); out.wt.push(wt[i * 4 + q]); }
        if (part.startsWith('Head')) headTop = Math.max(headTop, pos[i * 3 + 1]);
      }
      out.ix.push(made.get(k));
    });
  }
  if (out.jn.some(x => x < 0)) throw new Error(part + ': a joint the rig lacks');
  meshes.push({part, ...out});
}
console.table(Object.entries(counts).map(([k, n]) => ({part: k, faces: n})));

// ---------------------------------------------------------------------------- writing
const SCALE = HEAD / headTop;
const chunks = [], json = {asset: {version: '2.0', generator: 'tools/return/runner-model.mjs'}, scene: 0, scenes: [{nodes: [0]}], nodes: [], meshes: [],
  accessors: [], bufferViews: [], buffers: [], materials: [], textures: [{source: 0, sampler: 0}], images: [{bufferView: 0, mimeType: 'image/png'}],
  samplers: [{magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071}], skins: []};
let size = 0;
function view(buf, target) {
  const pad = (4 - (size % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); size += pad; }
  json.bufferViews.push({buffer: 0, byteOffset: size, byteLength: buf.length, ...(target ? {target} : {})});
  chunks.push(buf); size += buf.length;
  return json.bufferViews.length - 1;
}
function accessor(arr, type, ctype, target, minmax = false) {
  const n = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}[type];
  const a = {bufferView: view(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), target), componentType: ctype, count: arr.length / n, type};
  if (minmax) { a.min = []; a.max = []; for (let c = 0; c < n; c++) { let lo = Infinity, hi = -Infinity; for (let i = c; i < arr.length; i += n) { lo = Math.min(lo, arr[i]); hi = Math.max(hi, arr[i]); } a.min.push(lo); a.max.push(hi); } }
  json.accessors.push(a);
  return json.accessors.length - 1;
}
// the atlas, as a PNG
function pngOf(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const crcT = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}
view(pngOf(AW, AH, atlas));
json.materials.push({name: 'runner-kit', doubleSided: true, pbrMetallicRoughness: {baseColorTexture: {index: 0}, metallicFactor: 0, roughnessFactor: .62},
  extras: {kit: Object.fromEntries(KIT.map((k, i) => [k, i])), slots: SLOTS}});
// nodes: 0 the player (scaled), its meshes, then the bones
json.nodes.push({name: 'Runner', scale: [SCALE, SCALE, SCALE], children: []});
const boneNode = i => 1 + meshes.length + i;
meshes.forEach((m, k) => {
  const prim = {attributes: {
    POSITION: accessor(new Float32Array(m.pos), 'VEC3', 5126, 34962, true), NORMAL: accessor(new Float32Array(m.nor), 'VEC3', 5126, 34962),
    TEXCOORD_0: accessor(new Float32Array(m.uv), 'VEC2', 5126, 34962), JOINTS_0: accessor(new Uint8Array(m.jn), 'VEC4', 5121, 34962),
    WEIGHTS_0: accessor(new Float32Array(m.wt), 'VEC4', 5126, 34962)}, indices: accessor(new Uint16Array(m.ix), 'SCALAR', 5123, 34963), material: 0};
  json.meshes.push({name: m.part, primitives: [prim]});
  json.nodes.push({name: m.part, mesh: k, skin: 0});
  json.nodes[0].children.push(k + 1);
});
bones.forEach(b => json.nodes.push({name: b.name, translation: b.t, rotation: b.r, scale: b.s, ...(b.children.length ? {children: b.children.map(boneNode)} : {})}));
json.nodes[0].children.push(boneNode(0));
const ibm = new Float32Array(joints.length * 16);
joints.forEach((i, k) => ibm.set(world[i].clone().invert().elements, k * 16));
json.skins.push({joints: joints.map(boneNode), skeleton: boneNode(0), inverseBindMatrices: accessor(ibm, 'MAT4', 5126)});
const bin = Buffer.concat(chunks), binPad = Buffer.alloc((4 - (bin.length % 4)) % 4);
json.buffers.push({byteLength: bin.length + binPad.length});
let text = Buffer.from(JSON.stringify(json), 'utf8');
text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.write('glTF', 0, 'latin1'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + text.length + 8 + bin.length + binPad.length, 8);
jh.writeUInt32LE(text.length, 0); jh.write('JSON', 4, 'latin1');
bh.writeUInt32LE(bin.length + binPad.length, 0); bh.write('BIN\u0000', 4, 'latin1');
fs.writeFileSync(OUT, Buffer.concat([head, jh, text, bh, bin, binPad]));
console.log(OUT, fs.statSync(OUT).size, 'bytes; scale', SCALE.toFixed(4), '; head top', headTop.toFixed(3), 'm; swatches', KIT.length + new Set(slotOf.values()).size, 'of', SLOTS);
