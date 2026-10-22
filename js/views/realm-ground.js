// Baked once per scenery: broad soil/moss patches, individual tufts, gravel and
// material-specific surface marks. No per-frame generation or additional draw calls.
const SURFACES = {
  coast: {base: '#858c43', dark: '#59632f', light: '#b1ae63', soil: '#a49664', stone: '#b0a58b', grass: true},
  ocean: {base: '#8b9855', dark: '#5d713a', light: '#bdbe79', soil: '#b8ab7a', stone: '#c1b79a', grass: true},
  forest: {base: '#536940', dark: '#31482c', light: '#82915a', soil: '#80724e', stone: '#8c9381', grass: true},
  tundra: {base: '#c9d6e0', dark: '#95aabd', light: '#f0f3ef', soil: '#a8bac7', stone: '#8297a6', snow: true},
  christmas: {base: '#c5d1e5', dark: '#93a7c8', light: '#f1f2fa', soil: '#b3c1d7', stone: '#8e9bb7', snow: true},
  desert: {base: '#d9a66b', dark: '#ac784a', light: '#efd09a', soil: '#c49160', stone: '#bd9b77', sand: true},
  infernal: {base: '#59483e', dark: '#302a29', light: '#85705a', soil: '#6e5545', stone: '#7b7166', ash: true}
};

/** Natural ground at village scale, fading into the original painting at the plot edge. */
export function villageGroundTexture(T, tiles, theme, background) {
  const palette = SURFACES[theme] || SURFACES.coast;
  const size = 2048, cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  let seed = 131 + Object.keys(SURFACES).indexOf(theme) * 977;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rgb = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16));
  const mix = (a, b, weight) => a.map((v, i) => Math.round(v * (1 - weight) + b[i] * weight));
  const hex = values => '#' + values.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const bg = rgb(background), base = mix(bg, rgb(palette.base), .24);
  // Match the actual world painting, especially the forest's sunlit clearing.
  // Relative highlights/shadows keep detail readable without a dark square lawn.
  const surface = {...palette,
    dark: hex(mix(base.map(v => v * .66), rgb(palette.dark), .2)),
    light: hex(mix(base.map(v => v + (255 - v) * .28), rgb(palette.light), .2)),
    soil: hex(mix(base, rgb(palette.soil), .58)),
    stone: hex(mix(base, rgb(palette.stone), .65))};
  const ink = (hex, alpha) => 'rgba(' + rgb(hex).join(',') + ',' + alpha + ')';
  g.fillStyle = 'rgb(' + base.join(',') + ')'; g.fillRect(0, 0, size, size);
  const patch = (x, y, radius, color, alpha) => {
    const fade = g.createRadialGradient(x, y, radius * .12, x, y, radius);
    fade.addColorStop(0, ink(color, alpha)); fade.addColorStop(1, ink(color, 0));
    g.fillStyle = fade; g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  // Several scales break up the lawn without a repeating tile or a checkerboard.
  for (let i = 0; i < 460; i++) {
    const radius = i < 90 ? 100 + random() * 230 : 12 + random() * 65;
    patch(random() * size, random() * size, radius, i % 3 ? surface.dark : surface.light, i < 90 ? .24 : .16);
  }
  const bare = Array.from({length: surface.grass ? 95 : 45}, () => ({x: random() * size, y: random() * size, r: 16 + random() * 62}));
  bare.forEach(p => {
    patch(p.x, p.y, p.r, surface.soil, .48);
    for (let j = 0; j < 9; j++) patch(p.x + (random() - .5) * p.r, p.y + (random() - .5) * p.r, p.r * (.12 + random() * .3), surface.soil, .2);
  });
  // Fine mineral grain remains visible between the larger marks when zoomed in.
  const grain = document.createElement('canvas'); grain.width = grain.height = 128;
  const grainContext = grain.getContext('2d'), pixels = grainContext.createImageData(128, 128);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = random() < .5 ? 0 : 255;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    pixels.data[i + 3] = Math.round(random() * (surface.snow ? 12 : 22));
  }
  grainContext.putImageData(pixels, 0, 0);
  g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  if (surface.grass) {
    // Short, varied clusters, with a shaded root and a sunlit edge, lie on the
    // ground plane. Density varies across the plot instead of reading as static.
    const roots = new Path2D(), tips = new Path2D();
    for (let i = 0; i < 35000; i++) {
      const x = random() * size, y = random() * size;
      const density = .64 + Math.sin(x / 91 + Math.sin(y / 137)) * .18 + Math.sin(y / 53 + x / 177) * .16;
      if (random() > density || bare.some(p => (x - p.x) ** 2 + (y - p.y) ** 2 < p.r * p.r * .28)) continue;
      const height = 2.8 + random() * 5.5, lean = (random() - .5) * 5, blades = 2 + Math.floor(random() * 3);

      for (let j = 0; j < blades; j++) {
        roots.moveTo(x, y); roots.quadraticCurveTo(x + lean, y - height * .4, x + lean + (j - blades / 2) * 2.1, y - height * (.65 + random() * .5));
      }
      tips.moveTo(x + .8, y - .7); tips.lineTo(x + lean + .8, y - height);
    }
    // Batch the short strokes; thousands of separate canvas draws stall mobile GPUs.
    g.strokeStyle = ink(surface.dark, .48); g.lineWidth = 1.3; g.stroke(roots);
    g.strokeStyle = ink(surface.light, .58); g.lineWidth = .85; g.stroke(tips);
  } else if (surface.sand || surface.snow) {
    // Wind-shaped ridges, broken into short irregular runs rather than stripes.
    for (let i = 0; i < (surface.sand ? 3400 : 1400); i++) {
      const x = random() * size, y = random() * size, length = 9 + random() * 45, wave = 2 + random() * 7;
      g.lineWidth = 1 + random() * 1.5;
      for (const [offset, color, alpha] of [[1.8, surface.dark, .19], [0, surface.light, .36]]) {
        g.strokeStyle = ink(color, alpha); g.beginPath(); g.moveTo(x, y + offset);
        g.bezierCurveTo(x + length * .3, y - wave + offset, x + length * .7, y + wave + offset, x + length, y + offset); g.stroke();
      }
    }
  } else if (surface.ash) {
    // Small weathered fractures; bright lava remains part of the surrounding art.
    for (let i = 0; i < 650; i++) {
      let x = random() * size, y = random() * size, angle = random() * Math.PI * 2;
      g.strokeStyle = ink(surface.dark, .55); g.lineWidth = 1.2 + random() * 1.8; g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 3 + i % 5; j++) { angle += (random() - .5) * 1.6; x += Math.cos(angle) * (3 + random() * 12); y += Math.sin(angle) * (3 + random() * 12); g.lineTo(x, y); }
      g.stroke();
    }
  }
  // Gravel clusters, with tiny contact shadows and chipped, lit upper faces.
  for (let i = 0; i < 2400; i++) {
    const center = bare[i % bare.length], x = center.x + (random() - .5) * center.r * 3, y = center.y + (random() - .5) * center.r * 3;
    const r = .65 + random() ** 3 * 3.2;
    g.fillStyle = ink(surface.dark, .32); g.beginPath(); g.ellipse(x + .7, y + 1, r * 1.3, r * .8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink(surface.stone, .65); g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r * .4, y - r * .65); g.lineTo(x + r * .6, y - r * .5); g.lineTo(x + r, y + r * .35); g.lineTo(x, y + r * .6); g.closePath(); g.fill();
    g.strokeStyle = ink(surface.light, .55); g.lineWidth = .8; g.beginPath(); g.moveTo(x - r * .7, y - r * .2); g.lineTo(x, y - r * .5); g.lineTo(x + r * .6, y - r * .3); g.stroke();
  }
  // Composite the six-tile feather without reading the full GPU canvas back to JS.
  const edge = size / tiles * 6;
  g.globalCompositeOperation = 'destination-in';
  for (const [x0, y0, x1, y1] of [[0, 0, edge, 0], [size, 0, size - edge, 0], [0, 0, 0, edge], [0, size, 0, size - edge]]) {
    const fade = g.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i <= 8; i++) { const f = i / 8; fade.addColorStop(f, 'rgba(0,0,0,' + f * f * (3 - 2 * f) + ')'); }
    g.fillStyle = fade; g.fillRect(0, 0, size, size);
  }
  g.globalCompositeOperation = 'source-over';
  const texture = new T.CanvasTexture(cv);
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
