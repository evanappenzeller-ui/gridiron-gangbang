// Test play: the owner's way to play any of the daily games again whenever he needs to test one (his ask, Oct 2026).
// At the bottom of each game's screen (Daily Puzzles, 17-0, the Two-Minute Drill, Kick It), on his phones only: "Test
// play" starts today's game fresh in a sandbox (each game's core keeps a test store beside the real one: never posted,
// never counted, the real day untouched); while it's on the row says so, and "End test play" brings the real day back
// as it was. Each game wires its own button (attr: its data- attribute; the value is 'on' or 'off').
// Exports: canTest(id), testRowHTML(on, attr), TESTERS. Owner: SHELL.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

export const TESTERS = ['evan'];
/** Whether this phone's member may test play (the owner). */
export const canTest = (id = data.me()) => !!id && TESTERS.includes(id);
/** The row at the bottom of a game: Test play, or (on) what's going on and End test play. '' for anyone else. */
export function testRowHTML(on, attr) {
  if (!canTest()) return '';
  const btn = ui.button({label: on ? 'End test play' : 'Test play', kind: on ? 'primary' : 'secondary', size: 's', icon: on ? 'x' : 'play-fill', attrs: {[attr]: on ? 'off' : 'on'}});
  return `<div class="tp-row${on ? ' is-on' : ''}" role="group" aria-label="Test play">`
    + `<p class="tp-t">${on ? '<b>Test play</b><span>Not counted, not on the scoreboard. Your real game is kept.</span>'
      : '<span>Play today’s game again to test it. It won’t count or post.</span>'}</p>${btn}</div>`;
}
