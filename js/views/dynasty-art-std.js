// The Standard Pack's art designs: the plainest of the three foil packs (views/dynasty-art-foil.js has the frame's story
// and the helpers; views/dynasty-packs.js frames them). The owner, Oct 31 2026: "Make 3 standard packs, the ones that
// cost more will have a brighter, more detailed design." Tier 1 (at most 30 elements): one swirl of a single colour on
// a dark ground, the cover's football in its glow, a few glints; nothing moves. After the first of his mock-ups: four
// colourways of the same swirl.
import {ground, halo, vortex, ball, sparks, shade} from './dynasty-art-foil.js';

// (a design: ground [middle, mid, edge], swirl [glow, band, core], the glow behind the ball, the swirl's turn)
const swirl = ({g, v, h, a0 = 0, dir = 1, tilt = -18, br = -14}) => u => ground(u, g) + shade(u, '#000', .45, 44)
  + vortex({arms: 3, r0: 7, r1: 42, turns: .85, a0, dir, tilt, cols: v})
  + halo(u, 'h', {cy: 77, rx: 30, ry: 22, c: h, a: .75}) + ball(43, 77, 50, br)
  + sparks([[14, 60, 3.2], [73, 95, 2.6], [70, 52, 1.8]]);

export default [
  {id: 'std-blue', name: 'Blue Vortex: the football in a swirl of blue light', svg: swirl({g: ['#2F7BE8', '#0C2A6E', '#030B22'], v: ['#2F8BFF', '#5CC8FF', '#E8FAFF'], h: '#7FD4FF'})},
  {id: 'std-emerald', name: 'Emerald Vortex: the football in a swirl of green light', svg: swirl({g: ['#2FC468', '#0B4A2A', '#021208'], v: ['#1FE07A', '#7CFFB0', '#F0FFF4'], h: '#8CFFB8', a0: 1.2, dir: -1, tilt: 14, br: 12})},
  {id: 'std-violet', name: 'Violet Vortex: the football in a swirl of violet light', svg: swirl({g: ['#9257F5', '#33106E', '#0B0322'], v: ['#A64DFF', '#E07CFF', '#FFF0FF'], h: '#D9A0FF', a0: 2.4})},
  {id: 'std-ember', name: 'Ember Vortex: the football in a swirl of orange light', svg: swirl({g: ['#F08A3A', '#5A2A08', '#140702'], v: ['#FF7A1A', '#FFC04A', '#FFF6DC'], h: '#FFC27A', a0: .6, dir: -1, tilt: 10, br: 10})}
];
