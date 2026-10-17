// Launch welcome: "Who are you?" (a full-screen picker, not a route). Shown once per phone when the app opens
// (over Puzzles, or whatever screen a link opened) and no league member has been picked. Tap yourself, then
// "Continue as {name}"; "Play as a guest" makes your own player (views/guest.js: a name your daily games post under);
// "Just visiting" skips. App users (data.USERS: people with their own login who aren't in the league) are listed under
// the members; picking one makes this phone their player (data.setGuest with their name). Owner: SHELL.
// The pick is gg-me (data.setMe); gg-welcome = '1' records that the question was answered, so it never
// comes back (the avatar button's You sheet still changes the pick). A member with no leaderboard name yet gets
// theirs as the nickname, so their scores post under it. Focus returns to the screen underneath when it closes.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import {guestFormHTML, wireGuestForm} from './guest.js';

const esc = s => data.esc(s);
const SEEN = 'gg-welcome';

export function needsWelcome() {
  if (data.me() || data.guest() || !data.ids.length) return false;
  try { return localStorage.getItem(SEEN) !== '1'; } catch (_) { return true; }
}

function cardHTML(id) {
  return `<button type="button" class="wl-card ${data.color(id).cls}" data-wl="${esc(id)}" aria-pressed="false" data-enter>`
    + `<span class="wl-av">${ui.avatar(id, {size: 56})}<span class="wl-check" aria-hidden="true">${ui.icon('check', {size: 14})}</span></span>`
    + `<span class="wl-n">${esc(data.name(id))}</span>`
    + `<span class="wl-t">${esc(data.team(id))}</span>`
    + `</button>`;
}

// An app user's card: their initials, their name, "App user". Its pick is 'user:' + id.
function userCardHTML(u) {
  return `<button type="button" class="wl-card wl-user" data-wl="user:${esc(u.id)}" aria-pressed="false" data-enter>`
    + `<span class="wl-av">${ui.nickAvatar(u.name, {size: 56})}<span class="wl-check" aria-hidden="true">${ui.icon('check', {size: 14})}</span></span>`
    + `<span class="wl-n">${esc(u.name)}</span>`
    + `<span class="wl-t">App user</span>`
    + `</button>`;
}
const userOfPick = id => (String(id).startsWith('user:') ? data.USERS.find(u => 'user:' + u.id === id) || null : null);
const pickName = id => { const u = userOfPick(id); return u ? u.name : data.name(id); };

function pageHTML() {
  const {first, last} = data.span;
  const ovl = `<p class="ovl wl-ovl">${esc(data.DATA.league.name)}${first ? ` · ${first}–${last}` : ''}</p>`;
  return `<div class="wl-body">`
    + `<div class="wl-pick">`
    + `<header class="wl-head" data-enter>${ovl}<h1 class="wl-title" id="wl-title">Who are you?</h1></header>`
    + `<div class="wl-grid" role="group" aria-label="League members">${data.ids.map(cardHTML).join('')}</div>`
    + (data.USERS.length ? `<p class="ovl wl-sub" data-enter>App users</p><div class="wl-grid wl-users" role="group" aria-label="App users">${data.USERS.map(userCardHTML).join('')}</div>` : '')
    + `</div>`
    // Play as a guest: the guest form in place of the members (Back returns to them).
    + `<div class="wl-guest" hidden>`
    + `<header class="wl-head">${ovl}<h1 class="wl-title" id="wl-gtitle" tabindex="-1">Play as a guest</h1></header>`
    + guestFormHTML(null)
    + ui.button({label: 'Back', kind: 'plain', block: true, attrs: {'data-wl-back': ''}, cls: 'wl-back'})
    + `</div>`
    + `</div>`
    + `<footer class="wl-foot">`
    + ui.button({label: 'Pick yourself', kind: 'primary', block: true, attrs: {'data-wl-go': '', 'aria-disabled': 'true'}, cls: 'wl-go'})
    + ui.button({label: 'Play as a guest', kind: 'secondary', block: true, icon: 'plus', attrs: {'data-wl-guest': ''}, cls: 'wl-guest-btn'})
    + ui.button({label: 'Just visiting', kind: 'plain', block: true, attrs: {'data-wl-skip': ''}, cls: 'wl-skip'})
    + `</footer>`;
}

let open = null;

/** Show the welcome over the app. Resolves with the picked id, or 'none' for "Just visiting" or a guest. */
export function showWelcome() {
  if (open) return open.done;
  const el = document.createElement('div');
  el.className = 'welcome';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'wl-title');
  el.innerHTML = pageHTML();
  const behind = ['stage', 'tabbar', 'covers'].map(id => document.getElementById(id)).filter(Boolean);
  behind.forEach(n => n.setAttribute('inert', ''));
  document.getElementById('app').appendChild(el);

  let picked = null, resolve;
  const done = new Promise(r => { resolve = r; });
  open = {el, done};
  const go = el.querySelector('[data-wl-go]');

  const select = id => {
    if (picked === id) return;
    picked = id;
    el.querySelectorAll('.wl-card').forEach(b => {
      const on = b.dataset.wl === id;
      b.setAttribute('aria-pressed', String(on));
      if (on) ui.animate(b.querySelector('.av'), [{transform: 'scale(.82)'}, {transform: 'none'}], {spring: 'bouncy'});
    });
    go.removeAttribute('aria-disabled');
    go.querySelector('.btn-label').textContent = `Continue as ${pickName(id)}`;
    el.classList.add('has-pick');
    ui.haptic('selection');
  };

  const finish = (value, userName) => {
    if (!open || open.el !== el) return;
    open = null;
    try { localStorage.setItem(SEEN, '1'); } catch (_) {}
    if (value !== 'none') {
      // A member without a leaderboard name posts under theirs; a name they already chose stays.
      const name = data.name(value);
      try { if (!localStorage.getItem('gg-nick')) localStorage.setItem('gg-nick', name); } catch (_) {}
      if (!daily.LB.nick) daily.LB.nick = name;
    }
    data.setMe(value);
    ui.haptic(value === 'none' ? 'light' : 'success');
    behind.forEach(n => n.removeAttribute('inert'));
    // The app is usable at once: the layer stops taking taps as it fades, and it is removed even if the fade
    // never finishes (a backgrounded page gets no animation frames).
    el.style.pointerEvents = 'none';
    const out = ui.RM
      ? ui.animate(el, [{opacity: 1}, {opacity: 0}], {duration: 150, easing: 'linear', fill: 'forwards'})
      : ui.animate(el, [{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'scale(1.04)'}], {duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'});
    const remove = () => el.remove();
    out.finished.catch(() => {}).then(remove);
    setTimeout(remove, 450);
    // Focus was inside the welcome: hand it to the screen underneath (not <body>), without scrolling it.
    if (el.contains(document.activeElement)) {
      const scr = document.querySelector('#covers .cover > .screen') || document.querySelector('#stage > .tab-layer:not([hidden]) > .screen:not([data-under])');
      if (scr) { try { scr.focus({preventScroll: true}); } catch (_) {} }
    }
    if (value !== 'none' || userName) ui.toast(`Welcome, ${userName || data.name(value)}.`, {icon: 'check-circle'}); // (a guest's welcome is the guest form's)
    resolve(value);
  };

  // The guest form in place of the members, or back.
  const showGuest = on => {
    el.querySelector('.wl-pick').hidden = on;
    el.querySelector('.wl-guest').hidden = !on;
    el.querySelector('.wl-foot').hidden = on;
    el.setAttribute('aria-labelledby', on ? 'wl-gtitle' : 'wl-title');
    ui.haptic('selection');
    const f = el.querySelector(on ? '.c-gs-in' : '[data-wl-guest]');
    try { f.focus({preventScroll: true}); } catch (_) {}
  };
  wireGuestForm(el.querySelector('.wl-guest form'), {onSaved: () => finish('none')});

  el.addEventListener('click', e => {
    const card = e.target.closest('[data-wl]');
    if (card) { select(card.dataset.wl); return; }
    if (e.target.closest('[data-wl-go]')) {
      if (!picked) { ui.shake(el.querySelector('.wl-grid')); ui.haptic('error'); return; }
      const u = userOfPick(picked);
      if (u) { data.setGuest(u.name); finish('none', u.name); return; }
      finish(picked);
      return;
    }
    if (e.target.closest('[data-wl-guest]')) { showGuest(true); return; }
    if (e.target.closest('[data-wl-back]')) { showGuest(false); return; }
    if (e.target.closest('[data-wl-skip]')) finish('none');
  });

  // Enter: fade in, cards rise in order; focus lands on the title for screen readers.
  if (ui.RM) ui.animate(el, [{opacity: 0}, {opacity: 1}], {duration: 150, easing: 'linear'});
  else {
    ui.animate(el, [{opacity: 0}, {opacity: 1}], {duration: 220, easing: 'ease-out'});
    ui.stagger(el, {step: 30, max: 14});
  }
  const title = el.querySelector('#wl-title');
  title.setAttribute('tabindex', '-1');
  try { title.focus({preventScroll: true}); } catch (_) {}
  return done;
}
