// Rivals Energy marks. Bold silhouettes stay distinct on small cards and dragged orbs.
// Inline SVG keeps them sharp at every size and available without an image download.
export const ENERGY_COLOR = Object.freeze({
  Grass: '#4c963e', Fire: '#ce513c', Water: '#337cb8', Lightning: '#b18d10',
  Psychic: '#9451aa', Fighting: '#ab6b42', Darkness: '#43556b', Metal: '#697c85',
  Colorless: '#8a857b', Dragon: '#7c6c35',
  P: '#3D9BE9', R: '#4FAE3E', B: '#E8573A', C: '#9562D9', K: '#B88911', '*': '#A9A391'
});

// Calling-card art is shared by the current printed types and their saved-match equivalents.
// Keep the original Energy label and symbol when showing an older match.
const BANNER_TYPE = Object.freeze({P: 'water', R: 'grass', B: 'fire', C: 'psychic', K: 'lightning', '*': 'colorless'});
export const energyBannerUrl = energy => {
  const type = Object.hasOwn(BANNER_TYPE, energy) ? BANNER_TYPE[energy]
    : Object.hasOwn(ENERGY_COLOR, energy) ? energy.toLowerCase() : 'colorless';
  return `img/rivals/energy-banners/${type}-v1.webp`;
};

const MARKS = Object.freeze({
  Grass: '<path d="M20 3C9 2 3 7 4 14c.6 4.4 5 7 9 5 6-3 7-10 7-16Z"/><path d="M5 20 16 8m-7 8v-5m3 2h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  Fire: '<path d="M13 2c1 5-4 6-3 10 2-1 3-3 3-5 5 3 8 7 6 11-2 4-10 5-13 1C2 14 7 8 9 6c-1 4 0 5 1 5 2-3 1-6 3-9Z"/><path d="M12 13c0 3-3 3-2 6 .7 2 4 2 4.7 0 .8-2-1-3-2.7-6Z" fill="currentColor"/>',
  Water: '<path d="M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13Z"/><path d="M8 14c-.7 2 .4 4 2 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  Lightning: '<path d="m13 2-9 12h7l-1 8L21 9h-8l2-7Z"/>',
  Psychic: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="4.5" fill="currentColor"/><circle cx="12" cy="12" r="2"/>',
  Fighting: '<path d="M4 12V7a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v7l-3 4v3H8v-3l-4-4v-2Z"/><path d="M8 8v4m4-5v5m4-4v4M5 12h7v3H9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  Darkness: '<path d="M17 3a9.5 9.5 0 1 0 4 14A8 8 0 0 1 17 3Z"/>',
  Metal: '<path fill-rule="evenodd" d="m12 2 9 5v10l-9 5-9-5V7Zm0 6-4 2v4l4 2 4-2v-4Z"/>',
  Colorless: '<path d="m12 2 2.9 6.1 6.7.9-4.9 4.8 1.2 6.8-5.9-3.2-5.9 3.2 1.2-6.8L2.4 9l6.7-.9Z"/>',
  Dragon: '<path d="m5 3 7 3 6-3-1 6 4 5-7 2-4 6-2-7-5-3 5-3Z"/><path d="m13 10 3 2-3 1Z" fill="currentColor"/>'
});

/** Decorative glyph; callers supply the full Energy name on its badge or control. */
export const energySVG = e => `<svg class="rivals-energy-icon" viewBox="0 0 24 24" fill="#fff" aria-hidden="true" focusable="false">${MARKS[e] || MARKS.Colorless}</svg>`;
