// Journey (v2 and v3 days, contract "UI"): a player's path from college to the team he plays for now, drawn as a
// vertical route; name him with the player picker in three guesses (250 / 150 / 75 on v2 days, 200 / 120 / 60 on v3,
// from the day's scoring). Each wrong guess unlocks a hint: position after the first, draft year and round after the
// second. Sub-module of the run cover. Owner: views.
//
// Rendered once; every guess patches the worth meter, one hint row, the wrong-guess chips and the actions. The
// worth meter, hint rows and chips reuse the Mystery player styles (mystery.css), so both "name him" puzzles read
// the same; the path is this module's own (journey.css).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {openPicker, sheetsGone} from './picker.js';

const esc = data.esc;
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const HINT_ICONS = ['figure', 'number'];
const HINT_AFTER = ['After 1 miss', 'After 2 misses'];
const GUESSES = 3;

const J = () => daily.DS.jr;
const worthOf = misses => daily.PTS.jr[Math.min(misses, GUESSES - 1)]; // 250 / 150 / 75 (v2) or 200 / 120 / 60 (v3)
const nameOf = i => daily.PP[i][0];
const wait = ms => new Promise(r => setTimeout(r, ms));
const ORD = ['1st', '2nd', '3rd'];
const ordinal = n => ORD[n - 1] || `${n}th`;

// Puzzle days whose path already drew in this page session (the draw-in plays once per day).
const drawn = new Set();

// ---------------------------------------------------------------------------------------------- markup
/** Stops in order: colleges (earliest first), then NFL teams in career order; the last team is "Now". A journeyman's
 *  middle teams (four or more teams in all) fold into one wrapped stop ("2nd to 5th teams: Bills · Browns · ..."), so
 *  the path, both hints and "Guess the player" fit above the bottom bar on a 360 x 740 phone. */
function stopsOf() {
  const P = daily.journeyPath() || {colleges: [], teams: [], current: null};
  const out = [];
  P.colleges.forEach((c, k) => out.push({kind: 'college', name: c, label: k ? 'Transfer' : 'College', aria: `${k ? 'Then college' : 'College'}: ${c}`}));
  const T = P.teams, n = T.length;
  T.forEach((t, k) => {
    const now = k === n - 1;
    if (n >= 4 && k > 0 && !now) {
      if (k > 1) return;                                   // folded into the stop made at k = 1
      const mid = T.slice(1, n - 1);
      out.push({kind: 'team', fold: true, name: mid.join(' · '), label: `${ordinal(2)} to ${ordinal(n - 1)} teams`,
        aria: `${ordinal(2)} to ${ordinal(n - 1)} NFL teams: ${daily.andList(mid)}`});
      return;
    }
    out.push({kind: 'team', name: t, now, label: now ? 'Now' : `${ordinal(k + 1)} team`, aria: now ? `Now: ${t}` : `${ordinal(k + 1)} NFL team: ${t}`});
  });
  // The segment from the last college into the first NFL team is the jump to the pros (dashed).
  const firstTeam = out.findIndex(s => s.kind === 'team');
  if (firstTeam > 0) out[firstTeam - 1].cross = true;
  return out;
}
function stopHTML(s, k, all) {
  const cls = `jr-stop is-${s.kind}${s.now ? ' is-now' : ''}${s.cross ? ' is-cross' : ''}${s.fold ? ' is-fold' : ''}`;
  // The route segment down to the next stop: a track, plus a tint layer that fades in when he is named.
  const line = k < all.length - 1 ? `<span class="jr-line" aria-hidden="true"><i></i></span>` : '';
  return `<li class="${cls}" style="--k:${k}" aria-label="${esc(s.aria)}">${line}`
    + `<span class="jr-node" aria-hidden="true">${ui.icon(s.kind === 'college' ? 'grad-cap' : 'shield')}</span>`
    + `<span class="jr-sm" aria-hidden="true"><span class="jr-sl ovl">${esc(s.label)}</span><span class="jr-sn${s.kind === 'team' ? ' jr-team' : ''}">${esc(s.name)}</span></span>`
    + `</li>`;
}

function pipsHTML(lit, gold) {
  return Array.from({length: GUESSES}, (_, k) => `<i class="my-pip${k < lit ? ' is-lit' : ''}${gold ? ' is-gold' : ''}"><b></b></i>`).join('');
}
function meterState(st) {
  if (st.done) return {label: 'Scored', val: daily.ptsJr(), lit: st.won ? GUESSES - st.g.length : 0, gold: st.won && st.g.length === 0};
  return {label: 'Worth', val: worthOf(st.g.length), lit: GUESSES - st.g.length, gold: false};
}

/** Hint rows (Mystery clue-row styles): unlocked after 1 and 2 misses; after the end every hint shows, the unneeded
 *  ones dimmed. */
function hintInner(j, clues, st) {
  const shown = st.done || j < st.g.length;
  const [k, v] = clues[j] || ['Hint', ''];
  const val = shown ? `<span class="my-val">${esc(v)}</span>` : `<span class="my-red" aria-hidden="true"></span>`;
  const cost = shown ? '' : `<span class="my-cost" aria-hidden="true">${ui.icon('lock')}<span>${HINT_AFTER[j]}</span></span>`;
  return `<span class="my-ci">${ui.icon(HINT_ICONS[j] || 'info')}</span><span class="my-cm"><span class="my-cl ovl">${esc(k)}</span><span class="my-cv">${val}</span></span>${cost}`;
}
function hintCls(j, st) {
  const shown = st.done || j < st.g.length;
  let c = 'my-clue jr-hint';
  if (!shown) c += ' is-locked';
  else if (st.done && j >= st.g.length) c += ' is-late';
  if (!st.done && j === st.g.length - 1) c += ' is-new';
  return c;
}
const hintLabel = (j, clues, st) => (st.done || j < st.g.length) ? null : `Hint ${j + 1}, ${(clues[j] || ['Hint'])[0]}, ${HINT_AFTER[j].toLowerCase()}`;

function revealHTML(st, {count0 = false, stampHidden = false} = {}) {
  const p = daily.DAY.j.p, pos = daily.PP[p][2];
  const n = daily.jrGuessNo(), pts = daily.ptsJr();
  const line = st.won
    ? `You got him on guess ${n} of ${GUESSES}. +<span class="jr-rp" data-jr-rp>${esc(data.nf(count0 ? 0 : pts))}</span> pts`
    : st.g.length >= GUESSES ? 'Three misses. He got away.' : 'Locked in before you named him.';
  const stamp = st.won && n === 1 ? `<span class="rn-stamp jr-stamp" data-jr-stamp${stampHidden ? ' style="opacity:0"' : ''}>No hints</span>` : '';
  return `<div class="jr-rh"><p class="jr-rname t-1">${esc(nameOf(p))}</p>${stamp}</div>`
    + `<p class="jr-rpos">${esc(`${daily.POSN[pos] || pos}, ${daily.yrs(p)}`)}</p>`
    + `<p class="jr-rline t-sub">${line}</p>`;
}

const chipHTML = i => ui.pill('✕ ' + nameOf(i), {tone: 'wrong', cls: 'my-chip', attrs: {role: 'listitem', 'aria-label': `Not ${nameOf(i)}`}});
const noteText = st => `Guess ${st.g.length + 1} of ${GUESSES}. Solving now is worth ${worthOf(st.g.length)} points.`;
const actionsHTML = st => ui.button({label: 'Guess the player', kind: 'primary', attrs: {'data-jr-guess': ''}})
  + `<p class="note jr-note" data-jr-note>${esc(noteText(st))}</p>`;

function render() {
  const st = J(), clues = daily.journeyClues(), m = meterState(st);
  const stops = stopsOf();
  const hints = clues.map((_, j) => {
    const lab = hintLabel(j, clues, st);
    return `<div class="${hintCls(j, st)}" role="listitem" data-j="${j}"${lab ? ` aria-label="${esc(lab)}"` : ''}>${hintInner(j, clues, st)}</div>`;
  }).join('');
  return `<div class="c-journey${st.done ? ' is-done' : ''}${st.won ? ' is-won' : ''}">`
    + `<section class="card jr-card" data-jr-card aria-label="Career path">`
    + `<div class="jr-top"><p class="jr-ovl ovl">${ui.icon('route')}<span>Career path</span></p>`
    + `<div class="my-worth" role="img" aria-label="${esc(`${m.label} ${m.val} points`)}" data-jr-worth>`
    + `<span class="my-wv"><span class="my-wl" data-jr-wl>${m.label}</span><span class="n4 my-wn" data-jr-wn>${esc(data.nf(m.val))}</span></span>`
    + `<span class="my-pips" data-jr-pips>${pipsHTML(m.lit, m.gold)}</span></div></div>`
    + `<ol class="jr-path${st.won ? ' is-lit' : ''}${stops.length > 4 ? ' is-compact' : ''}" aria-label="Career path, earliest first" data-jr-path>${stops.map(stopHTML).join('')}</ol>`
    + `<div class="jr-reveal" data-jr-reveal${st.done ? '' : ' hidden'}>${st.done ? revealHTML(st) : ''}</div>`
    + `</section>`
    + `<div class="group my-clues jr-hints" role="list" aria-label="Hints" data-jr-hints>${hints}</div>`
    + `<div class="jr-actions" data-jr-actions${st.done ? ' hidden' : ''}>${st.done ? '' : actionsHTML(st)}</div>`
    + `<div class="my-chips" role="list" aria-label="Wrong guesses" data-jr-chips${st.g.length ? '' : ' hidden'}>${st.g.map(chipHTML).join('')}</div>`
    + `</div>`;
}

// ---------------------------------------------------------------------------------------------- behavior
function refs(I) {
  const q = s => I.el.querySelector(s);
  I.root = q('.c-journey');
  I.card = q('[data-jr-card]');
  I.path = q('[data-jr-path]');
  I.worth = q('[data-jr-worth]');
  I.wl = q('[data-jr-wl]');
  I.wn = q('[data-jr-wn]');
  I.pips = q('[data-jr-pips]');
  I.reveal = q('[data-jr-reveal]');
  I.hints = q('[data-jr-hints]');
  I.actions = q('[data-jr-actions]');
  I.chips = q('[data-jr-chips]');
}

/** First view of the day's path this session: the stops drop in from the top and the route draws between them. */
function drawIn(I) {
  const key = daily.PNUM;
  if (drawn.has(key)) return;
  drawn.add(key);
  if (ui.RM) return;
  [...I.path.children].forEach((li, k) => {
    const d = 80 + k * 90;
    ui.animate(li.querySelector('.jr-node'), [{opacity: 0, transform: 'scale(.5)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy', delay: d, fill: 'backwards'});
    ui.animate(li.querySelector('.jr-sm'), [{opacity: 0, transform: 'translateX(-8px)'}, {opacity: 1, transform: 'none'}], {duration: 280, easing: EASE_OUT, delay: d + 40, fill: 'backwards'});
    const line = li.querySelector('.jr-line');
    if (line) ui.animate(line, [{transform: 'scaleY(0)'}, {transform: 'none'}], {duration: 260, easing: EASE_OUT, delay: d + 90, fill: 'backwards'});
  });
}

/** Blocks below a region that is about to change height glide from where they were (FLIP) instead of snapping. */
function glideBelow(nodes, mutate) {
  const els = nodes.filter(n => n && n.isConnected && !n.hidden);
  const y0 = els.map(n => n.getBoundingClientRect().top);
  mutate();
  if (ui.RM) return;
  els.forEach((n, k) => {
    if (n.hidden) return;
    const dy = y0[k] - n.getBoundingClientRect().top;
    if (Math.abs(dy) > .5) ui.animate(n, [{transform: `translateY(${dy}px)`}, {transform: 'none'}], {spring: 'smooth'});
  });
}

/** Reveal hint row j (the redaction cross-fades into the text). */
function revealHint(I, j, {late = false, animate = true} = {}) {
  const row = I.hints.querySelector(`[data-j="${j}"]`);
  if (!row || !row.classList.contains('is-locked')) return;
  const [, v] = I.clues[j];
  row.classList.remove('is-locked');
  row.classList.toggle('is-late', late);
  row.removeAttribute('aria-label');
  row.querySelector('.my-cost')?.remove();
  row.querySelector('.my-cv').insertAdjacentHTML('afterbegin', `<span class="my-val">${esc(v)}</span>`);
  const val = row.querySelector('.my-val'), red = row.querySelector('.my-red');
  if (!animate || ui.RM) {
    if (red) red.remove();
    if (animate) ui.animate(val, [{opacity: 0}, {opacity: 1}], {duration: 180});
    return;
  }
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
  const st = J();
  I.hints.querySelectorAll('.jr-hint').forEach(r => r.classList.toggle('is-new', !st.done && +r.dataset.j === st.g.length - 1));
}

/** Worth meter after a miss: a pip drops and fades, the difference floats off, the number counts down. */
function spendPip(I, fromMisses) {
  const st = J();
  const pips = [...I.pips.children];
  const k = GUESSES - 1 - fromMisses; // the rightmost lit pip goes first
  const p = pips[k];
  const from = worthOf(fromMisses), to = st.done ? 0 : worthOf(st.g.length);
  if (p && p.classList.contains('is-lit')) {
    p.classList.remove('is-lit');
    ui.floatText(p, `−${from - to}`, {cls: 'wrong'});
  }
  if (st.done) return;
  I.worth.setAttribute('aria-label', `Worth ${to} points`);
  if (ui.RM) I.wn.textContent = data.nf(to);
  else ui.countUp(I.wn, to, {from, duration: 500, format: 'int'});
}

function patchActions(I) {
  const note = I.actions.querySelector('[data-jr-note]');
  if (note) note.textContent = noteText(J());
}

function addChip(I, i) {
  I.chips.hidden = false;
  I.chips.insertAdjacentHTML('beforeend', chipHTML(i));
  ui.animate(I.chips.lastElementChild, [{opacity: 0, transform: 'scale(.6)'}, {opacity: 1, transform: 'none'}], {spring: 'bouncy'});
}

/** Solved: the route lights up stop by stop to "Now". */
function lightPath(I) {
  I.path.classList.add('is-lit');
  if (ui.RM) return;
  const lis = [...I.path.children];
  lis.forEach((li, k) => {
    const node = li.querySelector('.jr-node');
    ui.animate(node, [{transform: 'scale(1)'}, {transform: 'scale(1.18)', offset: .4}, {transform: 'none'}], {duration: 420, delay: k * 90, easing: 'ease-out'});
  });
}

async function finish(I, won, pre = '') {
  I.locked = true;
  const release = I.api.busy();
  try {
    const st = J();
    const s = I.api.screen;
    if (s.scrollTop > 2) {
      s.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
      const t0 = performance.now();
      while (s.scrollTop > 2 && performance.now() - t0 < 600) await wait(30);
    }
    if (I.dead) return;
    if (I.actions.contains(document.activeElement)) { try { I.card.setAttribute('tabindex', '-1'); I.card.focus({preventScroll: true}); } catch (_) {} }
    // Actions leave; every hint shows (the ones he never needed dimmed).
    glideBelow([I.chips], () => {
      I.actions.hidden = true;
      I.clues.forEach((_, j) => revealHint(I, j, {late: j >= st.g.length, animate: false}));
      markNewest(I);
    });
    I.hints.querySelectorAll('.jr-hint.is-late .my-val').forEach((v, k) => {
      ui.animate(v, [{opacity: 0}, {opacity: 1}], {duration: 240, delay: k * 40, fill: 'backwards'});
    });
    // Meter becomes the final score.
    const m = meterState(st);
    I.wl.textContent = m.label;
    I.wn.textContent = data.nf(m.val);
    I.worth.setAttribute('aria-label', `${m.label} ${m.val} points`);
    [...I.pips.children].forEach((p, k) => { p.classList.toggle('is-lit', k < m.lit); p.classList.toggle('is-gold', m.gold); });
    I.root.classList.add('is-done');
    I.root.classList.toggle('is-won', won);
    if (won) lightPath(I);
    await wait(ui.RM ? 0 : 260);
    if (I.dead) return;
    // The card grows by the reveal block; the hints and chips glide down under it instead of dropping.
    glideBelow([I.hints, I.chips], () => {
      I.reveal.innerHTML = revealHTML(st, {count0: won, stampHidden: true});
      I.reveal.hidden = false;
    });
    ui.animate(I.reveal, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
    const rp = I.reveal.querySelector('[data-jr-rp]');
    if (rp) ui.countUp(rp, daily.ptsJr(), {from: 0, duration: 700, format: 'int'});
    const name = nameOf(daily.DAY.j.p), n = daily.jrGuessNo();
    ui.announce(pre + (won ? `${name}. You got him on guess ${n} of ${GUESSES}. +${daily.ptsJr()} points.${n === 1 ? ' No hints.' : ''}` : `${name}. Three misses. He got away.`));
    I.api.refreshChrome();
    const stamp = I.reveal.querySelector('[data-jr-stamp]');
    if (stamp) {
      await wait(ui.RM ? 0 : 260);
      if (I.dead) return;
      stamp.style.opacity = '';
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

function guess(I, kb) {
  if (I.locked || J().done) return;
  ui.haptic('light');
  const g0 = I.actions.querySelector('[data-jr-guess]');
  if (g0) g0.classList.toggle('no-ring', !kb);
  const p = openPicker({kind: 'journey', title: 'Name the player', worth: worthOf(J().g.length), disabled: i => (J().g.includes(i) ? 'Guessed' : '')});
  p.then(async i => {
    if (i == null) return;
    const name = nameOf(i);
    const from = J().g.length;
    const r = daily.journeyGuess(i);
    if (r === 'dup') { ui.toast(`You already guessed ${name}.`); return; }
    if (r == null) return;
    await sheetsGone();
    if (I.dead) return;
    if (r === 'win') { finish(I, true); return; }
    addChip(I, i);
    ui.haptic('error');
    spendPip(I, from);
    if (r === 'lost') { finish(I, false, `Not ${name}. `); return; }
    // 'wrong': the next hint opens; one announcement carries both.
    glideBelow([I.actions, I.chips], () => revealHint(I, J().g.length - 1));
    markNewest(I);
    patchActions(I);
    const [lab, val] = I.clues[J().g.length - 1] || ['', ''];
    ui.announce(`Not ${name}.${lab ? ` Hint: ${lab}, ${val}.` : ''}`);
    I.api.refreshChrome();
    const g = I.actions.querySelector('[data-jr-guess]');
    if (g && g.isConnected) ui.shake(g);
    setTimeout(() => {
      if (I.dead) return;
      I.api.reveal([I.hints.querySelector(`[data-j="${J().g.length - 1}"]`), I.actions]);
    }, 60);
  });
}

function mount(el, ctx, api) {
  const I = {el, ctx, api, dead: false, locked: false, clues: daily.journeyClues()};
  refs(I);
  drawIn(I);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-jr-guess]')) guess(I, e.detail === 0);
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Tab') el.querySelectorAll('.no-ring').forEach(b => b.classList.remove('no-ring'));
  });
  return {unmount() { I.dead = true; }};
}

export default {render, mount};
