// Reading the owner's Unity asset packs (D:\Unity\My project\Assets) without Unity: the models (binary FBX 7.x, ASCII
// FBX 6.1 and 7.x, Blockbench OBJ), their pictures (PNG, and the composite image a PSD keeps) and the Unity materials
// that join the two (.mat by .meta guid). Read-only: nothing in the Unity project is written.
// Exports: model(file) -> {meshes: [{name, matrix, pos, polys, uv, mats, cols}], materials, up}; image(file) -> {w, h,
// data (RGBA bytes)}; unityIndex(dir) -> guid lookup; material(index, name | file) -> {color, tex, scale, offset, glow}.
import fs from 'node:fs';
import path from 'node:path';
import {inflateSync} from 'node:zlib';

// ============================================================================ FBX: one tree for every flavour
// Each node {name, props: [...], kids: [...]}; arrays come out as plain JS arrays or typed arrays.
function fbxBinary(buf) {
  const ver = buf.readUInt32LE(23), wide = ver >= 7500;
  let at = 27;
  const u = () => { const v = wide ? Number(buf.readBigUInt64LE(at)) : buf.readUInt32LE(at); at += wide ? 8 : 4; return v; };
  function prop() {
    const t = String.fromCharCode(buf[at++]);
    switch (t) {
      case 'Y': at += 2; return buf.readInt16LE(at - 2);
      case 'C': return !!buf[at++];
      case 'I': at += 4; return buf.readInt32LE(at - 4);
      case 'F': at += 4; return buf.readFloatLE(at - 4);
      case 'D': at += 8; return buf.readDoubleLE(at - 8);
      case 'L': at += 8; return buf.readBigInt64LE(at - 8);
      case 'S': case 'R': { const n = buf.readUInt32LE(at); at += 4 + n; const b = buf.subarray(at - n, at); return t === 'S' ? b.toString('latin1') : b; }
      default: {
        const n = buf.readUInt32LE(at), enc = buf.readUInt32LE(at + 4), len = buf.readUInt32LE(at + 8); at += 12;
        let raw = buf.subarray(at, at + len); at += len;
        if (enc) raw = inflateSync(raw);
        const b = Buffer.from(raw), size = {f: 4, d: 8, l: 8, i: 4, b: 1}[t];
        if (!size) throw new Error('FBX: unknown property type ' + t);
        const out = new Array(n);
        for (let i = 0; i < n; i++) {
          const o = i * size;
          out[i] = t === 'f' ? b.readFloatLE(o) : t === 'd' ? b.readDoubleLE(o) : t === 'i' ? b.readInt32LE(o) : t === 'l' ? Number(b.readBigInt64LE(o)) : !!b[o];
        }
        return out;
      }
    }
  }
  function node() {
    const end = u(), np = u(); u();
    const nl = buf[at++], name = buf.toString('latin1', at, at + nl); at += nl;
    if (end === 0) return null;
    const props = []; for (let i = 0; i < np; i++) props.push(prop());
    const kids = [];
    while (at < end) { const k = node(); if (!k) break; kids.push(k); }
    at = end;
    return {name, props, kids};
  }
  const kids = [];
  while (at < buf.length - 13) { const k = node(); if (!k) break; kids.push(k); }
  return {ver, kids};
}
function fbxAscii(text) {
  let at = 0;
  const n = text.length, ws = c => c === ' ' || c === '\t' || c === '\r' || c === '\n';
  function skip() {
    for (;;) {
      while (at < n && ws(text[at])) at++;
      if (text[at] === ';') { while (at < n && text[at] !== '\n') at++; continue; }
      return;
    }
  }
  // A token: a key (word:), a string, a number or bare word, or one of { } , *
  function token() {
    skip();
    if (at >= n) return null;
    const c = text[at];
    if (c === '{' || c === '}' || c === ',') { at++; return {t: c}; }
    if (c === '"') { const e = text.indexOf('"', at + 1); const s = text.slice(at + 1, e); at = e + 1; return {t: 'v', v: s}; }
    if (c === '*') { at++; const m = /^\d+/.exec(text.slice(at, at + 20)); at += m[0].length; return {t: '*', v: +m[0]}; }
    let e = at; while (e < n && !ws(text[e]) && !'{},:'.includes(text[e])) e++;
    const w = text.slice(at, e); at = e;
    if (text[at] === ':') { at++; return {t: 'k', v: w}; }
    const num = Number(w);
    return {t: 'v', v: w !== '' && !Number.isNaN(num) ? num : w};
  }
  let peeked = null;
  const peek = () => (peeked || (peeked = token()));
  const next = () => { const t = peek(); peeked = null; return t; };
  function nodeBody(name) {
    const props = [], kids = [];
    let star = false;
    for (;;) {
      const t = peek();
      if (!t || t.t === 'k' || t.t === '}' ) break;
      if (t.t === '{') {
        next();
        while (peek() && peek().t !== '}') { const k = next(); kids.push(nodeBody(k.v)); }
        next();
        break;
      }
      next();
      if (t.t === '*') { star = true; continue; }
      if (t.t === ',') continue;
      props.push(t.v);
    }
    // (7.x arrays: Vertices: *N { a: 1,2,3 })
    if (star && kids.length === 1 && kids[0].name === 'a') return {name, props: [kids[0].props], kids: []};
    return {name, props, kids};
  }
  const kids = [];
  while (peek()) { const k = next(); if (k.t !== 'k') continue; kids.push(nodeBody(k.v)); }
  const m = /FBX (\d)\.(\d)/.exec(text.slice(0, 200));
  return {ver: m ? +m[1] * 1000 + +m[2] * 100 : 7300, kids};
}
const kid = (nd, name) => nd && nd.kids.find(k => k.name === name);
const kidsOf = (nd, name) => (nd ? nd.kids.filter(k => k.name === name) : []);
const arr = nd => { if (!nd) return null; const p = nd.props; return p.length === 1 && Array.isArray(p[0]) ? p[0] : p; };
const idOf = v => String(v);
const nameOf = s => String(s).split('\u0000\u0001')[0].replace(/^[A-Za-z]+::/, '');

// FBX's 4x4s as plain column-major arrays (as three.js keeps them)
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
const T4 = ([x, y, z]) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const S4 = ([x, y, z]) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
// An FBX euler (degrees), rotation order XYZ (X first): R = Rz * Ry * Rx
function R4([x, y, z], order = 0) {
  const r = d => d * Math.PI / 180, cx = Math.cos(r(x)), sx = Math.sin(r(x)), cy = Math.cos(r(y)), sy = Math.sin(r(y)), cz = Math.cos(r(z)), sz = Math.sin(r(z));
  const X = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1], Y = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1], Z = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const seq = {0: [Z, Y, X], 1: [Y, Z, X], 2: [Z, X, Y], 3: [X, Z, Y], 4: [Y, X, Z], 5: [X, Y, Z]}[order] || [Z, Y, X];
  return mul(mul(seq[0], seq[1]), seq[2]);
}
function inv(m) {
  // (affine only)
  const [a, b, c, , d, e, f, , g, h, i] = m, det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const r = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, 0, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, 0,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det, 0, 0, 0, 0, 1];
  const t = [m[12], m[13], m[14]];
  r[12] = -(r[0] * t[0] + r[4] * t[1] + r[8] * t[2]); r[13] = -(r[1] * t[0] + r[5] * t[1] + r[9] * t[2]); r[14] = -(r[2] * t[0] + r[6] * t[1] + r[10] * t[2]);
  return r;
}
export const mat4 = {mul, inv, T4, S4, R4, I4};

/** A Properties70 (7.x) or Properties60 (6.1) block as {name: [values]}. */
function propsOf(nd) {
  const o = {};
  for (const block of [kid(nd, 'Properties70'), kid(nd, 'Properties60')]) {
    if (!block) continue;
    for (const p of block.kids) {
      const v = p.props;
      if (block.name === 'Properties70') o[v[0]] = v.slice(4);
      else o[v[0]] = v.slice(3);
    }
  }
  return o;
}
function localOf(p) {
  const v = (k, d) => (p[k] && p[k].length >= 3 ? p[k].slice(0, 3).map(Number) : d), z = [0, 0, 0], one = [1, 1, 1];
  const order = p.RotationOrder ? +p.RotationOrder[0] : 0;
  const Rp = v('RotationPivot', z), Sp = v('ScalingPivot', z);
  let m = T4(v('Lcl Translation', z));
  m = mul(m, T4(v('RotationOffset', z))); m = mul(m, T4(Rp));
  m = mul(m, R4(v('PreRotation', z))); m = mul(m, R4(v('Lcl Rotation', z), order)); m = mul(m, inv(R4(v('PostRotation', z))));
  m = mul(m, T4(Rp.map(x => -x))); m = mul(m, T4(v('ScalingOffset', z))); m = mul(m, T4(Sp));
  m = mul(m, S4(v('Lcl Scaling', one))); m = mul(m, T4(Sp.map(x => -x)));
  const geo = mul(mul(T4(v('GeometricTranslation', z)), R4(v('GeometricRotation', z))), S4(v('GeometricScaling', one)));
  return {m, geo};
}
/** A mesh's own data (Vertices, PolygonVertexIndex, its first UV set, its material per polygon, vertex colours). */
function meshData(g) {
  const pos = arr(kid(g, 'Vertices')).map(Number), pvi = arr(kid(g, 'PolygonVertexIndex')).map(Number);
  const polys = []; let cur = [];
  pvi.forEach((v, k) => { if (v < 0) { cur.push({v: ~v, k}); polys.push(cur); cur = []; } else cur.push({v, k}); });
  const layer = (name) => kidsOf(g, name).sort((a, b) => (+a.props[0] || 0) - (+b.props[0] || 0))[0];
  const mapped = (L, values, idxName, width) => {
    if (!L) return null;
    const how = String(arr(kid(L, 'MappingInformationType'))[0]), ref = String(arr(kid(L, 'ReferenceInformationType'))[0]);
    const vals = arr(kid(L, values)).map(Number), idx = kid(L, idxName) ? arr(kid(L, idxName)).map(Number) : null;
    return (poly, corner) => {
      const c = polys[poly][corner];
      let i = /Vert(ex|ice)|ControlPoint/.test(how) && !/Polygon/.test(how) ? c.v : how === 'ByPolygon' ? poly : how === 'AllSame' ? 0 : c.k;
      if (/Index/.test(ref) && idx) i = idx[i];
      return vals.slice(i * width, i * width + width);
    };
  };
  const uv = mapped(layer('LayerElementUV'), 'UV', 'UVIndex', 2);
  const colors = mapped(layer('LayerElementColor'), 'Colors', 'ColorIndex', 4);
  const LM = layer('LayerElementMaterial');
  let mats = () => 0;
  if (LM) {
    const how = String(arr(kid(LM, 'MappingInformationType'))[0]), m = arr(kid(LM, 'Materials')).map(Number);
    mats = how === 'AllSame' ? () => m[0] || 0 : poly => m[poly] || 0;
  }
  return {pos, polys, uv, colors, mats};
}
const axisOf = gs => {
  const p = propsOf(gs || {kids: []}), n = (k, d) => (p[k] ? +p[k][0] : d);
  const up = n('UpAxis', 1), us = n('UpAxisSign', 1), fr = n('FrontAxis', 2), fs = n('FrontAxisSign', 1), co = n('CoordAxis', 0), cs = n('CoordAxisSign', 1);
  // target x, y, z = file[co]*cs, file[up]*us, file[fr]*fs (column-major: column j is where file axis j goes)
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  m[co * 4] = cs; m[up * 4 + 1] = us; m[fr * 4 + 2] = fs;
  return {m, unit: n('UnitScaleFactor', 1)};
};

/** The meshes in an FBX: [{name, matrix (to the file's world, Y up), mesh data, materials: [{name, color, tex}]}]. */
function fbxModel(file) {
  const buf = fs.readFileSync(file);
  const tree = buf.toString('latin1', 0, 18) === 'Kaydara FBX Binary' ? fbxBinary(buf) : fbxAscii(buf.toString('latin1'));
  const top = name => tree.kids.find(k => k.name === name);
  const axis = axisOf(top('GlobalSettings'));
  const objects = top('Objects'), conns = top('Connections');
  const out = [];
  if (tree.ver < 7000) {
    // 6.1: names are ids; a Model holds its mesh; Connect: "OO", child, parent
    const models = new Map(), mats = new Map(), parent = new Map(), matOf = new Map(), texOf = new Map();
    for (const o of objects.kids) {
      const nm = String(o.props[0]);
      if (o.name === 'Model') models.set(nm, o);
      else if (o.name === 'Material') mats.set(nm, o);
      else if (o.name === 'Texture') texOf.set(nm, o);
    }
    for (const c of kidsOf(conns, 'Connect')) {
      const [type, child, par] = c.props.map(String);
      if (type !== 'OO') continue;
      if (models.has(child) && models.has(par)) parent.set(child, par);
      else if (mats.has(child) && models.has(par)) { if (!matOf.has(par)) matOf.set(par, []); matOf.get(par).push(child); }
    }
    const world = nm => { const o = models.get(nm), l = localOf(propsOf(o)).m; return parent.has(nm) ? mul(world(parent.get(nm)), l) : l; };
    for (const [nm, o] of models) {
      if (!kid(o, 'Vertices')) continue;
      const {geo} = localOf(propsOf(o));
      const materials = (matOf.get(nm) || []).map(m => { const p = propsOf(mats.get(m)); return {name: nameOf(m), color: (p.DiffuseColor || p.Diffuse || [.8, .8, .8]).slice(0, 3).map(Number)}; });
      out.push({name: nameOf(nm), matrix: mul(mul(axis.m, world(nm)), geo), data: meshData(o), materials});
    }
    void texOf;
  } else {
    const byId = new Map();
    for (const o of objects.kids) byId.set(idOf(o.props[0]), o);
    const parent = new Map(), children = new Map();
    for (const c of kidsOf(conns, 'C')) {
      const [type, a, b, prop] = c.props;
      const child = idOf(a), par = idOf(b);
      if (!children.has(par)) children.set(par, []);
      children.get(par).push({id: child, type: String(type), prop});
      if (String(type) === 'OO' && byId.get(child) && byId.get(child).name === 'Model') parent.set(child, par);
    }
    const world = id => { const o = byId.get(id); if (!o || o.name !== 'Model') return I4(); const l = localOf(propsOf(o)).m; return parent.has(id) ? mul(world(parent.get(id)), l) : l; };
    for (const [id, o] of byId) {
      if (o.name !== 'Model') continue;
      const kids = (children.get(id) || []).map(c => ({...c, o: byId.get(c.id)})).filter(c => c.o);
      const g = kids.find(c => c.o.name === 'Geometry' && String(c.o.props[2]) === 'Mesh');
      if (!g) continue;
      const materials = kids.filter(c => c.o.name === 'Material').map(c => {
        const p = propsOf(c.o), tex = (children.get(c.id) || []).map(t => byId.get(t.id)).find(t => t && t.name === 'Texture');
        const tfile = tex ? String((arr(kid(tex, 'RelativeFilename')) || arr(kid(tex, 'FileName')) || [''])[0]) : '';
        return {name: nameOf(c.o.props[1]), color: (p.DiffuseColor || p.Diffuse || [.8, .8, .8]).slice(0, 3).map(Number), tex: tfile};
      });
      const {geo} = localOf(propsOf(o));
      out.push({name: nameOf(o.props[1]), matrix: mul(mul(axis.m, world(id)), geo), data: meshData(g.o), materials});
    }
  }
  return {meshes: out, unit: axis.unit};
}

// ============================================================================ OBJ (Blockbench's: v, vt, f, usemtl)
function objModel(file) {
  const v = [], vt = [], polys = [], uvs = [], matNames = [], polyMat = [];
  let mat = 0;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') v.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'vt') vt.push(+p[1], +p[2]);
    else if (p[0] === 'usemtl') { mat = matNames.indexOf(p[1]); if (mat < 0) { matNames.push(p[1]); mat = matNames.length - 1; } }
    else if (p[0] === 'f') {
      const poly = [], uv = [];
      for (const c of p.slice(1)) {
        const [a, b] = c.split('/').map(x => (x ? parseInt(x, 10) : 0));
        const vi = a < 0 ? v.length / 3 + a : a - 1, ti = b < 0 ? vt.length / 2 + b : b - 1;
        poly.push({v: vi, k: 0}); uv.push(b ? [vt[ti * 2], vt[ti * 2 + 1]] : [0, 0]);
      }
      polys.push(poly); uvs.push(uv); polyMat.push(Math.max(0, mat));
    }
  }
  const data = {pos: v, polys, uv: (poly, corner) => uvs[poly][corner], colors: null, mats: poly => polyMat[poly]};
  return {meshes: [{name: path.basename(file, '.obj'), matrix: I4(), data, materials: (matNames.length ? matNames : ['default']).map(name => ({name, color: [1, 1, 1]}))}], unit: 1};
}

export function model(file) {
  return /\.obj$/i.test(file) ? objModel(file) : fbxModel(file);
}

// ============================================================================ Pictures
/** A PNG's pixels (8-bit RGBA; not interlaced). */
function png(buf) {
  let at = 8, w = 0, h = 0, depth = 8, type = 6, pal = null, trns = null;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), t = buf.toString('latin1', at + 4, at + 8), d = buf.subarray(at + 8, at + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; if (d[12]) throw new Error('PNG: interlaced'); }
    else if (t === 'PLTE') pal = d;
    else if (t === 'tRNS') trns = d;
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    at += 12 + len;
  }
  const ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[type], bits = ch * depth, bpp = Math.max(1, bits >> 3), stride = Math.ceil(w * bits / 8);
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0, b = y ? px[row - stride + x] : 0, c = x >= bpp && y ? px[row - stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + x] = v & 255;
    }
  }
  const data = new Uint8Array(w * h * 4);
  const sample = (y, i) => {
    // the i-th sample of row y, scaled to 8 bits
    if (depth === 16) return px[y * stride + i * 2];
    if (depth === 8) return px[y * stride + i];
    const per = 8 / depth, byte = px[y * stride + Math.floor(i / per)], shift = 8 - depth * (i % per + 1);
    const v = (byte >> shift) & ((1 << depth) - 1);
    return type === 3 ? v : Math.round(v * 255 / ((1 << depth) - 1));
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (type === 3) { const k = sample(y, x); data[o] = pal[k * 3]; data[o + 1] = pal[k * 3 + 1]; data[o + 2] = pal[k * 3 + 2]; data[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (type === 0 || type === 4) { const g = sample(y, x * ch); data[o] = data[o + 1] = data[o + 2] = g; data[o + 3] = type === 4 ? sample(y, x * ch + 1) : 255; }
    else { for (let c = 0; c < 3; c++) data[o + c] = sample(y, x * ch + c); data[o + 3] = type === 6 ? sample(y, x * ch + 3) : 255; }
  }
  return {w, h, data};
}
/** A PSD's merged image (8-bit RGB(A), raw or PackBits). */
function psd(buf) {
  if (buf.toString('latin1', 0, 4) !== '8BPS') throw new Error('PSD: not a PSD');
  const chans = buf.readUInt16BE(12), h = buf.readUInt32BE(14), w = buf.readUInt32BE(18), depth = buf.readUInt16BE(22), mode = buf.readUInt16BE(24);
  if (depth !== 8 || (mode !== 3 && mode !== 1)) throw new Error('PSD: only 8-bit RGB/grey');
  let at = 26;
  for (let k = 0; k < 3; k++) at += 4 + buf.readUInt32BE(at); // colour mode data, image resources, layers
  const comp = buf.readUInt16BE(at); at += 2;
  const planes = [], n = w * h;
  if (comp === 0) for (let c = 0; c < chans; c++) { planes.push(buf.subarray(at, at + n)); at += n; }
  else if (comp === 1) {
    const counts = []; for (let i = 0; i < chans * h; i++) { counts.push(buf.readUInt16BE(at)); at += 2; }
    for (let c = 0; c < chans; c++) {
      const plane = Buffer.alloc(n);
      for (let y = 0; y < h; y++) {
        const end = at + counts[c * h + y]; let o = y * w;
        while (at < end) {
          const b = buf.readInt8(at++);
          if (b >= 0) { buf.copy(plane, o, at, at + b + 1); at += b + 1; o += b + 1; }
          else if (b !== -128) { plane.fill(buf[at++], o, o + 1 - b); o += 1 - b; }
        }
      }
      planes.push(plane);
    }
  } else throw new Error('PSD: compression ' + comp);
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = planes[0][i]; data[i * 4 + 1] = planes[mode === 1 ? 0 : 1][i]; data[i * 4 + 2] = planes[mode === 1 ? 0 : 2][i];
    data[i * 4 + 3] = chans > (mode === 1 ? 1 : 3) ? planes[mode === 1 ? 1 : 3][i] : 255;
  }
  return {w, h, data};
}
const IMAGES = new Map();
export function image(file) {
  if (IMAGES.has(file)) return IMAGES.get(file);
  const buf = fs.readFileSync(file);
  const img = /\.psd$/i.test(file) ? psd(buf) : /\.png$/i.test(file) ? png(buf) : null;
  if (!img) throw new Error('Unsupported picture ' + file);
  IMAGES.set(file, img);
  return img;
}

// ============================================================================ Unity: guids and materials
/** Every asset under dir by its .meta guid. */
export function unityIndex(dir) {
  const byGuid = new Map(), mats = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.meta')) {
        const m = /guid: ([0-9a-f]{32})/.exec(fs.readFileSync(f, 'utf8').slice(0, 400));
        if (m) byGuid.set(m[1], f.slice(0, -5));
      } else if (e.name.endsWith('.mat')) mats.push(f);
    }
  })(dir);
  return {byGuid, mats};
}
const rgba = s => { const m = /r: ([-\d.e]+), g: ([-\d.e]+), b: ([-\d.e]+)/.exec(s); return m ? [+m[1], +m[2], +m[3]] : null; };
/** A Unity material (its file, or its name looked for under the index): its colour, its main picture, the picture's
 *  tiling, and its glow (an emission colour, and picture, if it has them). */
export function material(index, which) {
  const file = which && fs.existsSync(which) ? which
    : index.mats.filter(f => path.basename(f, '.mat').toLowerCase() === String(which).toLowerCase()).sort((a, b) => (/URP|HDRP/.test(a) ? 1 : 0) - (/URP|HDRP/.test(b) ? 1 : 0))[0];
  if (!file) return null;
  const text = fs.readFileSync(file, 'utf8');
  const texEnv = name => {
    const m = new RegExp(`- ${name}:\\s*\\n\\s*m_Texture: \\{fileID: (\\d+)(?:, guid: ([0-9a-f]{32}))?[^}]*\\}\\s*\\n\\s*m_Scale: \\{x: ([-\\d.e]+), y: ([-\\d.e]+)\\}\\s*\\n\\s*m_Offset: \\{x: ([-\\d.e]+), y: ([-\\d.e]+)\\}`).exec(text);
    if (!m || !m[2] || !index.byGuid.has(m[2])) return null;
    return {file: index.byGuid.get(m[2]), scale: [+m[3], +m[4]], offset: [+m[5], +m[6]]};
  };
  const col = name => { const m = new RegExp(`- ${name}: (\\{[^}]*\\})`).exec(text); return m ? rgba(m[1]) : null; };
  const tex = texEnv('_BaseMap') || texEnv('_MainTex') || texEnv('_BaseColorMap') || texEnv('_Albedo') || texEnv('_Texture');
  const glow = col('_EmissionColor'), glowTex = texEnv('_EmissionMap') || texEnv('_Emission');
  const keywords = /m_ValidKeywords:[\s\S]*?_EMISSION|m_ShaderKeywords:.*_EMISSION/.test(text);
  return {file, name: path.basename(file, '.mat'), color: col('_BaseColor') || col('_Color') || [1, 1, 1], tex,
    glow: glow && (keywords || glowTex) && Math.max(...glow) > .05 ? glow : null, glowTex: keywords ? glowTex : null};
}
