// Convert the owner's static 3DForge Unity prefabs, retaining their hierarchy,
// mesh references and material assignments. Unity scripts are not executed.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a, []));
if (!args.source || !args.three || !args.modules || !args.out) throw Error('Required: --source <Assets> --three <three r160> --modules <node_modules> --out <folder>');
const source = path.resolve(args.source), out = path.resolve(args.out);
const pack = path.join(source, '3DForge/TowerDefence/Humans');
const T = await import(pathToFileURL(path.join(args.three, 'build/three.module.js')));
const {FBXLoader} = await import(pathToFileURL(path.join(args.three, 'examples/jsm/loaders/FBXLoader.js')));
const {GLTFExporter} = await import(pathToFileURL(path.join(args.three, 'examples/jsm/exporters/GLTFExporter.js')));
const sharp = createRequire(import.meta.url)(path.join(path.resolve(args.modules), 'sharp'));
if (T.REVISION !== '160') throw Error('Use Three r160');
globalThis.window = {URL: globalThis.URL};
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); } };
T.TextureLoader.prototype.load = () => new T.Texture();
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const text = p => fs.readFileSync(p, 'utf8');
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const guids = new Map(walk(pack).filter(p => p.endsWith('.meta')).map(p => [text(p).match(/^guid: (\w+)/m)?.[1], p.slice(0, -5)]));
const ref = s => ({id: s?.match(/fileID: (\d+)/)?.[1], guid: s?.match(/guid: (\w+)/)?.[1]});
const property = (s, key) => s.match(new RegExp('^  ' + key + ': (.*)', 'm'))?.[1];
const vector = s => Object.fromEntries([...s.matchAll(/([xyzw]): ([-\d.e+]+)/g)].map(m => [m[1], Number(m[2])]));
const models = new Map(), mats = new Map(), textures = new Map(), used = new Set();
fs.mkdirSync(out, {recursive: true});
function mesh(refValue) {
  const r = ref(refValue), file = guids.get(r.guid);
  if (!file) throw Error('Missing mesh GUID ' + r.guid);
  used.add(file); used.add(file + '.meta');
  if (!models.has(file)) {
    const b = fs.readFileSync(file), model = new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), pack + path.sep);
    model.updateMatrixWorld(true); models.set(file, model);
  }
  const name = text(file + '.meta').match(new RegExp('^    ' + r.id + ': (.*)', 'm'))?.[1]?.trim();
  const node = models.get(file).getObjectByName(name);
  if (!node?.isMesh) throw Error('Missing mesh ' + name + ' in ' + file);
  // The prefab already carries each FBX node transform. Applying it here too
  // would rotate mirrored weapon parts twice (notably the stage-three bow).
  return node.geometry.clone();
}
async function material(guid) {
  if (mats.has(guid)) return mats.get(guid);
  const file = guids.get(guid); if (!file) throw Error('Missing material ' + guid);
  used.add(file);
  const src = text(file), name = property(src, 'm_Name');
  const textureGuid = src.match(/- _MainTex:\s*\n\s*m_Texture: \{[^}]*guid: (\w+)/)?.[1];
  const textureFile = guids.get(textureGuid); if (!textureFile) throw Error('Missing diffuse map for ' + name);
  used.add(textureFile);
  const textureName = path.basename(textureFile, path.extname(textureFile)) + '.png';
  if (!textures.has(textureName)) {
    // FBX UVs use the same convention as the existing character exporter.
    const bytes = await sharp(textureFile).resize(1024, 1024, {fit: 'inside', withoutEnlargement: true}).flip().png({palette: true, colours: 256, quality: 85, compressionLevel: 9}).toBuffer();
    fs.writeFileSync(path.join(out, textureName), bytes); textures.set(textureName, bytes.length);
  }
  const m = new T.MeshStandardMaterial({name, color: 0xffffff, roughness: .95, metalness: 0});
  m.userData.diffuse = textureName; mats.set(guid, m); return m;
}
const pad = b => Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4, 32)]);
function attachTextures(buffer) {
  const b = Buffer.from(buffer), n = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + n));
  const bin = b.subarray(28 + n), names = [...new Set(json.materials.map(m => m.extras.diffuse))];
  json.images = names.map(uri => ({uri}));
  json.samplers = [{magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497}];
  json.textures = names.map((_, i) => ({source: i, sampler: 0}));
  json.materials.forEach(m => { m.pbrMetallicRoughness.baseColorTexture = {index: names.indexOf(m.extras.diffuse)}; delete m.extras; });
  const j = pad(Buffer.from(JSON.stringify(json))), header = Buffer.alloc(20), bh = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + j.length + bin.length, 8);
  header.writeUInt32LE(j.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, j, bh, bin]);
}
const manifest = {sourcePack: '3DForge/TowerDefence/Humans', textureSize: 1024, units: {}, textures: {}, sources: []};
for (const [kind, label] of Object.entries({barracks: 'Malitia', tower: 'WatchTower', ballista: 'Balista'})) {
  for (let stage = 1; stage <= 3; stage++) {
    const prefab = path.join(pack, 'Prefabs', 'td_humans_' + label + '_stage' + stage + '.prefab');
    used.add(prefab);
    const blocks = [...text(prefab).matchAll(/--- !u!(\d+) &(\d+)\r?\n([\s\S]*?)(?=--- !u!|$)/g)].map(m => ({type: +m[1], id: m[2], body: m[3]}));
    const objects = new Map(), transforms = new Map();
    for (const b of blocks.filter(b => b.type === 1)) { const g = new T.Group(); g.name = property(b.body, 'm_Name'); objects.set(b.id, g); }
    for (const b of blocks.filter(b => b.type === 4)) {
      const g = objects.get(ref(property(b.body, 'm_GameObject')).id);
      const p = vector(property(b.body, 'm_LocalPosition')), q = vector(property(b.body, 'm_LocalRotation')), s = vector(property(b.body, 'm_LocalScale'));
      g.position.set(p.x, p.y, p.z); g.quaternion.set(q.x, q.y, q.z, q.w); g.scale.set(s.x, s.y, s.z);
      transforms.set(b.id, {g, parent: ref(property(b.body, 'm_Father')).id});
    }
    const root = new T.Group(); root.name = kind + '-' + stage;
    for (const {g, parent} of transforms.values()) (transforms.get(parent)?.g || root).add(g);
    let triangles = 0, meshes = 0;
    for (const b of blocks.filter(b => b.type === 33)) {
      const go = ref(property(b.body, 'm_GameObject')).id;
      const renderer = blocks.find(r => r.type === 23 && ref(property(r.body, 'm_GameObject')).id === go);
      if (!renderer) throw Error('Missing renderer');
      const materialBlock = renderer.body.match(/  m_Materials:\r?\n([\s\S]*?)(?=  \w)/)?.[1] || '';
      const materials = await Promise.all([...materialBlock.matchAll(/guid: (\w+)/g)].map(m => material(m[1])));
      if (!materials.length) throw Error('Missing prefab materials');
      const geometry = mesh(property(b.body, 'm_Mesh'));
      const m = new T.Mesh(geometry, materials.length === 1 ? materials[0] : materials);
      triangles += (geometry.index?.count || geometry.attributes.position.count) / 3; meshes++;
      objects.get(go).add(m);
    }
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    const span = Math.max(size.x, size.z); if (!(span > 0 && Number.isFinite(span))) throw Error('Invalid prefab bounds');
    let platformY = 0;
    if (kind === 'tower') root.traverse(o => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position, index = o.geometry.index;
      for (let i = 0; i < (index?.count || pos.count); i += 3) {
        const v = [0, 1, 2].map(j => new T.Vector3().fromBufferAttribute(pos, index ? index.getX(i + j) : i + j).applyMatrix4(o.matrixWorld));
        const mid = v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1 / 3);
        const normal = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
        if (normal.y > span * span * .01 && Math.max(...v.map(p => p.y)) - Math.min(...v.map(p => p.y)) < span * .005 &&
          Math.abs(mid.x - center.x) < span * .3 && Math.abs(mid.z - center.z) < span * .3) platformY = Math.max(platformY, (mid.y - box.min.y) / span);
      }
      if (!(platformY > 0)) throw Error('Cannot locate tower platform');
    });
    root.position.set(-center.x / span, -box.min.y / span, -center.z / span); root.scale.setScalar(1 / span);
    const anchor = new T.Group(); anchor.add(root); anchor.userData.platformY = platformY;
    const glb = attachTextures(await new GLTFExporter().parseAsync(anchor, {binary: true, trs: true}));
    const file = kind + '-' + stage + '.glb'; fs.writeFileSync(path.join(out, file), glb);
    manifest.units[kind + '-' + stage] = {file, prefab: path.relative(source, prefab).replaceAll('\\', '/'), bytes: glb.length, meshes, triangles, height: size.y / span, platformY, footprint: [size.x / span, size.z / span]};
    console.log(file, glb.length, 'bytes;', triangles, 'triangles');
  }
}
manifest.textures = Object.fromEntries(textures);
manifest.sources = [...used].sort().map(file => ({path: path.relative(source, file).replaceAll('\\', '/'), sha256: sha(file)}));
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
