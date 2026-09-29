// Sheets opened from Today (spec 7.8): the You sheet (who you are, posting name, haptics, data, install, about),
// the Streak sheet (5-week heatmap) and the Player card (a leaderboard nickname's posted days).
// Owner: daily-hub package.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {APP_VERSION, installEvent, promptInstall} from '../app.js';
import {flameIcon, streakPillHTML, ensureDefs, countWord} from './board.js';

const esc = data.esc;
const nf = n => data.nf(n);

function sec(title, inner, foot, attrs = '') {
  return `<section class="c-ys"${attrs ? ' ' + attrs : ''}><h3 class="c-ys-h">${esc(title)}</h3>${inner}${foot ? `<p class="c-ys-f">${esc(foot)}</p>` : ''}</section>`;
}

// ============================================================================ You sheet
let youSheet = null;

function gridHTML() {
  const me = data.meRaw();
  const cells = data.ids.map(id => `<button type="button" class="pm-cell c-you-cell" data-me="${esc(id)}" aria-pressed="${id === me}">${ui.avatar(id, {size: 56, you: id === me})}<span>${esc(data.name(id))}</span></button>`).join('');
  return `<div class="pm-grid c-you-grid" role="group" aria-label="Which one are you?">${cells}</div>`
    + `<button type="button" class="btn btn-secondary c-you-none" data-me="none" aria-pressed="${me === 'none'}">${ui.icon('check', {size: 18, cls: 'c-you-nck'})}<span class="btn-label">Not in the league</span></button>`;
}
function nickRow() {
  const nick = daily.LB.nick;
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
function youBody() {
  const L = data.DATA && data.DATA.league ? data.DATA.league.name : 'Gridiron Gangbang';
  const sp = data.span;
  const MOTION = "Motion follows your phone's Reduce Motion setting.";
  // No vibrate (every iPhone): no Haptics switch, so the motion note becomes the section's row instead of a
  // footnote under an empty header.
  const feel = ui.HAPTICS_SUPPORTED
    ? sec('Feel', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('pulse', {size: 20})}</span>`, title: 'Haptics', trail: ui.switchCtl({name: 'haptics', checked: ui.lsGet('gg-haptics') !== '0', label: 'Haptics'})})), MOTION)
    : sec('Feel', ui.group(ui.row({lead: `<span class="c-ys-ic">${ui.icon('pulse', {size: 20})}</span>`, title: MOTION, cls: 'c-ys-wrap'})));
  return sec('Which one are you?', gridHTML(), 'Only saved on this phone. Used to highlight you.')
    + sec('Leaderboard', ui.group(nickRow(), {cls: 'c-ys-nickg'}))
    + feel
    + sec('Data', ui.group(
      ui.row({lead: `<span class="c-ys-ic">${ui.icon('calendar', {size: 20})}</span>`, title: dataLine(), cls: 'c-ys-dataline'})
      + ui.row({lead: `<span class="c-ys-ic">${ui.icon('arrow-down', {size: 20})}</span>`, title: 'Check for new week', attrs: {'data-reload': ''}, cls: 'c-ys-act'})))
    + `<div class="c-ys-install">${installHTML()}</div>`
    + sec('About', ui.group(
      ui.row({lead: `<span class="c-ys-ic">${ui.icon('football', {size: 20})}</span>`, title: L, sub: `${sp.first}–${sp.last} · ${sp.managers} managers`})
      + ui.row({lead: `<span class="c-ys-ic">${ui.icon('info', {size: 20})}</span>`, title: 'League history from Yahoo, updated weekly.', cls: 'c-ys-wrap'})
      + ui.row({lead: `<span class="c-ys-ic">${ui.icon('gear', {size: 20})}</span>`, title: `Version ${APP_VERSION}`})));
}

function patchGrid(s, animate = true) {
  const me = data.meRaw();
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

export function openYouSheet() {
  if (youSheet && youSheet.open) return youSheet;
  let unsub = () => {};
  const s = ui.openSheet({title: 'You', body: youBody(), cls: 'sh-you', detents: ['medium', 'large'], onClose: () => { unsub(); if (youSheet === s) youSheet = null; }});
  youSheet = s;
  unsub = data.subscribe(type => {
    if (type === 'me') patchGrid(s);
    if (type === 'data') { const t = s.body.querySelector('.c-ys-dataline .row-title'); if (t) t.textContent = dataLine(); }
  });
  s.body.addEventListener('click', async e => {
    const me = e.target.closest('[data-me]');
    if (me) {
      if (me.dataset.me === data.meRaw()) return;
      ui.haptic('selection');
      data.setMe(me.dataset.me);
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
  return s;
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
  // v1 days keep the original line; a five-puzzle day counts every puzzle of each day (three or five).
  const foot = daily.isV2() ? 'Streaks count days you finished every puzzle on this phone.' : 'Streaks count days you finished all three puzzles on this phone.';
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
  // Bars share one points scale: 1,000 while the window holds only three-puzzle days, 1,500 once a five-puzzle
  // day is in it. Gold marks a perfect day on that day's own scale.
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
</div>
<p class="c-pc-foot">From this nickname's posted scores.</p>`;
  const sh = ui.openSheet({title: '', label: nick, body, cls: 'sh-player', detents: ['fit']});
  if (!ui.RM) {
    [...sh.body.querySelectorAll('.c-pc-b:not(.is-none)')].forEach((b, i) => {
      ui.animate(b, [{transform: 'scaleY(0)'}, {transform: 'none'}], {duration: 420, delay: 140 + i * 22, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'});
    });
  }
  return sh;
}
