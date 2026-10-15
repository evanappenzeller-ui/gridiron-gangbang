// Two-Minute Drill, the third game of the Daily Games tab (puzzles.js: its picker shows this pane for /puzzles/drill;
// imported on first use). After nfl2mindrill.com: you're down late with the ball, real NFL starters on both sides, and
// you call every snap against the look the defense shows (core/drill-sim.js is the engine, core/drill.js the days,
// memory, words and scoreboard).
//
// A pane module, like 17-0's: render(ctx), mount(el, ctx, {anchor}), params(el, ctx), unmount(el, ctx).
// Two modes (the segmented control): Daily, one drive a day, the same for everyone (each snap is saved as it's called,
// so there are no do-overs), and Survivor, drive after drive with random teams until one is lost.
// The screen: the scorebug (their score, the quarter and clock, yours, your timeouts), the down and distance, the field
// (top-down, your offense going up, every player a dot coloured by his rating, the line of scrimmage blue and the
// first-down line yellow), the call (the defense's look, then Run · Pass (short, sideline, deep) · RPO · Trick, and
// the clock tools: timeout, spike, field goal), and the drive so far. A snap plays out on the field (the ball moves, the
// clock runs down, the camera follows) and lands in the log. When the drive ends: the result, Share, and the league's
// Scoreboard (Today: everyone's drive, tap one to watch it once you've played yours; Survivor: best runs).
// Every control here is data-dr-*, so the Daily Puzzles handlers on the same screen never see these taps.
// Owner: Drill.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as dr from '../core/drill.js';
import * as daily from '../core/daily.js';
import {msToMidnight} from './board.js';

const E = dr.E;
const esc = data.esc;
const nf = n => data.nf(n);
const COPIED = 'Copied. Paste it in the league chat.';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const nextIn = () => ui.untilText(msToMidnight());
const ST = new WeakMap(); // ctx -> pane state

// A home-screen app open across an update imports this module new under the stylesheet it started with: when
// drill.css's mark (--dr-css on :root) isn't this module's, the current file is added (as in views/seventeen.js).
const CSS_V = '1';
function ensureCss() {
  try {
    if (getComputedStyle(document.documentElement).getPropertyValue('--dr-css').trim() === CSS_V || document.querySelector('link[data-dr-css]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL(`../../css/views/drill.css?v=${CSS_V}`, import.meta.url).href;
    l.setAttribute('data-dr-css', '');
    document.head.appendChild(l);
  } catch (_) {}
}

// ============================================================================ The field
// Field coordinates in yards: x across (0-53.3, the middle 26.67), y from your own goal line (0) to theirs (100), the
// end zones out to -10 and 110. The track is the whole field; it slides so the line of scrimmage sits BEHIND yards
// from the bottom of the window (which shows WIN yards; CSS: .dr-field height = WIN x --yd).
const WIDTH = 53.33, MID = 26.67, WIN = 36, BEHIND = 11;
// Spread out past real spacing so every dot (24px, about 4 yards across and 2.7 deep) and name has room.
const OFF_POS = {
  QB: [MID, -5.6], RB: [MID + 4.4, -5.8], WR1: [3.6, -1.2], WR2: [49.6, -1.2], WR3: [11.5, -2.8], TE: [MID + 12, -1.8],
  LT: [MID - 8, -1.4], LG: [MID - 4, -1.3], C: [MID, -1.2], RG: [MID + 4, -1.3], RT: [MID + 8, -1.4]
};
const LABELLED = new Set(['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'LCB', 'RCB', 'SS', 'FS']);
const LABEL_SIDE = {RB: 'r'}; // beside the dot, not under it (he sits level with the QB)
/** The defense's eleven for a look: slot -> [x, depth] (null: off the field). Base personnel against the loaded box,
 *  the nickel back in for everything else. */
function defPos(T, look) {
  const three = T.s === '34', P = {};
  const cbD = {box: 5, blitz: 2.6, two: 7, prevent: 12, man: 2.5}[look];
  P.LCB = [3.6, cbD]; P.RCB = [49.6, cbD];
  P.SS = {box: [MID + 9, 7], blitz: [MID + 9.5, 4.6], two: [MID + 12, 14.5], prevent: [MID + 9, 21], man: [MID + 5, 8.5]}[look];
  P.FS = {box: [MID - 2, 14], blitz: [MID, 13], two: [MID - 12, 14.5], prevent: [MID - 9, 21], man: [MID, 16]}[look];
  P.NB = look === 'box' ? null : {blitz: [9.6, 3.6], two: [11.5, 6.5], prevent: [11.5, 11], man: [11.5, 3.4]}[look];
  const lbD = {box: 5.2, blitz: 4.6, two: 6.2, prevent: 10, man: 5.6}[look];
  if (three) {
    Object.assign(P, {LDE: [MID - 6.5, 2.1], NT: [MID, 2.1], RDE: [MID + 6.5, 2.1]});
    P.WLB = look === 'prevent' ? [MID - 13, 8.5] : [MID - 11.4, 2.1];
    P.SLB = look === 'prevent' ? [MID + 13, 8.5] : [MID + 13, 2.1];
    P.LILB = look === 'box' ? [MID - 3.8, lbD] : look === 'blitz' ? [MID - 2.4, lbD] : [MID, lbD];
    P.RILB = look === 'box' ? [MID + 3.8, lbD] : null;
  } else {
    Object.assign(P, {LDE: [MID - 10.5, 2.1], LDT: [MID - 3.6, 2.1], RDT: [MID + 3.6, 2.1], RDE: [MID + 10.5, 2.1]});
    if (look === 'prevent') P.RDE = [MID + 15, 8];
    const nickel = look !== 'box';
    P.WLB = [look === 'blitz' ? MID - 7 : nickel ? MID - 4 : MID - 7, lbD];
    P.MLB = [look === 'blitz' ? MID + 1 : nickel ? MID + 4 : MID, lbD];
    P.SLB = nickel ? null : [MID + 7, lbD];
  }
  return P;
}
const top = y => `calc(var(--yd) * ${(110 - y).toFixed(2)})`;
const left = x => `${(x / WIDTH * 100).toFixed(2)}%`;
/** Where the track sits for a line of scrimmage: the window's top yard (never past the back of their end zone). */
const winTop = los => Math.min(110, los - BEHIND + WIN);
const trackY = los => `translateY(calc(var(--yd) * ${-(110 - winTop(los)).toFixed(2)}))`;
/** A rating's colour: red (55) through orange and yellow to green (99). */
function ratingColor(r) {
  const t = Math.max(0, Math.min(1, ((Number(r) || 55) - 55) / 44));
  return `hsl(${Math.round(4 + 124 * t)} 74% ${Math.round(54 - 6 * t)}%)`;
}
const tcol = id => (dr.team(id) ? dr.team(id).c : ['#25366A', '#8A94B8']);

function linesHTML(s) {
  let h = '';
  for (let y = 0; y <= 100; y += 5) h += `<i class="dr-yl${y % 10 ? '' : ' is-ten'}${y === 0 || y === 100 ? ' is-goal' : ''}" style="top:${top(y)}"></i>`;
  for (let y = 10; y <= 90; y += 10) {
    const n = y <= 50 ? y : 100 - y;
    h += `<b class="dr-num is-l" style="top:${top(y)}">${n}</b><b class="dr-num is-r" style="top:${top(y)}">${n}</b>`;
  }
  const [oc] = tcol(s.sc.o), [dc] = tcol(s.sc.d);
  h += `<span class="dr-ez is-them" style="top:${top(110)};--tc:${esc(dc)}"><b>${esc(dr.team(s.sc.d).n)}</b></span>`;
  h += `<span class="dr-ez is-us" style="top:${top(0)};--tc:${esc(oc)}"><b>${esc(dr.team(s.sc.o).n)}</b></span>`;
  return h;
}
/** Names on the outside players hang inward, so they never run off the field. */
const edgeCls = x => (x < 8 ? ' is-edge-l' : x > WIDTH - 8 ? ' is-edge-r' : '');
function dotHTML(side, p, x, y, hidden) {
  const lab = LABELLED.has(p.slot) ? `<em class="dr-pl-n">${esc(dr.short(p.n))}</em>` : '';
  const at = side === 'o' && LABEL_SIDE[p.slot] ? ' is-lab-' + LABEL_SIDE[p.slot] : '';
  return `<span class="dr-pl is-${side}${at}${edgeCls(x)}${hidden ? ' is-off' : ''}" data-dr-p="${side}-${p.slot}" style="left:${left(x)};top:${top(y)};--rc:${ratingColor(p.r)}">`
    + `<b class="dr-pl-j">${p.j == null ? '' : p.j}</b>${lab}</span>`;
}
/** Every player's spot for the drive's current snap: [{key, side, p, x, y, off}]. */
function spots(s) {
  const los = s.ball, out = [];
  const O = s.U.o, D = s.U.d;
  Object.keys(OFF_POS).forEach(slot => {
    const [x, dy] = OFF_POS[slot];
    out.push({key: 'o-' + slot, side: 'o', p: O.by[slot], x, y: los + dy});
  });
  const P = defPos(dr.team(s.sc.d), s.result ? 'two' : s.look || 'two');
  // Near their goal line the deep players squeeze in (never past the back of the end zone).
  const k = Math.max(0.35, Math.min(1, (108 - los) / 21));
  dr.team(s.sc.d).d.forEach(([slot]) => {
    const at = P[slot] || [slot === 'NB' ? 11.5 : MID + 7, 8];
    const dy = at[1] > 2.5 ? 2.5 + (at[1] - 2.5) * k : at[1];
    out.push({key: 'd-' + slot, side: 'd', p: D.by[slot], x: at[0], y: los + dy, off: !P[slot]});
  });
  return out;
}
function fieldHTML(s) {
  const los = s.ball;
  const fd = s.phase === 'play' && !s.result && los + s.togo < 100 ? los + s.togo : null;
  const dots = spots(s).map(d => dotHTML(d.side, d.p, d.x, d.y, d.off)).join('');
  return `<div class="dr-field" role="img" aria-label="${esc(fieldLabel(s))}" data-dr-field>`
    + `<div class="dr-track" style="transform:${trackY(los)}">`
    + linesHTML(s)
    + `<i class="dr-los" data-dr-los style="top:${top(los)}"></i>`
    + `<i class="dr-fd" data-dr-fd style="top:${top(fd == null ? los : fd)}"${fd == null ? ' hidden' : ''}></i>`
    + dots
    + `<span class="dr-ball" data-dr-ball style="left:${left(MID)};top:${top(los)}"></span>`
    + `</div><div class="dr-flash" data-dr-flash aria-hidden="true"></div></div>`;
}
function fieldLabel(s) {
  const look = s.look && E.LOOKS[s.look];
  return `Ball on the ${dr.spot(s)}.${look && !s.result ? ` ${dr.team(s.sc.d).n} defense in ${look.name.toLowerCase()}: ${look.sub.toLowerCase()}.` : ''}`;
}
/** Moves the field to the drive's current snap: the camera, the lines, the players (CSS transitions animate it). */
function patchField(st) {
  const f = st.el.querySelector('[data-dr-field]');
  if (!f) return;
  const s = st.s, los = s.ball;
  const fd = s.phase === 'play' && !s.result && los + s.togo < 100 ? los + s.togo : null;
  f.setAttribute('aria-label', fieldLabel(s));
  f.querySelector('.dr-track').style.transform = trackY(los);
  f.querySelector('[data-dr-los]').style.top = top(los);
  const fdEl = f.querySelector('[data-dr-fd]');
  fdEl.hidden = fd == null;
  if (fd != null) fdEl.style.top = top(fd);
  spots(s).forEach(d => {
    const e = f.querySelector(`[data-dr-p="${d.key}"]`);
    if (!e) return;
    e.style.left = left(d.x);
    e.style.top = top(d.y);
    e.classList.toggle('is-off', !!d.off);
    e.classList.toggle('is-edge-l', d.x < 8);
    e.classList.toggle('is-edge-r', d.x > WIDTH - 8);
  });
  const ball = f.querySelector('[data-dr-ball]');
  ball.style.left = left(MID);
  ball.style.top = top(los);
  ball.classList.remove('is-loose');
}

// ============================================================================ Markup: the game
function bugHTML(s) {
  const [oc, oa] = tcol(s.sc.o), [dc, da] = tcol(s.sc.d);
  const tos = Array.from({length: 3}, (_, i) => `<i class="${i < s.tos ? 'is-on' : ''}"></i>`).join('');
  return `<div class="dr-bug" data-dr-bug>`
    + `<span class="dr-bug-t is-them" style="--tc:${esc(dc)};--ta:${esc(da)}"><span class="dr-bug-ab">${esc(s.sc.d)}</span></span>`
    + `<span class="dr-bug-sc" data-dr-them>${s.them}</span>`
    + `<span class="dr-bug-mid"><span class="dr-bug-q">Q4</span><span class="dr-bug-clk${s.running ? ' is-run' : ''}" data-dr-clock>${dr.clockText(s.clock)}</span></span>`
    + `<span class="dr-bug-sc" data-dr-us>${s.us}</span>`
    + `<span class="dr-bug-t is-us" style="--tc:${esc(oc)};--ta:${esc(oa)}"><span class="dr-bug-poss" aria-hidden="true"></span><span class="dr-bug-ab">${esc(s.sc.o)}</span><span class="dr-bug-you">You</span>`
    + `<span class="dr-bug-to" data-dr-tos aria-label="${esc(plural(s.tos, 'timeout') + ' left')}">${tos}</span></span>`
    + `</div>`;
}
function sitHTML(s) {
  if (s.result) return `<p class="dr-sit" data-dr-sit><b>Final</b> · ${esc(dr.resultText(s).head)}</p>`;
  if (s.phase === 'pat') return `<p class="dr-sit" data-dr-sit><b>Touchdown</b> · down one · clock stopped</p>`;
  const where = s.ball === 50 ? 'ball at midfield' : `ball on the ${dr.spot(s)}`;
  return `<p class="dr-sit" data-dr-sit><b>${esc(dr.downText(s.down, s.togo, s.ball))}</b> · ${esc(where)} · `
    + `<span class="${s.running ? 'is-run' : ''}">${s.running ? 'clock running' : 'clock stopped'}</span></p>`;
}
function legendHTML() {
  return `<div class="dr-legend"><span class="dr-scale" aria-hidden="true"><span>worse</span><i></i><span>better</span></span>`
    + `<button type="button" class="btn btn-secondary btn-s dr-ratings" data-dr-ratings>${ui.icon('search', {size: 16})}<span class="btn-label">Player ratings</span></button></div>`;
}
const CALLS = [['run', 'Run'], ['pass', 'Pass'], ['rpo', 'RPO'], ['trick', 'Trick']];
const PASSES = [['short', 'Short', 'Quick throw'], ['side', 'Sideline', 'Stops the clock'], ['deep', 'Deep', 'Take a shot']];
const TWO = [['run2', 'Run'], ['pass2', 'Pass'], ['rpo2', 'RPO'], ['trick2', 'Trick']];
function callHTML(st) {
  const s = st.s, o = E.options(s);
  if (s.result) return '';
  const look = E.LOOKS[s.look];
  const lookLine = `<p class="dr-look"><span class="dr-look-k">Defense</span><b>${esc(look.name)}</b><span class="dr-look-s">${esc(look.sub)}</span></p>`;
  if (s.phase === 'pat') {
    return `<section class="dr-call" aria-labelledby="dr-call-t"><div class="dr-call-h"><h3 class="dr-call-t" id="dr-call-t">Kick or go for two?</h3><p class="dr-call-s">Down one</p></div>`
      + `<button type="button" class="btn btn-secondary dr-kick" data-dr-act="kick"><span class="btn-label">Kick it, tie the game</span></button>`
      + `<p class="dr-or">or go for two from the 2, to win it</p>` + lookLine
      + `<div class="dr-calls">${TWO.map(([k, l]) => `<button type="button" class="dr-cb" data-dr-act="${k}">${esc(l)}</button>`).join('')}</div></section>`;
  }
  const where = s.ball === 50 ? 'midfield' : dr.spot(s);
  const calls = st.pass
    ? `<div class="dr-calls is-pass">${PASSES.map(([k, l, sub]) => `<button type="button" class="dr-cb is-sub" data-dr-act="${k}"><span>${esc(l)}</span><small>${esc(sub)}</small></button>`).join('')}`
      + `<button type="button" class="dr-cb is-back" data-dr-back aria-label="Back to the calls">${ui.icon('close', {size: 20})}</button></div>`
    : `<div class="dr-calls">${CALLS.map(([k, l]) => {
      const off = k === 'trick' && !o.plays.includes('trick');
      return `<button type="button" class="dr-cb${off ? ' is-used' : ''}" ${k === 'pass' ? 'data-dr-pass' : `data-dr-act="${k}"`}${off ? ' disabled aria-label="Trick play, already used this drive"' : ''}>${esc(l)}${off ? '<small>Used</small>' : ''}</button>`;
    }).join('')}</div>`;
  const tools = [];
  if (o.timeout || s.running) tools.push(`<button type="button" class="btn btn-secondary btn-s dr-tool" data-dr-act="timeout"${o.timeout ? '' : ' disabled'}>${ui.icon('clock', {size: 16})}<span class="btn-label">Timeout · ${s.tos} left</span></button>`);
  if (s.running && s.down < 4) tools.push(`<button type="button" class="btn btn-secondary btn-s dr-tool" data-dr-act="spike">${ui.icon('bolt', {size: 16})}<span class="btn-label">Spike</span></button>`);
  if (o.fg) tools.push(`<button type="button" class="btn btn-secondary btn-s dr-tool is-fg" data-dr-act="fg"><span class="btn-label">Field goal · ${o.fg.dist} yd · ${Math.round(o.fg.p * 100)}%</span></button>`);
  const warn = s.running && s.clock <= E.HURRY
    ? `<p class="dr-warn">${ui.icon('clock', {size: 15})}<span>${esc(`The clock is running and the next snap takes ${E.HURRY} seconds to get off. ${o.timeout ? 'Call a timeout' : s.down < 4 ? 'Spike it' : 'Nothing left to stop it'}${o.fg ? (o.timeout ? ', then kick' : '') : ''}.`)}</span></p>`
    : '';
  return `<section class="dr-call" aria-labelledby="dr-call-t">`
    + `<div class="dr-call-h"><h3 class="dr-call-t" id="dr-call-t">Your call</h3><p class="dr-call-s">${esc(`${dr.downText(s.down, s.togo, s.ball)} · ${where}`)}</p></div>`
    + lookLine + calls
    + (tools.length ? `<div class="dr-tools">${tools.join('')}</div>` : '')
    + warn + `</section>`;
}
const TONE_IC = {good: 'arrow-up', bad: 'arrow-down', score: 'trophy', flat: 'chevron-right'};
function logItemHTML(s, p) {
  const t = dr.playText(s, p);
  const what = p.kind === 'timeout' ? 'Timeout' : dr.CALL_LABEL[p.call];
  const look = p.look && !['timeout', 'kick'].includes(p.call) ? ` vs ${E.LOOKS[p.look].name.toLowerCase()}` : '';
  const pre = p.kind === 'timeout' ? dr.clockText(p.clock) : p.call === 'kick' ? 'After the touchdown' : `${dr.downText(p.down, p.togo, p.ball)} · ${dr.spot(s, p.ball)} · ${dr.clockText(p.clock)}`;
  return `<li class="dr-lg is-${t.tone}"><span class="dr-lg-ic" aria-hidden="true">${ui.icon(TONE_IC[t.tone] || 'chevron-right', {size: 14})}</span>`
    + `<span class="dr-lg-b"><small class="dr-lg-pre">${esc(pre)}</small><b class="dr-lg-h">${esc(t.head)}</b>`
    + `<small class="dr-lg-sub">${esc([what + look, t.sub].filter(Boolean).join(' · '))}</small></span></li>`;
}
function logHTML(s) {
  if (!s.plays.length) return '';
  return ui.sectionHeader({title: 'The drive', level: 3}) + `<ol class="dr-log" data-dr-log>${s.plays.slice().reverse().map(p => logItemHTML(s, p)).join('')}</ol>`;
}
function resultHTML(st) {
  const s = st.s;
  if (!s.result) return '';
  const r = dr.resultText(s);
  const surv = st.mode === 'surv';
  const sv = surv ? dr.survivor() : null;
  let actions, foot = '';
  if (!surv) {
    actions = `<button type="button" class="btn btn-primary" data-dr-share>${ui.icon('share')}<span class="btn-label">Share</span></button>`;
    foot = `<p class="dr-next">${ui.icon('clock', {size: 15})}<span>Next drill in <span data-dr-next>${esc(nextIn())}</span></span></p>`;
  } else if (s.result === 'L') {
    actions = `<button type="button" class="btn btn-primary" data-dr-newrun>${ui.icon('play-fill')}<span class="btn-label">New run</span></button>`;
    foot = `<p class="dr-next">${esc(`Run over: ${plural(sv.run ? sv.run.streak : 0, 'drive')} survived. Best ${sv.best}.`)}</p>`;
  } else {
    actions = `<button type="button" class="btn btn-primary" data-dr-nextdrive>${ui.icon('play-fill')}<span class="btn-label">Next drive</span></button>`;
    foot = `<p class="dr-next">${esc(`${plural(sv.run ? sv.run.streak : 0, 'drive')} survived. Best ${sv.best}.`)}</p>`;
  }
  return `<section class="card dr-result is-${s.result}" aria-labelledby="dr-res-h">`
    + `<p class="dr-res-k">${esc(surv ? `Survivor · drive ${(sv.run ? sv.run.i : 0) + 1}` : `Two-Minute Drill #${st.n} · ${dr.dayLabel(st.n)}`)}</p>`
    + `<h2 class="dr-res-h" id="dr-res-h">${esc(r.head)}</h2>`
    + `<p class="dr-res-sc">${esc(`${s.sc.o} ${s.us} – ${s.sc.d} ${s.them}`)}</p>`
    + `<p class="dr-res-sub">${esc(r.sub)}</p>`
    + `<p class="dr-res-sq" aria-hidden="true">${esc(dr.squares(s))}</p>`
    + `<div class="dr-res-act">${actions}</div>${foot}</section>`;
}
function headHTML(st) {
  const s = st.s, n = st.n;
  const sc = s.sc, deficit = sc.them - sc.us;
  const g = sc.g;
  const kick = `Down ${deficit} · ${dr.clockText(sc.t)} left · ${dr.spot(s, sc.b)}`;
  const title = st.mode === 'surv' ? `Survivor` : `Drill #${n}`;
  const sub = st.mode === 'surv'
    ? (() => { const v = dr.survivor(); return `Drive ${(v.run ? v.run.i : 0) + 1}${v.run && v.run.streak ? ` · ${plural(v.run.streak, 'drive')} survived` : ''} · best ${v.best}`; })()
    : `${dr.dayLabel(n, {weekday: 'long', month: 'long', day: 'numeric'})}${g ? ` · Week ${g.wk}: ${g.a} at ${g.h}` : ''}`;
  return `<header class="dr-head">`
    + `<p class="dr-kick">${esc(kick)}</p>`
    + `<h2 class="dr-title">${esc(title)}</h2>`
    + `<p class="dr-sub">${esc(sub)}</p>`
    + ui.iconButton({icon: 'info', label: 'How the Two-Minute Drill works', cls: 'dr-howto', attrs: {'data-dr-help': ''}})
    + `</header>`;
}
const MODES = [{id: 'daily', label: 'Daily'}, {id: 'surv', label: 'Survivor'}];
function gameHTML(st) {
  const s = st.s;
  return headHTML(st)
    + `<div class="dr-game">${bugHTML(s)}${sitHTML(s)}${fieldHTML(s)}${legendHTML()}`
    + `<div data-dr-panel>${s.result ? resultHTML(st) : callHTML(st)}</div></div>`
    + `<div data-dr-logh>${logHTML(s)}</div>`;
}
function survIntroHTML() {
  const v = dr.survivor();
  return `<header class="dr-head"><p class="dr-kick">Drive after drive</p><h2 class="dr-title">Survivor</h2>`
    + `<p class="dr-sub">Random teams, a tougher spot every time. Win or tie to keep going; one loss ends the run.</p>`
    + ui.iconButton({icon: 'info', label: 'How the Two-Minute Drill works', cls: 'dr-howto', attrs: {'data-dr-help': ''}}) + `</header>`
    + `<section class="card dr-intro"><div class="tiles tiles-2">`
    + ui.statTile({label: 'Best run', value: nf(v.best)}) + ui.statTile({label: 'Runs', value: nf(v.runs)})
    + `</div><button type="button" class="btn btn-primary dr-start" data-dr-newrun>${ui.icon('play-fill')}<span class="btn-label">Start a run</span></button></section>`;
}
function bodyHTML(st) {
  if (!dr.DOC) return loadingHTML();
  const seg = ui.seg({name: 'dr-mode', items: MODES, value: st.mode, small: true, label: 'Mode', cls: 'dr-mode'});
  const main = st.mode === 'surv' && !st.s ? survIntroHTML() : gameHTML(st);
  return seg + main + boardHTML(st);
}

// ============================================================================ Markup: scoreboard
const SB_MODES = [{id: 'today', label: 'Today'}, {id: 'survivor', label: 'Survivor'}];
const SB_EMPTY = {today: ['Be first on the board.', 'No drives yet today. Run yours to take the top spot.'], survivor: ['', 'No Survivor runs yet.']};
const MARK = {W: 'W', T: 'T', L: 'L'};
function sbRowHTML(st, r, mode) {
  let sub, trail, label;
  if (mode === 'today') {
    const rp = r.k ? E.replay(dr.scenario(st.n), dr.DOC.teams, r.k) : null;
    const score = rp && rp.result ? `${rp.us}–${rp.them}` : '';
    sub = r.r === 'L' ? `Got to the ${rp ? dr.spot(rp, r.y) : r.y} · ${plural(r.p, 'play')}` : `${dr.clockText(r.c)} left · ${plural(r.p, 'play')}`;
    trail = `<span class="n4 c-bval dr-bval is-${r.r}">${MARK[r.r]} ${esc(score)}</span>`;
    label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}: ${{W: 'won', T: 'tied', L: 'lost'}[r.r]} ${score}. ${sub}. Show the drive.`;
  } else {
    sub = 'Best Survivor run';
    trail = `<span class="n4 c-bval dr-bval">${nf(r.b)}</span>`;
    label = `${ui.ordinal(r.rank)}, ${r.name}${r.me ? ', you' : ''}: best run ${plural(r.b, 'drive')}.`;
  }
  const tag = mode === 'today' ? 'button type="button"' : 'div';
  const close = mode === 'today' ? 'button' : 'div';
  return `<div class="c-brow-w" role="listitem"><${tag} class="row c-brow dr-brow${r.me ? ' is-me' : ''}"${mode === 'today' ? ` data-dr-who="${esc(r.key)}"` : ''} aria-label="${esc(label)}">`
    + `<span class="c-brank n4${r.rank <= 3 ? ' is-r' + r.rank : ''}" aria-hidden="true">${r.rank}</span>`
    + `<span class="row-lead" aria-hidden="true">${ui.nickAvatar(r.name, {size: 36, managerId: r.managerId, you: r.me, crown: r.rank === 1})}</span>`
    + `<span class="row-main" aria-hidden="true"><span class="row-title"><span class="c-bnick">${esc(r.name)}</span>${r.me ? ui.badge('you') : ''}</span><span class="row-sub">${esc(sub)}</span></span>`
    + `<span class="row-trail" aria-hidden="true">${trail}</span></${close}></div>`;
}
function sbBodyHTML(st, mode) {
  const state = dr.boardState();
  if (state === 'loading') return `<div class="c-board-sk">${ui.skeleton('rows', 3, {label: 'Loading the scoreboard.'})}</div>`;
  if (state !== 'ready') return `<p class="c-board-note">The scoreboard isn't connected right now.</p>`;
  let rows = [];
  try { rows = dr.boardRows(mode, st.n); } catch (e) { console.error(e); }
  if (!rows.length) {
    const [t, body] = SB_EMPTY[mode];
    return `<div class="c-board-empty">${t ? `<p class="c-board-et">${esc(t)}</p>` : ''}<p class="c-board-eb">${esc(body)}</p></div>`;
  }
  const n = rows.length;
  const lead = mode === 'today' ? `<p class="dr-sb-sum">${esc(`${n} ${n === 1 ? 'has' : 'have'} run today’s drill.`)}</p>` : '';
  return lead + `<div class="c-brows" role="list" aria-label="${esc(mode === 'today' ? "Today's drives" : 'Best Survivor runs')}">${rows.map(r => sbRowHTML(st, r, mode)).join('')}</div>`;
}
function boardHTML(st) {
  const hide = dr.boardState() === 'wait';
  return `<div class="dr-sb-host" data-dr-board${hide ? ' hidden' : ''}><section class="card c-board dr-board" aria-labelledby="dr-sb-t">`
    + `<div class="c-board-head"><h2 class="c-board-t" id="dr-sb-t">Scoreboard</h2></div>`
    + ui.seg({name: 'dr-sb', items: SB_MODES, value: st.sbMode, small: true, label: 'Scoreboard', cls: 'c-board-seg'})
    + `<div class="c-board-body" data-dr-sbody>${sbBodyHTML(st, st.sbMode)}</div></section></div>`;
}
const norm = typeof document !== 'undefined' ? document.createElement('template') : null;
function patchBoard(st, {fade = false} = {}) {
  if (st.dead || !dr.DOC) return;
  const host = st.el.querySelector('[data-dr-board]');
  if (!host) return;
  host.hidden = dr.boardState() === 'wait';
  const body = host.querySelector('[data-dr-sbody]');
  if (!body) return;
  const html = sbBodyHTML(st, st.sbMode);
  norm.innerHTML = html;
  if (body.innerHTML === norm.innerHTML) return;
  const go = () => { body.innerHTML = html; ui.hydrate(body); };
  if (fade && !ui.RM && st.ctx.visible) ui.crossfade(body, go, {duration: 160}); else go();
}
function scheduleBoard(st) {
  if (st.dead) return;
  if (st.cancelBoard) st.cancelBoard();
  st.cancelBoard = ui.whenIdle(() => { st.cancelBoard = null; patchBoard(st); });
}

// ============================================================================ Sheets
/** Someone's drive today: hidden until this phone has finished its own. */
function openDrive(st, key) {
  const row = dr.boardRows('today', st.n).find(r => r.key === key);
  if (!row) return;
  const mine = dr.dayState(st.n);
  let body;
  if (!row.me && !mine.result) {
    body = `<p class="dr-sh-note">${ui.icon('lock', {size: 16})}<span>${esc(`Run today’s drill to watch ${row.name}’s drive.`)}</span></p>`;
  } else {
    const d = dr.driveOf(key, st.n);
    if (!d || !d.s) body = `<p class="dr-sh-note">${ui.icon('info', {size: 16})}<span>That drive didn’t come with its plays.</span></p>`;
    else {
      const r = dr.resultText(d.s, {you: row.me});
      body = `<p class="dr-sh-res is-${d.s.result}"><b>${esc(r.head)}</b><span>${esc(`${d.s.sc.o} ${d.s.us} – ${d.s.sc.d} ${d.s.them} · ${r.sub}`)}</span></p>`
        + `<ol class="dr-log">${d.s.plays.map(p => logItemHTML(d.s, p)).join('')}</ol>`;
    }
  }
  ui.haptic('light');
  ui.openSheet({title: row.me ? 'Your drive' : `${row.name}’s drive`, body: `<div class="dr-sheet">${body}</div>`, detents: ['medium', 'large'], cls: 'sh-drill'});
}
function ratingRowHTML(p, pos) {
  return `<li class="dr-rt"><span class="dr-rt-j">${p.j == null ? '' : '#' + p.j}</span><span class="dr-rt-n"><b>${esc(p.n)}</b><small>${esc(pos)}</small></span>`
    + `<span class="dr-rt-v" style="--rc:${ratingColor(p.r)}">${p.r}</span></li>`;
}
const DEF_POS = {LDE: 'DE', RDE: 'DE', LDT: 'DT', RDT: 'DT', NT: 'NT', WLB: 'LB', MLB: 'LB', SLB: 'LB', LILB: 'LB', RILB: 'LB', LCB: 'CB', RCB: 'CB', SS: 'S', FS: 'S', NB: 'Nickel CB'};
const asofText = () => {
  const [y, m, d] = String(dr.DOC.asof).split('-').map(Number);
  return y ? new Date(y, m - 1, d).toLocaleDateString('en-US', {month: 'long', day: 'numeric'}) : '';
};
function openRatings(st) {
  const s = st.s;
  if (!s) return;
  const O = dr.team(s.sc.o), D = dr.team(s.sc.d);
  const off = O.o.map(r => s.U.o.by[r[0]]);
  const def = D.d.map(r => s.U.d.by[r[0]]);
  const edge = D.s === '34' ? {WLB: 'OLB', SLB: 'OLB'} : {};
  const body = `<div class="dr-sheet dr-rts">`
    + `<p class="dr-rt-intro">${esc(`Each starter’s rank at his spot across the league, from his 2025 season and 2026 so far (55 to 99). Depth charts as of ${asofText()}.`)}</p>`
    + `<h3 class="dr-rt-h">${esc(`Your offense · ${O.city} ${O.n}`)}</h3><ol class="dr-rt-l">${off.map(p => ratingRowHTML(p, dr.posOf(p.slot) === p.slot ? p.slot : dr.posOf(p.slot))).join('')}${ratingRowHTML(s.U.o.k, 'K')}</ol>`
    + `<h3 class="dr-rt-h">${esc(`Their defense · ${D.city} ${D.n}`)}</h3><ol class="dr-rt-l">${def.map(p => ratingRowHTML(p, edge[p.slot] || DEF_POS[p.slot] || p.slot)).join('')}</ol>`
    + `</div>`;
  ui.haptic('light');
  ui.openSheet({title: 'Player ratings', body, detents: ['large'], cls: 'sh-drill'});
}
function openHelp() {
  const body = `<div class="dr-help">`
    + `<p><b>You’re down late, and you have the ball.</b> Every day brings one drive, the same for everyone, from a real game on this week’s NFL slate with each team’s current starters. Score enough before the clock hits 0:00. Every snap counts as soon as you call it: there are no do-overs.</p>`
    + `<p><b>Read the defense.</b> Before each snap the defense shows a look. A <b>loaded box</b> is built to stop the run, and that leaves the deep ball open. A <b>blitz</b> sends extra rushers: get it out quick before the sack. A <b>two-high shell</b> keeps both safeties deep and squats on the sideline, so run it. <b>Prevent</b> gives up the short stuff but keeps you in bounds and the clock running. <b>Press man</b> is one-on-one everywhere: a good receiver can win deep.</p>`
    + `<p><b>The calls.</b> Run, pass (short, to the sideline, or deep), RPO (your quarterback reads the box and keeps it or throws quick), and one trick play a drive: a home run against an aggressive defense and a disaster against a patient one.</p>`
    + `<p><b>The players matter.</b> Every dot is a real starter, coloured by his rating. Throws go to receivers by how they match up with the man covering them, and your line against their rush decides the sacks. Tap Player ratings to scout.</p>`
    + `<p><b>The clock.</b> A run, a sack or a catch in bounds keeps it running, and the next snap takes ${E.HURRY} seconds to get off. Incompletions, going out of bounds, timeouts and spikes stop it. Down three or less, a field goal is there when you’re in range; down seven, a touchdown brings the choice: kick to tie, or go for two to win.</p>`
    + `<p><b>Survivor.</b> Drive after drive with random teams, each spot a little tougher. Win or tie to keep going; your best run goes on the scoreboard.</p>`
    + `</div>`;
  ui.openSheet({title: 'How it works', body, detents: ['large'], cls: 'sh-drill'});
}

// ============================================================================ Markup: states
function loadingHTML() {
  return `<div class="dr-loading" aria-busy="true">${ui.skeleton('rows', 4, {label: 'Loading the Two-Minute Drill.'})}</div>`;
}
function errorHTML() {
  return ui.empty({icon: 'football', title: 'The Two-Minute Drill needs a connection the first time.', action: {label: 'Try again', attrs: {'data-dr-retry': ''}}});
}

// ============================================================================ Playing a snap
const FLASH = {catch: p => (p.td ? 'Touchdown' : `+${p.gain}`), run: p => (p.td ? 'Touchdown' : p.gain > 0 ? `+${p.gain}` : p.gain === 0 ? 'No gain' : `${p.gain}`),
  inc: () => 'Incomplete', sack: p => `Sack ${p.gain}`, int: () => 'Intercepted', fum: () => 'Fumble', fg: () => 'It’s good', fgx: () => 'No good',
  spike: () => 'Spike', timeout: () => 'Timeout', xp: () => 'Tie game', '2good': () => 'Two!', '2fail': () => 'Stopped', expired: () => 'Time'};
function persist(st) {
  if (st.mode === 'surv') dr.saveSurvivor(st.s); else dr.record(st.n, st.s);
}
function doAct(st, k) {
  if (st.busy || !st.s || st.s.result) return;
  const ch = E.ACT[k];
  const s = st.s;
  const before = {ball: s.ball, clock: s.clock, us: s.us};
  const p = E.act(s, ch);
  if (!p) return;
  persist(st);
  st.pass = false;
  if (s.result) dr.autoPost(); // the day's drive, or a new Survivor best
  ui.haptic(p.kind === 'timeout' ? 'light' : 'medium');
  animatePlay(st, p, before);
}
function finishPlay(st, p) {
  st.busy = false;
  if (st.dead) return;
  const s = st.s;
  patchField(st);
  const bug = st.el.querySelector('[data-dr-bug]');
  if (bug) bug.outerHTML = bugHTML(s);
  const sit = st.el.querySelector('[data-dr-sit]');
  if (sit) sit.outerHTML = sitHTML(s);
  const panel = st.el.querySelector('[data-dr-panel]');
  if (panel) panel.innerHTML = s.result ? resultHTML(st) : callHTML(st);
  const logh = st.el.querySelector('[data-dr-logh]');
  if (logh) logh.innerHTML = logHTML(s);
  ui.hydrate(st.el);
  const t = dr.playText(s, p);
  if (s.result) {
    const res = st.el.querySelector('.dr-result');
    if (s.result === 'W' && res && !ui.RM) {
      ui.haptic('celebrate');
      ui.stamp(res.querySelector('.dr-res-h'), {from: 1.4});
      ui.confetti(res.getBoundingClientRect(), {colors: ['#FFC531', '#7CF058', '#FFFFFF'], count: 90});
    } else if (s.result === 'L') ui.haptic('error');
    if (st.mode !== 'surv') scheduleBoard(st);
    ui.announce(`${t.head}. ${dr.resultText(s).head}, ${s.us} to ${s.them}.`);
  } else ui.announce(`${t.head}. ${dr.downText(s.down, s.togo, s.ball)} on the ${dr.spot(s)}, ${dr.clockText(s.clock)} left.`);
  if (st.mode === 'surv' && s.result) patchHead(st);
}
function patchHead(st) {
  const h = st.el.querySelector('.dr-head');
  if (h && st.s) { h.outerHTML = headHTML(st); ui.hydrate(st.el); }
}
/** The snap on the field: the clock runs off, the ball goes where the play went and a word flashes, then the camera
 *  follows and the defense shows its next look. Reduced motion (or a hidden pane): straight to the result. */
function animatePlay(st, p, before) {
  st.busy = true;
  st.el.querySelectorAll('[data-dr-act], [data-dr-pass]').forEach(b => { b.disabled = true; });
  if (ui.RM || !st.ctx.visible) { finishPlay(st, p); return; }
  const f = st.el.querySelector('[data-dr-field]');
  const ball = f && f.querySelector('[data-dr-ball]');
  const clockEl = st.el.querySelector('[data-dr-clock]');
  runClock(st, clockEl, before.clock, p.after.clock, p.kind === 'timeout' ? 0 : 520);
  const flash = f && f.querySelector('[data-dr-flash]');
  const word = (FLASH[p.kind] || (() => ''))(p);
  if (flash && word) {
    flash.textContent = word;
    flash.className = 'dr-flash is-on is-' + dr.playText(st.s, p).tone;
    ui.stamp(flash, {from: 1.5});
  }
  let wait = 380;
  if (ball && ['catch', 'run', 'sack', 'inc', 'int', 'fum'].includes(p.kind)) {
    const slotX = p.who && OFF_POS[p.who] ? OFF_POS[p.who][0] : MID;
    const to = p.kind === 'inc' ? before.ball + 9 : p.kind === 'int' ? before.ball + 14 : before.ball + (p.gain || 0);
    ball.classList.toggle('is-loose', p.kind === 'inc' || p.kind === 'int' || p.kind === 'fum');
    ball.style.left = left(p.kind === 'sack' ? MID : slotX);
    ball.style.top = top(Math.max(-5, Math.min(108, to)));
    wait = 700;
  }
  st.timers.push(setTimeout(() => {
    if (flash) flash.className = 'dr-flash';
    finishPlay(st, p);
  }, wait + 260));
}
/** Counts the scorebug clock down from a to b over ms. */
function runClock(st, el, a, b, ms) {
  if (!el) return;
  if (!ms || a === b) { el.textContent = dr.clockText(b); return; }
  const t0 = performance.now();
  const step = now => {
    if (st.dead || !el.isConnected) return;
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = dr.clockText(Math.round(a + (b - a) * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ============================================================================ Modes and days
function setDaily(st) {
  st.n = dr.todayNumber();
  st.s = dr.drive(st.n);
}
function setSurvivor(st) {
  const v = dr.survivor();
  st.s = v.run ? dr.survivorDrive(v.run) : null;
}
function rerender(st, {fade = true} = {}) {
  const go = () => { st.el.innerHTML = bodyHTML(st); ui.hydrate(st.el); };
  if (fade && !ui.RM && st.ctx.visible) ui.crossfade(st.el, go, {duration: 160}); else go();
}
function setMode(st, m) {
  if (!MODES.some(x => x.id === m) || m === st.mode) return;
  st.mode = m;
  st.pass = false;
  if (m === 'surv') setSurvivor(st); else setDaily(st);
  rerender(st);
}
function share(st) {
  const s = st.s;
  if (!s || !s.result || st.mode === 'surv') return;
  ui.share({text: dr.shareText(st.n, s)}).then(r => {
    if (r === 'copied') { ui.toast(COPIED, {icon: 'check-circle'}); ui.haptic('success'); }
    else if (r === 'unavailable') ui.toast("Couldn't copy your drive.");
  });
}

function onClick(st, e) {
  const t = e.target.closest('[data-dr-act], [data-dr-pass], [data-dr-back], [data-dr-ratings], [data-dr-help], [data-dr-share], [data-dr-retry], [data-dr-who], [data-dr-newrun], [data-dr-nextdrive]');
  if (!t || !st.el.contains(t) || t.disabled) return;
  if (t.hasAttribute('data-dr-act')) { doAct(st, t.dataset.drAct); return; }
  if (t.hasAttribute('data-dr-pass') || t.hasAttribute('data-dr-back')) {
    if (st.busy) return;
    st.pass = t.hasAttribute('data-dr-pass');
    ui.haptic('selection');
    const panel = st.el.querySelector('[data-dr-panel]');
    if (panel) { panel.innerHTML = callHTML(st); ui.hydrate(panel); }
    const first = panel && panel.querySelector('.dr-calls button');
    if (first) { try { first.focus({preventScroll: true}); } catch (_) {} }
    return;
  }
  if (t.hasAttribute('data-dr-ratings')) { openRatings(st); return; }
  if (t.hasAttribute('data-dr-help')) { openHelp(); return; }
  if (t.hasAttribute('data-dr-share')) { share(st); return; }
  if (t.hasAttribute('data-dr-who')) { openDrive(st, t.dataset.drWho); return; }
  if (t.hasAttribute('data-dr-newrun')) { dr.newRun(); setSurvivor(st); ui.haptic('medium'); rerender(st); toTop(st); return; }
  if (t.hasAttribute('data-dr-nextdrive')) { dr.nextDrive(); setSurvivor(st); ui.haptic('medium'); rerender(st); toTop(st); return; }
  if (t.hasAttribute('data-dr-retry')) load(st);
}
/** Scrolls up so the game picker (opts.anchor, else the pane) sits just under the bar, if it is above the view. */
function toTop(st) {
  const scr = st.ctx.screen, a = st.anchor || st.el;
  if (!scr || !a.isConnected) return;
  const nav = scr.querySelector(':scope > .nav');
  const navH = nav ? nav.offsetHeight : 44;
  const y = a.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - navH - 8;
  if (scr.scrollTop > y) scr.scrollTop = Math.max(0, y);
}
function load(st) {
  st.el.innerHTML = loadingHTML();
  dr.load().then(() => {
    if (st.dead) return;
    if (st.mode === 'surv') setSurvivor(st); else setDaily(st);
    rerender(st, {fade: false});
    dr.autoPost();
  }, () => {
    if (st.dead) return;
    st.el.innerHTML = errorHTML();
    ui.hydrate(st.el);
  });
}
/** Each tick: the countdown, and after midnight the new drive (not mid-snap). */
function tick(st) {
  if (st.dead || !dr.DOC || st.busy) return;
  if (st.mode === 'daily' && dr.todayNumber() !== st.n) { setDaily(st); rerender(st); return; }
  const v = st.el.querySelector('[data-dr-next]');
  if (v) { const t = nextIn(); if (v.textContent !== t) v.textContent = t; }
}

// ============================================================================ Pane
export function render(ctx) {
  const st = ST.get(ctx);
  if (st) return bodyHTML(st);
  if (!dr.DOC) return loadingHTML();
  const tmp = {mode: 'daily', sbMode: 'today', pass: false};
  setDaily(tmp);
  return bodyHTML(tmp);
}

export function mount(el, ctx, {anchor} = {}) {
  ensureCss();
  const st = {el, ctx, anchor: anchor || null, mode: 'daily', sbMode: 'today', n: 0, s: null, pass: false, busy: false, dead: false, timers: [], cancelBoard: null};
  ST.set(ctx, st);
  st.onClick = e => onClick(st, e);
  st.onChange = e => {
    if (!e.detail) return;
    if (e.detail.name === 'dr-sb') {
      e.stopPropagation();
      if (e.detail.value !== st.sbMode && SB_MODES.some(x => x.id === e.detail.value)) { st.sbMode = e.detail.value; patchBoard(st, {fade: true}); }
    } else if (e.detail.name === 'dr-mode') {
      e.stopPropagation();
      setMode(st, e.detail.value);
    }
  };
  el.addEventListener('click', st.onClick);
  el.addEventListener('ui:change', st.onChange);
  st.stopTick = ctx.timer(() => tick(st), 20000);
  st.unsub = daily.subscribe(type => { if (type === 'lb' || type === 'ready' || type === 'error') scheduleBoard(st); });
  if (!dr.DOC) { load(st); return; }
  setDaily(st);
  rerender(st, {fade: false});
  dr.autoPost();
}

/** Shown again (the picker, a link): catch up with the day. */
export function params(el, ctx) {
  const st = ST.get(ctx);
  if (st) tick(st);
}

export function unmount(el, ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  st.dead = true;
  st.timers.forEach(clearTimeout);
  el.removeEventListener('click', st.onClick);
  el.removeEventListener('ui:change', st.onChange);
  if (st.stopTick) st.stopTick();
  if (st.unsub) st.unsub();
  if (st.cancelBoard) st.cancelBoard();
  ST.delete(ctx);
}
