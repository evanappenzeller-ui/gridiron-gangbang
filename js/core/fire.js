// The one shared Firebase layer: a single default app, sign-in and Firestore, loaded from gstatic
// (10.14.1) on first use. Every Firebase user (the Daily's league board in daily.js, votes and pick'em in
// week.js) goes through getFire(), because initializing a second default app throws.
// Also owns the dev-host write guard: local development never writes to the real database unless the URL has
// exactly ?post=1, and a dev ?day= preview never writes at all.
// Member accounts: a phone starts signed in anonymously (its own uid). Linking it to a league member
// (linkMember: the member's id and a 4-digit PIN) signs it in to that member's account instead, an email /
// password account '<id>@members.gridiron-gangbang.app', so every phone of a member shares one uid and their
// scores, picks and lock-ins are one person's. The first phone a member links keeps its uid (its anonymous account
// becomes the member's); a later phone switches to the member's uid. Needs the Email/Password sign-in provider on
// in the Firebase console (linkMember answers 'off' until it is).
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
export let uid = null;      // the signed-in uid (anonymous, or the member account's)
export let member = null;   // the league member this phone is signed in as (their account), or null (anonymous)
const MEMBER_DOMAIN = 'members.gridiron-gangbang.app';
const memberOf = user => { const m = user && !user.isAnonymous && /^([a-z]{1,24})@members\./.exec(user.email || ''); return m ? m[1] : null; };
const secret = (id, pin) => `gg:${id}:${pin}`; // Firebase wants 6+ characters
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
    // The account this phone is already signed in to (a member's, kept across launches), else an anonymous one.
    const A = auth.getAuth(app);
    if (A.authStateReady) await A.authStateReady();
    const user = A.currentUser || (await auth.signInAnonymously(A)).user;
    if (!db) db = fs.getFirestore(app);
    uid = user.uid;
    member = memberOf(user);
    status = 'ready';
    error = null;
    // uid reads live: linking a member account (linkMember) can change it after this resolves.
    return {fs, db, app, auth, get uid() { return uid; }};
  })();
  fireP = p;
  p.catch(e => {
    status = 'off';
    error = e;
    if (fireP === p) fireP = null; // let a later call retry (offline at first use)
  });
  return p;
}

// ---------------------------------------------------------------------------
// Member accounts (see the header)

/**
 * Links this phone to league member `id` with their 4-digit PIN. Resolves {code, from, uid}:
 *   'new'     the member had no account: this phone's account became theirs, with this PIN (same uid)
 *   'joined'  signed in to the member's account (the uid changed from `from`: the caller moves this phone's data over)
 *   'same'    already linked to them
 *   'badpin'  wrong PIN · 'slow' too many tries, wait · 'off' member sign-in isn't switched on in Firebase ·
 *   'offline' / 'failed' / 'invalid'
 */
export async function linkMember(id, pin) {
  id = String(id || ''); pin = String(pin || '');
  if (!/^[a-z]{1,24}$/.test(id) || !/^\d{4}$/.test(pin)) return {code: 'invalid'};
  let F;
  try { F = await getFire(); } catch (_) { return {code: 'failed'}; }
  if (member === id) return {code: 'same'};
  const A = F.auth.getAuth(F.app), cur = A.currentUser, from = cur ? cur.uid : null;
  const email = `${id}@${MEMBER_DOMAIN}`, pw = secret(id, pin);
  const ok = (code, user) => { uid = user.uid; member = memberOf(user); return {code, from, uid: user.uid}; };
  const why = e => {
    const c = String((e && e.code) || '');
    return /operation-not-allowed|admin-restricted/.test(c) ? 'off' : /too-many-requests/.test(c) ? 'slow' : /network/.test(c) ? 'offline'
      : /invalid-credential|wrong-password|user-not-found|invalid-login|invalid-password/.test(c) ? 'badpin' : 'failed';
  };
  // The member's first phone: this phone's anonymous account becomes theirs (its uid, and so its data, stays put).
  if (cur && cur.isAnonymous) {
    try { return ok('new', (await F.auth.linkWithCredential(cur, F.auth.EmailAuthProvider.credential(email, pw))).user); }
    catch (e) { if (!/email-already-in-use|credential-already-in-use/.test(String((e && e.code) || ''))) return {code: why(e)}; }
  }
  try { return ok('joined', (await F.auth.signInWithEmailAndPassword(A, email, pw)).user); }
  catch (e) {
    const c = why(e);
    // Signed in as another member, and this one has no account yet: make it.
    if (c === 'badpin' && cur && !cur.isAnonymous) {
      try { return ok('joined', (await F.auth.createUserWithEmailAndPassword(A, email, pw)).user); }
      catch (e2) { return {code: /email-already-in-use/.test(String((e2 && e2.code) || '')) ? 'badpin' : why(e2)}; }
    }
    return {code: c};
  }
}

/** Signs this phone out of its member account, back to a fresh anonymous one. Resolves true when done. */
export async function unlinkMember() {
  let F;
  try { F = await getFire(); } catch (_) { return false; }
  const A = F.auth.getAuth(F.app);
  try { await F.auth.signOut(A); const u = (await F.auth.signInAnonymously(A)).user; uid = u.uid; member = null; return true; } catch (_) { return false; }
}

/** Whether member sign-in is switched on in the Firebase console (Email/Password provider): a sign-in try for an
 *  account that doesn't exist answers "not allowed" while it's off. Asked once a session. Resolves true | false |
 *  null (unknown: offline). */
let onP = null;
export function memberSignInOn() {
  if (onP) return onP;
  const c = config();
  if (!c.apiKey) return Promise.resolve(false);
  onP = fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(c.apiKey), {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'nobody@' + MEMBER_DOMAIN, password: 'gg:probe:0000', returnSecureToken: false})
  }).then(r => r.json()).then(j => !/OPERATION_NOT_ALLOWED|ADMIN_ONLY/.test(String((j && j.error && j.error.message) || '')), () => { onP = null; return null; });
  return onP;
}
