// Gridiron Rivals: a player's page in his card up close, after MLB The Show's player page (the owner, Nov 2 2026: "Remove the
// real cards section. Expand on the players stats. Take inspiration from the attached mlb the show stats page"). A header in
// his team's colours (position, number badge, name), a bio grid (OVR, height, weight, age, experience, college, draft), and
// three tabs: Attributes (the card's ratings as tall bars on a 0-50-99 scale, and where he ranks at his position this season),
// Stats (this season and last, the position's full table) and Games (his last five). The bio and tables come from
// data/dynasty-stats-v1.json (tools/dynasty/stats.py, nflverse), loaded the first time a card is opened; the card's own lines
// (data/dynasty.json) stay as they are, and a Legend, who has no table, keeps his career line.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';

const esc = data.esc;
export const STATS_URL = 'data/dynasty-stats-v1.json';
let STATS = null, loading = null;

/** Loads the player pages (once). */
export function loadStats() {
  if (STATS) return Promise.resolve(STATS);
  if (!loading) loading = fetch(STATS_URL).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => (STATS = d)).catch(e => { loading = null; throw e; });
  return loading;
}
/** Takes the player pages in (loadStats()'s, or a check's). */
export const setStats = d => { STATS = d; };
export const statsOf = p => (STATS && STATS.p && STATS.p[p]) || null;

/** Dark or light ink on a colour (the number badge on his team's second colour). */
const inkOn = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#101820' : '#fff';
};
const feet = n => (n ? `${Math.floor(n / 12)}′${n % 12}″` : '');
function ageOf(dob, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob || '');
  if (!m) return 0;
  let a = now.getFullYear() - +m[1];
  if (now.getMonth() + 1 < +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() < +m[3])) a--;
  return a;
}
/** A rating's tier, for its bar's colour (The Show's bars: gold at the top, then green, blue, and the rest). */
export const tierOf = v => (v >= 90 ? 'gold' : v >= 80 ? 'green' : v >= 70 ? 'blue' : v >= 60 ? 'amber' : 'red');

function bioHTML(c, S) {
  const [ht, wt, dob, club, pick, entry] = S ? S[0] : [0, 0, '', '', 0, 0];
  const T = D.teamOf(c.team), age = ageOf(dob);
  const legend = c.s === 'X';
  const exp = legend ? c.ln[0] : c.exp ? `${c.exp} yr${c.exp === 1 ? '' : 's'}` : 'Rookie';
  const draft = legend ? '' : pick ? `${entry ? entry + ' · ' : ''}Pick ${pick}${club ? ' · ' + club : ''}` : entry ? `${entry} · Undrafted` : '';
  const cells = [
    ['Rarity', D.RARITY_NAME[c.r] || ''], ['Series', D.SERIES[c.s].name], [legend ? 'Era' : 'Experience', exp],
    ['Height', feet(ht)], ['Weight', wt ? `${wt} lbs` : ''], ['Age', age ? `${age}` : ''],
    ['College', c.college || ''], ['Drafted', draft], [legend ? 'First card' : 'Team', legend ? c.ln[1] : T.name]
  ].filter(x => x[1]);
  return `<dl class="pk-ps-bio">${cells.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}
function barsHTML(c) {
  const keys = D.attrKeys(c.pos);
  return `<div class="pk-ps-chart" role="list" aria-label="Attributes"><i class="pk-ps-grid" aria-hidden="true"><b>99</b><b>50</b><b>0</b></i>`
    + keys.map((k, i) => {
      const v = c.a[i] || 0, name = D.ATTR_NAME[k] || k;
      return `<div class="pk-ps-col t-${tierOf(v)}" role="listitem" aria-label="${esc(`${name} ${v}`)}"><em>${v}</em><span class="pk-ps-bar"><b style="height:${Math.max(2, v)}%"></b></span><small>${esc(name)}</small></div>`;
    }).join('') + '</div>';
}
function ranksHTML(c, S) {
  const r = S && S[4];
  if (!r || !r.length) return '';
  const pos = c.pos;
  return `<h4 class="pk-ps-h">${D.DATA.season} at ${esc(pos)}</h4><ul class="pk-ps-ranks">${r.map(([label, n, of]) => {
    const pct = Math.round(100 * (1 - (n - 1) / Math.max(1, of)));
    return `<li class="t-${tierOf(Math.round(40 + 0.59 * pct))}"><span>${esc(label)}</span><i class="pk-ps-rbar"><b style="width:${pct}%"></b></i><em>${ui.ordinal(n)}<small> of ${of}</small></em></li>`;
  }).join('')}</ul>`;
}
/** The card's own lines (a Gameday card's game, an Award's number), as data/dynasty.json gives them. */
function cardLines(c) {
  const out = [];
  if (c.s === 'X') out.push(['Career', c.ln[0]], ['First Topps card', c.ln[1]]);
  else if (c.s === 'G') out.push([c.t, c.ln[0]]);
  else if (c.s === 'A') out.push([c.t, c.ln[0]]);
  return out.filter(l => l[1]);
}
function tableHTML(cols, rows, lead) {
  return `<div class="pk-ps-tw" data-hscroll><table class="pk-ps-t"><thead><tr><th scope="col">${esc(lead)}</th>${cols.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>`
    + `<tbody>${rows.map(([h, cells]) => `<tr><th scope="row">${esc(h)}</th>${cells.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function seasonsHTML(c, S) {
  const g = STATS && STATS.group[c.pos], cols = g && STATS.cols[g];
  const rows = [];
  if (S && S[1]) rows.push([`${D.DATA.season}`, S[1]]);
  if (S && S[2]) rows.push([`${D.DATA.season - 1}`, S[2]]);
  const lines = cardLines(c);
  if (!rows.length) {
    // (no table: a Legend, or a player without a regular-season snap yet; the card's own lines)
    const ln = c.s === 'X' ? [] : [[`${D.DATA.season} so far`, c.ln[0]], [`${D.DATA.season - 1} season`, c.ln[1]]].filter(l => l[1]);
    const all = lines.concat(ln);
    return all.length ? `<dl class="pk-lines">${all.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`
      : `<p class="pk-ps-none">${c.s === 'X' ? 'Career stats aren’t on file for the Legends.' : 'No regular-season stats yet.'}</p>`;
  }
  return tableHTML(cols, rows, 'Season') + (lines.length ? `<dl class="pk-lines">${lines.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '')
    + (STATS.asof ? `<p class="pk-ps-src">Regular season through ${esc(STATS.asof.replace(/^\d+ /, ''))} · nflverse</p>` : '');
}
function gamesHTML(c, S) {
  const g = STATS && STATS.group[c.pos], cols = g && STATS.cols[g];
  const log = S && S[3];
  if (!log || !log.length) return `<p class="pk-ps-none">${c.pos === 'OL' ? 'Linemen’s games are counted in snaps: see Stats.' : 'No games this season yet.'}</p>`;
  return tableHTML(cols.slice(1), log.map(([w, opp, home, ...cells]) => [`Wk ${w} ${home ? 'vs' : '@'} ${opp}`, cells]), 'Game');
}
const TABS = [{id: 'attr', label: 'Attributes'}, {id: 'stats', label: 'Stats'}, {id: 'games', label: 'Games'}];
function paneHTML(tab, c, S) {
  if (tab === 'stats') return seasonsHTML(c, S);
  if (tab === 'games') return gamesHTML(c, S);
  return barsHTML(c) + ranksHTML(c, S);
}
/** His page (the stats as loaded so far: pageHTML again once loadStats() has them). */
export function pageHTML(c, tab = 'attr') {
  const T = D.teamOf(c.team), S = statsOf(c.p);
  const [first, last] = D.nameParts(c.name);
  const tabs = c.s === 'X' ? TABS.filter(t => t.id !== 'games') : TABS;
  return `<section class="pk-ps" style="--tp:${esc(T.pri)};--ts:${esc(T.sec)};--tsi:${inkOn(T.sec)}" data-dy-page="${esc(c.id)}">`
    + `<header class="pk-ps-head"><span class="pk-ps-pos">${esc(c.pos)}</span>${c.num ? `<span class="pk-ps-num">${c.num}</span>` : ''}`
    + `<span class="pk-ps-name"><small>${esc(first)}</small><b>${esc(last)}</b></span><span class="pk-ps-ovr"><b>${c.o}</b><small>OVR</small></span></header>`
    + `<p class="pk-ps-sub">${esc(D.POS_NAME[c.pos])} · ${esc(c.s === 'X' ? `Legend of the ${T.name}` : T.name)}${c.t && c.s !== 'X' ? ` · ${esc(c.t)}` : ''}</p>`
    + bioHTML(c, S)
    + ui.seg({name: 'dy-ps', items: tabs, value: tab, small: true, label: 'Player page', cls: 'pk-ps-tabs'})
    + `<div class="pk-ps-pane" data-dy-pane>${paneHTML(tab, c, S)}</div></section>`;
}
/** Wires a page in el: its tabs, and its bio and tables once the stats arrive. */
export function bindPage(el, c) {
  let tab = 'attr';
  const redraw = () => { const p = el.querySelector('[data-dy-page]'); if (p) p.outerHTML = pageHTML(c, tab); };
  el.addEventListener('ui:change', e => {
    if (!e.detail || e.detail.name !== 'dy-ps') return;
    tab = e.detail.value;
    const pane = el.querySelector('[data-dy-pane]');
    if (pane) pane.innerHTML = paneHTML(tab, c, statsOf(c.p));
  });
  if (!STATS) loadStats().then(() => { if (el.isConnected) redraw(); }).catch(() => {});
}
