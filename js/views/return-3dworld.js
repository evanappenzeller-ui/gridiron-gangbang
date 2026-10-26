import * as features from '../core/features.js';
// Return Man's world in real 3D (the owner's ask, Oct 2026): the places a return runs through (core/return.js THEMES),
// built in three.js around the players (views/return-3d.js, the same scene): each place's ground (the field with its
// yard lines and numbers; a parking lot; a city street; packed snow; the desert's rails; cobbles; a boardwalk by the
// sea; a road across the moon; a dirt road through the fields), what stands beside the road (the same things in the
// same places as the 2D world's: views/return-world.js dressList), the gates into each place, and in the lanes the
// barricades and banners (the hard course's potholes, each with its cone, and sleds), the vehicles and their ramps,
// the power-ups, and the owner's gold coins (his first run of the day: one instanced mesh). The sky stays the 2D world's painting
// behind it all (the camera only ever looks straight ahead), the fog its haze.
// Everything is built as the road comes up and let go behind: the ground and the roadside in 20-yard chunks (each a few
// merged meshes, coloured by vertex), the lane things one by one (shared shapes and materials).
// The owner's Unity packs (Oct 25 2026, views/return-models.js): each place's models, once they've loaded, build what
// they can of its roadside and some of its lane things (in the same boxes), copied into the same batches (Batch.model),
// and add what the 2D world never had; until then (or offline) the shapes here. What was built before a place's models
// came in is built again with them while it's still out in the haze.
// The world in yards (x across, y up, z ahead); three.js's z is the other way (-z).
// The curved world (the owner's ask, Oct 2026): every material here and on the players is bent (bend(): its vertex
// shader sinks each point BEND_U * d^2 yards, d its depth ahead of the camera, after it's placed), so the ground needs
// vertices along it to bend: the ground's planes come in 2-yard strips, long boxes in 5-yard pieces.
// Exports: init(three, scene, utils), update(st, now), look(st, z), bend(obj), BEND_U, sceneryReady(id), renewScenery().
import * as R from '../core/return.js';
import {dressList, LOOKS, OBS, GOODS_COL, HOLE_COL, coneFly, CONE_MS} from './return-world.js';
import {seeded} from './stadium.js';
import * as cityBus from './return-city-bus.js';
import * as fieldLogo from './return-field-logo.js';
import * as data from '../core/data.js';
import * as style from './return-style.js';
import {decorate} from './return-scenery.js';
import * as models from './return-models.js';

let T = null, U = null, SCENE = null, ROOT = null;
/** The bend (yards down per yard of depth squared: return-3d.js sets it each frame from st.bend). */
export const BEND_U = {value: 0};
const BENT = new WeakSet();
// (one function for every material, so they all share its programs)
function bendShader(sh) {
  sh.uniforms.uBend = BEND_U;
  const v = sh.vertexShader, curve = 'mvPosition.y -= uBend * mvPosition.z * mvPosition.z;\ngl_Position = projectionMatrix * mvPosition;';
  sh.vertexShader = 'uniform float uBend;\n' + (v.includes('#include <project_vertex>')
    ? v.replace('#include <project_vertex>', '#include <project_vertex>\n' + curve)
    : v.replace('gl_Position = projectionMatrix * mvPosition;', curve)); // (a sprite's)
}
/** Bends every material on obj and what's under it (once each). */
export function bend(obj) {
  obj.traverse(o => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (BENT.has(m)) return;
      BENT.add(m);
      m.onBeforeCompile = bendShader;
      m.needsUpdate = true;
    });
  });
  return obj;
}
const LANE = R.LANE, CHUNK = 20, AHEAD = 150, BEHIND = 12;
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hashOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % 2147483647; };
const rnd = (...k) => seeded(hashOf(k.join('|')) || 1);

/** Sets up (once three.js is loaded): the shapes and materials everything shares, and the world's root. */
export function init(three, scene, utils) {
  T = three; U = utils; SCENE = scene;
  ROOT = new T.Group(); ROOT.name = 'world';
  COINS = null; // (the owner's coins: made again, in this world, when a coin run's drawn)
  SCENE.add(ROOT);
  cityBus.init(T, refreshCityBuses);
  fieldLogo.subscribe(refreshFieldLogos);
  styleMode = style.enabled();
  if (!styleSubscribed) {
    styleSubscribed = true;
    data.subscribe(type => { if (type === 'me' || type === 'data') syncStyle(); });
  }
  shapes();
  // everything each place needs drawn once now (the ground's pictures, the barricades, banners, power-ups and gates),
  // so coming to a new place never holds a frame up
  R.THEMES.forEach(th => { roadMat(th.id); baseMat(th.id); obstacleOf('hurdle', th.id); obstacleOf('bar', th.id); gateOf(th); });
  // (the hard course's potholes, their cones and sleds: the owner's only, so only on his phones)
  if (features.available()) { R.THEMES.forEach(th => R.HARD_OBST.forEach(type => obstacleOf(type, th.id))); coneObj(); }
  ['salts', 'pills', 'booze'].forEach(itemOf);
  endzoneMat(); logoMat(); seaMat(); for (let n = 10; n <= 50; n += 10) numberMat(n);
}

// ============================================================================ Shapes, materials, textures
let S = null; // the unit shapes, non-indexed, without uvs (for merging)
function shapes() {
  const bare = g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; };
  S = {
    box: bare(new T.BoxGeometry(1, 1, 1)),
    cyl: bare(new T.CylinderGeometry(1, 1, 1, 14)),
    cyl6: bare(new T.CylinderGeometry(1, 1, 1, 6)),
    cone: bare(new T.ConeGeometry(1, 1, 14)),
    cone4: bare(new T.ConeGeometry(1, 1, 4)),
    sph: bare(new T.SphereGeometry(1, 14, 10)),
    ball: bare(new T.SphereGeometry(1, 7, 5)),
    hemi: bare(new T.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
    tor: bare(new T.TorusGeometry(1, .12, 6, 18)),
    rock: bare(new T.DodecahedronGeometry(1, 0)),
    prism: bare(prism()),
    wedge: bare(wedge())
  };
}
// A gable: x -.5 to .5, y 0 up to the ridge at 1 (over x 0), z -.5 to .5.
function prism() {
  const g = new T.BufferGeometry(), p = [-.5, 0, .5, .5, 0, .5, 0, 1, .5, .5, 0, -.5, -.5, 0, -.5, 0, 1, -.5,
    -.5, 0, -.5, -.5, 0, .5, 0, 1, .5, -.5, 0, -.5, 0, 1, .5, 0, 1, -.5, .5, 0, .5, .5, 0, -.5, 0, 1, -.5, .5, 0, .5, 0, 1, -.5, 0, 1, .5];
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
  return g;
}
// A ramp: x -.5 to .5, rising from y 0 at z .5 (three.js: the near end) to y 1 at z -.5.
function wedge() {
  const g = new T.BufferGeometry(), p = [
    -.5, 0, .5, .5, 0, .5, .5, 1, -.5, -.5, 0, .5, .5, 1, -.5, -.5, 1, -.5, // the slope
    -.5, 0, .5, -.5, 1, -.5, -.5, 0, -.5, .5, 0, .5, .5, 0, -.5, .5, 1, -.5, // the sides
    -.5, 0, -.5, -.5, 1, -.5, .5, 1, -.5, -.5, 0, -.5, .5, 1, -.5, .5, 0, -.5]; // the back
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
  return g;
}
const COL = new Map();
const col = h => { let c = COL.get(h); if (!c) { c = new T.Color(h); COL.set(h, c); } return c; };
const _m = () => new T.Matrix4(), _e = () => new T.Euler(), _q = () => new T.Quaternion(), _v = () => new T.Vector3();
let TM = null;
const tm = () => TM || (TM = {m: _m(), e: _e(), q: _q(), p: _v(), s: _v(), n: new T.Matrix3()});
/** A batch of shapes, each placed, sized and coloured, into one mesh (one draw) at the end: written straight into
 *  one growing buffer (no shape copied, so building a chunk leaves next to nothing to collect). */
class Batch {
  constructor(id = null) { this.styled = !!id && style.enabled(); this.n = 0; this.cap = 0; this.p = null; this.nr = null; this.c = null; }
  room(k) {
    if (this.n + k <= this.cap) return;
    const cap = Math.max(2048, (this.n + k) * 2), grow = a => { const b = new Float32Array(cap * 3); if (a) b.set(a.subarray(0, this.n * 3)); return b; };
    this.p = grow(this.p); this.nr = grow(this.nr); this.c = grow(this.c); this.cap = cap;
  }
  /** shape at (x, y, z) (the world's yards: its middle), sized (sx, sy, sz), turned (rx, ry, rz), coloured. */
  add(shape, hex, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    if (this.styled) { hex = style.paint(hex); if (shape === 'sph') shape = 'ball'; if (shape === 'cyl') shape = 'cyl6'; }
    const g = S[shape], P = g.attributes.position.array, N = g.attributes.normal.array, k = P.length / 3, t = tm();
    t.e.set(rx, ry, rz); t.q.setFromEuler(t.e); t.p.set(x, y, -z); t.s.set(sx, sy, sz);
    const m = t.m.compose(t.p, t.q, t.s).elements, nm = t.n.getNormalMatrix(t.m).elements, c = col(hex);
    this.room(k);
    const o = this.n * 3, p = this.p, nr = this.nr, cc = this.c;
    for (let i = 0; i < k; i++) {
      const a = i * 3, vx = P[a], vy = P[a + 1], vz = P[a + 2], nx = N[a], ny = N[a + 1], nz = N[a + 2], w = o + a;
      p[w] = m[0] * vx + m[4] * vy + m[8] * vz + m[12]; p[w + 1] = m[1] * vx + m[5] * vy + m[9] * vz + m[13]; p[w + 2] = m[2] * vx + m[6] * vy + m[10] * vz + m[14];
      let ex = nm[0] * nx + nm[3] * ny + nm[6] * nz, ey = nm[1] * nx + nm[4] * ny + nm[7] * nz, ez = nm[2] * nx + nm[5] * ny + nm[8] * nz;
      const l = Math.hypot(ex, ey, ez) || 1; nr[w] = ex / l; nr[w + 1] = ey / l; nr[w + 2] = ez / l;
      cc[w] = c.r; cc[w + 1] = c.g; cc[w + 2] = c.b;
    }
    this.n += k;
    return this;
  }
  /** A scenery model (return-models.js: its corners, normals and colours) with its foot's middle at (x, y, z), turned
   *  ry about the up, sized (sx, sy, sz) along its own x, y, z. */
  model(M, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx) {
    const k = M.k, cs = Math.cos(ry), sn = Math.sin(ry), P = M.p, N = M.n, C = M.c;
    this.room(k);
    const o = this.n * 3, p = this.p, nr = this.nr, cc = this.c;
    for (let i = 0; i < k * 3; i += 3) {
      const vx = P[i] * sx, vy = P[i + 1] * sy, vz = P[i + 2] * sz, w = o + i;
      p[w] = x + vx * cs + vz * sn; p[w + 1] = y + vy; p[w + 2] = -z - vx * sn + vz * cs;
      let nx = N[i] / sx, ny = N[i + 1] / sy, nz = N[i + 2] / sz;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      nr[w] = nx * cs + nz * sn; nr[w + 1] = ny; nr[w + 2] = -nx * sn + nz * cs;
      cc[w] = C[i]; cc[w + 1] = C[i + 1]; cc[w + 2] = C[i + 2];
    }
    this.n += k;
    return this;
  }
  /** A box from (x0, y0, z0) to (x1, y1, z1). */
  box(hex, x0, x1, y0, y1, z0, z1, ry = 0) {
    // (a long one along the road in 5-yard pieces, so it bends with the ground)
    const n = ry ? 1 : Math.max(1, Math.ceil(Math.abs(z1 - z0) / 5)), d = (z1 - z0) / n;
    for (let i = 0; i < n; i++) { const a = z0 + d * i, b = a + d; this.add('box', hex, (x0 + x1) / 2, (y0 + y1) / 2, (a + b) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(d), 0, ry); }
    return this;
  }
  /** An upright cylinder (radius r, from y0 to y1) at (x, z). */
  cyl(hex, x, y0, y1, z, r, shape = 'cyl') { return this.add(shape, hex, x, (y0 + y1) / 2, z, r, y1 - y0, r); }
  mesh(mat) {
    if (!this.n) return null;
    const g = new T.BufferGeometry(), k = this.n * 3;
    g.setAttribute('position', new T.BufferAttribute(this.p.slice(0, k), 3));
    g.setAttribute('normal', new T.BufferAttribute(this.nr.slice(0, k), 3));
    g.setAttribute('color', new T.BufferAttribute(this.c.slice(0, k), 3));
    g.computeBoundingSphere();
    this.n = 0;
    const m = new T.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    return m;
  }
}
let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = {
    vc: new T.MeshLambertMaterial({vertexColors: true}),
    vcs: new T.MeshStandardMaterial({vertexColors: true, roughness: .55, metalness: .08, envMapIntensity: .6}),
    glow: new T.MeshBasicMaterial({vertexColors: true, toneMapped: false}),
    shadow: new T.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: .28, depthWrite: false})
  };
  return MAT;
}
/** A canvas texture, drawn once by draw(g, w, h). */
function canvasTex(w, h, draw, repeat = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
  return t;
}
const TEX = new Map();
const texOf = (key, make) => { let t = TEX.get(key); if (!t) { t = make(); TEX.set(key, t); } return t; };
const texMat = (key, make, o = {}) => texOf('m:' + key, () => new T.MeshLambertMaterial(Object.assign({map: texOf(key, make)}, o)));

// ============================================================================ The ground
// Each place's road (a band across x from -half to half, its picture repeating every `per` yards along z, so it's
// sharp where you run) and the ground either side (one colour, a grain over it). The stadium's road is the whole field.
// draw(g, w, h, px): px pixels a yard; the picture's top is the far end (larger z).
const GROUNDS = {
  stadium: {half: 31, per: 10, w: 2048, base: '#174F2B', draw(g, w, h, px) {
    const X = x => (x + 31) * px;
    g.fillStyle = '#1C5A33'; g.fillRect(0, 0, w, h);
    // the field in 5-yard mowed stripes
    g.fillStyle = '#2B8A45'; g.fillRect(X(-26.67), 0, 53.34 * px, h / 2);
    g.fillStyle = '#257D3E'; g.fillRect(X(-26.67), h / 2, 53.34 * px, h / 2);
    // the lanes: three faint mowed strips
    g.fillStyle = 'rgba(255,255,255,.035)'; [-LANE, 0, LANE].forEach(x => g.fillRect(X(x - .95), 0, 1.9 * px, h));
    g.fillStyle = 'rgba(255,255,255,.95)';
    // the sidelines, the yard lines (every 5), the hashes and the ticks at the sidelines (every yard)
    [-1, 1].forEach(s => g.fillRect(X(s > 0 ? 26.67 : -26.87), 0, .2 * px, h));
    [0, 5].forEach(yd => g.fillRect(X(-26.67), h - yd * px - .06 * px, 53.34 * px, .12 * px));
    for (let yd = 0; yd < 10; yd++) {
      const y = h - yd * px;
      [-26.47, 25.87, -3.4, 2.8].forEach(x => g.fillRect(X(x), y - .05 * px, .6 * px, .1 * px));
    }
  }},
  tailgate: {half: 12, per: 16, w: 1024, base: '#34363E', draw(g, w, h, px) {
    const X = x => (x + 12) * px;
    g.fillStyle = '#34363E'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3D4049'; g.fillRect(X(-5.2), 0, 10.4 * px, h);
    g.fillStyle = 'rgba(242,201,76,.9)'; [-5.05, 4.9].forEach(x => g.fillRect(X(x), 0, .15 * px, h));
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let z = 0; z < 16; z += 4) [-LANE / 2, LANE / 2].forEach(x => g.fillRect(X(x - .07), h - (z + 2) * px, .14 * px, 2 * px));
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let z = .6; z < 16; z += 3.2) [[-11.8, -5.8], [5.8, 11.8]].forEach(([a, b]) => g.fillRect(X(a), h - z * px - .07 * px, (b - a) * px, .14 * px));
    grain(g, w, h, .05);
  }},
  city: {half: 10, per: 4, w: 1024, base: '#8F959E', draw(g, w, h, px) {
    const X = x => (x + 10) * px;
    g.fillStyle = '#9AA0A8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#41444C'; g.fillRect(X(-5.6), 0, 11.2 * px, h);
    g.fillStyle = '#C9CED5'; [-5.9, 5.6].forEach(x => g.fillRect(X(x), 0, .3 * px, h));
    g.fillStyle = 'rgba(255,255,255,.85)'; [-LANE / 2, LANE / 2].forEach(x => g.fillRect(X(x - .07), h - 2 * px, .14 * px, 2 * px));
    g.fillStyle = 'rgba(70,74,82,.4)';
    for (let z = 0; z < 4; z += 2) [[-9.6, -5.9], [5.9, 9.6]].forEach(([a, b]) => g.fillRect(X(a), h - z * px - .04 * px, (b - a) * px, .08 * px));
    grain(g, w, h, .06);
  }},
  tundra: {half: 8, per: 4, w: 1024, base: '#EAF1F7', draw(g, w, h, px) {
    const X = x => (x + 8) * px;
    g.fillStyle = '#EAF1F7'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#D5E0EA'; g.fillRect(X(-5), 0, 10 * px, h);
    g.fillStyle = 'rgba(150,172,192,.4)'; [-LANE, 0, LANE].forEach(x => [[x - 1, x - .5], [x + .5, x + 1]].forEach(([a, b]) => g.fillRect(X(a), 0, (b - a) * px, h)));
    grain(g, w, h, .04, true);
  }},
  desert: {half: 7, per: 4.4, w: 1024, base: '#E7A86F', draw(g, w, h, px) {
    const X = x => (x + 7) * px;
    g.fillStyle = '#E7A86F'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#B58463'; [-LANE, 0, LANE].forEach(x => g.fillRect(X(x - 1.45), 0, 2.9 * px, h));
    g.fillStyle = '#6E4A33'; for (let z = 0; z < 4.4; z += 1.1) [-LANE, 0, LANE].forEach(x => g.fillRect(X(x - 1.25), h - (z + .38) * px, 2.5 * px, .38 * px));
    grain(g, w, h, .07);
  }},
  market: {half: 7, per: 1.8, w: 1024, base: '#D6C7A8', draw(g, w, h, px) {
    const X = x => (x + 7) * px;
    g.fillStyle = '#D6C7A8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8F8A82'; g.fillRect(X(-5.4), 0, 10.8 * px, h);
    const r = seeded(5);
    for (let row = 0; row < 2; row++) for (let x = -5.4 + (row ? .55 : 0) - 1.1; x < 5.4; x += 1.1) {
      g.fillStyle = `rgba(${150 + r() * 30},${144 + r() * 26},${134 + r() * 24},1)`;
      g.fillRect(X(Math.max(-5.4, x)) + 2, h - (row + 1) * .9 * px + 2, Math.min(1.1, 5.4 - x) * px - 4, .9 * px - 4);
    }
    g.fillStyle = '#E3D7BE'; [-LANE / 2, LANE / 2].forEach(x => g.fillRect(X(x - .2), 0, .4 * px, h)); [-5.7, 5.4].forEach(x => g.fillRect(X(x), 0, .3 * px, h));
    grain(g, w, h, .05);
  }},
  beach: {half: 20, per: 1.1, w: 2048, base: '#F2D7A0', draw(g, w, h, px) {
    const X = x => (x + 20) * px;
    g.fillStyle = '#F2D7A0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#E0C08A'; g.fillRect(X(-15.8), 0, 2.3 * px, h);
    g.fillStyle = '#C9915A'; g.fillRect(X(-5.4), 0, 10.8 * px, h);
    g.fillStyle = 'rgba(120,72,36,.5)'; [0, .55].forEach(z => g.fillRect(X(-5.4), h - z * px - .07 * px, 10.8 * px, .07 * px));
    g.fillStyle = '#8A5A30'; [-5.6, 5.2].forEach(x => g.fillRect(X(x), 0, .4 * px, h));
    grain(g, w, h, .05);
  }},
  space: {half: 7, per: 4, w: 1024, base: '#5A4E86', draw(g, w, h, px) {
    const X = x => (x + 7) * px;
    g.fillStyle = '#5A4E86'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2E3148'; g.fillRect(X(-5.4), 0, 10.8 * px, h);
    g.fillStyle = 'rgba(60,242,255,.25)'; [-5.9, 4.9].forEach(x => g.fillRect(X(x), 0, 1 * px, h));
    g.fillStyle = 'rgba(230,250,255,.85)'; [-LANE / 2, LANE / 2].forEach(x => g.fillRect(X(x - .07), h - 2 * px, .14 * px, 2 * px));
    grain(g, w, h, .06);
  }},
  farm: {half: 7, per: 3.4, w: 1024, base: '#69B144', draw(g, w, h, px) {
    const X = x => (x + 7) * px;
    g.fillStyle = '#69B144'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9BC25A'; g.fillRect(X(-5.6), 0, 11.2 * px, h);
    g.fillStyle = '#C28C5A'; g.fillRect(X(-5.2), 0, 10.4 * px, h);
    g.fillStyle = 'rgba(140,92,52,.5)'; [-LANE, 0, LANE].forEach(x => [[x - .95, x - .55], [x + .55, x + .95]].forEach(([a, b]) => g.fillRect(X(a), 0, (b - a) * px, h)));
    g.fillStyle = 'rgba(120,170,70,.65)'; [0, 1.7].forEach(z => [-LANE / 2, LANE / 2].forEach(x => g.fillRect(X(x - .1), h - (z + .6) * px, .2 * px, .6 * px)));
    grain(g, w, h, .06);
  }}
};
/** A grain over a ground (light and dark specks). */
function grain(g, w, h, a, cool = false) {
  const r = seeded(Math.round(w + h)), n = Math.round(w * h / 90);
  for (let i = 0; i < n; i++) { g.fillStyle = r() < .5 ? `rgba(0,0,${cool ? 30 : 0},${(a * r()).toFixed(3)})` : `rgba(255,255,255,${(a * r()).toFixed(3)})`; g.fillRect(r() * w, r() * h, 2, 2); }
}
const pow2 = v => 2 ** Math.round(Math.log2(v));
function roadMat(id) {
  const G = style.ground(id, GROUNDS[id]);
  return texMat(style.key() + 'road:' + id, () => {
    const px = G.w / (G.half * 2), h = clamp(pow2(G.per * px), 64, 1024);
    return canvasTex(G.w, h, (g, w, hh) => G.draw(g, w, hh, hh / G.per));
  });
}
const NOISE = () => texOf('noise', () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); grain(g, w, h, .22); }));
function baseMat(id) {
  return texOf(style.key() + 'base:' + id, () => new T.MeshLambertMaterial({color: col(style.ground(id, GROUNDS[id]).base), map: style.enabled() ? null : NOISE()}));
}
/** A flat rectangle on the ground (x0..x1, z0..z1, at height y), its texture laid u across, v along every per yards. */
function plane(mat, x0, x1, z0, z1, y = 0, per = 0, u0 = 0, u1 = 1) {
  const g = new T.PlaneGeometry(1, 1, 1, Math.max(1, Math.ceil((z1 - z0) / 2))); // (in strips along it, to bend)
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv, pa = g.attributes.position;
  // (laid flat, x -.5 to .5 across and z -.5 (far) to .5 (near))
  const vf = per ? z1 / per : 1, vn = per ? z0 / per : 0;
  for (let i = 0; i < pa.count; i++) uv.setXY(i, u0 + (u1 - u0) * (pa.getX(i) + .5), vn + (vf - vn) * (.5 - pa.getZ(i)));
  g.scale(x1 - x0, 1, z1 - z0); g.translate((x0 + x1) / 2, y, -(z0 + z1) / 2);
  const m = new T.Mesh(g, mat);
  m.matrixAutoUpdate = false; m.receiveShadow = true;
  return m;
}

/** A picture laid flat on the ground (w across, d along), its middle at (x, z), turned ry about the up. */
function decal(mat, w, d, x, z, ry) {
  const g = new T.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const m = new T.Mesh(g, mat);
  m.position.set(x, .006, -z); m.rotation.y = ry;
  m.updateMatrix(); m.matrixAutoUpdate = false; m.receiveShadow = true;
  return m;
}
// ============================================================================ The chunks: the ground and the roadside
const CHUNKS = new Map(); // `${course}|${index}` -> Group
function chunk(st, i) {
  const z0 = i * CHUNK, z1 = z0 + CHUNK, zone = R.zoneAt(st.co, z0 + .01), id = zone.theme.id, G = GROUNDS[id], g = new T.Group();
  g.matrixAutoUpdate = false;
  // the ground: the road band, the ground either side out to the horizon
  g.add(plane(roadMat(id), -G.half, G.half, z0, z1, 0, G.per));
  g.add(plane(baseMat(id), -260, -G.half, z0, z1, -.01), plane(baseMat(id), G.half, 260, z0, z1, -.01));
  const b = new Batch(id), lit = new Batch(id);
  GROUND_EXTRA[id] && GROUND_EXTRA[id](g, b, lit, z0, z1, zone, st);
  // what stands beside the road here (the 2D world's list for this place, the bits in this chunk): from the place's
  // models where it has them (return-models.js, once they're in), else the shapes here
  const D = dressList(st, Math.floor(z0 / R.ZONE)), withModels = models.ready(id);
  // (each thing with the chunk its far end is in, so it's kept till all of it's behind you)
  D.list.forEach(o => {
    const at = Math.max(o.z0, o.z1 || o.z0);
    if (at < z0 || at >= z1) return;
    if (models.prop(b, lit, o, id)) return;
    const f = PROPS[o.k];
    if (f) f(b, lit, o, g, st);
    if (style.enabled()) decorate(b, lit, o, g);
  });
  // and what the models add that the 2D world never had
  models.extras(b, lit, id, z0, z1, D.list, `${st.co.n}|${st.co.k}`);
  g.userData.theme = id; g.userData.models = withModels;
  const m = b.mesh(mats().vc), l = lit.mesh(mats().glow);
  if (m) g.add(m);
  if (l) g.add(l);
  g.userData.z0 = z0;
  return g;
}

// The ground's extras, chunk by chunk: the stadium's walls, stands and numbers; the tundra's snowbanks; the desert's
// rails; the beach's sea; the moon's craters and neon edges; the goal-line pylons.
const GROUND_EXTRA = {
  stadium(g, b, lit, z0, z1, zone) {
    // the end zone behind the start, and past each goal line into the stadium again
    const fy = z => ((z % 100) + 100) % 100;
    if (z0 < 0 || (z0 >= 100 && fy(z0) < 10)) g.add(plane(endzoneMat(), -26.67, 26.67, z0, Math.min(z1, z0 < 0 ? 0 : z0 - fy(z0) + 10), .004));
    // the numbers along each side, the logo at midfield
    for (let yd = 10; yd <= 90; yd += 10) {
      const z = zone.z0 + yd;
      if (z < z0 || z >= z1 || z <= 0) continue;
      const n = yd <= 50 ? yd : 100 - yd;
      // (read from the sideline, the tops toward it)
      [-1, 1].forEach(s => g.add(decal(numberMat(n), 3.2, 2.2, s * 18.8, z, -s * Math.PI / 2)));
      if (yd === 50) g.add(midfieldLogo(z));
    }
    // the wall round the field, padded, an ad strip along it; the stands climbing behind it, full
    [-1, 1].forEach(s => {
      b.box('#0E1B45', s * 31, s * 31.6, 0, 1.6, z0, z1);
      b.box('#3EF08F', s * 30.98, s * 30.99, 1.05, 1.25, z0, z1);
      for (let k = 0; k < 9; k++) {
        const x = s * (32 + k * 1.6), y = 1.6 + k * 1.15;
        b.box(k % 3 === 2 ? '#2A3550' : '#1B2440', x, x + s * 1.6, y - 1.15, y, z0, z1);
      }
      g.add(crowd(s, z0, z1));
      if (style.enabled()) {
        // Broad team-color fascia and gold pennants frame the field without filling its lanes.
        b.box('#FFCB39', s * 31, s * 31.65, 1.6, 1.85, z0, z1);
        for (let z = z0 + 5; z < z1; z += 10) {
          b.box('#FFF4D8', s * 31.1, s * 31.2, 2, 5.3, z - .07, z + .07);
          b.add('cone4', '#F15D48', s * 31.15, 4.7, z + .65, .035, 1.25, .65, 0, 0, 0);
        }
      }
      // a light tower every 50 yards
      for (let z = Math.ceil(z0 / 50) * 50 + 25; z < z1; z += 50) {
        const x = s * 47;
        b.cyl('#3A4256', x, 0, 26, z, .35);
        b.box('#2A3142', x - 1.8, x + 1.8, 26, 28.4, z - .2, z + .2);
        for (let a = 0; a < 3; a++) for (let c = 0; c < 4; c++) lit.add('box', '#FFF7E0', x - 1.35 + c * .9, 26.45 + a * .75, z - .25, .7, .55, .05);
      }
    });
  },
  tundra(g, b, lit, z0, z1) {
    // the banks the plow left along the road
    [-1, 1].forEach(s => { b.add('box', '#C8D7E4', s * 5.45, .3, (z0 + z1) / 2, .9, .6, z1 - z0, 0, 0, s * -.5); b.box('#F7FAFD', s * 5.8, s * 7.4, 0, .62, z0, z1); });
  },
  desert(g, b, lit, z0, z1) {
    // the rails, on each lane's ties
    [-LANE, 0, LANE].forEach(x => [-.72, .72].forEach(d => { b.box('#7C828C', x + d - .06, x + d + .06, 0, .12, z0, z1); b.box('#D8DDE3', x + d - .03, x + d + .03, .12, .14, z0, z1); }));
  },
  space(g, b, lit, z0, z1, zone, st) {
    [-1, 1].forEach(s => lit.box('#5CF4FF', s * 5.25, s * 5.45, .01, .05, z0, z1));
    const r = rnd('crater', st.co.n, st.co.k, z0);
    for (let k = 0; k < 4; k++) {
      const s = r() < .5 ? -1 : 1, x = s * (9 + r() * 26), z = z0 + r() * CHUNK, rad = .8 + r() * 2.4;
      b.add('tor', '#7468A4', x, .02, z, rad, rad, rad * 3, Math.PI / 2, 0, 0);
      b.add('cyl', '#433870', x, .005, z, rad * .95, .01, rad * .95);
    }
  },
  beach(g, b, lit, z0, z1) {
    g.add(plane(seaMat(), -260, -17, z0, z1, .02, 12));
    b.box('#EAFBFF', -17.2, -15.8, 0, .025, z0, z1);
  }
};
// The goal line's pylons, at the start of each place.
function pylons(b, z, id) { const x = id === 'stadium' ? 26.67 : 5.6; [-1, 1].forEach(s => b.box('#FF7A1A', s * x - .2, s * x + .2, 0, .55, z - .2, z + .2)); }
const endzoneMat = () => texMat('endzone', () => canvasTex(2048, 512, (g, w, h) => {
  g.fillStyle = '#16357A'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
  g.font = `800 ${h * .62}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = '#FFFFFF'; g.fillStyle = '#C8102E';
  g.strokeText('RETURN MAN', w / 2, h / 2 + 8); g.fillText('RETURN MAN', w / 2, h / 2 + 8);
}, false), {transparent: false});
const numberMat = n => texMat('num:' + n, () => canvasTex(256, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.font = `800 ${h * .95}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText(String(n), w / 2, h / 2 + 6);
}, false), {transparent: true, depthWrite: false});
const logoMat = () => texMat('logo', () => canvasTex(512, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(14,27,69,.9)'; g.beginPath(); g.arc(w / 2, h / 2, w * .48, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3EF08F'; g.lineWidth = 14; g.stroke();
  g.fillStyle = '#7A3B1B'; g.beginPath(); g.ellipse(w / 2, h * .42, w * .22, w * .13, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#F4F0E6'; g.lineWidth = 8; g.beginPath(); g.moveTo(w * .4, h * .42); g.lineTo(w * .6, h * .42); g.stroke();
  g.font = `800 ${h * .16}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#FFFFFF';
  g.fillText('RETURN MAN', w / 2, h * .7);
}, false), {transparent: true, depthWrite: false});
let fieldLogoMaterial = null;
function midfieldLogo(z) {
  const image = fieldLogo.image();
  let mesh;
  if (image) {
    if (!fieldLogoMaterial) {
      const map = canvasTex(image.width, image.height, c => c.drawImage(image, 0, 0), false);
      fieldLogoMaterial = new T.MeshLambertMaterial({map, transparent: true, opacity: fieldLogo.OPACITY, depthWrite: false});
    }
    const width = fieldLogo.WIDTH, depth = width * image.height / image.width;
    // Segments follow the same curved ground as the turf beneath this painted mark.
    mesh = plane(fieldLogoMaterial, -width / 2, width / 2, z - depth / 2, z + depth / 2, .008);
    mesh.name = 'toreadors-midfield-logo';
  } else {
    mesh = decal(logoMat(), 6.4, 6.4, 0, z, 0);
    mesh.name = 'return-man-midfield-logo';
  }
  mesh.userData.fieldLogoZ = z;
  return mesh;
}
function refreshFieldLogos() {
  const old = fieldLogoMaterial;
  fieldLogoMaterial = null;
  for (const {obj} of LIVE.values()) {
    const logos = [];
    obj.traverse(o => { if (o.userData.fieldLogoZ != null) logos.push(o); });
    logos.forEach(o => {
      const parent = o.parent;
      parent.remove(o); o.geometry.dispose();
      parent.add(bend(midfieldLogo(o.userData.fieldLogoZ)));
    });
  }
  if (old) { old.map.dispose(); old.dispose(); }
}
const seaMat = () => texOf('m:sea', () => {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#22AFD3'; g.fillRect(0, 0, w, h);
    const r = seeded(9);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${(.12 + r() * .25).toFixed(2)})`; g.fillRect(r() * w, r() * h, 10 + r() * 30, 2); }
  });
  t.repeat.set(8, 1);
  return new T.MeshLambertMaterial({map: t, color: 0xFFFFFF});
});
// The stadium's crowd: a long strip of faces and colours, up the stands (from the top of the wall, 32 yards out, up
// nine rows each 1.6 out and 1.15 up), its picture repeating every 12 yards along them.
function crowd(s, z0, z1) {
  const mat = texOf('m:crowd', () => new T.MeshLambertMaterial({side: T.DoubleSide, map: texOf('crowd', () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#1B2440'; g.fillRect(0, 0, w, h);
    const r = seeded(17), C = ['#C8102E', '#1D3F8F', '#FFFFFF', '#F2C230', '#2E6B4F', '#E8E8EC', '#F28C28', '#5E2A84'];
    for (let row = 0; row < 16; row++) for (let x = 0; x < w; x += 7 + r() * 4) {
      const y = row * h / 16 + 4 + r() * 3;
      g.fillStyle = C[Math.floor(r() * C.length)]; g.fillRect(x, y + 6, 6, 7);
      g.fillStyle = ['#8A5A36', '#C68C5E', '#E2B48A', '#5E3B22'][Math.floor(r() * 4)]; g.beginPath(); g.arc(x + 3, y + 3, 3, 0, Math.PI * 2); g.fill();
    }
  }))}));
  const xi = s * 32, xo = s * (32 + 9 * 1.6), yi = 1.62, yo = 1.62 + 9 * 1.15, geo = new T.BufferGeometry();
  // (in 5-yard strips along the stands, to bend)
  const n = Math.max(1, Math.ceil((z1 - z0) / 5)), pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * i / n;
    pos.push(xi, yi, -z, xo, yo, -z); uv.push(z / 12, 0, z / 12, 3);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new T.Mesh(geo, mat);
  m.matrixAutoUpdate = false;
  return m;
}

// ============================================================================ The roadside
// Each of the 2D world's things (o: {k, s (side), x, z0, z1, h, col...}), built in 3D where it stands. b: the chunk's
// batch; lit: its batch of lights (unlit, bright).
const CARS = ['#C8102E', '#1D3F8F', '#E8E8EC', '#2A2D33', '#7B8794', '#B98A2F', '#2E6B4F', '#5E2A84'];
const dark = (hex, k) => { const c = col(hex).clone().multiplyScalar(k); return '#' + c.getHexString(); };
/** A wheel standing at (x, z), radius r, w wide, its axle along x (rolling along the road) or z (parked across it). */
function wheel(b, x, z, r, w = .3, hub = '#9AA1AB', axis = 'x') {
  const rx = axis === 'z' ? Math.PI / 2 : 0, rz = axis === 'x' ? Math.PI / 2 : 0;
  b.add('cyl', '#15181D', x, r, z, r, w, r, rx, 0, rz);
  b.add('cyl', hub, x, r, z, r * .45, w * 1.05, r * .45, rx, 0, rz);
}
const PROPS = {
  car(b, lit, o) {
    // parked nose to the road
    const s = o.s, xi = s * 6.5, xo = s * 11.3, h = o.h, ch = o.suv ? .75 : .55, z = (o.z0 + o.z1) / 2;
    b.box(o.col, xi, xo, .25, h, o.z0, o.z1);
    b.box('#1C2530', s * (o.suv ? 7.2 : 7.7), s * (o.suv ? 10.9 : 10.1), h, h + ch, o.z0 + .1, o.z1 - .1);
    b.box(dark(o.col, 1.1), s * (o.suv ? 7.25 : 7.75), s * (o.suv ? 10.85 : 10.05), h + ch, h + ch + .06, o.z0 + .12, o.z1 - .12);
    [s * 7.4, s * 10.4].forEach(x => [o.z0 + .05, o.z1 - .05].forEach(zz => wheel(b, x, zz, .36, .25, '#9AA1AB', 'z')));
    lit.box('#FFF6D6', xi - s * .02, xi, .55, .7, o.z0 + .15, o.z0 + .45); lit.box('#FFF6D6', xi - s * .02, xi, .55, .7, o.z1 - .45, o.z1 - .15);
    void z;
  },
  tent(b, lit, o) {
    const x = o.s * (o.x + 1.7), z = (o.z0 + o.z1) / 2;
    [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([dx, dz]) => b.cyl('#C9CDD4', x + dx, 0, 3.1, z + dz, .05));
    b.add('cone4', o.col, x, 3.55, z, 2.4, .9, 2.4, 0, Math.PI / 4, 0);
    for (let i = 0; i < 6; i++) b.box(i % 2 ? '#FFFFFF' : o.col, x - 1.7 + i * .57, x - 1.13 + i * .57, 2.8, 3.1, o.z0 - .02, o.z0);
  },
  pole(b, lit, o) {
    const x = o.s * 5.9;
    b.cyl('#2B2F38', x, 0, 9, o.z0, .1);
    b.box('#2B2F38', x, x - o.s * .8, 8.9, 9.05, o.z0 - .05, o.z0 + .05);
    lit.box('#FFF4D8', x - o.s * .35, x - o.s * 1.15, 8.8, 8.92, o.z0 - .3, o.z0 + .3);
  },
  bldg(b, lit, o, g) {
    const xi = o.s * o.x, xo = o.s * Math.max(o.x + 8, 22);
    g.add(windowsBox(o.col, xi, xo, 0, o.h, o.z0, o.z1));
    b.box(dark(o.col, .8), xi - o.s * .1, xo, o.h, o.h + .5, o.z0 - .1, o.z1 + .1);
    b.box('#1E242E', xi - o.s * .02, xi, 0, 2.3, o.z0 + .3, o.z1 - .3);
    if (o.awn) b.add('box', o.awn, xi - o.s * .7, 2.6, (o.z0 + o.z1) / 2, 1.4, .12, o.z1 - o.z0 - .6, 0, 0, o.s * .35);
  },
  lamp(b, lit, o) {
    const x = o.s * 6.1;
    b.cyl('#30353D', x, 0, 6.5, o.z0, .09);
    b.box('#30353D', x, x - o.s * 1.4, 6.45, 6.6, o.z0 - .05, o.z0 + .05);
    lit.box('#FFF3D0', x - o.s * 1.05, x - o.s * 1.5, 6.32, 6.45, o.z0 - .18, o.z0 + .18);
    if (o.flag) { b.box(o.flag, x - o.s * .1, x - o.s * 1, 3.6, 5.9, o.z0 - .02, o.z0 + .02); b.box('#FFFFFF', x - o.s * .15, x - o.s * .95, 5.7, 5.8, o.z0 - .03, o.z0 + .03); }
  },
  palm(b, lit, o) {
    const x = o.s * o.x, h = o.h, lean = -o.s * .1;
    for (let k = 0; k < 6; k++) { const u = (k + .5) / 6; b.add('cyl', k % 2 ? '#8A6440' : '#9C7450', x + lean * h * u * u, h * u, o.z0, .17 - .04 * u, h / 6 + .05, .17 - .04 * u, 0, 0, -lean * 1.2 * u); }
    const tx = x + lean * h, top = h;
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; b.add('sph', k % 2 ? '#2E8B44' : '#3FA455', tx + Math.cos(a) * 1.3, top - .35, o.z0 + Math.sin(a) * 1.3, 1.6, .16, .45, 0, -a, -.45); }
    b.add('sph', '#6B4A2A', tx, top - .2, o.z0, .3, .3, .3);
  },
  hydrant(b, lit, o) { const x = o.s * o.x; b.cyl('#C8102E', x, 0, .7, o.z0, .16); b.add('sph', '#C8102E', x, .72, o.z0, .17, .13, .17); b.add('cyl', '#E9EEF3', x, .45, o.z0, .07, .5, .07, 0, 0, Math.PI / 2); },
  pine(b, lit, o) {
    const x = o.s * o.x, h = o.h;
    b.cyl('#5A4030', x, 0, h * .25, o.z0, .2);
    [[.18, .36, .42], [.42, .28, .34], [.64, .2, .3]].forEach(([y, w, th]) => {
      b.add('cone', '#2E5A45', x, h * (y + th / 2), o.z0, h * w, h * th, h * w);
      b.add('cone', '#F2F7FA', x, h * (y + th * .78), o.z0, h * w * .45, h * th * .45, h * w * .45);
    });
  },
  fence(b, lit, o) {
    const x = o.s * o.x;
    b.box('#F26C26', x - .03, x + .03, .15, 1.15, o.z0, o.z1);
    for (let z = o.z0; z <= o.z1; z += 2.5) b.box('#6B4A33', x - .07, x + .07, 0, 1.3, z - .07, z + .07);
  },
  snowman(b, lit, o) {
    const x = o.s * o.x;
    [[.5, .5], [1.25, .36], [1.78, .26]].forEach(([y, r]) => b.add('sph', '#F7FAFD', x, y, o.z0, r, r, r));
    b.cyl('#1A1D22', x, 2.02, 2.3, o.z0, .2); b.cyl('#1A1D22', x, 2, 2.05, o.z0, .32);
    b.add('cone', '#F07A1E', x, 1.8, o.z0 - .3, .05, .3, .05, -Math.PI / 2, 0, 0);
    b.add('tor', '#C8102E', x, 1.5, o.z0, .3, .3, .5, Math.PI / 2, 0, 0);
  },
  cactus(b, lit, o) {
    const x = o.s * o.x, h = o.h, w = h * .09, f = o.flip ? -1 : 1;
    b.cyl('#3E8E4A', x, 0, h, o.z0, w); b.add('sph', '#3E8E4A', x, h, o.z0, w, w, w);
    [[f, .42, .62], [-f, .58, .5]].forEach(([d, y, len]) => {
      const ax = x + d * h * .2;
      b.add('cyl', '#3E8E4A', x + d * h * .1, h * y, o.z0, w * .7, h * .2, w * .7, 0, 0, Math.PI / 2);
      b.cyl('#3E8E4A', ax, h * y, h * (y + len * .45), o.z0, w * .7); b.add('sph', '#3E8E4A', ax, h * (y + len * .45), o.z0, w * .7, w * .7, w * .7);
    });
  },
  rock(b, lit, o) { const x = o.s * o.x; b.add('rock', '#B9784A', x, o.h * .4, o.z0, o.h * .9, o.h * .6, o.h * .8, .3, o.z0, .2); },
  post(b, lit, o) { const x = o.s * o.x; b.cyl('#7A5233', x, 0, 7.5, o.z0, .09); b.box('#7A5233', x - 1, x + 1, 6.9, 7.05, o.z0 - .05, o.z0 + .05); },
  facade(b, lit, o, g) {
    const xi = o.s * o.x, xo = o.s * (o.x + 7), top = o.h + 1.6;
    b.box(o.col, xi, xo, 0, o.h, o.z0, o.z1);
    b.box(o.col, xi, xi + o.s * .3, o.h, top, o.z0 + .3, o.z1 - .3);
    b.box('#7A3E26', xi - o.s * .9, xi, 2.6, 2.9, o.z0, o.z1);
    b.box('#9C6A44', xi - o.s * 1.2, xi, 0, .2, o.z0, o.z1);
    [o.z0 + .4, o.z1 - .4].forEach(z => b.cyl('#6B4A33', xi - o.s * .85, 0, 2.6, z, .07));
    b.box('#3A2418', xi - o.s * .02, xi, .2, 2.3, (o.z0 + o.z1) / 2 - .6, (o.z0 + o.z1) / 2 + .6);
    g.add(sign(o.name, '#F3E2B8', '#5A2E1A', xi - o.s * .32, o.h + .8, (o.z0 + o.z1) / 2, Math.min(5, o.z1 - o.z0 - 1), 1, o.s));
  },
  tower(b, lit, o) {
    const x = o.s * o.x, z = o.z0;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => b.add('cyl', '#6B4A33', x + dx * 1.1, 4, z + dz * 1.1, .12, 8.2, .12, dz * .08, 0, -dx * .08));
    b.cyl('#9A6B42', x, 8, 11, z, 1.8); b.add('cone', '#6B4A33', x, 11.5, z, 2, 1, 2);
  },
  pennant(b, lit, o) { const x = o.s * o.x; b.cyl('#9AA1AB', x, 0, 4, o.z0, .05); b.add('cone4', o.col, x - o.s * .5, 3.55, o.z0, .45, 1, .04, 0, 0, o.s * Math.PI / 2); },
  wheel(b, lit, o) { const x = o.s * o.x; b.add('tor', '#6B4A33', x, .75, o.z0, .7, .7, .9, 0, Math.PI / 2 * .2, .25); },
  barrel(b, lit, o) { const x = o.s * o.x; b.cyl('#8A5A30', x, 0, 1.1, o.z0, .42); [.2, .9].forEach(y => b.add('tor', '#3A3A3A', x, y, o.z0, .43, .43, .3, Math.PI / 2, 0, 0)); },
  stall(b, lit, o) {
    const xi = o.s * o.x, xo = o.s * (o.x + 3.4), z0 = o.z0, z1 = o.z1;
    b.box('#B07A48', xi, xi + o.s * 1.3, 0, 1, z0, z1);
    b.box('#C98A4E', xi - o.s * .05, xi + o.s * 1.35, .98, 1.08, z0 - .05, z1 + .05);
    o.goods.forEach((k, i) => {
      const [c1, c2] = GOODS_COL[k], zz = z0 + .35 + i * (z1 - z0 - .7) / 2;
      for (let j = 0; j < 5; j++) b.add('ball', j % 2 ? c1 : c2, xi + o.s * (.3 + (j % 3) * .35), 1.18 + (j > 2 ? .14 : 0), zz + (j - 2) * .14, .15, .15, .15);
    });
    [z0 + .1, z1 - .1].forEach(z => [xi + o.s * .1, xo].forEach(x => b.cyl('#6B4A33', x, 0, 2.75, z, .05)));
    for (let k = 0; k < 6; k++) { const za = z0 + k * (z1 - z0) / 6; b.add('box', k % 2 ? o.awn[1] : o.awn[0], (xi + xo) / 2 - o.s * .2, 2.85, za + (z1 - z0) / 12, Math.abs(xo - xi) + .6, .1, (z1 - z0) / 6, 0, 0, o.s * .18); }
  },
  house(b, lit, o, g) {
    const xi = o.s * o.x, xo = o.s * (o.x + 8);
    b.box(o.col, xi, xo, 0, o.h, o.z0, o.z1);
    b.add('prism', o.roof, (xi + xo) / 2, o.h, (o.z0 + o.z1) / 2, 8.6, 2.6, o.z1 - o.z0 + .4, 0, Math.PI / 2 * 0, 0);
    for (let y = 1.5; y < o.h - 1.2; y += 2.4) for (let z = o.z0 + .9; z < o.z1 - 1.2; z += 2.4) {
      b.box('#283448', xi - o.s * .03, xi, y, y + 1.2, z, z + 1);
      b.box(o.shut, xi - o.s * .05, xi, y, y + 1.2, z - .32, z - .02); b.box(o.shut, xi - o.s * .05, xi, y, y + 1.2, z + 1.02, z + 1.32);
    }
    void g;
  },
  lamp2(b, lit, o) { const x = o.s * o.x; b.cyl('#2A2D33', x, 0, 3.6, o.z0, .07); b.add('sph', '#2A2D33', x, 3.7, o.z0, .2, .12, .2); lit.add('sph', '#FFE9B0', x, 3.45, o.z0, .17, .22, .17); },
  bunting(b, lit, o) {
    for (let k = 0; k < 18; k++) { const x = -7 + k * .82, y = 5.6 - Math.sin(Math.PI * k / 17) * .6; b.add('cone4', ['#D8392B', '#F2C230', '#2E9E4F', '#2C6FD1'][k % 4], x, y - .25, o.z0, .25, .5, .02, Math.PI, 0, 0); }
    [-7.3, 7.3].forEach(x => b.cyl('#6B4A33', x, 0, 5.8, o.z0, .08));
  },
  rope(b, lit, o) {
    const x = o.s * o.x;
    for (let z = o.z0; z <= o.z1; z += 3) { b.cyl('#B07A48', x, 0, .9, z, .08); if (z + 3 <= o.z1) b.box('#E9D6A8', x - .025, x + .025, .78, .82, z, z + 3); }
  },
  hut(b, lit, o) {
    const x = o.s * o.x;
    b.box(o.col, x - 1.2, x + 1.2, 0, 2.3, o.z0 - 1.2, o.z0 + 1.2);
    b.add('prism', '#FFFFFF', x, 2.3, o.z0, 2.8, .8, 2.8);
    b.box('#3A2A1A', x - o.s * 1.21, x - o.s * 1.2, .2, 1.9, o.z0 - .4, o.z0 + .4);
  },
  umbrella(b, lit, o) { const x = o.s * o.x; b.cyl('#E9EEF3', x, 0, 2.2, o.z0, .04); b.add('cone', o.col, x, 2.35, o.z0, 1.3, .5, 1.3); b.add('box', '#FFFFFF', x + .9, .08, o.z0, 1.6, .08, .7); },
  surf(b, lit, o) { const x = o.s * o.x; b.add('sph', o.col, x, 1, o.z0, .24, 1.05, .07, 0, 0, o.s * .12); },
  lifeguard(b, lit, o) {
    const x = o.s * o.x;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => b.cyl('#E9EEF3', x + dx * .9, 0, 2.6, o.z0 + dz * .9, .07));
    b.box('#F2C230', x - 1.2, x + 1.2, 2.6, 4.2, o.z0 - 1.1, o.z0 + 1.1);
    b.add('prism', '#C8102E', x, 4.2, o.z0, 2.8, .8, 2.6);
    b.box('#C8102E', x - .9, x + .9, 3, 3.5, o.z0 - 1.12, o.z0 - 1.1);
  },
  dome(b, lit, o) {
    const x = o.s * o.x, w = o.w;
    b.add('hemi', '#DCE2EE', x, 0, o.z0, w, w * .55, w);
    b.add('tor', '#9AA6C0', x, .02, o.z0, w, w, 1, Math.PI / 2, 0, 0);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; lit.add('box', '#5CF4FF', x + Math.cos(a) * w * .8, w * .3, o.z0 + Math.sin(a) * w * .8, .5, .22, .05, 0, -a + Math.PI / 2, 0); }
  },
  dish(b, lit, o) { const x = o.s * o.x; b.cyl('#9AA6C0', x, 0, 2.3, o.z0, .15); b.add('hemi', '#E9EEF3', x, 2.4, o.z0, 1.5, .55, 1.5, Math.PI + .5 * o.s, 0, 0); },
  rocket(b, lit, o) {
    const x = o.s * o.x;
    b.cyl('#F1F3F7', x, 0, 12, o.z0, 1); b.add('cone', '#C8102E', x, 13.4, o.z0, 1, 2.8, 1);
    [0, 1, 2].forEach(k => { const a = k / 3 * Math.PI * 2; b.add('box', '#C8102E', x + Math.cos(a) * 1.2, 1.5, o.z0 + Math.sin(a) * 1.2, .9, 3, .12, 0, -a, 0); });
    b.add('cyl', '#25356E', x, 7, o.z0, 1.02, 1.2, 1.02);
  },
  spire(b, lit, o) { const x = o.s * o.x; b.add('cone', '#B78CFF', x, o.h / 2, o.z0, .5, o.h, .5); lit.add('cone', '#E8D8FF', x, o.h * .85, o.z0, .15, o.h * .3, .15); },
  beacon(b, lit, o) { const x = o.s * o.x; b.cyl('#565C70', x, 0, 1.5, o.z0, .07); lit.add('sph', '#5CF4FF', x, 1.65, o.z0, .16, .16, .16); },
  fence2(b, lit, o) {
    const x = o.s * o.x;
    [.5, 1].forEach(y => b.box('#E9E2D2', x - .04, x + .04, y, y + .14, o.z0, o.z1));
    for (let z = o.z0; z <= o.z1; z += 2.4) b.box('#D9D0BC', x - .07, x + .07, 0, 1.25, z - .07, z + .07);
  },
  corn(b, lit, o, g) {
    const xi = o.s * o.x, xo = o.s * 40;
    g.add(cornWall(xi, xo, o.z0, o.z1, o.s));
    b.box('#4E8A33', Math.min(xi, xo), Math.max(xi, xo), 2.25, 2.3, o.z0, o.z1);
  },
  barn(b, lit, o) {
    const xi = o.s * o.x, xo = o.s * (o.x + 8), h = o.h, zc = (o.z0 + o.z1) / 2;
    b.box('#B2362A', xi, xo, 0, h, o.z0, o.z1);
    b.add('prism', '#5A3B2E', (xi + xo) / 2, h, zc, 8.6, 3, o.z1 - o.z0 + .4);
    b.box('#F3E6C8', xi - o.s * .03, xi, 0, 3.4, zc - 1.6, zc + 1.6);
    b.add('box', '#B2362A', xi - o.s * .04, 1.7, zc, .02, 3.6, .25, 0, 0, 0);
    [[1, 1], [1, -1]].forEach(([, d]) => b.add('box', '#F3E6C8', xi - o.s * .05, 1.7, zc, .02, .2, 4.4, d * .75, 0, 0));
  },
  silo(b, lit, o) { const x = o.s * o.x; b.cyl('#C9CED6', x, 0, 9, o.z0, 1.6); b.add('hemi', '#9AA1AB', x, 9, o.z0, 1.6, 1.2, 1.6); [3, 6].forEach(y => b.add('tor', '#9AA1AB', x, y, o.z0, 1.62, 1.62, .4, Math.PI / 2, 0, 0)); },
  windmill(b, lit, o, g) {
    const x = o.s * o.x;
    b.add('cone4', '#E9E2D2', x, 5, o.z0, 1.2, 10, 1.2, 0, Math.PI / 4, 0);
    const blades = new Batch();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; blades.add('box', '#F3E6C8', -1.7 * Math.sin(a), 1.7 * Math.cos(a), 0, .5, 3.4, .06, 0, 0, a); }
    const m = blades.mesh(mats().vc);
    m.position.set(x, 10, -(o.z0 - .8)); m.matrixAutoUpdate = true; m.userData.spin = .9;
    g.add(m);
  },
  bale(b, lit, o) { const x = o.s * o.x; b.add('cyl', '#E3BE5A', x, .7, o.z0, .7, 1.3, .7, 0, 0, Math.PI / 2); b.add('cyl', '#C9A245', x, .7, o.z0, .55, 1.32, .55, 0, 0, Math.PI / 2); },
  tractor(b, lit, o) {
    const x = o.s * o.x, z = o.z0;
    b.box('#3E8E3A', x - .8, x + .8, .6, 1.6, z - 1.6, z + 1);
    b.box('#2A2F38', x - .7, x + .7, 1.6, 2.9, z - .2, z + 1);
    b.box('#9ED0F0', x - .72, x + .72, 1.9, 2.7, z - .22, z - .2);
    [-1, 1].forEach(d => { wheel(b, x + d * .9, z + .7, .8, .45, '#F2C230'); wheel(b, x + d * .85, z - 1.1, .48, .35, '#F2C230'); });
  },
  sunflower(b, lit, o) { const x = o.s * o.x; b.cyl('#3E8E3A', x, 0, o.h, o.z0, .04); b.add('cyl', '#F2C230', x, o.h, o.z0 - .05, .35, .05, .35, Math.PI / 2, 0, 0); b.add('cyl', '#5A3B2E', x, o.h, o.z0 - .08, .15, .05, .15, Math.PI / 2, 0, 0); }
};
/** A building's face of windows (a texture), and its body. */
function windowsBox(hex, x0, x1, y0, y1, z0, z1) {
  const arcade = style.enabled();
  const mat = texOf(style.key() + 'm:bldg:' + hex, () => new T.MeshLambertMaterial({color: col(arcade ? '#FFFFFF' : hex), map: texOf(style.key() + 'windows:' + (arcade ? hex : ''), () => canvasTex(128, 128, (g, w, h) => {
    if (arcade) {
      const tones = ['#F4CE8E', '#F29875', '#71BDB5', '#F0DCA9', '#DB9B82'];
      g.fillStyle = tones[hashOf(hex) % tones.length]; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.fillStyle = '#FFF1D4'; g.fillRect(x * 64 + 9, y * 64 + 8, 46, 49);
        g.fillStyle = '#32616D'; g.fillRect(x * 64 + 13, y * 64 + 12, 38, 38);
        g.fillStyle = '#81BDC3'; g.fillRect(x * 64 + 17, y * 64 + 15, 30, 7);
      }
      return;
    }
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
    const r = seeded(3);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const lit = r() < .3; g.fillStyle = lit ? '#FFE6A8' : '#3A4E66'; g.fillRect(x * 64 + 14, y * 64 + 12, 36, 40); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x * 64 + 14, y * 64 + 12, 36, 6); }
  }))}));
  const geo = new T.BoxGeometry(Math.abs(x1 - x0), y1 - y0, z1 - z0, 1, 1, Math.max(1, Math.ceil(Math.abs(z1 - z0) / 5)));
  // (the windows every 2.2 yards up and 2.4 along, on every face)
  const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const a = nx > .5 ? pos.getZ(i) + (z1 - z0) / 2 : pos.getX(i) + Math.abs(x1 - x0) / 2, bb = ny > .5 ? 0 : pos.getY(i) + (y1 - y0) / 2;
    uv.setXY(i, a / 4.8, bb / 4.4);
  }
  const m = new T.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -(z0 + z1) / 2);
  m.updateMatrix(); m.matrixAutoUpdate = false;
  return m;
}
/** The corn: a wall of stalks out to the field's edge. */
function cornWall(x0, x1, z0, z1, s) {
  const mat = texMat('corn', () => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#3E7A2C'; g.fillRect(0, 0, w, h);
    const r = seeded(13);
    for (let x = 0; x < w; x += 6) { g.fillStyle = r() < .5 ? '#4F9A38' : '#5FAF45'; g.fillRect(x, 10 + r() * 20, 3, h); }
    for (let i = 0; i < 40; i++) { g.fillStyle = '#F2C94C'; g.fillRect(r() * w, 30 + r() * 60, 4, 12); }
    for (let i = 0; i < 60; i++) { g.fillStyle = '#7CCB5E'; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + 14, y - 8); g.lineTo(x + 2, y + 2); g.fill(); }
  }));
  const geo = new T.PlaneGeometry(z1 - z0, 2.3, Math.max(1, Math.ceil(Math.abs(z1 - z0) / 5)), 1);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (z0 + uv.getX(i) * (z1 - z0)) / 4, uv.getY(i));
  const m = new T.Mesh(geo, mat);
  m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  m.position.set(x0, 1.15, -(z0 + z1) / 2);
  m.updateMatrix(); m.matrixAutoUpdate = false;
  void x1;
  return m;
}
/** A sign with words on it, facing the road (s: the side it's on), w yards long, h tall, its middle at (x, y, z). */
function sign(text, bg, ink, x, y, z, w, h, s) {
  const mat = texMat('sign:' + text + bg + ink, () => canvasTex(512, 128, (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = ink; g.lineWidth = 8; g.strokeRect(6, 6, cw - 12, ch - 12);
    g.fillStyle = ink; g.font = `800 ${ch * .62}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 4, cw - 40);
  }, false));
  const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  m.position.set(x, y, -z);
  m.updateMatrix(); m.matrixAutoUpdate = false;
  return m;
}

// ============================================================================ In the lanes
// Each a group of its own, built when it comes up, kept while it's in view (by its key).
const LIVE = new Map(); // key -> {obj, seen}
let styleMode = null, styleSubscribed = false;
function syncStyle() {
  const next = style.enabled();
  if (styleMode === next) return;
  styleMode = next;
  for (const [key, entry] of LIVE) {
    ROOT.remove(entry.obj);
    if (key.startsWith('c:') || key.startsWith('v:')) entry.obj.traverse(o => { if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); });
    else if (key.startsWith('g:')) entry.obj.traverse(o => { if (o.userData.own) o.geometry.dispose(); });
  }
  LIVE.clear();
  if (FAR_GROUND) FAR_GROUND.visible = false;
  style.clear();
}
// Readiness and profile changes must replace cached vehicles, even with the game view hidden.
function refreshCityBuses() {
  for (const [key, entry] of LIVE) {
    if (!entry.obj.userData.cityBus) continue;
    ROOT.remove(entry.obj);
    entry.obj.traverse(o => { if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); });
    LIVE.delete(key);
  }
}
function keep(key, make, may = true) {
  let e = LIVE.get(key);
  if (!e) { if (!may) return null; const obj = make(); if (!obj) return null; ROOT.add(bend(obj)); e = {obj}; LIVE.set(key, e); }
  e.seen = FRAME;
  return e.obj;
}
let FRAME = 0, FAR_GROUND = null, MODELS_SEEN = 0;
/** Lets go of what was built without its place's models (in since) from z yards on, to be built again with them. */
function renew(from) {
  for (const [k, e] of LIVE) {
    const u = e.obj.userData;
    if (u.models !== false || !models.ready(u.theme) || !(u.z0 >= from)) continue;
    ROOT.remove(e.obj);
    e.obj.traverse(o => { if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); });
    LIVE.delete(k);
  }
}
/** Everything built before its place's models came in, built again with them (the environment checks' still frames). */
export const renewScenery = () => renew(-Infinity);
/** Whether a place's scenery models are in (or never will be: then it's built as it always was). */
export const sceneryReady = id => models.ready(id) || models.failed(id);
// ---------------------------------------------------------------- The barricades and banners
const OBJ = new Map();
function obstacleOf(type, id) {
  const key = type + ':' + id;
  if (OBJ.has(key)) return OBJ.get(key);
  const [a, b] = OBS[id] || OBS.stadium, g = new T.Group(), parts = new Batch();
  if (type === 'hole') {
    // a pothole (each place's own: return-world.js HOLE_COL): its broken edge and its dark inside, flat in the road
    const [rim, deep] = HOLE_COL[id] || HOLE_COL.city;
    const m = new T.MeshLambertMaterial({transparent: true, depthWrite: false, map: texOf('hole:' + id, () => canvasTex(256, 144, (c2, w, h) => {
      const blob = (k, col) => { c2.fillStyle = col; c2.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI * 2, q = 1 + .09 * Math.sin(3 * t) + .05 * Math.cos(5 * t); c2.lineTo(w / 2 + Math.cos(t) * q * w * .48 * k, h / 2 + Math.sin(t) * q * h * .48 * k); } c2.fill(); };
      blob(1, rim); blob(.82, deep); blob(.52, 'rgba(0,0,0,.4)');
    }, false))});
    const d = decal(m, 2.3, 2.1, 0, 0, 0);
    d.position.y = .014; d.updateMatrix(); d.userData.shared = true;
    g.add(d);
    OBJ.set(key, g);
    return g;
  }
  if (type === 'sled') {
    // a tackling sled: the skid, its bar, and two pads standing up on it in the place's colours
    parts.add('box', '#2B2F36', 0, .08, 0, 2.5, .16, 1.1);
    parts.add('box', '#545B66', 0, .37, .3, 2.2, .1, .1);
    [-.6, .6].forEach(x => {
      parts.add('box', a, x, .91, -.05, .72, 1.42, .6);
      parts.add('box', b, x, 1.05, -.05, .74, .14, .62);
    });
  }
  else if (type === 'hurdle') {
    [-1.02, 1.02].forEach(e => { parts.add('box', '#2B2F36', e, .45, -.12, .1, .95, .1, -.22, 0, 0); parts.add('box', '#2B2F36', e, .45, .12, .1, .95, .1, .22, 0, 0); });
    const board = new T.Mesh(new T.BoxGeometry(2.34, .42, .1), new T.MeshLambertMaterial({map: texOf('stripes:' + a + b, () => canvasTex(256, 64, (c2, w, h) => {
      c2.fillStyle = b; c2.fillRect(0, 0, w, h); c2.fillStyle = a;
      for (let x = -64; x < w + 64; x += 42) { c2.beginPath(); c2.moveTo(x, h); c2.lineTo(x + 21, h); c2.lineTo(x + 45, 0); c2.lineTo(x + 24, 0); c2.fill(); }
    }, false))}));
    board.position.set(0, .79, 0); board.castShadow = true; g.add(board);
    const lamp = new T.Mesh(new T.SphereGeometry(.08, 10, 8), new T.MeshBasicMaterial({color: 0xFFC23A, toneMapped: false}));
    [-.98, .98].forEach(x => { const l = lamp.clone(); l.position.set(x, 1.08, 0); l.userData.blink = true; g.add(l); });
  } else {
    [-1.4, 1.4].forEach(x => { parts.add('cyl', '#8E98A4', x, 1.35, 0, .05, 2.7, .05); parts.add('sph', '#E9EDF1', x, 2.72, 0, .08, .08, .08); });
    // (the place's colour, trimmed top and bottom in the other: no words on it, the owner's ask, Oct 25 2026)
    const ban = new T.Mesh(new T.BoxGeometry(2.72, 1.21, .04), new T.MeshLambertMaterial({map: texOf('banner:' + id, () => canvasTex(512, 228, (c2, w, h) => {
      c2.fillStyle = a; c2.fillRect(0, 0, w, h);
      c2.fillStyle = b; c2.fillRect(0, 0, w, 16); c2.fillRect(0, h - 16, w, 16);
    }, false))}));
    ban.position.set(0, 1.845, 0); ban.castShadow = true; g.add(ban);
  }
  const pm = parts.mesh(mats().vcs); pm.castShadow = true; g.add(pm);
  OBJ.set(key, g);
  return g;
}
// ---------------------------------------------------------------- The cones before the potholes
// A bright orange traffic cone (core/return.js CONE: no obstacle, knocked flying when he runs through it, its size) on
// a dark foot (orange underneath, for when it tumbles), two white reflective bands round it, a little glow in the
// orange so it's seen coming on the pale places; one mesh coloured by its faces (one draw, and one for its shadow),
// lit and shadowed like the barricades, bent with the world (keep()).
const CONE_COL = {body: 0xFF6A12, band: 0xFFFFFF, foot: 0x2F343B, under: 0xFF6A12};
function coneObj() {
  if (OBJ.has('cone')) return OBJ.get('cone');
  const {h: H, r: B, foot: FT} = R.CONE, fh = .06, pos = [], nor = [], cols = [], c = new T.Color();
  const body = new T.CylinderGeometry(.045, B, H - fh, 20, 25).toNonIndexed(), foot = new T.BoxGeometry(FT, fh, FT).toNonIndexed();
  body.translate(0, fh + (H - fh) / 2, 0); foot.translate(0, fh / 2, 0);
  const band = y => (y > H * .36 && y < H * .47) || (y > H * .64 && y < H * .74);
  [[body, y => (band(y) ? 'band' : 'body')], [foot, (y, ny) => (ny < -.5 ? 'under' : 'foot')]].forEach(([g, pick]) => {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 9) {
      c.set(CONE_COL[pick((p[i + 1] + p[i + 4] + p[i + 7]) / 3, (n[i + 1] + n[i + 4] + n[i + 7]) / 3)]);
      for (let j = 0; j < 9; j++) { pos.push(p[i + j]); nor.push(n[i + j]); }
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
    }
    g.dispose();
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  geo.computeBoundingSphere();
  const m = new T.Mesh(geo, new T.MeshStandardMaterial({vertexColors: true, roughness: .45, metalness: 0, emissive: 0xFF5A10, emissiveIntensity: .18}));
  m.castShadow = true; m.receiveShadow = true; m.userData.shared = true;
  OBJ.set('cone', m);
  return m;
}
// ---------------------------------------------------------------- The power-ups
const HALO = {salts: 0x96E1FF, pills: 0xFFA53C, booze: 0xFFD65A};
// On the hard course (the owner's, Oct 2026: bigger and easy to tell apart): each its own colour, ice blue, red and
// green, BIG times the size, and a beam of its light standing up out of it to spot from far off.
const HALO_BIG = {salts: 0x5CE1FF, pills: 0xFF4040, booze: 0x6EF05A}, BIG = 1.7;
function itemOf(kind, big = false) {
  if (features.available()) return arcadeItemOf(kind);
  const key = 'item:' + kind + (big ? ':big' : '');
  if (OBJ.has(key)) return OBJ.get(key);
  const g = new T.Group(), spin = new T.Group(), b = new Batch();
  if (kind === 'salts') {
    b.cyl('#FFFFFF', 0, -.3, .25, 0, .13); b.cyl('#18A35A', 0, -.08, .08, 0, .135); b.cyl('#E9EEF3', 0, .25, .34, 0, .08);
  } else if (kind === 'pills') {
    b.cyl('#F28C28', 0, -.25, .2, 0, .2); b.cyl('#FFFFFF', 0, .2, .34, 0, .23); b.cyl('#FFFFFF', 0, -.1, .1, 0, .205);
  } else {
    b.cyl('#7A3E0E', 0, -.38, .06, 0, .15); b.add('cone', '#7A3E0E', 0, .14, 0, .15, .18, .15); b.cyl('#7A3E0E', 0, .2, .42, 0, .055); b.cyl('#E8C547', 0, .42, .48, 0, .06);
    b.cyl('#F2E3B3', 0, -.22, -.02, 0, .155); b.cyl('#C8102E', 0, -.15, -.1, 0, .158);
  }
  spin.add(b.mesh(mats().vcs)); spin.children[0].castShadow = true;
  // (its children: the bottle spinning, its glow, the ring on the ground; nothing in userData: a clone copies that as JSON)
  g.add(spin);
  const col = (big ? HALO_BIG : HALO)[kind];
  const glow = new T.Sprite(new T.SpriteMaterial({map: glowTex(), color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .8}));
  glow.scale.set(2.2, 2.2, 1); g.add(glow);
  const ring = new T.Mesh(new T.RingGeometry(.45, .58, 32), new T.MeshBasicMaterial({color: col, transparent: true, opacity: .6, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false}));
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  if (big) {
    spin.scale.setScalar(BIG); ring.scale.setScalar(BIG);
    const beam = new T.Mesh(new T.CylinderGeometry(.32, .5, 7, 16, 1, true).translate(0, 3.5, 0), new T.MeshBasicMaterial({color: col, transparent: true, opacity: .22, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false}));
    g.add(beam);
  }
  OBJ.set(key, g);
  return g;
}
// Evan's floating collectibles: modelled at their display size, with readable fronts and a warm runner-game burst.
// These procedural textures are created only after the profile gate above; no new artwork is fetched or precached.
const PICKUP_COLOR = {salts: 0x54E8FF, pills: 0xFF8740, booze: 0x8AE53F};
function pickupLabel(kind) {
  return texOf('arcade-pickup-label:' + kind, () => canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#FFF9DF'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (kind === 'salts') {
      c.fillStyle = '#1BBFDE'; c.fillRect(0, 0, w, 94); c.fillRect(0, 422, w, 90);
      c.fillStyle = '#087C9C'; c.fillRect(0, 94, w, 12); c.fillRect(0, 410, w, 12);
      c.fillStyle = '#FFFFFF'; c.font = `800 45px ${DISPLAY}`; c.fillText('SMELLING', 256, 48);
      c.fillStyle = '#133C55'; c.font = `800 76px ${DISPLAY}`; c.fillText('SALTS', 256, 157);
      c.fillStyle = '#19B6D8'; c.beginPath(); c.moveTo(275, 208); c.lineTo(176, 306); c.lineTo(239, 306);
      c.lineTo(212, 383); c.lineTo(338, 271); c.lineTo(270, 271); c.closePath(); c.fill();
      c.fillStyle = '#FFFFFF'; c.font = `800 34px ${DISPLAY}`; c.fillText('SNAP • WAKE UP', 256, 464);
    } else if (kind === 'pills') {
      c.fillStyle = '#EF4B3E'; c.fillRect(0, 0, w, 36); c.fillRect(0, 468, w, 44);
      c.fillStyle = '#C93233'; c.font = 'bold 235px Georgia, serif'; c.fillText('Rx', 256, 203);
      c.fillStyle = '#143A51'; c.font = `800 55px ${DISPLAY}`; c.fillText('PAINKILLER', 256, 365);
      c.fillStyle = '#B9B8A6'; c.fillRect(145, 416, 222, 10); c.fillRect(179, 437, 154, 8);
    } else {
      c.fillStyle = '#DAAB2D'; c.fillRect(0, 0, w, 22); c.fillRect(0, 490, w, 22);
      c.fillStyle = '#206B31'; c.beginPath(); c.arc(256, 123, 73, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#FFDC62'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 24 : 49; c.lineTo(256 + Math.cos(a) * r, 123 + Math.sin(a) * r); }
      c.closePath(); c.fill(); c.fillStyle = '#174E2B'; c.font = `800 119px ${DISPLAY}`; c.fillText('BEER', 256, 285);
      c.fillStyle = '#D8AA32'; c.fillRect(94, 365, 324, 6); c.font = `800 51px ${DISPLAY}`; c.fillText('★  ★  ★', 256, 423);
    }
  }, false));
}
function pickupBurstTex() {
  return texOf('arcade-pickup-burst', () => canvasTex(256, 256, (c) => {
    const gr = c.createRadialGradient(128, 128, 20, 128, 128, 126);
    gr.addColorStop(0, 'rgba(255,255,228,.9)'); gr.addColorStop(.38, 'rgba(255,226,104,.66)'); gr.addColorStop(1, 'rgba(255,197,57,0)');
    c.fillStyle = gr;
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5, r = i % 2 ? 108 : 128;
      c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(a - .1) * r, 128 + Math.sin(a - .1) * r);
      c.lineTo(128 + Math.cos(a + .1) * r, 128 + Math.sin(a + .1) * r); c.closePath(); c.fill();
    }
  }, false));
}
function pickupSparkTex() {
  return texOf('arcade-pickup-spark', () => canvasTex(64, 64, c => {
    c.fillStyle = '#FFFBE4'; c.beginPath();
    [[32, 0], [39, 25], [64, 32], [39, 39], [32, 64], [25, 39], [0, 32], [25, 25]].forEach(([x, y]) => c.lineTo(x, y));
    c.closePath(); c.fill();
  }, false));
}
function arcadeItemOf(kind) {
  const key = 'item:arcade:' + kind;
  if (OBJ.has(key)) return OBJ.get(key);
  const g = new T.Group(), model = new T.Group(), trim = new Batch();
  g.name = 'arcade-pickup-' + kind; model.name = 'pickup-model';
  g.userData.arcadePickup = true;
  const solid = (hex, roughness = .38) => new T.MeshStandardMaterial({color: hex, roughness, metalness: .08, emissive: hex, emissiveIntensity: .14});
  const lathe = (points, material) => {
    const mesh = new T.Mesh(new T.LatheGeometry(points.map(([r, y]) => new T.Vector2(r, y)), 24), material);
    mesh.castShadow = true; model.add(mesh); return mesh;
  };
  const label = new T.MeshBasicMaterial({map: pickupLabel(kind), toneMapped: false});
  if (kind === 'booze') {
    lathe([[0, -.92], [.23, -.92], [.31, -.88], [.34, -.79], [.34, .15], [.32, .27], [.23, .4], [.13, .49], [.12, .78], [.14, .81], [.14, .87], [0, .87]], solid(0x32932F, .24));
    trim.cyl('#255C25', 0, -.91, -.83, 0, .305); trim.cyl('#FFDA54', 0, .84, .96, 0, .16);
    trim.cyl('#FFED98', 0, .94, .98, 0, .15); trim.cyl('#F6D966', 0, .61, .74, 0, .123);
    trim.add('sph', '#A4EC63', -.22, .02, -.238, .045, .61, .019);
    trim.add('sph', '#F3FFD9', -.072, .64, -.105, .022, .14, .012);
    const wrap = new T.Mesh(new T.CylinderGeometry(.347, .347, .64, 28, 1, true, -1.22, 2.44), label);
    wrap.position.y = -.34; model.add(wrap);
  } else if (kind === 'pills') {
    lathe([[0, -.79], [.36, -.79], [.43, -.72], [.43, .39], [.38, .48], [.34, .53], [0, .53]], solid(0xEF8A24, .3));
    trim.cyl('#D26719', 0, -.79, -.69, 0, .4); trim.cyl('#FFF9E7', 0, .46, .76, 0, .48);
    trim.cyl('#FFFFFF', 0, .74, .82, 0, .44); trim.cyl('#D6DBD1', 0, .45, .49, 0, .45);
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; trim.add('box', '#E1E7DE', Math.sin(a) * .476, .61, Math.cos(a) * .476, .027, .21, .026, 0, -a); }
    trim.add('sph', '#FFD67C', -.29, -.1, -.31, .045, .53, .02);
    const wrap = new T.Mesh(new T.CylinderGeometry(.438, .438, .82, 28, 1, true, -1.16, 2.32), label);
    wrap.position.y = -.1; model.add(wrap);
  } else {
    // A sealed, pillow-shaped foil sachet, including crimped edges and tear notch; it is deliberately not a vial.
    const shape = new T.Shape();
    shape.moveTo(-.45, -.78);
    for (let i = 1; i <= 12; i++) shape.lineTo(-.45 + i * .075, -.78 + (i % 2 ? .025 : 0));
    shape.lineTo(.48, .47); shape.lineTo(.39, .53); shape.lineTo(.47, .59); shape.lineTo(.45, .78);
    for (let i = 1; i <= 12; i++) shape.lineTo(.45 - i * .075, .78 - (i % 2 ? .025 : 0));
    shape.lineTo(-.48, 0); shape.closePath();
    const packet = new T.Mesh(new T.ExtrudeGeometry(shape, {depth: .045, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .045, bevelThickness: .025}), solid(0xEDF6E6, .42));
    packet.position.z = -.0225; packet.castShadow = true; model.add(packet);
    trim.add('box', '#D6EEE1', 0, -.71, 0, .91, .1, .055); trim.add('box', '#F8FFF0', 0, .71, 0, .91, .1, .055);
    for (let i = 0; i < 13; i++) {
      const x = -.43 + i * .071;
      trim.add('box', '#BAD9D3', x, -.71, -.041, .016, .1, .012);
      trim.add('box', '#C2DCD4', x, .71, -.041, .016, .1, .012);
    }
    const front = new T.Mesh(new T.PlaneGeometry(.89, 1.24), label); front.position.z = .052; model.add(front);
    const back = front.clone(); back.position.z = -.052; back.rotation.y = Math.PI; model.add(back);
    trim.add('box', '#FFFFFF', -.46, 0, -.033, .018, 1.1, .012);
  }
  const details = trim.mesh(mats().vcs); details.castShadow = true; model.add(details); g.add(model);
  const color = PICKUP_COLOR[kind];
  const sprite = (map, tint, opacity) => new T.Sprite(new T.SpriteMaterial({map, color: tint, transparent: true, opacity,
    depthWrite: false, blending: T.AdditiveBlending, toneMapped: false}));
  const glow = sprite(glowTex(), color, .62); glow.position.z = -.5; g.add(glow);
  const ring = new T.Mesh(new T.RingGeometry(.56, .61, 40), new T.MeshBasicMaterial({color, transparent: true, opacity: .65, depthWrite: false, toneMapped: false}));
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  const burst = sprite(pickupBurstTex(), 0xFFFFFF, .75); burst.position.z = -.55; g.add(burst);
  const sparks = new T.Group();
  for (let i = 0; i < 3; i++) sparks.add(sprite(pickupSparkTex(), i === 1 ? color : 0xFFF2B4, .9));
  g.add(sparks);
  OBJ.set(key, g); return g;
}
function animateArcadeItem(o, t, phase, camX, distance) {
  const bob = Math.sin(t * 3 + phase) * .16, pulse = .5 + .5 * Math.sin(t * 4 + phase), y = 1.65 + bob;
  const [model, glow, ring, burst, sparks] = o.children;
  model.position.y = y;
  // A small turn shows the model's thickness while keeping its label visible from every lane.
  model.rotation.set(.04 * Math.sin(t * 1.6 + phase), Math.atan2(camX - o.position.x, Math.max(1, distance)) + .24 * Math.sin(t * 1.7 + phase), -.1 + .08 * Math.sin(t * 2 + phase));
  glow.position.y = burst.position.y = y;
  glow.scale.setScalar(3.2 + .25 * pulse); burst.scale.setScalar(3.7 + .25 * pulse);
  ring.position.y = .035; ring.scale.setScalar(1 + .12 * pulse);
  for (let i = 0; i < sparks.children.length; i++) {
    const star = sparks.children[i], a = t * .65 + phase + i * Math.PI * 2 / 3;
    star.position.set(Math.cos(a) * (i === 1 ? 1.12 : .94), y + Math.sin(a) * .86, .2);
    star.scale.setScalar(.14 + .1 * (.5 + .5 * Math.sin(t * 5 + i * 2)));
  }
}
// ---------------------------------------------------------------- The coins (the owner's first run of the day)
// core/return.js COIN: lines of gold coins on his hard course, his first run of the day alone (views/return.js says
// which: st.run.coins, st.coinGot the ones he's run through). All of them one instanced mesh, one draw call however
// many are in view (COIN_CAP at most), no shadow; each coin spinning on its own matrix: a gold disc, its milled rim
// darker, its face raised and brighter, coloured by its faces, metal under the scene's light. Built the first time a
// coin run is drawn on his profile (never for anyone else), from shapes alone: nothing to load, nothing to cache.
const COIN_CAP = 72;
const COIN_COL = {face: 0xFFD45A, faceRim: 0xE2A21E, disc: 0xF0B02C, rim: 0xB87212};
let COINS = null;
function coinsMesh() {
  if (COINS) return COINS;
  const r = R.COIN.r, th = .085, pos = [], nor = [], cols = [], c = new T.Color();
  const disc = new T.CylinderGeometry(r, r, th, 28, 1).rotateX(Math.PI / 2).toNonIndexed();
  const face = new T.CylinderGeometry(r * .7, r * .7, th + .03, 28, 1).rotateX(Math.PI / 2).toNonIndexed();
  [[disc, 'disc', 'rim'], [face, 'face', 'faceRim']].forEach(([g, cap, side]) => {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 9) {
      c.set(COIN_COL[Math.abs((n[i + 2] + n[i + 5] + n[i + 8]) / 3) > .5 ? cap : side]);
      for (let j = 0; j < 9; j++) { pos.push(p[i + j]); nor.push(n[i + j]); }
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
    }
    g.dispose();
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  geo.computeBoundingSphere();
  const m = new T.InstancedMesh(geo, new T.MeshStandardMaterial({vertexColors: true, metalness: .6, roughness: .32, emissive: 0x7A4C00, emissiveIntensity: .55}), COIN_CAP);
  m.name = 'coins'; m.instanceMatrix.setUsage(T.DynamicDrawUsage);
  m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.count = 0; m.visible = false; m.userData.shared = true;
  ROOT.add(bend(m));
  COINS = m;
  return m;
}
/** The coins in view (A: core ahead's, or null with no coin run), spinning and bobbing a little; none off his profile. */
function coinsUpdate(st, A, t) {
  if (!(A && st.run && st.run.coins && features.available())) { if (COINS) { COINS.count = 0; COINS.visible = false; } return; }
  const m = coinsMesh(), M = tm();
  let n = 0;
  for (const {coin} of A.coins) {
    if (n >= COIN_CAP) break;
    if (st.coinGot && st.coinGot.has(coin.i)) continue;
    M.e.set(0, t * 4.2 + coin.i * .35, 0); M.q.setFromEuler(M.e);
    M.p.set(R.xOf(null, coin.lane), coin.y + .05 * Math.sin(t * 3 + coin.i * .7), -coin.z); M.s.set(1, 1, 1);
    m.setMatrixAt(n++, M.m.compose(M.p, M.q, M.s));
  }
  m.count = n; m.visible = n > 0;
  m.instanceMatrix.needsUpdate = true;
}
const glowTex = () => texOf('glow', () => canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false));
// ---------------------------------------------------------------- The gates
const GATE_LOOK = {
  stadium: ['#16224A', '#0E1B45', '#3EF08F', '#EAF1FF'], tailgate: ['#5A3B2E', '#E07B39', '#FFF1D6', '#FFFFFF'], city: ['#3A4048', '#1E6FD9', '#FFFFFF', '#FFFFFF'],
  tundra: ['#E9EEF3', '#2E6FB5', '#DDEBFA', '#FFFFFF'], desert: ['#6B4A33', '#B5652B', '#F3D9A4', '#FFF4DE'], market: ['#6B4A33', '#2E9E4F', '#FFF4D6', '#FFFFFF'],
  beach: ['#E9EEF3', '#1FA6C9', '#FFF4C2', '#FFFFFF'], space: ['#565C70', '#2A1F5C', '#5CF4FF', '#E8FBFF'], farm: ['#8A5E34', '#B2362A', '#FFE08A', '#FFFFFF']
};
function gateOf(th) {
  const key = style.key() + 'gate:' + th.id;
  if (OBJ.has(key)) return OBJ.get(key);
  const [post, board, small, ink] = style.gate(th.id, GATE_LOOK[th.id] || GATE_LOOK.stadium), g = new T.Group(), b = new Batch(th.id);
  // (its two posts and the sign: no goalposts standing up out of it, the owner's ask, Oct 25 2026)
  b.box(post, -7.3, -6.5, 0, 8.2, -.4, .4); b.box(post, 6.5, 7.3, 0, 8.2, -.4, .4);
  const m = b.mesh(mats().vcs); m.castShadow = true; g.add(m);
  const big = th.name.toUpperCase(), name = big.replace(/^THE /, ''), the = big.startsWith('THE ');
  const face = new T.Mesh(new T.BoxGeometry(14.8, 2.4, .3), [0, 1, 2, 3].map(() => new T.MeshLambertMaterial({color: col(board)})).concat([new T.MeshLambertMaterial({map: canvasTex(1024, 166, (c2, w, h) => {
    c2.fillStyle = board; c2.fillRect(0, 0, w, h);
    c2.strokeStyle = small; c2.lineWidth = 8; c2.strokeRect(10, 10, w - 20, h - 20);
    c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillStyle = small; c2.font = `700 ${h * .22}px ${DISPLAY}`; c2.fillText(the ? 'WELCOME TO THE' : 'WELCOME TO', w / 2, h * .28);
    c2.fillStyle = ink; c2.font = `800 ${h * (name.length > 10 ? .42 : .5)}px ${DISPLAY}`; c2.fillText(name, w / 2, h * .66, w - 120);
  }, false)}), new T.MeshLambertMaterial({color: col(board)})]));
  // (BoxGeometry's faces: +x, -x, +y, -y, +z (toward us), -z)
  face.position.set(0, 9.2, 0); g.add(face);
  OBJ.set(key, g);
  return g;
}

// ---------------------------------------------------------------- The vehicles
// Each part of each thing (core/return.js KINDS: p {lane, kind, part, z0 (its front), z1, h, b (its bottom, if it
// floats), ramp, hi}), sized to it, in its place's colours; and its ramp.
const WIDE = {fence: 1.35, pier: 1.3, hover: 1.2, canyon: 1.3, marketramp: 1.25, awning: 1.25, lifeguard: 1.25, cargo: 1.25, wagonbridge: 1.25, trailer: 1.2, ramptruck: 1.2};
const TALL = {
  teambus: {body: '#1D3F8F', top: '#2E52A6', stripe: '#3EF08F', trim: '#0D1B40', sign: 'GRIDIRON'},
  rv: {body: '#EEE6D6', top: '#F6F1E6', stripe: '#B5652B', trim: '#6E6658'},
  citybus: {body: '#F2F4F7', top: '#C9D0D9', stripe: '#1E6FD9', trim: '#2A2F38', sign: 'EXPRESS'},
  plow: {body: '#E8742A', top: '#F4F8FB', stripe: '#1A1D22', trim: '#2A2F38'},
  train: {body: '#8E3B2A', top: '#5C2A1E', stripe: '#F2C230', trim: '#2A1A14'},
  producetruck: {body: '#E9ECE6', top: '#F4F6F2', stripe: '#2E9E4F', trim: '#2A2F38', cab: '#2E9E4F'},
  icecream: {body: '#FBEFF4', top: '#FFFFFF', stripe: '#F27BA8', trim: '#5A4A55', cab: '#F27BA8'},
  shuttle: {body: '#F1F3F7', top: '#F7F8FB', stripe: '#C8102E', trim: '#1A1D22'},
  combine: {body: '#3E8E3A', top: '#4FA34A', stripe: '#F2C230', trim: '#1E3A1C'}
};
function vehicleOf(p, th) {
  const X = R.xOf(null, p.lane), w = WIDE[p.kind] || (p.hi ? 1.25 : 1.15), x0 = X - w, x1 = X + w, y0 = p.b || 0, y1 = p.h, z0 = p.z0, z1 = p.z1;
  // The existing City bus pilot keeps its exact wheels and complete fallback if art cannot load.
  const palette = p.kind === 'citybus' ? null : th.id;
  const b = new Batch(palette), lit = new Batch(palette), g = new T.Group();
  const isCityBus = th.id === 'city' && p.kind === 'citybus';
  const painted = isCityBus ? cityBus.body({x0, x1, y0, y1, z0, z1}) : null;
  if (isCityBus) { g.userData.cityBus = true; g.userData.cityBusPilot = !!painted; }
  const f = KIND[p.kind];
  g.userData.theme = th.id; g.userData.models = models.ready(th.id); g.userData.z0 = z0;
  if (painted) {
    g.add(painted);
    // Keep the original wheel geometry, placement, ramp and collision footprint.
    [z0 + 1.8, z1 - 2.2].forEach(z => [x0 + .1, x1 - .1].forEach(x => wheel(b, x, z, .55, .35)));
  }
  else if (models.vehicle(b, lit, {x0, x1, y0, y1, z0, z1, X, w}, p, th.id)) { /* (the place's models, in its box) */ }
  else if (f) f(b, lit, {x0, x1, y0, y1, z0, z1, X, w}, p, g);
  else if (TALL[p.kind]) tallOne(b, lit, {x0, x1, y0, y1, z0, z1, X, w}, p, TALL[p.kind], g);
  else b.box('#888888', x0, x1, y0, y1, z0, z1);
  if (p.ramp) rampOf(b, p, X, RAMP_LOOK[p.kind] || RAMP_LOOK[th.id] || RAMP_LOOK.stadium);
  // its shadow on the ground (if it stands on it)
  if (!p.b) g.add(plane(mats().shadow, x0 - .2, x1 + .3, z0 - .2, z1 + .8, .012));
  const m = b.mesh(mats().vcs); if (m) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  const l = lit.mesh(mats().glow); if (l) g.add(l);
  return g;
}
const RAMP_LOOK = {
  stadium: ['#7D8794', '#F2C230'], tailgate: ['#C9A26B', '#E07B39'], city: ['#8D96A3', '#F2C230'], tundra: ['#E8EFF5', '#E8742A'], desert: ['#B7834E', '#6E4A33'],
  market: ['#B98E5C', '#2E9E4F'], beach: ['#C9915A', '#F27BA8'], space: ['#7C8296', '#5CF4FF'], farm: ['#B98E5C', '#F2C230'],
  canyon: ['#C98A4E', '#6E4A33'], wagonbridge: ['#C98A4E', '#C8102E'], ramptruck: ['#5E6470', '#F2C230'], marketramp: ['#D9A866', '#2E9E4F'], lifeguard: ['#C9915A', '#1FA6C9'],
  cargo: ['#4A5068', '#5CF4FF'], trailer: ['#C98A4E', '#C8322B']
};
function rampOf(b, p, X, [face, edge]) {
  const zs = p.z0 - p.ramp, zm = (zs + p.z0) / 2;
  b.add('wedge', face, X, 0, zm, 2.3, p.h, p.ramp);
  // its edges in the place's colour, and chevrons up the middle
  [-1.08, 1.08].forEach(dx => b.add('box', edge, X + dx, p.h / 2 + .03, zm, .14, .05, Math.hypot(p.ramp, p.h), Math.atan2(p.h, p.ramp), 0, 0));
  for (let k = 1; k < 5; k++) { const u = k / 5; b.add('box', dark(face, .78), X, p.h * u + .03, zs + p.ramp * u, 2.1, .04, .25, Math.atan2(p.h, p.ramp), 0, 0); }
}
/** A tall vehicle (a bus, an RV, a train car...): its body, windows, a stripe, wheels, its front's windshield and lights. */
function tallOne(b, lit, V, p, L, g) {
  const {x0, x1, y1, z0, z1, X} = V, len = z1 - z0;
  b.box(L.body, x0, x1, .35, y1 - .15, z0, z1);
  b.box(L.top, x0 + .05, x1 - .05, y1 - .15, y1, z0 + .05, z1 - .05);
  b.box(L.stripe, x0 - .01, x1 + .01, 1.2, 1.36, z0 + .01, z1 - .01);
  b.box(L.trim, x0 - .005, x1 + .005, .35, .6, z0, z1);
  // windows along both sides, the windshield across the front
  for (let z = z0 + 2.6; z < z1 - .8; z += 1.8) [x0, x1].forEach(x => b.box('#16213A', x - .015, x + .015, 1.6, 2.5, z, z + 1.4));
  b.box('#16213A', x0 + .15, x1 - .15, 1.3, 2.55, z0 - .015, z0 + .01);
  b.box('#2A2F3A', x0, x1, .35, .62, z0 - .03, z0);
  lit.box('#FFF6D6', x0 + .2, x0 + .6, .75, .95, z0 - .04, z0 - .02); lit.box('#FFF6D6', x1 - .6, x1 - .2, .75, .95, z0 - .04, z0 - .02);
  lit.box('#FF3B30', x0 + .2, x0 + .5, .75, .95, z1 + .02, z1 + .04); lit.box('#FF3B30', x1 - .5, x1 - .2, .75, .95, z1 + .02, z1 + .04);
  [z0 + 1.8, z1 - 2.2].forEach(z => [x0 + .1, x1 - .1].forEach(x => wheel(b, x, z, .55, .35)));
  if (L.sign) g.add(frontSign(L.sign, X, y1 - .45, z0 - .02, x1 - x0 - .6));
  // each one's own: the plow's blade, the shuttle's nose and tail, the combine's reel, the ice cream cone, the cabs
  if (p.kind === 'plow') { b.add('box', '#F2C230', X, .6, z0 - .6, (x1 - x0) + .6, 1.1, .2, -.35, 0, 0); }
  if (p.kind === 'shuttle') { b.add('cone', '#1A1D22', X, 1.6, z0 - .9, 1.1, 1.8, 1.1, -Math.PI / 2, 0, 0); b.add('box', L.stripe, X, y1 + .8, z1 - 1.5, .15, 1.6, 2.6); [-1, 1].forEach(s => b.add('box', '#DADFE8', X + s * 1.6, 1.2, z1 - 2.5, 1.4, .12, 3.5)); }
  if (p.kind === 'combine') { b.add('cyl', '#F2C230', X, .8, z0 - .9, .7, (x1 - x0) + .9, .7, 0, 0, Math.PI / 2); b.box('#2A2F38', X - .8, X + .8, y1, y1 + .9, z0 + 1, z0 + 2.8); }
  if (p.kind === 'icecream') { b.add('cone', '#E3BE5A', X, y1 + .55, z0 + 2, .35, 1, .35, Math.PI, 0, 0); b.add('sph', '#F27BA8', X, y1 + 1.1, z0 + 2, .42, .42, .42); }
  if (L.cab) b.box(L.cab, x0 - .01, x1 + .01, .35, y1 - .6, z0, z0 + 2.4);
  void len;
}
function frontSign(text, x, y, z, w) {
  const mat = texMat('front:' + text, () => canvasTex(256, 48, (g, cw, ch) => { g.fillStyle = '#05080F'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#3EF08F'; g.font = `800 ${ch * .7}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 2); }, false));
  // (a plane faces three.js's +z: toward the camera, the front as we look at it)
  const m = new T.Mesh(new T.PlaneGeometry(w, .36), mat);
  m.position.set(x, y, -z + .001);
  return m;
}
// The rest, each its own shape.
const KIND = {
  bench(b, lit, V) { const {x0, x1, y1, z0, z1} = V; b.box('#1D3F8F', x0, x1, y1 - .22, y1, z0, z1); b.box('#152E66', x0 + .05, x0 + .2, y1, y1 + .55, z0, z1); for (let z = z0 + .3; z < z1; z += 2) [x0 + .2, x1 - .2].forEach(x => b.box('#9AA1AB', x - .05, x + .05, 0, y1 - .22, z - .05, z + .05)); },
  pong(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#F4F3EE', x0, x1, y1 - .08, y1, z0, z1); b.box('#2B2D31', x0 + .1, x1 - .1, y1 - .2, y1 - .08, z0 + .1, z1 - .1); [z0 + .3, z1 - .3].forEach(z => [x0 + .2, x1 - .2].forEach(x => b.box('#2B2D31', x - .05, x + .05, 0, y1 - .2, z - .05, z + .05))); [z0 + .5, z1 - .5].forEach(z => { for (let k = 0; k < 6; k++) b.cyl('#C8102E', X - .4 + (k % 3) * .4, y1, y1 + .18, z + (k > 2 ? .35 : 0) * (z < (z0 + z1) / 2 ? 1 : -1), .09); }); },
  snowbank(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.add('sph', '#F7FAFD', X, 0, (z0 + z1) / 2, (x1 - x0) / 2 + .1, y1 * 1.05, (z1 - z0) / 2 + .2); },
  parkedcar(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#2F5BD8', x0 + .05, x1 - .05, .3, y1 - .4, z0, z1); b.box('#1C2530', x0 + .2, x1 - .2, y1 - .4, y1, z0 + 1.1, z1 - 1); b.box('#3A68E6', x0 + .25, x1 - .25, y1 - .03, y1, z0 + 1.2, z1 - 1.1); [z0 + .9, z1 - .9].forEach(z => [x0 + .1, x1 - .1].forEach(x => wheel(b, x, z, .34, .25))); lit.box('#FFF6D6', x0 + .25, x0 + .6, .6, .75, z0 - .03, z0 - .01); lit.box('#FFF6D6', x1 - .6, x1 - .25, .6, .75, z0 - .03, z0 - .01); void X; },
  ramptruck(b, lit, V, p) { const {x0, x1, y1, z0, z1, X} = V; if (p.part === 0) { b.box('#4A4F58', x0, x1, .5, y1, z0, z1); b.box('#F2C230', x0, x0 + .1, y1, y1 + .4, z0, z1); b.box('#F2C230', x1 - .1, x1, y1, y1 + .4, z0, z1); [z0 + 1, z1 - .8].forEach(z => [x0 + .1, x1 - .1].forEach(x => wheel(b, x, z, .5, .3))); } else { b.box('#F2C230', x0, x1, .5, y1, z0, z1); b.box('#1C2530', x0 + .1, x1 - .1, y1 - 1, y1 - .2, z1 - .02, z1 + .01); lit.box('#FF9500', X - .4, X + .4, y1, y1 + .18, (z0 + z1) / 2 - .2, (z0 + z1) / 2 + .2); [(z0 + z1) / 2].forEach(z => [x0 + .1, x1 - .1].forEach(x => wheel(b, x, z, .5, .3))); } },
  canyon(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#C8613C', x0, x1, 0, y1, z0, z1); b.box('#E39A68', x0 + .1, x1 - .1, y1 - .05, y1 + .02, z0 + .1, z1 - .1); for (let z = z0; z < z1; z += 2.2) b.add('rock', '#B9512E', X + (z % 2 ? .6 : -.6), y1 * .45, z + 1, 1.4, y1 * .55, 1.3, 0, z, 0); },
  minecart(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#7A5233', x0 + .1, x1 - .1, .35, y1, z0, z1); b.box('#3E2A1A', x0 + .2, x1 - .2, y1 - .05, y1 + .02, z0 + .1, z1 - .1); for (let k = 0; k < 6; k++) b.add('rock', '#8A8F98', X - .5 + (k % 3) * .5, y1 + .1, z0 + .6 + Math.floor(k / 3) * 1.2, .35, .3, .35, k, k, 0); [z0 + .5, z1 - .5].forEach(z => [x0 + .15, x1 - .15].forEach(x => wheel(b, x, z, .3, .15, '#3A3A3A'))); },
  wagonbridge(b, lit, V) { const {x0, x1, y1, z0, z1} = V; b.box('#C98A4E', x0, x1, y1 - .25, y1, z0, z1); for (let z = z0; z < z1; z += .6) b.box('#9C6B3E', x0, x1, y1 - .01, y1 + .01, z, z + .08); for (let z = z0 + .3; z < z1; z += 3) [x0 + .15, x1 - .15].forEach(x => b.box('#8A5A34', x - .12, x + .12, 0, y1 - .25, z - .12, z + .12)); [x0, x1].forEach(x => b.box('#C8102E', x - .05, x + .05, y1, y1 + .8, z0, z1)); },
  producecart(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#9C6B3E', x0, x1, .45, y1 - .2, z0, z1); b.box('#C9372B', x0 - .05, x1 + .05, y1 - .2, y1, z0 - .05, z1 + .05); for (let k = 0; k < 10; k++) b.add('ball', ['#F28C28', '#D63B2E', '#4FA845'][k % 3], X - .7 + (k % 5) * .35, y1 + .12, z0 + .8 + Math.floor(k / 5) * 1.5, .17, .17, .17); [x0 - .05, x1 + .05].forEach(x => wheel(b, x, (z0 + z1) / 2, .45, .12, '#C98A4E')); },
  marketramp(b, lit, V) { const {x0, x1, y1, z0, z1} = V; for (let z = z0; z < z1 - .1; z += 1.3) for (let y = 0; y < y1 - .1; y += .95) b.box(((z + y) * 7 | 0) % 2 ? '#C98A4E' : '#B07A48', x0, x1, y, Math.min(y1, y + .95), z, Math.min(z1, z + 1.3)); },
  awning(b, lit, V, p) { const {x0, x1, y0, y1, z0, z1, X} = V; if (p.part === 0) { b.box('#C98A4E', x0, x1, 0, y1, z0, z1); for (let k = 0; k < 8; k++) b.add('ball', ['#F28C28', '#D63B2E', '#4FA845', '#F2C94C'][k % 4], X - .8 + (k % 4) * .5, y1 + .12, z0 + .8 + Math.floor(k / 4) * 1.6, .17, .17, .17); } else { const n = 6; for (let k = 0; k < n; k++) b.box(k % 2 ? '#FFFFFF' : '#D8392B', x0 - .1 + k * (x1 - x0 + .2) / n, x0 - .1 + (k + 1) * (x1 - x0 + .2) / n, y1 - .12, y1, z0, z1); [z0 + .1, z1 - .1].forEach(z => [x0 + .05, x1 - .05].forEach(x => b.box('#6B4A33', x - .06, x + .06, 0, y1 - .12, z - .06, z + .06))); b.box('#B07A48', x0, x1, 0, 1, z0 + .3, z1 - .3); } void y0; },
  lifeguard(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#D9A866', x0, x1, y1 - .2, y1, z0, z1); [z0 + .2, z1 - .2].forEach(z => [x0 + .15, x1 - .15].forEach(x => b.box('#C9915A', x - .1, x + .1, 0, y1 - .2, z - .1, z + .1))); b.box('#F2C230', x0 + .2, x1 - .2, y1, y1 + 1.6, z1 - 1.6, z1 - .2); b.add('prism', '#C8102E', X, y1 + 1.6, z1 - .9, x1 - x0, .7, 1.8); b.box('#C8102E', X - .6, X + .6, y1 + .6, y1 + 1.1, z1 - 1.62, z1 - 1.6); },
  buggy(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#F28C28', x0 + .1, x1 - .1, .55, y1 - .3, z0, z1); b.box('#2A2C30', x0 + .2, x1 - .2, y1 - .32, y1 - .25, z0 + .4, z1 - .4); [x0 + .25, x1 - .25].forEach(x => { b.box('#2A2C30', x - .05, x + .05, y1 - .3, y1 + .7, z0 + 1.2, z0 + 1.3); b.box('#2A2C30', x - .05, x + .05, y1 + .6, y1 + .7, z0 + 1.2, z1 - .6); }); [z0 + .6, z1 - .6].forEach(z => [x0, x1].forEach(x => wheel(b, x, z, .55, .45, '#F2C230'))); void X; },
  pier(b, lit, V) { const {x0, x1, y1, z0, z1} = V; b.box('#C9915A', x0, x1, y1 - .18, y1, z0, z1); for (let z = z0; z < z1; z += .5) b.box('#9C6A3C', x0, x1, y1 - .005, y1 + .005, z, z + .06); for (let z = z0 + .3; z < z1; z += 2) [x0 + .15, x1 - .15].forEach(x => b.cyl('#7A5233', x, 0, y1 - .18, z, .14)); [x0, x1].forEach(x => b.box('#E9D6A8', x - .03, x + .03, y1 + .5, y1 + .56, z0, z1)); },
  rover(b, lit, V) { const {x0, x1, y1, z0, z1, X} = V; b.box('#E9ECF2', x0 + .15, x1 - .15, .55, y1 - .1, z0, z1); b.box('#25356E', x0 + .3, x1 - .3, y1 - .1, y1, z0 + .3, z1 - .3); [z0 + .5, (z0 + z1) / 2, z1 - .5].forEach(z => [x0 + .05, x1 - .05].forEach(x => wheel(b, x, z, .4, .3, '#C9CED8'))); b.cyl('#9AA1AB', X + .6, y1, y1 + 1.3, z1 - .4, .03); lit.add('sph', '#5CF4FF', X + .6, y1 + 1.35, z1 - .4, .08, .08, .08); },
  cargo(b, lit, V) { const {x0, x1, y1, z0, z1} = V; b.box('#2E3446', x0, x1, 0, y1, z0, z1); for (let z = z0 + 1; z < z1; z += 2) [x0, x1].forEach(x => b.box('#3A4157', x - .03, x + .03, .2, y1 - .2, z, z + .2)); lit.box('#5CF4FF', x0 - .02, x1 + .02, y1 - .12, y1 - .06, z0, z1); },
  hover(b, lit, V) { const {x0, x1, y0, y1, z0, z1} = V; b.box('#2A3150', x0, x1, y0, y1 - .06, z0, z1); b.box('#C9CED8', x0 + .05, x1 - .05, y1 - .06, y1, z0 + .05, z1 - .05); lit.box('#5CF4FF', x0 - .02, x1 + .02, y0 + .05, y0 + .12, z0 - .02, z1 + .02); },
  hay(b, lit, V) { const {x0, x1, y1, z0, z1} = V; for (let z = z0; z < z1 - .1; z += 1.3) for (let y = 0; y < y1 - .1; y += .95) { b.box('#E3BE5A', x0, x1, y, Math.min(y1, y + .95), z, Math.min(z1, z + 1.3)); b.box('#C9A245', x0 - .01, x1 + .01, y + .45, y + .5, z, Math.min(z1, z + 1.3)); } },
  trailer(b, lit, V) { const {x0, x1, y1, z0, z1} = V; b.box('#C98A4E', x0, x1, y1 - .2, y1, z0, z1); [x0, x1].forEach(x => b.box('#C8322B', x - .05, x + .05, y1, y1 + .7, z0, z1)); [(z0 + z1) / 2 - .6, (z0 + z1) / 2 + .6].forEach(z => [x0 + .05, x1 - .05].forEach(x => wheel(b, x, z, .45, .3))); b.box('#3A3A3A', x0 + .3, x1 - .3, .5, y1 - .2, z0 + .2, z1 - .2); },
  fence(b, lit, V) { const {x0, x1, y1, z0, z1} = V; [.3, .7].forEach(y => b.box('#E9E2D2', x0, x1, y, y + .14, z0, z1)); [x0 + .1, (x0 + x1) / 2, x1 - .1].forEach(x => b.box('#D9D0BC', x - .07, x + .07, 0, y1, z0, z1)); }
};

// ============================================================================ Each frame
/** The place's light: the sky's and the ground's, the sun's colour and strength and where it is, the haze. */
const LIGHT = {
  stadium: {sky: 0x8FA6D6, ground: 0x1E3A2A, hemi: 1.1, sun: 0xE6EEFF, sunI: 2.2, at: [-2, 7, 3]},
  tailgate: {sky: 0xFFD2B0, ground: 0x5A4A48, hemi: 1.35, sun: 0xFFB878, sunI: 2.5, at: [5, 3.5, 1.5]},
  city: {sky: 0xDCEBFF, ground: 0x6A6E74, hemi: 1.2, sun: 0xFFF4E2, sunI: 2.4, at: [-3, 6, 2]},
  tundra: {sky: 0xEAF3FF, ground: 0xB8C8D6, hemi: 1.3, sun: 0xFFFFFF, sunI: 2.1, at: [-3, 5, 2]},
  desert: {sky: 0xFFE3B8, ground: 0xB97A4A, hemi: 1.15, sun: 0xFFE7C2, sunI: 2.7, at: [-4, 6, 1]},
  market: {sky: 0xE2F1FF, ground: 0xA89878, hemi: 1.2, sun: 0xFFF4E2, sunI: 2.4, at: [-3, 6, 2]},
  beach: {sky: 0xD4F1FF, ground: 0xD9B87A, hemi: 1.25, sun: 0xFFF6E0, sunI: 2.6, at: [-3, 6, 2]},
  space: {sky: 0x9B86E0, ground: 0x2A1F5C, hemi: 1.1, sun: 0xC8F6FF, sunI: 2, at: [3, 5, -2]},
  farm: {sky: 0xE2F6E8, ground: 0x6E9A4A, hemi: 1.2, sun: 0xFFF4E2, sunI: 2.5, at: [-3, 6, 2]}
};
const hazeOf = id => { if (style.enabled()) return new T.Color(style.haze(id)); const [r, g, b] = (LOOKS[id] || LOOKS.stadium).haze.split(',').map(Number); return new T.Color(r / 255, g / 255, b / 255); };
/** The light and haze at z (blending into the next place's as you come to its gate). */
export function look(st, z) {
  const zone = R.zoneAt(st.co, z), next = R.zoneAt(st.co, zone.z0 + R.ZONE), k = clamp((z - (zone.z0 + R.ZONE - 28)) / 28, 0, 1);
  const a = style.light(zone.theme.id, LIGHT[zone.theme.id]), b = style.light(next.theme.id, LIGHT[next.theme.id]);
  const c = (x, y) => new T.Color(x).lerp(new T.Color(y), k);
  return {sky: c(a.sky, b.sky), ground: c(a.ground, b.ground), hemi: a.hemi + (b.hemi - a.hemi) * k, sun: c(a.sun, b.sun), sunI: a.sunI + (b.sunI - a.sunI) * k,
    at: a.at.map((v, i) => v + (b.at[i] - v) * k), haze: hazeOf(zone.theme.id).lerp(hazeOf(next.theme.id), k)};
}
/** Brings the world up to where the camera is: the chunks from just behind it to the haze, the lane things in view
 *  (knocked flying, picked up, spinning, blinking). */
export function update(st, now) {
  if (!ROOT) return;
  syncStyle();
  cityBus.sync();
  fieldLogo.sync();
  FRAME++;
  const t = now / 1000, run = st.run, cz = st.camZ, key = `${st.co.n}|${st.co.k}${st.co.hard ? 'h' : ''}`;
  // the places' models (return-models.js): this one's and the next two's asked for in time; what was built before its
  // place's came in, built again with them while it's still off in the haze
  for (let z = cz; z <= cz + 2 * R.ZONE; z += R.ZONE) models.want(R.zoneAt(st.co, z).theme.id);
  if (models.version() !== MODELS_SEEN) { MODELS_SEEN = models.version(); renew(cz + 75); }
  // the ground beyond the last chunk, out to the horizon (all haze by then)
  if (!FAR_GROUND) { FAR_GROUND = new T.Mesh(new T.PlaneGeometry(4000, 3000).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({color: 0x808080})); ROOT.add(bend(FAR_GROUND)); }
  FAR_GROUND.position.set(0, -.03, -(cz + AHEAD + 1500));
  FAR_GROUND.visible = true;
  const farId = R.zoneAt(st.co, cz + AHEAD).theme.id;
  FAR_GROUND.material.color.set(style.ground(farId, GROUNDS[farId]).base);
  // the chunks
  const i0 = Math.floor((cz - BEHIND) / CHUNK), i1 = Math.floor((cz + AHEAD) / CHUNK);
  // (one new chunk a frame, near to far, so building them never holds a frame up; but all of those near you at once)
  let built = 0;
  for (let i = i0; i <= i1; i++) {
    const ck = key + '|' + i, have = LIVE.has('c:' + ck);
    const e = keep('c:' + ck, () => chunk(st, i), have || built === 0 || i * CHUNK < cz + 45);
    if (!have && e) built++;
    if (e) e.traverse(o => { if (o.userData.spin) o.rotation.z = t * o.userData.spin; });
  }
  // the gates (and their goal lines' pylons)
  for (let z = Math.ceil((cz - 4) / R.ZONE) * R.ZONE; z < cz + AHEAD; z += R.ZONE) {
    if (z <= 0) continue;
    const th = R.zoneAt(st.co, z + .01).theme;
    keep(`g:${key}|${z}`, () => {
      const g = gateOf(th).clone(); g.position.set(0, 0, -z);
      const b = new Batch(); pylons(b, z, th.id);
      const m = b.mesh(mats().vcs);
      if (m) { m.userData.own = true; g.add(m); } // (the pylons are this gate's own: the gate itself is shared)
      return g;
    });
  }
  if (run) {
    const A = R.ahead(run, 120, 4 + (st.lag || 0)); // (and further back while he's held back in a pothole: views/return.js)
    // the barricades and banners (knocked flying after a hit)
    A.rows.forEach(({row, d}) => row.lanes.forEach((type, l) => {
      if (!type) return;
      const z = run.z + d, id = R.zoneAt(st.co, z).theme.id, o = keep(`r:${key}|${row.i}|${l}`, () => { const g = obstacleOf(type, id).clone(); g.position.set(R.xOf(null, l), 0, -z); return g; });
      const kn = type !== 'hole' && st.knocked && st.knocked.get(`${row.i}:${l}`), k = kn ? Math.min(1, (now - kn.at) / 650) : 0;
      if (o) {
        const side = l === 0 ? -1 : 1;
        o.position.set(R.xOf(null, l) + side * k * 4.5, Math.max(0, 3.2 * k - 4 * k * k), -z);
        o.rotation.set(-k * 2, 0, -side * k * 1.3);
        o.visible = k < 1;
        o.children.forEach(ch => { if (ch.userData.blink) ch.visible = Math.floor(t * 2.5) % 2 === 0; });
      }
      // a pothole's cone, just before it (core CONE): kicked on ahead, tumbling off to the side, when he ran through it
      if (type === 'hole') {
        const kc = st.knocked && st.knocked.get(`cone:${row.i}:${l}`), u = kc ? Math.min(1, (now - kc.at) / CONE_MS) : 0;
        const c = keep(`k:${key}|${row.i}|${l}`, () => coneObj().clone(), u < 1);
        if (c) {
          const f = coneFly(u, kc ? kc.side : 0, kc && kc.ahead);
          c.position.set(R.xOf(null, l) + f.x, f.y, -(R.coneZ(row) + f.z));
          c.rotation.set(f.rx, f.ry, -f.rz);
          c.visible = u < 1;
        }
      }
    }));
    // the vehicles
    A.sets.forEach(({set}) => set.plats.forEach((p, j) => keep(`v:${key}|${set.i}|${j}`, () => vehicleOf(p, R.zoneAt(st.co, p.z0).theme))));
    // the power-ups (gone once picked up)
    A.items.forEach(({item}) => {
      const big = !!st.co.hard, k = big ? BIG : 1, o = keep(`i:${key}|${item.i}`, () => itemOf(item.kind, big).clone());
      if (!o) return;
      const g = R.groundAt(st.co, item.lane, item.z), bob = Math.sin(t * 3 + item.i) * .12, pulse = .5 + .5 * Math.sin(t * 5 + item.i);
      o.visible = !(st.got && st.got.has(item.i));
      o.position.set(R.xOf(null, item.lane), g, -item.z);
      if (o.userData.arcadePickup) { animateArcadeItem(o, t, item.i, st.camX || 0, item.z - st.camZ); return; }
      const spin = o.children[0], y = big ? 1.35 : 1;
      spin.position.y = y + bob; spin.rotation.y = t * 2.2 + item.i;
      const glow = o.children[1]; glow.position.y = y + bob; glow.scale.setScalar(k * (1.9 + .5 * pulse));
      const ring = o.children[2]; ring.position.y = .03; ring.scale.setScalar(k * (1 + .15 * pulse));
    });
    // the coins (the owner's first run of the day): one instanced mesh
    coinsUpdate(st, A, t);
  } else coinsUpdate(st, null, t);
  // let go of whatever's out of view
  for (const [k, e] of LIVE) {
    if (e.seen === FRAME) continue;
    ROOT.remove(e.obj);
    if (k.startsWith('c:') || k.startsWith('v:')) e.obj.traverse(o => { if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); });
    else if (k.startsWith('g:')) e.obj.traverse(o => { if (o.userData.own) o.geometry.dispose(); });
    LIVE.delete(k);
  }
}
