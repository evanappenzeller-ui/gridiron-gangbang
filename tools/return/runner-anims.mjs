// Return Man's moves from the owner's "Endless Runner Animations" (Nov 1 2026, Evan: "use the attached for the return
// man game": Mixamo clips on its X Bot, as Blender wrote them; the pack's fbx folder) put into his player
// (models/return-player.glb) as its clips, in place of the ones there (views/return-3d.js: idle, run, and MOVES).
// Retargeted as tools/return/mixamo-clip.mjs does (each bone's turn in the world from its rest, put on his rest turned
// to point the way the clip's rig's bone does; the hips' movement scaled to his height), read by tools/return/fbx-anim.mjs
// and written by tools/return/glb.mjs: nothing to install. Each clip (PLAN) is one of the pack's or a run of them:
//  - a cycle (idle, run) is sampled round from where the old run started its cycle (his left foot's furthest forward
//    where the old one had it: the game's phase and the moves keyed from the run still line up), its creep taken out
//    (he runs on the spot: the ground moves under him). The run's stride is printed (views/return-3d.js STRIDE);
//  - a move (the game plays it by how far into it he is, 0 to 1: its clip's a second long) is its parts, each a stretch
//    of a clip (from, to: of its length) given its share of the move (span); a part that loops (slide_mid) goes round
//    as often as fits. In the air (the jump), his height's the game's: the clip's own rise taken out, so his lowest foot
//    stays at his feet's height there;
//  - a layer (named with a +: run_left, run_right, take_damage, each one turn of the pack's run with a lean or a flinch
//    in it, the same at both ends) is what it does over the run at each moment (each bone's turn from the run's, the
//    hips' shift), from his hips up: the game lays it over his run wherever his stride is (three's additive blending),
//    so his legs go on as they were.
//   node tools/return/runner-anims.mjs "<pack>/fbx" models/return-player.glb [names...]
import * as T from '../../js/vendor/three/three.module.min.js';
import {clip} from './fbx-anim.mjs';
import * as glb from './glb.mjs';
const [,, PACK, GLB, ...ONLY] = process.argv;
const FPS = 60;
const PLAN = {
  idle: {cycle: '01. idle'},
  run: {cycle: '06. run'},
  // off the ground (from the push-off), up, tucked at the top, and reaching for the ground (till it's there)
  jump: {air: true, parts: [{clip: '10. jump_start', from: .3, to: 1, span: .42}, {clip: '11. jump_mid', span: .3}, {clip: '12. jump_end', from: 0, to: .42, span: .28}]},
  // down into it feet first, along the ground on his side, and up out of it into his stride (straight: lying down,
  // turned that much of the way to lie along his lane, about his hips: the pack's lies across it, aslant)
  slide: {straight: .85, parts: [{clip: '13. slide_start', from: .1, to: 1, span: .3}, {clip: '14. slide_mid', span: .4, loop: true}, {clip: '15. slide_end', from: 0, to: .75, span: .3}]},
  // leaning into a side-step, his left and his right; knocked off his stride by a hit (he runs on through it)
  'sideL+': {layer: '07. run_left', over: '06. run'},
  'sideR+': {layer: '08. run_right', over: '06. run'},
  'hit+': {layer: '09. take_damage', over: '06. run'}
};
const bare = n => n.replace(/^mixamorig:?/, '');
const rotOf = m => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(m));

/** A rig: {bone: {parent, q, t, s}} and the world over its hips (top): each bone's rest in the world (wq, wp). */
function rig(bones, top) {
  const out = {bones, top, wq: {}, wp: {}, order: []};
  const walk = (k, m) => {
    out.order.push(k);
    const w = m.clone().multiply(new T.Matrix4().compose(bones[k].t, bones[k].q, bones[k].s || new T.Vector3(1, 1, 1)));
    out.wq[k] = rotOf(w); out.wp[k] = new T.Vector3().setFromMatrixPosition(w);
    Object.keys(bones).filter(c => bones[c].parent === k).forEach(c => walk(c, w));
  };
  walk('Hips', top);
  return out;
}
// the player's rig, from the model
const g = glb.read(GLB), J = g.json, parentOf = new Map();
J.nodes.forEach((n, i) => (n.children || []).forEach(c => parentOf.set(c, i)));
const local = n => (n.matrix ? new T.Matrix4().fromArray(n.matrix) : new T.Matrix4().compose(new T.Vector3(...(n.translation || [0, 0, 0])), new T.Quaternion(...(n.rotation || [0, 0, 0, 1])), new T.Vector3(...(n.scale || [1, 1, 1]))));
const worldOf = i => { const m = new T.Matrix4(); for (let x = i; x != null; x = parentOf.get(x)) m.premultiply(local(J.nodes[x])); return m; };
const node = {}, tb = {};
J.nodes.forEach((n, i) => { if (/^mixamorig:/.test(n.name || '')) node[bare(n.name)] = i; });
Object.entries(node).forEach(([k, i]) => {
  const n = J.nodes[i], p = parentOf.get(i);
  tb[k] = {parent: p != null && /^mixamorig:/.test(J.nodes[p].name || '') ? bare(J.nodes[p].name) : null,
    q: new T.Quaternion(...(n.rotation || [0, 0, 0, 1])), t: new T.Vector3(...(n.translation || [0, 0, 0])), s: new T.Vector3(...(n.scale || [1, 1, 1]))};
});
const top = worldOf(parentOf.get(node.Hips)), tgt = rig(tb, top), tgtTop = rotOf(top), topInv = top.clone().invert();
const TOES = ['LeftToeBase', 'RightToeBase', 'LeftToe_End', 'RightToe_End'].filter(k => tb[k]);
/** Where his bones are (the world) in a pose ({q: {bone: local turn}, hips: local place}). */
function fk(f) {
  const out = {}, walk = (k, m) => {
    const w = m.clone().multiply(new T.Matrix4().compose(k === 'Hips' ? new T.Vector3().fromArray(f.hips) : tb[k].t, f.q[k], tb[k].s));
    out[k] = new T.Vector3().setFromMatrixPosition(w);
    Object.keys(tb).filter(c => tb[c].parent === k).forEach(c => walk(c, w));
  };
  walk('Hips', top);
  return out;
}
const FLOOR = Math.min(...TOES.map(k => tgt.wp[k].y));

/** A clip of the pack's, ready to pose him: frame(u) -> his pose u of the way through it (its creep taken out if a
 *  cycle). */
const SRC = new Map();
function source(name, cycle) {
  const key = name + (cycle ? '@' : '');
  if (SRC.has(key)) return SRC.get(key);
  const c = clip(`${PACK}/${name}.fbx`), src = rig(c.bones, c.top);
  // each of his bones at rest, turned to point the way the clip's rig's does (from it to its one child both rigs have;
  // a bone with none, as its parent's turned; the hips as they are)
  const turn = {}, G = {};
  tgt.order.forEach(k => {
    const kids = Object.keys(tb).filter(x => tb[x].parent === k && src.bones[x]);
    const ch = kids.length === 1 ? kids[0] : kids.find(x => x === 'Neck');
    turn[k] = k === 'Hips' || !src.bones[k] ? new T.Quaternion() : ch
      ? new T.Quaternion().setFromUnitVectors(tgt.wp[ch].clone().sub(tgt.wp[k]).normalize(), src.wp[ch].clone().sub(src.wp[k]).normalize())
      : turn[tb[k].parent].clone();
    G[k] = turn[k].clone().multiply(tgt.wq[k]);
  });
  const height = (r, k) => r.wp[k].y - Math.min(...['LeftToeBase', 'RightToeBase'].map(x => r.wp[x].y));
  const scale = height(tgt, 'Hips') / height(src, 'Hips'), srcTop = rotOf(src.top);
  const hipsAt = u => c.hipsAt(u).applyMatrix4(src.top);
  const drift = cycle ? hipsAt(1).sub(hipsAt(0)).setY(0) : new T.Vector3();
  const frame = u => {
    const ws = {}, wt = {}, q = {};
    tgt.order.forEach(k => {
      const s = src.bones[k];
      if (s) ws[k] = (s.parent ? ws[s.parent] : srcTop).clone().multiply(c.at(k, u));
      wt[k] = s ? ws[k].clone().multiply(src.wq[k].clone().invert()).multiply(G[k]) : (tb[k].parent ? wt[tb[k].parent] : tgtTop).clone().multiply(tb[k].q);
      q[k] = (tb[k].parent ? wt[tb[k].parent] : tgtTop).clone().invert().multiply(wt[k]);
    });
    const hp = hipsAt(u).sub(drift.clone().multiplyScalar(u)).sub(src.wp.Hips).multiplyScalar(scale).add(tgt.wp.Hips).applyMatrix4(topInv);
    return {q, hips: hp.toArray()};
  };
  const out = {dur: c.dur, frame};
  SRC.set(key, out);
  return out;
}

// the old run: where its cycle has his left foot furthest forward (the new cycles start where it did)
function keysOf(name) {
  const a = (J.animations || []).find(x => x.name === name);
  if (!a) return null;
  const acc = i => { const A = J.accessors[i], v = J.bufferViews[A.bufferView], n = A.count * {SCALAR: 1, VEC3: 3, VEC4: 4}[A.type];
    return new Float32Array(g.bin.buffer.slice(g.bin.byteOffset + (v.byteOffset || 0) + (A.byteOffset || 0), g.bin.byteOffset + (v.byteOffset || 0) + (A.byteOffset || 0) + n * 4)); };
  const tracks = a.channels.map(ch => {
    const s = a.samplers[ch.sampler], k = bare(J.nodes[ch.target.node].name || '');
    const Tr = ch.target.path === 'rotation' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
    return {k, path: ch.target.path, it: new Tr('x', Array.from(acc(s.input)), Array.from(acc(s.output))).createInterpolant(), dur: J.accessors[s.input].max[0]};
  });
  const dur = Math.max(...tracks.map(t => t.dur));
  return u => {
    const f = {q: {}, hips: tb.Hips.t.toArray()};
    Object.keys(tb).forEach(k => { f.q[k] = tb[k].q.clone(); });
    tracks.forEach(t => { const v = t.it.evaluate(u * dur); if (t.path === 'rotation') f.q[t.k] = new T.Quaternion().fromArray(v); else if (t.path === 'translation' && t.k === 'Hips') f.hips = Array.from(v); });
    return f;
  };
}
const LEGS = new Set(Object.keys(tb).filter(k => { for (let x = k; x; x = tb[x].parent) if (/UpLeg$/.test(x)) return true; return false; }));
/** Metres a cycle covers: how fast his lower foot goes back under him while it's down (frames: once round). */
function travel(frames) {
  const feet = frames.map(f => { const p = fk(f); return [p.LeftToeBase, p.RightToeBase]; }), n = frames.length - 1;
  const floor = Math.min(...feet.flat().map(p => p.y)), up = .04 * (tgt.wp.Head.y - floor);
  let back = 0, down = 0;
  for (let i = 1; i <= n; i++) [0, 1].forEach(s => { if (feet[i][s].y < floor + up && feet[i - 1][s].y < floor + up) { back += feet[i - 1][s].z - feet[i][s].z; down += 1; } });
  return down ? back / down * n : 0;
}
const forward = f => { const p = fk(f); return p.LeftFoot.z - p.Hips.z; };
const peak = fr => { let best = 0, at = 0; for (let i = 0; i < 240; i++) { const v = forward(fr(i / 240)); if (v > best) { best = v; at = i / 240; } } return at; };
const oldRun = keysOf('run'), RUN_AT = oldRun ? peak(oldRun) : 0;

// the clips
const clips = {};
for (const [name, p] of Object.entries(PLAN)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  let times, frames;
  if (p.cycle) {
    const s = source(p.cycle, true), n = Math.round(s.dur * FPS), shift = name === 'idle' ? 0 : peak(s.frame) - RUN_AT;
    times = Array.from({length: n + 1}, (_, i) => i / n * s.dur);
    frames = times.map((_, i) => s.frame((((shift + i / n) % 1) + 1) % 1));
    if (name === 'run') console.log('run: a cycle covers', (travel(frames) * 1.12).toFixed(2), 'yards at SCALE 1.12; started', shift.toFixed(3), 'round');
  } else if (p.layer) {
    const s = source(p.layer, false), o = source(p.over, false), n = Math.round(s.dur * FPS);
    times = Array.from({length: n + 1}, (_, i) => i / n);
    frames = times.map(u => {
      const a = o.frame(u), b = s.frame(u), q = {};
      Object.keys(b.q).forEach(k => { q[k] = a.q[k].clone().invert().multiply(b.q[k]); });
      return {q, hips: b.hips.map((v, i) => v - a.hips[i]), layer: true};
    });
  } else {
    times = []; frames = [];
    let u0 = 0;
    p.parts.forEach((part, pi) => {
      const s = source(part.clip, false), from = part.from ?? 0, to = part.to ?? 1, secs = (to - from) * s.dur;
      const rounds = part.loop ? Math.max(1, Math.round(part.span / secs * 0.7)) : 1; // (the move's ~0.7 s: slide)
      const n = Math.max(2, Math.round(secs * rounds * FPS));
      for (let i = pi ? 1 : 0; i <= n; i++) {
        const k = i / n, u = part.loop ? from + ((k * rounds) % 1 || (k ? 1 : 0)) * (to - from) : from + k * (to - from);
        times.push(u0 + k * part.span); frames.push(s.frame(u));
      }
      u0 += part.span;
    });
    if (p.air) frames.forEach(f => { // (his lowest foot at his feet's height: the game lifts him)
      const at = fk(f), low = Math.min(...TOES.map(k => at[k].y)), lift = Math.max(0, low - FLOOR);
      const h = new T.Vector3().fromArray(f.hips).applyMatrix4(top); h.y -= lift; f.hips = h.applyMatrix4(topInv).toArray();
    });
    if (p.straight) frames.forEach(f => { // (his head straight back from his feet, as far as he's lying down: +z ahead)
      const at = fk(f), up = at.Head.clone().sub(at.Hips).normalize().y; // (1 upright, 0 flat)
      const v = at.Head.clone().sub(at.LeftToeBase.clone().add(at.RightToeBase).multiplyScalar(.5));
      const lying = Math.max(0, Math.min(1, (.75 - up) / .35)), k = lying * lying * (3 - 2 * lying) * p.straight;
      const turn = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.atan2(v.x, -v.z) * k);
      f.q.Hips = tgtTop.clone().invert().multiply(turn).multiply(tgtTop).multiply(f.q.Hips);
    });
  }
  clips[name] = {times, frames};
}

// into the model, in place of the clips of the same names (each key on the same side as the last, so nothing turns
// the long way round; keys a straight line through their neighbours left out)
const TOL = 1e-4;
function thin(times, vals, size) {
  const keep = [0];
  for (let i = 1; i < times.length - 1; i++) {
    const a = keep[keep.length - 1], k = (times[i] - times[a]) / (times[i + 1] - times[a]);
    let off = 0; for (let c = 0; c < size; c++) off = Math.max(off, Math.abs(vals[a * size + c] + (vals[(i + 1) * size + c] - vals[a * size + c]) * k - vals[i * size + c]));
    if (off > TOL) keep.push(i);
  }
  keep.push(times.length - 1);
  return [new Float32Array(keep.map(i => times[i])), new Float32Array(keep.flatMap(i => Array.from(vals.subarray(i * size, i * size + size))))];
}
J.animations = (J.animations || []).filter(a => !clips[a.name]);
for (const [name, {times, frames}] of Object.entries(clips)) {
  const anim = {name, samplers: [], channels: []};
  const channel = (k, path, size, get) => {
    const out = new Float32Array(frames.length * size);
    frames.forEach((f, i) => {
      out.set(get(f), i * size);
      if (size === 4 && i) { let d = 0; for (let c = 0; c < 4; c++) d += out[i * 4 + c] * out[(i - 1) * 4 + c]; if (d < 0) for (let c = 0; c < 4; c++) out[i * 4 + c] *= -1; }
    });
    const [tt, vv] = thin(times, out, size);
    anim.samplers.push({input: glb.add(g, tt, 'SCALAR'), output: glb.add(g, vv, size === 4 ? 'VEC4' : 'VEC3'), interpolation: 'LINEAR'});
    anim.channels.push({sampler: anim.samplers.length - 1, target: {node: node[k], path}});
  };
  tgt.order.filter(k => !/_End$|4$/.test(k) && !(frames[0].layer && LEGS.has(k))).forEach(k => channel(k, 'rotation', 4, f => f.q[k].toArray()));
  channel('Hips', 'translation', 3, f => f.hips);
  J.animations.push(anim);
  console.log(name.padEnd(6), times[times.length - 1].toFixed(3), 's,', frames.length, 'frames,', anim.channels.length, 'channels');
}
glb.write(g, GLB);
console.log(GLB, (await import('node:fs')).statSync(GLB).size, 'bytes');
