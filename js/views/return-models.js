// Return Man's scenery models (the owner's Unity packs, Oct 25 2026: "use the assets to create new and improved
// sceneries in the game ... for both objects outside the three lane gameplay and within"): Western towns and mesas in
// the desert, snowy pines, log cabins and ice cliffs on the tundra, palms, umbrellas, boats and a pirate's treasure on
// the beach, a sci-fi city and its ships in space, barns, hay and tree lines on the farm, park benches and pocket parks
// in the city, crates, barrels and planters at the market, picnic tables and a tree line at the tailgate; and in the
// lanes, the desert's mine carts, the market's crates, the beach's lifeguard chair, the farm's fences and space's hover
// cars (each in the very box the course gives it: core/return.js KINDS, so nothing you jump on, run under or round moves).
// models/return/<place>-v1.glb (tools/return/scenery-models.mjs), one a place, asked for as the run comes near it (and
// kept by the service worker once seen); read straight from the GLB (16-bit corners, a colour a face, its indices) and
// laid out flat, each face its own corners and normal, for the world's batches (return-3dworld.js Batch.model) to copy:
// no textures, no extra draws. Until a place's models are in, or if they never come (offline, a failed fetch), the
// world builds that place as it always has.
// Exports: want(id), ready(id), failed(id), version(), prop(b, lit, o, id), extras(b, lit, id, z0, z1, list, key),
// vehicle(b, lit, V, p, id).
import {seeded} from './stadium.js';

const FILES = {desert: 1, tundra: 1, beach: 1, space: 1, farm: 1, city: 1, market: 1, tailgate: 1};
const LIB = new Map(); // id -> {state: 'loading' | 'ready' | 'failed', models: Map(name -> model)}
let VERSION = 0;
const PI = Math.PI;

/** Starts loading a place's models (once; a failure isn't tried again this page load). */
export function want(id) {
  if (!FILES[id] || LIB.has(id) || typeof fetch !== 'function') return;
  const e = {state: 'loading', models: null};
  LIB.set(id, e);
  fetch(new URL(`../../models/return/${id}-v${FILES[id]}.glb`, import.meta.url))
    .then(r => { if (!r.ok) throw new Error('Return Man scenery unavailable'); return r.arrayBuffer(); })
    .then(buf => { e.models = parse(buf); e.state = 'ready'; VERSION++; })
    .catch(() => { e.state = 'failed'; });
}
export const ready = id => !!LIB.get(id) && LIB.get(id).state === 'ready';
/** Whether a place has no models to wait for (none made for it, or they couldn't be had). */
export const failed = id => !FILES[id] || (!!LIB.get(id) && LIB.get(id).state === 'failed');
/** Bumped each time a place's models come in (return-3dworld.js rebuilds what's still far off). */
export const version = () => VERSION;
const get = (id, name) => { const e = LIB.get(id); return (e && e.models && e.models.get(name)) || null; };

/** The GLB tools/return/scenery-models.mjs writes: a node a model (name~lit: the faces of it that glow), each one
 *  primitive: POSITION (normalized shorts, KHR_mesh_quantization: the node's translation and scale), COLOR_0 (bytes),
 *  indices. Each model comes out flat: p (corners), n (each face's normal on its corners), c (colours), k (corners). */
function parse(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Not a GLB');
  const jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
  const at = i => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; return {a, v, o: bin + (v.byteOffset || 0) + (a.byteOffset || 0)}; };
  const out = new Map();
  for (const node of json.nodes) {
    const prim = json.meshes[node.mesh].primitives[0], P = at(prim.attributes.POSITION), C = at(prim.attributes.COLOR_0), I = at(prim.indices);
    const t = node.translation || [0, 0, 0], s = node.scale || [1, 1, 1], ps = P.v.byteStride || 6, cs = C.v.byteStride || 4;
    const idx = I.a.componentType === 5125 ? new Uint32Array(buf.slice(I.o, I.o + I.a.count * 4)) : new Uint16Array(buf.slice(I.o, I.o + I.a.count * 2));
    const k = idx.length, p = new Float32Array(k * 3), n = new Float32Array(k * 3), c = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) {
      const v = idx[i], po = P.o + v * ps, co = C.o + v * cs;
      for (let j = 0; j < 3; j++) {
        p[i * 3 + j] = t[j] + s[j] * Math.max(-1, dv.getInt16(po + j * 2, true) / 32767);
        c[i * 3 + j] = dv.getUint8(co + j) / 255;
      }
    }
    for (let i = 0; i < k * 3; i += 9) {
      const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2], bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let j = 0; j < 9; j += 3) { n[i + j] = nx; n[i + j + 1] = ny; n[i + j + 2] = nz; }
    }
    const lit = node.name.endsWith('~lit'), name = lit ? node.name.slice(0, -4) : node.name, model = {p, n, c, k, size: (node.extras && node.extras.size) || [1, 1, 1]};
    if (lit) { const m = out.get(name); if (m) m.lit = model; else out.set(name, {p: new Float32Array(0), n: new Float32Array(0), c: new Float32Array(0), k: 0, size: model.size, lit: model}); }
    else { const old = out.get(name); if (old && old.lit) model.lit = old.lit; out.set(name, model); }
  }
  return out;
}

// ============================================================================ Placing them
const hashOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % 2147483647; };
const rnd = (...k) => seeded(hashOf(k.join('|')) || 1);
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Model m (a place's) with its foot's middle at (x, y, z) (the world's yards), turned ry, sized s (its own x, y, z). */
function put(b, lit, m, x, y, z, ry = 0, s = 1, sy = s, sz = s) {
  if (!m) return false;
  if (m.k) b.model(m, x, y, z, ry, s, sy, sz);
  if (m.lit) lit.model(m.lit, x, y, z, ry, s, sy, sz);
  return true;
}
// (its front, +z as it's made, to the road: from the left side, +x; from the right, -x)
const toRoad = s => -s * PI / 2;

/** Builds a roadside thing of the 2D world's list (o: return-world.js dressList) from its place's models; false: the
 *  world's own shapes should draw it (no model for it, or none in yet). */
export function prop(b, lit, o, id) {
  if (!ready(id)) return false;
  const f = PROPS[id] && PROPS[id][o.k];
  return f ? f(b, lit, o, (name) => get(id, name), rnd('prop', id, o.k, o.s, o.z0.toFixed(2), (o.x || 0).toFixed(2))) !== false : false;
}

const SIGN_MODEL = {SALOON: 'saloon', BANK: 'bank', HOTEL: 'house4', 'GENERAL STORE': 'house1', 'TRADING POST': 'house2', SHERIFF: 'house3', BARBER: 'house2'};
const PROPS = {
  desert: {
    // the false fronts: a Western building each, its front to the road, as long as its lot (or near it)
    facade(b, lit, o, M, r) {
      const m = M(SIGN_MODEL[o.name] || pick(r, ['house1', 'house2', 'house3'])), len = o.z1 - o.z0;
      if (!m) return false;
      const k = clamp(len / m.size[0], .78, 1.2);
      return put(b, lit, m, o.s * (o.x + m.size[2] * k / 2), 0, (o.z0 + o.z1) / 2, toRoad(o.s), k);
    },
    cactus(b, lit, o, M, r) {
      const big = o.h > 3.4, m = M(big ? pick(r, ['cactus1', 'cactus2', 'cactus3', 'cactus4']) : pick(r, ['dcactus1', 'dcactus2']));
      return m ? put(b, lit, m, o.s * o.x, 0, o.z0, r() * PI * 2, o.h / m.size[1]) : false;
    },
    rock(b, lit, o, M, r) {
      const m = M(o.h < .9 && r() < .2 ? 'bone' : 'rock');
      return m ? put(b, lit, m, o.s * o.x, 0, o.z0, r() * PI * 2, clamp(o.h / 1.2, .5, 1.6)) : false;
    },
    tower(b, lit, o, M, r) { const m = M('reservoir'); return m ? put(b, lit, m, o.s * o.x, 0, o.z0, r() * PI * 2) : false; },
    barrel(b, lit, o, M, r) {
      if (!put(b, lit, M('barrel'), o.s * o.x, 0, o.z0, r() * PI)) return false;
      if (r() < .5) put(b, lit, M('crate'), o.s * (o.x + 1.2), 0, o.z0 + .9, r() * PI);
      return true;
    },
    // (now and then a steer's skull where the old wheel lay; else the wheel)
    wheel(b, lit, o, M, r) { return r() < .4 ? put(b, lit, M('bone'), o.s * o.x, 0, o.z0, r() * PI * 2) : false; }
  },
  tundra: {
    // the snowy pines (kept clear of the road and of the cabin, if one stands here)
    pine(b, lit, o, M, r) {
      const m = M(pick(r, ['pine1', 'pine2', 'pine3']));
      if (!m) return false;
      const cab = cabinOf(o.zi, o.s);
      if (cab && Math.abs(o.z0 - cab.z) < 8 && o.x < cab.x + 11) return true; // (none in front of it, or in it)
      const k = Math.min(o.h / m.size[1], (o.x - 5.9) / (Math.max(m.size[0], m.size[2]) / 2));
      return put(b, lit, m, o.s * o.x, 0, o.z0, r() * PI * 2, Math.max(.35, k));
    }
  },
  beach: {
    palm(b, lit, o, M, r) { const m = M(r() < .6 ? 'palm1' : 'palm2'); return m ? put(b, lit, m, o.s * o.x, 0, o.z0, r() * PI * 2, o.h / m.size[1]) : false; },
    umbrella(b, lit, o, M, r) {
      if (!put(b, lit, M(pick(r, ['umbrella1', 'umbrella2', 'umbrella3'])), o.s * o.x, 0, o.z0, r() * PI)) return false;
      put(b, lit, M(r() < .5 ? 'chair1' : 'chair2'), o.s * (o.x + .9), 0, o.z0 - .4, PI + (r() - .5) * .8);
      if (r() < .4) put(b, lit, M(r() < .5 ? 'ball1' : 'ball2'), o.s * (o.x - .8), 0, o.z0 + 1.1, r() * PI);
      return true;
    },
    surf(b, lit, o, M, r) { return put(b, lit, M(r() < .5 ? 'surf1' : 'surf2'), o.s * o.x, 0, o.z0, toRoad(o.s) + (r() - .5) * .5); },
    // the lifeguard's chair, up the beach, watching the sea
    lifeguard(b, lit, o, M) { return put(b, lit, M('lifeguard'), o.s * o.x, 0, o.z0, -PI / 2); }
  },
  space: {
    dome(b, lit, o, M, r) {
      const m = M(pick(r, ['solar', 'house1', 'house2', 'house4', 'house5', 'planetarium']));
      if (!m) return false;
      return put(b, lit, m, o.s * (o.x + o.w * .2), 0, o.z0, toRoad(o.s), clamp(o.w * 1.7 / Math.max(m.size[0], m.size[2]), .6, 1.25));
    },
    spire(b, lit, o, M, r) { const m = M(pick(r, ['crystal1', 'crystal2', 'crystal3', 'crystal4', 'crystal5'])); return m ? put(b, lit, m, o.s * o.x, 0, o.z0, r() * PI * 2, clamp(o.h / m.size[1], .5, 1.6)) : false; },
    rocket(b, lit, o, M, r) { return put(b, lit, M('rocket'), o.s * o.x, 0, o.z0, r() * PI * 2); },
    dish(b, lit, o, M) { return put(b, lit, M('antenna'), o.s * o.x, 0, o.z0, toRoad(o.s)); },
    beacon(b, lit, o, M) { return put(b, lit, M('streetlight'), o.s * o.x, 0, o.z0, 0, .72); }
  },
  farm: {
    barn(b, lit, o, M, r) {
      const m = M(r() < .5 ? 'barn1' : 'barn2');
      if (!m) return false;
      // (no deeper than the old barn's 8 yards and a bit: the silo stands behind it)
      const k = clamp(Math.min((o.z1 - o.z0) / m.size[0], 8.6 / m.size[2]), .6, 1.1);
      return put(b, lit, m, o.s * (o.x + m.size[2] * k / 2), 0, (o.z0 + o.z1) / 2, toRoad(o.s), k);
    },
    bale(b, lit, o, M, r) { return put(b, lit, M('hay'), o.s * o.x, 0, o.z0, r() * PI); },
    // now and then a pasture where the corn stood: hay, a tree or two, what a farm leaves lying about
    corn(b, lit, o, M, r) {
      if (r() >= .4) return false;
      const len = o.z1 - o.z0;
      for (let z = o.z0 + 2; z < o.z1 - 2; z += 5 + r() * 4) {
        const u = r(), x = 11 + r() * 12;
        if (u < .45) [0, 1].forEach(k => put(b, lit, M('hay'), o.s * (x + k * 1.8), 0, z + k * .7, r() * PI));
        else if (u < .6) put(b, lit, M(r() < .5 ? 'stump' : 'log'), o.s * x, 0, z, r() * PI * 2);
        else if (u < .75) put(b, lit, M(r() < .5 ? 'bush1' : 'bush2'), o.s * x, 0, z, r() * PI * 2);
      }
      for (let z = o.z0 + 4 + r() * 4; z < o.z1 - 2; z += 9 + r() * 6) put(b, lit, M(pick(r, ['tree1', 'tree2', 'tree3'])), o.s * (24 + r() * 12), 0, z, r() * PI * 2, .8 + r() * .4);
      if (len > 16 && r() < .5) put(b, lit, M(r() < .5 ? 'wagon' : 'well'), o.s * (16 + r() * 4), 0, o.z0 + len / 2, r() * PI * 2);
      return true;
    }
  }
};

// ---------------------------------------------------------------------------- The tundra's cabin (one a stretch, or none)
const CABINS = new Map();
function cabinOf(zi, s) {
  const k = zi + '|' + s;
  if (!CABINS.has(k)) {
    const r = rnd('cabin', zi), side = r() < .5 ? -1 : 1, z = zi * 100 + 22 + r() * 56;
    if (CABINS.size > 40) CABINS.clear();
    CABINS.set(zi + '|' + side, {x: 17 + r() * 4, z, m: r() < .55 ? 'cabin1' : 'cabin3'});
    CABINS.set(zi + '|' + -side, null);
  }
  return CABINS.get(k);
}

/** What a place's models add that the 2D world never had (in this chunk: z0 to z1, its things (list) and its key, the
 *  same course always the same): kept out past the 2D world's things, or in the gaps between them. */
export function extras(b, lit, id, z0, z1, list, key) {
  if (!ready(id) || !EXTRA[id]) return false;
  EXTRA[id](b, lit, z0, z1, list, name => get(id, name), rnd('extra', id, key, z0));
  return true;
}
/** Whether nothing of the list stands within d yards of (s, x, z) (each thing's footprint: its x, its z0 to z1). */
const clear = (list, s, x, z, d) => !list.some(o => o.s === s && Math.abs((o.x || 6.5) - x) < d + (o.k === 'facade' || o.k === 'house' || o.k === 'bldg' || o.k === 'barn' ? 8 : 1) &&
  z > Math.min(o.z0, o.z1) - d && z < Math.max(o.z0, o.z1) + d);
const EXTRA = {
  desert(b, lit, z0, z1, list, M, r) {
    [-1, 1].forEach(s => {
      // mesas far out, Western life between
      if (r() < .45) put(b, lit, M(pick(r, ['mesa1', 'mesa2', 'mesa3'])), s * (40 + r() * 18), -.4, z0 + r() * 20, r() * PI * 2, .8 + r() * .6);
      const u = r(), z = z0 + 3 + r() * 14, x = 27 + r() * 8;
      if (u < .14) put(b, lit, M('windmill'), s * x, 0, z, r() * PI * 2);
      else if (u < .24) { put(b, lit, M('minetower'), s * (x + 4), 0, z, toRoad(s)); put(b, lit, M('mine'), s * x, 0, z - 6, toRoad(s)); }
      else if (u < .32) put(b, lit, M(r() < .5 ? 'church' : 'chapel'), s * (x + 3), 0, z, toRoad(s));
      else if (u < .46) put(b, lit, M(r() < .5 ? 'deadtree1' : 'deadtree2'), s * x, 0, z, r() * PI * 2, .8 + r() * .4);
      else if (u < .58) put(b, lit, M(r() < .55 ? 'wagon' : 'coach'), s * x, 0, z, r() * PI * 2);
      else if (u < .66) put(b, lit, M('well'), s * x, 0, z, r() * PI * 2);
      else if (u < .74) {
        // a boot hill: crosses and stones behind a little iron fence
        for (let i = 0; i < 4; i++) put(b, lit, M(i % 2 ? 'tombstone4' : 'tombstone1'), s * (x + (i % 2) * 1.6), 0, z + (i >> 1) * 1.8 + (i % 2) * .4, toRoad(s) + (r() - .5) * .3);
        put(b, lit, M('graveyard'), s * (x - 1.2), 0, z + .9, toRoad(s) + PI / 2 * s * 0);
      }
    });
  },
  tundra(b, lit, z0, z1, list, M, r) {
    const zi = Math.floor(z0 / 100);
    [-1, 1].forEach(s => {
      const cab = cabinOf(zi, s);
      if (cab && cab.z >= z0 && cab.z < z1) put(b, lit, M(cab.m), s * (cab.x + 2), 0, cab.z, toRoad(s));
      if (r() < .35) put(b, lit, M('icecliff'), s * (44 + r() * 20), -.5, z0 + r() * 20, r() * PI * 2, .7 + r() * .5);
      for (let i = 0; i < 2; i++) { const x = 9 + r() * 22, z = z0 + r() * 20; if (r() < .45 && clear(list, s, x, z, 1.4)) put(b, lit, M(r() < .6 ? 'rock' : 'rock2'), s * x, -.15, z, r() * PI * 2, .6 + r() * .7); }
    });
    // a lamp every 30 yards, on alternate sides
    for (let z = Math.ceil(z0 / 30) * 30; z < z1; z += 30) { const s = (z / 30) % 2 ? 1 : -1; put(b, lit, M('lightpole'), s * 7.7, 0, z, toRoad(s) + PI); }
  },
  beach(b, lit, z0, z1, list, M, r) {
    // boats on the sea, the odd sail far out
    if (r() < .5) put(b, lit, M('boat'), -(24 + r() * 26), -.35, z0 + r() * 20, r() * PI * 2);
    if (r() < .3) put(b, lit, M('sailboat'), -(45 + r() * 40), -.6, z0 + r() * 20, r() * PI * 2, 1 + r() * .5);
    [-1, 1].forEach(s => {
      for (let i = 0; i < 2; i++) {
        const x = s < 0 ? 7.2 + r() * 7 : 8 + r() * 14, z = z0 + r() * 20;
        if (!clear(list, s, x, z, 1.6)) continue;
        const u = r();
        if (u < .18) put(b, lit, M('castle'), s * x, 0, z, r() * PI * 2);
        else if (u < .3) { put(b, lit, M('bucket'), s * x, 0, z, r() * PI); put(b, lit, M(r() < .5 ? 'ball1' : 'ball2'), s * (x + .8), 0, z + .5, r() * PI); }
        else if (u < .4) put(b, lit, M('lifesaver'), s * x, 0, z, r() * PI);
        else if (u < .55) put(b, lit, M('bush'), s * x, 0, z, r() * PI * 2, .8 + r() * .5);
        else if (u < .68) put(b, lit, M('plant'), s * x, 0, z, r() * PI * 2, 1 + r() * .6);
        else if (u < .76) put(b, lit, M('rock'), s * x, -.2, z, r() * PI * 2, .7 + r() * .6);
        else if (u < .84 && s > 0 && x > 14) put(b, lit, M('tent'), s * x, 0, z, toRoad(s));
        else if (u < .9) put(b, lit, M('barrel'), s * x, 0, z, r() * PI * 2);
      }
    });
    // a pirate's treasure, now and then: the chest open to the road, gold spilled, the skull and his sword
    if (r() < .18) {
      const s = r() < .5 ? -1 : 1, x = 9 + r() * 3, z = z0 + 4 + r() * 12;
      if (clear(list, s, x, z, 2.2)) {
        put(b, lit, M('chest'), s * x, 0, z, toRoad(s));
        for (let i = 0; i < 6; i++) put(b, lit, M('coin'), s * (x - .9 - r() * .7), .02 + i * .004, z - .6 + r() * 1.2, r() * PI);
        put(b, lit, M('skull'), s * (x + .2), 0, z + 1.2, toRoad(s) + .4);
        put(b, lit, M('sword'), s * (x + .5), -.25, z - 1.1, r() * PI);
      }
    }
  },
  space(b, lit, z0, z1, list, M, r) {
    [-1, 1].forEach(s => {
      // the towers out on the horizon, the city's buildings behind the domes
      if (r() < .4) put(b, lit, M(r() < .5 ? 'tower1' : 'tower2'), s * (34 + r() * 22), 0, z0 + r() * 20, r() * PI * 2, .8 + r() * .4);
      if (r() < .45) { const x = 20 + r() * 8, z = z0 + r() * 20; if (clear(list, s, x, z, 4)) put(b, lit, M(pick(r, ['building1', 'building2', 'hospital', 'planetarium', 'monument', 'billboard'])), s * x, 0, z, toRoad(s)); }
      for (let i = 0; i < 2; i++) {
        const x = 8 + r() * 14, z = z0 + r() * 20;
        if (r() < .55 && clear(list, s, x, z, 1.8)) put(b, lit, M(pick(r, ['tree1', 'tree2', 'tree3', 'tree4', 'mushroom1', 'mushroom2', 'plant', 'battery', 'barrel1', 'barrel2'])), s * x, 0, z, r() * PI * 2, .8 + r() * .4);
      }
      // ships riding at anchor over the roadside
      if (r() < .22) put(b, lit, M(pick(r, ['ship1', 'ship2', 'ship3', 'ship4', 'ship6', 'ship7'])), s * (12 + r() * 20), 8 + r() * 9, z0 + r() * 20, PI + (r() - .5) * 1.2);
    });
  },
  farm(b, lit, z0, z1, list, M, r) {
    [-1, 1].forEach(s => {
      // a tree line past the corn, the odd windmill pumping out in the fields
      for (let i = 0; i < 2; i++) put(b, lit, M(pick(r, ['tree1', 'tree2', 'tree3', 'tree3'])), s * (43 + r() * 10), 0, z0 + i * 10 + r() * 8, r() * PI * 2, .8 + r() * .5);
      if (r() < .35) put(b, lit, M(pick(r, ['bush1', 'bush2'])), s * (41 + r() * 4), 0, z0 + r() * 20, r() * PI * 2);
      if (r() < .12) put(b, lit, M('windmill'), s * (48 + r() * 8), 0, z0 + r() * 20, r() * PI * 2);
    });
    // by each barn: a well, a wagon or a stack of hay
    list.forEach(o => {
      if (o.k !== 'barn' || o.z0 < z0 || o.z0 >= z1) return;
      const rr = rnd('barnyard', o.s, o.z0.toFixed(2)), u = rr(), x = o.s * (o.x + 9.5), z = o.z1 + 1.2;
      if (u < .35) put(b, lit, M('well'), x, 0, z, rr() * PI * 2);
      else if (u < .7) put(b, lit, M('wagon'), x, 0, z + .4, toRoad(o.s) + PI / 2);
      else [0, 1, 2].forEach(k => put(b, lit, M('hay'), x + o.s * k * 1.7, 0, z + (k % 2) * .6, rr() * PI));
      if (rr() < .5) put(b, lit, M(rr() < .5 ? 'stump' : 'log'), o.s * (o.x + 1), 0, o.z0 - 1.8, rr() * PI * 2);
    });
  },
  city(b, lit, z0, z1, list, M, r) {
    [-1, 1].forEach(s => {
      // the sidewalk: benches to the road, bins, planters (clear of the lamps, palms and hydrants)
      for (let z = z0 + 2 + r() * 4; z < z1 - 1; z += 5 + r() * 6) {
        if (!clear(list.filter(o => o.k !== 'bldg'), s, 8.9, z, 1.3)) continue;
        const u = r();
        if (u < .4) { put(b, lit, M('bench'), s * 9.05, 0, z, toRoad(s)); if (r() < .5) put(b, lit, M(r() < .5 ? 'trash1' : 'trash2'), s * 9.1, 0, z + 1.6, toRoad(s)); }
        else if (u < .6) put(b, lit, M(r() < .5 ? 'trash1' : 'trash2'), s * 9.1, 0, z, toRoad(s));
        else if (u < .8) { put(b, lit, M('bush'), s * 9.1, 0, z, r() * PI * 2); put(b, lit, M('flowers'), s * 9.1, 0, z + .9, r() * PI); }
      }
    });
    // a pocket park in the gaps between the buildings
    const bl = list.filter(o => o.k === 'bldg').sort((a, c) => a.s - c.s || a.z0 - c.z0);
    for (let i = 1; i < bl.length; i++) {
      const a = bl[i - 1], c = bl[i];
      if (a.s !== c.s || c.z0 - a.z1 < 3.2) continue;
      const z = (a.z1 + c.z0) / 2, gap = c.z0 - a.z1;
      if (z < z0 || z >= z1) continue;
      const rr = rnd('park', a.s, z.toFixed(2)), x = a.s * 13.5;
      put(b, lit, M(gap > 5.5 ? pick(rr, ['playset', 'gazebo', 'swings', 'dome']) : pick(rr, ['tree', 'tree2'])), x, 0, z, toRoad(a.s), gap > 5.5 ? clamp(gap / 6, .7, 1) : 1);
      put(b, lit, M('tree'), a.s * 17.5, 0, z, rr() * PI * 2);
    }
  },
  market(b, lit, z0, z1, list, M, r) {
    [-1, 1].forEach(s => {
      // in front of the houses: crates and barrels, a potted plant
      for (let z = z0 + 1 + r() * 3; z < z1 - 1; z += 3 + r() * 4) {
        const u = r(), x = 10.45;
        if (u < .25) { put(b, lit, M('crate'), s * x, 0, z, toRoad(s) + (r() - .5) * .3); if (r() < .5) put(b, lit, M('crate'), s * x, .95, z + (r() - .5) * .2, toRoad(s) + (r() - .5) * .4); }
        else if (u < .45) { put(b, lit, M('barrel'), s * x, 0, z, r() * PI); if (r() < .5) put(b, lit, M('barrel'), s * x, 0, z + 1.1, r() * PI); }
        else if (u < .6) put(b, lit, M('plant'), s * x, 0, z, r() * PI * 2);
      }
      // the trees behind the houses, over their roofs
      if (r() < .7) put(b, lit, M('tree'), s * (22 + r() * 5), 0, z0 + r() * 20, r() * PI * 2, 1.25 + r() * .35);
    });
  },
  tailgate(b, lit, z0, z1, list, M, r) {
    // under the tents: tables and chairs; out past them, a tree line
    list.forEach(o => {
      if (o.k !== 'tent') return;
      const z = (o.z0 + o.z1) / 2;
      if (z < z0 || z >= z1) return;
      const rr = rnd('tent', o.s, o.z0.toFixed(2)), x = o.s * (o.x + 1.7);
      if (rr() < .5) put(b, lit, M('picnic'), x, 0, z, rr() * PI);
      else { put(b, lit, M('table'), x, 0, z, toRoad(o.s)); put(b, lit, M(rr() < .5 ? 'chair' : 'chair2'), x - o.s * 1, 0, z - .5, toRoad(o.s) + PI); put(b, lit, M(rr() < .5 ? 'chair' : 'chair2'), x - o.s * 1, 0, z + .6, toRoad(o.s) + PI); }
    });
    [-1, 1].forEach(s => {
      for (let i = 0; i < 2; i++) put(b, lit, M(pick(r, ['tree1', 'tree2', 'tree3'])), s * (21 + r() * 12), 0, z0 + i * 10 + r() * 8, r() * PI * 2, .8 + r() * .4);
      if (r() < .4) put(b, lit, M('bush'), s * (19 + r() * 3), 0, z0 + r() * 20, r() * PI * 2);
      if (r() < .3) put(b, lit, M('trash'), s * 12, 0, z0 + r() * 20, toRoad(s));
    });
  }
};

// ============================================================================ In the lanes
/** A lane thing (V: its box, p: its part, return-3dworld.js vehicleOf) from its place's models, in its own box; false:
 *  the world's own shapes. */
export function vehicle(b, lit, V, p, id) {
  if (!ready(id)) return false;
  const f = LANE[p.kind];
  return f ? f(b, lit, V, p, name => get(id, name)) !== false : false;
}
/** Model m stretched into the box x0..x1, y0..y1, z0..z1 (its own x across, z along the road). */
function fit(b, lit, m, x0, x1, y0, y1, z0, z1, ry = 0) {
  if (!m) return false;
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), turned = Math.abs(Math.sin(ry)) > .5;
  const sx = (turned ? d : w) / m.size[0], sz = (turned ? w : d) / m.size[2];
  return put(b, lit, m, (x0 + x1) / 2, y0, (z0 + z1) / 2, ry, sx, (y1 - y0) / m.size[1], sz);
}
const LANE = {
  // the desert's mine carts, ore heaped in them
  minecart(b, lit, V, p, M) {
    const {x0, x1, y1, z0, z1, X} = V;
    if (!fit(b, lit, M('trolley'), x0 + .1, x1 - .1, 0, y1, z0, z1)) return false;
    for (let k = 0; k < 6; k++) b.add('rock', '#8A8F98', X - .45 + (k % 3) * .45, y1 - .05, z0 + .7 + Math.floor(k / 3) * 1.1, .32, .28, .32, k, k, 0);
  },
  // the market's crates: stacked in rows up to the top
  marketramp(b, lit, V, p, M) { return crates(b, lit, V, M, 2); },
  awning(b, lit, V, p, M) {
    if (p.part !== 0) return false;
    if (!crates(b, lit, V, M, 1)) return false;
    const {y1, z0, X} = V;
    for (let k = 0; k < 8; k++) b.add('ball', ['#F28C28', '#D63B2E', '#4FA845', '#F2C94C'][k % 4], X - .8 + (k % 4) * .5, y1 + .12, z0 + .8 + Math.floor(k / 4) * 1.6, .17, .17, .17);
  },
  // the lifeguard's deck: its posts and boards, his chair up on the end of it
  lifeguard(b, lit, V, p, M) {
    const {x0, x1, y1, z0, z1, X} = V, chair = M('lifeguard');
    if (!chair) return false;
    b.box('#D9A866', x0, x1, y1 - .2, y1, z0, z1);
    for (let z = z0 + .2; z < z1 - .1; z += .6) b.box('#C9915A', x0 + .02, x1 - .02, y1 - .005, y1 + .005, z, z + .08);
    [z0 + .2, z1 - .2].forEach(z => [x0 + .15, x1 - .15].forEach(x => b.box('#C9915A', x - .1, x + .1, 0, y1 - .2, z - .1, z + .1)));
    put(b, lit, chair, X, y1, z1 - 1, 0, .8);
  },
  // the farm's fence: two lengths of rail fence across the lane
  fence(b, lit, V, p, M) {
    const {x0, x1, y1, z0, z1, X} = V, m = M('fence');
    if (!m) return false;
    fit(b, lit, m, x0, X, 0, y1, z0, z1); fit(b, lit, m, X, x1, 0, y1, z0, z1);
  },
  // space's hover cars, nose to tail
  rover(b, lit, V, p, M) {
    const {x0, x1, y1, z0, z1} = V, n = z1 - z0 > 4.3 ? 2 : 1, d = (z1 - z0) / n;
    for (let i = 0; i < n; i++) if (!fit(b, lit, M(i % 2 ? 'car2' : 'car1'), x0 + .05, x1 - .05, 0, y1, z0 + i * d + .05, z0 + (i + 1) * d - .05)) return false;
  }
};
/** Crates in rows (across one, up `rows`, along as many as fit), to the box's top. */
function crates(b, lit, V, M, rows) {
  const {x0, x1, y1, z0, z1} = V, m = M('crate');
  if (!m) return false;
  const n = Math.max(1, Math.round((z1 - z0) / 1.3)), d = (z1 - z0) / n, h = y1 / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) fit(b, lit, m, x0, x1, j * h, (j + 1) * h, z0 + i * d, z0 + (i + 1) * d, (i + j) % 2 ? PI : 0);
  return true;
}
