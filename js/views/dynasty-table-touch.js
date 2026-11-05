// Pointer gestures for the owner table. Hold and slide along the hand to lift cards;
// leave the hand to drag the selected card into play.
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
  function preview(g) {
    g.ghost?.remove(); g.ghost = null; g.dragging = false;
    root.querySelectorAll('.is-drop-ready, .is-drop-over').forEach(el => el.classList.remove('is-drop-ready', 'is-drop-over'));
    if (!g.preview?.isConnected) {
      g.preview = document.createElement('div');
      g.preview.className = g.value.kind === 'hand' ? 'db-hand-pop' : 'db-peek';
      g.preview.setAttribute('aria-hidden', 'true'); root.append(g.preview);
    }
    if (g.value.kind === 'hand') {
      // Lift only the card, above its place in the fan. No modal, dimmer or move list.
      g.preview.innerHTML = g.card.innerHTML;
      g.preview.dataset.card = g.value.id;
      const r = g.card.getBoundingClientRect(), bounds = root.getBoundingClientRect();
      const w = g.preview.offsetWidth, h = g.preview.offsetHeight;
      g.preview.style.left = `${Math.max(bounds.left + w / 2 + 8, Math.min(bounds.right - w / 2 - 8, r.left + r.width / 2))}px`;
      g.preview.style.top = `${Math.max(bounds.top + 8, r.bottom - h - 42)}px`;
      root.querySelectorAll('[data-db-drop]').forEach(el => { if (api.accepts(g.value, el.dataset.dbDrop)) el.classList.add('is-drop-ready'); });
    } else g.preview.innerHTML = api.preview(g.value);
  }
  function browse(g, x, y) {
    const hand = g.card.closest('.db-hand');
    if (!hand) return false;
    const r = hand.getBoundingClientRect();
    if (y < r.top || y > r.bottom || x < r.left || x > r.right) return false;
    // The preview ignores hit testing. Prefer the actual card under the finger;
    // in a gap choose the nearest visible card, including fanned/overlapping cards.
    let card = document.elementFromPoint(x, y)?.closest('[data-db-hand]');
    if (!card || !hand.contains(card)) {
      let distance = Infinity;
      for (const c of hand.querySelectorAll('[data-db-hand]')) {
        const b = c.getBoundingClientRect();
        if (b.right <= r.left || b.left >= r.right) continue;
        const d = Math.abs(x - (b.left + b.right) / 2);
        if (d < distance) { distance = d; card = c; }
      }
    }
    if (card && card !== g.card) {
      const value = api.describe(card);
      if (value) {
        g.card.classList.remove('is-held'); g.card = card; g.value = value;
        card.classList.add('is-held'); preview(g); api.haptic();
      }
    } else if (g.dragging) preview(g);
    return true;
  }
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
      preview(g);
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
    if (browse(g, e.clientX, e.clientY)) return;
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
    else if (g.value.kind !== 'hand') api.inspect(g.value);
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
