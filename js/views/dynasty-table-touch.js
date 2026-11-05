// Pointer gestures for the owner table. A hold inspects; moving a held hand card drags it.
// No game state is changed here. The view revalidates the destination at release.
export function bindTableTouch(root, api) {
  let gesture = null, blockedUntil = 0;
  function clear() {
    if (!gesture) return;
    const g = gesture; gesture = null;
    clearTimeout(g.timer);
    g.preview?.remove(); g.ghost?.remove();
    root.querySelectorAll('.is-drop-ready, .is-drop-over, .is-held').forEach(el => el.classList.remove('is-drop-ready', 'is-drop-over', 'is-held'));
    try { root.releasePointerCapture(g.pointer); } catch (_) {}
  }
  const cancel = () => { if (gesture?.held) blockedUntil = Date.now() + 500; clear(); };
  function down(e) {
    if (e.button !== 0 || !e.isPrimary || !api.enabled()) return;
    const card = e.target.closest('[data-db-hand], [data-db-slot], [data-db-hidden]');
    if (!card || card.closest('.db-focus')) return;
    clear();
    const value = api.describe(card);
    if (!value) return;
    const g = gesture = {pointer: e.pointerId, card, value, x: e.clientX, y: e.clientY, held: false, dragging: false};
    g.timer = setTimeout(() => {
      if (gesture !== g || !api.enabled()) return clear();
      try { root.setPointerCapture(g.pointer); } catch (_) {}
      g.held = true; card.classList.add('is-held');
      const peek = g.preview = document.createElement('div');
      peek.className = 'db-peek'; peek.innerHTML = api.preview(value);
      peek.setAttribute('aria-hidden', 'true'); root.append(peek);
      api.haptic();
    }, 320);
  }
  function move(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.pointer) return;
    const distance = Math.hypot(e.clientX - g.x, e.clientY - g.y);
    if (g.scrolling) { g.scrollEl.scrollLeft = g.scrollStart - (e.clientX - g.x); e.preventDefault(); return; }
    if (!g.held) {
      if (distance > 14) {
        const hand = g.card.closest('.db-hand');
        if (hand && Math.abs(e.clientX - g.x) > Math.abs(e.clientY - g.y)) {
          clearTimeout(g.timer); try { root.setPointerCapture(g.pointer); } catch (_) {} g.scrolling = true; g.scrollEl = hand; g.scrollStart = hand.scrollLeft;
          hand.scrollLeft = g.scrollStart - (e.clientX - g.x); blockedUntil = Date.now() + 550;
        } else clear();
      }
      return;
    }
    e.preventDefault();
    if (!g.value.draggable || distance < 12) return;
    if (!g.dragging) {
      g.dragging = true; g.preview?.remove();
      const ghost = g.ghost = document.createElement('div');
      ghost.className = 'db-drag-ghost'; ghost.innerHTML = g.card.innerHTML;
      ghost.setAttribute('aria-hidden', 'true'); root.append(ghost);
      root.querySelectorAll('[data-db-drop]').forEach(el => { if (api.accepts(g.value, el.dataset.dbDrop)) el.classList.add('is-drop-ready'); });
    }
    g.ghost.style.left = `${e.clientX}px`; g.ghost.style.top = `${e.clientY - 35}px`;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-db-drop]');
    root.querySelectorAll('.is-drop-over').forEach(el => el.classList.remove('is-drop-over'));
    if (target && root.contains(target) && api.accepts(g.value, target.dataset.dbDrop)) target.classList.add('is-drop-over');
  }
  function up(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.pointer) return;
    if (!g.held) { if (g.scrolling) blockedUntil = Date.now() + 550; clear(); return; }
    e.preventDefault(); blockedUntil = Date.now() + 550;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-db-drop]');
    const drop = target && root.contains(target) ? target.dataset.dbDrop : null;
    clear();
    if (g.dragging) { if (drop && api.accepts(g.value, drop)) api.drop(g.value, drop); else api.invalid(); }
    else api.inspect(g.value);
  }
  function click(e) { if (Date.now() < blockedUntil) { e.preventDefault(); e.stopImmediatePropagation(); } }
  function context(e) { if (api.enabled() && e.target.closest('[data-db-hand], [data-db-slot], [data-db-hidden]')) e.preventDefault(); }
  function key(e) { if (e.key === 'Escape') cancel(); }
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move, {passive: false});
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('lostpointercapture', cancel);
  root.addEventListener('contextmenu', context);
  root.addEventListener('click', click, true);
  window.addEventListener('blur', cancel); window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', cancel); document.addEventListener('keydown', key);
  return {cancel, get active() { return !!gesture; }, get revision() { return gesture?.value.rev; }, stop() {
    cancel();
    root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', cancel);
    root.removeEventListener('lostpointercapture', cancel); root.removeEventListener('contextmenu', context);
    root.removeEventListener('click', click, true);
    window.removeEventListener('blur', cancel); window.removeEventListener('resize', cancel);
    document.removeEventListener('visibilitychange', cancel); document.removeEventListener('keydown', key);
  }};
}
