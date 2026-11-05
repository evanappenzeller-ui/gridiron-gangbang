import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import * as music from '../core/dynasty-music.js';
const time = seconds => { const n = Math.max(0, Math.floor(seconds || 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

export function musicSheet() {
  if (!data.isOwner()) return;
  let offMusic, offProfile, scrubbing = false;
  const sh = ui.openSheet({title: 'Settings', cls: 'pk-sheet', detents: ['fit'],
    body: `<div class="pk-music">
      <div class="pk-juke-now"><span class="pk-juke-disc" aria-hidden="true">♪</span><div><small data-dy-music-now>NOW PLAYING</small><h3 data-dy-music-title></h3><p data-dy-music-artist></p></div></div>
      <div class="pk-juke-controls"><button type="button" class="pk-btn" data-dy-music-restart aria-label="Restart song">↺ Restart</button><button type="button" class="pk-btn" data-dy-music-toggle aria-pressed="false">Play music</button></div>
      <label class="pk-music-volume">Song position <output data-dy-music-time></output>
        <input data-dy-music-seek type="range" min="0" max="0" step="1" value="0" aria-label="Song position">
      </label>
      <label class="pk-music-volume">Music level <output data-dy-music-value></output>
        <input data-dy-music-volume type="range" min="0" max="100" step="1" aria-label="Music volume">
      </label><p class="pk-note pk-music-phone">Use your phone’s volume buttons for overall volume.</p>
      <section class="pk-juke" aria-label="Jukebox"><div class="pk-juke-heading"><h3>Jukebox</h3><span>${music.TRACKS.length} ${music.TRACKS.length === 1 ? 'song' : 'songs'}</span></div>
        <ul>${music.TRACKS.map(t => `<li><button type="button" data-dy-music-track="${data.esc(t.id)}" aria-pressed="false"><span class="pk-juke-note" aria-hidden="true">♪</span><span><b>${data.esc(t.title)}</b><small>${data.esc(t.artist)}</small></span><span class="pk-juke-selected" data-dy-track-state></span></button></li>`).join('')}</ul>
      </section><p class="pk-note" data-dy-music-status role="status"></p></div>`,
    onClose: () => { offMusic?.(); offProfile?.(); }});
  const draw = () => {
    const s = music.state(), button = sh.body.querySelector('[data-dy-music-toggle]');
    button.textContent = s.enabled ? 'Pause music' : 'Play music';
    button.setAttribute('aria-pressed', String(s.enabled)); button.disabled = !s.supported;
    sh.body.querySelector('[data-dy-music-title]').textContent = s.track.title;
    sh.body.querySelector('[data-dy-music-artist]').textContent = s.track.artist;
    sh.body.querySelector('[data-dy-music-now]').textContent = s.playing ? 'NOW PLAYING' : 'SELECTED SONG';
    const seek = sh.body.querySelector('[data-dy-music-seek]');
    seek.disabled = !s.duration; seek.max = s.duration;
    if (!scrubbing) seek.value = s.position;
    const position = scrubbing ? Number(seek.value) : s.position;
    seek.setAttribute('aria-valuetext', `${time(position)} of ${time(s.duration)}`);
    sh.body.querySelector('[data-dy-music-time]').textContent = time(position) + ' / ' + time(s.duration);
    sh.body.querySelector('[data-dy-music-restart]').disabled = !s.duration;
    sh.body.querySelectorAll('[data-dy-music-track]').forEach(b => {
      const selected = b.dataset.dyMusicTrack === s.track.id;
      b.setAttribute('aria-pressed', String(selected)); b.disabled = !s.supported;
      b.querySelector('[data-dy-track-state]').textContent = selected ? s.playing ? 'Playing' : 'Selected' : 'Play';
    });
    const range = sh.body.querySelector('[data-dy-music-volume]');
    range.value = s.volume; range.disabled = !s.supported;
    sh.body.querySelector('[data-dy-music-value]').textContent = s.volume + '%';
    const status = !s.supported ? 'Music is unavailable in this browser.'
      : !s.enabled ? 'Music is paused.' : s.failure || (!s.volume ? 'Music level is muted.' : s.playing ? 'Loops automatically · pauses when you leave Rivals.' : s.loading ? 'Loading track…' : 'Ready · starts with your next tap in Rivals.');
    const statusEl = sh.body.querySelector('[data-dy-music-status]');
    if (statusEl.textContent !== status) statusEl.textContent = status;
  };
  sh.body.addEventListener('click', e => {
    if (e.target.closest('[data-dy-music-toggle]')) music.setEnabled(!music.state().enabled);
    if (e.target.closest('[data-dy-music-restart]')) music.seek(0);
    const song = e.target.closest('[data-dy-music-track]'); if (song) music.selectTrack(song.dataset.dyMusicTrack);
  });
  sh.body.addEventListener('pointerdown', e => { if (e.target.matches('[data-dy-music-seek]')) scrubbing = true; });
  for (const name of ['change', 'pointerup', 'pointercancel', 'focusout']) sh.body.addEventListener(name, () => { scrubbing = false; draw(); });
  sh.body.addEventListener('input', e => {
    if (e.target.matches('[data-dy-music-volume]')) music.setVolume(e.target.value);
    if (e.target.matches('[data-dy-music-seek]')) music.seek(e.target.value);
  });
  offMusic = music.subscribe(draw);
  offProfile = data.subscribe(type => { if (type === 'me') sh.close(); });
  draw();
}
