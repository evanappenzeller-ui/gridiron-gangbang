// The live challenge notice (Nov 7 2026, Evan: "A request sent to them should show up as a push notification on their
// screen. If they are actively playing return man it will show up when they are done"): a banner that drops in from the
// top of whatever screen the manager is on, with Accept and Decline. It waits while a Return Man run is under way
// (core/busy.js) and while you're in a live battle. When your own challenge is accepted, this takes you to the battle
// (after the run, too). Started by core/rivals-live.js start() for every profile; it shows only for the Rivals group.
import * as L from '../core/rivals-live.js';
import {busy as gameBusy} from '../core/busy.js';
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = data.esc;
let NAV = null, el = null, shown = null, pendingStart = null, accepting = false;
/** Navigate through the app shell (app.js nav). */
export function go(path) { if (NAV) NAV(path); }
const battlePath = id => `/puzzles/dynasty/battle/${id}`;
const onBattle = id => decodeURIComponent(location.hash || '').endsWith(battlePath(id));

function hide() {
  if (!el) return;
  const node = el; el = null; shown = null;
  node.classList.remove('is-in');
  node.classList.add('is-out');
  setTimeout(() => node.remove(), ui.RM ? 0 : 320);
}
function show(inv) {
  hide();
  shown = inv;
  const key = inv.from, member = key.startsWith('m_') ? key.slice(2) : null;
  const pic = member ? ui.avatar(member, {size: 44}) : ui.nickAvatar(inv.name, {size: 44});
  const node = document.createElement('div');
  node.className = 'rlv-notice';
  node.setAttribute('role', 'alertdialog');
  node.setAttribute('aria-live', 'assertive');
  node.setAttribute('aria-label', `${inv.name} challenged you to a live Rivals battle`);
  node.innerHTML = `<div class="rlv-notice-card"><span class="rlv-notice-pic">${pic}<i class="rlv-dot is-on" aria-hidden="true"></i></span>`
    + `<span class="rlv-notice-copy"><small>GRIDIRON RIVALS · LIVE</small><b>${esc(inv.name)} challenged you</b><span>Battle now, together. Accept to play.</span></span>`
    + `<span class="rlv-notice-actions"><button type="button" class="rlv-btn" data-lv-decline>Decline</button><button type="button" class="rlv-btn is-primary" data-lv-accept>Accept</button></span></div>`;
  node.addEventListener('click', e => {
    if (e.target.closest('[data-lv-accept]')) accept(inv);
    else if (e.target.closest('[data-lv-decline]')) { L.answer(inv.id, false); hide(); sync(); }
  });
  document.body.appendChild(node);
  el = node;
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('is-in')));
  try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (_) {}
}
async function accept(inv) {
  if (accepting) return;
  accepting = true;
  try {
    const D = await import('../core/dynasty.js');
    await D.load();
    if (!D.mayPlay()) { ui.toast('Rivals isn’t open on this profile.', {icon: 'info'}); return; }
    const dk = D.pocketDeck();
    if (!dk.ok) { ui.toast(`Your deck isn’t ready: ${dk.why}`, {icon: 'info'}); return; }
    const r = L.answer(inv.id, true, {ids: dk.ids, energy: dk.energy});
    if (!r.ok) { ui.toast(r.why, {icon: 'info'}); hide(); sync(); return; }
    hide();
    go(battlePath(inv.id));
  } catch (e) { console.error(e); ui.toast('The battle could not open. Try again.', {icon: 'info'}); }
  finally { accepting = false; }
}
function sync() {
  if (!L.enabled() || document.hidden) { if (!L.enabled()) { pendingStart = null; hide(); } return; }
  const busy = gameBusy();
  if (pendingStart && !busy) {
    const id = pendingStart.id; pendingStart = null; hide();
    if (!onBattle(id)) go(battlePath(id));
    return;
  }
  const inv = busy || accepting ? null : L.incoming()[0];
  if (!inv) { if (!accepting) hide(); return; }
  if (shown && shown.id === inv.id) return;
  show(inv);
}
export function start({nav} = {}) {
  NAV = nav || NAV;
  L.subscribe((why, detail) => {
    if (why === 'start') pendingStart = detail;
    if (why === 'declined') ui.toast(`${detail.name} declined your challenge.`, {icon: 'info'});
    if (why === 'profile') pendingStart = null;
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  sync();
}
