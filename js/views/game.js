// A game's own page (#/live/game/nfl/<id>, #/live/game/cfb/<id>; Nov 22 2026, the owner: "Users should be able to click
// on a live game and get taken to a more in depth view with box scores, latest plays, scoring plays, etc."), pushed over
// the Scores tab from any NFL or college game, laid out like the sports apps' game pages (theScore, Yahoo Sports, the
// NFL's): the scoreboard (logos, ranks, records, the score, the clock, who has the ball, timeouts) and the score by
// quarter; while it's on, where the ball is (down and distance, the spot on a little field, the last play) and the win
// probability with its chart. Then tabs:
//   Summary   scoring plays by quarter, the game's leaders, the key team stats and the game info (before kickoff: ESPN's
//             matchup predictor, the line, the season leaders and season stats);
//   Box score each team's players, category by category (passing, rushing, receiving, defense, kicking ...), then every
//             team stat side by side;
//   Plays     every drive, newest first (the one on now leads, open), each play with its down and distance and clock;
//   Fantasy   (NFL) every player's PPR points in the league's scoring with his manager in the league (core/gameday.js).
// Data: core/espn-game.js (ESPN's summary, every 20 s while the game is on); where the ball is also comes from the
// scoreboard the Scores tab already has (core/nfl.js lookup), which ESPN keeps more current between plays. The tab and
// which drives are open stay put as it updates. Styles: css/views/game.css (.gm-). Owner: LIVE.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as nfl from '../core/nfl.js';
import * as gd from '../core/gameday.js';
import * as EG from '../core/espn-game.js';

const esc = data.esc;
const TAB_KEY = 'gg-game-tab';
const ST = new WeakMap();

const feedOf = lg => (lg === 'cfb' ? [nfl.cfbAll, nfl.cfb] : [nfl]);
// The scoreboard's copy of the game (already in memory from the Scores tab, or the pick'em), or null.
function boardGame(lg, id) {
  for (const f of feedOf(lg)) {
    try { const r = f.lookup(id); if (r && r.game) return r.game; } catch (_) {}
  }
  return null;
}

// ---------------------------------------------------------------------------------------------- Pieces
const logo = (t, size = 40, cls = '') => t && t.logo
  ? `<img class="gm-logo${cls ? ' ' + cls : ''}" src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`
  : `<span class="gm-logo gm-logo-x${cls ? ' ' + cls : ''}" style="--sz:${size}px" aria-hidden="true">${esc(t ? t.abbr : '')}</span>`;
const rk = t => (t.rank ? `<i class="gm-rk">${t.rank}</i>` : '');
const pct = v => `${Math.round(v * 100)}%`;
const kickTxt = g => (g.tbd ? 'Time TBD' : g.kickoff.toLocaleString('en-US', {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}));
function clockOf(g) {
  if (g.state === 'pre') return kickTxt(g);
  if (g.state === 'post') return g.detail || 'Final';
  if (/half/i.test(g.detail)) return 'Halftime';
  if (/end/i.test(g.detail)) return g.detail;
  return g.period ? `${EG.periodName(g.league, g.period)} · ${g.clock || ''}`.replace(/ · $/, '') : 'Live';
}
const signed = n => (n == null ? '' : n > 0 ? `+${n}` : String(n));

function dots(n) {
  if (n == null) return '';
  return `<span class="gm-to" aria-label="${n} timeouts left">${[0, 1, 2].map(i => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
}
function heroSide(g, side) {
  const t = g[side], won = g.state === 'post' && t.winner, lost = g.state === 'post' && g[side === 'home' ? 'away' : 'home'].winner;
  // The ball sits on the record line, so it never squeezes the name.
  return `<div class="gm-side gm-${side}${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}">`
    + logo(t, 56)
    + `<p class="gm-tn">${rk(t)}<b>${esc(t.short || t.abbr)}</b></p>`
    + `<p class="gm-rec">${t.poss ? '<span class="gm-ball" aria-label="has the ball"></span>' : ''}${esc(t.record || '')}${g.state === 'in' ? dots(t.to) : ''}</p></div>`;
}
function heroHTML(g, stale) {
  const sc = side => (g.state === 'pre' ? '' : `<b class="gm-sc n2${g.state === 'post' && g[side].winner ? ' is-won' : ''}">${g[side].score || 0}</b>`);
  const label = `${g.away.name} ${g.state === 'pre' ? '' : g.away.score || 0} at ${g.home.name} ${g.state === 'pre' ? '' : g.home.score || 0}. ${clockOf(g)}.`;
  return `<section class="gm-hero is-${g.state}" aria-label="${esc(label)}" style="--ac:${esc(g.away.color || '#3A4150')};--hc:${esc(g.home.color || '#3A4150')}">`
    + (g.note ? `<p class="gm-note">${esc(g.note)}</p>` : '')
    + `<div class="gm-board">${heroSide(g, 'away')}`
    + `<div class="gm-mid">${sc('away')}<span class="gm-clk">${g.state === 'in' ? '<i class="gm-pulse" aria-hidden="true"></i>' : ''}${esc(clockOf(g))}</span>${sc('home')}</div>`
    + `${heroSide(g, 'home')}</div>`
    + (g.state === 'pre' ? `<p class="gm-sub">${esc([g.tv, g.odds && g.odds.text].filter(Boolean).join(' · '))}</p>` : '')
    + (stale ? `<p class="gm-stale">${ui.icon('info', {size: 14})}Offline · showing the last update</p>` : '')
    + `</section>`;
}
// The score by quarter (OT columns as needed), then the total.
function linesHTML(g) {
  if (g.state === 'pre') return '';
  const n = Math.max(EG.LEAGUES[g.league].periods, g.away.lines.length, g.home.lines.length);
  const cols = Array.from({length: n}, (_, i) => i + 1);
  const row = side => {
    const t = g[side];
    return `<tr><th scope="row">${logo(t, 20)}<span>${esc(t.abbr)}</span></th>${cols.map(i => `<td>${t.lines[i - 1] != null ? t.lines[i - 1] : '–'}</td>`).join('')}<td class="gm-tot">${t.score || 0}</td></tr>`;
  };
  return `<div class="gm-card gm-lines"><table><thead><tr><th scope="col"><span class="sr-only">Team</span></th>${cols.map(i => `<th scope="col">${esc(EG.periodName(g.league, i).replace(/(st|nd|rd|th)$/, ''))}</th>`).join('')}<th scope="col" class="gm-tot">T</th></tr></thead>`
    + `<tbody>${row('away')}${row('home')}</tbody></table></div>`;
}
// Where the ball is: down and distance, the spot, a little field (away end zone left), the last play.
function fieldHTML(g, s) {
  if (s.x == null) return '';
  const dir = s.side === 'away' ? 1 : s.side === 'home' ? -1 : 0;
  const fd = dir && s.dist != null && !/goal/i.test(s.text) ? Math.max(0, Math.min(100, s.x + dir * s.dist)) : null;
  return `<div class="gm-field${s.rz ? ' is-rz' : ''}" aria-hidden="true"><i class="gm-ez gm-ez-a">${esc(g.away.abbr)}</i><i class="gm-ez gm-ez-h">${esc(g.home.abbr)}</i>`
    + [10, 20, 30, 40, 50, 60, 70, 80, 90].map(y => `<i class="gm-yl" style="--x:${y}"></i>`).join('')
    + (fd != null ? `<i class="gm-fd" style="--x:${fd}"></i>` : '')
    + `<i class="gm-los${dir < 0 ? ' is-left' : dir > 0 ? ' is-right' : ''}" style="--x:${s.x}"></i></div>`;
}
function sitHTML(g, s) {
  if (g.state !== 'in' || !s) return '';
  const t = s.side ? g[s.side] : null;
  const dd = [s.text, s.spot && !/ at /.test(s.text) ? `at ${s.spot}` : ''].filter(Boolean).join(' ');
  return `<section class="gm-card gm-sit${s.rz ? ' is-rz' : ''}" aria-label="On the field">`
    + `<p class="gm-sit-h">${t ? logo(t, 22) : ''}<b>${esc(t ? `${t.abbr} ball` : 'On the field')}</b>${dd ? `<span>${esc(dd)}</span>` : ''}${s.rz ? '<span class="gm-flag">Red zone</span>' : ''}</p>`
    + fieldHTML(g, s)
    + (s.last ? `<p class="gm-last"><span class="gm-lbl">Last play</span>${esc(s.last)}</p>` : '')
    + `</section>`;
}
// Win probability: the bar now, and the chart of the home team's chance play by play.
function wpHTML(g) {
  const w = g.wp;
  if (!w) return '';
  const h = w.home, a = 1 - h, lead = h >= a ? 'home' : 'away';
  const S = w.series.length > 160 ? w.series.filter((_, i) => i % Math.ceil(w.series.length / 160) === 0).concat([w.series[w.series.length - 1]]) : w.series;
  const W = 300, H = 72, pts = S.map((v, i) => `${(i / Math.max(1, S.length - 1) * W).toFixed(1)},${((1 - v) * H).toFixed(1)}`);
  const chart = S.length > 1 ? `<p class="gm-wpk gm-wpk-top" aria-hidden="true">${esc(g.home.abbr)} 100%</p>`
    + `<svg class="gm-wpc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
    + `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="gm-wp50"/>`
    + `<polyline points="${pts.join(' ')}" class="gm-wpl"/></svg>`
    + `<p class="gm-wpk" aria-hidden="true">${esc(g.away.abbr)} 100%</p>` : '';
  return `<section class="gm-card gm-wp" aria-label="${esc(`Win probability: ${g.away.short} ${pct(a)}, ${g.home.short} ${pct(h)}`)}">`
    + `<p class="gm-ch">Win probability${g.state === 'post' ? ' · final' : ''}</p>`
    + `<div class="gm-wpb"><span class="gm-wpa${lead === 'away' ? ' is-lead' : ''}">${logo(g.away, 20)}${pct(a)}</span>`
    + `<span class="gm-wpbar" aria-hidden="true"><i style="width:${(a * 100).toFixed(1)}%"></i></span>`
    + `<span class="gm-wph${lead === 'home' ? ' is-lead' : ''}">${pct(h)}${logo(g.home, 20)}</span></div>${chart}</section>`;
}

// ---------------------------------------------------------------------------------------------- Summary
function scoringHTML(g) {
  if (!g.scoring.length) return g.state === 'pre' ? '' : `<section class="gm-card"><p class="gm-ch">Scoring</p><p class="gm-none">No points yet.</p></section>`;
  const by = new Map();
  g.scoring.forEach(p => { const k = p.period || 0; if (!by.has(k)) by.set(k, []); by.get(k).push(p); });
  return `<section class="gm-card gm-scoring"><p class="gm-ch">Scoring</p>`
    + [...by.entries()].map(([per, list]) => `<h3 class="gm-per">${esc(EG.periodName(g.league, per) + (per <= EG.LEAGUES[g.league].periods ? ' quarter' : ''))}</h3><ol>`
      + list.map(p => {
        const t = p.side ? g[p.side] : null;
        return `<li class="gm-sp">${t ? logo(t, 28) : ''}<div class="gm-spm"><p><b class="gm-ab">${esc(p.abbr || p.type)}</b><span class="gm-spc">${esc(p.clock)}</span></p><p class="gm-spt">${esc(p.text)}</p></div>`
          + `<span class="gm-sps n5" aria-label="${esc(`${g.away.abbr} ${p.away}, ${g.home.abbr} ${p.home}`)}"><span${p.side === 'away' ? ' class="on"' : ''}>${p.away == null ? '' : p.away}</span>–<span${p.side === 'home' ? ' class="on"' : ''}>${p.home == null ? '' : p.home}</span></span></li>`;
      }).join('') + `</ol>`).join('')
    + `</section>`;
}
function leadersHTML(g) {
  if (!g.leaders.length) return '';
  const one = (L, side) => {
    if (!L) return `<div class="gm-ld gm-ld-${side} is-none"><span class="gm-ldn">–</span></div>`;
    return `<div class="gm-ld gm-ld-${side}"><span class="gm-hs">${L.head ? `<img src="${esc(L.head)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<span>${esc(L.jersey || '')}</span></span>`
      + `<span class="gm-ldm"><b>${esc(L.short)}</b><small>${esc(L.line)}</small></span></div>`;
  };
  return `<section class="gm-card gm-leaders"><p class="gm-ch">${g.state === 'pre' ? 'Season leaders' : 'Game leaders'}</p>`
    + `<p class="gm-vs">${logo(g.away, 20)}<b>${esc(g.away.abbr)}</b><span></span><b>${esc(g.home.abbr)}</b>${logo(g.home, 20)}</p>`
    + g.leaders.map(r => `<div class="gm-ldr"><p class="gm-ldl">${esc(r.label)}</p><div class="gm-ldp">${one(r.away, 'away')}${one(r.home, 'home')}</div></div>`).join('')
    + `</section>`;
}
const nOf = v => { const m = /^-?\d+(\.\d+)?/.exec(String(v).replace(/,/g, '')); return m ? Number(m[0]) : null; };
// One stat side by side, with a bar for the share of each when both are numbers (possession in seconds).
function statRow(s) {
  const secs = v => { const m = /^(\d+):(\d\d)$/.exec(v); return m ? +m[1] * 60 + +m[2] : null; };
  let a = secs(s.away), h = secs(s.home);
  if (a == null || h == null) { a = nOf(s.away); h = nOf(s.home); }
  const ratio = /eff|-/.test(s.key) || /\d+-\d+/.test(s.away) ? null : a != null && h != null && a + h > 0 ? a / (a + h) : null;
  const lowGood = /turnover|interception|fumble|penalt|sack|allowed|against/i.test(s.key + ' ' + s.label);
  const better = ratio == null || a === h ? '' : (a > h) !== lowGood ? 'away' : 'home';
  return `<div class="gm-st"><span class="gm-sv${better === 'away' ? ' is-better' : ''}">${esc(s.away)}</span><span class="gm-sl">${esc(s.label)}</span><span class="gm-sv${better === 'home' ? ' is-better' : ''}">${esc(s.home)}</span>`
    + (ratio != null ? `<span class="gm-sbar" aria-hidden="true"><i style="width:${(ratio * 100).toFixed(1)}%"></i></span>` : '') + `</div>`;
}
const KEY_STATS = ['totalYards', 'netPassingYards', 'rushingYards', 'firstDowns', 'thirdDownEff', 'turnovers', 'totalPenaltiesYards', 'possessionTime'];
function statsHTML(g, all) {
  if (!g.stats.length) return '';
  const list = all || g.seasonStats ? g.stats : KEY_STATS.map(k => g.stats.find(s => s.key === k)).filter(Boolean);
  if (!list.length) return '';
  return `<section class="gm-card gm-stats"><p class="gm-ch">${g.seasonStats ? 'Season stats' : 'Team stats'}</p>`
    + `<p class="gm-vs">${logo(g.away, 20)}<b>${esc(g.away.abbr)}</b><span></span><b>${esc(g.home.abbr)}</b>${logo(g.home, 20)}</p>`
    + list.map(statRow).join('')
    + (!all && !g.seasonStats && g.stats.length > list.length ? `<button type="button" class="gm-more" data-gm-tab="box">All team stats${ui.icon('chevron-right', {size: 14})}</button>` : '')
    + `</section>`;
}
function predictorHTML(g) {
  const p = g.predictor;
  if (!p) return '';
  const a = Math.max(0, Math.min(100, p.away)), h = Math.max(0, Math.min(100, p.home));
  return `<section class="gm-card gm-wp" aria-label="${esc(`ESPN's matchup predictor: ${g.away.short} ${a}%, ${g.home.short} ${h}%`)}"><p class="gm-ch">Matchup predictor</p>`
    + `<div class="gm-wpb"><span class="gm-wpa${a > h ? ' is-lead' : ''}">${logo(g.away, 20)}${a.toFixed(1).replace(/\.0$/, '')}%</span>`
    + `<span class="gm-wpbar" aria-hidden="true"><i style="width:${a / Math.max(1, a + h) * 100}%"></i></span>`
    + `<span class="gm-wph${h > a ? ' is-lead' : ''}">${h.toFixed(1).replace(/\.0$/, '')}%${logo(g.home, 20)}</span></div></section>`;
}
function infoHTML(g) {
  const rows = [];
  if (g.state !== 'pre') rows.push(['Kickoff', kickTxt(g)]);
  if (g.tv) rows.push(['TV', g.tv]);
  if (g.venue.name) rows.push(['Stadium', [g.venue.name, g.venue.city].filter(Boolean).join(', ')]);
  if (g.weather) rows.push(['Weather', g.weather]);
  if (g.attendance) rows.push(['Attendance', g.attendance.toLocaleString('en-US')]);
  if (g.odds && g.odds.text) rows.push(['Line', g.odds.text + (g.odds.ou != null ? ` · O/U ${g.odds.ou}` : '')]);
  if (g.odds && g.odds.ml && g.odds.ml.away != null && g.odds.ml.home != null) rows.push(['Moneyline', `${g.away.abbr} ${signed(g.odds.ml.away)} · ${g.home.abbr} ${signed(g.odds.ml.home)}`]);
  if (!rows.length) return '';
  return `<section class="gm-card gm-info"><p class="gm-ch">Game info</p><dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`;
}
function summaryHTML(g) {
  if (g.state === 'pre') return predictorHTML(g) + leadersHTML(g) + statsHTML(g) + infoHTML(g);
  return scoringHTML(g) + leadersHTML(g) + statsHTML(g) + infoHTML(g);
}

// ---------------------------------------------------------------------------------------------- Box score
function boxHTML(g, st) {
  if (!g.box.length) return `<section class="gm-card">${ui.empty({icon: 'table', title: 'No box score yet.', body: 'Player stats show up here once the game kicks off.'})}</section>` + statsHTML(g, true);
  const side = st.side;
  const tabs = ui.seg({name: 'gm-side', items: [{id: 'away', label: `${g.away.abbr}`}, {id: 'home', label: `${g.home.abbr}`}], value: side, label: 'Team', cls: 'gm-sideseg'});
  const cats = g.box.map(c => {
    const t = c[side];
    if (!t) return '';
    return `<section class="gm-card gm-cat"><p class="gm-ch">${logo(g[side], 20)}${esc(c.label)}</p><div class="gm-tw" data-hscroll><table class="gm-tbl">`
      + `<thead><tr><th scope="col" class="gm-pc">Player</th>${t.labels.map(l => `<th scope="col">${esc(l)}</th>`).join('')}</tr></thead><tbody>`
      + t.rows.map(r => `<tr><th scope="row" class="gm-pc"><span class="gm-pn">${esc(r.short)}</span>${r.jersey ? `<small>#${esc(r.jersey)}</small>` : ''}</th>${r.stats.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')
      + (t.totals.length && t.rows.length > 1 ? `<tr class="gm-totr"><th scope="row" class="gm-pc">Team</th>${t.totals.map(v => `<td>${esc(v)}</td>`).join('')}</tr>` : '')
      + `</tbody></table></div></section>`;
  }).join('');
  return tabs + cats + statsHTML(g, true);
}

// ---------------------------------------------------------------------------------------------- Plays
function playsHTML(g, st) {
  if (!g.drives.length) return `<section class="gm-card">${ui.empty({icon: 'football', title: g.state === 'pre' ? 'The plays start at kickoff.' : 'No plays yet.', body: ''})}</section>`;
  return g.drives.map((d, i) => {
    const t = d.side ? g[d.side] : null;
    const open = st.open.has(d.id) || (!st.shut.has(d.id) && (d.live || (i === 0 && g.state !== 'post')));
    const plays = d.plays.slice().reverse();
    return `<details class="gm-card gm-drive${d.score ? ' is-score' : ''}${d.live ? ' is-live' : ''}" data-drive="${esc(d.id)}"${open ? ' open' : ''}>`
      + `<summary>${t ? logo(t, 28) : ''}<span class="gm-dm"><b>${esc(d.live ? 'Drive in progress' : d.result || 'Drive')}</b>${d.live ? '<i class="gm-pulse" aria-hidden="true"></i>' : ''}`
      + `<small>${esc([t && t.abbr, d.desc, d.start ? `from ${d.start}` : ''].filter(Boolean).join(' · '))}</small></span>${ui.icon('chevron-down', {cls: 'gm-dchev', size: 16})}</summary>`
      + `<ol class="gm-plays">${plays.map(p => `<li class="gm-play${p.scoring ? ' is-score' : ''}"><p class="gm-pd">${p.down ? `<b>${esc(p.down)}</b>` : ''}<span>${esc([EG.periodName(g.league, p.period), p.clock].filter(Boolean).join(' · '))}</span></p>`
        + `<p class="gm-pt">${p.scoring ? `<i class="gm-ab">${esc(p.abbr || 'Score')}</i>` : ''}${esc(p.text)}</p>`
        + (p.scoring && p.away != null ? `<p class="gm-pscore n5">${esc(`${g.away.abbr} ${p.away} · ${g.home.abbr} ${p.home}`)}</p>` : '') + `</li>`).join('')}</ol></details>`;
  }).join('');
}

// ---------------------------------------------------------------------------------------------- Fantasy (NFL)
const ptsTxt = n => n.toFixed(2).replace(/(\.\d)0$/, '$1');
function fantasyHTML(g, st) {
  if (g.state === 'pre' || !st.raw) return `<section class="gm-card">${ui.empty({icon: 'chart', title: 'No fantasy points yet.', body: 'Every player’s PPR points show up here once the game kicks off.'})}</section>`;
  let box;
  try { box = gd.parseBox(st.raw); } catch (_) { box = null; }
  if (!box || !box.players.length) return `<section class="gm-card">${ui.empty({icon: 'chart', title: 'No fantasy points yet.', body: ''})}</section>`;
  const year = Number(st.raw.header && st.raw.header.season && st.raw.header.season.year) || new Date().getFullYear();
  const own = gd.ownersOf(data.DATA, year), me = data.me();
  const list = box.players.map(p => Object.assign({}, p, {pos: gd.posOf(p), owner: gd.ownerOf(own, p)}))
    .filter(p => p.s && (p.s.att || p.s.car || p.s.rec || p.s.tgt || p.s.recYds || p.s.retTd || p.s.fumLost || p.s.two))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  const kick = box.kickers.slice().sort((a, b) => b.pts - a.pts);
  const row = p => {
    const t = p.team === g.home.abbr ? g.home : p.team === g.away.abbr ? g.away : null;
    return `<li class="gm-fp${p.owner && p.owner === me ? ' is-mine' : ''}"><span class="gm-ow">${p.owner ? ui.avatar(p.owner, {size: 28}) : ''}</span>`
      + `<span class="gm-hs">${p.head ? `<img src="${esc(p.head)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<span>${esc(p.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span></span>`
      + `<span class="gm-fm"><b>${esc(p.name)}</b><small>${t ? esc(t.abbr) + ' · ' : ''}${esc(p.pos || 'K')}${p.owner ? ` · ${esc(data.name(p.owner))}` : ''}</small><small class="gm-fl">${esc(p.fg ? `${p.fg.length}/${p.fgAtt} FG, ${p.xp}/${p.xpAtt} XP` : gd.statLine(p))}</small></span>`
      + `<b class="gm-fpts n5">${ptsTxt(p.pts)}</b></li>`;
  };
  return `<section class="gm-card gm-fan"><p class="gm-ch">Fantasy points · PPR</p><ol>${list.map(row).join('')}</ol>`
    + (kick.length ? `<h3 class="gm-per">Kickers</h3><ol>${kick.map(k => row(Object.assign({}, k, {head: null, pos: 'K', owner: gd.ownerOf(own, k)}))).join('')}</ol>` : '')
    + `<p class="gm-foot">The league's scoring: 1 a catch, 0.1 a rushing or receiving yard, 0.04 a passing yard, 6 a TD (4 passing), −1 an interception, −2 a fumble lost. A picture is the player's manager in the league.</p></section>`;
}

// ---------------------------------------------------------------------------------------------- Screen
function tabsOf(g) {
  if (g.state === 'pre') return [];
  const t = [{id: 'sum', label: 'Summary'}, {id: 'box', label: 'Box score'}, {id: 'plays', label: 'Plays'}];
  if (g.league === 'nfl') t.push({id: 'fan', label: 'Fantasy'});
  return t;
}
function paneHTML(g, st) {
  if (!tabsOf(g).some(t => t.id === st.tab)) return summaryHTML(g); // before kickoff (no tabs), or a tab this game hasn't
  if (st.tab === 'box') return boxHTML(g, st);
  if (st.tab === 'plays') return playsHTML(g, st);
  if (st.tab === 'fan') return fantasyHTML(g, st);
  return summaryHTML(g);
}
// The ball: the scoreboard's situation when it has this game on (ESPN keeps it more current between plays), else the
// summary's; the last play from whichever has one.
function sitOf(st, g) {
  if (g.state !== 'in') return null;
  const b = boardGame(st.lg, st.id), bs = b && b.state === 'in' && b.sit ? b.sit : null, s = g.sit;
  if (bs) return {side: bs.poss, text: bs.text, spot: bs.spot, x: bs.x, dist: bs.dist, rz: bs.rz, last: bs.last || (s && s.last) || ''};
  if (!s) return null;
  const goal = s.toGo != null && s.toGo <= 20;
  const m = /&\s*(\d+)/.exec(s.text);
  return {side: s.side, text: s.text, spot: s.spot, x: s.spot ? s.x : null, dist: m ? +m[1] : null, rz: goal && !!s.text, last: s.last};
}

function draw(ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  if (!ctx.visible) { st.stale = true; return; }
  st.stale = false;
  const L = st.last, g = L && L.game;
  if (!g) {
    st.top.innerHTML = '';
    st.pane.innerHTML = L && (L.error === 'missing' || L.error === 'offline')
      ? ui.empty({icon: 'football', title: L.error === 'missing' ? 'That game isn’t here.' : 'Couldn’t load the game.', body: L.error === 'missing' ? '' : 'Check your connection. It tries again on its own.',
        action: {label: 'Back to Scores', kind: 'secondary', attrs: {'data-nav': '/live'}}})
      : ui.skeleton('rows', 6, {label: 'Loading the game.'});
    return;
  }
  const title = `${g.away.abbr} @ ${g.home.abbr}`;
  if (title !== st.title) { st.title = title; ctx.setTitle(title); }
  const tabs = tabsOf(g);
  if (tabs.length && !tabs.some(t => t.id === st.tab)) st.tab = 'sum';
  st.top.innerHTML = heroHTML(g, L.stale) + linesHTML(g) + sitHTML(g, sitOf(st, g)) + wpHTML(g);
  // The tabs are drawn once per set (so the seg's thumb doesn't jump), the pane every update.
  const sig = tabs.map(t => t.id).join();
  if (sig !== st.tabSig) {
    st.tabSig = sig;
    st.tabs.innerHTML = tabs.length ? ui.seg({name: 'gm-tab', items: tabs, value: st.tab, label: 'Game details', cls: 'gm-tabs'}) : '';
  }
  // Keep each table's sideways scroll through the update.
  const keep = [...st.pane.querySelectorAll('.gm-tw')].map(x => x.scrollLeft);
  st.pane.innerHTML = paneHTML(g, st)
    + `<p class="gm-foot">From ESPN${g.league === 'cfb' ? '’s college feed' : ''} · ${g.state === 'in' ? 'every 20 seconds while it’s on' : g.state === 'pre' ? 'updates at kickoff' : 'final'} · as of ${esc(new Date(L.at || Date.now()).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}))}</p>`;
  st.pane.querySelectorAll('.gm-tw').forEach((x, i) => { if (keep[i]) x.scrollLeft = keep[i]; });
  ctx.refreshChrome();
}
function setTab(ctx, st, tab) {
  if (tab === st.tab) return;
  st.tab = tab;
  ui.ssSet(TAB_KEY, tab);
  const seg = st.tabs.querySelector('[data-seg="gm-tab"]');
  if (seg) ui.setSeg(seg, tab);
  if (st.last && st.last.game) {
    const g = st.last.game;
    if (ctx.visible && !ui.RM) ui.crossfade(st.pane, () => { st.pane.innerHTML = paneHTML(g, st); }, {duration: 120});
    else draw(ctx);
  }
}
function start(ctx, st) {
  if (st.stop) return;
  st.stop = EG.watchGame(st.lg, st.id, L => {
    if (ST.get(ctx) !== st) return;
    st.last = L;
    st.raw = L.raw || st.raw;
    draw(ctx);
  });
}
function stop(st) { if (st && st.stop) { st.stop(); st.stop = null; } }

export default {
  id: 'game',
  title(ctx) {
    const p = (ctx && ctx.params) || {}, b = boardGame(p.league, p.id);
    return b ? `${b.away.abbr} @ ${b.home.abbr}` : p.league === 'cfb' ? 'College game' : 'Game';
  },

  render() {
    return `<div class="gm-body"><div data-gm-top></div><div data-gm-tabs></div><div data-gm-pane>${ui.skeleton('rows', 6, {label: 'Loading the game.'})}</div></div>`;
  },

  mount(el, ctx) {
    const p = ctx.params || {};
    const st = {ctx, el, lg: EG.okLeague(p.league) ? p.league : 'nfl', id: String(p.id || ''), last: null, raw: null, stop: null, stale: false, title: '',
      tab: ui.ssGet(TAB_KEY) || 'sum', tabSig: '', side: 'away', open: new Set(), shut: new Set(),
      top: el.querySelector('[data-gm-top]'), tabs: el.querySelector('[data-gm-tabs]'), pane: el.querySelector('[data-gm-pane]')};
    ST.set(ctx, st);
    // A game already on the scoreboard draws its header at once.
    el.addEventListener('ui:change', e => {
      const d = e.detail || {};
      if (d.name === 'gm-tab') setTab(ctx, st, d.value);
      else if (d.name === 'gm-side') { st.side = d.value === 'home' ? 'home' : 'away'; draw(ctx); }
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-gm-tab]');
      if (b) { setTab(ctx, st, b.dataset.gmTab); ctx.screen.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'}); }
    });
    // Remember which drives were opened or closed by hand, so an update doesn't undo it.
    el.addEventListener('toggle', e => {
      const d = e.target;
      if (!d.matches || !d.matches('details[data-drive]')) return;
      const id = d.dataset.drive;
      if (d.open) { st.open.add(id); st.shut.delete(id); } else { st.shut.add(id); st.open.delete(id); }
    }, true);
    start(ctx, st);
  },

  onShow(ctx) { const st = ST.get(ctx); if (!st) return; start(ctx, st); if (st.stale) draw(ctx); },
  onHide(ctx) { stop(ST.get(ctx)); },
  update(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    const p = ctx.params || {};
    if (ctx.reason === 'params' && (p.id !== st.id || p.league !== st.lg)) {
      stop(st);
      Object.assign(st, {lg: EG.okLeague(p.league) ? p.league : 'nfl', id: String(p.id || ''), last: null, raw: null, title: '', tabSig: '', open: new Set(), shut: new Set()});
      draw(ctx);
      start(ctx, st);
      return;
    }
    draw(ctx); // 'me' (whose players are "mine") or 'data' (the league's owners)
  },
  unmount(el, ctx) { stop(ST.get(ctx)); ST.delete(ctx); }
};
