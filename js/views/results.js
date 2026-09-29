// Results cover (spec 7.7): its own top bar (Done + points pill), the "Almost there" state with lock-in, and the
// finished state: grade overline, ring + synced count-up, breakdown bars, streak odometer, post box, share
// (text, native sheet, PNG card) and the league board. Owner: daily-hub package.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {mountBoard, flameIcon, stepParts, ZERO_PARTS, PUZZLE_ICON, whenVisible, countdownHTML, tickCountdown,
  ensureDefs, finishedThisSession, gradeTitle} from './board.js';
import {openStreakSheet} from './you.js';
import {renderShareCard} from './sharecard.js';

const esc = data.esc;
const nf = n => data.nf(n);
const CHEV = '<svg class="ic chev" aria-hidden="true" focusable="false"><use href="#i-chevron-right"/></svg>';
const COPIED = 'Results copied. Paste them in the league chat.';

const RES = new WeakMap();   // ctx → state
const rolled = new Set();    // puzzle days whose streak odometer already rolled this session
const RETRY_HOLD = 600;      // "Try again": the loading state stays up at least this long, so the tap reads
const revealKey = () => 'res-total-' + daily.PNUM;
const ready = () => daily.status === 'ready' && !!daily.DAY;

function phase() {
  if (daily.status === 'error') return 'error';
  if (!ready()) return 'loading';
  return daily.allDone() ? 'done' : 'almost';
}

// ============================================================================ Markup
function barHTML() {
  const r = ready();
  return `<header class="c-rbar bar">
<div class="c-rbar-l"><button type="button" class="btn btn-plain c-rbar-done" data-back>Done</button></div>
<p class="c-rbar-t">${r ? `Daily #${esc(daily.PNUM)}` : 'Results'}</p>
<div class="c-rbar-r"><span class="c-rpill"${r ? '' : ' hidden'} aria-label="${r ? esc(nf(daily.totalPts())) + ' points' : ''}"><span class="n5 c-rpill-n">${r ? esc(nf(daily.totalPts())) : '0'}</span><span class="c-rpill-u">pts</span></span></div>
</header><span class="c-rsent" aria-hidden="true"></span>`;
}

function loadingHTML() {
  return `<div class="c-rload" aria-busy="true"><span class="sr-only">Loading puzzles</span>
<div class="c-rhero" aria-hidden="true"><span class="sk sk-line c-sk-grade"></span><span class="sk c-sk-ring"></span></div>
<div aria-hidden="true">${ui.skeleton('rows', 3)}</div></div>`;
}
function errorHTML() {
  return `<div class="c-rerr">${ui.empty({icon: 'football', title: 'Puzzles need a connection the first time.', body: 'League history works offline.', action: {label: 'Try again', attrs: {'data-retry': ''}}})}</div>`;
}

function almostHTML() {
  const open = daily.STEPS.map((s, j) => ({s, j})).filter(x => !x.s.done());
  const total = daily.totalPts();
  const ring = ui.ring(stepParts(), {size: 132, stroke: 10, center: `<span class="n3">${esc(nf(total))}</span><span class="c-rof">of 1,000</span>`, label: `${nf(total)} of 1,000 points so far`, cls: 'c-almost-ring'});
  return `<section class="c-almost" aria-labelledby="c-almost-t">
${ring}
<h2 class="t-2 c-almost-t" id="c-almost-t">Almost there</h2>
<p class="c-almost-s">You still have ${open.length === 1 ? 'one puzzle' : open.length + ' puzzles'} to finish before your score goes on the board.</p>
<div class="c-almost-btns">${open.map(x => ui.button({label: `Go to puzzle ${x.j + 1}`, kind: 'secondary', icon: PUZZLE_ICON[x.j], attrs: {'data-goto': daily.slug(x.j), 'aria-label': `Go to puzzle ${x.j + 1}, ${x.s.label}`}})).join('')}</div>
${ui.button({label: 'Lock in my score as it is', kind: 'plain', attrs: {'data-lockin': ''}, cls: 'c-almost-lock'})}
</section>`;
}

function postNotes() {
  const LB = daily.LB;
  let h = '';
  if (LB.status === 'posting') h += '<p class="c-post-note" role="status">Posting your score.</p>';
  if (LB.status === 'failed') h += '<p class="c-post-bad" role="status">Posting failed. Check your connection and try again.</p>';
  if (LB.dev) h += '<p class="c-post-note">Posting is off on this dev host.</p>';
  return h;
}
// Post box kinds: '' (hidden) | 'done' | 'denied' | 'full' | 'form'
function postKind() {
  const LB = daily.LB;
  if (LB.off || !LB.ready || !LB.uid) return '';
  if (daily.DS.posted || LB.status === 'posted') return 'done';
  if (LB.status === 'denied') return 'denied';
  if (LB.status === 'full') return 'full';
  return 'form';
}
function myRank() {
  if (!ready() || !daily.LB.ready) return null;
  try { const m = daily.boardRows('today').find(r => r.me); return m ? m.rank : null; } catch (_) { return null; }
}
function postHTML(kind = postKind()) {
  const LB = daily.LB;
  if (kind === 'done') {
    const rk = myRank();
    return `<div class="c-post-done" role="status">${ui.icon('check-circle', {size: 22})}<p>Your score is on the league board.${rk ? esc(` You're #${rk} today.`) : ''}</p></div>`;
  }
  if (kind === 'denied') return `<p class="c-post-bad">The league board turned this score down. Your score is saved on this phone, and Share results still works.</p>`;
  if (kind === 'full') return `<p class="c-post-bad">The league board is over its daily limit. Try posting again tomorrow.</p>`;
  if (kind !== 'form') return '';
  const posting = LB.status === 'posting';
  return `<form class="c-post-form" data-postform novalidate>
<label class="c-post-lbl" for="nick-input">Name on the leaderboard</label>
<div class="c-post-row"><span class="c-post-field"><input id="nick-input" class="c-post-in" type="text" maxlength="24" autocomplete="nickname" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="send" value="${esc(LB.nick || '')}" placeholder="Your name"${posting ? ' readonly' : ''}></span>${ui.button({label: 'Post score', size: 's', type: 'submit', loading: posting, cls: 'c-post-btn'})}</div>
<div class="c-post-notes">${postNotes()}</div>
</form>`;
}

function doneHTML() {
  const total = daily.totalPts();
  const grade = daily.gradeFor(total);
  const gold = total >= 850;
  const reveal = !ui.RM && !ui.countedKey(revealKey());
  const parts = stepParts();
  const ring = ui.ring(reveal ? ZERO_PARTS : parts, {
    size: 220, stroke: 14,
    center: `<span class="n1 c-rtotal">${reveal ? '0' : esc(nf(total))}</span><span class="c-rof">of 1,000 points</span>`,
    label: `${nf(total)} of 1,000 points`, cls: 'c-rring'
  });
  const rows = daily.STEPS.map((s, i) => {
    const p = s.pts(), f = Math.min(1, p / s.max), perfect = p === s.max;
    // Title on its own full-width line; the result and "160 / 200" share the second line, above the bar.
    return `<div class="c-rb" role="listitem" aria-label="${esc(`Puzzle ${i + 1}, ${s.label}: ${s.result()}, ${p} of ${s.max} points`)}">
<span class="c-rb-tile" aria-hidden="true">${ui.icon(PUZZLE_ICON[i], {size: 22})}</span>
<div class="c-rb-main" aria-hidden="true"><p class="c-rb-t">Puzzle ${i + 1} · ${esc(s.label)}</p>
<div class="c-rb-mid"><p class="c-rb-sub"><span class="c-rb-res">${esc(s.result())}</span>${perfect ? ui.icon('check-circle', {size: 14, cls: 'c-rb-perf'}) : ''}</p><span class="c-rb-v"><span class="n4">${esc(nf(p))}</span><span class="c-rb-max">/ ${esc(nf(s.max))}</span></span></div>
<span class="c-rb-bar"><i class="c-rb-fill${perfect ? ' is-perfect' : ''}" data-f="${f}" style="transform:scaleX(${reveal ? 0 : f})"></i></span></div>
</div>`;
  }).join('');
  const s = daily.streakLocal();
  // Streak +1 rolls only the first time results show after a finish this page session saw (never on a reopen).
  const roll = !ui.RM && s.current > 0 && finishedThisSession() && !rolled.has(daily.PNUM);
  const shownN = roll ? s.current - 1 : s.current;
  const share = daily.shareText();
  // On the first view the grade waits (hidden) and lands when the count does; tabindex lets lock-in move focus here.
  return `<section class="c-rhero" tabindex="-1" aria-label="Your score">
<p class="ovl c-grade${gold ? ' is-gold' : ''}${reveal ? ' is-pending' : ''}">${gold ? ui.icon('trophy', {size: 16}) : ''}<span>${esc(grade)}</span></p>
${ring}
</section>
<div class="group c-rbreak" role="list" aria-label="Breakdown">${rows}</div>
<button type="button" class="group c-rstreak" data-streak aria-label="${esc(`${s.current}-day streak, best ${s.best}. Open streak`)}">
<span class="c-rs-flame">${flameIcon({size: 26, cold: !s.current})}</span>
<span class="c-rs-main"><span class="c-rs-t"><span class="c-rs-n" data-n="${s.current}"${roll ? ' data-roll' : ''}>${shownN}</span>-day streak</span><span class="c-rs-sub">Best ${esc(s.best)}</span></span>${CHEV}
</button>
<section class="c-post" data-postbox data-kind="${postKind()}">${postHTML()}</section>
<section class="c-share" aria-label="Share">
<pre class="c-share-prev">${esc(share)}</pre>
<div class="c-share-btns">${ui.button({label: 'Share results', icon: 'copy', attrs: {'data-share': ''}, cls: 'c-share-main'})}${typeof navigator.share === 'function' ? `<button type="button" class="c-share-more" data-share-native aria-label="More sharing options">${ui.icon('share', {size: 22})}</button>` : ''}</div>
${ui.button({label: 'Share image', kind: 'secondary', icon: 'sparkle', attrs: {'data-share-img': '', hidden: true}, cls: 'c-share-img'})}
<textarea class="c-share-ta" rows="7" readonly hidden aria-label="Results to copy"></textarea>
</section>
<div class="c-board-host"></div>
<div class="c-cd-host">${countdownHTML(false)}</div>`;
}

function bodyHTML(ph = phase()) {
  if (ph === 'error') return errorHTML();
  if (ph === 'loading') return loadingHTML();
  if (ph === 'almost') return almostHTML();
  return doneHTML();
}

// ============================================================================ Behavior
function patchBar(st) {
  const r = ready();
  const t = st.el.querySelector('.c-rbar-t');
  if (t) t.textContent = r ? `Daily #${daily.PNUM}` : 'Results';
  const pill = st.el.querySelector('.c-rpill');
  if (!pill) return;
  pill.hidden = !r;
  if (!r) return;
  const n = pill.querySelector('.c-rpill-n'), v = nf(daily.totalPts());
  pill.setAttribute('aria-label', v + ' points');
  if (n && n.textContent !== v) n.textContent = v;
}

function teardown(st) {
  st.cancels.splice(0).forEach(f => { try { f(); } catch (_) {} });
  if (st.board) { st.board.destroy(); st.board = null; }
  st.shareGen++;
  st.file = null;
  st.imgQueued = false;
}

function attach(st) {
  st.phase = phase();
  st.revealed = false;
  if (st.phase !== 'done') return;
  const host = st.el.querySelector('.c-board-host');
  if (host) st.board = mountBoard(host, {mode: 'today', ctx: st.ctx});
  const pb = st.el.querySelector('[data-postbox]');
  if (pb) pb.dataset.rank = String(myRank());
  // The share PNG is rendered after the reveal (queueImage), so its ~50 ms canvas work never lands mid count-up.
  if (st.ctx.visible) reveal(st);
}

function swapBody(st) {
  const body = st.el.querySelector('.c-rbody');
  if (!body) return;
  teardown(st);
  const go = () => { body.innerHTML = bodyHTML(); ui.hydrate(body); };
  if (!ui.RM && st.ctx.visible) ui.crossfade(body, go, {duration: 220}); else go();
  // bodyHTML is pure; the countdown's day check happens here instead.
  tickCountdown(body.querySelector('.c-cd-host'), {animate: false});
  patchBar(st);
  attach(st);
}

/** Render the share PNG at the next idle period (once per attach; lb changes re-render it on their own). */
function queueImage(st) {
  if (st.dead || st.imgQueued || st.phase !== 'done') return;
  st.imgQueued = true;
  const id = ui.onIdle(() => prepareImage(st));
  st.cancels.push(() => { try { cancelIdleCallback(id); } catch (_) {} clearTimeout(id); });
}

// Finished state entrance: ring fill and total count-up in sync, bars fill, then the grade lands with one
// success haptic. It waits until the cover slide (or the swap / cross-fade that brought this body in) has
// settled: those are ui.animate calls, so ui.whenIdle holds until they finish.
function reveal(st) {
  if (st.revealed || st.phase !== 'done') return;
  st.revealed = true;
  const el = st.el;
  const ring = el.querySelector('.c-rring');
  const tot = el.querySelector('.c-rtotal');
  const grade = el.querySelector('.c-grade');
  const showGrade = () => { if (grade) grade.classList.remove('is-pending'); };
  if (!ring || !tot) { showGrade(); queueImage(st); return; }
  const total = daily.totalPts();
  const parts = stepParts();
  const key = revealKey();
  const fills = [...el.querySelectorAll('.c-rb-fill')];
  if (ui.RM || ui.countedKey(key)) {
    ui.ringUpdate(ring, parts, {animate: false});
    tot.innerHTML = esc(nf(total));
    tot.setAttribute('aria-label', nf(total));
    fills.forEach(f => { f.style.transform = `scaleX(${f.dataset.f})`; });
    showGrade();
    rollStreak(st, false);
    queueImage(st);
    return;
  }
  // After the count lands: the streak +1 roll (the next beat) and the share PNG. Runs once.
  let after = false;
  const afterCount = () => { if (after || st.dead) return; after = true; rollStreak(st, true); queueImage(st); };
  // The bar's points pill would show the final total while the ring still counts from 0: it waits for the count.
  const pill = st.el.querySelector('.c-rpill');
  const showPill = (fade) => {
    if (!pill || pill.style.opacity !== '0') return;
    pill.style.opacity = '';
    if (fade) ui.animate(pill, [{opacity: 0, transform: 'scale(.9)'}, {opacity: 1, transform: 'none'}], {spring: 'snappy'});
  };
  const start = () => {
    if (st.dead) return;
    if (pill) { pill.style.opacity = '0'; st.cancels.push(() => showPill(false)); }
    // Arcs fill in tint; perfect ones turn gold when the count lands.
    ui.ringUpdate(ring, parts.map(p => Object.assign({}, p, {perfect: false})), {from: 'zero', duration: 1100});
    ui.countUp(tot, total, {from: 0, duration: 1100, key, format: 'int'}).then(() => {
      showPill(!st.dead);
      if (st.dead) return;
      ui.ringUpdate(ring, parts, {animate: false});
      // The grade lands when the count does.
      if (grade) {
        showGrade();
        ui.animate(grade, [{opacity: 0, transform: 'translateY(6px) scale(.92)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy'});
      }
      if (total >= 1000) {
        ui.haptic('celebrate');
        ui.animate(ring, [{transform: 'scale(1)'}, {transform: 'scale(1.04)', offset: .45}, {transform: 'scale(1)'}], {duration: 620, easing: 'cubic-bezier(.34,1.56,.64,1)'});
        ui.confetti(ring.getBoundingClientRect(), {count: 120, colors: ['#7CF058', '#FFCC4D', '#FFFFFF']});
      } else ui.haptic('success');
      afterCount();
    });
    fills.forEach((f, i) => {
      const v = f.dataset.f;
      f.style.transform = `scaleX(${v})`;
      ui.animate(f, [{transform: 'scaleX(0)'}, {transform: `scaleX(${v})`}], {duration: 500, delay: 260 + i * 80, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'});
    });
  };
  st.cancels.push(ui.whenIdle(() => {
    if (st.dead) return;
    st.cancels.push(whenVisible(ring, start));
    // Safety: the ring may never reach 60% on screen (scrolled away at once); the streak row and the share
    // image must not wait on it forever.
    const t = setTimeout(afterCount, 2500);
    st.cancels.push(() => clearTimeout(t));
  }));
}

// Streak +1: the number rolls from n−1 the first time results show after a finish in this page session; the
// flame pops. Marked with data-roll by doneHTML.
function rollStreak(st, animate) {
  const n = st.el.querySelector('.c-rs-n');
  if (!n) return;
  const to = +n.dataset.n;
  if (!n.hasAttribute('data-roll') || rolled.has(daily.PNUM) || !to) { n.textContent = String(to); return; }
  if (!animate || ui.RM) { rolled.add(daily.PNUM); n.textContent = String(to); return; }
  const row = st.el.querySelector('.c-rstreak');
  st.cancels.push(whenVisible(row, () => {
    const t = setTimeout(() => {
      if (st.dead || rolled.has(daily.PNUM)) return;
      rolled.add(daily.PNUM);
      ui.odometer(n, to - 1, to);
      const f = row.querySelector('.c-flame');
      if (f) ui.stamp(f, {from: .45});
    }, 300);
    st.cancels.push(() => clearTimeout(t));
  }, {threshold: .9}));
}

function patchPost(st, {force = false} = {}) {
  const box = st.el.querySelector('[data-postbox]');
  if (!box) return;
  const ae = document.activeElement;
  if (ae && ae.id === 'nick-input' && box.contains(ae)) { st.postPending = true; return; }
  st.postPending = false;
  const kind = postKind();
  const rk = String(myRank());
  if (!force && box.dataset.kind === kind && (kind !== 'done' || box.dataset.rank === rk)) {
    if (kind === 'form') {
      // Patch in place: keep what was typed while the post goes through.
      const posting = daily.LB.status === 'posting';
      const btn = box.querySelector('.c-post-btn'), inp = box.querySelector('#nick-input'), notes = box.querySelector('.c-post-notes');
      if (btn) ui.setLoading(btn, posting);
      if (inp) inp.readOnly = posting;
      if (notes) { const h = postNotes(); if (notes.innerHTML !== h) notes.innerHTML = h; }
    }
    return;
  }
  const was = box.dataset.kind;
  box.dataset.kind = kind;
  box.dataset.rank = rk;
  const go = () => { box.innerHTML = postHTML(kind); };
  if (!ui.RM && st.ctx.visible && was !== kind) {
    go();
    ui.animate(box, [{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'none'}], {duration: 260, easing: 'cubic-bezier(.22,1,.36,1)'});
    const chk = box.querySelector('.c-post-done > .ic');
    if (chk) ui.stamp(chk, {from: .4});
  } else go();
}

function patchShare(st) {
  const pre = st.el.querySelector('.c-share-prev');
  if (pre) { const t = daily.shareText(); if (pre.textContent !== t) pre.textContent = t; }
}

async function prepareImage(st) {
  if (st.dead || st.phase !== 'done') return;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return;
  const gen = ++st.shareGen;
  const rank = myRank();
  let blob;
  try { blob = await renderShareCard({rank}); } catch (e) { console.warn(e); return; }
  if (st.dead || gen !== st.shareGen) return;
  const file = new File([blob], `gridiron-daily-${daily.PNUM}.png`, {type: 'image/png'});
  let ok = false;
  try { ok = navigator.canShare({files: [file]}); } catch (_) { ok = false; }
  st.file = ok ? file : null;
  st.fileRank = rank;
  const btn = st.el.querySelector('[data-share-img]');
  if (btn && ok && btn.hidden) {
    btn.hidden = false;
    if (!ui.RM) ui.animate(btn, [{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'none'}], {duration: 280, easing: 'cubic-bezier(.22,1,.36,1)'});
  }
}

function onClick(st, e) {
  const t = e.target.closest('[data-share], [data-share-native], [data-share-img], [data-streak], [data-goto], [data-lockin], [data-retry], [data-cd-load]');
  if (!t || !st.el.contains(t)) return;
  if (t.hasAttribute('data-share')) {
    const text = daily.shareText();
    const ta = st.el.querySelector('.c-share-ta');
    ui.copyText(text, {fallbackTextarea: ta}).then(ok => {
      // The fallback textarea only stays up when the text must be copied by hand (the preview already shows it).
      if (ok) { if (ta) ta.hidden = true; ui.toast(COPIED, {icon: 'check-circle'}); ui.haptic('success'); } else ui.toast('Select the text and copy it.');
    });
    return;
  }
  if (t.hasAttribute('data-share-native')) {
    ui.share({text: daily.shareText()}).then(r => { if (r === 'copied') ui.toast(COPIED, {icon: 'check-circle'}); });
    return;
  }
  if (t.hasAttribute('data-share-img')) {
    if (!st.file) return;
    ui.share({files: [st.file], text: daily.shareText()}).then(r => { if (r === 'copied') ui.toast(COPIED, {icon: 'check-circle'}); });
    return;
  }
  if (t.hasAttribute('data-streak')) { openStreakSheet(); return; }
  if (t.hasAttribute('data-goto')) { st.ctx.replace('/today/play/' + t.dataset.goto); return; }
  if (t.hasAttribute('data-lockin')) { lockIn(st); return; }
  if (t.hasAttribute('data-retry')) { retry(st); return; }
  if (t.hasAttribute('data-cd-load')) location.reload();
}

// "Try again": show the loading state for at least RETRY_HOLD so the tap visibly does something, then swap to
// whatever came back; a second failure says so. Focus follows to the new card's button.
function retry(st) {
  const body = st.el.querySelector('.c-rbody');
  if (!body || st.retrying) return;
  st.retrying = true;
  const hadFocus = body.contains(document.activeElement);
  const go = () => { body.innerHTML = loadingHTML(); };
  if (!ui.RM && st.ctx.visible) ui.crossfade(body, go, {duration: 160}); else go();
  if (hadFocus) focusQuiet(body.querySelector('.c-rload')); else ui.announce('Loading puzzles.');
  Promise.allSettled([daily.ensure(), new Promise(r => setTimeout(r, RETRY_HOLD))]).then(() => {
    st.retrying = false;
    if (st.dead) return;
    swapBody(st);
    if (daily.status === 'error') ui.toast("Still can't reach the puzzles.");
    if (hadFocus) focusQuiet(body.querySelector('[data-retry], [data-goto], .c-rhero'));
  });
}
function focusQuiet(el) {
  if (!el) return;
  if (!el.matches('button, a[href], input, [tabindex]')) el.setAttribute('tabindex', '-1');
  try { el.focus({preventScroll: true}); } catch (_) {}
}

async function lockIn(st) {
  const v = await ui.actionSheet({
    title: 'Lock in your score?',
    message: "Unfinished puzzles count as they are now. This can't be undone.",
    actions: [{label: 'Lock in', value: 'lock', role: 'destructive'}, {label: 'Keep playing', value: null, role: 'cancel'}],
    // Locked in: the trigger went with the old body, so focus lands on the score (tabindex -1) instead.
    returnFocus: () => (daily.allDone() && !st.dead ? st.el.querySelector('.c-rhero') || st.el.querySelector('.c-rbar-done') : null)
  });
  if (v !== 'lock' || st.dead || daily.allDone()) return;
  ui.haptic('warning');
  daily.lockIn();          // emits 'progress' → the body swaps to the finished state
  daily.maybeAutoPost();
  if (st.phase !== 'done') swapBody(st);
  const total = daily.totalPts();
  ui.announce(`Locked in. ${gradeTitle(daily.gradeFor(total))}. ${nf(total)} points.`);
}

function onSubmit(st, e) {
  const f = e.target.closest('[data-postform]');
  if (!f) return;
  e.preventDefault();
  const LB = daily.LB;
  if (LB.posting) return;
  const inp = f.querySelector('#nick-input');
  const v = (inp && inp.value) || '';
  if (!v.trim() && !LB.names[LB.uid]) { ui.toast('Add a name for the leaderboard.'); if (inp) inp.focus(); return; }
  if (inp) inp.blur();
  if (!LB.save) { ui.toast('Posting is off on this dev host.'); return; }
  daily.postScore(v);
}

function onDaily(st, type, d) {
  if (st.dead) return;
  if (type === 'ready' || type === 'error') { if (!st.retrying) swapBody(st); return; }
  if (type === 'progress') {
    patchBar(st);
    if (phase() !== st.phase) swapBody(st); else patchShare(st);
    return;
  }
  if (type === 'newday') { tickCountdown(st.el.querySelector('.c-cd-host'), {animate: st.ctx.visible}); return; }
  if (type === 'lb') {
    if (d && d.why === 'status') {
      if (daily.LB.status === 'posted') ui.haptic('success');
      else if (['failed', 'denied', 'full'].includes(daily.LB.status)) ui.haptic('warning');
    }
    patchPost(st);
    if (st.phase === 'done') {
      if (st.cancelImg) st.cancelImg();
      st.cancelImg = ui.whenIdle(() => { st.cancelImg = null; if (!st.dead && myRank() !== st.fileRank) prepareImage(st); });
    }
  }
}

// ============================================================================ View
export default {
  id: 'results',
  chrome: 'none',
  title: 'Results',

  render() {
    return barHTML() + `<div class="c-rbody">${bodyHTML()}</div>`;
  },

  mount(el, ctx) {
    ensureDefs();
    const st = {el, ctx, board: null, phase: null, revealed: false, cancels: [], shareGen: 0, file: null, fileRank: null, postPending: false, dead: false, cancelImg: null, imgQueued: false, retrying: false};
    RES.set(ctx, st);
    el.addEventListener('click', e => onClick(st, e));
    el.addEventListener('submit', e => onSubmit(st, e));
    el.addEventListener('focusout', e => { if (e.target && e.target.id === 'nick-input' && st.postPending) setTimeout(() => patchPost(st), 0); });
    // Hairline under the bar once content scrolls beneath it.
    const bar = el.querySelector('.c-rbar'), sent = el.querySelector('.c-rsent');
    if (bar && sent && typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver(es => { bar.classList.toggle('is-scrolled', !es[es.length - 1].isIntersecting); }, {root: ctx.screen, rootMargin: `-${Math.round(bar.offsetHeight || 56)}px 0px 0px 0px`});
      io.observe(sent);
      st.io = io;
    }
    ctx.on('daily', (type, d) => onDaily(st, type, d));
    ctx.timer(() => tickCountdown(el.querySelector('.c-cd-host'), {animate: ctx.visible}), 20000);
    attach(st);
    if (daily.status !== 'ready' && daily.status !== 'error') daily.ensure().catch(() => {});
  },

  onShow(ctx) {
    const st = RES.get(ctx);
    if (st) reveal(st);
  },

  update(ctx) {
    const st = RES.get(ctx);
    if (!st) return;
    if (st.board) st.board.refresh({animate: false});
    patchPost(st);
  },

  unmount(el, ctx) {
    const st = RES.get(ctx);
    if (!st) return;
    st.dead = true;
    if (st.cancelImg) st.cancelImg();
    if (st.io) st.io.disconnect();
    teardown(st);
    RES.delete(ctx);
  }
};
