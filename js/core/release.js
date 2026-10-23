// Once per profile and release, after the opening animation and profile picker.
import * as ui from './ui.js';
import * as data from './data.js';

export const VERSION = '3.0';
const sessionSeen = new Set();
let pending = false, open = null;
const profile = () => data.me() || (data.user() ? 'user:' + data.user().id : data.guest() ? 'guest:' + data.guest() : 'visitor');
const keyFor = () => 'gg-release-' + VERSION + ':' + encodeURIComponent(profile());
const seen = key => sessionSeen.has(key) || ui.lsGet(key) === '1';

export function showReleaseNotice() {
  if (pending || open || seen(keyFor())) return;
  pending = true;
  const attempt = () => {
    if (seen(keyFor())) { pending = false; return; }
    if (document.hidden || document.getElementById('title') || document.querySelector('.welcome') || ui.sheetCount()) {
      setTimeout(attempt, 250);
      return;
    }
    // Decorative shelf motion can keep whenIdle waiting indefinitely. Use a bounded
    // idle callback after the blocking launch layers have actually gone away.
    ui.onIdle(() => {
      if (document.hidden || document.querySelector('.welcome') || ui.sheetCount()) { setTimeout(attempt, 250); return; }
      pending = false;
      const key = keyFor();
      if (seen(key)) return;
      open = ui.openSheet({
        title: 'Gridiron Hub v3.0', cls: 'sh-release', detents: ['fit'],
        body: '<p class="release-kicker">A new season of play</p>'
          + '<div class="release-copy"><p>Keepfall is now open to everyone, with new kingdoms, building upgrades, heroes, and raid replays.</p>'
          + '<p>Return Man brings refreshed environments, tougher courses, and new pickup effects.</p>'
          + '<p>Game scoreboards start fresh for v3.0, and Keepfall uses normal earned resources.</p>'
          + '<p>Tab swipes and back navigation have been tuned for a smoother app.</p></div>'
          + ui.button({label: 'Let’s play', kind: 'primary', block: true, attrs: {'data-sheet-close': ''}}),
        onClose() {
          sessionSeen.add(key);
          ui.lsSet(key, '1');
          open = null;
          showReleaseNotice();
        }
      });
    }, 1000);
  };
  attempt();
}

data.subscribe(type => { if (type === 'me') showReleaseNotice(); });
