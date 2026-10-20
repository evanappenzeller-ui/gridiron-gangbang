// League pick'em (the Pick'em tab's "League", the owner's ask, Oct 2026): pick the winner of each of the week's six
// fantasy matchups in the league. Shown in the Pick'em tab's screen by views/pickem.js's league switch (its default
// export is this screen's view: render, mount, unmount, onShow, onHide).
//   Large title (eyebrow "League · Week 7") · the switch · week chips (the League pick'em's weeks, when there's more
//   than one) · a summary card (when the picks lock, how many you've picked, how many have picked; then your week) ·
//   the six matchups: each manager a tap target with their team, record and rank, Yahoo's projection when the data
//   has one, then the final score; your pick ticked, then right or wrong; once locked, how it was picked and by whom ·
//   the leaderboard (This week / Season).
// A tap saves at once (core/lpick.js pick: the whole week on this phone's board doc); a tap on your pick takes it
// back. Picks lock at the week's first NFL kickoff (week.lockTime, Thursday 8:15 PM ET).
// Every row and every split is the board as this phone may see it (THE RULE, CLAUDE.md: core/lpick.js reads LB.raw).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as week from '../core/week.js';
import * as LP from '../core/lpick.js';
import {leagueTabsHTML, goLeague} from './pickem.js';
import {youButtonHTML} from './you.js';

const esc = data.esc;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtPts = n => (n == null ? '' : Number(n).toFixed(2));
const screens = new Map(); // ctx -> state

// ---------------------------------------------------------------------------------------------- the week shown
function weekOf(st) {
  const c = LP.current();
  const year = c ? c.year : (data.SEASONS.find(s => s.live) || data.SEASONS[0] || {}).year;
  const weeks = year ? LP.weeksOf(year) : [];
  let wk = st && st.week && weeks.includes(st.week) ? st.week : c ? c.week : weeks[weeks.length - 1];
  return {c, year, weeks, wk, isCur: !!c && c.year === year && c.week === wk};
}
const seasonOf = year => data.SEASONS.find(s => s.year === year) || null;
function rowOf(year, id) {
  const s = seasonOf(year), t = s && s.table ? s.table.find(r => r.id === id) : null;
  return t ? {seed: t.seed, rec: data.recStr(t.w, t.l, t.t)} : null;
}
// Yahoo's projected points for an unplayed matchup, when the data has them (league.json's schedule pa / pb).
function projOf(year, wk, a, b) {
  const raw = data.DATA && data.DATA.seasons ? data.DATA.seasons.find(s => s.year === year) : null;
  const g = raw && (raw.schedule || []).find(x => x.week === wk && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  if (!g || g.pa == null || g.pb == null) return null;
  return g.a === a ? {a: g.pa, b: g.pb} : {a: g.pb, b: g.pa};
}

// ---------------------------------------------------------------------------------------------- markup
const titleHTML = W => ui.largeTitle({eyebrow: W.wk ? `League · Week ${W.wk}` : 'League', title: "Pick'em", trailing: youButtonHTML()});
function chipsHTML(W) {
  if (W.weeks.length < 2) return '';
  const items = W.weeks.map(w => ({id: String(w), label: `Wk ${w}`}));
  return `<div class="accessory pk-acc">${ui.chips({name: 'lp-week', items, value: String(W.wk), label: 'Week'})}</div>`;
}
function whoAvatar(m, size = 24) {
  return m.managerId ? ui.avatar(m.managerId, {size, you: m.you}) : ui.nickAvatar(m.name, {size, you: m.you});
}
function sideHTML(W, g, side, v) {
  const id = g[side], o = side === 'a' ? g.b : g.a;
  const mine = v.mine[g.id], res = v.res[g.id];
  const won = res ? (res.winner == null ? null : res.winner === id) : null;
  const r = rowOf(W.year, id), s = seasonOf(W.year);
  const proj = v.proj[g.id], pts = res ? (side === 'a' ? res.sa : res.sb) : null;
  const open = v.open;
  const cls = `lp-t${mine === id ? ' is-on' : mine && open ? ' is-dim' : ''}${won === true ? ' is-win' : won === false ? ' is-lose' : ''}${open ? '' : ' is-locked'}`;
  const mark = mine === id
    ? (won === true ? `<span class="pk-mk is-right">${ui.icon('check')}</span>` : won === false ? `<span class="pk-mk is-wrong">${ui.icon('x')}</span>`
      : res ? `<span class="pk-mk is-push">${ui.icon('check')}</span>` : `<span class="pk-mk is-on">${ui.icon('check')}</span>`)
    : open ? '<span class="pk-mk is-open"></span>' : '';
  const sub = [r ? `#${r.seed} · ${r.rec}` : '', !res && proj ? `Proj ${fmtPts(proj[side])}` : ''].filter(Boolean).join(' · ');
  const label = `${data.name(id)}, ${data.teamIn(s, id)}${r ? `, ${r.rec}` : ''}${pts != null ? `, ${fmtPts(pts)} points` : ''}${mine === id ? ', your pick' : ''}${won === true ? ', won' : won === false ? ', lost' : ''}`;
  return `<button type="button" class="${cls}" data-lp-pair="${esc(g.id)}" data-lp-id="${esc(id)}" aria-pressed="${mine === id}"${open ? '' : ' aria-disabled="true"'} aria-label="${esc(label)}" data-vs="${esc(o)}">`
    + `<span class="lp-av">${ui.avatar(id, {size: 36})}</span>`
    + `<span class="lp-tn"><span class="lp-tm">${esc(data.teamIn(s, id))}</span><span class="lp-ts">${esc(data.name(id))}${sub ? ` · ${esc(sub)}` : ''}</span></span>`
    + `<span class="lp-sc n5">${pts != null ? esc(fmtPts(pts)) : ''}</span>`
    + `<span class="pk-mkw">${mark}</span></button>`;
}
function footHTML(W, g, v) {
  const sp = v.split ? v.split[g.id] : null;
  if (!sp) return `<div class="lp-foot"><span class="pk-f-in">${ui.icon(v.open ? 'person' : 'lock')}<span>${v.open ? 'Picks show when they lock' : 'Locked'}</span></span></div>`;
  const n = sp.a.length + sp.b.length;
  if (!n) return `<div class="lp-foot"><span class="pk-f-in">${ui.icon('lock')}<span>Nobody picked this one</span></span></div>`;
  const share = sp.a.length / n, mine = v.mine[g.id];
  const names = l => (l.length ? l.map(m => (m.you ? 'you' : m.name)).join(', ') : 'nobody');
  const label = `${data.name(g.a)}: ${names(sp.a)}. ${data.name(g.b)}: ${names(sp.b)}.`;
  return `<div class="lp-foot" role="img" aria-label="${esc(label)}">`
    + `<span class="pk-f-cs a">${ui.avatarStack(sp.a.map(m => ({nick: m.name, managerId: m.managerId, you: m.you})), {max: 3, size: 24})}</span>`
    + `<span class="pk-f-mid"><span class="pk-f-p n5${mine === g.a ? ' tint' : ''}">${Math.round(share * 100)}%</span>`
    + `<span class="c-pk-bar${mine === g.a ? ' is-a' : mine === g.b ? ' is-h' : ''}" aria-hidden="true"><i class="a" style="transform:scaleX(${share})"></i><i class="h" style="transform:scaleX(${1 - share})"></i></span>`
    + `<span class="pk-f-p n5${mine === g.b ? ' tint' : ''}">${Math.round((1 - share) * 100)}%</span></span>`
    + `<span class="pk-f-cs h">${ui.avatarStack(sp.b.map(m => ({nick: m.name, managerId: m.managerId, you: m.you})), {max: 3, size: 24})}</span></div>`;
}
function gameHTML(W, g, v) {
  const mine = v.mine[g.id], res = v.res[g.id];
  const right = mine && res && res.winner != null ? (res.winner === mine ? ' is-right' : ' is-wrong') : '';
  return `<li class="lp-g${right}" data-lp-g="${esc(g.id)}">${sideHTML(W, g, 'a', v)}${sideHTML(W, g, 'b', v)}${footHTML(W, g, v)}</li>`;
}
function summaryHTML(W, v) {
  const n = W.games.length, picked = W.games.filter(g => v.mine[g.id]).length;
  const me = v.rows.find(r => r.you);
  let head, line;
  if (v.open) {
    head = picked === n ? 'All picked' : picked ? `${picked} of ${n} picked` : 'Pick the winners';
    line = `Picks lock ${week.lockText(W.year, W.wk)} (the week's first kickoff). ${v.count.all ? `${plural(v.count.all, 'player')} picked every game.` : 'Nobody has picked them all yet.'}`;
  } else if (v.done) {
    head = me ? `You went ${me.right}–${me.wrong}${me.push ? `–${me.push}` : ''}` : 'Final';
    line = v.rows.length ? `Top of the week: ${v.rows.filter(r => r.rank === 1).map(r => (r.you ? 'you' : r.name)).join(', ')}, ${v.rows[0].right}–${v.rows[0].wrong}.` : 'Nobody picked this week.';
  } else {
    head = me ? (me.right || me.wrong ? `You're ${me.right}–${me.wrong} so far` : `${plural(picked, 'pick')} in`) : 'Locked';
    line = me ? 'Locked. Results land when the week’s finals are in.' : 'Locked. You didn’t get picks in this week.';
  }
  return `<section class="card lp-sum"><p class="ovl">${v.open ? 'Open' : v.done ? 'Final' : 'Locked'}</p><h2 class="lp-sum-h">${esc(head)}</h2><p class="lp-sum-l">${esc(line)}</p></section>`;
}
function boardHTML(W, v, mode) {
  const rows = mode === 'season' ? LP.seasonRows(W.year) : v.rows;
  const list = rows.length
    ? `<ol class="lp-rows">${rows.map(r => `<li class="lp-r${r.you ? ' is-me' : ''}"><span class="lp-r-k n5">${r.rank}</span>${whoAvatar(r, 30)}`
      + `<span class="lp-r-n"><span class="lp-r-t">${esc(r.name)}${r.you ? ' <i class="lp-you">YOU</i>' : r.guest ? ' <i class="lp-you is-g">GUEST</i>' : ''}</span>`
      + `<span class="lp-r-s">${esc([r.pending ? `${r.pending} to play` : '', mode === 'season' ? plural(r.weeks, 'week') : ''].filter(Boolean).join(' · '))}</span></span>`
      + `<span class="lp-r-v n3">${r.right}–${r.wrong}${r.push ? `–${r.push}` : ''}</span></li>`).join('')}</ol>`
    : `<p class="lp-none">${mode === 'season' ? 'No picks yet this season.' : v.open ? 'Picks show here once the week locks.' : 'Nobody picked this week.'}</p>`;
  const tog = ui.seg({name: 'lp-board', items: [{id: 'week', label: 'This week'}, {id: 'season', label: 'Season'}], value: mode, small: true, label: 'Leaderboard'});
  return `<section class="lp-board"><h2 class="pk-sl-h"><span class="ovl">Leaderboard</span></h2>${tog}<div class="card lp-board-c">${list}</div></section>`;
}
function vm(W, st) {
  const at = week.now(), locked = week.isLocked(W.year, W.wk, at);
  const games = W.games;
  const mine = Object.assign({}, LP.mine(W.year, W.wk), st ? st.opt : {});
  Object.keys(mine).forEach(k => { if (!mine[k]) delete mine[k]; });
  const res = {}, proj = {};
  games.forEach(g => { const r = LP.resultOf(W.year, W.wk, g.a, g.b); if (r) res[g.id] = r; const p = projOf(W.year, W.wk, g.a, g.b); if (p) proj[g.id] = p; });
  const split = locked ? Object.fromEntries(games.map(g => [g.id, LP.splitOf(W.year, W.wk, g, null, at)])) : null;
  const rows = locked ? LP.weekRows(W.year, W.wk) : [];
  return {mine, res, proj, split, rows, open: W.isCur && !locked, done: games.length > 0 && games.every(g => res[g.id]), count: LP.countIn(W.year, W.wk)};
}
function bodyHTML(st) {
  const W = Object.assign(weekOf(st), {});
  if (!W.wk) return ui.empty({icon: 'football', title: 'No League pick’em this week', body: 'It runs on the league’s weekly matchups, from Week 7.'});
  W.games = LP.gamesOf(W.year, W.wk);
  if (!W.games.length) return ui.empty({icon: 'football', title: 'No matchups this week', body: 'The league’s schedule has no games this week.'});
  const v = vm(W, st);
  return summaryHTML(W, v)
    + `<section class="pk-slot"><h2 class="pk-sl-h"><span class="ovl">Week ${W.wk} matchups</span><span class="pk-sl-r">${esc(v.open ? `Locks ${week.lockText(W.year, W.wk)}` : v.done ? 'Final' : 'Locked')}</span></h2>`
    + `<ul class="lp-list">${W.games.map(g => gameHTML(W, g, v)).join('')}</ul></section>`
    + boardHTML(W, v, st ? st.mode : 'week')
    + `<p class="lp-rules">Pick who wins each of the league’s matchups. Picks lock at the week’s first NFL kickoff, Thursday night; you can change them until then. A tie is a push.</p>`;
}
const pageHTML = st => { const W = weekOf(st); return titleHTML(W) + leagueTabsHTML('lg') + chipsHTML(W) + `<div class="pk-main lp-main">${bodyHTML(st)}</div>`; };

// ---------------------------------------------------------------------------------------------- behaviour
function patch(st) {
  if (!st || !st.el || !st.el.isConnected) return;
  const main = st.el.querySelector('.lp-main');
  if (!main) return;
  const html = bodyHTML(st);
  if (main.dataset.html === html) return;
  main.dataset.html = html;
  main.innerHTML = html;
  ui.hydrate(main);
  const W = weekOf(st), lt = st.el.querySelector('.lt-eyebrow');
  if (lt) lt.textContent = W.wk ? `League · Week ${W.wk}` : 'League';
}
async function tapPick(st, pair, id) {
  const W = weekOf(st);
  if (!W.isCur) return;
  if (week.isLocked(W.year, W.wk)) { ui.toast('Picks are locked for this week.', {icon: 'lock'}); patch(st); return; }
  const now = Object.assign({}, LP.mine(W.year, W.wk), st.opt)[pair];
  const next = now === id ? null : id;
  st.opt[pair] = next;
  ui.haptic('selection');
  patch(st);
  const r = await LP.pick(W.year, W.wk, pair, next);
  if (r !== 'ok') {
    delete st.opt[pair];
    patch(st);
    ui.toast(r === 'locked' ? 'Picks are locked for this week.' : r === 'off' ? 'Can’t save picks right now: the scoreboard isn’t connected.' : 'That pick didn’t save. Try again.', {icon: 'x-circle'});
    return;
  }
  ui.announce(next ? `${data.name(next)} picked.` : 'Pick taken back.');
}
function onClick(st, e) {
  const t = e.target.closest && e.target.closest('[data-pk-sport], [data-lp-pair]');
  if (!t || !st.el.contains(t)) return;
  if (t.hasAttribute('data-pk-sport')) { if (t.dataset.pkSport !== 'lg') goLeague(t.dataset.pkSport); return; }
  if (t.getAttribute('aria-disabled') === 'true') return;
  tapPick(st, t.dataset.lpPair, t.dataset.lpId);
}

const VIEW = {
  id: 'pickem',
  title: () => "Pick'em",
  actions: () => [],
  render(ctx) { return pageHTML(screens.get(ctx) || {mode: 'week', opt: {}}); },
  mount(el, ctx) {
    const st = {el, ctx, mode: 'week', week: null, opt: {}};
    screens.set(ctx, st);
    st.onClick = e => onClick(st, e);
    el.addEventListener('click', st.onClick);
    st.onChange = e => {
      const d = e.detail || {};
      if (d.name === 'lp-board') { st.mode = d.value === 'season' ? 'season' : 'week'; patch(st); }
      if (d.name === 'lp-week') { st.week = Number(d.value) || null; st.opt = {}; patch(st); }
    };
    el.addEventListener('ui:change', st.onChange);
    st.unsub = daily.subscribe(type => {
      if (type !== 'lb' && type !== 'ready') return;
      // a pick the board now has drops its stand-in
      const W = weekOf(st), saved = LP.mine(W.year, W.wk);
      Object.keys(st.opt).forEach(k => { if ((saved[k] || null) === (st.opt[k] || null)) delete st.opt[k]; });
      patch(st);
    });
    st.unsubData = data.subscribe(() => patch(st));
    st.untick = ctx.timer(() => patch(st), 30000); // the lock comes while you watch
    daily.ensure().catch(() => {});
    const main = el.querySelector('.lp-main');
    if (main) main.dataset.html = main.innerHTML;
    if (ctx.first) ui.stagger(el);
  },
  onShow(ctx) { patch(screens.get(ctx)); },
  onHide() {},
  unmount(el, ctx) {
    const st = screens.get(ctx);
    if (!st) return;
    el.removeEventListener('click', st.onClick);
    el.removeEventListener('ui:change', st.onChange);
    if (st.unsub) st.unsub();
    if (st.unsubData) st.unsubData();
    if (st.untick) st.untick();
    screens.delete(ctx);
  }
};
export default VIEW;
