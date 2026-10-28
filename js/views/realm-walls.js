import * as features from '../core/features.js';
// Level-specific wall batches shared by the village, scouting and raids. The full 3D Keepfall (Oct 25 2026): four
// imported designs (models/realm/world-v1/walls.glb, tools/realm/convert-world.mjs): a palisade at levels 1-2, the
// town's stone wall 3-4, dark brick battlements 5-6 and grey stone battlements 7-8; a post on every wall's tile and a
// rail to each neighbour. Without them (still loading, or failed) realm-models.js's plain 3D walls stand in.
import * as FM from './realm-models.js';
import {enhanceMaterial, loadSurfaceMaps} from './realm-materials.js';

const AT = new URL('../../models/realm/world-v1/', import.meta.url).href;
const V = new URL('../vendor/three/', import.meta.url).href;
const designOf = (level, owner) => owner && level >= 1 && level <= 8 ? level : 0;
const importedOf = level => Math.max(1, Math.min(4, Math.ceil(level / 2)));
const tintOf = wall => FM.WALL_TINT[wall.l - 1] || FM.WALL_TINT[0];
const legacyMaterials = new Map();
// design (1-4) → {post: [[geometry, material]], rail: [...]}
const IMPORTED = new Map();
let pending = null;
/** Loads the imported wall designs (once). → true when they're in. */
export function load(T) {
  if (IMPORTED.size) return Promise.resolve(true);
  if (pending) return pending;
  pending = (async () => {
    try {
      const {GLTFLoader} = await import(V + 'GLTFLoader.js');
      loadSurfaceMaps(T);
      const gltf = await new GLTFLoader().loadAsync(AT + 'walls.glb');
      // (a texture that didn't come would draw the walls white: the plain ones instead)
      const json = gltf.parser.json.materials || [];
      gltf.scene.traverse(o => { if (o.isMesh && json[gltf.parser.associations.get(o.material)?.materials]?.pbrMetallicRoughness?.baseColorTexture && !o.material.map?.image) throw Error('Incomplete wall texture'); });
      gltf.scene.updateMatrixWorld(true);
      const designs = new Map();
      gltf.scene.children.forEach(node => {
        const m = node.name.match(/^wall-(\d)-(post|rail)$/);
        if (!m) return;
        const parts = [], toNode = new T.Matrix4().copy(node.matrixWorld).invert();
        node.traverse(o => {
          if (!o.isMesh) return;
          enhanceMaterial(T, o.material);
          parts.push([o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(toNode, o.matrixWorld)), o.material]);
        });
        if (!designs.has(+m[1])) designs.set(+m[1], {post: [], rail: []});
        designs.get(+m[1])[m[2]] = parts;
      });
      if (designs.size !== 4 || [...designs.values()].some(d => !d.post.length || !d.rail.length)) throw Error('Incomplete wall designs');
      designs.forEach((d, k) => IMPORTED.set(k, d));
      return true;
    } catch (error) { console.warn('Keepfall: plain 3D walls', error); return false; } finally { pending = null; }
  })();
  return pending;
}
export const imported = () => IMPORTED.size === 4;
/** A level's wall parts, each [geometry, material]: {post, rail} (the imported design, else the plain one). */
export function partsOf(level) {
  if (imported()) return IMPORTED.get(importedOf(level));
  const p = FM.wallParts(designOf(level, true));
  return {post: [[p.post, FM.mats().paint]], rail: [[p.rail, FM.mats().paint]]};
}

/** A single wall for placement, or a joined pair for a shop thumbnail. */
export function wallPreview(T, level, span = false) {
  if (!features.available()) return null;
  const group = new T.Group();
  if (imported()) {
    const d = IMPORTED.get(importedOf(level));
    const add = (parts, x) => parts.forEach(([g, m]) => { const mesh = new T.Mesh(g, m); mesh.position.x = x; group.add(mesh); });
    add(d.post, span ? -.5 : 0);
    if (span) { add(d.post, .5); add(d.rail, -.5); }
  } else {
    const design = designOf(level, true), parts = FM.wallParts(design);
    let mat = FM.mats().paint;
    if (!design) {
      const tint = tintOf({l: level});
      if (!legacyMaterials.has(tint)) {
        const colored = mat.clone(); colored.color.setHex(tint); legacyMaterials.set(tint, colored);
      }
      mat = legacyMaterials.get(tint);
    }
    const post = new T.Mesh(parts.post, mat);
    group.add(post);
    if (span) {
      post.position.x = -.5;
      const end = post.clone(); end.position.x = .5;
      const rail = new T.Mesh(parts.rail, mat); rail.position.x = -.5;
      group.add(end, rail);
    }
  }
  group.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
  return group;
}

/** A few draw calls per design (one a material), independent of the number of walls. */
export function createWallView(T, root, toWorld) {
  const meshes = [], picks = [];
  let signature = '';
  function clear() {
    meshes.forEach(mesh => { root.remove(mesh); mesh.dispose(); });
    meshes.length = picks.length = 0;
  }
  function setLot(walls) {
    const owner = features.available(), full = imported();
    const next = `${owner}:${full}:` + walls.map(w => `${w.i}.${w.x}.${w.y}.${w.l}`).join(',');
    if (next === signature) return;
    signature = next; clear();
    const keyOf = level => full ? importedOf(level) : designOf(level, owner);
    const batches = new Map(), at = new Map(walls.map(w => [`${w.x},${w.y}`, w]));
    const batch = wall => {
      const design = keyOf(wall.l);
      if (!batches.has(design)) batches.set(design, {posts: [], rails: []});
      return batches.get(design);
    };
    walls.forEach(wall => {
      batch(wall).posts.push(wall);
      [[1, 0, 0], [0, 1, -Math.PI / 2]].forEach(([dx, dy, angle]) => {
        const neighbor = at.get(`${wall.x + dx},${wall.y + dy}`);
        if (!neighbor) return;
        if (full ? keyOf(wall.l) !== keyOf(neighbor.l) : wall.l !== neighbor.l && (designOf(wall.l, owner) || designOf(neighbor.l, owner))) {
          // Each end owns its half, so an upgrade never repaints the adjacent wall.
          batch(wall).rails.push({wall, angle, length: .5});
          batch(neighbor).rails.push({wall: neighbor, angle: angle + Math.PI, length: .5});
        } else batch(wall).rails.push({wall, angle, length: 1});
      });
    });
    const matrix = new T.Matrix4(), rotation = new T.Quaternion(), axis = new T.Vector3(0, 1, 0);
    const position = new T.Vector3(), scale = new T.Vector3(), color = new T.Color();
    batches.forEach(({posts, rails}, design) => {
      let parts = IMPORTED.get(design);
      if (!full) { const p = FM.wallParts(design); parts = {post: [[p.post, FM.mats().paint]], rail: [[p.rail, FM.mats().paint]]}; }
      [['post', posts], ['rail', rails]].forEach(([kind, entries]) => {
        if (!entries.length) return;
        parts[kind].forEach(([geometry, material], j) => {
          const mesh = new T.InstancedMesh(geometry, material, entries.length);
          mesh.name = `wall-${full ? 'v1-' : ''}${design}-${kind}${j ? '-' + j : ''}`;
          mesh.userData.walls = [];
          entries.forEach((entry, i) => {
            const wall = kind === 'post' ? entry : entry.wall;
            position.set(toWorld(wall.x + .5), 0, toWorld(wall.y + .5));
            rotation.setFromAxisAngle(axis, kind === 'post' ? 0 : entry.angle);
            scale.set(kind === 'post' ? 1 : entry.length, 1, 1);
            mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
            if (!full && !design) mesh.setColorAt(i, color.setHex(tintOf(wall)));
            mesh.userData.walls.push(wall);
          });
          mesh.castShadow = mesh.receiveShadow = true;
          root.add(mesh); meshes.push(mesh); picks.push(mesh);
        });
      });
    });
  }
  return {setLot, picks, dispose() { clear(); signature = ''; }};
}
