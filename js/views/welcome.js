// Launch welcome: "Who are you?" (a full-screen picker, not a route). Shown once per phone when the app opens
// and no league member has been picked. Tap yourself, then "Continue as {name}"; "Just visiting" skips.
// The pick is gg-me (data.setMe); gg-welcome = '1' records that the question was answered, so it never
// comes back (the You sheet still changes the pick). A member with no leaderboard name yet gets theirs as
// the nickname, so their scores post under it.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';

const esc = s => data.esc(s);
const SEEN = 'gg-welcome';

export function needsWelcome() {
  if (data.me() || !data.ids.length) return false;
  try { return localStorage.getItem(SEEN) !== '1'; } catch (_) { return true; }
}

function cardHTML(id) {
  return `<button type="button" class="wl-card ${data.color(id).cls}" data-wl="${esc(id)}" aria-pressed="false" data-enter>`
    + `<span class="wl-av">${ui.avatar(id, {size: 56})}<span class="wl-check" aria-hidden="true">${ui.icon('check', {size: 14})}</span></span>`
    + `<span class="wl-n">${esc(data.name(id))}</span>`
    + `<span class="wl-t">${esc(data.team(id))}</span>`
    + `</button>`;
}

function pageHTML() {
  const {first, last} = data.span;
  return `<div class="wl-body">`
    + `<header class="wl-head" data-enter>`
    + `<p class="ovl wl-ovl">${esc(data.DATA.league.name)}${first ? ` · ${first}–${last}` : ''}</p>`
    + `<h1 class="wl-title" id="wl-title">Who are you?</h1>`
    + `<p class="wl-sub">Pick yourself. Your daily scores post under your name. Saved on this phone.</p>`
    + `</header>`
    + `<div class="wl-grid" role="group" aria-label="League members">${data.ids.map(cardHTML).join('')}</div>`
    + `</div>`
    + `<footer class="wl-foot">`
    + ui.button({label: 'Pick yourself', kind: 'primary', block: true, attrs: {'data-wl-go': '', 'aria-disabled': 'true'}, cls: 'wl-go'})
    + ui.button({label: 'Just visiting', kind: 'plain', block: true, attrs: {'data-wl-skip': ''}, cls: 'wl-skip'})
    + `</footer>`;
}

let open = null;

/** Show the welcome over the app. Resolves with the picked id, or 'none' for "Just visiting". */
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
    go.querySelector('.btn-label').textContent = `Continue as ${data.name(id)}`;
    el.classList.add('has-pick');
    ui.haptic('selection');
  };

  const finish = value => {
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
    if (value !== 'none') ui.toast(`Welcome, ${data.name(value)}.`, {icon: 'check-circle'});
    resolve(value);
  };

  el.addEventListener('click', e => {
    const card = e.target.closest('[data-wl]');
    if (card) { select(card.dataset.wl); return; }
    if (e.target.closest('[data-wl-go]')) {
      if (!picked) { ui.shake(el.querySelector('.wl-grid')); ui.haptic('error'); return; }
      finish(picked);
      return;
    }
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
