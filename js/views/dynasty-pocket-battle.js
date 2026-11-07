import {attachPresentation} from './dynasty-pocket-presentation.js';
// The v7 card duel. Saved v1-v6 games keep their original view and engine.
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-pocket.js';
import * as C from '../core/dynasty-pocket-cards.js';
import * as SOLO from '../core/dynasty-solo.js';
import * as LIVE from '../core/rivals-live-match.js';
import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import * as sfx from '../core/dynasty-sfx.js';
import {profileKey} from '../core/realm-active.js';
import {creditHTML} from './dynasty.js';
import {printedCard} from './dynasty-pocket-card.js';
import {attachHand} from './dynasty-pocket-hand.js';
import {attachPreview, conditionBadges} from './dynasty-pocket-preview.js';
import {attachMusic, musicSheet} from './dynasty-music.js';
import {tableOptions} from './dynasty-table-options.js';

const ST = new WeakMap(), esc = data.esc;
const name = id => C.card(id)?.name || 'Card';
const points = c => c.classification === 'mega-ex' ? 3 : c.classification === 'ex' ? 2 : 1;
const color = {Grass:'#398452',Fire:'#c65035',Water:'#3477ac',Lightning:'#a57916',Psychic:'#995c9c',Fighting:'#a1663c',Darkness:'#3e536e',Metal:'#69797a',Dragon:'#7c6c35',Colorless:'#77776d'};
const kind = c => c.kind === 'player' ? `${c.stage} Player${c.classification === 'ex' ? ' ex' : c.classification === 'mega-ex' ? ' Mega ex' : ''}` : c.kind[0].toUpperCase() + c.kind.slice(1);
const cost = a => a.cost?.length ? a.cost.join(' + ') : '0 Energy';
const typeOf = c => c.types?.join(' / ') || c.type || 'Colorless';
const all = p => [p.active, ...p.bench].filter(Boolean);
const rev = G => G?.rev === 2 ? 2 : 1;
const button = (label, attr, disabled = false, cls = '') => `<button type="button" class="rp-button ${cls}" ${attr}${disabled ? ' disabled' : ''}>${label}</button>`;
const energy = list => list.length ? list.map(e => `<span class="rp-energy" style="--energy:${color[e] || color.Colorless}" title="${esc(e)} Energy" aria-label="${esc(e)} Energy">${esc(e.slice(0, 1))}</span>`).join('') : '<span class="rp-none">No Energy</span>';

function face(id, slot, G) {
  const c = C.card(id);
  if (!c) return '';
  const print = `<span class="rp-card-print" aria-hidden="true">${printedCard(id, rev(G))}</span>`;
  if (!slot || c.kind !== 'player') return print;
  const max = B.hpOf(G, slot), hp = Math.max(0, max - slot.dmg);
  const badges = conditionBadges(slot.conditions);
  return print + `<span class="rp-live-hp">${hp}</span><span class="rp-hp" aria-label="${hp} of ${max} HP remaining"><i style="width:${Math.max(0,Math.min(100,hp/max*100))}%"></i></span><span class="rp-card-energy">${energy(slot.en)}</span>${badges ? `<span class="rp-condition">${badges}</span>` : ''}`;
}
function piece(id, slot, G, attrs = '', selected = false) {
  const c = C.card(id);
  return `<button type="button" class="rp-card ${c?.kind === 'player' ? 'is-player' : 'is-support'}${selected ? ' is-selected' : ''}${slot?.conditions?.asleep ? ' is-asleep' : ''}" ${attrs} aria-label="Inspect ${esc(name(id))}${slot ? `, ${Math.max(0, B.hpOf(G, slot) - slot.dmg)} HP, ${slot.en.length} Energy` : ''}">${face(id, slot, G)}</button>`;
}
function closeSheet(st) { st.sheet?.close(); st.sheet = null; }
function showSheet(st, title, body, click, cardFocus = false) {
  closeSheet(st);
  const sh = ui.openSheet({title, body:`<div class="rp-sheet-content">${body}</div>`, cls:'pk-sheet rp-sheet' + (cardFocus ? ' rp-card-focus' : ''), detents:['large'], onClose:() => { if (st.sheet === sh) st.sheet = null; }});
  st.sheet = sh;
  if (click) sh.body.addEventListener('click', click);
  return sh;
}
function send(st, m) {
  if (st.presentation?.busy() || st.dead || st.hidden || st.stale || profileKey() !== st.profile || !D.mayPlay()) return false;
  const fresh = st.src.get(st.mid);
  if (!fresh?.G || fresh.G.v !== 7) return false;
  const legal = B.check(fresh.G, fresh.you, m);
  if (!legal.ok) { ui.toast(legal.why, {icon:'info'}); closeSheet(st); draw(st); return false; }
  closeSheet(st); st.preview?.close();
  const result = st.src.move(st.mid, m);
  if (!result.ok) { ui.toast(result.why, {icon:'info'}); return false; }
  ui.haptic('selection'); draw(st); return true;
}
function moveLabel(G, m) {
  const p = G.p[G.who], target = all(p).find(s => s.u === m.on || s.u === m.to || s.u === m.u);
  switch (m.a) {
    case 'energy': return `Attach ${p.en} Energy to ${name(target?.id)}`;
    case 'attack': return `Attack: ${B.attacksOf(G, p.active.id)[m.n].name}`;
    case 'bench': return 'Place on your Bench';
    case 'evolve': return `Develop ${name(target?.id)} into ${name(m.id)}`;
    case 'support': return `Play ${name(m.id)}${target ? ` on ${name(target.id)}` : ''}${m.prime ? ` → ${name(m.prime)}` : ''}`;
    case 'retreat': return `Retreat to ${name(target?.id)}`;
    case 'promote': return `Promote ${name(target?.id)}`;
    case 'choose-switch': return `Switch in ${name(target?.id)}`;
    case 'ability': return `Use ${C.card(target?.id)?.ability?.name || 'Ability'}`;
    default: return 'End turn';
  }
}
function usable(st) {
  // (a live battle waits while the other manager is away: rivals-live-match.js)
  return !st.presentation?.busy() && !st.dead && !st.hidden && !st.stale && profileKey() === st.profile && D.mayPlay() && !(st.x?.live && st.x.away);
}
const renderKey = x => JSON.stringify([x.G, x.state, x.result, x.waiting || '', x.away ? [Math.ceil(x.away.left / 5000), x.away.canClaim] : 0]);
const clock = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
// A live battle's waiting room (the challenger not in yet) and its pause while the other manager is away.
function liveWaitHTML(x) {
  if (x.waiting === 'withdrawn') return `<div class="rp-live-wait" role="status"><b>This live battle didn’t start</b><p>${esc(x.opp.name)} isn’t joining it. Challenge someone from Live battle on the Rivals home.</p>${button('Back to Rivals','data-rp-live-leave',false,'is-primary')}</div>`;
  return `<div class="rp-live-wait" role="status"><span class="rp-live-pulse" aria-hidden="true"></span><b>Waiting for ${esc(x.opp.name)}…</b><p>The battle starts as soon as they join.</p>${button('Leave','data-rp-live-leave')}</div>`;
}
function awayHTML(x) {
  const a = x.away;
  return `<div class="rp-live-away" role="status"><span class="rp-live-pulse is-away" aria-hidden="true"></span><b>${esc(x.opp.name)} left the app</b><p>${a.canClaim ? 'They have been gone two minutes. Keep waiting, or take the win.' : `Paused until they come back. You can claim the win in ${clock(a.left)}.`}</p>${a.canClaim ? button('Claim the win','data-rp-live-claim',false,'is-primary') : ''}</div>`;
}
function placeOpening(st, index, zone) {
  const x = st.src.get(st.mid), p = x?.G?.p[x.you], c = C.card(p?.hand[index]);
  if (!usable(st) || x?.G?.phase !== 'setup' || p.ready || c?.kind !== 'player' || c.stage !== 'Base') return;
  if (zone === 'active') { st.setup.bench = st.setup.bench.filter(i => i !== index); st.setup.active = index; }
  else if (zone === 'bench') {
    if (!st.setup.bench.includes(index)) {
      if (st.setup.bench.length >= 3) return;
      st.setup.bench.push(index);
    }
    if (st.setup.active === index) st.setup.active = null;
  } else if (zone === 'remove') {
    if (st.setup.active === index) st.setup.active = null;
    st.setup.bench = st.setup.bench.filter(i => i !== index);
  } else return;
  closeSheet(st); ui.haptic('selection'); draw(st);
}
function dropMoves(x, index, target) {
  const G=x.G, id=G.p[x.you].hand[index], c=C.card(id);
  return B.legalActions(G,x.you).filter(m => {
    if (m.id !== id) return false;
    if (m.a === 'bench') return target.zone === 'bench';
    if (m.a === 'evolve') return target.zone === 'athlete' && String(m.on) === target.u;
    if (m.a !== 'support') return false;
    if (c.target) return target.zone === 'athlete' && String(m.on) === target.u;
    return m.on == null && (c.kind === 'stadium' ? target.zone === 'stadium' || target.zone === 'play' : target.zone === 'play');
  });
}
function dropTargets(st, index) {
  const x=st.src.get(st.mid), p=x?.G?.p[x.you], id=p?.hand[index], c=C.card(id);
  if (!usable(st) || !c) return [];
  const nodes=[...st.el.querySelectorAll('[data-rp-drop]')];
  const targets=nodes.map(el=>({el,zone:el.dataset.rpDrop,u:el.dataset.rpSlot,cardId:id}));
  if (x.G.phase === 'setup') return !p.ready && c.kind === 'player' && c.stage === 'Base' ? targets.filter(t=>t.zone === 'active' || t.zone === 'bench' && (st.setup.bench.length < 3 || st.setup.bench.includes(index))) : [];
  return targets.filter(t=>dropMoves(x,index,t).length);
}
function dropHand(st, index, target) {
  const x=st.src.get(st.mid);
  if (!usable(st) || !x || x.G.p[x.you].hand[index] !== target.cardId) return;
  if (x.G.phase === 'setup') return placeOpening(st,index,target.zone);
  const moves=dropMoves(x,index,target);
  if (!moves.length) return;
  if (moves.length === 1) return send(st,moves[0]);
  showSheet(st, 'Choose how to play this card', `<div class="rp-actions">${moves.map((m,i)=>button(esc(moveLabel(x.G,m)),`data-rp-drop-choice="${i}"`)).join('')}</div>`, e=>{
    const b=e.target.closest('[data-rp-drop-choice]');
    if (b && moves[Number(b.dataset.rpDropChoice)]) send(st,moves[Number(b.dataset.rpDropChoice)]);
  });
}
// Energy only moves by dragging the Energy Zone's orb onto one of your athletes.
function energyTargets(st) {
  const x=st.src.get(st.mid);
  if (!usable(st) || !x?.G || x.G.phase === 'setup') return [];
  const on=new Set(B.legalActions(x.G,x.you).filter(m=>m.a === 'energy').map(m=>String(m.on)));
  return [...st.el.querySelectorAll(`.rp-side.is-mine [data-rp-slot][data-rp-side="${x.you}"]`)].filter(el=>on.has(el.dataset.rpSlot)).map(el=>({el,u:el.dataset.rpSlot}));
}
function dropEnergy(st, target) {
  const x=st.src.get(st.mid);
  if (!usable(st) || !x?.G) return;
  const m=B.legalActions(x.G,x.you).find(m=>m.a === 'energy' && String(m.on) === target.u);
  if (m) send(st,m);
}
function energyHint(st) {
  const x=st.src.get(st.mid), p=x?.G?.p[x.you];
  if (!p) return;
  ui.toast(p.en && !p.used.energy && B.legalActions(x.G,x.you).some(m=>m.a === 'energy') ? `Drag the ${p.en} Energy onto your Active or a Benched athlete.` : p.used.energy ? 'You have already attached your Energy this turn.' : 'No Energy is available right now.', {icon:'info'});
}
// What a manager still needs before an attack: '' when the attached Energy pays its cost.
function missing(cost = [], en = []) {
  const rest = en.slice(), typed = [];
  for (const t of cost.filter(t => t !== 'Colorless' && t !== '*')) { const i = rest.indexOf(t); if (i < 0) typed.push(t); else rest.splice(i, 1); }
  const n = typed.length + Math.max(0, cost.filter(t => t === 'Colorless' || t === '*').length - rest.length);
  return n ? `Needs ${n} more${typed.length === n && new Set(typed).size === 1 ? ' ' + typed[0] : ''} Energy` : '';
}
/** The floating card preview's content, built only from the engine's legal moves. */
function previewModel(st, choice) {
  const x = st.src.get(st.mid), G = x?.G;
  if (!G || G.v !== 7 || choice?.u == null || G.phase === 'setup') return null;
  const side = Number(choice.side), slot = G.p[side] && all(G.p[side]).find(s => String(s.u) === String(choice.u)), c = C.card(slot?.id);
  if (!slot || c?.kind !== 'player') return null;
  const me = G.p[x.you], mine = side === x.you, active = G.p[side].active === slot, turn = mine && x.state === 'yours' && usable(st);
  const legal = turn ? B.legalActions(G, x.you) : [], cond = slot.conditions || {}, banners = [];
  if (mine && active && turn) B.attacksOf(G, slot.id).forEach((a, n) => {
    const moves = legal.filter(m => m.a === 'attack' && m.n === n);
    const why = moves.length ? '' : cond.asleep ? 'Asleep · can’t attack' : cond.paralyzed ? 'Paralyzed · can’t attack'
      : missing(a.cost, slot.en) || (me.promote || G.pending ? 'Choose your Active athlete first' : 'Not available right now');
    const damage = moves.length ? B.attackPreview(G, x.you, n, moves[0].target).damage : a.damage;
    banners.push({name:a.name, cost:a.cost, type:c.type, text:a.text, why, damage, move:moves.length === 1 ? moves[0] : null, details:moves.length > 1,
      label:moves.length ? `Attack: ${a.name}${damage ? `, ${damage} damage` : ''}${a.text ? `. ${a.text}` : ''}` : `${a.name}: ${why}`});
  });
  for (const m of legal.filter(m => (m.a === 'ability' && m.on === slot.u) || (['promote','choose-switch'].includes(m.a) && m.u === slot.u))) {
    banners.push({name:m.a === 'ability' ? c.ability?.name || 'Ability' : 'Send in', type:c.type, move:m, label:moveLabel(G, m),
      text:m.a === 'ability' ? c.ability?.text || '' : m.a === 'promote' ? 'Move this athlete to your Active Spot. No retreat cost.' : 'Switch this athlete into your Active Spot.'});
  }
  let retreat = null;
  if (mine && active && turn) {
    const enabled = legal.some(m => m.a === 'retreat');
    retreat = {cost:c.retreat || 0, enabled, why:enabled ? '' : me.used.retreat ? 'Retreated' : !me.bench.length ? 'No Bench' : cond.asleep ? 'Asleep' : cond.paralyzed ? 'Paralyzed' : slot.en.length < (c.retreat || 0) ? 'Needs Energy' : 'Retreat'};
  }
  const note = !mine ? `${x.opp.name}’s ${active ? 'Active' : 'Benched'} athlete` : x.state === 'over' ? 'Match complete' : !turn ? 'Your opponent’s turn' : !active && !banners.length ? 'On your Bench' : '';
  const sel = `[data-rp-slot="${slot.u}"][data-rp-side="${side}"]`, el = st.el.querySelector(sel)?.getBoundingClientRect();
  return {side, u:slot.u, mine, name:c.athlete || c.name, print:printedCard(slot.id, rev(G)), max:B.hpOf(G, slot), dmg:slot.dmg, energy:slot.en.slice(),
    badges:conditionBadges(cond), banners, retreat, note, from:el?.width ? {left:el.left, top:el.top, width:el.width, height:el.height} : null,
    returnFocus:() => st.el.querySelector(sel), onMove:m => send(st, m), onRetreat:() => retreatFrom(st), onDetails:() => inspect(st, {u:slot.u, side, details:true})};
}
function retreatFrom(st) {
  const x = st.src.get(st.mid);
  if (!usable(st) || !x?.G) return;
  const moves = B.legalActions(x.G, x.you).filter(m => m.a === 'retreat');
  if (moves.length === 1) return retreat(st, moves[0]);
  if (moves.length) showSheet(st, 'Retreat', `<p>Choose the Benched athlete to switch in.</p><div class="rp-actions">${moves.map((m,i) => button(esc(moveLabel(x.G, m)), `data-rp-retreat-to="${i}"`)).join('')}</div>`, e => {
    const b = e.target.closest('[data-rp-retreat-to]');
    if (b && moves[Number(b.dataset.rpRetreatTo)]) retreat(st, moves[Number(b.dataset.rpRetreatTo)]);
  });
}
function inspect(st, choice) {
  // Athletes on the table rise into the floating preview; Details and hand cards keep the sheet.
  if (choice.u != null && !choice.details && st.preview?.open(previewModel(st, choice))) return;
  const x = st.src.get(st.mid), G = x?.G;
  if (!G) return;
  const me = G.p[x.you];
  let slot, id;
  if (choice.hand != null) id = me.hand[choice.hand];
  else { slot = all(G.p[choice.side]).find(s => String(s.u) === String(choice.u)); id = slot?.id; }
  const c = C.card(id);
  if (!c) return;
  st.sfx?.play('card');
  const mine = choice.hand != null || choice.side === x.you;
  let details = `<div class="rp-inspect-card rp-card ${c.kind === 'player' ? 'is-player' : 'is-support'}">${face(id, slot, G)}</div><div class="rp-inspect-details"><p class="rp-caption">${esc(kind(c))} · ${esc(c.rarity || 'Common')} artwork</p>`;
  if (c.kind === 'player') {
    details += `<dl class="rp-facts"><div><dt>Battle type</dt><dd>${esc(typeOf(c))}</dd></div><div><dt>Weakness</dt><dd>${esc(c.weakness || 'None')}${c.weakness ? ' +20' : ''}</dd></div><div><dt>Retreat</dt><dd>${c.retreat} Energy</dd></div><div><dt>KO value</dt><dd>${points(c)} point${points(c) > 1 ? 's' : ''}</dd></div></dl>`;
    if (c.predecessor) details += `<p><b>Develops from:</b> ${esc(name(c.predecessor))}. Keep damage, Energy and Tool. No development on your first turn or the turn this athlete entered play.</p>`;
    details += `<div class="rp-attack-list">${B.attacksOf(G, id).map(a => `<div><span><b>${esc(a.name)}</b><small>${esc(cost(a))}</small>${a.text ? `<small>${esc(a.text)}</small>` : ''}</span><strong>${a.damage}<small>damage</small></strong></div>`).join('')}</div>`;
    if (c.ability) details += `<p><b>Ability · ${esc(c.ability.name)}</b><br>${esc(c.ability.text)}</p>`;
    if (slot?.tool) details += `<p><b>Attached Tool:</b> ${esc(name(slot.tool))} — ${esc(C.card(slot.tool)?.text || '')}</p>`;
    if (slot?.stack?.length) details += `<p><b>Development stack:</b> ${esc([...slot.stack,slot.id].map(name).join(' → '))}</p>`;
    if (slot) details += `<p><b>Attached Energy:</b> ${esc(slot.en.length ? slot.en.join(', ') : 'None')}. Attacks keep Energy unless their text discards it.</p>`;
  } else details += `<p>${esc(c.text)}</p><p>${c.kind === 'supporter' ? 'You may play one Supporter per turn.' : c.kind === 'tool' ? 'Each athlete can hold one Tool.' : c.kind === 'stadium' ? 'One shared Stadium. You may play one per turn; it must differ from the Stadium already in play.' : 'You may play multiple eligible Items during your turn.'}</p>`;
  let moves = [];
  if (G.phase === 'setup' && !me.ready && choice.hand != null && c.kind === 'player' && c.stage === 'Base') {
    const used = st.setup.active === choice.hand || st.setup.bench.includes(choice.hand);
    details += `<div class="rp-actions">${button('Place in Active Spot', 'data-rp-place="active"', st.setup.active === choice.hand)}${button('Place on Bench', 'data-rp-place="bench"', used || st.setup.bench.length >= 3)}${used ? button('Return to opening hand', 'data-rp-place="remove"') : ''}</div>`;
  } else if (mine && x.state !== 'over') {
    moves = B.legalActions(G, x.you).filter(m => m.a !== 'support' || C.card(m.id)?.target || m.on == null).filter(m => choice.hand != null ? m.id === id && ['bench','evolve','support'].includes(m.a)
      : (m.on === slot.u && m.a === 'ability') || (me.active?.u === slot.u && ['attack','retreat'].includes(m.a)) || (m.u === slot.u && ['promote','choose-switch'].includes(m.a)));
    details += `<div class="rp-actions">${moves.map((m, i) => button(esc(moveLabel(G, m)), `data-rp-move="${i}"`, false, m.a === 'attack' ? 'is-primary' : '')).join('')}</div>`;
    if (!moves.length) {
      let why = 'No legal action for this card right now.';
      if (x.state === 'theirs') why = 'Your opponent is making a decision. You can inspect all face-up cards.';
      else if (choice.hand != null && c.stage && c.stage !== 'Base') why = 'Develop an eligible matching athlete already in play. The predecessor must match and you must be past your first turn.';
      else if (slot?.u === me.active?.u) why = 'Prepare your athlete with Energy or Support Cards, or end your turn. Check its attack costs and Special Conditions.';
      details += `<p class="rp-note">${esc(why)}</p>`;
    }
  }
  details += '<p class="rp-caption">Fictional balance values. Position, team, rarity and real NFL statistics grant no battle bonuses.</p>';
  if (c.sourceId && D.card(c.sourceId)) details += creditHTML(D.card(c.sourceId));
  details += '</div>';
  showSheet(st, c.name, details, e => {
    const place = e.target.closest('[data-rp-place]');
    if (place) {
      placeOpening(st, choice.hand, place.dataset.rpPlace); return;
    }
    const action = e.target.closest('[data-rp-move]');
    if (!action) return;
    const m = moves[Number(action.dataset.rpMove)];
    if (!m) return;
    if (m.a === 'retreat') return retreat(st, m);
    send(st, m);
  }, true);
}
function retreat(st, m) {
  const x = st.src.get(st.mid), active = x.G.p[x.you].active, c = C.card(active.id), count = c.retreat;
  // Only mixed Energy types need a choice; otherwise discard the first attached ones.
  if (!count || new Set(active.en).size <= 1 || active.en.length === count) return send(st, m);
  const sh = showSheet(st, 'Choose retreat Energy', `<p>Discard ${count} Energy from ${esc(c.name)} to retreat. The new Active athlete can still attack.</p><fieldset class="rp-energy-choice"><legend>Choose ${count}</legend>${active.en.map((e,i) => `<label><input type="checkbox" name="energy" value="${i}">${energy([e])}<span>${esc(e)}</span></label>`).join('')}</fieldset>${button('Pay retreat cost', 'data-rp-retreat', true, 'is-primary')}`);
  const selected = () => [...sh.body.querySelectorAll('input:checked')].map(el => Number(el.value));
  sh.body.addEventListener('change', () => { sh.body.querySelector('[data-rp-retreat]').disabled = selected().length !== count; });
  sh.body.addEventListener('click', e => { if (e.target.closest('[data-rp-retreat]') && selected().length === count) send(st, {...m, energy:selected()}); });
}
function eventText(ev, you, opponent) {
  if (ev.k === 'draw') return ev.who === you ? `You drew ${name(ev.id)}.` : `${opponent} drew a card.`;
  if (ev.k === 'setup') return `${ev.who === you ? 'You' : opponent} set the opening lineup.`;
  return ev.text || '';
}
function help(st) {
  const sleep = rev(st.x?.G) >= 2 ? 'Sleep: no attack or retreat. Only heads at Checkup wakes the athlete; developing or moving to the Bench does not.' : 'Sleep: no attack or retreat; heads at Checkup wakes the athlete.';
  const clears = rev(st.x?.G) >= 2 ? 'Development and moving to the Bench clear Special Conditions, except Sleep.' : 'Development and moving to the Bench clear Special Conditions.';
  showSheet(st, 'How to play Gridiron Rivals', `<ol class="rp-rules"><li><b>Collect, build, battle.</b> Build a focused 20-card deck with at least one Base Player and at most two of each canonical name. Energy comes from the Energy Zone, never your deck.</li><li><b>Choose your lineup.</b> Start with five cards, including a Base Player. Choose one Active athlete and up to three Base Players for the Bench.</li><li><b>Prepare one turn ahead.</b> Draw one card. Drag one Energy from your Energy Zone onto any athlete. The first manager skips normal Energy on the opening turn; legal zero-cost attacks and Supporters are still allowed.</li><li><b>Attack and keep Energy.</b> Meet the printed cost, then attack. Any type pays Colorless costs. The attack ends your turn. Energy stays attached unless a card says otherwise.</li><li><b>Develop your athletes.</b> Put the exact matching Breakout or Prime card from hand on an eligible athlete. Never on your first turn, on the turn it entered play, or twice on the same athlete in one turn. Keep damage, Energy and Tool.</li><li><b>Choose your support.</b> Use multiple eligible Items, one Supporter, one Tool per athlete and one Stadium per turn. There is one shared Stadium.</li><li><b>Retreat wisely.</b> Pay the Active athlete’s printed Energy cost and choose a Benched replacement, once per turn. A card-effect switch or free promotion after a knockout does not spend that retreat allowance.</li><li><b>Score three knockout points.</b> Regular players give 1 point, ex 2, Mega ex 3. You also win if your opponent has no athlete in play to replace a knocked-out Active athlete. Hand and deck cards cannot rescue that knockout.</li></ol><h3>Between-turn Checkup</h3><p>Poison: 10 damage each Checkup, no recovery flip. Burn: 20 damage, then heads clears it. ${sleep} Paralysis: no attack or retreat; clears after its owner’s next turn. Confusion: flip to attack; tails ends the turn without attacking or self-damage.</p><p>${clears} Poison and Burn can coexist; Sleep, Paralysis and Confusion replace one another.</p><p>Plan your next attacker while your Active athlete keeps using its attached Energy. Every Bench slot matters. Match damage and knockouts never remove cards from your collection.</p>`);
}
function cardBack() {
  return '<span class="rp-card-back" aria-hidden="true"><img src="img/rivals/card-back-v1.webp" alt="" decoding="async" draggable="false"></span>';
}
function lineupHTML(st, side) {
  const G = st.x.G, p = G.p[side], mine = side === st.x.you;
  const provisional = mine && G.phase === 'setup' && !p.ready;
  const hidden = !mine && G.phase === 'setup';
  const active = hidden ? null : provisional ? st.setup.active == null ? null : {id:p.hand[st.setup.active],index:st.setup.active} : p.active;
  const bench = hidden ? [] : provisional ? st.setup.bench.map(i => ({id:p.hand[i],index:i})) : p.bench;
  const attrs = s => provisional ? `data-rp-hand="${s.index}"` : `data-rp-slot="${s.u}" data-rp-side="${side}"${mine ? ' data-rp-drop="athlete"' : ''}`;
  return `<section class="rp-side ${mine ? 'is-mine' : 'is-opponent'}" aria-label="${mine ? 'Your' : 'Opponent’s'} lineup"><div class="rp-active"${mine ? ' data-rp-drop="active"' : ''}><span class="rp-zone-label">${mine ? 'Your Active' : 'Opponent Active'}</span>${hidden ? `<div class="rp-hidden" aria-label="Opponent’s opening athlete is face down">${cardBack()}</div>` : active ? piece(active.id, provisional ? null : active, G, attrs(active)) : `<div class="rp-empty">${p.promote ? 'Choose a Benched replacement' : 'Choose a Base Player'}</div>`}</div><div class="rp-bench"${mine ? ' data-rp-drop="bench"' : ''} aria-label="${mine ? 'Your' : 'Opponent’s'} Bench">${[0,1,2].map(i => bench[i] ? piece(bench[i].id, provisional ? null : bench[i], G, attrs(bench[i])) : '<div class="rp-bench-empty">Bench</div>').join('')}</div></section>`;
}
function manager(label, p, mine) {
  return `<div role="group" class="rp-manager ${mine ? 'is-mine' : 'is-opponent'}" aria-label="${esc(label)}, ${p.points} of 3 knockout points"><span>${esc(label)}</span><span class="rp-points" aria-hidden="true">${[0,1,2].map(i=>`<i${p.points > i ? ' class="is-scored"' : ''}></i>`).join('')}</span></div>`;
}
function piles(p, side, mine) {
  const label = mine ? 'Your' : 'Opponent', cls = mine ? 'is-mine' : 'is-opponent';
  return `<div role="group" class="rp-deck ${cls}" aria-label="${label} deck: ${p.deck.length} cards">${cardBack()}<b>${p.deck.length}<small> Deck</small></b></div>`
    + `<button type="button" class="rp-discard ${cls}" data-rp-discard="${side}" aria-label="${label} discard: ${p.discard.length} cards"><span aria-hidden="true">↗</span><b>${p.discard.length}</b><small>Discard</small></button>`;
}
function energyZone(p, mine) {
  const ready = p.en && !p.used.energy, label = ready ? `${p.en} Energy available` : p.used.energy ? 'Energy attached this turn' : 'No Energy available';
  const tag = mine ? 'button' : 'div';
  return `<${tag} class="rp-energy-zone ${mine ? 'is-mine' : 'is-opponent'}${ready ? ' is-ready' : ''}" ${mine ? 'type="button" data-rp-energy' : 'role="group"'} aria-label="${mine ? 'Your' : 'Opponent’s'} Energy Zone: ${esc(label)}"><span class="rp-energy-orb">${ready ? energy([p.en]) : '<span aria-hidden="true">○</span>'}</span><small>Energy${mine && ready ? ' · Drag' : ''}</small></${tag}>`;
}
function handSheet(st) {
  const {G,you} = st.x, chosen = [st.setup.active,...st.setup.bench];
  showSheet(st, `Your hand · ${G.p[you].hand.length}`, `<p class="rp-caption">Tap a card to see its attacks. On the table, hold to lift, slide across your hand to preview, or drag onto a highlighted target to play.</p><div class="rp-hand-library">${G.p[you].hand.map((id,i)=>piece(id,null,G,`data-rp-hand="${i}"`,G.phase === 'setup' && chosen.includes(i))).join('') || '<p>Your hand is empty.</p>'}</div>`, e=>onClick(st,e));
}
function energySheet(st) {
  const {G,you} = st.x, p = G.p[you], moves = B.legalActions(G,you).filter(m=>m.a === 'energy');
  showSheet(st, 'Your Energy Zone', `<p>${G.phase === 'over' ? 'This battle is complete.' : moves.length ? `${energy([p.en])} Choose an athlete to receive ${esc(p.en)} Energy.` : p.used.energy ? 'You have already attached your Energy this turn.' : G.phase === 'setup' ? 'Finish setting your lineup to begin the battle.' : G.who !== you ? 'Your Energy becomes available on your turn.' : 'No normal Energy is available on the first manager’s opening turn.'}</p><div class="rp-actions">${moves.map((m,i)=>button(esc(moveLabel(G,m)),`data-rp-move="${i}"`)).join('')}</div><p class="rp-caption">One manual attachment per turn. Attached Energy stays after attacking unless a card says otherwise.</p>`, e=>{
    const b=e.target.closest('[data-rp-move]');
    if (b && moves[Number(b.dataset.rpMove)]) send(st,moves[Number(b.dataset.rpMove)]);
  });
}
function battleMenu(st) {
  const {G,you,state} = st.x, p = G.p[you], op=G.p[1-you];
  showSheet(st, 'Battle options', `<p>${esc(prompt(st))}</p><p>Turn ${G.turn} · First to 3 knockout points</p><p>Supporter: ${p.used.supporter ? 'used' : 'available'} · Retreat: ${p.used.retreat ? 'used' : 'available'}</p><p>Your deck: ${p.deck.length} · Hand: ${p.hand.length}<br>Opponent deck: ${op.deck.length} · Hand: ${op.hand.length}</p><div class="rp-actions">${button('View your hand','data-rp-expand-hand')}${button('Battle log','data-rp-log')}${button('How to play','data-rp-help')}${button('Table finish','data-rp-table')}${button('Music & sound settings','data-rp-settings')}${state === 'over' ? '' : button('Concede','data-rp-concede')}</div>`, e=>onClick(st,e));
}
function prompt(st) {
  const {G, you, state, result, opp} = st.x, p = G.p[you];
  if (state === 'over' || state === 'bad') return (st.x.live && st.x.why ? st.x.why + ' ' : '') + (result === 'w' ? 'Victory — your plan paid off.' : result === 'd' ? 'The match is a draw.' : 'Match complete — prepare your next plan.');
  if (st.x.away) return `${opp.name} left the app. The battle waits for them.`;
  if (G.phase === 'setup') return p.ready ? 'Waiting for the opposing manager’s lineup.' : `You go ${G.first === you ? 'first' : 'second'}. Tap a Base Player to choose your Active and Bench.`;
  if (state === 'theirs') return `${opp.name} is making a decision…`;
  if (p.promote) return 'Choose a Benched athlete to promote. No retreat cost.';
  if (G.pending?.kind === 'switch' && G.pending.who === you) return 'Matchup Change: you choose your Benched replacement.';
  return p.en && !p.used.energy ? `Your turn. Drag ${p.en} Energy onto your Active or a Benched athlete.` : 'Your turn. Prepare your Bench, play support, attack or end your turn.';
}
function boardPrompt(st) {
  const {G,you,state,result} = st.x, p=G.p[you];
  if (state === 'over' || state === 'bad') return result === 'w' ? 'Victory' : result === 'd' ? 'Match drawn' : state === 'bad' ? 'Battle out of sync' : 'Match complete';
  if (st.x.away) return `Paused · Waiting for ${st.x.opp.name}`;
  if (G.phase === 'setup') return p.ready ? 'Waiting for the opposing lineup' : 'Choose your Active athlete and Bench';
  if (state === 'theirs') return 'Opponent’s turn';
  if (p.promote) return 'Choose your next Active athlete';
  if (G.pending?.kind === 'switch' && G.pending.who === you) return 'Choose a Benched replacement';
  return p.en && !p.used.energy ? `Your turn · Drag ${p.en} Energy onto an athlete` : 'Your turn · Tap an athlete to attack';
}
function draw(st) {
  if (st.dead || st.hidden) return;
  st.hand?.cancel();
  const host = st.el.querySelector('[data-rp]');
  if (!D.mayPlay()) { closeSheet(st); document.documentElement.classList.remove('is-dynasty-battle'); if (!st.left) { st.left = true; st.ctx.back(); } return; }
  if (D.status !== 'ready') { host.innerHTML = '<p class="rp-message">Loading your battle…</p>'; return; }
  const x = st.src.get(st.mid); st.x = x;
  if (x?.live && !x.G) { st.rendered = renderKey(x); host.innerHTML = `<header class="rp-top">${button('‹ <span>Rivals</span>','data-back')}<div><small>GRIDIRON RIVALS · LIVE</small><b>Live battle</b></div></header>${liveWaitHTML(x)}`; return; }
  if (!x || x.G?.v !== 7) { host.innerHTML = `<p class="rp-message">This battle is not available.</p>${button('Back to Rivals','data-back')}`; return; }
  st.rendered = renderKey(x);
  const {G,you,state} = x, p = G.p[you], op = G.p[1-you], over = state === 'over' || state === 'bad';
  host.classList.toggle('is-setup',G.phase === 'setup');
  const events = G.events || G.ev || [], len = events.length;
  if (st.eventAt != null && len > st.eventAt) {
    st.presentation.enqueue(events.slice(st.eventAt), x);
    const ev = events.slice(st.eventAt).reverse().find(e => ['ko','attack','energy','evolve'].includes(e.k));
    if (ev) st.sfx?.play(ev.k === 'ko' ? 'knockout' : ev.k === 'attack' ? 'impact' : 'card');
    if (over) st.sfx?.play(x.result === 'w' ? 'victory' : x.result === 'd' ? 'draw' : 'defeat');
  }
  st.eventAt = len;
  const scroll = host.querySelector('.rp-hand')?.scrollLeft || 0, focusKey = document.activeElement?.getAttribute('data-rp-hand');
  const finish = D.tableFinish();
  host.dataset.turn = state === 'theirs' ? 'opponent' : 'you';
  host.dataset.finish = finish.id;
  host.style.setProperty('--rp-home', finish?.color || '#183e36');
  host.style.setProperty('--rp-away', finish?.away || '#714943');
  const legal = B.legalActions(G,you), needsChoice = p.promote || (G.pending?.kind === 'switch' && G.pending.who === you);
  const choices = needsChoice && !over ? legal.filter(m=>['promote','choose-switch'].includes(m.a)).map((m,i)=> {
    const target = all(p).find(s => s.u === m.u), card = C.card(target.id), hp = Math.max(0,B.hpOf(G,target) - target.dmg);
    const label = `${esc(card.athlete || card.name)}<small>${esc(card.stage)} · ${hp} HP</small>`;
    return button(label,`data-rp-choice="${i}" aria-label="${esc(moveLabel(G,m))}, ${hp} HP"`,false,'is-primary');
  }).join('') : '';
  const chosen = [st.setup.active,...st.setup.bench];
  const last = events.map(e => eventText(e,you,x.opp.name)).filter(Boolean).at(-1) || 'Set a lineup. Build a plan. Make every card count.';
  const yourName = data.guest() || data.name(data.me()) || 'You';
  host.innerHTML = `<header class="rp-top">${button('‹ <span>Rivals</span>','data-back')}<div><small>GRIDIRON RIVALS</small><b>${G.phase === 'setup' ? 'Opening lineup' : over ? 'Match complete' : `Turn ${G.turn}`}</b></div>${button('Rules','data-rp-help')}</header>`
    + `<div class="rp-arena"><div role="group" class="rp-opponent-hand" aria-label="Opponent hand: ${op.hand.length} cards">${Array.from({length:Math.min(5,op.hand.length)},(_,i)=>`<span style="--fan-angle:${(i-(Math.min(5,op.hand.length)-1)/2)*7}deg">${cardBack()}</span>`).join('')}<small>${op.hand.length} in hand</small></div>`
    + manager(x.opp.name,op,false) + manager(yourName,p,true)
    + `<div class="rp-play-zone" data-rp-drop="play" aria-hidden="true"></div><div class="rp-field">${lineupHTML(st,1-you)}${lineupHTML(st,you)}</div>`
    + piles(op,1-you,false) + piles(p,you,true) + energyZone(op,false) + energyZone(p,true)
    + `<div class="rp-stadium" data-rp-drop="stadium">${G.stadium ? `<button type="button" data-rp-stadium aria-label="Shared Stadium: ${esc(name(typeof G.stadium === 'string' ? G.stadium : G.stadium.id))}"><span aria-hidden="true">⌂</span><small>${esc(name(typeof G.stadium === 'string' ? G.stadium : G.stadium.id))}</small></button>` : '<span aria-label="No Stadium in play">⌂<small>Stadium</small></span>'}</div>`
    + `<p class="rp-status ${state === 'yours' ? 'is-yours' : ''}" role="status">${esc(boardPrompt(st))}</p>`
    + `<section class="rp-hand-section"><div class="rp-section-heading"><h2>Your hand <small>${p.hand.length}</small></h2><button type="button" class="rp-expand-hand" data-rp-expand-hand aria-label="View all ${p.hand.length} cards in your hand">View all ↗</button></div><div class="rp-hand${p.hand.length > 5 ? ' is-large-hand' : ''}" style="--hand-count:${p.hand.length}">${p.hand.map((id,i)=>piece(id,null,G,`data-rp-hand="${i}" style="--fan-index:${i};--fan-x:${p.hand.length === 1 ? 50 : 12+i*76/(p.hand.length-1)}%;--fan-angle:${(i-(p.hand.length-1)/2)*Math.min(5,22/Math.max(1,p.hand.length-1))}deg;--fan-lift:${Math.abs(i-(p.hand.length-1)/2)*3}px"`,G.phase === 'setup' && chosen.includes(i))).join('') || '<p>Your hand is empty.</p>'}</div></section>`
    + '<button type="button" class="rp-menu" data-rp-menu aria-label="Battle options"><span aria-hidden="true">☰</span></button>'
    + (x.away && !over ? awayHTML(x) : '')
    + `<p class="rp-sr-only" aria-live="polite">${esc(last)}</p></div>`
    + `<footer class="rp-turn-action${choices ? ' is-choice' : ''}">${choices || (over ? button(x.live ? 'Rivals' : 'Ladder','data-rp-ladder',false,'is-primary') + button(x.live ? 'Rematch' : 'Play again','data-rp-again',x.live && x.state === 'bad') : G.phase === 'setup' && !p.ready ? button('Confirm lineup','data-rp-ready',st.setup.active == null,'is-primary') : button('End turn','data-rp-end',!legal.some(m=>m.a==='end'),'is-primary'))}</footer>`;
  host.querySelector('.rp-hand').scrollLeft = scroll;
  st.presentation?.sync();
  if (st.preview?.isOpen()) st.preview.refresh(previewModel(st, st.preview.current()));
  if (focusKey != null) host.querySelector(`.rp-hand [data-rp-hand="${Number(focusKey)}"]`)?.focus({preventScroll:true});
}
function onClick(st,e) {
  const q = s => e.target.closest(s); let b;
  if (q('[data-rp-live-leave]')) { LIVE.leave(st.mid); return st.ctx.nav('/puzzles/dynasty'); }
  if (q('[data-rp-live-claim]')) { const r=LIVE.claim(st.mid); if (!r.ok) ui.toast(r.why,{icon:'info'}); draw(st); return; }
  if (!st.x?.G || st.hidden || st.presentation?.busy()) return;
  if (q('[data-rp-help]')) return help(st);
  if (q('[data-rp-menu]')) return battleMenu(st);
  if (q('[data-rp-expand-hand]')) return handSheet(st);
  if (q('[data-rp-energy]')) return e.detail === 0 ? energySheet(st) : energyHint(st);
  if (q('[data-rp-table]')) { closeSheet(st); return tableOptions(()=>draw(st)); }
  if (q('[data-rp-settings]')) { closeSheet(st); return musicSheet(); }
  if ((b=q('[data-rp-hand]'))) return inspect(st,{hand:Number(b.dataset.rpHand)});
  if ((b=q('[data-rp-slot]'))) return inspect(st,{u:b.dataset.rpSlot,side:Number(b.dataset.rpSide)});
  if (q('[data-rp-ready]')) { const hand=st.x.G.p[st.x.you].hand; return send(st,{a:'setup',act:hand[st.setup.active],bench:st.setup.bench.map(i=>hand[i])}); }
  if (q('[data-rp-end]')) return send(st,{a:'end'});
  if ((b=q('[data-rp-choice]'))) { const moves=B.legalActions(st.x.G,st.x.you).filter(m=>['promote','choose-switch'].includes(m.a)); return send(st,moves[Number(b.dataset.rpChoice)]); }
  if (q('[data-rp-stadium]')) { const s=st.x.G.stadium,c=C.card(typeof s === 'string'?s:s.id); return showSheet(st,c.name,`<p>${esc(c.text)}</p>`); }
  if (q('[data-rp-log]')) return showSheet(st,'Battle log',`<ol class="rp-log">${(st.x.G.events || []).map(ev=>eventText(ev,st.x.you,st.x.opp.name)).filter(Boolean).map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`);
  if ((b=q('[data-rp-discard]'))) { const p=st.x.G.p[Number(b.dataset.rpDiscard)]; return showSheet(st,'Discard pile',`<ul>${p.discard.map(id=>`<li>${esc(name(id))}</li>`).join('') || '<li>No discarded cards yet.</li>'}</ul>`); }
  if (q('[data-rp-ladder]')) return st.ctx.nav('/puzzles/dynasty');
  if (q('[data-rp-again]') && st.x.live) { closeSheet(st); return import('./rivals-live-lobby.js').then(m=>m.openLobby({rematch:st.x.opp.key})); }
  if (q('[data-rp-again]')) { const r=SOLO.start(st.x.opp.cpu.id); if (r.ok) st.ctx.nav(`/puzzles/dynasty/battle/${r.mid}`); else ui.toast(r.why,{icon:'info'}); return; }
  if (q('[data-rp-concede]')) return showSheet(st,'Concede this battle?',`<p>${st.x.live ? `${esc(st.x.opp.name)} wins this live battle.` : 'This match will count as a loss.'} Your cards and collection are kept.</p>${button('Concede battle','data-rp-confirm-concede')}`,ev=>{if(ev.target.closest('[data-rp-confirm-concede]')) {closeSheet(st); st.src.resign(st.mid);draw(st);}});
}

export default {
  id:'dynasty-battle', chrome:'none', title:'Battle',
  render() { return '<div class="rp-battle" data-rp data-no-swipe></div>'; },
  mount(el,ctx) {
    const mid=String(ctx.params?.id||'');
    const st={el,ctx,mid,src:LIVE.isLive(mid)?LIVE:SOLO,profile:profileKey(),setup:{active:null,bench:[]},hidden:!ctx.visible,dead:false,stops:[],eventAt:null};
    ST.set(ctx,st);
    if (!el.querySelector('[data-rp]')) el.innerHTML=this.render();
    st.music=attachMusic(el,ctx.visible,'battle'); st.sfx=sfx.attach(el,ctx.visible);
    st.presentation=attachPresentation(el, {enabled:()=>!st.dead && !st.hidden && !st.stale && profileKey()===st.profile && D.mayPlay(), cancelHand:()=>st.hand?.cancel(), sound:(cue,o)=>st.sfx?.play(cue,o), blocked:()=>!!st.preview?.isOpen()});
    st.preview=attachPreview(el, {enabled:()=>!st.dead && !st.hidden && !st.stale && profileKey()===st.profile && D.mayPlay() && !st.presentation?.busy(), sound:cue=>st.sfx?.play(cue)});
    st.hand=attachHand(el,{enabled:()=>usable(st) && !st.sheet && !st.preview?.isOpen() && !document.hidden, targets:i=>dropTargets(st,i), drop:(i,t)=>dropHand(st,i,t), inspect:i=>inspect(st,{hand:i}), preview:()=>st.sfx?.play('card'), energyTargets:()=>energyTargets(st), energyDrop:t=>dropEnergy(st,t), energyTap:()=>energyHint(st)});
    st.stops.push(st.src.watchPlayback(st.mid, () => usable(st) && !document.hidden
      && !st.preview.isOpen() && !ui.sheetCount() && !document.querySelector('.sheet')
      && !st.el.querySelector('.rp-hold-preview, .rp-drag-ghost')));
    const click=e=>onClick(st,e);el.addEventListener('click',click);
    st.stops.push(()=>st.presentation.stop(),()=>st.preview.stop(),()=>st.hand.stop(),()=>el.removeEventListener('click',click),()=>st.music.stop(),()=>st.sfx.stop(),st.src.subscribe(()=>{
      // Deferred CPU checks can emit without a move. Keep a live hand gesture intact.
      const x=st.src.get(st.mid);
      if (!x || renderKey(x) !== st.rendered) draw(st);
    }),data.subscribe(t=>{
      if(t!=='me')return;
      st.presentation.clear();st.preview.close();st.hand.cancel();closeSheet(st);st.eventAt=null;
      if(profileKey()!==st.profile){st.stale=true;st.music.visible(false);st.sfx.visible(false);document.documentElement.classList.remove('is-dynasty-battle');if(!st.hidden&&!st.left){st.left=true;st.ctx.back();}return;}
      draw(st);
    }));
    document.documentElement.classList.toggle('is-dynasty-battle',!!ctx.visible && D.mayPlay());
    D.load().then(()=>draw(st),()=>draw(st));draw(st);
  },
  onShow(ctx) { const st=ST.get(ctx);if(st){if(st.stale){st.ctx.back();return;}st.hidden=false;st.music.visible(true);st.sfx.visible(true);document.documentElement.classList.toggle('is-dynasty-battle',D.mayPlay());draw(st);} },
  onHide(ctx) { const st=ST.get(ctx);if(st){st.hidden=true;st.presentation.clear();st.preview.close();st.eventAt=null;st.hand.cancel();closeSheet(st);st.music.visible(false);st.sfx.visible(false);document.documentElement.classList.remove('is-dynasty-battle');} },
  unmount(el,ctx) {const st=ST.get(ctx);if(!st)return;st.dead=true;closeSheet(st);st.stops.forEach(fn=>fn());document.documentElement.classList.remove('is-dynasty-battle');D.flush();ST.delete(ctx);}
};
