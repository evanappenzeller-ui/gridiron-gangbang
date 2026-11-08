import {athleteHTML} from './dynasty-battle-athlete.js';
import {rivalsUpdated, rivalsVersus} from '../core/features.js';
import pocketView from './dynasty-pocket-battle.js';
import {bindTableTouch} from './dynasty-table-touch.js';
import {musicSheet, attachMusic} from './dynasty-music.js';
import * as sfx from '../core/dynasty-sfx.js';
import {tableOptions} from './dynasty-table-options.js';
// Gridiron Rivals match (/puzzles/dynasty/battle/<match id>). Rules and saved turns live in the core modules.
// A card table (the owner, Oct 30 2026: "The gameplay is far too confusing. I want it to include the cards that are in
// play laid out and the available cards in your hand are spread out at the bottom. Clicking on each card will show the
// attacks and allow the player to choose which one or put the card back down"): both lineups as cards on the felt, your
// hand fanned along the foot. Tapping any card lifts it into its preview (previewHTML) with what it can do now.
// Energy goes on by itself in rules v4; earlier matches keep a Give energy action on the lifted card.
// Collectible card details, the complete log and match options remain available without interrupting ordinary moves.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-battle.js';
import * as MT from '../core/dynasty-match.js';
import * as SOLO from '../core/dynasty-solo.js';
import {isLive} from '../core/rivals-live-match.js';
import {anyHTML, battleHTML, imgFallback, pipHTML, portraitOf} from './dynasty.js';
import {bindCardFoil} from './dynasty-foil.js';
import {teamSceneStyle} from './dynasty-team-scenes.js';

const esc = data.esc, nf = n => data.nf(n);
const ST = new WeakMap();
const SEEN = mid => `gg-dyb-seen-${mid}`;
const nameOf = id => (D.anyCard(id) ? D.anyCard(id).name : 'a card');
// (a battle against the computer is a Solo battle's, core/dynasty-solo.js; any other a match between players)
const src = st => (SOLO.isSolo(st.mid) ? SOLO : MT);
const short = id => { const c = D.card(id); return c ? D.nameParts(c.name)[1] || c.name : nameOf(id); };

// ---------------------------------------------------------------------------------------------------- what happened
/** One event in words (you: your seat; opp: their name). Their draws stay hidden. */
function evText(ev, you, opp) {
  const who = ev.who === you ? 'You' : opp, mine = ev.who === you;
  switch (ev.k) {
    case 'setup': return `${who} lined up ${nameOf(ev.act)}${ev.bench.length ? ` with ${ev.bench.length} on the bench` : ''}.`;
    case 'draw': return mine ? `You drew ${nameOf(ev.id)}.` : '';
    case 'reinforce': return `${who} brought ${nameOf(ev.id)} from reserves to the bench.`;
    case 'bench': return `${who} put ${nameOf(ev.id)} on the bench.`;
    case 'evolve': return `${who} evolved ${short(ev.from)} into ${D.card(ev.id) && D.card(ev.id).t ? D.card(ev.id).t : D.SERIES[(D.card(ev.id) || {}).s] ? D.SERIES[D.card(ev.id).s].name : ''} ${short(ev.id)}.`;
    case 'energy': return ev.auto ? `${mine ? 'Your' : `${opp}’s`} ${short(ev.id)} got ${ev.count || 1} ${B.ENERGY[ev.e]} energy.` : `${who} gave ${short(ev.id)} a ${B.ENERGY[ev.e]} energy.`;
    case 'stadium': return `${who} played ${nameOf(ev.id)}.`;
    case 'item': return `${who} played ${nameOf(ev.id)}${ev.got && mine ? `: ${nameOf(ev.got)}` : ''}${ev.heal ? `: healed ${ev.heal}` : ''}${ev.energy ? `: +${ev.energy} energy` : ''}${ev.n != null ? `: drew ${ev.n} cards` : ''}.`;
    case 'retreat': return `${who} switched ${short(ev.from)} out for ${short(ev.to)}.`;
    case 'promote': return `${who} sent in ${short(ev.id)}.`;
    case 'injury': return `${short(ev.id)} took 10 from his injury.`;
    case 'end': return `${who} ended the turn.`;
    case 'coach': {
      let x = `${who} played ${nameOf(ev.id)}`;
      if (ev.flips) x += `: ${ev.flips.filter(Boolean).length} heads, ${ev.dmg} damage`;
      if (ev.id === 'C-count') x += ev.heads ? ': heads, Stunned!' : ': tails';
      if (ev.got) x += mine ? `: ${nameOf(ev.got)}` : '';
      if (ev.e) x += `: ${B.ENERGY[ev.e]} energy gone`;
      return x + '.';
    }
    case 'attack': {
      let x = `${short(ev.id)}’s ${ev.name}`;
      if (ev.heads != null) x += ev.heads ? ' (heads)' : ' (tails)';
      if (ev.failed) return `${x}: the attack fails. No damage.`;
      if (ev.missed) return `${x}: ${short(ev.target)} jukes it! No damage.`;
      x += ` hits ${short(ev.target)} for ${ev.dmg}${ev.weak ? ' (weakness)' : ''}.`;
      if (ev.strip || ev.sack) x += ' An energy is knocked off.';
      if (ev.stunned) x += ' Stunned!';
      if (ev.injured) x += ' Injured!';
      if (ev.counter) x += ` Lockdown hits back for ${ev.counter}.`;
      if (ev.heal) x += ` Heals ${ev.heal}.`;
      if (ev.spent) x += ` Spends 1 ${B.ENERGY[ev.spent]} energy.`;
      if (ev.jukeReduced) x += ` Juke blocks ${ev.jukeReduced}.`;
      if (ev.chemistry) x += ` Team chemistry adds ${ev.chemistry}.`;
      return x;
    }
    case 'ko': if (ev.players) return `${short(ev.id)} is knocked out. ${ev.who === you ? 'You have' : `${opp} has`} lost a player.`; return `${short(ev.id)} is knocked out! ${ev.who === you ? opp : 'You'} score${ev.who === you ? 's' : ''} ${ev.pts === 2 ? '2 touchdowns' : 'a touchdown'}.`;
    case 'over': return '';
    default: return '';
  }
}

// ---------------------------------------------------------------------------------------------------- the stadium scenes
function clearCinema(st) {
  st.sfx?.hush(); st.resultSound = null;
  clearTimeout(st.sceneRetry); st.sceneRetry = null;
  clearTimeout(st.coinTimer); st.coinTimer = null;
  clearTimeout(st.sceneTimer); st.sceneTimer = null;
  st.scenes = []; st.scene = null;
  st.el.querySelector('.db-cinema')?.remove();
  const host = st.el.querySelector('[data-db]');
  if (host) { host.inert = false; host.classList.remove('is-presenting'); }
}
function finishCinema(st) {
  st.sfx?.hush();
  clearTimeout(st.coinTimer); st.coinTimer = null;
  clearTimeout(st.sceneTimer); st.sceneTimer = null;
  st.el.querySelector('.db-cinema')?.remove(); st.scene = null;
  if (st.dead) return;
  if (st.scenes.length) { nextCinema(st); return; }
  const host = st.el.querySelector('[data-db]');
  host.inert = false; host.classList.remove('is-presenting');
  // Restore the table's latest state; presentation never submits, rerolls, or pays a move.
  draw(st);
  const focus = st.returnFocus;
  const target = focus && host.querySelector(`[${focus[0]}="${CSS.escape(focus[1])}"]:not(:disabled)`);
  (target || host.querySelector('[data-db-hand], [data-db-more]'))?.focus({preventScroll: true});
}
function nextCinema(st) {
  if (st.scene || !st.scenes.length || st.dead || st.hidden || !D.mayPlay()) return;
  // Sheets own the app's focus/inert boundary; keep queued moves until the table is available.
  if (ui.sheetCount() > 0) {
    clearTimeout(st.sceneRetry);
    st.sceneRetry = setTimeout(() => nextCinema(st), 150);
    return;
  }
  clearTimeout(st.sceneRetry); st.sceneRetry = null;
  const scene = st.scenes.shift(), ev = scene.ev, attack = ev.k === 'attack';
  if (D.tableOpen()) { tableScene(st, scene); return; }
  const host = st.el.querySelector('[data-db]');
  if (!host.inert) st.returnFocus = document.activeElement && host.contains(document.activeElement)
    ? [...document.activeElement.attributes].filter(a => a.name.startsWith('data-db-')).map(a => [a.name, a.value])[0] : null;
  st.scene = scene;
  const heading = attack ? ev.name : {bench: 'Into the lineup', evolve: 'Player upgraded', coach: 'Coach’s call', item: 'Item played', stadium: 'Field advantage'}[ev.k];
  const result = attack ? ev.missed ? 'JUKED' : `${ev.dmg} DAMAGE` : ev.dmg != null ? `${ev.dmg} DAMAGE` : ev.heal ? `+${ev.heal} HP` : nameOf(ev.id);
  const el = document.createElement('section');
  el.className = `db-cinema${attack ? '' : ' is-card'}${ev.missed ? ' is-miss' : ''}${ev.who !== scene.you ? ' is-opponent' : ''}`;
  el.dataset.dbScene = attack ? 'attack' : 'card';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'db-cinema-heading'); el.setAttribute('aria-describedby', 'db-cinema-description');
  el.innerHTML = `<div class="db-cinema-top"><span>GRIDIRON RIVALS · ${ev.who === scene.you ? 'YOUR PLAY' : 'OPPONENT’S PLAY'}</span><button type="button" data-db-skip>Skip animation</button></div>`
    + `<div class="db-cinema-title"><h2 id="db-cinema-heading">${esc(heading)}</h2><p>${esc(attack ? `${short(ev.id)} vs ${short(ev.target)}` : nameOf(ev.id))}</p></div>`
    + `<div class="db-cinema-field">${attack ? athleteHTML(ev.id, 'attacker') + athleteHTML(ev.target, 'defender') + `<span class="db-cinema-ball" aria-hidden="true">${ui.icon('football', {size: 38})}</span><span class="db-cinema-impact" aria-hidden="true"></span>` : `<div class="db-cinema-player is-attacker">${faceHTML(ev.id)}</div>`}</div>`
    + `<div class="db-cinema-result" role="status"><strong>${esc(result)}</strong><p id="db-cinema-description">${esc(evText(ev, scene.you, scene.opp))}</p></div>`;
  st.el.append(el); host.inert = true; host.classList.add('is-presenting');
  el.querySelector('[data-db-skip]').focus({preventScroll: true});
  // One control in the dialog: keep keyboard focus here until it closes.
  el.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); el.querySelector('button').focus(); } });
  st.sceneTimer = setTimeout(() => finishCinema(st), attack ? 2800 : 1800);
}

// ---------------------------------------------------------------------------------------------------- pieces
// One card face for the felt, the hand and the lifted card: type pip, name and HP across the top, the portrait, then
// (in play) the HP meter and the attached energy, or (in hand) what kind of card it is.
// (the rules version of the battle on screen: from v5 nothing is an upgrade)
let RV = B.RULES_VERSION, energyRule = 0;
function energyHTML(energy) {
  if (energy.length <= 3) return energy.map(pipHTML).join('');
  const counts = new Map();
  for (const e of energy) counts.set(e, (counts.get(e) || 0) + 1);
  return Array.from(counts, ([e, count]) => pipHTML(e) + '×' + count).join(' ');
}
function faceHTML(id, slot = null) {
  const c = D.card(id), t = D.trainer(id), stats = c && B.stats(id);
  const team = c && D.teamOf(c.team), type = stats && B.TYPES[stats.type];
  const rarity = (c || t || {}).r || 'common';
  const hp = stats ? Math.max(0, stats.hp - (slot ? slot.dmg : 0)) : 0;
  const pip = stats ? pipHTML(B.typeEnergy(stats.type, energyRule)) : `<span class="db-face-ic">${ui.icon(t.kind === 'stadium' ? 'star' : t.kind === 'coach' ? 'football' : 'bolt', {size: 12})}</span>`;
  const portrait = portraitOf(c);
  const art = c ? `<span class="db-face-art" data-team-scene="${esc(c.team)}" style="--team:${esc(team.pri)};--team-secondary:${esc(team.sec)}${teamSceneStyle(c.team)}"><span class="db-face-number">${esc(c.num || c.pos)}</span>${portrait.url ? `<img${portrait.photo ? ' class="is-photo"' : portrait.action ? ' class="is-action"' : ''} src="${esc(portrait.url)}" alt="" loading="lazy" decoding="async"${imgFallback(portrait)}>` : ''}</span>`
    : `<span class="db-face-art is-tactic"${t.team ? ` data-team-scene="${esc(t.team)}" style="--team:${esc(D.teamOf(t.team).pri)};--team-secondary:${esc(D.teamOf(t.team).sec)}${teamSceneStyle(t.team)}"` : ''}>${ui.icon(t.kind === 'stadium' ? 'star' : t.kind === 'coach' ? 'football' : 'bolt', {size: 30})}</span>`;
  const foot = !c ? `<span class="db-face-role">${esc({coach: 'Coach · one a turn', item: 'Item', stadium: 'Stadium'}[t.kind])}</span>`
    : slot ? `<span class="db-face-meter"><i style="width:${Math.round(hp / stats.hp * 100)}%"></i></span><span class="db-face-en">${slot.en.length ? energyHTML(slot.en) : '<small>No energy</small>'}</span>`
    : `<span class="db-face-role">${esc(c.pos)} · ${esc(team.abbr || c.team)}${B.stageOf(id, RV) ? ' · Upgrade' : ''}</span>`;
  return `<span class="db-face r-${esc(rarity)}${c ? '' : ' is-tactic'}" style="--type:${type ? type.color : '#C59A48'}">`
    + `<span class="db-face-top">${pip}<b class="db-face-name">${esc(c ? short(id) : nameOf(id))}</b>${stats ? `<span class="db-face-hp">${hp}<small>HP</small></span>` : ''}</span>`
    + art + `<span class="db-face-foot">${foot}</span>`
    + (slot && (slot.stun || slot.inj) ? `<span class="db-conds">${slot.stun ? '<i>Stunned</i>' : ''}${slot.inj ? '<i class="is-inj">Injured</i>' : ''}</span>` : '')
    + '</span>';
}
/** A card on the felt (side: 'me' | 'opp'), a button that lifts it; pick: a target for the move being chosen. */
function slotHTML(slot, side, act, {pick = false, ready = false, lifted = false} = {}) {
  if (!slot) return `<div data-db-drop="${side === 'me' ? act ? 'active' : 'bench' : 'none'}" class="db-slot is-empty${act ? ' is-act' : ''}"><span>${act ? 'Active' : 'Bench'}</span></div>`;
  const stats = B.stats(slot.id), hp = stats.hp, left = Math.max(0, hp - slot.dmg);
  const label = `${nameOf(slot.id)}, ${left} of ${hp} HP, ${slot.en.length} energy${slot.stun ? ', Stunned' : ''}${slot.inj ? ', Injured' : ''}${pick ? ', choose this player' : ready ? ', ready to attack' : ''}`;
  return `<button type="button" class="db-slot${act ? ' is-act' : ''}${pick ? ' is-pick' : ''}${ready ? ' is-ready' : ''}${lifted ? ' is-lifted' : ''}${left <= hp * 0.3 ? ' is-low' : ''}" data-db-slot="${slot.u}" data-side="${side}" data-db-drop="${side === 'me' ? `slot:${slot.u}` : 'none'}" aria-label="${esc(label)}">`
    + faceHTML(slot.id, slot) + (ready ? '<span class="db-tag">Tap to attack</span>' : pick ? '<span class="db-tag">Choose</span>' : '') + '</button>';
}
/** What a hand card does when played now: {a, candidates, targeted, ok, why, label}. */
function handAction(G, who, id) {
  const t = D.trainer(id), stats = B.stats(id), me = G.p[who];
  const a = t ? t.kind : stats && B.stageOf(id, G.v) ? 'evolve' : 'bench';
  const targeted = a === 'evolve' || !!(t && t.target);
  const candidates = targeted ? B.slots(me).filter(s => B.check(G, who, {a, id, on: s.u}).ok) : [];
  const result = targeted ? candidates.length ? {ok: true} : B.check(G, who, {a, id, on: (B.slots(me)[0] || {}).u}) : B.check(G, who, {a, id});
  const label = a === 'bench' ? 'Put on bench' : a === 'evolve' ? `Upgrade ${candidates.length === 1 ? short(candidates[0].id) : 'player'}` : `Play ${t.name}`;
  return {a, candidates, targeted, ...result, label};
}
// (setup: the lineup picked so far, as slots on the felt; ids from the hand by their index, so duplicates stay apart)
function setupSlots(st) {
  const S = st.setup;
  return {active: S.act ? {u: -1, id: S.act, dmg: 0, en: []} : null, bench: S.bench.map((id, k) => ({u: -2 - k, id, dmg: 0, en: []}))};
}
function suggestLineup(st, hand) {
  const power = id => B.stats(id).hp + Math.max(0, ...B.stats(id).attacks.map(a => a.dmg)) * 2;
  const basics = hand.map((id, i) => ({id, i})).filter(c => B.isBasic(c.id)).sort((a, b) => power(b.id) - power(a.id));
  const S = st.setup = {act: null, actI: -1, bench: [], benchI: [], init: true};
  if (!basics.length) return;
  S.act = basics[0].id; S.actI = basics[0].i;
  basics.slice(1, 1 + B.BENCH_MAX).forEach(c => { S.bench.push(c.id); S.benchI.push(c.i); });
}

// ---------------------------------------------------------------------------------------------------- the card up close
// A tapped card lifts into its preview (Nov 6 2026, Evan, with a Pokémon TCG Pocket screenshot: "When a card is selected in
// game, this should be the preview screen for the player to decide whether to use one of their attacks, retreat and switch
// with another card, or do nothing (click outside of the card which sets it back down)"; the Rivals group via
// `rivalsUpdated()`): the card enlarged over the dimmed table, its HP and energy on a tab above it, your active player's
// plays as glowing banners over the card's printed attacks (cost, name, damage, what it does or still needs), a Retreat bar
// with its cost, then the card's own play (setup's lineup choices, a hand card's play, a bench player's Send in). Tapping
// anywhere outside the card and its buttons, Escape or Back sets it down; Details opens the full card sheet. Nothing is
// played until a banner is pressed.
const TYPE_TINT = {A: '#3D9BE9', G: '#4FAE3E', B: '#E8573A', C: '#9562D9', S: '#A9A391'};
function attackBanners(st, x, slot) {
  const G = x.G;
  return B.attacksOf(slot.id, G.v).map((a, n) => {
    const p = B.attackPreview(G, x.you, n);
    const missing = B.unpaid(a.cost, slot.en);
    const can = x.state === 'yours' && !st.mode && p.ok;
    const why = x.state !== 'yours' ? 'On your turn.' : missing ? `Needs ${missing} more energy.` : p.ok ? '' : p.why;
    const text = [B.fxText(a), B.signatureText(G, n), ...(p.notes || [])].filter(Boolean).join(' ');
    const tint = TYPE_TINT[B.ENERGY_TYPE[a.cost.find(e => e !== '*')] || (B.stats(slot.id) || {}).type] || TYPE_TINT.S;
    return `<button type="button" class="db-pv-atk${can ? ' is-ready' : ''}" style="--tc:${tint}" data-db-attack="${n}"${can ? '' : ' disabled'}>`
      + `<span class="db-pv-cost" aria-label="Costs ${a.cost.map(e => B.ENERGY[e]).join(', ')}">${a.cost.map(pipHTML).join('')}</span>`
      + `<span class="db-pv-name"><b>${esc(a.name)}</b>${text ? `<small>${esc(text)}</small>` : ''}${why ? `<small class="db-pv-need">${esc(why)}</small>` : ''}</span>`
      + `<strong class="db-pv-dmg">${esc(p.damageText)}</strong></button>`;
  }).join('');
}
function previewHTML(st, x, mySlots) {
  const F = st.focus;
  if (!F) return null;
  const G = x.G, you = x.you, me = G.p[you], op = G.p[1 - you], yours = x.state === 'yours', setup = x.state === 'setup';
  let id, slot = null, plays = '', moves = '', retreat = '', why = '';
  const btn = (label, attrs, kind = 'go') => `<button type="button" class="db-pv-go is-${kind}" ${attrs}>${esc(label)}</button>`;
  const retreatBar = (label, cost, attrs, ok) => `<button type="button" class="db-pv-retreat" ${attrs}${ok ? '' : ' disabled'}><span class="db-pv-rc" aria-label="${cost ? `Costs ${cost} energy` : 'Free'}">${cost ? Array.from({length: cost}, () => pipHTML('*')).join('') : '<small>FREE</small>'}</span><b>${esc(label)}</b></button>`;
  if (F.kind === 'hand') {
    id = me.hand[F.i];
    if (setup) {
      if (!B.basicIn(id, G.v)) why = 'Only Basic players start the game.';
      else moves = btn(st.setup.act ? 'Make him the starter' : 'Start with him', 'data-db-lineup="act"')
        + (st.setup.act && st.setup.bench.length < B.BENCH_MAX ? btn('Put on bench', 'data-db-lineup="bench"', 'soft') : '');
    } else {
      const action = handAction(G, you, id);
      moves = btn(action.label, `data-db-play-hand${yours && action.ok && !me.promote ? '' : ' disabled'}`);
      why = !yours ? 'You can play this on your turn.' : me.promote ? 'Send in a new active player first.' : action.ok ? '' : action.why;
    }
  } else if (F.kind === 'slot') {
    const side = F.side === 'opp' ? op : null;
    slot = side ? B.slots(op).find(s => s.u === F.u) : [mySlots.active, ...mySlots.bench].filter(Boolean).find(s => s.u === F.u);
    if (!slot) return null;
    id = slot.id;
    if (setup && (!side || !D.tableOpen())) {
      if (!side) moves = (F.u === -1 ? '' : btn('Make him the starter', 'data-db-lineup="promote"')) + btn('Back to hand', 'data-db-lineup="hand"', 'soft');
    } else if (!side) {
      const isAct = slot === me.active;
      if (isAct) plays = attackBanners(st, x, slot);
      if (yours && me.promote && !isAct) moves = btn('Send him in', `data-db-promote="${slot.u}"`);
      else if (yours && !isAct) {
        const r = B.check(G, you, {a: 'retreat', to: slot.u}), cost = me.active ? B.retreatCost(me.active, me) : 0;
        retreat = retreatBar('Send him in', cost, `data-db-retreat="${slot.u}"`, r.ok);
        if (!r.ok) why = r.why === 'One switch a turn.' ? 'You’ve switched once this turn.' : r.why;
      }
      if (isAct && me.bench.length && !me.promote) {
        const r = B.check(G, you, {a: 'retreat', to: me.bench[0].u}), cost = B.retreatCost(me.active, me);
        retreat = retreatBar('Retreat', cost, 'data-db-switch', yours && r.ok);
      }
      // (matches begun before v4: the turn's energy is given by hand)
      if (yours && me.en && !me.used.energy && !me.promote && B.check(G, you, {a: 'energy', on: slot.u}).ok) moves = btn(`Give him the ${B.ENERGY[me.en]} energy`, `data-db-energy="${slot.u}"`) + moves;
    }
  }
  if (!id) return null;
  const stats = B.stats(id);
  let tab = '';
  if (slot && stats && !setup) {
    const left = Math.max(0, stats.hp - slot.dmg), conds = [slot.stun && 'Stunned', slot.inj && 'Injured', slot.attachment && nameOf(slot.attachment)].filter(Boolean);
    tab = `<div class="db-pv-tab${left <= stats.hp * 0.3 ? ' is-low' : ''}" aria-label="${left} of ${stats.hp} HP left, ${slot.en.length} energy${conds.length ? ', ' + conds.join(', ') : ''}${F.side === 'opp' ? `, ${esc(x.opp.name)}’s` : ''}">`
      + `<span class="db-pv-hp"><b>${left}</b><i style="--pv-hp:${Math.round(left / stats.hp * 100)}%"></i></span>`
      + `<span class="db-pv-en">${slot.en.length ? energyHTML(slot.en) : '<small>No energy</small>'}</span>`
      + (conds.length ? `<span class="db-pv-conds">${conds.map(c => `<i>${esc(c)}</i>`).join('')}</span>` : '') + '</div>';
  }
  const html = `<div class="db-pv${plays ? ' has-plays' : ''}">${ui.iconButton({icon: 'close', label: 'Set the card down', cls: 'db-pv-x', attrs: 'data-sheet-close'})}`
    + `<div class="db-pv-stage">${tab}<div class="pk-zoom db-pv-card">${anyHTML(id, {size: 'm', tag: false, rulesVersion: G.v, roundEnergy: G.roundEnergy || 0})}</div>`
    + `<div class="db-pv-acts">${plays}${moves}<div class="db-pv-row"><button type="button" class="db-pv-info" data-db-details>${ui.icon('info', {size: 15})}Details</button>${retreat}</div>`
    + (why ? `<p class="db-pv-why">${esc(why)}</p>` : '') + '</div></div></div>';
  return {id, slot, title: nameOf(id), html};
}
// (the open preview follows the match: refreshed in place, closed when its card is gone or a move is made)
function closeFocus(st) {
  const f = st.focusSheet;
  if (!f) return;
  st.focusSheet = null; f.stopFoil(); f.sh.close();
}
function syncFocus(st, x, mySlots) {
  const c = st.focus && !st.dead && !st.hidden ? previewHTML(st, x, mySlots) : null;
  if (!c) { if (st.focus && !st.dead) st.focus = null; closeFocus(st); return; }
  const f = st.focusSheet;
  if (f && f.sh.open) {
    f.slot = c.slot;
    if (f.html === c.html) return;
    f.stopFoil(); f.html = c.html;
    f.sh.el.setAttribute('aria-label', c.title);
    f.sh.body.innerHTML = c.html; ui.hydrate(f.sh.body); f.stopFoil = bindCardFoil(f.sh.body);
    return;
  }
  const F = st.focus;
  const rec = {html: c.html, slot: c.slot, stopFoil: () => {}};
  rec.sh = ui.openSheet({label: c.title, chrome: false, body: c.html, cls: 'pk-sheet db-focus db-preview', detents: ['large'],
    returnFocus: () => cardOf(st, F),
    onClose: () => {
      rec.stopFoil();
      if (st.focusSheet !== rec) return;
      // (closed by a tap outside the card, Escape, a swipe or Back: the card goes back down)
      st.focusSheet = null; st.focus = null;
      if (!st.dead) draw(st);
    }});
  rec.stopFoil = bindCardFoil(rec.sh.body);
  rec.sh.body.addEventListener('click', e => sheetAction(st, e, rec));
  st.focusSheet = rec;
}
const cardOf = (st, f) => f && st.el.querySelector(f.kind === 'hand' ? `[data-db-hand="${f.i}"]` : `[data-db-slot="${f.u}"][data-side="${f.side || 'me'}"]`);
// (the preview's buttons: each one a move, or a place in the setup lineup; anywhere else outside the card sets it down)
function sheetAction(st, e, rec) {
  const q = s => e.target.closest(s);
  let b;
  if (!q('button, .db-pv-card, .db-pv-tab, .db-pv-why')) { if (st.focusSheet === rec) rec.sh.close(); return; }
  if (!st.x || st.scene || st.dead) return;
  if ((b = q('[data-db-details]'))) { const F = st.focus; if (F) detail(st, F.kind === 'hand' ? st.x.G.p[st.x.you].hand[F.i] : (rec.slot || {}).id, rec.slot); return; }
  if ((b = q('[data-db-attack]'))) { if (!b.disabled) send(st, {a: 'attack', n: Number(b.dataset.dbAttack)}); return; }
  if ((b = q('[data-db-play-hand]'))) { if (!b.disabled) playHand(st); return; }
  if ((b = q('[data-db-lineup]'))) { lineup(st, b.dataset.dbLineup); return; }
  if ((b = q('[data-db-promote]'))) { send(st, {a: 'promote', u: Number(b.dataset.dbPromote)}); return; }
  if ((b = q('[data-db-retreat]'))) { if (!b.disabled) send(st, {a: 'retreat', to: Number(b.dataset.dbRetreat)}); return; }
  if ((b = q('[data-db-energy]'))) { send(st, {a: 'energy', on: Number(b.dataset.dbEnergy)}); return; }
  if ((b = q('[data-db-switch]'))) {
    if (b.disabled) return;
    const me = st.x.G.p[st.x.you];
    if (me.bench.length === 1) { send(st, {a: 'retreat', to: me.bench[0].u}); return; }
    st.focus = null; st.mode = {k: 'retreat'}; draw(st);
  }
}
// (a hand player's plays, to read before he's out)
function attackPreviewList(stats, v = RV) {
  return B.attacksOf(stats.id, v).map(a => `<span class="db-move is-read"><span class="db-move-cost">${a.cost.map(pipHTML).join('')}</span><span class="db-move-name"><b>${esc(a.name)}</b>${B.fxText(a) ? `<small>${esc(B.fxText(a))}</small>` : ''}</span><strong>${a.dmg}<small>DMG</small></strong></span>`).join('');
}

// (no app menu at the foot while you play, as on the Dynasty page: views/dynasty.js fullScreen)
function fullScreen(st, on) {
  document.documentElement.classList.toggle('is-dynasty-battle', !!on && !st.dead && D.mayPlay());
}
// (the focus: dropped when what it lifted is gone)
function focusValid(st, x, mySlots) {
  const F = st.focus, me = x.G.p[x.you];
  if (!F) return null;
  if (F.kind === 'hand') return me.hand[F.i] === F.id && !(x.state === 'setup' && (st.setup.actI === F.i || st.setup.benchI.includes(F.i))) ? F : null;
  const list = F.side === 'opp' ? B.slots(x.G.p[1 - x.you]) : [mySlots.active, ...mySlots.bench].filter(Boolean);
  return list.some(s => s.u === F.u) ? F : null;
}
function draw(st) {
  if (st.dead) return;
  const host = st.el.querySelector('[data-db]');
  host.classList.toggle('is-owner-table', D.tableOpen());
  // (Evan's and Ryan Stewart's alone, Oct 28 2026: a profile switched while it's open leaves it)
  if (!D.mayPlay()) { clearCinema(st); st.focus = null; closeFocus(st); fullScreen(st, false); host.innerHTML = ''; if (!st.left) { st.left = true; st.ctx.back(); } return; }
  if (D.status !== 'ready') { host.innerHTML = `<div class="db-msg">${ui.skeleton('rows', 3, {label: 'Loading the battle'})}</div>`; return; }
  const close = ui.iconButton({icon: 'close', label: 'Back to Rivals', cls: 'db-x', attrs: 'data-back'});
  // (friend battles are paused, features.rivalsVersus: a saved link to one shows this, never the match)
  if (!SOLO.isSolo(st.mid) && !rivalsVersus()) {
    clearCinema(st); st.focus = null; closeFocus(st); st.x = null;
    host.innerHTML = `<header class="db-top">${close}</header><div class="db-msg">${ui.empty({icon: 'versus', title: 'Friend battles are paused', body: 'Multiplayer battles are off while the gameplay is reworked. Your matches are saved. Play the Solo ladder in the meantime.'})}</div>`;
    return;
  }
  const x = src(st).get(st.mid);
  if (D.tableOpen() && st.touch?.active && st.touch.revision === x?.G?.ev.length) return;
  st.touch?.cancel();
  if (!x || !x.G) {
    st.focus = null; closeFocus(st);
    const why = !x ? 'This battle isn’t here (yet). It shows once the board has it.' : x.state === 'invite' ? `${x.opp.name} challenged you. Accept it on the Battle tab.`
      : x.state === 'sent' ? `Waiting for ${x.opp.name} to accept your challenge.` : 'This battle was called off.';
    host.innerHTML = `<header class="db-top">${close}</header><div class="db-msg">${ui.empty({icon: 'versus', title: 'Battle', body: why})}</div>`;
    return;
  }
  const finishedNow = st.evAt != null && st.x && st.x.state !== 'over' && x.state === 'over';
  st.x = x; RV = x.G.v; energyRule = x.G.roundEnergy || 0;
  const enhanced = D.tableOpen(), finish = enhanced ? D.tableFinish() : null;
  host.classList.toggle('is-owner-table', enhanced);
  if (enhanced) {
    host.dataset.turn = x.state === 'theirs' ? 'opponent' : 'you';
    host.dataset.finish = finish.id;
    host.style.setProperty('--felt', finish.color); host.style.setProperty('--away', finish.away);
  }
  const G = x.G, you = x.you, me = G.p[you], op = G.p[1 - you], over = x.state === 'over';
  const myMove = x.state === 'yours' || x.state === 'setup';
  if (x.state === 'setup' && !st.setup.init) {
    if (enhanced) st.setup = {act: null, actI: -1, bench: [], benchI: [], init: true};
    else suggestLineup(st, me.hand);
  }
  if (!myMove) st.mode = null;
  const mode = st.mode;
  const mySlots = x.state === 'setup' ? setupSlots(st) : me;
  st.focus = focusValid(st, x, mySlots);
  const can = m => myMove && B.check(G, you, m).ok;
  const pickMine = u => {
    if (!mode || G.phase === 'setup') return false;
    if (mode.k === 'evolve') return can({a: 'evolve', id: mode.id, on: u});
    if (mode.k === 'coach') return can({a: 'coach', id: mode.id, on: u});
    if (mode.k === 'item') return can({a: 'item', id: mode.id, on: u});
    if (mode.k === 'retreat') return can({a: 'retreat', to: u});
    return false;
  };
  const canAttack = x.state === 'yours' && !me.promote && me.active && B.attacksOf(me.active.id, G.v).some((a, n) => B.check(G, you, {a: 'attack', n}).ok);
  // the status line
  let status;
  if (over) status = `<b class="${x.result === 'w' ? 'is-w' : x.result === 'l' ? 'is-l' : ''}">${x.result === 'w' ? 'You win!' : x.result === 'l' ? 'You lose' : 'A draw'}</b> ${esc({points: G.v >= 6 ? 'Three players knocked out.' : 'Three touchdowns.', empty: 'No players left.', time: 'The turn limit.', resign: x.result === 'w' ? 'They resigned.' : 'You resigned.', claim: 'Left 72 hours.'}[x.why] || '')}`;
  else if (x.state === 'setup' && enhanced) status = st.setup.act ? '<b>Ready to play.</b> Add reserves to your bench, then Start.' : '<b>Choose your starter.</b> Hold a player card, then drag to Active.';
  else if (x.state === 'setup') status = st.setup.act ? '<b>Your lineup is set.</b> Tap a card to change it, then Start.' : 'Tap a Basic player in your hand to start with him.';
  else if (x.state === 'theirs') status = G.phase === 'setup' ? `Waiting for ${esc(x.opp.name)} to set up.` : x.solo ? `${esc(x.opp.name)} is playing…` : `${esc(x.opp.name)}’s turn. You’ll see it here when they move.`;
  else if (me.promote) status = '<b>Your player was knocked out.</b> Tap a bench player to send in.';
  else if (mode) status = {evolve: 'Tap the player to upgrade.', coach: 'Tap a player for it.', item: 'Tap a player for it.', retreat: 'Tap the bench player to send in.'}[mode.k] + ' <button type="button" class="db-link" data-db-cancel>Cancel</button>';
  else status = canAttack ? '<b>Your turn.</b> Your active player is ready to attack.' : '<b>Your turn.</b> Play cards from your hand, or end your turn.';
  // your hand, fanned (setup: the cards not in the lineup)
  const inLineup = i => x.state === 'setup' && (st.setup.actI === i || st.setup.benchI.includes(i));
  const hand = me.hand.map((id, i) => ({id, i})).filter(c => !inLineup(c.i));
  const mid = (hand.length - 1) / 2, spread = Math.min(5, 20 / Math.max(1, hand.length));
  const handHTML = hand.map(({id, i}, n) => {
    const off = n - mid, lifted = st.focus && st.focus.kind === 'hand' && st.focus.i === i;
    const playable = x.state === 'yours' && !me.promote && !mode && handAction(G, you, id).ok;
    return `<button type="button" class="db-card${lifted ? ' is-lifted' : ''}${playable ? ' is-playable' : ''}" style="--rot:${(off * spread).toFixed(1)}deg;--lift:${Math.round(Math.min(enhanced ? 18 : Infinity, off * off * spread * 0.55))}px;--z:${n + 1}" data-db-hand="${i}" aria-label="${esc(nameOf(id))}${playable ? ', playable' : ''}">${faceHTML(id)}</button>`;
  }).join('');
  const stadium = G.stadium ? `<span class="db-stad">${ui.icon('star', {size: 13})}${esc(D.trainer(G.stadium.id).name)}</span>` : '';
  const last = G.ev.at(-1);
  if (G.roundEnergy && x.state === 'yours' && !me.promote && !mode && last?.k === 'energy' && last.who === you) {
    const draw = G.ev.find(e => e.n === G.turn && e.k === 'draw' && e.who === you);
    status = esc(draw ? evText(draw, you, x.opp.name) : 'Your deck is empty.') + (G.roundEnergy === B.FRONT_ENERGY ? ` Your lineup gained ${esc(B.ENERGY[last.e])} energy.` : ' Your lineup gained energy.');
  }
  const log = G.ev.map(e => ({e, t: evText(e, you, x.opp.name)})).filter(l => l.t).slice(-1);
  const lifted = (side, u) => st.focus && st.focus.kind !== 'hand' && (st.focus.side || 'me') === side && st.focus.u === u;
  const mine = (slot, act) => slotHTML(slot, 'me', act, {pick: !!slot && pickMine(slot.u) || (!!slot && me.promote && x.state === 'yours' && !act),
    ready: !!slot && act && canAttack && !mode, lifted: !!slot && lifted('me', slot.u)});
  const theirs = (slot, act) => slotHTML(slot, 'opp', act, {lifted: !!slot && lifted('opp', slot.u)});
  const cpu = x.solo && x.opp.cpu;
  const kicker = cpu && cpu.n ? `GAME ${cpu.n} · ${cpu.tier.name.toUpperCase()}` : x.solo ? 'SOLO MATCH' : 'FRIEND MATCH';
  host.innerHTML = `<header class="db-top">${close}<div class="db-match-title"><small>${esc(kicker)}</small><b>${esc(x.opp.name)}</b></div><span class="db-score" aria-label="Score: you ${me.pts}, opponent ${op.pts}"><b>${me.pts}</b><i>:</i><b>${op.pts}</b><small>${G.v >= 6 ? 'KNOCKOUTS' : `First to ${B.WIN_POINTS}`}</small></span>${ui.iconButton({icon: 'list', label: 'Battle log and options', cls: 'db-more', attrs: 'data-db-more'})}</header>`
    + `<div class="db-table">${enhanced ? `<div class="db-table-brand" aria-hidden="true">GRIDIRON <b>RIVALS</b></div><div class="db-turn-chip">${over ? 'FINAL' : x.state === 'setup' ? 'SET YOUR LINEUP' : x.state === 'theirs' ? 'OPPONENT’S TURN' : 'YOUR TURN'}</div>` : ''}<div class="db-opponent-hand" aria-label="${op.hand.length} cards in their hand · ${op.deck.length} in their deck">${Array.from({length: Math.min(op.hand.length, 8)}, () => enhanced ? '<button type="button" data-db-hidden aria-label="Opponent’s face-down card">R</button>' : '<span aria-hidden="true">R</span>').join('')}<small>${enhanced ? `${op.hand.length} in hand` : `${op.hand.length} in hand · ${op.deck.length} in deck`}</small></div>`
    + `<section class="db-side is-opp" aria-label="${esc(x.opp.name)}’s players"><div class="db-row is-bench">${[0, 1, 2].map(i => theirs(op.bench[i], false)).join('')}</div><div class="db-row is-active">${theirs(op.active, true)}${energySourceHTML(op.active, G, false)}${enhanced ? deckPileHTML(op.deck.length, false) : ''}</div></section>`
    + `<div class="db-mid" data-db-drop="play"><p class="db-status" aria-live="polite">${status}</p>${stadium}<button type="button" class="db-log" data-db-log aria-label="Open battle log">${log.map(l => `<span>${esc(l.t)}</span>`).join('') || (G.v >= 6 ? '<span>Lose three players and the match is over.</span>' : '<span>First to three touchdowns wins.</span>')}</button></div>`
    + `<section class="db-side is-me" aria-label="Your players"><div class="db-row is-active">${mine(mySlots.active, true)}${energySourceHTML(mySlots.active, G, true)}${enhanced ? deckPileHTML(me.deck.length, true) : ''}</div><div class="db-row is-bench">${[0, 1, 2].map(i => mine(mySlots.bench[i], false)).join('')}</div></section>${enhanced ? `<div class="db-table-bottom"><button data-db-table type="button">♧ ${esc(finish.name)}</button><button data-db-pile="discard" type="button">${me.disc.length} discarded</button></div>` : ''}</div>`
    + `<section class="db-hand-section" aria-label="Your hand: ${me.hand.length} cards, ${me.deck.length} in your deck"><div class="db-hand"><div class="db-hand-fan" style="--n:${Math.max(1, hand.length)}">${handHTML || `<span class="db-none">${x.state === 'setup' ? 'Every card is in your lineup' : 'No cards in hand'}</span>`}</div></div></section>`
    + `<footer class="db-bar">${barHTML(st, x, G, me, myMove, over, canAttack)}</footer>`;
  ui.hydrate(host);
  syncFocus(st, x, mySlots);
  // (what happened since you last looked: their turn, line by line)
  if (!st.shown) {
    st.shown = true;
    let seen = Number(ui.lsGet(SEEN(st.mid))) || 0;
    const fresh = G.ev.slice(seen).filter(e => e.who !== you).map(e => evText(e, you, x.opp.name)).filter(Boolean);
    if (fresh.length && seen > 0) ui.openSheet({title: `${x.opp.name}’s turn`, body: `<ol class="db-recap">${fresh.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`, cls: 'pk-sheet', detents: ['fit']});
  }
  ui.lsSet(SEEN(st.mid), String(G.ev.length));
  // Only fresh, resolved public events are presented. Opening a saved match never replays old moves.
  const freshEvents = st.evAt == null ? [] : G.ev.slice(st.evAt);
  st.evAt = G.ev.length;
  if (enhanced && !st.tossShown && G.phase === 'setup') {
    st.tossShown = true;
    st.scenes.push({ev: {k: 'toss', heads: G.first === you}, you, opp: x.opp.name});
    nextCinema(st);
  }
  if (!st.hidden && finishedNow) st.resultSound = x.result === 'w' ? 'victory' : x.result === 'l' ? 'defeat' : 'draw';
  if (!st.hidden && freshEvents.length) {
    freshEvents.filter(e => ['attack', 'bench', 'evolve', 'coach', 'item', 'stadium'].includes(e.k)).forEach(e => {
      const after = freshEvents.slice(freshEvents.indexOf(e) + 1);
      const nextAttack = after.findIndex(n => n.k === 'attack');
      const knockout = after.slice(0, nextAttack < 0 ? after.length : nextAttack).some(n => n.k === 'ko');
      st.scenes.push({ev: {...e, knockout}, you, opp: x.opp.name});
    });
    if (freshEvents.some(e => e.k === 'ko')) ui.haptic('success');
    if (!st.scenes.length && !st.scene && !st.resultSound && freshEvents.some(e => e.k === 'turn' && e.who === you)) st.sfx.play('turn');
    nextCinema(st);
  }
  if (st.resultSound && !st.scene && !st.scenes.length) { st.sfx.play(st.resultSound); st.resultSound = null; }
  if (over && !st.cheered) {
    st.cheered = true;
    if (x.result === 'w') { try { ui.confetti(host.getBoundingClientRect()); } catch (_) {} }
  }
}
function barHTML(st, x, G, me, myMove, over, canAttack) {
  if (over && x.solo) {
    // (a Solo battle: its coins, the first win's bonus packs, and the next game or another go)
    const p = x.pay || {coins: 0}, cpu = x.opp.cpu;
    const packs = p.packs && !p.bossPack ? Object.entries(p.packs).map(([k, n]) => `${n > 1 ? n + ' ' : ''}${D.PACKS[k].name}${n > 1 ? 's' : ''}`).join(', ') : '';
    const next = cpu.n && x.result === 'w' && cpu.n < SOLO.LADDER && SOLO.unlocked('g' + (cpu.n + 1));
    const prize = D.bossLadderOpen() && p.card ? D.card(p.card) : null;
    const bossPrize = prize ? `Boss card earned: ${prize.name} · ${D.RARITY_NAME[prize.r]}`
      : D.bossLadderOpen() && D.PACKS[p.bossPack] ? `Boss reward earned: ${D.PACKS[p.bossPack].name}` : '';
    return `<span class="db-pay">${bossPrize ? `<b class="db-boss-prize">${ui.icon('trophy', {size: 16})}${esc(bossPrize)}</b>` : ''}${p.coins ? `+${nf(p.coins)} coins` : 'No coins this time'}${packs ? ` · First win: ${esc(packs)}` : ''}</span>`
      + ui.button({label: x.result === 'w' ? 'Play again' : 'Try again', kind: next ? 'secondary' : 'primary', size: 's', attrs: {'data-db-again': ''}})
      + (next ? ui.button({label: `Game ${cpu.n + 1}`, kind: 'primary', size: 's', attrs: {'data-db-next': ''}}) : ui.button({label: 'Done', kind: 'secondary', size: 's', attrs: 'data-back'}));
  }
  if (over) {
    const pay = D.BATTLE_PAY[x.result];
    return `<span class="db-pay">+${nf(pay.coins)} coins · ${pay.tr >= 0 ? '+' : ''}${pay.tr} trophies</span>${ui.button({label: 'Back to Rivals', kind: 'primary', size: 's', attrs: 'data-back'})}`;
  }
  if (x.state === 'setup') return ui.button({label: 'Start', kind: 'primary', attrs: {'data-db-ready': ''}, disabled: !st.setup.act, cls: 'db-go'});
  if (!myMove) return `<span class="db-wait">${ui.icon('clock', {size: 15})} ${x.solo ? `${esc(x.opp.name)} is playing` : 'Their move'}</span>`;
  const hint = me.promote ? 'Send in a bench player' : D.tableOpen() ? 'Hold to inspect · hold + drag to play' : 'Tap any card to see what it can do';
  return `<span class="db-hint">${esc(hint)}</span>` + ui.button({label: 'End turn', kind: canAttack ? 'secondary' : 'primary', size: 's', attrs: {'data-db-end': ''}, disabled: me.promote});
}

// ---------------------------------------------------------------------------------------------------- moves
function send(st, m) {
  if (st.dead || st.scene || !D.mayPlay()) return false;
  const r = src(st).move(st.mid, m);
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return false; }
  st.mode = null; st.focus = null;
  if (r.sent && m.a !== 'setup') ui.toast(`Turn sent. ${st.x ? st.x.opp.name : 'They'} will see it.`, {icon: 'check-circle'});
  ui.haptic('selection');
  draw(st);
  return true;
}
function detail(st, id, slot) {
  const st2 = B.stats(id);
  const hp = slot && st2 ? `<p class="pk-own">${Math.max(0, st2.hp - slot.dmg)} of ${st2.hp} HP left${slot.en.length ? ` · energy ${energyHTML(slot.en)}` : ''}${slot.stun ? ' · Stunned' : ''}${slot.inj ? ' · Injured' : ''}${slot.attachment ? ` · ${esc(nameOf(slot.attachment))} attached` : ''}</p>` : '';
  let stopFoil = () => {};
  const sh = ui.openSheet({title: nameOf(id), body: `<div class="pk-zoom is-s">${anyHTML(id, {size: 'm', tag: false, rulesVersion: st.x.G.v, roundEnergy: st.x.G.roundEnergy || 0})}</div>${hp}${battleHTML(id, st.x.G)}`, cls: 'pk-sheet', detents: ['large'], onClose: () => stopFoil()});
  stopFoil = bindCardFoil(sh.body);
}
function lift(st, f) {
  st.focus = f; st.mode = null;
  st.sfx.play('card');
  ui.haptic('selection');
  draw(st);
}
function playHand(st) {
  const x = st.x, me = x.G.p[x.you], F = st.focus, id = F && me.hand[F.i];
  if (!id || id !== F.id || x.state !== 'yours') return;
  const action = handAction(x.G, x.you, id);
  if (!action.ok) { ui.toast(action.why, {icon: 'info'}); return; }
  if (action.targeted) {
    if (action.candidates.length === 1) { send(st, {a: action.a, id, on: action.candidates[0].u}); return; }
    st.focus = null; st.mode = {k: action.a, id}; draw(st); return;
  }
  send(st, {a: action.a, id});
}
// (setup: the lifted card's place in the lineup)
function lineup(st, how) {
  const S = st.setup, F = st.focus;
  if (!F) return;
  if (F.kind === 'hand') {
    if (how === 'act') {
      if (S.act) {
        if (S.bench.length < B.BENCH_MAX) { S.bench.push(S.act); S.benchI.push(S.actI); }
      }
      S.act = F.id; S.actI = F.i;
    } else if (how === 'bench' && S.bench.length < B.BENCH_MAX) { S.bench.push(F.id); S.benchI.push(F.i); }
  } else if (F.u === -1) {
    if (how === 'hand') {
      S.act = null; S.actI = -1;
      if (S.bench.length) { S.act = S.bench.shift(); S.actI = S.benchI.shift(); }
    }
  } else {
    const k = -2 - F.u, id = S.bench[k], i = S.benchI[k];
    S.bench.splice(k, 1); S.benchI.splice(k, 1);
    if (how === 'promote') {
      if (S.act) { S.bench.splice(k, 0, S.act); S.benchI.splice(k, 0, S.actI); }
      S.act = id; S.actI = i;
    }
  }
  st.focus = null; ui.haptic('selection'); st.sfx.play('card'); draw(st);
}
function slotTap(st, u, side) {
  const x = st.x, G = x.G, you = x.you, me = G.p[you];
  if (x.state !== 'setup' && side === 'me' && st.mode) {
    const mode = st.mode;
    const m = mode.k === 'retreat' ? {a: 'retreat', to: u} : {a: mode.k, id: mode.id, on: u};
    const r = B.check(G, you, m);
    if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
    send(st, m); return;
  }
  if (x.state === 'yours' && side === 'me' && me.promote && me.bench.some(s => s.u === u)) { send(st, {a: 'promote', u}); return; }
  lift(st, {kind: 'slot', side, u});
}
function endTurn(st) {
  const x = st.x, me = x.G.p[x.you];
  const canAttack = me.active && B.attacksOf(me.active.id, x.G.v).some((a, n) => B.check(x.G, x.you, {a: 'attack', n}).ok);
  if (!canAttack) { send(st, {a: 'end'}); return; }
  ui.actionSheet({title: 'End your turn without attacking?', cls: 'pk-sheet', actions: [{label: 'End turn', role: 'primary', value: 'y'}]}).then(v => { if (v === 'y') send(st, {a: 'end'}); });
}
function more(st) {
  ui.actionSheet({title: 'Battle', cls: 'pk-sheet', actions: [...(rivalsUpdated() ? [{label: 'Settings', value: 'music'}] : []), ...(D.tableOpen() ? [{label: 'Table finishes & challenges', value: 'table'}] : []), {label: 'Whole battle log', value: 'log'}, {label: 'Resign', role: 'destructive', value: 'resign'}]}).then(v => {
    if (v === 'music' && !st.dead && !st.hidden) musicSheet();
    if (v === 'table') tableOptions(() => draw(st));
    if (v === 'log') logSheet(st);
    if (v === 'resign') resign(st);
  });
}
function resign(st) {
  ui.actionSheet({title: 'Resign this battle?', message: SOLO.isSolo(st.mid) ? 'It counts as a loss against the computer.' : 'It counts as a loss.', cls: 'pk-sheet', actions: [{label: 'Resign', role: 'destructive', value: 'y'}]}).then(v => {
    if (v !== 'y') return;
    const r = src(st).resign(st.mid);
    if (!r.ok) ui.toast(r.why, {icon: 'info'}); else draw(st);
  });
}
function logSheet(st) {
  const x = st.x, lines = [];
  x.G.ev.forEach(e => {
    if (e.k === 'turn') { lines.push(`<li class="db-lt">${e.who === x.you ? 'Your turn' : `${esc(x.opp.name)}’s turn`}</li>`); return; }
    const t = evText(e, x.you, x.opp.name);
    if (t) lines.push(`<li>${esc(t)}</li>`);
  });
  ui.openSheet({title: 'Battle log', body: `<ol class="db-recap">${lines.reverse().join('')}</ol>`, cls: 'pk-sheet', detents: ['large']});
}
function soloAgain(st, id) {
  const r = SOLO.start(id);
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
  st.ctx.nav(`/puzzles/dynasty/battle/${r.mid}`);
}

function hiddenCard() {
  ui.openSheet({title: 'Opponent’s hand', body: '<p class="pk-note">These cards stay face down until played. Hold any player on the table to inspect their HP, energy and attacks.</p>', cls: 'pk-sheet', detents: ['fit']});
}
// The rest of each deck, face down on the felt beside its active player (Nov 6 2026, Evan: "place the rest of the
// players deck face down on the table"): the printed back, a stack that thins as the deck runs down, and its count.
// Yours opens the deck sheet (what's left, never the order); theirs is only a count.
function energySourceHTML(active, G, mine) {
  if (G.roundEnergy !== B.FRONT_ENERGY || !active || G.phase === 'over') return '';
  const e = B.typeEnergy(B.stats(active.id).type, G.roundEnergy);
  return `<span class="db-energy-source is-${mine ? 'me' : 'opp'}" title="Next turn’s energy from ${esc(nameOf(active.id))}">${pipHTML(e)}<small>Next turn</small><b>${esc(B.ENERGY[e])}</b></span>`;
}
function deckPileHTML(n, mine) {
  const layers = n ? Math.min(4, Math.ceil(n / 10)) : 0;
  const body = `${Array.from({length: layers}, (_, k) => `<i style="--k:${layers - k}"></i>`).join('')}<span class="db-pile-top">${n ? '<img src="img/rivals/card-back-v1.webp" alt="" decoding="async" draggable="false">' : ''}</span><b>${n}</b>`;
  const cls = `db-pile ${mine ? 'is-me' : 'is-opp'}${n ? '' : ' is-empty'}`;
  return mine
    ? `<button type="button" class="${cls}" data-db-pile="deck" aria-label="Your deck: ${n} card${n === 1 ? '' : 's'} left, face down">${body}</button>`
    : `<div class="${cls}" role="img" aria-label="Their deck: ${n} card${n === 1 ? '' : 's'} left, face down">${body}</div>`;
}
function pileSheet(st, kind) {
  const side = st.x.G.p[st.x.you], ids = kind === 'deck' ? side.deck : side.disc, counts = {};
  ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  // Sort names, never expose the next draw or the opponent's hidden cards.
  const body = `<p class="pk-note">${ids.length} cards${kind === 'deck' ? ' remaining. Draw order stays hidden.' : ' discarded.'}</p>`
    + Object.keys(counts).sort((a,b) => nameOf(a).localeCompare(nameOf(b))).map(id => `<button type="button" class="rt-pile-card" data-rt-card="${esc(id)}">${esc(nameOf(id))}<b>×${counts[id]}</b></button>`).join('');
  const sh = ui.openSheet({title: kind === 'deck' ? 'Your deck' : 'Discard pile', body, cls: 'pk-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-rt-card]'); if (b) detail(st, b.dataset.rtCard); });
}
function tableGestures(st) {
  const enabled = () => D.tableOpen() && !st.dead && !st.hidden && st.x && !st.scene && !st.focus && !ui.sheetCount();
  const valid = v => enabled() && v.mid === st.mid && v.rev === st.x.G.ev.length && st.x.G.p[st.x.you].hand[v.i] === v.id;
  function action(v, drop) {
    if (!valid(v) || !['setup', 'yours'].includes(st.x.state)) return null;
    const G = st.x.G, who = st.x.you, me = G.p[who];
    if (st.x.state === 'setup') {
      if (!B.basicIn(v.id, G.v) || st.setup.actI === v.i || st.setup.benchI.includes(v.i)) return null;
      if (drop === 'active' || drop === 'slot:-1') return {setup: 'act'};
      if (drop === 'bench' && st.setup.bench.length < B.BENCH_MAX) return {setup: 'bench'};
      return null;
    }
    const a = handAction(G, who, v.id);
    if (!a.ok || me.promote) return null;
    const on = drop.startsWith('slot:') ? Number(drop.slice(5)) : null;
    if (a.targeted) return a.candidates.some(s => s.u === on) ? {a: a.a, id: v.id, on} : null;
    if (a.a === 'bench') return drop === 'bench' ? {a: 'bench', id: v.id} : null;
    return drop === 'play' ? {a: a.a, id: v.id} : null;
  }
  return bindTableTouch(st.el, {
    enabled,
    describe(card) {
      if (card.hasAttribute('data-db-hidden')) return {hidden: true, rev: st.x.G.ev.length};
      const G = st.x.G;
      if (card.hasAttribute('data-db-hand')) {
        const i = Number(card.dataset.dbHand), id = G.p[st.x.you].hand[i];
        return {kind: 'hand', i, id, mid: st.mid, rev: G.ev.length, draggable: ['setup', 'yours'].includes(st.x.state)};
      }
      const u = Number(card.dataset.dbSlot), side = card.dataset.side;
      const mine = st.x.state === 'setup' ? setupSlots(st) : G.p[st.x.you];
      const slot = B.slots(side === 'opp' ? G.p[1 - st.x.you] : mine).find(s => s.u === u);
      return slot ? {kind: 'slot', side, u, id: slot.id, slot, rev: G.ev.length} : null;
    },
    preview(v) {
      if (v.hidden) return '<div class="db-peek-in"><div class="db-card-back">R</div><b>Opponent’s hand</b><p>Face down until played</p></div>';
      const t = D.trainer(v.id), stats = B.stats(v.id);
      return `<div class="db-peek-in"><div class="db-peek-card">${faceHTML(v.id, v.slot)}</div><b>${esc(nameOf(v.id))}</b><p>${esc(t ? B.trainerText(t, st.x.G.roundEnergy) : `${stats.hp} HP · ${B.TYPES[stats.type].name}`)}</p>${stats ? `<div class="db-moves is-info">${attackPreviewList(stats, st.x.G.v)}</div>` : ''}<small>${v.kind === 'hand' ? 'Slide across your hand to preview · ' : ''}${v.draggable ? 'Drag onto a glowing space to play · release to inspect' : 'Release to inspect · no move is played'}</small></div>`;
    },
    accepts: (v, drop) => !!action(v, drop),
    drop(v, drop) { const m = action(v, drop); if (!m) return; if (m.setup) { st.focus = v; lineup(st, m.setup); } else send(st, m); },
    inspect(v) { if (v.hidden) hiddenCard(); else lift(st, v); },
    invalid() { ui.toast('Card returned to hand. Drop on a highlighted space to play.', {icon: 'info'}); },
    haptic() { ui.haptic('selection'); }
  });
}

// Coin results are already in the seeded match log. Tapping reveals, never rerolls.
function tableScene(st, scene) {
  st.touch?.cancel(); st.scene = scene;
  const ev = scene.ev, toss = ev.k === 'toss';
  const flips = ev.flips || (ev.heads != null ? [ev.heads] : ev.stunned != null ? [ev.stunned] : []);
  const text = toss ? ev.heads ? 'Heads · You go first' : `${scene.opp} goes first · You go second` : evText(ev, scene.you, scene.opp);
  scene.coinText = text;
  const host = st.el.querySelector('[data-db]');
  const el = document.createElement('section'); el.className = 'db-cinema is-table-scene';
  el.dataset.dbScene = flips.length ? 'coin' : 'card';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', toss ? 'Opening coin toss' : 'Play result');
  el.innerHTML = `<div class="db-event"><small>${toss ? 'OPENING COIN TOSS' : ev.who === scene.you ? 'YOUR PLAY' : 'OPPONENT’S PLAY'}</small><h2>${esc(toss ? 'Who goes first?' : ev.name || nameOf(ev.id))}</h2>`
    + (flips.length ? `<button type="button" class="db-coin" data-db-coin aria-label="Reveal coin flip"><span>R</span></button><p data-db-coin-result>Tap the coin to flip</p><div class="db-coin-results" hidden>${flips.map(f => `<b class="${f ? 'is-heads' : 'is-tails'}">${f ? 'HEADS' : 'TAILS'}</b>`).join('')}</div>`
      : `<div class="db-event-card">${faceHTML(ev.id)}</div><p>${esc(text)}</p>`)
    + `<button type="button" class="db-act is-back" data-db-skip>${flips.length ? 'Skip animation' : 'Continue'}</button></div>`;
  st.el.append(el); host.inert = true; host.classList.add('is-presenting');
  el.querySelector('button').focus({preventScroll: true});
  el.addEventListener('keydown', e => { if (e.key !== 'Tab') return; const btns = [...el.querySelectorAll('button:not(:disabled)')]; const next = (btns.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + btns.length) % btns.length; e.preventDefault(); btns[next].focus(); });
  if (!flips.length) st.sfx.play(sfx.eventCue(ev), {pan: ev.who === scene.you ? -.15 : .15});
  if (flips.length) st.coinTimer = setTimeout(() => revealCoin(st), 3500);
  else st.sceneTimer = setTimeout(() => finishCinema(st), scene.ev.who === 1 - scene.you && SOLO.isSolo(st.mid) ? 2800 : matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 1000);
}
function revealCoin(st) {
  const el = st.el.querySelector('.is-table-scene'), coin = el?.querySelector('[data-db-coin]');
  if (!coin || coin.disabled) return;
  clearTimeout(st.coinTimer); coin.disabled = true; coin.classList.add('is-flipping');
  st.sfx.play('coin');
  if (st.scene.ev.k !== 'toss') st.sfx.play(sfx.eventCue(st.scene.ev), {delay: .55});
  coin.querySelector('span').textContent = st.scene.ev.heads === false ? 'T' : 'H';
  el.querySelector('.db-coin-results').hidden = false;
  el.querySelector('[data-db-coin-result]').textContent = st.scene.coinText;
  el.querySelector('[data-db-skip]').textContent = 'Continue';
  el.querySelector('[data-db-skip]').focus({preventScroll: true});
  st.sceneTimer = setTimeout(() => finishCinema(st), st.scene.ev.who === 1 - st.scene.you && SOLO.isSolo(st.mid) ? 2800 : 1600);
}

const legacyView = {
  id: 'dynasty-battle',
  chrome: 'none',
  title: 'Battle',

  render() { return '<div class="db" data-db data-no-swipe></div>'; },

  mount(el, ctx) {
    const st = {el, ctx, mid: String((ctx.params && ctx.params.id) || ''), mode: null, focus: null, scenes: [], scene: null, hidden: false, setup: {act: null, actI: -1, bench: [], benchI: []}, dead: false, stops: [], evAt: null};
    ST.set(ctx, st);
    st.music = attachMusic(el, ctx.visible, 'battle');
    st.sfx = sfx.attach(el, ctx.visible);
    st.stops.push(() => st.sfx.stop());
    st.stops.push(() => st.music.stop());
    fullScreen(st, ctx.visible);
    st.touch = tableGestures(st);
    st.stops.push(() => st.touch.stop());
    if (SOLO.isSolo(st.mid)) st.stops.push(SOLO.watchPlayback(st.mid, () => !st.dead && !st.hidden
      && !document.hidden && !st.scene && !st.scenes.length && !st.focus && !st.touch?.active
      && !ui.sheetCount() && !document.querySelector('.sheet')));
    el.addEventListener('click', e => {
      const q = s => e.target.closest(s);
      let b;
      if (q('[data-db-skip]')) { finishCinema(st); return; }
      if (q('[data-db-coin]')) { revealCoin(st); return; }
      if (!st.x || st.scene) return;
      if (D.tableOpen() && q('[data-db-table]')) { tableOptions(() => draw(st)); return; }
      if (D.tableOpen() && (b = q('[data-db-pile]'))) { pileSheet(st, b.dataset.dbPile); return; }
      if (D.tableOpen() && q('[data-db-hidden]')) { hiddenCard(); return; }
      if (q('[data-db-cancel]')) { st.mode = null; draw(st); return; }
      if ((b = q('[data-db-hand]'))) { const i = Number(b.dataset.dbHand); lift(st, {kind: 'hand', i, id: st.x.G.p[st.x.you].hand[i]}); return; }
      if ((b = q('[data-db-slot]'))) { slotTap(st, Number(b.dataset.dbSlot), b.dataset.side); return; }
      if (q('[data-db-end]')) { endTurn(st); return; }
      if (q('[data-db-ready]')) {
        const S = st.setup;
        if (send(st, {a: 'setup', act: S.act, bench: S.bench.slice()})) st.setup = {act: null, actI: -1, bench: [], benchI: []};
        return;
      }
      if (q('[data-db-resign]')) { resign(st); return; }
      if (q('[data-db-again]')) { soloAgain(st, st.x.opp.cpu.id); return; }
      if (q('[data-db-next]')) { soloAgain(st, 'g' + (st.x.opp.cpu.n + 1)); return; }
      if (q('[data-db-more]')) { more(st); return; }
      if (q('[data-db-log]')) logSheet(st);
    });
    el.addEventListener('keydown', e => {
      if (st.scene) { if (e.key === 'Escape') { e.preventDefault(); finishCinema(st); } return; }
    });
    // (their moves come in with the board)
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') draw(st); }));
    st.stops.push(MT.subscribe(() => draw(st)));
    st.stops.push(SOLO.subscribe(() => draw(st)));
    st.stops.push(data.subscribe(type => { if (type === 'me') { clearCinema(st); st.shown = false; st.evAt = null; st.focus = null; st.setup = {act: null, actI: -1, bench: [], benchI: []}; draw(st); } }));
    D.load().then(() => draw(st), () => draw(st));
    draw(st);
  },

  onShow(ctx) { const st = ST.get(ctx); if (st) { st.hidden = false; st.music.visible(true); st.sfx.visible(true); fullScreen(st, true); draw(st); } },

  onHide(ctx) { const st = ST.get(ctx); if (st) { st.hidden = true; st.music.visible(false); st.sfx.visible(false); st.touch?.cancel(); st.focus = null; closeFocus(st); clearCinema(st); fullScreen(st, false); } },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    fullScreen(st, false);
    st.dead = true;
    closeFocus(st);
    clearCinema(st);
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    MT.flush(); D.flush();
    ST.delete(ctx);
  }
};

// Select by the saved rules, never by today's default. Legacy replays keep their original screen.
const mounted = new WeakMap();
export default {
  id: 'dynasty-battle', chrome: 'none', title: 'Battle', render: () => legacyView.render(),
  mount(el, ctx) {
    const state = {dead: false, view: null, visible: ctx.visible}; mounted.set(ctx, state);
    D.load().then(() => {
      if (state.dead) return;
      const match = SOLO.isSolo(ctx.params?.id) ? SOLO.get(ctx.params.id) : null;
      // (live battles are always v7: core/rivals-live-match.js)
      state.view = (ctx.params?.id === 'tutorial' && rivalsUpdated()) || isLive(ctx.params?.id) || match?.G.v === 7 ? pocketView : legacyView;
      el.innerHTML = state.view.render(); state.view.mount(el, ctx);
      if (!state.visible) state.view.onHide?.(ctx);
    }, () => { if (!state.dead) el.innerHTML = '<p>Cards could not load. Return to Rivals and try again.</p>'; });
  },
  onShow(ctx) { const s = mounted.get(ctx); if (s) { s.visible = true; s.view?.onShow?.(ctx); } },
  onHide(ctx) { const s = mounted.get(ctx); if (s) { s.visible = false; s.view?.onHide?.(ctx); } },
  unmount(el, ctx) { const s = mounted.get(ctx); if (s) { s.dead = true; s.view?.unmount?.(el, ctx); mounted.delete(ctx); } }
};
