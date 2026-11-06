// Gridiron Rivals rules v7. The printed card defines every battle attribute; NFL metadata and
// artwork never add rules. Legacy engines remain untouched so old logs keep their original rules.
import * as C from './dynasty-pocket-cards.js';

export const VERSION = 7, DECK_SIZE = 20, BENCH_MAX = 3, WIN_POINTS = 3;
export const ENERGY_TYPES = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal'];
export const card = id => C.card(id);
export const toMove = G => G.phase === 'over' ? -1 : G.who;
export const slots = p => [p.active, ...p.bench].filter(Boolean);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = why => ({ok: false, why});
const yes = {ok: true, why: ''};
const player = id => card(id)?.kind === 'player';
const base = id => player(id) && card(id).stage === 'Base';
const effectType = e => e?.type || e?.kind;
const pointsOf = c => c.classification === 'mega-ex' || c.classification === 'Mega ex' ? 3 : c.classification === 'ex' ? 2 : 1;
const typesOf = c => c.types || [c.type];
const count = (ids, id) => ids.filter(x => x === id).length;
const find = (p, u) => slots(p).find(s => s.u === u);
const allSlots = G => G.p.flatMap(slots);
const ownerOf = (G, s) => G.p.findIndex(p => slots(p).includes(s));
const conditions = s => s.conditions || (s.conditions = {});
const weaknessOf = c => c.weakness || c.weak || null;
const damageOf = a => a.damage ?? a.dmg ?? 0;
const nameOf = id => card(id)?.name || id;
function event(G, k, who, details = {}, text = '') { G.events.push({k, who, ...details, text}); }
function hash(text) { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }
function random(G) {
  let t = (hash(G.seed + '|' + G.rn++) + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function flip(G, who, reason) { const heads = random(G) < .5; event(G, 'coin', who, {heads, reason}, `${reason}: ${heads ? 'heads' : 'tails'}.`); return heads; }
function shuffle(G, list) { const a = list.slice(); for (let i = a.length - 1; i > 0; --i) { const j = Math.floor(random(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function draw(G, who, n = 1) {
  const p = G.p[who]; let actual = 0;
  while (actual < n && p.deck.length) { const id = p.deck.shift(); p.hand.push(id); actual++; event(G, 'draw', who, {id}, `Manager ${who + 1} drew a card.`); }
  return actual;
}
function removeHand(p, id) { p.hand.splice(p.hand.indexOf(id), 1); }
function slot(G, id, who) { return {u: ++G.uid, id, dmg: 0, en: [], stack: [], tool: null, conditions: {}, entered: G.p[who].turns, developed: -1, abilityTurn: -1}; }
function clearConditions(s) { s.conditions = {}; delete s.shield; }
export function canPay(cost = [], energy = []) {
  const rest = energy.slice();
  for (const type of cost.filter(t => t !== 'Colorless' && t !== '*')) { const i = rest.indexOf(type); if (i < 0) return false; rest.splice(i, 1); }
  return rest.length >= cost.filter(t => t === 'Colorless' || t === '*').length;
}
export function hpOf(G, s) {
  if (!s) return 0;
  const c = card(s.id), tool = card(s.tool), stadium = card(G.stadium?.id);
  return c.hp + (effectType(tool?.effect) === 'max-hp' ? tool.effect.amount : 0)
    + (c.stage === 'Base' && effectType(stadium?.effect) === 'base-max-hp' ? stadium.effect.amount : 0);
}
export function checkDeck(ids, energy = ['Fire']) {
  if (!Array.isArray(ids) || ids.length !== DECK_SIZE) return fail('A deck must contain exactly 20 cards.');
  if (!Array.isArray(energy) || !energy.length || energy.length > 3 || new Set(energy).size !== energy.length || energy.some(e => !ENERGY_TYPES.includes(e))) return fail('Choose one to three different Energy types.');
  const counts = {};
  for (const id of ids) {
    const c = card(id);
    if (!c || !['player', 'item', 'supporter', 'tool', 'stadium'].includes(c.kind)) return fail('That deck contains an unknown card.');
    const canonical = c.canonicalName || c.name;
    counts[canonical] = (counts[canonical] || 0) + 1;
    if (counts[canonical] > 2) return fail('Use at most two cards with the same canonical name, including artwork variants.');
  }
  return ids.some(base) ? yes : fail('Include at least one Base Player.');
}
export function newGame(seed, decks, options = {}) {
  if (!Array.isArray(decks) || decks.length !== 2) throw new Error('Two legal decks are required.');
  const energy = options.energy || [['Fire'], ['Fire']];
  if (!Array.isArray(energy) || energy.length !== 2 || energy.some(types => !Array.isArray(types))) throw new Error('Configure an Energy Zone for each manager.');
  decks.forEach((d, i) => { const result = checkDeck(d, energy[i]); if (!result.ok) throw new Error(result.why); });
  const G = {v: VERSION, seed: String(seed), rn: 0, uid: 0, phase: 'setup', turn: 0, who: 0, first: 0, p: [], winner: null, events: [], stadium: null, pending: null, continuation: null};
  G.first = options.first === 0 || options.first === 1 ? options.first : (random(G) < .5 ? 0 : 1); G.who = G.first;
  G.p = decks.map((ids, who) => {
    const deck = shuffle(G, ids), hand = deck.splice(0, 5);
    // Guarantee a Base without changing card counts or allowing development cards in the opening spots.
    if (!hand.some(base)) {
      const possible = deck.map((id, i) => base(id) ? i : -1).filter(i => i >= 0);
      const index = possible[Math.floor(random(G) * possible.length)], h = Math.floor(random(G) * hand.length);
      [hand[h], deck[index]] = [deck[index], hand[h]];
    }
    return {hand, deck, active: null, bench: [], discard: [], discardedEnergy: [], points: 0, turns: 0, used: {}, en: null, energy: energy[who].slice(), ready: false, promote: false};
  });
  event(G, 'first', G.first, {}, `Manager ${G.first + 1} goes first and receives no normal Energy on the opening turn.`);
  return G;
}
function beginTurn(G, who) {
  G.who = who; G.turn++; const p = G.p[who]; p.turns++; p.used = {}; p.en = null;
  slots(p).forEach(s => { if (s.shield && s.shield.untilTurn <= G.turn) delete s.shield; });
  draw(G, who);
  if (!(G.turn === 1 && who === G.first)) p.en = p.energy[Math.floor(random(G) * p.energy.length)];
  event(G, 'turn', who, {turn: G.turn, energy: p.en}, `Manager ${who + 1}'s turn${p.en ? ` · ${p.en} Energy available` : ' · no normal opening Energy'}.`);
}
function finish(G, winner, reason) { G.phase = 'over'; G.winner = winner; G.over = {win: winner === 'draw' ? -1 : winner, why: reason}; G.pending = null; G.continuation = null; event(G, 'over', winner, {reason}, winner === 'draw' ? 'The match is a draw.' : `Manager ${winner + 1} wins: ${reason}.`); }
function knockoutCheck(G) {
  // Resolve all lethal damage together. Benched knockouts award the same printed point value.
  const knocked = G.p.flatMap((p, who) => slots(p).filter(s => s.dmg >= hpOf(G, s)).map(s => ({who, s})));
  for (const {who, s} of knocked) {
    const p = G.p[who], pts = pointsOf(card(s.id));
    p.discard.push(...s.stack, s.id, ...(s.tool ? [s.tool] : [])); p.discardedEnergy.push(...s.en);
    if (p.active === s) { p.active = null; p.promote = p.bench.length > 0; } else p.bench = p.bench.filter(x => x !== s);
    G.p[1 - who].points += pts;
    event(G, 'ko', who, {id: s.id, points: pts, scorer: 1 - who}, `${nameOf(s.id)} is knocked out. Manager ${2 - who} earns ${pts} point${pts === 1 ? '' : 's'}.`);
  }
  if (!knocked.length) return;
  G.p.forEach(p => { p.promote = !p.active && p.bench.length > 0; });
  const wins = G.p.map((p, who) => p.points >= WIN_POINTS || !slots(G.p[1 - who]).length);
  if (wins[0] && wins[1]) finish(G, 'draw', 'simultaneous winning conditions');
  else if (wins[0] || wins[1]) { const who = wins[0] ? 0 : 1; finish(G, who, G.p[who].points >= WIN_POINTS ? 'three knockout points' : 'no opposing athlete remains in play'); }
}
function checkup(G, endedWho) {
  event(G, 'checkup', endedWho, {}, 'Between-turn Checkup.');
  for (let who = 0; who < 2; who++) {
    const p = G.p[who], s = p.active; if (!s) continue;
    const c = conditions(s);
    if (c.poisoned) { s.dmg += 10; event(G, 'condition-damage', who, {id: s.id, amount: 10, condition: 'Poisoned'}, `${nameOf(s.id)} takes 10 Poison damage.`); }
    if (c.burned) { s.dmg += 20; event(G, 'condition-damage', who, {id: s.id, amount: 20, condition: 'Burned'}, `${nameOf(s.id)} takes 20 Burn damage.`); if (flip(G, who, 'Burn recovery')) delete c.burned; }
    if (c.asleep && flip(G, who, 'Sleep recovery')) delete c.asleep;
    if (c.paralyzed && who === endedWho && p.turns >= c.paralyzedUntil) { delete c.paralyzed; delete c.paralyzedUntil; }
  }
  knockoutCheck(G);
}
function settle(G) {
  if (G.phase === 'over') return;
  knockoutCheck(G); if (G.phase === 'over') return;
  const promotion = G.p.findIndex(p => p.promote);
  if (promotion >= 0) { if (!G.continuation) G.continuation = {kind: 'resume', who: G.who}; G.who = promotion; return; }
  const next = G.continuation; G.continuation = null;
  if (!next) return;
  if (next.kind === 'resume') { G.who = next.who; return; }
  if (next.kind === 'checkup') {
    G.who = next.who; checkup(G, next.who); if (G.phase === 'over') return;
    G.continuation = {kind: 'next-turn', who: 1 - next.who}; settle(G); return;
  }
  if (next.kind === 'next-turn') beginTurn(G, next.who);
}
function endTurn(G, who) {
  G.p[who].en = null;
  G.continuation = {kind: 'checkup', who}; settle(G);
}
function developmentOkay(G, who, s, id, fast = false) {
  const p = G.p[who], c = card(id), previous = card(s?.id);
  if (!s || !player(id) || c.stage === 'Base') return false;
  if (p.turns <= 1 || s.entered === p.turns || s.developed === p.turns) return false;
  if (!fast) return c.predecessor === s.id || c.predecessor === previous.canonicalName;
  const mid = card(c.predecessor);
  return previous.stage === 'Base' && c.stage === 'Prime' && mid?.stage === 'Breakout' && (mid.predecessor === s.id || mid.predecessor === previous.canonicalName);
}
function evolve(G, who, s, id) {
  const from = s.id; s.stack.push(from); s.id = id; s.developed = G.p[who].turns; s.abilityTurn = -1; clearConditions(s);
  removeHand(G.p[who], id); event(G, 'evolve', who, {from, id, on: s.u}, `${nameOf(from)} develops into ${nameOf(id)}. Damage and attachments stay.`);
}
function retreatCost(s) { return Math.max(0, card(s.id).retreat || 0); }
function energySelection(p, s, indexes, amount) {
  const selected = indexes == null ? Array.from({length: amount}, (_, i) => i) : indexes;
  if (!Array.isArray(selected) || selected.length !== amount || new Set(selected).size !== amount || selected.some(i => !Number.isInteger(i) || i < 0 || i >= s.en.length)) return null;
  return selected;
}
function switchTo(G, who, u) {
  const p = G.p[who], old = p.active, index = p.bench.findIndex(s => s.u === u), replacement = p.bench[index];
  clearConditions(old); p.bench[index] = old; p.active = replacement;
  event(G, 'switch', who, {from: old.id, id: replacement.id}, `${nameOf(replacement.id)} moves to the Active Spot.`);
}
export function check(G, who, m) {
  if (!G || G.v !== VERSION || ![0, 1].includes(who) || !m || typeof m !== 'object') return fail('Invalid battle action.');
  if (G.phase === 'over') return fail('This match is finished.');
  const p = G.p[who], other = G.p[1 - who];
  if (G.phase === 'setup') {
    if (m.a !== 'setup' || p.ready) return fail('Choose a Base Active player and up to three Base Bench players.');
    if (!base(m.act) || !Array.isArray(m.bench) || m.bench.length > BENCH_MAX || m.bench.some(id => !base(id))) return fail('Opening athletes must be Base Players, with at most three on the Bench.');
    const choices = [m.act, ...m.bench];
    return choices.every(id => count(choices, id) <= count(p.hand, id)) ? yes : fail('That opening card is not in your hand.');
  }
  if (who !== G.who) return fail('Wait for the other manager.');
  if (G.p.some(x => x.promote)) return p.promote && m.a === 'promote' && p.bench.some(s => s.u === m.u) ? yes : fail('Choose a Benched replacement. Promotion costs no Energy.');
  if (G.pending) return G.pending.who === who && m.a === 'choose-switch' && p.bench.some(s => s.u === m.u) ? yes : fail('The affected manager chooses their Benched replacement.');
  const s = find(p, m.on), c = card(m.id);
  switch (m.a) {
    case 'bench': return p.bench.length < BENCH_MAX && p.hand.includes(m.id) && base(m.id) ? yes : fail('Play a Base Player from your hand into an empty Bench slot.');
    case 'energy': return s && p.en && !p.used.energy ? yes : fail('One normal Energy attachment is available each turn, except the first opening turn.');
    case 'evolve': return p.hand.includes(m.id) && developmentOkay(G, who, s, m.id) ? yes : fail('Use the exact predecessor after your first turn; a player cannot develop the turn it enters or twice in one turn.');
    case 'support': {
      if (!c || c.kind === 'player' || !p.hand.includes(m.id)) return fail('Choose a Support Card in your hand.');
      if (c.kind === 'supporter' && p.used.supporter) return fail('You already played your one Supporter this turn.');
      if (c.kind === 'stadium' && (p.used.stadium || card(G.stadium?.id)?.canonicalName === c.canonicalName)) return fail('Play at most one Stadium per turn, with a different name from the current Stadium.');
      if (c.kind === 'tool' && (!s || s.tool)) return fail('Choose one of your athletes without a Tool.');
      switch (effectType(c.effect)) {
        case 'draw': return p.deck.length ? yes : fail('Your draw deck is empty.');
        case 'search-base': return p.deck.some(base) ? yes : fail('No Base Player remains in your deck.');
        case 'heal': return s && s.dmg > 0 ? yes : fail('Choose one of your damaged athletes.');
        case 'fast-track': return p.hand.includes(m.prime) && developmentOkay(G, who, s, m.prime, true) ? yes : fail('Fast Track needs an eligible Base already in play and its matching Prime in your hand.');
        case 'matchup-change': return other.bench.length ? yes : fail('The opponent has no Benched replacement.');
        case 'switch': return p.bench.some(x => x.u === m.on) ? yes : fail('Choose your Benched replacement.');
        case 'max-hp': case 'base-max-hp': return yes;
        default: return fail('This Support Card has no implemented printed effect.');
      }
    }
    case 'retreat': {
      if (!p.active || p.used.retreat || !p.bench.some(x => x.u === m.to)) return fail('Retreat once per turn to one of your Benched athletes.');
      if (p.active.conditions.asleep || p.active.conditions.paralyzed) return fail('An Asleep or Paralyzed athlete cannot normally retreat.');
      return energySelection(p, p.active, m.energy, retreatCost(p.active)) ? yes : fail('Discard attached Energy equal to the retreat cost.');
    }
    case 'attack': {
      if (!Number.isInteger(m.n) || !p.active || !other.active) return fail('Choose an Active athlete attack.');
      const a = card(p.active.id).attacks[m.n];
      if (!a || !canPay(a.cost, p.active.en)) return fail('Attach the printed Energy requirement before attacking.');
      if (p.active.conditions.asleep || p.active.conditions.paralyzed) return fail('This athlete cannot attack while Asleep or Paralyzed.');
      if (a.target === 'bench' && !other.bench.some(x => x.u === m.target)) return fail('Choose an opposing Benched target.');
      if (a.target !== 'bench' && m.target != null && m.target !== other.active.u) return fail('This attack targets the opposing Active athlete.');
      return yes;
    }
    case 'ability': {
      const ability = card(s?.id)?.ability;
      if (!ability || ability.passive || ability.trigger || ability.timing === 'passive') return fail('That athlete has no usable Ability.');
      if (ability.activeOnly && s !== p.active) return fail('This Ability requires the Active Spot.');
      if (ability.oncePerTurn === true && s.abilityTurn === p.turns) return fail('This athlete already used its Ability this turn.');
      if (ability.oncePerTurn === true && ability.scope === 'manager' && p.used['ability:' + ability.name]) return fail('This manager already used that Ability this turn.');
      const effect = ability.effect;
      if (effectType(effect) === 'draw' && !p.deck.length) return fail('Your deck is empty.');
      if (!['draw', 'heal', 'energy'].includes(effectType(effect))) return fail('This Ability has no implemented printed effect.');
      if (effectType(effect) === 'heal' && !s.dmg) return fail('This athlete has no damage to heal.');
      if (effectType(effect) === 'energy' && !ENERGY_TYPES.includes(effect.energy)) return fail('The printed Energy type is unavailable.');
      return yes;
    }
    case 'end': return yes;
    default: return fail('That action is not available now.');
  }
}
function inflict(G, who, s, condition) {
  const value = String(condition).toLowerCase(), c = conditions(s);
  if (['asleep', 'paralyzed', 'confused'].includes(value)) { delete c.asleep; delete c.paralyzed; delete c.paralyzedUntil; delete c.confused; }
  if (['poisoned', 'burned', 'asleep', 'paralyzed', 'confused'].includes(value)) c[value] = true;
  if (value === 'paralyzed') c.paralyzedUntil = G.p[who].turns + 1;
  event(G, 'condition', who, {id: s.id, condition: value}, `${nameOf(s.id)} is ${value}.`);
}
function attackDamage(G, who, a, target) {
  let value = damageOf(a); const source = G.p[who].active;
  if (value > 0 && target === G.p[1 - who].active && typesOf(card(source.id)).includes(weaknessOf(card(target.id)))) value += 20;
  if (target.shield && G.turn <= target.shield.untilTurn) value -= target.shield.amount;
  return Math.max(0, value);
}
function runEffect(G, who, effect, source, target) {
  if (!effect) return;
  if (Array.isArray(effect)) { effect.forEach(e => runEffect(G, who, e, source, target)); return; }
  const p = G.p[who], enemy = G.p[1 - who];
  switch (effectType(effect)) {
    case 'draw': draw(G, who, effect.count || 1); break;
    case 'heal': source.dmg = Math.max(0, source.dmg - (effect.amount || 0)); break;
    case 'condition': if (target === enemy.active) inflict(G, 1 - who, target, effect.condition); break;
    case 'discard-energy': {
      const s = effect.target === 'self' ? source : target, owner = effect.target === 'self' ? p : enemy;
      owner.discardedEnergy.push(...s.en.splice(0, effect.count || 1)); break;
    }
    case 'energy': source.en.push(...Array.from({length: effect.count || 1}, () => effect.energy)); break;
    case 'shield': source.shield = {amount: effect.amount, untilTurn: G.turn + 1}; break;
    case 'bench-damage': enemy.bench.forEach(s => { s.dmg += effect.amount; }); break;
    case 'coin': if (flip(G, who, effect.name || 'Attack effect')) runEffect(G, who, effect.heads, source, target); else runEffect(G, who, effect.tails, source, target); break;
    case 'damage': target.dmg += effect.amount || 0; break;
    default: break;
  }
}
export function attackPreview(G, who, n, target = null) {
  const p = G.p[who], a = card(p.active?.id)?.attacks?.[n], defender = target ? find(G.p[1 - who], target) : G.p[1 - who].active;
  if (!a || !defender) return {damage: 0, legal: false, why: 'No attack target.'};
  const legal = check(G, who, {a: 'attack', n, ...(target ? {target} : {})});
  return {damage: attackDamage(G, who, a, defender), legal: legal.ok, why: legal.why};
}
export function apply(G, who, m) {
  const legal = check(G, who, m); if (!legal.ok) return legal;
  const p = G.p[who], other = G.p[1 - who];
  if (m.a === 'setup') {
    removeHand(p, m.act); p.active = slot(G, m.act, who);
    for (const id of m.bench) { removeHand(p, id); p.bench.push(slot(G, id, who)); }
    p.ready = true; p.set = true; event(G, 'setup', who, {id: m.act, bench: m.bench.slice()}, `Manager ${who + 1} chose an Active athlete and ${m.bench.length} Benched athlete${m.bench.length === 1 ? '' : 's'}.`);
    if (G.p.every(x => x.ready)) { G.phase = 'play'; beginTurn(G, G.first); }
    else G.who = 1 - who;
    return yes;
  }
  if (m.a === 'promote') {
    const index = p.bench.findIndex(s => s.u === m.u); p.active = p.bench.splice(index, 1)[0]; p.promote = false;
    event(G, 'promote', who, {id: p.active.id}, `${nameOf(p.active.id)} is promoted for free.`); settle(G); return yes;
  }
  if (m.a === 'choose-switch') { switchTo(G, who, m.u); G.who = G.pending.resumeWho; G.pending = null; settle(G); return yes; }
  const s = find(p, m.on), c = card(m.id);
  switch (m.a) {
    case 'bench': removeHand(p, m.id); p.bench.push(slot(G, m.id, who)); event(G, 'bench', who, {id: m.id}, `${nameOf(m.id)} joins the Bench.`); break;
    case 'energy': s.en.push(p.en); p.used.energy = true; event(G, 'energy', who, {id: s.id, energy: p.en}, `${nameOf(s.id)} receives ${p.en} Energy.`); p.en = null; break;
    case 'evolve': evolve(G, who, s, m.id); break;
    case 'support': {
      removeHand(p, m.id);
      if (c.kind === 'supporter') p.used.supporter = true;
      if (c.kind === 'tool') s.tool = m.id;
      else if (c.kind === 'stadium') {
        p.used.stadium = true;
        if (G.stadium) G.p[G.stadium.who].discard.push(G.stadium.id);
        G.stadium = {id: m.id, who};
      } else p.discard.push(m.id);
      event(G, 'support', who, {id: m.id}, `Manager ${who + 1} plays ${nameOf(m.id)}.`);
      switch (effectType(c.effect)) {
        case 'draw': draw(G, who, c.effect.count); break;
        case 'search-base': {
          const indexes = p.deck.map((id, i) => base(id) ? i : -1).filter(i => i >= 0), index = indexes[Math.floor(random(G) * indexes.length)];
          const id = p.deck.splice(index, 1)[0]; p.hand.push(id); event(G, 'search', who, {id}, `Manager ${who + 1} found a random Base Player.`); break;
        }
        case 'heal': s.dmg = Math.max(0, s.dmg - c.effect.amount); break;
        case 'fast-track': evolve(G, who, s, m.prime); break;
        case 'matchup-change': G.pending = {kind: 'switch', who: 1 - who, resumeWho: who}; G.who = 1 - who; break;
        case 'switch': switchTo(G, who, m.on); break;
        default: break;
      }
      break;
    }
    case 'retreat': {
      const selected = energySelection(p, p.active, m.energy, retreatCost(p.active));
      selected.sort((a, b) => b - a).forEach(index => p.discardedEnergy.push(p.active.en.splice(index, 1)[0]));
      p.used.retreat = true; switchTo(G, who, m.to); break;
    }
    case 'ability': {
      const ability = card(s.id).ability; s.abilityTurn = p.turns; p.used['ability:' + ability.name] = true;
      event(G, 'ability', who, {id: s.id, name: ability.name}, `${nameOf(s.id)} uses ${ability.name}.`);
      runEffect(G, who, ability.effect, s, other.active); break;
    }
    case 'attack': {
      const source = p.active, a = card(source.id).attacks[m.n], target = a.target === 'bench' ? find(other, m.target) : other.active;
      if (source.conditions.confused && !flip(G, who, 'Confusion')) { event(G, 'attack-failed', who, {id: source.id}, 'Confusion: the attack fails and the turn ends. No self-damage.'); endTurn(G, who); return yes; }
      const amount = attackDamage(G, who, a, target); target.dmg += amount;
      event(G, 'attack', who, {id: source.id, target: target.id, name: a.name, damage: amount}, `${nameOf(source.id)} uses ${a.name} for ${amount} damage.`);
      runEffect(G, who, a.effect, source, target);
      endTurn(G, who); return yes;
    }
    case 'end': event(G, 'end', who, {}, `Manager ${who + 1} ends the turn.`); endTurn(G, who); return yes;
  }
  settle(G); return yes;
}
export function replay(seed, decks, log, options = {}) {
  const G = newGame(seed, decks, options);
  for (const entry of log || []) {
    const who = Array.isArray(entry) ? entry[0] : entry.who, move = Array.isArray(entry) ? entry[1] : entry.move;
    const result = apply(G, who, move); if (!result.ok) { G.bad = result.why; break; }
  }
  return G;
}
/** UI and AI use the engine's legality; disabled buttons alone never enforce a rule. */
export function legalActions(G, who = G.who) {
  if (!G || G.phase === 'over' || !G.p[who]) return [];
  const p = G.p[who];
  if (G.phase === 'setup') {
    if (p.ready) return [];
    return [...new Set(p.hand.filter(base))].map(id => ({a: 'setup', act: id, bench: []})).filter(m => check(G, who, m).ok);
  }
  const candidates = [{a: 'end'}], all = slots(p);
  p.bench.forEach(s => candidates.push({a: 'promote', u: s.u}, {a: 'choose-switch', u: s.u}, {a: 'retreat', to: s.u}));
  all.forEach(s => candidates.push({a: 'energy', on: s.u}, {a: 'ability', on: s.u}));
  for (const id of new Set(p.hand)) {
    candidates.push({a: 'bench', id}, {a: 'support', id});
    for (const s of all) {
      candidates.push({a: 'evolve', id, on: s.u}, {a: 'support', id, on: s.u});
      if (effectType(card(id)?.effect) === 'fast-track') for (const prime of new Set(p.hand)) if (card(prime)?.stage === 'Prime') candidates.push({a: 'support', id, on: s.u, prime});
    }
  }
  card(p.active?.id)?.attacks.forEach((a, n) => {
    if (a.target === 'bench') G.p[1 - who].bench.forEach(s => candidates.push({a: 'attack', n, target: s.u}));
    else candidates.push({a: 'attack', n});
  });
  return candidates.filter(m => check(G, who, m).ok);
}
export function nextMove(G, who = G.who, level = 15) {
  const p = G.p[who], actions = legalActions(G, who);
  if (!actions.length) return null;
  if (G.phase === 'setup') {
    const basics = p.hand.filter(base).sort((a, b) => card(a).attacks[0].cost.length - card(b).attacks[0].cost.length || card(b).hp - card(a).hp);
    return {a: 'setup', act: basics[0], bench: basics.slice(1, 4)};
  }
  const first = a => actions.find(m => m.a === a);
  if (p.promote || G.pending) {
    return actions.slice().sort((a, b) => { const x = find(p, a.u), y = find(p, b.u); return (y?.en.length || 0) * 30 + (y ? hpOf(G, y) - y.dmg : 0) - (x?.en.length || 0) * 30 - (x ? hpOf(G, x) - x.dmg : 0); })[0];
  }
  const support = effect => actions.find(m => m.a === 'support' && effectType(card(m.id).effect) === effect);
  const drawAction = support('draw') || support('search-base'); if (drawAction) return drawAction;
  if (first('bench')) return first('bench');
  if (first('evolve')) return first('evolve');
  if (support('fast-track')) return support('fast-track');
  if (support('max-hp')) return support('max-hp');
  if (support('heal')) return support('heal');
  if (support('base-max-hp')) return support('base-max-hp');
  if (first('ability')) return first('ability');
  const energyMoves = actions.filter(m => m.a === 'energy');
  if (energyMoves.length) {
    const need = s => !card(s.id).attacks.some(a => canPay(a.cost, s.en));
    const target = need(p.active) ? p.active : p.bench.find(need) || slots(p).find(s => !card(s.id).attacks.every(a => canPay(a.cost, s.en))) || p.active;
    return energyMoves.find(m => m.on === target.u) || energyMoves[0];
  }
  const attacks = actions.filter(m => m.a === 'attack').sort((a, b) => attackPreview(G, who, b.n, b.target).damage - attackPreview(G, who, a.n, a.target).damage);
  if (attacks.length) return attacks[0];
  if (Number(level) >= 16) {
    const retreat = actions.find(m => m.a === 'retreat' && card(find(p, m.to).id).attacks.some(a => canPay(a.cost, find(p, m.to).en)));
    if (retreat) return retreat;
  }
  return first('end') || actions[0];
}
