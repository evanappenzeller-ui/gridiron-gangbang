// Motion inside the existing landscape painting: flowing water and the flicker
// of its own lights. The map keeps one texture and one draw call. Region masks,
// source-color masks and the protected village square leave buildings still.
import * as data from '../core/data.js';

const water = (x, y, rx, ry, kind = 'water') => ({x, y, rx, ry, kind});
const light = (x, y, rx = .012, ry = .009, hue = 'warm') => ({x, y, rx, ry, hue});

// Coordinates are normalized, with the image origin at the top left. These are
// authored against coast/world-v3.webp and the other six world-v2 paintings.
// Water regions are deliberately small and restricted to visible liquid. A
// second color mask excludes roofs, banks, snow, ice floes and passing boats.
export const AMBIENCE_REGIONS = {
  coast: {
    water: [water(.727, .879, .035, .013), water(.893, .898, .010, .012, 'fall'),
      water(.847, .911, .105, .023)],
    lights: [light(.438, .120, .013, .012), light(.485, .120, .013, .012),
      light(.102, .357), light(.126, .446), light(.646, .741, .015, .014)]
  },
  christmas: {
    water: [water(.467, .275, .015, .026, 'fall'), water(.705, .312, .019, .025, 'fall'),
      water(.447, .657, .016, .028, 'fall'), water(.734, .752, .019, .029, 'fall'),
      water(.426, .890, .167, .050), water(.520, .964, .119, .031)],
    lights: [light(.792, .044, .026, .018), light(.788, .108, .056, .034),
      light(.787, .163, .088, .035), light(.782, .211, .125, .027),
      light(.297, .230, .021, .020), light(.259, .391, .036, .019),
      light(.805, .511, .026, .022), light(.246, .585, .030, .022),
      light(.285, .809, .034, .026), light(.837, .847, .023, .023)]
  },
  forest: {
    water: [water(.449, .217, .018, .026, 'fall'), water(.562, .329, .025, .037, 'fall'),
      water(.548, .630, .027, .039, 'fall'), water(.645, .782, .159, .039),
      water(.486, .918, .174, .045)],
    lights: [light(.438, .172, .022, .020, 'violet'), light(.374, .270, .017, .019, 'violet'),
      light(.923, .298, .016, .020, 'violet'), light(.754, .480, .026, .016),
      light(.228, .596, .029, .019), light(.940, .578, .021, .021)]
  },
  tundra: {
    // The ice cliffs stay rigid; only open harbor channels move.
    water: [water(.267, .711, .138, .027), water(.303, .819, .095, .035),
      water(.188, .911, .146, .040), water(.419, .979, .127, .022)],
    lights: [light(.351, .184, .019, .026), light(.182, .352, .020, .018),
      light(.625, .380, .016, .014), light(.590, .662, .015, .015),
      light(.252, .864, .015, .015), light(.802, .591, .020, .018)]
  },
  ocean: {
    water: [water(.507, .220, .020, .035, 'fall'), water(.579, .326, .022, .037, 'fall'),
      water(.438, .653, .026, .033, 'fall'), water(.653, .762, .148, .044),
      water(.205, .868, .180, .043), water(.723, .964, .131, .033)],
    lights: [light(.491, .159, .023, .024), light(.434, .130, .014, .011),
      light(.725, .560, .020, .018), light(.329, .691, .024, .018),
      light(.863, .848, .023, .017)]
  },
  desert: {
    water: [water(.417, .263, .016, .023, 'fall'), water(.823, .617, .020, .031, 'fall'),
      water(.871, .728, .022, .028, 'fall'), water(.151, .746, .018, .028, 'fall'),
      water(.733, .868, .120, .051), water(.697, .937, .153, .034)],
    lights: [light(.266, .142, .014, .019), light(.865, .162, .015, .024),
      light(.616, .316, .014, .022), light(.645, .589, .014, .021),
      light(.313, .779, .016, .018), light(.813, .805, .017, .017)]
  },
  infernal: {
    water: [water(.172, .236, .133, .027, 'lava'), water(.505, .419, .034, .036, 'lava'),
      water(.893, .593, .025, .048, 'lava'), water(.603, .788, .030, .039, 'lava'),
      water(.700, .851, .041, .045, 'lava'), water(.835, .947, .116, .037, 'lava')],
    lights: [light(.679, .112, .024, .029), light(.633, .210, .034, .027),
      light(.411, .265, .026, .024), light(.155, .407, .023, .020),
      light(.620, .365, .017, .020), light(.763, .460, .020, .019),
      light(.389, .562, .017, .017), light(.631, .547, .016, .017)]
  }
};

const TYPES = {water: 0, fall: 1, lava: 2};

/**
 * Patch the ground's MeshBasicMaterial, retaining its existing texture and draw
 * call. update(seconds,{active,zoom}) returns whether another frame is needed.
 * Reduced motion and inactive views use the original, completely still art.
 */
export function createAmbience(T, ground, options = {}) {
  const theme = AMBIENCE_REGIONS[options.theme] ? options.theme : 'coast';
  const regions = AMBIENCE_REGIONS[theme];
  const counts = {water: regions.water.length, lights: regions.lights.length, compiled: false,
    active: false, reducedMotion: false, extraDrawCalls: 0, extraTextures: 0};
  const material = ground && ground.mesh && ground.mesh.material;
  const empty = {counts, regions, update: () => false, dispose() {}};
  if (!data.isOwner() || !material || !material.isMeshBasicMaterial || !material.map ||
      !ground.w || !ground.h || !ground.lot) return empty;

  const oldCompile = material.onBeforeCompile, oldCacheKey = material.customProgramCacheKey;
  const oldKey = oldCacheKey.call(material);
  const lot = ground.lot;
  const uniforms = {
    realmTime: {value: 0}, realmMotion: {value: 0},
    realmPixel: {value: new T.Vector2(1 / ground.w, 1 / ground.h)},
    realmLot: {value: new T.Vector4(lot.cx / ground.w, lot.cy / ground.h,
      lot.h / (2 * Math.sin(ground.pitch ?? .9) * ground.w), lot.h / (2 * ground.h))},
    realmFlows: {value: regions.water.map(r => new T.Vector4(r.x, r.y, r.rx, r.ry))},
    realmFlowKinds: {value: regions.water.map(r => TYPES[r.kind])},
    realmLights: {value: regions.lights.map(r => new T.Vector4(r.x, r.y, r.rx, r.ry))},
    realmLightStates: {value: regions.lights.map(r => new T.Vector2(0, r.hue === 'violet' ? 1 : 0))}
  };
  const declarations = `
uniform float realmTime;
uniform float realmMotion;
uniform vec2 realmPixel;
uniform vec4 realmLot;
uniform vec4 realmFlows[${regions.water.length}];
uniform float realmFlowKinds[${regions.water.length}];
uniform vec4 realmLights[${regions.lights.length}];
uniform vec2 realmLightStates[${regions.lights.length}];
float realmArea(vec2 p, vec4 region) {
  float d = length((p - region.xy) / region.zw);
  return 1.0 - smoothstep(0.64, 1.0, d);
}
float realmLiquid(vec3 c, float kind) {
  if (kind > 1.5) {
    return smoothstep(0.20, 0.60, c.r) * smoothstep(0.035, 0.18, c.g)
      * smoothstep(1.15, 1.65, c.r / max(0.015, c.g))
      * (1.0 - smoothstep(0.45, 0.85, c.b / max(0.015, c.g)));
  }
  // Texture samples are linear, so shaded blue/green water needs a lower
  // chroma threshold than the visible sRGB painting. Warm banks stay excluded.
  float blue = smoothstep(0.012, 0.075, c.b - c.r)
    * smoothstep(0.005, 0.045, c.g - c.r);
  if (kind < 0.5) return blue * (1.0 - smoothstep(0.15, 0.32, c.r));
  float white = smoothstep(0.32, 0.65, min(c.g, c.b))
    * (1.0 - smoothstep(0.12, 0.25, abs(c.r - c.g)));
  return max(blue, white);
}
float realmLamp(vec3 c, float violet) {
  if (violet > 0.5) return smoothstep(0.10, 0.36, c.b)
    * smoothstep(0.025, 0.14, c.r - c.g) * smoothstep(0.025, 0.14, c.b - c.g);
  return smoothstep(0.30, 0.72, c.r) * smoothstep(0.10, 0.38, c.g)
    * (1.0 - smoothstep(0.65, 0.93, c.b / max(0.015, c.g)));
}
`;
  const mapFragment = `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  vec2 realmP = vec2(vMapUv.x, 1.0 - vMapUv.y);
  float realmDiamond = dot(abs(realmP - realmLot.xy) / realmLot.zw, vec2(1.0));
  // An exact unchanged square, then a feather entirely outside its boundary.
  float realmAllowed = smoothstep(1.015, 1.12, realmDiamond) * realmMotion;
  if (realmAllowed > 0.001) {
    float realmWater = 0.0;
    float realmFall = 0.0;
    float realmLava = 0.0;
    for (int i = 0; i < ${regions.water.length}; i++) {
      float area = realmArea(realmP, realmFlows[i]);
      float kind = realmFlowKinds[i];
      float amount = area * realmLiquid(sampledDiffuseColor.rgb, kind);
      if (kind > 1.5) realmLava = max(realmLava, amount);
      else if (kind > 0.5) realmFall = max(realmFall, amount);
      else realmWater = max(realmWater, amount);
    }
    float realmWet = max(realmWater, max(realmFall, realmLava)) * realmAllowed;
    if (realmWet > 0.001) {
      vec2 pixel = realmP / realmPixel;
      float slow = 1.0 - 0.52 * realmLava;
      float travel = realmTime * slow;
      float ripple = sin(pixel.y * 0.19 - travel * 2.4 + sin(pixel.x * 0.038 + travel * 0.6));
      float cross = sin(pixel.x * 0.11 + pixel.y * 0.065 - travel * 1.7);
      float cascade = sin(pixel.y * 0.32 - travel * 5.8 + pixel.x * 0.09);
      vec2 shift = vec2(ripple * (2.2 - 1.5 * realmFall),
        cross * 1.1 + cascade * realmFall * 2.4) * realmPixel;
      vec4 flowing = texture2D(map, vMapUv + shift);
      // Both source and destination must be liquid; apply the region feather
      // once, so the current stays visible instead of fading almost to zero.
      float destination = max(realmLiquid(flowing.rgb, 0.0) * step(0.001, realmWater),
        max(realmLiquid(flowing.rgb, 1.0) * step(0.001, realmFall),
          realmLiquid(flowing.rgb, 2.0) * step(0.001, realmLava)));
      float motion = realmWet * destination;
      sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, flowing.rgb, motion * 0.9);
      sampledDiffuseColor.rgb *= 1.0 + motion * (0.12 * ripple + 0.055 * cross);
      // Narrow reflections travel across pools; foam travels down waterfalls.
      // These stay inside liquid pixels rather than wobbling painted shores.
      float crest = pow(max(0.0, ripple), 8.0) * (0.55 + 0.45 * cross);
      float foam = pow(max(0.0, cascade), 5.0);
      sampledDiffuseColor.rgb += realmAllowed * (
        realmWater * crest * vec3(0.020, 0.040, 0.052)
        + realmFall * foam * vec3(0.035, 0.043, 0.048)
        + realmLava * crest * vec3(0.045, 0.014, 0.002));
    }
    vec3 glisten = vec3(0.0);
    for (int i = 0; i < ${regions.lights.length}; i++) {
      vec4 region = realmLights[i];
      float area = realmArea(realmP, region);
      // Keep the per-light trigonometry off the rest of the full-screen map.
      if (area > 0.001) {
        float source = realmLamp(sampledDiffuseColor.rgb, realmLightStates[i].y);
        vec2 local = (realmP - region.xy) / region.zw;
        float phase = float(i) * 2.399963;
        float shimmer = sin(local.y * 5.0 - realmTime * 3.2 + phase)
          * sin(local.x * 3.0 + realmTime * 1.9 + phase);
        float core = exp(-dot(local, local) * 7.0);
        vec3 tint = mix(vec3(1.0, 0.43, 0.09), vec3(0.52, 0.20, 1.0), realmLightStates[i].y);
        float flicker = realmLightStates[i].x;
        glisten += area * (sampledDiffuseColor.rgb * source * (flicker + shimmer * 0.09)
          + tint * (source * (0.038 + 0.026 * shimmer + 0.07 * flicker)
            + core * (0.014 + flicker * 0.025)));
      }
    }
    sampledDiffuseColor.rgb += clamp(glisten, vec3(-0.12), vec3(0.24)) * realmAllowed;
  }
  diffuseColor *= sampledDiffuseColor;
#endif
`;
  function compile(shader, renderer) {
    oldCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = declarations + shader.fragmentShader.replace('#include <map_fragment>', mapFragment);
    counts.compiled = true;
  }
  const cacheKey = () => `${oldKey}|realm-ambience-v2:${theme}`;
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = cacheKey;
  material.needsUpdate = true;

  let dead = false, stop = null, lastTime = 0, lastView = {active: true};
  const doc = typeof document === 'object' ? document : null;
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  counts.reducedMotion = !!(media && media.matches);
  function update(seconds, view = {}) {
    if (dead) return false;
    if (!data.isOwner()) { dispose(); return false; }
    lastTime = Number.isFinite(seconds) ? seconds : 0; lastView = view;
    counts.active = view.active !== false && !(doc && doc.hidden) && !counts.reducedMotion;
    uniforms.realmMotion.value = counts.active ? 1 : 0;
    if (!counts.active) return false;
    uniforms.realmTime.value = lastTime;
    regions.lights.forEach((r, i) => {
      const phase = i * 2.399963 + (r.x + r.y) * 5;
      // Multiple smooth, unsynchronised frequencies, without strobing or flashes.
      uniforms.realmLightStates.value[i].x = .14 * Math.sin(lastTime * 3.7 + phase)
        + .065 * Math.sin(lastTime * 6.3 + phase * 1.7) + .045 * Math.sin(lastTime * 1.3 + phase * .7);
    });
    return true;
  }
  function changed() {
    counts.reducedMotion = !!(media && media.matches);
    update(lastTime, lastView);
    if (!dead && options.onChange) options.onChange();
  }
  function dispose() {
    if (dead) return;
    dead = true; counts.active = false; uniforms.realmMotion.value = 0;
    if (stop) stop();
    if (media) { if (media.removeEventListener) media.removeEventListener('change', changed); else if (media.removeListener) media.removeListener(changed); }
    if (doc) doc.removeEventListener('visibilitychange', changed);
    if (material.onBeforeCompile === compile) material.onBeforeCompile = oldCompile;
    if (material.customProgramCacheKey === cacheKey) material.customProgramCacheKey = oldCacheKey;
    material.needsUpdate = true;
  }
  if (media) { if (media.addEventListener) media.addEventListener('change', changed); else if (media.addListener) media.addListener(changed); }
  if (doc) doc.addEventListener('visibilitychange', changed);
  stop = data.subscribe(type => { if (type === 'me' && !data.isOwner()) { dispose(); if (options.onChange) options.onChange(); } });
  return {counts, regions, update, dispose};
}
