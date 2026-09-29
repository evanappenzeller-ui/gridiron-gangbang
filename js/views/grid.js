// Grid (spec 7.5): name a player for each row x column square. Sub-module of the run cover.
// Owner: puzzle-run package. Rendered once; a guess patches only its cell (with the flip), the corner ring and
// the footer. Cells stay <button>s for their whole life so focus can return to the tapped square.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {openPicker, sheetsGone, critIcon} from './picker.js';

const esc = data.esc;
const RULE_NOTE = 'Draft squares count drafts from 1980 on. College squares count any school a player attended.';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.6 4.6L19 7.6"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>';

const rowC = k => daily.DAY.g[Math.floor(k / 3)];
const colC = k => daily.DAY.g[3 + (k % 3)];
const diag = k => Math.floor(k / 3) + (k % 3);
const cells = () => daily.DS.grid.cells;
const nameOf = i => daily.PP[i][0];
const wait = ms => new Promise(r => setTimeout(r, ms));

// Examples ("Try {name}") exclude every player on the grid, like the old gridBody. All nine come from one pass
// over the players with pre-parsed criteria (same rules as daily.critOk, same pick as daily.exampleFor: the
// most famous fit, first index on ties), so a finished grid renders in a few ms instead of nine full scans.
function matcher(c) {
  const [k, v] = String(c).split(':');
  if (k === 't') { const ch = daily.TA[+v]; return p => p[1].includes(ch); }
  if (k === 'p') return p => p[2] === v;
  if (k === 'd') return p => p[3] === v;
  if (k === 'c') { const ch = daily.TA[+v]; return p => p[6].includes(ch); }
  return () => false;
}
function examplesAll(exclude) {
  const g = daily.DAY.g, PP = daily.PP;
  const R = g.slice(0, 3).map(matcher), C = g.slice(3, 6).map(matcher);
  const best = Array(9).fill(-1);
  for (let i = 0; i < PP.length; i++) {
    if (exclude.has(i)) continue;
    const p = PP[i];
    let rm = 0, cm = 0;
    for (let r = 0; r < 3; r++) if (R[r](p)) rm |= 1 << r;
    if (!rm) continue;
    for (let c = 0; c < 3; c++) if (C[c](p)) cm |= 1 << c;
    if (!cm) continue;
    for (let r = 0; r < 3; r++) {
      if (!(rm & (1 << r))) continue;
      for (let c = 0; c < 3; c++) {
        if (!(cm & (1 << c))) continue;
        const k = r * 3 + c;
        if (best[k] < 0 || p[7] > PP[best[k]][7]) best[k] = i;
      }
    }
  }
  return best;
}
let exCache = {key: '', best: null};
function example(k) {
  const used = cells().filter(Boolean).map(c => c.p);
  const key = daily.PNUM + ':' + used.join(',');
  if (exCache.key !== key) exCache = {key, best: examplesAll(new Set(used))};
  return exCache.best[k];
}

// DEEP CUT: daily.deepCut scans every player the first time a square is asked (~5 ms). Squares already asked
// are "warm"; render only asks warm squares and the rest are filled in at idle (see warm() and mount()).
const deepWarm = new Set();
const deepKey = k => daily.PNUM + ':' + k;
const isDeep = k => {
  const c = cells()[k];
  if (!c || !c.ok) return false;
  const v = !!daily.deepCut(Math.floor(k / 3), k % 3, c.p);
  deepWarm.add(deepKey(k));
  return v;
};
const deepKnown = k => deepWarm.has(deepKey(k));
/** Warm DEEP CUT for every correct square, one square per idle callback (the run cover calls it on mount). */
function warm(done) {
  if (daily.status !== 'ready' || !daily.DS.grid) return;
  const todo = [];
  for (let k = 0; k < 9; k++) { const c = cells()[k]; if (c && c.ok && !deepKnown(k)) todo.push(k); }
  const step = () => {
    const k = todo.shift();
    if (k == null) { if (done) done(); return; }
    isDeep(k);
    ui.onIdle(step, 1000);
  };
  ui.onIdle(step, 1000);
}

// ---------------------------------------------------------------------------------------------- markup
function cellState(k) {
  const c = cells()[k];
  if (c) return c.ok ? 'is-ok' : 'is-no';
  return daily.gridDone() ? 'is-miss' : 'is-open';
}
// lazy: only ask warm DEEP CUT squares (render); unknown squares are patched in at idle by mount().
const deepFor = (k, lazy) => (lazy && !deepKnown(k)) ? false : isDeep(k);
function cellLabel(k, lazy) {
  const r = daily.critLabel(rowC(k)), c = daily.critLabel(colC(k));
  const cell = cells()[k];
  if (!cell) {
    if (!daily.gridDone()) return `Guess for ${r} and ${c}`;
    const ex = example(k);
    return `${r} and ${c}: missed.${ex >= 0 ? ` Try ${nameOf(ex)}.` : ''}`;
  }
  const ex = !cell.ok && daily.gridDone() ? example(k) : -1;
  return `${r} and ${c}: ${nameOf(cell.p)}, ${cell.ok ? 'correct' : 'wrong'}${cell.ok && deepFor(k, lazy) ? ', deep cut' : ''}${ex >= 0 ? `. Try ${nameOf(ex)}.` : ''}`;
}
function cellInner(k, lazy) {
  const c = cells()[k];
  if (!c) {
    if (!daily.gridDone()) return `<span class="gc-plus">${ui.icon('plus')}</span>`;
    const ex = example(k);
    return ex >= 0 ? `<span class="gc-try">Try ${esc(nameOf(ex))}</span>` : '';
  }
  if (c.ok) {
    return `<span class="gc-name">${esc(nameOf(c.p))}</span><span class="gc-badge">${CHECK}</span>`
      + (deepFor(k, lazy) ? `<span class="gc-deep">${ui.badge('deep')}</span>` : '');
  }
  const ex = daily.gridDone() ? example(k) : -1;
  return `<span class="gc-name">${esc(nameOf(c.p))}</span><span class="gc-badge">${CROSS}</span>`
    + (ex >= 0 ? `<span class="gc-try">Try ${esc(nameOf(ex))}</span>` : '');
}
function cellHTML(k) {
  const st = cellState(k);
  const pending = st === 'is-ok' && !deepKnown(k);
  return `<button type="button" class="gc ${st}" data-k="${k}" aria-label="${esc(cellLabel(k, true))}"${st === 'is-open' ? '' : ' aria-disabled="true"'}${pending ? ' data-deep-pending' : ''}>${cellInner(k, true)}</button>`;
}

const R = 14, CIRC = 2 * Math.PI * R;
function cornerHTML() {
  const n = daily.gridScore(), f = n / 9, gold = n === 9;
  return `<div class="gd-corner${gold ? ' is-gold' : ''}" role="img" aria-label="${n} of 9 correct" data-gd-corner>`
    + `<svg class="gd-ring" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle class="gd-rt" cx="16" cy="16" r="${R}"/>`
    + `<circle class="gd-rf" cx="16" cy="16" r="${R}" transform="rotate(-90 16 16)" stroke-dasharray="${CIRC.toFixed(3)} ${CIRC.toFixed(3)}" style="stroke-dashoffset:${(CIRC * (1 - f)).toFixed(3)}"/></svg>`
    + `<span class="n5 gd-n" data-gd-n>${n}/9</span></div>`;
}
function headHTML(c, cls) {
  return `<div class="${cls}"><span class="gd-hi">${ui.icon(critIcon(c))}</span><span class="gd-t">${esc(daily.critLabel(c))}</span></div>`;
}
function footHTML() {
  if (!daily.gridDone()) return ui.button({label: 'Give up the empty squares', kind: 'destructive', cls: 'gd-give', attrs: {'data-gd-give': ''}});
  return `<p class="note gd-done">${daily.gridScore()} of 9 for ${daily.ptsGrid()} points. Each square you missed shows one player who would have worked.</p>`;
}

function render() {
  const g = daily.DAY.g;
  let h = cornerHTML() + g.slice(3).map(c => headHTML(c, 'gd-ch')).join('');
  for (let r = 0; r < 3; r++) {
    h += headHTML(g[r], 'gd-rh');
    for (let c = 0; c < 3; c++) h += cellHTML(r * 3 + c);
  }
  return `<div class="c-grid">`
    + `<div class="gd" data-gd>${h}</div>`
    + `<div class="gd-foot" data-gd-foot>${footHTML()}</div>`
    + `<p class="note gd-rule">${esc(RULE_NOTE)}</p>`
    + `</div>`;
}

// ---------------------------------------------------------------------------------------------- behavior
function paintCell(cell, k) {
  cell.className = `gc ${cellState(k)}${cell.classList.contains('no-ring') ? ' no-ring' : ''}`;
  cell.innerHTML = cellInner(k);
  cell.setAttribute('aria-label', cellLabel(k));
  if (cellState(k) === 'is-open') cell.removeAttribute('aria-disabled');
  else cell.setAttribute('aria-disabled', 'true');
}

function paintCorner(I) {
  const n = daily.gridScore();
  I.corner.classList.toggle('is-gold', n === 9);
  I.corner.setAttribute('aria-label', `${n} of 9 correct`);
  I.corner.querySelector('[data-gd-n]').textContent = `${n}/9`;
  I.corner.querySelector('.gd-rf').style.strokeDashoffset = (CIRC * (1 - n / 9)).toFixed(3);
}

function paintFoot(I) {
  const foot = I.el.querySelector('[data-gd-foot]');
  const html = footHTML();
  if (foot._html === html) return;
  foot._html = html;
  const hadFocus = foot.contains(document.activeElement);
  foot.innerHTML = html;
  ui.animate(foot, [{opacity: 0}, {opacity: 1}], {duration: 200});
  if (hadFocus) { try { I.cellEls[0].focus({preventScroll: true}); } catch (_) {} }
}

const cellEl = (I, k) => I.cellEls[k];

/** Flip a cell (rotateX, content swaps at the midpoint). The paint is guaranteed even when the page produces
 *  no animation frames (hidden page): after 700 ms the cell is painted without motion. */
async function flipTo(cell, k) {
  let painted = false;
  // A DEEP CUT sticker waits (hidden) for its own slap after the flip.
  const paint = () => { painted = true; paintCell(cell, k); const dp = cell.querySelector('.gc-deep'); if (dp) dp.style.opacity = '0'; };
  const p = ui.flipCard(cell, {axis: 'x', onHalf: paint});
  await Promise.race([p, wait(700)]);
  if (!painted) {
    cell.getAnimations().forEach(a => a.cancel());
    paint();
  }
}

function slapDeep(cell) {
  const d = cell.querySelector('.gc-deep');
  if (!d) return;
  d.style.opacity = '';
  if (!ui.RM) ui.animate(d, [{scale: '1.4', opacity: 0}, {scale: '1', opacity: 1}], {spring: 'bouncy'});
  const tw = document.createElement('span');
  tw.className = 'gc-twinkle';
  tw.setAttribute('aria-hidden', 'true');
  tw.innerHTML = ui.icon('sparkle');
  d.appendChild(tw);
  const a = ui.animate(tw, [{opacity: 0, transform: 'scale(.2) rotate(-30deg)'}, {opacity: 1, transform: 'scale(1) rotate(0deg)', offset: .45}, {opacity: 0, transform: 'scale(.6) rotate(25deg)'}], {duration: 700, delay: 160, easing: 'ease-out', fill: 'both'});
  const rm = () => tw.remove();
  a.finished.then(rm, rm);
}

/** After the grid ends: wrong squares gain their "Try" line, open squares flip to theirs in a diagonal wave. */
async function onDone(I, {wave}) {
  exCache = {key: '', best: null};
  const jobs = [];
  for (let k = 0; k < 9; k++) {
    const el = cellEl(I, k), st = cellState(k);
    if (st === 'is-miss') {
      const go = () => flipTo(el, k);
      jobs.push(wave && !ui.RM ? wait(diag(k) * 60).then(go) : go());
    } else if (st === 'is-no') {
      paintCell(el, k);
      const t = el.querySelector('.gc-try');
      if (t) ui.animate(t, [{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: 260, delay: diag(k) * 40, fill: 'backwards'});
    }
    // Correct squares do not change when the grid ends.
  }
  await Promise.all(jobs);
  paintFoot(I);
}

function immaculate(I) {
  I.corner.classList.add('is-gold');
  if (!ui.RM) {
    I.cellEls.forEach((el, k) => {
      ui.animate(el, [{transform: 'scale(1)'}, {transform: 'scale(1.04)', offset: .45}, {transform: 'scale(1)'}], {duration: 380, delay: diag(k) * 40, easing: 'ease-in-out'});
      const glow = document.createElement('span');
      glow.className = 'gc-glow';
      glow.setAttribute('aria-hidden', 'true');
      el.appendChild(glow);
      const a = ui.animate(glow, [{opacity: 0}, {opacity: 1, offset: .4}, {opacity: 0}], {duration: 520, delay: diag(k) * 40, fill: 'both'});
      const rm = () => glow.remove();
      a.finished.then(rm, rm);
    });
    ui.animate(I.corner, [{scale: '1.25'}, {scale: '1'}], {spring: 'bouncy', delay: 200});
  }
  ui.toast('Immaculate.', {icon: 'sparkle'});
  ui.haptic('celebrate');
}

async function onPick(I, k, i, cell) {
  const refocus = () => sheetsGone().then(() => { if (!I.dead) restoreFocus(cell); });
  if (i == null) { refocus(); return; }
  const name = nameOf(i);
  const res = daily.gridGuess(k, i);
  if (res === 'dup') { ui.toast(`${name} is already on your grid.`); refocus(); return; }
  if (res == null) { refocus(); return; }
  const release = I.api.busy();
  try {
    await sheetsGone();
    if (I.dead) return;
    restoreFocus(cell);
    I.api.reveal(cell);
    await flipTo(cell, k);
    if (I.dead) return;
    const deep = res === 'ok' && isDeep(k);
    if (res === 'ok') {
      ui.floatText(cell, `+${daily.PTS.grid}`);
      ui.announce(`Correct. +${daily.PTS.grid}${deep ? '. Deep cut.' : ''}`);
      if (deep) { slapDeep(cell); ui.haptic('celebrate'); } else ui.haptic('success');
    } else {
      ui.announce(`${name} doesn't fit that square.`);
      ui.haptic('error');
    }
    paintCorner(I);
    I.api.refreshChrome();
    if (daily.gridDone()) {
      await onDone(I, {wave: false});
      if (daily.gridScore() === 9) immaculate(I);
      I.api.refreshChrome();
    }
  } finally {
    release();
  }
}

function restoreFocus(cell) {
  if (!cell || !cell.isConnected) return;
  try { cell.focus({preventScroll: true}); } catch (_) {}
}

function tapCell(I, cell, kb) {
  const k = +cell.dataset.k;
  if (!cell.classList.contains('is-open') || daily.gridDone() || cells()[k]) return;
  ui.haptic('light');
  // Keyboard users keep the focus ring when focus comes back to the square; pointer users do not get one.
  cell.classList.toggle('no-ring', !kb);
  // The sheet returns focus to its trigger; make the square the trigger even where taps do not focus buttons (iOS).
  if (document.activeElement !== cell) restoreFocus(cell);
  const used = new Set(cells().filter(Boolean).map(c => c.p));
  openPicker({kind: 'grid', criteria: [rowC(k), colC(k)], disabled: j => (used.has(j) ? 'On your grid' : '')})
    .then(i => onPick(I, k, i, cell));
}

async function giveUp(I) {
  if (daily.gridDone()) return;
  const empty = cells().filter(c => !c).length;
  const pts = daily.ptsGrid();
  const v = await ui.actionSheet({
    title: `Give up ${empty} square${empty === 1 ? '' : 's'}?`,
    message: `You'll keep ${data.nf(pts)} points and see one player who fits each empty square.`,
    actions: [{label: 'Give up', value: 'give', role: 'destructive'}, {label: 'Keep playing', value: null, role: 'cancel'}]
  });
  if (v !== 'give' || daily.gridDone()) return;
  ui.haptic('warning');
  daily.gridGiveUp();
  const release = I.api.busy();
  try {
    await sheetsGone();
    if (I.dead) return;
    I.api.refreshChrome();
    I.api.reveal(I.el.querySelector('[data-gd]'));
    await onDone(I, {wave: true});
    ui.announce(`${daily.gridScore()} of 9 for ${daily.ptsGrid()} points.`);
    I.api.refreshChrome();
  } finally {
    release();
  }
}

function mount(el, ctx, api) {
  const I = {el, ctx, api, dead: false};
  I.corner = el.querySelector('[data-gd-corner]');
  I.cellEls = [...el.querySelectorAll('.gc[data-k]')].sort((a, b) => a.dataset.k - b.dataset.k);
  el.querySelector('[data-gd-foot]')._html = footHTML();
  el.addEventListener('click', e => {
    const cell = e.target.closest('.gc[data-k]');
    if (cell) { tapCell(I, cell, e.detail === 0); return; }
    if (e.target.closest('[data-gd-give]')) giveUp(I);
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow')) I.cellEls.forEach(c => c.classList.remove('no-ring'));
  });
  // DEEP CUT stickers for squares that were not warm at render time appear at idle (no motion; they are old news).
  const pending = I.cellEls.filter(c => c.hasAttribute('data-deep-pending'));
  if (pending.length) {
    warm(() => {
      if (I.dead) return;
      pending.forEach(c => {
        c.removeAttribute('data-deep-pending');
        const k = +c.dataset.k;
        if (cellState(k) !== 'is-ok') return;
        if (isDeep(k) && !c.querySelector('.gc-deep')) {
          c.insertAdjacentHTML('beforeend', `<span class="gc-deep">${ui.badge('deep')}</span>`);
          ui.animate(c.lastElementChild, [{opacity: 0}, {opacity: 1}], {duration: 200});
        }
        c.setAttribute('aria-label', cellLabel(k));
      });
    });
  }
  return {unmount() { I.dead = true; }};
}

export default {render, mount, warm};
