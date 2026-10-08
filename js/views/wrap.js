// The Wrap (#/standings/:year/wrap/:week): an auto-written recap of one completed week (week-features contract).
// Pushed on any tab. Owner: WRAP + SHAME UI.
//   Large title "Week 3" (eyebrow THE WRAP · 2026) · sticky week chips (completed weeks) · lede card with the
//   headline · recap cards (stats.wrap items; score bugs open the matchup sheet) · the week's Matchup of the Week
//   result and the NFL pick'em's best record that week (week.js, filled in when Firestore and ESPN answer; never
//   blocks) · "The presser" (the week's Press Room video, playable in place; core/press.js + views/press.js, loaded
//   at idle, hidden when the week has none or on a failure) · power rankings top 5 with movement · Share button +
//   previous/next week.
// Data: stats.wrap(year, week), stats.wrapWeeks(year), stats.powerRankings(year, week) (sync, js/core/stats.js);
//   week.history() / week.nflWeekResults(year, week) (async, js/core/week.js, imported lazily so the recap never waits
//   on it).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as stats from '../core/stats.js';
import {openMatchup, seedsOf} from './matchup.js';

const esc = data.esc;
const ST = new WeakMap();
const FIRST_VOTE_YEAR = 2026; // votes and picks exist from the 2026 season on
const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
const f2 = v => data.fmt(v);

// ------------------------------------------------------------------ Model
function weeksOf(y) {
  let list = [];
  try { list = stats.wrapWeeks(y) || []; } catch (e) { console.error(e); }
  return list.map(w => (w && typeof w === 'object') ? +w.week : +w).filter(w => isFinite(w) && w > 0).sort((a, b) => a - b);
}

function gamesOf(y, w) {
  return data.GAMES.filter(g => g.year === y && g.week === w);
}

// Resolve an item's game: a GAMES entry, an index into GAMES, or {year, week, a, b}.
function gameOf(x, y, w) {
  if (x == null) return null;
  if (typeof x === 'number') return data.GAMES[x] || null;
  if (typeof x === 'object' && x.a && x.b) {
    const yy = x.year != null ? x.year : y, ww = x.week != null ? x.week : w;
    return data.GAMES.find(g => g.year === yy && g.week === ww && ((g.a === x.a && g.b === x.b) || (g.a === x.b && g.b === x.a))) || (x.sa != null ? x : null);
  }
  return null;
}

// stats.wrap item kinds -> overline icon and tone (the overline text is the item's own title: "High score", ...).
const KINDS = {
  high: {icon: 'flame', tone: 'flame'},
  low: {icon: 'anchor', tone: 'wrong'},
  blowout: {icon: 'bolt'},
  nail: {icon: 'pulse'},
  upset: {icon: 'sparkle'},
  streak: {icon: 'flame', tone: 'flame'},
  snap: {icon: 'x-circle', tone: 'wrong'},
  leader: {icon: 'chart'},
  riser: {icon: 'arrow-up'},
  faller: {icon: 'arrow-down', tone: 'wrong'},
  playoff: {icon: 'trophy'}
};
const kindOf = (k, it) => {
  const K = KINDS[k] || {icon: 'football'};
  if (k === 'playoff' && it.game && it.game.type === 'final') return {icon: 'crown', tone: 'gold'};
  if (k === 'streak' && /los/i.test(it.title)) return {icon: 'arrow-down', tone: 'wrong'};
  return K;
};

// render() and mount() both need the model: keep the last one until the week or the league data changes.
let memo = null;
function model(y, w) {
  if (memo && memo.y === y && memo.w === w && memo.games === data.GAMES) return memo.m;
  const m = buildModel(y, w);
  memo = {y, w, games: data.GAMES, m};
  return m;
}

function buildModel(y, w) {
  const s = data.seasonByYear(y);
  if (!s) return {state: 'noseason', y, w};
  const weeks = weeksOf(y);
  if (!weeks.includes(w)) return {state: 'noweek', y, w, weeks, s};
  let r = null;
  try { r = stats.wrap(y, w); } catch (e) { console.error(e); }
  if (!r) return {state: 'noweek', y, w, weeks, s};
  const items = (r.items || []).map(it => ({
    kind: String(it.kind || ''), title: it.title ? String(it.title) : '', body: it.body ? String(it.body) : '',
    ids: (it.ids || []).filter(id => data.M[id]), game: gameOf(it.game, y, w)
  })).filter(it => it.title || it.body);
  // Power rankings are a regular-season thing: none for playoff weeks.
  let power = [];
  if (!r.playoff) {
    try { power = (stats.powerRankings(y, w) || []).slice().sort((a, b) => a.rank - b.rank); } catch (e) { console.error(e); }
  }
  return {state: 'ok', y, w, s, weeks, headline: r.headline ? String(r.headline) : '', dek: r.dek ? String(r.dek) : '',
    label: r.label ? String(r.label) : `Week ${w}`, playoff: !!r.playoff, items, share: r.share ? String(r.share) : '', power, games: gamesOf(y, w)};
}

// ------------------------------------------------------------------ Markup
// Same chip labels as the season page's Weeks rail ("W3", "QF", "SF", "Final").
const wkLabel = w => w === 15 ? 'QF' : w === 16 ? 'SF' : w === 17 ? 'Final' : `W${w}`;

// Playoff weeks carry their round as the subtitle ("Championship week").
function titleBlock(y, w, m) {
  return ui.largeTitle({eyebrow: `The Wrap · ${y}`, title: `Week ${w}`, subtitle: m && m.playoff && m.label ? m.label : undefined});
}

function chipsBlock(m) {
  if (!m.weeks || m.weeks.length < 2) return '';
  return `<div class="accessory wr-acc">${ui.chips({name: 'wrap-week', items: m.weeks.map(x => ({id: String(x), label: wkLabel(x)})), value: String(m.w), label: 'Week'})}</div>`;
}

function lede(m) {
  const G = m.games.filter(g => g.type !== 'consol');
  const all = G.flatMap(g => [g.sa, g.sb]);
  const total = all.reduce((a, b) => a + b, 0);
  const avg = all.length ? total / all.length : 0;
  const ovl = m.playoff ? `${m.label} · Final` : `Week ${m.w} · Final`;
  const facts = [plural(G.length, 'game'), `${Number(total).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, `${f2(avg)} a team`];
  // The wash takes the color of the week's star: the first recap item's manager, else the top scorer.
  let star = (m.items[0] && m.items[0].ids[0]) || null;
  if (!star && G.length) { const top = G.flatMap(g => [[g.a, g.sa], [g.b, g.sb]]).sort((x, y) => y[1] - x[1])[0]; star = top[0]; }
  return `<div class="card card-hero wr-lede${star ? ' ' + data.color(star).cls : ''}" data-enter>`
    + `<p class="ovl wr-lede-ovl">${esc(ovl)}</p>`
    + (m.headline ? `<h2 class="wr-headline">${esc(m.headline)}</h2>` : '')
    + (m.dek ? `<p class="wr-dek">${esc(m.dek)}</p>` : '')
    + `<p class="t-foot wr-facts">${esc(facts.join(' · '))}</p>`
    + `</div>`;
}

function whoLinks(ids, m) {
  if (!ids.length) return '';
  return `<div class="wr-who">${ids.slice(0, 4).map(id => `<a class="wr-who-a" href="#/managers/${encodeURIComponent(id)}">${ui.avatar(id, {size: 28, you: id === data.me(), attrs: {'data-morph-from': ''}})}<span class="wr-who-t"><b>${esc(data.name(id))}</b><span>${esc(data.teamIn(m.s, id))}</span></span></a>`).join('')}</div>`;
}

// One recap item: overline (the item's title with its kind's icon), the story, then its game (a score bug that opens
// the matchup sheet) or, for items without one (points leader, a list of streaks), the managers it names.
function itemCard(it, i, m) {
  const k = kindOf(it.kind, it);
  const g = it.game;
  const lead = it.ids[0] || (g && !g.tie ? g.win : null);
  const bug = g ? ui.scoreBug(g, {teams: true, seeds: g.reg ? null : seedsOf(m.s), attrs: {'data-game': String(i), 'aria-haspopup': 'dialog'}, cls: 'wr-bug'}) : '';
  const hid = `wr-i-${i}`;
  return `<article class="wr-card${lead ? ' ' + data.color(lead).cls : ''}" data-enter data-kind="${esc(it.kind)}" aria-labelledby="${hid}">`
    + `<h3 class="wr-ovl${k.tone ? ' is-' + k.tone : ''}" id="${hid}">${ui.icon(k.icon, {size: 14})}<span>${esc(it.title || 'Also')}</span></h3>`
    + (it.body ? `<p class="wr-story">${esc(it.body)}</p>` : '')
    + (bug ? `<div class="wr-bugbox">${bug}</div>` : whoLinks(it.ids, m))
    + `</article>`;
}

function moveHTML(r) {
  const mv = r.prev == null ? null : (r.move != null ? r.move : r.prev - r.rank);
  if (mv == null) return `<span class="wr-mv" aria-label="First ranking">–</span>`; // week 1: nothing to move from
  if (!mv) return `<span class="wr-mv" aria-label="No change">–</span>`;
  return mv > 0
    ? `<span class="wr-mv is-up" aria-label="Up ${mv}">▲${mv}</span>`
    : `<span class="wr-mv is-down" aria-label="Down ${-mv}">▼${-mv}</span>`;
}

const PR_TOP = 5;
// The week's power rankings: the top 5, with every team one tap away in place ("Show all 12"). The Standings
// tab only ever shows the current week, so linking there would lose the week this Wrap is about.
function powerBlock(m) {
  const all = m.power;
  if (!all.length) return '';
  const me = data.me();
  const rows = all.map((r, i) => {
    const rec = data.recStr(r.w || 0, r.l || 0, r.t || 0);
    return ui.row({
      lead: `<span class="n4 wr-rank${r.rank === 1 ? ' gold' : r.rank === 2 ? ' wr-r2' : r.rank === 3 ? ' wr-r3' : ''}">${r.rank}</span>${ui.avatar(r.id, {size: 32, you: r.id === me})}`,
      title: ui.raw(`${esc(data.name(r.id))} <span class="wr-rec">${esc(rec)}</span>`),
      sub: r.reason || data.teamIn(m.s, r.id),
      trail: moveHTML(r),
      chevron: true, me: r.id === me, key: 'pr-' + r.id, cls: 'wr-pr' + (i >= PR_TOP ? ' is-more' : ''),
      attrs: {'data-nav': '/managers/' + r.id}
    });
  }).join('');
  const more = all.length > PR_TOP
    ? `<div class="wr-more">${ui.button({label: `Show all ${all.length}`, kind: 'plain', size: 's', attrs: {'data-pr-more': '', 'aria-expanded': 'false', 'aria-controls': 'wr-prg'}})}</div>`
    : '';
  return `<section class="wr-sec wr-prs" data-enter aria-labelledby="wr-pr-h">`
    + ui.sectionHeader({title: 'Power rankings', id: 'wr-pr-h'})
    + ui.group(rows, {cls: 'wr-prg', attrs: {id: 'wr-prg'}})
    + more
    + `</section>`;
}
function togglePower(el) {
  const sec = el.querySelector('.wr-prs');
  const b = sec && sec.querySelector('[data-pr-more]');
  if (!b) return;
  const on = !sec.classList.contains('is-all');
  sec.classList.toggle('is-all', on);
  b.setAttribute('aria-expanded', String(on));
  const lab = b.querySelector('.btn-label');
  if (lab) lab.textContent = on ? 'Show fewer' : `Show all ${sec.querySelectorAll('.wr-pr').length}`;
  ui.haptic('selection');
  if (on && !ui.RM) sec.querySelectorAll('.wr-pr.is-more').forEach(x => ui.animate(x, [{opacity: 0, transform: 'translateY(-6px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: 'ease-out'}));
}

function footer(m) {
  const i = m.weeks.indexOf(m.w);
  const prev = i > 0 ? m.weeks[i - 1] : null, next = i >= 0 && i < m.weeks.length - 1 ? m.weeks[i + 1] : null;
  const nav = (prev || next)
    ? `<div class="wr-pn">`
      + (prev ? ui.button({label: `Week ${prev}`, kind: 'secondary', size: 's', icon: 'chevron-left', attrs: {'data-week': String(prev), 'aria-label': `Previous: week ${prev}`}, cls: 'wr-prev'}) : '<span></span>')
      + (next ? ui.button({label: `Week ${next}`, kind: 'secondary', size: 's', icon: 'chevron-right', attrs: {'data-week': String(next), 'aria-label': `Next: week ${next}`}, cls: 'wr-next'}) : '<span></span>')
      + `</div>`
    : '';
  return `<div class="wr-foot">${ui.button({label: 'Share the Wrap', kind: 'primary', icon: 'share', attrs: {'data-share': ''}})}`
    + `${nav}</div>`;
}

function bodyHTML(m) {
  if (m.state === 'noseason') {
    const sp = data.span;
    return ui.empty({icon: 'calendar', title: `No ${m.y} season.`, body: sp.first != null ? `The league's history runs ${sp.first}–${sp.last}.` : '', action: {label: 'Back', attrs: 'data-back'}});
  }
  if (m.state === 'noweek') {
    const last = m.weeks && m.weeks.length ? m.weeks[m.weeks.length - 1] : null;
    return ui.empty({icon: 'clock', title: `No Wrap for week ${m.w}.`,
      body: last ? `The Wrap is written once a week is final. The latest is week ${last}.` : 'The Wrap is written once a week is final.',
      action: last ? {label: `Read week ${last}`, attrs: {'data-week': String(last)}} : {label: 'Back', attrs: 'data-back'}});
  }
  return lede(m)
    + `<div class="wr-list">${m.items.map((it, i) => itemCard(it, i, m)).join('')}</div>`
    + `<div class="wr-extra" data-extra aria-live="polite"></div>`
    + powerBlock(m)
    + footer(m);
}

function renderAll(ctx) {
  const y = Number(ctx.params.year), w = Number(ctx.params.week);
  const m = model(y, w);
  return {m, html: titleBlock(y, w, m) + chipsBlock(m) + `<div class="wr-main">${bodyHTML(m)}</div>`};
}

// ------------------------------------------------------------------ Week features (MOTW result, pick'em winners)
let weekP = null;
const loadWeek = () => weekP || (weekP = import('../core/week.js').catch(e => { weekP = null; throw e; }));

// history(year) entry: {year, week, key, pick, a, b, votes (for the pick), total, tally, voters, mine, result}.
function motwCard(e, m) {
  if (!e || !e.pick) return '';
  const [a, b] = e.a && e.b ? [e.a, e.b] : String(e.pick).split('|');
  if (!data.M[a] || !data.M[b]) return '';
  const g = gameOf({a, b}, m.y, m.w) || null;
  const votes = +e.votes || 0, total = +e.total || 0;
  const res = e.result || (g ? {a: g.a, b: g.b, sa: g.sa, sb: g.sb, winner: g.tie ? null : g.win} : null);
  let body = `The league picked ${data.name(a)} vs ${data.name(b)}` + (total ? `, ${votes} of ${plural(total, 'vote')}.` : '.');
  if (res && res.winner && data.M[res.winner]) {
    const ws = Math.max(res.sa, res.sb), ls = Math.min(res.sa, res.sb);
    const loser = res.winner === res.a ? res.b : res.a;
    body += ` ${data.name(res.winner)} beat ${data.name(loser)} ${f2(ws)} to ${f2(ls)}.`;
  } else if (res && res.sa === res.sb && res.sa != null) body += ' It ended in a tie.';
  const idx = g ? data.GAMES.indexOf(g) : -1;
  const bug = g ? ui.scoreBug(g, {teams: true, attrs: {'data-gidx': String(idx), 'aria-haspopup': 'dialog'}, cls: 'wr-bug'}) : '';
  const lead = res && res.winner ? res.winner : a;
  return `<article class="wr-card is-motw ${data.color(lead).cls}">`
    + `<h3 class="wr-ovl">${ui.icon('versus', {size: 14})}<span>Matchup of the Week</span></h3>`
    + `<p class="wr-story">${esc(body)}</p>`
    + (bug ? `<div class="wr-bugbox">${bug}</div>` : '')
    + `</article>`;
}

// The week's NFL pick'em (the real NFL games of the same week): week.nflWeekResults(year, week) ->
// [{who: {uid, me, nick, name}, me, nick, name, you, right, wrong, decided, picked, rank}], ranked by right, plus
// .decidedGames and .error. Hidden when nobody's pick counted (or the games didn't load).
function pickemCard(r, m) {
  if (!Array.isArray(r)) return '';
  const rows = r.filter(x => x && (+x.decided > 0 || +x.right > 0));
  if (!rows.length) return '';
  const nameOf = x => (x.me && data.M[x.me]) ? data.name(x.me) : (String(x.name || x.nick || '').trim() || 'Someone');
  const rec = x => `${+x.right || 0}–${+x.wrong || 0}`;
  // The best record: most right, then fewest wrong (rows arrive ranked by right).
  const sorted = rows.slice().sort((x, y) => (+y.right || 0) - (+x.right || 0) || (+x.wrong || 0) - (+y.wrong || 0));
  const top = sorted[0];
  const best = sorted.filter(x => +x.right === +top.right && +x.wrong === +top.wrong);
  const names = best.map(nameOf);
  const list = names.length > 3 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} others` : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const perfect = +top.wrong === 0 && +top.right >= 3;
  let body = +top.right > 0
    ? `${list} went ${rec(top)} on the NFL slate${perfect ? ', a perfect week' : ''}.`
    : 'Nobody called a single NFL winner this week.';
  body += ` ${plural(rows.length, 'player')}.`;
  if (+top.right > 0 && +top.decided >= 6 && +top.right / +top.decided < .6) body += ' A rough week for everyone.';
  const rowsHtml = sorted.slice(0, 5).map((x, i) => {
    const mid = x.me && data.M[x.me] ? x.me : undefined;
    const rk = i && +x.right === +sorted[i - 1].right && +x.wrong === +sorted[i - 1].wrong ? '' : String(i + 1);
    return `<li class="wr-pk${x.you ? ' is-me' : ''}"><span class="n5 wr-pk-r">${esc(rk)}</span>${ui.nickAvatar(nameOf(x), {size: 28, managerId: mid, you: !!x.you})}`
      + `<span class="wr-pk-n">${esc(nameOf(x))}</span><span class="n4 wr-pk-s" aria-label="${esc(`${+x.right || 0} right, ${+x.wrong || 0} wrong`)}">${esc(rec(x))}</span></li>`;
  }).join('');
  return `<article class="wr-card is-pickem">`
    + `<h3 class="wr-ovl">${ui.icon('football', {size: 14})}<span>NFL Pick'em</span></h3>`
    + `<p class="wr-story">${esc(body)}</p>`
    + `<ol class="wr-pks">${rowsHtml}</ol>`
    + `<a class="wr-pk-go" href="#/pickem?week=${encodeURIComponent(m.w)}">${esc(`Week ${m.w} games and picks`)}${ui.icon('chevron-right', {size: 16})}</a></article>`;
}

function extras(st, ctx) {
  const {y, w} = st;
  if (y < FIRST_VOTE_YEAR) return;
  const token = st.token;
  const slot = () => (st.token === token && st.el.isConnected) ? st.el.querySelector('[data-extra]') : null;
  const put = (kind, html) => {
    const box = slot();
    if (!box || !html) return;
    const old = box.querySelector(`[data-x="${kind}"]`);
    const node = document.createElement('div');
    node.dataset.x = kind;
    node.innerHTML = html;
    if (old) old.replaceWith(node);
    else if (kind === 'motw') box.prepend(node); else box.append(node);
    ui.hydrate(node);
    if (!ui.RM && ctx.visible) ui.animate(node, [{opacity: 0}, {opacity: 1}], {duration: 240});
  };
  loadWeek().then(wk => {
    if (!slot()) return;
    if (typeof wk.history === 'function') {
      Promise.resolve(wk.history(y)).then(list => {
        const e = (list || []).find(x => x && +x.year === y && +x.week === w);
        const m = st.m;
        if (e && m && m.state === 'ok') put('motw', motwCard(e, m));
      }).catch(err => console.warn('wrap: MOTW history unavailable', err));
    }
    if (typeof wk.nflWeekResults === 'function') {
      Promise.resolve(wk.nflWeekResults(y, w)).then(r => { const m = st.m; if (m && m.state === 'ok') put('pickem', pickemCard(r, m)); })
        .catch(err => console.warn('wrap: NFL pick\'em results unavailable', err));
    }
  }).catch(err => console.warn('wrap: week.js unavailable', err));
}

// ------------------------------------------------------------------ The presser (the Press Room)
// The week's press conference from core/press.js's live list (subscribed at idle while the Wrap is mounted), drawn
// with views/press.js's tile; it sits right after the Matchup of the Week card in the extras (at their top until that
// arrives). Players stop when the Wrap is hidden or the week changes.
let pressP = null;
const loadPress = () => pressP || (pressP = Promise.all([import('../core/press.js'), import('./press.js')]).catch(e => { pressP = null; throw e; }));

function presserCard(p, pv) {
  return `<article class="wr-card is-press ${data.color(p.who).cls}">`
    + `<h3 class="wr-ovl">${ui.icon('mic', {size: 14})}<span>The presser</span></h3>`
    + `<div class="wr-press">${pv.tileHTML(p, {size: 'm'})}</div>`
    + `<a class="wr-pk-go" href="#/press">All press conferences${ui.icon('chevron-right', {size: 16})}</a></article>`;
}
function putPress(st, ctx) {
  if (!st.pv || !st.el.isConnected) return;
  const box = st.el.querySelector('[data-extra]');
  if (!box) return;
  const m = st.m;
  const list = st.press && Array.isArray(st.press.list) ? st.press.list : [];
  const p = m && m.state === 'ok' ? list.find(x => x && +x.year === st.y && +x.week === st.w) : null;
  let html = '';
  try { html = p ? presserCard(p, st.pv) : ''; } catch (e) { console.error(e); html = ''; }
  const old = box.querySelector('[data-x="press"]');
  if (old && old._html === html) return;
  if (!html) { if (old) old.remove(); return; }
  const node = document.createElement('div');
  node.dataset.x = 'press';
  node.innerHTML = html;
  node._html = html;
  if (old) old.replaceWith(node);
  else { const mo = box.querySelector('[data-x="motw"]'); if (mo) mo.after(node); else box.prepend(node); }
  ui.hydrate(node);
  if (!old && !ui.RM && ctx.visible) ui.animate(node, [{opacity: 0}, {opacity: 1}], {duration: 240});
}
function pressStart(st, ctx) {
  if (st.pressWant) return;
  st.pressWant = true;
  loadPress().then(([pr, pv]) => {
    if (ST.get(ctx) !== st || !st.pressWant) return;
    st.pv = pv;
    try { const b = pv.bindPlayers(st.el); st.pressStop = typeof b === 'function' ? b : b && typeof b.stop === 'function' ? () => b.stop() : null; } catch (e) { console.error(e); }
    try {
      st.pressUnsub = pr.subscribePressers(u => {
        if (ST.get(ctx) !== st || !u) return;
        st.press = u;
        if (st.idleP) st.idleP();
        st.idleP = ui.whenIdle(() => { st.idleP = null; if (ST.get(ctx) === st) putPress(st, ctx); });
      });
    } catch (e) { console.error(e); }
  }, e => { console.warn('wrap: Press Room unavailable', e); st.pressWant = false; });
}
function pressPause(st) {
  if (st && st.pressStop) { try { st.pressStop(); } catch (_) {} }
}

// ------------------------------------------------------------------ Share
function shareText(m) {
  const link = ui.absLink(`/standings/${m.y}/wrap/${m.w}`);
  let t = m.share || [`The Wrap, week ${m.w}${m.headline ? ': ' + m.headline : ''}`, ...m.items.slice(0, 4).map(it => it.title)].filter(Boolean).join('\n');
  if (!/https?:\/\//.test(t)) t += '\n' + link;
  return t;
}
function doShare(st) {
  const m = st.m;
  if (!m || m.state !== 'ok') return;
  // ui.share runs synchronously inside the tap (iOS user activation).
  ui.share({text: shareText(m)}).then(r => {
    if (r === 'copied') { ui.haptic('success'); ui.toast('Wrap copied. Paste it in the league chat.', {icon: 'check-circle'}); }
    else if (r === 'unavailable') ui.toast("Couldn't share the Wrap.");
  });
}

// ------------------------------------------------------------------ View
export default {
  id: 'wrap',
  title: ctx => (ctx.params && ctx.params.week != null ? `Week ${ctx.params.week} wrap` : 'The Wrap'),
  actions: ctx => {
    const st = ST.get(ctx);
    return st && st.m && st.m.state === 'ok' ? [{id: 'share', icon: 'share', label: 'Share the Wrap'}] : [];
  },

  render(ctx) {
    return renderAll(ctx).html;
  },

  mount(el, ctx) {
    const y = Number(ctx.params.year), w = Number(ctx.params.week);
    const st = {el, y, w, m: model(y, w), token: 1};
    ST.set(ctx, st);
    el.addEventListener('click', e => {
      const t = e.target;
      if (!t || !t.closest) return;
      const cur = ST.get(ctx);
      if (!cur) return;
      const gb = t.closest('[data-game]');
      if (gb && cur.m && cur.m.items) {
        const it = cur.m.items[+gb.dataset.game];
        if (it && it.game) { ui.haptic('light'); openMatchup(it.game, ctx); }
        return;
      }
      const gi = t.closest('[data-gidx]');
      if (gi) {
        const g = data.GAMES[+gi.dataset.gidx];
        if (g) { ui.haptic('light'); openMatchup(g, ctx); }
        return;
      }
      if (t.closest('[data-share]')) { doShare(cur); return; }
      if (t.closest('[data-pr-more]')) { togglePower(el); return; }
      const wb = t.closest('[data-week]');
      if (wb) { ctx.replace(`/standings/${cur.y}/wrap/${wb.dataset.week}`); return; }
    });
    el.addEventListener('ui:change', e => {
      if (!e.detail || e.detail.name !== 'wrap-week') return;
      const cur = ST.get(ctx);
      if (cur) ctx.replace(`/standings/${cur.y}/wrap/${e.detail.value}`);
    });
    if (ctx.first) ui.stagger(el);
    ui.onIdle(() => { if (ST.get(ctx) === st) extras(st, ctx); });
    ui.onIdle(() => { if (ST.get(ctx) === st) pressStart(st, ctx); });
  },

  update(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    const y = Number(ctx.params.year), w = Number(ctx.params.week);
    const weekChanged = y !== st.y || w !== st.w;
    if (ctx.reason === 'me' && !weekChanged) {
      // Only the you-rings and your row change: rebuild the body quietly in place.
      const main = st.el.querySelector('.wr-main');
      const extra = main && main.querySelector('[data-extra]');
      const keep = extra ? [...extra.childNodes] : [];
      if (main) { main.innerHTML = bodyHTML(st.m); const nx = main.querySelector('[data-extra]'); if (nx) nx.append(...keep); }
      return;
    }
    if (weekChanged) pressPause(st);
    st.y = y; st.w = w; st.token++;
    const {m} = renderAll(ctx);
    st.m = m;
    const sc = ctx.screen;
    // The title and chips are patched; the content below them cross-fades (spec 5.2: segment or chip change).
    const lt = st.el.querySelector('.lt');
    if (lt) { const tmp = document.createElement('div'); tmp.innerHTML = titleBlock(y, w, m); lt.replaceWith(tmp.firstElementChild); }
    const acc = st.el.querySelector('.wr-acc');
    const accHTML = chipsBlock(m);
    if (acc && accHTML) {
      const chips = acc.querySelector('[data-chips]');
      if (chips && chips.querySelectorAll('.chip').length === m.weeks.length) ui.setChips(chips, String(w), {scroll: true});
      else { const tmp = document.createElement('div'); tmp.innerHTML = accHTML; acc.replaceWith(tmp.firstElementChild); }
    } else if (acc) acc.remove();
    else if (accHTML) { const lt2 = st.el.querySelector('.lt'); if (lt2) lt2.insertAdjacentHTML('afterend', accHTML); }
    const main = st.el.querySelector('.wr-main');
    const put = () => { main.innerHTML = bodyHTML(m); };
    if (main) {
      if (weekChanged && ctx.visible && !ui.RM) ui.crossfade(main, put, {duration: 120}); else put();
    }
    // Keep the chips pinned: land at the top of the new week's content, not halfway down it.
    if (weekChanged && sc) {
      const accNow = st.el.querySelector('.wr-acc');
      const nav = sc.querySelector(':scope > .nav');
      if (accNow && main) {
        const top = main.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (nav ? nav.offsetHeight : 44) - accNow.offsetHeight - 8;
        if (sc.scrollTop > top) sc.scrollTop = Math.max(0, top);
      }
    }
    ctx.setActions(null);
    ui.onIdle(() => { if (ST.get(ctx) === st) extras(st, ctx); });
    ui.onIdle(() => { if (ST.get(ctx) === st) putPress(st, ctx); });
  },

  onAction(id, ctx) {
    const st = ST.get(ctx);
    if (id === 'share' && st) doShare(st);
  },

  // A screen pushed on top or another tab: the presser stops playing.
  onHide(ctx) {
    pressPause(ST.get(ctx));
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (st) {
      st.token++;
      pressPause(st);
      if (st.idleP) { st.idleP(); st.idleP = null; }
      if (typeof st.pressUnsub === 'function') { try { st.pressUnsub(); } catch (_) {} }
      st.pressUnsub = null; st.pressWant = false;
    }
    ST.delete(ctx);
  }
};
