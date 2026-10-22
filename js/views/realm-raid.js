// An attack on one of the computer's realms (core/realm-battle.js plays it; views/realm-3d.js draws it), over The
// Keep (a cover over Daily Games), the owner's alone: the realm you're attacking fills the screen, your army along the bottom. Pick a kind
// of soldier and tap round the edge of the lot to send one (hold to keep sending); red shows where you can't. The
// clock (three minutes) starts with the first. It ends when the clock does, when everything's down, or when no one's
// left; or End. What you carry off goes into your storage (what won't fit, to your coffers), the attack into your
// Chronicle, the glory onto your house. Leaving before the first soldier goes costs nothing; leaving after ends it.
import * as ui from '../core/ui.js';
import * as daily from '../core/daily.js';
import * as data from '../core/data.js';
import * as F from '../core/realm.js';
import {makeBattle} from '../core/realm-battle.js';
import {houseOf, MY_HOUSE, dur, picOf, curHTML, starsHTML} from './realm.js';
import {heroIcon} from './realm-heroes.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const ST = new WeakMap();
let D3 = null;
const DEPLOY_ORDER = [...F.TROOP_ORDER, ...F.HERO_ORDER.map(k => 'hero_' + k)];
// The raid's speed (the owner, Oct 22 2026): the button by the clock steps it 1×, 2×, 4×; this phone remembers it.
const SPEEDS = [1, 2, 4], SPEED_KEY = 'gg-rl-speed';
const savedSpeed = () => { const v = Number(ui.lsGet(SPEED_KEY)); return SPEEDS.includes(v) ? v : 1; };
function speedBtn(st) {
  const b = st.el.querySelector('[data-rlr-speed]');
  b.textContent = `${st.speed}×`;
  b.setAttribute('aria-label', `Raid speed ${st.speed} times: tap to change`);
  b.classList.toggle('is-fast', st.speed > 1);
}

/** The realm being attacked and what it holds: {key, name, base, loot, th} or {why}. */
const targetOf = (key, now = Date.now()) => F.realmOf(key, F.mine(), now);

function shellHTML() {
  return `<div class="rl rlr" data-no-swipe>`
    + `<div class="rl-gl" aria-hidden="true"><div class="rl-loading">Scouting…</div></div>`
    + `<div class="rl-tags" aria-hidden="true"></div>`
    + `<div class="rlr-top"><button type="button" class="rlr-quit" data-rlr-quit>Leave</button>`
    + `<div class="rlr-who" data-rlr-who></div><button type="button" class="rlr-speed" data-rlr-speed></button><div class="rlr-clock" data-rlr-clock>3:00</div></div>`
    + `<div class="rlr-score" data-rlr-score></div>`
    + `<div class="rlr-troops" data-rlr-troops role="radiogroup" aria-label="Who to send"></div>`
    + `<div class="rlr-msg" data-rlr-msg hidden></div>`
    + `<div class="rlr-end" data-rlr-end hidden></div></div>`;
}
function troopsHTML(st) {
  const B = st.B;
  return DEPLOY_ORDER.filter(t => (B.left[t] || 0) + (B.used[t] || 0) > 0).map(t => {
    const k = t.startsWith('hero_') ? t.slice(5) : null, hero = k && F.HEROES[k];
    return `<button type="button" class="rlr-t${hero ? ' is-hero' : ''}${st.pick === t ? ' is-on' : ''}${B.left[t] ? '' : ' is-out'}" role="radio" aria-checked="${st.pick === t}" aria-label="${esc(hero ? `${hero.name}, level ${st.heroLevels[k]}, ${B.left[t] ? 'ready' : 'deployed'}` : `${F.TROOPS[t].name}, ${B.left[t] || 0} ready`)}" data-rlr-pick="${t}"><span class="rl-tc-ic" aria-hidden="true">${hero ? heroIcon(k) : picOf(t, MY_HOUSE, true)}</span><b>${hero ? 'Lv ' + st.heroLevels[k] : B.left[t] || 0}</b><small>${esc(hero ? hero.name : F.TROOPS[t].name)}</small></button>`;
  }).join('');
}
function score(st) {
  const B = st.B;
  const html = `${starsHTML(B.stars())}<b>${B.pct()}%</b><span class="rlr-got">${curHTML('gold', B.got.gold)}${curHTML('grain', B.got.grain)}</span>`;
  const el = st.el.querySelector('[data-rlr-score]');
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
  const left = st.t0 ? Math.max(0, F.RAID_S - st.t) : F.RAID_S, clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  const c = st.el.querySelector('[data-rlr-clock]');
  if (c.textContent !== clock) c.textContent = clock;
  c.classList.toggle('is-low', !!st.t0 && left < 30);
}
// bars over damaged buildings
function bars(st) {
  if (!st.v) return;
  const box = st.el.querySelector('.rl-tags');
  let html = '';
  st.B.bl.forEach(b => { if (!b.dead && !b.wall && b.hp < b.max) html += `<div class="rlr-hp" data-b="${b.i}"><i style="width:${(b.hp / b.max * 100).toFixed(0)}%"></i></div>`; });
  if (box.dataset.html !== html) { box.dataset.html = html; box.querySelectorAll('.rlr-hp').forEach(x => x.remove()); box.insertAdjacentHTML('afterbegin', html); }
  box.querySelectorAll('.rlr-hp').forEach(x => {
    const b = st.B.bl.find(q => q.i === +x.dataset.b);
    if (!b) return;
    const p = st.v.project(b.cx, b.cy, b.size > 2 ? 2.6 : 1.7);
    x.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  });
}
function floatText(st, x, y, text, c) {
  const p = st.v.project(x, y, 2.6), el = document.createElement('div');
  el.className = `rl-float is-${c}`; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  st.el.querySelector('.rl-tags').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function send(st, tile) {
  const B = st.B;
  if (!F.mayPlay() || st.dead || !tile || B.over || st.done) return false;
  if (!B.left[st.pick]) {
    const next = DEPLOY_ORDER.find(t => B.left[t] > 0);
    if (!next) return false;
    st.pick = next;
  }
  const u = B.deploy(st.pick, tile.x, tile.y);
  if (!u) { st.v.showZone(true); return false; }
  if (!st.t0) { st.t0 = performance.now(); st.el.querySelector('[data-rlr-quit]').textContent = 'End'; }
  ui.haptic('selection');
  st.el.querySelector('[data-rlr-troops]').innerHTML = troopsHTML(st);
  return true;
}

/** The attack's end: the take, the glory, the Chronicle, the card. */
function finish(st, quiet = false) {
  if (st.done || !F.mayPlay()) return;
  st.done = true;
  const B = st.B, r = B.result(), s = F.mine(), now = Date.now();
  if (!B.drops.length) return;
  const ta = F.gloryFor(r.stars, st.T.th);
  F.finishRaid(s, {id: `a${now.toString(36)}`, vs: st.T.key, nm: st.T.name, at: now, st: r.stars, pc: r.pct, lt: [r.got.gold, r.got.grain], ta, hr: r.heroes}, r.used, now);
  F.touch();
  F.flush();
  if (quiet) return;
  const end = st.el.querySelector('[data-rlr-end]');
  end.hidden = false;
  end.innerHTML = `<div class="rlr-card"><p class="rlr-card-k">${r.stars === 3 ? 'Sacked' : r.stars ? 'Victory' : 'Defeat'}</p>${starsHTML(r.stars, true)}`
    + `<p class="rlr-card-p">${r.pct}% of ${esc(st.T.name)} knocked down</p><div class="rlr-card-got">${curHTML('gold', r.got.gold)}${curHTML('grain', r.got.grain)}</div>`
    + (ta ? `<p class="rlr-card-tp">+${ta} glory</p>` : '')
    + `<button type="button" class="btn btn-primary btn-block" data-rlr-home>Back to your realm</button></div>`;
  ui.haptic(r.stars ? 'success' : 'warning');
}

export default {
  id: 'realm-raid',
  chrome: 'none',
  title: 'Attack',

  render() { return F.mayPlay() ? shellHTML() : '<div class="rl rl-none"></div>'; },

  mount(el, ctx) {
    if (!F.mayPlay()) return;
    const key = decodeURIComponent((ctx.params && ctx.params.key) || '');
    const st = {el, ctx, key, v: null, B: null, T: null, pick: null, t0: 0, t: 0, done: false, dead: false, hold: null, deadSig: '', coinAt: 0, speed: savedSpeed(), last: 0};
    ST.set(ctx, st);
    speedBtn(st);
    st.stopProfile = data.subscribe(type => {
      if (type === 'me' && !F.mayPlay()) {
        st.dead = true; st.done = true; stopHold(st);
        if (st.v) { st.v.dispose(); st.v = null; }
        el.replaceChildren();
      }
    });
    el.addEventListener('click', e => {
      if (st.dead || !F.mayPlay()) return;
      if (e.target.closest('[data-rlr-home]')) { ctx.back(); return; }
      if (e.target.closest('[data-rlr-speed]')) {
        st.speed = SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length];
        ui.lsSet(SPEED_KEY, st.speed); speedBtn(st); ui.haptic('selection');
        return;
      }
      if (e.target.closest('[data-rlr-quit]')) {
        if (st.t0 && !st.done) { st.B.end(); finish(st); return; }
        ctx.back();
        return;
      }
      const p = e.target.closest('[data-rlr-pick]');
      if (p) { st.pick = p.dataset.rlrPick; el.querySelector('[data-rlr-troops]').innerHTML = troopsHTML(st); ui.haptic('selection'); }
    });
    const begin = () => {
      if (st.dead || !F.mayPlay()) return;
      const msg = el.querySelector('[data-rlr-msg]');
      if (!daily.LB.ready) { msg.hidden = false; msg.textContent = 'Riding out…'; const off = ctx.on('daily', type => { if (type === 'lb') { off(); begin(); } }); return; }
      F.sync();
      const T = targetOf(key);
      if (T.why) { msg.hidden = false; msg.textContent = T.why; return; }
      const s = F.mine(), army = Object.assign({}, s.ar);
      st.heroLevels = F.heroLevels(s);
      if (!F.roomOf(army) && !Object.keys(F.heroArmy(s)).length) { msg.hidden = false; msg.textContent = 'Recruit a hero or train troops first (Army, in your realm).'; return; }
      msg.hidden = true;
      st.T = T;
      st.B = makeBattle(T.base, T.loot, army, {heroes: st.heroLevels});
      st.pick = DEPLOY_ORDER.find(t => st.B.left[t] > 0);
      el.querySelector('[data-rlr-who]').innerHTML = `<span class="rl-tg-lv">${T.th}</span><span><b>${esc(T.name)}</b><small>${T.loot.total.gold || T.loot.total.grain ? `To take ${curHTML('gold', T.loot.total.gold)} ${curHTML('grain', T.loot.total.grain)}` : 'Sacked today: nothing left to take'}</small></span>`;
      el.querySelector('[data-rlr-troops]').innerHTML = troopsHTML(st);
      score(st);
      start3d(st);
    };
    begin();
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    if (st.B && st.t0 && !st.done) { st.B.end(); finish(st, true); }
    stopHold(st);
    if (st.stopProfile) st.stopProfile();
    if (st.v) st.v.dispose();
    ST.delete(ctx);
  }
};

function stopHold(st) { if (st.hold) { clearTimeout(st.hold.wait); clearInterval(st.hold.iv); st.hold = null; } }
async function start3d(st) {
  const ok = await (D3 ? D3.load() : import('./realm-3d.js').then(m => { D3 = m; return m.load(); }));
  if (st.dead || !F.mayPlay()) return;
  const host = st.el.querySelector('.rl-gl');
  if (!ok) { host.innerHTML = '<div class="rl-loading">This phone can’t show the attack in 3D.</div>'; return; }
  host.innerHTML = '';
  const house = houseOf(st.T.key);
  st.v = D3.create(host, {house, zoom: 60, onTap: hit => { if (hit.tile) send(st, hit.tile); }, onCamera: () => bars(st)});
  st.v.setLot(st.T.base, {now: Date.now(), house});
  { const bx = F.boxOf(st.T.base); st.v.frame(bx.x0 - 3, bx.y0 - 3, bx.x1 + 3, bx.y1 + 3, 1); }
  st.el.querySelector('.rlr').__rl = st; // (for the checks' and tests' hands)
  st.v.raidStart(st.B, MY_HOUSE);
  st.el.querySelector('[data-rlr-troops]').innerHTML = troopsHTML(st);
  // hold to keep sending (where the finger is)
  const cv = st.v.canvas;
  cv.addEventListener('pointerdown', e => {
    stopHold(st);
    const at = {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false};
    st.hold = {at, iv: 0, wait: setTimeout(() => { if (st.hold && st.hold.at === at && !at.moved) st.hold.iv = setInterval(() => send(st, st.v.tileAt(at.x, at.y)), 130); }, 320)};
  });
  cv.addEventListener('pointermove', e => {
    if (!st.hold) return;
    const a = st.hold.at;
    a.x = e.clientX; a.y = e.clientY;
    if (!st.hold.iv && Math.hypot(a.x - a.x0, a.y - a.y0) > 9) a.moved = true;
  });
  cv.addEventListener('pointerup', () => stopHold(st)); cv.addEventListener('pointercancel', () => stopHold(st));
  st.v.setAnim(now => {
    if (st.dead) return false;
    const B = st.B;
    // (the battle's clock runs at the raid's speed: each frame moves it on by the time since the last, times that)
    if (st.t0 && !B.over) {
      st.t = Math.min(F.RAID_S, st.t + Math.max(0, now - (st.last || st.t0)) / 1000 * st.speed);
      B.run(st.t + .1);
    }
    st.last = now;
    st.v.raidFrame(st.t0 ? st.t : 0, now);
    // buildings down: rubble
    const sig = B.bl.filter(b => b.dead).map(b => b.i).join(',');
    if (sig !== st.deadSig) { st.deadSig = sig; st.v.setLot(st.T.base, {now: Date.now(), house, gone: new Set(B.bl.filter(b => b.dead).map(b => b.i))}); }
    for (; st.coinAt < B.fx.length; st.coinAt++) {
      const e = B.fx[st.coinAt];
      if (e.k === 'coin' && e.n >= 1) floatText(st, e.x, e.y, `+${nf(e.n)}`, e.c);
    }
    score(st);
    if (B.over && !st.done) finish(st);
    return !st.done || (now - (st.endAt || (st.endAt = now))) < 2000;
  });
}
