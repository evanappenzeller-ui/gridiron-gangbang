import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import * as music from '../core/dynasty-music.js';
const time = seconds => { const n = Math.max(0, Math.floor(seconds || 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
let volumeId = 0;

// Keep the corner control outside panes that are replaced during navigation/battle updates.
export function attachMusic(el, isVisible = true) {
  const transport = music.attach(el, isVisible);
  let button = null, bar = null, visible = isVisible, press = null, holdTimer = 0, suppressClick = false;
  const closeVolume = () => {
    clearTimeout(holdTimer);
    const pointer = press?.id; press = null;
    if (pointer != null && button?.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
    if (bar) bar.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  };
  const cancelVolume = () => { if (press) suppressClick = true; closeVolume(); };
  const openVolume = () => {
    if (!visible || !data.isOwner() || !bar) return;
    bar.hidden = false; button.setAttribute('aria-expanded', 'true');
  };
  const setLevel = value => {
    music.setVolume(value);
    if (music.state().volume > 0 && !music.state().enabled) music.setEnabled(true);
  };
  const draw = () => {
    if (!data.isOwner()) {
      cancelVolume(); button?.remove(); bar?.remove(); button = bar = null;
      el.classList.remove('has-rivals-sound'); return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button'; button.className = 'pk-sound'; button.dataset.dySound = '';
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4z"/><g data-sound-waves><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></g><path data-sound-off d="m16 9 6 6m0-6-6 6"/></svg>';
      bar = document.createElement('div'); bar.className = 'pk-sound-level'; bar.hidden = true;
      bar.id = `rivals-volume-${++volumeId}`;
      bar.innerHTML = '<span>Volume <output></output></span><div class="pk-sound-track" role="meter" aria-label="Sound level" aria-valuemin="0" aria-valuemax="100"><i></i></div>';
      button.setAttribute('aria-controls', bar.id); button.setAttribute('aria-expanded', 'false');
      button.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0 || !visible || !data.isOwner()) return;
        cancelVolume(); suppressClick = false;
        press = {id: e.pointerId, x: e.clientX, y: e.clientY, level: music.state().volume, held: false};
        button.setPointerCapture(e.pointerId);
        holdTimer = setTimeout(() => {
          if (!press) return;
          press.held = true; suppressClick = true; openVolume();
        }, 300);
      });
      button.addEventListener('pointermove', e => {
        if (!press || press.id !== e.pointerId) return;
        const dx = e.clientX - press.x, dy = press.y - e.clientY;
        if (!press.held) {
          if (Math.hypot(dx, dy) > 14) cancelVolume();
          return;
        }
        e.preventDefault();
        // Use the stronger movement each frame so diagonals don't double the sensitivity.
        press.level = Math.max(0, Math.min(100, press.level + (Math.abs(dx) >= Math.abs(dy) ? dx : dy) / 1.5));
        press.x = e.clientX; press.y = e.clientY;
        setLevel(press.level);
      });
      button.addEventListener('pointerup', e => { if (press?.id === e.pointerId) closeVolume(); });
      button.addEventListener('pointercancel', cancelVolume);
      button.addEventListener('lostpointercapture', cancelVolume);
      button.addEventListener('contextmenu', e => e.preventDefault());
      button.addEventListener('keydown', e => {
        if (e.key === 'Escape') { cancelVolume(); return; }
        const direction = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1}[e.key];
        if (!direction || !visible || !data.isOwner()) return;
        e.preventDefault(); e.stopPropagation(); openVolume(); setLevel(music.state().volume + direction * 5);
      });
      button.addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) closeVolume(); });
      button.addEventListener('blur', cancelVolume);
      button.addEventListener('click', e => {
        e.stopPropagation();
        if (e.detail && suppressClick) { suppressClick = false; return; }
        if (!visible || !data.isOwner()) return;
        const s = music.state(), on = s.enabled && s.volume > 0;
        if (!on && !s.volume) music.setVolume(35);
        music.setEnabled(!on);
      });
      el.append(button, bar); el.classList.add('has-rivals-sound');
    }
    const s = music.state(), on = s.enabled && s.volume > 0;
    const label = !s.supported ? 'Sound unavailable' : on ? 'Mute sound' : 'Unmute sound';
    button.hidden = !visible;
    button.disabled = !s.supported;
    button.setAttribute('aria-label', label); button.title = label;
    button.setAttribute('aria-description', `Volume ${s.volume}%. Hold and drag right or up to raise volume, left or down to lower it. Arrow keys also adjust volume.`);
    button.setAttribute('aria-pressed', String(on));
    button.querySelector('[data-sound-waves]').style.display = on ? '' : 'none';
    button.querySelector('[data-sound-off]').style.display = on ? 'none' : '';
    bar.querySelector('output').textContent = s.volume + '%';
    bar.querySelector('[role="meter"]').setAttribute('aria-valuenow', s.volume);
    bar.querySelector('i').style.width = s.volume + '%';
  };
  const onVisibility = () => { if (document.hidden) cancelVolume(); };
  addEventListener('blur', cancelVolume);
  document.addEventListener('visibilitychange', onVisibility);
  const offMusic = music.subscribe(draw);
  const offProfile = data.subscribe(type => { if (type === 'me') draw(); });
  draw();
  return {
    visible(value) { visible = !!value; if (!visible) cancelVolume(); transport.visible(value); draw(); },
    stop() {
      cancelVolume(); offMusic(); offProfile(); button?.remove(); bar?.remove();
      removeEventListener('blur', cancelVolume); document.removeEventListener('visibilitychange', onVisibility);
      el.classList.remove('has-rivals-sound'); transport.stop();
    }
  };
}

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
