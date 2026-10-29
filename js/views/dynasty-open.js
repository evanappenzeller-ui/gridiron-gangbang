// Opening a Gridiron Dynasty booster pack, over everything (views/dynasty.js openPack calls openScene once the pack's
// cards are drawn and kept). You rip it open with a swipe across its top (the owner's ask, Oct 28 2026: "ripping it
// open by swiping across", with "a subtle hint showing players how to do this": a fingertip gliding along the tear line
// till you start), the strip tearing along your finger and flying off once you're far enough across (short of it, it
// springs back; Enter rips it too); then, as in Pocket, its cards one at a time, tap for the next, and the lot at the
// end, new ones marked. Each card is revealed by its rarity (the owner, Oct 29 2026: "Each player rarity should get a
// different animation when being opened in a pack. The more rare the player, the more exciting the animation"; revealOf,
// REVEAL): a Common is dealt face up; a Rare comes face down and flips; an Epic hovers, a ring pulses and it flips with
// sparks and its stamp; a Legendary turns the ground gold with rays behind it, flashes as it flips, sparks, confetti; a
// Mythic ★ turns it purple, drums (shakes harder and harder) before the flip, a rainbow sweep after; a ★★ (Prime,
// Gameday, Award) the same on blue; a Legend ♛ darkens the ground, a crown drops in, the card rises from the foot, drums,
// flips in the biggest flash, gold sparks and two bursts of confetti. A tap while a reveal plays finishes it; the next
// moves on. Reduced motion: each card simply appears face up, its ground and stamp still. css/views/dynasty-open.css
// dresses it.
import * as ui from '../core/ui.js';
import * as D from '../core/dynasty.js';
import {packHTML} from './dynasty-packs.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
/** A card's reveal on the deal: the card (face down past tier 0, with its back) inside its effects. */
export function dealHTML(c, R, cardHTML, isNew) {
  const sparks = Array.from({length: R.sparks}, (_, i) => `<i class="pk-spk" style="--a:${Math.round(i * 360 / R.sparks + (i % 2) * 11)}deg;--d:${110 + (i % 3) * 40}px;--t:${(i % 4) * 45}ms;--c:${R.palette[i % R.palette.length]}"></i>`).join('');
  return `<div class="pk-deal-c t-${R.tier}${R.tier ? ' is-flip' : ' is-face'}${R.tier >= 4 ? ' is-shake' : ''}" style="--hold:${R.hold}ms;--flip:${R.flip}ms">`
    + (R.tier >= 3 ? '<i class="pk-fx-rays" aria-hidden="true"></i>' : '') + (R.tier >= 2 ? '<i class="pk-fx-ring" aria-hidden="true"></i>' : '')
    + (R.tier >= 6 ? '<i class="pk-fx-crown" aria-hidden="true">♛</i>' : '')
    + `<div class="pk-shake"><div class="pk-flip"><div class="pk-flip-back" aria-hidden="true"><i class="pk-back-ball"></i><b>GRIDIRON<small>DYNASTY</small></b></div>`
    + `<div class="pk-flip-front">${cardHTML}${isNew ? '<span class="pk-c-new is-big" aria-hidden="true">NEW</span>' : ''}${R.tier >= 4 ? '<i class="pk-fx-sweep" aria-hidden="true"></i>' : ''}</div></div></div>`
    + (R.tier >= 3 ? '<i class="pk-fx-flash" aria-hidden="true"></i>' : '') + (sparks ? `<span class="pk-spks" aria-hidden="true">${sparks}</span>` : '')
    + (R.label ? `<b class="pk-deal-tag">${R.label}</b>` : '') + '</div>';
}

/** Opens a pack on screen. o: {kind (core/dynasty.js PACKS key), cards (the ids drawn), dup ({id: true} for copies
 *  already held), cardHTML (views/dynasty.js anyHTML), onClose (after it's gone)}. */
export function openScene({kind, design = 0, cards, dup, cardHTML: anyHTML, onClose}) {
  const r = {cards, dup};
  // (the best last, as Pocket reveals: a Trainer card first)
  const order = r.cards.map(D.anyCard).map((c, i) => ({c, i})).sort((a, b) => (a.c.o || 0) - (b.c.o || 0)).map(x => x.c);
  const ov = document.createElement('div');
  ov.className = 'pk-open';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Opening a ${D.PACKS[kind].name}`);
  ov.innerHTML = `<div class="pk-open-bg" style="--pc:${D.PACKS[kind].color}"><i class="pk-open-tint" aria-hidden="true"></i></div>`
    + `<div class="dy-open-pack" data-dy-tear tabindex="0" role="button" aria-label="Rip the pack open: swipe across its top, or press Enter">`
    + `<div class="dy-rip" style="--p:0;--dir:1"><div class="dy-rip-body" style="clip-path:${TEAR.body}">${packHTML(kind, {big: true, design})}</div>`
    + `<div class="dy-rip-top" style="clip-path:${TEAR.top}">${packHTML(kind, {big: true, design})}</div>`
    + `<span class="dy-rip-line" aria-hidden="true"></span><span class="dy-rip-hint" aria-hidden="true"><i class="dy-rip-trail"></i><i class="dy-rip-finger"></i></span></div>`
    + `<p class="dy-rip-say">Swipe across the top to rip it open</p></div>`
    + `<div class="pk-deal" hidden><div class="pk-deal-stack" aria-live="polite"></div><p class="pk-deal-n"></p></div>`
    + `<div class="pk-results" hidden><h2>Results</h2><div class="pk-grid is-results">${order.map(c => `<div class="pk-res-c">${anyHTML(c.id, {size: 's', tag: false, noCount: true})}`
      + `${r.dup[c.id] ? '' : '<span class="pk-c-new">NEW</span>'}</div>`).join('')}</div><p class="pk-note">+${D.PP_PER_PACK} pack points</p></div>`
    + `<div class="pk-open-bar" hidden><button type="button" class="pk-pill" data-dy-skip>Skip</button><button type="button" class="pk-open" data-dy-next>Next</button></div>`;
  document.body.appendChild(ov);
  const prevFocus = document.activeElement;
  requestAnimationFrame(() => ov.classList.add('is-in'));
  ov.querySelector('[data-dy-tear]').focus();
  // ---- the cards, one at a time, each revealed by its rarity (revealOf), then the results
  let at = -1, cur = null;
  const stack = ov.querySelector('.pk-deal-stack'), nTxt = ov.querySelector('.pk-deal-n'), bar = ov.querySelector('.pk-open-bar');
  const clearCur = () => { if (cur) { cur.timers.forEach(clearTimeout); cur = null; } };
  const burst = (R, again) => { try { ui.confetti(stack.getBoundingClientRect(), {colors: R.palette, count: again ? Math.round(R.confetti * .6) : R.confetti}); } catch (_) {} };
  // (a tap while the reveal plays: it finishes, the card face up with its stamp; the next tap moves on)
  const finish = () => {
    if (!cur) return;
    cur.timers.forEach(clearTimeout); cur.timers = []; cur.done = true;
    cur.el.classList.add('is-skip');
    ui.haptic('light');
  };
  const showResults = () => {
    clearCur(); ov.dataset.tier = '';
    at = order.length;
    ov.querySelector('.pk-deal').hidden = true; ov.querySelector('.pk-results').hidden = false;
    ov.querySelector('[data-dy-skip]').hidden = true; ov.querySelector('[data-dy-next]').textContent = 'Done';
    ov.querySelector('[data-dy-next]').focus();
  };
  const next = () => {
    if (at >= order.length) { close(); return; }
    if (cur && !cur.done && cur.R.tier > 0 && !RM() && performance.now() - cur.t0 < cur.R.total) { finish(); return; }
    if (at === order.length - 1) { showResults(); return; }
    at++;
    clearCur();
    const c = order[at], R = revealOf(c);
    const old = stack.querySelector('.pk-deal-c:not(.is-gone)');
    if (old) { old.classList.add('is-gone'); setTimeout(() => old.remove(), RM() ? 0 : 420); }
    stack.insertAdjacentHTML('beforeend', dealHTML(c, R, anyHTML(c.id, {size: 'l', tag: false, noCount: true}), !r.dup[c.id]));
    const el = stack.lastElementChild;
    ov.dataset.tier = String(R.tier);
    nTxt.textContent = `${at + 1} of ${order.length}${R.label ? ` · ${R.label}` : ''}`;
    // (what the screen does is CSS, timed from --hold and --flip; the haptics and confetti follow the same clock)
    const when = ms => (RM() ? 0 : ms);
    cur = {el, R, t0: performance.now(), done: false, timers: []};
    R.haptics.forEach(([t, k]) => cur.timers.push(setTimeout(() => ui.haptic(k), when(t))));
    if (R.confetti) cur.timers.push(setTimeout(() => burst(R), when(R.hold + R.flip / 2)));
    if (R.tier >= 6) cur.timers.push(setTimeout(() => burst(R, true), when(R.hold + R.flip / 2 + 650)));
    cur.timers.push(setTimeout(() => { if (cur && cur.el === el) cur.done = true; }, when(R.total)));
  };
  // ---- the rip: drag across the pack's top; the strip tears along the finger (--p, 0..1, from the side you started)
  const pk = ov.querySelector('.dy-open-pack'), rip = pk.querySelector('.dy-rip');
  let drag = null, prog = 0, dir = 1, anim = 0, ripped = false;
  const set = v => {
    prog = Math.max(0, Math.min(1, v));
    rip.style.setProperty('--p', prog.toFixed(3)); rip.style.setProperty('--dir', String(dir));
  };
  const tween = (to, ms, then) => {
    cancelAnimationFrame(anim);
    const from = prog, t0 = performance.now();
    if (RM() || ms <= 0) { set(to); if (then) then(); return; }
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      set(from + (to - from) * e);
      if (k < 1) anim = requestAnimationFrame(step); else if (then) then();
    };
    anim = requestAnimationFrame(step);
  };
  const tear = () => {
    if (ripped) return;
    ripped = true; drag = null;
    pk.classList.remove('is-drag'); pk.classList.add('is-touched');
    tween(1, 110, () => {
      pk.classList.add('is-torn'); ui.haptic('medium');
      setTimeout(() => { pk.hidden = true; ov.querySelector('.pk-deal').hidden = false; bar.hidden = false; next(); ov.querySelector('[data-dy-next]').focus(); }, RM() ? 0 : 560);
    });
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
  const close = () => {
    clearCur();
    D.markSeen([]);
    ov.classList.remove('is-in'); ov.classList.add('is-out');
    setTimeout(() => ov.remove(), RM() ? 0 : 260);
    removeEventListener('keydown', onKey, true);
    try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (_) {}
    if (onClose) onClose();
  };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  addEventListener('keydown', onKey, true);
  ov.addEventListener('click', e => {
    if (e.target.closest('[data-dy-tear]')) return; // (the rip is a swipe: pointer events above)
    if (e.target.closest('[data-dy-skip]')) { showResults(); return; }
    if (e.target.closest('[data-dy-next]') || e.target.closest('.pk-deal')) next();
  });
  pk.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !ripped) { e.preventDefault(); dir = 1; pk.classList.add('is-touched'); tween(1, 420, tear); } });
}
// The tear line across a pack, a zigzag at CUT down from its top: the strip above it and the body below (clip-paths that
// meet exactly).
const TEAR = (() => {
  const CUT = 13, n = 12, pts = [];
  for (let i = 0; i <= n; i++) pts.push([+(i * 100 / n).toFixed(2), CUT + (i % 2 ? 1.6 : -0.6)]);
  const p = a => a.map(([x, y]) => `${x}% ${y}%`).join(',');
  return {top: `polygon(0% 0%,100% 0%,${p(pts.slice().reverse())})`, body: `polygon(${p(pts)},100% 100%,0% 100%)`, cut: CUT};
})();
/** A card up close (views/dynasty.js cardSheet's): tilts under your finger, its foil catching the light. (To come.) */
export function holo(el) {}
