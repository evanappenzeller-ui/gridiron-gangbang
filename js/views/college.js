// College (spec 7.3): five players, pick the college each was drafted out of. Sub-module of the run cover.
// Owner: puzzle-run package.
//
// View-local state mirrors the old dstate.colShow: after a pick the card stays on that player (verdict plus
// "Next player"); "Next player" clears it and shows the next unanswered player, or the recap after five.
// Rendered once; every interaction patches individual nodes.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';

const esc = data.esc;
const EASE_IN = 'cubic-bezier(.4,0,1,1)', EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const MARKS = '<svg class="cl-mk cl-ck" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.6 4.6L19 7.6" pathLength="1"/></svg>'
  + '<svg class="cl-mk cl-x" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9" pathLength="1"/></svg>';

// Resolves when the animation ends, or after ms at the latest (a hidden page may never produce the frames
// that finish it; a lock must not depend on them).
const settle = (a, ms) => new Promise(res => { const f = () => res(); if (a && a.finished) a.finished.then(f, f); setTimeout(f, ms); });

const total = () => daily.DAY.c.length;
const Q = r => daily.DAY.c[r];
const optText = (r, j) => daily.PZ.CL[Q(r)[1][j]];
const pname = r => daily.PP[Q(r)[0]][0];
const answered = () => daily.DS.col.a.length;
const perfect = () => daily.colDone() && daily.colScore() === total();

// ---------------------------------------------------------------------------------------------- markup
// A locked-in score (daily.lockIn) fills the unanswered players with -1: those count as missed, not answered.
const skipped = x => !(x >= 0);
function dotsLabel() {
  const a = daily.DS.col.a;
  let right = 0, wrong = 0, skip = 0;
  a.forEach((x, r) => { if (skipped(x)) skip++; else if (x === Q(r)[2]) right++; else wrong++; });
  const left = total() - a.length;
  return [`${right} right`, (wrong || !skip) && `${wrong} wrong`, skip && `${skip} not answered`, left && `${left} to go`].filter(Boolean).join(', ');
}
const dotState = (a, r) => r >= a.length || skipped(a[r]) ? '' : a[r] === Q(r)[2] ? 'is-right' : 'is-wrong';
function dotsHTML(gold) {
  const a = daily.DS.col.a;
  return Array.from({length: total()}, (_, r) => {
    const st = dotState(a, r);
    return `<i class="cl-dot${st ? ' ' + st : ''}${gold ? ' is-gold' : ''}"><b></b></i>`;
  }).join('');
}
function countText(showR) {
  if (showR != null) return `Player ${showR + 1} of ${total()}`;
  const a = daily.DS.col.a;
  return a.some(skipped) ? `Locked in · ${a.filter(x => !skipped(x)).length} of ${total()} answered` : 'All five answered';
}

function peeksHTML(n) {
  return (n >= 2 ? '<span class="cl-peek cl-p2" aria-hidden="true"></span>' : '') + (n >= 1 ? '<span class="cl-peek cl-p1" aria-hidden="true"></span>' : '');
}
const peekCount = r => Math.max(0, Math.min(2, total() - 1 - r));
function cardInner(r) {
  const i = Q(r)[0];
  return `<p class="cl-name t-1">${esc(daily.PP[i][0])}</p><p class="cl-line t-sub">${esc(daily.playerLine(i))}</p>`;
}
function optHTML(r, j) {
  return `<button type="button" class="cl-opt" data-opt="${j}"><span class="cl-ot">${esc(optText(r, j))}</span>${MARKS}<span class="sr-only" data-sr></span></button>`;
}

function playHTML(r) {
  const opts = Q(r)[1].map((_, j) => optHTML(r, j)).join('');
  return `<div class="cl-stack" data-cl-stack>${peeksHTML(peekCount(r))}<div class="cl-card" data-cl-card>${cardInner(r)}</div></div>`
    + `<div class="cl-opts" role="group" aria-label="${esc('Colleges for ' + pname(r))}" data-cl-opts>${opts}</div>`
    + `<div class="cl-verdict" data-cl-verdict hidden><p class="cl-vt" data-cl-vt></p>${ui.button({label: 'Next player', kind: 'primary', size: 's', attrs: {'data-cl-next': ''}})}</div>`;
}

function recapHTML(stampHidden) {
  const ds = daily.DS, score = daily.colScore(), pts = daily.ptsCol();
  const rows = daily.DAY.c.map((q, r) => {
    const a = ds.col.a[r], ok = a === q[2];
    const right = daily.PZ.CL[q[1][q[2]]];
    const sub = ok ? right : (a >= 0 && a < q[1].length ? `${right}, not ${daily.PZ.CL[q[1][a]]}` : `${right}. Not answered.`);
    const miss = !ok && skipped(a);
    const lead = ui.icon(ok ? 'check-circle' : 'x-circle', {cls: 'cl-ri ' + (ok ? 'tint' : miss ? 'ink3' : 'wrong'), label: ok ? 'Right' : miss ? 'Not answered' : 'Wrong'});
    return ui.row({lead, title: daily.PP[q[0]][0], sub});
  }).join('');
  const stamp = score === total() ? `<span class="rn-stamp cl-stamp" data-cl-stamp${stampHidden ? ' style="opacity:0"' : ''}>5 for 5</span>` : '';
  return `<div class="cl-recap card" data-cl-recap tabindex="-1" aria-label="${esc(`College recap: ${score} of ${total()}, ${pts} points`)}" role="group">`
    + `<div class="cl-rh"><p class="cl-rs"><span class="n2">${score} of ${total()}</span><span class="n4 cl-rp ${pts ? 'tint' : 'ink3'}">+${esc(data.nf(pts))} pts</span></p>${stamp}</div>`
    + ui.group(rows, {cls: 'cl-rlist'})
    + `</div>`;
}

function render() {
  const n = answered();
  const showR = n < total() ? n : null;
  return `<div class="c-college">`
    + `<div class="cl-prog"><span class="cl-count t-foot" data-cl-count>${esc(countText(showR))}</span>`
    + `<span class="cl-dots" role="img" aria-label="${esc(dotsLabel())}" data-cl-dots>${dotsHTML(showR == null && perfect())}</span></div>`
    + `<div class="cl-main" data-cl-main>${showR == null ? recapHTML(false) : playHTML(showR)}</div>`
    + `</div>`;
}

// ---------------------------------------------------------------------------------------------- behavior
function refs(I) {
  const q = s => I.el.querySelector(s);
  I.count = q('[data-cl-count]');
  I.dots = q('[data-cl-dots]');
  I.main = q('[data-cl-main]');
}

function paintDots(I, gold) {
  const a = daily.DS.col.a;
  [...I.dots.children].forEach((d, r) => {
    const st = dotState(a, r);
    const was = d.classList.contains('is-right') ? 'is-right' : d.classList.contains('is-wrong') ? 'is-wrong' : '';
    d.classList.toggle('is-right', st === 'is-right');
    d.classList.toggle('is-wrong', st === 'is-wrong');
    if (gold != null) d.classList.toggle('is-gold', gold);
    // The color swaps instantly; a newly answered dot pops in (transform only).
    if (st && !was) ui.animate(d, [{transform: 'scale(.4)'}, {transform: 'none'}], {spring: 'bouncy'});
  });
  I.dots.setAttribute('aria-label', dotsLabel());
}

function paintOptions(I, r, picked) {
  const ans = Q(r)[2];
  I.main.querySelectorAll('.cl-opt').forEach(b => {
    const k = +b.dataset.opt;
    b.classList.remove('is-pressed');
    b.disabled = true;
    const st = k === ans ? (picked === ans ? 'is-right' : 'is-answer') : (k === picked ? 'is-wrong' : 'is-dim');
    b.classList.add(st);
    const sr = b.querySelector('[data-sr]');
    if (sr) sr.textContent = k === ans ? (picked === ans ? ', your pick, correct' : ', correct answer') : (k === picked ? ', your pick, wrong' : '');
  });
}

function pick(I, j, btn, kb) {
  if (I.locked || I.colShow != null) return;
  const r = answered();
  if (r >= total()) return;
  ui.haptic('light');
  const res = daily.colPick(j);
  if (!res) return;
  I.colShow = res.row;
  paintOptions(I, res.row, j);
  paintDots(I);
  const vt = res.correct ? `Correct. +${daily.PTS.col}` : `It was ${optText(res.row, res.ans)}.`;
  const v = I.main.querySelector('[data-cl-verdict]');
  const vtEl = v.querySelector('[data-cl-vt]');
  vtEl.textContent = vt;
  vtEl.className = 'cl-vt ' + (res.correct ? 'is-right' : 'is-wrong');
  v.querySelector('.btn-label').textContent = res.row >= total() - 1 ? 'See how you did' : 'Next player';
  v.hidden = false;
  ui.animate(v, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
  ui.announce(vt);
  if (res.correct) {
    ui.floatText(btn, `+${daily.PTS.col}`);
    ui.haptic('success');
  } else {
    ui.shake(btn);
    ui.haptic('error');
  }
  I.timers.push(setTimeout(() => { if (!I.dead) I.api.refreshChrome(); }, 220));
  if (kb) { const nb = v.querySelector('[data-cl-next]'); try { nb.focus({preventScroll: true}); } catch (_) {} }
  setTimeout(() => { if (!I.dead) I.api.reveal(v); }, 30);
}

function setPeeks(stack, n, animate) {
  stack.querySelectorAll('.cl-peek').forEach(p => p.remove());
  const card = stack.querySelector('[data-cl-card]');
  card.insertAdjacentHTML('beforebegin', peeksHTML(n));
  if (!animate) return;
  const p1 = stack.querySelector('.cl-p1'), p2 = stack.querySelector('.cl-p2');
  if (p1) ui.animate(p1, [{transform: 'translateY(16px) scale(.92)', opacity: .3}, {transform: 'translateY(8px) scale(.96)', opacity: .6}], {spring: 'smooth'});
  if (p2) ui.animate(p2, [{transform: 'translateY(24px) scale(.88)', opacity: 0}, {transform: 'translateY(16px) scale(.92)', opacity: .3}], {spring: 'smooth'});
}

// Picks are not gated on the fly-off: the new options are live as soon as they are painted (next() stays
// guarded by colShow). Only the busy hold follows the leaving clone.
function advance(I, r, kb) {
  const release = I.api.busy();
  const stack = I.main.querySelector('[data-cl-stack]');
  const card = stack.querySelector('[data-cl-card]');
  // The leaving card is a clone that flies off; the real card takes the next player and springs up from
  // the first peek position underneath it.
  const clone = card.cloneNode(true);
  clone.removeAttribute('data-cl-card');
  clone.classList.add('cl-fly');
  clone.setAttribute('aria-hidden', 'true');
  stack.appendChild(clone);
  card.innerHTML = cardInner(r);
  setPeeks(stack, peekCount(r), true);
  I.count.textContent = countText(r);
  const opts = I.main.querySelector('[data-cl-opts]');
  opts.setAttribute('aria-label', 'Colleges for ' + pname(r));
  const btns = [...opts.querySelectorAll('.cl-opt')];
  Q(r)[1].forEach((_, j) => {
    let b = btns[j];
    if (!b) { opts.insertAdjacentHTML('beforeend', optHTML(r, j)); b = opts.lastElementChild; }
    b.className = 'cl-opt';
    b.disabled = false;
    b.querySelector('.cl-ot').textContent = optText(r, j);
    const sr = b.querySelector('[data-sr]');
    if (sr) sr.textContent = '';
  });
  btns.slice(Q(r)[1].length).forEach(b => b.remove());
  const v = I.main.querySelector('[data-cl-verdict]');
  v.hidden = true;

  const fly = ui.animate(clone, [{transform: 'none', opacity: 1}, {transform: 'translateX(-120%) rotate(-6deg)', opacity: 0}], {duration: 300, easing: EASE_IN, fill: 'forwards'});
  ui.animate(card, [{transform: 'translateY(8px) scale(.96)', opacity: .5}, {transform: 'none', opacity: 1}], {spring: 'smooth'});
  [...opts.children].forEach((b, k) => ui.animate(b, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 260, easing: EASE_OUT, delay: 90 + k * 30, fill: 'backwards'}));
  let ended = false;
  const done = () => {
    if (ended) return;
    ended = true;
    clone.remove();
    release();
  };
  settle(fly, 420).then(done);
  I.api.reveal(stack);
  if (kb) { const f = opts.querySelector('.cl-opt'); if (f) try { f.focus({preventScroll: true}); } catch (_) {} }
}

function celebrate(I) {
  const dots = [...I.dots.children];
  dots.forEach((d, r) => {
    d.classList.add('is-gold');
    ui.animate(d.querySelector('b'), [{opacity: 0, transform: 'scale(.2)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy', delay: r * 80, fill: 'backwards'});
  });
  I.dots.setAttribute('aria-label', dotsLabel() + ', 5 for 5');
  const stamp = I.main.querySelector('[data-cl-stamp]');
  I.timers.push(setTimeout(() => {
    if (I.dead || !stamp) return;
    stamp.style.opacity = '';
    ui.stamp(stamp);
    ui.haptic('celebrate');
    ui.announce('5 for 5.');
    I.timers.push(setTimeout(() => {
      if (!I.dead && stamp.isConnected) ui.confetti(stamp.getBoundingClientRect(), {count: 24, colors: ['#7CF058', '#FFFFFF']});
    }, 140));
  }, dots.length * 80 + 160));
}

async function toRecap(I, kb) {
  I.locked = true;
  const release = I.api.busy();
  const fade = ui.animate(I.main, [{opacity: 1}, {opacity: 0}], {duration: 140, easing: 'linear', fill: 'forwards'});
  await settle(fade, 260);
  if (I.dead) { release(); return; }
  const gold = perfect();
  I.main.innerHTML = recapHTML(gold && !ui.RM);
  fade.cancel();
  I.count.textContent = countText(null);
  paintDots(I, false);
  const s = I.api.screen;
  if (s.scrollTop > 0) s.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
  const a = ui.animate(I.main, [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
  I.api.refreshChrome();
  if (kb) { const rc = I.main.querySelector('[data-cl-recap]'); if (rc) try { rc.focus({preventScroll: true}); } catch (_) {} }
  if (gold) celebrate(I);
  else ui.haptic('medium');
  settle(a, 700).then(() => { I.locked = false; release(); });
}

function next(I, kb) {
  if (I.locked || I.colShow == null) return;
  I.colShow = null;
  const n = answered();
  if (n >= total()) toRecap(I, kb);
  else advance(I, n, kb);
}

function mount(el, ctx, api) {
  const I = {el, ctx, api, dead: false, locked: false, colShow: null, timers: []};
  refs(I);
  el.addEventListener('click', e => {
    const opt = e.target.closest('.cl-opt');
    if (opt) { if (!opt.disabled) pick(I, +opt.dataset.opt, opt, e.detail === 0); return; }
    if (e.target.closest('[data-cl-next]')) next(I, e.detail === 0);
  });
  return {
    // While a verdict is showing, its in-card "Next player" / "See how you did" is the next step: the run's bottom
    // button stays secondary until then, so the screen never shows two primary actions at once.
    holdCta: () => I.colShow != null,
    unmount() {
      I.dead = true;
      I.timers.forEach(clearTimeout);
    }
  };
}

export default {render, mount};
