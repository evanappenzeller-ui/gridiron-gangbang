// The Legends Pack's art designs (views/dynasty-packs.js frames them: tier 5, gold #C9A227; the frame already draws its
// foil sheen, crimped seals, an embossed quilt, champagne holo foil, a light sweep, seven sparkles, a gold filigree
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
  // standing on a two-tier cream marble plinth (its gold plaque, its foot reflected in the floor) inside a gold laurel
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
      // (the rest a little lower, the finial clear of the tear)
      + '<g transform="translate(0 2)">'
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
      + lin(`${u}rf`, [[0, '#F1E8D4', .45], [1, '#F1E8D4', 0]]) + `<path d="M28.4 120.6h43.2l-2 4.6H30.4Z" fill="url(#${u}rf)"/>`
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
      + [[58.6, 28.8, 3, 0], [34.4, 47.2, 2.4, .9], [54.6, 84, 2, 1.7], [39.2, 60, 2.2, 2.3]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" fill="#fff" d="${glint(x, y, r)}"/>`).join('') + '</g>';
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
        ferrule: `M${p(-.4, -1.2)}L${p(-.4, 1.2)}L${p(-2.2, 1.1)}L${p(-2.2, -1.1)}Z`, a: q(-6, 0), b: q(-6, 14),
        flag: `M${p(-2, 0)}Q${p(0, 6)} ${p(-1.4, 13.4)}L${p(-6.2, 9.6)}L${p(-3.4, 14.6)}Q${p(-8.6, 7)} ${p(-10.4, 0)}Z`, star: k.star(...q(-5.4, 4.6), 1.5)};
    };
    const A = lance(80, 116, 24, 38, 1), B = lance(20, 116, 76, 38, -1);
    // (an almond leaf from (x, y), a degrees, l long; a strawberry-leaf fleuron on the crown's rim at x, s its size)
    const leaf = (x, y, a, l) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * .34, mx = x + c * l / 2, my = y + n * l / 2;
      return `M${x} ${y}Q${f1(mx - n * w)} ${f1(my + c * w)} ${f1(x + c * l)} ${f1(y + n * l)}Q${f1(mx + n * w)} ${f1(my - c * w)} ${x} ${y}Z`; };
    const fleur = (x, s) => { const p = (dx, dy) => `${f1(x + dx * s)} ${f1(50.8 + dy * s)}`;
      return `M${p(-1.6, 0)}C${p(-1.8, -3.4)} ${p(-4.4, -4)} ${p(-4, -6.4)}C${p(-3.6, -8.4)} ${p(-1.4, -8.2)} ${p(-1, -6.8)}C${p(-1.8, -9.4)} ${p(-.8, -11.6)} ${p(0, -12.4)}`
        + `C${p(.8, -11.6)} ${p(1.8, -9.4)} ${p(1, -6.8)}C${p(1.4, -8.2)} ${p(3.6, -8.4)} ${p(4, -6.4)}C${p(4.4, -4)} ${p(1.8, -3.4)} ${p(1.6, 0)}Z`; };
    // (the mantling's acanthus leaves, off the backs of its two scrolls: x, y, angle, length)
    const ML = [[27.6, 57.2, -115, 6], [21.4, 58.4, -142, 6.6], [16.6, 62.6, -168, 6.6], [14.8, 69, 168, 6.2], [15.8, 75.6, 146, 5.4],
      [26, 83, -150, 5.2], [20.6, 88.4, -178, 5.8], [18.6, 95, 160, 5.8], [20.4, 101.6, 134, 5.2]];
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
      + `<path d="${A.shaft}${B.shaft}" stroke="#4A2C02" stroke-width="2.7" stroke-linecap="round"/><path d="${A.shaft}${B.shaft}" stroke="url(#${u}al)" stroke-width="1.6" stroke-linecap="round"/>`
      + `<path class="pa-fine" d="${A.shaft}${B.shaft}" stroke="#FFF8DA" stroke-opacity=".6" stroke-width=".35" transform="translate(-.3 -.2)"/>`
      + lin(`${u}hd`, SILVER, 'x1="0" y1="0" x2="1" y2="0"') + `<path d="${A.head}${B.head}" fill="url(#${u}hd)" stroke="#3F4552" stroke-width=".3"/>`
      + `<path d="${A.ferrule}${B.ferrule}" fill="url(#${u}al)" stroke="#4A2C02" stroke-width=".3"/>`
      // (the pennants in the shield's burgundy, a fold shadow across each where it waves)
      + [A, B].map((L, i) => lin(`${u}p${i}`, [[0, '#B8304C'], [.38, '#8E1830'], [.5, '#5A0A1C'], [.6, '#8E1830'], [1, '#5A0A1C']], `gradientUnits="userSpaceOnUse" x1="${L.a[0]}" y1="${L.a[1]}" x2="${L.b[0]}" y2="${L.b[1]}"`)
        + `<path d="${L.flag}" fill="url(#${u}p${i})" stroke="#E9BD48" stroke-width=".55" stroke-linejoin="round"/>`).join('')
      + `<path d="${A.star}${B.star}" fill="#F6D66E" stroke="#6E4505" stroke-width=".15"/>`
      // the scrollwork either side (one side drawn, mirrored): two acanthus C-scrolls curling in, leaves off their backs,
      // fine tendrils and beads between
      + lin(`${u}am`, GOLD, 'gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="36" y2="0"')
      + lin(`${u}lv`, [[0, '#FFF4C4'], [.45, '#E9B940'], [1, '#8A5A0A']])
      + `<defs><g id="${u}ac"><path d="M0 0C1.8-3 5.2-4.4 8.2-3.8C9.6-3.6 10.6-2.6 10.4-1.4C9.6-2.2 8.4-2.2 8-1.4C9.8-1.4 11.6-.2 11.4 1.4C10.6.6 9.6.6 9 1.2C9.6 2 9.4 3 8.6 3.4C8.2 2.2 6.8 1.8 5.6 2.4C4.2 1.4 2 1.2 0 0Z" fill="url(#${u}lv)" stroke="#5A3804" stroke-width=".3" stroke-linejoin="round"/>`
      + `<path class="pa-fine" d="M.8 0Q5.6-1.4 9.6-.2M5.4-.8Q7-1.6 7.6-2.8M6.4-.6Q7.6.6 7.8 2" fill="none" stroke="#6E4505" stroke-opacity=".7" stroke-width=".28" stroke-linecap="round"/></g></defs>`
      + `<defs><g id="${u}ma" fill="none" stroke-linecap="round">`
      + `<path d="M34 59C22 56 14 64 16 75C17.6 83 26.4 84.4 27.6 78.6C28.6 74 23.4 72.4 21.8 76.2M32 80C21 86 18.4 97 24.6 103.4C28.6 107.4 34.4 104.6 32.8 100.4C31.6 97.4 27.6 98.4 28 101.2" stroke="#5A3804" stroke-width="3.3"/>`
      + `<path d="M34 59C22 56 14 64 16 75C17.6 83 26.4 84.4 27.6 78.6C28.6 74 23.4 72.4 21.8 76.2M32 80C21 86 18.4 97 24.6 103.4C28.6 107.4 34.4 104.6 32.8 100.4C31.6 97.4 27.6 98.4 28 101.2" stroke="url(#${u}am)" stroke-width="2.3"/>`
      + `<path class="pa-fine" d="M31 58.2C21.6 56.2 15.6 63.6 17 73.6M30.4 81.4C21.6 87 19.6 96 24.4 101.6" stroke="#FFF8DA" stroke-opacity=".9" stroke-width=".45"/>`
      + `<path class="pa-fine" d="M30.6 64.6C26.4 64.4 24 67.6 25.6 70.2C26.8 72 29.2 71 28.6 69.4M30.8 87.4C27.6 88.6 26.8 92 28.8 93.4C30.4 94.4 32 92.6 30.8 91.4" stroke="url(#${u}am)" stroke-width=".7"/>`
      + `<path class="pa-fine" d="M24.6 66.4h.01M27.4 74.6h.01M25 91.6h.01M29.8 96.6h.01M12.6 80.6h.01M14.2 85.4h.01" stroke="#FFF1B8" stroke-width="1.3"/>`
      // (layered acanthus over the scrolls' backs, curling outward)
      + ML.map(([x, y, a, l]) => `<use href="#${u}ac" transform="translate(${x} ${y}) rotate(${a}) scale(${f1(l / 6.4)} ${f1(l / 7.2)})"/>`).join('') + '</g></defs>'
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

  // Hall of Legends: down a marble hall to a great lit portal: fluted columns with gold capitals either side under
  // gold-friezed beams, a coffered ceiling, burgundy banners hung from gilded crossbars, a checkered marble floor,
  // shafts of light falling across, and in front, against the light, a golden helmet on a marble pedestal.
  {id: 'leg-hall', name: 'Hall of Legends: a marble hall of columns and hanging banners, a golden helmet on a pedestal before a glowing portal', svg: (u, k) => {
    // (the hall in perspective, looking down it: a point wx across and wy down at depth s (1.3 nearest, .5 the far
    // wall) sits at (50 + wx s, 64 + wy s); the floor is at wy 52, the ceiling at -44, the side walls at wx ±50)
    const pt = (wx, wy, s) => `${f1(50 + wx * s)} ${f1(64 + wy * s)}`, N = 1.3, F = .5;
    const quad = (a, b, c, d) => `M${a}L${b}L${c}L${d}Z`;
    // (the floor's checks: rows evenly spaced in depth, every other one filled)
    const rows = Array.from({length: 9}, (_, i) => 1 / (1 / N + i * (1 / F - 1 / N) / 8));
    let chk = '';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++) if ((i + j) % 2) chk += quad(pt(j * 10 - 50, 52, rows[i]), pt(j * 10 - 40, 52, rows[i]), pt(j * 10 - 40, 52, rows[i + 1]), pt(j * 10 - 50, 52, rows[i + 1]));
    const coffer = [-30, -10, 10, 30].map(x => `M${pt(x, -44, N)}L${pt(x, -44, F)}`).join('') + [1.1, .82, .62].map(s => `M${pt(-50, -44, s)}L${pt(50, -44, s)}`).join('');
    // (the beams along the colonnades: their inner faces and undersides; gilded crossbars between them that the banners
    // hang from; the columns and banners far to near)
    const beam = w => quad(pt(w * 34, -46, N), pt(w * 34, -46, F), pt(w * 34, -36, F), pt(w * 34, -36, N));
    const under = w => quad(pt(w * 46, -36, N), pt(w * 46, -36, F), pt(w * 34, -36, F), pt(w * 34, -36, N));
    const dent = [-1, 1].map(w => Array.from({length: 16}, (_, i) => { const s = 1 / (1 / N + i * (1 / F - 1 / N) / 16); return `M${pt(w * 34, -38.4, s)}V${f1(64 - 36 * s)}`; }).join('')).join('');
    const bars = [.74, .95].map(s => `M${pt(-34, -41.6, s)}H${f1(50 + 34 * s)}V${f1(64 - 40 * s)}H${f1(50 - 34 * s)}Z`).join('');
    const col = s => `<use href="#${u}col" transform="translate(${f1(50 - 40 * s)} ${f1(64 - 36 * s)}) scale(${s})"/><use href="#${u}col" transform="translate(${f1(50 + 40 * s)} ${f1(64 - 36 * s)}) scale(${s})"/>`;
    const ban = s => `<use href="#${u}ban" transform="translate(${f1(50 - 24 * s)} ${f1(64 - 40 * s)}) scale(${s})"/><use href="#${u}ban" transform="translate(${f1(50 + 24 * s)} ${f1(64 - 40 * s)}) scale(${s})"/>`;
    // (the portal: an arch x0..x1 from the floor at y 90 up to its crown at top)
    const arch = (x0, x1, top) => { const r = (x1 - x0) / 2; return `M${x0} 90V${f1(top + r)}A${r} ${r} 0 0 1 ${x1} ${f1(top + r)}V90Z`; };
    return lin(`${u}cl`, [[0, '#5A3A08'], [1, '#A8761E']]) + `<rect width="100" height="160" fill="url(#${u}cl)"/>`
      // the ceiling, coffered; the side walls (the left drawn, mirrored); the far wall and its portal pouring light
      + `<path class="pa-fine" d="${coffer}" fill="none" stroke="#FFE7A0" stroke-opacity=".3" stroke-width=".4"/>`
      + lin(`${u}wl`, [[0, '#8E5E14'], [1, '#D9A440']], 'x1="0" y1="0" x2="1" y2="0"')
      + `<path d="${quad(pt(-50, -44, N), pt(-50, -44, F), pt(-50, 52, F), pt(-50, 52, N))}" fill="url(#${u}wl)"/>`
      + `<path d="${quad(pt(-50, -44, N), pt(-50, -44, F), pt(-50, 52, F), pt(-50, 52, N))}" fill="url(#${u}wl)" transform="matrix(-1 0 0 1 100 0)"/>`
      + lin(`${u}bw`, [[0, '#E2B85A'], [1, '#F2D898']]) + `<path d="${quad(pt(-50, -44, F), pt(50, -44, F), pt(50, 52, F), pt(-50, 52, F))}" fill="url(#${u}bw)"/>`
      + k.glow({cx: 50, cy: 66, r: 34, c: '#FFFBEA', a: .95})
      + `<path d="${arch(30, 70, 38)}" fill="#FFF8E4" fill-opacity=".28"/><path d="${arch(33, 67, 41)}" fill="#FFFBEA" fill-opacity=".45"/>`
      + rad(`${u}dr`, [[0, '#FFFFFF'], [.55, '#FFFBEA'], [.85, '#FFF1C4'], [1, '#FBE3A0']], 'cx=".5" cy=".62" r=".75"')
      + `<path d="${arch(36, 64, 44)}" fill="url(#${u}dr)"/>`
      // the floor: cream marble softly checked in gold, polished, the portal's light running down it
      + lin(`${u}fl`, [[0, '#FFF3D2'], [1, '#EBD39A']]) + `<path d="${quad(pt(-50, 52, N), pt(50, 52, N), pt(50, 52, F), pt(-50, 52, F))}" fill="url(#${u}fl)"/>`
      + lin(`${u}ck`, [[0, '#D9B060'], [1, '#B98A2E']]) + `<path d="${chk}" fill="url(#${u}ck)" fill-opacity=".62"/>`
      + lin(`${u}rl`, [[0, '#FFFBEA', .9], [1, '#FFFBEA', 0]]) + `<path d="M36 90H64L76 131H24Z" fill="url(#${u}rl)"/>`
      + k.burst({cx: 50, cy: 64, n: 18, r: 90, w: .3, a: .12, c: '#FFFBEA'})
      // the beams, gold-friezed, over the colonnades, and the crossbars
      + lin(`${u}bm`, GOLD, 'x1="0" y1="0" x2="0" y2="1"')
      + `<path d="${beam(-1)}${beam(1)}" fill="url(#${u}bm)" stroke="#5A3804" stroke-width=".3"/><path d="${under(-1)}${under(1)}" fill="#6E4505"/>`
      + `<path class="pa-fine" d="${dent}" stroke="#5A3804" stroke-opacity=".6" stroke-width=".7"/>`
      + `<path d="${bars}" fill="url(#${u}bm)" stroke="#5A3804" stroke-width=".3"/>`
      // a column (fluted marble, a gold capital and base) and a banner (burgundy, gold-trimmed, a star over two stripes)
      + lin(`${u}mc`, [[0, '#B8A47A'], [.3, '#FFFDF6'], [.62, '#F1E6CC'], [1, '#9C8760']], 'x1="0" y1="0" x2="1" y2="0"')
      + lin(`${u}gc`, GOLD, 'x1="0" y1="0" x2="1" y2="0"') + lin(`${u}bn`, [[0, '#B8304C'], [.5, '#8E1830'], [1, '#5A0A1C']], 'x1="0" y1="0" x2="1" y2="0"')
      + `<defs><g id="${u}col"><rect x="-3.6" y="5" width="7.2" height="75" fill="url(#${u}mc)"/><path class="pa-fine" d="M-2.2 6V79M-.7 6V79M.7 6V79M2.2 6V79" stroke="#8E7A52" stroke-opacity=".55" stroke-width=".3"/>`
      + `<path d="M-5.6 0H5.6V2.4H-5.6ZM-4.8 2.4H4.8L3.8 5H-3.8ZM-4.2 80H4.2L5 83H-5ZM-5.6 83H5.6V88H-5.6Z" fill="url(#${u}gc)" stroke="#5A3804" stroke-width=".25"/>`
      + `<path d="M-5.4 3.8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M2.4 3.8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0" fill="url(#${u}gc)" stroke="#5A3804" stroke-width=".25"/></g>`
      + `<g id="${u}ban"><path d="M-5 1H5V30L0 26.2L-5 30Z" fill="url(#${u}bn)"/><path d="M-4 2V27.6L0 24.6L4 27.6V2" fill="none" stroke="#F3CF6A" stroke-width=".5"/>`
      + `<path d="${k.star(0, 11, 3.4)}M-3.2 17H3.2V18.4H-3.2ZM-3.2 19.6H3.2V20.4H-3.2Z" fill="#F6D66E"/><path d="M-6 -.4H6V1.4H-6Z" fill="url(#${u}gc)"/></g></defs>`
      + col(.56) + col(.72) + ban(.74) + col(.94) + ban(.95)
      // the shafts of light falling across, motes in them
      + lin(`${u}sh`, [[0, '#FFFBEA', .5], [1, '#FFFBEA', 0]])
      + `<path class="pa-pulse" style="--t:5s" d="M12 21H21L62 124H43Z" fill="url(#${u}sh)"/><path class="pa-pulse" style="--t:5s;--d:2.5s" d="M82 21H89L60 124H49Z" fill="url(#${u}sh)"/>`
      + [[34, 86, 0], [64, 92, 1.5], [44, 108, 2.8]].map(([x, y, d]) => `<circle class="pa-rise" style="--d:${d}s;--t:4.6s" cx="${x}" cy="${y}" r=".7" fill="#FFFBEA"/>`).join('')
      // the pedestal: gold slabs, a marble body with a gold-framed panel, its shadow on the floor
      + `<ellipse cx="50" cy="123" rx="18" ry="2.6" fill="#5A3804" fill-opacity=".35"/>`
      + lin(`${u}pg`, GOLD, 'gradientUnits="userSpaceOnUse" x1="33" y1="0" x2="67" y2="0"') + lin(`${u}pm`, [[0, '#C9B994'], [.3, '#FFFDF6'], [.65, '#F1E6CC'], [1, '#A8976E']], 'x1="0" y1="0" x2="1" y2="0"')
      + `<rect x="38.6" y="101" width="22.8" height="17" fill="url(#${u}pm)"/>`
      + `<path class="pa-fine" d="M40 104Q44 106 43 110M58 103Q55 108 59.6 112M46 113Q50 114 52 117" fill="none" stroke="#9C8762" stroke-opacity=".55" stroke-width=".3"/>`
      + `<rect x="43" y="104" width="14" height="10.6" rx=".6" fill="none" stroke="url(#${u}pg)" stroke-width=".9"/><path d="${k.star(50, 109.3, 3)}" fill="url(#${u}pg)" stroke="#6E4505" stroke-width=".25"/>`
      + `<path d="M34 98.4H66V101H34ZM35 118H65V122.4H35Z" fill="url(#${u}pg)" stroke="#5A3804" stroke-width=".3"/>`
      // the golden helmet, turned three-quarter to the right, against the light: its shell, the jaw's shade, the
      // burgundy stripe, a star decal, the ear hole, the dark face opening and the facemask's bars wrapping the jaw
      + `<ellipse cx="51" cy="98.6" rx="19" ry="1.6" fill="#5A3804" fill-opacity=".4"/>`
      + `<g transform="translate(50 98.6) scale(.66) translate(-52 -100.4)">`
      + rad(`${u}hm`, [[0, '#FFF6CC'], [.3, '#F2C64E'], [.7, '#A8740E'], [1, '#5A3804']], 'cx=".34" cy=".24" r=".9"')
      + `<path d="M64 66.6l13.4-1.4c2 9.4 1.8 20.4-1.4 30.4L63 98.4z" fill="#2E1D03"/>`
      + `<path d="M76.5 61C75 47 63 39 48 39 32 39 20.5 50.5 20.5 66.5c0 11 3.4 21 10 27.4L45 96c5.6.6 9 4 15.6 4.4 2.6.2 4.4-.6 5.4-2.4l.2-6.4c-4.6-5.4-6.8-13.4-4.6-20.6 1-2.6 3-4 5.6-4.4l9.4-1z" fill="url(#${u}hm)" stroke="#4A2C02" stroke-width=".7"/>`
      + `<path d="M20.5 66.5c0 11 3.4 21 10 27.4L45 96c5.6.6 9 4 15.6 4.4 2.6.2 4.4-.6 5.4-2.4-6 1-11-1.6-16-4.4-9.6-.4-17-3-22-9.6-4-5.6-6.6-11.6-7.5-17.5z" fill="#8A5A0A" fill-opacity=".7"/>`
      + `<path d="M71.6 56.6C68.4 48 59 43.6 48 43.6c-12.6 0-22.4 8.2-23.2 20.6" fill="none" stroke="#8E1830" stroke-width="5.2" stroke-linecap="round"/>`
      + `<path class="pa-fine" d="M71.6 56.6C68.4 48 59 43.6 48 43.6c-12.6 0-22.4 8.2-23.2 20.6" fill="none" stroke="#FFF1B8" stroke-width=".5" stroke-dasharray="1.6 .9"/>`
      + `<path d="${k.star(36.4, 63, 6.2)}" fill="#8E1830" stroke="#FFF1B8" stroke-width=".6"/>`
      + `<circle cx="47.6" cy="74.4" r="2.6" fill="#3A2404"/><circle cx="47.6" cy="74.4" r="5" fill="none" stroke="#FFE7A0" stroke-width="1.2"/>`
      + `<path d="M76.6 64.4C81.4 64 85 65.6 85.6 69.6C86.4 77 86 84 84 89.6C80.4 95 73.4 97.6 66 97.2M64.6 76C72 75 80 75.4 86.2 77.6M65 85.4C72 86.6 79 87 85.4 85.2M77.2 64.8C75.8 74 75.6 84 77.4 95.6" fill="none" stroke="#2E1D03" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<path d="M76.6 64.4C81.4 64 85 65.6 85.6 69.6C86.4 77 86 84 84 89.6C80.4 95 73.4 97.6 66 97.2M64.6 76C72 75 80 75.4 86.2 77.6M65 85.4C72 86.6 79 87 85.4 85.2M77.2 64.8C75.8 74 75.6 84 77.4 95.6" fill="none" stroke="#F3CF6A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<path d="M28 58C31 48.6 38.6 43.4 47.6 42.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.6" stroke-linecap="round"/></g>`
      // glints: the helmet, the capitals, the portal
      + [[39, 77.4, 2.6, 0], [71.2, 82, 2, 1.1], [27.6, 44.4, 2, 2], [72.4, 44.4, 2, .6], [50, 46.4, 2.8, 1.6]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" fill="#fff" d="${glint(x, y, r)}"/>`).join('');
  }},
  // The Ring: a gold championship ring standing in an open ring box: its octagonal top tipped toward you, set with a
  // gold football on pavé diamonds inside a ring of rubies and a halo of round brilliants, rubies channel-set in its
  // side wall; engraved shoulders (a star and laurel, the year '26), the polished hoop sinking into the velvet's slit;
  // the box's lid standing open behind in ivory satin, a gold hinge, a laurel and clasp on its front, loose diamonds
  // on the velvet, a spotlight and a burst of light.
  {id: 'leg-ring', name: 'The Ring: a gold championship ring set with diamonds and rubies, standing in an open velvet ring box', svg: (u, k) => {
    // (the top: an octagon about (50, 50), 40 across, its depth foreshortened to .62 as it tips toward you; o(i) its
    // corners from the top left, clockwise, inset i)
    const o = (i = 0) => { const w = 20 - i, h = 15 - i, c = 6.2 - i * .4; return [[-w + c, -h], [w - c, -h], [w, -h + c * .74], [w, h - c * .74], [w - c, h], [-w + c, h], [-w, h - c * .74], [-w, -h + c * .74]].map(([x, y]) => [f1(50 + x), f1(50 + y * .62)]); };
    const poly = p => 'M' + p.map(q => q.join(' ')).join('L') + 'Z', O = o(), dn = (q, d = 6) => [q[0], f1(q[1] + d)];
    const E = (cx, cy, rx, ry) => `M${f1(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${f1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${f1(-2 * rx)} 0Z`;
    // (the halo's brilliants round the rubies, and the loose ones on the velvet: x, y, size)
    const halo = Array.from({length: 18}, (_, i) => { const a = Math.PI * 2 * i / 18; return [f1(50 + 16.4 * Math.cos(a)), f1(50 + 7.3 * Math.sin(a)), .95]; });
    const gem = ([x, y, s]) => `<use href="#${u}dm" transform="translate(${x} ${y}) scale(${s})"/>`;
    return rad(`${u}bg`, [[0, '#FFF3C8'], [.26, '#F0C04E'], [.55, '#B67C14'], [.84, '#6A4208'], [1, '#3A2404']], 'cx="50%" cy="36%" r="72%"')
      + `<rect width="100" height="160" fill="url(#${u}bg)"/>`
      + `<g class="pa-spin" style="--oy:52px">${k.burst({cx: 50, cy: 52, n: 26, r: 130, w: .38, a: .2, c: '#FFF6D8'})}</g>`
      + `<g class="pa-fine">${k.burst({cx: 50, cy: 52, n: 52, r: 130, w: .1, a: .12, c: '#FFFBEA'})}</g>`
      + lin(`${u}sp`, [[0, '#FFFBEA', .45], [1, '#FFFBEA', 0]]) + `<path class="pa-pulse" style="--t:6s" d="M36 21H64L92 122H8Z" fill="url(#${u}sp)"/>`
      // the box's lid, standing open behind: burgundy leather edged in gold, lined in ivory satin, padded and pleated, a
      // gold foil star and laurel stamped at its head
      + lin(`${u}lw`, [[0, '#8A1A34'], [1, '#4A0817']])
      + `<path d="M16.4 82V33Q16.4 25.6 23.8 25.6H76.2Q83.6 25.6 83.6 33V82Z" fill="url(#${u}lw)" stroke="#2E0410" stroke-width=".4"/>`
      + rad(`${u}st`, [[0, '#FFFDF6'], [.55, '#F6EBD2'], [.86, '#DCC79C'], [1, '#B89E6E']], 'cx=".5" cy=".42" r=".7"')
      + `<path d="M19.6 81V34.4Q19.6 28.8 25.2 28.8H74.8Q80.4 28.8 80.4 34.4V81Z" fill="url(#${u}st)"/>`
      + `<path d="M19.6 81V34.4Q19.6 28.8 25.2 28.8H74.8Q80.4 28.8 80.4 34.4V81" fill="none" stroke="#E9BD48" stroke-width=".6"/>`
      + `<path class="pa-fine" d="M50 36.4L22 80M50 36.4L33 80M50 36.4L67 80M50 36.4L78 80M50 36.4L20 56M50 36.4L80 56" stroke="#B89E6E" stroke-opacity=".4" stroke-width=".35"/>`
      + `<path class="pa-fine" d="M24 34Q50 40 76 34" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".8" stroke-linecap="round"/>`
      + `<path d="${k.star(50, 34.6, 2.4)}" fill="#E2AE3A" stroke="#8A5C0A" stroke-width=".2"/>`
      + `<path class="pa-fine" d="M46.6 36.6Q43 36.4 41 33.6M53.4 36.6Q57 36.4 59 33.6M44.4 36.2l-.8-1.6M42.6 35.2l-.4-1.6M55.6 36.2l.8-1.6M57.4 35.2l.4-1.6" fill="none" stroke="#C8901C" stroke-width=".5" stroke-linecap="round"/>`
      + k.glow({cx: 50, cy: 54, r: 30, c: '#FFFFFF', a: .7})
      // the hinge
      + lin(`${u}au`, GOLD, 'gradientUnits="userSpaceOnUse" x1="28" y1="0" x2="72" y2="0"')
      + `<path d="M18 80.6H82V83H18ZM25.6 79.4H31.4V84.2H25.6ZM68.6 79.4H74.4V84.2H68.6Z" fill="url(#${u}au)" stroke="#5A3804" stroke-width=".3"/>`
      // the velvet behind the slit, deep burgundy
      + rad(`${u}vt`, [[0, '#A8243F'], [.6, '#841A33'], [1, '#6E0F24']], 'cx=".5" cy=".2" r=".8"')
      + `<path d="M16 84Q50 80 84 84L85 96Q50 101 15 96Z" fill="url(#${u}vt)"/>`
      + `<path d="M24 90.6Q50 95 76 90.6" fill="none" stroke="#2A0410" stroke-width="1.8" stroke-linecap="round"/>`
      // the hoop: polished gold, its inner face at the top of the hole, the shine down its sides
      + `<path d="${E(50, 80, 19, 19)}${E(50, 81.6, 13.4, 13.4)}" fill="url(#${u}au)" fill-rule="evenodd" stroke="#4A2C02" stroke-width=".45"/>`
      + lin(`${u}in`, [[0, '#4A2C02'], [.6, '#9A6608'], [1, '#D9A936']]) + `<path d="${E(50, 81.6, 13.4, 13.4)}${E(50, 84.4, 13.4, 11.6)}" fill="url(#${u}in)" fill-rule="evenodd"/>`
      + `<path d="M32.2 74Q31.4 86 37 94M67.8 74Q68.6 86 63 94" fill="none" stroke="#FFF8DA" stroke-opacity=".85" stroke-width=".8" stroke-linecap="round"/>`
      // the shoulders: broad plates flaring up to the top, engraved (a star over laurel; the year under a star)
      + `<path d="M29.4 58.6L38.4 62L37.2 79.6L31.2 77.8Q28.8 68 29.4 58.6ZM70.6 58.6L61.6 62L62.8 79.6L68.8 77.8Q71.2 68 70.6 58.6Z" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".4"/>`
      + `<path class="pa-fine" d="M30.6 60.8L37 63.2L36.1 77.8L32 76.6Q30.2 68.6 30.6 60.8ZM69.4 60.8L63 63.2L63.9 77.8L68 76.6Q69.8 68.6 69.4 60.8Z" fill="none" stroke="#6E4505" stroke-width=".3"/>`
      + `<path d="${k.star(33.9, 67, 2.6)}${k.star(66.1, 66.4, 1.6)}" fill="#6E4505"/>`
      + `<path class="pa-fine" d="M33.9 77.2Q31.8 75.2 32.2 71.6M33.9 77.2Q36 75.2 35.6 71.6" fill="none" stroke="#6E4505" stroke-width=".35" stroke-linecap="round"/>`
      + `<path class="pa-fine" d="${[[32.2, 71.6, -100], [32.3, 73.8, -150], [33, 75.8, -160], [35.6, 71.6, -80], [35.5, 73.8, -30], [34.8, 75.8, -20]].map(([x, y, a]) => { const r = a * Math.PI / 180, c = Math.cos(r) * 1.6, n = Math.sin(r) * 1.6;
        return `M${x} ${y}q${f1(c / 2 - n * .35)} ${f1(n / 2 + c * .35)} ${f1(c)} ${f1(n)}q${f1(-c / 2 - n * .35)} ${f1(-n / 2 + c * .35)} ${f1(-c)} ${f1(-n)}Z`; }).join('')}" fill="#6E4505"/>`
      + `<text x="66.1" y="73.6" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="4.4" fill="#6E4505">26</text>`
      // the top's side wall, three faces lit from the left, rubies channel-set along its front
      + `<path d="${poly([O[6], O[5], dn(O[5]), dn(O[6])])}" fill="#8A5A0A" stroke="#4A2C02" stroke-width=".4"/>`
      + `<path d="${poly([O[3], O[4], dn(O[4]), dn(O[3])])}" fill="#C8901C" stroke="#4A2C02" stroke-width=".4"/>`
      + `<path d="${poly([O[5], O[4], dn(O[4]), dn(O[5])])}" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".4"/>`
      + rad(`${u}rb`, [[0, '#FFC2CC'], [.45, '#E0213E'], [1, '#6A0014']], 'cx=".4" cy=".3" r=".8"')
      + `<path d="M${O[5][0] + 1.2} ${O[5][1] + 1.4}H${O[4][0] - 1.2}V${O[4][1] + 4.6}H${O[5][0] + 1.2}Z" fill="#3A2404"/>`
      + `<path d="${Array.from({length: 6}, (_, i) => `M${f1(O[5][0] + 1.7 + i * 3.97)} ${O[5][1] + 1.8}h3.3v2.4h-3.3Z`).join('')}" fill="url(#${u}rb)"/>`
      + `<path class="pa-fine" d="${Array.from({length: 6}, (_, i) => `M${f1(O[5][0] + 2.1 + i * 3.97)} ${O[5][1] + 2.3}h1.6`).join('')}" stroke="#FFE0E6" stroke-width=".4"/>`
      // the top's face: gold, a dotted border, stars at its corners, the halo of brilliants, the ring of rubies, the pavé,
      // the football raised on it
      + `<path d="${poly(O)}" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".45"/>`
      + `<path d="M${O[7].join(' ')}L${O[0].join(' ')}L${O[1].join(' ')}" fill="none" stroke="#FFF8DA" stroke-width=".6" stroke-linejoin="round"/>`
      + `<path class="pa-fine" d="${poly(o(1.2))}" fill="none" stroke="#5A3804" stroke-opacity=".7" stroke-width=".4" stroke-dasharray=".4 .7"/>`
      + `<path d="${k.star(34.6, 43.6, 1.2)}${k.star(65.4, 43.6, 1.2)}${k.star(34.6, 56.4, 1.2)}${k.star(65.4, 56.4, 1.2)}" fill="#6E4505"/>`
      + `<path d="${E(50, 50, 18.4, 8.6)}" fill="#5A3804" fill-opacity=".35"/>`
      + rad(`${u}dg`, [[0, '#FFFFFF'], [.45, '#EAF2FC'], [.8, '#A6B6CE'], [1, '#6C7C96']], 'cx=".36" cy=".3" r=".8"')
      + `<defs><g id="${u}dm"><circle r="1.15" fill="url(#${u}dg)" stroke="#5A6478" stroke-width=".15"/><path class="pa-fine" d="M-.8-.8L.8.8M.8-.8L-.8.8M0-1.15V1.15" stroke="#fff" stroke-opacity=".7" stroke-width=".14"/></g></defs>`
      + halo.map(gem).join('')
      + `<path d="${E(50, 50, 13, 5.9)}" fill="#3A0410"/><path d="${E(50, 50, 12.2, 5.3)}" fill="none" stroke="#D0203C" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="0 2.65"/>`
      + `<path class="pa-fine" d="${E(50, 49.7, 12.2, 5.3)}" fill="none" stroke="#FFC2CC" stroke-width=".6" stroke-linecap="round" stroke-dasharray="0 2.65"/>`
      + `<pattern id="${u}pv" width="2" height="1.4" patternUnits="userSpaceOnUse"><circle cx=".5" cy=".35" r=".48" fill="url(#${u}dg)"/><circle cx="1.5" cy="1.05" r=".48" fill="url(#${u}dg)"/></pattern>`
      + `<path d="${E(50, 50, 10.6, 4.4)}" fill="#B9C6D8"/><path d="${E(50, 50, 10.6, 4.4)}" fill="url(#${u}pv)"/>`
      + `<g transform="translate(0 47.6) scale(1 .78) translate(0 -47.6)">${ball(u, 'ball', 50, 47.6, .86, -14)}</g>`
      // the velvet's lip over the slit and the box's front: burgundy leather, gold trim, the clasp between laurel sprays
      + `<path d="M24 90.6Q50 95 76 90.6L85 96Q50 101 15 96Z" fill="url(#${u}vt)"/>`
      + `<path class="pa-fine" d="M28 93.4Q50 97 72 93.4" fill="none" stroke="#C84862" stroke-opacity=".6" stroke-width=".5" stroke-linecap="round"/>`
      + lin(`${u}fr`, [[0, '#6E0F24'], [.5, '#560A1C'], [1, '#3A0410']]) + `<path d="M15 96Q50 101 85 96L85 115Q50 121 15 115Z" fill="url(#${u}fr)" stroke="#2A0410" stroke-width=".4"/>`
      + `<path d="M15 96Q50 101 85 96" fill="none" stroke="url(#${u}au)" stroke-width="1.3"/><path d="M15.6 113.6Q50 119.6 84.4 113.6" fill="none" stroke="url(#${u}au)" stroke-width=".7"/>`
      + `<path class="pa-fine" d="M17 98.4Q50 103.4 83 98.4" fill="none" stroke="#E9BD48" stroke-opacity=".7" stroke-width=".3" stroke-dasharray=".8 .6"/>`
      + `<path d="M46.2 102.6H53.8V108.8Q50 111.2 46.2 108.8Z" fill="url(#${u}au)" stroke="#4A2C02" stroke-width=".35"/><path d="M50 104.4a1 1 0 1 0 .01 0ZM49.5 105.6h1l.4 2.4h-1.8Z" fill="#3A2404"/>`
      + lin(`${u}lg`, [[0, '#FFF1B0'], [.45, '#E2AE3A'], [1, '#7E520A']])
      + `<defs><g id="${u}lr"><path d="M43.6 106.2Q36 109.6 26.6 105.4" fill="none" stroke="#C8901C" stroke-width=".55" stroke-linecap="round"/>`
      + `<path d="M40.8 107.4c-.4-2.2 1-3.6 3-3.6-.2 2.2-1.4 3.4-3 3.6ZM37 108c-.6-2.2.6-3.8 2.6-4-.1 2.2-1.2 3.6-2.6 4ZM33.2 107.8c-.8-2 .2-3.8 2.2-4.2.1 2.2-.8 3.6-2.2 4.2ZM29.6 106.8c-1-1.8-.2-3.8 1.8-4.4.2 2-.6 3.6-1.8 4.4Z`
      + `M39.6 107.6c1.4 1.8 3.2 2 4.6.8-1.6-1.4-3.2-1.6-4.6-.8ZM35.8 108c1.2 1.9 3 2.3 4.4 1.2-1.4-1.5-3-1.9-4.4-1.2ZM32 107.6c1.1 2 2.8 2.5 4.3 1.6-1.3-1.6-2.9-2.1-4.3-1.6Z" fill="url(#${u}lg)" stroke="#6E4505" stroke-width=".2"/></g></defs>`
      + `<use href="#${u}lr"/><use href="#${u}lr" transform="matrix(-1 0 0 1 100 0)"/>`
      + `<ellipse cx="50" cy="121" rx="38" ry="2.6" fill="#3A2404" fill-opacity=".4"/>`
      // loose diamonds on the velvet, and glints: the top, the brilliants, the hoop, the loose stones
      + [[22.4, 89.6, 1.9], [78, 90.4, 1.6], [28.6, 95.6, 1.3], [72, 96.2, 1.2]].map(gem).join('')
      + [[38.4, 44, 2.6, 0], [61.6, 52.4, 2.2, 1], [64.8, 43.8, 2.4, 1.8], [33.4, 50.6, 2, .5], [31.8, 84, 2.4, 2.3], [22.4, 89.6, 2.6, 1.4], [78, 90.4, 2.2, .3]]
        .map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" fill="#fff" d="${glint(x, y, r)}"/>`).join('')
      + [[26, 70, 0], [74, 64, 1.5], [60, 104, 2.8]].map(([x, y, d]) => `<circle class="pa-rise" style="--d:${d}s;--t:4.4s" cx="${x}" cy="${y}" r=".7" fill="#FFFBEA"/>`).join('');
  }}
];
