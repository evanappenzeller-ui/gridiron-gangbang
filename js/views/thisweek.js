// "This week" on the Puzzles screen: the league's week at a glance, four tiles like widgets, each a tap away from
// its tab. Your fantasy matchup (opponent, both records, the series), your Pick'em (picked of the slate, the next
// lock, then your record once games finish), your leg of The Lay (in or not, legs in, when they close) and the
// Matchup of the Week vote. A tile that wants something from you (picks to make, a leg to enter, a vote) is lit.
// Live: Pick'em follows the week (pickem.follow), the Lay its legs (core/lay.js subscribe); the rest is league data.
// mountThisWeek(host, ctx) -> {refresh(), destroy()}. Owner: SHELL.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as week from '../core/week.js';
import * as live from '../core/lay.js';

const esc = data.esc;
const first = id => String(data.name(id) || '').split(' ')[0];
const rec = r => (r ? `${r.w}–${r.l}${r.t ? '–' + r.t : ''}` : '0–0');
const dayTime = d => d.toLocaleString('en-US', {weekday: 'short', hour: 'numeric', minute: '2-digit'});

// ---- Tiles
function tile({href, icon, label, big, sub, hot, done, cls = '', aria}) {
  return `<a class="tw-t${hot ? ' is-hot' : ''}${done ? ' is-done' : ''}${cls ? ' ' + cls : ''}" href="${esc(href)}"${aria ? ` aria-label="${esc(aria)}"` : ''}>`
    + `<span class="tw-l">${ui.icon(icon, {size: 15})}<span>${esc(label)}</span>${hot ? '<i class="tw-dot" aria-hidden="true"></i>' : ''}</span>`
    + `<span class="tw-b">${big}</span><span class="tw-s">${sub}</span></a>`;
}

// Your fantasy matchup this week (the schedule's next unplayed week).
function matchupTile(me, cur) {
  if (!me) return tile({href: '#/matchup', icon: 'versus', label: 'Matchup', big: 'Who are you?', sub: 'Pick yourself to see your week', aria: 'Matchup. Pick who you are.'});
  const g = cur && cur.games.find(x => x.a === me || x.b === me);
  if (!g) return tile({href: '#/matchup', icon: 'versus', label: 'Matchup', big: 'Bye', sub: 'No game this week'});
  const opp = g.a === me ? g.b : g.a;
  const live1 = data.SEASONS.find(s => s.live);
  const row = id => live1 && live1.table ? live1.table.find(r => r.id === id) : null;
  let series = '';
  try { const h = data.h2hC(me, opp); const w = h.games.filter(x => x.my > x.their).length, l = h.games.filter(x => x.their > x.my).length; series = h.games.length ? ` · series ${w}–${l}` : ''; } catch (_) {}
  const big = `<span class="tw-vs">${ui.avatar(me, {size: 24, you: true})}<span class="tw-vsx">vs</span>${ui.avatar(opp, {size: 24})}<span class="tw-vsn">${esc(first(opp))}</span></span>`;
  return tile({href: `#/matchup/${encodeURIComponent(me)}-vs-${encodeURIComponent(opp)}`, icon: 'versus', label: `Week ${cur.week}`, big,
    sub: esc(`${rec(row(me))} vs ${rec(row(opp))}${series}`), aria: `Week ${cur.week} matchup: you vs ${data.name(opp)}.`});
}

// Pick'em: from pickem.follow's latest (board + picks).
function pickemTile(P) {
  const href = '#/pickem';
  if (!P || !P.s) return tile({href, icon: 'football', label: "Pick'em", big: '<span class="sk sk-line tw-sk"></span>', sub: '&nbsp;', aria: "Pick'em"});
  const s = P.s, wk = P.week ? `Wk ${P.week}` : '';
  if (!s.n) return tile({href, icon: 'football', label: `Pick'em ${wk}`, big: '—', sub: 'No games yet'});
  if (s.done) return tile({href, icon: 'football', label: `Pick'em ${wk}`, big: `<span class="n4">${s.right}–${s.wrong}</span>`, sub: 'Final. See the scoreboard', done: true});
  const need = !P.locked && s.open > 0 && !s.allIn;
  const big = `<span class="n4">${s.picked}</span><span class="tw-of">/${s.n}</span>`;
  const sub = need ? (s.next ? `Next lock ${dayTime(s.next)}` : 'Games to pick') : s.live ? `${s.live} live · you're ${s.right}–${s.wrong}`
    : P.locked ? 'Locked in' : s.open ? 'All picked' : `${s.right}–${s.wrong} so far`;
  return tile({href, icon: 'football', label: `Pick'em ${wk}`, big, sub: esc(sub), hot: need, done: !need && !s.live,
    aria: `Pick'em ${wk}: ${s.picked} of ${s.n} picked. ${sub}.`});
}

// The Lay: your leg for the live week.
function layTile(me, L) {
  const href = '#/lay', lw = live.liveWeek();
  if (!lw) return tile({href, icon: 'ticket', label: 'The Lay', big: '—', sub: 'No week open'});
  const legs = (L && L.legs) || [];
  const mine = me && legs.find(l => l.by === me);
  const shut = live.isClosed(lw.year, lw.week);
  const label = `The Lay Wk ${lw.week}`;
  if (!me) return tile({href, icon: 'ticket', label, big: `<span class="n4">${legs.length}</span><span class="tw-of">/12</span>`, sub: 'legs in'});
  if (shut) return tile({href, icon: 'ticket', label, big: 'Live', sub: mine ? 'Your leg is on the slip' : 'Legs closed', done: !!mine, cls: 'is-live'});
  if (mine) return tile({href, icon: 'ticket', label, big: 'Leg in', sub: esc(`${legs.length} of 12 in · closes ${live.closeText(lw.year, lw.week)}`), done: true});
  return tile({href, icon: 'ticket', label, big: 'Add leg', sub: esc(`Closes ${live.closeText(lw.year, lw.week)}`), hot: true, aria: `The Lay: your leg isn't in. Closes ${live.closeText(lw.year, lw.week)}.`});
}

// Matchup of the Week: the vote while it's open (rivals.badge: you haven't voted), else the week's top game.
function motwTile(cur, needVote) {
  const href = '#/matchup';
  if (!cur) return tile({href, icon: 'flame', label: 'Matchup of the Week', big: '—', sub: 'Season over'});
  let top = null;
  try { const k = week.ranking(cur.year, cur.week)[0]; top = cur.games.find(g => g.key === k) || null; } catch (_) {}
  const pair = top ? `${first(top.a)} vs ${first(top.b)}` : 'This week';
  if (needVote) return tile({href, icon: 'flame', label: 'Game of the Week', big: 'Vote', sub: esc(`Locks ${dayTime(cur.lock)}`), hot: true, aria: `Matchup of the Week: vote. Locks ${dayTime(cur.lock)}.`});
  return tile({href, icon: 'flame', label: 'Game of the Week', big: `<span class="tw-pair">${esc(pair)}</span>`, sub: cur.locked ? 'Voting closed' : 'You voted', done: !cur.locked});
}

// ---- Mount
export function mountThisWeek(host, ctx) {
  const S = {dead: false, P: null, L: null, needVote: false, stops: []};
  const paint = () => {
    if (S.dead) return;
    const me = data.me();
    let cur = null;
    try { cur = week.current(); } catch (_) { cur = null; }
    host.innerHTML = `<section class="tw" aria-label="This week"><div class="tw-h"><h2 class="tw-title">This week</h2></div>`
      + `<div class="tw-grid">${matchupTile(me, cur)}${pickemTile(S.P)}${layTile(me, S.L)}${motwTile(cur, S.needVote)}</div></section>`;
  };
  paint();
  // Pick'em: the current week, live (the module is warmed at idle anyway).
  import('./pickem.js').then(pk => {
    if (S.dead) return;
    S.stops.push(pk.follow(null, f => {
      const games = f.board ? f.board.games : null;
      if (!games) return;
      let s = null;
      try { s = pk.summarize(games, f.snap); } catch (e) { console.error(e); }
      S.P = {week: f.week, s, locked: !!(f.snap && f.snap.lockedMe)};
      paint();
    }));
  }).catch(() => {});
  // The Lay: the live week's legs.
  const lw = live.liveWeek();
  if (lw) S.stops.push(live.subscribe(lw.year, lw.week, legs => { S.L = {legs: legs || []}; paint(); }));
  // The vote: rivals.js knows whether you've voted (pure, no request).
  import('./rivals.js').then(rv => { if (S.dead) return; try { S.needVote = !!rv.badge(); } catch (_) {} paint(); }).catch(() => {});
  const onMe = data.subscribe(t => { if (t === 'me' || t === 'data') paint(); });
  const onBadge = () => import('./rivals.js').then(rv => { try { const v = !!rv.badge(); if (v !== S.needVote) { S.needVote = v; paint(); } } catch (_) {} }, () => {});
  document.addEventListener('gg:badge', onBadge);
  return {
    refresh: paint,
    destroy() {
      S.dead = true;
      S.stops.forEach(f => { try { f(); } catch (_) {} });
      try { onMe(); } catch (_) {}
      document.removeEventListener('gg:badge', onBadge);
    }
  };
}
