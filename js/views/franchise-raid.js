// A raid (core/franchise-battle.js plays it; views/franchise-3d.js draws it), over the Franchise tab: the lot you're
// raiding fills the screen, your team along the bottom. Pick a position and tap round the edge of the lot to drop one
// (hold to keep dropping); red shows where you can't. The clock (three minutes) starts with the first drop. It ends
// when the clock does, when everything's down, or when no one's left; or End raid. Its take goes into your storage
// (what won't fit, to your front office), the raid onto your franchise's record (core/franchise.js finishRaid), where
// the raided franchise's phone takes it off theirs. Leaving before the first drop costs nothing; leaving after it
// ends the raid where it stands.
import * as ui from '../core/ui.js';
import * as daily from '../core/daily.js';
import * as F from '../core/franchise.js';
import {makeBattle} from '../core/franchise-battle.js';
import {teamOf, nameOf, franchiseName, dur, picOf} from './franchise.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const curHTML = (c, n) => `<span class="fr-amt is-${c}"><i class="fr-coin" aria-hidden="true"></i>${nf(n)}</span>`;
const ST = new WeakMap();
let D3 = null;

/** Who's being raided and what they have: {key, name, base, loot, tp, th, bot} or {why} when they can't be. */
function targetOf(key, now = Date.now()) {
  if (String(key).startsWith('bot:')) {
    const bot = F.BOTS.find(b => b.k === key);
    if (!bot) return {why: 'That franchise isn’t here.'};
    const base = F.botBase(bot.th);
    return {key, name: bot.name, base, loot: F.botLoot(bot, base, F.mine(), now), tp: 0, th: bot.th, bot: true};
  }
  const me = F.myKey();
  if (!me || !F.leagueKey(me)) return {why: 'Raids on the league’s franchises are for league members.'};
  if (key === me || !F.leagueKey(key)) return {why: 'That franchise can’t be raided.'};
  const list = daily.LB.raw || [], docs = list.filter(p => daily.boardKey(p) === key), raids = F.raidsOn(list);
  const f = F.freshest(docs);
  if (!f) return {why: daily.LB.ready ? 'That franchise isn’t here.' : 'Loading the league…', wait: !daily.LB.ready};
  if (F.shieldOf(key, raids) > now) return {why: `${nameOf(key, list)} is shielded for ${dur(F.shieldOf(key, raids) - now)}.`};
  const s = F.standing(f, key, raids, now);
  if (!s) return {why: 'That franchise isn’t here.'};
  return {key, name: nameOf(key, list), base: s, loot: F.lootOf(s, now), tp: s.tp, th: F.stadiumOf(s), bot: false};
}

function shellHTML() {
  return `<div class="fr frr" data-no-swipe>`
    + `<div class="fr-gl" aria-hidden="true"><div class="fr-loading">Scouting…</div></div>`
    + `<div class="fr-tags" aria-hidden="true"></div>`
    + `<div class="frr-top"><button type="button" class="frr-quit" data-frr-quit>Leave</button>`
    + `<div class="frr-who" data-frr-who></div><div class="frr-clock" data-frr-clock>3:00</div></div>`
    + `<div class="frr-score" data-frr-score></div>`
    + `<div class="frr-troops" data-frr-troops role="radiogroup" aria-label="Who to drop"></div>`
    + `<div class="frr-msg" data-frr-msg hidden></div>`
    + `<div class="frr-end" data-frr-end hidden></div></div>`;
}
const stars = n => `<span class="fr-stars is-big" aria-label="${n} star${n === 1 ? '' : 's'}">${[0, 1, 2].map(i => `<i class="${i < n ? 'is-on' : ''}"></i>`).join('')}</span>`;

function troopsHTML(st) {
  const B = st.B;
  return F.TROOP_ORDER.filter(t => (B.left[t] || 0) + (B.used[t] || 0) > 0).map(t => `<button type="button" class="frr-t${st.pick === t ? ' is-on' : ''}${B.left[t] ? '' : ' is-out'}" role="radio" aria-checked="${st.pick === t}" data-frr-pick="${t}"><span class="fr-tc-ic is-${t}" aria-hidden="true">${picOf(t, st.mine || teamOf('me', 'You'), true)}</span><b>${B.left[t] || 0}</b><small>${esc(F.TROOPS[t].name)}</small></button>`).join('');
}
function score(st) {
  const B = st.B;
  const html = `${stars(B.stars())}<b>${B.pct()}%</b><span class="frr-got">${curHTML('cash', B.got.cash)}${curHTML('juice', B.got.juice)}</span>`;
  const el = st.el.querySelector('[data-frr-score]');
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
  const left = st.t0 ? Math.max(0, F.RAID_S - st.t) : F.RAID_S, clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  const c = st.el.querySelector('[data-frr-clock]');
  if (c.textContent !== clock) c.textContent = clock;
  c.classList.toggle('is-low', st.t0 && left < 30);
}
// bars over damaged buildings
function bars(st) {
  if (!st.v) return;
  const box = st.el.querySelector('.fr-tags');
  let html = '';
  st.B.bl.forEach(b => { if (!b.dead && !b.wall && b.hp < b.max) html += `<div class="frr-hp" data-b="${b.i}"><i style="width:${(b.hp / b.max * 100).toFixed(0)}%"></i></div>`; });
  if (box.dataset.html !== html) { box.dataset.html = html; box.querySelectorAll('.frr-hp').forEach(x => x.remove()); box.insertAdjacentHTML('afterbegin', html); }
  box.querySelectorAll('.frr-hp').forEach(x => {
    const b = st.B.bl.find(q => q.i === +x.dataset.b);
    if (!b) return;
    const p = st.v.project(b.cx, b.cy, b.size > 2 ? 2.4 : 1.6);
    x.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  });
}
function floatText(st, x, y, text, c) {
  const p = st.v.project(x, y, 2.6), el = document.createElement('div');
  el.className = `fr-float is-${c}`; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  st.el.querySelector('.fr-tags').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function drop(st, tile) {
  const B = st.B;
  if (!tile || B.over || st.done) return false;
  if (!B.left[st.pick]) {
    const next = F.TROOP_ORDER.find(t => B.left[t] > 0);
    if (!next) return false;
    st.pick = next;
  }
  const u = B.deploy(st.pick, tile.x, tile.y);
  if (!u) { st.v.showZone(true); return false; }
  if (!st.t0) { st.t0 = performance.now(); st.el.querySelector('[data-frr-quit]').textContent = 'End raid'; }
  ui.haptic('selection');
  st.el.querySelector('[data-frr-troops]').innerHTML = troopsHTML(st);
  return true;
}

/** The raid's end: the take, the trophies, the record, the card. */
function finish(st, quiet = false) {
  if (st.done) return;
  st.done = true;
  const B = st.B, r = B.result(), s = F.mine(), now = Date.now();
  if (!B.drops.length) return;
  const ls = [0, 0], lb = {};
  Object.entries(r.gotBy).forEach(([id, v]) => {
    const b = st.T.base.b.find(x => x.i === Number(id));
    if (b && F.KINDS[b.t].role === 'make') lb[id] = [v.cash, v.juice];
    else { ls[0] += v.cash; ls[1] += v.juice; }
  });
  const ta = st.T.bot ? 0 : F.trophiesFor(r.stars, s.tp, st.T.tp);
  const rec = {id: `${String(daily.LB.uid || 'here').slice(0, 6)}${now.toString(36)}`, vs: st.T.key, nm: st.T.name, at: now, st: r.stars, pc: r.pct,
    lt: [r.got.cash, r.got.juice], ls, lb, ta, td: -ta};
  F.finishRaid(s, rec, r.used, now);
  F.touch();
  F.flush();
  if (quiet) return;
  const end = st.el.querySelector('[data-frr-end]');
  end.hidden = false;
  end.innerHTML = `<div class="frr-card"><p class="frr-card-k">${r.stars ? (r.stars === 3 ? 'Shutout win' : 'Victory') : 'Defeat'}</p>${stars(r.stars)}`
    + `<p class="frr-card-p">${r.pct}% knocked down</p><div class="frr-card-got">${curHTML('cash', r.got.cash)}${curHTML('juice', r.got.juice)}</div>`
    + (st.T.bot ? '' : `<p class="frr-card-tp">${ta >= 0 ? '+' : ''}${ta} trophies</p>`)
    + `<button type="button" class="btn btn-primary btn-block" data-frr-home>Back to your franchise</button></div>`;
  ui.haptic(r.stars ? 'success' : 'warning');
}

export default {
  id: 'franchise-raid',
  chrome: 'none',
  title: 'Raid',

  render() { return shellHTML(); },

  mount(el, ctx) {
    const key = decodeURIComponent((ctx.params && ctx.params.key) || '');
    const st = {el, ctx, key, v: null, B: null, T: null, pick: null, t0: 0, t: 0, done: false, dead: false, hold: null, deadSig: '', coinAt: 0};
    ST.set(ctx, st);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-frr-home]')) { ctx.back(); return; }
      if (e.target.closest('[data-frr-quit]')) {
        if (st.t0 && !st.done) { st.B.end(); finish(st); return; }
        ctx.back();
        return;
      }
      const p = e.target.closest('[data-frr-pick]');
      if (p) { st.pick = p.dataset.frrPick; el.querySelector('[data-frr-troops]').innerHTML = troopsHTML(st); ui.haptic('selection'); }
    });
    const begin = () => {
      F.sync();
      const T = targetOf(key);
      const msg = el.querySelector('[data-frr-msg]');
      if (T.why) {
        msg.hidden = false; msg.textContent = T.why;
        if (T.wait) { const off = ctx.on('daily', type => { if (type === 'lb') { off(); begin(); } }); }
        return;
      }
      if (!daily.LB.ready) { msg.hidden = false; msg.textContent = 'Loading the league…'; const off = ctx.on('daily', type => { if (type === 'lb') { off(); begin(); } }); return; }
      msg.hidden = true;
      const s = F.mine();
      const army = Object.assign({}, s.ar);
      if (!F.roomOf(army)) { msg.hidden = false; msg.textContent = 'You need a team first (Team, on your franchise).'; return; }
      st.T = T;
      st.B = makeBattle(T.base, T.loot, army);
      st.pick = F.TROOP_ORDER.find(t => army[t] > 0);
      el.querySelector('[data-frr-who]').innerHTML = `<span class="fr-tg-lv">${T.th}</span><span><b>${esc(T.bot ? T.name : franchiseName(T.name))}</b><small>Up for grabs ${curHTML('cash', T.loot.total.cash)} ${curHTML('juice', T.loot.total.juice)}</small></span>`;
      el.querySelector('[data-frr-troops]').innerHTML = troopsHTML(st);
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
    stopHoldOf(st);
    if (st.v) st.v.dispose();
    ST.delete(ctx);
  }
};

function stopHoldOf(st) { if (st.hold) { clearTimeout(st.hold.wait); clearInterval(st.hold.iv); st.hold = null; } }
async function start3d(st) {
  const stopHold = () => stopHoldOf(st);
  const ok = await (D3 ? D3.load() : import('./franchise-3d.js').then(m => { D3 = m; return m.load(); }));
  if (st.dead) return;
  const host = st.el.querySelector('.fr-gl');
  if (!ok) { host.innerHTML = '<div class="fr-loading">This phone can’t show the raid in 3D.</div>'; return; }
  host.innerHTML = '';
  const team = teamOf(st.T.key, st.T.name), mine = teamOf(F.myKey() || 'me', 'You');
  st.mine = mine;
  st.v = D3.create(host, {
    team, zoom: 50,
    onTap: hit => { if (hit.tile) drop(st, hit.tile); },
    onCamera: () => bars(st)
  });
  st.v.setLot(st.T.base, {now: Date.now(), team});
  { const bx = F.boxOf(st.T.base); st.v.frame(bx.x0 - 3, bx.y0 - 3, bx.x1 + 3, bx.y1 + 3, 1); }
  st.el.querySelector('.frr').__fr = st; // (for the checks' and tests' hands)
  st.v.raidStart(st.B, mine);
  st.el.querySelector('[data-frr-troops]').innerHTML = troopsHTML(st);
  // hold to keep dropping (where the finger is)
  const cv = st.v.canvas;
  cv.addEventListener('pointerdown', e => {
    stopHold();
    const at = {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false};
    st.hold = {at, iv: 0, wait: setTimeout(() => { if (st.hold && st.hold.at === at && !at.moved) st.hold.iv = setInterval(() => drop(st, st.v.tileAt(at.x, at.y)), 130); }, 320)};
  });
  cv.addEventListener('pointermove', e => {
    if (!st.hold) return;
    const a = st.hold.at;
    a.x = e.clientX; a.y = e.clientY;
    if (!st.hold.iv && Math.hypot(a.x - a.x0, a.y - a.y0) > 9) a.moved = true;
  });
  cv.addEventListener('pointerup', stopHold); cv.addEventListener('pointercancel', stopHold);
  st.v.setAnim(now => {
    if (st.dead) return false;
    const B = st.B;
    if (st.t0 && !B.over) {
      st.t = Math.min(F.RAID_S, (now - st.t0) / 1000);
      B.run(st.t + .1);
    }
    st.v.raidFrame(st.t0 ? st.t : 0, now);
    // buildings down: rubble
    const sig = B.bl.filter(b => b.dead).map(b => b.i).join(',');
    if (sig !== st.deadSig) { st.deadSig = sig; st.v.setLot(st.T.base, {now: Date.now(), team, gone: new Set(B.bl.filter(b => b.dead).map(b => b.i))}); }
    for (; st.coinAt < B.fx.length; st.coinAt++) {
      const e = B.fx[st.coinAt];
      if (e.k === 'coin' && e.n >= 1) floatText(st, e.x, e.y, `+${nf(e.n)}`, e.c);
    }
    score(st);
    if (B.over && !st.done) finish(st);
    return !st.done || (now - (st.endAt || (st.endAt = now))) < 2000;
  });
}
