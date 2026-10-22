// The Keep's buildings in 3D (views/realm-3d.js draws them): medieval, each made of simple solids baked into a few
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
// Ale's things (the brewery's and the cellar's): amber ale and its foam, copper kettles, oak barrels and their hoops, hops;
// the oast's brick and its white cowl; the cellar's mound (earth, moss), its cask's head, the light inside.
const ALE = 0xC98A22, FOAM = 0xF4EBD4, COPPER = 0xC8743A, COPPER_HI = 0xE8A266, COPPER_DK = 0x8E4A24, BARREL = 0x8A5A32, HOOP = 0x3F4247,
  HOPS = 0x56843A, HOP_CONE = 0xB9D16C, HEARTH = 0x6F675F, SMOKE = 0xDAD7D1, BRICK = 0x9A5338, BRICK_DK = 0x7A3F2B, COWL = 0xF2EFE8,
  EARTH = 0x765E44, MOSS = 0x67703E, OAK = 0xA06E3E, LIT = 0xF2A640;
/** A barrel (or a cask, a keg): r round its belly, len long, its middle at `at`, lying along x or z or standing (y), with two
 *  hoops (o.hm: their material). Cheap: 8 sides. */
function barrel(k, r, len, at, axis = 'y', o = {}) {
  const prof = [[0, -len / 2], [r * .82, -len / 2], [r, 0], [r * .82, len / 2], [0, len / 2]].map(([x, y]) => new T.Vector2(x, y));
  const rot = axis === 'x' ? [0, 0, -Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const d = axis === 'x' ? [1, 0, 0] : axis === 'z' ? [0, 0, 1] : [0, 1, 0];
  k.add(new T.LatheGeometry(prof, 8), o.color || BARREL, 'paint', at, rot);
  [-.3, .3].forEach(f => k.add(new T.CylinderGeometry(r * .9 + .01, r * .9 + .01, len * .1, 8, 1, true), o.hoop || HOOP, o.hm || 'paint',
    [at[0] + d[0] * f * len, at[1] + d[1] * f * len, at[2] + d[2] * f * len], rot));
}
/** Half a cylinder, its flat side down, len long along z, its middle at `at` (a vault, an arch's top). */
function halfCyl(k, r, len, color, at, o = {}) {
  return k.add(new T.CylinderGeometry(r, r, len, o.seg || 14, 1, false, -Math.PI / 2, Math.PI), color, o.mat, at, [-Math.PI / 2, 0, 0], [1, 1, o.tall || 1]);
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
    // The Brewery (its id stays 'farm', as saves have it): a timber-and-stone brewhouse along the back and, beside it,
    // its oast: a round brick kiln for the malt under a tall cone of a roof, the white cowl on its tip (the one shape no
    // other building has: a brewery across the base). At the front corner the copper kettle, a tall thing on its
    // hearth (a fire in the hearth's arch), its hood and flue steaming, piped to the open tun of ale beside it under
    // its head of foam; barrels stacked in the yard, hops climbing their poles, and the sign: an amber tankard, foam
    // over its rim, as the Ale it brews is drawn everywhere else. With each level the house and the kiln grow taller,
    // the kettle bigger, the barrels and hops more; the roofs thatch, then oak shingles (level 4), then slate ridged in
    // the level's trim (level 8); the yard cobbled from level 5, the tankard's rim and handle in the trim from level 4.
    // One mesh, a second for the fire's glow.
    const L = Math.min(l, 8), y0 = .06;
    k.slab(2.86, 2.86, y0, .14, l >= 5 ? COBBLE : 0x7A6146, [0, 0, 0]);
    // the brewhouse: stone below, plaster between dark beams above (jutting out over the front a little)
    const cx = -.42, cz = -.68, w = 1.5, d = 1.06, h1 = .46, h2 = .34 + .035 * L, fz = cz + d / 2, y1 = y0 + h1, y2 = y1 + h2, fz2 = fz + .08;
    k.box(w, h1, d, STONE, [cx, y0, cz]);
    k.box(w + .04, h2, d + .12, PLASTER, [cx, y1, cz + .04]);
    k.box(w + .1, .06, d + .16, DARKWOOD, [cx, y1 - .03, cz + .04]);
    for (let i = 0; i <= 4; i++) k.box(.05, h2, .03, DARKWOOD, [cx - w / 2 + .02 + i * (w - .04) / 4, y1, fz2 + .015]);
    k.box(w + .04, .05, .03, DARKWOOD, [cx, y2 - .05, fz2 + .015]);
    [-.3, .3].forEach(z => k.box(.03, h2, .05, DARKWOOD, [cx + w / 2 + .03, y1, cz + .04 + z]));
    const rh = .52 + .02 * L, roof = l >= 8 ? 0x4E5560 : l >= 4 ? 0x7A4E30 : THATCH;
    k.gable(w + .26, d + .4, rh, roof, [cx, y2, cz + .04]);
    k.box(w + .3, .06, .07, l >= 8 ? trimOf(l) : DARKWOOD, [cx, y2 + rh - .05, cz + .04]);
    if (l >= 10) { // a dormer on the front of the roof, lit
      const dz = cz + .4, dy = y2 + rh * .45;
      k.box(.3, .26, .3, PLASTER, [cx - .1, dy - .06, dz]);
      k.box(.14, .12, .02, 0xF0B04A, [cx - .1, dy + .02, dz + .16]);
      k.pyramid(.42, .42, .2, roof, [cx - .1, dy + .2, dz]);
    }
    // its arched door (lanterns either side from level 11), its windows lit amber (the loft's too, from level 6)
    k.box(.3, .44, .04, DARKWOOD, [cx - .38, y0, fz + .01]);
    k.cyl(.15, .15, .04, DARKWOOD, [cx - .38, y0 + .44, fz + .01], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 8});
    if (l >= 11) [-.6, -.16].forEach(x => k.box(.06, .09, .06, FIRE, [cx + x, y0 + .36, fz + .04], {mat: 'glow'}));
    [.08, .44].forEach(x => k.box(.18, .15, .03, 0xF0B04A, [cx + x, y0 + .2, fz + .01]));
    [-.38, .26].forEach(x => k.box(.15, .14, .03, l >= 6 ? 0xF0B04A : 0x3A2C22, [cx + x, y1 + h2 * .38, fz2 + .02]));
    // the oast at its end: a brick roundel on a stone plinth, a door and a little window, the cone of its roof (in the
    // house's roofing; its eaves banded in the trim from level 8), the white cowl leaning on its tip, a vane behind it
    // to turn it from the wind; its smoke out of the cowl (more from level 6)
    const ox = .84, oz = -.7, or = .32 + .01 * L, oh = .6 + .055 * L, ch = .74 + .05 * L, ob = y0 + .1, ot = ob + oh;
    k.cyl(or + .04, or + .06, .1, STONE2, [ox, y0, oz], {seg: 16});
    k.cyl(or, or + .015, oh, BRICK, [ox, ob, oz], {seg: 16});
    k.cyl(or + .012, or + .012, .04, BRICK_DK, [ox, ob + oh * .5, oz], {seg: 16, open: true});
    const face = (a, dd) => [ox + Math.sin(a) * dd, oz + Math.cos(a) * dd];
    const [dx1, dz1] = face(Math.PI / 4, or - .005);
    k.box(.18, .32, .03, DARKWOOD, [dx1, ob, dz1], {rot: [0, Math.PI / 4, 0]});
    const [wx1, wz1] = face(Math.PI * .62, or - .005);
    k.box(.1, .12, .03, l >= 6 ? 0xF0B04A : 0x2E241C, [wx1, ob + oh * .62, wz1], {rot: [0, Math.PI * .62, 0]});
    k.cyl(or + .08, or + .08, .045, l >= 8 ? trimOf(l) : DARKWOOD, [ox, ot - .02, oz], {seg: 16});
    k.cyl(.06, or + .1, ch, l >= 4 ? roof : 0x6B5038, [ox, ot, oz], {seg: 16}); // (weathered boards, under the thatch's level)
    const cy = ot + ch - .04;
    k.cyl(.07, .08, .1, COWL, [ox, cy, oz], {seg: 10});
    k.box(.2, .2, .2, COWL, [ox, cy + .08, oz], {rot: [0, 0, -.12]});
    k.box(.03, .13, .15, 0x2A2420, [ox + .1, cy + .1, oz], {rot: [0, 0, -.12]});
    k.pyramid(.27, .26, .12, COWL, [ox - .015, cy + .27, oz]);
    k.box(.26, .11, .02, COWL, [ox - .22, cy + .14, oz]);
    [[.16, .06, .08], [.3, .22, .11], [.46, .44, .13]].slice(0, l >= 6 ? 3 : 2)
      .forEach(([dx, dy, r], i) => k.rock(r, i ? SMOKE + 0x080808 * i : SMOKE, [ox + dx, cy + .14 + dy, oz - dx * .3], {rot: [i, i * 1.7, .4]}));
    // the copper kettle at the front corner, on its hearth: a fire in the hearth's arch (it faces the front corner),
    // the kettle taller than it's wide, a band round it, its rim, the conical hood, the flue steaming
    const kx = .9, kz = .86, kr = .2 + .008 * L, hh = .22, fa = Math.PI / 4;
    k.cyl(kr + .08, kr + .11, hh, HEARTH, [kx, y0, kz], {seg: 12});
    const [ax1, az1] = [kx + Math.sin(fa) * (kr + .1), kz + Math.cos(fa) * (kr + .1)];
    k.box(.17, .12, .05, 0x1A1310, [ax1, y0 + .02, az1], {rot: [0, fa, 0]});
    k.cyl(.085, .085, .05, 0x1A1310, [ax1, y0 + .14, az1], {rot: [Math.PI / 2, 0, -fa], mid: true, seg: 8});
    k.box(.12, .09, .02, FIRE, [ax1 + Math.sin(fa) * .02, y0 + .03, az1 + Math.cos(fa) * .02], {rot: [0, fa, 0], mat: 'glow'});
    k.cyl(0, .05, .09, 0xFFD25A, [ax1 + Math.sin(fa) * .025, y0 + .05, az1 + Math.cos(fa) * .025], {seg: 5, mat: 'glow'});
    const kb = y0 + hh, kh = .36 + .012 * L;
    k.cyl(kr, kr * .9, kh, COPPER, [kx, kb, kz], {seg: 14});
    k.cyl(kr * .96 + .012, kr * .96 + .012, .035, COPPER_HI, [kx, kb + kh * .5, kz], {open: true, seg: 14});
    k.cyl(kr + .022, kr + .022, .045, COPPER_DK, [kx, kb + kh - .03, kz], {seg: 14});
    const hy = kb + kh + .01, hH = .22 + .012 * L;
    k.cyl(.06, kr + .01, hH, COPPER, [kx, hy, kz], {seg: 14});
    k.cyl(.04, .045, .38, COPPER_DK, [kx, hy + hH - .02, kz], {seg: 8});
    k.cyl(.056, .056, .035, COPPER_HI, [kx, hy + hH + .33, kz], {seg: 8});
    const fy = hy + hH + .4;
    [[0, .06, .07], [-.05, .2, .1], [-.12, .4, .12]].slice(0, l >= 6 ? 3 : 2)
      .forEach(([dx, dy, r], i) => k.rock(r, i ? SMOKE + 0x080808 * i : 0xF2F1EC, [kx + dx, fy + dy, kz + dx * .4], {rot: [i + 1, i * 1.3, .3]}));
    // the open tun of ale beside it (its pipe from the kettle turning down over it), one head of foam on the ale, a
    // ring of the ale round it, the paddle in it
    const tx = 1.06, tz = .06, tr = .25, py = kb + kh * .5;
    k.cyl(tr, tr * .9, .38, WOOD, [tx, y0, tz], {seg: 12});
    [[.07, .92], [.29, .98]].forEach(([y, f]) => k.cyl(tr * f + .012, tr * f + .012, .035, HOOP, [tx, y0 + y, tz], {open: true, seg: 12}));
    k.cyl(tr + .006, tr + .006, .03, DARKWOOD, [tx, y0 + .36, tz], {open: true, seg: 12});
    k.cyl(tr - .02, tr - .02, .02, ALE, [tx, y0 + .345, tz], {seg: 12});
    k.ball(tr * .68, FOAM, [tx - .02, y0 + .36, tz - .01], {scl: [1, .26, 1], seg: 12, rows: 6});
    k.box(.035, .55, .035, WOOD, [tx - .1, y0 + .2, tz - .04], {rot: [0, 0, .45]});
    k.rod(.028, [kx + .02, py, kz - kr + .02], [tx - .02, py, tz + .1], COPPER_DK, {seg: 6});
    k.rod(.028, [tx - .02, py + .02, tz + .1], [tx - .02, y0 + .44, tz + .1], COPPER_DK, {seg: 6});
    // barrels stacked in the yard, their ends to the front (two, then up to six, three rows high)
    const bR = .15, bL = .36, rows = [[-.32, 0, .32], [-.16, .16], [0]], n = Math.min(6, 2 + Math.floor(l / 2));
    let left = n;
    rows.forEach((row, j) => row.forEach(x => { if (left-- > 0) barrel(k, bR, bL, [x, y0 + bR + j * bR * 1.72, 1.05], 'z'); }));
    if (l >= 3) barrel(k, .12, .28, [-1.0, y0 + .14, -.02], 'y');
    if (l >= 9) barrel(k, .12, .28, [-.5, y0 + .14, .12], 'y');
    // the hop garden: poles, the bines up them, a wire along their tops (a second row from level 8)
    const poles = 2 + Math.min(2, Math.floor(l / 4)), hopRows = l >= 8 ? [-1.2, -.86] : [-1.2];
    hopRows.forEach((x, j) => {
      const zs = Array.from({length: j ? poles - 1 : poles}, (_, i) => .22 + i * .34);
      zs.forEach((z, i) => {
        k.box(.04, .92, .04, DARKWOOD, [x, y0, z]);
        k.rock(.1, HOPS, [x, y0 + .26, z], {rot: [i, i * 2, 0], scl: [1, 1.8, 1]});
        k.rock(.085, 0x4A7631, [x, y0 + .62, z], {rot: [i + 1, i, 0], scl: [1, 1.6, 1]});
        k.rock(.05, HOP_CONE, [x + .07, y0 + .42 + (i % 2) * .16, z + .05], {rot: [i, 0, 0], scl: [1, 1.3, 1]});
      });
      k.box(.015, .015, zs[zs.length - 1] - zs[0] + .06, DARKWOOD, [x, y0 + .9, (zs[0] + zs[zs.length - 1]) / 2]);
    });
    // the sign: an amber tankard (as the Ale is drawn), foam over its rim, its handle to the side, hung from a bracket
    // out of the house's upper floor; its rim, foot and handle in the trim from level 4 (oak below)
    const sx = -.04, wz = fz + .1, mz = wz + .36, armY = y1 + h2 * .45, mr = .14, mh = .28, sy = armY - .17 - mh, edge = l >= 4 ? trimOf(l) : DARKWOOD;
    k.box(.05, .05, .46, DARKWOOD, [sx, armY, wz + .21]);
    k.rod(.016, [sx, armY - .2, wz + .01], [sx, armY + .01, wz + .24], DARKWOOD, {seg: 5});
    k.box(.014, .08, .014, HOOP, [sx, armY - .07, mz]);
    k.cyl(mr, mr * .9, mh, ALE, [sx, sy, mz], {seg: 12});
    k.cyl(mr * .92, mr * .92, .03, edge, [sx, sy - .01, mz], {seg: 12});
    k.cyl(mr + .012, mr + .012, .035, edge, [sx, sy + mh - .035, mz], {seg: 12, open: true});
    k.box(.03, mh * .55, .015, 0xF0C060, [sx - mr * .3, sy + mh * .2, mz + mr * .97], {rot: [0, -.31, 0]});
    k.ball(mr * 1.06, FOAM, [sx, sy + mh, mz], {cap: Math.PI / 2, seg: 12, rows: 4, scl: [1, .72, 1]});
    [[-.06, .05], [.08, .02], [.02, -.07]].forEach(([a, b]) => k.ball(.055, FOAM, [sx + a, sy + mh + .03, mz + b], {seg: 8, rows: 5}));
    k.ball(.04, FOAM, [sx + mr * .98, sy + mh - .05, mz + .02], {seg: 6, rows: 4, scl: [.7, 1.4, .7]});
    k.ring(.085, .026, edge, [sx + mr * .72, sy + mh * .5, mz - mr * .72], {rot: [0, Math.PI / 4, 0], seg: 12});
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
    // The Cellar (its id stays 'granary', as saves have it): an earthen mound over a vault, moss on its crown and
    // stones showing in its flanks, its front a face of stone in the mound's shape; set into that, a great oak cask,
    // iron hooped, a little arched door cut in its head and lit amber from inside, its tap by the door (Ale is kept
    // here); a lantern by it, flagstones out into the yard; racks of barrels along its side, a cask on a handcart. A
    // mound at every level (its roof is never what changes): the mound grows longer and the barrels more (the rack a
    // second tier high from level 4); round the cask a timber frame, then a ring of dressed stone (level 4), iron bands
    // across its head (level 6), a keystone in the level's trim and a lantern each side (level 8); a vent on the mound
    // (level 4; two from level 9); the house's banners on the face (level 10). One mesh, a second for its iron (from
    // level 4) and a third for its light.
    pad(k, 3, l, DIRT);
    const L = Math.min(l, 11), y0 = .08, hm = l >= 4 ? 'metal' : 'paint', iron = l >= 4 ? IRON : HOOP;
    const vx = -.3, m = .84 + .01 * L, len = 1.2 + .03 * L, fz = .3, vz = fz - len / 2, ta = .76, rise = m * ta;
    // the mound: the earth over the vault, rounded off at the back, moss on its crown, stones in its flanks
    halfCyl(k, m, len, EARTH, [vx, y0, vz], {seg: 16, tall: ta});
    k.ball(m, EARTH, [vx, y0, vz - len / 2], {cap: Math.PI / 2, seg: 16, rows: 6, scl: [1, ta, .32]});
    k.add(new T.CylinderGeometry(m + .012, m + .012, len - .04, 12, 1, true, -.82, 1.64), MOSS, 'paint', [vx, y0, vz - .02], [-Math.PI / 2, 0, 0], [1, 1, ta]);
    k.ball(m + .012, MOSS, [vx, y0, vz - len / 2], {cap: .82, seg: 16, rows: 4, scl: [1, ta, .32]});
    [[-1.2, .15, .08], [1.15, -.25, .07], [1.25, .3, .06], [-1.1, -.45, .065], [1.05, -.6, .055]].forEach(([a, f, r], i) => {
      if (Math.abs(f) * len > len / 2 - .05) return;
      k.rock(r, i % 2 ? STONE2 : 0x8E897F, [vx + Math.sin(a) * m * .98, y0 + Math.cos(a) * rise * .98, vz + f * len], {rot: [i, i * 2, a], scl: [1.3, .6, 1]});
    });
    (l >= 9 ? [-.28, .12] : l >= 4 ? [-.2] : []).forEach(f => {
      k.box(.15, .2, .15, DARKSTONE, [vx, y0 + rise - .08, vz + len * f]);
      k.box(.21, .04, .21, STONE2, [vx, y0 + rise + .12, vz + len * f]);
    });
    // its face: stone in the mound's shape (rough to level 3, dressed from 4), a wing wall each side holding the earth
    const fm = m + .06, ft = .2, ff = fz + .15, fh = rise + .05, face = l >= 4 ? 0x7A7065 : 0x686158, joint = 0x4A453F;
    halfCyl(k, fm, ft, face, [vx, y0, fz + .05], {seg: 16, tall: fh / fm});
    [-1, 1].forEach(s => k.box(.26, .2, .2, STONE2, [vx + s * (fm + .08), y0, fz + .04]));
    // (its courses: mortar lines across it, the joints between its stones staggered)
    for (let i = 1; i <= 4; i++) {
      const y = fh * i / 5, half = fm * Math.sqrt(1 - (y / fh) ** 2) - .04;
      k.box(half * 2, .014, .01, joint, [vx, y0 + y - .007, ff + .002]);
      for (let j = 0; j < 4; j++) { const x = (j - 1.5 + (i % 2) * .5) * half * .48; if (Math.abs(x) < half - .05) k.box(.012, fh / 5 - .01, .01, joint, [vx + x, y0 + y - fh / 5 + .005, ff + .002]); }
    }
    // the cask set into it, lying out of it: oak, two hoops showing, its head's staves, the door cut in its head, lit
    const R = .34 + .004 * L, cl = .52, cy = y0 + R + .01, cz = ff + .22 - cl / 2, head = cz + cl / 2;
    const prof = [[0, -cl / 2], [R * .86, -cl / 2], [R * .97, -cl * .25], [R, 0], [R * .97, cl * .25], [R * .86, cl / 2], [0, cl / 2]].map(([x, y]) => new T.Vector2(x, y));
    k.add(new T.LatheGeometry(prof, 14), BARREL, 'paint', [vx, cy, cz], [Math.PI / 2, 0, 0]);
    [[.42, .9], [.14, .985]].forEach(([f, r]) => k.add(new T.CylinderGeometry(R * r + .014, R * r + .014, .045, 14, 1, true), iron, hm, [vx, cy, cz + cl * f], [Math.PI / 2, 0, 0]));
    const hr = R * .86;
    k.cyl(hr - .01, hr - .01, .014, OAK, [vx, cy, head + .006], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 16});
    k.ring(hr - .004, .018, DARKWOOD, [vx, cy, head + .012], {rot: [0, 0, 0], seg: 20});
    [-.62, -.3, .3, .62].forEach(f => { const x = f * hr, hg = 2 * Math.sqrt(hr * hr - x * x) * .94; k.box(.012, hg, .006, DARKWOOD, [vx + x, cy - hg / 2, head + .014]); });
    const dw = .19, dh = .17, db = cy - hr + .035;
    k.box(dw + .05, dh, .02, DARKWOOD, [vx, db - .01, head + .016]);
    k.cyl((dw + .05) / 2, (dw + .05) / 2, .02, DARKWOOD, [vx, db - .01 + dh, head + .016], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 10});
    k.box(dw, dh - .01, .02, LIT, [vx, db, head + .024], {mat: 'glow'});
    k.cyl(dw / 2, dw / 2, .02, LIT, [vx, db + dh - .01, head + .024], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 10, mat: 'glow'});
    k.box(dw * .5, .02, .03, 0x5A3A22, [vx - dw * .25, db, head + .03]);
    // its tap by the door (oak, then in the trim), a drop of ale under it
    const tapX = vx + hr * .5, tapY = cy - hr * .25, tapC = l >= 4 ? trimOf(l) : DARKWOOD;
    k.cyl(.026, .026, .1, tapC, [tapX, tapY, head + .06], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 8, mat: l >= 4 ? 'metal' : 'paint'});
    k.box(.024, .08, .024, tapC, [tapX, tapY + .02, head + .09], {mat: l >= 4 ? 'metal' : 'paint'});
    k.ball(.022, ALE, [tapX, tapY - .05, head + .1], {seg: 6, rows: 4, scl: [1, 1.4, 1]});
    // round the cask: a timber frame (to level 3), a ring of dressed stone (from 4), its keystone in the trim (from 8);
    // iron bands across its head (from 6)
    if (l < 4) {
      [-1, 1].forEach(s => k.box(.07, 2 * R + .05, .06, DARKWOOD, [vx + s * (R + .06), y0, ff + .02]));
      k.box(2 * R + .2, .07, .07, DARKWOOD, [vx, y0 + 2 * R + .04, ff + .02]);
    } else {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * .08 + i * Math.PI * 1.16 / (n - 1), key = i === (n - 1) / 2, big = key && l >= 8;
        k.box(big ? .13 : .1, big ? .17 : .13, .07, big ? trimOf(l) : i % 2 ? 0xB1AA9D : STONE, [vx + Math.cos(a) * (R + .07), cy + Math.sin(a) * (R + .07) - (big ? .085 : .065), ff + .02], {rot: [0, 0, a - Math.PI / 2], mat: big ? 'metal' : 'paint'});
      }
    }
    if (l >= 6) [.3, .6].forEach(f => {
      const y = cy + R * f, half = Math.sqrt(hr * hr - (R * f) ** 2) * .96;
      k.box(half * 2, .032, .012, IRON, [vx, y - .016, head + .022], {mat: 'metal'});
      [-1, 1].forEach(s => k.cyl(.014, .014, .012, IRON, [vx + s * half * .8, y, head + .03], {rot: [Math.PI / 2, 0, 0], mid: true, seg: 6, mat: 'metal'}));
    });
    // a lantern by it (one each side from level 8)
    (l >= 8 ? [-1, 1] : [1]).forEach(s => {
      const lx = vx + s * (R + .22), ly = y0 + R * 1.5;
      k.box(.03, .03, .12, iron, [lx, ly + .14, ff + .05], {mat: hm});
      k.box(.09, .02, .09, iron, [lx, ly + .12, ff + .1], {mat: hm});
      k.box(.065, .1, .065, LIT, [lx, ly + .02, ff + .1], {mat: 'glow'});
      k.box(.09, .02, .09, iron, [lx, ly, ff + .1], {mat: hm});
    });
    // the house's banners on its face (level 10)
    if (l >= 10) [-1, 1].forEach(s => banner(k, h, [vx + s * (fm - .2), y0 + rise * .45, ff + .01], [0, 0, 0], .2, .36));
    // flagstones out from the door
    [[.02, .62, .3], [-.04, .84, .26], [.03, 1.06, .28]].forEach(([dx, z, w2], i) => k.box(w2, .02, .17, [0x8A847A, 0x7E786F, 0x938C81][i], [vx + dx, y0 - .01, z], {rot: [0, (i - 1) * .12, 0]}));
    // the rack along its side, its barrels lying on it, their ends out (a second tier from level 4)
    const n = Math.min(8, 1 + l), tiers = n > 4 ? 2 : 1, rx = .92, z0 = -1.1, bR = .15;
    for (let t = 0; t < tiers; t++) {
      const ry = y0 + .08 + t * .36;
      [-.11, .11].forEach(dx => k.box(.05, .05, 1.36, DARKWOOD, [rx + dx, ry, z0 + .5]));
      [z0 - .14, z0 + 1.14].forEach(z => [-.11, .11].forEach(dx => k.box(.05, ry + .05 - y0, .05, DARKWOOD, [rx + dx, y0, z])));
      for (let i = 0; i < 4 && t * 4 + i < n; i++) barrel(k, bR, .36, [rx, ry + .05 + bR * .9, z0 + i * .33], 'x', {hm});
    }
    // a cask on a handcart, at the front
    const hx = .78, hz = .9, big = l >= 5 ? .19 : .16;
    [-1, 1].forEach(s => {
      k.cyl(.16, .16, .04, DARKWOOD, [hx + s * .24, y0 + .16, hz], {rot: [0, 0, Math.PI / 2], mid: true, seg: 10});
      k.box(.04, .04, .7, WOOD, [hx + s * .17, y0 + .2, hz + .12]);
    });
    k.box(.38, .04, .44, WOOD, [hx, y0 + .2, hz]);
    barrel(k, big, .44, [hx, y0 + .24 + big * .92, hz], 'x', {hm});
    // kegs stood by the door (from level 3)
    for (let i = 0; i < Math.min(3, Math.floor(l / 3)); i++) barrel(k, .11, .26, [-1.12 + (i % 2) * .24, y0 + .13, .66 + i * .22], 'y', {hm});
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
/** A wall's pillar and its one-tile run, cached for instancing. Levels 1–8 carry their own vertex colours;
 *  the default preserves the white legacy geometry for callers that tint walls per instance. */
export function wallParts(level = 0) {
  const style = Number.isInteger(level) && level >= 1 && level <= 8 ? level : 0;
  const key = style ? `wall:${style}` : 'wall';
  if (!GEO.has(key)) {
    const post = new Kit(true), run = new Kit(true);
    // The run always spans x 0…1, with a complete pillar centred on each endpoint. Keeping the pillar
    // square and detailing both faces lets the same parts join at corners and four-way intersections.
    const courses = (k, w, d, y, rows, step, colors, cx = 0, blocks = 1) => {
      for (let row = 0; row < rows; row++) {
        const n = blocks === 1 ? 1 : blocks + row % 2, bw = w / n;
        for (let col = 0; col < n; col++) k.box(bw - .012, step - .014, d, colors[(row + col) % colors.length], [cx - w / 2 + (col + .5) * bw, y + row * step, 0]);
      }
    };
    const crown = (k, span, y, size, height, stone, cap) => {
      [-1, 1].forEach(x => [-1, 1].forEach(z => {
        k.box(size, height, size, stone, [x * span, y, z * span]);
        if (cap) k.box(size + .012, .035, size + .012, cap, [x * span, y + height, z * span]);
      }));
    };
    if (!style) {
      post.box(.34, .68, .34, 0xFFFFFF).box(.4, .08, .4, 0xFFFFFF, [0, .68, 0]);
      run.box(1, .5, .24, 0xFFFFFF, [.5, 0, 0]).box(.16, .14, .26, 0xFFFFFF, [.5, .5, 0]);
    } else if (style <= 2) {
      // Hewn oak stakes with pale cut points; the second tier stands on stone and gains iron ties.
      const reinforced = style === 2, foot = reinforced ? .13 : 0, timber = [0x795130, 0x89613B, 0x69492F];
      if (reinforced) {
        post.box(.44, .18, .44, 0x77766A);
        run.box(1, foot, .32, 0x656557, [.5, 0, 0]);
        courses(run, 1, .34, .025, 1, .105, [0x8B8775, 0x777765], .5, 3);
      }
      const base = reinforced ? .18 : 0, shaft = reinforced ? .62 : .64;
      post.box(.3, shaft, .3, timber[0], [0, base, 0]);
      post.pyramid(.3, .3, reinforced ? .18 : .2, reinforced ? IRON : 0xB28A53, [0, base + shaft, 0]);
      [base + .14, base + shaft - .12].forEach(y => post.box(.33, .055, .33, reinforced ? IRON : DARKWOOD, [0, y, 0]));
      for (let i = 0; i < 5; i++) {
        const x = .1 + i * .2, h = (reinforced ? .58 : .55) + (i % 2 ? .025 : 0);
        run.box(.17, h, .19, timber[i % 3], [x, foot, 0]);
        run.pyramid(.17, .19, .16, reinforced ? 0xA27C4C : 0xB28A53, [x, foot + h, 0]);
      }
      [-1, 1].forEach(sd => {
        [foot + .16, foot + .45].forEach(y => run.box(1, .07, .045, reinforced ? IRON : DARKWOOD, [.5, y, sd * .12]));
        if (reinforced) run.rod(.024, [.12, foot + .19, sd * .15], [.88, foot + .48, sd * .15], IRON, {seg: 4});
      });
    } else if (style === 3) {
      // Three open crenels and staggered courses make the first stone tier read as a castle wall.
      const stone = [0xA09A89, 0x8C897A, 0xB0A792];
      post.box(.34, .87, .34, 0x646658).box(.44, .08, .44, 0x7A7B6C);
      courses(post, .39, .39, .08, 4, .195, stone);
      post.box(.44, .07, .44, 0xB1AA98, [0, .86, 0]);
      crown(post, .15, .93, .14, .17, stone[0]);
      run.box(1, .72, .25, 0x626556, [.5, 0, 0]).box(1, .08, .32, 0x7A7B6C, [.5, 0, 0]);
      courses(run, 1, .28, .08, 3, .21, stone, .5, 3);
      run.box(1, .07, .32, 0xB1AA98, [.5, .71, 0]);
      [.16, .5, .84].forEach(x => run.box(.16, .17, .3, stone[0], [x, .78, 0]));
    } else if (style === 4) {
      // Broad corner buttresses and a black iron belt reinforce the darker fortress masonry.
      const stone = [0x575D58, 0x697065, 0x454D48];
      post.box(.4, .96, .4, 0x343D38).box(.56, .11, .56, 0x555B50);
      courses(post, .43, .43, .11, 4, .21, stone);
      [-1, 1].forEach(x => [-1, 1].forEach(z => {
        post.box(.12, .62, .12, 0x74786A, [x * .22, .11, z * .22]);
        post.pyramid(.12, .12, .14, 0x818474, [x * .22, .73, z * .22]);
      }));
      post.box(.46, .06, .46, IRON, [0, .88, 0]).box(.56, .09, .56, 0x858777, [0, .95, 0]);
      crown(post, .18, 1.04, .17, .18, stone[1]);
      run.box(1, .82, .3, 0x343D38, [.5, 0, 0]).box(1, .11, .4, 0x555B50, [.5, 0, 0]);
      courses(run, 1, .33, .11, 4, .1775, stone, .5, 3);
      [-1, 1].forEach(sd => {
        [.25, .75].forEach(x => {
          run.box(.12, .53, .12, 0x74786A, [x, .11, sd * .19]);
          run.pyramid(.12, .12, .14, 0x818474, [x, .64, sd * .19]);
        });
        run.box(.045, .19, .015, 0x202B28, [.5, .44, sd * .172]);
      });
      run.box(1, .055, .36, IRON, [.5, .765, 0]).box(1, .08, .39, 0x858777, [.5, .82, 0]);
      [.16, .5, .84].forEach(x => run.box(.18, .18, .34, stone[1], [x, .9, 0]));
    } else if (style === 5) {
      // Pale dressed stone, bronze string courses and gold-capped merlons crown the citadel tier.
      const stone = [0xC9C0A5, 0xB8B19A, 0xD8CEB2], bronze = 0x9A7239, gold = 0xD2AD58;
      post.box(.44, 1.04, .44, 0x7B8170).box(.58, .12, .58, 0x9F9D84);
      courses(post, .47, .47, .12, 4, .23, stone);
      [-1, 1].forEach(x => [-1, 1].forEach(z => post.box(.1, .86, .1, stone[2], [x * .24, .16, z * .24])));
      [.28, .76].forEach(y => post.box(.5, .035, .5, bronze, [0, y, 0]));
      post.box(.6, .08, .6, stone[2], [0, 1.02, 0]).box(.6, .035, .6, gold, [0, 1.1, 0]);
      crown(post, .2, 1.135, .18, .19, stone[0], gold);
      run.box(1, .91, .33, 0x7B8170, [.5, 0, 0]).box(1, .12, .44, 0x9F9D84, [.5, 0, 0]);
      courses(run, 1, .36, .12, 4, .1975, stone, .5, 3);
      [.26, .7].forEach(y => run.box(1, .035, .38, bronze, [.5, y, 0]));
      [-1, 1].forEach(sd => {
        run.box(.1, .66, .09, stone[2], [.5, .16, sd * .2]);
        run.box(.13, .09, .105, gold, [.5, .75, sd * .2]);
      });
      run.box(1, .075, .42, stone[2], [.5, .91, 0]).box(1, .03, .43, gold, [.5, .985, 0]);
      [.16, .5, .84].forEach(x => {
        run.box(.19, .17, .37, stone[0], [x, 1.015, 0]);
        run.box(.202, .035, .382, gold, [x, 1.185, 0]);
      });
    }
    if (style >= 6) {
      // Shielded bastion, flying buttresses, then a royal spired crown; posts and runs grow each time.
      const tier = style - 6, H = 1.32 + tier * .24, width = .64 + tier * .075;
      const stone = tier === 0 ? [0x717C7F, 0x909A98, 0xA9B0A4] : tier === 1 ? [0x535C68, 0x747D88, 0xA0A4A8] : [0xCCC5B0, 0xE1D6B7, 0xA9AA98];
      const trim = tier === 0 ? 0xB5A27E : tier === 1 ? 0xC8A259 : 0xE7BE56;
      post.box(width, .16, width, stone[0]);
      post.box(width - .14, H, width - .14, stone[0]);
      courses(post, width - .08, width - .08, .16, 5 + tier, (H - .16) / (5 + tier), stone);
      [-1, 1].forEach(x => [-1, 1].forEach(z => {
        post.box(.13, H - .2, .13, stone[2], [x * (width / 2 - .055), .16, z * (width / 2 - .055)]);
        if (tier >= 1) post.pyramid(.19, .19, .24, trim, [x * (width / 2 - .055), H - .04, z * (width / 2 - .055)]);
      }));
      [.34, H * .7].forEach(y => post.box(width + .025, .055, width + .025, trim, [0, y, 0]));
      post.box(width + .06, .1, width + .06, stone[2], [0, H, 0]);
      crown(post, width / 2 - .1, H + .1, .21, .23, stone[1], trim);
      [-1, 1].forEach(sd => {
        post.box(.2, .32, .035, trim, [0, H * .48, sd * (width / 2 + .01)]);
        post.pyramid(.2, .04, .13, trim, [0, H * .48 - .13, sd * (width / 2 + .01)]);
      });
      const rh = H - .18, thick = .4 + tier * .045;
      run.box(1, .16, thick + .1, stone[0], [.5, 0, 0]);
      run.box(1, rh, thick, stone[0], [.5, 0, 0]);
      courses(run, 1, thick + .025, .16, 5 + tier, (rh - .16) / (5 + tier), stone, .5, 4);
      [.32, rh * .76].forEach(y => run.box(1, .045, thick + .07, trim, [.5, y, 0]));
      [-1, 1].forEach(sd => {
        [.22, .78].forEach(x => {
          run.box(.12, rh - .18, .11, stone[2], [x, .16, sd * (thick / 2 + .025)]);
          if (tier >= 1) run.pyramid(.17, .16, .27, trim, [x, rh - .12, sd * (thick / 2 + .025)]);
        });
        run.box(.08, .32, .025, 0x29323C, [.5, rh * .52, sd * (thick / 2 + .016)]);
        if (tier === 2) {
          run.box(.2, .35, .025, 0x762735, [.5, rh * .25, sd * (thick / 2 + .035)]);
          run.box(.045, .19, .03, trim, [.5, rh * .25 + .07, sd * (thick / 2 + .05)]);
        }
      });
      run.box(1, .09, thick + .1, stone[2], [.5, rh, 0]);
      [.15, .5, .85].forEach(x => {
        run.box(.2, .22, thick + .06, stone[1], [x, rh + .09, 0]);
        run.box(.22, .035, thick + .08, trim, [x, rh + .31, 0]);
      });
      if (tier === 2) {
        [-1, 1].forEach(x => [-1, 1].forEach(z => post.pyramid(.16, .16, .27, trim, [x * (width / 2 - .1), H + .365, z * (width / 2 - .1)])));
        [.15, .85].forEach(x => run.pyramid(.15, .15, .22, trim, [x, rh + .345, 0]));
      }
    }
    const g = m => m.build().children[0].geometry;
    GEO.set(key, {post: g(post), rail: g(run)});
  }
  return GEO.get(key);
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
