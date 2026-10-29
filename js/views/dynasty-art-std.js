// The Standard Pack's art designs (views/dynasty-packs.js frames them: tier 1, blue #2F6FDE; the frame already draws
// its foil sheen and seals). Pocket's packs come in several artworks; so do ours, more detailed the rarer the pack (the
// owner, Oct 29 2026: "Add more art designs to the packs. The more rare the pack, the more detailed the art design
// should be"). Each design: {id: 'std-<slug>', name (for screen readers), svg: (u, k) => markup in a 100 x 160 viewBox,
// full-bleed, the subject in y 24..122; ids `${u}name`; at most 30 elements}. The guide is at the top of
// views/dynasty-packs.js.
// Tier 1: clean and flat, the everyday game: the ball in flight, through the posts, on the 50 and over the goal line
// (two or three tones, a shade and a gleam) on the pack's blue, in one burst or glow of light; nothing moves.

// (the blue ground every design shares, light behind the subject: 5 elements)
const ground = (u, k, cy = 44) => `<radialGradient id="${u}bg" cx="50%" cy="${cy}%" r="72%"><stop offset="0" stop-color="${k.pl}"/><stop offset=".5" stop-color="${k.pc}"/>`
  + `<stop offset="1" stop-color="${k.pd}"/></radialGradient><rect width="100" height="160" fill="url(#${u}bg)"/>`;
const f = n => +n.toFixed(2);
// (a football, its long axis turned r degrees, a b its half length and width: body, shade, gleam and laces, 5 elements)
const ball = (x, y, a, b, r) => `<g transform="translate(${x} ${y}) rotate(${r})">`
  + `<path fill="#8E4B25" d="M${-a} 0C${f(-.55 * a)} ${f(-1.3 * b)} ${f(.55 * a)} ${f(-1.3 * b)} ${a} 0C${f(.55 * a)} ${f(1.3 * b)} ${f(-.55 * a)} ${f(1.3 * b)} ${-a} 0Z"/>`
  + `<path fill="#5C2B12" d="M${-a} 0C${f(-.55 * a)} ${f(1.3 * b)} ${f(.55 * a)} ${f(1.3 * b)} ${a} 0C${f(.5 * a)} ${f(.55 * b)} ${f(-.5 * a)} ${f(.55 * b)} ${-a} 0Z"/>`
  + `<path fill="#fff" fill-opacity=".3" d="M${f(-.64 * a)} ${f(-.5 * b)}C${f(-.3 * a)} ${f(-.98 * b)} ${f(.3 * a)} ${f(-.98 * b)} ${f(.64 * a)} ${f(-.5 * b)}C${f(.3 * a)} ${f(-.76 * b)} ${f(-.3 * a)} ${f(-.76 * b)} ${f(-.64 * a)} ${f(-.5 * b)}Z"/>`
  + `<path fill="none" stroke="#fff" stroke-width="${f(.14 * b)}" stroke-linecap="round" d="M${f(-.3 * a)} ${f(-.2 * b)}H${f(.3 * a)}${[-.22, -.11, 0, .11, .22].map(t => `M${f(t * a)} ${f(-.46 * b)}v${f(.52 * b)}`).join('')}"/></g>`;
// (straight strokes behind a ball flying from x y along r degrees: each [across, from, length] measured on its axis)
const trail = (x, y, r, lines) => {
  const c = Math.cos(r * Math.PI / 180), s = Math.sin(r * Math.PI / 180), at = (t, o) => `${f(x + t * c - o * s)} ${f(y + t * s + o * c)}`;
  return lines.map(([o, t, l]) => `M${at(-t, o)}L${at(-t - l, o)}`).join('');
};

export default [
  // Spiral: a tight spiral flying up and to the right, white speed lines streaming off its tail.
  {id: 'std-spiral', name: 'Spiral: a football flying in a tight spiral', svg: (u, k) => ground(u, k) + k.burst({cx: 54, cy: 71, a: .15})
    + `<path class="pa-fine" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.3" stroke-linecap="round" d="${trail(54, 71, -32, [[-17, 22, 14], [-8, 33, 22], [8, 33, 36], [17, 20, 16]])}"/>`
    + `<path fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" d="${trail(54, 71, -32, [[-12, 26, 20], [-3, 32, 34], [5, 32, 26], [12, 26, 14]])}"/>`
    + ball(54, 71, 30, 17, -32)},
  // Uprights: the ball tumbling end over end between the goalposts, its flight dotted in from the kick.
  {id: 'std-uprights', name: 'Uprights: a kick sailing through the goalposts', svg: (u, k) => ground(u, k, 36) + k.burst({cx: 50, cy: 56, a: .14})
    + `<path d="M0 108H100V160H0z" fill="${k.pd}" fill-opacity=".55"/><path d="M0 108.4H100" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>`
    + `<ellipse cx="50" cy="110" rx="12" ry="2" fill="#000" opacity=".25"/>`
    + `<path d="M22 31V88H78V31M50 88V110" fill="none" stroke="#FFCF33" stroke-width="4"/><path d="M23.5 31V89.5H79.5V31M51.5 89.5V110" fill="none" stroke="#D99A00" stroke-width="1"/>`
    + `<path d="M20.2 31.4c-3 .2-6.4 1.6-9.6 1.8 3 .8 6.4 2.4 9.6 3zM76.2 31.4c-3 .2-6.4 1.6-9.6 1.8 3 .8 6.4 2.4 9.6 3z" fill="#fff"/>`
    + `<rect x="46" y="96" width="8" height="14.4" rx="1.6" fill="${k.pd}"/>`
    + `<path d="M32 126C36.5 101 41.5 80 46.4 65.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray=".1 4.2" opacity=".85"/>`
    + ball(50, 55, 12, 7, -62)},
  // Midfield: the ball spotted on the 50, its yard numbers painted big below, hash marks across a mown blue field.
  {id: 'std-midfield', name: 'Midfield: the ball on the 50 yard line', svg: (u, k) => ground(u, k, 40)
    + `<path d="M22 0h28v160H22zM78 0h28v160H78z" fill="#fff" fill-opacity=".07"/>`
    + `<linearGradient id="${u}yl" gradientUnits="userSpaceOnUse" x1="0" y1="96" x2="0" y2="150"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient>`
    + `<path d="M22 0V160M50 0V160M78 0V160" stroke="url(#${u}yl)" stroke-width="1.5"/>`
    + `<path stroke="#fff" stroke-opacity=".75" stroke-width="1" d="${[36, 76].map(y => Array.from({length: 17}, (_, i) => (i - 8) % 5 ? `M${f(50 + 5.6 * (i - 8))} ${y - 2.2}v4.4` : '').join('')).join('')}"/>`
    + `<path d="M44 88.5H31V98.5h6.5c4.5 0 6.5 2.5 6.5 6.5v1.5c0 4.5-2.5 6.5-6.5 6.5H29" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="5"/>`
    + `<rect x="57.5" y="88.5" width="13.5" height="24.5" rx="6.75" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="5"/>`
    + k.glow({cx: 50, cy: 57, r: 32, a: .5}) + `<ellipse cx="50" cy="67" rx="17" ry="3" fill="#0B1F4A" opacity=".35"/>`
    + ball(50, 57, 21, 12, -16)},
  // Touchdown: side on at the goal line, the ball breaking the plane past the orange pylon, the end zone's stripes
  // beyond, a flash where it crosses.
  {id: 'std-touchdown', name: 'Touchdown: the ball crossing the goal line past the pylon', svg: (u, k) => ground(u, k, 40) + k.burst({cx: 56, cy: 64, a: .13})
    + `<path d="M0 100H100V160H0z" fill="${k.pd}" fill-opacity=".5"/><path d="M0 100.4H100" stroke="#fff" stroke-opacity=".4" stroke-width="1"/>`
    + `<path d="M66 100h6l-9 60h-6zM82 100h6l-9 60h-6zM98 100h6l-9 60h-6z" fill="#fff" fill-opacity=".1"/>`
    + `<path d="M53 100h4.4l-9 60H40z" fill="#fff"/><path d="M53 100h4.4V38H53z" fill="#fff" fill-opacity=".14"/>`
    + `<ellipse cx="44" cy="121" rx="10" ry="2" fill="#000" opacity=".25"/>`
    + `<path d="M38.6 121V84h9v37z" fill="#FF7A1A"/><path d="M47.6 121l4.4-3.2V80.8l-4.4 3.2z" fill="#C65A0E"/><path d="M38.6 84l4.4-3.2h9L47.6 84z" fill="#FFB070"/>`
    + `<path class="pa-fine" d="M40.4 86v33" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>`
    + `<path fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" d="${trail(61, 60, -14, [[-8, 20, 16], [0, 24, 26], [8, 20, 12]])}"/>`
    + k.glow({cx: 56, cy: 62, r: 18, a: .7}) + `<ellipse cx="63" cy="101" rx="11" ry="1.8" fill="#000" opacity=".2"/>`
    + ball(61, 60, 21, 12.4, -14)}
];
