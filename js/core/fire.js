// The one shared Firebase layer: a single default app, anonymous sign-in and Firestore, loaded from gstatic
// (10.14.1) on first use. Every Firebase user (the Daily's league board in daily.js, votes and pick'em in
// week.js) goes through getFire(), because initializing a second default app throws.
// Also owns the dev-host write guard: local development never writes to the real database unless the URL has
// exactly ?post=1, and a dev ?day= preview never writes at all.
// No DOM rendering here. Owner: core.

const V = 'https://www.gstatic.com/firebasejs/10.14.1/';

// ---------------------------------------------------------------------------
// Dev hosts and the write guard (moved from daily.js; the classifier was widened in the week-features fix pass)
// "Local" covers loopback (all of 127/8, 0.0.0.0, ::1 and IPv4-mapped loopback), bare machine names
// ("evan-pc": public hosts always have a dot), *.localhost / *.test / *.local / *.lan / *.home.arpa /
// *.internal / *.ts.net names, private LAN addresses (a phone on the same Wi-Fi reaching the dev server by IP),
// carrier-grade NAT / Tailscale (100.64/10) and IPv6 link-local / unique-local literals. The guard now protects
// the league board, votes and pick'em, so anything that is plainly a private host counts as dev.
// Production (github.io, or a custom domain later) is unaffected.
const LOCAL_HOSTS = ['localhost', '0.0.0.0', '[::1]', '::1', '[::]'];
export const isDevHost = h => {
  h = String(h || '').toLowerCase();
  if (!h) return false;
  return LOCAL_HOSTS.includes(h)
    || !h.includes('.') && !h.includes(':')                           // single-label machine name
    || /\.(localhost|test|local|lan|home\.arpa|internal|ts\.net)$/.test(h)
    || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h)
    || /^\[?(fe[89ab][0-9a-f]:|f[cd][0-9a-f]{2}:|::ffff:(127\.|7f[0-9a-f]{2}:))/.test(h);  // IPv6 link-local, ULA, mapped loopback
};

// Dev preview: on a dev host, ?day=<PNUM> in location.search (before the #) plays that puzzle day instead of
// today's (daily.js). Production hosts ignore it. null when not overridden.
export function devDayFrom(search, host) {
  if (!isDevHost(host)) return null;
  let v = null;
  try { v = new URLSearchParams(search || '').get('day'); } catch (_) { v = null; }
  return v && /^[1-9]\d{0,3}$/.test(v) ? +v : null;
}

let host = '', postParam = false, devDay = null;
try { host = location.hostname; } catch (_) { host = ''; }
try { postParam = new URLSearchParams(location.search).get('post') === '1'; } catch (_) { postParam = false; }
try { devDay = devDayFrom(location.search, host); } catch (_) { devDay = null; }

export const DEV_HOST = isDevHost(host);
export const DEV_DAY = devDay;
// A previewed day never writes, even with ?post=1 (its score would land on the real board under a future day).
const WRITES = !(DEV_HOST && (!postParam || devDay != null));
// True when this page may write to the real database: always in production; on a dev host only with exactly
// ?post=1 and no ?day= preview.
export function canWrite() { return WRITES; }

// ---------------------------------------------------------------------------
// State (live bindings)
export let status = 'idle'; // 'idle' | 'loading' | 'ready' | 'off'
export let uid = null;      // the anonymous uid once signed in
export let error = null;    // the last init error (status 'off')

// Firebase error -> the app's result codes.
export function codeOf(e) {
  const c = e && e.code;
  if (c === 'permission-denied') return 'denied';
  if (c === 'off') return 'off';
  if (c === 'resource-exhausted') return 'full';
  return 'failed';
}

let cfg;
function config() {
  if (cfg !== undefined) return cfg;
  try { cfg = JSON.parse(document.getElementById('firebase-config').textContent) || {}; } catch (_) { cfg = {}; }
  return cfg;
}

let modsP = null, app = null, db = null, fireP = null;

// Initializes the app, anonymous auth and Firestore once. Resolves {fs, db, uid, app, auth}: `fs` is the
// firebase-firestore module namespace (doc, collection, setDoc, onSnapshot, serverTimestamp ...), `auth` the
// firebase-auth namespace. Rejects (err.code 'off' when there is no config) and sets status 'off'; after a
// network failure the next call tries again (the app itself is only ever initialized once).
export function getFire() {
  if (fireP) return fireP;
  const c = config();
  if (!c.apiKey || !c.projectId) {
    status = 'off';
    error = Object.assign(new Error('Firebase is not configured.'), {code: 'off'});
    fireP = Promise.reject(error);
    fireP.catch(() => {});
    return fireP;
  }
  status = 'loading';
  const p = (async () => {
    if (!modsP) modsP = Promise.all([import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js')]);
    let mods;
    try { mods = await modsP; } catch (e) { modsP = null; throw e; }
    const [appMod, auth, fs] = mods;
    if (!app) app = (appMod.getApps && appMod.getApps()[0]) || appMod.initializeApp(c);
    const cred = await auth.signInAnonymously(auth.getAuth(app));
    if (!db) db = fs.getFirestore(app);
    uid = cred.user.uid;
    status = 'ready';
    error = null;
    return {fs, db, uid, app, auth};
  })();
  fireP = p;
  p.catch(e => {
    status = 'off';
    error = e;
    if (fireP === p) fireP = null; // let a later call retry (offline at first use)
  });
  return p;
}
