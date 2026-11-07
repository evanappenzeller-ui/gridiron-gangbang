// Presentation consumes resolved, public v7 events. It never calls the rules engine.
// One queue plays them in order: stadium scenes (attacks, coins, development, support) and the table motion
// in dynasty-pocket-motion.js (turn flip, Energy, placements, draws, hits, knockouts, points).
import {esc} from '../core/data.js';
import * as ui from '../core/ui.js';
import * as C from '../core/dynasty-pocket-cards.js';
import {rivalsUpdated} from '../core/features.js';
import {athleteHTML} from './dynasty-battle-athlete.js';
import {printedCard} from './dynasty-pocket-card.js';
import {createStage} from './dynasty-pocket-motion.js';

const kinds = new Set(['attack', 'attack-failed', 'coin', 'evolve', 'support']);
const athlete = (id, role) => {
  const c = C.card(id);
  return athleteHTML(c?.sourceId || id, role, c?.name || 'Player');
};
// With reduced motion the table updates at once; one cue still says what happened.
const SUMMARY = [['over', ev => ev.cue], ['ko', () => 'knockout'], ['attack', ev => !ev.damage ? 'miss' : ev.damage >= 70 ? 'heavy' : 'impact'],
  ['energy', () => 'attach'], ['evolve', () => 'power'], ['bench', () => 'place'], ['support', () => 'card'], ['turn', () => 'turn'], ['draw', () => 'deal']];

export function attachPresentation(root, {enabled, cancelHand, sound, energyOrigin}) {
  let queue = [], scene = null, step = null, timer, retry, focus, stopped = false, idle = [];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const host = () => root.querySelector('[data-rp]');
  const allowed = () => !stopped && rivalsUpdated() && enabled() && !document.hidden;
  const stage = createStage(root, {host, sound: cue => allowed() && sound(cue), origin: () => energyOrigin?.()});
  function clear() {
    clearTimeout(timer); clearTimeout(retry);
    queue = []; scene?.remove(); scene = null; step = null; idle = [];
    stage.clear();
    if (host()) host().inert = false;
  }
  function settled() {
    if (scene || step || queue.length) return;
    stage.settle();
    const waiting = idle; idle = [];
    waiting.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }
  function finish() {
    clearTimeout(timer); scene?.remove(); scene = null;
    if (host()) host().inert = false;
    next();
    if (!scene && allowed()) {
      (focus?.isConnected ? focus : host()?.querySelector('[data-rp-menu]'))?.focus({preventScroll:true});
    }
  }
  function next() {
    clearTimeout(retry);
    if (!allowed() || motion.matches) { clear(); return; }
    if (scene || step) return;
    if (!queue.length) { settled(); return; }
    // Let an open card or settings sheet keep focus; show incoming plays after it closes.
    // A closing sheet stays mounted through its exit transition and restores focus
    // afterward. Wait for removal too, so it cannot cover the scene or steal Skip.
    if (ui.sheetCount() || document.querySelector('.sheet')) { retry = setTimeout(next, 100); return; }
    const item = queue.shift();
    if (item.run) {
      step = item;
      stage.run(item).then(() => { if (step !== item) return; step = null; next(); });
      return;
    }
    const {ev, you, opponent} = item, attack = ev.k === 'attack', coin = ev.k === 'coin';
    cancelHand(); focus = document.activeElement;
    scene = document.createElement('section');
    scene.className = `db-cinema rp-cinema${attack ? '' : coin ? ' is-table-scene' : ' is-card'}`;
    scene.dataset.rpScene = ev.k;
    scene.setAttribute('role', 'dialog'); scene.setAttribute('aria-modal', 'true');
    scene.setAttribute('aria-label', coin ? 'Coin result' : ev.name || C.card(ev.id)?.name || 'Play result');
    const heading = attack ? ev.name : ev.k === 'attack-failed' ? 'Attack stopped' : ev.k === 'evolve' ? 'Player developed' : 'Card played';
    if (coin) {
      scene.innerHTML = `<div class="db-event"><small>${ev.who === you ? 'YOUR FLIP' : 'OPPONENT’S FLIP'}</small><h2>${esc(ev.reason)}</h2><div class="db-coin is-flipping" aria-hidden="true"><span>${ev.heads ? 'H' : 'T'}</span></div><p role="status">${ev.heads ? 'HEADS' : 'TAILS'}</p><button type="button" class="db-act is-back" data-rp-skip>Skip animation</button></div>`;
      sound('coin');
    } else {
      scene.innerHTML = `<div class="db-cinema-top"><span>${ev.who === you ? 'YOUR PLAY' : esc(opponent) + '’S PLAY'}</span><button type="button" data-rp-skip>Skip animation</button></div>`
        + `<div class="db-cinema-title"><h2>${esc(heading)}</h2><p>${esc(C.card(ev.id)?.name || 'Card')}</p></div>`
        + `<div class="db-cinema-field">${attack ? athlete(ev.id, 'attacker') + athlete(ev.target, 'defender') + `<span class="db-cinema-ball" aria-hidden="true">${ui.icon('football', {size:38})}</span><span class="db-cinema-impact" aria-hidden="true"></span>` : `<div class="db-cinema-player is-attacker">${printedCard(ev.id)}</div>`}</div>`
        + `<div class="db-cinema-result" role="status">${attack ? `<strong>${ev.damage} DAMAGE</strong>` : ''}<p>${esc(ev.text || '')}</p></div>`;
      // The snap, then the hit as the ball arrives (db-cinema-impact peaks at 53% of 2.4s).
      if (attack) { sound('whoosh'); const s = scene; setTimeout(() => { if (scene === s) sound(!ev.damage ? 'miss' : ev.damage >= 70 ? 'heavy' : 'impact'); }, 1240); }
      else sound(ev.k === 'evolve' ? 'power' : ev.k === 'attack-failed' ? 'miss' : 'card');
    }
    root.append(scene); host().inert = true;
    const skip = scene.querySelector('[data-rp-skip]');
    skip.addEventListener('click', e => { e.stopPropagation(); finish(); });
    scene.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === 'Tab') { e.preventDefault(); skip.focus(); }
    });
    skip.focus({preventScroll:true});
    timer = setTimeout(finish, attack ? 2800 : 1600);
  }
  const visibility = () => { if (document.hidden) clear(); };
  const preference = () => { if (motion.matches) clear(); };
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', preference);
  return {
    /** Anything still to show (moves wait for it; the computer waits for it). */
    busy: () => !!scene || !!step || queue.length > 0,
    /** A full-screen stadium scene covers the table. */
    blocking: () => !!scene,
    /** Measure the table as shown, before it re-renders. */
    capture: () => stage.capture(),
    /** Re-apply the held public values to a freshly rendered table. */
    mask: () => stage.apply(),
    whenIdle(fn) { if (!scene && !step && !queue.length) fn(); else { idle.push(fn); stage.hurry(); } },
    enqueue(events, x, table) {
      if (!allowed()) return;
      if (motion.matches) {
        const you = x.you;
        for (const [k, cue] of SUMMARY) {
          const ev = events.findLast(e => e.k === k);
          if (ev) { sound(cue({...ev, cue: ev.who === 'draw' ? 'draw' : ev.who === you ? 'victory' : 'defeat'})); break; }
        }
        return;
      }
      // Draws, searches and opening lineups can contain hidden card IDs. Scenes never show them, and table
      // motion only moves the printed back for an opponent's draw.
      const scenes = ev => kinds.has(ev.k);
      if (table?.prev && table?.next) queue.push(...stage.plan(events, {x, ...table, scene: scenes}).map(item => item.scene ? {ev: {...item.scene}, you: x.you, opponent: x.opp.name} : item));
      else queue.push(...events.filter(scenes).map(ev => ({ev: {...ev}, you: x.you, opponent: x.opp.name})));
      next();
    },
    clear,
    stop() { stopped = true; clear(); stage.stop(); document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', preference); }
  };
}
