// Owner table pilot. Pure helpers; callers enforce the existing profile gate.
import * as B from './dynasty-battle.js';

export const VERSION = 6, SIZE = 40;
export const DECK_LIMIT = 30;
// A reusable match playbook, not collectible cards or a change to pack odds.
export const PLAYBOOK = {'I-charge': 2, 'I-draw': 2, 'I-recover': 2, 'I-focus': 2};
export const FINISHES = [
  {id: 'club', name: 'Clubhouse', color: '#17694f', away: '#713d42', rule: 'Your first table', goal: 0},
  {id: 'blue', name: 'Midnight Club', color: '#204c7e', away: '#563b76', rule: 'Win 3 solo matches', goal: 3, kind: 'wins'},
  {id: 'purple', name: 'Royal Box', color: '#653d7c', away: '#275f72', rule: 'Win challenge 10', goal: 1, kind: 'g10'},
  {id: 'wine', name: 'Red Zone', color: '#852f48', away: '#244e65', rule: 'Open 5 packs', goal: 5, kind: 'packs'},
  {id: 'gold', name: 'Champions Club', color: '#71602d', away: '#4c3b67', rule: 'Open 20 packs', goal: 20, kind: 'packs'}
];
export function clean(raw = {}) {
  const ids = value => Array.isArray(value) ? value.filter(id => typeof id === 'string').slice(0, SIZE) : [];
  const out = {deck: ids(raw?.deck),
    packs: Math.max(0, Math.min(100000, Math.floor(Number(raw?.packs) || 0))),
    finish: FINISHES.some(f => f.id === raw?.finish) ? raw.finish : 'club'};
  if (Array.isArray(raw?.decks)) {
    const seen = new Set();
    out.decks = raw.decks.filter(d => d && typeof d.id === 'string' && /^[a-z0-9-]{1,64}$/.test(d.id) && !seen.has(d.id) && seen.add(d.id))
      .slice(0, DECK_LIMIT).map(d => ({id: d.id, name: String(d.name || 'My deck').trim().slice(0, 32) || 'My deck', ids: ids(d.ids)}));
    out.active = out.decks.some(d => d.id === raw.active) ? raw.active : '';
  }
  return out;
}
export function finishes(s) {
  const wins = Object.values(s.so || {}).reduce((a, n) => a + n, 0), packs = clean(s.table).packs;
  return FINISHES.map(f => { const have = f.kind === 'wins' ? wins : f.kind === 'g10' ? (s.so?.g10 || 0) : packs;
    return {...f, have: Math.min(f.goal, have), unlocked: !f.goal || have >= f.goal}; });
}
export function available(s) { return {...s.o, ...PLAYBOOK}; }
export function check(ids, s) {
  const pool = available(s), counts = {};
  let why = ids.length !== SIZE ? `Choose ${SIZE} cards (${ids.length} selected).` : '';
  for (const id of ids) {
    counts[id] = (counts[id] || 0) + 1;
    if ((!B.stats(id) && !B.TRAINERS[id]) || counts[id] > Math.min(2, pool[id] || 0)) why = 'Use at most 2 copies, from your collection or match playbook.';
  }
  if (ids.filter(id => B.basicIn(id, VERSION)).length < 6) why = 'Include at least 6 player cards.';
  return {ok: !why, why, types: B.deckTypes(ids)};
}
export function build(s) {
  const pool = available(s), out = [], n = {};
  const add = id => { if (out.length < SIZE && (B.stats(id) || B.TRAINERS[id]) && (n[id] || 0) < Math.min(2, pool[id] || 0)) { out.push(id); n[id] = (n[id] || 0) + 1; } };
  // Keep the chosen strategy, add the playbook, then owned reserves. Never mint collection cards.
  (s.dk || []).forEach(add);
  Object.entries(PLAYBOOK).forEach(([id, count]) => { for (let i = 0; i < count; i++) add(id); });
  const ids = Object.keys(pool).sort((a, b) => (B.stats(b)?.hp || 0) - (B.stats(a)?.hp || 0));
  for (let copy = 0; copy < 2; copy++) ids.forEach(add);
  return out;
}
export function deck(s) {
  const table = clean(s.table), selected = table.decks?.find(d => d.id === table.active);
  const saved = table.deck, ids = selected ? selected.ids : check(saved, s).ok ? saved : build(s);
  return {ids, ...check(ids, s)};
}
/** Reading old saves never migrates or replaces a deck. The first explicit edit saves this existing slot. */
export function loadouts(s) {
  const table = clean(s.table);
  return table.decks?.length ? table.decks : [{id: 'original', name: s.nm || 'My first deck', ids: deck(s).ids.slice()}];
}
export const activeId = s => clean(s.table).active || loadouts(s)[0].id;
export function cpuDeck(ids, reserveIds = []) {
  const base = ids.slice(), counts = {}, types = B.deckTypes(ids);
  base.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const add = id => { if (base.length < SIZE && (counts[id] || 0) < 2) { base.push(id); counts[id] = (counts[id] || 0) + 1; } };
  Object.keys(PLAYBOOK).forEach(id => { add(id); add(id); });
  ids.forEach(add);
  const players = ids.map(B.stats).filter(Boolean), hp = players.reduce((n,p) => n+p.hp,0) / Math.max(1,players.length);
  const reserves = reserveIds.filter(id => B.stats(id) && types.includes(B.TYPES[B.stats(id).type].e))
    .sort((a,b) => Math.abs(B.stats(a).hp-hp) - Math.abs(B.stats(b).hp-hp) || a.localeCompare(b));
  for (let copy=0; copy<2; copy++) reserves.forEach(add);
  return base;
}
