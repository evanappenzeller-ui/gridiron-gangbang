import * as features from '../core/features.js';
// Keepfall (the game was the Realm till Oct 21 2026: its route, view id and saves keep that name; core/realm.js
// says which words changed). core/realm.js: the game; views/realm-3d.js: the lot in 3D; views/realm-raid.js: a raid;
// views/realm-scout.js: a look round a realm before you raid it; views/realm-visit.js: a look round another player's
// (Visit, by Lore: core/realm.js visitable). The owner's
// alone (features.available(): its Daily Games case and route open on his phones only, and this screen shows nothing on anyone else's). Your
// lot fills the screen: your house, Gold and Ale, a way back to the Hub and a village framing control above;
// a state-aware next step and Attack, Army, Build and Chronicle below. Tap a building for its current and next-level
// benefits, upgrade cost/time, moving or collection (a mine or brewery with something in
// it collects at a tap); Build puts what you pick on the lot to drag where it goes. When you come back after the
// computer's realms have raided you, what they did is the first thing you see. Each sheet's body is built by a pure
// function of the realm (cofferHTML, armyHTML, …), so the checks can read every word of it (_screens()). Raids open at
// Castle level 4 (core/realm.js ATTACK_AT: Attack shows the lock until then, and the next step points at the Castle).
// The Chronicle lists the raids on your realm, your attacks and the example raids, each with ▶ Watch where its replay
// was kept (views/realm-replay.js, #/realm/replay/<id>; closing it opens the Chronicle again).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as F from '../core/realm.js';
import {defend, exampleRaidsAsync, ensureExamplesAsync, examplesBusy} from '../core/realm-battle.js';
import {heroCards, residentsNote} from './realm-heroes.js';
import {LORE_VERSION, introHTML, mountIntro} from './realm-lore.js';
import {CREDIT as DRAGON_CREDIT} from './realm-dragon.js';
import {dragonPickerHTML, colorName} from './realm-dragon-picker.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const ST = new WeakMap();
let D3 = null; // views/realm-3d.js, once loaded
const MODS = {}; // the game cores, for what the games have paid
let modsAsked = null;
function realmSheet(options) {
  let stop = () => {};
  const sh = ui.openSheet({...options, onClose: () => { stop(); if (options.onClose) options.onClose(); }});
  stop = data.subscribe(type => { if (type === 'me') { sh.body.replaceChildren(); sh.close(); } });
  return sh;
}
function dragonSheet(st, buildingId = null, onChoose = null) {
  if (st.dead || !F.mayPlay()) return;
  const s = F.mine(), b = s.b.find(x => x.i === buildingId), current = b && F.dragonOfBuilding(s, b);
  let choice = current ? {species: current.species, color: current.color} : {};
  const sh = realmSheet({title: current ? `${current.name} · Color` : 'Choose your dragon', cls: 'sh-rl', detents: ['large'],
    body: dragonPickerHTML(s, choice, buildingId)});
  const draw = focus => {
    sh.body.innerHTML = dragonPickerHTML(F.mine(), choice, buildingId);
    if (focus) sh.body.querySelector(focus)?.focus({preventScroll: true});
  };
  sh.body.addEventListener('click', e => {
    if (st.dead || !F.mayPlay()) return;
    const species = e.target.closest('[data-dragon-species]'), color = e.target.closest('[data-dragon-color]');
    if (species && !species.disabled) {
      choice = {species: species.dataset.dragonSpecies, color: ''};
      draw(`[data-dragon-species="${choice.species}"]`); return;
    }
    if (color) { choice.color = color.dataset.dragonColor; draw(`[data-dragon-color="${choice.color}"]`); return; }
    if (!e.target.closest('[data-dragon-confirm]')) return;
    const fresh = F.mine();
    if (buildingId != null) {
      const check = F.canChooseHatcheryDragon(fresh, buildingId, choice.species, choice.color);
      if (!check.ok || !F.chooseHatcheryDragon(fresh, buildingId, choice.species, choice.color)) {
        sh.body.querySelector('[data-dragon-error]').textContent = check.why || 'This choice is no longer available.'; return;
      }
      F.touch(); F.flush(); sh.close(); refresh(st); ui.haptic('success');
      ui.toast(`${F.DRAGONS[choice.species].name} · ${colorName(choice.color)}`, {icon: 'shield'});
    } else {
      const D = F.hatcheryChoices(fresh).find(d => d.id === choice.species);
      if (!D || !D.colors.includes(choice.color)) { draw(); sh.body.querySelector('[data-dragon-error]').textContent = 'That dragon has already been claimed. Choose another.'; return; }
      sh.close(); onChoose?.({...choice});
    }
  });
}
function loadMods() {
  if (!modsAsked) {
    modsAsked = Promise.all([
      // (the Daily Puzzles' days, for ranking a day on its board: core/realm.js incomeOf)
      Promise.resolve().then(() => daily.ensure()).catch(() => {}),
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
// The members' surnames, which the league's list doesn't carry (it has first names only), for their houses: House
// Hulse, House Wilson (the owner's, Oct 2026; his own first, then everyone's on Oct 24).
const SURNAME = {evan: 'Appenzeller', ben: 'Wagner', corbin: 'Wafful', dresden: 'Wilson', jackson: 'Zehr', jacob: 'Carswell',
  jaymin: 'Sutton', jayton: 'Hull', john: 'Imerman', mason: 'Hulse', mitch: 'Moore', sayer: 'Woodson'};
/** Your house's name: the one you gave it, else House and your last name (House Appenzeller). (The old default, House
 *  and your first name, kept by saving it unchanged, counts as none.) who: another player's ({name, full, member}: core/realm.js
 *  visitable), for their realm. */
export function houseName(s = F.mine(), who = null) {
  const m = who ? who.member : data.me(), n = String((who ? who.full || who.name : m ? data.name(m) : data.user()?.name || data.guest()) || '').trim().split(/\s+/);
  if (s.nm && s.nm !== `House ${n[0]}`) return s.nm;
  return `House ${SURNAME[m] || n[n.length - 1] || 'Wanderer'}`;
}
/** A picture of a building or a soldier (thumb() in realm-3d.js), as an <img>, or '' before the 3D is in. */
export function picOf(k, house, troop = false) {
  const url = D3 && D3.ready() ? D3.thumb(k, troop || k === 'wall' ? 1 : 2, house, troop) : '';
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
// (the coin or tankard is a picture, so its name is there for a screen reader: "2,500 Gold", "2,500 Ale")
export const curHTML = (c, n) => `<span class="rl-amt is-${c}"><i class="rl-coin" aria-hidden="true"></i>${nf(n)}<span class="sr-only"> ${F.CUR_NAME[c] || ''}</span></span>`;
export const starsHTML = (n, big = false) => `<span class="rl-stars${big ? ' is-big' : ''}" aria-label="${n} star${n === 1 ? '' : 's'}">${[0, 1, 2].map(i => `<i class="${i < n ? 'is-on' : ''}"></i>`).join('')}</span>`;

// ---------------------------------------------------------------------------------------------------- what the games paid
// (incomeOf(): of each, {gold, grain}; places on today's boards pending; nothing at all off the owner's phone)
const NO_PAY = () => ({total: {gold: 0, grain: 0}, by: {}, today: {}, pending: {}, last: {}, days: 0, day: {}});
let EARNED = NO_PAY(), EARNED_DAY = '';
// The Chronicle again when Keepfall next shows (a replay closed: views/realm-replay.js).
let LOG_NEXT = false;
export function reopenLog() { LOG_NEXT = F.mayPlay(); }
/** Whether a raid on the record kept its replay (core/realm.js: the newest of each list, and every example) and it plays
 *  under today's rules (hasReplay). s: the realm it's on (the lots its replay may point at), the owner's by default. */
export const canWatch = (r, s) => !!(r && r.rp && typeof r.rp === 'object' && F.hasReplay(r, s || undefined));
// (another profile on this phone, here or in another tab: the owner's pay isn't kept in memory for it)
try { data.subscribe(type => { if (type === 'me') { EARNED = NO_PAY(); EARNED_DAY = ''; LOG_NEXT = false; ART.clear(); } }); } catch (_) {}
function earned() {
  if (!F.mayPlay()) { EARNED = NO_PAY(); return EARNED.total; }
  // (the places already paid count as they were paid, frozen in the realm: refresh freezes the new ones; and only the
  // days from the one the realm began on: count from the start day, Oct 22 2026)
  try {
    const docs = F.myDocs(), s = F.mine();
    EARNED = F.incomeOf(docs, MODS, {paid: s.pd, from: s.born}); EARNED_DAY = F.dayKey();
    // (today's makes and coins, read from the runs themselves for the coffers' words: payToday)
    if (!EARNED.runs) EARNED.runs = runsOf(docs, MODS, EARNED.day);
  } catch (e) { console.error(e); }
  return EARNED.total;
}

// ---------------------------------------------------------------------------------------------------- the screen
function shellHTML() {
  return `<div class="rl rl-home" data-no-swipe>`
    + `<div class="rl-gl" aria-hidden="true"><div class="rl-loading">Riding out to your realm…</div></div>`
    + `<div class="rl-tags"></div><div class="rl-effects" aria-hidden="true"></div>`
    + `<div class="sr-only" data-rl-announcement role="status" aria-live="polite"></div>`
    + `<div class="rl-top">`
    + `<button type="button" class="rl-me" data-rl-house aria-label="Your house"><span class="rl-crest" data-rl-lv>1</span><b data-rl-name></b></button>`
    + `<div class="rl-res">`
    + F.CUR.map(c => `<button type="button" class="rl-cur is-${c}" data-rl-cur="${c}"><span class="rl-curb"><i data-rl-f></i></span><b data-rl-n>0</b><i class="rl-coin" aria-hidden="true"></i></button>`).join('')
    + `</div></div>`
    + `<div class="rl-utility"><div class="rl-home-links"><button type="button" class="rl-hub" data-nav="/puzzles" aria-label="Back to Daily Games">‹ Games</button>`
    + `<button type="button" class="rl-frame rl-lore" data-rl-lore aria-label="Read the lore of Keepfall">Lore</button>`
    + `<button type="button" class="rl-frame rl-visit" data-rl-visit aria-label="Visit other players’ realms">Visit</button></div>`
    + `<div class="rl-camera-modes"><button type="button" class="rl-frame" data-rl-buildings aria-label="Find a building, including hidden buildings">Buildings</button><button type="button" class="rl-frame" data-rl-frame aria-label="Center your village">Village</button>`
    + `<button type="button" class="rl-frame" data-rl-world aria-label="Zoom out to the whole realm">Realm</button></div></div>`
    + `<button type="button" class="rl-objective" data-rl-objective hidden></button>`
    + `<div class="rl-sel" data-rl-sel hidden></div>`
    + `<div class="rl-bar" data-rl-bar>`
    + `<button type="button" class="rl-btn is-raid" data-rl-raid><span class="rl-bi" aria-hidden="true">${ui.icon('versus', {cls: 'rl-bi-go'})}${ui.icon('lock', {cls: 'rl-bi-lock'})}</span><span>Attack</span><em class="rl-lockt" data-rl-raidlock hidden>Castle ${F.ATTACK_AT}</em></button>`
    + `<button type="button" class="rl-btn" data-rl-army><span class="rl-bi" aria-hidden="true">${ui.icon('shield')}</span><span>Army</span><em data-rl-armyn></em></button>`
    + `<button type="button" class="rl-btn" data-rl-shop><span class="rl-bi" aria-hidden="true">${ui.icon('plus')}</span><span>Build</span></button>`
    + `<button type="button" class="rl-btn" data-rl-log><span class="rl-bi" aria-hidden="true">${ui.icon('list')}</span><span>Chronicle</span></button>`
    + `</div></div>`;
}

function hud(st, s = null) {
  if (st.dead || !F.mayPlay()) return;
  if (!s) s = F.mine();
  const cap = F.capOf(s), el = st.el;
  el.querySelector('[data-rl-lv]').textContent = F.keepOf(s);
  el.querySelector('[data-rl-name]').textContent = houseName(s);
  el.querySelector('[data-rl-house]').setAttribute('aria-label', `Your house: ${houseName(s)}, Castle level ${F.keepOf(s)}`);
  F.CUR.forEach(c => {
    const box = el.querySelector(`[data-rl-cur="${c}"]`);
    if (F.testing(s)) {
      // (testing: unlimited, nothing spent)
      box.querySelector('[data-rl-n]').textContent = '∞';
      box.querySelector('[data-rl-f]').style.width = '100%';
      box.setAttribute('aria-label', `${F.CUR_NAME[c]}: unlimited while testing; the coffers`);
      box.title = 'Unlimited while testing';
      box.classList.remove('is-full');
      return;
    }
    box.querySelector('[data-rl-n]').textContent = nf(s.r[c]);
    box.querySelector('[data-rl-f]').style.width = `${Math.min(100, s.r[c] / Math.max(1, cap[c]) * 100).toFixed(1)}%`;
    box.setAttribute('aria-label', `${F.CUR_NAME[c]}: ${nf(s.r[c])} of ${nf(cap[c])}; the coffers`);
    box.title = `${nf(s.r[c])} of ${nf(cap[c])}`;
    box.classList.toggle('is-full', s.r[c] >= cap[c]);
  });
  const army = F.roomOf(s.ar), room = F.armyRoom(s);
  el.querySelector('[data-rl-armyn]').textContent = room ? `${army}/${room}` : '';
  // (Attack, locked till Castle level 4: it still opens, to say so)
  const open = F.attackOpen(s), rb = el.querySelector('[data-rl-raid]');
  rb.classList.toggle('is-locked', !open);
  rb.querySelector('[data-rl-raidlock]').hidden = open;
  rb.setAttribute('aria-label', open ? 'Attack' : `Attack: raids open at Castle level ${F.ATTACK_AT}`);
  objective(st, s);
}

/** One useful, currently available action. Never spends resources until its normal confirmation. */
export function nextObjective(s, now = Date.now()) {
  const unchosen = s.b.find(b => b.t === 'hatchery' && !F.dragonOfBuilding(s, b));
  if (unchosen && F.keepOf(s) >= 4) return {kind: 'dragon', id: unchosen.i, title: 'Choose your dragon', detail: 'Pick its species and color for your hatchery'};
  const working = s.b.filter(b => b.u > now).sort((a, b) => a.u - b.u)[0];
  if (working) return {kind: 'select', id: working.i, title: `${F.KINDS[working.t].name} ${working.l ? 'upgrading' : 'building'}`, detail: `Ready in ${dur(working.u - now)} · View progress`};
  const build = k => {
    const chk = F.canBuild(s, k, now);
    return chk.ok ? {kind: 'build', type: k, title: `Build ${F.KINDS[k].name}`, detail: `${nf(chk.cost)} ${F.CUR_NAME[chk.pay]} · Choose a spot`} : null;
  };
  const upgrade = b => b && F.canUpgrade(s, b.i, now).ok ? {kind: 'select', id: b.i, title: `Upgrade ${F.KINDS[b.t].name}`, detail: upgradeBenefit(b)} : null;
  // (raids open at Castle level 4: till then, whenever the Castle can go up, that's the step, before anything else (a full
  // treasury included: the Castle spends it); when it can't yet, the buildings that pay and hold for it, and the Castle
  // with what it needs when there's nothing else to do)
  const locked = !F.attackOpen(s), keep = s.b.find(b => b.t === 'keep');
  if (locked && keep && F.canUpgrade(s, keep.i, now).ok) {
    const up = F.canUpgrade(s, keep.i, now);
    return {kind: 'select', id: keep.i, title: `Raise your Castle to level ${up.to}`, detail: `Raids open at Castle level ${F.ATTACK_AT} · ${nf(up.cost)} ${F.CUR_NAME[up.pay]}`};
  }
  const cap = F.capOf(s);
  for (const c of F.CUR) {
    if (s.r[c] < cap[c] * .9) continue;
    const k = c === 'gold' ? 'treasury' : 'granary';
    const goal = build(k) || s.b.filter(b => b.t === k).map(upgrade).find(Boolean);
    if (goal) return goal;
  }
  for (const k of ['mine', 'farm', 'barracks', 'camp', 'cannon']) {
    if (s.b.some(b => b.t === k)) continue;
    const goal = build(k);
    if (goal) return goal;
  }
  if (F.allowed(s, 'hatchery') > F.countOf(s, 'hatchery')) {
    const goal = build('hatchery');
    if (goal) return {...goal, title: `Choose dragon ${F.countOf(s, 'hatchery') + 1}`, detail: 'A new hatchery is available · Choose its dragon and color'};
  }
  // (till raids open, no army step: Attack's step is the Castle's)
  if (!locked && !F.roomOf(s.ar) && !s.q.length && F.canTrain(s, 'footman').ok) return {kind: 'army', title: 'Train your first troops', detail: 'Prepare an army for a raid'};
  const candidates = s.b.filter(b => ['mine', 'farm', 'ballista', 'cannon', 'keep'].includes(b.t)).sort((a, b) => a.l - b.l || (a.t === 'keep') - (b.t === 'keep'));
  for (const b of candidates) { const goal = upgrade(b); if (goal) return goal; }
  const ready = s.b.find(b => F.KINDS[b.t].role === 'make' && F.made(b, now) >= 1 && s.r[F.KINDS[b.t].makes] < cap[F.KINDS[b.t].makes]);
  if (ready) return {kind: 'collect', id: ready.i, title: `Collect ${F.CUR_NAME[F.KINDS[ready.t].makes]}`, detail: 'Bring your production into storage'};
  if (s.q.length) return {kind: 'army', title: 'Your army is training', detail: `Ready in ${dur(F.trainedBy(s, now) - now)} · View army`};
  if (!locked && F.roomOf(s.ar)) return {kind: 'raid', title: 'Scout your next raid', detail: 'Inspect a rival realm before you attack'};
  if (locked && keep) {
    const up = F.canUpgrade(s, keep.i, now);
    return {kind: 'select', id: keep.i, title: `Raise your Castle to level ${up.to || F.keepOf(s) + 1}`,
      detail: `Raids open at Castle level ${F.ATTACK_AT} · ${/Not enough/.test(up.why || '') ? `${nf(up.cost)} ${F.CUR_NAME[up.pay]}: the daily games pay it` : up.why || 'Upgrade it'}`};
  }
  return {kind: 'games', title: 'Earn more Gold and Ale', detail: 'Daily games pay into your realm’s coffers'};
}

export function upgradeBenefit(b) {
  const K = F.KINDS[b.t], lv = Math.max(1, b.l);
  if (lv >= F.maxLevel(b.t) || b.t === 'hut') return 'At its top level';
  const a = F.stat(b.t, lv), n = F.stat(b.t, lv + 1), change = (label, x, y, unit = '') => `${label}: ${nf(x)} → ${nf(y)}${unit}`;
  if (K.role === 'make') return change(F.CUR_NAME[K.makes], a.rate, n.rate, '/hour');
  if (K.role === 'store') return change(`${F.CUR_NAME[K.holds]} capacity`, a.cap, n.cap);
  if (K.role === 'hall') return change('Storage each', a.store, n.store) + ' · New buildings';
  if (K.role === 'def') return change('Damage', a.dps, n.dps, '/second');
  if (K.role === 'camp') return change('Army room', a.room, n.room);
  if (K.role === 'hatch') {
    // (its level is the Dragon Hero's, core/realm.js HEROES.dragon: his health and fire, now → then)
    const D = F.DRAGONS[b.dragon?.species], key = D?.hero || 'dragon', rules = D ? F.RULES_V : 2;
    const d = F.heroStat(key, a.dragon, rules), e = F.heroStat(key, n.dragon, rules);
    return `${D?.name || 'Dragon'}: ${nf(d.hp)} → ${nf(e.hp)} health · ${nf(d.dps)} → ${nf(e.dps)} damage/second`;
  }
  if (K.role === 'train') {
    const opens = F.TROOP_ORDER.filter(t => F.TROOPS[t].at === lv + 1).map(t => F.TROOPS[t].name);
    if (opens.length) return `Unlocks ${opens.join(', ')}`;
  }
  return change('Strength', a.hp, n.hp);
}

function objective(st, s = F.mine()) {
  const box = st.el.querySelector('[data-rl-objective]');
  st.goal = nextObjective(s);
  box.hidden = !!st.place || st.sel != null;
  const html = `<span class="rl-objective-k">Next step</span><b>${esc(st.goal.title)}</b><small>${esc(st.goal.detail)}</small><span class="rl-objective-arrow" aria-hidden="true">›</span>`;
  if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
}

function followObjective(st) {
  const goal = nextObjective(F.mine());
  if (goal.kind === 'build') { startPlace(st, goal.type); return; }
  if (goal.kind === 'army') { armySheet(st); return; }
  if (goal.kind === 'dragon') { dragonSheet(st, goal.id); return; }
  if (goal.kind === 'raid') { raidSheet(st, st.ctx); return; }
  if (goal.kind === 'games') { st.ctx.nav('/puzzles'); return; }
  const b = F.mine().b.find(b => b.i === goal.id);
  if (!b) return;
  if (st.v) { const sz = F.KINDS[b.t].size; st.v.look(b.x + sz / 2, b.y + sz / 2, Math.min(42, st.v.zoom)); }
  if (goal.kind === 'collect') collectOne(st, b.i);
  select(st, b.i);
}

// The overlays over the lot: what's piled up in a mine or brewery (tap to collect), a job's clock.
function tags(st) {
  if (!st.v || st.dead || !F.mayPlay()) return;
  const box = st.el.querySelector('.rl-tags');
  let html = tagsHTML(F.mine(), Date.now());
  if (st.goal && st.goal.id != null && !st.place && st.sel == null) html += `<div class="rl-tag is-objective" data-rl-tag="${st.goal.id}" data-h=".08" aria-hidden="true"></div>`;
  if (box.dataset.html !== html) {
    const focused = box.contains(document.activeElement) ? document.activeElement.dataset.rlCollect : null;
    box.dataset.html = html; box.innerHTML = html;
    if (focused) box.querySelector(`[data-rl-collect="${Number(focused)}"]`)?.focus({preventScroll: true});
  }
  placeTags(st);
}
/** What's over the lot for realm s at now: a job's clock, a mine's or brewery's take to collect. */
function tagsHTML(s, now) {
  let html = '';
  s.b.forEach(b => {
    const K = F.KINDS[b.t];
    if (b.u > now) {
      const total = (b.l < 1 ? K.time[0] : K.time[b.l]) * 1000 || 1, f = 1 - (b.u - now) / total;
      html += `<div class="rl-tag is-job" data-rl-tag="${b.i}" data-h="${K.size > 2 ? 2.4 : 1.7}"><span>${dur(b.u - now)}</span><i style="width:${Math.max(4, Math.min(100, f * 100)).toFixed(1)}%"></i></div>`;
    } else if (K.role === 'make') {
      const m = F.made(b, now), hold = F.stat(b.t, b.l).hold;
      if (m >= Math.max(1, hold * .08)) html += `<button type="button" class="rl-tag is-made is-${K.makes}${m >= hold ? ' is-full' : ''}" data-rl-tag="${b.i}" data-rl-collect="${b.i}" data-h="2.2" aria-label="Collect ${nf(m)} ${F.CUR_NAME[K.makes]}"><span class="rl-collect-disc"><i class="rl-coin" aria-hidden="true"></i></span></button>`;
    }
  });
  return html;
}
function placeTags(st) {
  if (!st.v || st.dead || !F.mayPlay()) return;
  const s = F.mine();
  st.el.querySelector('.rl-tags').style.setProperty('--rl-tag-scale', st.v.overlayScale || 1);
  st.el.querySelectorAll('[data-rl-tag]').forEach(t => {
    const b = s.b.find(x => x.i === +t.dataset.rlTag);
    if (!b) return;
    const sz = F.KINDS[b.t].size, p = st.v.project(b.x + sz / 2, b.y + sz / 2, +t.dataset.h || 2);
    t.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)${t.classList.contains('is-made') ? '' : ` scale(${st.v.overlayScale || 1})`}`;
    t.hidden = p.x < 16 || p.y < 16 || p.x > st.el.clientWidth - 16 || p.y > st.el.clientHeight - 90;
  });
}

// ---- the selected building's card
/** What building b is and does at its level (its card's line, yours or one you're scouting): [text]. own: it's on your
 *  realm (a computer's realm's hatchery has no Dragon Hero defending it, nor a dragon keeper: Oct 23 2026, the scout's
 *  card said it had). whose: whose keeper tends a hatchery that's own (another player's realm, visited: 'their'). */
export function factsOf(b, {own = false, whose = 'your'} = {}) {
  const K = F.KINDS[b.t], lv = Math.max(1, b.l), sv = F.stat(b.t, lv), what = [];
  if (K.role === 'make') what.push(`Makes ${nf(sv.rate)} ${F.CUR_NAME[K.makes]} an hour · holds ${nf(sv.hold)}`);
  if (K.role === 'store') what.push(`Holds ${nf(sv.cap)} ${F.CUR_NAME[K.holds]}`);
  if (K.role === 'hall') what.push(`Holds ${nf(sv.store)} of each`);
  if (K.role === 'camp') what.push(`Room for ${sv.room}`);
  if (K.role === 'hatch') {
    const D = F.DRAGONS[b.dragon?.species];
    if (own && D && D.colors.includes(b.dragon.color)) {
      const d = F.heroStat(D.hero, sv.dragon);
      what.push(`${D.name} · ${colorName(b.dragon.color)} · ${D.fly ? 'Flying' : 'Ground'} dragon`,
        b.l ? `Level ${b.l}: ${nf(d.hp)} health · ${nf(d.dps)} damage a second` : 'Hatches when construction finishes');
    } else what.push(own ? 'Choose a dragon species and color' : 'No dragon defends it');
    if (own) what.push(`Tended by ${whose} dragon keeper`);
  }
  if (K.role === 'def') what.push(`${nf(sv.dps)} damage a second · reach ${sv.range}${sv.splash ? ' · hits a crowd' : ''}${sv.air ? ' · hits dragons' : ''}`);
  if (K.role === 'train') what.push(`Trains: ${F.TROOP_ORDER.filter(t => F.TROOPS[t].at <= lv).map(t => F.TROOPS[t].name).join(', ')}`);
  what.push(`${nf(sv.hp)} strength`);
  return what;
}
// A building's card (the owner's ask, Oct 22 2026: "Change the design for the pop up for each building", after Clash of
// Clans' info screen, in Keepfall's oak, gilt and parchment). Over the lot, the HUD's Gold and Ale still in sight:
// - its name and level, a slim bar of its levels under them (gilt up to its level, lighter as far as the Castle lets it
//   go now, dark beyond), and the red square close;
// - a big picture of it at its level (its 3D model, as the lot draws it: views/realm-3d.js thumb) on a grass tile, and its blurb;
// - its numbers as tiles, each an icon, a label and a big value over a bar of how far along its kind's top level it is,
//   the next level's gain in green while it can go up (a mine's pile, a treasury's store, the army: how full instead).
//   Strength for every one; the hour's make and the pile for mines and breweries; capacity and how full for treasuries
//   and cellars; storage and what the next level unlocks for the Castle; damage a second, range and ground or air for
//   defenses; room (and the army in it) for war camps; the Dragon Hero's health and fire, and whether he's hatched, for
//   the hatchery (his level is its level); the troops for barracks; the builder for his hut;
//   how many walls; "Max level" at the top;
// - the chunky row at the bottom: Upgrade with its cost, or what stops it (red when there isn't enough, the Castle level
//   it waits for, the builder's job), beside the Upgrade time box; while it's going up, how far along and the time left;
//   Collect, Train or Heroes, and Move.
// A phone held upright has the picture on top and the tiles two across; a wide screen, side by side. cardHTML is a pure
// function of the realm (the checks read every card: _screens); showSel keeps the card's frame (and its picture, drawn
// once) while its insides are drawn again each second, so it slides in once and holds its place.
const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const CARD_IC = {
  hp: svg('<path d="M12 2.2l8.2 3v6.1c0 5.1-3.5 9.2-8.2 10.9-4.7-1.7-8.2-5.8-8.2-10.9V5.2z" fill="#8E1F2B" stroke="#E8C268" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 5l5.4 2v4.3c0 3.5-2.2 6.4-5.4 7.8z" fill="#C2414C"/><path d="M12 5v14.1" stroke="#F3D48A" stroke-width="1.2"/>'),
  dps: svg('<path d="M12 1.6l2.2 5.4 5.6-2.1-2.6 5.3 5.1 2.8-5.7 1.4 1.5 5.8-4.8-3.4-3.3 5-.6-5.9-5.9.2 4.2-4.1-4.1-4 5.8 1z" fill="#E98A1E" stroke="#6E2E06" stroke-width="1.1" stroke-linejoin="round"/><circle cx="12" cy="12.2" r="3.4" fill="#FFE59A"/>'),
  range: svg('<circle cx="12" cy="12" r="9.6" fill="#F7EEDD" stroke="#6E2027" stroke-width="1.5"/><circle cx="12" cy="12" r="6.3" fill="#B8323D"/><circle cx="12" cy="12" r="3.3" fill="#F7EEDD"/><circle cx="12" cy="12" r="1.3" fill="#6E2027"/><path d="M12 12l8.5-8.5M17.5 3.5h3v3" fill="none" stroke="#3B2A1D" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'),
  air: svg('<path d="M1.8 7.2C6 4 11.5 3 22.2 3.6c-1.6 1.3-2.3 3-2 5-1.8-.5-3.4-.2-4.6.9 1.4.5 2.3 1.6 2.6 3.2-1.8-.6-3.5-.4-5 .7 1 .8 1.5 2 1.4 3.6-1.8-1-3.6-1.2-5.4-.5C8.4 12.6 5.7 9.4 1.8 7.2z" fill="#A9C7D4" stroke="#1E3340" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 7.4l19.3-3.5M8.4 8.2l7.2 1.3M9.6 11.3l3.6 1.6" fill="none" stroke="#1E3340" stroke-width="1" stroke-linecap="round"/><path d="M3.5 7.2l-1.6 2.6 2.7-.9" fill="#E8C268" stroke="#1E3340" stroke-width=".9" stroke-linejoin="round"/>'),
  coinGold: '<i class="rl-coin" aria-hidden="true"></i>',
  coinGrain: '<i class="rl-coin is-grain" aria-hidden="true"></i>',
  chest: svg('<rect x="3" y="9.5" width="18" height="10.5" rx="1.6" fill="#8A5A2B" stroke="#3F2611" stroke-width="1.3"/><path d="M3 10.5C3 6.6 6 4.5 12 4.5s9 2.1 9 6z" fill="#A86E36" stroke="#3F2611" stroke-width="1.3"/><path d="M3 11h18" stroke="#E8C268" stroke-width="2"/><rect x="10" y="9.6" width="4" height="5.2" rx="1" fill="#F0C23E" stroke="#6E4C12" stroke-width=".9"/><path d="M7 4.9v15M17 4.9v15" stroke="#3F2611" stroke-width=".9" opacity=".6"/>'),
  barrel: svg('<path d="M6.5 2.8h11c1.8 3.2 1.8 15.2 0 18.4h-11c-1.8-3.2-1.8-15.2 0-18.4z" fill="#A8692E" stroke="#3F2611" stroke-width="1.3"/><path d="M5.2 8h13.6M5.2 16h13.6" stroke="#3B2A1D" stroke-width="1.9"/><path d="M9.5 3.2v17.6M14.5 3.2v17.6" stroke="#C98A46" stroke-width="1" opacity=".75"/>'),
  tent: svg('<path d="M12 3.2L2.4 20.5h19.2z" fill="#A82A33" stroke="#4A1015" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 3.2l-3.4 17.3h6.8z" fill="#F0E2BE"/><path d="M12 3.4V.9" stroke="#3B2A1D" stroke-width="1.4"/><path d="M12 .9l4.2 1.4L12 3.6z" fill="#F0C23E"/>'),
  helm: svg('<path d="M4.5 14.5C4.5 9 7.8 5 12 5s7.5 4 7.5 9.5V20h-5v-5.2h-5V20h-5z" fill="#B8BEC6" stroke="#333B44" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 5v9.8M8.3 11.2h7.4" stroke="#333B44" stroke-width="1.3"/><path d="M12 5c.6-2.2 2.5-3.4 5-3.4-.6 1.8-1.6 3-3.4 3.6" fill="#B8323D" stroke="#5A1018" stroke-width="1"/>'),
  swords: svg('<path d="M4 3l10.5 10.5M20 3L9.5 13.5" stroke="#D3D8DE" stroke-width="2.6" stroke-linecap="round"/><path d="M4 3l10.5 10.5M20 3L9.5 13.5" stroke="#5A626C" stroke-width="1" stroke-linecap="round"/><path d="M12.6 15.4l3.2-3.2M11.4 15.4l-3.2-3.2" stroke="#8A5A2B" stroke-width="2.4" stroke-linecap="round"/><path d="M15.6 16.5l3.6 3.6M8.4 16.5l-3.6 3.6" stroke="#E8C268" stroke-width="2.6" stroke-linecap="round"/>'),
  dragon: svg('<path d="M3 15.5c0-5 3.6-8.6 8.6-8.6 2 0 3.4.5 4.6 1.4l4.6.4-1.6 2.4 1.9 2.4-5.1.4c-.6 2.6-2.8 4.4-5.6 4.4H8.6l-2 3.6-1.2-3C4 18.4 3 17.2 3 15.5z" fill="#A82A33" stroke="#4A1015" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 7.4 6.4 3l3.6 3M12 6.9l.6-4.4 1.8 4.6" fill="#E8C268" stroke="#4A1015" stroke-width="1" stroke-linejoin="round"/><circle cx="14.2" cy="10.4" r="1.1" fill="#FFD25A"/>'),
  fire: svg('<path d="M12 2.2c1.2 3.4 5.6 5.6 5.6 11a5.6 5.6 0 0 1-11.2 0c0-2.6 1.3-4.3 2.6-5.6.2 1.8.9 3 2.2 3.6-.6-3.4.2-6.4.8-9z" fill="#E8641E" stroke="#6E2306" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 11.5c1.3 1.6 2.6 2.6 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.4.9-2.4 1.6-3.1.2.8.5 1.2 1 1.4z" fill="#FFD25A"/>'),
  egg: svg('<path d="M12 2.4c4.1 0 7.2 6.6 7.2 11.6a7.2 7.2 0 0 1-14.4 0C4.8 9 7.9 2.4 12 2.4z" fill="#5E8C3E" stroke="#22381A" stroke-width="1.3"/><path d="M7.4 13.2l2.3-1.7 2.3 1.7 2.3-1.7 2.3 1.7" fill="none" stroke="#E8D9A0" stroke-width="1.3" stroke-linejoin="round"/><circle cx="9.6" cy="7.6" r="1.2" fill="#A8CF7A"/><circle cx="14.6" cy="17.6" r="1.4" fill="#3E6A28"/>'),
  hammer: svg('<path d="M13.4 9.6l-9.1 9.1a1.8 1.8 0 0 0 2.6 2.6l9.1-9.1" fill="#8A5A2B" stroke="#3F2611" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.6 6l4.4-3.4 6.6 6.6-3.4 4.4-2.2-2.2-1.5 1.5-3.7-3.7 1.5-1.5z" fill="#B8BEC6" stroke="#333B44" stroke-width="1.3" stroke-linejoin="round"/>'),
  bricks: svg('<rect x="2.5" y="5" width="19" height="15" rx="1.2" fill="#A79A86" stroke="#3E362C" stroke-width="1.3"/><path d="M2.5 10h19M2.5 15h19M8.5 5v5M15.5 5v5M5.5 10v5M12 10v5M18.5 10v5M8.5 15v5M15.5 15v5" stroke="#3E362C" stroke-width="1.2"/>'),
  star: svg('<path d="M12 1.9l3 6.3 6.8.9-5 4.7 1.3 6.8L12 17.3l-6.1 3.3 1.3-6.8-5-4.7 6.8-.9z" fill="#F0C23E" stroke="#6E4C12" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 5.6l1.8 3.8" stroke="#FFF4BF" stroke-width="1.2" stroke-linecap="round"/>'),
  crown: svg('<path d="M3 8l4.6 4L12 4.5 16.4 12 21 8l-1.8 11H4.8z" fill="#F0C23E" stroke="#6E4C12" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.8 16.2h14.4" stroke="#6E4C12" stroke-width="1.2"/><circle cx="12" cy="13.2" r="1.5" fill="#B8323D"/>'),
  x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>')
};
const coinIC = c => (c === 'gold' ? CARD_IC.coinGold : CARD_IC.coinGrain);
const pct = f => `${(Math.max(0, Math.min(1, Number(f) || 0)) * 100).toFixed(1)}%`;
/** A stat tile: {k (its data-tile), ic, label, value (HTML; word: a word, not a number), unit, gain (the next level's,
 *  in green), next (whose gain, read out), note (HTML), bar: [now, with the next level] as parts of the kind's top
 *  (fill: how full, of gold or grain), chips: [{text, isNew, off, at}] (a list across the tile), wide, cls}. */
function tileHTML(t) {
  const [a, z] = t.bar || [0, 0];
  const bar = t.bar ? `<span class="rl-tile-bar${t.fill ? ` is-fill is-${t.fill}` : ''}" aria-hidden="true"><i style="width:${pct(a)}"></i>`
    + (z > a ? `<em style="left:${pct(a)};width:${pct(z - a)}"></em>` : '') + `</span>` : '';
  const chips = t.chips ? `<span class="rl-uchips">${t.chips.map(c => `<span class="rl-uchip${c.isNew ? ' is-new' : c.off ? ' is-off' : ''}">${esc(c.text)}`
    + (c.at ? `<small> · ${esc(c.at)}</small>` : '') + `</span>`).join('')}</span>` : '';
  return `<div class="rl-tile${t.wide || t.chips ? ' is-wide' : ''}${t.word ? ' is-word' : ''}${t.cls ? ' ' + t.cls : ''}" data-tile="${t.k}"><span class="rl-tile-ic" aria-hidden="true">${t.ic}</span>`
    + `<span class="rl-tile-t"><small>${esc(t.label)}</small>`
    + (t.value != null ? `<span class="rl-tile-v"><b>${t.value}</b>${t.unit ? `<span class="rl-tile-u">${esc(t.unit)}</span>` : ''}`
      + (t.gain ? `<em class="rl-tile-gain"><span class="sr-only">${esc(t.next)}: </span>${esc(t.gain)}</em>` : '') + `</span>` : '')
    + (t.note ? `<span class="rl-tile-note">${t.note}</span>` : '') + `</span>${bar}${chips}</div>`;
}
/** What the Castle's next level (to) opens: [{text, isNew}], the headline first (a land, raids, heroes, a new kind of
 *  building), then more of a building, then higher levels. */
function unlocksOf(to) {
  const top = [], more = [], lv = to - 1;
  F.SCENERIES.filter(x => x.at === to && !x.ownerOnly).forEach(x => top.push({text: `The ${features.available() && x.ownerName || x.name}`, isNew: true}));
  if (to === F.ATTACK_AT) top.push({text: 'Raids on the computer’s realms', isNew: true});
  F.HERO_ORDER.filter(k => !F.HEROES[k].hatch && F.HEROES[k].at === to).forEach(k => top.push({text: `The ${F.HEROES[k].name}`, isNew: true}));
  F.ORDER.forEach(k => {
    if (k === 'keep' || k === 'hut') return;
    const was = F.COUNT[k][lv - 1] || 0, n = (F.COUNT[k][to - 1] || 0) - was;
    if (n > 0) (was ? more : top).push(was ? {text: `+${n} ${F.KINDS[k].name}${n > 1 ? 's' : ''}`} : {text: F.KINDS[k].name, isNew: true});
  });
  // (higher levels for the kinds there were already)
  const had = F.ORDER.filter(k => k !== 'keep' && k !== 'hut' && (F.COUNT[k][lv - 1] || 0) > 0);
  const higher = had.filter(k => F.topLevel(k, to) > F.topLevel(k, lv)).length;
  if (higher) more.push({text: higher === had.length ? 'Higher levels for every building' : `Higher levels for ${higher} kind${higher === 1 ? '' : 's'} of building`});
  return top.concat(more);
}
/** Building b's stat tiles on realm s at now. */
function tilesOf(s, b, now) {
  const K = F.KINDS[b.t], lv = Math.max(1, b.l), top = F.maxLevel(b.t), a = F.stat(b.t, lv), z = F.stat(b.t, top);
  // (the next level's numbers, while it can go up: idle, built, not at its top)
  const n = b.u <= now && b.l >= 1 && lv < top && b.t !== 'hut' ? F.stat(b.t, lv + 1) : null, next = `Level ${lv + 1}`;
  const scaled = (k, ic, label, key, unit = '') => ({k, ic, label, value: nf(a[key]), next,
    gain: n && n[key] > a[key] ? `+${nf(n[key] - a[key])}${unit}` : '', bar: [a[key] / (z[key] || 1), (n ? n[key] : a[key]) / (z[key] || 1)]});
  const full = (have, of) => [of ? have / of : 0, of ? have / of : 0];
  const tiles = [scaled('hp', CARD_IC.hp, 'Strength', 'hp')];
  if (K.role === 'make') {
    const pile = F.made(b, now), c = K.makes;
    tiles.push(scaled('rate', coinIC(c), `${F.CUR_NAME[c]} per hour`, 'rate', '/hour'));
    // (the next level's gain is room, not more in the pile: said so)
    tiles.push({k: 'pile', ic: CARD_IC[c === 'gold' ? 'chest' : 'barrel'], label: 'Capacity', value: `${nf(pile)} / ${nf(a.hold)}`, next,
      gain: n ? `+${nf(n.hold - a.hold)} room` : '', bar: full(pile, a.hold), fill: c, wide: true,
      note: b.u > now ? (b.l < 1 ? 'Starts once it’s up' : 'Paused while it’s upgraded') : pile >= a.hold ? 'Full: collect it' : pile >= 1 ? 'Ready to collect' : ''});
  } else if (K.role === 'store') {
    // (the store is one pool, the Castle's and every treasury's or cellar's together: the HUD's own figure, not a share
    // made up for this one)
    const c = K.holds, all = F.capOf(s)[c], have = s.r[c];
    tiles.push(scaled('cap', CARD_IC[c === 'gold' ? 'chest' : 'barrel'], 'Capacity', 'cap'));
    tiles.push(F.testing(s) ? {k: 'stored', ic: coinIC(c), label: `All your ${F.CUR_NAME[c]}`, value: 'Unlimited', word: true, note: 'While testing', bar: [1, 1], fill: c, wide: true}
      : {k: 'stored', ic: coinIC(c), label: `All your ${F.CUR_NAME[c]}`, value: `${nf(have)} / ${nf(all)}`, bar: full(have, all), fill: c, wide: true,
        note: b.l < 1 ? 'Holds nothing till it’s up' : `${have >= all ? 'Full · ' : ''}Kept in the Castle and every ${K.name} together`});
  } else if (K.role === 'hall') {
    tiles.push(scaled('store', CARD_IC.chest, 'Storage, each', 'store'));
    if (lv < top) tiles.push({k: 'unlocks', ic: CARD_IC.star, label: `Castle level ${lv + 1} unlocks`, chips: unlocksOf(lv + 1)});
  } else if (K.role === 'def') {
    tiles.push(scaled('dps', CARD_IC.dps, 'Damage/second', 'dps', '/second'));
    tiles.push({k: 'range', ic: CARD_IC.range, label: 'Range', value: a.range, unit: 'tiles', note: a.min ? `Can’t hit within ${a.min}` : `A shot every ${a.every}s`});
    tiles.push({k: 'targets', ic: a.air ? CARD_IC.air : CARD_IC.helm, label: 'Targets', value: a.air ? 'Ground &amp; air' : 'Ground only', word: true, note: a.splash ? 'Hits a crowd' : 'One at a time'});
  } else if (K.role === 'camp') {
    const have = F.roomOf(s.ar) + F.queued(s), room = F.armyRoom(s);
    tiles.push(scaled('room', CARD_IC.tent, 'Army room', 'room'));
    tiles.push({k: 'army', ic: CARD_IC.helm, label: 'Your army, all camps', value: `${nf(have)} / ${nf(room)}`, bar: full(have, room), fill: 'grain', wide: true,
      note: b.l < 1 ? 'Room once it’s up' : ''});
  } else if (K.role === 'hatch') {
    // (the Dragon Hero's, Oct 22 2026: his level is the hatchery's, core/realm.js HEROES.dragon; his health and his
    // fire at this level, the next level's in green, and whether he's hatched: "Dragon Hero · Hatched · Level N")
    const chosen = F.dragonOfBuilding(s, b), key = chosen ? chosen.hero : 'dragon', rules = chosen ? F.RULES_V : 2;
    const d = F.heroStat(key, lv, rules), dz = F.heroStat(key, top, rules), dn = n ? F.heroStat(key, lv + 1, rules) : null;
    const hero = (k, ic, label, key, unit = '') => ({k, ic, label, value: nf(d[key]), next,
      gain: dn && dn[key] > d[key] ? `+${nf(dn[key] - d[key])}${unit}` : '', bar: [d[key] / (dz[key] || 1), (dn ? dn[key] : d[key]) / (dz[key] || 1)]});
    // (labels a line long, as the other cards' are, so a row's values sit level: Oct 23 2026, "Dragon Hero health" and
    // "Fire damage/second" ran to two lines at a phone's width; the egg tile beside them says whose they are)
    tiles.push(hero('herohp', CARD_IC.dragon, 'Hero health', 'hp'), hero('herodps', CARD_IC.fire, 'Damage/second', 'dps', '/second'));
    const level = b.l >= 1 ? b.l : 0;
    tiles.push(chosen ? {k: 'hatched', ic: CARD_IC.egg, label: chosen.name, value: level ? `Level ${level}` : 'In the egg', word: true,
      note: `${colorName(chosen.color)} · ${chosen.fly ? 'Flying' : 'Ground'} dragon`}
      : {k: 'hatched', ic: CARD_IC.egg, label: 'Your dragon', value: 'Choose a dragon', word: true, note: 'Choose its species and color'});
  } else if (K.role === 'train') {
    const open = F.TROOP_ORDER.filter(t => F.TROOPS[t].at <= lv), soon = n ? F.TROOP_ORDER.filter(t => F.TROOPS[t].at === lv + 1) : [], all = F.TROOP_ORDER.length;
    tiles.push({k: 'troops', ic: CARD_IC.helm, label: 'Kinds of soldier', value: open.length, unit: `of ${all}`, next,
      gain: soon.length ? `+${soon.map(t => F.TROOPS[t].name).join(', ')}` : '', bar: [open.length / all, (open.length + soon.length) / all]});
    tiles.push({k: 'trains', ic: CARD_IC.swords, label: 'Trains',
      chips: F.TROOP_ORDER.map(t => { const T = F.TROOPS[t]; return T.at <= lv ? {text: T.name} : {text: T.name, isNew: soon.includes(t), off: true, at: `level ${T.at}`}; })});
  } else if (K.role === 'builder') {
    const job = s.b.filter(x => x.u > now).sort((x, y) => x.u - y.u)[0];
    tiles.push({k: 'builder', ic: CARD_IC.hammer, label: 'Your builder', value: job ? 'At work' : 'Free', word: true,
      note: job ? `${job.l < 1 ? 'Raising' : 'Upgrading'} the ${esc(F.KINDS[job.t].name)} · ${dur(job.u - now)} left` : 'Ready for the next job'});
  } else if (K.role === 'wall') {
    const have = F.countOf(s, 'wall'), cap = F.allowed(s, 'wall');
    tiles.push({k: 'walls', ic: CARD_IC.bricks, label: 'Walls built', value: `${nf(have)} / ${nf(cap)}`, bar: full(have, cap), fill: 'gold'});
  }
  if (lv >= top) tiles.push({k: 'max', ic: CARD_IC.crown, label: `Level ${lv} of ${top}`, value: 'Max level', word: true, cls: 'is-max'});
  // (an odd one out at the end takes the whole row)
  const small = tiles.filter(t => !t.wide && !t.chips);
  if (small.length % 2) small[small.length - 1].wide = true;
  return tiles;
}
/** What the builder's at, when he's busy: why another upgrade waits. */
const busyWhy = (s, now) => { const job = s.b.find(x => x.u > now); return job ? `Your builder is busy on the ${F.KINDS[job.t].name}` : 'Your builder is busy'; };
/** Building b's bottom row: its upgrade (or how far along it is), then Collect, Train or Heroes, and Move. */
function cardFootHTML(s, b, now, overlap = 0) {
  const K = F.KINDS[b.t], up = F.canUpgrade(s, b.i, now), top = F.maxLevel(b.t), rows = [];
  if (b.u > now) {
    const total = (b.l < 1 ? K.time[0] : K.time[b.l]) * 1000 || 1, f = Math.max(0, Math.min(1, 1 - (b.u - now) / total));
    const what = b.l < 1 ? 'Under construction' : `Upgrading to level ${b.l + 1}`;
    rows.push(`<div class="rl-card-up-row"><div class="rl-card-prog" data-rl-card-prog role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(f * 100)}" aria-label="${what}: ${dur(b.u - now)} left">`
      + `<span class="rl-card-prog-k">${CARD_IC.hammer}${what}</span><span class="rl-card-prog-bar" aria-hidden="true"><i style="width:${pct(f)}"></i></span></div>`
      + `<div class="rl-card-time"><small>Time left</small><b>${dur(b.u - now)}</b></div></div>`);
  } else if (b.t !== 'hut' && up.to <= top) {
    const short = /^Not enough/.test(up.why), need = /Castle level/.test(up.why) ? K.th[up.to - 1] : 0, busy = /builder is busy/.test(up.why);
    const why = need ? `Castle level ${need} to upgrade` : short ? `${up.why} · ${nf(up.cost - s.r[up.pay])} more` : busy ? busyWhy(s, now) : up.why;
    // (as Clash: short of it, the gold button stays with its cost in red; waiting on the Castle, dark with its lock; on
    // the builder, plain wood)
    rows.push(`<div class="rl-card-up-row"><button type="button" class="rl-card-up ${up.ok ? 'is-go' : 'is-off'}${short ? ' is-short' : ''}${need ? ' is-locked' : ''}${busy ? ' is-busy' : ''}" data-rl-up="${b.i}" data-rl-focus="up"${up.ok ? '' : ' aria-disabled="true"'}>`
      + `<span class="rl-card-up-k">${need ? ui.icon('lock') : ''}Upgrade<span class="sr-only"> to level ${up.to}</span></span>`
      + `<span class="rl-card-up-c">${curHTML(up.pay, up.cost)}</span>${up.ok ? '' : `<small>${esc(why)}</small>`}</button>`
      + `<div class="rl-card-time"><small>Upgrade time</small><b>${up.time ? dur(up.time * 1000) : 'At once'}</b></div></div>`);
  }
  const acts = [], pile = K.role === 'make' ? F.made(b, now) : 0;
  if (pile > 0) acts.push(`<button type="button" class="rl-card-btn is-collect" data-rl-collect="${b.i}" data-rl-card-collect data-rl-focus="collect">Collect ${curHTML(K.makes, pile)}</button>`);
  if (b.t === 'barracks' || b.t === 'camp') acts.push(`<button type="button" class="rl-card-btn" data-rl-army data-rl-focus="army">Train</button>`);
  // (the hatchery's: its Dragon Hero, on the Army sheet's hero cards)
  if (b.t === 'hatchery') acts.push(`<button type="button" class="rl-card-btn" data-rl-dragon="${b.i}" data-rl-focus="dragon">${F.dragonOfBuilding(s, b) ? 'Dragon color' : 'Choose dragon'}</button>`);
  if (b.t === 'keep') acts.push(`<button type="button" class="rl-card-btn" data-rl-army data-rl-focus="army">Heroes</button>`);
  acts.push(`<button type="button" class="rl-card-btn" data-rl-move="${b.i}" data-rl-focus="move">Move</button>`);
  rows.push(`<div class="rl-card-acts">${acts.join('')}</div>`);
  if (overlap > 1) rows.push(`<button type="button" class="rl-overlap rl-card-btn" data-rl-overlap data-rl-focus="overlap">Choose overlapping building (${overlap})</button>`);
  return `<footer class="rl-card-foot" data-rl-part="foot">${rows.join('')}</footer>`;
}
/** Building id's card on realm s at now (its insides: cardShell holds them). overlap: how many buildings share the spot
 *  tapped. */
function cardHTML(s, id, now, overlap = 0) {
  const b = s.b.find(x => x.i === id);
  if (!b) return '';
  const K = F.KINDS[b.t], lv = Math.max(1, b.l), top = F.maxLevel(b.t), allow = Math.min(top, Math.max(b.l, F.topLevel(b.t, F.keepOf(s))));
  // (the levels' bar: a notch a level, gilt to its level, hatched as far as the Castle lets it go now, and "2/10" at
  // its end)
  const lvbar = `<span class="rl-card-lv"><span class="rl-card-lvbar" style="--n:${top}" role="img" aria-label="${b.l < 1 ? 'Going up to level 1' : `Level ${b.l}`} of ${top}${allow < top ? `; up to ${allow} at Castle level ${F.keepOf(s)}` : ''}">`
    + (allow > b.l ? `<u style="width:${pct(allow / top)}"></u>` : '') + `<i style="width:${pct(Math.max(0, b.l) / top)}"></i></span>`
    + `<small aria-hidden="true">${Math.max(0, b.l)}/${top}</small></span>`;
  // (a level the Castle doesn't allow yet: its gains muted, they can't be had now)
  const wait = b.u <= now && b.t !== 'hut' && b.l >= 1 && b.l < top && /Castle level/.test(F.canUpgrade(s, b.i, now).why);
  const raising = b.l < 1 && b.u > now;
  return `<header class="rl-card-h" data-rl-part="h"><h2 class="rl-card-t${K.name.length > 13 ? ' is-long' : ''}" id="rl-card-t"><span>${esc(K.name)}</span> <em>${b.l < 1 ? 'Going up' : `Level ${b.l}`}</em></h2>${lvbar}`
    + `<button type="button" class="rl-card-x" data-rl-unsel data-rl-focus="x" aria-label="Close">${CARD_IC.x}</button></header>`
    + `<div class="rl-card-body"><div class="rl-card-side" data-rl-part="side"><div class="rl-card-stage${raising ? ' is-raising' : ''}">`
    + `<span class="rl-card-art${b.t === 'wall' ? ' is-small' : ''}" data-rl-art="${b.t}:${lv}" role="img" aria-label="${esc(K.name)}, level ${lv}${raising ? ', under construction' : ''}"></span>`
    + (b.u > now && !raising ? `<span class="rl-card-badge">${CARD_IC.hammer}Upgrading</span>` : '')
    + `</div><p class="rl-card-blurb">${esc(K.blurb)}</p></div>`
    + `<div class="rl-card-tiles${wait ? ' is-wait' : ''}" data-rl-part="tiles">${tilesOf(s, b, now).map(tileHTML).join('')}</div></div>`
    + cardFootHTML(s, b, now, overlap);
}
/** The card's frame (kept while it's open): the shade over the lot (a tap there closes it) and the panel. */
const cardShell = id => `<div class="rl-card-scrim" data-rl-scrim aria-hidden="true"></div>`
  + `<section class="rl-card" data-rl-card="${id}" role="dialog" aria-modal="false" aria-labelledby="rl-card-t" tabindex="-1"><div class="rl-card-in" data-rl-card-in></div></section>`;
const selHTML = st => cardHTML(F.mine(), st.sel, Date.now(), st.overlap?.length || 0);
/** The bar while a building's being moved: what, Done (as a tap on the lot: its card again) and the close (none). */
function movingHTML(s, id) {
  const b = s.b.find(x => x.i === id);
  if (!b) return '';
  // (in the card's dress: its gilt rim, the red close and a gold Done)
  return `<div class="rl-card is-bar"><div class="rl-card-bar-h"><div class="rl-card-bar-t"><b>${esc(F.KINDS[b.t].name)}</b><small>Drag it where it goes</small></div>`
    + `<button type="button" class="rl-card-x" data-rl-unsel aria-label="Close">${CARD_IC.x}</button></div>`
    + `<button type="button" class="rl-card-up is-go is-done" data-rl-moved><span class="rl-card-up-k">Done</span></button></div>`;
}
// (the card's picture: the building's 3D model at its level, rendered once and kept, so the card drawn again each second
// doesn't render it again)
const ART = new Map();
function artOf(key) {
  if (ART.has(key)) return ART.get(key);
  if (!D3 || !D3.ready() || !F.mayPlay()) return null;
  const [k, l] = key.split(':'), lv = Math.max(1, +l || 1);
  const url = D3.thumb(k, lv, MY_HOUSE, false, {w: 576, h: 360});
  if (!url) return null;
  const im = new Image();
  im.alt = ''; im.draggable = false; im.decoding = 'async'; im.src = url;
  ART.set(key, im);
  return im;
}
function fillArt(root) {
  root.querySelectorAll('[data-rl-art]').forEach(slot => {
    if (slot.firstElementChild) return;
    const im = artOf(slot.dataset.rlArt);
    if (im) { slot.appendChild(im); slot.classList.add('has-art'); }
  });
}
function showSel(st) {
  objective(st);
  const box = st.el.querySelector('[data-rl-sel]'), bar = st.el.querySelector('[data-rl-bar]'), s = F.mine();
  // (a building gone from under its card, the realm taken up from another phone: nothing chosen)
  if (st.sel != null && !st.place && !s.b.some(x => x.i === st.sel)) {
    st.sel = st.moving = null; st.overlap = [];
    if (st.v) { st.v.select(null); st.v.showGrid(false); }
  }
  const mode = st.place ? 'place' : st.sel == null ? '' : st.moving != null ? 'move' : 'card';
  // (a card on its way out, stopped: something's shown again)
  if (st.leaving && mode) { const was = st.leaving; st.leaving = null; was.forEach(a => a.cancel()); box.classList.remove('is-leaving'); }
  if (!mode && (st.leaving || (!box.hidden && box.classList.contains('is-card')))) {
    // (a card closed: it pops out, a quick fade and drop (a fade alone with reduced motion), and then the box hides; the
    // lot's buttons are back at once, and the focus with them)
    bar.hidden = false;
    if (st.leaving) return;
    const lost = box.contains(document.activeElement);
    st.boxHTML = ''; st.cardHTML = null;
    box.classList.add('is-leaving');
    const anims = [
      ui.animate(box.querySelector('[data-rl-card]'), [{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'translateY(12px) scale(.98)'}], {duration: 140, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'}),
      ui.animate(box.querySelector('[data-rl-scrim]'), [{opacity: 1}, {opacity: 0}], {duration: 160, easing: 'ease-in', fill: 'forwards'})
    ];
    st.leaving = anims;
    const gone = () => {
      if (st.leaving !== anims) return;
      st.leaving = null;
      if (st.dead) return;
      box.hidden = true; box.innerHTML = ''; box.classList.remove('is-card', 'is-leaving');
    };
    Promise.all(anims.map(a => a.finished)).then(gone, () => {});
    // (and should a hidden tab hold its animations back)
    const timer = setTimeout(() => { st.effects.delete(timer); gone(); }, 400);
    st.effects.add(timer);
    if (lost) st.el.querySelector('[data-rl-buildings]')?.focus({preventScroll: true});
    return;
  }
  box.hidden = !mode; bar.hidden = !!mode;
  box.classList.toggle('is-card', mode === 'card');
  box.classList.toggle('is-moving', mode === 'move');
  if (mode !== 'card') {
    const html = mode === 'place' ? placeHTML(s, st.place) : mode === 'move' ? movingHTML(s, st.moving) : '';
    if (st.boxHTML !== html) {
      // (the focus kept from a card closed or moved: Done, or the Buildings button, where another is chosen)
      const lost = box.contains(document.activeElement);
      st.boxHTML = html; st.cardHTML = null; box.innerHTML = html;
      if (lost && mode !== 'place') (box.querySelector('button') || st.el.querySelector('[data-rl-buildings]'))?.focus({preventScroll: true});
    }
    return;
  }
  // the card: its frame once (it slides in), its insides whenever they change (a clock, a pile), the focus and the
  // scroll kept
  let shell = box.querySelector(`[data-rl-card="${st.sel}"]`);
  const opened = !shell;
  if (opened) {
    box.innerHTML = cardShell(st.sel); st.boxHTML = null; st.cardHTML = null;
    shell = box.querySelector('[data-rl-card]');
  }
  const html = selHTML(st);
  if (st.cardHTML !== html) {
    // (only its parts that changed are drawn again: the head, the picture, the tiles, the bottom row; so the picture
    // isn't taken out and put back each second while a clock runs, which can blank it for a frame on a phone)
    const el = document.activeElement, had = box.contains(el) ? el.dataset.rlFocus : '';
    const inner = shell.querySelector('[data-rl-card-in]'), tpl = document.createElement('template');
    tpl.innerHTML = html;
    const parts = [...tpl.content.querySelectorAll('[data-rl-part]')], live = [...inner.querySelectorAll('[data-rl-part]')];
    const strs = parts.map(p => p.outerHTML), was = st.cardParts || [];
    if (st.cardHTML != null && parts.length === live.length && parts.every((p, i) => live[i].dataset.rlPart === p.dataset.rlPart)) {
      parts.forEach((p, i) => { if (was[i] !== strs[i]) live[i].replaceWith(p); });
    } else {
      const body = inner.querySelector('.rl-card-body'), top = body ? body.scrollTop : 0;
      inner.replaceChildren(tpl.content);
      if (top) inner.querySelector('.rl-card-body').scrollTop = top;
    }
    st.cardHTML = html; st.cardParts = strs;
    if (had && !box.contains(document.activeElement)) shell.querySelector(`[data-rl-focus="${had}"]`)?.focus({preventScroll: true});
  }
  fillArt(shell);
  if (opened) {
    shell.focus({preventScroll: true});
    ui.animate(shell, [{opacity: 0, transform: 'translateY(28px) scale(.97)'}, {opacity: 1, transform: 'none'}], {spring: 'smooth'});
    ui.animate(box.querySelector('.rl-card-scrim'), [{opacity: 0}, {opacity: 1}], {duration: 220, easing: 'ease-out'});
  }
}
/** A move done (Done, or a tap on the lot): the building's card again. */
function endMove(st) {
  st.moving = null;
  if (st.v) st.v.showGrid(false);
  select(st, st.sel);
}
/** The card while something new is being placed ({t, ok, run}: its kind, whether where it is now fits, and for a run of
 *  walls their tiles), walls with how many go down at once. */
function placeHTML(s, place) {
  const K = F.KINDS[place.t], chk = F.canBuild(s, place.t);
  const n = place.run ? place.run.length : 1, cost = chk.cost * n;
  const why = !chk.ok ? chk.why : !F.testing(s) && cost > s.r[chk.pay] ? `Not enough ${F.CUR_NAME[chk.pay]}` : !place.ok ? 'It doesn’t fit there' : '';
  let qty = '';
  if (place.t === 'wall') {
    const steps = wallSteps(s), i = steps.indexOf(n);
    qty = `<div class="rl-qty"><button type="button" class="rl-qty-b" data-rl-qty="-1" aria-label="Fewer walls" ${i > 0 ? '' : 'disabled'}>−</button>`
      + `<span class="rl-qty-n"><b>${n}</b> wall${n === 1 ? '' : 's'}</span>`
      + `<button type="button" class="rl-qty-b" data-rl-qty="1" aria-label="More walls" ${i < steps.length - 1 ? '' : 'disabled'}>+</button>`
      + (n > 1 ? `<button type="button" class="rl-qty-b is-turn" data-rl-turn>Turn</button>` : '') + `</div>`;
  }
  return `<div class="rl-sel-h"><div><b>${esc(K.name)}</b><span class="rl-sel-lv">${n > 1 ? 'Drag the line where it goes' : 'Drag it where it goes'}</span></div></div>`
    + (place.dragon ? `<p class="rl-sh-note">${esc(F.DRAGONS[place.dragon.species].name)} · ${colorName(place.dragon.color)}</p>` : '')
    + qty
    + `<div class="rl-acts"><button type="button" class="rl-act" data-rl-cancel>Cancel</button>`
    + `<button type="button" class="rl-act is-go" data-rl-place ${why ? 'disabled' : ''}>Build ${curHTML(chk.pay, cost)}<small>${why ? esc(why) : chk.time && place.t !== 'hut' ? dur(chk.time * 1000) : 'at once'}</small></button></div>`;
}
function select(st, id, overlap = []) {
  st.sel = id; st.moving = null; st.overlap = overlap;
  if (st.v) { st.v.select(id); st.v.showGrid(false); }
  showSel(st);
  tags(st);
}

// Every placed object remains reachable even when its entire picture is hidden.
function buildingsSheet(st, ids = null) {
  if (st.place || st.dead || !F.mayPlay()) return;
  const buildings = F.mine().b.filter(b => !ids || ids.includes(b.i));
  const body = '<p class="rl-sh-lead">Choose a building to reveal it, view its details or move it.</p><div class="rl-building-list">'
    + buildings.map(b => '<button type="button" class="rl-building-row" data-rl-find="' + b.i + '"><span class="rl-building-pic" aria-hidden="true">' + picOf(b.t, MY_HOUSE) + '</span><span><b>' + esc(F.KINDS[b.t].name) + '</b><small>' + (b.l ? 'Level ' + b.l : 'Going up') + '</small></span><span aria-hidden="true">›</span></button>').join('') + '</div>';
  // (closed by choosing one, the focus goes to its card)
  const sh = realmSheet({title: ids ? 'Overlapping buildings' : 'Your buildings', cls: 'sh-rl', detents: ['large'], body,
    returnFocus: () => st.el.querySelector('[data-rl-card]')});
  sh.body.addEventListener('click', event => {
    const button = event.target.closest('[data-rl-find]');
    if (!button || st.dead || !F.mayPlay()) return;
    const b = F.mine().b.find(b => b.i === +button.dataset.rlFind);
    if (!b) return;
    sh.close();
    const size = F.KINDS[b.t].size;
    if (st.v) st.v.look(b.x + size / 2, b.y + size / 2, Math.min(42, st.v.zoom));
    select(st, b.i, ids || []);
  });
}

// ---- keeping it all current
function refresh(st) {
  if (st.dead || !F.mayPlay()) return;
  const s = F.mine(), now = Date.now();
  // (past midnight a ranked game's day is over: its place pays, and today's games start again; and a realm that began
  // on another day than the pay was worked out for, one taken up from the board or started over, is paid from its own)
  if (EARNED_DAY && (EARNED_DAY !== F.dayKey(now) || EARNED.from !== s.born)) earned();
  const got = F.claim(s, EARNED.total);
  // (a day's place, once paid, frozen: a late post on its board can't take it back; after sync, so it's on the realm
  // that's kept)
  const froze = F.freezePaid(s, EARNED.fresh);
  if (got.gold || got.grain || froze) F.touch();
  if (st.v) st.v.setLot(s, {now, house: MY_HOUSE});
  hud(st);
  tags(st);
  if (st.sel != null && !st.place) showSel(st);
}
// The board's copy of your realm taken up (the first time it shows, or newer from your other phone), and the raids on
// it since you last looked played (while Keepfall is on screen).
function synced(st) {
  if (st.dead || !F.mayPlay()) return;
  const took = F.sync();
  refresh(st);
  if (took && st.ctx.visible) defenses(st);
  examplesOnce(st);
}
// The example raids (the owner's ask, Oct 22 2026), made once on the realm the board keeps (core/realm-battle.js
// ensureExamplesAsync: never again by themselves once made or cleared), a moment after Keepfall is up: played a slice at
// a time (at once, they held Keepfall still for seconds), and put on the realm as it is when they're done, only while
// Keepfall is still open on the owner's phone.
function examplesOnce(st) {
  if (st.exAsked || st.dead || !F.mayPlay() || !daily.LB.ready) return;
  st.exAsked = true;
  const t = setTimeout(() => {
    st.effects.delete(t);
    if (st.dead || !F.mayPlay()) return;
    const run = ensureExamplesAsync(F.mine(), Date.now(), {still: () => !st.dead && F.mayPlay(), into: () => F.mine(), dragonDemo: F.dragonExamplesForMe()});
    if (LOG_DRAW) LOG_DRAW();
    run.then(made => { if (made && !st.dead && F.mayPlay()) F.touch(); }, e => console.error(e)).finally(() => { if (LOG_DRAW) LOG_DRAW(); });
  }, 1500);
  st.effects.add(t);
}
// (the Chronicle open now: its redraw, for the example raids made meanwhile)
let LOG_DRAW = null;
// The computer's raids on your realm since you last looked: played, taken off it, and told.
function defenses(st) {
  if (st.dead || !st.ctx.visible || !F.mayPlay() || st.lore) return;
  const s = F.mine(), done = defend(s);
  if (!done.length) return false;
  F.touch();
  refresh(st);
  realmSheet({title: 'While you were away', cls: 'sh-rl', detents: ['large'], body: awayHTML(done, F.mine(), Date.now())});
  return true;
}
/** The raids on your realm just played (defend()'s records), and what they mean. */
function awayHTML(done, s, now) {
  const lost = done.filter(r => r.st > 0);
  return done.map(r => `<div class="rl-log"><span>${starsHTML(r.st)}</span><span class="rl-log-t"><span><b>${esc(r.by)}</b> ${r.st ? `broke through and took ${curHTML('gold', r.lt[0])} ${curHTML('grain', r.lt[1])}` : 'were driven off'}</span><small>${ago(r.at)} · ${r.pc}% of your realm knocked down · ${r.td > 0 ? '+' : ''}${r.td} glory</small></span></div>`).join('')
    + `<p class="rl-sh-note">${lost.length ? `A truce holds for ${s.sh > now ? dur(s.sh - now) : 'a while'}: no one raids you while it lasts. Stronger walls and towers, and your treasuries and cellars kept behind them, keep more of your gold and ale.` : 'Your defenses held.'} Your coffers are never touched.</p>`;
}

// ---------------------------------------------------------------------------------------------------- sheets
function cofferSheet() {
  realmSheet({title: 'The coffers', cls: 'sh-rl', detents: ['large'], body: cofferHTML(F.mine(), EARNED)});
}
/** How a game's pay stands today (E: incomeOf()): a ranked game's place right now (its Ale paid tomorrow if it holds)
 *  and yesterday's, paid this morning; Kick It's and Return Man's Gold, paid as soon as the run's on the board; on a
 *  game's last day of the old pay, that day's in both and what tomorrow brings. {lines, got ([{c, n}]: what came in
 *  today)}. */
export function payToday(g, E) {
  const t = (E.today || {})[g], n = (E.day || {})[g] || 0, from = F.NEW_PAY[g], lines = [], got = [];
  // (today's run as its entries have it, runsOf: Kick It's makes, Return Man's first-run coins; never the Gold worked
  // back, which carries the run's base pay)
  const run = Object.assign({}, t || {}, ((E.runs || {})[g]) || {});
  const NEXT = {kick: `a run pays ${nf(F.KICK_BASE)} Gold, and ${nf(F.KICK_GOLD)} more every ${ordinal(F.KICK_EVERY)} make`, return: `a run pays ${nf(F.RETURN_BASE)} Gold, and ${F.COIN_GOLD} a coin on your first run`};
  if (n && n < from) {
    // (a game's last days of the old pay: the day's result in both)
    if (t && (t.gold || t.grain)) { lines.push('Paid the old way: Gold and Ale alike'); got.push({c: 'gold', n: t.gold}, {c: 'grain', n: t.grain}); }
    else lines.push('Not played yet');
    if (n === from - 1) lines.push(`From tomorrow: ${NEXT[g] || 'your place on its board pays Ale'}`);
  } else if (F.RANKED.includes(g)) {
    const q = (E.pending || {})[g], l = (E.last || {})[g];
    lines.push(q ? `#${q.place} right now · ${nf(q.grain)} Ale tomorrow if it holds` : 'Not played yet: your place pays Ale tomorrow');
    if (t && t.grain) { got.push({c: 'grain', n: t.grain}); lines.push(`${l ? `#${l.place} yesterday` : 'Yesterday’s place'}: paid this morning`); }
  } else if (g === 'kick') {
    if (t && t.gold) got.push({c: 'gold', n: t.gold});
    const m = Number.isInteger(run.m) && run.m >= 0 ? run.m : null;
    lines.push(!t ? `Not played yet: ${NEXT.kick}`
      : m == null ? 'Your run is in'
        : `${nf(m)} make${m === 1 ? '' : 's'} on your run${m > F.KICK_MOST ? ` (the first ${F.KICK_MOST} pay)` : m < F.KICK_EVERY ? ': the base pay' : ''}`);
  } else {
    if (t && t.gold) got.push({c: 'gold', n: t.gold});
    const c = Number.isInteger(run.c) && run.c >= 0 ? run.c : null;
    lines.push(!t ? `Not played yet: ${NEXT.return}`
      : c == null ? 'Your run is in'
        : c ? `${nf(c)} coin${c === 1 ? '' : 's'} on your first run${c > F.COIN_PAID_MAX ? ` (the first ${F.COIN_PAID_MAX} pay)` : ''}` : 'No coins on your first run today: the base pay');
  }
  return {lines, got};
}
/** Today's runs as their entries have them (docs: the owner's board docs; mods: the loaded game cores; day: incomeOf's
 *  day numbers): {kick: {m: the makes on the run that counts, the day's first finished}, return: {c: the coins on the
 *  day's first run, Return Man's own reading, dayCoins}}, each only when there's one. For payToday (E.runs). */
export function runsOf(docs, mods, day) {
  const out = {}, list = (docs || []).filter(p => p && typeof p === 'object'), kk = mods && mods.kk, rm = mods && mods.rm;
  if (kk && typeof kk.entryOf === 'function' && day && day.kick) {
    const first = list.map(p => { try { return {e: kk.entryOf(p, day.kick), p}; } catch (_) { return {e: null, p}; } }).filter(x => x.e)
      .sort((a, b) => (a.e.t || 0) - (b.e.t || 0) || (String(a.p.id) < String(b.p.id) ? -1 : 1))[0];
    if (first && Number.isInteger(first.e.m)) out.kick = {m: first.e.m};
  }
  if (rm && day && day.return) {
    let c = null;
    try {
      if (typeof rm.dayCoins === 'function') c = list.some(p => rm.entryOf && rm.entryOf(p, day.return)) ? rm.dayCoins(list, day.return) : null;
      else if (typeof rm.entryOf === 'function') c = list.reduce((m, p) => { const e = rm.entryOf(p, day.return); return e ? Math.max(m || 0, Number.isInteger(e.c) ? e.c : 0) : m; }, null);
    } catch (_) { c = null; }
    if (Number.isInteger(c)) out.return = {c};
  }
  return out;
}
/** The coffers: how the games pay, what's waiting for room, today's pay, what's in store, what the games have paid
 *  since the realm began (E: incomeOf(), from its born: count from the start day, Oct 22 2026). */
function cofferHTML(s, E) {
  const tot = E.total || {gold: 0, grain: 0}, p = F.pending(s, tot), cap = F.capOf(s), by = E.by || {}, games = Object.keys(F.GAME_NAME);
  const today = games.map(g => {
    const {lines, got} = payToday(g, E);
    return `<div class="rl-row is-pay"><span class="rl-pay-t"><b>${esc(F.GAME_NAME[g])}</b>${lines.map(l => `<small>${esc(l)}</small>`).join('')}</span>`
      + `<span class="rl-row-v">${got.length ? `<em class="rl-pay-got">+</em>${got.map(x => curHTML(x.c, x.n)).join('')}` : ''}</span></div>`;
  }).join('');
  const cells = v => F.CUR.map(c => `<span role="cell">${curHTML(c, (v && v[c]) || 0)}</span>`).join('');
  const ledger = `<div class="rl-ledger" role="table" aria-label="What the games have paid since your realm began">`
    + `<div class="rl-lg-row is-head" role="row"><span role="columnheader">Game</span>${F.CUR.map(c => `<span role="columnheader">${F.CUR_NAME[c]}</span>`).join('')}</div>`
    + games.map(g => `<div class="rl-lg-row" role="row"><span role="cell">${esc(F.GAME_NAME[g])}</span>${cells(by[g])}</div>`).join('')
    + `<div class="rl-lg-row is-sum" role="row"><span role="cell">All told</span>${cells(tot)}</div></div>`;
  const places = F.ALE_BY_PLACE.map((v, i) => `${i === F.ALE_BY_PLACE.length - 1 ? `${ordinal(i + 1)} or lower` : ordinal(i + 1)} ${nf(v)}`).join(' · ');
  // (while a game's still on the old pay, the lead says when this starts)
  const [py, pm, pdd] = F.NEW_PAY_DATE.split('-').map(Number);
  const from = F.oldPayToday(E) ? `<b>Starting ${esc(new Date(py, pm - 1, pdd).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'}).replace(',', ''))}.</b> ` : '';
  // (the day the realm began: its pay counts from then)
  const began = Number(s.born) > 0 ? ` <span>${esc(new Date(Number(s.born)).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'}).replace(',', ''))}</span>` : '';
  return `<p class="rl-sh-lead">${from}${payCopyHTML()}</p>`
    + `<div class="rl-sh-big">${curHTML('gold', p.gold)}${curHTML('grain', p.grain)}<small>waiting now, safe from raiders, till your Castle, treasuries and cellars have room</small></div>`
    + `<h3 class="rl-sh-h">Today</h3><div class="rl-rows">${today}</div>`
    + `<h3 class="rl-sh-h">In store</h3><div class="rl-rows">${F.CUR.map(c => `<div class="rl-row"><span>${F.CUR_NAME[c]}</span><span class="rl-row-v">${nf(s.r[c])} of ${nf(cap[c])}</span></div>`).join('')}</div>`
    + `<h3 class="rl-sh-h">Since your realm began${began}</h3>${ledger}`
    + `<p class="rl-sh-note">Your realm is paid for the games you play from the day it began. A day’s place pays Ale: ${places} (a tie shares the higher place). Kick It: ${nf(F.KICK_BASE)} Gold for the day’s run, and ${nf(F.KICK_GOLD)} more for every ${ordinal(F.KICK_EVERY)} make (the first ${F.KICK_MOST} makes). Return Man: ${nf(F.RETURN_BASE)} Gold for a day you run, and ${F.COIN_GOLD} a coin on your first run (the first ${F.COIN_PAID_MAX} coins). More room: upgrade your treasuries, cellars and Castle.</p>`;
}
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
/** How the games pay, in a line (the coffers' lead and the welcome's): Ale for a place on three boards; Gold for each
 *  day's Kick It and Return Man run (the competitive pay, Oct 22 2026: core/realm.js KICK_BASE, RETURN_BASE), and more
 *  for its makes and coins. */
export function payCopyHTML() {
  const base = F.KICK_BASE === F.RETURN_BASE ? `${nf(F.KICK_BASE)} each for the day’s Kick It and Return Man runs`
    : `${nf(F.KICK_BASE)} for each day’s Kick It run and ${nf(F.RETURN_BASE)} for each day’s Return Man run`;
  return `<b>Ale</b>: your place on the Daily Puzzles, 17–0 and Two-Minute Drill boards, paid the next morning. `
    + `<b>Gold</b>: ${base}, plus ${nf(F.KICK_GOLD)} for every ${ordinal(F.KICK_EVERY)} Kick It make and ${F.COIN_GOLD} a coin on your first Return Man run.`;
}
/** Your army and heroes: the heroes to recruit or upgrade, who's ready, who's training, who you can train (with Ale). */
function armyParts(s, now) {
  const room = F.armyRoom(s), have = F.roomOf(s.ar), q = F.queued(s);
  const army = F.TROOP_ORDER.filter(t => s.ar[t]).map(t => `<span class="rl-chip">${esc(F.TROOPS[t].name)} ×${s.ar[t]}</span>`).join('') || '<span class="rl-sh-note">No one yet.</span>';
  const line = s.q.map(([t, n], i) => `<span class="rl-chip is-q">${esc(F.TROOPS[t].name)} ×${n}${i === 0 && s.qs ? ` <small>${dur(s.qs + F.trainTime(s, t) * 1000 - now)}</small>` : ''}<button type="button" class="rl-chip-x" data-rl-untrain="${t}" aria-label="Take one ${esc(F.TROOPS[t].name)} out">−</button></span>`).join('');
  const cards = F.TROOP_ORDER.map(t => {
    const T = F.TROOPS[t], chk = F.canTrain(s, t), locked = F.barracksLevel(s) < T.at;
    return `<button type="button" class="rl-tc${locked ? ' is-locked' : ''}" data-rl-train="${t}" ${chk.ok ? '' : 'aria-disabled="true"'}>`
      + `<span class="rl-tc-ic" aria-hidden="true">${picOf(t, MY_HOUSE, true)}</span><b>${esc(T.name)}</b>`
      + `<span class="rl-tc-c">${locked ? `Barracks level ${T.at}` : `${curHTML('grain', T.cost)} · ${T.room} room`}</span>`
      + `<small>${esc(T.blurb)}</small></button>`;
  }).join('');
  // (the Knight's recruited and upgraded with Gold; the Dragon hatches at the Dragon Hatchery and grows with it, Oct 22 2026)
  return {
    heroes: `<h3 class="rl-sh-h">Heroes of the Castle</h3><p class="rl-sh-note">Recruit the Knight once and upgrade him with Gold. Four hatcheries unlock at Castle levels 4, 5, 6, and 7. Choose a different dragon for each, in your favorite color. Each dragon grows with its own hatchery. Heroes defend automatically, deploy once per attack, return after battle, and use no camp space.</p>`
      + `<div class="rl-heroes">${heroCards(s)}</div><p class="rl-sh-note rl-residents">${residentsNote(s)}</p>`,
    room: `<div class="rl-room"><b>${have + q}/${room}</b> room in the war camps${q ? ` (${q} in training)` : ''}</div>`,
    ready: `<h3 class="rl-sh-h">Ready to march</h3><div class="rl-chips">${army}</div>`,
    training: line ? `<h3 class="rl-sh-h">Training${s.q.length ? ` · done in ${dur(F.trainedBy(s, now) - now)}` : ''}</h3><div class="rl-chips">${line}</div>` : '',
    train: `<h3 class="rl-sh-h">Train <span>(tap to add one · ${F.CUR_NAME.grain} ${nf(s.r.grain)})</span></h3><div class="rl-tcs">${cards}</div>`
  };
}
function armyHTML(s, now) { return Object.values(armyParts(s, now)).join(''); }
function armySheet(st) {
  const sh = realmSheet({title: 'Your army & heroes', cls: 'sh-rl', detents: ['large'], body: '<div data-rl-armybody></div>'});
  // (each second, only the parts that changed are put back, the rest left in place, and where you'd scrolled to kept: a
  // whole new sheet under your finger each tick threw a phone's scroll back to the top, Oct 23 2026)
  const host = sh.body.querySelector('[data-rl-armybody]'), was = {};
  const draw = () => {
    if (st.dead || !F.mayPlay()) return;
    const parts = armyParts(F.mine(), Date.now());
    const changed = Object.keys(parts).filter(k => was[k] !== parts[k]);
    if (!changed.length) return;
    const focused = document.activeElement, top = sh.body.scrollTop;
    const key = focused && host.contains(focused) ? ['rlRecruitHero', 'rlUpgradeHero', 'rlHatch', 'rlDragon', 'rlTrain', 'rlUntrain'].find(k => focused.dataset[k]) : null;
    const value = key && focused.dataset[key];
    changed.forEach(k => {
      let el = host.querySelector(`[data-rl-armypart="${k}"]`);
      if (!el) { el = document.createElement('div'); el.dataset.rlArmypart = k; host.append(el); }
      el.innerHTML = parts[k]; was[k] = parts[k];
    });
    if (sh.body.scrollTop !== top) sh.body.scrollTop = top;
    if (key && !host.contains(focused)) Array.from(host.querySelectorAll('button')).find(b => b.dataset[key] === value && !b.disabled)?.focus({preventScroll: true});
  };
  draw();
  sh.body.addEventListener('click', e => {
    if (st.dead || !F.mayPlay()) return;
    const tr = e.target.closest('[data-rl-train]'), un = e.target.closest('[data-rl-untrain]'), s = F.mine();
    const recruit = e.target.closest('[data-rl-recruit-hero]'), upgradeHero = e.target.closest('[data-rl-upgrade-hero]');
    const dragon = e.target.closest('[data-rl-dragon]');
    if (dragon) { sh.close(); dragonSheet(st, Number(dragon.dataset.rlDragon)); return; }
    const hatch = e.target.closest('[data-rl-hatch]');
    if (hatch) {
      // (the Dragon Hero's button: to his hatchery, chosen and in view, its upgrade on its card; or to place one)
      if (hatch.dataset.rlHatch === 'build') {
        const chk = F.canBuild(s, 'hatchery');
        if (!chk.ok) { ui.toast(chk.why, {icon: 'info'}); return; }
        sh.close(); startPlace(st, 'hatchery'); return;
      }
      const b = s.b.find(x => x.i === Number(hatch.dataset.rlHatch));
      if (!b) return;
      sh.close();
      if (st.v) { const sz = F.KINDS[b.t].size; st.v.look(b.x + sz / 2, b.y + sz / 2, Math.min(42, st.v.zoom)); }
      select(st, b.i);
    } else if (recruit || upgradeHero) {
      const k = recruit ? recruit.dataset.rlRecruitHero : upgradeHero.dataset.rlUpgradeHero;
      const check = recruit ? F.canRecruitHero(s, k) : F.canUpgradeHero(s, k);
      if (!check.ok) { ui.toast(check.why, {icon: 'info'}); return; }
      if (recruit ? F.recruitHero(s, k) : F.upgradeHero(s, k)) {
        F.touch(); F.flush(); ui.haptic('success'); draw(); refresh(st);
        ui.toast(`${F.HEROES[k].name} ${recruit ? 'recruited' : `upgraded to level ${F.heroLevel(s, k)}`}`, {icon: 'shield'});
      }
    } else if (tr) {
      const t = tr.dataset.rlTrain, chk = F.canTrain(s, t);
      if (!chk.ok) { ui.toast(chk.why, {icon: 'info'}); return; }
      F.train(s, t, 1); F.touch(); ui.haptic('selection'); draw(); hud(st);
    } else if (un) { F.untrain(s, un.dataset.rlUntrain); F.touch(); draw(); hud(st); }
  });
  const iv = setInterval(() => { if (st.dead || !F.mayPlay() || !sh.el.isConnected) { clearInterval(iv); return; } F.mine(); draw(); }, 1000);
}
/** The computer's realms you can attack, with what each holds today. */
export function targets(now = Date.now(), mine = F.mine()) {
  return F.BOTS.map(b => ({k: b.k, name: b.name, th: b.th, loot: F.botLoot(b, F.botBase(b.th), mine, now).total}));
}
/** Attack: what marches (troops and heroes), the computer's realms, what each holds today, Scout and Attack for each;
 *  before Castle level 4, the lock (raids open there) and the way to the Castle; a realm more than a level above your
 *  Castle, locked till it's high enough. */
function raidHTML(s, now) {
  const th = F.keepOf(s), rows = (open, army) => targets(now, s).map(x => {
    const bot = F.BOTS.find(b => b.k === x.k), ok = open && F.canTarget(s, bot);
    return `<div class="rl-tg${ok ? '' : ' is-locked'}"><span class="rl-tg-lv">${x.th}</span><span class="rl-tg-n"><b>${esc(x.name)}</b>`
      + `<small>${x.loot.gold || x.loot.grain ? `${curHTML('gold', x.loot.gold)} ${curHTML('grain', x.loot.grain)}` : 'Raided today: nothing left to take'}</small></span>`
      // (from Castle 4 every realm can be scouted, the ones out of reach too: core/realm.js realmOf's scout)
      + (open ? `<button type="button" class="rl-act rl-tg-go" data-rl-scout="${esc(x.k)}">Scout</button>` : '')
      + (ok ? `<button type="button" class="rl-act is-go rl-tg-go" data-rl-go="${esc(x.k)}" ${army ? '' : 'disabled'}>Attack</button>`
        : `<span class="rl-tg-lock" role="img" aria-label="Locked: attack it from Castle level ${F.targetAt(bot || x.k)}">${ui.icon('lock')}<span aria-hidden="true">Castle ${F.targetAt(bot || x.k)}</span></span>`) + `</div>`;
  }).join('');
  if (!F.attackOpen(s)) {
    // (the heroes who come with it: the Knight Hero joins there; the Dragon Hero hatches there too, but only once a
    // Dragon Hatchery is built)
    const at = F.HERO_ORDER.filter(k => F.HEROES[k].at === F.ATTACK_AT), name = k => F.HEROES[k].name;
    const join = at.filter(k => !F.HEROES[k].hatch).map(name), hatch = at.filter(k => F.HEROES[k].hatch).map(name);
    return `<div class="rl-lock"><span class="rl-lock-ic" aria-hidden="true">${ui.icon('lock')}</span><span><b>Raids open at Castle level ${F.ATTACK_AT}</b>`
      + `<small>Your Castle is level ${th}. Raise it to march on the computer’s realms${join.length ? `; the ${join.join(' and the ')} join${join.length === 1 ? 's' : ''} you there` : ''}`
      + `${hatch.length ? ', and your first dragon once you choose it and build a Dragon Hatchery' : ''}.</small></span></div>`
      + `<div class="rl-acts"><button type="button" class="rl-act is-go" data-rl-tokeep>Go to your Castle</button></div>`
      + `<h3 class="rl-sh-h">The computer’s realms</h3>${rows(false, 0)}`
      + `<p class="rl-sh-note">Their raids on you start at Castle level ${F.DEFEND_AT} all the same: walls, towers and heroes keep them out.</p>`;
  }
  const army = F.roomOf(s.ar) || Object.keys(F.heroArmy(s)).length;
  const march = [...F.TROOP_ORDER.filter(t => s.ar[t]).map(t => `${esc(F.TROOPS[t].name)} ×${s.ar[t]}`), ...F.HERO_ORDER.filter(k => F.heroArmy(s)['hero_' + k]).map(k => `${esc(F.HEROES[k].name)} level ${F.heroLevel(s, k)}`)];
  return (army ? `<p class="rl-sh-lead">Ready to march: ${march.join(', ')}. Send them round the edge of a realm; they carry off what its treasuries, cellars, mines and breweries hold. Each realm’s stores fill again every morning.</p>`
      : `<p class="rl-sh-lead">Open Army to recruit the Knight Hero or train troops, or choose a dragon and build its hatchery, before attacking.</p>`)
    + rows(true, army)
    + `<p class="rl-sh-note">Scout a realm to look round it first: where its towers reach, where its walls run, where its gold and ale are kept. You can attack realms up to a level above your Castle.</p>`;
}
/** The Castle, chosen and in view (from Attack's lock). */
function toKeep(st) {
  const b = F.mine().b.find(x => x.t === 'keep');
  if (!b) return;
  if (st.v) { const sz = F.KINDS[b.t].size; st.v.look(b.x + sz / 2, b.y + sz / 2, Math.min(42, st.v.zoom)); }
  select(st, b.i);
}
function raidSheet(st, ctx) {
  const sh = realmSheet({title: 'Attack', cls: 'sh-rl', detents: ['large'], body: raidHTML(F.mine(), Date.now())});
  sh.body.addEventListener('click', e => {
    if (st.dead || !F.mayPlay()) return;
    if (e.target.closest('[data-rl-tokeep]')) { sh.close(); toKeep(st); return; }
    const sc = e.target.closest('[data-rl-scout]');
    if (sc) { sh.close(); ctx.nav('/realm/scout/' + encodeURIComponent(sc.dataset.rlScout)); return; }
    const go = e.target.closest('[data-rl-go]');
    if (!go || go.disabled) return;
    sh.close();
    ctx.nav('/realm/raid/' + encodeURIComponent(go.dataset.rlGo));
  });
}
/** Visit: the other players' realms this phone may look round (core/realm.js visitable: the scoreboards' rule), each
 *  with its Castle level, house, player and Visit. */
export function visitHTML(list, now = Date.now()) {
  if (!list.length) return `<p class="rl-sh-lead">No other player’s realm is up yet. When someone else in the league builds theirs, it shows here to visit.</p>`;
  return `<p class="rl-sh-lead">Look round another player’s realm: how they’ve laid it out, what they’ve built and how far each has gone. Visiting changes nothing.</p>`
    + list.map(x => `<div class="rl-tg"><span class="rl-tg-lv">${x.th}</span><span class="rl-tg-n"><b>${esc(houseName(x.state, x))}</b>`
      + `<small><span>${esc(x.name)}${x.guest ? ' · Guest' : ''}</span><span>${esc(ago(Math.min(now, x.at)))}</span></small></span>`
      + `<button type="button" class="rl-act is-go rl-tg-go" data-rl-visit-go="${esc(x.key)}" aria-label="Visit ${esc(houseName(x.state, x))}, ${esc(x.name)}’s realm">Visit</button></div>`).join('');
}
function visitSheet(st) {
  const sh = realmSheet({title: 'Visit a realm', cls: 'sh-rl', detents: ['large'], body: visitHTML(F.visitable())});
  sh.body.addEventListener('click', e => {
    if (st.dead || !F.mayPlay()) return;
    const go = e.target.closest('[data-rl-visit-go]');
    if (!go) return;
    sh.close();
    st.ctx.nav('/realm/visit/' + encodeURIComponent(go.dataset.rlVisitGo));
  });
}
function logSheet(st) {
  // (the realm the board has now, first: a Watch tapped here finds what's listed; and drawn again whenever it changes or
  // another phone's copy comes in, while it's open)
  try { F.sync(); } catch (e) { console.error(e); }
  let stop = () => {};
  const sh = realmSheet({title: 'The Chronicle', cls: 'sh-rl', detents: ['large'], body: `<div data-rl-logbody>${logHTML(F.mine(), Date.now())}</div>`,
    onClose: () => { stop(); if (LOG_DRAW === draw) LOG_DRAW = null; }});
  const draw = () => {
    const host = sh.body.querySelector('[data-rl-logbody]');
    if (!host || !host.isConnected || st.dead || !F.mayPlay()) return;
    const html = logHTML(F.mine(), Date.now());
    if (host.dataset.html !== html) { host.dataset.html = html; host.innerHTML = html; }
  };
  stop = F.subscribe(why => { if (why === 'sync' || why === 'change') draw(); });
  LOG_DRAW = draw;
  sh.body.addEventListener('click', e => {
    if (!st || st.dead || !F.mayPlay()) return;
    const w = e.target.closest('[data-rl-watch]');
    if (w) { sh.close(); st.ctx.nav('/realm/replay/' + encodeURIComponent(w.dataset.rlWatch)); return; }
    const make = e.target.closest('[data-rl-ex-new]'), clear = e.target.closest('[data-rl-ex-clear]');
    if (!make && !clear) return;
    if (make) {
      if (make.disabled || examplesBusy()) return;
      // (played out for real on your base as it stands, a slice at a time: Keepfall stays in hand; put on the realm as it
      // is when they're done, while Keepfall is open on the owner's phone)
      const run = exampleRaidsAsync(F.mine(), Date.now(), {still: () => !st.dead && F.mayPlay(), into: () => F.mine(), dragonDemo: F.dragonExamplesForMe()});
      draw();
      run.then(ex => {
        if (!ex || st.dead || !F.mayPlay()) return;
        const n = ex.length;
        F.touch(); ui.haptic('success'); ui.toast(n ? `${n === 3 ? 'Three' : n === 2 ? 'Two' : 'One'} new example raid${n === 1 ? '' : 's'}` : 'No example raids could be made', {icon: 'shield'});
      }, err => { console.error(err); if (!st.dead && F.mayPlay()) ui.toast('The examples couldn’t be made', {icon: 'info'}); }).finally(draw);
      return;
    }
    if (examplesBusy()) return;
    F.clearExamples(F.mine()); F.touch(); ui.haptic('light'); draw();
  });
}
// (a raid's ▶ Watch, where its replay was kept: its label says which raid, how it went and when)
const watchHTML = (r, s, what) => canWatch(r, s) ? `<button type="button" class="rl-act rl-log-go" data-rl-watch="${esc(r.id)}" aria-label="Watch ${esc(what)}, ${r.st || 0} star${r.st === 1 ? '' : 's'}, ${r.pc || 0}%${r.ex ? '' : `, ${esc(ago(r.at))}`}">${ui.icon('play-fill')}<span>Watch</span></button>` : '';
/** The Chronicle: glory, the raids on your realm, your attacks and the example raids, each with ▶ Watch where its
 *  replay was kept. */
function logHTML(s, now) {
  const off = s.rd.slice().sort((a, b) => b.at - a.at).slice(0, 20), def = s.df.slice().sort((a, b) => b.at - a.at);
  const ex = (Array.isArray(s.ex) ? s.ex : []).slice().sort((a, b) => (a.st || 0) - (b.st || 0) || b.at - a.at);
  const won = s.rd.filter(r => r.st > 0).length, held = s.df.filter(r => !r.st).length;
  return `<div class="rl-sh-big"><span class="rl-amt"><i class="rl-crown"></i>${nf(s.tp)}</span><small>glory · ${won} realm${won === 1 ? '' : 's'} sacked · ${held} raid${held === 1 ? '' : 's'} driven off${s.sh > now ? ` · truce for ${dur(s.sh - now)}` : ''}</small></div>`
    + `<h3 class="rl-sh-h">Raids on your realm</h3>${def.length ? def.map(r => `<div class="rl-log"><span>${starsHTML(r.st || 0)}</span><span class="rl-log-t"><span><b>${esc(r.by)}</b> ${r.st ? `took ${curHTML('gold', (r.lt || [])[0])} ${curHTML('grain', (r.lt || [])[1])}` : 'were driven off'}</span><small>${ago(r.at)} · ${r.pc || 0}% · ${r.td > 0 ? '+' : ''}${r.td || 0} glory</small></span>${watchHTML(r, s, `${r.by}’s raid on your realm`)}</div>`).join('') : `<p class="rl-sh-note">${F.keepOf(s) < F.DEFEND_AT ? `No one bothers with a realm this small yet. Once your Castle is level ${F.DEFEND_AT}, the computer’s realms will start raiding you, now and then.` : 'No one has raided you yet.'}</p>`}`
    + `<h3 class="rl-sh-h">Your attacks</h3>${off.length ? off.map(r => `<div class="rl-log"><span>${starsHTML(r.st || 0)}</span><span class="rl-log-t"><span><b>${esc(r.nm)}</b> · you took ${curHTML('gold', (r.lt || [])[0])} ${curHTML('grain', (r.lt || [])[1])}</span><small>${ago(r.at)} · ${r.pc || 0}% · +${r.ta || 0} glory</small></span>${watchHTML(r, s, `your attack on ${r.nm}`)}</div>`).join('') : `<p class="rl-sh-note">${F.attackOpen(s) ? 'You haven’t attacked anyone yet.' : `You haven’t attacked anyone yet: raids open at Castle level ${F.ATTACK_AT}.`}</p>`}`
    + `<h3 class="rl-sh-h">${F.dragonExamplesForMe() ? 'Dragon sample raids' : 'Example raids'} <span>on your base as it stands · nothing taken</span></h3>`
    + (ex.length ? ex.map(r => `<div class="rl-log is-ex"><span>${starsHTML(r.st || 0)}</span><span class="rl-log-t"><span><b>${esc(r.by)}</b> ${r.st === 3 ? 'broke through' : r.st === 2 ? 'took two stars' : r.st ? 'took a star' : 'were driven off'}</span><small>Example · ${r.pc || 0}% · nothing taken</small></span>${watchHTML(r, s, `the example raid by ${r.by}`)}</div>`).join('')
      : `<p class="rl-sh-note">${F.dragonExamplesForMe() ? 'Watch Nightmare with Soul Eater, Terror Bringer with Usurper, and a siege with all four dragons. Create new samples below.' : 'No example raids. New examples plays three of the computer’s raids on your base as it stands, to watch: nothing is taken.'}</p>`)
    + (examplesBusy() ? '<div class="rl-acts rl-ex-acts"><button type="button" class="rl-act" data-rl-ex-new disabled>Riding out…</button></div>'
      : `<div class="rl-acts rl-ex-acts"><button type="button" class="rl-act" data-rl-ex-new>${F.dragonExamplesForMe() ? 'New dragon samples' : 'New examples'}</button>${ex.length ? '<button type="button" class="rl-act" data-rl-ex-clear>Clear examples</button>' : ''}</div>`);
}
/** Build: everything you can put up, what it costs, how many more the Castle allows. */
function shopHTML(s) {
  const th = F.keepOf(s);
  const groups = [['Treasure', ['mine', 'farm', 'treasury', 'granary']], ['Army', ['barracks', 'camp', 'hatchery']], ['Defense', ['cannon', 'ballista', 'tower', 'trebuchet', 'cauldron', 'wall']]];
  const card = k => {
    const K = F.KINDS[k], chk = F.canBuild(s, k), n = F.countOf(s, k), cap = F.allowed(s, k);
    return `<button type="button" class="rl-shop-c${chk.ok ? '' : ' is-no'}" data-rl-buy="${k}"><span class="rl-shop-ic" aria-hidden="true">${picOf(k, MY_HOUSE)}</span><b>${esc(K.name)}</b>`
      + `<span class="rl-shop-cost">${curHTML(chk.pay, chk.cost)}</span><small>${n}/${cap}${chk.ok ? (chk.time && k !== 'hut' ? ` · ${dur(chk.time * 1000)}` : ' · at once') : ` · ${esc(chk.why)}`}</small></button>`;
  };
  return `<p class="rl-sh-lead">Castle level ${th}: raise it for more of everything.</p>`
    + groups.map(([h, ks]) => `<h3 class="rl-sh-h">${h}</h3><div class="rl-shop">${ks.map(card).join('')}</div>`).join('');
}
function shopSheet(st) {
  const sh = realmSheet({title: 'Build', cls: 'sh-rl', detents: ['large'], body: shopHTML(F.mine())});
  sh.body.addEventListener('click', e => {
    if (st.dead || !F.mayPlay()) return;
    const c = e.target.closest('[data-rl-buy]');
    if (!c) return;
    const k = c.dataset.rlBuy, chk = F.canBuild(F.mine(), k);
    if (!chk.ok) { ui.toast(chk.why, {icon: 'info'}); return; }
    sh.close();
    startPlace(st, k);
  });
}
// Where your realm lies: the sceneries, each open once the Castle's high enough (core/realm.js SCENERIES), the one it's in
// marked; tap an open one to move there.
const sceneriesHTML = s => F.SCENERIES.map(x => {
  const open = F.sceneryOpen(s, x.k), on = F.sceneryOf(s) === x.k;
  const name = features.available() && x.ownerName || x.name, blurb = features.available() && x.ownerBlurb || x.blurb;
  return `<button type="button" class="rl-scn is-${x.k}${on ? ' is-on' : ''}" data-rl-scn="${x.k}" aria-pressed="${on}"${open ? '' : ' aria-disabled="true"'}>`
    + `<i class="rl-scn-sw" aria-hidden="true"></i><span><b>${esc(name)}</b><small>${open ? (on ? 'Your realm lies here' : esc(blurb)) : `Castle level ${x.at} to unlock`}</small></span></button>`;
}).join('');
/** Your house: its name (to change), its Castle level and glory, and your lands. */
const houseHTML = s => `<form class="rl-name" data-rl-nameform><label class="rl-sh-h" for="rl-name-in">Its name</label>`
  + `<input id="rl-name-in" class="rl-in" maxlength="28" autocomplete="off" value="${esc(houseName(s))}">`
  + `<p class="rl-sh-note">Castle level ${F.keepOf(s)} · ${nf(s.tp)} glory.</p>`
  + `<button type="submit" class="btn btn-primary btn-block">Save</button></form>`
  + `<h3 class="rl-sh-h">Your lands <span>raise your Castle to unlock more</span></h3><div class="rl-scns" data-rl-scns>${sceneriesHTML(s)}</div>`;
function houseSheet(st) {
  const s = F.mine();
  const sh = realmSheet({title: 'Your house', cls: 'sh-rl', detents: ['fit', 'large'], body: houseHTML(s)});
  sh.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (st.dead || !F.mayPlay()) return;
    const v = sh.body.querySelector('input').value.replace(/\s+/g, ' ').trim().slice(0, 28);
    s.nm = v; F.touch(); hud(st); sh.close();
  });
  sh.body.querySelector('[data-rl-scns]').addEventListener('click', e => {
    if (st.dead || !F.mayPlay()) return;
    const b = e.target.closest('[data-rl-scn]');
    if (!b) return;
    const k = b.dataset.rlScn, x = F.SCENERIES.find(q => q.k === k);
    if (!F.sceneryOpen(s, k)) { ui.toast(`${x.name} opens at Castle level ${x.at}`, {icon: 'info'}); return; }
    if (F.sceneryOf(s) === k) return;
    F.pickScenery(s, k); F.touch(); ui.haptic('light');
    if (st.v) st.v.setTheme(k);
    sh.body.querySelector('[data-rl-scns]').innerHTML = sceneriesHTML(s);
  });
}

// ---- placing something new: where there's room near the middle; drag it; Build. Walls go down 1 or 10 at a time, more
// in tens (the owner, Oct 2026), in a line from where the first goes, as many as the Keep allows and a line can hold;
// Turn swaps across and down.
const WALL_STEP = 10, WALL_LINE = F.N - 2 * F.EDGE;
const wallsLeft = s => Math.max(0, F.allowed(s, 'wall') - F.countOf(s, 'wall'));
/** The wall amounts on offer: 1, then tens up to what's left to build (and what fits in one line). */
const wallSteps = s => [1, ...Array.from({length: Math.floor(Math.min(wallsLeft(s), WALL_LINE) / WALL_STEP)}, (_, i) => (i + 1) * WALL_STEP)];
const clampWalls = st => { st.wallQty = Math.max(...wallSteps(F.mine()).filter(n => n <= (st.wallQty || 1))); };
const lineOf = (x, y, n, d) => Array.from({length: n}, (_, i) => ({x: x + d[0] * i, y: y + d[1] * i}));
/** Whether what's being placed fits where it is (for a run of walls, every tile of it). */
function fitPlace(st) {
  const s = F.mine(), p = st.place;
  if (p.t !== 'wall' || (st.wallQty || 1) < 2) { p.run = null; p.ok = F.fits(s, F.KINDS[p.t].size, p.x, p.y); return; }
  p.run = lineOf(p.x, p.y, st.wallQty, st.wallDir || [1, 0]);
  p.ok = p.run.every(q => F.fits(s, 1, q.x, q.y));
}
/** The start of a line of n walls going d that fits, nearest near (or the middle), or null. */
function runSpot(s, n, d, near = null) {
  const c = near || {x: F.N / 2, y: F.N / 2};
  let best = null, bd = Infinity;
  for (let y = F.EDGE; y < F.N - F.EDGE; y++) for (let x = F.EDGE; x < F.N - F.EDGE; x++) {
    const dd = (x - c.x) ** 2 + (y - c.y) ** 2;
    if (dd < bd && lineOf(x, y, n, d).every(q => F.fits(s, 1, q.x, q.y))) { bd = dd; best = {x, y}; }
  }
  return best;
}
/** The run of walls where it is if it fits there, else the nearest place it does. */
function seatWalls(st) {
  const p = st.place;
  fitPlace(st);
  if (!p.ok && p.run) { const sp = runSpot(F.mine(), p.run.length, st.wallDir || [1, 0], {x: p.x, y: p.y}); if (sp) { Object.assign(p, sp); fitPlace(st); } }
}
/** The amount (+1 a step more, -1 a step fewer) or the way (turn) changed while placing walls. */
function changeWalls(st, step, turn = false) {
  if (!st.place || st.place.t !== 'wall') return;
  const steps = wallSteps(F.mine()), i = Math.max(0, steps.indexOf(st.wallQty || 1));
  st.wallQty = steps[Math.max(0, Math.min(steps.length - 1, i + step))];
  if (turn) { const d = st.wallDir || [1, 0]; st.wallDir = [d[1], d[0]]; }
  seatWalls(st);
  if (st.v) st.v.setGhost(st.place);
  showSel(st);
}
function startPlace(st, k, near = null, dragon = null) {
  if (k === 'hatchery' && !dragon) { dragonSheet(st, null, choice => startPlace(st, k, near, choice)); return; }
  const s = F.mine(), spot = F.spotFor(s, k, near);
  if (!spot) { ui.toast('No room on the lot', {icon: 'info'}); return; }
  st.sel = null;
  st.place = {t: k, x: spot.x, y: spot.y, ok: true, ...(dragon ? {dragon} : {})};
  if (k === 'wall') { clampWalls(st); seatWalls(st); }
  if (st.v) { st.v.select(null); st.v.setGhost(st.place); st.v.showGrid(true); st.v.look(st.place.x + F.KINDS[k].size / 2, st.place.y + F.KINDS[k].size / 2, Math.max(36, Math.min(60, st.v.zoom))); }
  showSel(st);
  tags(st);
}
function endPlace(st) {
  st.place = null; st.lastWall = null;
  if (st.v) { st.v.setGhost(null); st.v.showGrid(false); }
  showSel(st);
}
function commitPlace(st) {
  const s = F.mine(), p = st.place;
  if (!p) return;
  if (p.run) {
    // a run of walls: all of it or none
    fitPlace(st);
    const chk = F.canBuild(s, 'wall'), n = p.run.length;
    const why = !chk.ok ? chk.why : n > wallsLeft(s) ? `Only ${wallsLeft(s)} more allowed` : !F.testing(s) && chk.cost * n > s.r.gold ? 'Not enough Gold' : !p.ok ? 'It doesn’t fit there' : '';
    if (why) { ui.toast(why, {icon: 'info'}); return; }
    p.run.forEach(q => F.build(s, 'wall', q.x, q.y));
  } else {
    if (p.t === 'hatchery' && !F.hatcheryChoices(s).some(d => d.id === p.dragon?.species)) {
      endPlace(st); dragonSheet(st, null, choice => startPlace(st, 'hatchery', null, choice)); return;
    }
    const b = F.build(s, p.t, p.x, p.y, Date.now(), p.dragon);
    if (!b) { ui.toast(F.canBuild(s, p.t).why || 'It doesn’t fit there', {icon: 'info'}); return; }
  }
  F.touch();
  ui.haptic('light');
  // walls: the next (or the next run) goes on beside it, the same way along
  if (p.t === 'wall' && F.canBuild(s, 'wall').ok) {
    const end = p.run ? p.run[p.run.length - 1] : {x: p.x, y: p.y};
    const d = !p.run && st.lastWall ? [p.x - st.lastWall.x, p.y - st.lastWall.y] : null;
    const dir = st.wallDir = d && Math.abs(d[0]) + Math.abs(d[1]) === 1 ? d : st.wallDir || [1, 0];
    st.lastWall = end;
    clampWalls(st);
    st.place = {t: 'wall', x: end.x + dir[0], y: end.y + dir[1], ok: true};
    seatWalls(st);
    if (!st.place.ok && !st.place.run) { const sp = F.spotFor(s, 'wall', end); if (sp) { Object.assign(st.place, sp); fitPlace(st); } }
    if (st.place.ok) {
      st.v.setLot(s, {now: Date.now(), house: MY_HOUSE}); st.v.setGhost(st.place); refresh(st); showSel(st);
      return;
    }
  }
  endPlace(st);
  refresh(st);
  if (st.v) st.v.frameVillage();
}

// ---------------------------------------------------------------------------------------------------- the 3D
async function start3d(st) {
  if (st.dead || !F.mayPlay()) return;
  const theme = F.sceneryOf(F.mine());
  if (!D3) D3 = await import('./realm-3d.js');
  if (st.dead || !F.mayPlay()) return;
  const ok = await D3.load(theme);
  if (st.dead || !F.mayPlay()) return;
  const host = st.el.querySelector('.rl-gl');
  if (!ok) { host.innerHTML = '<div class="rl-loading">This phone can’t show your realm in 3D.</div>'; return; }
  host.innerHTML = '';
  st.v = D3.create(host, {
    house: MY_HOUSE, zoom: 64, scenery: F.sceneryOf(F.mine()), village: true,
    isActive: () => !st.dead && st.ctx.visible && F.mayPlay(),
    onCamera: () => placeTags(st),
    onLost: () => {
      if (st.dead || !st.v) return;
      st.cam = st.v.camera; st.v.dispose(); st.v = null;
      if ((st.rebuilds = (st.rebuilds || 0) + 1) > 2) {
        st.el.querySelector('.rl-gl').innerHTML = '<div class="rl-loading">This phone ran out of room to show your realm in 3D. Close a few apps, then open Keepfall again.</div>';
        return;
      }
      st.parked = true;
      if (st.ctx.visible) unpark(st);
    },
    onTap: hit => onLotTap(st, hit),
    onGrab: (tile, id) => {
      if (st.place) {
        // a run of walls is held by the tile grabbed, so it moves with the finger from there
        const p = st.place, sz = F.KINDS[p.t].size, i = (p.run || [p]).findIndex(q => tile.x >= q.x - .5 && tile.x <= q.x + sz + .5 && tile.y >= q.y - .5 && tile.y <= q.y + sz + .5);
        st.grabAt = Math.max(0, i);
        return i >= 0;
      }
      return st.moving != null && id === st.moving;
    },
    onDrag: tile => {
      if (st.place) {
        const sz = F.KINDS[st.place.t].size, d = st.wallDir || [1, 0], at = st.place.run ? st.grabAt || 0 : 0;
        const x = Math.round(tile.x - sz / 2) - d[0] * at, y = Math.round(tile.y - sz / 2) - d[1] * at;
        if (x === st.place.x && y === st.place.y) return;
        Object.assign(st.place, {x, y}); fitPlace(st);
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
  refresh(st);
  if (st.cam) { st.v.setCamera(st.cam); st.cam = null; if (st.sel != null) st.v.select(st.sel); }
  else st.v.frameVillage();
}
// While another screen covers Keepfall, its 3D is let go (a phone can't hold two scenes, a raid's or a visit's and this
// one, for long) and built again, the camera where it was, on the way back: soon under a raid, scout, visit or replay,
// after a minute anywhere else.
function parkLater(st) {
  clearTimeout(st.parkT);
  const park = () => {
    st.parkT = 0;
    if (st.dead || st.ctx.visible || !st.v || st.place || st.moving != null) return;
    st.cam = st.v.camera;
    st.v.dispose(); st.v = null;
    st.parked = true;
  };
  // (the cover's route is in the address by the time its screen has slid in)
  st.parkT = setTimeout(() => {
    if (/^#\/realm\/(raid|scout|visit|replay)\//.test(location.hash)) park();
    else st.parkT = setTimeout(park, 59000);
  }, 900);
}
function unpark(st) {
  clearTimeout(st.parkT); st.parkT = 0;
  if (!st.parked || st.dead) return;
  st.parked = false;
  start3d(st);
}
function onLotTap(st, hit) {
  if (st.place) return;
  const s = F.mine();
  if (st.moving != null) { endMove(st); return; }
  if (hit.id == null) { if (st.sel != null) select(st, null); return; }
  const b = s.b.find(x => x.i === hit.id);
  // (a mine or brewery with something in it: the tap collects it, no card; tap it again, empty, for its card. With no
  // room for it, the card, to upgrade storage from)
  if (b && F.KINDS[b.t].role === 'make' && F.made(b) > 0 && collectOne(st, b.i) > 0) {
    if (st.sel != null && st.sel !== b.i) select(st, null);
    return;
  }
  select(st, hit.id, hit.ids || []);
}
/** Collects building id's pile; from: the card's Collect button, where the "+60 Ale" rises from (over the card). */
function collectOne(st, id, from = null) {
  if (st.dead || !F.mayPlay()) return;
  const s = F.mine(), b = s.b.find(x => x.i === id);
  if (!b) return;
  const c = F.KINDS[b.t].makes, got = F.collect(s, id);
  if (got > 0) { F.touch(); ui.haptic('light'); floatText(st, b, `+${nf(got)} ${F.CUR_NAME[c]}`, c, from); }
  else if (F.made(b) > 0) ui.toast(`No room for more ${F.CUR_NAME[c]}: upgrade a ${c === 'gold' ? 'treasury' : 'cellar'}`, {icon: 'info'});
  refresh(st);
  return got;
}
function floatText(st, b, text, c, from = null) {
  if (!st.v) return;
  const sz = F.KINDS[b.t].size, el = document.createElement('div');
  let p = st.v.project(b.x + sz / 2, b.y + sz / 2, 2.4);
  if (from && from.isConnected) { const r = from.getBoundingClientRect(), o = st.el.getBoundingClientRect(); p = {x: r.left - o.left + r.width / 2, y: r.top - o.top + 4}; }
  el.className = `rl-float is-${c}`; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  const layer = st.el.querySelector('.rl-effects'), target = st.el.querySelector(`[data-rl-cur="${c}"]`), bounds = st.el.getBoundingClientRect(), dest = target.getBoundingClientRect();
  layer.appendChild(el);
  st.el.querySelector('[data-rl-announcement]').textContent = text;
  target.classList.remove('is-collected');
  const timer = setTimeout(() => { target.classList.remove('is-collected'); el.remove(); st.effects.delete(timer); }, 1400);
  st.effects.add(timer);
  if (ui.RM) { target.classList.add('is-collected'); return; }
  for (let i = 0; i < 4; i++) {
    const coin = document.createElement('i');
    coin.className = `rl-flying-coin rl-coin is-${c}`;
    coin.style.left = p.x + 'px'; coin.style.top = p.y + 'px'; layer.appendChild(coin);
    const dx = dest.right - bounds.left - 13 - p.x, dy = dest.top - bounds.top + dest.height / 2 - p.y;
    const flight = coin.animate([
      {transform: 'translate(-50%, -50%) scale(.7)', opacity: 0},
      {transform: `translate(${(i - 1.5) * 10}px, -24px) scale(1)`, opacity: 1, offset: .25},
      {transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: .9}
    ], {duration: 650, delay: i * 65, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both'});
    st.flights.add(flight);
    flight.finished.then(() => { if (!st.dead && F.mayPlay()) target.classList.add('is-collected'); }, () => {}).finally(() => { coin.remove(); st.flights.delete(flight); });
  }
}

function fullScreen(st, on) {
  document.documentElement.classList.toggle('is-realm-playing', !!on && !st.dead && F.mayPlay());
}
function disposeState(st) {
  if (st.dead) return;
  st.dead = true;
  cancelLore(st);
  fullScreen(st, false);
  st.events.abort();
  st.stops.splice(0).forEach(f => f());
  st.effects.forEach(clearTimeout); st.effects.clear();
  st.flights.forEach(a => a.cancel()); st.flights.clear();
  clearTimeout(st.parkT);
  ART.clear();
  if (st.v) { st.v.dispose(); st.v = null; }
  st.sel = st.place = st.goal = st.moving = st.drag = null;
}

// ---------------------------------------------------------------------------------------------------- the view
export function warm() { if (F.mayPlay()) loadMods(); }
// The first-visit mark (gg-realm-seen; games.js reads it for Keepfall's Daily Games case): until the owner has opened Keepfall once.
const SEEN_KEY = 'gg-realm-seen';
export function badge() { return F.mayPlay() && ui.lsGet(SEEN_KEY) !== '1'; }
function markSeen() {
  if (!F.mayPlay() || ui.lsGet(SEEN_KEY) === '1') return;
  ui.lsSet(SEEN_KEY, '1');
  dispatchEvent(new Event('gg:badge'));
}
const WELCOME_TITLE = 'Keepfall';
// (when the heroes join, from core/realm.js HEROES: "recruit the Knight at Castle level 4 … build a Dragon Hatchery (Castle
// level 4) and the Dragon hatches"; the Dragon took the Wizard's place, Oct 22 2026)
const heroesAtHTML = () => {
  const by = {};
  F.HERO_ORDER.filter(k => !F.HEROES[k].hatch).forEach(k => { const H = F.HEROES[k]; (by[H.at] = by[H.at] || []).push(H.name.replace(/ Hero$/, '')); });
  const gold = 'recruit ' + Object.keys(by).sort((a, b) => a - b).map(at => `the ${by[at].join(' and the ')} at Castle level ${at}`).join(' and ') + ' from Army and upgrade with Gold';
  return gold + '; unlock four hatcheries at Castle levels 4, 5, 6, and 7. Choose one of each dragon and its color; each grows stronger with its own hatchery';
};
const welcomeHTML = () => `<p class="rl-sh-lead">Raise your house, fill your treasuries, sack the realms around you. The daily games pay your realm for every day you play from the day it began. It’s yours alone.</p>`
  + `<div class="rl-rows">`
  + `<div class="rl-row"><span>${payCopyHTML()}</span></div>`
  + `<div class="rl-row"><span><b>Your coffers</b> hold your pay until your Castle, treasuries and cellars have room. Raiders can’t touch them.</span></div>`
  + `<div class="rl-row"><span><b>Gold mines</b> dig Gold and <b>breweries</b> brew Ale while you’re away: tap them to collect.</span></div>`
  + `<div class="rl-row"><span><b>Your builder</b> raises or upgrades one thing at a time. Raise your <b>Castle</b> to unlock more of everything.</span></div>`
  + `<div class="rl-row"><span><b>Attack</b>: from Castle level ${F.ATTACK_AT}, train an army at the barracks with Ale (footmen, archers, knights and thieves) and sack the computer’s realms for their gold and ale.</span></div>`
  + `<div class="rl-row"><span><b>Heroes</b>: ${heroesAtHTML()}. Send each once per attack, and let them defend automatically. They return after battle.</span></div>`
  + `<div class="rl-row"><span><b>The Chronicle</b> keeps every raid, yours and theirs: tap Watch to see one of the latest again.</span></div>`
  + `<div class="rl-row"><span><b>Your people</b>: guards patrol the village. A dragon keeper arrives when the Dragon Hatchery unlocks at Castle level ${F.COUNT.hatchery.findIndex(n => n > 0) + 1}.</span></div>`
  + `<div class="rl-row"><span><b>Defend</b>: once your Castle is level ${F.DEFEND_AT}, those realms raid you too, now and then. Cannons, ballistas, archer towers, trebuchets, pitch cauldrons and walls keep them out.</span></div>`
  + `</div><p class="rl-sh-note">Drag to look around, pinch to zoom. Tap a building for what it does; tap your house’s name to rename it.</p>`
  + dragonCreditHTML();
// The dragon model's credit (its licence asks for one: views/realm-dragon.js), as Return Man credits its players'.
function dragonCreditHTML() {
  const C = DRAGON_CREDIT, a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${esc(text)}</a>`;
  return `<p class="rl-sh-note rl-credit">Dragon: ${a(C.url, C.title)} by ${a(C.authorUrl, C.author)}, ${a(C.licenseUrl, C.license)}, adapted</p>`;
}
const LORE_SEEN_KEY = 'gg-keepfall-lore-seen';
const loreActive = st => !st.dead && st.ctx.visible && F.mayPlay();
const loreUnseen = st => !st.loreSeen && ui.lsGet(LORE_SEEN_KEY) !== LORE_VERSION;
function loreHTML() { return introHTML(welcomeHTML()); }
function cancelLore(st) {
  const rec = st.lore;
  if (!rec) return;
  rec.cancelled = true;
  rec.events.abort();
  st.lore = null;
  if (rec.sheet) { rec.sheet.body.replaceChildren(); rec.sheet.close(); }
}
function loreSheet(st, first = false) {
  if (!loreActive(st) || st.lore) return;
  const rec = {sheet: null, events: new AbortController(), explicit: false, cancelled: false};
  st.lore = rec;
  const signal = rec.events.signal, route = location.hash;
  const closed = () => {
    rec.events.abort();
    if (st.lore !== rec) return;
    st.lore = null;
    // Route cleanup fires before onHide; only the reader's explicit dismissal counts.
    if (!rec.explicit || rec.cancelled || !loreActive(st) || location.hash !== route) return;
    st.loreSeen = true;
    ui.lsSet(LORE_SEEN_KEY, LORE_VERSION);
    const resume = setTimeout(() => {
      st.effects.delete(resume);
      if (loreActive(st) && !st.lore) defenses(st);
    }, 300);
    st.effects.add(resume);
  };
  rec.sheet = realmSheet({chrome: false, label: 'Keepfall — Lore of Yharmin', cls: 'sh-rl sh-rl-lore sh-rl-intro', detents: ['large'], body: loreHTML(),
    returnFocus: () => st.el.querySelector('[data-rl-lore]'), onClose: closed});
  const sh = rec.sheet;
  mountIntro(sh, {first, signal, active: () => loreActive(st) && st.lore === rec && location.hash === route,
    onClose: () => { rec.explicit = true; sh.close(); }});
  sh.el.addEventListener('keydown', e => { if (e.key === 'Escape') rec.explicit = true; }, {capture: true, signal});
  const scrim = sh.el.previousElementSibling;
  if (scrim && scrim.classList.contains('sheet-scrim')) scrim.addEventListener('click', () => { rec.explicit = true; }, {capture: true, signal});
}
function openingLore(st) {
  markSeen();
  if (loreUnseen(st)) loreSheet(st, true);
}

/** For the checks (core/checks-realm.js): every word Keepfall's screen can show for realm s at now, as HTML, without
 *  opening or changing anything: the screen with its top filled in and the overlays on the lot, every building's card,
 *  the card for placing each kind, and every sheet (done: raids to tell of, as defend() gives them; earned: incomeOf()).
 *  [{where, html}]. */
export function _screens(s, now, {done = [], earned: E = NO_PAY()} = {}) {
  const el = document.createElement('div');
  el.innerHTML = shellHTML();
  hud({el}, s);
  el.querySelector('.rl-tags').innerHTML = tagsHTML(s, now);
  const out = [{where: 'the screen', html: el.innerHTML}];
  s.b.forEach(b => out.push({where: `${b.t}'s card`, html: cardShell(b.i) + cardHTML(s, b.i, now)}));
  if (s.b.length) out.push({where: 'moving a building', html: movingHTML(s, s.b[s.b.length - 1].i)});
  F.ORDER.forEach(k => out.push({where: `placing a ${k}`, html: placeHTML(s, {t: k, ok: true})}));
  out.push({where: 'While you were away', html: awayHTML(done, s, now)}, {where: 'The coffers', html: cofferHTML(s, E)},
    {where: 'Your army', html: armyHTML(s, now)}, {where: 'Attack', html: raidHTML(s, now)}, {where: 'The Chronicle', html: logHTML(s, now)},
    {where: 'Build', html: shopHTML(s)}, {where: 'Choose dragon', html: dragonPickerHTML(s)},
    {where: 'Your house', html: houseHTML(s)}, {where: WELCOME_TITLE, html: welcomeHTML()}, {where: 'Keepfall lore', html: loreHTML()});
  return out;
}

export default {
  id: 'realm',
  chrome: 'none',
  title: 'Keepfall',

  render() { return F.mayPlay() ? shellHTML() : '<div class="rl"><div class="empty"><h2 class="empty-title">Build your Keepfall</h2><p class="empty-body">Choose your profile to start your own kingdom.</p><button type="button" class="btn btn-primary" data-you>Choose profile</button><button type="button" class="btn" data-back>Back</button></div></div>'; },

  mount(el, ctx) {
    if (!F.mayPlay()) { ST.set(ctx, {el, ctx, dead: true}); return; }
    const st = {el, ctx, v: null, sel: null, place: null, moving: null, drag: null, dead: false, lore: null, loreSeen: false, stops: [], events: new AbortController(), effects: new Set(), flights: new Set()};
    ST.set(ctx, st);
    fullScreen(st, ctx.visible);
    st.stops.push(data.subscribe(type => {
      if (type === 'me') { disposeState(st); el.innerHTML = '<div class="rl rl-none"></div>'; }
    }));
    F.mine();
    earned();
    hud(st);
    loadMods().then(() => { if (!st.dead && F.mayPlay()) { earned(); synced(st); } });
    st.stops.push(F.subscribe(() => { if (!st.dead) { hud(st); tags(st); } }));
    st.stops.push(ctx.on('daily', type => { if (type === 'lb' && !st.dead && F.mayPlay()) { earned(); synced(st); } }));
    st.stops.push(ctx.timer(() => { if (!st.dead && F.mayPlay()) { F.mine(); refresh(st); } }, 1000));
    el.addEventListener('click', e => {
      if (st.dead || !F.mayPlay()) return;
      const t = e.target;
      if (t.closest('[data-rl-buildings]')) { buildingsSheet(st); return; }
      if (t.closest('[data-rl-overlap]')) { buildingsSheet(st, st.overlap); return; }
      if (t.closest('[data-rl-lore]')) { loreSheet(st); return; }
      if (t.closest('[data-rl-visit]')) { visitSheet(st); return; }
      if (t.closest('[data-rl-frame]')) { if (st.v) st.v.frameVillage(); return; }
      if (t.closest('[data-rl-world]')) { if (st.v) st.v.frameWorld(); return; }
      if (t.closest('[data-rl-objective]')) { followObjective(st); return; }
      const col = t.closest('[data-rl-collect]');
      if (col) { collectOne(st, +col.dataset.rlCollect, col.hasAttribute('data-rl-card-collect') ? col : null); return; }
      if (t.closest('[data-rl-cur]')) { cofferSheet(); return; }
      const dragon = t.closest('[data-rl-dragon]');
      if (dragon) { dragonSheet(st, Number(dragon.dataset.rlDragon)); return; }
      if (t.closest('[data-rl-army]')) { armySheet(st); return; }
      if (t.closest('[data-rl-shop]')) { shopSheet(st); return; }
      if (t.closest('[data-rl-log]')) { logSheet(st); return; }
      if (t.closest('[data-rl-house]')) { houseSheet(st); return; }
      if (t.closest('[data-rl-raid]')) { raidSheet(st, ctx); return; }
      if (t.closest('[data-rl-unsel]') || t.closest('[data-rl-scrim]')) { select(st, null); return; }
      if (t.closest('[data-rl-moved]')) { endMove(st); return; }
      if (t.closest('[data-rl-cancel]')) { endPlace(st); return; }
      if (t.closest('[data-rl-place]')) { commitPlace(st); return; }
      if (t.closest('[data-rl-qty]')) { changeWalls(st, +t.closest('[data-rl-qty]').dataset.rlQty); return; }
      if (t.closest('[data-rl-turn]')) { changeWalls(st, 0, true); return; }
      const up = t.closest('[data-rl-up]');
      if (up) {
        const s = F.mine();
        if (F.upgrade(s, +up.dataset.rlUp)) { F.touch(); ui.haptic('light'); refresh(st); showSel(st); }
        else ui.toast(F.canUpgrade(s, +up.dataset.rlUp).why, {icon: 'info'});
        return;
      }
      const mv = t.closest('[data-rl-move]');
      // (the card makes way for the lot while it's moved: a bar with Done, as a tap on the lot)
      if (mv) { st.moving = +mv.dataset.rlMove; if (st.v) st.v.showGrid(true); showSel(st); ui.toast('Drag it where you want it, then tap the lot', {icon: 'info'}); }
    }, {signal: st.events.signal});
    // (Escape: a move done, else a building's card closed)
    el.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || st.dead || !F.mayPlay() || st.place || st.sel == null) return;
      e.preventDefault();
      if (st.moving != null) endMove(st); else select(st, null);
    }, {signal: st.events.signal});
    start3d(st);
    if (ctx.visible) { openingLore(st); setTimeout(() => { if (!st.dead && ctx.visible) defenses(st); }, 900); }
  },

  onShow(ctx) {
    if (!F.mayPlay()) return;
    let st = ST.get(ctx);
    if (st && st.dead) { this.update(ctx); st = ST.get(ctx); }
    if (!st) return;
    openingLore(st);
    fullScreen(st, true);
    unpark(st);
    F.sync(); refresh(st); if (st.v) st.v.want();
    // (back from a replay: the Chronicle again, unless there's news of a raid to tell first)
    const told = defenses(st), log = LOG_NEXT;
    LOG_NEXT = false;
    if (log && !told && !st.lore) logSheet(st);
  },

  onHide(ctx) { const st = ST.get(ctx); if (st) { cancelLore(st); fullScreen(st, false); if (!st.dead) parkLater(st); } },

  update(ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    if (!F.mayPlay()) { disposeState(st); st.el.innerHTML = '<div class="rl rl-none"></div>'; return; }
    if (st.dead) { st.el.innerHTML = shellHTML(); this.mount(st.el, ctx); return; }
    refresh(st);
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    disposeState(st);
    F.flush();
    ST.delete(ctx);
  }
};
