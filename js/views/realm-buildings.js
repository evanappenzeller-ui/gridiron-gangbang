// Keepfall's buildings in 3D (the full 3D Keepfall, Oct 25 2026: every building kind modelled, none a picture).
// Art is a projection of a building's existing kind/level; this module never reads or writes a player's save.
// Barracks, archer towers and ballistas come from models/realm/buildings-v1/ (one GLB a stage); every other kind from
// models/realm/world-v1/<kind>.glb (nodes <kind>-1..3: tools/realm/convert-world.mjs). Each kind grows through three
// stages over its levels; small rank studs tell the levels inside a stage apart. The low levels' designs, and the stages
// after them where the imported ones stood smaller, are reworked (realm-lowlevel.js, Oct 26 2026): built from these
// models' own materials and parts once they're in, in their place. A kind whose model can't load returns null here and
// the caller draws realm-models.js's plain 3D one instead.
import * as features from '../core/features.js';
import {DESIGNS, design} from './realm-lowlevel.js';
const V = new URL('../vendor/three/', import.meta.url).href;
const V1 = new URL('../../models/realm/buildings-v1/', import.meta.url).href;
const WORLD = new URL('../../models/realm/world-v1/', import.meta.url).href;
const STAGED = Object.freeze(['barracks', 'tower', 'ballista']);
export const KINDS = Object.freeze([...STAGED, 'keep', 'mine', 'farm', 'treasury', 'granary', 'camp', 'hatchery', 'hut', 'cannon', 'trebuchet', 'cauldron']);
/** The barracks', towers' and ballistas' stages (levels 1-3, 4-7, 8-10: as first imported). */
export const stageFor = level => level >= 8 ? 3 : level >= 4 ? 2 : 1;
// Every other kind: its levels split into three bands (the top ones its own stage), by its number of levels.
const BANDS = {keep: [3, 6], mine: [5, 9], farm: [5, 9], treasury: [5, 9], granary: [5, 9], camp: [3, 5], hatchery: [4, 8],
  hut: [9, 9], cannon: [4, 8], trebuchet: [3, 5], cauldron: [3, 5]};
export const stageOf = (kind, level) => {
  if (STAGED.includes(kind)) return stageFor(level);
  const [two, three] = BANDS[kind] || [4, 8];
  return level >= three ? 3 : level >= two ? 2 : 1;
};
// How tall each may stand (tiles) and how much of its footprint it fills: the Castle the tallest thing on the lot.
const FIT = {keep: [4.2, .98], barracks: [3.3, .82], tower: [3.5, .82], ballista: [3.2, .82], cannon: [3.1, .8], mine: [1.6, .94],
  farm: [2.2, .96], treasury: [1.5, .94], granary: [2.2, .94], camp: [1.3, .96], hatchery: [1.9, .96], hut: [1.7, .9], trebuchet: [1.2, .92], cauldron: [1.6, .92]};
const templates = new Map(), materials = new Map(), imported = new Map();
let T, BU, pending = null, stamps = 0;
// (told each time a model's put in, or reworked: realm-3d.js swaps it into the views open)
const CAME = new Set();
export const onModel = f => { CAME.add(f); return () => CAME.delete(f); };
const keyOf = (kind, stage) => kind + '-' + stage;
/** Materials shared by name across every model; the few plain ones tuned (gold shines, embers glow). */
function share(m, obsolete) {
  if (!materials.has(m.name)) {
    materials.set(m.name, m);
    if (m.name === 'gold') Object.assign(m, {metalness: .75, roughness: .32}), m.emissive?.setHex(0x3a2400);
    if (m.name === 'ember') m.emissive?.setHex(0xff5a14), m.emissiveIntensity = 1.4;
    if (m.name === 'egg') Object.assign(m, {roughness: .45});
    if (m.alphaTest > 0) m.side = T.DoubleSide;
  }
  const kept = materials.get(m.name);
  if (kept !== m) obsolete.add(m);
  return kept;
}
/** Throws when a material the GLB gives a texture came in without it (a missing image would draw it white). */
function complete(gltf) {
  const json = gltf.parser.json.materials || [];
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      const at = gltf.parser.associations.get(m)?.materials;
      if (json[at]?.pbrMetallicRoughness?.baseColorTexture && !m.map?.image) throw Error('Incomplete building texture');
    }
  });
}
function adopt(key, scene) {
  const obsolete = new Set();
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) if (m.map && !m.map.image) throw Error('Incomplete building texture');
    o.castShadow = true; o.receiveShadow = true;
    o.material = Array.isArray(o.material) ? o.material.map(m => share(m, obsolete)) : share(o.material, obsolete);
  });
  obsolete.forEach(m => { if (![...materials.values()].some(k => k.map === m.map)) m.map?.dispose(); m.dispose(); });
  scene.updateMatrixWorld(true);
  const size = new T.Box3().setFromObject(scene).getSize(new T.Vector3());
  let platformY = 0;
  scene.traverse(o => { if (o.userData.platformY) platformY = o.userData.platformY; });
  templates.set(key, {scene, height: size.y, width: Math.max(size.x, size.z), platformY, stamp: ++stamps});
  CAME.forEach(f => f());
}
function drop(scene) {
  const kept = new Set(materials.values());
  scene?.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) if (!kept.has(m)) { m.map?.dispose(); m.dispose(); }
  });
}
/** A shared material by name: the imported models' own, else a plain one of that colour (made once, kept). */
function material(name, color, options = {}) {
  if (!materials.has(name)) materials.set(name, Object.assign(new T.MeshStandardMaterial({color, roughness: .78, ...options}), {name}));
  return materials.get(name);
}
/** One of an imported model's meshes, by its material, as geometry in the model's own frame (or null). */
function piece(key, name) {
  const source = imported.get(key);
  if (!source) return null;
  const parts = [];
  source.scene.traverse(o => { if (o.isMesh && [o.material].flat().some(m => m.name === name)) parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  if (!parts.length) return null;
  const strip = g => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a); return n; };
  return parts.length === 1 ? strip(parts[0]) : BU.mergeGeometries(parts.map(strip), false);
}
/** Puts the reworked designs in place of the imported stages they replace (each once, and only when its own imported
 *  model is in: a design is that model reworked, so a missing one still falls back to the plain 3D building). */
function redesign() {
  for (const key of Object.keys(DESIGNS)) {
    const source = templates.get(key);
    if (!source || source.designed) continue;
    imported.set(key, source);
    try {
      const scene = design(key, {T, BU, material, piece, scene: k => imported.get(k)?.scene || null});
      if (!scene) continue;
      adopt(key, scene);
      templates.get(key).designed = true;
    } catch (error) { templates.set(key, source); console.warn('Keepfall: imported design kept for ' + key, error); }
  }
}
/** Loads every building's models (once; a later call retries only what failed). → true when any are in. */
export async function load(three) {
  if (!features.available()) return false;
  T = three;
  if (pending) return pending;
  if (KINDS.every(k => [1, 2, 3].every(s => templates.has(keyOf(k, s)) || k === 'hut' && s > 1))) return true;
  pending = (async () => {
    try {
      const [{GLTFLoader}, utils] = await Promise.all([import(V + 'GLTFLoader.js'), import(V + 'BufferGeometryUtils.js')]), loader = new GLTFLoader();
      BU = utils;
      const v1 = STAGED.flatMap(kind => [1, 2, 3].map(stage => keyOf(kind, stage))).filter(k => !templates.has(k)).map(async key => {
        let scene;
        try { const gltf = await loader.loadAsync(V1 + key + '.glb'); scene = gltf.scene; complete(gltf); adopt(key, scene); }
        catch (error) { drop(scene); console.warn('Keepfall: plain 3D building for ' + key, error); }
      });
      const world = KINDS.filter(k => !STAGED.includes(k) && ![1, 2, 3].every(s => templates.has(keyOf(k, s)) || k === 'hut' && s > 1)).map(async kind => {
        let gltf;
        try {
          gltf = await loader.loadAsync(WORLD + kind + '.glb');
          complete(gltf);
          for (const node of [...gltf.scene.children]) {
            const m = node.name.match(/^(\w+)-(\d)$/);
            if (!m || m[1] !== kind) continue;
            const wrap = new T.Group(); wrap.add(node); node.position.set(0, 0, 0);
            adopt(node.name, wrap);
          }
        } catch (error) { drop(gltf?.scene); console.warn('Keepfall: plain 3D building for ' + kind, error); }
      });
      await Promise.all([...v1, ...world]);
      redesign();
      return templates.size > 0;
    } catch (error) { console.warn('Keepfall: plain 3D buildings', error); return false; }
  })();
  try { return await pending; } finally { pending = null; }
}
export const ready = kind => templates.has(keyOf(kind, 1));
/** Which model kind at level is drawn from: 0 while it isn't in, a new number each time one comes or is reworked (a view
 *  keys its buildings on it, so one that comes after it's drawn takes the plain one's place). */
export const version = (kind, level) => templates.get(keyOf(kind, kind === 'hut' ? 1 : stageOf(kind, level)))?.stamp || 0;
/** Kind at level as a Group standing in its footprint (tiles), or null when its model isn't in. */
export function create(kind, level, footprint) {
  if (!features.available() || !T) return null;
  const stage = kind === 'hut' ? 1 : stageOf(kind, level), source = templates.get(keyOf(kind, stage));
  if (!source) return null;
  const root = new T.Group(), model = source.scene.clone(true);
  const [maxHeight, fill] = FIT[kind] || [3, .9];
  // The saved collision footprint is kept exactly; models stay inside it. (a reworked design is drawn in tiles at its
  // kind's footprint already)
  const scale = source.designed ? Math.min(1, footprint / Math.max(.01, source.width))
    : Math.min(footprint * fill / Math.max(.01, source.width), maxHeight / Math.max(.01, source.height));
  model.scale.setScalar(scale); root.add(model);
  root.name = 'keep-building-' + kind;
  root.userData = {importedBuilding: kind, stage, level, height: source.height * scale, platformY: source.platformY * scale, owned: []};
  if (kind !== 'hut' && kind !== 'keep') {
    // (the Castle shows its level in its banner tags and size; every other kind with studs on a strip at its front)
    const geometry = new T.BoxGeometry(.075, .065, .11);
    const material = new T.MeshStandardMaterial({color: 0xd7b45b, roughness: .8});
    const rank = new T.InstancedMesh(geometry, material, Math.max(1, Math.min(12, level)));
    rank.name = 'building-rank';
    const matrix = new T.Matrix4();
    for (let i = 0; i < rank.count; i++) rank.setMatrixAt(i, matrix.makeTranslation((i - (rank.count - 1) / 2) * .11, .045, footprint * .45));
    rank.instanceMatrix.needsUpdate = true; root.add(rank); root.userData.owned.push(rank);
  }
  return root;
}
/** A defense turning to its aim and recoiling elapsed seconds after a shot; false when it has no part to turn. */
export function animateDefense(group, elapsed, aim = 0) {
  const kind = group?.userData.importedBuilding;
  const recoil = elapsed >= 0 && elapsed < .3 ? Math.sin(Math.PI * elapsed / .3) : 0;
  if (kind === 'ballista') {
    const turret = group.getObjectByProperty('name', 'td_human_balista_turret' + group.userData.stage);
    if (!turret) return false;
    turret.rotation.y = Math.PI / 2 - aim;
    turret.position.z = -recoil * .035;
    return true;
  }
  if (kind === 'cannon') {
    const turret = group.getObjectByProperty('name', 'td_human_cannon_turret' + group.userData.stage);
    if (!turret) return false;
    const rest = turret.userData.rest || (turret.userData.rest = turret.position.clone());
    turret.rotation.y = Math.PI / 2 - aim;
    turret.position.set(rest.x - Math.cos(aim) * recoil * .02, rest.y, rest.z - Math.sin(aim) * recoil * .02);
    return true;
  }
  return false;
}
