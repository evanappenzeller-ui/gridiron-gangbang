// A Mixamo clip read straight from its FBX (binary or ASCII, as Mixamo or Blender writes them; no three FBXLoader,
// no Blender): the rig at rest and its keys, for tools/return/runner-anims.mjs to retarget. Read through
// unity-assets.mjs fbx(): each Model a bone (its local turn and place: FBX's T * Rpre * R * Rpost^-1 * S, euler
// in its rotation order), its keys from its AnimationCurveNodes (T, R, S: each axis a curve, or the node's default),
// sampled at the file's frame rate; the rest from the bind pose (the Pose's matrices; else the Models' own values);
// all of it turned Y up, metres, by the file's axes.
// Exports: clip(file) -> {bones: {name: {parent, q, t}}, top (the world over the hips: Matrix4), dur (seconds), fps,
// at(name, u) -> its local turn u of the way through (a Quaternion), hipsAt(u) -> the hips' local place (a Vector3)}.
import * as T from '../../js/vendor/three/three.module.min.js';
import {fbx} from './unity-assets.mjs';

const TICK = 46186158000; // FBX's time units a second
const kid = (nd, name) => nd && nd.kids.find(k => k.name === name);
const arr = nd => { if (!nd) return null; const p = nd.props; return p.length === 1 && Array.isArray(p[0]) ? p[0] : p; };
const nameOf = s => String(s).split('\u0000\u0001')[0].replace(/^[A-Za-z]+::/, '');
const bare = n => n.replace(/^mixamorig:?/, '');
const propsOf = nd => { const out = {}; (kid(nd, 'Properties70') || {kids: []}).kids.forEach(p => { out[p.props[0]] = p.props.slice(4); }); return out; };
const D = Math.PI / 180;
// (FBX's eEulerXYZ...: the first named turns first, about the fixed axes, so Rz Ry Rx: three's 'ZYX')
const ORDER = ['ZYX', 'YZX', 'XZY', 'ZXY', 'YXZ', 'XYZ'];
const euler = (v, order) => new T.Quaternion().setFromEuler(new T.Euler(v[0] * D, v[1] * D, v[2] * D, ORDER[order] || 'XYZ'));

export function clip(file) {
  const tree = fbx(file), top = n => tree.kids.find(k => k.name === n);
  const gs = propsOf(top('GlobalSettings')), g = (k, d) => (gs[k] ? +gs[k][0] : d);
  // the file's axes to Y up (column j: where its axis j goes), and its unit to metres
  const ax = new T.Matrix4(), m = ax.elements.fill(0);
  m[g('CoordAxis', 0) * 4] = g('CoordAxisSign', 1); m[g('UpAxis', 1) * 4 + 1] = g('UpAxisSign', 1); m[g('FrontAxis', 2) * 4 + 2] = g('FrontAxisSign', 1); m[15] = 1;
  ax.premultiply(new T.Matrix4().makeScale(...Array(3).fill(g('UnitScaleFactor', 1) / 100)));
  const objects = top('Objects').kids, conns = top('Connections').kids;
  const byId = new Map(objects.map(o => [String(o.props[0]), o]));
  const parent = new Map(), into = new Map(); // (child -> parent; parent -> [{child, prop}])
  conns.forEach(c => {
    const [kind, ch, pa, prop] = c.props.map(String);
    if (kind === 'OO' && byId.get(pa)?.name === 'Model') parent.set(ch, pa); // (a bone's also a skin cluster's child)
    if (!into.has(pa)) into.set(pa, []);
    into.get(pa).push({ch, prop: kind === 'OP' ? prop : null});
  });
  // each Model: its own values, and its keys
  const models = new Map();
  objects.filter(o => o.name === 'Model').forEach(o => {
    const id = String(o.props[0]), p = propsOf(o), v = (k, d) => (p[k] ? p[k].map(Number) : d);
    const md = {id, name: nameOf(o.props[1]), type: String(o.props[2]), T: v('Lcl Translation', [0, 0, 0]), R: v('Lcl Rotation', [0, 0, 0]),
      S: v('Lcl Scaling', [1, 1, 1]), pre: euler(v('PreRotation', [0, 0, 0]), 0), post: euler(v('PostRotation', [0, 0, 0]), 0),
      order: p.RotationOrder ? +p.RotationOrder[0] : 0, curves: {}};
    if (['RotationOffset', 'RotationPivot', 'ScalingOffset', 'ScalingPivot'].some(k => p[k] && p[k].some(x => Math.abs(+x) > 1e-6))) console.warn(file, md.name, 'has pivots or offsets: not read');
    (into.get(id) || []).forEach(({ch, prop}) => {
      const cn = byId.get(ch);
      if (!cn || cn.name !== 'AnimationCurveNode' || !/^Lcl /.test(prop || '')) return;
      const def = propsOf(cn), axes = ['X', 'Y', 'Z'].map(a => ({k: [0], v: [def['d|' + a] ? +def['d|' + a][0] : 0]}));
      (into.get(ch) || []).forEach(({ch: cv, prop: which}) => {
        const c = byId.get(cv), i = ['d|X', 'd|Y', 'd|Z'].indexOf(which);
        if (c && i >= 0) axes[i] = {k: Array.from(arr(kid(c, 'KeyTime'))).map(t => Number(t) / TICK), v: Array.from(arr(kid(c, 'KeyValueFloat')) || arr(kid(c, 'KeyValueDouble')))};
      });
      md.curves[prop.slice(4)[0]] = axes; // (T, R, S)
    });
    models.set(id, md);
  });
  const bone = md => md && md.type === 'LimbNode' && /^mixamorig/.test(md.name);
  const at = (curve, s) => { // (a curve's value at s seconds: straight between its keys)
    const {k, v} = curve;
    if (k.length < 2 || s <= k[0]) return v[0];
    if (s >= k[k.length - 1]) return v[v.length - 1];
    let i = 1; while (k[i] < s) i++;
    return v[i - 1] + (v[i] - v[i - 1]) * (s - k[i - 1]) / (k[i] - k[i - 1]);
  };
  const local = (md, s) => { // (its local turn and place at s seconds, or as it stands with s null)
    const val = (c, d) => (s != null && md.curves[c] ? md.curves[c].map(a => at(a, s)) : d);
    const q = md.pre.clone().multiply(euler(val('R', md.R), md.order)).multiply(md.post.clone().invert());
    return {q, t: new T.Vector3(...val('T', md.T)), s: new T.Vector3(...val('S', md.S))};
  };
  const mat = l => new T.Matrix4().compose(l.t, l.q, l.s);
  const world = id => { const out = ax.clone(), chain = []; for (let x = id; models.has(x); x = parent.get(x)) chain.unshift(x); chain.forEach(x => out.multiply(mat(local(models.get(x), null)))); return out; };
  // the bones at rest: the bind pose's matrices where it has them all
  const bones = {}, ids = {}, rest = new Map();
  models.forEach(md => { if (bone(md)) ids[bare(md.name)] = md.id; });
  const pose = objects.find(o => o.name === 'Pose');
  if (pose) pose.kids.filter(k => k.name === 'PoseNode').forEach(pn => rest.set(String(arr(kid(pn, 'Node'))[0]), ax.clone().multiply(new T.Matrix4().fromArray(arr(kid(pn, 'Matrix')).map(Number)))));
  const hipsId = ids.Hips, topM = world(parent.get(hipsId));
  const wRest = id => (rest.has(id) && Object.values(ids).every(x => rest.has(x)) ? rest.get(id) : world(id));
  Object.entries(ids).forEach(([k, id]) => {
    const p = models.get(parent.get(id)), pw = bone(p) ? wRest(p.id) : topM;
    const l = pw.clone().invert().multiply(wRest(id)), t = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    l.decompose(t, q, s);
    bones[k] = {parent: bone(p) ? bare(p.name) : null, q, t};
  });
  // the keys: sampled at its frames, each bone's turn between them the short way round
  const stack = objects.find(o => o.name === 'AnimationStack'), sp = stack ? propsOf(stack) : {};
  let dur = sp.LocalStop ? Number(sp.LocalStop[0]) / TICK : 0;
  if (!dur) models.forEach(md => Object.values(md.curves).flat().forEach(c => { dur = Math.max(dur, c.k[c.k.length - 1]); }));
  const fps = g('CustomFrameRate', 30) > 0 ? g('CustomFrameRate', 30) : 30, n = Math.max(1, Math.round(dur * fps));
  const times = Array.from({length: n + 1}, (_, i) => i / n * dur), track = {};
  Object.entries(ids).forEach(([k, id]) => {
    const md = models.get(id), q = [], tt = [];
    times.forEach(s => { const l = local(md, s); q.push(...l.q.toArray()); tt.push(...l.t.toArray()); });
    track[k] = new T.QuaternionKeyframeTrack(k + '.quaternion', times, q).createInterpolant();
    if (k === 'Hips') track.hips = new T.VectorKeyframeTrack('Hips.position', times, tt).createInterpolant();
  });
  return {bones, top: topM, dur, fps,
    at: (k, u) => new T.Quaternion().fromArray(track[k].evaluate(Math.max(0, Math.min(1, u)) * dur)),
    hipsAt: u => new T.Vector3().fromArray(track.hips.evaluate(Math.max(0, Math.min(1, u)) * dur))};
}
