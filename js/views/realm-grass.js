// A small, resolution-independent grass wallpaper over the painted clearing.
// One transparent draw call, no video download, and no per-frame canvas uploads.
import * as data from '../core/data.js';

export function createGrassWallpaper(T, parent, ground, options = {}) {
  const counts = {drawCalls: 0, active: false, disposed: false};
  const empty = {counts, update: () => false, dispose() {}};
  if (!data.isOwner() || !['coast', 'forest', 'ocean'].includes(options.theme) || !ground?.lot) return empty;
  const {lot} = ground;
  // The coast's lawn is wider than the square build plot. Stay inside its walls.
  const region = options.theme === 'coast'
    ? {x: lot.cx - 4, y: lot.cy, rx: 150, ry: 60}
    : {x: lot.cx, y: lot.cy, rx: lot.h / (2 * Math.sin(.9)) * .95, ry: lot.h * .46};
  const positions = [], uvs = [];
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const point = ground.under(region.x + (u * 2 - 1) * region.rx, region.y + (1 - v * 2) * region.ry);
    positions.push(point.x, .009, point.z); uvs.push(u, v);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]); geometry.computeBoundingSphere();
  const uniforms = {grassTime: {value: 0}, grassColor: {value: new T.Color(options.color || '#606625')}};
  const material = new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide,
    vertexShader: `varying vec2 grassUv;
      void main() { grassUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float grassTime;
      uniform vec3 grassColor;
      varying vec2 grassUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      // Rooted blades bend at their tips. Neighboring tufts respond to the same
      // traveling gust, while the underlying soil stays fixed in place.
      vec2 tuft(vec2 p, float wind) {
        vec2 cell = floor(p), q = fract(p) - .5;
        float seed = hash(cell), h = .45 + seed * .45; q.x += (seed - .5) * .2; q.y += (hash(cell + 3.7) - .5) * .1;
        float t = (q.y + .45) / h;
        float alive = step(0.0, t) * (1.0 - step(1.0, t));
        float aa = max(.008, fwidth(p.x) * .7);
        float blade = 0.0, light = 0.0;
        for (int i = 0; i < 3; i++) {
          float side = float(i) - 1.0;
          float lean = side * .22 + (seed - .5) * .28 + wind * (.18 + seed * .14);
          float center = side * .055 + lean * t * t;
          float width = (.055 + seed * .025) * (1.0 - t) + .006;
          float shape = (1.0 - smoothstep(width - aa, width + aa, abs(q.x - center))) * alive;
          blade = max(blade, shape); light = max(light, shape * (.35 + .65 * t));
        }
        return vec2(blade, light);
      }
      void main() {
        vec2 uv = grassUv, d = abs(uv - .5) * 2.0;
        float boundary = d.x + d.y;
        float feather = 1.0 - smoothstep(.36, .98, boundary);
        if (feather < .001) discard;
        float broad = noise(uv * vec2(27.0, 17.0));
        float fine = noise(uv * vec2(170.0, 110.0));
        float gust = sin(uv.x * 19.0 + uv.y * 13.0 - grassTime * 1.65
          + sin(uv.y * 9.0 + grassTime * .4)) * .7;
        float flutter = sin(uv.x * 51.0 - uv.y * 37.0 - grassTime * 3.0) * .14;
        vec2 a = tuft(uv * vec2(110.0, 70.0), gust + flutter);
        vec2 b = tuft(uv * vec2(67.0, 43.0) + vec2(17.37, 9.19), gust * .8);
        float coverage = max(a.x, b.x * .8), tips = max(a.y, b.y * .8);
        // Analytical detail stays sharp at village zoom; wind bands remain
        // readable at the photographed middle zoom without a low-res upsample.
        vec3 soil = grassColor * (.72 + broad * .16 + fine * .16);
        vec3 leaf = grassColor * (.62 + tips * 1.3) * vec3(.95, 1.08, .90);
        vec3 color = mix(soil, leaf, coverage * .94);
        color *= 1.0 + gust * .075 * (.35 + broad * .65);
        gl_FragColor = vec4(color, feather * .94);
        #include <colorspace_fragment>
      }`
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = 'realm-wind-grass'; mesh.renderOrder = -2001.5;
  mesh.raycast = () => {}; parent.add(mesh); counts.drawCalls = 1;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const frustum = new T.Frustum(), matrix = new T.Matrix4();
  let dead = false, stop = null, lastSeconds = null, elapsed = 0;
  function update(seconds, {active = true, camera} = {}) {
    if (dead) return false;
    if (!data.isOwner()) { dispose(); return false; }
    let inView = true;
    if (camera) { matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(matrix); inView = frustum.intersectsObject(mesh); }
    counts.active = active && inView && !document.hidden && !media.matches;
    if (counts.active && lastSeconds !== null) elapsed += Math.min(.1, Math.max(0, seconds - lastSeconds));
    lastSeconds = counts.active ? seconds : null;
    uniforms.grassTime.value = media.matches ? 0 : elapsed;
    return counts.active;
  }
  function changed() { lastSeconds = null; if (!dead && options.onChange) options.onChange(); }
  function dispose() {
    if (dead) return;
    dead = true; counts.active = false; counts.disposed = true;
    if (stop) stop();
    media.removeEventListener('change', changed); document.removeEventListener('visibilitychange', changed);
    parent.remove(mesh); geometry.dispose(); material.dispose();
  }
  media.addEventListener('change', changed); document.addEventListener('visibilitychange', changed);
  stop = data.subscribe(type => { if (type === 'me' && !data.isOwner()) { dispose(); if (options.onChange) options.onChange(); } });
  return {counts, region, mesh, update, dispose};
}
