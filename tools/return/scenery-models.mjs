// Return Man's scenery models (models/return/*.glb) from the owner's Unity asset packs (Oct 25 2026: "use the assets to
// create new and improved sceneries in the game ... for both objects outside the three lane gameplay and within").
// Each model is read straight from its pack (tools/return/unity-assets.mjs), each face given one colour (its material's,
// times its picture's at the face: the packs' colour palettes and painted textures alike), stood on the ground at its
// middle, turned to face the camera (+z), sized in yards (scenery-models.json), welded and written as a plain GLB:
// one node a model (its faces that glow a node of their own, name~lit), POSITION + COLOR_0 (linear) + indices, its
// size in extras. No textures, nothing for three.js to do but copy the triangles into the world's batches.
//   node tools/return/scenery-models.mjs --assets "D:/Unity/My project/Assets"            (models/return/<group>.glb)
//   node tools/return/scenery-models.mjs --assets "D:/Unity/My project/Assets" --catalog <dir>   (every model, by pack)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {model, image, unityIndex, material, mat4} from './unity-assets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : a), []));
const ASSETS = path.resolve(args.assets || 'D:/Unity/My project/Assets');
export const PACKS = {
  environment: 'LowPoly Environment Pack', currency: 'MAR-Low Poly Currency', desert: 'Free Low Poly Desert Pack',
  beach: 'Aquaset/LowPolyTropicalBeach', ships: 'FREE Low Poly Spaceships', winter: 'FinottiGames/LowPoly_WinterPack',
  island: 'LowPolyTropicalEnvironment_LITE', scifi: 'Mnostva_Art/Flying_Sci_Fi_Island_city', western: 'Wild West Western',
  playground: 'Playground Low Poly'
};

// (packs whose every model wears one palette material, whatever its FBX calls it)
const PACK_MAT = {winter: 'Materials-Shaders/Built-in/Mat_ImphenziaPixPal.mat', playground: 'Materials/T_Generic_colors.mat',
  island: 'Materials/TropicalEnvironmentLite_MAIN.mat', currency: 'Materials/Cion.mat'};

// ============================================================================ Colour
const lin = c => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const INDEX = new Map();
const indexOf = pack => { if (!INDEX.has(pack)) INDEX.set(pack, unityIndex(path.join(ASSETS, PACKS[pack].split('/')[0]))); return INDEX.get(pack); };
function sampler(tex) {
  if (!tex) return null;
  const img = image(tex.file), [su, sv] = tex.scale || [1, 1], [ou, ov] = tex.offset || [0, 0];
  return (u, v) => {
    const fu = u * su + ou, fv = v * sv + ov, x = Math.min(img.w - 1, Math.floor((fu - Math.floor(fu)) * img.w)), y = Math.min(img.h - 1, Math.floor((1 - (fv - Math.floor(fv))) * img.h));
    const o = (y * img.w + x) * 4;
    return [img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255];
  };
}
/** One colour for a face from colour samples: the one most of it is, if most of it is one; else their mean. */
function settle(samples) {
  // (a painted texture's black outlines and seams aren't the face's colour, unless the face is mostly them)
  const lit = samples.filter(s => Math.max(...s) > .07);
  if (lit.length >= samples.length * .3) samples = lit;
  const counts = new Map(); let best = null, n = 0;
  for (const s of samples) {
    const k = s.map(c => Math.round(c * 24)).join(','), e = counts.get(k) || {n: 0, s};
    e.n++; counts.set(k, e);
    if (e.n > n) { n = e.n; best = e.s; }
  }
  if (n >= samples.length * .4) return best;
  return [0, 1, 2].map(c => samples.reduce((a, s) => a + s[c], 0) / samples.length);
}
// barycentric spots over a triangle (its middle, toward each corner, along each edge)
const SPOTS = [[1 / 3, 1 / 3], [.6, .2], [.2, .6], [.2, .2], [.45, .45], [.1, .45], [.45, .1], [.7, .15], [.15, .7], [.15, .15]];

/** The triangles of a model, in yards-to-be (its file's units, to metres), each with its colour (linear) and glow. */
function triangles(spec) {
  const pack = spec.pack, file = path.join(ASSETS, PACKS[pack], spec.file), idx = indexOf(pack);
  const {meshes, unit} = model(file);
  const tris = [], scale = (unit || 1) / 100 * (spec.unit || 1);
  const inPack = f => path.join(ASSETS, PACKS[pack], f);
  const force = spec.mat || PACK_MAT[pack] ? material(idx, inPack(spec.mat || PACK_MAT[pack])) : null;
  const forceTex = spec.tex ? {file: inPack(spec.tex)} : null;
  // (a material's name in the FBX is often not its Unity material's: then the picture the FBX names, or the material
  // named for the model, as Unity's importer finds them)
  const base = path.basename(file).replace(/\.[^.]+$/, '').toLowerCase(), names = idx.mats.map(f => [path.basename(f, '.mat').toLowerCase(), f]);
  const byModel = () => {
    const hit = names.filter(([n]) => n === base)[0] || names.filter(([n]) => base.startsWith(n)).sort((a, b) => b[0].length - a[0].length)[0]
      || names.filter(([n]) => n.startsWith(base)).sort((a, b) => a[0].length - b[0].length || (/URP|HDRP/.test(a[1]) ? 1 : -1))[0];
    return hit ? material(idx, hit[1]) : null;
  };
  const byPicture = fm => {
    if (!fm.tex) return null;
    const want = path.basename(fm.tex.replace(/\\/g, '/')).toLowerCase(), file = [...idx.byGuid.values()].find(f => path.basename(f).toLowerCase() === want);
    return file ? {name: want, color: [1, 1, 1], tex: {file}} : null;
  };
  const lods = meshes.some(m => /_LOD0$/.test(m.name));
  for (const m of meshes) {
    if (lods && /_LOD[1-9]$/.test(m.name)) continue; // (only the finest of a pack's levels of detail)
    if (spec.only && !spec.only.some(n => m.name.includes(n))) continue;
    if (spec.skip && spec.skip.some(n => m.name.includes(n))) continue;
    const mats = (m.materials.length ? m.materials : [{name: 'default', color: [.8, .8, .8]}]).map(fm => {
      const um = force || (spec.mats && spec.mats[fm.name] ? material(idx, inPack(spec.mats[fm.name])) : material(idx, fm.name) || byPicture(fm) || byModel());
      const tex = forceTex || (um && um.tex) || null;
      return {color: um ? um.color : fm.color, sample: tex ? sampler(tex) : null, glow: um && um.glow, glowSample: um && um.glowTex ? sampler(um.glowTex) : null,
        tint: spec.tint && spec.tint[fm.name]};
    });
    const {pos, polys, uv, colors} = m.data, M = m.matrix;
    const P = i => { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]].map(c => c * scale); };
    polys.forEach((poly, pi) => {
      if (poly.length < 3) return;
      const mat = mats[Math.min(mats.length - 1, m.data.mats(pi))] || mats[0];
      const corners = poly.map(c => P(c.v)), uvs = uv ? poly.map((_, k) => uv(pi, k)) : null, cols = colors ? poly.map((_, k) => colors(pi, k)) : null;
      const samples = [], glows = [];
      for (let k = 1; k < poly.length - 1; k++) {
        for (const [a, b] of SPOTS) {
          const w = [1 - a - b, a, b], ix = [0, k, k + 1];
          let c = mat.color.slice(0, 3);
          if (mat.sample && uvs) { const u = ix.reduce((s, j, q) => s + uvs[j][0] * w[q], 0), v = ix.reduce((s, j, q) => s + uvs[j][1] * w[q], 0), t = mat.sample(u, v); c = c.map((x, q) => x * t[q]); if (mat.glowSample) glows.push(mat.glowSample(u, v)); }
          else if (cols) { const t = [0, 1, 2].map(q => ix.reduce((s, j, r) => s + cols[j][q] * w[r], 0)); c = c.map((x, q) => x * t[q]); }
          samples.push(c);
        }
      }
      let c = settle(samples);
      if (mat.tint) c = mat.tint;
      if (spec.dark && Math.max(...c) < .08) c = spec.dark; // (faces painted black in the texture's gaps)
      const glow = !!mat.glow && (!mat.glowSample || glows.some(g => Math.max(...g) > .35));
      // (a glowing face its glow's colour; every colour to 32 steps a channel, so neighbours share their corners)
      if (glow && glows.length) c = settle(glows.filter(g => Math.max(...g) > .35));
      const color = c.map(x => lin(Math.round(Math.max(0, Math.min(1, x)) * 31) / 31));
      // (flip the winding if the model's matrix mirrors it)
      const det = M[0] * (M[5] * M[10] - M[6] * M[9]) - M[4] * (M[1] * M[10] - M[2] * M[9]) + M[8] * (M[1] * M[6] - M[2] * M[5]);
      for (let k = 1; k < poly.length - 1; k++) tris.push({p: det < 0 ? [corners[0], corners[k + 1], corners[k]] : [corners[0], corners[k], corners[k + 1]], color, glow});
    });
  }
  if (!tris.length) throw new Error('No triangles in ' + file);
  return tris;
}

// ============================================================================ Shaping and writing
function bounds(tris) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t.p) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[c]); hi[c] = Math.max(hi[c], p[c]); }
  return {lo, hi, size: hi.map((v, c) => v - lo[c])};
}
/** Turned (spec.turn degrees about the up, so its front faces +z), stood on the ground at its middle, sized. */
function shape(tris, spec) {
  const r = (spec.turn || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
  const tilt = spec.tilt ? mat4.R4(spec.tilt) : null;
  for (const t of tris) t.p = t.p.map(([x, y, z]) => {
    if (tilt) [x, y, z] = [tilt[0] * x + tilt[4] * y + tilt[8] * z, tilt[1] * x + tilt[5] * y + tilt[9] * z, tilt[2] * x + tilt[6] * y + tilt[10] * z];
    return [x * cs + z * sn, y, -x * sn + z * cs];
  });
  const b = bounds(tris), k = spec.h ? spec.h / b.size[1] : spec.w ? spec.w / b.size[0] : spec.d ? spec.d / b.size[2] : spec.scale || 1;
  const mid = [(b.lo[0] + b.hi[0]) / 2, b.lo[1], (b.lo[2] + b.hi[2]) / 2];
  for (const t of tris) t.p = t.p.map(p => p.map((v, c) => (v - mid[c]) * k));
  return tris;
}
/** Fewer triangles for the packs' dense models: each corner moved to the middle of the corners in its cell (cell
 *  yards on a side), the triangles left with no area (or the same as another) dropped; each keeps its colour. */
function simplify(tris, cell) {
  const key = p => p.map(v => Math.floor(v / cell)).join(','), sum = new Map();
  for (const t of tris) for (const p of t.p) {
    const k = key(p), s = sum.get(k) || [0, 0, 0, 0];
    s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; sum.set(k, s);
  }
  const at = k => { const s = sum.get(k); return [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; };
  const seen = new Set(), out = [];
  for (const t of tris) {
    const ks = t.p.map(key);
    if (ks[0] === ks[1] || ks[1] === ks[2] || ks[0] === ks[2]) continue;
    const id = [...ks].sort().join('|') + '|' + t.color.join(',');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({...t, p: ks.map(at)});
  }
  return out;
}
/** Fewer triangles, keeping the shape (Garland & Heckbert's quadric edge collapse): each edge's cost the squared
 *  distance its merged corner would be from the faces round it (open edges, and edges between two colours, held to
 *  their line), cheapest first, never turning a face over, till target triangles are left; each keeps its colour. */
function decimate(tris, target) {
  const P = [], key = new Map(), F = [], C = [];
  const vid = p => { const k = p.map(v => Math.round(v * 1e4)).join(','); let i = key.get(k); if (i == null) { i = P.length; key.set(k, i); P.push(p.slice()); } return i; };
  const colors = new Map();
  for (const t of tris) {
    const f = t.p.map(vid);
    if (f[0] === f[1] || f[1] === f[2] || f[0] === f[2]) continue;
    const ck = t.color.join(',') + (t.glow ? '!' : '');
    if (!colors.has(ck)) colors.set(ck, {color: t.color, glow: t.glow});
    F.push(f); C.push(ck);
  }
  const n = P.length, Q = Array.from({length: n}, () => new Float64Array(10)), faces = Array.from({length: n}, () => new Set()), alive = F.map(() => true);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const addPlane = (q, nx, ny, nz, d, w) => { q[0] += w * nx * nx; q[1] += w * nx * ny; q[2] += w * nx * nz; q[3] += w * nx * d; q[4] += w * ny * ny; q[5] += w * ny * nz; q[6] += w * ny * d; q[7] += w * nz * nz; q[8] += w * nz * d; q[9] += w * d * d; };
  const err = (q, p) => { const [x, y, z] = p; return q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9]; };
  const normal = f => cross(sub(P[f[1]], P[f[0]]), sub(P[f[2]], P[f[0]]));
  const edges = new Map();
  F.forEach((f, i) => {
    const nn = normal(f), area = len(nn) / 2 || 1e-9, u = nn.map(v => v / (2 * area));
    for (const v of f) { addPlane(Q[v], u[0], u[1], u[2], -dot(u, P[f[0]]), area); faces[v].add(i); }
    for (let k = 0; k < 3; k++) { const a = f[k], b = f[(k + 1) % 3], ek = a < b ? a + ',' + b : b + ',' + a; if (!edges.has(ek)) edges.set(ek, []); edges.get(ek).push(i); }
  });
  // (an open edge, or one between two colours: a plane along it, upright to its face, holds its corners to it)
  for (const [ek, fs] of edges) {
    if (fs.length === 2 && C[fs[0]] === C[fs[1]]) continue;
    const [a, b] = ek.split(',').map(Number), e = sub(P[b], P[a]), el = len(e) || 1e-9, nn = normal(F[fs[0]]);
    const c = cross(e, nn), cl = len(c) || 1e-9, u = c.map(v => v / cl), w = (fs.length === 1 ? 20 : 6) * el * el;
    for (const v of [a, b]) addPlane(Q[v], u[0], u[1], u[2], -dot(u, P[a]), w);
  }
  const stamp = new Int32Array(n), heap = [];
  const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].cost <= heap[i].cost) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].cost < heap[m].cost) m = l; if (r < heap.length && heap[r].cost < heap[m].cost) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const plan = (a, b) => {
    const q = Q[a].map((v, i) => v + Q[b][i]), mid = P[a].map((v, i) => (v + P[b][i]) / 2);
    let best = null, cost = Infinity;
    for (const p of [P[a], P[b], mid]) { const e = err(q, p); if (e < cost) { cost = e; best = p.slice(); } }
    push({cost, a, b, p: best, sa: stamp[a], sb: stamp[b]});
  };
  for (const ek of edges.keys()) { const [a, b] = ek.split(',').map(Number); plan(a, b); }
  let left = F.length;
  while (left > target && heap.length) {
    const e = pop(), {a, b} = e;
    if (e.sa !== stamp[a] || e.sb !== stamp[b]) continue;
    // (no face round them may turn over)
    let ok = true;
    for (const v of [a, b]) for (const fi of faces[v]) {
      const f = F[fi]; if (f.includes(a) && f.includes(b)) continue;
      const before = normal(f), after = cross(sub(f[1] === a || f[1] === b ? e.p : P[f[1]], f[0] === a || f[0] === b ? e.p : P[f[0]]), sub(f[2] === a || f[2] === b ? e.p : P[f[2]], f[0] === a || f[0] === b ? e.p : P[f[0]]));
      if (dot(before, after) <= .2 * len(before) * len(after)) { ok = false; break; }
    }
    if (!ok) { stamp[a]++; stamp[b]++; continue; }
    P[a] = e.p; Q[a] = Q[a].map((v, i) => v + Q[b][i]);
    for (const fi of faces[b]) {
      const f = F[fi];
      if (f.includes(a)) { alive[fi] = false; left--; for (const v of f) faces[v].delete(fi); continue; }
      f[f.indexOf(b)] = a; faces[a].add(fi);
    }
    faces[b].clear(); stamp[a]++; stamp[b]++;
    const near = new Set(); for (const fi of faces[a]) for (const v of F[fi]) if (v !== a) near.add(v);
    for (const v of near) plan(a, v);
  }
  const out = [];
  F.forEach((f, i) => { if (alive[i]) out.push({p: f.map(v => P[v].slice()), ...colors.get(C[i])}); });
  return out;
}
function weld(tris) {
  const keyOf = new Map(), pos = [], col = [], idx = [];
  for (const t of tris) for (const p of t.p) {
    const c8 = t.color.map(c => Math.round(c * 255)), key = p.map(v => Math.round(v * 2000)).join(',') + '|' + c8.join(',');
    let i = keyOf.get(key);
    if (i == null) { i = pos.length / 3; keyOf.set(key, i); pos.push(...p); col.push(...c8, 255); }
    idx.push(i);
  }
  return {pos: new Float32Array(pos), col: new Uint8Array(col), idx: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)};
}
/** A GLB of named models: [{name, tris, extras}]. */
function glb(models) {
  const json = {asset: {version: '2.0', generator: 'Gridiron Gangbang tools/return/scenery-models.mjs'},
    extensionsUsed: ['KHR_mesh_quantization'], extensionsRequired: ['KHR_mesh_quantization'], scene: 0, scenes: [{nodes: []}], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [{byteLength: 0}]};
  const chunks = []; let length = 0;
  const view = (bytes, target) => {
    const pad = (4 - length % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
    json.bufferViews.push({buffer: 0, byteOffset: length, byteLength: bytes.byteLength, target});
    chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)); length += bytes.byteLength;
    return json.bufferViews.length - 1;
  };
  for (const m of models) {
    for (const part of [{tris: m.tris.filter(t => !t.glow), name: m.name}, {tris: m.tris.filter(t => t.glow), name: m.name + '~lit'}]) {
      if (!part.tris.length) continue;
      // (positions in 16 bits, KHR_mesh_quantization: the node's translation and scale take them back to yards)
      const w = weld(part.tris), b = bounds(part.tris), mid = b.lo.map((v, c) => (v + b.hi[c]) / 2), half = b.size.map(v => Math.max(v / 2, 1e-4));
      const q = new Int16Array(w.pos.length / 3 * 4);
      for (let i = 0; i < w.pos.length / 3; i++) for (let c = 0; c < 3; c++) q[i * 4 + c] = Math.round((w.pos[i * 3 + c] - mid[c]) / half[c] * 32767);
      const qv = view(q, 34962); json.bufferViews[qv].byteStride = 8;
      const pa = json.accessors.push({bufferView: qv, componentType: 5122, normalized: true, count: w.pos.length / 3, type: 'VEC3', min: [-32767, -32767, -32767], max: [32767, 32767, 32767]}) - 1;
      const ca = json.accessors.push({bufferView: view(w.col, 34962), componentType: 5121, normalized: true, count: w.col.length / 4, type: 'VEC4'}) - 1;
      const ia = json.accessors.push({bufferView: view(w.idx, 34963), componentType: w.idx instanceof Uint32Array ? 5125 : 5123, count: w.idx.length, type: 'SCALAR'}) - 1;
      json.meshes.push({name: part.name, primitives: [{attributes: {POSITION: pa, COLOR_0: ca}, indices: ia, mode: 4}]});
      json.nodes.push({name: part.name, mesh: json.meshes.length - 1, translation: mid, scale: half, extras: {...m.extras, size: bounds(m.tris).size.map(v => +v.toFixed(3)), tris: part.tris.length}});
      json.scenes[0].nodes.push(json.nodes.length - 1);
    }
  }
  const bin = Buffer.concat(chunks); json.buffers[0].byteLength = bin.length;
  const js = Buffer.from(JSON.stringify(json)), jsPad = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 32)]), binPad = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsPad.length + 8 + binPad.length, 8);
  const ch = (buf, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(buf.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, buf]); };
  return Buffer.concat([head, ch(jsPad, 0x4E4F534A), ch(binPad, 0x004E4942)]);
}

// ============================================================================ Run
if (args.catalog) {
  // every model of every pack, as it comes (metres), one GLB a pack, for choosing
  const out = path.resolve(args.catalog); fs.mkdirSync(out, {recursive: true});
  const list = {};
  for (const [pack, dir] of Object.entries(PACKS)) {
    if (args.pack && args.pack !== pack) continue;
    const files = [];
    (function walk(d) { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(fbx|obj)$/i.test(e.name)) files.push(path.relative(path.join(ASSETS, dir), f)); } })(path.join(ASSETS, dir));
    const models = [];
    for (const file of files) {
      try {
        const tris = shape(triangles({pack, file}), {});
        models.push({name: file.replace(/\\/g, '/'), tris, extras: {pack}});
        console.log(pack, file, tris.length, bounds(tris).size.map(v => v.toFixed(2)).join(' x '));
      } catch (e) { console.log('FAILED', pack, file, e.message); }
    }
    fs.writeFileSync(path.join(out, pack + '.glb'), glb(models));
    list[pack] = models.map(m => ({name: m.name, tris: m.tris.length, size: bounds(m.tris).size}));
  }
  fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(list, null, 1));
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'scenery-models.json'), 'utf8'));
  const out = path.resolve(args.out || path.join(HERE, '../../models/return'));
  fs.mkdirSync(out, {recursive: true});
  for (const [group, specs] of Object.entries(manifest.groups)) {
    const models = Object.entries(specs).map(([name, spec]) => {
      let tris = shape(triangles(spec), spec);
      if (spec.cell) tris = simplify(tris, spec.cell);
      if (spec.tris && tris.length > spec.tris) tris = decimate(tris, spec.tris);
      return {name, tris, extras: spec.extras || {}};
    });
    models.forEach(m => console.log('  ' + m.name, m.tris.length));
    const bytes = glb(models), file = path.join(out, group + '-v1.glb');
    fs.writeFileSync(file, bytes);
    console.log(group, models.length, 'models', models.reduce((a, m) => a + m.tris.length, 0), 'triangles', (bytes.length / 1024).toFixed(0) + ' KB');
  }
}
