// Rivals' owner-uploaded MP3. One streaming media element, with Web Audio volume control
// (including on iOS), shared by the hub and battle views. Never touches game saves.
import * as data from './data.js';

const KEY = 'gg-rivals-music:m_evan:v1';
export const TRACK = Object.freeze({title: 'Sundress', artist: 'A$AP Rocky',
  url: new URL('../../audio/rivals/sundress-v1.mp3', import.meta.url).href});
const clients = new Set(), listeners = new Set();
let enabled = true, volume = 35, started = false, away = false, failure = '';
let audio = null, master = null, media = null, pending = 0, revision = 0, offProfile = null;

function read() {
  enabled = true; volume = 35;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(100, Math.round(saved.volume)));
  } catch (_) {}
}
read();
const visible = () => [...clients].some(c => c.visible);
const wanted = () => data.isOwner() && visible() && !document.hidden && !away && started && enabled && volume > 0;
const notify = () => listeners.forEach(fn => fn());
export function state() {
  return {enabled, volume, playing: !!media && !media.paused && media.readyState >= 3 && audio?.state === 'running',
    loading: !!pending, supported: !!(globalThis.AudioContext || globalThis.webkitAudioContext), failure};
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

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
  master.gain.setTargetAtTime(volume / 100 * .7, audio.currentTime, .04);
  if (pending || (audio.state === 'running' && !media.paused)) { notify(); return; }
  const request = ++revision; pending = request; failure = '';
  // Invoke both in the original gesture; waiting for resume first loses iOS's play permission.
  Promise.all([audio.resume(), media.play()]).then(() => {
    if (request !== revision) return;
    pending = 0;
    if (!wanted()) halt(); else notify();
  }, () => {
    if (request !== revision) return; // a mute, hide or profile change canceled that play
    failure = media.error ? 'The track couldn’t load. Turn music off and on to retry.' : 'Tap Music on to try playback again.';
    halt();
  });
  notify();
}
// Called synchronously from a tap or keypress. No media element or MP3 request before it.
export function start() {
  if (!data.isOwner() || !visible()) return;
  started = true;
  if (!enabled || !volume) { sync(); return; }
  if (!audio) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) { notify(); return; }
    try {
      audio = new AC(); master = audio.createGain(); master.gain.value = 0;
      const limiter = audio.createDynamicsCompressor();
      limiter.threshold.value = -12; limiter.ratio.value = 6;
      master.connect(limiter); limiter.connect(audio.destination);
      media = new Audio(); media.preload = 'none'; media.loop = true; media.src = TRACK.url;
      audio.createMediaElementSource(media).connect(master);
      media.addEventListener('playing', () => { if (!wanted()) halt(); else notify(); });
      media.addEventListener('pause', notify); media.addEventListener('waiting', notify);
      media.addEventListener('error', () => { failure = 'The track couldn’t load. Turn music off and on to retry.'; halt(); });
      audio.onstatechange = () => {
        if (audio.state === 'interrupted' || !wanted()) halt();
        else if (audio.state === 'suspended' && !pending && !failure) sync();
        else notify();
      };
    } catch (_) {
      media?.pause(); audio?.close().catch(() => {}); audio = null; media = null;
      failure = 'Music is unavailable in this browser.'; notify(); return;
    }
  }
  if (media.error) media.load();
  sync();
}
export function setEnabled(value) {
  if (!data.isOwner()) return;
  enabled = !!value; save(); start();
}
export function setVolume(value) {
  if (!data.isOwner() || !Number.isFinite(Number(value))) return;
  volume = Math.max(0, Math.min(100, Math.round(Number(value)))); save(); start();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({enabled, volume})); } catch (_) {} }
const visibility = () => sync();
const pageHide = () => { away = true; halt(); };
const pageShow = () => { away = false; sync(); };
const storage = e => { if (e.key === KEY || e.key === null) { read(); sync(); } };

// Mounted routes can coexist in the navigation stack; only visible Rivals views own playback.
export function attach(el, isVisible = true) {
  const client = {visible: isVisible}; clients.add(client);
  if (clients.size === 1) {
    away = false;
    offProfile = data.subscribe(type => { if (type === 'me') { started = false; halt(true); } });
    document.addEventListener('visibilitychange', visibility);
    addEventListener('pagehide', pageHide); addEventListener('pageshow', pageShow); addEventListener('storage', storage);
  }
  const gesture = e => {
    if (!client.visible || !e.isTrusted || (e.type === 'keydown' && !['Enter', ' '].includes(e.key))) return;
    if (e.target.closest('[data-dy-exit], [data-back]')) return;
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
