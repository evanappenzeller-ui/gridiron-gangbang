// Opening a Gridiron Dynasty booster pack, over everything (views/dynasty.js openPack calls openScene once the pack's
// cards are drawn and kept). You rip it open with a swipe across its top (the owner's ask, Oct 28 2026: "ripping it
// open by swiping across", with "a subtle hint showing players how to do this": a fingertip gliding along the tear line
// till you start), the strip tearing along your finger and flying off once you're far enough across (short of it, it
// springs back; Enter rips it too); then, as in Pocket, its cards one at a time (a ★ card with a shine first), tap for
// the next, and the lot at the end, new ones marked. css/views/dynasty-open.css dresses it.
import * as ui from '../core/ui.js';
import * as D from '../core/dynasty.js';
import {packHTML} from './dynasty-packs.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Opens a pack on screen. o: {kind (core/dynasty.js PACKS key), cards (the ids drawn), dup ({id: true} for copies
 *  already held), cardHTML (views/dynasty.js anyHTML), onClose (after it's gone)}. */
export function openScene({kind, design = 0, cards, dup, cardHTML: anyHTML, onClose}) {
  const r = {cards, dup};
  // (the best last, as Pocket reveals: a Trainer card first)
  const order = r.cards.map(D.anyCard).map((c, i) => ({c, i})).sort((a, b) => (a.c.o || 0) - (b.c.o || 0)).map(x => x.c);
  const ov = document.createElement('div');
  ov.className = 'pk-open';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Opening a ${D.PACKS[kind].name}`);
  ov.innerHTML = `<div class="pk-open-bg" style="--pc:${D.PACKS[kind].color}"></div>`
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
  // ---- the cards, one at a time (a ★ or crown card shines first), then the results
  let at = -1;
  const stack = ov.querySelector('.pk-deal-stack'), nTxt = ov.querySelector('.pk-deal-n'), bar = ov.querySelector('.pk-open-bar');
  const showResults = () => {
    at = order.length;
    ov.querySelector('.pk-deal').hidden = true; ov.querySelector('.pk-results').hidden = false;
    ov.querySelector('[data-dy-skip]').hidden = true; ov.querySelector('[data-dy-next]').textContent = 'Done';
    ov.querySelector('[data-dy-next]').focus();
  };
  const next = () => {
    if (at >= order.length) { close(); return; }
    if (at === order.length - 1) { showResults(); return; }
    at++;
    const c = order[at], m = D.markOf(c), rare = m.kind !== 'd';
    const old = stack.querySelector('.pk-deal-c:not(.is-gone)');
    if (old) { old.classList.add('is-gone'); setTimeout(() => old.remove(), RM() ? 0 : 420); }
    stack.insertAdjacentHTML('beforeend', `<div class="pk-deal-c${rare ? ' is-rare' : ''}${m.kind === 'c' ? ' is-crown' : ''}">${anyHTML(c.id, {size: 'l', tag: false, noCount: true})}`
      + `${r.dup[c.id] ? '' : '<span class="pk-c-new is-big">NEW</span>'}</div>`);
    nTxt.textContent = `${at + 1} of ${order.length}`;
    if (rare) { ui.haptic('success'); if (m.kind === 'c' || m.n > 1) { try { ui.confetti(stack.getBoundingClientRect(), {colors: ['#FFD94A', '#6DD3F5', '#F27BB8', '#FFFFFF'], count: 60}); } catch (_) {} } }
    else ui.haptic('light');
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
