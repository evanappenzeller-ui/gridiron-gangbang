// The Franchise's buildings in 3D (views/franchise-3d.js draws them): each made of simple solids baked into a few
// meshes (one a material, the colours painted on the vertices) so a whole lot is a few hundred draw calls at most; a
// look per level (bigger, more to it, the trim going from steel to gold). Tiles are one unit; a building of size s
// stands on an s x s square centred on its group's origin, y up. The team's colours (pri, sec) paint the trim.
// Exports: init(T, BU), model(kind, level, team) → THREE.Group, scaffold(size), rubble(size), troopParts(kind, team),
// fenceParts(), fieldTexture(team), LEVEL_TINT.
let T = null, BU = null, MATS = null;
const TEX = new Map();
const GEO = new Map();

export function init(three, bu) {
  T = three; BU = bu;
  MATS = {
    paint: new T.MeshStandardMaterial({vertexColors: true, roughness: .64, metalness: .04, envMapIntensity: .7}),
    gloss: new T.MeshStandardMaterial({vertexColors: true, roughness: .26, metalness: .08, envMapIntensity: 1}),
    metal: new T.MeshStandardMaterial({vertexColors: true, roughness: .32, metalness: .78, envMapIntensity: 1.1}),
    glass: new T.MeshStandardMaterial({vertexColors: true, roughness: .06, metalness: .3, transparent: true, opacity: .5, envMapIntensity: 1.4, depthWrite: false}),
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
  ball(r, color, at, o = {}) { return this.add(new T.SphereGeometry(r, o.seg || 18, o.rows || 12, 0, Math.PI * 2, 0, o.cap || Math.PI), color, o.mat, at, o.rot || [0, 0, 0], o.scl || [1, 1, 1]); }
  ring(r, tube, color, at, o = {}) { return this.add(new T.TorusGeometry(r, tube, 8, o.seg || 28, o.arc || Math.PI * 2), color, o.mat, at, o.rot || [Math.PI / 2, 0, 0]); }
  /** A slab with rounded corners (extruded), w x d, h thick, at y. */
  slab(w, d, h, r, color, at = [0, 0, 0], o = {}) {
    const s = new T.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r);
    s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    if (o.hole) s.holes.push(o.hole);
    const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: !!o.bevel, bevelSize: .03, bevelThickness: .03, bevelSegments: 2, curveSegments: 6});
    return this.add(g, color, o.mat, [at[0], at[1] + h, at[2]], [Math.PI / 2, 0, 0]);
  }
  /** A flat quad with its own texture (a sign, a field): kept apart, it isn't baked. */
  plane(w, h, tex, at, rot = [0, 0, 0], o = {}) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({map: tex, roughness: o.rough ?? .7, metalness: 0, transparent: !!o.alpha, alphaTest: o.alpha ? .3 : 0, envMapIntensity: .5, polygonOffset: true, polygonOffsetFactor: -1}));
    m.position.set(...at); m.rotation.set(...rot);
    m.receiveShadow = true;
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
function canvasTex(key, w, h, draw, o = {}) {
  if (TEX.has(key)) return TEX.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  if (o.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...o.repeat); }
  TEX.set(key, t);
  return t;
}
const hex = n => '#' + new T.Color(n).getHexString();
/** A football field, end zones in the team's colour (stadiums, practice fields). */
export function fieldTexture(team, o = {}) {
  return canvasTex(`field:${team.pri}:${o.plain ? 1 : 0}`, 512, 256, (g, w, h) => {
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3E8A2E' : '#47963A'; g.fillRect(i * w / 12, 0, w / 12 + 1, h); }
    const ez = w / 12;
    g.fillStyle = hex(team.pri); g.fillRect(0, 0, ez, h); g.fillRect(w - ez, 0, ez, h);
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    g.lineWidth = 2.5;
    for (let i = 1; i < 12; i++) { const x = i * w / 12; g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 4); g.stroke(); }
    for (let i = 1; i < 60; i++) { const x = ez + i * (w - 2 * ez) / 60; [h * .38, h * .62].forEach(y => { g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke(); }); }
    if (!o.plain) {
      g.fillStyle = hex(team.sec); g.beginPath(); g.arc(w / 2, h / 2, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '800 34px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(ez / 2, h / 2); g.rotate(-Math.PI / 2); g.fillText((team.abbr || 'HOME').toUpperCase(), 0, 2); g.restore();
      g.save(); g.translate(w - ez / 2, h / 2); g.rotate(Math.PI / 2); g.fillText((team.abbr || 'HOME').toUpperCase(), 0, 2); g.restore();
    }
  });
}
function signTexture(text, bg, fg, w = 256, h = 64) {
  return canvasTex(`sign:${text}:${bg}:${fg}`, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = `800 ${Math.round(h * .62)}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 16);
  });
}
function stripeTexture(a, b) {
  return canvasTex(`stripe:${a}:${b}`, 128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * w / 8, 0, w / 8 + 1, h); } });
}

// ---------------------------------------------------------------------------------------------------- per level
// Trim by level: steel, then bronze, silver-white, gold.
const TRIM = [0xA7B0BA, 0xA7B0BA, 0xA7B0BA, 0xC08A4A, 0xC08A4A, 0xD8DDE4, 0xD8DDE4, 0xE5B83A, 0xE5B83A, 0xF2C94C, 0xF2C94C, 0xF7D35A];
export const trimOf = l => TRIM[Math.max(0, Math.min(TRIM.length - 1, l - 1))];
const CONCRETE = 0xC9CCD0, DARK = 0x2B2F36, WHITE = 0xF2F3F5, ORANGE = 0xF07A1A, GREEN = 0x3F8C2F;
/** The pad every building stands on. */
function pad(k, s, l, color = CONCRETE) {
  k.slab(s - .14, s - .14, .1, .18, color, [0, 0, 0], {bevel: true});
  if (l >= 4) k.slab(s - .02, s - .02, .04, .2, trimOf(l), [0, -.02, 0], {mat: 'metal'});
}

const BUILD = {
  stadium(k, l, team) {
    pad(k, 4, l, 0xB9BDC2);
    // the bowl: tiers of stands round the field, higher and fuller with each level
    const tiers = 1 + Math.min(3, Math.floor((l + 1) / 2));
    for (let i = 0; i < tiers; i++) {
      const o = 3.7 - i * .05, inner = 2.3 + i * .27, y = .1 + i * .32, h = .34; // (each tier a ring at least a quarter tile wide)
      const hole = new T.Path();
      const iw = inner, id = inner * .78, r = .5 + i * .1;
      hole.moveTo(-iw / 2 + r, -id / 2); hole.lineTo(iw / 2 - r, -id / 2); hole.quadraticCurveTo(iw / 2, -id / 2, iw / 2, -id / 2 + r);
      hole.lineTo(iw / 2, id / 2 - r); hole.quadraticCurveTo(iw / 2, id / 2, iw / 2 - r, id / 2); hole.lineTo(-iw / 2 + r, id / 2);
      hole.quadraticCurveTo(-iw / 2, id / 2, -iw / 2, id / 2 - r); hole.lineTo(-iw / 2, -id / 2 + r); hole.quadraticCurveTo(-iw / 2, -id / 2, -iw / 2 + r, -id / 2);
      k.slab(o, o * .86, h, .9, i % 2 ? team.pri : team.sec, [0, y, 0], {hole});
      // the seats' rows: a lighter ring on top of each tier
      k.slab(o - .06, o * .86 - .06, .02, .86, i % 2 ? 0xE9EBEE : team.pri, [0, y + h, 0], {hole});
    }
    // the outer wall
    k.cyl(1.95, 1.95, .12 + tiers * .32, team.pri, [0, .1, 0], {seg: 40, open: true, scl: [1, 1, .86]});
    // the field
    k.plane(2.3, 1.55, fieldTexture(team), [0, .14, 0], [-Math.PI / 2, 0, 0], {rough: .9});
    // light towers at the corners (lamps lit)
    const H = 1.3 + tiers * .35;
    [[-1.65, -1.4], [1.65, -1.4], [-1.65, 1.4], [1.65, 1.4]].forEach(([x, z]) => {
      k.cyl(.05, .07, H, 0xB8BEC6, [x, .1, z], {mat: 'metal', seg: 8});
      k.box(.5, .28, .1, DARK, [x, H, z], {rot: [-.35 * Math.sign(z), Math.atan2(x, z) + Math.PI, 0]});
      k.box(.44, .2, .04, 0xFFF6D8, [x - .04 * Math.sign(x), H + .04, z - .05 * Math.sign(z)], {mat: 'glow', rot: [-.35 * Math.sign(z), Math.atan2(x, z) + Math.PI, 0]});
    });
    // a scoreboard over one end from level 3, a flag on top
    if (l >= 3) {
      const y = .1 + tiers * .32 + .1;
      k.box(.08, .6, .08, DARK, [-.5, y, -1.62]); k.box(.08, .6, .08, DARK, [.5, y, -1.62]);
      k.box(1.3, .5, .1, DARK, [0, y + .55, -1.62]);
      k.box(1.18, .38, .02, 0x10233F, [0, y + .61, -1.56], {mat: 'glow'});
    }
    if (l >= 6) k.ring(1.86, .05, trimOf(l), [0, .14 + tiers * .32, 0], {mat: 'metal', seg: 48});
    k.cyl(.02, .02, .7, 0xDDDDDD, [1.8, .14 + tiers * .32, 0], {mat: 'metal', seg: 6});
    k.box(.36, .22, .02, team.sec, [1.98, .66 + tiers * .32, 0], {rot: [0, Math.PI / 2, 0]});
  },
  booth(k, l, team) {
    pad(k, 3, l);
    const n = l >= 7 ? 3 : l >= 4 ? 2 : 1, w = 1.05;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (w + .12);
      k.box(w, 1.05, .95, 0xEDE6D6, [x, .1, -.1]);
      k.box(w + .06, .1, 1.02, team.pri, [x, .1, -.1]);
      k.box(w * .72, .5, .03, 0x1A2633, [x, .45, .37], {mat: 'glass'});
      k.box(w * .8, .06, .2, 0xBFC5CC, [x, .4, .45], {mat: 'metal'});
      // the striped awning
      k.add(new T.BoxGeometry(w + .14, .05, .5), 0xFFFFFF, 'paint', [x, 1.2, .38], [.42, 0, 0]);
      k.plane(w + .14, .5, stripeTexture(hex(team.pri), '#F4F4F4'), [x, 1.226, .388], [-Math.PI / 2 + .42, 0, 0]);
      k.box(w + .1, .12, 1, DARK, [x, 1.15, -.1]);
    }
    k.plane(Math.min(2.6, n * 1.1), .3, signTexture('TICKETS', hex(team.pri), '#FFFFFF'), [0, 1.48, -.12], [0, 0, 0]);
    k.box(Math.min(2.6, n * 1.1) + .06, .34, .04, trimOf(l), [0, 1.31, -.15], {mat: 'metal'});
    // the queue's posts and rope
    [-1, -.4, .2, .8].forEach(x => k.cyl(.03, .03, .4, trimOf(l), [x, .1, 1.1], {mat: 'metal', seg: 8}));
    k.box(1.8, .03, .03, 0xB3262B, [-.1, .44, 1.1]);
  },
  cooler(k, l, team) {
    pad(k, 3, l);
    const n = l >= 8 ? 3 : l >= 4 ? 2 : 1, r = .5 + Math.min(.12, l * .012);
    k.box(2.3, .32, 1.3, 0x5C6470, [0, .1, 0], {mat: 'metal'});
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (r * 2 + .1), h = .95;
      k.cyl(r, r * .96, h, ORANGE, [x, .42, 0], {mat: 'gloss', seg: 28});
      k.cyl(r * 1.04, r * 1.04, .16, WHITE, [x, .42 + h, 0], {mat: 'gloss', seg: 28});
      k.cyl(r * .5, r * .55, .08, WHITE, [x, .58 + h, 0], {mat: 'gloss', seg: 20});
      k.cyl(r * 1.005, r * 1.005, .1, 0x2E7D32, [x, .42 + h * .62, 0], {seg: 28});
      k.box(.1, .08, .14, WHITE, [x, .52, r], {mat: 'gloss'});
      k.cyl(.02, .02, .12, 0x666666, [x, .48, r + .08], {rot: [Math.PI / 2, 0, 0], seg: 6});
    }
    // a sleeve of cups
    k.cyl(.11, .09, .5, 0xF5F5F5, [1.0, .42, .45], {seg: 12});
  },
  vault(k, l, team) {
    pad(k, 3, l, 0x9AA1A9);
    const s = 1.55 + Math.min(.4, l * .04), h = 1.25 + Math.min(.5, l * .05);
    k.box(s, h, s * .92, 0x6E7783, [0, .1, -.1], {mat: 'metal'});
    k.box(s + .08, .12, s, trimOf(l), [0, .1 + h, -.1], {mat: 'metal'});
    k.box(s + .08, .1, s, trimOf(l), [0, .1, -.1], {mat: 'metal'});
    // the round door, the wheel, the dial
    const fz = -.1 + s * .46 + .02, cy = .1 + h * .52;
    k.cyl(h * .38, h * .38, .1, 0x8D96A2, [0, cy, fz], {mat: 'metal', rot: [Math.PI / 2, 0, 0], mid: true, seg: 32});
    k.ring(h * .3, .028, trimOf(l), [0, cy, fz + .07], {mat: 'metal', rot: [0, 0, 0]});
    [0, 1, 2].forEach(i => k.box(h * .58, .04, .04, trimOf(l), [0, cy - .02, fz + .07], {mat: 'metal', rot: [0, 0, i * Math.PI / 3]}));
    k.cyl(.07, .07, .06, DARK, [h * .24, cy + h * .24, fz + .06], {mat: 'metal', rot: [Math.PI / 2, 0, 0], mid: true, seg: 14});
    // gold bars stacked beside it
    for (let i = 0; i < Math.min(6, 1 + Math.floor(l / 2)); i++) k.box(.34, .12, .16, 0xE8B53A, [1.0 - (i % 2) * .38, .1 + Math.floor(i / 2) * .12, .95], {mat: 'metal'});
  },
  tank(k, l, team) {
    pad(k, 3, l);
    const r = .62 + Math.min(.2, l * .02), h = 1.4 + Math.min(.6, l * .06);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => k.cyl(.05, .05, .3, 0x5C6470, [a * r * .7, .1, b * r * .7], {mat: 'metal', seg: 6}));
    k.cyl(r * 1.05, r * 1.05, .1, trimOf(l), [0, .38, 0], {mat: 'metal', seg: 32});
    k.cyl(r * .96, r * .96, h * .7, ORANGE, [0, .48, 0], {mat: 'gloss', seg: 32});
    k.cyl(r, r, h, 0xCFE8FF, [0, .48, 0], {mat: 'glass', seg: 32, open: true});
    k.cyl(r * 1.05, r * .8, .2, trimOf(l), [0, .48 + h, 0], {mat: 'metal', seg: 32});
    [.3, .65].forEach(f => k.ring(r * 1.01, .025, trimOf(l), [0, .48 + h * f, 0], {mat: 'metal'}));
    k.cyl(.08, .08, .3, 0x5C6470, [0, .68 + h, 0], {mat: 'metal', seg: 10});
  },
  practice(k, l, team) {
    k.slab(3.86, 3.86, .06, .2, 0x2F6E25, [0, 0, 0]);
    k.plane(3.6, 3.0, fieldTexture(team, {plain: true}), [0, .07, 0], [-Math.PI / 2, 0, Math.PI / 2], {rough: .95});
    // a goalpost at one end
    const Y = 0xF3C623;
    k.cyl(.04, .04, .9, Y, [0, .06, -1.62], {mat: 'gloss', seg: 8});
    k.box(1.1, .05, .05, Y, [0, .94, -1.62], {mat: 'gloss'});
    [-.55, .55].forEach(x => k.cyl(.03, .03, .9, Y, [x, .94, -1.62], {mat: 'gloss', seg: 8}));
    // the sled and its pads, dummies, cones (more with each level)
    k.box(1.2, .06, .5, 0x4A4F57, [.5, .07, .55], {mat: 'metal'});
    for (let i = 0; i < Math.min(5, 1 + Math.floor(l / 2)); i++) k.box(.2, .42, .16, team.pri, [-.05 + i * .28, .13, .78]);
    for (let i = 0; i < Math.min(4, l); i++) k.cyl(.11, .13, .55, i % 2 ? team.sec : 0xD24A2A, [-1.2 + i * .35, .06, -.4], {seg: 12});
    for (let i = 0; i < 6; i++) k.cyl(.0, .07, .16, ORANGE, [-1.5 + i * .6, .06, 1.35], {seg: 10});
  },
  locker(k, l, team) {
    pad(k, 4, l);
    const w = 2.9, d = 2.2, h = .95 + (l >= 4 ? .45 : 0);
    k.box(w, h, d, 0xD9D2C3, [0, .1, -.3]);
    k.box(w + .1, .14, d + .1, team.pri, [0, .1 + h, -.3]);
    k.box(w + .02, .16, d + .02, team.pri, [0, .1 + h * .48, -.3]);
    if (l >= 4) for (let i = 0; i < 5; i++) k.box(.36, .26, .02, 0x22344A, [-1.1 + i * .55, .1 + h * .72, -.3 + d / 2 + .01], {mat: 'glass'});
    // the double doors, a sign over them, benches
    k.box(.8, .62, .04, team.sec, [0, .1, -.3 + d / 2 + .01]);
    k.box(.02, .62, .05, DARK, [0, .1, -.3 + d / 2 + .02]);
    k.plane(1.7, .26, signTexture('LOCKER ROOM', hex(team.pri), '#FFFFFF', 384, 64), [0, .1 + h * .48 + .3, -.3 + d / 2 + .02]);
    [-1, 1].forEach(s => k.box(.8, .08, .22, 0x8A5A36, [s * 1.0, .32, 1.35]));
    [-1, 1].forEach(s => [-1.3, -.7].forEach(x => k.box(.05, .22, .05, 0x5C6470, [s * 1.0 + (x + 1) * .4, .1, 1.35], {mat: 'metal'})));
    // the roof's vents
    k.box(.5, .2, .5, 0x8E959E, [-.8, .24 + h, -.6], {mat: 'metal'});
    if (l >= 5) k.box(.5, .2, .5, 0x8E959E, [.8, .24 + h, -.6], {mat: 'metal'});
  },
  office(k, l, team) {
    pad(k, 2, l);
    k.box(1.3, .8, 1.1, 0xEDE6D6, [0, .1, -.1]);
    k.add(new T.CylinderGeometry(.01, 1.02, .5, 4, 1), team.pri, 'paint', [0, 1.15, -.1], [0, Math.PI / 4, 0], [1.05, 1, .9]);
    k.box(.4, .55, .04, 0x7A4E2E, [-.3, .1, .46]);
    k.box(.38, .3, .03, 0x2A4058, [.3, .42, .46], {mat: 'glass'});
    k.cyl(.02, .02, 1.3, 0xDDDDDD, [.75, .1, .65], {mat: 'metal', seg: 6});
    k.box(.3, .2, .02, team.sec, [.9, 1.25, .65]);
    // the whistle sign
    k.cyl(.12, .12, .05, trimOf(l), [-.3, .85, .5], {mat: 'metal', rot: [Math.PI / 2, 0, 0], mid: true, seg: 16});
  },
  cannon(k, l, team) {
    pad(k, 3, l, 0x9AA1A9);
    k.cyl(.95, 1.05, .25, 0x5C6470, [0, .1, 0], {mat: 'metal', seg: 28});
    k.cyl(.8, .8, .06, trimOf(l), [0, .35, 0], {mat: 'metal', seg: 28});
  },
  cannonTop(k, l, team) {
    // the turning part: the mount, two air tanks, the barrel angled up (turned by franchise-3d.js)
    k.box(.7, .35, .7, team.pri, [0, .4, 0]);
    k.box(.18, .5, .5, DARK, [-.36, .55, 0], {mat: 'metal'});
    k.box(.18, .5, .5, DARK, [.36, .55, 0], {mat: 'metal'});
    [-1, 1].forEach(s => k.cyl(.14, .14, .7, 0xE4E7EB, [s * .32, .5, -.35], {mat: 'gloss', rot: [Math.PI / 2, 0, 0], mid: true, seg: 14}));
    const len = 1.3 + Math.min(.4, l * .04);
    k.cyl(.17 + l * .006, .2 + l * .006, len, trimOf(l), [0, .95, .35], {mat: 'metal', rot: [Math.PI / 2 - .5, 0, 0], mid: true, seg: 18});
    k.ring(.2 + l * .006, .04, team.sec, [0, .95 + Math.sin(.5) * len / 2, .35 + Math.cos(.5) * len / 2], {mat: 'gloss', rot: [-.5, 0, 0]});
  },
  pressbox(k, l, team) {
    pad(k, 3, l);
    const H = 1.6 + Math.min(.9, l * .09);
    [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]].forEach(([x, z]) => k.box(.12, H, .12, 0x6E7783, [x, .1, z], {mat: 'metal'}));
    [-.8, .8].forEach(z => k.box(1.7, .06, .06, 0x6E7783, [0, .1 + H * .45, z], {mat: 'metal', rot: [0, 0, .5]}));
    k.box(2.0, .14, 2.0, 0x5C6470, [0, .1 + H, 0], {mat: 'metal'});
    k.box(1.8, .62, 1.6, 0xE9EBEE, [0, .24 + H, 0]);
    k.box(1.82, .34, 1.62, 0x24384F, [0, .4 + H, 0], {mat: 'glass'});
    k.box(2.1, .12, 1.9, team.pri, [0, .86 + H, 0]);
    k.box(1.7, .06, .03, trimOf(l), [0, .26 + H, .81], {mat: 'metal'});
    k.cyl(.015, .015, .6, 0xDDDDDD, [.7, .98 + H, -.6], {mat: 'metal', seg: 6});
    k.box(.3, .18, .02, team.sec, [.86, 1.45 + H, -.6]);
  },
  jugs(k, l, team) {
    pad(k, 3, l);
    // the tripod
    [0, 2.1, 4.2].forEach(a => k.cyl(.04, .04, 1.1, 0x4A4F57, [Math.cos(a) * .45, .1, Math.sin(a) * .45], {mat: 'metal', seg: 6, rot: [Math.sin(a) * .35, 0, -Math.cos(a) * .35]}));
    k.box(.5, .16, .5, DARK, [0, .95, 0], {mat: 'metal'});
  },
  jugsTop(k, l, team) {
    // the machine: two wheels side by side, the chute, the motor (turned by franchise-3d.js)
    const Y = 0xF3C623;
    k.box(.9, .5, .34, Y, [0, 1.1, 0], {mat: 'gloss'});
    [-1, 1].forEach(s => {
      k.cyl(.36, .36, .12, 0x1D1F24, [s * .22, 1.42, .1], {rot: [0, 0, Math.PI / 2], mid: true, seg: 22});
      k.cyl(.2, .2, .13, 0xB8BEC6, [s * .22, 1.42, .1], {mat: 'metal', rot: [0, 0, Math.PI / 2], mid: true, seg: 16});
    });
    k.box(.24, .12, .7, 0x6E7783, [0, 1.5, -.25], {mat: 'metal', rot: [.35, 0, 0]});
    k.box(.3, .2, .3, team.pri, [0, 1.08, -.32]);
    k.ball(.14, 0x7A3B1B, [0, 1.62, -.45], {scl: [1, 1, 1.6]});
  },
  shower(k, l, team) {
    pad(k, 3, l);
    const H = 1.7 + Math.min(.5, l * .06);
    [-1, 1].forEach(s => k.box(.14, H, .14, 0x5C6470, [s * 1.1, .1, 0], {mat: 'metal'}));
    k.box(2.4, .14, .16, trimOf(l), [0, .1 + H, 0], {mat: 'metal'});
    k.slab(1.6, 1.0, .02, .5, 0x47A2D9, [0, .1, .25], {mat: 'gloss'});
  },
  showerTop(k, l, team) {
    // the bucket on its pivot, tipped a little (franchise-3d.js tips it when it pours)
    const r = .5 + Math.min(.12, l * .02);
    k.cyl(r, r * .82, .8, ORANGE, [0, -.85, 0], {mat: 'gloss', seg: 24});
    k.cyl(r * 1.04, r * 1.04, .08, WHITE, [0, -.08, 0], {mat: 'gloss', seg: 24});
    k.ring(r * .9, .03, 0xDDDDDD, [0, -.02, 0], {mat: 'metal', arc: Math.PI, rot: [0, 0, 0]});
    k.cyl(.6, .6, .02, 0x9BE15D, [0, -.12, 0], {seg: 24, mat: 'gloss'});
  }
};
export const HAS_TOP = {cannon: 'cannonTop', jugs: 'jugsTop', shower: 'showerTop'};

/** A building's model (cached geometry, a fresh group each call). */
export function model(kind, level, team) {
  const key = `${kind}:${level}:${team.pri}:${team.sec}`;
  if (!GEO.has(key)) {
    const k = new Kit();
    BUILD[kind](k, Math.max(1, level), team);
    const top = HAS_TOP[kind] ? (() => { const t = new Kit(); BUILD[HAS_TOP[kind]](t, Math.max(1, level), team); return t.build(); })() : null;
    GEO.set(key, {base: k.build(), top});
  }
  const c = GEO.get(key), g = new T.Group();
  g.add(c.base.clone());
  if (c.top) {
    const top = c.top.clone();
    top.name = 'top';
    if (kind === 'shower') top.position.y = 1.7 + Math.min(.5, level * .06);
    g.add(top);
  }
  return g;
}
/** Scaffolding round a building going up or being upgraded. */
export function scaffold(size) {
  const key = 'scaffold:' + size;
  if (!GEO.has(key)) {
    const k = new Kit(), h = 1.6, s = size - .2, P = 0x9BA3AD;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => k.box(.06, h, .06, P, [a * s / 2, 0, b * s / 2], {mat: 'metal'}));
    [.5, 1.1].forEach(y => { [-1, 1].forEach(b => { k.box(s, .04, .04, P, [0, y, b * s / 2], {mat: 'metal'}); k.box(.04, .04, s, P, [b * s / 2, y, 0], {mat: 'metal'}); }); });
    k.box(s * .6, .03, .3, 0xC28B4A, [0, 1.1, s / 2 + .05]);
    k.cyl(.12, .16, .14, 0xF3C623, [s / 2 - .2, h, s / 2 - .2], {mat: 'gloss', seg: 14});
    GEO.set(key, k.build());
  }
  return GEO.get(key).clone();
}
/** What's left of a building knocked down in a raid. */
export function rubble(size) {
  const key = 'rubble:' + size;
  if (!GEO.has(key)) {
    const k = new Kit(), R = (i) => ((Math.sin(i * 91.7 + size * 13.1) + 1) / 2);
    k.slab(size - .3, size - .3, .05, .2, 0x3A3632, [0, 0, 0]);
    for (let i = 0; i < 6 + size * 3; i++) {
      const s = .15 + R(i) * .35;
      k.box(s, s * .6, s, i % 3 ? 0x6E675F : 0x4D4741, [(R(i + 1) - .5) * (size - .7), .05, (R(i + 2) - .5) * (size - .7)], {rot: [R(i + 3), R(i + 4) * 3, R(i + 5)]});
    }
    GEO.set(key, k.build());
  }
  return GEO.get(key).clone();
}
/** A fence's post and a rail (one each, instanced by franchise-3d.js), white, tinted per fence. */
export function fenceParts() {
  if (!GEO.has('fence')) {
    const post = new Kit(true), rail = new Kit(true);
    post.box(.18, .62, .18, 0xFFFFFF).box(.24, .06, .24, 0xFFFFFF, [0, .62, 0]);
    rail.box(1, .1, .07, 0xFFFFFF, [.5, .16, 0]).box(1, .1, .07, 0xFFFFFF, [.5, .42, 0]);
    const g = m => m.build().children[0].geometry;
    GEO.set('fence', {post: g(post), rail: g(rail)});
  }
  return GEO.get('fence');
}
// Fences by level: wood, wood, chain link, chain link, concrete, concrete, gold-capped, gold.
export const FENCE_TINT = [0xA0703F, 0x8A5A30, 0xAEB6BF, 0x9AA3AD, 0xDDDCD6, 0xCFCFC8, 0xD9B44A, 0xF2C94C];

// ---------------------------------------------------------------------------------------------------- the team
/** A player's parts for instancing: body (torso, arms, head and helmet) and one leg, in his team's colours, by
 *  position (a lineman is wide, a receiver lean, a kicker in a lighter jersey). Units: tiles; he's about .55 tall. */
export function troopParts(kind, team) {
  const key = `troop:${kind}:${team.pri}`;
  if (!GEO.has(key)) {
    const k = new Kit(true), leg = new Kit(true);
    const wide = kind === 'lineman' ? 1.45 : kind === 'fullback' ? 1.2 : kind === 'mascot' ? 1.15 : 1;
    const jersey = kind === 'kicker' ? 0xF4F4F4 : kind === 'mascot' ? team.sec : team.pri;
    const skin = 0x8A5A36;
    if (kind === 'mascot') {
      // a costumed mascot: a round furry body, a big head with ears
      k.ball(.17 * wide, jersey, [0, .3, 0], {scl: [1, 1.1, .9]});
      k.ball(.15, jersey, [0, .55, 0]);
      [-1, 1].forEach(s => k.ball(.05, team.pri, [s * .1, .68, 0]));
      k.ball(.05, 0xFFFFFF, [0, .55, .13]);
      k.box(.06, .2, .06, jersey, [-.2, .2, 0]); k.box(.06, .2, .06, jersey, [.2, .2, 0]);
    } else {
      k.box(.22 * wide, .22, .14, jersey, [0, .2, 0]);
      k.box(.3 * wide, .08, .17, jersey, [0, .38, 0], {mat: 'gloss'});
      [-1, 1].forEach(s => k.box(.06, .2, .07, skin, [s * .15 * wide, .2, 0]));
      k.box(.07, .07, .07, skin, [0, .44, 0]);
      k.ball(.11, kind === 'kicker' ? team.sec : team.pri, [0, .55, 0], {mat: 'gloss', scl: [1, 1, 1.12]});
      k.box(.14, .03, .02, 0xC4CAD4, [0, .51, .11], {mat: 'metal'});
      k.box(.02, .1, .02, 0xC4CAD4, [0, .5, .12], {mat: 'metal'});
      k.box(.04, .2, .015, team.sec, [0, .2, .075]);
    }
    leg.box(.075, .2, .08, kind === 'mascot' ? jersey : 0xE8EAEE, [0, -.2, 0]).box(.08, .05, .12, 0x15171C, [0, -.23, .02]);
    GEO.set(key, {body: k.build().children[0].geometry, leg: leg.build().children[0].geometry});
  }
  return GEO.get(key);
}
