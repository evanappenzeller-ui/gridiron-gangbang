// The Keep's residents and named champions. Small, merged low-poly models,
// shared home/battle poses, and home routes built only when the layout changes.
import * as data from '../core/data.js';
import {KINDS, N, keepOf, heroLevel} from '../core/realm.js';
import {attachKnightModel} from './realm-knight-model.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const W = x => x - N / 2;

/** Occupancy-aware cardinal paths: villagers never clip a building or cross a wall. */
export function npcPaths(buildings) {
  const blocked = new Uint8Array(N * N);
  for (const b of buildings) {
    const size = KINDS[b.t]?.size || 1;
    for (let y = Math.max(0, b.y); y < Math.min(N, b.y + size); y++)
      for (let x = Math.max(0, b.x); x < Math.min(N, b.x + size); x++) blocked[y * N + x] = 1;
  }
  const open = (x, y) => x >= 1 && y >= 1 && x < N - 1 && y < N - 1 && !blocked[y * N + x];
  function nearest(x, y, excluded = new Set()) {
    let best = null, distance = Infinity;
    for (let yy = 1; yy < N - 1; yy++) for (let xx = 1; xx < N - 1; xx++) {
      if (!open(xx, yy) || excluded.has(yy * N + xx)) continue;
      const d = (xx + .5 - x) ** 2 + (yy + .5 - y) ** 2;
      if (d < distance) { distance = d; best = {x: xx + .5, y: yy + .5}; }
    }
    return best;
  }
  function route(start, end) {
    if (!start || !end) return [];
    const first = Math.floor(start.y) * N + Math.floor(start.x), last = Math.floor(end.y) * N + Math.floor(end.x);
    const from = new Int32Array(N * N).fill(-1), queue = [first]; from[first] = first;
    for (let at = 0; at < queue.length && from[last] < 0; at++) {
      const id = queue[at], x = id % N, y = (id / N) | 0;
      for (const [xx, yy] of [[x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]]) {
        const next = yy * N + xx;
        if (!open(xx, yy) || from[next] >= 0) continue;
        from[next] = id; queue.push(next);
      }
    }
    // A closed wall may separate two posts. Patrol inside this guard's reachable
    // courtyard instead of walking through it or freezing at an unreachable goal.
    let goal = last;
    if (from[last] < 0) {
      let best = Infinity;
      for (const id of queue) {
        const d = Math.abs(id % N + .5 - end.x) + Math.abs(((id / N) | 0) + .5 - end.y);
        if (id !== first && d < best) { best = d; goal = id; }
      }
      if (goal === last) return [start];
    }
    const out = [];
    for (let id = goal; ; id = from[id]) {
      out.push({x: id % N + .5, y: ((id / N) | 0) + .5});
      if (id === first) break;
    }
    return out.reverse();
  }
  return {blocked, nearest, route};
}

// One vertex-colored mesh for each rigid body/limb, instead of a draw call per armor plate.
function sculpt(T, pieces, material) {
  const positions = [], normals = [], colors = [], transform = new T.Object3D();
  for (const [source, color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]] of pieces) {
    let g = source.index ? source.toNonIndexed() : source;
    transform.position.set(...position); transform.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0); transform.scale.set(...scale); transform.updateMatrix();
    g.applyMatrix4(transform.matrix);
    positions.push(...g.attributes.position.array); normals.push(...g.attributes.normal.array);
    const c = new T.Color(color);
    for (let i = 0; i < g.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
    g.dispose(); if (g !== source) source.dispose();
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeBoundingSphere();
  const mesh = new T.Mesh(g, material); mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** A hero is visibly larger than a soldier, with a named level badge and colored base. */
export function createNPC(T, kind, {level = 1, house = {}, defending = false, onChange} = {}) {
  if (!data.isOwner()) return null;
  const hero = kind === 'knight' || kind === 'wizard', wizard = kind === 'wizard', keeper = kind === 'keeper';
  const root = new T.Group(), rig = new T.Group(); root.add(rig);
  root.name = 'keep-npc-' + kind;
  root.userData.npc = kind; root.userData.level = level;
  const mat = new T.MeshStandardMaterial({vertexColors: true, roughness: .67, metalness: .12, flatShading: true});
  const box = (x, y, z) => new T.BoxGeometry(x, y, z);
  const cyl = (a, b, h, n = 8) => new T.CylinderGeometry(a, b, h, n);
  const orb = r => new T.IcosahedronGeometry(r, 0);
  const skin = 0xDFA977, iron = 0xAABAC4, dark = 0x354350, gold = 0xF5CD67;
  const cloth = wizard ? 0x6E3C98 : keeper ? 0x397E73 : hero ? 0x9E293F : (house.pri || 0x7A2634);
  const body = [
    [wizard || keeper ? cyl(.15, .26, .58) : box(hero ? .42 : .32, .39, .25), wizard || keeper ? cloth : iron, [0, .59, 0]],
    [orb(.145), skin, [0, .97, .025], [], [1, 1.12, 1]],
    [box(.31, .055, .27), gold, [0, .47, 0]],
    [box(.085, .23, .085), skin, [-.24, .65, .015]]
  ];
  if (wizard) {
    body.push([cyl(.04, .265, .55), cloth, [-.025, 1.28, 0], [0, 0, -.15]],
      [cyl(.31, .31, .045), 0xD6AA55, [0, 1.05, 0]],
      [cyl(.105, .015, .3), 0xF5E9CC, [0, .82, .16]],
      [box(.05, .2, .025), gold, [0, .61, .18]],
      [orb(.065), 0x89E2FA, [-.035, 1.35, .19]]);
  } else if (keeper) {
    body.push([box(.28, .38, .055), 0x9D6138, [0, .58, .17]],
      [cyl(.16, .19, .1), 0x9D6138, [0, 1.075, 0]],
      [box(.19, .06, .08), gold, [0, 1.06, .135]],
      [box(.11, .2, .18), 0xC68C45, [-.2, .55, .16]]);
  } else {
    body.push([orb(.178), iron, [0, 1.015, -.005], [], [1, .9, 1]],
      [box(.23, .045, .055), dark, [0, 1, .155]],
      [box(.07, .16, .04), gold, [0, .96, .18]],
      [box(hero ? .48 : .35, .1, .3), hero ? gold : dark, [0, .8, 0]],
      [box(.2, .27, .028), cloth, [0, .61, .145]]);
    if (hero) body.push([box(.4, .65, .055), cloth, [0, .55, -.19], [-.17, 0, 0]],
      [cyl(.06, .085, .27), 0xD55D5E, [0, 1.24, -.07], [-.4, 0, 0]],
      [box(.04, .13, .035), gold, [0, .64, .18]], [box(.13, .035, .035), gold, [0, .66, .18]]);
  }
  const torso = sculpt(T, body, mat); rig.add(torso);
  const legs = [-1, 1].map(side => {
    const leg = sculpt(T, [[box(.11, .24, .13), wizard || keeper ? 0x594236 : dark, [0, -.12, 0]],
      [box(.13, .09, .21), dark, [0, -.23, .035]]], mat);
    leg.position.set(side * .1, .3, 0); rig.add(leg); return leg;
  });
  const arm = new T.Group(); arm.position.set(.25, .75, .01); rig.add(arm);
  const weapon = [[box(.09, .25, .09), wizard || keeper ? cloth : iron, [0, -.11, 0]], [orb(.055), skin, [0, -.24, .025]]];
  if (wizard) weapon.push([cyl(.025, .035, 1.1), 0x8D623C, [.04, -.18, .07]],
    [new T.OctahedronGeometry(.13), 0x77DDF9, [.04, .44, .07]], [cyl(.09, .04, .1), gold, [.04, .33, .07]]);
  else if (keeper) weapon.push([orb(.16), 0x92C18A, [.03, -.12, .17], [], [.8, 1.25, .8]],
    [box(.23, .055, .21), 0xB9884D, [.03, -.3, .15]]);
  else if (hero) weapon.push([box(.065, .62, .035), 0xE7F2F4, [.02, .07, .08]],
    [box(.24, .045, .07), gold, [.02, -.23, .08]], [box(.055, .16, .06), 0x61432A, [.02, -.31, .08]]);
  else weapon.push([cyl(.021, .021, 1.35, 5), 0x825735, [.05, -.05, .06]],
    [cyl(0, .07, .22, 4), iron, [.05, .72, .06]]);
  arm.add(sculpt(T, weapon, mat));
  if (!wizard && !keeper) rig.add(sculpt(T, [[cyl(.19, .13, .065, 5), hero ? gold : dark, [-.29, .57, .13], [Math.PI / 2, 0, 0]],
    [cyl(.15, .10, .075, 5), cloth, [-.29, .57, .17], [Math.PI / 2, 0, 0]],
    [box(.035, .2, .025), gold, [-.29, .57, .22]], [box(.14, .035, .025), gold, [-.29, .6, .22]]], mat));
  const accent = wizard ? 0x9DCFFF : keeper ? 0x88C999 : defending ? 0x88D6AD : gold;
  const ring = new T.Mesh(hero ? new T.RingGeometry(.3, .38, 24) : new T.CircleGeometry(.25, 16),
    new T.MeshBasicMaterial({color: hero ? accent : 0x16251B, transparent: true, opacity: hero ? .72 : .22, depthWrite: false}));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .025; root.add(ring);
  if (hero) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = wizard ? '#302040' : '#352524'; ctx.fillRect(0, 4, 256, 52);
    ctx.strokeStyle = wizard ? '#9DCFFF' : '#F5CD67'; ctx.lineWidth = 3; ctx.strokeRect(2, 6, 252, 48);
    ctx.fillStyle = '#FFF3D8'; ctx.font = '700 27px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${wizard ? 'WIZARD' : 'KNIGHT'}  ${level}`, 128, 31);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const badge = new T.Sprite(new T.SpriteMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false}));
    badge.position.y = wizard ? 1.85 : 1.65; badge.scale.set(1.55, .39, 1); root.add(badge);
  }
  root.scale.setScalar(hero ? 1.2 : 1);
  const knightModel = kind === 'knight' ? attachKnightModel(T, rig, {onChange}) : null;
  let disposed = false;
  return {root, kind, level,
    pose(seconds, {moving = false, face = .6, attack = 0, hit = 0, still = false} = {}) {
      if (disposed) return;
      const walk = moving && !still ? Math.sin(seconds * 10) : 0;
      root.rotation.y = -face + Math.PI / 2;
      rig.position.y = Math.abs(walk) * .035;
      rig.rotation.x = hit * .2;
      legs[0].rotation.x = walk * .5; legs[1].rotation.x = -walk * .5;
      arm.rotation.x = still ? 0 : (wizard ? .9 * attack : hero ? 1.5 * attack : keeper ? Math.sin(seconds * 1.8) * .08 : walk * .08);
      arm.rotation.z = keeper && !still ? Math.sin(seconds * 1.8) * .06 : 0;
      knightModel?.pose(seconds, {moving, attack, still});
    },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      knightModel?.dispose();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) { materials.add(o.material); if (o.material.map) textures.add(o.material.map); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      root.clear();
    }
  };
}

export function createHomeNPCs(T, scene, {onChange} = {}) {
  const group = new T.Group(); group.name = 'keep-residents'; scene.add(group);
  let actors = [], signature = '', disposed = false;
  const counts = {guards: 0, heroes: 0, keeper: false, active: false};
  function clear() {
    actors.forEach(a => a.model.dispose()); actors = []; signature = '';
    Object.assign(counts, {guards: 0, heroes: 0, keeper: false, active: false}); group.visible = false;
  }
  const unsubscribe = data.subscribe(type => { if (type === 'me' && !data.isOwner()) clear(); });
  function setLot(s, {house} = {}) {
    if (disposed || !data.isOwner()) { clear(); return; }
    const next = JSON.stringify([s.b.map(b => [b.i, b.t, b.l, b.x, b.y]), s.hr, house]);
    if (signature === next) return;
    clear(); signature = next;
    const keep = s.b.find(b => b.t === 'keep' && b.l > 0); if (!keep) return;
    const paths = npcPaths(s.b), taken = new Set();
    const doorstep = (b, offset = 0) => paths.nearest(b.x + KINDS[b.t].size / 2 + offset, b.y + KINDS[b.t].size + .7, taken);
    function add(kind, at, options = {}) {
      if (!at) return;
      const model = createNPC(T, kind, {house, level: options.level, onChange}); if (!model) return;
      group.add(model.root); model.root.position.set(W(at.x), 0, W(at.y));
      taken.add(Math.floor(at.y) * N + Math.floor(at.x));
      actors.push({model, at, route: options.route || [], offset: actors.length * 5.1});
    }
    for (const [index, key] of ['knight', 'wizard'].entries()) {
      const level = heroLevel(s, key);
      if (level > 0) { add(key, doorstep(keep, index ? 1.5 : -1.5), {level}); counts.heroes++; }
    }
    if (keepOf(s) >= KINDS.hatchery.th[0]) {
      const hatchery = s.b.find(b => b.t === 'hatchery' && b.l > 0);
      add('keeper', doorstep(hatchery || keep, hatchery ? .8 : 2.5)); counts.keeper = true;
    }
    const posts = [keep, ...s.b.filter(b => b.t !== 'keep' && b.t !== 'wall')];
    const guardCount = Math.min(4, 2 + Math.floor((keepOf(s) - 1) / 3));
    for (let i = 0; i < guardCount; i++) {
      const start = doorstep(posts[i % posts.length], i % 2 ? -1 : 1);
      const end = doorstep(posts[(i + 1) % posts.length], i % 2 ? 1 : -1);
      add('guard', start, {route: paths.route(start, end)}); counts.guards++;
    }
    group.visible = true;
  }
  function update(seconds, {zoom = 40, active = true, placement = false} = {}) {
    if (disposed || !data.isOwner()) { clear(); return false; }
    counts.active = !!active && zoom < 125 && !placement;
    group.visible = counts.active;
    if (!counts.active) return false;
    const still = reduced();
    for (const a of actors) {
      let x = a.at.x, y = a.at.y, face = .7, moving = false;
      const route = a.route, steps = route.length - 1;
      if (!still && steps > 0) {
        const travel = steps / .7, cycle = 2 * travel + 6, clock = (seconds + a.offset) % cycle;
        const back = clock >= travel + 3;
        const leg = back ? clock - travel - 3 : clock;
        const distance = Math.min(steps, leg * .7);
        const d = back ? steps - distance : distance;
        const idx = Math.min(steps - 1, Math.floor(d)), blend = d - idx, p = route[idx], q = route[idx + 1];
        x = p.x + (q.x - p.x) * blend; y = p.y + (q.y - p.y) * blend;
        face = Math.atan2((q.y - p.y) * (back ? -1 : 1), (q.x - p.x) * (back ? -1 : 1));
        moving = leg < travel;
      }
      a.model.root.position.set(W(x), 0, W(y));
      a.model.pose(seconds + a.offset, {moving, face, still});
    }
    // The parent schedules a modest 6 fps resident tick; this never requests a full-rate loop.
    return !still && actors.length > 0;
  }
  return {counts, group, setLot, update, get animated() { return counts.active && !reduced() && actors.length > 0; },
    dispose() { if (disposed) return; disposed = true; unsubscribe(); clear(); group.removeFromParent(); }
  };
}

/** Battle models remain separate from the ordinary, instanced army. At most two heroes per side. */
export function createBattleHeroes(T, scene, {house, onChange} = {}) {
  const models = new Map(); let disposed = false;
  const unsubscribe = data.subscribe(type => { if (type === 'me' && !data.isOwner()) clear(); });
  function clear() { models.forEach(m => m.dispose()); models.clear(); }
  return {
    update(units, seconds, positions, previous, blend) {
      if (disposed || !data.isOwner()) { clear(); return; }
      const seen = new Set(), still = reduced();
      for (const u of units) {
        if (!u.hero || u.dead) continue;
        const defending = !!u.targetHero, key = `${defending ? 'd' : 'a'}:${u.id}`; seen.add(key);
        let model = models.get(key);
        if (!model) { model = createNPC(T, u.hero, {level: u.level || u.l || 1, house, defending, onChange}); if (!model) continue; models.set(key, model); scene.add(model.root); }
        const c = positions.get(key) || u, p = previous.get(key) || c;
        const x = p.x + (c.x - p.x) * blend, y = p.y + (c.y - p.y) * blend;
        const moving = Math.hypot(c.x - p.x, c.y - p.y) > .001;
        const sinceAttack = seconds - (u.hitAt ?? -9);
        const attack = !moving && sinceAttack < .45 ? Math.sin(Math.max(0, sinceAttack) / .45 * Math.PI) : 0;
        model.root.position.set(W(x), 0, W(y)); model.pose(seconds, {moving, face: u.face, attack, still});
      }
      models.forEach((m, key) => { if (!seen.has(key)) { m.dispose(); models.delete(key); } });
    },
    dispose() { if (disposed) return; disposed = true; unsubscribe(); clear(); }
  };
}
