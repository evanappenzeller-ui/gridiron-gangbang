// The Franchise's lot in 3D (views/franchise.js and views/franchise-raid.js): three.js (js/vendor/three, MIT), the
// buildings from views/franchise-models.js, a camera looking down across the lot corner-on (a diamond, as these games
// are), dragged to pan, pinched or wheeled to zoom. The lot is a mowed field with a running track round it and trees
// beyond. It draws only when something moved (a finger, a job's scaffolding, a raid), so it costs nothing at rest.
// In a raid it also draws the raiders (instanced: a few draw calls however many), what the defenses fire and what the
// raiders throw and kick, dust where a building goes down, splashes.
// load() → true when three.js is in and this phone has WebGL; create(host, opts) → the view (see its methods).
import * as FM from './franchise-models.js';
import {KINDS, TROOPS, N} from '../core/franchise.js';
const V = new URL('../vendor/three/', import.meta.url).href;
let T = null, RE = null, LOADING = null, DEAD = false;

export function load() {
  if (!LOADING) {
    LOADING = (async () => {
      try {
        const probe = document.createElement('canvas');
        if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
        const [three, {RoomEnvironment}, BU] = await Promise.all([import(V + 'three.module.min.js'), import(V + 'RoomEnvironment.js'), import(V + 'BufferGeometryUtils.js')]);
        T = three; RE = RoomEnvironment;
        FM.init(T, BU);
        try { await document.fonts.load('800 60px "Barlow Condensed"'); } catch (_) {}
        return true;
      } catch (e) {
        console.warn('Franchise: no 3D', e);
        DEAD = true;
        return false;
      }
    })();
  }
  return LOADING;
}
export const ready = () => !!T && !DEAD;

const YAW = Math.PI / 4, PITCH = .9;
const W = (x) => x - N / 2; // a tile coordinate to the world's (the lot centred on the origin)

// ---- pictures of the models for the shop and the team (rendered once each, on a small canvas of their own)
let THUMB = null;
const THUMBS = new Map();
/** A picture (data URL) of kind k at level l in team's colours, or of a player (troop: true). */
export function thumb(k, l, team, troop = false) {
  if (!ready()) return '';
  const key = `${troop ? 't' : 'b'}:${k}:${l}:${team.pri}`;
  if (THUMBS.has(key)) return THUMBS.get(key);
  try {
    if (!THUMB) {
      const r = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
      r.setPixelRatio(1); r.setSize(160, 160, false);
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping;
      const sc = new T.Scene(), pm = new T.PMREMGenerator(r);
      sc.environment = pm.fromScene(new RE(r), .04).texture; pm.dispose();
      sc.add(new T.HemisphereLight(0xFFFFFF, 0x445533, 1.2));
      const sun = new T.DirectionalLight(0xFFF0D8, 2.2); sun.position.set(-3, 6, 4); sc.add(sun);
      THUMB = {r, sc, cam: new T.OrthographicCamera(-1, 1, 1, -1, .1, 100)};
    }
    const {r, sc, cam} = THUMB;
    let obj;
    if (troop) {
      const parts = FM.troopParts(k, team), mat = FM.mats().paint;
      obj = new T.Group();
      const body = new T.Mesh(parts.body, mat); body.position.y = .22; obj.add(body);
      [-1, 1].forEach(sd => { const lg = new T.Mesh(parts.leg, mat); lg.position.set(sd * .06 * (k === 'lineman' ? 1.4 : 1), .22, 0); lg.rotation.x = sd * .3; obj.add(lg); });
    } else obj = FM.model(k, l, team);
    sc.add(obj);
    const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
    const R = Math.max(sz.x, sz.y, sz.z) * .62;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.updateProjectionMatrix();
    cam.position.set(c.x + R * 2 * Math.sin(YAW), c.y + R * 2 * Math.sin(.6), c.z + R * 2 * Math.cos(YAW)); cam.lookAt(c);
    r.setClearColor(0x000000, 0);
    r.render(sc, cam);
    const url = r.domElement.toDataURL('image/png');
    sc.remove(obj);
    THUMBS.set(key, url);
    return url;
  } catch (e) { return ''; }
}

function grassTexture(T) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#4C8A33'; g.fillRect(0, 0, 256, 256);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < .5 ? '30,70,20' : '120,170,70'},${.08 + r() * .12})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 2 + r() * 4); }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function lotTexture(T) {
  // mowed in stripes two tiles wide, the way a field is
  const cv = document.createElement('canvas'); cv.width = cv.height = 576;
  const g = cv.getContext('2d'), u = 576 / N;
  for (let i = 0; i < N; i += 2) { g.fillStyle = (i / 2) % 2 ? '#56A03A' : '#61AE43'; g.fillRect(i * u, 0, 2 * u + 1, 576); }
  let s = 11;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < .5 ? '40,90,25' : '150,200,90'},${.05 + r() * .08})`; g.fillRect(r() * 576, r() * 576, 1 + r() * 2, 2 + r() * 3); }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function trackTexture(T) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#B4553B'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
  [16, 32, 48].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); });
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
function puffTexture(T) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
  return t;
}

/**
 * The view, in host (filled). opts: {team: {pri, sec, abbr}, zoom (start), onTap(hit), onGrab(tile) → bool (a drag
 * that starts here moves something instead of panning: onDrag(tile), onDrop(tile)), onCamera()}.
 */
export function create(host, opts = {}) {
  const renderer = new T.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'fr-canvas';
  host.appendChild(canvas);
  let lost = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; want(); });

  const scene = new T.Scene();
  scene.background = new T.Color(0x8FC1E8);
  scene.fog = new T.Fog(0x9CC8EA, 70, 140);
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RE(renderer), .04).texture;
  pmrem.dispose();
  const hemi = new T.HemisphereLight(0xE6F0FF, 0x46663A, .8); scene.add(hemi);
  const sun = new T.DirectionalLight(0xFFF0D8, 2.9);
  sun.position.set(-16, 30, 12); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  Object.assign(sun.shadow.camera, {left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90});
  scene.add(sun, sun.target);

  // ---- the ground: grass all round, the track, the lot
  const grass = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshStandardMaterial({map: grassTexture(T), roughness: 1}));
  grass.material.map.repeat.set(60, 60);
  grass.rotation.x = -Math.PI / 2; grass.position.y = -.02; grass.receiveShadow = true;
  scene.add(grass);
  const trk = trackTexture(T);
  const track = new T.Mesh(new T.RingGeometry(N * .5 * Math.SQRT2 + .6, N * .5 * Math.SQRT2 + 3.6, 4, 1), new T.MeshStandardMaterial({map: trk, roughness: .95}));
  track.rotation.x = -Math.PI / 2; track.rotation.z = Math.PI / 4; track.position.y = -.01; track.receiveShadow = true;
  scene.add(track);
  const lot = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshStandardMaterial({map: lotTexture(T), roughness: .95}));
  lot.rotation.x = -Math.PI / 2; lot.receiveShadow = true;
  scene.add(lot);
  // trees and light poles round the outside
  {
    const leaves = new T.MeshStandardMaterial({color: 0x2F6B2A, roughness: .85}), bark = new T.MeshStandardMaterial({color: 0x6B4A2E, roughness: .9});
    const crown = new T.ConeGeometry(1.4, 3.2, 7), trunk = new T.CylinderGeometry(.18, .24, 1, 6);
    let s = 3;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const n = 70, cr = new T.InstancedMesh(crown, leaves, n), tr = new T.InstancedMesh(trunk, bark, n), m = new T.Matrix4(), q = new T.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = N * .78 + 4 + r() * 16, x = Math.cos(a) * d, z = Math.sin(a) * d, k = .7 + r() * .7;
      m.compose(new T.Vector3(x, 2.4 * k, z), q, new T.Vector3(k, k, k)); cr.setMatrixAt(i, m);
      m.compose(new T.Vector3(x, .5 * k, z), q, new T.Vector3(k, k, k)); tr.setMatrixAt(i, m);
    }
    cr.castShadow = true; scene.add(cr, tr);
  }

  // ---- the camera: looking down across the lot corner-on
  const cam = new T.PerspectiveCamera(30, 1, .5, 400);
  const view = {tx: 0, tz: 0, dist: opts.zoom || 46};
  const placeCam = () => {
    const h = Math.cos(PITCH) * view.dist;
    cam.position.set(view.tx + Math.sin(YAW) * h, Math.sin(PITCH) * view.dist, view.tz + Math.cos(YAW) * h);
    cam.lookAt(view.tx, 0, view.tz);
    cam.updateMatrixWorld();
    scene.fog.near = view.dist * .9 + 20; scene.fog.far = view.dist * 1.7 + 70;
  };
  const ZMIN = 14, ZMAX = 130, PAN = N / 2 + 2;
  const clampView = () => {
    view.dist = Math.max(ZMIN, Math.min(ZMAX, view.dist));
    view.tx = Math.max(-PAN, Math.min(PAN, view.tx)); view.tz = Math.max(-PAN, Math.min(PAN, view.tz));
  };
  let Wd = 1, Hd = 1;
  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    if (w === Wd && h === Hd) return;
    Wd = w; Hd = h;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    cam.aspect = w / h; cam.updateProjectionMatrix();
    want();
  };

  // ---- drawing on demand
  let raf = 0, dead = false, anim = null;
  const want = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    if (dead || lost) return;
    resize();
    placeCam();
    let more = false;
    if (anim) more = anim(now) !== false;
    renderer.render(scene, cam);
    if (opts.onCamera) opts.onCamera();
    if (more) want();
  }

  // ---- picking and projecting
  const ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hitV = new T.Vector3();
  const ndcOf = (cx, cy) => { const b = canvas.getBoundingClientRect(); ndc.set((cx - b.left) / b.width * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); };
  /** The ground under a point on the screen, in tiles (fractional), or null. */
  const tileAt = (cx, cy) => {
    placeCam(); ndcOf(cx, cy); ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(ground, hitV) ? {x: hitV.x + N / 2, y: hitV.z + N / 2} : null;
  };
  /** Screen position (px in host) of a point over the lot (tiles; h up). */
  const project = (x, y, h = 0) => {
    const v = new T.Vector3(W(x), h, W(y)).project(cam);
    return {x: (v.x + 1) / 2 * Wd, y: (1 - v.y) / 2 * Hd, on: v.z < 1};
  };

  // ---- the buildings
  let team = opts.team || {pri: 0x1D3F8F, sec: 0xF2C94C, abbr: 'HOME'};
  const groups = new Map(); // id -> {g, key, b}
  const picks = [];
  let fenceSig = '', fenceMesh = null;
  const root = new T.Group(); scene.add(root);
  function setLot(s, o = {}) {
    const now = o.now || Date.now(), gone = o.gone || new Set();
    if (o.team) team = o.team;
    const seen = new Set();
    s.b.forEach(b => {
      if (b.t === 'fence') return;
      seen.add(b.i);
      const size = KINDS[b.t].size, down = gone.has(b.i), status = down ? 'down' : b.u > now ? (b.l < 1 ? 'new' : 'up') : 'ok';
      const key = `${b.t}:${b.l}:${status}:${team.pri}`;
      let e = groups.get(b.i);
      if (!e || e.key !== key) {
        if (e) root.remove(e.g);
        const g = new T.Group();
        if (status === 'down') g.add(FM.rubble(size));
        else if (status === 'new') { g.add(FM.scaffold(size)); }
        else {
          g.add(FM.model(b.t, b.l, team));
          if (status === 'up') g.add(FM.scaffold(size));
        }
        g.traverse(m => { if (m.isMesh) m.userData.bid = b.i; });
        root.add(g);
        e = {g, key, b};
        groups.set(b.i, e);
      }
      e.b = b;
      e.g.position.set(W(b.x + size / 2), 0, W(b.y + size / 2));
    });
    [...groups.keys()].forEach(id => { if (!seen.has(id)) { root.remove(groups.get(id).g); groups.delete(id); } });
    // the fences: one instanced post and rail mesh for the lot, rails joining fences side by side
    const fences = s.b.filter(b => b.t === 'fence' && !gone.has(b.i));
    const sig = fences.map(f => `${f.i}.${f.x}.${f.y}.${f.l}`).join(',');
    if (sig !== fenceSig) {
      fenceSig = sig;
      if (fenceMesh) { root.remove(fenceMesh.post, fenceMesh.rail); fenceMesh.post.dispose(); fenceMesh.rail.dispose(); }
      const parts = FM.fenceParts(), at = new Map(fences.map(f => [f.x + ',' + f.y, f]));
      const rails = [];
      fences.forEach(f => { if (at.has((f.x + 1) + ',' + f.y)) rails.push([f, 0]); if (at.has(f.x + ',' + (f.y + 1))) rails.push([f, 1]); });
      const mat = FM.mats().paint;
      const post = new T.InstancedMesh(parts.post, mat, Math.max(1, fences.length)), rail = new T.InstancedMesh(parts.rail, mat, Math.max(1, rails.length));
      const m = new T.Matrix4(), q = new T.Quaternion(), one = new T.Vector3(1, 1, 1), c = new T.Color();
      fences.forEach((f, i) => { m.compose(new T.Vector3(W(f.x + .5), 0, W(f.y + .5)), q, one); post.setMatrixAt(i, m); post.setColorAt(i, c.set(FM.FENCE_TINT[f.l - 1] || 0xA0703F)); });
      rails.forEach(([f, dir], i) => {
        m.compose(new T.Vector3(W(f.x + .5), 0, W(f.y + .5)), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), dir ? -Math.PI / 2 : 0), one);
        rail.setMatrixAt(i, m); rail.setColorAt(i, c.set(FM.FENCE_TINT[f.l - 1] || 0xA0703F));
      });
      post.count = fences.length; rail.count = rails.length;
      post.castShadow = rail.castShadow = true; post.receiveShadow = true;
      post.userData.fences = fences;
      root.add(post, rail);
      fenceMesh = {post, rail};
    }
    picks.length = 0;
    groups.forEach(e => e.g.traverse(m => { if (m.isMesh) picks.push(m); }));
    if (fenceMesh) picks.push(fenceMesh.post);
    want();
  }
  /** The building under a point on the screen (its id), or null. */
  const pick = (cx, cy) => {
    placeCam(); ndcOf(cx, cy); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(picks, false)[0];
    if (!hit) return null;
    if (hit.object.isInstancedMesh && hit.object.userData.fences) { const f = hit.object.userData.fences[hit.instanceId]; return f ? f.i : null; }
    return hit.object.userData.bid ?? null;
  };

  // ---- the selected building: a ring of light round its footprint; moving it, a green or red square under it
  const sel = {id: null, mesh: null, foot: null, t0: 0};
  {
    const shape = new T.Shape(), hole = new T.Path();
    shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, .5); shape.lineTo(-.5, .5); shape.lineTo(-.5, -.5);
    const i = .44; hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.lineTo(-i, -i);
    shape.holes.push(hole);
    sel.mesh = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshBasicMaterial({color: 0xFFFFFF, transparent: true, opacity: .9, depthWrite: false, toneMapped: false}));
    sel.mesh.rotation.x = -Math.PI / 2; sel.mesh.position.y = .03; sel.mesh.visible = false; sel.mesh.renderOrder = 2;
    sel.foot = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({color: 0x3BD16F, transparent: true, opacity: .45, depthWrite: false, toneMapped: false}));
    sel.foot.rotation.x = -Math.PI / 2; sel.foot.position.y = .025; sel.foot.visible = false; sel.foot.renderOrder = 1;
    scene.add(sel.mesh, sel.foot);
  }
  /** Marks building id (or none); moving: {x, y, size, ok} lifts it there over a green (fits) or red square. */
  function select(id, moving = null) {
    sel.id = id;
    const e = id != null ? groups.get(id) : null;
    groups.forEach(x => { x.g.position.y = 0; });
    if (!e && !moving) { sel.mesh.visible = sel.foot.visible = false; want(); return; }
    const size = moving ? moving.size : KINDS[e.b.t].size, x = moving ? moving.x : e.b.x, y = moving ? moving.y : e.b.y;
    sel.mesh.visible = true;
    sel.mesh.scale.set(size + .3, size + .3, 1);
    sel.mesh.position.set(W(x + size / 2), .03, W(y + size / 2));
    sel.foot.visible = !!moving;
    if (moving) {
      sel.foot.scale.set(size, size, 1); sel.foot.position.set(W(x + size / 2), .025, W(y + size / 2));
      sel.foot.material.color.set(moving.ok ? 0x3BD16F : 0xE5484D);
      if (e) { e.g.position.set(W(x + size / 2), .25, W(y + size / 2)); }
    }
    want();
  }
  // a building not on the lot yet (the shop's pick), shown where it would go
  let ghost = null;
  function setGhost(g) {
    if (ghost) { root.remove(ghost.g); ghost = null; }
    if (!g) { select(null); return; }
    const grp = FM.model(g.t, 1, team);
    grp.traverse(m => { if (m.isMesh) { m.castShadow = false; } });
    const size = KINDS[g.t].size;
    grp.position.set(W(g.x + size / 2), .25, W(g.y + size / 2));
    root.add(grp);
    ghost = {g: grp};
    select(null, {x: g.x, y: g.y, size, ok: g.ok});
  }
  // the lot's grid, while something is being placed
  const grid = new T.GridHelper(N, N, 0xFFFFFF, 0xFFFFFF);
  grid.material.transparent = true; grid.material.opacity = .16; grid.material.depthWrite = false; grid.position.y = .02; grid.visible = false;
  scene.add(grid);
  const showGrid = on => { grid.visible = !!on; want(); };

  // ---- fingers: drag to pan (or to move what onGrab took), pinch or wheel to zoom, tap to pick
  const ptr = new Map();
  let gesture = null;
  const down = e => {
    if (e.button > 0) return;
    canvas.setPointerCapture && (() => { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} })();
    ptr.set(e.pointerId, {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now()});
    if (ptr.size === 1) {
      const tile = tileAt(e.clientX, e.clientY);
      const grab = tile && opts.onGrab ? opts.onGrab(tile, pick(e.clientX, e.clientY)) : false;
      gesture = {kind: grab ? 'grab' : 'pan', moved: false, start: tile, anchor: tile, view: {...view}};
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      gesture = {kind: 'pinch', moved: true, d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: view.dist, mid0: tileAt((a.x + b.x) / 2, (a.y + b.y) / 2)};
    }
  };
  const move = e => {
    const p = ptr.get(e.pointerId);
    if (!p || !gesture) return;
    p.x = e.clientX; p.y = e.clientY;
    if (!gesture.moved && Math.hypot(p.x - p.x0, p.y - p.y0) < 7) return;
    gesture.moved = true;
    if (gesture.kind === 'grab') { const t = tileAt(p.x, p.y); if (t && opts.onDrag) opts.onDrag(t); return; }
    if (gesture.kind === 'pan' && gesture.anchor) {
      // keep the ground that was under the finger under it
      const t = tileAt(p.x, p.y);
      if (t) { view.tx -= t.x - gesture.anchor.x; view.tz -= t.y - gesture.anchor.y; clampView(); placeCam(); }
      want();
      return;
    }
    if (gesture.kind === 'pinch' && ptr.size >= 2) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      view.dist = gesture.dist0 * gesture.d0 / Math.max(10, d);
      clampView(); placeCam();
      const mid = tileAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (mid && gesture.mid0) { view.tx -= mid.x - gesture.mid0.x; view.tz -= mid.y - gesture.mid0.y; clampView(); }
      want();
    }
  };
  const up = e => {
    const p = ptr.get(e.pointerId);
    ptr.delete(e.pointerId);
    if (!p || !gesture) return;
    if (gesture.kind === 'grab' && gesture.moved) { const t = tileAt(p.x, p.y); if (opts.onDrop) opts.onDrop(t); }
    else if (!gesture.moved && e.type === 'pointerup' && performance.now() - p.t0 < 500 && opts.onTap) {
      opts.onTap({id: pick(p.x, p.y), tile: tileAt(p.x, p.y), x: p.x, y: p.y});
    }
    if (!ptr.size) gesture = null;
    else if (ptr.size === 1) { const q = [...ptr.values()][0]; gesture = {kind: 'pan', moved: true, anchor: tileAt(q.x, q.y)}; }
  };
  const wheel = e => {
    e.preventDefault();
    const before = tileAt(e.clientX, e.clientY);
    view.dist *= Math.exp(e.deltaY * .0016);
    clampView(); placeCam();
    const after = tileAt(e.clientX, e.clientY);
    if (before && after) { view.tx -= after.x - before.x; view.tz -= after.y - before.y; clampView(); }
    want();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, {passive: false});
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => want()) : null;
  if (ro) ro.observe(host);

  // ---------------------------------------------------------------------------------------------------- a raid
  let raid = null;
  /** Draws battle B (core/franchise-battle.js) on this lot: call before the raid's first frame; then raidFrame(t)
   *  each frame with the raid's clock (interpolated between its steps). raider: the raiders' team colours. */
  function raidStart(B, raider) {
    raidStop();
    const kinds = Object.keys(TROOPS), meshes = {}, m4 = new T.Matrix4();
    kinds.forEach(k => {
      const n = Math.max(1, (B.left[k] || 0) + (B.used[k] || 0));
      const parts = FM.troopParts(k, raider);
      const body = new T.InstancedMesh(parts.body, FM.mats().paint, n), leg = new T.InstancedMesh(parts.leg, FM.mats().paint, n * 2);
      body.castShadow = leg.castShadow = true; body.count = leg.count = 0;
      body.frustumCulled = leg.frustumCulled = false;
      scene.add(body, leg);
      meshes[k] = {body, leg};
    });
    // what flies: footballs (QBs, kickers, the JUGS), shirts (the cannon), the press box's, splashes, dust
    const ballGeo = new T.SphereGeometry(.09, 10, 8); ballGeo.scale(1, 1, 1.7);
    const shirtGeo = new T.CylinderGeometry(.07, .07, .22, 8); shirtGeo.rotateX(Math.PI / 2);
    const balls = new T.InstancedMesh(ballGeo, new T.MeshStandardMaterial({color: 0x7A3B1B, roughness: .5}), 80);
    const shirts = new T.InstancedMesh(shirtGeo, new T.MeshStandardMaterial({color: 0xFFFFFF, roughness: .7}), 60);
    balls.frustumCulled = shirts.frustumCulled = false;
    scene.add(balls, shirts);
    const puffTex = puffTexture(T), puffs = [];
    for (let i = 0; i < 40; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({map: puffTex, color: 0xBFB7AA, transparent: true, depthWrite: false, opacity: 0}));
      sp.visible = false; scene.add(sp); puffs.push({sp, t0: -9, life: 1, kind: ''});
    }
    // where nothing can be dropped (shown red while a finger's down on the lot)
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const zoneTex = new T.CanvasTexture(cv); zoneTex.magFilter = T.NearestFilter;
    const zone = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshBasicMaterial({map: zoneTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false}));
    zone.rotation.x = -Math.PI / 2; zone.position.y = .015; zone.renderOrder = 1;
    scene.add(zone);
    raid = {B, meshes, balls, shirts, puffs, fxAt: 0, prev: new Map(), cur: new Map(), stepSeen: -1, zone, zoneCv: cv, zoneTex, zoneSig: '', zoneShow: 0, aim: new Map()};
    drawZone();
    want();
  }
  function drawZone() {
    if (!raid) return;
    const B = raid.B, sig = B.bl.filter(b => b.dead).length;
    if (sig === raid.zoneSig) return;
    raid.zoneSig = sig;
    const g = raid.zoneCv.getContext('2d'), img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4, bad = !B.canDrop(x + .5, y + .5);
      img.data[o] = 230; img.data[o + 1] = 60; img.data[o + 2] = 60; img.data[o + 3] = bad ? 120 : 0;
    }
    g.putImageData(img, 0, 0);
    raid.zoneTex.needsUpdate = true;
  }
  const showZone = (on) => { if (raid) { raid.zoneShow = on ? performance.now() : -1; want(); } };
  /** One frame of the raid at its clock t (seconds; between steps it eases from where each was to where he is). */
  function raidFrame(t, now = performance.now()) {
    if (!raid) return;
    const B = raid.B, R = raid;
    // the steps' positions: keep the last two
    if (B.step !== R.stepSeen) {
      R.prev = R.cur; R.cur = new Map();
      B.tr.forEach(u => R.cur.set(u.id, {x: u.x, y: u.y}));
      R.stepSeen = B.step;
    }
    const f = Math.max(0, Math.min(1, (t - (B.t - .1)) / .1));
    // the players
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1.5, 1.5, 1.5), up = new T.Vector3(0, 1, 0), pv = new T.Vector3();
    const counts = {};
    Object.keys(R.meshes).forEach(k => { counts[k] = 0; });
    B.tr.forEach(u => {
      if (u.dead) return;
      const M = R.meshes[u.t], c = R.cur.get(u.id), p = R.prev.get(u.id) || c;
      if (!M || !c) return;
      const x = p.x + (c.x - p.x) * f, y = p.y + (c.y - p.y) * f;
      const moving = Math.hypot(c.x - p.x, c.y - p.y) > .001, swing = moving ? Math.sin(t * 14 + u.id) * .6 : 0;
      const hit = t - u.hitAt < .35 ? Math.sin((t - u.hitAt) / .35 * Math.PI) : 0;
      const face = -u.face + Math.PI / 2;
      q.setFromAxisAngle(up, face);
      const lean = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), .15 * (moving ? 1 : 0) + .5 * hit);
      const qq = q.clone().multiply(lean);
      const bob = moving ? Math.abs(Math.sin(t * 14 + u.id)) * .04 : 0;
      pv.set(W(x), .33 + bob, W(y));
      const i = counts[u.t]++;
      m4.compose(pv, qq, sc); M.body.setMatrixAt(i, m4);
      [-1, 1].forEach((s, j) => {
        const lq = q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), s * swing));
        const off = new T.Vector3(s * .09 * (u.t === 'lineman' ? 1.4 : 1), 0, 0).applyQuaternion(q);
        m4.compose(new T.Vector3(pv.x + off.x, .33 + bob, pv.z + off.z), lq, sc); M.leg.setMatrixAt(i * 2 + j, m4);
      });
    });
    Object.entries(R.meshes).forEach(([k, M]) => { M.body.count = counts[k]; M.leg.count = counts[k] * 2; M.body.instanceMatrix.needsUpdate = true; M.leg.instanceMatrix.needsUpdate = true; });
    // what's in the air
    let nb = 0, ns = 0;
    B.shots.forEach(s => {
      const u = Math.max(0, Math.min(1, (t - s.t0) / Math.max(.01, s.t1 - s.t0)));
      const arc = s.k === 'jugs' ? 4 : s.k === 'kicker' ? 2.2 : s.k === 'qb' ? 1.1 : s.k === 'cannon' ? .8 : .5;
      const x = s.x0 + (s.x1 - s.x0) * u, y = s.y0 + (s.y1 - s.y0) * u, h = (s.foe ? 1.1 : .5) + arc * 4 * u * (1 - u) - (s.foe ? .7 * u : 0);
      pv.set(W(x), h, W(y));
      q.setFromAxisAngle(up, Math.atan2(s.x1 - s.x0, s.y1 - s.y0));
      m4.compose(pv, q, sc);
      if (s.k === 'cannon' || s.k === 'pressbox') { if (ns < 60) shirtsSet(ns++, m4); }
      else if (s.k !== 'shower' && nb < 80) R.balls.setMatrixAt(nb++, m4);
    });
    function shirtsSet(i, m) { R.shirts.setMatrixAt(i, m); }
    R.balls.count = nb; R.shirts.count = ns; R.balls.instanceMatrix.needsUpdate = true; R.shirts.instanceMatrix.needsUpdate = true;
    // the defenses turn to whom they're shooting at; the bucket tips when it pours
    B.bl.forEach(b => {
      if (!b.def) return;
      const e = groups.get(b.i);
      const top = e && e.g.getObjectByName('top');
      if (!top) return;
      if (b.t === 'shower') { const tip = B.t - (b.cd > 0 ? (b.def.every - b.cd) : 9) < .5 ? .6 : .15; top.rotation.z += (tip - top.rotation.z) * .3; }
      else { const want = -b.aim + Math.PI / 2; const cur = R.aim.get(b.i) ?? want; const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); const nv = cur + d * .25; R.aim.set(b.i, nv); top.rotation.y = nv; }
    });
    // what happened since the last frame: dust, splashes, puffs
    for (; R.fxAt < B.fx.length; R.fxAt++) {
      const e = B.fx[R.fxAt];
      if (e.k === 'boom') { for (let j = 0; j < (e.wall ? 1 : 4); j++) puff(e.x + (j % 2 - .5) * .8, e.y + (j > 1 ? .4 : -.4), e.wall ? .9 : 2.4, 0xB5AC9E, 1.1, now); }
      else if (e.k === 'land' && e.splash) puff(e.x, e.y, e.splash * 2.2, e.of === 'shower' ? 0x9BE15D : 0xE8D8B0, .6, now);
      else if (e.k === 'blast') puff(e.x, e.y, 2.2, 0xFF9A3C, .7, now);
      else if (e.k === 'down') puff(e.x, e.y, .9, 0xDDDDDD, .6, now);
    }
    R.puffs.forEach(p => {
      if (!p.sp.visible) return;
      const a = (now - p.t0) / 1000 / p.life;
      if (a >= 1) { p.sp.visible = false; return; }
      p.sp.material.opacity = .85 * (1 - a);
      const s = p.size * (.5 + a * .8); p.sp.scale.set(s, s, 1);
      p.sp.position.y = .4 + a * .8;
    });
    // the red zone fades out a moment after a refused drop
    drawZone();
    const zt = R.zoneShow > 0 ? (now - R.zoneShow) / 1000 : 9;
    R.zone.material.opacity = zt < 1.2 ? .9 * (1 - Math.max(0, zt - .6) / .6) : 0;
  }
  function puff(x, y, size, color, life, now) {
    const p = raid.puffs.find(q => !q.sp.visible) || raid.puffs[0];
    p.sp.visible = true; p.sp.material.color.set(color); p.t0 = now; p.life = life; p.size = size;
    p.sp.position.set(W(x), .4, W(y));
  }
  function raidStop() {
    if (!raid) return;
    Object.values(raid.meshes).forEach(M => { scene.remove(M.body, M.leg); M.body.dispose(); M.leg.dispose(); });
    scene.remove(raid.balls, raid.shirts, raid.zone);
    raid.puffs.forEach(p => scene.remove(p.sp));
    raid = null;
  }

  // ---- the frame hook (a raid's clock, the job timers' redraws)
  const setAnim = fn => { anim = fn; want(); };
  const look = (x, y, dist) => { view.tx = W(x); view.tz = W(y); if (dist) view.dist = dist; clampView(); want(); };
  /** Frames the box of tiles [x0, x1] x [y0, y1] (seen corner-on, a diamond), as big as it fits. */
  const fit = (x0, y0, x1, y1, margin = 1.15, most = ZMAX) => {
    resize();
    const wTiles = (x1 - x0 + y1 - y0) / Math.SQRT2, hTiles = wTiles * Math.sin(PITCH) * .55 + 3;
    const vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    const d = Math.max(wTiles / 2 / Math.tan(hf / 2), hTiles / 2 / Math.tan(vf / 2)) * margin;
    view.tx = W((x0 + x1) / 2); view.tz = W((y0 + y1) / 2); view.dist = Math.min(d, most);
    clampView(); want();
  };
  resize(); placeCam(); want();
  return {
    setLot, select, setGhost, showGrid, pick, tileAt, project, want, setAnim, look, frame: fit, resize,
    raidStart, raidFrame, raidStop, showZone,
    get zoom() { return view.dist; },
    canvas,
    dispose() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      raidStop();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (_) {}
      canvas.remove();
    }
  };
}
