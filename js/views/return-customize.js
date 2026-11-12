import * as wardrobe from '../core/return-customize.js';
import * as data from '../core/data.js';

const esc = data.esc;
const hex = number => '#' + number.toString(16).padStart(6, '0');
let active = null;

// Painted SVG shadows avoid filter compositing in a scrolling iPhone dialog.
// Intrinsic dimensions also keep the artwork visible before the stylesheet arrives.
function outfitDetails(pattern, c) {
  const star = (x, y, size = 5) => `<path d="m${x} ${y-size} ${size*.3} ${size*.68} ${size*.7} ${size*.08}-${size*.52} ${size*.48} ${size*.14} ${size*.72}-${size*.62}-${size*.35}-${size*.62} ${size*.35} ${size*.14}-${size*.72}-${size*.52}-${size*.48} ${size*.7}-${size*.08}Z"/>`;
  switch (pattern) {
    case 'outlaw': return `<path d="M57 84 76 91 90 84 104 91 123 84 119 102 105 98 90 104 75 98 61 102Z" fill="${c.stripe}"/><path d="m68 143 7-6 7 6-7 6Zm31 0 7-6 7 6-7 6Z" fill="${c.edge}"/><g fill="${c.edge}">${star(57,98,7)}</g>`;
    case 'neon': return `<path d="M60 91v17l8 8v27M120 91v17l-8 8v27M70 88l20 8 20-8" fill="none" stroke="${c.stripe}" stroke-width="3"/><path d="m59 133 8-7 8 7m30 0 8-7 8 7" fill="none" stroke="${c.edge}" stroke-width="3"/><g fill="${c.edge}"><circle cx="60" cy="108" r="3"/><circle cx="120" cy="108" r="3"/></g>`;
    case 'arctic': return `<path d="m55 88 19 11-10 13 11 15-14 18-6-29Zm70 0-19 11 10 13-11 15 14 18 6-29Z" fill="${c.pads}"/><path d="m59 113 7-10m54 10-7-10M89 86v10m-5-8 10 6m0-6-10 6" fill="none" stroke="${c.stripe}" stroke-width="2"/>`;
    case 'beach': return `<path d="M59 91h62v9H59Z" fill="${c.pads}"/><path d="M59 100h62v8H59Z" fill="${c.edge}"/><path d="M60 139q10-9 20 0t20 0 20 0v8H60Z" fill="${c.stripe}"/><path d="M61 144q10-8 20 0t20 0 18-1" fill="none" stroke="${c.helmet}" stroke-width="2"/>`;
    case 'cosmic': return `<g fill="${c.numFill}">${star(65,107,4)}${star(113,91,4)}${star(113,136,5)}${star(70,142,3)}</g><ellipse cx="90" cy="119" rx="29" ry="11" transform="rotate(-30 90 119)" fill="none" stroke="${c.stripe}" stroke-width="2.5"/><path d="m57 91 16 7-10-15" fill="${c.edge}"/>`;
    case 'ember': return `<path d="M59 149v-17l7 6 3-18 10 17 3-12 8 18 8-22 5 12 9-17 2 23 7-8v18Z" fill="${c.helmet}"/><path d="M65 149v-8l9 6 5-8 9 10 11-11 6 11 9-7 3 7Z" fill="${c.edge}"/>`;
    default: return `<path d="M58 88h16v5H58Zm48 0h16v5h-16ZM58 96h13v2H58Zm51 0h13v2h-13Z" fill="${c.stripe}"/><path d="M60 105v34m60-34v34" stroke="${c.edge}" stroke-width="2"/>`;
  }
}
/** Uniform illustration shares the runner's palette, motif and selected jersey number. */
export function skinPreview(skin, cls = '', number = skin.kit.num ?? '22') {
  const k = skin.kit, c = Object.fromEntries(Object.entries(k).filter(([, value]) => typeof value === 'number').map(([key, value]) => [key, hex(value)]));
  const num = /^\d{1,2}$/.test(String(number)) ? String(number) : '22', pattern = k.pattern || skin.id;
  const word = String(k.wordmark || (skin.category === 'team' ? skin.team : 'RETURN MAN') || 'RETURN MAN').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" class="rmc-runner ${esc(cls)}" width="180" height="216" viewBox="0 0 180 216" aria-hidden="true" focusable="false" data-rmc-art="${esc(pattern)}">
    <ellipse cx="90" cy="207" rx="48" ry="7" fill="#17243b" opacity=".15"/><ellipse cx="90" cy="206" rx="32" ry="4" fill="#17243b" opacity=".12"/>
    <path d="m60 146-4 39 25 2 9-31 9 31 25-2-4-39Z" fill="${c.pants}" stroke="#14243a" stroke-width="1.8"/>
    <path d="m60 152-3 32h6l4-32Zm60 0 3 32h-6l-4-32Z" fill="${c.stripe}"/><path d="m64 152-3 32m55-32 4 32" fill="none" stroke="${c.edge}" stroke-width="1.5"/>
    <path d="m70 157-4 17 14 1 5-18Zm40 0 4 17-14 1-5-18Z" fill="#fff" opacity=".12"/><path d="m69 178 11 1m20 0 11-1M90 155v-5" fill="none" stroke="#14243b" stroke-opacity=".25" stroke-width="2"/>
    <path d="m57 182 24 1-2 15H54Zm42 1 24-1 3 16h-25Z" fill="${c.socks}"/><path d="M56 188h24m20 0h24M56 192h23m23 0h23" stroke="${c.stripe}" stroke-width="2"/>
    <path d="M55 196h25v11H47q-3-7 8-11Zm46 0h25q11 4 8 11h-33Z" fill="${c.cleats}" stroke="#14243b" stroke-width="1.5"/><path d="M48 205h31m23 0h31" stroke="${c.edge}" stroke-width="2"/><path d="m58 199 12 1m-13 2 12 1m42-4 12 1m-11 2 12 1" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>
    <path d="M59 79Q38 79 34 97l-7 29 19 7 13-30Zm62 0q21 0 25 18l7 29-19 7-13-30Z" fill="${c.pads}" stroke="#14243b" stroke-width="1.8"/>
    <path d="m34 101 17 5-2 6-17-5Zm112 0-17 5 2 6 17-5Z" fill="${c.stripe}"/><path d="m33 111 15 5m84 0 15-5" stroke="${c.edge}" stroke-width="2"/>
    <path d="m29 119 18 6-3 9-18-6Zm104 6 18-6 3 9-18 6Z" fill="${c.bands}"/><path d="m26 126 18 6-4 13-13-2-5-6Zm110 6 18-6 4 11-5 6-13 2Z" fill="${c.gloves}" stroke="#14243b" stroke-width="1.5"/><path d="m29 133 9 3m-10 1 8 3m107-4 8-3" stroke="${c.edge}" stroke-width="1.3"/>
    <path d="M59 79q31-8 62 0l6 26-7 47H60l-7-47Z" fill="${c.jersey}" stroke="#14243b" stroke-width="1.8"/>
    <path d="m55 104 9 8-2 35h-2Zm70 0-9 8 2 35h2Z" fill="#000" opacity=".13"/>
    ${outfitDetails(pattern, c)}
    <path d="m73 79 17 12 17-12" fill="none" stroke="${c.stripe}" stroke-width="6" stroke-linejoin="round"/><path d="m78 78 12 8 12-8" fill="${c.numEdge}"/>
    <path d="M61 149h58v6H61Z" fill="${c.belt}"/><path d="M86 149h8v6h-8Z" fill="${c.edge}" stroke="#14243b" stroke-width="1"/><path d="M67 149v6m46-6v6" stroke="#14243b" stroke-opacity=".35" stroke-width="2"/>
    <text x="90" y="103" fill="${c.numFill}" font-family="Arial,sans-serif" font-size="${word.length > 12 ? 5.2 : 6.5}" font-weight="800" letter-spacing=".8" text-anchor="middle">${esc(word)}</text>
    <text class="rmc-jersey-number" x="90" y="137" fill="${c.numFill}" stroke="${c.numEdge}" stroke-width="1.5" paint-order="stroke" font-family="Arial,sans-serif" font-size="34" font-weight="900" text-anchor="middle">${num}</text>
    <path d="M54 42Q54 9 90 9t36 33l-3 23q-11 17-33 17T57 65Z" fill="${c.helmet}" stroke="#14243b" stroke-width="2.4"/>
    <path d="M84 11h12v37H84Z" fill="${c.stripe}"/><path d="M80 13v31m20-31v31" stroke="${c.edge}" stroke-width="2"/>
    <path d="M62 37q2-18 18-21" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".28"/><path d="M57 47h9m48 0h9M62 32v8m56-8v8" stroke="#14243b" stroke-width="2.2" opacity=".45"/>
    <path d="M64 48q26-10 52 0l-3 20q-23 12-46 0Z" fill="#d9a27b"/><path d="M64 47q26-9 52 0l-2 11H66Z" fill="#19283b"/><path d="m68 48 17-3m13 0 13 3" stroke="#80b8d1" stroke-width="1.5" opacity=".55"/>
    <path d="m84 61 6 3 6-3m-16 9q10 5 20 0" fill="none" stroke="#a46b53" stroke-width="1.5"/>
    <path d="m58 54 8 19q24 13 48 0l8-19M62 64h56M74 56v22m32-22v22" fill="none" stroke="#14243b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m58 53 8 19q24 13 48 0l8-19M62 63h56M74 55v22m32-22v22" fill="none" stroke="${c.mask}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m56 47 6 9m62-9-6 9" stroke="${c.stripe}" stroke-width="3"/><circle cx="59" cy="50" r="2" fill="#d5dde0"/><circle cx="121" cy="50" r="2" fill="#d5dde0"/>
    <path d="M135 120q17-14 25 6t-9 31q-20-3-16-37Z" fill="#98522f" stroke="#503021" stroke-width="2"/><path d="M139 122q-5 15 10 30" fill="none" stroke="#bc784a" stroke-width="3"/><path d="m146 125 5 19m-10-13 12-3m-10 8 12-3m-10 8 12-3" fill="none" stroke="#ffe8bf" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;
}
export function ridePreview(id) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="rmc-ride-art" width="240" height="150" viewBox="0 0 240 150" aria-hidden="true" focusable="false">${id === 'hoverboard'
    ? '<ellipse cx="120" cy="123" rx="79" ry="8" fill="#17243b" opacity=".14"/><path d="M34 104 62 70 201 77 177 110Z" fill="#253659" stroke="#17243b" stroke-width="4"/><path d="M37 104 177 111 201 78" fill="none" stroke="#69F5E0" stroke-width="8" stroke-linecap="round"/><path d="M66 78 97 81 84 99 53 96ZM145 83 179 85 167 103 133 101Z" fill="#A282ED"/><path d="M58 122H86M139 124H172" stroke="#5CDCCE" stroke-width="5" stroke-linecap="round"/>'
    : '<ellipse cx="120" cy="135" rx="83" ry="7" fill="#17243b" opacity=".14"/><circle cx="58" cy="120" r="15" fill="#23314B"/><circle cx="180" cy="120" r="15" fill="#23314B"/><circle cx="58" cy="120" r="6" fill="#F5C468"/><circle cx="180" cy="120" r="6" fill="#F5C468"/><path d="M60 111 153 111 180 98 169 36" fill="none" stroke="#368EAB" stroke-width="11" stroke-linejoin="round"/><path d="M168 36 165 23M147 24H183" stroke="#23314B" stroke-width="8" stroke-linecap="round"/><path d="M68 106H146" stroke="#F5C468" stroke-width="7" stroke-linecap="round"/>'}</svg>`;
}
function skinCard(skin, state, number) {
  const owned = state.owned.includes(skin.id), equipped = state.skin === skin.id, missing = Math.max(0, skin.price - state.coins);
  return `<article class="rmc-skin${equipped ? ' is-equipped' : ''}" style="--rmc-kit:${hex(skin.kit.jersey)};--rmc-accent:${hex(skin.kit.edge)}">
    <div class="rmc-skin-stage">${skinPreview(skin, '', number)}<span class="rmc-state">${equipped ? 'EQUIPPED' : owned ? 'OWNED' : `${skin.price} COINS`}</span>${skin.category === 'team' ? `<span class="rmc-team-code">${esc(skin.team || skin.kit.team)}</span>` : ''}</div>
    <div class="rmc-skin-info"><h3>${esc(skin.name)}</h3><p>${esc(skin.tagline)}</p>
    <button type="button" data-rmc-skin="${skin.id}"${equipped || (!owned && missing) ? ' disabled' : ''} aria-label="${esc(equipped ? `${skin.name} equipped` : owned ? `Equip ${skin.name}` : `Buy and equip ${skin.name} for ${skin.price} coins`)}">${equipped ? 'Equipped ✓' : owned ? 'Equip' : missing ? `${missing} more coins` : `Buy · ${skin.price}`}</button></div>
  </article>`;
}
const TABS = ['skins', 'jerseys', 'rides'];
function contents(state, tab, message = '', draft = state.number || '22') {
  const skins = wardrobe.SKINS.filter(s => s.category !== 'team'), teams = wardrobe.SKINS.filter(s => s.category === 'team');
  const count = list => `${list.filter(s => state.owned.includes(s.id)).length}/${list.length}`;
  const previewNumber = /^\d{1,2}$/.test(draft) ? draft : state.number || '22';
  return `<header class="rmc-header"><div><p>RETURN MAN</p><h2 id="rmc-title">Make it yours.</h2></div><button type="button" class="rmc-close" data-rmc-close aria-label="Close customize">×</button></header>
    <div class="rmc-wallet"><span class="rmc-coin" aria-hidden="true">★</span><div><strong>${state.coins.toLocaleString()} <small>coins</small></strong><p>Earn coins on your daily return.</p></div><span class="rmc-wallet-note">YOUR LOCKER</span></div>
    <div class="rmc-tabs" role="tablist" aria-label="Customize your returner">${TABS.map(key => `<button type="button" role="tab" id="rmc-${key}-tab" aria-controls="rmc-content" aria-selected="${tab === key}" tabindex="${tab === key ? 0 : -1}" data-rmc-tab="${key}">${{skins:'Skins',jerseys:'Jerseys',rides:'Rides'}[key]} <span>${key === 'skins' ? count(skins) : key === 'jerseys' ? count(teams) : wardrobe.RIDES.length}</span></button>`).join('')}</div>
    ${tab !== 'rides' ? `<form class="rmc-number-form" data-rmc-number-form><div><label for="rmc-number">Your number</label><p id="rmc-number-help">0–99 or 00 · on every outfit</p></div><input id="rmc-number" name="number" type="text" inputmode="numeric" pattern="[0-9]{1,2}" maxlength="2" autocomplete="off" required value="${esc(draft)}" aria-describedby="rmc-number-help"><button type="submit" data-rmc-number-save>Save</button></form>` : ''}
    <p class="rmc-notice" role="status" aria-live="polite">${esc(message || (!state.readable ? 'Your locker cannot be read right now. Check that browser storage is available.' : tab === 'skins' ? 'Signature looks. Every outfit plays the same.' : tab === 'jerseys' ? 'Rep your team. Buy once, wear it whenever you want.' : 'Double-tap during a run to summon your equipped ride.'))}</p>
    <section id="rmc-content" role="tabpanel" aria-labelledby="rmc-${tab}-tab" class="rmc-content ${tab !== 'rides' ? 'rmc-grid' : 'rmc-rides'}">${tab !== 'rides' ? (tab === 'skins' ? skins : teams).map(s => skinCard(s, state, previewNumber)).join('') : wardrobe.RIDES.map(ride => `<article class="rmc-ride${state.ride === ride.id ? ' is-equipped' : ''}">${ridePreview(ride.id)}<div><span class="rmc-free">FREE RIDE</span><h3>${ride.name}</h3><p>${ride.tagline}</p><button type="button" data-rmc-ride="${ride.id}"${state.ride === ride.id ? ' disabled' : ''}>${state.ride === ride.id ? 'Equipped ✓' : 'Equip ride'}</button></div></article>`).join('') + '<p class="rmc-ride-help">Ride for 12 seconds and absorb one hit. Your ride recharges for 20 seconds afterward. Keep swiping to jump, slide and change lanes. Jetpacks stow your ride. Keyboard: R.</p>'}</section>
    <footer class="rmc-footer">Coins and outfits are saved for this profile on this device. Daily-run pickups earn coins; practice does not. Keepfall Gold stays separate.</footer>`;
}
function ensureCss() {
  if (document.querySelector('link[data-rmc-css]')) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.dataset.rmcCss = '';
  link.href = new URL('../../css/views/return-customize.css', import.meta.url).href; document.head.append(link);
}
export function isOpen() { return !!active; }
export function close() {
  if (!active) return;
  const old = active; active = null;
  old.unsubscribe?.(); removeEventListener('storage', old.storage);
  old.dialog.remove();
  if (old.before?.isConnected) old.before.focus({preventScroll: true});
  old.onClose?.();
}
export function open({onChange, onClose} = {}) {
  close(); ensureCss();
  const dialog = document.createElement('dialog'); dialog.className = 'rmc-dialog'; dialog.setAttribute('aria-labelledby', 'rmc-title');
  const state = active = {dialog, onChange, onClose, tab: 'skins', numberDraft: wardrobe.snapshot().number || '22', profile: wardrobe.profileKey(), before: document.activeElement};
  const refresh = (message = '', selector = '') => {
    if (active !== state) return;
    const top = dialog.scrollTop;
    dialog.innerHTML = contents(wardrobe.snapshot(), state.tab, message, state.numberDraft);
    dialog.scrollTop = top;
    if (selector) dialog.querySelector(selector)?.focus({preventScroll: true});
  };
  const transact = (result, label, selector) => {
    if (result.ok) { onChange?.(result.state); refresh(label, selector); }
    else refresh(result.reason === 'storage' ? 'Your changes could not be saved. Your coins and equipment are unchanged. Check browser storage and try again.' : result.reason === 'coins' ? 'Collect more coins on your daily return to unlock this outfit.' : result.reason === 'number' ? 'Choose a number from 0 to 99, or 00.' : 'That item is not available yet.', selector);
  };
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-rmc-close')) { close(); return; }
    if (wardrobe.profileKey() !== state.profile) { close(); return; }
    if (button.dataset.rmcTab && TABS.includes(button.dataset.rmcTab)) { state.tab = button.dataset.rmcTab; dialog.scrollTop = 0; refresh('', `[data-rmc-tab="${state.tab}"]`); }
    else if (button.dataset.rmcSkin) {
      const id = button.dataset.rmcSkin, owned = wardrobe.snapshot().owned.includes(id);
      transact(owned ? wardrobe.equipSkin(id) : wardrobe.buySkin(id), `${wardrobe.skinOf(id).name} equipped.`, `#rmc-${state.tab}-tab`);
    } else if (button.dataset.rmcRide) {
      const id = button.dataset.rmcRide;
      transact(wardrobe.equipRide(id), `${wardrobe.rideOf(id).name} equipped.`, '#rmc-rides-tab');
    }
  });
  dialog.addEventListener('input', event => {
    if (!event.target.matches('#rmc-number')) return;
    if (wardrobe.profileKey() !== state.profile) { close(); return; }
    state.numberDraft = event.target.value;
    if (/^\d{1,2}$/.test(state.numberDraft)) dialog.querySelectorAll('.rmc-jersey-number').forEach(text => { text.textContent = state.numberDraft; });
  });
  dialog.addEventListener('submit', event => {
    if (!event.target.matches('[data-rmc-number-form]')) return;
    event.preventDefault();
    if (wardrobe.profileKey() !== state.profile) { close(); return; }
    const result = wardrobe.setNumber(state.numberDraft);
    if (result.ok) state.numberDraft = result.state.number;
    transact(result, `Number ${result.state?.number || state.numberDraft} saved for every outfit.`, '#rmc-number');
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.target.matches('[role="tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); state.tab = event.key === 'Home' ? 'skins' : event.key === 'End' ? 'rides' : TABS[(TABS.indexOf(state.tab) + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length];
      dialog.scrollTop = 0;
      refresh('', `[data-rmc-tab="${state.tab}"]`);
    }
  });
  state.unsubscribe = data.subscribe(() => { if (wardrobe.profileKey() !== state.profile) close(); });
  state.storage = event => { if (event.key === wardrobe.storageKey(state.profile)) { state.numberDraft = wardrobe.snapshot().number || '22'; refresh(); } };
  addEventListener('storage', state.storage);
  refresh(); document.body.append(dialog); dialog.showModal(); dialog.querySelector('[data-rmc-close]').focus({preventScroll: true});
  return dialog;
}
