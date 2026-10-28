// Keepfall's base layouts (the owner's ask, Oct 28 2026: "Create default layouts that the player can use for each castle
// level. The player can select a button and have their whole base sorted automatically"). One layout a Castle level,
// worked out from what that level allows (core/realm.js COUNT), laid out in rings round the middle of the lot:
// - the Castle in the middle, inside its own ring of walls;
// - round it a band of 3x3 lots for the Treasuries, Cellars and defenses (a second band from Castle 5, when they no
//   longer fit in one; its gaps line up with the ring inside, so spokes of wall can split it into compartments), the
//   lots left over taken by Gold Mines, Breweries and Builder's Huts;
// - round the outside, 4x4 lots for the Dragon Hatcheries, Barracks, War Camps and the rest, kind by kind.
// Walls go on in order: the Castle's ring, each band's ring, the spokes, then the outer rings. A ring that runs short
// of walls is filled from the middle of each side, so it's whole where it counts and grows to the corners.
// Arranging moves buildings only (their x, y): ids, levels, timers, armies and everything else stay as they are, and a
// building the layout has no lot for goes to the nearest free ground (core/realm.js spotFor).
import {N, EDGE, KINDS, COUNT, MAX_KEEP, fits, spotFor, keepOf} from './realm.js';

const M = N / 2;
// (what goes in the walled bands, the most worth keeping first)
const GUARDED = ['treasury', 'granary', 'cauldron', 'trebuchet', 'tower', 'ballista', 'cannon'];
// (what fills the bands' leftover lots)
const FILL = ['mine', 'farm', 'hut'];
// (what goes round the outside, kind by kind)
const OUTER = [...GUARDED, 'hatchery', 'barracks', 'camp', 'mine', 'farm', 'hut'];

/** A ring of wall tiles round the square [lo, hi): the middle of each side first, the corners last. */
function loop(lo, hi) {
  const out = [], mid = (lo + hi - 1) / 2;
  for (let p = lo; p < hi - 1; p++) {
    out.push({x: p, y: lo, d: Math.abs(p - mid), s: 0});
    out.push({x: hi - 1, y: p, d: Math.abs(p - mid), s: 1});
    out.push({x: hi - 1 - (p - lo), y: hi - 1, d: Math.abs(hi - 1 - (p - lo) - mid), s: 2});
    out.push({x: lo, y: hi - 1 - (p - lo), d: Math.abs(hi - 1 - (p - lo) - mid), s: 3});
  }
  return out.sort((a, b) => a.d - b.d || a.s - b.s).map(({x, y}) => ({x, y}));
}
/** The lots (w x w) in the band round the square [lo, hi), going round from the top left. gap: a tile kept clear by
 *  each of the square's sides (where the spokes go). Each lot: {x, y, w, d (how far from the middle of its side; the
 *  corners furthest)}. */
function band(lo, hi, w, gap) {
  const len = hi - lo - 2 * gap, k = Math.floor(len / w), o = lo + gap + Math.floor((len - k * w) / 2);
  const along = Array.from({length: k}, (_, j) => o + j * w), mid = (lo + hi) / 2, far = hi - lo;
  const lot = (x, y, d) => ({x, y, w, d});
  return [
    lot(lo - w, lo - w, far), ...along.map(p => lot(p, lo - w, Math.abs(p + w / 2 - mid))),
    lot(hi, lo - w, far), ...along.map(p => lot(hi, p, Math.abs(p + w / 2 - mid))),
    lot(hi, hi, far), ...along.slice().reverse().map(p => lot(p, hi, Math.abs(p + w / 2 - mid))),
    lot(lo - w, hi, far), ...along.slice().reverse().map(p => lot(lo - w, p, Math.abs(p + w / 2 - mid)))
  ];
}
/** The walls that split the band (w deep) round [lo, hi) into compartments, from the corners of its inner ring out. */
function spokes(lo, hi, w) {
  const out = [];
  for (let j = 1; j <= w; j++) [lo, hi - 1].forEach(p => out.push({x: p, y: lo - j}, {x: p, y: hi - 1 + j}, {x: lo - j, y: p}, {x: hi - 1 + j, y: p}));
  return out;
}
const onLot = (lo, hi) => lo >= EDGE && hi <= N - EDGE;

/** The layout for Castle level th: {th, keep: {x, y}, inner: [bands of 3x3 lots], outer: [bands of 4x4 lots], walls:
 *  [{x, y}] in the order they go on}. */
export function layoutOf(th) {
  th = Math.max(1, Math.min(MAX_KEEP, th | 0));
  const guarded = GUARDED.reduce((n, k) => n + (COUNT[k][th - 1] || 0), 0);
  const inner = [], outer = [], rings = [], extra = [];
  let lo = M - 3, hi = M + 3;
  rings.push(loop(lo, hi));
  // (one band of 3x3 lots holds twelve; a second band once the Castle's lot has more than fifteen to keep in)
  const deep = guarded > 15 ? 2 : 1;
  for (let i = 0; i < deep; i++) {
    inner.push(band(lo, hi, 3, i ? 1 : 0));
    if (i) extra.push(...spokes(lo, hi, 3));
    lo -= 4; hi += 4;
    rings.push(loop(lo, hi));
  }
  while (onLot(lo - 4, hi + 4)) {
    outer.push(band(lo, hi, 4, 1));
    lo -= 5; hi += 5;
    if (onLot(lo, hi)) rings.push(loop(lo, hi));
  }
  // (the Castle's ring and the bands' rings, then the spokes, then the rings outside)
  const walls = [...rings.slice(0, deep + 1).flat(), ...extra, ...rings.slice(deep + 1).flat()];
  return {th, keep: {x: M - 2, y: M - 2}, inner, outer, walls};
}

// (a smaller building in a bigger lot sits on the side towards the middle of the lot)
const inLot = (lot, size) => {
  const d = lot.w - size, by = c => (d % 2 === 0 ? d / 2 : c + lot.w / 2 < M ? d : 0);
  return {x: lot.x + by(lot.x), y: lot.y + by(lot.y)};
};
const centre = lot => ({x: lot.x + lot.w / 2, y: lot.y + lot.w / 2});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Where every building in realm s goes under Castle level th's layout (default: the realm's own): {id: {x, y}}, every
 *  spot checked clear of the rest and on the lot, or null when something has nowhere to go. */
export function planFor(s, th = keepOf(s)) {
  const L = layoutOf(th), laid = {b: []}, at = {}, size = b => KINDS[b.t].size;
  const put = (b, x, y) => {
    if (!fits(laid, size(b), x, y)) return false;
    laid.b.push({i: b.i, t: b.t, x, y}); at[b.i] = {x, y};
    return true;
  };
  const byOrder = order => (a, b) => order.indexOf(a.t) - order.indexOf(b.t) || b.l - a.l || a.i - b.i;
  const left = s.b.filter(b => KINDS[b.t]);
  const take = pred => { const out = left.filter(pred); out.forEach(b => left.splice(left.indexOf(b), 1)); return out; };
  const keep = take(b => b.t === 'keep');
  keep.forEach((b, j) => { if (j || !put(b, L.keep.x, L.keep.y)) left.push(b); });
  // the bands of 3x3 lots: the guarded ones first, spread out so no two of a kind stand together, then the fill
  const lots = L.inner.map(lots => lots.slice().sort((a, b) => a.d - b.d).map(lot => ({lot, b: null})));
  const guarded = take(b => GUARDED.includes(b.t)).sort(byOrder(GUARDED)), over = [];
  let ring = 0;
  guarded.forEach(b => {
    while (ring < lots.length && lots[ring].every(c => c.b)) ring++;
    if (ring >= lots.length) { over.push(b); return; }
    const free = lots[ring].filter(c => !c.b), mine = lots[ring].filter(c => c.b);
    const far = (c, pick) => Math.min(99, ...lots.flat().filter(o => o.b && pick(o.b)).map(o => dist(centre(o.lot), centre(c.lot))));
    let best = null, bs = null;
    free.forEach(c => {
      const sc = [far(c, o => o.t === b.t), mine.length ? far(c, () => true) : 0];
      if (!best || sc[0] > bs[0] + 1e-9 || (Math.abs(sc[0] - bs[0]) < 1e-9 && sc[1] > bs[1] + 1e-9)) { best = c; bs = sc; }
    });
    best.b = b;
  });
  left.push(...over);
  const fill = take(b => FILL.includes(b.t)).sort(byOrder(FILL));
  lots.flat().forEach(c => { if (!c.b && fill.length) c.b = fill.shift(); });
  left.push(...fill);
  lots.flat().forEach(c => { if (c.b) { const p = inLot(c.lot, size(c.b)); if (!put(c.b, p.x, p.y)) left.push(c.b); } });
  // round the outside, kind by kind, a band at a time, spread evenly round it (a few: the middles of its sides)
  const out = take(b => b.t !== 'wall' && size(b) <= 4).sort(byOrder(OUTER));
  L.outer.forEach(slots => {
    const n = Math.min(out.length, slots.length);
    out.splice(0, n).forEach((b, j) => {
      const lot = slots[Math.floor((j + .5) * slots.length / n)], p = inLot(lot, size(b));
      if (!put(b, p.x, p.y)) left.push(b);
    });
  });
  left.push(...out);
  // the walls, the highest first, in the layout's order
  const walls = take(b => b.t === 'wall').sort((a, b) => b.l - a.l || a.i - b.i);
  let w = 0;
  walls.forEach(b => {
    while (w < L.walls.length && !fits(laid, 1, L.walls[w].x, L.walls[w].y)) w++;
    if (w < L.walls.length) put(b, L.walls[w].x, L.walls[w].y); else left.push(b);
  });
  // anything else: the nearest free ground
  for (const b of left) {
    const p = spotFor(laid, b.t);
    if (!p || !put(b, p.x, p.y)) return null;
  }
  return at;
}
/** Sorts realm s into Castle level th's layout (default: its own). The positions it had ({id: {x, y}}, for undo), or
 *  null when it couldn't (nothing moved then). */
export function arrange(s, th = keepOf(s)) {
  const at = planFor(s, th);
  if (!at) return null;
  const was = Object.fromEntries(s.b.map(b => [b.i, {x: b.x, y: b.y}]));
  s.b.forEach(b => { if (at[b.i]) { b.x = at[b.i].x; b.y = at[b.i].y; } });
  return was;
}
/** Puts realm s back as it was (arrange's return), if its buildings are still the same ones and still fit. */
export function restore(s, was) {
  if (!was || s.b.length !== Object.keys(was).length || !s.b.every(b => was[b.i])) return false;
  const laid = {b: []};
  for (const b of s.b) {
    const p = was[b.i];
    if (!fits(laid, KINDS[b.t].size, p.x, p.y)) return false;
    laid.b.push({i: b.i, t: b.t, x: p.x, y: p.y});
  }
  s.b.forEach(b => { b.x = was[b.i].x; b.y = was[b.i].y; });
  return true;
}
/** Whether realm s is already laid out as Castle level th's layout puts it. */
export function sorted(s, th = keepOf(s)) {
  const at = planFor(s, th);
  return !!at && s.b.every(b => at[b.i] && at[b.i].x === b.x && at[b.i].y === b.y);
}
/** Castle level th's layout filled with everything that level allows (for its picture): a realm-shaped {b}. */
export function fullAt(th) {
  const b = [];
  let i = 1;
  Object.keys(COUNT).forEach(t => { for (let n = 0; n < (COUNT[t][th - 1] || 0); n++) b.push({i: i++, t, l: t === 'keep' ? th : 1, x: 0, y: 0, u: 0}); });
  const s = {b};
  const at = planFor(s, th);
  if (at) b.forEach(x => Object.assign(x, at[x.i]));
  return s;
}
