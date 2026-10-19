// The avatar button every tab root shows (youButtonHTML) and the sheets it and the Puzzles screen open (spec 7.8): the
// You sheet (who you are, posting name, haptics, data, install, about), the Streak sheet (5-week heatmap) and the
// Player card (a leaderboard nickname's posted days).
// Exports: youButtonHTML(), patchYouButtons(root), openYouSheet(), openStreakSheet(), openPlayerCard(uid, {managerId}).
// Owner: SHELL (tabs-v4; was the daily-hub package).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {APP_VERSION, installEvent, promptInstall} from '../app.js';
import {flameIcon, streakPillHTML, ensureDefs, countWord} from './board.js';
import {openGuestSheet} from './guest.js';
import * as avatars from '../core/avatars.js';
import {choosePicture, removePicture} from './photo.js';

const esc = data.esc;
const nf = n => data.nf(n);

function sec(title, inner, foot, attrs = '') {
  return `<section class="c-ys"${attrs ? ' ' + attrs : ''}><h3 class="c-ys-h">${esc(title)}</h3>${inner}${foot ? `<p class="c-ys-f">${esc(foot)}</p>` : ''}</section>`;
}

// ============================================================================ Avatar button
// The trailing slot of every tab root's large title (Puzzles, Pick'em, Matchup, League, Draft): your monogram with
// the white "you" ring (a guest's initials), or a person glyph before you've picked. Views only render it: app.js opens
// the You sheet on any [data-you] tap (one delegated handler) and redraws every button after a 'me' change
// (patchYouButtons below).
function youInner(me, g = data.guest()) {
  const u = data.user(); // an app user by their own name's initials (whatever name the phone plays under)
  return me ? ui.avatar(me, {size: 32, you: true}) : g ? ui.nickAvatar(u ? u.name : g, {size: 32, you: true}) : `<span class="c-you-empty">${ui.icon('person', {size: 18})}</span>`;
}
const youKey = () => { const me = data.me(), g = data.guest(); return me || (g ? 'guest:' + g : ''); };
/** The avatar button, for a large title's `trailing` slot. */
export function youButtonHTML() {
  return `<button type="button" class="c-you-btn" data-you data-me="${esc(youKey())}" aria-label="You and settings">${youInner(data.me())}</button>`;
}
/** The gear beside the avatar (Puzzles): app.js opens the Settings sheet on [data-settings]. */
export function settingsButtonHTML() {
  return `<button type="button" class="c-gear-btn" data-settings aria-label="Settings">${ui.icon('gear', {size: 22})}</button>`;
}
/** Redraws the avatar buttons under root that show someone else (app.js calls it on 'me'); a visible one pops in. */
export function patchYouButtons(root = document) {
  const me = data.me(), key = youKey();
  root.querySelectorAll('[data-you]').forEach(b => {
    if (b.dataset.me === key) return;
    b.dataset.me = key;
    b.innerHTML = youInner(me);
    const shown = b.getClientRects().length && !b.closest('.tab-layer[hidden], [data-under]');
    if (shown && !ui.RM && b.firstElementChild) ui.animate(b.firstElementChild, [{transform: 'scale(.6)', opacity: .4}, {transform: 'none', opacity: 1}], {spring: 'snappy'});
  });
}

// ============================================================================ You sheet
let youSheet = null;

// Who this phone is, as the grid's keys: a manager id, 'user:' + an app user's id, 'none' or null.
const pickKey = () => { const u = data.user(); return u ? 'user:' + u.id : data.meRaw(); };
function gridHTML() {
  const me = pickKey();
  const cells = data.ids.map(id => `<button type="button" class="pm-cell c-you-cell" data-me="${esc(id)}" aria-pressed="${id === me}">${ui.avatar(id, {size: 56, you: id === me})}<span>${esc(data.name(id))}</span></button>`).join('')
    // App users (data.USERS) after the members: their initials and name.
    + data.USERS.map(u => { const k = 'user:' + u.id; return `<button type="button" class="pm-cell c-you-cell" data-me="${esc(k)}" aria-pressed="${k === me}">${ui.nickAvatar(u.name, {size: 56, you: k === me})}<span>${esc(u.name)}</span></button>`; }).join('');
  return `<div class="pm-grid c-you-grid" role="group" aria-label="Which one are you?">${cells}</div>`
    + `<button type="button" class="btn btn-secondary c-you-none" data-me="none" aria-pressed="${me === 'none'}">${ui.icon('check', {size: 18, cls: 'c-you-nck'})}<span class="btn-label">Not in the league</span></button>`;
}
// The guest's player: make one (not in the league), or rename it.
function guestRow() {
  const g = data.guest();
  return g
    ? ui.row({lead: ui.nickAvatar(g, {size: 30}), title: g, sub: 'Guest player · Rename', attrs: {'data-guest': ''}, cls: 'c-ys-guest', chevron: true})
    : ui.row({lead: `<span class="c-ys-ic">${ui.icon('plus', {size: 20})}</span>`, title: 'Play as a guest', attrs: {'data-guest': ''}, cls: 'c-ys-act c-ys-guest'});
}
function guestSec() {
  if (data.user()) return '<div data-guest-sec hidden></div>'; // an app user has a player of their own
  return sec('Guest player', ui.group(guestRow(), {cls: 'c-ys-guestg'}), data.guest()
    ? 'Your Daily Puzzles, 17–0 and Two-Minute Drill scores show under this name on your own boards, tagged Guest; only Evan, who runs the league, sees them too.'
    : 'Not in the league? Make your own player to keep your scores on your own boards.', 'data-guest-sec');
}
// Your picture, in place of your initials (views/photo.js crops it, core/avatars.js shares it): once you're someone.
function meAvatar(size) {
  const m = data.me(), u = data.user(), g = data.guest();
  return m ? ui.avatar(m, {size}) : ui.nickAvatar(u ? u.name : g, {size});
}
function picSec() {
  const m = avatars.mine();
  if (!m) return '<div data-pic-sec hidden></div>';
  const rows = ui.row({lead: meAvatar(40), title: m.url ? 'Change picture' : 'Add a picture', sub: m.url ? 'Shows in place of your initials' : 'From your photos, in place of your initials',
    attrs: {'data-pic': ''}, cls: 'c-ys-act c-ys-pic', chevron: true})
    + (m.url ? ui.row({lead: `<span class="c-ys-ic">${ui.icon('x', {size: 20})}</span>`, title: 'Remove picture', attrs: {'data-pic-rm': ''}, cls: 'c-ys-act c-ys-pic-rm'}) : '');
  return sec('Your picture', ui.group(rows, {cls: 'c-ys-picg'}), avatars.pictureForAll(m.key)
    ? 'Everyone in the league sees it, wherever your initials were.' : 'It shows on your own phones and Evan’s, like your scores.', 'data-pic-sec');
}
function patchPicSec(s) {
  const el = s.body.querySelector('[data-pic-sec]');
  if (el) { el.outerHTML = picSec(); ui.hydrate(s.body); }
}
function nickRow() {
  const nick = daily.LB.nick ? daily.displayName({nick: daily.LB.nick}) : ''; // as the boards show it (an app user's board name)
  return ui.row({lead: `<span class="c-ys-ic">${ui.icon('list-number', {size: 20})}</span>`, title: nick ? `Posting as ${nick}` : 'Not posted yet', cls: 'c-ys-nick'});
}
function dataLine() {
  const s = data.SEASONS.find(x => x.live) || data.SEASONS[0];
  if (!s) return 'League history';
  const tw = data.throughWeek(s);
  if (tw) return `League history through week ${tw} of ${s.year}`;
  const done = data.DONE[0];
  return done ? `League history through ${done.year}` : 'League history';
}
function installHTML() {
  if (ui.STANDALONE) return '';
  if (installEvent) {
    return sec('Install', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('plus', {size: 20})}</span>`, title: 'Install', attrs: {'data-install': ''}, cls: 'c-ys-act'})), 'Adds Gridiron to your home screen.', 'data-install-sec');
  }
  const ua = navigator.userAgent || '';
  const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const lines = ios ? [['iPhone', 'Share, then Add to Home Screen.']] : android ? [['Android', '⋮ menu, then Install app.']]
    : [['iPhone', 'Share, then Add to Home Screen.'], ['Android', '⋮ menu, then Install app.']];
  return sec('Install', ui.group(lines.map(([k, v]) => ui.row({lead: `<span class="c-ys-ic">${ui.icon(k === 'iPhone' ? 'share' : 'plus', {size: 20})}</span>`, title: v, sub: k})).join('')), '', 'data-install-sec');
}
// The theme in use (js/themes.js), for the Look row.
function themeName() {
  const T = window.GGTheme, id = T && T.get();
  const t = T && T.list.find(x => x.id === id);
  return t ? t.name : 'Prime Time';
}
// The Haptics switch, only where the phone can vibrate (no iPhone can): elsewhere there's no Feel section at all.
const feelHTML = () => ui.HAPTICS_SUPPORTED
  ? sec('Feel', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('pulse', {size: 20})}</span>`, title: 'Haptics', trail: ui.switchCtl({name: 'haptics', checked: ui.lsGet('gg-haptics') !== '0', label: 'Haptics'})})))
  : '';
function youBody() {
  const L = data.DATA && data.DATA.league ? data.DATA.league.name : 'Gridiron Gangbang';
  const sp = data.span;
  const feel = feelHTML();
  return picSec()
    + sec('Which one are you?', gridHTML())
    + guestSec()
    + sec('Leaderboard', ui.group(nickRow(), {cls: 'c-ys-nickg'}))
    + sec('Look', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('sparkle', {size: 20})}</span>`, title: 'Theme', sub: themeName(),
      attrs: {'data-theme-pick': ''}, cls: 'c-ys-act', chevron: true})))
    + feel
    + sec('Data', ui.group(
      ui.row({lead: `<span class="c-ys-ic">${ui.icon('calendar', {size: 20})}</span>`, title: dataLine(), cls: 'c-ys-dataline'})
      + ui.row({lead: `<span class="c-ys-ic">${ui.icon('arrow-down', {size: 20})}</span>`, title: 'Check for new week', attrs: {'data-reload': ''}, cls: 'c-ys-act'})))
    + `<div class="c-ys-install">${installHTML()}</div>`
    + sec('About', ui.group(
      ui.row({lead: `<span class="c-ys-ic">${ui.icon('football', {size: 20})}</span>`, title: L, sub: `${sp.first}–${sp.last} · ${sp.managers} managers`})
      + ui.row({lead: `<span class="c-ys-ic">${ui.icon('gear', {size: 20})}</span>`, title: `Version ${APP_VERSION}`})));
}

function patchGrid(s, animate = true) {
  const me = pickKey();
  s.body.querySelectorAll('[data-me]').forEach(b => {
    const on = b.dataset.me === me;
    const was = b.getAttribute('aria-pressed') === 'true';
    if (on === was) return;
    b.setAttribute('aria-pressed', String(on));
    const av = b.querySelector('.av');
    if (av) {
      av.classList.toggle('av-you', on);
      if (on && animate && !ui.RM) ui.animate(av, [{transform: 'scale(.82)'}, {transform: 'none'}], {spring: 'bouncy'});
    }
  });
}
function refreshInstall() {
  if (!youSheet || !youSheet.open) return;
  const host = youSheet.body.querySelector('.c-ys-install');
  if (host) host.innerHTML = installHTML();
}
// Chrome fires beforeinstallprompt whenever it decides the app is installable; app.js keeps the event.
addEventListener('beforeinstallprompt', () => setTimeout(refreshInstall, 0));
addEventListener('appinstalled', () => setTimeout(refreshInstall, 0));

// Settings (the gear on Puzzles): the theme first, then feel, data and about. The same rows as the You sheet's.
function settingsBody() {
  const feel = feelHTML();
  return sec('Look', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('sparkle', {size: 20})}</span>`, title: 'Theme', sub: themeName(),
      attrs: {'data-theme-pick': ''}, cls: 'c-ys-act', chevron: true})))
    + sec('You', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('person', {size: 20})}</span>`, title: 'Which one are you?', sub: data.me() ? data.name(data.me()) : data.user() ? data.user().name : data.guest() ? `${data.guest()} · Guest` : 'Not picked yet',
      attrs: {'data-open-you': ''}, cls: 'c-ys-act', chevron: true})))
    + feel
    + sec('Data', ui.group(
      ui.row({lead: `<span class="c-ys-ic">${ui.icon('calendar', {size: 20})}</span>`, title: dataLine(), cls: 'c-ys-dataline'})
      + ui.row({lead: `<span class="c-ys-ic">${ui.icon('arrow-down', {size: 20})}</span>`, title: 'Check for new week', attrs: {'data-reload': ''}, cls: 'c-ys-act'})))
    + `<div class="c-ys-install">${installHTML()}</div>`
    + sec('About', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('gear', {size: 20})}</span>`, title: `Version ${APP_VERSION}`})));
}
let setSheet = null;
export function openSettingsSheet() {
  if (setSheet && setSheet.open) return setSheet;
  const s = ui.openSheet({title: 'Settings', body: settingsBody(), cls: 'sh-you sh-settings', detents: ['medium', 'large'], onClose: () => { if (setSheet === s) setSheet = null; }});
  setSheet = s;
  wireSheet(s);
  s.body.addEventListener('click', e => {
    if (!e.target.closest('[data-open-you]')) return;
    s.close();
    setTimeout(openYouSheet, 260);
  });
  return s;
}

export function openYouSheet() {
  if (youSheet && youSheet.open) return youSheet;
  let unsub = () => {}, unsubPics = () => {};
  const s = ui.openSheet({title: 'You', body: youBody(), cls: 'sh-you', detents: ['medium', 'large'], onClose: () => { unsub(); unsubPics(); if (youSheet === s) youSheet = null; }});
  youSheet = s;
  wireSheet(s);
  unsubPics = avatars.onPictures(() => patchPicSec(s));
  unsub = data.subscribe(type => {
    if (type === 'me') {
      patchGrid(s);
      patchPicSec(s);
      // The guest section and the posting name follow.
      const gs = s.body.querySelector('[data-guest-sec]');
      if (gs) { gs.outerHTML = guestSec(); ui.hydrate(s.body); }
      const nk = s.body.querySelector('.c-ys-nickg');
      if (nk) nk.innerHTML = nickRow();
    }
    if (type === 'data') { const t = s.body.querySelector('.c-ys-dataline .row-title'); if (t) t.textContent = dataLine(); }
  });
  return s;
}
// The rows both sheets share: pick who you are, theme, check for new week, install, haptics.
function wireSheet(s) {
  s.body.addEventListener('click', async e => {
    if (e.target.closest('[data-guest]')) { openGuestSheet(); return; }
    if (e.target.closest('[data-pic]')) { choosePicture(); return; }
    if (e.target.closest('[data-pic-rm]')) { removePicture(); return; }
    const me = e.target.closest('[data-me]');
    if (me) {
      const k = me.dataset.me;
      if (k === pickKey()) return;
      ui.haptic('selection');
      const u = data.USERS.find(x => 'user:' + x.id === k);
      if (u) { data.setGuest(u.name); return; }
      if (k === 'none' && data.user()) data.setGuest(null); // an app user who isn't one on this phone any more
      data.setMe(k);
      return;
    }
    const tp = e.target.closest('[data-theme-pick]');
    if (tp && window.GGTheme) {
      await window.GGTheme.picker();
      const sub = tp.querySelector('.row-sub');
      if (sub) sub.textContent = themeName();
      return;
    }
    const rl = e.target.closest('[data-reload]');
    if (rl) {
      if (rl.dataset.busy) return;
      rl.dataset.busy = '1';
      const tr = document.createElement('span');
      tr.className = 'row-trail';
      tr.innerHTML = '<span class="spin" aria-hidden="true"></span>';
      rl.appendChild(tr);
      rl.setAttribute('aria-busy', 'true');
      try {
        const r = await data.reload();
        ui.toast(r.newWeek ? `Week ${r.throughWeek} is in.` : `Up to date. Through week ${r.throughWeek}.`, {icon: 'check-circle'});
      } catch (_) {
        ui.toast("Can't reach the league. Check your connection.");
      }
      tr.remove();
      rl.removeAttribute('aria-busy');
      delete rl.dataset.busy;
      const t = s.body.querySelector('.c-ys-dataline .row-title');
      if (t) t.textContent = dataLine();
      return;
    }
    if (e.target.closest('[data-install]')) {
      const ok = await promptInstall();
      if (ok) ui.toast('Installed. Open Gridiron from your home screen.', {icon: 'check-circle'});
      refreshInstall();
    }
  });
  s.body.addEventListener('ui:change', e => {
    if (!e.detail || e.detail.name !== 'haptics') return;
    ui.lsSet('gg-haptics', e.detail.value ? '1' : '0');
    if (e.detail.value) ui.haptic('light');
  });
}

// ============================================================================ Streak sheet
const DAY_MS = 864e5;
const dayDiff = (a, b) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / DAY_MS);
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function calendarHTML(s) {
  const P = daily.PNUM;
  const today = daily.dateOf(P);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  // Five weeks ending this week; weeks entirely before the Daily's first day are left out.
  const first = P - dayDiff(today, new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow)); // puzzle day of this Monday
  const skip = Math.max(0, Math.min(4, Math.floor((1 - (first - 28)) / 7)));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow - 28 + skip * 7);
  let weeks = '';
  for (let w = 0; w < 5 - skip; w++) {
    let cells = '';
    for (let k = 0; k < 7; k++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + k);
      const n = P + dayDiff(d, today);
      const lbl = `${WD_LONG[k]}, ${d.toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}`;
      let cls, what;
      if (n > P) { cls = 'is-future'; what = 'coming up'; }
      else if (n < 1) { cls = 'is-before'; what = 'before the Daily started'; }
      else if (s.done.has(n)) { const pf = s.perfect.has(n); cls = pf ? 'is-perfect' : 'is-done'; what = pf ? 'perfect day' : 'finished'; }
      else if (n === P) { cls = 'is-today' + (s.atRisk ? ' is-risk' : ''); what = 'today, not finished yet'; }
      else { cls = 'is-missed'; what = 'missed'; }
      cells += `<span class="c-sk-d ${cls}${n === P ? ' is-now' : ''}" role="img" aria-label="${esc(`${lbl}: ${what}`)}"></span>`;
    }
    weeks += `<div class="c-sk-wk">${cells}</div>`;
  }
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (5 - skip) * 7 - 1);
  const fmt = d => d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
  return `<div class="c-sk-cal"><div class="c-sk-wk c-sk-head" aria-hidden="true">${WD.map(x => `<span>${x}</span>`).join('')}</div>${weeks}<p class="c-sk-range">${esc(fmt(start))} – ${esc(fmt(end))}</p></div>`;
}

export function openStreakSheet() {
  if (daily.status !== 'ready') { daily.ensure().then(() => openStreakSheet()).catch(() => ui.toast('Puzzles need a connection the first time.')); return null; }
  ensureDefs();
  const s = daily.streakLocal();
  const copy = s.atRisk ? `Your ${s.current}-day streak ends at midnight.`
    : s.current > 0 ? 'Safe until tomorrow. See you then.'
    : `Finish all ${countWord()} today to start a streak.`;
  // v1 days keep the original line; a five-puzzle day (v2 or v3) counts every puzzle of each day (three or five).
  const foot = daily.STEPS.length > 3 ? 'Streaks count days you finished every puzzle on this phone.' : 'Streaks count days you finished all three puzzles on this phone.';
  const body = `<div class="c-sk-hero">
<span class="c-sk-flame">${flameIcon({size: 56, cold: !s.current || s.atRisk})}</span>
<p class="c-sk-num"><span class="n1 c-sk-n">${esc(s.current)}</span><span class="c-sk-u">day streak</span></p>
<p class="c-sk-best">Best ${esc(s.best)}</p>
</div>
${calendarHTML(s)}
<p class="c-sk-copy${s.atRisk ? ' is-risk' : ''}">${esc(copy)}</p>
<p class="c-sk-foot">${esc(foot)}</p>`;
  const sh = ui.openSheet({title: 'Streak', body, cls: 'sh-streak', detents: ['fit']});
  if (!ui.RM) {
    const f = sh.body.querySelector('.c-sk-flame');
    if (f && s.current) ui.animate(f, [{transform: 'scale(.6) translateY(6px)', opacity: 0}, {transform: 'none', opacity: 1}], {spring: 'bouncy', delay: 120});
    ui.stagger(sh.body.querySelectorAll('.c-sk-cal > .c-sk-wk:not(.c-sk-head)'), {step: 40, y: 8, duration: 360});
  }
  return sh;
}

// ============================================================================ Player card
function managerFor(uid) {
  for (const m of ['today', 'season', 'streaks']) {
    try { const r = daily.boardRows(m).find(x => x.id === uid); if (r) return r.managerId || null; } catch (_) {}
  }
  return null;
}

export function openPlayerCard(uid, {managerId} = {}) {
  ensureDefs();
  const LB = daily.LB;
  const doc = (LB.players || []).find(p => p.id === uid);
  if (!doc) {
    return ui.openSheet({title: 'Player', body: ui.empty({icon: 'person', title: 'This player is off the board.', body: 'Their scores are no longer posted.'}), cls: 'sh-player', detents: ['fit']});
  }
  const nick = daily.displayName(doc);
  const mid = managerId !== undefined ? managerId : managerFor(uid);
  const me = uid === LB.uid;
  const sk = daily.streakOf(doc);
  const days = (doc.days && typeof doc.days === 'object') ? doc.days : {};
  const vals = Object.values(days).filter(d => d && typeof d === 'object');
  const played = doc.played || vals.length;
  const total = doc.total != null ? doc.total : vals.reduce((a, d) => a + (d.p || 0), 0);
  const avg = played ? Math.round(total / played) : 0;
  const best = vals.reduce((a, d) => Math.max(a, d.p || 0), 0);
  const P = daily.PNUM;
  let bars = '', n14 = 0;
  // Bars share one points scale: 1,000 while the window holds only 1,000-point days (v1 and v3), 1,500 once a v2 day
  // is in it. Gold marks a perfect day on that day's own scale.
  const maxOf = n => daily.maxPts(daily.dayFor(n));
  let scale = 1000;
  for (let n = Math.max(1, P - 13); n <= P; n++) if (days[n] && typeof days[n] === 'object') scale = Math.max(scale, maxOf(n));
  for (let n = P - 13; n <= P; n++) {
    if (n < 1) { bars += '<span class="c-pc-b is-none" aria-hidden="true"></span>'; continue; }
    const d = days[n];
    if (d && typeof d === 'object') {
      n14++;
      const p = Math.max(0, Math.min(scale, d.p || 0));
      const h = Math.max(4, Math.round(p / scale * 64));
      bars += `<span class="c-pc-b${p >= maxOf(n) ? ' is-perfect' : ''}${n === P ? ' is-now' : ''}" style="height:${h}px" aria-hidden="true"></span>`;
    } else bars += `<span class="c-pc-b is-miss${n === P ? ' is-now' : ''}" aria-hidden="true"></span>`;
  }
  const k = 'pc-' + uid + '-';
  // Every tile carries a sub line, so the values in each 2-up row sit on the same baseline.
  let bestN = 0;
  Object.keys(days).forEach(n => { const d = days[n]; if (d && typeof d === 'object' && (d.p || 0) === best && +n > bestN) bestN = +n; });
  const bestWhen = best && bestN ? daily.dateOf(bestN).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '—';
  const tiles = `<div class="tiles c-pc-tiles">${[
    ui.statTile({label: 'Days played', countTo: played, format: 'int', key: k + 'played', sub: `of ${nf(P)}`}),
    ui.statTile({label: 'Avg / day', countTo: avg, format: 'int', key: k + 'avg', sub: 'points'}),
    ui.statTile({label: 'Best day', countTo: best, format: 'int', key: k + 'best', sub: bestWhen}),
    ui.statTile({label: 'Best streak', countTo: sk.best, format: 'int', key: k + 'streak', sub: sk.best === 1 ? 'day' : 'days'})
  ].join('')}</div>`;
  const team = mid ? data.team(mid) : '';
  const body = `<div class="c-pc-head">
${ui.nickAvatar(nick, {size: 56, managerId: mid || null, you: me})}
<div class="c-pc-id"><h2 class="c-pc-name">${esc(nick)}</h2>${me || team ? `<p class="c-pc-sub">${me ? ui.badge('you') : ''}${team ? `<span class="c-pc-team">${esc(team)}</span>` : ''}</p>` : ''}</div>
${streakPillHTML({current: sk.current, atRisk: false}, {tag: 'span'})}
</div>
${tiles}
<div class="c-pc-chart">
<h3 class="c-pc-h">Last 14 days</h3>
<div class="c-pc-bars" role="img" aria-label="${esc(`Played ${n14} of the last 14 days. Best day ${nf(best)} points.`)}">${bars}</div>
<div class="c-pc-axis" aria-hidden="true"><span>2 weeks ago</span><span>Today</span></div>
</div>`;
  const sh = ui.openSheet({title: '', label: nick, body, cls: 'sh-player', detents: ['fit']});
  if (!ui.RM) {
    [...sh.body.querySelectorAll('.c-pc-b:not(.is-none)')].forEach((b, i) => {
      ui.animate(b, [{transform: 'scaleY(0)'}, {transform: 'none'}], {duration: 420, delay: 140 + i * 22, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'});
    });
  }
  return sh;
}
