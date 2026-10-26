/**
 * Keepfall's 3D world from the owner's Unity packs (read-only): every building family in three growth stages, the
 * wall designs, the forests/rocks/plants and the ground's tiling textures → models/realm/world-v1/.
 * node tools/realm/convert-world.mjs --source "D:/Unity/My project/Assets" --three <three r160 package> --modules <node_modules> [--out <folder>] [--only keep,mine]
 * Buildings are composed from prefabs (and a little plain geometry: gold, eggs, tents) in metres, then packed by
 * glb-pack.mjs: merged by material, largest horizontal side 1, feet at y 0. The game scales each to its saved
 * footprint; nothing here reads or writes a player's save.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createUnity, sha256} from './unity-prefab.mjs';
import {createPacker} from './glb-pack.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a, []));
if (!args.source || !args.three || !args.modules) throw Error('Required: --source <Assets> --three <three r160> --modules <node_modules>');
const out = path.resolve(args.out || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../models/realm/world-v1'));
const only = args.only ? new Set(args.only.split(',')) : null;
fs.mkdirSync(out, {recursive: true});
const U = await createUnity({assets: args.source, three: args.three, packs: ['3DForge', 'FantasyEnvironments', 'StylizedDarkCastle', 'Toon_RTS', 'Polygrade', 'Tower', 'forest']});
const {T} = U;
const P = await createPacker({T, three: args.three, modules: args.modules, out, TGALoader: U.TGALoader, textureSize: 512});

const FE = 'FantasyEnvironments/Environments/', TOWN = FE + 'Town/Prefabs/', TREES = FE + 'Ambient-Occlusion-Trees/Prefabs/', NAT = FE + 'Prefabs/';
const TD = '3DForge/TowerDefence/Humans/Prefabs/td_humans_', DC = 'StylizedDarkCastle/Prefabs/';
const ROOM = DC + 'CastlePartsRooms/', PART = DC + 'CastlePartBase/', INT = DC + 'CastleInterior/';
// Plain-colour materials for the little geometry the packs don't have (gold, eggs, canvas).
const solid = (name, rgb) => ({name, map: null, color: rgb, cutout: false});
const GOLD = solid('gold', [1, .74, .2]), CANVAS = solid('canvas', [.82, .76, .62]), STRIPE = solid('banner', [.55, .1, .14]), EGG = solid('egg', [.55, .46, .38]), STRAW = solid('straw', [.78, .62, .3]), EMBER = solid('ember', [1, .45, .12]);
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** A part: a prefab (or Group) placed at [x, y, z] metres, turned deg about y, scaled; hide drops sub-objects by name
 *  or material name (interiors the camera never sees). */
function place(src, {at = [0, 0, 0], deg = 0, scale = 1, hide = []} = {}) {
  const g = typeof src === 'string' ? U.prefab(src) : src;
  if (hide.length) g.traverse(o => {
    if (hide.some(h => o.name === h)) o.visible = false;
    if (o.isMesh) {
      const mats = [o.material].flat();
      if (mats.every(m => hide.includes(m.name))) o.visible = false;
    }
  });
  const holder = new T.Group();
  holder.add(g);
  holder.position.set(...at); holder.rotation.y = deg * Math.PI / 180;
  if (Array.isArray(scale)) holder.scale.set(...scale); else holder.scale.setScalar(scale);
  return holder;
}
const group = (...parts) => { const g = new T.Group(); parts.flat().forEach(p => p && g.add(p)); return g; };
const mesh = (geometry, rec, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => {
  const m = new T.Mesh(geometry, rec); m.position.set(...at); m.rotation.set(...rot); m.scale.set(...scale); return m;
};
/** A heap of gold: nuggets piled into a mound r metres across. */
function gold(r, n, seed) {
  const R = rng(seed), g = new T.Group();
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r, h = (1 - d / r) * r * .55;
    g.add(mesh(new T.DodecahedronGeometry(r * (.1 + R() * .08), 0), GOLD, [Math.cos(a) * d, h + r * .04, Math.sin(a) * d], [R() * 3, R() * 3, R() * 3]));
  }
  return g;
}
/** A soldier's tent: a canvas ridge tent l long with a pennant in the house colour. */
function tent(w, h, l, deg = 0) {
  const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
  const body = new T.ExtrudeGeometry(s, {depth: l, bevelEnabled: false}); body.translate(0, 0, -l / 2);
  const g = group(mesh(body, CANVAS), mesh(new T.CylinderGeometry(.04, .04, h * 1.5, 5), solid('pole', [.35, .25, .16]), [0, h * .75, l / 2 + .05]),
    mesh(new T.BoxGeometry(.02, h * .3, h * .45), STRIPE, [0, h * 1.32, l / 2 + .05 + h * .22]));
  g.rotation.y = deg * Math.PI / 180;
  return g;
}
/** A clutch of dragon eggs in a straw nest. */
function nest(r, eggs, seed) {
  const R = rng(seed), g = new T.Group();
  g.add(mesh(new T.TorusGeometry(r * .75, r * .28, 6, 14), STRAW, [0, r * .18, 0], [Math.PI / 2, 0, 0], [1, 1, .55]));
  for (let i = 0; i < eggs; i++) {
    const a = i / eggs * Math.PI * 2 + R() * .4, d = eggs > 1 ? r * .32 : 0;
    g.add(mesh(new T.SphereGeometry(r * .26, 10, 8), EGG, [Math.cos(a) * d, r * .38, Math.sin(a) * d], [R() * .4 - .2, 0, R() * .4 - .2], [1, 1.35, 1]));
  }
  return g;
}
/** A fire pit: logs and embers. */
const fire = r => group(place(INT + 'FireWood.prefab', {scale: r / 1.2}), mesh(new T.IcosahedronGeometry(r * .35, 0), EMBER, [0, r * .35, 0]));
const TIMBER = {name: 'timber', map: path.join(U.root, 'StylizedDarkCastle/Textures/tex_wood.png'), color: [.92, .84, .76], cutout: false};
const STONE = solid('boulder', [.52, .5, .47]);
U.used.add(TIMBER.map);
const corners = d => [[-d, -d], [d, -d], [-d, d], [d, d]];
/** A stone platform 12.4 m square (a dark castle room cut down to a parapet h of its 6 m). */
const platform = h => place(ROOM + 'Room_2x2_StoneTiled.prefab', {scale: [1, h, 1]});
/** Crenellations round a square of half-side `half` at height y (merlon pieces, 5 m each, two a side). */
const merlonRing = (half, y) => [[0, 1, 0, 1, 0], [0, -1, 180, -1, 0], [1, 0, 90, 0, -1], [-1, 0, -90, 0, 1]].flatMap(([nx, nz, deg, tx, tz]) =>
  [-2.5, 2.5].map(o => place(PART + 'Wall_Merlons.prefab', {at: [nx * (half - 1.13) + tx * o, y, nz * (half - 1.13) + tz * o], deg})));
/** A pile of boulders (the trebuchet's shot) r metres across at [x, z]. */
function stones(r, n, seed, [x, z]) {
  const R = rng(seed), g = new T.Group();
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * .7, s = r * (.16 + R() * .1);
    g.add(mesh(new T.DodecahedronGeometry(s, 0), STONE, [x + Math.cos(a) * d, s * .8 + (1 - d / r) * r * .25, z + Math.sin(a) * d], [R() * 3, R() * 3, R() * 3]));
  }
  return g;
}
/** A mine's mouth: its doors in a timber frame, at [x, 0, z], s its size. */
function adit(x, z, s) {
  const g = group(place(TOWN + 'WoodenWall_Gate.prefab'), mesh(new T.BoxGeometry(.5, 3.7, .5), TIMBER, [-1.75, 1.85, .1]),
    mesh(new T.BoxGeometry(.5, 3.7, .5), TIMBER, [1.75, 1.85, .1]), mesh(new T.BoxGeometry(4.4, .55, .6), TIMBER, [0, 3.75, .1]));
  g.position.set(x, 0, z); g.scale.setScalar(s);
  return g;
}
/** A palisade of sharpened logs along +x, `len` long and h high (tile units), two rails binding it. */
function palisade(len, h, n, seed) {
  const R = rng(seed), g = new T.Group();
  for (let i = 0; i < n; i++) {
    const x = (i + .5) / n * len - len / 2, hh = h * (.88 + R() * .14), r = len / n * .52;
    g.add(mesh(new T.CylinderGeometry(r, r * 1.05, hh, 6), TIMBER, [x, hh / 2, (R() - .5) * .03]), mesh(new T.ConeGeometry(r, r * 2.4, 6), TIMBER, [x, hh + r * 1.2, 0]));
  }
  for (const y of [h * .3, h * .7]) g.add(mesh(new T.BoxGeometry(len, h * .07, len / n * .5), TIMBER, [0, y, len / n * .55]));
  return g;
}

// Every building: its stages (1, 2, 3: the game maps levels to them), each composed in metres.
const BUILDINGS = {
  keep: [
    () => group(place(TD + 'Command_stage1.prefab', {scale: 1.25}), place(TD + 'castle.prefab', {at: [0, 0, 1.75]})),
    () => group(place(TD + 'Command_stage2.prefab', {scale: 1.35}), place(TD + 'castle.prefab', {at: [0, 0, 1.8]}),
      place(TD + 'castle.prefab', {at: [-1.8, 0, 0], deg: -90}), place(TD + 'castle.prefab', {at: [1.8, 0, 0], deg: 90})),
    () => group(place(TD + 'Command_stage3.prefab', {scale: 1.55}),
      ...[0, 90, 180, 270].map(d => { const a = d * Math.PI / 180; return place(TD + 'castle.prefab', {at: [Math.sin(a) * 1.86, 0, Math.cos(a) * 1.86], deg: d}); }),
      place(TD + 'Magic_stage1.prefab', {at: [-1.15, 0, -1.15], scale: .55}), place(TD + 'Magic_stage1.prefab', {at: [1.15, 0, -1.15], scale: .55}))
  ],
  cannon: [1, 2, 3].map(s => () => place(TD + `Cannon_stage${s}.prefab`)),
  // (a stone platform, 12.4 m square, a low parapet round it: the pitch cauldron's and the trebuchet's footing; the
  // trebuchet's catapult itself is an animated Western Kingdoms model the game stands on it)
  cauldron: [
    () => group(platform(.1), place(INT + 'Cauldron.prefab', {at: [0, 1.1, 0], scale: 6}), group(fire(2.6)).translateY(.05),
      place(TOWN + 'storage_barrel.prefab', {at: [4.2, .05, 3.6], scale: 1.8})),
    () => group(platform(.14), place(INT + 'Cauldron.prefab', {at: [0, 1.3, 0], scale: 7}), group(fire(3)).translateY(.05),
      ...corners(5.4).map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.3, 1.1, 1.3]})),
      place(TOWN + 'storage_barrel.prefab', {at: [3.6, .05, 4.4], scale: 1.8}), place(TOWN + 'storage_barrel.prefab', {at: [-3.6, .05, 4.4], scale: 1.8})),
    () => group(platform(.18), place(INT + 'Cauldron.prefab', {at: [0, 1.5, 0], scale: 8}), group(fire(3.4)).translateY(.05),
      ...corners(5.4).map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.5, 1.6, 1.5]})),
      ...merlonRing(6.2, 1.1), place(TOWN + 'storage_barrel.prefab', {at: [3.6, .05, 4.4], scale: 1.8}), place(INT + 'Barrel_Stack.prefab', {at: [-3, .05, 4.2]}))
  ],
  trebuchet: [
    () => group(platform(.1), stones(2.2, 9, 31, [3.6, 3.6])),
    () => group(platform(.14), stones(2.4, 12, 33, [3.6, 3.6]), ...corners(5.4).map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.3, 1.1, 1.3]}))),
    () => group(platform(.18), stones(2.6, 15, 35, [3.6, 3.6]), ...corners(5.4).map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.5, 1.6, 1.5]})), ...merlonRing(6.2, 1.1))
  ],
  mine: [
    () => group(place(NAT + 'Rock2.prefab', {at: [0, 0, -2.4], scale: .75}), adit(0, 1.2, 1),
      place(TOWN + 'cart3.prefab', {at: [3.4, 0, 2.6], deg: 30, scale: 1.1}), group(gold(1.6, 18, 3)).translateX(-2.8).translateZ(3)),
    () => group(place(NAT + 'Rock1.prefab', {at: [0, 0, -2.4], scale: .8}), adit(-.4, 1.6, 1.15),
      group(place(TOWN + 'cart1.prefab', {deg: 25, scale: 1.2}), group(gold(.7, 9, 4)).translateY(1.1)).translateX(3).translateZ(3),
      group(gold(1.9, 26, 5)).translateX(-3).translateZ(3.4), place(INT + 'FireWood.prefab', {at: [4.2, 0, -1], deg: 90, scale: 1.2})),
    () => group(place(NAT + 'Rock3.prefab', {at: [0, 0, -2.6], scale: .8}), adit(-.6, 1.8, 1.3),
      group(place(TOWN + 'cart1.prefab', {deg: 25, scale: 1.3}), group(gold(.75, 10, 6)).translateY(1.2)).translateX(3.4).translateZ(3.2),
      group(place(TOWN + 'cart1.prefab', {deg: -20, scale: 1.3}), group(gold(.75, 10, 8)).translateY(1.2)).translateX(-4.4).translateZ(3.6),
      group(gold(2.2, 34, 7)).translateX(-.6).translateZ(4.6),
      place(TOWN + 'storage_barrel.prefab', {at: [5, 0, .6], scale: 1.3}), place(TOWN + 'storage_basket.prefab', {at: [5.2, 0, 1.9], scale: 1.3}))
  ],
  farm: [
    () => group(place(TOWN + 'WoodenHouse_1.prefab'), place(TOWN + 'storage_barrel_drink.prefab', {at: [3.5, 0, 6.6], scale: 1.6}),
      place(TOWN + 'storage_barrel_drink.prefab', {at: [5.4, 0, 6.6], deg: 20, scale: 1.6}), place(TOWN + 'storage_barrel.prefab', {at: [-4.6, 0, 6.2], scale: 1.4})),
    () => group(place(TOWN + 'WoodenHouse_2.prefab'), place(INT + 'Barrel_Stack.prefab', {at: [-2, 0, 8.6], scale: 1.1}),
      place(TOWN + 'cart3.prefab', {at: [5.5, 0, 7.6], deg: 70, scale: 1.4}), place(TOWN + 'storage_barrel_drink.prefab', {at: [2, 0, 8.8], scale: 1.6})),
    () => group(place(TOWN + 'Tavern.prefab', {hide: ['Tavern_interior', 'Furniture', 'Food', 'Storage', 'Tavern_interior_chandelier', 'Tavern_interior_lamp', 'Tavern_interior_curtain']}),
      place(INT + 'Barrel_Stack.prefab', {at: [-9, 0, 13], scale: 1.6}), place(INT + 'Barrel_Stack.prefab', {at: [-3, 0, 13.4], scale: 1.6}),
      place(TOWN + 'cart1.prefab', {at: [10, 0, 12], deg: 60, scale: 1.8}))
  ],
  granary: [
    () => group(...corners(4.4).map(([x, z]) => mesh(new T.BoxGeometry(.5, 3.2, .5), TIMBER, [x, 1.6, z])),
      place(ROOM + 'Roof_x2.prefab', {at: [0, 3, 5], scale: [.8, .42, 1]}), place(ROOM + 'Roof_x2.prefab', {at: [0, 3, 0], scale: [.8, .42, 1]}),
      place(INT + 'Barrel_Stack.prefab', {at: [-1.9, 0, -1]}), place(INT + 'Barrel_Stack.prefab', {at: [1.9, 0, -1]}),
      place(INT + 'Barrel_Stack.prefab', {at: [0, 0, 2.2]}), place(INT + 'Barrel.prefab', {at: [4.6, 0, 5.4]})),
    () => group(place(TOWN + 'House1.prefab'), place(INT + 'Barrel_Stack.prefab', {at: [-1.5, 0, 4.6], scale: 1.1}), place(INT + 'Barrel.prefab', {at: [2.4, 0, 4.5]}),
      place(INT + 'Barrel.prefab', {at: [3.7, 0, 4.2]})),
    () => group(place(TOWN + 'House2.prefab'), place(INT + 'Barrel_Stack.prefab', {at: [-2.6, 0, 4.9], scale: 1.1}), place(INT + 'Barrel_Stack.prefab', {at: [1.4, 0, 4.9], scale: 1.1}),
      place(TOWN + 'cart3.prefab', {at: [5.2, 0, 2.6], deg: 10, scale: 1.3}), place(INT + 'Barrel.prefab', {at: [4.6, 0, 5.4]}))
  ],
  // (a stone strongroom, its walls kept low so the hoard inside shows from the game's camera)
  treasury: [
    () => group(platform(.32), group(gold(3, 40, 11)).translateZ(.4),
      place(INT + 'Chest.prefab', {at: [-3.4, 0, -3.6], scale: 1.8}), place(INT + 'Chest.prefab', {at: [3.4, 0, -3.6], scale: 1.8})),
    () => group(platform(.36), group(gold(3.6, 56, 13)).translateZ(.3),
      ...[[-3.6, -3.8], [0, -4.2], [3.6, -3.8], [-4, 3]].map(([x, z]) => place(INT + 'Chest.prefab', {at: [x, 0, z], scale: 1.8})),
      ...corners(5.6).map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.6, 1.3, 1.6]}))),
    () => group(platform(.4), group(gold(4, 72, 17)).translateZ(.2),
      ...[[-3.8, -3.9], [0, -4.3], [3.8, -3.9], [-4.2, 3], [4.2, 3]].map(([x, z]) => place(INT + 'Chest.prefab', {at: [x, 0, z], scale: 1.8})),
      ...corners(5.6).map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.9, 1.8, 1.9]})), ...merlonRing(6.2, 2.4))
  ],
  camp: [
    () => group(tent(2.4, 1.9, 3), group(tent(2.4, 1.9, 3, 90)).translateX(3.4).translateZ(-1), fire(.9),
      place(INT + 'WeaponRack_Full.prefab', {at: [-3, 0, 1.5], deg: 90})),
    () => group(tent(2.6, 2, 3.4), group(tent(2.6, 2, 3.4, 90)).translateX(3.8).translateZ(-1.2), group(tent(2.6, 2, 3.4, 90)).translateX(-3.8).translateZ(-1.2),
      group(fire(1)).translateZ(2.6), place(INT + 'WeaponRack_Full.prefab', {at: [-3.4, 0, 3], deg: 60}), place(INT + 'WeaponRack_Full.prefab', {at: [3.4, 0, 3], deg: -60})),
    () => group(...[[-4, -3.6, 90], [0, -4.2, 0], [4, -3.6, 90], [-4.6, 1, 90], [4.6, 1, 90]].map(([x, z, d]) => group(tent(2.8, 2.2, 3.6, d)).translateX(x).translateZ(z)),
      group(fire(1.1)).translateZ(1.4), place(INT + 'WeaponRack_Full.prefab', {at: [-2, 0, 4.4]}), place(INT + 'WeaponRack_Full.prefab', {at: [2, 0, 4.4]}),
      ...corners(5.4).map(([x, z]) => mesh(new T.BoxGeometry(.3, 2.2, .3), TIMBER, [x, 1.1, z])))
  ],
  hatchery: [
    () => group(place(ROOM + 'Room_2x2_StoneTiled.prefab', {scale: [1, .45, 1]}), place(NAT + 'Rock2.prefab', {at: [-2.4, 0, -2.6], scale: .45}),
      group(nest(2.4, 3, 21)).translateZ(.6)),
    () => group(place(ROOM + 'Room_2x2_StoneTiled.prefab', {scale: [1, .6, 1]}), place(NAT + 'Rock1.prefab', {at: [-2.6, 0, -2.8], scale: .5}),
      group(nest(2.8, 4, 23)).translateZ(.6), ...[[-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]].map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.6, 2, 1.6]}))),
    () => group(place(ROOM + 'Room_2x2_StoneTiled.prefab', {scale: [1, .55, 1]}), place(NAT + 'Rock3.prefab', {at: [-2.4, 0, -3], scale: .45}),
      group(nest(3.2, 5, 25)).translateZ(.8),
      ...corners(5.7).map(([x, z]) => place(PART + 'Pillar.prefab', {at: [x, 0, z], scale: [1.8, 2, 1.8]})), ...merlonRing(6.2, 3.3))
  ],
  hut: [() => group(place(TOWN + 'House3.prefab'), place(INT + 'FireWood.prefab', {at: [3, 0, 3.4], deg: 90, scale: 1.2}),
    place(TOWN + 'storage_bag.prefab', {at: [-2.4, 0, 4.6], scale: 1.5}), place(TOWN + 'cart3.prefab', {at: [3.6, 0, -1.6], deg: 15}))]
};
// Kept as their own nodes (they turn or recoil); everything else merges. Each stage at most 4,800 triangles (the
// Brewery's tavern 9,000): over that it's simplified (glb-pack.mjs), so a phone draws a whole lot of them.
const KEEP = {cannon: s => [`td_human_cannon_turret${s}`]};

// Walls: a post on every tile and a rail to each neighbour; four designs (levels 1-2, 3-4, 5-6, 7-8). Rails run
// along +x, a tile (1 m here: the game's tile) long, centred on the post they leave from.
// (a dark castle wall section: 5 m long, 6 m high, its merlons on top, scaled down to a tile)
const curtain = (src, sy) => { const g = group(place(src), place(PART + 'Wall_Merlons.prefab', {at: [0, 6, -.05]})); g.scale.set(.2, sy, .3); return g; };
const WALLS = [
  {post: () => group(mesh(new T.CylinderGeometry(.13, .14, 1.25, 7), TIMBER, [0, .625, 0]), mesh(new T.ConeGeometry(.13, .3, 7), TIMBER, [0, 1.4, 0])),
    rail: () => palisade(1, 1.05, 5, 41)},
  {post: () => place(TOWN + 'Wall_tower1.prefab', {scale: [.3, .2, .3]}), rail: () => place(TOWN + 'Wall_part1.prefab', {scale: [1 / 3.9, .26, .3]})},
  {post: () => place(PART + 'Pillar.prefab', {scale: [.5, .58, .5]}), rail: () => curtain(PART + 'Wall_Plain.prefab', .19)},
  {post: () => group(place(PART + 'Pillar.prefab', {scale: [.62, .6, .62]}), place(PART + 'Pillar.prefab', {at: [0, 1.75, 0], scale: [.7, .06, .7]})),
    rail: () => curtain(PART + 'Wall_ArrowSlit.prefab', .22)}
];
const POLY = 'Polygrade/Top_Down Medieval City/Windmill_Free/Prefabs/';
const NATURE = {
  pineLow: POLY + 'Tree.prefab',
  pine1: TREES + 'Pine_tree1.prefab', pine2: TREES + 'Pine_tree2.prefab', pine3: TREES + 'Pine_tree3.prefab', oak1: TREES + 'Oak_tree1.prefab',
  oak2: TREES + 'Oak_tree2.prefab', birch1: TREES + 'Birch_tree1.prefab', birch2: TREES + 'Birch_tree2.prefab', deciduous1: TREES + 'Deciduous_tree1.prefab',
  deciduous2: TREES + 'Deciduous_tree2.prefab', willow1: TREES + 'Willow_tree1.prefab', pineStump: TREES + 'Pine_stump.prefab', stump: TREES + 'Deciduous_tree_stump.prefab',
  rock1: NAT + 'Rock1.prefab', rock2: NAT + 'Rock2.prefab', rock3: NAT + 'Rock3.prefab', stone1: NAT + 'Stone1.prefab', stone2: NAT + 'Stone2.prefab', stone3: NAT + 'Stone3.prefab'
  // (no undergrowth: ferns and grass blades read as specks from the game's camera)
};
const GROUND = ['ground_grass', 'ground_soil', 'ground_rock', 'ground_road', 'ground_stones'];
// The hand-painted ground (Handpainted_Grass_and_Ground_Textures): each land's grass, earth, sand and snow.
const HP = 'Handpainted_Grass_and_Ground_Textures/Textures/';
const PAINTED = {grass: HP + 'Grass/Grass_normal/Grass_normal_down.png', grassDark: HP + 'Grass/Grass_darked/Grass_darked_down.png',
  grassLight: HP + 'Grass/Grass_lighted/Grass_lighted_down.png', swamp: HP + 'Grass/Grass_swamp_normal/Grass_swamp_normal_down.png',
  earth: HP + 'Dirt/dirt_clay/dirt_clay_down.png', sand: HP + 'Dirt/dirt_normal/dirt_normal_down.png', sandStones: HP + 'Dirt/dirt_lighted_rocks/dirt_lighted_rocks_down.png',
  dust: HP + 'Dirt/dirt_desatured/dirt_desatured_down.png', snow: HP + 'Snow/snow_normal.png', snowDark: HP + 'Snow/snow_dark.png'};
// The country round the base: hamlets, farms, windmills, landmarks and the undergrowth (metres; views/realm-world.js).
const FOREST = 'forest/';
const VILLAGE = {
  house1: [TOWN + 'House1.prefab', 900], house2: [TOWN + 'House2.prefab', 1000], house3: [TOWN + 'House3.prefab', 600],
  windmill: [POLY + 'Medieval_Windmill.prefab', 2600, {keep: ['Fan'], spin: ['Fan']}],
  cart: [TOWN + 'cart2.prefab', 1200], wagon: [TOWN + 'cart4.prefab', 4000], barrel: [TOWN + 'storage_barrel.prefab', 300],
  barrels: [INT + 'Barrel_Stack.prefab', 400], sack: [TOWN + 'storage_bag.prefab', 160], basket: [TOWN + 'storage_basket.prefab', 220],
  crate: [INT + 'Crate.prefab', 160], firewood: [INT + 'FireWood.prefab', 140],
  wizardTower: ['Tower/Prefab/Tower Mage.prefab', 1800], watchtower: [TOWN + 'Wall_tower2.prefab', 700],
  statue: [FOREST + 'props/statue.FBX', 900], statueBroken: [FOREST + 'props/statue broken.FBX', 400], statueHead: [FOREST + 'props/statue head.FBX', 540],
  slab: [FOREST + 'rock_clifs/rock flat.FBX', 140],
  // (these plants' prefabs lie on their backs: their models' own turn upright isn't in them; stood up here)
  rye: [NAT + 'Rye.prefab', 60, {upright: true}], sunflower: [NAT + 'Sunflower.prefab', 400, {upright: true}],
  bush: [NAT + 'Bush1.prefab', 60, {upright: true}], fern: [NAT + 'Plant3.prefab', 400], flowers: [NAT + 'Flower5.prefab', 160, {upright: true}], blooms: [NAT + 'Flower1.prefab', 80, {upright: true}],
  // (Mushroom1 comes out lying on its side too: views/realm-world.js LYING stands it up when it loads; stand it up here
  // instead and drop it there)
  mushroom: [NAT + 'Mushroom2.prefab', 240], mushrooms: [NAT + 'Mushroom4.prefab', 270], toadstool: [NAT + 'Mushroom1.prefab', 270],
  // (a dark castle's broken walls by the old statues; a timber fence round the fields: posts and two rails, 3 m)
  ruinWall: [PART + 'Wall_ArrowSlit.prefab', 120], ruinArch: [PART + 'Wall_Window.prefab', 160], ruinEnd: [PART + 'Wall_End.prefab', 120], pillar: [PART + 'Pillar.prefab', 140],
  fence: [() => group(mesh(new T.BoxGeometry(.16, 1.2, .16), TIMBER, [-1.5, .6, 0]), mesh(new T.BoxGeometry(.16, 1.2, .16), TIMBER, [1.5, .6, 0]),
    mesh(new T.BoxGeometry(3.1, .1, .07), TIMBER, [0, .45, 0]), mesh(new T.BoxGeometry(3.1, .1, .07), TIMBER, [0, .95, 0])), 80]
};

const manifest = {version: 1, generator: 'convert-world.mjs / three@0.160.0', units: 'Buildings: largest horizontal side 1. Walls: 1 = one tile. Nature: metres.', files: {}, ground: {}, sources: []};
const want = k => !only || only.has(k);
for (const [kind, stages] of Object.entries(BUILDINGS)) {
  if (!want(kind)) continue;
  const nodes = [];
  for (const [i, make] of stages.entries()) {
    const {node, info} = await P.unit(`${kind}-${i + 1}`, make(), {keep: KEEP[kind]?.(i + 1) || [], maxTriangles: kind === 'farm' && i === 2 ? 9000 : 4800});
    nodes.push(node);
    (manifest.files[kind + '.glb'] ||= {nodes: {}}).nodes[node.name] = info;
  }
  P.prepare();
  manifest.files[kind + '.glb'].bytes = await P.write(kind + '.glb', nodes);
  console.log(kind, manifest.files[kind + '.glb'].bytes, 'bytes', nodes.map(n => manifest.files[kind + '.glb'].nodes[n.name].triangles).join('/'), 'triangles');
}
if (want('walls')) {
  const nodes = [];
  for (const [i, w] of WALLS.entries()) for (const part of ['post', 'rail']) {
    const {node, info} = await P.unit(`wall-${i + 1}-${part}`, w[part](), {unit: 1});
    // (a rail starts at its post: x 0 to 1, centred across; the post centred on its tile)
    node.children.forEach(m => m.geometry.translate(part === 'rail' ? info.footprint[0] / 2 : 0, 0, 0));
    nodes.push(node);
    (manifest.files['walls.glb'] ||= {nodes: {}}).nodes[node.name] = info;
  }
  P.prepare();
  manifest.files['walls.glb'].bytes = await P.write('walls.glb', nodes);
  console.log('walls', manifest.files['walls.glb'].bytes);
}
if (want('nature')) {
  const nodes = [];
  for (const [name, prefab] of Object.entries(NATURE)) {
    try {
      const {node, info} = await P.unit(name, U.prefab(prefab), {unit: 1, textureSize: {default: 256}});
      nodes.push(node);
      (manifest.files['nature.glb'] ||= {nodes: {}}).nodes[name] = info;
    } catch (e) { console.warn('nature: skipped', name, e.message); }
  }
  P.prepare();
  manifest.files['nature.glb'].bytes = await P.write('nature.glb', nodes);
  console.log('nature', manifest.files['nature.glb'].bytes);
}
if (want('village')) {
  const nodes = [];
  for (const [name, [src, budget, extra]] of Object.entries(VILLAGE)) {
    try {
      let g = typeof src === 'function' ? src() : src.endsWith('.prefab') ? U.prefab(src) : U.model(src);
      if (extra?.upright) { const w = new T.Group(); w.rotation.x = Math.PI / 2; w.add(g); g = w; }
      const {node, info} = await P.unit(name, g, {unit: 1, textureSize: {default: 256}, maxTriangles: budget, ...extra});
      nodes.push(node);
      (manifest.files['village.glb'] ||= {nodes: {}}).nodes[name] = info;
    } catch (e) { console.warn('village: skipped', name, e.message); }
  }
  P.prepare();
  manifest.files['village.glb'].bytes = await P.write('village.glb', nodes);
  console.log('village', manifest.files['village.glb'].bytes, nodes.length, 'props');
}
if (want('ground')) {
  for (const name of GROUND) {
    const file = path.join(U.root, FE + 'Textures', name + '.png');
    U.used.add(file);
    const t = await P.texture(file, 512);
    manifest.ground[name] = t.uri;
  }
  for (const [name, rel] of Object.entries(PAINTED)) {
    const file = path.join(U.root, rel);
    U.used.add(file);
    const t = await P.texture(file, 512);
    manifest.ground[name] = t.uri;
  }
}
manifest.textures = Object.fromEntries([...P.textures.values()].map(t => [t.uri, t.bytes]));
manifest.sources = [...U.used].filter(f => fs.existsSync(f) && fs.statSync(f).isFile()).sort().map(f => ({path: U.rel(f), sha256: sha256(f)}));
if (!only) fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
else fs.writeFileSync(path.join(out, 'manifest-partial.json'), JSON.stringify(manifest, null, 1) + '\n');
