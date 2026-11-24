// The Media Room's data (views/media.js; Nov 24 2026, Evan: "Create a new disc on the Home Screen for the media room.
// This should include all the videos in the app from the happy meal challenge to the weekly press conferences"):
//   load() -> Promise<{meals, draft}>   data/media.json's Happy Meals (mealsOf) and the 2026 draft order (draftOf)
//   watch: what this profile has watched on this phone (Continue Watching and the red bars under the posters):
//     watched(id) -> {t, d, at, done} | null, saveWatch(id, t, d), continuing(ids) -> [id] (newest first)
// The press conferences come from core/press.js (subscribePressers). Owner: MEDIA.
import * as data from './data.js';
import {FILE_RE} from './press.js';

const MEDIA_URL = new URL('../../data/media.json', import.meta.url).href;
let mediaP = null;
/** data/media.json, cleaned: {meals, draft}. A failed load can be tried again. */
export function load() {
  if (!mediaP) {
    mediaP = fetch(MEDIA_URL, {cache: 'no-cache'}).then(r => {
      if (!r.ok) throw new Error('media.json HTTP ' + r.status);
      return r.json();
    }).then(j => ({meals: mealsOf(j), draft: draftOf(j)}), e => { mediaP = null; throw e; });
  }
  return mediaP;
}
/** data/media.json's Happy Meals, cleaned: [{key, who: [ids], drive, file (video/media/…mp4 or null), tall}] (a bad entry is skipped). */
export function mealsOf(j) {
  const list = j && Array.isArray(j.happyMeals) ? j.happyMeals : [];
  return list.map(m => {
    if (!m || typeof m.key !== 'string' || typeof m.drive !== 'string' || !/^[A-Za-z0-9_-]{25,64}$/.test(m.drive)) return null;
    const who = (Array.isArray(m.who) ? m.who : []).filter(id => typeof id === 'string' && data.M[id]);
    const file = typeof m.file === 'string' && FILE_RE.test(m.file) ? m.file : null;
    return who.length ? {key: m.key, who, drive: m.drive, file, tall: m.tall === true} : null;
  }).filter(Boolean);
}
/** data/media.json's draft order, cleaned: {year, times: [{who, pick, raw, adj: [[seconds, why]], time, note}]} sorted by
 *  pick, or null (an entry with an unknown manager, a bad time or a repeated pick is skipped). */
const TIME_RE = /^\d{1,2}:\d{2}$/;
export function draftOf(j) {
  const d = j && j.draft;
  if (!d || !Array.isArray(d.times)) return null;
  const seen = new Set();
  const times = d.times.map(t => {
    if (!t || !data.M[t.who] || !Number.isInteger(t.pick) || t.pick < 1 || seen.has(t.pick) || !TIME_RE.test(t.time) || !TIME_RE.test(t.raw)) return null;
    seen.add(t.pick);
    const adj = (Array.isArray(t.adj) ? t.adj : []).filter(a => Array.isArray(a) && Number.isFinite(a[0]) && a[0] && typeof a[1] === 'string');
    return {who: t.who, pick: t.pick, raw: t.raw, adj, time: t.time, note: typeof t.note === 'string' ? t.note : ''};
  }).filter(Boolean).sort((a, b) => a.pick - b.pick);
  return times.length ? {year: Number(d.year) || null, times} : null;
}

// ---------------------------------------------------------------------------- What you've watched
// One record a profile on this phone (gg-media-watch:<member id, or 'visitor'>): {[videoId]: {t, d, at, done}}, the
// newest WATCH_MAX kept. Never posted anywhere.
const WATCH_MAX = 60;
const watchKey = () => 'gg-media-watch:' + (data.me() || 'visitor');
function readAll() {
  try { const o = JSON.parse(localStorage.getItem(watchKey()) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
}
export function watched(id) {
  const w = readAll()[id];
  return w && Number.isFinite(w.t) && Number.isFinite(w.d) && w.d > 0 ? w : null;
}
/** The share watched (0..1) for a poster's red bar; 0 when nothing's saved. A finished video shows full. */
export function share(id) {
  const w = watched(id);
  return !w ? 0 : w.done ? 1 : Math.max(0, Math.min(1, w.t / w.d));
}
/** Saves where a video got to (t of d seconds). Within 10 s of the end (or ended) it's finished: t back to 0, done. */
export function saveWatch(id, t, d) {
  if (!id || !(d > 0) || !Number.isFinite(t)) return false;
  const all = readAll();
  const done = t >= d - 10;
  const prev = all[id];
  if (t < 3 && !done && !(prev && prev.done)) return false; // a peek isn't watching
  all[id] = {t: done ? 0 : Math.round(t * 10) / 10, d: Math.round(d * 10) / 10, at: Date.now(), done: done || !!(prev && prev.done && t < 3)};
  const keys = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
  keys.slice(WATCH_MAX).forEach(k => { delete all[k]; });
  try { localStorage.setItem(watchKey(), JSON.stringify(all)); return true; } catch (_) { return false; }
}
/** Where to start: the saved place when it's part way through (not near either end), else 0. */
export function resumeAt(id) {
  const w = watched(id);
  return w && !w.done && w.t >= 5 && w.t < w.d - 10 ? w.t : 0;
}
/** The videos part way through, newest first (of `ids`, the ones still in the Media Room). */
export function continuing(ids) {
  const all = readAll(), have = new Set(ids);
  return Object.keys(all).filter(k => have.has(k) && resumeAt(k) > 0).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
}
