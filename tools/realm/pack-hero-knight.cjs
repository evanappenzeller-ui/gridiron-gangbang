// Convert the supplied Bulky Knight glTF download into one mobile-sized, local GLB.
// Usage: node tools/realm/pack-hero-knight.cjs <extracted zip directory>
const fs = require('node:fs'), path = require('node:path');
let sharp;
try { sharp = require('sharp'); } catch (_) { sharp = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }
const src = process.argv[2], out = path.resolve(__dirname, '../../img/realm/heroes/bulky-knight-v1');
if (!src) throw Error('Pass the extracted bulky_knight.zip directory.');
const pad = (b, value = 0) => Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4, value)]);
(async () => {
  const doc = JSON.parse(fs.readFileSync(path.join(src, 'scene.gltf')));
  const chunks = [pad(fs.readFileSync(path.join(src, doc.buffers[0].uri)))];
  let length = chunks[0].length;
  for (const im of doc.images) {
    const data = await sharp(path.join(src, im.uri)).resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true}).removeAlpha().jpeg({quality: 88, chromaSubsampling: '4:4:4'}).toBuffer();
    const bv = doc.bufferViews.length;
    doc.bufferViews.push({buffer: 0, byteOffset: length, byteLength: data.length});
    chunks.push(pad(data)); length += chunks[chunks.length - 1].length;
    delete im.uri; im.bufferView = bv; im.mimeType = 'image/jpeg';
  }
  doc.buffers = [{byteLength: length}];
  doc.asset.extras.modifications = 'Textures resized to at most 1024px and encoded as JPEG; packed as GLB. Geometry and original materials retained.';
  const json = pad(Buffer.from(JSON.stringify(doc)), 32), bin = Buffer.concat(chunks);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + json.length + bin.length, 8);
  jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, 'knight.glb'), Buffer.concat([head, jh, json, bh, bin]));
  fs.copyFileSync(path.join(src, 'license.txt'), path.join(out, 'license.txt'));
  console.log(JSON.stringify({file: path.join(out, 'knight.glb'), bytes: 28 + json.length + bin.length, meshes: doc.meshes.length, animations: (doc.animations || []).length}));
})().catch(e => { console.error(e); process.exitCode = 1; });
