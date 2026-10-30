// The League screen of the Scores tab (views/live.js; Oct 30 2026, everyone's; the owner: "The live league matchups
// should go in the scores tab and can be toggled between with the nfl matchups in the same fashion as the pick em
// screen"): this week's six league matchups (core/week.js), each side's live score and players left once their players
// kick off (core/fantasy-live.js: Yahoo's lineups scored from ESPN's box scores every 30 s while a game is on). A tap
// opens the game's sheet: the live score and both lineups slot by slot. A game already in the league file shows
// Yahoo's final and opens the matchup sheet (views/matchup.js). Styles: css/views/live.css (.ll-, .sh-ll). Owner: LIVE.
//
//   eyebrow()           -> the title's eyebrow for this screen
//   html(shown)         -> the screen's markup (hidden unless shown)
//   create(ctx, el)     -> {show(), hide(), draw(), stop()}: el is the screen body; show() starts the feed for the
//                          league's week and draws, hide() stops it.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as week from '../core/week.js';
import * as fl from '../core/fantasy-live.js';
import {openMatchup} from './matchup.js';

const esc = data.esc;
const nm = id => data.name(id);

// ---------------------------------------------------------------------------------------------- The week
function curWeek() {
  try { const c = week.current(); return c && c.games && c.games.length ? c : null; } catch (e) { console.error(e); return null; }
}
function lockedNow(cur) {
  try { return !!week.isLocked(cur.year, cur.week); } catch (_) { return !!cur.locked; }
}
function closeText(cur) {
  try { return week.lockText(cur.year, cur.week); } catch (_) { return ''; }
}
const keyOf = cur => cur.year + '-w' + cur.week;
function gameOf(cur, x) {
  return data.GAMES.find(g => g.year === cur.year && g.week === cur.week && ((g.a === x.a && g.b === x.b) || (g.a === x.b && g.b === x.a))) || null;
}
function tableRow(s, id) {
  const r = s && s.table ? s.table.find(x => x.id === id) : null;
  return r && (r.w + r.l + r.t) > 0 ? r : null;
}
const recOf = (s, id) => { const r = tableRow(s, id); return r ? data.recStr(r.w, r.l, r.t) : '0–0'; };
// Yahoo's lineups for the week, worked out once per league file and week.
let UPS = {src: null, key: '', ups: null};
function upsOf(cur) {
  const key = keyOf(cur);
  if (UPS.src !== data.DATA || UPS.key !== key) UPS = {src: data.DATA, key, ups: fl.lineups(data.DATA, cur.year, cur.week)};
  return UPS.ups;
}
function liveOf(L, cur, x) {
  if (!cur || !L.feed || L.key !== keyOf(cur) || L.feed.week !== cur.week) return null;
  try { return fl.matchup(L.feed, upsOf(cur), x.a, x.b); } catch (e) { console.error(e); return null; }
}

// ---------------------------------------------------------------------------------------------- The list
const total = v => Number(v || 0).toFixed(2);
const say = n => `${n} player${n === 1 ? '' : 's'} left`;
function liveItem(cur, s, x, lv) {
  const side = (id, t, o) => `<span class="bug-side ${t.pts >= o.pts ? 'is-fav' : 'is-dog'}">${ui.avatar(id, {size: 24, you: id === data.me()})}`
    + `<span class="bug-name"><b>${esc(nm(id))}</b><span class="bug-team">${esc(recOf(s, id))}</span></span>`
    + (t.left ? `<span class="ll-left">${t.left} left</span>` : '')
    + `<span class="bug-score n4 ll-pts">${ui.score(t.pts)}</span></span>`;
  const label = `${nm(x.a)} ${total(lv.a.pts)}, ${nm(x.b)} ${total(lv.b.pts)}, ${lv.over ? 'final, unofficial' : 'live'}. Show the lineups`;
  return `<button type="button" class="bug bug-row ll-gm is-live" data-ll-g="${esc(x.key)}" data-press="row" aria-haspopup="dialog" aria-label="${esc(label)}">`
    + side(x.a, lv.a, lv.b) + side(x.b, lv.b, lv.a) + `</button>`;
}
// Before kickoff: both managers' records where the scores will be.
function preItem(cur, s, x) {
  const side = id => { const t = s ? data.teamIn(s, id) : data.team(id); return `<span class="bug-side">${ui.avatar(id, {size: 24, you: id === data.me()})}`
    + `<span class="bug-name"><b>${esc(nm(id))}</b>${t ? `<span class="bug-team">${esc(t)}</span>` : ''}</span>`
    + `<span class="bug-score ll-rec">${esc(recOf(s, id))}</span></span>`; };
  return `<button type="button" class="bug bug-row ll-gm is-pre" data-ll-g="${esc(x.key)}" data-press="row" aria-haspopup="dialog"`
    + ` aria-label="${esc(`${nm(x.a)}, ${recOf(s, x.a)}, versus ${nm(x.b)}, ${recOf(s, x.b)}. Not under way yet. Show the lineups`)}">${side(x.a)}${side(x.b)}</button>`;
}
function itemHTML(L, cur, s, x) {
  const g = gameOf(cur, x);
  if (g) return ui.scoreBug(g, {teams: true, cls: 'll-gm', attrs: {'data-ll-g': x.key, 'data-press': 'row', 'aria-haspopup': 'dialog'}});
  const lv = liveOf(L, cur, x);
  return lv && lv.started ? liveItem(cur, s, x, lv) : preItem(cur, s, x);
}
// The header's right side: "● Updated 4:05 PM" while a game is on, "Final · unofficial", the kickoff, or the week.
function statusHTML(L, cur) {
  const lvs = cur.games.filter(x => !gameOf(cur, x)).map(x => liveOf(L, cur, x)).filter(Boolean);
  const played = cur.games.every(x => gameOf(cur, x));
  const at = new Date(L.feed && L.feed.at || Date.now()).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
  const off = L.feed && L.feed.stale ? 'Offline · ' : '';
  if (played) return `Final · Week ${esc(cur.week)}`;
  if (lvs.some(m => m.on > 0)) return `${off}<i class="lg-pulse" aria-hidden="true"></i>Updated ${esc(at)}`;
  if (lvs.length && lvs.every(m => m.over)) return `${off}Final · unofficial`;
  if (lvs.some(m => m.started) || lockedNow(cur)) return `${off}Under way · Week ${esc(cur.week)}`;
  const k = closeText(cur);
  return k ? `Kickoff ${esc(k)}` : `Week ${esc(cur.week)}`;
}
function listHTML(L) {
  const cur = curWeek();
  if (!cur) return ui.empty({icon: 'calendar', title: 'No league games this week.', body: 'The league’s matchups show up here once the schedule is in.'});
  const s = data.seasonByYear(cur.year);
  const ups = upsOf(cur), played = cur.games.every(x => gameOf(cur, x));
  const wait = !ups && !played ? `<p class="lg-lead-in">Live scores start once Yahoo\u2019s Week ${esc(cur.week)} lineups sync.</p>` : '';
  return `<div class="sh lg-sh"><h2 id="ll-h">This week’s games</h2><span class="lg-at">${statusHTML(L, cur)}</span></div>` + wait
    + ui.group(cur.games.map(x => itemHTML(L, cur, s, x)).join(''), {cls: 'll-gms', attrs: {'aria-labelledby': 'll-h'}});
}

// ---------------------------------------------------------------------------------------------- The sheet
// A player's game, in a word or two: "Sun 1:00 PM", "Q3 4:12", "Half", "Final", "Bye".
function clockOf(r) {
  const g = r.game;
  if (r.state === 'bye' || !g) return 'Bye';
  if (r.state === 'pre') return g.tbd ? 'TBD' : g.kickoff.toLocaleString('en-US', {weekday: 'short', hour: 'numeric', minute: '2-digit'});
  if (r.state === 'post') return /OT/.test(g.detail || '') ? 'Final/OT' : 'Final';
  if (/half/i.test(g.detail || '')) return 'Half';
  return g.period ? `${g.period > 4 ? 'OT' : 'Q' + g.period} ${g.clock || ''}`.trim() : 'Live';
}
// "D. Maye" (Yahoo's way, so a lineup fits a phone); a defense keeps its name.
const shortName = r => r.pos === 'DEF' ? r.name : r.name.replace(/^([A-Za-z])[A-Za-z'’.-]*\s+(?=\S)/, '$1. ');
function luPlayer(r, k) {
  if (!r) return `<span class="ll-lu-p ${k} is-empty">Empty</span>`;
  const g = r.game, vs = g ? (g.home.abbr === r.team ? 'vs ' + g.away.abbr : '@ ' + g.home.abbr) : '';
  return `<span class="ll-lu-p ${k} is-${r.state}"><b>${esc(shortName(r))}</b>`
    + `<span>${r.state === 'in' ? '<i class="ll-lu-on" aria-hidden="true"></i>' : ''}${esc(clockOf(r))}</span>`
    + ((r.state === 'pre' ? vs : r.line) ? `<em>${esc(r.state === 'pre' ? vs : r.line)}</em>` : '') + `</span>`;
}
// Points; a dash until his game kicks off (or all week, on a bye).
const luPts = (r, k) => {
  const off = !r || r.state === 'pre' || r.state === 'bye';
  return `<span class="ll-lu-pts ${k} n5${off ? ' is-0' : ''}">${r ? (off ? '–' : esc(total(r.pts))) : ''}</span>`;
};
// Both lineups, slot by slot (Yahoo's order), with each player's points, his game's clock and his line.
function lineupHTML(x, lv) {
  const A = lv.a.rows, B = lv.b.rows, n = Math.max(A.length, B.length);
  const slot = i => (A[i] || B[i]).slot === 'W/R/T' ? 'FLEX' : (A[i] || B[i]).slot;
  const one = (id, r) => r ? `${nm(id)}: ${r.name}, ${r.slot}, ${total(r.pts)} points, ${clockOf(r)}${r.line ? ', ' + r.line : ''}` : `${nm(id)}: empty`;
  let rows = '';
  for (let i = 0; i < n; i++) {
    rows += `<li class="ll-lu-row" aria-label="${esc(one(x.a, A[i]) + '. ' + one(x.b, B[i]))}"><span class="ll-lu-in" aria-hidden="true">`
      + luPlayer(A[i], 'a') + luPts(A[i], 'a') + `<span class="ll-lu-slot">${esc(slot(i))}</span>` + luPts(B[i], 'b') + luPlayer(B[i], 'b') + `</span></li>`;
  }
  const left = t => t.left ? `${t.left} left` : 'Done';
  return `<ul class="ll-lu" role="list">${rows}</ul>`
    + `<div class="ll-lu-tot" aria-label="${esc(`Total: ${nm(x.a)} ${total(lv.a.pts)}, ${left(lv.a)}; ${nm(x.b)} ${total(lv.b.pts)}, ${left(lv.b)}`)}"><span aria-hidden="true">${esc(left(lv.a))}</span>`
    + `<b class="n4" aria-hidden="true">${ui.score(lv.a.pts)}</b><span class="ovl" aria-hidden="true">Total</span><b class="n4" aria-hidden="true">${ui.score(lv.b.pts)}</b><span aria-hidden="true">${esc(left(lv.b))}</span></div>`;
}
function lineupsBlock(L, cur, x) {
  const lv = liveOf(L, cur, x);
  if (!lv) {
    return upsOf(cur) ? `<p class="ll-note">Loading the lineups…</p>`
      : `<p class="ll-note">Yahoo’s Week ${esc(cur.week)} lineups haven’t synced yet. They show here, scored live, once they do.</p>`;
  }
  const head = lv.over ? 'Lineups · final' : lv.started ? 'Lineups · live' : 'Starting lineups';
  return `<h3 class="mu-h">${esc(head)}</h3><div class="mu-box">${lineupHTML(x, lv)}</div>`
    + (lv.started ? `<p class="ll-note">Live from ESPN’s box scores in the league’s scoring. Yahoo’s final is the official score.</p>` : '');
}
// The sheet's score line: the live score once its players kick off, before then the records and the kickoff.
function heroHTML(L, cur, x) {
  const s = data.seasonByYear(cur.year);
  const lv = liveOf(L, cur, x), on = !!(lv && lv.started);
  const side = (id, k) => {
    const t = s ? data.teamIn(s, id) : data.team(id);
    const me = on && lv[k], o = on && lv[k === 'a' ? 'b' : 'a'];
    return `<span class="bug-side ${on ? (me.pts > o.pts ? 'is-win' : me.pts < o.pts ? 'is-lose' : 'is-tie') : 'is-tie'}">${ui.avatar(id, {size: 40, you: id === data.me()})}`
      + `<span class="bug-name"><b>${esc(nm(id))}</b>${t ? `<span class="bug-team">${esc(t)}</span>` : ''}</span>`
      + (on ? `<span class="bug-score n3 ll-live">${ui.score(me.pts)}</span>` : `<span class="bug-score n4 ll-place">${esc(recOf(s, id))}</span>`) + `</span>`;
  };
  const left = on ? lv.a.left + lv.b.left : 0;
  const foot = on ? (lv.over ? 'Final · unofficial until Yahoo’s sync' : `${lv.on ? 'Live' : 'Under way'} · ${say(left)}`)
    : lockedNow(cur) ? 'Under way' : `Kickoff ${closeText(cur)}`;
  const dot = on && !lv.over && lv.on ? '<i class="ll-dot" aria-hidden="true"></i>' : '';
  return `<div class="bug bug-row bug-hero mu-bug ll-bug${on ? ' is-live' : ''}">${side(x.a, 'a')}${side(x.b, 'b')}<span class="bug-foot"><span class="ovl">${dot}${esc(foot.toUpperCase())}</span></span></div>`;
}
function openGame(L, key) {
  const cur = curWeek();
  const x = cur && cur.games.find(g => g.key === key);
  if (!x) return;
  ui.haptic('light');
  const g = gameOf(cur, x);
  if (g) { openMatchup(g, L.ctx); return; }
  const {a, b} = x;
  const hero = heroHTML(L, cur, x), lu = lineupsBlock(L, cur, x);
  const ovl = `Week ${cur.week} · ${cur.year}`;
  const lv = liveOf(L, cur, x);
  const body = `<div class="mu"><div class="mu-hero"><div class="ll-hero">${hero}</div></div><div class="ll-lu-w">${lu}</div>`
    + `<div class="mu-actions">${ui.button({label: 'Matchup preview', kind: 'secondary', icon: 'versus', attrs: {'data-ll-go': 'matchup'}})}`
    + `<div class="mu-profiles">${ui.button({label: `${nm(a)}'s profile`, kind: 'plain', attrs: {'data-ll-go': 'a'}})}${ui.button({label: `${nm(b)}'s profile`, kind: 'plain', attrs: {'data-ll-go': 'b'}})}</div></div></div>`;
  let S = null;
  const sh = ui.openSheet({header: `<span class="ovl mu-ovl">${esc(ovl)}</span>`, label: `${ovl}: ${nm(a)} vs ${nm(b)}, ${lv && lv.started ? (lv.over ? 'final' : 'under way') : 'not under way yet'}`,
    body, cls: 'sh-matchup sh-ll', detents: ['medium', 'large'], onClose: () => { if (L.sheet === S) L.sheet = null; }});
  S = L.sheet = {sh, x};
  const hw = sh.body.querySelector('.ll-hero'), lw = sh.body.querySelector('.ll-lu-w');
  if (hw) hw._html = hero;
  if (lw) lw._html = lu;
  sh.body.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-ll-go]');
    if (!t || !sh.open) return;
    const k = t.dataset.llGo;
    sh.close();
    if (k === 'matchup') { L.ctx.nav('/matchup'); return; }
    const id = k === 'a' ? a : b;
    const sides = sh.body.querySelectorAll('.ll-bug .bug-side');
    const av = sides[k === 'a' ? 0 : 1] && sides[k === 'a' ? 0 : 1].querySelector('.av');
    L.ctx.nav('/managers/' + encodeURIComponent(id), av ? {morphFrom: av} : undefined);
  });
  return sh;
}
// The open sheet follows the feed: its score, its foot and its lineups.
function patchSheet(L) {
  const S = L.sheet, cur = curWeek();
  if (!S || !S.sh.open || !cur) return;
  const hero = S.sh.body.querySelector('.ll-hero'), lu = S.sh.body.querySelector('.ll-lu-w');
  const h = heroHTML(L, cur, S.x), l = lineupsBlock(L, cur, S.x);
  if (hero && hero._html !== h) { hero.innerHTML = h; hero._html = h; }
  if (lu && lu._html !== l) { lu.innerHTML = l; lu._html = l; }
}

// ---------------------------------------------------------------------------------------------- The screen
/** The title's eyebrow while this screen shows: "League · Week 8 · Live". */
export function eyebrow() {
  const cur = curWeek();
  return cur ? `League · Week ${cur.week} · Live` : 'League · Live';
}
export function html(shown) {
  return `<div class="lg-body ll" data-ll${shown ? '' : ' hidden'}><section class="ll-games" data-ll-list></section>`
    + `<p class="lg-foot">Unofficial live scores: each manager’s Yahoo lineup scored from ESPN’s box scores in the league’s scoring (PPR, kickers by distance, defenses by sacks, takeaways and points allowed), every 30 seconds while games are on. Yahoo’s final replaces them once the week syncs.</p></div>`;
}

export function create(ctx, el) {
  const L = {ctx, el, key: '', feed: null, stop: null, sheet: null, on: false, html: ''};
  const list = () => el.querySelector('[data-ll-list]');
  const draw = () => {
    const w = list();
    if (!w || !L.on) return;
    const h = listHTML(L);
    if (h === L.html) return;
    // Keep the focus on the game it was on.
    const fk = document.activeElement && w.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.llG : '';
    w.innerHTML = h;
    L.html = h;
    if (fk) { const n = w.querySelector(`[data-ll-g="${CSS.escape(fk)}"]`); if (n) n.focus({preventScroll: true}); }
  };
  const stopFeed = () => { if (L.stop) { L.stop(); L.stop = null; } };
  // The feed for the league's week runs while this screen is on screen and the week has Yahoo's lineups.
  const startFeed = () => {
    const cur = curWeek(), key = cur ? keyOf(cur) : '';
    if (L.stop && L.key === key) return;
    stopFeed();
    if (L.key !== key) L.feed = null;
    L.key = key;
    if (!cur || !upsOf(cur) || cur.games.every(x => gameOf(cur, x))) return;
    L.stop = fl.watch(cur.year, cur.week, feed => {
      if (!L.on || L.key !== key) return;
      L.feed = feed;
      draw();
      patchSheet(L);
    });
  };
  const onClick = e => {
    const t = e.target.closest && e.target.closest('[data-ll-g]');
    if (t && L.on) openGame(L, t.dataset.llG);
  };
  el.addEventListener('click', onClick);
  return {
    show() { L.on = true; draw(); startFeed(); },
    hide() { L.on = false; stopFeed(); },
    // A new league file or a new "me": the week, the lineups and the you-rings.
    draw() { L.html = ''; draw(); if (L.on) startFeed(); },
    stop() { L.on = false; stopFeed(); el.removeEventListener('click', onClick); if (L.sheet && L.sheet.sh.open) L.sheet.sh.close(); L.sheet = null; }
  };
}
