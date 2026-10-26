// Read-only Unity prefab reader for Keepfall's asset converters (Node, three r160).
// Resolves GameObject hierarchies, nested prefab instances and their overrides, FBX meshes by GUID/fileID and
// Standard-shader diffuse materials. Unity's left-handed scene is mirrored on X into three.js's right-handed one:
// FBX geometry stays as authored, transforms flip (x, qy, qz). Unity scripts, colliders and particles are ignored.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const text = p => fs.readFileSync(p, 'utf8');
export const sha256 = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ref = s => ({id: s?.match(/fileID: (-?\d+)/)?.[1], guid: s?.match(/guid: (\w+)/)?.[1]});
const prop = (s, key) => s.match(new RegExp('^  ' + key + ': (.*)', 'm'))?.[1];
const vec = s => Object.fromEntries([...(s || '').matchAll(/([xyzw]): ([-\d.e+]+)/g)].map(m => [m[1], Number(m[2])]));
const MASK = (1n << 63n) - 1n;

// Unity 2019+ names imported sub-assets by xxHash64("Type:Mesh->" + name + occurrence), as a signed fileID.
const M64 = (1n << 64n) - 1n, P1 = 11400714785074694791n, P2 = 14029467366897019727n, P3 = 1609587929392839161n, P4 = 9650029242287828579n, P5 = 2870177450012600261n;
const rotl = (x, r) => ((x << BigInt(r)) | (x >> BigInt(64 - r))) & M64;
const xround = (acc, v) => rotl((acc + v * P2) & M64, 31) * P1 & M64;
const xmerge = (acc, v) => ((acc ^ xround(0n, v)) * P1 + P4) & M64;
function xx64(buf) {
  let p = 0, h; const len = buf.length, r64 = i => buf.readBigUInt64LE(i), r32 = i => BigInt(buf.readUInt32LE(i));
  if (len >= 32) {
    let v1 = (P1 + P2) & M64, v2 = P2, v3 = 0n, v4 = (-P1) & M64;
    for (; p <= len - 32; p += 32) { v1 = xround(v1, r64(p)); v2 = xround(v2, r64(p + 8)); v3 = xround(v3, r64(p + 16)); v4 = xround(v4, r64(p + 24)); }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) & M64;
    h = xmerge(xmerge(xmerge(xmerge(h, v1), v2), v3), v4);
  } else h = P5;
  h = (h + BigInt(len)) & M64;
  for (; p + 8 <= len; p += 8) { h ^= xround(0n, r64(p)); h = (rotl(h, 27) * P1 + P4) & M64; }
  if (p + 4 <= len) { h ^= r32(p) * P1 & M64; h = (rotl(h, 23) * P2 + P3) & M64; p += 4; }
  for (; p < len; p++) { h ^= BigInt(buf[p]) * P5 & M64; h = rotl(h, 11) * P1 & M64; }
  h ^= h >> 33n; h = h * P2 & M64; h ^= h >> 29n; h = h * P3 & M64; h ^= h >> 32n;
  return String(h >= 1n << 63n ? h - (1n << 64n) : h);
}

/** FBX unit scale as Unity applies it (useFileScale): UnitScaleFactor / 100. */
function fileScale(buffer) {
  const b = Buffer.from(buffer), at = b.indexOf('UnitScaleFactor');
  if (at < 0) return 1;
  if (b.toString('latin1', 0, 18) === 'Kaydara FBX Binary') {
    for (let i = at + 15; i < at + 120; i++) if (b[i] === 0x44) { const v = b.readDoubleLE(i + 1); if (v > 1e-4 && v < 1e4) return v / 100; }
    return 1;
  }
  const m = b.toString('latin1', at, at + 160).match(/UnitScaleFactor",\s*"double",\s*"Number",\s*"[^"]*",\s*([-\d.eE+]+)/);
  return m ? Number(m[1]) / 100 : 1;
}

export async function createUnity({assets, three, packs}) {
  const T = await import(pathToFileURL(path.join(three, 'build/three.module.js')));
  const {FBXLoader} = await import(pathToFileURL(path.join(three, 'examples/jsm/loaders/FBXLoader.js')));
  const {TGALoader} = await import(pathToFileURL(path.join(three, 'examples/jsm/loaders/TGALoader.js')));
  if (T.REVISION !== '160') throw Error('Use three r160');
  globalThis.window = globalThis.window || {URL: globalThis.URL};
  T.TextureLoader.prototype.load = () => new T.Texture();
  const root = path.resolve(assets);
  const files = (packs || ['.']).flatMap(p => walk(path.join(root, p)));
  const guids = new Map(files.filter(p => p.endsWith('.meta')).map(p => [text(p).match(/^guid: (\w+)/m)?.[1], p.slice(0, -5)]));
  const used = new Set(), fbxCache = new Map(), matCache = new Map(), prefabText = new Map();
  const rel = p => path.relative(root, p).replaceAll('\\', '/');
  const touch = p => { used.add(p); if (fs.existsSync(p + '.meta')) used.add(p + '.meta'); };

  function fbx(file) {
    if (!fbxCache.has(file)) {
      touch(file);
      const b = fs.readFileSync(file), buffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      // three sanitizes node names ("Wall_Plain.075" → "Wall_Plain075"); keep them as Unity read them
      const sanitize = T.PropertyBinding.sanitizeNodeName;
      T.PropertyBinding.sanitizeNodeName = n => n;
      let model;
      try { model = new FBXLoader().parse(buffer, path.dirname(file) + path.sep); } finally { T.PropertyBinding.sanitizeNodeName = sanitize; }
      const meta = fs.existsSync(file + '.meta') ? text(file + '.meta') : '';
      const globalScale = Number(meta.match(/globalScale: ([\d.]+)/)?.[1] || 1);
      const useFile = !/useFileScale: 0/.test(meta);
      const names = new Map();
      // Unity <= 2018: fileIDToRecycleName; 2019+: internalIDToNameTable (43 = Mesh)
      for (const m of meta.matchAll(/^    (-?\d+): (.+)$/gm)) names.set(m[1], m[2].trim());
      for (const m of meta.matchAll(/- first:\s*\n\s*43: (-?\d+)\s*\n\s*second: (.+)/g)) names.set(m[1], m[2].trim());
      const meshes = [];
      model.traverse(o => { if (o.isMesh) meshes.push(o); });
      // (names as written in the file: sanitizing is off while parsing, below; Unity hashes the written names)
      // (node names first: a geometry may share another node's name, and Unity names the mesh after its node)
      for (const pick of [o => o.name, o => o.geometry.name]) for (const o of meshes) for (let i = 0; i < 3; i++) {
        const id = xx64(Buffer.from(`Type:Mesh->${pick(o)}${i}`));
        if (!names.has(id)) names.set(id, {node: o});
      }
      fbxCache.set(file, {model, names, meshes, scale: globalScale * (useFile ? fileScale(buffer) : 1)});
    }
    return fbxCache.get(file);
  }
  /** A mesh's geometry (FBX local space at Unity's import scale), by MeshFilter reference; goName as a fallback key. */
  function mesh(r, goName) {
    const file = guids.get(r.guid);
    if (!file) throw Error('Missing mesh GUID ' + r.guid);
    const F = fbx(file), name = F.names.get(r.id);
    const strip = s => s.replace(/[._ ]?\d+$/, '').toLowerCase();
    let node = name?.node || name && F.meshes.find(o => o.name === name);
    if (!node && goName) {
      node = F.meshes.find(o => o.name === goName) || F.meshes.find(o => strip(o.name) === strip(goName));
      if (node) console.warn(`unity-prefab: ${goName} matched by name in ${rel(file)}`);
    }
    if (!node && F.meshes.length === 1) node = F.meshes[0];
    if (!node) throw Error(`Missing mesh ${typeof name === 'string' ? name : r.id} (${goName}) in ${rel(file)}`);
    const g = node.geometry.clone();
    if (F.scale !== 1) g.scale(F.scale, F.scale, F.scale);
    return {geometry: g, groups: node.geometry.groups.length, source: rel(file)};
  }
  /** A Standard-shader diffuse material: {name, map (absolute texture path), color, cutout, tiling}. */
  function material(guid) {
    if (matCache.has(guid)) return matCache.get(guid);
    const file = guids.get(guid);
    if (!file) throw Error('Missing material ' + guid);
    touch(file);
    const src = text(file), name = prop(src, 'm_Name');
    const tex = src.match(/- _MainTex:\s*\n\s*m_Texture: \{([^}]*)\}\s*\n\s*m_Scale: \{([^}]*)\}/);
    const texFile = tex && guids.get(ref(tex[1]).guid);
    if (texFile) touch(texFile);
    const c = vec(src.match(/- _Color: \{([^}]*)\}/)?.[1]);
    const mode = Number(src.match(/- _Mode: ([\d.]+)/)?.[1] || 0), cutoff = Number(src.match(/- _Cutoff: ([\d.]+)/)?.[1] || .5);
    const shader = ref(prop(src, 'm_Shader'));
    const cutout = mode === 1 || mode === 3 && /leaves|leaf|grass|fern|plant|flower|bush/i.test(name) || /ALPHATEST/.test(src) || shader.id === '10511';
    const m = {guid, name, map: texFile || null, color: c.r === undefined ? [1, 1, 1] : [c.r, c.g, c.b], cutout, cutoff, tiling: vec(tex?.[2])};
    matCache.set(guid, m);
    return m;
  }

  function parse(file) {
    if (!prefabText.has(file)) {
      touch(file);
      const blocks = [...text(file).matchAll(/--- !u!(\d+) &(-?\d+)( stripped)?\r?\n([\s\S]*?)(?=\r?\n--- !u!|$)/g)]
        .map(m => ({type: +m[1], id: m[2], stripped: !!m[3], body: m[4]}));
      prefabText.set(file, blocks);
    }
    return prefabText.get(file);
  }

  /**
   * Builds prefab `file` → {root, index: Map('guid:fileID' → {object, kind}), guid}. index holds the prefab's own
   * GameObjects, Transforms and renderers, and every nested instance's under both its source key and the derived
   * in-file id ((instance ^ source) & mask), so overrides and children added to nested objects resolve.
   */
  function build(file) {
    const blocks = parse(file), guid = text(file + '.meta').match(/^guid: (\w+)/m)[1];
    const index = new Map(), objects = new Map(), local = new Map();
    const key = id => guid + ':' + id;
    // nested instances first
    const instances = new Map();
    for (const b of blocks.filter(b => b.type === 1001)) {
      const srcRef = ref(prop(b.body, 'm_SourcePrefab') || b.body.match(/m_ParentPrefab: (.*)/)?.[1]);
      const srcFile = guids.get(srcRef.guid);
      if (!srcFile) continue;
      const inner = /\.fbx$/i.test(srcFile) ? modelPrefab(srcFile, b.body) : srcFile.endsWith('.prefab') ? build(srcFile) : null;
      if (!inner) continue;
      const mods = [...b.body.matchAll(/- target: \{([^}]*)\}\s*\n\s*propertyPath: (.*)\s*\n\s*value: (.*)\s*\n\s*objectReference: \{([^}]*)\}/g)]
        .map(m => ({target: ref(m[1]), path: m[2].trim(), value: m[3].trim(), object: ref(m[4])}));
      const removed = [...(b.body.match(/m_RemovedComponents:([\s\S]*?)(\n  \w|$)/)?.[1] || '').matchAll(/fileID: (-?\d+), guid: (\w+)/g)].map(m => m[2] + ':' + m[1]);
      const inst = BigInt(b.id);
      inner.index.forEach((v, k) => {
        index.set(k, v);
        const [g, id] = k.split(':');
        if (g === inner.guid) index.set(key(String((inst ^ BigInt(id)) & MASK)), v);
      });
      for (const r of removed) { const v = inner.index.get(r); if (v?.kind === 'renderer') v.object.visible = false; }
      for (const m of mods) {
        const v = inner.index.get(m.target.guid + ':' + m.target.id) || index.get(m.target.guid + ':' + m.target.id);
        if (!v) continue;
        const o = v.object, n = Number(m.value);
        const t = m.path.match(/^m_Local(Position|Rotation|Scale)\.([xyzw])$/);
        if (t && v.kind === 'transform') {
          if (t[1] === 'Position') o.userData.u.p[t[2]] = n;
          else if (t[1] === 'Rotation') o.userData.u.q[t[2]] = n;
          else o.userData.u.s[t[2]] = n;
          applyU(o);
        } else if (m.path === 'm_IsActive' && v.kind === 'go') o.visible = n !== 0;
        else if (m.path === 'm_Name' && v.kind === 'go') o.name = m.value;
        else if (m.path === 'm_Enabled' && v.kind === 'renderer') o.visible = n !== 0;
        else if (/^m_Materials\.Array\.data\[(\d+)\]$/.test(m.path) && v.kind === 'renderer' && m.object.guid) {
          const i = Number(m.path.match(/\[(\d+)\]/)[1]);
          o.userData.materials[i] = material(m.object.guid);
        }
      }
      instances.set(b.id, {inner, parent: ref(prop(b.body, 'm_TransformParent')).id});
    }
    const goOf = new Map();
    for (const b of blocks.filter(b => b.type === 1 && !b.stripped)) {
      const g = new T.Group(); g.name = prop(b.body, 'm_Name') || ''; g.visible = prop(b.body, 'm_IsActive') !== '0';
      g.userData.u = {p: {x: 0, y: 0, z: 0}, q: {x: 0, y: 0, z: 0, w: 1}, s: {x: 1, y: 1, z: 1}};
      objects.set(b.id, g); index.set(key(b.id), {object: g, kind: 'go'});
    }
    const resolveTransform = id => {
      if (local.has(id)) return local.get(id);
      const b = blocks.find(x => x.id === id && (x.type === 4 || x.type === 224));
      if (b?.stripped) {
        const src = ref(prop(b.body, 'm_CorrespondingSourceObject') || prop(b.body, 'm_PrefabParentObject'));
        const pi = ref(prop(b.body, 'm_PrefabInstance') || prop(b.body, 'm_PrefabInternal')).id;
        const v = instances.get(pi)?.inner.index.get(src.guid + ':' + src.id) || index.get(src.guid + ':' + src.id);
        return v?.object || null;
      }
      return null;
    };
    for (const b of blocks.filter(b => (b.type === 4 || b.type === 224) && !b.stripped)) {
      const g = objects.get(ref(prop(b.body, 'm_GameObject')).id);
      if (!g) continue;
      g.userData.u = {p: vec(prop(b.body, 'm_LocalPosition')), q: vec(prop(b.body, 'm_LocalRotation')), s: vec(prop(b.body, 'm_LocalScale'))};
      applyU(g); local.set(b.id, g); index.set(key(b.id), {object: g, kind: 'transform'});
      goOf.set(b.id, g);
    }
    const top = new T.Group(); top.name = path.basename(file, '.prefab');
    for (const b of blocks.filter(b => (b.type === 4 || b.type === 224) && !b.stripped)) {
      const g = local.get(b.id); if (!g) continue;
      const father = ref(prop(b.body, 'm_Father')).id;
      const parent = father && father !== '0' ? resolveTransform(father) : null;
      (parent || top).add(g);
    }
    for (const [id, {inner, parent}] of instances) {
      const p = parent && parent !== '0' ? resolveTransform(parent) : null;
      const r = inner.root.children.length === 1 ? inner.root.children[0] : inner.root;
      (p || top).add(r);
    }
    for (const b of blocks.filter(b => b.type === 33 && !b.stripped)) {
      const go = ref(prop(b.body, 'm_GameObject')).id, g = objects.get(go);
      if (!g) continue;
      const r = blocks.find(x => (x.type === 23) && !x.stripped && ref(prop(x.body, 'm_GameObject')).id === go);
      if (!r || /^UCX_|collider|_col$/i.test(g.name)) continue;
      const mats = [...(r.body.match(/  m_Materials:\r?\n([\s\S]*?)(?=\r?\n  \w)/)?.[1] || '').matchAll(/guid: (\w+)/g)].map(m => material(m[1]));
      const holder = new T.Group(); holder.name = g.name + ':mesh';
      holder.userData.meshRef = ref(prop(b.body, 'm_Mesh')); holder.userData.goName = g.name; holder.userData.materials = mats;
      holder.visible = prop(r.body, 'm_Enabled') !== '0';
      g.add(holder);
      index.set(key(r.id), {object: holder, kind: 'renderer'});
      index.set(key(b.id), {object: holder, kind: 'filter'});
    }
    return {root: top, index, guid};
  }
  /** An FBX used as a prefab (a model prefab, or a variant of one): its hierarchy as imported, materials from the
   *  meta's remaps (or the variant's own renderer overrides), the root's transform overrides applied. */
  function modelPrefab(file, body) {
    const F = fbx(file), meta = text(file + '.meta');
    const remap = new Map([...meta.matchAll(/name: (.+)\s*\n\s*second: \{fileID: 2100000, guid: (\w+)/g)].map(m => [m[1].trim(), m[2]]));
    const overrides = [...body.matchAll(/propertyPath: m_Materials\.Array\.data\[(\d+)\]\s*\n\s*value:.*\n\s*objectReference: \{[^}]*guid: (\w+)/g)].map(m => [+m[1], m[2]]);
    const top = new T.Group(), model = F.model.clone(true);
    if (F.scale !== 1) model.scale.multiplyScalar(F.scale);
    top.add(model);
    model.traverse(o => {
      if (!o.isMesh) return;
      if (/^UCX_/i.test(o.name)) { o.visible = false; return; }
      const names = [o.material].flat().map(m => m.name);
      const recs = names.map((n, i) => {
        const o2 = overrides.find(x => x[0] === i);
        const g = o2?.[1] || remap.get(n) || [...guids].find(([, p]) => p.endsWith('.mat') && path.basename(p, '.mat') === n)?.[0];
        return g ? material(g) : null;
      });
      const holder = new T.Group(); holder.name = o.name + ':mesh';
      holder.position.copy(o.position); holder.quaternion.copy(o.quaternion); holder.scale.copy(o.scale);
      const geometry = o.geometry.clone();
      o.parent.add(holder); o.removeFromParent();
      if (recs.every(Boolean)) holder.add(Object.assign(new T.Mesh(geometry, recs.length === 1 ? recs[0] : recs), {name: o.name}));
    });
    const mods = [...body.matchAll(/propertyPath: m_Local(Position|Rotation|Scale)\.([xyzw])\s*\n\s*value: (.*)/g)];
    const u = {p: {x: 0, y: 0, z: 0}, q: {x: 0, y: 0, z: 0, w: 1}, s: {x: 1, y: 1, z: 1}};
    for (const [, kind, axis, v] of mods) u[kind === 'Position' ? 'p' : kind === 'Rotation' ? 'q' : 's'][axis] = Number(v);
    top.userData.u = u; applyU(top);
    return {root: new T.Group().add(top), index: new Map(), guid: 'fbx'};
  }
  function applyU(o) {
    const {p, q, s} = o.userData.u;
    // left-handed (Unity) → right-handed (three): mirror X
    o.position.set(-(p.x || 0), p.y || 0, p.z || 0);
    o.quaternion.set(q.x || 0, -(q.y || 0), -(q.z || 0), q.w ?? 1);
    o.scale.set(s.x ?? 1, s.y ?? 1, s.z ?? 1);
  }

  /** A prefab (path relative to Assets) as a three.js Group of Meshes with {map, color, cutout} material records. */
  function prefab(relPath) {
    const file = path.join(root, relPath);
    const {root: top} = build(file);
    const pending = [];
    top.traverse(o => { if (o.userData.meshRef) pending.push(o); });
    for (const h of pending) {
      if (!h.visible) continue;
      let visible = true; for (let p = h; p; p = p.parent) if (!p.visible) visible = false;
      if (!visible) continue;
      const {geometry} = mesh(h.userData.meshRef, h.userData.goName);
      const mats = h.userData.materials.filter(Boolean);
      if (!mats.length) continue;
      const m = new T.Mesh(geometry, mats.length === 1 ? mats[0] : mats);
      m.name = h.userData.goName;
      h.add(m);
    }
    top.updateMatrixWorld(true);
    return top;
  }
  /** A raw FBX file (relative path) at Unity's import scale, in three's space (for single-mesh FBX props). */
  function fbxModel(relPath) {
    const F = fbx(path.join(root, relPath));
    const g = F.model.clone(true);
    if (F.scale !== 1) g.scale.multiplyScalar(F.scale);
    g.updateMatrixWorld(true);
    return g;
  }
  /** An FBX placed as it is (no prefab of its own), its materials found by name in its pack (as Unity's import does). */
  function model(relPath) {
    const g = modelPrefab(path.join(root, relPath), '').root;
    g.updateMatrixWorld(true);
    return g;
  }
  return {T, TGALoader, prefab, fbxModel, model, material, guids, used, rel, root};
}
