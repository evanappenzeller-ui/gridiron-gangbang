// Energy Zone gestures (Nov 7 2026, Evan: "I want to be able to drag and drop the energy"). Pointer handling only:
// the battle view checks every attachment against the rules engine. A tap lifts the Energy (the battle view's click
// handler toggles it, so keyboard Enter/Space works the same way); a drag carries it onto a highlighted athlete.
export function attachEnergy(el, options) {
  // Only the one click a finished gesture generates is swallowed, so a quick follow-up tap still counts.
  let gesture = null, suppressUntil = 0;
  const swallow = () => { suppressUntil = performance.now() + 120; };
  const stops = [];
  const listen = (host, event, fn, opts) => { host.addEventListener(event, fn, opts); stops.push(() => host.removeEventListener(event, fn, opts)); };
  function cleanup(g) {
    clearTimeout(g.timer);
    g.zone.classList.remove('is-dragging');
    g.targets?.forEach(t => t.el.classList.remove('is-drop-valid', 'is-drop-hover', 'is-energy-target'));
    try { if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId); } catch (_) {}
  }
  function cancel(returnHome = false) {
    const g = gesture; gesture = null;
    if (!g) return;
    swallow();
    cleanup(g);
    const ghost = g.ghost;
    if (!ghost) return;
    if (returnHome && ghost.animate) {
      // A missed drop floats back into the Energy Zone.
      const z = g.zone.querySelector('.rp-energy-orb')?.getBoundingClientRect(), r = ghost.getBoundingClientRect();
      const dx = z ? z.left + z.width / 2 - (r.left + r.width / 2) : 0, dy = z ? z.top + z.height / 2 - (r.top + r.height / 2) : 0;
      ghost.animate([{translate: '0 0', opacity: 1}, {translate: `${dx}px ${dy}px`, opacity: .2}], {duration: 260, easing: 'ease-in', fill: 'forwards'}).finished.finally(() => ghost.remove());
    } else ghost.remove();
  }
  function hover(g, x, y) {
    const target = g.targets.find(t => {
      const r = t.el.getBoundingClientRect(), pad = 12;
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    });
    if (target !== g.hover) g.targets.forEach(t => t.el.classList.toggle('is-drop-hover', t === target));
    g.hover = target;
    g.ghost?.classList.toggle('is-valid', !!target);
  }
  function drag(g, x, y) {
    if (g.mode !== 'drag') {
      g.mode = 'drag';
      options.lift?.();
      g.targets = options.targets();
      g.targets.forEach(t => t.el.classList.add('is-drop-valid', 'is-energy-target'));
      g.zone.classList.add('is-dragging');
      const ghost = document.createElement('div');
      ghost.className = 'rp-energy-ghost'; ghost.setAttribute('aria-hidden', 'true');
      ghost.innerHTML = g.zone.querySelector('.rp-energy-orb .rp-energy')?.outerHTML || '';
      (el.querySelector('.rp-battle') || el).append(ghost); g.ghost = ghost;
      options.sound?.('lift');
    }
    g.ghost.style.left = x + 'px'; g.ghost.style.top = y + 'px';
    hover(g, x, y);
  }
  function down(e) {
    if (gesture) { if (e.pointerId !== gesture.pointerId) cancel(true); return; }
    const zone = e.target.closest('[data-rp-energy]');
    if (!zone || e.isPrimary === false || e.button !== 0 || !options.enabled()) return;
    suppressUntil = 0;
    gesture = {pointerId: e.pointerId, zone, mode: 'pending', startX: e.clientX, startY: e.clientY};
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function move(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.pointerId) return;
    if (!options.enabled()) return cancel();
    if (g.mode === 'drag' || Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 8) { e.preventDefault(); drag(g, e.clientX, e.clientY); }
  }
  function up(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.pointerId) return;
    e.preventDefault();
    if (g.mode !== 'drag') {
      // A tap: let the battle view's click handler toggle the lifted Energy exactly once.
      gesture = null; cleanup(g); swallow();
      if (options.enabled()) g.zone.click();
      return;
    }
    hover(g, e.clientX, e.clientY);
    const target = g.hover, enabled = options.enabled();
    if (target && enabled) {
      gesture = null; cleanup(g); swallow();
      g.ghost?.remove();
      options.drop(target.u, {x: e.clientX, y: e.clientY});
    } else { options.sound?.('drop'); cancel(true); }
  }
  listen(el, 'pointerdown', down);
  listen(window, 'pointermove', move, {passive: false});
  listen(window, 'pointerup', up, {passive: false});
  listen(window, 'pointercancel', e => { if (gesture?.pointerId === e.pointerId) cancel(true); });
  listen(el, 'lostpointercapture', e => { if (gesture?.pointerId === e.pointerId && gesture.mode === 'drag') cancel(true); });
  // Pointer-generated clicks after a gesture are handled above; keyboard clicks (detail 0) pass through.
  listen(el, 'click', e => {
    if (e.isTrusted && performance.now() < suppressUntil && (e.detail > 0 || e.pointerType)) { suppressUntil = 0; e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  listen(window, 'blur', () => cancel());
  listen(document, 'visibilitychange', () => { if (document.hidden) cancel(); });
  listen(document, 'keydown', e => { if (gesture && e.key === 'Escape') { e.preventDefault(); cancel(true); } });
  return {cancel: () => cancel(), stop() { cancel(); stops.forEach(fn => fn()); }};
}
