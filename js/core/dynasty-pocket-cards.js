// Gridiron Rivals v7 card definitions. All durability, damage and Energy values here are
// fictional game-balance designs. NFL position, real ratings, team and cosmetic rarity
// never determine battle strength. Older match versions keep their original catalog.
export const ENERGY_TYPES = Object.freeze(['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal']);
export const DECK_SIZE = 20;
export const MAX_COPIES = 2;
export const BALANCE_NOTE = 'Fictional card-balance values; not NFL statistics or athlete evaluations.';
export const RENTAL_NOTE = 'Support and development cards are reusable match rentals. They do not consume, upgrade or add collection cards.';

const attack = (name, cost, damage, text = '', effect) => ({name, cost, damage, text, ...(effect ? {effect} : {})});
// Printed revision for new matches. Revision 2 (November 7, 2026) adds Sleep attacks; a saved
// revision 1 match keeps the attacks it started with (attacksV1) so its log replays exactly.
export const REVISION = 2;
const ASLEEP = 'Your opponent’s Active athlete is now Asleep.';
const sleeps = {type: 'condition', condition: 'asleep'};
/** A card as printed in a match revision, for faces shown inside that match. */
export function printed(id, rev = REVISION) { const c = card(id); return c && (rev || 1) < 2 && c.attacksV1 ? {...c, attacks: c.attacksV1} : c; }
const colorless = n => Array(n).fill('Colorless');
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const support = (id, kind, name, text, effect, target) => ({id, kind, name, canonicalName: name, text, effect, target,
  rarity: 'common', rental: true, sourceId: null, balanceNote: BALANCE_NOTE});
export const SUPPORTS = freeze([
  support('P7-film', 'supporter', 'Film Study', 'Draw two cards.', {type: 'draw', count: 2}),
  support('P7-scout', 'item', 'Scouting Report', 'Put one random Base Player from your deck into your hand.', {type: 'search-base'}),
  support('P7-recovery', 'item', 'Recovery Kit', 'Heal 20 damage from one of your athletes.', {type: 'heal', amount: 20}, 'mine'),
  support('P7-fast-track', 'item', 'Fast Track', 'Develop an eligible Base Player into its matching Prime Player from your hand, skipping Breakout. Not on your first turn or the turn that Base entered play. Does not search your deck.', {type: 'fast-track'}, 'mine'),
  support('P7-gear', 'tool', 'Protective Gear', 'The attached athlete has 20 additional maximum HP. Damage already taken remains. One Tool per athlete.', {type: 'max-hp', amount: 20}, 'mine'),
  support('P7-matchup', 'supporter', 'Matchup Change', 'Your opponent switches their Active athlete with one of their Benched athletes. Your opponent chooses the replacement.', {type: 'matchup-change'}),
  support('P7-ground', 'stadium', 'Training Ground', 'Base Players on both sides have 20 additional maximum HP. One shared Stadium is in play.', {type: 'base-max-hp', amount: 20})
]);
const SUPPORT_IDS = SUPPORTS.map(c => c.id);
const STARTER_SUPPORT = SUPPORT_IDS.filter(id => id !== 'P7-ground').flatMap(id => [id, id]);

// Authored examples from the brief. These are independent from the collection's real
// athlete metadata and from rarity. All their costs are Colorless for the teaching duel.
const EXAMPLES = {
  'Patrick Mahomes': {hp: 70, type: 'Fire', weakness: 'Water', retreat: 1, attacks: [attack('Pocket Escape', colorless(1), 30)]},
  'Justin Jefferson': {hp: 120, type: 'Colorless', weakness: null, retreat: 1, attacks: [attack('Route Break', colorless(2), 50), attack('Double Move', colorless(1), 10, ASLEEP, sleeps)],
    attacksV1: [attack('Route Break', colorless(2), 50)]},
  'Derrick Henry': {hp: 160, type: 'Colorless', weakness: null, retreat: 2, attacks: [attack('Power Run', colorless(3), 100)]},
  'CeeDee Lamb': {hp: 100, type: 'Colorless', weakness: null, retreat: 1, attacks: [attack('Quick Separation', colorless(1), 30)]}
};
const RENTAL_PLAYERS = [
  {id: 'R7-mahomes', name: 'Patrick Mahomes', pos: 'QB'},
  {id: 'R7-jefferson', name: 'Justin Jefferson', pos: 'WR'},
  {id: 'R7-henry', name: 'Derrick Henry', pos: 'RB'},
  {id: 'R7-lamb', name: 'CeeDee Lamb', pos: 'WR'}
];
// Stable balance profiles are selected by athlete identity only; OVR, position, team,
// season and rarity are deliberately absent. These costs/types are printed on the card.
const PROFILES = freeze([
  {hp: 90, type: 'Grass', weakness: 'Fire', retreat: 1, attacks: [attack('Open-Field Burst', ['Grass'], 30), attack('Power Run', ['Grass', 'Colorless'], 50)]},
  {hp: 100, type: 'Fire', weakness: 'Water', retreat: 1, attacks: [attack('Quick Release', ['Fire'], 30), attack('Deep Shot', ['Fire', 'Colorless'], 50)]},
  {hp: 100, type: 'Water', weakness: 'Lightning', retreat: 1, attacks: [attack('Route Technician', ['Water'], 30), attack('Contested Catch', ['Water', 'Colorless'], 50)]},
  {hp: 80, type: 'Lightning', weakness: 'Fighting', retreat: 0, attacks: [attack('Pocket Escape', ['Lightning'], 30), attack('Open-Field Burst', ['Lightning', 'Colorless'], 50)]},
  {hp: 90, type: 'Psychic', weakness: 'Darkness', retreat: 1, attacks: [attack('Hard Count', ['Psychic'], 10, ASLEEP, sleeps), attack('Protection Call', ['Psychic', 'Colorless'], 50)],
    attacksV1: [attack('Read the Field', ['Psychic'], 30), attack('Protection Call', ['Psychic', 'Colorless'], 50)]},
  {hp: 110, type: 'Fighting', weakness: 'Psychic', retreat: 2, attacks: [attack('Power Run', ['Fighting'], 30), attack('Pass Rush', ['Fighting', 'Colorless'], 50)]},
  {hp: 100, type: 'Darkness', weakness: 'Grass', retreat: 1, attacks: [attack('Ball Hawk', ['Darkness'], 30), attack('Contested Catch', ['Darkness', 'Colorless'], 50)]},
  {hp: 120, type: 'Metal', weakness: 'Fire', retreat: 2, attacks: [attack('Protection Call', ['Metal'], 20), attack('Drive Block', ['Metal', 'Colorless'], 50)]}
]);
function hash(s) { let n = 2166136261; for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0; return n; }
const identity = c => String(c.name || '').trim().replace(/\s+/g, ' ');
const clone = v => JSON.parse(JSON.stringify(v));
let BY_ID = new Map(), BASES = [];

function player(c, sourceId, rentalOnly = false) {
  const athlete = identity(c), design = clone(EXAMPLES[athlete] || PROFILES[hash(athlete.toLowerCase()) % PROFILES.length]);
  return {id: c.id, kind: 'player', name: `${athlete} - Base`, canonicalName: `${athlete} - Base`, athlete,
    position: c.pos || c.position || '', team: c.team || null, number: c.num ?? null,
    stage: 'Base', predecessor: null, classification: 'regular', types: [design.type], ...design,
    rarity: c.r || c.rarity || 'common', sourceId, collectionId: rentalOnly ? null : c.id,
    rental: rentalOnly, rentalOnly, development: false, ability: null, text: '', balanceNote: BALANCE_NOTE};
}
function forms(base) {
  const energy = base.type === 'Colorless' ? 'Colorless' : base.type;
  const common = {...base, attacksV1: null, rental: true, development: true, rentalOnly: base.rentalOnly, collectionId: base.collectionId};
  const breakout = {...common, id: `${base.id}~breakout`, name: `${base.athlete} - Breakout`, canonicalName: `${base.athlete} - Breakout`,
    stage: 'Breakout', predecessor: base.id, hp: base.hp + 30,
    attacks: [attack('Breakout Play', [energy, 'Colorless'], 60)]};
  const prime = {...common, id: `${base.id}~prime`, name: `${base.athlete} - Prime ex`, canonicalName: `${base.athlete} - Prime ex`,
    stage: 'Prime', predecessor: breakout.id, classification: 'ex', hp: base.hp + 80,
    attacks: [attack('Signature Drive', [energy, energy, 'Colorless'], 100)]};
  return [breakout, prime];
}
function put(c) { BY_ID.set(c.id, freeze(c)); }

/** Refresh only the new rules catalog. Collection objects are never changed. */
export function setCards(cards = []) {
  BY_ID = new Map(); BASES = [];
  SUPPORTS.forEach(put);
  for (const c of cards) {
    if (!c?.id || !c.name || (!c.pos && !c.position) || BY_ID.has(c.id)) continue;
    const base = player(c, c.id); put(base); BASES.push(base); forms(base).forEach(put);
  }
  for (const c of RENTAL_PLAYERS) {
    const art = cards.find(x => identity(x) === c.name);
    const base = player({...c, team: art?.team, num: art?.num, r: art?.r}, art?.id || null, true);
    put(base); forms(base).forEach(put);
  }
  const mahomes = BY_ID.get('R7-mahomes');
  put({...mahomes, id: 'R7-mahomes-ex', name: 'Patrick Mahomes - Base ex', canonicalName: 'Patrick Mahomes - Base ex',
    classification: 'ex', hp: 160, type: 'Colorless', types: ['Colorless'], weakness: null, attacksV1: null,
    attacks: [attack('Deep Shot', colorless(2), 70)]});
  put({...mahomes, id: 'R7-mahomes-mega', name: 'Patrick Mahomes - Base Mega ex', canonicalName: 'Patrick Mahomes - Base Mega ex',
    classification: 'mega-ex', hp: 220, type: 'Colorless', types: ['Colorless'], weakness: null, retreat: 3, attacksV1: null,
    attacks: [attack('Prime-Time Drive', colorless(4), 120)]});
}
setCards();

export const card = id => BY_ID.get(id) || null;
export const allCards = () => Array.from(BY_ID.values());
export const pointValue = c => c?.classification === 'mega-ex' ? 3 : c?.classification === 'ex' ? 2 : 1;
/** Development/support rentals never consume owned cards or permanently change them. */
export function availableCopies(owned, id) {
  const c = card(id); if (!c) return 0;
  if (c.kind !== 'player') return 2;
  if (c.rentalOnly) return 0;
  const count = Math.max(0, Number(owned?.[c.collectionId]) || 0);
  return c.development ? (count ? 2 : 0) : Math.min(2, Math.floor(count));
}
export const availableCards = owned => allCards().filter(c => availableCopies(owned, c.id) > 0);
export function checkDeck(ids, owned = null, energy = ['Fire']) {
  if (!Array.isArray(energy) || energy.length < 1 || energy.length > 3 || new Set(energy).size !== energy.length || energy.some(e => !ENERGY_TYPES.includes(e))) {
    return {ok: false, why: 'Choose one to three different Energy Zone types.'};
  }
  if (!Array.isArray(ids) || ids.length !== DECK_SIZE) return {ok: false, why: `A deck contains exactly 20 cards (${Array.isArray(ids) ? ids.length : 0}/20).`};
  const canonical = new Map(), copies = new Map();
  for (const id of ids) {
    const c = card(id);
    if (!c) return {ok: false, why: 'This deck contains an unknown card.'};
    canonical.set(c.canonicalName, (canonical.get(c.canonicalName) || 0) + 1);
    if (canonical.get(c.canonicalName) > MAX_COPIES) return {ok: false, why: `At most two copies of ${c.canonicalName}, including alternate artwork.`};
    copies.set(id, (copies.get(id) || 0) + 1);
    if (owned && copies.get(id) > availableCopies(owned, id)) return {ok: false, why: `${c.canonicalName} is not available in that quantity.`};
  }
  if (!ids.some(id => card(id).kind === 'player' && card(id).stage === 'Base')) return {ok: false, why: 'Include at least one Base Player.'};
  return {ok: true, why: '', types: energy.slice()};
}
function recipe(base, backup, name, rental = false) {
  const ids = [base, base, `${base}~breakout`, `${base}~breakout`, `${base}~prime`, `${base}~prime`, backup, backup, ...STARTER_SUPPORT];
  const type = card(base)?.type;
  return {ids, energy: [ENERGY_TYPES.includes(type) ? type : 'Fire'], name, rental};
}
/** Explicit starter rental. Availability is not a permanent collection grant. */
export function rentalDeck() { return recipe('R7-mahomes', 'R7-jefferson', 'Development rental', true); }
export function isRentalDeck(ids, energy) {
  const rental = rentalDeck();
  return Array.isArray(ids) && ids.length === rental.ids.length && [...ids].sort().join('|') === [...rental.ids].sort().join('|')
    && Array.isArray(energy) && energy.length === 1 && energy[0] === 'Fire';
}
/** Build a coherent owned deck, falling back to the visibly labeled rental. Never save here. */
export function defaultDeck(owned = {}) {
  const bases = BASES.filter(c => availableCopies(owned, c.id) >= 2).sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  for (const base of bases) {
    const backup = bases.find(c => c.canonicalName !== base.canonicalName && (c.type === base.type || c.type === 'Colorless'));
    if (backup) { const d = recipe(base.id, backup.id, `${base.athlete} development`); if (checkDeck(d.ids, owned, d.energy).ok) return d; }
  }
  // A small collection can still play: use its one-copy Bases and their development
  // rentals, then fill with legal supports. Never manufacture collection copies.
  for (const focus of BASES.filter(c => availableCopies(owned, c.id))) {
    const pool = BASES.filter(c => availableCopies(owned, c.id) && (c.type === focus.type || c.type === 'Colorless'));
    const ids = [], names = new Set();
    for (const c of pool) {
      if (names.has(c.canonicalName)) continue; names.add(c.canonicalName);
      const n = availableCopies(owned, c.id);
      for (let i = 0; i < n; i++) ids.push(c.id, `${c.id}~breakout`, `${c.id}~prime`);
      if (ids.length >= 6) break;
    }
    if (ids.length < 6) continue;
    for (const id of SUPPORT_IDS) for (let i = 0; i < 2 && ids.length < 20; i++) ids.push(id);
    const energy = [ENERGY_TYPES.includes(focus.type) ? focus.type : 'Fire'];
    if (checkDeck(ids, owned, energy).ok) return {ids, energy, name: `${focus.athlete} development`, rental: false};
  }
  return rentalDeck();
}
/** CPU uses printed cards and the same legality rules. Level changes its recipe, not stats. */
export function cpuDeck(level = 1, bossId = null) {
  const boss = card(bossId), ownBase = boss?.kind === 'player' && boss.stage === 'Base' ? boss.id : null;
  if (ownBase) {
    const backup = BASES.find(c => c.id !== ownBase && c.canonicalName !== boss.canonicalName && (c.type === boss.type || c.type === 'Colorless'));
    if (backup) return recipe(ownBase, backup.id, `${boss.athlete} challenge`, true);
  }
  const n = Number(level) || 1;
  if (n >= 16) return {...rentalDeck(), name: 'Prime development'};
  const players = n >= 9 ? ['R7-lamb', 'R7-lamb', 'R7-mahomes-ex', 'R7-mahomes-ex', 'R7-henry', 'R7-henry']
    : ['R7-lamb', 'R7-lamb', 'R7-mahomes', 'R7-mahomes', 'R7-jefferson', 'R7-jefferson'];
  return {ids: [...players, ...SUPPORT_IDS.flatMap(id => [id, id])], energy: ['Fire'], name: 'Training rivals', rental: true};
}
