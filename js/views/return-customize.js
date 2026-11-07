import * as wardrobe from '../core/return-customize.js';
import * as data from '../core/data.js';

const esc = data.esc;
const hex = number => '#' + number.toString(16).padStart(6, '0');
let active = null;

/** A front-facing illustration uses the same palette worn by the 3D runner. */
export function skinPreview(skin, cls = '') {
  const k = skin.kit, c = Object.fromEntries(Object.entries(k).filter(([, value]) => typeof value === 'number').map(([key, value]) => [key, hex(value)]));
  return `<svg class="rmc-runner ${cls}" viewBox="0 0 160 176" aria-hidden="true" focusable="false">
    <ellipse cx="80" cy="162" rx="41" ry="8" fill="#17243b" opacity=".18"/>
    <path d="M56 111 53 147 73 147 81 119 88 147 108 147 104 111Z" fill="${c.pants}" stroke="${c.numEdge}" stroke-width="2"/>
    <path d="M53 143 72 143 71 155 51 155ZM89 143 107 143 110 155 90 155Z" fill="${c.socks}"/>
    <path d="M51 153 72 153 72 163 45 163Q43 157 51 153ZM90 153 110 153Q118 156 117 163H90Z" fill="${c.cleats}"/>
    <path d="M51 65Q39 65 34 77L28 102 44 108 54 84ZM109 65Q121 65 126 77L133 102 116 108 106 84Z" fill="${c.pads}" stroke="${c.numEdge}" stroke-width="2"/>
    <path d="M31 95 45 100 40 114 26 109ZM117 101 130 96 135 111 121 116Z" fill="${c.gloves}"/>
    <path d="M51 65 109 65 112 86 104 119H56L48 86Z" fill="${c.jersey}" stroke="${c.numEdge}" stroke-width="2"/>
    <path d="M51 68 67 71 64 83 48 78ZM109 68 93 71 96 83 112 78Z" fill="${c.stripe}"/>
    <path d="M57 115H103V121H57Z" fill="${c.belt}"/>
    <text x="80" y="106" fill="${c.numFill}" font-family="Arial,sans-serif" font-size="26" font-weight="900" text-anchor="middle">22</text>
    <path d="M49 36Q49 7 80 7T111 36L108 62Q100 75 80 75T52 62Z" fill="${c.helmet}" stroke="${c.numEdge}" stroke-width="3"/>
    <path d="M75 9H85V40H75Z" fill="${c.stripe}"/>
    <path d="M58 40Q80 34 102 40L100 58Q80 68 60 58Z" fill="#DDA47B"/>
    <path d="M58 40Q80 34 102 40L101 48H59Z" fill="#1D2B40"/>
    <path d="M53 47 61 65H99L107 47M57 56H103M65 48V66M95 48V66" fill="none" stroke="${c.mask}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M116 97Q134 87 141 104T127 130Q111 124 116 97Z" fill="#98522F" stroke="#593327" stroke-width="2"/>
    <path d="M128 103 130 118M124 108 133 107M125 113 134 112" stroke="#FFF0D2" stroke-width="2"/>
  </svg>`;
}
export function ridePreview(id) {
  return `<svg class="rmc-ride-art" viewBox="0 0 240 150" aria-hidden="true" focusable="false">${id === 'hoverboard'
    ? '<ellipse cx="120" cy="123" rx="79" ry="8" fill="#17243b" opacity=".14"/><path d="M34 104 62 70 201 77 177 110Z" fill="#253659" stroke="#17243b" stroke-width="4"/><path d="M37 104 177 111 201 78" fill="none" stroke="#69F5E0" stroke-width="8" stroke-linecap="round"/><path d="M66 78 97 81 84 99 53 96ZM145 83 179 85 167 103 133 101Z" fill="#A282ED"/><path d="M58 122H86M139 124H172" stroke="#5CDCCE" stroke-width="5" stroke-linecap="round"/>'
    : '<ellipse cx="120" cy="135" rx="83" ry="7" fill="#17243b" opacity=".14"/><circle cx="58" cy="120" r="15" fill="#23314B"/><circle cx="180" cy="120" r="15" fill="#23314B"/><circle cx="58" cy="120" r="6" fill="#F5C468"/><circle cx="180" cy="120" r="6" fill="#F5C468"/><path d="M60 111 153 111 180 98 169 36" fill="none" stroke="#368EAB" stroke-width="11" stroke-linejoin="round"/><path d="M168 36 165 23M147 24H183" stroke="#23314B" stroke-width="8" stroke-linecap="round"/><path d="M68 106H146" stroke="#F5C468" stroke-width="7" stroke-linecap="round"/>'}</svg>`;
}
function skinCard(skin, state) {
  const owned = state.owned.includes(skin.id), equipped = state.skin === skin.id, missing = Math.max(0, skin.price - state.coins);
  return `<article class="rmc-skin${equipped ? ' is-equipped' : ''}" style="--rmc-kit:${hex(skin.kit.jersey)};--rmc-accent:${hex(skin.kit.edge)}">
    <div class="rmc-skin-stage">${skinPreview(skin)}<span class="rmc-state">${equipped ? 'EQUIPPED' : owned ? 'OWNED' : `${skin.price} COINS`}</span></div>
    <div class="rmc-skin-info"><h3>${esc(skin.name)}</h3><p>${esc(skin.tagline)}</p>
    <button type="button" data-rmc-skin="${skin.id}"${equipped || (!owned && missing) ? ' disabled' : ''} aria-label="${esc(equipped ? `${skin.name} equipped` : owned ? `Equip ${skin.name}` : `Buy and equip ${skin.name} for ${skin.price} coins`)}">${equipped ? 'Equipped ✓' : owned ? 'Equip' : missing ? `${missing} more coins` : `Buy · ${skin.price}`}</button></div>
  </article>`;
}
function contents(state, tab, message = '') {
  return `<header class="rmc-header"><div><p>RETURN MAN</p><h2 id="rmc-title">Make it yours.</h2></div><button type="button" class="rmc-close" data-rmc-close aria-label="Close customize">×</button></header>
    <div class="rmc-wallet"><span class="rmc-coin" aria-hidden="true">★</span><div><strong>${state.coins.toLocaleString()} <small>coins</small></strong><p>Earn coins on your daily return.</p></div><span class="rmc-wallet-note">YOUR LOCKER</span></div>
    <div class="rmc-tabs" role="tablist" aria-label="Customize your returner"><button type="button" role="tab" id="rmc-skins-tab" aria-controls="rmc-content" aria-selected="${tab === 'skins'}" tabindex="${tab === 'skins' ? 0 : -1}" data-rmc-tab="skins">Player skins <span>${state.owned.length}/${wardrobe.SKINS.length}</span></button><button type="button" role="tab" id="rmc-rides-tab" aria-controls="rmc-content" aria-selected="${tab === 'rides'}" tabindex="${tab === 'rides' ? 0 : -1}" data-rmc-tab="rides">Rides <span>2</span></button></div>
    <p class="rmc-notice" role="status" aria-live="polite">${esc(message || (!state.readable ? 'Your locker cannot be read right now. Check that browser storage is available.' : tab === 'skins' ? 'Pick your colors. Every skin plays the same.' : 'Double-tap during a run to summon your equipped ride.'))}</p>
    <section id="rmc-content" role="tabpanel" aria-labelledby="rmc-${tab}-tab" class="rmc-content ${tab === 'skins' ? 'rmc-grid' : 'rmc-rides'}">${tab === 'skins' ? wardrobe.SKINS.map(s => skinCard(s, state)).join('') : wardrobe.RIDES.map(ride => `<article class="rmc-ride${state.ride === ride.id ? ' is-equipped' : ''}">${ridePreview(ride.id)}<div><span class="rmc-free">FREE RIDE</span><h3>${ride.name}</h3><p>${ride.tagline}</p><button type="button" data-rmc-ride="${ride.id}"${state.ride === ride.id ? ' disabled' : ''}>${state.ride === ride.id ? 'Equipped ✓' : 'Equip ride'}</button></div></article>`).join('') + '<p class="rmc-ride-help">Ride for 12 seconds and absorb one hit. Your ride recharges for 20 seconds afterward. Keep swiping to jump, slide and change lanes. Jetpacks stow your ride. Keyboard: R.</p>'}</section>
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
  const state = active = {dialog, onChange, onClose, tab: 'skins', profile: wardrobe.profileKey(), before: document.activeElement};
  const refresh = (message = '', selector = '') => {
    if (active !== state) return;
    dialog.innerHTML = contents(wardrobe.snapshot(), state.tab, message);
    if (selector) dialog.querySelector(selector)?.focus({preventScroll: true});
  };
  const transact = (result, label, selector) => {
    if (result.ok) { onChange?.(result.state); refresh(label, selector); }
    else refresh(result.reason === 'storage' ? 'Your locker could not be saved. Nothing was purchased. Check browser storage and try again.' : result.reason === 'coins' ? 'Collect more coins on your daily return to unlock this skin.' : 'That item is not available yet.', selector);
  };
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-rmc-close')) { close(); return; }
    if (wardrobe.profileKey() !== state.profile) { close(); return; }
    if (button.dataset.rmcTab) { state.tab = button.dataset.rmcTab; refresh('', `[data-rmc-tab="${state.tab}"]`); }
    else if (button.dataset.rmcSkin) {
      const id = button.dataset.rmcSkin, owned = wardrobe.snapshot().owned.includes(id);
      transact(owned ? wardrobe.equipSkin(id) : wardrobe.buySkin(id), `${wardrobe.skinOf(id).name} equipped.`, '#rmc-skins-tab');
    } else if (button.dataset.rmcRide) {
      const id = button.dataset.rmcRide;
      transact(wardrobe.equipRide(id), `${wardrobe.rideOf(id).name} equipped.`, '#rmc-rides-tab');
    }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.target.matches('[role="tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); state.tab = event.key === 'Home' ? 'skins' : event.key === 'End' ? 'rides' : state.tab === 'skins' ? 'rides' : 'skins';
      refresh('', `[data-rmc-tab="${state.tab}"]`);
    }
  });
  state.unsubscribe = data.subscribe(() => { if (wardrobe.profileKey() !== state.profile) close(); });
  state.storage = event => { if (event.key === wardrobe.storageKey(state.profile)) refresh(); };
  addEventListener('storage', state.storage);
  refresh(); document.body.append(dialog); dialog.showModal(); dialog.querySelector('[data-rmc-close]').focus({preventScroll: true});
  return dialog;
}
