// The Legends Pack's art designs (views/dynasty-packs.js frames them: tier 5, gold #C9A227; the frame already draws its
// foil sheen, crimped seals, an embossed quilt, rainbow holo foil, a light sweep, seven sparkles, a gold filigree
// border with scrolled corners, and gold-foil lettering on the brand bar and name plate). Pocket's packs come in
// several artworks; so do ours, more detailed the rarer the pack (the owner, Oct 29 2026: "Add more art designs to the
// packs. The more rare the pack, the more detailed the art design should be"). Each design: {id: 'leg-<slug>', name
// (for screen readers), svg: (u, k) => markup in a 100 x 160 viewBox, full-bleed, the subject in y 24..122; ids
// `${u}name`; at most 240 elements}. The guide is at the top of views/dynasty-packs.js.
// Legends' are the game's treasures, one family: a gold ground glowing from the middle, polished gold and silver,
// cream marble, burgundy velvet, laurel, and a burst of light behind each.

const f1 = n => +n.toFixed(1);
// (gradients from [offset, colour, opacity] stops: linear top to bottom unless told, radial as told)
const stops = s => s.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
const lin = (id, s, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${id}" ${at}>${stops(s)}</linearGradient>`;
const rad = (id, s, at = '') => `<radialGradient id="${id}" ${at}>${stops(s)}</radialGradient>`;
// (polished metal, catching the light twice across it: gold, silver)
const GOLD = [[0, '#FFF8DA'], [.16, '#F6D66E'], [.36, '#B98314'], [.5, '#6E4505'], [.66, '#D9A936'], [.82, '#FFF1B8'], [1, '#A87A12']];
const SILVER = [[0, '#F4F6FA'], [.16, '#C6CDD8'], [.34, '#6F7888'], [.48, '#3F4552'], [.64, '#B5BDCA'], [.8, '#FFFFFF'], [1, '#7C8494']];
// (a four-point glint at (x, y), r its reach)
const glint = (x, y, r) => { const q = r * .24; return `M${x} ${f1(y - r)}L${f1(x + q)} ${f1(y - q)}L${f1(x + r)} ${y}L${f1(x + q)} ${f1(y + q)}L${x} ${f1(y + r)}`
  + `L${f1(x - q)} ${f1(y + q)}L${f1(x - r)} ${y}L${f1(x - q)} ${f1(y - q)}Z`; };
// (a gold football, nose along +x, 20 long at s 1, about (x, y) turned r degrees; g names its gradient: 7 elements)
const ball = (u, g, x, y, s, r) => rad(`${u}${g}`, [[0, '#FFF6CC'], [.35, '#E9B940'], [.75, '#9A6608'], [1, '#5A3804']], 'cx=".38" cy=".3" r=".8"')
  + `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M-10 0C-6-7.6 6-7.6 10 0C6 7.6-6 7.6-10 0Z" fill="url(#${u}${g})" stroke="#4A2C02" stroke-width=".5"/>`
  + `<path d="M-6.4-3.9Q-5.1 0-6.4 3.9M6.4-3.9Q5.1 0 6.4 3.9M-3.8-1.9Q0-3 3.8-1.9M-2.6-3.3v2.2M-1.3-3.6v2.4M0-3.7v2.4M1.3-3.6v2.4M2.6-3.3v2.2" fill="none" stroke="#FFF6D6" stroke-width=".7" stroke-linecap="round"/>`
  + `<path d="M-6.2-3.4C-3-5.4 2-5.6 5.4-4.3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round"/></g>`;

export default [
  // The Trophy: a polished silver loving cup with a gold football on its lid, gold bands and an engraved star medallion,
  // standing on a two-tier cream marble plinth (its gold plaque, its reflection in the floor) inside a gold laurel
  // wreath, a spotlight from above and a slow starburst behind.
  {id: 'leg-trophy', name: 'The Trophy: a polished silver trophy topped by a gold football, on a marble plinth inside a laurel wreath', svg: (u, k) => {
    // (the laurel's left branch on a circle about (50, 70), r 36, from its foot behind the plinth at 104° up to its tip
    // at 250°: leaves in pairs, the inner one a step on, smaller toward the tip; the right branch is its mirror)
    const P = a => { const r = a * Math.PI / 180; return `${f1(50 + 36 * Math.cos(r))} ${f1(70 + 36 * Math.sin(r))}`; };
    const leaf = (a, t, s) => `<use href="#${u}lf" transform="translate(${P(a)}) rotate(${t}) scale(${s})"/>`;
    const leaves = Array.from({length: 10}, (_, i) => { const a = 110 + i * 14, s = f1(1.2 - i * .05); return leaf(a, a + 50, s) + leaf(a + 6, a + 132, s); }).join('') + leaf(250, 340, .9);
    const berries = [138, 180, 222].map(a => { const r = a * Math.PI / 180; return `M${f1(50 + 33 * Math.cos(r) + 1)} ${f1(70 + 33 * Math.sin(r))}a1 1 0 1 0-2 0a1 1 0 1 0 2 0`; }).join('');
    const specks = [[14, 30, 1.2], [86, 28, 1.4], [20, 50, 1], [82, 54, 1.1], [12, 84, 1.3], [90, 92, 1], [26, 106, .9], [76, 104, 1.1], [64, 26, .8], [33, 34, .8]].map(a => glint(...a)).join('');
    return rad(`${u}bg`, [[0, '#FFF6D2'], [.22, '#F7D46A'], [.5, '#C8901C'], [.8, '#6E4507'], [1, '#2E1D03']], 'cx="50%" cy="38%" r="72%"')
      + `<rect width="100" height="160" fill="url(#${u}bg)"/>`
      + `<g class="pa-spin" style="--oy:58px">${k.burst({cx: 50, cy: 58, n: 22, r: 130, w: .42, a: .22, c: '#FFF6D8'})}</g>`
      + `<g class="pa-fine">${k.burst({cx: 50, cy: 58, n: 44, r: 130, w: .12, a: .14, c: '#FFFBEA'})}</g>`
      + `<path class="pa-fine" d="${specks}" fill="#FFFBEA" fill-opacity=".7"/>`
      // the spotlight from above, and the glow round the cup
      + lin(`${u}sp`, [[0, '#FFFBEA', .4], [1, '#FFFBEA', 0]]) + `<path class="pa-pulse" style="--t:6s" d="M41 21H59L84 121H16Z" fill="url(#${u}sp)"/>`
      + k.glow({cx: 50, cy: 62, r: 32, c: '#FFF8DE', a: .7})
      + `<circle cx="50" cy="61" r="29.5" fill="none" stroke="#FFF6D2" stroke-opacity=".55" stroke-width=".4"/><circle class="pa-fine" cx="50" cy="61" r="27.6" fill="none" stroke="#FFF6D2" stroke-opacity=".8" stroke-width=".8" stroke-linecap="round" stroke-dasharray="0 2.6"/>`
      // the laurel wreath (one branch drawn, mirrored)
      + lin(`${u}lg`, [[0, '#FFF1B0'], [.45, '#E2AE3A'], [1, '#7E520A']])
      + `<defs><g id="${u}lf"><path d="M0 0C2-2.6 6.4-3 9.6-.2C6.4 2.4 2 2.2 0 0Z" fill="url(#${u}lg)" stroke="#6E4505" stroke-width=".25"/>`
      + `<path class="pa-fine" d="M.6 0Q5 -.6 8.8-.2" fill="none" stroke="#6E4505" stroke-opacity=".6" stroke-width=".25"/></g>`
      + `<g id="${u}br"><path d="M${P(104)}A36 36 0 0 1 ${P(252)}" fill="none" stroke="#8A5C0A" stroke-width=".9" stroke-linecap="round"/>${leaves}`
      + `<path d="${berries}" fill="#FFE9A0" stroke="#7E520A" stroke-width=".3"/></g></defs>`
      + `<use href="#${u}br"/><use href="#${u}br" transform="matrix(-1 0 0 1 100 0)"/>`
      // the ribbon's tails, from behind the plinth (one drawn, mirrored)
      + lin(`${u}rb`, [[0, '#C23A55'], [.5, '#8E1830'], [1, '#5A0A1C']])
      + `<defs><g id="${u}rt"><path d="M38 101.6C31 102.6 25 104 16.6 105.4L20.2 108.8L16.6 112.4C25 111 31 109 38 106.8Z" fill="url(#${u}rb)" stroke="#4A0614" stroke-width=".3"/>`
      + `<path class="pa-fine" d="M37 102.6C30.6 103.6 25 104.8 18.6 105.9M37 105.8C30.6 107.4 25 109 18.6 110.2" fill="none" stroke="#F3CF6A" stroke-width=".35"/></g></defs>`
      + `<use href="#${u}rt"/><use href="#${u}rt" transform="matrix(-1 0 0 1 100 0)"/>`
      // the floor: polished bronze, a glow under the plinth, the plinth reflected
      + lin(`${u}fl`, [[0, '#D9A43A'], [.3, '#A8721A'], [1, '#7A4E0C']]) + `<rect y="120.6" width="100" height="40" fill="url(#${u}fl)"/>`
      + rad(`${u}fg`, [[0, '#FFE7A0', .6], [1, '#FFE7A0', 0]]) + `<ellipse cx="50" cy="121" rx="36" ry="5" fill="url(#${u}fg)"/>`
      // the trophy's lighting: silver across it, gold for its bands; the handles their own
      + lin(`${u}ag`, SILVER, 'gradientUnits="userSpaceOnUse" x1="33" y1="0" x2="67" y2="0"') + lin(`${u}au`, GOLD, 'gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="70" y2="0"')
      + lin(`${u}ah`, SILVER, 'x1="0" y1="0" x2="1" y2="0"')
      + lin(`${u}mb`, [[0, '#FFFDF7'], [.55, '#F1E8D4'], [1, '#CBBB97']], 'x1="0" y1="0" x2="1" y2=".4"')
      // the plinth: gold moldings, cream marble veined, a gold plaque engraved with three stars
      + `<g id="${u}pl"><rect x="35.4" y="101.2" width="29.2" height="7" fill="url(#${u}mb)"/><rect x="30" y="110.2" width="40" height="8" fill="url(#${u}mb)"/>`
      + `<path class="pa-fine" d="M36 103Q41 104.5 44 107.8M58 101.6Q61 105 64.4 106M52 101.4Q55 104 54 108M31 112Q37 113 40 117.6M62 110.6Q65 115 69.6 116" fill="none" stroke="#9C8762" stroke-opacity=".55" stroke-width=".3"/>`
      + `<path d="M34 99.4h32v1.8H34zM32 108.2h36v2H32zM28.4 118.2h43.2v2.4H28.4z" fill="url(#${u}au)"/>`
      + `<rect x="41" y="111.6" width="18" height="5.2" rx=".6" fill="url(#${u}au)" stroke="#6E4505" stroke-width=".3"/>`
      + `<path d="${k.star(45, 114.2, 1.4)}${k.star(50, 114.2, 1.6)}${k.star(55, 114.2, 1.4)}" fill="#7A4E06"/></g>`
      + `<use href="#${u}pl" transform="matrix(1 0 0 -1 0 241.2)" opacity=".2"/>`
      + `<path d="M0 120.6H100" stroke="#FFE7A0" stroke-opacity=".5" stroke-width=".4"/>`
      // the handles, the bowl (shaded below, engraved, a gold medallion with a star), the specular streaks
      + `<path d="M35 52.5C23.5 50 21.5 66 39.5 70M65 52.5C76.5 50 78.5 66 60.5 70" fill="none" stroke="url(#${u}ah)" stroke-width="2.7" stroke-linecap="round"/>`
      + `<path d="M34.6 53C25.4 51.6 24.2 64.4 38.8 68.6M65.4 53C74.6 51.6 75.8 64.4 61.2 68.6" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".5"/>`
      + `<path d="M34 49.5C34 64 40 74 47.6 78H52.4C60 74 66 64 66 49.5Z" fill="url(#${u}ag)"/>`
      + lin(`${u}bs`, [[.4, '#1B2230', 0], [1, '#1B2230', .5]]) + `<path d="M34 49.5C34 64 40 74 47.6 78H52.4C60 74 66 64 66 49.5Z" fill="url(#${u}bs)"/>`
      + `<path class="pa-fine" d="M34.3 51.7Q50 55.3 65.7 51.7" fill="none" stroke="#2E3440" stroke-opacity=".45" stroke-width=".8" stroke-dasharray=".5 .5"/>`
      + `<path class="pa-fine" d="M34.4 54.5Q50 58.5 65.6 54.5M35.3 57Q50 61 64.7 57" fill="none" stroke="#2E3440" stroke-opacity=".4" stroke-width=".35"/>`
      + `<circle cx="50" cy="65" r="6.4" fill="url(#${u}au)" stroke="#6E4505" stroke-width=".4"/><circle class="pa-fine" cx="50" cy="65" r="5.3" fill="none" stroke="#6E4505" stroke-width=".3"/>`
      + `<path d="${k.star(50, 65.3, 4.2)}" fill="#FFF1B8" stroke="#8A5C0A" stroke-width=".3"/>`
      + `<path d="M37.6 52.4C37.8 62 41 70.5 46.2 75.4" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.3" stroke-linecap="round"/>`
      + `<path d="M62.6 53C62.2 60 60.4 65.6 57.4 70" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".6" stroke-linecap="round"/>`
      // the lid, the gold lip, the finial and the football on top
      + `<path d="M35.6 46.6C37 42 43.6 40.4 50 40.4S63 42 64.4 46.6Z" fill="url(#${u}ag)"/>`
      + `<path d="M39 45C41 42.6 45 41.6 48 41.4" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width=".7" stroke-linecap="round"/>`
      + `<rect x="32.6" y="46.4" width="34.8" height="3.4" rx="1.3" fill="url(#${u}au)" stroke="#6E4505" stroke-width=".3"/>`
      + `<path d="M34 47.3H66" stroke="#FFF8DA" stroke-opacity=".8" stroke-width=".4"/>`
      + `<rect x="48.6" y="37.6" width="2.8" height="2.8" fill="url(#${u}au)"/><ellipse cx="50" cy="40.2" rx="3.4" ry="1.1" fill="url(#${u}au)"/>`
      + ball(u, 'ball', 50, 32.6, .8, -16)
      // the stem, its gold collar and knob, the foot and its gold band
      + `<path d="M47.6 78L48.7 90.6H51.3L52.4 78Z" fill="url(#${u}ag)"/><ellipse cx="50" cy="78.2" rx="3.6" ry="1" fill="url(#${u}au)"/>`
      + `<ellipse cx="50" cy="84.6" rx="4.8" ry="2.5" fill="url(#${u}au)" stroke="#6E4505" stroke-width=".3"/><path d="M46.6 83.8Q50 82.6 53.4 83.8" fill="none" stroke="#FFF8DA" stroke-width=".5"/>`
      + `<path d="M41.6 97.4C42.6 93.6 47 92.2 48.7 90.6H51.3C53 92.2 57.4 93.6 58.4 97.4Z" fill="url(#${u}ag)"/>`
      + `<rect x="40.2" y="96.8" width="19.6" height="2.6" rx=".8" fill="url(#${u}au)" stroke="#6E4505" stroke-width=".3"/>`
      // motes rising in the light, glints on the polish
      + [[29, 96, 0], [71, 88, 1.3], [60, 108, 2.4]].map(([x, y, d]) => `<circle class="pa-rise" style="--d:${d}s;--t:4.4s" cx="${x}" cy="${y}" r=".7" fill="#FFFBEA"/>`).join('')
      + [[58.6, 28.8, 3, 0], [34.4, 47.2, 2.4, .9], [54.6, 84, 2, 1.7], [39.2, 60, 2.2, 2.3]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" fill="#fff" d="${glint(x, y, r)}"/>`).join('');
  }},
  // Crown and Crest: a heraldic achievement: a gold-bordered shield in burgundy bearing a gold football between laurel
  // sprigs under a gold chief of three stars, a jewelled crown (strawberry-leaf fleurons, pearl-strung arches, a little
  // football for its orb), gold acanthus scrollwork either side, crossed lances flying pennants, a starred ribbon beneath.
  {id: 'leg-crown', name: 'Crown and Crest: a jewelled crown over a heraldic shield bearing a football, gold scrollwork, lances and a ribbon', svg: (u, k) => {
    // (the shield inset i from its edge: flat across the top at y 56, straight down to 80, curving in to its point at 108)
    const S = i => `M${f1(31 + i)} ${f1(56 + i)}H${f1(69 - i)}V80C${f1(69 - i)} ${f1(94 - i * .5)} ${f1(60.5 - i * .3)} ${f1(102 - i)} 50 ${f1(108 - i * 1.3)}`
      + `C${f1(39.5 + i * .3)} ${f1(102 - i)} ${f1(31 + i)} ${f1(94 - i * .5)} ${f1(31 + i)} 80Z`;
    // (a lance from its butt (bx, by) to its tip (tx, ty), s 1 on the left, -1 on the right: the shaft, its spearhead,
    // and a swallowtailed pennant flying outward from just under the head, a star on it)
    const lance = (bx, by, tx, ty, s) => {
      const L = Math.hypot(tx - bx, ty - by), dx = (tx - bx) / L, dy = (ty - by) / L, nx = s * dy, ny = -s * dx;
      const p = (a, b) => `${f1(tx + dx * a + nx * b)} ${f1(ty + dy * a + ny * b)}`, q = (a, b) => [f1(tx + dx * a + nx * b), f1(ty + dy * a + ny * b)];
      return {shaft: `M${f1(bx)} ${f1(by)}L${p(0, 0)}`, head: `M${p(6, 0)}L${p(1.4, 1.6)}L${p(-.6, 0)}L${p(1.4, -1.6)}Z`, tip: q(6.4, 0),
        flag: `M${p(-2, 0)}Q${p(0, 6)} ${p(-1.4, 13.4)}L${p(-6.2, 9.6)}L${p(-3.4, 14.6)}Q${p(-8.6, 7)} ${p(-10.4, 0)}Z`, star: k.star(...q(-5.4, 5.6), 1.5)};
    };
    const A = lance(80, 116, 24, 38, 1), B = lance(20, 116, 76, 38, -1);
    // (an almond leaf from (x, y), a degrees, l long; a strawberry-leaf fleuron on the crown's rim at x, s its size)
    const leaf = (x, y, a, l) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * .34, mx = x + c * l / 2, my = y + n * l / 2;
      return `M${x} ${y}Q${f1(mx - n * w)} ${f1(my + c * w)} ${f1(x + c * l)} ${f1(y + n * l)}Q${f1(mx + n * w)} ${f1(my - c * w)} ${x} ${y}Z`; };
    const fleur = (x, s) => { const p = (dx, dy) => `${f1(x + dx * s)} ${f1(50.8 + dy * s)}`;
      return `M${p(-1.6, 0)}C${p(-1.8, -3.4)} ${p(-4.4, -4)} ${p(-4, -6.4)}C${p(-3.6, -8.4)} ${p(-1.4, -8.2)} ${p(-1, -6.8)}C${p(-1.8, -9.4)} ${p(-.8, -11.6)} ${p(0, -12.4)}`
        + `C${p(.8, -11.6)} ${p(1.8, -9.4)} ${p(1, -6.8)}C${p(1.4, -8.2)} ${p(3.6, -8.4)} ${p(4, -6.4)}C${p(4.4, -4)} ${p(1.8, -3.4)} ${p(1.6, 0)}Z`; };
    // (the mantling's leaves, off the backs of its two scrolls, and their veins)
    const ML = [[27.6, 57.2, -115, 6], [21.4, 58.4, -142, 6.6], [16.6, 62.6, -168, 6.6], [14.8, 69, 168, 6.2], [15.8, 75.6, 146, 5.4],
      [26, 83, -150, 5.2], [20.6, 88.4, -178, 5.8], [18.6, 95, 160, 5.8], [20.4, 101.6, 134, 5.2]];
    const veins = ML.map(([x, y, a, l]) => { const r = a * Math.PI / 180; return `M${x} ${y}L${f1(x + Math.cos(r) * l * .8)} ${f1(y + Math.sin(r) * l * .8)}`; }).join('');
    const sprig = [[41.6, 99, -118, 4.4], [39.2, 95.4, -150, 4.4], [37.6, 91, -100, 4], [36, 87.6, -160, 4], [35.8, 83, -116, 3.8]];
    // (the ribbon's top edge at x, along its curve)
    const rib = x => { const t = (x - 22) / 56; return f1(106.4 + 11.2 * t * (1 - t)); };
    return rad(`${u}bg`, [[0, '#FFF6D2'], [.24, '#F2C656'], [.52, '#BC8418'], [.82, '#714608'], [1, '#3A2404']], 'cx="50%" cy="44%" r="72%"')
      + `<rect width="100" height="160" fill="url(#${u}bg)"/>`
      // a damask of lozenges and quatrefoils engraved in the gold
      + `<pattern id="${u}dm" width="10" height="12" patternUnits="userSpaceOnUse"><path d="M5 .6L9.4 6 5 11.4.6 6ZM5 3.6Q6 6 5 8.4Q4 6 5 3.6ZM2.6 6Q5 5 7.4 6Q5 7 2.6 6Z" fill="none" stroke="#6E4505" stroke-opacity=".22" stroke-width=".35"/></pattern>`
      + `<rect class="pa-fine" y="21" width="100" height="110" fill="url(#${u}dm)"/>`
      + `<g class="pa-spin" style="--oy:72px">${k.burst({cx: 50, cy: 72, n: 24, r: 130, w: .4, a: .2, c: '#FFF6D8'})}</g>`
      + k.glow({cx: 50, cy: 72, r: 40, c: '#FFF8DE', a: .75})
      // the lances behind, their pennants flying
      + lin(`${u}al`, GOLD, 'gradientUnits="userSpaceOnUse" x1="10" y1="0" x2="90" y2="0"')
      + `<path d="${A.shaft}${B.shaft}" stroke="#4A2C02" stroke-width="2" stroke-linecap="round"/><path d="${A.shaft}${B.shaft}" stroke="url(#${u}al)" stroke-width="1.2" stroke-linecap="round"/>`
      + lin(`${u}hd`, SILVER, 'x1="0" y1="0" x2="1" y2="0"') + `<path d="${A.head}${B.head}" fill="url(#${u}hd)" stroke="#3F4552" stroke-width=".3"/>`
      + lin(`${u}pn`, [[0, '#B8304C'], [.55, '#7A1228'], [1, '#480818']]) + `<path d="${A.flag}${B.flag}" fill="url(#${u}pn)" stroke="#E9BD48" stroke-width=".45" stroke-linejoin="round"/>`
      + `<path d="${A.star}${B.star}" fill="#F6D66E"/>`
      // the scrollwork either side (one side drawn, mirrored): two acanthus C-scrolls curling in, leaves off their backs,
      // fine tendrils and beads between
      + lin(`${u}am`, GOLD, 'gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="36" y2="0"')
      + `<defs><g id="${u}ma" fill="none" stroke-linecap="round"><path d="${ML.map(a => leaf(...a)).join('')}" fill="url(#${u}am)" stroke="#5A3804" stroke-width=".3"/>`
      + `<path class="pa-fine" d="${veins}" stroke="#5A3804" stroke-opacity=".55" stroke-width=".3"/>`
      + `<path d="M34 59C22 56 14 64 16 75C17.6 83 26.4 84.4 27.6 78.6C28.6 74 23.4 72.4 21.8 76.2M32 80C21 86 18.4 97 24.6 103.4C28.6 107.4 34.4 104.6 32.8 100.4C31.6 97.4 27.6 98.4 28 101.2" stroke="#5A3804" stroke-width="3.3"/>`
      + `<path d="M34 59C22 56 14 64 16 75C17.6 83 26.4 84.4 27.6 78.6C28.6 74 23.4 72.4 21.8 76.2M32 80C21 86 18.4 97 24.6 103.4C28.6 107.4 34.4 104.6 32.8 100.4C31.6 97.4 27.6 98.4 28 101.2" stroke="url(#${u}am)" stroke-width="2.3"/>`
      + `<path class="pa-fine" d="M31 58.2C21.6 56.2 15.6 63.6 17 73.6M30.4 81.4C21.6 87 19.6 96 24.4 101.6" stroke="#FFF8DA" stroke-opacity=".9" stroke-width=".45"/>`
      + `<path class="pa-fine" d="M30.6 64.6C26.4 64.4 24 67.6 25.6 70.2C26.8 72 29.2 71 28.6 69.4M30.8 87.4C27.6 88.6 26.8 92 28.8 93.4C30.4 94.4 32 92.6 30.8 91.4" stroke="url(#${u}am)" stroke-width=".7"/>`
      + `<path class="pa-fine" d="M24.6 66.4h.01M27.4 74.6h.01M25 91.6h.01M29.8 96.6h.01M12.6 80.6h.01M14.2 85.4h.01" stroke="#FFF1B8" stroke-width="1.3"/></g></defs>`
      + `<use href="#${u}ma"/><use href="#${u}ma" transform="matrix(-1 0 0 1 100 0)"/>`
      // the shield: its shadow, gold border bevelled, the burgundy field latticed, the chief with three stars, the
      // football between two laurel sprigs
      + lin(`${u}au`, GOLD, 'gradientUnits="userSpaceOnUse" x1="31" y1="0" x2="69" y2="0"')
      + rad(`${u}fd`, [[0, '#B02C48'], [.6, '#74102A'], [1, '#420614']], 'cx=".45" cy=".35" r=".8"')
      + `<path d="${S(0)}" transform="translate(1.2 1.8)" fill="#3A2204" fill-opacity=".4"/>`
      + `<path d="${S(0)}" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".45"/><path class="pa-fine" d="${S(1.1)}" fill="none" stroke="#FFF8DA" stroke-opacity=".7" stroke-width=".3"/>`
      + `<path d="${S(2.4)}" fill="url(#${u}fd)" stroke="#4A2C02" stroke-width=".4"/>`
      + `<pattern id="${u}dp" width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H3.6M0 0V3.6" fill="none" stroke="#FFD27A" stroke-opacity=".16" stroke-width=".3"/></pattern>`
      + `<path class="pa-fine" d="${S(2.4)}" fill="url(#${u}dp)"/>`
      + `<path d="M33.4 58.4H66.6V67.4H33.4Z" fill="url(#${u}au)"/><path d="M33.4 67.4H66.6" stroke="#4A2C02" stroke-width=".45"/>`
      + `<path d="${k.star(41.6, 63, 2.7)}${k.star(50, 62.8, 3)}${k.star(58.4, 63, 2.7)}" fill="#7A1228" stroke="#420614" stroke-width=".3"/>`
      + `<path d="M43.6 101.4Q35.4 94 36.2 81.6M56.4 101.4Q64.6 94 63.8 81.6" fill="none" stroke="#E9BD48" stroke-width=".6"/>`
      + `<path d="${sprig.map(a => leaf(...a)).join('')}${sprig.map(([x, y, a, l]) => leaf(100 - x, y, 180 - a, l)).join('')}" fill="url(#${u}au)" stroke="#5A3804" stroke-width=".2"/>`
      + ball(u, 'b1', 50, 84.6, 1.15, -32)
      // the crown: its velvet cap, pearl-strung arches, the orb (a little football), the rim of strawberry-leaf fleurons
      // and pearls, the band set with a ruby, sapphires and emeralds
      + rad(`${u}cp`, [[0, '#B8304C'], [1, '#480818']], 'cx=".4" cy=".35" r=".8"')
      + `<path d="M36.4 50.6C36.4 41 44 36.6 50 36.6C56 36.6 63.6 41 63.6 50.6Z" fill="url(#${u}cp)"/>`
      + `<path d="M35.6 50.6C35.6 40.4 43.4 35.8 50 35.8C56.6 35.8 64.4 40.4 64.4 50.6M50 50.6V35.8" fill="none" stroke="#4A2C02" stroke-width="2.7"/>`
      + `<path d="M35.6 50.6C35.6 40.4 43.4 35.8 50 35.8C56.6 35.8 64.4 40.4 64.4 50.6M50 50.6V35.8" fill="none" stroke="url(#${u}au)" stroke-width="2"/>`
      + `<path class="pa-fine" d="M35.6 48.4C35.6 40.4 43.4 35.8 50 35.8C56.6 35.8 64.4 40.4 64.4 48.4M50 46V37.6" fill="none" stroke="#FFF8E8" stroke-width="1" stroke-linecap="round" stroke-dasharray="0 2.1"/>`
      + `<circle cx="50" cy="35.4" r="1.6" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".3"/>` + ball(u, 'orb', 50, 31.6, .5, -24)
      + `<path d="${fleur(36.4, .82)}${fleur(50, 1.08)}${fleur(63.6, .82)}M42.4 51L43.2 45.6L44 51ZM56 51L56.8 45.6L57.6 51Z" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".35" stroke-linejoin="round"/>`
      + rad(`${u}pr`, [[0, '#FFFFFF'], [.6, '#F3E9D2'], [1, '#B9A57E']], 'cx=".35" cy=".3" r=".8"')
      + `<path d="M43.2 44.8m-1.25 0a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0-2.5 0M56.8 44.8m-1.25 0a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0-2.5 0" fill="url(#${u}pr)" stroke="#8A6A2A" stroke-width=".2"/>`
      + `<rect x="32.8" y="50.4" width="34.4" height="6.8" rx="1.2" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".4"/>`
      + `<path class="pa-fine" d="M34.4 51.7H65.6M34.4 55.9H65.6" fill="none" stroke="#FFF8E8" stroke-width=".8" stroke-linecap="round" stroke-dasharray="0 1.7"/>`
      + rad(`${u}rb`, [[0, '#FFC2CC'], [.45, '#E0213E'], [1, '#6A0014']], 'cx=".38" cy=".32" r=".75"') + rad(`${u}sa`, [[0, '#CFE0FF'], [.45, '#2C6CE0'], [1, '#0D2A70']], 'cx=".38" cy=".32" r=".75"')
      + rad(`${u}em`, [[0, '#C8FFE0'], [.45, '#16A060'], [1, '#05442A']], 'cx=".38" cy=".32" r=".75"')
      + `<ellipse cx="50" cy="53.8" rx="2.9" ry="2.2" fill="url(#${u}rb)" stroke="#4A2C02" stroke-width=".35"/>`
      + `<path d="M42.2 52.1a2 1.7 0 1 0 .01 0ZM57.8 52.1a2 1.7 0 1 0 .01 0Z" fill="url(#${u}sa)" stroke="#4A2C02" stroke-width=".3"/>`
      + `<path d="M36.4 51.9L38 53.8L36.4 55.7L34.8 53.8ZM63.6 51.9L65.2 53.8L63.6 55.7L62 53.8Z" fill="url(#${u}em)" stroke="#4A2C02" stroke-width=".3"/>`
      + `<path d="M48.8 52.8a.8.5 0 1 0 1.6 0a.8.5 0 1 0-1.6 0M41.4 52.8a.5.35 0 1 0 1 0a.5.35 0 1 0-1 0M57 52.8a.5.35 0 1 0 1 0a.5.35 0 1 0-1 0" fill="#fff" fill-opacity=".85"/>`
      // the ribbon beneath: its tails, the ends folded back, the band with gold edges and five stars
      + lin(`${u}rr`, [[0, '#A8304A'], [.5, '#7A1228'], [1, '#480818']])
      + `<path d="M16 109.4L7.6 109.8L11.6 114.2L7.6 118.6L16 118.2ZM84 109.4L92.4 109.8L88.4 114.2L92.4 118.6L84 118.2Z" fill="url(#${u}rr)" stroke="#3A0410" stroke-width=".35"/>`
      + `<path d="M22 106.4L16 109.4V118.2L22 115.2ZM78 106.4L84 109.4V118.2L78 115.2Z" fill="#3A0410"/>`
      + `<path d="M22 106.4Q50 117.6 78 106.4V115.2Q50 126.4 22 115.2Z" fill="url(#${u}rr)" stroke="#3A0410" stroke-width=".35"/>`
      + `<path d="M22.6 107.8Q50 119 77.4 107.8M22.6 113.8Q50 125 77.4 113.8" fill="none" stroke="#F3CF6A" stroke-width=".45"/>`
      + `<path d="${[30, 40, 50, 60, 70].map(x => k.star(x, rib(x) + 4.6, 2)).join('')}" fill="#F6D66E" stroke="#6E4505" stroke-width=".2"/>`
      // glints: the ruby, the orb, the shield's corner, the spearheads
      + [[51.6, 52.6, 2.4, 0], [52.6, 28.6, 2.6, 1.2], [32, 57, 2.4, 2], [...A.tip, 2.4, .6], [...B.tip, 2.4, 1.6]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" fill="#fff" d="${glint(x, y, r)}"/>`).join('');
  }},

  // Hall of Legends: down a marble hall to a glowing arched door: fluted columns with gold capitals either side under
  // gold-friezed beams, a coffered ceiling, burgundy banners hanging in rows, a checkered marble floor, shafts of light
  // falling across, and in front a golden helmet on a marble pedestal.
  {id: 'leg-hall', name: 'Hall of Legends: a marble hall of columns and hanging banners, a golden helmet on a pedestal in shafts of light', svg: (u, k) => {
    // (the hall in perspective, looking down it: a point wx across and wy down at depth s (1.3 nearest, .42 the far
    // wall) sits at (50 + wx s, 64 + wy s); the floor is at wy 52, the ceiling at -44, the side walls at wx ±50)
    const pt = (wx, wy, s) => `${f1(50 + wx * s)} ${f1(64 + wy * s)}`, N = 1.3, F = .42;
    const quad = (a, b, c, d) => `M${a}L${b}L${c}L${d}Z`;
    // (the floor's checks: rows evenly spaced in depth, every other one filled)
    const rows = Array.from({length: 9}, (_, i) => 1 / (1 / N + i * (1 / F - 1 / N) / 8));
    let chk = '';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++) if ((i + j) % 2) chk += quad(pt(j * 10 - 50, 52, rows[i]), pt(j * 10 - 40, 52, rows[i]), pt(j * 10 - 40, 52, rows[i + 1]), pt(j * 10 - 50, 52, rows[i + 1]));
    const coffer = [-30, -10, 10, 30].map(x => `M${pt(x, -44, N)}L${pt(x, -44, F)}`).join('') + [.95, .7, .55].map(s => `M${pt(-50, -44, s)}L${pt(50, -44, s)}`).join('');
    // (the beams along the colonnades: their inner faces and undersides; the columns and banners far to near)
    const beam = w => quad(pt(w * 34, -46, N), pt(w * 34, -46, F), pt(w * 34, -36, F), pt(w * 34, -36, N));
    const under = w => quad(pt(w * 46, -36, N), pt(w * 46, -36, F), pt(w * 34, -36, F), pt(w * 34, -36, N));
    const dent = [-1, 1].map(w => Array.from({length: 18}, (_, i) => { const s = 1 / (1 / N + i * (1 / F - 1 / N) / 18); return `M${pt(w * 34, -38.4, s)}V${f1(64 - 36 * s)}`; }).join('')).join('');
    const col = s => `<use href="#${u}col" transform="translate(${f1(50 - 40 * s)} ${f1(64 - 36 * s)}) scale(${s})"/><use href="#${u}col" transform="translate(${f1(50 + 40 * s)} ${f1(64 - 36 * s)}) scale(${s})"/>`;
    const ban = s => `<use href="#${u}ban" transform="translate(${f1(50 - 22 * s)} ${f1(64 - 44 * s)}) scale(${s})"/><use href="#${u}ban" transform="translate(${f1(50 + 22 * s)} ${f1(64 - 44 * s)}) scale(${s})"/>`;
    return lin(`${u}cl`, [[0, '#5A3A08'], [1, '#A8761E']]) + `<rect width="100" height="160" fill="url(#${u}cl)"/>`
      // the ceiling, coffered; the side walls; the far wall and its door pouring light
      + `<path d="${quad(pt(-50, -44, N), pt(50, -44, N), pt(50, -44, F), pt(-50, -44, F))}" fill="url(#${u}cl)"/>`
      + `<path class="pa-fine" d="${coffer}" fill="none" stroke="#FFE7A0" stroke-opacity=".3" stroke-width=".4"/>`
      + lin(`${u}wl`, [[0, '#8E5E14'], [1, '#D9A440']], 'x1="0" y1="0" x2="1" y2="0"')
      + `<path d="${quad(pt(-50, -44, N), pt(-50, -44, F), pt(-50, 52, F), pt(-50, 52, N))}" fill="url(#${u}wl)"/>`
      + `<path d="${quad(pt(50, -44, N), pt(50, -44, F), pt(50, 52, F), pt(50, 52, N))}" fill="url(#${u}wl)" transform="matrix(-1 0 0 1 100 0)"/>`
      + lin(`${u}bw`, [[0, '#E9C46A'], [1, '#F7E3AE']]) + `<path d="${quad(pt(-50, -44, F), pt(50, -44, F), pt(50, 52, F), pt(-50, 52, F))}" fill="url(#${u}bw)"/>`
      + k.glow({cx: 50, cy: 72, r: 30, c: '#FFFBEA', a: .95})
      + rad(`${u}dr`, [[0, '#FFFFFF'], [.6, '#FFF6D6'], [1, '#FFE19A']], 'cx=".5" cy=".7" r=".8"')
      + `<path d="M43.4 85.8V67A6.6 6.6 0 0 1 56.6 67V85.8Z" fill="url(#${u}dr)" stroke="#B98314" stroke-width=".8"/>`
      + `<path class="pa-fine" d="M41.8 85.8V66.6A8.2 8.2 0 0 1 58.2 66.6V85.8" fill="none" stroke="#B98314" stroke-width=".4"/>`
      // the floor: cream marble checked in gold, polished, the door's light running down it
      + lin(`${u}fl`, [[0, '#FFF3D2'], [1, '#E9CF8E']]) + `<path d="${quad(pt(-50, 52, N), pt(50, 52, N), pt(50, 52, F), pt(-50, 52, F))}" fill="url(#${u}fl)"/>`
      + lin(`${u}ck`, [[0, '#C8901C'], [1, '#8A5A0E']]) + `<path d="${chk}" fill="url(#${u}ck)"/>`
      + lin(`${u}rl`, [[0, '#FFFBEA', .85], [1, '#FFFBEA', 0]]) + `<path d="M43.4 85.8H56.6L66 131H34Z" fill="url(#${u}rl)"/>`
      + k.burst({cx: 50, cy: 70, n: 18, r: 90, w: .3, a: .12, c: '#FFFBEA'})
      // the beams, gold-friezed, over the colonnades
      + lin(`${u}bm`, GOLD, 'x1="0" y1="0" x2="0" y2="1"')
      + `<path d="${beam(-1)}${beam(1)}" fill="url(#${u}bm)" stroke="#5A3804" stroke-width=".3"/><path d="${under(-1)}${under(1)}" fill="#6E4505"/>`
      + `<path class="pa-fine" d="${dent}" stroke="#5A3804" stroke-opacity=".6" stroke-width=".7"/>`
      // a column (fluted marble, a gold capital and base) and a banner (burgundy, gold-trimmed, a star over two stripes)
      + lin(`${u}mc`, [[0, '#B8A47A'], [.3, '#FFFDF6'], [.62, '#F1E6CC'], [1, '#9C8760']], 'x1="0" y1="0" x2="1" y2="0"')
      + lin(`${u}gc`, GOLD, 'x1="0" y1="0" x2="1" y2="0"') + lin(`${u}bn`, [[0, '#B8304C'], [.5, '#8E1830'], [1, '#5A0A1C']], 'x1="0" y1="0" x2="1" y2="0"')
      + `<defs><g id="${u}col"><rect x="-3.6" y="5" width="7.2" height="75" fill="url(#${u}mc)"/><path class="pa-fine" d="M-2.2 6V79M-.7 6V79M.7 6V79M2.2 6V79" stroke="#8E7A52" stroke-opacity=".55" stroke-width=".3"/>`
      + `<path d="M-5.6 0H5.6V2.4H-5.6ZM-4.8 2.4H4.8L3.8 5H-3.8ZM-4.2 80H4.2L5 83H-5ZM-5.6 83H5.6V88H-5.6Z" fill="url(#${u}gc)" stroke="#5A3804" stroke-width=".25"/>`
      + `<path d="M-5.4 3.8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M2.4 3.8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0" fill="url(#${u}gc)" stroke="#5A3804" stroke-width=".25"/></g>`
      + `<g id="${u}ban"><path d="M-5 1H5V30L0 26.2L-5 30Z" fill="url(#${u}bn)"/><path d="M-4 2V27.6L0 24.6L4 27.6V2" fill="none" stroke="#F3CF6A" stroke-width=".5"/>`
      + `<path d="${k.star(0, 11, 3.4)}M-3.2 17H3.2V18.4H-3.2ZM-3.2 19.6H3.2V20.4H-3.2Z" fill="#F6D66E"/><path d="M-6 0H6V1.4H-6Z" fill="url(#${u}gc)"/></g></defs>`
      + col(.49) + ban(.54) + col(.6) + ban(.7) + col(.78) + ban(.95) + col(1.12)
      // the shafts of light falling across, motes in them
      + lin(`${u}sh`, [[0, '#FFFBEA', .55], [1, '#FFFBEA', 0]])
      + `<path class="pa-pulse" style="--t:5s" d="M14 21H23L64 124H44Z" fill="url(#${u}sh)"/><path class="pa-pulse" style="--t:5s;--d:2.5s" d="M80 21H87L60 124H48Z" fill="url(#${u}sh)"/>`
      + [[36, 88, 0], [62, 94, 1.5], [44, 104, 2.8]].map(([x, y, d]) => `<circle class="pa-rise" style="--d:${d}s;--t:4.6s" cx="${x}" cy="${y}" r=".7" fill="#FFFBEA"/>`).join('')
      // the pedestal: gold slabs, a marble body with a gold-framed panel, its shadow on the floor
      + `<ellipse cx="50" cy="123" rx="17" ry="2.6" fill="#5A3804" fill-opacity=".35"/>`
      + lin(`${u}pg`, GOLD, 'gradientUnits="userSpaceOnUse" x1="34" y1="0" x2="66" y2="0"') + lin(`${u}pm`, [[0, '#C9B994'], [.3, '#FFFDF6'], [.65, '#F1E6CC'], [1, '#A8976E']], 'x1="0" y1="0" x2="1" y2="0"')
      + `<rect x="38.6" y="101" width="22.8" height="17" fill="url(#${u}pm)"/>`
      + `<path class="pa-fine" d="M40 104Q44 106 43 110M58 103Q55 108 59.6 112M46 113Q50 114 52 117" fill="none" stroke="#9C8762" stroke-opacity=".55" stroke-width=".3"/>`
      + `<rect x="43" y="104" width="14" height="10.6" rx=".6" fill="none" stroke="url(#${u}pg)" stroke-width=".9"/><path d="${k.star(50, 109.3, 3)}" fill="url(#${u}pg)" stroke="#6E4505" stroke-width=".25"/>`
      + `<path d="M36 98.4H64V101H36ZM35 118H65V122.4H35Z" fill="url(#${u}pg)" stroke="#5A3804" stroke-width=".3"/>`
      // the golden helmet, turned to the right: its shell, the burgundy stripe, a star decal, the ear hole, the
      // facemask, the shine
      + rad(`${u}hm`, [[0, '#FFF6CC'], [.3, '#F2C64E'], [.7, '#A8740E'], [1, '#5A3804']], 'cx=".36" cy=".26" r=".85"')
      + `<path d="M60.6 85.4L66.4 84.6L67.4 94.4L60.6 95Z" fill="#2E1D03"/>`
      + `<path d="M38.4 94.6C35.4 84.6 40.4 73.4 51 72.8C59.8 72.4 65.8 77.6 66 84.6L61 85.4C59.4 85.6 58.8 87 59.2 88.6L60.6 95C55 97.4 46.4 98.2 41.4 97.6C40 97.2 39 96.2 38.4 94.6Z" fill="url(#${u}hm)" stroke="#4A2C02" stroke-width=".45"/>`
      + `<path d="M39.6 87.6C38.6 79 44.4 74 51 73.6C57.6 73.2 63.2 76.8 64.6 81.6" fill="none" stroke="#8E1830" stroke-width="2.6"/>`
      + `<path class="pa-fine" d="M39.6 87.6C38.6 79 44.4 74 51 73.6C57.6 73.2 63.2 76.8 64.6 81.6" fill="none" stroke="#FFF1B8" stroke-width=".35" stroke-dasharray="1.2 .6"/>`
      + `<path d="${k.star(49, 84.6, 3.4)}" fill="#8E1830" stroke="#FFF1B8" stroke-width=".35"/>`
      + `<circle cx="55.4" cy="89.6" r="1.5" fill="#3A2404" stroke="#FFE7A0" stroke-width=".4"/>`
      + `<path d="M59.4 86.6H67.4Q69.6 86.6 69.6 88.8V93.2Q69.6 95.6 67.2 95.6H60.4M59.8 91H69.6M64.4 86.6V95.6" fill="none" stroke="#4A2C02" stroke-width="1.5" stroke-linejoin="round"/>`
      + `<path d="M59.4 86.6H67.4Q69.6 86.6 69.6 88.8V93.2Q69.6 95.6 67.2 95.6H60.4M59.8 91H69.6M64.4 86.6V95.6" fill="none" stroke="#F3CF6A" stroke-width=".8" stroke-linejoin="round"/>`
      + `<path d="M42.4 82C43 77.6 46.6 75 50.6 74.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1" stroke-linecap="round"/>`
      // glints: the helmet, the capitals, the door
      + [[45, 76, 2.6, 0], [67.4, 87.4, 2, 1.1], [21.4, 37.6, 2, 2], [78.6, 37.6, 2, .6], [50, 60.6, 2.6, 1.6]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" fill="#fff" d="${glint(x, y, r)}"/>`).join('');
  }},
  // The Ring: a gold championship ring in a burgundy velvet cushion: its octagonal top set with a gold football on a
  // field of pavé diamonds, ringed with rubies, stars engraved at its corners; starred shoulders, the polished band
  // sinking into the cushion's slit; the cushion piped in gold with tassels, a spotlight and a burst of light.
  {id: 'leg-ring', name: 'The Ring: a gold championship ring set with diamonds and rubies on a velvet cushion', svg: (u, k) => {
    // (the ring's top: an octagon about (50, y), 36 across and 27 deep, its corners cut c)
    const oct = (y, w = 18, h = 13.5, c = 5.8) => `M${f1(50 - w + c)} ${f1(y - h)}H${f1(50 + w - c)}L${50 + w} ${f1(y - h + c * .74)}V${f1(y + h - c * .74)}L${f1(50 + w - c)} ${f1(y + h)}`
      + `H${f1(50 - w + c)}L${50 - w} ${f1(y + h - c * .74)}V${f1(y - h + c * .74)}Z`;
    const E = (cx, cy, rx, ry) => `M${f1(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    return rad(`${u}bg`, [[0, '#FFF3C8'], [.26, '#F0C04E'], [.55, '#B67C14'], [.84, '#6A4208'], [1, '#3A2404']], 'cx="50%" cy="40%" r="72%"')
      + `<rect width="100" height="160" fill="url(#${u}bg)"/>`
      + `<g class="pa-spin" style="--oy:62px">${k.burst({cx: 50, cy: 62, n: 26, r: 130, w: .38, a: .2, c: '#FFF6D8'})}</g>`
      + `<g class="pa-fine">${k.burst({cx: 50, cy: 62, n: 52, r: 130, w: .1, a: .12, c: '#FFFBEA'})}</g>`
      + lin(`${u}sp`, [[0, '#FFFBEA', .45], [1, '#FFFBEA', 0]]) + `<path class="pa-pulse" style="--t:6s" d="M38 21H62L90 118H10Z" fill="url(#${u}sp)"/>`
      + k.glow({cx: 50, cy: 64, r: 36, c: '#FFF8DE', a: .8})
      // the cushion behind the ring: its top in velvet, the back edge piped
      + rad(`${u}vt`, [[0, '#D2506A'], [.55, '#9A1E38'], [1, '#5A0A1C']], 'cx=".5" cy=".3" r=".7"')
      + `<path d="M10 100Q50 88 90 100L92 110Q50 120 8 110Z" fill="url(#${u}vt)"/>`
      + lin(`${u}pi`, GOLD, 'gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="92" y2="0"')
      + `<path d="M10 100Q50 88 90 100" fill="none" stroke="url(#${u}pi)" stroke-width="1.2"/>`
      + `<path d="M23 99.4Q50 103.6 77 99.4" fill="none" stroke="#3A0410" stroke-width="1.6" stroke-linecap="round"/>`
      // the band: polished gold, its inner face showing at the top of the hole, starred shoulders, the shine
      + lin(`${u}au`, GOLD, 'gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="70" y2="0"')
      + `<path d="${E(50, 84, 20, 18)}${E(50, 86, 13.4, 11.6)}" fill="url(#${u}au)" fill-rule="evenodd" stroke="#4A2C02" stroke-width=".45"/>`
      + lin(`${u}in`, [[0, '#5A3804'], [1, '#C8901C']]) + `<path d="${E(50, 86, 13.4, 11.6)}${E(50, 88.6, 13.4, 10.4)}" fill="url(#${u}in)" fill-rule="evenodd"/>`
      + `<path d="M30.8 79.4Q30.2 90 36.4 97.4M69.2 79.4Q69.8 90 63.6 97.4" fill="none" stroke="#FFF8DA" stroke-opacity=".8" stroke-width=".7" stroke-linecap="round"/>`
      + `<path d="M31.6 74.4L36.6 76.6L37.2 88L32.6 86ZM68.4 74.4L63.4 76.6L62.8 88L67.4 86Z" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".35"/>`
      + `<path d="${k.star(34.5, 81.2, 1.7)}${k.star(65.5, 81.2, 1.7)}" fill="#6E4505"/>`
      // the top: its side (the setting's depth), the gold face, the dotted border, stars at its corners, a ring of rubies,
      // the pavé of diamonds, the gold football
      + `<path d="${oct(60.6)}" fill="#7A4E06" stroke="#4A2C02" stroke-width=".45"/>`
      + `<path d="${oct(57)}" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".45"/>`
      + `<path class="pa-fine" d="${oct(57, 16.6, 12.2, 5.2)}" fill="none" stroke="#5A3804" stroke-opacity=".7" stroke-width=".5" stroke-dasharray=".4 .7"/>`
      + `<path d="${k.star(37.4, 47.6, 1.6)}${k.star(62.6, 47.6, 1.6)}${k.star(37.4, 66.4, 1.6)}${k.star(62.6, 66.4, 1.6)}" fill="#6E4505"/>`
      + `<path d="${E(50, 57, 13.4, 9.8)}" fill="#3A0410"/><path d="${E(50, 57, 12.6, 9.1)}" fill="none" stroke="#D0203C" stroke-width="2" stroke-linecap="round" stroke-dasharray="0 3.3"/>`
      + `<path class="pa-fine" d="${E(50, 56.6, 12.6, 9.1)}" fill="none" stroke="#FFC2CC" stroke-width=".7" stroke-linecap="round" stroke-dasharray="0 3.3"/>`
      + rad(`${u}dg`, [[0, '#FFFFFF'], [.5, '#E4EEFA'], [1, '#8C9CB4']], 'cx=".35" cy=".3" r=".8"')
      + `<pattern id="${u}pv" width="2.2" height="1.9" patternUnits="userSpaceOnUse"><circle cx=".55" cy=".48" r=".52" fill="url(#${u}dg)"/><circle cx="1.65" cy="1.43" r=".52" fill="url(#${u}dg)"/></pattern>`
      + `<path d="${E(50, 57, 10.8, 7.8)}" fill="#B9C6D8"/><path d="${E(50, 57, 10.8, 7.8)}" fill="url(#${u}pv)"/>`
      + ball(u, 'ball', 50, 57, .82, -22)
      // the cushion in front: the lip over the slit, its front face, gold piping, tufted buttons, the tassels
      + `<path d="M23 99.4Q50 103.6 77 99.4L92 110Q50 120 8 110Z" fill="url(#${u}vt)"/>`
      + lin(`${u}vf`, [[0, '#7A1228'], [1, '#3A0410']]) + `<path d="M8 110Q50 120 92 110L90 121Q50 130 10 121Z" fill="url(#${u}vf)"/>`
      + `<path d="M8 110Q50 120 92 110" fill="none" stroke="url(#${u}pi)" stroke-width="1.4"/>`
      + `<path class="pa-fine" d="M8 110Q50 120 92 110" fill="none" stroke="#5A3804" stroke-width="1.4" stroke-dasharray=".5 1"/>`
      + `<path class="pa-fine" d="M22 107.2l-3-1.6M22 107.2l3-1.4M22 107.2l-.4 2.8M78 107.2l3-1.6M78 107.2l-3-1.4M78 107.2l.4 2.8" stroke="#3A0410" stroke-opacity=".7" stroke-width=".4"/>`
      + `<path d="M22 107.2m-1.2 0a1.2 1 0 1 0 2.4 0a1.2 1 0 1 0-2.4 0M78 107.2m-1.2 0a1.2 1 0 1 0 2.4 0a1.2 1 0 1 0-2.4 0" fill="url(#${u}pi)"/>`
      + `<defs><g id="${u}ts"><circle cx="8.6" cy="111" r="1.8" fill="url(#${u}pi)"/><path d="M7.4 112.4h2.4l2 11.4q-3.2 1.2-6.4 0z" fill="url(#${u}pi)" stroke="#5A3804" stroke-width=".3"/>`
      + `<path class="pa-fine" d="M7.8 114V123.6M8.6 114V124M9.4 114V123.6M10.2 114L11 123.2" stroke="#6E4505" stroke-width=".25"/></g></defs>`
      + `<use href="#${u}ts"/><use href="#${u}ts" transform="matrix(-1 0 0 1 100 0)"/>`
      // glints: the diamonds, the rubies, the band
      + [[44, 52.6, 2.4, 0], [56.6, 61, 2.2, 1], [61.8, 50.4, 2.4, 1.8], [36.8, 54, 2, .5], [31.4, 84, 2.4, 2.3]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" fill="#fff" d="${glint(x, y, r)}"/>`).join('');
  }}
];
