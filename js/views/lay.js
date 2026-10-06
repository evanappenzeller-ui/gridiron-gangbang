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
// The leg box reads nicknames and short names ("CMC", "JSN", "Bijan", "Joey B") as the player's real name, and
// autofills like a search box: players and teams while a name is typed, then bets for that player or team.
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

// The live tracker, laid out like a sportsbook slip: one card, the legs grouped under their game (the teams, the
// score and the clock, or the kickoff), each leg a status ring, the pick in bold and its market, then who it's for and
// where it stands ("38 rec yds · needs 50+") with a thin bar toward the number. Scored by core/laytrack.js; a result
// in data/lay.json wins. Once legs close (Sunday 1:00 PM ET, the main slate) it leads the tab.
const ST_TXT = {live: 'Live', pre: 'Not started', na: 'Not tracked', hit: 'Hit', miss: 'Missed'};
const ORDER = {live: 0, pre: 1, na: 2, hit: 3, miss: 4};
function trackRows(w) {
  return legsOf(w).map(l => ({l, r: settled(l) && !l.auto ? {st: l.hit ? 'hit' : 'miss', note: 'Settled by the league'} : (l.trk || {st: 'pre', note: 'Waiting on the games'})}));
}
function barHTML(r) {
  if (r.v == null || r.n == null || !(r.n > 0) || r.st === 'hit' || r.st === 'miss') return '';
  const f = Math.max(0, Math.min(1, r.v / r.n));
  return `<div class="lv-bar${r.op === 'lt' && r.v >= r.n ? ' is-over' : ''}" role="img" aria-label="${esc(`${r.v} of ${r.n}`)}"><i style="--f:${f}"></i></div>`;
}
const RING = {hit: 'check', miss: 'x'};
// What's left of a leg's note once the game header has the score and the clock.
function legNote(r) {
  if (r.st === 'pre') return '';
  return String(r.note || '').split(' · ').filter(x => x && !/^(Q\d|QOT|Half|Final|Live)\b/.test(x) && !/^[A-Z]{2,3} \d+–\d+ [A-Z]{2,3}$/.test(x) && !/^[A-Z]{2,3} ([+−]?[\d.]+|PK)$/.test(x)).join(' · ');
}
function slipLeg({l, r}, me) {
  const g = r.game, games = g ? [g] : weekGames();
  const parts = track.slipParts(l.bet, games);
  const adminEdit = l.live && live.isAdmin(me) ? `<button type="button" class="lv-edit" data-ly-admin-edit="${esc(l.by)}" aria-label="Edit ${esc(data.name(l.by))}\u2019s leg">Edit</button>` : '';
  const bet = parts ? `<b>${esc(parts.pick)}</b><span class="lv-sep" aria-hidden="true">|</span>${esc(parts.market)}` : `<b>${esc(l.bet || '—')}</b>`;
  const note = legNote(r);
  const ring = `<span class="lv-ring is-${r.st}" aria-hidden="true">${RING[r.st] ? ui.icon(RING[r.st]) : ''}</span>`;
  const label = `${data.name(l.by)}: ${parts ? parts.pick + ' ' + parts.market : l.bet}. ${ST_TXT[r.st]}. ${r.note || ''}`;
  return `<li class="lv-leg is-${r.st}${l.by === me ? ' is-me' : ''}" aria-label="${esc(label)}">${ring}`
    + `<div class="lv-lm"><p class="lv-lt">${bet}</p>`
    + `<p class="lv-ls"><span class="lv-who">${esc(data.name(l.by))}${l.for ? ` for ${esc(data.name(l.for))}` : ''}</span>${note ? ` · ${esc(note)}` : ''}</p>`
    + barHTML(r) + `</div>${adminEdit}</li>`;
}
function gameHead(g) {
  if (!g) return `<p class="lv-gh"><span class="lv-gt">Not matched to a game yet</span></p>`;
  const side = t => `${esc(t.abbr)} ${esc(t.short || '')}${g.state === 'pre' ? '' : ` <span class="n5">${t.score || 0}</span>`}`;
  const st = g.state === 'in' ? ' is-live' : g.state === 'post' ? ' is-final' : '';
  return `<p class="lv-gh"><span class="lv-gt">${side(g.away)} @ ${side(g.home)}</span><span class="lv-gc${st}">${esc(track.gameClock(g))}</span></p>`;
}
// preview: before legs close, under the week card (no placer line: the card above has it).
function trackerHTML(w, me, {preview} = {}) {
  const rows = trackRows(w), n = k => rows.filter(x => x.r.st === k).length;
  const hit = n('hit'), miss = n('miss'), going = n('live'), left = rows.length - hit - miss - going, st = statusOf(w);
  // Games in kickoff order (live ones first); legs we can't place on a game last.
  const groups = new Map();
  rows.forEach(x => { const k = x.r.game ? x.r.game.id : ''; if (!groups.has(k)) groups.set(k, {g: x.r.game || null, rows: []}); groups.get(k).rows.push(x); });
  const rank = g => !g ? 3 : g.state === 'in' ? 0 : g.state === 'pre' ? 1 : 2;
  const list = [...groups.values()].sort((a, b) => rank(a.g) - rank(b.g) || (a.g && b.g ? a.g.kickoff - b.g.kickoff : 0));
  const body = list.map(G => `<div class="lv-game">${gameHead(G.g)}<ul class="lv-legs">`
    + G.rows.sort((a, b) => ORDER[a.r.st] - ORDER[b.r.st] || data.name(a.l.by).localeCompare(data.name(b.l.by))).map(x => slipLeg(x, me)).join('')
    + `</ul></div>`).join('');
  const p = placerOf(w);
  const pill = st === 'bust' ? ['Busted', 'wrong'] : st === 'hit' ? ['Cashed', 'gold'] : going || hit ? ['Live', 'tint'] : ['Open', 'neutral'];
  const counts = [hit && `${hit} hit`, going && `${going} live`, left && `${left} to go`, miss && `${miss} missed`].filter(Boolean).join(' · ');
  return `<section class="card card-hero lv-slip is-${st}" aria-label="Live tracker">`
    + `<div class="lv-sh"><span class="lv-tag">Week ${w.week}</span><h2 class="lv-head">Live Tracker</h2>${ui.pill(pill[0], {tone: pill[1]})}</div>`
    + `<p class="lv-meta"><b>${rows.length} ${rows.length === 1 ? 'Leg' : 'Legs'}</b><span class="lv-sep" aria-hidden="true">|</span>Wager <b>${money(STAKE())}</b>`
    + (p && !preview ? `<span class="lv-sep" aria-hidden="true">|</span>${esc(data.name(p.id).split(' ')[0])} places it` : '') + `</p>`
    + (counts ? `<p class="lv-counts">${esc(counts)}</p>` : '')
    + `<div class="lv-games">${body}</div>`
    + `<p class="lv-foot-note">Live from ESPN every 30 seconds during games. Final once the league confirms.</p></section>`;
}

// "Your leg": enter, change or remove your leg for the live week (or someone else's: st.target).
// bare: the "Your leg" part only (sub-headed), for the combined week card (weekCardHTML).
function entryHTML(st, me, {bare} = {}) {
  const lw = live.liveWeek();
  if (!lw) return '';
  const w = WEEKS.find(x => x.year === lw.year && x.week === lw.week);
  const shut = live.isClosed(lw.year, lw.week), admin = live.isAdmin(me);
  const closed = shut && !admin; // the admin can still change legs after they close
  const target = st.target || me;
  const leg = legOf(w, target);
  const ovl = `<p class="card-ovl">Week ${lw.week} · ${shut ? 'Legs closed' : 'Closes ' + esc(live.closeText(lw.year, lw.week))}${admin ? ' · Admin' : ''}</p>`;
  // Only the admin enters or changes someone else's leg.
  const forLink = !admin ? '' : st.target && st.target !== me
    ? `<button type="button" class="btn btn-plain ly-for" data-ly-mine>Back to your leg</button>`
    : `<button type="button" class="btn btn-plain ly-for" data-ly-for>Edit someone else\u2019s leg</button>`;
  let inner;
  if (!target) {
    inner = `<h2 class="card-title">Add your leg</h2><p class="card-body">Pick who you are first, so your leg goes in your slot.</p>`
      + `<div class="ly-acts">${ui.button({label: 'Pick who you are', kind: 'primary', size: 's', attrs: {'data-you': ''}})}</div>`;
  } else if (leg && (!st.editing || closed || !leg.live)) {
    const mine = target === me;
    inner = `<h2 class="card-title">${mine ? 'Your leg' : esc(data.name(target)) + '\u2019s leg'}</h2>`
      + ui.group(legRow(leg, me), {cls: 'ly-legs ly-mine'})
      + (closed || !leg.live ? '' : `<div class="ly-acts">${ui.button({label: 'Edit', kind: 'secondary', size: 's', attrs: {'data-ly-edit': ''}})}${ui.button({label: 'Remove', kind: 'plain', size: 's', attrs: {'data-ly-remove': ''}})}</div>`);
  } else if (closed) {
    inner = `<h2 class="card-title">${target === me ? 'No leg from you' : 'No leg from ' + esc(data.name(target))}</h2><p class="card-body">Legs for Week ${lw.week} closed ${esc(live.closeText(lw.year, lw.week))}.</p>`;
  } else {
    const val = st.draft != null ? st.draft : (leg ? leg.bet : '');
    inner = `<h2 class="card-title">${target === me ? 'Your leg' : 'Leg for ' + esc(data.name(target))}</h2>`
      + `<form class="ly-form" data-ly-form autocomplete="off">`
      + `<label class="ly-who">${ui.avatar(target, {size: 24, you: target === me})}<span>${esc(data.name(target))}</span></label>`
      + `<div class="ly-field" data-ly-field><input class="ly-in" name="bet" type="text" maxlength="${live.BET_MAX}" enterkeyhint="send" autocapitalize="words" autocorrect="off" spellcheck="false" placeholder="e.g. CMC anytime TD" aria-label="Your leg" aria-describedby="ly-read" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ly-sug" value="${esc(val)}">`
      + `<ul class="ly-sug" id="ly-sug" role="listbox" aria-label="Suggestions" data-ly-sug hidden></ul></div>`
      + `<p class="ly-read${unread(val) ? ' is-unread' : ''}" id="ly-read" data-ly-read aria-live="polite">${readHTML(val)}</p>`
      + `<div class="ly-acts">${ui.button({label: leg ? 'Save change' : 'Submit leg', kind: 'primary', size: 's', type: 'submit', attrs: {'data-ly-submit': ''}})}${leg ? ui.button({label: 'Cancel', kind: 'plain', size: 's', attrs: {'data-ly-cancel': ''}}) : ''}</div>`
      + `</form>`;
  }
  const off = liveErr === 'denied' ? `<p class="ly-note">Saving legs isn't switched on in the database yet.</p>` : '';
  if (bare) return `<div class="ly-yours ly-entry">${inner}${off}${forLink}</div>`;
  return `<section class="card ly-entry" aria-label="Your leg">${ovl}${inner}${off}${forLink}</section>`;
}

// Before legs close: one card for the week. Your leg first (the box to enter it, or your leg with Edit and Remove),
// then the league's progress: how many legs are in, who is missing, and who places it.
function weekCardHTML(st, me) {
  const lw = live.liveWeek(), w = currentWeek();
  const t = tally(w), size = SIZE(), miss = missingOf(w);
  return `<section class="card card-hero ly-hero ly-week-card ly-${statusOf(w)}" aria-label="Week ${w.week}">`
    + `<div class="ly-hero-top"><p class="card-ovl">Week ${w.week} · Closes ${esc(live.closeText(lw.year, lw.week))}</p>${ui.pill(`${t.n}/${size} in`, {tone: t.n >= size ? 'tint' : 'neutral', icon: 'clock'})}</div>`
    + entryHTML(st, me, {bare: true})
    + `<div class="ly-progress"><h3 class="ly-sub-t">League progress</h3>`
    + `<div class="ly-meter" role="img" aria-label="${t.n} of ${size} legs in"><i style="--f:${Math.min(1, t.n / size)}"></i></div>`
    + `<p class="ly-meter-lb"><b>${t.n} of ${size}</b> legs in${miss.length ? ` · <span class="ly-waiting-i">waiting on ${esc(miss.map(data.name).join(', '))}</span>` : ''}</p>`
    + placerLine(w)
    + `</div></section>`;
}

// The entry's preview: the leg in standard wording (what gets saved and tracked), or how to word it.
const weekGames = () => { const lw = live.liveWeek(), T = lw && TRK.get(wkey(lw.year, lw.week)); return T ? T.games : null; };
// Not readable (yet): the hint hides while the autofill list is open.
const unread = text => !!String(text || '').trim() && !track.describe(text, weekGames());
function setRead(st, text) {
  const r = st.body.querySelector('[data-ly-read]');
  if (!r) return;
  r.innerHTML = readHTML(text);
  r.classList.toggle('is-unread', unread(text));
}
function readHTML(text) {
  if (!String(text || '').trim()) return `<span class="ly-read-hint">Type it the way you'd say it. We'll write it up as the real bet and track it live.</span>`;
  const d = track.describe(text, weekGames());
  if (d && track.needsLine(text)) return `${ui.icon('check-circle', {size: 16})}<span>Saves as <b>${esc(d)}</b>. <span class="ly-read-hint">Add the book's number (like "Over 4.5") and it settles itself; without one we track it live and the league settles it.</span></span>`;
  if (d) return `${ui.icon('check-circle', {size: 16})}<span>Saves as <b>${esc(d)}</b></span>`;
  return `${ui.icon('info', {size: 16})}<span class="ly-read-hint">Can't read this one for live tracking, so it saves as typed. Try "Player 50+ Rec Yards", "CMC anytime TD" or "Bills -3.5".</span>`;
}

// ---------------------------------------------------------------------------------------------- Autofill
// Suggestions under the leg box as it's typed, like a search box: players and teams while a name is typed (picking one
// fills the name and shows bets for him), then whole bets. What you typed stays plain, the rest of each one is bold.
const SUG_MAX = 5;
const SUG_IC = {player: 'person', team: 'shield', bet: 'search'};
function sugLabel(label, typed) {
  const toks = String(typed).toLowerCase().split(/\s+/).map(t => t.replace(/\+$/, '')).filter(Boolean);
  return label.split(' ').map(w => {
    const i = toks.findIndex(t => w.toLowerCase().startsWith(t));
    if (i < 0) return `<b>${esc(w)}</b>`;
    const n = toks.splice(i, 1)[0].length;
    return esc(w.slice(0, n)) + (n < w.length ? `<b>${esc(w.slice(n))}</b>` : '');
  }).join(' ');
}
function sugHTML(list, typed) {
  return list.map((s, i) => `<li class="ly-opt" role="option" id="ly-opt-${i}" aria-selected="false" data-ly-opt="${i}">`
    + `<span class="ly-opt-ic">${ui.icon(SUG_IC[s.kind] || 'search')}</span>`
    + `<span class="ly-opt-mid"><span class="ly-opt-t">${sugLabel(s.label, typed)}</span>${s.sub ? `<span class="ly-opt-s">${esc(s.sub)}</span>` : ''}</span>`
    + (/\s$/.test(s.text) ? `<span class="ly-opt-go">${ui.icon('chevron-right')}</span>` : '') + `</li>`).join('');
}
// (Re)draws the list for the box's text; nothing to offer (or only what's already typed) closes it.
function showSug(st) {
  const inp = st.body.querySelector('.ly-in'), ul = st.body.querySelector('[data-ly-sug]');
  if (!inp || !ul) return;
  const typed = inp.value;
  const norm = x => x.trim().toLowerCase().replace(/\s+/g, ' ');
  // (not what's already typed, nor what it already saves as)
  const d = typed.trim() && track.describe(typed, weekGames());
  const list = typed.trim() ? track.suggest(typed, weekGames(), SUG_MAX).filter(s => norm(s.text) !== norm(typed) && (!d || norm(s.text) !== norm(d))) : [];
  const was = !ul.hidden;
  st.sug = list; st.sugAt = -1;
  inp.removeAttribute('aria-activedescendant');
  if (!list.length) { hideSug(st); return; }
  ul.innerHTML = sugHTML(list, typed);
  ul.hidden = false;
  inp.setAttribute('aria-expanded', 'true');
  inp.closest('[data-ly-field]').classList.add('is-open');
  if (!was) keepInView(ul);
}
function hideSug(st) {
  const inp = st.body.querySelector('.ly-in'), ul = st.body.querySelector('[data-ly-sug]');
  st.sug = []; st.sugAt = -1;
  if (ul) { ul.hidden = true; ul.innerHTML = ''; ul.closest('[data-ly-field]').classList.remove('is-open'); }
  if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); }
}
const sugOpen = st => !!(st.sug && st.sug.length);
function moveSug(st, d) {
  const n = st.sug.length, inp = st.body.querySelector('.ly-in');
  st.sugAt = st.sugAt < 0 ? (d > 0 ? 0 : n - 1) : (st.sugAt + d + n) % n;
  st.body.querySelectorAll('[data-ly-opt]').forEach((li, i) => { li.classList.toggle('is-active', i === st.sugAt); li.setAttribute('aria-selected', String(i === st.sugAt)); });
  inp.setAttribute('aria-activedescendant', 'ly-opt-' + st.sugAt);
  const li = st.body.querySelector('#ly-opt-' + st.sugAt);
  if (li) li.scrollIntoView({block: 'nearest'});
}
// A player or a team (or a bet still missing its number) fills the box and keeps going; a whole bet fills the box,
// ready to submit.
function pickSug(st, i) {
  const s = st.sug[i], inp = st.body.querySelector('.ly-in');
  if (!s || !inp) return;
  inp.value = s.text;
  inp.focus();
  try { inp.setSelectionRange(s.text.length, s.text.length); } catch (_) {}
  setRead(st, s.text);
  ui.haptic('light');
  if (/\s$/.test(s.text)) showSug(st); else hideSug(st);
}
// Opening under the keyboard: scroll the screen so the list shows, keeping the box on screen.
function keepInView(ul) {
  const sc = ul.closest('.screen'), field = ul.closest('[data-ly-field]');
  if (!sc || !field) return;
  const vv = window.visualViewport, top = vv ? vv.offsetTop : 0, bottom = top + (vv ? vv.height : innerHeight);
  const over = ul.getBoundingClientRect().bottom - bottom + 12, room = field.getBoundingClientRect().top - top - 64;
  if (over > 0 && room > 0) sc.scrollBy({top: Math.min(over, room), behavior: ui.RM ? 'auto' : 'smooth'});
}

// While the box is typed in, a redraw (live scores, someone else's leg) keeps the box itself (focus, keyboard,
// cursor, the open list) and swaps in everything around it. False when the new markup has no box in the same place.
function swapAround(root, html, keep) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const nu = tpl.content.querySelector('[data-ly-field]');
  const path = (top, el) => { const p = []; for (let e = el; e && e !== top; e = e.parentNode) p.unshift(e); return p; };
  const a = path(root, keep), b = nu ? path(tpl.content, nu) : [];
  if (!nu || !a.length || a[0].parentNode !== root || a.length !== b.length || a.some((e, i) => e.tagName !== b[i].tagName)) return false;
  let op = root, np = tpl.content;
  a.forEach((o, i) => {
    const n = b[i], kids = [...np.childNodes], at = kids.indexOf(n);
    [...op.childNodes].forEach(c => { if (c !== o) c.remove(); });
    kids.slice(0, at).forEach(c => op.insertBefore(c, o));
    kids.slice(at + 1).forEach(c => op.appendChild(c));
    if (o !== keep) {
      [...o.attributes].forEach(x => { if (!n.hasAttribute(x.name)) o.removeAttribute(x.name); });
      [...n.attributes].forEach(x => o.setAttribute(x.name, x.value));
    }
    op = o; np = n;
  });
  return true;
}

function tilesHTML() {
  const done = WEEKS.filter(w => statusOf(w) === 'hit' || statusOf(w) === 'bust');
  let n = 0, h = 0;
  WEEKS.forEach(w => legsOf(w).forEach(l => { if (settled(l)) { n++; if (l.hit) h++; } }));
  const best = done.reduce((b, w) => { const t = tally(w); return !b || t.hit > b.hit ? {hit: t.hit, n: t.n, week: w.week} : b; }, null);
  return `<div class="tiles ly-tiles">`
    + ui.statTile({label: 'Legs hit', value: n ? `${Math.round(h / n * 100)}%` : '—', sub: n ? `${h} of ${n}` : ''})
    + ui.statTile({label: 'Best slip', value: best ? `${best.hit}/${best.n}` : '—', sub: best ? `Week ${best.week}` : ''})
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
    return `<details class="card ly-slip is-${st}" data-ly-slip="${w.year}-${w.week}"><summary class="ly-slip-h">`
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
  if (tracking) return (live.isAdmin(me) && (st || {}).editing ? entryHTML(st, me) : '') + trackerHTML(w, me) + tilesHTML() + recordsHTML(me) + weeksHTML(me);
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
  // Slips left open stay open through the redraws (every 30 seconds while games are on).
  const open = [...st.body.querySelectorAll('[data-ly-slip][open]')].map(d => d.dataset.lySlip);
  const html = bodyHTML(st);
  const kept = focused && swapAround(st.body, html, inp.closest('[data-ly-field]'));
  if (!kept) { st.body.innerHTML = html; st.sug = []; st.sugAt = -1; }
  open.forEach(k => { const d = st.body.querySelector(`[data-ly-slip="${k}"]`); if (d) d.open = true; });
  // Props whose player has no box score yet: look up his team (rosters) so the leg shows its game; redraw when found.
  WEEKS.forEach(w => {
    const T = w.tracked && TRK.get(wkey(w.year, w.week));
    const p = T && track.lookupPlayers(legsOf(w).filter(l => !settled(l)).map(l => l.bet), T);
    if (p) p.then(found => { if (found && ST.get(ctx) === st) fill(ctx); }, () => {});
  });
  const inp2 = st.body.querySelector('.ly-in');
  if (kept) { setRead(st, inp.value); if (sugOpen(st) && st.sugAt < 0) showSug(st); }
  else if (inp2 && focused) { inp2.focus(); try { inp2.setSelectionRange(inp2.value.length, inp2.value.length); } catch (_) {} }
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
const SAVE_MSG = {notyours: 'Only Evan can change someone else\u2019s leg.', closed: 'Legs are closed for this week.', invalid: 'Type a leg first.', denied: 'Saving legs isn\u2019t switched on yet.', failed: 'Couldn\u2019t save. Check your connection.'};
async function submitLeg(ctx, st) {
  if (st.busy) return;
  const inp = st.body.querySelector('.ly-in'), btn = st.body.querySelector('[data-ly-submit]');
  const target = st.target || data.me();
  const typed = inp ? inp.value.trim() : '';
  const bet = (typed && track.describe(typed, weekGames())) || typed;
  if (!target) return;
  if (!bet) { if (inp) { ui.shake(inp); inp.focus(); } return; }
  hideSug(st);
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
export function warm() { track.loadPlayers().catch(() => {}); return loadLay(); }

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
    const st = {el, body: el.querySelector('.ly-body'), target: null, editing: false, draft: null, busy: false, stops: [], sug: [], sugAt: -1};
    ST.set(ctx, st);
    watchLive(ctx, st);
    // The player list (nicknames, short names, autofill): legs already in redraw with real names once it's here.
    track.loadPlayers().then(() => { if (ST.get(ctx) === st && LAY) fill(ctx); }, () => {});
    el.addEventListener('click', e => {
      const t = e.target;
      const opt = t.closest('[data-ly-opt]');
      if (opt) { pickSug(st, +opt.dataset.lyOpt); return; }
      if (t.closest('[data-ly-retry]')) { st.body.innerHTML = bodyHTML(st); fetchAndFill(ctx, {fresh: true}); return; }
      if (t.closest('[data-ly-edit]')) { st.editing = true; st.draft = null; fill(ctx); focusInput(st); return; }
      if (t.closest('[data-ly-cancel]')) { st.editing = false; st.draft = null; fill(ctx); return; }
      if (t.closest('[data-ly-remove]')) { removeLeg(ctx, st); return; }
      if (t.closest('[data-ly-mine]')) { st.target = null; st.editing = false; st.draft = null; fill(ctx); return; }
      // Admin: Edit on a tracker card opens that leg in the entry card at the top.
      const ae = t.closest('[data-ly-admin-edit]');
      if (ae) {
        const by = ae.dataset.lyAdminEdit;
        st.target = by === data.me() ? null : by; st.editing = true; st.draft = null;
        fill(ctx);
        const card = st.body.querySelector('.ly-entry');
        if (card) card.scrollIntoView({block: 'start', behavior: ui.RM ? 'auto' : 'smooth'});
        focusInput(st);
        return;
      }
      const f = t.closest('[data-ly-for]');
      if (f) {
        ui.pickManager({title: 'Whose leg?', selected: st.target || data.me(), note: 'Admin: enter, change or remove any league member\u2019s leg.', returnFocus: f}).then(id => {
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
      setRead(st, e.target.value);
      showSug(st);
    });
    // Autofill: arrows move through the list, Enter takes the highlighted one, Escape closes it. A tap on the list
    // must not take focus from the box (the keyboard stays up).
    el.addEventListener('keydown', e => {
      if (!e.target.closest('.ly-in') || !sugOpen(st)) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); moveSug(st, e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Enter' && st.sugAt >= 0 && !e.isComposing) { e.preventDefault(); pickSug(st, st.sugAt); }
      else if (e.key === 'Escape') { e.preventDefault(); hideSug(st); }
    });
    el.addEventListener('pointerdown', e => { if (e.target.closest('[data-ly-sug]')) e.preventDefault(); });
    el.addEventListener('mousedown', e => { if (e.target.closest('[data-ly-sug]')) e.preventDefault(); });
    el.addEventListener('focusin', e => {
      // Back in a half-typed box: offer the list again (not for a leg that already reads as a full bet).
      if (e.target.closest('.ly-in') && unread(e.target.value)) showSug(st);
    });
    el.addEventListener('focusout', e => {
      if (!e.target.closest('.ly-in')) return;
      setTimeout(() => { const i = st.body.querySelector('.ly-in'); if (!i || document.activeElement !== i) hideSug(st); }, 150);
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
