// The foil packs' shared drawing (views/dynasty-packs.js FOIL: the Standard, Team and Premium Packs). The owner, Oct 31
// 2026, with four mock-ups of the case's cover as foil packs: "Use attached as inspiration to redesign the packs. These
// can be used as the standard packs. Make 3 standard packs, the ones that cost more will have a brighter, more detailed
// design." The frame (css/views/dynasty-packs.css .is-foil) is the crinkled holographic wrapper, the framed card
// window, the logo at its head and the name below; a design paints only the window: a swirl of light round the cover's
// football. Each design: {id, name (for screen readers), svg: (u, k) => markup in the window's viewBox 0 0 86 114
// (FOIL_VIEW), full-bleed, the logo over y 0..42 (keep it dark enough there to read), the subject round (43, 76)}.
// Budgets as the other packs': tier 1 30 elements, 2 55, 3 90; no SVG filters.
// The pieces, made by tools/dynasty/pack_art.py from the case's cover: img/rivals/packs/ball-v1.webp (the football, cut
// out), foil-v1.webp (the wrapper) and logo-<kind>-v1.webp (the logo in each pack's colours).

export const FOIL_VIEW = '0 0 86 114';
export const BALL = new URL('../../img/rivals/packs/ball-v1.webp', import.meta.url).href;
const f = n => +n.toFixed(2);

/** The window's ground: a radial light (c0 in the middle, c1, c2 at the edges) behind the swirl. 5 elements. */
export const ground = (u, [c0, c1, c2], {cx = 50, cy = 64, r = 78} = {}) => `<radialGradient id="${u}g" cx="${cx}%" cy="${cy}%" r="${r}%">`
  + `<stop offset="0" stop-color="${c0}"/><stop offset=".45" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient><rect width="86" height="114" fill="url(#${u}g)"/>`;

/** A soft round glow (a radial gradient fading out). 4 elements. */
export const halo = (u, id, {cx = 43, cy = 76, r = 30, c = '#fff', a = .8, rx, ry, cls = ''} = {}) => `<radialGradient id="${u}${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/>`
  + `<stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><ellipse${cls ? ` class="${cls}"` : ''} cx="${cx}" cy="${cy}" rx="${rx || r}" ry="${ry || r}" fill="url(#${u}${id})"/>`;

// (one arm of a spiral, from radius r0 out to r1 over `turns` of a turn, starting at angle a0: a path's subpath)
const arm = (a0, r0, r1, turns, dir) => {
  const n = Math.max(10, Math.round(turns * 26)), k = Math.log(r1 / r0) / (turns * 2 * Math.PI);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n * turns * 2 * Math.PI, r = r0 * Math.exp(k * t), a = a0 + dir * t;
    d += `${i ? 'L' : 'M'}${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;
  }
  return d;
};
/** A swirl of light: `arms` spiral arms from r0 out to r1, each in three strokes (a wide soft glow, a bright band and
 *  a white-hot core), seen at an angle (squash, tilt). cols: [glow, band, core]. 4 elements (6 with `wide`). */
export function vortex({cx = 43, cy = 76, arms = 3, r0 = 6, r1 = 40, turns = .9, a0 = 0, dir = 1, tilt = -18, squash = .7, cols, w = 1, op = 1, cls = '', style = ''} = {}) {
  const d = Array.from({length: arms}, (_, i) => arm(a0 + i * 2 * Math.PI / arms, r0, r1, turns, dir)).join('');
  const layer = (c, sw, a) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(sw * w)}" stroke-opacity="${f(a * op)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<g transform="translate(${cx} ${cy}) rotate(${tilt}) scale(1 ${squash})"><g${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>`
    + layer(cols[0], 9, .24) + layer(cols[1], 3.6, .62) + layer(cols[2], 1.1, .95) + '</g></g>';
}
/** A ring of light round the subject (an ellipse at an angle): glow, band and core. 4 elements. */
export const ring = ({cx = 43, cy = 76, rx = 36, ry = 22, tilt = -14, cols, w = 1, half = false} = {}) => {
  // (half: only the arc in front of the ball, drawn over it)
  const d = half ? `M${-rx} 0A${rx} ${ry} 0 0 0 ${rx} 0` : `M${-rx} 0A${rx} ${ry} 0 1 0 ${rx} 0A${rx} ${ry} 0 1 0 ${-rx} 0`;
  return `<g transform="translate(${cx} ${cy}) rotate(${tilt})" fill="none" stroke-linecap="round">`
    + `<path d="${d}" stroke="${cols[0]}" stroke-width="${f(8 * w)}" stroke-opacity=".25"/><path d="${d}" stroke="${cols[1]}" stroke-width="${f(3 * w)}" stroke-opacity=".7"/>`
    + `<path d="${d}" stroke="${cols[2]}" stroke-width="${f(1 * w)}"/></g>`;
};
/** The cover's football (w wide, turned r degrees, centred on x y). 1 element. */
export const ball = (x = 43, y = 76, w = 52, r = 0, cls = '') => {
  const h = f(w * 271 / 360);
  return `<image${cls ? ` class="${cls}"` : ''} href="${BALL}" x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${w}" height="${h}"${r ? ` transform="rotate(${r} ${x} ${y})"` : ''}/>`;
};
/** Four-pointed glints (one path): [x, y, r] each. 1 element. */
export const sparks = (pts, {c = '#fff', a = 1, cls = '', style = ''} = {}) => `<path${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''} fill="${c}" fill-opacity="${a}" d="${pts.map(([x, y, r]) => {
  const t = r * .16;
  return `M${x} ${f(y - r)}L${f(x + t)} ${f(y - t)}L${f(x + r)} ${y}L${f(x + t)} ${f(y + t)}L${x} ${f(y + r)}L${f(x - t)} ${f(y + t)}L${f(x - r)} ${y}L${f(x - t)} ${f(y - t)}Z`;
}).join('')}"/>`;
/** Specks of light (one path of tiny rounds): n of them, scattered by a fixed seed, kept out of the logo's lower edge
 *  band when `clear`. 1 element. */
export const dots = (n, {seed = 1, c = '#fff', a = .8, r = [.25, .7], y0 = 40, cls = ''} = {}) => {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = f(2 + rnd() * 82), y = f(y0 + rnd() * (112 - y0)), q = f(r[0] + rnd() * (r[1] - r[0]));
    d += `M${f(x - q)} ${y}a${q} ${q} 0 1 0 ${f(2 * q)} 0a${q} ${q} 0 1 0 ${f(-2 * q)} 0`;
  }
  return `<path${cls ? ` class="${cls}"` : ''} fill="${c}" fill-opacity="${a}" d="${d}"/>`;
};
/** Rays of light from (cx, cy) (one path). 1 element. */
export const rays = ({cx = 43, cy = 76, n = 18, r = 110, w = .35, a = .14, c = '#fff', cls = ''} = {}) => `<path${cls ? ` class="${cls}"` : ''} fill="${c}" opacity="${a}" d="${Array.from({length: n}, (_, i) => {
  const a0 = 2 * Math.PI * i / n, a1 = a0 + 2 * Math.PI * w / n;
  return `M${cx} ${cy}L${f(cx + r * Math.cos(a0))} ${f(cy + r * Math.sin(a0))}L${f(cx + r * Math.cos(a1))} ${f(cy + r * Math.sin(a1))}Z`;
}).join('')}"/>`;
/** The window's top darkened under the logo, so it reads on any swirl (a linear gradient). 4 elements. */
export const shade = (u, c = '#000', a = .55, to = 46) => `<linearGradient id="${u}sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/>`
  + `<stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient><rect width="86" height="${to}" fill="url(#${u}sh)"/>`;
