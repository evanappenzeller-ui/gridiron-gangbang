// Gridiron Dynasty's battles between players (the owner's asks, Oct 28 2026: multiplayer only, "in turns like chess",
// Pokémon TCG Pocket's rules: core/dynasty-battle.js). No server: each player keeps his side of every match on his own
// board doc (players/{uid}, daily.js) as dyb[profileKey][match id] = {o (the opponent's profile key), k (his deck: 20
// ids), m (his moves: his setup, then one list a turn), ch (1: he challenged), z ('' | 'decline' | 'cancel' | 'resign' |
// 'claim': a win claimed from an opponent who left it 72 hours), c (made), at (changed)}. The game is the replay of both
// sides' moves from the match id (core/dynasty-battle.js replay), so every phone sees the same game; your moves this
// turn wait here (pending) until the turn ends, then go up together.
// A challenge is a match with no answer; it's on the other player's list (incoming) till they accept with their deck
// or decline. Whose matches show follows the scoreboards' rule (CLAUDE.md): everyone's, read from daily.LB.raw (your
// own saved copy found in LB.all, as Keepfall's is). A finished match pays once (core/dynasty.js payBattle).
import * as daily from './daily.js';
import * as data from './data.js';
import {profileKey, visitWho} from './realm-active.js';
import * as D from './dynasty.js';
import * as B from './dynasty-battle.js';
import {dynastyKey} from './features.js';

export const FIELD = 'dyb';
export const IDLE_MS = 72 * 3600e3;
const KEEP_MS = 7 * 86400e3; // (a finished or closed match stays this long)
const LOCAL = key => `gg-dyb-${key}`, PEND = key => `gg-dyb-pend-${key}`;
export const TURNS_KEY = key => `gg-dyb-turns-${key}`;

let PROFILE = '', MINE = null, PENDING = {}, dirty = false, saveT = 0;
const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
const emit = why => subs.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } });
const allDocs = () => daily.LB.all || daily.LB.raw || [];
const boardKnown = () => !!(daily.LB.ready && daily.LB.synced && !daily.LB.off && daily.LB.uid);
const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

/** A match side as it should be, or null. */
export function cleanSide(M) {
  if (!M || typeof M !== 'object' || typeof M.o !== 'string' || !M.o) return null;
  return {o: M.o, k: Array.isArray(M.k) ? M.k.filter(x => typeof x === 'string').slice(0, B.DECK_SIZE) : [], m: Array.isArray(M.m) ? M.m.slice(0, 200) : [],
    ch: M.ch ? 1 : 0, z: ['decline', 'cancel', 'resign', 'claim'].includes(M.z) ? M.z : '', c: Number(M.c) || 0, at: Number(M.at) || 0, ...(M.done ? {done: 1} : {}),
    ...(Number(M.v) >= 2 ? {v: 2} : {})};
}
function selectProfile() {
  const key = profileKey();
  if (key !== PROFILE) { clearTimeout(saveT); MINE = null; PENDING = {}; dirty = false; PROFILE = key; }
  return key;
}
function readLocal() {
  try {
    const m = obj(JSON.parse(localStorage.getItem(LOCAL(PROFILE)) || 'null')), out = {};
    Object.entries(m).forEach(([k, v]) => { const s = cleanSide(v); if (s) out[k] = s; });
    PENDING = obj(JSON.parse(localStorage.getItem(PEND(PROFILE)) || 'null'));
    return out;
  } catch (_) { return {}; }
}
function writeLocal() {
  if (!PROFILE || !MINE) return;
  try { localStorage.setItem(LOCAL(PROFILE), JSON.stringify(MINE)); localStorage.setItem(PEND(PROFILE), JSON.stringify(PENDING)); } catch (_) {}
}
/** Your side of every match (here, or saved on the board from another phone of yours: the freshest of each). */
function mine() {
  selectProfile();
  if (!PROFILE) return {};
  if (!MINE) MINE = readLocal();
  for (const p of allDocs()) {
    if (PROFILE.startsWith('g_') && p.id !== daily.LB.uid) continue;
    Object.entries(obj(p && p[FIELD] && p[FIELD][PROFILE])).forEach(([mid, v]) => {
      const s = cleanSide(v);
      if (s && (!MINE[mid] || s.at > MINE[mid].at)) { MINE[mid] = s; if (PENDING[mid] && s.m.length !== (PENDING[mid].base || 0)) delete PENDING[mid]; }
    });
  }
  return MINE;
}
/** The other side of a match: key's side of mid, from the board as this phone may see it. */
function theirs(key, mid) {
  let best = null, doc = null;
  for (const p of daily.LB.raw || []) {
    const s = cleanSide(obj(p && p[FIELD] && p[FIELD][key])[mid]);
    if (s && (!best || s.at > best.at)) { best = s; doc = p; }
  }
  return best ? {side: best, doc} : null;
}
/** Who a profile key is, as this phone may show them ({name, member, guest}), or null. */
export function whoOf(key, doc = null) {
  if (doc) return visitWho(key, doc);
  for (const p of daily.LB.raw || []) { if (p && p[FIELD] && p[FIELD][key] || p && p[D.FIELD] && p[D.FIELD][key]) { const w = visitWho(key, p); if (w) return w; } }
  return key.startsWith('m_') || key.startsWith('u_') ? visitWho(key, null) : null;
}
const later = () => { clearTimeout(saveT); saveT = setTimeout(flush, 600); };
function save(why = 'change', quiet = false) {
  const now = Date.now();
  // (finished and closed matches go after a week)
  Object.keys(MINE).forEach(mid => { const M = MINE[mid]; if ((M.z || M.done) && now - M.at > KEEP_MS) delete MINE[mid]; });
  writeLocal(); dirty = true; later();
  if (!quiet) emit(why);
}
export async function flush() {
  clearTimeout(saveT);
  const LB = daily.LB, key = PROFILE, M = MINE;
  if (!dirty || !M || !key || key !== profileKey() || !D.mayPlay() || !LB.put || !boardKnown()) return false;
  dirty = false;
  const body = {[FIELD]: {[key]: JSON.parse(JSON.stringify(M))}}, fields = [FIELD + '.' + key];
  if (!allDocs().find(p => p.id === LB.uid)) {
    Object.assign(body, {nick: (data.me() ? data.name(data.me()) : data.guest() || '').trim().slice(0, 24), g: daily.asGuest(), total: 0});
    fields.push('nick', 'g', 'total');
  }
  try { await LB.put(body, fields); return true; } catch (_) { if (PROFILE === key) dirty = true; return false; }
}
try {
  data.subscribe(type => { if (type === 'me') { selectProfile(); emit('profile'); } });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('online', () => flush());
} catch (_) {}

// ---------------------------------------------------------------------------------------------------- matches
/** One match as it stands for you: {mid, opp: {key, name, member, guest}, me (your side), them (theirs or null), you (your
 *  seat: 0 challenger, 1 accepter), state 'invite' | 'sent' | 'closed' | 'setup' | 'yours' | 'theirs' | 'over', G (the
 *  game, your moves this turn in it), result 'w'|'l'|'d' (over), why (how it ended), bad (a move that didn't replay),
 *  idle (ms since their last move, while it's theirs), at}. */
function matchOf(mid, M) {
  const T = theirs(M.o, mid), who = whoOf(M.o, T && T.doc) || {name: 'Someone'};
  const base = {mid, opp: {key: M.o, name: who.name, member: who.member || null, guest: !!who.guest}, me: M, them: T && T.side, you: M.ch ? 0 : 1, at: Math.max(M.at, T ? T.side.at : 0)};
  const them = T && T.side;
  if (M.z === 'decline' || M.z === 'cancel' || (them && (them.z === 'decline' || them.z === 'cancel'))) return {...base, state: 'closed', why: M.z || them.z};
  if (!them) return {...base, state: 'sent'};
  const decks = base.you === 0 ? [M.k, them.k] : [them.k, M.k];
  const moves = base.you === 0 ? [M.m, them.m] : [them.m, M.m];
  // (the rules' version is the challenger's: core/dynasty-battle.js newGame)
  const {G, bad} = B.replay(mid, decks, moves, (base.you === 0 ? M : them).v || 1);
  // (your moves this turn, not sent yet)
  const pend = PENDING[mid];
  if (pend && pend.base === M.m.length && G.phase !== 'over') for (const m of pend.list) { if (!B.play(G, base.you, m).ok) break; }
  let result = null, why = G.over && G.over.why;
  if (G.phase === 'over') result = G.over.win === -1 ? 'd' : G.over.win === base.you ? 'w' : 'l';
  // (a resignation or a claimed win ends it whatever the board)
  if (M.z === 'resign' || them.z === 'claim') { result = 'l'; why = M.z === 'resign' ? 'resign' : 'claim'; }
  else if (them.z === 'resign' || M.z === 'claim') { result = 'w'; why = them.z === 'resign' ? 'resign' : 'claim'; }
  if (result) return {...base, state: 'over', G, result, why, bad};
  const mover = B.toMove(G);
  const state = G.phase === 'setup' ? (G.p[base.you].set ? 'theirs' : 'setup') : mover === base.you ? 'yours' : 'theirs';
  // (how long they've had it: since your last move)
  return {...base, state, G, bad, idle: state === 'theirs' ? Date.now() - M.at : 0};
}
/** Every match you're in or invited to, what's yours to do first. */
export function list() {
  if (!D.mayPlay() || D.status !== 'ready') return [];
  const M = mine(), out = [];
  // (Evan's and Ryan Stewart's matches only: features.js dynastyKey)
  Object.entries(M).forEach(([mid, s]) => { if (!dynastyKey(s.o)) return; try { out.push(matchOf(mid, s)); } catch (e) { console.error(e); } });
  // challenges to you: a challenger's side naming you, that you haven't answered
  for (const p of daily.LB.raw || []) {
    Object.entries(obj(p && p[FIELD])).forEach(([key, sides]) => {
      if (key === PROFILE || !dynastyKey(key)) return;
      Object.entries(obj(sides)).forEach(([mid, v]) => {
        const s = cleanSide(v);
        if (!s || s.o !== PROFILE || !s.ch || s.z || M[mid] || out.some(x => x.mid === mid)) return;
        const who = visitWho(key, p);
        if (who) out.push({mid, opp: {key, name: who.name, member: who.member || null, guest: !!who.guest}, me: null, them: s, you: 1, state: 'invite', at: s.at});
      });
    });
  }
  // (settle what's over: paid once)
  out.forEach(x => { if (x.state === 'over' && x.result) { D.payBattle(x.mid, x.result); if (!x.me.done) { x.me.done = 1; save('done', true); } } });
  const ORDER = {invite: 0, setup: 1, yours: 1, theirs: 2, sent: 3, over: 4, closed: 5};
  out.sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.at - a.at);
  try { localStorage.setItem(TURNS_KEY(PROFILE), String(out.filter(x => ['invite', 'setup', 'yours'].includes(x.state)).length)); } catch (_) {}
  return out;
}
export const get = mid => list().find(x => x.mid === mid) || null;
const newId = () => 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0');

/** Challenges another player (their profile key) with your deck. {ok, why, mid}. */
export function challenge(key) {
  const s = D.mine(), dk = D.deckOf(s);
  if (!dk.ok) return {ok: false, why: `Your deck isn’t ready: ${dk.why}`};
  if (!key || key === PROFILE || !dynastyKey(key)) return {ok: false, why: 'Pick someone to play.'};
  const open = list().filter(x => x.opp.key === key && !['over', 'closed'].includes(x.state));
  if (open.length) return {ok: false, why: 'You already have a match with them.', mid: open[0].mid};
  const mid = newId(), now = Date.now();
  mine()[mid] = {o: key, k: dk.ids, m: [], ch: 1, z: '', c: now, at: now, v: 2};
  save('challenge'); return {ok: true, mid};
}
/** Accepts a challenge with your deck. */
export function accept(mid) {
  const x = list().find(m => m.mid === mid && m.state === 'invite');
  if (!x) return {ok: false, why: 'That challenge is gone.'};
  const dk = D.deckOf();
  if (!dk.ok) return {ok: false, why: `Your deck isn’t ready: ${dk.why}`};
  const now = Date.now();
  mine()[mid] = {o: x.opp.key, k: dk.ids, m: [], ch: 0, z: '', c: now, at: now};
  save('accept'); return {ok: true, mid};
}
function mark(mid, z, ok) {
  const x = get(mid);
  if (!x || !ok(x)) return {ok: false, why: 'Not now.'};
  if (x.state === 'invite') mine()[mid] = {o: x.opp.key, k: [], m: [], ch: 0, z, c: Date.now(), at: Date.now()};
  else { mine()[mid].z = z; mine()[mid].at = Date.now(); }
  delete PENDING[mid]; save(z); return {ok: true};
}
export const decline = mid => mark(mid, 'decline', x => x.state === 'invite');
export const cancel = mid => mark(mid, 'cancel', x => x.state === 'sent');
export const resign = mid => mark(mid, 'resign', x => ['setup', 'yours', 'theirs'].includes(x.state));
/** Claims the win when they've left it their move for 72 hours. */
export const claim = mid => mark(mid, 'claim', x => x.state === 'theirs' && x.idle >= IDLE_MS);

/** Makes a move in a match (core/dynasty-battle.js play's moves). Your setup goes up at once; a turn's moves wait here
 *  until the turn ends (an attack or End turn), then go up together. {ok, why, sent}. */
export function move(mid, m) {
  const x = get(mid);
  if (!x || !['setup', 'yours'].includes(x.state)) return {ok: false, why: 'It isn’t your move.'};
  const M = mine()[mid], G = x.G, r = B.play(G, x.you, m);
  if (!r.ok) return r;
  if (m.a === 'setup') { M.m = [m]; M.at = Date.now(); delete PENDING[mid]; save('move'); return {ok: true, sent: true}; }
  const pend = PENDING[mid] && PENDING[mid].base === M.m.length ? PENDING[mid] : (PENDING[mid] = {base: M.m.length, list: []});
  pend.list.push(m);
  if (G.phase === 'over' || G.cur !== x.you) {
    M.m.push(pend.list); M.at = Date.now(); delete PENDING[mid]; save('move'); return {ok: true, sent: true};
  }
  writeLocal(); emit('pending'); return {ok: true, sent: false};
}
/** How many matches wait on you (the Daily Games shelf reads it without loading the cards). */
export const waiting = () => list().filter(x => ['invite', 'setup', 'yours'].includes(x.state)).length;
