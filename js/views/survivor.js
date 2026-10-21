// Survivor (the Pick'em tab's "Survivor", the owner's ask, Oct 2026): each week pick one NFL team to win; a team once
// a season; lose, tie or miss a week and you're out; last one standing wins (core/survivor.js has the rules). Shown in
// the Pick'em tab's screen by views/pickem.js's league switch (its default export is this screen's view).
//   Large title (eyebrow "Survivor · Week 7") · the switch · your card (in or out, this week's pick, how many are left,
//   when picks lock; "Lock in" to make your pick final for the week) · this week's games, by day: every team a tap target (not the ones you've used, nor any once the
//   week has locked) · the pool: everyone in first, then out by the week they went; each with their picks week by week
//   (the current week's shows once the week locks) · the rules.
// A tap picks that team for the week at once (core/survivor.js pick: on this phone's board doc); a tap on your pick
// takes it back, until you lock it in (a confirm first; then no taps change it). A week opens once the week before is over (Tuesday) and every pick locks at its first kickoff
// (Thursday night). Before Survivor's first week opens the screen says when it starts.
// Every row is the board as this phone may see it (THE RULE, CLAUDE.md: core/survivor.js reads LB.raw).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as nfl from '../core/nfl.js';
import * as week from '../core/week.js';
import * as SV from '../core/survivor.js';
import {leagueTabsHTML, goLeague, logoHTML, kickText, recText} from './pickem.js';
import {youButtonHTML} from './you.js';

const esc = data.esc;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const screens = new Map(); // ctx -> state
const memo = {d: null, p: null, t: 0}; // the last load: {year, cur, boards, before, stale}

function load(force) {
  if (memo.p && !force) return memo.p;
  memo.p = SV.load().then(d => { memo.d = d; memo.t = Date.now(); return d; }, e => { memo.p = null; throw e; });
  return memo.p;
}
/** At idle after launch (views/pickem.js, when Survivor was last chosen): the weeks ahead of a first visit. */
export function warm() { return load().catch(() => {}); }

// ---------------------------------------------------------------------------------------------- markup
const eyebrow = d => (d ? `Survivor · Week ${d.before ? SV.FIRST[d.year] || d.cur : d.cur}` : 'Survivor');
const titleHTML = d => ui.largeTitle({eyebrow: eyebrow(d), title: "Pick'em", trailing: youButtonHTML()});
const resWord = {W: 'won', L: 'lost', T: 'tied', C: 'canceled'};
function whoAvatar(r, size = 30) {
  return r.managerId ? ui.avatar(r.managerId, {size, you: r.you}) : ui.nickAvatar(r.name, {size, you: r.you});
}
const teamOf = (board, k) => { const m = SV.gameOf(board, k); return m ? m.g[m.side] : {abbr: k, short: k, name: k}; };
// When the week's picks lock (its first kickoff, Thursday night's game), or that they have.
function lockLine(board, at = week.now()) {
  const l = SV.lockOf(board);
  if (l == null) return 'Picks lock at the week’s first kickoff.';
  return SV.locked(board, at) ? 'Picks are locked for the week.' : `You can change it until picks lock at the first kickoff, ${kickText(new Date(l), at)}.`;
}
function heroHTML(d, P, me, used, board, v) {
  const first = SV.FIRST[d.year];
  if (d.before) {
    return `<section class="card su-hero"><span class="su-torch" aria-hidden="true"><img src="img/survivor.webp" alt="" width="56" height="56"></span>`
      + `<p class="ovl">Starts Week ${first}</p><h2 class="su-h">Pick one team a week. Don’t lose.</h2>`
      + `<p class="su-l">Week ${first}’s picks open once Week ${first - 1}’s games are over. Pick in Week ${first} to be in.</p></section>`;
  }
  const left = `${P.alive} of ${P.entered} still in`;
  if (P.champion) {
    const w = P.rows.find(r => r.key === P.champion);
    return `<section class="card su-hero is-champ"><p class="ovl">Survivor</p><h2 class="su-h">${esc(w.you ? 'You won Survivor' : `${w.name} won Survivor`)}</h2><p class="su-l">${esc(`Last one standing, ${plural(w.weeks, 'week')}.`)}</p></section>`;
  }
  if (!me) {
    const late = d.cur > first || SV.locked(board, week.now());
    const why = d.cur > first ? `Survivor started in Week ${first}.` : `Week ${first}’s picks locked at its first kickoff.`;
    return `<section class="card su-hero"><p class="ovl">${esc(left)}</p><h2 class="su-h">${late ? 'You’re not in this one' : 'Make a pick to get in'}</h2>`
      + `<p class="su-l">${late ? `${why} Next season, pick in the first week.` : `Pick a team below to win its game this week. ${lockLine(board)}`}</p></section>`;
  }
  if (!me.alive) {
    const p = me.picks.find(x => x.w === me.out);
    const why = me.why === 'none' ? `no pick in Week ${me.out}` : `${teamOf(d.boards.get(me.out), p.k).short} ${resWord[me.why]} in Week ${me.out}`;
    return `<section class="card su-hero is-out"><p class="ovl">${esc(left)}</p><h2 class="su-h">You’re out</h2><p class="su-l">${esc(`${why[0].toUpperCase()}${why.slice(1)}. You lasted ${plural(me.weeks, 'week')}.`)}</p></section>`;
  }
  const pick = me.pick;
  const line = pick
    ? (() => { const m = SV.gameOf(board, pick.k), t = teamOf(board, pick.k), o = m ? m.g[m.side === 'home' ? 'away' : 'home'] : null;
      return `${t.short}${o ? ` ${m.side === 'home' ? 'vs' : 'at'} ${o.short}` : ''}${m && m.g.state === 'pre' ? `, ${kickText(m.g.kickoff)}` : ''}.${v.locked ? '' : v.final ? ' Locked in: it’s final for the week.' : ` ${lockLine(board)}`}`; })()
    : `Pick a team below. ${lockLine(board)}`;
  // lock in a saved pick (not one still saving) before the week locks
  const btn = pick && !v.final && !v.locked && v.saved
    ? ui.button({label: 'Lock in pick', kind: 'secondary', size: 's', icon: 'lock', cls: 'su-lockin', attrs: {'data-su-lockin': '', 'aria-label': `Lock in ${teamOf(board, pick.k).name} as your Week ${d.cur} pick`}}) : '';
  const tag = pick && v.final && !v.locked ? `<span class="su-final">${ui.icon('lock')}Locked in</span>` : '';
  return `<section class="card su-hero is-in">${pick ? `<span class="su-pick">${logoHTML(teamOf(board, pick.k), 48)}</span>` : ''}`
    + `<p class="ovl">${esc(`You’re in · ${left}`)}</p><h2 class="su-h">${esc(pick ? `Week ${d.cur}: ${teamOf(board, pick.k).name}` : `Week ${d.cur}: no pick yet`)}</h2>`
    + `<p class="su-l">${esc(line)}</p>${tag}${btn}${used.size ? `<p class="su-used">${esc(`Used: ${[...used.keys()].join(', ')}`)}</p>` : ''}</section>`;
}
function sideHTML(g, side, v) {
  const t = g[side], k = t.abbr;
  const isMine = v.pick === k, used = v.used.get(k);
  const can = v.open && !v.locked && !v.final && !used;
  const res = isMine ? SV.resultOf(g, k) : null;
  const sc = (g.state === 'in' || (g.state === 'post' && g.final)) && t.score != null ? String(t.score) : '';
  const cls = `pk-t${isMine ? ' is-on' : ''}${res === 'L' || res === 'T' ? ' is-lose' : ''}${can ? '' : ' is-locked'}${used ? ' is-used' : ''}`;
  const sub = used ? `Used Week ${used}` : recText(t.record);
  const mark = isMine ? `<span class="pk-mk ${res === 'L' || res === 'T' ? 'is-wrong' : res === 'W' ? 'is-right' : 'is-on'}">${ui.icon(res === 'L' || res === 'T' ? 'x' : 'check')}</span>` : can ? '<span class="pk-mk is-open"></span>' : '';
  const label = `${t.name}${t.record ? `, ${recText(t.record)}` : ''}${used ? `, used in week ${used}` : ''}${isMine ? (v.final ? ', your pick, locked in' : ', your pick') : ''}${(v.locked || v.final) && !isMine ? ', picks locked' : ''}`;
  return `<button type="button" class="${cls}" data-su-team="${esc(k)}" data-su-g="${esc(g.id)}" aria-pressed="${isMine}"${can ? '' : ' aria-disabled="true"'} aria-label="${esc(label)}">`
    + logoHTML(t, 32)
    + `<span class="pk-tn"><span class="pk-tnm">${esc(t.short)}</span><span class="pk-tsub"><span class="pk-trec">${esc(sub || '')}</span></span></span>`
    + `<span class="pk-mkw">${mark}</span><span class="pk-sc n3">${esc(sc)}</span></button>`;
}
function statHTML(g, v) {
  if (g.state === 'in') return `<span class="pk-s1 is-live"><i class="c-pk-dot" aria-hidden="true"></i>Live</span>`;
  if (g.state === 'post') return `<span class="pk-s1 is-final">${g.final ? 'Final' : /cancel/i.test(g.detail) ? 'Canceled' : 'Postponed'}</span>`;
  if (nfl.gameStarted(g, v.at)) return `${ui.icon('lock', {cls: 'pk-lock'})}<span class="pk-s1">Starting</span>`;
  return `<span class="pk-s1">${esc(kickText(g.kickoff, v.at).split(' ')[0])}</span><span class="pk-s2">${esc(kickText(g.kickoff, v.at).split(' ').slice(1).join(' '))}</span>`;
}
function gamesHTML(board, v) {
  if (!board || !board.games.length) return '<p class="lp-none">No games this week yet.</p>';
  const days = new Map();
  board.games.forEach(g => {
    const k = g.kickoff instanceof Date && !isNaN(g.kickoff) ? g.kickoff.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'}) : 'Time to be set';
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(g);
  });
  return [...days].map(([day, gs]) => `<section class="pk-slot"><h2 class="pk-sl-h"><span class="ovl">${esc(day)}</span></h2><ul class="pk-list">`
    + gs.map(g => `<li class="pk-g is-${g.state}${v.locked || nfl.gameStarted(g, v.at) ? ' is-locked' : ''}" data-g="${esc(g.id)}"><div class="pk-g-main"><div class="pk-sides">${sideHTML(g, 'away', v)}${sideHTML(g, 'home', v)}</div><div class="pk-stat">${statHTML(g, v)}</div></div></li>`).join('')
    + `</ul></section>`).join('');
}
function poolHTML(d, P) {
  if (!P.rows.length) return `<section class="su-pool"><h2 class="pk-sl-h"><span class="ovl">The pool</span></h2><div class="card"><p class="lp-none">${d.before ? 'Nobody’s in yet: the first picks open with Week ' + SV.FIRST[d.year] + '.' : 'Nobody has picked yet.'}</p></div></section>`;
  const first = SV.FIRST[d.year];
  const rows = P.rows.map(r => {
    const cells = [];
    for (let w = first; w <= d.cur; w++) {
      const p = r.picks.find(x => x.w === w);
      if (!p) { cells.push(r.out === w && r.why === 'none' ? `<span class="su-c is-miss" title="Week ${w}: no pick">–</span>` : ''); continue; }
      if (!p.shown) { cells.push(`<span class="su-c is-hid" title="Week ${w}: ${p.l ? 'locked in' : 'picked'}">${ui.icon('lock')}</span>`); continue; }
      const t = teamOf(d.boards.get(w), p.k);
      cells.push(`<span class="su-c${p.res === 'W' || p.res === 'C' ? ' is-w' : p.res === 'L' || p.res === 'T' ? ' is-l' : ''}" title="Week ${w}: ${esc(t.short)}${p.res ? ' ' + resWord[p.res] : ''}">${logoHTML(t, 22)}</span>`);
    }
    const tag = r.alive ? `<span class="su-tag is-in">${r.key === P.champion ? 'Winner' : 'In'}</span>` : `<span class="su-tag is-out">Out W${r.out}</span>`;
    const label = `${r.name}${r.you ? ', you' : ''}: ${r.alive ? 'still in' : `out in week ${r.out}`}, ${plural(r.weeks, 'week')} survived`;
    return `<li class="su-r${r.you ? ' is-me' : ''}${r.alive ? '' : ' is-out'}" aria-label="${esc(label)}">${whoAvatar(r, 30)}`
      + `<span class="su-r-n"><span class="su-r-t">${esc(r.name)}${r.you ? ' <i class="lp-you">YOU</i>' : r.guest ? ' <i class="lp-you is-g">GUEST</i>' : ''}</span><span class="su-cells" aria-hidden="true">${cells.join('')}</span></span>${tag}</li>`;
  }).join('');
  return `<section class="su-pool"><h2 class="pk-sl-h"><span class="ovl">The pool</span><span class="pk-sl-r">${esc(`${P.alive} of ${P.entered} in`)}</span></h2><ol class="card su-rows">${rows}</ol></section>`;
}
function bodyHTML(st) {
  const d = memo.d;
  if (!d) return st && st.err ? ui.empty({icon: 'wifi-off', title: 'Can’t load the NFL’s games', body: 'Check your connection.', action: {label: 'Try again', kind: 'primary', attrs: {'data-su-retry': ''}}})
    : `<div class="skeleton" aria-hidden="true">${ui.skeleton('rows', 4)}</div>`;
  const at = week.now();
  const P = SV.pool(d.year, d.before ? (SV.FIRST[d.year] || d.cur) - 1 : d.cur, d.boards, null, at);
  const me = P.rows.find(r => r.you) || null;
  const board = d.before ? d.boards.get(SV.FIRST[d.year]) : d.boards.get(d.cur);
  const used = d.before ? new Map() : SV.usedBy(d.year, d.cur, d.boards);
  const first = SV.FIRST[d.year];
  const opt = st && st.opt && st.opt.w === d.cur ? st.opt : null;
  const saved = me ? me.pick : (d.cur === first ? SV.mine(d.year, d.cur) : null);
  const pick = opt ? opt.k : saved ? saved.k : null;
  const open = !d.before && !P.champion && (me ? me.alive : d.cur === first);
  const final = !!(saved && saved.l) || !!(st && st.fin === d.cur && pick); // (st.fin: locked in, the board not back yet)
  const v = {at, open, pick, used, locked: SV.locked(board, at), final, saved: !opt && !!saved};
  if (me && opt) me.pick = opt.k ? {k: opt.k} : null;
  return heroHTML(d, P, me, used, board, v)
    + (d.before ? `<h2 class="pk-sl-h su-pre"><span class="ovl">Week ${first}’s games</span><span class="pk-sl-r">Picks open soon</span></h2>` : '')
    + gamesHTML(board, v)
    + poolHTML(d, P)
    + `<p class="lp-rules">Each week, pick one NFL team to win its game: any team you haven’t picked before. A week’s picks open once the week before is over, and lock at its first kickoff (Thursday night): until then you can change yours. Lock in your pick to make it final early: once locked in, it can’t be changed. If your team loses or ties, or you haven’t picked by the lock, you’re out. If everyone still in loses the same week, they all stay in. Last one standing wins.</p>`;
}
const pageHTML = st => titleHTML(memo.d) + leagueTabsHTML('sv') + `<div class="pk-main su-main">${bodyHTML(st)}</div>`;

// ---------------------------------------------------------------------------------------------- behaviour
function patch(st) {
  if (!st || !st.el || !st.el.isConnected) return;
  const main = st.el.querySelector('.su-main');
  if (!main) return;
  const html = bodyHTML(st);
  if (main.dataset.html !== html) { main.dataset.html = html; main.innerHTML = html; ui.hydrate(main); }
  const lt = st.el.querySelector('.lt-eyebrow');
  if (lt) lt.textContent = eyebrow(memo.d);
}
function follow(st) {
  const d = memo.d;
  if (st.unwatch) { st.unwatch(); st.unwatch = null; }
  if (!d || d.before) return;
  // the week's games live: scores, finals and kickoffs as they happen
  st.unwatch = nfl.watch(d.year, d.cur, b => { if (b && b.games) { d.boards.set(d.cur, b); patch(st); } });
}
async function tapTeam(st, k) {
  const d = memo.d;
  if (!d || d.before) return;
  const board = d.boards.get(d.cur), used = SV.usedBy(d.year, d.cur, d.boards);
  const cur = (st.opt && st.opt.w === d.cur) ? st.opt.k : (SV.mine(d.year, d.cur) || {}).k;
  const next = cur === k ? null : k;
  st.opt = {w: d.cur, k: next};
  ui.haptic('selection');
  patch(st);
  const r = await SV.pick(d.year, d.cur, board, next, used);
  if (r !== 'ok') {
    st.opt = null;
    patch(st);
    const msg = {locked: 'Picks are locked: the week’s first game has kicked off.', final: 'Your pick is locked in for the week.', used: 'You’ve used that team already this season.', closed: 'Survivor isn’t open for picks right now.', off: 'Can’t save picks right now: the scoreboard isn’t connected.'}[r] || 'That pick didn’t save. Try again.';
    ui.toast(msg, {icon: 'x-circle'});
    return;
  }
  ui.announce(next ? `${teamOf(board, next).name}: your Week ${d.cur} pick.` : 'Pick taken back.');
}
async function lockIn(st) {
  const d = memo.d;
  if (!d || d.before || st.busy) return;
  const e = SV.mine(d.year, d.cur), board = d.boards.get(d.cur);
  if (!e || e.l) return;
  const name = teamOf(board, e.k).name;
  const v = await ui.actionSheet({
    title: `Lock in ${name}?`,
    message: `It’s your Week ${d.cur} pick for good: you can’t change it or take it back.`,
    actions: [{label: 'Lock in', value: 'lock', role: 'primary'}, {label: 'Not yet', value: null, role: 'cancel'}],
    returnFocus: () => (st.dead ? null : st.el.querySelector('.su-hero'))
  });
  if (v !== 'lock' || st.dead) return;
  st.busy = true;
  st.fin = d.cur;
  ui.haptic('success');
  patch(st);
  const r = await SV.lockIn(d.year, d.cur, board, SV.usedBy(d.year, d.cur, d.boards));
  st.busy = false;
  if (r !== 'ok' && r !== 'final') {
    st.fin = null;
    patch(st);
    const msg = {locked: 'Picks are locked: the week’s first game has kicked off.', off: 'Can’t save picks right now: the scoreboard isn’t connected.'}[r] || 'That didn’t save. Try again.';
    ui.toast(msg, {icon: 'x-circle'});
    return;
  }
  ui.announce(`${name} locked in for Week ${d.cur}.`);
}
function onClick(st, e) {
  const t = e.target.closest && e.target.closest('[data-pk-sport], [data-su-team], [data-su-retry], [data-su-lockin]');
  if (!t || !st.el.contains(t)) return;
  if (t.hasAttribute('data-pk-sport')) { if (t.dataset.pkSport !== 'sv') goLeague(t.dataset.pkSport); return; }
  if (t.hasAttribute('data-su-retry')) { st.err = null; patch(st); start(st, true); return; }
  if (t.hasAttribute('data-su-lockin')) { lockIn(st); return; }
  if (t.getAttribute('aria-disabled') === 'true') {
    const k = t.dataset.suTeam, d = memo.d, used = d ? SV.usedBy(d.year, d.cur, d.boards) : new Map();
    const fin = d && ((SV.mine(d.year, d.cur) || {}).l || st.fin === d.cur);
    if (used.has(k)) ui.toast(`You used ${k} in Week ${used.get(k)}.`, {icon: 'info'});
    else if (d && SV.locked(d.boards.get(d.cur), week.now())) ui.toast('Picks are locked: the week’s first game has kicked off.', {icon: 'lock'});
    else if (fin) ui.toast('Your pick is locked in for the week.', {icon: 'lock'});
    return;
  }
  tapTeam(st, t.dataset.suTeam);
}
function start(st, force) {
  load(force).then(() => { if (!st.dead) { st.err = null; patch(st); follow(st); } }, e => { if (!st.dead) { st.err = e; patch(st); } });
}

const VIEW = {
  id: 'pickem',
  title: () => "Pick'em",
  actions: () => [],
  render(ctx) { return pageHTML(screens.get(ctx) || null); },
  mount(el, ctx) {
    const st = {el, ctx, opt: null, fin: null, busy: false, err: null, dead: false, unwatch: null};
    screens.set(ctx, st);
    st.onClick = e => onClick(st, e);
    el.addEventListener('click', st.onClick);
    el.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && i.closest('.c-pk-logo')) i.closest('.c-pk-logo').classList.add('is-broken'); }, true);
    st.unsub = daily.subscribe(type => {
      if (type !== 'lb' && type !== 'ready') return;
      const d = memo.d, saved = d ? SV.mine(d.year, d.cur) : null;
      if (st.opt && ((saved && saved.k) || null) === (st.opt.k || null)) st.opt = null; // the board has it now
      if (st.fin && saved && saved.l) st.fin = null;
      patch(st);
    });
    // the first kickoff locks the week while you watch; the next week opens once this one is over
    st.untick = ctx.timer(() => { if (memo.d && Date.now() - memo.t > 10 * 60e3) start(st, true); else patch(st); }, 30000);
    daily.ensure().catch(() => {});
    const main = el.querySelector('.su-main');
    if (main) main.dataset.html = main.innerHTML;
    start(st, memo.d && Date.now() - memo.t > 60e3);
    if (ctx.first) ui.stagger(el);
  },
  onShow(ctx) { const st = screens.get(ctx); if (st) { if (memo.d && Date.now() - memo.t > 5 * 60e3) start(st, true); else patch(st); } },
  onHide() {},
  unmount(el, ctx) {
    const st = screens.get(ctx);
    if (!st) return;
    st.dead = true;
    el.removeEventListener('click', st.onClick);
    if (st.unsub) st.unsub();
    if (st.untick) st.untick();
    if (st.unwatch) st.unwatch();
    screens.delete(ctx);
  }
};
export default VIEW;
