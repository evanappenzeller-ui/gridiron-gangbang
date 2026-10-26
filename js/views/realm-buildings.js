// Phase-one imported buildings. Art is a projection of existing kind/level;
// this module never reads or writes a player's save.
import * as features from '../core/features.js';
const V = new URL('../vendor/three/', import.meta.url).href;
const AT = new URL('../../models/realm/buildings-v1/', import.meta.url).href;
export const KINDS = Object.freeze(['barracks', 'tower', 'ballista']);
export const stageFor = level => level >= 8 ? 3 : level >= 4 ? 2 : 1;
const templates = new Map(), materials = new Map();
let T, pending;
export async function load(three) {
  if (!features.available()) return false;
  T = three;
  if (pending) return pending;
  const keys = KINDS.flatMap(kind => [1, 2, 3].map(stage => kind + '-' + stage));
  if (keys.every(key => templates.has(key))) return true;
  pending = (async () => {
    try {
      const {GLTFLoader} = await import(V + 'GLTFLoader.js'), loader = new GLTFLoader();
      await Promise.all(keys.filter(key => !templates.has(key)).map(async key => {
        let scene;
        try {
          const gltf = await loader.loadAsync(AT + key + '.glb'); scene = gltf.scene;
          scene.traverse(o => {
            if (!o.isMesh) return;
            for (const m of Array.isArray(o.material) ? o.material : [o.material])
              if (!m.map?.image) throw Error('Incomplete building texture');
          });
          const obsolete = new Set();
          scene.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = true; o.receiveShadow = true;
            const share = m => {
              if (!materials.has(m.name)) materials.set(m.name, m);
              const retained = materials.get(m.name);
              if (retained !== m) obsolete.add(m);
              return retained;
            };
            o.material = Array.isArray(o.material) ? o.material.map(share) : share(o.material);
          });
          obsolete.forEach(m => { m.map?.dispose(); m.dispose(); });
          scene.updateMatrixWorld(true);
          const bounds = new T.Box3().setFromObject(scene), size = bounds.getSize(new T.Vector3());
          let platformY = 0;
          scene.traverse(o => { if (o.userData.platformY) platformY = o.userData.platformY; });
          templates.set(key, {scene, height: size.y, platformY});
        } catch (error) {
          const retained = new Set(materials.values()), disposed = new Set();
          scene?.traverse(o => {
            if (!o.isMesh) return;
            o.geometry.dispose();
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
              if (!retained.has(m) && !disposed.has(m)) { disposed.add(m); m.map?.dispose(); m.dispose(); }
            }
          });
          console.warn('Keepfall: retaining original building artwork for ' + key, error);
        }
      }));
      return templates.size > 0;
    } catch (error) { console.warn('Keepfall: retaining original buildings', error); return false; }
  })();
  try { return await pending; } finally { pending = null; }
}
export function create(kind, level, footprint) {
  if (!features.available()) return null;
  const stage = stageFor(level), source = templates.get(kind + '-' + stage);
  if (!source) return null;
  const root = new T.Group(), model = source.scene.clone(true);
  const maxHeight = {barracks: 3.3, tower: 3.5, ballista: 3.2}[kind];
  // Keep the saved collision footprint exactly as it is. Models stay inside it.
  const scale = Math.min(footprint * .82, maxHeight / source.height);
  model.scale.setScalar(scale); root.add(model);
  root.name = 'keep-building-' + kind;
  root.userData = {importedBuilding: kind, stage, level, height: source.height * scale, platformY: source.platformY * scale, owned: []};
  // Small rank studs distinguish levels inside an asset's three stage groups.
  // They sit on a courtyard strip and do not enlarge the occupied footprint.
  const geometry = new T.BoxGeometry(.075, .065, .11);
  const material = new T.MeshStandardMaterial({color: 0xd7b45b, roughness: .8});
  const rank = new T.InstancedMesh(geometry, material, Math.max(1, Math.min(10, level)));
  rank.name = 'building-rank';
  const matrix = new T.Matrix4();
  for (let i = 0; i < rank.count; i++) rank.setMatrixAt(i, matrix.makeTranslation((i - (rank.count - 1) / 2) * .11, .045, footprint * .43));
  rank.instanceMatrix.needsUpdate = true; root.add(rank); root.userData.owned.push(rank);
  return root;
}
export function animateDefense(group, elapsed, aim = 0) {
  if (group?.userData.importedBuilding !== 'ballista') return false;
  const turret = group.getObjectByProperty('name', 'td_human_balista_turret' + group.userData.stage);
  if (!turret) return false;
  turret.rotation.y = Math.PI / 2 - aim;
  const recoil = elapsed >= 0 && elapsed < .3 ? Math.sin(Math.PI * elapsed / .3) * .035 : 0;
  turret.position.z = -recoil;
  return true;
}
