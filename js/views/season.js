// Season page (#/standings/:year[/weeks[/:week]|/bracket]): Table (podium, rows, lines), Weeks (scoreboard)
// and Bracket. Owner: standings package. Spec 7.10.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as stats from '../core/stats.js';
import {openMatchup, crownWinner, gameBadges, seedsOf, ROUND_NAME} from './matchup.js';

const esc = data.esc;
const S = new WeakMap();          // per-screen state, keyed by ctx
const podiumPlayed = new Set();   // years whose podium entrance already played this session

const isReg = g => !g.type || g.type === 'reg';
const ORDER = {final: 0, third: 1, semi: 2, quarter: 3, reg: 4, consol: 5};
const n2 = v => Number(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

// ---------------------------------------------------------------- Derivations
function weeksOf(s) { return [...new Set(s.games.map(g => g.week))].sort((a, b) => a - b); }
function weekKind(s, w) {
  const t = new Set(s.games.filter(g => g.week === w).map(g => g.type || 'reg'));
  return t.has('final') ? 'final' : t.has('semi') ? 'semi' : t.has('quarter') ? 'quarter' : 'reg';
}
const CHIP = {quarter: 'QF', semi: 'SF', final: 'Final'};
const HEAD = {quarter: 'Quarterfinals', semi: 'Semifinals', final: 'Championship'};
const weekChip = (s, w) => CHIP[weekKind(s, w)] || `W${w}`;
const weekHead = (s, w) => { const k = HEAD[weekKind(s, w)]; return k ? `${k} · Week ${w}` : `Week ${w}`; };
const hasBracket = s => !!s && !s.live && s.games.some(g => g.playoff);
function defaultWeek(s, weeks) {
  if (!weeks.length) return null;
  if (s.live) { const tw = data.throughWeek(s); return weeks.includes(tw) ? tw : weeks[weeks.length - 1]; }
  const f = s.games.find(g => g.type === 'final');
  return f ? f.week : weeks[weeks.length - 1];
}
// Playoff shape from the data (this season, or the latest completed one while a season is in progress).
function shape(s) {
  const ref = (!s.live && s.playoffTeams.size) ? s : data.DONE.find(x => x.playoffTeams && x.playoffTeams.size);
  if (!ref) return {cut: 0, byes: 0};
  const q = new Set(ref.games.filter(g => g.type === 'quarter').flatMap(g => [g.a, g.b]));
  const cut = ref.playoffTeams.size;
  return {cut, byes: q.size ? Math.max(0, cut - q.size) : 0};
}

function resolve(params) {
  const year = Number(params.year);
  const s = data.seasonByYear(year);
  if (!s) return {year, s: null};
  const weeks = weeksOf(s);
  let seg = params.seg === 'weeks' || params.seg === 'bracket' ? params.seg : 'table';
  if (seg === 'bracket' && !hasBracket(s)) seg = 'table';
  let week = null;
  if (seg === 'weeks') week = weeks.includes(Number(params.week)) ? Number(params.week) : defaultWeek(s, weeks);
  return {year, s, seg, week, weeks};
}
function pathFor(year, seg, week) {
  if (seg === 'weeks') return `/standings/${year}/weeks${week != null ? '/' + week : ''}`;
  if (seg === 'bracket') return `/standings/${year}/bracket`;
  return `/standings/${year}`;
}

// ---------------------------------------------------------------- Header, chips, accessory
function headInner(R) {
  const s = R.s;
  const tw = data.throughWeek(s);
  const sub = s.live ? (tw ? `In progress · through week ${tw}` : `In progress · no games yet`)
    : s.champion ? `Won by ${data.name(s.champion)} · ${data.teamIn(s, s.champion)}` : '';
  return ui.largeTitle({title: String(R.year), subtitle: sub, trailing: s.live ? ui.badge('progress') : ''});
}
function yearsHtml(R) {
  const items = data.SEASONS.map(x => ({id: x.year, label: String(x.year), dot: x.live}));
  return ui.chips({name: 'year', label: 'Season', items, value: R.year});
}
const segItems = s => [{id: 'table', label: 'Table'}, {id: 'weeks', label: 'Weeks'}].concat(hasBracket(s) ? [{id: 'bracket', label: 'Bracket'}] : []);
const segHtml = R => ui.seg({name: 'seg', label: 'Season view', items: segItems(R.s), value: R.seg});
function scrubHtml(R) {
  if (!R.weeks.length) return '';
  const i = R.weeks.indexOf(R.week);
  return `<div class="sea-scrub">`
    + ui.iconButton({icon: 'chevron-left', label: 'Previous week', attrs: {'data-wk': '-1'}, disabled: i <= 0, cls: 'sea-step'})
    + ui.chips({name: 'week', label: 'Week', items: R.weeks.map(w => ({id: w, label: weekChip(R.s, w)})), value: R.week})
    + ui.iconButton({icon: 'chevron-right', label: 'Next week', attrs: {'data-wk': '1'}, disabled: i < 0 || i >= R.weeks.length - 1, cls: 'sea-step'})
    + `</div>`;
}

// ---------------------------------------------------------------- Table
function podiumHtml(s) {
  const spot = (id, place) => {
    if (!id) return `<div class="pod pod-${place} is-empty" aria-hidden="true"><span class="pod-base"><span class="pod-plinth"></span></span></div>`;
    const nm = data.name(id), tm = data.teamIn(s, id);
    const role = place === 1 ? 'Champion' : place === 2 ? 'Runner-up' : 'Third place';
    const av = ui.avatar(id, {size: place === 1 ? 72 : 56, hero: place === 1, champ: place === 1, crown: place === 1, attrs: {'data-morph-from': ''}});
    return `<a class="pod pod-${place}" href="#/managers/${esc(id)}" aria-label="${esc(`${role}: ${nm}, ${tm}`)}">`
      + `<span class="pod-who"><span class="pod-av">${av}</span><span class="pod-name">${esc(nm)}</span><span class="pod-team">${esc(tm)}</span></span>`
      + `<span class="pod-base" aria-hidden="true"><span class="pod-plinth"><span class="${place === 1 ? 'n3' : 'n4'}">${place}</span></span></span></a>`;
  };
  const worst = s.lastPlace ? `<p class="sea-worst">${ui.icon('anchor', {size: 14})}<span>Worst record: ${esc(data.name(s.lastPlace))}</span></p>` : '';
  return `<div data-enter><div class="sea-podium" data-year="${s.year}">${spot(s.runnerUp, 2)}${spot(s.champion, 1)}${spot(s.thirdPlace, 3)}</div>${worst}</div>`;
}

function seasonRow(s, r, me) {
  const id = r.id;
  const nm = data.name(id), tm = data.teamIn(s, id);
  const rec = data.recStr(r.w, r.l, r.t);
  const fin = s.live ? null : data.finishOf(s, id);
  const finTxt = {champion: 'champion', runnerUp: 'runner-up', third: 'third place', playoffs: 'made the playoffs', last: 'worst record', missed: 'missed the playoffs'}[fin] || '';
  const label = `${s.live ? 'Rank' : 'Seed'} ${r.seed}, ${nm}, ${tm}, ${rec}${finTxt ? ', ' + finTxt : ''}. Points for ${n2(r.pf)}, against ${n2(r.pa)}.`;
  return `<a class="row sea-row${id === me ? ' is-me' : ''}" href="#/managers/${esc(id)}" data-key="${esc(id)}" aria-label="${esc(label)}">`
    + `<span class="row-lead"><span class="sea-seed n5">${r.seed}</span>${ui.avatar(id, {size: 28, you: id === me, attrs: {'data-morph-from': ''}})}</span>`
    + `<span class="row-main"><span class="row-title">${esc(nm)}</span><span class="row-sub">${esc(tm)}</span><span class="row-sub sea-pf">PF ${n2(r.pf)} · PA ${n2(r.pa)}</span></span>`
    + `<span class="row-trail sea-trail"><span class="n4">${rec}</span>${fin ? ui.badge(fin) : ''}</span></a>`;
}
const lineHtml = label => `<div class="sea-line" role="separator" aria-label="${esc(label)}"><span>${esc(label)}</span></div>`;

function tableHtml(R) {
  const s = R.s;
  if (!s.table.length) return ui.empty({icon: 'calendar', title: 'No games yet.', body: 'The table fills in after week 1.'});
  const me = data.me();
  const {cut, byes} = shape(s);
  let rows = '';
  s.table.forEach((r, i) => {
    rows += seasonRow(s, r, me);
    const last = i === s.table.length - 1;
    if (!last && !s.live && byes > 0 && r.seed === byes) rows += lineHtml('Bye line');
    if (!last && cut > 0 && r.seed === cut) rows += lineHtml('Playoff line');
  });
  return (!s.live && s.champion ? podiumHtml(s) : '')
    + `<div data-enter><div class="sea-colh" aria-hidden="true"><span>${s.live ? 'Rank' : 'Seed'}</span><span>Record</span></div>`
    + ui.group(rows, {cls: 'sea-group'})
    + '</div>'
    + (s.live
      ? ''
      : `<a class="card sea-review" href="#/standings/${s.year}/review"><span class="sea-rv-ic" aria-hidden="true">${ui.icon('sparkle', {size: 22})}</span><span class="sea-rv-t"><span class="card-ovl">Season in review</span><span class="card-title">${s.year}: the awards</span></span>${ui.icon('chevron-right', {cls: 'chev'})}</a>`);
}

// ---------------------------------------------------------------- Weeks
function bugCard(s, g, weekGames, {hero = false, foot = true} = {}) {
  const i = s.games.indexOf(g);
  const kinds = gameBadges(g, weekGames);
  // Only playoff and consolation cards carry a round overline; the week header already names a regular week
  // (and a "FINAL" there would read as the championship, which the scrubber calls "Final").
  const footer = !foot || isReg(g) ? '' : ROUND_NAME[g.type] || '';
  const cls = [g.type === 'final' ? 'sea-final' : '', !footer && !kinds.length ? 'is-bare' : ''].filter(Boolean).join(' ');
  let html = ui.scoreBug(g, {
    card: true, hero, teams: true, footer, badges: kinds,
    seeds: g.playoff ? seedsOf(s) : null,
    cls,
    attrs: {'data-game': `${s.year}:${i}`, 'data-enter': '', 'aria-haspopup': 'dialog'}
  });
  if (g.type === 'final' && g.sa !== g.sb) html = crownWinner(html);
  return html;
}

// "Read the Wrap" (the auto-written recap, route /standings/:year/wrap/:week) for every week core/stats.js can
// write one for. Cached per derived season object, so a data reload starts over.
const wrapMemo = new WeakMap(); // season → {weeks: Set, heads: Map(week → headline)}
function wrapOf(s) {
  let m = wrapMemo.get(s);
  if (!m) {
    let list = [];
    try { list = stats.wrapWeeks(s.year) || []; } catch (e) { console.error(e); }
    m = {weeks: new Set(list.map(x => Number(x && typeof x === 'object' ? x.week : x)).filter(Number.isFinite)), heads: new Map()};
    wrapMemo.set(s, m);
  }
  return m;
}
function wrapHead(s, w) {
  const m = wrapOf(s);
  if (!m.weeks.has(w)) return null;
  if (!m.heads.has(w)) {
    let h = '';
    try { const x = stats.wrap(s.year, w); h = (x && x.headline) || ''; } catch (e) { console.error(e); }
    m.heads.set(w, h);
  }
  return m.heads.get(w);
}
// Write the season's other Wraps one per idle callback, so switching weeks never waits on one.
function warmWraps(s) {
  if (!s) return;
  const m = wrapOf(s);
  if (m.warming) return;
  const todo = [...m.weeks].filter(w => !m.heads.has(w)).sort((a, b) => b - a);
  if (!todo.length) return;
  m.warming = true;
  const next = () => {
    const w = todo.shift();
    if (w == null || wrapMemo.get(s) !== m) { m.warming = false; return; }
    wrapHead(s, w);
    ui.onIdle(next);
  };
  ui.onIdle(next);
}
function wrapLinkHtml(s, w) {
  const head = wrapHead(s, w);
  if (head == null) return '';
  return `<a class="card sea-wrap" href="#/standings/${s.year}/wrap/${w}" aria-label="${esc(`Read the Wrap for week ${w}${head ? ': ' + head : ''}`)}">`
    + `<span class="sea-wrap-ic" aria-hidden="true">${ui.icon('football', {size: 22})}</span>`
    + `<span class="sea-wrap-t"><span class="sea-wrap-k">Read the Wrap</span>${head ? `<span class="sea-wrap-h">${esc(head)}</span>` : ''}</span>`
    + `${ui.icon('chevron-right', {cls: 'chev'})}</a>`;
}

function weeksHtml(R) {
  const s = R.s, w = R.week;
  if (!R.weeks.length || w == null) return ui.empty({icon: 'calendar', title: 'No games yet.', body: 'Week 1 shows up here once it has been played.'});
  const games = s.games.filter(g => g.week === w);
  const main = games.filter(g => g.type !== 'consol').sort((a, b) => (ORDER[a.type || 'reg'] - ORDER[b.type || 'reg']));
  const cons = games.filter(g => g.type === 'consol');
  const scores = games.flatMap(g => [{id: g.a, v: g.sa}, {id: g.b, v: g.sb}]);
  const hi = scores.reduce((m, x) => x.v > m.v ? x : m, scores[0]);
  const lo = scores.reduce((m, x) => x.v < m.v ? x : m, scores[0]);
  const sum = hi && lo
    ? `<p class="sea-wk-sum"><span>High <b>${esc(data.name(hi.id))}</b> <span class="num">${ui.score(hi.v)}</span></span><span>Low <b>${esc(data.name(lo.id))}</b> <span class="num">${ui.score(lo.v)}</span></span></p>`
    : '';
  return `<div class="sea-wk-head"><h2 class="ovl">${esc(weekHead(s, w))}</h2>${sum}</div>`
    + wrapLinkHtml(s, w)
    + `<div class="sea-cards">${main.map(g => bugCard(s, g, games)).join('')}</div>`
    + (cons.length ? `<h3 class="sea-subh">Consolation</h3><div class="sea-cards">${cons.map(g => bugCard(s, g, games)).join('')}</div>` : '');
}

// ---------------------------------------------------------------- Bracket
function bracketHtml(R) {
  const s = R.s;
  const {byes} = shape(s);
  const sec = (type, title, note = '') => {
    const gs = s.games.filter(g => g.type === type);
    if (!gs.length) return '';
    const wk = gs[0].week;
    const weekGames = s.games.filter(g => g.week === wk);
    const cards = gs.map(g => bugCard(s, g, weekGames, {hero: type === 'final', foot: false})).join('');
    return `<section class="sea-br${type === 'final' ? ' is-final' : ''}" data-enter aria-label="${esc(`${title}, week ${wk}`)}">`
      + `<span class="sea-br-dot" aria-hidden="true">${type === 'final' ? ui.icon('trophy-fill', {size: 12}) : ''}</span>`
      + `<div class="sea-br-h"><h3>${esc(title)}</h3><span class="ovl">Week ${wk}</span></div>${note}<div class="sea-cards">${cards}</div></section>`;
  };
  const byeIds = s.table.filter(r => r.seed <= byes).map(r => r.id);
  const byeNote = byeIds.length
    ? `<p class="sea-br-note">Byes: ${byeIds.map(id => `<span class="sea-bye">${ui.avatar(id, {size: 20})}${esc(data.name(id))}</span>`).reduce((acc, x, i, arr) => acc + (i === 0 ? '' : i === arr.length - 1 ? ' and ' : ', ') + x, '')}</p>`
    : '';
  return `<div class="sea-bracket">${sec('quarter', 'Quarterfinals', byeNote)}${sec('semi', 'Semifinals')}${sec('final', 'Championship')}${sec('third', 'Third place')}</div>`;
}

function contentHtml(R) {
  if (R.seg === 'weeks') return weeksHtml(R);
  if (R.seg === 'bracket') return bracketHtml(R);
  return tableHtml(R);
}

function unknownHtml(year) {
  const sp = data.span;
  const body = sp.first != null ? `The league's history runs ${sp.first}–${sp.last}.` : '';
  return ui.empty({icon: 'calendar', title: `No ${year} season.`, body, action: {label: 'Back', attrs: 'data-back'}});
}

function renderAll(R) {
  if (!R.s) return unknownHtml(R.year);
  return `<div class="sea-head">${headInner(R)}</div>`
    + `<div class="sea-years">${yearsHtml(R)}</div>`
    + `<div class="accessory sea-acc">${segHtml(R)}${R.seg === 'weeks' ? scrubHtml(R) : ''}</div>`
    + `<div class="sea-content" role="tabpanel" aria-label="${esc(R.seg === 'weeks' ? 'Weeks' : R.seg === 'bracket' ? 'Bracket' : 'Table')}">${contentHtml(R)}</div>`;
}

// ---------------------------------------------------------------- Behavior
function centerChip(rail, value) {
  if (!rail) return;
  const c = rail.querySelector(`.chip[data-value="${CSS.escape(String(value))}"]`);
  if (!c) return;
  const left = c.offsetLeft - (rail.clientWidth - c.offsetWidth) / 2;
  rail.scrollLeft = Math.max(0, left);
}

function playPodium(st) {
  const pod = st.el.querySelector('.sea-podium');
  if (!pod) return;
  const y = Number(pod.dataset.year);
  if (podiumPlayed.has(y)) return;
  podiumPlayed.add(y);
  if (ui.RM) return;
  const order = {2: 1, 1: 0, 3: 2};
  pod.querySelectorAll('.pod').forEach(p => {
    const k = order[(p.className.match(/pod-(\d)/) || [])[1]] || 0;
    const pl = p.querySelector('.pod-plinth');
    const who = p.querySelector('.pod-who');
    if (pl) ui.animate(pl, [{transform: 'translateY(101%)'}, {transform: 'none'}], {spring: 'smooth', delay: 90 + k * 80, fill: 'backwards'});
    if (who) ui.animate(who, [{opacity: 0, transform: 'translateY(14px)'}, {opacity: 1, transform: 'none'}], {duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', delay: 180 + k * 80, fill: 'backwards'});
  });
  // The crown drops in last (ui.stamp: bouncy scale; plus a short fall on the independent translate property).
  const crown = pod.querySelector('.pod-1 .av-crown');
  if (crown) {
    crown.style.opacity = '0';
    setTimeout(() => {
      crown.style.opacity = '';
      if (!crown.isConnected) return;
      ui.stamp(crown, {from: 1.8});
      ui.animate(crown, [{translate: '0 -22px'}, {translate: '0 0'}], {spring: 'bouncy'});
    }, 520);
  }
}

// The scrollTop at which the accessory starts to stick: its natural top (measured from the element above it,
// so it is right even while the bar is stuck) minus its sticky offset, calc(var(--nav-h) - 1px).
function pinPoint(ctx, st) {
  const sc = ctx.screen, acc = st.el.querySelector('.sea-acc'), prev = acc && acc.previousElementSibling;
  if (!sc || !acc || !prev) return null;
  const ca = getComputedStyle(acc);
  const gap = Math.max(parseFloat(getComputedStyle(prev).marginBottom) || 0, parseFloat(ca.marginTop) || 0); // collapsed margins
  const natural = sc.scrollTop + prev.getBoundingClientRect().bottom + gap - sc.getBoundingClientRect().top - sc.clientTop;
  return natural - (parseFloat(ca.top) || 0);
}

// Keep the segmented bar pinned where it was when the content below it changes.
function keepPinned(ctx, st, fn) {
  const sc = ctx.screen;
  const was = sc ? sc.scrollTop : 0;
  const p0 = pinPoint(ctx, st);
  // The app marks the bar pinned once any of it tucks under the nav, i.e. past p0 - 1.
  const pinned = p0 != null && was > p0 - 1;
  fn();
  if (!sc) return;
  // The header can change height (a year switch), so measure the pin point again after the swap.
  const p1 = pinned ? pinPoint(ctx, st) : null;
  // Explicit either way, so scroll anchoring never jumps the page when the content is swapped.
  sc.scrollTop = p1 != null ? Math.ceil(p1) : was;
}

// Enable or disable a scrubber step. A disabled button drops focus to <body>, so a step that is about to
// disable itself under keyboard focus (first or last week) first hands focus to the selected week chip.
function setStep(scrub, btn, off) {
  if (!btn || btn.disabled === off) return;
  if (off && btn === document.activeElement) {
    const chip = scrub.querySelector('.chip[aria-pressed="true"]');
    if (chip) chip.focus({preventScroll: true});
  }
  btn.disabled = off;
}

function patch(ctx, st, R) {
  const P = st.R;
  st.R = R;
  if (P.year === R.year && P.seg === R.seg && P.week === R.week) return; // a canonicalizing replace
  const el = st.el;
  const acc = el.querySelector('.sea-acc');
  const content = el.querySelector('.sea-content');
  if (!acc || !content) { el.innerHTML = renderAll(R); return; }
  if (R.seg === 'weeks' && R.week != null) st.lastWeek.set(R.year, R.week);

  keepPinned(ctx, st, () => {
    if (R.year !== P.year) {
      const head = el.querySelector('.sea-head');
      ui.crossfade(head, () => { head.innerHTML = headInner(R); }, {duration: 160});
      ui.setChips(el.querySelector('.sea-years .chips'), R.year, {scroll: true});
    }
    // Segmented control: rebuild when the set of segments changes (Bracket only for completed seasons).
    const segEl = acc.querySelector('.seg');
    const want = segItems(R.s).map(x => x.id).join(',');
    const have = segEl ? [...segEl.querySelectorAll('button[role="tab"]')].map(b => b.dataset.value).join(',') : '';
    if (!segEl || want !== have) {
      const tmp = document.createElement('div');
      tmp.innerHTML = segHtml(R);
      if (segEl) segEl.replaceWith(tmp.firstElementChild); else acc.prepend(tmp.firstElementChild);
    } else if (segEl.querySelector('[aria-selected="true"]')?.dataset.value !== R.seg) {
      ui.setSeg(segEl, R.seg);
    }
    // Week scrubber lives in the accessory while Weeks is showing.
    const scrub = acc.querySelector('.sea-scrub');
    if (R.seg === 'weeks') {
      if (scrub && R.year === P.year && P.seg === 'weeks') {
        ui.setChips(scrub.querySelector('.chips'), R.week, {scroll: true});
        const i = R.weeks.indexOf(R.week);
        const [prev, next] = scrub.querySelectorAll('[data-wk]');
        setStep(scrub, prev, i <= 0);
        setStep(scrub, next, i < 0 || i >= R.weeks.length - 1);
      } else {
        const tmp = document.createElement('div');
        tmp.innerHTML = scrubHtml(R);
        const n = tmp.firstElementChild;
        if (scrub) scrub.replaceWith(n || document.createTextNode('')); else if (n) acc.append(n);
        if (n) { centerChip(n.querySelector('.chips'), R.week); ui.animate(n, [{opacity: 0}, {opacity: 1}], {duration: 160, easing: 'linear'}); }
      }
    } else if (scrub) {
      scrub.remove();
    }
    content.setAttribute('aria-label', R.seg === 'weeks' ? 'Weeks' : R.seg === 'bracket' ? 'Bracket' : 'Table');
    ui.crossfade(content, () => { content.innerHTML = contentHtml(R); }, {duration: 120});
  });
  if (R.seg === 'table') playPodium(st);
  if (R.seg === 'weeks') warmWraps(R.s);
}

function onChange(ctx, e) {
  const st = S.get(ctx);
  if (!st || !st.R.s) return;
  const {name, value} = e.detail || {};
  const R = st.R;
  if (name === 'year') {
    const ny = Number(value);
    const ns = data.seasonByYear(ny);
    if (!ns || ny === R.year) return;
    let seg = R.seg;
    if (seg === 'bracket' && !hasBracket(ns)) seg = 'table';
    let wk = null;
    if (seg === 'weeks') { const ws = weeksOf(ns); wk = ws.includes(R.week) ? R.week : (st.lastWeek.get(ny) || null); }
    ctx.replace(pathFor(ny, seg, wk));
  } else if (name === 'seg') {
    ctx.replace(pathFor(R.year, value, value === 'weeks' ? (st.lastWeek.get(R.year) || null) : null));
  } else if (name === 'week') {
    ctx.replace(pathFor(R.year, 'weeks', Number(value)));
  }
}

function onClick(ctx, e) {
  const st = S.get(ctx);
  const t = e.target;
  if (!st || !t || !t.closest) return;
  const gEl = t.closest('[data-game]');
  if (gEl) {
    const [y, i] = gEl.dataset.game.split(':').map(Number);
    const s = data.seasonByYear(y);
    const g = s && s.games[i];
    if (g) { ui.haptic('light'); openMatchup(g, ctx); }
    return;
  }
  const step = t.closest('[data-wk]');
  if (step && !step.disabled && st.R.s) {
    const R = st.R;
    const i = R.weeks.indexOf(R.week) + Number(step.dataset.wk);
    if (i >= 0 && i < R.weeks.length) { ui.haptic('selection'); ctx.replace(pathFor(R.year, 'weeks', R.weeks[i])); }
  }
}

function shareText(R) {
  const s = R.s;
  if (!s) return '';
  if (R.seg === 'weeks' && R.week != null) return `${R.year}, week ${R.week} scoreboard.`;
  if (s.live) return `${R.year} standings, through week ${data.throughWeek(s)}.`;
  const won = s.champion ? `${data.name(s.champion)} won it all as ${data.teamIn(s, s.champion)}.` : '';
  return R.seg === 'bracket' ? `${R.year} bracket. ${won}`.trim() : (won ? `${R.year}: ${won}` : `${R.year} season.`);
}

export default {
  id: 'season',
  title: ctx => String(ctx.params && ctx.params.year != null ? ctx.params.year : ''),
  actions(ctx) {
    return data.seasonByYear(ctx.params.year) ? [{id: 'share', icon: 'share', label: 'Share this season'}] : [];
  },
  render(ctx) {
    return renderAll(resolve(ctx.params));
  },
  mount(el, ctx) {
    const R = resolve(ctx.params);
    const prev = S.get(ctx);
    const st = {el, R, lastWeek: prev ? prev.lastWeek : new Map()};
    if (R.s && R.seg === 'weeks' && R.week != null) st.lastWeek.set(R.year, R.week);
    S.set(ctx, st);
    el.addEventListener('ui:change', e => onChange(ctx, e));
    el.addEventListener('click', e => onClick(ctx, e));
    if (!R.s) return;
    centerChip(el.querySelector('.sea-years .chips'), R.year);
    centerChip(el.querySelector('.sea-scrub .chips'), R.week);
    // Canonicalize links that asked for something this season doesn't have (e.g. /2026/bracket, /weeks/30).
    const p = ctx.params;
    if ((p.seg === 'bracket' && R.seg !== 'bracket') || (p.week != null && Number(p.week) !== R.week)) {
      ctx.replace(pathFor(R.year, R.seg, R.seg === 'weeks' && p.week != null && Number(p.week) === R.week ? R.week : null));
    }
    if (ctx.first) ui.stagger(el);
    if (R.seg === 'table') playPodium(st);
    if (R.seg === 'weeks') warmWraps(R.s);
  },
  update(ctx) {
    const st = S.get(ctx);
    if (!st) return;
    const R = resolve(ctx.params);
    if (ctx.reason === 'params' && st.R.s && R.s) { patch(ctx, st, R); return; }
    // Data reload, "me" change, or a switch to/from an unknown year: rebuild the body, keep the scroll.
    const sc = ctx.screen, top = sc ? sc.scrollTop : 0;
    st.R = R;
    st.el.innerHTML = renderAll(R);
    if (R.s) {
      centerChip(st.el.querySelector('.sea-years .chips'), R.year);
      centerChip(st.el.querySelector('.sea-scrub .chips'), R.week);
      if (R.seg === 'weeks') warmWraps(R.s);
    }
    if (sc) sc.scrollTop = top;
  },
  onAction(id, ctx) {
    if (id !== 'share') return;
    const st = S.get(ctx);
    const R = st ? st.R : resolve(ctx.params);
    // ui.share runs synchronously inside this tap (iOS user activation).
    return ui.share({text: shareText(R), url: ui.absLink(pathFor(R.year, R.seg, R.seg === 'weeks' ? R.week : null))}).then(r => {
      if (r === 'copied') ui.toast('Link copied. Paste it in the league chat.', {icon: 'check-circle'});
      else if (r === 'unavailable') ui.toast("Couldn't copy the link.");
    });
  }
};
