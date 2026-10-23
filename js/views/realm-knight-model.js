import * as features from '../core/features.js';
// Evan's supplied Bulky Knight (Arthur Krut, CC BY 4.0). Shared geometry/textures,
// acquired only by a visible Knight Hero; the procedural hero stays until it loads.
import * as data from '../core/data.js';

const MODEL_URL = new URL('../../img/realm/heroes/bulky-knight-v1/knight.glb', import.meta.url).href;
const clients = new Set();
let template = null, pending = null, generation = 0;

function releaseScene(scene) {
  if (!scene) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(t => { t.dispose(); if (t.image?.close) t.image.close(); });
  materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}
function releaseUnused() {
  if (clients.size) return;
  generation++; pending = null;
  releaseScene(template); template = null;
}
function clearProfile() { if (!features.available()) [...clients].forEach(c => c.dispose()); }
data.subscribe(type => { if (type === 'me') clearProfile(); });
if (typeof window !== 'undefined') window.addEventListener('storage', e => {
  if (e.key === null) [...clients].forEach(c => c.dispose());
});

async function load() {
  if (!features.available() || !clients.size) return null;
  if (template) return template;
  if (pending) return pending;
  const epoch = generation;
  const task = (async () => {
    const {GLTFLoader} = await import('../vendor/three/GLTFLoader.js');
    if (epoch !== generation || !features.available() || !clients.size) return null;
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    if (epoch !== generation || !features.available() || !clients.size) { releaseScene(gltf.scene); return null; }
    template = gltf.scene;
    return template;
  })().catch(() => null).finally(() => { if (pending === task) pending = null; });
  pending = task;
  return task;
}

/** Attaches a shared, textured model to the existing hero rig, leaving its badge/base intact. */
export function attachKnightModel(T, rig, {onChange = () => {}} = {}) {
  let disposed = false, imported = null;
  const fallback = [...rig.children];
  const control = {
    get ready() { return !!imported && !disposed; },
    pose(seconds, {moving = false, attack = 0, still = false} = {}) {
      if (!imported || disposed) return;
      // The supplied asset has no skeleton/clips. Keep its authored armor/weapon
      // pose together and give it a weighted stride, windup and forward strike.
      const walk = moving && !still ? Math.sin(seconds * 9) : 0;
      imported.rotation.z = walk * .035;
      imported.rotation.x = still ? 0 : attack * .24;
      imported.rotation.y = still ? 0 : -attack * .18;
      imported.position.z = still ? 0 : attack * .13;
    },
    dispose() {
      if (disposed) return; disposed = true;
      imported?.removeFromParent(); imported = null;
      fallback.forEach(o => { o.visible = true; });
      clients.delete(control); releaseUnused();
    }
  };
  if (!features.available()) { disposed = true; return control; }
  clients.add(control);
  load().then(source => {
    if (!source || disposed || !features.available() || !clients.has(control)) return;
    const model = source.clone(true), pivot = new T.Group(), fit = new T.Group();
    pivot.name = 'bulky-knight-model'; pivot.userData.heroModel = 'bulky-knight-v1';
    model.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
    const scale = 1.4 / Math.max(.001, size.y);
    model.position.add(new T.Vector3(-center.x, -bounds.min.y, -center.z));
    fit.scale.setScalar(scale); fit.add(model); pivot.add(fit);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    fallback.forEach(o => { o.visible = false; });
    imported = pivot; rig.add(pivot); onChange();
  });
  return control;
}
