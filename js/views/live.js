// Live (its own tab, #/live; Oct 25 2026, everyone's): the NFL week's games as they play, an
// octobox like RedZone (eight games at once, the ones in the red zone first, each with the score, the clock, who has
// the ball, the down and distance, the ball on a little field and the last play; a score flashes on its box), the
// rest of the week's games under it, then the top performers: every player's line with his points in the league's
// scoring (PPR, core/gameday.js), laid out like ESPN Fantasy's (Oct 27 2026), with chips for search, my players and each
// position. A tap on a box shows that game's players only. Then the waiver wire: the best players no one in the league
// has, over this week and the one before.
// Each player's owner in the league (the draft, then trades); "My players" and "You" follow the profile picked.
// Data: core/gameday.js (ESPN's scoreboard and box scores, every 30 s while a game is on). Styles: css/views/live.css.
// Owner: LIVE.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as gd from '../core/gameday.js';
import {youButtonHTML} from './you.js';

const esc = data.esc;
const OCTO = 8, LIST_MAX = 60;
const POS = ['all', 'QB', 'RB', 'WR', 'TE'];
const FLASH_MS = 9e3;

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
// Who has each player in the league (core/gameday.js ownersOf: the season's draft and its trades), worked out once per
// season and league file.
let OWN = {src: null, year: 0, map: null};
function owners(year) {
  if (OWN.src !== data.DATA || OWN.year !== year) OWN = {src: data.DATA, year, map: gd.ownersOf(data.DATA, year)};
  return OWN.map;
}
function playersOf(D) {
  if (!D) return [];
  const out = [], own = owners(D.year), me = data.me();
  D.boxes.forEach((box, id) => {
    const g = D.games.find(x => x.id === id);
    if (!g) return;
    box.players.forEach(p => {
      const s = p.s;
      if (!(s.att || s.car || s.rec || s.tgt || s.recYds || s.retTd || s.fumLost)) return;
      const owner = gd.ownerOf(own, p);
      out.push(Object.assign({}, p, {pos: gd.posOf(p), g, live: g.state === 'in', owner, mine: !!owner && owner === me}));
    });
  });
  return out.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
}
const ptsTxt = n => n.toFixed(2).replace(/(\.\d)0$/, '$1');
function head(p, size) {
  const ini = esc(p.name.split(' ').map(w => w[0]).slice(0, 2).join(''));
  return `<span class="lg-hs" style="--sz:${size}px" aria-hidden="true"><span>${ini}</span>`
    + (p.head ? `<img src="${esc(p.head)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '') + `</span>`;
}
// His manager's picture; a player no one in the league has shows a "+".
function ownerMark(p) {
  if (!p.owner) return `<span class="lg-fa" aria-hidden="true">${ui.icon('plus')}</span>`;
  return `<span class="lg-ow${p.mine ? ' is-me' : ''}">${ui.avatar(p.owner, {size: 32})}</span>`;
}
// Top performers, laid out like ESPN Fantasy's: "P. Nacua", his team's logo and position; his team's score first,
// the clock and the opponent ("35-21 Final @LV"); the line ("8 REC, 68 YDS, TD"); the points (no manager's name under
// them, Oct 27 2026: his picture on the left says whose he is).
const shortName = n => { const w = n.split(' '); return w.length > 1 && !/\./.test(w[0]) ? `${w[0][0]}. ${w.slice(1).join(' ')}` : n; };
const sideOf = p => p.g.home.abbr === p.team ? 'home' : 'away';
const vsTxt = p => { const g = p.g, home = sideOf(p) === 'home'; return `${home ? 'vs ' : '@'}${g[home ? 'away' : 'home'].abbr}`; };
function gameTxt(p) {
  const g = p.g, me = g[sideOf(p)], op = g[sideOf(p) === 'home' ? 'away' : 'home'];
  return `${g.state === 'pre' ? '' : `${me.score || 0}-${op.score || 0} `}${clockOf(g)} ${vsTxt(p)}`;
}
// The line, short like ESPN's: a QB's passing ("213 YDS, 3 TD"), anyone else's catches and yards from scrimmage
// ("8 REC, 68 YDS, TD"; a back's catches aren't counted out). A TD of the kind his position doesn't usually score is
// named ("REC TD" for a back, "RUSH TD" for a receiver).
const tdTxt = (n, kind) => n ? `${n > 1 ? n + ' ' : ''}${kind ? kind + ' ' : ''}TD` : '';
function lineTxt(p) {
  const s = p.s || {}, out = [];
  if (p.pos === 'QB' || (s.att && !s.rec)) {
    out.push(`${s.passYds || 0} YDS`, tdTxt(s.passTd || 0), s.int ? `${s.int > 1 ? s.int + ' ' : ''}INT` : '');
    if (s.rushYds >= 10 || s.rushTd) out.push(`${s.rushYds || 0} RUSH YDS`, tdTxt(s.rushTd || 0, 'RUSH'));
    if (s.recTd) out.push(tdTxt(s.recTd, 'REC'));
  } else {
    const rb = p.pos === 'RB';
    if (!rb && (s.rec || s.tgt)) out.push(`${s.rec || 0} REC`);
    out.push(`${(s.rushYds || 0) + (s.recYds || 0)} YDS`);
    if (rb) out.push(tdTxt(s.rushTd || 0), tdTxt(s.recTd || 0, 'REC'));
    else out.push(tdTxt(s.recTd || 0), tdTxt(s.rushTd || 0, 'RUSH'));
  }
  out.push(tdTxt(s.retTd || 0, 'RET'), s.fumLost ? `${s.fumLost > 1 ? s.fumLost + ' ' : ''}FUM` : '');
  return out.filter(Boolean).join(', ');
}
function rowHTML(p) {
  const t = p.g[sideOf(p)];
  return `<li class="lg-p${p.mine ? ' is-mine' : ''}">${ownerMark(p)}${head(p, 52)}`
    + `<div class="lg-pm"><p class="lg-pn"><span class="lg-nm">${esc(shortName(p.name))}</span>${t && t.logo ? logo(t, 18) : ''}<span class="lg-pos pos-${p.pos}">${p.pos}</span></p>`
    + `<p class="lg-pg">${esc(gameTxt(p))}${p.live ? ' <i class="lg-dot" aria-label="playing now"></i>' : ''}</p>`
    + `<p class="lg-ps">${esc(lineTxt(p))}</p></div>`
    + `<div class="lg-pr"><b class="lg-pp">${ptsTxt(p.pts)}</b></div></li>`;
}
function listHTML(st, all) {
  if (!st.D) return ui.skeleton('rows', 6, {label: 'Loading the stats.'});
  if (!st.D.boxes.size) return ui.empty({icon: 'chart', title: 'No stats yet.', body: 'Player lines show up here once the games kick off.'});
  const q = st.q.trim().toLowerCase();
  const list = all.filter(p => (st.pos === 'all' || p.pos === st.pos) && (!st.game || p.g.id === st.game) && (!st.mine || p.mine)
    && (!q || p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q
      || (p.owner && (data.name(p.owner).toLowerCase().startsWith(q) || data.team(p.owner).toLowerCase().includes(q)))));
  const g = st.game && st.D.games.find(x => x.id === st.game);
  const scope = g ? `<p class="lg-scope">${esc(`${g.away.abbr} @ ${g.home.abbr}`)} only <button type="button" class="btn btn-plain" data-lg-all><span class="btn-label">Show every game</span></button></p>` : '';
  if (!list.length) return scope + ui.empty({icon: 'search', title: 'No one matches.', body: ''});
  const shown = st.more ? list : list.slice(0, LIST_MAX);
  return scope + `<div class="lg-cols" aria-hidden="true"><span>Players</span><span>Score</span></div><ol class="lg-list">${shown.map(rowHTML).join('')}</ol>`
    + (list.length > shown.length ? `<div class="lg-morewrap">${ui.button({label: `Show all ${list.length}`, kind: 'secondary', size: 's', attrs: {'data-lg-more': ''}})}</div>` : '');
}
// ---------------------------------------------------------------------------------------------- Waiver wire
// The best players no one in the league has (Oct 27 2026), on their points over the last two weeks with stats: this week
// and the one before, or, before this week's games start, the two before it (gd.pastWeek). A player who sat one of them
// out counts only the other. "No one has him" is the draft and the trades on file: pickups since aren't known, so a
// target may already be taken.
const WAIVER_MAX = 10;
// The two weeks it's on: [the latest with stats, the one before (null until it's in)], or null.
function waiverWeeks(st) {
  const D = st.D, has = W => !!(W && W.boxes.size);
  if (!D) return null;
  const A = has(D) ? D : st.past.get(D.week - 1), B = st.past.get(A ? A.week - 1 : 0);
  return has(A) ? [A, has(B) ? B : null] : null;
}
function waiverList(st, A, B, all) {
  const m = new Map();
  (A === st.D ? all : playersOf(A)).forEach(p => { if (!p.owner) m.set(p.key, {cur: p, prev: null}); });
  playersOf(B).forEach(p => {
    if (p.owner) return;
    const e = m.get(p.key) || {cur: null, prev: null};
    e.prev = p;
    m.set(p.key, e);
  });
  return [...m.values()].map(e => Object.assign(e, {p: e.cur || e.prev, pts: (e.cur ? e.cur.pts : 0) + (e.prev ? e.prev.pts : 0)}))
    .filter(e => st.wpos === 'all' || e.p.pos === st.wpos)
    .sort((a, b) => b.pts - a.pts || (b.cur ? b.cur.pts : 0) - (a.cur ? a.cur.pts : 0) || a.p.name.localeCompare(b.p.name));
}
// wk: [the latest week, the one before (null when it isn't in)]; now: the latest is this week (its games need no "Wk").
function waiverRow(e, wk, now) {
  const p = e.p, t = p.g[sideOf(p)], pt = x => x ? ptsTxt(x.pts) : '–';
  const when = e.cur ? (now ? '' : `Wk ${wk[0]}: `) : `Wk ${wk[1]}: `;
  const said = wk[1] && `Week ${wk[0]}: ${e.cur ? pt(e.cur) : 'did not play'}. Week ${wk[1]}: ${e.prev ? pt(e.prev) : 'did not play'}.`;
  return `<li class="lg-p">${ownerMark(p)}${head(p, 52)}`
    + `<div class="lg-pm"><p class="lg-pn"><span class="lg-nm">${esc(shortName(p.name))}</span>${t && t.logo ? logo(t, 18) : ''}<span class="lg-pos pos-${p.pos}">${p.pos}</span></p>`
    + `<p class="lg-pg">${esc(when + gameTxt(p))}${p.live ? ' <i class="lg-dot" aria-label="playing now"></i>' : ''}</p>`
    + `<p class="lg-ps">${esc(lineTxt(p))}</p></div>`
    + `<div class="lg-pr"><b class="lg-pp">${ptsTxt(e.pts)}</b>${wk[1] ? `<span class="lg-po" role="img" aria-label="${esc(said)}">${pt(e.cur)} + ${pt(e.prev)}</span>` : ''}</div></li>`;
}
function waiverHTML(st, all) {
  const W = waiverWeeks(st);
  if (!W) return '';
  const [A, B] = W, wk = [A.week, B ? B.week : null];
  const list = waiverList(st, A, B, all).slice(0, WAIVER_MAX);
  return `<div class="sh lg-sh"><h2>Waiver wire</h2><span class="lg-at">Targets · PPR</span></div>`
    + `<p class="lg-lead-in">The best players no one in the league has, on their points ${B ? `over Week ${wk[0]} and Week ${wk[1]}` : `in Week ${wk[0]}`}.</p>`
    + `<div class="lg-chips" data-hscroll role="toolbar" aria-label="Waiver wire position">`
    + POS.map(p => `<button type="button" class="lg-chip" data-lg-wpos="${p}" aria-pressed="${p === st.wpos}">${p === 'all' ? 'All' : p}</button>`).join('') + `</div>`
    + (list.length
      ? `<div class="lg-cols" aria-hidden="true"><span>Players</span><span>${B ? `Wk ${wk[0]} + ${wk[1]}` : 'Score'}</span></div><ol class="lg-list">${list.map(e => waiverRow(e, wk, A === st.D)).join('')}</ol>`
      : ui.empty({icon: 'search', title: 'No one to pick up here.', body: ''}));
}

// The chips across the top: search, my players, then All, QB, RB, WR and TE.
function chipsHTML() {
  return `<div class="lg-chips" data-hscroll role="toolbar" aria-label="Filter players">`
    + `<button type="button" class="lg-chip lg-ic" data-lg-find aria-pressed="false" aria-label="Search players">${ui.icon('search')}</button>`
    + `<button type="button" class="lg-chip lg-ic" data-lg-mine aria-pressed="false" aria-label="My players">${ui.icon('person')}</button>`
    + `<i class="lg-chsep" aria-hidden="true"></i>`
    + POS.map(p => `<button type="button" class="lg-chip" data-lg-pos="${p}" aria-pressed="${p === 'all'}">${p === 'all' ? 'All' : p}</button>`).join('')
    + `</div>`;
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
  const all = playersOf(st.D);
  if (parts === 'all' || parts === 'games') st.games.innerHTML = gamesHTML(st);
  st.list.innerHTML = listHTML(st, all);
  st.waiver.innerHTML = waiverHTML(st, all);
}
// The weeks before (for the waiver wire): the one before this, and the one before that while this week has no stats.
// Each is fetched once; one that failed or came back short is tried again on the next update.
function loadPast(ctx, st) {
  const D = st.D;
  if (!D || !(D.week > 1)) return;
  const want = D.boxes.size ? [D.week - 1] : [D.week - 1, D.week - 2];
  want.filter(w => w >= 1).forEach(w => {
    const k = D.year + '-' + w;
    if (st.asked.has(k)) return;
    st.asked.add(k);
    gd.pastWeek(D.year, w).then(P => {
      if (ST.get(ctx) !== st || !st.D || st.D.year !== D.year) return;
      st.past.set(w, P);
      if (!P.games.length || P.boxes.size < P.games.filter(g => g.state === 'post').length) st.asked.delete(k);
      draw(ctx, 'stats');
    }, () => st.asked.delete(k));
  });
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
  if (st.stop) return;
  gd.loadPositions().then(() => { if (ST.get(ctx) === st && st.D) draw(ctx); }, () => {});
  st.stop = gd.watch(D => {
    if (ST.get(ctx) !== st) return;
    noteScores(st, D);
    st.D = D;
    draw(ctx);
    loadPast(ctx, st);
  });
}
function stopFeed(st) { if (st && st.stop) { st.stop(); st.stop = null; } }

export default {
  id: 'live',
  title: 'Scores',

  render() {
    return ui.largeTitle({eyebrow: 'NFL · Live', title: 'Scores', subtitle: 'Every game as it plays, the red zone first', trailing: youButtonHTML()})
      + `<div class="lg-body"><section class="lg-games" data-lg-games>${gamesHTML({D: null})}</section>`
      + `<section class="lg-stats"><div class="sh lg-sh"><h2>Top performers</h2><span class="lg-at">PPR</span></div>`
      + chipsHTML()
      + `<div class="lg-search" hidden>${ui.searchField({name: 'lg-q', placeholder: 'Player or manager', label: 'Search players'})}</div>`
      + `<div data-lg-list></div>`
      + `</section><section class="lg-waiver" data-lg-waiver></section>`
      + `<p class="lg-foot">PPR: 1 a catch, 0.1 a rushing or receiving yard, 0.04 a passing yard, 6 a TD (4 passing), −1 an interception, −2 a fumble lost. From ESPN's box scores, every 30 seconds while games are on.</p>`
      + `<p class="lg-foot">Owners are from this season\u2019s draft and the trades on file. Waiver pickups and drops aren't known yet (Yahoo rosters don't sync), so those players show no owner or the one who drafted them, and a waiver target may already be taken.</p></div>`;
  },

  mount(el, ctx) {
    const st = {ctx, el, games: el.querySelector('[data-lg-games]'), list: el.querySelector('[data-lg-list]'), waiver: el.querySelector('[data-lg-waiver]'),
      D: null, past: new Map(), asked: new Set(), wpos: 'all', pos: 'all', q: '', mine: false, game: null, more: false, prev: new Map(), flash: new Map(), flashT: 0, stop: null};
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
      const mb = t.closest('[data-lg-mine]');
      if (mb) { st.mine = !st.mine; st.more = false; mb.setAttribute('aria-pressed', String(st.mine)); draw(ctx, 'stats'); return; }
      const pb = t.closest('[data-lg-pos]');
      if (pb) {
        st.pos = pb.dataset.lgPos; st.more = false;
        el.querySelectorAll('[data-lg-pos]').forEach(b => b.setAttribute('aria-pressed', String(b === pb)));
        draw(ctx, 'stats');
        return;
      }
      const wb = t.closest('[data-lg-wpos]');
      if (wb) { st.wpos = wb.dataset.lgWpos; draw(ctx, 'stats'); return; }
      const fb = t.closest('[data-lg-find]');
      if (fb) {
        const box = el.querySelector('.lg-search'), open = box.hidden;
        box.hidden = !open; fb.setAttribute('aria-pressed', String(open));
        const inp = box.querySelector('input');
        if (open) inp.focus();
        else if (st.q) { inp.value = ''; st.q = ''; st.more = false; draw(ctx, 'stats'); }
        return;
      }
      if (t.closest('[data-lg-more]')) { st.more = true; draw(ctx, 'stats'); }
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

  // 'me': whose players are "You" and "My players"; 'data': the league file (owners).
  update(ctx) { if (ST.get(ctx)) draw(ctx); },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (st) { stopFeed(st); clearTimeout(st.flashT); }
    ST.delete(ctx);
  }
};
