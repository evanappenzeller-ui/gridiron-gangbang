// The Lay's live legs: each manager's leg for the week, entered in the app (Firestore lay/{weekKey}/legs/{managerId}
// = {by, bet, me, nick, at}). One doc per manager per week: entering again replaces it. A friends' league, like the
// Press Room: any phone may enter, change or remove anyone's leg (so a leg can be typed in for someone off the app);
// `me` / `nick` say who entered it. Legs close at the week's Sunday 1:00 PM US Eastern kickoff (the app enforces it).
// Results (hit or miss) still come from data/lay.json; a manager's leg there wins over the live one.
// Dev hosts (fire.canWrite() false) write to a local stand-in (localStorage 'gg-dev-lay') merged over the live docs.
// No DOM here. Owner: LAY.
import * as data from './data.js';
import * as fire from './fire.js';
import * as week from './week.js';
import * as daily from './daily.js';

export const BET_MAX = 80;
const STORE = 'gg-dev-lay';
const standIn = () => !fire.canWrite();

// Legs close Sunday 1:00 PM US Eastern of the week (the Thursday opener + 3 days), when the main slate kicks off.
function easternOffset(y, m, d) {
  const nth = (mo, n) => { const dow = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(); return 1 + (7 - dow) % 7 + 7 * (n - 1); };
  const dst = (m > 3 && m < 11) || (m === 3 && d >= nth(3, 2)) || (m === 11 && d < nth(11, 1));
  return dst ? 4 : 5;
}
export function closeTime(year, wk) {
  const thu = week.lockTime(year, wk); // the week's first kickoff (a Thursday)
  const sun = new Date(Date.UTC(thu.getUTCFullYear(), thu.getUTCMonth(), thu.getUTCDate() - (thu.getUTCHours() < 6 ? 1 : 0) + 3));
  const y = sun.getUTCFullYear(), m = sun.getUTCMonth() + 1, d = sun.getUTCDate();
  return new Date(Date.UTC(y, m - 1, d, 13 + easternOffset(y, m, d), 0));
}
export const isClosed = (year, wk, at = week.now()) => at >= closeTime(year, wk).getTime();
export function closeText(year, wk) {
  return closeTime(year, wk).toLocaleString('en-US', {weekday: 'short', hour: 'numeric', minute: '2-digit'}).replace(/\s+/g, ' ');
}

// The week legs are being entered for: the league's next unplayed week (week.current()), or null off-season.
export function liveWeek() {
  const c = week.current();
  return c ? {year: c.year, week: c.week} : null;
}

// ---------------------------------------------------------------------------------------------- Reads
function readStore() {
  try { const o = JSON.parse(localStorage.getItem(STORE) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; }
}
function localLegs(key) {
  if (!standIn()) return [];
  const w = readStore()[key] || {};
  return Object.keys(w).map(id => Object.assign({}, w[id], {by: id}));
}
const subs = new Map(); // weekKey -> {docs, fns: Set, stop, err}
function emitKey(key) {
  const e = subs.get(key);
  if (e) [...e.fns].forEach(fn => { try { fn(legsFor(key), e.err); } catch (err) { console.error(err); } });
}
/** The legs entered for a week: [{by, bet, me, nick, at (ms)}], the stand-in's on top. */
export function legsFor(key) {
  const m = new Map();
  const e = subs.get(key);
  ((e && e.docs) || []).forEach(d => m.set(d.by, d));
  localLegs(key).forEach(d => m.set(d.by, d));
  return [...m.values()].filter(d => data.M[d.by] && typeof d.bet === 'string' && d.bet.trim());
}
/** Live legs of a week (year, wk): fn(legs, err) now and on every change. Returns unsubscribe. */
export function subscribe(year, wk, fn) {
  const key = week.weekKey(year, wk);
  let e = subs.get(key);
  if (!e) {
    e = {docs: [], fns: new Set(), stop: null, err: null};
    subs.set(key, e);
    fire.getFire().then(F => {
      if (!subs.has(key)) return;
      e.stop = F.fs.onSnapshot(F.fs.collection(F.db, 'lay', key, 'legs'), snap => {
        e.docs = snap.docs.map(d => {
          const v = d.data({serverTimestamps: 'estimate'});
          return Object.assign({}, v, {by: d.id, at: v.at && v.at.toMillis ? v.at.toMillis() : null});
        });
        e.err = null;
        emitKey(key);
      }, err => { e.err = fire.codeOf(err); emitKey(key); });
    }, err => { e.err = fire.codeOf(err); emitKey(key); });
  }
  e.fns.add(fn);
  fn(legsFor(key), e.err);
  return () => {
    e.fns.delete(fn);
    if (!e.fns.size) { if (e.stop) e.stop(); subs.delete(key); }
  };
}

// ---------------------------------------------------------------------------------------------- Writes
function who() {
  const me = data.me();
  let nick = daily.LB.nick || (me ? data.name(me) : '');
  return {me: me || null, nick: String(nick || 'Someone').trim().slice(0, 24) || 'Someone'};
}
/**
 * Enters (bet: string) or removes (bet: null) manager `by`'s leg for the live week.
 * Resolves 'ok' | 'dev' (saved to the stand-in) | 'closed' | 'invalid' | 'denied' (rules not published) | 'failed'.
 */
export async function setLeg(by, bet) {
  const lw = liveWeek();
  if (!lw || !data.M[by]) return 'invalid';
  if (isClosed(lw.year, lw.week)) return 'closed';
  const text = bet == null ? null : String(bet).replace(/\s+/g, ' ').trim().slice(0, BET_MAX);
  if (bet != null && !text) return 'invalid';
  const key = week.weekKey(lw.year, lw.week);
  if (standIn()) {
    const o = readStore();
    const w = o[key] || (o[key] = {});
    if (text) w[by] = Object.assign({bet: text, at: Date.now()}, who()); else delete w[by];
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (_) { return 'failed'; }
    emitKey(key);
    return 'dev';
  }
  let F;
  try { F = await fire.getFire(); } catch (_) { return 'failed'; }
  const ref = F.fs.doc(F.db, 'lay', key, 'legs', by);
  try {
    if (text) await F.fs.setDoc(ref, Object.assign({by, bet: text}, who(), {at: F.fs.serverTimestamp()}));
    else await F.fs.deleteDoc(ref);
    return 'ok';
  } catch (err) {
    return fire.codeOf(err) === 'denied' ? 'denied' : 'failed';
  }
}
