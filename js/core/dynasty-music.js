import {rivalsUpdated} from './features.js';
// Rivals' owner-uploaded MP3. One streaming media element, with Web Audio volume control
// (including on iOS), shared by the hub and battle views. Never touches game saves.
import * as data from './data.js';
import {profileKey} from './realm-active.js';

const KEY = () => `gg-rivals-music:${profileKey()}:v1`;
export const TRACKS = Object.freeze([Object.freeze({id: 'sundress', title: 'Sundress', artist: 'A$AP Rocky',
  url: new URL('../../audio/rivals/sundress-v1.mp3', import.meta.url).href})]);
let selected = TRACKS[0].id;
const track = () => TRACKS.find(t => t.id === selected) || TRACKS[0];
const clients = new Set(), listeners = new Set();
let enabled = true, volume = 35, started = false, away = false, failure = '';
let audio = null, master = null, media = null, pending = 0, revision = 0, offProfile = null;
let systemOwned = false, previousType = null;
const systemActions = ['play', 'pause', 'stop', 'seekto', 'seekbackward', 'seekforward'];

let preferenceKey;
function read() {
  preferenceKey = KEY();
  enabled = true; volume = 35;
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
export function state() {
  if (preferenceKey !== KEY()) read();
  return {enabled, volume, track: track(), position: Number.isFinite(media?.currentTime) ? media.currentTime : 0,
    duration: Number.isFinite(media?.duration) ? media.duration : 0,
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
  try { if (navigator.mediaSession && globalThis.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({title: track().title, artist: track().artist, album: 'Gridiron Rivals'}); } catch (_) {}
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

function halt(reset = false) {
  revision++; pending = 0;
  if (media) { media.pause(); if (reset) { try { media.currentTime = 0; } catch (_) {} } }
  if (audio) {
    master.gain.cancelScheduledValues(audio.currentTime); master.gain.setValueAtTime(0, audio.currentTime);
    if (audio.state === 'running') audio.suspend().catch(() => {});
  }
  notify();
}
function sync() {
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
    if (request !== revision) return; // a mute, hide or profile change canceled that play
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
      master.connect(audio.destination);
      media = new Audio(); media.preload = 'none'; media.loop = true; media.src = track().url;
      audio.createMediaElementSource(media).connect(master);
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
      media?.pause(); audio?.close().catch(() => {}); audio = null; media = null;
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
export function selectTrack(id) {
  if (!rivalsUpdated() || !visible() || !TRACKS.some(t => t.id === id)) return;
  if (selected !== id) {
    halt(true); selected = id;
    if (media) media.src = track().url;
    updateMetadata();
  }
  enabled = true; save(); start();
}
export function seek(seconds) {
  const duration = state().duration;
  if (!rivalsUpdated() || !visible() || !media || !duration || !Number.isFinite(Number(seconds))) return;
  try { media.currentTime = Math.max(0, Math.min(duration, Number(seconds))); } catch (_) {}
  notify();
}
export function skipTrack() {
  if (!rivalsUpdated() || !visible()) return;
  const next = TRACKS[(TRACKS.findIndex(t => t.id === selected) + 1) % TRACKS.length];
  halt(true);
  if (selected !== next.id) {
    selected = next.id;
    if (media) media.src = next.url;
    updateMetadata();
  }
  save(); start();
}
function save() { try { localStorage.setItem(KEY(), JSON.stringify({enabled, volume, track: selected})); } catch (_) {} }
const visibility = () => sync();
const pageHide = () => { away = true; halt(); };
const pageShow = () => { away = false; sync(); };
const storage = e => {
  if (e.key !== KEY() && e.key !== null) return;
  const before = selected; read();
  if (before !== selected && media) { halt(true); media.src = track().url; updateMetadata(); }
  sync();
};

// Mounted routes can coexist in the navigation stack; only visible Rivals views own playback.
export function attach(el, isVisible = true) {
  const client = {visible: isVisible}; clients.add(client);
  if (clients.size === 1) {
    read();
    if (media && media.src !== track().url) media.src = track().url;
    away = false;
    offProfile = data.subscribe(type => { if (type === 'me') { started = false; halt(true); releaseSystem(); read(); failure = ''; if (media && media.src !== track().url) media.src = track().url; notify(); } });
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
      if (!clients.size) {
        offProfile?.(); offProfile = null;
        document.removeEventListener('visibilitychange', visibility);
        removeEventListener('pagehide', pageHide); removeEventListener('pageshow', pageShow); removeEventListener('storage', storage);
        started = false; halt(true);
      } else sync();
    }
  };
}
