// The v7 card duel. Saved v1-v6 games keep their original view and engine.
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-pocket.js';
import * as C from '../core/dynasty-pocket-cards.js';
import * as SOLO from '../core/dynasty-solo.js';
import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import * as sfx from '../core/dynasty-sfx.js';
import {profileKey} from '../core/realm-active.js';
import {portraitOf, creditHTML} from './dynasty.js';
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
const button = (label, attr, disabled = false, cls = '') => `<button type="button" class="rp-button ${cls}" ${attr}${disabled ? ' disabled' : ''}>${label}</button>`;
const energy = list => list.length ? list.map(e => `<span class="rp-energy" style="--energy:${color[e] || color.Colorless}" title="${esc(e)} Energy" aria-label="${esc(e)} Energy">${esc(e.slice(0, 1))}</span>`).join('') : '<span class="rp-none">No Energy</span>';

function portrait(c) {
  const original = D.card(c.sourceId || c.id), p = original && portraitOf(original);
  return p?.url ? `<img src="${esc(p.url)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span aria-hidden="true">${esc(c.position || 'R')}</span>`;
}
function face(id, slot, G) {
  const c = C.card(id);
  if (!c) return `<span class="rp-card-name">${esc(name(id))}</span>`;
  if (c.kind !== 'player') return `<span class="rp-card-kind">${esc(kind(c))}</span><span class="rp-support-art" aria-hidden="true">${{item:'＋',supporter:'▤',tool:'⬡',stadium:'⌂'}[c.kind]}</span><strong class="rp-card-name">${esc(c.name)}</strong><span class="rp-card-copy">${esc(c.text)}</span>`;
  const max = slot ? B.hpOf(G, slot) : c.hp, hp = Math.max(0, max - (slot?.dmg || 0));
  const statuses = ['poisoned','burned','asleep','paralyzed','confused'].filter(k => slot?.conditions?.[k]);
  return `<span class="rp-card-heading"><span>${esc(c.stage)}${c.classification !== 'regular' ? ` · ${esc(c.classification === 'mega-ex' ? 'Mega ex' : 'ex')}` : ''}</span><b>${hp}<small> HP</small></b></span>`
    + `<span class="rp-card-art" style="--card-color:${color[c.type || c.types?.[0]] || color.Colorless}">${portrait(c)}<span>${esc(c.position || '')}</span></span>`
    + `<strong class="rp-card-name">${esc(c.athlete || c.name)}</strong><span class="rp-card-type">${esc(typeOf(c))} · ${points(c)} KO point${points(c) > 1 ? 's' : ''}</span>`
    + (slot ? `<span class="rp-hp" aria-label="${hp} of ${max} HP remaining"><i style="width:${Math.max(0, Math.min(100, hp / max * 100))}%"></i></span><span class="rp-card-energy">${energy(slot.en)}</span>${statuses.length ? `<span class="rp-condition">${esc(statuses.join(' · '))}</span>` : ''}` : `<span class="rp-card-type">${esc(c.attacks[0].name)} · ${c.attacks[0].damage} damage</span>`);
}
function piece(id, slot, G, attrs = '', selected = false) {
  const c = C.card(id);
  return `<button type="button" class="rp-card ${c?.kind === 'player' ? 'is-player' : 'is-support'}${selected ? ' is-selected' : ''}" ${attrs} aria-label="Inspect ${esc(name(id))}${slot ? `, ${Math.max(0, B.hpOf(G, slot) - slot.dmg)} HP, ${slot.en.length} Energy` : ''}">${face(id, slot, G)}</button>`;
}
function closeSheet(st) { st.sheet?.close(); st.sheet = null; }
function showSheet(st, title, body, click) {
  closeSheet(st);
  const sh = ui.openSheet({title, body:`<div class="rp-sheet-content">${body}</div>`, cls:'pk-sheet rp-sheet', detents:['large'], onClose:() => { if (st.sheet === sh) st.sheet = null; }});
  st.sheet = sh;
  if (click) sh.body.addEventListener('click', click);
  return sh;
}
function send(st, m) {
  if (st.dead || st.hidden || st.stale || profileKey() !== st.profile || !D.mayPlay()) return false;
  const fresh = SOLO.get(st.mid);
  if (!fresh?.G || fresh.G.v !== 7) return false;
  const legal = B.check(fresh.G, fresh.you, m);
  if (!legal.ok) { ui.toast(legal.why, {icon:'info'}); closeSheet(st); draw(st); return false; }
  closeSheet(st);
  const result = SOLO.move(st.mid, m);
  if (!result.ok) { ui.toast(result.why, {icon:'info'}); return false; }
  ui.haptic('selection'); draw(st); return true;
}
function moveLabel(G, m) {
  const p = G.p[0], target = all(p).find(s => s.u === m.on || s.u === m.to || s.u === m.u);
  switch (m.a) {
    case 'energy': return `Attach ${p.en} Energy to ${name(target?.id)}`;
    case 'attack': return `Attack: ${C.card(p.active.id).attacks[m.n].name}`;
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
function inspect(st, choice) {
  const x = SOLO.get(st.mid), G = x?.G;
  if (!G) return;
  const me = G.p[x.you];
  let slot, id;
  if (choice.hand != null) id = me.hand[choice.hand];
  else { slot = all(G.p[choice.side]).find(s => String(s.u) === String(choice.u)); id = slot?.id; }
  const c = C.card(id);
  if (!c) return;
  st.sfx?.play('card');
  const mine = choice.hand != null || choice.side === x.you;
  let details = `<div class="rp-inspect-card rp-card ${c.kind === 'player' ? 'is-player' : 'is-support'}">${face(id, slot, G)}</div><p class="rp-caption">${esc(kind(c))} · ${esc(c.rarity || 'Common')} artwork</p>`;
  if (c.kind === 'player') {
    details += `<dl class="rp-facts"><div><dt>Battle type</dt><dd>${esc(typeOf(c))}</dd></div><div><dt>Weakness</dt><dd>${esc(c.weakness || 'None')}${c.weakness ? ' +20' : ''}</dd></div><div><dt>Retreat</dt><dd>${c.retreat} Energy</dd></div><div><dt>KO value</dt><dd>${points(c)} point${points(c) > 1 ? 's' : ''}</dd></div></dl>`;
    if (c.predecessor) details += `<p><b>Develops from:</b> ${esc(name(c.predecessor))}. Keep damage, Energy and Tool. No development on your first turn or the turn this athlete entered play.</p>`;
    details += `<div class="rp-attack-list">${c.attacks.map(a => `<div><span><b>${esc(a.name)}</b><small>${esc(cost(a))}</small>${a.text ? `<small>${esc(a.text)}</small>` : ''}</span><strong>${a.damage}<small>damage</small></strong></div>`).join('')}</div>`;
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
      : (m.on === slot.u && ['energy','ability'].includes(m.a)) || (me.active?.u === slot.u && ['attack','retreat'].includes(m.a)) || (m.u === slot.u && ['promote','choose-switch'].includes(m.a)));
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
  showSheet(st, c.name, details, e => {
    const place = e.target.closest('[data-rp-place]');
    if (place) {
      const a = place.dataset.rpPlace, i = choice.hand;
      if (a === 'active') { st.setup.bench = st.setup.bench.filter(n => n !== i); st.setup.active = i; }
      else if (a === 'bench' && st.setup.bench.length < 3 && !st.setup.bench.includes(i) && st.setup.active !== i) st.setup.bench.push(i);
      else if (a === 'remove') { if (st.setup.active === i) st.setup.active = null; st.setup.bench = st.setup.bench.filter(n => n !== i); }
      closeSheet(st); draw(st); return;
    }
    const action = e.target.closest('[data-rp-move]');
    if (!action) return;
    const m = moves[Number(action.dataset.rpMove)];
    if (!m) return;
    if (m.a === 'retreat') return retreat(st, m);
    send(st, m);
  });
}
function retreat(st, m) {
  const x = SOLO.get(st.mid), active = x.G.p[x.you].active, c = C.card(active.id), count = c.retreat;
  if (!count) return send(st, m);
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
  showSheet(st, 'How to play Gridiron Rivals', `<ol class="rp-rules"><li><b>Collect, build, battle.</b> Build a focused 20-card deck with at least one Base Player and at most two of each canonical name. Energy comes from the Energy Zone, never your deck.</li><li><b>Choose your lineup.</b> Start with five cards, including a Base Player. Choose one Active athlete and up to three Base Players for the Bench.</li><li><b>Prepare one turn ahead.</b> Draw one card. Attach one Energy to any athlete. The first manager skips normal Energy on the opening turn; legal zero-cost attacks and Supporters are still allowed.</li><li><b>Attack and keep Energy.</b> Meet the printed cost, then attack. Any type pays Colorless costs. The attack ends your turn. Energy stays attached unless a card says otherwise.</li><li><b>Develop your athletes.</b> Put the exact matching Breakout or Prime card from hand on an eligible athlete. Never on your first turn, on the turn it entered play, or twice on the same athlete in one turn. Keep damage, Energy and Tool.</li><li><b>Choose your support.</b> Use multiple eligible Items, one Supporter, one Tool per athlete and one Stadium per turn. There is one shared Stadium.</li><li><b>Retreat wisely.</b> Pay the Active athlete’s printed Energy cost and choose a Benched replacement, once per turn. A card-effect switch or free promotion after a knockout does not spend that retreat allowance.</li><li><b>Score three knockout points.</b> Regular players give 1 point, ex 2, Mega ex 3. You also win if your opponent has no athlete in play to replace a knocked-out Active athlete. Hand and deck cards cannot rescue that knockout.</li></ol><h3>Between-turn Checkup</h3><p>Poison: 10 damage each Checkup, no recovery flip. Burn: 20 damage, then heads clears it. Sleep: no attack or retreat; heads at Checkup wakes the athlete. Paralysis: no attack or retreat; clears after its owner’s next turn. Confusion: flip to attack; tails ends the turn without attacking or self-damage.</p><p>Development and moving to the Bench clear Special Conditions. Poison and Burn can coexist; Sleep, Paralysis and Confusion replace one another.</p><p>Plan your next attacker while your Active athlete keeps using its attached Energy. Every Bench slot matters. Match damage and knockouts never remove cards from your collection.</p>`);
}
function lineupHTML(st, side) {
  const G = st.x.G, p = G.p[side], mine = side === st.x.you;
  const provisional = mine && G.phase === 'setup' && !p.ready;
  if (!mine && G.phase === 'setup') return `<section class="rp-side is-opponent"><h2>${esc(st.x.opp.name)}</h2><div class="rp-active"><div class="rp-card rp-hidden" aria-label="Opponent’s opening athlete is face down">R<span>Opening lineup hidden</span></div></div><p class="rp-caption">Revealed after both managers finish setup</p></section>`;
  const active = provisional ? st.setup.active == null ? null : {id:p.hand[st.setup.active],index:st.setup.active} : p.active;
  const bench = provisional ? st.setup.bench.map(i => ({id:p.hand[i],index:i})) : p.bench;
  const attrs = s => provisional ? `data-rp-hand="${s.index}"` : `data-rp-slot="${s.u}" data-rp-side="${side}"`;
  return `<section class="rp-side ${mine ? 'is-mine' : 'is-opponent'}"><h2>${mine ? 'Your lineup' : esc(st.x.opp.name)}</h2><div class="rp-active"><span class="rp-zone-label">Active Spot</span>${active ? piece(active.id, provisional ? null : active, G, attrs(active)) : `<div class="rp-empty">${p.promote ? 'Choose a Benched replacement' : 'Choose a Base Player'}</div>`}</div><div class="rp-bench" aria-label="${mine ? 'Your' : 'Opponent’s'} Bench">${[0,1,2].map(i => bench[i] ? piece(bench[i].id, provisional ? null : bench[i], G, attrs(bench[i])) : '<div class="rp-bench-empty">Bench</div>').join('')}</div></section>`;
}
function prompt(st) {
  const {G, you, state, result, opp} = st.x, p = G.p[you];
  if (state === 'over') return result === 'w' ? 'Victory — your plan paid off.' : result === 'd' ? 'The match is a draw.' : 'Match complete — prepare your next plan.';
  if (G.phase === 'setup') return p.ready ? 'Waiting for the opposing manager’s lineup.' : `You go ${G.first === you ? 'first' : 'second'}. Tap a Base Player to choose your Active and Bench.`;
  if (state === 'theirs') return `${opp.name} is making a decision…`;
  if (p.promote) return 'Choose a Benched athlete to promote. No retreat cost.';
  if (G.pending?.kind === 'switch' && G.pending.who === you) return 'Matchup Change: you choose your Benched replacement.';
  return p.en && !p.used.energy ? `Your turn. Attach ${p.en} Energy to your Active or a Benched athlete.` : 'Your turn. Prepare your Bench, play support, attack or end your turn.';
}
function draw(st) {
  if (st.dead || st.hidden) return;
  const host = st.el.querySelector('[data-rp]');
  if (!D.mayPlay()) { closeSheet(st); document.documentElement.classList.remove('is-dynasty-battle'); if (!st.left) { st.left = true; st.ctx.back(); } return; }
  if (D.status !== 'ready') { host.innerHTML = '<p class="rp-message">Loading your battle…</p>'; return; }
  const x = SOLO.get(st.mid); st.x = x;
  if (!x || x.G?.v !== 7) { host.innerHTML = `<p class="rp-message">This battle is not available.</p>${button('Back to Rivals','data-back')}`; return; }
  const {G,you,state} = x, p = G.p[you], op = G.p[1-you], over = state === 'over';
  host.classList.toggle('is-setup',G.phase === 'setup');
  const events = G.events || G.ev || [], len = events.length;
  if (st.eventAt != null && len > st.eventAt) {
    closeSheet(st);
    const ev = events.slice(st.eventAt).reverse().find(e => ['ko','attack','energy','evolve'].includes(e.k));
    if (ev) st.sfx?.play(ev.k === 'ko' ? 'knockout' : ev.k === 'attack' ? 'impact' : 'card');
    if (over) st.sfx?.play(x.result === 'w' ? 'victory' : x.result === 'd' ? 'draw' : 'defeat');
  }
  st.eventAt = len;
  const scroll = host.querySelector('.rp-hand')?.scrollLeft || 0, focusKey = document.activeElement?.getAttribute('data-rp-hand');
  const finish = D.tableFinish();
  host.style.setProperty('--rp-felt', (state === 'theirs' ? finish?.away : finish?.color) || '#183e36');
  const legal = B.legalActions(G,you), needsChoice = p.promote || (G.pending?.kind === 'switch' && G.pending.who === you);
  const chosen = [st.setup.active,...st.setup.bench];
  const last = events.map(e => eventText(e,you,x.opp.name)).filter(Boolean).at(-1) || 'Set a lineup. Build a plan. Make every card count.';
  host.innerHTML = `<header class="rp-top">${button('‹ <span>Rivals</span>','data-back')}<div><small>GRIDIRON RIVALS</small><b>Card duel</b></div>${button('Rules','data-rp-help')}</header>`
    + `<div class="rp-scoreboard"><div><span>You</span><b>${p.points}<small> / 3</small></b></div><span class="rp-score-label">KNOCKOUT POINTS<br><small>${G.phase === 'setup' ? 'Opening setup' : `Turn ${G.turn}`}</small></span><div><span>Opponent</span><b>${op.points}<small> / 3</small></b></div></div>`
    + `<p class="rp-status ${state === 'yours' ? 'is-yours' : ''}" role="status">${esc(prompt(st))}</p>`
    + `<div class="rp-hand-jump">${button(G.phase === 'setup' ? 'Choose opening athletes ↓' : `Your hand (${p.hand.length}) ↓`,'data-rp-jump-hand')}</div>`
    + `<div class="rp-field">${lineupHTML(st,1-you)}${lineupHTML(st,you)}</div>`
    + `<div class="rp-stadium"><span>Shared Stadium</span>${G.stadium ? `<button type="button" data-rp-stadium>${esc(name(typeof G.stadium === 'string' ? G.stadium : G.stadium.id))}</button>` : '<b>No Stadium in play</b>'}</div>`
    + `<section class="rp-resources"><div><small>ENERGY ZONE</small><strong>${p.en && !p.used.energy ? `${energy([p.en])} ${esc(p.en)}` : p.used.energy ? 'Attached this turn' : G.phase === 'setup' ? 'Ready after setup' : 'No Energy available'}</strong><span>${G.phase !== 'setup' && G.first === you && p.turns === 1 && !p.en ? 'No normal Energy on the opening turn' : 'One manual attachment per turn'}</span><span>Supporter: ${p.used.supporter ? 'used' : 'available'} · Retreat: ${p.used.retreat ? 'used' : 'available'}</span></div><div><button type="button" data-rp-discard="${you}">Your discard <b>${p.discard.length}</b> · Deck ${p.deck.length}</button><button type="button" data-rp-discard="${1-you}">Opponent discard <b>${op.discard.length}</b></button><span>Opponent deck: ${op.deck.length} · Hand: ${op.hand.length}</span></div></section>`
    + (needsChoice && !over ? `<div class="rp-choice">${legal.filter(m=>['promote','choose-switch'].includes(m.a)).map((m,i)=>button(esc(moveLabel(G,m)),`data-rp-choice="${i}"`,false,'is-primary')).join('')}</div>` : '')
    + `<section class="rp-hand-section"><div class="rp-section-heading"><h2>Your hand <small>${p.hand.length}</small></h2><span>Tap a card to inspect & play</span></div><div class="rp-hand">${p.hand.map((id,i)=>piece(id,null,G,`data-rp-hand="${i}"`,G.phase === 'setup' && chosen.includes(i))).join('') || '<p>Your hand is empty.</p>'}</div></section>`
    + `<div class="rp-bottom"><p class="rp-last-event" aria-live="polite">${esc(last)}</p><div class="rp-bottom-actions">${over ? button('Back to ladder','data-rp-ladder',false,'is-primary') + button('Play again','data-rp-again') : G.phase === 'setup' && !p.ready ? button('Confirm lineup','data-rp-ready',st.setup.active == null,'is-primary') : button('End turn','data-rp-end',!legal.some(m=>m.a==='end'),'is-primary')}${button('Battle log','data-rp-log')}${button('Table finish','data-rp-table')}${button('Settings','data-rp-settings')}${over ? '' : button('Concede','data-rp-concede')}</div></div>`
    + '<p class="rp-footnote">Fictional card-balance values · Collection ownership is preserved</p>';
  host.querySelector('.rp-hand').scrollLeft = scroll;
  if (focusKey != null) host.querySelector(`[data-rp-hand="${Number(focusKey)}"]`)?.focus({preventScroll:true});
}
function onClick(st,e) {
  const q = s => e.target.closest(s); let b;
  if (!st.x || st.hidden) return;
  if (q('[data-rp-help]')) return help(st);
  if (q('[data-rp-jump-hand]')) {
    const hand=st.el.querySelector('.rp-hand-section');
    hand.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    hand.querySelector('button')?.focus({preventScroll:true});return;
  }
  if (q('[data-rp-table]')) return tableOptions(()=>draw(st));
  if (q('[data-rp-settings]')) return musicSheet();
  if ((b=q('[data-rp-hand]'))) return inspect(st,{hand:Number(b.dataset.rpHand)});
  if ((b=q('[data-rp-slot]'))) return inspect(st,{u:b.dataset.rpSlot,side:Number(b.dataset.rpSide)});
  if (q('[data-rp-ready]')) { const hand=st.x.G.p[st.x.you].hand; return send(st,{a:'setup',act:hand[st.setup.active],bench:st.setup.bench.map(i=>hand[i])}); }
  if (q('[data-rp-end]')) return send(st,{a:'end'});
  if ((b=q('[data-rp-choice]'))) { const moves=B.legalActions(st.x.G,st.x.you).filter(m=>['promote','choose-switch'].includes(m.a)); return send(st,moves[Number(b.dataset.rpChoice)]); }
  if (q('[data-rp-stadium]')) { const s=st.x.G.stadium,c=C.card(typeof s === 'string'?s:s.id); return showSheet(st,c.name,`<p>${esc(c.text)}</p>`); }
  if (q('[data-rp-log]')) return showSheet(st,'Battle log',`<ol class="rp-log">${(st.x.G.events || []).map(ev=>eventText(ev,st.x.you,st.x.opp.name)).filter(Boolean).map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`);
  if ((b=q('[data-rp-discard]'))) { const p=st.x.G.p[Number(b.dataset.rpDiscard)]; return showSheet(st,'Discard pile',`<ul>${p.discard.map(id=>`<li>${esc(name(id))}</li>`).join('') || '<li>No discarded cards yet.</li>'}</ul>`); }
  if (q('[data-rp-ladder]')) return st.ctx.nav('/puzzles/dynasty');
  if (q('[data-rp-again]')) { const r=SOLO.start(st.x.opp.cpu.id); if (r.ok) st.ctx.nav(`/puzzles/dynasty/battle/${r.mid}`); else ui.toast(r.why,{icon:'info'}); return; }
  if (q('[data-rp-concede]')) return showSheet(st,'Concede this battle?',`<p>This match will count as a loss. Your cards and collection are kept.</p>${button('Concede battle','data-rp-confirm-concede')}`,ev=>{if(ev.target.closest('[data-rp-confirm-concede]')) {closeSheet(st); SOLO.resign(st.mid);draw(st);}});
}

export default {
  id:'dynasty-battle', chrome:'none', title:'Battle',
  render() { return '<div class="rp-battle" data-rp data-no-swipe></div>'; },
  mount(el,ctx) {
    const st={el,ctx,mid:String(ctx.params?.id||''),profile:profileKey(),setup:{active:null,bench:[]},hidden:!ctx.visible,dead:false,stops:[],eventAt:null};
    ST.set(ctx,st);
    if (!el.querySelector('[data-rp]')) el.innerHTML=this.render();
    st.music=attachMusic(el,ctx.visible,'battle'); st.sfx=sfx.attach(el,ctx.visible);
    const click=e=>onClick(st,e);el.addEventListener('click',click);
    st.stops.push(()=>el.removeEventListener('click',click),()=>st.music.stop(),()=>st.sfx.stop(),SOLO.subscribe(()=>draw(st)),data.subscribe(t=>{
      if(t!=='me')return;
      closeSheet(st);st.eventAt=null;
      if(profileKey()!==st.profile){st.stale=true;st.music.visible(false);st.sfx.visible(false);document.documentElement.classList.remove('is-dynasty-battle');if(!st.hidden&&!st.left){st.left=true;st.ctx.back();}return;}
      draw(st);
    }));
    document.documentElement.classList.toggle('is-dynasty-battle',!!ctx.visible && D.mayPlay());
    D.load().then(()=>draw(st),()=>draw(st));draw(st);
  },
  onShow(ctx) { const st=ST.get(ctx);if(st){if(st.stale){st.ctx.back();return;}st.hidden=false;st.music.visible(true);st.sfx.visible(true);document.documentElement.classList.toggle('is-dynasty-battle',D.mayPlay());draw(st);} },
  onHide(ctx) { const st=ST.get(ctx);if(st){st.hidden=true;closeSheet(st);st.music.visible(false);st.sfx.visible(false);document.documentElement.classList.remove('is-dynasty-battle');} },
  unmount(el,ctx) {const st=ST.get(ctx);if(!st)return;st.dead=true;closeSheet(st);st.stops.forEach(fn=>fn());document.documentElement.classList.remove('is-dynasty-battle');D.flush();ST.delete(ctx);}
};
