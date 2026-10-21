// Evan's City bus art pilot. Merely importing this module never requests art.
// The app uses a selected profile (data.isOwner), not a verified personal login.
import * as data from '../core/data.js';

let T = null, changed = () => {}, subscribed = false, attempt = null, materials = null, tried = false;
const FILES = ['bus-rear-v1.webp', 'bus-side-v1.webp', 'bus-roof-v1.webp'];

export function init(three, onChange) {
  T = three; changed = onChange;
  if (!subscribed) {
    subscribed = true;
    // The world survives view remounts, including while Return Man is hidden.
    data.subscribe(type => { if (type === 'me') revoke(true); });
  }
}

function release(load) {
  if (!load) return;
  load.abort.abort();
  load.textures.forEach(t => { t.dispose(); t.image.close(); });
  load.textures.length = 0;
}

function revoke(profileChanged = false) {
  // Entering Evan's profile must also invalidate legacy buses already in LIVE,
  // otherwise their cached geometry would never call body()/ensure() again.
  if (!profileChanged && !tried && !attempt && !materials) return;
  const old = attempt, oldMaterials = materials;
  attempt = null; materials = null; tried = false;
  // Remove scene objects before disposing their shared materials/textures.
  changed();
  if (oldMaterials) oldMaterials.forEach(m => m.dispose());
  release(old);
}

/** Also check per frame, in case the selected profile disappeared without an event. */
export function sync() {
  if (!data.isOwner()) revoke();
}

const current = load => attempt === load && !load.abort.signal.aborted && data.isOwner();
async function texture(load, file, index) {
  if (!current(load)) throw new Error('City bus profile changed');
  const url = new URL('../../img/return/city/' + file, import.meta.url);
  const response = await fetch(url, {signal: load.abort.signal});
  if (!response.ok) throw new Error('City bus image unavailable');
  const blob = await response.blob();
  if (!current(load)) throw new Error('City bus profile changed');
  // ImageBitmap ignores Texture.flipY; orient the pixels when decoding instead.
  const bitmap = await createImageBitmap(blob, {imageOrientation: 'flipY'});
  if (!current(load)) { bitmap.close(); throw new Error('City bus profile changed'); }
  const t = new T.Texture(bitmap);
  t.flipY = false; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  if (index === 1) t.wrapS = T.RepeatWrapping;
  if (index === 2) t.wrapT = T.RepeatWrapping;
  t.needsUpdate = true;
  load.textures.push(t);
  return t;
}

function ensure() {
  if (!T || !data.isOwner() || tried) return;
  tried = true;
  const load = {abort: new AbortController(), textures: []};
  attempt = load;
  Promise.all(FILES.map((file, i) => texture(load, file, i))).then(textures => {
    if (!current(load)) { release(load); return; }
    materials = textures.map(map => new T.MeshStandardMaterial({map, color: 0xffffff, roughness: 1, metalness: 0}));
    materials.push(new T.MeshStandardMaterial({color: '#F2E8D8', roughness: 1, metalness: 0}));
    changed();
  }).catch(() => {
    // Keep the original bus on a failed/offline load. Do not retry every frame.
    if (attempt === load) attempt = null;
    release(load);
  });
}

/** A UV body for the existing footprint. All buses share materials; repeats live in each geometry. */
export function body(V) {
  sync();
  if (!data.isOwner()) return null;
  ensure();
  if (!materials) return null;
  const {x0, x1, y1, z0, z1} = V, lo = .35, near = -z0, far = -z1, len = z1 - z0;
  const positions = [], normals = [], uvs = [], geometry = new T.BufferGeometry();
  const quad = (points, uv, normal) => {
    [0, 1, 2, 0, 2, 3].forEach(i => { positions.push(...points[i]); normals.push(...normal); uvs.push(...uv[i]); });
  };
  const group = (index, make) => {
    const start = positions.length / 3; make();
    geometry.addGroup(start, positions.length / 3 - start, index);
  };
  const faceUV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const count = Math.max(1, Math.ceil(len / 2)); // short strips follow the curved-world vertex shader
  group(0, () => quad([[x0, lo, near], [x1, lo, near], [x1, y1, near], [x0, y1, near]], faceUV, [0, 0, 1]));
  group(1, () => {
    for (let i = 0; i < count; i++) {
      const a = len * i / count, b = len * (i + 1) / count, za = near - a, zb = near - b;
      quad([[x1, lo, za], [x1, lo, zb], [x1, y1, zb], [x1, y1, za]], [[a / 3, 0], [b / 3, 0], [b / 3, 1], [a / 3, 1]], [1, 0, 0]);
      quad([[x0, lo, zb], [x0, lo, za], [x0, y1, za], [x0, y1, zb]], [[(len - b) / 3, 0], [(len - a) / 3, 0], [(len - a) / 3, 1], [(len - b) / 3, 1]], [-1, 0, 0]);
    }
  });
  group(2, () => {
    for (let i = 0; i < count; i++) {
      const a = len * i / count, b = len * (i + 1) / count;
      quad([[x0, y1, near - a], [x1, y1, near - a], [x1, y1, near - b], [x0, y1, near - b]], [[0, a / 2.5], [1, a / 2.5], [1, b / 2.5], [0, b / 2.5]], [0, 1, 0]);
    }
  });
  group(3, () => {
    quad([[x1, lo, far], [x0, lo, far], [x0, y1, far], [x1, y1, far]], faceUV, [0, 0, -1]);
    for (let i = 0; i < count; i++) {
      const a = near - len * i / count, b = near - len * (i + 1) / count;
      quad([[x0, lo, b], [x1, lo, b], [x1, lo, a], [x0, lo, a]], faceUV, [0, -1, 0]);
    }
  });
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, materials);
  mesh.name = 'city-bus-pilot-body'; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
