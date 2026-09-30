// Press Room (#/press, #/press/2026-w4): the Matchup of the Week loser's postgame press conference, week by week,
// rewatchable inside the app. Pushed on any tab (a cold link sits on Rivals). Owner: PRESS-SCREEN.
//   Large title (eyebrow "Matchup of the Week", "Press Room", "The loser faces the media.") · the featured presser as
//   a big player card (the latest, or the route's week: the share link) with Share / Replace / Remove · a prompt when
//   the latest Matchup of the Week loser hasn't posted yet · the archive by season (a row features that presser and
//   plays it) · "How to post". The + in the bar opens the post sheet.
//   Post sheet (openPost): paste a YouTube link (checked live: the thumbnail and YouTube title, or what's wrong in
//   plain words), the week (default: the latest week still without a presser) and who was at the podium (pre-filled
//   from the MOTW loser), an optional caption (pre-filled from the YouTube title), a vertical switch (pre-set from a
//   /shorts/ link), then Post (a week that already has one asks before replacing it).
// The videos live on YouTube as unlisted uploads; only the id is stored (core/press.js: Firestore pressers/{weekKey}
// merged over the seeded data/pressers.json; dev hosts write to its local stand-in). Playback is YouTube's embed
// (youtube-nocookie.com) swapped in for the thumbnail on tap: one player at a time app-wide, and every screen that
// shows tiles stops its players when it hides.
// Exports for the other surfaces (Rivals, Today, the Wrap, profiles, Hall of Shame):
//   tileHTML(p, {size: 'l'|'m'|'s', play, context}) -> markup of a presser tile (data-press-key, data-press-vid)
//   bindPlayers(root) -> stop()        tap-to-play on every tile under root; stop() puts them back to thumbnails
//   stopAll()                          stops every player in the document
//   openPost({key, onPosted}) -> Promise<weekKey | null>   the post sheet (key: that week pre-selected)
//   contextText(p), presserName(p)     "Week 3 · lost 104.28–164.06 to Corbin", "Mitch's week 3 press conference"
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as press from '../core/press.js';

const esc = data.esc;
const nm = id => data.name(id);
const poss = s => `${s}'s`;
const cap1 = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const VID_RE = /^[A-Za-z0-9_-]{11}$/;
const OFF_MSG = "The Press Room isn't switched on yet.";
const GONE_MSG = "That press conference isn't here anymore.";
const POST_FAIL = "Couldn't post. Try again.";
const CAP_MAX = 80;
const SPEAK = '\u{1F399}️'; // the studio microphone, in the share text

const keyOf = (y, w) => `${y}-w${w}`;
function parseKey(k) {
  const m = /^(\d{4})-w([1-9]\d?)$/.exec(String(k == null ? '' : k));
  return m ? {year: +m[1], week: +m[2]} : null;
}
// The live season (or the latest one once a season is over): its weeks read "Week 3", older ones "Week 3, 2025".
function liveYear() {
  try { const y = press.seasonYear(); if (y) return y; } catch (_) {}
  const s = data.SEASONS.find(x => x.live) || data.SEASONS[0];
  return s ? s.year : new Date().getFullYear();
}
const weekLabel = p => `Week ${p.week}${p.year !== liveYear() ? `, ${p.year}` : ''}`;
const bugText = p => `Wk ${p.week}${p.year !== liveYear() ? ` · ${p.year}` : ''}`;
const capOf = p => String((p && p.title) || '').trim().slice(0, CAP_MAX).trim();

/** "Jackson's week 2 press conference" ("Jackson's 2025 week 3 press conference" for an older season). */
export function presserName(p) {
  if (!p) return 'Press conference';
  return `${poss(nm(p.who))} ${p.year !== liveYear() ? p.year + ' ' : ''}week ${p.week} press conference`;
}
/**
 * The game line: "Week 3 · lost 104.28–164.06 to Corbin" ("beat Corbin 164.06–104.28", "tied Corbin 100.00–100.00").
 * Just "Week 3" until the week's scores are in the data. {week: false} leaves the week out ("lost … to Corbin", or '').
 */
export function contextText(p, {week = true} = {}) {
  const w = week && p ? weekLabel(p) : '';
  const c = p && p.ctx;
  if (!c || !data.M[c.opp] || !isFinite(+c.sa) || !isFinite(+c.sb)) return w;
  const s = `${data.fmt(c.sa)}–${data.fmt(c.sb)}`;
  const r = c.tie ? `tied ${nm(c.opp)} ${s}` : c.lost ? `lost ${s} to ${nm(c.opp)}` : `beat ${nm(c.opp)} ${s}`;
  return w ? `${w} · ${r}` : r;
}
const dateFmt = {};
function dateText(ms) {
  const d = new Date(ms);
  if (isNaN(d)) return '';
  const y = d.getFullYear() !== new Date().getFullYear();
  const k = y ? 'y' : 'n';
  if (!dateFmt[k]) dateFmt[k] = new Intl.DateTimeFormat('en-US', y ? {month: 'short', day: 'numeric', year: 'numeric'} : {month: 'short', day: 'numeric'});
  return dateFmt[k].format(d);
}
// "Posted by Nick · Sep 30" (seeded pressers have no poster).
function postedText(p) {
  if (!p || p.seed) return '';
  const by = String(p.nick || '').trim() || (p.me && data.M[p.me] ? nm(p.me) : '');
  const when = p.at ? dateText(p.at) : '';
  if (!by && !when) return '';
  return [by ? `Posted by ${by}` : 'Posted', when].filter(Boolean).join(' · ');
}

// ============================================================================ Tiles
// The thumbnail: a dark card with the mic glyph underneath, YouTube's hqdefault on top (lazy). A missing thumbnail
// (a fresh upload YouTube is still processing answers with a 120x90 placeholder, or an error) uncovers the card.
function thumbInner(p, alt) {
  return `<span class="c-press-ph" aria-hidden="true">${ui.icon('mic')}</span>`
    + `<img class="c-press-img" src="${esc(press.thumbURL(p.vid))}" alt="${esc(alt)}" width="480" height="360" loading="lazy" decoding="async">`;
}
function thumbHTML(p, cls = '') {
  return `<span class="c-press-th${p.tall ? ' is-tall' : ''}${cls ? ' ' + cls : ''}">${thumbInner(p, '')}<span class="c-press-glyph" aria-hidden="true">${ui.icon('play-fill')}</span></span>`;
}

/**
 * A presser tile: thumbnail (16:9; a vertical video is 9:16 on a blurred copy of itself, at most 70vh tall), a round
 * play button, and the labels. The root carries data-press-key, data-press-vid (and data-press-tall, data-press-title)
 * for bindPlayers(). Pure (no DOM).
 *   size 'l': the Press Room's featured card (avatar 40 linking to the profile, game line, caption, "Posted by").
 *   size 'm': a card on another screen (avatar 32, game line, caption).
 *   size 's': a compact row (small thumbnail, "Week 3 · Mitch", the caption or the game line); expands to full width
 *             while it plays.
 *   play: false renders no interactive element at all (wrap the tile in your own link); the play glyph stays.
 *   context: false leaves the game line out ("Week 3" only).
 */
export function tileHTML(p, {size = 'l', play = true, context = true} = {}) {
  if (!p || !p.key || !VID_RE.test(String(p.vid || ''))) return '';
  const sz = size === 's' || size === 'm' ? size : 'l';
  const label = presserName(p);
  const cap = capOf(p);
  const inner = thumbInner(p, cap || label)
    + (sz === 's' ? '' : `<span class="c-press-bug" aria-hidden="true">${ui.icon('mic-fill')}<span>${esc(bugText(p))}</span></span>`)
    + `<span class="c-press-btn" aria-hidden="true">${ui.icon('play-fill')}<span class="spin"></span></span>`;
  const cover = play
    ? `<button type="button" class="c-press-cover" data-press-play aria-label="${esc('Play ' + label)}">${inner}</button>`
    : `<span class="c-press-cover">${inner}</span>`;
  const back = p.tall ? `<span class="c-press-back" aria-hidden="true"><img class="c-press-bimg" src="${esc(press.thumbURL(p.vid))}" alt="" loading="lazy" decoding="async"></span>` : '';
  const media = `<div class="c-press-media">${back}<div class="c-press-frame">${cover}</div></div>`;
  const yt = play ? '<div class="c-press-yt"></div>' : '';
  let body;
  if (sz === 's') {
    const sub = cap || (context ? cap1(contextText(p, {week: false})) : '');
    body = `<div class="c-press-body"><span class="c-press-st">${esc(`${weekLabel(p)} · ${nm(p.who)}`)}</span>${sub ? `<span class="c-press-ss">${esc(sub)}</span>` : ''}</div>`;
  } else {
    const link = sz === 'l' && play && data.M[p.who];
    const av = ui.avatar(p.who, {size: sz === 'l' ? 40 : 32, you: p.who === data.me(), attrs: link ? {'data-morph-from': true} : null});
    const tx = `<span class="c-press-tx"><span class="c-press-who">${esc(nm(p.who))}</span><span class="c-press-ctx">${esc(context ? contextText(p) : weekLabel(p))}</span></span>`;
    const by = sz === 'l' ? postedText(p) : '';
    body = `<div class="c-press-body">`
      + (link ? `<a class="c-press-mgr" href="#/managers/${esc(encodeURIComponent(p.who))}">${av}${tx}</a>` : `<div class="c-press-mgr">${av}${tx}</div>`)
      + (cap ? `<p class="c-press-cap">${esc(cap)}</p>` : '')
      + (by ? `<p class="c-press-by">${esc(by)}</p>` : '')
      + `</div>`;
  }
  return `<article class="c-press is-${sz}${p.tall ? ' is-tall' : ''} ${data.color(p.who).cls}" data-press-key="${esc(p.key)}" data-press-vid="${esc(p.vid)}"`
    + ` data-press-title="${esc(label)}"${p.tall ? ' data-press-tall' : ''} aria-label="${esc(label)}">${media}${yt}${body}</article>`;
}

// ============================================================================ Player
// Tapping a tile's thumbnail swaps in YouTube's embed (the thumbnail stays underneath until the player has loaded).
// Only one plays app-wide: starting one puts every other open player in the document back to its thumbnail.
function playTile(tile) {
  if (!tile || !tile.isConnected) return false;
  const vid = tile.dataset.pressVid;
  const frame = tile.querySelector('.c-press-frame');
  if (!frame || !VID_RE.test(vid || '')) return false;
  if (frame.classList.contains('is-playing')) return true;
  stopAll(frame);
  const cover = frame.querySelector('.c-press-cover');
  const hadFocus = !!cover && document.activeElement === cover;
  const ifr = document.createElement('iframe');
  ifr.className = 'c-press-ifr';
  ifr.title = tile.dataset.pressTitle || 'Press conference';
  // YouTube's embed refuses to play without a Referer: keep this referrer policy.
  ifr.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  ifr.setAttribute('allowfullscreen', '');
  ifr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  ifr.setAttribute('loading', 'eager');
  ifr.src = press.embedURL(vid);
  const loaded = () => { clearTimeout(frame._pressT); if (ifr.isConnected) frame.classList.add('is-loaded'); };
  ifr.addEventListener('load', loaded, {once: true});
  frame._pressT = setTimeout(loaded, 5000); // never leave the player hidden (a blocked or slow load)
  frame.classList.add('is-playing');
  tile.classList.add('is-playing');
  if (cover) { cover.setAttribute('aria-hidden', 'true'); cover.tabIndex = -1; }
  frame.append(ifr);
  // A tiny fallback under a playing video (an embed can refuse to play: a private video, embedding turned off).
  const yt = tile.querySelector('.c-press-yt');
  if (yt) yt.innerHTML = `<a href="${esc(press.watchURL(vid))}" target="_blank" rel="noopener noreferrer">Open in YouTube</a>`;
  if (hadFocus) { try { ifr.focus({preventScroll: true}); } catch (_) {} }
  return true;
}
function restore(frame) {
  if (!frame) return;
  clearTimeout(frame._pressT);
  const ifr = frame.querySelector('.c-press-ifr');
  const hadFocus = !!ifr && document.activeElement === ifr;
  if (ifr) ifr.remove();
  frame.classList.remove('is-playing', 'is-loaded');
  const tile = frame.closest('.c-press');
  if (tile) {
    tile.classList.remove('is-playing');
    const yt = tile.querySelector('.c-press-yt');
    if (yt) yt.textContent = '';
  }
  const cover = frame.querySelector('.c-press-cover');
  if (cover) {
    cover.removeAttribute('aria-hidden');
    if (cover.tagName === 'BUTTON') cover.removeAttribute('tabindex');
    if (hadFocus) { try { cover.focus({preventScroll: true}); } catch (_) {} }
  }
}
/** Stops every player in the document (except `except`, a .c-press-frame). */
export function stopAll(except) {
  document.querySelectorAll('.c-press-frame.is-playing').forEach(f => { if (f !== except) restore(f); });
}
function stopIn(root) {
  if (root && root.querySelectorAll) root.querySelectorAll('.c-press-frame.is-playing').forEach(restore);
}
const BOUND = new WeakSet();
/**
 * Tap-to-play for every tile under `root` (event delegation: tiles rendered into it later work too). Returns stop(),
 * which puts every player under root back to its thumbnail: call it from onHide and unmount so a hidden screen never
 * keeps playing. Binding the same root again only returns a new stop().
 */
export function bindPlayers(root) {
  if (!root || typeof root.addEventListener !== 'function') return () => {};
  if (!BOUND.has(root)) {
    BOUND.add(root);
    root.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('[data-press-play]') : null;
      if (!b || !root.contains(b) || e.__press) return;
      e.__press = true; // nested bound roots handle a tap once
      const tile = b.closest('.c-press');
      if (!tile) return;
      e.preventDefault();
      const was = !!tile.querySelector('.c-press-frame.is-playing');
      if (playTile(tile) && !was) ui.haptic('light');
    });
  }
  scanThumbs(root);
  return () => stopIn(root);
}

// Thumbnails: one capturing listener for the whole document (load and error do not bubble), so tiles on every screen
// and in the post sheet fall back to the mic card without any wiring. YouTube answers a missing thumbnail with a
// 120x90 placeholder image, not an error.
function thumbState(img, broken) {
  const bad = !!broken || !img.naturalWidth || img.naturalWidth <= 120;
  const box = img.closest('.c-press-th, .c-press-frame');
  if (box) box.classList.toggle('is-noimg', bad);
  const tile = box && box.classList.contains('c-press-frame') ? img.closest('.c-press') : null;
  if (tile) tile.classList.toggle('is-noimg', bad);
}
function scanThumbs(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('img.c-press-img').forEach(img => { if (img.complete && img.getAttribute('src')) thumbState(img, false); });
}
function onThumb(e) {
  const img = e.target;
  if (!img || img.tagName !== 'IMG' || !img.classList || !img.classList.contains('c-press-img')) return;
  thumbState(img, e.type === 'error');
}
try {
  document.addEventListener('load', onThumb, true);
  document.addEventListener('error', onThumb, true);
} catch (_) {}

// ============================================================================ Shared bits (screen and sheet)
const STEPS = [
  'Record the presser on your phone. In the YouTube app, tap <b>+</b>, then <b>Upload a video</b>. Set <b>Visibility</b> to <b>Unlisted</b> and upload.',
  'On the video, tap <b>Share</b>, then <b>Copy link</b>.',
  'Back here, tap <b>+</b> in the Press Room and paste the link. The week and who was at the podium fill themselves in. Check them and post.'
];
const STEPS_FOOT = "Unlisted means only people with the link can watch. Private videos won't play here.";
function stepsHTML() {
  return `<ol class="c-press-steps">${STEPS.map((t, i) => `<li><span class="c-press-step" aria-hidden="true">${i + 1}</span><p>${t}</p></li>`).join('')}</ol>`;
}
const snapList = snap => (snap && Array.isArray(snap.list) ? snap.list : []);
function byKeyOf(snap) {
  if (snap && snap.byKey && typeof snap.byKey === 'object') return snap.byKey;
  const o = {};
  snapList(snap).forEach(p => { if (p && p.key) o[p.key] = p; });
  return o;
}
// The live season's latest week whose Matchup of the Week lock has passed.
function latestNow() {
  try { const d = press.latestWeek(); if (d && d.year && d.week) return d; } catch (e) { console.error(e); }
  return {year: liveYear(), week: 1};
}
function weekOpts(year) {
  let o = null;
  try { o = press.weekOptions(year); } catch (e) { console.error(e); }
  if (Array.isArray(o) && o.length) return o.map(Number).filter(n => n >= 1 && n <= 18);
  const d = latestNow();
  const n = d.year === year ? d.week : 17;
  return Array.from({length: n}, (_, i) => i + 1);
}
// The post sheet's default week: for the live season press.defaultWeek (the latest finished week still without a
// presser, so a missing one is easy to fill; else the latest week); for an older one the latest week without one.
function defaultPostWeek(year, snap) {
  const opts = weekOpts(year);
  if (year === liveYear()) {
    try { const d = press.defaultWeek(undefined, snap ? {list: snapList(snap), year} : {year}); if (d && opts.includes(d.week)) return d.week; } catch (e) { console.error(e); }
  }
  const bk = byKeyOf(snap);
  for (let i = opts.length - 1; i >= 0; i--) if (!bk[keyOf(year, opts[i])]) return opts[i];
  return opts[opts.length - 1] || 1;
}
function safeContext(year, week, who) {
  try { return press.context(year, week, who) || null; } catch (_) { return null; }
}
// press.js answers from memory for a season it has seen; the promise never rejects here.
function loserOf(year, week) {
  let p;
  try { p = Promise.resolve(press.motwLoser(year, week)); } catch (e) { p = Promise.reject(e); }
  return p.then(r => r || null, e => { console.warn('press: motw loser', e); return null; });
}
// A post or remove finished: go to the Press Room featuring that week (from other screens).
function goPress(key) {
  import('../app.js').then(a => a.nav('/press/' + encodeURIComponent(key))).catch(e => console.error(e));
}

// ============================================================================ Post sheet
let postOpen = null; // the open post sheet's promise (one at a time)

/**
 * The post sheet. key ('2026-w4'): that week pre-selected (Replace). onPosted(key): called after a successful post
 * (the Press Room features it); without it the toast offers "Watch". Resolves the posted week key, or null.
 */
export function openPost({key, onPosted} = {}) {
  if (postOpen) return postOpen;
  const K = parseKey(key);
  let snap0 = memo.snap;
  if (!snap0) { try { snap0 = press.peek(); } catch (_) { snap0 = null; } }
  const ex0 = K ? byKeyOf(snap0)[keyOf(K.year, K.week)] : null;
  const S = {
    year: K ? K.year : liveYear(), week: K ? K.week : null, weekTouched: !!K,
    who: ex0 && data.M[ex0.who] ? ex0.who : null, whoTouched: false, sugg: undefined, suggSeq: 0,
    link: {state: 'empty', p: null, info: null, seq: 0}, linkT: 0,
    capAuto: '', tall: false, tallTouched: false, snap: snap0, busy: false, dead: false, result: null,
    unsub: null, sheet: null, el: null
  };
  if (!S.week) S.week = defaultPostWeek(S.year, S.snap);
  let resolve;
  postOpen = new Promise(r => { resolve = r; });
  const done = postOpen;
  S.sheet = ui.openSheet({
    title: 'Post a press conference', body: postBody(S), cls: 'sh-press', detents: ['large'],
    onClose: () => {
      S.dead = true;
      clearTimeout(S.linkT);
      if (typeof S.unsub === 'function') { try { S.unsub(); } catch (_) {} }
      stopIn(S.el);
      if (postOpen === done) postOpen = null;
      resolve(S.result);
    }
  });
  S.el = S.sheet.el;
  S.onPosted = typeof onPosted === 'function' ? onPosted : null;
  wireSheet(S);
  paintPost(S);
  requestAnimationFrame(() => { if (!S.dead) scrollChips(S); });
  suggest(S);
  try {
    S.unsub = press.subscribePressers(u => {
      if (S.dead || !u) return;
      S.snap = u;
      memo.snap = u;
      if (!S.weekTouched) {
        const w = defaultPostWeek(S.year, u);
        if (w !== S.week) { S.week = w; if (!S.whoTouched) suggest(S); }
      }
      paintWeeks(S);
    });
  } catch (e) { console.error(e); }
  return done;
}

function postBody(S) {
  const canPaste = !!(navigator.clipboard && typeof navigator.clipboard.readText === 'function');
  return `<div class="shp">`
    + `<section class="shp-sec"><label class="shp-h" for="shp-link">YouTube link</label>`
    + `<div class="shp-field"><input id="shp-link" class="shp-in" name="shp-link" type="url" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="https://youtu.be/…">`
    + (canPaste ? ui.button({label: 'Paste', kind: 'secondary', size: 's', cls: 'shp-paste', attrs: {'data-shp-paste': ''}}) : '')
    + `</div><div class="shp-check" aria-live="polite">${checkHTML(S)}</div>`
    + `<details class="shp-how"><summary>${ui.icon('info')}<span>How to post a video</span>${ui.icon('chevron-down', {cls: 'shp-how-chev'})}</summary>${stepsHTML()}<p class="shp-how-f">${esc(STEPS_FOOT)}</p></details></section>`
    + `<section class="shp-sec" aria-labelledby="shp-week-h"><div class="shp-hrow"><h3 class="shp-h" id="shp-week-h">Week</h3>${yearHTML(S)}</div><div class="shp-weeks">${weeksHTML(S)}</div></section>`
    + `<section class="shp-sec" aria-labelledby="shp-who-h"><h3 class="shp-h" id="shp-who-h">At the podium</h3><div class="shp-who">${whoHTML(S)}</div></section>`
    + `<section class="shp-sec"><div class="shp-hrow"><label class="shp-h" for="shp-cap">Caption</label><span class="shp-count" aria-hidden="true">0/${CAP_MAX}</span></div>`
    + `<div class="shp-field"><input id="shp-cap" class="shp-in" name="shp-cap" type="text" maxlength="${CAP_MAX}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="Optional"></div></section>`
    + `<section class="shp-sec"><div class="shp-sw"><span class="shp-sw-tx"><span class="shp-sw-t">Vertical video</span><span class="shp-sw-s">Filmed upright, like a Short</span></span>${ui.switchCtl({name: 'shp-tall', checked: S.tall, label: 'Vertical video'})}</div></section>`
    + `<div class="shp-foot">${ui.button({label: 'Post', kind: 'primary', block: true, disabled: true, attrs: {'data-shp-post': ''}})}<p class="shp-why" aria-live="polite"></p></div>`
    + `</div>`;
}

// ---- link check
function msgHTML(icon, text, cls = '') {
  return `<p class="shp-msg${cls ? ' ' + cls : ''}">${ui.icon(icon)}<span>${esc(text)}</span></p>`;
}
function previewHTML(p, info, st) {
  const tx = info
    ? `<span class="shp-pv-t">${esc(info.title || 'YouTube video')}</span>${info.author ? `<span class="shp-pv-a">${esc(info.author)}</span>` : ''}`
    : st === 'warn'
      ? `<span class="shp-pv-t">YouTube video</span><span class="shp-pv-a">Not checked</span>`
      : `<span class="sk sk-line"></span><span class="sk sk-line shp-pv-sk2"></span><span class="sr-only">Checking the link.</span>`;
  const mark = st === 'ok' ? ui.icon('check-circle', {cls: 'shp-pv-ok'}) : st ? '' : '<span class="spin" aria-hidden="true"></span>';
  return `<div class="shp-pv${st ? ' is-' + st : ''}">${thumbHTML(p)}<span class="shp-pv-tx">${tx}</span><span class="shp-pv-st">${mark}</span></div>`;
}
function checkHTML(S) {
  const L = S.link;
  switch (L.state) {
    case 'bad': return msgHTML('x-circle', "Paste the link from YouTube's Share button.", 'is-wrong');
    case 'checking': return previewHTML(L.p, null, '');
    case 'ok': return previewHTML(L.p, L.info, 'ok');
    case 'private': return msgHTML('x-circle', 'That video is private. In YouTube, set its visibility to Unlisted.', 'is-wrong');
    case 'missing': return msgHTML('x-circle', "Couldn't find that video.", 'is-wrong');
    case 'offline': return previewHTML(L.p, null, 'warn') + msgHTML('info', "Couldn't check the link — you're offline? It'll still be saved.", 'is-warn');
    default: return `<p class="shp-msg">${ui.icon('info')}<span>In the YouTube app: Share, then Copy link. Unlisted videos work.</span></p>`;
  }
}
function checkLink(S, raw) {
  if (S.dead) return;
  clearTimeout(S.linkT);
  const t = String(raw == null ? '' : raw).trim();
  let p = null;
  if (t) { try { p = press.parseYouTube(t); } catch (e) { console.error(e); p = null; } }
  const L = S.link;
  // A shared blob of text ("Check this out https://youtu.be/…"): keep just the link in the field (once the field is
  // left, so typing is never disturbed).
  const inp = S.el.querySelector('#shp-link');
  if (p && inp && /\s/.test(t) && document.activeElement !== inp) inp.value = p.tall ? `https://youtube.com/shorts/${p.vid}` : `https://youtu.be/${p.vid}`;
  if (p && L.p && L.p.vid === p.vid && L.state !== 'empty' && L.state !== 'bad') {
    if (!S.tallTouched && p.tall && !S.tall) setTall(S, true);
    return;
  }
  const seq = ++L.seq;
  if (!t || !p) {
    S.link = {state: t ? 'bad' : 'empty', p: null, info: null, seq};
    paintCheck(S); paintPost(S);
    return;
  }
  S.link = {state: 'checking', p, info: null, seq};
  if (!S.tallTouched) setTall(S, !!p.tall);
  paintCheck(S); paintPost(S);
  let q;
  try { q = Promise.resolve(press.lookup(p.vid)); } catch (e) { q = Promise.reject(e); }
  q.then(r => r, e => { console.warn('press: lookup', e); return {ok: false, reason: 'offline'}; }).then(r => {
    if (S.dead || S.link.seq !== seq) return;
    if (r && r.ok) {
      S.link = {state: 'ok', p, info: {title: String(r.title || ''), author: String(r.author || '')}, seq};
      autoCaption(S, r.title);
      // YouTube knows when a plain watch link is a vertical video (a /shorts/ link already said so).
      if (!S.tallTouched && !p.tall && r.tall === true) setTall(S, true);
    } else {
      const why = r && ['private', 'missing', 'offline'].includes(r.reason) ? r.reason : 'offline';
      S.link = {state: why, p, info: null, seq};
    }
    paintCheck(S); paintPost(S);
  });
}
function setTall(S, v) {
  S.tall = !!v;
  const sw = S.el && S.el.querySelector('[data-switch="shp-tall"]');
  if (sw) sw.setAttribute('aria-checked', String(S.tall));
}
// The caption takes the YouTube title (trimmed to 80) while it is empty or still holds the last one it took.
function autoCaption(S, title) {
  const cap = S.el.querySelector('#shp-cap');
  const t = String(title || '').trim().slice(0, CAP_MAX).trim();
  if (!cap || !t) return;
  if (cap.value === '' || cap.value === S.capAuto) { cap.value = t; S.capAuto = t; paintCount(S); }
}
function paintCount(S) {
  const cap = S.el.querySelector('#shp-cap'), n = S.el.querySelector('.shp-count');
  if (cap && n) { n.textContent = `${cap.value.length}/${CAP_MAX}`; n.classList.toggle('is-full', cap.value.length >= CAP_MAX); }
}
async function pasteLink(S) {
  const inp = S.el.querySelector('#shp-link');
  let t = '';
  try { t = await navigator.clipboard.readText(); } catch (_) { t = null; }
  if (S.dead || !inp) return;
  if (t == null) { ui.toast("Couldn't read the clipboard. Long-press the field and paste.", {icon: 'info'}); inp.focus(); return; }
  if (!String(t).trim()) { ui.toast('The clipboard is empty. Copy the link in YouTube first.', {icon: 'info'}); return; }
  inp.value = String(t).trim();
  checkLink(S, inp.value);
}

// ---- week
function yearHTML(S) {
  const years = data.SEASONS.map(s => s.year);
  if (years.length < 2) return '';
  const live = liveYear();
  return `<label class="shp-yr"><span class="sr-only">Season</span><select name="shp-year">`
    + years.map(y => `<option value="${y}"${y === S.year ? ' selected' : ''}>${y === live ? 'This season' : y}</option>`).join('')
    + `</select>${ui.icon('chevron-down')}</label>`;
}
function weeksHTML(S) {
  const bk = byKeyOf(S.snap);
  const items = weekOpts(S.year).map(w => {
    const has = !!bk[keyOf(S.year, w)];
    return {id: String(w), label: ui.raw(`Wk ${w}${has ? '<span class="sr-only">, has a press conference</span>' : ''}`), lead: has ? ui.icon('mic-fill', {cls: 'shp-wk-ic'}) : ''};
  });
  const ex = bk[keyOf(S.year, S.week)];
  return ui.chips({name: 'shp-week', items, value: String(S.week), label: 'Week'})
    + `<p class="shp-note">${ex ? esc(`Week ${S.week} already has ${poss(nm(ex.who))} press conference. Posting replaces it.`) : ''}</p>`;
}
function paintWeeks(S) {
  const box = S.el && S.el.querySelector('.shp-weeks');
  if (!box) return;
  const html = weeksHTML(S);
  if (box._html === html) return;
  const rail = box.querySelector('.chips');
  const left = rail ? rail.scrollLeft : 0;
  box.innerHTML = html;
  box._html = html;
  const nr = box.querySelector('.chips');
  if (nr) nr.scrollLeft = left;
  scrollChips(S);
  paintPost(S);
}
function scrollChips(S) {
  const rail = S.el && S.el.querySelector('.shp-weeks .chips');
  if (rail) ui.setChips(rail, String(S.week), {scroll: true});
}

// ---- who (pre-selected from the Matchup of the Week loser)
function whoHTML(S) {
  const sg = S.sugg;
  const first = sg && sg.who && data.M[sg.who] ? [sg.who] : sg && Array.isArray(sg.options) ? sg.options.filter(id => data.M[id]) : [];
  const order = first.concat(data.ids.filter(id => !first.includes(id)));
  let hint;
  if (sg === undefined) hint = 'Checking who lost the Matchup of the Week…';
  else if (first.length === 1) {
    const c = safeContext(S.year, S.week, first[0]);
    const opp = c && data.M[c.opp] ? c.opp : sg.opp && data.M[sg.opp] ? sg.opp : null;
    hint = opp ? `${nm(first[0])} lost the Matchup of the Week to ${nm(opp)}.` : `${nm(first[0])} lost the Matchup of the Week.`;
  } else if (first.length === 2) {
    hint = sg.tie ? `${nm(first[0])} and ${nm(first[1])} tied in the Matchup of the Week. Who took the podium?`
      : `${nm(first[0])} vs ${nm(first[1])} was the Matchup of the Week. Who lost?`;
  } else hint = `No Matchup of the Week vote for week ${S.week}. Pick who was at the podium.`;
  const items = order.map(id => ({id, label: nm(id), lead: ui.avatar(id, {size: 24})}));
  return `<p class="shp-hint">${esc(hint)}</p>` + ui.chips({name: 'shp-who', items, value: S.who || '', label: 'At the podium', cls: 'shp-who-chips'});
}
function paintWho(S) {
  const box = S.el && S.el.querySelector('.shp-who');
  if (!box) return;
  const html = whoHTML(S);
  if (box._html !== html) { box.innerHTML = html; box._html = html; }
  paintPost(S);
}
// (Re)runs the suggestion for the chosen week; a manager picked by hand is never overridden.
function suggest(S) {
  const seq = ++S.suggSeq;
  S.sugg = undefined;
  paintWho(S);
  const y = S.year, w = S.week;
  loserOf(y, w).then(r => {
    if (S.dead || seq !== S.suggSeq) return;
    S.sugg = r;
    if (!S.whoTouched) {
      const ex = byKeyOf(S.snap)[keyOf(y, w)];
      S.who = r && r.who && data.M[r.who] ? r.who : ex && data.M[ex.who] ? ex.who : null;
    }
    paintWho(S);
  });
}

// ---- post
function whyNot(S) {
  const st = S.link.state;
  if (st === 'empty') return 'Paste a YouTube link to post.';
  if (st === 'bad' || st === 'private' || st === 'missing') return "That link can't be posted.";
  if (st === 'checking') return 'Checking the link…';
  if (!S.week) return 'Pick the week.';
  if (!S.who) return 'Pick who was at the podium.';
  return '';
}
function paintPost(S) {
  if (!S.el) return;
  const b = S.el.querySelector('[data-shp-post]');
  const why = S.el.querySelector('.shp-why');
  const w = whyNot(S);
  if (b && !S.busy) {
    b.disabled = !!w;
    const ex = byKeyOf(S.snap)[keyOf(S.year, S.week)];
    const l = b.querySelector('.btn-label');
    const want = ex ? `Replace week ${S.week}` : 'Post';
    if (l && l.textContent !== want) l.textContent = want;
  }
  if (why && why.textContent !== w) why.textContent = w;
}
function paintCheck(S) {
  const box = S.el && S.el.querySelector('.shp-check');
  if (box) box.innerHTML = checkHTML(S);
}
async function submit(S) {
  if (S.busy || S.dead || whyNot(S)) return;
  const {year, week} = S;
  const key = keyOf(year, week);
  const ex = byKeyOf(S.snap)[key];
  if (ex) {
    const v = await ui.actionSheet({title: `Replace week ${week}'s press conference?`,
      message: `${poss(nm(ex.who))} video comes off the Press Room for everyone. It stays on YouTube.`,
      actions: [{label: 'Replace', value: 'replace', role: 'destructive'}]});
    if (v !== 'replace' || S.dead || S.busy) return;
  }
  const cap = S.el.querySelector('#shp-cap');
  const body = {year, week, vid: S.link.p.vid, who: S.who, title: cap ? cap.value.trim().slice(0, CAP_MAX).trim() : '', tall: !!S.tall};
  const btn = S.el.querySelector('[data-shp-post]');
  S.busy = true;
  ui.setLoading(btn, true);
  let r;
  try { r = await press.post(body); } catch (e) { console.error(e); r = 'failed'; }
  S.busy = false;
  if (!S.dead) { ui.setLoading(btn, false); paintPost(S); }
  if (r === 'ok' || r === 'dev') {
    ui.haptic('success');
    S.result = key;
    const msg = r === 'ok' ? 'Posted' : 'Saved on this device (dev)';
    const on = S.onPosted;
    if (!S.dead) S.sheet.close();
    if (on) { ui.toast(msg, {icon: 'check-circle'}); try { on(key); } catch (e) { console.error(e); } }
    else ui.toast(msg, {icon: 'check-circle', action: {label: 'Watch', fn: () => goPress(key)}});
    ui.announce(`${presserName({who: body.who, year, week})} posted.`);
    return;
  }
  ui.haptic('warning');
  const m = r === 'denied' ? OFF_MSG : POST_FAIL;
  ui.toast(m, {icon: r === 'denied' ? 'info' : 'x-circle'});
  ui.announce(m);
}

function wireSheet(S) {
  const el = S.el;
  el.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'shp-link') {
      clearTimeout(S.linkT);
      const v = t.value;
      if (!v.trim()) { checkLink(S, ''); return; }
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertReplacementText') checkLink(S, v);
      else S.linkT = setTimeout(() => checkLink(S, v), 450);
    } else if (t.id === 'shp-cap') paintCount(S);
  });
  el.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key !== 'Enter' || !t || (t.id !== 'shp-link' && t.id !== 'shp-cap')) return;
    e.preventDefault();
    if (t.id === 'shp-link') checkLink(S, t.value);
    t.blur();
  });
  el.addEventListener('focusout', e => { if (e.target && e.target.id === 'shp-link') checkLink(S, e.target.value); });
  el.addEventListener('change', e => {
    const t = e.target;
    if (!t || t.name !== 'shp-year') return;
    const y = +t.value;
    if (!y || y === S.year) return;
    S.year = y;
    S.weekTouched = true;
    const opts = weekOpts(y);
    if (!opts.includes(S.week)) S.week = opts[opts.length - 1] || 1;
    paintWeeks(S);
    if (!S.whoTouched) suggest(S); else paintPost(S);
  });
  el.addEventListener('ui:change', e => {
    const d = e.detail || {};
    if (d.name === 'shp-week') {
      const w = +d.value;
      if (!w || w === S.week) return;
      S.week = w;
      S.weekTouched = true;
      paintWeeks(S);
      if (!S.whoTouched) suggest(S); else paintPost(S);
    } else if (d.name === 'shp-who') {
      S.who = data.M[d.value] ? d.value : null;
      S.whoTouched = true;
      paintPost(S);
    } else if (d.name === 'shp-tall') {
      S.tall = !!d.value;
      S.tallTouched = true;
    }
  });
  el.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-shp-paste], [data-shp-post]');
    if (!t) return;
    if (t.hasAttribute('data-shp-paste')) { ui.haptic('light'); pasteLink(S); }
    else if (t.hasAttribute('data-shp-post')) submit(S);
  });
}

// ============================================================================ Screen
// Pushed on any tab, so a Press Room can be mounted on two tabs at once: each keeps its own state (screens: ctx ->
// state). memo.snap is the last subscribePressers payload, so a re-mounted screen paints at once.
const memo = {snap: null};
const screens = new Map();

function newState(ctx, el) {
  const k = ctx && ctx.params && ctx.params.key != null ? String(ctx.params.key) : null;
  return {ctx, el, snap: memo.snap, want: k, unsub: null, idle: null, names: '', miss: null, grace: null,
    autoplay: false, goneShown: false, stop: null, onClick: null, dead: false};
}

// The view model: the list, what is featured, and the state of the load.
function vm(s) {
  const snap = s.snap;
  const list = snapList(snap).filter(p => p && p.key && VID_RE.test(String(p.vid || '')));
  const byKey = byKeyOf(snap);
  const err = snap && snap.error ? String(snap.error) : null;
  const ready = !!(snap && snap.ready);
  const loading = !list.length && !ready && !err;
  let feat = null, waiting = false;
  if (s.want && byKey[s.want]) feat = byKey[s.want];
  else if (s.want && parseKey(s.want) && !ready && !err) waiting = true;
  else feat = list[0] || null;
  return {snap, list, byKey, err, ready, loading, feat, waiting, dev: !!(snap && snap.dev)};
}

// ---- markup
function loadingHTML() {
  return `<div class="card pr-card pr-sk" aria-hidden="true"><span class="sk pr-sk-media"></span>`
    + `<div class="pr-sk-body"><span class="sk sk-circle"></span><span class="pr-sk-lines"><span class="sk sk-line"></span><span class="sk sk-line"></span></span></div></div>`
    + `<div class="pr-sk-rows">${ui.skeleton('rows', 3, {label: 'Loading the Press Room.'})}</div>`;
}
function featHTML(p) {
  const act = (icon, label, attr, cls = '') => `<button type="button" class="pr-act${cls}" ${attr}="${esc(p.key)}">${ui.icon(icon)}<span>${label}</span></button>`;
  return `<section class="card pr-card" aria-label="${esc(presserName(p))}" data-enter>`
    + tileHTML(p, {size: 'l'})
    + `<div class="pr-acts">${act('share', 'Share', 'data-pr-share')}${act('swap', 'Replace', 'data-pr-replace')}${p.seed ? '' : act('x-circle', 'Remove', 'data-pr-remove', ' is-destructive')}</div>`
    + `</section>`;
}
function featSkHTML() {
  return `<div class="card pr-card pr-sk" aria-hidden="true"><span class="sk pr-sk-media"></span><div class="pr-sk-body"><span class="sk sk-circle"></span><span class="pr-sk-lines"><span class="sk sk-line"></span><span class="sk sk-line"></span></span></div></div>`;
}
function bannerHTML(v) {
  if (!v.err) return '';
  const t = v.err === 'denied' ? OFF_MSG : "Couldn't load the Press Room. Check your connection.";
  return `<p class="pr-banner">${ui.icon('info')}<span>${esc(t)}</span>${v.err === 'denied' ? '' : `<button type="button" class="pr-banner-a" data-pr-retry>Try again</button>`}</p>`;
}
// The Matchup of the Week loser who hasn't posted yet: press.defaultWeek (the latest finished week of the live season
// still without a presser), when that week's games are over and it really has none.
function missingWeek(v) {
  let d = null;
  try { d = press.defaultWeek(undefined, {list: v.list}); } catch (e) { d = null; }
  if (!d || !d.year || !d.week) return null;
  const key = keyOf(d.year, d.week);
  if (v.byKey[key]) return null;
  let over = true;
  try { over = press.weekOver(d.year, d.week); } catch (_) { over = true; }
  return over ? {year: d.year, week: d.week, key} : null;
}
function promptHTML(s, v) {
  if (!v.ready || v.err) return '';
  const m = missingWeek(v);
  const sg = m && s.miss && s.miss.key === m.key && !s.miss.pending ? s.miss.r : null;
  if (!sg) return '';
  let lead, title, sub;
  if (sg.who && data.M[sg.who]) {
    const c = safeContext(m.year, m.week, sg.who);
    lead = ui.avatar(sg.who, {size: 40});
    title = `${nm(sg.who)} hasn't faced the media yet`;
    sub = c && data.M[c.opp] ? `${cap1(contextText({year: m.year, week: m.week, ctx: c}, {week: false}))} in the Matchup of the Week.` : 'Lost the Matchup of the Week.';
  } else if (Array.isArray(sg.options) && sg.options.length === 2 && sg.options.every(id => data.M[id])) {
    lead = `<span class="pr-miss-ic">${ui.icon('mic')}</span>`;
    title = sg.tie ? `Week ${m.week}'s press conference isn't up yet` : `Week ${m.week}'s loser hasn't faced the media yet`;
    sub = `${nm(sg.options[0])} ${sg.tie ? 'and' : 'vs'} ${nm(sg.options[1])} ${sg.tie ? 'tied in' : 'was'} the Matchup of the Week.`;
  } else return '';
  return `<button type="button" class="card pr-miss" data-pr-post="${esc(m.key)}" aria-label="${esc(`Week ${m.week}. ${title}. ${sub} Post it`)}">`
    + `<span class="pr-miss-lead">${lead}</span>`
    + `<span class="pr-miss-tx" aria-hidden="true"><span class="ovl pr-miss-o">Week ${m.week}</span><span class="pr-miss-t">${esc(title)}</span><span class="pr-miss-s">${esc(sub)}</span></span>`
    + `<span class="pr-miss-go" aria-hidden="true">${ui.icon('plus')}<span>Post</span></span></button>`;
}
function archHTML(v) {
  const years = [];
  const at = new Map();
  v.list.forEach(p => {
    let g = at.get(p.year);
    if (!g) { g = {year: p.year, items: []}; at.set(p.year, g); years.push(g); }
    g.items.push(p);
  });
  years.sort((a, b) => b.year - a.year);
  const fk = v.feat ? v.feat.key : null;
  const me = data.me();
  const groups = years.map((g, i) => {
    const rows = g.items.map(p => {
      const sub = capOf(p) || cap1(contextText(p, {week: false})) || '';
      const on = p.key === fk;
      return ui.row({lead: thumbHTML(p, 'pr-row-th'), title: `Week ${p.week} · ${nm(p.who)}`, sub,
        trail: ui.avatar(p.who, {size: 28, you: p.who === me}), selected: on, key: p.key, cls: 'pr-row',
        attrs: {'data-pr-key': p.key, 'aria-label': `${presserName(p)}${capOf(p) ? ': ' + capOf(p) : ''}. ${on ? 'Showing above. Play' : 'Play'}`}});
    }).join('');
    const n = g.items.length;
    return `<div class="group-wrap"${i < 2 ? ' data-enter' : ''}><h3 class="group-h">${esc(`${g.year} season · ${n} ${n === 1 ? 'press conference' : 'press conferences'}`)}</h3>${ui.group(rows, {cls: 'pr-arch-g'})}</div>`;
  }).join('');
  return `<h2 class="t-2 pr-h">Archive</h2>${groups}`;
}
function helpHTML() {
  return `<div class="group-wrap pr-help"><h3 class="group-h">How to post</h3><div class="group">${stepsHTML()}</div><p class="group-f">${esc(STEPS_FOOT)}</p></div>`;
}
function devHTML(v) {
  return v.dev ? 'Test mode: posts are saved in this browser only.' : '';
}
function emptyHTML() {
  return ui.empty({icon: 'mic', title: 'No press conferences yet',
    body: 'After each Matchup of the Week, the loser takes the podium. Post the video here so the league can rewatch it.',
    action: {label: 'Post the first one', kind: 'primary', icon: 'plus', attrs: {'data-pr-post': ''}}});
}
function errHTML(err) {
  if (err === 'denied') return ui.empty({icon: 'mic', title: OFF_MSG, body: 'The rules for it need to be switched on in the database first.'});
  return ui.empty({icon: 'mic', title: "Couldn't load the Press Room.", body: 'Check your connection.', action: {label: 'Try again', attrs: {'data-pr-retry': ''}}});
}
// The body as ordered sections [name, html]; a change in the list of names re-renders the body, else each section
// is patched on its own (so a playing video keeps playing when something else changes).
function sections(s) {
  const v = vm(s);
  if (v.loading) return [['load', loadingHTML()]];
  if (!v.list.length) return [[v.err ? 'err' : 'empty', v.err ? errHTML(v.err) : emptyHTML()], ['help', helpHTML()], ['dev', devHTML(v)]];
  return [
    ['banner', bannerHTML(v)],
    ['feat', v.feat ? featHTML(v.feat) : featSkHTML()],
    ['prompt', promptHTML(s, v)],
    ['arch', archHTML(v)],
    ['help', helpHTML()],
    ['dev', devHTML(v)]
  ];
}
const secHTML = ([k, h]) => `<div class="pr-sec pr-sec-${k}" data-pr-sec="${k}">${h}</div>`;
function pageHTML(s) {
  return ui.largeTitle({eyebrow: 'Matchup of the Week', title: 'Press Room', subtitle: 'The loser faces the media.'})
    + `<div class="pr-main">${sections(s).map(secHTML).join('')}</div>`;
}

// ---- patching
function markSections(s) {
  const main = s.el.querySelector('.pr-main');
  if (!main) return;
  const secs = sections(s);
  s.names = secs.map(x => x[0]).join();
  secs.forEach(([k, h]) => { const b = main.querySelector(`:scope > [data-pr-sec="${k}"]`); if (b) b._html = h; });
}
function patch(s, {fade = false} = {}) {
  if (!s || s.dead || !s.el) return;
  const main = s.el.querySelector('.pr-main');
  if (!main) return;
  const secs = sections(s);
  const names = secs.map(x => x[0]).join();
  if (names !== s.names) {
    const wasLoading = s.names === 'load';
    stopIn(main); // a crossfade snapshot must never carry a live player
    const put = () => {
      main.innerHTML = secs.map(secHTML).join('');
      secs.forEach(([k, h]) => { const b = main.querySelector(`:scope > [data-pr-sec="${k}"]`); if (b) b._html = h; });
      s.names = names;
      ui.hydrate(main);
      scanThumbs(main);
    };
    if (s.ctx.visible && !ui.RM && !wasLoading) ui.crossfade(main, put, {duration: 160});
    else {
      put();
      if (wasLoading && s.ctx.visible && !ui.RM) ui.animate(main, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
    }
    return;
  }
  secs.forEach(([k, h]) => {
    const box = main.querySelector(`:scope > [data-pr-sec="${k}"]`);
    if (!box || box._html === h) return;
    if (k === 'feat') { patchFeat(s, box, h, fade); return; }
    const had = !!box.firstElementChild;
    box.innerHTML = h;
    box._html = h;
    ui.hydrate(box);
    scanThumbs(box);
    if (k === 'prompt' && h && !had && s.ctx.visible && !ui.RM) ui.animate(box, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.22,1,.36,1)'});
  });
}
// The featured card. The same video still playing keeps its player: only the words and actions are refreshed.
function patchFeat(s, box, h, fade) {
  const tile = box.querySelector('.c-press');
  const frame = tile && tile.querySelector('.c-press-frame.is-playing');
  const t = document.createElement('template');
  t.innerHTML = h;
  const nt = t.content.querySelector('.c-press');
  if (frame && nt && tile.dataset.pressKey === nt.dataset.pressKey && tile.dataset.pressVid === nt.dataset.pressVid
    && tile.hasAttribute('data-press-tall') === nt.hasAttribute('data-press-tall')) {
    const b0 = tile.querySelector('.c-press-body'), b1 = nt.querySelector('.c-press-body');
    if (b0 && b1 && b0.innerHTML !== b1.innerHTML) b0.innerHTML = b1.innerHTML;
    const a0 = box.querySelector('.pr-acts'), a1 = t.content.querySelector('.pr-acts');
    if (a0 && a1 && a0.innerHTML !== a1.innerHTML) a0.innerHTML = a1.innerHTML;
    box._html = h;
    return;
  }
  stopIn(box);
  const put = () => {
    box.innerHTML = h;
    box._html = h;
    const c = box.querySelector('[data-enter]');
    if (c) c.removeAttribute('data-enter');
    scanThumbs(box);
  };
  if (fade && s.ctx.visible && !ui.RM) ui.crossfade(box, put, {duration: 160}); else put();
}

// ---- data
function subscribe(s) {
  if (s.unsub || s.dead) return;
  try {
    s.unsub = press.subscribePressers(u => {
      if (s.dead || !u) return;
      memo.snap = u;
      s.snap = u;
      // Data-driven DOM work waits for the push animation and for scrolling to settle.
      if (s.idle) s.idle();
      s.idle = ui.whenIdle(() => { s.idle = null; refresh(s); });
    });
  } catch (e) {
    console.error(e);
    s.snap = {list: snapList(s.snap), byKey: byKeyOf(s.snap), ready: true, error: 'failed', dev: false};
    refresh(s);
  }
}
function unsubscribe(s) {
  if (s.idle) { s.idle(); s.idle = null; }
  if (typeof s.unsub === 'function') { try { s.unsub(); } catch (_) {} }
  s.unsub = null;
}
function refresh(s) {
  if (!s || s.dead) return;
  resolveWant(s);
  startMiss(s);
  patch(s);
  autoplay(s);
}
// The route's week: a malformed key, or one the server doesn't have (once it answered), lands on the archive.
function resolveWant(s) {
  const k = s.want;
  if (!k) return;
  const v = vm(s);
  const P = parseKey(k);
  if (P && v.byKey[k]) return;
  if (P && (!v.ready || v.err)) return;
  if (P && s.grace && s.grace.key === k && Date.now() < s.grace.until) return; // just posted: its snapshot is on the way
  s.want = null;
  s.autoplay = false;
  if (!s.goneShown) { s.goneShown = true; ui.toast(GONE_MSG, {icon: 'info'}); }
  if (s.ctx.path !== '/press') s.ctx.replace('/press');
}
// The prompt's Matchup of the Week lookup (press.js caches the season's votes).
function startMiss(s) {
  const v = vm(s);
  if (!v.ready || v.err) return;
  const m = missingWeek(v);
  if (!m || (s.miss && s.miss.key === m.key)) return;
  const miss = {key: m.key, pending: true, r: null};
  s.miss = miss;
  loserOf(m.year, m.week).then(r => {
    if (s.dead || s.miss !== miss) return;
    miss.pending = false;
    miss.r = r;
    if (s.idle) return; // a refresh is already on its way
    s.idle = ui.whenIdle(() => { s.idle = null; patch(s); });
  });
}
// A week link opened from a tap in the app (Today's "New press conference", a profile tile) starts playing once the
// presser is on screen. A cold link doesn't: nothing may autoplay without a tap.
function autoplay(s) {
  if (!s.autoplay || !s.ctx.visible) return;
  const v = vm(s);
  if (v.waiting) return;
  s.autoplay = false;
  if (!v.feat || v.feat.key !== s.want) return;
  const act = navigator.userActivation;
  if (act && !act.isActive) return;
  const tile = s.el.querySelector('[data-pr-sec="feat"] .c-press');
  if (tile) playTile(tile);
}

// ---- actions
function featureKey(s, key, {play = true} = {}) {
  const v = vm(s);
  const p = v.byKey[key];
  if (!p) return;
  stopAll();
  s.want = key;
  patch(s, {fade: true});
  const sc = s.ctx.screen;
  if (sc && sc.scrollTop > 0) sc.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
  // Inside the tap (user activation): YouTube starts with sound.
  if (play) { const tile = s.el.querySelector('[data-pr-sec="feat"] .c-press'); if (tile) playTile(tile); }
  const path = '/press/' + encodeURIComponent(key);
  if (s.ctx.path !== path) s.ctx.replace(path);
}
function onPosted(s) {
  return key => {
    if (s.dead) return;
    s.grace = {key, until: Date.now() + 10000};
    s.goneShown = false;
    s.want = key;
    stopAll();
    const sc = s.ctx.screen;
    if (sc && sc.scrollTop > 0) sc.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
    patch(s, {fade: true});
    const path = '/press/' + encodeURIComponent(key);
    if (s.ctx.path !== path) s.ctx.replace(path);
  };
}
function sharePresser(s, key) {
  const p = vm(s).byKey[key];
  if (!p) return;
  // ui.share runs synchronously inside the tap (iOS user activation).
  ui.share({text: `${SPEAK} ${presserName(p)}`, url: ui.absLink('/press/' + encodeURIComponent(p.key))}).then(r => {
    if (r === 'copied') ui.toast('Link copied. Paste it in the league chat.', {icon: 'check-circle'});
    else if (r === 'unavailable') ui.toast("Couldn't copy the link.", {icon: 'x-circle'});
  });
}
async function removePresser(s, key) {
  const p = vm(s).byKey[key];
  if (!p || p.seed) return;
  const v = await ui.actionSheet({title: `Remove week ${p.week}'s press conference?`,
    message: `${poss(nm(p.who))} video comes off the Press Room for everyone. It stays on YouTube.`,
    actions: [{label: 'Remove', value: 'remove', role: 'destructive'}]});
  if (v !== 'remove') return;
  let r;
  try { r = await press.remove(key); } catch (e) { console.error(e); r = 'failed'; }
  if (r === 'ok' || r === 'dev') {
    ui.haptic('success');
    ui.toast(r === 'ok' ? 'Removed' : 'Removed on this device (dev)', {icon: 'check-circle'});
    // Gone for good (a seeded week falls back to its seed, which stays featured).
    if (!s.dead && s.want === key && !vm(s).byKey[key]) {
      s.want = null;
      stopAll();
      patch(s, {fade: true});
      if (s.ctx.path !== '/press') s.ctx.replace('/press');
    }
    return;
  }
  ui.haptic('warning');
  ui.toast(r === 'denied' ? OFF_MSG : "Couldn't remove it. Try again.", {icon: r === 'denied' ? 'info' : 'x-circle'});
}
function onClick(s, e) {
  const t = e.target.closest && e.target.closest('[data-pr-key], [data-pr-share], [data-pr-replace], [data-pr-remove], [data-pr-post], [data-pr-retry]');
  if (!t || !s.el.contains(t)) return;
  if (t.hasAttribute('data-pr-key')) { ui.haptic('light'); featureKey(s, t.dataset.prKey, {play: true}); }
  else if (t.hasAttribute('data-pr-share')) sharePresser(s, t.dataset.prShare);
  else if (t.hasAttribute('data-pr-replace')) { ui.haptic('light'); openPost({key: t.dataset.prReplace, onPosted: onPosted(s)}); }
  else if (t.hasAttribute('data-pr-remove')) { ui.haptic('light'); removePresser(s, t.dataset.prRemove); }
  else if (t.hasAttribute('data-pr-post')) { ui.haptic('light'); openPost({key: t.dataset.prPost || undefined, onPosted: onPosted(s)}); }
  else if (t.hasAttribute('data-pr-retry')) {
    ui.haptic('light');
    unsubscribe(s);
    s.snap = memo.snap = null;
    patch(s);
    subscribe(s);
  }
}

// ============================================================================ View
export default {
  id: 'press',
  title: 'Press Room',
  actions: () => [{id: 'post', icon: 'plus', label: 'Post a press conference'}],

  render(ctx) {
    // Pure: the module memo (an earlier visit's list) and the route, nothing else.
    return pageHTML(newState(ctx, null));
  },

  mount(el, ctx) {
    const s = newState(ctx, el);
    screens.set(ctx, s);
    markSections(s);
    s.stop = bindPlayers(el);
    s.onClick = e => onClick(s, e);
    el.addEventListener('click', s.onClick);
    // Opened from a tap on a week link: play it once it's on screen.
    const act = navigator.userActivation;
    s.autoplay = !!s.want && (!act || act.isActive);
    if (ctx.first) ui.stagger(el);
    subscribe(s);
    // A malformed week key goes straight to the archive (after the push; the first snapshot would do it too).
    if (s.want && !parseKey(s.want) && !s.idle) s.idle = ui.whenIdle(() => { s.idle = null; refresh(s); });
  },

  onShow(ctx) {
    const s = screens.get(ctx);
    if (!s) return;
    subscribe(s);
    autoplay(s);
  },

  onHide(ctx) {
    // Nothing keeps playing on a hidden screen.
    const s = screens.get(ctx);
    if (!s) return;
    if (s.stop) s.stop();
    unsubscribe(s);
  },

  update(ctx) {
    const s = screens.get(ctx);
    if (!s) return;
    if (ctx.reason === 'params') {
      const k = ctx.params && ctx.params.key != null ? String(ctx.params.key) : null;
      if (k === s.want) { patch(s); return; }
      stopAll();
      s.want = k;
      s.goneShown = false;
      const act = navigator.userActivation;
      s.autoplay = !!k && (!act || act.isActive);
      patch(s, {fade: true});
      if (ctx.screen && ctx.screen.scrollTop > 0) ctx.screen.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
      refresh(s);
      return;
    }
    // 'data' (game lines fill in after the weekly update) and 'me' (your ring): patch in place.
    patch(s);
  },

  onAction(id, ctx) {
    const s = screens.get(ctx);
    if (id === 'post' && s) openPost({onPosted: onPosted(s)});
  },

  unmount(el, ctx) {
    const s = screens.get(ctx);
    if (!s) return;
    if (s.stop) s.stop();
    stopIn(el);
    unsubscribe(s);
    el.removeEventListener('click', s.onClick);
    s.dead = true;
    screens.delete(ctx);
  }
};
