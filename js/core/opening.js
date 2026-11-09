// The opening (index.html #title) waits for the app (Nov 9 2026, Evan: "The app lags when first entered. Fix this so
// the app has sufficient time to load during the opening animation so that it runs smoothly. Lags include glitching
// with the game cases and screen flashes"). The title script slows its drift and then holds the logo, breathing,
// until release() says the first screen is whole: drawn, its stylesheets in, the work it registered with hold() done
// (the shelf's game states, the day's puzzles, the board), the fonts in and the pictures on screen decoded. Only then
// does it break apart and fly through into the app, so nothing pops in, restyles or flashes after the reveal.
// done() resolves once the opening is gone: work that would only compete with the fly-through (warming other tabs,
// Rivals live, the service worker) waits for it. The title script caps the wait, so a slow network still gets in.
const title = () => (typeof window !== 'undefined' && window.__ggTitle) || null;

/** Whether the opening is still over the app. */
export const active = () => { const t = title(); return !!t && !t.gone; };

const wait = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const holds = [];

/** The opening waits for p (at most ms) before it reveals the app. A no-op once it's gone. */
export function hold(p, ms = 2500) {
  if (!active() || !p) return;
  holds.push(Promise.race([Promise.resolve(p).then(() => {}, () => {}), wait(ms)]));
}

/** Resolves once the opening is gone (at once when there's none: an update reload, a skip). */
export function done() {
  return new Promise(resolve => {
    const t = title();
    if (!t || t.gone || typeof t.onGone !== 'function') resolve();
    else t.onGone(resolve);
  });
}

// The pictures on screen in root (the cases on the shelf, avatars, covers): decoded, so none paints in empty.
function pictures(root, ms) {
  if (!root) return Promise.resolve();
  const W = innerWidth, H = innerHeight;
  const list = [...root.querySelectorAll('img')].filter(im => {
    if (!im.getAttribute('src')) return false;
    const r = im.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  });
  if (!list.length) return Promise.resolve();
  const one = im => (typeof im.decode === 'function' ? im.decode() : new Promise(r => {
    if (im.complete) r(); else { im.addEventListener('load', r, {once: true}); im.addEventListener('error', r, {once: true}); }
  })).catch(() => {});
  return Promise.race([Promise.all(list.map(one)), wait(ms)]);
}

let releasing = false;
/** The first screen is drawn: tell the opening once everything it waits for is in. */
export async function release(root) {
  if (!active() || releasing) return;
  releasing = true;
  try {
    await frame(); await frame(); // (first layout: the shelf centres itself in a frame)
    // (work registered meanwhile joins the wait)
    for (let n = -1; n !== holds.length;) { n = holds.length; await Promise.all(holds.slice()); }
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, wait(1500)]);
    await frame();
    await pictures(root, 2500);
    await frame(); await frame(); // (painted at least once before the reveal)
  } catch (_) {}
  const t = title();
  if (t && typeof t.ready === 'function') t.ready();
}
