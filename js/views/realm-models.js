// The Realm's buildings in 3D (views/realm-3d.js draws them): medieval, each made of simple solids baked into a few
// meshes (one a material, the colours painted on the vertices) so a whole lot is a few hundred draw calls at most; a
// look per level (taller, more to it, the roofs' trim going from iron to gold). Tiles are one unit; a building of size
// s stands on an s x s square centred on its group's origin, y up. A house's colours (pri, sec) and its sigil (a
// crown, a tower, a star... drawn on its banners) are its own.
// Exports: init(T, BU), mats(), model(kind, level, house) → THREE.Group, HAS_TOP, scaffold(size), rubble(size),
// troopParts(kind, house), wallParts(), WALL_TINT, bannerTexture(house).
let T = null, BU = null, MATS = null;
const TEX = new Map();
const GEO = new Map();

export function init(three, bu) {
  T = three; BU = bu;
  MATS = {
    paint: new T.MeshStandardMaterial({vertexColors: true, roughness: .78, metalness: .02, envMapIntensity: .55}),
    gloss: new T.MeshStandardMaterial({vertexColors: true, roughness: .4, metalness: .06, envMapIntensity: .8}),
    metal: new T.MeshStandardMaterial({vertexColors: true, roughness: .38, metalness: .8, envMapIntensity: 1}),
    glass: new T.MeshStandardMaterial({vertexColors: true, roughness: .1, metalness: .3, transparent: true, opacity: .55, envMapIntensity: 1.2, depthWrite: false}),
    glow: new T.MeshBasicMaterial({vertexColors: true, toneMapped: false})
  };
}
export const mats = () => MATS;

// ---------------------------------------------------------------------------------------------------- building kit
// Parts go into a kit with a colour and a material; build() bakes each material's parts into one mesh.
class Kit {
  constructor(flat = false) { this.p = {}; this.tex = []; this.flat = flat; } // (flat: everything in one mesh, for instancing)
  add(geo, color, mat = 'paint', pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    if (this.flat || !mat) mat = 'paint';
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    g.clearGroups();
    g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...pos), new T.Quaternion().setFromEuler(new T.Euler(...rot)), new T.Vector3(...scl)));
    const c = new T.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    (this.p[mat] = this.p[mat] || []).push(g);
    return this;
  }
  box(w, h, d, color, at = [0, 0, 0], o = {}) { return this.add(new T.BoxGeometry(w, h, d), color, o.mat, [at[0], at[1] + h / 2, at[2]], o.rot || [0, 0, 0]); }
  cyl(rt, rb, h, color, at = [0, 0, 0], o = {}) { return this.add(new T.CylinderGeometry(rt, rb, h, o.seg || 20, 1, !!o.open), color, o.mat, [at[0], at[1] + (o.mid ? 0 : h / 2), at[2]], o.rot || [0, 0, 0], o.scl || [1, 1, 1]); }
  rod(r, from, to, color, o = {}) {
    const a = new T.Vector3(...from), b = new T.Vector3(...to), d = b.clone().sub(a), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
    const e = new T.Euler().setFromQuaternion(q);
    return this.cyl(r, r, d.length(), color, a.add(b).multiplyScalar(.5).toArray(), {...o, mid: true, rot: [e.x, e.y, e.z]});
  }
  ball(r, color, at, o = {}) { return this.add(new T.SphereGeometry(r, o.seg || 18, o.rows || 12, 0, Math.PI * 2, 0, o.cap || Math.PI), color, o.mat, at, o.rot || [0, 0, 0], o.scl || [1, 1, 1]); }
  ring(r, tube, color, at, o = {}) { return this.add(new T.TorusGeometry(r, tube, 8, o.seg || 28, o.arc || Math.PI * 2), color, o.mat, at, o.rot || [Math.PI / 2, 0, 0]); }
  rock(r, color, at, o = {}) { return this.add(new T.DodecahedronGeometry(r, 0), color, o.mat, at, o.rot || [0, 0, 0], o.scl || [1, 1, 1]); }
  /** A four-sided roof (a pyramid) of width w, depth d, height h, its base at y. */
  pyramid(w, d, h, color, at, o = {}) {
    const g = new T.CylinderGeometry(0, Math.SQRT1_2, h, 4, 1);
    g.rotateY(Math.PI / 4); // (square to the axes first, then stretched to w x d)
    return this.add(g, color, o.mat, [at[0], at[1] + h / 2, at[2]], [0, 0, 0], [w, 1, d]);
  }
  /** A gabled roof along x: w long, d deep, h high, its eaves at y (a three-sided prism, its ridge up). */
  gable(w, d, h, color, at, o = {}) {
    return this.add(new T.CylinderGeometry(1, 1, 1, 3, 1), color, o.mat, [at[0], at[1] + h / 3, at[2]], [-Math.PI / 2, 0, Math.PI / 2], [d / 1.732, w, h / 1.5]);
  }
  /** Merlons along the top of a w x d rectangle at height y (centre cx, cz). */
  merlons(w, d, y, color, at = [0, 0, 0], o = {}) {
    const s = o.size || .16, gap = o.gap || .3;
    const run = (len, f) => { const n = Math.max(2, Math.floor(len / gap)); for (let i = 0; i < n; i++) f(-len / 2 + (i + .5) * len / n); };
    run(w, x => { this.box(s, s, s, color, [at[0] + x, y, at[2] - d / 2 + s / 2]); this.box(s, s, s, color, [at[0] + x, y, at[2] + d / 2 - s / 2]); });
    run(d, z => { this.box(s, s, s, color, [at[0] - w / 2 + s / 2, y, at[2] + z]); this.box(s, s, s, color, [at[0] + w / 2 - s / 2, y, at[2] + z]); });
    return this;
  }
  /** Merlons round the top of a round tower of radius r at height y. */
  merlonRing(r, y, color, at = [0, 0, 0], n = 8, s = .14) {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.box(s, s, s, color, [at[0] + Math.cos(a) * r, y, at[2] + Math.sin(a) * r], {rot: [0, -a, 0]}); }
    return this;
  }
  /** A slab with rounded corners (extruded), w x d, h thick, at y. */
  slab(w, d, h, r, color, at = [0, 0, 0], o = {}) {
    const s = new T.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r);
    s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: !!o.bevel, bevelSize: .03, bevelThickness: .03, bevelSegments: 2, curveSegments: 6});
    return this.add(g, color, o.mat, [at[0], at[1] + h, at[2]], [Math.PI / 2, 0, 0]);
  }
  /** A flat quad with its own texture (a banner, a sign): kept apart, it isn't baked. */
  plane(w, h, tex, at, rot = [0, 0, 0], o = {}) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({map: tex, roughness: o.rough ?? .8, metalness: 0, transparent: !!o.alpha, alphaTest: o.alpha ? .4 : 0,
      side: o.double ? T.DoubleSide : T.FrontSide, envMapIntensity: .4, polygonOffset: true, polygonOffsetFactor: -1}));
    m.position.set(...at); m.rotation.set(...rot);
    m.receiveShadow = true; m.castShadow = !!o.shadow;
    this.tex.push(m);
    return this;
  }
  build() {
    const g = new T.Group();
    Object.entries(this.p).forEach(([k, list]) => {
      const geo = BU.mergeGeometries(list, false);
      list.forEach(x => x.dispose());
      geo.computeBoundingSphere();
      const m = new T.Mesh(geo, MATS[k]);
      m.castShadow = k !== 'glass' && k !== 'glow';
      m.receiveShadow = true;
      g.add(m);
    });
    this.tex.forEach(m => g.add(m));
    return g;
  }
}

// ---------------------------------------------------------------------------------------------------- textures
function canvasTex(key, w, h, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}
const hex = n => '#' + new T.Color(n).getHexString();
// A sigil's charge, drawn in a 100 x 100 box.
const CHARGES = {
  crown: g => { g.beginPath(); g.moveTo(14, 72); g.lineTo(14, 34); g.lineTo(32, 52); g.lineTo(50, 26); g.lineTo(68, 52); g.lineTo(86, 34); g.lineTo(86, 72); g.closePath(); g.fill(); g.fillRect(14, 76, 72, 10); },
  tower: g => { g.fillRect(30, 34, 40, 54); [26, 44, 62].forEach(x => g.fillRect(x, 20, 12, 14)); g.clearRect(44, 66, 12, 22); },
  star: g => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 16 : 38; g.lineTo(50 + Math.cos(a) * r, 52 + Math.sin(a) * r); } g.closePath(); g.fill(); },
  moon: g => { g.beginPath(); g.arc(50, 52, 34, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(64, 44, 30, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; },
  sword: g => { g.fillRect(46, 14, 8, 58); g.fillRect(30, 66, 40, 8); g.fillRect(46, 74, 8, 14); g.beginPath(); g.arc(50, 90, 6, 0, Math.PI * 2); g.fill(); },
  sun: g => { g.beginPath(); g.arc(50, 52, 18, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(50 + Math.cos(a) * 24, 52 + Math.sin(a) * 24); g.lineTo(50 + Math.cos(a) * 38, 52 + Math.sin(a) * 38); g.stroke(); } },
  key: g => { g.lineWidth = 8; g.beginPath(); g.arc(50, 30, 14, 0, Math.PI * 2); g.stroke(); g.fillRect(46, 42, 8, 46); g.fillRect(54, 70, 14, 7); g.fillRect(54, 80, 10, 7); },
  axe: g => { g.fillRect(46, 18, 8, 72); g.beginPath(); g.moveTo(54, 24); g.quadraticCurveTo(86, 30, 82, 56); g.quadraticCurveTo(70, 44, 54, 46); g.closePath(); g.fill(); }
};
/** A house's banner: its colour, a border, its sigil, a swallowtail. */
export function bannerTexture(h) {
  return canvasTex(`banner:${h.pri}:${h.sec}:${h.sigil}`, 128, 256, (g, w, H) => {
    g.fillStyle = hex(h.pri);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, H); g.lineTo(w / 2, H - 46); g.lineTo(0, H); g.closePath(); g.fill();
    g.strokeStyle = hex(h.sec); g.lineWidth = 7;
    g.beginPath(); g.moveTo(6, 4); g.lineTo(w - 6, 4); g.lineTo(w - 6, H - 12); g.lineTo(w / 2, H - 56); g.lineTo(6, H - 12); g.closePath(); g.stroke();
    g.save(); g.translate(14, 52); g.scale(1, 1); g.fillStyle = hex(h.sec); g.strokeStyle = hex(h.sec);
    (CHARGES[h.sigil] || CHARGES.crown)(g);
    g.restore();
  });
}

// ---------------------------------------------------------------------------------------------------- per level
// Trim by level: iron, bronze, silver, gold.
const TRIM = [0x4A4D52, 0x4A4D52, 0x4A4D52, 0x9A6B3A, 0x9A6B3A, 0xBFC4CB, 0xBFC4CB, 0xD9AD3C, 0xD9AD3C, 0xE8BE4A, 0xE8BE4A, 0xF2CB55];
export const trimOf = l => TRIM[Math.max(0, Math.min(TRIM.length - 1, l - 1))];
const STONE = 0x9A958C, STONE2 = 0x7C776F, DARKSTONE = 0x55524D, WOOD = 0x7B5434, DARKWOOD = 0x4B321F, THATCH = 0x927546, PLASTER = 0xB3AA94,
  IRON = 0x3F4247, GOLD = 0xE2B23C, DIRT = 0x7E6347, COBBLE = 0x8C8478, FIRE = 0xFF8A1E;
// Small, uneven stones and exposed soil keep procedural buildings grounded beside the painted building sprites.
// All the detail is baked into the existing meshes; foundations still finish at y .08 within the same footprint.
function pad(k, s, l, color = COBBLE) {
  const earth = color === DIRT, dark = color === DARKSTONE;
  const colors = earth ? [0x584B37, 0x65543E, 0x706049, 0x4D4535] : dark ? [0x42443E, 0x51514A, 0x5D5B51, 0x45473F] : [0x5F5E51, 0x6D6A5C, 0x59594E, 0x777163];
  k.slab(s - .18, s - .18, .025, .38, 0x3F3C2E, [0, .005, 0]);
  k.slab(s - .32, s - .32, .025, .32, earth ? 0x564833 : dark ? 0x3C4038 : 0x4D4D41, [0, .025, 0]);
  const n = Math.max(4, Math.round((s - .5) / .37)), step = (s - .48) / n;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    // An offset bond, with chipped corners and occasional gaps of bare soil.
    const i = row * n + col, x = (col - (n - 1) / 2) * step + (row % 2 ? .045 : -.045), z = (row - (n - 1) / 2) * step;
    if (((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) || (earth && i % 5 === 0)) continue;
    k.box(step - .035 - (i % 3) * .01, .018 + (i % 3) * .004, step - .045, colors[(row * 3 + col) % colors.length], [x, .05, z], {rot: [0, ((i % 5) - 2) * .018, 0]});
  }
  for (let i = 0; i < 11; i++) {
    const a = i * Math.PI * 2 / 11 + .15, r = s * .44, p = .045 + (i % 3) * .015;
    k.rock(p, colors[i % colors.length], [Math.cos(a) * r, .025, Math.sin(a) * r], {scl: [1.2, .45, .9], rot: [0, a, .2]});
  }
  if (l >= 4) [-1, 1].forEach(x => [-1, 1].forEach(z => k.box(.13, .025, .13, trimOf(l), [x * (s * .5 - .32), .045, z * (s * .5 - .32)], {mat: 'metal'})));
}
/** A planked rotating deck, with visible seams and a narrow iron retaining hoop. */
function timberDeck(k, r, y) {
  k.cyl(r, r, .035, DARKWOOD, [0, y, 0], {seg: 24});
  const n = Math.max(5, Math.round(r * 2 / .18)), step = r * 2 / n;
  for (let i = 0; i < n; i++) {
    const z = -r + (i + .5) * step, edge = Math.abs(z) + step * .44, w = Math.sqrt(Math.max(0, r * r - edge * edge)) * 2;
    k.box(w, .018, step * .88, [0x60472E, 0x6E5337, 0x57412D][i % 3], [0, y + .035, z]);
    if (w > .5) [-1, 1].forEach(sd => k.cyl(.012, .012, .006, IRON, [sd * (w / 2 - .09), y + .054, z], {seg: 5}));
  }
  k.ring(r - .012, .016, IRON, [0, y + .04, 0], {mat: 'metal', seg: 24});
}
const banner = (k, house, at, rot = [0, 0, 0], w = .34, h = .68) => k.plane(w, h, bannerTexture(house), at, rot, {alpha: true, double: true});
const flag = (k, house, at, pole = .6) => {
  k.cyl(.018, .018, pole, 0x3A3A3A, at, {mat: 'metal', seg: 6});
  banner(k, house, [at[0] + .14, at[1] + pole - .14, at[2]], [0, 0, 0], .26, .3);
};

const BUILD = {
  keep(k, l, h) {
    pad(k, 4, l, 0x857D72);
    const H = 1.5 + .28 * Math.min(l, 7), w = 1.6 + .05 * l;
    // the great tower: stone, a band of darker stone, arrow slits, merlons round its top
    k.box(w, H, w, STONE, [0, .08, 0]);
    k.box(w + .06, .14, w + .06, STONE2, [0, .08 + H * .55, 0]);
    k.box(w + .12, .1, w + .12, STONE2, [0, .08 + H, 0]);
    k.merlons(w + .12, w + .12, .18 + H, STONE, [0, 0, 0], {size: .17, gap: .32});
    [.35, .7].forEach(f => [-1, 1].forEach(sd => { k.box(.06, .26, .02, 0x1C1A18, [sd * w * .25, .08 + H * f, w / 2 + .01]); k.box(.02, .26, .06, 0x1C1A18, [w / 2 + .01, .08 + H * f, sd * w * .25]); }));
    // the gate: a dark arch, an iron portcullis
    k.box(.56, .62, .1, 0x1A1714, [0, .08, w / 2 + .02]);
    k.cyl(.28, .28, .1, 0x1A1714, [0, .7, w / 2 + .02], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 16});
    for (let i = 0; i < 4; i++) k.box(.025, .8, .03, IRON, [-.21 + i * .14, .08, w / 2 + .08], {mat: 'metal'});
    // banners on its face, a flag on top
    banner(k, h, [-w * .3, .08 + H * .72, w / 2 + .03], [0, 0, 0], .32, .62);
    banner(k, h, [w * .3, .08 + H * .72, w / 2 + .03], [0, 0, 0], .32, .62);
    if (l >= 5) { k.pyramid(w * .7, w * .7, .9, h.pri, [0, .18 + H, 0]); k.ball(.08, trimOf(l), [0, 1.1 + H, 0], {mat: 'metal'}); }
    else flag(k, h, [0, .26 + H, 0], .7);
    // turrets at the corners (two, then four), conical roofs in the house's colour, from the curtain wall up
    const corners = l >= 2 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 1], [1, 1]];
    const tr = .3 + .015 * l, th = H * .78, at = 1.5;
    corners.forEach(([a, b]) => {
      k.cyl(tr, tr * 1.08, th, STONE, [a * at, .08, b * at], {seg: 14});
      k.merlonRing(tr, .08 + th, STONE2, [a * at, 0, b * at], 7, .12);
      k.cyl(0, tr * 1.25, .7 + .04 * l, h.pri, [a * at, .2 + th, b * at], {seg: 14});
      k.ball(.05, trimOf(l), [a * at, .92 + th + .04 * l, b * at], {mat: 'metal'});
    });
    // the curtain wall between them (from level 3), with a walk of merlons
    if (l >= 3) {
      const wh = .55 + .05 * l;
      [[0, -at, 2 * at, .26], [0, at, 2 * at, .26]].forEach(([x, z, len, t]) => { if (z > 0) { k.box((len - 1.1) / 2, wh, t, STONE2, [-(len + 1.1) / 4, .08, z]); k.box((len - 1.1) / 2, wh, t, STONE2, [(len + 1.1) / 4, .08, z]); } else k.box(len, wh, t, STONE2, [x, .08, z]); });
      [-at, at].forEach(x => k.box(.26, wh, 2 * at, STONE2, [x, .08, 0]));
      k.merlons(2 * at + .26, 2 * at + .26, .08 + wh, STONE2, [0, 0, 0], {size: .13, gap: .36});
    }
  },
  hut(k, l, h) {
    pad(k, 2, l, DIRT);
    k.box(1.1, .62, .95, WOOD, [0, .08, -.1]);
    [-.5, .5].forEach(x => k.box(.08, .66, .08, DARKWOOD, [x, .08, .38]));
    k.pyramid(1.45, 1.3, .62, THATCH, [0, .7, -.1]);
    k.box(.3, .44, .03, DARKWOOD, [-.2, .08, .38]);
    // a sawhorse with a log, an axe in a stump
    k.box(.5, .05, .1, WOOD, [.5, .3, .62]);
    k.cyl(.07, .07, .6, 0x8A6A44, [.5, .38, .62], {rot: [0, 0, Math.PI / 2], mid: true, seg: 8});
    k.cyl(.12, .14, .2, 0x8A6A44, [-.55, .08, .6], {seg: 10});
    k.box(.03, .26, .03, DARKWOOD, [-.55, .28, .6], {rot: [0, 0, .3]});
    k.box(.1, .08, .02, IRON, [-.5, .5, .6], {mat: 'metal'});
  },
  mine(k, l, h) {
    pad(k, 3, l, DIRT);
    // the hill: rocks heaped up, bigger with each level
    const s = 1 + .04 * l;
    [[-.4, -.5, .75], [.5, -.45, .62], [0, -.2, .82], [-.85, .15, .5], [.85, .1, .48], [.1, -.85, .55]].forEach(([x, z, r], i) => k.rock(r * s, i % 2 ? 0x7A746C : 0x8B847A, [x, .3 * s, z], {rot: [i, i * 2, 0], scl: [1, .8, 1]}));
    // the timbered way in, its dark mouth
    k.box(.7, .66, .2, 0x15120F, [0, .08, .45]);
    [-.38, .38].forEach(x => k.box(.1, .8, .12, DARKWOOD, [x, .08, .56]));
    k.box(.9, .12, .14, DARKWOOD, [0, .84, .56]);
    k.box(.05, .1, .05, FIRE, [.48, .7, .62], {mat: 'glow'});
    // the rails and a cart (or more) of gold
    [-.15, .15].forEach(x => k.box(.04, .03, 1.1, IRON, [x, .09, 1.05], {mat: 'metal'}));
    const carts = l >= 6 ? 2 : 1;
    for (let c = 0; c < carts; c++) {
      const z = 1.05 - c * .5, x = c ? .7 : 0;
      k.box(.46, .26, .4, DARKWOOD, [x, .14, z]);
      k.box(.5, .04, .44, IRON, [x, .4, z], {mat: 'metal'});
      [[-.17, -.14], [.17, -.14], [-.17, .14], [.17, .14]].forEach(([a, b]) => k.cyl(.06, .06, .04, IRON, [x + a, .12, z + b], {rot: [0, 0, Math.PI / 2], mid: true, mat: 'metal', seg: 10}));
      for (let i = 0; i < 5; i++) k.rock(.07, GOLD, [x - .12 + (i % 3) * .12, .42 + Math.floor(i / 3) * .05, z - .06 + (i % 2) * .12], {mat: 'metal'});
    }
  },
  farm(k, l, h) {
    // the field: furrows, wheat in rows (more ripe gold rows with each level)
    k.slab(2.86, 2.86, .06, .14, 0x6B5236, [0, 0, 0]);
    const rows = 5 + Math.min(3, Math.floor(l / 3));
    for (let i = 0; i < rows; i++) {
      const z = -1.15 + i * (2.1 / (rows - 1));
      k.box(1.8, .04, .14, 0x5A4430, [-.3, .06, z]);
      for (let j = 0; j < 9; j++) {
        const x = -1.08 + j * .19, height = .13 + .01 * l + ((i + j) % 3) * .025;
        k.box(.025, height, .025, 0x86733D, [x, .1, z], {rot: [0, 0, ((j % 3) - 1) * .13]});
        k.box(.065, .09, .055, (i + j) % 2 ? 0xBA9A48 : 0x9D813C, [x, .1 + height * .7, z]);
      }
    }
    // the windmill at the back corner: a stone tower, a thatched cap, four sails
    const wx = .95, wz = -.85, wh = 1.15 + .06 * l;
    k.cyl(.26, .34, wh, PLASTER, [wx, .06, wz], {seg: 12});
    k.cyl(0, .36, .45, THATCH, [wx, .06 + wh, wz], {seg: 12});
    const hub = [wx, wh - .12, wz + .34];
    k.cyl(.05, .05, .14, DARKWOOD, hub, {rot: [Math.PI / 2, 0, 0], mid: true, seg: 8});
    [0, 1, 2, 3].forEach(i => {
      const a = i * Math.PI / 2 + .35;
      k.box(.08, .78, .02, 0xEFE6D2, [hub[0] + Math.sin(a) * .42, hub[1] - .39 + Math.cos(a) * .42, hub[2] + .06], {rot: [0, 0, -a]});
    });
    k.box(.12, .26, .02, DARKWOOD, [wx, .06, wz + .33]);
    // a scarecrow, sacks by the field
    k.box(.04, .55, .04, DARKWOOD, [-1.2, .06, 1.15]); k.box(.4, .04, .04, DARKWOOD, [-1.2, .48, 1.15]); k.ball(.08, THATCH, [-1.2, .66, 1.15]);
    k.cyl(0, .12, .1, 0x5A3E25, [-1.2, .72, 1.15], {seg: 8});
    [[1.05, .9], [1.2, 1.1]].forEach(([x, z]) => k.ball(.14, 0xD8C69A, [x, .16, z], {scl: [1, 1.2, 1]}));
  },
  treasury(k, l, h) {
    pad(k, 3, l);
    const w = 1.55 + .03 * l, H = .9 + .05 * l;
    k.box(w, H, w * .9, STONE, [0, .08, -.1]);
    k.box(w + .1, .1, w * .9 + .1, STONE2, [0, .08 + H, -.1]);
    // a dome, copper then gold
    k.ball(w * .36, l >= 6 ? GOLD : 0xB0703C, [0, .18 + H, -.1], {cap: Math.PI / 2, mat: 'metal', seg: 20});
    k.ball(.06, trimOf(l), [0, .18 + H + w * .36, -.1], {mat: 'metal'});
    // the strong door: dark oak, iron straps, a ring
    const fz = -.1 + w * .45 + .02;
    k.box(.5, .66, .05, DARKWOOD, [0, .08, fz]);
    [.25, .5].forEach(y => k.box(.54, .05, .02, IRON, [0, .08 + y, fz + .03], {mat: 'metal'}));
    k.ring(.06, .015, GOLD, [0, .45, fz + .05], {rot: [0, 0, 0], mat: 'metal'});
    // chests and coins piled outside
    const chests = Math.min(3, 1 + Math.floor(l / 4));
    for (let i = 0; i < chests; i++) {
      const x = .9 - i * .34, z = .95;
      k.box(.28, .18, .2, WOOD, [x, .08, z]); k.box(.3, .04, .22, IRON, [x, .22, z], {mat: 'metal'});
      k.box(.24, .04, .16, GOLD, [x, .26, z], {mat: 'metal'});
    }
    for (let i = 0; i < Math.min(8, 2 + l); i++) k.cyl(.07, .07, .03, GOLD, [-.95 + (i % 4) * .1, .08 + Math.floor(i / 4) * .03, .95 - (i % 3) * .05], {mat: 'metal', seg: 10});
  },
  granary(k, l, h) {
    pad(k, 3, l, DIRT);
    const r = .62 + .02 * l, H = 1.15 + .06 * l;
    k.cyl(r, r * 1.04, H, 0xA67C4E, [0, .08, -.1], {seg: 18});
    [.25, .55, .85].forEach(f => k.ring(r * 1.02, .025, DARKWOOD, [0, .08 + H * f, -.1]));
    k.cyl(0, r * 1.28, .75, THATCH, [0, .08 + H, -.1], {seg: 18});
    k.box(.34, .5, .04, DARKWOOD, [0, .08, -.1 + r]);
    // a ladder, sacks stacked
    k.box(.03, H * .8, .03, WOOD, [-.6, .08, .45], {rot: [.2, 0, 0]}); k.box(.03, H * .8, .03, WOOD, [-.4, .08, .45], {rot: [.2, 0, 0]});
    const n = Math.min(7, 2 + l);
    for (let i = 0; i < n; i++) k.ball(.13, 0xD8C69A, [.55 + (i % 3) * .24, .17 + Math.floor(i / 3) * .2, .85 - (i % 2) * .08], {scl: [1, .85, 1.1]});
  },
  barracks(k, l, h) {
    pad(k, 4, l, DIRT);
    const w = 2.8, d = 1.6, H = .8 + (l >= 4 ? .3 : 0);
    // a timbered longhouse: plaster between dark beams, a steep roof in the house's colour
    k.box(w, H, d, PLASTER, [0, .08, -.5]);
    for (let i = 0; i <= 6; i++) k.box(.07, H, .04, DARKWOOD, [-w / 2 + i * w / 6, .08, -.5 + d / 2 + .01]);
    k.box(w, .07, .04, DARKWOOD, [0, .08 + H * .5, -.5 + d / 2 + .01]);
    k.gable(w + .24, d + .24, .62, h.pri, [0, .08 + H, -.5]);
    k.box(.5, .56, .04, DARKWOOD, [0, .08, -.5 + d / 2 + .03]);
    banner(k, h, [-.8, .08 + H * .62, -.5 + d / 2 + .04]); banner(k, h, [.8, .08 + H * .62, -.5 + d / 2 + .04]);
    // the yard: straw dummies on posts, a rack of spears
    for (let i = 0; i < Math.min(4, 1 + Math.floor(l / 2)); i++) {
      const x = -1.2 + i * .55, z = 1.15;
      k.box(.05, .5, .05, DARKWOOD, [x, .08, z]); k.box(.36, .05, .05, DARKWOOD, [x, .45, z]);
      k.ball(.15, THATCH, [x, .45, z], {scl: [1, 1.3, .8]}); k.ball(.09, THATCH, [x, .7, z]);
    }
    k.box(.7, .06, .06, DARKWOOD, [1.15, .35, 1.0]); k.box(.7, .06, .06, DARKWOOD, [1.15, .12, 1.0]);
    for (let i = 0; i < 4; i++) { k.box(.025, .75, .025, WOOD, [.9 + i * .16, .08, 1.0], {rot: [0, 0, .08]}); k.cyl(0, .03, .1, IRON, [.93 + i * .16, .82, 1.0], {mat: 'metal', seg: 6}); }
  },
  camp(k, l, h) {
    pad(k, 4, l, DIRT);
    // tents round a fire, more with each level, in the house's colours
    const n = Math.min(5, 2 + Math.floor(l / 2));
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / n) + .3, r = 1.15, x = Math.cos(a) * r, z = Math.sin(a) * r;
      k.cyl(0, .5, .85, i % 2 ? h.pri : 0xE7DCC4, [x, .08, z], {seg: 6});
      k.cyl(.012, .012, .3, DARKWOOD, [x, .9, z], {seg: 4});
      k.box(.16, .3, .02, 0x1A1714, [x + Math.cos(a) * -.35, .08, z + Math.sin(a) * -.35], {rot: [0, -a + Math.PI / 2, 0]});
    }
    // the fire: a ring of stones, the flames
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.rock(.08, 0x6E6A64, [Math.cos(a) * .25, .12, Math.sin(a) * .25]); }
    k.cyl(0, .14, .32, FIRE, [0, .08, 0], {mat: 'glow', seg: 8});
    k.cyl(0, .08, .4, 0xFFD25A, [0, .08, 0], {mat: 'glow', seg: 8});
    flag(k, h, [1.55, .08, -1.55], 1.1);
  },
  cannon(k, l, h) {
    // an emplacement: a ring of earth and timber (stone from level 4) round a turning deck; the powder and shot by it
    pad(k, 3, l, l >= 4 ? COBBLE : DIRT);
    k.cyl(.95, 1.02, .16, l >= 4 ? 0x4F5148 : DARKWOOD, [0, .08, 0], {seg: 20});
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      k.box(.3, .12, .12, l >= 4 ? [0x636153, 0x777162, 0x585B50][i % 3] : [0x5B422C, 0x705337, 0x4F3B2A][i % 3], [Math.sin(a) * .94, .1, Math.cos(a) * .94], {rot: [0, a, 0]});
    }
    timberDeck(k, .7, .24);
    for (let i = 0; i < 3 + Math.min(3, l >> 1); i++) k.ball(.07, 0x2A2B2E, [-1.05 + (i % 3) * .15, .14 + Math.floor(i / 3) * .12, -.95], {mat: 'metal', seg: 10, rows: 8});
    k.cyl(.12, .12, .22, DARKWOOD, [1.0, .08, -.95], {seg: 10}); k.ring(.122, .012, IRON, [1.0, .2, -.95]);
  },
  cannonTop(k, l, h) {
    // the gun on its carriage, turning: a timber carriage on spoked wheels, the iron barrel (bigger, banded in trim,
    // and from level 8 gold-mouthed with the house's banners on its carriage)
    const tier = l >= 8 ? 2 : l >= 4 ? 1 : 0, len = 1.2 + .1 * tier, r = .15 + .025 * tier;
    k.box(.42, .22, .95, tier === 2 ? 0x3A2A1E : WOOD, [0, .3, -.05]);
    [-1, 1].forEach(sd => {
      k.cyl(.24, .24, .07, DARKWOOD, [sd * .3, .5, .18], {rot: [0, 0, Math.PI / 2], mid: true, seg: 14});
      k.ring(.24, .02, IRON, [sd * .34, .5, .18], {rot: [0, Math.PI / 2, 0], mat: 'metal'});
      k.cyl(.17, .17, .06, DARKWOOD, [sd * .26, .43, -.42], {rot: [0, 0, Math.PI / 2], mid: true, seg: 12});
      for (let i = 0; i < 4; i++) k.box(.035, .38, .035, 0x86613C, [sd * .342, .31, .18], {rot: [i * Math.PI / 4, 0, 0]});
      k.cyl(.055, .055, .085, IRON, [sd * .35, .5, .18], {rot: [0, 0, Math.PI / 2], mid: true, mat: 'metal', seg: 8});
      k.box(.018, .16, .82, 0x493522, [sd * .215, .34, -.05]);
      [-.32, .24].forEach(z => k.box(.025, .19, .045, IRON, [sd * .23, .32, z], {mat: 'metal'}));
    });
    k.cyl(.05, .05, .7, IRON, [0, .5, .18], {rot: [0, 0, Math.PI / 2], mid: true, mat: 'metal', seg: 8});
    const tilt = -.12, y = .66, z = .15;
    k.cyl(r * .85, r * 1.15, len, 0x2A2B2E, [0, y, z], {rot: [Math.PI / 2 + tilt, 0, 0], mid: true, mat: 'metal', seg: 16});
    k.ball(r * 1.1, 0x2A2B2E, [0, y + Math.sin(-tilt) * -len / 2, z - len / 2], {mat: 'metal', seg: 12});
    const band = tier ? trimOf(l) : IRON;
    [-.35, .1, .45].forEach(f => k.ring(r * (1 - f * .25) + .015, .025, band, [0, y - Math.sin(tilt) * f * len, z + f * len], {rot: [tilt, 0, 0], mat: 'metal'}));
    k.ring(r * .9, .04, tier === 2 ? GOLD : 0x2A2B2E, [0, y - Math.sin(tilt) * len / 2, z + len / 2], {rot: [tilt, 0, 0], mat: 'metal'});
    if (tier === 2) [-1, 1].forEach(sd => banner(k, h, [sd * .215, .34, -.05], [0, sd * Math.PI / 2, 0], .3, .22));
  },
  hatchery(k, l, h) {
    // (drawn from its picture when that's in: realm-sprites.js) a stone pen, a fire pit, eggs in the straw
    pad(k, 4, l, DARKSTONE);
    [[0, -1.6, 3.4, .25], [0, 1.6, 3.4, .25]].forEach(([x, z, w, t]) => k.box(w, .6 + .04 * l, t, DARKSTONE, [x, .08, z]));
    [-1.6, 1.6].forEach(x => k.box(.25, .6 + .04 * l, 3.4, DARKSTONE, [x, .08, 0]));
    k.cyl(.9, 1, .1, THATCH, [0, .08, 0], {seg: 16});
    for (let i = 0; i < Math.min(6, 1 + Math.ceil(l / 2)); i++) { const a = i * 1.1; k.ball(.18, i % 2 ? 0x7A1E1E : 0x4A2A22, [Math.cos(a) * .45, .3, Math.sin(a) * .45], {scl: [.8, 1.2, .8], mat: 'gloss'}); }
    k.cyl(0, .2, .35, FIRE, [0, .18, 0], {mat: 'glow', seg: 8});
    flag(k, h, [1.6, .7, -1.6], .9);
  },
  ballista(k, l, h) {
    pad(k, 3, l);
    // Mortar behind two offset courses of weathered stone; the old bright slab and crenellations dominated the bow.
    k.cyl(.92, 1.01, .27, 0x3F433B, [0, .08, 0], {seg: 24});
    for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) {
      const a = (i + row * .5) * Math.PI / 8, r = row ? .88 : .92;
      k.box(.31, .115, .18, [0x686659, 0x55594F, 0x75705F, 0x5F6154][(i + row) % 4], [Math.sin(a) * r, .09 + row * .13, Math.cos(a) * r], {rot: [0, a, 0]});
    }
    timberDeck(k, .76, .305);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, x = Math.sin(a) * .88, z = Math.cos(a) * .88;
      k.box(.2, .055, .18, 0x4E5147, [x, .35, z], {rot: [0, a, 0]});
      k.cyl(.025, .03, .025, IRON, [x, .405, z], {mat: 'metal', seg: 6});
    }
    // A small bolt rack makes the emplacement read as a working weapon at the village's normal zoom.
    [-.99, -.81].forEach(x => k.box(.045, .16, .45, DARKWOOD, [x, .08, -.88]));
    for (let i = 0; i < 3; i++) {
      const x = -.99 + i * .09;
      k.cyl(.018, .018, .66, 0x8B6B43, [x, .25, -.88], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 5});
      k.cyl(0, .034, .09, IRON, [x, .25, -.51], {rot: [Math.PI / 2, 0, 0], mid: true, mat: 'metal', seg: 5});
    }
  },
  ballistaTop(k, l, h) {
    // The turning part keeps its original pivot: oak stock, braced pedestal, iron joints, torsion ropes, loaded bolt.
    k.cyl(.19, .22, .05, IRON, [0, .36, 0], {seg: 12, mat: 'metal'});
    k.cyl(.12, .16, .35, DARKWOOD, [0, .41, 0], {seg: 8});
    [.44, .67].forEach(y => k.ring(.125, .018, IRON, [0, y, 0], {seg: 12, mat: 'metal'}));
    [-1, 1].forEach(sd => k.box(.075, .38, .085, 0x665037, [0, .4, sd * .15], {rot: [sd * .5, 0, 0]}));
    k.box(.3, .18, 1.25, 0x60472E, [0, .74, .1], {rot: [-.12, 0, 0]});
    // Parallel grain lines and dark inset rail give the stock depth without adding another material or texture.
    [-.11, .11].forEach(x => k.box(.018, .015, 1.17, 0x8B6B45, [x, .925, .1], {rot: [-.12, 0, 0]}));
    k.box(.055, .02, 1.1, 0x332B21, [0, .925, .1], {rot: [-.12, 0, 0]});
    [-.35, .06, .47].forEach(z => {
      k.box(.32, .025, .055, IRON, [0, .925 + (z - .1) * .12, z], {mat: 'metal', rot: [-.12, 0, 0]});
      [-.155, .155].forEach(x => k.box(.018, .16, .055, IRON, [x, .755 + (z - .1) * .12, z], {mat: 'metal'}));
    });
    const span = .75 + .03 * l;
    [-1, 1].forEach(s => {
      k.box(span, .08, .1, DARKWOOD, [s * span / 2, .82, .62], {rot: [0, s * .45, 0]});
      k.box(span * .82, .025, .105, 0x85613A, [s * span / 2, .9, .62], {rot: [0, s * .45, 0]});
      k.box(.09, .15, .2, IRON, [s * .23, .79, .62], {mat: 'metal'});
      k.cyl(.045, .045, .14, 0xA18A5D, [s * .23, .8, .62], {seg: 8});
      [.83, .865, .9].forEach(y => k.ring(.046, .009, 0x6F5C3B, [s * .23, y, .62], {seg: 8}));
      k.rod(.009, [s * span * .95, .86, .62 - span * .5 * Math.sin(.45)], [0, .92, -.21], 0xA99A78, {seg: 5});
    });
    k.cyl(.025, .025, 1.1, 0x5A3E25, [0, .92, .15], {rot: [Math.PI / 2 - .12, 0, 0], mid: true, seg: 6});
    k.cyl(0, .05, .14, trimOf(l) === 0x4A4D52 ? IRON : trimOf(l), [0, .99, .74], {rot: [Math.PI / 2 - .12, 0, 0], mid: true, seg: 6, mat: 'metal'});
    k.box(.12, .025, .14, 0xA99875, [0, .85, -.36], {rot: [-.12, 0, 0]});
    k.cyl(.045, .045, .41, IRON, [0, .83, -.44], {rot: [0, 0, Math.PI / 2], mid: true, mat: 'metal', seg: 8});
    k.box(.035, .16, .035, DARKWOOD, [.23, .7, -.44]);
  },
  tower(k, l, h) {
    pad(k, 3, l);
    const H = 1.8 + .12 * Math.min(l, 9), r = .62;
    k.cyl(r * .92, r * 1.08, H, STONE, [0, .08, 0], {seg: 14});
    [.33, .66].forEach(f => k.ring(r * 1.0, .03, STONE2, [0, .08 + H * f, 0]));
    k.cyl(r * 1.18, r * 1.0, .16, STONE2, [0, .08 + H, 0], {seg: 14});
    k.merlonRing(r * 1.08, .24 + H, STONE, [0, 0, 0], 9, .15);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; k.box(.05, .24, .05, 0x1C1A18, [Math.cos(a) * r * .98, .08 + H * .45, Math.sin(a) * r * .98], {rot: [0, -a, 0]}); }
    k.box(.3, .44, .05, DARKWOOD, [0, .08, r * 1.02]);
    if (l >= 4) { k.cyl(0, r * 1.15, .8, h.pri, [0, .55 + H, 0], {seg: 14}); flag(k, h, [0, 1.3 + H, 0], .5); }
    else flag(k, h, [0, .3 + H, 0], .7);
    // an archer up top (from level 2: two)
    for (let i = 0; i < (l >= 2 ? 2 : 1); i++) { const x = (i - .5) * .3; k.box(.12, .22, .1, h.pri, [x, .32 + H, .2]); k.ball(.06, 0x6B5A44, [x, .6 + H, .2]); }
  },
  trebuchet(k, l, h) {
    pad(k, 3, l, DIRT);
    k.cyl(.9, .95, .09, DARKWOOD, [0, .08, 0], {seg: 16});
    timberDeck(k, .9, .17);
    for (let i = 0; i < 4; i++) k.rock(.1, [0x666457, 0x777062][i % 2], [-1.05 + (i % 2) * .17, .14 + Math.floor(i / 2) * .12, -.9], {scl: [1, .8, 1]});
  },
  trebuchetTop(k, l, h) {
    // the machine on its turntable: an A-frame each side, the axle, the arm cocked back, its counterweight, the sling
    const H = 1.15 + .04 * l;
    [-.32, .32].forEach(x => {
      k.box(.08, H * 1.12, .08, WOOD, [x, .2, -.28], {rot: [.26, 0, 0]});
      k.box(.08, H * 1.12, .08, WOOD, [x, .2, .28], {rot: [-.26, 0, 0]});
      k.box(.085, .08, .75, 0x5D432B, [x, .57, 0]);
      [-.3, .3].forEach(z => k.box(.1, .08, .11, IRON, [x, .28, z], {mat: 'metal'}));
      k.box(.1, .16, .18, IRON, [x, .15 + H, 0], {mat: 'metal'});
    });
    k.box(.8, .08, .9, DARKWOOD, [0, .22, 0]);
    [-.25, 0, .25].forEach(x => k.box(.21, .018, .86, [0x62482F, 0x745538, 0x695034][Math.round((x + .25) * 4)], [x, .3, 0]));
    k.cyl(.04, .04, .74, IRON, [0, .22 + H, 0], {rot: [0, 0, Math.PI / 2], mid: true, mat: 'metal', seg: 8});
    k.box(.08, .08, 1.8, WOOD, [0, .22 + H + .35, -.2], {rot: [.65, 0, 0]});
    k.box(.36, .34, .34, 0x4E4A44, [0, .22 + H - .32, .45]);
    k.box(.38, .04, .36, IRON, [0, .22 + H + .02, .45], {mat: 'metal'});
    [-.12, .12].forEach(x => k.box(.035, .34, .36, IRON, [x, .22 + H - .32, .45], {mat: 'metal'}));
    [-1, 1].forEach(sd => k.rod(.012, [0, H + 1.12, -.91], [sd * .1, .4, -.7], 0x8E7B55, {seg: 5}));
    k.rock(.15, DARKWOOD, [0, .37, -.7], {scl: [1, .5, 1]});
    k.rock(.13, 0x77726A, [0, .4, -.7]);
  },
  cauldron(k, l, h) {
    pad(k, 3, l);
    k.cyl(.85, .95, .3, STONE, [0, .08, 0], {seg: 16});
    // the fire under it
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.box(.05, .05, .32, DARKWOOD, [Math.cos(a) * .16, .4, Math.sin(a) * .16], {rot: [0, -a, .3]}); }
    k.cyl(0, .2, .3, FIRE, [0, .38, 0], {mat: 'glow', seg: 8});
  },
  cauldronTop(k, l, h) {
    // the cauldron on its tripod, tipped a little (tipped further when it pours: realm-3d.js)
    const r = .42 + .02 * l;
    [0, 2.1, 4.2].forEach(a => k.box(.05, .9, .05, IRON, [Math.cos(a) * .5, -.85, Math.sin(a) * .5], {mat: 'metal', rot: [Math.sin(a) * -.3, 0, Math.cos(a) * .3]}));
    k.ball(r, 0x26272A, [0, -.25, 0], {cap: Math.PI * .62, rot: [Math.PI, 0, 0], mat: 'metal', seg: 18});
    k.ring(r * .78, .04, 0x26272A, [0, -.25 + r * .38, 0], {mat: 'metal'});
    k.cyl(r * .74, r * .74, .02, 0x1A1310, [0, -.25 + r * .32, 0], {seg: 18});
    k.ball(.1, FIRE, [0, -.06, 0], {mat: 'glow', scl: [1.6, .4, 1.6]});
  }
};
export const HAS_TOP = {cannon: 'cannonTop', ballista: 'ballistaTop', trebuchet: 'trebuchetTop', cauldron: 'cauldronTop'};
const TOP_Y = {cannon: 0, ballista: 0, trebuchet: 0, cauldron: 1.25};

/** A building's model (cached geometry, a fresh group each call). */
export function model(kind, level, house) {
  const key = `${kind}:${level}:${house.pri}:${house.sec}:${house.sigil}`;
  if (!GEO.has(key)) {
    const k = new Kit();
    BUILD[kind](k, Math.max(1, level), house);
    const top = HAS_TOP[kind] ? (() => { const t = new Kit(); BUILD[HAS_TOP[kind]](t, Math.max(1, level), house); return t.build(); })() : null;
    GEO.set(key, {base: k.build(), top});
  }
  const c = GEO.get(key), g = new T.Group();
  g.add(c.base.clone());
  if (c.top) {
    const top = c.top.clone();
    top.name = 'top';
    top.position.y = TOP_Y[kind] || 0;
    g.add(top);
  }
  return g;
}
/** Timber scaffolding round a building going up or being upgraded. */
export function scaffold(size) {
  const key = 'scaffold:' + size;
  if (!GEO.has(key)) {
    const k = new Kit(), H = 1.6, s = size - .2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => k.box(.07, H, .07, WOOD, [a * s / 2, 0, b * s / 2]));
    [.55, 1.15].forEach(y => [-1, 1].forEach(b => { k.box(s, .05, .05, WOOD, [0, y, b * s / 2]); k.box(.05, .05, s, WOOD, [b * s / 2, y, 0]); }));
    k.box(s * .6, .04, .3, 0xB08A55, [0, 1.15, s / 2 + .05]);
    // a pile of cut stone and a crane's beam
    for (let i = 0; i < 4; i++) k.box(.22, .14, .16, STONE, [-s / 2 + .3 + (i % 2) * .26, Math.floor(i / 2) * .14, s / 2 + .25]);
    k.box(.06, .06, s * .7, DARKWOOD, [s / 2 - .15, H, 0], {rot: [0, .3, 0]});
    GEO.set(key, k.build());
  }
  return GEO.get(key).clone();
}
/** What's left of a building knocked down in a raid: rubble and charred timber. */
export function rubble(size) {
  const key = 'rubble:' + size;
  if (!GEO.has(key)) {
    const k = new Kit(), R = (i) => ((Math.sin(i * 91.7 + size * 13.1) + 1) / 2);
    k.slab(size - .3, size - .3, .05, .2, 0x3A3530, [0, 0, 0]);
    for (let i = 0; i < 6 + size * 3; i++) {
      const s = .15 + R(i) * .35;
      k.box(s, s * .6, s, i % 3 ? 0x7A746B : 0x4F4A44, [(R(i + 1) - .5) * (size - .7), .05, (R(i + 2) - .5) * (size - .7)], {rot: [R(i + 3), R(i + 4) * 3, R(i + 5)]});
    }
    for (let i = 0; i < size; i++) k.box(.08, .08, .6, 0x2A2420, [(R(i + 7) - .5) * (size - 1), .1, (R(i + 8) - .5) * (size - 1)], {rot: [0, R(i + 9) * 3, .2]});
    GEO.set(key, k.build());
  }
  return GEO.get(key).clone();
}
/** A wall's pillar and the wall between two (one each, instanced by realm-3d.js), white, tinted per wall. */
export function wallParts() {
  if (!GEO.has('wall')) {
    const post = new Kit(true), run = new Kit(true);
    post.box(.34, .68, .34, 0xFFFFFF).box(.4, .08, .4, 0xFFFFFF, [0, .68, 0]);
    run.box(1, .5, .24, 0xFFFFFF, [.5, 0, 0]).box(.16, .14, .26, 0xFFFFFF, [.5, .5, 0]);
    const g = m => m.build().children[0].geometry;
    GEO.set('wall', {post: g(post), rail: g(run)});
  }
  return GEO.get('wall');
}
// Walls by level: a timber palisade, then stone, darker stone, stone capped in gold.
export const WALL_TINT = [0x8A6239, 0x77512E, 0xA49E94, 0x928C82, 0x76716A, 0x66615B, 0xC9A146, 0xE2B83E];

// ---------------------------------------------------------------------------------------------------- the army
/** A soldier's parts for instancing: body (torso, arms, head, helmet, what he carries) and one leg, in his house's
 *  colours. A dragon's "legs" are its wings (realm-3d.js flaps them). Units: tiles; a man is about .55 tall. */
export function troopParts(kind, h) {
  const key = `troop:${kind}:${h.pri}`;
  if (!GEO.has(key)) {
    const k = new Kit(true), leg = new Kit(true);
    const skin = 0xC9946B;
    if (kind === 'dragon') {
      const C = 0x7A1E1E, B = 0xC24A2A;
      k.ball(.32, C, [0, 0, 0], {scl: [.8, .7, 1.5]});
      k.ball(.2, B, [0, -.08, .1], {scl: [.8, .55, 1.3]});
      k.cyl(.1, .16, .5, C, [0, .18, .5], {rot: [-1.0, 0, 0], mid: true, seg: 10});
      k.ball(.15, C, [0, .38, .72], {scl: [.9, .8, 1.4]});
      [-1, 1].forEach(s => { k.cyl(0, .04, .18, 0xE8DCC0, [s * .07, .55, .66], {rot: [-.5, 0, s * .3], seg: 6}); k.ball(.03, 0xFFD25A, [s * .08, .44, .86], {mat: 'glow'}); });
      k.cyl(.12, .02, .9, C, [0, 0, -.75], {rot: [Math.PI / 2 + .2, 0, 0], mid: true, seg: 8});
      [-1, 1].forEach(s => k.box(.06, .2, .06, C, [s * .16, -.32, .2]));
      // a wing (one; instanced twice, mirrored): a membrane on two spars
      const wing = new T.BufferGeometry();
      wing.setAttribute('position', new T.Float32BufferAttribute([0, 0, .25, 1.15, .1, -.1, .9, -.05, -.45, 0, 0, .25, .9, -.05, -.45, .45, -.02, -.5, 0, 0, .25, .45, -.02, -.5, 0, 0, -.35], 3));
      wing.computeVertexNormals();
      const two = BU.mergeGeometries([wing, wing.clone().scale(1, -1, 1)], false); // (two-sided: a copy facing down)
      leg.add(two, 0x8E2A22);
      leg.box(1.15, .04, .04, 0x5A1414, [.57, .05, .07], {rot: [0, .28, 0]});
    } else if (kind === 'thief') {
      const cloak = 0x2A2A30;
      k.cyl(.11, .17, .32, cloak, [0, .06, 0], {seg: 10});
      k.ball(.09, skin, [0, .44, .02]);
      k.cyl(0, .13, .22, cloak, [0, .42, 0], {seg: 10});
      k.ball(.12, 0xC9B58A, [0, .26, -.13], {scl: [1, 1.1, .8]});
      k.box(.02, .14, .02, 0xC0C4CA, [.13, .16, .05], {rot: [.5, 0, 0]});
      leg.box(.07, .2, .08, 0x2A2A30, [0, -.2, 0]).box(.08, .05, .12, 0x1E1A16, [0, -.23, .02]);
    } else {
      const plate = kind === 'knight', wide = plate ? 1.35 : 1;
      const tunic = kind === 'archer' ? 0x4C5A33 : h.pri;
      k.box(.22 * wide, .24, .14 * wide, plate ? 0x8A9098 : tunic, [0, .18, 0], plate ? {mat: 'metal'} : {});
      if (plate) k.box(.2 * wide, .2, .02, h.pri, [0, .2, .08]);
      [-1, 1].forEach(s => k.box(.06, .2, .07, plate ? 0x8A9098 : kind === 'archer' ? 0x4C5A33 : 0x7D8288, [s * .15 * wide, .2, 0]));
      k.ball(.085, skin, [0, .47, 0]);
      if (kind === 'archer') { k.cyl(0, .12, .2, 0x3E4A2A, [0, .46, -.01], {seg: 10}); k.ring(.2, .012, 0x6B4A2A, [-.18, .32, .05], {arc: Math.PI, rot: [0, Math.PI / 2, Math.PI / 2]}); k.cyl(.04, .04, .22, 0x5A3E25, [.06, .3, -.1], {rot: [.3, 0, 0], seg: 6}); }
      else if (plate) { k.cyl(.1, .1, .16, 0x9AA1A9, [0, .42, 0], {mat: 'metal', seg: 12}); k.box(.1, .02, .02, 0x1A1A1A, [0, .52, .1]); k.cyl(.02, .04, .16, h.sec, [0, .6, -.02], {seg: 6}); k.box(.04, .3, .24, h.pri, [-.2 * wide, .1, .06]); k.box(.045, .3, .04, h.sec, [-.2 * wide - .005, .1, .06]); k.box(.02, .36, .02, 0xC0C4CA, [.2 * wide, .2, .12], {rot: [.6, 0, 0]}); }
      else { k.ball(.1, 0x7D8288, [0, .5, 0], {cap: Math.PI / 2, mat: 'metal'}); k.box(.02, .06, .02, 0x7D8288, [0, .42, .09]); k.cyl(.12, .12, .03, h.sec, [-.18, .22, .02], {rot: [0, 0, Math.PI / 2], mid: true, seg: 14}); k.box(.02, .3, .02, 0xC0C4CA, [.17, .2, .1], {rot: [.5, 0, 0]}); }
      leg.box(.075, .2, .08, kind === 'knight' ? 0x8A9098 : 0x3F3A34, [0, -.2, 0]).box(.08, .05, .12, 0x2A2420, [0, -.23, .02]);
    }
    GEO.set(key, {body: k.build().children[0].geometry, leg: leg.build().children[0].geometry});
  }
  return GEO.get(key);
}
