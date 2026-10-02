// Service worker (spec 11). Bump CACHE on every deploy.
// Network-first (2.5 s timeout, then cache) for navigations, HTML, JSON, JS and CSS, so weekly data and new
// puzzles show up right away; cache-first for the font and icons. Other apps share this origin, so only
// caches named gg-* or gridiron-* are ever deleted, and cross-origin requests (Firebase, the ESPN scoreboard and
// team logos, the Press Room's YouTube player and thumbnails) are never touched: live scores must never come from a
// cache here.
// A slow request falls back to whatever is cached under its path (from the previous worker too), so data whose
// format changes gets a new file name rather than new content under the old one (data/puzzles-v4.json: see
// js/core/daily.js).
const CACHE = 'gg-v61';
const CORE = ['ui', 'data', 'daily', 'fire', 'week', 'nfl', 'stats', 'motw', 'press', 'checks', 'checks-stats', 'checks-pickem', 'checks-press', 'lay', 'plays', 'laytrack'];
// The six tab roots are puzzles, pickem, rivals (Matchup), league, moves (Draft) and lay (The Lay).
const VIEWS = ['welcome', 'puzzles', 'board', 'you', 'sharecard', 'results', 'run', 'college', 'silhouette', 'mystery', 'journey', 'grid', 'picker',
  'league', 'standings', 'season', 'review', 'wrap', 'matchup', 'rivals', 'pickem', 'press', 'hall', 'hall-trophies', 'hall-records', 'hall-shame',
  'moves', 'profile', 'lay', 'plays', '_kit'];
const VIEW_CSS = ['welcome', 'puzzles', 'board', 'results', 'you', 'run', 'college', 'silhouette', 'mystery', 'journey', 'grid', 'picker',
  'standings', 'season', 'review', 'wrap', 'matchup', 'rivals', 'pickem', 'press', 'hall', 'moves', 'profile', 'lay', 'plays', '_kit'];
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/components.css',
  ...VIEW_CSS.map(v => `css/views/${v}.css`),
  'js/app.js', ...CORE.map(m => `js/core/${m}.js`),
  ...VIEWS.map(v => `js/views/${v}.js`),
  'fonts/barlow-condensed-800.woff2', 'fonts/press-start-2p.woff2', 'fonts/vt323.woff2', 'img/logo.webp', 'img/nfl.webp', 'img/ncaa.webp',
  'icons/hub-192.png', 'icons/hub-512.png', 'icons/hub-maskable-512.png', 'icons/hub-apple-180.png',
  'data/league.json', 'data/pressers.json', 'data/lay.json', 'data/puzzles-v4.json'
];
const TIMEOUT = 2500;

self.addEventListener('install', e => {
  // Each file is added on its own so one failure never blocks the install; network-first fills any gap.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k !== CACHE && (k.startsWith('gg-') || k.startsWith('gridiron-')))
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isCacheFirst = url => /\.(woff2|png|webp|ico)$/.test(url.pathname);
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
  if (isCacheFirst(url)) { e.respondWith(cacheFirst(req)); return; }
  if (isNetworkFirst(req, url)) e.respondWith(networkFirst(req, url));
});
