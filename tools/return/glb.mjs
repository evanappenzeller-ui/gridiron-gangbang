// A glTF binary (.glb) read and written as it is, for tools that change its animations without @gltf-transform:
// read(file) -> {json, bin}; add(g, array (Float32Array), type ('SCALAR', 'VEC3', 'VEC4')) -> the new accessor's index
// (the new ones share one view); write(g, file): anything no longer used (accessors, their views) left out, each view
// on a 4-byte boundary.
import fs from 'node:fs';

export function read(file) {
  const b = fs.readFileSync(file);
  if (b.toString('latin1', 0, 4) !== 'glTF') throw new Error(file + ': not a glb');
  const jl = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jl));
  const bin = b.length > 20 + jl ? b.subarray(28 + jl, 28 + jl + b.readUInt32LE(20 + jl)) : Buffer.alloc(0);
  return {json, bin, extra: []};
}
const SIZE = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
export function add(g, array, type) {
  const j = g.json, n = array.length / SIZE[type], min = [], max = [];
  for (let c = 0; c < SIZE[type]; c++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { const v = array[i * SIZE[type] + c]; if (v < lo) lo = v; if (v > hi) hi = v; }
    min.push(lo); max.push(hi);
  }
  // (all of them in one new view, placed by write)
  if (!g.extra.length) j.bufferViews.push({buffer: 0, byteOffset: -1, byteLength: 0});
  const view = j.bufferViews.findIndex(v => v.byteOffset === -1), at = j.bufferViews[view].byteLength;
  g.extra.push(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  j.bufferViews[view].byteLength += array.byteLength;
  j.accessors.push({bufferView: view, byteOffset: at, componentType: 5126, count: n, type, min, max});
  return j.accessors.length - 1;
}
export function write(g, file) {
  const j = g.json;
  // what's still used: the accessors (meshes, skins, animations), the views (theirs, and the pictures')
  const usedA = new Set(), usedV = new Set();
  (j.meshes || []).forEach(m => m.primitives.forEach(p => {
    Object.values(p.attributes).forEach(a => usedA.add(a));
    if (p.indices != null) usedA.add(p.indices);
    (p.targets || []).forEach(t => Object.values(t).forEach(a => usedA.add(a)));
  }));
  (j.skins || []).forEach(s => { if (s.inverseBindMatrices != null) usedA.add(s.inverseBindMatrices); });
  (j.animations || []).forEach(a => a.samplers.forEach(s => { usedA.add(s.input); usedA.add(s.output); }));
  const aMap = new Map(), accessors = [];
  j.accessors.forEach((a, i) => { if (usedA.has(i)) { aMap.set(i, accessors.length); accessors.push(a); } });
  accessors.forEach(a => {
    if (a.bufferView != null) usedV.add(a.bufferView);
    if (a.sparse) { usedV.add(a.sparse.indices.bufferView); usedV.add(a.sparse.values.bufferView); }
  });
  (j.images || []).forEach(im => { if (im.bufferView != null) usedV.add(im.bufferView); });
  const vMap = new Map(), views = [], parts = [];
  let at = 0;
  j.bufferViews.forEach((v, i) => {
    if (!usedV.has(i)) return;
    const data = v.byteOffset < 0 ? Buffer.concat(g.extra) : g.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const pad = (4 - (at % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    at += pad;
    vMap.set(i, views.length);
    views.push({...v, byteOffset: at});
    parts.push(data); at += data.length;
  });
  const pad = (4 - (at % 4)) % 4; if (pad) parts.push(Buffer.alloc(pad)); at += pad;
  accessors.forEach(a => {
    if (a.bufferView != null) a.bufferView = vMap.get(a.bufferView);
    if (a.sparse) { a.sparse.indices.bufferView = vMap.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = vMap.get(a.sparse.values.bufferView); }
  });
  (j.images || []).forEach(im => { if (im.bufferView != null) im.bufferView = vMap.get(im.bufferView); });
  (j.meshes || []).forEach(m => m.primitives.forEach(p => {
    for (const k in p.attributes) p.attributes[k] = aMap.get(p.attributes[k]);
    if (p.indices != null) p.indices = aMap.get(p.indices);
    (p.targets || []).forEach(t => { for (const k in t) t[k] = aMap.get(t[k]); });
  }));
  (j.skins || []).forEach(s => { if (s.inverseBindMatrices != null) s.inverseBindMatrices = aMap.get(s.inverseBindMatrices); });
  (j.animations || []).forEach(a => a.samplers.forEach(s => { s.input = aMap.get(s.input); s.output = aMap.get(s.output); }));
  j.accessors = accessors; j.bufferViews = views; j.buffers = [{byteLength: at}];
  const bin = Buffer.concat(parts);
  let text = Buffer.from(JSON.stringify(j), 'utf8');
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.write('glTF', 0, 'latin1'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  jh.writeUInt32LE(text.length, 0); jh.write('JSON', 4, 'latin1');
  bh.writeUInt32LE(bin.length, 0); bh.write('BIN\u0000', 4, 'latin1');
  fs.writeFileSync(file, Buffer.concat([head, jh, text, bh, bin]));
  g.bin = bin; g.extra = [];
}
