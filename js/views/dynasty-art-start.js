// The Starter Pack's art designs (views/dynasty-packs.js frames them: tier 1, red #D6453D; the frame already draws its
// foil sheen and seals). Pocket's packs come in several artworks; so do ours, more detailed the rarer the pack (the
// owner, Oct 29 2026: "Add more art designs to the packs. The more rare the pack, the more detailed the art design
// should be"). Each design: {id: 'start-<slug>', name (for screen readers), svg: (u, k) => markup in a 100 x 160
// viewBox, full-bleed, the subject in y 24..122; ids `${u}name`; at most 30 elements}. The guide is at the top of
// views/dynasty-packs.js.
// Tier 1: clean and friendly, a rookie's first day: one bold flat subject (two or three tones, a shade and a gleam) in
// a burst of light on the pack's red, a soft shadow under it; nothing moves.

// (the red ground every design shares, light behind the subject: 5 elements)
const ground = (u, k) => `<radialGradient id="${u}bg" cx="50%" cy="44%" r="72%"><stop offset="0" stop-color="${k.pl}"/><stop offset=".5" stop-color="${k.pc}"/>`
  + `<stop offset="1" stop-color="${k.pd}"/></radialGradient><rect width="100" height="160" fill="url(#${u}bg)"/>`;
const f = n => +n.toFixed(2);
// (a football, its long axis turned r degrees, a b its half length and width: body, shade, gleam and laces, 5 elements)
const ball = (x, y, a, b, r) => `<g transform="translate(${x} ${y}) rotate(${r})">`
  + `<path fill="#8E4B25" d="M${-a} 0C${f(-.55 * a)} ${f(-1.3 * b)} ${f(.55 * a)} ${f(-1.3 * b)} ${a} 0C${f(.55 * a)} ${f(1.3 * b)} ${f(-.55 * a)} ${f(1.3 * b)} ${-a} 0Z"/>`
  + `<path fill="#5C2B12" d="M${-a} 0C${f(-.55 * a)} ${f(1.3 * b)} ${f(.55 * a)} ${f(1.3 * b)} ${a} 0C${f(.5 * a)} ${f(.55 * b)} ${f(-.5 * a)} ${f(.55 * b)} ${-a} 0Z"/>`
  + `<path fill="#fff" fill-opacity=".3" d="M${f(-.64 * a)} ${f(-.5 * b)}C${f(-.3 * a)} ${f(-.98 * b)} ${f(.3 * a)} ${f(-.98 * b)} ${f(.64 * a)} ${f(-.5 * b)}C${f(.3 * a)} ${f(-.76 * b)} ${f(-.3 * a)} ${f(-.76 * b)} ${f(-.64 * a)} ${f(-.5 * b)}Z"/>`
  + `<path fill="none" stroke="#fff" stroke-width="${f(.14 * b)}" stroke-linecap="round" d="M${f(-.3 * a)} ${f(-.2 * b)}H${f(.3 * a)}${[-.22, -.11, 0, .11, .22].map(t => `M${f(t * a)} ${f(-.46 * b)}v${f(.52 * b)}`).join('')}"/></g>`;
// (a ring as a subpath, for the O's)
const ring = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export default [
  // Chalk Talk: the coach's clipboard, a play drawn on it in X's and O's, two routes run to their arrows.
  {id: 'start-chalk', name: 'Chalk Talk: a coach’s clipboard of X’s and O’s', svg: (u, k) => ground(u, k) + k.burst({cy: 72, a: .14})
    + `<marker id="${u}ar" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4.2" markerHeight="4.2" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L6 3L0 6z" fill="#27313D"/></marker>`
    + `<g transform="translate(50 74) rotate(-6) scale(1.07) translate(-50 -74)"><rect x="25.6" y="40" width="54" height="72" rx="4.5" fill="#000" opacity=".22"/>`
    + `<rect x="23" y="36" width="54" height="72" rx="4.5" fill="#B87A44" stroke="#7A4920" stroke-width="1.2"/><rect x="28" y="45" width="44" height="58" rx="1.2" fill="#FFF8EC"/>`
    + `<path d="M45 34.5v-2a5 5 0 0 1 10 0v2" fill="none" stroke="#6E7884" stroke-width="2"/><path d="M41 33.5h18a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H40a2 2 0 0 1-2-2v-8a3 3 0 0 1 3-3z" fill="#D3DAE2" stroke="#6E7884"/>`
    + `<path class="pa-fine" d="M31 79H69" stroke="${k.pd}" stroke-width=".9" stroke-dasharray="2.2 1.6" opacity=".55"/>`
    + `<path fill="none" stroke="#27313D" stroke-width="1.5" d="${[[41.5, 84], [50, 84], [58.5, 84], [50, 94], [32.5, 85], [67.5, 85]].map(([x, y]) => ring(x, y, 2.5)).join('')}"/>`
    + `<path fill="none" stroke="${k.pc}" stroke-width="1.8" stroke-linecap="round" d="${[[39, 71], [50, 69], [61, 71], [42, 57], [58, 57]].map(([x, y]) => `M${x - 2.1} ${y - 2.1}l4.2 4.2m0-4.2l-4.2 4.2`).join('')}"/>`
    + `<g fill="none" stroke="#27313D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#${u}ar)"><path d="M32.5 81.5V63l8-9.5"/><path d="M67.5 81.5V62.5H58"/><path d="M53.2 94.5c6 0 9-3 10.5-7"/></g></g>`},
  // Kickoff Tee: the ball stood up in its tee's cradle on the yard line, ready for the opening kick.
  {id: 'start-tee', name: 'Kickoff Tee: a football stood on its kicking tee', svg: (u, k) => ground(u, k) + k.burst({cy: 66, a: .15})
    + `<linearGradient id="${u}ln" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    + `<path d="M0 105H100V160H0z" fill="${k.pd}" fill-opacity=".3"/><path d="M48.2 105h3.6l7 34H41.2z" fill="url(#${u}ln)"/>`
    + `<ellipse cx="50" cy="106.4" rx="22" ry="3.2" fill="#000" opacity=".25"/>`
    + ball(45, 68.6, 29, 17, -100)
    + `<path fill="#F7801E" d="M33.6 106.6l4.2-13.2c.4-1 1-1.6 2-1.6 4.4 0 6 5.6 10.2 5.6s5.8-5.6 10.2-5.6c1 0 1.6.6 2 1.6l4.2 13.2z"/>`
    + `<path fill="#B9520A" d="M33.6 106.6h32.8l-.9-2.8H34.5zM62.2 93.4l4.2 13.2h-3.6l-3.4-11.6c-.4-1.4-1-2.4-1.8-3.1 2.2-.4 4 0 4.6 1.5z"/>`
    + `<path class="pa-fine" d="M36 101.4h28" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>`},
  // Rookie Helmet: a new helmet side on, white with a single red stripe over its crown, the face mask out front.
  {id: 'start-helmet', name: 'Rookie Helmet: a white helmet with one red stripe', svg: (u, k) => ground(u, k) + k.burst({cy: 70, a: .14})
    + `<ellipse cx="52" cy="105" rx="30" ry="3.6" fill="#000" opacity=".22"/>`
    + `<path d="M64 66.6l13.4-1.4c2 9.4 1.8 20.4-1.4 30.4L63 98.4z" fill="#2B3440"/>`
    + `<path d="M76.5 61C75 47 63 39 48 39 32 39 20.5 50.5 20.5 66.5c0 11 3.4 21 10 27.4L45 96c5.6.6 9 4 15.6 4.4 2.6.2 4.4-.6 5.4-2.4l.2-6.4c-4.6-5.4-6.8-13.4-4.6-20.6 1-2.6 3-4 5.6-4.4l9.4-1z" fill="#F4F6F8"/>`
    + `<path d="M20.5 66.5c0 11 3.4 21 10 27.4L45 96c5.6.6 9 4 15.6 4.4 2.6.2 4.4-.6 5.4-2.4-6 1-11-1.6-16-4.4-9.6-.4-17-3-22-9.6-4-5.6-6.6-11.6-7.5-17.5z" fill="#C3CBD4"/>`
    + `<path d="M71.6 56.6C68.4 48 59 43.6 48 43.6c-12.6 0-22.4 8.2-23.2 20.6" fill="none" stroke="${k.pc}" stroke-width="5.4" stroke-linecap="round"/>`
    + `<circle cx="44" cy="71" r="3.4" fill="#3B4450"/><circle cx="44" cy="71" r="6.4" fill="none" stroke="#C3CBD4" stroke-width="1.6"/>`
    + `<path d="M75.6 64.6c5 0 8.6 1.4 9.6 4v18c-1.4 4.6-6.4 8.4-17.2 9.6M64.6 74.6h20.6M65 84h20.2M77 64.6c-1.8 8.4-2.2 18-1 30" fill="none" stroke="#5F6976" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`},
  // First Jersey: a rookie's first jersey, white with red sleeve stripes and a big number 1.
  {id: 'start-jersey', name: 'First Jersey: a white jersey with a red number 1', svg: (u, k) => {
    // (the sleeves' stripes run parallel to their cuffs, d in from them; the jersey clips their outer ends)
    const band = (x0, y0, x1, y1, d) => {
      const l = Math.hypot(x1 - x0, y1 - y0), cx = (x1 - x0) / l, cy = (y1 - y0) / l, nx = cy * (x1 > x0 ? 1 : -1), ny = -Math.abs(cx);
      return `M${f(x0 + nx * d - cx * 5)} ${f(y0 + ny * d - cy * 5)}L${f(x1 + nx * d)} ${f(y1 + ny * d)}`;
    };
    return ground(u, k) + k.burst({cy: 72, a: .14})
      + `<defs><path id="${u}j" d="M42 37L26 42.5C21 44 18 47 16.5 51L12.5 62.5 25.5 68.5 28.5 61 29.5 108c0 2 1.5 3 3.5 3H67c2 0 3.5-1 3.5-3L71.5 61 74.5 68.5 87.5 62.5 83.5 51C82 47 79 44 74 42.5L58 37c-2 6-5 9-8 9S44 43 42 37z"/>`
      + `<clipPath id="${u}c"><use href="#${u}j"/></clipPath></defs>`
      + `<use href="#${u}j" transform="translate(2.4 3)" fill="#000" opacity=".2"/><use href="#${u}j" fill="#F5F6F8"/>`
      + `<g clip-path="url(#${u}c)"><path fill="#D3D9E0" d="M0 60h33.5l-1 52H0zM100 60H66.5l1 52H100zM42 37h16l-8 13.4z"/>`
      + `<path fill="none" stroke="${k.pc}" stroke-width="2.4" d="${band(12.5, 62.5, 25.5, 68.5, 3.4) + band(12.5, 62.5, 25.5, 68.5, 7.2) + band(87.5, 62.5, 74.5, 68.5, 3.4) + band(87.5, 62.5, 74.5, 68.5, 7.2)}"/></g>`
      + `<path d="M42 37c2 6 5 9 8 9s6-3 8-9" fill="none" stroke="${k.pc}" stroke-width="2.6" stroke-linejoin="round"/>`
      + `<path d="M44.2 58.4H55.6V91H46.8V68.2L41.8 70.6V63z" fill="${k.pc}" stroke="${k.pd}" stroke-width="1.1" stroke-linejoin="round"/>`;
  }}
];
