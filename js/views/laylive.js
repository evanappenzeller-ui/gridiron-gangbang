// The Lay's live tracker (#/lay/live, pushed from the Lay tab): this week's slip as it plays. A summary (hit, live,
// to go, missed; alive or busted), then one card per leg in standard wording: who, the game and clock, a progress
// bar for a number to reach (yards, catches, points), and its state. Legs are scored by core/laytrack.js against
// ESPN; a result in data/lay.json wins. Your own leg (or one you entered) can be removed here until legs close.
// Owner: LAY.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as live from '../core/lay.js';
import * as track from '../core/laytrack.js';
import {loadLay, mergeLegs} from './lay.js';

const esc = data.esc;
const ORDER = {live: 0, pre: 1, na: 2, hit: 3, miss: 4};
const ST_TXT = {live: 'Live', pre: 'Not started', na: 'Not tracked', hit: 'Hit', miss: 'Missed'};
const ST = new WeakMap();

function scored(st) {
  const lw = st.lw;
  if (!lw || !st.loaded) return [];
  return mergeLegs(lw.year, lw.week, st.legs).map(l => {
    const r = l.hit === true || l.hit === false ? {st: l.hit ? 'hit' : 'miss', note: 'Settled by the league', final: true}
      : st.T ? track.evaluate(l.bet, st.T) : {st: 'pre', note: 'Loading games'};
    return {l, r};
  }).sort((a, b) => ORDER[a.r.st] - ORDER[b.r.st] || data.name(a.l.by).localeCompare(data.name(b.l.by)));
}

function summaryHTML(rows, size) {
  const n = k => rows.filter(x => x.r.st === k).length;
  const hit = n('hit'), miss = n('miss'), going = n('live'), left = rows.length - hit - miss;
  const head = miss ? 'Busted' : rows.length && hit === rows.length && rows.length >= size ? 'Cashed' : 'Still alive';
  const tone = miss ? 'is-bust' : head === 'Cashed' ? 'is-cash' : 'is-alive';
  const tile = (v, lb, cls = '') => `<div class="lv-tile ${cls}"><span class="n3">${v}</span><span class="lv-tl">${lb}</span></div>`;
  return `<section class="card lv-sum ${tone}" aria-label="Slip status"><p class="card-ovl">${rows.length} of ${size} legs in</p>`
    + `<h2 class="lv-head">${head}</h2>`
    + `<div class="lv-tiles">${tile(hit, 'Hit', 'is-hit')}${tile(going, 'Live', 'is-live')}${tile(left - going, 'To go')}${tile(miss, 'Missed', 'is-miss')}</div></section>`;
}

function barHTML(r) {
  if (r.v == null || r.n == null || !(r.n > 0)) return '';
  const f = Math.max(0, Math.min(1, r.v / r.n));
  const over = r.op === 'lt' && r.v >= r.n;
  return `<div class="lv-bar${over ? ' is-over' : ''}" role="img" aria-label="${esc(`${r.v} of ${r.n}`)}"><i style="--f:${f}"></i></div>`;
}

function cardHTML({l, r}, me, closed) {
  const g = r.game;
  const game = g ? `${g.away.abbr} ${g.state === 'pre' ? '@' : `${g.away.score || 0} – ${g.home.score || 0}`} ${g.home.abbr}` : '';
  const mine = !!me && (l.by === me || l.me === me);
  const rm = l.live && mine && !closed ? `<button type="button" class="btn btn-plain lv-rm" data-lv-rm="${esc(l.by)}">${ui.icon('x', {size: 16})}<span>Remove</span></button>` : '';
  return `<article class="card lv-card is-${r.st}${mine ? ' is-me' : ''}" aria-label="${esc(`${data.name(l.by)}: ${l.bet}. ${ST_TXT[r.st]}. ${r.note || ''}`)}">`
    + `<div class="lv-top">${ui.avatar(l.by, {size: 36, you: l.by === me})}<div class="lv-mid"><p class="lv-who">${esc(data.name(l.by))}${l.for ? ` · for ${esc(data.name(l.for))}` : ''}</p>`
    + `<p class="lv-bet">${esc(track.describe(l.bet, g ? [g] : null) || l.bet)}</p></div><span class="lv-st">${r.st === 'live' ? '<i></i>' : ''}${ST_TXT[r.st]}</span></div>`
    + barHTML(r)
    + `<div class="lv-foot"><p class="lv-note">${esc(r.note || '')}${game && !/–|@/.test(r.note || '') ? ` · ${esc(game)}` : ''}</p>${rm}</div>`
    + `</article>`;
}

function bodyHTML(st) {
  const lw = st.lw;
  if (!lw) return ui.empty({icon: 'football', title: 'No slip this week.', body: 'The tracker comes back with the next NFL week.'});
  if (!st.loaded) return ui.skeleton('rows', 4, {label: 'Loading the slip.'});
  const rows = scored(st), me = data.me(), closed = live.isClosed(lw.year, lw.week);
  if (!rows.length) return ui.empty({icon: 'ticket', title: 'No legs yet.', body: 'Legs show up here as soon as they are in.', action: {label: 'Add your leg', attrs: {'data-nav-back': ''}}});
  const sz = 12;
  return summaryHTML(rows, sz) + rows.map(x => cardHTML(x, me, closed)).join('')
    + `<p class="lv-foot-note">Live from ESPN, every 30 seconds while games are on. Results are final once the league confirms them.</p>`;
}

function fill(ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  st.body.innerHTML = bodyHTML(st);
  ctx.refreshChrome();
}

async function remove(ctx, st, by, btn) {
  const lw = st.lw;
  if (!lw || st.busy) return;
  const leg = (st.legs || []).find(l => l.by === by);
  const ok = await ui.actionSheet({title: 'Remove this leg?', message: leg ? leg.bet : '', returnFocus: btn,
    actions: [{label: 'Remove leg', value: 'rm', role: 'destructive'}, {label: 'Keep it', value: null, role: 'cancel'}]});
  if (ok !== 'rm') return;
  st.busy = true;
  const r = await live.setLeg(by, null);
  st.busy = false;
  if (r === 'ok' || r === 'dev') { ui.toast('Leg removed.'); ui.haptic('success'); fill(ctx); }
  else ui.toast(r === 'closed' ? 'Legs are closed for this week.' : 'Couldn’t remove it. Check your connection.', {icon: 'info'});
}

export default {
  id: 'laylive',
  title: 'Live Tracker',

  render() {
    const lw = live.liveWeek();
    return ui.largeTitle({eyebrow: lw ? `The Lay · Week ${lw.week}` : 'The Lay', title: 'Live Tracker'}) + `<div class="lv-body"></div>`;
  },

  mount(el, ctx) {
    const st = {el, body: el.querySelector('.lv-body'), lw: live.liveWeek(), legs: [], T: null, loaded: false, stops: [], busy: false};
    ST.set(ctx, st);
    const lw = st.lw;
    if (lw) {
      st.stops.push(live.subscribe(lw.year, lw.week, legs => { st.legs = legs; if (st.loaded) fill(ctx); }));
      st.stops.push(track.track(lw.year, lw.week, T => { st.T = T; if (st.loaded) fill(ctx); }));
      loadLay().catch(() => {}).then(() => { st.loaded = true; fill(ctx); });
    }
    fill(ctx);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-lv-rm]');
      if (b) remove(ctx, st, b.dataset.lvRm, b);
    });
  },

  update(ctx) { fill(ctx); },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (st) st.stops.forEach(f => f());
    ST.delete(ctx);
  }
};
