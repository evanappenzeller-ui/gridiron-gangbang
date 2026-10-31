// The Premium Pack's art designs: the brightest and most detailed of the three foil packs (views/dynasty-art-foil.js
// has the frame's story and the helpers; views/dynasty-packs.js frames them). The owner, Oct 31 2026: "Make 3 standard
// packs, the ones that cost more will have a brighter, more detailed design." Tier 3 (at most 90 elements): neon
// grounds, two cards stacked behind (a rainbow or gold edge each, as on the case), rays, three swirls (the outer one
// turning slowly on a big pack), a double ring of light, a starfield and twinkling glints. After his mock-ups with the
// neon frame and the gilded one.
import {ground, halo, vortex, ring, ball, sparks, dots, rays, shade} from './dynasty-art-foil.js';

// (two cards fanned behind the ball, edged in a gradient: 8 elements + stops)
const cards = (u, edge) => `<linearGradient id="${u}ce" x1="0" y1="0" x2="1" y2="1">${edge.map((c, i) => `<stop offset="${(i / (edge.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`
  + `<g fill="#000" fill-opacity=".22" stroke="url(#${u}ce)" stroke-width="1.5">`
  + '<rect x="15" y="47" width="56" height="62" rx="3.5" transform="rotate(-9 43 78)"/><rect x="15" y="47" width="56" height="62" rx="3.5" transform="rotate(8 43 78)"/></g>';

const scene = ({g, edge, v1, v2, v3, rg, rg2, h, star = '#fff', a0 = 0, dir = 1, tilt = -16, br = -16, seed = 2}) => u => ground(u, g, {cy: 64, r: 82})
  + dots(30, {seed, a: .7, r: [.2, .55], y0: 0}) + rays({cy: 77, n: 24, a: .16, w: .3, c: star})
  + cards(u, edge) + shade(u, '#000', .32, 40)
  + vortex({arms: 4, r0: 10, r1: 50, turns: 1, a0, dir, tilt, cols: v1, cls: 'pa-spin', style: '--ox:0px;--oy:0px;--t:40s'})
  + vortex({arms: 3, r0: 8, r1: 40, turns: .8, a0: a0 + 1, dir, tilt: tilt + 8, squash: .6, cols: v2, w: .85})
  + vortex({arms: 2, r0: 6, r1: 28, turns: .7, a0: a0 + 2.2, dir: -dir, tilt: tilt - 6, squash: .66, cols: v3, w: .6})
  + halo(u, 'h', {cy: 77, rx: 38, ry: 28, c: h, a: .9}) + halo(u, 'w', {cy: 76, r: 14, c: '#fff', a: .85})
  + ring({cy: 78, rx: 36, ry: 14, tilt: tilt * .6, cols: rg}) + ring({cy: 77, rx: 28, ry: 10, tilt: -tilt * .5, cols: rg2, w: .7})
  + ball(43, 77, 52, br) + ring({cy: 78, rx: 36, ry: 14, tilt: tilt * .6, cols: rg, half: true}) + ring({cy: 77, rx: 28, ry: 10, tilt: -tilt * .5, cols: rg2, w: .7, half: true})
  + halo(u, 'f', {cx: 34, cy: 70, r: 9, c: '#fff', a: .5, cls: 'pa-pulse'})
  + dots(14, {seed: seed + 1, c: star, a: .95, r: [.3, .75], y0: 48})
  // (a twinkling glint is an element of its own: it scales about its own middle)
  + [[11, 56, 4.2, 0], [76, 101, 3.6, .7], [74, 48, 2.8, 1.3], [13, 99, 2.6, 2]].map(([x, y, r, d]) => sparks([[x, y, r]], {cls: 'pa-twinkle', style: `--d:${d}s`})).join('')
  + sparks([[62, 60, 2], [24, 92, 1.8], [28, 58, 1.6]], {c: star});

export default [
  {id: 'prem-neon', name: 'Neon: the football in pink and cyan light, cards edged in rainbow behind it', svg: scene({g: ['#8A4CFF', '#2C0E80', '#0A0428'],
    edge: ['#FF4FD8', '#FFD84F', '#4FFFC8', '#4FB8FF', '#C04FFF'], v1: ['#FF3FC0', '#FF8AE0', '#FFF0FB'], v2: ['#3FD8FF', '#9BEFFF', '#FFFFFF'], v3: ['#FFE04F', '#FFF29A', '#FFFFFF'],
    rg: ['#FF4FD8', '#FFA0EC', '#FFF4FD'], rg2: ['#4FE8FF', '#B0F6FF', '#FFFFFF'], h: '#FF9AE8', seed: 4})},
  {id: 'prem-galaxy', name: 'Galaxy: the football in a nebula of violet and blue among the stars', svg: scene({g: ['#B44CFF', '#3A0E6E', '#07021A'],
    edge: ['#7A5CFF', '#FF6AD5', '#7AE0FF', '#7A5CFF'], v1: ['#7A4CFF', '#B48CFF', '#F6F0FF'], v2: ['#FF5AC8', '#FF9EE0', '#FFF2FA'], v3: ['#5AC8FF', '#A8E6FF', '#FFFFFF'],
    rg: ['#B48CFF', '#E0CCFF', '#FFFFFF'], rg2: ['#FF7AD8', '#FFC4EE', '#FFFFFF'], h: '#C9A0FF', a0: 1.4, dir: -1, tilt: 14, br: 14, seed: 6})},
  {id: 'prem-gilded', name: 'Gilded: the football in gold and silver light, cards edged in gold', logo: 'team', svg: scene({g: ['#FFE6A0', '#A86E22', '#241204'],
    edge: ['#FFF4C2', '#E9BD48', '#9A6A10', '#F6D978', '#C8961E'], v1: ['#FFC23A', '#FFE08A', '#FFFBEA'], v2: ['#E8E8F0', '#FFFFFF', '#FFFFFF'], v3: ['#FFAA2A', '#FFD27A', '#FFF6DC'],
    rg: ['#FFD25A', '#FFF0B0', '#FFFFFF'], rg2: ['#D8D8E8', '#F4F4FF', '#FFFFFF'], h: '#FFE7A0', star: '#FFF6D0', a0: .7, seed: 8})},
  {id: 'prem-prism', name: 'Prism: the football in a rainbow of light', svg: scene({g: ['#5A3CC8', '#160A4C', '#05021A'],
    edge: ['#FF5A5A', '#FFC84F', '#5AFF8A', '#4FC8FF', '#B45AFF', '#FF5AC8'], v1: ['#FF5A7A', '#FFB04F', '#FFF6E0'], v2: ['#4FFF9A', '#4FD8FF', '#F0FFFF'], v3: ['#B45AFF', '#FF7AE0', '#FFF0FF'],
    rg: ['#FFC84F', '#FFF09A', '#FFFFFF'], rg2: ['#4FD8FF', '#B0F0FF', '#FFFFFF'], h: '#B8A0FF', a0: 2.2, dir: -1, tilt: 12, br: 12, seed: 10})}
];
