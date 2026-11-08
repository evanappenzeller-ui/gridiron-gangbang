// Read-only pack headliners. Keep the preview in the same canonical player pool as drawCard:
// 'live' includes each active player's best card of any series; 'all' adds series weighting,
// but neither pool contains Legends. These are possible pulls, never a promised pack.
import * as D from '../core/dynasty.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Highest-rated distinct players available in an active pack; team is optional until checkout. */
export function packTopPlayers(kind, {team = null, limit = 4} = {}) {
  const pack = D.PACKS[kind];
  if (!pack || pack.retired || (pack.team && team && !D.TEAMS[team])) return [];
  const slots = pack.slots.filter(slot => slot.n > 0 && ['live', 'all'].includes(slot.pool));
  const players = D.CARDS.filter(c => c.s !== 'X' && (!pack.team || !team || c.team === team)
    && slots.some(slot => slot.odds[c.r] > 0));
  players.sort((a, b) => b.o - a.o || compare(a.name, b.name) || compare(a.id, b.id));
  const seen = new Set();
  return players.filter(c => {
    const key = c.p || c.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(0, Math.floor(Number(limit) || 0)));
}
