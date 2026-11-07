// A live Rivals battle as the v7 battle screen reads a match (views/dynasty-pocket-battle.js; the same shape as
// core/dynasty-solo.js get): both sides' moves (core/rivals-live.js, one side on each phone's board doc) merged by their
// place in the game (n) and replayed through core/dynasty-pocket.js from the challenge id as the seed, so both phones
// play the same game. Only the manager whose turn it is can move, so the merged order is the order the moves were made;
// the two opening lineups go by seat (n 0 and 1). Both managers must be in the app: while the other one is away, the
// battle waits, and after CLAIM_MS away the one still here may take the win. Live battles pay nothing and never touch
// the Solo ladder, trophies or the collection.
import * as L from './rivals-live.js';
import * as POCKET from './dynasty-pocket.js';
import * as D from './dynasty.js';

export const isLive = mid => /^lv[a-z0-9]{4,22}$/.test(String(mid || ''));
export const subscribe = L.subscribe;
export const watchPlayback = () => () => {};
const REV = 2;
const cache = new Map(), awayAt = new Map(), waitAt = new Map();

function game(mid, S, you) {
  const them = S.them, key = JSON.stringify([S.me.mv.length, them.mv.length, S.me.d, them.d, S.me.e, them.e]);
  const hit = cache.get(mid);
  if (hit && hit.key === key) return hit;
  const decks = you === 0 ? [S.me.d, them.d] : [them.d, S.me.d], energy = you === 0 ? [S.me.e, them.e] : [them.e, S.me.e];
  const log = [...S.me.mv.map(([n, m]) => [n, you, m]), ...them.mv.map(([n, m]) => [n, 1 - you, m])].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let out;
  try { out = {key, G: POCKET.replay(mid, decks, log.map(([, w, m]) => [w, m]), {energy, rev: REV}), n: log.length}; }
  catch (e) { out = {key, G: null, n: log.length, why: e.message || 'A deck in this battle is not legal.'}; }
  cache.set(mid, out);
  return out;
}
/** Live battle mid for this profile: {mid, live, opp, you, G, state ('waiting' | 'setup' | 'yours' | 'theirs' | 'over' |
 *  'bad'), result, why, away ({ms, canClaim} while the other manager is gone), waiting ('join' | 'withdrawn')}. */
export function get(mid) {
  if (!isLive(mid) || D.status !== 'ready' || !D.mayPlay()) return null;
  const S = L.matchSides(mid);
  if (!S) return null;
  const you = S.me.s, key = S.opp.key;
  const base = {mid, live: true, opp: {key, name: S.opp.name, member: key.startsWith('m_') ? key.slice(2) : null, guest: false, cpu: null}, you, at: S.me.at};
  const now = Date.now();
  if (!S.them) {
    // (accepted, the challenger not in yet: their challenge still up means they're coming)
    if (!waitAt.has(mid)) waitAt.set(mid, now);
    const gone = S.me.z || S.me.over || (!S.theirInvite && now - waitAt.get(mid) > 30000) || (S.theirInvite && S.theirInvite.to !== L.myKey());
    if (gone && !S.me.over) L.markOver(mid);
    return {...base, G: null, state: gone ? 'over' : 'waiting', waiting: gone ? 'withdrawn' : 'join', result: null};
  }
  const {G, n, why: bad} = game(mid, S, you);
  let result = null, why = G && G.over ? G.over.why : '';
  if (S.me.z === 'resign') { result = 'l'; why = 'You conceded.'; }
  else if (S.them.z === 'resign') { result = 'w'; why = `${S.opp.name} conceded.`; }
  else if (S.me.z === 'claim') { result = 'w'; why = `${S.opp.name} left the battle.`; }
  else if (S.them.z === 'claim') { result = 'l'; why = 'You left the battle, so it went to your opponent.'; }
  else if (G && G.phase === 'over') result = G.winner === 'draw' ? 'd' : G.winner === you ? 'w' : 'l';
  if (!G || G.bad) {
    if (!S.me.over) L.markOver(mid);
    return {...base, G, n, state: 'bad', result, why: bad || 'This battle went out of sync. Start a new one.'};
  }
  if (result) {
    if (!S.me.over) L.markOver(mid);
    return {...base, G, n, state: 'over', result, why};
  }
  let away = null;
  if (!S.present) {
    if (!awayAt.has(mid)) awayAt.set(mid, now);
    const ms = Math.max(now - awayAt.get(mid), Number.isFinite(S.presence.age) ? S.presence.age - L.AWAY_MS : 0);
    away = {ms, canClaim: ms >= L.CLAIM_MS, left: Math.max(0, L.CLAIM_MS - ms)};
  } else awayAt.delete(mid);
  const state = G.phase === 'setup' ? (G.p[you].ready ? 'theirs' : 'setup') : POCKET.toMove(G) === you ? 'yours' : 'theirs';
  return {...base, G, n, state, away};
}
/** The live battle in play, as get() reads it, or null. */
export function current() { const m = L.current(); return m ? get(m.id) : null; }
/** Your move in live battle mid. {ok, why}. */
export function move(mid, m) {
  const x = get(mid);
  if (!x || !['setup', 'yours'].includes(x.state)) return {ok: false, why: 'It isn’t your move.'};
  if (x.away) return {ok: false, why: `Waiting for ${x.opp.name} to come back.`};
  const legal = POCKET.check(x.G, x.you, m);
  if (!legal.ok) return legal;
  // (the opening lineups go by seat, so either manager may set theirs first)
  if (!L.addMove(mid, x.G.phase === 'setup' ? x.you : x.n, m)) return {ok: false, why: 'That move could not be sent. Try again.'};
  return {ok: true, sent: true};
}
export function resign(mid) { return L.setOutcome(mid, 'resign') ? {ok: true} : {ok: false, why: 'This battle is over.'}; }
/** Take the win when the other manager has been away for CLAIM_MS. */
export function claim(mid) {
  const x = get(mid);
  if (!x || !x.away || !x.away.canClaim) return {ok: false, why: 'Your opponent can still come back.'};
  return L.setOutcome(mid, 'claim') ? {ok: true} : {ok: false, why: 'This battle is over.'};
}
/** Leave a battle that never started (the challenger never joined). */
export function leave(mid) { L.markOver(mid); return {ok: true}; }
