// The Gameday Pack's art designs (views/dynasty-packs.js frames them: tier 4, orange #E0702A; the frame already draws
// its foil sheen, crimped seals, an embossed quilt, a warm holo, a light sweep and four sparkles; an ember brand bar).
// Pocket's packs come in several artworks; so do ours, more detailed the rarer the pack (the owner, Oct 29 2026: "Add
// more art designs to the packs. The more rare the pack, the more detailed the art design should be"). Each design:
// {id: 'gday-<slug>', name (for screen readers), svg: (u, k) => markup in a 100 x 160 viewBox, full-bleed, the subject
// in y 24..122; ids `${u}name`; at most 150 elements}. The guide is at the top of views/dynasty-packs.js.
// Gameday's are scenes from a game night, one family: warm all through (an ember sky going to deep indigo night above,
// the ground in dark burnt orange, never the Team Pack's green), white-cream light with hard edges, crisp cream lines,
// the brown game ball; the night's darks against the lights' whites give it its punch.

const f1 = n => +n.toFixed(1);
// (the game ball, nose along +x, 20 long at s 1, about (x, y) turned r degrees; g names its gradient: 10 elements)
const ball = (u, g, x, y, s, r) => `<radialGradient id="${u}${g}" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#D08446"/><stop offset=".5" stop-color="#8E4420"/>`
  + `<stop offset="1" stop-color="#3C1707"/></radialGradient><g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">`
  + `<path d="M-10 0C-6-7.6 6-7.6 10 0C6 7.6-6 7.6-10 0Z" fill="url(#${u}${g})" stroke="#240C03" stroke-width=".6"/>`
  + `<path d="M-6.4-3.9Q-5.1 0-6.4 3.9M6.4-3.9Q5.1 0 6.4 3.9" fill="none" stroke="#FFF4E4" stroke-width="1.1"/>`
  + `<path d="M-3.8-1.9Q0-3 3.8-1.9" fill="none" stroke="#FFF4E4" stroke-width=".8" stroke-linecap="round"/>`
  + `<path d="M-2.6-3.3v2.2M-1.3-3.6v2.4M0-3.7v2.4M1.3-3.6v2.4M2.6-3.3v2.2" stroke="#FFF4E4" stroke-width=".5" stroke-linecap="round"/>`
  + `<path d="M-6.2-3.2C-3-5.4 2-5.6 5.4-4.2" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.1" stroke-linecap="round"/></g>`;
// (a four-point glint at (x, y), r its reach)
const glint = (x, y, r) => { const q = r * .26; return `M${x} ${f1(y - r)}L${f1(x + q)} ${f1(y - q)}L${f1(x + r)} ${y}L${f1(x + q)} ${f1(y + q)}L${x} ${f1(y + r)}`
  + `L${f1(x - q)} ${f1(y + q)}L${f1(x - r)} ${y}L${f1(x - q)} ${f1(y - q)}Z`; };
// (confetti: a slip w x h at (x, y) turned a degrees)
const slip = (x, y, a, w = 2.6, h = 1.2) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180), p = (dx, dy) => `${f1(x + dx * c - dy * s)} ${f1(y + dx * s + dy * c)}`;
  return `M${p(-w / 2, -h / 2)}L${p(w / 2, -h / 2)}L${p(w / 2, h / 2)}L${p(-w / 2, h / 2)}Z`; };
// (gradients from [offset, colour, opacity] stops: linear top to bottom unless told, radial as told)
const stops = s => s.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
const lin = (id, s, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${id}" ${at}>${stops(s)}</linearGradient>`;
const rad = (id, s, at = '') => `<radialGradient id="${id}" ${at}>${stops(s)}</radialGradient>`;

export default [
  // Under the Lights: a night stadium bowl seen from the end zone, two floodlight towers on its rim throwing crossed
  // beams onto the striped field, the crowd in specks with camera flashes, pennants and a little scoreboard on the far
  // rim, the goalposts at the far end, and a ball in flight against the glow.
  {id: 'gday-lights', name: 'Under the Lights: a night stadium, its floodlights crossing over the field, a ball in flight', svg: (u, k) => {
    // (the bowl: a row t of the way from its rim (0 34, 50 70, 100 34) down to the wall round the field (0 128, 50 46, 100 128))
    const row = t => `M0 ${f1(34 + 94 * t)}Q50 ${f1(70 - 24 * t)} 100 ${f1(34 + 94 * t)}`;
    const band = (a, b) => row(a) + `L100 ${f1(34 + 94 * b)}Q50 ${f1(70 - 24 * b)} 0 ${f1(34 + 94 * b)}Z`;
    // (the field in perspective, looking down it: the far end line at y 92 (x 35..65), the sidelines (s -1, 1) running to
    // a vanishing point at y 74.4; the line z yards off at Y(z), the end line 110)
    const X = (y, s) => f1(50 + s * (y - 74.4) * .852), Y = z => f1(74.4 + 1936 / z);
    const quad = (y1, y2) => `M${X(y1, -1)} ${y1}L${X(y1, 1)} ${y1}L${X(y2, 1)} ${y2}L${X(y2, -1)} ${y2}Z`;
    const ys = Array.from({length: 16}, (_, i) => Y(100 - 5 * i));
    const stripes = ys.map((y, i) => i % 2 && i < 15 ? quad(y, ys[i + 1]) : '').join('');
    const lines = [92, ...ys].map(y => `M${X(y, -1)} ${y}H${X(y, 1)}`).join('') + `M35 92L${X(160, -1)} 160M65 92L${X(160, 1)} 160`;
    const hash = [-.12, .12].map(s => `M${X(93.8, s)} 93.8L${X(160, s)} 160`).join('');
    // (the yard numbers by each sideline, lying flat, read from the sideline: 20 to 50)
    const nums = [70, 50].map(z => [-1, 1].map(s => `<text transform="translate(${X(Y(z), s * .72)} ${Y(z)}) scale(1 .55) rotate(${s * 90})" font-size="${f1(330 / z)}" dy=".36em">${100 - z}</text>`).join('')).join('');
    const rows = [.07, .13, .19, .25, .45, .51, .57, .63, .69, .75, .81, .87, .93].map(row).join('');
    // (aisles climbing from the wall (y 128 - 164s(1 - s)) to the rim (y 34 + 72s(1 - s)), fanning out)
    const aisles = [12, 22, 32, 42, 58, 68, 78, 88].map(x => { const r = 50 + (x - 50) * 1.35, a = x / 100, b = r / 100; return `M${x} ${f1(128 - 164 * a * (1 - a))}L${f1(r)} ${f1(34 + 72 * b * (1 - b))}`; }).join('');
    const mast = x => `M${x - 1.8} 43L${x - .4} 34M${x + 1.8} 43L${x + .4} 34`;
    const truss = x => `M${x - 1.5} 40.6L${x + 1.3} 38.2M${x + 1.5} 40.6L${x - 1.3} 38.2M${x - 1.1} 37.6L${x + 1} 35.6M${x + 1.1} 37.6L${x - 1} 35.6`;
    // (pennants on the rim, where it stands at y 34 + 72t(1 - t))
    const rim = x => f1(34 + .0072 * x * (100 - x)), pen = [26, 37, 63, 74];
    const flash = [[24, 63, 2.2, 0], [72, 60, 2, 1.3], [37, 78, 1.8, .6], [83, 84, 2.4, 2], [15, 92, 1.8, 1.7]];
    return lin(`${u}sky`, [[.13, '#1B0F2E'], [.22, '#3A1430'], [.31, '#5A1A0C'], [.4, '#B84C14'], [.47, '#F2843A']]) + `<rect width="100" height="160" fill="url(#${u}sky)"/>`
      + k.glow({cx: 50, cy: 58, r: 40, c: '#FFB466', a: .7})
      + `<path class="pa-fine" fill="#FFE9C8" fill-opacity=".7" d="M30 25.5h.5v.5h-.5zM44 23.8h.4v.4h-.4zM61 26.4h.5v.5h-.5zM71 23.6h.4v.4h-.4zM37 30.2h.4v.4h-.4zM55 29h.4v.4h-.4zM26 33h.4v.4h-.4zM76 31.6h.4v.4h-.4z"/>`
      + `<path class="pa-twinkle" style="--d:.4s;--t:3.2s" fill="#FFF3DC" d="${glint(33, 27.6, 1.6)}"/><path class="pa-twinkle" style="--d:1.9s;--t:3.2s" fill="#FFF3DC" d="${glint(68, 25.4, 1.4)}"/>`
      // the field, lit amber: its apron, the turf with mown stripes, the far end zone, the lines and hashes, a pool of light
      + `<rect y="80" width="100" height="80" fill="#2A0E06"/>` + lin(`${u}turf`, [[0, '#C8642A'], [.16, '#7A3412'], [.6, '#5A220C'], [1, '#3A1406']]) + `<path d="${quad(92, 160)}" fill="url(#${u}turf)"/>`
      + `<path d="${stripes}" fill="#FFE2B8" fill-opacity=".08"/><path d="${quad(92, Y(100))}" fill="#A82A0C"/>`
      + `<path d="${lines}" fill="none" stroke="#FFF6E6" stroke-width=".55"/><path class="pa-fine" d="${hash}" fill="none" stroke="#FFF4E2" stroke-opacity=".7" stroke-width=".5" stroke-dasharray=".3 1.6"/>`
      + `<g fill="#FFF6E6" fill-opacity=".9" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle">${nums}</g>`
      + rad(`${u}pool`, [[0, '#FFE6B0', .5], [1, '#FFE6B0', 0]]) + `<ellipse cx="50" cy="102" rx="28" ry="11" fill="url(#${u}pool)"/>`
      // the stands: the bowl, the shadow under the upper deck, the crowd in specks, its LED ribbons, the rim catching light
      + lin(`${u}bowl`, [[0, '#1C0702'], [.55, '#421606'], [1, '#7C2E0C']], 'gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="120"')
      + `<path d="${band(0, 1)}" fill="url(#${u}bowl)"/><path d="${band(.3, .39)}" fill="#120501"/>`
      + `<g class="pa-fine" fill="none" stroke-linecap="round"><path d="${rows}" stroke="#FFD9A6" stroke-opacity=".5" stroke-width=".95" stroke-dasharray="0 1.7"/>`
      + `<path d="${rows}" stroke="#FF8A3D" stroke-opacity=".65" stroke-width="1" stroke-dasharray="0 2.3" stroke-dashoffset="1"/>`
      + `<path d="${rows}" stroke="#fff" stroke-opacity=".5" stroke-width=".8" stroke-dasharray="0 3.9" stroke-dashoffset="2.2"/>`
      + `<path d="${aisles}" stroke="#120501" stroke-opacity=".6" stroke-width=".7"/></g>`
      + `<path class="pa-pulse" style="--t:2.4s" d="${row(.39)}" fill="none" stroke="#FF8A2A" stroke-width="1.3"/><path d="${row(.39)}" fill="none" stroke="#FFE2A8" stroke-width=".35"/>`
      + `<path d="${row(1)}" fill="none" stroke="#FF9A3D" stroke-width="1.1"/><path d="${row(0)}" fill="none" stroke="#FFE6BE" stroke-opacity=".75" stroke-width=".7"/>`
      // on the far rim: pennants, and a little scoreboard
      + `<path class="pa-fine" d="${pen.map(x => `M${x} ${rim(x)}v-4.4`).join('')}" stroke="#FFE6BE" stroke-width=".3"/>`
      + `<path class="pa-fine" d="${pen.map(x => `M${x} ${f1(rim(x) - 4.4)}l3.2 1-3.2 1z`).join('')}" fill="#FF8A2A"/>`
      + `<path d="M46.6 51.5v2.6M53.4 51.5v2.6" stroke="#120501" stroke-width=".8"/><rect x="42.4" y="45.4" width="15.2" height="6.4" rx=".6" fill="#120501" stroke="#FFB45E" stroke-width=".4"/>`
      + `<path d="M44 47h12v1.4H44zM44 49.4h4.6v1H44zM51.4 49.4H56v1h-4.6z" fill="#FFB45E"/>`
      // the far goalposts
      + `<path d="M50 92v-5.6M46.4 86.4h7.2M46.6 86.4V76.5M53.4 86.4V76.5" fill="none" stroke="#FFD34D" stroke-width=".7" stroke-linecap="round"/>`
      // the beams, crossing over the field
      + lin(`${u}beam`, [[0, '#FFFDF4', .62], [.55, '#FFF1D0', .3], [1, '#FFE2A8', .1]])
      + `<g fill="url(#${u}beam)"><path d="M9 33L23 35.5L74 112L46 121Z"/><path d="M91 33L77 35.5L26 112L54 121Z"/>`
      + `<path class="pa-pulse" style="--t:5s" fill-opacity=".3" d="M7 31L25 35L100 96L100 128L30 132Z"/><path class="pa-pulse" style="--t:5s;--d:2.5s" fill-opacity=".3" d="M93 31L75 35L0 96L0 128L70 132Z"/></g>`
      // the towers on the rim: masts, trusses, a glow behind each bank of lamps
      + `<path d="${mast(14)}${mast(86)}" fill="none" stroke="#1A0702" stroke-width=".9"/><path class="pa-fine" d="${truss(14)}${truss(86)}" fill="none" stroke="#1A0702" stroke-width=".4"/>`
      + k.glow({cx: 15, cy: 29.5, r: 15, c: '#FFF4D8', a: .95}) + k.glow({cx: 85, cy: 29.5, r: 15, c: '#FFF4D8', a: .95})
      + `<pattern id="${u}lamp" width=".2" height=".3334"><circle cx="1.6" cy="1.17" r=".95" fill="#FFFFFF"/></pattern>`
      + `<g transform="rotate(8 15 29.5)"><rect x="6" y="25" width="18" height="9" rx="1" fill="#2A0D04" stroke="#9A4416" stroke-width=".5"/><rect x="7" y="26" width="16" height="7" fill="url(#${u}lamp)"/></g>`
      + `<g transform="rotate(-8 85 29.5)"><rect x="76" y="25" width="18" height="9" rx="1" fill="#2A0D04" stroke="#9A4416" stroke-width=".5"/><rect x="77" y="26" width="16" height="7" fill="url(#${u}lamp)"/></g>`
      + `<path d="M1 29.5L15 28.8L29 29.5L15 30.2ZM71 29.5L85 28.8L99 29.5L85 30.2Z" fill="#FFFFFF" fill-opacity=".85"/>`
      + k.glow({cx: 15, cy: 29.5, r: 6.4, c: '#FFFFFF', a: 1}) + k.glow({cx: 85, cy: 29.5, r: 6.4, c: '#FFFFFF', a: 1})
      // camera flashes in the crowd
      + flash.map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s;--t:2.2s" fill="#fff" d="${glint(x, y, r)}"/>`).join('')
      // the ball in flight: its trail, a glow, the ball
      + lin(`${u}trail`, [[0, '#FFF1D6', 0], [1, '#FFF1D6', .9]], 'x1="0" y1="0" x2="1" y2="0"')
      + `<path d="M12 84Q25 40 53 36.6" fill="none" stroke="url(#${u}trail)" stroke-width="1.5" stroke-linecap="round"/>`
      + k.glow({cx: 61, cy: 36, r: 14, c: '#FFF1D6', a: .6})
      + `<g class="pa-float">${ball(u, 'ball', 61, 36, .8, -14)}</g>`;
  }},

  // Breakthrough: the ball bursting through a paper run-through banner, its torn flaps (ragged, no two alike, the lower
  // ones drooping) curling back to show the paper's cream underside, the painted face twisting over at an edge and one
  // flap folded right over to show its painted stripe; a shred flying off, light pouring through the hole, confetti.
  {id: 'gday-burst', name: 'Breakthrough: the ball bursting through a paper run-through banner, confetti flying', svg: (u, k) => {
    // (a point on the hole's oval, a degrees round, r times its 21 x 25 radii about (50, 71))
    const P = (a, r, dx = 0, dy = 0) => `${f1(50 + Math.cos(a * Math.PI / 180) * 21 * r + dx)} ${f1(71 + Math.sin(a * Math.PI / 180) * 25 * r + dy)}`;
    const J = [1, .84, 1.07, .9, .98, .8, 1.1, .88, 1, .82, 1.05, .9, .95, .78, 1.1, .86, 1.03, .8, 1.06, .9, .98, .8, 1.08, .87];
    const hole = 'M' + J.map((j, i) => P(i * 15 - 90 + (i % 2 ? 4 : 0), j)).join('L') + 'Z';
    const sheet = 'M9 27Q50 30 91 27L91 117Q50 120 9 117Z' + hole;
    // (the flaps: centre angle, half its width, how far out its torn tip reaches, its tip's turn; each hinged on the rim,
    // its sides bowing out, its tip torn ragged; the upper ones folded far back, the lower ones drooping (their tips
    // turned down toward 90°), the rim from 124° to 184° torn away to teeth only; one edge of each twists over, showing
    // the painted face. The last is folded right over: its painted face, a stripe across it)
    const F = [[-100, 20, 1.92, -7], [-44, 10, 1.55, 6], [6, 18, 1.52, 14], [60, 9, 1.22, 18], [110, 16, 1.5, -20], [196, 12, 1.62, -10]];
    // (a wedge: hinged on the rim (r .96), narrowing to a ragged tip turned t degrees; its fold down the middle)
    const flap = ([c, w, L, t], dx = 0, dy = 0) => { const p = (a, r) => P(a, r, dx, dy), m = (1 + L) / 2, e = c + t;
      return `M${p(c - w, .96)}Q${p(c - w * .62 + t * .4, m)} ${p(e - w * .3, L - .1)}L${p(e - w * .12, L + .02)}L${p(e + w * .04, L - .07)}L${p(e + w * .16, L)}`
        + `L${p(e + w * .3, L - .12)}Q${p(c + w * .62 + t * .4, m)} ${p(c + w, .96)}Z`; };
    const fold = ([c, w, L, t]) => `M${P(c, .97)}L${P(c + t, L - .14)}`;
    // (one edge of each wedge twisting over, the painted face showing: alternate sides)
    const curl = ([c, w, L, t], i) => { const s = i % 2 ? 1 : -1, m = (1 + L) / 2, e = c + t;
      return `M${P(c + s * w, .96)}Q${P(c + s * w * .86 + t * .4, m + .03)} ${P(e + s * w * .3, L - .1)}Q${P(c + s * w * .4 + t * .4, m)} ${P(c + s * w * .45, .97)}Z`; };
    const hinge = ([c, w]) => `M${P(c - w, .98)}L${P(c + w, .98)}`;
    // (small torn teeth round the rim between the wedges)
    const teeth = [-128, -27, 29, 37, 76, 88, 130, 141, 152, 163, 174, 216, 226].map((a, i) => `M${P(a - 3.2, .97)}L${P(a + (i % 2 ? 1 : -1), 1.08 + (i % 3) * .05)}L${P(a + 3.2, .97)}Z`).join('');
    const creases = [[-60, 1.05, 2.1], [-120, 1.05, 2], [0, 1.05, 1.9], [180, 1.05, 1.9], [60, 1.05, 2.05], [120, 1.05, 2], [-10, 1.6, 2.2], [190, 1.6, 2.2]].map(([a, r0, r1]) => `M${P(a, r0)}L${P(a, r1)}`).join('');
    const speed = [-150, -120, -70, -50, 160, 200, 110, 130, 60, 10].map((a, i) => `M${P(a, .5)}L${P(a, 1.25 + (i % 3) * .2)}`).join('');
    const stars = [22, 36, 50, 64, 78].map(x => k.star(x, 33.4, 2.2) + k.star(x, 111.2, 2.2)).join('');
    const gold = [[18, 44, 30], [83, 40, -20], [14, 96, 70], [87, 92, 10], [40, 107, -35], [30, 31, 15]].map(a => slip(...a)).join('');
    const white = [[26, 54, -40], [76, 52, 50], [64, 104, 20], [20, 74, 5], [82, 74, -60], [58, 31, -15]].map(a => slip(...a)).join('');
    const red = [[33, 44, 60], [70, 36, 35], [24, 102, -20], [76, 108, 75], [12, 58, -30], [90, 60, 25]].map(a => slip(...a)).join('');
    const fly = [[29, 38, 20, '#FFD34D', 0], [74, 44, -30, '#fff', .7], [16, 84, 45, '#C92E12', 1.4], [86, 82, -15, '#FFD34D', .4], [46, 34, 70, '#fff', 1.9], [60, 110, -50, '#FFD34D', 1.1]];
    // (scraps of paper blown out of the hole)
    const scrap = [[36, 54, 0], [66, 58, 1.1], [57, 88, 2.2]];
    // (a shred torn off, flying from the top right corner: its painted face and its cream back, twisting)
    const shred = 'M76 33.6C79 31 82.4 31.4 85 28.6L86.4 30.4C84 33.4 80.4 33.4 77.6 36Z';
    return lin(`${u}bg`, [[.1, '#1B0F2E'], [.3, '#3A1430'], [.6, '#4A1A06'], [.85, '#2A0E04']]) + `<rect width="100" height="160" fill="url(#${u}bg)"/>`
      + `<path class="pa-fine" fill="#FFD9A0" fill-opacity=".55" d="M3 24h1v1H3zM15 23.4h1v1h-1zM28 24.2h1v1h-1zM72 23.6h1v1h-1zM85 24.4h1v1h-1zM96 23.4h1v1h-1z"/>`
      // the light beyond, pouring through
      + rad(`${u}light`, [[0, '#fff'], [.3, '#FFF0C4'], [.62, '#FFB255'], [1, '#E0702A', 0]], 'gradientUnits="userSpaceOnUse" cx="50" cy="71" r="40"')
      + `<rect y="21" width="100" height="104" fill="url(#${u}light)"/>` + k.burst({cx: 50, cy: 71, n: 18, r: 34, w: .42, a: .5, c: '#FFF8E4'})
      // the ground, and the banner's shadow on it
      + `<path d="M0 118Q50 114 100 118V160H0Z" fill="#5A220A"/><path d="M6 120Q50 124 94 120L98 126Q50 130 2 126Z" fill="#0A0301" fill-opacity=".55"/>`
      // the banner: the paper glowing near the hole, painted stripes, a border, a row of stars top and foot
      + rad(`${u}paper`, [[0, '#FFC27A'], [.36, '#FF9443'], [.62, k.pc], [1, '#9C4216']], 'gradientUnits="userSpaceOnUse" cx="50" cy="71" r="62"')
      + `<path d="${sheet}" fill="url(#${u}paper)" fill-rule="evenodd"/>`
      + `<pattern id="${u}st" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><rect width="4.2" height="10" fill="#FFF1DC" fill-opacity=".17"/></pattern>`
      + `<path d="${sheet}" fill="url(#${u}st)" fill-rule="evenodd"/>`
      + lin(`${u}bow`, [[0, '#2A0A00', .32], [.2, '#2A0A00', 0], [.8, '#2A0A00', 0], [1, '#2A0A00', .32]], 'x1="0" y1="0" x2="1" y2="0"')
      + `<path d="${sheet}" fill="url(#${u}bow)" fill-rule="evenodd"/>` + k.burst({cx: 50, cy: 71, n: 14, r: 42, w: .28, a: .1, c: '#FFF8E4'})
      + `<path d="M11.8 29.8Q50 32.8 88.2 29.8L88.2 114.2Q50 117.2 11.8 114.2Z" fill="none" stroke="#FFF1DC" stroke-width="1.3"/>`
      + `<path class="pa-fine" d="M13.6 31.8Q50 34.8 86.4 31.8L86.4 112.2Q50 115.2 13.6 112.2Z" fill="none" stroke="#8A3410" stroke-width=".45"/>`
      + `<path d="${stars}" fill="#FFF1DC"/>`
      + `<path class="pa-fine" d="${creases}M22.6 28.6V117.6M77.4 28.6V117.6" fill="none" stroke="#6A2408" stroke-opacity=".3" stroke-width=".5"/>`
      + `<path class="pa-fine" d="M20.6 27.6h4v3.4h-4zM75.4 27.6h4v3.4h-4zM20.6 114h4v3.4h-4zM75.4 114h4v3.4h-4z" fill="#FFF6E2" fill-opacity=".55"/>`
      + `<path class="pa-fine" d="M16 40l6 3M70 100l7 2.4M80 46l5-3M18 86l5 2.6M31 112l5-1.6M60 33l6 1.4" stroke="#FFF1DC" stroke-opacity=".3" stroke-width=".4"/>`
      + `<path d="${hole}" fill="none" stroke="#FFE2A8" stroke-opacity=".5" stroke-width="2.6" stroke-linejoin="round"/><path d="${hole}" fill="none" stroke="#FFF6E8" stroke-width=".7" stroke-linejoin="bevel"/>`
      // the flaps: their shadows on the banner, torn teeth, the cream undersides (shaded at the hinge, lit at the tip),
      // the fold at each hinge, the painted face twisting over at an edge
      + `<path d="${F.map(f => flap(f, 1.4, 2.2)).join('')}" fill="#3E1304" fill-opacity=".4"/>`
      + rad(`${u}flap`, [[.5, '#DDAE80'], [.75, '#F7E1C2'], [1, '#FFFAF0']], 'gradientUnits="userSpaceOnUse" cx="50" cy="71" r="40"')
      + `<path d="${teeth}" fill="url(#${u}flap)" stroke="#C48450" stroke-width=".25"/>`
      + `<path d="${F.map(f => flap(f)).join('')}" fill="url(#${u}flap)" stroke="#B87A46" stroke-width=".35" stroke-linejoin="round"/>`
      + `<path class="pa-fine" d="${F.map(hinge).join('')}${F.map(fold).join('')}" fill="none" stroke="#A9692F" stroke-opacity=".5" stroke-width=".45"/>`
      + lin(`${u}curl`, [[0, '#FF9A4A'], [1, '#B8501A']])
      + `<path d="${F.slice(0, -1).map(curl).join('')}" fill="url(#${u}curl)" stroke="#8E3A10" stroke-width=".3" stroke-linejoin="round"/>`
      + `<clipPath id="${u}fc"><path d="${flap(F[5])}"/></clipPath><g clip-path="url(#${u}fc)"><path d="${flap(F[5])}" fill="url(#${u}curl)"/>`
      + `<path d="M${P(184, 1.1)}L${P(206, 1.08)}M${P(181, 1.36)}L${P(203, 1.36)}" fill="none" stroke="#FFF1DC" stroke-width="1.6"/><path d="${k.star(...P(190, 1.52).split(' ').map(Number), 1.7)}" fill="#FFF1DC"/></g>`
      + `<path d="${flap(F[5])}" fill="none" stroke="#8E3A10" stroke-width=".35" stroke-linejoin="round"/>`
      // the poles, their caps and the ties
      + lin(`${u}pole`, [[0, '#4A1E08'], [.45, '#F3C99C'], [1, '#5A2609']], 'x1="0" y1="0" x2="1" y2="0"')
      + `<path d="M4.4 23h2.6v103h-2.6zM93 23h2.6v103H93z" fill="url(#${u}pole)"/><path d="M3.8 22.4a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0M92.4 22.4a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0" fill="#FFD9A8"/>`
      + `<path d="M7 28.5L9.6 27.4M7 30.4L9.6 29.6M93 28.5L90.4 27.4M93 30.4L90.4 29.6M7 114.6L9.6 116.4M7 116.6L9.6 118M93 114.6L90.4 116.4M93 116.6L90.4 118" stroke="#FFF1DC" stroke-width=".6"/>`
      // speed lines, then the ball coming through
      + `<path d="${speed}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".6" stroke-linecap="round"/>`
      + k.glow({cx: 51, cy: 70, r: 22, c: '#FFFBEA', a: .7})
      + `<g class="pa-float" style="--t:3s">${ball(u, 'ball', 51, 70, 1.38, -32)}</g>`
      // streamers curling out, confetti (still slips in gold, white and red, a few fluttering), scraps of the banner blown out
      + `<g fill="none" stroke-width=".9" stroke-linecap="round"><path d="M61 57c5-3 3-9 9-11s7 3 10-3M64 84c4 3 1 8 6 11s7-1 9 4" stroke="#FFD34D"/>`
      + `<path d="M38 58c-5-2-4-8-10-9s-6 4-11-1M36 86c-5 1-3 7-9 9s-6-3-10 2" stroke="#fff"/></g>`
      + `<path d="${gold}" fill="#FFD34D"/><path d="${white}" fill="#fff"/><path d="${red}" fill="#C92E12"/>`
      + fly.map(([x, y, a, c, d]) => `<path class="pa-twinkle" style="--d:${d}s;--t:2.4s" fill="${c}" d="${slip(x, y, a, 3, 1.4)}"/>`).join('')
      + scrap.map(([x, y, d]) => `<path class="pa-rise" style="--d:${d}s" fill="#FFF3E0" stroke="#C48450" stroke-width=".2" d="M${x} ${y}l2.4-1.2.6 2-1.4.4.2 1.4z"/>`).join('')
      + `<g class="pa-float" style="--t:2.6s"><path d="${shred}" fill="url(#${u}paper)" stroke="#8E3A10" stroke-width=".3"/><path d="M76 33.6C79 31 82.4 31.4 85 28.6L84.2 28.2C81.6 30.6 78.6 30.6 76 33.6Z" fill="#FFF3E0"/></g>`;
  }},

  // Scoreboard: a giant bulb-lit scoreboard over the end zone, HOME and AWAY on its marquee, 21 to 17 below and the 4th
  // quarter between, the pylons standing tall at the corners; fireworks bursting round it in the night.
  {id: 'gday-board', name: 'Scoreboard: a bulb-lit scoreboard reading HOME 21, AWAY 17 over the end zone, fireworks round it', svg: (u, k) => {
    // (a firework: its bloom, rays from its heart, a ring of sparks at their tips; d < 0 starts it part way through, so
    // the sky is never empty on first sight)
    const fw = (x, y, r, c, d, n = 14) => `<g class="pa-twinkle" style="--d:${d}s;--t:3.6s"><circle cx="${x}" cy="${y}" r="${f1(r * .7)}" fill="url(#${u}fw)"/>`
      + `<path d="${Array.from({length: n}, (_, i) => { const a = 2 * Math.PI * i / n; return `M${f1(x + Math.cos(a) * r * .28)} ${f1(y + Math.sin(a) * r * .28)}L${f1(x + Math.cos(a) * r * .9)} ${f1(y + Math.sin(a) * r * .9)}`; }).join('')}" stroke="${c}" stroke-width=".8" stroke-linecap="round"/>`
      + `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="0 ${f1(2 * Math.PI * r / n)}" transform="rotate(${f1(180 / n)} ${x} ${y})"/></g>`;
    // (the end zone's stripes in perspective, from the end line (y 101) to the goal line (y 119))
    const ez = Array.from({length: 11}, (_, i) => { const a = 6 + i * 9, b = f1(50 + (a - 50) * 1.3 - 9); return `M${a} 101L${a + 3.4} 101L${f1(b + 4.4)} 119L${b} 119Z`; }).join('');
    // (a pylon standing on a line at (x, y), h tall, w wide, narrowing a little toward its top as it goes off from us:
    // its front, its side toward the middle (s 1 on the left, -1 on the right), its top)
    const py = (x, y, h, w, s) => { const d = f1(w * .45), t = f1(w * .12);
      return [`M${x} ${y}h${w}l${-t} ${-h}h${f1(-w + 2 * t)}z`, s > 0 ? `M${f1(x + w)} ${y}l${d} ${f1(-d * .6)}l${-t} ${-h}l${f1(-d)} ${f1(d * .6)}z` : `M${x} ${y}l${-d} ${f1(-d * .6)}l${t} ${-h}l${d} ${f1(d * .6)}z`,
        `M${f1(x + t)} ${f1(y - h)}h${f1(w - 2 * t)}l${f1(s * d)} ${f1(-d * .6)}h${f1(-w + 2 * t)}z`]; };
    const PY = [[14.4, 101.6, 7.4, 1.5, 1], [84.1, 101.6, 7.4, 1.5, -1], [8.6, 120.2, 13.6, 2.6, 1], [88.8, 120.2, 13.6, 2.6, -1]], pyl = PY.map(a => py(...a));
    const bulb = (id, c) => `<pattern id="${u}${id}" width="1.2" height="1.2" patternUnits="userSpaceOnUse"><circle cx=".6" cy=".6" r=".47" fill="${c}"/></pattern>`;
    const word = (x, y, s, w, t, a) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" font-weight="900" textLength="${w}" lengthAdjust="spacingAndGlyphs" ${a}>${t}</text>`;
    const panels = 'M21 45h58v16H21zM21 65h22v13H21zM57 65h22v13H57z';
    return lin(`${u}sky`, [[.13, '#1B0F2E'], [.3, '#3A1430'], [.46, '#5A1A0C'], [.58, '#B84C16'], [.68, '#F08A3A']]) + `<rect width="100" height="160" fill="url(#${u}sky)"/>`
      + k.glow({cx: 50, cy: 90, r: 42, c: '#FFC27A', a: .55})
      + `<path class="pa-fine" fill="#FFE9C8" fill-opacity=".7" d="M36 24.6h.4v.4h-.4zM63 23.4h.4v.4h-.4zM9 46h.4v.4h-.4zM92 45h.4v.4h-.4zM31 30h.4v.4h-.4zM69 31.4h.4v.4h-.4z"/>`
      // the fireworks, and their sparks falling away
      + rad(`${u}fw`, [[0, '#FFF6DE', .9], [1, '#FFC27A', 0]])
      + fw(20, 32, 11, '#FFD978', -1.6) + fw(81, 30, 10, '#FFFFFF', -.4) + fw(90, 57, 5.5, '#FF9A3D', -2.6, 10) + fw(10, 62, 4.5, '#FFE2A8', -1, 10)
      + `<path class="pa-fine" d="M12 43q-1.6 6-3 12M28 43q1.4 5 2 10M74 40q-1.4 5-2 11M88 40q1.6 5 2.4 9" fill="none" stroke="#FFD9A0" stroke-opacity=".5" stroke-width=".4" stroke-dasharray="1 1.2"/>`
      + `<path class="pa-fine" d="M5 100Q6 72 15.6 41.6M95 100Q94 72 84.6 39.6" fill="none" stroke="#FFE2B0" stroke-opacity=".45" stroke-width=".45" stroke-dasharray=".8 1.4"/>`
      + k.glow({cx: 50, cy: 60, r: 46, c: '#FFB466', a: .45})
      + rad(`${u}smoke`, [[0, '#FFE2C0', .22], [1, '#FFE2C0', 0]]) + `<ellipse cx="26" cy="40" rx="14" ry="6" fill="url(#${u}smoke)"/><ellipse cx="76" cy="38" rx="13" ry="5.4" fill="url(#${u}smoke)"/>`
      + `<path d="${[[30, 46, 30], [70, 44, -40], [8, 74, 60], [93, 70, -20], [44, 25, 10], [58, 27.4, 70]].map(a => slip(...a, 2, .9)).join('')}" fill="#FFD34D"/>`
      + `<path d="${[[37, 26.4, -30], [64, 30, 20], [11, 46, 15], [90, 46, 70], [6, 86, -50], [95, 82, 35]].map(a => slip(...a, 2, .9)).join('')}" fill="#FFF4E0"/>`
      // the stands behind, low, the crowd in specks (a few flashes) and the ribbon board
      + `<path d="M0 84Q50 92 100 84V102H0Z" fill="#240C03"/>`
      + `<path class="pa-fine" d="M0 88.4Q50 96 100 88.4M0 92Q50 99 100 92M0 95.4Q50 101.6 100 95.4" fill="none" stroke="#FFC888" stroke-opacity=".5" stroke-width=".9" stroke-dasharray=".5 1.6"/>`
      + `<path d="M0 99.4Q50 101.6 100 99.4" fill="none" stroke="#FF9A3D" stroke-width="1"/><path d="${glint(8, 91, 1.4)}${glint(23, 95, 1.2)}${glint(78, 94, 1.3)}${glint(93, 89.6, 1.2)}" fill="#fff"/>`
      // the end zone: the turf beyond the goal line, the painted end zone and its stripes, a pool of light, the end and goal lines
      + lin(`${u}turf`, [[0, '#7A3412'], [1, '#3A1406']]) + `<path d="M0 101H100V160H0Z" fill="url(#${u}turf)"/>`
      + lin(`${u}ez`, [[0, '#4A1E0C'], [1, '#7A3412']]) + `<path d="M0 101H100V119H0Z" fill="url(#${u}ez)"/>`
      + `<path d="${ez}" fill="${k.pc}" fill-opacity=".55"/>`
      + rad(`${u}pool`, [[0, '#FFD9A0', .35], [1, '#FFD9A0', 0]]) + `<ellipse cx="50" cy="108" rx="36" ry="8" fill="url(#${u}pool)"/>`
      + `<path d="M0 101.3H100" stroke="#FFF6E6" stroke-width=".9"/><path d="M0 119.6H100" stroke="#FFF6E6" stroke-width="1.8"/>`
      + `<ellipse cx="50" cy="104" rx="26" ry="4" fill="url(#${u}pool)"/>`
      // the pylons, their shadows on the turf
      + `<path d="M14 101.8l-4.4 1.6h3.4zM86 101.8l4.4 1.6h-3.4zM8 120.4l-6.6 2.6h5.4zM92 120.4l6.6 2.6h-5.4z" fill="#1A0601" fill-opacity=".5"/>`
      + `<path d="${pyl.map(p => p[0]).join('')}" fill="#FF7A1A" stroke="#6A2406" stroke-width=".25"/><path d="${pyl.map(p => p[1]).join('')}" fill="#B8480E"/><path d="${pyl.map(p => p[2]).join('')}" fill="#FFC690"/>`
      + `<path class="pa-fine" d="${PY.map(([x, y, h]) => `M${f1(x + .4)} ${f1(y - 1)}V${f1(y - h + 1)}`).join('')}" stroke="#FFD2A0" stroke-width=".4"/>`
      // the scoreboard: its legs, its housing and crest, the marquee bulbs, the GAMEDAY board and the score
      + `<path d="M27 83h3v18.5h-3zM70 83h3v18.5h-3zM30 85.6h40v2H30z" fill="#1A0803"/><path class="pa-fine" d="M33 87.6L48 101M67 87.6L52 101M48 101h4" fill="none" stroke="#1A0803" stroke-width=".6"/>`
      + lin(`${u}hs`, [[0, '#4A1C08'], [1, '#150602']])
      + `<path d="M35 40C35 31 42 28.4 50 28.4S65 31 65 40Z" fill="url(#${u}hs)" stroke="#FFB45E" stroke-width=".9"/>`
      + `<path class="pa-pulse" style="--t:2.6s" d="${k.star(50, 35, 3.6)}" fill="#FFD34D"/>`
      + `<rect x="15" y="39" width="70" height="44" rx="2.4" fill="url(#${u}hs)" stroke="#FFB45E" stroke-width="1"/>`
      + `<rect x="17.2" y="41.2" width="65.6" height="39.6" rx="1.4" fill="none" stroke="#FF9A3D" stroke-opacity=".28" stroke-width="2.6"/>`
      + `<rect class="pa-fine" x="17.2" y="41.2" width="65.6" height="39.6" rx="1.4" fill="none" stroke="#FFF1C8" stroke-width="1.15" stroke-linecap="round" stroke-dasharray="0 2.2"/>`
      + `<rect class="pa-fine pa-pulse" style="--t:1.2s" x="17.2" y="41.2" width="65.6" height="39.6" rx="1.4" fill="none" stroke="#FF9A3D" stroke-width="1.15" stroke-linecap="round" stroke-dasharray="0 2.2" stroke-dashoffset="1.1"/>`
      + `<rect class="pa-small" x="17.2" y="41.2" width="65.6" height="39.6" rx="1.4" fill="none" stroke="#FFD9A0" stroke-width="1"/>`
      + `<path d="${glint(17.2, 41.2, 2.4)}${glint(82.8, 41.2, 2.4)}${glint(17.2, 80.8, 2.4)}${glint(82.8, 80.8, 2.4)}" fill="#FFFBEA"/>`
      + bulb('dim', '#3A1808') + bulb('lit', '#FFF0C8') + bulb('amb', '#FFA43C')
      + `<path d="${panels}" fill="#0B0401"/><path class="pa-fine" d="${panels}" fill="url(#${u}dim)"/>`
      + word(35.4, 57.4, 10.5, 23, 'HOME', 'fill="none" stroke="#FF8A2A" stroke-opacity=".5" stroke-width="1.6"') + word(64.6, 57.4, 10.5, 23, 'AWAY', 'fill="none" stroke="#FF8A2A" stroke-opacity=".5" stroke-width="1.6"')
      + word(35.4, 57.4, 10.5, 23, 'HOME', `fill="url(#${u}lit)"`) + word(64.6, 57.4, 10.5, 23, 'AWAY', `fill="url(#${u}lit)"`)
      + `<path d="M50 47.4v11.2" stroke="#3A1808" stroke-width=".8"/>`
      + word(32, 76.2, 11.5, 14, '21', `fill="url(#${u}amb)"`) + word(68, 76.2, 11.5, 14, '17', `fill="url(#${u}amb)"`)
      + `<path d="M46.6 68.6c1.4-1.9 5.4-1.9 6.8 0c-1.4 1.9-5.4 1.9-6.8 0Z" fill="#FFA43C"/>` + word(50, 76.4, 4.2, 7, '4TH', 'fill="#FFF0C8"');
  }},

  // Kickoff: down at the turf, the ball standing on its orange tee at the 35, backlit by the stadium glowing at the far
  // end of the field (two light towers, the crowd in dots), its long shadow reaching toward us through the grass, embers
  // drifting up.
  {id: 'gday-kickoff', name: 'Kickoff: the ball standing on its tee, the stadium glowing at the far end of the field', svg: (u, k) => {
    // (the field from the turf: lines run to a vanishing point at (50, 86); the line z yards off at 86 + 120 / z, the
    // sidelines at x = 50 -/+ 1.216 (y - 86))
    const X = (y, s) => f1(50 + s * 1.216 * (y - 86)), Y = z => f1(86 + 120 / z);
    const quad = (y1, y2) => `M${X(y1, -1)} ${y1}L${X(y1, 1)} ${y1}L${X(y2, 1)} ${y2}L${X(y2, -1)} ${y2}Z`;
    // (the far stands: a row t of the way from their top (0 64, 50 86, 100 64) to the wall (0 104, 50 80, 100 104))
    const row = t => `M0 ${f1(64 + 40 * t)}Q50 ${f1(86 - 6 * t)} 100 ${f1(64 + 40 * t)}`;
    const rows = [.12, .24, .36, .48, .6, .72, .84].map(row).join('');
    const mast = x => `M${x - 1.2} 69.4L${x - .3} 58M${x + 1.2} 69.4L${x + .3} 58`;
    // (the grass at our feet: blades leaning this way and that, a back row dark against the glow, a front row catching it)
    const blades = (n, step, base, h0, h1, seed) => Array.from({length: n}, (_, i) => {
      const x = i * step - 1, h = h0 + h1 * Math.abs(Math.sin(i * 2.7 + seed)) + 2 * Math.abs(Math.sin(i * 7.3)), lean = 2.2 * Math.sin(i * 1.9 + seed);
      return `M${f1(x)} ${base}L${f1(x + lean + .5)} ${f1(base - h)}L${f1(x + 1.3)} ${base}Z`; }).join('');
    const embers = [[28, 72, 0], [69, 66, .9], [36, 92, 1.7], [74, 88, 2.4], [60, 50, 1.3], [22, 58, 2.9]];
    return lin(`${u}sky`, [[.13, '#1B0F2E'], [.26, '#3A1430'], [.36, '#6A2409'], [.47, '#C8581A'], [.55, '#F48A3A']]) + `<rect width="100" height="160" fill="url(#${u}sky)"/>`
      + `<path class="pa-fine" fill="#FFE9C8" fill-opacity=".7" d="M24 26h.5v.5h-.5zM41 24h.4v.4h-.4zM63 27h.5v.5h-.5zM79 24.4h.4v.4h-.4zM33 34h.4v.4h-.4zM70 35h.4v.4h-.4zM16 38h.4v.4h-.4zM86 40h.4v.4h-.4z"/>`
      + `<path class="pa-twinkle" style="--d:.8s;--t:3.4s" fill="#FFF3DC" d="${glint(30, 30, 1.5)}"/><path class="pa-twinkle" style="--d:2.2s;--t:3.4s" fill="#FFF3DC" d="${glint(74, 31, 1.3)}"/>`
      + k.glow({cx: 50, cy: 82, r: 52, c: '#FFC27A', a: .85})
      // the far stands: the crowd in dots, the ribbon board along the wall, two light towers on top
      + lin(`${u}bowl`, [[0, '#2A0C03'], [1, '#6A260A']], 'gradientUnits="userSpaceOnUse" x1="0" y1="66" x2="0" y2="100"')
      + `<path d="${row(0)}L100 104Q50 80 0 104Z" fill="url(#${u}bowl)"/>`
      + `<g class="pa-fine" fill="none" stroke-linecap="round"><path d="${rows}" stroke="#FFD9A6" stroke-opacity=".55" stroke-width=".8" stroke-dasharray="0 1.5"/>`
      + `<path d="${rows}" stroke="#FF8A3D" stroke-opacity=".7" stroke-width=".85" stroke-dasharray="0 2.1" stroke-dashoffset=".9"/></g>`
      + `<path d="${row(0)}" fill="none" stroke="#FFE6BE" stroke-opacity=".7" stroke-width=".5"/><path d="${row(.96)}" fill="none" stroke="#FF9A3D" stroke-width=".9"/>`
      + `<path d="${mast(13)}${mast(87)}" fill="none" stroke="#1A0702" stroke-width=".7"/>`
      + k.glow({cx: 13, cy: 54.6, r: 11, c: '#FFF4D8', a: .95}) + k.glow({cx: 87, cy: 54.6, r: 11, c: '#FFF4D8', a: .95})
      + `<pattern id="${u}lamp" width=".2" height=".3334"><circle cx="1.04" cy=".74" r=".6" fill="#FFFFFF"/></pattern>`
      + `<path d="M7.4 51.6h11.2v6H7.4zM81.4 51.6h11.2v6H81.4z" fill="#2A0D04" stroke="#9A4416" stroke-width=".4"/><path d="M7.8 52.4h10.4v4.4H7.8z" fill="url(#${u}lamp)"/><path d="M81.8 52.4h10.4v4.4H81.8z" fill="url(#${u}lamp)"/>`
      // the field: the apron, the turf (lit far off), mown stripes, the yard lines and sidelines, the light's streak
      + lin(`${u}turf`, [[0, '#E07A34'], [.16, '#9A4416'], [.45, '#5A220C'], [1, '#2A0E06']], 'gradientUnits="userSpaceOnUse" x1="0" y1="90" x2="0" y2="160"')
      + `<path d="M0 104Q50 80 100 104V160H0Z" fill="url(#${u}turf)"/><path d="M0 104Q50 80 100 104V160H0Z" fill="#2A0C02" fill-opacity=".35"/><path d="${quad(Y(20), 160)}" fill="url(#${u}turf)"/>`
      + `<path d="${quad(Y(16), Y(11))}${quad(Y(6), Y(3.6))}" fill="#FFE2B8" fill-opacity=".1"/>`
      + `<path d="${[20, 16, 11, 6].map(z => `M${X(Y(z), -1)} ${Y(z)}H${X(Y(z), 1)}`).join('')}M${X(92, -1)} 92L${X(160, -1)} 160M${X(92, 1)} 92L${X(160, 1)} 160" fill="none" stroke="#FFF6E6" stroke-width=".65"/>`
      + `<path class="pa-fine" d="${[-.16, .16].map(s => `M${X(93, s)} 93L${X(160, s)} 160`).join('')}" fill="none" stroke="#FFF4E2" stroke-opacity=".5" stroke-width=".5" stroke-dasharray=".4 2"/>`
      + `<path d="M0 86.4L50 85.5L100 86.4L50 87.3Z" fill="#FFF6E0" fill-opacity=".55"/>`
      + lin(`${u}beam`, [[0, '#FFFDF4', .55], [.65, '#FFF1D0', .26], [1, '#FFE2A8', .1]])
      + `<path d="M8 57.6L18 57.6L46 104L30 104ZM82 57.6L92 57.6L70 104L54 104Z" fill="url(#${u}beam)"/>`
      + `<path class="pa-fine" fill="#FFF1D0" fill-opacity=".7" d="M32 64h.5v.5h-.5zM41 56h.4v.4h-.4zM63 60h.5v.5h-.5zM68 74h.4v.4h-.4zM29 82h.4v.4h-.4zM57 50h.4v.4h-.4zM74 70h.5v.5h-.5zM24 70h.4v.4h-.4z"/>`
      // the shadow of the tee and the ball, thrown toward us; light behind the ball
      + lin(`${u}shade`, [[0, '#1A0601', .6], [1, '#1A0601', 0]]) + `<path d="M39 107L55.4 107L64 129L31 129Z" fill="url(#${u}shade)"/>`
      + k.burst({cx: 50, cy: 78, n: 16, r: 44, w: .3, a: .09, c: '#FFF4D8'}) + k.glow({cx: 50, cy: 78, r: 26, c: '#FFF4D8', a: .6})
      // the tee: its front, its side in shadow, the cradle's prongs, a lit edge
      + lin(`${u}tee`, [[0, '#FF9A48'], [1, '#B8461A']])
      + `<path d="M55.4 107L58 105.4L54.6 98.6L52.6 99.4Z" fill="#7A2A0A"/><path d="M38.6 107L55.4 107L52.6 99.4L41.4 99.4Z" fill="url(#${u}tee)"/>`
      + `<path d="M41.4 99.4L41.8 95Q47 98.6 52.2 95L52.6 99.4Z" fill="${k.pc}" stroke="#8E3510" stroke-width=".3"/><path d="M41.4 99.4H52.6M38.6 107h16.8" stroke="#FFD2A0" stroke-width=".45"/>`
      // the ball, standing on the tee
      + ball(u, 'ball', 49.6, 77, 2.05, -82)
      + `<g transform="translate(49.6 77) rotate(-82) scale(2.05)"><path d="M-9.4 1.4C-5.6 7.2 5.6 7.2 9.4 1.4M-8 -2.6C-4.6-6.6 4.6-6.6 8-2.6" fill="none" stroke="#FFE6BC" stroke-opacity=".75" stroke-width=".35" stroke-linecap="round"/></g>`
      // the grass at our feet, near black against the glow, a cream rim of light along the back row's tips; embers
      // drifting up
      + `<path d="${blades(64, 1.62, 129, 5, 8, 0)}" fill="#2A0E06" stroke="#FFE2B0" stroke-opacity=".55" stroke-width=".3" stroke-linejoin="round"/>`
      + `<path d="${blades(52, 2, 130, 3, 5, 1.3)}" fill="#1A0803"/>`
      + embers.map(([x, y, d]) => `<circle class="pa-rise" style="--d:${d}s" cx="${x}" cy="${y}" r=".7" fill="#FFC870"/>`).join('');
  }}
];
