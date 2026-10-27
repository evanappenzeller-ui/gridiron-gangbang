// Keepfall's reworked buildings (Evan, Oct 26 2026: "The low level buildings need more detail. They are too small and
// hard to tell what they are. Rework the designs"). Each design fills its lot and stands round a landmark that says
// what it is: the Builder's Hut's hammer sign and scaffold, the Gold Mine's winding wheel and ore cart, the Brewery's
// copper kettle and chimney, the Treasury's gold dome and coin, the Cellar's great cask door and tankard sign, the War
// Camp's pavilion and standard, the Hatchery's horns and eggs, the Trebuchet's shot and braziers, the Pitch Cauldron's
// gantry over its pot. The low stages of the kinds whose imported art was small and flat are drawn here, and their
// later stages too where the imported ones would have stood smaller than the new first stage (a level never looks
// like a step down); the Barracks is a drill yard (its imported tower taken out, Oct 27 2026, Evan: "Remove the tower in
// the middle of the barracks").
// Built in tiles at the kind's own footprint (its lot centred on the origin, y up, the camera looking from +x +z) from
// the imported models' materials (their planks, stone, roof tiles, gold, canvas, straw) and a few of their meshes (the
// cottage, the brewhouse, the mine's rock). realm-buildings.js adopts each in place of the
// imported stage; nothing here reads or writes a player's save.
let T, BU, ctx;
/** Every design: kind-stage → (kit, stage). */
export const DESIGNS = Object.freeze({
  'hut-1': hut,
  'mine-1': mine, 'mine-2': mine, 'mine-3': mine,
  'farm-1': brewery, 'farm-2': brewery,
  'granary-1': cellar,
  'treasury-1': treasury, 'treasury-2': treasury, 'treasury-3': treasury,
  'camp-1': camp, 'camp-2': camp, 'camp-3': camp,
  'hatchery-1': hatchery, 'hatchery-2': hatchery, 'hatchery-3': hatchery,
  'trebuchet-1': trebuchet, 'trebuchet-2': trebuchet, 'trebuchet-3': trebuchet,
  'cauldron-1': cauldron, 'cauldron-2': cauldron, 'cauldron-3': cauldron,
  'barracks-1': barracks, 'barracks-2': barracks, 'barracks-3': barracks
});
// Plain colours for what the packs have no material for (each a shared, named material); the packs' own when missing.
const PLAIN = {
  timber: [0x8a5a36], mat_brick: [0x4a4648], mat_floorTile: [0x8e8b86], mat_roof: [0xa8443a], gold: [0xffbd33, {metalness: .75, roughness: .32}],
  canvas: [0xd1c29e], banner: [0x8c1a24], straw: [0xc79e4d], egg: [0x8c7560], boulder: [0x84807a], pole: [0x59402a],
  ember: [0xff7a1e, {emissive: 0xff5a14, emissiveIntensity: 1.4}],
  'll-iron': [0x3d4045, {metalness: .6, roughness: .45}], 'll-copper': [0xc8743a, {metalness: .55, roughness: .33}],
  'll-dark': [0x14100d, {roughness: 1}], 'll-earth': [0x6f5b40, {roughness: 1}], 'll-sand': [0xb39a6a, {roughness: 1}],
  'll-grass': [0x5d7a36, {roughness: .95}], 'll-yellow': [0xe7b43a, {roughness: .6}], 'll-foam': [0xf4ebd4, {roughness: .7}],
  'll-pitch': [0x1c1816, {roughness: .2, metalness: .15}], 'll-bone': [0xe6dcc1, {roughness: .55}], 'll-hops': [0x6f9a3c, {roughness: .8}],
  'll-teal': [0x2f8f8a, {roughness: .4, emissive: 0x0b2b2a}], 'll-crimson': [0xa3243a, {roughness: .4, emissive: 0x2a0710}],
  'll-violet': [0x5b3c9a, {roughness: .4, emissive: 0x150c2a}], 'll-red': [0x9b2230, {roughness: .8}]
};
// How many times a material's texture repeats across a tile (its pattern sized to read from the game's camera).
const DENSITY = {timber: 2.6, mat_brick: 2.2, mat_floorTile: 1.6, mat_roof: 2.2};
const rng = seed => (seed = Math.abs(Math.round(seed)) % 2147483646 + 1, () => (seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------------------------------------------- the kit
// Parts go in by material; build() merges each material's into one mesh. A textured material's parts are given texture
// co-ordinates projected from their faces (so the planks and stones keep one size whatever the part's size); the
// imported meshes keep their own.
class Kit {
  constructor() { this.parts = new Map(); }
  put(geo, mat, at = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], project = true) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...at), new T.Quaternion().setFromEuler(new T.Euler(...rot)), new T.Vector3(...scl)));
    if (project || !g.attributes.uv) {
      const p = g.attributes.position, n = g.attributes.normal, d = DENSITY[mat] || 1, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
        uv[i * 2] = u * d; uv[i * 2 + 1] = v * d;
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    }
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  /** A box w x h x d standing on `at` (its base's middle). */
  box(w, h, d, mat, at = [0, 0, 0], rot = [0, 0, 0]) { return this.put(new T.BoxGeometry(w, h, d), mat, [at[0], at[1] + h / 2, at[2]], rot); }
  /** A cylinder (rt at its top, rb at its foot) standing on `at`, or centred on it (o.mid). */
  cyl(rt, rb, h, mat, at = [0, 0, 0], o = {}) {
    return this.put(new T.CylinderGeometry(rt, rb, h, o.seg || 12, 1, !!o.open, o.from || 0, o.arc || Math.PI * 2), mat, [at[0], at[1] + (o.mid ? 0 : h / 2), at[2]], o.rot, o.scl);
  }
  /** A rod of radius r from one point to another. */
  rod(r, a, b, mat, seg = 6, r2 = r) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), dir = B.clone().sub(A);
    const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize()));
    return this.put(new T.CylinderGeometry(r2, r, dir.length(), seg), mat, A.add(B).multiplyScalar(.5).toArray(), [e.x, e.y, e.z]);
  }
  ball(r, mat, at, o = {}) { return this.put(new T.SphereGeometry(r, o.seg || 12, o.rows || 8, 0, Math.PI * 2, 0, o.cap || Math.PI), mat, at, o.rot, o.scl); }
  rock(r, mat, at, rot = [0, 0, 0], scl = [1, 1, 1]) { return this.put(new T.DodecahedronGeometry(r, 0), mat, at, rot, scl); }
  ring(r, tube, mat, at, rot = [Math.PI / 2, 0, 0], o = {}) { return this.put(new T.TorusGeometry(r, tube, o.tseg || 6, o.seg || 20, o.arc || Math.PI * 2), mat, at, rot, o.scl); }
  /** A turned shape (a pot, a kettle, a dome) from [radius, height] points, standing on `at`. */
  lathe(points, mat, at, seg = 14, scl) { return this.put(new T.LatheGeometry(points.map(([r, y]) => new T.Vector2(r, y)), seg), mat, at, [0, 0, 0], scl); }
  /** A ridge tent (or a gable): a triangle w wide, h high, run l along z, turned deg about y. */
  prism(w, h, l, mat, at, deg = 0) {
    const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
    const g = new T.ExtrudeGeometry(s, {depth: l, bevelEnabled: false}); g.translate(0, 0, -l / 2);
    return this.put(g, mat, at, [0, deg * Math.PI / 180, 0]);
  }
  /** One of the imported models' meshes (by its material), its feet at `at`, fitted to `width` across (y scaled by
   *  o.tall), turned deg; false when that model isn't in. */
  piece(key, mat, at, width, o = {}) {
    const g = ctx.piece(key, mat);
    if (!g) return false;
    g.computeBoundingBox();
    const b = g.boundingBox, c = b.getCenter(new T.Vector3()), sz = b.getSize(new T.Vector3());
    g.translate(-c.x, -b.min.y, -c.z);
    const s = width / Math.max(sz.x, sz.z);
    this.put(g, mat, at, [0, (o.deg || 0) * Math.PI / 180, 0], [s, s * (o.tall || 1), s], false);
    return true;
  }
  build() {
    const group = new T.Group();
    for (const [name, list] of this.parts) {
      const geo = BU.mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new T.Mesh(geo, ctx.material(name, ...(PLAIN[name] || [0x888888])));
      mesh.name = 'll-' + name;
      group.add(mesh);
    }
    return group;
  }
}

// ---------------------------------------------------------------------------------------------------- small things
/** A heap of gold nuggets r across at `at`. */
function gold(k, r, n, seed, at) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r, s = r * (.12 + R() * .08);
    k.rock(s, 'gold', [at[0] + Math.cos(a) * d, at[1] + s * .6 + (1 - d / r) * r * .45, at[2] + Math.sin(a) * d], [R() * 3, R() * 3, R() * 3]);
  }
}
/** A barrel r round, len long, its middle at `at`, standing (y) or lying along x or z; iron hoops. */
function barrel(k, r, len, at, axis = 'y', mat = 'timber') {
  const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const d = axis === 'x' ? [1, 0, 0] : axis === 'z' ? [0, 0, 1] : [0, 1, 0];
  k.put(new T.LatheGeometry([[0, -len / 2], [r * .84, -len / 2], [r, 0], [r * .84, len / 2], [0, len / 2]].map(([x, y]) => new T.Vector2(x, y)), 10), mat, at, rot);
  for (const f of [-.32, .32]) k.put(new T.CylinderGeometry(r * .94, r * .94, len * .08, 10, 1, true), 'll-iron', at.map((v, i) => v + d[i] * f * len), rot);
}
/** A brazier: an iron post and bowl, its fire glowing. */
function brazier(k, at, h = .42) {
  k.cyl(.025, .035, h, 'll-iron', at, {seg: 6});
  k.lathe([[0, 0], [.1, .02], [.13, .1], [.12, .11]], 'll-iron', [at[0], at[1] + h, at[2]], 8);
  k.put(new T.ConeGeometry(.08, .17, 6), 'ember', [at[0], at[1] + h + .14, at[2]]);
}
/** A pennant on a pole: pole h high at `at`, a flag w x fh flying towards +x+z. */
function standard(k, at, h, w = .5, fh = .7, mat = 'banner') {
  k.cyl(.03, .04, h, 'pole', at, {seg: 6});
  k.ball(.06, 'gold', [at[0], at[1] + h + .04, at[2]]);
  k.box(w, fh, .025, mat, [at[0] + w / 2 * Math.SQRT1_2 + .02, at[1] + h - fh - .05, at[2] + w / 2 * Math.SQRT1_2 + .02], [0, -Math.PI / 4, 0]);
  k.box(w * .8, .05, .03, 'gold', [at[0] + w / 2 * Math.SQRT1_2 + .02, at[1] + h - fh * .35, at[2] + w / 2 * Math.SQRT1_2 + .02], [0, -Math.PI / 4, 0]);
}
/** A lot's ground: a slab s across (a little in from its edge), its rim a kerb of stone. */
function ground(k, s, mat, kerb = 'mat_brick', h = .05) {
  k.box(s - .14, h, s - .14, mat);
  if (kerb) for (const [x, z, w, d] of [[0, s / 2 - .1, s - .12, .1], [0, -s / 2 + .1, s - .12, .1], [s / 2 - .1, 0, .1, s - .32], [-s / 2 + .1, 0, .1, s - .32]]) k.box(w, h + .04, d, kerb, [x, 0, z]);
}
/** A timber crate, c across, standing on `at`. */
function crate(k, c, at, deg = 0) {
  k.box(c, c, c, 'timber', at, [0, deg, 0]);
  k.box(c * 1.03, c * .12, c * 1.03, 'll-iron', [at[0], at[1] + c * .44, at[2]], [0, deg, 0]);
}

// ---------------------------------------------------------------------------------------------------- the designs
/** Builder's Hut (2 tiles): the cottage, a scaffold up its side, a yellow sign with a great hammer, timber and stone. */
function hut(k) {
  ground(k, 2, 'll-earth', null, .04);
  if (!k.piece('hut-1', 'House1', [-.22, .04, -.24], 1.32)) {
    k.box(.95, .62, .8, 'timber', [-.22, .04, -.24]); k.prism(1.05, .5, .95, 'mat_roof', [-.22, .66, -.24], 90);
  }
  // the scaffold
  const sx = [.5, .86], sz = [-.78, -.1];
  sx.forEach(x => sz.forEach(z => k.cyl(.025, .025, 1.08, 'timber', [x, .04, z], {seg: 5})));
  [.48, .9].forEach(y => k.box(.46, .04, .78, 'timber', [.68, y, -.44]));
  k.rod(.018, [.86, .1, -.78], [.86, .9, -.1], 'timber', 4);
  k.rod(.018, [.5, .1, -.1], [.86, .48, -.1], 'timber', 4);
  // the sign: a post, an arm, a yellow board, a great hammer across it
  k.cyl(.035, .04, 1.18, 'timber', [.62, .04, .64], {seg: 6});
  k.box(.04, .04, .4, 'timber', [.62, 1.12, .46]);
  k.box(.07, .5, .5, 'll-yellow', [.62, .52, .4]);
  k.rod(.03, [.67, .5, .14], [.67, 1.0, .62], 'timber', 6);
  k.box(.1, .17, .36, 'll-iron', [.68, .9, .55], [Math.PI / 4, 0, 0]);
  // planks, stone blocks, a sawhorse with its log
  for (let row = 0; row < 3; row++) for (let i = 0; i < 3; i++) {
    const along = row % 2 === 0;
    k.box(along ? .58 : .09, .05, along ? .09 : .58, 'timber', [-.58 + (along ? 0 : (i - 1) * .2), .04 + row * .05, .6 + (along ? (i - 1) * .2 : 0)]);
  }
  k.box(.2, .17, .2, 'mat_floorTile', [.08, .04, .72]); k.box(.2, .17, .2, 'mat_floorTile', [.28, .04, .58], [0, .4, 0]);
  k.box(.18, .15, .18, 'mat_floorTile', [.17, .21, .66], [0, .2, 0]);
  [-.12, .12].forEach(o => { k.rod(.015, [.82 + o, .04, .02], [.82 + o, .22, .14], 'timber', 4); k.rod(.015, [.82 + o, .04, .26], [.82 + o, .22, .14], 'timber', 4); });
  k.cyl(.07, .07, .42, 'timber', [.82, .26, .14], {mid: true, rot: [0, 0, Math.PI / 2], seg: 8});
}

/** Gold Mine (3 tiles): a rocky hill, a timbered adit, a winding wheel high on its headframe, an ore cart on its rails,
 *  heaps of gold; a second cart (stage 2), then ore crates and a bigger wheel (stage 3). */
function mine(k, stage) {
  const g = stage - 1;
  ground(k, 3, 'll-earth', null, .05);
  const rock = ['Rock2', 'Rock1', 'Rock3'][g];
  if (!k.piece('mine-' + stage, rock, [-.35, 0, -.55], 2.25 + g * .1, {tall: 1.45, deg: 10})) {
    [[-.5, -.6, .7], [.1, -.8, .55], [-.9, -.1, .5]].forEach(([x, z, r], i) => k.rock(r, 'boulder', [x, r * .55, z], [i, i * 2, 0], [1, .9, 1]));
  }
  // the adit: a timber frame round a dark mouth, a lantern at its side
  const ax = -.4, az = .32;
  k.box(.64, .78, .5, 'll-dark', [ax, .05, az - .2]);
  [-.36, .36].forEach(o => k.box(.11, .9, .12, 'timber', [ax + o, .05, az]));
  k.box(.94, .14, .16, 'timber', [ax, .92, az]);
  k.box(.06, .06, .14, 'timber', [ax + .5, .7, az]); k.box(.08, .12, .08, 'ember', [ax + .56, .58, az + .04]);
  // the headframe and its winding wheel
  const hx = .78, hz = -.62, H = 1.75 + g * .2, R = .3 + g * .04;
  [-1, 1].forEach(side => {
    const px = hx + side * .2;
    k.rod(.045, [px, .05, hz - .55], [px, H, hz], 'timber', 5);
    k.rod(.045, [px, .05, hz + .5], [px, H, hz], 'timber', 5);
    k.rod(.03, [px, .5, hz - .38], [px, .5, hz + .35], 'timber', 4);
  });
  k.box(.52, .08, .12, 'timber', [hx, H - .04, hz]);
  const wheel = [hx, H + R * .1, hz];
  k.ring(R, .035, 'll-iron', wheel, [0, Math.PI / 2, 0], {seg: 22});
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    k.rod(.014, wheel, [wheel[0], wheel[1] + Math.sin(a) * R, wheel[2] + Math.cos(a) * R], 'll-iron', 4);
  }
  k.cyl(.05, .05, .5, 'll-iron', wheel, {mid: true, rot: [0, 0, Math.PI / 2], seg: 6});
  k.rod(.01, [hx, wheel[1] - R, hz + .02], [hx, .2, hz + .02], 'pole', 3);
  // the rails out of the adit to the yard, sleepers under them, the ore cart on them heaped with gold
  for (let i = 0; i < 7; i++) k.box(.36, .03, .07, 'timber', [ax, .05, az + .12 + i * .16]);
  [-.11, .11].forEach(o => k.box(.035, .035, 1.1, 'll-iron', [ax + o, .08, az + .6]));
  const cart = (x, z, seed) => {
    k.put(new T.CylinderGeometry(.24, .18, .22, 4, 1), 'timber', [x, .25, z], [0, Math.PI / 4, 0], [1.1, 1, 1.3]);
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => k.cyl(.065, .065, .04, 'll-iron', [x + sx * .14, .13, z + sz * .16], {mid: true, rot: [0, 0, Math.PI / 2], seg: 8})));
    gold(k, .2, 9, seed, [x, .33, z]);
  };
  cart(ax, az + .9, 3);
  if (g >= 1) cart(.25, 1.0, 5);
  // gold heaped in the yard, a pick on a crate
  gold(k, .42 + g * .06, 14 + g * 6, 7, [.82, .05, .62]);
  crate(k, .26, [.98, .05, -.05], .3);
  k.rod(.018, [.92, .05, .16], [.92, .58, .28], 'timber', 4);
  k.ring(.15, .022, 'll-iron', [.92, .6, .3], [0, Math.PI / 2, Math.PI / 2], {arc: Math.PI, seg: 8});
  if (g >= 2) { crate(k, .24, [1.05, .05, .32], -.2); gold(k, .1, 5, 9, [1.05, .31, .32]); crate(k, .24, [-1.1, .05, .95], .1); }
}

/** Brewery (3 tiles, its first two stages): the brewhouse, a copper kettle on its brick hearth with a tall chimney
 *  beside it, an open mash tun foaming, barrels racked by the door; the bigger brewhouse and a second kettle later. */
function brewery(k, stage) {
  const g = stage - 1;
  ground(k, 3, 'mat_floorTile');
  if (!k.piece('farm-' + stage, 'WoodenHouse', [-.42, .05, -.46], 1.9 + g * .05)) {
    k.box(1.3, .85, 1.1, 'timber', [-.42, .05, -.46]); k.prism(1.4, .6, 1.2, 'mat_roof', [-.42, .9, -.46], 90);
  }
  // the kettle (two later) on its hearth, the fire under it, its pipe into the brewhouse
  const kettle = (kx, kz, r) => {
    k.cyl(r * 1.05, r * 1.14, .3, 'mat_brick', [kx, .05, kz], {seg: 10});
    k.box(.2, .12, .06, 'ember', [kx + r * .52, .1, kz + r * .88], [0, Math.PI / 4, 0]);
    k.lathe([[0, 0], [r * .83, .02], [r, .16], [r, .38], [r * .78, .52], [r * .3, .6], [r * .17, .7]], 'll-copper', [kx, .35, kz], 16);
    k.ring(r, .025, 'll-copper', [kx, .55, kz]);
    k.rod(.045, [kx, 1.04, kz], [kx - .45, 1.1, kz - .45], 'll-copper', 6);
    k.rod(.045, [kx - .45, 1.1, kz - .45], [kx - .62, .95, kz - .62], 'll-copper', 6);
  };
  kettle(.72, .62, .46);
  if (g) kettle(1.0, -.62, .34);
  // the chimney
  const cx = 1.12, cz = .02;
  k.box(.26, 1.85 + g * .2, .26, 'mat_brick', [cx, .05, cz]);
  k.box(.32, .08, .32, 'mat_brick', [cx, 1.9 + g * .2, cz]);
  k.box(.2, .02, .2, 'll-dark', [cx, 1.98 + g * .2, cz]);
  // the mash tun: an open vat of foaming wort on its stand
  const tx = g ? -1.0 : .98, tz = g ? .9 : -.7;
  k.box(.6, .1, .6, 'timber', [tx, .05, tz]);
  k.lathe([[.27, 0], [.3, .42], [.27, .42], [.24, .04], [0, .04]], 'timber', [tx, .15, tz], 12);
  [.1, .32].forEach(y => k.ring(.29 + y * .07, .02, 'll-iron', [tx, .15 + y, tz], undefined, {seg: 14}));
  k.cyl(.26, .26, .03, 'll-foam', [tx, .5, tz], {seg: 12});
  k.rod(.018, [tx - .1, .4, tz + .1], [tx + .18, .82, tz - .1], 'timber', 4);
  // barrels racked by the door, one standing with a tankard on it
  const bx = g ? .02 : -.75;
  k.box(.7, .06, .3, 'timber', [bx, .05, .98]);
  [-.2, .2].forEach(o => barrel(k, .15, .34, [bx + o, .26, .98], 'z'));
  barrel(k, .15, .34, [bx, .53, .98], 'z');
  const sx = g ? -.62 : .02;
  barrel(k, .16, .36, [sx, .23, 1.06]);
  k.cyl(.06, .06, .12, 'timber', [sx, .41, 1.06], {seg: 8}); k.cyl(.065, .065, .04, 'll-foam', [sx, .53, 1.06], {seg: 8});
}

/** Cellar (3 tiles, its first stage): a grassy mound, a stone arch with a great cask's head for its door, lanterns
 *  either side, kegs piled, a tankard sign. */
function cellar(k) {
  ground(k, 3, 'mat_floorTile');
  k.ball(1.2, 'll-grass', [-.2, .05, -.4], {seg: 14, rows: 7, cap: Math.PI / 2, scl: [1.05, .82, .9]});
  k.ball(1.24, 'll-earth', [-.2, .02, -.4], {seg: 14, rows: 7, cap: Math.PI / 2, scl: [1.06, .3, .92]});
  // the arch
  const fx = -.2, fz = .48;
  k.box(1.36, .92, .26, 'mat_brick', [fx, .05, fz]);
  k.cyl(.68, .68, .26, 'mat_brick', [fx, .97, fz], {mid: true, rot: [Math.PI / 2, 0, 0], from: Math.PI / 2, arc: Math.PI, seg: 14});
  k.box(1.46, .08, .3, 'mat_floorTile', [fx, .05, fz]);
  // the cask's head for a door, its hoops and its tap
  const cy = .7, cz = fz + .14;
  k.cyl(.48, .48, .06, 'timber', [fx, cy, cz], {mid: true, rot: [Math.PI / 2, 0, 0], seg: 18});
  k.ring(.47, .028, 'll-iron', [fx, cy, cz + .03], [0, 0, 0], {seg: 22});
  k.ring(.32, .022, 'll-iron', [fx, cy, cz + .03], [0, 0, 0], {seg: 20});
  k.rod(.03, [fx, cy - .22, cz + .03], [fx, cy - .22, cz + .14], 'gold', 6);
  k.box(.03, .07, .03, 'gold', [fx, cy - .3, cz + .13]);
  // lanterns
  [-.82, .42].forEach(x => { k.cyl(.025, .03, .62, 'll-iron', [x, .05, fz + .26], {seg: 5}); k.box(.11, .14, .11, 'ember', [x, .67, fz + .26]); k.put(new T.ConeGeometry(.09, .08, 4), 'll-iron', [x, .85, fz + .26], [0, Math.PI / 4, 0]); });
  // a vent on the mound
  k.cyl(.12, .14, .3, 'mat_brick', [-.62, .82, -.82], {seg: 8});
  // kegs piled 3-2-1 along z, two standing
  const px = .92, pz = -.25;
  [[-1, 0], [0, 0], [1, 0], [-.5, 1], [.5, 1], [0, 2]].forEach(([i, row]) => barrel(k, .16, .4, [px, .21 + row * .27, pz + i * .32], 'x'));
  barrel(k, .15, .34, [-1.05, .22, 1.02]); barrel(k, .15, .34, [-.72, .22, 1.1]);
  // the tankard sign
  k.cyl(.035, .04, 1.3, 'timber', [.98, .05, .98], {seg: 6});
  k.box(.42, .04, .04, 'timber', [.8, 1.28, .98]);
  k.rod(.008, [.68, 1.28, .98], [.68, 1.12, .98], 'll-iron', 3);
  k.cyl(.12, .11, .26, 'timber', [.68, .86, .98], {seg: 10});
  k.ring(.12, .015, 'll-iron', [.68, .92, .98]); k.ring(.12, .015, 'll-iron', [.68, 1.06, .98]);
  k.cyl(.13, .13, .05, 'll-foam', [.68, 1.12, .98], {seg: 10}); k.ball(.07, 'll-foam', [.66, 1.18, .99], {seg: 6, rows: 4});
  k.ring(.07, .018, 'timber', [.81, .99, .98], [0, 0, 0], {arc: Math.PI, seg: 8, scl: [1, 1, 1]});
}

/** Treasury (3 tiles): a stone strongroom under a gold dome, a great coin over its iron-bound door, chests and gold
 *  heaped before it; taller, more chests and banners as it grows. */
function treasury(k, stage) {
  const g = stage - 1;
  ground(k, 3, 'mat_floorTile');
  const H = 1.0 + g * .15, w = 1.62, d = 1.42, cx = -.12, cz = -.32;
  k.box(w, H, d, 'mat_brick', [cx, .05, cz]);
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => k.box(.2, H + .04, .2, 'mat_floorTile', [cx + sx * w / 2, .05, cz + sz * d / 2])));
  k.box(w + .14, .1, d + .14, 'mat_floorTile', [cx, .05 + H, cz]);
  const top = .15 + H, r = .56 + g * .06;
  k.cyl(r, r + .04, .2, 'mat_floorTile', [cx, top, cz], {seg: 16});
  k.ball(r, 'gold', [cx, top + .2, cz], {seg: 18, rows: 9, cap: Math.PI / 2});
  k.ring(r + .02, .03, 'gold', [cx, top + .2, cz]);
  k.cyl(.02, .06, .32, 'gold', [cx, top + .2 + r, cz], {seg: 6}); k.ball(.07, 'gold', [cx, top + .55 + r, cz]);
  // the door (front, +z) and a great coin over it; another coin on the side the camera sees (+x)
  const fz = cz + d / 2;
  k.box(.44, .5, .06, 'timber', [cx, .05, fz]);
  [.16, .36, .5].forEach(y => k.box(.48, .04, .07, 'll-iron', [cx, y, fz]));
  k.box(.58, .07, .14, 'mat_floorTile', [cx, .55, fz]);
  const coin = (at, rot) => {
    k.cyl(.22, .22, .06, 'gold', at, {mid: true, rot, seg: 18});
  };
  coin([cx, H - .22, fz + .04], [Math.PI / 2, 0, 0]);
  k.ring(.16, .022, 'll-iron', [cx, H - .22, fz + .08], [0, 0, 0], {seg: 18});
  coin([cx + w / 2 + .04, .05 + H * .55, cz], [0, 0, Math.PI / 2]);
  k.ring(.16, .022, 'll-iron', [cx + w / 2 + .08, .05 + H * .55, cz], [0, Math.PI / 2, 0], {seg: 18});
  // chests and gold before it
  const chest = (x, z, deg) => {
    k.box(.34, .2, .24, 'timber', [x, .05, z], [0, deg, 0]);
    k.cyl(.12, .12, .34, 'timber', [x, .25, z], {mid: true, rot: [0, deg, Math.PI / 2], from: 0, arc: Math.PI, seg: 8});
    k.box(.36, .05, .26, 'gold', [x, .2, z], [0, deg, 0]);
    gold(k, .12, 4, Math.round(x * 100 + z * 10) + 50, [x, .28, z]);
  };
  [[.88, .62, .3], [-1.02, .55, -.2], [.98, -.62, .2], [-.6, 1.0, .1]].slice(0, 2 + g).forEach(([x, z, a]) => chest(x, z, a));
  gold(k, .44 + g * .05, 16 + g * 6, 17, [.48, .05, 1.0]);
  gold(k, .26, 8, 19, [-1.05, .05, 1.05]);
  if (g >= 1) [[-1.22, -1.22], [1.08, -1.22]].forEach(([x, z]) => standard(k, [x, .05, z], 1.5 + g * .2, .3, .55));
  if (g >= 2) for (let i = 0; i < 6; i++) k.box(.13, .13, .13, 'mat_floorTile', [cx - w / 2 + .1 + i * (w - .2) / 5, .15 + H, cz + d / 2 + .02]);
}

/** War Camp (4 tiles): a striped command pavilion, ridge tents, a campfire, a rack of spears and shields, a dummy to
 *  drill on, the camp's standard; more tents and a palisade as it grows. */
function camp(k, stage) {
  const g = stage - 1;
  ground(k, 4, 'll-sand', 'timber');
  // the pavilion
  const px = -.62, pz = -.62, pr = .78 + g * .06;
  k.cyl(pr, pr, .6, 'canvas', [px, .05, pz], {seg: 12});
  k.put(new T.ConeGeometry(pr * 1.14, .78, 12), 'banner', [px, .65 + .39, pz]);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; k.rod(.025, [px + Math.cos(a) * pr * 1.12, .66, pz + Math.sin(a) * pr * 1.12], [px, 1.42, pz], 'canvas', 3); }
  k.ring(pr + .01, .03, 'gold', [px, .64, pz], undefined, {seg: 16});
  k.box(.38, .48, .04, 'll-dark', [px + pr * .7, .05, pz + pr * .7], [0, Math.PI / 4, 0]);
  standard(k, [px, 1.42, pz], .55, .32, .22);
  // ridge tents
  const tents = [[.95, -1.15, 0], [-1.2, .95, 90], [1.25, .2, 0], [.25, 1.3, 90], [-1.45, -.15, 90]];
  tents.slice(0, 2 + g + (g >= 2 ? 1 : 0)).forEach(([x, z, deg]) => {
    k.prism(.82, .66, 1.0, 'canvas', [x, .05, z], deg);
    const along = deg ? [1, 0] : [0, 1];
    k.box(.03, .82, .03, 'pole', [x + along[0] * .52, .05, z + along[1] * .52]);
    k.box(.2, .14, .02, 'banner', [x + along[0] * .52 + .1, .72, z + along[1] * .52], [0, deg ? Math.PI / 2 : 0, 0]);
  });
  // the campfire
  const fx = .3, fz = .3;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; k.rock(.07, 'boulder', [fx + Math.cos(a) * .22, .1, fz + Math.sin(a) * .22], [i, i, 0], [1, .7, 1]); }
  k.rod(.03, [fx - .15, .08, fz - .1], [fx + .15, .08, fz + .1], 'timber', 5); k.rod(.03, [fx - .15, .08, fz + .1], [fx + .15, .08, fz - .1], 'timber', 5);
  k.put(new T.ConeGeometry(.12, .3, 6), 'ember', [fx, .24, fz]);
  // the rack of spears and shields
  const rx = 1.15, rz = 1.25;
  [-.32, .32].forEach(o => k.box(.05, .6, .05, 'timber', [rx + o * Math.SQRT1_2, .05, rz - o * Math.SQRT1_2]));
  k.rod(.022, [rx - .25, .55, rz + .25], [rx + .25, .55, rz - .25], 'timber', 4);
  for (let i = 0; i < 4; i++) { const o = -.18 + i * .12; k.rod(.012, [rx + o, .06, rz - o + .06], [rx + o, .9, rz - o], 'pole', 3); k.put(new T.ConeGeometry(.03, .1, 4), 'll-iron', [rx + o, .95, rz - o]); }
  [[-.08, .2], [.22, -.1]].forEach(([o, h]) => {
    k.cyl(.16, .16, .03, 'banner', [rx + .1 + o, .22 + h * 0, rz + .16 + o], {mid: true, rot: [Math.PI / 2 - .25, Math.PI / 4, 0], seg: 12});
    k.ball(.05, 'gold', [rx + .12 + o, .22, rz + .18 + o]);
  });
  // the drill dummy
  const dx = -.45, dz = 1.32;
  k.cyl(.03, .03, .9, 'timber', [dx, .05, dz], {seg: 5});
  k.rod(.025, [dx - .26, .7, dz], [dx + .26, .7, dz], 'timber', 4);
  k.cyl(.12, .14, .34, 'straw', [dx, .42, dz], {seg: 8}); k.ball(.1, 'straw', [dx, .88, dz], {seg: 8, rows: 6});
  // the standard
  standard(k, [1.62, .05, -1.62], 2.1 + g * .2, .55, .8);
  if (g >= 2) for (const [x, z] of [[-1.82, -1.82], [1.82, 1.82], [-1.82, 1.82]]) { k.cyl(.07, .08, .7, 'timber', [x, .05, z], {seg: 6}); k.put(new T.ConeGeometry(.07, .14, 6), 'timber', [x, .82, z]); }
}

/** Dragon Hatchery (4 tiles): a dark stone dais with a glowing channel of fire, a straw nest of great eggs, two
 *  dragon's horns rising over it, braziers; more eggs, taller horns and obelisks as it grows. */
function hatchery(k, stage) {
  const g = stage - 1;
  k.cyl(1.82, 1.9, .12, 'mat_brick', [0, 0, 0], {seg: 10});
  k.cyl(1.55, 1.6, .04, 'mat_floorTile', [0, .12, 0], {seg: 10});
  k.ring(1.12, .07, 'ember', [0, .15, 0], undefined, {seg: 28});
  // jagged black rocks round the back
  [[-1.45, -.4, .7], [-1.1, -1.1, .95], [-.4, -1.45, .7], [-1.5, .4, .5], [.4, -1.5, .5]].forEach(([x, z, h], i) =>
    k.put(new T.ConeGeometry(.22 + (i % 2) * .06, h + g * .15, 5), 'mat_brick', [x, .1 + (h + g * .15) / 2, z], [0, i, 0]));
  // the nest and its eggs
  const nx = .1, nz = .1;
  k.ring(.72, .24, 'straw', [nx, .26, nz], undefined, {scl: [1, 1, .6], seg: 16});
  k.cyl(.62, .62, .1, 'straw', [nx, .16, nz], {seg: 14});
  const eggs = [['egg', 0, 0], ['ll-teal', -.3, .2], ['ll-crimson', .28, -.22], ['ll-violet', .26, .3], ['egg', -.28, -.3]].slice(0, 3 + g);
  eggs.forEach(([mat, x, z], i) => k.ball(.25 - (i ? .03 : 0), mat, [nx + x, .5 - (i ? .04 : 0), nz + z], {scl: [1, 1.38, 1], rot: [(i % 3 - 1) * .2, 0, (i % 2 - .5) * .3]}));
  // the horns: tapering, curving up from the sides and in over the nest's back
  const horn = (base, tip, ctrl, r) => {
    const curve = new T.QuadraticBezierCurve3(new T.Vector3(...base), new T.Vector3(...ctrl), new T.Vector3(...tip)), n = 7;
    for (let i = 0; i < n; i++) {
      const a = curve.getPoint(i / n), b = curve.getPoint((i + 1) / n);
      k.rod(r * (1 - i / n) + .012, a.toArray(), b.toArray(), 'll-bone', 7, r * (1 - (i + 1) / n) + .008);
    }
  };
  const h = 1.85 + g * .3;
  horn([-1.18, .12, .38], [-.42, h, -.42], [-1.4, h * .9, .35], .2 + g * .02);
  horn([.38, .12, -1.18], [-.42, h, -.42], [.35, h * .9, -1.4], .2 + g * .02);
  // braziers at the front
  brazier(k, [1.22, .12, .78]); brazier(k, [.78, .12, 1.22]);
  if (g >= 1) [[-1.3, -1.3], [1.32, -.9], [-.9, 1.32]].slice(0, g + 1).forEach(([x, z]) => {
    k.put(new T.CylinderGeometry(.05, .17, .9 + g * .15, 4), 'mat_brick', [x, .1 + (.9 + g * .15) / 2, z], [0, Math.PI / 4, 0]);
    k.put(new T.ConeGeometry(.08, .22, 4), 'ember', [x, .1 + .9 + g * .15 + .11, z], [0, Math.PI / 4, 0]);
  });
}

/** Trebuchet (3 tiles): its catapult (a model of its own) stands in the middle; round it a flagged stone floor, its
 *  shot piled high, a crate of rope and spares, braziers on posts at the corners, stone pillars and merlons later. */
function trebuchet(k, stage) {
  const g = stage - 1;
  ground(k, 3, 'mat_floorTile', 'mat_brick', .04);
  // the shot: boulders stacked 6-3-1 in the front corner, a few more by the side
  const bx = .92, bz = .92;
  [[0, 0, 0], [.27, 0, 0], [0, 0, .27], [.27, 0, .27], [-.27, 0, .1], [.1, 0, -.27], [.13, 1, .13], [-.08, 1, .2], [.2, 1, -.08], [.08, 2, .08]]
    .forEach(([x, row, z], i) => k.rock(.15, 'boulder', [bx + x - .1, .17 + row * .22, bz + z - .1], [i, i * 2, 0]));
  [[-1.05, .95], [-.85, 1.1], [1.05, -.85]].forEach(([x, z], i) => k.rock(.13, 'boulder', [x, .15, z], [i, 1, i]));
  crate(k, .3, [-1.0, .04, -1.0], .2); crate(k, .24, [-.72, .04, -1.12], -.3);
  k.ring(.13, .04, 'straw', [-1.02, .38, -1.0], undefined, {seg: 12}); k.ring(.09, .035, 'straw', [-1.02, .44, -1.0], undefined, {seg: 12});
  // corners: braziers on posts (stage 1), on stone pillars after
  for (const [x, z] of [[1.22, -1.22], [-1.22, 1.22]]) {
    if (g) k.box(.26, .5 + g * .2, .26, 'mat_brick', [x, .04, z]);
    brazier(k, [x, g ? .54 + g * .2 : .04, z], g ? .2 : .6);
  }
  if (g >= 2) for (let i = 0; i < 9; i++) for (const [x, z] of [[-1.3 + i * .325, -1.38], [-1.38, -1.3 + i * .325]]) if (i % 2 === 0) k.box(.16, .2, .16, 'mat_brick', [x, .08, z]);
}

/** Pitch Cauldron (3 tiles): a great iron pot of boiling pitch on a brick hearth, its fire showing, a timber gantry
 *  over it with a chain and hook, pitch barrels about; pillars, then merlons as it grows. */
function cauldron(k, stage) {
  const g = stage - 1;
  ground(k, 3, 'mat_floorTile', 'mat_brick', .06);
  k.cyl(.68, .74, .4 + g * .06, 'mat_brick', [0, .06, 0], {seg: 10});
  const top = .46 + g * .06;
  [[.72, 0], [0, .72], [.5, .5]].forEach(([x, z]) => k.box(.22, .14, .06, 'ember', [x * .98, .12, z * .98], [0, Math.atan2(x, z), 0]));
  const R = .78 + g * .05;
  k.lathe([[0, 0], [R * .62, .04], [R * .92, .22], [R, .46], [R * .94, .6]], 'll-iron', [0, top, 0], 18);
  k.ring(R * .94, .05, 'll-iron', [0, top + .6, 0], undefined, {seg: 22});
  k.cyl(R * .9, R * .9, .02, 'll-pitch', [0, top + .54, 0], {seg: 18});
  const B = rng(29);
  for (let i = 0; i < 7; i++) { const a = B() * Math.PI * 2, d = B() * R * .7; k.ball(.05 + B() * .05, i % 3 ? 'll-pitch' : 'ember', [Math.cos(a) * d, top + .56, Math.sin(a) * d], {cap: Math.PI / 2, seg: 8, rows: 4}); }
  [[-1, 0], [1, 0]].forEach(([s]) => k.rod(.03, [s * R * .96, top + .5, 0], [s * (R + .12), top + .5, 0], 'll-iron', 4));
  // the gantry
  const gh = 1.85 + g * .15;
  [-1.1, 1.1].forEach(x => {
    k.rod(.05, [x, .06, -.42], [x, gh, 0], 'timber', 5); k.rod(.05, [x, .06, .42], [x, gh, 0], 'timber', 5);
    k.rod(.03, [x, .6, -.3], [x, .6, .3], 'timber', 4);
  });
  k.box(2.36, .1, .12, 'timber', [0, gh - .04, 0]);
  for (let i = 0; i < 6; i++) k.ring(.035, .012, 'll-iron', [0, gh - .1 - i * .1, 0], [0, i % 2 ? Math.PI / 2 : 0, 0], {seg: 8, tseg: 4});
  k.ring(.08, .018, 'll-iron', [0, gh - .74, 0], [0, 0, 0], {arc: Math.PI * 1.4, seg: 10, tseg: 4});
  // pitch barrels, one tipped and spilling
  barrel(k, .17, .4, [1.0, .27, 1.0]); barrel(k, .17, .4, [-1.08, .27, .98]); barrel(k, .16, .38, [1.0, .25, -1.05]);
  barrel(k, .16, .38, [.42, .22, 1.12], 'x');
  k.cyl(.26, .26, .012, 'll-pitch', [.72, .06, 1.16], {seg: 12, scl: [1.3, 1, .8]});
  if (g >= 1) for (const [x, z] of [[-1.25, -1.25], [1.28, -1.28]]) k.box(.24, .9 + g * .2, .24, 'mat_brick', [x, .06, z]);
  if (g >= 2) for (let i = 0; i < 9; i++) if (i % 2 === 0) for (const [x, z] of [[-1.3 + i * .325, 1.36], [1.36, -1.3 + i * .325]]) k.box(.16, .2, .16, 'mat_brick', [x, .1, z]);
}

/** Barracks (4 tiles): a sanded drill yard (no tower: Evan, Oct 27 2026), training dummies in rows, an archery butt,
 *  racks of weapons, a low fence and a gate, the regiment's standard. (Still drawn only once its imported stage is in,
 *  so the plain-3D fallback stands as it did.) */
function barracks(k, stage) {
  const g = stage - 1, sc = ctx.scene('barracks-' + stage);
  if (!sc) return false;
  ground(k, 4, 'll-sand', 'timber');
  // the yard's fence along the front and the camera's side, a gap for the gate
  for (const [x0, z0, x1, z1] of [[-1.75, 1.75, -.25, 1.75], [.45, 1.75, 1.75, 1.75], [1.75, 1.75, 1.75, -1.75]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / .42));
    for (let i = 0; i <= n; i++) k.box(.06, .36, .06, 'timber', [x0 + (x1 - x0) * i / n, .05, z0 + (z1 - z0) * i / n]);
    [.16, .32].forEach(y => k.rod(.02, [x0, y, z0], [x1, y, z1], 'timber', 4));
  }
  // dummies (more in rows at the back as it grows), the butt
  [[.5, .95], [1.05, .45], [-.15, 1.2]].slice(0, 2 + (g ? 1 : 0)).concat([[-1.1, -.25], [-.6, -.75], [-.1, -1.25], [-.35, .05], [.15, -.45]].slice(0, 3 + g)).forEach(([x, z]) => {
    k.cyl(.03, .03, .8, 'timber', [x, .05, z], {seg: 5}); k.rod(.022, [x - .22, .62, z], [x + .22, .62, z], 'timber', 4);
    k.cyl(.11, .13, .3, 'straw', [x, .38, z], {seg: 8}); k.ball(.09, 'straw', [x, .78, z], {seg: 8, rows: 6});
  });
  const tx = 1.25, tz = -.75;
  k.rod(.025, [tx - .1, .05, tz + .14], [tx, .7, tz], 'timber', 4); k.rod(.025, [tx + .1, .05, tz + .14], [tx, .7, tz], 'timber', 4);
  k.cyl(.27, .27, .08, 'straw', [tx, .5, tz + .08], {mid: true, rot: [Math.PI / 2 - .25, Math.PI / 4, 0], seg: 14});
  k.cyl(.17, .17, .085, 'll-red', [tx, .5, tz + .08], {mid: true, rot: [Math.PI / 2 - .25, Math.PI / 4, 0], seg: 12});
  k.cyl(.07, .07, .09, 'll-yellow', [tx, .5, tz + .08], {mid: true, rot: [Math.PI / 2 - .25, Math.PI / 4, 0], seg: 10});
  // (racks of spears: by the gate, and along the back fence)
  for (const [rx, rz] of [[-1.05, 1.2], [-1.15, -1.45]]) {
    [-.3, .3].forEach(o => k.box(.05, .56, .05, 'timber', [rx + o, .05, rz]));
    k.rod(.02, [rx - .32, .5, rz], [rx + .32, .5, rz], 'timber', 4);
    for (let i = 0; i < 4; i++) { const x = rx - .2 + i * .13; k.rod(.012, [x, .06, rz + .07], [x, .82, rz], 'pole', 3); k.put(new T.ConeGeometry(.028, .1, 4), 'll-iron', [x, .87, rz]); }
  }
  standard(k, [1.62, .05, -1.62], 2.2 + g * .25, .5, .7);
}

/** Builds design `key` (a kind-stage) → a Group in tiles, or null when it can't (its imported model isn't in). c: {T, BU,
 *  material(name, colour, options) → shared material, piece(key, material) → geometry or null, scene(key) → the
 *  imported model's scene or null}. */
export function design(key, c) {
  ({T, BU} = c); ctx = c;
  const make = DESIGNS[key], stage = +key.split('-')[1];
  if (!make) return null;
  const k = new Kit(), extra = make(k, stage);
  if (extra === false) return null;
  const group = k.build();
  if (extra) {
    // an imported model standing in the design: fitted to its width and height, its feet on the yard
    const model = extra.scene.clone(true), box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), mid = box.getCenter(new T.Vector3());
    const s = Math.min(extra.width / Math.max(size.x, size.z), extra.maxHeight / size.y);
    const holder = new T.Group();
    model.position.set(-mid.x, -box.min.y, -mid.z); holder.add(model);
    holder.scale.setScalar(s); holder.position.set(...extra.at);
    group.add(holder);
    group.userData.platformY = 0;
  }
  return group;
}
