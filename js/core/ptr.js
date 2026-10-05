// Pull to refresh on the tab roots: a home-screen app has no browser reload, so pulling down at the top of a tab
// root shows a spinner under the bar, ticks as it passes the line, and on release reloads the league data and the
// tab's own live data (its root view's refresh()). Passive touch listeners only: the page scrolls and rubber-bands as
// usual; the spinner is drawn over it. setupPullToRefresh({screen, refresh}): screen() -> the scrolling element of
// the tab root shown now, or null (a pushed screen, a cover or a sheet is up); refresh() -> Promise. Owner: core.
import * as ui from './ui.js';

const LINE = 72;       // px of pull (after resistance) that arms it
const HOLD = 650;      // the spinner shows at least this long, so the refresh reads as having happened

export function setupPullToRefresh({screen, refresh, root = document}) {
  const el = document.createElement('div');
  el.className = 'ptr';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<svg class="ptr-ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>';
  document.body.appendChild(el);
  let g = null, busy = false;
  const set = (p, armed) => {
    const f = Math.min(1, p / LINE);
    el.style.setProperty('--p', f.toFixed(3));
    el.style.transform = `translate(-50%, ${Math.round(Math.min(p, LINE * 1.3) * .6)}px) rotate(${Math.round(f * 270)}deg)`;
    el.classList.toggle('is-armed', !!armed);
    el.classList.toggle('is-on', p > 4);
  };
  const reset = () => { el.classList.remove('is-on', 'is-armed', 'is-spin'); el.style.transform = ''; };
  root.addEventListener('touchstart', e => {
    g = null;
    if (busy || e.touches.length !== 1) return;
    const scr = screen();
    if (!scr || scr.scrollTop > 0 || !scr.contains(e.target)) return;
    if (e.target.closest && e.target.closest('[data-hscroll], input, textarea, .sheet')) return;
    const t = e.touches[0];
    g = {scr, x0: t.clientX, y0: t.clientY, p: 0, axis: null, armed: false};
  }, {passive: true});
  root.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.axis) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; g.axis = Math.abs(dy) > Math.abs(dx) && dy > 0 ? 'down' : 'other'; }
    if (g.axis !== 'down' || g.scr.scrollTop > 0) { if (g.p) { g.p = 0; reset(); } return; }
    g.p = dy * .55; // resistance
    const armed = g.p >= LINE;
    set(g.p, armed);
    g.armed = armed;
  }, {passive: true});
  const end = () => {
    if (!g) return;
    const fire = g.armed;
    g = null;
    if (!fire) { reset(); return; }
    busy = true;
    ui.haptic('light');
    el.classList.add('is-spin');
    el.style.transform = `translate(-50%, ${Math.round(LINE * .6)}px)`;
    const t0 = Date.now();
    Promise.resolve().then(refresh).catch(() => {}).then(() => new Promise(r => setTimeout(r, Math.max(0, HOLD - (Date.now() - t0))))).then(() => {
      busy = false;
      reset();
    });
  };
  root.addEventListener('touchend', end, {passive: true});
  root.addEventListener('touchcancel', () => { g = null; reset(); }, {passive: true});
}
