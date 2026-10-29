// The Team Pack's art designs (views/dynasty-packs.js frames them: tier 2, green #1E9E6A; the frame already draws its
// foil sheen, crimped seals and side seams, an embossed quilt toward the edges). Pocket's packs come in several
// artworks; so do ours, more detailed the rarer the pack (the owner, Oct 29 2026: "Add more art designs to the packs.
// The more rare the pack, the more detailed the art design should be"). Each design: {id: 'team-<slug>', name (for
// screen readers), svg: (u, k) => markup in a 100 x 160 viewBox, full-bleed, the subject in y 24..122; ids `${u}name`;
// at most 55 elements}. The guide is at the top of views/dynasty-packs.js.
// Tier 2: a step up from the Starter's flat art, the gear of a club (the player picks the team after, so no team's
// colours or marks): bold subjects outlined in a dark green ink, two tones of shading and a gleam, on a patterned
// ground (mowed stripes, yard lines, locker slats, bleacher rows); a little motion at most.

const INK = '#0B3323';
const f = n => +n.toFixed(2);
// (the helmet's shell, side on and facing right, its face mask's front at 0 0, on the Starter helmet's profile: the dome,
// the jaw flap sweeping down and forward, the face opening's edge; absolute commands only, so shift() moves it)
const HS = 'M-10-8C-12-22-24-31-38-31C-53-31-63-19-63-3C-63 7-60 15-54 20L-40 22.5C-34 23-30 27.5-22 28.5C-18 29-15.5 27.5-15 25.5L-15 19C-19.5 13-21 5-19-1C-18-4.5-16-7-12.5-7.5Z';
// (a path of absolute commands moved by dx dy)
const shift = (d, dx, dy) => { let i = 0; return d.replace(/-?\d*\.?\d+/g, n => f(+n + (i++ % 2 ? dy : dx))); };
// (the green ground every design shares, light behind the subject: 4 elements)
const ground = (u, k, cy = 44) => `<radialGradient id="${u}bg" cx="50%" cy="${cy}%" r="74%"><stop offset="0" stop-color="${k.pl}"/><stop offset=".5" stop-color="${k.pc}"/>`
  + `<stop offset="1" stop-color="${k.pd}"/></radialGradient><rect width="100" height="160" fill="url(#${u}bg)"/>`;
// (squared jersey numerals, stroked: x y the top left, w h one digit)
const NUM = {8: (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}zM${x} ${f(y + h / 2)}h${w}`};

export default [
  // Helmet to Helmet: two helmets, home green and road white, face mask to face mask on the line of scrimmage, the
  // field's mowed stripes running away under them and a flash where they meet.
  {id: 'team-helmet', name: 'Helmet to Helmet: two helmets face to face on the line', svg: (u, k) => {
    const H = 98, L = i => `M${f(50 + i * 13)} ${H}L${f(50 + i * 44)} 160`;
    const strip = i => `M${f(50 + i * 13)} ${H}L${f(50 + (i + 1) * 13)} ${H}L${f(50 + (i + 1) * 44)} 160L${f(50 + i * 44)} 160Z`;
    return ground(u, k, 40) + k.burst({cy: 70, n: 22, a: .13})
      + `<linearGradient id="${u}fd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.pd}"/><stop offset="1" stop-color="${INK}"/></linearGradient>`
      + `<path d="M0 ${H}H100V160H0z" fill="url(#${u}fd)"/>`
      + `<path fill="#fff" fill-opacity=".07" d="${[-5, -3, -1, 1, 3].map(strip).join('')}"/>`
      + `<path fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".9" d="${[-4, -3, -2, -1, 1, 2, 3, 4].map(L).join('')}M0 ${H}H100"/>`
      + `<path d="${L(0)}" stroke="#fff" stroke-width="1.8" stroke-opacity=".9"/>`
      + k.glow({cy: 70, r: 30, a: .55})
      + `<ellipse cx="50" cy="101.5" rx="34" ry="3" fill="#000" opacity=".25"/>`
      // the helmet, facing right, its mask's front at 0 0 (currentColor its shell, the use's stroke its stripes): the dark
      // face opening behind the mask, the shell, its shading and stripe, the jaw flap's seam, the ear hole, the mask's
      // bars fixed to the shell at the brow, the ear and the jaw
      + `<defs><clipPath id="${u}hc"><path id="${u}hs" d="${HS}"/></clipPath>`
      + `<path id="${u}fm" fill="none" stroke-linecap="round" stroke-linejoin="round" d="M-12.5-7.5H-3C-.5-7.5 1-6 1-3.5V15C1 22-4 27-15 26.6M-20 3H1M-17 13H1M-6.5-7.5V26"/>`
      + `<path id="${u}st" fill="none" d="M-60.4 6C-62.4-14-51-28.6-38-29C-24-29.6-15-22-12.4-11"/>`
      + `<g id="${u}h"><path d="M-14-7.6H-2C.2-7.6 1.6-6 1.6-3.6V15C1.6 21.6-3 25.6-12 26.6L-15 25.5V19C-19.5 13-21 5-19-1C-18-4.5-16-7-14-7.6Z" fill="#14231C"/><use href="#${u}hs" fill="currentColor"/>`
      + `<g clip-path="url(#${u}hc)"><path fill="#000" fill-opacity=".22" fill-rule="evenodd" stroke="none" d="M-80-50H20V50H-80Z${shift(HS, 3.4, -6)}"/>`
      + `<use href="#${u}st" stroke-width="6.4"/><use href="#${u}st" stroke="currentColor" stroke-width="2"/></g>`
      + `<path fill="#fff" fill-opacity=".55" stroke="none" d="M-50-19C-42-26.5-30-27.5-20.5-21.5C-30-24.5-41-23.5-50-16Z"/>`
      + `<use href="#${u}hs" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
      + `<path d="M-55 13C-46 15.6-36 15.8-27 13.6C-24 13-22 11.6-20.6 9.6" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/>`
      + `<circle cx="-37" cy="2" r="2.8" fill="#3C4650" stroke="${INK}" stroke-width="1.2"/>`
      + `<use href="#${u}fm" stroke="${INK}" stroke-width="4.6"/><use href="#${u}fm" stroke="#B4BEC8" stroke-width="2.1"/></g></defs>`
      + `<use href="#${u}h" transform="translate(48.6 76) rotate(5) scale(.65)" color="${k.pc}" stroke="#fff"/>`
      + `<use href="#${u}h" transform="translate(51.4 76) rotate(-5) scale(-.65 .65)" color="#F3F6F4" stroke="${k.pc}"/>`
      + `<path class="pa-pulse" fill="#fff" d="${k.star(50, 70, 8.4, 8, .3)}"/><path fill="#FFE47A" d="${k.star(50, 70, 4.4, 8, .4)}"/>`
      + `<path fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" d="M50 58v-5M43.6 60l-2.6-2.6M56.4 60l2.6-2.6"/>`;
  }},
  // Home Jersey: a home jersey hung back out in its locker, a big outlined 88 across it and striped sleeves.
  {id: 'team-jersey', name: 'Home Jersey: a green number 88 jersey hung in a locker', svg: (u, k) => ground(u, k, 40)
    + `<linearGradient id="${u}lk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}"/><stop offset=".6" stop-color="${k.pd}"/><stop offset="1" stop-color="${INK}"/></linearGradient>`
    + `<path d="M13 22H87V160H13z" fill="url(#${u}lk)"/>`
    + `<path class="pa-fine" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="2" d="${Array.from({length: 9}, (_, i) => `M${17 + i * 8.25} 22V160`).join('')}"/>`
    + k.glow({cy: 60, r: 44, a: .32})
    + `<path d="M4 22H14V160H4zM86 22H96V160H86z" fill="#5C7A6C" stroke="${INK}" stroke-width="1"/><path d="M11 22h3v138h-3zM86 22h3v138h-3z" fill="#000" fill-opacity=".25"/>`
    + `<path class="pa-fine" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" d="${[0, 1, 2, 3, 4, 5].map(i => `M6.5 ${40 + i * 3.4}h5M88.5 ${40 + i * 3.4}h5`).join('')}"/>`
    + `<path d="M13 35H87" stroke="#9FB3A9" stroke-width="2.2"/><path d="M13 36.4H87" stroke="#000" stroke-opacity=".3" stroke-width=".8"/>`
    + `<path d="M50 44V38.2C50 35.4 48.6 34.2 47 34.8" fill="none" stroke="#C9D2CE" stroke-width="1.3" stroke-linecap="round"/>`
    + `<defs><clipPath id="${u}jc"><path id="${u}j" d="M41 42.5L25.5 46C21 47 18 50 16.5 54L12 69L26.5 74.5L29.5 66.5L30 109C30 111 31.4 112 33.4 112H66.6C68.6 112 70 111 70 109L70.5 66.5L73.5 74.5L88 69L83.5 54C82 50 79 47 74.5 46L59 42.5C56 44.6 53 45.4 50 45.4S44 44.6 41 42.5Z"/></clipPath></defs>`
    + `<use href="#${u}j" fill="${k.pc}"/>`
    + `<g clip-path="url(#${u}jc)"><path fill="#000" fill-opacity=".22" d="M58 40L100 50V130H62C66 110 66 80 58 40Z"/><path fill="#000" fill-opacity=".14" d="M26.5 74.5L32 60V130H0z"/>`
    + `<path fill="none" stroke="#fff" stroke-width="2.6" d="M8 62L28 70M92 62L72 70"/><path fill="none" stroke="${k.pd}" stroke-width="1.4" d="M8.4 66.4L27.2 73.6M91.6 66.4L72.8 73.6"/>`
    + `<path fill="#fff" fill-opacity=".3" d="M25.5 46C30 47 34 51 34 58V117H31V60C31 53 29 49 25.5 46Z"/></g>`
    + `<path d="M41 42.5C44 44.6 47 45.4 50 45.4S56 44.6 59 42.5" fill="none" stroke="#fff" stroke-width="2.4"/>`
    + `<path fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width=".9" stroke-linecap="round" d="M36 104c4 3 10 4 14 3M63 92c-2 6-2 12 0 18M40 52c3 2 7 2.6 10 2.4"/>`
    + `<use href="#${u}j" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`
    // (the 88: white, outlined in ink, its shadow cast down to the right)
    + `<defs><path id="${u}n" d="${NUM[8](35.4, 60, 11, 30)}${NUM[8](53.6, 60, 11, 30)}" fill="none" stroke="${INK}" stroke-width="7.2" stroke-linejoin="round"/></defs>`
    + `<use href="#${u}n" transform="translate(1.2 1.8)" opacity=".4"/><use href="#${u}n"/>`
    + `<path d="${NUM[8](35.4, 60, 11, 30)}${NUM[8](53.6, 60, 11, 30)}" fill="none" stroke="#fff" stroke-width="3.8" stroke-linejoin="round"/>`
    + `<path d="M26 121v8M74 121v8" stroke="#4A2E14" stroke-width="2.6"/><path d="M19 114.6h62v3.4H19z" fill="#C08A52" stroke="${INK}" stroke-width=".9"/><path d="M20 118h60v3.6H20z" fill="#7E5028" stroke="${INK}" stroke-width=".9"/>`},
  // Pennant: a felt pennant waving off its stick across the stands, a foam finger held up for number one before it.
  {id: 'team-pennant', name: 'Pennant: a waving pennant and a number one foam finger', svg: (u, k) => ground(u, k, 42)
    + `<path fill="#000" fill-opacity=".14" d="${Array.from({length: 9}, (_, i) => { const y = 22 + i * 6 + i * i * 1.1; return `M0 ${f(y)}H100V${f(y + 2.2 + i * 1.1)}H0z`; }).join('')}"/>`
    + `<path class="pa-fine" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.8" stroke-linecap="round" d="${Array.from({length: 7}, (_, i) => { const y = 26 + i * 6 + i * i * 1.1; return Array.from({length: 14}, (_, j) => `M${f(3 + j * 7.2 + (i % 2) * 3.6)} ${f(y + ((j * 7 + i * 3) % 5) * .3)}h0`).join(''); }).join('')}"/>`
    + k.burst({cx: 54, cy: 62, n: 18, a: .12}) + k.glow({cx: 54, cy: 60, r: 38, a: .45})
    // the pennant: its stick, then the felt (a white hoist band, a crease in the wave, a star), stitched
    + `<path d="M19.6 124L25.4 31" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M19.6 124L25.4 31" stroke="#B5763C" stroke-width="1.8" stroke-linecap="round"/><circle cx="25.5" cy="29.6" r="2.2" fill="#F2C94C" stroke="${INK}" stroke-width=".9"/>`
    + `<defs><clipPath id="${u}pc"><path id="${u}pf" d="M25.6 34C42 29 58 41 89 52C60 57 44 72 23.6 67Z"/></clipPath></defs>`
    + `<use href="#${u}pf" fill="${k.pc}"/><g clip-path="url(#${u}pc)"><path fill="#000" fill-opacity=".22" d="M44 26C50 40 50 56 47 74L62 70C64 54 62 40 56 30Z"/>`
    + `<path fill="#fff" fill-opacity=".22" d="M60 36C68 44 72 50 74 60L82 58C78 50 72 44 66 40Z"/><path fill="#fff" d="M20 20H33L31 80H18Z"/></g>`
    + `<path class="pa-fine" fill="none" stroke="${k.pd}" stroke-width=".6" stroke-dasharray="1.4 1" d="M30.4 34.6L28.8 66"/>`
    + `<path fill="#fff" stroke="${INK}" stroke-width=".9" stroke-linejoin="round" d="${k.star(58, 49, 7.4, 5, .45)}" transform="rotate(14 58 49)"/>`
    + `<use href="#${u}pf" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`
    // the foam finger, tilted in from the right: the index finger up at its side, the curled fingers and the thumb
    // across them, the striped cuff
    + `<g transform="translate(60 92) rotate(8)"><path d="M-12 15H12L11 38H-11Z" fill="${k.pc}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<path d="M-11.6 21H11.6M-11.2 28H11.2" stroke="#fff" stroke-width="2.4"/>`
    + `<path d="M4-33C4-38.4 16-38.4 16-33V-4L17 8C17 14 14 18 9 18H-10C-15 18-18 15-18 10V-6C-18-11-15-13-11-13H4Z" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<path fill="#000" fill-opacity=".14" d="M16-33V-4L17 8C17 14 14 18 9 18H4C10 16 13 12 13 6V-35.4C14.8-35 16-34.2 16-33ZM-18-6C-16-4-15 0-15 4V18H-10C-15 18-18 15-18 10Z"/>`
    + `<path fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round" d="M-18-4.4H2M-18 3.6H-2M-17.4 11H4M4-13V-3"/>`
    + `<path d="M16 2C9-2 1-3-4.4-.4-7 1-6.4 5.4-2.6 5.6 4 6 10 7.6 16.4 10.4" fill="#fff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`
    + `<path class="pa-fine" fill="#fff" fill-opacity=".9" d="M6.4-34.6C7.4-36 10-36.2 10.6-34.6V-14H6.4Z"/></g>`},
  // Coin Toss: the referee's thumb flicking the captain's coin up over midfield, the coin spinning silver against the
  // light, its star embossed, the midfield ring on the turf below.
  {id: 'team-toss', name: 'Coin Toss: the referee flicking the coin over midfield', svg: (u, k) => {
    const H = 104, strip = i => `M${f(50 + i * 13)} ${H}L${f(50 + (i + 1) * 13)} ${H}L${f(50 + (i + 1) * 40)} 160L${f(50 + i * 40)} 160Z`;
    return ground(u, k, 36) + k.burst({cy: 52, n: 22, a: .12})
      + `<linearGradient id="${u}fd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.pd}"/><stop offset="1" stop-color="${INK}"/></linearGradient>`
      + `<path d="M0 ${H}H100V160H0z" fill="url(#${u}fd)"/><path fill="#fff" fill-opacity=".07" d="${[-5, -3, -1, 1, 3].map(strip).join('')}"/>`
      + `<path d="M0 ${H}H100M50 ${H}V160" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>`
      + `<ellipse cx="50" cy="122" rx="26" ry="7" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/><path d="${k.star(50, 122, 6)}" fill="#fff" fill-opacity=".5" transform="translate(0 122) scale(1 .4) translate(0 -122)"/>`
      + k.glow({cx: 46, cy: 50, r: 30, a: .55}) + `<ellipse cx="47" cy="106" rx="9" ry="1.6" fill="#000" opacity=".25"/>`
      // the flick's path up from the thumb, the coin's spin round it
      + `<path class="pa-fine" d="M60.4 75C57 70 52 66 48 62" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-dasharray=".1 2.6"/>`
      + `<path d="M28.4 58C26 48 31 38.6 40 35.4M64 42.4C67 51 63 60.4 54.6 64" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>`
      // the coin, tipped: its edge milled, its face silver with a rim and an embossed star, a gleam
      + `<radialGradient id="${u}cn" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#C9D2DA"/><stop offset="1" stop-color="#7E8A95"/></radialGradient>`
      + `<g transform="translate(46 50) rotate(-22) scale(1 .62)"><circle cy="5.4" r="14" fill="#6E7A86" stroke="${INK}" stroke-width="1.8"/><path d="M-14 0H14V5.4H-14Z" fill="#6E7A86"/>`
      + `<path class="pa-fine" d="${Array.from({length: 9}, (_, i) => `M${f(-12 + i * 3)} ${f(Math.sqrt(196 - (-12 + i * 3) ** 2) + .6)}v4`).join('')}" stroke="#C9D2DA" stroke-width=".8"/>`
      + `<circle r="14" fill="url(#${u}cn)" stroke="${INK}" stroke-width="1.8"/><circle r="11.2" fill="none" stroke="#7E8A95" stroke-width="1.2"/>`
      + `<path d="${k.star(0, .6, 7.6)}" fill="#E3E8ED" stroke="#7E8A95" stroke-width="1"/><path d="M-9.6-6.4C-6.4-10.4-1-11.4 3-10.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></g>`
      + `<path class="pa-twinkle" fill="#fff" d="${k.star(36, 40, 3.4, 4, .22)}"/><path class="pa-twinkle" style="--d:1.3s" fill="#fff" d="${k.star(59, 57, 2.6, 4, .22)}"/>`
      // the referee's arm in from the corner: the striped sleeve, its black cuff, the fist and the flicking thumb
      + `<path d="M76.2 95.8L104.2 123.8L95.8 132.2L67.8 104.2Z" fill="#F4F6F5"/><path d="M74.6 97.6L102.6 125.6M70.4 101.6L98.4 129.6" stroke="#1C2420" stroke-width="2.6"/>`
      + `<path d="M76.2 95.8L104.2 123.8L95.8 132.2L67.8 104.2Z" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M77 96.6L68.6 105" stroke="#1C2420" stroke-width="3.4"/>`
      + `<path d="M61.4 75.6C63.2 74.6 65 76.2 64.8 78.2L64.6 84.6L59.6 86.2C59.4 82.6 59.4 79 60 77Z" fill="#E8B086" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`
      + `<path d="M62 99.4C57.4 96.6 57.2 89.6 60.8 86.2L67.6 84C71.8 83.8 74.2 87.8 72.4 91.8L68.4 97.8C66.6 100.2 64.2 100.6 62 99.4Z" fill="#E8B086"/>`
      + `<path d="M72.4 91.8L68.4 97.8C66.6 100.2 64.2 100.6 62 99.4C66 98 69 95 70.6 90.8Z" fill="#C98A62"/>`
      + `<path d="M62 99.4C57.4 96.6 57.2 89.6 60.8 86.2L67.6 84C71.8 83.8 74.2 87.8 72.4 91.8L68.4 97.8C66.6 100.2 64.2 100.6 62 99.4ZM61.4 90.6L67 87.6M60.6 94.6L66.4 91.6" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>`;
  }}
];
