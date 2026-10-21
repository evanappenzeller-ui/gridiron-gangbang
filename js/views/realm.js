// The Realm tab (core/realm.js: the game; views/realm-3d.js: the lot in 3D; views/realm-raid.js: a raid;
// views/realm-scout.js: a look round a realm before you raid it). The owner's
// alone (data.isOwner(): app.js shows the tab on his phones only, and this screen shows nothing on anyone else's). Your
// lot fills the screen: a thin strip along the top with your glory, Gold and Grain (as Clash Royale keeps its coins and
// gems, Oct 2026), under it at the right your house's crest and name (tap it to rename your house) and what's waiting
// in your coffers, at the left your builder (one job at a time); along the bottom Attack, Army, Build and
// the Chronicle. Tap a building for what it is and to upgrade, move or collect it (a mine or farm with something in
// it collects at a tap); Build puts what you pick on the lot to drag where it goes. When you come back after the
// computer's realms have raided you, what they did is the first thing you see.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as F from '../core/realm.js';
import {defend} from '../core/realm-battle.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const ST = new WeakMap();
let D3 = null; // views/realm-3d.js, once loaded
const MODS = {}; // the game cores, for what the games have paid
let modsAsked = null;
function loadMods() {
  if (!modsAsked) {
    modsAsked = Promise.all([
      import('../core/seventeen.js').then(m => Promise.resolve(m.load && m.load()).then(() => { MODS.sv = m; }), () => {}),
      import('../core/drill.js').then(m => Promise.resolve(m.load && m.load()).then(() => { MODS.dr = m; }), () => {}),
      import('../core/kick.js').then(m => { MODS.kk = m; }, () => {}),
      import('../core/return.js').then(m => { MODS.rm = m; }, () => {})
    ]);
  }
  return modsAsked;
}

// ---- houses: yours (crimson and gold, a crown) and the computer's (each its own colours and sigil)
export const MY_HOUSE = {pri: 0x7A1F2B, sec: 0xD9AD3C, sigil: 'crown'};
const BOT_HOUSES = [[0x2E4A2B, 0xD8CFB8, 'tower'], [0x23395B, 0xC9CED6, 'star'], [0x4A3B2A, 0xD9AD3C, 'key'], [0x3B2B4F, 0xC9CED6, 'moon'],
  [0x5A2A1E, 0xE0C26A, 'sun'], [0x1F3D3A, 0xD8CFB8, 'axe'], [0x2B2B2E, 0xB8B0A0, 'sword'], [0x111114, 0xA9273A, 'star']];
export const houseOf = key => {
  const b = F.BOTS.findIndex(x => x.k === key);
  if (b < 0) return MY_HOUSE;
  const [pri, sec, sigil] = BOT_HOUSES[b];
  return {pri, sec, sigil};
};
// Surnames the league's list doesn't carry (it has first names only): the owner's, for his house (Oct 2026).
const SURNAME = {evan: 'Appenzeller'};
/** Your house's name: the one you gave it, else House and your last name (House Appenzeller). (The old default, House
 *  and your first name, kept by saving it unchanged, counts as none.) */
export function houseName(s = F.mine()) {
  const m = data.me() || data.OWNER, n = String((data.name ? data.name(m) : '') || '').trim().split(/\s+/);
  if (s.nm && s.nm !== `House ${n[0]}`) return s.nm;
  return `House ${SURNAME[m] || n[n.length - 1] || SURNAME[data.OWNER]}`;
}
/** A picture of a building or a soldier (thumb() in realm-3d.js), as an <img>, or '' before the 3D is in. */
export function picOf(k, house, troop = false) {
  const url = D3 && D3.ready() ? D3.thumb(k, troop ? 1 : 2, house, troop) : '';
  return url ? `<img src="${url}" alt="" draggable="false">` : '';
}

// ---- time
export function dur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 && m < 10 ? ` ${s % 60}s` : ''}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ''}`;
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
export const curHTML = (c, n) => `<span class="rl-amt is-${c}"><i class="rl-coin" aria-hidden="true"></i>${nf(n)}</span>`;
export const starsHTML = (n, big = false) => `<span class="rl-stars${big ? ' is-big' : ''}" aria-label="${n} star${n === 1 ? '' : 's'}">${[0, 1, 2].map(i => `<i class="${i < n ? 'is-on' : ''}"></i>`).join('')}</span>`;

// ---------------------------------------------------------------------------------------------------- what the games paid
let EARNED = {total: 0, by: {}, today: {}, days: 0};
function earned() {
  try { EARNED = F.incomeOf(F.myDocs(), MODS); } catch (e) { console.error(e); }
  return EARNED.total;
}

// ---------------------------------------------------------------------------------------------------- the screen
function shellHTML() {
  return `<div class="rl" data-no-swipe>`
    + `<div class="rl-gl" aria-hidden="true"><div class="rl-loading">Riding out to your realm…</div></div>`
    + `<div class="rl-tags" aria-hidden="true"></div>`
    + `<div class="rl-top">`
    + `<div class="rl-left">`
    + `<button type="button" class="rl-me" data-rl-house aria-label="Your house"><span class="rl-crest" data-rl-lv>1</span><span class="rl-me-t"><b data-rl-name></b><small data-rl-land></small></span></button>`
    + `<div class="rl-glory" aria-label="Glory"><i class="rl-crown" aria-hidden="true"></i><b data-rl-tp>0</b></div>`
    + `<div class="rl-builders" data-rl-builders></div>`
    + `</div>`
    + `<div class="rl-res">`
    + F.CUR.map(c => `<div class="rl-cur is-${c}" data-rl-cur="${c}"><span class="rl-curb"><i data-rl-f></i></span><b data-rl-n>0</b><i class="rl-coin" aria-hidden="true"></i></div>`).join('')
    + `<button type="button" class="rl-office" data-rl-coffers></button>`
    + `</div></div>`
    + `<div class="rl-sel" data-rl-sel hidden></div>`
    + `<div class="rl-bar" data-rl-bar>`
    + `<button type="button" class="rl-btn is-raid" data-rl-raid><span class="rl-bi" aria-hidden="true">${ui.icon('versus')}</span><span>Attack</span></button>`
    + `<button type="button" class="rl-btn" data-rl-army><span class="rl-bi" aria-hidden="true">${ui.icon('shield')}</span><span>Army</span><em data-rl-armyn></em></button>`
    + `<button type="button" class="rl-btn" data-rl-shop><span class="rl-bi" aria-hidden="true">${ui.icon('plus')}</span><span>Build</span></button>`
    + `<button type="button" class="rl-btn" data-rl-log><span class="rl-bi" aria-hidden="true">${ui.icon('list')}</span><span>Chronicle</span></button>`
    + `</div></div>`;
}

function hud(st) {
  const s = F.mine(), now = Date.now(), cap = F.capOf(s), el = st.el;
  el.querySelector('[data-rl-lv]').textContent = F.keepOf(s);
  el.querySelector('[data-rl-name]').textContent = houseName(s);
  el.querySelector('[data-rl-land]').textContent = (F.SCENERIES.find(x => x.k === F.sceneryOf(s)) || F.SCENERIES[0]).name;
  el.querySelector('[data-rl-tp]').textContent = nf(s.tp);
  F.CUR.forEach(c => {
    const box = el.querySelector(`[data-rl-cur="${c}"]`);
    box.querySelector('[data-rl-n]').textContent = nf(s.r[c]);
    box.querySelector('[data-rl-f]').style.width = `${Math.min(100, s.r[c] / Math.max(1, cap[c]) * 100).toFixed(1)}%`;
    box.setAttribute('aria-label', `${c === 'gold' ? 'Gold' : 'Grain'}: ${nf(s.r[c])} of ${nf(cap[c])}`);
    box.title = `${nf(s.r[c])} of ${nf(cap[c])}`;
    box.classList.toggle('is-full', s.r[c] >= cap[c]);
  });
  const p = F.pending(s, EARNED.total), off = el.querySelector('[data-rl-coffers]');
  off.innerHTML = p.gold > 0 || p.grain > 0 ? `<span class="rl-oft">Coffers</span>${curHTML('gold', p.gold)}${curHTML('grain', p.grain)}<span class="rl-ofn">waiting for room</span>`
    : `<span class="rl-oft">Coffers</span><span class="rl-ofn">Your games pay into them</span>`;
  const co = F.builders(s, now), next = Math.min(...s.b.filter(b => b.u > now).map(b => b.u));
  el.querySelector('[data-rl-builders]').innerHTML = `<span class="rl-hammer" aria-hidden="true"></span>Builder <b>${co.free ? 'free' : `busy · ${dur(next - now)}`}</b>${s.sh > now ? ` <span class="rl-truce">· truce ${dur(s.sh - now)}</span>` : ''}`;
  const army = F.roomOf(s.ar), room = F.armyRoom(s);
  el.querySelector('[data-rl-armyn]').textContent = room ? `${army}/${room}` : '';
}

// The overlays over the lot: what's piled up in a mine or farm (tap to collect), a job's clock.
function tags(st) {
  if (!st.v) return;
  const s = F.mine(), now = Date.now(), box = st.el.querySelector('.rl-tags');
  let html = '';
  s.b.forEach(b => {
    const K = F.KINDS[b.t];
    if (b.u > now) {
      const total = (b.l < 1 ? K.time[0] : K.time[b.l]) * 1000 || 1, f = 1 - (b.u - now) / total;
      html += `<div class="rl-tag is-job" data-rl-tag="${b.i}" data-h="${K.size > 2 ? 2.4 : 1.7}"><span>${dur(b.u - now)}</span><i style="width:${Math.max(4, Math.min(100, f * 100)).toFixed(1)}%"></i></div>`;
    } else if (K.role === 'make') {
      const m = F.made(b, now), hold = F.stat(b.t, b.l).hold;
      if (m >= Math.max(1, hold * .08)) html += `<button type="button" class="rl-tag is-made is-${K.makes}${m >= hold ? ' is-full' : ''}" data-rl-tag="${b.i}" data-rl-collect="${b.i}" data-h="2.2" aria-label="Collect ${nf(m)} ${F.CUR_NAME[K.makes]}"><i class="rl-coin"></i></button>`;
    }
  });
  if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  placeTags(st);
}
function placeTags(st) {
  if (!st.v) return;
  const s = F.mine();
  st.el.querySelectorAll('[data-rl-tag]').forEach(t => {
    const b = s.b.find(x => x.i === +t.dataset.rlTag);
    if (!b) return;
    const sz = F.KINDS[b.t].size, p = st.v.project(b.x + sz / 2, b.y + sz / 2, +t.dataset.h || 2);
    t.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  });
}

// ---- the selected building's card
/** What building b is and does at its level (its card's line, yours or one you're scouting): [text]. */
export function factsOf(b) {
  const K = F.KINDS[b.t], lv = Math.max(1, b.l), sv = F.stat(b.t, lv), what = [];
  if (K.role === 'make') what.push(`Makes ${nf(sv.rate)} ${F.CUR_NAME[K.makes]} an hour · holds ${nf(sv.hold)}`);
  if (K.role === 'store') what.push(`Holds ${nf(sv.cap)} ${F.CUR_NAME[K.holds]}`);
  if (K.role === 'hall') what.push(`Holds ${nf(sv.store)} of each`);
  if (K.role === 'camp') what.push(`Room for ${sv.room}`);
  if (K.role === 'hatch') what.push(`Room for ${sv.dragons} dragon${sv.dragons === 1 ? '' : 's'}`);
  if (K.role === 'def') what.push(`${nf(sv.dps)} damage a second · reach ${sv.range}${sv.splash ? ' · hits a crowd' : ''}${sv.air ? ' · hits dragons' : ''}`);
  if (K.role === 'train') what.push(`Trains: ${F.TROOP_ORDER.filter(t => F.TROOPS[t].at <= lv).map(t => F.TROOPS[t].name).join(', ')}`);
  what.push(`${nf(sv.hp)} strength`);
  return what;
}
function selHTML(st) {
  const s = F.mine(), b = s.b.find(x => x.i === st.sel), now = Date.now();
  if (!b) return '';
  const K = F.KINDS[b.t], lv = Math.max(1, b.l), what = factsOf(b);
  const opens = b.t === 'keep' ? F.SCENERIES.find(x => x.at === lv + 1) : null;
  if (opens) what.splice(1, 0, `Level ${lv + 1} unlocks the ${opens.name}`);
  const job = b.u > now ? `<p class="rl-sel-job">${b.l < 1 ? 'Going up' : `Upgrading to level ${b.l + 1}`} · ${dur(b.u - now)} left</p>` : '';
  const up = F.canUpgrade(s, b.i, now), btns = [];
  if (K.role === 'make' && F.made(b, now) > 0) btns.push(`<button type="button" class="rl-act" data-rl-collect="${b.i}">Collect ${curHTML(K.makes, F.made(b, now))}</button>`);
  if (b.t === 'barracks' || b.t === 'camp' || b.t === 'hatchery') btns.push(`<button type="button" class="rl-act" data-rl-army>Train</button>`);
  if (b.t !== 'hut' && b.u <= now && up.to <= F.maxLevel(b.t)) {
    btns.push(up.ok ? `<button type="button" class="rl-act is-go" data-rl-up="${b.i}">Upgrade ${curHTML(up.pay, up.cost)}<small>${up.time ? dur(up.time * 1000) : 'at once'}</small></button>`
      : `<button type="button" class="rl-act" disabled>Upgrade<small>${esc(up.why)}${/Not enough/.test(up.why) ? ` (${nf(up.cost)})` : ''}</small></button>`);
  }
  btns.push(`<button type="button" class="rl-act" data-rl-move="${b.i}">Move</button>`);
  return `<div class="rl-sel-h"><div><b>${esc(K.name)}</b><span class="rl-sel-lv">${b.l < 1 ? 'Going up' : `Level ${b.l}`}</span></div>${ui.iconButton({icon: 'close', label: 'Done', cls: 'rl-sel-x', attrs: 'data-rl-unsel'})}</div>`
    + `<p class="rl-sel-what">${what.map(esc).join(' · ')}</p>${job}`
    + `<p class="rl-sel-blurb">${esc(K.blurb)}</p>`
    + `<div class="rl-acts">${btns.join('')}</div>`;
}
function showSel(st) {
  const box = st.el.querySelector('[data-rl-sel]'), bar = st.el.querySelector('[data-rl-bar]');
  if (st.place) {
    const K = F.KINDS[st.place.t], chk = F.canBuild(F.mine(), st.place.t);
    box.hidden = false; bar.hidden = true;
    box.innerHTML = `<div class="rl-sel-h"><div><b>${esc(K.name)}</b><span class="rl-sel-lv">Drag it where it goes</span></div></div>`
      + `<div class="rl-acts"><button type="button" class="rl-act" data-rl-cancel>Cancel</button>`
      + `<button type="button" class="rl-act is-go" data-rl-place ${st.place.ok && chk.ok ? '' : 'disabled'}>Build ${curHTML(chk.pay, chk.cost)}<small>${chk.ok ? (chk.time && st.place.t !== 'hut' ? dur(chk.time * 1000) : 'at once') : esc(chk.why)}</small></button></div>`;
    return;
  }
  if (st.sel == null) { box.hidden = true; bar.hidden = false; box.innerHTML = ''; box.dataset.html = ''; return; }
  box.hidden = false; bar.hidden = true;
  const html = selHTML(st);
  if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
}
function select(st, id) {
  st.sel = id; st.moving = null;
  if (st.v) st.v.select(id);
  showSel(st);
}

// ---- keeping it all current
function refresh(st) {
  if (st.dead) return;
  const s = F.mine(), now = Date.now();
  const got = F.claim(s, EARNED.total);
  if (got.gold || got.grain) F.touch();
  if (st.v) st.v.setLot(s, {now, house: MY_HOUSE});
  hud(st);
  tags(st);
  if (st.sel != null && !st.place) showSel(st);
}
// The board's copy of your realm taken up (the first time it shows, or newer from your other phone), and the raids on
// it since you last looked played (while the Realm is on screen).
function synced(st) {
  const took = F.sync();
  refresh(st);
  if (took && st.ctx.visible) defenses(st);
}
// The computer's raids on your realm since you last looked: played, taken off it, and told.
function defenses(st) {
  const s = F.mine(), done = defend(s);
  if (!done.length) return;
  F.touch();
  refresh(st);
  const lost = done.filter(r => r.st > 0);
  ui.openSheet({title: 'While you were away', cls: 'sh-rl', detents: ['large'], body:
    done.map(r => `<div class="rl-log"><span>${starsHTML(r.st)}</span><span class="rl-log-t"><span><b>${esc(r.by)}</b> ${r.st ? `broke through and took ${curHTML('gold', r.lt[0])} ${curHTML('grain', r.lt[1])}` : 'were driven off'}</span><small>${ago(r.at)} · ${r.pc}% of your realm knocked down · ${r.td > 0 ? '+' : ''}${r.td} glory</small></span></div>`).join('')
    + `<p class="rl-sh-note">${lost.length ? `A truce holds for ${F.mine().sh > Date.now() ? dur(F.mine().sh - Date.now()) : 'a while'}: no one raids you while it lasts. Stronger walls and towers, and your treasuries and granaries kept behind them, keep more of your gold and grain.` : 'Your defenses held.'} Your coffers are never touched.</p>`});
}

// ---------------------------------------------------------------------------------------------------- sheets
function cofferSheet() {
  const s = F.mine(), p = F.pending(s, EARNED.total);
  const rows = Object.keys(F.GAME_NAME).map(g => `<div class="rl-row"><span>${esc(F.GAME_NAME[g])}</span><span class="rl-row-v">${EARNED.today[g] ? `<em>+${nf(EARNED.today[g])} today</em>` : ''}${nf(EARNED.by[g] || 0)}</span></div>`).join('');
  ui.openSheet({title: 'The coffers', cls: 'sh-rl', detents: ['large'], body:
    `<p class="rl-sh-lead">Every daily game you play pays your realm, in Gold and Grain alike. It waits in your coffers, safe from raiders, and moves into your Keep, treasuries and granaries as they have room.</p>`
    + `<div class="rl-sh-big">${curHTML('gold', p.gold)}${curHTML('grain', p.grain)}<small>waiting now</small></div>`
    + `<h3 class="rl-sh-h">This season, of each</h3><div class="rl-rows">${rows}<div class="rl-row is-sum"><span>All told</span><span class="rl-row-v">${nf(EARNED.total)}</span></div></div>`
    + `<p class="rl-sh-note">A day’s pay: Daily Puzzles 400 plus 5 a point · 17–0 400 plus 150 a win (500 more for 17–0) · Two-Minute Drill 3,000 a win, 2,000 a tie, 1,000 a loss · Kick It 400 plus 200 a make (up to 15) · Return Man 400 plus 3 a yard (up to 1,000). More room: upgrade your treasuries, granaries and Keep.</p>`});
}
function armySheet(st) {
  const sh = ui.openSheet({title: 'Your army', cls: 'sh-rl', detents: ['large'], body: '<div data-rl-armybody></div>'});
  const draw = () => {
    const s = F.mine(), now = Date.now(), room = F.armyRoom(s), have = F.roomOf(s.ar), q = F.queued(s);
    const army = F.TROOP_ORDER.filter(t => s.ar[t]).map(t => `<span class="rl-chip">${esc(F.TROOPS[t].name)} ×${s.ar[t]}</span>`).join('') || '<span class="rl-sh-note">No one yet.</span>';
    const line = s.q.map(([t, n], i) => `<span class="rl-chip is-q">${esc(F.TROOPS[t].name)} ×${n}${i === 0 && s.qs ? ` <small>${dur(s.qs + F.trainTime(s, t) * 1000 - now)}</small>` : ''}<button type="button" class="rl-chip-x" data-rl-untrain="${t}" aria-label="Take one ${esc(F.TROOPS[t].name)} out">−</button></span>`).join('');
    const cards = F.TROOP_ORDER.map(t => {
      const T = F.TROOPS[t], chk = F.canTrain(s, t), locked = F.barracksLevel(s) < T.at, egg = t === 'dragon' && !locked && !F.hatchRoom(s);
      return `<button type="button" class="rl-tc${locked ? ' is-locked' : ''}" data-rl-train="${t}" ${chk.ok ? '' : 'aria-disabled="true"'}>`
        + `<span class="rl-tc-ic" aria-hidden="true">${picOf(t, MY_HOUSE, true)}</span><b>${esc(T.name)}</b>`
        + `<span class="rl-tc-c">${locked ? `Barracks level ${T.at}` : egg ? 'Needs a dragon hatchery' : `${curHTML('grain', T.cost)} · ${T.room} room`}</span>`
        + `<small>${esc(T.blurb)}</small></button>`;
    }).join('');
    sh.body.querySelector('[data-rl-armybody]').innerHTML = `<div class="rl-room"><b>${have + q}/${room}</b> room in the war camps${q ? ` (${q} in training)` : ''}</div>`
      + `<h3 class="rl-sh-h">Ready to march</h3><div class="rl-chips">${army}</div>`
      + (line ? `<h3 class="rl-sh-h">Training${s.q.length ? ` · done in ${dur(F.trainedBy(s, now) - now)}` : ''}</h3><div class="rl-chips">${line}</div>` : '')
      + `<h3 class="rl-sh-h">Train <span>(tap to add one · Grain ${nf(s.r.grain)})</span></h3><div class="rl-tcs">${cards}</div>`;
  };
  draw();
  sh.body.addEventListener('click', e => {
    const tr = e.target.closest('[data-rl-train]'), un = e.target.closest('[data-rl-untrain]'), s = F.mine();
    if (tr) {
      const t = tr.dataset.rlTrain, chk = F.canTrain(s, t);
      if (!chk.ok) { ui.toast(chk.why, {icon: 'info'}); return; }
      F.train(s, t, 1); F.touch(); ui.haptic('selection'); draw(); hud(st);
    } else if (un) { F.untrain(s, un.dataset.rlUntrain); F.touch(); draw(); hud(st); }
  });
  const iv = setInterval(() => { if (!sh.el.isConnected) { clearInterval(iv); return; } F.mine(); draw(); }, 1000);
}
/** The computer's realms you can attack, with what each holds today. */
export function targets(now = Date.now(), mine = F.mine()) {
  return F.BOTS.map(b => ({k: b.k, name: b.name, th: b.th, loot: F.botLoot(b, F.botBase(b.th), mine, now).total}));
}
function raidSheet(st, ctx) {
  const s = F.mine(), army = F.roomOf(s.ar);
  const sh = ui.openSheet({title: 'Attack', cls: 'sh-rl', detents: ['large'], body:
    (army ? `<p class="rl-sh-lead">Your army: ${F.TROOP_ORDER.filter(t => s.ar[t]).map(t => `${esc(F.TROOPS[t].name)} ×${s.ar[t]}`).join(', ')}. Send them round the edge of a realm; they carry off what its treasuries, granaries, mines and farms hold. Each realm’s stores fill again every morning.</p>`
      : `<p class="rl-sh-lead">You need an army first: raise barracks and a war camp, then train one (Army).</p>`)
    + targets(Date.now(), s).map(x => `<div class="rl-tg"><span class="rl-tg-lv">${x.th}</span><span class="rl-tg-n"><b>${esc(x.name)}</b>`
      + `<small>${x.loot.gold || x.loot.grain ? `${curHTML('gold', x.loot.gold)} ${curHTML('grain', x.loot.grain)}` : 'Raided today: nothing left to take'}</small></span>`
      + `<button type="button" class="rl-act rl-tg-go" data-rl-scout="${esc(x.k)}">Scout</button>`
      + `<button type="button" class="rl-act is-go rl-tg-go" data-rl-go="${esc(x.k)}" ${army ? '' : 'disabled'}>Attack</button></div>`).join('')
    + `<p class="rl-sh-note">Scout a realm to look round it first: where its towers reach, where its walls run, where its gold and grain are kept.</p>`});
  sh.body.addEventListener('click', e => {
    const sc = e.target.closest('[data-rl-scout]');
    if (sc) { sh.close(); ctx.nav('/realm/scout/' + encodeURIComponent(sc.dataset.rlScout)); return; }
    const go = e.target.closest('[data-rl-go]');
    if (!go || go.disabled) return;
    sh.close();
    ctx.nav('/realm/raid/' + encodeURIComponent(go.dataset.rlGo));
  });
}
function logSheet() {
  const s = F.mine(), now = Date.now();
  const off = s.rd.slice().sort((a, b) => b.at - a.at).slice(0, 20), def = s.df.slice().sort((a, b) => b.at - a.at);
  const won = s.rd.filter(r => r.st > 0).length, held = s.df.filter(r => !r.st).length;
  ui.openSheet({title: 'The Chronicle', cls: 'sh-rl', detents: ['large'], body:
    `<div class="rl-sh-big"><span class="rl-amt"><i class="rl-crown"></i>${nf(s.tp)}</span><small>glory · ${won} realm${won === 1 ? '' : 's'} sacked · ${held} raid${held === 1 ? '' : 's'} driven off${s.sh > now ? ` · truce for ${dur(s.sh - now)}` : ''}</small></div>`
    + `<h3 class="rl-sh-h">Raids on your realm</h3>${def.length ? def.map(r => `<div class="rl-log"><span>${starsHTML(r.st || 0)}</span><span class="rl-log-t"><span><b>${esc(r.by)}</b> ${r.st ? `took ${curHTML('gold', (r.lt || [])[0])} ${curHTML('grain', (r.lt || [])[1])}` : 'were driven off'}</span><small>${ago(r.at)} · ${r.pc || 0}% · ${r.td > 0 ? '+' : ''}${r.td || 0} glory</small></span></div>`).join('') : `<p class="rl-sh-note">${F.keepOf(s) < 2 ? 'No one bothers with a realm this small yet. Once your Keep is level 2, the computer’s realms will start raiding you, now and then.' : 'No one has raided you yet.'}</p>`}`
    + `<h3 class="rl-sh-h">Your attacks</h3>${off.length ? off.map(r => `<div class="rl-log"><span>${starsHTML(r.st || 0)}</span><span class="rl-log-t"><span><b>${esc(r.nm)}</b> · you took ${curHTML('gold', (r.lt || [])[0])} ${curHTML('grain', (r.lt || [])[1])}</span><small>${ago(r.at)} · ${r.pc || 0}% · +${r.ta || 0} glory</small></span></div>`).join('') : '<p class="rl-sh-note">You haven’t attacked anyone yet.</p>'}`});
}
function shopSheet(st) {
  const s = F.mine(), th = F.keepOf(s);
  const groups = [['Treasure', ['mine', 'farm', 'treasury', 'granary']], ['Army', ['barracks', 'camp', 'hatchery']], ['Defense', ['cannon', 'ballista', 'tower', 'trebuchet', 'cauldron', 'wall']]];
  const card = k => {
    const K = F.KINDS[k], chk = F.canBuild(s, k), n = F.countOf(s, k), cap = F.allowed(s, k);
    return `<button type="button" class="rl-shop-c${chk.ok ? '' : ' is-no'}" data-rl-buy="${k}"><span class="rl-shop-ic" aria-hidden="true">${picOf(k, MY_HOUSE)}</span><b>${esc(K.name)}</b>`
      + `<span class="rl-shop-cost">${curHTML(chk.pay, chk.cost)}</span><small>${n}/${cap}${chk.ok ? (chk.time && k !== 'hut' ? ` · ${dur(chk.time * 1000)}` : ' · at once') : ` · ${esc(chk.why)}`}</small></button>`;
  };
  const sh = ui.openSheet({title: 'Build', cls: 'sh-rl', detents: ['large'], body:
    `<p class="rl-sh-lead">Keep level ${th}: raise it for more of everything.</p>`
    + groups.map(([h, ks]) => `<h3 class="rl-sh-h">${h}</h3><div class="rl-shop">${ks.map(card).join('')}</div>`).join('')});
  sh.body.addEventListener('click', e => {
    const c = e.target.closest('[data-rl-buy]');
    if (!c) return;
    const k = c.dataset.rlBuy, chk = F.canBuild(F.mine(), k);
    if (!chk.ok) { ui.toast(chk.why, {icon: 'info'}); return; }
    sh.close();
    startPlace(st, k);
  });
}
// Where your realm lies: the sceneries, each open once the Keep's high enough (core/realm.js SCENERIES), the one it's in
// marked; tap an open one to move there.
const sceneriesHTML = s => F.SCENERIES.map(x => {
  const open = F.sceneryOpen(s, x.k), on = F.sceneryOf(s) === x.k;
  return `<button type="button" class="rl-scn is-${x.k}${on ? ' is-on' : ''}" data-rl-scn="${x.k}" aria-pressed="${on}"${open ? '' : ' aria-disabled="true"'}>`
    + `<i class="rl-scn-sw" aria-hidden="true"></i><span><b>${esc(x.name)}</b><small>${open ? (on ? 'Your realm lies here' : esc(x.blurb)) : `Keep level ${x.at} to unlock`}</small></span></button>`;
}).join('');
function houseSheet(st) {
  const s = F.mine();
  const sh = ui.openSheet({title: 'Your house', cls: 'sh-rl', detents: ['fit', 'large'], body:
    `<form class="rl-name" data-rl-nameform><label class="rl-sh-h" for="rl-name-in">Its name</label>`
    + `<input id="rl-name-in" class="rl-in" maxlength="28" autocomplete="off" value="${esc(houseName(s))}">`
    + `<p class="rl-sh-note">Keep level ${F.keepOf(s)} · ${nf(s.tp)} glory.</p>`
    + `<button type="submit" class="btn btn-primary btn-block">Save</button></form>`
    + `<h3 class="rl-sh-h">Your lands <span>raise your Keep to unlock more</span></h3><div class="rl-scns" data-rl-scns>${sceneriesHTML(s)}</div>`});
  sh.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const v = sh.body.querySelector('input').value.replace(/\s+/g, ' ').trim().slice(0, 28);
    s.nm = v; F.touch(); hud(st); sh.close();
  });
  sh.body.querySelector('[data-rl-scns]').addEventListener('click', e => {
    const b = e.target.closest('[data-rl-scn]');
    if (!b) return;
    const k = b.dataset.rlScn, x = F.SCENERIES.find(q => q.k === k);
    if (!F.sceneryOpen(s, k)) { ui.toast(`${x.name} opens at Keep level ${x.at}`, {icon: 'info'}); return; }
    if (F.sceneryOf(s) === k) return;
    F.pickScenery(s, k); F.touch(); ui.haptic('light');
    if (st.v) st.v.setTheme(k);
    sh.body.querySelector('[data-rl-scns]').innerHTML = sceneriesHTML(s);
  });
}

// ---- placing something new: where there's room near the middle; drag it; Build
function startPlace(st, k, near = null) {
  const s = F.mine(), spot = F.spotFor(s, k, near);
  if (!spot) { ui.toast('No room on the lot', {icon: 'info'}); return; }
  st.sel = null;
  st.place = {t: k, x: spot.x, y: spot.y, ok: true};
  if (st.v) { st.v.select(null); st.v.setGhost(st.place); st.v.showGrid(true); }
  showSel(st);
}
function endPlace(st) {
  st.place = null; st.lastWall = null;
  if (st.v) { st.v.setGhost(null); st.v.showGrid(false); }
  showSel(st);
}
function commitPlace(st) {
  const s = F.mine(), p = st.place;
  if (!p) return;
  const b = F.build(s, p.t, p.x, p.y);
  if (!b) { ui.toast(F.canBuild(s, p.t).why || 'It doesn’t fit there', {icon: 'info'}); return; }
  F.touch();
  ui.haptic('light');
  // walls: the next goes on beside it, the same way along
  if (p.t === 'wall' && F.canBuild(s, 'wall').ok) {
    const d = st.lastWall ? [p.x - st.lastWall.x, p.y - st.lastWall.y] : null;
    const dir = d && Math.abs(d[0]) + Math.abs(d[1]) === 1 ? d : [1, 0];
    st.lastWall = {x: p.x, y: p.y};
    const nx = p.x + dir[0], ny = p.y + dir[1];
    const next = F.fits(s, 1, nx, ny) ? {x: nx, y: ny} : F.spotFor(s, 'wall', {x: p.x, y: p.y});
    if (next) {
      st.place = {t: 'wall', x: next.x, y: next.y, ok: true};
      st.v.setLot(s, {now: Date.now(), house: MY_HOUSE}); st.v.setGhost(st.place); refresh(st); showSel(st);
      return;
    }
  }
  endPlace(st);
  refresh(st);
}

// ---------------------------------------------------------------------------------------------------- the 3D
async function start3d(st) {
  const theme = F.sceneryOf(F.mine());
  const ok = await (D3 ? D3.load(theme) : import('./realm-3d.js').then(m => { D3 = m; return m.load(theme); }));
  if (st.dead) return;
  const host = st.el.querySelector('.rl-gl');
  if (!ok) { host.innerHTML = '<div class="rl-loading">This phone can’t show your realm in 3D.</div>'; return; }
  host.innerHTML = '';
  st.v = D3.create(host, {
    house: MY_HOUSE, zoom: 64, scenery: F.sceneryOf(F.mine()),
    onCamera: () => placeTags(st),
    onTap: hit => onLotTap(st, hit),
    onGrab: (tile, id) => {
      if (st.place) { const sz = F.KINDS[st.place.t].size; return tile.x >= st.place.x - .5 && tile.x <= st.place.x + sz + .5 && tile.y >= st.place.y - .5 && tile.y <= st.place.y + sz + .5; }
      return st.moving != null && id === st.moving;
    },
    onDrag: tile => {
      if (st.place) {
        const sz = F.KINDS[st.place.t].size, x = Math.round(tile.x - sz / 2), y = Math.round(tile.y - sz / 2);
        if (x === st.place.x && y === st.place.y) return;
        Object.assign(st.place, {x, y, ok: F.fits(F.mine(), sz, x, y)});
        st.v.setGhost(st.place); showSel(st);
        return;
      }
      if (st.moving != null) {
        const b = F.mine().b.find(q => q.i === st.moving), sz = F.KINDS[b.t].size, x = Math.round(tile.x - sz / 2), y = Math.round(tile.y - sz / 2);
        st.drag = {x, y, ok: F.fits(F.mine(), sz, x, y, b.i)};
        st.v.select(b.i, {x, y, size: sz, ok: st.drag.ok});
      }
    },
    onDrop: () => {
      if (st.moving == null || !st.drag) return;
      const s = F.mine();
      if (st.drag.ok && F.move(s, st.moving, st.drag.x, st.drag.y)) { F.touch(); ui.haptic('light'); }
      st.drag = null;
      st.v.setLot(s, {now: Date.now(), house: MY_HOUSE});
      st.v.select(st.moving);
      tags(st);
    }
  });
  { const bx = F.boxOf(F.mine()); st.v.frame(bx.x0 - 1, bx.y0 - 1, bx.x1 + 1, bx.y1 + 1, 1.05, 70); }
  refresh(st);
}
function onLotTap(st, hit) {
  if (st.place) return;
  const s = F.mine();
  if (st.moving != null) { st.moving = null; st.v.showGrid(false); select(st, st.sel); return; }
  if (hit.id == null) { if (st.sel != null) select(st, null); return; }
  const b = s.b.find(x => x.i === hit.id);
  if (b && F.KINDS[b.t].role === 'make' && F.made(b) > 0) collectOne(st, b.i);
  select(st, hit.id);
}
function collectOne(st, id) {
  const s = F.mine(), b = s.b.find(x => x.i === id);
  if (!b) return;
  const c = F.KINDS[b.t].makes, got = F.collect(s, id);
  if (got > 0) { F.touch(); ui.haptic('light'); floatText(st, b, `+${nf(got)}`, c); }
  else if (F.made(b) > 0) ui.toast(`No room for more ${F.CUR_NAME[c]}: upgrade a ${c === 'gold' ? 'treasury' : 'granary'}`, {icon: 'info'});
  refresh(st);
}
function floatText(st, b, text, c) {
  if (!st.v) return;
  const sz = F.KINDS[b.t].size, p = st.v.project(b.x + sz / 2, b.y + sz / 2, 2.4), el = document.createElement('div');
  el.className = `rl-float is-${c}`; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  st.el.querySelector('.rl-tags').appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// ---------------------------------------------------------------------------------------------------- the view
export function warm() { if (F.mayPlay()) loadMods(); }
// The tab's dot (app.js): until the owner has opened the Realm once, so he finds it.
const SEEN_KEY = 'gg-realm-seen';
export function badge() { return F.mayPlay() && ui.lsGet(SEEN_KEY) !== '1'; }
function markSeen() {
  if (!F.mayPlay() || ui.lsGet(SEEN_KEY) === '1') return;
  ui.lsSet(SEEN_KEY, '1');
  dispatchEvent(new Event('gg:badge'));
  welcome();
}
function welcome() {
  ui.openSheet({title: 'Your realm', cls: 'sh-rl', detents: ['large'], body:
    `<p class="rl-sh-lead">Raise your house, fill your treasuries, sack the realms around you. Every daily game you play pays your realm in <b>Gold</b> and <b>Grain</b>; everything you’ve played this season already has. It’s yours alone.</p>`
    + `<div class="rl-rows">`
    + `<div class="rl-row"><span><b>Your coffers</b> hold your pay until your Keep, treasuries and granaries have room. Raiders can’t touch them.</span></div>`
    + `<div class="rl-row"><span><b>Gold mines</b> dig Gold and <b>farms</b> grow Grain while you’re away: tap them to collect.</span></div>`
    + `<div class="rl-row"><span><b>Your builder</b> raises or upgrades one thing at a time. Raise your <b>Keep</b> to unlock more of everything.</span></div>`
    + `<div class="rl-row"><span><b>Attack</b>: train an army at the barracks with Grain (footmen, archers, knights, sappers, thieves, and in time dragons from your hatchery) and sack the computer’s realms for their gold and grain.</span></div>`
    + `<div class="rl-row"><span><b>Defend</b>: once your Keep is level 2, those realms raid you too, now and then. Cannons, ballistas, archer towers, trebuchets, pitch cauldrons and walls keep them out.</span></div>`
    + `</div><p class="rl-sh-note">Drag to look around, pinch to zoom. Tap a building for what it does; tap your house’s name to rename it.</p>`});
}

export default {
  id: 'realm',
  chrome: 'none',
  title: 'Realm',

  render() { return F.mayPlay() ? shellHTML() : '<div class="rl rl-none"></div>'; },

  mount(el, ctx) {
    if (!F.mayPlay()) return; // (the owner's alone: nothing here on anyone else's phone)
    const st = {el, ctx, v: null, sel: null, place: null, moving: null, drag: null, dead: false, stops: []};
    ST.set(ctx, st);
    F.mine();
    earned();
    hud(st);
    loadMods().then(() => { if (!st.dead) { earned(); synced(st); } });
    st.stops.push(F.subscribe(() => { if (!st.dead) { hud(st); tags(st); } }));
    ctx.on('daily', type => { if (type === 'lb' && !st.dead) { earned(); synced(st); } });
    ctx.timer(() => { if (!st.dead) { F.mine(); refresh(st); } }, 1000);
    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-rl-collect]')) { collectOne(st, +t.closest('[data-rl-collect]').dataset.rlCollect); return; }
      if (t.closest('[data-rl-coffers]')) { cofferSheet(); return; }
      if (t.closest('[data-rl-army]')) { armySheet(st); return; }
      if (t.closest('[data-rl-shop]')) { shopSheet(st); return; }
      if (t.closest('[data-rl-log]')) { logSheet(); return; }
      if (t.closest('[data-rl-house]')) { houseSheet(st); return; }
      if (t.closest('[data-rl-cur]')) { ui.toast(t.closest('[data-rl-cur]').getAttribute('aria-label'), {icon: 'info'}); return; }
      if (t.closest('[data-rl-raid]')) { raidSheet(st, ctx); return; }
      if (t.closest('[data-rl-unsel]')) { select(st, null); return; }
      if (t.closest('[data-rl-cancel]')) { endPlace(st); return; }
      if (t.closest('[data-rl-place]')) { commitPlace(st); return; }
      const up = t.closest('[data-rl-up]');
      if (up) {
        const s = F.mine();
        if (F.upgrade(s, +up.dataset.rlUp)) { F.touch(); ui.haptic('light'); refresh(st); showSel(st); }
        else ui.toast(F.canUpgrade(s, +up.dataset.rlUp).why, {icon: 'info'});
        return;
      }
      const mv = t.closest('[data-rl-move]');
      if (mv) { st.moving = +mv.dataset.rlMove; if (st.v) st.v.showGrid(true); ui.toast('Drag it where you want it, then tap the lot', {icon: 'info'}); }
    });
    start3d(st);
    if (ctx.visible) { markSeen(); setTimeout(() => { if (!st.dead && ctx.visible) defenses(st); }, 900); }
  },

  onShow(ctx) {
    markSeen();
    const st = ST.get(ctx);
    if (!st) return;
    F.sync(); refresh(st); if (st.v) st.v.want();
    defenses(st);
  },

  update(ctx) { const st = ST.get(ctx); if (st) refresh(st); },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    st.stops.forEach(f => f());
    if (st.v) st.v.dispose();
    F.flush();
    ST.delete(ctx);
  }
};
