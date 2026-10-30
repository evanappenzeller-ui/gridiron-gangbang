// Opt-in foil interaction for enlarged Rivals cards. Pointer events remain passive so normal scrolling,
// card taps and pack gestures keep their existing behavior. Return value tears down every owned effect.
const CARD = '.pk-rivals-card:is(.r-rare, .r-epic, .r-legendary, .r-mythic):not(.sz-s)';
const VARS = ['--shine-x', '--shine-y', '--tilt-x', '--tilt-y'];
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

export function bindCardFoil(root) {
  if (!root || typeof root.addEventListener !== 'function') return () => {};
  const win = root.ownerDocument?.defaultView || window;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let active = null, point = null, frame = 0, dead = false;
  const owned = new Set();
  const clearCard = card => {
    if (!card) return;
    card.classList.remove('is-foil-active');
    VARS.forEach(name => card.style.removeProperty(name));
    owned.delete(card);
  };
  const reset = () => {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0; point = null;
    clearCard(active); active = null;
  };
  const cardAt = target => {
    const el = target && (target.nodeType === 1 ? target : target.parentElement);
    const card = el?.closest?.(CARD);
    return card && root.contains(card) && !card.closest('.pk-grid, [data-dy-grid]') ? card : null;
  };
  const render = () => {
    frame = 0;
    if (dead || motion.matches || !active || !root.contains(active)) { reset(); return; }
    const rect = active.getBoundingClientRect();
    if (!rect.width || !rect.height) { reset(); return; }
    const x = point ? clamp((point.x - rect.left) / rect.width, 0, 1) : .5;
    const y = point ? clamp((point.y - rect.top) / rect.height, 0, 1) : .5;
    const tilt = !!active.closest('.pk-zoom');
    active.style.setProperty('--shine-x', `${(x * 100).toFixed(2)}%`);
    active.style.setProperty('--shine-y', `${(y * 100).toFixed(2)}%`);
    active.style.setProperty('--tilt-x', `${(tilt ? (.5 - y) * 8 : 0).toFixed(2)}deg`);
    active.style.setProperty('--tilt-y', `${(tilt ? (x - .5) * 8 : 0).toFixed(2)}deg`);
    active.classList.add('is-foil-active');
    owned.add(active);
  };
  const select = (card, nextPoint) => {
    if (dead || motion.matches || !card) { reset(); return; }
    if (card !== active) { reset(); active = card; }
    point = nextPoint;
    if (!frame) frame = win.requestAnimationFrame(render);
  };
  const move = event => select(cardAt(event.target), {x: event.clientX, y: event.clientY});
  const out = event => {
    if (active && (!event.relatedTarget || !active.contains(event.relatedTarget))) reset();
  };
  const focus = event => select(cardAt(event.target), null);
  const blur = event => {
    if (active && (!event.relatedTarget || !active.contains(event.relatedTarget))) reset();
  };
  const changeMotion = () => { if (motion.matches) reset(); };
  root.addEventListener('pointermove', move, {passive: true});
  root.addEventListener('pointerout', out, {passive: true});
  root.addEventListener('pointerleave', reset, {passive: true});
  root.addEventListener('pointercancel', reset, {passive: true});
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', blur);
  win.addEventListener('blur', reset);
  motion.addEventListener('change', changeMotion);
  return () => {
    if (dead) return;
    dead = true; reset();
    owned.forEach(clearCard);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerout', out);
    root.removeEventListener('pointerleave', reset);
    root.removeEventListener('pointercancel', reset);
    root.removeEventListener('focusin', focus);
    root.removeEventListener('focusout', blur);
    win.removeEventListener('blur', reset);
    motion.removeEventListener('change', changeMotion);
  };
}
