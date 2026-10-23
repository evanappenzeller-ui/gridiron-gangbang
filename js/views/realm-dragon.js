// Keepfall's dragon in 3D (the owner's ask, Oct 22 2026: "use model for dragons"; then "The dragon should be used as a
// hero in place of the wizzard. the dragon is unlocked through the hatchery and gets stronger with each upgrade to the
// hatchery"): models/keep-dragon.glb, "Mountain Dragon" by Alexey Zaika (Sketchfab, CC-BY-4.0: CREDIT below; cut to five
// clips, re-scaled and its textures shrunk, models/keep-dragon.txt), the owner's alone. Every Keepfall dragon is drawn
// from it once it's in: a dragon in a raid, a replay or an example raid (kind 'dragon', the old troop, or 'hero_dragon',
// the Dragon Hero: isDragonKind), the dragon resting over his Dragon Hatchery at home (createHomeDragon) and the two that
// fly round the scenery far out (createSceneryDragons, placed by views/realm-wildlife.js). The one over the hatchery is
// the Dragon Hero (core/realm.js HEROES.dragon): there once he's hatched (a Dragon Hatchery at level 1 or more), bigger
// with his level (the hatchery's), gone with another profile. Till it's in, or if it never
// comes (offline, a load that fails), the raid keeps the Dragon's picture and the scenery its silhouettes; at home there's
// nothing.
// It loads only on the owner's phone, when a dragon is about to be drawn (a raid with one, a built hatchery, the
// scenery's first in view: loadDragon), never from the offline cache (sw.js lets it through to the network: the owner's
// art stays out of the shared cache); a load that fails is tried again a minute on; another profile, here or in another
// tab (its storage cleared there too), drops it and every dragon at once; and it's let go a little after the last view
// that drew one is gone (no view left holding on to it, or to the renderers that drew it).
// Each dragon is a SkeletonUtils clone (the one geometry, material and textures shared) with its own AnimationMixer; its
// clips are blended by hand, by weight, at times worked out each frame from the battle's clock (so a replay paused, sped
// up or jumped along poses them as it plays): fly while it moves, hover while it waits, the attack timed so it rears
// ahead of each strike and the fire leaves the mouth as the battle looses it, a flinch when it's hurt, the death when
// it's killed (it drops from where it was hit, lands as the clip's impact comes, lies a moment, then sinks away).
import * as data from '../core/data.js';
import {KINDS, N, TROOPS, heroLevel} from '../core/realm.js';
import {DT} from '../core/realm-battle.js';

const V = new URL('../vendor/three/', import.meta.url).href;
export const MODEL_URL = new URL('../../models/keep-dragon.glb', import.meta.url).href;
/** The clips the model must have (models/keep-dragon.txt). */
export const CLIPS = Object.freeze(['fly', 'hover', 'attack', 'hit', 'death']);
/** The model's credit (its licence asks for one): views/realm.js shows it under How to play. */
export const CREDIT = Object.freeze({title: 'Mountain Dragon', url: 'https://sketchfab.com/3d-models/mountain-dragon-0a0665396f634b0e9d0872720087f52c',
  author: 'Alexey Zaika', authorUrl: 'https://sketchfab.com/lexazaixa25', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'});
/** A battle unit's kind that's drawn as the dragon: the old dragon troop or the Dragon Hero. */
export const isDragonKind = kind => kind === 'dragon' || kind === 'hero_dragon';
/** The dragon at home: the Dragon Hero, his level (0: not hatched, none shown). The one place that decides it: the
 *  hero's own level (core/realm.js heroLevel: his best Dragon Hatchery's, one at level 1 or more hatches him; worked out
 *  from the buildings, never from a saved roster entry; none for a realm without a roster, the computer's lots). */
export function homeDragonLevel(s) {
  return s && Array.isArray(s.b) ? heroLevel(s, 'dragon') : 0;
}
/** Where it rests: over his best hatchery, {x, y} its middle in tiles, or null (none built). */
export function homeDragonNest(s) {
  const all = s && Array.isArray(s.b) ? s.b : [];
  const nest = all.filter(b => b && b.t === 'hatchery' && b.l >= 1).sort((a, b) => b.l - a.l)[0];
  if (!nest || !KINDS[nest.t]) return null;
  const size = KINDS[nest.t].size;
  return {x: nest.x + size / 2, y: nest.y + size / 2, i: nest.i, t: nest.t};
}

// The model's numbers (its units: 1 = nose to tail; it faces +Z, +Y up; y 0 the ground under its feet standing).
const SPAN = 1.48;          // its wingspan
const BODY = .3;            // its body's middle above its origin, flying
const FIRE_AT = .62;        // when the attack's lunge looses fire or bites
const POSE_EVERY = 8;       // dragons posed a frame at most (more: in turns)
// Dragons drawn from the model in a battle (a hero always): an old raid's flock of up to MAX_MODELS (the computer's
// biggest, the example raids' 24, Oct 22 2026) all from it; a bigger one all keeps the picture (one flock, one look:
// till Oct 23 2026 the first 12 were the model and the rest the picture, side by side), the heroes still the model.
const MAX_MODELS = 24;
// The death (models/keep-dragon.txt): the clip recoils (0-0.6 s) and tips over head first (0.6-1.3 s), then hangs
// head-down in place (1.3-3.0 s, its head just clear of the ground) till the impact (3.0-3.2 s) and lies (to 3.6 s).
// Played: the recoil's snap eased (its first RECOIL s of clip over SLOW s, faded in over IN), the rest of it and the
// tip as they are, the hang hurried through, while the body drops from where it was hit, falling faster and faster
// (from FALL0) to land as the clip's impact comes (LAND); it lies a moment, then sinks away (SINK to GONE).
const DEATH = Object.freeze({IN: .3, SLOW: .5, RECOIL: .3, FALL0: .45, TIP: 1.5, LAND: 1.65, HANG: 1.3, IMPACT: 3, END: 3.6, SINK: 3.3, GONE: 4.1});
const deathClip = dT => dT <= DEATH.SLOW ? dT / DEATH.SLOW * DEATH.RECOIL
  : dT <= DEATH.TIP ? DEATH.RECOIL + (dT - DEATH.SLOW)
  : dT <= DEATH.LAND ? DEATH.HANG + (dT - DEATH.TIP) / (DEATH.LAND - DEATH.TIP) * (DEATH.IMPACT - DEATH.HANG)
  : Math.min(DEATH.END, DEATH.IMPACT + (dT - DEATH.LAND));
// In a raid: as big on the screen as the picture's dragon was in the poses it holds there (hovering, striking: its
// wings up, about 1.39 across at most, not the glide's 1.48), so wings spread about 5.6 tiles; its middle 2.8 tiles up
// (its dangling tail clear of the ground), bobbing; hovering it leans forward (HOVER_PITCH), its back and wings to the
// camera above. (Its hide is lifted and warmed a little in a raid: dark as it comes, it read as a stick at play zoom.)
export const BATTLE = Object.freeze({scale: 1.45 * 4 / SPAN, alt: 2.8});
const HOVER_PITCH = .3;
// A strike on its own clock (tau): the clip's abrupt opening, the rear (its first SLOW seconds), played at half speed,
// the rest as it is, so it rears for LEAD seconds before the battle's shot and lunges on it; faded in over IN. HURT:
// the flinch's weight (the death's opening recoil, eased: a little goes a long way at this size).
const STRIKE = Object.freeze({SLOW: .25, LEAD: FIRE_AT + .25, IN: .3, HURT: .38});
const strikeClip = tau => (tau < 2 * STRIKE.SLOW ? tau / 2 : tau - STRIKE.SLOW);
// (the battle's own beat, core/realm-battle.js: a strike, then the cooldown counted down by DT a step, struck again
// when it's spent: its 1 s spent in 11 steps, 1.1 s; a flyer strikes from its range and REACH)
const REACH = .55;
const cdSteps = cd => { let n = 0; do { cd = Math.max(0, cd - DT); n++; } while (cd > 0 && n < 99); return n; };
const PERIOD = cdSteps(1) * DT;
const distTo = (b, x, y) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.size)), Math.max(b.y - y, 0, y - (b.y + b.size)));
const W = x => x - N / 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const turnTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------------------------------- the model
// (a load that failed is tried again a minute on, or as soon as the phone is back online: one bad moment doesn't leave
// the pictures for the rest of the session)
let GL = null, LOADING = null, FAILED_AT = 0, EPOCH = 0, LOADS = 0, HOLD = false, AWAY = false, LINGER = 0;
const RETRY_MS = 60000, LINGER_MS = 20000;
const failed = () => FAILED_AT > 0 && Date.now() - FAILED_AT < RETRY_MS;
const READY = new Set();
// Whose phone it is: the owner's (data.isOwner), and not left with no profile by another tab: localStorage.clear()
// there comes with no key, which core/data.js doesn't hear (it keeps its own copy of gg-me: this tab still reads as
// his), so the dragon goes all the same, as the Knight model and the attack art do, till he's picked again (here, or
// gg-me his once more in the storage).
const mine = () => data.isOwner() && !AWAY;
// The views drawing dragons (a raid's, the home dragon, the scenery's): each {clear()}, cleared when the phone stops
// being his; the model let go LINGER_MS after the last of them is gone, unless another comes (each renderer that drew
// it leaves a listener on its geometry, material and textures, three.js's, kept till they're disposed).
const VIEWS = new Set();
function letGo() { EPOCH++; LOADING = null; FAILED_AT = 0; if (GL) { const g = GL; GL = null; drop(g); } }
function notHis() { letGo(); [...VIEWS].forEach(v => { try { v.clear(); } catch (_) { /* (the rest still cleared) */ } }); }
function joined(v) { VIEWS.add(v); clearTimeout(LINGER); LINGER = 0; return v; }
function left(v) {
  VIEWS.delete(v);
  if (VIEWS.size || LINGER) return;
  LINGER = setTimeout(() => { LINGER = 0; if (!VIEWS.size) letGo(); }, LINGER_MS);
}
data.subscribe(type => {
  if (type !== 'me') return;
  if (data.isOwner()) AWAY = false; else notHis();
});
function onStorage(e) {
  let now = null;
  try { now = localStorage.getItem('gg-me'); } catch (_) { /* (none to read: not his) */ }
  // (his in the storage, here and in every tab: back, if a clear had taken the dragon away)
  if (now === data.OWNER) { AWAY = false; return; }
  if (e.key !== null && e.key !== 'gg-me') return;
  if (e.key === null) AWAY = true;
  notHis();
}
if (typeof addEventListener === 'function') {
  addEventListener('online', () => { FAILED_AT = 0; });
  addEventListener('storage', onStorage);
}
/** For the checks: this tab told of a storage change elsewhere ({key}: null for a clear), as the browser tells it (the
 *  dragon's own listener alone: the rest of the app isn't stirred). */
export const _storage = e => onStorage(e);
const texturesOf = material => [...new Set(Object.keys(material).map(k => material[k]).filter(v => v && v.isTexture))];
function drop(g) {
  texturesOf(g.material).forEach(t => t.dispose()); g.material.dispose(); g.geometry.dispose();
}
/** The model's state, for the checks: {state: 'idle' | 'loading' | 'ready' | 'failed', clips, loads (fetches begun),
 *  views (drawing dragons now), lettingGo (none left: it goes soon), away (another tab cleared the profile)}. */
export const dragonState = () => ({state: GL ? 'ready' : LOADING ? 'loading' : failed() ? 'failed' : 'idle', clips: GL ? Object.keys(GL.clips) : [], loads: LOADS,
  views: VIEWS.size, lettingGo: !!LINGER, away: AWAY});
export const dragonReady = () => !!GL && !HOLD && mine();
/** For the checks: the model let go now, as LINGER_MS after the last view would (→ true if it was in). */
export function _letGo() { const had = !!GL; clearTimeout(LINGER); LINGER = 0; letGo(); return had; }
/** For the checks and tests: on, every dragon drawn from here on is a picture, as if the model weren't in. */
export function _holdModel(on) { HOLD = !!on; if (!HOLD && GL) READY.forEach(fn => { try { fn(); } catch (_) {} }); }
/** fn() each time the model comes in (a view redraws); → stop. */
export function onDragonReady(fn) { READY.add(fn); return () => READY.delete(fn); }

/** Loads the model (once; on the owner's phone only): resolves true when it's in, false if not (not his phone, or it
 *  couldn't be had: the picture stays). */
export function loadDragon() {
  if (!mine()) return Promise.resolve(false);
  if (GL) return Promise.resolve(true);
  if (LOADING) return LOADING;
  if (failed()) return Promise.resolve(false);
  const epoch = EPOCH, live = () => epoch === EPOCH && mine(), again = FAILED_AT > 0;
  const task = (async () => {
    try {
      const got = await readModel(MODEL_URL, live);
      if (!got) return false;
      if (!live()) { drop(got); return false; }
      GL = got; FAILED_AT = 0;
      return true;
    } catch (e) {
      // (said once: a retry that fails again stays quiet)
      if (live()) { FAILED_AT = Date.now(); if (!again) console.warn('Keepfall: the dragon stays a picture for now', e); }
      return false;
    }
  })();
  LOADING = task;
  task.then(ok => {
    if (LOADING === task) LOADING = null;
    if (ok && live()) READY.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });
  });
  return task;
}
/** The model read from url and made ready to clone ({T, SK, scene, mesh, geometry, material, clips}), or null (not the
 *  owner's phone, or it went while it loaded). Throws if it can't be read or isn't the dragon. */
async function readModel(url, live = mine) {
  if (!live()) return null;
  const [T, {GLTFLoader}, SK] = await Promise.all([import(V + 'three.module.min.js'), import(V + 'GLTFLoader.js'), import(V + 'SkeletonUtils.js')]);
  if (!live()) return null;
  LOADS++;
  const gltf = await new GLTFLoader().loadAsync(url);
  const clips = {};
  (gltf.animations || []).forEach(c => { clips[c.name] = c; });
  let mesh = null;
  gltf.scene.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const got = mesh && {T, SK, scene: gltf.scene, mesh, geometry: mesh.geometry, material: mesh.material, clips};
  if (!mesh || CLIPS.some(n => !clips[n])) { if (got) drop(got); throw new Error('not the dragon: its mesh or clips are missing'); }
  // (its clips reach well outside the first pose a skinned mesh measures itself by: one sphere round them all, in its
  // own units, so it's culled when it's off the screen and never while it's on; nothing picks it)
  mesh.boundingSphere = new T.Sphere(new T.Vector3(0, .38, .1), 1.3);
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.raycast = () => {};
  // (a raid's look: the room light at about 60% and the hide lifted and warmed toward the old picture's red: dark as
  // it comes, it read as a black stick at play zoom; home and the scenery take their own copies in its own colours)
  mesh.material.side = T.DoubleSide; mesh.material.envMapIntensity = .6; mesh.material.color.setRGB(1.5, 1.12, .95);
  if (!live()) { drop(got); return null; }
  return got;
}
/** For the checks: reads a model from url as loadDragon would, without keeping it (→ true if it would do, else false;
 *  never throws). */
export async function _tryRead(url) {
  try { const got = await readModel(url); if (got) drop(got); return !!got; } catch (_) { return false; }
}

// ---------------------------------------------------------------------------------------------------- one dragon
// The clone with its mixer: every clip playing at weight 0, its weight and time set by hand each frame (pose()).
function makeActor(G) {
  const model = G.SK.clone(G.scene);
  let mesh = null;
  model.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const mixer = new G.T.AnimationMixer(model), act = {};
  for (const n of CLIPS) { const a = mixer.clipAction(G.clips[n]); a.play(); a.setEffectiveWeight(0); act[n] = a; }
  const root = new G.T.Group();
  root.name = 'keep-dragon'; root.add(model);
  root.rotation.order = 'YXZ'; // (turned to its heading, then leaning forward, then banking)
  return {G, root, model, mesh, mixer, act, head: model.getObjectByName('Head'), len: {attack: G.clips.attack.duration, hit: G.clips.hit.duration, death: G.clips.death.duration}};
}
/** The clips' weights and times (seconds): base the flying loop's time, fly how much of it is the flying (the rest the
 *  hover); over the clips laid over it, {attack, hit, death: [time, weight]} (any left out at 0: several at once as one
 *  fades in over another). The flying loop has what weight is left. */
const OVER = ['attack', 'hit', 'death'];
function pose(A, base, fly, over = null) {
  let used = 0;
  for (const n of OVER) { const o = over && over[n], w = o ? clamp(o[1]) : 0; A.act[n].time = o ? clamp(o[0], 0, A.len[n]) : 0; A.act[n].setEffectiveWeight(w); used += w; }
  const k = Math.max(0, 1 - used);
  A.act.fly.time = A.act.hover.time = base;
  A.act.fly.setEffectiveWeight(k * fly); A.act.hover.setEffectiveWeight(k * (1 - fly));
  A.mixer.update(0);
}
/** Gets a renderer ready for the model before its first dragon shows (its textures sent to the GPU and its shader
 *  handed to the driver, which builds it off the page's thread where the phone can (KHR_parallel_shader_compile): one
 *  view's first dragon, its hero, no longer holds the screen still). A the actor whose look (material) is to be ready,
 *  in scene's light. (compile, not compileAsync: that one asks the driver on a timer of its own whether it's done, and
 *  threw when the view, its renderer, had gone meanwhile, Oct 23 2026; nothing's left waiting here.) */
function prepareRenderer(renderer, camera, scene, A) {
  if (!renderer || !A) return;
  try {
    texturesOf(A.mesh.material).forEach(t => renderer.initTexture(t));
    if (camera && typeof renderer.compile === 'function') renderer.compile(A.root, camera, scene);
  } catch (_) { /* (it's drawn regardless: only its first frame is slower) */ }
}
const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, {timeout: 1000}) : setTimeout(fn, 50));
function releaseActor(A) {
  if (!A) return;
  A.mixer.stopAllAction(); A.mixer.uncacheRoot(A.model);
  if (A.mesh && A.mesh.skeleton) A.mesh.skeleton.dispose();
  A.root.removeFromParent();
}
function blobTexture(T) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(.6, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(cv);
}
// The hero's marks, as the Knight Hero has them (views/realm-npcs.js createNPC): a ring on the ground (gold, or green
// defending) and his name and level over him, its plate in the same colours (green: his realm's own, defending it; two
// Dragon Heroes in one raid, his and the computer's, told apart by the plate when a building hides the ring), drawn
// over everything (a name, like the health bars: never behind a wing or a tower). A fallen hero's go at once.
export const BADGE_ON_TOP = 20000;
function heroBadge(T, text, def = false) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = def ? '#1F3129' : '#352524'; ctx.fillRect(0, 4, 256, 52);
  ctx.strokeStyle = def ? '#88D6AD' : '#F5CD67'; ctx.lineWidth = 3; ctx.strokeRect(2, 6, 252, 48);
  ctx.fillStyle = '#FFF3D8'; ctx.font = '700 27px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 31);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const badge = new T.Sprite(new T.SpriteMaterial({map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false}));
  badge.scale.set(1.86, .47, 1); badge.renderOrder = BADGE_ON_TOP; badge.raycast = () => {};
  return badge;
}
const levelOf = u => (Number.isInteger(u.level) && u.level > 0 ? u.level : Number.isInteger(u.l) && u.l > 0 ? u.l : 0);

// ---------------------------------------------------------------------------------------------------- in a raid
/**
 * The dragons of a raid (views/realm-3d.js raidStart): update(B, t, locate, now) each frame with the battle, its clock
 * and the page's (ms: the wingbeat's; a replay sped up flaps no faster than twice as quick, paused not at all)
 * (locate(u) → {x, y (tiles), moving} where unit u is drawn now, or null), then drawn holds the units drawn from the
 * model this frame (the rest keep their picture); a hero dragon gets his ring and badge either way. mouth(key, out) →
 * where its fire leaves (world), or null; falling(id) → true for a dragon drawn falling (it lands with its own dust).
 * warm(renderer, camera, n): the renderer readied and n dragons made before the first is wanted. reset() for a battle
 * drawn from its start again; dispose() with the raid. opts.onLand(x, y): a dragon that fell hit the ground there.
 * opts.source: where the model comes from (the checks'). counts.flock: the battle's trained dragons (all pictures when
 * more than MAX_MODELS).
 */
export function createBattleDragons(T, scene, opts = {}) {
  const source = opts.source || {get gl() { return dragonReady() ? GL : null; }};
  const group = new T.Group(); group.name = 'keep-battle-dragons'; scene.add(group);
  const actors = new Map(), drawn = new Set(), seen = new Set(), pool = [];
  const blobTex = blobTexture(T), blobGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobMat = new T.MeshBasicMaterial({map: blobTex, transparent: true, depthWrite: false, toneMapped: false, fog: false});
  const ringGeo = new T.RingGeometry(.84, 1, 48).rotateX(-Math.PI / 2);
  const ringMats = [0xF5CD67, 0x88D6AD].map(color => new T.MeshBasicMaterial({color, transparent: true, opacity: .72, depthWrite: false, toneMapped: false, fog: false}));
  const v = new T.Vector3(), fwd = new T.Vector3();
  let lastT = -1, lastNow = -1, flapT = 0, disposed = false, tick = 0, inUse = 0, warmed = null, flock = 0;
  const counts = {models: 0, pictures: 0, heroes: 0, flock: 0};
  const view = joined({clear() { clear(); pool.forEach(releaseActor); pool.length = 0; }});

  function make(u, def) {
    const n = Number(String(u.id).replace(/\D/g, '')) || 0;
    const a = {key: '', u, def, body: null, blob: null, ring: null, badge: null, capped: false, yaw: NaN, bank: 0, fly: 1, atk: 0, tau: -1, lastHit: -9, gap: 0,
      hurtAt: -9, hurt: 0, hp: u.hp, n: 0, posed: false, over: {attack: [0, 0], hit: [0, 0], death: [0, 0]}, deadAt: -1, landed: false, gone: false, x: 0, y: 0, ox: 0, oz: 0, oy: 0, alt: 0,
      phase: n * .37 % .8, bob: n, side: (n * .618 % 1) * 2 - 1, rise: (n * .382 % 1) * 2 - 1, level: 0};
    if (u.t === 'hero_dragon') {
      a.level = levelOf(u);
      a.ring = new T.Mesh(ringGeo, ringMats[def ? 1 : 0]); a.ring.renderOrder = 2; a.ring.raycast = () => {};
      a.badge = heroBadge(T, a.level ? `DRAGON  ${a.level}` : 'DRAGON', def);
      group.add(a.ring, a.badge);
    }
    return a;
  }
  function body(a) {
    if (a.body || a.capped || !source.gl) return a.body;
    // (a sky full of them: a flock bigger than MAX_MODELS all the picture, a hero the model always; none switching from
    // one to the other mid-flight)
    if (!a.ring && (flock > MAX_MODELS || inUse >= MAX_MODELS)) { a.capped = true; return null; }
    a.body = pool.pop() || makeActor(source.gl);
    inUse++;
    a.blob = a.blob || new T.Mesh(blobGeo, blobMat);
    a.blob.renderOrder = 2; a.blob.raycast = () => {};
    group.add(a.body.root, a.blob);
    return a.body;
  }
  function let_go(a) {
    if (a.body) { a.body.root.removeFromParent(); pool.push(a.body); a.body = null; inUse--; }
    if (a.blob) a.blob.removeFromParent();
    if (a.ring) a.ring.removeFromParent();
    if (a.badge) { a.badge.removeFromParent(); a.badge.material.map.dispose(); a.badge.material.dispose(); a.badge = null; }
  }
  function clear() { actors.forEach(let_go); actors.clear(); drawn.clear(); lastT = -1; lastNow = -1; inUse = 0; }
  function reset() { clear(); }
  /** The renderer readied for the model, and n dragons made at idle, one at a time (the first one now). */
  function warm(renderer, camera, n = 2) {
    const G = source.gl;
    if (disposed || !G || !mine()) return;
    if (warmed !== G) {
      warmed = G;
      if (!pool.length) pool.push(makeActor(G));
      pose(pool[0], 0, 0);
      prepareRenderer(renderer, camera, scene, pool[0]);
    }
    const more = () => { if (!disposed && source.gl === G && mine() && pool.length + inUse < n) { pool.push(makeActor(G)); idle(more); } };
    idle(more);
  }

  // When its next strike comes (battle seconds), so it rears for it in time (the clip's lunge on the battle's shot):
  // a flyer going for a building (or a hero) works it out as the battle will (flying straight at it, striking once
  // it's within its range and REACH and its cooldown is spent); another (one defending), the beat of its last two
  // strikes again while it holds still. NaN: not known.
  function nextStrike(a, u, B, moving) {
    const S = u.stats || TROOPS[u.t], tg = u.tg;
    if (S && S.fly && !u.targetHero && tg && !tg.dead && Number.isFinite(B.t) && S.speed > 0) {
      const d = tg.targetHero ? Math.hypot(tg.x - u.x, tg.y - u.y) : distTo(tg, u.x, u.y), reach = (S.range || 0) + REACH;
      const m = d <= reach ? 0 : Math.ceil((d - reach) / (S.speed * DT) - 1e-6);
      return B.t + Math.max(m + 1, cdSteps(u.cd || 0)) * DT;
    }
    if (moving || !(u.hitAt > -5)) return NaN;
    return u.hitAt + (a.gap || PERIOD);
  }
  // How far along its strike it is this frame (seconds on the strike's own clock, STRIKE.LEAD at the battle's shot),
  // or -1: not striking. From its last strike, else rearing for the next; never back along it (a strike a little sooner
  // or later than looked for: hurried or held to meet it).
  function strikeTime(a, u, B, t, dt, moving, len) {
    if (Number.isFinite(u.hitAt) && u.hitAt > -5 && u.hitAt !== a.lastHit) {
      const g = u.hitAt - a.lastHit;
      if (a.lastHit > -5 && g > .45 && g < 2.5) a.gap = g;
      a.lastHit = u.hitAt;
    }
    const since = t - (Number.isFinite(u.hitAt) ? u.hitAt : -9);
    let want = -1;
    if (since >= -.3 && since <= len - FIRE_AT) want = since + STRIKE.LEAD;
    else {
      const ahead = nextStrike(a, u, B, moving) - t;
      if (ahead <= STRIKE.LEAD && ahead > -.3) want = STRIKE.LEAD - ahead;
    }
    let tau = want;
    if (want >= 0 && a.tau >= 0) {
      if (dt === 0) tau = a.tau;
      else if (Math.abs(want - (a.tau + dt)) < .45) tau = clamp(want, a.tau + dt * .4, a.tau + dt * 2.5);
    }
    a.tau = tau;
    return tau;
  }

  /** One frame. */
  function update(B, t, locate, now) {
    const crowd = counts.models; tick++;
    drawn.clear(); seen.clear();
    counts.models = counts.pictures = counts.heroes = 0;
    if (disposed || !mine() || !B) { if (actors.size) clear(); return; }
    // (the battle's trained dragons, all it has: sent in and still to come)
    flock = counts.flock = ((B.used && B.used.dragon) || 0) + ((B.left && B.left.dragon) || 0);
    if (t < lastT - .05) clear(); // (the battle from its start again)
    const dt = lastT < 0 ? 0 : clamp(t - lastT, 0, .25);
    const rdt = Number.isFinite(now) && lastNow >= 0 ? clamp((now - lastNow) / 1000, 0, .25) : dt;
    lastT = t; if (Number.isFinite(now)) lastNow = now;
    // (the wingbeat's clock: the battle's, but never more than twice as quick as the page's)
    flapT += dt > 0 ? Math.min(dt, rdt * 2) : 0;
    const still = reduced();
    for (const list of [B.tr, B.defenders || []]) for (const u of list) {
      if (!isDragonKind(u.t)) continue;
      const def = !!u.targetHero, key = (def ? 'd:' : 'a:') + u.id;
      let a = actors.get(key);
      if (!a) {
        if (u.dead) continue; // (gone before it was ever drawn: a jump along a replay)
        a = make(u, def); a.key = key; a.n = actors.size; actors.set(key, a);
      }
      seen.add(key);
      if (a.gone) continue;
      const at = u.dead && a.deadAt >= 0 ? null : locate(u);
      if (at) { a.x = at.x; a.y = at.y; }
      else if (a.deadAt < 0 && !u.dead) continue;
      const moving = !!at && at.moving && !u.dead;
      const A = body(a);
      if (!A) {
        // (the picture till the model's in: realm-3d.js draws it; a hero still gets his marks)
        if (u.dead) { let_go(a); a.gone = true; continue; }
        counts.pictures++;
        marks(a, W(a.x), W(a.y), 4.35, 1); // (over the picture, drawn 2.3 up)
        continue;
      }
      drawn.add(u); counts.models++;
      const k = BATTLE.scale * (a.ring ? 1.08 + .02 * (clamp(a.level || 1, 1, 10) - 1) : 1);
      // facing where it's going (or what it's burning), turning at a dragon's pace, banking into the turn
      const want = Math.PI / 2 - (u.face || 0);
      if (Number.isNaN(a.yaw)) a.yaw = want;
      if (!u.dead) {
        const d = turnTo(a.yaw, want), step = clamp(d, -3.2 * dt, 3.2 * dt);
        a.yaw += step;
        a.bank += (clamp(-d * .6, -.35, .35) * (moving ? 1 : .3) - a.bank) * clamp(dt * 5);
      } else a.bank -= a.bank * clamp(dt * 3);
      a.fly += ((moving ? 1 : 0) - a.fly) * clamp(dt * 4);
      if (a.fly < .01 || a.fly > .99) a.fly = Math.round(a.fly); // (one loop, not two, at a weight: half the work)
      // the clips laid over the flying, each fading in over what was showing (never cut): striking (timed to the
      // battle's strikes), flinching from a hurt (under a strike), dying (what was showing held as it fades under it)
      const O = a.over;
      let dT = 0, ow = 0;
      if (u.dead) {
        if (a.deadAt < 0) a.deadAt = t;
        dT = t - a.deadAt; ow = smooth(dT / DEATH.IN);
        O.death[0] = deathClip(dT); O.death[1] = ow;
        if (dT < DEATH.IN) { O.attack[1] = (1 - ow) * a.atk; O.hit[1] = (1 - ow) * a.hurt * (1 - a.atk); } else O.attack[1] = O.hit[1] = 0;
        if (!a.landed && dT >= DEATH.LAND + .05) { a.landed = true; if (opts.onLand) opts.onLand(a.x + a.ox, a.y + a.oz); }
        if (dT >= DEATH.GONE) { let_go(a); a.gone = true; drawn.delete(u); counts.models--; continue; }
      } else {
        const tau = strikeTime(a, u, B, t, dt, moving, A.len.attack);
        const target = tau < 0 ? 0 : Math.min(smooth(tau / STRIKE.IN), smooth((STRIKE.LEAD + A.len.attack - FIRE_AT - tau) / .12));
        // (into the strike over at least 0.15 s; out of it as the clip comes home, or over a quarter second if it's
        // given up, its target gone)
        a.atk = target > a.atk ? Math.min(target, a.atk + dt / .15) : Math.max(target, a.atk - dt / (tau < 0 ? .25 : .1));
        if (a.atk < .01) a.atk = 0;
        if (tau >= 0) O.attack[0] = strikeClip(tau);
        O.attack[1] = a.atk;
        if (u.hp < a.hp - .5 && a.atk < .05 && t - a.hurtAt > 1.4) a.hurtAt = t;
        a.hp = u.hp;
        const hT = t - a.hurtAt;
        a.hurt = hT >= 0 && hT < A.len.hit ? STRIKE.HURT * Math.min(smooth(hT / .2), smooth((A.len.hit - hT) / .3)) : 0;
        O.hit[0] = hT; O.hit[1] = a.hurt * (1 - a.atk);
        O.death[1] = 0;
      }
      // (a crowd of them: each posed every few frames in turn, about POSE_EVERY a frame; one falling every frame)
      const turn = crowd > POSE_EVERY ? Math.ceil(crowd / POSE_EVERY) : 1;
      if (turn === 1 || u.dead || (a.n + tick) % turn === 0 || !a.posed) {
        pose(A, still ? .3 : (flapT * 1.25 + a.phase) % .8, a.fly, O);
        a.posed = true;
      }
      // where: high up and bobbing; hovering, each a little to one side and up or down of where the battle has it
      // (dragons at one building apart, not one heap of wings); dying, it drops from where it was hit and lies, then
      // sinks (a bigger hero a little higher, so its tail still hangs clear of the ground)
      if (!u.dead) {
        const hold = 1 - a.fly, s = a.side * .75 * hold * k / BATTLE.scale;
        a.ox = Math.cos(a.yaw) * s; a.oz = -Math.sin(a.yaw) * s; a.oy = a.rise * .3 * hold;
      }
      let y = BATTLE.alt + (k - BATTLE.scale) * .8 + a.oy + (still ? 0 : Math.sin(flapT * 2.2 + a.bob) * .12) - BODY * k;
      if (u.dead) {
        const f = clamp((dT - DEATH.FALL0) / (DEATH.LAND - DEATH.FALL0));
        y = a.alt * (1 - f * f);
        if (dT > DEATH.SINK) y -= .22 * k * smooth((dT - DEATH.SINK) / (DEATH.GONE - DEATH.SINK));
      } else a.alt = y;
      const px = W(a.x) + a.ox, pz = W(a.y) + a.oz;
      const pitch = HOVER_PITCH * (1 - a.fly) * (u.dead ? 1 - ow : 1);
      A.root.position.set(px, y, pz);
      A.root.rotation.set(pitch, a.yaw, a.bank);
      A.root.scale.setScalar(k);
      // its soft shadow on the ground, smaller and fainter the higher it is (gone before the body, sinking)
      const up = clamp((y + BODY * k) / 3.5), sink = u.dead ? 1 - smooth((dT - DEATH.SINK) / ((DEATH.GONE - DEATH.SINK) * .7)) : 1;
      a.blob.position.set(px, .021, pz);
      a.blob.scale.set(k * SPAN * .62 * (1 - .25 * up) * sink + .001, 1, k * .8 * (1 - .25 * up) * sink + .001);
      marks(a, px, pz, y + .62 * k + .3, k / BATTLE.scale);
    }
    actors.forEach((a, key) => { if (!seen.has(key)) { let_go(a); actors.delete(key); } });
  }
  function marks(a, x, z, top, k) {
    if (!a.ring) return;
    // (fallen: his ring and badge gone at once, as the Knight Hero's go; he drops and lies without them)
    if (a.u.dead) { a.ring.removeFromParent(); if (a.badge) a.badge.removeFromParent(); return; }
    counts.heroes++;
    a.ring.position.set(x, .028, z); a.ring.scale.setScalar(1.05 * k);
    if (!a.ring.parent) group.add(a.ring);
    if (a.badge) { a.badge.position.set(x, top, z); if (!a.badge.parent) group.add(a.badge); }
  }
  /** Where unit u's fire leaves its mouth (world, into out), or null when it isn't drawn from the model. */
  function mouth(key, out) {
    const a = actors.get(key);
    if (!a || !a.body || !a.body.head) return null;
    const A = a.body;
    A.root.updateMatrixWorld(true);
    A.head.getWorldPosition(out);
    fwd.set(Math.sin(a.yaw), 0, Math.cos(a.yaw));
    return out.addScaledVector(fwd, .1 * A.root.scale.x).add(v.set(0, -.04 * A.root.scale.x, 0));
  }
  /** True when the dragon key ('a:' or 'd:' and its id) is drawn from the model (its fire then leaves the model's mouth). */
  function modelled(key) { const a = actors.get(key); return !!a && !!a.body; }
  /** True for a dragon (unit id) drawn from the model and falling: it raises its own dust where it lands. */
  function falling(id) {
    return ['a:', 'd:'].some(p => { const a = actors.get(p + id); return !!a && !!a.body && a.u.dead && a.u.id === id; });
  }
  function dispose() {
    if (disposed) return;
    disposed = true; clear();
    pool.forEach(releaseActor); pool.length = 0;
    group.removeFromParent();
    blobGeo.dispose(); blobMat.dispose(); blobTex.dispose(); ringGeo.dispose(); ringMats.forEach(m => m.dispose());
    left(view);
  }
  return {update, drawn, mouth, modelled, falling, warm, reset, dispose, counts, group, actors, get pooled() { return pool.length; }};
}

// ---------------------------------------------------------------------------------------------------- at home
// The Dragon Hero over his hatchery: hovering just above its roof (the hover clip, a lazy wingbeat), looking about, and
// every forty seconds or so a slow circle out over the village and back. As wide as the hatchery, growing as it does
// (its picture goes from a nest of one egg at level 1 to a domed palace at 10: he's 1.6 times as big there, and rests
// higher, over its dome and against the grass beyond, not in front of it, dark on dark, as he was till Oct 23 2026); a
// little light of his own on him at home; his soft shadow on the grass only as he circles (resting, the hatchery's
// picture under him would cover it). A flyer over a village of
// pictures: drawn after them, over them (no picture covers it, not the hatchery's, not a taller neighbour's in front,
// the Castle's), its own parts in their order; a little nearer the camera than it is (bias: its place and size on the
// screen kept, as the folk are). Nothing while the model isn't in. With the camera pulled out past grow0 it grows (to
// half as big again by grow1), as the village's folk keep their size on the screen: at the village's usual framing
// it's a dragon, not a speck. It's drawn about 30 times a second at most (views/realm-3d.js), not at the screen's every
// refresh: the quiet village stays quiet.
// opts.renderer, opts.camera: readied for it before it first shows.
// (up: how much higher he rests at each level, over the roof of that level's picture; size0 + size a level: his size)
const HOME = Object.freeze({scale: 4.2 / SPAN, alt: 3.2, up: Object.freeze([0, .15, .35, .55, .7, .9, 1.1, 1.45, 1.9, 2.4]), size0: .9, size: .07, circle: 3.8, every: 40, loop: 11, bias: 3, grow0: 100, grow1: 210, grow: .55, order: 9000});
export function createHomeDragon(T, scene, opts = {}) {
  const group = new T.Group(); group.name = 'keep-home-dragon'; group.visible = false; scene.add(group);
  const blobTex = blobTexture(T), blob = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({map: blobTex, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: .8}));
  blob.renderOrder = -1999; blob.raycast = () => {};
  group.add(blob);
  let A = null, mat = null, nest = null, level = 0, disposed = false, yaw = Math.PI / 4;
  const counts = {level: 0, model: false, visible: false, circling: false};
  const p = new T.Vector3(), cam = new T.Vector3(), ndc = new T.Vector3();
  const view = joined({clear: () => clear()});
  function clear() {
    if (A) { releaseActor(A); A = null; }
    if (mat) { mat.dispose(); mat = null; }
    nest = null; level = 0; group.visible = false;
    Object.assign(counts, {level: 0, model: false, visible: false, circling: false});
  }
  // (made, and the renderer readied for it, as soon as the model's in: not on the frame it first shows)
  function prepare() {
    if (A || disposed || !nest || !dragonReady()) return;
    // (its own copy of the material, the raid's warm hide with a little more of the room's light on it: the village's
    // sun is softer than a raid's, and its stone grey would swallow the dragon's own colours)
    A = makeActor(GL); group.add(A.root); counts.model = true;
    mat = GL.material.clone(); mat.envMapIntensity = .95; A.mesh.material = mat;
    if (mat.emissive) { mat.emissive.setRGB(.16, .1, .06); mat.emissiveIntensity = 1; }
    // (drawn after the village's pictures, with the depth they left cleared: over them all, its own parts in order)
    mat.transparent = true; mat.depthWrite = true; A.mesh.renderOrder = HOME.order;
    A.mesh.onBeforeRender = renderer => { renderer.state.buffers.depth.setMask(true); renderer.clearDepth(); };
    pose(A, 0, 0);
    prepareRenderer(opts.renderer, opts.camera, scene, A);
  }
  /** The village as it stands (its Dragon Hero: its hatchery). */
  function setLot(s) {
    if (disposed || !mine()) { clear(); return; }
    level = homeDragonLevel(s); nest = level ? homeDragonNest(s) : null;
    counts.level = nest ? level : 0;
    if (!nest) { if (A) { releaseActor(A); A = null; } if (mat) { mat.dispose(); mat = null; } group.visible = false; counts.model = counts.visible = false; return; }
    loadDragon().then(ok => { if (ok && !disposed && mine()) prepare(); });
  }
  /** One frame (seconds: the page's clock): true while it's on the screen moving (another frame wanted). */
  function update(seconds, {zoom = 40, active = true, placement = false, camera = null} = {}) {
    if (disposed) return false;
    if (!mine()) { clear(); return false; }
    if (!nest || !active || placement || zoom > 230 || !dragonReady()) { group.visible = counts.visible = false; return false; }
    if (!A) prepare();
    const L = clamp(level, 1, 10) - 1, still = reduced(), k0 = HOME.scale * (HOME.size0 + HOME.size * L);
    const k = k0 * (1 + HOME.grow * smooth((zoom - HOME.grow0) / (HOME.grow1 - HOME.grow0)));
    // hovering where it rests, drifting a little; now and then a lazy circle out to one side and back
    const drift = still ? 0 : 1, hx = nest.x + Math.sin(seconds * .31) * .25 * drift, hy = nest.y + Math.cos(seconds * .23) * .2 * drift;
    let x = hx, y = hy, alt = HOME.alt + HOME.up[L] + (k - k0) * .6 + (still ? 0 : Math.sin(seconds * 1.1) * .14), fly = 0, bank = 0;
    let face = Math.PI / 4 + (still ? 0 : Math.sin(seconds * .17) * .6);
    const c = still ? 0 : (seconds + nest.i * 7.3) % HOME.every, u = (c - (HOME.every - HOME.loop)) / HOME.loop;
    counts.circling = u > 0 && u < 1;
    if (counts.circling) {
      const side = Math.floor((seconds + nest.i * 7.3) / HOME.every) % 2 ? 1 : -1, phi = side > 0 ? -Math.PI / 4 : Math.PI * .75;
      const th = Math.PI * 2 * smooth(u) * -side, R = HOME.circle, a0 = phi + Math.PI;
      x = hx + R * Math.cos(phi) + R * Math.cos(a0 + th); y = hy + R * Math.sin(phi) + R * Math.sin(a0 + th);
      alt += .7 * Math.sin(Math.PI * u);
      const tx = -Math.sin(a0 + th) * -side, tz = Math.cos(a0 + th) * -side, w = Math.min(smooth(u / .14), smooth((1 - u) / .14));
      face += turnTo(face, Math.atan2(tx, tz)) * w;
      fly = w; bank = -.32 * side * w;
    }
    yaw = face;
    pose(A, still ? .3 : (seconds * 1.0) % .8, fly);
    p.set(W(x), alt - BODY * k, W(y));
    // (nearer the camera by bias, its size on the screen kept)
    let s = k;
    if (camera) {
      cam.copy(camera.position).sub(p);
      const d = cam.length(), b = Math.min(HOME.bias, d * .5);
      p.addScaledVector(cam, b / d); s = k * (d - b) / d;
      ndc.set(W(x), alt, W(y)).project(camera);
      counts.visible = ndc.z < 1 && Math.abs(ndc.x) < 1.35 && Math.abs(ndc.y) < 1.35;
    } else counts.visible = true;
    A.root.position.copy(p); A.root.rotation.set(0, yaw, bank); A.root.scale.setScalar(s);
    const up = clamp(alt / 5);
    blob.position.set(W(x), .02, W(y)); blob.scale.set(k * SPAN * .6 * (1 - .3 * up), 1, k * .78 * (1 - .3 * up));
    blob.material.opacity = .8 * fly; blob.visible = fly > .02;
    group.visible = true;
    return counts.visible && !still;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; clear();
    group.removeFromParent(); blob.geometry.dispose(); blob.material.dispose(); blobTex.dispose();
    left(view);
  }
  return {setLot, update, dispose, counts, group, get animated() { return !!A && !!nest && group.visible && !reduced(); }};
}

// ---------------------------------------------------------------------------------------------------- the scenery
/**
 * The scenery's flying dragons drawn from the model (views/realm-wildlife.js keeps its own silhouettes till it's in):
 * n of them in parent. ready → true once the model's in (they're made then); place(i, ground point, altitude, yaw,
 * size (the silhouette's), bank, time) each frame, hide(i); opacity(f) for the wildlife's fade in as the camera pulls
 * out. Their own copy of the material (see-through for the fade, no fog: as the silhouettes were drawn).
 */
export function createSceneryDragons(T, parent, n) {
  const items = [];
  let mat = null, dead = false;
  const view = joined({clear: () => clear()});
  function clear() { items.forEach(releaseActor); items.length = 0; if (mat) { mat.dispose(); mat = null; } }
  function ensure() {
    if (dead) return false;
    // (wanted the first time they're in view: the model fetched then, the silhouettes meanwhile)
    if (!dragonReady()) { if (!GL && !HOLD && mine()) loadDragon(); return false; }
    if (items.length) return true;
    mat = GL.material.clone(); mat.transparent = true; mat.fog = false; mat.opacity = 0; mat.color.set(0xFFFFFF); mat.envMapIntensity = .45;
    for (let i = 0; i < n; i++) { const A = makeActor(GL); A.mesh.material = mat; A.root.visible = false; parent.add(A.root); items.push(A); }
    return true;
  }
  return {
    get ready() { return ensure(); },
    get count() { return items.length; },
    place(i, at, altitude, yaw, size, bank, time) {
      const A = items[i];
      if (!A) return;
      // (the silhouette was 3.4 long and 4.3 across at size 1: the model a little smaller than that across, flapping
      // slower than a battle's dragon)
      const k = size * 2.6;
      A.root.visible = true;
      A.root.position.set(at.x, at.y + altitude - BODY * k, at.z);
      A.root.rotation.set(0, yaw, bank);
      A.root.scale.setScalar(k);
      pose(A, reduced() ? .3 : (time * .6 + i * .31) % .8, 1);
    },
    hide(i) { if (items[i]) items[i].root.visible = false; },
    opacity(f) { if (mat) mat.opacity = f; },
    dispose() { if (dead) return; dead = true; clear(); left(view); }
  };
}
