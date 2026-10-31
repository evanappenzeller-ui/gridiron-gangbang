// Gridiron Rivals match (/puzzles/dynasty/battle/<match id>). Rules and saved turns live in the core modules.
// A card table (the owner, Oct 30 2026: "The gameplay is far too confusing. I want it to include the cards that are in
// play laid out and the available cards in your hand are spread out at the bottom. Clicking on each card will show the
// attacks and allow the player to choose which one or put the card back down"): both lineups as cards on the felt, your
// hand fanned along the foot. Tapping any card lifts it (focusHTML): its plays or what it can do now, and Put back.
// Energy goes on by itself in rules v4; earlier matches keep a Give energy action on the lifted card.
// Collectible card details, the complete log and match options remain available without interrupting ordinary moves.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-battle.js';
import * as MT from '../core/dynasty-match.js';
import * as SOLO from '../core/dynasty-solo.js';
import {anyHTML, battleHTML, pipHTML, headUrl, isPhoto, isAction} from './dynasty.js';
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
    case 'bench': return `${who} put ${nameOf(ev.id)} on the bench.`;
    case 'evolve': return `${who} evolved ${short(ev.from)} into ${D.card(ev.id) && D.card(ev.id).t ? D.card(ev.id).t : D.SERIES[(D.card(ev.id) || {}).s] ? D.SERIES[D.card(ev.id).s].name : ''} ${short(ev.id)}.`;
    case 'energy': return ev.auto ? `${mine ? 'Your' : `${opp}’s`} ${short(ev.id)} got a ${B.ENERGY[ev.e]} energy.` : `${who} gave ${short(ev.id)} a ${B.ENERGY[ev.e]} energy.`;
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

// ---------------------------------------------------------------------------------------------------- the stadium scenes
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
// One card face for the felt, the hand and the lifted card: type pip, name and HP across the top, the portrait, then
// (in play) the HP meter and the attached energy, or (in hand) what kind of card it is.
function faceHTML(id, slot = null) {
  const c = D.card(id), t = D.trainer(id), stats = c && B.stats(id);
  const team = c && D.teamOf(c.team), type = stats && B.TYPES[stats.type];
  const rarity = (c || t || {}).r || 'common';
  const hp = stats ? Math.max(0, stats.hp - (slot ? slot.dmg : 0)) : 0;
  const pip = stats ? pipHTML(type.e) : `<span class="db-face-ic">${ui.icon(t.kind === 'stadium' ? 'star' : t.kind === 'coach' ? 'football' : 'bolt', {size: 12})}</span>`;
  const art = c ? `<span class="db-face-art" data-team-scene="${esc(c.team)}" style="--team:${esc(team.pri)};--team-secondary:${esc(team.sec)}${teamSceneStyle(c.team)}"><span class="db-face-number">${esc(c.num || c.pos)}</span>${c.head && !/^https?:/.test(c.head) ? `<img${isPhoto(c.head) ? ' class="is-photo"' : isAction(c.head) ? ' class="is-action"' : ''} src="${esc(headUrl(c.head, 300))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>`
    : `<span class="db-face-art is-tactic"${t.team ? ` data-team-scene="${esc(t.team)}" style="--team:${esc(D.teamOf(t.team).pri)};--team-secondary:${esc(D.teamOf(t.team).sec)}${teamSceneStyle(t.team)}"` : ''}>${ui.icon(t.kind === 'stadium' ? 'star' : t.kind === 'coach' ? 'football' : 'bolt', {size: 30})}</span>`;
  const foot = !c ? `<span class="db-face-role">${esc({coach: 'Coach · one a turn', item: 'Item', stadium: 'Stadium'}[t.kind])}</span>`
    : slot ? `<span class="db-face-meter"><i style="width:${Math.round(hp / stats.hp * 100)}%"></i></span><span class="db-face-en">${slot.en.length ? slot.en.map(pipHTML).join('') : '<small>No energy</small>'}</span>`
    : `<span class="db-face-role">${esc(c.pos)} · ${esc(team.abbr || c.team)}${stats.stage ? ' · Upgrade' : ''}</span>`;
  return `<span class="db-face r-${esc(rarity)}${c ? '' : ' is-tactic'}" style="--type:${type ? type.color : '#C59A48'}">`
    + `<span class="db-face-top">${pip}<b class="db-face-name">${esc(c ? short(id) : nameOf(id))}</b>${stats ? `<span class="db-face-hp">${hp}<small>HP</small></span>` : ''}</span>`
    + art + `<span class="db-face-foot">${foot}</span>`
    + (slot && (slot.stun || slot.inj) ? `<span class="db-conds">${slot.stun ? '<i>Stunned</i>' : ''}${slot.inj ? '<i class="is-inj">Injured</i>' : ''}</span>` : '')
    + '</span>';
}
/** A card on the felt (side: 'me' | 'opp'), a button that lifts it; pick: a target for the move being chosen. */
function slotHTML(slot, side, act, {pick = false, ready = false, lifted = false} = {}) {
  if (!slot) return `<div class="db-slot is-empty${act ? ' is-act' : ''}"><span>${act ? 'Active' : 'Bench'}</span></div>`;
  const stats = B.stats(slot.id), hp = stats.hp, left = Math.max(0, hp - slot.dmg);
  const label = `${nameOf(slot.id)}, ${left} of ${hp} HP, ${slot.en.length} energy${slot.stun ? ', Stunned' : ''}${slot.inj ? ', Injured' : ''}${pick ? ', choose this player' : ready ? ', ready to attack' : ''}`;
  return `<button type="button" class="db-slot${act ? ' is-act' : ''}${pick ? ' is-pick' : ''}${ready ? ' is-ready' : ''}${lifted ? ' is-lifted' : ''}${left <= hp * 0.3 ? ' is-low' : ''}" data-db-slot="${slot.u}" data-side="${side}" aria-label="${esc(label)}">`
    + faceHTML(slot.id, slot) + (ready ? '<span class="db-tag">Tap to attack</span>' : pick ? '<span class="db-tag">Choose</span>' : '') + '</button>';
}
/** What a hand card does when played now: {a, candidates, targeted, ok, why, label}. */
function handAction(G, who, id) {
  const t = D.trainer(id), stats = B.stats(id), me = G.p[who];
  const a = t ? t.kind : stats && stats.stage ? 'evolve' : 'bench';
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

// ---------------------------------------------------------------------------------------------------- the lifted card
// A tapped card rises off the table: big, with what it can do now. Your active player: his plays, each with its cost,
// damage and what it still needs (and Switch out); a bench player: Send in; a hand card: its play; theirs: their plays
// to read. Put back sets it down again.
function attackButtons(st, x, slot, mine) {
  const G = x.G, stats = B.stats(slot.id), me = G.p[x.you];
  const active = mine && slot === me.active;
  return stats.attacks.map((a, n) => {
    const p = active ? B.attackPreview(G, x.you, n) : null;
    const missing = B.unpaid(a.cost, slot.en);
    const dmg = p ? p.damageText : `${a.dmg}${['coin', 'qb', 'vs', 'finish'].includes(a.fx) ? '+' : ''}`;
    const can = active && x.state === 'yours' && !st.mode && p.ok;
    const why = !mine ? '' : !active ? 'Only your active player attacks.' : x.state !== 'yours' ? 'On your turn.'
      : missing ? `Needs ${missing} more energy.` : p.ok ? '' : p.why;
    const text = [B.fxText(a), B.signatureText(G, n), ...(p ? p.notes || [] : [])].filter(Boolean).join(' ');
    return `<button type="button" class="db-move${n ? ' is-signature' : ''}" data-db-attack="${n}"${can ? '' : ' disabled'}>`
      + `<span class="db-move-cost" aria-label="Costs ${a.cost.map(e => B.ENERGY[e]).join(', ')}">${a.cost.map(pipHTML).join('')}</span>`
      + `<span class="db-move-name"><b>${esc(a.name)}</b>${text ? `<small>${esc(text)}</small>` : ''}${why ? `<small class="db-move-why">${esc(why)}</small>` : ''}</span>`
      + `<strong>${esc(dmg)}<small>DMG</small></strong></button>`;
  }).join('');
}
function focusHTML(st, x, mySlots) {
  const F = st.focus;
  if (!F) return '';
  const G = x.G, you = x.you, me = G.p[you], op = G.p[1 - you], yours = x.state === 'yours', setup = x.state === 'setup';
  let id, slot = null, sub = '', moves = '', why = '';
  const btn = (label, attrs, kind = 'go') => `<button type="button" class="db-act is-${kind}" ${attrs}>${esc(label)}</button>`;
  if (F.kind === 'hand') {
    id = me.hand[F.i];
    const t = D.trainer(id), stats = B.stats(id);
    sub = t ? t.text : `${B.TYPES[stats.type].name} · ${stats.stage ? `Upgrades ${short(id)}’s Basic card` : 'Basic player'} · ${stats.hp} HP`;
    if (setup) {
      if (!B.isBasic(id)) why = 'Only Basic players start the game.';
      else moves = btn(st.setup.act ? 'Make him the starter' : 'Start with him', 'data-db-lineup="act"')
        + (st.setup.act && st.setup.bench.length < B.BENCH_MAX ? btn('Put on bench', 'data-db-lineup="bench"', 'soft') : '');
    } else {
      const action = handAction(G, you, id);
      moves += btn(action.label, `data-db-play-hand${yours && action.ok && !me.promote ? '' : ' disabled'}`);
      why = !yours ? 'You can play this on your turn.' : me.promote ? 'Send in a new active player first.' : action.ok ? '' : action.why;
      if (stats) moves = `<div class="db-moves is-info">${attackPreviewList(stats)}</div>` + moves;
    }
  } else if (F.kind === 'slot') {
    const side = F.side === 'opp' ? op : null;
    slot = side ? B.slots(op).find(s => s.u === F.u) : [mySlots.active, ...mySlots.bench].filter(Boolean).find(s => s.u === F.u);
    if (!slot) return '';
    id = slot.id;
    const stats = B.stats(id), left = Math.max(0, stats.hp - slot.dmg);
    const ab = stats.ability ? ` · ${B.ABILITY[stats.ability].name}: ${B.abilityText(stats.ability, G.v)}` : '';
    sub = `${B.TYPES[stats.type].name} · ${left} of ${stats.hp} HP${stats.weak ? ` · Weak to ${B.TYPES[stats.weak].name}` : ''}${ab}`;
    if (setup) {
      const act = F.u === -1;
      moves = (act ? '' : btn('Make him the starter', 'data-db-lineup="promote"')) + btn('Back to hand', 'data-db-lineup="hand"', 'soft');
    } else if (side) {
      moves = `<div class="db-moves">${attackButtons(st, x, slot, false)}</div>`;
      why = 'Their plays, for reading.';
    } else {
      const isAct = slot === me.active;
      moves = `<div class="db-moves">${attackButtons(st, x, slot, true)}</div>`;
      if (yours && me.promote && !isAct) moves = btn('Send him in', `data-db-promote="${slot.u}"`) + moves;
      else if (yours && !isAct) {
        const r = B.check(G, you, {a: 'retreat', to: slot.u}), cost = me.active ? B.retreatCost(me.active, me) : 0;
        moves = btn(`Send him in${cost ? ` (costs ${cost} energy)` : ''}`, `data-db-retreat="${slot.u}"${r.ok ? '' : ' disabled'}`, 'soft') + moves;
        if (!r.ok) why = r.why === 'One switch a turn.' ? 'You’ve switched once this turn.' : r.why;
      }
      if (yours && isAct && me.bench.length && !me.promote) {
        const r = B.check(G, you, {a: 'retreat', to: me.bench[0].u}), cost = B.retreatCost(me.active, me);
        moves += btn(`Switch him out${cost ? ` (costs ${cost} energy)` : ''}`, `data-db-switch${r.ok ? '' : ' disabled'}`, 'soft');
      }
      // (matches begun before v4: the turn's energy is given by hand)
      if (yours && me.en && !me.used.energy && !me.promote && B.check(G, you, {a: 'energy', on: slot.u}).ok) moves = btn(`Give him the ${B.ENERGY[me.en]} energy`, `data-db-energy="${slot.u}"`) + moves;
    }
  }
  if (!id) return '';
  return `<div class="db-focus" role="dialog" aria-modal="true" aria-labelledby="db-focus-name"><div class="db-focus-in">`
    + `<div class="db-focus-card">${faceHTML(id, slot)}</div>`
    + `<div class="db-focus-copy"><b id="db-focus-name">${esc(nameOf(id))}</b><p>${esc(sub)}</p></div>`
    + moves + (why ? `<p class="db-focus-why">${esc(why)}</p>` : '')
    + `<div class="db-focus-foot"><button type="button" class="db-act is-back" data-db-putback>Put back</button><button type="button" class="db-link" data-db-details="${esc(id)}">Card details</button></div>`
    + '</div></div>';
}
// (a hand player's plays, to read before he's out)
function attackPreviewList(stats) {
  return stats.attacks.map(a => `<span class="db-move is-read"><span class="db-move-cost">${a.cost.map(pipHTML).join('')}</span><span class="db-move-name"><b>${esc(a.name)}</b>${B.fxText(a) ? `<small>${esc(B.fxText(a))}</small>` : ''}</span><strong>${a.dmg}<small>DMG</small></strong></span>`).join('');
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
  if (x.state === 'setup' && !st.setup.init) suggestLineup(st, me.hand);
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
  const canAttack = x.state === 'yours' && !me.promote && me.active && B.stats(me.active.id).attacks.some((a, n) => B.check(G, you, {a: 'attack', n}).ok);
  // the status line
  let status;
  if (over) status = `<b class="${x.result === 'w' ? 'is-w' : x.result === 'l' ? 'is-l' : ''}">${x.result === 'w' ? 'You win!' : x.result === 'l' ? 'You lose' : 'A draw'}</b> ${esc({points: 'Three touchdowns.', empty: 'No players left.', time: 'The turn limit.', resign: x.result === 'w' ? 'They resigned.' : 'You resigned.', claim: 'Left 72 hours.'}[x.why] || '')}`;
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
    return `<button type="button" class="db-card${lifted ? ' is-lifted' : ''}${playable ? ' is-playable' : ''}" style="--rot:${(off * spread).toFixed(1)}deg;--lift:${Math.round(off * off * spread * 0.55)}px;--z:${n + 1}" data-db-hand="${i}" aria-label="${esc(nameOf(id))}${playable ? ', playable' : ''}">${faceHTML(id)}</button>`;
  }).join('');
  const stadium = G.stadium ? `<span class="db-stad">${ui.icon('star', {size: 13})}${esc(D.trainer(G.stadium.id).name)}</span>` : '';
  const log = G.ev.map(e => ({e, t: evText(e, you, x.opp.name)})).filter(l => l.t).slice(-1);
  const lifted = (side, u) => st.focus && st.focus.kind !== 'hand' && (st.focus.side || 'me') === side && st.focus.u === u;
  const mine = (slot, act) => slotHTML(slot, 'me', act, {pick: !!slot && pickMine(slot.u) || (!!slot && me.promote && x.state === 'yours' && !act),
    ready: !!slot && act && canAttack && !mode, lifted: !!slot && lifted('me', slot.u)});
  const theirs = (slot, act) => slotHTML(slot, 'opp', act, {lifted: !!slot && lifted('opp', slot.u)});
  const cpu = x.solo && x.opp.cpu;
  const kicker = cpu && cpu.n ? `GAME ${cpu.n} · ${cpu.tier.name.toUpperCase()}` : x.solo ? 'SOLO MATCH' : 'FRIEND MATCH';
  host.innerHTML = `<header class="db-top">${close}<div class="db-match-title"><small>${esc(kicker)}</small><b>${esc(x.opp.name)}</b></div><span class="db-score" aria-label="Score: you ${me.pts}, opponent ${op.pts}"><b>${me.pts}</b><i>:</i><b>${op.pts}</b><small>First to ${B.WIN_POINTS}</small></span>${ui.iconButton({icon: 'list', label: 'Battle log and options', cls: 'db-more', attrs: 'data-db-more'})}</header>`
    + `<div class="db-table"><div class="db-opponent-hand" aria-label="${op.hand.length} cards in their hand · ${op.deck.length} in their deck">${Array.from({length: Math.min(op.hand.length, 8)}, () => '<span aria-hidden="true">R</span>').join('')}<small>${op.hand.length} in hand · ${op.deck.length} in deck</small></div>`
    + `<section class="db-side is-opp" aria-label="${esc(x.opp.name)}’s players"><div class="db-row is-bench">${[0, 1, 2].map(i => theirs(op.bench[i], false)).join('')}</div><div class="db-row is-active">${theirs(op.active, true)}</div></section>`
    + `<div class="db-mid"><p class="db-status" aria-live="polite">${status}</p>${stadium}<button type="button" class="db-log" data-db-log aria-label="Open battle log">${log.map(l => `<span>${esc(l.t)}</span>`).join('') || '<span>First to three touchdowns wins.</span>'}</button></div>`
    + `<section class="db-side is-me" aria-label="Your players"><div class="db-row is-active">${mine(mySlots.active, true)}</div><div class="db-row is-bench">${[0, 1, 2].map(i => mine(mySlots.bench[i], false)).join('')}</div></section></div>`
    + `<section class="db-hand-section" aria-label="Your hand: ${me.hand.length} cards, ${me.deck.length} in your deck"><div class="db-hand"><div class="db-hand-fan" style="--n:${Math.max(1, hand.length)}">${handHTML || `<span class="db-none">${x.state === 'setup' ? 'Every card is in your lineup' : 'No cards in hand'}</span>`}</div></div></section>`
    + `<footer class="db-bar">${barHTML(st, x, G, me, myMove, over, canAttack)}</footer>`
    + focusHTML(st, x, mySlots);
  host.classList.toggle('is-lifting', !!st.focus);
  if (st.focus) {
    const f = host.querySelector('.db-focus');
    (f.querySelector('.db-move:not(:disabled):not(.is-read), .db-act:not(:disabled)') || f.querySelector('[data-db-putback]')).focus({preventScroll: true});
  }
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
function barHTML(st, x, G, me, myMove, over, canAttack) {
  if (over && x.solo) {
    // (a Solo battle: its coins, the first win's bonus packs, and the next game or another go)
    const p = x.pay || {coins: 0}, cpu = x.opp.cpu;
    const packs = p.packs ? Object.entries(p.packs).map(([k, n]) => `${n > 1 ? n + ' ' : ''}${D.PACKS[k].name}${n > 1 ? 's' : ''}`).join(', ') : '';
    const next = cpu.n && x.result === 'w' && cpu.n < SOLO.LADDER && SOLO.unlocked('g' + (cpu.n + 1));
    return `<span class="db-pay">${p.coins ? `+${nf(p.coins)} coins` : 'No coins this time'}${packs ? ` · First win: ${esc(packs)}` : ''}</span>`
      + ui.button({label: x.result === 'w' ? 'Play again' : 'Try again', kind: next ? 'secondary' : 'primary', size: 's', attrs: {'data-db-again': ''}})
      + (next ? ui.button({label: `Game ${cpu.n + 1}`, kind: 'primary', size: 's', attrs: {'data-db-next': ''}}) : ui.button({label: 'Done', kind: 'secondary', size: 's', attrs: 'data-back'}));
  }
  if (over) {
    const pay = D.BATTLE_PAY[x.result];
    return `<span class="db-pay">+${nf(pay.coins)} coins · ${pay.tr >= 0 ? '+' : ''}${pay.tr} trophies</span>${ui.button({label: 'Back to Rivals', kind: 'primary', size: 's', attrs: 'data-back'})}`;
  }
  if (x.state === 'setup') return ui.button({label: 'Start', kind: 'primary', attrs: {'data-db-ready': ''}, disabled: !st.setup.act, cls: 'db-go'});
  if (!myMove) return `<span class="db-wait">${ui.icon('clock', {size: 15})} ${x.solo ? `${esc(x.opp.name)} is playing` : 'Their move'}</span>`;
  const hint = me.promote ? 'Send in a bench player' : 'Tap any card to see what it can do';
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
  const hp = slot && st2 ? `<p class="pk-own">${Math.max(0, st2.hp - slot.dmg)} of ${st2.hp} HP left${slot.en.length ? ` · energy ${slot.en.map(pipHTML).join('')}` : ''}${slot.stun ? ' · Stunned' : ''}${slot.inj ? ' · Injured' : ''}</p>` : '';
  let stopFoil = () => {};
  const sh = ui.openSheet({title: nameOf(id), body: `<div class="pk-zoom is-s">${anyHTML(id, {size: 'm', tag: false, rulesVersion: st.x.G.v})}</div>${hp}${battleHTML(id, st.x.G)}`, cls: 'pk-sheet', detents: ['large'], onClose: () => stopFoil()});
  stopFoil = bindCardFoil(sh.body);
}
function lift(st, f) {
  st.focus = f; st.mode = null;
  ui.haptic('selection');
  draw(st);
}
function putBack(st) {
  const f = st.focus;
  st.focus = null; draw(st);
  const host = st.el.querySelector('[data-db]');
  const back = f && (f.kind === 'hand' ? host.querySelector(`[data-db-hand="${f.i}"]`) : host.querySelector(`[data-db-slot="${f.u}"][data-side="${f.side || 'me'}"]`));
  back?.focus({preventScroll: true});
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
  st.focus = null; ui.haptic('selection'); draw(st);
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
  const canAttack = me.active && B.stats(me.active.id).attacks.some((a, n) => B.check(x.G, x.you, {a: 'attack', n}).ok);
  if (!canAttack) { send(st, {a: 'end'}); return; }
  ui.actionSheet({title: 'End your turn without attacking?', cls: 'pk-sheet', actions: [{label: 'End turn', role: 'primary', value: 'y'}]}).then(v => { if (v === 'y') send(st, {a: 'end'}); });
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

export default {
  id: 'dynasty-battle',
  chrome: 'none',
  title: 'Battle',

  render() { return '<div class="db" data-db data-no-swipe></div>'; },

  mount(el, ctx) {
    const st = {el, ctx, mid: String((ctx.params && ctx.params.id) || ''), mode: null, focus: null, scenes: [], scene: null, hidden: false, setup: {act: null, actI: -1, bench: [], benchI: []}, dead: false, stops: [], evAt: null};
    ST.set(ctx, st);
    fullScreen(st, ctx.visible);
    el.addEventListener('click', e => {
      const q = s => e.target.closest(s);
      let b;
      if (q('[data-db-skip]')) { finishCinema(st); return; }
      if (!st.x || st.scene) return;
      if (q('[data-db-putback]')) { putBack(st); return; }
      if ((b = q('[data-db-details]'))) { const f = st.focus, sl = f && f.kind === 'slot' ? [...B.slots(st.x.G.p[0]), ...B.slots(st.x.G.p[1])].find(s => s.u === f.u) : null; detail(st, b.dataset.dbDetails, sl); return; }
      if ((b = q('[data-db-attack]'))) { if (!b.disabled) send(st, {a: 'attack', n: Number(b.dataset.dbAttack)}); return; }
      if (q('[data-db-play-hand]')) { playHand(st); return; }
      if ((b = q('[data-db-lineup]'))) { lineup(st, b.dataset.dbLineup); return; }
      if ((b = q('[data-db-promote]'))) { send(st, {a: 'promote', u: Number(b.dataset.dbPromote)}); return; }
      if ((b = q('[data-db-retreat]'))) { if (!b.disabled) send(st, {a: 'retreat', to: Number(b.dataset.dbRetreat)}); return; }
      if ((b = q('[data-db-energy]'))) { send(st, {a: 'energy', on: Number(b.dataset.dbEnergy)}); return; }
      if (q('[data-db-switch]')) {
        const me = st.x.G.p[st.x.you];
        if (me.bench.length === 1) { send(st, {a: 'retreat', to: me.bench[0].u}); return; }
        st.focus = null; st.mode = {k: 'retreat'}; draw(st); return;
      }
      if (q('.db-focus') && !q('.db-focus-in')) { putBack(st); return; }
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
      if (st.focus && e.key === 'Escape' && !ui.sheetCount()) { e.preventDefault(); putBack(st); }
    });
    // (their moves come in with the board)
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') draw(st); }));
    st.stops.push(MT.subscribe(() => draw(st)));
    st.stops.push(SOLO.subscribe(() => draw(st)));
    st.stops.push(data.subscribe(type => { if (type === 'me') { clearCinema(st); st.shown = false; st.evAt = null; st.focus = null; st.setup = {act: null, actI: -1, bench: [], benchI: []}; draw(st); } }));
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
