// Grid (spec 7.5): name a player for each row x column square. Sub-module of the run cover.
// Owner: puzzle-run package. Rendered once; a guess patches only its cell (with the flip), the corner ring and
// the footer. Cells stay <button>s for their whole life so focus can return to the tapped square.
//
// The shape comes from the day (daily.gridShape): v1 and v2 days are 3 x 3 (the classic layout, unchanged); a v3
// day is one row criterion x two column criteria, drawn as its own layout: the row criterion as a banner that forks
// into two column headers over two large squares (see grid.css "One-row grids").
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {openPicker, sheetsGone, critIcon} from './picker.js';

const esc = data.esc;
const RULE_NOTE = 'Draft squares count drafts from 1980 on. College squares count any school a player attended.';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.6 4.6L19 7.6"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>';

const shape = () => daily.gridShape();
const N = () => shape().n;                                   // squares: 9 (3 x 3) or 2 (1 x 2)
const ncol = () => shape().cols.length;
const oneRow = () => shape().rows.length === 1;
const rowC = k => shape().rows[Math.floor(k / ncol())];
const colC = k => shape().cols[k % ncol()];
const diag = k => Math.floor(k / ncol()) + (k % ncol());
const cells = () => daily.DS.grid.cells;
const nameOf = i => daily.PP[i][0];
const wait = ms => new Promise(r => setTimeout(r, ms));

// Examples ("Try {name}") exclude every player on the grid, like the old gridBody. daily.examplesFor gives every
// square's example from one pass over the players (same pick as daily.exampleFor), so a finished grid renders fast.
let exCache = {key: '', best: null};
function example(k) {
  const used = cells().filter(Boolean).map(c => c.p);
  const key = daily.PNUM + ':' + used.join(',');
  if (exCache.key !== key) exCache = {key, best: daily.examplesFor(new Set(used))};
  return exCache.best[k];
}

// DEEP CUT: daily.deepCut scans every player the first time a square is asked (~5 ms). daily warms today's
// squares at idle after ensure(); render only asks warm squares and the rest are filled in at idle (see mount()).
// Squares are named by their two criteria, which works for any grid shape.
const isDeep = k => {
  const c = cells()[k];
  return !!(c && c.ok && daily.deepCut(rowC(k), colC(k), c.p));
};
const deepKnown = k => daily.deepReady(rowC(k), colC(k));
/** Warm DEEP CUT for every square, one square per idle callback (the run cover calls it on mount). */
function warm(done) {
  if (daily.status !== 'ready' || !daily.DS.grid) return;
  daily.warmDeepCuts(done);
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
    // One-row grids have room to say what an open square wants.
    if (!daily.gridDone()) return `<span class="gc-plus">${ui.icon('plus')}</span>${oneRow() ? '<span class="gc-ask" aria-hidden="true">Name a player</span>' : ''}`;
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
  const n = daily.gridScore(), all = N(), f = n / all, gold = n === all;
  return `<div class="gd-corner${gold ? ' is-gold' : ''}" role="img" aria-label="${n} of ${all} correct" data-gd-corner>`
    + `<svg class="gd-ring" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle class="gd-rt" cx="16" cy="16" r="${R}"/>`
    + `<circle class="gd-rf" cx="16" cy="16" r="${R}" transform="rotate(-90 16 16)" stroke-dasharray="${CIRC.toFixed(3)} ${CIRC.toFixed(3)}" style="stroke-dashoffset:${(CIRC * (1 - f)).toFixed(3)}"/></svg>`
    + `<span class="n5 gd-n" data-gd-n>${n}/${all}</span></div>`;
}
function headHTML(c, cls) {
  return `<div class="${cls}"><span class="gd-hi">${ui.icon(critIcon(c))}</span><span class="gd-t">${esc(daily.critLabel(c))}</span></div>`;
}
function footHTML() {
  if (!daily.gridDone()) return ui.button({label: 'Give up the empty squares', kind: 'destructive', cls: 'gd-give', attrs: {'data-gd-give': ''}});
  return `<p class="note gd-done">${daily.gridScore()} of ${N()} for ${daily.ptsGrid()} points. Each square you missed shows one player who would have worked.</p>`;
}

/** Classic layout (any shape with two or more rows; v1 and v2 days are 3 x 3): corner, column headers, then each row
 *  header followed by its squares. A 3 x 3 grid renders exactly as before (the column template is in grid.css). */
function tableHTML(S) {
  const C = S.cols.length;
  let h = cornerHTML() + S.cols.map(c => headHTML(c, 'gd-ch')).join('');
  S.rows.forEach((rc, r) => {
    h += headHTML(rc, 'gd-rh');
    for (let c = 0; c < C; c++) h += cellHTML(r * C + c);
  });
  return `<div class="gd" data-gd${C === 3 ? '' : ` style="--gd-cols:${C}"`}>${h}</div>`;
}
/** One-row layout (v3: 1 x 2): the row criterion is a banner with the score ring at its end; a fork splits it into
 *  the column headers, each over its own large square. Every square is "banner x its column". */
function bandHTML(S) {
  const rc = S.rows[0];
  return `<div class="gd gd-one" data-gd style="--gd-cols:${S.cols.length}">`
    + `<div class="gd-band"><div class="gd-rh gd-rb"><span class="gd-hi">${ui.icon(critIcon(rc))}</span><span class="gd-t">${esc(daily.critLabel(rc))}</span></div>${cornerHTML()}</div>`
    + `<div class="gd-fork" aria-hidden="true"><i></i></div>`
    + S.cols.map(c => headHTML(c, 'gd-ch')).join('')
    + S.cols.map((_, c) => cellHTML(c)).join('')
    + `</div>`;
}

// The footnote: the full note on v1/v2 days (unchanged); on a v3 day only the sentences about squares it has.
function ruleNote(S) {
  if (!daily.isV3()) return RULE_NOTE;
  const kinds = new Set([...S.rows, ...S.cols].map(daily.critKind));
  const [draft, college] = RULE_NOTE.split(/(?<=\.) /);
  return [kinds.has('d') ? draft : '', kinds.has('c') ? college : ''].filter(Boolean).join(' ');
}

function render() {
  const S = shape();
  const note = ruleNote(S);
  return `<div class="c-grid">`
    + (S.rows.length === 1 ? bandHTML(S) : tableHTML(S))
    + `<div class="gd-foot" data-gd-foot>${footHTML()}</div>`
    + (note ? `<p class="note gd-rule">${esc(note)}</p>` : '')
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
  const n = daily.gridScore(), all = N();
  I.corner.classList.toggle('is-gold', n === all);
  I.corner.setAttribute('aria-label', `${n} of ${all} correct`);
  I.corner.querySelector('[data-gd-n]').textContent = `${n}/${all}`;
  I.corner.querySelector('.gd-rf').style.strokeDashoffset = (CIRC * (1 - n / all)).toFixed(3);
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
  // A DEEP CUT sticker waits (hidden) for its own slap after the flip. Painted once: when the fallback below paints
  // first, the cancelled flip still calls onHalf, which must not repaint (hiding the slapped sticker again).
  const paint = () => { if (painted) return; painted = true; paintCell(cell, k); const dp = cell.querySelector('.gc-deep'); if (dp) dp.style.opacity = '0'; };
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
  for (let k = 0; k < N(); k++) {
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
      const pts = daily.PTS.grid; // per square: 50 (v1, v2) or 100 (v3)
      ui.floatText(cell, `+${pts}`);
      ui.announce(`Correct. +${pts}${deep ? '. Deep cut.' : ''}`);
      if (deep) { slapDeep(cell); ui.haptic('celebrate'); } else ui.haptic('success');
    } else {
      ui.announce(`${name} doesn't fit that square.`);
      ui.haptic('error');
    }
    paintCorner(I);
    I.api.refreshChrome();
    if (daily.gridDone()) {
      await onDone(I, {wave: false});
      if (daily.gridScore() === N()) immaculate(I);
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
    ui.announce(`${daily.gridScore()} of ${N()} for ${daily.ptsGrid()} points.`);
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
