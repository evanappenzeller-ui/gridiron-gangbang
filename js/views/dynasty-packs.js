// Gridiron Dynasty's booster packs (views/dynasty.js shows them, views/dynasty-open.js opens them): Pocket's foil packs:
// the brand bar across the top (where it tears), the pack's art (its emblem in a burst of light, a fan of cards behind),
// its name in a plate below. css/views/dynasty-packs.css dresses them.
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';

const esc = data.esc;
const PACK_ART = {
  std: '<ellipse cx="50" cy="50" rx="30" ry="18" transform="rotate(-35 50 50)" fill="#7B4A26"/><path d="M38 55l24-14M43 52.5l-2.5-4M47.5 50l-2.5-4M52 47.5l-2.5-4M56.5 45l-2.5-4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  team: '<path d="M24 58c0-18 12-30 28-30 14 0 24 9 24 22v8H62v10H40l-6-10z" fill="#fff"/><path d="M62 50h16M56 58h20" stroke="rgba(0,0,0,.35)" stroke-width="3"/><circle cx="46" cy="44" r="4" fill="rgba(0,0,0,.3)"/>',
  prem: '<path d="M50 18l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2z" fill="#fff"/>',
  gday: '<path d="M20 70h60M30 70V36M70 70V36" stroke="#fff" stroke-width="4"/><rect x="22" y="22" width="16" height="12" rx="2" fill="#fff"/><rect x="62" y="22" width="16" height="12" rx="2" fill="#fff"/><path d="M38 28l14 22M62 28L48 50" stroke="rgba(255,255,255,.55)" stroke-width="6"/>',
  leg: '<path d="M22 64l-4-30 16 12 16-22 16 22 16-12-4 30z" fill="#fff"/><path d="M22 70h56" stroke="#fff" stroke-width="5"/>',
  start: '<path d="M50 16l26 10v20c0 18-11 30-26 38-15-8-26-20-26-38V26z" fill="#fff"/><path d="M50 30v36M38 42l12-12 12 12" stroke="rgba(0,0,0,.35)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
};
/** A pack's art designs: [{id, name}] (one for now). */
export const designsOf = kind => [{id: kind, name: D.PACKS[kind] ? D.PACKS[kind].name : kind}];
/** A booster pack (kind: a core/dynasty.js PACKS key). o: {count (held, shown past 1), big, design (designsOf's index)}. */
export function packHTML(kind, {count, big, design = 0} = {}) {
  const P = D.PACKS[kind];
  return `<span class="pk-pack${big ? ' is-big' : ''} k-${kind}" style="--pc:${P.color}" aria-hidden="true">`
    + `<span class="pk-pack-top"><i class="pk-pack-ball"></i><b>GRIDIRON<small>DYNASTY</small></b><em>GD1</em></span>`
    + `<span class="pk-pack-art"><span class="pk-pack-fan"><i></i><i></i><i></i></span><svg viewBox="0 0 100 100">${PACK_ART[kind] || ''}</svg></span>`
    + `<span class="pk-pack-name"><small>${kind === 'leg' ? 'DELUXE PACK' : 'BOOSTER PACK'}</small><b>${esc(P.name.replace(' Pack', '').toUpperCase())}</b></span>`
    + `<span class="pk-pack-foil"></span><span class="pk-pack-crimp"></span>${count > 1 ? `<span class="pk-pack-n">×${count}</span>` : ''}</span>`;
}
