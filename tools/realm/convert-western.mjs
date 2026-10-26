/**
 * Export the owner's licensed Toon RTS FBXs to small, self-contained GLBs.
 * Requires Node 18+ and an unpacked official three@0.160.0 npm package.
 * node tools/realm/convert-western.mjs --source "D:/Unity/My project/Assets/Toon_RTS/WesternKingdoms" --three "../output/western-convert/package"
 * Source assets are read-only. No Unity project/import settings are changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a, []));
if (!args.source || !args.three) throw new Error('Required: --source <WesternKingdoms folder> --three <three@0.160.0 package folder>');
const source = path.resolve(args.source), three = path.resolve(args.three);
const out = path.resolve(args.out || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../models/realm/western'));
const moduleAt = file => import(pathToFileURL(path.join(three, file)).href);
const T = await moduleAt('build/three.module.js');
const {FBXLoader} = await moduleAt('examples/jsm/loaders/FBXLoader.js');
const {TGALoader} = await moduleAt('examples/jsm/loaders/TGALoader.js');
const {GLTFExporter} = await moduleAt('examples/jsm/exporters/GLTFExporter.js');
if (T.REVISION !== '160') throw new Error('Use three@0.160.0 for reproducible output.');
// FBX references the artist's original PSD path. The shipped TGA is embedded below.
T.TextureLoader.prototype.load = function () { return new T.Texture(); };
globalThis.window = {URL: globalThis.URL};
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const read = file => { const b = fs.readFileSync(path.join(source, file)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const fbx = file => new FBXLoader().parse(read(file), source + path.sep);
const digest = file => createHash('sha256').update(fs.readFileSync(path.join(source, file))).digest('hex');
const pad = (buffer, byte = 0) => Buffer.concat([buffer, Buffer.alloc((4 - buffer.length % 4) % 4, byte)]);
const crcTable = Uint32Array.from({length: 256}, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function pngChunk(type, data) {
  const name = Buffer.from(type), body = Buffer.concat([name, data]); let crc = 0xFFFFFFFF;
  for (const b of body) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0);
  return Buffer.concat([head, body, tail]);
}
function png(tga) {
  const {width, height, data} = tga, stride = width * 4, rows = Buffer.alloc((stride + 1) * height);
  // Match GLTFExporter's flipY handling for the TGA texture, without a DOM/canvas dependency.
  for (let y = 0; y < height; y++) {
    const source = data.subarray((height - 1 - y) * stride, (height - y) * stride), at = y * (stride + 1);
    rows[at] = 1; // PNG Sub filter compresses neighboring atlas pixels efficiently.
    for (let x = 0; x < stride; x++) rows[at + 1 + x] = (source[x] - (x >= 4 ? source[x - 4] : 0)) & 255;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows, {level: 9})), pngChunk('IEND', Buffer.alloc(0))]);
}
function resizeTexture(image, target = 512) {
  const step = image.width / target;
  if (!Number.isInteger(step) || image.width !== image.height) throw new Error('Expected square texture with integral downsample ratio.');
  const data = new Uint8Array(target * target * 4);
  for (let y = 0; y < target; y++) for (let x = 0; x < target; x++) {
    const sums = [0, 0, 0, 0];
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
      const at = ((y * step + dy) * image.width + x * step + dx) * 4;
      for (let c = 0; c < 4; c++) sums[c] += image.data[at + c];
    }
    for (let c = 0; c < 4; c++) data[(y * target + x) * 4 + c] = Math.round(sums[c] / (step * step));
  }
  return {width: target, height: target, data};
}
function embedTexture(glb, pngData) {
  const b = Buffer.from(glb), jsonLength = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jsonLength));
  const oldBin = b.subarray(28 + jsonLength, 28 + jsonLength + b.readUInt32LE(20 + jsonLength));
  const bin = Buffer.concat([pad(oldBin), pad(pngData)]), imageView = json.bufferViews.length;
  json.bufferViews.push({buffer: 0, byteOffset: pad(oldBin).length, byteLength: pngData.length});
  json.images = [{name: 'WK_Standard_Units', mimeType: 'image/png', bufferView: imageView}];
  json.samplers = [{magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497}];
  json.textures = [{sampler: 0, source: 0}];
  for (const material of json.materials) material.pbrMetallicRoughness.baseColorTexture = {index: 0};
  json.buffers[0].byteLength = bin.length;
  const data = pad(Buffer.from(JSON.stringify(json)), 32), header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546C67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + data.length + bin.length, 8);
  header.writeUInt32LE(data.length, 12); header.writeUInt32LE(0x4E4F534A, 16); binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([header, data, binHeader, bin]);
}

const textureSource = 'models/Materials/textures/WK_Standard_Units.tga';
const tga = new TGALoader().parse(read(textureSource)), texture = resizeTexture(tga), texturePNG = png(texture);
const units = {
  footman: {model: 'WK_SM_Light_Infantry_A.FBX', folder: 'Infantry', prefix: 'WK_infantry', actions: {idle: '01_idle', walk: '02_walk', run: '03_run', attack: '07_attack_A', hit: '09_take_damage', death: '10_death_A'}},
  archer: {model: 'WK_SM_Archer_A.FBX', folder: 'Archer', prefix: 'WK_archer', actions: {idle: '01_idle', walk: '02_walk', run: '03_run', attack: '07_attack', hit: '09_take_damage', death: '10_death_A'}},
  worker: {model: 'WK_Worker_A.FBX', folder: 'Worker', prefix: 'WK_worker', actions: {idle: '01_idle', walk: '02_walk', run: '03_run', attack: '07_attack', hit: '09_take_damage', death: '10_death_A', work: '12_working_A'}}
};
const manifest = {version: 1, generator: 'convert-western.mjs / three@0.160.0', sourcePackage: 'Toon RTS Units 1.4 / WesternKingdoms', axes: {up: '+Y', forward: '+Z'}, normalizedHeight: 1, rootMotion: 'Horizontal translation removed from idle/walk/run; game controls travel.', texture: {source: textureSource, sha256: digest(textureSource), width: texture.width, height: texture.height, sourceWidth: tga.width, sourceHeight: tga.height}, units: {}};
fs.mkdirSync(out, {recursive: true});
for (const [kind, spec] of Object.entries(units)) {
  const modelSource = `models/single_mesh/${spec.model}`, model = fbx(modelSource), clips = [], clipMeta = [];
  model.name = `${kind}_rig`; model.animations = [];
  const material = new T.MeshStandardMaterial({name: 'Western units', color: 0xFFFFFF, metalness: 0, roughness: 0.85});
  let vertices = 0, triangles = 0, meshCount = 0;
  model.traverse(node => { if (node.isMesh) { node.material = material; node.normalizeSkinWeights?.(); vertices += node.geometry.attributes.position.count; triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; meshCount++; } });
  const rest = new Map(); model.traverse(node => rest.set(node.name, {position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray()}));
  for (const [name, suffix] of Object.entries(spec.actions)) {
    const file = `animation/${spec.folder}/${spec.prefix}_${suffix}.FBX`, loaded = fbx(file), clip = loaded.animations[0]?.clone();
    if (!clip) throw new Error(`No animation in ${file}`);
    clip.name = name;
    clip.tracks = clip.tracks.filter(track => {
      const dot = track.name.lastIndexOf('.'), bone = track.name.slice(0, dot), property = track.name.slice(dot + 1), target = rest.get(bone);
      if (!target) throw new Error(`${file}: bone ${bone} missing in ${modelSource}`);
      const size = track.getValueSize();
      if (bone === 'Bip001' && property === 'position' && ['idle', 'walk', 'run'].includes(name)) {
        for (let i = 0; i < track.values.length; i += 3) { track.values[i] = 0; track.values[i + 2] = 0; }
      }
      const precision = property === 'quaternion' ? 1e6 : 1e4;
      for (let i = 0; i < track.values.length; i++) track.values[i] = Math.round(track.values[i] * precision) / precision;
      // Remove redundant rest tracks, especially FBX's per-frame near-unit scale keys.
      return !Array.from(track.values).every((v, i) => Math.abs(v - target[property][i % size]) < (property === 'quaternion' ? 1e-6 : 1e-4));
    });
    clip.optimize(); clips.push(clip); clipMeta.push({name, duration: clip.duration, tracks: clip.tracks.length, loop: ['idle', 'walk', 'run', 'work'].includes(name), source: file, sha256: digest(file)});
  }
  // A stable standing reference establishes size and ground contact for all animations.
  const mixer = new T.AnimationMixer(model), idle = mixer.clipAction(clips[0]); idle.play(); mixer.setTime(0); model.updateMatrixWorld(true);
  model.traverse(node => { if (node.isSkinnedMesh) node.computeBoundingBox(); });
  const bounds = new T.Box3().setFromObject(model), height = bounds.max.y - bounds.min.y;
  if (!(height > 0 && Number.isFinite(height))) throw new Error(`Invalid bounds for ${kind}`);
  idle.stop(); mixer.stopAllAction(); mixer.uncacheRoot(model);
  model.position.y = -bounds.min.y / height; model.scale.setScalar(1 / height);
  const root = new T.Group(); root.name = kind; root.add(model); root.updateMatrixWorld(true);
  const result = await new GLTFExporter().parseAsync(root, {binary: true, animations: clips, trs: true, onlyVisible: true, maxTextureSize: 1024});
  const output = embedTexture(result, texturePNG), file = `${kind}.glb`;
  fs.writeFileSync(path.join(out, file), output);
  manifest.units[kind] = {file, source: modelSource, sha256: digest(modelSource), bytes: output.length, meshes: meshCount, vertices, triangles, sourceStandingHeight: height, sourceGroundY: bounds.min.y, height: 1, animations: clipMeta};
  console.log(`${file}: ${output.length} bytes, ${triangles} triangles, ${clipMeta.map(a => a.name).join(', ')}`);
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
