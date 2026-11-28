// League › Seasons (#/league/seasons, #/league/seasons?y=<year>&v=standings|bracket; Evan, Nov 28 2026: "Add a regular
// season standings and playoff bracket for previous seasons under the league tab"): every finished season, newest
// first, as a chip rail; under it Standings (the regular-season table: seed, record, points for and against, how the
// season ended, the bye and playoff lines; shared with the season page, season.js standingsHtml) and Bracket (the
// playoffs drawn as a tree, top to bottom: each semifinal under the quarterfinal that fed it (the league reseeds: the
// top seed meets the lowest one left), the byes named over their side, the championship below with the champion's
// path in gold, the third-place game and the consolation games by week). A game opens its matchup sheet. The season
// and view are kept per phone (gg-league-seasons) and in the link. A segment of league.js: {render, mount, unmount,
// params, me}. Styles: css/views/season.css (League › Seasons, end).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import {standingsHtml, bugCard, playoffShape} from './season.js';
import {openMatchup, seedsOf} from './matchup.js';

const esc = data.esc;
const KEY = 'gg-league-seasons';
const VIEWS = [{id: 'standings', label: 'Standings'}, {id: 'bracket', label: 'Bracket'}];
const ST = new WeakMap(); // body -> {ctx, y, v}

/** The finished seasons, newest first. */
const finished = () => data.DONE.filter(s => s && !s.live).slice().sort((a, b) => b.year - a.year);
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } };
const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} };
export const pathOf = (y, v) => `/league/seasons?y=${y}&v=${v}`;

/** The season and view to show: the link's, else this phone's last, else the newest season's standings. */
function choose(ctx) {
  const list = finished(), q = (ctx && ctx.query) || {}, sv = saved();
  const has = y => list.some(s => s.year === Number(y));
  const y = has(q.y) ? Number(q.y) : has(sv.y) ? Number(sv.y) : list.length ? list[0].year : null;
  const v = VIEWS.some(x => x.id === q.v) ? q.v : VIEWS.some(x => x.id === sv.v) ? sv.v : 'standings';
  return {y, v};
}

// ---------------------------------------------------------------- the bracket
const winnerOf = g => (g.sa === g.sb ? null : g.sa > g.sb ? g.a : g.b);
const sc = v => Number(v).toFixed(2);
const ROUND = {quarter: 'Quarterfinal', semi: 'Semifinal', final: 'Championship', third: 'Third place'};

/** The playoff games in tree order: the semifinals (the top seed's first), the quarterfinal that fed each, the byes. */
export function bracketOf(s) {
  const of = t => s.games.filter(g => g.type === t);
  const seeds = seedsOf(s), sd = id => (seeds[id] == null ? 99 : seeds[id]);
  const qf = of('quarter'), fin = of('final')[0] || null, third = of('third')[0] || null;
  const sf = of('semi').slice().sort((x, y) => Math.min(sd(x.a), sd(x.b)) - Math.min(sd(y.a), sd(y.b)));
  if (sf.length !== 2 || !fin || qf.length !== 2) return null; // another shape: the rounds as cards
  const feed = sf.map(x => qf.find(q => [x.a, x.b].includes(winnerOf(q))) || null);
  if (!feed.every(Boolean) || new Set(feed).size !== 2) return null; // every quarterfinal drawn exactly once
  const bye = sf.map((x, i) => { const f = feed[i] && winnerOf(feed[i]); return [x.a, x.b].find(id => id !== f && !qf.some(q => q.a === id || q.b === id)) || null; });
  return {qf, sf, fin, third, feed, bye, seeds};
}

/** One game of the tree: both sides (the better seed on top), the winner lit, a crown on the champion. */
function miniCard(s, g, B, {final = false} = {}) {
  const i = s.games.indexOf(g), w = winnerOf(g), sd = id => B.seeds[id];
  const [top, bot] = (sd(g.a) || 99) <= (sd(g.b) || 99) ? [g.a, g.b] : [g.b, g.a];
  const scOf = id => (id === g.a ? g.sa : g.sb);
  const side = id => {
    const st = w == null ? 'is-tie' : id === w ? 'is-win' : 'is-lose';
    const crown = final && id === w ? ui.icon('crown', {size: 13, cls: 'c-crown', label: 'Champion'}) : '';
    return `<span class="ls-side ${st}"><span class="ls-sd n5">${sd(id) != null ? esc(sd(id)) : ''}</span>${ui.avatar(id, {size: final ? 26 : 22})}`
      + `<span class="ls-nm">${esc(data.name(id))}${crown}</span><span class="ls-sc n5">${sc(scOf(id))}</span></span>`;
  };
  const label = `${ROUND[g.type] || 'Game'}, ${s.year} week ${g.week}: ${data.name(g.a)} ${sc(g.sa)}, ${data.name(g.b)} ${sc(g.sb)}${w ? `, ${data.name(w)} won` : ', tied'}`;
  return `<button type="button" class="ls-m${final ? ' is-final' : ''}" data-game="${s.year}:${i}" aria-haspopup="dialog" aria-label="${esc(label)}">${side(top)}${side(bot)}</button>`;
}

function bracketHtml(s) {
  const B = bracketOf(s);
  const champ = s.champion, wk = t => { const g = s.games.find(x => x.type === t); return g ? ` · Week ${g.week}` : ''; };
  const head = (t, title) => `<p class="ls-rd ovl">${esc(title)}${wk(t)}</p>`;
  let tree = '';
  if (B) {
    // rows of a two-column grid, so each round's cards line up: the byes, the quarterfinals, a connector row that
    // carries the Semifinals label between its lines, the semifinals, the join into the championship
    const gold = (g, id) => (g && id && winnerOf(g) === id ? ' is-champ' : '');
    const cell = (html, cls = '') => `<div class="ls-cell${cls}">${html}</div>`;
    const sfWeek = B.sf[0].week, hasQf = B.feed.some(Boolean);
    tree = `<div class="ls-tree" role="group" aria-label="${esc(`${s.year} playoff bracket`)}">`
      + (hasQf ? `<div class="ls-span">${head('quarter', 'Quarterfinals')}</div>` : `<div class="ls-span">${head('semi', 'Semifinals')}</div>`)
      + B.bye.map(by => cell(by ? `<p class="ls-bye">${ui.avatar(by, {size: 18})}<span><b>${esc(data.name(by))}</b> (${esc(B.seeds[by])}) had a bye</span></p>` : '', ' ls-byes')).join('')
      + (hasQf
        ? B.feed.map(f => cell(f ? miniCard(s, f, B) : '')).join('')
          + `<div class="ls-span ls-mid" aria-hidden="true">${B.feed.map(f => `<span class="ls-v${f ? gold(f, champ) : ' is-none'}"></span>`).join('')}<span class="ls-mid-t ovl">Semifinals · Wk ${esc(sfWeek)}</span></div>`
        : '')
      + B.sf.map(x => cell(miniCard(s, x, B))).join('')
      + `<div class="ls-span ls-join" aria-hidden="true">${B.sf.map(x => `<span class="${gold(x, champ).trim()}"></span>`).join('')}</div>`
      + `<div class="ls-span ls-fin"><span class="ls-stub" aria-hidden="true"></span>${head('final', 'Championship')}${miniCard(s, B.fin, B, {final: true})}`
      + (champ ? `<p class="ls-champ">${ui.icon('trophy-fill', {size: 16})}<span><b>${esc(data.name(champ))}</b> · ${esc(data.teamIn(s, champ))}</span></p>` : '')
      + `</div></div>`
      + (B.third ? `<div class="ls-third">${head('third', 'Third place')}${miniCard(s, B.third, B)}</div>` : '');
  } else {
    // not the usual shape: the rounds in order, as cards
    tree = ['quarter', 'semi', 'final', 'third'].map(t => {
      const gs = s.games.filter(g => g.type === t);
      if (!gs.length) return '';
      const weekGames = s.games.filter(g => g.week === gs[0].week);
      return `<section class="ls-round">${head(t, ROUND[t] === 'Quarterfinal' ? 'Quarterfinals' : ROUND[t] === 'Semifinal' ? 'Semifinals' : ROUND[t])}<div class="sea-cards">${gs.map(g => bugCard(s, g, weekGames, {hero: t === 'final', foot: false})).join('')}</div></section>`;
    }).join('');
  }
  const consol = s.games.filter(g => g.type === 'consol');
  const weeks = [...new Set(consol.map(g => g.week))].sort((a, b) => a - b);
  const consolHtml = consol.length
    ? `<section class="ls-consol" aria-labelledby="ls-consol-h">${ui.sectionHeader({title: 'Consolation', id: 'ls-consol-h'})}`
      + weeks.map(w => { const gs = consol.filter(g => g.week === w), weekGames = s.games.filter(g => g.week === w); return `<p class="ls-rd ovl">Week ${w}</p><div class="sea-cards">${gs.map(g => bugCard(s, g, weekGames, {foot: false})).join('')}</div>`; }).join('')
      + `</section>`
    : '';
  return tree + consolHtml;
}

// ---------------------------------------------------------------- the segment
function summaryHtml(s) {
  const top = s.table[0];
  const bits = [];
  if (s.champion) bits.push(`<span class="ls-sum-i">${ui.icon('trophy-fill', {size: 14})}Champion <b>${esc(data.name(s.champion))}</b></span>`);
  if (top) bits.push(`<span class="ls-sum-i">${ui.icon('crown', {size: 14})}Top seed <b>${esc(data.name(top.id))}</b> ${esc(data.recStr(top.w, top.l, top.t))}</span>`);
  return `<div class="ls-sum">${bits.join('')}<a class="ls-full" href="#/standings/${s.year}">Full season${ui.icon('chevron-right', {size: 14})}</a></div>`;
}
function bodyHtml(y, v) {
  const s = data.seasonByYear(y);
  if (!s || s.live) return ui.empty({icon: 'calendar', title: 'No finished seasons yet.', body: 'Standings and brackets show here once a season ends.'});
  const {cut} = playoffShape(s);
  const weeks = s.games.filter(g => !g.type || g.type === 'reg').map(g => g.week);
  const cap = v === 'bracket'
    ? `${cut || 'The'} teams made the playoffs. Tap a game for its matchup.`
    : `Regular season${weeks.length ? `, weeks 1–${Math.max(...weeks)}` : ''}. Seeded by record, then points for.`;
  return summaryHtml(s) + `<p class="ls-cap">${esc(cap)}</p>` + (v === 'bracket' ? bracketHtml(s) : `<div class="ls-std">${standingsHtml(s)}</div>`);
}
function controlsHtml(y, v) {
  const items = finished().map(s => ({id: s.year, label: String(s.year)}));
  return `<div class="ls-ctl">${ui.chips({name: 'ls-year', label: 'Season', items, value: y, cls: 'ls-years'})}`
    + `${ui.seg({name: 'ls-view', label: 'Show', items: VIEWS, value: v, small: true, cls: 'ls-view'})}</div>`;
}

function fill(body, {y, v}) {
  const ctl = body.querySelector('.ls-ctl'), box = body.querySelector('.ls-body');
  if (!ctl || !box) return;
  ctl.querySelectorAll('[data-chips="ls-year"] > .chip').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.value) === y)));
  const segEl = ctl.querySelector('[data-seg="ls-view"]'); if (segEl) ui.setSeg(segEl, v, {animate: true});
  box.innerHTML = y == null ? bodyHtml(null, v) : bodyHtml(y, v);
  ui.hydrate && ui.hydrate(box);
}
/** Brings the chosen year's chip into view in its rail (no page scroll). */
function centerChip(body, y) {
  const rail = body.querySelector('[data-chips="ls-year"]'), chip = rail && rail.querySelector(`.chip[data-value="${y}"]`);
  if (!rail || !chip) return;
  const r = rail.getBoundingClientRect(), c = chip.getBoundingClientRect();
  if (c.left < r.left || c.right > r.right) rail.scrollLeft += c.left - r.left - (r.width - c.width) / 2;
}

export function render(ctx) {
  const {y, v} = choose(ctx);
  if (y == null) return `<div class="ls">${bodyHtml(null, v)}</div>`;
  return `<div class="ls" data-enter>${controlsHtml(y, v)}<div class="ls-body">${bodyHtml(y, v)}</div></div>`;
}

export function mount(body, ctx) {
  const st = {ctx, ...choose(ctx)};
  ST.set(body, st);
  save({y: st.y, v: st.v});
  const go = next => {
    if (next.y === st.y && next.v === st.v) return;
    Object.assign(st, next);
    save({y: st.y, v: st.v});
    fill(body, st);
    if (ctx.replace) ctx.replace(pathOf(st.y, st.v));
  };
  st.onChange = e => {
    const d = e.detail || {};
    if (d.name === 'ls-year') { ui.haptic('selection'); go({y: Number(d.value), v: st.v}); }
    else if (d.name === 'ls-view') { ui.haptic('selection'); go({y: st.y, v: d.value}); }
  };
  st.onClick = e => {
    const el = e.target && e.target.closest ? e.target.closest('[data-game]') : null;
    if (!el || !body.contains(el)) return;
    const [yy, i] = el.dataset.game.split(':').map(Number), s = data.seasonByYear(yy), g = s && s.games[i];
    if (g) { ui.haptic('light'); openMatchup(g, ctx); }
  };
  body.addEventListener('ui:change', st.onChange);
  body.addEventListener('click', st.onClick);
  requestAnimationFrame(() => centerChip(body, st.y));
}

/** The link changed (a deep link, Back): show its season and view. */
export function params(ctx) {
  const body = document.querySelector('.v-league .hl-body[data-seg="seasons"]');
  const st = body && ST.get(body);
  if (!st) return;
  const next = choose(ctx);
  if (next.y === st.y && next.v === st.v) return;
  Object.assign(st, next);
  save({y: st.y, v: st.v});
  fill(body, st);
  centerChip(body, st.y);
}

/** 'me' (your highlight in the table): redraw the body in place. */
export function me() {
  const body = document.querySelector('.v-league .hl-body[data-seg="seasons"]');
  const st = body && ST.get(body);
  if (st) fill(body, st);
}

export function unmount(body) {
  const st = ST.get(body);
  if (!st) return;
  body.removeEventListener('ui:change', st.onChange);
  body.removeEventListener('click', st.onClick);
  ST.delete(body);
}
