// Pictures: anyone can put a picture of their own in place of their initials (the You sheet; views/photo.js crops
// it). A picture belongs to a person, not a phone: a league member (their manager id), an app user ('user:' + id) or a
// guest ('guest:' + their name), keyed as ui.avatar() / ui.nickAvatar() draw them.
// It travels on this phone's board doc (players/{uid}: av = {k: whose, i: a small JPEG as a data URL, t: when}), which
// the rules already let a phone write; every phone reads the docs with the board (daily.js), so a member's picture is
// on all their phones and everyone else's: per person the newest one counts, and only from a doc that is that
// person's (a doc's av for anyone else is ignored). i '' takes a picture away (initials again).
// THE RULE (CLAUDE.md), for pictures as for scores: a member's picture shows to everyone, and so does an app user's
// marked league: true (Ryan D); a guest's or any other app user's only on their own phones (pictureShows).
// A picture set on this phone shows at once and waits (gg-pic-mine) until the board has it: no connection, or a failed
// write, just means it goes up later. The pictures last seen are kept (gg-pics) so they're there before the board loads.
// Exports: myKey(), keyOfNick(nick), pictureShows(key), pictureForAll(key), pictureUrl(key), mine(), setMine(dataUrl),
// onPictures(fn), picturesOnBoard(docs), PIC_MAX. Owner: core.
import * as ui from './ui.js';
import * as data from './data.js';
import * as daily from './daily.js';

/** The longest picture (data URL characters) a doc may carry: views/photo.js makes them well under it. */
export const PIC_MAX = 60000;
const PIC_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const norm = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** This phone's person: their manager id, 'user:' + an app user's id, 'guest:' + a guest's name; null for no one. */
export function myKey() {
  const m = data.me();
  if (m) return m;
  const u = data.user();
  if (u) return 'user:' + u.id;
  const g = data.guest();
  return g ? 'guest:' + norm(g) : null;
}
/** The picture key for a name as the boards show it (not a member's: those go by manager id): an app user's (by
 *  name, board name or old name), else a guest's. */
export function keyOfNick(nick) {
  const u = data.userReserving(nick);
  if (u) return 'user:' + u.id;
  const n = norm(nick);
  return n ? 'guest:' + n : '';
}
/** Whether this phone shows a person's picture (THE RULE, above). */
export function pictureShows(key) {
  if (!key) return false;
  if (key === myKey()) return true;
  if (data.ids.includes(key)) return true;
  const u = /^user:/.test(key) ? data.USERS.find(x => 'user:' + x.id === key) : null;
  return !!(u && u.league);
}
/** Whether a person's picture shows on other people's phones too (a member's, Ryan D's), not just their own. */
export const pictureForAll = key => !!key && (data.ids.includes(key) || data.USERS.some(u => u.league && 'user:' + u.id === key));
// Whose a board doc is, as a picture key: its member, its app user, or its guest; null for anyone else.
function keyOfDoc(p) {
  const m = daily.memberOf(p);
  if (m) return m;
  const u = daily.userOf(p);
  if (u) return 'user:' + u.id;
  return daily.guestOf(p) ? 'guest:' + norm(p.nick) : null;
}
const okPic = a => !!a && typeof a === 'object' && typeof a.k === 'string' && a.k.length <= 64 && Number.isFinite(a.t) && a.t > 0
  && typeof a.i === 'string' && a.i.length <= PIC_MAX && (a.i === '' || PIC_RE.test(a.i));
/** The pictures on the board: per person, the newest from a doc that is theirs. */
function fromBoard(docs) {
  const out = {};
  (docs || []).forEach(p => {
    const a = p && p.av;
    if (!okPic(a) || a.k !== keyOfDoc(p)) return;
    if (!out[a.k] || a.t > out[a.k].t) out[a.k] = {i: a.i, t: a.t};
  });
  return out;
}

/** The pictures a list of board docs carries, by person (for the kit's check). */
export const picturesOnBoard = docs => fromBoard(docs);

// ---------------------------------------------------------------------------
// State: PICS (key -> {i, t}) is what's drawn; pending is this phone's own change until the board has it.
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : d; } catch (_) { return d; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
let PICS = {};
Object.entries(read('gg-pics', {})).forEach(([k, v]) => { if (okPic(Object.assign({k}, v))) PICS[k] = {i: v.i, t: v.t}; });
let pending = read('gg-pic-mine', null);
if (!okPic(pending)) pending = null;
if (pending && (!PICS[pending.k] || PICS[pending.k].t < pending.t)) PICS[pending.k] = {i: pending.i, t: pending.t};

// Each picture as a blob: URL, made once (a short string to put in a style, however many avatars show it). Old ones
// are let go a little later, once nothing on screen still uses them.
const URLS = new Map(); // key -> {t, url}
function blobUrl(dataUrl) {
  try {
    const comma = dataUrl.indexOf(','), mime = dataUrl.slice(5, dataUrl.indexOf(';')), bin = atob(dataUrl.slice(comma + 1));
    const a = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) a[j] = bin.charCodeAt(j);
    return URL.createObjectURL(new Blob([a], {type: mime}));
  } catch (_) { return dataUrl; }
}
/** A person's picture as an image URL for this phone, or '' (none, or not one this phone shows). */
export function pictureUrl(key) {
  if (!pictureShows(key)) return '';
  const e = PICS[key];
  if (!e || !e.i) return '';
  let u = URLS.get(key);
  if (!u || u.t !== e.t) {
    const old = u;
    u = {t: e.t, url: blobUrl(e.i)};
    URLS.set(key, u);
    if (old && /^blob:/.test(old.url)) setTimeout(() => URL.revokeObjectURL(old.url), 10000);
  }
  return u.url;
}
/** This phone's person and their picture: {key, url} (url '' for none); null for no one. */
export function mine() {
  const key = myKey();
  return key ? {key, url: pictureUrl(key)} : null;
}

const fns = new Set();
/** Calls fn() whenever the pictures change. Returns an unsubscribe. */
export function onPictures(fn) { fns.add(fn); return () => fns.delete(fn); }
let sig = '';
function changed() {
  const s = Object.keys(PICS).sort().map(k => `${k}:${PICS[k].t}:${PICS[k].i.length}`).join('|') + '#' + myKey();
  if (s === sig) return;
  sig = s;
  // kept: the pictures this phone shows (and its own)
  const keep = {};
  Object.keys(PICS).forEach(k => { if (pictureShows(k)) keep[k] = PICS[k]; });
  write('gg-pics', keep);
  ui.patchPictures(document);
  fns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}
// The board's pictures, with this phone's own change on top until the board has caught up (then it goes up again if
// it hasn't yet).
function refresh() {
  const LB = daily.LB;
  if (LB.all) {
    const next = fromBoard(LB.all);
    if (pending) {
      const got = next[pending.k];
      if (got && got.t >= pending.t) { pending = null; write('gg-pic-mine', null); }
      else { next[pending.k] = {i: pending.i, t: pending.t}; push(); }
    }
    PICS = next;
  }
  changed();
}

let pushing = null;
/** Sends this phone's change to its board doc. 'saved', 'later' (no board here yet, or a write already going), 'denied'
 *  or 'failed' (it tries again with the board's next update). */
function push() {
  const LB = daily.LB;
  if (!pending) return Promise.resolve('saved');
  if (!LB.merge || !LB.ready || LB.off || !LB.all) return Promise.resolve('later');
  if (pushing) return pushing.then(() => 'later');
  const p = pending, own = LB.all.find(x => x.id === LB.uid);
  const body = {av: {k: p.k, i: p.i, t: p.t}};
  // A phone with no doc yet makes one (the rules want a name and a total): no days, so it's on no board.
  if (!own) Object.assign(body, {nick: String(daily.postName() || '').trim().slice(0, 24) || 'Someone', total: 0, g: daily.asGuest()});
  pushing = LB.merge(body).then(() => 'saved', e => (e && e.code === 'permission-denied' ? 'denied' : 'failed'));
  return pushing.finally(() => { pushing = null; });
}
/** Sets this phone's person's picture (a data URL from views/photo.js), or '' to take it away. Shows at once; resolves
 *  how it went up: 'saved', 'later' or 'failed'/'denied' (it's kept here and tried again). */
export function setMine(dataUrl) {
  const k = myKey(), i = String(dataUrl || '');
  if (!k) return Promise.reject(new Error('Pick who you are first.'));
  if (i && (i.length > PIC_MAX || !PIC_RE.test(i))) return Promise.reject(new Error('That picture is too big.'));
  pending = {k, i, t: Math.max(Date.now(), ((PICS[k] && PICS[k].t) || 0) + 1)};
  write('gg-pic-mine', pending);
  PICS = Object.assign({}, PICS, {[k]: {i, t: pending.t}});
  changed();
  return push();
}

ui.setPictures({url: pictureUrl, keyOfNick});
daily.subscribe(type => { if (type === 'lb') refresh(); });
data.subscribe(type => { if (type === 'me') changed(); });
