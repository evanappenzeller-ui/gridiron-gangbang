// Live Rivals battles (Nov 7 2026, Evan: "There should be a list of league members with an active status green dot means
// they are in the app. A request sent to them should show up as a push notification on their screen. If they are actively
// playing return man it will show up when they are done. This is meant to be a live matchup so both players need to be
// active for the game to play out"; first the Rivals group, every member and app user since Nov 10 2026: liveKeys).
//
// Presence, challenges and each side's moves ride on the phone's own board doc (players/{uid}, daily.js LB.put) as
// FIELD = {k (profile key), on (1 while the app is on screen), at, b ('' | 'rm' a Return Man run | 'match' a live
// battle), i (the challenge it sent: {id, to, at, d (deck), e (Energy Zone)}), r (its answer to one it got: {id, ok, at}),
// m (its side of the live battle: {id, o (opponent key), s (seat: 0 challenger, 1 accepter), d, e, mv [[n, move]], z (''
// | 'resign' | 'claim'), over, at})}. No new database rules: a phone writes only its own doc and reads everyone's, as
// the scoreboards do. The battle is core/dynasty-pocket.js's v7 rules replayed from the seed (the challenge id) and both
// sides' moves, merged by n (core/rivals-live-match.js). This module is light (no cards or engine): the app shell
// starts it for every profile, and only members' and app users' profiles publish anything.
import * as data from './data.js';
import * as daily from './daily.js';
import {dynastyKey} from './features.js';
import {profileKey, visitWho} from './realm-active.js';
import {busy as gameBusy} from './busy.js';

export const FIELD = 'rlv';
/** Heartbeats while on screen (more often during a live battle); a side unheard for ONLINE_MS shows offline, and a
 *  battle opponent unheard for AWAY_MS (or off screen) pauses the battle. CLAIM_MS away lets the other side take the win. */
export const BEAT_MS = 45000, MATCH_BEAT_MS = 15000, ONLINE_MS = 100000, AWAY_MS = 40000, INVITE_MS = 10 * 60000, CLAIM_MS = 120000;
// Who can play live (Nov 10 2026: Rivals is everyone's): every league member and app user. A guest plays Solo; with no
// stable identity a guest isn't listed or challenged here.
const LIVE = {ids: null, keys: []};
export function liveKeys() {
  if (LIVE.ids !== data.ids) { LIVE.ids = data.ids; LIVE.keys = Object.freeze([...data.ids.map(m => 'm_' + m), ...data.USERS.map(u => 'u_' + u.id)]); }
  return LIVE.keys;
}
const KEYS = {includes: k => liveKeys().includes(k), filter: fn => liveKeys().filter(fn)};
const MAX_MOVES = 400, ID = /^lv[a-z0-9]{4,22}$/;
const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const ids = (x, n) => (Array.isArray(x) ? x.filter(v => typeof v === 'string' && v.length <= 64).slice(0, n) : []);
const num = x => (Number.isFinite(Number(x)) ? Number(x) : 0);

// ---------------------------------------------------------------------------------------------------- reading sides
function cleanInvite(i) {
  i = obj(i);
  return i && ID.test(i.id || '') && KEYS.includes(i.to) ? {id: i.id, to: i.to, at: num(i.at), d: ids(i.d, 20), e: ids(i.e, 3)} : null;
}
function cleanAnswer(r) {
  r = obj(r);
  return r && ID.test(r.id || '') ? {id: r.id, ok: r.ok ? 1 : 0, at: num(r.at)} : null;
}
function cleanMove(x) {
  if (!Array.isArray(x) || !Number.isInteger(x[0]) || x[0] < 0 || x[0] > 9999 || !obj(x[1])) return null;
  try { return JSON.stringify(x[1]).length <= 400 ? [x[0], x[1]] : null; } catch (_) { return null; }
}
export function cleanMatch(m) {
  m = obj(m);
  if (!m || !ID.test(m.id || '') || !KEYS.includes(m.o) || ![0, 1].includes(m.s)) return null;
  return {id: m.id, o: m.o, s: m.s, d: ids(m.d, 20), e: ids(m.e, 3), mv: (Array.isArray(m.mv) ? m.mv : []).slice(0, MAX_MOVES).map(cleanMove).filter(Boolean),
    z: ['resign', 'claim'].includes(m.z) ? m.z : '', over: m.over ? 1 : 0, at: num(m.at)};
}
export function cleanSide(x) {
  x = obj(x);
  if (!x || !KEYS.includes(x.k)) return null;
  return {k: x.k, on: x.on ? 1 : 0, at: num(x.at), b: ['rm', 'match'].includes(x.b) ? x.b : '', i: cleanInvite(x.i), r: cleanAnswer(x.r), m: cleanMatch(x.m)};
}

// ---------------------------------------------------------------------------------------------------- this phone's side
let PROFILE = null, ME = null, dirty = false, sendT = 0, sentAt = 0, sending = false, started = false, lastBusy = '';
const subs = new Set(), dismissed = new Set();
const LOCAL = key => `gg-rlv-${key}`;
const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
const nameOf = key => visitWho(key, null)?.name || 'A Rivals manager';
export const nameFor = nameOf;
/** Whether a profile key may play live battles (a league member or app user: liveKeys). */
export const enabled = (key = profileKey()) => !!key && dynastyKey(key) && KEYS.includes(key);
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(why, detail) { [...subs].forEach(fn => { try { fn(why, detail); } catch (e) { console.error(e); } }); }
function readLocal(key) {
  try {
    const o = obj(JSON.parse(localStorage.getItem(LOCAL(key)) || 'null')) || {};
    const i = cleanInvite(o.i);
    return {i: i && Date.now() - i.at < INVITE_MS ? i : null, r: cleanAnswer(o.r), m: cleanMatch(o.m)};
  } catch (_) { return {i: null, r: null, m: null}; }
}
function save() { try { if (ME) localStorage.setItem(LOCAL(ME.k), JSON.stringify({i: ME.i, r: ME.r, m: ME.m})); } catch (_) {} }
function self() {
  const key = profileKey();
  if (key !== PROFILE) {
    const had = PROFILE !== null;
    PROFILE = key;
    if (enabled(key)) { const o = readLocal(key); ME = {k: key, on: visible() ? 1 : 0, at: Date.now(), b: '', i: o.i, r: o.r, m: o.m}; dirty = true; }
    else { ME = null; if (had) dirty = true; }
  }
  return ME;
}
const activeMatch = () => (ME && ME.m && !ME.m.over && !ME.m.z ? ME.m : null);
const busyNow = () => gameBusy() || (activeMatch() ? 'match' : '');
/** What keeps this player from a challenge right now ('rm' a Return Man run, 'match' a live battle, '' free). */
export const myBusy = () => (self() ? busyNow() : '');
export const myKey = () => (self() ? ME.k : '');
const boardKnown = () => !!(daily.LB.ready && daily.LB.synced && !daily.LB.off && daily.LB.uid && daily.LB.put);
function publish(delay = 250) {
  self();
  dirty = true; clearTimeout(sendT);
  sendT = setTimeout(flush, delay);
}
/** Sends this phone's side to its board doc (replaced whole). Retried on the next board event when it can't go yet. */
export async function flush() {
  clearTimeout(sendT); sendT = 0;
  if (!dirty || sending || !boardKnown()) return false;
  const LB = daily.LB, own = (LB.all || []).find(p => p.id === LB.uid);
  self();
  if (!ME && !(own && own[FIELD])) { dirty = false; return true; }
  if (ME) { ME.at = Date.now(); ME.on = visible() ? 1 : 0; ME.b = busyNow(); }
  const body = {[FIELD]: ME ? JSON.parse(JSON.stringify(ME)) : null}, fields = [FIELD];
  if (!own) {
    const u = data.user();
    Object.assign(body, {nick: (data.me() ? data.name(data.me()) : (u && (u.board || u.name)) || data.guest() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0});
    fields.push('nick', 'g', 'total');
  }
  dirty = false; sending = true; sentAt = Date.now();
  let ok = true;
  try { await LB.put(body, fields); } catch (_) { ok = false; dirty = true; }
  sending = false;
  if (dirty) { clearTimeout(sendT); sendT = setTimeout(flush, ok ? 120 : 5000); }
  return ok;
}

// ---------------------------------------------------------------------------------------------------- everyone else
let cacheOf = null, cacheSides = new Map(), cacheAll = [];
const heard = new Map(), inviteSeen = new Map();
/** Every other phone's side (a manager may have the app open on two devices), and the freshest per profile key. */
function sides() {
  const all = daily.LB.all;
  if (all === cacheOf) return cacheSides;
  const out = new Map(), list = [], uid = daily.LB.uid, now = Date.now();
  for (const p of all || []) {
    if (!p || p.id === uid) continue;
    const s = cleanSide(p[FIELD]);
    if (!s) continue;
    s.doc = p.id; list.push(s);
    // (heard: when this phone saw each device's latest beat arrive, so another phone's clock never decides who's online)
    const h = heard.get(p.id);
    if (!h) heard.set(p.id, {at: s.at, local: Math.min(now, s.at)});
    else if (h.at !== s.at) heard.set(p.id, {at: s.at, local: now});
    if (s.i && !inviteSeen.has(s.i.id)) inviteSeen.set(s.i.id, h ? now : Math.min(now, s.i.at));
    const prev = out.get(s.k);
    if (!prev || ageOf(s) < ageOf(prev)) out.set(s.k, s);
  }
  cacheOf = all; cacheSides = out; cacheAll = list;
  return out;
}
const allSides = () => (sides(), cacheAll);
function ageOf(s) { const h = heard.get(s.doc); return Math.max(0, Date.now() - (h ? h.local : s.at)); }
const presenceOf = s => (s ? {online: !!s.on && ageOf(s) < ONLINE_MS, busy: s.b, age: ageOf(s), side: s} : {online: false, busy: '', age: Infinity, side: null});
export const side = key => sides().get(key) || null;
/** {online, busy, age (ms since its last beat reached this phone), side} for a profile key (its liveliest device). */
export function presence(key) {
  const list = allSides().filter(s => s.k === key);
  const on = list.filter(s => s.on && ageOf(s) < ONLINE_MS).sort((a, b) => ageOf(a) - ageOf(b));
  return presenceOf(on.find(s => s.b) || on[0] || side(key));
}
/** Everyone else who plays live: [{key, name, member, online, busy, age}], online first. */
export function players() {
  const me = myKey();
  return KEYS.filter(k => k !== me).map(k => {
    const p = presence(k);
    return {key: k, name: nameOf(k), member: k.startsWith('m_') ? k.slice(2) : null, online: p.online, busy: p.online ? p.busy : '', age: p.age};
  }).sort((a, b) => b.online - a.online || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------------- challenges
const newId = () => 'lv' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);
/** Challenge a Rivals manager now, with deck {ids, energy}. {ok, why, id}. */
export function invite(key, deck) {
  if (!self()) return {ok: false, why: 'Live battles are for league members and app users.'};
  if (!KEYS.includes(key) || key === ME.k) return {ok: false, why: 'Choose another manager.'};
  if (activeMatch()) return {ok: false, why: 'Finish your live battle first.'};
  if (!deck || !Array.isArray(deck.ids) || !Array.isArray(deck.energy)) return {ok: false, why: 'Your deck isn’t ready.'};
  const p = presence(key);
  if (!p.online) return {ok: false, why: `${nameOf(key)} isn’t in the app right now.`};
  if (p.busy === 'match') return {ok: false, why: `${nameOf(key)} is already in a live battle.`};
  const id = newId();
  ME.i = {id, to: key, at: Date.now(), d: deck.ids.slice(0, 20), e: deck.energy.slice(0, 3)};
  save(); publish(0); emit('sent', {id});
  return {ok: true, id};
}
export function cancelInvite() {
  if (!self() || !ME.i) return;
  ME.i = null; save(); publish(0); emit('cancel');
}
/** The challenge this phone sent and is waiting on: {id, to, name, presence, expired} or null. */
export function outgoing() {
  if (!self() || !ME.i) return null;
  return {...ME.i, name: nameOf(ME.i.to), presence: presence(ME.i.to), expired: Date.now() - ME.i.at > INVITE_MS};
}
/** Challenges waiting for this profile: [{id, from, name}] (what the notice shows; not while you're in a live battle). */
export function incoming() {
  if (!self() || activeMatch()) return [];
  const out = [];
  allSides().forEach(s => {
    const k = s.k;
    if (!s.i || s.i.to !== ME.k || dismissed.has(s.i.id) || ME.r?.id === s.i.id || ME.m?.id === s.i.id || out.some(x => x.id === s.i.id)) return;
    if (!presenceOf(s).online || Date.now() - (inviteSeen.get(s.i.id) || s.i.at) > INVITE_MS) return;
    out.push({id: s.i.id, from: k, name: nameOf(k)});
  });
  return out;
}
/** Accept (with your deck {ids, energy}) or decline challenge id. {ok, why}. */
export function answer(id, ok, deck = null) {
  if (!self()) return {ok: false, why: 'Live battles are for league members and app users.'};
  let from = null;
  allSides().forEach(s => { if (s.i && s.i.id === id && s.i.to === ME.k) from = s.k; });
  if (!from) return {ok: false, why: 'That challenge is no longer open.'};
  if (ok && activeMatch()) return {ok: false, why: 'Finish your live battle first.'};
  if (ok && (!deck || !Array.isArray(deck.ids))) return {ok: false, why: 'Your deck isn’t ready.'};
  ME.r = {id, ok: ok ? 1 : 0, at: Date.now()};
  if (ok) { ME.m = {id, o: from, s: 1, d: deck.ids.slice(0, 20), e: deck.energy.slice(0, 3), mv: [], z: '', over: 0, at: Date.now()}; ME.i = null; }
  save(); publish(0); emit(ok ? 'accepted' : 'answered', {id});
  return {ok: true, id};
}
/** Hide a challenge without answering it (it stays open for the sender until it expires). */
export function dismiss(id) { dismissed.add(id); emit('dismiss', {id}); }

// ---------------------------------------------------------------------------------------------------- the live battle
/** Both sides of live battle id as this phone sees them, or null when it isn't yours:
 *  {me, them (null until it arrives), opp: {key, name}, present (on screen and in this battle), presence, theirInvite}. */
export function matchSides(id) {
  if (!self() || !ME.m || ME.m.id !== id) return null;
  // (their side of this battle is on the device that holds it: the freshest such)
  const me = ME.m, list = allSides().filter(s => s.k === me.o);
  const t = list.filter(s => s.m && s.m.id === id && s.m.o === ME.k).sort((a, b) => ageOf(a) - ageOf(b))[0] || null;
  const inv = list.find(s => s.i && s.i.id === id) || null, p = presenceOf(t);
  return {me, them: t ? t.m : null, opp: {key: me.o, name: nameOf(me.o)}, present: !!t && p.online && p.age < AWAY_MS, presence: p,
    theirInvite: inv ? inv.i : null};
}
/** The live battle this profile is in (not finished), or null. */
export const current = () => (self() ? activeMatch() : null);
export function addMove(id, n, move) {
  if (!self() || !ME.m || ME.m.id !== id || ME.m.over || ME.m.z || ME.m.mv.length >= MAX_MOVES) return false;
  ME.m.mv.push([n, JSON.parse(JSON.stringify(move))]); ME.m.at = Date.now();
  save(); publish(0); emit('move', {id});
  return true;
}
export function setOutcome(id, z) {
  if (!self() || !ME.m || ME.m.id !== id || ME.m.over || ME.m.z || !['resign', 'claim'].includes(z)) return false;
  ME.m.z = z; ME.m.over = 1; ME.m.at = Date.now();
  save(); publish(0); emit('outcome', {id});
  return true;
}
/** The battle is decided (by the rules or the other side): this side stops counting as busy. */
export function markOver(id) {
  if (!self() || !ME.m || ME.m.id !== id || ME.m.over) return;
  ME.m.over = 1; save(); publish(400);
}

// ---------------------------------------------------------------------------------------------------- keeping it current
function onBoard() {
  sides();
  const me = self(), own = (daily.LB.all || []).find(p => p.id === daily.LB.uid);
  if (!me && own && own[FIELD]) dirty = true; // (an earlier Rivals profile on this phone: no longer here)
  if (me && me.i) {
    const t = allSides().find(s => s.k === me.i.to && s.r && s.r.id === me.i.id) || null, r = t ? t.r : null;
    if (r && r.ok && t.m && t.m.id === me.i.id && t.m.o === me.k && !activeMatch()) {
      const i = me.i;
      me.m = {id: i.id, o: i.to, s: 0, d: i.d, e: i.e, mv: [], z: '', over: 0, at: Date.now()}; me.i = null;
      save(); publish(0); emit('start', {id: i.id, name: nameOf(i.to)});
    } else if (r && !r.ok) {
      const nm = nameOf(me.i.to); me.i = null;
      save(); publish(0); emit('declined', {name: nm});
    }
  }
  if (me && !own && !dirty) dirty = true; // (first sync: publish presence)
  if (dirty && !sending && !sendT) flush();
  emit('board');
}
/** Re-read everyone's sides (the board listener does this on each change; the checks call it with a stand-in board). */
export function refresh() { onBoard(); }
function tick() {
  const me = self();
  if (!me) return;
  if (!visible()) return;
  const b = busyNow(), beat = activeMatch() ? MATCH_BEAT_MS : BEAT_MS;
  if (b !== lastBusy) { lastBusy = b; publish(0); }
  else if (Date.now() - sentAt > beat && !sending) publish(0);
  emit('tick');
}
function onVisibility() {
  if (!self()) return;
  ME.on = visible() ? 1 : 0;
  publish(0);
  if (!visible()) flush();
  emit('visibility');
}
/** Started once by the app shell (app.js) with its navigate(path). Loads the challenge notice when the profile may play. */
export function start({nav} = {}) {
  if (started) return;
  started = true;
  daily.subscribe(type => { if (type === 'lb') onBoard(); });
  data.subscribe(type => { if (type === 'me') { lastBusy = ''; self(); publish(0); emit('profile'); } });
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pagehide', () => { if (self()) { ME.on = 0; dirty = true; flush(); } });
  setInterval(tick, 3000);
  self();
  if (daily.LB.ready) onBoard();
  import('../views/rivals-live-notice.js').then(m => m.start({nav})).catch(e => console.error(e));
}
