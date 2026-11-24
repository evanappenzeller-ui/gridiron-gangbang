// League › Media (#/league/media): the league's video archive (Nov 11 2026, the owner: "add a media archive in the
// league tab and add all the press conferences and the happy meal videos"). A segment of league.js: {render, mount,
// unmount, hide}.
//
// Press conferences: every presser (core/press.js subscribePressers: the seed merged under Firestore), newest week
// first, as compact tiles that expand while they play (views/press.js tileHTML 's'). Happy Meals: data/media.json's
// videos, one tile each (views/press.js clipHTML), played in the app's own player from video/media/ (Nov 12 2026; the Drive
// file stays as the record and the fallback). One player at a time, app-wide (views/press.js);
// leaving the segment or hiding the tab puts every player back to its thumbnail.
// The draft order (Nov 24 2026, Evan, with his note of the times: "The videos in the media of league members eating happy
// meals was how we determined the draft order. Here are the times"): data/media.json's `draft` (draftOf) leads the Happy
// Meals as a card, fastest first, each manager's time with its penalties and credits; the videos follow in draft order,
// each with its pick and time under the name.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import {FILE_RE} from '../core/press.js';

const esc = data.esc;
const MEDIA_URL = new URL('../../data/media.json', import.meta.url).href;
let S = null; // mounted state: {body, dead, unsub, stop, pv, list, meals}

let mediaP = null;
/** data/media.json's Happy Meals, cleaned: [{key, who: [ids], drive, file (video/media/…mp4 or null), tall}] (a bad entry is skipped). */
function loadMedia() {
  if (!mediaP) {
    mediaP = fetch(MEDIA_URL, {cache: 'no-cache'}).then(r => {
      if (!r.ok) throw new Error('media.json HTTP ' + r.status);
      return r.json();
    }).then(j => ({meals: mealsOf(j), draft: draftOf(j)}), e => { mediaP = null; throw e; });
  }
  return mediaP;
}
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
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th'));
// "+5 s fry left", "−22 s extra fries"
const adjTxt = a => `${a[0] > 0 ? '+' : '\u2212'}${Math.abs(a[0])}\u00a0s ${a[1]}`;
function draftHTML(draft) {
  if (!draft) return '';
  const me = data.me();
  const rows = draft.times.map(t => {
    const how = t.adj.length ? `${t.raw} ${t.adj.map(adjTxt).join(', ')}` : t.note ? t.note : '';
    return `<li class="md-dr${t.who === me ? ' is-me' : ''}${t.pick === 1 ? ' is-first' : ''}"><span class="md-dr-pk n5" aria-label="${esc(ord(t.pick) + ' pick')}">${t.pick}</span>`
      + ui.avatar(t.who, {size: 32, you: t.who === me})
      + `<span class="md-dr-m"><b>${esc(data.name(t.who))}</b>${how ? `<small>${esc(how)}</small>` : ''}</span>`
      + `<span class="md-dr-t n5">${esc(t.time)}</span></li>`;
  }).join('');
  return `<div class="md-draft card"><p class="md-dr-h">${esc(`${draft.year || ''} draft order`.trim())}<span>Fastest Happy Meal picks first</span></p><ol class="md-dr-list">${rows}</ol></div>`;
}

// "Jackson & Jacob" (names in the order given).
const namesOf = ids => ids.map(id => data.name(id)).join(' & ');

function pressHTML(pv, list) {
  if (!list) return ui.skeleton('rows', 3, {label: 'Loading press conferences'});
  if (!list.length) return ui.empty({icon: 'mic', title: 'No press conferences yet', body: 'The Matchup of the Week loser faces the media.'});
  return `<div class="md-list">${list.map(p => pv.tileHTML(p, {size: 's'})).join('')}</div>`;
}
function mealsHTML(pv, meals, draft) {
  if (!meals) return ui.skeleton('rows', 3, {label: 'Loading Happy Meals'});
  if (!meals.length) return ui.empty({icon: 'info', title: 'No Happy Meals yet'});
  // In draft order when the times are known (a shared video by its first pick), else by name; each with its pick and time.
  const T = new Map((draft ? draft.times : []).map(t => [t.who, t]));
  const firstPick = m => Math.min(...m.who.map(id => (T.get(id) || {pick: 99}).pick));
  const noteOf = m => {
    const ts = m.who.map(id => T.get(id)).filter(Boolean);
    if (!ts.length) return '';
    return ts.length === 1 ? `${ord(ts[0].pick)} pick · ${ts[0].time}` : `Picks ${ts.map(t => t.pick).join(' & ')} · ${ts.map(t => t.time).join(' & ')}`;
  };
  const tiles = [...meals].sort((a, b) => firstPick(a) - firstPick(b) || namesOf(a.who).localeCompare(namesOf(b.who)))
    .map(m => pv.clipHTML({key: m.key, drive: m.drive, file: m.file, tall: m.tall, who: m.who[0], tag: m.who, note: noteOf(m),
      title: `${namesOf(m.who)}'s Happy Meal${noteOf(m) ? ', ' + noteOf(m) : ''}`}));
  return draftHTML(draft) + `<div class="md-list md-grid">${tiles.join('')}</div>`;
}

export function render() {
  return `<section class="md-sec" data-enter aria-labelledby="md-press">${ui.sectionHeader({title: 'Press conferences', id: 'md-press', action: {label: 'Press Room', href: '#/press'}})}`
    + `<div class="md-host" data-md="press">${pressHTML(null, null)}</div></section>`
    + `<section class="md-sec" data-enter aria-labelledby="md-meals">${ui.sectionHeader({title: 'Happy Meals', id: 'md-meals'})}`
    + `<div class="md-host" data-md="meals">${mealsHTML(null, null)}</div></section>`;
}

function paint(st, which) {
  if (!st || st.dead || !st.pv) return;
  const host = st.body.querySelector(`[data-md="${which}"]`);
  if (!host) return;
  const html = which === 'press' ? pressHTML(st.pv, st.list) : mealsHTML(st.pv, st.meals, st.draft);
  if (host.dataset.sig === html) return;
  // A video playing in this list keeps playing until the list really changes.
  if (host.querySelector('.c-press-frame.is-playing') && host.dataset.sig) return;
  host.dataset.sig = html;
  host.innerHTML = html;
}

export function mount(body) {
  const st = {body, dead: false, unsub: null, stop: null, pv: null, list: null, meals: null, draft: null};
  S = st;
  Promise.all([import('./press.js'), import('../core/press.js')]).then(([pv, core]) => {
    if (st.dead) return;
    st.pv = pv;
    st.stop = pv.bindPlayers(body);
    paint(st, 'meals');
    try {
      st.unsub = core.subscribePressers(u => {
        if (st.dead || !u) return;
        st.list = (Array.isArray(u.list) ? u.list : []).filter(p => p && p.key && core.playable(p));
        if (u.ready || st.list.length) paint(st, 'press');
      });
    } catch (e) { console.error(e); st.list = []; paint(st, 'press'); }
    loadMedia().then(m => { st.meals = m.meals; st.draft = m.draft; paint(st, 'meals'); }, e => { console.warn('media: Happy Meals unavailable', e); st.meals = []; paint(st, 'meals'); });
  }, e => {
    console.warn('media: Press Room unavailable', e);
    const hosts = body.querySelectorAll('.md-host');
    hosts.forEach(h => { h.innerHTML = ui.empty({icon: 'info', title: "Videos couldn't load", body: 'Check your connection and try again.'}); });
  });
}

export function hide() {
  if (S && S.stop) S.stop();
}

export function unmount() {
  const st = S;
  if (!st) return;
  st.dead = true;
  if (st.stop) st.stop();
  if (typeof st.unsub === 'function') { try { st.unsub(); } catch (_) {} }
  S = null;
}
