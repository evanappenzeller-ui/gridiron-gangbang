// The College screen of the Scores tab (views/live.js; Nov 22 2026, the owner: "Make the scores tab include college
// football. This tab should be similar to the information you can find using other popular sports apps like The Score,
// yahoo sports, nfl"): every FBS game of a college week (core/nfl.js cfbAll, ESPN's college scoreboard), like a sports
// app's scoreboard: a week stepper, chips for the Top 25 (the default), every FBS game and each conference that plays
// that week, then the games: the ones on now first (the clock, who has the ball, the down and distance, a red zone
// flag), then each day's slate (kickoff and TV, or the final). Ranks sit before the names, records under them. A tap
// opens the game's own page (views/game.js, #/live/game/cfb/<id>: box score, plays, scoring). The chip is remembered on
// this phone ('gg-cfb-scores-filter'). Styles: css/views/live.css (.lc-). Owner: LIVE.
//
//   eyebrow()           -> the title's eyebrow for this screen
//   html(shown)         -> the screen's markup (hidden unless shown)
//   create(ctx, el)     -> {show(), hide(), draw(), stop()}: el is this screen's root; show() starts the feed for the
//                          week shown and draws, hide() stops it.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as nfl from '../core/nfl.js';
import {CONFERENCES} from '../core/espn-game.js';

const esc = data.esc;
const FEED = nfl.cfbAll;
const FILTER_KEY = 'gg-cfb-scores-filter';
let last = {year: null, week: null};

export function eyebrow() {
  return last.week ? `NCAA · Week ${last.week}` : 'NCAA · FBS';
}
export function html(shown) {
  return `<div class="lg-body lc-body" data-lc${shown ? '' : ' hidden'}>`
    + `<div class="lc-wk" data-lc-wk></div><div class="lc-chips-wrap" data-lc-chips></div><section class="lc-games" data-lc-games>${ui.skeleton('rows', 6, {label: 'Loading the games.'})}</section>`
    + `<p class="lg-foot">Every FBS game from ESPN's college scoreboard, every 30 seconds while games are on. Tap a game for its box score, plays and scoring.</p></div>`;
}

// ---------------------------------------------------------------------------------------------- Pieces
const logo = (t, size = 28) => t.logo
  ? `<img class="lg-logo" src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`
  : `<span class="lg-logo lg-logo-x" aria-hidden="true">${esc(t.abbr)}</span>`;
const kick = g => g.tbd ? 'TBD' : g.kickoff.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
const dayOf = d => d.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'});
function clockOf(g) {
  if (g.state === 'pre') return kick(g);
  if (g.state === 'post') return g.detail || 'Final';
  if (/half/i.test(g.detail)) return 'Half';
  if (/end/i.test(g.detail)) return g.detail.replace(/ of /, ' ');
  const p = g.period || 0;
  return p ? `${p > 4 ? (p === 5 ? 'OT' : `${p - 4}OT`) : ['', '1st', '2nd', '3rd', '4th'][p]} ${g.clock || ''}`.trim() : 'Live';
}
const shortTV = tv => String(tv || '').split(' / ')[0];

function sideHTML(g, side) {
  const t = g[side], s = g.sit, has = g.state === 'in' && s && s.poss === side;
  const won = g.state === 'post' && g.winner === side, lost = g.state === 'post' && g.winner && g.winner !== side;
  return `<span class="lc-t${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}">${logo(t)}`
    + `<span class="lc-nm">${t.rank ? `<i class="lc-rk">${t.rank}</i>` : ''}<b>${esc(t.short || t.abbr)}</b>${has ? '<span class="lg-ball" aria-label="has the ball"></span>' : ''}`
    + `<small>${esc(t.record || '')}</small></span>`
    + (g.state === 'pre' ? '' : `<span class="lc-sc n4">${t.score || 0}</span>`) + `</span>`;
}
function rowHTML(g) {
  const s = g.sit;
  const dd = g.state === 'in' && s && (s.text || s.spot) ? [s.text, s.spot && !/ at /.test(s.text) ? `at ${s.spot}` : ''].filter(Boolean).join(' ') : '';
  const rank = t => (t.rank ? `No. ${t.rank} ` : '');
  const label = `${rank(g.away)}${g.away.name}${g.state === 'pre' ? '' : ' ' + (g.away.score || 0)} at ${rank(g.home)}${g.home.name}${g.state === 'pre' ? '' : ' ' + (g.home.score || 0)}. ${g.state === 'pre' ? `${kick(g)}${g.tv ? ' on ' + shortTV(g.tv) : ''}` : clockOf(g)}.${s && s.rz ? ' In the red zone.' : ''}${dd ? ' ' + dd + '.' : ''} Open the game.`;
  const tag = g.state === 'in' ? (s && s.rz ? '<span class="lg-flag">Red zone</span>' : '<span class="lg-live">Live</span>') : '';
  return `<li><button type="button" class="lc-g is-${g.state}${s && s.rz ? ' is-rz' : ''}" data-nav="/live/game/cfb/${esc(g.id)}" aria-label="${esc(label)}">`
    + `<span class="lc-teams">${sideHTML(g, 'away')}${sideHTML(g, 'home')}</span>`
    + `<span class="lc-st"><span class="lc-clk">${esc(clockOf(g))}</span>${tag}`
    + (g.state === 'pre' && g.tv ? `<span class="lc-tv">${esc(shortTV(g.tv))}</span>` : '')
    + (g.state === 'pre' && g.line ? `<span class="lc-tv">${esc(g.line.text)}</span>` : '')
    + (dd ? `<span class="lc-dd">${esc(dd)}</span>` : '')
    + `</span>${ui.icon('chevron-right', {cls: 'lc-go'})}</button></li>`;
}

// The chips: Top 25, every FBS game, then each conference with a game this week (in CONFERENCES' order).
function chipsOf(games) {
  const has = new Set();
  games.forEach(g => { if (g.home.conf) has.add(g.home.conf); if (g.away.conf) has.add(g.away.conf); });
  return [{id: 'top25', label: 'Top 25'}, {id: 'all', label: 'All FBS'}].concat(CONFERENCES.filter(c => has.has(c.id)));
}
function filtered(games, f) {
  if (f === 'all') return games;
  if (f === 'top25') return games.filter(g => g.home.rank || g.away.rank);
  return games.filter(g => g.home.conf === f || g.away.conf === f);
}
// Live first (the closest late games on top), then by day and kickoff (ranked games first within a kickoff).
function sections(list) {
  const live = list.filter(g => g.state === 'in').sort((a, b) => (b.period || 0) - (a.period || 0)
    || Math.abs((a.home.score || 0) - (a.away.score || 0)) - Math.abs((b.home.score || 0) - (b.away.score || 0)));
  const best = g => Math.min(g.home.rank || 99, g.away.rank || 99);
  const rest = list.filter(g => g.state !== 'in').sort((a, b) => a.kickoff - b.kickoff || best(a) - best(b));
  const out = [];
  if (live.length) out.push({h: `Live · ${live.length}`, live: true, games: live});
  rest.forEach(g => {
    const h = dayOf(g.kickoff), last = out[out.length - 1];
    if (last && !last.live && last.h === h) last.games.push(g); else out.push({h, games: [g]});
  });
  return out;
}

// ---------------------------------------------------------------------------------------------- Screen
export function create(ctx, el) {
  const st = {ctx, el, D: null, cur: null, year: null, week: null, weeks: 15, stop: null, on: false, f: ui.lsGet(FILTER_KEY) || 'top25', seq: 0};
  const box = el.querySelector('[data-lc-games]'), wk = el.querySelector('[data-lc-wk]'), chips = el.querySelector('[data-lc-chips]');

  function draw() {
    if (!st.on) return;
    const D = st.D;
    wk.innerHTML = st.week ? `<button type="button" class="lc-step" data-lc-step="-1" aria-label="Week before"${st.week > 1 ? '' : ' disabled'}>${ui.icon('chevron-left')}</button>`
      + `<span class="lc-wk-t"><b>Week ${st.week}</b>${D && D.games.length ? `<small>${esc(rangeOf(D.games))}</small>` : ''}</span>`
      + `<button type="button" class="lc-step" data-lc-step="1" aria-label="Week after"${st.week < st.weeks ? '' : ' disabled'}>${ui.icon('chevron-right')}</button>` : '';
    if (!D) { box.innerHTML = ui.skeleton('rows', 6, {label: 'Loading the games.'}); chips.innerHTML = ''; return; }
    if (!D.games.length) {
      chips.innerHTML = '';
      box.innerHTML = ui.empty({icon: 'football', title: D.error ? "Couldn't load the games." : 'No games this week.', body: D.error ? 'Check your connection.' : ''});
      return;
    }
    const items = chipsOf(D.games);
    if (!items.some(c => c.id === st.f)) st.f = 'top25';
    const rail = chips.querySelector('.chips'), left = rail ? rail.scrollLeft : 0;
    chips.innerHTML = ui.chips({name: 'lc-f', items, value: st.f, label: 'Which games', cls: 'lc-chips'});
    const r2 = chips.querySelector('.chips');
    if (r2) r2.scrollLeft = left;
    const list = filtered(D.games, st.f), on = D.games.filter(g => g.state === 'in').length;
    const head = `<div class="sh lg-sh"><h2>${on ? `${on} ${on === 1 ? 'game' : 'games'} on` : `${list.length} ${list.length === 1 ? 'game' : 'games'}`}</h2>`
      + `<span class="lg-at">${D.stale ? 'Offline · ' : ''}${on ? '<i class="lg-pulse" aria-hidden="true"></i>Updated ' : 'As of '}${esc(new Date(D.at || Date.now()).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}))}</span></div>`;
    if (!list.length) {
      box.innerHTML = head + ui.empty({icon: 'football', title: st.f === 'top25' ? 'No Top 25 games this week.' : 'No games here this week.', body: ''});
      return;
    }
    box.innerHTML = head + sections(list).map(sc => `<h3 class="lg-h3${sc.live ? ' lc-h-live' : ''}">${esc(sc.h)}</h3><ol class="lc-list">${sc.games.map(rowHTML).join('')}</ol>`).join('');
  }
  const rangeOf = games => {
    const ts = games.map(g => g.kickoff.getTime()).sort((a, b) => a - b);
    const f = t => new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
    return f(ts[0]) === f(ts[ts.length - 1]) ? f(ts[0]) : `${f(ts[0])} – ${f(ts[ts.length - 1])}`;
  };

  function watch() {
    if (st.stop) { st.stop(); st.stop = null; }
    if (!st.on || !st.week) return;
    const my = ++st.seq;
    st.stop = FEED.watch(st.year, st.week, D => {
      if (my !== st.seq || !st.on) return;
      st.D = D;
      last = {year: D.year, week: D.week};
      draw();
      const eb = ctx.screen && ctx.screen.querySelector('.lt-eyebrow');
      if (eb) eb.textContent = eyebrow(); // (only while College is the screen shown: st.on)
    });
  }
  async function begin() {
    if (st.week) { watch(); return; }
    const my = ++st.seq;
    try {
      const c = await FEED.currentWeek();
      if (my !== st.seq || !st.on) return;
      st.year = c.year; st.week = c.week; st.weeks = c.weeks || 15; st.cur = c.week;
      draw();
      watch();
    } catch (_) {
      if (my !== st.seq || !st.on) return;
      st.D = {games: [], error: 'offline', at: 0};
      draw();
    }
  }

  el.addEventListener('click', e => {
    const b = e.target.closest('[data-lc-step]');
    if (!b || !st.week) return;
    const w = st.week + Number(b.dataset.lcStep);
    if (w < 1 || w > st.weeks) return;
    ui.haptic('selection');
    st.week = w; st.D = null;
    draw();
    watch();
  });
  el.addEventListener('ui:change', e => {
    const d = e.detail || {};
    if (d.name !== 'lc-f') return;
    st.f = d.value;
    ui.lsSet(FILTER_KEY, st.f);
    draw();
  });

  return {
    show() { if (st.on) return; st.on = true; draw(); begin(); },
    hide() { st.on = false; st.seq++; if (st.stop) { st.stop(); st.stop = null; } },
    draw,
    stop() { this.hide(); }
  };
}
