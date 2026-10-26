// Keepfall's land in 3D (the full 3D Keepfall, Oct 25 2026: the owner's ask, "remove the super wide 2d picture i am
// currently using for the scenery"). Real terrain round the lot instead of a painting: the lot flat at y 0 (its 44 x 44
// tiles centred on the origin, as views/realm-3d.js lays them), meadows and rolling hills round it, mountains rising
// behind it (the camera looks from +x +z), each scenery (core/realm.js SCENERIES) its own land: the coast's sea on the
// left, the forest's river and dark woods, the tundra's snow and icy sea, the ocean's island, the desert's sand and
// oasis, the infernal wastes' ash and lava. Its ground is the Unity packs' tiling textures (models/realm/world-v1/
// textures), its trees, rocks and plants their models (nature.glb, tools/realm/convert-world.mjs), instanced: a few
// draw calls whatever the count. Until they're in (or if they fail) plain 3D pines and rocks stand in.
// createWorld(T, scene, {theme, onChange}) → {group, theme, setTheme, heightAt, light, ground (for realm-wildlife.js),
// extent, dispose}. Scenery only: nothing here is picked, collides or touches a save.
const AT = new URL('../../models/realm/world-v1/', import.meta.url).href;
const V = new URL('../vendor/three/', import.meta.url).href;
const SIZE = 440, SEG = 150, LOT = 22; // (the land's side, its grid; the lot's half-side, tiles)
const YAW = Math.PI / 4;
let UP = null; // (the y axis, once three.js is in)
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- each land: its ground's tints (grass, soil, rock, road), snow, water (kind, colour), sky, light and plants
const THEMES = {
  coast: {tint: [[.64, .74, .52], [.86, .8, .72], [.9, .9, .9], [.88, .84, .78]], snow: 0, water: {kind: 'sea', color: 0x2b5f74}, sky: [0x5f7c98, 0xaeb9bc], fog: 0xa6b2b4,
    sun: [0xffd9ae, 2.35], hemi: [0xc6d2de, 0x3a4630, .72], trees: {pine3: 5, pine1: 2, oak1: 1, birch1: 1, deciduous1: 1}, forest: 1, rocks: 1},
  christmas: {tint: [[.92, .95, 1.02], [.9, .9, .95], [.88, .9, .95], [.9, .9, .95]], snow: .64, water: {kind: 'sea', color: 0x5d8098, ice: true},
    sky: [0x3d4c72, 0x9aa6bc], fog: 0x9aa4b8, sun: [0xffd6b0, 1.55], hemi: [0xb8c6de, 0x4a5468, .8], trees: {pine1: 4, pine2: 3, pine3: 4}, forest: 1.1, rocks: .8, frost: .55},
  forest: {tint: [[.42, .55, .44], [.6, .56, .52], [.7, .74, .72], [.66, .64, .6]], snow: 0, water: {kind: 'river', color: 0x1f5a5e, glow: 0x1a6a62},
    sky: [0x1d2848, 0x4a5a74], fog: 0x46536a, sun: [0xb4c8f0, 1.35], hemi: [0x8ea2c4, 0x1e2a1e, .7], trees: {pine1: 4, pine2: 3, deciduous1: 2, deciduous2: 2, willow1: 1, oak2: 1}, forest: 1.7, rocks: 1},
  tundra: {tint: [[.95, .98, 1.04], [.9, .92, .96], [.86, .9, .95], [.9, .92, .96]], snow: .6, water: {kind: 'sea', color: 0x5f8aa2, ice: true},
    sky: [0x6d88a8, 0xc4ced8], fog: 0xbcc7d2, sun: [0xfff0dc, 1.8], hemi: [0xd2deea, 0x66768a, .85], trees: {pine1: 4, pine2: 3, pine3: 4}, forest: .8, rocks: 1.3, frost: .5},
  ocean: {tint: [[1.05, 1.08, .92], [1.32, 1.18, .86], [1.05, 1.02, .95], [1.25, 1.12, .88]], snow: 0, water: {kind: 'island', color: 0x1f9aa6},
    sky: [0x5aa2d6, 0xcfe6ef], fog: 0xc4dfe6, sun: [0xfff0d6, 2.8], hemi: [0xe6f2fa, 0x5a7a52, .85], trees: {oak1: 2, birch1: 2, deciduous1: 2, willow1: 1}, forest: .6, rocks: .7, sand: 1},
  desert: {tint: [[1.12, .95, .7], [1.12, .92, .7], [1.1, .78, .6], [1.08, .9, .7]], snow: 0, grass: .12, water: {kind: 'oasis', color: 0x2a8a8c},
    sky: [0xc77b52, 0xf2c48e], fog: 0xe3b48a, sun: [0xffc48a, 2.5], hemi: [0xf6dcc0, 0x8a5a3a, .8], trees: {pineStump: 1, stump: 2}, forest: .25, rocks: 2.2, oasisTrees: {willow1: 1, oak2: 1}},
  infernal: {tint: [[.42, .34, .32], [.62, .36, .26], [.5, .42, .4], [.5, .4, .36]], snow: 0, grass: 0, water: {kind: 'lava', color: 0xff5214},
    sky: [0x1c1014, 0x6a2a1e], fog: 0x4a2620, sun: [0xff9f72, 1.7], hemi: [0xb87a6a, 0x2a1210, .7], trees: {pineStump: 2, stump: 2}, forest: .35, rocks: 2, volcano: true}
};
export const themeOf = k => THEMES[k] ? k : 'coast';

// ---- noise (deterministic: every phone sees the same land)
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise(x, y, s = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 1) => noise(x, y, s) * .55 + noise(x * 2.1, y * 2.1, s + 7) * .3 + noise(x * 4.3, y * 4.3, s + 13) * .15;
const rngOf = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** The land's shape for theme k: {height(x, z), water(x, z) (0-1: how much it's under water), road(x, z) (0-1)}. */
function shapeOf(k) {
  const W = THEMES[k].water.kind;
  // a road out of each side the camera sees, winding a little
  const roads = [t => ({x: 8 + Math.sin(t * .05) * 6, z: t}), t => ({x: -t, z: -6 + Math.sin(t * .045 + 1) * 7})];
  const road = (x, z) => {
    if (Math.max(Math.abs(x), Math.abs(z)) < LOT + 2) return 0;
    let best = 99;
    for (const r of roads) {
      // (each road runs outward along its own axis: its distance from the lot is that coordinate)
      const t = r === roads[0] ? z : -x;
      if (t < LOT) continue;
      const p = r(t); best = Math.min(best, Math.hypot(p.x - x, p.z - z));
    }
    return 1 - smooth(1.4, 3.2, best);
  };
  const water = (x, z) => {
    const u = (-x + z) / Math.SQRT2, rr = Math.max(Math.abs(x), Math.abs(z)) * .6 + Math.hypot(x, z) * .4;
    if (W === 'sea') return smooth(54 + fbm(z * .03, x * .03, 3) * 10, 66 + fbm(z * .03, x * .03, 3) * 10, u);
    if (W === 'island') return smooth(52 + fbm(x * .04, z * .04, 5) * 9, 64 + fbm(x * .04, z * .04, 5) * 9, rr);
    if (W === 'river') { const c = -48 + Math.sin(z * .045) * 9 + Math.sin(z * .013 + 2) * 6; return 1 - smooth(4, 8, Math.abs(x - c)); }
    if (W === 'lava') { const ring = Math.abs(rr - 62 - Math.sin(Math.atan2(z, x) * 5) * 3); return 1 - smooth(3.5, 7.5, ring); }
    if (W === 'oasis') return 1 - smooth(8, 13, Math.hypot(x + 58, z - 34));
    return 0;
  };
  const height = (x, z) => {
    const r = Math.max(Math.abs(x), Math.abs(z)), d = Math.hypot(x, z);
    const near = smooth(LOT + 5, LOT + 26, r);
    let h = near * Math.max(-.35, (fbm(x * .03, z * .03, 2) - .28) * 5.5);
    // mountains behind the lot (away from the camera), lower hills in front of it
    const back = smooth(-30, 90, -(x + z) / Math.SQRT2);
    h += smooth(58, 160, d) * (6 + 32 * fbm(x * .018 + 4, z * .018 + 9, 3)) * (.25 + .75 * back);
    // (the infernal wastes' volcano, behind on the left; its crater a hollow)
    if (THEMES[k].volcano) { const v = Math.hypot(x + 120, z + 110); h += Math.max(0, 46 - v * .5) - (v < 10 ? (10 - v) * 1.4 : 0); }
    if (k === 'desert') h += near * Math.max(0, fbm(x * .05, z * .05, 11) - .55) * 9; // (mesas)
    const w = water(x, z);
    if (w > 0) h = h * (1 - w) + (W === 'lava' ? -1.3 : -3.2) * w;
    const rd = road(x, z);
    if (rd > 0) h *= 1 - rd * .7;
    return h;
  };
  return {height, water, road};
}

/** The sky behind the land: its colour high up fading to the haze at the horizon (the fog's), drawn behind all. */
function skyTexture(T, top, horizon) {
  const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  const hex = c => '#' + new T.Color(c).getHexString();
  gr.addColorStop(0, hex(top)); gr.addColorStop(.55, hex(new T.Color(top).lerp(new T.Color(horizon), .6))); gr.addColorStop(1, hex(horizon));
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
  return t;
}

// ---- the ground's textures (shared by every view; loaded once)
const GROUND = ['ground_grass', 'ground_soil', 'ground_rock', 'ground_stones'];
let groundTex = null;
function groundTextures(T, maxAniso, onReady) {
  // (told once they're in: never during the call, the caller may not be ready for it yet)
  if (groundTex) { if (groundTex.ready) queueMicrotask(onReady); else groundTex.wait.push(onReady); return groundTex; }
  const loader = new T.TextureLoader();
  groundTex = {list: [], ready: false, wait: [onReady]};
  let left = GROUND.length;
  GROUND.forEach((name, i) => {
    const t = loader.load(AT + 'textures/' + name + '.jpg', () => { if (--left === 0) { groundTex.ready = true; groundTex.wait.splice(0).forEach(f => f()); } },
      undefined, () => { groundTex.failed = true; if (--left === 0) { groundTex.ready = true; groundTex.wait.splice(0).forEach(f => f()); } });
    t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = Math.min(8, maxAniso);
    groundTex.list[i] = t;
  });
  return groundTex;
}
/** The terrain's material: four textures blended by each vertex's weights, tinted for its land; snow on the flats. */
function groundMaterial(T, tex, theme) {
  const m = new T.MeshStandardMaterial({color: 0xffffff, roughness: .97, metalness: 0, vertexColors: true});
  const U = {tSoil: {value: tex.list[1]}, tRock: {value: tex.list[2]}, tRoad: {value: tex.list[3]}, tGrass: {value: tex.list[0]},
    tint0: {value: new T.Vector3(...theme.tint[0])}, tint1: {value: new T.Vector3(...theme.tint[1])}, tint2: {value: new T.Vector3(...theme.tint[2])},
    tint3: {value: new T.Vector3(...theme.tint[3])}, snow: {value: theme.snow || 0}};
  m.userData.uniforms = U;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = 'attribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWorld;\nvarying float vFlat;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vWorld = (modelMatrix * vec4(position, 1.0)).xyz; vFlat = normal.y;');
    shader.fragmentShader = 'uniform sampler2D tGrass, tSoil, tRock, tRoad;\nuniform vec3 tint0, tint1, tint2, tint3;\nuniform float snow;\nvarying vec4 vSplat;\nvarying vec3 vWorld;\nvarying float vFlat;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 wuv = vWorld.xz * 0.075;
        // (grass sampled twice, at scales and angles apart, so its tiling never lines up)
        vec3 cg = mix(texture2D(tGrass, wuv).rgb, texture2D(tGrass, vec2(wuv.y, -wuv.x) * 0.43 + 0.37).rgb, 0.45) * tint0, cs = texture2D(tSoil, wuv * 1.3).rgb * tint1;
        vec3 cr = texture2D(tRock, wuv * 0.7).rgb * tint2, cd = texture2D(tRoad, wuv * 1.6).rgb * tint3;
        vec4 w = max(vSplat, 0.0); w /= max(0.0001, w.x + w.y + w.z + w.w);
        vec3 col = cg * w.x + cs * w.y + cr * w.z + cd * w.w;
        float sn = snow * smoothstep(0.55, 0.85, vFlat) * (1.0 - w.w * 0.6);
        col = mix(col, vec3(0.8, 0.84, 0.9), sn);
        diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => 'keepfall-ground-v1';
  return m;
}

// ---- the nature models (shared by every view; loaded once): name → {parts: [[geometry, material]], height, width}
let nature = null, natureLoading = null;
function loadNature(T) {
  if (nature) return Promise.resolve(nature);
  if (natureLoading) return natureLoading;
  natureLoading = (async () => {
    try {
      const {GLTFLoader} = await import(V + 'GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(AT + 'nature.glb');
      // (a texture that didn't come would draw the trees white: the plain ones instead)
      const json = gltf.parser.json.materials || [];
      gltf.scene.traverse(o => { if (o.isMesh && json[gltf.parser.associations.get(o.material)?.materials]?.pbrMetallicRoughness?.baseColorTexture && !o.material.map?.image) throw Error('Incomplete tree texture'); });
      gltf.scene.updateMatrixWorld(true);
      const out = {};
      gltf.scene.children.forEach(node => {
        const parts = [], inv = new T.Matrix4().copy(node.matrixWorld).invert();
        node.traverse(o => {
          if (!o.isMesh) return;
          // (leaves both sides, a little deeper green than they're lit in Unity: under this sun they wash out)
          if (o.material.alphaTest > 0) { o.material.side = T.DoubleSide; o.material.color.multiplyScalar(.72); }
          parts.push([o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)), o.material]);
        });
        const box = new T.Box3(); parts.forEach(([g]) => { g.computeBoundingBox(); box.union(g.boundingBox); });
        const size = box.getSize(new T.Vector3());
        out[node.name] = {parts, height: size.y, width: Math.max(size.x, size.z)};
      });
      nature = out;
      return out;
    } catch (e) { console.warn('Keepfall: plain 3D trees', e); return null; } finally { natureLoading = null; }
  })();
  return natureLoading;
}

/**
 * The land for scenery `theme` in `scene`. onChange(): something new to draw (its models came in).
 */
export function createWorld(T, scene, {theme = 'coast', onChange = () => {}, maxAnisotropy = 4, detail = 1} = {}) {
  UP = UP || new T.Vector3(0, 1, 0);
  const group = new T.Group(); group.name = 'keep-world'; scene.add(group);
  let key = themeOf(theme), shape = shapeOf(key), dead = false, built = null;
  const owned = []; // (geometries and materials made here, freed on a new theme)
  const own = x => { owned.push(x); return x; };
  const tex = groundTextures(T, maxAnisotropy, () => { if (!dead) onChange(); });

  function terrain() {
    const g = own(new T.PlaneGeometry(SIZE, SIZE, SEG, SEG)); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, splat = new Float32Array(p.count * 4), Th = THEMES[key];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = shape.height(x, z);
      p.setY(i, h);
      const r = Math.max(Math.abs(x), Math.abs(z)), rd = shape.road(x, z), wet = shape.water(x, z);
      const soil = clamp((noise(x * .06, z * .06, 17) - .6) * 1.6) * .7 * smooth(LOT + 1, LOT + 8, r) + (Th.sand ? wet * 1.6 + smooth(.05, .3, wet) : 0) + wet * .5 + (Th.grass === undefined ? 0 : 1 - Th.grass);
      // (a trodden ring round the lot, as round a camp: the base reads as a place apart)
      const ring = (1 - smooth(1.2, 3.2, Math.abs(r - LOT - 2.2))) * .55;
      splat.set([Th.grass === 0 ? 0 : Math.max(0, 1 - soil) * (Th.grass ?? 1), soil + ring, 0, rd + ring * .6], i * 4);
    }
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const steep = 1 - n.getY(i), hgt = p.getY(i);
      splat[i * 4 + 2] = smooth(.12, .35, steep) * 3 + smooth(14, 26, hgt) * 2;
    }
    g.setAttribute('splat', new T.BufferAttribute(splat, 4));
    // (its light and shade: broad soft variation so no tiling shows from afar, darker under the woods)
    const tone = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.max(Math.abs(x), Math.abs(z));
      const v = .78 + .3 * fbm(x * .012, z * .012, 31) - .14 * smooth(.45, .65, fbm(x * .028, z * .028, 21)) * smooth(LOT + 4, LOT + 14, r);
      tone.set([v, v, v * .97], i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(tone, 3));
    const mesh = new T.Mesh(g, own(groundMaterial(T, tex, Th)));
    mesh.receiveShadow = true; mesh.name = 'keep-terrain'; mesh.position.y = -.015; mesh.raycast = () => {};
    return mesh;
  }
  function waterPlane() {
    const W = THEMES[key].water; if (!W.kind) return null;
    const lava = W.kind === 'lava';
    const m = own(new T.MeshStandardMaterial({color: W.color, roughness: W.ice ? .55 : lava ? .8 : .12, metalness: W.ice || lava ? 0 : .25,
      emissive: lava ? 0xff3a08 : W.glow || 0x000000, emissiveIntensity: lava ? 1.25 : W.glow ? .35 : 0, transparent: !lava, opacity: W.ice ? .94 : .9}));
    const mesh = new T.Mesh(own(new T.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2)), m);
    mesh.position.y = lava ? -.75 : -.7; mesh.name = 'keep-water'; mesh.raycast = () => {};
    return mesh;
  }
  /** Where things grow: [{x, z, s (scale), r (turn)}] by name, deterministic for the land. */
  function placements() {
    const Th = THEMES[key], R = rngOf(4242 + key.length * 97), out = {};
    const ok = (x, z, clear = 4) => Math.max(Math.abs(x), Math.abs(z)) > LOT + clear && shape.water(x, z) < .05 && shape.road(x, z) < .05 && Math.abs(x) < SIZE / 2 - 10 && Math.abs(z) < SIZE / 2 - 10;
    const put = (name, x, z, s) => { (out[name] ||= []).push({x, z, y: shape.height(x, z), s, r: R() * Math.PI * 2}); };
    const pick = table => { const e = Object.entries(table), total = e.reduce((a, [, w]) => a + w, 0); let v = R() * total; for (const [n, w] of e) if ((v -= w) <= 0) return n; return e[0][0]; };
    // trees: groves round the lot (a few lone trees in the meadows between), woods further out where the forest noise
    // is high. The imported trees within ~70 tiles, plain ones beyond, where they're seen small.
    const woods = (x, z) => fbm(x * .028, z * .028, 21);
    // (at most ~240 detailed trees whatever the land: the rest of a thick wood is the plain ones)
    const near = Math.round(Math.min(240, 220 * Th.forest) * detail), far = Math.round(1100 * Th.forest * detail);
    for (let g = 0, n = 0; g < 400 && n < near; g++) {
      const a = R() * Math.PI * 2, d = LOT + 8 + Math.pow(R(), .8) * 52, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
      if (!ok(cx, cz, 8)) continue;
      const size = 6 + Math.floor(R() * 12), radius = 3 + size * .45;
      for (let i = 0; i < size * 3 && n < near; i++) {
        const b = R() * Math.PI * 2, r = Math.sqrt(R()) * radius, x = cx + Math.cos(b) * r, z = cz + Math.sin(b) * r;
        if (!ok(x, z, 6)) continue;
        put(pick(Th.trees), x, z, .75 + R() * .55); n++;
        if (i > size) break;
      }
    }
    for (let i = 0, n = 0; i < 400 && n < 24 * Th.forest; i++) {
      const a = R() * Math.PI * 2, d = LOT + 6 + R() * 50, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (ok(x, z, 6)) { put(pick(Th.trees), x, z, .8 + R() * .4); n++; }
    }
    for (let i = 0, n = 0; i < far * 25 && n < far; i++) {
      const a = R() * Math.PI * 2, d = 72 + Math.pow(R(), .8) * 150, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z) || woods(x, z) < .44 - (d - 72) * .0012) continue;
      put('farTree', x, z, .85 + R() * .8); n++;
    }
    if (Th.oasisTrees) for (let i = 0; i < 9; i++) { const a = R() * Math.PI * 2, d = 13 + R() * 6; put(pick(Th.oasisTrees), -58 + Math.cos(a) * d, 34 + Math.sin(a) * d, .7 + R() * .3); }
    // rocks: scattered near, boulders on the hills, crags on the mountains
    for (let i = 0, n = 0; i < 600 && n < 40 * Th.rocks; i++) {
      const a = R() * Math.PI * 2, d = LOT + 6 + R() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z)) continue;
      put(['rock1', 'rock2', 'rock3', 'stone1', 'stone2', 'stone3'][Math.floor(R() * 6)], x, z, .1 + R() * .22); n++;
    }
    for (let i = 0, n = 0; i < 400 && n < 26; i++) {
      const a = R() * Math.PI * 2, d = 110 + R() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z) || -(x + z) < 0) continue;
      put(['rock1', 'rock3'][n % 2], x, z, .45 + R() * .8); n++;
    }
    return out;
  }
  // world units a metre (a man ~1.15 tall): trees and rocks drawn at a game's scale, not life size
  const METRE = {tree: .3, rock: 1, cover: .8};
  function instanced(name, list, asset) {
    const g = new T.Group(); g.name = 'keep-nature-' + name;
    const m4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), v = new T.Vector3(), sc = new T.Vector3();
    const tree = /pine|oak|birch|deciduous|willow|tree|Stump|stump/.test(name), cover = /grass|fern|flower|bush|mushroom|rye/.test(name);
    const unit = tree ? METRE.tree : cover ? METRE.cover : METRE.rock;
    const frost = THEMES[key].frost;
    asset.parts.forEach(([geometry, material]) => {
      let mat = material;
      if (frost && material.alphaTest > 0) { mat = own(material.clone()); mat.color.lerp(new T.Color(0xf2f6fa), frost); }
      if (key === 'desert' && /Rock|Stone|rock|stone/.test(material.name)) { mat = own(material.clone()); mat.color.setRGB(1.25, .82, .62); }
      if (key === 'infernal' && /Rock|Stone|rock|stone/.test(material.name)) { mat = own(material.clone()); mat.color.setRGB(.55, .42, .4); }
      const mesh = new T.InstancedMesh(geometry, mat, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.r); const s = p.s * unit; sc.set(s, s, s);
        mesh.setMatrixAt(i, m4.compose(v.set(p.x, p.y - .05, p.z), q, sc));
      });
      mesh.computeBoundingSphere(); mesh.raycast = () => {};
      mesh.castShadow = false; mesh.receiveShadow = !cover;
      g.add(mesh);
    });
    return g;
  }
  /** Plain 3D stand-ins: tiered cones for trees, faceted lumps for rocks (and the far woods always). */
  function plain(list, rock) {
    const g = new T.Group();
    const needles = own(new T.MeshStandardMaterial({color: THEMES[key].frost ? 0xb8c8c6 : key === 'infernal' ? 0x2a2220 : key === 'desert' ? 0x6a5a3a : 0x27472c, roughness: .9, flatShading: true}));
    const bark = own(new T.MeshStandardMaterial({color: 0x4f3626, roughness: .9}));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
    if (rock) {
      const mesh = new T.InstancedMesh(own(new T.DodecahedronGeometry(3, 0)), own(new T.MeshStandardMaterial({color: key === 'desert' ? 0xa86a4a : key === 'infernal' ? 0x3a2e2c : 0x7a7a74, roughness: 1, flatShading: true})), list.length);
      list.forEach((p, i) => mesh.setMatrixAt(i, m4.compose(v.set(p.x, p.y + p.s, p.z), q.setFromAxisAngle(new T.Vector3(.3, 1, .2).normalize(), p.r), sc.set(p.s * 1.4, p.s * .8, p.s))));
      mesh.raycast = () => {}; g.add(mesh); return g;
    }
    const tiers = [own(new T.ConeGeometry(1.5, 2.4, 7)), own(new T.ConeGeometry(1.1, 2, 7))], crown = own(new T.IcosahedronGeometry(1.7, 0)), trunk = own(new T.CylinderGeometry(.18, .24, 1.2, 6));
    const dead = key === 'desert' || key === 'infernal', c = new T.Color(), base = needles.color.clone();
    needles.color.set(0xffffff);
    // (pines in two tiers, a third of them broadleaf crowns; each its own shade of the land's green)
    const shade = (mesh, i, p) => mesh.setColorAt(i, c.copy(base).multiplyScalar(.75 + ((p.r * 7.3) % 1) * .5));
    if (dead) {
      const mesh = new T.InstancedMesh(trunk, bark, list.length);
      list.forEach((p, i) => mesh.setMatrixAt(i, m4.compose(v.set(p.x, p.y + .6 * p.s, p.z), q.identity(), sc.set(p.s, p.s * 1.4, p.s))));
      mesh.raycast = () => {}; g.add(mesh);
    } else {
      const broad = list.filter((p, i) => i % 3 === 0), pines = list.filter((p, i) => i % 3 !== 0);
      tiers.forEach((tg, j) => {
        const mesh = new T.InstancedMesh(tg, needles, Math.max(1, pines.length)); mesh.count = pines.length;
        pines.forEach((p, i) => { mesh.setMatrixAt(i, m4.compose(v.set(p.x, p.y + (2 + j * 1.3) * p.s, p.z), q.setFromAxisAngle(UP, p.r), sc.set(p.s, p.s * 1.15, p.s))); shade(mesh, i, p); });
        mesh.raycast = () => {}; g.add(mesh);
      });
      const crowns = new T.InstancedMesh(crown, needles, Math.max(1, broad.length)); crowns.count = broad.length;
      broad.forEach((p, i) => { crowns.setMatrixAt(i, m4.compose(v.set(p.x, p.y + 2.6 * p.s, p.z), q.setFromAxisAngle(UP, p.r), sc.set(p.s * 1.1, p.s * .95, p.s * 1.1))); c.copy(base).lerp(new T.Color(0x5a6e2c), .45).multiplyScalar(.8 + ((p.r * 5.1) % 1) * .4); crowns.setColorAt(i, c); });
      crowns.raycast = () => {}; g.add(crowns);
    }
    if (!dead) {
      const tr = new T.InstancedMesh(trunk, bark, list.length);
      list.forEach((p, i) => tr.setMatrixAt(i, m4.compose(v.set(p.x, p.y + .6 * p.s, p.z), q.identity(), sc.set(p.s, p.s, p.s))));
      tr.raycast = () => {}; g.add(tr);
    }
    return g;
  }
  function volcano() {
    const g = new T.Group();
    const glow = new T.Mesh(own(new T.CylinderGeometry(4, 9, 3, 16)), own(new T.MeshStandardMaterial({color: 0xff4a10, emissive: 0xff3a08, emissiveIntensity: 1.6})));
    glow.position.set(-120, shape.height(-120, -110) + 1, -110); glow.raycast = () => {};
    g.add(glow);
    return g;
  }
  let natureGroup = null;
  function build() {
    const b = {terrain: terrain(), water: waterPlane(), sky: own(skyTexture(T, THEMES[key].sky[0], THEMES[key].fog)), spots: placements()};
    group.add(b.terrain); if (b.water) group.add(b.water);
    if (THEMES[key].volcano) group.add(volcano());
    built = b;
    plant();
    loadNature(T).then(n => { if (!dead && n && built === b) { plant(); onChange(); } });
  }
  function plant() {
    if (natureGroup) { group.remove(natureGroup); natureGroup.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }
    natureGroup = new T.Group(); natureGroup.name = 'keep-nature';
    const spots = built.spots;
    for (const [name, list] of Object.entries(spots)) {
      if (!list.length) continue;
      const asset = nature && name !== 'farTree' && nature[name];
      if (asset) natureGroup.add(instanced(name, list, asset));
      else if (!nature || name === 'farTree' || /pine|oak|birch|deciduous|willow|stump|Stump/.test(name)) {
        if (/grass|fern|flower|bush|mushroom/.test(name)) continue;
        natureGroup.add(plain(list, /rock|stone/.test(name)));
      }
    }
    group.add(natureGroup);
  }
  function clear() {
    if (natureGroup) { natureGroup.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); natureGroup = null; }
    group.clear();
    owned.splice(0).forEach(x => x.dispose && x.dispose());
    built = null;
  }
  build();

  // realm-wildlife.js places its creatures on a picture's pixels: this land seen as one, 1000 px across the camera's view
  const RIGHT = new T.Vector3(Math.cos(YAW), 0, -Math.sin(YAW)), DOWN = new T.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
  const SPAN = 300, PX = 1000;
  const ground = {
    w: PX, h: PX, per: SPAN / PX, pitch: Math.asin(.54),
    lot: {cx: PX / 2, cy: PX * .57, h: (LOT * 2 + 14) * Math.SQRT2 / SPAN * PX * Math.sin(Math.asin(.54))},
    under(px, py) {
      const a = (px / PX - .5) * SPAN, b = (py / PX - .57) * SPAN;
      const x = RIGHT.x * a + DOWN.x * b, z = RIGHT.z * a + DOWN.z * b;
      return new T.Vector3(x, Math.max(-.5, shape.height(x, z)), z);
    }
  };
  return {
    group, ground,
    get theme() { return key; },
    get light() { const Th = THEMES[key]; return {sky: Th.sky, fog: Th.fog, sun: Th.sun, hemi: Th.hemi}; },
    /** The sky (scene.background), its colours the land's. */
    get background() { return built?.sky || null; },
    /** How far the camera may wander from the lot's middle (tiles) and the land's half-side. */
    extent: 70, half: SIZE / 2,
    heightAt: (x, z) => shape.height(x, z),
    setTheme(k) {
      const next = themeOf(k);
      if (next === key || dead) return false;
      clear(); key = next; shape = shapeOf(key); build(); onChange();
      return true;
    },
    dispose() { if (dead) return; dead = true; clear(); group.removeFromParent(); }
  };
}
/** For the checks: the lands this draws. */
export const THEME_KEYS = Object.freeze(Object.keys(THEMES));
