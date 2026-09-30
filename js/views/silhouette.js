// Silhouettes (v2 and v3 days, contract "UI"): five rounds on v2 days (50 points each), two on v3 days (100 each),
// each a player's headshot drawn as a solid black silhouette with four names to pick from, one pick per round.
// Every count and points label comes from the day. Sub-module of the run cover. Owner: views.
//
// The headshot is ESPN's transparent PNG shown twice: a copy under `filter: brightness(0)` (the silhouette) and an
// unfiltered copy at opacity 0 that cross-fades in once the round is answered (opacity only). The player's name is
// never in the DOM (alt, title, aria, text) before his round is answered: both images have alt="", and the name
// plate is written at the reveal. A photo that fails to load shows a neutral placeholder with his position and
// current team as a clue; the round stays answerable.
//
// View-local state mirrors College's colShow: after a pick the stage stays on that player (verdict plus "Next face");
// "Next face" moves to the next unanswered round, or to the recap after the last. Rendered once; interactions patch nodes.
// The option buttons, marks, dots, verdict and recap reuse the College styles (college.css), so both puzzles answer
// the same way.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {MARKS, settle} from './college.js';
import {allAnswered} from './board.js';

const esc = data.esc;
const EASE_IN = 'cubic-bezier(.4,0,1,1)', EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const LOAD_WAIT = 4000; // a photo still loading after this shows the placeholder clue
// ESPN's image combiner serves the same transparent PNG resized (about half the bytes at the stage's size, 9 KB for a
// thumbnail); the full-size file is the fallback when the combiner fails. ESPN ids are digits.
const eid = e => String(e).replace(/[^0-9]/g, '');
const fullUrl = e => `https://a.espncdn.com/i/headshots/nfl/players/full/${eid(e)}.png`;
const sizedUrl = (e, w) => `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${eid(e)}.png&w=${w}&h=${Math.round(w * 436 / 600)}`;
const imgUrl = e => sizedUrl(e, 400);
const thumbUrl = e => sizedUrl(e, 96);
// Rounds from CLUE_FROM on would show his current team as a clue. None do: every face is a recognizable player
// (the generator's 60-day repeat window), so the team would give the answer away.
const CLUE_FROM = 5;
const hasClue = r => r >= CLUE_FROM;

const rounds = () => daily.DAY.s || [];
const total = () => rounds().length;
const Q = r => rounds()[r];
const picks = () => daily.DS.sil.a;
const answered = () => picks().length;
const nameOf = i => daily.PP[i][0];
const optName = (r, j) => nameOf(Q(r).o[j]);
const skipped = x => !(x >= 0); // lockIn fills unanswered rounds with -1
const perfect = () => daily.silDone() && daily.silScore() === total();
/** His current team (the last letter of his career path). */
function teamOf(i) {
  const p = daily.PP[i];
  return p[1] ? daily.PZ.teams[daily.TA.indexOf(p[1][p[1].length - 1])] || '' : '';
}
/** "Running back · Seahawks": the name plate's second line after the reveal. */
function lineOf(i) {
  const p = daily.PP[i];
  return [daily.POSN[p[2]] || p[2], teamOf(i)].filter(Boolean).join(' · ');
}
/** The no-photo clue: the four options share a position, so it is his team and draft instead
 *  ("Jets · 2023 draft, round 2", "Bills · Undrafted"). */
function clueOf(i) {
  const p = daily.PP[i];
  const draft = p[3] === 'U' ? 'Undrafted' : /^\d+$/.test(p[3]) ? `${p[4]} draft, round ${p[3]}` : `Since ${p[4]}`;
  return [teamOf(i), draft].filter(Boolean).join(' · ');
}
/** sr text for a stage: loading, a silhouette (with the team clue from CLUE_FROM on), or the missing photo's clue. */
function stageSr(r, state) {
  const q = Q(r), head = `Face ${r + 1} of ${total()}.`;
  if (state === 'loading') return `${head} Loading the photo.`;
  if (state === 'failed') return `${head} The photo didn't load. Clue: ${clueOf(q.p)}. Pick his name.`;
  return `${head} A player's silhouette.${hasClue(r) ? ` Clue: he plays for the ${teamOf(q.p)} now.` : ''} Pick his name.`;
}
function initialsOf(name) {
  const w = String(name).split(' ').filter(x => x && !/^(Jr\.?|Sr\.?|II|III|IV|V)$/.test(x));
  const L = w.map(x => (x.match(/[\p{L}\p{N}]/u) || [''])[0]).filter(Boolean);
  return (L.length > 2 ? L[0] + L[L.length - 1] : L.join('')).toUpperCase() || '?';
}

// Photos that failed this page session (by ESPN id): later renders go straight to the placeholder.
const failed = new Set();

// ---------------------------------------------------------------------------------------------- markup
function dotsLabel() {
  const a = picks();
  let right = 0, wrong = 0, skip = 0;
  a.forEach((x, r) => { if (skipped(x)) skip++; else if (x === Q(r).a) right++; else wrong++; });
  const left = total() - a.length;
  return [`${right} right`, (wrong || !skip) && `${wrong} wrong`, skip && `${skip} not answered`, left && `${left} to go`].filter(Boolean).join(', ');
}
const dotState = (a, r) => r >= a.length || skipped(a[r]) ? '' : a[r] === Q(r).a ? 'is-right' : 'is-wrong';
function dotsHTML(gold) {
  const a = picks();
  return Array.from({length: total()}, (_, r) => {
    const st = dotState(a, r);
    return `<i class="cl-dot${st ? ' ' + st : ''}${gold ? ' is-gold' : ''}"><b></b></i>`;
  }).join('');
}
function countText(showR) {
  if (showR != null) return `Face ${showR + 1} of ${total()}`;
  const a = picks();
  return a.some(skipped) ? `Locked in · ${a.filter(x => !skipped(x)).length} of ${total()} answered` : allAnswered(total());
}

/** The stage: spotlight, the two copies of the photo, the loading skeleton, the no-photo placeholder, the team clue
 *  (rounds 4-5) and the (empty until answered) name plate. */
function stageInner(r) {
  const q = Q(r), url = esc(imgUrl(q.e)), gone = failed.has(String(q.e));
  const img = cls => `<img class="sl-img ${cls}" src="${url}" alt="" draggable="false" decoding="async" referrerpolicy="no-referrer">`;
  return `<span class="sl-spot" aria-hidden="true"></span><span class="sl-glow" aria-hidden="true"></span>`
    + `<span class="sl-pics" aria-hidden="true">${img('sl-dark')}${img('sl-real')}</span>`
    + `<span class="sl-sk" aria-hidden="true"><i></i><b></b></span>`
    + `<span class="sl-ph" aria-hidden="true">${ui.icon('silhouette-fill')}</span>`
    + (hasClue(r) ? `<span class="sl-hint" aria-hidden="true"><span class="ovl">Plays for</span><span class="sl-hint-t">${esc(teamOf(q.p))}</span></span>` : '')
    // The no-photo clue is written only when the photo is missing (setFailed).
    + `<span class="sl-clue" aria-hidden="true"><span class="ovl">Clue</span><span class="sl-clue-t">${gone ? esc(clueOf(q.p)) : ''}</span></span>`
    + `<span class="sl-plate" data-sl-plate></span>`
    + `<span class="sr-only" data-sl-sr>${esc(stageSr(r, gone ? 'failed' : 'loading'))}</span>`;
}
function stageHTML(r) {
  const q = Q(r);
  const st = failed.has(String(q.e)) ? ' is-failed' : ' is-loading';
  return `<div class="sl-stage${st}${hasClue(r) ? ' has-hint' : ''}" data-sl-stage data-r="${r}">${stageInner(r)}</div>`;
}
function optHTML(r, j, wait) {
  return `<button type="button" class="cl-opt sl-opt" data-opt="${j}"${wait ? ' aria-disabled="true"' : ''}><span class="cl-ot">${esc(optName(r, j))}</span>${MARKS}<span class="sr-only" data-sr></span></button>`;
}
function playHTML(r) {
  const wait = !failed.has(String(Q(r).e)); // the stage starts loading: the options wait for the photo
  const opts = Q(r).o.map((_, j) => optHTML(r, j, wait)).join('');
  return `<div class="sl-wrap" data-sl-wrap>${stageHTML(r)}</div>`
    + `<div class="cl-opts sl-opts" role="group" aria-label="Who is it?" data-sl-opts>${opts}</div>`
    + `<div class="cl-verdict" data-sl-verdict hidden><p class="cl-vt" data-sl-vt></p>${ui.button({label: 'Next face', kind: 'primary', size: 's', attrs: {'data-sl-next': ''}})}</div>`;
}

function thumbHTML(i, e) {
  const init = `<span class="sl-ti" aria-hidden="true">${esc(initialsOf(nameOf(i)))}</span>`;
  const img = failed.has(String(e)) ? '' : `<img src="${esc(thumbUrl(e))}" alt="" draggable="false" decoding="async" loading="lazy" referrerpolicy="no-referrer">`;
  return `<span class="sl-thumb">${init}${img}</span>`;
}
function recapHTML(stampHidden) {
  const a = picks(), score = daily.silScore(), pts = daily.ptsSil();
  const rows = rounds().map((q, r) => {
    const x = a[r], ok = x === q.a, miss = !ok && skipped(x);
    const sub = ok ? lineOf(q.p) : miss ? 'Not answered.' : `You said ${optName(r, x).replace(/\.$/, '')}.`;
    const mark = ui.icon(ok ? 'check-circle' : 'x-circle', {cls: 'cl-ri ' + (ok ? 'tint' : miss ? 'ink3' : 'wrong'), label: ok ? 'Right' : miss ? 'Not answered' : 'Wrong'});
    return ui.row({lead: thumbHTML(q.p, q.e), title: nameOf(q.p), sub, trail: mark, cls: 'sl-rrow'});
  }).join('');
  const stamp = score === total() ? `<span class="rn-stamp cl-stamp sl-stamp" data-sl-stamp${stampHidden ? ' style="opacity:0"' : ''}>Sharp eye</span>` : '';
  return `<div class="cl-recap card sl-recap" data-sl-recap tabindex="-1" aria-label="${esc(`Silhouettes recap: ${score} of ${total()}, ${pts} points`)}" role="group">`
    + `<div class="cl-rh"><p class="cl-rs"><span class="n2">${score} of ${total()}</span><span class="n4 cl-rp ${pts ? 'tint' : 'ink3'}">+${esc(data.nf(pts))} pts</span></p>${stamp}</div>`
    + ui.group(rows, {cls: 'cl-rlist sl-rlist'})
    + `</div>`;
}

function render() {
  const n = answered();
  const showR = n < total() ? n : null;
  return `<div class="c-sil">`
    + `<div class="cl-prog"><span class="cl-count t-foot" data-sl-count>${esc(countText(showR))}</span>`
    + `<span class="cl-dots" role="img" aria-label="${esc(dotsLabel())}" data-sl-dots>${dotsHTML(showR == null && perfect())}</span></div>`
    + `<div class="sl-main" data-sl-main>${showR == null ? recapHTML(false) : playHTML(showR)}</div>`
    + `</div>`;
}

// ---------------------------------------------------------------------------------------------- behavior
function refs(I) {
  const q = s => I.el.querySelector(s);
  I.count = q('[data-sl-count]');
  I.dots = q('[data-sl-dots]');
  I.main = q('[data-sl-main]');
}

/** The options answer only once the stage shows something (the silhouette, or the no-photo clue). */
function syncOpts(I) {
  const stage = I.main.querySelector('[data-sl-stage]');
  const wait = !!stage && stage.classList.contains('is-loading');
  I.main.querySelectorAll('.sl-opt').forEach(b => { if (wait && !b.disabled) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); });
}

/** No photo: the neutral figure plus his team and draft as the clue (the round stays answerable). */
function setFailed(I, stage) {
  const r = +stage.dataset.r, q = Q(r);
  stage.querySelector('.sl-clue-t').textContent = clueOf(q.p);
  stage.classList.remove('is-loading');
  stage.classList.add('is-failed');
  const sr = stage.querySelector('[data-sl-sr]');
  if (sr && !stage.classList.contains('is-revealed')) sr.textContent = stageSr(r, 'failed');
  syncOpts(I);
}

/** Waits for the stage's silhouette to load (or fail) and shows it; a slow or failed photo shows the clue. A failed
 *  resized copy retries once with the full-size file before giving up. */
function watchStage(I, stage) {
  if (!stage) return;
  if (stage.classList.contains('is-failed')) { setFailed(I, stage); return; }
  if (!stage.classList.contains('is-loading')) return;
  const img = stage.querySelector('.sl-dark'), real = stage.querySelector('.sl-real');
  const r = +stage.dataset.r, e = String(Q(r).e);
  let over = false, retried = false;
  const show = ok => {
    if (I.dead || !stage.isConnected) return;
    if (ok) {
      if (!stage.classList.contains('is-revealed')) stage.querySelector('[data-sl-sr]').textContent = stageSr(r, 'ready');
      stage.classList.remove('is-loading', 'is-failed');
      stage.classList.add('is-ready');
      if (!over && !ui.RM) ui.animate(img, [{opacity: 0, transform: 'translateY(6px) scale(.98)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: EASE_OUT});
      syncOpts(I);
      preloadNext(I);
    } else if (!retried) {
      retried = true;
      img.src = fullUrl(e); real.src = fullUrl(e);
      return;
    } else {
      failed.add(e);
      setFailed(I, stage);
      preloadNext(I);
    }
    over = true;
  };
  // Already decoded (cached): shown at once, without the entrance.
  if (img.complete && img.naturalWidth > 0) { over = true; show(true); return; }
  // Still loading after LOAD_WAIT: the clue shows; if the photo arrives later it replaces the placeholder.
  const t = setTimeout(() => { if (!over && stage.isConnected && !I.dead) setFailed(I, stage); }, LOAD_WAIT);
  I.timers.push(t);
  img.addEventListener('load', () => { clearTimeout(t); show(img.naturalWidth > 0); });
  img.addEventListener('error', () => { if (retried) clearTimeout(t); show(false); });
  if (img.complete) show(false); // a cached failure
}

/** Warm the next rounds' photos so "Next face" never waits on the network. */
function preloadNext(I) {
  if (I.preloaded) return;
  I.preloaded = true;
  ui.onIdle(() => { if (!I.dead) warm(); });
}

// Warm every photo of the day (the run cover calls this when it opens, like grid.warm()), so round 1 does not start
// cold and "Next face" never waits on the network. Once per puzzle day; a v1 day has none.
let warmed = 0;
const warmImgs = [];
function warm() {
  if (!daily.DAY || !Array.isArray(daily.DAY.s) || warmed === daily.PNUM) return;
  warmed = daily.PNUM;
  warmImgs.length = 0;
  rounds().forEach(q => {
    if (failed.has(String(q.e))) return;
    const im = new Image();
    im.referrerPolicy = 'no-referrer';
    im.decoding = 'async';
    im.src = imgUrl(q.e);
    warmImgs.push(im);
  });
}

function paintDots(I, gold) {
  const a = picks();
  [...I.dots.children].forEach((d, r) => {
    const st = dotState(a, r);
    const was = d.classList.contains('is-right') ? 'is-right' : d.classList.contains('is-wrong') ? 'is-wrong' : '';
    d.classList.toggle('is-right', st === 'is-right');
    d.classList.toggle('is-wrong', st === 'is-wrong');
    if (gold != null) d.classList.toggle('is-gold', gold);
    if (st && !was) ui.animate(d, [{transform: 'scale(.4)'}, {transform: 'none'}], {spring: 'bouncy'});
  });
  I.dots.setAttribute('aria-label', dotsLabel());
}

function paintOptions(I, r, picked) {
  const ans = Q(r).a;
  I.main.querySelectorAll('.sl-opt').forEach(b => {
    const k = +b.dataset.opt;
    b.classList.remove('is-pressed');
    b.disabled = true;
    b.classList.add(k === ans ? (picked === ans ? 'is-right' : 'is-answer') : (k === picked ? 'is-wrong' : 'is-dim'));
    const sr = b.querySelector('[data-sr]');
    if (sr) sr.textContent = k === ans ? (picked === ans ? ', your pick, correct' : ', correct answer') : (k === picked ? ', your pick, wrong' : '');
  });
}

/** The reveal: the real photo cross-fades in over the silhouette (CSS opacity transitions), the spotlight takes the
 *  verdict's color, and the name plate rises in. */
function revealStage(I, r, correct) {
  const stage = I.main.querySelector('[data-sl-stage]');
  if (!stage) return;
  const q = Q(r);
  const plate = stage.querySelector('[data-sl-plate]');
  plate.innerHTML = `<span class="sl-pn">${esc(nameOf(q.p))}</span><span class="sl-pl">${esc(lineOf(q.p))}</span>`;
  stage.querySelector('[data-sl-sr]').textContent = `${nameOf(q.p)}, ${lineOf(q.p)}.`;
  stage.classList.add('is-revealed', correct ? 'is-right' : 'is-wrong');
  if (!ui.RM) {
    ui.animate(plate, [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {duration: 360, delay: 160, easing: EASE_OUT, fill: 'backwards'});
    const pics = stage.querySelector('.sl-pics');
    if (stage.classList.contains('is-ready')) ui.animate(pics, [{transform: 'scale(.97)'}, {transform: 'scale(1.015)', offset: .5}, {transform: 'none'}], {duration: 520, easing: 'ease-out'});
  }
}

function pick(I, j, btn, kb) {
  if (I.locked || I.showR != null) return;
  const r = answered();
  if (r >= total()) return;
  // Nothing to look at yet (the photo is loading): the pick waits; the options say so (aria-disabled).
  const stage = I.main.querySelector('[data-sl-stage]');
  if (stage && stage.classList.contains('is-loading')) return;
  ui.haptic('light');
  const res = daily.silPick(r, j);
  if (!res) return;
  I.showR = res.round;
  paintOptions(I, res.round, j);
  paintDots(I);
  revealStage(I, res.round, res.correct);
  const name = nameOf(res.p), pts = daily.PTS.sil; // per face: 50 (v2) or 100 (v3)
  const vt = res.correct ? `Correct. +${pts}` : `It was ${name}.`;
  const v = I.main.querySelector('[data-sl-verdict]');
  const vtEl = v.querySelector('[data-sl-vt]');
  vtEl.textContent = vt;
  vtEl.className = 'cl-vt ' + (res.correct ? 'is-right' : 'is-wrong');
  v.querySelector('.btn-label').textContent = res.round >= total() - 1 ? 'See how you did' : 'Next face';
  v.hidden = false;
  ui.animate(v, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
  ui.announce(res.correct ? `Correct. ${name}. +${pts}` : vt);
  if (res.correct) {
    ui.floatText(btn, `+${pts}`);
    ui.haptic('success');
  } else {
    ui.shake(btn);
    ui.haptic('error');
  }
  I.timers.push(setTimeout(() => { if (!I.dead) I.api.refreshChrome(); }, 220));
  if (kb) { const nb = v.querySelector('[data-sl-next]'); try { nb.focus({preventScroll: true}); } catch (_) {} }
  setTimeout(() => { if (!I.dead) I.api.reveal(v); }, 30);
}

// Next face: the answered stage flies off (College's card motion) and the next silhouette springs up in its place.
function advance(I, r, kb) {
  const release = I.api.busy();
  const wrap = I.main.querySelector('[data-sl-wrap]');
  const old = wrap.querySelector('[data-sl-stage]');
  old.removeAttribute('data-sl-stage');
  old.classList.add('sl-fly');
  old.setAttribute('aria-hidden', 'true');
  wrap.insertAdjacentHTML('afterbegin', stageHTML(r));
  const stage = wrap.querySelector('[data-sl-stage]');
  watchStage(I, stage);
  I.count.textContent = countText(r);
  const opts = I.main.querySelector('[data-sl-opts]');
  const btns = [...opts.querySelectorAll('.sl-opt')];
  Q(r).o.forEach((_, j) => {
    let b = btns[j];
    if (!b) { opts.insertAdjacentHTML('beforeend', optHTML(r, j)); b = opts.lastElementChild; }
    b.className = 'cl-opt sl-opt';
    b.disabled = false;
    b.querySelector('.cl-ot').textContent = optName(r, j);
    const sr = b.querySelector('[data-sr]');
    if (sr) sr.textContent = '';
  });
  btns.slice(Q(r).o.length).forEach(b => b.remove());
  syncOpts(I);
  I.main.querySelector('[data-sl-verdict]').hidden = true;

  let ended = false;
  const done = () => { if (ended) return; ended = true; old.remove(); release(); };
  if (ui.RM) {
    done();
    ui.animate(stage, [{opacity: 0}, {opacity: 1}], {duration: 180});
  } else {
    const fly = ui.animate(old, [{transform: 'none', opacity: 1}, {transform: 'translateX(-120%) rotate(-6deg)', opacity: 0}], {duration: 300, easing: EASE_IN, fill: 'forwards'});
    ui.animate(stage, [{transform: 'translateY(10px) scale(.95)', opacity: .4}, {transform: 'none', opacity: 1}], {spring: 'smooth'});
    [...opts.children].forEach((b, k) => ui.animate(b, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 260, easing: EASE_OUT, delay: 90 + k * 30, fill: 'backwards'}));
    settle(fly, 420).then(done);
  }
  I.api.reveal([stage, opts]);
  if (kb) { const f = opts.querySelector('.sl-opt'); if (f) try { f.focus({preventScroll: true}); } catch (_) {} }
}

function celebrate(I) {
  const dots = [...I.dots.children];
  dots.forEach((d, r) => {
    d.classList.add('is-gold');
    ui.animate(d.querySelector('b'), [{opacity: 0, transform: 'scale(.2)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy', delay: r * 80, fill: 'backwards'});
  });
  const sweep = `${total()} for ${total()}`;
  I.dots.setAttribute('aria-label', dotsLabel() + ', ' + sweep);
  const stamp = I.main.querySelector('[data-sl-stamp]');
  I.timers.push(setTimeout(() => {
    if (I.dead || !stamp) return;
    stamp.style.opacity = '';
    ui.stamp(stamp);
    ui.haptic('celebrate');
    ui.announce(`Sharp eye. ${sweep}.`);
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
  wireThumbs(I);
  I.count.textContent = countText(null);
  paintDots(I, false);
  const s = I.api.screen;
  if (s.scrollTop > 0) s.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
  const a = ui.animate(I.main, [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
  I.api.refreshChrome();
  if (kb) { const rc = I.main.querySelector('[data-sl-recap]'); if (rc) try { rc.focus({preventScroll: true}); } catch (_) {} }
  if (gold) celebrate(I);
  else ui.haptic('medium');
  settle(a, 700).then(() => { I.locked = false; release(); });
}

/** Recap thumbnails: a photo that fails falls back to the initials underneath. */
function wireThumbs(I) {
  I.main.querySelectorAll('.sl-thumb > img').forEach(img => {
    const bad = () => { img.remove(); };
    if (img.complete && !img.naturalWidth) bad();
    else img.addEventListener('error', bad, {once: true});
  });
}

function next(I, kb) {
  if (I.locked || I.showR == null) return;
  I.showR = null;
  const n = answered();
  if (n >= total()) toRecap(I, kb);
  else advance(I, n, kb);
}

function mount(el, ctx, api) {
  const I = {el, ctx, api, dead: false, locked: false, showR: null, timers: [], pre: [], preloaded: false};
  refs(I);
  watchStage(I, el.querySelector('[data-sl-stage]'));
  wireThumbs(I);
  el.addEventListener('click', e => {
    const opt = e.target.closest('.sl-opt');
    if (opt) { if (!opt.disabled) pick(I, +opt.dataset.opt, opt, e.detail === 0); return; }
    if (e.target.closest('[data-sl-next]')) next(I, e.detail === 0);
  });
  // Long-press on iOS would preview the unfiltered photo: the stage is not a context-menu target.
  el.addEventListener('contextmenu', e => { if (e.target.closest('.sl-stage')) e.preventDefault(); });
  return {
    // While a verdict shows, its "Next face" / "See how you did" is the next step (one primary action at a time).
    holdCta: () => I.showR != null,
    unmount() {
      I.dead = true;
      I.timers.forEach(clearTimeout);
      I.pre.length = 0;
    }
  };
}

export default {render, mount, warm};
