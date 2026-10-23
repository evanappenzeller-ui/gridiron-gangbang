import * as features from '../core/features.js';
// Level-specific wall batches shared by the village, scouting and raids.
import * as data from '../core/data.js';
import * as FM from './realm-models.js';

const designOf = (level, owner) => owner && level >= 1 && level <= 8 ? level : 0;
const tintOf = wall => FM.WALL_TINT[wall.l - 1] || FM.WALL_TINT[0];
const legacyMaterials = new Map();

/** A single wall for placement, or a joined pair for a shop thumbnail. */
export function wallPreview(T, level, span = false) {
  if (!features.available()) return null;
  const design = designOf(level, true), parts = FM.wallParts(design);
  let mat = FM.mats().paint;
  if (!design) {
    const tint = tintOf({l: level});
    if (!legacyMaterials.has(tint)) {
      const colored = mat.clone(); colored.color.setHex(tint); legacyMaterials.set(tint, colored);
    }
    mat = legacyMaterials.get(tint);
  }
  const group = new T.Group(), post = new T.Mesh(parts.post, mat);
  group.add(post);
  if (span) {
    post.position.x = -.5;
    const end = post.clone(); end.position.x = .5;
    const rail = new T.Mesh(parts.rail, mat); rail.position.x = -.5;
    group.add(end, rail);
  }
  group.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
  return group;
}

/** At most two draw calls per design, independent of the number of walls. */
export function createWallView(T, root, toWorld) {
  const meshes = [], picks = [];
  let signature = '';
  function clear() {
    meshes.forEach(mesh => { root.remove(mesh); mesh.dispose(); });
    meshes.length = picks.length = 0;
  }
  function setLot(walls) {
    const owner = features.available();
    const next = `${owner}:` + walls.map(w => `${w.i}.${w.x}.${w.y}.${w.l}`).join(',');
    if (next === signature) return;
    signature = next; clear();
    const batches = new Map(), at = new Map(walls.map(w => [`${w.x},${w.y}`, w]));
    const batch = wall => {
      const design = designOf(wall.l, owner);
      if (!batches.has(design)) batches.set(design, {posts: [], rails: []});
      return batches.get(design);
    };
    walls.forEach(wall => {
      batch(wall).posts.push(wall);
      [[1, 0, 0], [0, 1, -Math.PI / 2]].forEach(([dx, dy, angle]) => {
        const neighbor = at.get(`${wall.x + dx},${wall.y + dy}`);
        if (!neighbor) return;
        if (wall.l !== neighbor.l && (designOf(wall.l, owner) || designOf(neighbor.l, owner))) {
          // Each end owns its half, so an upgrade never repaints the adjacent wall.
          batch(wall).rails.push({wall, angle, length: .5});
          batch(neighbor).rails.push({wall: neighbor, angle: angle + Math.PI, length: .5});
        } else batch(wall).rails.push({wall, angle, length: 1});
      });
    });
    const matrix = new T.Matrix4(), rotation = new T.Quaternion(), axis = new T.Vector3(0, 1, 0);
    const position = new T.Vector3(), scale = new T.Vector3(), color = new T.Color();
    batches.forEach(({posts, rails}, design) => {
      const parts = FM.wallParts(design);
      [['post', posts], ['rail', rails]].forEach(([kind, entries]) => {
        if (!entries.length) return;
        const mesh = new T.InstancedMesh(parts[kind], FM.mats().paint, entries.length);
        mesh.name = `wall-${design}-${kind}`;
        mesh.userData.walls = [];
        entries.forEach((entry, i) => {
          const wall = kind === 'post' ? entry : entry.wall;
          position.set(toWorld(wall.x + .5), 0, toWorld(wall.y + .5));
          rotation.setFromAxisAngle(axis, kind === 'post' ? 0 : entry.angle);
          scale.set(kind === 'post' ? 1 : entry.length, 1, 1);
          mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
          if (!design) mesh.setColorAt(i, color.setHex(tintOf(wall)));
          mesh.userData.walls.push(wall);
        });
        mesh.castShadow = mesh.receiveShadow = true;
        root.add(mesh); meshes.push(mesh); picks.push(mesh);
      });
    });
  }
  return {setLot, picks, dispose() { clear(); signature = ''; }};
}
