// Live Games (the Lay tab's Live tile, #/lay/live; the owner's alone: Oct 25 2026): the NFL week's games as they play, an
// octobox like RedZone (eight games at once, the ones in the red zone first, each with the score, the clock, who has
// the ball, the down and distance, the ball on a little field and the last play; a score flashes on its box), the
// rest of the week's games under it, then the top performers (the best QB, RB, WR and TE so far) and every player's
// line with his points in the league's scoring (PPR, core/gameday.js). A tap on a box shows that game's players only.
// Data: core/gameday.js (ESPN's scoreboard and box scores, every 30 s while a game is on). Its stylesheet
// (css/views/live.css) loads with it, on the owner's phone only. Shown by views/lay.js (its Parlay · Live switch), which
// mounts it, swaps it out and drops it when another profile is picked. Owner: LIVE.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as gd from '../core/gameday.js';
import {modeTabsHTML} from './lay.js';
import {youButtonHTML} from './you.js';

const esc = data.esc;
const OCTO = 8, LIST_MAX = 60;
const POS = ['all', 'QB', 'RB', 'WR', 'TE'];
const FLASH_MS = 9e3;

let sheet = null;
function loadStyle() {
  if (sheet || !data.isOwner()) return;
  sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('../../css/views/live.css', import.meta.url).href;
  document.head.appendChild(sheet);
}

// ---------------------------------------------------------------------------------------------- Games
const kickTxt = g => g.tbd ? 'TBD' : g.kickoff.toLocaleString('en-US', {weekday: 'short', hour: 'numeric', minute: '2-digit'});
function clockOf(g) {
  if (g.state === 'pre') return kickTxt(g);
  if (g.state === 'post') return g.detail || 'Final';
  if (/half/i.test(g.detail)) return 'Half';
  if (/end/i.test(g.detail)) return g.detail.replace(/ of /, ' ');
  return g.period ? `${g.period > 4 ? 'OT' : 'Q' + g.period} ${g.clock || ''}`.trim() : 'Live';
}
// The octobox's order: a game that just scored, then games in the red zone, then the rest that are on (the closest
// late games first), then the next to kick off, then the finished ones.
function heat(g, st) {
  if (st.flash.has(g.id)) return 3000;
  if (g.state === 'in') {
    const diff = Math.abs((g.home.score || 0) - (g.away.score || 0)), late = (g.period || 1) >= 4 ? 1 : 0;
    return (g.sit && g.sit.rz ? 2000 : 1000) + late * 100 + Math.max(0, 50 - diff);
  }
  return g.state === 'pre' ? 500 - g.kickoff.getTime() / 1e13 : 0;
}
const ordered = (games, st) => games.slice().sort((a, b) => heat(b, st) - heat(a, st) || a.kickoff - b.kickoff);

const SCORE_WORDS = [[6, 'Touchdown'], [3, 'Field goal'], [2, 'Safety'], [1, 'Extra point']];
function flashWord(diff, g) {
  const t = g.sit && g.sit.lastType || '';
  if (/touchdown/i.test(t)) return 'Touchdown';
  if (/field goal/i.test(t)) return 'Field goal';
  if (/safety/i.test(t)) return 'Safety';
  const w = SCORE_WORDS.find(([n]) => diff >= n);
  return w ? w[1] : 'Score';
}

function logo(t, size = 28) {
  return t.logo ? `<img class="lg-logo" src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`
    : `<span class="lg-logo lg-logo-x" aria-hidden="true">${esc(t.abbr)}</span>`;
}
function dots(n) {
  if (n == null) return '';
  return `<span class="lg-to" aria-label="${n} timeouts left">${[0, 1, 2].map(i => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
}
function teamRow(g, side) {
  const t = g[side], s = g.sit, has = s && s.poss === side, won = g.state === 'post' && g.winner === side;
  const lost = g.state === 'post' && g.winner && g.winner !== side;
  return `<div class="lg-team${has ? ' has-ball' : ''}${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}">${logo(t)}`
    + `<b class="lg-abbr">${esc(t.abbr)}</b>${has ? '<span class="lg-ball" aria-label="has the ball"></span>' : ''}`
    + (g.state === 'in' && s ? dots(s.to[side]) : '')
    + (g.state === 'pre' ? `<span class="lg-rec">${esc(t.record || '')}</span>` : `<span class="lg-sc n4">${t.score || 0}</span>`) + `</div>`;
}
// The ball on a little field: the away team's end zone on the left, the home team's on the right, the first-down line.
function fieldHTML(g) {
  const s = g.sit;
  if (!s || s.x == null) return '';
  const dir = s.poss === 'away' ? 1 : s.poss === 'home' ? -1 : 0;
  const goal = /goal/i.test(s.text);
  const fd = dir && s.dist != null && !goal ? Math.max(0, Math.min(100, s.x + dir * s.dist)) : null;
  const col = t => t.color || 'var(--surface-3)';
  return `<div class="lg-field${s.rz ? ' is-rz' : ''}" aria-hidden="true" style="--ac:${esc(col(g.away))};--hc:${esc(col(g.home))}">`
    + `<i class="lg-ez lg-ez-a"></i><i class="lg-ez lg-ez-h"></i><i class="lg-yd"></i>`
    + (fd != null ? `<i class="lg-fd" style="--x:${fd}"></i>` : '')
    + `<i class="lg-los${dir < 0 ? ' is-left' : dir > 0 ? ' is-right' : ''}" style="--x:${s.x}"></i></div>`;
}
function tileHTML(g, st) {
  const s = g.sit, fl = st.flash.get(g.id), sel = st.game === g.id;
  const k = `lg-tile is-${g.state}${s && s.rz ? ' is-rz' : ''}${fl ? ' is-scored' : ''}${sel ? ' is-sel' : ''}`;
  const dd = g.state === 'in' && s && (s.text || s.spot) ? [s.text, s.spot && !/ at /.test(s.text) ? `at ${s.spot}` : ''].filter(Boolean).join(' ') : '';
  const label = `${g.away.name} ${g.away.score || 0}, ${g.home.name} ${g.home.score || 0}. ${clockOf(g)}.${s && s.rz ? ' In the red zone.' : ''}${dd ? ' ' + dd + '.' : ''}`;
  const tag = s && s.rz ? '<span class="lg-flag">Red zone</span>' : g.state === 'in' ? '<span class="lg-live">Live</span>' : '';
  return `<button type="button" class="${k}" data-lg-game="${esc(g.id)}" aria-pressed="${sel}" aria-label="${esc(label)}">`
    + `<span class="lg-top"><span class="lg-clock">${esc(clockOf(g))}</span>${tag}<span class="lg-tv">${esc(g.state === 'pre' ? g.tv : '')}</span></span>`
    + teamRow(g, 'away') + teamRow(g, 'home')
    + fieldHTML(g)
    + (dd ? `<span class="lg-dd">${esc(dd)}</span>` : '')
    + (g.state === 'in' && s && s.last ? `<span class="lg-last">${esc(s.last)}</span>` : '')
    + (fl ? `<span class="lg-burst" aria-hidden="true"><b>${esc(fl.word)}</b><span>${esc(g[fl.side].abbr)}</span></span>` : '')
    + `</button>`;
}
function miniHTML(g, st) {
  const sel = st.game === g.id;
  const side = t => `<span class="lg-mt">${logo(t, 20)}<b>${esc(t.abbr)}</b>${g.state === 'pre' ? '' : `<span class="n5">${t.score || 0}</span>`}</span>`;
  return `<button type="button" class="lg-mini is-${g.state}${sel ? ' is-sel' : ''}" data-lg-game="${esc(g.id)}" aria-pressed="${sel}">`
    + side(g.away) + side(g.home) + `<span class="lg-mc">${esc(clockOf(g))}</span></button>`;
}
function gamesHTML(st) {
  const D = st.D;
  if (!D) return ui.skeleton('rows', 4, {label: 'Loading the games.'});
  if (!D.games.length) return ui.empty({icon: 'football', title: D.error ? "Couldn't load the games." : 'No games this week.', body: D.error ? 'Check your connection.' : ''});
  const list = ordered(D.games, st), on = list.filter(g => g.state === 'in');
  const box = list.slice(0, OCTO), rest = list.slice(OCTO);
  const rz = on.filter(g => g.sit && g.sit.rz);
  const ticker = rz.length ? `<p class="lg-ticker" role="status"><b>Red zone</b> ${rz.map(g => esc(`${g[g.sit.poss || 'home'].abbr} at the ${g.sit.spot || '?'}`)).join(' · ')}</p>` : '';
  const head = `<div class="sh lg-sh"><h2>${on.length ? `${on.length} ${on.length === 1 ? 'game' : 'games'} on` : 'Week ' + D.week}</h2>`
    + `<span class="lg-at">${D.stale ? 'Offline · ' : ''}${on.length ? '<i class="lg-pulse" aria-hidden="true"></i>Updated ' : 'As of '}${esc(new Date(D.at || Date.now()).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}))}</span></div>`;
  return head + ticker + `<div class="lg-octo">${box.map(g => tileHTML(g, st)).join('')}</div>`
    + (rest.length ? `<h3 class="lg-h3">More games</h3><div class="lg-minis" data-hscroll>${rest.map(g => miniHTML(g, st)).join('')}</div>` : '');
}

// ---------------------------------------------------------------------------------------------- Players
function playersOf(st) {
  const D = st.D;
  if (!D) return [];
  const out = [];
  D.boxes.forEach((box, id) => {
    const g = D.games.find(x => x.id === id);
    if (!g) return;
    box.players.forEach(p => {
      const s = p.s;
      if (!(s.att || s.car || s.rec || s.tgt || s.recYds || s.retTd || s.fumLost)) return;
      out.push(Object.assign({}, p, {pos: gd.posOf(p), g, live: g.state === 'in'}));
    });
  });
  return out.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
}
const ptsTxt = n => n.toFixed(2);
function head(p, size) {
  const ini = esc(p.name.split(' ').map(w => w[0]).slice(0, 2).join(''));
  return `<span class="lg-hs" style="--sz:${size}px" aria-hidden="true"><span>${ini}</span>`
    + (p.head ? `<img src="${esc(p.head)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '') + `</span>`;
}
const vsTxt = p => { const g = p.g, opp = g.home.abbr === p.team ? g.away.abbr : g.home.abbr; return `${g.home.abbr === p.team ? 'vs' : '@'} ${opp}`; };
function leaderCard(pos, p) {
  if (!p) return `<div class="lg-lead is-none"><span class="lg-pos pos-${pos}">${pos}</span><p class="lg-ln">No ${pos} yet</p></div>`;
  return `<div class="lg-lead pos-${pos}"><div class="lg-lh">${head(p, 40)}<span class="lg-pos pos-${pos}">${pos}</span>`
    + `<span class="lg-lp"><b class="n4">${ptsTxt(p.pts)}</b><small>PTS</small></span></div>`
    + `<p class="lg-ln">${esc(p.name)}</p><p class="lg-lt">${esc(p.team)} ${esc(vsTxt(p))}${p.live ? ' <i class="lg-dot" aria-label="playing now"></i>' : ''}</p>`
    + `<p class="lg-ls">${esc(gd.statLine(p))}</p></div>`;
}
function leadersHTML(st, all) {
  if (!st.D) return '';
  if (!all.length) return '';
  const pick = pos => all.find(p => p.pos === pos);
  return `<div class="sh lg-sh"><h2>Top performers</h2><span class="lg-at">PPR</span></div>`
    + `<div class="lg-leads">${['QB', 'RB', 'WR', 'TE'].map(pos => leaderCard(pos, pick(pos))).join('')}</div>`;
}
function rowHTML(p, i) {
  return `<li class="lg-p${i < 3 ? ' is-top' : ''}"><span class="lg-rk n5">${i + 1}</span>${head(p, 40)}`
    + `<div class="lg-pm"><p class="lg-pn">${esc(p.name)} <span class="lg-pos pos-${p.pos}">${p.pos}</span>${p.live ? ' <i class="lg-dot" aria-label="playing now"></i>' : ''}</p>`
    + `<p class="lg-ps"><span class="lg-pt">${esc(p.team)} ${esc(vsTxt(p))}</span> · ${esc(gd.statLine(p))}</p></div>`
    + `<b class="lg-pp n4">${ptsTxt(p.pts)}</b></li>`;
}
function listHTML(st, all) {
  if (!st.D) return ui.skeleton('rows', 6, {label: 'Loading the stats.'});
  if (!st.D.boxes.size) return ui.empty({icon: 'chart', title: 'No stats yet.', body: 'Player lines show up here once the games kick off.'});
  const q = st.q.trim().toLowerCase();
  const list = all.filter(p => (st.pos === 'all' || p.pos === st.pos) && (!st.game || p.g.id === st.game)
    && (!q || p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q));
  const g = st.game && st.D.games.find(x => x.id === st.game);
  const scope = g ? `<p class="lg-scope">${esc(`${g.away.abbr} @ ${g.home.abbr}`)} only <button type="button" class="btn btn-plain" data-lg-all><span class="btn-label">Show every game</span></button></p>` : '';
  if (!list.length) return scope + ui.empty({icon: 'search', title: 'No one matches.', body: ''});
  const shown = st.more ? list : list.slice(0, LIST_MAX);
  return scope + `<ol class="lg-list">${shown.map(rowHTML).join('')}</ol>`
    + (list.length > shown.length ? `<div class="lg-morewrap">${ui.button({label: `Show all ${list.length}`, kind: 'secondary', size: 's', attrs: {'data-lg-more': ''}})}</div>` : '');
}

// ---------------------------------------------------------------------------------------------- View
const ST = new WeakMap();
function draw(ctx, parts = 'all') {
  const st = ST.get(ctx);
  if (!st) return;
  if (!ctx.visible) { st.stale = true; return; }
  st.stale = false;
  const eb = st.el.querySelector('.lt-eyebrow');
  if (eb && st.D && st.D.week) eb.textContent = `NFL · Week ${st.D.week} · Live`;
  const all = playersOf(st);
  if (parts === 'all' || parts === 'games') st.games.innerHTML = gamesHTML(st);
  st.leaders.innerHTML = leadersHTML(st, all);
  st.list.innerHTML = listHTML(st, all);
}
// Scores that went up since the last update flash on their box (not on the first load).
function noteScores(st, D) {
  const now = Date.now();
  D.games.forEach(g => {
    const was = st.prev.get(g.id), sc = {home: g.home.score || 0, away: g.away.score || 0};
    if (was && g.state !== 'pre') {
      const side = sc.home > was.home ? 'home' : sc.away > was.away ? 'away' : null;
      if (side) st.flash.set(g.id, {side, word: flashWord(sc[side] - was[side], g), until: now + FLASH_MS});
    }
    st.prev.set(g.id, sc);
  });
  st.flash.forEach((f, id) => { if (f.until <= now) st.flash.delete(id); });
  clearTimeout(st.flashT);
  if (st.flash.size) st.flashT = setTimeout(() => { st.flash.forEach((f, id) => { if (f.until <= Date.now()) st.flash.delete(id); }); if (ST.get(st.ctx) === st) draw(st.ctx, 'games'); }, FLASH_MS + 50);
}
function start(ctx, st) {
  if (st.stop || !data.isOwner()) return;
  gd.loadPositions().then(() => { if (ST.get(ctx) === st && st.D) draw(ctx); }, () => {});
  st.stop = gd.watch(D => {
    if (ST.get(ctx) !== st || !data.isOwner()) return;
    noteScores(st, D);
    st.D = D;
    draw(ctx);
  });
}
function stopFeed(st) { if (st && st.stop) { st.stop(); st.stop = null; } }

export default {
  title: 'The Lay',

  render() {
    loadStyle();
    if (!data.isOwner()) return '';
    return ui.largeTitle({eyebrow: 'NFL · Live', title: 'The Lay', subtitle: 'Every game as it plays, the red zone first', trailing: youButtonHTML()})
      + modeTabsHTML('live') + `<div class="lg-body"><section class="lg-games" data-lg-games>${gamesHTML({D: null})}</section>`
      + `<section class="lg-leaders" data-lg-leaders></section>`
      + `<section class="lg-stats"><div class="sh lg-sh"><h2>Player stats</h2><span class="lg-at">PPR points</span></div>`
      + ui.seg({name: 'lg-pos', items: POS.map(p => ({id: p, label: p === 'all' ? 'All' : p})), value: 'all', small: true, label: 'Position'})
      + `<div class="lg-search">${ui.searchField({name: 'lg-q', placeholder: 'Player or team', label: 'Search players'})}</div>`
      + `<div data-lg-list></div>`
      + `<p class="lg-foot">PPR: 1 a catch, 0.1 a rushing or receiving yard, 0.04 a passing yard, 6 a TD (4 passing), −1 an interception, −2 a fumble lost. From ESPN's box scores, every 30 seconds while games are on.</p></section></div>`;
  },

  mount(el, ctx) {
    if (!data.isOwner()) return;
    const st = {ctx, el, games: el.querySelector('[data-lg-games]'), leaders: el.querySelector('[data-lg-leaders]'), list: el.querySelector('[data-lg-list]'),
      D: null, pos: 'all', q: '', game: null, more: false, prev: new Map(), flash: new Map(), flashT: 0, stop: null};
    ST.set(ctx, st);
    el.addEventListener('click', e => {
      const t = e.target;
      const g = t.closest('[data-lg-game]');
      if (g) {
        st.game = st.game === g.dataset.lgGame ? null : g.dataset.lgGame;
        st.more = false;
        draw(ctx);
        if (st.game) st.el.querySelector('.lg-stats').scrollIntoView({block: 'start', behavior: ui.RM ? 'auto' : 'smooth'});
        return;
      }
      if (t.closest('[data-lg-all]')) { st.game = null; draw(ctx); return; }
      if (t.closest('[data-lg-more]')) { st.more = true; draw(ctx, 'stats'); }
    });
    el.addEventListener('ui:change', e => {
      if (e.detail && e.detail.name === 'lg-pos') { st.pos = e.detail.value; st.more = false; draw(ctx, 'stats'); }
    });
    el.addEventListener('input', e => {
      if (!e.target.closest('.lg-search input')) return;
      st.q = e.target.value; st.more = false;
      draw(ctx, 'stats');
    });
    draw(ctx);
    start(ctx, st);
  },

  onShow(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    start(ctx, st);
    if (st.stale) draw(ctx);
  },

  onHide(ctx) { stopFeed(ST.get(ctx)); },

  update(ctx) { if (ST.get(ctx) && data.isOwner()) draw(ctx); },

  // (views/lay.js unmounts it when another profile is picked: his stylesheet goes too.)
  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (st) { stopFeed(st); clearTimeout(st.flashT); }
    ST.delete(ctx);
    if (!data.isOwner() && sheet) { sheet.remove(); sheet = null; }
  }
};
