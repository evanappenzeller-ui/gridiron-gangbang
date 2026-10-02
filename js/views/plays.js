// Name the play (run cover module, slug 'plays'; v4 days from PLAY_FROM, every other day): two rounds, an offensive
// play then a defensive one, each a play diagram (js/core/plays.js) and four names from the same family (run plays
// with run plays, pass with pass, coverages with coverages). One pick per round, 100 points each; then a recap.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {playSVG, playByName} from '../core/plays.js';

const esc = data.esc;
const R = () => daily.playRounds();
const total = () => R().length;
const answered = () => (daily.DS && daily.DS.play ? daily.DS.play.a.length : 0);
const sideLabel = rd => rd.side === 'def' ? 'Defense: name the coverage' : 'Offense: name the play';

function roundHTML(r, shown) {
  const rd = R()[r];
  if (!rd) return '';
  const play = playByName(rd.name);
  const x = shown ? daily.DS.play.a[r] : null;
  const btns = rd.o.map((name, j) => {
    const cls = !shown ? '' : j === rd.a ? ' is-right' : j === x ? ' is-wrong' : ' is-dim';
    return `<button type="button" class="lb-ch${cls}" data-pl-opt="${j}"${shown ? ' aria-disabled="true"' : ''}>${esc(name)}</button>`;
  }).join('');
  const ok = shown && x === rd.a;
  const vt = !shown ? '' : ok ? `Correct. +100` : `It's ${rd.o[rd.a]}.`;
  const last = r >= total() - 1;
  return `<p class="lb-side">${esc(sideLabel(rd))}</p>`
    + `<div class="card lb-card">${play ? playSVG(play, {flip: rd.flip, key: 'r' + r}) : ''}</div>`
    + `<div class="lb-chs">${btns}</div>`
    + `<div class="pl-verdict"${shown ? '' : ' hidden'} data-pl-verdict><p class="cl-vt ${ok ? 'is-right' : 'is-wrong'}">${esc(vt)}</p>`
    + ui.button({label: last ? 'See how you did' : 'Next play', kind: 'primary', attrs: {'data-pl-next': ''}, cls: 'lb-next'}) + `</div>`;
}

function recapHTML() {
  const a = daily.DS.play.a, score = daily.playScore(), pts = daily.ptsPlay();
  const rows = R().map((rd, r) => {
    const x = a[r], ok = x === rd.a, miss = !(x >= 0);
    const sub = (rd.side === 'def' ? 'Defense' : 'Offense') + (ok ? '' : miss ? '. Not answered.' : `. You said ${rd.o[x]}.`);
    const mark = ui.icon(ok ? 'check-circle' : 'x-circle', {cls: 'cl-ri ' + (ok ? 'tint' : miss ? 'ink3' : 'wrong'), label: ok ? 'Right' : miss ? 'Not answered' : 'Wrong'});
    return ui.row({title: rd.name, sub, trail: mark});
  }).join('');
  const stamp = score === total() ? `<span class="rn-stamp cl-stamp">Film junkie</span>` : '';
  return `<div class="cl-recap card" data-pl-recap tabindex="-1" role="group" aria-label="${esc(`Name the play recap: ${score} of ${total()}, ${pts} points`)}">`
    + `<div class="cl-rh"><p class="cl-rs"><span class="n2">${score} of ${total()}</span><span class="n4 cl-rp ${pts ? 'tint' : 'ink3'}">+${esc(data.nf(pts))} pts</span></p>${stamp}</div>`
    + ui.group(rows, {cls: 'cl-rlist'}) + `</div>`;
}

const countText = () => { const n = answered(); return n >= total() ? 'Done' : `Play ${n + 1} of ${total()}`; };

function render() {
  const n = answered();
  return `<div class="c-play"><p class="cl-count t-foot" data-pl-count>${esc(countText())}</p>`
    + `<div class="pl-main" data-pl-main>${n >= total() ? recapHTML() : roundHTML(n, false)}</div></div>`;
}

function mount(el, ctx, api) {
  const I = {dead: false, showR: null, timers: []};
  const main = el.querySelector('[data-pl-main]'), count = el.querySelector('[data-pl-count]');
  const paint = html => { main.innerHTML = html; count.textContent = countText(); };
  el.addEventListener('click', e => {
    const opt = e.target.closest('[data-pl-opt]');
    if (opt && I.showR == null) {
      const res = daily.playPick(answered(), +opt.dataset.plOpt);
      if (!res) return;
      I.showR = res.round;
      paint(roundHTML(res.round, true));
      if (count) count.textContent = `Play ${res.round + 1} of ${total()}`;
      const b = main.querySelector(`[data-pl-opt="${+opt.dataset.plOpt}"]`);
      ui.announce(res.correct ? 'Correct. +100' : `It's ${R()[res.round].o[res.ans]}.`);
      if (res.correct) { if (b) ui.floatText(b, '+100'); ui.haptic('success'); } else { if (b) ui.shake(b); ui.haptic('error'); }
      I.timers.push(setTimeout(() => { if (!I.dead) api.refreshChrome(); }, 220));
      const v = main.querySelector('[data-pl-verdict]');
      setTimeout(() => { if (!I.dead && v) api.reveal(v); }, 30);
      return;
    }
    if (e.target.closest('[data-pl-next]')) {
      I.showR = null;
      const n = answered();
      ui.crossfade(main, () => paint(n >= total() ? recapHTML() : roundHTML(n, false)));
      api.refreshChrome();
    }
  });
  return {
    holdCta: () => I.showR != null,
    unmount() { I.dead = true; I.timers.forEach(clearTimeout); }
  };
}

export default {render, mount};
