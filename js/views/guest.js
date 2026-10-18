// A guest's player: someone not in the league makes their own, a name their daily games (Daily Puzzles, 17-0, the
// Two-Minute Drill) post under on the boards, where it carries a Guest tag; or renames the one they made. The form
// is the welcome screen's (in place of the members) and the You sheet's (as a sheet). The name can't be a league
// member's or another player's on the boards (daily.guestNameProblem); data.setGuest keeps it on this phone and
// daily.js renames this phone's board row.
// Exports: guestFormHTML(cur, {submit}), wireGuestForm(form, {cur, onSaved}), openGuestSheet({onDone}). Owner: SHELL.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';

const esc = data.esc;
const LEAD = 'Not in the league? Make your own player to keep your Daily Puzzles, 17–0 and Two-Minute Drill scores. They show on your own boards under this name, tagged Guest; the league doesn’t see them.';

/** The form: what it's for, the name field, the error line, the button (submit: its label). */
export function guestFormHTML(cur, {submit} = {}) {
  return `<form class="c-gs" novalidate>`
    + `<p class="c-gs-lead">${esc(cur ? 'Your scores show under this name on your own boards.' : LEAD)}</p>`
    + `<label class="c-gs-field"><span class="c-gs-lab">Your name</span>`
    + `<input class="c-gs-in" type="text" name="name" maxlength="24" value="${esc(cur || '')}" placeholder="Name or nickname" autocomplete="nickname" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-describedby="c-gs-err" required></label>`
    + `<p class="c-gs-err" id="c-gs-err" role="alert"></p>`
    + ui.button({label: submit || (cur ? 'Save' : 'Create player'), kind: 'primary', block: true, type: 'submit', cls: 'c-gs-go'})
    + `</form>`;
}
/** Checks the name on submit, saves it (data.setGuest) and calls onSaved(name); a name already in use, a member's or
 *  a blank one gets its reason under the field. */
export function wireGuestForm(form, {cur, onSaved} = {}) {
  const input = form.querySelector('input'), err = form.querySelector('.c-gs-err');
  const say = msg => { err.textContent = msg; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
  input.addEventListener('input', () => { if (err.textContent) say(''); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (cur && name === cur) { if (onSaved) onSaved(name, false); return; }
    const why = daily.guestNameProblem(name);
    if (why) { say(why); ui.shake(input); ui.haptic('error'); try { input.focus(); } catch (_) {} return; }
    data.setGuest(name);
    ui.haptic('success');
    ui.toast(cur ? `You're now ${name}.` : `Welcome, ${name}. Your scores will show on your boards.`, {icon: 'check-circle'});
    if (onSaved) onSaved(name, true);
  });
}

let open = null;
/** The guest sheet (from the You sheet): make your player, or rename it. onDone(name) once it's saved. */
export function openGuestSheet({onDone} = {}) {
  if (open && open.open) return open;
  const cur = data.guest();
  const s = ui.openSheet({title: cur ? 'Your player' : 'Play as a guest', body: guestFormHTML(cur), cls: 'sh-guest', detents: ['fit'], focus: '.c-gs-in',
    onClose: () => { if (open === s) open = null; }});
  open = s;
  wireGuestForm(s.body.querySelector('form'), {cur, onSaved: name => { s.close(); if (onDone) onDone(name); }});
  return s;
}
