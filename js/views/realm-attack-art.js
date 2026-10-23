// Owner-only raid poses and weapon effects. Rendering reads the battle clock and never changes combat state.
// Atlases load only for an active raid; each soldier selects its own frame on the shared texture.
import * as data from '../core/data.js';
import {N, TROOPS} from '../core/realm.js';

const AT = new URL('../../img/realm/army/attacks-v1/', import.meta.url).href;
const KINDS = ['footman', 'knight', 'archer', 'dragon', 'effects'];
const SWORDS = new Set(['footman', 'knight', 'hero_knight']);
const SHOTS = {archer: 'arrow', dragon: 'dragon', hero_dragon: 'dragon', hero_wizard: 'fireball', wizard: 'fireball'};
// (whose sheet a kind poses from: the Dragon Hero, while he's a picture (views/realm-dragon.js draws him once his model's
// in), from the dragon's)
const SHEET_OF = {hero_dragon: 'dragon'};
const ROWS = {sword: 0, arrow: 1, dragon: 2, fireball: 3};
// Muzzle points on the six normalized dragon cells (top-left coordinates, matching the manifest's anchors).
const DRAGON_MOUTH = [[.79, .59], [.72, .34], [.72, .48], [.72, .49], [.79, .52], [.79, .56]];
const MAX_EFFECTS = 256;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const W = x => x - N / 2;

/** An instance belongs to one raid view. restart keeps its GPU assets for replay scrubbing; dispose releases them. */
export function createRaidAttacks(T, scene, {camera, onChange = () => {}} = {}) {
  let dead = false, epoch = 0, loading = null, battle = null, lastTime = -Infinity, effects = null, used = 0;
  let seen = new WeakSet(), shots = [];
  const sheets = new Map();
  const position = new T.Vector3(), start = new T.Vector3(), end = new T.Vector3(), delta = new T.Vector3();
  const right = new T.Vector3(), up = new T.Vector3(), forward = new T.Vector3();
  const scale = new T.Vector3(), rotation = new T.Quaternion(), turn = new T.Quaternion(), zAxis = new T.Vector3(0, 0, 1);
  const matrix = new T.Matrix4();
  const active = () => !dead && data.isOwner();
  // data emits 'me' for both this tab and gg-me storage changes in another tab.
  const unsubscribe = data.subscribe(type => { if (type === 'me' && !data.isOwner()) dispose(); });
  // localStorage.clear has a null key and does not pass through data's individual-key storage listener.
  const storageChanged = event => { if (event.key === null || (event.key === 'gg-me' && event.newValue !== data.OWNER)) dispose(); };
  globalThis.addEventListener?.('storage', storageChanged);

  const metadata = (kind, entry, texture) => {
    const e = entry || {}, fx = kind === 'effects';
    const cols = Number.isInteger(e.cols) && e.cols > 0 && e.cols <= 16 ? e.cols : fx ? 4 : 3;
    const rows = Number.isInteger(e.rows) && e.rows > 0 && e.rows <= 16 ? e.rows : fx ? 4 : 2;
    return {texture, cols, rows, frames: clamp(Number(e.frames) || cols * rows, 1, cols * rows),
      right: e.right !== false, ax: Number.isFinite(e.ax) ? e.ax : .5,
      ay: Number.isFinite(e.ay) ? e.ay : kind === 'dragon' ? .5 : .94,
      bodyFraction: Number(e.bodyFraction) > 0 ? e.bodyFraction : .85,
      cellAspect: Number(e.cellAspect) > 0 ? e.cellAspect : (texture.image.width / cols) / (texture.image.height / rows),
      releaseFrame: Number.isInteger(e.releaseFrame) ? clamp(e.releaseFrame, 1, 4) : 2,
      mouth: Array.isArray(e.mouth) && e.mouth.length === 6 ? e.mouth : DRAGON_MOUTH};
  };

  function load() {
    if (!active()) return Promise.resolve(false);
    if (loading) return loading;
    const token = epoch, valid = () => active() && token === epoch;
    loading = (async () => {
      try {
        const response = await fetch(AT + 'manifest.json');
        if (!valid() || !response.ok) return false;
        const manifest = await response.json();
        if (!valid()) return false;
        const loader = new T.TextureLoader();
        await Promise.all(KINDS.map(async kind => {
          if (!valid()) return;
          let texture;
          try {
            texture = await loader.loadAsync(AT + kind + '.webp');
            if (!valid()) { texture.dispose(); return; }
            texture.colorSpace = T.SRGBColorSpace;
            texture.minFilter = T.LinearFilter; texture.magFilter = T.LinearFilter;
            texture.generateMipmaps = false; // Atlas cells stay separate when the raid is zoomed out.
            texture.needsUpdate = true;
            sheets.set(kind, metadata(kind, manifest.sheets?.[kind], texture));
          } catch (_) { if (texture) texture.dispose(); }
        }));
        if (!valid()) return false;
        if (sheets.has('effects')) makeEffects();
        onChange();
        return sheets.size > 0;
      } catch (_) { return false; }
    })();
    return loading;
  }

  function makeEffects() {
    if (!active() || effects) return;
    const atlas = sheets.get('effects');
    if (!atlas || atlas.cols < 4 || atlas.rows < 4) return;
    const geometry = new T.PlaneGeometry(1, 1);
    const tiles = new T.InstancedBufferAttribute(new Float32Array(MAX_EFFECTS), 1);
    const alphas = new T.InstancedBufferAttribute(new Float32Array(MAX_EFFECTS), 1);
    tiles.setUsage(T.DynamicDrawUsage); alphas.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('raidTile', tiles); geometry.setAttribute('raidAlpha', alphas);
    const material = new T.MeshBasicMaterial({map: atlas.texture, transparent: true, alphaTest: .015,
      depthWrite: false, toneMapped: false, fog: false, side: T.DoubleSide});
    // A single draw call for all weapons, with independent atlas cells and fading for every instance.
    material.onBeforeCompile = shader => {
      const padX = .5 / (atlas.texture.image.width / atlas.cols), padY = .5 / (atlas.texture.image.height / atlas.rows);
      shader.vertexShader = 'attribute float raidTile; attribute float raidAlpha; varying float vRaidAlpha;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vRaidAlpha = raidAlpha;
        #ifdef USE_MAP
          vec2 raidCell = vec2(mod(raidTile, ${atlas.cols.toFixed(1)}), ${atlas.rows.toFixed(1)} - 1.0 - floor(raidTile / ${atlas.cols.toFixed(1)}));
          vMapUv = (raidCell + vec2(${padX.toFixed(8)}, ${padY.toFixed(8)}) + vMapUv * vec2(${(1 - 2 * padX).toFixed(8)}, ${(1 - 2 * padY).toFixed(8)})) / vec2(${atlas.cols.toFixed(1)}, ${atlas.rows.toFixed(1)});
        #endif`);
      shader.fragmentShader = 'varying float vRaidAlpha;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.a *= vRaidAlpha;');
    };
    material.customProgramCacheKey = () => 'realm-raid-effects-v1-' + atlas.cols + '-' + atlas.rows;
    const mesh = new T.InstancedMesh(geometry, material, MAX_EFFECTS);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false;
    mesh.name = 'realm-raid-attack-effects'; mesh.userData.visualOnly = true;
    mesh.userData.counts = {sword: 0, arrow: 0, dragon: 0, fireball: 0};
    mesh.raycast = () => {}; scene.add(mesh);
    effects = {mesh, geometry, material, tiles, alphas, atlas};
  }

  const sheet = kind => active() ? sheets.get(kind) || null : null;
  const ready = () => active() && sheets.size > 0;
  const handlesShot = shot => active() && !!effects && !!SHOTS[shot?.k];

  function inReach(u) {
    const target = u.wallAt && !u.wallAt.dead ? u.wallAt : u.tg;
    if (!target || target.dead || u.dead) return false;
    const stats = u.stats || TROOPS[u.t];
    if (!stats) return false;
    const distance = target.targetHero ? Math.hypot(target.x - u.x, target.y - u.y)
      : Math.hypot(Math.max(target.x - u.x, 0, u.x - target.x - target.size), Math.max(target.y - u.y, 0, u.y - target.y - target.size));
    return distance <= stats.range + .55;
  }

  /** The release frame coincides with hitAt. A future simulation hit winds up, never releasing a weapon early. */
  function frame(u, t) {
    const atlas = u && sheet(SHEET_OF[u.t] || u.t);
    if (!atlas || u.dead) return 5;
    const release = atlas.releaseFrame, age = t - u.hitAt;
    if (u.hitAt >= 0 && age >= 0 && age < .42) return Math.min(5, release + Math.floor(age / .09));
    let until = u.hitAt >= 0 && age < 0 ? -age : Infinity;
    // Only anticipate the next strike while the current target is still in range. Walking and retargeting stay ready.
    if (battle && u.cd > 0 && inReach(u)) until = Math.min(until, battle.t + u.cd - t);
    if (until > 0 && until <= .22) return clamp(Math.floor((.22 - until) / (.22 / release)), 0, release - 1);
    return 5;
  }

  function put(kind, frameNumber, at, angle, width, height, alpha = 1) {
    if (!effects || used >= MAX_EFFECTS || alpha <= 0) return;
    const {mesh, tiles, alphas, atlas} = effects;
    rotation.copy(camera.quaternion).multiply(turn.setFromAxisAngle(zAxis, angle));
    matrix.compose(at, rotation, scale.set(width, height, 1));
    mesh.setMatrixAt(used, matrix);
    tiles.setX(used, ROWS[kind] * atlas.cols + clamp(frameNumber | 0, 0, 3));
    alphas.setX(used, clamp(alpha)); mesh.userData.counts[kind]++;
    used++;
  }

  // Project the world direction onto the camera's right/up axes so a billboard points along its flight path.
  const angleOf = direction => Math.atan2(direction.dot(up), direction.dot(right));
  function drawSword(u, t) {
    const age = t - u.hitAt;
    if (!SWORDS.has(u.t) || u.dead || u.hitAt < 0 || age < 0 || age >= .28) return;
    const hero = u.t === 'hero_knight', face = Number.isFinite(u.face) ? u.face : 0;
    delta.set(Math.cos(face), 0, Math.sin(face));
    position.set(W(u.x) + delta.x * .6, hero ? 1.0 : .72, W(u.y) + delta.z * .6);
    // Pull the slash toward the lens so it reads beside the sword without sinking into its wielder.
    position.addScaledVector(forward, .04);
    const a = age / .28, size = (hero ? 1.55 : 1.15) * (.85 + a * .25);
    put('sword', Math.floor(a * 4), position, angleOf(delta), size, size, Math.min(1, (1 - a) * 3));
  }

  function drawShot(s, t) {
    const age = t - s.t0, duration = Math.max(.01, s.t1 - s.t0);
    if (age < 0) return;
    const kind = SHOTS[s.k], progress = clamp(age / duration), after = t - s.t1;
    const endHeight = s.high ? 2.45 : .55;
    start.set(W(s.x0), kind === 'dragon' ? 2.7 : kind === 'fireball' ? 1.05 : .85, W(s.y0));
    end.set(W(s.x1), endHeight, W(s.y1));
    if (kind === 'dragon') {
      if (after > .1) return;
      // (the dragon that loosed it: a raider's, or a Dragon Hero defending's)
      const atlas = sheet('dragon'), source = (s.foe ? battle?.defenders : battle?.tr)?.find(u => u.id === s.from);
      if (atlas) {
        // Match the drawn dragon's anchor, facing, bob and attack lean. Ground-direction offsets miss a billboard's mouth.
        const face = source?.face ?? Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
        const facesRight = Math.cos(face) - Math.sin(face) >= 0, sx = facesRight === atlas.right ? 1 : -1;
        const pose = source ? frame(source, t) : Math.min(5, atlas.releaseFrame + Math.floor(age / .09));
        const mouth = atlas.mouth[pose], width = 3.4 / atlas.bodyFraction, height = width / atlas.cellAspect;
        const tilt = sx * .25 * (age < .35 ? Math.sin(age / .35 * Math.PI) : 0);
        const mx = (mouth[0] - atlas.ax) * width * sx, my = (atlas.ay - mouth[1]) * height;
        start.y = 2.3 + Math.sin(t * 2.2 + (Number(s.from) || 0)) * .15;
        start.addScaledVector(right, mx * Math.cos(tilt) - my * Math.sin(tilt));
        start.addScaledVector(up, mx * Math.sin(tilt) + my * Math.cos(tilt));
      } else {
        delta.subVectors(end, start);
        const horizontal = Math.hypot(delta.x, delta.z);
        if (horizontal > .01) { start.x += delta.x / horizontal * .65; start.z += delta.z / horizontal * .65; }
      }
      // A connected cone grows out of the mouth and reaches the target on the authoritative landing time.
      end.lerpVectors(start, end, progress);
      delta.subVectors(end, start);
      const length = Math.hypot(delta.dot(right), delta.dot(up));
      if (length < .05) return;
      position.lerpVectors(start, end, .5).addScaledVector(forward, .035);
      put(kind, Math.min(3, Math.floor(progress * 4)), position, angleOf(delta), length * 1.1,
        .45 + progress * 1.2, after > 0 ? 1 - after / .1 : 1);
      return;
    }
    if (after > 0) {
      if (kind !== 'fireball' || after >= .16) return;
      position.copy(end).addScaledVector(forward, .08);
      put(kind, 3, position, angleOf(delta.subVectors(end, start)), 1.15 + after * 3, .95 + after * 3, 1 - after / .16);
      return;
    }
    const arc = kind === 'arrow' ? .75 : .18;
    position.lerpVectors(start, end, progress); position.y += arc * 4 * progress * (1 - progress);
    delta.subVectors(end, start); delta.y += arc * 4 * (1 - 2 * progress);
    put(kind, Math.min(3, Math.floor(progress * 4)), position, angleOf(delta), kind === 'arrow' ? 1.2 : 1.5,
      kind === 'arrow' ? .65 : 1.05);
  }

  /** One frame of battle B at its clock t. skip(shot) → true for a shot drawn elsewhere (a dragon's fire the dragon's
   *  model draws from its mouth: views/realm-3d.js), asked once, as the shot is first seen. */
  function update(B, t, skip = null) {
    if (!active()) { dispose(); return false; }
    if (B !== battle || t < lastTime - .001) restart(B);
    battle = B; lastTime = t;
    if (!effects || !camera || !B) return false;
    used = 0;
    for (const key of Object.keys(effects.mesh.userData.counts)) effects.mesh.userData.counts[key] = 0;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    forward.set(0, 0, 1).applyQuaternion(camera.quaternion);
    shots = shots.filter(s => t <= s.t1 + (SHOTS[s.k] === 'dragon' ? .1 : SHOTS[s.k] === 'fireball' ? .16 : .001));
    // Copy each shot before simulation deletes it: the simulation is one fixed step ahead of the rendered clock.
    for (const s of B.shots || []) {
      if (!handlesShot(s) || seen.has(s)) continue;
      seen.add(s);
      if (skip && skip(s)) continue;
      // The cap is far above a normal army's concurrent shots. An extreme burst replaces the oldest snapshot.
      if (shots.length >= MAX_EFFECTS * 2) shots.shift();
      shots.push({...s});
    }
    for (const u of B.tr || []) drawSword(u, t);
    for (const u of B.defenders || []) drawSword(u, t);
    for (const s of shots) drawShot(s, t);
    effects.mesh.count = used; effects.mesh.instanceMatrix.needsUpdate = true;
    effects.tiles.needsUpdate = true; effects.alphas.needsUpdate = true;
    return used > 0;
  }

  function restart(B) {
    battle = B || null; lastTime = -Infinity; shots = []; seen = new WeakSet(); used = 0;
    if (effects) {
      effects.mesh.count = 0;
      for (const key of Object.keys(effects.mesh.userData.counts)) effects.mesh.userData.counts[key] = 0;
    }
  }

  function dispose() {
    if (dead) return;
    dead = true; epoch++; loading = null; restart(null); unsubscribe();
    globalThis.removeEventListener?.('storage', storageChanged);
    if (effects) {
      scene.remove(effects.mesh); effects.geometry.dispose(); effects.material.dispose(); effects.mesh.dispose(); effects = null;
    }
    for (const atlas of sheets.values()) atlas.texture.dispose();
    sheets.clear(); onChange();
  }

  return {load, ready, sheet, frame, update, restart, handlesShot, dispose};
}
