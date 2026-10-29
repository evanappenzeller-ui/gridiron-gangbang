// The Premium Pack's art designs (views/dynasty-packs.js frames them: tier 3, purple #8B3FD9; the frame already draws
// its foil sheen, crimped seals, an embossed quilt and a holo rainbow sheen; a holo brand bar). Pocket's packs come in
// several artworks; so do ours, more detailed the rarer the pack (the owner, Oct 29 2026: "Add more art designs to the
// packs. The more rare the pack, the more detailed the art design should be"). Each design: {id: 'prem-<slug>', name
// (for screen readers), svg: (u, k) => markup in a 100 x 160 viewBox, full-bleed, the subject in y 24..122; ids
// `${u}name`; at most 90 elements}. The guide is at the top of views/dynasty-packs.js.
// Tier 3: a night-lit, platinum-trimmed step up from the Team Pack: each design in three depths (a patterned ground of
// halftone, stars or light; the subject, shaded in gradients and lit by a glow; something nearer the eye), with a few
// sparkles twinkling and a slow light at most.

const f = n => +n.toFixed(2);
// (a seeded scatter, the same on every pack: n points [x, y] in x0..x1, y0..y1)
const scatter = (n, seed, x0, x1, y0, y1) => {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({length: n}, () => [f(x0 + r() * (x1 - x0)), f(y0 + r() * (y1 - y0))]);
};
// (dots as one stroked path: each a zero-length line with round caps)
const dots = pts => pts.map(([x, y]) => `M${x} ${y}h0`).join('');
// (a four-pointed sparkle's path d)
const spark = (k, x, y, r) => k.star(x, y, r, 4, .22);
// (a point on a cubic Bezier and the angle of its tangent, in degrees)
const bez = (p, t) => {
  const m = 1 - t, c = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t], d = [-3 * m * m, 3 * m * m - 6 * m * t, 6 * m * t - 3 * t * t, 3 * t * t];
  const at = (w, i) => w.reduce((a, v, j) => a + v * p[j][i], 0);
  return [at(c, 0), at(c, 1), Math.atan2(at(d, 1), at(d, 0)) * 180 / Math.PI];
};

export default [
  // Crest: a platinum-rimmed shield bearing a bevelled star, wreathed in silver laurels over a ribbon, a halftone
  // ring and slow-turning rays behind it, sparkles round it.
  {id: 'prem-star', name: 'Crest: a shield with a star, laurels and a ribbon', svg: (u, k) => {
    // (the bevelled star: each point a light facet and a dark one)
    const S = (cx, cy, r) => {
      const P = i => { const a = (i * 36 - 90) * Math.PI / 180, q = i % 2 ? r * .44 : r; return `${f(cx + q * Math.cos(a))} ${f(cy + q * Math.sin(a))}`; };
      return [0, 1].map(side => Array.from({length: 5}, (_, i) => `M${cx} ${cy}L${P(2 * i)}L${P((2 * i + (side ? 1 : 9)) % 10)}Z`).join(''));
    };
    const [lit, dim] = S(50, 69, 15.5);
    // (the left laurel branch, from the foot of the shield up its side: leaves in pairs along the stem)
    const stem = [[47, 109], [30, 106], [18, 90], [21, 56]];
    const leaves = [.06, .18, .3, .42, .54, .66, .78, .9].map(t => { const [x, y, a] = bez(stem, t); return `<use href="#${u}lf" transform="translate(${f(x)} ${f(y)}) rotate(${f(a - 38)})"/><use href="#${u}lf" transform="translate(${f(x)} ${f(y)}) rotate(${f(a + 38)})"/>`; }).join('') + (([x, y, a]) => `<use href="#${u}lf" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"/>`)(bez(stem, 1));
    return `<radialGradient id="${u}bg" cx="50%" cy="44%" r="72%"><stop offset="0" stop-color="${k.pl}"/><stop offset=".45" stop-color="${k.pc}"/><stop offset="1" stop-color="#2E1053"/></radialGradient><rect width="100" height="160" fill="url(#${u}bg)"/>`
      + `<g class="pa-spin" style="--t:90s;--oy:70px">${k.burst({cy: 70, n: 24, a: .12})}</g>`
      + `<pattern id="${u}ht" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="1.6" cy="1.6" r=".75" fill="#fff"/></pattern>`
      + `<radialGradient id="${u}hm" cx="50" cy="70" r="54" gradientUnits="userSpaceOnUse"><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#fff" stop-opacity=".24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
      + `<mask id="${u}hk"><rect width="100" height="160" fill="url(#${u}hm)"/></mask><rect class="pa-fine" width="100" height="160" fill="url(#${u}ht)" mask="url(#${u}hk)"/>`
      + k.glow({cy: 70, r: 46, c: '#F4E9FF', a: .7})
      // the laurels (silver leaves, each shaded across)
      + `<linearGradient id="${u}lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#E4D6FF"/><stop offset="1" stop-color="#9878D2"/></linearGradient>`
      + `<defs><path id="${u}lf" d="M0 0C2.6-3.2 7-3.6 10.4 0C7 2.6 2.6 2.6 0 0Z" fill="url(#${u}lg)" stroke="#3A145F" stroke-width=".45"/>`
      + `<g id="${u}br"><path d="M${stem[0]}C${stem[1]} ${stem[2]} ${stem[3]}" fill="none" stroke="#3A145F" stroke-width="1.6" stroke-linecap="round"/>${leaves}</g></defs>`
      + `<use href="#${u}br"/><use href="#${u}br" transform="matrix(-1 0 0 1 100 0)"/>`
      // the shield: a platinum rim, the field lit down its left half, an inner line, the star
      + `<linearGradient id="${u}rm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#C9B6F0"/><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#8D72C4"/></linearGradient>`
      + `<path d="M24.6 40.6Q50 34 75.4 40.6V66C75.4 87 64 98 50 106C36 98 24.6 87 24.6 66Z" fill="url(#${u}rm)" stroke="#3A145F" stroke-width=".8"/>`
      + `<radialGradient id="${u}fd" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#A65CF0"/><stop offset=".6" stop-color="${k.pc}"/><stop offset="1" stop-color="#4A1F7A"/></radialGradient>`
      + `<path d="M28.4 44Q50 38.4 71.6 44V66C71.6 84 61.6 94 50 101C38.4 94 28.4 84 28.4 66Z" fill="url(#${u}fd)"/>`
      + `<path d="M28.4 44Q39 41.2 50 40.6V101C38.4 94 28.4 84 28.4 66Z" fill="#fff" fill-opacity=".1"/>`
      + `<path class="pa-fine" d="M31.4 46.4Q50 41.6 68.6 46.4V66C68.6 82 60 91 50 97.6C40 91 31.4 82 31.4 66Z" fill="none" stroke="#E9DEFF" stroke-opacity=".6" stroke-width=".5"/>`
      + `<path d="${k.star(50, 70.2, 16, 5, .44)}" fill="#2A0E4A" fill-opacity=".45"/>`
      + `<path d="${lit}" fill="#fff"/><path d="${dim}" fill="#D9C6FF"/><path d="${k.star(50, 69, 15.5, 5, .44)}" fill="none" stroke="#fff" stroke-width=".5" stroke-linejoin="round"/>`
      // the ribbon across the shield's foot: its tails behind, folded, three small stars on the band
      + `<linearGradient id="${u}rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C45AF0"/><stop offset="1" stop-color="#6A24B0"/></linearGradient>`
      + `<path d="M23 104.6L9.6 106.6L14.4 112.2L10.4 118L25.6 116.6ZM77 104.6L90.4 106.6L85.6 112.2L89.6 118L74.4 116.6Z" fill="#5A1E98" stroke="#E9DEFF" stroke-width=".6" stroke-linejoin="round"/>`
      + `<path d="M23 104.6L27 107.6V114.6L25.6 116.6ZM77 104.6L73 107.6V114.6L74.4 116.6Z" fill="#33105A"/>`
      + `<path d="M21.6 100.6Q50 109.4 78.4 100.6L78.4 110.4Q50 119.2 21.6 110.4Z" fill="url(#${u}rb)" stroke="#E9DEFF" stroke-width=".8" stroke-linejoin="round"/>`
      + `<path d="${k.star(50, 109.8, 2.8)}${k.star(40, 108.8, 2.1)}${k.star(60, 108.8, 2.1)}" fill="#fff"/>`
      // above and round it: three stars in an arc, sparkles twinkling
      + `<path class="pa-pulse" d="${k.star(50, 30.6, 4.4)}${k.star(40.4, 33.2, 2.6)}${k.star(59.6, 33.2, 2.6)}" fill="#fff"/>`
      + [[15, 40, 3.6, 0], [86, 50, 3, .9], [13, 88, 2.6, 1.6], [87, 92, 3.4, .4], [74, 30, 2.2, 2.1], [26, 30, 2, 1.2]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" d="${spark(k, x, y, r)}" fill="#fff"/>`).join('')
      + `<radialGradient id="${u}bk"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
      + `<g class="pa-float" style="--t:5s"><circle cx="9" cy="118" r="7" fill="url(#${u}bk)"/><circle cx="92" cy="122" r="5" fill="url(#${u}bk)"/></g>`;
  }},
  // Night Spiral: a ball in a tight spiral streaking up across a night full of stars, its comet's tail corkscrewing
  // behind it, the stadium's rim and light towers dark below.
  {id: 'prem-spiral', name: 'Night Spiral: a football spiralling across a starry night', svg: (u, k) => {
    // (the flight, back from the ball along a rising arc: a point t of the way down it, o across it)
    const X = 59, Y = 60, A = -36, Q = [[X, Y], [34, 78], [6, 116]];
    const at = (t, o) => {
      const m = 1 - t, dx = 2 * m * (Q[1][0] - Q[0][0]) + 2 * t * (Q[2][0] - Q[1][0]), dy = 2 * m * (Q[1][1] - Q[0][1]) + 2 * t * (Q[2][1] - Q[1][1]), l = Math.hypot(dx, dy);
      return `${f(m * m * Q[0][0] + 2 * m * t * Q[1][0] + t * t * Q[2][0] - o * dy / l)} ${f(m * m * Q[0][1] + 2 * m * t * Q[1][1] + t * t * Q[2][1] + o * dx / l)}`;
    };
    // (the comet's tail: w wide at the ball, narrowing to nothing at t1)
    const tail = (w, t1) => { const T = Array.from({length: 17}, (_, i) => i / 16); return 'M' + T.map(i => at(i * t1, w * (1 - i) ** 1.3)).join('L') + 'L' + T.reverse().map(i => at(i * t1, -w * (1 - i) ** 1.3)).join('L') + 'Z'; };
    const helix = 'M' + Array.from({length: 64}, (_, i) => { const t = .12 + i * .0118; return at(t, 7.4 * (1 - t) * Math.sin(t * 34)); }).join('L');
    return `<linearGradient id="${u}sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#170730"/><stop offset=".5" stop-color="#43196F"/><stop offset=".78" stop-color="${k.pc}"/><stop offset="1" stop-color="#2A0E4A"/></linearGradient>`
      + `<rect width="100" height="160" fill="url(#${u}sk)"/>`
      + `<radialGradient id="${u}nb"><stop offset="0" stop-color="#FF8AD8" stop-opacity=".22"/><stop offset="1" stop-color="#FF8AD8" stop-opacity="0"/></radialGradient>`
      + `<ellipse cx="44" cy="70" rx="64" ry="18" transform="rotate(-36 44 70)" fill="url(#${u}nb)"/>`
      + k.glow({cy: 116, r: 60, c: '#D8B8FF', a: .5})
      + `<path class="pa-fine" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".55" stroke-linecap="round" d="${dots(scatter(70, 7, 2, 98, 22, 112))}"/>`
      + `<path fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" d="${dots(scatter(16, 31, 4, 96, 24, 100))}"/>`
      + [[18, 34, 3.4, 0], [84, 30, 2.6, 1.3], [12, 64, 2.4, .7], [86, 78, 3, 2], [34, 26, 2, 1.7]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" d="${spark(k, x, y, r)}" fill="#fff"/>`).join('')
      // the moon, a crescent high on the right
      + k.glow({cx: 80, cy: 42, r: 13, c: '#E9DEFF', a: .45}) + `<path d="M81.4 35.4A7 7 0 1 0 84.6 47.2A5.6 5.6 0 1 1 81.4 35.4Z" fill="#F4EEFF"/>`
      // the comet's tail and the spiral wound round it
      + `<linearGradient id="${u}tw" gradientUnits="userSpaceOnUse" x1="${X}" y1="${Y}" x2="${Q[2][0]}" y2="${Q[2][1]}"><stop offset="0" stop-color="#F0E0FF" stop-opacity=".75"/><stop offset="1" stop-color="#E4CCFF" stop-opacity="0"/></linearGradient>`
      + `<linearGradient id="${u}tc" gradientUnits="userSpaceOnUse" x1="${X}" y1="${Y}" x2="${at(.8, 0).replace(' ', '" y2="')}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      + `<path d="${tail(9.6, 1)}" fill="url(#${u}tw)" fill-opacity=".55"/><path d="${tail(6.4, .9)}" fill="url(#${u}tw)"/><path class="pa-pulse" d="${tail(3, .75)}" fill="url(#${u}tc)"/>`
      + k.glow({cx: X, cy: Y, r: 22, c: '#F1E4FF', a: .55}) + `<path d="${helix}" fill="none" stroke="url(#${u}tc)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`
      // the ball: leather shaded round, white stripes near its tips, its seam and laces, a gleam
      + `<radialGradient id="${u}lb" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#C47A45"/><stop offset=".55" stop-color="#8A4520"/><stop offset="1" stop-color="#4A200C"/></radialGradient>`
      + `<g transform="translate(${X} ${Y}) rotate(${A}) scale(1.14)"><path d="M-17 0C-10-13.4 10-13.4 17 0C10 13.4-10 13.4-17 0Z" fill="url(#${u}lb)" stroke="#2A0E05" stroke-width=".6"/>`
      + `<path d="M-15.6-1.6C-8-5.4 8-5.4 15.6-1.6" fill="none" stroke="#3A1606" stroke-opacity=".55" stroke-width=".5"/>`
      + `<path d="M-11.4-5.8C-10.4-2-10.4 2-11.4 5.8M11.4-5.8C10.4-2 10.4 2 11.4 5.8" fill="none" stroke="#fff" stroke-width="1.6"/>`
      + `<path d="M-6.4-4.2H6.4M-4.2-6.2V-2.2M-1.4-6.4V-2M1.4-6.4V-2M4.2-6.2V-2.2" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>`
      + `<path d="M-12-5C-6-10.6 6-10.6 12-5C6-8.6-6-8.6-12-5Z" fill="#fff" fill-opacity=".35"/></g>`
      // below: the stadium's rim, its light towers' banks glowing, their beams
      + `<linearGradient id="${u}bm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      + `<path d="M10 98L22 140H44ZM90 98L78 140H56Z" fill="url(#${u}bm)"/>`
      + `<linearGradient id="${u}bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A1462"/><stop offset=".3" stop-color="#1B0832"/></linearGradient><path d="M0 101C16 110 32 113 50 113S84 110 100 101V160H0Z" fill="url(#${u}bw)"/><path d="M0 101C16 110 32 113 50 113S84 110 100 101" fill="none" stroke="#C9A6FF" stroke-opacity=".7" stroke-width=".8"/>`
      + `<path d="M0 103.4C16 112.4 32 115.4 50 115.4S84 112.4 100 103.4" fill="none" stroke="#FFF1C9" stroke-width="1" stroke-linecap="round" stroke-dasharray="0 3.2"/>`
      + `<path d="M10 92V106M90 92V106" stroke="#1B0832" stroke-width="1.6"/><path d="M4.6 87.6h10.8v5.2H4.6zM84.6 87.6h10.8v5.2H84.6z" fill="#1B0832"/>`
      + `<path class="pa-pulse" style="--t:4s" d="M5.8 88.8h8.4v2.8H5.8zM85.8 88.8h8.4v2.8H85.8z" fill="#FFF6D8"/>`
      + k.glow({cx: 10, cy: 90, r: 9, c: '#FFF6D8', a: .7}) + k.glow({cx: 90, cy: 90, r: 9, c: '#FFF6D8', a: .7})
      + `<path class="pa-fine" fill="none" stroke="#C9A6FF" stroke-opacity=".4" stroke-width=".5" stroke-dasharray=".6 1.4" d="M0 107C16 115 32 118 50 118S84 115 100 107M0 113C16 120.6 32 123.4 50 123.4S84 120.6 100 113"/>`;
  }},
  // The Tunnel: down the players' tunnel, its arches lit one by one, to the bright mouth and the field and stands in
  // the light beyond; the light floods back in rays, motes of dust rise in it.
  {id: 'prem-tunnel', name: 'The Tunnel: a players’ tunnel opening onto the lit field', svg: (u, k) => {
    const V = [50, 78], rib = sc => `translate(${V[0]} ${V[1]}) scale(${sc}) translate(${-V[0]} ${-V[1]})`;
    return `<radialGradient id="${u}bg" cx="50" cy="76" r="80" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F0E2FF"/><stop offset=".14" stop-color="#B57CF0"/><stop offset=".3" stop-color="${k.pc}"/><stop offset=".58" stop-color="#3D1468"/><stop offset="1" stop-color="#12041F"/></radialGradient>`
      + `<rect width="100" height="160" fill="url(#${u}bg)"/>`
      // beyond the mouth: the light, the stands with their dots of light, the field with its lines
      + `<defs><path id="${u}ar" d="M39 94V73.4A11 11 0 0 1 61 73.4V94"/><path id="${u}rl" d="M39 86V73.4A11 11 0 0 1 61 73.4V86"/></defs>`
      + `<radialGradient id="${u}sky" cx="50%" cy="70%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E2CCFF"/></radialGradient>`
      + `<use href="#${u}ar" fill="url(#${u}sky)"/>`
      + `<path d="M39 80L50 77.6L61 80V86H39Z" fill="#A98AD6"/><path class="pa-fine" d="${dots(scatter(14, 3, 40, 60, 80, 84.6))}" stroke="#fff" stroke-width=".7" stroke-linecap="round"/>`
      + `<path d="M39 86H61V94H39Z" fill="#8FDCAE"/><path d="M42 94L44.4 86M50 94V86M58 94L55.6 86" stroke="#fff" stroke-width=".5" stroke-opacity=".9"/>`
      // the tunnel: the floor running up to the mouth, a runner along it, seams across
      + `<linearGradient id="${u}fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9C6AE0"/><stop offset=".35" stop-color="#4A1C7E"/><stop offset="1" stop-color="#12041F"/></linearGradient>`
      + `<path d="M39 94H61L106.4 160H-6.4Z" fill="url(#${u}fl)"/>`
      + `<path d="M46.4 94H53.6L68 160H32Z" fill="#7B34C6" fill-opacity=".85"/><path d="M46.4 94L32 160M53.6 94L68 160" stroke="#E9DEFF" stroke-opacity=".55" stroke-width=".7"/>`
      + `<path class="pa-fine" d="M35 98.6H65M28.4 106.2H71.6M17 119.4H83M-2 141.6H102" stroke="#000" stroke-opacity=".3" stroke-width=".6"/>`
      // the arches, nearest last: each a dark band with its rim lit from the mouth, a lamp at its crown
      + [1.42, 2.02, 2.9, 4.2].map((sc, i) => `<use href="#${u}ar" transform="${rib(sc)}" fill="none" stroke="#260A43" stroke-width="${f(1.5 + i * .12)}"/>`
        + `<use href="#${u}rl" transform="${rib(sc - .05)}" fill="none" stroke="#E2CCFF" stroke-opacity="${f(.85 - i * .12)}" stroke-width=".4"/>`).join('')
      + [1.42, 2.02, 2.9].map((sc, i) => `<rect class="pa-pulse" style="--d:${f(i * .5)}s;--t:2.4s" x="${f(V[0] - 2.4 * sc)}" y="${f(V[1] + (62.4 - V[1]) * sc - .6 * sc)}" width="${f(4.8 * sc)}" height="${f(1.2 * sc)}" rx="${f(.5 * sc)}" fill="#FFF3D6"/>`).join('')
      // a banner hung on each wall, between the second and third arches
      + `<linearGradient id="${u}bn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A45CF0"/><stop offset="1" stop-color="#5A1E98"/></linearGradient>`
      + `<defs><g id="${u}bb"><path d="M19.4 49.6L26.4 56.2V77.4L22.9 75.6L19.4 82.4Z" fill="url(#${u}bn)" stroke="#E9DEFF" stroke-width=".5" stroke-linejoin="round"/>`
      + `<path d="M19.4 52.2L26.4 58.4" stroke="#fff" stroke-opacity=".7" stroke-width=".7"/><path d="${k.star(22.9, 66, 2.6)}" fill="#fff"/></g></defs>`
      + `<use href="#${u}bb"/><use href="#${u}bb" transform="matrix(-1 0 0 1 100 0)"/>`
      // the light flooding back in
      + k.burst({cx: 50, cy: 80, n: 14, w: .3, a: .08}) + k.glow({cy: 82, r: 30, a: .75})
      + k.glow({cy: 100, r: 22, c: '#E7D3FF', a: .45})
      + scatter(6, 19, 36, 64, 92, 112).map(([x, y], i) => `<circle class="pa-rise" style="--d:${f(i * .55)}s;--t:${f(3.2 + (i % 3) * .5)}s" cx="${x}" cy="${y}" r="${f(.5 + (i % 3) * .25)}" fill="#fff"/>`).join('');
  }},
  // Amethyst: the ball cut as a gem, its facets catching the light in shades of violet, floating in a spotlight over a
  // platinum-rimmed plinth on a quilt of dots, sparkles glinting off it.
  {id: 'prem-gem', name: 'Amethyst: a football cut as a purple gem', svg: (u, k) => {
    // (the facets: a top edge, a staggered row, the girdle, a staggered row, the bottom edge; each triangle shaded by
    // where it faces, the light from the upper left)
    const W = 24, H = 14.6, yt = x => -H * (1 - (x / W) ** 2), xs = Array.from({length: 7}, (_, i) => -W + i * 8), ms = xs.slice(0, 6).map(x => x + 4);
    const T = xs.map(x => [x, yt(x)]), M = ms.map(x => [x, .52 * yt(x)]), G = xs.map(x => [x, 0]), N = ms.map(x => [x, -.52 * yt(x)]), B = xs.map(x => [x, -yt(x)]);
    const tris = [];
    const band = (P, Q) => { for (let j = 0; j < 6; j++) { tris.push([P[j], P[j + 1], Q[j]]); if (j < 5) tris.push([Q[j], Q[j + 1], P[j + 1]]); } };
    band(T, M); band(G, M); band(G, N); band(B, N);
    const TONE = ['#240848', '#3E1278', '#6226B4', '#8E52E6', '#C6A4FF', '#fff'], by = TONE.map(() => '');
    tris.forEach(([a, b, c], i) => {
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, v = -cx / W * 1.3 - cy / H * 2.2 + ((i * 7) % 5 - 2) * .6;
      by[Math.max(0, Math.min(5, Math.round(2.4 + v)))] += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}Z`;
    });
    const rim = 'M' + [...T, ...B.slice().reverse()].map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
    const edges = [T, M, G, N, B].map(P => 'M' + P.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')).join('') + tris.map(([a, , c]) => `M${f(a[0])} ${f(a[1])}L${f(c[0])} ${f(c[1])}`).join('');
    return `<radialGradient id="${u}bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${k.pc}"/><stop offset=".55" stop-color="#4A1A80"/><stop offset="1" stop-color="#1A0733"/></radialGradient><rect width="100" height="160" fill="url(#${u}bg)"/>`
      + `<pattern id="${u}q" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45 50 74)"><circle cx="0" cy="0" r=".7" fill="#E9DEFF" fill-opacity=".3"/><circle cx="4" cy="4" r=".35" fill="#E9DEFF" fill-opacity=".2"/></pattern>`
      + `<rect class="pa-fine" width="100" height="160" fill="url(#${u}q)"/>`
      // the spotlight from above, the plinth under it
      + `<linearGradient id="${u}sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#F1E4FF" stop-opacity=".4"/></linearGradient>`
      + `<path d="M40 21H60L82 108H18Z" fill="url(#${u}sp)"/>` + k.glow({cy: 70, r: 40, c: '#E7D3FF', a: .6})
      + `<linearGradient id="${u}pl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#24093F"/><stop offset=".45" stop-color="#5A2896"/><stop offset="1" stop-color="#1A0630"/></linearGradient>`
      + `<path d="M24 106V116C24 120.4 35.6 124 50 124S76 120.4 76 116V106Z" fill="url(#${u}pl)"/><path d="M24 109.4C24 113.8 35.6 117.4 50 117.4S76 113.8 76 109.4" fill="none" stroke="#E2D2FF" stroke-opacity=".7" stroke-width=".8"/>`
      + `<ellipse cx="50" cy="106" rx="26" ry="7" fill="#3C1470" stroke="#F1E8FF" stroke-width="1.1"/><ellipse cx="50" cy="106" rx="14" ry="3.2" fill="#C9A6FF" fill-opacity=".45"/>`
      // the gem, turned along its flight, floating: its facets by shade, their edges, its rim, white laces
      + `<g class="pa-float" style="--t:5s"><g transform="translate(50 68) rotate(-28) scale(1.16)">${by.map((d, i) => d ? `<path d="${d}" fill="${TONE[i]}"/>` : '').join('')}`
      + `<path class="pa-fine" d="${edges}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".3" stroke-linejoin="round"/>`
      + `<path d="${rim}" fill="none" stroke="#1E0640" stroke-width=".9" stroke-linejoin="round"/>`
      + `<path d="M-7-6.6H7M-4.6-9V-4.2M-1.6-9.4V-3.8M1.6-9.4V-3.8M4.6-9V-4.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-opacity=".92"/></g></g>`
      + [[33, 56, 5, 0], [64, 88, 3.4, 1.2], [80, 46, 3, .6], [18, 84, 2.6, 1.8], [72, 30, 2.2, 2.3], [27, 34, 2.4, .9]].map(([x, y, r, d]) => `<path class="pa-twinkle" style="--d:${d}s" d="${spark(k, x, y, r)}" fill="#fff"/>`).join('');
  }}
];
