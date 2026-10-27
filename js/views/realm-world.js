// Keepfall's land in 3D (the full 3D Keepfall, Oct 25 2026: the owner's ask, "remove the super wide 2d picture i am
// currently using for the scenery"). Real terrain round the lot instead of a painting: the lot flat at y 0 (its 44 x 44
// tiles centred on the origin, as views/realm-3d.js lays them), the country round it lived in (Oct 26 2026, his ask:
// "Insert more assets around the base to make the world feel full"): hamlets of cottages round a square, their carts,
// barrels and crates, fields of rye and sunflowers on tilled earth, windmills turning, a wizard's tower on a rise, old
// statues in a grove, watchtowers where the roads leave the walls, groves and woods, undergrowth, mountains behind (the
// camera looks from +x +z). Each scenery (core/realm.js SCENERIES: the four the Unity packs build) is its own land: the
// coast's sea, the forest's river, mushrooms and fireflies, the tundra's snow, icy sea and snowfall, the desert's
// sand, red rock and oasis. Its ground is the hand-painted Unity textures (models/realm/world-v1/textures), its trees,
// rocks, plants and village the Unity models (nature.glb, village.glb: tools/realm/convert-world.mjs), instanced: a few
// draw calls whatever the count. Until they're in (or if they fail) plain 3D pines and rocks stand in.
// createWorld(T, scene, {theme, onChange, detail}) → {group, theme, setTheme, heightAt, light, background, ground (for
// realm-wildlife.js), update(seconds, {camera, still}) → animating, extent, dispose}. Scenery only: nothing here is
// picked, collides or touches a save.
const AT = new URL('../../models/realm/world-v1/', import.meta.url).href;
const V = new URL('../vendor/three/', import.meta.url).href;
const SIZE = 440, SEG = 150, LOT = 22; // (the land's side, its grid; the lot's half-side, tiles)
const YAW = Math.PI / 4;
let UP = null; // (the y axis, once three.js is in)
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- each land: its ground (grass, earth, rock, road: models/realm/world-v1/textures) and their tints, water, sky,
// light, trees (near the lot; far: the woods beyond), crops, how many hamlets, its own touches. Only the realistic trees
// (Oct 27 2026, the owner: "Remove the low poly trees and make the outside more dense with the more realistic trees"):
// no low-poly pine (pineLow), and the far woods are the light ones of those (pine3, birch2: ~700 triangles), not cones
const THEMES = {
  coast: {ground: ['grass', 'dust', 'ground_rock', 'ground_stones'], tint: [[.9, .95, .86], [.92, .84, .74], [.95, .95, .95], [.95, .93, .9]],
    water: {kind: 'sea', color: 0x2b6a80}, sky: [0x5a86b8, 0xc2ccd0], fog: 0xb3bec2, sun: [0xffe0b8, 2.4], hemi: [0xcfdbe8, 0x3e4c32, .75],
    trees: {pine1: 2, pine2: 1, pine3: 4, oak1: 1, birch1: 1, birch2: 2, deciduous1: 1}, far: {pine3: 3, birch2: 2}, forest: 1, rocks: 1, crops: ['rye', 'sunflower'], hamlets: 4, windmills: 3},
  forest: {ground: ['grassDark', 'swamp', 'ground_rock', 'ground_road'], tint: [[.82, .9, .84], [.85, .85, .8], [.8, .84, .82], [.8, .78, .74]],
    water: {kind: 'river', color: 0x1f5a5e, glow: 0x1a6a62}, sky: [0x26345c, 0x5d6d88], fog: 0x56647c, sun: [0xbcd0f4, 1.5], hemi: [0x9aaccc, 0x1e2a1e, .75],
    trees: {pine1: 2, pine2: 1, pine3: 3, deciduous1: 2, deciduous2: 1, willow1: 1, oak2: 1, birch2: 2}, far: {pine3: 3, birch2: 1},
    forest: 1.5, rocks: 1, crops: ['rye'], hamlets: 2, windmills: 1, mushrooms: true, fx: 'fireflies'},
  tundra: {ground: ['snow', 'snowDark', 'ground_rock', 'ground_stones'], tint: [[.94, .96, 1], [.9, .92, .97], [.88, .9, .95], [.9, .92, .96]],
    water: {kind: 'sea', color: 0x5f8aa2, ice: true}, sky: [0x6d88a8, 0xc4ced8], fog: 0xbcc7d2, sun: [0xfff0dc, 1.8], hemi: [0xd2deea, 0x66768a, .85],
    trees: {pine1: 2, pine2: 1, pine3: 5}, far: {pine3: 1}, forest: 1, rocks: 1.3, frost: .55, crops: [], hamlets: 2, windmills: 0, fx: 'snow'},
  desert: {ground: ['sandStones', 'sand', 'earth', 'ground_road'], tint: [[1, .97, .92], [1, .96, .9], [1.02, .86, .76], [.98, .92, .84]],
    water: {kind: 'oasis', color: 0x2a8a8c}, sky: [0xc77b52, 0xf2c48e], fog: 0xe3b48a, sun: [0xffc48a, 2.5], hemi: [0xf6dcc0, 0x8a5a3a, .8],
    trees: {pineStump: 1, stump: 2}, far: {pineStump: 1, stump: 2}, forest: .25, rocks: 2.2, oasisTrees: {willow1: 1, oak2: 1}, crops: [], hamlets: 2, windmills: 0, redRock: true}
};
// (a land retired Oct 26 2026 is drawn as its nearest: core/realm.js RETIRED_SCENERIES)
const NEAREST = {ocean: 'coast', christmas: 'tundra', infernal: 'desert'};
export const themeOf = k => THEMES[k] ? k : THEMES[NEAREST[k]] ? NEAREST[k] : 'coast';

// ---- noise (deterministic: every phone sees the same land)
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise(x, y, s = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 1) => noise(x, y, s) * .55 + noise(x * 2.1, y * 2.1, s + 7) * .3 + noise(x * 4.3, y * 4.3, s + 13) * .15;
const rngOf = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// a road out of each side the camera sees, winding a little: along +z (the screen's lower left) and along -x
const ROAD_Z = t => 8 + Math.sin(t * .05) * 6, ROAD_X = t => -6 + Math.sin(t * .045 + 1) * 7;
/** The land's shape for theme k: {height, water (0-1: how far under water), road (0-1), field (0-1: tilled), plaza (0-1)}. */
function shapeOf(k, places = []) {
  const W = THEMES[k].water.kind;
  const road = (x, z) => {
    if (Math.max(Math.abs(x), Math.abs(z)) < LOT + 2) return 0;
    let best = 99;
    if (z > LOT) best = Math.min(best, Math.abs(ROAD_Z(z) - x));
    if (-x > LOT) best = Math.min(best, Math.abs(ROAD_X(-x) - z));
    return 1 - smooth(1.4, 3.2, best);
  };
  const water = (x, z) => {
    const u = (-x + z) / Math.SQRT2;
    if (W === 'sea') return smooth(56 + fbm(z * .03, x * .03, 3) * 10, 68 + fbm(z * .03, x * .03, 3) * 10, u);
    if (W === 'river') { const c = -50 + Math.sin(z * .045) * 9 + Math.sin(z * .013 + 2) * 6; return 1 - smooth(4, 8, Math.abs(x - c)); }
    if (W === 'oasis') return 1 - smooth(8, 13, Math.hypot(x + 58, z - 34));
    return 0;
  };
  // (the village's places are level: a hamlet's houses, a field, a windmill's knoll; how level, and how far into a
  // field or a hamlet's square)
  const level = (x, z) => { let f = 0; for (const p of places) f = Math.max(f, 1 - smooth(p.r, p.r + 7, Math.hypot(x - p.x, z - p.z))); return f; };
  const field = (x, z) => {
    let f = 0;
    for (const p of places) if (p.field) {
      const dx = x - p.x, dz = z - p.z, c = Math.cos(p.turn), s = Math.sin(p.turn), u = Math.abs(dx * c - dz * s), v = Math.abs(dx * s + dz * c);
      f = Math.max(f, (1 - smooth(p.w / 2 - .6, p.w / 2 + .6, u)) * (1 - smooth(p.d / 2 - .6, p.d / 2 + .6, v)));
    }
    return f;
  };
  const plaza = (x, z) => { let f = 0; for (const p of places) if (p.hamlet) f = Math.max(f, 1 - smooth(p.r * .35, p.r * .6, Math.hypot(x - p.x, z - p.z))); return f; };
  const height = (x, z) => {
    const r = Math.max(Math.abs(x), Math.abs(z)), d = Math.hypot(x, z);
    const near = smooth(LOT + 5, LOT + 26, r);
    let h = near * Math.max(-.35, (fbm(x * .03, z * .03, 2) - .28) * 5.5);
    // mountains behind the lot (away from the camera), lower hills in front of it
    const back = smooth(-30, 90, -(x + z) / Math.SQRT2);
    h += smooth(58, 160, d) * (6 + 32 * fbm(x * .018 + 4, z * .018 + 9, 3)) * (.25 + .75 * back);
    if (k === 'desert') h += near * Math.max(0, fbm(x * .05, z * .05, 11) - .55) * 9; // (mesas)
    const lv = level(x, z);
    if (lv > 0) h *= 1 - lv * .9;
    const w = water(x, z);
    if (w > 0) h = h * (1 - w) - 3.2 * w;
    const rd = road(x, z);
    if (rd > 0) h *= 1 - rd * .7;
    return h;
  };
  return {height, water, road, field, plaza, level};
}

/**
 * Where the village goes in land k: the hamlets (each beside a road, or out on its own), their fields, the windmills,
 * the landmarks; each {x, z, r (its level ground's radius), ...}. Deterministic: every phone sees the same country.
 */
function placesOf(k) {
  const Th = THEMES[k], R = rngOf(9001 + k.length * 131), base = shapeOf(k), out = [];
  const dry = (x, z, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => base.water(x + a, z + b) < .05);
  const free = (x, z, r) => out.every(p => Math.hypot(p.x - x, p.z - z) > p.r + r + 2);
  // hamlets: one by the road out along +z, one by the road out along -x, one off on its own to the right; each turned
  // to face the lot
  const sites = [[ROAD_Z(42) + 13, 42], [-44, ROAD_X(44) - 13], [42, -30], [-36, 38]];
  for (const [x, z] of sites) {
    if (out.filter(p => p.hamlet).length >= Th.hamlets) break;
    if (!dry(x, z, 12) || !free(x, z, 10) || base.road(x, z) > .05) continue;
    const h = {hamlet: true, x, z, r: 9, face: Math.atan2(-x, -z)};
    out.push(h);
    // its field (or two), further out from the lot, along the way it faces; a windmill on the first
    const away = Math.atan2(x, z);
    for (let f = 0; f < (Th.crops.length ? 2 : 0); f++) {
      const turn = away + (f ? .9 : -.9), dist = 19 + R() * 4, fx = x + Math.sin(turn) * dist, fz = z + Math.cos(turn) * dist;
      const w = 11 + R() * 4, d = 7 + R() * 3, c = Math.cos(turn), s = Math.sin(turn);
      // (clear of the roads and the water to its fence's corners and a little beyond)
      const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [fx + a * (w / 2 + 2) * c + b * (d / 2 + 2) * s, fz - a * (w / 2 + 2) * s + b * (d / 2 + 2) * c]);
      if (!dry(fx, fz, Math.max(w, d) / 2 + 2) || !free(fx, fz, Math.hypot(w / 2 + .8, d / 2 + .8)) || base.road(fx, fz) > .02 || Math.max(Math.abs(fx), Math.abs(fz)) < LOT + 9) continue;
      if (corners.some(([a, b]) => base.road(a, b) > .02 || base.water(a, b) > .02 || Math.max(Math.abs(a), Math.abs(b)) < LOT + 4)) continue;
      const crop = Th.crops[(f + out.length) % Th.crops.length];
      out.push({field: true, crop, x: fx, z: fz, w, d, turn, r: Math.max(w, d) * .55});
    }
  }
  let mills = Th.windmills;
  for (const f of out.filter(p => p.field)) {
    if (!mills) break;
    // (beside its field's far end, clear of everything else)
    for (const side of [1, -1]) {
      const mx = f.x + Math.cos(f.turn) * side * (f.w / 2 + 4.5), mz = f.z - Math.sin(f.turn) * side * (f.w / 2 + 4.5);
      if (!dry(mx, mz, 4) || !out.filter(p => p !== f).every(p => Math.hypot(p.x - mx, p.z - mz) > p.r + 6) || base.road(mx, mz) > .02) continue;
      out.push({mill: true, x: mx, z: mz, r: 3.5, face: R() * Math.PI * 2}); mills--; break;
    }
  }
  // the landmarks: a wizard's tower on a rise behind, old statues in a grove to the right, watchtowers at the roads
  const tower = [[-52, -56], [-60, -40], [-40, -62]].find(([x, z]) => dry(x, z, 5) && free(x, z, 5));
  if (tower) out.push({tower: true, x: tower[0], z: tower[1], r: 5});
  const ruin = [[56, -14], [50, -52], [60, 10]].find(([x, z]) => dry(x, z, 7) && free(x, z, 7));
  if (ruin) out.push({ruin: true, x: ruin[0], z: ruin[1], r: 7});
  out.push({watch: true, x: ROAD_Z(28) - 4.2, z: 28, r: 2.2}, {watch: true, x: ROAD_Z(28) + 4.2, z: 28, r: 2.2},
    {watch: true, x: -28, z: ROAD_X(28) - 4.2, r: 2.2}, {watch: true, x: -28, z: ROAD_X(28) + 4.2, r: 2.2});
  return out;
}

// ---- room on the ground (Oct 26 2026, the owner's ask: "They should not overlap unless it is natural looking"): each
// model's footprint at scale 1, x by z, and its height (tiles, as drawn: trees 4.6 tall, plants .8 a metre; from
// models/realm/world-v1/manifest.json; the windmill's its sails' sweep), so that
// nothing stands inside anything else. Only what's natural meets: trees' crowns, undergrowth under them and against a
// wall, flowers in their drifts, a fence's rails
const FOOT = {
  house1: [8.21, 7.5, 7.26], house2: [9.18, 7.67, 7.26], house3: [3.89, 7.71, 7.26], windmill: [12.8, 12.8, 15.04], cart: [2.02, 5.23, 1.55],
  wagon: [2.8, 7.19, 4.42], barrel: [.98, .98, 1.03], barrels: [3.6, 2, 2.8], sack: [.98, .65, .78], basket: [.86, .79, 1.07], crate: [1.5, 1.5, 1.5],
  firewood: [2.04, 1, 1.08], wizardTower: [.72, .69, 1.5], watchtower: [2.85, 2.85, 11.07], statue: [2.36, 1.78, 5.23], statueBroken: [2.36, 1.78, 4.05],
  statueHead: [2.23, 1.26, 1.53], slab: [4.59, 2.45, 1.25], rye: [.98, .95, 1.09], sunflower: [1.19, 1.32, 2.23], bush: [1.23, 1.2, 1.04],
  fern: [1.2, 1.1, 2.3], flowers: [.8, .72, .7], blooms: [.75, .62, .76], mushroom: [.39, .52, .42], mushrooms: [.35, .38, .53], toadstool: [.34, .51, .41],
  ruinWall: [5, 1.2, 6], ruinArch: [5, 1.2, 6], ruinEnd: [1.29, 1.23, 6], pillar: [1, 1, 3], fence: [3.16, .16, 1.2],
  pineLow: [2.37, 2.46, 4.6], pine1: [2.76, 2.81, 4.6], pine2: [2.84, 2.81, 4.6], pine3: [2.4, 2.29, 4.6], oak1: [6.84, 6.59, 4.6], oak2: [6.63, 7.96, 4.6],
  birch1: [4.25, 4.29, 4.6], birch2: [4.16, 4.08, 4.6], deciduous1: [6.17, 4.95, 4.6], deciduous2: [6.17, 5.93, 4.6], willow1: [6.36, 7.09, 4.6],
  pineStump: [1.16, 1.24, .9], stump: [1.05, 1.17, .9],
  rock1: [9.29, 8.39, 5.52], rock2: [12.36, 7.65, 5.28], rock3: [12.67, 8.39, 6.25], stone1: [1.78, 1.66, 1.04], stone2: [3.92, 4.02, 2.38], stone3: [3.78, 3.51, 1.32]
};
// (where a cottage's chimney tops out, in its model's metres: its smoke rises from there)
const CHIMNEY = {house1: [3.5, 7.3, 1.25], house2: [2.5, 7.3, 2.5], house3: [1.25, 7.3, 1.25]};
/** What a piece is to its neighbours: a tree (its crown), cover (undergrowth), or solid ('tall' if a crown can't reach over it). */
const roleOf = (name, s) => {
  if (/^(pine|oak|birch|deciduous|willow|stump)/.test(name)) return 'tree';
  const h = FOOT[name][2] * s;
  if (/bush|fern|flower|bloom/.test(name) || (/mushroom|toadstool/.test(name) && h < 1.2) || (/stone/.test(name) && h < .7)) return 'cover';
  return h > 1.2 ? 'tall' : 'solid';
};
/**
 * A piece's footprint: circles [x, z, radius]. A tree's its crown; a small piece one circle; a big one (a house, a
 * boulder) four, one to each quarter, reaching its corners; a long one (a wall, a fence, a cart) a row of them.
 */
function footprint(name, x, z, s, r, role) {
  const [fx, fz] = FOOT[name], a = fx * s, b = fz * s, long = Math.max(a, b), short = Math.min(a, b);
  if (role === 'tree') return [[x, z, long / 2]];
  const X = [Math.cos(r), -Math.sin(r)], Z = [Math.sin(r), Math.cos(r)]; // (its own x and z on the ground)
  if (long < short * 1.7) {
    if (long < 1.6) return [[x, z, Math.hypot(a, b) / 2 * .8]];
    const rq = Math.hypot(a / 4, b / 4);
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [x + (X[0] * i * a + Z[0] * j * b) / 4, z + (X[1] * i * a + Z[1] * j * b) / 4, rq]);
  }
  const rc = Math.max(.25, short / 2), n = Math.min(8, Math.max(2, Math.ceil(long / (2 * rc)))), [ux, uz] = a >= b ? X : Z;
  return Array.from({length: n}, (_, i) => { const t = -(long / 2 - rc) + i * (long - 2 * rc) / (n - 1); return [x + ux * t, z + uz * t, rc]; });
}
/** How far apart two footprint circles' centres must be (each {k (role), r, t (a tree's trunk), name}). */
function apart(a, b) {
  // (a fence's rails meet; an old keep's walls join at its corners)
  const join = n => n === 'fence' ? 1 : /^ruin/.test(n) ? 2 : 0;
  if (join(a.name) && join(a.name) === join(b.name)) return 0;
  if (a.k === 'cover' || b.k === 'cover') {
    const [c, o] = a.k === 'cover' ? [a, b] : [b, a];
    return o.k === 'cover' ? (c.r + o.r) * .3 : o.k === 'tree' ? o.t + c.r * .3 : o.r + c.r * .5;
  }
  if (a.k === 'tree' && b.k === 'tree') return Math.max((a.r + b.r) * .5, a.t + b.t + .3);
  if (a.k === 'tree' || b.k === 'tree') { const [t, o] = a.k === 'tree' ? [a, b] : [b, a]; return o.r + (o.k === 'tall' ? t.r * .85 : t.t + .15); }
  return a.r + b.r + .08;
}
/**
 * The ground's room in a land (its places' fields, its shape's roads): take(name, x, z, s, r, force) → whether the piece
 * had room there (it holds it now; force: it takes it anyway); last: what it hit, when it hadn't.
 */
function roomOf(places, shape) {
  const CELL = 4, grid = new Map(), fields = places.filter(p => p.field);
  const cells = (x, z, r, f) => {
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) if (f(i * 1e4 + j) === false) return false;
    return true;
  };
  // (how far a point is outside every field and its fence: 0 within one)
  const fieldGap = (x, z) => fields.reduce((g, f) => {
    const dx = x - f.x, dz = z - f.z, c = Math.cos(f.turn), s = Math.sin(f.turn);
    return Math.min(g, Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - f.w / 2 - .8), Math.max(0, Math.abs(dx * s + dz * c) - f.d / 2 - .8)));
  }, 99);
  const room = {last: ''};
  const fits = (k, x, z, r, name) => {
    if (name !== 'fence' && fieldGap(x, z) <= (k === 'tree' ? r * .85 : k === 'cover' ? r * .4 : r + .1)) return (room.last = 'a field', false);
    if ((k === 'solid' || k === 'tall') && [[r, 0], [-r, 0], [0, r], [0, -r]].some(([a, b]) => shape.road(x + a, z + b) > .2)) return (room.last = 'the road', false);
    const me = {k, r, t: Math.max(.2, r * .2), name};
    return cells(x, z, r + .5, c => (grid.get(c) || []).every(o => Math.hypot(o.x - x, o.z - z) >= apart(me, o) || (room.last = o.name, false)));
  };
  room.take = (name, x, z, s, r, force) => {
    const k = roleOf(name, s), cs = footprint(name, x, z, s, r, k);
    if (!force && !cs.every(([cx, cz, cr]) => fits(k, cx, cz, cr, name))) return false;
    for (const [cx, cz, cr] of cs) {
      const e = {x: cx, z: cz, r: cr, k, t: Math.max(.2, cr * .2), name};
      cells(cx, cz, cr + .5, c => { const l = grid.get(c); if (l) l.push(e); else grid.set(c, [e]); });
    }
    return true;
  };
  return room;
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

// ---- the ground's textures (shared by every view; each loaded once, when a land first wants it)
const groundTex = new Map();
function groundTexture(T, name, maxAniso, onReady) {
  let e = groundTex.get(name);
  if (!e) {
    e = {ready: false, wait: []};
    e.tex = new T.TextureLoader().load(AT + 'textures/' + FILES[name], () => { e.ready = true; e.wait.splice(0).forEach(f => f()); },
      undefined, () => { e.ready = true; e.failed = true; e.wait.splice(0).forEach(f => f()); });
    e.tex.colorSpace = T.SRGBColorSpace; e.tex.wrapS = e.tex.wrapT = T.RepeatWrapping; e.tex.anisotropy = Math.min(8, maxAniso);
    groundTex.set(name, e);
  }
  // (told once it's in: never during the call, the caller may not be ready for it yet)
  if (e.ready) queueMicrotask(onReady); else e.wait.push(onReady);
  return e.tex;
}
const FILES = {grass: 'Grass_normal_down.jpg', grassDark: 'Grass_darked_down.jpg', grassLight: 'Grass_lighted_down.jpg', swamp: 'Grass_swamp_normal_down.jpg',
  earth: 'dirt_clay_down.jpg', sand: 'dirt_normal_down.jpg', sandStones: 'dirt_lighted_rocks_down.jpg', dust: 'dirt_desatured_down.jpg',
  snow: 'snow_normal.jpg', snowDark: 'snow_dark.jpg', ground_rock: 'ground_rock.jpg', ground_road: 'ground_road.jpg', ground_stones: 'ground_stones.jpg'};
/** The terrain's material: its land's four textures blended by each vertex's weights, tinted for the land. */
function groundMaterial(T, list, theme) {
  const m = new T.MeshStandardMaterial({color: 0xffffff, roughness: .97, metalness: 0, vertexColors: true});
  const U = {tGrass: {value: list[0]}, tSoil: {value: list[1]}, tRock: {value: list[2]}, tRoad: {value: list[3]},
    tint0: {value: new T.Vector3(...theme.tint[0])}, tint1: {value: new T.Vector3(...theme.tint[1])}, tint2: {value: new T.Vector3(...theme.tint[2])}, tint3: {value: new T.Vector3(...theme.tint[3])}};
  m.userData.uniforms = U;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = 'attribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWorld;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = 'uniform sampler2D tGrass, tSoil, tRock, tRoad;\nuniform vec3 tint0, tint1, tint2, tint3;\nvarying vec4 vSplat;\nvarying vec3 vWorld;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 wuv = vWorld.xz * 0.085;
        // (the ground sampled twice, at scales and angles apart, so its tiling never lines up)
        vec3 cg = mix(texture2D(tGrass, wuv).rgb, texture2D(tGrass, vec2(wuv.y, -wuv.x) * 0.43 + 0.37).rgb, 0.45) * tint0;
        vec3 cs = mix(texture2D(tSoil, wuv * 1.2).rgb, texture2D(tSoil, vec2(-wuv.y, wuv.x) * 0.5).rgb, 0.35) * tint1;
        vec3 cr = texture2D(tRock, wuv * 0.7).rgb * tint2, cd = texture2D(tRoad, wuv * 1.6).rgb * tint3;
        vec4 w = max(vSplat, 0.0); w /= max(0.0001, w.x + w.y + w.z + w.w);
        diffuseColor.rgb *= cg * w.x + cs * w.y + cr * w.z + cd * w.w;`);
  };
  m.customProgramCacheKey = () => 'keepfall-ground-v2';
  return m;
}

// ---- the models (shared by every view; each pack loaded once): name → {parts: [[geometry, material]], fan?, height, width}
const packs = {}, packLoading = {}, LYING = {toadstool: Math.PI / 2};
// (the windmill's porch came over from Unity lying on its back, out past the sails on two poles: its roof pointing
// away from the tower, its door at the ground. Oct 27 2026, the owner: "The building connected to the windmill is laying
// on its side". Stood up here on the ground in front of the tower, its door facing out, its back just clear of the
// sails, whose tips sweep down to 2 m by the tower's foot; the poles, left holding nothing, go.)
function standPorch(g) {
  const P = g.attributes.position, N = g.attributes.normal, I = g.index.array, root = Array.from({length: P.count}, (_, i) => i);
  const find = i => { while (root[i] !== i) i = root[i] = root[root[i]]; return i; };
  const at = new Map();
  for (let i = 0; i < P.count; i++) {
    const k = P.getX(i).toFixed(3) + ',' + P.getY(i).toFixed(3) + ',' + P.getZ(i).toFixed(3);
    if (at.has(k)) root[find(i)] = find(at.get(k)); else at.set(k, i);
  }
  for (let t = 0; t < I.length; t += 3) { root[find(I[t + 1])] = find(I[t]); root[find(I[t + 2])] = find(I[t]); }
  // (the tower and its sails' hub end at z .16, the porch begins at 2.38; a pole runs between)
  const GAP = 1.27, lo = new Map(), hi = new Map();
  for (let i = 0; i < P.count; i++) { const r = find(i), z = P.getZ(i); lo.set(r, Math.min(lo.get(r) ?? z, z)); hi.set(r, Math.max(hi.get(r) ?? z, z)); }
  const porch = i => lo.get(find(i)) > GAP, pole = i => lo.get(find(i)) < GAP && hi.get(find(i)) > GAP;
  const box = {y1: -Infinity, z0: Infinity};
  for (let i = 0; i < P.count; i++) if (porch(i)) {
    box.y1 = Math.max(box.y1, P.getY(i)); box.z0 = Math.min(box.z0, P.getZ(i));
  }
  if (box.z0 === Infinity) return;
  // (up was +z, the door -y: turned (x, y, z) → (x, z, -y), set on the ground with its back at z .15, the sails' tips
  // reaching to -.06)
  for (let i = 0; i < P.count; i++) {
    if (!porch(i)) continue;
    const y = P.getY(i), z = P.getZ(i);
    P.setXYZ(i, P.getX(i), z - box.z0, .15 + box.y1 - y);
    if (N) N.setXYZ(i, N.getX(i), N.getZ(i), -N.getY(i));
  }
  const keep = [];
  for (let t = 0; t < I.length; t += 3) if (!pole(I[t])) keep.push(I[t], I[t + 1], I[t + 2]);
  g.setIndex(keep);
  P.needsUpdate = true; if (N) N.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
}
function loadPack(T, file) {
  if (packs[file]) return Promise.resolve(packs[file]);
  if (packLoading[file]) return packLoading[file];
  packLoading[file] = (async () => {
    try {
      const {GLTFLoader} = await import(V + 'GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(AT + file);
      // (a texture that didn't come would draw them white: the plain ones instead)
      const json = gltf.parser.json.materials || [];
      gltf.scene.traverse(o => { if (o.isMesh && json[gltf.parser.associations.get(o.material)?.materials]?.pbrMetallicRoughness?.baseColorTexture && !o.material.map?.image) throw Error('Incomplete texture: ' + file); });
      gltf.scene.updateMatrixWorld(true);
      const out = {};
      gltf.scene.children.forEach(node => {
        const parts = [], fan = [], inv = new T.Matrix4().copy(node.matrixWorld).invert();
        const fanNode = node.getObjectByName('Fan');
        node.traverse(o => {
          if (!o.isMesh) return;
          // (leaves both sides, a little deeper than they're lit in Unity: under this sun they wash out)
          if (o.material.alphaTest > 0 && !o.material.userData.leaf) { o.material.side = T.DoubleSide; o.material.color.multiplyScalar(.8); o.material.userData.leaf = true; }
          let inFan = false; for (let p = o; p; p = p.parent) if (p === fanNode) inFan = true;
          // (a windmill's sails apart, about their hub: they turn)
          const to = inFan ? new T.Matrix4().copy(fanNode.matrixWorld).invert() : inv;
          (inFan ? fan : parts).push([o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(to, o.matrixWorld)), o.material]);
        });
        if (node.name === 'windmill') parts.forEach(([g]) => { if (g.index && g.attributes.position) standPorch(g); });
        const box = new T.Box3(); parts.forEach(([g]) => { g.computeBoundingBox(); box.union(g.boundingBox); });
        // (a model that came over lying on its side: stood up, centred and set on the ground; Oct 26 2026, the owner:
        // "The mushrooms are sideways")
        if (LYING[node.name] != null) {
          const up = new T.Matrix4().makeRotationX(LYING[node.name]);
          box.makeEmpty(); parts.forEach(([g]) => { g.applyMatrix4(up); g.computeBoundingBox(); box.union(g.boundingBox); });
          const c = box.getCenter(new T.Vector3()), floor = box.min.y;
          box.makeEmpty(); parts.forEach(([g]) => { g.translate(-c.x, -floor, -c.z); g.computeBoundingBox(); box.union(g.boundingBox); });
        }
        const size = box.getSize(new T.Vector3());
        // (the sails turn about their thinnest axis: the hub's)
        const fb = new T.Box3(); fan.forEach(([g]) => { g.computeBoundingBox(); fb.union(g.boundingBox); });
        const fs = fb.getSize(new T.Vector3()), axis = fs.x <= fs.y && fs.x <= fs.z ? 'x' : fs.y <= fs.z ? 'y' : 'z';
        out[node.name] = {parts, height: size.y, width: Math.max(size.x, size.z),
          ...(fan.length ? {fan, axis, hub: new T.Matrix4().multiplyMatrices(inv, fanNode.matrixWorld)} : {})};
      });
      packs[file] = out;
      return out;
    } catch (e) { console.warn('Keepfall: plain 3D for ' + file, e); return null; } finally { packLoading[file] = null; }
  })();
  return packLoading[file];
}

/**
 * The land for scenery `theme` in `scene`. onChange(): something new to draw (its models came in). detail: how much of
 * its woods to grow (a raid's view looks at the lot: .55).
 */
export function createWorld(T, scene, {theme = 'coast', onChange = () => {}, maxAnisotropy = 4, detail = 1} = {}) {
  UP = UP || new T.Vector3(0, 1, 0);
  const group = new T.Group(); group.name = 'keep-world'; scene.add(group);
  let key = themeOf(theme), places = placesOf(key), shape = shapeOf(key, places), dead = false, built = null;
  const owned = []; // (geometries and materials made here, freed on a new theme)
  const own = x => { owned.push(x); return x; };
  const tellWhenIn = () => { if (!dead) onChange(); };

  function terrain() {
    const Th = THEMES[key];
    const g = own(new T.PlaneGeometry(SIZE, SIZE, SEG, SEG)); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, splat = new Float32Array(p.count * 4), tone = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = shape.height(x, z);
      p.setY(i, h);
      const r = Math.max(Math.abs(x), Math.abs(z)), rd = shape.road(x, z), wet = shape.water(x, z), tilled = shape.field(x, z), square = shape.plaza(x, z);
      const soil = clamp((noise(x * .06, z * .06, 17) - .6) * 1.6) * .6 * smooth(LOT + 1, LOT + 8, r) + wet * .8 + tilled * 2.5 + square * .8;
      // (a trodden ring round the lot, as round a camp: the base reads as a place apart)
      const ring = (1 - smooth(1.2, 3.2, Math.abs(r - LOT - 2.2))) * .55;
      splat.set([Math.max(0, 1 - soil), soil + ring * .5, 0, rd + ring * .8 + square * .6], i * 4);
      // (light and shade: broad soft variation so no tiling shows from afar, darker under the woods; furrows in a field)
      const v = .8 + .26 * fbm(x * .012, z * .012, 31) - .12 * smooth(.45, .65, fbm(x * .028, z * .028, 21)) * smooth(LOT + 4, LOT + 14, r) * (1 - tilled);
      const furrow = tilled ? 1 - tilled * .1 * (Math.sin((x + z) * 2.4) * .5 + .5) : 1;
      tone.set([v * furrow, v * furrow, v * .97 * furrow], i * 3);
    }
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) splat[i * 4 + 2] = smooth(.12, .35, 1 - n.getY(i)) * 3 + smooth(14, 26, p.getY(i)) * 2;
    g.setAttribute('splat', new T.BufferAttribute(splat, 4));
    g.setAttribute('color', new T.BufferAttribute(tone, 3));
    const list = Th.ground.map(name => groundTexture(T, name, maxAnisotropy, tellWhenIn));
    const mesh = new T.Mesh(g, own(groundMaterial(T, list, Th)));
    mesh.receiveShadow = true; mesh.name = 'keep-terrain'; mesh.position.y = -.015; mesh.raycast = () => {};
    return mesh;
  }
  function waterPlane() {
    const W = THEMES[key].water; if (!W.kind) return null;
    const m = own(new T.MeshStandardMaterial({color: W.color, roughness: W.ice ? .55 : .12, metalness: W.ice ? 0 : .25,
      emissive: W.glow || 0x000000, emissiveIntensity: W.glow ? .35 : 0, transparent: true, opacity: W.ice ? .94 : .9}));
    const mesh = new T.Mesh(own(new T.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2)), m);
    mesh.position.y = -.7; mesh.name = 'keep-water'; mesh.raycast = () => {};
    return mesh;
  }
  /** Where things stand: [{x, z, y, s (scale), r (turn)}] by model name, deterministic for the land. */
  function placements() {
    const Th = THEMES[key], R = rngOf(4242 + key.length * 97), out = {}, room = roomOf(places, shape);
    const clear = (x, z, gap) => places.every(p => Math.hypot(p.x - x, p.z - z) > p.r + gap);
    const ok = (x, z, edge = 4, gap = 2) => Math.max(Math.abs(x), Math.abs(z)) > LOT + edge && shape.water(x, z) < .05 && shape.road(x, z) < .05 && clear(x, z, gap) && Math.abs(x) < SIZE / 2 - 10 && Math.abs(z) < SIZE / 2 - 10;
    // (a piece goes only where it has room, and then holds it: → whether it went. A crop is sown in its field as told;
    // a fence's rails stand where they're told, round their field)
    const put = (name, x, z, s, r = R() * Math.PI * 2, how = '') => {
      if (how !== 'crop' && !room.take(name, x, z, s, r, how === 'fixed')) return false;
      (out[name] ||= []).push({x, z, y: shape.height(x, z), s, r});
      return true;
    };
    const MUSHROOM = () => .45 + R() * .25; // (a mushroom's size: .2 to .35 tall, where a flower's .6 and a bush 1.2)
    const tries = (n, f) => { for (let i = 0; i < n; i++) if (f(i)) return true; return false; };
    const pick = table => { const e = Object.entries(table), total = e.reduce((a, [, w]) => a + w, 0); let v = R() * total; for (const [n, w] of e) if ((v -= w) <= 0) return n; return e[0][0]; };
    // ---- the village first: each hamlet's cottages round its square (a woodpile in its middle), facing in, smoke from
    // every other chimney, with their carts, barrels, sacks and crates (each where it has room)
    for (const h of places) {
      if (h.hamlet) {
        put('firewood', h.x, h.z, .55);
        const n = 6;
        for (let i = 0; i < n; i++) {
          // (a little further out if its neighbour's corner is in the way)
          const a = h.face + Math.PI + (i - (n - 1) / 2) * .72 + (R() - .5) * .1, d0 = 7 + R() * .9;
          let x = 0, z = 0;
          const house = ['house1', 'house2', 'house3'][i % 3];
          if (!tries(3, j => { const d = d0 + j * .7; x = h.x + Math.sin(a) * d; z = h.z + Math.cos(a) * d; return put(house, x, z, .34, Math.atan2(h.x - x, h.z - z)); })) continue;
          if (i % 2 === 0) {
            const [cx, cy, cz] = CHIMNEY[house], r = Math.atan2(h.x - x, h.z - z), k = .34;
            (out.smoke ||= []).push({x: x + (cx * Math.cos(r) + cz * Math.sin(r)) * k, y: shape.height(x, z) + cy * k, z: z + (cz * Math.cos(r) - cx * Math.sin(r)) * k});
          }
          // (by its door: a barrel, a sack, a basket or a crate, at whichever front corner has room)
          const prop = ['barrel', 'sack', 'basket', 'crate', 'barrels'][(i + Math.floor(R() * 5)) % 5];
          tries(4, j => { const side = j % 2 ? -1 : 1, f = .32 + (j >> 1) * .07; return put(prop, x + (h.x - x) * f + side * Math.cos(a) * 1.4, z + (h.z - z) * f - side * Math.sin(a) * 1.4, .45); });
        }
        // (a cart or a wagon on the open side, barrels across from it)
        tries(5, j => { const ca = h.face + .9 + [0, .45, -.45, .9, -.9][j], d = 3.6 + j * .2; return put(R() < .5 ? 'cart' : 'wagon', h.x + Math.sin(ca) * d, h.z + Math.cos(ca) * d, .42, ca + Math.PI / 2); });
        tries(5, j => { const ba = h.face + .9 + Math.PI + [0, .4, -.4, .8, -.8][j]; return put('barrels', h.x + Math.sin(ba) * 3.4, h.z + Math.cos(ba) * 3.4, .4); });
        // (the square's stores, each heap stacked close: crates, sacks, a basket and a barrel beside the cart; a woodpile,
        // barrels and a sack before the houses across the square; crates squared to their heap)
        const heap = (a, d, props) => {
          const hx = h.x + Math.sin(a) * d, hz = h.z + Math.cos(a) * d;
          for (const prop of props) tries(8, j => { const b = R() * Math.PI * 2, e = j && .45 + j * .2; return put(prop, hx + Math.cos(b) * e, hz + Math.sin(b) * e, .42 + R() * .08, a + Math.floor(R() * 4) * Math.PI / 2 + (R() - .5) * .25); });
        };
        heap(h.face + 1.75, 3.3, ['crate', 'crate', 'sack', 'basket', 'barrel']);
        heap(h.face + Math.PI + 1.15, 3.2, ['firewood', 'barrels', 'sack']);
      } else if (h.field) {
        // a field's crop in rows, turned with it
        const sunflower = h.crop === 'sunflower', step = sunflower ? .95 : .5, c = Math.cos(h.turn), s = Math.sin(h.turn);
        for (let u = -h.w / 2 + step / 2; u < h.w / 2; u += step) for (let v = -h.d / 2 + step / 2; v < h.d / 2; v += step * (sunflower ? 1 : 1.25)) {
          const ju = u + (R() - .5) * .25, jv = v + (R() - .5) * .25;
          put(h.crop, h.x + ju * c + jv * s, h.z - ju * s + jv * c, sunflower ? .36 + R() * .07 : .8 + R() * .2, sunflower ? h.turn + (R() - .5) * .6 : R() * Math.PI * 2, 'crop');
        }
        // (a timber fence round it, a gap for a gate at one end; a bush or two at its corners)
        const L = 1.9;
        for (const side of [-1, 1]) {
          for (let u = -h.w / 2 + L / 2; u < h.w / 2; u += L) put('fence', h.x + u * c + side * (h.d / 2 + .7) * s, h.z - u * s + side * (h.d / 2 + .7) * c, .6, h.turn, 'fixed');
          for (let v = -h.d / 2 + L / 2; v < h.d / 2; v += L) if (side < 0 || Math.abs(v) > L * .8) put('fence', h.x + side * (h.w / 2 + .7) * c + v * s, h.z - side * (h.w / 2 + .7) * s + v * c, .6, h.turn + Math.PI / 2, 'fixed');
        }
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put('bush', h.x + a * (h.w / 2 + 1.6) * c + b * (h.d / 2 + 1.6) * s, h.z - a * (h.w / 2 + 1.6) * s + b * (h.d / 2 + 1.6) * c, 1.1 + R() * .4);
      } else if (h.mill) put('windmill', h.x, h.z, .36, h.face);
      else if (h.tower) {
        put('wizardTower', h.x, h.z, 4.2, R() * 6);
        // (standing stones round it)
        for (let i = 0; i < 5; i++) tries(4, j => { const a = i * 1.26 + R() * .4, d = 3.6 + j * .5; return put('slab', h.x + Math.cos(a) * d, h.z + Math.sin(a) * d, .45 + R() * .2, a); });
      } else if (h.ruin) {
        // an old keep, square, its gateway toward the lot (+v; u across it): its walls three pieces a side, joined at
        // the corners' posts, broken where they've fallen (one corner gone, the side by it down to a wall and two
        // pillars); its statues inside, facing the aisle from the gateway, a head fallen; flagstones tumbled outside
        const t = Math.atan2(-h.x, -h.z), c = Math.cos(t), s = Math.sin(t), S = .55, L = 5 * S, H = 1.5 * L;
        const at = (n, u, v, turn, scale = S) => put(n, h.x + u * c + v * s, h.z - u * s + v * c, scale, t + turn);
        for (const [u, v] of [[-H, H], [H, H], [-H, -H]]) at('ruinEnd', u, v, 0);
        at('ruinWall', -L, H, 0); at('ruinWall', L, H, 0); // (the front, the gateway between)
        at('ruinWall', -H, L, Math.PI / 2); at('ruinArch', -H, 0, Math.PI / 2); at('ruinWall', -H, -L, Math.PI / 2);
        at('ruinWall', -L, -H, 0); at('ruinArch', 0, -H, 0);
        at('ruinWall', H, L, Math.PI / 2); at('pillar', H, -.2, 0, .55); at('pillar', H, -L - .3, 0, .45);
        at('statue', -1.8, 1, Math.PI / 2, .5); at('statue', 1.8, 1, -Math.PI / 2, .5);
        at('statueBroken', -1.8, -1.5, Math.PI / 2, .5); at('statueHead', 1.5, -1.2, -1.1, .5); at('statueBroken', 0, -2.7, 0, .5);
        for (const [u, v] of [[H + 1.6, -L], [H + 1.2, -H - 1.2], [L, -H - 1.7], [H + 1.9, .6]]) tries(6, j => at('slab', u + (R() - .5) * j * .5, v + (R() - .5) * j * .5, R() * Math.PI, .32 + R() * .14));
      } else if (h.watch) put('watchtower', h.x, h.z, .36, Math.PI / 4);
    }
    // ---- rocks: scattered near, boulders on the hills, crags on the mountains (red in the desert)
    for (let i = 0, n = 0; i < 900 && n < 70 * Th.rocks; i++) {
      const a = R() * Math.PI * 2, d = LOT + 6 + R() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (ok(x, z) && put(['rock1', 'rock2', 'rock3', 'stone1', 'stone2', 'stone3'][Math.floor(R() * 6)], x, z, .1 + R() * .22)) n++;
    }
    // (the desert's red rock: outcrops and boulders near the walls)
    if (Th.redRock) for (let i = 0, n = 0; i < 600 && n < 16; i++) {
      const a = R() * Math.PI * 2, d = LOT + 10 + R() * 50, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (ok(x, z, 8, 3) && put(['rock1', 'rock3', 'rock2'][n % 3], x, z, .35 + R() * .45)) n++;
    }
    for (let i = 0, n = 0; i < 400 && n < 26; i++) {
      const a = R() * Math.PI * 2, d = 110 + R() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (ok(x, z, 4, 0) && -(x + z) >= 0 && put(['rock1', 'rock3'][n % 2], x, z, .45 + R() * .8)) n++;
    }
    // ---- trees: groves round the lot (lone trees in the meadows between), woods further out where the forest noise is
    // high: the land's trees within ~76 tiles, its far ones beyond, seen small. Their crowns may meet; their trunks keep
    // apart, and clear of the village, the rocks and the fields
    const woods = (x, z) => fbm(x * .028, z * .028, 21);
    const near = Math.round(Math.min(1150, 1000 * Th.forest) * detail), far = Math.round(Math.min(800, 700 * Th.forest) * detail);
    for (let g = 0, n = 0; g < 2400 && n < near; g++) {
      const a = R() * Math.PI * 2, d = LOT + 6 + Math.pow(R(), .85) * 70, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
      if (!ok(cx, cz, 8)) continue;
      const size = 8 + Math.floor(R() * 14), radius = 3 + size * .4;
      for (let i = 0; i < size * 3 && n < near; i++) {
        const b = R() * Math.PI * 2, r = Math.sqrt(R()) * radius, x = cx + Math.cos(b) * r, z = cz + Math.sin(b) * r;
        if (ok(x, z, 6) && put(pick(Th.trees), x, z, .75 + R() * .55)) n++;
        if (i > size) break;
      }
    }
    for (let i = 0, n = 0; i < 1400 && n < 80 * Th.forest; i++) {
      const a = R() * Math.PI * 2, d = LOT + 6 + R() * 62, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (ok(x, z, 6) && put(pick(Th.trees), x, z, .8 + R() * .4)) n++;
    }
    for (let i = 0, n = 0; i < far * 25 && n < far; i++) {
      const a = R() * Math.PI * 2, d = 92 + Math.pow(R(), .8) * 130, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z, 4, 0) || woods(x, z) < .4 - (d - 92) * .0012) continue;
      if (put(pick(Th.far), x, z, .85 + R() * .8)) n++;
    }
    // (the ruin's grove: old trees round the statues)
    for (const h of places.filter(p => p.ruin)) for (let i = 0; i < 9; i++) { const a = R() * Math.PI * 2, d = h.r + 1.5 + R() * 4; const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d; if (ok(x, z, 6, 0)) put(Th.trees.oak2 ? 'oak2' : Th.trees.birch1 ? 'birch1' : pick(Th.trees), x, z, .85 + R() * .3); }
    if (Th.oasisTrees) for (let i = 0; i < 11; i++) tries(3, () => { const a = R() * Math.PI * 2, d = 13 + R() * 6, x = -58 + Math.cos(a) * d, z = 34 + Math.sin(a) * d; return shape.water(x, z) < .05 && put(pick(Th.oasisTrees), x, z, .7 + R() * .3); });
    // ---- mushrooms in the enchanted forest, in little clumps in the clearings between the trees: true to life, under a
    // flower's height (Oct 26 2026, the owner: "All mushrooms across the scenery are too large. Shrink them to realistic
    // scale")
    if (Th.mushrooms) for (let i = 0, n = 0, c = 0; i < 2000 && n < 48 * detail; i++) {
      const a = R() * Math.PI * 2, d = LOT + 7 + R() * 48, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z, 6, 1) || woods(x, z) < .5) continue;
      const kind = ['toadstool', 'mushroom', 'mushrooms'][c++ % 3];
      for (let j = 0; j < 3; j++) if (put(kind, x + (R() - .5) * .9, z + (R() - .5) * .9, MUSHROOM())) n++;
    }
    // ---- undergrowth last (under the trees, against the walls, never inside anything): bushes, ferns and flowers at
    // the groves' edges, round the hamlets and along the lot; the desert's dry scrub and stones, the tundra's frosted
    // bushes and stones
    const cover = Math.round(680 * detail);
    for (let i = 0, n = 0; i < 16000 && n < cover; i++) {
      const a = R() * Math.PI * 2, d = LOT + 4 + Math.pow(R(), 1.3) * 50, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z, 3.5, .5) || (woods(x, z) < .44 && R() > .3)) continue;
      // (in drifts: a few of a kind together)
      const kind = key === 'tundra' || key === 'desert' ? (R() < .55 ? 'bush' : ['stone1', 'stone2', 'stone3'][Math.floor(R() * 3)]) : ['bush', 'bush', 'fern', 'flowers', 'blooms', 'blooms'][Math.floor(R() * 6)];
      for (let j = 0; j < 3 && n < cover; j++) if (put(kind, x + (R() - .5) * 2.4, z + (R() - .5) * 2.4, /stone/.test(kind) ? .14 + R() * .12 : (kind === 'bush' ? 1.2 : 1) + R() * .6)) n++;
    }
    // (meadows of wildflowers in the open, and mushrooms under the coast's trees)
    if (key === 'coast' || key === 'forest') for (let m = 0, n = 0; m < 600 && n < 18; m++) {
      const a = R() * Math.PI * 2, d = LOT + 6 + R() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z, 5, 1) || woods(x, z) > .5) continue;
      for (let j = 0; j < 14; j++) { const b = R() * Math.PI * 2, r = Math.sqrt(R()) * 3.2; put(R() < .6 ? 'blooms' : 'flowers', x + Math.cos(b) * r, z + Math.sin(b) * r, .9 + R() * .5); }
      n++;
    }
    if (key === 'coast') for (let i = 0, n = 0; i < 2000 && n < 50 * detail; i++) {
      const a = R() * Math.PI * 2, d = LOT + 7 + R() * 50, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (ok(x, z, 6, 1) && woods(x, z) >= .5 && put(['toadstool', 'mushroom', 'mushrooms'][n % 3], x, z, MUSHROOM())) n++;
    }
    // (flowers and bushes round each hamlet's edge; in the snow and the sand, bushes)
    for (const h of places.filter(p => p.hamlet)) for (let i = 0; i < 10; i++) { const a = R() * Math.PI * 2, d = h.r + R() * 3; const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d; if (ok(x, z, 4, -h.r)) put(key === 'tundra' || key === 'desert' ? 'bush' : ['flowers', 'blooms', 'bush'][i % 3], x, z, .8 + R() * .3); }
    return out;
  }
  /** For the checks: every piece standing inside another, or on a road or a field, that shouldn't ("a in b"). */
  function faults() {
    const room = roomOf(places, shape), bad = [], crops = new Set(['rye', 'sunflower', 'smoke']);
    for (const [name, list] of Object.entries(built?.spots || {})) if (!crops.has(name)) for (const p of list) {
      if (!room.take(name, p.x, p.z, p.s, p.r)) { bad.push(`${name} in ${room.last} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`); room.take(name, p.x, p.z, p.s, p.r, true); }
    }
    return bad;
  }
  // the models' scale: trees stand ~4.6 tiles tall whatever their model (stumps less), bushes and plants at .8 a
  // metre, rocks as given; the village's pieces their metres times what's given per piece
  const TALL = {tree: 4.6, stump: .9}, UNIT = {cover: .8, rock: 1};
  const kindOf = name => /pine|oak|birch|deciduous|willow|Stump|stump/.test(name) ? 'tree' : /bush|fern|flower|bloom/.test(name) ? 'cover' : /rock|stone/.test(name) ? 'rock' : 'piece';
  const sectors = list => {
    const by = new Map(), cell = SIZE / 4;
    for (const p of list) { const k = Math.floor((p.x + SIZE / 2) / cell) * 4 + Math.floor((p.z + SIZE / 2) / cell); if (by.has(k)) by.get(k).push(p); else by.set(k, [p]); }
    return [...by.values()];
  };
  function instanced(name, list, asset) {
    const g = new T.Group(); g.name = 'keep-nature-' + name;
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
    const kind = kindOf(name), Th = THEMES[key];
    const unit = kind === 'tree' ? (/stump|Stump/.test(name) ? TALL.stump : TALL.tree) / Math.max(.1, asset.height) : UNIT[kind] || 1;
    asset.parts.forEach(([geometry, material]) => {
      let mat = material;
      // (frost on the tundra's trees and bushes; red rock in the desert)
      if (Th.frost && (kind === 'tree' || kind === 'cover') && !/bark|trunk/i.test(material.name)) { mat = own(material.clone()); mat.color.lerp(new T.Color(0xf2f6fa), kind === 'cover' ? .8 : Th.frost); }
      if (Th.redRock && kind === 'cover') { mat = own(material.clone()); mat.color.setRGB(.82, .66, .42); } // (dry scrub)
      if (Th.redRock && kind === 'rock') { mat = own(material.clone()); mat.color.setRGB(1.25, .82, .62); }
      // (trees in batches by quarter of the land, 4 x 4, so the ones off the screen aren't drawn: the woods are
      // thousands of them; the rest one batch each)
      for (const part of kind === 'tree' ? sectors(list) : [list]) {
        const mesh = new T.InstancedMesh(geometry, mat, part.length);
        part.forEach((p, i) => {
          q.setFromAxisAngle(UP, p.r); const s = p.s * unit; sc.set(s, s, s);
          mesh.setMatrixAt(i, m4.compose(v.set(p.x, p.y - .05, p.z), q, sc));
        });
        mesh.computeBoundingSphere(); mesh.raycast = () => {};
        // (no shadows cast: a batch spans much of the land, and would be drawn into the sun's shadow every frame)
        mesh.castShadow = false; mesh.receiveShadow = kind !== 'cover';
        g.add(mesh);
      }
    });
    if (asset.fan) {
      // a windmill's sails: their own instances, turned each frame about the hub (update)
      const hub = asset.hub;
      asset.fan.forEach(([geometry, material]) => {
        const mesh = new T.InstancedMesh(geometry, material, list.length);
        mesh.userData.axis = asset.axis;
        mesh.userData.sails = list.map(p => new T.Matrix4().compose(new T.Vector3(p.x, p.y - .05, p.z), new T.Quaternion().setFromAxisAngle(UP, p.r), new T.Vector3(p.s, p.s, p.s)).multiply(hub));
        mesh.computeBoundingSphere(); mesh.raycast = () => {}; mesh.frustumCulled = false;
        g.add(mesh); sails.push(mesh);
      });
    }
    return g;
  }
  /** Plain 3D stand-ins (until their models are in, or if they fail): tiered cones and crowns for trees, faceted lumps for rocks. */
  function plain(list, rock) {
    const g = new T.Group();
    const needles = own(new T.MeshStandardMaterial({color: THEMES[key].frost ? 0xb8c8c6 : key === 'desert' ? 0x6a5a3a : 0x27472c, roughness: .9, flatShading: true}));
    const bark = own(new T.MeshStandardMaterial({color: 0x4f3626, roughness: .9}));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
    if (rock) {
      const mesh = new T.InstancedMesh(own(new T.DodecahedronGeometry(3, 0)), own(new T.MeshStandardMaterial({color: key === 'desert' ? 0xa86a4a : 0x7a7a74, roughness: 1, flatShading: true})), list.length);
      list.forEach((p, i) => mesh.setMatrixAt(i, m4.compose(v.set(p.x, p.y + p.s, p.z), q.setFromAxisAngle(new T.Vector3(.3, 1, .2).normalize(), p.r), sc.set(p.s * 1.4, p.s * .8, p.s))));
      mesh.raycast = () => {}; g.add(mesh); return g;
    }
    // (open cones and an open trunk: their bases are never seen, and the far woods are hundreds of them)
    const tiers = [own(new T.ConeGeometry(1.5, 2.4, 7, 1, true)), own(new T.ConeGeometry(1.1, 2, 7, 1, true))], crown = own(new T.IcosahedronGeometry(1.7, 0)), trunk = own(new T.CylinderGeometry(.18, .24, 1.2, 5, 1, true));
    const dead = key === 'desert', c = new T.Color(), base = needles.color.clone();
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
      const tr = new T.InstancedMesh(trunk, bark, list.length);
      list.forEach((p, i) => tr.setMatrixAt(i, m4.compose(v.set(p.x, p.y + .6 * p.s, p.z), q.identity(), sc.set(p.s, p.s, p.s))));
      tr.raycast = () => {}; g.add(tr);
    }
    return g;
  }

  // ---- what moves: windmill sails, chimney smoke, the forest's fireflies, the tundra's snow
  let sails = [], smoke = null, motes = null;
  function puffTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return own(t);
  }
  /** Smoke rising from the cottages' chimneys: a column of soft puffs, each drifting up and fading (camera-facing). */
  function chimneySmoke(chimneys) {
    if (!chimneys?.length) return null;
    const PER = 7, mesh = new T.InstancedMesh(own(new T.PlaneGeometry(1, 1)), own(new T.MeshBasicMaterial({map: puffTexture(), color: 0xc8c4bc, transparent: true, depthWrite: false, opacity: .55, fog: true})), chimneys.length * PER);
    mesh.frustumCulled = false; mesh.raycast = () => {}; mesh.renderOrder = 5;
    return {mesh, chimneys, PER};
  }
  /** Fireflies drifting among the trees, or snow falling round the lot: one draw call of points, moved in the shader. */
  function particles(kind) {
    if (!kind) return null;
    const n = kind === 'snow' ? Math.round(1400 * detail) : Math.round(260 * detail), R = rngOf(77), pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (kind === 'snow') pos.set([(R() - .5) * 150, R() * 40, (R() - .5) * 150], i * 3);
      else { const a = R() * Math.PI * 2, d = LOT + 4 + R() * 40; const x = Math.cos(a) * d, z = Math.sin(a) * d; pos.set([x, shape.height(x, z) + .4 + R() * 2.2, z], i * 3); }
      seed[i] = R() * 100;
    }
    const g = own(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('seed', new T.BufferAttribute(seed, 1));
    const m = own(new T.ShaderMaterial({transparent: true, depthWrite: false, blending: kind === 'snow' ? T.NormalBlending : T.AdditiveBlending,
      uniforms: {time: {value: 0}, size: {value: kind === 'snow' ? 7 : 9}, color: {value: new T.Color(kind === 'snow' ? 0xffffff : 0xc8ff7a)}},
      vertexShader: `uniform float time, size; attribute float seed; varying float vGlow;
        void main() {
          vec3 p = position;
          ${kind === 'snow'
    ? 'p.y = mod(p.y - time * (1.6 + fract(seed) * 1.2), 40.0); p.x += sin(time * .6 + seed) * 1.2; p.z += cos(time * .5 + seed) * 1.2; vGlow = 1.0;'
    : 'p.x += sin(time * .7 + seed) * 1.4; p.z += cos(time * .6 + seed * 1.3) * 1.4; p.y += sin(time * 1.3 + seed) * .35; vGlow = .5 + .5 * sin(time * 3.0 + seed * 7.0);'}
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (60.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 color; varying float vGlow;
        void main() { float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(color, (1.0 - d * 2.0) * vGlow * ${kind === 'snow' ? '.85' : '1.0'}); }`}));
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.raycast = () => {}; pts.renderOrder = 6;
    return {pts, m};
  }

  let natureGroup = null;
  function build() {
    const b = {terrain: terrain(), water: waterPlane(), sky: own(skyTexture(T, THEMES[key].sky[0], THEMES[key].fog)), spots: placements()};
    group.add(b.terrain); if (b.water) group.add(b.water);
    smoke = chimneySmoke(b.spots.smoke); if (smoke) group.add(smoke.mesh);
    motes = particles(THEMES[key].fx); if (motes) group.add(motes.pts);
    built = b;
    plant();
    Promise.all([loadPack(T, 'nature.glb'), loadPack(T, 'village.glb')]).then(() => { if (!dead && built === b) { plant(); onChange(); } });
  }
  function plant() {
    if (natureGroup) { group.remove(natureGroup); natureGroup.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }
    natureGroup = new T.Group(); natureGroup.name = 'keep-nature'; sails = [];
    const models = {...(packs['nature.glb'] || {}), ...(packs['village.glb'] || {})};
    for (const [name, list] of Object.entries(built.spots)) {
      if (!list.length || name === 'smoke') continue;
      const asset = models[name];
      if (asset) natureGroup.add(instanced(name, list, asset));
      // (without its model: trees and rocks plain 3D; the village's pieces and the undergrowth wait for theirs)
      else if (kindOf(name) === 'tree' || kindOf(name) === 'rock') natureGroup.add(plain(list, kindOf(name) === 'rock'));
    }
    group.add(natureGroup);
  }
  function clear() {
    if (natureGroup) { natureGroup.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); natureGroup = null; }
    if (smoke) { smoke.mesh.dispose(); smoke = null; }
    sails = []; motes = null;
    group.clear();
    owned.splice(0).forEach(x => x.dispose && x.dispose());
    built = null;
  }
  build();

  const m4 = new T.Matrix4(), turn = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
  /** One frame of what moves (seconds; camera: smoke faces it). → whether anything's moving (more frames wanted). */
  function update(seconds, {camera, still = false} = {}) {
    if (dead) return false;
    const t = still ? 0 : seconds;
    sails.forEach(mesh => {
      const spin = {x: 'makeRotationX', y: 'makeRotationY', z: 'makeRotationZ'}[mesh.userData.axis || 'z'];
      mesh.userData.sails.forEach((at, i) => mesh.setMatrixAt(i, m4.copy(at).multiply(turn[spin](t * .9 + i * 1.7))));
      mesh.instanceMatrix.needsUpdate = true;
    });
    if (smoke && camera) {
      let n = 0;
      smoke.chimneys.forEach((h, j) => {
        for (let i = 0; i < smoke.PER; i++) {
          const life = ((t * .16 + i / smoke.PER + j * .37) % 1), s = .3 + life * 1.4;
          v.set(h.x + Math.sin(t * .5 + i) * .15 + life * .9, h.y + .15 + life * 4.5, h.z + life * .45);
          smoke.mesh.setMatrixAt(n++, m4.compose(v, camera.quaternion, sc.set(s, s, s)));
        }
      });
      smoke.mesh.instanceMatrix.needsUpdate = true;
    }
    if (motes) motes.m.uniforms.time.value = t;
    return !still && (sails.length > 0 || !!smoke || !!motes);
  }

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
    group, ground, update,
    get theme() { return key; },
    get light() { const Th = THEMES[key]; return {sky: Th.sky, fog: Th.fog, sun: Th.sun, hemi: Th.hemi}; },
    /** The sky (scene.background), its colours the land's. */
    get background() { return built?.sky || null; },
    /** The village's places (hamlets, fields, windmills, landmarks), for the checks. */
    get places() { return places; },
    /** For the checks: where each piece stands, by model name. */
    get spots() { return built?.spots || null; },
    faults,
    /** How far the camera may wander from the lot's middle (tiles) and the land's half-side. */
    extent: 70, half: SIZE / 2,
    heightAt: (x, z) => shape.height(x, z),
    setTheme(k) {
      const next = themeOf(k);
      if (next === key || dead) return false;
      clear(); key = next; places = placesOf(key); shape = shapeOf(key, places); build(); onChange();
      return true;
    },
    dispose() { if (dead) return; dead = true; clear(); group.removeFromParent(); }
  };
}
/** For the checks: the lands this draws. */
export const THEME_KEYS = Object.freeze(Object.keys(THEMES));
