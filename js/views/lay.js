// The Lay tab root (#/lay): the league's weekly 12-leg parlay. Every manager submits one leg; the lowest scorer of the
// previous fantasy week places it for $5 (the placer comes from league.json: the lowest regular-season score of week
// N-1, unless the week in data/lay.json names one). Sections: this week's slip (who places it, the legs in so far),
// season tiles, each manager's leg record, then every week's slip with its hits and the legs that busted it.
// Data: data/lay.json {stake, legs, weeks: [{year, week, placer?, legs: [{by, for?, bet, hit: true|false|null}]}]}.
// A leg with `for` was submitted by `by` in another manager's slot: it counts on `by`'s record.
// Live legs: managers enter their leg for the week in the "Your leg" card (core/lay.js, Firestore); they show on the
// slip as pending until data/lay.json carries that manager's leg with its result.
// Live tracking (core/laytrack.js): the live week's and the week before's pending legs are scored against ESPN's games
// and box scores as they play: a note under each leg ("38 rec yds · 50+ · 3rd 4:12") and, once one is decided, a hit or
// a miss (auto: true) until data/lay.json carries the result. Owner: LAY.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as live from '../core/lay.js';
import * as track from '../core/laytrack.js';
import {youButtonHTML} from './you.js';

const esc = data.esc;
const LAY_URL = new URL('../../data/lay.json', import.meta.url).href;

let LAY = null, layP = null, layErr = false, layAt = Date.now();
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

// ---------------------------------------------------------------------------------------------- Live legs
// weekKey -> legs entered in the app (core/lay.js), for the live week and the one before it (so a week's legs stay
// on its slip after the league moves on, until data/lay.json has them with results).
const LIVE = new Map();
const TRK = new Map(); // weekKey -> laytrack's tracked week {games, boxes, at}
let liveErr = null;
const wkey = (y, w) => `${y}-w${w}`;
// data/lay.json's weeks with the live legs merged in (a manager's leg in the file wins), plus the live week itself
// when the file doesn't have it yet. Rebuilt on every fill.
let WEEKS = [];
function buildWeeks() {
  const ws = LAY.weeks.map(w => Object.assign({}, w, {legs: legsOf(w).map(l => Object.assign({}, l))}));
  const lw = live.liveWeek();
  if (lw && !ws.some(w => w.year === lw.year && w.week === lw.week)) {
    ws.push({year: lw.year, week: lw.week, legs: []});
    ws.sort((a, b) => a.year - b.year || a.week - b.week);
  }
  ws.forEach(w => {
    const L = LIVE.get(wkey(w.year, w.week));
    if (!L) return;
    const covered = new Set(w.legs.map(l => l.for || l.by));
    L.filter(l => !covered.has(l.by)).forEach(l => w.legs.push({by: l.by, bet: l.bet, hit: null, live: true, me: l.me, nick: l.nick}));
  });
  // Pending legs of a tracked week: ESPN's live state, and a provisional hit / miss once decided.
  ws.forEach(w => {
    const T = TRK.get(wkey(w.year, w.week));
    if (!T) return;
    w.tracked = true;
    w.legs.forEach(l => {
      if (settled(l)) return;
      l.trk = track.evaluate(l.bet, T);
      if (l.trk.st === 'hit' || l.trk.st === 'miss') { l.hit = l.trk.st === 'hit'; l.auto = true; }
    });
  });
  WEEKS = ws;
  return ws;
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
  if (!L.length || (L.length < SIZE() && !L.some(settled))) return 'open'; // legs still coming in
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
  WEEKS.forEach(w => legsOf(w).forEach(l => {
    const r = R[l.by] || (R[l.by] = {id: l.by, w: 0, l: 0, streak: 0});
    if (l.hit === true) r.w++;
    else if (l.hit === false) r.l++;
  }));
  // Current streak: consecutive settled legs from the latest back, + for hits, - for misses.
  Object.values(R).forEach(r => {
    const mine = [];
    WEEKS.forEach(w => legsOf(w).forEach(l => { if (l.by === r.id && settled(l)) mine.push(l.hit); }));
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
  if (l.trk && l.trk.st === 'live' && !settled(l)) return `<span class="ly-mark is-going" role="img" aria-label="In progress"><i></i></span>`;
  if (l.hit === true) return `<span class="ly-mark is-hit">${ui.icon('check', {label: 'Hit'})}</span>`;
  if (l.hit === false) return `<span class="ly-mark is-miss">${ui.icon('x', {label: 'Missed'})}</span>`;
  return `<span class="ly-mark is-live">${ui.icon('clock', {label: 'Pending'})}</span>`;
}
function legRow(l, me) {
  const by = l.live && l.me !== l.by ? (l.me ? data.name(l.me) : l.nick) : '';
  const who = data.name(l.by) + (l.for ? ` · for ${data.name(l.for)}` : '') + (by ? ` · entered by ${by}` : '')
    + (l.trk && l.trk.note ? ` · ${l.trk.note}` : '');
  const bet = (l.live && track.describe(l.bet, weekGames())) || l.bet;
  return ui.row({lead: ui.avatar(l.by, {size: 32, you: l.by === me}), title: bet || '—', sub: who, trail: markOf(l), me: l.by === me,
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

// The slip the top card is about: the live week (legs being entered), else the file's last week.
function currentWeek() {
  const lw = live.liveWeek();
  const w = lw && WEEKS.find(x => x.year === lw.year && x.week === lw.week);
  return w || (WEEKS.length ? WEEKS[WEEKS.length - 1] : null);
}
const legOf = (w, id) => w ? legsOf(w).find(l => (l.for || l.by) === id) || null : null;

// noLegs: the legs show in the tracker preview below instead.
function heroHTML(me, {noLegs} = {}) {
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
  if (t.n && !noLegs) body += ui.group(legsOf(w).map(l => legRow(l, me)).join(''), {cls: 'ly-legs',
    footer: w.tracked ? 'Tracking live from ESPN. Results are final once the league confirms them.' : ''});

  return `<section class="card card-hero ly-hero ly-${st}" aria-label="This week">`
    + `<div class="ly-hero-top"><p class="card-ovl">This week · Week ${w.week}</p>${statusPill(w)}</div>`
    + `<h2 class="card-title">${st === 'open' ? 'Get your legs in' : st === 'hit' ? 'It hit.' : st === 'bust' ? 'Busted.' : 'Sweating it'}</h2>`
    + placerLine(w) + body + `</section>`;
}

// The live tracker: once legs close (Sunday 1:00 PM ET, the main slate's kickoff) it leads the tab. Slip status (hit,
// live, to go, missed), then a card per leg: who, the bet in standard wording, its state, a progress bar toward the
// number it needs and the game's score and clock. Scored by core/laytrack.js; a result in data/lay.json wins.
const ORDER = {live: 0, pre: 1, na: 2, hit: 3, miss: 4};
const ST_TXT = {live: 'Live', pre: 'Not started', na: 'Not tracked', hit: 'Hit', miss: 'Missed'};
function trackRows(w) {
  return legsOf(w).map(l => ({l, r: settled(l) && !l.auto ? {st: l.hit ? 'hit' : 'miss', note: 'Settled by the league'} : (l.trk || {st: 'pre', note: 'Waiting on the games'})}))
    .sort((a, b) => ORDER[a.r.st] - ORDER[b.r.st] || data.name(a.l.by).localeCompare(data.name(b.l.by)));
}
function barHTML(r) {
  if (r.v == null || r.n == null || !(r.n > 0)) return '';
  const f = Math.max(0, Math.min(1, r.v / r.n));
  return `<div class="lv-bar${r.op === 'lt' && r.v >= r.n ? ' is-over' : ''}" role="img" aria-label="${esc(`${r.v} of ${r.n}`)}"><i style="--f:${f}"></i></div>`;
}
function trackCard({l, r}, me) {
  const g = r.game;
  const game = g ? `${g.away.abbr} ${g.state === 'pre' ? '@' : `${g.away.score || 0} – ${g.home.score || 0}`} ${g.home.abbr}` : '';
  const bet = track.describe(l.bet, g ? [g] : weekGames()) || l.bet;
  return `<article class="card lv-card is-${r.st}${l.by === me ? ' is-me' : ''}" aria-label="${esc(`${data.name(l.by)}: ${bet}. ${ST_TXT[r.st]}. ${r.note || ''}`)}">`
    + `<div class="lv-top">${ui.avatar(l.by, {size: 36, you: l.by === me})}<div class="lv-mid"><p class="lv-who">${esc(data.name(l.by))}${l.for ? ` · for ${esc(data.name(l.for))}` : ''}</p>`
    + `<p class="lv-bet">${esc(bet)}</p></div><span class="lv-st">${r.st === 'live' ? '<i></i>' : ''}${ST_TXT[r.st]}</span></div>`
    + barHTML(r)
    + `<p class="lv-note">${esc(r.note || '')}${game && !/–|@/.test(r.note || '') ? ` · ${esc(game)}` : ''}</p>`
    + `</article>`;
}
// preview: before legs close, under "Get your legs in" (no placer line: the card above has it).
function trackerHTML(w, me, {preview} = {}) {
  const rows = trackRows(w), n = k => rows.filter(x => x.r.st === k).length;
  const hit = n('hit'), miss = n('miss'), going = n('live'), left = rows.length - hit - miss - going, st = statusOf(w);
  // The section is the Live Tracker, before and after legs close; the slip's state rides on the overline.
  const state = st === 'bust' ? 'Busted' : st === 'hit' ? 'Cashed' : hit || going ? 'Still alive' : `${rows.length} ${rows.length === 1 ? 'leg' : 'legs'} in`;
  const tile = (v, lb, cls = '') => `<div class="lv-tile ${cls}"><span class="n3">${v}</span><span class="lv-tl">${lb}</span></div>`;
  return `<section class="card card-hero lv-sum is-${st}" aria-label="Live tracker">`
    + `<div class="ly-hero-top"><p class="card-ovl">Week ${w.week} · ${state}</p>${statusPill(w)}</div>`
    + `<h2 class="lv-head">Live Tracker</h2>` + (preview ? '' : placerLine(w))
    + `<div class="lv-tiles">${tile(hit, 'Hit', 'is-hit')}${tile(going, 'Live', 'is-live')}${tile(left, 'To go')}${tile(miss, 'Missed', 'is-miss')}</div></section>`
    + `<div class="lv-cards">${rows.map(x => trackCard(x, me)).join('')}</div>`
    + `<p class="lv-foot-note">Live from ESPN, every 30 seconds while games are on. Results are final once the league confirms them.</p>`;
}

// "Your leg": enter, change or remove your leg for the live week (or someone else's: st.target).
// bare: the "Your leg" part only (sub-headed), for the combined week card (weekCardHTML).
function entryHTML(st, me, {bare} = {}) {
  const lw = live.liveWeek();
  if (!lw) return '';
  const w = WEEKS.find(x => x.year === lw.year && x.week === lw.week);
  const closed = live.isClosed(lw.year, lw.week);
  const target = st.target || me;
  const leg = legOf(w, target);
  const ovl = `<p class="card-ovl">Week ${lw.week} · ${closed ? 'Legs closed' : 'Closes ' + esc(live.closeText(lw.year, lw.week))}</p>`;
  const forLink = closed ? '' : `<button type="button" class="btn btn-plain ly-for" data-ly-for>${st.target && st.target !== me ? 'Enter a different leg' : 'Entering for someone else?'}</button>`;
  let inner;
  if (!target) {
    inner = `<h2 class="card-title">Add your leg</h2><p class="card-body">Pick who you are first, so your leg goes in your slot.</p>`
      + `<div class="ly-acts">${ui.button({label: 'Pick who you are', kind: 'primary', size: 's', attrs: {'data-you': ''}})}</div>`;
  } else if (leg && (!st.editing || closed || !leg.live)) {
    const mine = target === me;
    inner = `<h2 class="card-title">${mine ? 'Your leg' : esc(data.name(target)) + '\u2019s leg'}</h2>`
      + ui.group(legRow(leg, me), {cls: 'ly-legs ly-mine'})
      + (closed || !leg.live ? '' : `<div class="ly-acts">${ui.button({label: 'Change', kind: 'secondary', size: 's', attrs: {'data-ly-edit': ''}})}${ui.button({label: 'Remove', kind: 'plain', size: 's', attrs: {'data-ly-remove': ''}})}</div>`);
  } else if (closed) {
    inner = `<h2 class="card-title">${target === me ? 'No leg from you' : 'No leg from ' + esc(data.name(target))}</h2><p class="card-body">Legs for Week ${lw.week} closed ${esc(live.closeText(lw.year, lw.week))}.</p>`;
  } else {
    const val = st.draft != null ? st.draft : (leg ? leg.bet : '');
    inner = `<h2 class="card-title">${target === me ? 'Your leg' : 'Leg for ' + esc(data.name(target))}</h2>`
      + `<form class="ly-form" data-ly-form autocomplete="off">`
      + `<label class="ly-who">${ui.avatar(target, {size: 24, you: target === me})}<span>${esc(data.name(target))}</span></label>`
      + `<div class="ly-field"><input class="ly-in" name="bet" type="text" maxlength="${live.BET_MAX}" enterkeyhint="send" autocapitalize="words" autocorrect="off" spellcheck="false" placeholder="e.g. Jalen Hurts anytime TD" aria-label="Your leg" aria-describedby="ly-read" value="${esc(val)}"></div>`
      + `<p class="ly-read" id="ly-read" data-ly-read aria-live="polite">${readHTML(val)}</p>`
      + `<div class="ly-acts">${ui.button({label: leg ? 'Save change' : 'Submit leg', kind: 'primary', size: 's', type: 'submit', attrs: {'data-ly-submit': ''}})}${leg ? ui.button({label: 'Cancel', kind: 'plain', size: 's', attrs: {'data-ly-cancel': ''}}) : ''}</div>`
      + `</form>`;
  }
  const off = liveErr === 'denied' ? `<p class="ly-note">Saving legs isn't switched on in the database yet.</p>` : '';
  if (bare) return `<div class="ly-yours ly-entry">${inner.replace(/<h2 class="card-title">(.*?)<\/h2>/, '<h3 class="ly-sub-t">$1</h3>')}${off}${forLink}</div>`;
  return `<section class="card ly-entry" aria-label="Your leg">${ovl}${inner}${off}${forLink}</section>`;
}

// Before legs close: one card for the week. When it closes and its status, who places it, how many legs are in and
// who is missing, then your leg (or the box to enter it).
function weekCardHTML(st, me) {
  const lw = live.liveWeek(), w = currentWeek();
  const t = tally(w), size = SIZE(), miss = missingOf(w);
  return `<section class="card card-hero ly-hero ly-week-card ly-${statusOf(w)}" aria-label="Week ${w.week}">`
    + `<div class="ly-hero-top"><p class="card-ovl">Week ${w.week} · Closes ${esc(live.closeText(lw.year, lw.week))}</p>${ui.pill(`${t.n}/${size} in`, {tone: t.n >= size ? 'tint' : 'neutral', icon: 'clock'})}</div>`
    + `<h2 class="card-title">Get your legs in</h2>`
    + placerLine(w)
    + `<div class="ly-meter" role="img" aria-label="${t.n} of ${size} legs in"><i style="--f:${Math.min(1, t.n / size)}"></i></div>`
    + `<p class="ly-meter-lb"><b>${t.n} of ${size}</b> legs in${miss.length ? ` · <span class="ly-waiting-i">waiting on ${esc(miss.map(data.name).join(', '))}</span>` : ''}</p>`
    + entryHTML(st, me, {bare: true})
    + `</section>`;
}

// The entry's preview: the leg in standard wording (what gets saved and tracked), or how to word it.
const weekGames = () => { const lw = live.liveWeek(), T = lw && TRK.get(wkey(lw.year, lw.week)); return T ? T.games : null; };
function readHTML(text) {
  if (!String(text || '').trim()) return `<span class="ly-read-hint">Type it the way you'd say it. We'll write it up as the real bet and track it live.</span>`;
  const d = track.describe(text, weekGames());
  if (d && track.needsLine(text)) return `${ui.icon('check-circle', {size: 16})}<span>Saves as <b>${esc(d)}</b>. <span class="ly-read-hint">Add the book's number (like "Over 4.5") and it settles itself; without one we track it live and the league settles it.</span></span>`;
  if (d) return `${ui.icon('check-circle', {size: 16})}<span>Saves as <b>${esc(d)}</b></span>`;
  return `${ui.icon('info', {size: 16})}<span class="ly-read-hint">Can't read this one for live tracking, so it saves as typed. Try "Player 50+ Rec Yards", "Player anytime TD" or "Bills -3.5".</span>`;
}

function tilesHTML() {
  const done = WEEKS.filter(w => statusOf(w) === 'hit' || statusOf(w) === 'bust');
  const placed = WEEKS.filter(w => legsOf(w).length >= SIZE()); // a slip is placed once all its legs are in
  let n = 0, h = 0;
  WEEKS.forEach(w => legsOf(w).forEach(l => { if (settled(l)) { n++; if (l.hit) h++; } }));
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

// Past slips, compact and in week order: one card per week (week, placer, a square per leg, the result); tap to open
// its legs as one-line rows.
function weeksHTML(me) {
  const past = WEEKS.filter(w => legsOf(w).length).filter(w => w !== currentWeek() || statusOf(w) === 'hit' || statusOf(w) === 'bust');
  if (!past.length) return '';
  return ui.sectionHeader({title: 'Every slip'}) + `<div class="ly-slips">` + past.map(w => {
    const t = tally(w), st = statusOf(w), p = placerOf(w);
    const squares = legsOf(w).map(l => `<i class="${l.hit === true ? 'is-hit' : l.hit === false ? 'is-miss' : ''}"></i>`).join('');
    const res = st === 'hit' ? 'Cashed' : `${t.hit}/${t.n}`;
    const legs = legsOf(w).map(l => `<li class="ly-cl${l.hit === false ? ' is-miss' : l.hit === true ? ' is-hit' : ''}">${ui.avatar(l.by, {size: 22, you: l.by === me})}`
      + `<span class="ly-cl-bet">${esc(l.bet || '—')}</span><span class="ly-cl-who">${esc(data.name(l.by).split(' ')[0])}</span>${markOf(l)}</li>`).join('');
    return `<details class="card ly-slip is-${st}"><summary class="ly-slip-h">`
      + `<span class="ly-slip-wk n4">W${w.week}</span>`
      + `<span class="ly-slip-mid"><span class="ly-sq" aria-hidden="true">${squares}</span>`
      + `<span class="ly-slip-sub">${esc([p ? data.name(p.id).split(' ')[0] + ' placed' : '', t.miss ? `${t.miss} missed` : st === 'hit' ? 'Every leg hit' : ''].filter(Boolean).join(' · '))}</span></span>`
      + `<span class="ly-slip-res n5 is-${st}">${res}</span>${ui.icon('chevron-down', {cls: 'ly-slip-chev'})}</summary>`
      + `<ul class="ly-cls">${legs}</ul></details>`;
  }).join('') + `</div>`;
}

function bodyHTML(st) {
  if (!LAY) {
    if (layErr) return ui.empty({icon: 'football', title: "Couldn't load the Lay.", body: 'Check your connection.', action: {label: 'Try again', attrs: {'data-ly-retry': ''}}});
    return ui.skeleton('rows', 4, {label: 'Loading the Lay.'});
  }
  buildWeeks();
  const me = data.me();
  // Before legs close the entry box leads; once they close (games under way) the live tracker does.
  const lw = live.liveWeek(), w = currentWeek();
  const tracking = lw && w && w.year === lw.year && w.week === lw.week && live.isClosed(lw.year, lw.week) && legsOf(w).length;
  if (tracking) return trackerHTML(w, me) + tilesHTML() + recordsHTML(me) + weeksHTML(me);
  // Before: the entry box, "Get your legs in", then a preview of the tracker (the live week's legs, scored as they play).
  const thisWeek = lw && w && w.year === lw.year && w.week === lw.week;
  if (thisWeek) return weekCardHTML(st || {}, me) + (legsOf(w).length ? trackerHTML(w, me, {preview: true}) : '') + tilesHTML() + recordsHTML(me) + weeksHTML(me);
  return entryHTML(st || {}, me) + heroHTML(me) + tilesHTML() + recordsHTML(me) + weeksHTML(me);
}

function subtitle() {
  return LAY ? `${SIZE()} legs · one each · lowest score places it for ${money(STAKE())}` : 'The weekly 12-leg parlay';
}

function eyebrow() {
  const w = LAY && (buildWeeks(), currentWeek());
  return w ? `${w.year} · Week ${w.week}` : 'Parlay';
}

// ---------------------------------------------------------------------------------------------- View
const ST = new WeakMap();
function fill(ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  const inp = st.body.querySelector('.ly-in');
  const focused = !!inp && document.activeElement === inp;
  if (inp) st.draft = inp.value;
  st.body.innerHTML = bodyHTML(st);
  // Props whose player has no box score yet: look up his team (rosters) so the leg shows its game; redraw when found.
  WEEKS.forEach(w => {
    const T = w.tracked && TRK.get(wkey(w.year, w.week));
    const p = T && track.lookupPlayers(legsOf(w).filter(l => !settled(l)).map(l => l.bet), T);
    if (p) p.then(() => { if (ST.get(ctx) === st) fill(ctx); }, () => {});
  });
  const inp2 = st.body.querySelector('.ly-in');
  if (inp2 && focused) { inp2.focus(); try { inp2.setSelectionRange(inp2.value.length, inp2.value.length); } catch (_) {} }
  const sub = st.el.querySelector('.lt-sub');
  if (sub) sub.textContent = subtitle();
  const eb = st.el.querySelector('.lt-eyebrow');
  if (eb) eb.textContent = eyebrow();
  ctx.refreshChrome();
}
function fetchAndFill(ctx, opts) {
  return loadLay(opts).then(() => fill(ctx), () => fill(ctx));
}

// Live legs for the live week and the one before (resubscribed when the league moves on to a new week).
function watchLive(ctx, st) {
  st.stops.forEach(f => f());
  st.stops = [];
  const lw = live.liveWeek();
  if (!lw) return;
  [lw.week, lw.week - 1].filter(w => w >= 1).forEach(wk => {
    st.stops.push(live.subscribe(lw.year, wk, (legs, err) => {
      LIVE.set(wkey(lw.year, wk), legs);
      if (wk === lw.week) liveErr = err;
      if (LAY) fill(ctx);
    }));
    st.stops.push(track.track(lw.year, wk, T => { TRK.set(wkey(lw.year, wk), T); if (LAY) fill(ctx); }));
  });
  st.liveKey = wkey(lw.year, lw.week);
}
function focusInput(st) {
  const i = st.body.querySelector('.ly-in');
  if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (_) {} }
}
const SAVE_MSG = {closed: 'Legs are closed for this week.', invalid: 'Type a leg first.', denied: 'Saving legs isn\u2019t switched on yet.', failed: 'Couldn\u2019t save. Check your connection.'};
async function submitLeg(ctx, st) {
  if (st.busy) return;
  const inp = st.body.querySelector('.ly-in'), btn = st.body.querySelector('[data-ly-submit]');
  const target = st.target || data.me();
  const typed = inp ? inp.value.trim() : '';
  const bet = (typed && track.describe(typed, weekGames())) || typed;
  if (!target) return;
  if (!bet) { if (inp) { ui.shake(inp); inp.focus(); } return; }
  st.busy = true;
  ui.setLoading(btn, true);
  const r = await live.setLeg(target, bet);
  st.busy = false;
  ui.setLoading(btn, false);
  if (r === 'ok' || r === 'dev') {
    st.editing = false; st.draft = null;
    if (inp) inp.blur();
    ui.haptic('success');
    ui.toast(target === data.me() ? 'Your leg is in.' : `${data.name(target)}\u2019s leg is in.`, {icon: 'check'});
    fill(ctx);
  } else ui.toast(SAVE_MSG[r] || SAVE_MSG.failed, {icon: 'info'});
}
async function removeLeg(ctx, st) {
  const target = st.target || data.me();
  if (!target || st.busy) return;
  st.busy = true;
  const r = await live.setLeg(target, null);
  st.busy = false;
  if (r === 'ok' || r === 'dev') { st.editing = false; st.draft = null; ui.toast('Leg removed.'); fill(ctx); }
  else ui.toast(SAVE_MSG[r] || SAVE_MSG.failed, {icon: 'info'});
}

/** Prefetched at idle after launch (app.js), so the first visit opens filled in. */
export function warm() { return loadLay(); }

// Tab badge (app.js): a dot on the tab until this phone has opened it once, so newcomers find the tab past the edge.
const SEEN_KEY = 'gg-lay-seen';
export function badge() { return ui.lsGet(SEEN_KEY) !== '1'; }
function markSeen() {
  if (ui.lsGet(SEEN_KEY) === '1') return;
  ui.lsSet(SEEN_KEY, '1');
  dispatchEvent(new Event('gg:badge'));
}

export default {
  id: 'lay',
  title: 'The Lay',

  render() {
    return ui.largeTitle({eyebrow: eyebrow(), title: 'The Lay', subtitle: subtitle(), trailing: youButtonHTML()})
      + `<div class="ly-body">${bodyHTML({})}</div>`;
  },

  mount(el, ctx) {
    const st = {el, body: el.querySelector('.ly-body'), target: null, editing: false, draft: null, busy: false, stops: []};
    ST.set(ctx, st);
    watchLive(ctx, st);
    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-ly-retry]')) { st.body.innerHTML = bodyHTML(st); fetchAndFill(ctx, {fresh: true}); return; }
      if (t.closest('[data-ly-edit]')) { st.editing = true; st.draft = null; fill(ctx); focusInput(st); return; }
      if (t.closest('[data-ly-cancel]')) { st.editing = false; st.draft = null; fill(ctx); return; }
      if (t.closest('[data-ly-remove]')) { removeLeg(ctx, st); return; }
      const f = t.closest('[data-ly-for]');
      if (f) {
        ui.pickManager({title: 'Whose leg?', selected: st.target || data.me(), note: 'Enter a leg for someone who isn\u2019t on the app.', returnFocus: f}).then(id => {
          if (!id || id === 'none') return;
          st.target = id === data.me() ? null : id;
          st.editing = false; st.draft = null;
          fill(ctx);
          focusInput(st);
        });
      }
    });
    el.addEventListener('input', e => {
      if (!e.target.closest('.ly-in')) return;
      const r = st.body.querySelector('[data-ly-read]');
      if (r) r.innerHTML = readHTML(e.target.value);
    });
    el.addEventListener('submit', e => {
      if (!e.target.closest('[data-ly-form]')) return;
      e.preventDefault();
      submitLeg(ctx, st);
    });
    if (!LAY) fetchAndFill(ctx);
    if (ctx.first) ui.stagger(el);
    if (ctx.visible) markSeen();
  },

  // Back on the tab: results in data/lay.json may have changed (refetched at most once every 2 minutes).
  onShow(ctx) {
    markSeen();
    if (Date.now() - layAt > 2 * 60e3) { layAt = Date.now(); loadLay({fresh: true}).then(() => fill(ctx), () => {}); }
  },

  // 'data' (league.json reloaded: maybe a new week) refetches the slip too; 'me' redraws the highlights.
  update(ctx) {
    if (ctx.reason === 'data') {
      const st = ST.get(ctx), lw = live.liveWeek();
      if (st && (!lw || wkey(lw.year, lw.week) !== st.liveKey)) watchLive(ctx, st);
      fetchAndFill(ctx, {fresh: true});
      return;
    }
    fill(ctx);
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (st) st.stops.forEach(f => f());
    ST.delete(ctx);
  }
};
