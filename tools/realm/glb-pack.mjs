// Packs Groups from unity-prefab.mjs into compact GLBs for Keepfall: parts merged by material (one draw call each),
// unit footprint (largest horizontal side 1), feet on y 0, shared textures written once beside the GLBs (JPEG when
// opaque, PNG when cut out), each image flipped for glTF's top-left UV origin. Named nodes survive as separate meshes.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

export async function createPacker({T, three, modules, out, TGALoader, textureSize = 512}) {
  const BU = await import(pathToFileURL(path.join(three, 'examples/jsm/utils/BufferGeometryUtils.js')));
  const {SimplifyModifier} = await import(pathToFileURL(path.join(three, 'examples/jsm/modifiers/SimplifyModifier.js')));
  const {GLTFExporter} = await import(pathToFileURL(path.join(three, 'examples/jsm/exporters/GLTFExporter.js')));
  const sharp = createRequire(import.meta.url)(path.join(path.resolve(modules), 'sharp'));
  globalThis.FileReader = globalThis.FileReader || class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); } };
  const texDir = path.join(out, 'textures');
  fs.mkdirSync(texDir, {recursive: true});
  const textures = new Map(); // source path + size → {uri, bytes, alpha}
  const materials = new Map(); // material key → three material

  async function texture(file, size = textureSize, forceAlpha = false) {
    const key = file + '@' + size;
    if (textures.has(key)) return textures.get(key);
    let img;
    if (/\.tga$/i.test(file)) {
      const b = fs.readFileSync(file), t = new TGALoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
      img = sharp(Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength), {raw: {width: t.width, height: t.height, channels: 4}});
    } else img = sharp(file);
    const meta = await img.metadata(), stats = meta.hasAlpha || meta.channels === 4 ? await img.clone().stats() : null;
    const alpha = forceAlpha || !!stats && stats.channels[3]?.min < 250;
    const base = path.basename(file).replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_') + (size !== textureSize ? '-' + size : '');
    const uri = 'textures/' + base + (alpha ? '.png' : '.jpg');
    let pipe = img.resize(size, size, {fit: 'inside', withoutEnlargement: true}).flip();
    pipe = alpha ? pipe.png({palette: true, colours: 256, quality: 90, compressionLevel: 9}) : pipe.removeAlpha().jpeg({quality: 84, mozjpeg: true});
    const bytes = await pipe.toBuffer();
    fs.writeFileSync(path.join(out, uri), bytes);
    const rec = {uri, bytes: bytes.length, alpha, source: file};
    textures.set(key, rec);
    return rec;
  }

  /** A three material for a unity-prefab material record (shared by key). */
  async function materialOf(rec, opts = {}) {
    const size = opts.textureSize?.[rec.name] || opts.textureSize?.default || textureSize;
    const tex = rec.map ? await texture(rec.map, size) : null;
    const key = `${rec.name}|${tex?.uri || ''}|${rec.color.join(',')}`;
    if (!materials.has(key)) {
      const m = new T.MeshStandardMaterial({name: rec.name, color: new T.Color().setRGB(...rec.color.map(c => Math.min(1, c * (tex ? 1 : 1))), T.SRGBColorSpace), roughness: .92, metalness: 0});
      m.userData.uri = tex?.uri || null;
      m.userData.cutout = !!(rec.cutout && tex?.alpha);
      m.userData.cutoff = rec.cutoff || .5;
      m.userData.tiling = rec.tiling;
      materials.set(key, m);
    }
    return materials.get(key);
  }

  /** Splits every mesh in g by material group into world-space geometries, grouped by material key. */
  async function bake(g, opts = {}) {
    g.updateMatrixWorld(true);
    const byMat = new Map(), keep = opts.keep || [];
    const jobs = [];
    g.traverse(o => {
      if (!o.isMesh) return;
      let visible = true; for (let p = o; p; p = p.parent) if (!p.visible) visible = false;
      if (!visible) return;
      let keepAs = null; for (let p = o; p; p = p.parent) if (keep.includes(p.name)) { keepAs = p.name; break; }
      jobs.push({o, keepAs});
    });
    for (const {o, keepAs} of jobs) {
      const mats = [o.material].flat(), src = o.geometry, groups = src.groups.length ? src.groups : [{start: 0, count: src.index ? src.index.count : src.attributes.position.count, materialIndex: 0}];
      for (const grp of groups) {
        const rec = mats[grp.materialIndex] || mats[0];
        if (!rec) continue;
        const m = await materialOf(rec, opts);
        let part = src.index ? src.toNonIndexed() : src.clone();
        const s = src.index ? grp.start : grp.start, c = grp.count;
        // (toNonIndexed keeps triangle order: group ranges index into it directly)
        const pick = new T.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
          const a = part.attributes[name];
          if (!a) continue;
          pick.setAttribute(name, new T.BufferAttribute(a.array.slice(s * a.itemSize, (s + c) * a.itemSize), a.itemSize));
        }
        part.dispose(); part = pick;
        if (!part.attributes.normal) part.computeVertexNormals();
        if (!part.attributes.uv) part.setAttribute('uv', new T.BufferAttribute(new Float32Array(part.attributes.position.count * 2), 2));
        const world = keepAs ? new T.Matrix4().copy(o.matrixWorld) : o.matrixWorld;
        part.applyMatrix4(world);
        if (world.determinant() < 0) {
          const p = part.attributes.position, n = part.attributes.normal, u = part.attributes.uv;
          for (let i = 0; i < p.count; i += 3) for (const a of [p, n, u]) for (let k = 0; k < a.itemSize; k++) {
            const t = a.array[(i + 1) * a.itemSize + k]; a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k]; a.array[(i + 2) * a.itemSize + k] = t;
          }
        }
        const k = (keepAs || '') + '|' + m.uuid;
        if (!byMat.has(k)) byMat.set(k, {material: m, keepAs, parts: []});
        byMat.get(k).parts.push(part);
      }
    }
    return byMat;
  }

  /**
   * One unit: g (a Group in metres) merged into a node named `name`, normalized so its largest horizontal side is 1
   * (unless opts.unit) with its feet at y 0 and centred; → {node, info}. opts.keep: names of sub-nodes kept as their
   * own meshes (turrets, arms), positioned in the normalized space.
   */
  async function unit(name, g, opts = {}) {
    const byMat = await bake(g, opts);
    const all = [...byMat.values()].flatMap(v => v.parts);
    if (!all.length) throw Error('Empty unit ' + name);
    const box = new T.Box3();
    all.forEach(p => { p.computeBoundingBox(); box.union(p.boundingBox); });
    const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    const span = opts.unit ? 1 / opts.unit : Math.max(size.x, size.z);
    const node = new T.Group(); node.name = name;
    const toUnit = new T.Matrix4().makeScale(1 / span, 1 / span, 1 / span).multiply(new T.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
    let triangles = 0;
    const kept = new Map();
    // (a unit over its triangle budget is simplified, each material's mesh in proportion: phones draw the whole lot)
    const before = [...byMat.values()].reduce((n, v) => n + v.parts.reduce((m, p) => m + p.attributes.position.count / 3, 0), 0);
    const ratio = opts.maxTriangles && before > opts.maxTriangles ? opts.maxTriangles / before : 1;
    for (const {material, keepAs, parts} of byMat.values()) {
      parts.forEach(p => p.applyMatrix4(toUnit));
      let merged = BU.mergeGeometries(parts, false);
      merged = BU.mergeVertices(merged, 1e-5);
      if (ratio < 1 && !keepAs && merged.index.count / 3 > 60) {
        const simple = new SimplifyModifier().modify(merged, Math.floor(merged.attributes.position.count * (1 - ratio)));
        merged.dispose(); merged = BU.mergeVertices(simple, 1e-5); simple.dispose();
        if (!merged.index) merged = BU.mergeVertices(merged, 1e-5);
      }
      triangles += merged.index.count / 3;
      const mesh = new T.Mesh(merged, material); mesh.name = (keepAs || name) + ':' + material.name;
      if (keepAs) {
        if (!kept.has(keepAs)) {
          const pivot = new T.Group(); pivot.name = keepAs; node.add(pivot); kept.set(keepAs, pivot);
        }
        kept.get(keepAs).add(mesh);
      } else node.add(mesh);
      parts.forEach(p => p.dispose());
    }
    // a kept part pivots about its own base centre (a turret turns where it stands)
    for (const pivot of kept.values()) {
      const b = new T.Box3().setFromObject(pivot), c = b.getCenter(new T.Vector3());
      pivot.children.forEach(m => m.geometry.translate(-c.x, -b.min.y, -c.z));
      pivot.position.set(c.x, b.min.y, c.z);
    }
    const info = {triangles, materials: [...new Set([...byMat.values()].map(v => v.material.name))], height: size.y / span, footprint: [size.x / span, size.z / span], metres: size.toArray().map(v => +v.toFixed(3))};
    node.userData = {...(opts.userData || {}), height: info.height};
    return {node, info};
  }

  /** Writes nodes to <out>/<file> as a GLB whose images are the shared texture files. */
  async function write(file, nodes) {
    const scene = new T.Scene(); nodes.forEach(n => scene.add(n));
    const glb = Buffer.from(await new GLTFExporter().parseAsync(scene, {binary: true, trs: true, onlyVisible: false}));
    const n = glb.readUInt32LE(12), json = JSON.parse(glb.toString('utf8', 20, 20 + n)), bin = glb.subarray(28 + n);
    const byName = new Map([...materials.values()].map(m => [m.name + '|' + (m.userData.uri || ''), m]));
    const uris = [];
    (json.materials || []).forEach((jm, i) => {
      const m = [...materials.values()].find(x => x.name === jm.name && (!jm.extras || x.userData.uri === jm.extras.uri)) || null;
      const uri = jm.extras?.uri ?? m?.userData.uri;
      if (uri) {
        if (!uris.includes(uri)) uris.push(uri);
        jm.pbrMetallicRoughness = jm.pbrMetallicRoughness || {};
        jm.pbrMetallicRoughness.baseColorTexture = {index: uris.indexOf(uri)};
      }
      if (jm.extras?.cutout) { jm.alphaMode = 'MASK'; jm.alphaCutoff = jm.extras.cutoff || .5; jm.doubleSided = true; }
      delete jm.extras;
    });
    if (uris.length) {
      json.images = uris.map(uri => ({uri}));
      json.samplers = [{magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497}];
      json.textures = uris.map((_, i) => ({source: i, sampler: 0}));
    }
    const pad = (b, c) => Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4, c)]);
    const j = pad(Buffer.from(JSON.stringify(json)), 32), header = Buffer.alloc(20), bh = Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + j.length + bin.length, 8);
    header.writeUInt32LE(j.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
    bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
    const outBytes = Buffer.concat([header, j, bh, bin]);
    fs.writeFileSync(path.join(out, file), outBytes);
    return outBytes.length;
  }
  // (GLTFExporter writes material.userData as extras: the texture uri and cutout ride along to write())
  const exportExtras = m => { m.userData = {uri: m.userData.uri, cutout: m.userData.cutout, cutoff: m.userData.cutoff}; };
  return {unit, write, texture, materials, textures, prepare() { materials.forEach(exportExtras); }};
}
