import * as features from '../core/features.js';
import {makeJetpack, animateJetpack} from './return-jetpack.js';
import {makeRide, animateRide} from './return-rides.js';
import {riding} from '../core/return.js';
// Return Man's players in real 3D (the owner's ask, Oct 2026: smooth, at the screen's frame rate, not pictures): a
// rigged, animated cartoon football player (Evan, Nov 4 2026: Subway Surfers' style, chunky, big-headed, bright flat
// colours): models/return-runner-v1.glb, KayKit's Adventurers (Kay Lousberg, CC0, https://kaylousberg.itch.io/kaykit-adventurers:
// the Barbarian's body, the Knight's head for the returner and the Barbarian's for the linebacker) made into one by
// tools/return/runner-model.mjs; his idle, run, jump, slide, side-steps' lean and a hit's flinch from the owner's
// "Endless Runner Animations" (Mixamo's, Nov 1 2026), retargeted in by tools/return/runner-anims.mjs, in place: the
// ground moves under him; three.js itself in js/vendor/three, MIT) in each side's colours (his kit painted, a helmet,
// shoulder pads and his number on his chest and his back built on him; for the returner the ball), lit, in the 3D
// world (views/return-3dworld.js: the ground, the roadside, the lane things, built in the same scene): the whole of it
// rendered on a WebGL canvas off the page through a camera that matches the 2D scene's (views/return-world.js P), each
// frame, and laid over the sky (views/return.js), with the place's light, its haze as fog, and the sun's shadows.
// A pose (views/return.js says which: pose specs) is a move's clip, cross-faded from the one before (the idle; the
// run, at the stride the yards say; the jump, the slide, a side-step, going down: MOVES), the model's layers added
// over the run (LAYERS: a side-step's lean, a hit's flinch), and the moment's own pose laid over it bone by bone
// (aim(): each bone turned to point where the move wants it, in his own frame: +z ahead, +x his left, +y up): the ball
// tucked, the catch, a stumble's arm; turned (a cut, a spin), leaned and pitched (a fall, a dive) as a whole.
// Everything's bent with the world (return-3dworld.js bend()).
// Exports: load(), ready(), render(st, now, who), leans(), STRIDE, MOVES.
import * as W3 from './return-3dworld.js';
import * as intro from './return-intro.js';
const V = new URL('../vendor/three/', import.meta.url).href;
const MODEL = new URL('../../models/return-runner-v1.glb', import.meta.url).href;
/** Yards a full run cycle (two strides) covers: the clip's legs keep pace with the ground. (The pack's run plants
 *  0.75 a cycle on his short legs, tools/return/runner-anims.mjs says; at his 13-19 yards a second that would spin
 *  them far too fast to read, so the old player's stride and pace: his feet slide, out of sight from behind him.) */
export const STRIDE = 5;
const SCALE = 1.12; // the model's metres to yards (he stands 1.85 with his helmet on: about 2 yards)
// Each side's kit: the model's kit swatches (tools/return/runner-model.mjs: jersey, pads, belt, pants, socks, cleats,
// gloves, bands: the belt's swatches are his kilt's, so the pants' colour), the helmet's shell, its stripe and face
// mask, the number (fill, edge), and which head he has. The returner's is Evan's reviewed navy 22 (Oct 2026): navy,
// cream and an amber edge.
const KITS = {
  us: {jersey: 0x173B6C, pads: 0x1D4782, belt: 0xDCE2DC, pants: 0xDCE2DC, socks: 0x173B6C, cleats: 0x102744, gloves: 0xF0F2E8, bands: 0xF0F2E8,
    helmet: 0x173B6C, stripe: 0xF0F2E8, edge: 0xE89C43, mask: 0xC4D1D8, numFill: 0xF0F2E8, numEdge: 0x102744, num: 22, head: 'HeadReturner', ball: true, size: 1},
  them: {jersey: 0xC8102E, pads: 0xD3263F, belt: 0xF3F3F5, pants: 0xF3F3F5, socks: 0xC8102E, cleats: 0x1B1B1F, gloves: 0x6E0E10, bands: 0xF3F3F5,
    helmet: 0xF2F3F5, stripe: 0xC8102E, edge: 0x6E0E10, mask: 0x4E535C, numFill: 0xFFFFFF, numEdge: 0x6E0E10, num: 52, head: 'HeadLinebacker', ball: false, size: 1.06}
};
let T = null, GL = null, GL_UTILS = null, LOADING = null, DEAD = false;
let SELECTED_KIT = KITS.us;
const SKIN_VARIANTS = new Map();
const kitKey = k => JSON.stringify(k);
/** A selected wardrobe palette, never the linebacker's kit. Each finite catalog look is reused across profiles. */
export function setSkin(colors = null) {
  const kit = {...KITS.us};
  if (colors) for (const role of Object.keys(kit)) {
    if (role === 'size' || typeof kit[role] !== 'number') continue;
    const value = colors[role];
    if (Number.isInteger(value) && value >= 0 && value <= 0xFFFFFF) kit[role] = value;
  }
  SELECTED_KIT = kit;
  if (!GL) return;
  const key = kitKey(kit);
  if (GL.skinKey === key) return;
  let pair = SKIN_VARIANTS.get(key);
  if (!pair) {
    const us = dress(GL.gltf, GL.SK, kit), ghost = dress(GL.gltf, GL.SK, kit);
    [us, ghost].forEach(P => { arm(P, GL.clips); rideGear(P); });
    const materials = ghostMaterials(ghost);
    us.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    W3.bend(us.root); W3.bend(ghost.root);
    pair = {us, ghost, materials}; SKIN_VARIANTS.set(key, pair);
  }
  GL.scene.remove(GL.players.us.root, GL.players.ghost.root);
  GL.players.us = pair.us; GL.players.ghost = pair.ghost; GL.ghost = pair.materials;
  GL.scene.add(pair.us.root, pair.ghost.root); GL.skinKey = key;
  PREPARED = null;
}

/** Loads three.js and the model, and dresses both players (once). Resolves true when they're in; false if this phone
 *  can't (no WebGL, a load failed): the sprite players stay. */
export function load() {
  if (!LOADING) {
    LOADING = (async () => {
      try {
        const probe = document.createElement('canvas');
        if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
        const [three, {GLTFLoader}, SK, {RoomEnvironment}, BU] = await Promise.all([
          import(V + 'three.module.min.js'), import(V + 'GLTFLoader.js'), import(V + 'SkeletonUtils.js'), import(V + 'RoomEnvironment.js'), import(V + 'BufferGeometryUtils.js')]);
        T = three;
        GL_UTILS = BU;
        const gltf = await new GLTFLoader().loadAsync(MODEL);
        try { await document.fonts.load('800 100px "Barlow Condensed"'); } catch (_) {}
        GL = build(gltf, SK, RoomEnvironment);
        setSkin(SELECTED_KIT);
        return true;
      } catch (e) {
        console.warn('Return Man: no 3D players', e);
        DEAD = true;
        return false;
      }
    })();
  }
  return LOADING;
}
export const ready = () => !!GL && !DEAD;
/** Whether the 3D's settled either way (in, or this phone can't): till then the stage waits for it (views/return.js). */
export const settled = () => !!GL || DEAD;
/** The canvas render() draws on (one for the session), for the stage to show as a layer of its own. */
export const canvas = () => (GL ? GL.canvas : null);
let PREPARED = null;
function flightGear(P) {
  if (!P.jetpack) { P.jetpack = W3.bend(makeJetpack(T)); P.jetpack.scale.setScalar(.7); P.root.add(P.jetpack); }
  return P.jetpack;
}
function rideGear(P) {
  if (!P.rides) P.rides = Object.fromEntries(['scooter', 'hoverboard'].map(kind => {
    const ride = makeRide(T, kind); ride.visible = false; P.root.add(ride); return [kind, ride];
  }));
  return P.rides;
}
/** Compile shaders and upload both players, flight gear and pickups before Play. */
export function prepare(st) {
  if (!GL || !features.returnManUpdated()) return Promise.resolve();
  if (PREPARED) return PREPARED;
  PREPARED = (async () => {
    await new Promise(requestAnimationFrame);
    const {renderer, scene, players} = GL, warm = W3.warmObjects(), target = new T.WebGLRenderTarget(64, 64);
    const visibility = Object.values(players).map(P => [P, P.root.visible, P.root.position.clone()]);
    const gear = flightGear(players.us), wasGear = gear.visible;
    const rides = [players.us, players.ghost].flatMap(P => Object.values(rideGear(P))).map(o => [o, o.visible]);
    rides.forEach(([o]) => { o.visible = true; });
    GL.punt.visible = true; GL.punt.position.set(0, 2, -(st.camZ + 8));
    warm.position.z = -st.camZ;
    scene.add(warm); visibility.forEach(([P], i) => { P.root.visible = true; P.root.position.set((i - 1) * 1.4, 0, -(st.camZ + 8)); }); gear.visible = true;
    try {
      camera(st);
      if (renderer.compileAsync) await renderer.compileAsync(scene, GL.camera); else renderer.compile(scene, GL.camera);
      renderer.setRenderTarget(target); renderer.render(scene, GL.camera);
    } finally {
      renderer.setRenderTarget(null); target.dispose(); scene.remove(warm); W3.releaseWarmObjects(warm);
      visibility.forEach(([P, visible, position]) => { P.root.visible = visible; P.root.position.copy(position); }); gear.visible = wasGear;
      GL.punt.visible = false;
      rides.forEach(([o, visible]) => { o.visible = visible; });
    }
  })().catch(e => { PREPARED = null; console.warn('Return Man preparation:', e); });
  return PREPARED;
}

/** The ghost's materials: his own, see-through (views/return.js sets how much). */
function ghostMaterials(P) {
  const materials = [];
  P.root.traverse(o => {
    if (!o.isMesh) return;
    const single = !Array.isArray(o.material);
    const list = (single ? [o.material] : o.material).map(m => {
      const c = m.clone(); c.transparent = true; c.opacity = .3; c.depthWrite = false;
      materials.push(c); return c;
    });
    o.material = single ? list[0] : list;
  });
  return materials;
}

// ---------------------------------------------------------------------------- Dressing him
// He comes from tools/return/runner-model.mjs: one body and two heads (HeadReturner, HeadLinebacker: the kit's head is
// the one he keeps), his colours a small atlas of vertical gradient swatches, the kit's named in the material's extras
// (userData.kit: each its swatch). A side's kit is those swatches painted in its colours (light at the top, darker at
// the foot, as KayKit's are), and built on him here, to his own measure (his head's box, his chest's width and depth,
// taken from the model at rest): the helmet (a shell open at the face, a stripe over the crown edged both sides, a
// stud each side, the face mask's bars), rounded shoulder pads on his chest (his arms swing under them), his number on
// his chest and his back (curved round him); for the returner the ball.
const bare = name => name.replace(/^mixamorig:?/, '');
const hex = c => '#' + c.toString(16).padStart(6, '0');
/** A swatch's colour f of the way down it: KayKit's light-to-dark gradient. */
const shadeOf = (col, f) => { const k = f < .5 ? 1.12 - f * .24 : 1 - (f - .5) * .7; return `rgb(${[col >> 16 & 255, col >> 8 & 255, col & 255].map(x => Math.round(Math.min(255, x * k))).join(',')})`; };
/** The model's materials in kit k (its kit swatches painted), once a kit. */
const KIT_MATS = new Map();
function kitMaterials(gltf, k) {
  if (KIT_MATS.has(k)) return KIT_MATS.get(k);
  const out = new Map();
  gltf.scene.traverse(o => {
    if (!o.isMesh || out.has(o.material)) return;
    const m = o.material, kit = m.userData && m.userData.kit;
    if (!kit || !m.map || !m.map.image) { out.set(m, m); return; }
    const img = m.map.image, cv = document.createElement('canvas'), n = m.userData.slots || 16;
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const w = cv.width / n, grad = col => { const gr = g.createLinearGradient(0, 0, 0, cv.height); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, shadeOf(col, i / 8)); return gr; };
    Object.entries(kit).forEach(([role, slot]) => { if (k[role] != null) { g.fillStyle = grad(k[role]); g.fillRect(slot * w, 0, w, cv.height); } });
    const t = new T.CanvasTexture(cv);
    // (no mipmaps: a swatch is a few pixels wide, and its neighbours mustn't bleed in)
    Object.assign(t, {flipY: m.map.flipY, colorSpace: m.map.colorSpace, channel: m.map.channel, wrapS: T.ClampToEdgeWrapping, wrapT: T.ClampToEdgeWrapping,
      magFilter: T.LinearFilter, minFilter: T.LinearFilter, generateMipmaps: false});
    out.set(m, Object.assign(m.clone(), {map: t}));
  });
  KIT_MATS.set(k, out);
  return out;
}
/** Hangs a piece of kit on a bone where it sits on him standing (world: its place, metres, at his rest). */
function hang(bone, obj, at, rot = null) {
  bone.updateWorldMatrix(true, false);
  const m = new T.Matrix4().compose(at, rot || new T.Quaternion(), obj.scale.clone());
  m.premultiply(bone.matrixWorld.clone().invert());
  m.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
}
const plastic = (color, o = {}) => new T.MeshStandardMaterial({color, roughness: .38, metalness: .05, ...o});
/** A tube through points (each [x, y, z]). */
const tube = (pts, r, mat, closed = false) => new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p)), closed, 'centripetal'), pts.length * 6, r, 6, closed), mat);
/** The helmet for his head (the mesh, at rest; its bone B.Head at his neck): its measure from the head's top down to
 *  the neck and across its upper half (a beard or a chin left out); the shell a dome down to an edge that's high at the
 *  face (over the brow) and low at the sides and back (over the ears), rimmed. */
function helmet(head, B, k) {
  const pp = head.geometry.attributes.position, v = new T.Vector3(), neck = B.Head.getWorldPosition(new T.Vector3()).y;
  let top = -Infinity;
  for (let i = 0; i < pp.count; i++) top = Math.max(top, v.fromBufferAttribute(pp, i).applyMatrix4(head.matrixWorld).y);
  const h = top - neck, box = new T.Box3();
  for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i).applyMatrix4(head.matrixWorld); if (v.y > neck + h * .45) box.expandByPoint(v); }
  const c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3());
  c.y = neck + h * .56;
  const r = new T.Vector3(s.x * .64, h * .53, s.z * .64), g = new T.Group();
  // (phi round him from ahead, theta down from the crown)
  const at = (phi, th, out = 1) => [Math.sin(th) * Math.sin(phi) * r.x * out, Math.cos(th) * r.y * out, Math.sin(th) * Math.cos(phi) * r.z * out];
  const edge = phi => 2.25 - Math.pow(Math.max(0, Math.cos(phi)), 2.5);
  const rows = 18, cols = 48, pos = [], nor = [], idx = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const phi = j / cols * Math.PI * 2, p = at(phi, i / rows * edge(phi));
    pos.push(...p);
    const n = new T.Vector3(p[0] / (r.x * r.x), p[1] / (r.y * r.y), p[2] / (r.z * r.z)).normalize(); nor.push(n.x, n.y, n.z);
    if (i < rows && j < cols) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const shell = new T.BufferGeometry();
  shell.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); shell.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); shell.setIndex(idx);
  const shellMat = plastic(k.helmet, {side: T.DoubleSide, roughness: .3});
  g.add(new T.Mesh(shell, shellMat));
  g.add(tube(Array.from({length: 48}, (_, j) => { const phi = j / 48 * Math.PI * 2; return at(phi, edge(phi)); }), r.x * .035, shellMat, true));
  // the stripe over the crown, front to back, edged each side
  const arc = x => Array.from({length: 13}, (_, i) => { const a = 1.12 - 3.1 * i / 12, q = Math.sqrt(1 - x * x); return [x * r.x * 1.015, Math.cos(a) * q * r.y * 1.015, Math.sin(a) * q * r.z * 1.015]; });
  g.add(tube(arc(0), r.x * .06, plastic(k.stripe)));
  [-1, 1].forEach(sd => g.add(tube(arc(sd * .13), r.x * .022, plastic(k.edge))));
  // the face mask: two bars round the mouth and the chin from side to side, one up the middle, a stud each end
  const mask = plastic(k.mask, {metalness: .45, roughness: .3}), bar = r.x * .05;
  const across = y => { const q = Math.sqrt(1 - y * y), th = Math.acos(y); return Array.from({length: 11}, (_, i) => { const phi = (-1.3 + 2.6 * i / 10); return at(phi, th, 1.13 / Math.max(.6, q) * q + (1 - q) * .3); }); };
  [-.5, -.82].forEach(y => g.add(tube(across(y), bar, mask)));
  g.add(tube([at(0, Math.acos(-.3), 1.08), at(0, Math.acos(-.5), 1.13), at(0, Math.acos(-.82), 1.13)], bar, mask));
  [-1, 1].forEach(sd => { const d = new T.Mesh(new T.SphereGeometry(r.x * .11, 12, 8), plastic(k.stripe)); d.position.set(...at(sd * 1.3, Math.acos(-.5), 1.02)); d.scale.set(1, 1, .6); g.add(d); });
  return {group: g, at: c};
}
/** His number on a curved patch (width w, height h, curved round a radius of rad), facing +z. */
function number(k, w, h, rad) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w);
  const g = cv.getContext('2d'), s = String(k.num);
  g.font = `800 ${Math.round(cv.height * .98)}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.lineJoin = 'round';
  const m = g.measureText(s), y = cv.height / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  g.lineWidth = cv.height * .12; g.strokeStyle = hex(k.numEdge); g.strokeText(s, cv.width / 2, y);
  g.fillStyle = hex(k.numFill); g.fillText(s, cv.width / 2, y);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  const geo = new T.PlaneGeometry(w, h, 10, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -(rad - Math.sqrt(Math.max(0, rad * rad - x * x)))); }
  geo.computeVertexNormals();
  return new T.Mesh(geo, new T.MeshStandardMaterial({map: t, alphaTest: .5, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2}));
}
/** One player: the model cloned and dressed in kit k. */
function dress(gltf, SK, k) {
  const model = SK.clone(gltf.scene), mats = kitMaterials(gltf, k);
  model.updateMatrixWorld(true);
  const B = {}, gone = [];
  let head = null, body = null;
  model.traverse(o => {
    if (o.isBone) B[bare(o.name)] = o;
    if (!o.isMesh) return;
    o.material = mats.get(o.material) || o.material; o.frustumCulled = false;
    if (/^Head/.test(o.name)) { if (o.name === k.head) head = o; else gone.push(o); }
    if (o.name === 'Body') body = o;
  });
  gone.forEach(o => o.removeFromParent());
  const at = n => B[n].getWorldPosition(new T.Vector3());
  // the helmet, on his head
  const hm = helmet(head, B, k);
  hang(B.Head, hm.group, hm.at);
  // his chest's measure, at rest: across at the shoulders, and its front and back at the chest bone's height
  const chestY = at('Spine2').y, sh = at('LeftArm'), pp = body.geometry.attributes.position, v = new T.Vector3();
  let front = -Infinity, back = Infinity, wide = 0;
  for (let i = 0; i < pp.count; i++) {
    v.fromBufferAttribute(pp, i).applyMatrix4(body.matrixWorld);
    if (Math.abs(v.y - chestY) < .05 && Math.abs(v.x) < .06) { front = Math.max(front, v.z); back = Math.min(back, v.z); }
    if (Math.abs(v.y - sh.y) < .06) wide = Math.max(wide, Math.abs(v.x));
  }
  // the shoulder pads: rounded, over each shoulder, a stripe round each
  const padMat = plastic(k.jersey, {roughness: .55}), stripeMat = plastic(k.stripe, {roughness: .6});
  [-1, 1].forEach(sd => {
    const pad = new T.Group(), dome = new T.Mesh(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * .6), padMat);
    dome.scale.set(wide * .5, wide * .34, (front - back) * .5); pad.add(dome);
    const ring = new T.Mesh(new T.TorusGeometry(1, .06, 6, 24, Math.PI), stripeMat);
    ring.scale.set(wide * .38, wide * .3, 1); ring.rotation.y = Math.PI / 2; ring.position.y = wide * .02; pad.add(ring);
    pad.rotation.z = -sd * .32;
    hang(B.Spine2, pad, new T.Vector3(sd * wide * .62, sh.y + wide * .02, (front + back) / 2), pad.quaternion.clone());
  });
  // his number, chest and back
  const nw = wide * .9, nh = (sh.y - chestY) * 1.1 + .06, rad = wide * .95;
  const fn = number(k, nw, nh, rad), bn = number(k, nw * 1.1, nh * 1.15, rad);
  hang(B.Spine2, fn, new T.Vector3(0, chestY + nh * .1, front + .004));
  bn.rotation.y = Math.PI;
  hang(B.Spine2, bn, new T.Vector3(0, chestY + nh * .25, back - .004), bn.quaternion.clone());
  // the ball, tucked along his right forearm, its nose in his hand
  let ball = null;
  if (k.ball) {
    ball = new T.Group();
    const leather = new T.MeshStandardMaterial({color: 0x7A3B1B, roughness: .55, envMapIntensity: .6});
    const white = new T.MeshStandardMaterial({color: 0xF4F0E6, roughness: .6});
    const egg = new T.Mesh(new T.SphereGeometry(1, 24, 16), leather);
    egg.scale.set(.14, .085, .085);
    ball.add(egg);
    const lace = new T.Mesh(new T.BoxGeometry(.11, .012, .02), white); lace.position.set(0, 0, .085); ball.add(lace);
    [-1, 1].forEach(s => { const ring = new T.Mesh(new T.TorusGeometry(.07, .008, 6, 20), white); ring.rotation.y = Math.PI / 2; ring.position.x = s * .085; ball.add(ring); });
    ball.scale.setScalar(BALL);
    // (in his right glove, its nose out past his fingers: his forearm's too short to tuck it along, and from behind
    // him it shows at his side)
    const hand = at('RightHand'), fore = at('RightForeArm'), along = hand.clone().sub(fore).normalize();
    hang(B.RightHand, ball, hand.clone().addScaledVector(along, .1), new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), along));
  }
  const root = new T.Group(), wrap = new T.Group();
  root.rotation.order = 'YXZ';
  wrap.rotation.y = Math.PI; wrap.scale.setScalar(SCALE * k.size);
  wrap.add(model); root.add(wrap);
  const mixer = new T.AnimationMixer(model);
  const clip = name => gltf.animations.find(a => a.name === name);
  const run = mixer.clipAction(clip('run')), idle = mixer.clipAction(clip('idle'));
  [run, idle].forEach(a => { a.play(); a.setEffectiveWeight(0); });
  // the model's layers (a +: each what it does over the run, added onto whatever he's doing)
  const layer = {};
  gltf.animations.filter(c => c.name.endsWith('+')).forEach(c => {
    const a = mixer.clipAction(c, undefined, T.AdditiveAnimationBlendMode);
    a.play(); a.setEffectiveWeight(0);
    layer[c.name] = {a, w: 0, u: 0};
  });
  // where a jetpack goes (return-jetpack.js, made in yards, facing as his root does): on his back, moving with it
  const pack = new T.Group();
  pack.scale.setScalar(1 / (SCALE * k.size));
  hang(B.Spine2, pack, new T.Vector3(0, chestY + (sh.y - chestY) * .15, back), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI));
  return {root, wrap, model, B, mixer, run, idle, ball, hipsY: B.Hips.position.y, q: new T.Quaternion(),
    act: {run, idle}, w: {run: 0, idle: 1}, u: {}, slot: {}, layer, last: 0, pack,
    flightRest: Object.values(B).map(b => ({b, q: b.quaternion.clone(), p: b.position.clone()}))};
}
const BALL = 1.25; // (the ball a little big for his size: his hands are)
/** Gives a player the moves' clips (two takes of each: a move started again while the last is still fading out takes
 *  the other, so neither jumps). */
function arm(P, clips) {
  clips.forEach(c => [c.name, c.name + '~'].forEach(k => {
    const a = P.mixer.clipAction(k === c.name ? c : Object.assign(c.clone(), {name: k}));
    a.play(); a.setEffectiveWeight(0);
    P.act[k] = a; P.w[k] = 0;
  }));
}
function build(gltf, SK, RoomEnvironment) {
  const canvas = document.createElement('canvas');
  const renderer = new T.WebGLRenderer({canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance'});
  canvas.addEventListener('webglcontextlost', () => { DEAD = true; }); // (the phone took the GPU back: the pictures again)
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;
  pmrem.dispose();
  // the light (each place's: return-3dworld.js look): the sky's, the sun (casting the shadows round him), a cool rim
  // from up ahead; the haze as fog
  const hemi = new T.HemisphereLight(0xE4ECFF, 0x34452C, 1.15); scene.add(hemi);
  const sun = new T.DirectionalLight(0xFFF1DC, 2.3); sun.position.set(-3, 6, 4); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  Object.assign(sun.shadow.camera, {left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80});
  const rim = new T.DirectionalLight(0xA9C8FF, 1.1); rim.position.set(3, 4, -6); scene.add(rim);
  scene.fog = new T.Fog(0x8899AA, 70, 150);
  W3.init(T, scene, GL_UTILS);
  // the returner, the linebacker, and the returner seen double (booze): see-through
  const players = {us: dress(gltf, SK, KITS.us), them: dress(gltf, SK, KITS.them), ghost: dress(gltf, SK, KITS.us)};
  [players.us, players.ghost].forEach(rideGear);
  const clips = bake(players.us, gltf);
  Object.values(players).forEach(P => arm(P, clips));
  const ghost = ghostMaterials(players.ghost);
  SKIN_VARIANTS.set(kitKey(KITS.us), {us: players.us, ghost: players.ghost, materials: ghost});
  [players.us, players.them].forEach(P => P.root.traverse(o => { if (o.isMesh) o.castShadow = true; }));
  scene.add(W3.bend(players.us.root), W3.bend(players.them.root), W3.bend(players.ghost.root));
  // Reuse the existing football geometry/materials. The opening ball follows both gloves,
  // then disappears before the run so both arms keep their free running stride.
  const punt = players.us.ball.clone(); punt.visible = false; punt.rotation.set(0, 0, 0); scene.add(punt);
  const camera = new T.PerspectiveCamera();
  camera.matrixAutoUpdate = true;
  return {renderer, canvas, scene, camera, players, ghost, punt, gltf, SK, clips, hemi, sun, rim, skinKey: kitKey(KITS.us), w: 0, h: 0};
}

// ---------------------------------------------------------------------------- Posing him
const _a = () => new T.Vector3();
let TMP = null;
const tmp = () => TMP || (TMP = {a: _a(), b: _a(), d: _a(), q: new T.Quaternion(), qw: new T.Quaternion(), qp: new T.Quaternion(), id: new T.Quaternion()});
/** Turns bone `name` so it points at its child `to` along dir (his own frame: +z ahead, +x his left, +y up), w of the
 *  way from where the clip has it. */
function aim(P, name, to, dir, w = 1) {
  if (!(w > 0)) return;
  const bone = P.B[name], child = P.B[to], t = tmp();
  bone.getWorldPosition(t.a); child.getWorldPosition(t.b);
  t.b.sub(t.a).normalize();
  t.d.set(dir[0], dir[1], dir[2]).normalize().applyQuaternion(P.q);
  t.q.setFromUnitVectors(t.b, t.d);
  if (w < 1) t.q.copy(t.id).slerp(t.q, w);
  bone.getWorldQuaternion(t.qw).premultiply(t.q);
  bone.parent.getWorldQuaternion(t.qp).invert();
  bone.quaternion.copy(t.qp.multiply(t.qw));
  bone.updateMatrixWorld(true);
}
const mix = (a, b, u) => a + (b - a) * u;
const mix3 = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u)];
const leg = (P, n, up, low, w = 1) => { aim(P, n + 'UpLeg', n + 'Leg', up, w); aim(P, n + 'Leg', n + 'Foot', low, w); };
const limb = (P, n, up, low, w = 1) => { aim(P, n + 'Arm', n + 'ForeArm', up, w); aim(P, n + 'ForeArm', n + 'Hand', low, w); };
const trunk = (P, d, w = 1) => { aim(P, 'Spine', 'Spine1', d, w); aim(P, 'Spine1', 'Spine2', d, w); aim(P, 'Spine2', 'Neck', [d[0], d[1] + .2, d[2] * .6], w); };

// ---------------------------------------------------------------------------- The moves, as clips
// Each move a clip the mixer cross-fades into (the owner's ask, Oct 2026: Subway Surfers' way), FADE seconds into
// each, its time where the move's got to (pose's u, 0 to 1: the jump by how fast he's rising or falling, a slide and a
// side-step by the clock, going down by how far): jump; slide; sideL, sideR (a side-step to his left, the screen's
// left, and his right); fall (going down; the linebacker's dive); fallin (into a pothole, the only thing he falls into:
// views/return.js sinks him into it and says how far through it he is). A clip of that name in the model (a Mixamo one, say:
// tools/return/player-model.mjs keeps it) is used as it is; till then each is keyed here from poses (bake(): the run's
// stride with the bones aimed).
export const MOVES = ['jump', 'slide', 'sideL', 'sideR', 'fall', 'fallin'];
const FADE = {idle: .3, run: .14, jump: .08, slide: .09, sideL: .06, sideR: .06, fall: .12, fallin: .06};
const airLegs = (P, k) => {
  leg(P, 'Left', mix3([.05, -1, .1], [.1, -.28, .95], k), mix3([0, -1, -.1], [0, -.72, .7], k));
  leg(P, 'Right', mix3([-.05, -1, -.1], [-.42, -.5, .5], k), mix3([0, -1, -.2], [.2, -.35, -.9], k));
};
const reach = (P, w) => limb(P, 'Left', [.4, .5, .75], [.18, .82, .55], w); // (his free arm up in a leap)
const low = (P, up = 0) => {
  trunk(P, [0, .72 + up, -.7 + up * 1.2]);
  leg(P, 'Left', [.1, -.08, 1], [.06, -.12, 1]); leg(P, 'Right', [-.5, -.15, .85], [.55, -.2, -.8]);
  limb(P, 'Left', [.55, -.72, -.42], [.15, -1, -.15]);
};
const down = P => {
  [['Left', 1], ['Right', -1]].forEach(([n, x]) => leg(P, n, [x * .1, -.95, -.3], [x * .05, -.9, -.42]));
  limb(P, 'Left', [.25, .95, .3], [.1, .95, .38]); limb(P, 'Right', [-.25, .95, .3], [-.1, .95, .38]);
};
// A side-step x's way (-1: his right, 1: his left): off the trailing foot, the leading one reaching out, gathered in the
// air, down on the leading foot with the other crossing over; the trunk leaning into it, his free arm out for balance
// (or leading, going his left).
const SIDE = [
  (P, x) => { leg(P, x < 0 ? 'Left' : 'Right', [-x * .3, -.93, -.15], [-x * .15, -1, -.25]); leg(P, x < 0 ? 'Right' : 'Left', [x * .35, -.9, .2], [x * .15, -1, 0]); trunk(P, [x * .22, 1, .12]); },
  (P, x) => { leg(P, x < 0 ? 'Left' : 'Right', [-x * .05, -.85, .4], [0, -1, -.4]); leg(P, x < 0 ? 'Right' : 'Left', [x * .15, -.95, .15], [x * .05, -1, -.1]); trunk(P, [x * .3, 1, .14]); },
  (P, x) => { leg(P, x < 0 ? 'Left' : 'Right', [x * .08, -.97, .15], [0, -1, -.15]); leg(P, x < 0 ? 'Right' : 'Left', [x * .04, -1, 0], [0, -1, -.05]); trunk(P, [x * .08, 1, .12]); }
];
const sideArm = (P, x, w) => (x < 0 ? limb(P, 'Left', [.85, -.35, .15], [.7, -.1, .45], w) : limb(P, 'Left', [.7, -.5, .35], [.4, -.3, .75], w));
const sideKeys = x => [
  {u: 0, at: P => { SIDE[0](P, x); sideArm(P, x, .8); }},
  {u: .45, at: P => { SIDE[1](P, x); sideArm(P, x, 1); }},
  {u: 1, at: P => { SIDE[2](P, x); sideArm(P, x, .4); }}
];
// Each move's keys: {u, at (the bones aimed), hips (his hips' height, of standing)}.
const KEYS = {
  jump: [
    {u: 0, at: P => { airLegs(P, .25); reach(P, .9); }},
    {u: .4, at: P => { airLegs(P, 1); reach(P, .9); }},
    {u: .7, at: P => { airLegs(P, .75); reach(P, .85); }},
    {u: 1, at: P => { leg(P, 'Left', [.06, -.96, .28], [0, -1, .05]); leg(P, 'Right', [-.05, -.98, .05], [0, -1, -.12]); reach(P, .5); }} // (reaching for the ground)
  ],
  slide: [
    {u: 0, at: P => low(P, .06), hips: .4},
    {u: .15, at: P => low(P), hips: .27},
    {u: .8, at: P => low(P, .04), hips: .29},
    {u: 1, at: P => low(P, .1), hips: .34}
  ],
  sideL: sideKeys(1),
  sideR: sideKeys(-1),
  fall: [{u: 0, at: () => {}}, {u: .4, at: down}, {u: 1, at: down}],
  // into a pothole (the ball kept tucked in his right: the carry, eased off by the view so that forearm comes out onto
  // the rim too): dropping in, legs straight, his free arm flung up; caught in it, bent over its far rim, both forearms
  // flat on it ahead at his shoulders' width; a knee up onto the rim, pushing up off it; out, stepping on
  fallin: [
    {u: 0, at: P => { trunk(P, [0, 1, -.08]); leg(P, 'Left', [.12, -1, .05], [.05, -1, .1]); leg(P, 'Right', [-.12, -1, .05], [-.05, -1, .1]); limb(P, 'Left', [.75, .55, .15], [.55, .8, .2]); }},
    {u: .27, at: P => { trunk(P, [0, .75, .66]); leg(P, 'Left', [.08, -1, -.1], [0, -1, -.2]); leg(P, 'Right', [-.08, -1, -.1], [0, -1, -.2]); limb(P, 'Left', [.55, -.2, .82], [.12, -.3, .95]); limb(P, 'Right', [-.55, -.2, .82], [-.12, -.3, .95]); }},
    {u: .55, at: P => { trunk(P, [0, .72, .7]); leg(P, 'Left', [.08, -1, -.12], [0, -1, -.22]); leg(P, 'Right', [-.08, -1, -.1], [0, -1, -.2]); limb(P, 'Left', [.58, -.28, .78], [.14, -.38, .92]); limb(P, 'Right', [-.58, -.28, .78], [-.14, -.38, .92]); }},
    {u: .78, at: P => { trunk(P, [0, .8, .6]); leg(P, 'Right', [-.1, -.05, 1], [-.05, -1, .12]); leg(P, 'Left', [.08, -.95, -.3], [0, -.9, -.45]); limb(P, 'Left', [.3, -.55, .75], [.15, -.95, .3]); limb(P, 'Right', [-.3, -.55, .75], [-.15, -.95, .3]); }},
    {u: 1, at: P => { trunk(P, [0, .9, .4]); leg(P, 'Left', [.1, -.35, .93], [.02, -1, .05]); leg(P, 'Right', [-.06, -.92, -.38], [0, -.75, -.66]); limb(P, 'Left', [.45, -.75, .3], [.25, -.3, .9]); }}
  ]
};
/** The moves' clips: the model's own, or each keyed from KEYS on P (standing straight, mid-stride: the run's clip a
 *  tenth of the way round). */
function bake(P, gltf) {
  const bones = Object.values(P.B), hips = P.B.Hips, rc = P.run.getClip();
  // the stride, straight from the run's tracks (the mixer skips a bone whose value it set last time, so it can't be
  // asked twice), kept to start each key from
  rc.tracks.forEach(tr => { const [n, prop] = tr.name.split('.'), b = bones.find(x => x.name === n); if (b) b[prop].fromArray(tr.createInterpolant().evaluate(.1 * rc.duration)); });
  const base = bones.map(b => [b.quaternion.clone(), b.position.clone()]);
  P.root.rotation.set(0, 0, 0); P.root.updateMatrixWorld(true);
  P.wrap.getWorldQuaternion(P.q);
  return MOVES.map(name => {
    const own = gltf.animations.find(a => a.name === name);
    if (own) return own;
    const keys = KEYS[name], times = keys.map(k => k.u), q = bones.map(() => []), hp = [];
    keys.forEach(k => {
      bones.forEach((b, i) => { b.quaternion.copy(base[i][0]); b.position.copy(base[i][1]); });
      if (k.hips) hips.position.y = P.hipsY * k.hips;
      P.model.updateMatrixWorld(true);
      k.at(P);
      bones.forEach((b, i) => q[i].push(...b.quaternion.toArray()));
      hp.push(...hips.position.toArray());
    });
    const tracks = bones.map((b, i) => new T.QuaternionKeyframeTrack(b.name + '.quaternion', times, q[i]));
    tracks.push(new T.VectorKeyframeTrack(hips.name + '.position', times, hp));
    return new T.AnimationClip(name, 1, tracks);
  });
}
// The model's layers over his run (tools/return/runner-anims.mjs), each by how far into it he is: a side-step's lean
// (in place of the keyed side-step, when the model has it: his legs keep the run's stride under it) and a hit's flinch
// (on his feet, running), each eased off over LAYER_OUT seconds when it's cut short.
// The pack's leans are deep, so they're laid on at LEAN of their full (the owner's ask, Oct 2026: less lean on lane
// changes); and with them the view doesn't roll him into the cut as well (leans()).
const LAYERS = {sideL: 'sideL+', sideR: 'sideR+'}, LAYER_IN = .05, LAYER_OUT = .1, LEAN = .7;
/** Whether his side-steps lean of themselves (the model has their layers). */
export const leans = () => !!GL && GL.gltf.animations.some(c => c.name === LAYERS.sideL);
/** Sets his pose: s = {move ('idle', 'run', or one of MOVES), u (0-1: how far into the move), phase (0-1 round the
 *  run's cycle), t (seconds), carry, catch, stumble, hit (each 0-1: how far into it), turn, roll, pitch (radians), lift
 *  (yards), ball (whether the ball's in his arm)}; dt: seconds since the last. */
function pose(P, s, dt) {
  // a side-step the model leans: the run, with its layer
  const lean = P.layer[LAYERS[s.move]];
  const want = lean ? 'run' : s.move || 'run';
  const lay = {};
  if (lean) lay[LAYERS[s.move]] = s.u || 0;
  if (s.hit > 0 && s.hit < 1 && want === 'run' && P.layer['hit+']) lay['hit+'] = s.hit;
  for (const k in P.layer) {
    const L = P.layer[k];
    if (k in lay) { L.u = lay[k]; L.w = Math.min(1, L.w + dt / LAYER_IN); } else L.w = Math.max(0, L.w - dt / LAYER_OUT);
    L.a.setEffectiveWeight(L.w * (k === 'hit+' ? 1 : LEAN));
    L.a.time = Math.max(0, Math.min(1, L.u)) * L.a.getClip().duration;
  }
  // the move's take: the one it's on, or the other if it's started again while this one still shows
  let on = want;
  if (P.act[want + '~']) {
    const u = Math.max(0, Math.min(1, s.u || 0));
    on = P.slot[want] || want;
    if (u < (P.u[on] ?? 0) - .2 && P.w[on] > .02) { on = on === want ? want + '~' : want; P.slot[want] = on; }
    P.u[on] = u;
  }
  // the cross-fade: the move coming in at its pace, the rest going out as fast; shared out to add up to one
  const step = dt / FADE[want];
  let sum = 0;
  for (const k in P.w) { P.w[k] = k === on ? Math.min(1, P.w[k] + step) : Math.max(0, P.w[k] - step); sum += P.w[k]; }
  for (const k in P.act) {
    const a = P.act[k], d = a.getClip().duration;
    a.setEffectiveWeight(sum > 0 ? P.w[k] / sum : k === on ? 1 : 0);
    a.time = k === 'run' ? ((s.phase || 0) % 1 + 1) % 1 * d : k === 'idle' ? (s.t || 0) % d : (P.u[k] ?? 0) * d;
  }
  P.mixer.update(0);
  // Flight has its own neutral torso. Imported running clips carry a twist and lean that would turn the pack under him.
  if (s.jetpack || (s.ride && s.move !== 'slide')) P.flightRest.forEach(({b, q, p}) => { b.quaternion.copy(q); b.position.copy(p); });
  // the whole of him: turned, leaned, pitched forward about his feet
  P.root.rotation.order = s.jetpack ? 'ZXY' : 'YXZ';
  P.root.rotation.set(-(s.pitch || 0), -(s.turn || 0), -(s.roll || 0));
  // Roll around the torso in flight, not around the feet. Restore the standing pivot on landing.
  P.wrap.position.y = s.jetpack ? -.85 * (s.flight || 0) : s.ride ? .35 : 0;
  if (s.jetpack) P.root.position.y += .85 * (s.flight || 0);
  P.root.updateMatrixWorld(true);
  P.wrap.getWorldQuaternion(P.q);
  P.model.updateMatrixWorld(true);
  const t = s.t || 0;
  if (s.jetpack && features.returnManUpdated()) {
    flightGear(P);
    // Streamlined, belly down, arms reaching ahead and legs trailing behind the pack.
    trunk(P, [0, 1, 0]); aim(P, 'Neck', 'Head', [0, 1, 0]);
    leg(P, 'Left', [.12, -1, .05], [.03, -1, -.06]);
    leg(P, 'Right', [-.12, -1, .05], [-.03, -1, -.06]);
    limb(P, 'Left', [.34, .9, .18], [.08, .95, .2]);
    limb(P, 'Right', [-.34, .9, .18], [-.08, .95, .2]);
    // Anchor in the flight frame: the cartoon mesh's baked chest bounds don't match its animated bone frame.
    P.B.Spine2.getWorldPosition(tmp().a); P.root.worldToLocal(tmp().a);
    P.jetpack.position.copy(tmp().a); P.jetpack.position.z += .28;
    animateJetpack(P.jetpack, t);
  }
  if (P.jetpack) P.jetpack.visible = !!s.jetpack && features.returnManUpdated();
  if (P.rides) for (const [kind, ride] of Object.entries(P.rides)) {
    ride.visible = !!s.ride && s.ride.kind === kind && !s.jetpack;
    if (ride.visible) animateRide(ride, s.ride, s.move === 'slide', s.reduced);
  }
  if (s.ride && s.move !== 'slide') {
    const scooter = s.ride.kind === 'scooter', crouch = s.move === 'jump' ? .36 : .16;
    trunk(P, [0, 1, .12]);
    leg(P, 'Left', [.12, -1, crouch], [.04, -1, -crouch]);
    leg(P, 'Right', [-.12, -1, -.08], [-.03, -1, .08]);
    if (scooter) {
      limb(P, 'Left', [.24, -.7, .7], [-.08, -.25, 1]);
      limb(P, 'Right', [-.24, -.7, .7], [.08, -.25, 1]);
    } else {
      limb(P, 'Left', [.65, -.6, .2], [.5, -.5, .2]);
      limb(P, 'Right', [-.65, -.6, -.15], [-.5, -.5, .15]);
    }
  }
  // a stumble: the trunk forward (not down in a slide), his free arm flailing
  if (s.stumble > 0) {
    if (want !== 'slide') trunk(P, [0, .78, .62], s.stumble * .8);
    const w = Math.sin(t * 14);
    limb(P, 'Left', [.92, .25 + .35 * w, .22], [.62, .72 + .2 * w, .25], s.stumble);
  }
  // the catch: both hands up; the ball tucked in his right
  if (s.catch > 0) {
    if (s.punt) {
      // The cartoon helmet is large: reach ahead of it so the gloves and caught ball stay visible.
      limb(P, 'Left', [.12, -.35, 1], [-.55, -.2, 1], s.catch);
      limb(P, 'Right', [-.12, -.35, 1], [.55, -.2, 1], s.catch);
      aim(P, 'Neck', 'Head', [0, 1, -.2], s.catch * .5);
    } else { limb(P, 'Left', [.3, .85, .42], [.06, .9, .45], s.catch); limb(P, 'Right', [-.3, .85, .42], [-.06, .9, .45], s.catch); }
  }
  // the carry: the ball out at his right side, his forearm ahead (a short arm can't tuck it across him), swinging a little
  if (s.carry > 0) { const sw = .12 * Math.sin((s.phase || 0) * Math.PI * 2); limb(P, 'Right', [-.38, -.88, -.12 + sw], [-.28, -.12 + sw * .5, .95], s.carry); }
  if (P.ball) P.ball.visible = !!s.ball;
}

// ---------------------------------------------------------------------------- Drawing it all
/** The camera, matched to the scene's (views/return-world.js P: a pinhole at (camX, camH, camZ) looking ahead, f px
 *  to the screen, its middle at (W / 2, y0)); and the canvas, the stage's size (at most twice its CSS pixels). */
function camera(st, now = performance.now()) {
  const k = Math.min(2, st.dpr || 1), cw = Math.round(st.W * k), ch = Math.round(st.H * k);
  if (GL.w !== cw || GL.h !== ch) { GL.renderer.setSize(cw, ch, false); GL.w = cw; GL.h = ch; }
  const cam = GL.camera, n = .1, f = 400;
  cam.position.set(st.camX, st.camH, -st.camZ);
  cam.rotation.set(0, 0, 0);
  const shot = intro.shot(st, now), q = shot ? shot.orbit : 1;
  if (q < 1) {
    const angle = Math.PI * .88 * (1 - q), radius = mix(4.4, st.back, q);
    cam.position.set(mix(st.run.x, st.camX, q) + Math.sin(angle) * radius, mix(2.55, st.camH, q), -st.run.z + Math.cos(angle) * radius);
    cam.lookAt(mix(st.run.x, st.camX, q), mix(1.3, st.camH, q), -st.run.z);
  }
  cam.updateMatrixWorld(true);
  const y0 = mix(st.H * .5, st.y0, q);
  cam.projectionMatrix.makePerspective(-st.W / 2 / st.f * n, st.W / 2 / st.f * n, y0 / st.f * n, -(st.H - y0) / st.f * n, n, f);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  W3.BEND_U.value = (st.bend || 0) * q;
}
/** Renders the world and the players as they are now; who: {us, them, ghost} (each {spec (pose's), x, y, z (his
 *  feet), show} or null: not there). Returns the canvas it's on (transparent where the sky shows through). */
export function render(st, now, who) {
  camera(st, now);
  W3.update(st, now);
  // the place's light where he is (the next place's coming in at its gate)
  const L = W3.look(st, st.camZ + st.back);
  GL.hemi.color.copy(L.sky); GL.hemi.groundColor.copy(L.ground); GL.hemi.intensity = L.hemi;
  GL.sun.color.copy(L.sun); GL.sun.intensity = L.sunI;
  const fx = st.run ? st.run.x : 0, fz = -(st.camZ + st.back + 4);
  GL.sun.target.position.set(fx, 0, fz); GL.sun.position.set(fx + L.at[0] * 6, L.at[1] * 6, fz + L.at[2] * 6); // (at: + toward the camera)
  GL.sun.target.updateMatrixWorld();
  GL.scene.fog.color.copy(L.haze);
  ['us', 'them', 'ghost'].forEach(k => {
    const P = GL.players[k], w = who[k];
    P.root.visible = !!(w && w.show !== false);
    if (!P.root.visible) return;
    const ride = k !== 'them' && riding(st.run) ? st.run.ride : null;
    const spec = ride ? {...w.spec, ride, reduced: st.reducedMotion, ball: false, carry: 0, lift: 0,
      pitch: w.spec.move === 'slide' ? w.spec.pitch : 0, roll: (w.spec.roll || 0) * .45} : w.spec;
    P.root.position.set(w.x, w.y + (spec.lift || 0), -w.z);
    pose(P, spec, P.last ? Math.min(.1, Math.max(0, (now - P.last) / 1000)) : 1);
    P.last = now;
    if (k === 'ghost') GL.ghost.forEach(m => { m.opacity = w.alpha; });
  });
  const shot = intro.shot(st, now);
  GL.punt.visible = !!shot && shot.ball > 0;
  if (GL.punt.visible) {
    const P = GL.players.us, {a, b} = tmp();
    P.root.updateMatrixWorld(true);
    P.B.LeftHand.getWorldPosition(a); P.B.RightHand.getWorldPosition(b); a.lerp(b, .5);
    const fall = 1 - shot.flight;
    GL.punt.position.copy(a); GL.punt.position.y += fall * fall * 5.5;
    // The glove bones sit inside the oversized gloves; put the ball against their front surfaces.
    GL.punt.position.z -= .16 + fall * 2.5;
    GL.punt.rotation.set(fall * 9, Math.PI, .15);
    GL.punt.scale.setScalar(BALL * SCALE * 1.2 * shot.ball);
  }
  const R = GL.renderer;
  R.setScissorTest(false);
  R.setViewport(0, 0, GL.w, GL.h);
  R.render(GL.scene, GL.camera);
  return GL.canvas;
}
