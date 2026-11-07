// Dense, themed roadside vignettes. Recipes are shared by WebGL and canvas;
// every solid stays outside the playable corridor and joins the existing chunks.
const C = {cream: '#FFF0C8', ink: '#294653', wood: '#B97A45', gold: '#FFC947', red: '#EF6846', blue: '#4BA9CE', green: '#50A86C'};
export const CLEARANCE = 5.6;
const color = ['#EF6846', '#4BA9CE', '#FFC947', '#51B69D'];
const NEAR = {stadium: 24, tailgate: 19.5, city: 8.4, tundra: 8.6, desert: 7.55, market: 10.2, beach: 9.5, space: 8, farm: 7.35};

/** Densify all nine places without changing course generation or collision boxes. */
export function populate(list, id, z0, z1, random) {
  const original = list.slice();
  const clear = (s, x, z, radius) => original.every(o => o.s !== s || !o.x || ['fence', 'fence2', 'rope'].includes(o.k)
    || (o.k === 'facade' && x < o.x - 1.8) || Math.abs(o.x - x) > 2.2 || z < o.z0 - radius || z > Math.max(o.z0, o.z1 || o.z0) + radius);
  const put = (kind, s, x, z, extra = {}) => {
    const o = {k: 'neighborhood', kind, theme: id, s, x, z0: z, z1: z + 2.6, tone: color[Math.floor(random() * color.length)], ...extra};
    o.parts = recipe(o).sort((a, b) => b.z - a.z);
    o.z1 = Math.max(o.z1, ...o.parts.map(p => p.z + p.d));
    list.push(o);
  };
  [-1, 1].forEach(s => {
    for (let z = z0 + 5 + (s > 0 ? 4 : 0); z < z1 - 4; z += 8) {
      const x = NEAR[id];
      if (clear(s, x, z, 1.6) || ['stadium', 'tailgate', 'market', 'farm'].includes(id)) put(id, s, x, z);
    }
    // Layers of large silhouettes behind the existing buildings and foreground props.
    for (let z = z0 + 13 + (s > 0 ? 8 : 0); z < z1 - 14; z += 24) {
      if (id === 'desert') put('canyon', s, 29 + random() * 6, z);
      if (id === 'tundra') put('forest', s, 25 + random() * 8, z);
      if (id === 'beach' && s > 0) put('palm-grove', s, 22 + random() * 4, z);
      if (id === 'farm') put('orchard', s, 34 + random() * 4, z);
      if (id === 'space') put('solar', s, 29 + random() * 4, z);
    }
  });
  if (id === 'desert') original.filter(o => o.k === 'facade').forEach(o => {
    put('shop', o.s, o.x, o.z0 + .2, {name: o.name, h: o.h, end: o.z1, tone: o.col});
  });
}

function recipe(o) {
  const a = [], s = o.s, col = o.tone;
  const add = (shape, c, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => a.push({shape, c, x: s * (o.x + x), y, z: o.z0 + z, w, h, d, rx, ry, rz});
  const box = (c, x, y, z, w, h, d) => add('box', c, x, y, z, w, h, d);
  const cyl = (c, x, y, z, r, h) => add('cyl6', c, x, y, z, r, h, r);
  const ball = (c, x, y, z, r) => add('ball', c, x, y, z, r, r, r);
  const crate = (x, y, z, c = C.wood, size = .7) => {
    box(c, x, y + size / 2, z, size, size, size);
    [-.31, .31].forEach(v => box(C.cream, x + v * size, y + size / 2, z - size / 2 - .01, .07, size, .035));
    box(C.cream, x, y + size * .12, z - size / 2 - .02, size, .07, .035);
    box(C.cream, x, y + size * .88, z - size / 2 - .02, size, .07, .035);
  };
  const cooler = (x, z) => { box(col, x, .38, z, .85, .7, .62); box(C.cream, x, .76, z, .94, .12, .68); box(C.cream, x, .38, z - .33, .2, .18, .06); };
  const cactus = (x, z, h) => {
    cyl('#499B58', x, h / 2, z, .2, h); ball('#68BA65', x, h, z, .2);
    [-1, 1].forEach((d, i) => { box('#499B58', x + d * .28, h * (.5 + i * .18), z, .55, .24, .24); cyl('#68BA65', x + d * .52, h * (.64 + i * .18), z, .13, h * .3); });
    ball('#F9AF67', x, h + .1, z, .11);
  };
  const tree = (x, z, h, snow = false) => {
    cyl(C.wood, x, .65, z, .15, 1.3);
    [0, 1, 2].forEach(i => { const y = h * (.35 + i * .23), w = h * (.32 - i * .065); add('cone4', i % 2 ? '#4BA881' : '#2C806B', x, y, z, w, h * .54, w); if (snow) add('cone4', '#F3FFFB', x, y + h * .12, z, w * .77, h * .35, w * .77); });
  };
  if (o.kind === 'stadium') {
    box(C.blue, 0, .7, 0, 2.8, .2, .7); box(C.cream, .4, 1.2, .29, 2, .55, .1);
    [-1, 1].forEach(x => box(C.ink, x, .3, 0, .15, .6, .55));
    cooler(0, 1.5); crate(-.9, 0, 1.65, C.red, .6);
    cyl(C.cream, 1.5, 2.1, .6, .06, 4.2); box(col, 1.5, 3.6, .9, .07, 1.1, .6);
    [0, 1, 2].forEach(i => add('ball', '#9D522C', -1 + i * .65, .95, -.1, .24, .16, .15));
  } else if (o.kind === 'tailgate') {
    cyl(C.ink, 0, .65, 0, .07, 1.3); add('hemi', C.ink, 0, 1.12, 0, .65, .5, .65, Math.PI);
    add('hemi', col, 0, 1.43, 0, .64, .48, .64); box(C.cream, 0, 1.95, 0, .25, .09, .09);
    [-.4, .4].forEach(x => box(C.ink, x, .12, 0, .16, .2, .8));
    cooler(1.2, .2); crate(.6, 0, 1.45, C.gold, .6);
    box(C.wood, -.7, .7, 1.6, 1.1, .12, .9); [-1, -.4].forEach(x => box(C.ink, x, .34, 1.6, .08, .68, .65));
  } else if (o.kind === 'city') {
    box(C.blue, .1, .7, .2, 1.1, 1.4, .65); box(C.cream, .1, 1.55, .15, 1.25, .25, .85);
    box(C.ink, .1, 1.05, -.14, .75, .35, .035); box(C.gold, .1, .52, -.15, .6, .3, .035);
    box('#CF8966', 0, .25, 1.55, 1.1, .5, .75);
    [0, 1, 2].forEach(i => { ball('#50AD74', -.35 + i * .35, .75, 1.55, .34); ball(i % 2 ? C.gold : C.red, -.35 + i * .35, 1, 1.55, .12); });
  } else if (o.kind === 'tundra') {
    box(C.red, 0, .4, .1, 1.5, .28, .7); [-.45, .45].forEach(x => box(C.ink, x, .1, 0, .12, .12, 1.3));
    box(C.wood, .6, 1.1, 1.3, .14, 2.2, .14); box(C.blue, .6, 1.9, 1.3, 1.1, .5, .12); box(C.cream, .6, 2.2, 1.3, 1.2, .12, .2);
    [-.4, .2].forEach(x => add('cyl6', '#A96C42', x, .25, 1.8, .25, .9, .25, Math.PI / 2));
    ball('#F5FFFD', -.6, .25, -.7, .45);
  } else if (o.kind === 'desert') {
    cactus(.15, 1.3, 2.2 + (o.z0 % 3) * .35); crate(-.2, 0, -.15, '#C88E53', .7); crate(.45, 0, -.45, '#A96A3A', .5);
    cyl('#C8874F', .45, .5, .35, .36, .95); [ .2, .75 ].forEach(y => cyl(C.ink, .45, y, .35, .37, .07));
    add('rock', '#EAAA67', -.5, .18, 1.9, .3, .25, .4);
  } else if (o.kind === 'market') {
    crate(0, 0, 0, '#CB8E4F', .65); crate(0, .65, 0, '#DAA35E', .65); crate(0, 0, .95, '#C88E53', .65);
    [0, 1, 2, 3].forEach(i => ball(i % 2 ? C.red : C.gold, (i % 2 - .5) * .28, 1.35, Math.floor(i / 2) * .28 - .14, .17));
    cyl('#E9AC73', 0, .3, 1.9, .35, .6); [0, 1, 2].forEach(i => { cyl(C.green, (i - 1) * .18, .85, 1.9, .025, 1); ball(i % 2 ? '#EE81B5' : C.gold, (i - 1) * .2, 1.3, 1.9, .17); });
  } else if (o.kind === 'beach') {
    box(col, 0, .15, .1, 1.1, .16, 2); box(C.cream, 0, .42, .9, 1.12, .5, .15);
    cyl(C.wood, .8, 1.2, 1.2, .045, 2.4); add('cone', col, .8, 2.35, 1.2, 1.2, .45, 1.2); add('cone', C.cream, .8, 2.51, 1.2, .55, .22, .55);
    cyl(C.red, -.65, .2, 1.5, .24, .4); ball(C.gold, .15, .24, -1.1, .27);
  } else if (o.kind === 'space') {
    box('#D4D4EE', .1, 1.1, 0, 1, 2.2, .8); box(C.ink, .1, 1.4, -.41, .75, .8, .035);
    box('#77F4E5', .1, 1.5, -.44, .55, .09, .035); box('#77F4E5', .1, 1.25, -.44, .35, .09, .035);
    cyl('#8C79B6', .4, .5, 1.6, .4, 1); cyl('#A6FFF1', .4, .85, 1.6, .42, .15);
    add('cone4', '#ED97E5', -.6, .55, 1.6, .2, 1.1, .2); add('cone4', '#A5D8FA', -.3, .3, 1.9, .2, .6, .2);
  } else if (o.kind === 'farm') {
    crate(0, 0, 0, '#F2C35C', .65); crate(0, .65, 0, '#E2B24E', .65); crate(0, 0, 1, '#F2C35C', .65);
    [0, 1, 2].forEach(i => ball(i % 2 ? '#F5A33F' : '#E77F30', (i % 2) * .45 - .2, .22, 1.6 + i * .25, .25));
    cyl(C.green, 0, 1.2, 2.4, .035, 2.4); ball(C.gold, 0, 2.35, 2.4, .3); ball('#735235', 0, 2.35, 2.25, .17);
  } else if (o.kind === 'canyon') {
    [-1, 0, 1].forEach((v, i) => { const h = 22 + ((Math.floor(o.z0) + i * 3) % 9); add('rock', i % 2 ? '#CB654D' : '#ED8A5C', v * 4, h * .43, i * 2, 5, h * .65, 6); box('#F4AC6D', v * 4, h * .6, i * 2, 5.7, .5, 7); });
    cactus(-5, -2, 3.2);
  } else if (o.kind === 'forest') {
    [0, 1, 2, 3].forEach(i => tree((i % 2) * 3.5, i * 2, 5 + i * 1.1, true));
  } else if (o.kind === 'palm-grove') {
    [0, 1, 2].forEach(i => { const x = i * 2, z = i * 2, h = 5.8 + i * .5; cyl('#C7955B', x, h / 2, z, .22, h); [-1, 1].forEach(d => { add('rock', '#46AA6A', x + d, h, z, 2, .22, .65); add('rock', '#72C765', x, h + .15, z + d, .65, .22, 2); }); });
  } else if (o.kind === 'orchard') {
    [0, 1, 2].forEach(i => { cyl(C.wood, i * 3, 1, i * 2, .24, 2); add('rock', '#5EAE49', i * 3, 3, i * 2, 2, 2, 2); [-1, 1].forEach(v => ball(C.red, i * 3 + v, 3, i * 2 - 1.5, .2)); });
  } else if (o.kind === 'solar') {
    [0, 1, 2].forEach(i => { box('#A5A2CF', i * 3, 1.3, i * 2, .15, 2.6, .15); box('#415DA2', i * 3, 2.6, i * 2, 2.7, .15, 2); [-.8, 0, .8].forEach(x => box('#6CE8EA', i * 3 + x, 2.69, i * 2, .06, .02, 2)); });
  } else if (o.kind === 'shop') {
    // A bright false front and a camera-facing sign make each business readable.
    const h = o.h + 1.3;
    box(col, 3.1, h, 0, 6.2, 1.7, .22); box(C.gold, 3.1, h + .9, 0, 6.5, .2, .4);
    [0, 6.2].forEach(x => box(C.cream, x, h - .1, 0, .18, 2, .3));
    box('#98412E', 3.1, 2.7, -.5, 6.5, .22, 1.25);
    [ .25, 5.95 ].forEach(x => box(C.cream, x, 1.3, -.8, .16, 2.6, .16));
    crate(.8, 0, -.8); cyl(C.wood, 5.3, .5, -.8, .4, 1);
    if (o.name === 'SALOON' || o.name === 'TRADING POST') {
      add('rock', C.cream, 3.1, h + 1.5, 0, .3, .5, .15);
      [-1, 1].forEach(d => { box(C.cream, 3.1 + d * .48, h + 1.8, 0, .7, .13, .16); box(C.cream, 3.1 + d * .8, h + 2.02, 0, .12, .5, .15); });
    }
  }
  return a;
}

export function draw3(b, lit, o, g, sign) {
  for (const p of o.parts) b.add(p.shape, p.c, p.x, p.y, p.z, p.w, p.h, p.d, p.rx, p.ry, p.rz);
  if (o.kind === 'shop') {
    const m = sign(o.name, '#743E35', '#FFE39B', o.s * (o.x + 3.1), o.h + 1.3, o.z0 - .13, 5.7, 1.12, o.s);
    m.rotation.y = 0; m.updateMatrix(); g.add(m);
  }
  void lit;
}

/** Canvas uses the same recipes, simplified into shaded low-poly silhouettes. */
export function draw2(st, c, o, P) {
  const poly = (points, fill) => { c.fillStyle = fill; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill(); };
  for (const p of o.parts) {
    if (p.z <= st.camZ + 1.2) continue;
    const q = P(st, p.x, p.y, p.z), w = p.w * q.s, h = p.h * q.s;
    if (p.shape === 'box') {
      const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, y0 = p.y - p.h / 2, y1 = p.y + p.h / 2, z0 = Math.max(st.camZ + 1, p.z - p.d / 2), z1 = p.z + p.d / 2;
      poly([[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]].map(v => P(st, ...v)), C.cream);
      const x = p.x > 0 ? x0 : x1;
      poly([[x,y0,z0],[x,y0,z1],[x,y1,z1],[x,y1,z0]].map(v => P(st, ...v)), p.c);
      poly([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]].map(v => P(st, ...v)), p.c);
    } else if (p.shape.startsWith('cone')) {
      poly([{x:q.x,y:q.y-h/2},{x:q.x-w,y:q.y+h/2},{x:q.x+w,y:q.y+h/2}], p.c);
    } else if (p.shape.startsWith('cyl')) {
      c.fillStyle = p.c; c.fillRect(q.x - w, q.y - h/2, w*2, h);
      c.beginPath(); c.ellipse(q.x, q.y-h/2, w, w*.24, 0, 0, Math.PI*2); c.fill();
    } else {
      poly(Array.from({length:6}, (_,i) => ({x:q.x+Math.cos(i*Math.PI/3)*w,y:q.y+Math.sin(i*Math.PI/3)*h})), p.c);
    }
  }
  if (o.kind === 'shop' && o.z0 > st.camZ + 1.2) {
    const p = P(st, o.s * (o.x + 3.1), o.h + 1.3, o.z0 - .15);
    c.fillStyle = '#743E35'; c.fillRect(p.x-p.s*2.85,p.y-p.s*.56,p.s*5.7,p.s*1.12);
    c.fillStyle = '#FFE39B'; c.font = `900 ${Math.max(1, p.s*.7)}px sans-serif`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(o.name,p.x,p.y,p.s*5.2);
  }
}
