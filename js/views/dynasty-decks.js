import {profileKey} from '../core/realm-active.js';
// Owner's deck shelf. Existing cards and the existing table editor provide every face and edit action.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import {rivalsVersus} from '../core/features.js';
import * as B from '../core/dynasty-battle.js';
import * as T from '../core/dynasty-table.js';
import {tableDeckSheet} from './dynasty-table-options.js';
const esc = data.esc;
const chemistryText = 'From your second turn, attacks deal +5 damage while a different teammate is on your bench. One bonus per attack; never stacks. Solo matches only.';
const teamName = team => D.teamOf(team).name.split(' ').slice(-1)[0];
const recipe = (id, s) => { const d = D.themedDeck(id, s); return {...d, name: d.name || teamName(id) + ' Deck'}; };
function cover(ids, face, team = null, featured = null) {
  const star = D.card(featured) || ids.map(D.card).filter(Boolean).sort((a, b) => b.o - a.o)[0]
    || (team ? D.CARDS.filter(c => c.team === team).sort((a, b) => b.o - a.o)[0] : null);
  return `<span class="rd-box" aria-hidden="true"><span class="rd-box-side"></span><span class="rd-box-front"><small>${esc(team || 'RIVALS')}</small>${star ? face(star, {size: 's', tag: false, noCount: true}) : '<span class="rd-empty-ball">◇</span>'}</span></span>`;
}
function tile(slot, i, face, theme = false) {
  const s = D.mine(), result = theme ? slot : T.check(slot.ids, s), active = !theme && slot.id === D.activeDeckId(s);
  const team = theme ? slot.team : B.teamChemistry(slot.ids), colors = team ? D.teamOf(team) : {pri: slot.color || ['#9378cb', '#dc9753', '#679aac', '#82a77c'][i % 4], sec: '#dceaf1'};
  return `<button type="button" class="rd-tile${active ? ' is-active' : ''}" style="--deck-color:${esc(colors.pri)};--deck-accent:${esc(colors.sec)}" ${theme ? `data-rd-theme="${esc(slot.id || slot.team)}"` : `data-rd-deck="${esc(slot.id)}"`} aria-label="${esc(slot.name)}, ${active ? 'active deck, ' : ''}${result.ok ? 'ready to use' : 'needs cards'}">
    <span class="rd-art"><span class="rd-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${cover(slot.ids, face, team, slot.cover)}${active ? '<span class="rd-active">✓ Active</span>' : ''}</span>
    <span class="rd-caption"><b>${esc(slot.name)}</b><small>${theme ? result.ok ? 'Ready to build' : 'Collect to build' : `${slot.ids.length}/40 cards · ${result.ok ? 'Ready' : 'Draft'}`}</small>${team ? '<span class="rd-chem-tag">Team chemistry · +5</span>' : slot.tag ? `<span class="rd-chem-tag">${esc(slot.tag)}</span>` : ''}</span></button>`;
}
export function deckShelfHTML(face) {
  if (!D.tableOpen()) return '';
  const s = D.mine(), decks = D.savedDecks(s);
  const themes = Object.values(D.TEAMS).map(t => ({...D.themedDeck(t.abbr, s), name: teamName(t.abbr) + ' Deck'}))
    .sort((a, b) => Number(b.ok) - Number(a.ok) || b.ids.filter(D.card).length - a.ids.filter(D.card).length || a.name.localeCompare(b.name));
  const newThemes = D.deckThemes().map(t => recipe(t.id, s));
  const group = (id, title) => `<h3 class="rd-group-title">${title}</h3><div class="rd-grid" aria-label="${title}">${newThemes.filter(t => t.group === id).map((d, i) => tile(d, i, face, true)).join('')}</div>`;
  return `<section class="rd-shelf"><header class="rd-heading"><div><small>YOUR PLAYBOOKS</small><h2>My Decks</h2></div><span>${decks.length}/${T.DECK_LIMIT}</span></header>
    <p class="rd-intro">Choose a deck for your next solo match.</p><div class="rd-grid" aria-label="Custom decks"><button type="button" class="rd-build" data-rd-new ${decks.length >= T.DECK_LIMIT ? 'disabled' : ''}><span aria-hidden="true">+</span><b>Build New</b></button>${decks.map((d, i) => tile(d, i, face)).join('')}</div>
    <section class="rd-themes"><header class="rd-heading"><div><small>BETTER TOGETHER</small><h2>Themed Decks</h2></div><span>${newThemes.length + themes.length} themes</span></header><p class="rd-intro">Build around a position, signature attribute, or NFL team using your collection.</p><p class="rd-requirement">40 cards · 12+ matching player cards · 6+ different players</p>${group('style', 'Play Styles')}${group('position', 'Position Groups')}<h3 class="rd-group-title">NFL Teams</h3><p class="rd-intro">All players from one team unlock team chemistry. ${chemistryText}</p><div class="rd-grid" aria-label="Themed decks">${themes.map((d, i) => tile(d, i, face, true)).join('')}</div></section>
    <div class="rd-tools">${rivalsVersus() ? '<button type="button" class="pk-pill" data-rd-friends>Friend match deck · 20 cards</button>' : ''}<button type="button" class="pk-pill" data-dy-table>Table finishes</button></div></section>`;
}
export function handleDeckShelf(e, onChange, face) {
  if (!D.tableOpen()) return false;
  if (e.target.closest('[data-rd-new]')) { tableDeckSheet(onChange, {name: '', ids: []}); return true; }
  const button = e.target.closest('[data-rd-deck], [data-rd-theme]');
  if (!button) return false;
  const openedFor = profileKey();
  const s = D.mine(), theme = button.dataset.rdTheme;
  const slot = theme ? recipe(theme, s) : D.savedDecks(s).find(d => d.id === button.dataset.rdDeck);
  if (!slot) return true;
  const result = theme ? slot : T.check(slot.ids, s), team = B.teamChemistry(slot.ids) || (theme && slot.team), active = !theme && D.activeDeckId(s) === slot.id;
  const counts = {}; slot.ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  let stopProfile;
  const requirements = slot.group ? `<p class="rd-recipe"><b>${esc(slot.tag)}</b>${esc(slot.positions.join(' / '))} players only${slot.legends ? ' · selected mobile legends' : ''}. Every player must match.<br>${slot.matching} matching player cards · ${slot.distinct} different players. Requires 12 cards from 6 players.</p>` : '';
  const sh = ui.openSheet({onClose: () => stopProfile?.(), title: slot.name, cls: 'pk-sheet', detents: ['large'], body: `<div class="rd-detail"><p class="pk-note">${slot.ids.length}/40 cards · ${result.ok ? 'Ready for your next solo match' : esc(result.why)}</p>${requirements}${team ? `<p class="rd-bonus"><b>${esc(teamName(team))} chemistry</b>${chemistryText}</p>` : ''}<div class="rd-detail-actions">${theme ? `<button type="button" class="pk-btn is-go" data-rd-build-theme ${result.ok && D.savedDecks(s).length < T.DECK_LIMIT ? '' : 'disabled'}>Save themed deck</button>` : `<button type="button" class="pk-btn is-go" data-rd-use ${!result.ok || active ? 'disabled' : ''}>${active ? 'Active deck' : 'Use deck'}</button><button type="button" class="pk-btn" data-rd-edit>Edit deck</button>${!active ? '<button type="button" class="pk-btn" data-rd-delete>Delete deck</button>' : ''}`}</div>${theme ? `<p class="pk-note">Built from your collection and reusable playbook. No cards are spent. Saving adds a copy to My Decks.${D.savedDecks(s).length >= T.DECK_LIMIT ? ' All 30 deck slots are filled; delete an unused deck to make room.' : ''}</p>` : ''}<ul class="rd-card-list">${Object.entries(counts).map(([id, n]) => `<li><span>${esc(D.anyCard(id)?.name || id)}</span><b>×${n}</b></li>`).join('')}</ul></div>`});
  stopProfile = data.subscribe(type => { if (type === 'me') sh.close(); });
  sh.body.addEventListener('click', ev => {
    if (profileKey() !== openedFor) return;
    if (ev.target.closest('[data-rd-edit]')) { sh.close(); tableDeckSheet(onChange, slot); }
    if (ev.target.closest('[data-rd-use]')) { const r = D.useDeckSlot(slot.id); if (r.ok) { sh.close(); ui.toast('Active deck updated'); onChange(); } else ui.toast(r.why); }
    if (ev.target.closest('[data-rd-build-theme]')) { const candidate = D.themedDeck(theme); if (!candidate.ok) { ui.toast(candidate.why); return; } const r = D.saveDeckSlot({name: slot.name, ids: candidate.ids}); if (r.ok) { sh.close(); ui.toast('Themed deck saved · select it in My Decks to use'); onChange(); } else ui.toast(r.why); }
    if (ev.target.closest('[data-rd-delete]')) {
      ui.actionSheet({title: `Delete ${slot.name}? Your cards stay in your collection.`, cls: 'pk-sheet', actions: [{label: 'Delete deck', role: 'destructive', value: 'delete'}]}).then(v => { if (profileKey() === openedFor && v === 'delete' && D.deleteDeckSlot(slot.id)) { sh.close(); onChange(); } });
    }
  });
  return true;
}
