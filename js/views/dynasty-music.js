import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import * as music from '../core/dynasty-music.js';

export function musicSheet() {
  if (!data.isOwner()) return;
  let offMusic, offProfile;
  const sh = ui.openSheet({title: 'Music', cls: 'pk-sheet', detents: ['fit'],
    body: `<div class="pk-music"><p class="pk-note">Fourth Quarter · Original instrumental</p>
      <button type="button" class="pk-btn" data-dy-music-toggle aria-pressed="false">Music</button>
      <label class="pk-music-volume">Volume <output data-dy-music-value></output>
        <input data-dy-music-volume type="range" min="0" max="100" step="1" aria-label="Music volume">
      </label><p class="pk-note" data-dy-music-status role="status"></p></div>`,
    onClose: () => { offMusic?.(); offProfile?.(); }});
  const draw = () => {
    const s = music.state(), button = sh.body.querySelector('[data-dy-music-toggle]');
    button.textContent = s.enabled ? 'Music on' : 'Music off';
    button.setAttribute('aria-pressed', String(s.enabled)); button.disabled = !s.supported;
    const range = sh.body.querySelector('[data-dy-music-volume]');
    range.value = s.volume; range.disabled = !s.supported;
    sh.body.querySelector('[data-dy-music-value]').textContent = s.volume + '%';
    sh.body.querySelector('[data-dy-music-status]').textContent = !s.supported ? 'Music is unavailable in this browser.'
      : s.failure || (!s.enabled ? 'Music is off.' : !s.volume ? 'Volume is muted.' : s.playing ? 'Playing · pauses when you leave Rivals.' : 'Ready · starts with your next tap in Rivals.');
  };
  sh.body.addEventListener('click', e => { if (e.target.closest('[data-dy-music-toggle]')) music.setEnabled(!music.state().enabled); });
  sh.body.addEventListener('input', e => { if (e.target.matches('[data-dy-music-volume]')) music.setVolume(e.target.value); });
  offMusic = music.subscribe(draw);
  offProfile = data.subscribe(type => { if (type === 'me') sh.close(); });
  draw();
}
