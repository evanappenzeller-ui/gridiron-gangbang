// Service worker (spec 11). Bump CACHE on every deploy.
// Network-first (2.5 s timeout, then cache) for navigations, HTML, JSON, JS and CSS, so weekly data and new
// puzzles show up right away; cache-first for the font, icons, pictures and 3D models. Other apps share this origin, so only
// caches named gg-* or gridiron-* are ever deleted, and cross-origin requests (Firebase, the ESPN scoreboard and
// team logos, the Press Room's YouTube player and thumbnails) are never touched: live scores must never come from a
// cache here.
// A slow request falls back to whatever is cached under its path (from the previous worker too), so data whose
// format changes gets a new file name rather than new content under the old one (data/puzzles-v4.json: see
// js/core/daily.js).
const CACHE = 'gg-v432';
const CORE = ['ui', 'data', 'daily', 'fire', 'week', 'nfl', 'stats', 'motw', 'press', 'checks', 'checks-stats', 'checks-pickem', 'checks-press', 'checks-seventeen', 'checks-drill', 'checks-kick', 'return', 'checks-return', 'lay', 'plays', 'laytrack', 'gameday', 'seventeen', 'drill-sim', 'drill', 'kick', 'avatars', 'lpick', 'survivor', 'checks-lpick', 'realm', 'realm-pay', 'realm-dragons', 'realm-battle', 'checks-realm'];
// The tab roots are puzzles, pickem, rivals (Matchup), league, moves (Draft), lay (The Lay) and live (Live). Keepfall opens from Daily Games.
const VIEWS = ['welcome', 'guest', 'puzzles', 'games', 'game-case', 'board', 'you', 'sharecard', 'results', 'run', 'college', 'silhouette', 'mystery', 'journey', 'grid', 'picker',
  'league', 'standings', 'season', 'review', 'wrap', 'matchup', 'rivals', 'pickem', 'press', 'hall', 'hall-trophies', 'hall-records', 'hall-shame',
  'moves', 'profile', 'lay', 'live', 'plays', 'seventeen', 'drill', 'drill-cam', 'drill-sprites', 'kick', 'stadium', 'return-world', 'return-3dworld', 'return-field-logo', 'return-style', 'return-scenery', 'return-models', 'return-city-bus', 'return-3d', 'return', 'photo', 'testplay', 'lpick', 'survivor', 'realm', 'realm-3d', 'realm-ground', 'realm-grass', 'realm-models', 'realm-walls', 'realm-sprites', 'realm-upgrade-art', 'realm-wildlife', 'realm-ambience', 'realm-heroes', 'realm-lore', 'realm-npcs', 'realm-characters', 'realm-dragon', 'realm-dragon-assets', 'realm-dragon-picker', 'realm-raid', 'realm-scout', 'realm-replay', 'realm-visit', '_kit'];
const VIEW_CSS = ['welcome', 'puzzles', 'board', 'results', 'you', 'run', 'college', 'silhouette', 'mystery', 'journey', 'grid', 'picker',
  'standings', 'season', 'review', 'wrap', 'matchup', 'rivals', 'pickem', 'press', 'hall', 'moves', 'profile', 'lay', 'live', 'plays', 'seventeen', 'drill', 'kick', 'return', 'realm', '_kit'];
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'js/core/features.js', 'js/core/release.js', 'js/core/score-release.js', 'js/core/owner-motion.js', 'css/owner-motion.css', 'css/release.css',
  'js/views/game-launch.js', 'js/views/return-player-style.js', 'js/views/return-player-bulk.js',
  'css/views/game-case-owner.css', 'css/views/game-case-controls.css', 'css/views/game-launch.css',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/themes.css', 'css/finish.css', 'js/themes.js', 'js/lock.js',
  ...VIEW_CSS.map(v => `css/views/${v}.css`),
  'js/app.js', ...CORE.map(m => `js/core/${m}.js`),
  ...VIEWS.map(v => `js/views/${v}.js`),
  // Code only: larger artwork and models load and cache on demand.
  'js/views/realm-attack-art.js',
  'fonts/barlow-condensed-800.woff2', 'fonts/cinzel-latin.woff2', 'fonts/press-start-2p.woff2', 'fonts/vt323.woff2', 'img/logo.webp', 'img/nfl.webp', 'img/ncaa.webp', 'img/league.webp', 'img/survivor.webp', 'img/puzzles.webp', 'img/seventeen.webp', 'img/drill.webp',
  'img/games/puzzles-cover.webp', 'img/games/seventeen-cover.webp', 'img/games/drill-cover.webp', 'img/games/kick-cover.webp', 'img/games/return-man-2-cover.webp', 'img/games/smoke.webp',
  'img/games/puzzles-book.webp', 'img/games/seventeen-book.webp', 'img/games/drill-book.webp', 'img/games/kick-book.webp', 'img/games/return-book.webp',
  'img/games/puzzles-disc.webp', 'img/games/seventeen-disc.webp', 'img/games/drill-disc.webp', 'img/games/kick-disc.webp', 'img/games/return-disc.webp', 'img/return.webp', 'img/kick.webp',
  'img/kick/holder.webp', 'img/kick/holder-empty.webp', 'img/kick/kicker.webp', 'img/kick/kicker-follow.webp', 'img/kick/line.webp', 'img/kick/football.webp',
  'img/drill/players.webp', 'img/drill/players-mask.webp',
  'icons/hub-192.png', 'icons/hub-512.png', 'icons/hub-maskable-512.png', 'icons/hub-apple-180.png',
  'data/league.json', 'data/pressers.json', 'data/lay.json', 'data/puzzles-v4.json', 'data/nfl-players.json', 'data/seventeen.json', 'data/drill.json'
];
const TIMEOUT = 2500;

// The last version's caches (this app's only), newest last.
const ours = k => k.startsWith('gg-') || k.startsWith('gridiron-');
async function previous() {
  const names = (await caches.keys()).filter(k => k !== CACHE && ours(k));
  return Promise.all(names.reverse().map(k => caches.open(k)));
}
async function cachedIn(olds, req) {
  for (const c of olds) { const hit = await c.match(req, {ignoreVary: true}); if (hit) return hit; }
  return null;
}
// A file the last version has: asked for only if it changed (its ETag or date, a 304 when not), so an update fetches
// what's new instead of everything again. Without either, or on any doubt, it's fetched in full as before.
async function refresh(c, olds, req) {
  const prev = await cachedIn(olds, req);
  const tag = prev && prev.headers.get('ETag'), date = prev && prev.headers.get('Last-Modified');
  if (tag || date) {
    try {
      const res = await fetch(req.url, {cache: 'no-store', credentials: 'same-origin', headers: tag ? {'If-None-Match': tag} : {'If-Modified-Since': date}});
      if (res.status === 304) { await c.put(req, prev); return; }
      if (res.ok) { await c.put(req, res); return; }
    } catch (_) {}
  }
  await c.add(new Request(req.url, {cache: 'reload'}));
}

self.addEventListener('install', e => {
  // Each file is added on its own so one failure never blocks the install; network-first fills any gap.
  // Bound background downloads so an update does not flood the connection during navigation.
  // Artwork and models cached on demand by the last version come along too (checked the same way), rather than being
  // dropped with its cache and downloaded again the next time they're shown.
  e.waitUntil(caches.open(CACHE)
    .then(async c => {
      const olds = await previous();
      const shell = SHELL.map(u => new Request(u));
      const seen = new Set(shell.map(r => r.url));
      const extra = [];
      for (const o of olds) for (const r of await o.keys()) {
        if (!seen.has(r.url) && isCacheFirst(new URL(r.url))) { seen.add(r.url); extra.push(new Request(r.url)); }
      }
      const todo = shell.concat(extra);
      let next = 0;
      await Promise.all(Array.from({length: 6}, async () => {
        while (next < todo.length) await refresh(c, olds, todo[next++]).catch(() => {});
      }));
    })
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k !== CACHE && ours(k))
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isCacheFirst = url => /\.(woff2|png|webp|ico|glb)$/.test(url.pathname);
const isNetworkFirst = (req, url) => req.mode === 'navigate' || url.pathname.endsWith('/') || /\.(html|json|js|css|webmanifest)$/.test(url.pathname);

function put(key, res) {
  if (!res || !res.ok || res.type === 'opaque') return;
  caches.open(CACHE).then(c => c.put(key, res)).catch(() => {});
}

async function networkFirst(req, url) {
  // Cache under the bare path (retry imports add ?retry=...).
  const key = url.search ? url.origin + url.pathname : req;
  // no-cache: always ask GitHub Pages (a cheap 304 when unchanged), never the browser's 10-minute HTTP cache, so a
  // new version shows on the next open instead of up to 10 minutes later.
  const net = fetch(req.url, {cache: 'no-cache', credentials: 'same-origin'}).then(res => { put(key, res.clone()); return res; });
  net.catch(() => {}); // a late network failure after a cache hit must not surface as an unhandled rejection
  const timer = new Promise(r => setTimeout(r, TIMEOUT, 'timeout'));
  let fallback = false;
  try {
    const first = await Promise.race([net, timer]);
    if (first !== 'timeout') return first;
    fallback = true;
  } catch (_) {
    fallback = true;
  }
  const hit = await caches.match(key, {ignoreSearch: true});
  if (hit) return hit;
  if (req.mode === 'navigate') {
    const shell = (await caches.match('index.html')) || (await caches.match('./'));
    if (shell) return shell;
  }
  if (fallback) {
    try { return await net; } catch (_) { return Response.error(); }
  }
  return Response.error();
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // v3 artwork is available to everyone and cached after its first use.
  if (isCacheFirst(url)) { e.respondWith(cacheFirst(req)); return; }
  if (isNetworkFirst(req, url)) e.respondWith(networkFirst(req, url));
});
