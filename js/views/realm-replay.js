// A raid watched again (the owner's ask, Oct 22 2026: "Provide raid replays of both being raided and attacking another
// player. These should both appear in a log with a play button next to them to watch the raid", and "Provide examples
// of computer raids for me"), over Keepfall (a cover over Daily Games, #/realm/replay/<id>), the owner's alone. The
// Chronicle's ▶ Watch opens it for any raid that kept its replay (core/realm.js: a record's rp, the newest ten of each
// list, and the example raids): the lot as it stood then (the realm you attacked, or yours as the raiders found it,
// never today's), the same 3D battlefield and soldiers as a live raid (views/realm-3d.js), driven by the recorded drops
// through the battle's own steps (core/realm-battle.js makeBattle: nothing random, so it plays out as it did). Play and
// pause, 1× 2× 4×, back to the start, a bar to see how far in it is (and to jump along it); at the top who raided whom,
// when, the stars, how much was knocked down and what was taken ("Example: nothing taken" for an example). Close goes
// back to Keepfall with the Chronicle open again. Watching changes nothing. Reduced motion: the camera holds still (it
// never sweeps here anyway); the raid still plays.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as F from '../core/realm.js';
import {replayBattle, DT} from '../core/realm-battle.js';
import {houseOf, MY_HOUSE, houseName, curHTML, starsHTML, reopenLog, canWatch} from './realm.js';
import {bars, floatText} from './realm-raid.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const ST = new WeakMap();
let D3 = null;
// The replay's speed: 1×, 2×, 4× (this phone remembers it, apart from a live raid's).
const SPEEDS = [1, 2, 4], SPEED_KEY = 'gg-rl-replay-speed';
const savedSpeed = () => { const v = Number(ui.lsGet(SPEED_KEY)); return SPEEDS.includes(v) ? v : 1; };
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.9v14.2a1.3 1.3 0 0 0 1.97 1.11l11.36-7.1a1.3 1.3 0 0 0 0-2.22L8.97 3.79A1.3 1.3 0 0 0 7 4.9z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor"/></svg>';
const AGAIN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v5h5"/></svg>';

// ---------------------------------------------------------------------------------------------------- the record
const KIND = {rd: 'attack', df: 'defense', ex: 'example'};
/** A raid on the record by its id (core/realm.js findRaid): {rec, kind: 'attack' (one of yours, s.rd) | 'defense' (on
 *  your realm, s.df) | 'example' (s.ex)} or null. */
export function raidOf(s, id) {
  const f = F.findRaid(s, String(id || ''));
  return f && KIND[f.kind] ? {rec: f.rec, kind: KIND[f.kind]} : null;
}
/** What a recorded raid needs to play again (core/realm.js replayOf: the lot as it stood, its take, the army, the drops,
 *  the heroes on each side, where it ended and how long it ran), or null: none kept, one played under other rules, or not
 *  the owner's phone. s: the realm it's on (the lots its replay may point at). */
export function partsOf(rec, s = F.mine()) {
  if (!canWatch(rec, s)) return null;
  try {
    const p = F.replayOf(rec, s);
    return p && p.base && Array.isArray(p.base.b) && p.base.b.length && Array.isArray(p.drops) ? p : null;
  } catch (e) { console.error(e); return null; }
}
/** The computer's realm a record is about: {k, name, th} (the one attacked, or the one that raided you). */
function botOf(rec, kind) {
  if (kind === 'attack') return F.BOTS.find(b => b.k === rec.vs) || {k: rec.vs, name: rec.nm, th: 1};
  return F.BOTS.find(b => b.k === rec.vs) || F.BOTS.find(b => b.name === rec.by) || {k: '', name: rec.by, th: rec.th || 1};
}
/** When (for the header): "Today, 5:26 AM", "Yesterday, 5:26 PM", "Tue Oct 20, 5:26 PM". */
export function whenOf(at, now = Date.now()) {
  const d = new Date(at), day = F.dayKey(at), time = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
  if (day === F.dayKey(now)) return `Today, ${time}`;
  if (day === F.dayKey(now - 24 * F.HOUR)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'}).replace(',', '')}, ${time}`;
}
/** The header: who raided whom, when, the stars, how much came down, what was taken. */
export function headHTML(s, rec, kind, now = Date.now()) {
  const bot = botOf(rec, kind), lt = Array.isArray(rec.lt) ? rec.lt : [0, 0], took = (lt[0] || 0) + (lt[1] || 0) > 0;
  const who = kind === 'attack' ? `${esc(houseName(s))} raided ${esc(rec.nm || bot.name)}` : `${esc(rec.by || bot.name)} raided ${esc(houseName(s))}`;
  const what = kind === 'example' ? '<span class="rlp-ex">Example: nothing taken</span>'
    : took ? `<span class="rlp-took">${kind === 'attack' ? 'You took' : 'Took'} ${curHTML('gold', lt[0])}${curHTML('grain', lt[1])}</span>`
      : `<span class="rlp-took">${kind === 'attack' ? 'Nothing taken' : 'Driven off: nothing taken'}</span>`;
  return `<span class="rl-tg-lv" aria-hidden="true">${bot.th}</span><span class="rlp-who-t">`
    + `<b>${who}</b>`
    // (an example's tag on the line under: in the name's two lines it pushed out who was raided)
    + `<small>${kind === 'example' ? '<em class="rlp-tag">Example</em>' : ''}${esc(whenOf(rec.at, now))}</small>`
    + `<span class="rlp-res">${starsHTML(rec.st || 0)}<span class="rlp-pc">${rec.pc || 0}%</span>${what}</span></span>`;
}

// ---------------------------------------------------------------------------------------------------- the screen
function shellHTML() {
  return `<div class="rl rlr rlp" data-no-swipe>`
    + `<div class="rl-gl" aria-hidden="true"><div class="rl-loading">Unrolling the Chronicle…</div></div>`
    + `<div class="rl-tags" aria-hidden="true"></div>`
    + `<div class="rlr-top"><button type="button" class="rlr-quit is-back" data-rlp-close>Close</button><div class="rlr-who rlp-who" data-rlp-who></div></div>`
    + `<div class="rlp-dock" data-rlp-dock hidden>`
    + `<div class="rlp-now"><span class="rlp-live" data-rlp-live></span><span class="rlp-time" data-rlp-time>0:00</span></div>`
    + `<input type="range" class="rlp-prog" data-rlp-prog min="0" max="1000" step="1" value="0" aria-label="How far into the raid">`
    + `<div class="rlp-ctl"><button type="button" class="rlp-b" data-rlp-restart aria-label="Back to the start">${AGAIN}</button>`
    + `<button type="button" class="rlp-b is-play" data-rlp-play aria-label="Pause">${PAUSE}</button>`
    + `<button type="button" class="rlr-speed rlp-speed" data-rlp-speed></button></div></div>`
    + `<div class="rlr-msg" data-rlp-msg hidden></div>`
    + `<div class="rlr-end" data-rlp-end hidden></div></div>`;
}
const clock = t => { const s = Math.max(0, Math.floor(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---- the battle: a new one from the recording, run on to the replay's clock
// (core/realm-battle.js replayBattle: a battle on the recorded lot whose play(t) runs its clock to t, each recorded
// soldier going in at his step, and ends where the raid did)
function fresh(st) {
  st.B = replayBattle(st.P);
  st.t = 0; st.coinAt = 0; st.deadSig = null; st.ended = false;
}
/** Runs the battle on until its clock is at t, or it's over. */
const advance = (st, t) => st.B.play(t);
/** How long the raid ran (seconds): the recording says (core's dur); never nothing. */
const lengthOf = st => Math.max(DT, Math.min(F.RAID_S, Number(st.B.dur) || Number(st.P.dur) || F.RAID_S));

function playBtn(st) {
  const b = st.el.querySelector('[data-rlp-play]');
  const on = st.seekTo != null ? st.seekResume : st.playing && !st.ended;
  b.innerHTML = on ? PAUSE : PLAY;
  b.setAttribute('aria-label', on ? 'Pause' : st.ended ? 'Watch again' : 'Play');
}
function speedBtn(st) {
  const b = st.el.querySelector('[data-rlp-speed]');
  b.textContent = `${st.speed}×`;
  b.setAttribute('aria-label', `Replay speed ${st.speed} times: tap to change`);
  b.classList.toggle('is-fast', st.speed > 1);
}
/** The live line (stars and how much is down so far, and what's been taken but for an example) and the bar. */
function live(st) {
  const B = st.B;
  const html = `${starsHTML(B.stars())}<b>${B.pct()}%</b>${st.kind === 'example' ? '' : `<span class="rlr-got">${curHTML('gold', B.got.gold)}${curHTML('grain', B.got.grain)}</span>`}`;
  const el = st.el.querySelector('[data-rlp-live]');
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
  const time = `${clock(st.t)} / ${clock(st.len)}`, tm = st.el.querySelector('[data-rlp-time]');
  if (tm.textContent !== time) tm.textContent = time;
  const prog = st.el.querySelector('[data-rlp-prog]');
  if (!st.seeking) {
    const v = String(Math.round(Math.min(1, st.t / st.len) * 1000));
    if (prog.value !== v) prog.value = v;
    prog.style.setProperty('--rlp-p', `${(Math.min(1, st.t / st.len) * 100).toFixed(1)}%`);
    prog.setAttribute('aria-valuetext', `${clock(st.t)} of ${clock(st.len)}`);
  }
}
function lot(st) {
  const B = st.B, sig = B.bl.filter(b => b.dead).map(b => b.i).join(',');
  if (sig === st.deadSig) return;
  st.deadSig = sig;
  st.v.setLot(st.P.base, {now: st.rec.at || Date.now(), house: st.lotHouse, gone: new Set(B.bl.filter(b => b.dead).map(b => b.i))});
}
/** Back to the start. */
function restart(st) {
  if (!st.v || st.dead) return;
  st.el.querySelector('[data-rlp-end]').hidden = true;
  st.seekTo = null;
  fresh(st);
  redraw(st);
}
// (the battle as it is now drawn from here: the raid's soldiers, arrows and dust as they're drawn kept, this battle in
// their place: realm-3d.js raidRestart)
function redraw(st) {
  if (typeof st.v.raidRestart === 'function') st.v.raidRestart(st.B, st.raider); else st.v.raidStart(st.B, st.raider);
  st.last = 0;
  lot(st); live(st);
  st.v.want();
}
/** The bar let go at to (seconds): on to there unseen (forward from here, or from the start to go back), a slice at a
 *  time with the page's own work between (played at once, a long raid held the screen still for half a second a jump),
 *  the picture held meanwhile; then on playing if resume. */
function seek(st, to, resume) {
  if (!st.v || st.dead) return;
  st.el.querySelector('[data-rlp-end]').hidden = true;
  if (to < st.B.t - 1e-9 || st.ended) fresh(st); // (a battle only runs forward)
  st.ended = false; st.playing = false;
  st.seekTo = Math.max(0, Math.min(st.len, to)); st.seekResume = !!resume;
  playBtn(st);
  clearTimeout(st.seekT);
  const slice = () => { st.seekT = 0; if (st.dead || st.seekTo == null || !st.v || !F.mayPlay()) return; if (seeking(st)) st.seekT = setTimeout(slice, 0); };
  st.seekT = setTimeout(slice, 0);
}
/** A slice of the jump (seek): true while there's more to do. */
function seeking(st) {
  const to = st.seekTo, B = st.B, t0 = performance.now();
  while (!B.over && B.t + DT <= to + 1e-9 && performance.now() - t0 < 12) advance(st, Math.min(to, B.t + .5));
  if (!B.over && B.t + DT <= to + 1e-9) return true;
  advance(st, to);
  st.seekTo = null;
  st.t = Math.min(to, B.t);
  B.fx.length = 0; st.coinAt = 0; st.deadSig = null; // (what happened on the way there: not played out at once)
  redraw(st);
  if (st.t >= st.len - DT) ended(st);
  else if (st.seekResume) setPlaying(st, true);
  else { st.idleAt = performance.now(); playBtn(st); }
  return false;
}
function setPlaying(st, on) {
  // (mid-jump: whether it plays on once there)
  if (st.seekTo != null) { st.seekResume = !!on; playBtn(st); return; }
  if (on && st.ended) { restart(st); }
  st.playing = !!on; st.last = 0;
  if (!on) st.idleAt = performance.now();
  playBtn(st);
  if (st.v) st.v.want();
}
function ended(st) {
  if (st.ended) return;
  st.ended = true; st.playing = false; st.idleAt = performance.now();
  st.t = Math.max(st.t, Math.min(st.len, st.B.t));
  playBtn(st); live(st);
  const r = st.rec, kind = st.kind, end = st.el.querySelector('[data-rlp-end]'), lt = Array.isArray(r.lt) ? r.lt : [0, 0];
  const k = kind === 'attack' ? (r.st === 3 ? 'Sacked' : r.st ? 'Victory' : 'Defeat') : r.st ? (r.st === 3 ? 'Sacked' : 'Broken through') : 'Driven off';
  // (played to its end, it should come out as recorded: the stars, how much came down, what was taken; if it didn't, the
  // rules have changed since in a way the replay can't tell, so it says so rather than show a different raid as this one)
  const B = st.B, same = !B.over || (B.stars() === (r.st || 0) && B.pct() === (r.pc || 0) && B.got.gold === (lt[0] || 0) && B.got.grain === (lt[1] || 0));
  end.hidden = false;
  end.innerHTML = `<div class="rlr-card"><p class="rlr-card-k">${k}</p>${starsHTML(r.st || 0, true)}`
    + `<p class="rlr-card-p">${r.pc || 0}% of ${kind === 'attack' ? esc(r.nm) : 'your realm'} knocked down</p>`
    + (kind === 'example' ? '<p class="rlr-card-p">Example: nothing taken</p>' : `<div class="rlr-card-got">${curHTML('gold', lt[0])}${curHTML('grain', lt[1])}</div>`)
    + (same ? '' : '<p class="rlr-card-note" data-rlp-differs>This replay was recorded under older rules, so it may not play out exactly as the raid did.</p>')
    + `<button type="button" class="btn btn-primary btn-block" data-rlp-again>Watch again</button>`
    + `<button type="button" class="rlp-close2" data-rlp-close>Back to the Chronicle</button></div>`;
}

async function start3d(st) {
  const ok = await (D3 ? D3.load() : import('./realm-3d.js').then(m => { D3 = m; return m.load(); }));
  if (st.dead || !F.mayPlay()) return;
  const host = st.el.querySelector('.rl-gl');
  if (!ok) { host.innerHTML = '<div class="rl-loading">This phone can’t show the raid in 3D.</div>'; return; }
  host.innerHTML = '';
  st.v = D3.create(host, {house: st.lotHouse, zoom: 60, onCamera: () => bars(st)});
  st.v.setLot(st.P.base, {now: st.rec.at || Date.now(), house: st.lotHouse});
  // (framed once on the lot as it stood; the camera only moves when a finger moves it)
  { const bx = F.boxOf(st.P.base); st.v.frame(bx.x0 - 3, bx.y0 - 3, bx.x1 + 3, bx.y1 + 3, 1); }
  st.el.querySelector('.rlp').__rl = st; // (for the checks' and tests' hands)
  restart(st);
  st.el.querySelector('[data-rlp-dock]').hidden = false;
  setPlaying(st, true);
  st.v.setAnim(now => {
    if (st.dead || !F.mayPlay()) return false;
    // (mid-jump: the picture held where it was while the battle runs on unseen: seek)
    if (st.seekTo != null) { st.last = now; return false; }
    const B = st.B;
    if (st.playing && !st.ended) {
      const dt = st.last ? Math.min(.25, Math.max(0, now - st.last) / 1000) : 0;
      st.t = Math.min(st.len, st.t + dt * st.speed);
      // (the battle a step ahead of the clock, so each soldier eases from one step's place to the next)
      advance(st, st.t + DT);
    }
    st.last = now;
    st.v.raidFrame(st.t, now);
    lot(st);
    for (; st.coinAt < B.fx.length; st.coinAt++) {
      const e = B.fx[st.coinAt];
      if (st.kind !== 'example' && e.k === 'coin' && e.n >= 1) floatText(st, e.x, e.y, `+${nf(e.n)}`, e.c);
    }
    bars(st);
    live(st);
    if (st.playing && !st.ended && (st.t >= st.len - 1e-6 || (B.over && st.t >= B.t - DT))) ended(st);
    return st.playing || (now - (st.idleAt || 0)) < 1200;
  });
}

export default {
  id: 'realm-replay',
  chrome: 'none',
  title: 'Replay',

  render() { return F.mayPlay() ? shellHTML() : '<div class="rl rl-none"></div>'; },

  mount(el, ctx) {
    if (!F.mayPlay()) return; // (the owner's alone: nothing here on anyone else's phone)
    const id = decodeURIComponent((ctx.params && ctx.params.id) || '');
    const st = {el, ctx, id, v: null, B: null, P: null, rec: null, kind: '', t: 0, len: 1, playing: false, ended: false, dead: false,
      speed: savedSpeed(), last: 0, coinAt: 0, deadSig: '', seeking: false};
    ST.set(ctx, st);
    speedBtn(st);
    const close = () => { if (F.mayPlay()) reopenLog(); ctx.back(); };
    st.stopProfile = data.subscribe(type => {
      if (type === 'me' && !F.mayPlay()) {
        st.dead = true; st.playing = false;
        if (st.v) { st.v.dispose(); st.v = null; }
        el.replaceChildren();
      }
    });
    el.addEventListener('click', e => {
      if (st.dead || !F.mayPlay()) return;
      const t = e.target;
      if (t.closest('[data-rlp-close]')) { close(); return; }
      if (!st.v) return;
      if (t.closest('[data-rlp-again]') || t.closest('[data-rlp-restart]')) { restart(st); setPlaying(st, true); ui.haptic('selection'); return; }
      if (t.closest('[data-rlp-play]')) { setPlaying(st, !st.playing || st.ended); ui.haptic('selection'); return; }
      if (t.closest('[data-rlp-speed]')) {
        st.speed = SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length];
        ui.lsSet(SPEED_KEY, st.speed); speedBtn(st); ui.haptic('selection');
      }
    });
    // the bar: drag to see where, let go to jump there (forward from here, or from the start to go back)
    const prog = el.querySelector('[data-rlp-prog]');
    prog.addEventListener('input', () => {
      if (st.dead || !st.v) return;
      st.seeking = true;
      const to = Number(prog.value) / 1000 * st.len;
      prog.style.setProperty('--rlp-p', `${(Number(prog.value) / 10).toFixed(1)}%`);
      el.querySelector('[data-rlp-time]').textContent = `${clock(to)} / ${clock(st.len)}`;
    });
    prog.addEventListener('change', () => {
      if (st.dead || !st.v || !F.mayPlay()) return;
      st.seeking = false;
      const to = Math.min(st.len, Number(prog.value) / 1000 * st.len), was = st.seekTo != null ? st.seekResume : st.playing || st.ended;
      // (played on unseen to there, from here or from the start: the same battle, step for step)
      seek(st, to, was);
    });
    const msg = text => { const m = el.querySelector('[data-rlp-msg]'); m.hidden = false; m.innerHTML = `<p>${esc(text)}</p><button type="button" class="btn btn-primary btn-block" data-rlp-close>Back to the Chronicle</button>`; el.querySelector('.rl-gl').innerHTML = ''; };
    const begin = () => {
      if (st.dead || !F.mayPlay()) return;
      // (a cold link: the realm on the board first, as a raid waits for it)
      if (!daily.LB.ready) { const off = ctx.on('daily', type => { if (type === 'lb') { off(); begin(); } }); return; }
      F.sync();
      const s = F.mine(), found = raidOf(s, id);
      if (!found) { msg('That raid isn’t in your Chronicle any more.'); return; }
      st.rec = found.rec; st.kind = found.kind;
      el.querySelector('[data-rlp-who]').innerHTML = headHTML(s, st.rec, st.kind);
      st.P = partsOf(st.rec);
      if (st.P) fresh(st);
      if (!st.P || !st.B) { msg('No replay was kept for this raid: the Chronicle keeps them for the newest ten each way.'); return; }
      const bot = botOf(st.rec, st.kind);
      st.lotHouse = st.kind === 'attack' ? houseOf(bot.k) : MY_HOUSE;
      st.raider = st.kind === 'attack' ? MY_HOUSE : houseOf(bot.k);
      st.len = lengthOf(st);
      live(st);
      start3d(st);
    };
    begin();
  },

  onHide(ctx) { const st = ST.get(ctx); if (st && st.playing) { st.playing = false; st.resume = true; if (st.v) playBtn(st); } },
  onShow(ctx) { const st = ST.get(ctx); if (st && st.resume && !st.dead && F.mayPlay()) { st.resume = false; setPlaying(st, true); } },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true; st.playing = false;
    clearTimeout(st.seekT); st.seekTo = null;
    if (st.stopProfile) st.stopProfile();
    if (st.v) st.v.dispose();
    ST.delete(ctx);
  }
};
