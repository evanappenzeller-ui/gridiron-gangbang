// Evan's midfield artwork. Importing this module never requests the owner-only image.
import * as data from '../core/data.js';

export const WIDTH = 12;
const listeners = new Set();
let bitmap = null, attempt = null, tried = false, subscribed = false;
const changed = () => listeners.forEach(fn => fn());
const current = load => attempt === load && !load.signal.aborted && data.isOwner();

function watchProfile() {
  if (subscribed) return;
  subscribed = true;
  // data's 'me' event also covers profile changes made in another tab.
  data.subscribe(type => { if (type === 'me') revoke(); });
}

function revoke() {
  const old = bitmap, load = attempt;
  bitmap = null; attempt = null; tried = false;
  if (load) load.abort();
  // Let the scene release its texture before the decoded pixels are closed.
  changed();
  if (old) old.close();
}

export function subscribe(fn) {
  watchProfile(); listeners.add(fn);
  return () => listeners.delete(fn);
}

export function sync() {
  if (!data.isOwner() && (bitmap || attempt || tried)) revoke();
}

async function loadImage(load) {
  try {
    const response = await fetch(new URL('../../img/return-toreadors-logo.png', import.meta.url), {signal: load.signal});
    if (!response.ok) throw new Error('Midfield logo unavailable');
    const blob = await response.blob();
    if (!current(load)) return;
    const decoded = await createImageBitmap(blob);
    if (!current(load)) { decoded.close(); return; }
    bitmap = decoded;
    changed();
  } catch (_) {
    // Keep the original field art after an offline or failed load; no frame-by-frame retry.
  } finally {
    if (attempt === load) attempt = null;
  }
}

/** The shared, unflipped bitmap for the canvas fallback and the 3D canvas texture. */
export function image() {
  watchProfile(); sync();
  if (!data.isOwner()) return null;
  if (!tried) {
    tried = true;
    attempt = new AbortController();
    void loadImage(attempt);
  }
  return bitmap;
}
