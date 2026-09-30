// Press Room core: the Matchup of the Week loser's postgame press conference, one per week. The videos live on
// YouTube as unlisted uploads; the app keeps each one's 11-character id and plays it in an embedded player.
// YouTube links (parseYouTube), the oEmbed check (lookup), player/thumbnail URLs, the seeded archive
// (data/pressers.json) merged under the Firestore docs, one shared live listener (subscribePressers), the
// week's result and its Matchup of the Week (context, motwLoser), the post sheet's weeks (defaultWeek,
// weekOptions), writes (post, remove) and counts (stats).
// Pure logic + subscriptions, no DOM. Owner: PRESS-CORE.
//
// Firestore:  pressers/{weekKey}   {vid: 'dQw4w9WgXcQ', who: 'mitch', title: '' (<= 80), tall: false, me, nick, at}
// (weekKey = week.js weekKey: '2026-w4'; `at` = serverTimestamp(): the rules pin it to request.time.)
// Posting to a week that has one replaces it. Any phone may post, replace or remove (a friends' league).
//
// Layers, lowest first: the seed file (pressers Claude added for the league, in the repo: they show up with no
// database write; `seed: true`, no poster, never removable in the app) < the Firestore docs (a doc for the same
// week wins: that is how "Replace" works on a seeded week) < the dev stand-in.
// Dev hosts (fire.canWrite() false) never write to the real database: writes go to a local stand-in
// (localStorage 'gg-dev-press', {weekKey: doc | null}; null = the Firestore doc was removed) merged on top of the
// live snapshot and emitted like a real change. Reads of the real database still happen. See __dev at the bottom.

import * as data from './data.js';
import * as daily from './daily.js';
import * as fire from './fire.js';
import * as week from './week.js';

export const VID_RE = /^[A-Za-z0-9_-]{11}$/;
export const MAX_WEEK = 17;
export const TITLE_MAX = 80;
// The fields a presser doc may have (the rules' hasOnly list; checks-press.js compares them).
export const FIELDS = ['vid', 'who', 'title', 'tall', 'me', 'nick', 'at'];

const COL = 'pressers';
const SEED_URL = new URL('../../data/pressers.json', import.meta.url).href;
const OEMBED = 'https://www.youtube.com/oembed?format=json&url=';
const LOOKUP_MS = 6000;   // oEmbed timeout -> 'offline'
const NEG_TTL = 15e3;     // a 'private'/'missing' answer is reused this long (the poster may fix the video's visibility)
const LINGER = 60e3;      // the listener outlives its last subscriber this long (tab switches don't re-read)
const SLOW_MS = 10e3;     // no server answer this long after listening: ready, with error 'off'
const DEV_OK = !fire.canWrite();
const standIn = () => !fire.canWrite();

// ---------------------------------------------------------------------------
// YouTube links

// Ids YouTube uses in /embed/ paths that are not videos (both happen to be 11 characters).
const RESERVED = new Set(['videoseries', 'live_stream']);
const HOST_RE = /^(?:(?:www|m|music)\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)$/;
// A YouTube link inside any text (share sheets paste "Check this out https://youtu.be/…").
const LINK_RE = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:youtube(?:-nocookie)?\.com|youtu\.be)\/[^\s<>"'`]*/gi;
const vidOk = id => (typeof id === 'string' && VID_RE.test(id) && !RESERVED.has(id) ? id : null);

function fromLink(raw) {
  let t = raw.replace(/&amp;/g, '&').replace(/[.,;:!?)\]}>'"»”’]+$/, ''); // HTML-escaped queries, sentence punctuation
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
  let u;
  try { u = new URL(t); } catch (_) { return null; }
  const h = HOST_RE.exec(u.hostname.toLowerCase());
  if (!h) return null;
  const seg = u.pathname.split('/').filter(Boolean);
  if (h[1] === 'youtu.be') {
    const id = seg.length === 1 ? vidOk(seg[0].split('&')[0]) : null; // old "youtu.be/ID&feature=…" shares
    return id ? {vid: id, tall: false} : null;
  }
  const head = (seg[0] || '').toLowerCase();
  if (head === 'watch' && seg.length === 1) {
    const id = vidOk(u.searchParams.get('v'));
    return id ? {vid: id, tall: false} : null;
  }
  if (seg.length === 2 && (h[1] === 'youtube-nocookie.com' ? head === 'embed' : ['shorts', 'live', 'embed', 'v'].includes(head))) {
    const id = vidOk(seg[1]);
    return id ? {vid: id, tall: head === 'shorts'} : null;
  }
  return null;
}

// A YouTube link (youtu.be, watch?v= with v anywhere in the query, /shorts/ (tall), /live/, /embed/ (also
// youtube-nocookie.com), /v/; with or without scheme, www./m./music., extra params and trailing slashes), a bare
// 11-character id, or a text containing such a link -> {vid, tall} | null. Channels, playlists without v=, other
// sites and ids of the wrong length or charset -> null.
export function parseYouTube(input) {
  const s = String(input == null ? '' : input).trim();
  if (!s) return null;
  const bare = vidOk(s);
  if (bare) return {vid: bare, tall: false};
  LINK_RE.lastIndex = 0;
  let m;
  while ((m = LINK_RE.exec(s))) {
    const before = m.index ? s[m.index - 1] : '';
    if (before && /[A-Za-z0-9.@-]/.test(before)) continue; // "notyoutube.com/…", an e-mail address
    const r = fromLink(m[0]);
    if (r) return r;
  }
  return null;
}

export const thumbURL = vid => `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
export const embedURL = vid => `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&playsinline=1&rel=0`;
export const watchURL = vid => `https://www.youtube.com/watch?v=${vid}`;

// ---------------------------------------------------------------------------
// oEmbed check

// HTTP status of the oEmbed endpoint -> null (found) | 'private' (private video, or embedding turned off) |
// 'missing' | 'offline' (anything else: the link can't be checked right now).
export function lookupReason(status) {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return 'private';
  if (status === 400 || status === 404) return 'missing';
  return 'offline';
}

const looked = new Map();     // vid -> {t, keep, p}
const fakeLook = new Map();   // __dev.lookup overrides

async function oembed(vid) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return {ok: false, reason: 'offline'};
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = 0;
  const late = new Promise(res => { timer = setTimeout(() => { try { if (ctl) ctl.abort(); } catch (_) {} res('timeout'); }, LOOKUP_MS); });
  try {
    const res = await Promise.race([fetch(OEMBED + encodeURIComponent(watchURL(vid)), ctl ? {signal: ctl.signal} : {}), late]);
    if (res === 'timeout') return {ok: false, reason: 'offline'};
    const reason = lookupReason(res.status);
    if (reason) return {ok: false, reason};
    let j = null;
    try { j = await Promise.race([res.json(), late]); } catch (_) { j = null; }
    if (j === 'timeout') j = null;
    const clean = s => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
    const w = j && +j.width, h = j && +j.height;
    return {ok: true, title: clean(j && j.title), author: clean(j && j.author_name), tall: w > 0 && h > 0 ? h > w : null};
  } catch (_) {
    return {ok: false, reason: 'offline'};
  } finally {
    clearTimeout(timer);
  }
}

// Checks a video with YouTube's oEmbed endpoint (CORS works from the browser, and unlisted videos resolve):
// Promise<{ok: true, title, author, tall (vertical video: true/false, null when unknown)} |
//         {ok: false, reason: 'private' | 'missing' | 'offline'}>.
// Memoized per vid ('offline' is never kept; 'private'/'missing' for 15 s). The UI may save on 'offline' (with a
// note), never on 'private'/'missing'.
export function lookup(vid) {
  const id = String(vid == null ? '' : vid).trim();
  if (!vidOk(id)) return Promise.resolve({ok: false, reason: 'missing'});
  if (DEV_OK && fakeLook.has(id)) return Promise.resolve(Object.assign({}, fakeLook.get(id)));
  const c = looked.get(id);
  if (c && (c.keep || Date.now() - c.t < NEG_TTL)) return c.p.then(r => Object.assign({}, r));
  const e = {t: Date.now(), keep: false, p: null};
  e.p = oembed(id).then(r => {
    if (r.ok) e.keep = true;
    else if (r.reason === 'offline' && looked.get(id) === e) looked.delete(id);
    return r;
  });
  looked.set(id, e);
  return e.p.then(r => Object.assign({}, r));
}

// ---------------------------------------------------------------------------
// Weeks

const DAY_MS = 864e5;
function toMs(t) {
  if (t == null) return null;
  if (typeof t === 'number') return isFinite(t) ? t : null;
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'string') { const v = Date.parse(t); return isFinite(v) ? v : null; }
  if (typeof t.toMillis === 'function') { try { return t.toMillis(); } catch (_) { return null; } }
  if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}

// The season the post sheet is about: the in-progress one, else the newest.
export function seasonYear() {
  const s = data.SEASONS.find(x => x.live) || data.SEASONS[0] || null;
  return s ? s.year : null;
}

// The latest week of `year` whose Matchup of the Week lock (week.lockTime) has passed at `at`, 1..17.
export function latestWeek(at = week.now(), year = seasonYear()) {
  const t = toMs(at), y = Number(year);
  let w = 1;
  if (y) for (let i = MAX_WEEK; i >= 1; i--) if (t >= week.lockTime(y, i).getTime()) { w = i; break; }
  return {year: y || null, week: w};
}

// A week's games are over (Monday night included) by the Tuesday after its Thursday, 09:00 UTC (4-5 AM Eastern).
export function weekOver(year, wk, at = week.now()) {
  const [ky, km, kd] = week.kickoff(Number(year)).split('-').map(Number);
  return toMs(at) >= Date.UTC(ky, km - 1, kd + 7 * (Number(wk) - 1) + 5, 9);
}

// The post sheet's default week: the latest finished week of the live season without a presser, so a missing one
// is easy to fill (week 3's presser isn't posted while week 4 is being played -> week 3). Weeks before the season's
// first presser don't count as missing. When every finished week has one (or none has finished yet): the latest
// week whose lock has passed (on a Tuesday after week 4's games -> week 4, even before the week-4 data update;
// before week 1's lock -> week 1). opt.list: the presser list to check (default the latest one); opt.year: the
// season (default seasonYear()). -> {year, week}
export function defaultWeek(at = week.now(), opt = {}) {
  const t = toMs(at);
  const year = opt && opt.year != null ? Number(opt.year) : seasonYear();
  const L = latestWeek(t, year).week;
  if (!year) return {year: null, week: L};
  const list = opt && Array.isArray(opt.list) ? opt.list : currentList();
  const have = new Set(list.filter(p => p && p.year === year).map(p => p.week));
  const done = weekOver(year, L, t) ? L : L - 1;
  const first = have.size ? Math.min(...have) : 1;
  for (let w = done; w >= first; w--) if (!have.has(w)) return {year, week: w};
  return {year, week: L};
}

// The weeks a presser can be posted for: 1 .. the latest week whose lock has passed for the live season,
// 1 .. 17 for past seasons, [] for an unknown year.
export function weekOptions(year, at = week.now()) {
  const y = Number(year);
  if (!data.seasonByYear(y)) return [];
  const last = y === seasonYear() ? latestWeek(at, y).week : MAX_WEEK;
  return Array.from({length: last}, (_, i) => i + 1);
}

// ---------------------------------------------------------------------------
// The week's result

// `who`'s own game that week from data.GAMES: {opp, sa (who's score), sb, lost, tie, type ('reg', 'semi' ...)},
// or null when the week isn't in the data yet (it is updated by hand after each week).
export function context(year, wk, who) {
  const y = Number(year), w = Number(wk);
  if (typeof who !== 'string' || !data.M[who]) return null;
  const g = data.GAMES.find(x => x.year === y && x.week === w && (x.a === who || x.b === who));
  if (!g) return null;
  const mine = g.a === who;
  return {opp: mine ? g.b : g.a, sa: mine ? g.sa : g.sb, sb: mine ? g.sb : g.sa, lost: !g.tie && g.lose === who, tie: !!g.tie, type: g.type};
}

// 'Week 3 · lost 104.28–164.06 to Corbin' ('beat Corbin 164.06–104.28', 'tied Corbin 100.00–100.00'), or just
// 'Week 3' with no result yet. opt.year: 'Week 3, 2025 · …'.
export function line(p, opt = {}) {
  if (!p) return '';
  const head = `Week ${p.week}` + (opt && opt.year ? `, ${p.year}` : '');
  const c = p.ctx;
  if (!c) return head;
  const s = `${data.fmt(c.sa)}–${data.fmt(c.sb)}`, opp = data.name(c.opp);
  return `${head} · ` + (c.tie ? `tied ${opp} ${s}` : c.lost ? `lost ${s} to ${opp}` : `beat ${opp} ${s}`);
}

// ---------------------------------------------------------------------------
// Who was at the podium: the week's voted Matchup of the Week

const hist = new Map(); // year -> Promise<week.history(year)>
function historyOf(y) {
  let p = hist.get(y);
  if (!p) {
    p = Promise.resolve().then(() => week.history(y)).then(h => {
      if (!Array.isArray(h) || h.error) hist.delete(y); // a failed read is retried next time
      return Array.isArray(h) ? h : [];
    }, () => { hist.delete(y); return []; });
    hist.set(y, p);
  }
  return p;
}
// One read of a week's votes through week.js's live subscription (shared with Rivals when it is open).
function votesOnce(key) {
  return new Promise(resolve => {
    let un = null, done = false;
    const finish = v => {
      if (done) return;
      done = true;
      clearTimeout(t);
      setTimeout(() => { try { if (un) un(); } catch (_) {} }, 0);
      resolve(v);
    };
    const t = setTimeout(() => finish(null), 12e3);
    try { un = week.subscribeVotes(key, p => { if (p && (p.ready || p.error)) finish(p); }); } catch (_) { finish(null); }
  });
}

// A Matchup of the Week pick ('a|b') -> {who (the loser), opp, key, voted: true} when the result is in the data,
// else {options: [a, b], key, voted: true, tie (a tie has no loser)}; null for a malformed pick.
export function loserOf(year, wk, pick) {
  const y = Number(year), w = Number(wk);
  if (typeof pick !== 'string') return null;
  const p = pick.split('|');
  if (p.length !== 2 || !data.M[p[0]] || !data.M[p[1]] || p[0] === p[1]) return null;
  const [a, b] = p, key = week.weekKey(y, w);
  const r = week.resultOf(y, w, pick);
  if (r && r.winner) return {who: r.winner === a ? b : a, opp: r.winner, key, voted: true};
  return {options: [a, b], key, voted: true, tie: !!r};
}

// The voted Matchup of the Week of that week: Promise<{who (the loser), opp, key, voted: true} when the result
// is in the data | {options: [a, b], key, voted: true, tie} when it isn't yet (or it was a tie) | null when
// nobody voted (or the votes can't be read)>. Past weeks come from week.history(year), read once per year per
// session (a new week of data clears it); the week being played from its live votes. A week nobody voted on in
// the app falls back to the seed file's `motw` list (picked in the league chat; the result carries seed: true).
export async function motwLoser(year, wk) {
  const y = Number(year), w = Number(wk);
  if (!Number.isInteger(y) || !Number.isInteger(w) || w < 1 || w > MAX_WEEK) return null;
  const key = week.weekKey(y, w);
  let cur = null;
  try { cur = week.current(); } catch (_) { cur = null; }
  let pick = null;
  if (cur && cur.year === y && w >= cur.week) {
    if (w > cur.week) return null; // not voted on yet
    const p = await votesOnce(key);
    if (p && p.total) { try { pick = week.leader(p.tally, week.ranking(y, w)); } catch (_) { pick = null; } }
  } else {
    const h = await historyOf(y);
    const e = h.find(x => x && x.week === w);
    pick = e ? e.pick : null;
  }
  const voted = loserOf(y, w, pick);
  if (voted) return voted;
  await loadSeed();
  const s = noSeed ? null : loserOf(y, w, SEED.motw[key]);
  return s ? Object.assign(s, {seed: true}) : null;
}

// ---------------------------------------------------------------------------
// Docs -> presser items

function cleanTitle(s) {
  if (typeof s !== 'string') return '';
  let t = s.replace(/\s+/g, ' ').trim();
  if (t.length > TITLE_MAX) {
    t = t.slice(0, TITLE_MAX);
    if (/[\uD800-\uDBFF]$/.test(t)) t = t.slice(0, -1); // never split an emoji
    t = t.trim();
  }
  return t;
}

// One doc -> {key, year, week, vid, who, title, tall, me, nick, at (ms | null), ctx, seed, dev} | null (bad key,
// vid or manager). src: 'seed' (no poster: nick '', at null) | 'remote' | 'local' (the dev stand-in: dev true).
export function normalize(d, key, src = 'remote') {
  if (!d || typeof d !== 'object') return null;
  const P = week.parseKey(key != null ? key : d.key);
  if (!P || P.week > MAX_WEEK) return null;
  const vid = vidOk(d.vid);
  const who = typeof d.who === 'string' && data.M[d.who] ? d.who : null;
  if (!vid || !who) return null;
  const seed = src === 'seed';
  return {
    key: week.weekKey(P.year, P.week), year: P.year, week: P.week, vid, who,
    title: cleanTitle(d.title), tall: d.tall === true,
    me: !seed && typeof d.me === 'string' && data.M[d.me] ? d.me : null,
    nick: !seed && typeof d.nick === 'string' ? d.nick.trim().slice(0, 24) : '',
    at: seed ? null : toMs(d.at),
    ctx: context(P.year, P.week, who),
    seed, dev: src === 'local'
  };
}

const newestFirst = (x, y) => y.year - x.year || y.week - x.week;

// The layers -> the valid list, newest week first. seedDocs / remoteDocs: [{key, ...doc}]; local: the stand-in
// map {weekKey: doc | null} (a doc replaces the Firestore doc; null removes it, and a seeded week shows its seed).
export function mergeLayers(seedDocs, remoteDocs, local) {
  const fs = new Map();
  (remoteDocs || []).forEach(d => { const p = normalize(d, d && d.key, 'remote'); if (p) fs.set(p.key, p); });
  if (local && typeof local === 'object') {
    Object.keys(local).forEach(k => {
      const P = week.parseKey(k);
      if (!P) return;
      const kk = week.weekKey(P.year, P.week), d = local[k];
      if (d === null) { fs.delete(kk); return; }
      const p = normalize(d, kk, 'local');
      if (p) fs.set(kk, p);
    });
  }
  const all = new Map();
  (seedDocs || []).forEach(d => { const p = normalize(d, d && d.key, 'seed'); if (p) all.set(p.key, p); });
  fs.forEach((p, k) => all.set(k, p));
  return [...all.values()].sort(newestFirst);
}

// ---------------------------------------------------------------------------
// Local stand-in (dev hosts)

const STORE = 'gg-dev-press';
let sandbox = null; // __dev.sandbox: an in-memory store used by the checks (never localStorage, no emits)
function readStore() {
  if (sandbox) return sandbox.store;
  try { const o = JSON.parse(localStorage.getItem(STORE) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
}
function writeStore(o) {
  if (sandbox) { sandbox.store = o; return true; }
  try { localStorage.setItem(STORE, JSON.stringify(o)); return true; } catch (_) { return false; }
}
function localPut(key, doc) {
  const o = readStore();
  o[key] = doc; // null = removed
  return writeStore(o);
}
const localMap = () => (standIn() ? readStore() : {});

// ---------------------------------------------------------------------------
// Seed file (data/pressers.json). Loaded once (network-first through sw.js), again when a new week of data
// arrives. A failed or missing file is simply empty.
//   {"pressers": [{key, vid, who, title, tall}],        the seeded archive
//    "motw": [{key: '2026-w3', a: 'jaymin', b: 'ben'}]}  Matchups of the Week picked in the league chat before the
//                                                         app had voting (motwLoser falls back to them)

const SEED = {docs: [], motw: Object.create(null), settled: false, p: null, error: null};
// The seed's motw list -> {weekKey: 'a|b'} (entries with a bad key or unknown managers are skipped).
export function seedMotw(list) {
  const out = Object.create(null);
  (Array.isArray(list) ? list : []).forEach(m => {
    const P = m && week.parseKey(m.key);
    if (!P || P.week > MAX_WEEK || typeof m.a !== 'string' || typeof m.b !== 'string' || !data.M[m.a] || !data.M[m.b] || m.a === m.b) return;
    out[week.weekKey(P.year, P.week)] = week.gameKey(m.a, m.b);
  });
  return out;
}
let noSeed = false;
if (DEV_OK) { try { noSeed = sessionStorage.getItem('gg-dev-press-noseed') === '1'; } catch (_) {} }

export function loadSeed(force = false) {
  if (SEED.p && !force) return SEED.p;
  const p = (async () => {
    try {
      const res = await fetch(SEED_URL, {cache: 'no-cache'});
      if (!res.ok) throw new Error('pressers.json HTTP ' + res.status);
      const j = await res.json();
      if (!j || !Array.isArray(j.pressers)) throw new Error('pressers.json has no "pressers" list');
      SEED.docs = j.pressers.filter(d => d && typeof d === 'object');
      SEED.motw = seedMotw(j.motw);
      SEED.error = null;
    } catch (e) {
      SEED.error = e;
      if (!SEED.settled) { SEED.docs = []; SEED.motw = Object.create(null); }
    }
    SEED.settled = true;
    if (SEED.p === p) { invalidate(); emitAll(); }
    return {docs: SEED.docs, motw: SEED.motw, error: SEED.error};
  })();
  SEED.p = p;
  return p;
}

// ---------------------------------------------------------------------------
// The shared listener

const S = {fns: new Set(), stop: null, starting: false, scheduled: false, synced: false, slow: false, remote: [], remoteErr: null,
  slowTimer: 0, lingerTimer: 0, injected: null};
let devFail = null;
let memo = null; // {list, byKey} until something changes

const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, {timeout: 1500}) : setTimeout(fn, 200));
function invalidate() { memo = null; }

function built() {
  if (memo) return memo;
  const seedDocs = noSeed ? [] : SEED.docs;
  const remote = S.injected || S.remote;
  const list = mergeLayers(seedDocs, remote, localMap());
  const byKey = Object.create(null);
  list.forEach(p => { byKey[p.key] = p; });
  memo = {list, byKey};
  return memo;
}
function currentList() { return built().list; }

// The error a view should show: a forced dev error, else the remote one (the stand-in hides remote errors, like
// week.js: its own writes work either way).
function errorOf() { return devFail || (standIn() || S.injected ? null : S.remoteErr); }
function isReady() { return SEED.settled && (!!S.injected || S.synced || S.slow || !!S.remoteErr); }

function payload() {
  const b = built();
  return {list: b.list, byKey: b.byKey, ready: isReady(), error: errorOf(), dev: standIn(), remote: S.remoteErr};
}
function call(fn, p) { try { fn(p); } catch (e) { console.error(e); } }
function emitAll() {
  if (sandbox || !S.fns.size) return;
  const p = payload();
  [...S.fns].forEach(fn => call(fn, p));
}

async function startRemote() {
  S.scheduled = false;
  if (S.stop || S.starting || !S.fns.size) return;
  S.starting = true;
  let F;
  try { F = await fire.getFire(); } catch (_) {
    S.starting = false;
    S.remoteErr = 'off';
    emitAll();
    return;
  }
  S.starting = false;
  if (S.stop || !S.fns.size) return;
  clearTimeout(S.slowTimer);
  S.slow = false;
  S.slowTimer = setTimeout(() => {
    if (S.synced || !S.stop) return;
    S.slow = true;
    if (!S.remoteErr) S.remoteErr = 'off';
    emitAll();
  }, SLOW_MS);
  try {
    // ready only once the server has answered (the first snapshot offline comes from the empty local cache);
    // later cache-only snapshots (going offline) keep the synced data.
    S.stop = F.fs.onSnapshot(F.fs.collection(F.db, COL), {includeMetadataChanges: true}, snap => {
      if (!(snap.metadata && snap.metadata.fromCache)) {
        S.synced = true;
        clearTimeout(S.slowTimer);
        if (S.slow) { S.slow = false; S.remoteErr = null; }
      }
      S.remote = snap.docs.map(d => Object.assign({}, d.data({serverTimestamps: 'estimate'}), {key: d.id}));
      if (!S.slow) S.remoteErr = null;
      invalidate();
      emitAll();
    }, err => {
      clearTimeout(S.slowTimer);
      S.remoteErr = fire.codeOf(err); S.stop = null; S.synced = false;
      invalidate();
      emitAll();
    });
  } catch (err) {
    clearTimeout(S.slowTimer);
    S.remoteErr = fire.codeOf(err);
    emitAll();
  }
}
function scheduleRemote() {
  if (S.stop || S.starting || S.scheduled) return;
  S.scheduled = true;
  idle(startRemote);
}
function stopRemote() {
  if (S.fns.size) return;
  clearTimeout(S.slowTimer);
  if (S.stop) { try { S.stop(); } catch (_) {} }
  S.stop = null; S.synced = false; S.slow = false;
  if (S.remoteErr === 'off') S.remoteErr = null;
}

// Live pressers: fn({list, byKey, ready, error, dev, remote}). Called once soon after subscribing (from what is
// known already), then on every change.
//   list: the valid pressers, newest week first: [{key: '2026-w4', year, week, vid, who, title, tall, me, nick,
//         at (ms; null on a seed), ctx: context(year, week, who), seed (from data/pressers.json: no "Posted by",
//         no Remove), dev (saved on the dev stand-in)}]. Shared, read-only objects.
//   byKey: {weekKey: item} (null prototype).
//   ready: the seed file and the server have answered (or the server stayed silent for 10 s: error 'off').
//   error: null | 'off' | 'denied' (the rules aren't pasted yet: "The Press Room isn't switched on yet.") | 'failed'.
//   dev: the local stand-in is active (writes stay on this device). remote: the raw remote error (dev hides it).
// One shared Firestore listener (the whole `pressers` collection: it stays tiny) no matter how many screens
// subscribe; it starts at idle and stops a minute after the last unsubscribe.
export function subscribePressers(fn) {
  if (typeof fn !== 'function') return () => {};
  S.fns.add(fn);
  clearTimeout(S.lingerTimer);
  loadSeed();
  scheduleRemote();
  queueMicrotask(() => { if (S.fns.has(fn) && !sandbox) call(fn, payload()); }); // (after a sandbox: its closing emit)
  let off = false;
  return () => {
    if (off) return;
    off = true;
    S.fns.delete(fn);
    if (!S.fns.size) { clearTimeout(S.lingerTimer); S.lingerTimer = setTimeout(stopRemote, LINGER); }
  };
}

// The payload as it stands (same shape as subscribePressers'), for code outside a subscription. It starts nothing:
// the list is empty until the seed or a subscription has loaded something.
export function peek() { return payload(); }

// Counts from the latest list (or `list`): {byManager: {id: n}, total, top: [{id, n, latest: weekKey}] (most first,
// then the most recent)}.
export function stats(list = currentList()) {
  const byManager = {}, last = {};
  (list || []).forEach(p => {
    if (!p || !data.M[p.who]) return;
    byManager[p.who] = (byManager[p.who] || 0) + 1;
    if (!last[p.who] || newestFirst(p, last[p.who]) < 0) last[p.who] = p;
  });
  const top = Object.keys(byManager).map(id => ({id, n: byManager[id], latest: last[id].key}))
    .sort((x, y) => y.n - x.n || newestFirst(last[x.id], last[y.id]) || data.name(x.id).localeCompare(data.name(y.id)));
  return {byManager, total: top.reduce((s, x) => s + x.n, 0), top};
}

// ---------------------------------------------------------------------------
// Identity (same as week.js: the manager from "Which one are you?", the board nick; __dev.as on the stand-in)

function devAs() {
  if (!DEV_OK) return null;
  try { const v = JSON.parse(sessionStorage.getItem('gg-dev-as') || 'null'); return v && typeof v.uid === 'string' ? v : null; } catch (_) { return null; }
}
function myMe() { const a = devAs(); return a && a.me !== undefined ? (typeof a.me === 'string' && data.M[a.me] ? a.me : null) : data.me(); }
function myNick() {
  const a = devAs();
  let n = a && typeof a.nick === 'string' ? a.nick : daily.LB.nick;
  if (!n) { const m = myMe(); n = m ? data.name(m) : ''; }
  return String(n || '').trim().slice(0, 24);
}

// ---------------------------------------------------------------------------
// Writes -> 'ok' | 'dev' (saved on the local stand-in) | 'denied' (rules not pasted) | 'failed' | 'invalid'

// {year, week, vid, who, title, tall} -> the doc fields, or null when something is off.
function checkPost(o) {
  if (!o || typeof o !== 'object') return null;
  const y = Number(o.year), w = Number(o.week);
  if (!Number.isInteger(y) || !data.seasonByYear(y) || !Number.isInteger(w) || w < 1 || w > MAX_WEEK) return null;
  const vid = vidOk(typeof o.vid === 'string' ? o.vid.trim() : o.vid);
  if (!vid || typeof o.who !== 'string' || !data.M[o.who]) return null;
  if (o.title != null && typeof o.title !== 'string') return null;
  if (o.tall != null && typeof o.tall !== 'boolean') return null;
  return {key: week.weekKey(y, w), body: {vid, who: o.who, title: cleanTitle(o.title), tall: o.tall === true}};
}

// Post (or replace) a week's presser. Validates first; me/nick like week.js; at = serverTimestamp().
export async function post(o) {
  const v = checkPost(o);
  if (!v) return 'invalid';
  if (devFail) return devFail === 'denied' ? 'denied' : 'failed';
  const body = Object.assign(v.body, {me: myMe(), nick: myNick()});
  if (standIn()) {
    if (!localPut(v.key, Object.assign(body, {at: week.now()}))) return 'failed';
    invalidate(); emitAll();
    return 'dev';
  }
  let F;
  try { F = await fire.getFire(); } catch (_) { return 'failed'; }
  try {
    await F.fs.setDoc(F.fs.doc(F.db, COL, v.key), Object.assign(body, {at: F.fs.serverTimestamp()}));
    return 'ok';
  } catch (err) {
    return fire.codeOf(err) === 'denied' ? 'denied' : 'failed';
  }
}

// Remove a week's presser (the Firestore doc; a seeded week then shows its seed again). A week that only has its
// seed can't be removed: 'invalid' (the UI hides Remove on seeds).
export async function remove(key) {
  const P = week.parseKey(key);
  if (!P || P.week > MAX_WEEK) return 'invalid';
  const k = week.weekKey(P.year, P.week);
  const cur = built().byKey[k];
  if (cur && cur.seed) return 'invalid';
  if (devFail) return devFail === 'denied' ? 'denied' : 'failed';
  if (standIn()) {
    if (!localPut(k, null)) return 'failed';
    invalidate(); emitAll();
    return 'dev';
  }
  let F;
  try { F = await fire.getFire(); } catch (_) { return 'failed'; }
  try {
    await F.fs.deleteDoc(F.fs.doc(F.db, COL, k));
    return 'ok';
  } catch (err) {
    return fire.codeOf(err) === 'denied' ? 'denied' : 'failed';
  }
}

// ---------------------------------------------------------------------------
// Refresh on new data (contexts, the loser, the seed), stand-in changes in another tab, and coming back online.

data.subscribe(type => {
  if (type !== 'data') return;
  hist.clear();
  invalidate();
  emitAll();
  if (SEED.p) loadSeed(true);
});
try {
  addEventListener('storage', ev => { if (ev.key === STORE || ev.key === null) { invalidate(); emitAll(); } });
  addEventListener('online', () => {
    if (SEED.error && SEED.p) loadSeed(true);
    if (S.fns.size && !S.stop && S.remoteErr) scheduleRemote(); // the error stays until the server answers
  });
} catch (_) {}

// ---------------------------------------------------------------------------
// Dev hooks (only on a page that cannot write to the real database; they never touch it). From the console:
//   const press = await import('/js/core/press.js');
//   await press.post({year: 2026, week: 3, vid: 'dQw4w9WgXcQ', who: 'ben', title: 'Ben faces the media'})  // 'dev'
//   await press.remove('2026-w3')
//   press.__dev.noSeed(true)        // ignore data/pressers.json (the empty state; kept for this tab); false restores
//   press.__dev.inject([{key: '2026-w1', vid: 'dQw4w9WgXcQ', who: 'evan', nick: 'Evan', at: Date.now()}])
//                                   // fake Firestore docs in place of the live ones (ready at once); null restores
//   press.__dev.fail('denied')      // the "isn't switched on yet" state ('off', 'failed'); null clears
//   press.__dev.lookup('dQw4w9WgXcQ', {ok: false, reason: 'private'})  // fake an oEmbed answer; null clears
//   press.__dev.reset()             // clear the stand-in (and the fakes above)
// week.__dev.setNow(...) moves the clock (defaultWeek, weekOptions), week.__dev.as({uid, me, nick}) the poster.
export const __dev = {
  standIn,
  store: () => Object.assign({}, readStore()),
  state: () => ({subscribers: S.fns.size, listening: !!S.stop, synced: S.synced, remoteErr: S.remoteErr, seed: SEED.settled ? SEED.docs.length : null,
    seedError: SEED.error ? String(SEED.error.message || SEED.error) : null, noSeed, injected: !!S.injected, fail: devFail, sandbox: !!sandbox}),
  noSeed(on = true) {
    if (!DEV_OK) return false;
    noSeed = !!on;
    try { if (noSeed) sessionStorage.setItem('gg-dev-press-noseed', '1'); else sessionStorage.removeItem('gg-dev-press-noseed'); } catch (_) {}
    invalidate(); emitAll();
    return noSeed;
  },
  inject(docs) {
    if (!DEV_OK) return false;
    if (docs == null) S.injected = null;
    else if (Array.isArray(docs)) S.injected = docs.slice();
    else if (typeof docs === 'object') S.injected = Object.keys(docs).map(k => Object.assign({}, docs[k], {key: k}));
    invalidate(); emitAll();
    return S.injected ? S.injected.length : 0;
  },
  fail(code) {
    if (!DEV_OK) return false;
    devFail = ['denied', 'off', 'failed'].includes(code) ? code : null;
    emitAll();
    return devFail;
  },
  lookup(vid, res) {
    if (!DEV_OK) return false;
    if (res == null) fakeLook.delete(vid); else fakeLook.set(vid, res);
    return true;
  },
  // The checks: an in-memory stand-in (nothing reaches localStorage or other tabs, nothing is emitted) while `on`.
  sandbox(on) {
    if (!DEV_OK) return false;
    if (on) { sandbox = {store: {}, fail: devFail}; devFail = null; }
    else if (sandbox) { devFail = sandbox.fail; sandbox = null; }
    invalidate();
    if (!on) emitAll();
    return !!sandbox;
  },
  snapshot: () => payload(),
  reset() {
    if (!DEV_OK) return false;
    try { localStorage.removeItem(STORE); } catch (_) {}
    fakeLook.clear();
    S.injected = null;
    devFail = null;
    invalidate(); emitAll();
    return true;
  }
};
