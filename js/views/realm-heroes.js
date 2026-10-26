// Shared hero cards and emblems for the village's Army sheet and raid picker.
import * as F from '../core/realm.js';
import {dragonSpeciesOfHero} from '../core/realm-dragons.js';
import {dragonPortrait, colorName} from './realm-dragon-picker.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(n || 0).toLocaleString('en-US');

// (the Dragon Hero's emblem, Oct 22 2026: a red dragon, wings spread, breathing fire, on the Knight's gold trim)
const DRAGON_ART = '<path d="M31 27 9 13l3 10-7 1 9 7-5 6 15-2Z" fill="#8f2f2a" stroke="#e8c16e" stroke-width="2" stroke-linejoin="round"/>'
  + '<path d="m33 27 22-14-3 10 7 1-9 7 5 6-15-2Z" fill="#8f2f2a" stroke="#e8c16e" stroke-width="2" stroke-linejoin="round"/>'
  + '<path d="M32 23c6 4 8 11 6 18-1 6-3 10-6 12-3-2-5-6-6-12-2-7 0-14 6-18Z" fill="#c8553a" stroke="#e8c16e" stroke-width="2"/>'
  + '<path d="m27 22-4-9 7 6m7 3 4-9-7 6" fill="none" stroke="#f0d69b" stroke-width="2.5" stroke-linecap="round"/>'
  + '<path d="M27 24q5-8 10 0l-1 6h-8Z" fill="#d9653f" stroke="#e8c16e" stroke-width="1.5"/>'
  + '<circle cx="29.5" cy="25" r="1.4" fill="#ffd56b"/><circle cx="34.5" cy="25" r="1.4" fill="#ffd56b"/>'
  + '<path d="M32 31q-5 7-2 13 2-3 2-6 0 3 2 6 3-6-2-13Z" fill="#ff9a2e"/><path d="M32 35q-2 4 0 7 2-3 0-7Z" fill="#ffe08a"/>'
  + '<path d="M32 53q4 5 10 4l-3-3" fill="none" stroke="#c8553a" stroke-width="3" stroke-linecap="round"/>';

export function heroIcon(k, choice = {}) {
  const species = dragonSpeciesOfHero(k);
  if (species) return dragonPortrait(species, choice?.color);
  const art = k === 'knight'
    ? '<path d="M14 22 28 15 42 22v16c0 10-7 17-14 21-7-4-14-11-14-21Z" fill="#7a2634" stroke="#e8c16e" stroke-width="2"/><path d="m28 23 7 7-7 18-7-18Z" fill="#d8dfe8"/><path d="M47 8v35m-8-7h16m-8 7v10" stroke="#f0d69b" stroke-width="4"/><path d="m47 5-4 8h8Z" fill="#d8dfe8"/>'
    : k === 'dragon' ? DRAGON_ART
    // (the Wizard Hero's, for a replay from before Oct 22 2026)
    : '<path d="m14 38 19-30 13 30Z" fill="#6861b5" stroke="#c6b7ff" stroke-width="2"/><path d="M10 39q22-9 41 0" fill="none" stroke="#c6b7ff" stroke-width="5"/><path d="m21 42-6 16h34l-9-16" fill="#494375"/><path d="M51 22v34" stroke="#bd935c" stroke-width="3"/><circle cx="51" cy="18" r="6" fill="#9ff1ee"/><path d="m32 23 2 4 4 1-4 2-2 4-1-4-4-2 4-1Z" fill="#f8e6a7"/>';
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${art}</svg>`;
}

const statsHTML = stats => `<div class="rl-hero-stats"><span><b>${nf(stats.hp)}</b> Health</span><span><b>${nf(stats.dps)}</b> Damage / sec</span><span><b>${stats.range}</b> Range</span></div>`;

/** Four hatchery slots remain visible throughout Castle progression. Each
 * assigned dragon uses only its own building's completed upgrade level. */
function dragonCard(s, index) {
  const hatchery = s.b.filter(b => b.t === 'hatchery').sort((a, b) => a.i - b.i)[index];
  const dragon = hatchery && F.dragonOfBuilding(s, hatchery), at = index + 4;
  const locked = !hatchery && F.keepOf(s) < at, level = dragon?.level || 0;
  const stats = dragon && F.heroStat(dragon.hero, level || 1), next = level && level < 10 ? F.heroStat(dragon.hero, level + 1) : null;
  const status = dragon ? `${colorName(dragon.color)} · ${level ? 'Level ' + level : 'Hatchery under construction'}`
    : hatchery ? 'Choose its dragon and color' : locked ? `Unlocks at Castle level ${at}` : 'Ready to build';
  let actions = '', note = '';
  if (hatchery) {
    actions = `<button type="button" class="rl-hero-action" data-rl-dragon="${hatchery.i}"><span>${dragon ? 'Change color' : 'Choose dragon'}</span></button>`;
    if (dragon) actions += `<button type="button" class="rl-hero-action" data-rl-hatch="${hatchery.i}"><span>${hatchery.u > Date.now() || level >= 10 ? 'View hatchery' : 'Upgrade hatchery'}</span></button>`;
    if (hatchery.u > Date.now()) note = level ? `Upgrading to level ${level + 1}` : 'Your dragon joins when construction finishes.';
    else if (dragon && level < 10 && level >= F.heroCap(s, dragon.hero)) note = `Next hatchery level needs Castle level ${F.KINDS.hatchery.th[level]}`;
  } else {
    const check = F.canBuild(s, 'hatchery'), nextSlot = index === F.countOf(s, 'hatchery');
    actions = `<button type="button" class="rl-hero-action" data-rl-hatch="build" ${!locked && nextSlot && check.ok ? '' : 'disabled'}><span>Choose dragon & build</span></button>`;
    note = locked ? `Needs Castle level ${at}` : !nextSlot ? 'Build the earlier hatchery first.' : check.why || '';
  }
  return `<article class="rl-hero is-dragon${locked ? ' is-locked' : ''}" data-rl-hatchery-slot="${index + 1}">`
    + `<div class="rl-hero-head"><span class="rl-hero-art">${dragon ? heroIcon(dragon.hero, dragon) : heroIcon('dragon')}</span><div><small>HATCHERY ${index + 1}</small><h3>${dragon ? esc(dragon.name) : 'Choose your dragon'}</h3><p>${esc(status)}</p></div></div>`
    + `<p class="rl-hero-desc">${dragon ? esc(F.HEROES[dragon.hero].blurb) : 'Raise one of four different dragons. Choose its species and color when you build this hatchery.'}</p>`
    + (stats ? statsHTML(stats) : '')
    + (next ? `<p class="rl-hero-next">Next hatchery level: ${nf(next.hp)} health · ${nf(next.dps)} damage / sec</p>` : '')
    + actions + (note ? `<p class="rl-hero-note">${esc(note)}</p>` : '') + '</article>';
}

export function heroCards(s) {
  return F.HERO_ORDER.filter(k => !F.HEROES[k].hatch).map(k => {
    const H = F.HEROES[k], level = F.heroLevel(s, k), cap = F.heroCap(s, k);
    const check = level ? F.canUpgradeHero(s, k) : F.canRecruitHero(s, k);
    const stats = F.heroStat(k, level || 1), next = level && level < 10 ? F.heroStat(k, level + 1) : null;
    // (the Knight unlocks at Castle level 4 from Oct 22 2026, core/realm.js HEROES; one recruited before that stays)
    const locked = F.keepOf(s) < H.at && !level;
    const status = locked ? `Unlocks at Castle level ${H.at}` : level ? `Level ${level} · Defending your Castle` : 'Ready to recruit';
    const action = level >= 10 ? 'Maximum level' : level ? `Upgrade to level ${level + 1}` : 'Recruit hero';
    return `<article class="rl-hero is-${k}${locked ? ' is-locked' : ''}" data-rl-hero-card="${k}">`
      + `<div class="rl-hero-head"><span class="rl-hero-art">${heroIcon(k)}</span><div><small>CASTLE HERO</small><h3>${esc(H.name)}</h3><p>${status}</p></div></div>`
      + `<p class="rl-hero-desc">An armored champion who holds the front line and fights enemies up close.</p>`
      + statsHTML(stats)
      + (next && level < cap ? `<p class="rl-hero-next">Next level: ${nf(next.hp)} health · ${nf(next.dps)} damage / sec</p>` : '')
      + `<button type="button" class="rl-hero-action" data-rl-${level ? 'upgrade' : 'recruit'}-hero="${k}" ${check.ok ? '' : 'disabled'}><span>${action}</span>${check.cost ? `<span class="rl-amt is-gold"><i class="rl-coin" aria-hidden="true"></i>${nf(check.cost)}<span class="sr-only"> Gold</span></span>` : ''}</button>`
      + (!check.ok ? `<p class="rl-hero-note">${esc(check.why)}</p>` : '')
      + '</article>';
  }).join('') + [0, 1, 2, 3].map(index => dragonCard(s, index)).join('');
}

export function residentsNote(s) {
  const unlocked = F.allowed(s, 'hatchery') > 0, at = F.COUNT.hatchery.findIndex(n => n > 0) + 1;
  const built = s.b.some(b => b.t === 'hatchery' && b.l >= 1);
  return 'Guards patrol the village. ' + (unlocked
    ? built ? 'Your dragon keeper tends your hatcheries.' : 'Your dragon keeper has arrived and waits by the Castle until you build a Dragon Hatchery.'
    : `A dragon keeper arrives when the Dragon Hatchery unlocks at Castle level ${at}.`);
}
