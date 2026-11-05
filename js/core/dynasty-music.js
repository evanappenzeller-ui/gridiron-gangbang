// Original Rivals instrumental: 16 bars of pads, plucks, bass and stadium-style drums.
// Synthesized locally: no streaming, samples, downloads or game-save changes.
import * as data from './data.js';

const KEY = 'gg-rivals-music:m_evan:v1';
const clients = new Set(), listeners = new Set(), voices = new Set();
let enabled = true, volume = 35, started = false, away = false, failure = '';
let audio = null, master = null, noise = null, timer = null, pending = false, step = 0, next = 0;
let offProfile = null;
const STEP = 60 / 110 / 4;
const CHORDS = [[52, 55, 59, 62], [48, 52, 55, 59], [43, 47, 50, 57], [50, 54, 57, 61]];
const MELODY = [[76, null, 79, 83, 81, null, 79, 74], [76, null, 79, 83, 84, 83, 79, null],
  [74, null, 79, 81, 83, null, 81, 79], [78, null, 81, 85, 83, 81, 78, 74]];

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
  return {enabled, volume, playing: !!timer && audio?.state === 'running',
    supported: !!(globalThis.AudioContext || globalThis.webkitAudioContext), failure};
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function voice(source, nodes, time, duration) {
  const v = {source, nodes}; voices.add(v);
  source.onended = () => { voices.delete(v); source.disconnect(); nodes.forEach(n => n.disconnect()); };
  source.start(time); source.stop(time + duration);
}
function tone(midi, time, duration, level, type = 'triangle', attack = .015) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(level, time + attack);
  g.gain.exponentialRampToValueAtTime(.0001, time + duration);
  o.connect(g); g.connect(master); voice(o, [g], time, duration + .01);
}
function drum(time, snare = false) {
  const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
  s.buffer = noise; f.type = snare ? 'bandpass' : 'highpass'; f.frequency.value = snare ? 1700 : 7500;
  const duration = snare ? .14 : .045;
  g.gain.setValueAtTime(snare ? .16 : .045, time);
  g.gain.exponentialRampToValueAtTime(.0001, time + duration);
  s.connect(f); f.connect(g); g.connect(master); voice(s, [f, g], time, duration);
}
function kick(time) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.setValueAtTime(135, time); o.frequency.exponentialRampToValueAtTime(42, time + .16);
  g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(.32, time + .004);
  g.gain.exponentialRampToValueAtTime(.0001, time + .24);
  o.connect(g); g.connect(master); voice(o, [g], time, .25);
}
function beat(n, time) {
  const bar = Math.floor(n / 16), pos = n % 16, chord = Math.floor(bar / 2) % 4, notes = CHORDS[chord];
  if (pos === 0) notes.forEach(note => tone(note + 12, time, STEP * 15.8, .035, 'sine', .18));
  if (pos % 4 === 0 || pos === 10) tone(notes[0] - 12 + (pos === 10 ? 12 : 0), time, STEP * 2.5, .16, 'sine');
  if (pos % 2 === 0) {
    const note = MELODY[chord][pos / 2];
    if (note != null) {
      const pitch = note + (bar >= 8 && pos === 12 ? 12 : 0);
      tone(pitch, time, .36, .065);
      tone(pitch, time + STEP * 3, .25, .018, 'sine'); // quiet dotted delay
    }
    drum(time);
  }
  if (pos === 0 || pos === 8 || (bar % 2 && pos === 14)) kick(time);
  if (pos === 4 || pos === 12) { drum(time, true); tone(50, time, .1, .045, 'sine'); }
  if (bar % 4 === 3 && pos >= 14) drum(time, true);
}
function tick() {
  if (!wanted() || audio.state !== 'running') { halt(); return; }
  // A delayed frame never schedules a backlog of old notes.
  if (next < audio.currentTime) next = audio.currentTime + .02;
  while (next < audio.currentTime + .15) { beat(step, next); step = (step + 1) % 256; next += STEP; }
}
function halt() {
  clearInterval(timer); timer = null;
  if (audio) {
    master.gain.cancelScheduledValues(audio.currentTime); master.gain.setValueAtTime(0, audio.currentTime);
    for (const v of voices) { try { v.source.stop(); } catch (_) {} v.source.disconnect(); v.nodes.forEach(n => n.disconnect()); }
    voices.clear();
    if (audio.state === 'running') audio.suspend().catch(() => {});
  }
  notify();
}
function sync() {
  if (!wanted()) { halt(); return; }
  if (!audio || pending) { notify(); return; }
  if (audio.state === 'running') { run(); return; }
  pending = true;
  audio.resume().then(() => {
    pending = false;
    if (wanted() && audio.state === 'running') run(); else halt();
  }, () => { pending = false; failure = 'Tap Music on to try playback again.'; halt(); });
}
function run() {
  failure = '';
  master.gain.setTargetAtTime(volume / 100 * .7, audio.currentTime, .04);
  if (!timer) { next = audio.currentTime + .03; timer = setInterval(tick, 40); tick(); }
  notify();
}
// Must be called synchronously from a tap or keypress, including on iOS.
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
      noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .2), audio.sampleRate);
      const samples = noise.getChannelData(0);
      let seed = 72;
      for (let i = 0; i < samples.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; samples[i] = seed / 2147483648; }
      audio.onstatechange = () => {
        if (audio.state !== 'running') halt();
        if (audio.state === 'suspended' && wanted()) sync();
        else notify();
      };
    } catch (_) { audio?.close().catch(() => {}); audio = null; failure = 'Music is unavailable in this browser.'; notify(); return; }
  }
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
    offProfile = data.subscribe(type => { if (type === 'me') { started = false; step = 0; halt(); } });
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
        started = false; step = 0;
      }
      sync();
    }
  };
}
