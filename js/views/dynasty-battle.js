// A Gridiron Dynasty battle (/puzzles/dynasty/battle/<match id>, a cover over Daily Games; the owner's asks, Oct 28 2026:
// Pokémon TCG Pocket's rules with the Dynasty's cards, between players, in turns like chess). The rules are
// core/dynasty-battle.js's, the match (both sides' moves, whose turn) core/dynasty-match.js's.
// The screen: their bench and active player at the top, yours below, your hand along the bottom, then this turn's
// energy, Switch and End turn. Tap your active player to attack (his attacks, each lit when its energy is on him); tap a
// card in your hand to play it; tap a player to see his card. Your setup (an active player and up to 3 on the bench)
// before the first turn. What they did since you last looked comes up first (their turn, line by line).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-battle.js';
import * as MT from '../core/dynasty-match.js';
import {anyHTML, cardHTML, battleHTML, pipHTML} from './dynasty.js';

const esc = data.esc, nf = n => data.nf(n);
const ST = new WeakMap();
const SEEN = mid => `gg-dyb-seen-${mid}`;
const nameOf = id => (D.anyCard(id) ? D.anyCard(id).name : 'a card');
const short = id => { const c = D.card(id); return c ? D.nameParts(c.name)[1] || c.name : nameOf(id); };

// ---------------------------------------------------------------------------------------------------- what happened
/** One event in words (you: your seat; opp: their name). Their draws stay hidden. */
function evText(ev, you, opp) {
  const who = ev.who === you ? 'You' : opp, mine = ev.who === you;
  switch (ev.k) {
    case 'setup': return `${who} lined up ${nameOf(ev.act)}${ev.bench.length ? ` with ${ev.bench.length} on the bench` : ''}.`;
    case 'draw': return mine ? `You drew ${nameOf(ev.id)}.` : '';
    case 'bench': return `${who} put ${nameOf(ev.id)} on the bench.`;
    case 'evolve': return `${who} evolved ${short(ev.from)} into ${D.card(ev.id) && D.card(ev.id).t ? D.card(ev.id).t : D.SERIES[(D.card(ev.id) || {}).s] ? D.SERIES[D.card(ev.id).s].name : ''} ${short(ev.id)}.`;
    case 'energy': return `${who} gave ${short(ev.id)} a ${B.ENERGY[ev.e]} energy.`;
    case 'stadium': return `${who} played ${nameOf(ev.id)}.`;
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
      if (ev.missed) return `${x}: ${short(ev.target)} jukes it! No damage.`;
      x += ` hits ${short(ev.target)} for ${ev.dmg}${ev.weak ? ' (weakness)' : ''}.`;
      if (ev.strip || ev.sack) x += ' An energy is knocked off.';
      if (ev.stunned) x += ' Stunned!';
      if (ev.injured) x += ' Injured!';
      if (ev.counter) x += ` Lockdown hits back for ${ev.counter}.`;
      if (ev.heal) x += ` Heals ${ev.heal}.`;
      return x;
    }
    case 'ko': return `${short(ev.id)} is knocked out! ${ev.who === you ? opp : 'You'} score${ev.who === you ? 's' : ''} ${ev.pts === 2 ? '2 touchdowns' : 'a touchdown'}.`;
    case 'over': return '';
    default: return '';
  }
}

// ---------------------------------------------------------------------------------------------------- pieces
function slotHTML(slot, side, act, pick) {
  if (!slot) return `<div class="db-slot is-empty${act ? ' is-act' : ''}" aria-hidden="true"></div>`;
  const st = B.stats(slot.id), hp = st.hp, left = Math.max(0, hp - slot.dmg), c = D.card(slot.id);
  const label = `${c.name}, ${left} of ${hp} HP${slot.en.length ? `, ${slot.en.length} energy` : ''}${slot.stun ? ', Stunned' : ''}${slot.inj ? ', Injured' : ''}`;
  return `<button type="button" class="db-slot${act ? ' is-act' : ''}${pick ? ' is-pick' : ''}${left <= hp * 0.3 ? ' is-low' : ''}" data-db-slot="${slot.u}" data-side="${side}" aria-label="${esc(label)}">`
    + cardHTML(c, {size: 's', tag: false})
    + `<span class="db-hp" aria-hidden="true"><i style="width:${Math.round(left / hp * 100)}%"></i><b>${left}</b></span>`
    + `<span class="db-en" aria-hidden="true">${slot.en.map(pipHTML).join('')}</span>`
    + (slot.stun || slot.inj ? `<span class="db-conds" aria-hidden="true">${slot.stun ? '<i>STUN</i>' : ''}${slot.inj ? '<i class="is-inj">INJ</i>' : ''}</span>` : '')
    + '</button>';
}
const tds = n => `<span class="db-tds" aria-label="${n} of ${B.WIN_POINTS} touchdowns">${Array.from({length: B.WIN_POINTS}, (_, i) => `<i class="${i < n ? 'is-on' : ''}"></i>`).join('')}</span>`;

function draw(st) {
  if (st.dead) return;
  const host = st.el.querySelector('[data-db]');
  // (Evan's and Ryan Stewart's alone, Oct 28 2026: a profile switched while it's open leaves it)
  if (!D.mayPlay()) { host.innerHTML = ''; if (!st.left) { st.left = true; st.ctx.back(); } return; }
  if (D.status !== 'ready') { host.innerHTML = `<div class="db-msg">${ui.skeleton('rows', 3, {label: 'Loading the battle'})}</div>`; return; }
  const x = MT.get(st.mid);
  const close = ui.iconButton({icon: 'close', label: 'Close', cls: 'db-x', filled: true, attrs: 'data-back'});
  if (!x || !x.G) {
    const why = !x ? 'This battle isn’t here (yet). It shows once the board has it.' : x.state === 'invite' ? `${x.opp.name} challenged you. Accept it on the Battle tab.`
      : x.state === 'sent' ? `Waiting for ${x.opp.name} to accept your challenge.` : 'This battle was called off.';
    host.innerHTML = `<header class="db-top">${close}</header><div class="db-msg">${ui.empty({icon: 'versus', title: 'Battle', body: why})}</div>`;
    return;
  }
  st.x = x;
  const G = x.G, you = x.you, me = G.p[you], op = G.p[1 - you], over = x.state === 'over';
  const myMove = x.state === 'yours' || x.state === 'setup';
  const mode = myMove ? st.mode : null;
  const can = m => myMove && B.check(G, you, m).ok;
  const pickMine = u => {
    if (G.phase === 'setup') return false;
    if (me.promote) return me.bench.some(s => s.u === u);
    if (!mode) return false;
    if (mode.k === 'energy') return can({a: 'energy', on: u});
    if (mode.k === 'evolve') return can({a: 'evolve', id: mode.id, on: u});
    if (mode.k === 'coach') return can({a: 'coach', id: mode.id, on: u});
    if (mode.k === 'retreat') return can({a: 'retreat', to: u});
    return false;
  };
  // the status line
  let status;
  if (over) status = `<b class="${x.result === 'w' ? 'is-w' : x.result === 'l' ? 'is-l' : ''}">${x.result === 'w' ? 'You win!' : x.result === 'l' ? 'You lose' : 'A draw'}</b> ${esc({points: 'Three touchdowns.', empty: 'No players left.', time: 'The turn limit.', resign: x.result === 'w' ? 'They resigned.' : 'You resigned.', claim: 'Left 72 hours.'}[x.why] || '')}`;
  else if (x.state === 'setup') status = st.setup.act ? `Bench: tap up to ${B.BENCH_MAX} more Basic players, then Ready.` : 'Pick your starting player: tap a Basic player in your hand.';
  else if (x.state === 'theirs') status = G.phase === 'setup' ? `Waiting for ${esc(x.opp.name)} to set up.` : `${esc(x.opp.name)}’s turn. You’ll see it here when they move.`;
  else if (me.promote) status = 'Your player was knocked out: pick who comes in from your bench.';
  else if (mode) status = {energy: 'Tap a player to give him the energy.', evolve: 'Tap the player to evolve.', coach: 'Tap a player for it.', retreat: 'Tap the bench player to send in.'}[mode.k] + ' <button type="button" class="db-link" data-db-cancel>Cancel</button>';
  else status = `<b>Your turn.</b> ${me.en && !me.used.energy ? `Attach your ${B.ENERGY[me.en]} energy, then tap` : 'Tap'} your active player to attack.`;
  // the hand (yours; theirs, face down)
  const handHTML = me.hand.map((id, i) => {
    const sel = x.state === 'setup' && (st.setup.act === id && st.setup.actI === i || st.setup.benchI.includes(i));
    return `<button type="button" class="db-card${sel ? ' is-sel' : ''}" data-db-hand="${i}" aria-label="${esc(nameOf(id))}">${anyHTML(id, {size: 's', tag: false})}</button>`;
  }).join('');
  const stadium = G.stadium ? `<span class="db-stad">${ui.icon('star', {size: 13})}${esc(D.trainer(G.stadium.id).name)}</span>` : '';
  // (setup: what you've picked so far, before it goes up)
  const preview = x.state === 'setup' ? {active: st.setup.act ? {u: -1, id: st.setup.act, dmg: 0, en: []} : null, bench: st.setup.bench.map((id, i) => ({u: -2 - i, id, dmg: 0, en: []}))} : null;
  const mySlots = preview || me;
  const log = G.ev.map(e => ({e, t: evText(e, you, x.opp.name)})).filter(l => l.t).slice(-2).reverse();
  host.innerHTML = `<header class="db-top">${close}<span class="db-who">${x.opp.member ? ui.avatar(x.opp.member, {size: 28}) : ui.nickAvatar(x.opp.name, {size: 28})}`
    + `<b>${esc(x.opp.name)}</b>${tds(op.pts)}</span><span class="db-count">${op.hand.length} in hand · deck ${op.deck.length}</span>${over ? '' : ui.iconButton({icon: 'list', label: 'Battle log and resign', cls: 'db-more', attrs: 'data-db-more'})}</header>`
    + `<section class="db-row is-bench is-opp">${[0, 1, 2].map(i => slotHTML(op.bench[i], 'opp', false, false)).join('')}</section>`
    + `<section class="db-row is-active is-opp">${slotHTML(op.active, 'opp', true, false)}</section>`
    + `<div class="db-mid"><p class="db-status" aria-live="polite">${status}</p>${stadium}`
    + `<button type="button" class="db-log" data-db-log>${log.map((l, i) => `<span class="${i === 0 ? 'is-new' : ''}">${esc(l.t)}</span>`).join('') || '<span>The battle begins.</span>'}</button></div>`
    + `<section class="db-row is-active is-me">${slotHTML(mySlots.active, 'me', true, mySlots.active && pickMine(mySlots.active.u))}</section>`
    + `<section class="db-row is-bench is-me">${[0, 1, 2].map(i => slotHTML(mySlots.bench[i], 'me', false, mySlots.bench[i] && pickMine(mySlots.bench[i].u))).join('')}</section>`
    + `<div class="db-you"><b>You</b>${tds(me.pts)}<span class="db-count">deck ${me.deck.length}</span></div>`
    + `<div class="db-hand" data-hscroll>${handHTML || '<span class="db-none">No cards in hand</span>'}</div>`
    + `<footer class="db-bar">${barHTML(st, x, G, me, myMove, over)}</footer>`;
  ui.hydrate(host);
  // (what happened since you last looked: their turn, line by line)
  if (!st.shown) {
    st.shown = true;
    let seen = Number(ui.lsGet(SEEN(st.mid))) || 0;
    const fresh = G.ev.slice(seen).filter(e => e.who !== you).map(e => evText(e, you, x.opp.name)).filter(Boolean);
    if (fresh.length && seen > 0) ui.openSheet({title: `${x.opp.name}’s turn`, body: `<ol class="db-recap">${fresh.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`, cls: 'dy-sheet', detents: ['fit']});
  }
  ui.lsSet(SEEN(st.mid), String(G.ev.length));
  // (the hits since the last draw)
  if (st.evAt != null && G.ev.length > st.evAt) {
    G.ev.slice(st.evAt).forEach(e => {
      if (e.k !== 'attack' || e.missed) return;
      const el = host.querySelector(`[data-db-slot="${e.tu}"]`);
      if (el) { el.classList.add('is-hit'); try { ui.floatText(el, `-${e.dmg}`, {cls: 'db-float'}); } catch (_) {} }
    });
    if (G.ev.slice(st.evAt).some(e => e.k === 'ko')) ui.haptic('success');
  }
  st.evAt = G.ev.length;
  if (over && !st.cheered) {
    st.cheered = true;
    if (x.result === 'w') { try { ui.confetti(host.getBoundingClientRect()); } catch (_) {} }
  }
}
function barHTML(st, x, G, me, myMove, over) {
  if (over) {
    const pay = D.BATTLE_PAY[x.result];
    return `<span class="db-pay">+${nf(pay.coins)} coins · ${pay.tr >= 0 ? '+' : ''}${pay.tr} trophies</span>${ui.button({label: 'Back to Dynasty', kind: 'primary', size: 's', attrs: 'data-back'})}`;
  }
  if (x.state === 'setup') return ui.button({label: 'Ready', kind: 'primary', attrs: {'data-db-ready': ''}, disabled: !st.setup.act, cls: 'db-go'});
  if (!myMove) return `<span class="db-wait">${ui.icon('clock', {size: 15})} Their move</span>${ui.button({label: 'Resign', kind: 'plain', size: 's', attrs: {'data-db-resign': ''}})}`;
  const en = me.en && !me.used.energy
    ? `<button type="button" class="db-energy" data-db-energy>${pipHTML(me.en)}<span>Attach ${esc(B.ENERGY[me.en])}</span></button>`
    : `<span class="db-energy is-off">${me.used.energy ? 'Energy attached' : 'No energy this turn'}</span>`;
  const sw = me.active && me.bench.length && !me.used.retreat && !me.promote ? ui.button({label: `Switch${B.retreatCost(me.active) ? ` (${B.retreatCost(me.active)})` : ''}`, kind: 'secondary', size: 's', attrs: {'data-db-switch': ''}}) : '';
  return en + sw + ui.button({label: 'End turn', kind: 'secondary', size: 's', attrs: {'data-db-end': ''}, disabled: me.promote});
}

// ---------------------------------------------------------------------------------------------------- moves
function send(st, m) {
  const r = MT.move(st.mid, m);
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return false; }
  st.mode = null;
  if (r.sent && m.a !== 'setup') ui.toast(`Turn sent. ${st.x ? st.x.opp.name : 'They'} will see it.`, {icon: 'check-circle'});
  ui.haptic('selection');
  draw(st);
  return true;
}
function detail(st, id, slot) {
  const st2 = B.stats(id);
  const hp = slot && st2 ? `<p class="dy-own">${Math.max(0, st2.hp - slot.dmg)} of ${st2.hp} HP left${slot.en.length ? ` · energy ${slot.en.map(pipHTML).join('')}` : ''}${slot.stun ? ' · Stunned' : ''}${slot.inj ? ' · Injured' : ''}</p>` : '';
  ui.openSheet({title: nameOf(id), body: `<div class="dy-sheet-card is-s">${anyHTML(id, {size: 'm', tag: false})}</div>${hp}${battleHTML(id)}`, cls: 'dy-sheet', detents: ['large']});
}
function attackSheet(st) {
  const x = st.x, G = x.G, me = G.p[x.you], a = me.active;
  const s = B.stats(a.id);
  const body = `<div class="db-atkpick">${s.attacks.map((t, n) => {
    const ok = B.check(G, x.you, {a: 'attack', n});
    return `<button type="button" class="db-atkb" data-db-atk="${n}"${ok.ok ? '' : ' disabled'}><span class="db-cost">${t.cost.map(pipHTML).join('')}</span>`
      + `<span class="db-an"><b>${esc(t.name)}</b><small>${esc(B.fxText(t) || (ok.ok ? 'Ready' : ok.why))}</small></span><em>${t.dmg}</em></button>`;
  }).join('')}</div>`
    + (s.ability ? `<div class="db-ab"><b>Ability · ${esc(B.ABILITY[s.ability].name)}</b><span>${esc(B.ABILITY[s.ability].text)}</span></div>` : '')
    + `<div class="dy-acts">${ui.button({label: 'See his card', kind: 'secondary', block: true, attrs: {'data-db-see': ''}})}</div>`;
  const sh = ui.openSheet({title: `${nameOf(a.id)} · attack`, body, cls: 'dy-sheet', detents: ['fit']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-db-atk]');
    if (b && !b.disabled) { sh.close(); setTimeout(() => send(st, {a: 'attack', n: Number(b.dataset.dbAtk)}), 200); return; }
    if (e.target.closest('[data-db-see]')) { sh.close(); detail(st, a.id, a); }
  });
}
function handTap(st, i) {
  const x = st.x, G = x.G, you = x.you, me = G.p[you], id = me.hand[i];
  if (x.state === 'setup') {
    if (!B.isBasic(id)) { ui.toast('Only Basic players start the game.', {icon: 'info'}); return; }
    const S = st.setup;
    if (S.actI === i) { S.act = null; S.actI = -1; }
    else if (S.benchI.includes(i)) { const k = S.benchI.indexOf(i); S.benchI.splice(k, 1); S.bench.splice(k, 1); }
    else if (!S.act) { S.act = id; S.actI = i; }
    else if (S.bench.length < B.BENCH_MAX) { S.bench.push(id); S.benchI.push(i); }
    ui.haptic('selection'); draw(st); return;
  }
  if (x.state !== 'yours') { detail(st, id); return; }
  const t = D.trainer(id), stt = B.stats(id), acts = [];
  if (t && t.kind === 'coach') acts.push({label: `Play ${t.name}`, role: 'primary', value: 'coach'});
  if (t && t.kind === 'stadium') acts.push({label: `Play ${t.name}`, role: 'primary', value: 'stadium'});
  if (stt && stt.stage === 0) acts.push({label: 'Put him on your bench', role: 'primary', value: 'bench'});
  if (stt && stt.stage === 1) acts.push({label: 'Evolve', role: 'primary', value: 'evolve'});
  acts.push({label: 'See the card', value: 'see'});
  ui.actionSheet({title: nameOf(id), message: t ? t.text : '', actions: acts}).then(v => {
    if (!v) return;
    if (v === 'see') { detail(st, id); return; }
    if (v === 'bench') { send(st, {a: 'bench', id}); return; }
    if (v === 'stadium') { send(st, {a: 'stadium', id}); return; }
    if (v === 'evolve') {
      const on = B.slots(me).filter(s => B.check(G, you, {a: 'evolve', id, on: s.u}).ok);
      if (!on.length) { ui.toast(B.check(G, you, {a: 'evolve', id, on: (B.slots(me)[0] || {}).u}).why, {icon: 'info'}); return; }
      if (on.length === 1) { send(st, {a: 'evolve', id, on: on[0].u}); return; }
      st.mode = {k: 'evolve', id}; draw(st); return;
    }
    if (v === 'coach') {
      if (t.target) { st.mode = {k: 'coach', id}; draw(st); if (!B.slots(me).some(s => B.check(G, you, {a: 'coach', id, on: s.u}).ok)) { st.mode = null; ui.toast(B.check(G, you, {a: 'coach', id, on: 0}).why, {icon: 'info'}); draw(st); } return; }
      send(st, {a: 'coach', id});
    }
  });
}
function slotTap(st, u, side) {
  const x = st.x, G = x.G, you = x.you, me = G.p[you];
  if (side === 'opp') { const sl = B.slots(G.p[1 - you]).find(s => s.u === u); if (sl) detail(st, sl.id, sl); return; }
  if (x.state === 'setup') return;
  const sl = B.slots(me).find(s => s.u === u);
  if (!sl) return;
  if (x.state === 'yours') {
    if (me.promote) { send(st, {a: 'promote', u}); return; }
    const mode = st.mode;
    if (mode) {
      const m = mode.k === 'energy' ? {a: 'energy', on: u} : mode.k === 'evolve' ? {a: 'evolve', id: mode.id, on: u} : mode.k === 'coach' ? {a: 'coach', id: mode.id, on: u} : {a: 'retreat', to: u};
      const r = B.check(G, you, m);
      if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
      send(st, m); return;
    }
    if (sl === me.active) { attackSheet(st); return; }
  }
  detail(st, sl.id, sl);
}
function more(st) {
  ui.actionSheet({title: 'Battle', actions: [{label: 'Whole battle log', value: 'log'}, {label: 'Resign', role: 'destructive', value: 'resign'}]}).then(v => {
    if (v === 'log') logSheet(st);
    if (v === 'resign') resign(st);
  });
}
function resign(st) {
  ui.actionSheet({title: 'Resign this battle?', message: 'It counts as a loss.', actions: [{label: 'Resign', role: 'destructive', value: 'y'}]}).then(v => {
    if (v !== 'y') return;
    const r = MT.resign(st.mid);
    if (!r.ok) ui.toast(r.why, {icon: 'info'}); else draw(st);
  });
}
function logSheet(st) {
  const x = st.x, lines = [];
  let turn = -1;
  x.G.ev.forEach(e => {
    if (e.k === 'turn') { turn = e.n; lines.push(`<li class="db-lt">${e.who === x.you ? 'Your turn' : `${esc(x.opp.name)}’s turn`}</li>`); return; }
    const t = evText(e, x.you, x.opp.name);
    if (t) lines.push(`<li>${esc(t)}</li>`);
  });
  void turn;
  ui.openSheet({title: 'Battle log', body: `<ol class="db-recap">${lines.reverse().join('')}</ol>`, cls: 'dy-sheet', detents: ['large']});
}

export default {
  id: 'dynasty-battle',
  chrome: 'none',
  title: 'Battle',

  render() { return '<div class="db" data-db data-no-swipe></div>'; },

  mount(el, ctx) {
    const st = {el, ctx, mid: String((ctx.params && ctx.params.id) || ''), mode: null, setup: {act: null, actI: -1, bench: [], benchI: []}, dead: false, stops: [], evAt: null};
    ST.set(ctx, st);
    el.addEventListener('click', e => {
      const q = s => e.target.closest(s);
      let b;
      if (!st.x) return;
      if (q('[data-db-cancel]')) { st.mode = null; draw(st); return; }
      if ((b = q('[data-db-hand]'))) { handTap(st, Number(b.dataset.dbHand)); return; }
      if ((b = q('[data-db-slot]'))) { slotTap(st, Number(b.dataset.dbSlot), b.dataset.side); return; }
      if (q('[data-db-energy]')) {
        const me = st.x.G.p[st.x.you];
        if (me.promote) { ui.toast('Pick your new active player first.', {icon: 'info'}); return; }
        // (one player: straight to him)
        if (B.slots(me).length === 1) { send(st, {a: 'energy', on: me.active.u}); return; }
        st.mode = st.mode && st.mode.k === 'energy' ? null : {k: 'energy'}; draw(st); return;
      }
      if (q('[data-db-switch]')) {
        const me = st.x.G.p[st.x.you], r = B.check(st.x.G, st.x.you, {a: 'retreat', to: me.bench[0] && me.bench[0].u});
        if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
        st.mode = {k: 'retreat'}; draw(st); return;
      }
      if (q('[data-db-end]')) {
        ui.actionSheet({title: 'End your turn without attacking?', actions: [{label: 'End turn', role: 'primary', value: 'y'}]}).then(v => { if (v === 'y') send(st, {a: 'end'}); });
        return;
      }
      if (q('[data-db-ready]')) {
        const S = st.setup;
        if (send(st, {a: 'setup', act: S.act, bench: S.bench.slice()})) { st.setup = {act: null, actI: -1, bench: [], benchI: []}; ui.toast('Lineup set', {icon: 'check-circle'}); }
        return;
      }
      if (q('[data-db-resign]')) { resign(st); return; }
      if (q('[data-db-more]')) { more(st); return; }
      if (q('[data-db-log]')) logSheet(st);
    });
    // (their moves come in with the board)
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') draw(st); }));
    st.stops.push(MT.subscribe(() => draw(st)));
    st.stops.push(data.subscribe(type => { if (type === 'me') { st.shown = false; draw(st); } }));
    D.load().then(() => draw(st), () => draw(st));
    draw(st);
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    MT.flush(); D.flush();
    ST.delete(ctx);
  }
};
