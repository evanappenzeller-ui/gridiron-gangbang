// The fresh trivia games (puzzle days from daily.FRESH_FROM, Nov 26 2026; Evan, Nov 25 2026: "Improve upon the UI even
// further by adding smooth transitions and feedback when clicking on stuff or moving the needle ... I want the trivia
// games to feel sharp and the user should be receiving feedback when they interact"). Each is a run module
// ({render, mount(el, ctx, api)}: views/run.js) over the day's own level (daily.DAY: hl, cn, nq; bx for the bonus, in
// views/bonus.js), its progress in daily.DS[id] through daily.saveChallengeState:
//   stats        Higher or Lower: 4 career match-ups. The first total is shown; is the second higher or lower? The
//                answer counts up into place, the card flares green or red, +50 a right one. DS.stats {a, r, done}.
//   connections  Team Connections: 9 players, 3 groups of 3. Tiles dealt in a shuffle of the day's own (no group ever in
//                one row or one column; Evan: "all of the correct answers have been on one side"), Shuffle deals again.
//                Pick 3, Submit; a group found drops into a coloured band, a miss shakes and costs a life ("One away"
//                when two of the three go together); 3 misses end it. DS.connections {found, miss, done}; 0/70/140/200.
//   numbers      Number Trivia: 2 questions on a dial (drag, the − + buttons, arrow keys). The needle moves on its own
//                (no redraw while dragging), ticks as it crosses each tenth; Lock in sweeps the answer onto the dial and
//                scores how close (100 a question). DS.numbers {g, p, done}.
// Shared look: css/views/trivia.css (.tv), dark arena cards, bold condensed headlines with glow, haptics on each tap.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {bonusModule} from './bonus.js';

const esc = data.esc;
const nf = n => Number(n).toLocaleString('en-US');
const fmt = v => (Number.isInteger(v) ? nf(v) : Number(v).toFixed(1));
export const tvHead = (eyebrow, title, sub = '') => `<header class="tv-head"><p class="tv-eyebrow">${esc(eyebrow)}</p><h2 class="tv-title">${esc(title)}</h2>${sub ? `<p class="tv-sub">${esc(sub)}</p>` : ''}</header>`;
export function pop(el, text, cls = '') {
  if (!el) return;
  const p = document.createElement('span');
  p.className = 'tv-pop ' + cls; p.textContent = text; p.setAttribute('aria-hidden', 'true');
  el.appendChild(p);
  setTimeout(() => p.remove(), 1200);
}
export function shake(el) { if (el) ui.animate(el, [{transform: 'translateX(0)'}, {transform: 'translateX(-8px)'}, {transform: 'translateX(7px)'}, {transform: 'translateX(-5px)'}, {transform: 'translateX(3px)'}, {transform: 'translateX(0)'}], {duration: 380}); }
export function burst(el, ok = true) { if (el) ui.animate(el, [{transform: 'scale(1)', filter: 'brightness(1)'}, {transform: 'scale(1.06)', filter: 'brightness(1.35)'}, {transform: 'scale(1)', filter: 'brightness(1)'}], {duration: ok ? 420 : 300}); }
/** A number counting up into el (ms long), from 0 or `from`. */
export function countUp(el, to, ms = 650, from = 0) {
  if (!el) return;
  if (ui.RM) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dec = !Number.isInteger(to);
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3, v = from + (to - from) * e;
    el.textContent = dec ? v.toFixed(1) : nf(Math.round(v));
    if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  requestAnimationFrame(step);
}
/** A seeded random number generator (mulberry32). */
export function rng(seed) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const shuffled = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dayOk = id => daily.isFresh() && daily.hasStep(id);
const stateOf = (id, fresh) => (daily.DS && daily.DS[id] && typeof daily.DS[id] === 'object' ? daily.DS[id] : fresh());
export function save(id, next, api) { const ok = daily.saveChallengeState(id, next); if (ok) api && api.refreshChrome && api.refreshChrome(); return ok; }

// ============================================================================ Higher or Lower
function statsMount(el, ctx, api) {
  const box = el.querySelector('.tv');
  let showing = -1; // the round just answered, held on screen until Next
  const day = daily.DAY;
  function draw(fx) {
    if (!dayOk('stats')) return;
    const s = stateOf('stats', () => ({a: [], r: []})), R = day.hl, n = s.r.length;
    const i = showing >= 0 ? showing : Math.min(n, R.length - 1), q = R[i], answered = i < n;
    const dots = R.map((_, k) => `<span class="tv-dot${k < n ? (s.r[k] ? ' is-ok' : ' is-no') : ''}${k === i ? ' is-on' : ''}"></span>`).join('');
    if (s.done && showing < 0) {
      const right = s.r.filter(Boolean).length;
      box.innerHTML = tvHead('HIGHER OR LOWER · FINAL', right === 4 ? 'Perfect read!' : right >= 2 ? 'Nice work' : 'Tough day', `${right} of 4 right · ${right * 50} points`)
        + `<div class="tv-dots">${dots}</div><ol class="tv-recap">${R.map((x, k) => `<li class="${s.r[k] ? 'is-ok' : 'is-no'}"><b>${esc(x[0])}</b><span>${esc(x[1])} <em>${fmt(x[2])}</em> · ${esc(x[4])} <em>${fmt(x[5])}</em></span></li>`).join('')}</ol>`;
      return;
    }
    const verdict = answered ? (s.r[i] ? 'is-ok' : 'is-no') : '';
    box.innerHTML = tvHead(`HIGHER OR LOWER · ROUND ${i + 1} OF 4`, q[0], answered ? '' : `Is ${q[4]}’s total higher or lower?`)
      + `<div class="tv-dots">${dots}</div>`
      + `<div class="tv-vs"><div class="tv-card is-known"><span class="tv-card-name">${esc(q[1])}</span><span class="tv-card-sub">${esc(q[3])}</span><strong class="tv-card-num" data-a>${fmt(q[2])}</strong></div>`
      + `<span class="tv-vs-badge">VS</span>`
      + `<div class="tv-card is-mystery ${verdict}" data-b><span class="tv-card-name">${esc(q[4])}</span><span class="tv-card-sub">${esc(q[6])}</span><strong class="tv-card-num" data-bnum>${answered ? fmt(q[5]) : '???'}</strong>${answered ? `<span class="tv-verdict">${s.r[i] ? '✓ Correct' : '✗ Not quite'}</span>` : ''}</div></div>`
      + (answered ? `<button type="button" class="tv-btn tv-btn-go" data-next>${n >= 4 ? 'See final' : 'Next match-up ›'}</button>`
        : `<div class="tv-hl"><button type="button" class="tv-btn tv-hi" data-ans="higher"><span>▲</span>Higher</button><button type="button" class="tv-btn tv-lo" data-ans="lower"><span>▼</span>Lower</button></div>`);
    if (fx === 'reveal') {
      const b = box.querySelector('[data-b]');
      countUp(box.querySelector('[data-bnum]'), q[5], 700);
      setTimeout(() => { burst(b, s.r[i]); if (s.r[i]) pop(b, '+50', 'is-gold'); else shake(b); }, ui.RM ? 0 : 700);
    }
    if (fx === 'in') { const c = box.querySelector('.tv-vs'); ui.animate(c, [{opacity: 0, transform: 'translateY(14px)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'}); }
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !dayOk('stats')) return;
    const s = stateOf('stats', () => ({a: [], r: []}));
    if (b.dataset.ans && !s.done) {
      const i = s.r.length, q = day.hl[i], ok = (b.dataset.ans === 'higher') === (q[5] > q[2]);
      const next = {a: [...(s.a || []), b.dataset.ans], r: [...s.r, ok], done: s.r.length + 1 >= day.hl.length};
      if (!save('stats', next, api)) return;
      ui.haptic(ok ? 'success' : 'error'); ui.announce(`${ok ? 'Correct' : 'Wrong'}. ${q[4]}: ${fmt(q[5])}.`);
      showing = i; draw('reveal');
    } else if (b.hasAttribute('data-next')) { ui.haptic('light'); showing = -1; draw('in'); }
  });
  draw('in');
  return {unmount() {}};
}

// ============================================================================ Team Connections
const GROUP_COL = ['g1', 'g2', 'g3'];
/** The day's deal of the nine (seeded, so it's the same after a reload): no group all in one row or one column. */
function dealOf(cn, seed) {
  const all = cn.flatMap((g, gi) => g[1].map(name => ({name, g: gi})));
  const r = rng(seed * 7919 + 17);
  for (let k = 0; k < 200; k++) {
    const d = shuffled(all, r);
    const bad = [0, 1, 2].some(gi => { const at = d.map((x, i) => (x.g === gi ? i : -1)).filter(i => i >= 0); return new Set(at.map(i => Math.floor(i / 3))).size === 1 || new Set(at.map(i => i % 3)).size === 1; });
    if (!bad) return d;
  }
  return shuffled(all, r);
}
function connMount(el, ctx, api) {
  const box = el.querySelector('.tv'), day = daily.DAY, cn = day.cn;
  let deal = dealOf(cn, day.pnum || day.challengeSeed || 1), pick = [], shuffles = 0;
  function draw(fx) {
    if (!dayOk('connections')) return;
    const s = stateOf('connections', () => ({found: [], miss: 0})), found = s.found || [], miss = s.miss || 0;
    const left = deal.filter(x => !found.includes(x.g));
    const bands = (s.done ? [...found, ...[0, 1, 2].filter(g => !found.includes(g))] : found).map(g =>
      `<div class="tv-band ${GROUP_COL[g]}${found.includes(g) ? '' : ' is-missed'}" data-band="${g}"><b>${esc(cn[g][0])}</b><span>${cn[g][1].map(esc).join(' · ')}</span></div>`).join('');
    const lives = [0, 1, 2].map(k => `<span class="tv-life${k < 3 - miss ? '' : ' is-gone'}"></span>`).join('');
    box.innerHTML = tvHead('TEAM CONNECTIONS', s.done ? (found.length === 3 ? 'All three found!' : `${found.length} of 3 groups`) : 'Find three groups of three',
      s.done ? `${daily.CN_PTS[found.length]} points` : 'Pick three players who share something, then submit.')
      + `<div class="tv-bands">${bands}</div>`
      + (s.done ? '' : `<div class="tv-tiles" role="group" aria-label="Players">${left.map(x => `<button type="button" class="tv-tile${pick.includes(x.name) ? ' is-on' : ''}" data-tile="${esc(x.name)}" aria-pressed="${pick.includes(x.name)}">${esc(x.name)}</button>`).join('')}</div>`
        + `<div class="tv-lives" aria-label="${3 - miss} mistakes left"><span>Mistakes left</span>${lives}</div>`
        + `<div class="tv-row"><button type="button" class="tv-btn tv-btn-ghost" data-shuffle>Shuffle</button><button type="button" class="tv-btn tv-btn-ghost" data-clear ${pick.length ? '' : 'disabled'}>Clear</button><button type="button" class="tv-btn tv-btn-go" data-submit ${pick.length === 3 ? '' : 'disabled'}>Submit</button></div>`);
    if (fx === 'deal') box.querySelectorAll('.tv-tile').forEach((t, i) => ui.animate(t, [{opacity: 0, transform: 'scale(.85) translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 320, delay: i * 28, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'}));
    if (typeof fx === 'number') { const b = box.querySelector(`[data-band="${fx}"]`); ui.animate(b, [{opacity: 0, transform: 'scale(.9)'}, {opacity: 1, transform: 'scale(1.03)'}, {transform: 'none'}], {duration: 520, easing: 'cubic-bezier(.22,1,.36,1)'}); pop(b, `+${daily.CN_PTS[found.length] - daily.CN_PTS[found.length - 1]}`, 'is-gold'); }
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !dayOk('connections')) return;
    const s = stateOf('connections', () => ({found: [], miss: 0}));
    if (s.done) return;
    if (b.dataset.tile != null) {
      const nm = b.dataset.tile;
      if (pick.includes(nm)) pick = pick.filter(x => x !== nm); else if (pick.length < 3) pick = [...pick, nm]; else { shake(b); return; }
      ui.haptic('selection');
      b.classList.toggle('is-on', pick.includes(nm)); b.setAttribute('aria-pressed', String(pick.includes(nm)));
      ui.animate(b, [{transform: 'scale(.92)'}, {transform: 'scale(1)'}], {spring: 'bouncy'});
      box.querySelector('[data-submit]').disabled = pick.length !== 3; box.querySelector('[data-clear]').disabled = !pick.length;
      return;
    }
    if (b.hasAttribute('data-clear')) { pick = []; ui.haptic('light'); draw(); return; }
    if (b.hasAttribute('data-shuffle')) {
      shuffles++; ui.haptic('light');
      const found = s.found || [], r = rng((day.pnum || 1) * 31 + shuffles * 101);
      const keep = deal.filter(x => found.includes(x.g)), rest = shuffled(deal.filter(x => !found.includes(x.g)), r);
      deal = [...keep, ...rest]; draw('deal'); return;
    }
    if (b.hasAttribute('data-submit') && pick.length === 3) {
      const gs = pick.map(nm => deal.find(x => x.name === nm).g), g = gs[0], ok = gs.every(x => x === g);
      const found = ok ? [...(s.found || []), g] : s.found || [], miss = (s.miss || 0) + (ok ? 0 : 1);
      const next = {found, miss, done: found.length === 3 || miss >= 3};
      const tiles = [...box.querySelectorAll('.tv-tile.is-on')];
      if (!save('connections', next, api)) return;
      if (ok) { ui.haptic('success'); ui.announce(`Group found: ${cn[g][0]}.`); pick = []; draw(g); }
      else {
        ui.haptic('error');
        const away = [0, 1, 2].some(x => gs.filter(y => y === x).length === 2);
        tiles.forEach(shake);
        const msg = next.done ? 'Out of mistakes' : away ? 'One away…' : 'Not a group';
        ui.announce(msg);
        setTimeout(() => { pick = next.done ? [] : pick; draw(); const h = box.querySelector('.tv-lives') || box.querySelector('.tv-head'); pop(h, msg, 'is-red'); }, ui.RM ? 0 : 400);
      }
    }
  });
  draw('deal');
  return {unmount() {}};
}

// ============================================================================ Number Trivia (the dial)
const A0 = 135, SWEEP = 270, CX = 150, CY = 150, RR = 118;
const pt = (f, r = RR) => { const a = (A0 + SWEEP * f) * Math.PI / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
const arc = (f0, f1, r = RR) => { const a = pt(f0, r), b = pt(f1, r); return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} A${r} ${r} 0 ${(f1 - f0) * SWEEP > 180 ? 1 : 0} 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)}`; };
const frac = (q, v) => Math.max(0, Math.min(1, (v - q[2]) / (q[3] - q[2])));
function dialSVG(q, v, done) {
  const ticks = Array.from({length: 21}, (_, i) => { const a = pt(i / 20, i % 2 ? 104 : 98), b = pt(i / 20, 110); return `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}" class="tv-tick${i % 2 ? '' : ' is-major'}"/>`; }).join('');
  return `<svg class="tv-dial" viewBox="0 0 300 300" data-dial role="slider" tabindex="${done ? -1 : 0}" aria-label="Your answer in ${esc(q[1])}" aria-valuemin="${q[2]}" aria-valuemax="${q[3]}" aria-valuenow="${v}" aria-valuetext="${nf(v)} ${esc(q[1])}" aria-disabled="${done}">`
    + `<defs><linearGradient id="tvg" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stop-color="#3EE8FF"/><stop offset=".55" stop-color="#7CF058"/><stop offset="1" stop-color="#FFD84D"/></linearGradient>`
    + `<filter id="tvglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    + `<path d="${arc(0, 1)}" class="tv-track"/><path d="${arc(0, Math.max(.001, frac(q, v)))}" class="tv-arc" data-arc filter="url(#tvglow)"/>${ticks}`
    + `<path d="" class="tv-answer-arc" data-ans-arc/><circle r="0" class="tv-answer-dot" data-ans-dot/>`
    + `<circle cx="${CX}" cy="${CY}" r="82" class="tv-hub"/>`
    + `<line x1="${CX}" y1="${CY}" x2="${pt(frac(q, v), 96)[0].toFixed(1)}" y2="${pt(frac(q, v), 96)[1].toFixed(1)}" class="tv-needle" data-needle filter="url(#tvglow)"/>`
    + `<circle cx="${pt(frac(q, v))[0].toFixed(1)}" cy="${pt(frac(q, v))[1].toFixed(1)}" r="12" class="tv-knob" data-knob/>`
    + `<text x="${CX}" y="${CY + 6}" class="tv-dial-num" data-val>${nf(v)}</text><text x="${CX}" y="${CY + 34}" class="tv-dial-unit">${esc(q[1])}</text>`
    + `<text x="58" y="272" class="tv-dial-lim">${nf(q[2])}</text><text x="242" y="272" class="tv-dial-lim">${nf(q[3])}</text></svg>`;
}
function setDial(svg, q, v) {
  const f = frac(q, v), k = pt(f), n = pt(f, 96);
  svg.querySelector('[data-arc]').setAttribute('d', arc(0, Math.max(.001, f)));
  const kn = svg.querySelector('[data-knob]'); kn.setAttribute('cx', k[0].toFixed(1)); kn.setAttribute('cy', k[1].toFixed(1));
  const nd = svg.querySelector('[data-needle]'); nd.setAttribute('x2', n[0].toFixed(1)); nd.setAttribute('y2', n[1].toFixed(1));
  svg.querySelector('[data-val]').textContent = nf(v);
  svg.setAttribute('aria-valuenow', v); svg.setAttribute('aria-valuetext', `${nf(v)} ${q[1]}`);
}
const stepOf = q => { const r = q[3] - q[2]; for (const s of [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]) if (r / s <= 120) return s; return 1000; };
export const nqPoints = (q, g) => Math.max(0, Math.round(100 * (1 - Math.abs(g - q[4]) / (q[3] - q[2]) * 1.6)));
function numbersMount(el, ctx, api) {
  const box = el.querySelector('.tv'), day = daily.DAY, Q = day.nq;
  let showing = -1, guess = null, drag = null, lastTick = null;
  const cur = s => (showing >= 0 ? showing : Math.min((s.p || []).length, Q.length - 1));
  function draw(fx) {
    if (!dayOk('numbers')) return;
    const s = stateOf('numbers', () => ({g: [], p: []})), i = cur(s), q = Q[i], answered = i < (s.p || []).length;
    const total = (s.p || []).reduce((a, b) => a + b, 0);
    if (s.done && showing < 0) {
      box.innerHTML = tvHead('NUMBER TRIVIA · FINAL', `${total} of 200`, total >= 160 ? 'Sharpshooter.' : total >= 100 ? 'Solid guesses.' : 'Close counts next time.')
        + `<ol class="tv-recap">${Q.map((x, k) => `<li class="${s.p[k] >= 70 ? 'is-ok' : 'is-no'}"><b>${esc(x[0])}</b><span>You: <em>${nf(s.g[k])}</em> · Answer: <em>${nf(x[4])}</em> · ${s.p[k]} pts</span></li>`).join('')}</ol>`;
      return;
    }
    const v = answered ? s.g[i] : guess != null ? guess : Math.round((q[2] + q[3]) / 2 / stepOf(q)) * stepOf(q);
    guess = answered ? null : v;
    box.innerHTML = tvHead(`NUMBER TRIVIA · QUESTION ${i + 1} OF ${Q.length}`, q[0], answered ? '' : 'Drag the needle, or nudge it with − and +. Closer earns more.')
      + `<div class="tv-dial-wrap">${dialSVG(q, v, answered)}</div>`
      + (answered ? `<div class="tv-result" data-result><div><span>Your guess</span><b>${nf(s.g[i])}</b></div><div><span>Answer</span><b class="is-gold" data-truth>${nf(q[4])}</b></div><div><span>Points</span><b data-pts>${s.p[i]}</b></div></div><p class="tv-fact">${esc(q[5] || '')}</p><button type="button" class="tv-btn tv-btn-go" data-next>${(s.p || []).length >= Q.length ? 'See final' : 'Next question ›'}</button>`
        : `<div class="tv-row"><button type="button" class="tv-btn tv-btn-ghost tv-nudge" data-nudge="-1" aria-label="Lower">−</button><button type="button" class="tv-btn tv-btn-go" data-lock>Lock it in</button><button type="button" class="tv-btn tv-btn-ghost tv-nudge" data-nudge="1" aria-label="Higher">+</button></div>`);
    if (fx === 'reveal') {
      const svg = box.querySelector('[data-dial]'), f = frac(q, q[4]), dot = svg.querySelector('[data-ans-dot]'), aa = svg.querySelector('[data-ans-arc]');
      const g = frac(q, s.g[i]), t0 = performance.now(), ms = ui.RM ? 0 : 900;
      const step = now => {
        const k = ms ? Math.min(1, (now - t0) / ms) : 1, e = 1 - (1 - k) ** 3, at = g + (f - g) * e, p = pt(at, RR + 14);
        dot.setAttribute('cx', p[0].toFixed(1)); dot.setAttribute('cy', p[1].toFixed(1)); dot.setAttribute('r', '9');
        aa.setAttribute('d', arc(Math.min(g, at), Math.max(g, at) + .0005, RR + 14));
        if (k < 1) requestAnimationFrame(step);
        else { const r = box.querySelector('[data-result]'); burst(r, s.p[i] >= 50); pop(r, `+${s.p[i]}`, s.p[i] >= 70 ? 'is-gold' : ''); countUp(box.querySelector('[data-pts]'), s.p[i], 500); }
      };
      requestAnimationFrame(step);
    }
    if (fx === 'in') ui.animate(box.querySelector('.tv-dial-wrap'), [{opacity: 0, transform: 'scale(.92) rotate(-8deg)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
  }
  function set(v, tick = true) {
    const s = stateOf('numbers', () => ({g: [], p: []})), i = cur(s), q = Q[i];
    if (i < (s.p || []).length || s.done) return;
    const st = stepOf(q);
    v = Math.max(q[2], Math.min(q[3], Math.round(v / st) * st));
    if (v === guess) return;
    guess = v;
    const svg = box.querySelector('[data-dial]'); if (svg) setDial(svg, q, v);
    const band = Math.floor(frac(q, v) * 20);
    if (tick && band !== lastTick) { lastTick = band; ui.haptic('selection'); const t = box.querySelector('[data-val]'); if (t && !ui.RM) t.animate([{transform: 'scale(1.12)'}, {transform: 'scale(1)'}], {duration: 160, transformOrigin: 'center'}); }
  }
  function fromPointer(e) {
    const svg = box.querySelector('[data-dial]'), r = svg.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    let a = (Math.atan2(y, x) * 180 / Math.PI - A0 + 720) % 360;
    const f = a <= SWEEP ? a / SWEEP : a < SWEEP + 45 ? 1 : 0;
    const s = stateOf('numbers', () => ({g: [], p: []})), q = Q[cur(s)];
    set(q[2] + f * (q[3] - q[2]));
  }
  box.addEventListener('pointerdown', e => {
    const svg = e.target.closest('[data-dial]'); if (!svg || svg.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault(); drag = e.pointerId; box.setPointerCapture(e.pointerId); svg.classList.add('is-drag'); fromPointer(e);
  });
  box.addEventListener('pointermove', e => { if (drag === e.pointerId) fromPointer(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => box.addEventListener(n, () => { drag = null; box.querySelector('[data-dial]')?.classList.remove('is-drag'); }));
  box.addEventListener('keydown', e => {
    if (!e.target.closest('[data-dial]')) return;
    const s = stateOf('numbers', () => ({g: [], p: []})), q = Q[cur(s)], st = stepOf(q), big = st * 10;
    const m = {ArrowRight: st, ArrowUp: st, ArrowLeft: -st, ArrowDown: -st, PageUp: big, PageDown: -big};
    if (e.key in m) { e.preventDefault(); set(guess + m[e.key]); } else if (e.key === 'Home') { e.preventDefault(); set(q[2]); } else if (e.key === 'End') { e.preventDefault(); set(q[3]); }
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !dayOk('numbers')) return;
    const s = stateOf('numbers', () => ({g: [], p: []})), i = cur(s), q = Q[i];
    if (b.dataset.nudge) { const st = stepOf(q); set(guess + Number(b.dataset.nudge) * st); ui.animate(b, [{transform: 'scale(.9)'}, {transform: 'scale(1)'}], {spring: 'bouncy'}); return; }
    if (b.hasAttribute('data-lock') && !s.done) {
      const pts = nqPoints(q, guess), next = {g: [...(s.g || []), guess], p: [...(s.p || []), pts], done: (s.p || []).length + 1 >= Q.length};
      if (!save('numbers', next, api)) return;
      ui.haptic(pts >= 70 ? 'success' : 'medium'); ui.announce(`Answer ${nf(q[4])}. ${pts} points.`);
      showing = i; guess = null; lastTick = null; draw('reveal'); return;
    }
    if (b.hasAttribute('data-next')) { ui.haptic('light'); showing = -1; draw('in'); }
  });
  draw('in');
  return {unmount() {}};
}

// ============================================================================ the run modules
const MOUNT = {stats: statsMount, connections: connMount, numbers: numbersMount};
/** The run module for a fresh game (id: stats | connections | numbers | bonus). */
export function freshModule(id) {
  if (id === 'bonus') return bonusModule;
  return {
    render: () => `<div class="tv tv-${id}"></div>`,
    mount(el, ctx, api) {
      if (!el.querySelector('.tv')) el.innerHTML = `<div class="tv tv-${id}"></div>`;
      const inst = MOUNT[id](el, ctx, api);
      const off = daily.subscribe(type => { if (type === 'newday' || (!daily.isFresh() && !daily.TEST)) ctx.nav('/puzzles/daily'); });
      return {unmount() { off(); inst.unmount(); }};
    }
  };
}
