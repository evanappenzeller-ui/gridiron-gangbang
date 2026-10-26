// Western Kingdoms characters for Keepfall. Shared GLB geometry/textures; each
// actor owns only its cloned skeleton and mixer. The battle still owns movement,
// attack timing and damage. +Z is forward and root.position is the feet anchor.
import * as data from '../core/data.js';
import * as features from '../core/features.js';

const V = new URL('../vendor/three/', import.meta.url).href;
const AT = new URL('../../models/realm/western-v2/', import.meta.url).href;
export const KINDS = Object.freeze(['footman', 'archer', 'worker']);
const LOOP = new Set(['idle', 'walk', 'run', 'work', 'work_b', 'work_c']);
const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const templates = new Map(), actors = new Set();
let T = null, cloneRig = null, pending = null, generation = 0, subscribed = false;

function releaseScene(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  scene.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.skeleton) skeletons.add(o.skeleton);
    for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) {
      materials.add(m);
      for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v);
    }
  });
  skeletons.forEach(s => s.dispose()); geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose()); textures.forEach(t => { t.dispose(); t.image?.close?.(); });
}

// Characters are shared by every profile. A data/profile notification only
// revokes them if the shared feature itself is unavailable, including in-flight
// loads. A normal local or cross-tab profile switch retains the same assets.
function revoke() {
  generation++; pending = null;
  [...actors].forEach(a => a.dispose());
  templates.forEach(a => releaseScene(a.scene)); templates.clear();
}
function observeAvailability() {
  if (subscribed) return;
  subscribed = true;
  data.subscribe(type => { if ((type === 'me' || type === 'data') && !features.available()) revoke(); });
}

/** Share complete assets while the feature is available. A later view load
 * retries only missing kinds; individual failures retain that kind's old art. */
export function load(three) {
  observeAvailability();
  if (!features.available()) { revoke(); return Promise.resolve(false); }
  if (pending) return pending;
  if (KINDS.every(kind => templates.has(kind))) return Promise.resolve(true);
  T = three;
  const ticket = generation;
  const eligible = () => ticket === generation && features.available();
  const task = (async () => {
    try {
      const [{GLTFLoader}, SK] = await Promise.all([import(V + 'GLTFLoader.js'), import(V + 'SkeletonUtils.js')]);
      if (!eligible()) return false;
      cloneRig = SK.clone;
      const loader = new GLTFLoader();
      await Promise.all(KINDS.filter(kind => !templates.has(kind)).map(async kind => {
        if (!eligible()) return;
        let gltf;
        try {
          gltf = await loader.loadAsync(AT + kind + '.glb');
          if (!eligible()) { releaseScene(gltf.scene); return; }
          const clips = new Map(gltf.animations.map(c => [c.name.toLowerCase(), c]));
          if (!clips.has('idle')) throw new Error('Missing idle animation');
          gltf.scene.updateMatrixWorld(true);
          const box = new T.Box3().setFromObject(gltf.scene);
          const height = box.max.y - box.min.y;
          if (!Number.isFinite(height) || height <= 0) throw new Error('Empty character bounds');
          gltf.scene.traverse(o => {
            if (!o.isMesh) return;
            // Army blob shadows are cheap and already follow these actors.
            o.castShadow = false; o.receiveShadow = false;
            // Bounds from a bind pose can clip an archer's extended bow or a
            // falling soldier. Visible unit counts are bounded by the army cap.
            o.frustumCulled = false;
          });
          templates.set(kind, {scene: gltf.scene, clips, height, floor: box.min.y});
        } catch (error) {
          if (gltf) releaseScene(gltf.scene);
          if (eligible()) console.warn('Keepfall: original ' + kind + ' artwork retained', error);
        }
      }));
      return eligible() && templates.size > 0;
    } catch (error) {
      if (eligible()) console.warn('Keepfall: original character artwork retained', error);
      return false;
    }
  })();
  pending = task;
  // A stale task must not clear the next feature session's in-flight load.
  const finished = () => { if (ticket === generation && pending === task) pending = null; };
  task.then(finished, finished);
  return task;
}

export function ready(kind) {
  if (!features.available()) { revoke(); return false; }
  return kind ? templates.has(kind) : templates.size > 0;
}

/** pose(state, absoluteSeconds, {event, rate}) samples real skeletal clips at
 * 24 Hz. A new event restarts a one-shot attack/hit even if state is unchanged.
 * Numeric events are their simulation onset time, so skipped/replayed frames
 * sample the correct part of a clip rather than restarting the whole motion.
 * Phase desynchronizes looping clips only; deaths always begin at frame zero. */
export function create(kind, {height = 1.05, phase = 0} = {}) {
  if (!ready(kind) || !cloneRig) return null;
  const source = templates.get(kind), model = cloneRig(source.scene);
  const root = new T.Group(), anchor = new T.Group();
  root.name = 'keep-character-' + kind; root.userData.character = kind;
  root.add(anchor); anchor.add(model);
  anchor.scale.setScalar((Number.isFinite(height) && height > 0 ? height : 1.05) / source.height);
  anchor.position.y = -source.floor * anchor.scale.y;
  const mixer = new T.AnimationMixer(model), actions = new Map();
  const skeletons = new Set(); model.traverse(o => { if (o.skeleton) skeletons.add(o.skeleton); });
  let disposed = false, state = '', event, started = 0, last = -Infinity, frame = -Infinity;
  let current = null, previous = null;
  const offset = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;
  function actionFor(name) {
    if (!actions.has(name)) {
      const action = mixer.clipAction(source.clips.get(name));
      action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true;
      actions.set(name, action);
    }
    return actions.get(name);
  }
  const actor = {
    root,
    get state() { return state; },
    get duration() { return current ? current.getClip().duration : 0; },
    durationOf(name) { return (source.clips.get(name) || source.clips.get('idle')).duration; },
    pose(next, time, options = {}) {
      if (disposed) return false;
      if (!features.available()) { revoke(); return false; }
      if (!Number.isFinite(time)) return false;
      const name = source.clips.has(next) ? next : 'idle';
      const changed = name !== state || options.event !== event || time < last;
      const tick = Math.floor(time * 24);
      if (!changed && tick === frame) return true;
      if (changed) {
        previous = current;
        current = actionFor(name);
        // Discard a transition interrupted by another state, retaining at most
        // two active clips, independent of how long a battle has been running.
        actions.forEach(a => { if (a !== previous && a !== current) a.stop(); });
        if (previous === current) previous = null;
        current.reset().play(); current.paused = true;
        state = name; event = options.event;
        started = !LOOP.has(name) && Number.isFinite(event) ? Math.min(time, event) : time;
      }
      const rate = Number.isFinite(options.rate) ? Math.min(4, Math.max(.05, options.rate)) : 1;
      const elapsed = Math.max(0, time - started), duration = Math.max(.001, current.getClip().duration);
      current.time = LOOP.has(name)
        ? ((motion?.matches ? 0 : elapsed * rate) + offset * duration) % duration
        : Math.min(duration, elapsed * rate);
      current.enabled = true;
      const blend = previous ? Math.min(1, elapsed / .12) : 1;
      current.setEffectiveWeight(blend);
      if (previous) {
        previous.setEffectiveWeight(1 - blend);
        if (blend === 1) { previous.stop(); previous = null; }
      }
      mixer.update(0);
      last = time; frame = tick;
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; root.visible = false; root.removeFromParent();
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      skeletons.forEach(s => s.dispose());
      actors.delete(actor);
      // Geometry, textures and materials belong to the session's template.
    }
  };
  actors.add(actor);
  actor.pose('idle', 0);
  return actor;
}
