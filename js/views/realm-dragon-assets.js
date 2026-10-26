// Four hatchery dragons. Templates and color maps are shared; each actor owns
// its bones and animation mixer. Geometry is exported +Y up, +Z forward.
import * as features from '../core/features.js';
import * as data from '../core/data.js';
import {DRAGONS, DRAGON_ORDER} from '../core/realm-dragons.js';

const V = new URL('../vendor/three/', import.meta.url).href;
const AT = new URL('../../models/realm/dragons-v1/', import.meta.url).href;
const models = new Map(), looks = new Map(), jobs = new Map(), failed = new Map(), actors = new Set(), listeners = new Set();
let generation = 0, modules = null;
const known = species => Object.hasOwn(DRAGONS, species);
export const speciesOfUnit = u => known(u?.species) ? u.species : DRAGON_ORDER.find(s => DRAGONS[s].troop === u?.t) || null;
export const dragonColor = (species, color) => known(species) && DRAGONS[species].colors.includes(color) ? color : 'red';
export const dragonThumb = (species, color = 'red') => known(species) ? AT + `thumbs/${species}-${dragonColor(species, color)}.webp` : '';
export const onDragonAssetReady = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach(fn => { try { fn(); } catch (_) {} });
const materialsOf = root => { const out = new Set(); root.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) out.add(m); }); return out; };
const texturesOf = material => Object.values(material).filter(v => v?.isTexture);
function dropModel(model) {
  const geometries = new Set(), textures = new Set(), skeletons = new Set();
  model.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.skeleton) skeletons.add(o.skeleton); });
  materialsOf(model.scene).forEach(m => { texturesOf(m).forEach(t => textures.add(t)); m.dispose(); });
  geometries.forEach(g => g.dispose()); skeletons.forEach(s => s.dispose());
  textures.forEach(t => { t.dispose(); t.image?.close?.(); });
}
export function clearDragonAssets() {
  generation++; jobs.clear(); failed.clear();
  [...actors].forEach(a => a.dispose());
  looks.forEach(look => { look.material.dispose(); look.textures.forEach(t => { t.dispose(); t.image?.close?.(); }); }); looks.clear();
  models.forEach(dropModel); models.clear();
}
data.subscribe(type => { if ((type === 'me' || type === 'data') && !features.available()) clearDragonAssets(); });

async function once(key, work) {
  if (jobs.has(key)) return jobs.get(key);
  if (Date.now() - (failed.get(key) || 0) < 30000) return false;
  const ticket = generation;
  const task = work(() => ticket === generation && features.available()).catch(error => {
    if (ticket === generation && features.available()) { failed.set(key, Date.now()); console.warn('Keepfall: dragon asset unavailable', key, error); }
    return false;
  });
  jobs.set(key, task);
  task.then(() => { if (jobs.get(key) === task) jobs.delete(key); });
  return task;
}
async function libraries() {
  if (!modules) modules = Promise.all([import(V + 'three.module.min.js'), import(V + 'GLTFLoader.js'), import(V + 'SkeletonUtils.js')]);
  return modules;
}
export async function loadDragonAsset(species, selected = 'red') {
  if (!features.available() || !known(species)) return false;
  const color = dragonColor(species, selected), key = species + ':' + color;
  if (!models.has(species)) await once('model:' + species, async live => {
    const [T, {GLTFLoader}, SK] = await libraries(); if (!live()) return false;
    const gltf = await new GLTFLoader().loadAsync(AT + species + '.glb');
    const model = {scene: gltf.scene, clips: new Map(gltf.animations.map(c => [c.name, c])), T, SK};
    if (!live()) { dropModel(model); return false; }
    if (!model.clips.has('idle') || !model.clips.has('death')) { dropModel(model); throw new Error('Missing dragon clips'); }
    model.scene.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model.scene), size = box.getSize(new T.Vector3());
    // Wing-down and wing-spread poses can be much wider than the standing mesh.
    // Offline sampled flight bounds keep four flyers readable at battle scale.
    const dimensions = model.scene.userData.dimensions || {};
    model.span = Math.max(size.x, size.z, DRAGONS[species].fly ? dimensions.flightWidth || 0 : 0, .01); model.height = size.y;
    model.scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false; o.frustumCulled = false; o.raycast = () => {};
    });
    models.set(species, model); return true;
  });
  if (!features.available() || !models.has(species)) return false;
  if (!looks.has(key)) await once('look:' + key, async live => {
    const model = models.get(species), T = model.T, original = [...materialsOf(model.scene)][0];
    const material = original.clone(), textures = [];
    try {
      const loader = new T.TextureLoader();
      const entries = [['map', ''], ['normalMap', '-normal'], ...(species === 'nightmare' ? [] : [['emissiveMap', '-emission']])];
      const results = await Promise.allSettled(entries.map(async ([slot, suffix]) => {
        const texture = await loader.loadAsync(AT + `textures/${species}-${color}${suffix}.webp`);
        textures.push(texture); texture.flipY = false;
        texture.colorSpace = slot === 'normalMap' ? T.NoColorSpace : T.SRGBColorSpace;
        texture.anisotropy = 2; material[slot] = texture;
      }));
      const rejected = results.find(result => result.status === 'rejected');
      if (rejected) throw rejected.reason;
      if (!live() || models.get(species) !== model) { material.dispose(); textures.forEach(t => t.dispose()); return false; }
      material.color.set(0xffffff); material.envMapIntensity = .75; material.roughness = .8;
      if (material.emissiveMap) { material.emissive.set(0xffffff); material.emissiveIntensity = .3; }
      material.needsUpdate = true;
      looks.set(key, {material, textures}); changed(); return true;
    } catch (error) { material.dispose(); textures.forEach(t => t.dispose()); throw error; }
  });
  return features.available() && models.has(species) && looks.has(key);
}
export const dragonAssetReady = (species, color = 'red') => features.available() && models.has(species) && looks.has(species + ':' + dragonColor(species, color));

/** span is the model's standing horizontal footprint, in game tiles. */
export function createDragonAsset(species, selected = 'red', {span = 4.2, phase = 0, overlay = false} = {}) {
  const color = dragonColor(species, selected);
  if (!dragonAssetReady(species, color)) return null;
  const G = models.get(species), T = G.T, model = G.SK.clone(G.scene), root = new T.Group();
  const material = looks.get(species + ':' + color).material;
  const privateMaterial = overlay ? material.clone() : null;
  const meshes = [], skeletons = new Set();
  model.traverse(o => {
    if (!o.isMesh) return;
    o.material = privateMaterial || material; o.raycast = () => {};
    if (overlay) { o.renderOrder = 9000; o.material.transparent = true; }
    meshes.push(o); if (o.skeleton) skeletons.add(o.skeleton);
  });
  root.name = 'keep-dragon-' + species; root.userData = {dragon: true, species, color}; root.add(model);
  root.rotation.order = 'YXZ'; root.scale.setScalar(span / G.span);
  const mixer = new T.AnimationMixer(model), actions = new Map();
  let state = '', event, onset = 0, last = -Infinity, tick = -Infinity, current = null, previous = null, dead = false;
  const headName = model.userData.mouthBone;
  let head = headName ? model.getObjectByName(headName) : null;
  model.traverse(o => { if (!head && o.isBone && /^(UpperMouth|Head)$/i.test(o.name)) head = o; });
  const headPoint = new T.Vector3();
  const actor = {
    root, model, meshes, species, color, fly: !!DRAGONS[species].fly, nativeSpan: G.span, nativeHeight: G.height,
    get state() { return state; },
    durationOf(name) { return (G.clips.get(name) || G.clips.get('idle')).duration; },
    hasClip(name) { return G.clips.has(name); },
    pose(next, time, {event: nextEvent, rate = 1, still = false} = {}) {
      if (dead || !features.available() || !Number.isFinite(time)) return false;
      const name = G.clips.has(next) ? next : 'idle', loop = /^(idle|walk|run|fly|fly-idle)$/.test(name);
      const changedState = name !== state || nextEvent !== event || time < last;
      const frame = Math.floor(time * 30);
      if (!changedState && frame === tick) return true;
      if (changedState) {
        previous = current;
        if (!actions.has(name)) { const action = mixer.clipAction(G.clips.get(name)); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; actions.set(name, action); }
        current = actions.get(name);
        actions.forEach(a => { if (a !== current && a !== previous) a.stop(); });
        if (previous === current) previous = null;
        current.reset().play(); current.paused = true;
        state = name; event = nextEvent; onset = Number.isFinite(event) ? Math.min(time, event) : time;
      }
      const duration = Math.max(.001, current.getClip().duration), elapsed = Math.max(0, time - onset);
      current.time = loop ? ((still ? phase : time * rate + phase) % duration + duration) % duration : Math.min(duration, elapsed * rate);
      current.enabled = true;
      const blend = previous ? Math.min(1, elapsed / .16) : 1;
      current.setEffectiveWeight(blend);
      if (previous) { previous.setEffectiveWeight(1 - blend); if (blend === 1) { previous.stop(); previous = null; } }
      mixer.update(0); last = time; tick = frame; return true;
    },
    mouth(out) {
      root.updateMatrixWorld(true);
      if (head) { head.getWorldPosition(out); root.getWorldDirection(headPoint); return out.addScaledVector(headPoint, .14 * root.scale.x); }
      return root.localToWorld(out.set(0, G.height * .65, G.span * .35));
    },
    dispose() {
      if (dead) return; dead = true; root.removeFromParent();
      mixer.stopAllAction(); mixer.uncacheRoot(model); skeletons.forEach(s => s.dispose()); privateMaterial?.dispose(); actors.delete(actor);
    }
  };
  actors.add(actor); actor.pose('idle', 0); return actor;
}
