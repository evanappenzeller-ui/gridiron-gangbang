// Shared portraits and selection UI. Choices are validated by the realm core at commit time.
import * as F from '../core/realm.js';
import {DRAGON_ORDER, DRAGONS} from '../core/realm-dragons.js';

const AT = new URL('../../models/realm/dragons-v1/thumbs/', import.meta.url).href;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const colorName = color => color ? color[0].toUpperCase() + color.slice(1) : '';
const SWATCH = {red: '#a52d30', green: '#477944', blue: '#366c9a', albino: '#eee3ce', purple: '#784c95', grey: '#7c8084', black: '#282a30'};

export function dragonPortrait(species, color = 'red') {
  const D = DRAGONS[species];
  if (!D) return '';
  const chosen = D.colors.includes(color) ? color : D.colors[0];
  return `<img class="rl-dragon-portrait" src="${AT}${species}-${chosen}.webp" alt="" draggable="false" loading="lazy">`;
}

export function dragonPickerHTML(s, choice = {}, buildingId = null) {
  const b = s.b.find(b => b.i === buildingId), current = b && F.dragonOfBuilding(s, b);
  const allowed = new Set(F.hatcheryChoices(s, buildingId).map(d => d.id));
  const D = DRAGONS[choice.species], color = D && D.colors.includes(choice.color) ? choice.color : '';
  const number = b ? s.b.filter(x => x.t === 'hatchery').sort((a, b) => a.i - b.i).findIndex(x => x.i === b.i) + 1 : F.countOf(s, 'hatchery') + 1;
  return `<div class="rl-dragon-picker" data-dragon-picker>`
    + `<p class="rl-sh-lead">${current ? 'Change this dragon’s color whenever you like.' : `Choose the dragon for Hatchery ${number}. Each species can live in one hatchery.`}</p>`
    + `<div class="rl-dragon-grid" role="group" aria-label="Dragon species">${DRAGON_ORDER.map(species => {
      const d = DRAGONS[species], selected = choice.species === species, unavailable = !allowed.has(species) || (!!current && current.species !== species);
      return `<button type="button" class="rl-dragon-option${selected ? ' is-on' : ''}" data-dragon-species="${species}" aria-pressed="${selected}" ${unavailable ? 'disabled' : ''}>`
        + dragonPortrait(species, selected && color ? color : 'red') + `<b>${esc(d.name)}</b><small>${unavailable ? current && current.species !== species ? 'Another hatchery' : 'Already claimed' : d.fly ? 'Flying dragon' : 'Ground dragon'}</small></button>`;
    }).join('')}</div>`
    + (D ? `<div class="rl-dragon-selected">${dragonPortrait(D.id, color || D.colors[0])}<div><h3>${esc(D.name)}</h3><p>${D.fly ? 'Flies over walls and attacks from the air.' : 'Fights on the ground and battles through enemy defenses.'}</p><p>Grows stronger with this hatchery’s upgrades.</p></div></div>`
      + `<fieldset class="rl-dragon-colors"><legend>Choose a color${color ? ` · ${colorName(color)}` : ''}</legend><div>${D.colors.map(c => `<button type="button" data-dragon-color="${c}" aria-pressed="${color === c}" class="rl-dragon-color${color === c ? ' is-on' : ''}"><i style="--dragon-color:${SWATCH[c] || '#777'}" aria-hidden="true"></i><span>${colorName(c)}</span></button>`).join('')}</div></fieldset>`
      : '<p class="rl-dragon-prompt">Select a dragon to see its colors.</p>')
    + `<p class="rl-dragon-error" data-dragon-error role="status"></p>`
    + `<button type="button" class="rl-dragon-confirm" data-dragon-confirm ${D && color ? '' : 'disabled'}>${current ? 'Save color' : b ? 'Choose this dragon' : 'Choose dragon & place hatchery'}</button>`
    + `<p class="rl-sh-note">Four hatcheries unlock at Castle levels 4, 5, 6, and 7. Each holds a different dragon. Species stays with its hatchery; you can change its color later.</p></div>`;
}
