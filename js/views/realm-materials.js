// Shared surface detail for Keepfall's existing 3D buildings and walls.
// Built once from the imported art, with small tileable maps for previously plain materials.
// Color textures and UVs are preserved; R stores height, G stores roughness. No extra meshes.
const derived = new WeakMap(), generated = new Map();
const SIZE = 256, TAU = Math.PI * 2;

const NORMAL_FILES = {mat_brick: 'tex_brick_normal.webp', timber: 'tex_wood_normal.webp', mat_floorTile: 'tex_floorTile_normal.webp'};
const normalMaps = new Map(), normalUsers = new Map(), surfaceListeners = new Set();
function applyNormal(material, normal) {
  const map = material.map;
  normal.wrapS = map.wrapS; normal.wrapT = map.wrapT;
  normal.repeat.copy(map.repeat); normal.offset.copy(map.offset);
  normal.center.copy(map.center); normal.rotation = map.rotation; normal.channel = map.channel;
  material.normalMap = normal; material.normalScale.setScalar(material.name === 'timber' ? .45 : .65);
  material.needsUpdate = true;
}
let normalsPending = null;
/** Optional authored relief from the same Unity materials; failure keeps the derived bump map. */
export function loadSurfaceMaps(T, onReady) {
  if (onReady) surfaceListeners.add(onReady);
  if (!normalsPending) normalsPending = Promise.all(Object.entries(NORMAL_FILES).map(async ([name, file]) => {
    try {
      const t = await new T.TextureLoader().loadAsync(new URL('../../models/realm/surfaces-v1/' + file, import.meta.url).href);
      t.colorSpace = T.NoColorSpace; t.flipY = false; t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 8; normalMaps.set(name, t);
      normalUsers.get(name)?.forEach(m => applyNormal(m, t));
      surfaceListeners.forEach(f => f());
    } catch (_) { /* Optional detail: a building still renders with its original art and derived relief. */ }
  }));
  return normalsPending;
}

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const hash = (x, y) => {
  let h = Math.imul(x + 37, 374761393) ^ Math.imul(y + 19, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967295;
};
const FAMILY = {
  canvas: 'cloth', banner: 'cloth', 'll-red': 'cloth',
  pole: 'wood', straw: 'straw', boulder: 'stone',
  gold: 'gold', 'll-copper': 'copper', 'll-iron': 'iron',
  'll-earth': 'earth', 'll-sand': 'sand', 'll-grass': 'grass'
};
const IMPORTED = {
  timber: ['wood', .018, .88], mat_brick: ['stone', .026, .94],
  mat_floorTile: ['stone', .022, .93], mat_roof: ['roof', .022, .88],
  WoodenWall: ['wood', .014, .9], Wall1: ['stone', .018, .94],
  Rock1: ['stone', .022, .96], Rock2: ['stone', .022, .96], Rock3: ['stone', .022, .96],
  td_humans_castle: ['masonry', .012, .88], td_humans_sets: ['masonry', .01, .86],
  td_humans_base: ['masonry', .01, .88], House1: ['masonry', .012, .92],
  WoodenHouse: ['wood', .012, .9], Storage: ['wood', .012, .9],
  Tavern: ['masonry', .012, .9], Tavern_interior: ['wood', .01, .9], cart: ['wood', .01, .9]
};
const BUMP = {cloth: .012, wood: .018, straw: .022, stone: .025, gold: .006, copper: .008,
  iron: .009, earth: .024, sand: .012, grass: .018};
const ROUGH = {cloth: .96, wood: .88, straw: .98, stone: .96, gold: .4, copper: .44,
  iron: .65, earth: .98, sand: .98, grass: .98};
function texture(T, bytes, source = null, color = false) {
  const t = new T.DataTexture(bytes, SIZE, SIZE, T.RGBAFormat);
  t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
  t.wrapS = source?.wrapS ?? T.RepeatWrapping; t.wrapT = source?.wrapT ?? T.RepeatWrapping;
  t.flipY = source?.flipY ?? false;
  t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true;
  t.anisotropy = 8;
  if (source) {
    t.repeat.copy(source.repeat); t.offset.copy(source.offset); t.center.copy(source.center);
    t.rotation = source.rotation; t.channel = source.channel;
    t.matrixAutoUpdate = source.matrixAutoUpdate; t.matrix.copy(source.matrix);
  }
  t.needsUpdate = true;
  return t;
}
/** Small height/roughness maps follow the existing atlas exactly, including its orientation and sampler. */
function fromArtwork(T, map, roughness) {
  if (derived.has(map)) return derived.get(map);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(map.image, 0, 0, SIZE, SIZE);
  const input = ctx.getImageData(0, 0, SIZE, SIZE).data, bytes = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < bytes.length; i += 4) {
    const value = (input[i] * .2126 + input[i + 1] * .7152 + input[i + 2] * .0722) / 255;
    // Restrained relief: an atlas's painted shadow must not become a deep gouge.
    bytes[i] = Math.round(255 * (.3 + value * .4));
    bytes[i + 1] = Math.round(255 * clamp(roughness + (.5 - value) * .12));
    bytes[i + 2] = 0; bytes[i + 3] = 255;
  }
  const t = texture(T, bytes, map); derived.set(map, t); return t;
}
/** Neutral albedo multiplies each material's original color. Patterns are periodic at the tile edges. */
function surface(T, family) {
  if (generated.has(family)) return generated.get(family);
  const color = new Uint8Array(SIZE * SIZE * 4), packed = new Uint8Array(color.length);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE, grain = hash(x, y) - .5;
    const broad = Math.sin(TAU * u + .6 * Math.sin(TAU * v)) * Math.cos(TAU * v * 2);
    let height = .5 + grain * .13, tone = .93 + grain * .06 + broad * .025, rough = ROUGH[family];
    let red = 1, green = 1, blue = 1;
    if (family === 'cloth') {
      const weave = Math.sin(TAU * u * 32) * Math.sin(TAU * v * 32);
      height += weave * .13;
      tone += weave * .035 + Math.sin(TAU * u * 4) * .015;
    } else if (family === 'wood' || family === 'straw') {
      const line = Math.sin(TAU * u * (family === 'wood' ? 14 : 28) + Math.sin(TAU * v * 2) * .65);
      const fiber = Math.pow(Math.max(0, line), 10);
      height -= fiber * .22; tone -= fiber * .15; rough += fiber * .04;
    } else if (family === 'gold' || family === 'copper' || family === 'iron') {
      const hammered = Math.sin(TAU * u * 19) * Math.sin(TAU * v * 21);
      height += hammered * .035; rough += broad * .1 + grain * .1;
      tone += broad * .035;
      if (family === 'copper') { const age = clamp((broad - .3) * .4); red -= age * .4; blue += age * .2; }
    } else {
      const fleck = hash(Math.floor(x / 3), Math.floor(y / 3));
      height += broad * .12 + (fleck - .5) * .19;
      tone += broad * .045 + (fleck - .5) * .1;
      if (family === 'grass') {
        const blade = Math.max(0, Math.sin(TAU * u * 23 + Math.sin(TAU * v * 3)));
        tone -= blade ** 8 * .12; height += blade * .08;
      }
    }
    const at = (y * SIZE + x) * 4;
    color[at] = Math.round(clamp(tone * red) * 255);
    color[at + 1] = Math.round(clamp(tone * green) * 255);
    color[at + 2] = Math.round(clamp(tone * blue) * 255); color[at + 3] = 255;
    packed[at] = Math.round(clamp(height) * 255); packed[at + 1] = Math.round(clamp(rough) * 255);
    packed[at + 2] = 0; packed[at + 3] = 255;
  }
  const pair = {map: texture(T, color, null, true), detail: texture(T, packed)};
  generated.set(family, pair); return pair;
}
/** Idempotent: materials stay shared across levels, walls, thumbnails, visits and raids. */
export function enhanceMaterial(T, material) {
  if (!material?.isMeshStandardMaterial || material.userData.keepSurface) return material;
  const spec = IMPORTED[material.name], family = spec?.[0] || FAMILY[material.name];
  if (!family || material.transparent || material.alphaTest > 0) return material;
  try {
    let detail, generatedColor = false;
    if (material.map?.image) {
      if (!spec) return material;
      detail = fromArtwork(T, material.map, spec[2]);
      material.map.anisotropy = 8;
    } else if (!material.map && FAMILY[material.name]) {
      const pair = surface(T, family);
      material.map = pair.map; detail = pair.detail; generatedColor = true;
    } else return material;
    material.bumpMap = detail; material.bumpScale = spec?.[1] ?? BUMP[family];
    material.roughnessMap = detail; material.roughness = 1;
    if (NORMAL_FILES[material.name] && material.map) {
      if (!normalUsers.has(material.name)) normalUsers.set(material.name, new Set());
      normalUsers.get(material.name).add(material);
      const normal = normalMaps.get(material.name);
      if (normal) applyNormal(material, normal);
    }
    material.userData.keepSurface = {family, generated: generatedColor, size: SIZE};
    material.needsUpdate = true;
  } catch (error) {
    // An unreadable image must keep its working original material, never hide a building.
    console.warn('Keepfall: original surface retained for ' + material.name, error);
  }
  return material;
}
