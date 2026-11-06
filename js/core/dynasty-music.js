import {rivalsUpdated} from './features.js';
// Rivals' owner-uploaded MP3s. One streaming media element, with Web Audio volume control
// (including on iOS), shared by the hub and battle views. Never touches game saves.
// The hub loops the jukebox song the player picked. Battles play the Cyber Funkwave mix from a random point each
// time a battle opens, part after part; a song picked from the jukebox during a battle plays for the rest of it.
import * as data from './data.js';
import {profileKey} from './realm-active.js';

const KEY = () => `gg-rivals-music:${profileKey()}:v1`;
const song = (id, title, artist) => Object.freeze({id, title, artist, url: new URL(`../../audio/rivals/${id}-v1.mp3`, import.meta.url).href});
export const TRACKS = Object.freeze([
  song('sundress', 'Sundress', 'A$AP Rocky'),
  song('praise-the-lord', 'Praise the Lord (Da Shine)', 'A$AP Rocky ft. Skepta'),
  song('fashion-killa', 'Fashion Killa', 'A$AP Rocky'),
  song('lost', 'Lost', 'Frank Ocean'),
  song('jimmy-cooks', 'Jimmy Cooks', 'Drake ft. 21 Savage'),
  song('overdue', 'Overdue', 'Metro Boomin & Travis Scott'),
  song('timeless', 'Timeless', 'The Weeknd & Playboi Carti'),
  song('niagara-falls', 'Niagara Falls (Foot or 2)', 'Metro Boomin, Travis Scott & 21 Savage'),
  song('something-about-us', 'Something About Us', 'Daft Punk'),
  song('voyager', 'Voyager', 'Daft Punk'),
  song('straighten-it-out', 'Straighten It Out', 'Pete Rock & C.L. Smooth'),
  song('troy', 'They Reminisce Over You (T.R.O.Y.)', 'Pete Rock & C.L. Smooth'),
  song('dead-and-gone', 'Dead and Gone', 'T.I. ft. Justin Timberlake'),
  song('lpfj2', 'Lord Pretty Flacko Jodye 2', 'A$AP Rocky'),
  song('let-it-happen', 'Let It Happen', 'Tame Impala'),
  song('still-tippin', 'Still Tippin’', 'Mike Jones ft. Slim Thug & Paul Wall'),
  song('rapp-snitch-knishes', 'Rapp Snitch Knishes', 'MF DOOM ft. Mr. Fantastik'),
  song('back-to-the-moon', 'back to the moon', 'Gunna'),
  song('hate-it-or-love-it', 'Hate It or Love It', 'The Game ft. 50 Cent'),
  song('butterfly-effect', 'Butterfly Effect', 'Travis Scott'),
  song('overnight-celebrity', 'Overnight Celebrity', 'Twista'),
  song('cities', 'Cities', 'Throttle'),
  song('save-your-tears', 'Save Your Tears', 'The Weeknd'),
  song('ease-my-mind', 'Ease My Mind', 'Chris Lake & Abel Balder'),
  song('wicked-game', 'Wicked Game', 'The Expendables'),
  song('railroad-shelter', 'Railroad Shelter', 'TJ O’Neill ft. Stick Figure'),
  song('played-like-a-piano', 'Played Like a Piano', 'King Tee ft. Ice Cube & Breeze'),
  song('talking-to-my-diary', 'Talking to My Diary (Instrumental)', 'Dr. Dre'),
  song('ballin', 'Ballin’', 'Mustard ft. Roddy Ricch'),
  song('feel-so-good', 'Feel So Good', 'Mase'),
  song('dead-presidents-ii', 'Dead Presidents II', 'JAY-Z'),
]);
// The battle mix's video is one 38:45 playlist played three times over; one pass is kept, cut into seven parts at the gaps
// between its tunes, so a phone only fetches (and the service worker only caches) the part that plays. The last part
// leads back into the first, as in the original. Lengths in seconds, in order.
const PARTS = [246.3, 244.3, 395.3, 343.8, 374.101, 335.8, 385.3];
const STARTS = PARTS.map((_, i) => PARTS.slice(0, i).reduce((a, s) => a + s, 0));
export const BATTLE = Object.freeze({id: 'battle', title: 'Cyber Funkwave', artist: 'Funkonaut Sound',
  duration: PARTS.reduce((a, s) => a + s, 0),
  parts: Object.freeze(PARTS.map((seconds, i) => Object.freeze({seconds,
    url: new URL(`../../audio/rivals/cyber-funkwave-v1-${String(i + 1).padStart(2, '0')}.mp3`, import.meta.url).href})))});
const partAt = t => { let i = 0; while (i + 1 < STARTS.length && STARTS[i + 1] <= t) i++; return i; };
const partOf = key => key.startsWith('battle:') ? Number(key.slice(7)) : -1;
// Anywhere in the mix (it loops), though not in a part's last few seconds.
function randomSpot() {
  const t = Math.random() * BATTLE.duration, part = partAt(t);
  return {part, at: Math.min(t - STARTS[part], Math.max(0, PARTS[part] - 5))};
}

let selected = TRACKS[0].id;
const track = () => TRACKS.find(t => t.id === selected) || TRACKS[0];
const clients = new Set(), listeners = new Set();
export const DEFAULT_MUSIC_VOLUME = 8;
let enabled = true, volume = DEFAULT_MUSIC_VOLUME, started = false, away = false, failure = '';
let audio = null, master = null, media = null, pending = 0, revision = 0, offProfile = null;
let effectGain = null;
const audibleEffects = new Set();
let systemOwned = false, previousType = null;
// shown: the visible scene ('hub', 'battle' or null). lastBattle: the battle view the mix last started for, so a new
// battle rolls a new start while returning to the same one carries on. ownSong: a jukebox song replaces the mix in this
// battle. loaded: what the media element holds (a track id or 'battle:<part>'). spot: where the mix plays from.
// resume: each song's place when the battle mix took over from it. seekTo: a position to apply once the new source's
// metadata loads.
let shown = null, lastBattle = null, ownSong = false, loaded = '', spot = {part: 0, at: 0}, resume = {}, seekTo = null;
const systemActions = ['play', 'pause', 'stop', 'seekto', 'seekbackward', 'seekforward'];

let preferenceKey;
function read() {
  preferenceKey = KEY();
  enabled = true; volume = DEFAULT_MUSIC_VOLUME;
  selected = TRACKS[0].id;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY()));
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(100, Math.round(saved.volume)));
    if (TRACKS.some(t => t.id === saved?.track)) selected = saved.track;
  } catch (_) {}
}
read();
const visible = () => [...clients].some(c => c.visible);
const wanted = () => rivalsUpdated() && visible() && !document.hidden && !away && started && enabled && volume > 0;
const notify = () => { updateSystem(); listeners.forEach(fn => fn()); };
const playingMix = () => shown === 'battle' && !ownSong;
export function state() {
  if (preferenceKey !== KEY()) read();
  const part = media ? partOf(loaded) : -1, here = Number.isFinite(media?.currentTime) ? media.currentTime : 0;
  const length = Number.isFinite(media?.duration) ? media.duration : 0;
  return {enabled, volume, track: playingMix() ? BATTLE : track(), battle: shown === 'battle',
    position: part >= 0 ? STARTS[part] + here : here, duration: part >= 0 ? (length ? BATTLE.duration : 0) : length,
    playing: !!media && !media.paused && media.readyState >= 3 && audio?.state === 'running',
    loading: !!pending, supported: !!(globalThis.AudioContext || globalThis.webkitAudioContext), failure};
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Phone buttons remain OS media volume. This gain is only the game's relative music level.
// Optional APIs identify Rivals as playback and expose the song to native media controls.
function ownSystem() {
  if (systemOwned) return;
  systemOwned = true;
  try { if (navigator.audioSession) { previousType = navigator.audioSession.type; navigator.audioSession.type = 'playback'; } } catch (_) {}
  const actions = {play: () => setEnabled(true), pause: () => setEnabled(false), stop: () => { setEnabled(false); seek(0); },
    seekto: e => seek(e.seekTime), seekbackward: e => seek(state().position - (e.seekOffset || 10)), seekforward: e => seek(state().position + (e.seekOffset || 10))};
  for (const name of systemActions) {
    try { navigator.mediaSession?.setActionHandler(name, e => { if (rivalsUpdated() && visible() && !document.hidden && !away) actions[name](e || {}); }); } catch (_) {}
  }
  updateMetadata();
}
function updateMetadata() {
  if (!systemOwned) return;
  const now = playingMix() ? BATTLE : track();
  try { if (navigator.mediaSession && globalThis.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({title: now.title, artist: now.artist, album: 'Gridiron Rivals'}); } catch (_) {}
}
function releaseSystem() {
  if (!systemOwned) return;
  systemOwned = false;
  for (const name of systemActions) { try { navigator.mediaSession?.setActionHandler(name, null); } catch (_) {} }
  try { if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.setPositionState?.(); } } catch (_) {}
  try { if (navigator.audioSession?.type === 'playback' && previousType != null) navigator.audioSession.type = previousType; } catch (_) {}
  previousType = null;
}
function updateSystem() {
  if (!rivalsUpdated() || !visible() || document.hidden || away) { releaseSystem(); return; }
  if (!systemOwned) return;
  const s = state();
  try { if (navigator.mediaSession) navigator.mediaSession.playbackState = s.playing ? 'playing' : 'paused'; } catch (_) {}
  try { if (s.duration > 0) navigator.mediaSession?.setPositionState?.({duration: s.duration, position: Math.min(s.position, s.duration), playbackRate: 1}); } catch (_) {}
}

// Effects share one temporary reduction. Releasing the last cue brings the music
// back to its chosen level. This gain never changes the slider or the saved preference.
export function makeRoomForEffect() {
  if (!effectGain || !wanted()) return;
  const effect = {};
  if (!audibleEffects.size) effectGain.gain.setTargetAtTime(.25, audio.currentTime, .004);
  audibleEffects.add(effect);
  return () => {
    if (audibleEffects.delete(effect) && !audibleEffects.size) {
      effectGain.gain.setTargetAtTime(1, audio.currentTime, .10);
    }
  };
}

// What the visible scene plays: a part of the mix, or a looping jukebox song (back where it was, after a battle).
function desired() {
  if (playingMix()) return {key: 'battle:' + spot.part, url: BATTLE.parts[spot.part].url, loop: false, at: spot.at};
  const t = track();
  return {key: t.id, url: t.url, loop: true, at: resume[t.id] || 0};
}
// Point the media element at it. A new source cancels any pending play without suspending the context, so the next
// part of the mix can follow the last one without a fresh tap; sync() then plays it if music is wanted.
function load(force = false) {
  if (!media) return;
  const next = desired();
  if (next.key === loaded) { if (force) jump(next.at); updateMetadata(); return; }
  const was = partOf(loaded), here = Number.isFinite(media.currentTime) ? media.currentTime : 0;
  if (loaded && was < 0 && partOf(next.key) >= 0) resume[loaded] = here;
  if (was >= 0 && !playingMix()) spot = {part: was, at: here};
  if (partOf(next.key) < 0) delete resume[next.key];
  revision++; pending = 0;
  loaded = next.key; media.loop = next.loop; media.src = next.url;
  jump(next.at);
  updateMetadata();
}
// Before a new source's metadata loads, setting currentTime sets where it starts (its default playback start position),
// so it never plays from 0 first. Browsers without that get the seek once the metadata arrives.
function jump(at) {
  seekTo = media.readyState < 1 && at > 0 ? at : null;
  try { media.currentTime = at; } catch (_) {}
}
// A battle view that becomes visible for the first time rolls a new start in the mix.
function checkScene() {
  const battle = [...clients].find(c => c.visible && c.battle), now = battle ? 'battle' : visible() ? 'hub' : null;
  if (battle && battle !== lastBattle) { lastBattle = battle; shown = now; ownSong = false; spot = randomSpot(); load(true); return; }
  if (now === shown) return;
  shown = now;
  if (now) load();
}

function halt(reset = false) {
  audibleEffects.clear();
  if (effectGain) {
    effectGain.gain.cancelScheduledValues(audio.currentTime);
    effectGain.gain.setValueAtTime(1, audio.currentTime);
  }
  revision++; pending = 0;
  if (media) { media.pause(); if (reset) { try { media.currentTime = 0; } catch (_) {} } }
  if (audio) {
    master.gain.cancelScheduledValues(audio.currentTime); master.gain.setValueAtTime(0, audio.currentTime);
    if (audio.state === 'running') audio.suspend().catch(() => {});
  }
  notify();
}
function sync() {
  checkScene();
  if (!wanted()) { halt(); return; }
  if (!audio) { notify(); return; }
  ownSystem();
  master.gain.setTargetAtTime(volume / 100, audio.currentTime, .04);
  if (pending || (audio.state === 'running' && !media.paused)) { notify(); return; }
  const request = ++revision; pending = request; failure = '';
  // Invoke both in the original gesture; waiting for resume first loses iOS's play permission.
  Promise.all([audio.resume(), media.play()]).then(() => {
    if (request !== revision) return;
    pending = 0;
    if (!wanted()) halt(); else notify();
  }, () => {
    if (request !== revision) return; // a mute, hide, profile change or new source canceled that play
    failure = media.error ? 'The track couldn’t load. Pause, then play to retry.' : 'Playback was blocked. Pause, then play to retry.';
    halt();
  });
  notify();
}
// Called synchronously from a tap or keypress. No media element or MP3 request before it.
export function start() {
  if (!rivalsUpdated() || !visible()) return;
  started = true;
  if (!enabled || !volume) { sync(); return; }
  if (!audio) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) { notify(); return; }
    try {
      ownSystem();
      audio = new AC(); master = audio.createGain(); master.gain.value = 0;
      effectGain = audio.createGain();
      master.connect(effectGain); effectGain.connect(audio.destination);
      media = new Audio(); media.preload = 'none'; loaded = '';
      checkScene(); load();
      audio.createMediaElementSource(media).connect(master);
      media.addEventListener('loadedmetadata', () => {
        if (seekTo == null) return;
        const at = seekTo; seekTo = null;
        if (Math.abs(media.currentTime - at) > .5) { try { media.currentTime = Math.min(at, Math.max(0, (media.duration || at) - 1)); } catch (_) {} }
      });
      media.addEventListener('ended', () => {
        const part = partOf(loaded);
        if (part < 0) return;
        spot = {part: (part + 1) % BATTLE.parts.length, at: 0}; load(); sync();
      });
      media.addEventListener('playing', () => { if (!wanted()) halt(); else notify(); });
      media.addEventListener('pause', notify); media.addEventListener('waiting', notify);
      for (const name of ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked']) media.addEventListener(name, notify);
      media.addEventListener('error', () => { failure = 'The track couldn’t load. Pause, then play to retry.'; halt(); });
      audio.onstatechange = () => {
        if (audio.state === 'interrupted' || !wanted()) halt();
        else if (audio.state === 'suspended' && !pending && !failure) sync();
        else notify();
      };
    } catch (_) {
      media?.pause(); audio?.close().catch(() => {}); audio = null; media = null; effectGain = null; loaded = '';
      releaseSystem();
      failure = 'Music is unavailable in this browser.'; notify(); return;
    }
  }
  if (media.error) media.load();
  sync();
}
export function setEnabled(value) {
  if (!rivalsUpdated()) return;
  enabled = !!value; save(); start();
}
export function setVolume(value) {
  if (!rivalsUpdated() || !Number.isFinite(Number(value))) return;
  volume = Math.max(0, Math.min(100, Math.round(Number(value)))); save(); start();
}
// The battle mix can be picked only in a battle, to go back to it after choosing a song there.
export function selectTrack(id) {
  if (!rivalsUpdated() || !visible()) return;
  if (id === BATTLE.id) {
    if (shown !== 'battle') return;
    if (ownSong) { halt(); ownSong = false; load(); }
  } else {
    if (!TRACKS.some(t => t.id === id)) return;
    const before = media ? loaded : '';
    selected = id;
    if (shown === 'battle') ownSong = true;
    if (media && desired().key !== before) { halt(); load(); }
    updateMetadata();
  }
  enabled = true; save(); start();
}
export function seek(seconds) {
  const duration = state().duration;
  if (!rivalsUpdated() || !visible() || !media || !duration || !Number.isFinite(Number(seconds))) return;
  const t = Math.max(0, Math.min(duration, Number(seconds))), part = partOf(loaded);
  if (part < 0) { try { media.currentTime = t; } catch (_) {} notify(); return; }
  const to = partAt(t), at = Math.max(0, Math.min(t - STARTS[to], BATTLE.parts[to].seconds - .5));
  if (to === part) { try { media.currentTime = at; } catch (_) {} notify(); return; }
  spot = {part: to, at}; load(); sync();
}
// Skip: the next song in the jukebox, or while the battle mix plays, its next part.
export function skipTrack() {
  if (!rivalsUpdated() || !visible()) return;
  if (playingMix()) {
    halt(true);
    spot = {part: ((media ? Math.max(0, partOf(loaded)) : spot.part) + 1) % BATTLE.parts.length, at: 0}; load(true);
  } else {
    const next = TRACKS[(TRACKS.findIndex(t => t.id === selected) + 1) % TRACKS.length];
    halt(true);
    selected = next.id; load(); updateMetadata();
  }
  save(); start();
}
function save() { try { localStorage.setItem(KEY(), JSON.stringify({enabled, volume, track: selected})); } catch (_) {} }
const visibility = () => sync();
const pageHide = () => { away = true; halt(); };
const pageShow = () => { away = false; sync(); };
const storage = e => {
  if (e.key !== KEY() && e.key !== null) return;
  const before = loaded; read();
  if (media && desired().key !== before) { halt(true); load(); }
  sync();
};

// Mounted routes can coexist in the navigation stack; only visible Rivals views own playback.
// kind 'battle' marks the battle view, which plays the battle mix.
export function attach(el, isVisible = true, kind = 'hub') {
  const client = {visible: isVisible, battle: kind === 'battle'}; clients.add(client);
  if (clients.size === 1) {
    read(); load();
    away = false;
    offProfile = data.subscribe(type => { if (type === 'me') { started = false; halt(true); releaseSystem(); read(); failure = ''; resume = {}; load(); notify(); } });
    document.addEventListener('visibilitychange', visibility);
    addEventListener('pagehide', pageHide); addEventListener('pageshow', pageShow); addEventListener('storage', storage);
  }
  const gesture = e => {
    if (!client.visible || !e.isTrusted || (e.type === 'keydown' && !['Enter', ' '].includes(e.key))) return;
    if (e.target.closest('[data-dy-exit], [data-back], [data-dy-sound], [data-dy-music-menu], [data-dy-music-skip]')) return;
    start();
  };
  el.addEventListener('click', gesture, true); el.addEventListener('keydown', gesture, true);
  sync();
  return {
    visible(value) { client.visible = !!value; sync(); },
    stop() {
      clients.delete(client); el.removeEventListener('click', gesture, true); el.removeEventListener('keydown', gesture, true);
      if (client === lastBattle) lastBattle = null;
      if (!clients.size) {
        offProfile?.(); offProfile = null;
        document.removeEventListener('visibilitychange', visibility);
        removeEventListener('pagehide', pageHide); removeEventListener('pageshow', pageShow); removeEventListener('storage', storage);
        started = false; shown = null; ownSong = false; halt(true);
      } else sync();
    }
  };
}
