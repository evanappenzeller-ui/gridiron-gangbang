// The Lay tab root (#/lay): the league's weekly 12-leg parlay. Every manager submits one leg; the lowest scorer of the
// previous fantasy week places it for $5 (the placer comes from league.json: the lowest regular-season score of week
// N-1, unless the week in data/lay.json names one). Sections: this week's slip (who places it, the legs in so far),
// season tiles, each manager's leg record, then every week's slip with its hits and the legs that busted it.
// Data: data/lay.json {stake, legs, weeks: [{year, week, placer?, legs: [{by, for?, bet, hit: true|false|null}]}]}.
// A leg with `for` was submitted by `by` in another manager's slot: it counts on `by`'s record. Owner: LAY.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import {youButtonHTML} from './you.js';

const esc = data.esc;
const LAY_URL = new URL('../../data/lay.json', import.meta.url).href;

let LAY = null, layP = null, layErr = false;
function loadLay({fresh} = {}) {
  if (layP && !fresh) return layP;
  layP = fetch(LAY_URL, fresh ? {cache: 'no-cache'} : {}).then(r => {
    if (!r.ok) throw new Error('lay.json HTTP ' + r.status);
    return r.json();
  }).then(j => {
    if (!j || !Array.isArray(j.weeks)) throw new Error('lay.json has no "weeks" list');
    LAY = j; layErr = false;
    return j;
  }).catch(e => { layP = null; layErr = true; throw e; });
  return layP;
}

// ---------------------------------------------------------------------------------------------- Derivations
const legsOf = w => Array.isArray(w.legs) ? w.legs : [];
const settled = l => l.hit === true || l.hit === false;
const STAKE = () => Number(LAY && LAY.stake) || 5;
const SIZE = () => Number(LAY && LAY.legs) || 12;

// The lowest regular-season score of the fantasy week before: {id, pts} or null (week 1, or not played yet).
function lowestOf(year, week) {
  const s = data.seasonByYear(year);
  if (!s || week < 1) return null;
  let low = null;
  s.games.filter(g => g.reg && g.week === week).forEach(g => {
    [[g.a, g.sa], [g.b, g.sb]].forEach(([id, pts]) => { if (!low || pts < low.pts) low = {id, pts}; });
  });
  return low;
}
function placerOf(w) {
  if (w.placer) return {id: w.placer, pts: null};
  return lowestOf(w.year, w.week - 1);
}
// 'hit' (every leg hit), 'bust' (a leg missed), 'live' (legs pending, none missed), 'open' (no legs yet).
function statusOf(w) {
  const L = legsOf(w);
  if (!L.length) return 'open';
  if (L.some(l => l.hit === false)) return 'bust';
  return L.length >= SIZE() && L.every(l => l.hit === true) ? 'hit' : 'live';
}
function tally(w) {
  const L = legsOf(w);
  return {n: L.length, hit: L.filter(l => l.hit === true).length, miss: L.filter(l => l.hit === false).length};
}
function records() {
  const R = {};
  data.ids.forEach(id => { R[id] = {id, w: 0, l: 0, streak: 0}; });
  LAY.weeks.forEach(w => legsOf(w).forEach(l => {
    const r = R[l.by] || (R[l.by] = {id: l.by, w: 0, l: 0, streak: 0});
    if (l.hit === true) r.w++;
    else if (l.hit === false) r.l++;
  }));
  // Current streak: consecutive settled legs from the latest back, + for hits, - for misses.
  Object.values(R).forEach(r => {
    const mine = [];
    LAY.weeks.forEach(w => legsOf(w).forEach(l => { if (l.by === r.id && settled(l)) mine.push(l.hit); }));
    let s = 0;
    for (let i = mine.length - 1; i >= 0; i--) {
      if (!s) s = mine[i] ? 1 : -1;
      else if ((s > 0) === mine[i]) s += s > 0 ? 1 : -1;
      else break;
    }
    r.streak = s;
  });
  return Object.values(R).sort((a, b) => b.w - a.w || a.l - b.l || data.name(a.id).localeCompare(data.name(b.id)));
}

// ---------------------------------------------------------------------------------------------- Pieces
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
function markOf(l) {
  if (l.hit === true) return `<span class="ly-mark is-hit">${ui.icon('check', {label: 'Hit'})}</span>`;
  if (l.hit === false) return `<span class="ly-mark is-miss">${ui.icon('x', {label: 'Missed'})}</span>`;
  return `<span class="ly-mark is-live">${ui.icon('clock', {label: 'Pending'})}</span>`;
}
function legRow(l, me) {
  const who = data.name(l.by) + (l.for ? ` · for ${data.name(l.for)}` : '');
  return ui.row({lead: ui.avatar(l.by, {size: 32, you: l.by === me}), title: l.bet || '—', sub: who, trail: markOf(l), me: l.by === me,
    cls: 'ly-leg' + (l.hit === false ? ' ly-busted' : '')});
}
// Managers who haven't sent a leg yet this week (a leg in someone's slot covers that slot).
function missingOf(w) {
  const covered = new Set(legsOf(w).map(l => l.for || l.by));
  return data.ids.filter(id => !covered.has(id));
}
function statusPill(w) {
  const st = statusOf(w), t = tally(w);
  if (st === 'hit') return ui.pill('Cashed', {tone: 'gold', icon: 'crown'});
  if (st === 'bust') return ui.pill(`Busted · ${t.hit}/${t.n}`, {tone: 'wrong'});
  if (st === 'live') return ui.pill(`Live · ${t.hit}/${t.n}`, {tone: 'tint'});
  return ui.pill('Legs due', {tone: 'neutral', icon: 'clock'});
}
function placerLine(w) {
  const p = placerOf(w);
  if (!p) return '';
  const why = p.pts != null ? `lowest score in Week ${w.week - 1} (${data.fmt(p.pts)})` : 'placing it';
  return `<p class="ly-placer">${ui.avatar(p.id, {size: 24})}<span><b>${esc(data.name(p.id))}</b> places it · ${esc(why)}</span></p>`;
}

function currentWeek() {
  return LAY.weeks.length ? LAY.weeks[LAY.weeks.length - 1] : null;
}

function heroHTML(me) {
  const w = currentWeek();
  if (!w) return '';
  const st = statusOf(w), t = tally(w), size = SIZE();
  let body = '';
  if (st === 'open' || t.n < size) {
    const miss = missingOf(w);
    body += `<div class="ly-meter" role="img" aria-label="${t.n} of ${size} legs in"><i style="--f:${Math.min(1, t.n / size)}"></i></div>`
      + `<p class="ly-meter-lb"><b>${t.n} of ${size}</b> legs in</p>`;
    if (miss.length) body += `<p class="ly-waiting">Waiting on ${esc(miss.map(data.name).join(', '))}</p>`;
  }
  if (t.n) body += ui.group(legsOf(w).map(l => legRow(l, me)).join(''), {cls: 'ly-legs'});
  return `<section class="card card-hero ly-hero ly-${st}" aria-label="This week">`
    + `<div class="ly-hero-top"><p class="card-ovl">This week · Week ${w.week}</p>${statusPill(w)}</div>`
    + `<h2 class="card-title">${st === 'open' ? 'Get your legs in' : st === 'hit' ? 'It hit.' : st === 'bust' ? 'Busted.' : 'Sweating it'}</h2>`
    + placerLine(w) + body + `</section>`;
}

function tilesHTML() {
  const done = LAY.weeks.filter(w => statusOf(w) === 'hit' || statusOf(w) === 'bust');
  const placed = LAY.weeks.filter(w => legsOf(w).length >= SIZE()); // a slip is placed once all its legs are in
  let n = 0, h = 0;
  LAY.weeks.forEach(w => legsOf(w).forEach(l => { if (settled(l)) { n++; if (l.hit) h++; } }));
  const cashed = done.filter(w => statusOf(w) === 'hit').length;
  const best = done.reduce((b, w) => { const t = tally(w); return !b || t.hit > b.hit ? {hit: t.hit, n: t.n, week: w.week} : b; }, null);
  return `<div class="tiles tiles-3 ly-tiles">`
    + ui.statTile({label: 'Cashed', value: `${cashed} of ${done.length}`, sub: done.length ? (cashed ? 'paid out' : 'still chasing') : ''})
    + ui.statTile({label: 'Legs hit', value: n ? `${Math.round(h / n * 100)}%` : '—', sub: n ? `${h} of ${n}` : ''})
    + ui.statTile({label: 'Paid in', value: money(placed.length * STAKE()), sub: best ? `best ${best.hit}/${best.n}` : ''})
    + `</div>`;
}

function recordsHTML(me) {
  const rows = records().map((r, i) => {
    const n = r.w + r.l;
    const sub = n ? `${Math.round(r.w / n * 100)}% hit` + (Math.abs(r.streak) >= 2 ? ` · ${r.streak > 0 ? 'hit' : 'missed'} last ${Math.abs(r.streak)}` : '') : 'No legs yet';
    return ui.row({lead: `<span class="ly-rank n5">${i + 1}</span>${ui.avatar(r.id, {size: 32, you: r.id === me})}`, title: data.name(r.id), sub,
      trail: `<span class="ly-rec n4">${data.recStr(r.w, r.l)}</span>`, me: r.id === me, attrs: {href: '#/managers/' + encodeURIComponent(r.id)}, chevron: true});
  }).join('');
  return ui.sectionHeader({title: 'Leg records'}) + ui.group(rows, {footer: 'Hits and misses on the legs each manager submitted.'});
}

function weeksHTML(me) {
  const past = LAY.weeks.filter(w => w !== currentWeek() || statusOf(w) === 'hit' || statusOf(w) === 'bust').slice().reverse();
  if (!past.length) return '';
  return ui.sectionHeader({title: 'Every slip'}) + past.map(w => {
    const t = tally(w);
    const busted = legsOf(w).filter(l => l.hit === false).map(l => data.name(l.by));
    const foot = statusOf(w) === 'bust' ? `Busted by ${busted.join(', ')}` : statusOf(w) === 'hit' ? `All ${t.n} hit` : '';
    return `<section class="ly-week" aria-label="Week ${w.week}">`
      + `<div class="ly-week-h"><h3>Week ${w.week}</h3>${statusPill(w)}</div>`
      + placerLine(w)
      + ui.group(legsOf(w).map(l => legRow(l, me)).join(''), {footer: foot})
      + `</section>`;
  }).join('');
}

function bodyHTML() {
  if (!LAY) {
    if (layErr) return ui.empty({icon: 'football', title: "Couldn't load the Lay.", body: 'Check your connection.', action: {label: 'Try again', attrs: {'data-ly-retry': ''}}});
    return ui.skeleton('rows', 4, {label: 'Loading the Lay.'});
  }
  const me = data.me();
  return heroHTML(me) + tilesHTML() + recordsHTML(me) + weeksHTML(me);
}

function subtitle() {
  return LAY ? `${SIZE()} legs · one each · lowest score places it for ${money(STAKE())}` : 'The weekly 12-leg parlay';
}

function eyebrow() {
  const w = LAY && currentWeek();
  return w ? `${w.year} · Week ${w.week}` : 'Parlay';
}

// ---------------------------------------------------------------------------------------------- View
const ST = new WeakMap();
function fill(ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  st.body.innerHTML = bodyHTML();
  const sub = st.el.querySelector('.lt-sub');
  if (sub) sub.textContent = subtitle();
  const eb = st.el.querySelector('.lt-eyebrow');
  if (eb) eb.textContent = eyebrow();
  ctx.refreshChrome();
}
function fetchAndFill(ctx, opts) {
  return loadLay(opts).then(() => fill(ctx), () => fill(ctx));
}

/** Prefetched at idle after launch (app.js), so the first visit opens filled in. */
export function warm() { return loadLay(); }

export default {
  id: 'lay',
  title: 'The Lay',

  render() {
    return ui.largeTitle({eyebrow: eyebrow(), title: 'The Lay', subtitle: subtitle(), trailing: youButtonHTML()})
      + `<div class="ly-body">${bodyHTML()}</div>`;
  },

  mount(el, ctx) {
    const st = {el, body: el.querySelector('.ly-body')};
    ST.set(ctx, st);
    el.addEventListener('click', e => {
      if (!e.target.closest('[data-ly-retry]')) return;
      st.body.innerHTML = bodyHTML();
      fetchAndFill(ctx, {fresh: true});
    });
    if (!LAY) fetchAndFill(ctx);
    if (ctx.first) ui.stagger(el);
  },

  // 'data' (league.json reloaded: maybe a new week) refetches the slip too; 'me' redraws the highlights.
  update(ctx) {
    if (ctx.reason === 'data') { fetchAndFill(ctx, {fresh: true}); return; }
    fill(ctx);
  },

  unmount(el, ctx) { ST.delete(ctx); }
};
