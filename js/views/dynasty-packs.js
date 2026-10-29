// Gridiron Dynasty's booster packs (views/dynasty.js shows them, views/dynasty-open.js opens them): Pocket's foil packs:
// the brand bar across the top (where it tears), the pack's art full-bleed behind it, its name in a plate below.
// Each pack comes in several artworks, swiped through on the Packs home as in Pocket, more detailed the rarer the pack
// (the owner, Oct 29 2026: "Add more art designs to the packs. The more rare the pack, the more detailed the art design
// should be"): the designs are drawn in views/dynasty-art-<kind>.js, and the frame round them grows with the pack's TIER
// (foil sheen; crimped seals and an embossed quilt; a holo rainbow; a light sweep and sparkles; gold filigree and gold
// lettering). css/views/dynasty-packs.css dresses them.
//
// An art module: `export default [{id: '<kind>-<slug>', name: 'For screen readers', svg: (u, k) => '<svg markup>'}]`.
//   svg's markup goes inside <svg viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice">, the whole pack face
//   (exactly 5:8): paint the ground full-bleed (0..100 x 0..160) and keep the subject in the safe area x 8..92,
//   y 24..122 (the brand bar covers y 0..21, the name plate y ~125..160, darkened behind its words).
//   u: this pack's own id prefix ('pa7_'): every id is `${u}name`, referenced as url(#${u}name) (the same pack can be on
//   the page five times at once; names starting _ are the frame's and the kit's). k: helpers (kit below): k.tier, k.pc/k.pl/k.pd (the pack's colour, light, dark),
//   k.burst(), k.glow(), k.fan(), k.emblem(), k.star(). Classes on any SVG element: .pa-fine (dropped below 120px
//   wide), .pa-small (only below 120px), and gentle motion .pa-twinkle .pa-pulse .pa-float .pa-drift .pa-rise .pa-spin
//   .pa-sweep (style="--d:.6s" staggers, "--t:5s" retimes; only on a big pack, never under reduced motion).
//   Budgets (SVG elements a design): tier 1 30, 2 55, 3 90, 4 150, 5 240; no SVG filters below tier 4 (one cheap one
//   at 4 and 5); preview with node tools/dynasty/check-open.cjs --gallery --only <kind> --tile 180 --out <dir>.
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import START from './dynasty-art-start.js';
import STD from './dynasty-art-std.js';
import TEAM from './dynasty-art-team.js';
import PREM from './dynasty-art-prem.js';
import GDAY from './dynasty-art-gday.js';
import LEG from './dynasty-art-leg.js';

const esc = data.esc;
/** How much each pack's art and frame carry: 1 (Starter, Standard) to 5 (Legends), by rarity and price. */
export const TIER = {start: 1, std: 1, team: 2, prem: 3, gday: 4, leg: 5};
const ART = {start: START, std: STD, team: TEAM, prem: PREM, gday: GDAY, leg: LEG};
// Each pack's emblem (a 100 x 100 drawing, white): the designs' fallback and the placeholders' subject (k.emblem).
const PACK_ART = {
  std: '<ellipse cx="50" cy="50" rx="30" ry="18" transform="rotate(-35 50 50)" fill="#7B4A26"/><path d="M38 55l24-14M43 52.5l-2.5-4M47.5 50l-2.5-4M52 47.5l-2.5-4M56.5 45l-2.5-4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  team: '<path d="M24 58c0-18 12-30 28-30 14 0 24 9 24 22v8H62v10H40l-6-10z" fill="#fff"/><path d="M62 50h16M56 58h20" stroke="rgba(0,0,0,.35)" stroke-width="3"/><circle cx="46" cy="44" r="4" fill="rgba(0,0,0,.3)"/>',
  prem: '<path d="M50 18l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2z" fill="#fff"/>',
  gday: '<path d="M20 70h60M30 70V36M70 70V36" stroke="#fff" stroke-width="4"/><rect x="22" y="22" width="16" height="12" rx="2" fill="#fff"/><rect x="62" y="22" width="16" height="12" rx="2" fill="#fff"/><path d="M38 28l14 22M62 28L48 50" stroke="rgba(255,255,255,.55)" stroke-width="6"/>',
  leg: '<path d="M22 64l-4-30 16 12 16-22 16 22 16-12-4 30z" fill="#fff"/><path d="M22 70h56" stroke="#fff" stroke-width="5"/>',
  start: '<path d="M50 16l26 10v20c0 18-11 30-26 38-15-8-26-20-26-38V26z" fill="#fff"/><path d="M50 30v36M38 42l12-12 12 12" stroke="rgba(0,0,0,.35)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
};
// (a hex colour toward another: t 0..1)
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('');
const f1 = n => +n.toFixed(1);
/** The helpers a design's svg(u, k) gets. Each returns SVG markup (k.star a path's d), centred on the art's middle
 *  (50, 74) unless told otherwise. */
function kit(kind, u) {
  const pc = D.PACKS[kind].color;
  let n = 0;
  const k = {
    kind, tier: TIER[kind] || 1, pc, pl: mix(pc, '#ffffff', .55), pd: mix(pc, '#000000', .35),
    /** n-pointed star's path d: outer radius r, inner ir (a fraction of r). */
    star: (cx, cy, r, pts = 5, ir = .45) => 'M' + Array.from({length: pts * 2}, (_, i) => {
      const a = Math.PI * i / pts - Math.PI / 2, q = i % 2 ? r * ir : r;
      return `${f1(cx + q * Math.cos(a))} ${f1(cy + q * Math.sin(a))}`;
    }).join('L') + 'Z',
    /** Rays of light (one path): n rays out to r, each `w` of its share of the turn. 1 element. */
    burst: ({cx = 50, cy = 74, n: rays = 20, r = 130, w = .4, a = .16, c = '#fff', cls = ''} = {}) => `<path${cls ? ` class="${cls}"` : ''} fill="${c}" opacity="${a}" d="${Array.from({length: rays}, (_, i) => {
      const a0 = 2 * Math.PI * i / rays, a1 = a0 + 2 * Math.PI * w / rays;
      return `M${cx} ${cy}L${f1(cx + r * Math.cos(a0))} ${f1(cy + r * Math.sin(a0))}L${f1(cx + r * Math.cos(a1))} ${f1(cy + r * Math.sin(a1))}Z`;
    }).join('')}"/>`,
    /** A soft round glow (a radial gradient fading out). 4 elements. */
    glow: ({cx = 50, cy = 74, r = 40, c = '#fff', a = .8, cls = ''} = {}) => {
      const id = `${u}_${n++}`;
      return `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
        + `<circle${cls ? ` class="${cls}"` : ''} cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;
    },
    /** The fan of three glassy cards the emblem stood on (s: scale, 1 = 34 wide). 7 elements. */
    fan: ({x = 50, y = 72, s = 1} = {}) => {
      const id = `${u}_${n++}`, card = t => `<rect x="-17" y="-24" width="34" height="47.5" rx="2.2" transform="${t}"/>`;
      return `<linearGradient id="${id}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></linearGradient>`
        + `<g transform="translate(${x} ${y}) scale(${s})" fill="url(#${id})" stroke="#fff" stroke-opacity=".4" stroke-width=".8">${card('rotate(-18 0 28.25) translate(-10 0)')}${card('translate(0 -4)')}${card('rotate(18 0 28.25) translate(10 0)')}</g>`;
    },
    /** The pack's emblem (white), with a soft offset shadow: s 1 = 100 units (the old art's 62 wide is s .62). 4 to 10
     *  elements (half without the shadow). */
    emblem: ({x = 50, y = 74, s = .62, shadow = true} = {}) => {
      const t = `translate(${f1(x - 50 * s)} ${f1(y - 50 * s)}) scale(${s})`, m = PACK_ART[kind] || '';
      return (shadow ? `<g transform="translate(0 ${f1(2.2 * s)}) ${t}" opacity=".28">${m.replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="#000"')}</g>` : '') + `<g transform="${t}">${m}</g>`;
    }
  };
  return k;
}
// (the last resort: the pack's emblem in its light, as the packs looked before the designs)
const plain = (u, k) => `<radialGradient id="${u}bg" cx="50%" cy="46%" r="70%"><stop offset="0" stop-color="${k.pl}"/><stop offset=".55" stop-color="${k.pc}"/><stop offset="1" stop-color="${k.pd}"/></radialGradient>`
  + `<rect width="100" height="160" fill="url(#${u}bg)"/>${k.burst()}${k.fan()}${k.emblem()}`;
/** A pack's art designs: [{id, name, svg}] (the art module's, or the plain emblem). */
export function designsOf(kind) {
  const a = (Array.isArray(ART[kind]) ? ART[kind] : []).filter(d => d && typeof d.svg === 'function' && d.id);
  return a.length ? a : [{id: kind, name: D.PACKS[kind] ? D.PACKS[kind].name : kind, svg: plain}];
}
let uid = 0;
// (one bad design never breaks the page: the pack's first design, else its emblem)
function artOf(kind, d, list, u, k) {
  for (const f of [d.svg, list[0].svg, plain]) { try { const s = f(u, k); if (typeof s === 'string' && s) return s; } catch (_) {} }
  return '';
}
// The frame's tier-5 gold filigree round the art's window (between the brand bar and the foot's seal, y 22..152): a
// double rule, scrolled corners (one drawn, mirrored), lozenges at the sides, top and foot.
const filigree = u => `<linearGradient id="${u}_fg" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="100" y2="160"><stop offset="0" stop-color="#FFF4C2"/>`
  + `<stop offset=".22" stop-color="#E9BD48"/><stop offset=".48" stop-color="#9A6A10"/><stop offset=".7" stop-color="#F6D978"/><stop offset="1" stop-color="#A8780F"/></linearGradient>`
  + `<defs><g id="${u}_fc" fill="none" stroke="url(#${u}_fg)" stroke-linecap="round"><path d="M4.6 24C4.6 12 12 4.6 24 4.6" stroke-width="1"/>`
  + `<path class="pa-fine" d="M24 4.6c3.4 0 5 2.4 3.8 4.2-.9 1.3-3.1.9-3-.8M4.6 24c0 3.4 2.4 5 4.2 3.8 1.3-.9.9-3.1-.8-3M8.4 17.5c1.2-4.6 4.6-8 9.1-9.1" stroke-width=".5"/>`
  + `<path d="M2.4 2.4l6.4 2.2-2.2 2-2 2.2z" fill="url(#${u}_fg)" stroke="none"/><circle class="pa-fine" cx="11" cy="11" r="1.2" fill="url(#${u}_fg)" stroke="none"/></g></defs>`
  + `<g fill="none" stroke="url(#${u}_fg)"><rect x="2.4" y="22.4" width="95.2" height="129.2" rx="2.4" stroke-width="1.2"/><rect class="pa-fine" x="4.6" y="24.6" width="90.8" height="124.8" rx="1.4" stroke-width=".4"/></g>`
  + `<use href="#${u}_fc" transform="translate(0 20)"/><use href="#${u}_fc" transform="matrix(-1 0 0 1 100 20)"/><use href="#${u}_fc" transform="matrix(1 0 0 -1 0 154)"/><use href="#${u}_fc" transform="matrix(-1 0 0 -1 100 154)"/>`
  + `<path fill="url(#${u}_fg)" d="M2.4 80.5l2.2 6.5-2.2 6.5-2.2-6.5zM97.6 80.5l2.2 6.5-2.2 6.5-2.2-6.5zM50 19.6l4.4 2.8-4.4 2.8-4.4-2.8zM50 148.8l4.4 2.8-4.4 2.8-4.4-2.8z"/>`;
// (the frame's sparkles, clear of the art's middle: x, y in % of the pack, size in cqw, delay)
const SPARKS = [[13, 25, 9, 0], [86, 33, 7, 1.1], [11, 66, 6, 1.9], [89, 70, 8, .6], [24, 17.5, 5, 2.4], [77, 50, 5, 1.5], [20, 46, 4, .3]];
/** A booster pack (kind: a core/dynasty.js PACKS key). o: {count (held, shown past 1), big, design (designsOf's index,
 *  wrapped)}. */
export function packHTML(kind, {count, big, design = 0} = {}) {
  const P = D.PACKS[kind], t = TIER[kind] || 1, list = designsOf(kind), n = list.length;
  const d = list[((Math.floor(+design) || 0) % n + n) % n], u = `pa${(++uid).toString(36)}_`;
  const name = esc(P.name.replace(' Pack', '').toUpperCase());
  return `<span class="pk-pack${big ? ' is-big' : ''} k-${kind} tier-${t}" style="--pc:${P.color}" data-art="${esc(d.id)}" aria-hidden="true">`
    + `<span class="pk-pack-art"><svg viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice" focusable="false">${artOf(kind, d, list, u, kit(kind, u))}</svg></span>`
    + (t >= 2 ? '<span class="pk-pack-emboss"></span>' : '') + (t >= 3 ? '<span class="pk-pack-holo"></span>' : '')
    + `<span class="pk-pack-top"><i class="pk-pack-ball"></i><b>GRIDIRON<small>DYNASTY</small></b><em>GD1</em></span>`
    + `<span class="pk-pack-name"><small>${kind === 'leg' ? 'DELUXE PACK' : 'BOOSTER PACK'}</small><b><span>${name}</span></b></span>`
    + `<span class="pk-pack-foil"></span>`
    + (t >= 4 ? `<span class="pk-pack-sweep"></span><span class="pk-pack-spark">${SPARKS.slice(0, t >= 5 ? 7 : 4).map(([x, y, s, dl]) => `<i style="--x:${x}%;--y:${y}%;--s:${s}cqw;--d:${dl}s"></i>`).join('')}</span>` : '')
    + (t >= 5 ? `<svg class="pk-pack-frame" viewBox="0 0 100 160" preserveAspectRatio="none" focusable="false">${filigree(u)}</svg>` : '')
    + `<span class="pk-pack-crimp"></span>${count > 1 ? `<span class="pk-pack-n">×${count}</span>` : ''}</span>`;
}
