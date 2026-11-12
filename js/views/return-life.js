import * as features from '../core/features.js';
// Shared scenery pass: deterministic roadside details, wind, weather and small ambient motions.
// A few batches per visible chunk; no collision geometry, textures or per-frame allocations for foliage.
import {seeded} from './stadium.js';
export const TIME = {value: 0};
const clamp = x => Math.max(0, Math.min(1, x));
let materials;
function mats(T) {
  if (materials) return materials;
  const wind = new T.MeshLambertMaterial({vertexColors: true, side: T.DoubleSide});
  wind.onBeforeCompile = sh => {
    sh.uniforms.lifeTime = TIME;
    sh.vertexShader = 'uniform float lifeTime; attribute vec3 lifeMotion;\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float wave = sin(lifeTime * 2.1 + position.z * .68 + lifeMotion.y);
      float gust = .65 + .35 * sin(lifeTime * .63 + position.x * .19);
      if (lifeMotion.z < 1.5) {
        transformed.x += wave * gust * lifeMotion.x * .24;
        transformed.z += sin(lifeTime * 1.7 + lifeMotion.y) * lifeMotion.x * .09;
        transformed.y += wave * lifeMotion.x * .035;
      } else if (lifeMotion.z < 2.5) {
        transformed.y -= mod(lifeTime * .55 + lifeMotion.y, 4.5);
        transformed.x += sin(lifeTime * .7 + lifeMotion.y) * .7;
      } else if (lifeMotion.z < 3.5) {
        transformed.y += sin(lifeTime * .8 + lifeMotion.y) * .22;
        transformed.x += sin(lifeTime * .6 + lifeMotion.y) * .5;
      } else {
        transformed.x += sin(lifeTime * .9 + lifeMotion.y) * .8;
        transformed.y += sin(lifeTime * 1.2 + lifeMotion.y) * .045;
      }`);
  };
  wind.customProgramCacheKey = () => 'return-life-wind-v1';
  const depth = new T.MeshDepthMaterial({depthPacking: T.RGBADepthPacking});
  depth.onBeforeCompile = wind.onBeforeCompile; depth.customProgramCacheKey = () => 'return-life-depth-v1';
  materials = {wind, depth, solid: new T.MeshLambertMaterial({vertexColors: true}),
    shade: new T.MeshBasicMaterial({color: 0x152333, transparent: true, opacity: .12, depthWrite: false}),
    mist: new T.MeshLambertMaterial({vertexColors: true, transparent: true, opacity: .25, depthWrite: false})};
  return materials;
}
function motionMesh(T, batch, ranges) {
  const m = batch.mesh(mats(T).wind);
  if (!m) return null;
  const p = m.geometry.attributes.position, a = new Float32Array(p.count * 3);
  for (const [from, to, base, height, phase, kind] of ranges) for (let i = from; i < to; i++) {
    a[i * 3] = height ? clamp((p.getY(i) - base) / height) : 1;
    a[i * 3 + 1] = phase; a[i * 3 + 2] = kind || 0;
  }
  m.geometry.setAttribute('lifeMotion', new T.BufferAttribute(a, 3)); m.geometry.boundingSphere.radius += 2;
  m.name = 'living-foliage'; return m;
}
/** Also let the existing imported greenery respond to the same breeze. */
export function swayFoliage(T, m, id) {
  if (!m || id === 'space' || !features.returnManUpdated()) return;
  const p = m.geometry.attributes.position, c = m.geometry.attributes.color, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const green = c.getY(i) > c.getX(i) * 1.1 && c.getY(i) > c.getZ(i) * 1.03;
    a[i * 3] = green && p.getY(i) > 1.1 ? Math.min(1.5, p.getY(i) * .12) : 0;
    a[i * 3 + 1] = p.getX(i) * .2;
  }
  m.geometry.setAttribute('lifeMotion', new T.BufferAttribute(a, 3)); m.material = mats(T).wind;
  m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = mats(T).depth;
}
export const THEMES = {
  stadium: 'Waving pennants, moving turf, sideline equipment and worn grass',
  tailgate: 'Smoking grills, folding chairs, coolers and fluttering bunting',
  city: 'Planters, storm drains, pigeons, litter, roof vents and street banners',
  tundra: 'Drifting snow, icicles, frost, trail markers and snow-laden branches',
  desert: 'Rolling tumbleweed, dust, sagebrush, pebbles and sun-bleached bones',
  market: 'Produce crates, hanging lanterns, fluttering cloth and a wandering cat',
  beach: 'Rolling surf, foam, bobbing buoys, shells, driftwood and dune grass',
  space: 'Rotating satellites, scanning beacons, floating rocks and instrument panels',
  farm: 'Swaying wheat, wildflowers, irrigation, butterflies and grazing livestock'
};
export function build(T, Batch, g, id, z0, z1, props = []) {
  if (!features.returnManUpdated()) return;
  const r = seeded(Math.abs(Math.floor(z0 * 173 + id.length * 7919)) + 71), b = new Batch(), w = new Batch(), shades = new Batch(), ranges = [];
  const M = mats(T), center = (z0 + z1) / 2;
  g.userData.livingWorld = id; g.life = [];
  const motion = (base, height, fn, kind = 0) => { const n = w.n; fn(); ranges.push([n, w.n, base, height, r() * 6.28, kind]); };
  const shadow = (x, z, sx, sz) => {
    shades.add('cyl6', '#FFFFFF', x + .5, .018, z + .6, sx, .005, sz);
    shades.add('cyl6', '#FFFFFF', x + .65, .017, z + .8, sx * 1.25, .004, sz * 1.2);
  };
  const dynamic = (kind, x, y, z, fn) => {
    const q = new T.Group(), qBatch = new Batch(); fn(qBatch);
    const m = qBatch.mesh(kind === 'smoke' || kind === 'dust' ? M.mist : M.solid);
    if (!m) return;
    q.add(m); q.position.set(x, y, -z); q.name = 'living-' + kind; g.add(q);
    g.life.push({q, kind, x, y, z: -z, phase: r() * 6.28});
  };
  const flag = (x, z, h, color) => {
    b.cyl('#D8D3B8', x, 0, h + .1, z, .035, 'cyl6');
    motion(h - .65, .65, () => {
      for (let k = 0; k < 6; k++) w.add('box', k % 2 ? '#FFF0CE' : color, x + .15 + k * .16, h - .32, z, .18, .65, .035);
    });
  };
  const grass = (x, z, height, color) => motion(0, height, () => {
    for (let k = 0; k < 4; k++) w.add('cone4', k % 2 ? color : '#92AA52', x + (r() - .5) * .34, height * .5, z + (r() - .5) * .3, .035, height, .12, 0, r() * 6.28, (r() - .5) * .2);
  });
  // Near details stay outside the three-lane collision corridor. Dense turf stays low and roadside.
  if (!['tundra', 'space'].includes(id)) for (const side of [-1, 1]) for (let k = 0; k < 22; k++) {
    const x = side * (5.15 + r() * (id === 'stadium' ? 8 : .9)), z = z0 + r() * (z1 - z0);
    const desert = id === 'desert', beach = id === 'beach';
    grass(x, z, id === 'stadium' ? .07 + r() * .08 : (desert ? .25 : beach ? .6 : .35) + r() * .35, desert ? '#898C57' : beach ? '#A8B365' : '#4D8C47');
    if (k % 6 === 0) b.add('rock', desert ? '#C29668' : '#A9A99A', x, .06, z, .12, .07, .18);
  }
  // Soft contact patches and long angled shadows ground the existing buildings and trees.
  for (const o of props) {
    const z = (o.z0 + (o.z1 || o.z0)) / 2;
    if (z < z0 || z >= z1) continue;
    if (['palm', 'pine', 'cactus', 'sunflower', 'lamp', 'lamp2', 'bldg', 'barn', 'house', 'stall'].includes(o.k)) {
      const x = o.s * (o.x ?? 6.6), size = ['bldg', 'barn', 'house'].includes(o.k) ? 2 : .65;
      shadow(x, z, size, size * 1.6);
    }
    if (id === 'city' && o.k === 'bldg') {
      b.box('#8799A1', o.s * (o.x + 1.1), o.s * (o.x + 2.5), o.h + .7, o.h + 1.3, z - .6, z + .6);
      for (let k = 0; k < 5; k++) b.box('#36495D', o.s * (o.x + 1.12), o.s * (o.x + 2.48), o.h + .8 + k * .08, o.h + .83 + k * .08, z - .62, z - .6);
    }
  }
  for (const side of [-1, 1]) {
    const x = side * 5.9, z = center + side * 3;
    if (id === 'stadium') {
      flag(side * 13, z, 3.8, '#E6AA38');
      b.box('#ED713F', side * 10 - .18, side * 10 + .18, 0, .8, z - .16, z + .16);
      b.box('#2B4358', side * 11 - .8, side * 11 + .8, .35, .5, z + 2, z + 2.5);
      for (let k = 0; k < 8; k++) b.add('rock', '#517A3D', side * (6 + r() * 7), .006, z0 + r() * 20, .28, .008, .5);
    } else if (id === 'tailgate') {
      b.add('box', '#328B9D', x, .28, z, .7, .55, .65); b.add('box', '#F7EAD0', x, .59, z, .76, .12, .7);
      b.add('box', '#DF6844', x, .4, z + 2, .7, .09, .65); b.add('box', '#DF6844', x, .85, z + 2.25, .7, .8, .08);
      for (const dx of [-.28, .28]) b.add('box', '#D5D9CC', x + dx, .2, z + 2, .05, .45, .65, 0, 0, dx);
      flag(side * 6.4, z - 3, 3.2, '#E76C3C');
      b.add('ball', '#303B42', x, 1, z + 4, .48, .27, .43); b.cyl('#687B80', x, 0, .95, z + 4, .055);
      dynamic('smoke', x, 1.4, z + 4, q => { for (let k = 0; k < 4; k++) q.add('ball', '#DCE1D7', k * .14, k * .45, 0, .15 + k * .09, .2 + k * .08, .18 + k * .08); });
    } else if (id === 'city') {
      b.add('box', '#81999A', x, .18, z, .7, .36, 1.15); grass(x, z, .95, '#3E985C');
      b.add('box', '#2C4654', side * 5.05, .006, z - 3, .7, .012, 1);
      for (let k = 0; k < 6; k++) b.add('box', '#74888D', side * 5.05, .014, z - 3.4 + k * .16, .65, .01, .04);
      flag(x + side * .5, z + 4, 4.2, '#3DAFC0');
      dynamic('litter', side * 5.4, .15, z - 5, q => q.add('box', '#EDE3BD', 0, 0, 0, .35, .018, .5, .2, .3, .1));
      dynamic('pigeons', side * 6, .1, z + 6, q => { for (let k = 0; k < 3; k++) {
        q.add('ball', '#6F818B', k * .38, .12, k % 2 * .4, .12, .18, .2);
        q.add('ball', '#3B5965', k * .38, .33, k % 2 * .4 - .1, .075, .09, .08);
        q.add('cone4', '#E6B87A', k * .38, .32, k % 2 * .4 - .2, .04, .1, .04, Math.PI / 2);
      } });
    } else if (id === 'tundra') {
      b.add('rock', '#E8F3F3', x + side * .6, .45, z, .8, .6, 1.1); shadow(x, z, .8, .65);
      flag(side * 6.9, z + 2, 2.6, '#F18D42');
      for (let k = 0; k < 5; k++) b.add('cone4', '#AFD5E2', side * 6.1, .48, z + 3 + k * .24, .08, .5, .07, Math.PI);
      for (let k = 0; k < 12; k++) motion(0, 0, () => w.add('ball', '#F3FCFF', side * (5 + r() * 12), 4.5 + r() * 4.5, z0 + r() * 20, .035, .035, .035), 2);
    } else if (id === 'desert') {
      for (let k = 0; k < 4; k++) b.add('rock', '#D6B88A', x + side * r(), .12, z + k * .4, .18, .13, .32);
      b.add('box', '#E8D7AB', x, .08, z + 3, .12, .12, .9, 0, .7, .1);
      dynamic('tumbleweed', side * 6.2, .4, z - 2, q => {
        q.add('tor', '#A98B54', 0, 0, 0, .45, .45, .5); q.add('tor', '#BD9F63', 0, 0, 0, .4, .4, .55, 0, Math.PI / 2);
        for (let k = 0; k < 5; k++) q.add('box', '#A98B54', 0, 0, 0, .025, .85, .025, k, .5, k * .7);
      });
      dynamic('dust', side * 7.5, .25, z + 4, q => { for (let k = 0; k < 4; k++) q.add('ball', '#D9B675', k * .5, k * .18, 0, .6, .25, .45); });
    } else if (id === 'market') {
      for (let k = 0; k < 2; k++) {
        b.add('box', '#9E6D3D', x, .23, z + k, .7, .46, .75);
        for (let j = 0; j < 6; j++) b.add('ball', k ? '#E9B944' : '#DD6641', x + (j % 3 - 1) * .19, .53 + Math.floor(j / 3) * .06, z + k + (Math.floor(j / 3) - .5) * .22, .12, .12, .12);
      }
      flag(side * 6.4, z - 2, 3.4, '#D67C5F');
      dynamic('lantern', side * 6.3, 2.6, z + 3, q => { q.add('ball', '#F6CB69', 0, 0, 0, .22, .33, .22); q.add('box', '#3C5962', 0, .36, 0, .4, .08, .4); });
      if (side > 0) dynamic('cat', x, .2, z + 5, q => {
        q.add('ball', '#AD8F6A', 0, .2, 0, .18, .18, .4); q.add('ball', '#AD8F6A', 0, .4, -.3, .17, .17, .17);
        [-.1, .1].forEach(dx => q.add('cone4', '#805F45', dx, .58, -.3, .07, .16, .07)); q.add('box', '#805F45', 0, .35, .4, .08, .1, .45, -.5);
        for (const dx of [-.12, .12]) for (const dz of [-.2, .2]) q.add('box', '#805F45', dx, .05, dz, .07, .2, .07);
      });
    } else if (id === 'beach') {
      for (let k = 0; k < 7; k++) b.add('cone4', k % 2 ? '#F9DEB3' : '#E9B9A4', x + r() * side, .04, z + r() * 5, .12, .08, .17, 0, r() * 3);
      b.add('cyl6', '#A78C69', x, .12, z - 2, .16, 1.7, .16, Math.PI / 2, .4);
      for (let k = 0; k < 7; k++) b.add('ball', '#D1BD91', x + (k % 2 ? .18 : -.18), .006, z - 5 + k * .35, .08, .008, .16);
      if (side < 0) {
        for (let k = 0; k < 3; k++) motion(0, 0, () => {
          for (let j = 0; j < 14; j++) w.add('box', k === 0 ? '#ECFCF4' : '#A1E2DF', -16.8 - k * 3 + Math.sin(j) * .25, .06, z0 + j * 1.5, .4, .025, 1.55);
        }, 4);
        dynamic('buoy', -22, .5, z, q => { q.add('cyl6', '#F3E9CD', 0, 0, 0, .22, 1, .22); q.add('cone', '#E97045', 0, .7, 0, .32, .45, .32); });
      }
    } else if (id === 'space') {
      b.add('box', '#50647E', x, .3, z, .8, .6, .7); b.add('box', '#6FE8DC', x, .62, z, .65, .04, .5);
      dynamic('satellite', side * 9, 3.5, z + 3, q => {
        q.add('box', '#CFD4CE', 0, 0, 0, .6, .6, .65);
        for (const dx of [-1.1, 1.1]) { q.add('box', '#2B658E', dx, 0, 0, 1.4, .07, .9); q.add('box', '#64DBDE', dx, .05, 0, 1.3, .02, .035); }
        q.add('cone', '#D9E7D5', 0, .65, 0, .5, .5, .5, 0, 0, .4);
      });
      dynamic('orbital-rock', side * 7, 1.7, z - 3, q => q.add('rock', '#928DA6', 0, 0, 0, .4, .3, .5));
    } else if (id === 'farm') {
      dynamic('butterfly', side * 5.7, 1.2, z + 3, q => {
        q.add('box', '#4E493C', 0, 0, 0, .025, .035, .18);
        for (const s of [-1, 1]) q.add('ball', '#F2AE50', s * .12, .03, 0, .14, .025, .14, 0, 0, s * .3);
      });
      for (let k = 0; k < 16; k++) {
        const xx = side * (5.2 + r() * .9), zz = z0 + r() * 20;
        motion(0, 1.1, () => { w.add('box', '#799945', xx, .5, zz, .025, 1, .025); w.add('cone4', '#D5BD63', xx, 1.05, zz, .1, .35, .1, 0, .2, .12); });
      }
      for (let k = 0; k < 7; k++) { const zz = z + k * .5; b.add('ball', k % 2 ? '#F3CC61' : '#E6D9CA', side * 5.1, .32, zz, .12, .07, .12); }
      b.add('cyl6', '#536A70', side * 6.5, .4, z, .06, 4, .06, Math.PI / 2);
      if (side > 0) dynamic('cow', 9, 0, z, q => {
        q.add('ball', '#E4DBBD', 0, .9, 0, .55, .6, 1); q.add('ball', '#665849', -.2, 1.08, 0, .35, .35, .55);
        q.add('box', '#E4DBBD', 0, .65, -1, .6, .65, .6);
        for (const dx of [-.34, .34]) for (const dz of [-.6, .6]) q.add('box', '#665849', dx, .25, dz, .14, .5, .14);
        q.add('box', '#A78A6B', 0, .4, -1.35, .55, .25, .15);
      });
    }
    if (id !== 'space') shadow(x, z, .55, .7);
  }
  const staticMesh = b.mesh(M.solid), moving = motionMesh(T, w, ranges), shade = shades.mesh(M.shade);
  if (staticMesh) { staticMesh.castShadow = true; staticMesh.receiveShadow = true; staticMesh.name = 'living-details'; g.add(staticMesh); }
  if (moving) g.add(moving);
  if (shade) { shade.renderOrder = 1; shade.name = 'living-contact-shadows'; g.add(shade); }
}
export function animate(g, t, reduced = false) {
  for (const o of g.life || []) {
    const a = reduced ? 0 : t, s = Math.sin(a * .8 + o.phase);
    o.q.position.set(o.x, o.y, o.z); o.q.rotation.set(0, 0, 0);
    if (o.kind === 'smoke' || o.kind === 'dust') { o.q.position.x += s * .4; o.q.position.y += (s + 1) * .18; }
    if (o.kind === 'tumbleweed') { o.q.position.z += s * 1.2; o.q.rotation.x = a * 1.7; }
    if (o.kind === 'litter') { o.q.position.z += s * .8; o.q.position.y += Math.abs(Math.sin(a * 1.8)) * .25; o.q.rotation.z = s * .5; }
    if (o.kind === 'lantern') o.q.rotation.z = s * .13;
    if (o.kind === 'buoy') { o.q.position.y += s * .17; o.q.rotation.z = s * .12; }
    if (o.kind === 'satellite' || o.kind === 'orbital-rock') { o.q.rotation.y = a * .28 + o.phase; o.q.position.y += s * .15; }
    if (o.kind === 'cat') { o.q.position.z += s * .75; o.q.position.y += Math.abs(Math.sin(a * 5)) * .025; }
    if (o.kind === 'cow') { o.q.rotation.y = s * .08; o.q.position.y += Math.sin(a * 1.8) * .025; }
    if (o.kind === 'pigeons') { o.q.position.z += s * .3; o.q.position.y += Math.abs(Math.sin(a * 3 + o.phase)) * .06; o.q.rotation.y = s * .2; }
    if (o.kind === 'butterfly') { o.q.position.x += s * .3; o.q.position.y += Math.sin(a * 3 + o.phase) * .2; o.q.rotation.z = Math.sin(a * 14 + o.phase) * .7; }
  }
}
/** Lightweight canvas fallback: moving verge plants, shadows and place-specific wind/weather details. */
export function draw2D(st, c, project, id, z0, z1, t) {
  if (!features.returnManUpdated()) return;
  const r = seeded(Math.abs(Math.floor(z0 * 173 + id.length * 7919)) + 71);
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1, x = side * (5.2 + r() * 1.3), z = z0 + r() * (z1 - z0), h = .25 + r() * .6;
    if (z < st.camZ + 1) continue;
    const foot = project(st, x, 0, z), top = project(st, x + Math.sin(t * 2 + z) * .16, h, z);
    c.fillStyle = 'rgba(20,35,45,.14)'; c.beginPath(); c.ellipse(foot.x + foot.s * .2, foot.y, foot.s * .3, foot.s * .07, 0, 0, 6.283); c.fill();
    if (id === 'tundra') { c.fillStyle = '#F1FCFF'; c.beginPath(); c.arc(top.x + Math.sin(t + i) * 9, top.y - ((t * 15 + i * 19) % 80), 1.5, 0, 6.283); c.fill(); continue; }
    if (id === 'space') { c.fillStyle = '#7CE5DB'; c.fillRect(top.x, top.y, Math.max(2, top.s * .12), Math.max(2, top.s * .12)); continue; }
    c.strokeStyle = id === 'desert' ? '#AAA06A' : id === 'beach' ? '#A7B472' : '#6D9E4B'; c.lineWidth = Math.max(1, foot.s * .03);
    for (const dx of [-.09, 0, .09]) { c.beginPath(); c.moveTo(foot.x, foot.y); c.quadraticCurveTo(top.x, foot.y - foot.s * h * .5, top.x + foot.s * dx, top.y); c.stroke(); }
    if (id === 'farm') { c.fillStyle = '#E0C876'; c.beginPath(); c.ellipse(top.x, top.y, top.s * .06, top.s * .14, .2, 0, 6.283); c.fill(); }
  }
}
