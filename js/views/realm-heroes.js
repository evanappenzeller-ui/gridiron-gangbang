// Shared hero cards and emblems for the village's Army sheet and raid picker.
import * as F from '../core/realm.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = n => Math.round(n || 0).toLocaleString('en-US');

export function heroIcon(k) {
  const art = k === 'knight'
    ? '<path d="M14 22 28 15 42 22v16c0 10-7 17-14 21-7-4-14-11-14-21Z" fill="#7a2634" stroke="#e8c16e" stroke-width="2"/><path d="m28 23 7 7-7 18-7-18Z" fill="#d8dfe8"/><path d="M47 8v35m-8-7h16m-8 7v10" stroke="#f0d69b" stroke-width="4"/><path d="m47 5-4 8h8Z" fill="#d8dfe8"/>'
    : '<path d="m14 38 19-30 13 30Z" fill="#6861b5" stroke="#c6b7ff" stroke-width="2"/><path d="M10 39q22-9 41 0" fill="none" stroke="#c6b7ff" stroke-width="5"/><path d="m21 42-6 16h34l-9-16" fill="#494375"/><path d="M51 22v34" stroke="#bd935c" stroke-width="3"/><circle cx="51" cy="18" r="6" fill="#9ff1ee"/><path d="m32 23 2 4 4 1-4 2-2 4-1-4-4-2 4-1Z" fill="#f8e6a7"/>';
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${art}</svg>`;
}

export function heroCards(s) {
  return F.HERO_ORDER.map(k => {
    const H = F.HEROES[k], level = F.heroLevel(s, k), cap = F.heroCap(s, k);
    const check = level ? F.canUpgradeHero(s, k) : F.canRecruitHero(s, k);
    const stats = F.heroStat(k, level || 1), next = level && level < 10 ? F.heroStat(k, level + 1) : null;
    const locked = F.keepOf(s) < H.at;
    const status = locked ? `Unlocks at Castle level ${H.at}` : level ? `Level ${level} · Defending your Castle` : 'Ready to recruit';
    const action = level >= 10 ? 'Maximum level' : level ? `Upgrade to level ${level + 1}` : 'Recruit hero';
    return `<article class="rl-hero is-${k}${locked ? ' is-locked' : ''}" data-rl-hero-card="${k}">`
      + `<div class="rl-hero-head"><span class="rl-hero-art">${heroIcon(k)}</span><div><small>CASTLE HERO</small><h3>${esc(H.name)}</h3><p>${status}</p></div></div>`
      + `<p class="rl-hero-desc">${k === 'knight' ? 'An armored champion who holds the front line and fights enemies up close.' : 'A ranged spellcaster whose magic strikes groups of enemies, including dragons.'}</p>`
      + `<div class="rl-hero-stats"><span><b>${nf(stats.hp)}</b> Health</span><span><b>${nf(stats.dps)}</b> Damage / sec</span><span><b>${stats.range}</b> Range</span></div>`
      + (next && level < cap ? `<p class="rl-hero-next">Next level: ${nf(next.hp)} health · ${nf(next.dps)} damage / sec</p>` : '')
      + `<button type="button" class="rl-hero-action" data-rl-${level ? 'upgrade' : 'recruit'}-hero="${k}" ${check.ok ? '' : 'disabled'}><span>${action}</span>${check.cost ? `<span class="rl-amt is-gold"><i class="rl-coin" aria-hidden="true"></i>${nf(check.cost)}<span class="sr-only"> Gold</span></span>` : ''}</button>`
      + (!check.ok ? `<p class="rl-hero-note">${esc(check.why)}</p>` : '') + '</article>';
  }).join('');
}

export function residentsNote(s) {
  const unlocked = F.allowed(s, 'hatchery') > 0;
  const built = s.b.some(b => b.t === 'hatchery' && b.l >= 1);
  return 'Guards patrol the village. ' + (unlocked
    ? built ? 'Your dragon keeper tends the Dragon Hatchery.' : 'Your dragon keeper has arrived and waits by the Castle until you build a Dragon Hatchery.'
    : 'A dragon keeper arrives when the Dragon Hatchery unlocks at Castle level 6.');
}
