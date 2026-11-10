// Presentation consumes resolved, public v7 events. It never calls the rules engine.
import {esc} from '../core/data.js';
import * as ui from '../core/ui.js';
import * as C from '../core/dynasty-pocket-cards.js';
import {rivalsUpdated} from '../core/features.js';
import {printedCard} from './dynasty-pocket-card.js';
import {conditionBadges} from './dynasty-pocket-preview.js';

const kinds = new Set(['attack', 'attack-failed', 'coin', 'evolve', 'support', 'condition', 'battle-start', 'setup', 'place', 'bench', 'switch', 'promote', 'ko', 'points', 'game-over']);
const TYPE = {Grass:'#4c963e',Fire:'#ce513c',Water:'#337cb8',Lightning:'#b18d10',Psychic:'#9451aa',Fighting:'#ab6b42',Darkness:'#43556b',Metal:'#697c85',Colorless:'#7b7a90'};
const short = id => C.card(id)?.athlete || C.card(id)?.name || 'Athlete';
const cap = w => w ? w[0].toUpperCase() + w.slice(1) : '';
const box = r => `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
// The Active Spot's place on the table. Actives always sit in the same spots, so the
// table about to be redrawn and the redrawn table agree.
function spot(root, mine) {
  const r = root.querySelector(`.rp-side.${mine ? 'is-mine' : 'is-opponent'} .rp-active`)?.getBoundingClientRect();
  if (r?.width) return {left:r.left, top:r.top, width:r.width, height:r.height};
  const w = Math.min(innerWidth * .29, 120);
  return {left:(innerWidth - w) / 2, top:innerHeight * (mine ? .55 : .25), width:w, height:w * 88 / 63};
}
const center = r => ({x:r.left + r.width / 2, y:r.top + r.height / 2});

// Capture the old table before the view commits a resolved move. A knockout may already
// have removed its card, and a switch may already have exchanged both positions by the
// time its scene reaches the front of the queue.
const bounds = el => { const r = el?.getBoundingClientRect(); return r?.width ? {left:r.left,top:r.top,width:r.width,height:r.height} : null; };
function tableCards(root, side, id) {
  const label = `Inspect ${C.card(id)?.name || 'Card'}`;
  return [...root.querySelectorAll(`.rp-side.${side} .rp-card`)].filter(el => el.getAttribute('aria-label')?.startsWith(label + ',') || el.getAttribute('aria-label') === label);
}
const tableCard = (root,side,id) => tableCards(root,side,id)[0];
function tableLayout(root, ev, x) {
  const side = ev.who === x.you ? 'is-mine' : 'is-opponent', active = spot(root, ev.who === x.you);
  const bench = [...root.querySelectorAll(`.rp-side.${side} .rp-bench > *`)].map(bounds);
  const source = bounds(ev.u != null ? root.querySelector(`.rp-side.${side} [data-rp-slot="${Number(ev.u)}"]`) : tableCard(root, side, ev.id));
  const hand = bounds(root.querySelector(ev.who === x.you ? '.rp-hand' : '.rp-opponent-hand'));
  const index = ev.index ?? (x.G?.p?.[ev.who]?.bench.findIndex(s => s.id === ev.id) ?? -1);
  return {active, bench, source, hand, side, target:ev.zone === 'active' ? active : bench[Math.max(0,index)] || active};
}
function travelCard(id, from, to, rev, cls = '', i = 0, hidden = false) {
  const a = center(from), b = center(to);
  return `<div class="rp-table-flight ${cls}" style="${box(to)};--dx:${(a.x-b.x).toFixed(1)}px;--dy:${(a.y-b.y).toFixed(1)}px;--s0:${(from.width/to.width).toFixed(3)};--i:${i}" aria-hidden="true"><span class="rp-card-print">${hidden ? BACK : printedCard(id,rev)}</span><i class="rp-table-ring"></i></div>`;
}
const sceneTop = label => `<div class="rp-flash-top"><span>${esc(label)}</span><button type="button" data-rp-skip>Skip</button></div>`;
function placementHTML(ev, you, opponent, rev, layout) {
  const mine = ev.who === you, hidden = ev.hidden, from = layout.hand || layout.active;
  const origin = {...from,width:Math.min(from.width,70),height:Math.min(from.width,70)*88/63};
  const cards = ev.k === 'setup' ? [travelCard(ev.id,origin,layout.active,rev,'',0,hidden),...(ev.bench || []).map((id,i)=>travelCard(id,origin,layout.bench[i] || layout.active,rev,'',i+1,hidden))].join('')
    : travelCard(ev.id,origin,layout.target,rev);
  return sceneTop(mine ? 'Your lineup' : `${opponent}’s lineup`) + cards
    + `<p class="rp-table-caption" role="status">${ev.k === 'setup' ? 'Lineup ready' : `${esc(short(ev.id))} ${ev.zone === 'active' ? 'takes the Active Spot' : 'joins the Bench'}`}</p>`;
}
function switchHTML(ev, you, opponent, rev, layout) {
  const from = layout.source || layout.bench[0] || layout.active;
  const incoming = travelCard(ev.id,from,layout.active,rev,'is-switch');
  const outgoing = ev.from ? travelCard(ev.from,layout.active,from,rev,'is-switch is-outgoing') : '';
  return sceneTop(ev.who === you ? 'Your substitution' : `${opponent}’s substitution`) + outgoing + incoming
    + `<p class="rp-table-caption" role="status">${esc(short(ev.id))} takes the Active Spot</p>`;
}
function knockoutHTML(ev, rev, layout) {
  const r = layout.source || layout.active;
  return sceneTop('Knockout') + `<div class="rp-knockout-card" style="${box(r)}" aria-hidden="true"><span class="rp-card-print">${printedCard(ev.id,rev)}</span><i class="rp-knockout-crack"></i></div>`
    + `<div class="rp-moment-title is-knockout" role="status"><b>KNOCKOUT</b><span>${esc(short(ev.id))} is out</span></div>`;
}
function momentHTML(root, ev, you, opponent) {
  if (ev.k === 'battle-start') return sceneTop('Gridiron Rivals')
    + `<div class="rp-match-intro" role="status"><span class="rp-intro-manager is-you">YOU</span><strong>VS</strong><span class="rp-intro-manager is-opponent">${esc(opponent)}</span><b>BATTLE START</b></div><i class="rp-moment-ring" aria-hidden="true"></i>`;
  if (ev.k === 'points') {
    const mine = ev.who === you, badge = bounds(root.querySelector(`.rp-manager.${mine ? 'is-mine' : 'is-opponent'} .rp-points`));
    const to = badge ? center(badge) : {x:innerWidth*.2,y:innerHeight*.6};
    const n = Math.max(1,Math.min(3,Number(ev.points)||1));
    return sceneTop('Knockout points') + `<div class="rp-moment-title is-points" role="status"><b>+${n} ${n === 1 ? 'POINT' : 'POINTS'}</b><span>${mine ? 'You score' : esc(opponent) + ' scores'}</span></div>`
      + Array.from({length:n},(_,i)=>`<i class="rp-score-orb" style="--i:${i};--dx:${(to.x-innerWidth/2).toFixed(1)}px;--dy:${(to.y-innerHeight*.45).toFixed(1)}px" aria-hidden="true">★</i>`).join('');
  }
  const win = ev.result === 'w', draw = ev.result === 'd';
  return sceneTop('Match complete') + `<i class="rp-moment-ring" aria-hidden="true"></i><div class="rp-moment-title is-finale" role="status"><small>GRIDIRON RIVALS</small><b>${win ? 'VICTORY' : draw ? 'MATCH DRAWN' : 'DEFEAT'}</b><span>${win ? 'The table is yours.' : draw ? 'An even match.' : 'The next battle awaits.'}</span></div>`
    + (win ? Array.from({length:20},(_,i)=>`<i class="rp-win-confetti" style="--i:${i};--x:${(i*47%100)}vw;--turn:${i%2 ? 440 : -380}deg" aria-hidden="true"></i>`).join('') : '');
}

// Attacks (November 7, 2026, Evan's video): the attacker lifts toward the center while a
// diagonal banner sweeps across with the attack's name, then it returns and strikes.
function attackHTML(root, ev, you, opponent, rev) {
  const mine = ev.who === you, a = spot(root, mine), d = spot(root, !mine), c = C.card(ev.id);
  const scale = Math.min(2.2, innerWidth * .6 / a.width, innerHeight * .5 / a.height);
  const from = center(a), to = center(d);
  const lift = `--tx:${(innerWidth / 2 - from.x).toFixed(1)}px;--ty:${(innerHeight * .42 - from.y).toFixed(1)}px;--s:${scale.toFixed(3)}`;
  const lunge = `--lx:${((to.x - from.x) * .5).toFixed(1)}px;--ly:${((to.y - from.y) * .5).toFixed(1)}px`;
  const hit = ev.damage > 0;
  return `<div class="rp-flash-top"><span>${mine ? 'You attack' : esc(opponent) + ' attacks'}</span><button type="button" data-rp-skip>Skip</button></div>`
    + `<div class="rp-attack-card is-defender" style="${box(d)}" aria-hidden="true"><span class="rp-card-print">${printedCard(ev.target, rev)}</span><i class="rp-attack-hit"></i></div>`
    + `<div class="rp-attack-card is-attacker" style="${box(a)};${lift}" aria-hidden="true"><div class="rp-attack-lunge" style="${lunge}"><span class="rp-card-print">${printedCard(ev.id, rev)}</span></div></div>`
    + `<div class="rp-attack-band" style="--type:${TYPE[c?.type] || TYPE.Colorless}" aria-hidden="true"><i class="rp-attack-lines"></i><b class="rp-attack-name">${esc(ev.name || 'Attack')}</b><small>${esc(short(ev.id))}</small></div>`
    + (hit ? `<strong class="rp-attack-damage" style="left:${to.x}px;top:${d.top + d.height * .35}px" aria-hidden="true">${ev.damage}</strong>` : '')
    + `<p class="rp-sr-only" role="status">${esc(short(ev.id))} used ${esc(ev.name || 'an attack')}${hit ? ` for ${ev.damage} damage` : ''}.</p>`;
}
// A Special Condition appears over the affected Active: a pill names it and sleep drifts up in Z's.
function conditionHTML(root, ev, you, rev) {
  const r = spot(root, ev.who === you), cond = String(ev.condition || '').toLowerCase();
  const z = cond === 'asleep' ? [0, 1, 2].map(i => `<span class="rp-status-z" style="--i:${i}">Z</span>`).join('') : '';
  return `<p class="rp-status-pill" role="status">${esc(short(ev.id))} is now ${esc(cap(cond))}</p>`
    + `<div class="rp-status-target" style="${box(r)}" aria-hidden="true"><span class="rp-card-print">${printedCard(ev.id, rev)}</span><i class="rp-status-tint"></i>${z}<span class="rp-status-badges">${conditionBadges({[cond]:true})}</span></div>`
    + `<button type="button" class="rp-status-skip" data-rp-skip>Skip</button>`;
}
// The coin is tossed toward the camera, spins and lands. The tint follows its visible face.
const COIN_PILL = {'Sleep recovery':'Checkup — Asleep', 'Burn recovery':'Checkup — Burned', 'Confusion':'Confused — flip to attack'};
function coinOutcome(ev) {
  const name = ev.id ? short(ev.id) : 'The athlete';
  if (ev.reason === 'Sleep recovery') return ev.heads ? `${name} wakes up!` : `${name} is still Asleep`;
  if (ev.reason === 'Burn recovery') return ev.heads ? `${name}’s burn heals` : `${name} is still Burned`;
  if (ev.reason === 'Confusion') return ev.heads ? 'The attack goes ahead' : 'The attack fails';
  return '';
}
function coinHTML(ev, you) {
  const edges = [-2, -1, 0, 1, 2].map(z => `<span class="rp-coin-edge" style="--z:${z}px"></span>`).join('');
  return `<div class="rp-coin-veil" aria-hidden="true"></div><p class="rp-coin-pill">${esc(COIN_PILL[ev.reason] || ev.reason || 'Coin flip')}</p>`
    + `<div class="rp-coin-toss" aria-hidden="true"><div class="rp-coin-bounce"><div class="rp-coin3d"><span class="rp-coin-face is-heads">${ui.icon('football', {size:58})}</span>${edges}<span class="rp-coin-face is-tails"><b>GR</b></span></div></div></div>`
    + `<div class="rp-coin-result" role="status"><small>${ev.who === you ? 'Your flip' : 'Opponent’s flip'}</small><b>${ev.heads ? 'HEADS' : 'TAILS'}</b>${coinOutcome(ev) ? `<span>${esc(coinOutcome(ev))}</span>` : ''}</div>`
    + `<button type="button" class="rp-coin-skip" data-rp-skip>Skip</button>`;
}
const ATTACK_MS = {hit:2450, status:1800}, COIN_MS = 2450, SPIN_MS = 1250, STATUS_MS = 1700;

// Played support cards rise to center, flash white and burst into a glowing frame.
const SPARKS = Array.from({length:16}, (_, i) => {
  const a = i / 16 * Math.PI * 2 + (i % 2 ? .2 : 0), r = .56 + (i * 37 % 23) / 100;
  return `<i class="rp-flash-spark" style="--x:${(Math.cos(a) * r).toFixed(2)};--y:${(Math.sin(a) * r * 1.4).toFixed(2)};--d:${(i * 53 % 9) * 24}ms;--s:${(.6 + (i * 29 % 7) / 10).toFixed(1)}"></i>`;
}).join('');
function flashHTML(ev, you, opponent, rev) {
  const c = C.card(ev.id), mine = ev.who === you;
  const label = (c?.kind || 'support')[0].toUpperCase() + (c?.kind || 'support').slice(1);
  return `<div class="rp-flash-top"><span>${mine ? 'You played' : esc(opponent) + ' played'} · ${esc(label)}</span><button type="button" data-rp-skip>Skip</button></div>`
    + `<span class="rp-flash-burst" aria-hidden="true"></span><div class="rp-flash-stage" aria-hidden="true"><div class="rp-flash-card"><span class="rp-card-print">${printedCard(ev.id, rev)}</span><i class="rp-flash-white"></i></div><span class="rp-flash-ring"></span>${SPARKS}</div>`
    + `<p class="rp-sr-only" role="status">${esc(c?.name || 'Card')} played. ${esc(ev.text || '')}</p>`;
}

// Draws (November 7, 2026, Evan: "When cards are drawn, they should have an animation and sound effects. Preview the
// card briefly before moving it to the players hand"). Your drawn cards leave your deck face down, turn over at center
// for a moment, then fly into their places in the fan. The opponent's slide face down from their deck to their hand:
// their IDs are dropped before queueing, so a hidden card never reaches the page.
const DRAW = {in:480, step:120, hold:700, out:380}, THEIR_DRAW_MS = 720;
const BACK = '<img src="img/rivals/card-back-v1.webp" alt="" decoding="async" draggable="false">';
const rectOf = (root, sel) => { const r = root.querySelector(sel)?.getBoundingClientRect(); return r?.width ? r : null; };
function drawLayout(n) {
  const w = Math.min(innerWidth * .58, 240, (innerHeight - 220) * .716, (innerWidth - 32 - (n - 1) * 12) / n);
  return Array.from({length:n}, (_, i) => ({left:innerWidth / 2 + (i - (n - 1) / 2) * (w + 12) - w / 2, top:innerHeight * .45 - w * 44 / 63, width:w, height:w * 88 / 63}));
}
function drawHTML(root, ev, you, opponent, rev) {
  const mine = ev.who === you, n = ev.ids.length;
  const verb = ev.search ? 'found' : 'drew', who = mine ? 'You' : esc(opponent);
  if (!mine) {
    const from = rectOf(root, '.rp-deck.is-opponent') || {left:12, top:innerHeight * .35, width:56, height:78};
    const to = rectOf(root, '.rp-opponent-hand') || {left:innerWidth / 2 - 30, top:24, width:60, height:60};
    const w = from.width, h = w * 88 / 63, dx = to.left + to.width / 2 - (from.left + w / 2), dy = to.top + to.height / 2 - (from.top + h / 2);
    return ev.ids.map((_, i) => `<div class="rp-draw-back" style="left:${from.left}px;top:${from.top}px;width:${w}px;height:${h}px;--i:${i};--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px" aria-hidden="true">${BACK}</div>`).join('')
      + `<p class="rp-sr-only" role="status">${who} ${verb} ${n === 1 ? 'a card' : n + ' cards'}.</p><button type="button" class="rp-draw-skip" data-rp-skip>Skip</button>`;
  }
  const deck = rectOf(root, '.rp-deck.is-mine') || {left:innerWidth - 70, top:innerHeight * .55, width:56, height:78};
  const dc = center(deck), names = ev.ids.map(id => C.card(id)?.athlete || C.card(id)?.name || 'a card');
  const cards = drawLayout(n).map((r, i) => {
    const c = center(r), id = ev.ids[i];
    return `<div class="rp-draw-card is-${esc(C.card(id)?.rarity || 'common')}" style="${box(r)};--i:${i};--dx:${(dc.x - c.x).toFixed(1)}px;--dy:${(dc.y - c.y).toFixed(1)}px;--s0:${(deck.width / r.width).toFixed(3)}" aria-hidden="true"><div class="rp-draw-turn"><span class="rp-draw-face"><span class="rp-card-print">${printedCard(id, rev)}</span><i class="rp-draw-shine"></i></span><span class="rp-draw-reverse">${BACK}</span></div></div>`;
  }).join('');
  return `<p class="rp-draw-pill" role="status">You ${verb} ${n === 1 ? `<b>${esc(names[0])}</b>` : `${n} cards`}</p>${cards}<button type="button" class="rp-draw-skip" data-rp-skip>Skip</button>`;
}

export function attachPresentation(root, {enabled, cancelHand, sound, blocked = () => false, sceneEnd = () => {}, settled = () => {}}) {
  let queue = [], scene = null, current = null, currentLayout = null, timer, cue, retry, focus, raf = 0, stopped = false, masks = [];
  // Your drawn cards already sit at the end of the redrawn hand. They stay hidden there (keeping their places in the
  // fan) until their scene lands them; `incoming` counts the queued and playing ones.
  let incoming = 0, onEnd = null, later = [];
  const after = (ms, fn) => later.push(setTimeout(fn, ms));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const host = () => root.querySelector('[data-rp]');
  const handCards = () => [...(host()?.querySelectorAll('.rp-hand>[data-rp-hand]') || [])];
  const allowed = () => !stopped && rivalsUpdated() && enabled() && !document.hidden;
  function maskTableCards() {
    if (!current || !currentLayout || current.hidden || !['setup','place','bench','switch','promote','ko'].includes(current.k)) return;
    const ids = [current.id, ...(current.bench || []), ...(current.from ? [current.from] : [])];
    const seen = new Map();
    ids.forEach(id => {
      const candidates = tableCards(root,currentLayout.side,id), at = seen.get(id) || 0; seen.set(id,at+1);
      if (['place','bench'].includes(current.k)) {
        const to = center(currentLayout.target);
        candidates.sort((a,b) => { const ac=center(bounds(a)),bc=center(bounds(b)); return Math.hypot(ac.x-to.x,ac.y-to.y)-Math.hypot(bc.x-to.x,bc.y-to.y); });
      }
      const el = current.k === 'ko' && current.u != null ? root.querySelector(`.rp-side.${currentLayout.side} [data-rp-slot="${Number(current.u)}"]`) : candidates[at];
      if (el && !masks.includes(el)) { el.style.visibility = 'hidden'; masks.push(el); }
    });
  }
  function sync() {
    const cards = handCards();
    cards.forEach((el, i) => el.classList.toggle('is-incoming', i >= cards.length - incoming));
    // The battle may redraw after enqueue; hide the newly mounted originals too.
    maskTableCards();
  }
  function land(n) {
    const cards = handCards(), from = cards.length - incoming;
    incoming = Math.max(0, incoming - n); sync();
    cards.slice(Math.max(0, from), Math.max(0, from + n)).forEach(el => { el.classList.remove('is-drawn'); void el.offsetWidth; el.classList.add('is-drawn'); });
  }
  function clear() {
    const hadWork = !!scene || queue.length > 0;
    clearTimeout(timer); clearTimeout(retry); clearTimeout(cue); cancelAnimationFrame(raf);
    later.forEach(clearTimeout); later = []; onEnd = null; incoming = 0;
    queue = []; scene?.remove(); scene = null; current = null; currentLayout = null;
    masks.forEach(el => el.style.removeProperty('visibility')); masks = [];
    if (host()) { host().inert = false; sync(); }
    if (hadWork) settled({cancelled:true});
  }
  function finish() {
    clearTimeout(timer); clearTimeout(cue); cancelAnimationFrame(raf); later.forEach(clearTimeout); later = [];
    const end = onEnd; onEnd = null; end?.();
    const ended = current; current = null; currentLayout = null;
    scene?.remove(); scene = null;
    masks.forEach(el => el.style.removeProperty('visibility')); masks = [];
    if (host()) host().inert = false;
    if (ended) sceneEnd(ended);
    next();
    if (!scene && !queue.length && allowed()) {
      (focus?.isConnected ? focus : host()?.querySelector('[data-rp-menu]'))?.focus({preventScroll:true});
      settled({cancelled:false});
    }
  }
  function next() {
    clearTimeout(retry);
    if (!allowed() || motion.matches) { clear(); return; }
    if (scene || !queue.length) return;
    // Let an open card or settings sheet keep focus; show incoming plays after it closes.
    // A closing sheet stays mounted through its exit transition and restores focus
    // afterward. Wait for removal too, so it cannot cover the scene or steal Skip.
    if (ui.sheetCount() || document.querySelector('.sheet') || blocked()) { retry = setTimeout(next, 100); return; }
    const {ev, you, opponent, rev, layout} = queue.shift(), attack = ev.k === 'attack', coin = ev.k === 'coin', flash = ev.k === 'support', status = ev.k === 'condition', drawn = ev.k === 'draw';
    const placement = ['setup','place','bench'].includes(ev.k), switched = ev.k === 'switch' || ev.k === 'promote', knockout = ev.k === 'ko', moment = ['battle-start','points','game-over'].includes(ev.k);
    // Earlier KOs in this batch may have compacted the Bench. Follow this exact
    // held athlete when it is still present; otherwise use its captured position.
    if (knockout && ev.u != null) layout.source = bounds(root.querySelector(`.rp-side.${layout.side} [data-rp-slot="${Number(ev.u)}"]`)) || layout.source;
    current = ev; currentLayout = layout;
    cancelHand(); focus = document.activeElement;
    scene = document.createElement('section');
    const side = ev.who === you ? 'is-mine' : 'is-theirs';
    scene.className = placement || switched ? `rp-cinema rp-table-scene ${side}` : knockout ? `rp-cinema rp-knockout-scene ${side}` : moment ? `rp-cinema rp-moment-scene is-${ev.k}${ev.k === 'game-over' ? ' is-' + ev.result : ''}` : drawn ? `rp-cinema rp-draw-scene ${side}` : flash ? `rp-cinema rp-play-flash ${side}` : attack ? `rp-cinema rp-attack-scene ${side}${ev.damage > 0 ? ' is-hit' : ''}`
      : coin ? `rp-cinema rp-coin-scene ${ev.heads ? 'is-heads' : 'is-tails'} is-up-heads` : status ? `rp-cinema rp-status-scene is-${String(ev.condition || '').toLowerCase()}` : 'db-cinema rp-cinema is-card';
    scene.dataset.rpScene = ev.k;
    scene.setAttribute('role', 'dialog'); scene.setAttribute('aria-modal', 'true');
    scene.setAttribute('aria-label', moment ? ev.k === 'battle-start' ? 'Battle start' : ev.k === 'points' ? 'Point earned' : 'Game over' : knockout ? 'Knockout' : switched ? 'Switch athletes' : drawn ? (ev.who === you ? 'You drew' : `${opponent} drew`) : coin ? 'Coin result' : status ? `${short(ev.id)} is now ${cap(String(ev.condition || '').toLowerCase())}` : ev.name || C.card(ev.id)?.name || 'Play result');
    const heading = ev.k === 'attack-failed' ? 'Attack stopped' : ev.k === 'evolve' ? 'Player developed' : 'Card played';
    let duration = 1600;
    if (placement || switched || knockout) {
      scene.innerHTML = placement ? placementHTML(ev,you,opponent,rev,layout) : switched ? switchHTML(ev,you,opponent,rev,layout) : knockoutHTML(ev,rev,layout);
      duration = knockout ? 1500 : placement && ev.k === 'setup' ? 1300 : 1100;
      maskTableCards();
      sound(knockout ? 'knockout' : 'deal');
      if (!knockout) cue = setTimeout(() => sound('card'), 650);
    } else if (moment) {
      scene.innerHTML = momentHTML(root,ev,you,opponent);
      duration = ev.k === 'game-over' ? 2200 : ev.k === 'battle-start' ? 1600 : 1450;
      sound(ev.k === 'game-over' ? ev.result === 'w' ? 'victory' : ev.result === 'd' ? 'draw' : 'defeat' : ev.k === 'points' ? 'epic' : 'turn');
    } else if (drawn) {
      scene.innerHTML = drawHTML(root, ev, you, opponent, rev);
      scene.addEventListener('click', e => { if (!e.target.closest('[data-rp-skip]')) finish(); });
      const n = ev.ids.length, mine = ev.who === you;
      ev.ids.forEach((_, i) => after(i * DRAW.step, () => sound('deal', {pan:mine ? .3 : -.3})));
      if (!mine) duration = THEIR_DRAW_MS + (n - 1) * DRAW.step;
      else {
        const out = DRAW.in + (n - 1) * DRAW.step + DRAW.hold, landed = out + DRAW.out + (n - 1) * 70;
        onEnd = () => land(n);
        after(DRAW.in * .55, () => sound('flip'));
        after(out, () => flyToHand(scene, n));
        after(landed, () => { sound('card'); finish(); });
        duration = landed + 400;
      }
    } else if (flash) {
      scene.innerHTML = flashHTML(ev, you, opponent, rev); duration = 1750;
      cue = setTimeout(() => sound('power'), 760);
    } else if (attack) {
      scene.innerHTML = attackHTML(root, ev, you, opponent, rev); duration = ev.damage > 0 ? ATTACK_MS.hit : ATTACK_MS.status;
      cue = setTimeout(() => sound(ev.damage > 0 ? 'impact' : 'miss'), ev.damage > 0 ? 1780 : 1400);
    } else if (status) {
      scene.innerHTML = conditionHTML(root, ev, you, rev); duration = STATUS_MS;
      scene.addEventListener('click', e => { if (!e.target.closest('[data-rp-skip]')) finish(); });
      cue = setTimeout(() => sound('power'), 120);
    } else if (coin) {
      scene.innerHTML = coinHTML(ev, you); duration = COIN_MS;
      toss(scene, ev.heads); sound('coin');
    } else {
      scene.innerHTML = `<div class="db-cinema-top"><span>${ev.who === you ? 'YOUR PLAY' : esc(opponent) + '’S PLAY'}</span><button type="button" data-rp-skip>Skip animation</button></div>`
        + `<div class="db-cinema-title"><h2>${esc(heading)}</h2><p>${esc(C.card(ev.id)?.name || 'Card')}</p></div>`
        + `<div class="db-cinema-field"><div class="db-cinema-player is-attacker">${printedCard(ev.id, rev)}</div></div>`
        + `<div class="db-cinema-result" role="status"><p>${esc(ev.text || '')}</p></div>`;
    }
    root.append(scene); host().inert = true;
    const skip = scene.querySelector('[data-rp-skip]');
    skip.addEventListener('click', e => { e.stopPropagation(); finish(); });
    scene.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === 'Tab') { e.preventDefault(); skip.focus(); }
    });
    skip.focus({preventScroll:true});
    // Opponent results need reading time even when their animation finishes sooner.
    timer = setTimeout(finish, ev.who !== you && !drawn ? Math.max(duration, 2800) : duration);
  }
  // The fan is redrawn after the scene starts, so each card's place is read as it leaves the preview.
  function flyToHand(el, n) {
    if (scene !== el) return;
    const cards = handCards(), from = cards.length - incoming;
    const hand = rectOf(root, '.rp-hand') || {left:0, top:innerHeight - 140, width:innerWidth, height:120};
    el.classList.add('is-leaving');
    el.querySelectorAll('.rp-draw-card').forEach((card, i) => {
      if (i >= n) return;
      const slot = cards[from + i], r = card.getBoundingClientRect();
      let t = slot?.getBoundingClientRect();
      if (!t?.width || t.right < 0 || t.left > innerWidth) t = {left:hand.left + hand.width / 2 - 30, top:hand.top, width:60, height:84};
      const angle = slot ? parseFloat(getComputedStyle(slot).getPropertyValue('--fan-angle')) || 0 : 0;
      const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
      card.animate([{transform:'none'}, {transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${angle}deg) scale(${(t.width / r.width).toFixed(3)})`}],
        {duration:DRAW.out, delay:i * 70, easing:'cubic-bezier(.55,0,.35,1)', fill:'forwards'});
    });
  }
  // A seeded result is already decided; the toss only shows it. Ease out over four turns
  // (plus a half turn for tails) and tint the table by whichever face is showing.
  function toss(el, heads) {
    const coin = el.querySelector('.rp-coin3d'), arc = el.querySelector('.rp-coin-toss'), turns = 360 * 4 + (heads ? 0 : 180);
    const start = performance.now(), rise = Math.min(innerHeight * .34, 300);
    const frame = now => {
      if (scene !== el) return;
      const t = Math.min(1, (now - start) / SPIN_MS), e = 1 - (1 - t) ** 3, angle = turns * e;
      coin.style.transform = `rotateX(${angle.toFixed(1)}deg)`;
      arc.style.transform = `translateY(${(rise * (1 - e) - Math.sin(Math.PI * t) * 40).toFixed(1)}px) scale(${(.22 + .78 * e).toFixed(3)})`;
      el.classList.toggle('is-up-heads', Math.cos(angle * Math.PI / 180) >= 0);
      if (t < 1) raf = requestAnimationFrame(frame);
      else el.classList.add('is-landed');
    };
    raf = requestAnimationFrame(frame);
  }
  const visibility = () => { if (document.hidden) clear(); };
  const preference = () => { if (motion.matches) clear(); };
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', preference);
  return {
    busy: () => !!scene || queue.length > 0,
    enqueue(events, x) {
      if (!allowed() || motion.matches) return false;
      const before = queue.length;
      const rev = x.G?.rev === 2 ? 2 : 1, opponent = x.opp.name;
      for (const e of events) {
        if (e.k === 'draw' || e.k === 'search') {
          // The opponent's draws and searches (like opening lineups) hold hidden card IDs: only a count is kept.
          // Back-to-back draws by one manager share a scene.
          const mine = e.who === x.you, search = e.k === 'search', last = queue.at(-1)?.ev;
          if (mine && !C.card(e.id)) continue;
          if (last?.k === 'draw' && last.who === e.who && last.search === search && last.ids.length < 3) last.ids.push(mine ? e.id : null);
          else queue.push({ev:{k:'draw', who:e.who, search, ids:[mine ? e.id : null]}, you:x.you, opponent, rev});
          if (mine) incoming++;
        } else if (kinds.has(e.k)) {
          const hidden = e.k === 'setup' && e.who !== x.you && x.G?.phase === 'setup';
          const ev = hidden ? {k:e.k,who:e.who,id:null,bench:(e.bench || []).map(()=>null),hidden:true} : {...e};
          queue.push({ev, you:x.you, opponent, rev, layout:tableLayout(root,e,x)});
        }
      }
      const added = queue.length > before;
      sync(); next();
      return added;
    },
    /** Hides your drawn cards in the redrawn hand until their scene lands them. */
    sync,
    clear,
    stop() { stopped = true; clear(); document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', preference); }
  };
}
