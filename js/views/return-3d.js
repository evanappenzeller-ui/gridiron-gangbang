import * as features from '../core/features.js';
// Return Man's players in real 3D (the owner's ask, Oct 2026: smooth, at the screen's frame rate, not pictures): a
// rigged, animated football player (models/return-player.glb: "American Football Player" by blakeallen25 on Sketchfab,
// CC-BY-4.0, https://sketchfab.com/3d-models/american-football-player-10bf41a1c05a4c9cb74676b7dd8cb18e; slimmed by
// tools/return/player-model.mjs, with Mixamo's Fast Run for his run and the X Bot's idle, retargeted in by
// tools/return/mixamo-clip.mjs, in place: the ground moves under him; three.js itself in js/vendor/three, MIT) in each
// side's colours (his jersey, pants and helmet repainted, his number on his back and his chest; for the returner the
// ball), lit, in the 3D world (views/return-3dworld.js: the ground, the roadside, the
// lane things, built in the same scene): the whole of it rendered on a WebGL canvas off the page through a camera that
// matches the 2D scene's (views/return-world.js P), each frame, and laid over the sky (views/return.js), with the
// place's light, its haze as fog, and the sun's shadows.
// A pose (views/return.js says which: pose specs) is a move's clip, cross-faded from the one before (the idle; the
// run, at the stride the yards say; the jump, the slide, a side-step, going down: MOVES), with the moment's own pose
// laid over it bone by bone (aim(): each bone turned to point where the move wants it, in his own frame: +z ahead, +x
// his left, +y up): the ball tucked, the catch, a stumble's arm; turned (a cut, a spin), leaned and pitched (a fall, a
// dive) as a whole. Everything's bent with the world (return-3dworld.js bend()).
// Exports: load(), ready(), render(st, now, who), STRIDE, MOVES.
import * as W3 from './return-3dworld.js';
import * as data from '../core/data.js';
const V = new URL('../vendor/three/', import.meta.url).href;
const MODEL = new URL('../../models/return-player.glb', import.meta.url).href;
/** Yards a full run cycle (two strides) covers: the clip's legs keep pace with the ground. (Mixamo's Fast Run plants
 *  3.7 a cycle on him, tools/return/mixamo-clip.mjs says; at his 13-19 yards a second that spins the legs near three
 *  times a second, too fast to read, so a longer stride: his feet slide a little, out of sight from behind him.) */
export const STRIDE = 5;
const SCALE = 1.12; // the model's metres to yards, a little big (a man is about 2 yards with his helmet on)
const KITS = {
  us: {jersey: 0x1D3F8F, numFill: 0xFFFFFF, numEdge: 0x0C1A44, pants: 0xD9DDE5, stripe: 0x1D3F8F, helmet: 0x1D3F8F, mask: 0xC4CAD4, cup: 0x0C1A44,
    visor: 0x14181F, num: 22, ball: true, size: 1},
  them: {jersey: 0xC8102E, numFill: 0xFFFFFF, numEdge: 0x6E0E10, pants: 0xF3F3F5, stripe: 0xC8102E, helmet: 0xF2F3F5, mask: 0x4E535C, cup: 0x6E0E10,
    visor: 0x14181F, num: 52, ball: false, size: 1.06}
};
let T = null, GL = null, GL_UTILS = null, LOADING = null, DEAD = false;
let ownerStyle = null, styleAttempt = null, styleTried = false, styleSubscribed = false;

/** Loads three.js and the model, and dresses both players (once). Resolves true when they're in; false if this phone
 *  can't (no WebGL, a load failed): the sprite players stay. */
export function load() {
  if (!styleSubscribed) {
    styleSubscribed = true;
    data.subscribe(type => { if (type === 'me' || type === 'data') syncPlayerStyle(); });
  }
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
        syncPlayerStyle();
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
/** The canvas render() draws on (one for the session), for the stage to show as a layer of its own. */
export const canvas = () => (GL ? GL.canvas : null);

// The reviewed kit is only loaded for Evan's selected profile. Keep the original players intact:
// fresh clones give accessories their bind-pose attachment points, even after a mid-run profile switch.
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
function releaseStyledPlayer(entry) {
  const {player: P, style, ghost, ballGeometry, ballMaterials} = entry;
  P.root.removeFromParent();
  style?.dispose();
  ghost.forEach(m => m.dispose());
  ballGeometry.forEach(g => g.dispose()); ballMaterials.forEach(m => m.dispose());
  const skeletons = new Set();
  P.model.traverse(o => { if (o.skeleton) skeletons.add(o.skeleton); });
  skeletons.forEach(s => s.dispose());
  P.mixer.stopAllAction(); P.mixer.uncacheRoot(P.model);
}
function styledPlayer(restyle, isGhost) {
  const P = dress(GL.gltf, GL.SK, KITS.us);
  const entry = {player: P, style: null, ghost: [], ballGeometry: new Set(), ballMaterials: new Set()};
  P.ball.traverse(o => {
    if (!o.isMesh) return;
    entry.ballGeometry.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => entry.ballMaterials.add(m));
  });
  try {
    entry.style = restyle(P, T, GL_UTILS);
    arm(P, GL.clips);
    if (isGhost) entry.ghost = ghostMaterials(P);
    else P.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    W3.bend(P.root);
    return entry;
  } catch (error) { releaseStyledPlayer(entry); throw error; }
}
function revokePlayerStyle() {
  styleAttempt = null; styleTried = false;
  if (!ownerStyle) return;
  const old = ownerStyle; ownerStyle = null;
  GL.players = GL.basePlayers; GL.ghost = GL.baseGhost;
  old.forEach(releaseStyledPlayer);
}
function syncPlayerStyle() {
  if (!features.available()) { revokePlayerStyle(); return; }
  if (!GL || styleTried) return;
  styleTried = true;
  const attempt = {}; styleAttempt = attempt;
  import('./return-player-style.js').then(({restyleFootball}) => {
    if (styleAttempt !== attempt || !features.available()) return;
    const entries = [];
    try {
      entries.push(styledPlayer(restyleFootball, false));
      entries.push(styledPlayer(restyleFootball, true));
      GL.basePlayers.us.root.visible = GL.basePlayers.ghost.root.visible = false;
      entries.forEach(e => { e.player.root.visible = false; GL.scene.add(e.player.root); });
      GL.players = {...GL.basePlayers, us: entries[0].player, ghost: entries[1].player};
      GL.ghost = entries[1].ghost; ownerStyle = entries;
    } catch (error) {
      entries.forEach(releaseStyledPlayer);
      throw error;
    }
  }).catch(error => {
    // Failed/offline styling leaves the complete original player available; no retry every frame.
    if (styleAttempt === attempt) console.warn('Return Man: original player kit retained', error);
  });
}

// ---------------------------------------------------------------------------- Dressing him
// The player as he comes (models/return-player.glb: his own jersey, pants, helmet and cleats) in each side's colours:
// the jersey's and the pants' pictures painted over (their white to the kit's colour, their maroon to the number's
// and the stripes', their gold to the edge; the cloth's light and shade kept), his number painted on front and back
// where the model's own were; the helmet's shell, its face mask, the chin cup (and his belt) and the visor tinted.
const bare = name => name.replace(/^mixamorig:?/, '');
const smooth = (a, b, v) => { const u = Math.max(0, Math.min(1, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
const rgb = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
/** Where the jersey's numbers are in its picture (fractions of it; the picture's upside down): each one's middle, its
 *  height, and the box round the model's own (its 1 on the front, its 2 on the back), painted out. */
const NUMS = [{x: .5786, y: .4697, h: .213, box: [.552, .606, .356, .586]}, {x: .856, y: .49, h: .244, box: [.828, .885, .361, .62]}];
/** A picture of his kit (map: the model's texture) painted over: white to base, maroon to accent, gold to edge; with
 *  num, the number painted on (accent, edged in edge). */
function repaint(map, base, accent, edge, num = null) {
  const img = map.image, cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d', {willReadFrequently: true});
  g.drawImage(img, 0, 0);
  const W = cv.width, H = cv.height, data = g.getImageData(0, 0, W, H), p = data.data;
  const [B, A, E] = [base, accent, edge].map(rgb);
  const boxes = num ? NUMS.map(n => [n.box[0] * W, n.box[1] * W, n.box[2] * H, n.box[3] * H]) : [];
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
    const r = p[i] / 255, gr = p[i + 1] / 255, b = p[i + 2] / 255, v = Math.max(r, gr, b), c = v - Math.min(r, gr, b);
    const hue = c === 0 ? 0 : v === r ? 60 * (((gr - b) / c + 6) % 6) : v === gr ? 60 * ((b - r) / c + 2) : 60 * ((r - gr) / c + 4);
    let col = smooth(.22, .42, v > 0 ? c / v : 0), sw = Math.min(1.08, v / .94);
    if (boxes.some(q => x >= q[0] && x <= q[1] && y >= q[2] && y <= q[3])) { sw = col * .97 + (1 - col) * sw; col = 0; } // (the old number: cloth)
    const gold = col * smooth(18, 30, hue) * (1 - smooth(70, 85, hue)), red = col - gold, sr = Math.min(1.25, v / .5), sg = Math.min(1.15, v / .85);
    for (let k = 0; k < 3; k++) p[i + k] = 255 * Math.min(1, (1 - col) * B[k] * sw + red * A[k] * sr + gold * E[k] * sg);
  }
  g.putImageData(data, 0, 0);
  if (num) NUMS.forEach(n => {
    const h = n.h * H, s = String(num);
    g.save();
    g.translate(n.x * W, n.y * H); g.scale(1, -1);
    g.font = `800 ${Math.round(h / .7)}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.textAlign = 'center';
    const m = g.measureText(s), dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    g.lineJoin = 'round'; g.lineWidth = h * .1; g.strokeStyle = '#' + edge.toString(16).padStart(6, '0'); g.strokeText(s, 0, dy);
    g.fillStyle = '#' + accent.toString(16).padStart(6, '0'); g.fillText(s, 0, dy);
    g.restore();
  });
  const t = new T.CanvasTexture(cv);
  Object.assign(t, {flipY: map.flipY, colorSpace: map.colorSpace, wrapS: map.wrapS, wrapT: map.wrapT, channel: map.channel, anisotropy: 4});
  return t;
}
/** The model's materials in kit k (by the model's own names for them), once a kit. */
const KIT_MATS = new Map();
function kitMaterials(gltf, k) {
  if (KIT_MATS.has(k)) return KIT_MATS.get(k);
  const out = new Map(), tint = (m, hex, o = {}) => { const c = m.clone(); c.color = new T.Color(hex); Object.assign(c, o); return c; };
  gltf.scene.traverse(o => {
    if (!o.isMesh || out.has(o.material)) return;
    const m = o.material;
    const cloth = {roughnessMap: null, metalnessMap: null, roughness: .82, metalness: 0}; // (the model's has them shine like plastic)
    out.set(m, m.name === 'shirt_0' ? Object.assign(m.clone(), cloth, {map: repaint(m.map, k.jersey, k.numFill, k.numEdge, k.num)})
      : m.name === 'pants' ? Object.assign(m.clone(), cloth, {map: repaint(m.map, k.pants, k.stripe, k.numEdge)})
      : m.name === 'Mat.3' ? tint(m, k.helmet)
      : m.name === 'Mat.8_1' ? tint(m, k.mask, {metalness: .55, roughness: .3})
      : m.name === 'Mat.2_2mat' ? tint(m, k.cup)
      : m.name === 'frosted_glass' ? tint(m, k.visor, {metalness: .6, roughness: .12})
      : m);
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
/** One player: the model cloned and dressed in kit k. */
function dress(gltf, SK, k) {
  const model = SK.clone(gltf.scene), mats = kitMaterials(gltf, k);
  model.updateMatrixWorld(true);
  const B = {};
  model.traverse(o => {
    if (o.isBone) B[bare(o.name)] = o;
    if (o.isMesh) { o.material = mats.get(o.material) || o.material; o.frustumCulled = false; }
  });
  const at = n => B[n].getWorldPosition(new T.Vector3());
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
    const hand = at('RightHand'), fore = at('RightForeArm'), along = hand.clone().sub(fore).normalize();
    hang(B.RightForeArm, ball, hand.clone().lerp(fore, .3).add(new T.Vector3(0, -.02, .07)), new T.Quaternion().setFromUnitVectors(new T.Vector3(-1, 0, 0), along));
  }
  const root = new T.Group(), wrap = new T.Group();
  root.rotation.order = 'YXZ';
  wrap.rotation.y = Math.PI; wrap.scale.setScalar(SCALE * k.size);
  wrap.add(model); root.add(wrap);
  const mixer = new T.AnimationMixer(model);
  const clip = name => gltf.animations.find(a => a.name === name);
  const run = mixer.clipAction(clip('run')), idle = mixer.clipAction(clip('idle'));
  [run, idle].forEach(a => { a.play(); a.setEffectiveWeight(0); });
  return {root, wrap, model, B, mixer, run, idle, ball, hipsY: B.Hips.position.y, q: new T.Quaternion(),
    act: {run, idle}, w: {run: 0, idle: 1}, u: {}, slot: {}, last: 0};
}
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
  const clips = bake(players.us, gltf);
  Object.values(players).forEach(P => arm(P, clips));
  const ghost = ghostMaterials(players.ghost);
  [players.us, players.them].forEach(P => P.root.traverse(o => { if (o.isMesh) o.castShadow = true; }));
  scene.add(W3.bend(players.us.root), W3.bend(players.them.root), W3.bend(players.ghost.root));
  const camera = new T.PerspectiveCamera();
  camera.matrixAutoUpdate = true;
  return {renderer, canvas, scene, camera, players, ghost, basePlayers: players, baseGhost: ghost,
    gltf, SK, clips, hemi, sun, rim, w: 0, h: 0};
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
/** Sets his pose: s = {move ('idle', 'run', or one of MOVES), u (0-1: how far into the move), phase (0-1 round the
 *  run's cycle), t (seconds), carry, catch, stumble (each 0-1: how far into it), turn, roll, pitch (radians), lift
 *  (yards), ball (whether the ball's in his arm)}; dt: seconds since the last. */
function pose(P, s, dt) {
  // the move's take: the one it's on, or the other if it's started again while this one still shows
  const want = s.move || 'run';
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
  // the whole of him: turned, leaned, pitched forward about his feet
  P.root.rotation.set(-(s.pitch || 0), -(s.turn || 0), -(s.roll || 0));
  P.root.updateMatrixWorld(true);
  P.wrap.getWorldQuaternion(P.q);
  P.model.updateMatrixWorld(true);
  const t = s.t || 0;
  // a stumble: the trunk forward (not down in a slide), his free arm flailing
  if (s.stumble > 0) {
    if (want !== 'slide') trunk(P, [0, .78, .62], s.stumble * .8);
    const w = Math.sin(t * 14);
    limb(P, 'Left', [.92, .25 + .35 * w, .22], [.62, .72 + .2 * w, .25], s.stumble);
  }
  // the catch: both hands up; the ball tucked in his right
  if (s.catch > 0) { limb(P, 'Left', [.3, .85, .42], [.06, .9, .45], s.catch); limb(P, 'Right', [-.3, .85, .42], [-.06, .9, .45], s.catch); }
  if (s.carry > 0) { const sw = .12 * Math.sin((s.phase || 0) * Math.PI * 2); limb(P, 'Right', [-.22, -.86, -.42 + sw], [.42, .3 + sw * .5, .86], s.carry); }
  if (P.ball) P.ball.visible = !!s.ball;
}

// ---------------------------------------------------------------------------- Drawing it all
/** The camera, matched to the scene's (views/return-world.js P: a pinhole at (camX, camH, camZ) looking ahead, f px
 *  to the screen, its middle at (W / 2, y0)); and the canvas, the stage's size (at most twice its CSS pixels). */
function camera(st) {
  const k = Math.min(2, st.dpr || 1), cw = Math.round(st.W * k), ch = Math.round(st.H * k);
  if (GL.w !== cw || GL.h !== ch) { GL.renderer.setSize(cw, ch, false); GL.w = cw; GL.h = ch; }
  const cam = GL.camera, n = .1, f = 400;
  cam.position.set(st.camX, st.camH, -st.camZ);
  cam.rotation.set(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.projectionMatrix.makePerspective(-st.W / 2 / st.f * n, st.W / 2 / st.f * n, st.y0 / st.f * n, -(st.H - st.y0) / st.f * n, n, f);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  W3.BEND_U.value = st.bend || 0;
}
/** Renders the world and the players as they are now; who: {us, them, ghost} (each {spec (pose's), x, y, z (his
 *  feet), show} or null: not there). Returns the canvas it's on (transparent where the sky shows through). */
export function render(st, now, who) {
  syncPlayerStyle();
  camera(st);
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
    P.root.position.set(w.x, w.y + (w.spec.lift || 0), -w.z);
    pose(P, w.spec, P.last ? Math.min(.1, Math.max(0, (now - P.last) / 1000)) : 1);
    P.last = now;
    if (k === 'ghost') GL.ghost.forEach(m => { m.opacity = w.alpha; });
  });
  const R = GL.renderer;
  R.setScissorTest(false);
  R.setViewport(0, 0, GL.w, GL.h);
  R.render(GL.scene, GL.camera);
  return GL.canvas;
}
