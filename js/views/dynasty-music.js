import {rivalsUpdated} from '../core/features.js';
import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import * as music from '../core/dynasty-music.js';
import * as sfx from '../core/dynasty-sfx.js';
let volumeId = 0;

// Keep the corner control outside panes that are replaced during navigation/battle updates.
// kind 'battle' (the battle view) plays the battle playlist; see core/dynasty-music.js.
export function attachMusic(el, isVisible = true, kind = 'hub') {
  const transport = music.attach(el, isVisible, kind);
  let button = null, bar = null, visible = isVisible, press = null, holdTimer = 0, suppressClick = false;
  let chevron = null, player = null;
  const closePlayer = () => {
    if (player) player.hidden = true;
    chevron?.setAttribute('aria-expanded', 'false');
    chevron?.setAttribute('aria-label', 'Show song controls');
  };
  const closeVolume = () => {
    clearTimeout(holdTimer);
    const pointer = press?.id; press = null;
    if (pointer != null && button?.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
    if (bar) bar.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  };
  const cancelVolume = () => { if (press) suppressClick = true; closeVolume(); };
  const openVolume = () => {
    if (!visible || !rivalsUpdated() || !bar) return;
    closePlayer();
    bar.hidden = false; button.setAttribute('aria-expanded', 'true');
  };
  const setLevel = value => {
    music.setVolume(value);
    if (music.state().volume > 0 && !music.state().enabled) music.setEnabled(true);
  };
  const draw = () => {
    if (!rivalsUpdated()) {
      cancelVolume(); closePlayer(); button?.remove(); bar?.remove(); chevron?.remove(); player?.remove();
      button = bar = chevron = player = null;
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
      chevron = document.createElement('button'); chevron.type = 'button'; chevron.className = 'pk-sound-menu';
      chevron.dataset.dyMusicMenu = ''; chevron.setAttribute('aria-label', 'Show song controls');
      chevron.setAttribute('aria-expanded', 'false'); chevron.setAttribute('aria-controls', `rivals-player-${volumeId}`);
      chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
      player = document.createElement('section'); player.className = 'pk-mini-player'; player.id = `rivals-player-${volumeId}`;
      player.hidden = true; player.setAttribute('aria-label', 'Song controls');
      // (Evan, Nov 9 2026: no song list here, "Instead their should be a logo to enter the jukebox")
      player.innerHTML = '<div class="pk-mini-song"><small data-mini-status></small><b data-mini-title></b><span data-mini-artist></span></div>'
        + '<button type="button" class="pk-mini-juke" data-mini-jukebox aria-label="Open the jukebox" title="Jukebox"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21.5V10a8 8 0 0 1 16 0v11.5z" fill="#f2a516"/><path d="M6.2 21.5V10.4a5.8 5.8 0 0 1 11.6 0v11.1z" fill="#e2557a"/><path d="M8.2 13.6v-3a3.8 3.8 0 0 1 7.6 0v3z" fill="#0f2a33"/><circle cx="12" cy="11" r="1.9" fill="#9fe9e6"/><circle cx="12" cy="11" r=".6" fill="#0f2a33"/><rect x="8.2" y="15" width="7.6" height="5.2" rx="1" fill="#0f2a33"/><path d="M9.6 16.8h4.8M9.6 18.5h4.8" stroke="#9fe9e6" stroke-width="1" stroke-linecap="round"/><rect x="3" y="21" width="18" height="1.8" rx=".9" fill="#f2a516"/></svg></button>'
        + '<button type="button" data-dy-music-skip aria-label="Skip song" title="Skip song"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 4v16l11-8zM17 4h3v16h-3z"/></svg></button>';
      chevron.addEventListener('click', e => {
        e.stopPropagation();
        if (!visible || !rivalsUpdated()) return;
        if (!player.hidden) { closePlayer(); return; }
        cancelVolume(); player.hidden = false;
        chevron.setAttribute('aria-expanded', 'true'); chevron.setAttribute('aria-label', 'Hide song controls');
      });
      // (the jukebox logo opens Settings' jukebox: pick songs and the rotation there)
      player.addEventListener('click', e => {
        e.stopPropagation();
        if (!visible || !rivalsUpdated()) return;
        if (e.target.closest('[data-dy-music-skip]')) music.skipTrack();
        else if (e.target.closest('[data-mini-jukebox]')) { closePlayer(); musicSheet(); }
      });
      button.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0 || !visible || !rivalsUpdated()) return;
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
        if (!direction || !visible || !rivalsUpdated()) return;
        e.preventDefault(); e.stopPropagation(); openVolume(); setLevel(music.state().volume + direction * 5);
      });
      button.addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) closeVolume(); });
      button.addEventListener('blur', cancelVolume);
      button.addEventListener('click', e => {
        e.stopPropagation();
        if (e.detail && suppressClick) { suppressClick = false; return; }
        if (!visible || !rivalsUpdated()) return;
        const s = music.state(), on = s.enabled && s.volume > 0;
        if (!on && !s.volume) music.setVolume(music.DEFAULT_MUSIC_VOLUME);
        music.setEnabled(!on);
      });
      el.append(button, bar, chevron, player); el.classList.add('has-rivals-sound');
    }
    const s = music.state(), on = s.enabled && s.volume > 0;
    const label = !s.supported ? 'Sound unavailable' : on ? 'Mute sound' : 'Unmute sound';
    button.hidden = !visible;
    chevron.hidden = !visible;
    button.disabled = !s.supported;
    button.setAttribute('aria-label', label); button.title = label;
    button.setAttribute('aria-description', `Volume ${s.volume}%. Hold and drag right or up to raise volume, left or down to lower it. Arrow keys also adjust volume.`);
    button.setAttribute('aria-pressed', String(on));
    button.querySelector('[data-sound-waves]').style.display = on ? '' : 'none';
    button.querySelector('[data-sound-off]').style.display = on ? 'none' : '';
    bar.querySelector('output').textContent = s.volume + '%';
    bar.querySelector('[role="meter"]').setAttribute('aria-valuenow', s.volume);
    bar.querySelector('i').style.width = s.volume + '%';
    player.querySelector('[data-mini-title]').textContent = s.track.title;
    player.querySelector('[data-mini-artist]').textContent = s.track.artist;
    player.querySelector('[data-mini-status]').textContent = s.empty ? 'NO SONGS ENABLED' : s.playing ? 'NOW PLAYING' : s.loading ? 'LOADING' : 'SELECTED SONG';
    player.querySelector('[data-dy-music-skip]').disabled = !s.supported || s.empty;
  };
  const onOutside = e => { if (player && !player.hidden && !player.contains(e.target) && !chevron.contains(e.target)) closePlayer(); };
  const onEscape = e => {
    if (e.key !== 'Escape' || !player || player.hidden) return;
    const focused = player.contains(document.activeElement); closePlayer();
    if (focused) chevron.focus({preventScroll: true});
    e.stopPropagation();
  };
  const onVisibility = () => { if (document.hidden) { cancelVolume(); closePlayer(); } };
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onEscape, true);
  addEventListener('blur', cancelVolume);
  document.addEventListener('visibilitychange', onVisibility);
  const offMusic = music.subscribe(draw);
  const offProfile = data.subscribe(type => { if (type === 'me') { cancelVolume(); closePlayer(); draw(); } });
  draw();
  return {
    visible(value) { visible = !!value; if (!visible) { cancelVolume(); closePlayer(); } transport.visible(value); draw(); },
    stop() {
      cancelVolume(); closePlayer(); offMusic(); offProfile(); button?.remove(); bar?.remove(); chevron?.remove(); player?.remove();
      document.removeEventListener('pointerdown', onOutside, true); document.removeEventListener('keydown', onEscape, true);
      removeEventListener('blur', cancelVolume); document.removeEventListener('visibilitychange', onVisibility);
      el.classList.remove('has-rivals-sound'); transport.stop();
    }
  };
}

// The checkbox and play button are siblings: changing the rotation never also plays the row.
const row = (t, i, battle = false) => `<li class="pk-juke-row" data-dy-song-row="${data.esc(t.id)}">
  <label class="pk-juke-check"><input type="checkbox" data-dy-song-enabled="${data.esc(t.id)}" aria-label="Include ${data.esc(t.title)} in shuffle"><span aria-hidden="true"></span></label>
  <button type="button" ${battle ? 'data-dy-battle-track' : 'data-dy-music-track'}="${data.esc(t.id)}" aria-label="Play ${data.esc(t.title)} by ${data.esc(t.artist)}" aria-pressed="false">
    <span class="pk-juke-info"><small>${data.esc(t.artist)}</small><b>${data.esc(t.title)}</b><span class="pk-juke-selected" data-dy-track-state hidden></span></span>
    ${t.cover ? `<span class="pk-juke-cover has-art" aria-hidden="true"><img src="${data.esc(t.cover)}" alt="" width="56" height="56" loading="lazy" decoding="async"></span>`
      : `<span class="pk-juke-cover" style="--cover-hue:${(i * 43 + 215) % 360}" aria-hidden="true"><span>RIVALS</span><i>♪</i><span>${String(i + 1).padStart(2, '0')}</span></span>`}
  </button></li>`;

export function musicSheet() {
  if (!rivalsUpdated()) return;
  let offMusic, offSfx, offProfile;
  const battle = music.state().battle, mix = music.BATTLE;
  const sh = ui.openSheet({title: 'Settings', cls: 'pk-sheet pk-jukebox-sheet', detents: ['fit'],
    body: `<div class="pk-music">
      <div class="pk-juke-brand"><span class="pk-juke-speaker" aria-hidden="true"></span><div><small>GRIDIRON RIVALS</small><h3>JUKEBOX</h3></div><span class="pk-juke-speaker" aria-hidden="true"></span></div>
      <div class="pk-juke-now"><img class="pk-juke-art" data-dy-music-art alt="" width="64" height="64" decoding="async" hidden><div><small data-dy-music-now>NOW PLAYING</small><h3 data-dy-music-title></h3><p data-dy-music-artist></p></div><span class="pk-juke-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>
      <!-- (Evan, Nov 9 2026: under the song playing, a play/pause button and the volume slider; the list gets the room) -->
      <div class="pk-juke-play"><button type="button" class="pk-juke-pp" data-dy-music-toggle aria-pressed="false" aria-label="Play music"></button>
        <label class="pk-music-volume pk-juke-level"><span>Music level</span><output data-dy-music-value></output>
          <input data-dy-music-volume type="range" min="0" max="100" step="1" aria-label="Music volume"></label></div>
      <p class="pk-note pk-juke-status" data-dy-music-status role="status"></p>
      <section class="pk-juke" aria-label="Jukebox"><div class="pk-juke-heading"><div><h3>Your rotation</h3><span data-dy-song-count></span></div><span class="pk-juke-mode">SHUFFLE</span></div>
        <div class="pk-juke-tools"><p>Check to include · tap a song to play</p><button type="button" data-dy-juke-all="songs">All</button><button type="button" data-dy-juke-none="songs">None</button></div>
        <ul aria-label="Menu songs">${music.TRACKS.map((t, i) => row(t, i)).join('')}</ul>
        ${battle ? `<details class="pk-juke-battle"><summary>Battle themes <span data-dy-battle-count></span></summary><div class="pk-juke-tools"><button type="button" data-dy-music-track="battle" aria-pressed="false">Use battle shuffle <span data-dy-track-state></span></button><button type="button" data-dy-juke-all="battle">All</button><button type="button" data-dy-juke-none="battle">None</button></div><ul aria-label="Battle themes">${music.BATTLE_SONGS.map((t, i) => row(t, i, true)).join('')}</ul></details>` : ''}
      </section></div>
      <section class="pk-sfx" aria-label="Sound effects"><h3>Sound effects</h3>
        <button type="button" class="pk-btn" data-dy-sfx-toggle aria-pressed="true">Mute effects</button>
        <label class="pk-music-volume">Effects level <output data-dy-sfx-value></output>
          <input data-dy-sfx-volume type="range" min="0" max="100" step="1" aria-label="Sound effects volume">
        </label><p class="pk-note" data-dy-sfx-status role="status"></p><p class="pk-note pk-music-phone">Use your phone’s volume buttons for overall volume.</p></section>`,
    onClose: () => { offMusic?.(); offSfx?.(); offProfile?.(); }});
  const draw = () => {
    const fx = sfx.state(), toggle = sh.body.querySelector('[data-dy-sfx-toggle]');
    toggle.textContent = fx.enabled ? 'Mute effects' : 'Enable effects';
    toggle.setAttribute('aria-pressed', String(fx.enabled)); toggle.disabled = !fx.supported;
    const fxRange = sh.body.querySelector('[data-dy-sfx-volume]');
    fxRange.value = fx.volume; fxRange.disabled = !fx.supported;
    sh.body.querySelector('[data-dy-sfx-value]').textContent = fx.volume + '%';
    sh.body.querySelector('[data-dy-sfx-status]').textContent = !fx.supported ? 'Sound effects are unavailable in this browser.' : fx.failure || (!fx.enabled || !fx.volume ? 'Sound effects are muted.' : 'Card actions, attacks, pack reveals and match results.');
    const s = music.state(), button = sh.body.querySelector('[data-dy-music-toggle]');
    const pp = s.enabled ? 'pause' : 'play';
    if (button.dataset.pp !== pp) { button.dataset.pp = pp; button.innerHTML = (s.enabled ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>') + `<span>${s.enabled ? 'Pause' : 'Play'}</span>`; }
    button.setAttribute('aria-label', s.enabled ? 'Pause music' : 'Play music');
    button.setAttribute('aria-pressed', String(s.enabled)); button.disabled = !s.supported || s.empty;
    sh.body.querySelector('[data-dy-music-title]').textContent = s.empty ? 'Make it your mix' : s.track.title;
    sh.body.querySelector('[data-dy-music-artist]').textContent = s.empty ? 'Enable a song below to get started.' : s.track.artist;
    sh.body.querySelector('[data-dy-music-now]').textContent = s.empty ? 'NO SONGS ENABLED' : s.playing ? 'NOW PLAYING' : s.loading ? 'LOADING' : 'SELECTED SONG';
    sh.body.querySelector('.pk-juke-now').classList.toggle('is-playing', s.playing);
    // (the song's album cover beside it, when it has one)
    const art = sh.body.querySelector('[data-dy-music-art]'), cover = s.empty ? '' : s.track.cover || '';
    if (art.getAttribute('src') !== cover) { if (cover) art.src = cover; else art.removeAttribute('src'); }
    art.hidden = !cover;
    sh.body.querySelector('[data-dy-song-count]').textContent = `${music.TRACKS.filter(t => !s.excluded.includes(t.id)).length} / ${music.TRACKS.length} songs enabled`;
    const battleCount = sh.body.querySelector('[data-dy-battle-count]');
    if (battleCount) battleCount.textContent = `${music.BATTLE_SONGS.filter(t => !s.excluded.includes(t.id)).length} / ${music.BATTLE_SONGS.length}`;
    sh.body.querySelectorAll('[data-dy-song-enabled]').forEach(input => {
      input.checked = !s.excluded.includes(input.dataset.dySongEnabled);
      input.closest('li').classList.toggle('is-excluded', !input.checked);
    });
    sh.body.querySelectorAll('[data-dy-music-track], [data-dy-battle-track]').forEach(b => {
      const selected = !s.empty && (b.dataset.dyMusicTrack === s.track.id || (s.track.id === mix.id && b.dataset.dyBattleTrack === s.track.song));
      b.setAttribute('aria-pressed', String(selected)); b.disabled = !s.supported;
      b.closest('li')?.classList.toggle('is-current', selected);
      const off = s.excluded.includes(b.dataset.dyMusicTrack || b.dataset.dyBattleTrack);
      // (no "Tap to play" on every row, Evan, Nov 9 2026: only the song playing and songs left out say anything)
      const note = b.querySelector('[data-dy-track-state]'), text = selected ? s.playing ? 'Now playing' : 'Selected' : off ? 'Off' : '';
      note.textContent = text; note.hidden = !text;
    });
    const range = sh.body.querySelector('[data-dy-music-volume]');
    range.value = s.volume; range.disabled = !s.supported;
    sh.body.querySelector('[data-dy-music-value]').textContent = s.volume + '%';
    const status = !s.supported ? 'Music is unavailable in this browser.'
      : s.empty ? 'No songs enabled in this playlist. Check a song or tap one to play.' : !s.enabled ? 'Music is paused.' : s.failure || (!s.volume ? 'Music level is muted.' : s.playing ? 'Shuffling your enabled songs · saved for your profile.' : s.loading ? 'Loading track…' : 'Ready · starts with your next tap in Rivals.');
    const statusEl = sh.body.querySelector('[data-dy-music-status]');
    if (statusEl.textContent !== status) statusEl.textContent = status;
  };
  sh.body.addEventListener('click', e => {
    if (e.target.closest('[data-dy-sfx-toggle]')) sfx.setEnabled(!sfx.state().enabled);
    if (e.target.closest('[data-dy-music-toggle]')) music.setEnabled(!music.state().enabled);
    const song = e.target.closest('[data-dy-music-track]'); if (song) music.selectTrack(song.dataset.dyMusicTrack);
    const theme = e.target.closest('[data-dy-battle-track]'); if (theme) music.selectBattleTrack(theme.dataset.dyBattleTrack);
    const all = e.target.closest('[data-dy-juke-all]'); if (all) music.setPlaylistEnabled(all.dataset.dyJukeAll, true);
    const none = e.target.closest('[data-dy-juke-none]'); if (none) music.setPlaylistEnabled(none.dataset.dyJukeNone, false);
  });
  sh.body.addEventListener('change', e => { if (e.target.matches('[data-dy-song-enabled]')) music.setTrackEnabled(e.target.dataset.dySongEnabled, e.target.checked); });
  sh.body.addEventListener('input', e => {
    if (e.target.matches('[data-dy-sfx-volume]')) sfx.setVolume(e.target.value);
    if (e.target.matches('[data-dy-music-volume]')) music.setVolume(e.target.value);
  });
  offMusic = music.subscribe(draw);
  offSfx = sfx.subscribe(draw);
  offProfile = data.subscribe(type => { if (type === 'me') sh.close(); });
  draw();
  // Open the jukebox's scrolling list at the song that is playing.
  const list = sh.body.querySelector('.pk-juke ul'), on = list.querySelector('[aria-pressed="true"]');
  if (on) list.scrollTop = Math.max(0, on.getBoundingClientRect().top - list.getBoundingClientRect().top - 6);
}
