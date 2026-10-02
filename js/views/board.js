// League leaderboard card (the Puzzles tab and Results) plus small Daily helpers shared by the puzzle screens.
// Owner: PUZZLES (tabs-v4; was the daily-hub package).
//
// mountBoard(container, {mode, compactTop, ctx}) renders the card into `container` and patches it in place on
// daily 'lb' events (through ui.whenIdle), FLIPping reorders and counting up changed points.
// Returns {el, mode, setMode, refresh, dropCrown, destroy}.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {openPlayerCard} from './you.js';

const esc = data.esc;
const nf = n => data.nf(n);

// ============================================================================ Shared helpers
/** One hidden <svg> with the streak-flame gradient, added to the document once. */
export function ensureDefs() {
  if (document.getElementById('c-flame-defs')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'c-flame-defs';
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.setAttribute('width', '0');
  s.setAttribute('height', '0');
  s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  s.innerHTML = '<defs><linearGradient id="c-flame-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--flame-2)"/><stop offset="1" style="stop-color:var(--flame-1)"/></linearGradient></defs>';
  document.body.appendChild(s);
}

/** Streak flame: gradient-filled (flame tokens), or grey when cold / at risk. Pure markup: the gradient comes
 *  from ensureDefs(), which every mount / sheet opener calls. */
export function flameIcon({size = 18, cold = false, cls = ''} = {}) {
  const st = cold ? '' : 'fill:url(#c-flame-g);stroke:url(#c-flame-g);';
  return `<svg class="ic c-flame${cold ? ' is-cold' : ''}${cls ? ' ' + cls : ''}" style="${st}width:${size}px;height:${size}px" aria-hidden="true" focusable="false"><use href="#i-flame"/></svg>`;
}

/** Streak pill (hub trailing slot, player card). s = {current, atRisk}. */
export function streakPillHTML(s, {tag = 'button', attrs = ''} = {}) {
  const n = s.current || 0;
  const cold = !n || !!s.atRisk;
  // A non-button pill is an image to assistive tech (aria-label on a bare span is ignored).
  const ty = tag === 'button' ? ' type="button"' : ' role="img"';
  return `<${tag}${ty} class="c-spill${s.atRisk ? ' is-risk' : ''}${!n ? ' is-cold' : ''}" aria-label="Streak: ${n} day${n === 1 ? '' : 's'}${s.atRisk ? ', ends at midnight' : ''}"${attrs ? ' ' + attrs : ''}>${flameIcon({size: 18, cold})}<span class="n5 c-spill-n">${n}</span></${tag}>`;
}

// ---------------------------------------------------------------------------- The day's step set (v1: 3 puzzles,
// 1,000 points; v2: 5 puzzles, 1,500 points; v3: the same 5 puzzles with one or two items each, 1,000 points; v4:
// three of the five short v3 puzzles, 600 points). Everything reads daily.STEPS / daily.DAY at use time (live bindings).
const dailyReady = () => daily.status === 'ready' && !!daily.DAY;
/** Steps of the loaded day ([] before puzzles load). */
export const steps = () => (dailyReady() && Array.isArray(daily.STEPS) ? daily.STEPS : []);
/** The day's maximum: 1,000 (v1, v3), 1,500 (v2) or 600 (v4). */
export const maxPts = () => daily.maxPts();
/** How many items a step has on the loaded day: College players and grid squares (5 and 9 on v1 and v2 days, 2 and 2
 *  on v3 and v4), silhouettes (5 on v2, 2 on v3 and v4). */
export function itemCount(id) {
  if (id === 'col') return daily.colCount();
  if (id === 'sil') return daily.silRounds();
  if (id === 'grid') return daily.gridShape().n;
  return 0;
}
const NUM_WORD = {3: 'three', 5: 'five'};
/** 'three' / 'five': how many puzzles the loaded day has. */
export const countWord = () => NUM_WORD[steps().length] || String(steps().length || 3);
/** A finished College or Silhouettes count line: 'All five answered', or 'Both answered' on a two-item day. */
export const allAnswered = n => (n === 2 ? 'Both answered' : `All ${NUM_WORD[n] || n} answered`);
/** Date label of a puzzle day ("Tue, Sep 29"; long: "Tuesday, September 29"). Replaces every "Daily #n". */
export const dayLabel = (pnum = daily.PNUM, o) => daily.dayLabel(pnum, o);

/** Ring parts for the live day (same rule as the tab icon: points / max, gold when perfect). */
export function stepParts(ds) {
  if (!dailyReady()) return ZERO_PARTS;
  const d = ds || daily.DS;
  return daily.STEPS.map(s => {
    const p = s.pts(d);
    return {frac: Math.min(1, p / s.max), perfect: p === s.max, doneZero: s.done(d) && p === 0};
  });
}
export const ZERO_PARTS = [{frac: 0}, {frac: 0}, {frac: 0}];
/** Empty parts, one per step of the loaded day (three before puzzles load). */
export const zeroParts = () => (steps().length ? steps().map(() => ({frac: 0})) : ZERO_PARTS);

const rad = d => d * Math.PI / 180;
/**
 * Step ring: one arc per puzzle. Three parts are ui.ring itself (the spec's 112° arcs); any other count uses the
 * same geometry and markup (8° gaps from 12 o'clock + 4°, round caps trimmed so the gaps stay visible), so
 * ui.ringUpdate and the ring CSS work on it unchanged. Options as ui.ring.
 */
export function ringHTML(parts = [], o = {}) {
  const n = parts.length;
  if (n === 3 || !n) return ui.ring(parts, o);
  const {size, stroke, center = '', mini = false, label, cls = ''} = o;
  const S = size || (mini ? 24 : 200), W = stroke || (mini ? 3 : 16);
  const r = (S - W) / 2, c = S / 2, trim = (W / 2) / r, slot = 360 / n, gap = 8;
  let tracks = '', fills = '';
  for (let i = 0; i < n; i++) {
    const a0 = rad(gap / 2 + i * slot) + trim, a1 = rad(gap / 2 + i * slot + slot - gap) - trim;
    const x0 = c + r * Math.sin(a0), y0 = c - r * Math.cos(a0), x1 = c + r * Math.sin(a1), y1 = c - r * Math.cos(a1);
    const d = `M${x0.toFixed(3)} ${y0.toFixed(3)}A${r} ${r} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
    const len = +(r * (a1 - a0)).toFixed(3);
    const p = parts[i] || {};
    const f = Math.min(1, Math.max(0, Number(p.frac) || 0));
    tracks += `<path class="ring-track${p.doneZero ? ' is-zero' : ''}" d="${d}" stroke-width="${W}"/>`;
    fills += `<path class="ring-fill${p.perfect ? ' is-perfect' : ''}${f <= 0 ? ' is-empty' : ''}" d="${d}" stroke-width="${W}" data-len="${len}" stroke-dasharray="${len} ${len}" style="stroke-dashoffset:${(len * (1 - f)).toFixed(3)}"/>`;
  }
  const a11y = label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';
  return `<div class="ring${mini ? ' ring-mini' : ''}${cls ? ' ' + cls : ''}" style="--rs:${S}px"${a11y} data-ring><svg viewBox="0 0 ${S} ${S}" aria-hidden="true" focusable="false">${tracks}${fills}</svg>${center ? `<div class="ring-center">${center}</div>` : ''}</div>`;
}

/** 'PRO BOWL' → 'Pro Bowl', 'ALL-PRO' → 'All-Pro'. */
export const gradeTitle = g => String(g || '').toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
/** Gold grades (spec 7.7: 850 or more of 1,000, i.e. ALL-PRO and PERFECT DAY on either scale). */
export const gradeGold = g => g === 'ALL-PRO' || g === 'PERFECT DAY';

/** Puzzle icon by step id; PUZZLE_ICON[i] is the v1 order. */
export const STEP_ICON = {col: 'grad-cap', sil: 'silhouette', who: 'mystery', jr: 'route', grid: 'grid-3', play: 'football'};
export const PUZZLE_ICON = ['grad-cap', 'mystery', 'grid-3'];
/** Icon of step i of the loaded day. */
export const stepIcon = i => { const s = steps()[i]; return (s && STEP_ICON[s.id]) || PUZZLE_ICON[i] || 'football'; };

/** Runs fn once el is at least 60% visible (IntersectionObserver), or at once without IO. Returns cancel. */
export function whenVisible(el, fn, {threshold = .6} = {}) {
  if (!el) return () => {};
  if (typeof IntersectionObserver !== 'function') { fn(); return () => {}; }
  let done = false;
  const io = new IntersectionObserver(es => {
    if (done) return;
    if (es.some(e => e.isIntersecting && e.intersectionRatio >= threshold - .01 && ui.rendered(e.target))) { done = true; io.disconnect(); fn(); }
  }, {threshold: [0, threshold, 1]});
  io.observe(el);
  return () => { done = true; io.disconnect(); };
}

// ---------------------------------------------------------------------------- Countdown (hub + results)
export function msToMidnight(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
}
function isNewDay() {
  try { return daily.status === 'ready' && daily.checkDay(); } catch (_) { return false; }
}
/** Pure markup (render-safe). The first ctx.timer tick (tickCountdown) swaps in the banner once the day changed. */
export function countdownHTML(newDay = false) {
  if (newDay) {
    return `<div class="c-cd c-cd-new" role="status"><span class="c-cd-nt">${ui.icon('sparkle', {size: 18})}<span>New puzzles are here</span></span>${ui.button({label: 'Load', size: 's', attrs: {'data-cd-load': ''}})}</div>`;
  }
  return `<p class="c-cd">${ui.icon('clock', {size: 15})}<span>New puzzles in <span class="c-cd-v">${esc(ui.untilText(msToMidnight()))}</span></span></p>`;
}
/** Minute tick: updates the time, or swaps in the "New puzzles are here" banner once the day changed. */
export function tickCountdown(host, {animate = true} = {}) {
  if (!host) return;
  const nd = isNewDay();
  if (nd) {
    if (host.querySelector('.c-cd-new')) return;
    host.innerHTML = countdownHTML(true);
    const b = host.querySelector('.c-cd-new');
    if (animate && b) ui.animate(b, [{opacity: 0, transform: 'scale(.94)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy'});
    return;
  }
  const v = host.querySelector('.c-cd-v');
  const t = ui.untilText(msToMidnight());
  if (!v) host.innerHTML = countdownHTML(false);
  else if (v.textContent !== t) v.textContent = t;
}

/** Scrolls el's screen so el sits just under the nav bar. */
export function scrollToEl(el) {
  const scr = el && el.closest('.screen');
  if (!scr) return;
  const top = el.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - 64;
  scr.scrollTo({top: Math.max(0, top), behavior: ui.RM ? 'auto' : 'smooth'});
}

// ============================================================================ Board
const MODES = [{id: 'today', label: 'Today'}, {id: 'season', label: 'Season'}, {id: 'streaks', label: 'Streaks'}];
const boards = new Set();
let seq = 0;
let navCtx = null;           // the last ctx handed to mountBoard (for "See board" from another tab)
let celebrate = null;        // {uid, until}: crown drop on your row after taking #1
let rankBeforePost = null;   // your Today rank when a post started
let postedAt = 0;
let topDay = 0;

function safeRows(mode, players) {
  try { return daily.boardRows(mode, players); } catch (e) { console.error(e); return []; }
}

// ---------------------------------------------------------------------------- Finished in this page session
// Puzzle days this page session saw unfinished. A day that is complete now and is in this set was finished in
// this session, so the streak +1 roll may play; a day already complete at load never rolls. Evaluated at use
// time, so it does not depend on the order in which 'progress' subscribers run. No storage (compat contract).
const seenOpen = new Set();
function noteOpen() {
  try { if (daily.status === 'ready' && daily.DAY && !daily.allDone()) seenOpen.add(daily.PNUM); } catch (_) {}
}
noteOpen();
export const finishedThisSession = () => daily.status === 'ready' && !!daily.DAY && seenOpen.has(daily.PNUM) && daily.allDone();

// Module-level daily handler: the session tracker, plus the passed-you toast and taking #1, which run once per
// event however many boards are mounted.
daily.subscribe((type, d) => {
  if (type === 'ready' || type === 'progress') { noteOpen(); return; }
  if (type !== 'lb') return;
  try {
    const LB = daily.LB;
    if (d && d.why === 'status') {
      if (LB.status === 'posting') {
        const mine = safeRows('today').find(r => r.me);
        rankBeforePost = mine ? mine.rank : null;
      } else if (LB.status === 'posted') {
        postedAt = Date.now();
        checkTop();
      }
    } else if (d && d.why === 'snapshot') {
      if (postedAt && Date.now() - postedAt < 120000) checkTop();
      checkPassed(d.prev);
    }
  } catch (e) { console.error(e); }
});

function checkTop() {
  const LB = daily.LB;
  if (!LB.uid || topDay === daily.PNUM || rankBeforePost === 1) return;
  const mine = safeRows('today').find(r => r.me);
  if (!mine || mine.rank !== 1) return;
  topDay = daily.PNUM;
  celebrate = {uid: LB.uid, until: performance.now() + 6000};
  ui.toast('Top of the board. For now.', {icon: 'crown'});
  ui.haptic('celebrate');
  // Boards patch through whenIdle; drop the crown once they have.
  ui.whenIdle(() => boards.forEach(b => b.dropCrown()));
}

function checkPassed(prev) {
  try {
    const LB = daily.LB;
    if (!LB.uid || !Array.isArray(prev) || !prev.length) return;
    const cur = safeRows('today');
    const me = cur.find(r => r.me);
    if (!me) return; // only after you have posted today
    const before = safeRows('today', prev);
    const meB = before.find(r => r.id === LB.uid);
    if (!meB) return;
    const wasAbove = new Set(before.filter(r => r.pts > meB.pts).map(r => r.id));
    const passers = cur.filter(r => !r.me && r.pts > me.pts && !wasAbove.has(r.id));
    if (!passers.length) return;
    let st = null;
    try { st = JSON.parse(ui.lsGet('gg-passed') || 'null'); } catch (_) { st = null; }
    if (!st || typeof st !== 'object' || st.day !== daily.PNUM || !Array.isArray(st.nicks)) st = {day: daily.PNUM, nicks: []};
    const p = passers.find(r => !st.nicks.includes(r.name));
    if (!p) return;
    st.nicks.push(p.name);
    try { ui.lsSet('gg-passed', JSON.stringify(st)); } catch (_) {}
    ui.toast(`${p.name} just passed you. ${nf(p.pts)} to your ${nf(me.pts)}.`, {duration: 4000, action: {label: 'See board', fn: seeBoard}});
  } catch (e) { console.error(e); }
}

// The board on the screen the person is looking at (not under a cover, on a hidden tab or in an inert layer).
function visibleBoard() {
  for (const b of boards) {
    const el = b.el;
    if (el && el.isConnected && !el.closest('[hidden], [inert], [data-under]')) return b;
  }
  return null;
}
function seeBoard() {
  const b = visibleBoard();
  if (b) { scrollToEl(b.el); return; }
  if (navCtx) {
    Promise.resolve(navCtx.nav('/puzzles')).then(() => { const v = visibleBoard(); if (v) scrollToEl(v.el); }).catch(() => {});
  }
}

/** Debug handle for manual testing from the console, on dev hosts only (null in production). */
export const __dev = daily.DEV_NO_POST ? {
  checkPassed, checkTop, seeBoard, visibleBoard,
  get boards() { return [...boards]; },
  markPosting() { const mine = safeRows('today').find(r => r.me); rankBeforePost = mine ? mine.rank : null; },
  markPosted() { postedAt = Date.now(); },
  reset() { topDay = 0; celebrate = null; rankBeforePost = null; postedAt = 0; }
} : null;

// ---------------------------------------------------------------------------- Markup
function moveChip(m) {
  if (m == null || m === 0) return '';
  if (m === 'new') return '<span class="c-bmove is-new">NEW</span>';
  return m > 0 ? `<span class="c-bmove is-up">▲${m}</span>` : `<span class="c-bmove is-down">▼${-m}</span>`;
}
const moveWords = m => m == null || m === 0 ? '' : m === 'new' ? ', new' : m > 0 ? `, up ${m}` : `, down ${-m}`;
const rankCls = rk => rk === 1 ? ' is-r1' : rk === 2 ? ' is-r2' : rk === 3 ? ' is-r3' : '';

function rowSig(r, mode) {
  return JSON.stringify([mode, r.rank, r.name, r.managerId, r.me, r.sub, r.move, r.current, r.best]);
}
// A five-puzzle day's sub line ("College 4/5, faces 3/5, ID on clue 2, path on guess 1, grid 6/9", or on a short v3
// day "College 1/2, faces 2/2, ID on clue 3, path on guess 1, grid 1/2") is too long for a phone row: the row shows a
// compact form on up to two lines; the aria-label keeps daily's full text. A three-puzzle v4 day's line (any three of
// the five parts, e.g. "College 2/2, faces 1/2, ID on clue 3") gets the same compact parts. The v1 line ("College 4/5,
// grid 7/9, ID on clue 2") is shown as it is.
const SUB_PARTS = [
  [/^College (\d+\/\d+)$/, m => `College ${m[1]}`],
  [/^faces (\d+\/\d+)$/, m => `Faces ${m[1]}`],
  [/^ID on clue (\d+)$/, m => `Clue ${m[1]}`],
  [/^no ID$/, () => 'No ID'],
  [/^path on guess (\d+)$/, m => `Path ${m[1]}/3`],
  [/^no path$/, () => 'No path'],
  [/^grid (\d+\/\d+)$/, m => `Grid ${m[1]}`]
];
const V1_SUB = /^College \d+\/\d+, grid \d+\/\d+, (?:ID on clue \d+|no ID)$/;
function shortSub(sub) {
  const s = String(sub || '');
  if (!s || V1_SUB.test(s)) return null;
  const parts = s.split(', ');
  if (parts.length < 3) return null;
  const out = [];
  for (const p of parts) {
    const hit = SUB_PARTS.find(([re]) => re.test(p));
    if (!hit) return null;
    out.push(hit[1](hit[0].exec(p)));
  }
  return out.join(' · ');
}
function rowInner(r, mode) {
  const streaks = mode === 'streaks';
  const sub = streaks ? `Best ${r.best}` : r.sub;
  const short = streaks ? null : shortSub(sub);
  const val = streaks ? r.current : r.pts;
  const trail = streaks
    ? `<span class="c-bstreak">${flameIcon({size: 18, cold: !r.current})}<span class="n4 c-bval">${esc(r.current)}</span></span>`
    : `${moveChip(r.move)}<span class="n4 c-bval">${esc(nf(r.pts))}</span>`;
  const label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}, ${streaks ? `${r.current}-day streak, best ${r.best}` : `${nf(r.pts)} points${moveWords(r.move)}, ${sub}`}`;
  return {
    label,
    val,
    html: `<span class="c-brank n4${rankCls(r.rank)}" aria-hidden="true">${esc(r.rank)}</span>`
      + `<span class="row-lead">${ui.nickAvatar(r.name, {size: 36, managerId: r.managerId || null, you: r.me, crown: r.rank === 1})}</span>`
      + `<span class="row-main"><span class="row-title"><span class="c-bnick">${esc(r.name)}</span>${r.me ? ui.badge('you') : ''}</span><span class="row-sub${short ? ' is-two' : ''}">${esc(short || sub)}</span></span>`
      + `<span class="row-trail">${trail}</span>`
  };
}
function rowWrap(r, mode) {
  const x = rowInner(r, mode);
  return `<div class="c-brow-w" role="listitem" data-key="${esc(r.id)}" data-sig="${esc(rowSig(r, mode))}" data-val="${esc(x.val)}"><button type="button" class="row c-brow${r.me ? ' is-me' : ''}" data-uid="${esc(r.id)}" aria-label="${esc(x.label)}">${x.html}</button></div>`;
}

function socialHTML() {
  const s = daily.social();
  const n = s.played.length;
  if (!n) return '';
  const list = s.played.map(r => ({managerId: r.managerId, nick: r.name, you: r.me}));
  const leader = s.leader ? ` ${s.leader} leads.` : '';
  return `<div class="c-board-social">${ui.avatarStack(list, {max: 5, size: 28})}<p class="c-board-soc-t">${esc(`${n} of ${Math.max(n, s.regulars)} have played today.${leader}`)}</p></div>`;
}
function stillHTML() {
  const list = daily.social().stillToPlay;
  if (!list.length) return '';
  const pills = list.slice(0, 8).map(p => ui.pill(p.name, {lead: ui.nickAvatar(p.name, {size: 20, managerId: p.managerId || null}), cls: 'c-still-p' + (p.me ? ' is-me' : '')})).join('');
  const more = list.length > 8 ? ui.pill(`+${list.length - 8}`, {cls: 'c-still-p c-still-more'}) : '';
  return `<div class="c-board-still"><p class="c-board-lbl">Still to play</p><div class="c-still-list">${pills}${more}</div></div>`;
}

function planRows(rows, st) {
  const top = st.expanded ? rows.length : st.top;
  const meIdx = rows.findIndex(r => r.me);
  return {list: rows.slice(0, top), pin: meIdx >= top ? rows[meIdx] : null};
}
function moreHTML(rows, st) {
  if (rows.length <= st.top) return '';
  return `<button type="button" class="btn btn-plain c-board-more" data-more aria-expanded="${st.expanded}">${esc(st.expanded ? `Show top ${st.top}` : `Show all ${rows.length}`)}</button>`;
}

const EMPTY = {
  today: 'No scores yet today. Finish all three puzzles to take the top spot.',
  season: 'No scores yet this season.',
  streaks: 'No streaks yet. Finish all three puzzles to start one.'
};
// v1 days keep the existing copy word for word; a five-puzzle day (v2 or v3) says five.
const emptyText = mode => (steps().length > 3 ? EMPTY[mode].replace('all three puzzles', `all ${countWord()} puzzles`) : EMPTY[mode]);
const OFF = "The leaderboard isn't connected right now. Your score is saved on this phone, and Share results copies it for the group chat.";

function bodyHTML(st, key, rows) {
  if (key === 'wait') return '';
  if (key === 'loading') return `<div class="c-board-sk">${ui.skeleton('rows', 3, {label: 'Loading scores.'})}</div>`;
  if (key === 'off') return `<p class="c-board-note">${esc(OFF)}</p>`;
  if (key.startsWith('empty')) {
    // One message, not two about zero scores: a short title that adds something, over the existing body copy.
    const t = st.mode === 'today' ? `<p class="c-board-et">Be first on the board.</p>` : '';
    return `<div class="c-board-empty">${t}<p class="c-board-eb">${esc(emptyText(st.mode))}</p></div>`
      + (st.mode === 'today' ? `<div data-r="still">${stillHTML()}</div>` : '');
  }
  const plan = planRows(rows, st);
  return (st.mode === 'today' ? `<div data-r="social">${socialHTML()}</div>` : '')
    + `<div class="c-brows" role="list" data-r="rows" aria-label="${esc(MODES.find(m => m.id === st.mode).label)} leaderboard">${plan.list.map(r => rowWrap(r, st.mode)).join('')}</div>`
    + `<div class="c-bpin" data-r="pin"${plan.pin ? '' : ' hidden'}><span class="c-bpin-gap" aria-hidden="true"><i></i><i></i><i></i></span><div class="c-bpin-rows" role="list">${plan.pin ? rowWrap(plan.pin, st.mode) : ''}</div></div>`
    + `<div data-r="more">${moreHTML(rows, st)}</div>`
    + (st.mode === 'today' ? `<div data-r="still">${stillHTML()}</div>` : '');
}

// 'wait': the puzzles failed to load, so the board never started (Firebase starts after puzzles). Nothing true
// can be said about scores yet, so the card is hidden until the Daily loads ('off' is only for LB.off).
function stateKey(st, rows) {
  if (daily.status === 'error') return 'wait';
  if (daily.status !== 'ready') return 'loading';
  const LB = daily.LB;
  if (LB.off) return 'off';
  if (!LB.ready) return 'loading';
  return rows.length ? 'list-' + st.mode : 'empty-' + st.mode;
}

/**
 * Mount the leaderboard card into container.
 * opts: mode ('today'|'season'|'streaks'), compactTop (rows shown before "Show all"), ctx (the view's ctx; "See board"
 * uses it to go to the Puzzles tab when no board is on screen).
 */
export function mountBoard(container, {mode = 'today', compactTop = 10, ctx = null} = {}) {
  ensureDefs();
  if (ctx) navCtx = ctx;
  const id = 'c-bd-' + (++seq);
  const st = {mode: MODES.some(m => m.id === mode) ? mode : 'today', top: compactTop, expanded: false, key: null, dead: false, cancel: null, rows: []};
  container.innerHTML = `<section class="card c-board" aria-labelledby="${id}"><div class="c-board-head"><h2 class="c-board-t" id="${id}">Leaderboard</h2></div>${ui.seg({name: 'lb', items: MODES, value: st.mode, small: true, label: 'Leaderboard', cls: 'c-board-seg'})}<div class="c-board-body"></div></section>`;
  const root = container.querySelector('.c-board');
  const body = root.querySelector('.c-board-body');

  const rowsNow = () => {
    if (daily.status !== 'ready' || daily.LB.off || !daily.LB.ready) return [];
    return safeRows(st.mode);
  };

  function rebuild(key, rows, animate) {
    const go = () => { body.innerHTML = bodyHTML(st, key, rows); ui.hydrate(body); };
    const wasHidden = container.hidden;
    container.hidden = key === 'wait';
    if (wasHidden && !container.hidden) {
      go();
      if (animate && !ui.RM) ui.animate(root, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.22,1,.36,1)'});
    } else if (animate && st.key != null && !ui.RM && !container.hidden) ui.crossfade(body, go, {duration: 160});
    else go();
    st.key = key;
    st.rows = rows;
  }

  const norm = document.createElement('template');
  function setRegion(name, html) {
    const r = body.querySelector(`[data-r="${name}"]`);
    if (!r) return;
    norm.innerHTML = html; // compare browser-serialized markup, not our source string
    if (r.innerHTML === norm.innerHTML) return;
    r.innerHTML = html;
    if (html && !ui.RM) ui.animate(r, [{opacity: .35}, {opacity: 1}], {duration: 180, easing: 'linear'});
  }

  function makeRow(r) {
    const t = document.createElement('template');
    t.innerHTML = rowWrap(r, st.mode);
    return t.content.firstElementChild;
  }

  function patchList(rows) {
    const listEl = body.querySelector('[data-r="rows"]');
    const pinEl = body.querySelector('[data-r="pin"]');
    if (!listEl || !pinEl) { rebuild(st.key, rows, false); return Promise.resolve(); }
    const pinRows = pinEl.querySelector('.c-bpin-rows');
    const existing = new Map();
    body.querySelectorAll('.c-brow-w').forEach(w => existing.set(w.dataset.key, w));
    const ae = document.activeElement;
    const focusKey = ae && body.contains(ae) && ae.closest('.c-brow-w') ? ae.closest('.c-brow-w').dataset.key : null;
    const focusMore = !!(ae && body.contains(ae) && ae.matches('[data-more]'));
    const plan = planRows(rows, st);
    const counts = [];
    const LB = daily.LB;
    let fly = null;
    const listBottom = listEl.getBoundingClientRect().bottom;
    const build = r => {
      let w = existing.get(r.id);
      if (w) {
        existing.delete(r.id);
        const sig = rowSig(r, st.mode);
        const oldVal = Number(w.dataset.val);
        const x = rowInner(r, st.mode);
        const b = w.firstElementChild;
        if (w.dataset.sig !== sig) {
          b.innerHTML = x.html;
          b.classList.toggle('is-me', !!r.me);
          w.dataset.sig = sig;
        }
        b.setAttribute('aria-label', x.label);
        if (oldVal !== Number(x.val)) {
          w.dataset.val = x.val;
          const v = w.querySelector('.c-bval');
          if (v && isFinite(oldVal)) { v.textContent = nf(oldVal); counts.push([v, Number(x.val), oldVal]); }
        }
      } else {
        w = makeRow(r);
        // Your own row arriving while your post goes through flies up from the bottom of the list.
        if (r.me && (LB.status === 'posting' || (postedAt && Date.now() - postedAt < 15000))) { w.classList.add('is-fly'); fly = w; }
      }
      return w;
    };
    const done = ui.flip(body, () => {
      const L = plan.list.map(build);
      const P = plan.pin ? build(plan.pin) : null;
      listEl.replaceChildren(...L);
      pinRows.replaceChildren(...(P ? [P] : []));
      pinEl.hidden = !P;
      existing.forEach(w => w.remove());
      if (st.mode === 'today') { setRegion('social', socialHTML()); setRegion('still', stillHTML()); }
      setRegion('more', moreHTML(rows, st));
      if (focusKey) {
        const f = body.querySelector(`.c-brow-w[data-key="${CSS.escape(focusKey)}"] > button`);
        if (f && document.activeElement !== f) { try { f.focus({preventScroll: true}); } catch (_) {} }
      } else if (focusMore) {
        const m = body.querySelector('[data-more]');
        if (m) { try { m.focus({preventScroll: true}); } catch (_) {} }
      }
    }, {selector: '.c-brow-w:not(.is-fly)'});
    // flip() measured its second pass synchronously; the flying row animates on its own.
    if (fly) {
      fly.classList.remove('is-fly');
      const dy = Math.max(0, listBottom - fly.getBoundingClientRect().top);
      if (dy > 4) ui.animate(fly, [{transform: `translateY(${dy}px) scale(.98)`, opacity: .5}, {transform: 'none', opacity: 1}], {spring: 'smooth'});
      else if (!ui.RM) ui.animate(fly, [{opacity: 0}, {opacity: 1}], {duration: 240, easing: 'ease-out'});
    }
    return done.then(() => {
      counts.forEach(([el, to, from]) => ui.countUp(el, to, {from, duration: 700, format: 'int'}));
      if (celebrate && performance.now() < celebrate.until) dropCrown();
    });
  }

  function refresh({animate = true} = {}) {
    if (st.dead) return;
    const rows = rowsNow();
    const key = stateKey(st, rows);
    if (key !== st.key) { rebuild(key, rows, animate); return; }
    st.rows = rows;
    if (key.startsWith('list')) { patchList(rows); return; }
    if (key.startsWith('empty') && st.mode === 'today') setRegion('still', stillHTML());
  }
  function schedule() {
    if (st.dead) return;
    if (st.cancel) st.cancel();
    st.cancel = ui.whenIdle(() => { st.cancel = null; refresh(); });
  }

  function dropCrown() {
    if (st.dead || !celebrate) return;
    const w = body.querySelector(`.c-brow-w[data-key="${CSS.escape(celebrate.uid)}"]`);
    const c = w && w.querySelector('.av-crown');
    if (!c || c.dataset.dropped) return;
    c.dataset.dropped = '1';
    ui.animate(c, [{transform: 'translateY(-16px) scale(1.6)', opacity: 0}, {transform: 'none', opacity: 1}], {spring: 'bouncy'});
  }

  function setMode(m, {animate = true} = {}) {
    if (!MODES.some(x => x.id === m) || m === st.mode) return;
    st.mode = m;
    st.expanded = false;
    const seg = root.querySelector('.c-board-seg');
    if (seg) ui.setSeg(seg, m, {animate});
    const rows = rowsNow();
    rebuild(stateKey(st, rows), rows, animate);
  }

  root.addEventListener('ui:change', e => {
    if (!e.detail || e.detail.name !== 'lb') return;
    e.stopPropagation();
    setMode(e.detail.value);
  });
  root.addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (more) {
      st.expanded = !st.expanded;
      const collapsing = !st.expanded;
      patchList(st.rows);
      if (collapsing) scrollToEl(root);
      return;
    }
    const row = e.target.closest('[data-uid]');
    if (row) {
      const r = st.rows.find(x => x.id === row.dataset.uid);
      ui.haptic('light');
      openPlayerCard(row.dataset.uid, {managerId: r ? r.managerId : undefined});
    }
  });

  const unsub = daily.subscribe(type => {
    if (type === 'lb' || type === 'ready' || type === 'error') schedule();
  });

  const api = {
    el: root,
    get mode() { return st.mode; },
    setMode,
    refresh: o => refresh(o),
    dropCrown,
    destroy() {
      if (st.dead) return;
      st.dead = true;
      unsub();
      if (st.cancel) st.cancel();
      boards.delete(api);
    }
  };
  boards.add(api);
  refresh({animate: false});
  return api;
}
