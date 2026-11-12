// Gridiron Rivals v7 decks. Deck choices affect new matches; collection ownership is never changed here.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import * as C from '../core/dynasty-pocket-cards.js';
import {profileKey} from '../core/realm-active.js';
import {rivalsUpdated} from '../core/features.js';
import {actionCredit} from '../core/dynasty-action.js';
import {legendCredit} from '../core/dynasty-legends.js';
import {realName} from '../core/dynasty-real.js';
import {printedCard} from './dynasty-pocket-card.js';
import {ENERGY_COLOR, energySVG} from './dynasty-energy.js';

const esc = data.esc;
const ENERGIES = C.ENERGY_TYPES;
const label = c => c?.canonicalName || c?.name || 'Unknown card';
const kind = c => c.kind === 'player' ? c.stage : ({item: 'Item', supporter: 'Supporter', tool: 'Tool', stadium: 'Stadium'}[c.kind] || c.kind);
const points = c => c.classification === 'mega-ex' ? 3 : c.classification === 'ex' ? 2 : 1;
const copies = ids => ids.reduce((out, id) => { out[id] = (out[id] || 0) + 1; return out; }, {});
const canonicalCount = (ids, c) => ids.filter(id => label(C.card(id)) === label(c)).length;
const check = (d, s) => C.checkDeck(d.ids, d.rental ? null : s.o, d.energy);
const rental = () => ({...C.rentalDeck(), id: 'rental', rental: true});

// Use the same printed faces as collection and battle; copy tags sit outside the card's clipping.
function cardTile(id, n, {controls = '', pool = false, face = printedCard(id)} = {}) {
  const c = C.card(id);
  if (!c) return `<div class="pd-card-tile"><p>${esc(id)} · unavailable</p></div>`;
  return `<div class="pd-card-tile" ${pool ? 'data-pd-pool' : 'data-pd-selected'}="${esc(id)}">
    <button type="button" class="pd-card-preview" data-pd-inspect="${esc(id)}" aria-label="${esc(label(c))}${n ? `, ${n} in deck` : ''}. Read card">${face}<span class="pd-card-caption">${esc(label(c))}</span></button>
    ${n > 1 ? `<b class="pd-copy-tag" aria-hidden="true">×${n}</b>` : ''}${controls}</div>`;
}
const addSlot = (n, edit = false) => n > 0 ? `<button type="button" class="pd-add-slot" ${edit ? 'data-pd-edit' : 'data-pd-add-slot'} aria-label="Add cards, ${n} open slot${n === 1 ? '' : 's'}"><span aria-hidden="true">+</span><b>Add cards</b><small>${n} open slot${n === 1 ? '' : 's'}</small></button>` : '';

function art(c, portrait) {
  const source = c?.sourceId && D.card(c.sourceId), p = source && portrait?.(source, 300);
  return p?.url ? `<img src="${esc(p.url)}" alt="" loading="lazy" decoding="async" draggable="false"${p.alt ? ` data-alt="${esc(p.alt)}" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.removeAttribute('data-alt')}"` : ''}>`
    : `<span aria-hidden="true">${esc(c?.position || (c?.kind === 'player' ? 'NFL' : '◇'))}</span>`;
}

function credit(c, portrait) {
  const source = c?.sourceId && D.card(c.sourceId), image = source && portrait?.(source, 300);
  if (!source || image?.url?.startsWith('img/dynasty/owner/')) return '';
  const head = String(source.head || ''), meta = head.startsWith('a:') ? actionCredit(source.p) : head.startsWith('w:') ? legendCredit(source.p) : null;
  if (!meta || meta.own) return '';
  if (meta.card) return `<p class="pd-note">Photo: ${esc(realName(meta.card))} trading card.</p>`;
  return `<p class="pd-note">Photo: ${esc(meta.author)} · ${meta.licenceUrl ? `<a href="${esc(meta.licenceUrl)}" target="_blank" rel="noopener">${esc(meta.licence)}</a>` : esc(meta.licence)} · <a href="${esc(meta.page)}" target="_blank" rel="noopener">${esc(meta.site || 'Wikimedia Commons')}</a></p>`;
}

const energyBadge = type => `<span class="pd-energy-mark" style="--deck-energy:${ENERGY_COLOR[type] || ENERGY_COLOR.Colorless}" title="${esc(type)} Energy">${energySVG(type)}</span>`;
function deckTile(d, active, s, i) {
  const result = check(d, s), players = d.ids.map(C.card).filter(c => c?.kind === 'player');
  const energy = d.energy?.length ? d.energy : ['Colorless'], primary = energy[0];
  const star = players.find(c => c.types?.includes(primary)) || players[0];
  return `<button type="button" class="pd-deck${active ? ' is-active' : ''}${d.rental ? ' is-rental' : ''}" style="--deck-energy:${ENERGY_COLOR[primary] || ENERGY_COLOR.Colorless}" data-deck-energy="${esc(primary)}" data-pd-deck="${esc(d.id)}" aria-label="${esc(d.name)}, ${active ? 'active, ' : ''}${d.rental ? 'rental, ' : ''}${d.ids.length} cards, ${result.ok ? 'ready' : 'draft'}, ${esc(energy.join(' / '))} Energy">
    <span class="pd-deck-art" aria-hidden="true"><span class="pd-deck-number">${String(i + 1).padStart(2, '0')}</span>
      <span class="pd-deck-box"><span class="pd-box-top"></span><span class="pd-box-side">${energyBadge(primary)}</span><span class="pd-box-front">${star ? printedCard(star.id) : `<span class="pd-empty-card">${energySVG(primary)}</span>`}</span></span>
      ${active ? '<span class="pd-deck-mark">✓ Active</span>' : ''}<span class="pd-edit-mark">Edit deck</span></span>
    <span class="pd-deck-copy"><b>${esc(d.name)}</b><small>${d.rental ? 'Starter rental' : `${d.ids.length}/20 cards · ${result.ok ? 'Ready' : 'Draft'}`}</small><span class="pd-deck-energy" aria-hidden="true">${energy.map(energyBadge).join('')}<small>${esc(energy.join(' / '))}</small></span></span></button>`;
}

export function deckShelfHTML(portrait) {
  if (!rivalsUpdated()) return '';
  const s = D.mine(), selected = D.pocketDeck(s), decks = D.pocketLoadouts(s).filter(d => !d.rental && d.id !== 'rental');
  const active = selected.id || s.pocket?.active || 'rental';
  return `<section class="pocket-decks"><div class="pd-shelf-head"><header class="pd-heading"><h2>My Decks</h2><div class="pd-heading-actions"><button type="button" class="pd-edit-toggle" data-pd-edit-mode aria-pressed="false" ${decks.length ? '' : 'disabled'}>Edit</button><button type="button" class="pd-help" data-pd-help aria-label="Deck-building help">?</button></div></header>
    <div class="pd-shelf-count"><span>${ui.icon('copy', {size: 19})}<b>${decks.length}<span>/30</span></b><small>saved</small></span><small>20-card decks</small></div></div>
    <p class="pd-edit-hint" role="status">Choose one of your decks to edit.</p>
    <div class="pd-shelf">${deckTile(rental(), active === 'rental', s, 0)}${decks.map((d, i) => deckTile(d, d.id === active, s, i + 1)).join('')}
    <button type="button" class="pd-new" data-pd-new ${decks.length >= 30 ? 'disabled' : ''}><span aria-hidden="true">+</span><b>Build a deck</b><small>Use your collection</small></button></div>
    <p class="pd-note">The starter rental is ready to try. It lends its cards only for battles. Your custom decks use collected Base Players, reusable Support Cards, and matching development forms from the rental playbook.</p>
    <details class="pd-info"><summary>Deck-building rules</summary><p>Exactly 20 cards, at least one Base Player, and no more than two of the same canonical card name. Alternate artwork shares the same limit. Breakout and Prime are different card names with exact development requirements.</p><p>Choose one to three Energy types for your Energy Zone. Energy cards never go in the deck. Position, NFL team, rarity and real player statistics do not add battle bonuses.</p><p>Battle values are fictional game-balance examples. Old saved decks are preserved, and matches already in progress keep their original rules. This shelf prepares new matches.</p></details>
    <button type="button" class="pk-pill" data-dy-table>Table finishes</button></section>`;
}

export function inspectCard(id, portrait) {
  const c = C.card(id);
  if (!c) return;
  const from = c.predecessor && C.card(c.predecessor);
  const attacks = (c.attacks || []).map(a => `<li><div><b>${esc(a.name)}</b><strong>${a.damage}</strong></div><small>${esc(a.cost?.length ? a.cost.join(' + ') : 'No Energy required')}</small>${a.text ? `<p>${esc(a.text)}</p>` : ''}</li>`).join('');
  const visual = c.kind !== 'player' && rivalsUpdated() ? `<div class="pk-zoom">${printedCard(id)}</div>` : `<div class="pd-card-art">${art(c, portrait)}</div>`;
  const body = `<article class="pd-inspect">${visual}<h3>${esc(label(c))}</h3>
    <p>${esc(kind(c))}${c.kind === 'player' ? ` · ${esc(c.position || '')} · ${esc(c.team || '')}` : ''}</p>
    ${c.kind === 'player' ? `<div class="pd-card-stats"><b>${c.hp} HP</b><span>${esc((c.types || []).join(' / '))}</span><b>${points(c)} KO point${points(c) === 1 ? '' : 's'}</b></div>
    <p>${from ? `Develops from <b>${esc(label(from))}</b>.` : 'Enters play as a Base Player.'} Classification: ${esc(c.classification === 'mega-ex' ? 'Mega ex' : c.classification)}.</p>
    <ul class="pd-attacks">${attacks}</ul>${c.ability ? `<p><b>Ability · ${esc(c.ability.name || '')}</b><br>${esc(c.ability.text || '')}</p>` : ''}
    <p>Weakness: ${esc(c.weakness || 'None')}${c.weakness ? ' +20' : ''} · Retreat: ${c.retreat} Energy</p>` : `<p>${esc(c.text || '')}</p>`}
    <p class="pd-note">${c.kind === 'player' ? 'Fictional battle values. Rarity and artwork are cosmetic.' : 'Resolve the printed effect when eligible.'}${c.rental ? ' This card is supplied by the rental playbook; it does not add a card to your collection.' : ''}</p>${credit(c, portrait)}</article>`;
  let stop;
  const sh = ui.openSheet({title: 'Read the card', body, cls: 'pk-sheet pocket-deck-sheet', detents: ['large'], onClose: () => stop?.()});
  stop = data.subscribe(type => { if (type === 'me') sh.close(); });
}

function editor(onChange, slot, portrait) {
  if (!rivalsUpdated()) return;
  const openedFor = profileKey(), s = D.mine(), starting = slot || C.defaultDeck(s.o);
  let draft = starting.rental ? [] : starting.ids.slice(), energy = starting.rental ? [] : (starting.energy || ['Fire']).slice();
  let search = '', category = 'all', limit = 60, moving = '', drag = null, ignoreClick = false;
  const pool = C.availableCards(s.o);
  const available = id => C.availableCopies(s.o, id);
  let energyStock = '', energyDecks = new Map();
  const refreshEnergy = () => {
    const stock = JSON.stringify(s.o);
    if (stock !== energyStock) { energyStock = stock; energyDecks = new Map(ENERGIES.map(type => [type, C.energyDeck(s.o, [type])])); }
  };
  refreshEnergy();
  const energyChoices = () => `<fieldset class="pd-energy pd-energy-choices"><legend>Energy Zone · choose 1–3 types</legend>${ENERGIES.map(t => `<label data-pd-energy-choice="${t}" style="--choice-energy:${ENERGY_COLOR[t]}"><input type="checkbox" data-pd-energy="${t}"><span class="pd-energy-icon">${energySVG(t)}</span><span class="pd-energy-copy"><b>${t}</b><small data-pd-energy-status></small></span></label>`).join('')}</fieldset>
    <p class="pd-note">Dark choices need more matching cards for a 20-card deck. Colorless cards can help any type; development and support playbook cards count too. Auto-build uses your selected Energy. With multiple types, battle Energy is random among them.</p>`;
  const faces = new Map();
  const face = id => { if (!faces.has(id)) faces.set(id, printedCard(id)); return faces.get(id); };
  const canAdd = c => c && draft.length < 20 && (copies(draft)[c.id] || 0) < Math.min(2, available(c.id)) && canonicalCount(draft, c) < 2;
  const selected = () => Object.entries(copies(draft)).map(([id, n]) => {
    const c = C.card(id);
    const controls = c ? `<div class="pd-card-controls"><button type="button" data-pd-minus="${esc(id)}" aria-label="Remove ${esc(label(c))}">−</button><b aria-label="${n} copies in deck">${n}</b><button type="button" data-pd-plus="${esc(id)}" aria-label="Add ${esc(label(c))}" ${canAdd(c) ? '' : 'disabled'}>+</button></div>
      <button type="button" class="pd-move" data-pd-move="${esc(id)}" aria-label="Move ${esc(label(c))}" aria-pressed="${moving === id}">↔ Move</button>` : '';
    return cardTile(id, n, {controls, face: face(id)});
  }).join('') + addSlot(20 - draft.length);
  const rows = () => {
    const matched = pool.filter(c => (category === 'all' || category === 'selected' && draft.includes(c.id) || category === c.kind)
      && `${label(c)} ${c.position || ''} ${c.stage || ''} ${(c.types || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => Number(draft.includes(b.id)) - Number(draft.includes(a.id)) || label(a).localeCompare(label(b)));
    const html = matched.slice(0, limit).map(c => {
      const n = draft.filter(id => id === c.id).length;
      const controls = `<small class="pd-pool-count">${n} in deck · ${c.kind !== 'player' ? 'Reusable' : c.rental ? 'Development' : `${available(c.id)} owned`}</small>
        <button type="button" class="pd-add" data-pd-add="${esc(c.id)}" aria-label="Add ${esc(label(c))}" ${canAdd(c) ? '' : 'disabled'}>+ Add card</button>`;
      return cardTile(c.id, n, {controls, pool: true, face: face(c.id)});
    }).join('') || '<p class="pd-note">No matching cards. Try another search or collect more Base Players.</p>';
    return html + (matched.length > limit ? `<p class="pd-note">Showing ${limit} of ${matched.length} cards. Search by name or show more.</p><button type="button" class="pk-btn" data-pd-more>Show more cards</button>` : '');
  };
  let stop, scrollFrame = 0;
  const lifecycle = new AbortController();
  const sh = ui.openSheet({title: slot ? 'Edit deck' : 'Build a deck', cls: 'pk-sheet pocket-deck-sheet', detents: ['large'], onClose: () => { cancelDrag(); lifecycle.abort(); stop?.(); }, body: `<div class="pd-editor">
    <label class="pd-field">Deck name<input type="text" data-pd-name maxlength="32" value="${esc(slot?.name || 'My new deck')}" autocomplete="off"></label>
    ${energyChoices()}
    <div class="pd-editor-tools"><b data-pd-count role="status" aria-live="polite"></b><button type="button" class="pk-btn" data-pd-auto>Auto-build</button><button type="button" class="pk-btn is-go" data-pd-save>Save deck</button></div>
    <h3 class="pd-grid-heading">Cards in your deck</h3><p class="pd-note">Tap a card to read it. Drag its Move handle to rearrange, or tap Move then another card. Use + and − to change copies.</p>
    <p class="pd-reorder-status" data-pd-reorder-status role="status" aria-live="polite"></p>
    <div class="pd-card-grid" data-pd-selected-grid></div>
    <h3 class="pd-grid-heading">Add cards</h3><p class="pd-note">20 cards per deck · at least one Base · up to two of each card name. Choose from your collection and reusable playbook.</p>
    <label class="pd-field">Find a card<input type="search" data-pd-search placeholder="Athlete, stage or battle type"></label>
    <label class="pd-field">Show<select data-pd-filter><option value="all">All available cards</option><option value="selected">Cards in this deck</option><option value="player">Players</option><option value="item">Items</option><option value="supporter">Supporters</option><option value="tool">Tools</option><option value="stadium">Stadiums</option></select></label>
    <div class="pd-card-grid" data-pd-rows></div><p class="pd-note">Battle stats are fictional balance examples, independent of NFL ratings.</p></div>`});
  stop = data.subscribe(type => { if (type === 'me') sh.close(); });
  function draw({poolOnly = false, focusId = '', focusAction = ''} = {}) {
    cancelDrag();
    const result = C.checkDeck(draft, s.o, energy);
    sh.body.querySelector('[data-pd-count]').textContent = `${draft.length}/20 · ${result.ok ? 'Ready to battle' : result.why}`;
    if (!poolOnly) sh.body.querySelector('[data-pd-selected-grid]').innerHTML = selected();
    sh.body.querySelector('[data-pd-rows]').innerHTML = rows();
    refreshEnergy();
    sh.body.querySelectorAll('[data-pd-energy]').forEach(el => {
      const supported = !!energyDecks.get(el.dataset.pdEnergy), selected = energy.includes(el.dataset.pdEnergy);
      el.checked = selected; el.disabled = !selected && (!supported || energy.length >= 3);
      const tile = el.closest('[data-pd-energy-choice]');
      tile.classList.toggle('is-unavailable', !supported); tile.classList.toggle('is-selected', selected);
      tile.classList.toggle('is-at-limit', supported && el.disabled);
      tile.querySelector('[data-pd-energy-status]').textContent = supported ? 'Deck available' : selected ? 'Saved choice · tap to remove' : 'Need more cards';
    });
    sh.body.querySelector('[data-pd-auto]').disabled = !C.energyDeck(s.o, energy);
    sh.body.querySelector('[data-pd-save]').disabled = !energy.length;
    showMoving();
    if (focusId) {
      const action = [...sh.body.querySelectorAll(`[data-pd-${focusAction}]`)].find(el => el.getAttribute(`data-pd-${focusAction}`) === focusId && !el.disabled);
      const tile = [...sh.body.querySelectorAll('[data-pd-selected]')].find(el => el.dataset.pdSelected === focusId);
      const fallback = tile?.querySelector('[data-pd-minus]') || sh.body.querySelector('[data-pd-move], [data-pd-add-slot], [data-pd-search]');
      (action || fallback)?.focus({preventScroll: true});
    }
  }
  function showMoving(message = '') {
    sh.body.querySelectorAll('[data-pd-selected]').forEach(el => el.classList.toggle('is-moving', el.dataset.pdSelected === moving));
    sh.body.querySelectorAll('[data-pd-move]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.pdMove === moving)));
    sh.body.querySelector('[data-pd-reorder-status]').textContent = message || (moving ? `Move ${label(C.card(moving))}: choose another card, or use the arrow keys. Escape cancels.` : '');
  }
  function moveCard(id, target) {
    const counts = copies(draft), order = Object.keys(counts), from = order.indexOf(id), to = order.indexOf(target);
    if (from < 0 || to < 0 || from === to) { moving = ''; showMoving(); return; }
    order.splice(from, 1); order.splice(to, 0, id);
    draft = order.flatMap(key => Array(counts[key]).fill(key));
    moving = ''; draw({focusId: id, focusAction: 'move'});
    showMoving(`${label(C.card(id))} moved to position ${to + 1}. Save deck to keep your changes.`);
  }
  function cancelDrag() {
    const previous = drag; drag = null;
    cancelAnimationFrame(scrollFrame); scrollFrame = 0;
    if (previous?.handle.hasPointerCapture?.(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId);
    sh.body.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
  }
  function updateTarget() {
    if (!drag?.active) return;
    const target = document.elementFromPoint(drag.x, drag.y)?.closest('[data-pd-selected]');
    drag.target = target && sh.body.contains(target) ? target.dataset.pdSelected : '';
    sh.body.querySelectorAll('[data-pd-selected]').forEach(el => el.classList.toggle('is-drop-target', el.dataset.pdSelected === drag.target && drag.target !== drag.id));
  }
  function autoScroll() {
    if (!drag?.active) return;
    const box = sh.body.getBoundingClientRect(), edge = 48;
    const dy = drag.y < box.top + edge ? -8 : drag.y > box.bottom - edge ? 8 : 0;
    if (dy) { sh.body.scrollTop += dy; updateTarget(); }
    scrollFrame = requestAnimationFrame(autoScroll);
  }
  sh.body.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-pd-move]');
    if (!handle || drag || !e.isPrimary || e.button !== 0 || profileKey() !== openedFor || !rivalsUpdated()) return;
    drag = {id: handle.dataset.pdMove, handle, pointerId: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false};
    handle.setPointerCapture(e.pointerId);
  });
  sh.body.addEventListener('pointermove', e => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 8) {
      drag.active = true; moving = drag.id; showMoving(); scrollFrame = requestAnimationFrame(autoScroll);
    }
    if (drag.active) { e.preventDefault(); updateTarget(); }
  });
  sh.body.addEventListener('pointerup', e => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const {id, target, active} = drag; cancelDrag();
    if (active) { ignoreClick = true; setTimeout(() => { ignoreClick = false; }, 0); moving = ''; if (target) moveCard(id, target); else showMoving(); }
  });
  const resetMove = () => { cancelDrag(); moving = ''; showMoving(); };
  sh.body.addEventListener('pointercancel', resetMove);
  sh.body.addEventListener('lostpointercapture', e => { if (drag?.pointerId === e.pointerId) resetMove(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetMove(); }, {signal: lifecycle.signal});
  window.addEventListener('blur', resetMove, {signal: lifecycle.signal});
  sh.body.addEventListener('keydown', e => {
    if (e.key === 'Escape' && moving) { e.preventDefault(); e.stopPropagation(); cancelDrag(); moving = ''; showMoving('Move cancelled.'); return; }
    const handle = e.target.closest('[data-pd-move]');
    if (!handle || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || profileKey() !== openedFor || !rivalsUpdated()) return;
    e.preventDefault();
    const order = Object.keys(copies(draft)), from = order.indexOf(handle.dataset.pdMove), dir = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1;
    if (order[from + dir]) moveCard(handle.dataset.pdMove, order[from + dir]);
  });
  sh.body.addEventListener('input', e => {
    if (profileKey() !== openedFor) return;
    if (e.target.matches('[data-pd-search]')) { search = e.target.value; limit = 60; draw({poolOnly: true}); }
  });
  sh.body.addEventListener('change', e => {
    if (profileKey() !== openedFor) return;
    if (e.target.matches('[data-pd-filter]')) { category = e.target.value; limit = 60; draw({poolOnly: true}); }
    if (e.target.matches('[data-pd-energy]')) {
      const type = e.target.dataset.pdEnergy;
      refreshEnergy();
      if (e.target.checked && (!energyDecks.get(type) || energy.length >= 3 && !energy.includes(type))) { draw({poolOnly: true}); return; }
      energy = e.target.checked ? [...new Set([...energy, type])].slice(0, 3) : energy.filter(t => t !== type); draw({poolOnly: true});
    }
  });
  sh.body.addEventListener('click', e => {
    if (ignoreClick || profileKey() !== openedFor || !rivalsUpdated()) return;
    let b;
    if ((b = e.target.closest('[data-pd-move]'))) {
      if (moving && moving !== b.dataset.pdMove) moveCard(moving, b.dataset.pdMove);
      else { moving = moving === b.dataset.pdMove ? '' : b.dataset.pdMove; showMoving(); }
      return;
    }
    if ((b = e.target.closest('[data-pd-inspect]'))) {
      if (moving && b.closest('[data-pd-selected]')) { const id = moving; moving = ''; moveCard(id, b.dataset.pdInspect); }
      else inspectCard(b.dataset.pdInspect, portrait);
      return;
    }
    if (e.target.closest('[data-pd-add-slot]')) {
      moving = ''; search = ''; category = 'all'; limit = 60;
      const input = sh.body.querySelector('[data-pd-search]'); input.value = '';
      sh.body.querySelector('[data-pd-filter]').value = 'all'; draw({poolOnly: true});
      input.scrollIntoView({block: 'start', behavior: 'instant'}); input.focus({preventScroll: true}); return;
    }
    if (e.target.closest('[data-pd-more]')) { limit += 60; draw({poolOnly: true}); return; }
    if ((b = e.target.closest('[data-pd-minus]'))) { const id = b.dataset.pdMinus, i = draft.indexOf(id); if (i >= 0) draft.splice(i, 1); moving = ''; draw({focusId: id, focusAction: 'minus'}); }
    if ((b = e.target.closest('[data-pd-plus], [data-pd-add]'))) {
      const id = b.dataset.pdPlus || b.dataset.pdAdd, c = C.card(id), action = b.hasAttribute('data-pd-plus') ? 'plus' : 'add';
      if (canAdd(c)) draft.push(id); moving = ''; draw({focusId: id, focusAction: action});
    }
    if (e.target.closest('[data-pd-auto]')) {
      const built = C.energyDeck(s.o, energy);
      if (!built) { ui.toast('Choose available Energy types to auto-build from your collection.'); return; }
      draft = built.ids.slice(); energy = built.energy.slice(); moving = ''; draw();
    }
    if (e.target.closest('[data-pd-save]')) {
      const r = D.savePocketDeck({id: slot?.id, name: sh.body.querySelector('[data-pd-name]').value, ids: draft.slice(), energy: energy.slice(), rental: false});
      if (r.ok) { sh.close(); ui.toast(C.checkDeck(draft, s.o, energy).ok ? 'Deck saved · select it to battle' : 'Draft saved · finish it before battling'); onChange(); } else ui.toast(r.why);
    }
  });
  draw();
}

export function handleDeckShelf(e, onChange = () => {}, portrait) {
  if (!rivalsUpdated()) return false;
  const edit = e.target.closest('[data-pd-edit-mode]');
  if (edit) {
    const editing = edit.closest('.pocket-decks').classList.toggle('is-editing');
    edit.setAttribute('aria-pressed', String(editing)); edit.textContent = editing ? 'Done' : 'Edit';
    return true;
  }
  if (e.target.closest('[data-pd-help]')) {
    const rules = e.target.closest('.pocket-decks').querySelector('.pd-info');
    let stop;
    const sh = ui.openSheet({title: 'Building your deck', cls: 'pk-sheet pocket-deck-sheet', detents: ['medium', 'large'], body: `<div class="pd-detail">${Array.from(rules.querySelectorAll('p'), p => p.outerHTML).join('')}</div>`, onClose: () => stop?.()});
    stop = data.subscribe(type => { if (type === 'me') sh.close(); });
    return true;
  }
  if (e.target.closest('[data-pd-new]')) { editor(onChange, null, portrait); return true; }
  const button = e.target.closest('[data-pd-deck]');
  if (!button) return false;
  const openedFor = profileKey(), s = D.mine();
  const d = button.dataset.pdDeck === 'rental' ? rental() : D.pocketLoadouts(s).find(x => x.id === button.dataset.pdDeck);
  if (!d) return true;
  if (!d.rental && button.closest('.pocket-decks').classList.contains('is-editing')) { editor(onChange, d, portrait); return true; }
  const result = check(d, s), active = (D.pocketDeck(s).id || s.pocket?.active || 'rental') === d.id;
  let stop;
  const sh = ui.openSheet({title: d.name, cls: 'pk-sheet pocket-deck-sheet', detents: ['large'], onClose: () => stop?.(), body: `<div class="pd-detail">
    <p>${d.ids.length}/20 cards · ${result.ok ? 'Ready to battle' : esc(result.why)}</p><p>Energy Zone: <b>${esc((d.energy || []).join(' / '))}</b></p>
    ${d.rental ? '<p class="pd-note">A fixed starter rental. Its cards are available for matches without being added to your collection. Build a custom deck to use the athletes you collect.</p>' : ''}
    <div class="pd-detail-actions"><button type="button" class="pk-btn is-go" data-pd-use ${!result.ok || active ? 'disabled' : ''}>${active ? 'Active deck' : 'Use deck'}</button>${!d.rental ? '<button type="button" class="pk-btn" data-pd-edit>Edit deck</button>' : ''}${!d.rental && !active ? '<button type="button" class="pk-btn" data-pd-delete>Delete deck</button>' : ''}</div>
    <div class="pd-card-grid">${Object.entries(copies(d.ids)).map(([id, n]) => cardTile(id, n)).join('')}${!d.rental ? addSlot(20 - d.ids.length, true) : ''}</div></div>`});
  stop = data.subscribe(type => { if (type === 'me') sh.close(); });
  sh.body.addEventListener('click', ev => {
    if (profileKey() !== openedFor || !rivalsUpdated()) return;
    const inspect = ev.target.closest('[data-pd-inspect]');
    if (inspect) inspectCard(inspect.dataset.pdInspect, portrait);
    if (ev.target.closest('[data-pd-edit]')) { sh.close(); editor(onChange, d, portrait); }
    if (ev.target.closest('[data-pd-use]')) { const r = D.usePocketDeck(d.id); if (r.ok) { sh.close(); ui.toast('Active deck updated'); onChange(); } else ui.toast(r.why); }
    if (ev.target.closest('[data-pd-delete]')) ui.actionSheet({title: `Delete ${d.name}? Your collection stays intact.`, cls: 'pk-sheet', actions: [{label: 'Delete deck', role: 'destructive', value: 'delete'}]}).then(v => {
      if (v === 'delete' && profileKey() === openedFor && D.deletePocketDeck(d.id)) { sh.close(); onChange(); }
    });
  });
  return true;
}

export function guideHTML() {
  return `<div class="pd-guide"><p><b>Collect. Build. Battle.</b> Open packs and grow your collection, build a focused 20-card deck, then manage a card duel. Your next Energy attachment, development card or Supporter can set up a win several turns ahead.</p>
    <ol><li><b>Build a legal deck.</b> Exactly 20 Player and Support Cards, at least one Base Player, and at most two of each canonical name. Choose up to three of the eight Energy types. Energy comes from the Energy Zone, never the deck.</li>
    <li><b>Set up.</b> The first manager is chosen before placement. Each manager gets five cards with at least one Base. Choose one Active Base Player and up to three Bases on the Bench.</li>
    <li><b>Prepare each turn.</b> Draw one card when available. Manually attach the normal Energy to one athlete. The first manager gets no normal Energy on the opening turn, but may use a Supporter or any attack whose cost is met. Normal attachments do not bank across turns.</li>
    <li><b>Choose where to invest.</b> Energy stays attached after ordinary attacks. Once your Active athlete can attack, prepare a Benched replacement. You may rearrange legal preparation actions: drawing before attaching may reveal a better choice.</li>
    <li><b>Develop.</b> Play the matching Breakout or Prime from your hand onto its exact predecessor. Neither manager develops on their first turn, on the turn the athlete enters play, or twice on one athlete that turn. Energy, Tools and existing damage stay. A 60-HP Base with 30 damage that becomes a 100-HP Breakout has 70 HP remaining. Fast Track takes an eligible Base straight to its matching Prime already in hand.</li>
    <li><b>Use Support Cards.</b> Play eligible Items freely, one Supporter per turn, one Tool per athlete, and one Stadium per turn. Only one shared Stadium is in play; a different one replaces it. Film Study draws two cards. Scouting Report finds a random Base. Recovery Kit heals 20. Matchup Change lets the opponent choose their Benched replacement.</li>
    <li><b>Attack or pass.</b> An attack requires its printed attached Energy and normally ends your turn. Colorless accepts any type. Matching printed Weakness adds 20 against the opposing Active. Extra Energy, rarity, position and team grant no automatic damage.</li>
    <li><b>Retreat.</b> Once per turn, discard the Active athlete’s retreat cost and choose a Benched replacement. Damage and remaining attachments stay. A card-effect switch and a knockout promotion do not spend your retreat allowance. Asleep and Paralyzed athletes cannot normally retreat.</li>
    <li><b>Claim points.</b> A regular knockout scores 1, ex scores 2, and Mega ex scores 3. First to at least three wins. Losing your Active with no athlete left in play also loses; cards in your hand or deck cannot replace an empty Bench. An empty draw deck alone is not a loss.</li></ol>
    <details><summary>Special Conditions and Checkup</summary><p>Checkup happens between every turn. Poisoned takes 10 damage with no recovery flip. Burned takes 20, then heads clears it. Asleep cannot attack or retreat and flips at each Checkup; only heads wakes it. Attacks such as Double Move and Hard Count put the opposing Active athlete to sleep. Paralyzed cannot attack or retreat and recovers after its owner’s next turn. Confused flips when attacking: tails fails and ends the turn, without self-damage.</p><p>Poison and Burn can coexist. Sleep, Paralysis and Confusion replace one another. Development and moving to the Bench clear conditions, except Sleep. These are fictional card states, not athlete injuries.</p></details>
    <details><summary>A legal 20-card development deck</summary><p>Two each: Patrick Mahomes – Base; Patrick Mahomes – Breakout; Patrick Mahomes – Prime ex; Justin Jefferson – Base; Film Study; Scouting Report; Recovery Kit; Fast Track; Protective Gear; Matchup Change.</p><p>That is eight Player Cards and twelve Support Cards. Draw and search find your development line; Jefferson buys time while Mahomes develops. Each canonical name appears twice.</p></details>
    <details><summary>Worked battle: prepare your next attacker</summary><p><b>Fictional balance example.</b> All costs are Colorless; assume no Weakness or effects. Your Jefferson (120 HP, 2 Energy, 50 damage) starts Active, Henry (160 HP, 3 Energy, 100 damage) Benched. Opposing Lamb (100 HP, 1 Energy, 30 damage) starts Active, Mahomes ex (160 HP, 2 Energy, 70 damage) Benched. The opponent goes first.</p>
    <ol><li>Opponent gets no opening Energy. You attach one to Jefferson and pass.</li><li>Lamb attaches and deals 30. You attach Jefferson’s second Energy and deal 50.</li><li>Opponent attaches to Mahomes; Lamb deals 30. Jefferson has 60 HP. You attach to Henry; Jefferson knocks out Lamb. You lead 1–0.</li><li>Mahomes attaches its second Energy and knocks out Jefferson. Score: 1–1. Promote Henry and attach its second Energy; it cannot attack yet.</li><li>Mahomes deals 70. Henry has 90 HP. Attach Henry’s third Energy and deal 100; Mahomes has 60 HP.</li><li>Mahomes deals 70; Henry survives at 20 HP. Henry attacks again with its existing Energy, knocks out the ex, and earns two points. You win 3–1.</li></ol><p>You prepared the Bench while your Active kept attacking, then traded a one-point athlete for a two-point target. HP, attack costs and timing made that possible.</p></details>
    <p class="pd-note">All battle values are fictional game-balance examples. Base, Breakout and Prime describe development; regular, ex and Mega ex describe knockout value. Rarity and artwork describe collectibility. Match damage, discards and development never destroy or permanently change owned cards.</p></div>`;
}
