// Opening a Gridiron Dynasty booster pack, over everything (views/dynasty.js openPack calls openScene once the pack's
// cards are drawn and kept), played as Pokémon TCG Pocket plays it (the owner, Oct 29 2026, with a recording of Pocket's:
// "Opening packs should have this animation"). You rip it open with a swipe across its top (Oct 28 2026: "ripping it
// open by swiping across", with "a subtle hint showing players how to do this": a fingertip gliding along the tear line
// till you start), the strip tearing along your finger (short of far enough it springs back; Enter rips it too). Then a
// flash along the tear, the strip spun away, rainbow light out of the pack; the pack sinks and the first card rises out of
// it. The cards are a stack, the best last: swipe the top one away (or tap) for the next. Each card is revealed by its
// rarity as it comes to the top (the owner, Oct 29 2026: "Each player rarity should get a different animation when being
// opened in a pack. The more rare the player, the more exciting the animation"; revealOf, REVEAL): a Common is dealt
// face up; a Rare comes face down (Pocket's card back) and flips; an Epic hovers, a ring pulses and it flips with sparks
// and its stamp; a Legendary turns the ground gold with rays behind it, flashes as it flips, sparks, confetti; a Mythic ★
// turns it purple, drums (shakes harder and harder) before the flip, a rainbow sweep after; a ★★ (Prime, Gameday, Award)
// the same on blue; a Legend ♛ darkens the ground, a crown drops in, the card rises from the foot, drums, flips in the
// biggest flash, gold sparks and two bursts of confetti; from Epic up a star glints at its corner after. A tap while a
// reveal plays finishes it; the next moves on. The top card tilts under your finger, a rare one's foil catching the
// light. Then the lot, new ones marked. Reduced motion: each card simply face up, its ground and stamp still.
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
// A card's back, Pocket's: a deep blue swirl, the emblem (a football in a ring, as Pocket's ball) and the name, upside down
// at the foot as a real card's back; a silver edge
const SWIRL = (() => {
  let s = '';
  for (let k = 0; k < 10; k++) {
    const pts = [];
    for (let j = 0; j <= 40; j++) { const t = j / 40 * 3.3, r = 5 + t * 25, a = k * Math.PI / 5 + t; pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(70 + r * Math.sin(a)).toFixed(1)}`); }
    s += `<polyline points="${pts.join(' ')}"/>`;
  }
  return `<svg class="dy-back-swirl" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke-linecap="round">${s}</g></svg>`;
})();
const BACK = `<div class="dy-back-in">${SWIRL}<b class="dy-back-word">GRIDIRON<small>DYNASTY</small></b>`
  + `<span class="dy-back-ball"><i></i></span><b class="dy-back-word is-flip">GRIDIRON<small>DYNASTY</small></b></div>`;
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
  {tier: 5, name: 'star2', hold: 1000, flip: 620, sparks: 16, confetti: 70, haptics: [[0, 'medium'], [400, 'medium'], [800, 'medium'], [1310, 'success']], palette: ['#FFFFFF', '#8FE3FF', '#FFD94A'], label: 'Special'},
  {tier: 6, name: 'crown', hold: 1300, flip: 700, sparks: 22, confetti: 110, haptics: [[0, 'medium'], [400, 'medium'], [700, 'medium'], [1000, 'success'], [1650, 'celebrate'], [2300, 'success']], palette: ['#FFE68A', '#FFFFFF', '#FFB300', '#FFF6D6'], label: 'Legend'}
].map(r => Object.freeze({...r, total: r.hold + r.flip + (r.tier ? 900 : 420)}));
/** The reveal a card gets, by its mark (core/dynasty.js markOf): ◆ to ◆◆◆◆ tiers 0 to 3, ★ 4, ★★ 5, ♛ 6. */
export function revealOf(c) {
  const m = D.markOf(c);
  const tier = m.kind === 'c' ? 6 : m.kind === 's' ? (m.n >= 2 ? 5 : 4) : Math.min(3, Math.max(0, m.n - 1));
  const R = REVEAL[tier];
  const label = tier === 5 && c ? ({P: 'Prime', G: 'Gameday', A: 'Award'}[c.s] || R.label) : R.label;
  return {...R, label};
}
/** A card's reveal on the deal: the card (face down past tier 0, with Pocket's back) inside its effects; it plays once
 *  its slot is the top card's (css: .dy-dc.is-go). */
export function dealHTML(c, R, cardHTML, isNew) {
  const sparks = Array.from({length: R.sparks}, (_, i) => `<i class="pk-spk" style="--a:${Math.round(i * 360 / R.sparks + (i % 2) * 11)}deg;--d:${110 + (i % 3) * 40}px;--t:${(i % 4) * 45}ms;--c:${R.palette[i % R.palette.length]}"></i>`).join('');
  return `<div class="pk-deal-c t-${R.tier}${R.tier ? ' is-flip' : ' is-face'}${R.tier >= 4 ? ' is-shake' : ''}" style="--hold:${R.hold}ms;--flip:${R.flip}ms">`
    + (R.tier >= 3 ? '<i class="pk-fx-rays" aria-hidden="true"></i>' : '') + (R.tier >= 2 ? '<i class="pk-fx-ring" aria-hidden="true"></i>' : '')
    + (R.tier >= 6 ? '<i class="pk-fx-crown" aria-hidden="true">♛</i>' : '')
    + `<div class="pk-shake"><div class="pk-flip"><div class="pk-flip-back" aria-hidden="true">${BACK}</div>`
    + `<div class="pk-flip-front">${cardHTML}${isNew ? '<span class="pk-c-new is-big" aria-hidden="true">NEW</span>' : ''}${R.tier >= 4 ? '<i class="pk-fx-sweep" aria-hidden="true"></i>' : ''}</div></div></div>`
    + (R.tier >= 3 ? '<i class="pk-fx-flash" aria-hidden="true"></i>' : '') + (sparks ? `<span class="pk-spks" aria-hidden="true">${sparks}</span>` : '')
    + (R.label ? `<b class="pk-deal-tag">${R.label}</b>` : '') + (R.tier >= 2 ? '<i class="pk-fx-glint" aria-hidden="true"></i>' : '') + '</div>';
}

/** Opens a pack on screen. o: {kind (core/dynasty.js PACKS key), design (views/dynasty-packs.js designsOf's index), cards
 *  (the ids drawn), dup ({id: true} for copies already held), cardHTML (views/dynasty.js anyHTML), onClose (after it's
 *  gone), focusBack (optional: where focus goes after onClose when what had it is gone, an element or a selector)}. */
export function openScene({kind, design = 0, cards, dup, cardHTML: anyHTML, onClose, focusBack}) {
  const r = {cards, dup}, P = D.PACKS[kind];
  // (the best last, as Pocket reveals: a Trainer card first)
  const order = r.cards.map(D.anyCard).map((c, i) => ({c, i})).sort((a, b) => (a.c.o || 0) - (b.c.o || 0)).map(x => x.c);
  const N = order.length, fresh = order.filter(c => !r.dup[c.id]).length;
  const ov = document.createElement('div');
  ov.className = 'pk-open';
  ov.dataset.phase = 'rip'; ov.dataset.tier = '';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Opening a ${P.name}`);
  ov.style.setProperty('--pc', P.color);
  ov.innerHTML = `<div class="pk-open-bg" aria-hidden="true"><i class="pk-open-tint"></i><span class="dy-bg-spk">${DRIFT}</span></div>`
    + `<div class="dy-stage"><div class="dy-deal">`
    + `<div class="dy-deck" tabindex="-1" role="group" aria-label="The cards: tap, swipe or press Enter for the next"></div>`
    + `<p class="dy-deck-meta" aria-hidden="true"><b class="pk-deal-n"></b><span class="dy-deal-hint">Tap or swipe</span></p></div>`
    + `<div class="dy-open-pack" data-dy-tear tabindex="0" role="button" aria-label="Rip the pack open: swipe across its top, or press Enter">`
    + `<div class="dy-rip" style="--p:0;--dir:1"><span class="dy-rays" aria-hidden="true">${RAYS}</span><span class="dy-motes" aria-hidden="true">${MOTES}</span>`
    + `<div class="dy-rip-body" style="clip-path:${TEAR.body}">${packHTML(kind, {big: true, design})}</div>`
    + `<div class="dy-rip-top" style="clip-path:${TEAR.top}">${packHTML(kind, {big: true, design})}</div>`
    + `<span class="dy-rip-line" aria-hidden="true"></span><span class="dy-flare" aria-hidden="true"></span>`
    + `<span class="dy-rip-hint" aria-hidden="true"><i class="dy-rip-trail"></i><i class="dy-rip-finger"></i></span></div>`
    + `<p class="dy-rip-say">Swipe across the top to rip it open</p></div></div>`
    + `<i class="dy-wash" aria-hidden="true"></i>`
    + `<button type="button" class="pk-pill dy-skip" data-dy-skip hidden>Skip</button>`
    + `<button type="button" class="dy-ff" data-dy-ff hidden aria-label="Fast forward: tap for the next card, or hold to skip to the results"><span class="dy-ff-b">${FF_ICON}</span><small aria-hidden="true">Tap and hold</small></button>`
    + `<div class="pk-results" hidden><h2>Results</h2><div class="pk-grid is-results${N > 5 ? ' is-many' : ''}">${order.map((c, i) => `<div class="pk-res-c" style="--i:${i}">${anyHTML(c.id, {size: 's', tag: false, noCount: true})}`
      + `${r.dup[c.id] ? '' : '<span class="pk-c-new">NEW</span>'}</div>`).join('')}</div><p class="pk-note">+${D.PP_PER_PACK} pack points</p>`
    + `<button type="button" class="pk-open" data-dy-done>Done</button></div>`
    + `<p class="sr-only" aria-live="polite" data-dy-say></p>`;
  document.body.appendChild(ov);
  const prevFocus = document.activeElement;
  // (the app behind it is out of reach while it's open, as under a sheet: Tab stays in here)
  const behind = ['stage', 'tabbar'].map(id => document.getElementById(id)).filter(el => el && !el.inert);
  behind.forEach(el => { el.inert = true; });
  const $ = s => ov.querySelector(s);
  const stage = $('.dy-stage'), deck = $('.dy-deck'), nTxt = $('.pk-deal-n'), hint = $('.dy-deal-hint'), say = $('[data-dy-say]'),
    skipB = $('[data-dy-skip]'), ffB = $('[data-dy-ff]'), pk = $('.dy-open-pack'), rip = pk.querySelector('.dy-rip');
  // (every timer goes through later(), so closing clears the lot; none fires once it's closed)
  let closed = false, phase = 'rip';
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!closed) fn(); }, ms); timers.add(t); return t; };
  const drop = list => list.splice(0).forEach(t => { clearTimeout(t); timers.delete(t); });
  const setPhase = p => { phase = p; ov.dataset.phase = p; };
  const inRaf = requestAnimationFrame(() => ov.classList.add('is-in'));
  pk.focus();

  // ---- the cards: a stack, the top one showing (slots: each card's element, made as it comes near the top)
  const slots = [];
  let at = 0, top = null;
  // (a slot: the card's tilt round its reveal, dealHTML's; the foil and the glare on its face, a rare one's foil showing)
  const slotHTML = (c, i) => {
    const R = revealOf(c), foil = R.tier >= 3 || (!c.s && c.r === 'legendary');
    const face = `${anyHTML(c.id, {size: 'l', tag: false, noCount: true})}<i class="dy-foil"></i><i class="dy-glare"></i><i class="dy-sheen"></i>`;
    return `<div class="dy-dc t${R.tier}${foil ? ' is-foil' : ''}" data-i="${i}" aria-hidden="true"><div class="dy-tilt">${dealHTML(c, R, face, !r.dup[c.id])}</div></div>`;
  };
  // (a card goes in under the others: the top one stays on top)
  const mount = i => {
    if (slots[i] || i >= N) return slots[i];
    deck.insertAdjacentHTML('afterbegin', slotHTML(order[i], i));
    return (slots[i] = deck.firstElementChild);
  };
  // ---- a card's reveal, by its rarity (rv: the one playing; its haptics and confetti on the CSS's clock, --hold and
  // --flip; a tap finishes it: everything at its end, is-skip)
  let rv = null;
  const rvT = [];
  const burst = (R, again) => { try { ui.confetti(top.getBoundingClientRect(), {colors: R.palette, count: again ? Math.round(R.confetti * .6) : R.confetti}); } catch (_) {} };
  const endReveal = (skip = true) => {
    if (!rv) return;
    const el = rv;
    rv = null; delete ov.dataset.rv; drop(rvT);
    if (skip) { el.classList.add('is-skip'); ui.haptic('light'); }
    kick();
  };
  const begin = (fast = false) => {
    const c = order[at], R = revealOf(c), el = top, deal = el.querySelector('.pk-deal-c');
    drop(rvT);
    ov.dataset.tier = String(R.tier);
    nTxt.textContent = `${at + 1} of ${N}${R.label ? ` · ${R.label}` : ''}`;
    hint.hidden = at > 0;
    const pc = el.querySelector('.pk-card');
    say.textContent = `${at + 1} of ${N}${R.label ? `, ${R.label}` : ''}: ${(pc && pc.getAttribute('aria-label')) || c.name}${r.dup[c.id] ? '' : ', new'}`;
    cur.x = cur.y = cur.a = 0;
    el.classList.add('is-go');
    if (fast) { deal.classList.add('is-skip'); return; }
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
    pk.classList.add('is-torn'); ov.classList.add('is-flash');
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
    pk.hidden = true; ov.classList.remove('is-flash');
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
      const w = deck.offsetWidth;
      el.style.transition = 'transform .3s cubic-bezier(.3,.5,.55,1), opacity .3s ease-in, filter .3s';
      el.style.transform = `translate(${(dir * (innerWidth / 2 + w * .85)).toFixed(0)}px, ${(-w * .08).toFixed(0)}px) rotate(${dir * 15}deg) scaleX(1.06)`;
      el.style.filter = 'blur(5px)'; el.style.opacity = '.35';
    }
    later(() => el.remove(), 360);
  };
  const advance = (dir = -1, fast = false) => {
    if (phase !== 'deal' || !top) return;
    endReveal();
    fly(top, dir);
    at++;
    if (at >= N) { top = null; setPhase('done'); ffB.hidden = true; later(showResults, fast ? 140 : 300); return; }
    top = mount(at); top.classList.add('is-top');
    mount(at + 1);
    begin(fast);
  };
  // (a tap, Enter, an arrow key or the ⏩ button: the opening skipped to its end, a reveal finished, or the next card)
  const step = (dir = -1) => {
    if (phase === 'open' || phase === 'rise') { settle(); return; }
    if (phase !== 'deal') return;
    if (rv) { endReveal(); return; }
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
    $('[data-dy-done]').focus({preventScroll: true});
    // (Done answers once the lot is in: a quick tap meant for the last card doesn't close it)
    later(() => res.classList.add('is-ready'), 380);
  };
  // ---- ⏩: a tap for the next, held (0.4 s) it runs through the rest to the results
  let ffI = 0, ffHold = 0, held = false;
  const ffAll = () => {
    if (phase === 'open' || phase === 'rise') settle();
    if (phase !== 'deal') return;
    ffB.classList.add('is-on');
    endReveal();
    const tick = () => { if (phase !== 'deal' || closed) { clearInterval(ffI); return; } advance(-1, true); };
    tick(); ffI = setInterval(tick, 130);
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
  // (hold: where the finger is, -1..1 across and down; cur: the tilt now, eased toward it; a rare card sways on its own)
  const hold = {x: 0, y: 0, on: false}, cur = {x: 0, y: 0, a: 0};
  let raf = 0, g = null;
  const t0 = performance.now();
  const kick = () => { if (!raf && !closed) raf = requestAnimationFrame(frame); };
  const frame = now => {
    raf = 0;
    if (closed || !top) return;
    const sway = !hold.on && !rv && phase === 'deal' && top.classList.contains('is-foil') && !RM(), k = (now - t0) / 1000;
    const tx = hold.on ? hold.x : sway ? Math.sin(k * .85) * .7 : 0, ty = hold.on ? hold.y : sway ? Math.sin(k * 1.25 + 1) * .42 : 0;
    cur.x += (tx - cur.x) * .14; cur.y += (ty - cur.y) * .14; cur.a += ((hold.on ? 1 : sway ? .55 : 0) - cur.a) * .1;
    const s = top.style, still = !hold.on && !sway && Math.abs(cur.x) + Math.abs(cur.y) + cur.a < .004;
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
    if (phase === 'rip' || phase === 'results' || phase === 'done' || g || (e.pointerType === 'mouse' && e.button !== 0)) return;
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

  // ---- the rip: drag across the pack's top; the strip tears along the finger (--p, 0..1, from the side you started)
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
    const rr = rip.getBoundingClientRect();
    drag = {x: e.clientX, w: rr.width, moved: false, lx: e.clientX, lt: performance.now(), v: 0, tick: 0};
    try { pk.setPointerCapture(e.pointerId); } catch (_) {}
    clearTimeout(nudgeT); pk.classList.remove('is-nudge'); pk.classList.add('is-drag');
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
    set(dx * dir / (drag.w * 0.85));
    const tick = Math.floor(prog * 4);
    if (tick > drag.tick) { drag.tick = tick; ui.haptic('selection'); }
    if (prog >= 1) tear();
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
  pk.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !ripped) { e.preventDefault(); dir = 1; pk.classList.add('is-touched'); tween(1, 420, tear); } });

  // ---- closing: everything stops (timers, frames, the window's listener), focus goes back, onClose once
  const close = () => {
    if (closed) return;
    closed = true;
    D.markSeen([]);
    timers.forEach(clearTimeout); timers.clear();
    clearTimeout(nudgeT); clearTimeout(ffHold); clearInterval(ffI);
    cancelAnimationFrame(anim); cancelAnimationFrame(raf); cancelAnimationFrame(inRaf);
    removeEventListener('keydown', onKey, true);
    ov.classList.remove('is-in'); ov.classList.add('is-out'); ov.style.pointerEvents = 'none';
    behind.forEach(el => { el.inert = false; });
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
    if (phase !== 'open' && phase !== 'rise' && phase !== 'deal') return;
    const k = e.key, onButton = e.target && e.target.closest && e.target.closest('button');
    if (k === 'ArrowLeft' || k === 'ArrowRight' || ((k === 'Enter' || k === ' ') && !onButton)) { e.preventDefault(); step(k === 'ArrowRight' ? 1 : -1); }
  };
  addEventListener('keydown', onKey, true);
  ov.addEventListener('click', e => {
    if (e.target.closest('[data-dy-ff]')) { if (held) { held = false; return; } step(-1); return; }
    if (e.target.closest('[data-dy-skip]')) { showResults(); return; }
    if (e.target.closest('[data-dy-done]') && $('.pk-results').classList.contains('is-ready')) close();
  });
}
// The tear line across a pack, a zigzag at CUT down from its top: the strip above it and the body below (clip-paths that
// meet exactly).
const TEAR = (() => {
  const CUT = 13, n = 12, pts = [];
  for (let i = 0; i <= n; i++) pts.push([+(i * 100 / n).toFixed(2), CUT + (i % 2 ? 1.6 : -0.6)]);
  const p = a => a.map(([x, y]) => `${x}% ${y}%`).join(',');
  return {top: `polygon(0% 0%,100% 0%,${p(pts.slice().reverse())})`, body: `polygon(${p(pts)},100% 100%,0% 100%)`, cut: CUT};
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
