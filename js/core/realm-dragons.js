// Pure dragon identities shared by hatcheries, battles, replays and renderers.
// Species IDs and color order are persisted; append new entries rather than reordering them.
export const DRAGON_ORDER = Object.freeze(['nightmare', 'soul-eater', 'terror-bringer', 'usurper']);
const entry = (id, name, colors, fly) => Object.freeze({
  id, name, colors: Object.freeze(colors), fly,
  hero: 'dragon_' + id.replaceAll('-', '_'), troop: 'hero_dragon_' + id.replaceAll('-', '_')
});
export const DRAGONS = Object.freeze({
  nightmare: entry('nightmare', 'Nightmare', ['red', 'green', 'blue', 'albino'], false),
  'soul-eater': entry('soul-eater', 'Soul Eater', ['red', 'purple', 'green', 'blue'], true),
  'terror-bringer': entry('terror-bringer', 'Terror Bringer', ['red', 'grey', 'green', 'albino'], true),
  usurper: entry('usurper', 'Usurper', ['red', 'blue', 'black', 'albino'], true)
});
export const dragonHeroKey = species => DRAGON_ORDER.includes(species) ? DRAGONS[species].hero : null;
export const dragonSpeciesOfHero = key => DRAGON_ORDER.find(s => DRAGONS[s].hero === key || DRAGONS[s].troop === key) || null;
export const validDragonChoice = choice => !!choice && typeof choice === 'object' && DRAGON_ORDER.includes(choice.species)
  && DRAGONS[choice.species].colors.includes(choice.color);
export const dragonThumb = (species, color) => validDragonChoice({species, color})
  ? `models/realm/dragons-v1/thumbs/${species}-${color}.webp` : '';
/** Copy only known identities; a hero key fixes its species and cannot be overridden by metadata. */
export function dragonSnapshot(levels, choices = {}) {
  return Object.fromEntries(DRAGON_ORDER.flatMap(species => {
    const D = DRAGONS[species], level = levels && levels[D.hero], choice = choices && choices[D.hero];
    if (!Number.isInteger(level) || level < 1 || level > 10) return [];
    const color = choice && choice.species === species && D.colors.includes(choice.color) ? choice.color : D.colors[0];
    return [[D.hero, {species, color, ...(Number.isInteger(choice?.buildingId) && choice.buildingId >= 0 ? {buildingId: choice.buildingId} : {})}]];
  }));
}
