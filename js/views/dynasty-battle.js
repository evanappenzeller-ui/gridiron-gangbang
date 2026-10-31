// Gridiron Rivals match (/puzzles/dynasty/battle/<match id>). Rules and saved turns live in the core modules.
// A tabletop holds both lineups and a sortable, fanned hand. Tapping a hand card previews it;
// explicit Play commits it or highlights legal targets. Attacks show damage ranges and version-aware costs on the board.
// Collectible card details, the complete log and match options remain available without interrupting ordinary moves.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-battle.js';
import * as MT from '../core/dynasty-match.js';
import * as SOLO from '../core/dynasty-solo.js';
import {anyHTML, battleHTML, pipHTML, headUrl, isPhoto} from './dynasty.js';
import {bindCardFoil} from './dynasty-foil.js';

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
    case 'bench': return `${who} put ${nameOf(ev.id)} on the bench.`;
    case 'evolve': return `${who} evolved ${short(ev.from)} into ${D.card(ev.id) && D.card(ev.id).t ? D.card(ev.id).t : D.SERIES[(D.card(ev.id) || {}).s] ? D.SERIES[D.card(ev.id).s].name : ''} ${short(ev.id)}.`;
    case 'energy': return `${who} gave ${short(ev.id)} a ${B.ENERGY[ev.e]} energy.`;
    case 'stadium': return `${who} played ${nameOf(ev.id)}.`;
    case 'item': return `${who} played ${nameOf(ev.id)}${ev.got && mine ? `: ${nameOf(ev.got)}` : ''}${ev.heal ? `: healed ${ev.heal}` : ''}.`;
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
      if (ev.spent) x += ` Spends 1 ${B.ENERGY[ev.spent]} energy.`;
      if (ev.jukeReduced) x += ` Juke blocks ${ev.jukeReduced}.`;
      return x;
    }
    case 'ko': return `${short(ev.id)} is knocked out! ${ev.who === you ? opp : 'You'} score${ev.who === you ? 's' : ''} ${ev.pts === 2 ? '2 touchdowns' : 'a touchdown'}.`;
    case 'over': return '';
    default: return '';
  }
}

// ---------------------------------------------------------------------------------------------------- presentation
// Sort copies carrying original hand indexes: duplicate cards and setup selections keep their identity.
function handType(id) {
  const t = D.trainer(id), s = B.stats(id);
  return t ? {coach: 'Coach', item: 'Item', stadium: 'Stadium'}[t.kind] : `${B.TYPES[s.type].name} · ${s.stage ? 'Upgrade' : 'Basic'}`;
}
function handOrder(hand, sort) {
  const cards = hand.map((id, i) => ({id, i}));
  const power = id => Math.max(0, ...(B.stats(id)?.attacks || []).map(a => a.dmg));
  return cards.sort((a, b) => (sort === 'name' ? nameOf(a.id).localeCompare(nameOf(b.id))
    : sort === 'type' ? handType(a.id).localeCompare(handType(b.id))
    : sort === 'power' ? power(b.id) - power(a.id) : 0) || a.i - b.i);
}
function revealHand(st, card) {
  const hand = st.el.querySelector('.db-hand');
  card = card || hand?.querySelector('.is-sel');
  if (!hand || !card) return;
  const box = card.getBoundingClientRect(), frame = hand.getBoundingClientRect();
  hand.scrollLeft += box.left + box.width / 2 - frame.left - frame.width / 2;
}
function browseHand(st, step, edge) {
  const cards = [...st.el.querySelectorAll('[data-db-hand]')];
  if (!cards.length) return;
  const at = cards.findIndex(c => c === document.activeElement);
  const remembered = cards.findIndex(c => Number(c.dataset.dbHand) === st.browseI);
  const current = at >= 0 ? at : remembered >= 0 ? remembered : cards.findIndex(c => c.classList.contains('is-sel'));
  const n = edge === 'first' ? 0 : edge === 'last' ? cards.length - 1
    : current < 0 ? step > 0 ? 0 : cards.length - 1 : (current + step + cards.length) % cards.length;
  cards[n].focus({preventScroll: true}); revealHand(st, cards[n]);
}
function athleteHTML(id, role) {
  const c = D.card(id), team = c && D.teamOf(c.team);
  // Vector athletes remain crisp at phone and desktop sizes and need no downloaded animation assets.
  return `<div class="db-cinema-player is-${role}" style="--jersey:${esc(team?.pri || '#436D7B')}"><svg class="db-athlete" viewBox="0 0 160 220" aria-hidden="true">
    <ellipse cx="80" cy="211" rx="50" ry="7" fill="#0004"/>
    <g stroke="#152530" stroke-width="4" stroke-linejoin="round">
      <path d="M55 143L77 146 65 192 43 196 45 184Z" fill="#F0EEE3"/><path d="M84 145L105 141 125 181 115 196 97 187Z" fill="#F0EEE3"/>
      <path d="M43 188L66 190 67 207 32 207Q30 198 43 188Z" fill="#23353D"/><path d="M110 187L126 184 139 203 114 209 102 201Z" fill="#23353D"/>
      <path d="M49 76L31 92 18 126 34 133 55 105Z" fill="var(--jersey)"/><path d="M109 76L129 89 146 115 133 129 105 104Z" fill="var(--jersey)"/>
      <path d="M20 119L35 126 49 114 58 127 35 144 14 133Z" fill="#C88E64"/><path d="M137 112L148 120 134 143 112 138 114 122 130 127Z" fill="#C88E64"/>
      <path d="M48 78Q80 62 111 78L111 116 104 151 55 151 47 115Z" fill="var(--jersey)"/>
      <path d="M54 144H105V155H54Z" fill="#F0EEE3"/>
      <rect x="68" y="55" width="25" height="22" rx="8" fill="#C88E64"/>
      <path d="M51 38Q51 9 80 9 111 9 112 40L107 61 91 71 61 63Z" fill="var(--jersey)"/>
      <path d="M75 12V32M58 38H111" fill="none" stroke="#F0EEE3" stroke-width="7"/>
      <path d="M87 40H113L109 62H86Z" fill="#162D3C"/><path d="M83 46H118V65H88Z" fill="none" stroke="#D5DFE0" stroke-width="3"/>
    </g><text x="80" y="124" transform="${role === 'defender' ? 'translate(160 0) scale(-1 1)' : ''}" text-anchor="middle" fill="#FFF" font-family="sans-serif" font-size="34" font-weight="900">${esc(c?.num || c?.pos || 'R')}</text>
    </svg><b>${esc(nameOf(id))}</b><small>${role === 'attacker' ? 'On the attack' : 'Defending'}</small></div>`;
}
function clearCinema(st) {
  clearTimeout(st.sceneRetry); st.sceneRetry = null;
  clearTimeout(st.sceneTimer); st.sceneTimer = null;
  st.scenes = []; st.scene = null;
  st.el.querySelector('.db-cinema')?.remove();
  const host = st.el.querySelector('[data-db]');
  if (host) { host.inert = false; host.classList.remove('is-presenting'); }
}
function finishCinema(st) {
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
// Match cards use a readable game face; the full collectible is available from Details.
function faceHTML(id, slot = null) {
  const c = D.card(id), t = D.trainer(id), stats = c && B.stats(id);
  const team = c && D.teamOf(c.team), type = stats && B.TYPES[stats.type];
  const rarity = (c || t).r || 'common';
  const hp = stats ? Math.max(0, stats.hp - (slot ? slot.dmg : 0)) : 0;
  const art = c ? `<span class="db-face-art" style="--team:${team.pri}"><span class="db-face-number">${esc(c.num || c.pos)}</span>${c.head && !/^https?:/.test(c.head) ? `<img${isPhoto(c.head) ? ' class="is-photo"' : ''} src="${esc(headUrl(c.head, 300))}" alt="""" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>`
    : `<span class="db-face-art is-tactic">${ui.icon(t.kind === 'stadium' ? 'star' : t.kind === 'coach' ? 'football' : 'bolt', {size: 28})}</span>`;
  return `<span class="db-face r-${esc(rarity)}${c ? '' : ' is-tactic'}" style="--type:${type ? type.color : '#C59A48'}">${art}`
    + `<span class="db-face-copy"><span class="db-face-role">${c ? `${esc(c.pos)} · ${esc(team.abbr || c.team)}` : esc({coach: 'Coach', item: 'Item', stadium: 'Stadium'}[t.kind])}</span>`
    + `<b class="db-face-name">${esc(nameOf(id))}</b>`
    + (c ? `<span class="db-face-health"><b>${hp}</b><small> / ${stats.hp} HP</small></span><span class="db-face-meter"><i style="width:${Math.round(hp / stats.hp * 100)}%"></i></span>`
      : `<span class="db-face-hint">${esc(t.kind === 'coach' ? 'One per turn' : t.kind === 'stadium' ? 'Changes the field' : 'Play from hand')}</span>`)
    + '</span></span>';
}
function slotHTML(slot, side, act, pick) {
  if (!slot) return `<div class="db-slot is-empty${act ? ' is-act' : ''}"><span>${act ? 'Active player' : 'Bench'}</span></div>`;
  const stats = B.stats(slot.id), hp = stats.hp, left = Math.max(0, hp - slot.dmg);
  const label = `${nameOf(slot.id)}, ${left} of ${hp} HP, ${slot.en.length} energy${slot.stun ? ', Stunned' : ''}${slot.inj ? ', Injured' : ''}${pick ? ', choose this player' : ', view details'}`;
  return `<button type="button" class="db-slot${act ? ' is-act' : ''}${pick ? ' is-pick' : ''}${left <= hp * 0.3 ? ' is-low' : ''}" data-db-slot="${slot.u}" data-side="${side}" aria-label="${esc(label)}">`
    + faceHTML(slot.id, slot)
    + `<span class="db-en" aria-label="${slot.en.length} attached energy">${slot.en.length ? slot.en.map(pipHTML).join('') : '<small>No energy</small>'}</span>`
    + (slot.stun || slot.inj ? `<span class="db-conds">${slot.stun ? '<i>Stunned</i>' : ''}${slot.inj ? '<i class="is-inj">Injured</i>' : ''}</span>` : '')
    + '</button>';
}
function handAction(G, who, id) {
  const t = D.trainer(id), stats = B.stats(id), me = G.p[who];
  const a = t ? t.kind : stats && stats.stage ? 'evolve' : 'bench';
  const targeted = a === 'evolve' || !!(t && t.target);
  const candidates = targeted ? B.slots(me).filter(s => B.check(G, who, {a, id, on: s.u}).ok) : [];
  const result = targeted ? candidates.length ? {ok: true} : B.check(G, who, {a, id, on: (B.slots(me)[0] || {}).u}) : B.check(G, who, {a, id});
  return {a, candidates, targeted, ...result, label: a === 'bench' ? 'Add to bench' : a === 'evolve' ? 'Upgrade player' : 'Play card'};
}
function selectedHTML(st, x) {
  const me = x.G.p[x.you], i = st.handI;
  if (i == null || me.hand[i] !== st.handId || x.state === 'setup') return '';
  const id = me.hand[i], t = D.trainer(id), stats = B.stats(id), action = handAction(x.G, x.you, id);
  const text = t ? t.text : `${stats.stage ? 'Upgrade the matching Basic player.' : 'Add this player to your bench.'}${stats.ability ? ' ' + B.abilityText(stats.ability, x.G.v) : ''}`;
  const why = st.mode ? 'Choose a highlighted player on the field.' : x.state !== 'yours' ? 'You can play this card on your turn.' : action.ok ? '' : action.why;
  return `<section class="db-selection" aria-label="Selected card"><span class="db-selection-art">${faceHTML(id)}</span><div class="db-selection-copy"><b>${esc(nameOf(id))}</b><p>${esc(text)}</p>`
    + (why ? `<small>${esc(why)}</small>` : '')
    + `<div class="db-selection-actions"><button type="button" class="db-play-card" data-db-play-hand${x.state === 'yours' && action.ok && !st.mode ? '' : ' disabled'}>${esc(action.label)}</button><button type="button" class="db-link" data-db-details="${esc(id)}">Details</button><button type="button" class="db-link" data-db-deselect aria-label="Close selected card">Close</button></div></div></section>`;
}
function attacksHTML(st, x) {
  const G = x.G, me = G.p[x.you];
  if (!me.active || G.phase === 'setup' || x.state === 'over') return '';
  const stats = B.stats(me.active.id);
  return `<section class="db-playbook" aria-label="Your active player's attacks"><div class="db-playbook-title"><b>${esc(short(me.active.id))}’s plays</b><span>Attacking ends your turn</span></div><div class="db-plays">`
    + stats.attacks.map((a, n) => {
      const p = B.attackPreview(G, x.you, n);
      const disabled = x.state !== 'yours' || !p.ok || !!st.mode;
      const reason = x.state !== 'yours' ? 'Available on your turn' : st.mode ? 'Finish your selection first' : !p.ok ? p.why : '';
      return `<button type="button" class="db-play${n ? ' is-signature' : ''}" data-db-attack="${n}"${disabled ? ' disabled' : ''}><span class="db-play-top"><small>${n ? 'SIGNATURE' : 'QUICK PLAY'}</small><span class="db-play-cost" aria-label="Requires ${a.cost.map(e => B.ENERGY[e]).join(', ')}">${a.cost.map(pipHTML).join('')}</span></span>`
        + `<span class="db-play-name"><b>${esc(a.name)}</b><strong>${esc(p.damageText)}<small>DMG</small></strong></span>`
        + `<span class="db-play-effect">${esc([p.text || B.fxText(a) || 'Reliable damage. Keep your energy.', ...(p.notes || [])].join(' '))}</span>`
        + (reason ? `<span class="db-play-why">${esc(reason)}</span>` : '<span class="db-play-why is-ready">Play now</span>') + '</button>';
    }).join('') + '</div></section>';
}

// (no app menu at the foot while you play, as on the Dynasty page: views/dynasty.js fullScreen)
function fullScreen(st, on) {
  document.documentElement.classList.toggle('is-dynasty-battle', !!on && !st.dead && D.mayPlay());
}
function draw(st) {
  if (st.dead) return;
  const host = st.el.querySelector('[data-db]');
  // (Evan's and Ryan Stewart's alone, Oct 28 2026: a profile switched while it's open leaves it)
  if (!D.mayPlay()) { clearCinema(st); fullScreen(st, false); host.innerHTML = ''; if (!st.left) { st.left = true; st.ctx.back(); } return; }
  if (D.status !== 'ready') { host.innerHTML = `<div class="db-msg">${ui.skeleton('rows', 3, {label: 'Loading the battle'})}</div>`; return; }
  const x = src(st).get(st.mid);
  const close = ui.iconButton({icon: 'close', label: 'Back to Rivals', cls: 'db-x', attrs: 'data-back'});
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
    if (mode.k === 'item') return can({a: 'item', id: mode.id, on: u});
    if (mode.k === 'retreat') return can({a: 'retreat', to: u});
    return false;
  };
  // the status line
  let status;
  if (over) status = `<b class="${x.result === 'w' ? 'is-w' : x.result === 'l' ? 'is-l' : ''}">${x.result === 'w' ? 'You win!' : x.result === 'l' ? 'You lose' : 'A draw'}</b> ${esc({points: 'Three touchdowns.', empty: 'No players left.', time: 'The turn limit.', resign: x.result === 'w' ? 'They resigned.' : 'You resigned.', claim: 'Left 72 hours.'}[x.why] || '')}`;
  else if (x.state === 'setup') status = st.setup.act ? `Bench: tap up to ${B.BENCH_MAX} more Basic players, then Ready.` : 'Pick your starting player: tap a Basic player in your hand.';
  else if (x.state === 'theirs') status = G.phase === 'setup' ? `Waiting for ${esc(x.opp.name)} to set up.` : x.solo ? `${esc(x.opp.name)} is thinking…` : `${esc(x.opp.name)}’s turn. You’ll see it here when they move.`;
  else if (me.promote) status = 'Your player was knocked out: pick who comes in from your bench.';
  else if (mode) status = {energy: 'Tap a player to give him the energy.', evolve: 'Tap the player to evolve.', coach: 'Tap a player for it.', item: 'Tap a player for it.', retreat: 'Tap the bench player to send in.'}[mode.k] + ' <button type="button" class="db-link" data-db-cancel>Cancel</button>';
  else status = `<b>Your turn.</b> ${me.en && !me.used.energy ? `Attach ${B.ENERGY[me.en]} energy or ` : ''}choose a play below.`;
  // the hand (yours; theirs, face down)
  const ordered = handOrder(me.hand, st.sort);
  const handHTML = ordered.map(({id, i}, n) => {
    const fan = Math.max(-4, Math.min(4, n - (ordered.length - 1) / 2));
    const sel = x.state === 'setup' ? (st.setup.act === id && st.setup.actI === i || st.setup.benchI.includes(i)) : st.handI === i && st.handId === id;
    const setupLabel = x.state === 'setup' && sel ? st.setup.actI === i ? 'Active' : 'Bench' : '';
    return `<button type="button" class="db-card${sel ? ' is-sel' : ''}" style="--fan-angle:${fan * 2.5}deg;--fan-lift:${Math.abs(fan) * 3}px;--fan-order:${n}" data-db-hand="${i}" aria-pressed="${sel}" aria-label="${esc(nameOf(id))}${setupLabel ? ', selected for ' + setupLabel : ''}">${faceHTML(id)}<span class="db-card-hint">${esc(handType(id))}</span>${setupLabel ? `<span class="db-hand-role">${setupLabel}</span>` : ''}</button>`;
  }).join('');
  const stadium = G.stadium ? `<span class="db-stad">${ui.icon('star', {size: 13})}${esc(D.trainer(G.stadium.id).name)}</span>` : '';
  // (setup: what you've picked so far, before it goes up)
  const preview = x.state === 'setup' ? {active: st.setup.act ? {u: -1, id: st.setup.act, dmg: 0, en: []} : null, bench: st.setup.bench.map((id, i) => ({u: -2 - i, id, dmg: 0, en: []}))} : null;
  const mySlots = preview || me;
  const log = G.ev.map(e => ({e, t: evText(e, you, x.opp.name)})).filter(l => l.t).slice(-2).reverse();
  const handScroll = host.querySelector('.db-hand')?.scrollLeft || 0;
  const focus = document.activeElement && host.contains(document.activeElement) ? [...document.activeElement.attributes].filter(a => a.name.startsWith('data-db-')).map(a => [a.name, a.value])[0] : null;
  host.innerHTML = `<header class="db-top">${close}<div class="db-match-title"><small>GRIDIRON RIVALS</small><b>${esc(x.solo ? 'Solo match' : 'Friend match')}</b></div><span class="db-score" aria-label="Score: you ${me.pts}, opponent ${op.pts}"><b>${me.pts}</b><i>:</i><b>${op.pts}</b><small>First to ${B.WIN_POINTS}</small></span>${ui.iconButton({icon: 'list', label: 'Battle log and options', cls: 'db-more', attrs: 'data-db-more'})}</header>`
    + `<div class="db-table"><div class="db-opponent-hand" aria-hidden="true">${Array.from({length: Math.min(op.hand.length, 7)}, () => '<span>R</span>').join('')}</div><section class="db-team is-opp" aria-label="Opponent's field"><div class="db-team-title"><b>${esc(x.opp.name)}</b><span>${op.hand.length} in hand · ${op.deck.length} in deck</span></div><div class="db-field"><div class="db-row is-active is-opp">${slotHTML(op.active, 'opp', true, false)}</div><div class="db-row is-bench is-opp">${[0, 1, 2].map(i => slotHTML(op.bench[i], 'opp', false, false)).join('')}</div></div></section>`
    + `<div class="db-mid"><p class="db-status" aria-live="polite">${status}</p>${stadium}</div>`
    + `<section class="db-team is-me" aria-label="Your field"><div class="db-team-title"><b>Your lineup</b><span>${me.deck.length} in deck</span></div><div class="db-field"><div class="db-row is-active is-me">${slotHTML(mySlots.active, 'me', true, mySlots.active && pickMine(mySlots.active.u))}</div><div class="db-row is-bench is-me">${[0, 1, 2].map(i => slotHTML(mySlots.bench[i], 'me', false, mySlots.bench[i] && pickMine(mySlots.bench[i].u))).join('')}</div></div></section>`
    + '</div>' + attacksHTML(st, x)
    + `<button type="button" class="db-log" data-db-log aria-label="Open battle log">${log.map((l, i) => `<span class="${i === 0 ? 'is-new' : ''}">${esc(l.t)}</span>`).join('') || '<span>Set your lineup. First to three touchdowns wins.</span>'}</button>`
    + selectedHTML(st, x)
    + `<section class="db-hand-section" aria-label="Your hand"><div class="db-team-title"><b>Your hand <span>${me.hand.length}</span></b><span>${x.state === 'setup' ? 'Choose your lineup' : 'Browse · select · play'}</span></div><div class="db-hand-tools"><label class="db-sort">Sort <select data-db-sort aria-label="Sort your hand">${[['draw', 'Draw order'], ['name', 'Name'], ['type', 'Type'], ['power', 'Power']].map(([v, label]) => `<option value="${v}"${st.sort === v ? ' selected' : ''}>${label}</option>`).join('')}</select></label><button type="button" data-db-browse="-1" aria-label="Previous card"${me.hand.length ? '' : ' disabled'}>‹</button><button type="button" data-db-browse="1" aria-label="Next card"${me.hand.length ? '' : ' disabled'}>›</button></div><div class="db-hand" data-hscroll><div class="db-hand-fan">${handHTML || '<span class="db-none">No cards in hand</span>'}</div></div></section>`
    + `<footer class="db-bar">${barHTML(st, x, G, me, myMove, over)}</footer>`;
  host.querySelector('.db-hand').scrollLeft = handScroll;
  if (focus) host.querySelector(`[${focus[0]}="${CSS.escape(focus[1])}"]`)?.focus({preventScroll: true});
  ui.hydrate(host);
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
  if (!st.hidden && freshEvents.length) {
    freshEvents.filter(e => ['attack', 'bench', 'evolve', 'coach', 'item', 'stadium'].includes(e.k)).forEach(e => {
      st.scenes.push({ev: {...e}, you, opp: x.opp.name});
    });
    if (freshEvents.some(e => e.k === 'ko')) ui.haptic('success');
    nextCinema(st);
  }
  if (over && !st.cheered) {
    st.cheered = true;
    if (x.result === 'w') { try { ui.confetti(host.getBoundingClientRect()); } catch (_) {} }
  }
}
function barHTML(st, x, G, me, myMove, over) {
  if (over && x.solo) {
    // (a Solo battle: its coins, the first win's bonus packs, and another go)
    const p = x.pay || {coins: 0};
    const packs = p.packs ? Object.entries(p.packs).map(([k, n]) => `${n > 1 ? n + ' ' : ''}${D.PACKS[k].name}${n > 1 ? 's' : ''}`).join(', ') : '';
    return `<span class="db-pay">${p.coins ? `+${nf(p.coins)} coins` : 'No coins this time'}${packs ? ` · First win: ${esc(packs)}` : ''}</span>`
      + ui.button({label: 'Rematch', kind: 'secondary', size: 's', attrs: {'data-db-again': ''}}) + ui.button({label: 'Done', kind: 'primary', size: 's', attrs: 'data-back'});
  }
  if (over) {
    const pay = D.BATTLE_PAY[x.result];
    return `<span class="db-pay">+${nf(pay.coins)} coins · ${pay.tr >= 0 ? '+' : ''}${pay.tr} trophies</span>${ui.button({label: 'Back to Rivals', kind: 'primary', size: 's', attrs: 'data-back'})}`;
  }
  if (x.state === 'setup') return ui.button({label: 'Ready', kind: 'primary', attrs: {'data-db-ready': ''}, disabled: !st.setup.act, cls: 'db-go'});
  if (!myMove) return `<span class="db-wait">${ui.icon('clock', {size: 15})} ${x.solo ? 'Its move' : 'Their move'}</span>${ui.button({label: 'Resign', kind: 'plain', size: 's', attrs: {'data-db-resign': ''}})}`;
  // (the Energy Zone: this turn's energy, tap to attach it; the next one shown, as Pocket's)
  const live = me.en && !me.used.energy;
  const next = me.next ? `<small>Next ${pipHTML(me.next)}</small>` : '';
  const en = `<${live ? 'button type="button" data-db-energy' : 'span'} class="db-zone${live ? ' is-live' : ' is-off'}">`
    + `<span class="db-zone-now">${live ? pipHTML(me.en) : '<i class="db-zone-x"></i>'}</span>`
    + `<span class="db-zone-t"><b>${live ? `Attach<span class="sr-only"> ${esc(B.ENERGY[me.en])} energy</span>` : me.used.energy ? 'Attached' : 'No energy'}</b>${next}</span></${live ? 'button' : 'span'}>`;
  const cost = me.active ? B.retreatCost(me.active, me) : 0;
  const sw = me.active && me.bench.length && !me.used.retreat && !me.promote ? ui.button({label: `Switch${cost ? ` (${cost})` : ''}`, kind: 'secondary', size: 's', attrs: {'data-db-switch': ''}}) : '';
  return en + sw + ui.button({label: 'End turn', kind: 'secondary', size: 's', attrs: {'data-db-end': ''}, disabled: me.promote});
}

// ---------------------------------------------------------------------------------------------------- moves
function send(st, m) {
  if (st.dead || st.scene || !D.mayPlay()) return false;
  const r = src(st).move(st.mid, m);
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return false; }
  st.mode = null; st.handI = null; st.handId = null; st.browseI = null;
  if (r.sent && m.a !== 'setup') ui.toast(`Turn sent. ${st.x ? st.x.opp.name : 'They'} will see it.`, {icon: 'check-circle'});
  ui.haptic('selection');
  draw(st);
  return true;
}
function detail(st, id, slot) {
  const st2 = B.stats(id);
  const hp = slot && st2 ? `<p class="pk-own">${Math.max(0, st2.hp - slot.dmg)} of ${st2.hp} HP left${slot.en.length ? ` · energy ${slot.en.map(pipHTML).join('')}` : ''}${slot.stun ? ' · Stunned' : ''}${slot.inj ? ' · Injured' : ''}</p>` : '';
  let stopFoil = () => {};
  const sh = ui.openSheet({title: nameOf(id), body: `<div class="pk-zoom is-s">${anyHTML(id, {size: 'm', tag: false, rulesVersion: st.x.G.v})}</div>${hp}${battleHTML(id, st.x.G)}`, cls: 'pk-sheet', detents: ['large'], onClose: () => stopFoil()});
  stopFoil = bindCardFoil(sh.body);
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
  st.handI = i; st.handId = id; st.mode = null;
  draw(st);
  revealHand(st);
}
function playHand(st) {
  const x = st.x, me = x.G.p[x.you], id = me.hand[st.handI];
  if (!id || id !== st.handId || x.state !== 'yours') return;
  const action = handAction(x.G, x.you, id);
  if (!action.ok) { ui.toast(action.why, {icon: 'info'}); return; }
  if (action.targeted) {
    if (action.candidates.length === 1) { send(st, {a: action.a, id, on: action.candidates[0].u}); return; }
    st.mode = {k: action.a, id}; draw(st); return;
  }
  send(st, {a: action.a, id});
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
      const m = mode.k === 'energy' ? {a: 'energy', on: u} : mode.k === 'retreat' ? {a: 'retreat', to: u} : {a: mode.k, id: mode.id, on: u};
      const r = B.check(G, you, m);
      if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
      send(st, m); return;
    }
    if (sl === me.active) { detail(st, sl.id, sl); return; }
  }
  detail(st, sl.id, sl);
}
function more(st) {
  ui.actionSheet({title: 'Battle', cls: 'pk-sheet', actions: [{label: 'Whole battle log', value: 'log'}, {label: 'Resign', role: 'destructive', value: 'resign'}]}).then(v => {
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
  let turn = -1;
  x.G.ev.forEach(e => {
    if (e.k === 'turn') { turn = e.n; lines.push(`<li class="db-lt">${e.who === x.you ? 'Your turn' : `${esc(x.opp.name)}’s turn`}</li>`); return; }
    const t = evText(e, x.you, x.opp.name);
    if (t) lines.push(`<li>${esc(t)}</li>`);
  });
  void turn;
  ui.openSheet({title: 'Battle log', body: `<ol class="db-recap">${lines.reverse().join('')}</ol>`, cls: 'pk-sheet', detents: ['large']});
}

export default {
  id: 'dynasty-battle',
  chrome: 'none',
  title: 'Battle',

  render() { return '<div class="db" data-db data-no-swipe></div>'; },

  mount(el, ctx) {
    const st = {el, ctx, mid: String((ctx.params && ctx.params.id) || ''), mode: null, handI: null, handId: null, sort: 'draw', scenes: [], scene: null, hidden: false, setup: {act: null, actI: -1, bench: [], benchI: []}, dead: false, stops: [], evAt: null};
    ST.set(ctx, st);
    fullScreen(st, ctx.visible);
    el.addEventListener('click', e => {
      const q = s => e.target.closest(s);
      let b;
      if (q('[data-db-skip]')) { finishCinema(st); return; }
      if (!st.x || st.scene) return;
      if ((b = q('[data-db-browse]'))) { browseHand(st, Number(b.dataset.dbBrowse)); return; }
      if (q('[data-db-cancel]')) { st.mode = null; draw(st); return; }
      if ((b = q('[data-db-attack]'))) { if (!b.disabled) send(st, {a: 'attack', n: Number(b.dataset.dbAttack)}); return; }
      if (q('[data-db-play-hand]')) { playHand(st); return; }
      if (q('[data-db-deselect]')) { st.handI = null; st.handId = null; st.mode = null; draw(st); return; }
      if ((b = q('[data-db-details]'))) { detail(st, b.dataset.dbDetails); return; }
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
        ui.actionSheet({title: 'End your turn without attacking?', cls: 'pk-sheet', actions: [{label: 'End turn', role: 'primary', value: 'y'}]}).then(v => { if (v === 'y') send(st, {a: 'end'}); });
        return;
      }
      if (q('[data-db-ready]')) {
        const S = st.setup;
        if (send(st, {a: 'setup', act: S.act, bench: S.bench.slice()})) { st.setup = {act: null, actI: -1, bench: [], benchI: []}; ui.toast('Lineup set', {icon: 'check-circle'}); }
        return;
      }
      if (q('[data-db-resign]')) { resign(st); return; }
      if (q('[data-db-again]')) {
        const r = SOLO.start(st.x.opp.cpu.id);
        if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
        ctx.nav(`/puzzles/dynasty/battle/${r.mid}`); return;
      }
      if (q('[data-db-more]')) { more(st); return; }
      if (q('[data-db-log]')) logSheet(st);
    });
    el.addEventListener('focusin', e => {
      const card = e.target.closest('[data-db-hand]');
      if (card) st.browseI = Number(card.dataset.dbHand);
    });
    el.addEventListener('change', e => {
      if (!e.target.matches('[data-db-sort]') || st.scene) return;
      st.sort = e.target.value; draw(st);
      revealHand(st);
    });
    el.addEventListener('keydown', e => {
      if (st.scene) { if (e.key === 'Escape') { e.preventDefault(); finishCinema(st); } return; }
      if (!e.target.closest('[data-db-hand]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      browseHand(st, e.key === 'ArrowLeft' ? -1 : 1, e.key === 'Home' ? 'first' : e.key === 'End' ? 'last' : null);
    });
    // (their moves come in with the board)
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') draw(st); }));
    st.stops.push(MT.subscribe(() => draw(st)));
    st.stops.push(SOLO.subscribe(() => draw(st)));
    st.stops.push(data.subscribe(type => { if (type === 'me') { clearCinema(st); st.shown = false; st.evAt = null; draw(st); } }));
    D.load().then(() => draw(st), () => draw(st));
    draw(st);
  },

  onShow(ctx) { const st = ST.get(ctx); if (st) { st.hidden = false; fullScreen(st, true); draw(st); } },

  onHide(ctx) { const st = ST.get(ctx); if (st) { st.hidden = true; clearCinema(st); fullScreen(st, false); } },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    fullScreen(st, false);
    st.dead = true;
    clearCinema(st);
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    MT.flush(); D.flush();
    ST.delete(ctx);
  }
};
