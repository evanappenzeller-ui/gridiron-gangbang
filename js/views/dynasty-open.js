// Opening a Gridiron Dynasty booster pack, over everything (views/dynasty.js openPack calls openScene once the pack's
// cards are drawn and kept), played as Pokémon TCG Pocket plays it (the owner, Oct 29 2026, with a recording of Pocket's:
// "Opening packs should have this animation"). You rip it open with a swipe across its top (Oct 28 2026: "ripping it
// open by swiping across", with "a subtle hint showing players how to do this": a fingertip gliding along the tear line
// till you start), the strip tearing under your finger as it goes (Oct 29 2026: "The pack should split as I drag my finger
// across": the torn part lifts behind the finger, the rest lies flat ahead of it; short of far enough it springs back;
// Enter rips it too). Then a
// flash along the tear, the strip spun away, rainbow light out of the pack; the pack sinks and the first card rises out of
// it. The cards are a stack, the best last: swipe the top one away (or tap) for the next. Each card is revealed by its
// rarity as it comes to the top (the owner, Oct 29 2026: "Each player rarity should get a different animation when being
// opened in a pack. The more rare the player, the more exciting the animation"; revealOf, REVEAL): a Common is dealt
// face up; a Rare comes face down (Pocket's card back, the front hidden till the back has turned edge-on: nothing of the
// player shows before the reveal, Oct 29 2026) and flips; an Epic hovers, a ring pulses and it flips with sparks
// and its stamp; a Legendary turns the ground gold with rays behind it, flashes as it flips, sparks, confetti; a Mythic ★
// turns it purple, drums (shakes harder and harder) before the flip, a rainbow sweep after; a ★★ (Prime, Gameday, Award)
// turns it blue, drums longer and flips in two rings; a Legend ♛ darkens the ground, a crown drops in, the card rises from
// the foot, drums hardest, flips in the biggest flash, gold sparks and two bursts of confetti; from Epic up a star glints
// at its corner after, and its stamp lands on the card's foot (clear of its numbers). A tap while a reveal plays finishes
// it; the next moves on. The top card tilts under your finger, a rare one's foil catching the light (still, it lies flat:
// its face stays sharp). Then the lot, new ones marked. Reduced motion: each card simply face up, its ground and stamp.
// Around it, as Pocket's own (the owner, Oct 30 2026, three recordings: "This is how opening a pack should look"): Open
// brings a ring of the packs in, sweeping round from above with a far ring on the horizon and the floor's reflection;
// swipe to turn it, tap the one in front: it spins once, its back shown, and comes up big for the rip. Under each card its
// rarity's marks pop in one by one. The results are Pocket's Opening Results (each card's copies held under it, the pack
// points, Next); Next gathers the cards into a pile and the grand total of cards counts up; then, with new ones, "Swipe up
// on the cards to register them into the card dex": each new card lands in its numbered slot of its series' dex (the
// Trainer cards' their own), the count going up. ⏭ or a tap there finishes it.
// css/views/dynasty-open.css dresses it.
import * as ui from '../core/ui.js';
import * as D from '../core/dynasty.js';
import {packHTML} from './dynasty-packs.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 4-point sparkles, spread by the golden ratio (the same each time); f(a, b, i) gives each its style
const sparkles = (n, f) => Array.from({length: n}, (_, i) => `<i class="dy-spk" style="${f((i * .618034 + .11) % 1, (i * .414214 + .37) % 1, i)}"></i>`).join('');
// the light out of a torn pack: a fan of rainbow rays
const RAYS = [-30, -23, -16, -10, -4, 2, 8, 14, 20, 26, 33].map((a, i) => `<i style="--a:${a}deg;--h:${[320, 18, 46, 62, 140, 178, 200, 228, 262, 292, 335][i]};--d:-${(i * .37 % 1).toFixed(2)}s"></i>`).join('');
const MOTES = sparkles(16, (a, b, i) => `--x:${(8 + a * 84).toFixed(1)}%;--w:${((b - .5) * 70).toFixed(0)}px;--s:${(8 + b * 12).toFixed(0)}px;--d:${(.08 + (i % 8) * .07).toFixed(2)}s;--t:${(.9 + a * .5).toFixed(2)}s`);
const DRIFT = sparkles(18, (a, b, i) => `--x:${(a * 100).toFixed(1)}%;--y:${(30 + b * 70).toFixed(1)}%;--s:${(7 + (i % 5) * 3)}px;--d:-${(i * .9 % 7).toFixed(1)}s;--t:${(6 + b * 5).toFixed(1)}s`);
// One reverse for every card: a cobalt vortex, a silver football crest and the Rivals wordmark at both ends.
// No player or rarity information belongs on a face-down card. All artwork is local vector/CSS and scales with it.
const SWIRL = (() => {
  let s = '';
  for (let k = 0; k < 8; k++) {
    const edge = [], inner = [];
    for (let j = 0; j <= 32; j++) {
      const t = j / 32, r = 17 + t * 72, a = k * Math.PI / 4 + t * 2.8, w = .015 + t * .19;
      edge.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(70 + r * Math.sin(a)).toFixed(1)}`);
      inner.unshift(`${(50 + r * Math.cos(a + w)).toFixed(1)},${(70 + r * Math.sin(a + w)).toFixed(1)}`);
    }
    s += `<path d="M${edge.join('L')}L${inner.join('L')}Z" fill="${k % 2 ? '#85E8FF' : '#3B91F1'}" opacity="${k % 2 ? '.36' : '.3'}"/>`
      + `<polyline points="${edge.join(' ')}" fill="none" stroke="#B6F4FF" stroke-width=".35" opacity=".55"/>`;
  }
  const glints = [[13,45,1.2],[79,35,.8],[88,91,1.2],[22,105,.8]].map(([x,y,r]) => `<path d="M${x-r*2} ${y}l${r*1.6} ${-r*.4}l${r*.4} ${-r*2}l${r*.4} ${r*2}l${r*1.6} ${r*.4}l${-r*1.6} ${r*.4}l${-r*.4} ${r*2}l${-r*.4} ${-r*2}Z" fill="#D9F8FF"/>`).join('');
  return `<svg class="dy-back-swirl" viewBox="0 0 100 140" aria-hidden="true" preserveAspectRatio="xMidYMid slice">${s}${glints}</svg>`;
})();
const BALL = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#99DFF4" stroke-width=".65"/>'
  + '<path d="M50 8 79 20 78 50Q75 73 50 91Q25 73 22 50L21 20Z" fill="#091E48" stroke="#CAE9F6" stroke-width="1.6"/>'
  + '<path d="M50 13 74 23 73 49Q70 69 50 84Q30 69 27 49L26 23Z" fill="#174881" stroke="#5E96B7" stroke-width=".65"/>'
  + '<path d="M50 13 74 23 73 49Q70 69 50 84Z" fill="#102D59"/>'
  + '<g transform="rotate(-32 50 50)"><path d="M8 50Q50 -1 92 50Q50 101 8 50Z" fill="#05142E" stroke="#05142E" stroke-width="5" stroke-linejoin="round"/>'
  + '<path d="M8 50Q50 -1 92 50Q50 101 8 50Z" fill="#D6E7EF" stroke="#F4F8F0" stroke-width="1.5" stroke-linejoin="round"/>'
  + '<path d="M8 50Q50 101 92 50H8Z" fill="#86ACC5"/><path d="M15 47Q51 9 83 46Q49 29 15 47Z" fill="#F7FCF9"/>'
  + '<path d="M23 36Q29 50 23 64M77 36Q71 50 77 64" fill="none" stroke="#174471" stroke-width="5"/>'
  + '<path d="M34 50H66M38 44v12M44 44v12M50 44v12M56 44v12M62 44v12" fill="none" stroke="#143352" stroke-width="2.3" stroke-linecap="round"/></g>'
  + '<path d="m50 88 1.3 3.7 3.9.1-3.1 2.4 1.1 3.8-3.2-2.3-3.2 2.3 1.1-3.8-3.1-2.4 3.9-.1Z" fill="#F5D077"/></svg>';
const BACK_WORD = '<b class="dy-back-word">GRIDIRON<small>RIVALS</small></b>';
const BACK = `<div class="dy-back-in">${SWIRL}<span class="dy-back-brand">${BACK_WORD}<span class="dy-back-tag">TRADING CARD GAME</span></span>`
  + `<span class="dy-back-ball">${BALL}</span><span class="dy-back-brand is-flip">${BACK_WORD}<span class="dy-back-tag">TRADING CARD GAME</span></span></div>`;
const END_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5v13l9.5-6.5zM18.5 5.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// a pack's back, in its colour: the seam down the middle, the crimps, the brand (the carousel's spin shows it)
const PACK_BACK = '<span class="dy-pack-back" aria-hidden="true"><i class="dy-pb-seam"></i><b>GRIDIRON<small>DYNASTY</small></b><em>GD1</em></span>';
// (the carousel: the ring in front, the far ring on the horizon)
const RING = 10, FAR = 18;
const FF_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.2v11.6L11.6 12zM12.4 6.2v11.6L20.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

// ---------------------------------------------------------------------------------------------------- the reveals
// One a rarity, rising with it (tier 0 to 6): hold (ms face down before the flip), flip (the turn's length), sparks (how
// many fly), confetti (pieces; 0 none), haptics ([at ms, kind]), palette (the sparks' and confetti's colours), label (its
// stamp after the flip; a ★★ card's is its series). total: how long it plays (then a tap moves on; before that it
// finishes it).
export const REVEAL = [
  {tier: 0, name: 'common', hold: 0, flip: 0, sparks: 0, confetti: 0, haptics: [[0, 'light']], palette: [], label: ''},
  {tier: 1, name: 'rare', hold: 220, flip: 480, sparks: 0, confetti: 0, haptics: [[0, 'light'], [460, 'light']], palette: [], label: ''},
  {tier: 2, name: 'epic', hold: 600, flip: 540, sparks: 8, confetti: 0, haptics: [[0, 'light'], [870, 'medium']], palette: ['#7FD8FF', '#FFFFFF', '#3FA9F5'], label: 'Epic'},
  {tier: 3, name: 'legendary', hold: 850, flip: 600, sparks: 12, confetti: 40, haptics: [[0, 'light'], [500, 'medium'], [1150, 'success']], palette: ['#FFE68A', '#FFFFFF', '#FFB300'], label: 'Legendary'},
  {tier: 4, name: 'mythic', hold: 1000, flip: 620, sparks: 16, confetti: 70, haptics: [[0, 'medium'], [400, 'medium'], [800, 'medium'], [1310, 'success']], palette: ['#FF7FD8', '#B388FF', '#FFFFFF', '#7CF0FF'], label: 'Mythic'},
  {tier: 5, name: 'star2', hold: 1150, flip: 650, sparks: 18, confetti: 85, haptics: [[0, 'medium'], [380, 'medium'], [760, 'medium'], [1000, 'medium'], [1475, 'celebrate']], palette: ['#FFFFFF', '#8FE3FF', '#FFD94A'], label: 'Special'},
  {tier: 6, name: 'crown', hold: 1300, flip: 700, sparks: 22, confetti: 110, haptics: [[0, 'medium'], [400, 'medium'], [700, 'medium'], [1000, 'success'], [1650, 'celebrate'], [2300, 'success']], palette: ['#FFE68A', '#FFFFFF', '#FFB300', '#FFF6D6'], label: 'Legend'}
].map(r => Object.freeze({...r, total: r.hold + r.flip + (r.tier >= 4 ? 1120 : r.tier ? 900 : 420)})); // (the sweep runs 1s after the flip from Mythic)
/** The reveal a card gets, by its mark (core/dynasty.js markOf): ◆ to ◆◆◆◆ tiers 0 to 3, ★ 4, ★★ 5, ♛ 6; a Trainer card
 *  by its rarity, Epic (◆◆) 2 or Legendary (◆◆◆) 3. */
export function revealOf(c) {
  const m = D.markOf(c);
  const tier = c && !c.s && c.r ? (c.r === 'legendary' ? 3 : 2) : m.kind === 'c' ? 6 : m.kind === 's' ? (m.n >= 2 ? 5 : 4) : Math.min(3, Math.max(0, m.n - 1));
  const R = REVEAL[tier];
  const label = tier === 5 && c ? ({P: 'Prime', G: 'Gameday', A: 'Award'}[c.s] || R.label) : R.label;
  return {...R, label};
}
/** The order a pack's cards come out: the rarest last (as Pocket reveals), the better player last within a tier. */
export const dealOrder = cards => cards.slice().sort((a, b) => revealOf(a).tier - revealOf(b).tier || (a.o || 0) - (b.o || 0) || String(a.id).localeCompare(String(b.id)));
/** A card's reveal on the deal: the card (face down past tier 0, with Pocket's back; the front its own sheet, hidden till
 *  the back has turned away) inside its effects; it plays once its slot is the top card's (css: .dy-dc.is-go). */
export function dealHTML(c, R, cardHTML, isNew) {
  // (the sparks fly past the card's edges: 160 to 280px from its centre, the card 145 by 202 from it)
  const sparks = Array.from({length: R.sparks}, (_, i) => `<i class="pk-spk" style="--a:${Math.round(i * 360 / R.sparks + (i % 2) * 11)}deg;--d:${160 + (i % 3) * 60}px;--t:${(i % 4) * 45}ms;--c:${R.palette[i % R.palette.length]}"></i>`).join('');
  return `<div class="pk-deal-c t-${R.tier}${R.tier ? ' is-flip' : ' is-face'}${R.tier >= 4 ? ' is-shake' : ''}" style="--hold:${R.hold}ms;--flip:${R.flip}ms">`
    + (R.tier >= 3 ? '<i class="pk-fx-rays" aria-hidden="true"></i>' : '') + (R.tier >= 2 ? '<i class="pk-fx-ring" aria-hidden="true"></i>' : '')
    + (R.tier >= 5 ? '<i class="pk-fx-ring is-2" aria-hidden="true"></i>' : '') + (R.tier >= 6 ? '<i class="pk-fx-crown" aria-hidden="true">♛</i>' : '')
    + `<div class="pk-shake"><div class="pk-flip"><div class="pk-flip-back" aria-hidden="true">${BACK}</div>`
    + `<div class="pk-flip-front">${cardHTML}${isNew ? '<span class="pk-c-new is-big" aria-hidden="true">NEW</span>' : ''}${R.tier >= 4 ? '<i class="pk-fx-sweep" aria-hidden="true"></i>' : ''}`
    + `${R.tier >= 3 ? '<i class="pk-fx-white" aria-hidden="true"></i>' : ''}</div></div></div>`
    + (R.tier >= 3 ? '<i class="pk-fx-flash" aria-hidden="true"></i>' : '') + (sparks ? `<span class="pk-spks" aria-hidden="true">${sparks}</span>` : '')
    + (R.label ? `<b class="pk-deal-tag">${R.label}</b>` : '') + (R.tier >= 2 ? '<i class="pk-fx-glint" aria-hidden="true"></i>' : '') + '</div>';
}

/** Opens a pack on screen. o: {kind (core/dynasty.js PACKS key), design (views/dynasty-packs.js designsOf's index), cards
 *  (the ids drawn), dup ({id: true} for copies already held), cardHTML (views/dynasty.js anyHTML), onClose (after it's
 *  gone), focusBack (optional: where focus goes after onClose when what had it is gone, an element or a selector)}. */
export function openScene({kind, design = 0, cards, dup, cardHTML: anyHTML, onClose, focusBack}) {
  const r = {cards, dup}, P = D.PACKS[kind];
  // (the rarest last, as Pocket reveals: dealOrder)
  const order = dealOrder(r.cards.map(D.anyCard));
  const N = order.length, fresh = order.filter(c => !r.dup[c.id]).length;
  const ov = document.createElement('div');
  ov.className = 'pk-open';
  ov.dataset.phase = 'pick'; ov.dataset.tier = '';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Opening a ${P.name}`);
  ov.style.setProperty('--pc', P.color);
  const s0 = D.mine(), heldOf = id => (s0.o && s0.o[id]) || 0;
  const big = packHTML(kind, {big: true, design}), small = packHTML(kind, {design});
  ov.innerHTML = `<div class="pk-open-bg" aria-hidden="true"><i class="pk-open-tint"></i><span class="dy-bg-spk">${DRIFT}</span></div>`
    + `<div class="dy-pick" data-dy-carousel tabindex="0" role="button" aria-label="Choose a pack: swipe to turn them, then tap the one in front, or press Enter">`
    + `<i class="dy-pick-floor" aria-hidden="true"></i><div class="dy-pick-far" aria-hidden="true">${Array.from({length: FAR}, () => `<div class="dy-fp">${small}</div>`).join('')}</div>`
    + `<div class="dy-pick-ring" aria-hidden="true">${Array.from({length: RING}, () => `<div class="dy-pp"><div class="dy-pp-f">${big}</div><div class="dy-pp-b">${PACK_BACK}</div></div>`).join('')}</div>`
    + `<p class="dy-pick-say" aria-hidden="true">Swipe to choose a pack, then tap it</p></div>`
    + `<div class="dy-stage"><div class="dy-deal">`
    + `<div class="dy-deck" tabindex="-1" role="group" aria-label="The cards: tap, swipe or press Enter for the next"></div>`
    + `<p class="dy-deck-meta" aria-hidden="true"><span class="dy-marks"></span><b class="pk-deal-n"></b><span class="dy-deal-hint">Tap or swipe</span></p></div>`
    + `<div class="dy-open-pack" data-dy-tear tabindex="0" role="button" aria-label="Rip the pack open: swipe across its top, or press Enter" hidden>`
    + `<div class="dy-rip" style="--p:0;--dir:1;--ct:${TEAR.top};--cb:${TEAR.body}"><span class="dy-rays" aria-hidden="true">${RAYS}</span><span class="dy-motes" aria-hidden="true">${MOTES}</span>`
    + `<div class="dy-rip-body">${big}</div>`
    // (the strip's two bands, css: the torn part, lifting behind the finger, and the rest still flat beyond it)
    + `<div class="dy-rip-top"><div class="dy-rip-strip">${big}</div></div>`
    + `<div class="dy-rip-rest"><div class="dy-rip-strip">${big}</div></div>`
    + `<span class="dy-rip-line" aria-hidden="true"></span><span class="dy-flare" aria-hidden="true"></span>`
    + `<span class="dy-rip-hint" aria-hidden="true"><i class="dy-rip-trail"></i><i class="dy-rip-finger"></i></span></div>`
    + `<p class="dy-rip-say">Swipe across the top to rip it open</p></div></div>`
    + `<i class="dy-wash" aria-hidden="true"></i>`
    + `<button type="button" class="pk-pill dy-skip" data-dy-skip hidden>Skip</button>`
    + `<button type="button" class="dy-ff" data-dy-ff hidden aria-label="Fast forward: tap for the next card, or hold to skip to the results"><span class="dy-ff-b">${FF_ICON}</span><small aria-hidden="true">Tap and hold</small></button>`
    + `<div class="pk-results" hidden><div class="dy-res-head"><h2>Opening Results</h2><span class="dy-res-pp"><i aria-hidden="true">P</i>Pack points<b>+${D.PP_PER_PACK}</b></span></div>`
    + `<div class="pk-grid is-results${N > 5 ? ' is-many' : ''}">${order.map((c, i) => `<div class="pk-res-c" style="--i:${i}">${anyHTML(c.id, {size: 's', tag: false, noCount: true})}`
      + `${r.dup[c.id] ? '' : '<span class="pk-c-new">NEW</span>'}<b class="dy-res-n" aria-label="${Math.max(1, heldOf(c.id))} held">${Math.max(1, heldOf(c.id))}</b></div>`).join('')}</div>`
    + `<button type="button" class="pk-open" data-dy-done>Next</button></div>`
    + `<div class="dy-total" hidden><div class="dy-total-pile" aria-hidden="true"></div><p class="dy-total-pill"><small>Grand total cards acquired</small><b><span data-dy-total>0</span><em>cards</em></b></p></div>`
    + `<div class="dy-dex" hidden><p class="dy-dex-tip"><i aria-hidden="true">${BALL}</i><span>Swipe up on the cards to register them into the card dex.</span></p>`
    + `<div class="dy-dex-stack" data-dy-reg tabindex="0" role="button" aria-label="Register the new cards into the card dex: swipe up, tap, or press Enter"></div>`
    + `<div class="dy-dex-book" hidden><div class="dy-dex-head"><b class="dy-dex-name"></b><span class="dy-dex-n"><i aria-hidden="true">◆</i><b data-dy-dexn>0</b>/<span data-dy-dexof>0</span></span></div><div class="dy-dex-grid"></div></div></div>`
    + `<button type="button" class="dy-end" data-dy-end hidden aria-label="Skip">${END_ICON}</button>`
    + `<p class="sr-only" aria-live="polite" data-dy-say></p>`;
  document.body.appendChild(ov);
  const prevFocus = document.activeElement;
  // (the app behind it is out of reach while it's open, as under a sheet: Tab stays in here)
  const behind = ['stage', 'tabbar'].map(id => document.getElementById(id)).filter(el => el && !el.inert);
  behind.forEach(el => { el.inert = true; });
  const $ = s => ov.querySelector(s);
  const stage = $('.dy-stage'), deck = $('.dy-deck'), nTxt = $('.pk-deal-n'), hint = $('.dy-deal-hint'), say = $('[data-dy-say]'),
    skipB = $('[data-dy-skip]'), ffB = $('[data-dy-ff]'), pk = $('.dy-open-pack'), rip = pk.querySelector('.dy-rip'), marks = $('.dy-marks');
  // (every timer goes through later(), so closing clears the lot; none fires once it's closed)
  let closed = false, phase = 'pick';
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!closed) fn(); }, ms); timers.add(t); return t; };
  const drop = list => list.splice(0).forEach(t => { clearTimeout(t); timers.delete(t); });
  const setPhase = p => { phase = p; ov.dataset.phase = p; };
  const endB = $('[data-dy-end]');
  const inRaf = requestAnimationFrame(() => ov.classList.add('is-in'));
  // (and still once it's covered: nothing behind animates for nothing)
  later(() => behind.forEach(el => el.classList.add('pk-behind')), 320);

  // ---- the cards: a stack, the top one showing (slots: each card's element, made as it comes near the top)
  const slots = [];
  let at = 0, top = null;
  // (a slot: the card's tilt round its reveal, dealHTML's; the foil and the glare on its face, a rare one's foil showing)
  const slotHTML = c => {
    const R = revealOf(c), foil = R.tier >= 3 || (!c.s && c.r === 'legendary');
    const face = `${anyHTML(c.id, {size: 'l', tag: false, noCount: true})}<i class="dy-foil"></i><i class="dy-glare"></i><i class="dy-sheen"></i>`;
    return `<div class="dy-dc t${R.tier}${foil ? ' is-foil' : ''}" aria-hidden="true"><div class="dy-tilt">${dealHTML(c, R, face, !r.dup[c.id])}</div></div>`;
  };
  // (a card goes in under the others: the top one stays on top)
  const mount = i => {
    if (slots[i] || i >= N) return slots[i];
    deck.insertAdjacentHTML('afterbegin', slotHTML(order[i]));
    return (slots[i] = deck.firstElementChild);
  };
  // ---- a card's reveal, by its rarity (rv: the one playing; its haptics and confetti on the CSS's clock, --hold and
  // --flip; a tap finishes it: everything at its end, is-skip)
  let rv = null;
  const rvT = [];
  // (confetti from the card's two top corners, out and down round it: not a bar across its face)
  const burst = (R, again) => {
    try {
      const b = top.getBoundingClientRect(), count = Math.round(R.confetti * (again ? .6 : 1) / 2);
      [b.left + b.width * .06, b.right - b.width * .06].forEach(x => ui.confetti({left: x - 16, top: b.top - 4, width: 32, height: 8}, {colors: R.palette, count}));
    } catch (_) {}
  };
  // (the reveal's own animations, the ones that end; the rays' turning and the foil go on. A finish runs them to their
  // end; where a browser can't, is-skip puts them there)
  const finite = el => { try { return el.getAnimations({subtree: true}).filter(a => a.effect.getComputedTiming().endTime !== Infinity); } catch (_) { return null; } };
  const playing = el => { const A = finite(el); return A ? A.some(a => a.playState === 'running') : true; };
  const endReveal = (skip = true) => {
    if (!rv) return;
    const el = rv;
    rv = null; delete ov.dataset.rv; drop(rvT);
    if (skip) { const A = finite(el); if (A) A.forEach(a => { try { a.finish(); } catch (_) {} }); else el.classList.add('is-skip'); ui.haptic('light'); }
    kick();
  };
  const begin = (fast = false) => {
    const c = order[at], R = revealOf(c), el = top, deal = el.querySelector('.pk-deal-c');
    drop(rvT);
    // (⏩ running through: no ground, rays or word for each card it passes, no strobe; the results say the lot)
    ov.dataset.tier = fast ? '' : String(R.tier);
    if (!fast && R.tier >= 3) ov.dataset.g = String(R.tier);
    // (the count only: a face-down card's tier isn't told before it turns; its stamp tells it)
    nTxt.textContent = `${at + 1} of ${N}`;
    hint.hidden = at > 0;
    // (its rarity's marks under it, popping in one by one once it's face up, as Pocket's diamonds)
    const mk = Array.from(D.markOf(c).mark), wait = fast || RM() ? 0 : (R.tier ? R.hold + R.flip : 120);
    marks.className = `dy-marks is-${D.markOf(c).kind}`;
    marks.innerHTML = fast ? '' : mk.map((g, i) => `<i style="--d:${wait + i * 140}ms">${g}</i>`).join('');
    const pc = el.querySelector('.pk-card');
    if (!fast) say.textContent = `${at + 1} of ${N}${R.label ? `, ${R.label}` : ''}: ${(pc && pc.getAttribute('aria-label')) || c.name}${r.dup[c.id] ? '' : ', new'}`;
    cur.x = cur.y = cur.a = 0;
    el.classList.add('is-go');
    if (fast) { deal.classList.add('is-skip', 'is-fast'); return; }
    const when = ms => (RM() ? 0 : ms);
    R.haptics.forEach(([t, k]) => rvT.push(later(() => ui.haptic(k), when(t))));
    if (R.confetti) rvT.push(later(() => burst(R), when(R.hold + R.flip / 2)));
    if (R.tier >= 6) rvT.push(later(() => burst(R, true), when(R.hold + R.flip / 2 + 650)));
    if (R.tier && !RM()) { rv = deal; ov.dataset.rv = String(R.tier); rvT.push(later(() => endReveal(false), R.total)); }
    else if (!R.tier && !RM()) el.classList.add('is-sheen');
    kick();
  };
  // ---- the pack torn: a flash along the tear, the strip spun away, light out of the pack; the pack sinks and the first
  // card rises out of it (the pack's front in front of it), grows and settles as the pack drops away
  const opening = [];
  const torn = () => {
    if (closed) return;
    ui.haptic('medium');
    setPhase('open');
    const rr = rip.getBoundingClientRect(), dr = deck.getBoundingClientRect();
    // (the strip spins about its own middle from where the tear left it: the same pose, about a new point)
    const th = dir * 22 * Math.PI / 180, vx = dir * rr.width / 2, vy = rr.height * .065;
    rip.style.setProperty('--sx', (vx - (vx * Math.cos(th) - vy * Math.sin(th))).toFixed(1) + 'px');
    rip.style.setProperty('--sy', (vy - (vx * Math.sin(th) + vy * Math.cos(th)) - 10).toFixed(1) + 'px');
    const mouth = rr.top + rr.height * .13, sink = Math.max(0, innerHeight * .76 - mouth), s0 = Math.min(1, rr.width * .84 / dr.width);
    pk.style.setProperty('--sink', sink.toFixed(0) + 'px');
    pk.classList.add('is-torn'); ov.classList.add('is-tearflash');
    const el = mount(0);
    el.classList.add('is-top', 'is-hid');
    el.style.setProperty('--y0', (mouth + sink + rr.height * .05 - dr.top).toFixed(0) + 'px');
    el.style.setProperty('--s0', s0.toFixed(3)); el.style.setProperty('--h0', (dr.height * s0).toFixed(0) + 'px');
    if (RM()) { opening.push(later(() => { pk.classList.add('is-gone'); el.classList.remove('is-hid'); el.classList.add('is-fade'); }, 120), later(settle, 420)); return; }
    opening.push(later(() => pk.classList.add('is-sink'), 600),
      later(() => { el.classList.remove('is-hid'); el.classList.add('is-rise'); setPhase('rise'); }, 900),
      later(() => pk.classList.add('is-drop'), 1150), later(settle, 900 + 760));
  };
  // (the first card in its place: the cards' turn; a tap during the opening comes straight here)
  const settle = () => {
    if (phase !== 'open' && phase !== 'rise') return;
    drop(opening);
    pk.hidden = true; ov.classList.remove('is-tearflash');
    top = slots[0];
    top.classList.remove('is-hid', 'is-rise', 'is-fade');
    at = 0; setPhase('deal');
    skipB.hidden = false; ffB.hidden = false;
    mount(1);
    deck.focus({preventScroll: true});
    begin();
  };
  // ---- the top card away (dir -1 to the left, 1 to the right), the next one there beneath it
  const fly = (el, dir) => {
    el.classList.remove('is-top', 'is-sheen'); el.classList.add('is-fly');
    if (RM()) { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; }
    else {
      // (smeared at once and stretched along its way, as Pocket's, at a near even pace: a frame or two of it in sight)
      const w = deck.offsetWidth;
      el.style.transition = 'transform .28s cubic-bezier(.35,.25,.65,.85), opacity .28s ease-in, filter .05s';
      el.style.transform = `translate(${(dir * (innerWidth / 2 + w * .85)).toFixed(0)}px, ${(-w * .06).toFixed(0)}px) rotate(${dir * 10}deg) scaleX(1.22)`;
      el.style.filter = 'blur(7px)'; el.style.opacity = '.3';
    }
    later(() => el.remove(), 340);
  };
  const advance = (dir = -1, fast = false) => {
    if (phase !== 'deal' || !top) return;
    endReveal();
    fly(top, dir);
    at++;
    // (the last one away: the ground fades back to Pocket's as it flies, then the lot)
    if (at >= N) { top = null; setPhase('done'); ov.dataset.tier = ''; ffB.hidden = true; later(showResults, fast ? 140 : 300); return; }
    top = mount(at); top.classList.add('is-top');
    mount(at + 1);
    begin(fast);
  };
  // (a tap, Enter, an arrow key or the ⏩ button: the opening skipped to its end, a reveal finished, or the next card)
  const step = (dir = -1) => {
    if (phase === 'open' || phase === 'rise') { settle(); return; }
    if (phase !== 'deal') return;
    // (a reveal still playing: the tap finishes it; one that's over (a Rare's flip is 0.7s): the tap moves on)
    if (rv) { if (playing(rv)) { endReveal(); return; } endReveal(false); }
    advance(dir);
  };
  const showResults = () => {
    if (closed || phase === 'results') return;
    endReveal(); clearInterval(ffI); drop(opening);
    setPhase('results'); ov.dataset.tier = '';
    stage.hidden = true; skipB.hidden = true; ffB.hidden = true;
    ov.classList.add('is-results');
    const res = $('.pk-results');
    res.hidden = false;
    say.textContent = `Results: ${N} card${N === 1 ? '' : 's'}${fresh ? `, ${fresh} new` : ''}. Plus ${D.PP_PER_PACK} pack points.`;
    endB.hidden = true;
    $('[data-dy-done]').focus({preventScroll: true});
    // (Done answers once the lot is in: a quick tap meant for the last card doesn't close it)
    later(() => res.classList.add('is-ready'), 380);
  };
  // ---- Next: the cards gathered into a pile, the grand total of cards counting up to what's held now; then, with new
  // ones, the card dex
  const fresh1 = [...new Set(order.filter(c => !r.dup[c.id]).map(c => c.id))];
  const totalOf = () => { const s = D.mine(); return Object.values(s.o || {}).reduce((t, n) => t + (n > 0 ? n : 0), 0); };
  const next = () => {
    if (phase !== 'results') return;
    setPhase('total');
    const res = $('.pk-results'), tot = $('.dy-total'), num = $('[data-dy-total]');
    const after = Math.max(totalOf(), N), before = Math.max(0, after - N);
    endB.hidden = false;
    num.textContent = before.toLocaleString();
    say.textContent = `Grand total cards acquired: ${after.toLocaleString()}.`;
    // (each card to the pile at the foot, one after another)
    const cs = [...res.querySelectorAll('.pk-res-c')];
    if (!RM()) {
      const py = innerHeight * .72;
      cs.forEach((el, i) => {
        const b = el.getBoundingClientRect();
        el.style.animation = 'none';
        el.style.transition = `transform .45s cubic-bezier(.5,0,.3,1) ${i * 45}ms, opacity .3s ${300 + i * 45}ms`;
        el.style.transform = `translate(${(innerWidth / 2 - (b.left + b.width / 2)).toFixed(0)}px, ${(py - (b.top + b.height / 2)).toFixed(0)}px) rotate(${(i % 2 ? 6 : -5) * (i % 3 + 1) / 2}deg) scale(.5)`;
        el.style.opacity = '0';
      });
    }
    res.classList.add('is-gather');
    later(() => {
      res.hidden = true; ov.classList.remove('is-results');
      tot.hidden = false;
      const t1 = performance.now(), ms = RM() ? 0 : 900;
      const tick = now => {
        if (closed) return;
        const k = ms ? Math.min(1, (now - t1) / ms) : 1;
        num.textContent = Math.round(before + (after - before) * easeOut(k)).toLocaleString();
        if (k < 1) requestAnimationFrame(tick); else if (!RM()) { tot.classList.add('is-done'); ui.haptic('light'); }
      };
      requestAnimationFrame(tick);
      later(() => (fresh1.length ? dex() : close()), RM() ? 900 : 1900);
    }, RM() ? 0 : 300 + cs.length * 45 + 300);
  };
  // ---- the card dex: each new card to its slot, numbered as its series' cards are (D.CARDS's order; the Trainer cards
  // their own). A slot shows the card once it's held (those near the new ones drawn, the rest a filled tile)
  const book = $('.dy-dex-book'), grid = $('.dy-dex-grid'), dexN = $('[data-dy-dexn]'), dexOf = $('[data-dy-dexof]'), stack = $('.dy-dex-stack');
  const setOf = id => {
    const c = D.card(id);
    if (!c) return {key: 'T', name: 'Trainer cards', ids: D.TRAINER_IDS};
    return {key: c.s, name: D.SERIES[c.s].name, ids: D.CARDS.filter(x => x.s === c.s).map(x => x.id)};
  };
  let regging = false;
  const dex = () => {
    if (closed) return;
    setPhase('dex');
    $('.dy-total').hidden = true;
    $('.dy-dex').hidden = false;
    stack.innerHTML = fresh1.slice(0, 3).reverse().map((id, i, a) => `<div class="dy-dex-c" style="--k:${a.length - 1 - i}">${anyHTML(id, {size: 'l', tag: false, noCount: true})}</div>`).join('');
    say.textContent = `${fresh1.length} new card${fresh1.length === 1 ? '' : 's'}: swipe up, tap or press Enter to register ${fresh1.length === 1 ? 'it' : 'them'} into the card dex.`;
    stack.focus({preventScroll: true});
  };
  const register = () => {
    if (phase !== 'dex' || regging) return;
    regging = true;
    setPhase('reg');
    ui.haptic('medium');
    stack.classList.add('is-up');
    $('.dy-dex-tip').classList.add('is-gone');
    const s = D.mine(), isFresh = new Set(fresh1);
    // (the new ones, set by set)
    const groups = [];
    fresh1.forEach(id => { const S = setOf(id); let gp = groups.find(x => x.key === S.key); if (!gp) groups.push(gp = {...S, add: []}); gp.add.push(id); });
    const pad = n => String(n).padStart(3, '0');
    let gi = 0;
    const drawSet = gp => {
      const at = new Set(gp.add.map(id => gp.ids.indexOf(id))), near = i => [...at].some(j => Math.abs(i - j) <= 30);
      $('.dy-dex-name').textContent = gp.name;
      dexOf.textContent = gp.ids.length.toLocaleString();
      let have = 0;
      grid.innerHTML = gp.ids.map((id, i) => {
        const own = (s.o && s.o[id] > 0) && !isFresh.has(id);
        if (own) have++;
        return `<div class="dy-dx-t${own ? ' is-have' : ''}" data-dx="${i}"><span>${pad(i + 1)}</span>${own && near(i) ? anyHTML(id, {size: 's', tag: false, noCount: true}) : ''}</div>`;
      }).join('');
      dexN.textContent = have.toLocaleString();
      gp.have = have;
      book.hidden = false; book.classList.remove('is-in'); void book.offsetWidth; book.classList.add('is-in');
    };
    const land = (gp, k) => {
      if (closed) return;
      if (k >= gp.add.length) { gi++; if (gi < groups.length) later(() => { drawSet(groups[gi]); later(() => land(groups[gi], 0), 500); }, 400); else later(close, 1300); return; }
      const id = gp.add[k], i = gp.ids.indexOf(id), t = grid.querySelector(`[data-dx="${i}"]`);
      if (!t) { land(gp, k + 1); return; }
      // (its slot brought into the middle, then the card set in it)
      const top = t.offsetTop - grid.clientHeight / 2 + t.offsetHeight / 2;
      grid.scrollTo({top: Math.max(0, top), behavior: RM() ? 'auto' : 'smooth'});
      later(() => {
        t.classList.add('is-have', 'is-new');
        t.insertAdjacentHTML('beforeend', anyHTML(id, {size: 's', tag: false, noCount: true}));
        gp.have++; dexN.textContent = gp.have.toLocaleString();
        ui.haptic('light');
        say.textContent = `${D.anyCard(id).name} registered: ${gp.have} of ${gp.ids.length} ${gp.name}.`;
        later(() => land(gp, k + 1), RM() ? 250 : 560);
      }, RM() ? 0 : 380);
    };
    later(() => { stack.hidden = true; drawSet(groups[0]); later(() => land(groups[0], 0), RM() ? 0 : 450); }, RM() ? 0 : 420);
  };
  // (a swipe up the new cards)
  let sg = null;
  stack.addEventListener('pointerdown', e => { if (phase !== 'dex') return; sg = {id: e.pointerId, y: e.clientY}; try { stack.setPointerCapture(e.pointerId); } catch (_) {} });
  stack.addEventListener('pointermove', e => {
    if (!sg || e.pointerId !== sg.id || RM()) return;
    const dy = Math.min(0, e.clientY - sg.y);
    stack.style.transform = `translateY(${dy.toFixed(0)}px)`;
  });
  const sUp = e => {
    if (!sg || e.pointerId !== sg.id) return;
    const dy = e.clientY - sg.y;
    sg = null; stack.style.transform = '';
    if (e.type !== 'pointercancel' && (dy < -50 || Math.abs(dy) < 10)) register();
  };
  stack.addEventListener('pointerup', sUp); stack.addEventListener('pointercancel', sUp);

  // ---- ⏩: a tap for the next, held (0.4 s) it runs through the rest to the results
  let ffI = 0, ffHold = 0, held = false;
  const ffAll = () => {
    if (phase !== 'deal') return;
    ffB.classList.add('is-on');
    endReveal();
    const tick = () => { if (phase !== 'deal' || closed) { clearInterval(ffI); return; } advance(-1, true); };
    clearInterval(ffI); tick(); ffI = setInterval(tick, 130);
  };
  const unhold = () => { clearTimeout(ffHold); ffB.classList.remove('is-hold'); if (held) later(() => { held = false; }, 400); };
  ffB.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    held = false; clearTimeout(ffHold); ffB.classList.add('is-hold');
    ffHold = setTimeout(() => { if (closed) return; held = true; ffB.classList.remove('is-hold'); ui.haptic('medium'); ffAll(); }, 400);
  });
  ffB.addEventListener('pointerup', unhold); ffB.addEventListener('pointercancel', unhold); ffB.addEventListener('pointerleave', unhold);
  ffB.addEventListener('contextmenu', e => e.preventDefault());

  // ---- the top card under your finger: it tilts toward it, the glare and the foil following; a sideways drag swipes it
  // (hold: where the finger is, -1..1 across and down; cur: the tilt now, eased toward it. Let go, it settles flat and
  // stays so, as Pocket's: a card always on the move is drawn soft, its words blurred)
  const hold = {x: 0, y: 0, on: false}, cur = {x: 0, y: 0, a: 0};
  let raf = 0, g = null;
  const kick = () => { if (!raf && !closed) raf = requestAnimationFrame(frame); };
  const frame = () => {
    raf = 0;
    if (closed || !top) return;
    const tx = hold.on ? hold.x : 0, ty = hold.on ? hold.y : 0;
    cur.x += (tx - cur.x) * .14; cur.y += (ty - cur.y) * .14; cur.a += ((hold.on ? 1 : 0) - cur.a) * .1;
    const s = top.style, still = !hold.on && Math.abs(cur.x) + Math.abs(cur.y) + cur.a < .004;
    if (still) cur.x = cur.y = cur.a = 0;
    s.setProperty('--ry', (cur.x * 16).toFixed(2)); s.setProperty('--rx', (-cur.y * 13).toFixed(2));
    s.setProperty('--gx', (50 + cur.x * 50).toFixed(1) + '%'); s.setProperty('--gy', (50 + cur.y * 50).toFixed(1) + '%');
    s.setProperty('--fx', (50 + cur.x * 48).toFixed(1) + '%'); s.setProperty('--fy', (50 + cur.y * 34).toFixed(1) + '%');
    s.setProperty('--ta', cur.a.toFixed(3));
    if (!still) kick();
  };
  const aim = e => {
    if (!top || RM() || phase !== 'deal') return;
    const b = deck.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height, on = px >= 0 && px <= 1 && py >= 0 && py <= 1;
    // (on the card, or a press that began on it and wandered off: it leans that way)
    if (g && g.on === undefined) g.on = on;
    if (!on && !(g && g.on)) { hold.on = false; kick(); return; }
    hold.on = true; hold.x = clamp(px * 2 - 1, -1, 1); hold.y = clamp(py * 2 - 1, -1, 1);
    kick();
  };
  const spring = () => { if (top && !RM()) { top.style.transition = 'transform .38s cubic-bezier(.2,.9,.3,1.25)'; top.style.transform = ''; } };
  stage.addEventListener('pointerdown', e => {
    if ((phase !== 'open' && phase !== 'rise' && phase !== 'deal') || g || (e.pointerType === 'mouse' && e.button !== 0)) return;
    g = {id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), mode: '', dx: 0, lx: e.clientX, lt: performance.now(), v: 0};
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    aim(e);
  });
  stage.addEventListener('pointermove', e => {
    if (!g) { if (e.pointerType === 'mouse') aim(e); return; }
    if (e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    // (sideways past a few pixels: a swipe; anything else: a tilt)
    if (!g.mode && Math.hypot(dx, dy) > 9) g.mode = phase === 'deal' && !rv && Math.abs(dx) > Math.abs(dy) * 1.15 ? 'swipe' : 'tilt';
    if (g.mode === 'swipe') {
      const now = performance.now();
      g.v = (e.clientX - g.lx) / Math.max(1, now - g.lt); g.lx = e.clientX; g.lt = now; g.dx = dx;
      if (top && !RM()) { top.style.transition = 'none'; top.style.transform = `translateX(${dx.toFixed(1)}px) rotate(${(dx * .05).toFixed(2)}deg)`; }
      deck.classList.add('is-drag'); hold.on = false; kick();
    } else aim(e);
  });
  const up = e => {
    if (!g || e.pointerId !== g.id) return;
    const d = g;
    g = null; hold.on = false; kick();
    // (the card under it stays in sight till the top one is back in place)
    const back = () => { spring(); later(() => { if (!g) deck.classList.remove('is-drag'); }, 400); };
    if (e.type === 'pointercancel') { if (d.mode === 'swipe') back(); return; }
    if (d.mode === 'swipe') {
      // (far enough across, or a quick flick: it's away; short of it, it springs back)
      if (Math.abs(d.dx) > Math.max(70, deck.offsetWidth * .3) || (Math.abs(d.v) > .45 && Math.abs(d.dx) > 36)) { deck.classList.remove('is-drag'); advance(d.dx > 0 ? 1 : -1); }
      else back();
    } else if (!d.mode && performance.now() - d.t < 700) step(-1);
    else if (rv && Math.abs(e.clientX - d.x) > 40) endReveal(); // (a swipe mid-reveal finishes it, as a tap does)
  };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('pointerleave', e => { if (!g && e.pointerType === 'mouse') { hold.on = false; kick(); } });

  // ---- the carousel (Pocket's): a ring of the packs, the one in front nearest; behind them a far ring on the horizon.
  // Each pack is placed from rot (the ring's turn, degrees; the pack at i * STEP is in front at rot = i * STEP), so
  // nothing needs preserve-3d: a pack past the ring's side is hidden, the nearer drawn over the farther. lift: the
  // ring's height (it sweeps down into place); spin: the chosen one's own turn (its back shown past a quarter)
  const pick = $('.dy-pick'), PP = [...pick.querySelectorAll('.dy-pp')], FP = [...pick.querySelectorAll('.dy-fp')];
  const STEP = 360 / RING, FSTEP = 360 / FAR;
  let rot = 0, lift = 0, spin = 0, pTw = 0, pg = null, chosen = false;
  const wrap = a => ((a % 360) + 540) % 360 - 180;
  const front = () => (((Math.round(rot / STEP)) % RING) + RING) % RING;
  const place = () => {
    const w = PP[0].offsetWidth || 180, R = w * 1.12, fw = FP[0].offsetWidth || 80, FR = fw * 4.6, f = front();
    PP.forEach((el, i) => {
      const a = wrap(i * STEP - rot), r = a * Math.PI / 180, c = Math.cos(r), own = i === f ? spin : 0, t = ((a + own) % 360 + 360) % 360;
      el.style.transform = `translate3d(${(R * Math.sin(r)).toFixed(1)}px, ${lift.toFixed(1)}px, ${(R * c - R).toFixed(1)}px) rotateY(${(a + own).toFixed(2)}deg)`;
      el.style.opacity = c < .05 ? '0' : '1';
      el.style.zIndex = String(Math.round(c * 100) + 100);
      el.classList.toggle('is-back', t > 90 && t < 270);
      el.classList.toggle('is-front', i === f);
    });
    // (the far ring, seen from inside it: the ones across the horizon smallest, turning the other way, slower)
    FP.forEach((el, j) => {
      const b = wrap(j * FSTEP + rot * .35), r = b * Math.PI / 180, c = Math.cos(r);
      el.style.transform = `translate3d(${(FR * Math.sin(r)).toFixed(1)}px, ${(lift * .5).toFixed(1)}px, ${(-FR * c - fw * 1.2).toFixed(1)}px) rotateY(${(-b).toFixed(2)}deg)`;
      el.style.opacity = Math.abs(b) > 78 ? '0' : '1';
    });
  };
  const pTween = (fromTo, ms, ease, then) => {
    cancelAnimationFrame(pTw);
    const t1 = performance.now();
    const go = now => {
      if (closed) return;
      const k = ms > 0 ? Math.min(1, (now - t1) / ms) : 1, e = ease(k);
      fromTo(e); place();
      if (k < 1) pTw = requestAnimationFrame(go); else if (then) then();
    };
    pTw = requestAnimationFrame(go);
  };
  const easeOut = k => 1 - Math.pow(1 - k, 3), easeIO = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  // (in: from above, sweeping round into place)
  let intro = true;
  const settleRing = () => { intro = false; cancelAnimationFrame(pTw); rot = Math.round(rot / STEP) * STEP; lift = 0; place(); };
  if (RM()) { intro = false; place(); }
  else {
    const h = innerHeight;
    rot = -300; lift = -h * .55; place();
    pTween(e => { rot = -300 * (1 - e); lift = -h * .55 * (1 - e); }, 1500, easeOut, () => { intro = false; });
  }
  pick.focus({preventScroll: true});
  // (turn by a pack either way)
  const turn = d => { if (chosen) return; if (intro) settleRing(); const r0 = rot, to = Math.round(rot / STEP + d) * STEP; ui.haptic('selection'); pTween(e => { rot = r0 + (to - r0) * e; }, 320, easeOut); };
  // ---- the one in front chosen: it spins once round, its back shown, then comes up big where it's ripped (the rip's
  // pack grows from where it stood), the ring fading away
  const choose = (fast = false) => {
    if (chosen || closed) return;
    chosen = true;
    if (intro) settleRing();
    cancelAnimationFrame(pTw);
    rot = Math.round(rot / STEP) * STEP; place();
    ui.haptic('medium');
    setPhase('chosen');
    const up = () => {
      if (closed) return;
      const el = PP[front()], a = el.getBoundingClientRect();
      pk.hidden = false;
      const b = rip.getBoundingClientRect();
      pick.classList.add('is-gone');
      later(() => { pick.hidden = true; }, 420);
      setPhase('rip');
      pk.focus({preventScroll: true});
      if (RM() || fast || !b.width) return;
      // (from the carousel's pack to the rip's: the same pack, grown)
      const sx = a.width / b.width;
      pk.style.transition = 'none';
      pk.style.transform = `translate(${(a.left + a.width / 2 - (b.left + b.width / 2)).toFixed(1)}px, ${(a.top + a.height / 2 - (b.top + b.height / 2)).toFixed(1)}px) scale(${sx.toFixed(3)})`;
      void pk.offsetWidth;
      pk.style.transition = 'transform .5s cubic-bezier(.2,.8,.25,1)';
      pk.style.transform = '';
      pk.classList.add('is-zoom');
      later(() => { pk.style.transition = ''; pk.classList.remove('is-zoom'); }, 520);
    };
    if (RM() || fast) { up(); return; }
    PP[front()].classList.add('is-chosen');
    pick.classList.add('is-choosing');
    pTween(e => { spin = 360 * e; }, 760, easeIO, () => { spin = 0; place(); later(up, 60); });
  };
  pick.addEventListener('pointerdown', e => {
    if (chosen || pg || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (intro) settleRing();
    cancelAnimationFrame(pTw);
    pg = {id: e.pointerId, x: e.clientX, r0: rot, moved: false, lx: e.clientX, lt: performance.now(), v: 0, w: PP[0].offsetWidth || 180};
    try { pick.setPointerCapture(e.pointerId); } catch (_) {}
  });
  pick.addEventListener('pointermove', e => {
    if (!pg || e.pointerId !== pg.id) return;
    const dx = e.clientX - pg.x;
    if (!pg.moved && Math.abs(dx) < 8) return;
    pg.moved = true;
    const now = performance.now();
    pg.v = (e.clientX - pg.lx) / Math.max(1, now - pg.lt); pg.lx = e.clientX; pg.lt = now;
    const f0 = front();
    rot = pg.r0 - dx * STEP / (pg.w * .75); place();
    if (front() !== f0) ui.haptic('selection');
  });
  const pUp = e => {
    if (!pg || e.pointerId !== pg.id) return;
    const d = pg;
    pg = null;
    if (!d.moved) { if (e.type !== 'pointercancel') choose(); return; }
    // (let go: it coasts on with the flick and stops with a pack in front)
    const r0 = rot, to = Math.round((rot - d.v * 220 * STEP / (d.w * .75)) / STEP) * STEP;
    pTween(k => { rot = r0 + (to - r0) * k; }, 420, easeOut);
  };
  pick.addEventListener('pointerup', pUp); pick.addEventListener('pointercancel', pUp);

  // ---- the rip: drag across the pack's top; the strip tears under the finger (--p, 0..1: where the tear front is, from
  // the side you started), the torn part lifting behind it (css .dy-rip-top), the rest flat ahead of it (.dy-rip-rest)
  let drag = null, prog = 0, dir = 1, anim = 0, ripped = false;
  const set = v => {
    prog = Math.max(0, Math.min(1, v));
    rip.style.setProperty('--p', prog.toFixed(3)); rip.style.setProperty('--dir', String(dir));
  };
  const tween = (to, ms, then) => {
    cancelAnimationFrame(anim);
    const from = prog, t1 = performance.now();
    if (RM() || ms <= 0) { set(to); if (then) then(); return; }
    const stepT = now => {
      if (closed) return;
      const k = Math.min(1, (now - t1) / ms), e = 1 - Math.pow(1 - k, 3);
      set(from + (to - from) * e);
      if (k < 1) anim = requestAnimationFrame(stepT); else if (then) then();
    };
    anim = requestAnimationFrame(stepT);
  };
  const tear = () => {
    if (ripped) return;
    ripped = true; drag = null;
    pk.classList.remove('is-drag'); pk.classList.add('is-touched');
    tween(1, 110, torn);
  };
  // (a tap with no swipe: the hint shows itself plainly, and the pack shivers)
  let nudgeT = 0;
  const nudge = () => {
    pk.classList.remove('is-nudge'); void pk.offsetWidth; pk.classList.add('is-nudge');
    clearTimeout(nudgeT); nudgeT = setTimeout(() => pk.classList.remove('is-nudge'), 1600);
    ui.haptic('light');
  };
  pk.addEventListener('pointerdown', e => {
    if (ripped || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cancelAnimationFrame(anim);
    clearTimeout(nudgeT); pk.classList.remove('is-nudge'); pk.classList.add('is-drag');
    // (measured once it holds still: is-drag stops its wiggle)
    const rr = rip.getBoundingClientRect();
    drag = {x: e.clientX, l: rr.left, r: rr.right, w: rr.width, moved: false, lx: e.clientX, lt: performance.now(), v: 0, tick: 0};
    try { pk.setPointerCapture(e.pointerId); } catch (_) {}
  });
  pk.addEventListener('pointermove', e => {
    if (!drag || ripped) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true; dir = dx > 0 ? 1 : -1; pk.classList.add('is-touched');
    }
    const now = performance.now();
    drag.v = (e.clientX - drag.lx) * dir / Math.max(1, now - drag.lt); drag.lx = e.clientX; drag.lt = now;
    // (the tear front is under the finger: how far across the pack it is from the side the swipe began. Begun in from
    // that side, the tear runs up to the finger at four times its pace rather than leaping there)
    set(Math.min((e.clientX - (dir > 0 ? drag.l : drag.r)) * dir / drag.w, Math.abs(dx) / (drag.w * .25)));
    const tick = Math.floor(prog * 4);
    if (tick > drag.tick) { drag.tick = tick; ui.haptic('selection'); }
    // (at the far side, near enough: a finger seldom lands on the very edge)
    if (prog >= .94) tear();
  });
  const letGo = () => {
    if (!drag || ripped) return;
    const d = drag;
    drag = null; pk.classList.remove('is-drag');
    if (!d.moved) { nudge(); return; }
    // (far enough across, or a quick flick past a quarter: it rips; short of it, the strip springs back)
    if (prog >= 0.55 || (prog >= 0.25 && d.v > 0.7)) tear();
    else tween(0, 240, () => pk.classList.remove('is-touched')); // (and the hint comes back)
  };
  pk.addEventListener('pointerup', letGo);
  pk.addEventListener('pointercancel', letGo);
  // (Enter or Space: it rips at once, the strip torn across on its own; a touch meanwhile leaves it be)
  pk.addEventListener('keydown', e => {
    if ((e.key !== 'Enter' && e.key !== ' ') || ripped) return;
    e.preventDefault();
    ripped = true; dir = 1; drag = null;
    pk.classList.remove('is-drag', 'is-nudge'); pk.classList.add('is-touched');
    tween(1, 420, torn);
  });

  // ---- closing: everything stops (timers, frames, the window's listener), focus goes back, onClose once
  const close = () => {
    if (closed) return;
    closed = true;
    D.markSeen([]);
    timers.forEach(clearTimeout); timers.clear();
    clearTimeout(nudgeT); clearTimeout(ffHold); clearInterval(ffI);
    cancelAnimationFrame(anim); cancelAnimationFrame(raf); cancelAnimationFrame(inRaf); cancelAnimationFrame(pTw);
    removeEventListener('keydown', onKey, true);
    ov.classList.remove('is-in'); ov.classList.add('is-out'); ov.style.pointerEvents = 'none';
    behind.forEach(el => { el.inert = false; el.classList.remove('pk-behind'); });
    setTimeout(() => ov.remove(), RM() ? 0 : 260);
    try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (_) {}
    if (onClose) onClose();
    // (what had focus may be gone, the screen drawn again under it: focusBack's in its place)
    if (focusBack && (!prevFocus || !prevFocus.isConnected || prevFocus === document.body)) {
      try { const el = typeof focusBack === 'string' ? document.querySelector(focusBack) : focusBack; if (el && el.focus) el.focus({preventScroll: true}); } catch (_) {}
    }
  };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    const k = e.key, onButton = e.target && e.target.closest && e.target.closest('button');
    if (phase === 'pick') {
      if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); turn(k === 'ArrowRight' ? 1 : -1); }
      else if ((k === 'Enter' || k === ' ') && !onButton) { e.preventDefault(); choose(); }
      return;
    }
    if (phase === 'dex' && (k === 'Enter' || k === ' ' || k === 'ArrowUp') && !onButton) { e.preventDefault(); register(); return; }
    if (phase !== 'open' && phase !== 'rise' && phase !== 'deal') return;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || ((k === 'Enter' || k === ' ') && !onButton)) { e.preventDefault(); step(k === 'ArrowRight' ? 1 : -1); }
  };
  addEventListener('keydown', onKey, true);
  ov.addEventListener('click', e => {
    if (e.target.closest('[data-dy-ff]')) { if (held) { held = false; return; } step(-1); return; }
    if (e.target.closest('[data-dy-skip]')) { showResults(); return; }
    if (e.target.closest('[data-dy-done]') && $('.pk-results').classList.contains('is-ready')) { next(); return; }
    if (e.target.closest('[data-dy-end]')) { close(); return; }
    // (a tap on the dex while it fills: done; not the tap that swiped the cards up)
    if (phase === 'reg' && e.target.closest('.dy-dex-book')) close();
  });
}
// The tear line across a pack, a zigzag 13% down from its top: the strip above it and the body below (clip-paths that
// meet exactly; css: --ct, --cb).
const TEAR = (() => {
  const CUT = 13, n = 12, pts = [];
  for (let i = 0; i <= n; i++) pts.push([+(i * 100 / n).toFixed(2), CUT + (i % 2 ? 1.6 : -0.6)]);
  const p = a => a.map(([x, y]) => `${x}% ${y}%`).join(',');
  return {top: `polygon(0% 0%,100% 0%,${p(pts.slice().reverse())})`, body: `polygon(${p(pts)},100% 100%,0% 100%)`};
})();
/** A card up close (views/dynasty.js cardSheet's): it tilts toward your finger (or the mouse) while it's on the card, a
 *  glare following, and a rare card's foil (◆◆◆◆, ★, ★★, a crown, a Legendary Trainer card) catching the light; flat at
 *  rest. Up and down drags still scroll the sheet (touch-action: pan-y). */
export function holo(el) {
  if (!el || !el.classList || el.dataset.holo) return;
  el.dataset.holo = '1';
  el.classList.add('dy-holo');
  if (el.matches('.m-d4, .is-full, .pk-trainer.m-d3') && !el.classList.contains('is-ghost')) el.classList.add('is-foil');
  el.insertAdjacentHTML('beforeend', '<i class="dy-foil" aria-hidden="true"></i><i class="dy-glare" aria-hidden="true"></i>');
  if (RM()) return;
  const aim = {x: 0, y: 0, on: false}, cur = {x: 0, y: 0, a: 0};
  let raf = 0;
  const frame = () => {
    raf = 0;
    if (!el.isConnected) return;
    cur.x += ((aim.on ? aim.x : 0) - cur.x) * .16; cur.y += ((aim.on ? aim.y : 0) - cur.y) * .16; cur.a += ((aim.on ? 1 : 0) - cur.a) * .12;
    const still = !aim.on && Math.abs(cur.x) + Math.abs(cur.y) + cur.a < .004;
    if (still) cur.x = cur.y = cur.a = 0;
    const s = el.style;
    s.setProperty('--ry', (cur.x * 14).toFixed(2)); s.setProperty('--rx', (-cur.y * 11).toFixed(2));
    s.setProperty('--gx', (50 + cur.x * 50).toFixed(1) + '%'); s.setProperty('--gy', (50 + cur.y * 50).toFixed(1) + '%');
    s.setProperty('--fx', (50 + cur.x * 48).toFixed(1) + '%'); s.setProperty('--fy', (50 + cur.y * 34).toFixed(1) + '%');
    s.setProperty('--ta', cur.a.toFixed(3));
    if (!still) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const move = e => {
    const b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
    aim.on = px >= 0 && px <= 1 && py >= 0 && py <= 1;
    aim.x = clamp(px * 2 - 1, -1, 1); aim.y = clamp(py * 2 - 1, -1, 1);
    kick();
  };
  const off = () => { aim.on = false; kick(); };
  el.addEventListener('pointerdown', move);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') off(); });
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
