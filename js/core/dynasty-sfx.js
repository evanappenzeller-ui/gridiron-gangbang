import {rivalsUpdated} from './features.js';
// Original, locally synthesized Rivals Foley and stingers. No downloads or game-save writes.
import * as data from './data.js';
import {profileKey} from './realm-active.js';
const KEY = () => `gg-rivals-sfx:${profileKey()}:v1`;
const clients = new Set(), listeners = new Set(), voices = new Set(), buffers = new Map();
let ctx, master, offProfile, enabled = true, volume = 55, unlocked = false, away = false;
let epoch = 0, idleTimer, failure = '';
const supported = () => !!(globalThis.AudioContext || globalThis.webkitAudioContext);
const visible = () => [...clients].some(c => c.visible);
const allowed = () => rivalsUpdated() && visible() && !document.hidden && !away && enabled && volume > 0;
let preferenceKey;
function read() {
  preferenceKey = KEY();
  enabled = true; volume = 55;
  try { const s = JSON.parse(localStorage.getItem(KEY()));
    if (typeof s?.enabled === 'boolean') enabled = s.enabled;
    if (Number.isFinite(s?.volume)) volume = Math.max(0, Math.min(100, Math.round(s.volume)));
  } catch (_) {}
}
read();
export const CUES = Object.freeze(['select', 'card', 'tear', 'coin', 'impact', 'heavy', 'miss', 'power', 'turn', 'knockout', 'common', 'epic', 'legendary', 'mythic', 'victory', 'defeat', 'draw']);
export const eventCue = e => e.k === 'attack' ? e.missed || !e.dmg ? 'miss' : e.knockout ? 'knockout' : e.dmg >= 70 ? 'heavy' : 'impact'
  : ['item', 'coach', 'stadium', 'evolve', 'energy'].includes(e.k) ? 'power' : 'card';
export const revealCue = tier => tier >= 4 ? 'mythic' : tier === 3 ? 'legendary' : tier === 2 ? 'epic' : 'common';
export function state() {
  if (preferenceKey !== KEY()) read(); return {enabled, volume, supported: supported(), failure}; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const notify = () => listeners.forEach(fn => fn());
function save() { try { localStorage.setItem(KEY(), JSON.stringify({enabled, volume})); } catch (_) {} notify(); }
export function setEnabled(value) {
  if (!rivalsUpdated()) return;
  enabled = !!value; if (!enabled) silence(); save();
}
export function setVolume(value) {
  if (!rivalsUpdated() || !Number.isFinite(Number(value))) return;
  volume = Math.max(0, Math.min(100, Math.round(Number(value))));
  if (master && ctx) master.gain.setTargetAtTime(volume / 100 * .65, ctx.currentTime, .015);
  if (!volume) silence(); save();
}
function idle() {
  clearTimeout(idleTimer);
  if (!voices.size && ctx?.state === 'running') idleTimer = setTimeout(() => {
    if (!voices.size && ctx?.state === 'running') ctx.suspend().catch(() => {});
  }, 35);
}
function stopVoice(v) {
  if (v.stopped) return;
  v.stopped = true;
  try { v.source.stop(); } catch (_) {}
  v.source.disconnect(); v.pan?.disconnect(); voices.delete(v); idle();
}
function silence() {
  epoch++; clearTimeout(idleTimer);
  [...voices].forEach(stopVoice);
  if (ctx?.state === 'running') ctx.suspend().catch(() => {});
}
// Buffers are created once on first use. Envelopes start/end at zero; peaks stay below .7.
// Noise supplies paper/foil and contact texture; layered pitched partials supply reward cues.
function buffer(name) {
  if (buffers.has(name)) return buffers.get(name);
  const lengths = {select:.075, card:.17, tear:.55, coin:.65, impact:.25, heavy:.4, miss:.24,
    power:.5, turn:.25, knockout:.65, common:.22, epic:.65, legendary:1, mythic:1.4, victory:1.55, defeat:.9, draw:.6};
  const duration = lengths[name], rate = ctx.sampleRate, b = ctx.createBuffer(1, Math.ceil(duration * rate), rate), out = b.getChannelData(0);
  let seed = 137; for (const c of name) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const noise = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const tone = (t, start, len, hz, gain = .2) => {
    const u = t - start; if (u < 0 || u >= len) return 0;
    const env = Math.min(1, u / .008) * Math.pow(1 - u / len, 2);
    return gain * env * (Math.sin(2*Math.PI*hz*u) + .22*Math.sin(2*Math.PI*hz*2*u));
  };
  const chords = {epic:[523,659,784], legendary:[523,659,784,1047], mythic:[523,659,784,1047,1319],
    victory:[392,523,659,784,1047], defeat:[392,330,262], draw:[392,523], power:[440,660,880], turn:[659,880], common:[880]};
  let low = 0;
  for (let i=0; i<out.length; i++) {
    const t=i/rate, x=t/duration, n=noise(); low = low*.86+n*.14;
    const env=Math.min(1,t/.004)*Math.pow(1-x,2); let y=0;
    if (name==='select') y=tone(t,0,duration,1100,.12);
    else if (name==='card' || name==='miss') y=(n-low)*.22*Math.sin(Math.PI*x)**2 + tone(t,.025,.09,180,.06);
    else if (name==='tear') y=(n-low)*.27*env*(.35+.65*Math.abs(Math.sin(t*170))) + low*.22*env;
    else if (name==='coin') y=[0,.09,.19,.31].reduce((v,s)=>v+tone(t,s,.29,2200-s*1400,.12),0);
    else if (['impact','heavy','knockout'].includes(name)) {
      const deep=name!=='impact'; y=(low*.8+n*.11)*env + Math.sin(2*Math.PI*((deep?92:145)*t-45*t*t))*env*.38;
      if(name==='knockout') y+=tone(t,.14,.48,196,.18)+tone(t,.22,.4,294,.13);
    } else {
      const notes=chords[name] || [660], step=name==='victory'?.19:name==='defeat'?.16:.085;
      y=notes.reduce((v,hz,j)=>v+tone(t,j*step,duration-j*step,hz,.19),0);
      if(['legendary','mythic','victory'].includes(name)) y+=low*.18*env+tone(t,0,duration,131,.12);
    }
    out[i]=Math.tanh(y)*.7*Math.min(1,(duration-t)/.008);
  }
  buffers.set(name,b); return b;
}
function unlock(e) {
  if (!e.isTrusted || !allowed() || !supported()) return;
  if (e.type === 'keydown' && !['Enter',' '].includes(e.key)) return;
  const target=e.target;
  if (![...clients].some(c => c.visible && c.el.contains(target)) && !target.closest?.('.pk-sheet')) return;
  try {
    if (!ctx) { ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)({latencyHint:'interactive'});
      master=ctx.createGain(); master.gain.value=volume/100*.65;
      const limiter=ctx.createDynamicsCompressor(); limiter.threshold.value=-6; limiter.knee.value=6;
      limiter.ratio.value=12; limiter.attack.value=.003; limiter.release.value=.1;
      master.connect(limiter); limiter.connect(ctx.destination);
    }
    unlocked=true; failure=''; const rev=epoch;
    ctx.resume().then(() => { if(rev!==epoch || !allowed()) silence(); else idle(); }).catch(() => {});
  } catch (_) { failure='Sound effects are unavailable in this browser.'; notify(); }
}
function play(client, name, {delay=0, pan=0} = {}) {
  if (!client.visible || !clients.has(client) || !allowed() || !unlocked || !ctx || !CUES.includes(name)) return () => {};
  const now=performance.now();
  if (now-(client.last.get(name) ?? -Infinity)<65) return () => {};
  client.last.set(name,now);
  const rev=epoch, clientRev=client.rev; let cancelled=false, v;
  const cancel=()=>{cancelled=true;if(v)stopVoice(v);};
  try {
    clearTimeout(idleTimer);
    const sample=buffer(name);
    ctx.resume().then(() => {
      if(cancelled || rev!==epoch || clientRev!==client.rev || !allowed() || !client.visible || !clients.has(client)) {idle();return;}
      while(voices.size>=6) stopVoice(voices.values().next().value);
      const source=ctx.createBufferSource(); source.buffer=sample;
      source.playbackRate.value=['card','tear','impact'].includes(name) ? .97+Math.random()*.06 : 1;
      const stereo=ctx.createStereoPanner?.(); if(stereo) {stereo.pan.value=Math.max(-.45,Math.min(.45,pan)); source.connect(stereo);stereo.connect(master);} else source.connect(master);
      v={source,pan:stereo,client,stopped:false}; voices.add(v);
      source.onended=()=>stopVoice(v);
      source.start(ctx.currentTime+Math.max(0,Math.min(2,delay)));
    }).catch(()=>{});
  } catch (_) { /* Audio must never block a game action. */ }
  return cancel;
}
function visibility() { if(document.hidden) silence(); }
function hide() { away=true; silence(); }
function show() { away=false; }
function storage(e) { if(e.key===KEY() || e.key===null) { read(); silence(); if(master)master.gain.value=volume/100*.65; notify(); } }
export function attach(el, isVisible=true) {
  const c={el,visible:isVisible,last:new Map(),rev:0}; clients.add(c);
  if(clients.size===1) {
    read(); if(master)master.gain.value=volume/100*.65;
    away=false;
    offProfile=data.subscribe(type=>{if(type==='me'){unlocked=false;silence();read();failure='';if(master)master.gain.value=volume/100*.65;notify();}});
    document.addEventListener('visibilitychange',visibility);
    for(const type of ['pointerdown','keydown','click']) document.addEventListener(type,unlock,true);
    addEventListener('pagehide',hide); addEventListener('pageshow',show); addEventListener('storage',storage);
  }
  const hush=()=>{c.rev++; [...voices].filter(v=>v.client===c).forEach(stopVoice); c.last.clear();};
  return {
    play:(name,options)=>play(c,name,options), hush,
    visible(value) { c.visible=!!value; if(!c.visible)hush(); if(!visible())silence(); },
    stop() {
      c.visible=false; hush(); clients.delete(c);
      if(!clients.size) {
        silence(); unlocked=false; offProfile?.();
        document.removeEventListener('visibilitychange',visibility);
        for(const type of ['pointerdown','keydown','click']) document.removeEventListener(type,unlock,true);
        removeEventListener('pagehide',hide); removeEventListener('pageshow',show); removeEventListener('storage',storage);
      }
    }
  };
}
