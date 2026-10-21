// The Franchise tab (core/franchise.js: the game; views/franchise-3d.js: the lot in 3D; views/franchise-raid.js: a
// raid). Your lot fills the screen: Cash and Juice at the top (what's waiting in the front office under them), the
// coaches, and along the bottom Raid, Team, Build and League. Tap a building for what it is and to upgrade, move or
// collect it (a booth or cooler with something in it collects at a tap); Build opens the shop and puts what you pick
// on the lot to drag where it goes. Raid lists the franchises you can raid (THE RULE: the league's, and the
// computer's); League ranks the franchises this phone may see, with the raids on yours.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as F from '../core/franchise.js';
import {youButtonHTML} from './you.js';

const esc = ui.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])));
const nf = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const ST = new WeakMap();
let D3 = null; // views/franchise-3d.js, once loaded
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

// ---- teams' colours (one each, from their key) and names
const PALETTE = [[0x1D3F8F, 0xF2C94C], [0xA31F34, 0xF4F4F4], [0x0B6E4F, 0xF2C94C], [0x4B2E83, 0xB7A57A], [0xD35400, 0x1B1B1B], [0x002244, 0x69BE28],
  [0x203731, 0xFFB612], [0x101820, 0xD3BC8D], [0x0076B6, 0xB0B7BC], [0x97233F, 0xFFB612], [0x125740, 0xFFFFFF], [0xFB4F14, 0x002244]];
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export function teamOf(key, name) {
  const [pri, sec] = PALETTE[hash(key || 'me') % PALETTE.length];
  return {pri, sec, abbr: String(name || 'Home').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'HOME'};
}
/** A board key's name as this phone shows it. */
export function nameOf(key, docs) {
  if (!key) return 'You';
  if (String(key).startsWith('bot:')) { const b = F.BOTS.find(x => x.k === key); return b ? b.name : 'Computer'; }
  const m = daily.keyManager(key);
  if (m) return (data.name && data.name(m)) || m;
  const d = (docs || []).find(p => daily.boardKey(p) === key);
  return d ? daily.displayName(d) : 'Someone';
}
const myName = () => nameOf(F.myKey() || (data.me() || ''), daily.LB.raw) || 'You';
export const franchiseName = n => `${n}${/s$/i.test(n) ? '’' : '’s'} Franchise`;

/** A picture of a building or a player (thumb() in franchise-3d.js), as an <img>, or '' before the 3D is in. */
export function picOf(k, team, troop = false) {
  const url = D3 && D3.ready() ? D3.thumb(k, troop ? 1 : 2, team, troop) : '';
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
const curHTML = (c, n) => `<span class="fr-amt is-${c}"><i class="fr-coin" aria-hidden="true"></i>${nf(n)}</span>`;

// ---------------------------------------------------------------------------------------------------- what the games paid
let EARNED = {total: 0, by: {}, today: {}, days: 0};
function earned() {
  try { EARNED = F.incomeOf(F.myDocs(), MODS); } catch (e) { console.error(e); }
  return EARNED.total;
}

// ---------------------------------------------------------------------------------------------------- the screen
function shellHTML() {
  return `<div class="fr" data-no-swipe>`
    + `<div class="fr-gl" aria-hidden="true"><div class="fr-loading">Loading your franchise…</div></div>`
    + `<div class="fr-tags" aria-hidden="true"></div>`
    + `<div class="fr-top">`
    + `<button type="button" class="fr-id" data-fr-league aria-label="Your franchise: the league"><span class="fr-lv" data-fr-lv>1</span><span class="fr-idt"><b data-fr-name></b><small><span class="fr-tro" aria-hidden="true"></span><span data-fr-tp>0</span></small></span></button>`
    + `<div class="fr-res">`
    + ['cash', 'juice'].map(c => `<div class="fr-cur is-${c}" data-fr-cur="${c}"><i class="fr-coin" aria-hidden="true"></i><span class="fr-curt"><b data-fr-n>0</b><span class="fr-curb"><i data-fr-f></i></span><small data-fr-cap></small></span></div>`).join('')
    + `</div></div>`
    + `<button type="button" class="fr-office" data-fr-office hidden></button>`
    + `<div class="fr-coach" data-fr-coach></div>`
    + `<div class="fr-sel" data-fr-sel hidden></div>`
    + `<div class="fr-bar" data-fr-bar>`
    + `<button type="button" class="fr-btn is-raid" data-fr-raid><span class="fr-bi" aria-hidden="true">${ui.icon('versus')}</span><span>Raid</span></button>`
    + `<button type="button" class="fr-btn" data-fr-team><span class="fr-bi" aria-hidden="true">${ui.icon('football')}</span><span>Team</span><em data-fr-army></em></button>`
    + `<button type="button" class="fr-btn" data-fr-shop><span class="fr-bi" aria-hidden="true">${ui.icon('plus')}</span><span>Build</span></button>`
    + `<button type="button" class="fr-btn" data-fr-league><span class="fr-bi" aria-hidden="true">${ui.icon('trophy')}</span><span>League</span></button>`
    + `</div></div>`;
}

function hud(st) {
  const s = F.mine(), now = Date.now(), cap = F.capOf(s), el = st.el;
  el.querySelector('[data-fr-lv]').textContent = F.stadiumOf(s);
  el.querySelector('[data-fr-name]').textContent = franchiseName(myName());
  el.querySelector('[data-fr-tp]').textContent = nf(s.tp);
  F.CUR.forEach(c => {
    const box = el.querySelector(`[data-fr-cur="${c}"]`);
    box.querySelector('[data-fr-n]').textContent = nf(s.r[c]);
    box.querySelector('[data-fr-f]').style.width = `${Math.min(100, s.r[c] / Math.max(1, cap[c]) * 100).toFixed(1)}%`;
    box.querySelector('[data-fr-cap]').textContent = `of ${nf(cap[c])}`;
    box.classList.toggle('is-full', s.r[c] >= cap[c]);
  });
  const p = F.pending(s, EARNED.total), off = el.querySelector('[data-fr-office]');
  const any = p.cash > 0 || p.juice > 0;
  off.hidden = false;
  off.innerHTML = any ? `<span class="fr-oft">Front office</span>${curHTML('cash', p.cash)}${curHTML('juice', p.juice)}<span class="fr-ofn">waiting for room</span>`
    : `<span class="fr-oft">Front office</span><span class="fr-ofn">The games pay into it</span>`;
  const co = F.coaches(s, now);
  el.querySelector('[data-fr-coach]').innerHTML = `<span class="fr-whistle" aria-hidden="true"></span>Coaches <b>${co.free}/${co.total}</b>`;
  const army = F.roomOf(s.ar), room = F.armyRoom(s);
  el.querySelector('[data-fr-army]').textContent = room ? `${army}/${room}` : '';
}

// The overlays over the lot: what's piled up in a booth or cooler (tap to collect), a job's clock.
function tags(st) {
  const v = st.v;
  if (!v) return;
  const s = F.mine(), now = Date.now(), box = st.el.querySelector('.fr-tags');
  let html = '';
  s.b.forEach(b => {
    const K = F.KINDS[b.t];
    if (b.u > now) {
      const total = (b.l < 1 ? K.time[0] : K.time[b.l]) * 1000 || 1, f = 1 - (b.u - now) / total;
      html += `<div class="fr-tag is-job" data-fr-tag="${b.i}" data-h="${K.size > 2 ? 2.2 : 1.6}"><span>${dur(b.u - now)}</span><i style="width:${Math.max(4, Math.min(100, f * 100)).toFixed(1)}%"></i></div>`;
    } else if (K.role === 'make') {
      const m = F.made(b, now), hold = F.stat(b.t, b.l).hold;
      if (m >= Math.max(1, hold * .08)) html += `<button type="button" class="fr-tag is-made is-${K.makes}${m >= hold ? ' is-full' : ''}" data-fr-tag="${b.i}" data-fr-collect="${b.i}" data-h="2.2" aria-label="Collect ${nf(m)} ${F.CUR_NAME[K.makes]}"><i class="fr-coin"></i></button>`;
    }
  });
  if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  placeTags(st);
}
function placeTags(st) {
  const v = st.v;
  if (!v) return;
  const s = F.mine();
  st.el.querySelectorAll('[data-fr-tag]').forEach(t => {
    const b = s.b.find(x => x.i === +t.dataset.frTag);
    if (!b) return;
    const sz = F.KINDS[b.t].size, p = v.project(b.x + sz / 2, b.y + sz / 2, +t.dataset.h || 2);
    t.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  });
}

// ---- the selected building's panel
function selHTML(st) {
  const s = F.mine(), b = s.b.find(x => x.i === st.sel), now = Date.now();
  if (!b) return '';
  const K = F.KINDS[b.t], lv = Math.max(1, b.l), sv = F.stat(b.t, lv);
  const what = [];
  if (K.role === 'make') what.push(`Makes ${nf(sv.rate)} ${F.CUR_NAME[K.makes]} an hour · holds ${nf(sv.hold)}`);
  if (K.role === 'store') what.push(`Holds ${nf(sv.cap)} ${F.CUR_NAME[K.holds]}`);
  if (K.role === 'hall') what.push(`Holds ${nf(sv.store)} of each`);
  if (K.role === 'camp') what.push(`Room for ${sv.room}`);
  if (K.role === 'def') what.push(`${nf(sv.dps)} damage a second · reach ${sv.range}${sv.splash ? ' · hits a crowd' : ''}`);
  if (K.role === 'train') what.push(`Opens: ${F.TROOP_ORDER.filter(t => F.TROOPS[t].at <= lv).map(t => F.TROOPS[t].name).join(', ')}`);
  what.push(`${nf(sv.hp)} toughness`);
  let state = '';
  if (b.u > now) state = `<p class="fr-sel-job">${b.l < 1 ? 'Going up' : `Upgrading to level ${b.l + 1}`} · ${dur(b.u - now)} left</p>`;
  const up = F.canUpgrade(s, b.i, now), btns = [];
  if (K.role === 'make' && F.made(b, now) > 0) btns.push(`<button type="button" class="fr-act" data-fr-collect="${b.i}">Collect ${curHTML(K.makes, F.made(b, now))}</button>`);
  if (b.t === 'practice' || b.t === 'locker') btns.push(`<button type="button" class="fr-act" data-fr-team>Train</button>`);
  if (b.t !== 'office' && b.u <= now && up.to <= F.maxLevel(b.t)) {
    btns.push(up.ok ? `<button type="button" class="fr-act is-go" data-fr-up="${b.i}">Upgrade ${curHTML(up.pay, up.cost)}<small>${up.time ? dur(up.time * 1000) : 'at once'}</small></button>`
      : `<button type="button" class="fr-act" disabled>Upgrade<small>${esc(up.why)}${/Not enough/.test(up.why) ? ` (${nf(up.cost)})` : ''}</small></button>`);
  }
  btns.push(`<button type="button" class="fr-act" data-fr-move="${b.i}">Move</button>`);
  return `<div class="fr-sel-h"><div><b>${esc(K.name)}</b><span class="fr-sel-lv">${b.l < 1 ? 'Going up' : `Level ${b.l}`}</span></div>${ui.iconButton({icon: 'close', label: 'Done', cls: 'fr-sel-x', attrs: 'data-fr-unsel'})}</div>`
    + `<p class="fr-sel-what">${what.map(esc).join(' · ')}</p>${state}`
    + `<p class="fr-sel-blurb">${esc(K.blurb)}</p>`
    + `<div class="fr-acts">${btns.join('')}</div>`;
}
function showSel(st) {
  const box = st.el.querySelector('[data-fr-sel]'), bar = st.el.querySelector('[data-fr-bar]');
  if (st.place) {
    const K = F.KINDS[st.place.t], chk = F.canBuild(F.mine(), st.place.t);
    box.hidden = false; bar.hidden = true;
    box.innerHTML = `<div class="fr-sel-h"><div><b>${esc(K.name)}</b><span class="fr-sel-lv">Drag it where it goes</span></div></div>`
      + `<div class="fr-acts"><button type="button" class="fr-act" data-fr-cancel>Cancel</button>`
      + `<button type="button" class="fr-act is-go" data-fr-place ${st.place.ok && chk.ok ? '' : 'disabled'}>Build ${curHTML(chk.pay, chk.cost)}<small>${chk.ok ? (chk.time && st.place.t !== 'office' ? dur(chk.time * 1000) : 'at once') : esc(chk.why)}</small></button></div>`;
    return;
  }
  if (st.sel == null) { box.hidden = true; bar.hidden = false; box.innerHTML = ''; return; }
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
function refresh(st, why) {
  if (st.dead) return;
  const s = F.mine(), now = Date.now();
  const got = F.claim(s, EARNED.total);
  if (got.cash || got.juice) F.touch();
  if (st.v) st.v.setLot(s, {now, team: st.team});
  hud(st);
  tags(st);
  if (st.sel != null && !st.place) showSel(st);
}

// ---------------------------------------------------------------------------------------------------- sheets
function officeSheet(st) {
  const s = F.mine(), p = F.pending(s, EARNED.total);
  const rows = Object.keys(F.GAME_NAME).map(g => `<div class="fr-row"><span>${esc(F.GAME_NAME[g])}</span><span class="fr-row-v">${EARNED.today[g] ? `<em>+${nf(EARNED.today[g])} today</em>` : ''}${nf(EARNED.by[g] || 0)}</span></div>`).join('');
  ui.openSheet({title: 'The front office', cls: 'sh-fr', detents: ['large'], body:
    `<p class="fr-sh-lead">Every daily game you play pays your franchise, in Cash and Juice alike. It waits here, safe from raids, and moves into your Stadium, vaults and tanks as they have room.</p>`
    + `<div class="fr-sh-big">${curHTML('cash', p.cash)}${curHTML('juice', p.juice)}<small>waiting now</small></div>`
    + `<h3 class="fr-sh-h">This season, of each</h3><div class="fr-rows">${rows}<div class="fr-row is-sum"><span>All told</span><span class="fr-row-v">${nf(EARNED.total)}</span></div></div>`
    + `<p class="fr-sh-note">A day’s pay: Daily Puzzles 400 plus 5 a point · 17–0 400 plus 150 a win (500 more for 17–0) · Two-Minute Drill 3,000 a win, 2,000 a tie, 1,000 a loss · Kick It 400 plus 200 a make (up to 15) · Return Man 400 plus 3 a yard (up to 1,000). More room: upgrade your vaults, tanks and Stadium.</p>`});
}
function teamSheet(st) {
  const sh = ui.openSheet({title: 'Your team', cls: 'sh-fr', detents: ['large'], body: '<div data-fr-teambody></div>'});
  const draw = () => {
    const s = F.mine(), now = Date.now(), room = F.armyRoom(s), have = F.roomOf(s.ar), q = F.queued(s);
    const army = F.TROOP_ORDER.filter(t => s.ar[t]).map(t => `<span class="fr-chip">${esc(F.TROOPS[t].name)} ×${s.ar[t]}</span>`).join('') || '<span class="fr-sh-note">No one yet.</span>';
    const line = s.q.map(([t, n], i) => `<span class="fr-chip is-q">${esc(F.TROOPS[t].name)} ×${n}${i === 0 && s.qs ? ` <small>${dur(s.qs + F.trainTime(s, t) * 1000 - now)}</small>` : ''}<button type="button" class="fr-chip-x" data-fr-untrain="${t}" aria-label="Take one ${esc(F.TROOPS[t].name)} out">−</button></span>`).join('');
    const cards = F.TROOP_ORDER.map(t => {
      const T = F.TROOPS[t], chk = F.canTrain(s, t), locked = F.fieldLevel(s) < T.at;
      return `<button type="button" class="fr-tc${locked ? ' is-locked' : ''}" data-fr-train="${t}" ${chk.ok ? '' : 'aria-disabled="true"'}>`
        + `<span class="fr-tc-ic is-${t}" aria-hidden="true">${picOf(t, st.team, true)}</span><b>${esc(T.name)}</b>`
        + `<span class="fr-tc-c">${locked ? `Field level ${T.at}` : `${curHTML('juice', T.cost)} · ${T.room} room`}</span>`
        + `<small>${esc(T.blurb)}</small></button>`;
    }).join('');
    const body = sh.body.querySelector('[data-fr-teambody]');
    body.innerHTML = `<div class="fr-room"><b>${have + q}/${room}</b> room in the locker rooms${q ? ` (${q} in training)` : ''}</div>`
      + `<h3 class="fr-sh-h">Ready</h3><div class="fr-chips">${army}</div>`
      + (line ? `<h3 class="fr-sh-h">Training${s.q.length ? ` · done in ${dur(F.trainedBy(s, now) - now)}` : ''}</h3><div class="fr-chips">${line}</div>` : '')
      + `<h3 class="fr-sh-h">Train <span>(tap to add one · Juice ${nf(s.r.juice)})</span></h3><div class="fr-tcs">${cards}</div>`;
  };
  draw();
  sh.body.addEventListener('click', e => {
    const tr = e.target.closest('[data-fr-train]'), un = e.target.closest('[data-fr-untrain]');
    const s = F.mine();
    if (tr) {
      const t = tr.dataset.frTrain, chk = F.canTrain(s, t);
      if (!chk.ok) { ui.toast(chk.why, {icon: 'info'}); return; }
      F.train(s, t, 1); F.touch(); ui.haptic('selection'); draw(); hud(st);
    } else if (un) { F.untrain(s, un.dataset.frUntrain); F.touch(); draw(); hud(st); }
  });
  const iv = setInterval(() => { if (!sh.el.isConnected) { clearInterval(iv); return; } F.mine(); draw(); }, 1000);
}
/** The franchises this phone may raid: the league's (for a league member or Ryan D: not their own, not shielded, with
 *  a franchise) and the computer's. */
export function targets(now = Date.now(), list = daily.LB.raw || [], me = F.myKey(), mine = F.mine()) {
  const raids = F.raidsOn(list), out = [];
  const byKey = new Map();
  list.forEach(p => { const k = daily.boardKey(p); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); });
  if (me && F.leagueKey(me)) {
    byKey.forEach((docs, k) => {
      if (k === me || !F.leagueKey(k)) return;
      const f = F.freshest(docs);
      if (!f) return;
      const s = F.standing(f, k, raids, now);
      if (!s) return;
      out.push({k, name: nameOf(k, list), th: F.stadiumOf(s), tp: s.tp, loot: F.lootOf(s, now).total, shield: F.shieldOf(k, raids), bot: false});
    });
  }
  const bots = F.BOTS.map(b => ({k: b.k, name: b.name, th: b.th, tp: 0, loot: F.botLoot(b, F.botBase(b.th), mine, now).total, shield: 0, bot: true}));
  return {people: out.sort((a, b) => b.tp - a.tp || b.th - a.th), bots, league: !!me && F.leagueKey(me)};
}
function raidSheet(st, ctx) {
  const s = F.mine(), army = F.roomOf(s.ar), now = Date.now(), T = targets(now);
  const row = x => {
    const sh = x.shield > now;
    return `<div class="fr-tg${sh ? ' is-sh' : ''}"><span class="fr-tg-lv">${x.th}</span><span class="fr-tg-n"><b>${esc(x.name)}</b>`
      + `<small>${x.bot ? 'Computer' : `${nf(x.tp)} trophies`} · ${sh ? `shielded ${dur(x.shield - now)}` : `${curHTML('cash', x.loot.cash)} ${curHTML('juice', x.loot.juice)}`}</small></span>`
      + `<button type="button" class="fr-act is-go fr-tg-go" data-fr-go="${esc(x.k)}" ${sh || !army ? 'disabled' : ''}>Raid</button></div>`;
  };
  const sh = ui.openSheet({title: 'Raid', cls: 'sh-fr', detents: ['large'], body:
    (army ? `<p class="fr-sh-lead">Your team: ${F.TROOP_ORDER.filter(t => s.ar[t]).map(t => `${esc(F.TROOPS[t].name)} ×${s.ar[t]}`).join(', ')}. Drop them round the edge of a lot; they take a share of what’s stored and half of what’s piled up in the booths and coolers.</p>`
      : `<p class="fr-sh-lead">You need a team first: build a practice field and a locker room, then train one (Team).</p>`)
    + (T.league ? `<h3 class="fr-sh-h">The league</h3>${T.people.length ? T.people.map(row).join('') : '<p class="fr-sh-note">No one else in the league has a franchise yet.</p>'}`
      : `<p class="fr-sh-note">Raids on the league’s franchises are for league members. The computer’s are open to everyone.</p>`)
    + `<h3 class="fr-sh-h">The computer’s <span>(full again every morning)</span></h3>${T.bots.map(row).join('')}`});
  sh.body.addEventListener('click', e => {
    const go = e.target.closest('[data-fr-go]');
    if (!go || go.disabled) return;
    sh.close();
    ctx.nav('/franchise/raid/' + encodeURIComponent(go.dataset.frGo));
  });
}
/** The franchises ranked (trophies, then Stadium level), as this phone may see them: the board's docs it's given
 *  (daily.LB.raw: THE RULE) and this phone's own. */
export function ranking(list = daily.LB.raw || [], me = F.myKey(), mine = F.mine(), now = Date.now()) {
  const raids = F.raidsOn(list), byKey = new Map(), rows = [];
  list.forEach(p => { const k = daily.boardKey(p); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); });
  byKey.forEach((docs, k) => {
    if (k === me) return;
    const f = F.freshest(docs);
    if (!f) return;
    const s = F.standing(f, k, raids, now);
    if (s) rows.push({k, name: nameOf(k, list), th: F.stadiumOf(s), tp: s.tp, guest: docs.some(d => daily.guestOf(d))});
  });
  if (mine) rows.push({k: me || 'me', name: myName(), th: F.stadiumOf(mine), tp: mine.tp, me: true});
  return rows.sort((a, b) => b.tp - a.tp || b.th - a.th || a.name.localeCompare(b.name));
}
function leagueSheet(st) {
  const list = daily.LB.raw || [], raids = F.raidsOn(list), me = F.myKey(), mine = F.mine();
  const rows = ranking(list, me, mine);
  const def = me ? raids.filter(r => r.vs === me).sort((a, b) => b.at - a.at).slice(0, 20) : [];
  const off = mine.rd.slice().sort((a, b) => b.at - a.at).slice(0, 20);
  const stars = n => `<span class="fr-stars" aria-label="${n} star${n === 1 ? '' : 's'}">${[0, 1, 2].map(i => `<i class="${i < n ? 'is-on' : ''}"></i>`).join('')}</span>`;
  ui.openSheet({title: 'League', cls: 'sh-fr', detents: ['large'], body:
    `<h3 class="fr-sh-h">Franchises</h3><div class="fr-rank">${rows.map((r, i) => `<div class="fr-rk${r.me ? ' is-me' : ''}"><span class="fr-rk-n">${i + 1}</span><span class="fr-tg-lv">${r.th}</span><b>${esc(r.name)}${r.me ? ' <i class="fr-you">YOU</i>' : r.guest ? ' <i class="fr-you is-g">GUEST</i>' : ''}</b><span class="fr-rk-v"><span class="fr-tro"></span>${nf(r.tp)}</span></div>`).join('')}</div>`
    + `<h3 class="fr-sh-h">Raids on you</h3>${def.length ? def.map(r => `<div class="fr-log"><span>${stars(r.st || 0)}</span><span class="fr-log-t"><span><b>${esc(nameOf(r.from, list))}</b> took ${curHTML('cash', (r.lt || [])[0])} ${curHTML('juice', (r.lt || [])[1])}</span><small>${ago(r.at)} · ${r.pc || 0}% · ${r.td > 0 ? '+' : ''}${r.td || 0} trophies</small></span></div>`).join('') : '<p class="fr-sh-note">No one has raided you.</p>'}`
    + `<h3 class="fr-sh-h">Your raids</h3>${off.length ? off.map(r => `<div class="fr-log"><span>${stars(r.st || 0)}</span><span class="fr-log-t"><span><b>${esc(r.nm || nameOf(r.vs, list))}</b> · you took ${curHTML('cash', (r.lt || [])[0])} ${curHTML('juice', (r.lt || [])[1])}</span><small>${ago(r.at)} · ${r.pc || 0}%${String(r.vs).startsWith('bot:') ? '' : ` · ${r.ta > 0 ? '+' : ''}${r.ta || 0} trophies`}</small></span></div>`).join('') : '<p class="fr-sh-note">You haven’t raided anyone yet.</p>'}`});
}
function shopSheet(st) {
  const s = F.mine(), th = F.stadiumOf(s);
  const groups = [['Money', ['booth', 'cooler', 'vault', 'tank']], ['Team', ['practice', 'locker', 'office']], ['Defense', ['cannon', 'pressbox', 'jugs', 'shower', 'fence']]];
  const card = k => {
    const K = F.KINDS[k], chk = F.canBuild(s, k), n = F.countOf(s, k), cap = F.allowed(s, k);
    return `<button type="button" class="fr-shop-c${chk.ok ? '' : ' is-no'}" data-fr-buy="${k}"><span class="fr-shop-ic is-${k}" aria-hidden="true">${picOf(k, st.team)}</span><b>${esc(K.name)}</b>`
      + `<span class="fr-shop-cost">${curHTML(chk.pay, chk.cost)}</span><small>${n}/${cap}${chk.ok ? (chk.time && k !== 'office' ? ` · ${dur(chk.time * 1000)}` : ' · at once') : ` · ${esc(chk.why)}`}</small></button>`;
  };
  const sh = ui.openSheet({title: 'Build', cls: 'sh-fr', detents: ['large'], body:
    `<p class="fr-sh-lead">Stadium level ${th}: upgrade it for more of everything.</p>`
    + groups.map(([h, ks]) => `<h3 class="fr-sh-h">${h}</h3><div class="fr-shop">${ks.map(card).join('')}</div>`).join('')});
  sh.body.addEventListener('click', e => {
    const c = e.target.closest('[data-fr-buy]');
    if (!c) return;
    const k = c.dataset.frBuy, chk = F.canBuild(F.mine(), k);
    if (!chk.ok) { ui.toast(chk.why, {icon: 'info'}); return; }
    sh.close();
    startPlace(st, k);
  });
}

// ---- placing something new: it sits where there's room near the middle of what you're looking at; drag it; Build
function startPlace(st, k, near = null) {
  const s = F.mine(), spot = F.spotFor(s, k, near);
  if (!spot) { ui.toast('No room on the lot', {icon: 'info'}); return; }
  st.sel = null;
  st.place = {t: k, x: spot.x, y: spot.y, ok: true};
  if (st.v) { st.v.select(null); st.v.setGhost(st.place); st.v.showGrid(true); }
  showSel(st);
}
function endPlace(st) {
  st.place = null; st.lastFence = null;
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
  // fences: the next one goes on beside it, the same way along
  if (p.t === 'fence' && F.canBuild(s, 'fence').ok) {
    const d = st.lastFence ? [p.x - st.lastFence.x, p.y - st.lastFence.y] : null;
    const dir = d && Math.abs(d[0]) + Math.abs(d[1]) === 1 ? d : [1, 0];
    st.lastFence = {x: p.x, y: p.y};
    const nx = p.x + dir[0], ny = p.y + dir[1];
    const next = F.fits(s, 1, nx, ny) ? {x: nx, y: ny} : F.spotFor(s, 'fence', {x: p.x, y: p.y});
    if (next) {
      st.place = {t: 'fence', x: next.x, y: next.y, ok: true};
      st.v.setLot(s, {now: Date.now(), team: st.team}); st.v.setGhost(st.place); refresh(st); showSel(st);
      return;
    }
  }
  st.lastFence = null;
  endPlace(st);
  refresh(st);
}

// ---------------------------------------------------------------------------------------------------- the 3D
async function start3d(st) {
  const ok = await (D3 ? D3.load() : import('./franchise-3d.js').then(m => { D3 = m; return m.load(); }));
  if (st.dead) return;
  const host = st.el.querySelector('.fr-gl');
  if (!ok) { host.innerHTML = '<div class="fr-loading">This phone can’t show the lot in 3D.</div>'; return; }
  host.innerHTML = '';
  st.v = D3.create(host, {
    team: st.team, zoom: 52,
    onCamera: () => placeTags(st),
    onTap: hit => onLotTap(st, hit),
    onGrab: (tile, id) => {
      // a drag on what's being placed or moved moves it
      if (st.place) { const sz = F.KINDS[st.place.t].size; return tile.x >= st.place.x - .5 && tile.x <= st.place.x + sz + .5 && tile.y >= st.place.y - .5 && tile.y <= st.place.y + sz + .5; }
      if (st.moving != null && id === st.moving) return true;
      return false;
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
      if (st.moving != null && st.drag) {
        const s = F.mine();
        if (st.drag.ok && F.move(s, st.moving, st.drag.x, st.drag.y)) { F.touch(); ui.haptic('light'); }
        st.drag = null;
        st.v.setLot(s, {now: Date.now(), team: st.team});
        st.v.select(st.moving, null);
        st.v.select(st.moving);
        tags(st);
      }
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
  if (got > 0) {
    F.touch(); ui.haptic('light');
    floatText(st, b, `+${nf(got)}`, c);
  } else if (F.made(b) > 0) ui.toast(`No room for more ${F.CUR_NAME[c]}: upgrade a ${c === 'cash' ? 'vault' : 'tank'}`, {icon: 'info'});
  refresh(st);
}
function floatText(st, b, text, c) {
  if (!st.v) return;
  const sz = F.KINDS[b.t].size, p = st.v.project(b.x + sz / 2, b.y + sz / 2, 2.4), el = document.createElement('div');
  el.className = `fr-float is-${c}`; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  st.el.querySelector('.fr-tags').appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// ---------------------------------------------------------------------------------------------------- the view
export function warm() { loadMods(); }
// The tab's dot (app.js): until this phone has opened the Franchise once, so it's found.
const SEEN_KEY = 'gg-fr-seen';
export function badge() { return ui.lsGet(SEEN_KEY) !== '1'; }
function markSeen() {
  if (ui.lsGet(SEEN_KEY) === '1') return;
  ui.lsSet(SEEN_KEY, '1');
  dispatchEvent(new Event('gg:badge'));
  welcome();
}
// The first time: what this is, in a few lines.
function welcome() {
  ui.openSheet({title: 'Your franchise', cls: 'sh-fr', detents: ['large'], body:
    `<p class="fr-sh-lead">Build it up and raid the league. Every daily game you play pays your franchise in <b>Cash</b> and <b>Juice</b>; everything you’ve played this season already has.</p>`
    + `<div class="fr-rows">`
    + `<div class="fr-row"><span><b>The front office</b> holds your pay until your Stadium, vaults and tanks have room. Raiders can’t touch it.</span></div>`
    + `<div class="fr-row"><span><b>Ticket booths</b> make Cash and <b>Gatorade coolers</b> make Juice while you’re away: tap them to collect.</span></div>`
    + `<div class="fr-row"><span><b>Coaches</b> build and upgrade, one job each. Upgrade the <b>Stadium</b> to unlock more of everything.</span></div>`
    + `<div class="fr-row"><span><b>Raid</b>: train a team at the practice field with Juice, then raid a league franchise (or the computer’s) for some of what it has stored.</span></div>`
    + `<div class="fr-row"><span><b>Defend</b> with T-shirt cannons, the press box, the JUGS machine, the Gatorade shower and fences. Raided, you get a 12-hour shield.</span></div>`
    + `</div><p class="fr-sh-note">Drag to look around, pinch to zoom. Tap a building for what it does.</p>`});
}

export default {
  id: 'franchise',
  chrome: 'none',
  title: 'Franchise',

  render() { return shellHTML(); },

  mount(el, ctx) {
    const st = {el, ctx, v: null, sel: null, place: null, moving: null, drag: null, dead: false, team: null, stops: []};
    ST.set(ctx, st);
    st.team = teamOf(F.myKey() || data.me() || 'me', myName());
    F.mine();
    earned();
    hud(st);
    loadMods().then(() => { if (!st.dead) { earned(); F.sync(); refresh(st); } });
    st.stops.push(F.subscribe(() => { if (!st.dead) { hud(st); tags(st); } }));
    ctx.on('daily', type => { if (type === 'lb' && !st.dead) { earned(); F.sync(); st.team = teamOf(F.myKey() || data.me() || 'me', myName()); refresh(st); } });
    ctx.timer(() => { if (!st.dead) { F.mine(); refresh(st); } }, 1000);
    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-fr-collect]')) { collectOne(st, +t.closest('[data-fr-collect]').dataset.frCollect); return; }
      if (t.closest('[data-fr-office]')) { officeSheet(st); return; }
      if (t.closest('[data-fr-team]')) { teamSheet(st); return; }
      if (t.closest('[data-fr-shop]')) { shopSheet(st); return; }
      if (t.closest('[data-fr-league]')) { leagueSheet(st); return; }
      if (t.closest('[data-fr-raid]')) { raidSheet(st, ctx); return; }
      if (t.closest('[data-fr-unsel]')) { select(st, null); return; }
      if (t.closest('[data-fr-cancel]')) { endPlace(st); return; }
      if (t.closest('[data-fr-place]')) { commitPlace(st); return; }
      const up = t.closest('[data-fr-up]');
      if (up) {
        const s = F.mine();
        if (F.upgrade(s, +up.dataset.frUp)) { F.touch(); ui.haptic('light'); refresh(st); showSel(st); }
        else ui.toast(F.canUpgrade(s, +up.dataset.frUp).why, {icon: 'info'});
        return;
      }
      const mv = t.closest('[data-fr-move]');
      if (mv) { st.moving = +mv.dataset.frMove; if (st.v) st.v.showGrid(true); ui.toast('Drag it where you want it, then tap the lot', {icon: 'info'}); }
    });
    start3d(st);
    if (ctx.visible) markSeen();
  },

  onShow(ctx) { markSeen(); const st = ST.get(ctx); if (st) { F.sync(); refresh(st); if (st.v) st.v.want(); } },

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
