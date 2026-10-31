// The Team Pack's art designs: the middle of the three foil packs (views/dynasty-art-foil.js has the frame's story and
// the helpers; views/dynasty-packs.js frames them). The owner, Oct 31 2026: "Make 3 standard packs, the ones that cost
// more will have a brighter, more detailed design." Tier 2 (at most 55 elements): brighter grounds than the Standard
// Pack's, light rays, two swirls turning together, a ring of light round the football (behind it and across its front),
// glints and specks. After his mock-up of the foil pack with the ring round the ball, and the case's cover.
import {ground, halo, vortex, ring, ball, sparks, dots, rays, shade} from './dynasty-art-foil.js';

const scene = ({g, v1, v2, rg, h, a0 = 0, dir = 1, tilt = -16, br = -16, seed = 1}) => u => ground(u, g, {cy: 66}) + rays({cy: 77, a: .12})
  + shade(u, '#000', .35, 42)
  + vortex({arms: 3, r0: 8, r1: 46, turns: .9, a0, dir, tilt, cols: v1})
  + vortex({arms: 2, r0: 12, r1: 38, turns: .7, a0: a0 + 1.6, dir, tilt: tilt + 6, squash: .62, cols: v2, w: .8, op: .9})
  + halo(u, 'h', {cy: 77, rx: 34, ry: 25, c: h, a: .85}) + halo(u, 'w', {cy: 77, r: 12, c: '#fff', a: .7})
  + ring({cy: 78, rx: 33, ry: 13, tilt: tilt * .6, cols: rg}) + ball(43, 77, 50, br) + ring({cy: 78, rx: 33, ry: 13, tilt: tilt * .6, cols: rg, half: true})
  + dots(16, {seed, a: .75, y0: 46}) + sparks([[12, 58, 3.6], [75, 99, 3], [72, 50, 2.2], [17, 101, 2]]);

export default [
  {id: 'team-ring', name: 'Green Ring: the football in a ring of green light on royal blue', svg: scene({g: ['#6C86FF', '#2530B4', '#0A0B44'], v1: ['#4F7BFF', '#7FB4FF', '#F0F6FF'], v2: ['#2BE88E', '#8BFFB0', '#F4FFE8'], rg: ['#2BE88E', '#9BFF8A', '#F4FFE0'], h: '#7CFFB0', seed: 3})},
  {id: 'team-sky', name: 'Skyline: the football in white and cyan light, as on the case', svg: scene({g: ['#7FE0FF', '#1F62E4', '#08206E'], v1: ['#36C8FF', '#9BE8FF', '#FFFFFF'], v2: ['#FFFFFF', '#CFF4FF', '#FFFFFF'], rg: ['#7FE8FF', '#E0FAFF', '#FFFFFF'], h: '#BFF2FF', a0: 1, dir: -1, tilt: 12, br: 12, seed: 5})},
  {id: 'team-sunset', name: 'Sunset: the football in orange and pink light', svg: scene({g: ['#FF9A5A', '#B5246C', '#3C0A2C'], v1: ['#FF6A3A', '#FFB84A', '#FFF4D8'], v2: ['#FF4FA8', '#FF9AD0', '#FFF0F8'], rg: ['#FFC24A', '#FFE48A', '#FFFBEA'], h: '#FFC890', a0: 2, seed: 7})},
  {id: 'team-aurora', name: 'Aurora: the football in teal and violet light', svg: scene({g: ['#45E6CC', '#1A4E9E', '#0A0F3C'], v1: ['#22D8C8', '#80FFE8', '#F0FFFC'], v2: ['#9A5CFF', '#CFA0FF', '#F8F0FF'], rg: ['#80FFE8', '#D8FFF8', '#FFFFFF'], h: '#90FFE8', a0: .4, dir: -1, tilt: 14, br: 14, seed: 9})}
];
