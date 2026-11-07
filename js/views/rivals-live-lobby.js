// Live battle lobby (Nov 7 2026): the Rivals group with a green dot for each manager who is in the app right now, and a
// Challenge button that sends them a live challenge (core/rivals-live.js). Opened from the Rivals home and the Battle tab,
// and as Rematch at the end of a live battle. The challenge notice and the start of the battle are views/rivals-live-notice.js.
import * as L from '../core/rivals-live.js';
import * as D from '../core/dynasty.js';
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = data.esc;
let open = null;
const status = p => !p.online ? {cls: 'is-off', text: 'Not in the app'}
  : p.busy === 'rm' ? {cls: 'is-busy', text: 'Playing Return Man'}
  : p.busy === 'match' ? {cls: 'is-busy', text: 'In a live battle'}
  : {cls: 'is-on', text: 'In the app now'};
/** How many of the rest of the Rivals group are in the app (for the entry buttons). */
export const onlineCount = () => L.players().filter(p => p.online).length;

function rowHTML(p, out, deckOk) {
  const st = status(p), mine = out && out.to === p.key && !out.expired;
  const pic = p.member ? ui.avatar(p.member, {size: 44}) : ui.nickAvatar(p.name, {size: 44});
  let action, note = '';
  if (mine) {
    action = `<button type="button" class="rlv-btn" data-lv-cancel>Cancel</button>`;
    note = p.busy === 'rm' ? 'Sent · They’ll see it when their Return Man run ends.' : p.online ? 'Sent · Waiting for them to accept…' : 'Sent · They left the app. It waits ten minutes.';
  } else {
    const off = !p.online || p.busy === 'match' || !!(out && !out.expired) || !deckOk || !!L.current();
    action = `<button type="button" class="rlv-btn is-primary" data-lv-challenge="${esc(p.key)}"${off ? ' disabled' : ''}>Challenge</button>`;
  }
  return `<li class="rlv-row${mine ? ' is-waiting' : ''}"><span class="rlv-pic">${pic}<i class="rlv-dot ${st.cls}" aria-hidden="true"></i></span>`
    + `<span class="rlv-copy"><b>${esc(p.name)}</b><small class="${st.cls}">${esc(st.text)}</small>${note ? `<small class="rlv-note" role="status">${esc(note)}</small>` : ''}</span>${action}</li>`;
}
function bodyHTML() {
  const list = L.players(), out = L.outgoing(), dk = D.status === 'ready' && D.mayPlay() ? D.pocketDeck() : {ok: false, why: 'Your cards are loading.'};
  const cur = L.current();
  return `<div class="rlv-lobby">`
    + `<p class="rlv-lead">Challenge a manager who’s in the app right now. You play the battle together, live. If either of you leaves the app, it pauses until you’re both back.</p>`
    + (cur ? `<button type="button" class="rlv-resume" data-lv-resume="${esc(cur.id)}"><b>Return to your live battle</b><small>vs. ${esc(L.nameFor(cur.o))}</small></button>` : '')
    + `<ul class="rlv-list" aria-label="Rivals managers">${list.map(p => rowHTML(p, out, dk.ok)).join('')}</ul>`
    + `<p class="rlv-deck">${dk.ok ? `You battle with <b>${esc(dk.name || 'your active deck')}</b>. Change it in Decks.` : `Your deck isn’t ready: ${esc(dk.why)}`}</p>`
    + `<p class="rlv-fine">Live battles use the Rivals rules and your active deck. They pay no coins or packs and never change your Solo ladder.</p></div>`;
}
/** Opens the lobby sheet (rematch: a profile key to challenge at once). */
export async function openLobby({rematch = null} = {}) {
  if (!L.enabled()) { ui.toast('Live battles are for the Rivals group.', {icon: 'info'}); return; }
  if (open) { open.close(); open = null; }
  try { await D.load(); } catch (_) {}
  const sh = ui.openSheet({title: 'Live battle', cls: 'pk-sheet rlv-sheet', detents: ['large'], body: bodyHTML(), onClose: () => { stop(); if (open === sh) open = null; }});
  open = sh;
  const draw = () => { if (open === sh) sh.body.innerHTML = bodyHTML(); };
  const stop = L.subscribe(why => {
    if (why === 'start' || why === 'accepted') { sh.close(); return; }
    if (why === 'declined' || why === 'board' || why === 'tick' || why === 'sent' || why === 'cancel' || why === 'profile') draw();
  });
  const challenge = key => {
    const dk = D.pocketDeck();
    if (!dk.ok) { ui.toast(`Your deck isn’t ready: ${dk.why}`, {icon: 'info'}); return; }
    const r = L.invite(key, {ids: dk.ids, energy: dk.energy});
    if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
    ui.haptic('success'); draw();
  };
  sh.body.addEventListener('click', e => {
    let b;
    if ((b = e.target.closest('[data-lv-challenge]')) && !b.disabled) challenge(b.dataset.lvChallenge);
    else if (e.target.closest('[data-lv-cancel]')) { L.cancelInvite(); draw(); }
    else if ((b = e.target.closest('[data-lv-resume]'))) { const id = b.dataset.lvResume; sh.close(); import('./rivals-live-notice.js').then(m => m.go(`/puzzles/dynasty/battle/${id}`)); }
  });
  if (rematch) challenge(rematch);
}
