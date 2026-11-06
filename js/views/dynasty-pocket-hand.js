// Pointer gestures are presentation only. The battle view validates every drop.
export function attachHand(el, options) {
  let gesture = null, suppressUntil = 0;
  const stops = [];
  const listen = (host, event, fn, opts) => { host.addEventListener(event, fn, opts); stops.push(() => host.removeEventListener(event, fn, opts)); };
  const cards = () => [...el.querySelectorAll('.rp-hand [data-rp-hand]')];
  const consume = () => { suppressUntil = performance.now() + 600; };
  function cancel(suppress = true) {
    const g = gesture; gesture = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (suppress) consume();
    g.ghost?.remove();
    g.hand.classList.remove('is-browsing');
    cards().forEach(c => c.classList.remove('is-preview', 'is-held', 'is-drag-source'));
    g.targets?.forEach(t => t.el.classList.remove('is-drop-valid', 'is-drop-hover'));
    try { if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId); } catch (_) {}
  }
  function preview(g, index, held = false) {
    const card = g.cards.find(c => Number(c.dataset.rpHand) === index);
    if (!card) return;
    const changed = g.previewIndex !== index;
    g.index = index; g.previewIndex = index;
    g.hand.classList.add('is-browsing');
    g.cards.forEach(c => { c.classList.toggle('is-preview', c === card); c.classList.toggle('is-held', c === card && held); });
    if (changed) options.preview?.(index);
  }
  function browse(g, x, held = false) {
    g.mode = 'browse';
    const nearest = g.anchors.reduce((best, a) => Math.abs(a.x - (x + g.anchorOffset)) < Math.abs(best.x - (x + g.anchorOffset)) ? a : best);
    preview(g, nearest.index, held);
  }
  function hover(g, x, y) {
    const target = g.targets.find(t => {
      const r = t.el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    g.targets.forEach(t => t.el.classList.toggle('is-drop-hover', t === target));
    g.hover = target;
    g.ghost?.classList.toggle('is-valid', !!target);
  }
  function drag(g, x, y) {
    if (g.mode !== 'drag') {
      clearTimeout(g.timer); g.mode = 'drag';
      preview(g, g.index, true);
      const card = g.cards.find(c => Number(c.dataset.rpHand) === g.index);
      card.classList.add('is-drag-source');
      g.targets = options.targets(g.index);
      g.targets.forEach(t => t.el.classList.add('is-drop-valid'));
      const ghost = document.createElement('div');
      ghost.className = 'rp-drag-ghost'; ghost.setAttribute('aria-hidden', 'true');
      ghost.innerHTML = card.querySelector('.rp-card-print')?.outerHTML || '';
      const width = Math.max(100, Math.min(140, card.getBoundingClientRect().width * 1.2));
      ghost.style.width = width + 'px'; ghost.style.height = width * 88 / 63 + 'px';
      el.querySelector('.rp-battle').append(ghost); g.ghost = ghost;
    }
    g.ghost.style.left = x + 'px'; g.ghost.style.top = y + 'px';
    hover(g, x, y);
  }
  function down(e) {
    suppressUntil = 0;
    if (gesture) { if (e.pointerId !== gesture.pointerId) cancel(); return; }
    const card = e.target.closest('.rp-hand [data-rp-hand]');
    if (!card || e.isPrimary === false || e.button !== 0 || !options.enabled()) return;
    const hand = card.closest('.rp-hand'), list = cards(), rect = hand.getBoundingClientRect();
    const g = {pointerId:e.pointerId, index:Number(card.dataset.rpHand), hand, cards:list,
      mode:'pending', startX:e.clientX, startY:e.clientY, rect,
      anchors:list.map(c => ({index:Number(c.dataset.rpHand), x:c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2}))};
    g.anchorOffset = g.anchors.find(a => a.index === g.index).x - e.clientX;
    gesture = g;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    g.timer = setTimeout(() => {
      if (gesture !== g || g.mode !== 'pending') return;
      if (!options.enabled()) return cancel();
      g.mode = 'browse'; preview(g, g.index, true);
    }, 240);
  }
  function move(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.pointerId) return;
    if (!options.enabled()) return cancel();
    const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
    if (g.mode === 'drag') { e.preventDefault(); drag(g, e.clientX, e.clientY); return; }
    const rising = dy < -6 && Math.abs(dy) > Math.abs(dx) * .2;
    const upward = dy < -18 && (g.mode === 'browse' || rising);
    if (upward || e.clientY < g.rect.top - 16) { e.preventDefault(); drag(g, e.clientX, e.clientY); return; }
    if (!rising && (g.sliding || Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy))) {
      e.preventDefault(); clearTimeout(g.timer); g.sliding = true; browse(g, e.clientX, true);
    } else if (Math.abs(dy) > 18) { e.preventDefault(); clearTimeout(g.timer); g.mode = 'browse'; preview(g, g.index, true); }
  }
  function up(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.pointerId) return;
    e.preventDefault();
    const enabled = options.enabled(), index = g.index, mode = g.mode;
    if (mode === 'drag') hover(g, e.clientX, e.clientY);
    const target = g.hover;
    cancel();
    if (!enabled) return;
    if (mode === 'pending') options.inspect(index);
    else if (mode === 'drag' && target) options.drop(index, target);
  }
  listen(el, 'pointerdown', down);
  listen(window, 'pointermove', move, {passive:false});
  listen(window, 'pointerup', up, {passive:false});
  listen(window, 'pointercancel', e => { if (gesture?.pointerId === e.pointerId) cancel(); });
  listen(el, 'lostpointercapture', e => { if (gesture?.pointerId === e.pointerId) cancel(); });
  listen(el, 'click', e => {
    if (performance.now() < suppressUntil && (e.detail > 0 || e.pointerType)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  listen(el, 'contextmenu', e => { if (e.target.closest('.rp-hand')) e.preventDefault(); });
  listen(window, 'blur', () => cancel());
  listen(document, 'visibilitychange', () => { if (document.hidden) cancel(); });
  listen(document, 'keydown', e => { if (gesture && e.key === 'Escape') { e.preventDefault(); cancel(); } });
  return {cancel, stop() { cancel(); stops.forEach(fn => fn()); }};
}
