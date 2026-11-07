// Presentation consumes resolved, public v7 events. It never calls the rules engine.
import {esc} from '../core/data.js';
import * as ui from '../core/ui.js';
import * as C from '../core/dynasty-pocket-cards.js';
import {rivalsUpdated} from '../core/features.js';
import {printedCard} from './dynasty-pocket-card.js';
import {conditionBadges} from './dynasty-pocket-preview.js';

const kinds = new Set(['attack', 'attack-failed', 'coin', 'evolve', 'support', 'condition']);
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
function flashHTML(ev, you, opponent) {
  const c = C.card(ev.id), mine = ev.who === you;
  const label = (c?.kind || 'support')[0].toUpperCase() + (c?.kind || 'support').slice(1);
  return `<div class="rp-flash-top"><span>${mine ? 'You played' : esc(opponent) + ' played'} · ${esc(label)}</span><button type="button" data-rp-skip>Skip</button></div>`
    + `<span class="rp-flash-burst" aria-hidden="true"></span><div class="rp-flash-stage" aria-hidden="true"><div class="rp-flash-card"><span class="rp-card-print">${printedCard(ev.id)}</span><i class="rp-flash-white"></i></div><span class="rp-flash-ring"></span>${SPARKS}</div>`
    + `<p class="rp-sr-only" role="status">${esc(c?.name || 'Card')} played. ${esc(ev.text || '')}</p>`;
}

export function attachPresentation(root, {enabled, cancelHand, sound, blocked = () => false}) {
  let queue = [], scene = null, timer, cue, retry, focus, raf = 0, stopped = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const host = () => root.querySelector('[data-rp]');
  const allowed = () => !stopped && rivalsUpdated() && enabled() && !document.hidden;
  function clear() {
    clearTimeout(timer); clearTimeout(retry); clearTimeout(cue); cancelAnimationFrame(raf);
    queue = []; scene?.remove(); scene = null;
    if (host()) host().inert = false;
  }
  function finish() {
    clearTimeout(timer); clearTimeout(cue); cancelAnimationFrame(raf); scene?.remove(); scene = null;
    if (host()) host().inert = false;
    next();
    if (!scene && !queue.length && allowed()) {
      (focus?.isConnected ? focus : host()?.querySelector('[data-rp-menu]'))?.focus({preventScroll:true});
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
    const {ev, you, opponent, rev} = queue.shift(), attack = ev.k === 'attack', coin = ev.k === 'coin', flash = ev.k === 'support', status = ev.k === 'condition';
    cancelHand(); focus = document.activeElement;
    scene = document.createElement('section');
    const side = ev.who === you ? 'is-mine' : 'is-theirs';
    scene.className = flash ? `rp-cinema rp-play-flash ${side}` : attack ? `rp-cinema rp-attack-scene ${side}${ev.damage > 0 ? ' is-hit' : ''}`
      : coin ? `rp-cinema rp-coin-scene ${ev.heads ? 'is-heads' : 'is-tails'} is-up-heads` : status ? `rp-cinema rp-status-scene is-${String(ev.condition || '').toLowerCase()}` : 'db-cinema rp-cinema is-card';
    scene.dataset.rpScene = ev.k;
    scene.setAttribute('role', 'dialog'); scene.setAttribute('aria-modal', 'true');
    scene.setAttribute('aria-label', coin ? 'Coin result' : status ? `${short(ev.id)} is now ${cap(String(ev.condition || '').toLowerCase())}` : ev.name || C.card(ev.id)?.name || 'Play result');
    const heading = ev.k === 'attack-failed' ? 'Attack stopped' : ev.k === 'evolve' ? 'Player developed' : 'Card played';
    let duration = 1600;
    if (flash) {
      scene.innerHTML = flashHTML(ev, you, opponent); duration = 1750;
      cue = setTimeout(() => sound('power'), 760);
    } else if (attack) {
      scene.innerHTML = attackHTML(root, ev, you, opponent, rev); duration = ev.damage > 0 ? ATTACK_MS.hit : ATTACK_MS.status;
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
    timer = setTimeout(finish, duration);
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
      if (!allowed() || motion.matches) return;
      // Draws, searches and opening lineups can contain hidden card IDs. Never present them.
      queue.push(...events.filter(e => kinds.has(e.k)).map(ev => ({ev:{...ev}, you:x.you, opponent:x.opp.name, rev:x.G?.rev === 2 ? 2 : 1})));
      next();
    },
    clear,
    stop() { stopped = true; clear(); document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', preference); }
  };
}
