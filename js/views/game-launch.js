// Owner-only presentation, loaded and gated by games.js. This sequence does not load a game or change routes.
const active = new WeakMap();

/** Show a disc entering its console, then let the caller launch the game. Cancel never calls onComplete. */
export function launchGame({host, game, reducedMotion = false, onComplete = () => {}}) {
  if (!host || !host.isConnected) return {cancel() {}};
  active.get(host)?.cancel();

  const doc = host.ownerDocument, dlg = host.querySelector('.gm-z-dlg') || host;
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let ended = false, timer = 0, observer = null;
  const layer = doc.createElement('div');
  layer.className = 'gm-launch';
  layer.innerHTML = '<div class="gm-launch-scene" aria-hidden="true">'
    + '<div class="gm-launch-ground"></div>'
    + '<div class="gm-launch-console"><span class="gm-launch-top"></span><span class="gm-launch-vents"></span>'
    + '<span class="gm-launch-front"></span><span class="gm-launch-slot"></span><span class="gm-launch-power"></span>'
    + '<span class="gm-launch-foot is-left"></span><span class="gm-launch-foot is-right"></span></div>'
    + '<div class="gm-launch-feed"><div class="gm-launch-disc"><img alt="" draggable="false" decoding="async">'
    + '<span class="gm-launch-sheen"></span></div></div></div>'
    + '<p class="gm-launch-status" role="status" aria-live="polite" aria-atomic="true"><span>Starting</span><strong></strong></p>';
  const img = layer.querySelector('img');
  if (game && game.disc) img.src = game.disc;
  else img.remove(); // The reflective disc still reads correctly if its artwork is unavailable.
  layer.querySelector('strong').textContent = game && game.name ? game.name : 'your game';

  const cancelAnimations = () => {
    if (layer.getAnimations) layer.getAnimations({subtree: true}).forEach(animation => animation.cancel());
  };
  const cleanup = () => {
    clearTimeout(timer);
    observer?.disconnect();
    if (motion?.removeEventListener) motion.removeEventListener('change', onMotion);
    else if (motion?.removeListener) motion.removeListener(onMotion);
    cancelAnimations();
    layer.remove();
    if (active.get(host) === control) {
      active.delete(host);
      host.classList.remove('gm-is-launching');
    }
  };
  const control = {cancel() {
    if (ended) return;
    ended = true;
    cleanup();
  }};
  const finish = () => {
    if (ended) return;
    const connected = host.isConnected && layer.isConnected;
    ended = true;
    cleanup();
    if (connected) onComplete();
  };
  const onMotion = event => {
    if (!event.matches || ended) return;
    clearTimeout(timer);
    layer.classList.add('is-reduced');
    cancelAnimations();
    timer = setTimeout(finish, 150);
  };

  const quiet = reducedMotion || !!motion?.matches;
  layer.classList.toggle('is-reduced', quiet);
  active.set(host, control);
  host.classList.add('gm-is-launching');
  dlg.appendChild(layer);
  // Closing the dialog or replacing its parent must never result in a late launch.
  if (typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => {
      if (!host.isConnected || !layer.isConnected) control.cancel();
    });
    observer.observe(doc.documentElement, {childList: true, subtree: true});
  }
  if (motion?.addEventListener) motion.addEventListener('change', onMotion);
  else if (motion?.addListener) motion.addListener(onMotion);
  timer = setTimeout(finish, quiet ? 150 : 1540);
  return control;
}
