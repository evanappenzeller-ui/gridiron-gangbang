// Mystery player (spec 7.4): seven clues, fewer clues means more points. Sub-module of the run cover.
// Owner: puzzle-run package. Rendered once (all seven clue rows exist from the start); every action patches
// one clue row, the worth meter, the wrong-guess chips and the actions.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {openPicker, sheetsGone} from './picker.js';

const esc = data.esc;
const CLUE_ICONS = ['figure', 'chart', 'star', 'number', 'grad-cap', 'shield', 'letters'];
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';

const W = () => daily.DS.who;
const worthOf = clues => (8 - clues) * daily.PTS.who;
const nameOf = i => daily.PP[i][0];
function initialsOf(name) {
  const w = String(name).split(' ').filter(x => x && !/^(Jr\.?|Sr\.?|II|III|IV|V)$/.test(x));
  const L = w.map(x => (x.match(/[\p{L}\p{N}]/u) || [''])[0]).filter(Boolean);
  return (L.length > 2 ? L[0] + L[L.length - 1] : L.join('')).toUpperCase() || '?';
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------- markup
function clueInner(j, clues, st) {
  const [k, v] = clues[j];
  const shown = st.done || j < st.clues;
  const val = shown
    ? `<span class="my-val">${esc(v)}</span>`
    : `<span class="my-red" aria-hidden="true"></span>`;
  const cost = shown ? '' : `<span class="my-cost" aria-hidden="true">${ui.icon('lock')}<span>−${daily.PTS.who}</span></span>`;
  return `<span class="my-ci">${ui.icon(CLUE_ICONS[j] || 'info')}</span><span class="my-cm"><span class="my-cl ovl">${esc(k)}</span><span class="my-cv">${val}</span></span>${cost}`;
}
function clueCls(j, st) {
  const shown = st.done || j < st.clues;
  let c = 'my-clue';
  if (!shown) c += ' is-locked';
  else if (st.done && j >= st.clues) c += ' is-late'; // old .late: clues past the solve point (or lock-in)
  if (!st.done && j === st.clues - 1) c += ' is-new';
  return c;
}
function clueLabel(j, clues, st) {
  const shown = st.done || j < st.clues;
  return shown ? null : `Clue ${j + 1}, ${clues[j][0]}, locked`;
}

function pipsHTML(lit, gold) {
  return Array.from({length: 7}, (_, k) => `<i class="my-pip${k < lit ? ' is-lit' : ''}${gold ? ' is-gold' : ''}"><b></b></i>`).join('');
}
function meterState(st) {
  if (st.done) return {label: 'Scored', val: daily.ptsWho(), lit: st.won ? 8 - st.clues : 0, gold: st.won && st.clues === 1};
  return {label: 'Worth', val: worthOf(st.clues), lit: 8 - st.clues, gold: false};
}

function revealHTML(st, w, countFrom0) {
  const pts = daily.ptsWho();
  const line = st.won
    ? `You got him on clue ${st.clues} of 7. +<span class="my-rp" data-my-rp>${esc(data.nf(countFrom0 ? 0 : pts))}</span> pts`
    : 'He stumped you today.';
  return `<p class="my-rname t-1">${esc(nameOf(w))}</p><p class="my-rline t-sub">${line}</p>`;
}

function chipHTML(i) {
  return ui.pill('✕ ' + nameOf(i), {tone: 'wrong', cls: 'my-chip', attrs: {role: 'listitem', 'aria-label': `Not ${nameOf(i)}`}});
}

function noteText(st) { return `Clue ${st.clues} of 7. Solving now is worth ${worthOf(st.clues)} points.`; }

function render() {
  const st = W(), w = daily.DAY.w, clues = daily.whoClues(w), m = meterState(st);
  const firstBallot = st.done && st.won && st.clues === 1;
  const rows = clues.map((_, j) => {
    const lab = clueLabel(j, clues, st);
    return `<div class="${clueCls(j, st)}" role="listitem" data-key="c${j}" data-j="${j}"${lab ? ` aria-label="${esc(lab)}"` : ''}>${clueInner(j, clues, st)}</div>`;
  }).join('');
  const actions = st.done ? '' : actionsHTML(st);
  return `<div class="c-mystery">`
    + `<div class="card my-head" data-my-head>`
    + `<div class="my-top">`
    + `<div class="my-disc${st.done ? ' is-flipped' : ''}" aria-hidden="true" data-my-disc><span class="my-face my-front">${ui.icon('mystery')}</span><span class="my-face my-back${st.done && !st.won ? ' is-stumped' : ''}">${st.done ? esc(initialsOf(nameOf(w))) : ''}</span></div>`
    + `<p class="my-title t-3">Mystery player</p>`
    + `<div class="my-worth" role="img" aria-label="${esc(`${m.label} ${m.val} points`)}" data-my-worth>`
    + `<span class="my-wv"><span class="my-wl" data-my-wl>${m.label}</span><span class="n4 my-wn" data-my-wn>${esc(data.nf(m.val))}</span></span>`
    + `<span class="my-pips" data-my-pips>${pipsHTML(m.lit, m.gold)}</span></div>`
    + (firstBallot ? `<span class="rn-stamp my-stamp" data-my-stamp>First-ballot</span>` : '')
    + `</div>`
    + `<div class="my-reveal" data-my-reveal${st.done ? '' : ' hidden'}>${st.done ? revealHTML(st, w, false) : ''}</div>`
    + `</div>`
    + `<div class="group my-clues" role="list" aria-label="Clues" data-my-clues>${rows}</div>`
    + `<div class="my-chips" role="list" aria-label="Wrong guesses" data-my-chips${st.g.length ? '' : ' hidden'}>${st.g.map(chipHTML).join('')}</div>`
    + `<div class="my-actions" data-my-actions${st.done ? ' hidden' : ''}>${actions}</div>`
    + `</div>`;
}

function actionsHTML(st) {
  return ui.button({label: 'Guess the player', kind: 'primary', attrs: {'data-my-guess': ''}})
    + ui.button({label: ui.raw('Next clue <span class="my-minus">· −50</span>'), kind: 'secondary', cls: 'my-next', attrs: {'data-my-clue': '', 'aria-label': `Next clue, costs ${daily.PTS.who} points`, hidden: st.clues >= 7}})
    + `<p class="note my-note" data-my-note>${esc(noteText(st))}</p>`;
}

// ---------------------------------------------------------------------------------------------- behavior
function refs(I) {
  const q = s => I.el.querySelector(s);
  I.head = q('[data-my-head]');
  I.disc = q('[data-my-disc]');
  I.worth = q('[data-my-worth]');
  I.wl = q('[data-my-wl]');
  I.wn = q('[data-my-wn]');
  I.pips = q('[data-my-pips]');
  I.reveal = q('[data-my-reveal]');
  I.list = q('[data-my-clues]');
  I.chips = q('[data-my-chips]');
  I.actions = q('[data-my-actions]');
}

/** Reveal clue row j (cross-fade the redaction into the text; rows below glide if the row grows). */
function revealClue(I, j, {late = false, animate = true} = {}) {
  const row = I.list.querySelector(`[data-j="${j}"]`);
  if (!row || !row.classList.contains('is-locked')) return;
  const [, v] = I.clues[j];
  const mutate = () => {
    row.classList.remove('is-locked');
    row.classList.toggle('is-late', late);
    row.removeAttribute('aria-label');
    row.querySelector('.my-cost')?.remove();
    const cv = row.querySelector('.my-cv');
    cv.insertAdjacentHTML('afterbegin', `<span class="my-val">${esc(v)}</span>`);
  };
  if (!animate || ui.RM) {
    mutate();
    row.querySelector('.my-red')?.remove();
    if (animate) ui.animate(row.querySelector('.my-val'), [{opacity: 0}, {opacity: 1}], {duration: 180});
    return;
  }
  ui.flip(I.list, mutate, {fade: false});
  const val = row.querySelector('.my-val'), red = row.querySelector('.my-red');
  ui.animate(val, [{opacity: 0, transform: 'scale(.98)'}, {opacity: 1, transform: 'none'}], {duration: 240, easing: EASE_OUT});
  if (red) {
    const a = ui.animate(red, [{opacity: 1}, {opacity: 0}], {duration: 200, easing: 'linear', fill: 'forwards'});
    const rm = () => red.remove();
    a.finished.then(rm, rm);
  }
  const ic = row.querySelector('.my-ci');
  if (ic) ui.animate(ic, [{transform: 'scale(.7)'}, {transform: 'none'}], {spring: 'bouncy'});
}

function markNewest(I) {
  const st = W();
  I.list.querySelectorAll('.my-clue').forEach(r => r.classList.toggle('is-new', !st.done && +r.dataset.j === st.clues - 1));
}

/** Worth meter after a spent clue: one pip drops and fades, "−50" floats off, the number counts down. */
function spendPip(I, fromClues) {
  const st = W();
  const pips = [...I.pips.children];
  for (let k = 8 - st.clues; k < 8 - fromClues && k < pips.length; k++) {
    const p = pips[k];
    if (!p.classList.contains('is-lit')) continue;
    p.classList.remove('is-lit');
    ui.floatText(p, `−${daily.PTS.who}`, {cls: 'wrong'});
  }
  const to = worthOf(st.clues), from = worthOf(fromClues);
  I.worth.setAttribute('aria-label', `Worth ${to} points`);
  if (ui.RM) I.wn.textContent = data.nf(to);
  else ui.countUp(I.wn, to, {from, duration: 500, format: 'int'});
}

function patchActions(I) {
  const st = W();
  const note = I.actions.querySelector('[data-my-note]');
  if (note) note.textContent = noteText(st);
  const nb = I.actions.querySelector('[data-my-clue]');
  if (nb && st.clues >= 7 && !nb.hidden) {
    if (nb.contains(document.activeElement)) { const g = I.actions.querySelector('[data-my-guess]'); if (g) g.focus({preventScroll: true}); }
    nb.hidden = true;
  }
}

function nextClue(I) {
  if (I.locked) return;
  const from = W().clues;
  if (!daily.whoNextClue()) return;
  ui.haptic('light');
  revealClue(I, W().clues - 1);
  markNewest(I);
  spendPip(I, from);
  patchActions(I);
  ui.announce(`Clue ${W().clues}. ${I.clues[W().clues - 1][0]}: ${I.clues[W().clues - 1][1]}.`);
  I.api.refreshChrome();
  revealLatest(I);
}

/** Keep the newest clue and the actions in view together (after the reveal settles its height). */
function revealLatest(I) {
  setTimeout(() => {
    if (I.dead) return;
    const row = I.list.querySelector(`[data-j="${W().clues - 1}"]`);
    I.api.reveal([row, I.actions]);
  }, 60);
}

function addChip(I, i) {
  I.chips.hidden = false;
  I.chips.insertAdjacentHTML('beforeend', chipHTML(i));
  const c = I.chips.lastElementChild;
  ui.animate(c, [{opacity: 0, transform: 'scale(.6)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy'});
}

function flipDisc(I, won, animate) {
  const back = I.disc.querySelector('.my-back');
  back.textContent = initialsOf(nameOf(daily.DAY.w));
  back.classList.toggle('is-stumped', !won);
  I.disc.classList.add('is-flipped');
  if (!animate) return;
  if (ui.RM) { ui.animate(I.disc, [{opacity: 0}, {opacity: 1}], {duration: 150}); return; }
  ui.animate(I.disc, [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(180deg)'}], {spring: 'smooth'});
}

async function finish(I, won) {
  I.locked = true;
  const release = I.api.busy();
  try {
    const st = W(), w = daily.DAY.w;
    const s = I.api.screen;
    if (s.scrollTop > 2) {
      s.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
      const t0 = performance.now();
      while (s.scrollTop > 2 && performance.now() - t0 < 600) await wait(30);
    }
    if (I.dead) return;
    // Actions leave, the remaining clues come in (dimmed past the solve point), the disc flips.
    if (I.actions.contains(document.activeElement)) { try { I.head.setAttribute('tabindex', '-1'); I.head.focus({preventScroll: true}); } catch (_) {} }
    I.actions.hidden = true;
    ui.flip(I.list, () => {
      I.clues.forEach((_, j) => revealClue(I, j, {late: j >= st.clues, animate: false}));
      markNewest(I);
    }, {fade: false});
    I.list.querySelectorAll('.my-clue.is-late .my-val').forEach((v, k) => {
      ui.animate(v, [{opacity: 0}, {opacity: 1}], {duration: 240, delay: k * 40, fill: 'backwards'});
    });
    flipDisc(I, won, true);
    // Meter becomes the final score.
    const m = meterState(st);
    I.wl.textContent = m.label;
    I.wn.textContent = data.nf(m.val);
    I.worth.setAttribute('aria-label', `${m.label} ${m.val} points`);
    [...I.pips.children].forEach((p, k) => { p.classList.toggle('is-lit', k < m.lit); p.classList.toggle('is-gold', m.gold); });
    await wait(ui.RM ? 0 : 200);
    if (I.dead) return;
    I.reveal.innerHTML = revealHTML(st, w, won);
    I.reveal.hidden = false;
    ui.animate(I.reveal, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
    const rp = I.reveal.querySelector('[data-my-rp]');
    if (rp) ui.countUp(rp, daily.ptsWho(), {from: 0, duration: 700, format: 'int'});
    ui.announce(won ? `${nameOf(w)}. You got him on clue ${st.clues} of 7. +${daily.ptsWho()} points.${st.clues === 1 ? ' First-ballot.' : ''}` : `${nameOf(w)}. He stumped you today.`);
    I.api.refreshChrome();
    if (won && st.clues === 1) {
      await wait(ui.RM ? 0 : 260);
      if (I.dead) return;
      const top = I.head.querySelector('.my-top');
      top.insertAdjacentHTML('beforeend', `<span class="rn-stamp my-stamp" data-my-stamp>First-ballot</span>`);
      const stamp = top.querySelector('[data-my-stamp]');
      ui.stamp(stamp);
      ui.haptic('celebrate');
    } else if (won) {
      ui.haptic('success');
    }
  } finally {
    I.locked = false;
    release();
  }
}

function guess(I) {
  if (I.locked || W().done) return;
  ui.haptic('light');
  const st = W();
  const p = openPicker({kind: 'mystery', title: 'Name the player', worth: worthOf(st.clues), disabled: i => (W().g.includes(i) ? 'Guessed' : '')});
  p.then(async i => {
    if (i == null) return;
    const name = nameOf(i);
    const from = W().clues;
    const r = daily.whoGuess(i);
    if (r === 'dup') { ui.toast(`You already guessed ${name}.`); return; }
    if (r == null) return;
    await sheetsGone();
    if (I.dead) return;
    if (r === 'win') { finish(I, true); return; }
    addChip(I, i);
    ui.haptic('error');
    ui.announce(`Not ${name}.`);
    if (r === 'stumped') { finish(I, false); return; }
    // 'wrong': the next clue opens, same motion as "Next clue".
    revealClue(I, W().clues - 1);
    markNewest(I);
    spendPip(I, from);
    patchActions(I);
    I.api.refreshChrome();
    const g = I.actions.querySelector('[data-my-guess]');
    if (g && g.isConnected) ui.shake(g);
    revealLatest(I);
  });
}

function mount(el, ctx, api) {
  const I = {el, ctx, api, dead: false, locked: false, clues: daily.whoClues(daily.DAY.w)};
  refs(I);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-my-guess]')) { guess(I); return; }
    if (e.target.closest('[data-my-clue]')) nextClue(I);
  });
  return {unmount() { I.dead = true; }};
}

export default {render, mount};
