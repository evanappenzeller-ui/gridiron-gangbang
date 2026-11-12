// November 2026 owner pack designs. Neutral wrappers and the Common card's printed framing.
// Only live non-Epic packs use these; dynasty-packs.js applies the existing profile gate.
import {ball} from './dynasty-art-foil.js';
export const PRINTED_VIEW = '0 0 86 72';

const basic = (paper, shade, turn = -14) => u =>
  `<defs><linearGradient id="${u}paper" x2="0" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="${shade}"/></linearGradient></defs>`
  + `<rect width="86" height="72" fill="url(#${u}paper)"/>`
  + '<rect x="3" y="3" width="80" height="66" rx="1" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".5"/>'
  + '<ellipse cx="43" cy="59" rx="21" ry="2.5" fill="#142638" opacity=".1"/>'
  + ball(43, 34, 51, turn);

const club = (light, dark, accent, crest, turn = -14) => u =>
  `<linearGradient id="${u}club" x2=".7" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`
  + `<rect width="86" height="72" fill="url(#${u}club)"/>`
  + `<path d="M0 0h20v72H0zM66 0h20v72H66z" fill="${accent}" opacity=".1"/>`
  + '<g fill="none" stroke="#fff" stroke-width=".6" opacity=".22">'
  + '<path d="M8 12h70M8 24h70M8 36h70M8 48h70M8 60h70M20 5v62M66 5v62"/>'
  + '<path d="M38 12h10M38 24h10M38 48h10M38 60h10" stroke-width="2"/></g>'
  + `<path d="${crest}" fill="${dark}" stroke="${accent}" stroke-width="1.3"/>`
  + `<path d="M29 19h28M32 55h22" fill="none" stroke="${accent}" stroke-width=".6"/>`
  + '<ellipse cx="43" cy="55" rx="21" ry="2.5" fill="#000" opacity=".18"/>'
  + ball(43, 35, 47, turn)
  + `<g fill="${accent}"><path d="M43 10l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z"/>`
  + '<circle cx="37" cy="61" r=".8"/><circle cx="43" cy="61" r=".8"/><circle cx="49" cy="61" r=".8"/></g>';

const shield = 'M43 5l28 7v25c0 14-13 24-28 30C28 61 15 51 15 37V12z';
const diamond = 'M43 4L76 36 43 68 10 36z';

export const PRINTED = {
  std: [
    {id: 'std-classic-v2', name: 'Classic: cream card stock with a plain football', svg: basic('#eeeae0', '#d8d6ce')},
    {id: 'std-silver-v2', name: 'Silver: a plain football on soft gray', svg: basic('#e5e8e8', '#b9c1c3', 10)},
    {id: 'std-paper-v2', name: 'Paper: an ivory card with a plain football', svg: basic('#f7f5ef', '#e7e2d8', -5)},
    {id: 'std-slate-v2', name: 'Slate: a plain football on charcoal', svg: basic('#68767b', '#36444b', 14)}
  ],
  team: [
    {id: 'team-home-v2', name: 'Home field: an emerald club crest with silver trim', svg: club('#28604f', '#102f2b', '#d8e3d5', shield)},
    {id: 'team-away-v2', name: 'Away field: a navy club crest with silver trim', paper: '#132b42', svg: club('#365d7a', '#132b42', '#d9e5eb', shield, 12)},
    {id: 'team-captain-v2', name: 'Captain: a burgundy diamond with brass trim', paper: '#3c202b', svg: club('#78434a', '#3c202b', '#e1c391', diamond, -8)},
    {id: 'team-night-v2', name: 'Night game: a charcoal diamond with ice blue trim', paper: '#182730', svg: club('#3d535e', '#182730', '#b4d6df', diamond, 8)}
  ],
  start: [
    {id: 'start-classic-v2', name: 'First squad: a clean cream starter pack', svg: basic('#e9e7dd', '#cdd2c8')},
    {id: 'start-paper-v2', name: 'First squad: a clean ivory starter pack', svg: basic('#f6f3e9', '#ddd9cd', 10)},
    {id: 'start-silver-v2', name: 'First squad: a clean silver starter pack', svg: basic('#e2e7e4', '#bdc8c4', -5)}
  ]
};
