// The word puzzles (Nov 26 2026 on; Evan, Nov 25 2026: "Include a new feature that allows players to do a bonus puzzle.
// This can be some such as Wordscapes to find all the words by dragging your finger across the letters to find all the
// correct words. A crossword puzzle. Unscrambling letters to spell a players name, team name, coaches name, and guessing
// the score of a game this season and assigning the correct numbers to the team"; Nov 27 2026: "Do not specify "bonus"
// puzzles. They should just be mixed in the rotation"). Inside the app still the 'bonus' step: up to 200 points; its kind
// comes from the day's list (daily.bonusKindOf), its level is daily.DAY.bx.d, its progress daily.DS.bonus ({done, pts, line,
// ...the kind's own}); on screen it is only ever its name:
//   wheel     A letter wheel: drag a finger across the letters (or tap them, then ✓) to spell words; every common word in
//             the letters fills its slot, football words (×2) worth double. got: the words found; extra: extra finds, no
//             points; miss: wrong words (bad: the last few), WHEEL_MISSES of them end the wheel; w: 2 (1: flat scoring).
//   scramble  Four words to spell from their letters (a player, a team, a coach, a player), each with its clue: tap the
//             tiles (or type), 50 a word, three tries each, Skip reveals it. i, ok.
//   cross     A criss-cross mini crossword: tap a square or a clue, type on the keyboard below; a word right turns green
//             and locks. f: letters by square, ok: the words solved. Finish reveals the rest.
//   gridword  One five-letter football word in six guesses (Evan, Nov 25 2026: "Add another bonus game mode like wordle
//             but with football terms, only one word"): type on the keyboard below (or a real one), Enter; each letter
//             flips to green (right spot), gold (in the word, elsewhere) or grey; any common 5-letter word is a guess
//             (daily.TV.w5). 200/170/140/110/80/50 by the guess it's solved on; the word's football meaning shows at the
//             end. g: the guesses.
//   score     Three 2026 games: put each of the six final scores on its team (tap a score, then a team), Lock in.
//             place: the score chip on each team.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {tvHead, pop, shake, burst, rng, shuffled, save} from './trivia.js';

const esc = data.esc;
const ok = () => daily.isFresh() && daily.hasStep('bonus') && !!daily.DAY.bx;
const stateOf = () => (daily.DS && daily.DS.bonus && typeof daily.DS.bonus === 'object' ? daily.DS.bonus : {});
const seedOf = () => (daily.DAY.pnum || 1) * 977 + 3;
/** Saves the bonus's progress, stamped with its kind (a save of another kind is never read as this one's). */
const bsave = (next, api) => save('bonus', {...next, kind: daily.DAY.bx.kind}, api);

// ============================================================================ Gridword
export const GW_PTS = [200, 170, 140, 110, 80, 50];
/** Each letter of a guess against the answer: 'g' right spot, 'y' in the word elsewhere, 'n' not (repeats counted). */
export function gwMarks(guess, answer) {
  const m = Array(5).fill('n'), left = {};
  for (let i = 0; i < 5; i++) { if (guess[i] === answer[i]) m[i] = 'g'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (m[i] !== 'g' && left[guess[i]] > 0) { m[i] = 'y'; left[guess[i]]--; }
  return m;
}
const GW_WORD = {g: 'right spot', y: 'in the word', n: 'not in it'};
function gridwordMount(box, api, ctx) {
  const [answer, meaning] = daily.DAY.bx.d;
  const allowed = new Set(String((daily.TV && daily.TV.w5) || '').split(' '));
  allowed.add(answer);
  let typed = '', busy = false;
  const FLIP = 230;
  const RANK = {n: 1, y: 2, g: 3};
  /** The keyboard's colours: each letter's best mark so far (green over gold over grey). */
  const keyState = guesses => {
    const k = {};
    guesses.forEach(g => gwMarks(g, answer).forEach((m, i) => { const c = g[i]; if (!k[c] || RANK[m] > RANK[k[c]]) k[c] = m; }));
    return k;
  };
  const keyLabel = (c, m) => `${c}${m ? ', ' + GW_WORD[m] : ''}`;
  function kbHTML(guesses) {
    const ks = keyState(guesses);
    return KEYS.map((row, ri) => `<div>${ri === 2 ? '<button type="button" class="is-wide is-enter" data-gk="ENTER">Enter</button>' : ''}${row.split('').map(c => `<button type="button" data-gk="${c}" class="${ks[c] ? 'is-' + ks[c] : ''}" aria-label="${keyLabel(c, ks[c])}">${c}</button>`).join('')}${ri === 2 ? '<button type="button" class="is-wide" data-gk="DEL" aria-label="Delete">⌫</button>' : ''}</div>`).join('');
  }
  /** The keys' colours brought up to date in place (the buttons stay, and so does focus on them). */
  function paintKeys(guesses) {
    const ks = keyState(guesses);
    box.querySelectorAll('[data-gwkb] [data-gk]').forEach(b => {
      const c = b.dataset.gk; if (c.length !== 1) return;
      b.classList.remove('is-g', 'is-y', 'is-n'); if (ks[c]) b.classList.add('is-' + ks[c]);
      b.setAttribute('aria-label', keyLabel(c, ks[c]));
    });
  }
  function rowHTML(r, g, cur, flip) {
    const marks = g ? gwMarks(g, answer) : null, letters = g || (cur ? typed.padEnd(5) : '     ');
    const label = g ? `${g}: ${[...g].map((c, i) => `${c} ${GW_WORD[marks[i]]}`).join(', ')}` : cur ? `Guess ${r + 1}: ${typed || 'empty'}` : `Guess ${r + 1}`;
    return `<div class="tv-gw-row${cur ? ' is-cur' : ''}" data-gwrow="${r}" role="group" aria-label="${esc(label)}">${[...letters].map((c, i) =>
      `<span class="tv-gw-t${g ? ' is-' + marks[i] : c.trim() ? ' is-typed' : ''}${flip ? ' is-flip' : ''}" style="--i:${i}" aria-hidden="true">${c.trim() ? c : ''}</span>`).join('')}</div>`;
  }
  const headOf = s => tvHead(`GRIDWORD · ${s.done ? 'FINAL' : `GUESS ${(s.g || []).length + 1} OF 6`}`,
    s.done ? (s.won ? `Got it in ${s.g.length}!` : `It was ${answer}`) : 'Guess the football word',
    s.done ? `${s.pts || 0} points` : 'Six tries. Green: right spot. Gold: wrong spot.');
  /** The whole screen (on mount, and once the word is over). */
  function draw(flipRow = -1) {
    if (!ok()) return;
    const s = stateOf(), g = Array.isArray(s.g) ? s.g : [];
    const rows = Array.from({length: 6}, (_, r) => rowHTML(r, g[r], r === g.length && !s.done, r === flipRow)).join('');
    box.innerHTML = headOf(s)
      + `<div class="tv-gw" data-gw>${rows}</div>`
      + (s.done ? `<div class="tv-gw-def" data-gwdef><b>${esc(answer)}</b><span>${esc(meaning)}</span></div>` : '')
      + (s.done ? '' : `<div class="tv-kb tv-gw-kb" data-gwkb>${kbHTML(g)}</div>`);
  }
  /** Board and keyboard between the run's bars (the header may scroll off). */
  const show = (smooth = true) => { const b = box.querySelector('[data-gw]'), kb = box.querySelector('[data-gwkb]') || box.querySelector('[data-gwdef]'); if (b && api && api.reveal) api.reveal([b, kb], {smooth}); };
  /** An accepted guess: its row flips in place (and the next row opens); the keys recolour after the flip. On the last
   *  guess the screen turns into the final one once the flip is done, and focus lands on it. */
  function landed(s) {
    const g = s.g, r = g.length - 1, row = box.querySelector(`[data-gwrow="${r}"]`);
    if (row) row.outerHTML = rowHTML(r, g[r], false, !ui.RM);
    const next = box.querySelector(`[data-gwrow="${r + 1}"]`);
    if (next && !s.done) next.outerHTML = rowHTML(r + 1, null, true, false);
    const eb = box.querySelector('.tv-eyebrow'); if (eb && !s.done) eb.textContent = `GRIDWORD · GUESS ${g.length + 1} OF 6`;
    busy = true;
    setTimeout(() => {
      busy = false;
      if (!ok()) return;
      if (!s.done) { paintKeys(g); return; }
      const hadFocus = box.contains(document.activeElement);
      draw();
      if (s.won) {
        box.querySelectorAll(`[data-gwrow="${r}"] .tv-gw-t`).forEach((t, i) => ui.animate(t, [{transform: 'translateY(0)'}, {transform: 'translateY(-14px)'}, {transform: 'none'}], {duration: 380, delay: i * 70}));
        pop(box.querySelector('[data-gw]'), `+${s.pts}`, 'is-gold');
      }
      const d = box.querySelector('[data-gwdef]'); if (d) ui.animate(d, [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
      if (hadFocus) box.focus({preventScroll: true});
      show();
    }, ui.RM ? 0 : 5 * FLIP + 260);
  }
  function paintRow() {
    const s = stateOf(), r = (s.g || []).length, row = box.querySelector(`[data-gwrow="${r}"]`);
    if (!row) return;
    row.outerHTML = rowHTML(r, null, true, false);
  }
  function bad(msg) { const s = stateOf(), row = box.querySelector(`[data-gwrow="${(s.g || []).length}"]`); ui.haptic('warning'); shake(row); pop(box.querySelector('[data-gw]'), msg, 'is-red'); ui.announce(msg); }
  /** Whether a key goes to the word now: a game under way, nothing else on top, this screen showing. */
  const taking = () => { const s = stateOf(); return ok() && !s.done && !busy && !(ui.sheetCount && ui.sheetCount() > 0) && (!ctx || ctx.visible !== false); };
  function press(k) {
    if (!taking()) return;
    const s = stateOf();
    if (k === 'DEL') { if (typed) { typed = typed.slice(0, -1); ui.haptic('light'); paintRow(); } return; }
    if (k === 'ENTER') {
      if (typed.length < 5) { bad('Five letters'); return; }
      if (!allowed.has(typed)) { bad('Not in the word list'); return; }
      const g = [...(s.g || []), typed], won = typed === answer, done = won || g.length >= 6;
      const pts = won ? GW_PTS[g.length - 1] : 0, next = {...s, g, won, done, pts, line: won ? `Solved in ${g.length}` : done ? 'Missed' : `${g.length} of 6 guesses`};
      if (!bsave(next, api)) return;
      const marks = gwMarks(typed, answer);
      ui.haptic(won ? 'success' : 'light');
      ui.announce(`${typed}: ${[...typed].map((c, i) => `${c} ${GW_WORD[marks[i]]}`).join(', ')}.${won ? ` Solved in ${g.length}.` : done ? ` The word was ${answer}.` : ''}`);
      typed = ''; landed(stateOf()); return;
    }
    if (/^[A-Z]$/.test(k) && typed.length < 5) {
      typed += k; ui.haptic('selection'); paintRow();
      const t = box.querySelectorAll(`[data-gwrow="${(s.g || []).length}"] .tv-gw-t`)[typed.length - 1];
      if (t) ui.animate(t, [{transform: 'scale(.8)'}, {transform: 'scale(1.1)'}, {transform: 'none'}], {duration: 160});
    }
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-gk]'); if (!b) return;
    press(b.dataset.gk);
    ui.animate(b, [{transform: 'translateY(-4px) scale(1.08)'}, {transform: 'none'}], {duration: 150});
  });
  // A real keyboard too, only while the word takes input (not once it's over, under a sheet, or off screen), and only
  // keys not aimed at something else: a focused button or link outside the board keeps its Enter, a focused key on the
  // on-screen keyboard its own click; text fields are never touched.
  const onKey = e => {
    if (!box.isConnected || box.offsetParent === null || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const t = e.target, el = t && t.closest ? t : null;
    if (el && el.closest('input, textarea, select, [contenteditable="true"]')) return;
    const k = e.key === 'Enter' ? 'ENTER' : e.key === 'Backspace' ? 'DEL' : /^[a-z]$/i.test(e.key) ? e.key.toUpperCase() : null;
    if (!k || !taking()) return;
    const mine = !el || el === document.body || el === document.documentElement || el === box || (box.contains(el) && !el.closest('button, a, [tabindex]:not([tabindex="-1"])'));
    // (a key on the on-screen keyboard reached by Tab keeps its own Enter; one focused by a tap or click doesn't)
    const key = el && el.closest('[data-gk]');
    if (!mine && !(key && (k !== 'ENTER' || !key.matches(':focus-visible')))) return;
    e.preventDefault(); press(k);
  };
  window.addEventListener('keydown', onKey);
  draw();
  requestAnimationFrame(() => show(false));
  return () => window.removeEventListener('keydown', onKey);
}

// ============================================================================ Word Wheel
// Word Wheel follow-up (Evan, Nov 27 2026: "the letters need to be centered on the bubbles. There should be a limited
// number of attempts. Football themed words gain double points. After each word, the screen keeps moving to the top"):
// WHEEL_MISSES wrong words end the wheel; a level's football words (its `double` list, tools/puzzles/trivia_v6.py
// WHEEL_DOUBLE) weigh double, the wheel still worth 200 in all; a found word patches its slot in place (the board is never
// rebuilt mid-game). A level is [letters, targets, extras, base, ok, double] (trivia-v8.json): a real word that is neither a
// slot nor a bonus word (ok, or any 5-letter word in TV.w5) costs nothing; only a non-word is a miss, and only once.
export const WHEEL_MISSES = 5;
/** A wheel word's weight: the level's football words count double (flat: a save begun before double words, all 1). */
export const wheelWeight = (w, level, flat = false) => (!flat && (level[5] || []).includes(w) ? 2 : 1);
/** The points for the words found on a wheel level: 200 for all of them. */
export function wheelPts(level, got, flat = false) {
  const targets = level[1], W = targets.reduce((t, w) => t + wheelWeight(w, level, flat), 0);
  return W ? Math.round(200 * got.filter(w => targets.includes(w)).reduce((t, w) => t + wheelWeight(w, level, flat), 0) / W) : 0;
}
/** Is w a real word this wheel doesn't ask for (no points, no try lost)? */
export function wheelReal(w, level) {
  if (Array.isArray(level[4])) return level[4].includes(w);
  const w5 = w.length === 5 && daily.TV && daily.TV.w5; // (a level without its list: an older bank)
  return !!w5 && (' ' + w5 + ' ').includes(' ' + w + ' ');
}
function wheelMount(box, api) {
  const level = daily.DAY.bx.d, [letters, targets, extras] = level;
  let order = letters.split(''), path = [], drag = null, taps = false, held = 0;
  // a wheel begun (or finished) before double words, saved with no `w`, keeps flat scoring so its points never drop; so
  // does a level without its lists (an older bank answering from a cache)
  const s0 = stateOf(), flat = !Array.isArray(level[5]) || s0.w === 1 || (!s0.w && (!!s0.done || (s0.got || []).length > 0));
  const W = flat ? 1 : 2, total = targets.length, fb = w => wheelWeight(w, level, flat) === 2, anyFb = targets.some(fb);
  const missOf = s => Math.min(WHEEL_MISSES, Math.max(0, s.miss | 0));
  const eyebrow = n => `WORD WHEEL · ${n} OF ${total}`;
  const wsave = next => bsave({...next, w: W}, api);
  function slotHTML(w, s, got) {
    const have = got.has(w), show = have || s.done;
    return `<span class="tv-word${have ? ' is-got' : s.done ? ' is-missed' : ''}${fb(w) ? ' is-fb' : ''}" data-word="${w}">${w.split('').map(c => `<i>${show ? c : ''}</i>`).join('')}`
      + `${fb(w) ? '<b class="tv-x2" aria-hidden="true">×2</b>' : ''}</span>`;
  }
  function slotsHTML(s) {
    const got = new Set(s.got || []);
    const lens = [...new Set(targets.map(w => w.length))];
    return `<div class="tv-slots">${lens.map(L => `<div class="tv-slot-row">${targets.filter(w => w.length === L).map(w => slotHTML(w, s, got)).join('')}</div>`).join('')}</div>`;
  }
  const leftText = miss => `${WHEEL_MISSES - miss} ${WHEEL_MISSES - miss === 1 ? 'miss' : 'misses'} left`;
  const leftShort = miss => `${WHEEL_MISSES - miss} left`;
  const livesHTML = miss => `<span aria-hidden="true">Misses left</span>${[...Array(WHEEL_MISSES).keys()].map(k => `<span class="tv-life${k < WHEEL_MISSES - miss ? '' : ' is-gone'}" aria-hidden="true"></span>`).join('')}<span class="sr-only" data-wleft>${leftText(miss)}</span>`;
  const lettersHTML = () => order.map((c, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / order.length, R = 38; return `<button type="button" class="tv-wl" data-wl="${i}" style="left:${50 + R * Math.cos(a)}%;top:${50 + R * Math.sin(a)}%" aria-label="${c}">${c}</button>`; }).join('');
  const wheelHTML = () => `<div class="tv-wheel" data-wheel><svg class="tv-wheel-line" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="" data-line/></svg>`
    + lettersHTML() + `<button type="button" class="tv-wheel-mid" data-wshuffle aria-label="Shuffle letters">⟲</button></div>`;
  const extraText = s => ((s.extra || []).length ? `Extra words: ${(s.extra || []).join(', ')}` : '');
  const titleOf = s => ((s.got || []).length === total ? 'Every word found!' : missOf(s) >= WHEEL_MISSES ? 'Out of tries' : 'Wheel finished');
  /** The whole board: on opening, and once the wheel ends. Mid-game changes patch it in place (no jump in the scroll). */
  function draw() {
    if (!ok()) return;
    const s = stateOf(), got = s.got || [], miss = missOf(s);
    const sub = s.done ? `${s.pts || 0} points · ${got.length} of ${total} words` : `Drag across the letters without lifting, or tap them and press ✓.${anyFb ? ' Football words (×2) score double.' : ''}`;
    box.innerHTML = tvHead(eyebrow(got.length), s.done ? titleOf(s) : 'Swipe the letters to spell words', sub)
      + slotsHTML(s)
      + (s.done ? '' : `<div class="tv-lives" data-wlives>${livesHTML(miss)}</div>`
        + `<div class="tv-wword" data-wword aria-live="polite"><span data-wtext></span></div>${wheelHTML()}<div class="tv-row"><button type="button" class="tv-btn tv-btn-ghost" data-wclear>⌫ Clear</button><button type="button" class="tv-btn tv-btn-go" data-wsubmit>✓ Enter</button><button type="button" class="tv-btn tv-btn-ghost" data-finish>Finish</button></div>`)
      + `<p class="tv-fact" data-wextra${extraText(s) ? '' : ' hidden'}>${esc(extraText(s))}</p>`;
  }
  /** What became of a word, said in the word display by the wheel (always in view while playing, whatever the motion
   *  setting): gold for a found word and its points, blue for no cost, red for a miss; it clears once a new word starts. */
  function say(text, tone, ms = 1100) {
    const ww = box.querySelector('[data-wword]'); if (!ww) return;
    ww.querySelector('[data-wtext]').textContent = text;
    ww.className = `tv-wword is-msg is-${tone}`;
    hold(ms);
  }
  /** A word found: its slot flips in, and the word display says it with its points; nothing else on the page moves. */
  function found(w, gain) {
    const s = stateOf(), el = box.querySelector(`[data-word="${w}"]`);
    const eb = box.querySelector('.tv-eyebrow'); if (eb) eb.textContent = eyebrow((s.got || []).length);
    if (el) {
      el.classList.add('is-got');
      el.querySelectorAll('i').forEach((c, k) => { c.textContent = w[k]; ui.animate(c, [{transform: 'scale(.2)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 300, delay: k * 50, fill: 'backwards'}); });
    }
    say(`${w} +${gain}${fb(w) ? ' · DOUBLE' : ''}`, 'got');
  }
  /** Keep the word display as it is for ms, unless a new word starts. */
  function hold(ms) { const k = ++held; setTimeout(() => { if (k === held && !path.length) paint(); }, ms); }
  function lives(miss) {
    const l = box.querySelector('[data-wlives]'); if (!l) return;
    l.querySelectorAll('.tv-life').forEach((d, k) => d.classList.toggle('is-gone', k >= WHEEL_MISSES - miss));
    const t = l.querySelector('[data-wleft]'); if (t) t.textContent = leftText(miss);
  }
  /** The wheel ends (every word, out of tries or Finish): the board shows every word, the slots come into view, focus stays. */
  function end() {
    const had = box.contains(document.activeElement);
    draw();
    if (had) { try { box.focus({preventScroll: true}); } catch (_) {} }
    api.reveal([box.querySelector('.tv-head'), box.querySelector('.tv-slots')]);
    const s = stateOf();
    ui.announce(`${titleOf(s).replace(/[.!]$/, '')}. ${s.pts || 0} points, ${(s.got || []).length} of ${total} words.`);
  }
  const word = () => path.map(i => order[i]).join('');
  /** The wheel's lit letters and line, and (unless wheelOnly: a word just sent stays up a moment) the word being spelled.
   *  The word's own span takes the text, so a pop on the display outlives a repaint. */
  function paint(wheelOnly = false) {
    box.querySelectorAll('[data-wl]').forEach(b => b.classList.toggle('is-on', path.includes(+b.dataset.wl)));
    const ww = box.querySelector('[data-wword]');
    if (ww && (!wheelOnly || path.length)) { ww.querySelector('[data-wtext]').textContent = word(); ww.className = `tv-wword${path.length ? ' is-on' : ''}`; }
    const wheel = box.querySelector('[data-wheel]'), line = box.querySelector('[data-line]');
    if (!wheel || !line) return;
    const r = wheel.getBoundingClientRect();
    const pts = path.map(i => { const b = box.querySelector(`[data-wl="${i}"]`).getBoundingClientRect(); return `${((b.left + b.width / 2 - r.left) / r.width * 100).toFixed(1)},${((b.top + b.height / 2 - r.top) / r.height * 100).toFixed(1)}`; });
    if (drag && drag.x != null && path.length) pts.push(`${((drag.x - r.left) / r.width * 100).toFixed(1)},${((drag.y - r.top) / r.height * 100).toFixed(1)}`);
    line.setAttribute('points', pts.join(' '));
  }
  /** A word that costs nothing: a shake, and the display says why. */
  function nothing(ww, text) { ui.haptic('warning'); shake(ww); say(text, 'note'); ui.announce(`${text}.`); }
  function submit() {
    const w = word(), s = stateOf(), got = s.got || [];
    path = []; taps = false;
    if (s.done || !ok()) { paint(); return; }
    paint(true); // the wheel lets go at once; the word stays up while it's judged
    if (w.length < 3) { paint(); return; }
    const ww = box.querySelector('[data-wword]');
    if (got.includes(w) || (s.extra || []).includes(w)) { nothing(ww, 'Already found'); return; }
    if (targets.includes(w)) {
      const ng = [...got, w], pts = wheelPts(level, ng, flat), all = ng.length === total;
      if (!wsave({...s, got: ng, pts, line: `${ng.length} of ${total} words`, done: all})) return;
      ui.haptic('success'); ui.announce(`${w}${fb(w) ? ', a football word, double points' : ''}. ${ng.length} of ${total}.`);
      found(w, pts - wheelPts(level, got, flat));
      if (all) setTimeout(() => { if (box.isConnected) end(); }, 1100);
      return;
    }
    if (extras.includes(w)) {
      const ex = [...(s.extra || []), w];
      if (!wsave({...s, extra: ex})) return;
      ui.haptic('light'); say(`${w}: extra word!`, 'note'); ui.announce(`${w}, an extra word.`);
      const p = box.querySelector('[data-wextra]'); if (p) { p.textContent = extraText({extra: ex}); p.hidden = false; }
      return;
    }
    if (wheelReal(w, level)) { nothing(ww, 'Not on this wheel', 'is-blue'); return; }
    if ((s.bad || []).includes(w)) { nothing(ww, 'Already tried'); return; }
    // a miss: one of WHEEL_MISSES gone; the last ends the wheel with the words found so far
    const miss = missOf(s) + 1, out = miss >= WHEEL_MISSES;
    if (!wsave({...s, miss, bad: [...(s.bad || []), w].slice(-WHEEL_MISSES), got, pts: wheelPts(level, got, flat), line: `${got.length} of ${total} words`, done: out})) return;
    ui.haptic('error'); shake(ww); lives(miss);
    say(out ? 'Out of tries' : `Not a word · ${leftShort(miss)}`, 'bad');
    ui.announce(out ? 'Not a word. Out of tries.' : `Not a word. ${leftText(miss)}.`);
    if (out) setTimeout(() => { if (box.isConnected) end(); }, 1100);
  }
  /** The letter under a finger. Its catch circle is smaller than the gap a swipe from one letter to the one after next
   *  passes its neighbour by, so on a small wheel a straight swipe never picks up (or takes back) the letter between. */
  function letterAt(x, y) {
    const wheel = box.querySelector('[data-wheel]'); if (!wheel) return -1;
    const R = .38 * wheel.offsetWidth, n = order.length, gap = R * (1 - Math.cos(2 * Math.PI / n));
    let best = -1, bd = 1e9;
    box.querySelectorAll('[data-wl]').forEach(b => {
      const r = b.getBoundingClientRect(), d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < Math.min(b.offsetWidth * .62, gap * .85) && d < bd) { bd = d; best = +b.dataset.wl; }
    });
    return best;
  }
  box.addEventListener('pointerdown', e => {
    const l = e.target.closest('[data-wl]'); if (!l || stateOf().done) return;
    e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (_) {}
    const i = +l.dataset.wl;
    if (!taps) path = [];
    drag = {id: e.pointerId, moved: false, x: e.clientX, y: e.clientY, start: i};
    if (!path.includes(i)) { path.push(i); ui.haptic('selection'); }
    paint();
  });
  box.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    const i = letterAt(e.clientX, e.clientY);
    if (i >= 0 && i !== path[path.length - 1]) {
      drag.moved = true;
      if (path.length > 1 && path[path.length - 2] === i) path.pop(); else if (!path.includes(i)) path.push(i);
      ui.haptic('selection');
    }
    paint();
  });
  box.addEventListener('pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const moved = drag.moved; drag = null;
    if (moved && path.length > 1) submit(); else { taps = true; paint(); }
  });
  // a drag the system cancelled (a call, a notification, the home gesture) is dropped, never sent
  box.addEventListener('pointercancel', e => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null; path = []; taps = false; paint();
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ok() || stateOf().done) return;
    if (b.hasAttribute('data-wl') && e.detail === 0) { const i = +b.dataset.wl; if (!path.includes(i)) path.push(i); taps = true; paint(); return; } // keyboard
    if (b.hasAttribute('data-wshuffle')) {
      // only the letters change: the wheel, and the page round it, stay where they are
      order = shuffled(order, Math.random); path = []; taps = false; ui.haptic('light');
      const wheel = box.querySelector('[data-wheel]');
      wheel.querySelectorAll('[data-wl]').forEach(x => x.remove());
      wheel.querySelector('[data-wshuffle]').insertAdjacentHTML('beforebegin', lettersHTML());
      paint();
      ui.animate(wheel, [{transform: 'rotate(-90deg) scale(.9)', opacity: .4}, {transform: 'none', opacity: 1}], {spring: 'smooth'});
      return;
    }
    if (b.hasAttribute('data-wclear')) { path = []; taps = false; paint(); ui.haptic('light'); return; }
    if (b.hasAttribute('data-wsubmit')) { submit(); return; }
    if (b.hasAttribute('data-finish')) { finish(b); }
  });
  function finish(b) {
    if (!b.classList.contains('is-confirm')) { b.classList.add('is-confirm'); b.textContent = 'Sure?'; setTimeout(() => { if (b.isConnected) { b.classList.remove('is-confirm'); b.textContent = 'Finish'; } }, 2600); return; }
    const s = stateOf(), got = s.got || [];
    if (wsave({...s, got, pts: wheelPts(level, got, flat), line: `${got.length} of ${total} words`, done: true})) { ui.haptic('medium'); end(); }
  }
  draw();
}

// ============================================================================ Unscramble
function scrambleMount(box, api) {
  const items = daily.DAY.bx.d;
  let typed = [], used = [], showing = -1;
  const KIND = w => (w[1].startsWith('Team') ? 'team' : w[1].startsWith('Coach') ? 'coach' : 'player');
  function draw(fx) {
    if (!ok()) return;
    const s = stateOf(), okv = s.ok || [], i = showing >= 0 ? showing : okv.length;
    if (s.done && showing < 0) {
      box.innerHTML = tvHead('UNSCRAMBLE · FINAL', `${okv.filter(Boolean).length} of 4 spelled`, `${s.pts || 0} points`)
        + `<ol class="tv-recap">${items.map((w, k) => `<li class="${okv[k] ? 'is-ok' : 'is-no'}"><b>${esc(w[0])}</b><span>${esc(w[1])}</span></li>`).join('')}</ol>`;
      return;
    }
    const w = items[i], done = i < okv.length, letters = w[2].split(''), tries = (s.tries || [])[i] || 0;
    box.innerHTML = tvHead(`UNSCRAMBLE · ${i + 1} OF 4`, done ? (okv[i] ? 'Spelled it!' : `It was ${w[0]}`) : 'Unscramble the name', '')
      + `<p class="tv-clue is-${KIND(w)}"><b>${esc(w[1].split(':')[0])}</b>${esc(w[1].split(':').slice(1).join(':'))}</p>`
      + `<div class="tv-ans${done ? (okv[i] ? ' is-ok' : ' is-no') : ''}" data-ans>${letters.map((_, k) => `<button type="button" class="tv-sq" data-sq="${k}" ${done ? 'disabled' : ''}>${done ? w[0][k] : typed[k] != null ? letters[typed[k]] : ''}</button>`).join('')}</div>`
      + (done ? `<button type="button" class="tv-btn tv-btn-go" data-snext>${okv.length >= 4 ? 'See final' : 'Next word ›'}</button>`
        : `<div class="tv-tray">${letters.map((c, k) => `<button type="button" class="tv-tile tv-letter${used.includes(k) ? ' is-used' : ''}" data-lt="${k}" ${used.includes(k) ? 'disabled' : ''}>${c}</button>`).join('')}</div>`
        + `<p class="tv-tries">${3 - tries} ${3 - tries === 1 ? 'try' : 'tries'} left</p>`
        + `<div class="tv-row"><button type="button" class="tv-btn tv-btn-ghost" data-sshuffle>Shuffle</button><button type="button" class="tv-btn tv-btn-ghost" data-sclear>Clear</button><button type="button" class="tv-btn tv-btn-ghost" data-sskip>Skip</button></div>`);
    if (fx === 'ok') { const a = box.querySelector('[data-ans]'); a.querySelectorAll('.tv-sq').forEach((q, k) => ui.animate(q, [{transform: 'translateY(0)'}, {transform: 'translateY(-10px)'}, {transform: 'none'}], {duration: 380, delay: k * 45})); pop(a, '+50', 'is-gold'); }
    if (fx === 'in') ui.animate(box.querySelector('.tv-tray'), [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
  }
  function finishWord(right) {
    const s = stateOf(), okv = [...(s.ok || []), right], pts = okv.filter(Boolean).length * 50;
    if (!bsave({...s, ok: okv, pts, line: `${okv.filter(Boolean).length} of 4 spelled`, done: okv.length >= 4}, api)) return false;
    showing = okv.length - 1; typed = []; used = [];
    return true;
  }
  function place(k) {
    const s = stateOf(), i = (s.ok || []).length, w = items[i];
    if (s.done || used.includes(k)) return;
    const slot = [...Array(w[0].length).keys()].find(x => typed[x] == null);
    if (slot == null) return;
    typed[slot] = k; used.push(k); ui.haptic('selection');
    draw();
    const sq = box.querySelector(`[data-sq="${slot}"]`); ui.animate(sq, [{transform: 'scale(.6)', opacity: .3}, {transform: 'scale(1)', opacity: 1}], {spring: 'bouncy'});
    if (typed.filter(x => x != null).length === w[0].length) {
      const got = typed.map(t => w[2][t]).join('');
      if (got === w[0]) { if (finishWord(true)) { ui.haptic('success'); ui.announce(`${w[0]}. Correct.`); draw('ok'); } }
      else {
        const tries = [...(s.tries || [])]; tries[i] = (tries[i] || 0) + 1;
        bsave({...s, tries}, api);
        ui.haptic('error'); shake(box.querySelector('[data-ans]'));
        if (tries[i] >= 3) setTimeout(() => { if (finishWord(false)) draw(); }, 450);
        else setTimeout(() => { typed = []; used = []; draw(); }, 450);
      }
    }
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !ok()) return;
    const s = stateOf();
    if (b.dataset.lt != null) { place(+b.dataset.lt); return; }
    if (b.dataset.sq != null) { const k = +b.dataset.sq; if (typed[k] != null) { used = used.filter(x => x !== typed[k]); typed[k] = null; ui.haptic('light'); draw(); } return; }
    if (b.hasAttribute('data-sclear')) { typed = []; used = []; ui.haptic('light'); draw(); return; }
    if (b.hasAttribute('data-sshuffle')) {
      const i = (s.ok || []).length, w = items[i];
      const r = shuffled(w[2].split('').map((c, k) => k), Math.random);
      items[i] = [w[0], w[1], r.map(k => w[2][k]).join('')]; typed = []; used = []; ui.haptic('light'); draw('in'); return;
    }
    if (b.hasAttribute('data-sskip')) { if (finishWord(false)) { ui.haptic('medium'); draw(); } return; }
    if (b.hasAttribute('data-snext')) { showing = -1; ui.haptic('light'); draw('in'); }
  });
  box.addEventListener('keydown', e => {
    if (!/^[a-z]$/i.test(e.key) || stateOf().done || showing >= 0) return;
    const i = (stateOf().ok || []).length, w = items[i], k = w[2].split('').findIndex((c, x) => c === e.key.toUpperCase() && !used.includes(x));
    if (k >= 0) { e.preventDefault(); place(k); }
  });
  draw('in');
}

// ============================================================================ Crossword
const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function crossMount(box, api) {
  const X = daily.DAY.bx.d, W = X.words, cells = new Map();
  W.forEach(([ans, , r, c, d], wi) => { for (let k = 0; k < ans.length; k++) { const rr = d === 'a' ? r : r + k, cc = d === 'a' ? c + k : c, key = rr + ',' + cc; const e = cells.get(key) || {ch: ans[k], w: []}; e.w.push(wi); cells.set(key, e); } });
  const starts = [...new Map(W.map(([, , r, c]) => [r + ',' + c, [r, c]])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numOf = new Map(starts.map((p, i) => [p.join(','), i + 1]));
  const cellsOf = wi => { const [ans, , r, c, d] = W[wi]; return [...ans].map((_, k) => (d === 'a' ? `${r},${c + k}` : `${r + k},${c}`)); };
  let sel = {w: 0, k: 0};
  const solvedCells = s => new Set((s.ok || []).flatMap(cellsOf));
  function draw(fx) {
    if (!ok()) return;
    const s = stateOf(), f = s.f || {}, okw = s.ok || [], locked = solvedCells(s), mine = new Set(cellsOf(sel.w)), curKey = cellsOf(sel.w)[sel.k];
    let grid = '';
    for (let r = 0; r < X.h; r++) for (let c = 0; c < X.w; c++) {
      const key = r + ',' + c, e = cells.get(key);
      if (!e) { grid += '<span class="tv-x-void"></span>'; continue; }
      const n = numOf.get(key), letter = s.done ? e.ch : f[key] || '';
      grid += `<button type="button" class="tv-x-cell${locked.has(key) ? ' is-ok' : ''}${s.done && !locked.has(key) ? ' is-rev' : ''}${mine.has(key) && !s.done ? ' is-word' : ''}${key === curKey && !s.done ? ' is-cur' : ''}" data-xc="${key}" aria-label="${n ? n + ', ' : ''}${letter || 'blank'}">${n ? `<sup>${n}</sup>` : ''}<b>${letter}</b></button>`;
    }
    const clue = wi => `${numOf.get(W[wi][2] + ',' + W[wi][3])} ${W[wi][4] === 'a' ? 'Across' : 'Down'}`;
    const list = d => W.map((x, wi) => [x, wi]).filter(([x]) => x[4] === d).sort((a, b) => numOf.get(a[0][2] + ',' + a[0][3]) - numOf.get(b[0][2] + ',' + b[0][3]))
      .map(([x, wi]) => `<li><button type="button" class="tv-x-clue${okw.includes(wi) ? ' is-ok' : ''}${wi === sel.w ? ' is-on' : ''}" data-xw="${wi}"><b>${numOf.get(x[2] + ',' + x[3])}</b> ${esc(x[1])} <small>(${x[0].length})</small></button></li>`).join('');
    box.innerHTML = tvHead(`CROSSWORD · ${okw.length} OF ${W.length}`, s.done ? (okw.length === W.length ? 'Grid complete!' : 'Crossword finished') : 'Mini crossword', s.done ? `${s.pts || 0} points` : '')
      + `<div class="tv-x-grid" style="--cols:${X.w}">${grid}</div>`
      + (s.done ? '' : `<p class="tv-x-bar"><b>${clue(sel.w)}</b> ${esc(W[sel.w][1])}</p><div class="tv-kb">${KEYS.map((row, ri) => `<div>${row.split('').map(k => `<button type="button" data-xk="${k}">${k}</button>`).join('')}${ri === 2 ? '<button type="button" class="is-wide" data-xk="⌫" aria-label="Delete">⌫</button>' : ''}</div>`).join('')}</div>`)
      + `<div class="tv-x-lists"><div><h3>Across</h3><ol>${list('a')}</ol></div><div><h3>Down</h3><ol>${list('d')}</ol></div></div>`
      + (s.done ? '' : `<button type="button" class="tv-btn tv-btn-ghost" data-finish>Finish crossword</button>`);
    if (typeof fx === 'number') cellsOf(fx).forEach((k, i) => { const el = box.querySelector(`[data-xc="${k}"]`); ui.animate(el, [{transform: 'scale(1)'}, {transform: 'scale(1.18)'}, {transform: 'none'}], {duration: 360, delay: i * 45}); });
    if (fx === 'bad') cellsOf(sel.w).forEach(k => shake(box.querySelector(`[data-xc="${k}"]`)));
  }
  function nextFree(s, from) {
    const ks = cellsOf(sel.w), locked = solvedCells(s);
    for (let k = from; k < ks.length; k++) if (!locked.has(ks[k])) return k;
    return Math.min(from, ks.length - 1);
  }
  function type(ch) {
    const s = stateOf(); if (s.done) return;
    const f = {...(s.f || {})}, ks = cellsOf(sel.w), locked = solvedCells(s), key = ks[sel.k];
    if (ch === '⌫') {
      if (!locked.has(key) && f[key]) delete f[key];
      else { let k = sel.k - 1; while (k >= 0 && locked.has(ks[k])) k--; if (k >= 0) { sel.k = k; if (!locked.has(ks[k])) delete f[ks[k]]; } }
      bsave({...s, f}, api); ui.haptic('light'); draw(); return;
    }
    if (locked.has(key)) { sel.k = nextFree(s, sel.k); }
    f[ks[sel.k]] = ch; ui.haptic('selection');
    // every word through this square: solved?
    let okw = [...(s.ok || [])], newly = null;
    for (const wi of cells.get(ks[sel.k]).w) {
      if (okw.includes(wi)) continue;
      const word = cellsOf(wi).map(k => f[k] || '').join('');
      if (word === W[wi][0]) { okw.push(wi); newly = wi; }
    }
    const pts = Math.round(200 * okw.length / W.length);
    const full = cellsOf(sel.w).every(k => f[k]), wrong = full && !okw.includes(sel.w);
    if (!bsave({...s, f, ok: okw, pts, line: `${okw.length} of ${W.length} words`, done: okw.length === W.length}, api)) return;
    if (newly != null) {
      ui.haptic('success'); ui.announce(`${W[newly][0]}. Correct.`);
      const nxt = W.map((_, i) => i).find(i => !okw.includes(i));
      if (nxt != null && newly === sel.w) sel = {w: nxt, k: 0};
      draw(newly);
      const cell = box.querySelector(`[data-xc="${cellsOf(newly)[0]}"]`); pop(cell, `+${Math.round(200 / W.length)}`, 'is-gold');
      return;
    }
    if (wrong && sel.k === cellsOf(sel.w).length - 1) { ui.haptic('error'); draw('bad'); return; }
    sel.k = Math.min(sel.k + 1, cellsOf(sel.w).length - 1);
    sel.k = nextFree(stateOf(), sel.k);
    draw();
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ok()) return;
    const s = stateOf();
    if (b.dataset.xk) { type(b.dataset.xk); ui.animate(b, [{transform: 'translateY(-4px) scale(1.1)'}, {transform: 'none'}], {duration: 160}); return; }
    if (b.dataset.xc && !s.done) {
      const key = b.dataset.xc, ws = cells.get(key).w, cur = cellsOf(sel.w)[sel.k];
      const w = key === cur && ws.length > 1 ? ws.find(x => x !== sel.w) : ws.includes(sel.w) ? sel.w : ws[0];
      sel = {w, k: cellsOf(w).indexOf(key)}; ui.haptic('selection'); draw(); return;
    }
    if (b.dataset.xw != null && !s.done) { sel = {w: +b.dataset.xw, k: 0}; sel.k = nextFree(s, 0); ui.haptic('selection'); draw(); box.querySelector('.tv-x-grid').scrollIntoView({block: 'nearest', behavior: ui.RM ? 'auto' : 'smooth'}); return; }
    if (b.hasAttribute('data-finish')) {
      if (!b.classList.contains('is-confirm')) { b.classList.add('is-confirm'); b.textContent = 'Reveal the answers? Tap again'; return; }
      if (bsave({...s, pts: Math.round(200 * (s.ok || []).length / W.length), line: `${(s.ok || []).length} of ${W.length} words`, done: true}, api)) { ui.haptic('medium'); draw(); }
    }
  });
  box.addEventListener('keydown', e => { if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); type(e.key.toUpperCase()); } else if (e.key === 'Backspace') { e.preventDefault(); type('⌫'); } });
  const s0 = stateOf(), first = W.map((_, i) => i).find(i => !(s0.ok || []).includes(i));
  sel = {w: first == null ? 0 : first, k: 0}; sel.k = nextFree(s0, 0);
  draw();
}

// ============================================================================ Score Match
function scoreMount(box, api) {
  const G = daily.DAY.bx.d;
  const truth = G.flatMap(g => [g[5], g[9]]);
  const chips = shuffled(truth.map((v, i) => ({v, i})), rng(seedOf()));
  let held = null;
  const logo = (url, ab) => `<span class="tv-logo">${url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<em>${esc(ab)}</em></span>`;
  function draw(fx) {
    if (!ok()) return;
    const s = stateOf(), place = s.place || [null, null, null, null, null, null], placed = new Set(place.filter(x => x != null));
    const slot = k => {
      const c = place[k], right = s.done && c != null && chips[c].v === truth[k];
      return `<button type="button" class="tv-sslot${c != null ? ' is-full' : ''}${s.done ? (right ? ' is-ok' : ' is-no') : ''}${held != null && c == null ? ' is-target' : ''}" data-slot="${k}" ${s.done ? 'disabled' : ''}>${c != null ? chips[c].v : '—'}${s.done && !right ? `<small>${truth[k]}</small>` : ''}</button>`;
    };
    box.innerHTML = tvHead('SCORE MATCH', s.done ? `${(s.right || 0)} of 6 right` : 'Who scored what?', s.done ? `${s.pts || 0} points` : 'Three finals from this season. Tap a score, then the team that put it up.')
      + `<div class="tv-games">${G.map((g, gi) => `<div class="tv-game"><p class="tv-game-meta">Week ${g[0]} · ${new Date(g[1] + 'T12:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</p>`
        + `<div class="tv-team">${logo(g[4], g[3])}<b>${esc(g[2])}</b>${slot(gi * 2)}</div><div class="tv-team">${logo(g[8], g[7])}<b>${esc(g[6])}</b> <small>home</small>${slot(gi * 2 + 1)}</div></div>`).join('')}</div>`
      + (s.done ? '' : `<div class="tv-chips">${chips.map((c, k) => `<button type="button" class="tv-chip${placed.has(k) ? ' is-used' : ''}${held === k ? ' is-held' : ''}" data-chip="${k}" ${placed.has(k) ? 'disabled' : ''}>${c.v}</button>`).join('')}</div>`
        + `<button type="button" class="tv-btn tv-btn-go" data-slock ${placed.size === 6 ? '' : 'disabled'}>Lock in scores</button>`);
    if (fx === 'reveal') box.querySelectorAll('.tv-sslot').forEach((el, k) => { ui.animate(el, [{transform: 'rotateY(90deg)'}, {transform: 'none'}], {duration: 360, delay: k * 90, fill: 'backwards'}); });
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !ok()) return;
    const s = stateOf(); if (s.done) return;
    const place = [...(s.place || [null, null, null, null, null, null])];
    if (b.dataset.chip != null) { const k = +b.dataset.chip; held = held === k ? null : k; ui.haptic('selection'); draw(); return; }
    if (b.dataset.slot != null) {
      const k = +b.dataset.slot;
      if (place[k] != null) { place[k] = null; held = null; ui.haptic('light'); bsave({...s, place}, api); draw(); return; }
      if (held == null) { const free = chips.findIndex((c, i) => !place.includes(i)); if (free < 0) return; held = free; }
      place[k] = held; held = null; ui.haptic('medium');
      bsave({...s, place}, api); draw();
      const el = box.querySelector(`[data-slot="${k}"]`); ui.animate(el, [{transform: 'scale(.7)'}, {transform: 'scale(1.08)'}, {transform: 'none'}], {duration: 300});
      return;
    }
    if (b.hasAttribute('data-slock')) {
      const right = place.filter((c, k) => c != null && chips[c].v === truth[k]).length, pts = Math.round(200 * right / 6);
      if (!bsave({...s, place, right, pts, line: `${right} of 6 scores`, done: true}, api)) return;
      ui.haptic(right >= 4 ? 'success' : 'medium'); ui.announce(`${right} of 6 right. ${pts} points.`);
      draw('reveal'); pop(box.querySelector('.tv-head'), `+${pts}`, 'is-gold');
    }
  });
  draw();
}

const KINDS = {gridword: gridwordMount, wheel: wheelMount, scramble: scrambleMount, cross: crossMount, score: scoreMount};
export const bonusModule = {
  render: () => '<div class="tv tv-bonus" tabindex="-1"></div>',
  mount(el, ctx, api) {
    if (!el.querySelector('.tv')) el.innerHTML = '<div class="tv tv-bonus" tabindex="-1"></div>';
    const box = el.querySelector('.tv');
    if (!ok()) { box.innerHTML = tvHead('PUZZLE', 'No puzzle today', ''); return {unmount() {}}; }
    box.classList.add('tv-b-' + daily.DAY.bx.kind);
    // progress saved for another kind of bonus (a phone that ran an older build that day): its result stands, read only
    const was = daily.DS && daily.DS.bonus;
    if (was && was.kind && was.kind !== daily.DAY.bx.kind) {
      box.innerHTML = tvHead('PUZZLE', 'Today’s puzzle is played', `${was.pts || 0} points · ${was.line || 'Done'}`);
      return {unmount() {}};
    }
    const done = KINDS[daily.DAY.bx.kind](box, api, ctx);
    const off = daily.subscribe(type => { if (type === 'newday') ctx.nav('/puzzles/daily'); });
    return {unmount() { off(); if (typeof done === 'function') done(); }};
  }
};
