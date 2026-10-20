// Return Man's players in real 3D (the owner's ask, Oct 2026: smooth, at the screen's frame rate, not pictures): a
// rigged, animated athlete (models/return-player.glb: Mixamo's X Bot from the three.js examples, free to use in a
// project under Adobe's Mixamo terms; slimmed by tools/return/player-model.mjs, with its idle and its run; three.js
// itself in js/vendor/three, MIT) dressed in each side's uniform (the jersey, pants, socks, cleats and gloves painted on by which bone
// moves each part of him; a glossy helmet with a stripe and a face mask, shoulder pads, his number on his back and his
// chest, and for the returner the ball), lit, and laid into the 2D scene where he stands in it (views/return.js): each
// player is rendered on a WebGL canvas off the page through a camera that matches the scene's (views/return-world.js P),
// then drawn onto the stage's canvas in his turn, so whatever is nearer still covers him.
// A pose (views/return.js says which: pose specs) is the run's clip at the stride the yards say (or the idle), with
// the moment's own pose laid over it bone by bone (aim(): each bone turned to point where the move wants it, in his own
// frame: +z ahead, +x his left, +y up): the ball tucked, the catch, the leap's tuck, the slide, a stumble's arm, going
// down, the dive; turned (a cut, a spin), leaned and pitched (a fall, a dive) as a whole.
// Exports: load(), ready(), camera(st), draw(st, c, who, spec, x, y, z, alpha), STRIDE.
import {P as project} from './return-world.js';
const V = new URL('../vendor/three/', import.meta.url).href;
const MODEL = new URL('../../models/return-player.glb', import.meta.url).href;
/** Yards a full run cycle (two strides) covers: the clip's legs keep pace with the ground. */
export const STRIDE = 5;
const SCALE = 1.12; // the model's metres to yards, a little big (a man is about 2 yards with his helmet on)
const KITS = {
  us: {jersey: 0x1D3F8F, pants: 0xD9DDE5, stripe: 0x1D3F8F, sock: 0x1D3F8F, cleat: 0x15171C, glove: 0x1A2240, skin: 0x8A5A36,
    helmet: 0x1D3F8F, helmetStripe: 0xF4F6FA, mask: 0xC4CAD4, num: 22, numFill: '#FFFFFF', numEdge: '#0C1A44', ball: true},
  them: {jersey: 0xC8102E, pants: 0xF3F3F5, stripe: 0xC8102E, sock: 0xC8102E, cleat: 0x15171C, glove: 0xF4F4F6, skin: 0xC68C5E,
    helmet: 0xF2F3F5, helmetStripe: 0xC8102E, mask: 0x4E535C, num: 52, numFill: '#FFFFFF', numEdge: '#6E0E10', ball: false}
};
let T = null, GL = null, LOADING = null, DEAD = false;

/** Loads three.js and the model, and dresses both players (once). Resolves true when they're in; false if this phone
 *  can't (no WebGL, a load failed): the sprite players stay. */
export function load() {
  if (!LOADING) {
    LOADING = (async () => {
      try {
        const probe = document.createElement('canvas');
        if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
        const [three, {GLTFLoader}, SK, {RoomEnvironment}] = await Promise.all([
          import(V + 'three.module.min.js'), import(V + 'GLTFLoader.js'), import(V + 'SkeletonUtils.js'), import(V + 'RoomEnvironment.js')]);
        T = three;
        const gltf = await new GLTFLoader().loadAsync(MODEL);
        try { await document.fonts.load('800 100px "Barlow Condensed"'); } catch (_) {}
        GL = build(gltf, SK, RoomEnvironment);
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

// ---------------------------------------------------------------------------- Dressing him
// Which part of the uniform each bit of him is, by the bone that moves it (and where it is on him, standing in the
// model's T-pose, metres, facing +z): the jersey (the chest, the top of the arms), the pants (the hips below the
// waist, the thighs, the knee, with a stripe down the outside of the thigh), socks, cleats, gloves, and skin.
const PART = {jersey: 0, pants: 1, stripe: 2, sock: 3, cleat: 4, glove: 5, skin: 6};
function partOf(bone, p, R) {
  const n = bone;
  if (/^(Head|HeadTop|LeftEye|RightEye|Neck)/.test(n)) return PART.skin;
  if (/^Spine|Shoulder$/.test(n)) return PART.jersey;
  if (n === 'Hips') return p.y > R.waist ? PART.jersey : PART.pants;
  if (/^(Left|Right)Arm$/.test(n)) return (Math.abs(p.x) - R.shoulderX) / R.upperArm < .55 ? PART.jersey : PART.skin;
  if (/ForeArm$/.test(n)) return PART.skin;
  if (/Hand/.test(n)) return PART.glove;
  if (/UpLeg$/.test(n)) {
    // (the stripe: down the outside of the thigh, hip to knee)
    const u = Math.max(0, Math.min(1, (R.hipY - p.y) / (R.hipY - R.knee))), ax = R.hipX + (R.kneeX - R.hipX) * u, az = R.hipZ + (R.kneeZ - R.hipZ) * u;
    return p.y < R.hipY - .04 && Math.abs(p.x) - ax > R.stripeOut && Math.abs(p.z - az) < .028 ? PART.stripe : PART.pants;
  }
  if (/Leg$/.test(n)) return p.y > R.knee - .06 ? PART.pants : PART.sock;
  if (/Foot|Toe/.test(n)) return PART.cleat;
  return PART.skin;
}
const bare = name => name.replace(/^mixamorig:?/, '');
const GET = ['getX', 'getY', 'getZ', 'getW'].map(f => function (i) { return this[f](i); }); // (an attribute's k-th component)
/** Each mesh's parts, worked out once from the model as it stands (its T-pose). */
function partsOf(scene) {
  scene.updateMatrixWorld(true);
  const B = {};
  scene.traverse(o => { if (o.isBone) B[bare(o.name)] = o; });
  const at = n => B[n].getWorldPosition(new T.Vector3());
  const hip = at('LeftUpLeg'), knee = at('LeftLeg');
  const R = {waist: at('Hips').y - .03, shoulderX: at('LeftArm').x, upperArm: at('LeftForeArm').x - at('LeftArm').x,
    hipX: hip.x, hipY: hip.y, hipZ: hip.z, knee: knee.y, kneeX: knee.x, kneeZ: knee.z, stripeOut: .045};
  const out = new Map(), v = new T.Vector3(), box = {head: new T.Box3(), chest: new T.Box3()};
  scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = g.attributes.position.count;
    const parts = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = GET[k].call(sw, i); if (w > bw) { bw = w; best = GET[k].call(si, i); } }
      o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld);
      const bn = bare(o.skeleton.bones[best].name);
      parts[i] = partOf(bn, v, R);
      if (bn === 'Head') box.head.expandByPoint(v);
      if (/^Spine/.test(bn) && v.y > 1.24 && v.y < 1.36) box.chest.expandByPoint(v);
    }
    out.set(o.name, parts);
  });
  return {parts: out, box, at};
}
// The number: white with an edge in the kit's dark, on a canvas.
function numberTexture(k) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 192;
  const g = cv.getContext('2d');
  g.font = '800 170px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 18; g.strokeStyle = k.numEdge; g.strokeText(String(k.num), 128, 102);
  g.fillStyle = k.numFill; g.fillText(String(k.num), 128, 102);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** Hangs a piece of kit on a bone where it sits on him standing (world: its place, metres, in the T-pose). */
function hang(bone, obj, at, rot = null) {
  bone.updateWorldMatrix(true, false);
  const m = new T.Matrix4().compose(at, rot || new T.Quaternion(), obj.scale.clone());
  m.premultiply(bone.matrixWorld.clone().invert());
  m.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
}
/** One player: the model cloned and dressed in kit k. */
function dress(gltf, SK, k, info) {
  const model = SK.clone(gltf.scene);
  model.updateMatrixWorld(true);
  const B = {};
  model.traverse(o => { if (o.isBone) B[bare(o.name)] = o; });
  // built like a football player: thicker legs and arms (each bone's own y runs along it, so this thickens, not lengthens)
  ['LeftUpLeg', 'RightUpLeg'].forEach(n => B[n].scale.set(1.22, 1, 1.22));
  ['LeftArm', 'RightArm'].forEach(n => B[n].scale.set(1.18, 1, 1.18));
  // the uniform, painted on (the joints' rings a shade darker, as seams)
  const COL = [k.jersey, k.pants, k.stripe, k.sock, k.cleat, k.glove, k.skin].map(h => new T.Color(h));
  const body = new T.MeshStandardMaterial({vertexColors: true, roughness: .62, metalness: 0, envMapIntensity: .55});
  model.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.geometry = o.geometry.clone();
    const parts = info.parts.get(o.name), n = parts.length, col = new Float32Array(n * 3), seam = /Joints/.test(o.name) ? .72 : 1;
    for (let i = 0; i < n; i++) { const c = COL[parts[i]]; col[i * 3] = c.r * seam; col[i * 3 + 1] = c.g * seam; col[i * 3 + 2] = c.b * seam; }
    o.geometry.setAttribute('color', new T.BufferAttribute(col, 3));
    o.material = body;
    o.frustumCulled = false;
  });
  // the helmet: a glossy shell open at the face, a stripe over the top, the face mask
  const hb = info.box.head, hc = hb.getCenter(new T.Vector3()), hs = hb.getSize(new T.Vector3());
  const r = Math.max(hs.x, hs.z) * .64, helmet = new T.Group();
  const shellM = new T.MeshPhysicalMaterial({color: k.helmet, roughness: .2, metalness: .1, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.2});
  const W = .95; // (half the face's opening, radians round from the front)
  helmet.add(new T.Mesh(new T.SphereGeometry(r, 40, 24, 0, Math.PI * 2, 0, Math.PI * .46), shellM));
  helmet.add(new T.Mesh(new T.SphereGeometry(r, 40, 12, Math.PI / 2 + W, Math.PI * 2 - 2 * W, Math.PI * .46, Math.PI * .26), shellM));
  const stripeM = new T.MeshStandardMaterial({color: k.helmetStripe, roughness: .3, envMapIntensity: 1});
  [Math.PI / 2, Math.PI * 1.5].forEach(ph => helmet.add(new T.Mesh(new T.SphereGeometry(r * 1.006, 4, 16, ph - .085, .17, 0, Math.PI * .5), stripeM)));
  const maskM = new T.MeshStandardMaterial({color: k.mask, roughness: .35, metalness: .6, envMapIntensity: 1});
  const bar = (pts, rad = .0085) => helmet.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, rad, 6), maskM));
  const arc = (y, rr, a) => Array.from({length: 9}, (_, i) => { const t = -a + 2 * a * i / 8; return new T.Vector3(Math.sin(t) * rr, y, Math.cos(t) * rr); });
  bar(arc(-r * .18, r * 1.12, 1.05)); bar(arc(-r * .5, r * 1.1, .95)); bar(arc(-r * .78, r * .95, .7));
  bar([new T.Vector3(0, -r * .1, r * 1.12), new T.Vector3(0, -r * .5, r * 1.1), new T.Vector3(0, -r * .82, r * .95)]);
  [-1, 1].forEach(s => bar([new T.Vector3(s * Math.sin(1.05) * r * 1.12, -r * .18, Math.cos(1.05) * r * 1.12), new T.Vector3(s * Math.sin(.95) * r * 1.1, -r * .5, Math.cos(.95) * r * 1.1), new T.Vector3(s * Math.sin(.7) * r * .95, -r * .78, Math.cos(.7) * r * .95)]));
  helmet.scale.set(1, 1.02, 1.08);
  hang(B.Head, helmet, new T.Vector3(hc.x, hc.y + hs.y * .06, hc.z + .005));
  // shoulder pads under the jersey: a yoke across the top of him, a cap over each shoulder
  const cb = info.box.chest, cc = cb.getCenter(new T.Vector3()), cs = cb.getSize(new T.Vector3());
  const padM = new T.MeshStandardMaterial({color: k.jersey, roughness: .6, envMapIntensity: .55});
  const sh = info.at('LeftArm');
  const yoke = new T.Mesh(new T.SphereGeometry(1, 28, 16), padM);
  yoke.scale.set(cs.x * .62, .085, cs.z * .62);
  hang(B.Spine2, yoke, new T.Vector3(0, sh.y + .005, cc.z));
  [-1, 1].forEach(s => {
    const cap = new T.Mesh(new T.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * .62), padM);
    cap.scale.set(.085, .07, .1);
    hang(B.Spine2, cap, new T.Vector3(s * sh.x * .95, sh.y + .015, cc.z));
  });
  // the number on his back and his chest
  const tex = numberTexture(k), numM = new T.MeshStandardMaterial({map: tex, transparent: true, alphaTest: .4, roughness: .6, envMapIntensity: .5, polygonOffset: true, polygonOffsetFactor: -2});
  const halfW = cs.x / 2, halfD = cs.z / 2;
  [[Math.PI, .2, 1.27], [0, .13, 1.33]].forEach(([mid, h, y]) => {
    const g = new T.CylinderGeometry(1, 1, h, 16, 1, true, mid - .7, 1.4);
    const m = new T.Mesh(g, numM);
    m.scale.set(halfW * 1.03, 1, halfD * 1.08);
    hang(B.Spine1, m, new T.Vector3(0, y, cc.z));
  });
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
    [-1, 1].forEach(s => { const ring = new T.Mesh(new T.TorusGeometry(.07, .008, 6, 20), white); ring.rotation.y = Math.PI / 2; ring.position.x = s * .085; ring.scale.set(1, 1, 1); ball.add(ring); });
    const hand = info.at('RightHand'), fore = info.at('RightForeArm');
    hang(B.RightForeArm, ball, new T.Vector3(hand.x + (fore.x - hand.x) * .3, hand.y - .02, hand.z + .07));
  }
  const root = new T.Group(), wrap = new T.Group();
  root.rotation.order = 'YXZ';
  wrap.rotation.y = Math.PI; wrap.scale.setScalar(SCALE);
  wrap.add(model); root.add(wrap);
  const mixer = new T.AnimationMixer(model);
  const clip = name => gltf.animations.find(a => a.name === name);
  const run = mixer.clipAction(clip('run')), idle = mixer.clipAction(clip('idle'));
  [run, idle].forEach(a => { a.play(); a.setEffectiveWeight(0); });
  return {root, wrap, model, B, mixer, run, idle, ball, hipsY: B.Hips.position.y, q: new T.Quaternion()};
}
function build(gltf, SK, RoomEnvironment) {
  const canvas = document.createElement('canvas');
  const renderer = new T.WebGLRenderer({canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance'});
  canvas.addEventListener('webglcontextlost', () => { DEAD = true; }); // (the phone took the GPU back: the pictures again)
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;
  pmrem.dispose();
  // the light: the sky, the sun from the upper left over the camera's shoulder, a cool rim from up ahead
  scene.add(new T.HemisphereLight(0xE4ECFF, 0x34452C, 1.15));
  const sun = new T.DirectionalLight(0xFFF1DC, 2.3); sun.position.set(-3, 6, 4); scene.add(sun);
  const rim = new T.DirectionalLight(0xA9C8FF, 1.3); rim.position.set(3, 4, -6); scene.add(rim);
  const info = partsOf(gltf.scene);
  const players = {us: dress(gltf, SK, KITS.us, info), them: dress(gltf, SK, KITS.them, info)};
  scene.add(players.us.root, players.them.root);
  const camera = new T.PerspectiveCamera();
  camera.matrixAutoUpdate = true;
  return {renderer, canvas, scene, camera, players, w: 0, h: 0};
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
/** Sets his pose: s = {clip ('run' | 'idle'), phase (0-1 round the run's cycle), t (seconds), runW (how much of the
 *  run over the idle), carry, catch, air (and tuck), slide, stumble, fall, dive (each 0-1: how far into it), turn,
 *  roll, pitch (radians), lift (yards), ball (whether the ball's in his arm)}. */
function pose(P, s) {
  const run = P.run, idle = P.idle, rw = s.runW ?? (s.clip === 'idle' ? 0 : 1);
  run.time = ((s.phase || 0) % 1 + 1) % 1 * run.getClip().duration;
  idle.time = (s.t || 0) % idle.getClip().duration;
  run.setEffectiveWeight(rw); idle.setEffectiveWeight(1 - rw);
  P.mixer.update(0);
  // the whole of him: turned, leaned, pitched forward about his feet
  P.root.rotation.set(-(s.pitch || 0), -(s.turn || 0), -(s.roll || 0));
  P.root.updateMatrixWorld(true);
  P.wrap.getWorldQuaternion(P.q);
  P.model.updateMatrixWorld(true);
  const B = P.B, t = s.t || 0;
  // down low in a slide: his hips near the ground
  if (s.slide > 0) { B.Hips.position.y = mix(B.Hips.position.y, P.hipsY * .27, s.slide); B.Hips.updateMatrixWorld(true); }
  // the trunk: back in a slide, forward in a stumble
  const sp = s.slide > 0 ? [0, .72, -.7] : s.stumble > 0 ? [0, .78, .62] : null, spw = s.slide > 0 ? s.slide : (s.stumble || 0) * .8;
  if (sp) { aim(P, 'Spine', 'Spine1', sp, spw); aim(P, 'Spine1', 'Spine2', sp, spw); aim(P, 'Spine2', 'Neck', [sp[0], sp[1] + .2, sp[2] * .6], spw); }
  // the legs
  if (s.air > 0) {
    const k = s.air, u = s.tuck ?? 1;
    aim(P, 'LeftUpLeg', 'LeftLeg', mix3([.05, -1, .1], [.1, -.28, .95], u), k); aim(P, 'LeftLeg', 'LeftFoot', mix3([0, -1, -.1], [0, -.72, .7], u), k);
    aim(P, 'RightUpLeg', 'RightLeg', mix3([-.05, -1, -.1], [-.42, -.5, .5], u), k); aim(P, 'RightLeg', 'RightFoot', mix3([0, -1, -.2], [.2, -.35, -.9], u), k);
  }
  if (s.slide > 0) {
    const k = s.slide;
    aim(P, 'LeftUpLeg', 'LeftLeg', [.1, -.08, 1], k); aim(P, 'LeftLeg', 'LeftFoot', [.06, -.12, 1], k);
    aim(P, 'RightUpLeg', 'RightLeg', [-.5, -.15, .85], k); aim(P, 'RightLeg', 'RightFoot', [.55, -.2, -.8], k);
  }
  if (s.fall > 0 || s.dive > 0) {
    const k = Math.max(s.fall || 0, s.dive || 0);
    [['Left', 1], ['Right', -1]].forEach(([n, x]) => { aim(P, n + 'UpLeg', n + 'Leg', [x * .1, -.95, -.3], k); aim(P, n + 'Leg', n + 'Foot', [x * .05, -.9, -.42], k); });
  }
  // the arms: his left free (the clip's swing, or up in a leap, flailing in a stumble, back on the ground in a slide,
  // out ahead going down); the ball tucked in his right
  const L = (arm, fore, w) => { aim(P, 'LeftArm', 'LeftForeArm', arm, w); aim(P, 'LeftForeArm', 'LeftHand', fore, w); };
  const Rt = (arm, fore, w) => { aim(P, 'RightArm', 'RightForeArm', arm, w); aim(P, 'RightForeArm', 'RightHand', fore, w); };
  if (s.catch > 0) { L([.3, .85, .42], [.06, .9, .45], s.catch); Rt([-.3, .85, .42], [-.06, .9, .45], s.catch); }
  if (s.air > 0) L([.4, .5, .75], [.18, .82, .55], s.air * .9);
  if (s.slide > 0) L([.55, -.72, -.42], [.15, -1, -.15], s.slide);
  if (s.stumble > 0) { const w = Math.sin(t * 14); L([.92, .25 + .35 * w, .22], [.62, .72 + .2 * w, .25], s.stumble); }
  if (s.fall > 0 || s.dive > 0) { const k = Math.max(s.fall || 0, s.dive || 0); L([.25, .95, .3], [.1, .95, .38], k); if (!s.carry) Rt([-.25, .95, .3], [-.1, .95, .38], k); }
  if (s.carry > 0) { const sw = .12 * Math.sin((s.phase || 0) * Math.PI * 2); Rt([-.22, -.86, -.42 + sw], [.42, .3 + sw * .5, .86], s.carry); }
  if (P.ball) P.ball.visible = !!s.ball;
}

// ---------------------------------------------------------------------------- Drawing him
/** The camera, matched to the scene's (views/return-world.js P: a pinhole at (camX, camH, camZ) looking ahead, f px
 *  to the screen, its middle at (W / 2, y0)); and the canvas, matched to the stage's. Once a frame, before draw(). */
export function camera(st) {
  if (!GL) return;
  const cw = st.cv.width, ch = st.cv.height;
  if (GL.w !== cw || GL.h !== ch) { GL.renderer.setSize(cw, ch, false); GL.w = cw; GL.h = ch; }
  const cam = GL.camera, n = .1, f = 400;
  cam.position.set(st.camX, st.camH, -st.camZ);
  cam.rotation.set(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.projectionMatrix.makePerspective(-st.W / 2 / st.f * n, st.W / 2 / st.f * n, st.y0 / st.f * n, -(st.H - st.y0) / st.f * n, n, f);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}
/** Draws player who ('us' | 'them') posed as spec says with his feet at (x, y, z) (the scene's yards) onto c, through
 *  c's transform (the camera's sway, if any); alpha for a see-through one. */
export function draw(st, c, who, spec, x, y, z, alpha = 1) {
  if (!GL) return false;
  const P = GL.players[who];
  P.root.position.set(x, y + (spec.lift || 0), -z);
  pose(P, spec);
  // the box he's in on the screen (CSS px), from a box round him in the world
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const dx of [-1.6, 1.6]) for (const dy of [-.3, 2.9]) for (const dz of [-1.4, 2.8]) {
    const q = project(st, x + dx, y + dy, Math.max(st.camZ + .3, z + dz));
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(st.W, Math.ceil(x1)); y1 = Math.min(st.H, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return true;
  const k = st.cv.width / st.W, R = GL.renderer;
  GL.players.us.root.visible = who === 'us'; GL.players.them.root.visible = who === 'them';
  R.setScissorTest(true);
  R.setScissor(x0 * k, (st.H - y1) * k, (x1 - x0) * k, (y1 - y0) * k);
  R.setViewport(0, 0, GL.w, GL.h);
  R.render(GL.scene, GL.camera);
  const ga = c.globalAlpha;
  c.globalAlpha = alpha;
  c.drawImage(GL.canvas, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
  c.globalAlpha = ga;
  return true;
}
