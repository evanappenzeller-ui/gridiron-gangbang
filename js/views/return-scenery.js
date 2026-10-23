import * as features from '../core/features.js';
// Reference-style roadside accents for Evan's environment preview. These join
// the world's existing batches: no image requests, extra meshes or collisions.
// Positions use the world's positive-forward z convention, as Batch does.
import * as data from '../core/data.js';

const CREAM = '#FFF1D5', INK = '#243C51', CORAL = '#EF633A', TEAL = '#27B6AE';
const PAINT = [CORAL, TEAL, '#F8BC45', '#458CC9'];
const center = o => (o.z0 + o.z1) / 2;
const accent = o => PAINT[Math.abs(Math.floor(o.z0 / 9)) % PAINT.length];

/** Called after the original prop; all additions remain roadside. */
export function decorate(b, lit, o, g, api = {}) {
  if (!features.available()) return;
  const paint = DETAIL[o.k];
  if (paint) paint(b, lit, o);
  void g; void api; // compatible with the world's prop callback; no extra scene objects
}

const DETAIL = {
  // Tailgate: bold canopy edges, pennants and readable parked-car details.
  tent(b, lit, o) {
    const x = o.s * (o.x + 1.7), z = center(o), front = x - o.s * 1.72;
    b.box(CREAM, front - .05, front + .05, 2.96, 3.1, z - 1.75, z + 1.75);
    for (let i = 0; i < 6; i++) {
      const za = z - 1.7 + i * 3.4 / 6;
      b.box(i % 2 ? CREAM : o.col, front - .04, front + .04, 2.64, 2.96, za, za + 3.4 / 6);
    }
    b.cyl(CREAM, x, 3.95, 4.8, z, .035);
    b.add('cone4', '#F8BC45', x + o.s * .28, 4.58, z, .27, .65, .035, 0, 0, -o.s * Math.PI / 2);
  },
  car(b, lit, o) {
    const x = o.s * 6.48, z = center(o);
    b.box(INK, x - .025, x + .025, .36, .56, z - .38, z + .38);
    b.box(CREAM, x - .03, x + .03, .3, .35, o.z0 + .12, o.z1 - .12);
    b.box('#89CBE0', o.s * 7.74, o.s * 7.7, o.h + .08, o.h + .42, o.z0 + .2, o.z1 - .2);
  },
  // City: thick cornices, warm storefronts, rooftop silhouettes and palm blades.
  bldg(b, lit, o) {
    const x = o.s * o.x, z = center(o), len = o.z1 - o.z0, c = o.awn || accent(o);
    b.box(CREAM, x - o.s * .16, x + o.s * .12, o.h + .42, o.h + .68, o.z0 - .16, o.z1 + .16);
    [o.z0 + .12, o.z1 - .12].forEach(zz => b.box(CREAM, x - o.s * .1, x + o.s * .08, .25, o.h, zz - .1, zz + .1));
    if (!o.awn) b.add('box', c, x - o.s * .58, 2.65, z, 1.18, .16, len - .55, 0, 0, o.s * .28);
    b.box(c, x - o.s * 1.13, x - o.s * 1.04, 2.18, 2.48, o.z0 + .28, o.z1 - .28);
    b.box(CREAM, x - o.s * 1.14, x - o.s * 1.03, 2.47, 2.55, o.z0 + .28, o.z1 - .28);
    if (o.h < 18) {
      b.add('prism', CORAL, x + o.s * 3.5, o.h + .52, z, 7.4, 2.2, Math.min(9, len - .5));
      b.box('#CB7451', x + o.s * 4.5, x + o.s * 5.2, o.h + 1.6, o.h + 3.3, z + 1, z + 1.8);
      b.box(CREAM, x + o.s * 4.42, x + o.s * 5.28, o.h + 3.3, o.h + 3.5, z + .92, z + 1.88);
    } else {
      b.box(c, x + o.s * 1, x + o.s * 4, o.h + .5, o.h + 1.4, z - 1.7, z + 1.7);
      b.box(CREAM, x + o.s * .9, x + o.s * 4.1, o.h + 1.4, o.h + 1.6, z - 1.8, z + 1.8);
    }
  },
  palm(b, lit, o) {
    const x = o.s * (o.x - o.h * .1), h = o.h;
    // The new blades fan outward, preserving the existing clear run corridor.
    for (let i = 0; i < 5; i++) {
      const a = (o.s < 0 ? Math.PI : 0) + (i - 2) * Math.PI / 4;
      b.add('cone4', i % 2 ? '#3F9E36' : '#83BB37', x + Math.cos(a) * 1.05, h + .08, o.z0 + Math.sin(a) * 1.05, .12, 2.6, .72, 0, a, -Math.PI / 2);
    }
    b.add('cone4', '#73AE32', x, h + .4, o.z0, .45, 1.3, .45, 0, Math.PI / 4, 0);
  },
  lamp(b, lit, o) {
    const x = o.s * 6.1;
    b.cyl(TEAL, x, .04, .42, o.z0, .19, 'cyl6');
    b.cyl(CREAM, x, 3.1, 3.22, o.z0, .13, 'cyl6');
    b.add('cone4', '#F8BC45', x, 6.72, o.z0, .2, .32, .2, 0, Math.PI / 4, 0);
  },
  hydrant(b, lit, o) { b.add('box', '#FFD15A', o.s * o.x, .87, o.z0, .13, .1, .13); },
  // Snow: broad faceted snow caps, bright fence markings and a scarf tail.
  pine(b, lit, o) {
    const x = o.s * o.x, h = o.h, w = Math.min(h * .29, o.x - 5.8);
    b.add('cone4', '#D6F0F4', x, h * .57, o.z0, w, h * .43, w, 0, Math.PI / 4, 0);
    b.add('cone4', '#FFFFFF', x, h * .86, o.z0, w * .53, h * .35, w * .53, 0, Math.PI / 4, 0);
  },
  fence(b, lit, o) {
    const x = o.s * o.x;
    b.box('#FFAE52', x - .05, x + .05, 1.08, 1.2, o.z0, o.z1);
    for (let z = o.z0 + .8; z < o.z1; z += 5) b.box(CREAM, x - .055, x + .055, .28, .92, z, z + .28);
  },
  snowman(b, lit, o) {
    const x = o.s * o.x;
    b.add('box', CORAL, x + .18, 1.16, o.z0 - .35, .22, .55, .08, 0, 0, -.18);
    [1.12, 1.35].forEach(y => b.add('ball', INK, x, y, o.z0 - .365, .045, .045, .045));
  },
  // Desert: painted false fronts and blocky, sunlit rock and cactus accents.
  facade(b, lit, o) {
    const x = o.s * o.x, z = center(o), top = o.h + 1.6;
    b.box('#FFD391', x - o.s * .12, x + o.s * .34, top, top + .2, o.z0 + .12, o.z1 - .12);
    b.box('#D95737', x - o.s * 1.1, x - o.s * .02, 2.83, 3.03, o.z0 - .12, o.z1 + .12);
    [z - 2, z + 2].forEach(zz => {
      b.box(CREAM, x - o.s * .06, x, 1.1, 2.25, zz - .6, zz + .6);
      b.box('#559BA9', x - o.s * .085, x - o.s * .065, 1.2, 2.15, zz - .5, zz + .5);
    });
  },
  cactus(b, lit, o) {
    const x = o.s * o.x, h = o.h;
    b.add('box', '#88B951', x, h * .52, o.z0 - h * .09 - .008, h * .045, h * .83, .025);
    if (o.flip) b.add('cone4', '#F59458', x, h + .14, o.z0, .19, .3, .19, 0, Math.PI / 4, 0);
  },
  rock(b, lit, o) {
    b.add('rock', '#F2B366', o.s * (o.x + o.h * .65), o.h * .2, o.z0 + .3, o.h * .5, o.h * .32, o.h * .45, .1, .6, .1);
  },
  tower(b, lit, o) {
    const x = o.s * o.x;
    [8.3, 10.7].forEach(y => b.add('tor', '#E2B46E', x, y, o.z0, 1.82, 1.82, .45, Math.PI / 2, 0, 0));
  },
  // Market: scalloped valances, tiled roof ridges and warm lantern caps.
  stall(b, lit, o) {
    const x = o.s * (o.x - .42), len = o.z1 - o.z0;
    for (let i = 0; i < 6; i++) {
      const z = o.z0 + (i + .5) * len / 6;
      b.add('box', o.awn[i % 2], x, 2.53, z, .1, .34, len / 6);
      b.add('cone4', o.awn[i % 2], x, 2.31, z, .055, .2, len / 6 * .5, Math.PI, 0, 0);
    }
    b.box(CREAM, x - .055, x + .055, 2.69, 2.77, o.z0, o.z1);
  },
  house(b, lit, o) {
    const x = o.s * o.x, z = center(o);
    b.box(CREAM, x - o.s * .11, x + o.s * .08, o.h - .12, o.h + .12, o.z0 - .16, o.z1 + .16);
    b.box('#E88654', x + o.s * 3.88, x + o.s * 4.12, o.h + 2.5, o.h + 2.75, o.z0 - .25, o.z1 + .25);
    b.box(o.shut, x - o.s * .36, x - o.s * .1, 1.19, 1.46, z - .65, z + .65);
    for (let i = 0; i < 3; i++) b.add('rock', i % 2 ? '#F6BD44' : '#EC7961', x - o.s * .26, 1.58, z + (i - 1) * .4, .18, .19, .18);
  },
  lamp2(b, lit, o) {
    const x = o.s * o.x;
    b.add('cone4', TEAL, x, 3.88, o.z0, .34, .36, .34, 0, Math.PI / 4, 0);
    b.add('cone4', INK, x, 3.2, o.z0, .25, .2, .25, Math.PI, Math.PI / 4, 0);
  },
  // Beach: pastel hut trim, parasol caps and a visible lifeguard platform.
  hut(b, lit, o) {
    const x = o.s * o.x, front = x - o.s * 1.24;
    b.box(CREAM, front - .04, front + .04, 2.2, 2.36, o.z0 - 1.3, o.z0 + 1.3);
    [o.z0 - .48, o.z0 + .48].forEach(z => b.box(CREAM, front - .045, front + .045, .15, 2, z - .07, z + .07));
    b.box(CREAM, x - o.s * 1.7, x - o.s * 1.2, .02, .18, o.z0 - .65, o.z0 + .65);
    b.box(CORAL, x - .09, x + .09, 3.05, 3.18, o.z0 - 1.45, o.z0 + 1.45);
  },
  umbrella(b, lit, o) {
    const x = o.s * o.x;
    b.add('cone', CREAM, x, 2.57, o.z0, .62, .24, .62);
    b.add('ball', o.col, x, 2.74, o.z0, .09, .09, .09);
  },
  surf(b, lit, o) {
    b.add('box', CREAM, o.s * o.x, 1.05, o.z0 - .072, .075, 1.38, .018, 0, 0, o.s * .12);
  },
  lifeguard(b, lit, o) {
    const x = o.s * o.x, z = o.z0;
    b.box(CREAM, x - 1.45, x + 1.45, 2.45, 2.62, z - 1.4, z + 1.4);
    b.box('#F16C44', x - .12, x + .12, 3, 3.75, z - 1.14, z - 1.12);
    [x - .5, x + .5].forEach(xx => b.box(CREAM, xx - .045, xx + .045, 0, 2.5, z - 1.5, z - 1.4));
    for (let y = .35; y < 2.5; y += .5) b.box(CREAM, x - .5, x + .5, y, y + .08, z - 1.5, z - 1.4);
  },
  // Space: clean cyan accents and small solar wings, kept outboard of the road.
  dome(b, lit, o) {
    const x = o.s * o.x, wing = x + o.s * (o.w + 1.05);
    b.add('cone4', '#8E8CDB', x, o.w * .55 + .16, o.z0, .62, .34, .62, 0, Math.PI / 4, 0);
    b.cyl('#8C94BA', wing, 0, 1.25, o.z0, .1, 'cyl6');
    b.add('box', '#3766A1', wing, 1.3, o.z0, 1.9, .12, 2.1, 0, 0, o.s * .16);
    lit.add('box', '#7DE9ED', wing, 1.38, o.z0, 1.8, .035, .075, 0, 0, o.s * .16);
  },
  rocket(b, lit, o) {
    const x = o.s * o.x;
    [3.4, 10.9].forEach(y => b.cyl(CORAL, x, y, y + .24, o.z0, 1.025));
    b.add('tor', CREAM, x, 8.9, o.z0 - .97, .47, .47, .42);
    lit.add('cyl', '#7CE7EE', x, 8.9, o.z0 - 1, .36, .07, .36, Math.PI / 2, 0, 0);
  },
  spire(b, lit, o) {
    const x = o.s * o.x;
    b.add('cone4', '#D4A2E7', x + o.s * .55, o.h * .25, o.z0 + .2, .35, o.h * .5, .35, 0, Math.PI / 4, -.18 * o.s);
  },
  beacon(b, lit, o) {
    b.add('cone4', '#CAD9F2', o.s * o.x, 1.49, o.z0, .26, .22, .26, 0, Math.PI / 4, 0);
  },
  // Farm: cream barn framing, a loft window, neat fence caps and yellow details.
  barn(b, lit, o) {
    const x = o.s * o.x, z = center(o);
    [o.z0 + .05, o.z1 - .05].forEach(zz => b.box(CREAM, x - o.s * .09, x + o.s * .04, .05, o.h, zz - .1, zz + .1));
    b.box(CREAM, x - o.s * .14, x + o.s * .06, o.h - .08, o.h + .12, o.z0 - .1, o.z1 + .1);
    b.box(CREAM, x - o.s * .075, x - o.s * .02, 3.7, 4.42, z - .5, z + .5);
    b.box('#5E9BAA', x - o.s * .09, x - o.s * .08, 3.8, 4.32, z - .4, z + .4);
  },
  silo(b, lit, o) {
    const x = o.s * (o.x - 1.64);
    [o.z0 - .3, o.z0 + .3].forEach(z => b.box(CREAM, x - .035, x + .035, .6, 8.4, z - .03, z + .03));
    for (let y = 1; y < 8.4; y += 1.1) b.box(CREAM, x - .04, x + .04, y, y + .07, o.z0 - .3, o.z0 + .3);
  },
  tractor(b, lit, o) {
    const x = o.s * o.x;
    b.box('#F4CB4B', x - .55, x + .55, 1.6, 1.68, o.z0 - 1.5, o.z0 - .35);
    b.box('#45A66C', x - .9, x + .9, 2.89, 3.04, o.z0 - .35, o.z0 + 1.15);
    b.cyl(INK, x + o.s * .48, 1.65, 2.6, o.z0 - .9, .07, 'cyl6');
  },
  fence2(b, lit, o) {
    const x = o.s * o.x;
    for (let z = o.z0; z <= o.z1; z += 4.8) b.add('cone4', CREAM, x, 1.36, z, .13, .24, .13, 0, Math.PI / 4, 0);
  },
  sunflower(b, lit, o) {
    const x = o.s * o.x;
    b.add('cone4', '#80B83D', x + o.s * .18, o.h * .58, o.z0, .06, .56, .19, 0, 0, -o.s * .95);
  }
};
