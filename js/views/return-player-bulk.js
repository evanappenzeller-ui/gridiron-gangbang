// Evan's ask (Oct 21 2026): "the return man football player looks too skinny. add some defined muscles and bulk him
// up a bit". Part of his reviewed navy 22 kit (return-player-style.js restyleFootball calls bulkUp(), so it shares that
// kit's profile gate and lifetime: his returner and his ghost; the base model and the linebacker stay as they are).
// The sculpt works on his bind pose (the rest pose of a fresh dress() clone, which is the model's bind pose:
// tools/return/player-model.mjs): every skinned mesh of him that a muscle reaches (skin, jersey, pants, socks, the right
// arm's sleeve, the belt) gets a copy of its positions and normals pushed out by smooth muscle volumes. Each limb
// bone's muscles are laid out in its own frame (t along the bone from its joint, 0 to 1; the angle round it: 0 his
// front, 90 the outer side, 180 the back, -90 the inner side) and push straight out from the bone; the torso's are laid
// out in the model's frame (front +z, his left +x, up +y) and push out from the spine. A vertex takes each bone's field
// by its share of the skin weights (a share of .45 or more takes it whole), the larger leading where two meet (a soft
// maximum), so the joints blend. Much of the new volume is on his sides (lats, the triceps' outer head, the outer thigh,
// the calves' flares), where the game's camera, behind him and above, sees it as width.
// The cloth never gains less than the skin straight under it (a little more), and the skin that cloth covers is tucked
// in under it (all but its edges), so the skin and the cloth, weighted differently, don't cross when he moves; the
// cloth's pushes are smoothed so its layers move together; the shoulder under each pad stays inside the pad; a seam's
// split vertices move as one with their normals turned together (the welded smooth normal's change applied to each
// original normal), so no crack or hard edge appears. The hands, feet and head are untouched; the UVs, skin weights and
// faces are the model's own (shared with it, not copied). The ball (hung on his right forearm by dress()) moves out by
// what the forearm gained under it.
// The arithmetic (sculpt(): no three.js, no page) runs once a page load, off the page's thread: this same file started
// as a module worker (in the page if a worker can't start), the result kept for the ghost and any later restyle, which
// share one sculpted geometry; the page only copies his arrays out and swaps the geometry in when it comes back.
// Nothing runs per frame.
// Export: bulkUp(P, T) -> undo() (restores the original geometry and the ball, lets the sculpted geometry go once
// nothing wears it; undo.ready settles true once he's sculpted, false if he never will be).

const D2R = Math.PI / 180;
// A muscle: [t0, spread below t0, spread above t0 (both as fractions of the bone), angle (deg), tightness round the
// bone (0: all round), height (m; negative: a groove)]. scale: a side's heights scaled, muscle by muscle. ease: where
// the limb meets something of his (the armpit's fold against his side; his idle hands resting on his thighs), [t0,
// spreads, angle, tightness, the share of the muscles kept there].
const LIMBS = {
  Arm: {to: 'ForeArm', m: [
    [.17, .12, .14, 85, 1.6, .0075],   // deltoid, outer head (the cap: mostly under the pad, which leads there)
    [.12, .10, .12, 25, 2.5, .0060],   // deltoid, front head
    [.14, .10, .12, 150, 2.5, .0085],  // deltoid, rear head
    [.37, .05, .05, 50, 1.5, -.0030],  // the deltoid's insertion: the groove between it and the biceps
    [.58, .16, .11, -5, 2.4, .0225],   // biceps, peaked, dropping quicker toward the elbow
    [.42, .17, .15, 172, 2.0, .0190],  // triceps, long head
    [.38, .14, .13, 122, 2.6, .0135],  // triceps, outer head (the horseshoe's outer side)
    [.74, .10, .08, 70, 2.5, .0085],   // brachialis, outer side above the elbow
    [.55, .25, .20, 0, 0, .0045]       // all round
  ], ease: [[0, .01, .35, -95, 1.2, .1]]},
  ForeArm: {to: 'Hand', m: [
    [.20, .10, .20, 55, .9, .0140],    // brachioradialis and extensors, the top-outer mass by the elbow
    [.25, .10, .20, -50, .9, .0080],   // flexors, front-inner
    [.30, .15, .25, 0, 0, .0045]       // all round, tapering to the wrist
  ], scale: {Right: [1, .5, 1]}},      // (his right forearm carries the ball against his belly: its flexors face it)
  UpLeg: {to: 'Leg', m: [
    [.50, .25, .20, 5, 1.5, .0170],    // quads (rectus femoris)
    [.60, .22, .17, 72, 2.0, .0175],   // vastus lateralis, the outer sweep
    [.82, .10, .06, -45, 2.5, .0100],  // vastus medialis, the teardrop above the inner knee
    [.45, .22, .20, 180, 1.6, .0140],  // hamstrings
    [.42, .22, .20, 135, 2.5, .0080],  // biceps femoris, the outer hamstring
    [.25, .15, .20, -100, 2.0, .0070], // adductors
    [.00, .10, .10, 170, 1.5, .0080]   // glute tie-in
  ], ease: [[.585, .085, .085, 105, 3.5, .35]]},
  Leg: {to: 'Foot', m: [
    [.28, .12, .09, -148, 4, .0215],   // gastrocnemius, inner head (the calf's diamond)
    [.25, .11, .085, 148, 4, .0175],   // gastrocnemius, outer head
    [.27, .12, .10, -100, 2.5, .0075], // its inner flare
    [.25, .11, .10, 100, 2.5, .0065],  // its outer flare
    [.50, .12, .14, 180, 1.5, .0080],  // soleus
    [.32, .15, .20, 35, 3, .0050]      // tibialis anterior
  ]}
};
const TORSO = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder']);
const SKIN = 'Bodymat'; // (the model's own name for his skin's material: the layer the cloth must stay over)
const CLEATS = 'sepatu_key.obj'; // (his cleats': below every muscle, so never looked at)
// His shoulder pads as return-player-style.js hangs them (an ellipsoid round each upper arm's joint, on the model's
// axes: its centre's offset, x outward; its radii): the shoulder under one stays inside it (PAD_FILL of the way out at
// most), the muscle easing back in from PAD_EASE of the way out.
const PADS = {at: [.008, .003, .003], r: [.095, .055, .105]}, PAD_FILL = .97, PAD_EASE = 1.4;
// Skin and cloth: cloth "over" skin is within OVER.ahead of it along the skin's push (or OVER.behind short of it) and
// within OVER.side of that line. The cloth gains at least FLOOR times the skin under it, and FLOOR_ADD more; the skin
// under cloth is tucked in to TUCK of its push, easing from its full push within TUCK_EDGE of skin no cloth covers.
const OVER = {ahead: .035, behind: .004, side: .02}, FLOOR = 1.04, FLOOR_ADD = .0006, TUCK = .3, TUCK_EDGE = [.015, .05];
const SMOOTH = .012; // (the cloth's pushes averaged over this radius, m, so a seam's layers and linings move together)
const TAIL = 5e-5; // (a push smaller than this, a twentieth of a millimetre, is none)

// ---------------------------------------------------------------------------- The arithmetic (page or worker)
/** A bell, its spread different either side of c; 0 past 3.5 spreads (where it's under a quarter of a percent). */
const bell = (x, c, below, above) => { const u = (x - c) / (x < c ? below : above), uu = u * u; return uu > 12 ? 0 : Math.exp(-.5 * uu); };
const ring = (cosd, k) => k ? Math.exp(k * (cosd - 1)) : 1;
const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const AXIS_Z = -.015, NECK_Z = -.035;
const dir = deg => [Math.cos(deg * D2R), Math.sin(deg * D2R)];
const [C30, S30] = dir(30), [C105, S105] = dir(105), [C128, S128] = dir(128), [C160, S160] = dir(160), [C165, S165] = dir(165);
/** The torso's muscles at model point (x, y, z): chest, lats, upper back and traps, neck, glutes. */
function torso(x, y, z) {
  if (y < .8 || y > 1.7) return 0;
  const ax = Math.abs(x), dz = z - AXIS_Z, r = Math.sqrt(ax * ax + dz * dz) || 1e-6, c = dz / r, s = ax / r; // (round the spine)
  let d = 0, b;
  if ((b = bell(y, 1.44, .035, .06))) d += .0140 * b * ring(c * C30 + s * S30, 3);       // pecs, with a firm lower edge
  if ((b = bell(y, 1.43, .06, .06)) && c > .5) d -= .0035 * b * ring(c, 12);             // the sternum's groove between them
  if ((b = bell(y, 1.32, .10, .045))) d += .0290 * b * ring(c * C128 + s * S128, 3);     // lats: the V, from under the arms
  if ((b = bell(y, 1.49, .05, .05))) d += .0120 * b * ring(c * C165 + s * S165, 3);      // upper back
  if ((b = bell(y, 1.56, .035, .035) * bell(ax, .085, .04, .04))) d += .0165 * b * smooth(.6, -.2, c); // traps, neck to pads
  const nz = z - NECK_Z, nr = Math.sqrt(x * x + nz * nz) || 1;
  if (nr < .12 && (b = bell(y, 1.585, .04, .028))) {                                     // neck: fullest at the sides,
    const sx = x / nr, back = Math.max(0, -nz / nr);                                     // less at the throat and at the
    d += .0095 * b * (.6 + .4 * sx * sx - .15 * back) * smooth(.12, .08, nr);            // back (the collar sits there)
  }
  if ((b = bell(y, 1.0, .05, .06))) d += .0110 * b * ring(c * C160 + s * S160, 2.5);     // glutes
  if ((b = bell(y, 1.07, .05, .05))) d += .0080 * b * ring(c * C105 + s * S105, 3);      // the hip's side (gluteus medius)
  return d;
}
const R = [0, 0, 0]; // (limb()'s radial direction out)
/** A limb's muscles at model point (px, py, pz) (F: its frame, from frames()); leaves the direction straight out from
 *  its axis in R. */
function limb(F, px, py, pz) {
  const vx = px - F.jx, vy = py - F.jy, vz = pz - F.jz, along = vx * F.ax + vy * F.ay + vz * F.az;
  let rx = vx - along * F.ax, ry = vy - along * F.ay, rz = vz - along * F.az;
  const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (rl < 1e-6) return 0;
  rx /= rl; ry /= rl; rz /= rl;
  R[0] = rx; R[1] = ry; R[2] = rz;
  const t = along / F.L, cf = rx * F.fx + ry * F.fy + rz * F.fz, co = rx * F.ox + ry * F.oy + rz * F.oz, m = F.m;
  let d = 0;
  for (let i = 0; i < m.length; i += 7) { // (bell() and ring(), written out: this runs once a vertex)
    const u = (t - m[i]) / (t < m[i] ? m[i + 1] : m[i + 2]), uu = u * u;
    if (uu > 12) continue;
    const k = m[i + 5];
    d += m[i + 6] * Math.exp(k ? -.5 * uu + k * (cf * m[i + 3] + co * m[i + 4] - 1) : -.5 * uu);
  }
  const q = F.ease;
  if (d > 0) for (let i = 0; i < q.length; i += 7) d *= 1 - (1 - q[i + 6]) * bell(t, q[i], q[i + 1], q[i + 2]) * ring(cf * q[i + 3] + co * q[i + 4], q[i + 5]);
  return d;
}
/** An attribute (from attr()) as plain floats, de-interleaved, normalized integers read as WebGL reads them. */
function unpack(A) {
  const {src, stride, off, scale, floor, count, size} = A, out = new Float32Array(count * size);
  for (let i = 0, o = 0; i < count; i++) for (let c = 0, b = i * stride + off; c < size; c++, o++) out[o] = Math.max(floor, src[b + c] * scale);
  return out;
}
/** A grid over n points (xyz: their coordinates, flat) in cells of size h: near(x, y, z, fn) calls fn(k) for each
 *  point k in the 27 cells round (x, y, z), so every point within h of it (and some further). */
function grid(xyz, n, h) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < n * 3; k += 3) {
    x0 = Math.min(x0, xyz[k]); y0 = Math.min(y0, xyz[k + 1]); z0 = Math.min(z0, xyz[k + 2]);
    x1 = Math.max(x1, xyz[k]); y1 = Math.max(y1, xyz[k + 1]); z1 = Math.max(z1, xyz[k + 2]);
  }
  if (!n) return () => {};
  const nx = Math.floor((x1 - x0) / h) + 1, ny = Math.floor((y1 - y0) / h) + 1, nz = Math.floor((z1 - z0) / h) + 1;
  const cellOf = k => (Math.floor((xyz[k] - x0) / h) * ny + Math.floor((xyz[k + 1] - y0) / h)) * nz + Math.floor((xyz[k + 2] - z0) / h);
  const start = new Int32Array(nx * ny * nz + 1), items = new Int32Array(n);
  for (let k = 0; k < n; k++) start[cellOf(k * 3) + 1]++;
  for (let c = 0; c < nx * ny * nz; c++) start[c + 1] += start[c];
  const fill = start.slice(0, -1);
  for (let k = 0; k < n; k++) items[fill[cellOf(k * 3)]++] = k;
  return (x, y, z, fn) => {
    if (x < x0 - h || x > x1 + h || y < y0 - h || y > y1 + h || z < z0 - h || z > z1 + h) return;
    const cx = Math.floor((x - x0) / h), cy = Math.floor((y - y0) / h), cz = Math.floor((z - z0) / h);
    for (let i = Math.max(0, cx - 1); i <= Math.min(nx - 1, cx + 1); i++) for (let j = Math.max(0, cy - 1); j <= Math.min(ny - 1, cy + 1); j++) {
      for (let k = Math.max(0, cz - 1), base = (i * ny + j) * nz; k <= Math.min(nz - 1, cz + 1); k++) {
        for (let m = start[base + k], end = start[base + k + 1]; m < end; m++) fn(items[m]);
      }
    }
  };
}

/** The inverse of e's 3x3 (e: a column-major 4x4), column-major. */
function inverse3(e) {
  const a0 = e[0], a1 = e[1], a2 = e[2], b0 = e[4], b1 = e[5], b2 = e[6], c0 = e[8], c1 = e[9], c2 = e[10];
  const det = a0 * (b1 * c2 - b2 * c1) - b0 * (a1 * c2 - a2 * c1) + c0 * (a1 * b2 - a2 * b1);
  return [(b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det, (a1 * b2 - a2 * b1) / det,
    (b2 * c0 - b0 * c2) / det, (a0 * c2 - a2 * c0) / det, (a2 * b0 - a0 * b2) / det,
    (b0 * c1 - b1 * c0) / det, (a1 * c0 - a0 * c1) / det, (a0 * b1 - a1 * b0) / det];
}

/** One mesh's pushes (model space) for its vertices a muscle can reach, welded (split vertices share one), before the
 *  cloth's look at the skin under it; with each group's place and its normal; null if no muscle reaches it. M: a mesh
 *  from job(); F: frames(). */
function measure(M, F) {
  const {pos: PO, nor: NO, si: SI, sw: SW, kind, e} = M, n = PO.count, act = [], it = inverse3(e);
  for (let i = 0; i < n; i++) {
    const s = i * SI.stride + SI.off, w = i * SW.stride + SW.off;
    if ((SW.src[w] && kind[SI.src[s]] >= 0) || (SW.src[w + 1] && kind[SI.src[s + 1]] >= 0) ||
      (SW.src[w + 2] && kind[SI.src[s + 2]] >= 0) || (SW.src[w + 3] && kind[SI.src[s + 3]] >= 0)) act.push(i);
  }
  if (!act.length) return null;
  // Welding: an open-addressed table of their positions (the model's own integers when it's quantized).
  const quantized = !(PO.src instanceof Float32Array), m = act.length, key = new Int32Array(m * 3), weld = new Int32Array(n).fill(-1);
  let size = 1, G = 0;
  while (size < m * 2) size <<= 1;
  const slot = new Int32Array(size).fill(-1), count = new Float32Array(m), rep = new Int32Array(m);
  for (let k = 0; k < m; k++) {
    const b = act[k] * PO.stride + PO.off;
    const kx = key[k * 3] = quantized ? PO.src[b] : Math.round(PO.src[b] * 1e5);
    const ky = key[k * 3 + 1] = quantized ? PO.src[b + 1] : Math.round(PO.src[b + 1] * 1e5);
    const kz = key[k * 3 + 2] = quantized ? PO.src[b + 2] : Math.round(PO.src[b + 2] * 1e5);
    let h = (Math.imul(kx, 73856093) ^ Math.imul(ky, 19349663) ^ Math.imul(kz, 83492791)) & (size - 1);
    for (;;) {
      const s = slot[h];
      if (s < 0) { slot[h] = k; rep[G] = act[k]; count[G]++; weld[act[k]] = G++; break; }
      if (key[s * 3] === kx && key[s * 3 + 1] === ky && key[s * 3 + 2] === kz) { count[weld[act[k]] = weld[act[s]]]++; break; }
      h = (h + 1) & (size - 1);
    }
  }
  // Each group's push, from its first vertex (split vertices share their weights as well as their place).
  const push = new Float32Array(G * 3), at = new Float32Array(G * 3), nrm = new Float32Array(G * 3), wt = [0, 0, 0, 0], kd = [0, 0, 0, 0];
  let moved = false;
  for (let id = 0; id < G; id++) {
    const i = rep[id], b = i * PO.stride + PO.off, nb = i * NO.stride + NO.off;
    const x0 = Math.max(PO.floor, PO.src[b] * PO.scale), y0 = Math.max(PO.floor, PO.src[b + 1] * PO.scale), z0 = Math.max(PO.floor, PO.src[b + 2] * PO.scale);
    const x = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12], y = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13], z = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
    { // its normal in the model's space (by the inverse transpose)
      const u = Math.max(NO.floor, NO.src[nb] * NO.scale), v = Math.max(NO.floor, NO.src[nb + 1] * NO.scale), w = Math.max(NO.floor, NO.src[nb + 2] * NO.scale);
      const nx = it[0] * u + it[1] * v + it[2] * w, ny = it[3] * u + it[4] * v + it[5] * w, nz = it[6] * u + it[7] * v + it[8] * w, nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nrm[id * 3] = nx / nl; nrm[id * 3 + 1] = ny / nl; nrm[id * 3 + 2] = nz / nl;
    }
    for (let c = 0; c < 4; c++) { wt[c] = SW.src[i * SW.stride + SW.off + c] * SW.scale; kd[c] = kind[SI.src[i * SI.stride + SI.off + c]]; }
    // Each distinct field once (a helper bone and its parent are one), taken by its bones' share of the weight: a share
    // of .45 or more takes it whole, so a sleeve weighted a little to the chest gains like the arm in it; where fields
    // meet (a joint) the larger leads, blended smoothly (a soft maximum).
    let px = 0, py = 0, pz = 0, sum = 0, low = 0, lx = 0, ly = 0, lz = 0;
    for (let c = 0; c < 4; c++) {
      const K = kd[c];
      if (!(wt[c] > 0) || K < 0) continue;
      let w = wt[c], dup = false;
      for (let a = 0; a < c; a++) if (wt[a] > 0 && kd[a] === K) { dup = true; break; }
      if (dup) continue;
      for (let a = c + 1; a < 4; a++) if (wt[a] > 0 && kd[a] === K) w += wt[a];
      let d, ux, uy, uz;
      if (K === 0) {
        d = torso(x, y, z);
        if (d === 0) continue;
        // out from the spine (from the neck's middle, up there), lifting over the tops of the shoulders: a direction
        // of the place alone, so the panels of a seam and a lining move as the cloth over them does
        const rz = z - AXIS_Z - (NECK_Z - AXIS_Z) * smooth(1.45, 1.55, y), rl = Math.sqrt(x * x + rz * rz) || 1;
        const lift = 1.2 * smooth(1.47, 1.56, y) * smooth(.06, .1, Math.abs(x));
        ux = x / rl; uy = lift; uz = rz / rl;
        const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
        ux /= ul; uy /= ul; uz /= ul;
      } else {
        d = limb(F.limbs[K - 1], x, y, z);
        ux = R[0]; uy = R[1]; uz = R[2];
      }
      d *= smooth(.05, .45, w);
      // only out of a surface facing the way the field pushes: not the torso's into the inside of an arm at the
      // armpit, nor an arm's into his side (a sleeve's lining, facing in, still moves with its sleeve)
      if (K === 0 || M.skin) d *= smooth(-.1, .4, nrm[id * 3] * ux + nrm[id * 3 + 1] * uy + nrm[id * 3 + 2] * uz);
      if (d > 0) { const d2 = d * d, s = d2 * d2 * d2; sum += s; px += s * d * ux; py += s * d * uy; pz += s * d * uz; }
      else if (d < low) { low = d; lx = d * ux; ly = d * uy; lz = d * uz; }
    }
    if (sum > 0) { px /= sum; py /= sum; pz /= sum; } else { px = lx; py = ly; pz = lz; }
    const o = id * 3;
    at[o] = x; at[o + 1] = y; at[o + 2] = z;
    if (px * px + py * py + pz * pz < TAIL * TAIL) continue;
    moved = true;
    push[o] = px; push[o + 1] = py; push[o + 2] = pz;
  }
  return {M, n, weld, G, push, at, nrm, count, moved, skin: M.skin};
}
/** Under his shoulder pads the shoulder keeps inside them, easing back in from beyond their rims (the same for skin
 *  and cloth, so the cloth, further out, keeps at least the push of the skin under it). */
function padded({G, push, at}, F) {
  for (const pad of F.pads) for (let id = 0; id < G; id++) {
    const o = id * 3;
    if (!push[o] && !push[o + 1] && !push[o + 2]) continue;
    const qx = (at[o] - pad.x) / pad.rx, qy = (at[o + 1] - pad.y) / pad.ry, qz = (at[o + 2] - pad.z) / pad.rz;
    const e2 = qx * qx + qy * qy + qz * qz;
    if (e2 >= PAD_EASE * PAD_EASE) continue;
    let k = smooth(PAD_FILL, PAD_EASE, Math.sqrt(e2));
    const dx = push[o] * k / pad.rx, dy = push[o + 1] * k / pad.ry, dz = push[o + 2] * k / pad.rz;
    const a = dx * dx + dy * dy + dz * dz, b = qx * dx + qy * dy + qz * dz, lim = Math.max(e2, PAD_FILL * PAD_FILL);
    if (e2 < 1 && e2 + 2 * b + a > lim) k *= a > 0 ? Math.max(0, Math.min(1, (-b + Math.sqrt(Math.max(0, b * b - a * (e2 - lim)))) / a)) : 0;
    push[o] *= k; push[o + 1] *= k; push[o + 2] *= k;
  }
}

/** Each cloth mesh's pushes averaged over SMOOTH round each vertex (nearer counting more), so two layers of it a hair
 *  apart (a seam, a lining, a hem's fold) move as one. */
function smoothCloth(s) {
  const {G, push, at} = s, near = grid(at, G, SMOOTH), out = new Float32Array(G * 3), R2 = SMOOTH * SMOOTH;
  for (let id = 0; id < G; id++) {
    const o = id * 3, x = at[o], y = at[o + 1], z = at[o + 2];
    let w = 0, sx = 0, sy = 0, sz = 0;
    near(x, y, z, k => {
      const q = k * 3, dx = at[q] - x, dy = at[q + 1] - y, dz = at[q + 2] - z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R2) return;
      const f = (1 - Math.sqrt(d2) / SMOOTH) ** 2;
      w += f; sx += f * push[q]; sy += f * push[q + 1]; sz += f * push[q + 2];
    });
    if (w > 0) { out[o] = sx / w; out[o + 1] = sy / w; out[o + 2] = sz / w; }
  }
  push.set(out);
  s.moved = push.some(v => v !== 0);
}

/** The cloth's faces (those all of whose corners a muscle reaches) in a grid: cast(ox, oy, oz, ux, uy, uz, len, fn)
 *  calls fn(part, its corners' groups, the hit's barycentric weights) for each face the segment from o along u (len
 *  long) crosses that isn't facing back along it. */
function clothFaces(cloths) {
  const H = .03;
  let n = 0, x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const c of cloths) n += (c.M.index ? c.M.index.length : c.n) / 3;
  const tris = new Int32Array(n * 4); // (part, and its corners' groups)
  n = 0;
  cloths.forEach((c, p) => {
    const {weld, M, at} = c, index = M.index, m = index ? index.length : c.n;
    for (let k = 0; k < m; k += 3) {
      const a = weld[index ? index[k] : k], b = weld[index ? index[k + 1] : k + 1], d = weld[index ? index[k + 2] : k + 2];
      if (a < 0 || b < 0 || d < 0 || a === b || b === d || a === d) continue;
      tris[n * 4] = p; tris[n * 4 + 1] = a; tris[n * 4 + 2] = b; tris[n * 4 + 3] = d; n++;
      for (const o of [a * 3, b * 3, d * 3]) {
        x0 = Math.min(x0, at[o]); y0 = Math.min(y0, at[o + 1]); z0 = Math.min(z0, at[o + 2]);
        x1 = Math.max(x1, at[o]); y1 = Math.max(y1, at[o + 1]); z1 = Math.max(z1, at[o + 2]);
      }
    }
  });
  if (!n) return () => {};
  const nx = Math.floor((x1 - x0) / H) + 1, ny = Math.floor((y1 - y0) / H) + 1, nz = Math.floor((z1 - z0) / H) + 1;
  const ci = (v, v0, m) => Math.max(0, Math.min(m - 1, Math.floor((v - v0) / H)));
  // each face in every cell its box touches (counted, then filled in place)
  const start = new Int32Array(nx * ny * nz + 1), box = new Int32Array(n * 6);
  for (let t = 0; t < n; t++) {
    const at = cloths[tris[t * 4]].at, a = tris[t * 4 + 1] * 3, b = tris[t * 4 + 2] * 3, d = tris[t * 4 + 3] * 3, q = t * 6;
    box[q] = ci(Math.min(at[a], at[b], at[d]), x0, nx); box[q + 1] = ci(Math.max(at[a], at[b], at[d]), x0, nx);
    box[q + 2] = ci(Math.min(at[a + 1], at[b + 1], at[d + 1]), y0, ny); box[q + 3] = ci(Math.max(at[a + 1], at[b + 1], at[d + 1]), y0, ny);
    box[q + 4] = ci(Math.min(at[a + 2], at[b + 2], at[d + 2]), z0, nz); box[q + 5] = ci(Math.max(at[a + 2], at[b + 2], at[d + 2]), z0, nz);
    for (let i = box[q]; i <= box[q + 1]; i++) for (let j = box[q + 2]; j <= box[q + 3]; j++) for (let k = box[q + 4]; k <= box[q + 5]; k++) start[(i * ny + j) * nz + k + 1]++;
  }
  for (let c = 0; c < nx * ny * nz; c++) start[c + 1] += start[c];
  const fill = start.slice(0, -1), items = new Int32Array(start[nx * ny * nz]);
  for (let t = 0; t < n; t++) {
    const q = t * 6;
    for (let i = box[q]; i <= box[q + 1]; i++) for (let j = box[q + 2]; j <= box[q + 3]; j++) for (let k = box[q + 4]; k <= box[q + 5]; k++) items[fill[(i * ny + j) * nz + k]++] = t;
  }
  const stamp = new Int32Array(n), g = [0, 0, 0], b = [0, 0, 0];
  let mark = 0;
  return (ox, oy, oz, ux, uy, uz, len, fn) => {
    const ex = ox + ux * len, ey = oy + uy * len, ez = oz + uz * len;
    if (Math.max(ox, ex) < x0 || Math.min(ox, ex) > x1 || Math.max(oy, ey) < y0 || Math.min(oy, ey) > y1 || Math.max(oz, ez) < z0 || Math.min(oz, ez) > z1) return;
    mark++;
    const i0 = ci(Math.min(ox, ex), x0, nx), i1 = ci(Math.max(ox, ex), x0, nx), j0 = ci(Math.min(oy, ey), y0, ny), j1 = ci(Math.max(oy, ey), y0, ny);
    const k0 = ci(Math.min(oz, ez), z0, nz), k1 = ci(Math.max(oz, ez), z0, nz);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      for (let m = start[(i * ny + j) * nz + k], end = start[(i * ny + j) * nz + k + 1]; m < end; m++) {
        const t = items[m];
        if (stamp[t] === mark) continue;
        stamp[t] = mark;
        const c = cloths[tris[t * 4]], at = c.at, nr = c.nrm, a = tris[t * 4 + 1] * 3, p1 = tris[t * 4 + 2] * 3, p2 = tris[t * 4 + 3] * 3;
        if ((nr[a] + nr[p1] + nr[p2]) * ux + (nr[a + 1] + nr[p1 + 1] + nr[p2 + 1]) * uy + (nr[a + 2] + nr[p1 + 2] + nr[p2 + 2]) * uz < -1.05) continue;
        // (Moller and Trumbore's)
        const e1x = at[p1] - at[a], e1y = at[p1 + 1] - at[a + 1], e1z = at[p1 + 2] - at[a + 2];
        const e2x = at[p2] - at[a], e2y = at[p2 + 1] - at[a + 1], e2z = at[p2 + 2] - at[a + 2];
        const px = uy * e2z - uz * e2y, py = uz * e2x - ux * e2z, pz = ux * e2y - uy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tx = ox - at[a], ty = oy - at[a + 1], tz = oz - at[a + 2], bu = (tx * px + ty * py + tz * pz) * inv;
        if (bu < 0 || bu > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, bv = (ux * qx + uy * qy + uz * qz) * inv;
        if (bv < 0 || bu + bv > 1) continue;
        const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (d < 0 || d > len) continue;
        g[0] = a / 3; g[1] = p1 / 3; g[2] = p2 / 3; b[0] = 1 - bu - bv; b[1] = bu; b[2] = bv;
        fn(c, g, b);
      }
    }
  };
}

/** The cloth over the skin: each cloth group's push at least FLOOR times (and FLOOR_ADD more than) the push of the skin
 *  straight under it; then the skin under cloth tucked in (TUCK of its push, easing out to its full push near skin no
 *  cloth covers), so where the two are weighted to different bones and part as he moves, the skin stays under. */
function overSkin(parts) {
  const skins = parts.filter(s => s.skin), cloths = parts.filter(s => !s.skin);
  if (!skins.length || !cloths.length) return;
  // the moving skin: where, its push's direction and length
  let n = 0;
  for (const s of skins) for (let o = 0; o < s.G * 3; o += 3) if (s.push[o] || s.push[o + 1] || s.push[o + 2]) n++;
  if (!n) return;
  const sat = new Float32Array(n * 3), sdir = new Float32Array(n * 3), slen = new Float32Array(n), sref = [];
  n = 0;
  for (const s of skins) for (let o = 0; o < s.G * 3; o += 3) {
    const x = s.push[o], y = s.push[o + 1], z = s.push[o + 2], l = Math.sqrt(x * x + y * y + z * z);
    if (!l) continue;
    sat.set([s.at[o], s.at[o + 1], s.at[o + 2]], n * 3); sdir.set([x / l, y / l, z / l], n * 3); slen[n] = l; sref.push([s, o]); n++;
  }
  // cloth at (x, y, z) facing (nx, ny, nz) over skin k: not facing back at it (so not the cloth of his body beside a
  // limb; a rim, facing along the limb, counts), within OVER.ahead along its push (OVER.behind short of it), within
  // OVER.side of that line; returns how far off the line (or -1)
  const off = (k, x, y, z, nx, ny, nz) => {
    const q = k * 3;
    if (nx * sdir[q] + ny * sdir[q + 1] + nz * sdir[q + 2] < -.35) return -1;
    const vx = x - sat[q], vy = y - sat[q + 1], vz = z - sat[q + 2], a = vx * sdir[q] + vy * sdir[q + 1] + vz * sdir[q + 2];
    if (a < -OVER.behind || a > OVER.ahead) return -1;
    const l2 = vx * vx + vy * vy + vz * vz - a * a;
    return l2 < OVER.side * OVER.side ? Math.sqrt(Math.max(0, l2)) : -1;
  };
  // each cloth vertex: at least the most of the skin under it (nearer the line counting more)
  const nearSkin = grid(sat, n, OVER.ahead), covered = new Uint8Array(n);
  for (const c of cloths) for (let id = 0; id < c.G; id++) {
    const o = id * 3, x = c.at[o], y = c.at[o + 1], z = c.at[o + 2], nx = c.nrm[o], ny = c.nrm[o + 1], nz = c.nrm[o + 2];
    let best = 0, bx = 0, by = 0, bz = 0;
    nearSkin(x, y, z, k => {
      const lat = off(k, x, y, z, nx, ny, nz);
      if (lat < 0) return;
      const f = 1 - smooth(.006, OVER.side, lat), q = k * 3;
      best = Math.max(best, slen[k] * f); bx += f * sdir[q]; by += f * sdir[q + 1]; bz += f * sdir[q + 2];
    });
    const bl = Math.sqrt(bx * bx + by * by + bz * bz);
    if (!(best > TAIL) || !bl) continue;
    bx /= bl; by /= bl; bz /= bl;
    const short = best * FLOOR + FLOOR_ADD - (c.push[o] * bx + c.push[o + 1] * by + c.push[o + 2] * bz);
    if (short > 0) { c.push[o] += short * bx; c.push[o + 1] += short * by; c.push[o + 2] += short * bz; c.moved = true; }
  }
  // each skin vertex's push, cast at the cloth's faces: every face it meets (not facing back at it) gains at least
  // what the skin does there, however big the face; and a skin vertex that meets one is covered
  const faces = clothFaces(cloths);
  for (let k = 0; k < n; k++) {
    const q = k * 3, ux = sdir[q], uy = sdir[q + 1], uz = sdir[q + 2], need = slen[k] * FLOOR + FLOOR_ADD;
    faces(sat[q] - ux * OVER.behind, sat[q + 1] - uy * OVER.behind, sat[q + 2] - uz * OVER.behind, ux, uy, uz, OVER.ahead + OVER.behind, (c, g, b) => {
      covered[k] = 1;
      let has = 0;
      for (let v = 0; v < 3; v++) { const o = g[v] * 3; has += b[v] * (c.push[o] * ux + c.push[o + 1] * uy + c.push[o + 2] * uz); }
      const short = need - has;
      if (short <= 0) return;
      for (let v = 0; v < 3; v++) { const o = g[v] * 3; c.push[o] += short * ux; c.push[o + 1] += short * uy; c.push[o + 2] += short * uz; }
      c.moved = true;
    });
  }
  // cloth over cloth (the pants over the jersey's tucked hem, a wristband over a sleeve): the outer gains at least
  // what the inner does under it
  for (const a of cloths) for (let id = 0; id < a.G; id++) {
    const o = id * 3, l = Math.sqrt(a.push[o] ** 2 + a.push[o + 1] ** 2 + a.push[o + 2] ** 2);
    if (l < TAIL) continue;
    const ux = a.push[o] / l, uy = a.push[o + 1] / l, uz = a.push[o + 2] / l, need = l + FLOOR_ADD / 2;
    faces(a.at[o] - ux * OVER.behind / 2, a.at[o + 1] - uy * OVER.behind / 2, a.at[o + 2] - uz * OVER.behind / 2, ux, uy, uz, OVER.side, (c, g, b) => {
      if (c === a) return;
      let has = 0;
      for (let v = 0; v < 3; v++) { const q = g[v] * 3; has += b[v] * (c.push[q] * ux + c.push[q + 1] * uy + c.push[q + 2] * uz); }
      const short = need - has;
      if (short <= 0) return;
      for (let v = 0; v < 3; v++) { const q = g[v] * 3; c.push[q] += short * ux; c.push[q + 1] += short * uy; c.push[q + 2] += short * uz; }
      c.moved = true;
    });
  }
  // the covered skin tucked in, by how far it is from moving skin no cloth covers
  let m = 0;
  for (let k = 0; k < n; k++) if (!covered[k]) m++;
  const bare = new Float32Array(m * 3);
  for (let k = 0, j = 0; k < n; k++) if (!covered[k]) bare.set(sat.subarray(k * 3, k * 3 + 3), 3 * j++);
  const nearBare = grid(bare, m, TUCK_EDGE[1]);
  for (let k = 0; k < n; k++) {
    if (!covered[k]) continue;
    const q = k * 3, x = sat[q], y = sat[q + 1], z = sat[q + 2];
    let d2 = TUCK_EDGE[1] * TUCK_EDGE[1];
    nearBare(x, y, z, j => { const r = j * 3, dx = bare[r] - x, dy = bare[r + 1] - y, dz = bare[r + 2] - z; d2 = Math.min(d2, dx * dx + dy * dy + dz * dz); });
    const f = 1 - (1 - TUCK) * smooth(TUCK_EDGE[0], TUCK_EDGE[1], Math.sqrt(d2)), [s, o] = sref[k];
    s.push[o] *= f; s.push[o + 1] *= f; s.push[o + 2] *= f;
  }
}

/** A mesh's sculpted position and normal arrays (its attribute space), from its pushes. */
function finish(s) {
  const {M, n, weld, G, push, count} = s, back = inverse3(M.e); // (the model's space back to the attribute's)
  const pos = unpack(M.pos), nor = unpack(M.nor), position = pos.slice(), normal = nor.slice(), moved = new Uint8Array(G);
  for (let id = 0; id < G; id++) {
    const o = id * 3, x = push[o], y = push[o + 1], z = push[o + 2];
    if (x * x + y * y + z * z < TAIL * TAIL) continue;
    moved[id] = 1;
    push[o] = back[0] * x + back[3] * y + back[6] * z; push[o + 1] = back[1] * x + back[4] * y + back[7] * z; push[o + 2] = back[2] * x + back[5] * y + back[8] * z;
  }
  for (let i = 0; i < n; i++) {
    const id = weld[i];
    if (id < 0 || !moved[id]) continue;
    const p = i * 3, o = id * 3;
    position[p] += push[o]; position[p + 1] += push[o + 1]; position[p + 2] += push[o + 2];
  }
  // Normals: the welded, area-weighted smooth normal before and after (from every face round a vertex a muscle
  // reaches); each original normal turned by its change.
  const index = M.index, tris = index ? index.length : n, before = new Float64Array(G * 3), after = new Float64Array(G * 3);
  const face = (arr, out, v0, v1, v2, g0, g1, g2) => {
    const i0 = v0 * 3, i1 = v1 * 3, i2 = v2 * 3;
    const ax = arr[i1] - arr[i0], ay = arr[i1 + 1] - arr[i0 + 1], az = arr[i1 + 2] - arr[i0 + 2];
    const bx = arr[i2] - arr[i0], by = arr[i2 + 1] - arr[i0 + 1], bz = arr[i2 + 2] - arr[i0 + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (g0 >= 0) { out[g0 * 3] += cx; out[g0 * 3 + 1] += cy; out[g0 * 3 + 2] += cz; }
    if (g1 >= 0) { out[g1 * 3] += cx; out[g1 * 3 + 1] += cy; out[g1 * 3 + 2] += cz; }
    if (g2 >= 0) { out[g2 * 3] += cx; out[g2 * 3 + 1] += cy; out[g2 * 3 + 2] += cz; }
  };
  for (let k = 0; k < tris; k += 3) {
    const v0 = index ? index[k] : k, v1 = index ? index[k + 1] : k + 1, v2 = index ? index[k + 2] : k + 2;
    const g0 = weld[v0], g1 = weld[v1], g2 = weld[v2];
    if (g0 < 0 && g1 < 0 && g2 < 0) continue;
    face(pos, before, v0, v1, v2, g0, g1, g2); face(position, after, v0, v1, v2, g0, g1, g2);
  }
  // A group whose members' normals agree (no deliberate hard edge) shares one, so a moved seam stays smooth.
  const mean = new Float64Array(G * 3), agree = new Uint8Array(G).fill(1);
  for (let i = 0; i < n; i++) { const id = weld[i]; if (id >= 0) { const p = i * 3, o = id * 3; mean[o] += nor[p]; mean[o + 1] += nor[p + 1]; mean[o + 2] += nor[p + 2]; } }
  for (let i = 0; i < n; i++) {
    const id = weld[i];
    if (id < 0 || count[id] < 2 || !agree[id]) continue;
    const p = i * 3, o = id * 3;
    const ml = Math.sqrt(mean[o] * mean[o] + mean[o + 1] * mean[o + 1] + mean[o + 2] * mean[o + 2]) || 1;
    const nl = Math.sqrt(nor[p] * nor[p] + nor[p + 1] * nor[p + 1] + nor[p + 2] * nor[p + 2]) || 1;
    if ((mean[o] * nor[p] + mean[o + 1] * nor[p + 1] + mean[o + 2] * nor[p + 2]) / ml / nl < .9) agree[id] = 0;
  }
  for (let i = 0; i < n; i++) {
    const id = weld[i];
    if (id < 0) continue;
    const p = i * 3, o = id * 3;
    let vx = nor[p], vy = nor[p + 1], vz = nor[p + 2];
    if (moved[id] && agree[id] && count[id] > 1) { vx = mean[o]; vy = mean[o + 1]; vz = mean[o + 2]; }
    const al = Math.sqrt(before[o] * before[o] + before[o + 1] * before[o + 1] + before[o + 2] * before[o + 2]);
    const bl = Math.sqrt(after[o] * after[o] + after[o + 1] * after[o + 1] + after[o + 2] * after[o + 2]);
    if (al > 1e-20 && bl > 1e-20) {
      const ax = before[o] / al, ay = before[o + 1] / al, az = before[o + 2] / al, bx = after[o] / bl, by = after[o + 1] / bl, bz = after[o + 2] / bl;
      const c = ax * bx + ay * by + az * bz;
      if (c > -.999 && c < 1 - 1e-12) { // (v turned as a is to b: v c + k x v + k (k.v) / (1 + c), k = a x b)
        const kx = ay * bz - az * by, ky = az * bx - ax * bz, kz = ax * by - ay * bx, kv = (kx * vx + ky * vy + kz * vz) / (1 + c);
        const rx = vx * c + ky * vz - kz * vy + kx * kv, ry = vy * c + kz * vx - kx * vz + ky * kv, rz = vz * c + kx * vy - ky * vx + kz * kv;
        vx = rx; vy = ry; vz = rz;
      }
    }
    const l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    normal[p] = vx / l; normal[p + 1] = vy / l; normal[p + 2] = vz / l;
  }
  return {position, normal};
}

/** The whole sculpt of a job (from job()): each mesh's {position, normal}, or null where nothing moved; and how long
 *  it took (ms). */
function sculpt({meshes, F}) {
  const t0 = Date.now(), parts = meshes.map(M => M && measure(M, F)), live = parts.filter(Boolean);
  live.forEach(s => { if (!s.skin) smoothCloth(s); });
  overSkin(live);
  live.forEach(s => padded(s, F)); // (last, skin and cloth alike: so a sleeve under a pad's rim and its hem don't part)
  return {results: parts.map(s => (s && s.moved ? finish(s) : null)), ms: Date.now() - t0};
}

// The worker: started from this same file (below), it sculpts the job it's sent and sends back the arrays.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = ({data}) => {
    try {
      const out = sculpt(data);
      self.postMessage(out, out.results.flatMap(r => (r ? [r.position.buffer, r.normal.buffer] : [])));
    } catch (error) { self.postMessage({error: String(error?.message || error)}); }
  };
}

// ---------------------------------------------------------------------------- In the page
const bare = name => name.replace(/^mixamorig:?/, '').replace(/^xtra_(.+)_\d+$/, '$1');
const packed = ([t0, sb, sa, th, k, h]) => [t0, sb, sa, Math.cos(th * D2R), Math.sin(th * D2R), k, h];
/** The limb bones' frames in the model's space (left and right; names alongside): joint, axis, length, front, outer;
 *  and the pads. */
function frames(P, T, inv) {
  const limbs = [], names = [], wp = n => P.B[n].getWorldPosition(new T.Vector3()).applyMatrix4(inv);
  for (const side of ['Left', 'Right']) for (const [name, spec] of Object.entries(LIMBS)) {
    if (!P.B[side + name] || !P.B[side + spec.to]) continue;
    const j = wp(side + name), a = wp(side + spec.to).sub(j), L = a.length();
    a.normalize();
    const f = new T.Vector3(0, 0, 1).addScaledVector(a, -a.z).normalize();
    const o = new T.Vector3(side === 'Left' ? 1 : -1, 0, 0);
    o.addScaledVector(a, -o.dot(a)).addScaledVector(f, -o.dot(f)).normalize();
    const scale = spec.scale?.[side];
    names.push(side + name);
    limbs.push({jx: j.x, jy: j.y, jz: j.z, ax: a.x, ay: a.y, az: a.z, L, fx: f.x, fy: f.y, fz: f.z, ox: o.x, oy: o.y, oz: o.z,
      m: Float64Array.from(spec.m.flatMap((x, i) => packed(scale ? [...x.slice(0, 5), x[5] * scale[i]] : x))),
      ease: Float64Array.from((spec.ease || []).flatMap(packed))});
  }
  const pads = ['Left', 'Right'].filter(side => P.B[side + 'Arm']).map(side => {
    const c = wp(side + 'Arm');
    return {x: c.x + (side === 'Left' ? 1 : -1) * PADS.at[0], y: c.y + PADS.at[1], z: c.z + PADS.at[2], rx: PADS.r[0], ry: PADS.r[1], rz: PADS.r[2]};
  });
  return {limbs, names, pads};
}
/** An attribute as the arithmetic reads it (its array copied out, once a job: copies): value(i, c) =
 *  src[i * stride + off + c] * scale. */
function attr(a, copies) {
  const inter = !!a.isInterleavedBufferAttribute, from = inter ? a.data.array : a.array;
  if (!copies.has(from)) copies.set(from, from.slice());
  const src = copies.get(from);
  const scale = !a.normalized ? 1 : src instanceof Int8Array ? 1 / 127 : src instanceof Uint8Array ? 1 / 255
    : src instanceof Int16Array ? 1 / 32767 : src instanceof Uint16Array ? 1 / 65535 : 1;
  return {src, stride: inter ? a.data.stride : a.itemSize, off: inter ? a.offset : 0, scale, count: a.count, size: a.itemSize,
    floor: a.normalized && (src instanceof Int8Array || src instanceof Int16Array) ? -1 : -Infinity};
}
/** What the sculpt needs of each of his meshes besides its arrays, read in the bind pose (so at once): its bones'
 *  fields and its space; null for a mesh it leaves alone. */
function plan(meshes, F, inv) {
  return meshes.map(mesh => {
    const g = mesh.geometry, A = g.attributes;
    if (!A.position || !A.normal || !A.skinIndex || !A.skinWeight || !mesh.skeleton || mesh.material?.name === CLEATS) return null;
    const bones = mesh.skeleton.bones;
    // Each bone's field: -1 none (hands, feet, head), 0 the torso, else 1 + its limb's place in the list.
    const kind = Int32Array.from(bones, b => { const k = bare(b.name); return TORSO.has(k) ? 0 : F.names.indexOf(k) + 1 || -1; });
    // Attribute space to the model's: the same through every bone in the bind pose (the quantization's scale and offset).
    const best = A.skinIndex.getX(0);
    const e = Float64Array.from(inv.clone().multiply(bones[best].matrixWorld).multiply(mesh.skeleton.boneInverses[best]).elements);
    return {g, kind, e, skin: mesh.material?.name === SKIN};
  });
}
/** The job (plain data, for a worker or the page) from plans: each mesh's arrays copied out of its geometry (which
 *  never changes), so their buffers can be handed to a worker. */
function job(plans, F) {
  const copies = new Map(), indices = [];
  const work = {F: {limbs: F.limbs, pads: F.pads}, meshes: plans.map(p => {
    if (!p) return null;
    const A = p.g.attributes, index = p.g.index ? p.g.index.array.slice() : null;
    if (index) indices.push(index);
    return {pos: attr(A.position, copies), nor: attr(A.normal, copies), si: attr(A.skinIndex, copies), sw: attr(A.skinWeight, copies),
      kind: p.kind, e: p.e, index, skin: p.skin};
  })};
  return {work, buffers: [...copies.values(), ...indices].map(a => a.buffer)};
}
/** The job's results (make: a fresh job): from a worker (this same file), or here if one can't start or fails. */
function run(make) {
  const here = () => new Promise((resolve, reject) => setTimeout(() => { try { resolve(sculpt(make().work)); } catch (e) { reject(e); } }));
  if (typeof Worker === 'undefined') return here();
  return new Promise((resolve, reject) => {
    let w;
    try { w = new Worker(new URL(import.meta.url), {type: 'module'}); } catch (_) { here().then(resolve, reject); return; }
    let over = false;
    const fallback = () => { if (over) return; over = true; w.terminate(); here().then(resolve, reject); };
    w.onmessage = ({data}) => { if (over) return; if (data.error) { fallback(); return; } over = true; w.terminate(); resolve(data); };
    w.onerror = event => { event.preventDefault?.(); fallback(); };
    w.onmessageerror = fallback;
    const {work, buffers} = make();
    w.postMessage(work, buffers); // (handed over, not copied: the page's are fresh copies of his)
  });
}

const CACHE = new WeakMap(); // source geometry -> {position, normal} (Float32Arrays) | null (nothing moved)
const JOBS = new WeakMap();  // his first mesh's source geometry -> the sculpt under way (the ghost waits on the returner's)
const WORN = new WeakMap();  // source geometry -> {geometry (sculpted), users}: the returner and the ghost wear one
/** The sculpted geometry for source (baked: its arrays): the source's own index, UVs and skin weights with the new
 *  positions and normals; one for everyone wearing it. */
function wear(T, source, baked) {
  let w = WORN.get(source);
  if (!w) {
    const g = new T.BufferGeometry();
    g.setIndex(source.index);
    for (const [name, a] of Object.entries(source.attributes)) {
      g.setAttribute(name, name === 'position' ? new T.BufferAttribute(baked.position, 3) : name === 'normal' ? new T.BufferAttribute(baked.normal, 3) : a);
    }
    for (const {start, count, materialIndex} of source.groups) g.addGroup(start, count, materialIndex);
    g.setDrawRange(source.drawRange.start, source.drawRange.count);
    g.name = (source.name || 'player') + '-bulk';
    w = {geometry: g, users: 0};
    WORN.set(source, w);
  }
  w.users++;
  return w.geometry;
}
/** Done wearing source's sculpted geometry: the last one out lets it go (its own positions and normals only: the index
 *  and the rest are the source's, still drawn on the base players, so they're taken off it first). */
function unwear(source) {
  const w = WORN.get(source);
  if (!w || --w.users > 0) return;
  WORN.delete(source);
  const g = w.geometry;
  g.setIndex(null);
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  g.dispose();
}

/** Sculpts P (a dress() player in its bind pose; T: three.js): returns undo() at once; the sculpted geometry goes in
 *  when the sculpt's done (at once if it's done already). On a failure he keeps his build as it was (the rest of the
 *  kit goes on) and the reason's logged. */
export function bulkUp(P, T) {
  const done = [], ball = P.ball, ballAt = ball ? ball.position.clone() : null;
  let live = true, settle = () => {};
  const undo = () => {
    live = false; settle(false);
    for (const [mesh, original] of done.splice(0)) { mesh.geometry = original; unwear(original); }
    if (ball) ball.position.copy(ballAt);
  };
  undo.ready = new Promise(resolve => { settle = resolve; });
  try {
    P.model.updateWorldMatrix(true, true);
    const inv = P.model.matrixWorld.clone().invert(), F = frames(P, T, inv), meshes = [];
    P.model.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    // The ball rides on his right forearm: out, straight away from it, by the most the forearm gained under the ball
    // (along its length and a little round either side).
    let ballTo = null;
    const fore = F.limbs[F.names.indexOf('RightForeArm')];
    if (ball && fore && ball.parent) {
      ball.updateWorldMatrix(true, false);
      const c = ball.getWorldPosition(new T.Vector3()).applyMatrix4(inv), a = new T.Vector3(fore.ax, fore.ay, fore.az);
      const j = new T.Vector3(fore.jx, fore.jy, fore.jz), axis = j.clone().addScaledVector(a, c.clone().sub(j).dot(a));
      const out = c.clone().sub(axis), r = out.length();
      if (r > 1e-6) {
        out.divideScalar(r);
        const side = a.clone().cross(out), p = new T.Vector3();
        let gain = 0;
        for (const s of [-.1, -.05, 0, .05, .1]) for (const phi of [-.6, 0, .6]) {
          p.copy(axis).addScaledVector(a, s).addScaledVector(out, r * Math.cos(phi)).addScaledVector(side, r * Math.sin(phi));
          gain = Math.max(gain, limb(fore, p.x, p.y, p.z));
        }
        if (gain > 0) ballTo = ball.parent.worldToLocal(c.addScaledVector(out, gain).applyMatrix4(P.model.matrixWorld));
      }
    }
    const sources = meshes.map(m => m.geometry);
    const apply = results => {
      if (!live) return;
      meshes.forEach((mesh, i) => {
        const baked = results[i];
        if (!baked || mesh.geometry !== sources[i]) return;
        mesh.geometry = wear(T, sources[i], baked); done.push([mesh, sources[i]]);
      });
      if (ballTo) ball.position.copy(ballTo);
      settle(true);
    };
    if (sources.every(g => CACHE.has(g))) { apply(sources.map(g => CACHE.get(g))); return undo; }
    let pending = JOBS.get(sources[0]);
    if (!pending) {
      const plans = plan(meshes, F, inv);
      pending = run(() => job(plans, F)).then(({results}) => {
        sources.forEach((g, i) => CACHE.set(g, results[i] || null));
        return results;
      });
      JOBS.set(sources[0], pending);
      pending.catch(() => JOBS.delete(sources[0]));
    }
    pending.then(apply, error => {
      if (live) console.warn('Return Man: his build kept as it was', error);
      settle(false);
    });
    return undo;
  } catch (error) {
    undo();
    console.warn('Return Man: his build kept as it was', error);
    return undo;
  }
}
