// The battle uses the same printed faces as the collection. Only the versioned
// battle definition changes for rentals and development; source artwork is kept.
import * as D from '../core/dynasty.js';
import * as C from '../core/dynasty-pocket-cards.js';
import {cardHTML, trainerHTML} from './dynasty.js';

export function printedCard(id) {
  const c = C.card(id);
  if (!c) return '';
  const options = {tag:false, size:'m', rulesVersion:7, pocketCard:c, eager:true};
  if (c.kind !== 'player') {
    const support = {id:c.id, name:c.name, r:c.rarity || 'common',
      kind:c.kind === 'supporter' ? 'coach' : c.kind === 'stadium' ? 'stadium' : 'item'};
    return trainerHTML(support, options);
  }
  const source = D.card(c.sourceId || c.id);
  const artwork = source || {id:c.id, name:c.athlete || c.name, pos:c.position,
    team:c.team || '', num:c.number || c.position, s:'L', r:c.rarity || 'common', head:''};
  return cardHTML(artwork, options);
}
