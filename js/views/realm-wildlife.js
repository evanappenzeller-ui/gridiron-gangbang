// Ambient inhabitants of Evan's expanded Realm landscapes. Everything is scenery:
// Seven instanced draw calls plus Christmas's optional sleigh sprite; no image
// fetches, collision or picking surfaces. The caller supplies owner-gated artwork.
import * as data from '../core/data.js';

const THEMES = {
  coast: {bird: 0xe9ece7, tip: 0x34434a, dragon: 0x567e83, wing: 0x91aab1, animal: 0xaa7852, pale: 0xe5cba2, kind: 'deer'},
  christmas: {bird: 0xf4f1e8, tip: 0x869f9b, dragon: 0x365d50, wing: 0xd2c8a4, animal: 0x82614c, pale: 0xe3d8bd, kind: 'reindeer'},
  forest: {bird: 0xa58a62, tip: 0x4c3d35, dragon: 0x385b47, wing: 0x87a663, animal: 0xb98253, pale: 0xe7d4aa, kind: 'deer'},
  tundra: {bird: 0xf3f0e5, tip: 0x8d9fa8, dragon: 0x89b5ca, wing: 0xd7e7f0, animal: 0xe0e4e1, pale: 0xffffff, kind: 'fox'},
  ocean: {bird: 0xf3ead5, tip: 0x4a5b67, dragon: 0x37999e, wing: 0x74c8c0, animal: 0x668761, pale: 0xb7ba7b, kind: 'turtle'},
  desert: {bird: 0x9c674b, tip: 0x49392e, dragon: 0xb67448, wing: 0xe0b273, animal: 0xc9a16b, pale: 0xf1d4a0, kind: 'gazelle'},
  infernal: {bird: 0x695570, tip: 0x342c42, dragon: 0x5a3642, wing: 0xbc6451, animal: 0x82574a, pale: 0xce8454, kind: 'lizard'}
};

// The central playable diamond is deliberately left empty. Each small herd has
// its own glade; flight routes circle the outer world instead of crossing the lot.
const ZONES = {
  birds: [{x: .49, y: .27, rx: .34, ry: .15}, {x: .50, y: .84, rx: .34, ry: .10}],
  dragons: [{x: .17, y: .46, rx: .075, ry: .24}, {x: .84, y: .43, rx: .065, ry: .25}, {x: .54, y: .88, rx: .23, ry: .045}],
  animals: [{x: .23, y: .48, rx: .025, ry: .009}, {x: .78, y: .67, rx: .024, ry: .008}, {x: .29, y: .77, rx: .024, ry: .008}, {x: .72, y: .35, rx: .022, ry: .009}]
};
// Small grazing paths picked from each current landscape painting: grassy cliff
// shelves, snow ledges, beach sand and outer desert mesas, away from architecture.
// Two creatures share each shelf rather than roaming across painted buildings.
const GRAZING = {
  coast: [{x: .922, y: .681, rx: .016, ry: .004}, {x: .334, y: .820, rx: .025, ry: .004}, {x: .675, y: .963, rx: .025, ry: .005}],
  christmas: [{x: .956, y: .385, rx: .014, ry: .003}, {x: .739, y: .605, rx: .022, ry: .004}],
  forest: [{x: .078, y: .301, rx: .018, ry: .003}, {x: .366, y: .847, rx: .018, ry: .004}],
  tundra: [{x: .902, y: .723, rx: .025, ry: .005}, {x: .925, y: .827, rx: .022, ry: .006}, {x: .768, y: .959, rx: .025, ry: .006}],
  ocean: [{x: .697, y: .834, rx: .016, ry: .004}, {x: .752, y: .846, rx: .016, ry: .004}],
  desert: [{x: .918, y: .445, rx: .024, ry: .005}, {x: .932, y: .555, rx: .019, ry: .004}, {x: .943, y: .970, rx: .020, ry: .005}],
  infernal: [{x: .555, y: .854, rx: .014, ry: .003}, {x: .871, y: .901, rx: .014, ry: .003}]
};
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = v => (v = clamp(v), v * v * (3 - 2 * v));

/**
 * createWildlife(THREE, scene, {theme, ground, wildlife?, sleighImage?, sleighFacesRight?, fadeStart?, fadeEnd?, onChange?})
 * ground is sceneryGround's {under(pixelX,pixelY), per, w, h, lot}.
 * wildlife optionally supplies normalized zone arrays: {birds, dragons, animals}.
 * sleighImage is optional preloaded transparent artwork, used only for Christmas.
 * update(seconds, {zoom, active=true, wideVisibility?}) returns whether animation
 * needs another frame. zoom is camera distance (larger = further out). A caller
 * can instead supply wideVisibility (0..1). Reduced-motion leaves a still tableau.
 */
export function createWildlife(T, scene, options = {}) {
  const counts = {birds: 0, dragons: 0, animals: 0, santa: 0, drawCalls: 0, visible: false, opacity: 0, reducedMotion: false};
  const empty = {counts, update: () => false, dispose() {}};
  const gr = options.ground;
  if (!data.isOwner() || !gr || typeof gr.under !== 'function' || !gr.w || !gr.h) return empty;
  const style = THEMES[options.theme] || THEMES.coast;
  const group = new T.Group(); group.name = 'realm-ambient-wildlife'; group.visible = false;
  group.userData.ambientOnly = true;
  const meshes = [], materials = [], geometries = [], textures = [];
  const zones = {};
  for (const key of Object.keys(ZONES)) {
    const custom = options.wildlife && options.wildlife[key];
    zones[key] = Array.isArray(custom) && custom.length ? custom : key === 'animals' ? GRAZING[options.theme] || GRAZING.coast : ZONES[key];
  }
  let dead = false, unsubscribe = null, reduced = false, lastTime = 0, lastView = {zoom: 0, active: true};
  const doc = typeof document === 'object' ? document : null;
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  reduced = !!(media && media.matches); counts.reducedMotion = reduced;

  // Merge small pieces into a single geometry with vertex colors. Flat facets
  // retain the lit forms at overview scale without an extra material per part.
  function sculpture(build) {
    const positions = [], colors = [], matrix = new T.Matrix4(), q = new T.Quaternion(), rotation = new T.Euler(), scale = new T.Vector3(), position = new T.Vector3();
    const paint = new T.Color(), point = new T.Vector3();
    function part(geometry, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
      q.setFromEuler(rotation.set(rx, 0, rz));
      matrix.compose(position.set(x, y, z), q, scale.set(sx, sy, sz));
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      const attr = flat.getAttribute('position');
      paint.set(color);
      for (let i = 0; i < attr.count; i++) {
        point.fromBufferAttribute(attr, i).applyMatrix4(matrix);
        positions.push(point.x, point.y, point.z);
        const shade = .86 + ((Math.floor(i / 3) * 13) % 11) / 70;
        colors.push(paint.r * shade, paint.g * shade, paint.b * shade);
      }
      if (flat !== geometry) flat.dispose();
      geometry.dispose();
    }
    const ellipsoid = (c, x, y, z, sx, sy, sz) => part(new T.SphereGeometry(1, 7, 5), c, x, y, z, sx, sy, sz);
    const cone = (c, x, y, z, sx, sy, sz, rx = 0, rz = 0) => part(new T.ConeGeometry(1, 1, 5), c, x, y, z, sx, sy, sz, rx, rz);
    const box = (c, x, y, z, sx, sy, sz) => part(new T.BoxGeometry(1, 1, 1), c, x, y, z, sx, sy, sz);
    build({ellipsoid, cone, box});
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    return geo;
  }
  function membrane(dragon) {
    // One right wing. Mirroring the instance makes the left wing; rotation about
    // its inner edge produces actual flapping instead of a whole-bird wobble.
    const outline = dragon ? [[0, .10, .23], [.63, .18, .66], [1.72, 0, -.30], [1.08, -.025, -.09], [.93, -.02, -.61], [.49, .015, -.32], [.27, .025, -.64]] :
      [[0, .02, .22], [.49, .08, .38], [1.34, 0, -.22], [.76, -.025, -.29], [.32, 0, -.42]];
    const pos = [], col = [], c = new T.Color();
    for (let i = 1; i < outline.length - 1; i++) {
      c.set(dragon ? (i % 2 ? style.wing : style.dragon) : (i === 2 ? style.tip : style.bird));
      for (const at of [outline[0], outline[i], outline[i + 1]]) { pos.push(...at); col.push(c.r, c.g, c.b); }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return geo;
  }
  function batch(name, geometry, count, shadow = false) {
    const mat = new T.MeshBasicMaterial({vertexColors: !shadow, color: shadow ? 0x26332a : 0xffffff,
      side: T.DoubleSide, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: 0});
    const mesh = new T.InstancedMesh(geometry, mat, count);
    mesh.name = name; mesh.frustumCulled = false; mesh.raycast = () => {};
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.userData.ambientOnly = true; mat.userData.opacityMultiplier = shadow ? .16 : 1;
    group.add(mesh); meshes.push(mesh); geometries.push(geometry); materials.push(mat);
    return mesh;
  }
  const birdBody = sculpture(({ellipsoid, cone}) => {
    ellipsoid(style.bird, 0, 0, 0, .19, .13, .42);
    ellipsoid(style.bird, 0, .09, .39, .13, .13, .15);
    cone(style.tip, 0, .065, .58, .07, .23, .055, Math.PI / 2);
    cone(style.tip, 0, .01, -.48, .18, .36, .045, -Math.PI / 2);
  });
  const dragonBody = sculpture(({ellipsoid, cone}) => {
    ellipsoid(style.dragon, 0, .02, 0, .22, .19, .62);
    ellipsoid(style.dragon, 0, .13, .63, .12, .16, .33);
    ellipsoid(style.wing, 0, .14, .91, .14, .12, .21);
    cone(style.dragon, 0, .02, -.88, .16, .95, .13, -Math.PI / 2);
    for (const x of [-.10, .10]) cone(style.wing, x, .31, .81, .04, .23, .04, -.25);
    for (let i = 0; i < 4; i++) cone(style.wing, 0, .22, .3 - .23 * i, .07, .18, .10);
  });
  const animalBody = sculpture(({ellipsoid, cone}) => {
    const c = style.animal, p = style.pale;
    if (style.kind === 'turtle') {
      ellipsoid(c, 0, .27, 0, .39, .28, .53);
      ellipsoid(p, 0, .12, .52, .16, .12, .19);
      cone(p, 0, .11, -.60, .08, .28, .06, -Math.PI / 2);
    } else if (style.kind === 'lizard') {
      ellipsoid(c, 0, .19, 0, .22, .15, .63);
      ellipsoid(p, 0, .20, .62, .16, .12, .24);
      cone(c, 0, .15, -.85, .15, .82, .13, -Math.PI / 2);
      for (let i = 0; i < 4; i++) cone(p, 0, .36, .30 - .25 * i, .06, .19, .09);
    } else if (style.kind === 'fox') {
      ellipsoid(c, 0, .37, 0, .25, .23, .53);
      ellipsoid(p, 0, .54, .54, .18, .19, .22);
      cone(c, 0, .49, .78, .13, .31, .13, Math.PI / 2);
      ellipsoid(p, 0, .36, -.70, .19, .19, .43);
      for (const x of [-.12, .12]) cone(c, x, .77, .49, .09, .25, .075);
    } else {
      ellipsoid(c, 0, .60, 0, .25, .30, .57);
      ellipsoid(c, 0, .86, .47, .14, .36, .19);
      ellipsoid(p, 0, 1.10, .62, .15, .15, .23);
      for (const x of [-.16, .16]) {
        ellipsoid(c, x, 1.21, .50, .09, .13, .045);
        if (style.kind === 'reindeer') {
          const side = Math.sign(x), horn = 0xcbbd94;
          cone(horn, side * .18, 1.45, .50, .035, .56, .035, -.15, -side * .36);
          cone(horn, side * .29, 1.59, .48, .030, .30, .030, -.12, -side * .82);
          cone(horn, side * .36, 1.72, .46, .025, .24, .025, -.12, -side * .30);
          cone(horn, side * .22, 1.55, .64, .025, .28, .025, .72, -side * .18);
          cone(horn, side * .28, 1.70, .60, .020, .23, .020, .48, -side * .18);
        } else cone(style.tip, x * .65, 1.40, .53, .035, style.kind === 'gazelle' ? .48 : .35, .035, -.25);
      }
      if (style.kind === 'reindeer') {
        ellipsoid(p, 0, .76, .53, .16, .29, .17);
        ellipsoid(0x993f43, 0, .97, .48, .16, .055, .20);
        ellipsoid(0xd7af58, 0, .90, .68, .045, .055, .040);
      }
      cone(p, 0, .67, -.60, .09, .25, .08, -Math.PI / 2);
    }
  });
  const legGeo = sculpture(({box, ellipsoid}) => {
    if (style.kind === 'turtle' || style.kind === 'lizard') ellipsoid(style.pale, 0, .08, 0, .17, .065, .26);
    else box(style.animal, 0, -.21, 0, .075, style.kind === 'fox' ? .30 : .48, .075);
  });
  const shadowGeo = new T.CircleGeometry(1, 12); shadowGeo.rotateX(-Math.PI / 2);
  counts.birds = 20; counts.dragons = 3; counts.animals = Math.min(8, zones.animals.length * 2);
  const birds = batch('realm-birds', birdBody, counts.birds), birdWings = batch('realm-bird-wings', membrane(false), counts.birds * 2);
  const dragons = batch('realm-dragons', dragonBody, counts.dragons), dragonWings = batch('realm-dragon-wings', membrane(true), counts.dragons * 2);
  const animals = batch('realm-grazing-animals', animalBody, counts.animals), legs = batch('realm-animal-legs', legGeo, counts.animals * 4);
  const shadows = batch('realm-wildlife-shadows', shadowGeo, counts.animals, true);
  counts.drawCalls = meshes.length;
  const per = Math.max(.01, gr.per || gr.under(gr.w * .5 + 1, gr.h * .5).distanceTo(gr.under(gr.w * .5, gr.h * .5)));
  const unit = per * gr.h;
  let sleigh = null, sleighTexture = null, sleighWidth = 0, sleighHeight = 0;
  const sleighImage = options.sleighImage, imageWidth = sleighImage && (sleighImage.naturalWidth || sleighImage.width), imageHeight = sleighImage && (sleighImage.naturalHeight || sleighImage.height);
  if (options.theme === 'christmas' && imageWidth > 0 && imageHeight > 0) {
    sleighTexture = new T.Texture(sleighImage);
    sleighTexture.colorSpace = T.SRGBColorSpace; sleighTexture.needsUpdate = true;
    textures.push(sleighTexture);
    const material = new T.SpriteMaterial({map: sleighTexture, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0});
    material.userData.opacityMultiplier = 1; materials.push(material);
    sleigh = new T.Sprite(material); sleigh.name = 'realm-santa-sleigh';
    sleigh.raycast = () => {}; sleigh.userData.ambientOnly = true;
    sleighWidth = gr.w * .16 * per; sleighHeight = sleighWidth * imageHeight / imageWidth;
    sleigh.scale.set(sleighWidth, sleighHeight, 1);
    group.add(sleigh); counts.santa = 1; counts.drawCalls++;
  }
  const body = new T.Object3D(), limb = new T.Object3D(), transform = new T.Matrix4(), heading = new T.Vector3();
  const invisible = new T.Matrix4().makeScale(0, 0, 0);
  const lotX = gr.lot ? gr.lot.cx / gr.w : .5, lotY = gr.lot ? gr.lot.cy / gr.h : .57;
  const lotH = gr.lot ? gr.lot.h : gr.h * .10, pitch = options.pitch ?? .9;
  // gr.lot is authored per landscape: the playable world square projects as a
  // diamond whose width is height / sin(camera pitch), wherever its clearing is.
  // The padded rhombus also protects against wing tips and tall animal bodies.
  const protectedX = lotH / (2 * Math.sin(pitch) * gr.w), protectedY = lotH / (2 * gr.h);
  function safe(x, y, radius = 0, altitude = 0) {
    const ry = radius / (per * gr.h), rx = radius / (per * gr.w);
    const screenY = y - altitude * Math.cos(pitch) / (per * gr.h);
    return Math.abs(x - lotX) / protectedX + Math.abs(screenY - lotY) / protectedY > 1 + rx / protectedX + ry / protectedY;
  }
  function path(z, a) { return {x: z.x + Math.cos(a) * z.rx, y: z.y + Math.sin(a) * z.ry}; }
  function setBody(mesh, index, p, yaw, s, y, bank = 0) {
    body.position.copy(p); body.position.y += y; body.rotation.set(0, yaw, bank); body.scale.setScalar(s); body.updateMatrix();
    mesh.setMatrixAt(index, body.matrix);
  }
  function flying(mesh, wings, key, n, time, dragon) {
    const zz = zones[key], speed = dragon ? .105 : .16, s0 = unit * (dragon ? .012 : .0051);
    for (let i = 0; i < n; i++) {
      const z = zz[i % zz.length], phase = i * 2.399963, a = phase + time * speed * (1 + (i % 3) * .11);
      const pos = path(z, a), next = path(z, a + .008), s = s0 * (.83 + (i % 4) * .11);
      // Height is modest: flight reads in silhouette while staying aligned to the
      // outer scenery's routes, safely clear of the playable center.
      const h = s * (dragon ? 1.6 : 2.2) + Math.sin(a * 2) * s * .2;
      if (!safe(pos.x, pos.y, s * (dragon ? 1.9 : 1.55), h)) { mesh.setMatrixAt(i, invisible); wings.setMatrixAt(i * 2, invisible); wings.setMatrixAt(i * 2 + 1, invisible); continue; }
      const p = gr.under(pos.x * gr.w, pos.y * gr.h), q = gr.under(next.x * gr.w, next.y * gr.h);
      heading.subVectors(q, p);
      const yaw = Math.atan2(heading.x, heading.z);
      setBody(mesh, i, p, yaw, s, h, Math.sin(a) * .12);
      const flap = Math.sin(time * (dragon ? 2.4 : 7) + phase) * (dragon ? .42 : .62);
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        limb.position.set(sign * .10, .02, 0); limb.rotation.set(0, 0, sign * flap); limb.scale.set(sign, 1, 1); limb.updateMatrix();
        transform.multiplyMatrices(body.matrix, limb.matrix); wings.setMatrixAt(i * 2 + side, transform);
      }
    }
  }
  function grazing(time) {
    for (let i = 0; i < counts.animals; i++) {
      const z = zones.animals[i % zones.animals.length], phase = i * 2.399963;
      const a = phase + time * .035, pos = path(z, a), next = path(z, a + .01), s = unit * .0038 * (.85 + (i % 3) * .12);
      if (!safe(pos.x, pos.y, s * 1.9)) { animals.setMatrixAt(i, invisible); shadows.setMatrixAt(i, invisible); for (let j = 0; j < 4; j++) legs.setMatrixAt(i * 4 + j, invisible); continue; }
      const p = gr.under(pos.x * gr.w, pos.y * gr.h), q = gr.under(next.x * gr.w, next.y * gr.h);
      heading.subVectors(q, p);
      const yaw = Math.atan2(heading.x, heading.z);
      setBody(animals, i, p, yaw, s, .015);
      const low = style.kind === 'turtle' || style.kind === 'lizard', hip = low ? .025 : style.kind === 'fox' ? .25 : .44;
      for (let leg = 0; leg < 4; leg++) {
        const x = leg % 2 ? 1 : -1, front = leg < 2 ? 1 : -1;
        limb.position.set(x * (low ? .32 : .17), hip, front * .33);
        limb.rotation.set(Math.sin(time * 2.1 + phase + (x * front < 0 ? Math.PI : 0)) * (low ? .08 : .16), 0, low ? x * .12 : 0);
        limb.scale.set(1, 1, 1); limb.updateMatrix();
        transform.multiplyMatrices(body.matrix, limb.matrix); legs.setMatrixAt(i * 4 + leg, transform);
      }
      limb.position.copy(p); limb.position.y = .012; limb.rotation.set(0, yaw, 0); limb.scale.set(.43 * s, 1, .74 * s); limb.updateMatrix(); shadows.setMatrixAt(i, limb.matrix);
    }
  }
  function flyingSleigh(time) {
    if (!sleigh) return;
    // A leisurely four-minute circuit through the outer sky, with the sleigh
    // turning toward its travel direction. It never cuts through the village.
    const a = time * .025 + 5.1, route = {x: .5, y: .50, rx: .40, ry: .39};
    const pos = path(route, a), next = path(route, a + .008), altitude = sleighWidth * .20;
    const radius = Math.hypot(sleighWidth, sleighHeight) * .5;
    sleigh.visible = safe(pos.x, pos.y, radius, altitude);
    if (!sleigh.visible) return;
    sleigh.position.copy(gr.under(pos.x * gr.w, pos.y * gr.h)); sleigh.position.y += altitude;
    const forward = next.x >= pos.x, mirror = forward !== (options.sleighFacesRight !== false);
    sleighTexture.repeat.x = mirror ? -1 : 1; sleighTexture.offset.x = mirror ? 1 : 0; sleighTexture.updateMatrix();
    sleigh.material.rotation = Math.sin(a) * .045;
  }
  function update(seconds, view = {}) {
    if (dead) return false;
    if (!data.isOwner()) { dispose(); return false; }
    lastTime = Number.isFinite(seconds) ? seconds : 0; lastView = view;
    const active = view.active !== false && !(doc && doc.hidden), start = options.fadeStart ?? 140, end = options.fadeEnd ?? 250;
    const fade = Number.isFinite(view.wideVisibility) ? clamp(view.wideVisibility) : smooth(((view.zoom || 0) - start) / Math.max(1, end - start));
    counts.opacity = active ? fade : 0; counts.visible = active && fade > .015; group.visible = counts.visible;
    if (!counts.visible) return false;
    for (const mat of materials) mat.opacity = fade * mat.userData.opacityMultiplier;
    const time = reduced ? 17 : lastTime;
    flying(birds, birdWings, 'birds', counts.birds, time, false);
    flying(dragons, dragonWings, 'dragons', counts.dragons, time, true);
    grazing(time);
    flyingSleigh(time);
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
    return !reduced;
  }
  function motionChanged() {
    reduced = !!media.matches; counts.reducedMotion = reduced;
    update(lastTime, lastView);
    if (options.onChange) options.onChange();
  }
  function visibilityChanged() {
    update(lastTime, lastView);
    if (!doc.hidden && options.onChange) options.onChange();
  }
  function dispose() {
    if (dead) return;
    dead = true; group.visible = false; scene.remove(group);
    counts.visible = false; counts.opacity = 0;
    if (unsubscribe) unsubscribe();
    if (doc) doc.removeEventListener('visibilitychange', visibilityChanged);
    if (media) { if (media.removeEventListener) media.removeEventListener('change', motionChanged); else if (media.removeListener) media.removeListener(motionChanged); }
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
    for (const texture of textures) texture.dispose();
    for (const mesh of meshes) if (mesh.dispose) mesh.dispose();
    group.clear();
  }
  if (media) { if (media.addEventListener) media.addEventListener('change', motionChanged); else if (media.addListener) media.addListener(motionChanged); }
  if (doc) doc.addEventListener('visibilitychange', visibilityChanged);
  unsubscribe = data.subscribe(type => { if (type === 'me' && !data.isOwner()) { dispose(); if (options.onChange) options.onChange(); } });
  scene.add(group);
  return {counts, update, dispose};
}
