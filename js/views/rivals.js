// Rivals: head to head for any two managers (spec 7.12, delight 8.12). Owner: rivals package.
// Mounts once, then patches: series numbers roll (odometer), the split bar re-splits, the tape and the
// meeting log cross-fade, and "{A} against everyone" reorders with FLIP.
// Above the head to head sits the week (core/week.js): Matchup of the Week voting, Pick'em with its season
// standings, and the past Matchups of the Week. They render at once from data.js and fill in when the
// Firestore snapshots arrive; nothing here waits on Firebase.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as motw from '../core/motw.js';
import * as week from '../core/week.js';

const esc = s => data.esc(s);
const nm = id => data.name(id);
const SHARE = [{id: 'share', icon: 'share', label: 'Share this rivalry'}];
const FOOTNOTE = 'Includes playoff and consolation games. Tap a name to see that matchup.';
const USER_VIA = ['swap', 'pick', 'list', 'ext']; // pair changes the person asked for (announced)

// One Rivals screen exists at a time (it is the Rivals tab root); its live state lives here and is reset
// in mount/unmount. Nothing derived from data.* outlives a reload: the model is rebuilt on every update.
let st = null;

// ============================================================================ Pair resolution
function lookup(id) {
  if (id == null || id === '') return null;
  const s = String(id);
  if (data.M[s]) return s;
  const l = s.toLowerCase();
  return data.M[l] ? l : null;
}
function reigning() {
  const s = data.DONE[0];
  return s && s.champion && data.M[s.champion] ? s.champion : null;
}
function defaultA() {
  return data.me() || reigning() || data.ids[0] || null;
}
function opponentFor(a) {
  if (!a) return null;
  let b = data.defaultOpponent(a);
  if (!b || b === a || !data.M[b]) b = data.ids.find(x => x !== a) || null;
  return b;
}
// Valid params win; a missing or unknown side falls back to the defaults (spec 7.12): A = gg-me, else the
// reigning champion, else the first id; B = defaultOpponent(A), recomputed when it would equal A.
function resolvePair(params = {}) {
  const pa = lookup(params.a), pb = lookup(params.b);
  const a = pa || defaultA();
  if (!a) return {a: null, b: null, isDefault: true};
  const b = (pb && pb !== a) ? pb : opponentFor(a);
  return {a, b, isDefault: !pa && !pb};
}
const canon = (a, b) => '/rivals/' + encodeURIComponent(a + '-vs-' + b);

// ============================================================================ Model
function streakSentence(h) {
  return h.streak.n ? `${nm(h.streak.who)} has won the last ${h.streak.n === 1 ? 'meeting' : h.streak.n + ' meetings'}` : 'Last meeting ended in a tie';
}
function model(a, b) {
  const h = data.h2hC(a, b);
  const n = h.games.length;
  return {
    a, b, h, n,
    pct: n ? Math.round(100 * (h.aw + h.t / 2) / n) : 50,
    lead: h.aw > h.bw ? 'a' : h.bw > h.aw ? 'b' : null,
    close: data.hueClose(a, b)
  };
}
const clsA = m => data.color(m.a).cls;
const clsB = m => m.close ? 'mc-ink' : data.color(m.b).cls;
function footText(m) {
  return `${m.n} ${m.n === 1 ? 'game' : 'games'}${m.h.t ? `, ${m.h.t} tied` : ''}. ${streakSentence(m.h)}.`;
}
function srSummary(m) {
  const {h} = m;
  return `Series: ${nm(m.a)} ${h.aw} ${h.aw === 1 ? 'win' : 'wins'}, ${nm(m.b)} ${h.bw} ${h.bw === 1 ? 'win' : 'wins'}${h.t ? `, ${h.t} ${h.t === 1 ? 'tie' : 'ties'}` : ''}. ${nm(m.a)} has won ${m.pct} percent of games.`;
}
// What a screen reader hears when the pair changes (swap, pick, list row, outside link).
function spoken(m) {
  if (!m.n) return `${nm(m.a)} and ${nm(m.b)} haven't played each other yet.`;
  const {h} = m;
  const w = n => `${n} ${n === 1 ? 'win' : 'wins'}`;
  return `${nm(m.a)} against ${nm(m.b)}. ${nm(m.a)} ${w(h.aw)}, ${nm(m.b)} ${w(h.bw)}. ${footText(m)}`;
}
function titleOf(m) {
  if (!m || !m.b) return 'Rivals';
  return m.n ? `${nm(m.a)} ${m.h.aw}–${m.h.bw} ${nm(m.b)}` : `${nm(m.a)} vs ${nm(m.b)}`;
}
function shareText(m) {
  const link = ui.absLink(`/rivals/${m.a}-vs-${m.b}`);
  if (m.lead) {
    const L = m.lead === 'a' ? m.a : m.b, T = m.lead === 'a' ? m.b : m.a;
    const w = Math.max(m.h.aw, m.h.bw), l = Math.min(m.h.aw, m.h.bw);
    return `${nm(L)} leads ${nm(T)} ${w}–${l} all-time. ${streakSentence(m.h)}. ${link}`;
  }
  return `${nm(m.a)} and ${nm(m.b)} are even at ${m.h.aw}–${m.h.bw}. ${link}`;
}
// "{A} against everyone": same rows and order as the old screen.
function opponents(a) {
  return data.ids.filter(id => id !== a).map(id => {
    const x = data.h2hC(a, id);
    return {id, w: x.aw, l: x.bw, t: x.t, n: x.games.length};
  }).filter(x => x.n).sort((x, y) => (y.w - y.l) - (x.w - x.l) || y.n - x.n);
}
// Meetings grouped by season, newest first (games newest first inside a season).
function bySeason(h) {
  const out = [], at = new Map();
  for (let i = h.games.length - 1; i >= 0; i--) {
    const g = h.games[i];
    let s = at.get(g.year);
    if (!s) { s = {year: g.year, games: [], aw: 0, bw: 0, t: 0}; at.set(g.year, s); out.push(s); }
    s.games.push(g);
    if (g.my > g.their) s.aw++; else if (g.their > g.my) s.bw++; else s.t++;
  }
  return out;
}
function seasonLine(s, m) {
  if (s.aw > s.bw) return `${nm(m.a)} ${data.recStr(s.aw, s.bw, s.t)}`;
  if (s.bw > s.aw) return `${nm(m.b)} ${data.recStr(s.bw, s.aw, s.t)}`;
  return s.aw ? `Split ${data.recStr(s.aw, s.bw, s.t)}` : (s.t === 1 ? 'Tied' : `Tied ${s.t}`);
}

// ============================================================================ Markup
const FLAME_DEFS = `<svg class="rv-defs" aria-hidden="true" focusable="false" width="0" height="0"><defs><linearGradient id="rv-flame-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--flame-2)"/><stop offset="1" style="stop-color:var(--flame-1)"/></linearGradient></defs></svg>`;

function pickInner(id) {
  return `<span class="rv-glow" aria-hidden="true"></span>`
    + `<span class="rv-av">${ui.avatar(id, {size: 72, hero: true, you: id === data.me(), crown: id === reigning()})}</span>`
    + `<span class="rv-pname"><span class="rv-pn">${esc(nm(id))}</span>${ui.icon('chevron-down', {cls: 'rv-dd'})}</span>`
    + `<span class="rv-pteam">${esc(data.team(id)) || '&nbsp;'}</span>`;
}
const pickLabel = (id, side) => `${side === 'a' ? 'Manager' : 'Opponent'}: ${nm(id)}. Choose another`;
// The header glow is identity (the avatar's own color); the 35-degree rule applies to the data below it.
function pickBtn(m, side) {
  const id = m[side];
  const c = data.color(id).cls;
  return `<button type="button" class="rv-pick ${side} ${c}" data-pick="${side}" data-id="${esc(id)}" aria-haspopup="dialog" aria-label="${esc(pickLabel(id, side))}">${pickInner(id)}</button>`;
}
function headerHTML(m) {
  return `<div class="rv-hdr" data-enter>${pickBtn(m, 'a')}<div class="rv-mid"><button type="button" class="rv-swap" data-swap aria-label="Swap managers">${ui.icon('swap', {cls: 'rv-swap-ic'})}</button></div>${pickBtn(m, 'b')}</div>`;
}

function whoLink(id, side, size = 24) {
  return `<a class="rv-who ${side}" href="#/managers/${encodeURIComponent(id)}" aria-label="${esc(nm(id))}, profile">${ui.avatar(id, {size, you: id === data.me(), attrs: {'data-morph-from': true}})}<span class="rv-who-n">${esc(nm(id))}</span></a>`;
}

function boardHTML(m) {
  const {h} = m;
  const sideCls = s => m.lead === s ? ' is-lead' : m.lead ? ' is-trail' : '';
  const hot = h.streak.n >= 3;
  return `<div class="card card-hero rv-board" data-enter role="group" aria-label="Series record">`
    + `<i class="rv-wash a ${clsA(m)}" aria-hidden="true"></i><i class="rv-wash b ${clsB(m)}" aria-hidden="true"></i>`
    + `<p class="sr-only rv-sr">${esc(srSummary(m))}</p>`
    + `<div class="rv-score" aria-hidden="true">`
    + `<div class="rv-side a ${clsA(m)}${sideCls('a')}"><span class="n1 rv-num" data-num="a">${h.aw}</span><span class="ovl rv-wl">${h.aw === 1 ? 'Win' : 'Wins'}</span></div>`
    + `<div class="rv-dash"><span class="ovl">Series</span></div>`
    + `<div class="rv-side b ${clsB(m)}${sideCls('b')}"><span class="n1 rv-num" data-num="b">${h.bw}</span><span class="ovl rv-wl">${h.bw === 1 ? 'Win' : 'Wins'}</span></div>`
    + `</div>`
    + `<div class="rv-split">${ui.splitBar(m.a, m.b, m.pct / 100)}</div>`
    + `<p class="rv-foot"><span class="rv-flame-w"${hot ? '' : ' hidden'}>${FLAME_DEFS}${ui.icon('flame', {cls: 'rv-flame'})}</span><span class="rv-foot-t">${esc(footText(m))}</span></p>`
    + `</div>`;
}

function tapeHTML(m) {
  const {h, n, a, b} = m;
  const better = (x, y) => x > y ? 'a' : y > x ? 'b' : null;
  const S = v => ui.raw(ui.score(v));
  const big = B => B ? S(B.m) : '—';
  const bigSub = B => B ? `${B.g.year}, wk ${B.g.week}` : '';
  const rows = [
    ui.tape({label: 'Total points', a: S(h.ap), b: S(h.bp), better: better(h.ap, h.bp), aId: a, bId: b}),
    ui.tape({label: 'Average score', a: S(h.ap / n), b: S(h.bp / n), better: better(h.ap / n, h.bp / n), aId: a, bId: b}),
    ui.tape({label: 'Biggest win', a: big(h.aBig), b: big(h.bBig), aSub: bigSub(h.aBig), bSub: bigSub(h.bBig), better: better(h.aBig ? h.aBig.m : -1, h.bBig ? h.bBig.m : -1), aId: a, bId: b}),
    ui.tape({label: 'Playoff wins', a: String(h.apw), b: String(h.bpw), better: better(h.apw, h.bpw), aId: a, bId: b})
  ];
  return ui.group(`<div class="rv-thead">${whoLink(a, 'a')}${whoLink(b, 'b')}</div>` + rows.join(''), {cls: 'rv-tape'});
}

function logHTML(m) {
  const seasons = bySeason(m.h);
  const head = `<div class="rv-mhead">${whoLink(m.a, 'a')}<span class="ovl rv-mcount">${m.n} ${m.n === 1 ? 'meeting' : 'meetings'}</span>${whoLink(m.b, 'b')}</div>`;
  return head + seasons.map(s => {
    const bugs = s.games.map(g => ui.scoreBug(g, {compact: true, a: m.a, attrs: {role: 'listitem'}})).join('');
    return `<section class="rv-yr" style="contain-intrinsic-size:auto ${48 + s.games.length * 48}px">`
      + `<h3 class="rv-yh"><span class="n5 rv-yy">${esc(s.year)}</span><span class="sr-only">, </span><span class="rv-ysum">${esc(seasonLine(s, m))}</span></h3>`
      + ui.group(bugs, {attrs: {role: 'list', 'aria-label': `${s.year} meetings`}})
      + `</section>`;
  }).join('');
}

function noneHTML(m) {
  return `<div class="card card-hero rv-none" data-enter>`
    + ui.empty({icon: 'versus', body: `${nm(m.a)} and ${nm(m.b)} haven't played each other yet. Pick another opponent.`,
      action: {label: 'Pick an opponent', kind: 'secondary', attrs: {'data-pick': 'b'}}})
    + `</div>`;
}

function mainHTML(m) {
  if (!m.n) return noneHTML(m);
  return boardHTML(m)
    + `<div class="rv-sec" data-enter>${ui.sectionHeader({title: 'Tale of the tape'})}<div class="rv-tape-w">${tapeHTML(m)}</div></div>`
    + `<div class="rv-sec" data-enter>${ui.sectionHeader({title: 'Every meeting'})}<div class="rv-log">${logHTML(m)}</div></div>`;
}

function oppRow(a, x, sel) {
  const share = x.n ? (x.w + x.t / 2) / x.n : 0;
  const tone = x.w > x.l ? 'tint' : x.w < x.l ? 'wrong' : 'ink2';
  const rec = data.recStr(x.w, x.l, x.t);
  const on = x.id === sel;
  return `<li class="rv-opp${on ? ' is-selected' : ''}" data-key="${esc(x.id)}">`
    + `<button type="button" class="rv-opp-hit" data-opp="${esc(x.id)}" aria-pressed="${on}" aria-label="${esc(`${nm(x.id)}, ${rec}`)}"></button>`
    + `<a class="rv-opp-av" href="#/managers/${encodeURIComponent(x.id)}" aria-label="${esc(nm(x.id))}, profile">${ui.avatar(x.id, {size: 32, you: x.id === data.me(), attrs: {'data-morph-from': true}})}</a>`
    + `<span class="rv-opp-n" aria-hidden="true">${esc(nm(x.id))}</span>`
    + `<span class="rv-opp-rec n4 ${tone}" aria-hidden="true">${esc(rec)}</span>`
    + `<span class="rv-opp-bar ${data.color(a).cls}" aria-hidden="true"><i data-share="${share}" style="transform:scaleX(${share})"></i></span>`
    + ui.icon('chevron-right', {cls: 'chev'})
    + `</li>`;
}
function listHTML(m) {
  const rows = opponents(m.a);
  if (!rows.length) return `<p class="note rv-nobody">${esc(nm(m.a))} hasn't played anyone yet.</p>`;
  return `<ul class="group rv-opps" aria-label="${esc(`${nm(m.a)} against everyone`)}">${rows.map(x => oppRow(m.a, x, m.b)).join('')}</ul>`;
}
function listSecHTML(m) {
  return `<div class="rv-sec rv-list" data-enter>${ui.sectionHeader({title: `${nm(m.a)} against everyone`})}<div class="rv-list-w">${listHTML(m)}</div><p class="group-f">${FOOTNOTE}</p></div>`;
}

// ============================================================================ The week (core/week.js)
// Firestore snapshots and local edits live in st.wk (created in mount). The models below read st.wk while
// the screen is mounted; in render (st is null) they describe the week with no Firebase state yet.
const VOTE_OFF = "Voting isn't switched on yet.";
const PICK_OFF = "Pick'em isn't switched on yet.";
const pairOf = key => String(key || '').split('|');
const pairName = key => { const [a, b] = pairOf(key); return `${nm(a)} vs ${nm(b)}`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const andJoin = l => l.length < 2 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
const atMs = a => a == null ? 0 : typeof a === 'number' ? a : typeof a.toMillis === 'function' ? a.toMillis() : a.seconds ? a.seconds * 1000 : (+new Date(a) || 0);

// week.current() reads data.js only. A throw in the week code must never take the head to head down with it.
function curWeek() {
  try { const c = week.current(); return c && c.games && c.games.length ? c : null; } catch (e) { console.error(e); return null; }
}
// Locked at kickoff (week.js's clock: a dev host can inject one with week.__dev.setNow).
function lockedNow(cur) {
  if (!cur) return false;
  try { return !!week.isLocked(cur.year, cur.week); } catch (_) { return !!cur.locked; }
}
// "Thu 5:15 PM" in the viewer's own time zone (week.js adds the date when kickoff is more than 6 days away).
function closeText(cur) {
  try { return week.lockText(cur.year, cur.week); } catch (_) { return timeLabel(cur.lock); }
}
function timeLabel(d) {
  const t = d instanceof Date ? d : new Date(d);
  if (isNaN(t)) return '';
  return `${t.toLocaleDateString('en-US', {weekday: 'short'})} ${t.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}`;
}
// Snapshot / result errors: permission-denied means the rules aren't deployed yet (read-only, say so).
function errKind(e) {
  if (!e) return '';
  const s = typeof e === 'string' ? e : `${e.code || ''} ${e.message || ''}`;
  return /denied|permission/i.test(s) ? 'denied' : 'failed';
}
function liveRow(id) {
  const s = data.SEASONS.find(x => x.live);
  const r = s && s.table.find(x => x.id === id);
  return r ? {rank: r.seed, w: r.w, l: r.l, t: r.t} : {rank: null, w: 0, l: 0, t: 0};
}
// A voter or picker as drawn: their manager when `me` is one, else their nick on a neutral initials disc.
function who(v) {
  const id = v && v.me && data.M[v.me] ? v.me : null;
  const nick = v && typeof v.nick === 'string' ? v.nick.trim() : '';
  return {id, name: id ? nm(id) : (nick || 'Someone'), you: !!(v && v.you)};
}
const stackItem = v => { const w = who(v); return w.id ? {id: w.id, you: w.you} : {nick: w.name, you: w.you}; };
const whoAvatar = (v, size) => { const w = who(v); return w.id ? ui.avatar(w.id, {size, you: w.you}) : ui.nickAvatar(w.name, {size, you: w.you}); };
const myNick = () => ui.lsGet('gg-nick') || '';
// The snapshot's own doc: `mine` may be the doc (with uid) or just its value.
function mineUid(snap) {
  const m = snap && snap.mine;
  if (m && typeof m === 'object' && m.uid) return m.uid;
  try { return week.myUid() || null; } catch (_) { return null; }
}
const markYou = (list, uid) => (list || []).map(v => Object.assign({}, v, {you: v.you === true || (!!uid && v.uid === uid)}));
// The week's game keys in hype order (motw's overall ranking): ties in the vote go to the earlier one.
function hypeOrder(cur) {
  const c = cur || (st && st.wk && st.wk.cur) || curWeek();
  try { if (c) return week.ranking(c.year, c.week); } catch (_) {}
  const res = motw.candidates('overall');
  return res ? res.list.map(x => x.a + '|' + x.b) : [];
}
function leaderOf(tally, cur) {
  const order = hypeOrder(cur);
  let k = null;
  try { k = week.leader(tally, order); } catch (_) { k = null; }
  if (k && tally[k]) return k;
  let best = null;
  order.forEach(x => { if ((tally[x] || 0) > (best ? tally[best] : 0)) best = x; });
  return best;
}

// ---------------------------------------------------------------- Matchup of the Week: the vote
function voteModel() {
  const w = st && st.wk;
  const cur = w ? w.cur : curWeek();
  if (!cur) return null;
  const snap = w ? w.vsnap : null;
  const locked = lockedNow(cur);
  const uid = mineUid(snap);
  let votes = markYou(snap && snap.votes, uid);
  let mine = snap && snap.mine ? (typeof snap.mine === 'string' ? snap.mine : snap.mine.pick || null) : null;
  if (!mine) { const y = votes.find(v => v.you); if (y) mine = y.pick || null; }
  if (w && w.vpend !== undefined && !locked) {
    // Optimistic: your tap shows at once; the snapshot confirms it (or the result code puts it back).
    votes = votes.filter(v => !v.you);
    mine = w.vpend;
    if (mine) votes.push({uid: uid || '', pick: mine, me: data.me(), nick: myNick(), at: Date.now(), you: true});
  }
  const keys = new Set(cur.games.map(g => g.key));
  const tally = {}, voters = {};
  votes.forEach(v => {
    if (!keys.has(v.pick)) return;
    tally[v.pick] = (tally[v.pick] || 0) + 1;
    (voters[v.pick] || (voters[v.pick] = [])).push(v);
  });
  Object.values(voters).forEach(l => l.sort((x, y) => (y.you - x.you) || atMs(x.at) - atMs(y.at)));
  const total = Object.values(tally).reduce((s, n) => s + n, 0);
  const off = !!(w && w.voff);
  // The first payload comes from local state before Firestore answers (ready false): counts aren't known yet.
  const loading = !snap || snap.ready === false;
  const failed = !!(snap && snap.error && errKind(snap.error) !== 'denied');
  return {cur, locked, off, open: !locked && !off, loading, failed, votes, tally, voters, total,
    mine: keys.has(mine) ? mine : null, leader: total ? leaderOf(tally, cur) : null};
}

function vtWhoLabel(key, vm) {
  const n = vm.tally[key] || 0;
  const pct = vm.total ? Math.round(100 * n / vm.total) : 0;
  const names = (vm.voters[key] || []).map(v => v.you ? 'you' : who(v).name);
  const list = names.length > 4 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : andJoin(names);
  return `${plural(n, 'vote', 'votes')}, ${pct} percent: ${list}. See who voted`;
}
function vtLine(key, vm) {
  const n = vm.tally[key] || 0;
  const share = vm.total ? n / vm.total : 0;
  const mine = vm.mine === key, lead = vm.locked && vm.leader === key;
  // Before kickoff the current leader is marked neutrally (ink, not tint: tint is only ever your vote).
  const leading = !vm.locked && vm.total > 0 && vm.leader === key;
  const stack = n ? `<button type="button" class="rv-vt-who" data-vt-who="${esc(key)}" aria-label="${esc(vtWhoLabel(key, vm))}">${ui.avatarStack((vm.voters[key] || []).map(stackItem), {max: 3, size: 28})}</button>` : '';
  let act = '';
  if (vm.open) {
    act = `<button type="button" class="rv-vt-btn${mine ? ' is-on' : ''}" data-vote="${esc(key)}" aria-pressed="${mine}" aria-label="${esc(`Vote for ${pairName(key)}`)}">`
      + `${ui.icon('check', {cls: 'rv-vt-ck'})}<span class="rv-vt-bl">${mine ? 'Voted' : 'Vote'}</span></button>`;
  } else if (lead) {
    act = `<span class="rv-vt-tag is-lead">${ui.icon('crown')}<span>League's pick</span>${mine ? '<span class="sr-only">, your vote</span>' : ''}</span>`;
  } else if (mine) {
    act = `<span class="rv-vt-tag is-mine">${ui.icon('check')}<span>Your vote</span></span>`;
  }
  // Every row's bar spans the same full-width track (its own grid row), so a bigger share is always a longer bar.
  return `<span class="rv-vt${mine ? ' is-mine' : ''}${lead ? ' is-lead' : ''}${leading ? ' is-leading' : ''}${vm.total ? '' : ' is-none'}">`
    + `<span class="rv-vt-pct n5" aria-hidden="true">${vm.total ? Math.round(share * 100) + '%' : ''}</span>`
    + stack + act + (leading ? '<span class="sr-only">Leading.</span>' : '') + (n || vm.loading ? '' : '<span class="sr-only">No votes.</span>')
    + `<span class="rv-vt-bar" aria-hidden="true"><i data-share="${share}" style="transform:scaleX(${share})"></i></span>`
    + `</span>`;
}
// After kickoff: the league's pick leads the card, whatever its hype place.
function vtResultHTML(vm) {
  if (!vm.locked || vm.off || !vm.leader || !vm.total) return '';
  const [a, b] = pairOf(vm.leader);
  const n = vm.tally[vm.leader] || 0;
  const votes = `${n} of ${plural(vm.total, 'vote', 'votes')}`;
  return `<button type="button" class="rv-vt-res" data-motw="${esc(vm.leader)}" aria-label="${esc(`League's pick, week ${vm.cur.week}: ${pairName(vm.leader)}, ${votes}${vm.mine === vm.leader ? ', your vote' : ''}. Show this rivalry`)}">`
    + `<span class="rv-vt-res-av" aria-hidden="true">${ui.avatar(a, {size: 32, you: a === data.me()})}${ui.avatar(b, {size: 32, you: b === data.me()})}</span>`
    + `<span class="rv-vt-res-t" aria-hidden="true"><span class="ovl rv-vt-res-o">${ui.icon('crown')}<span>League's pick · ${esc(votes)}</span></span>`
    + `<span class="rv-vt-res-p">${esc(pairName(vm.leader))}</span></span>`
    + ui.icon('chevron-right', {cls: 'chev'})
    + `</button>`;
}
function vtStatusHTML(vm) {
  let ic = 'clock', txt = `Closes ${closeText(vm.cur)}`;
  if (vm.off) { ic = 'info'; txt = VOTE_OFF; } else if (vm.locked) { ic = 'lock'; txt = 'Voting closed'; }
  const tot = plural(vm.total, 'vote', 'votes');
  const right = vm.total
    ? `<button type="button" class="rv-vt-tot is-btn" data-vt-who="" aria-label="${esc(`${tot}. See who voted`)}"><span>${esc(tot)}</span>${ui.icon('chevron-right')}</button>`
    : `<span class="rv-vt-tot">${vm.loading ? '' : vm.failed ? "Votes didn't load" : vm.open ? 'No votes yet' : 'No votes'}</span>`;
  return `<div class="rv-vt-status${vm.open ? '' : ' is-closed'}"><span class="rv-vt-st">${ui.icon(ic)}<span class="rv-vt-stt">${esc(txt)}</span></span>${right}</div>`
    + vtResultHTML(vm);
}

// ---------------------------------------------------------------- Matchup of the Week: the card
const LENS_KEY = 'gg-motw-lens';
function readLens() {
  try { const v = localStorage.getItem(LENS_KEY); return motw.LENSES.some(l => l.id === v) ? v : 'overall'; } catch (_) { return 'overall'; }
}
function saveLens(v) { try { localStorage.setItem(LENS_KEY, v); } catch (_) {} }
const SHOWN = 3;
const LENS_SUB = {overall: 'Standings and history, blended.', standings: 'Where both teams sit right now.', history: 'How close and storied each series is.'};
const lensSub = lens => `${LENS_SUB[lens] || LENS_SUB.overall} Tap a game for the full history.`;
const recOf = x => x.rank ? `#${x.rank} · ${data.recStr(x.w, x.l, x.t)}` : 'No games yet';

function mcSide(id, x, side, size) {
  return `<span class="rv-mc-side ${side}">${ui.avatar(id, {size, you: id === data.me()})}`
    + `<span class="rv-mc-txt"><span class="rv-mc-n">${esc(nm(id))}</span><span class="rv-mc-r">${esc(recOf(x))}</span></span></span>`;
}
// Your vote and the leader always show, even beyond the top 3.
const keepRow = (key, vm) => !!vm && (vm.mine === key || (vm.total > 0 && vm.leader === key));
function mcRow(c, vm) {
  const key = c.a + '|' + c.b;
  const top = c.place === 1;
  const label = `${c.place}. ${nm(c.a)} versus ${nm(c.b)}. Hype ${c.hype}.${c.tags.length ? ' ' + c.tags.join('. ') + '.' : ''} Show this rivalry`;
  const cls = `rv-mc${top ? ' is-top' : ''}${c.place > SHOWN && !keepRow(key, vm) ? ' is-more' : ''}${vm && vm.mine === key ? ' is-voted' : ''}${vm && vm.locked && vm.leader === key ? ' is-lead' : ''}`;
  return `<li class="${cls}" data-key="${esc(key)}">`
    + `<button type="button" class="rv-mc-hit" data-motw="${esc(key)}" aria-label="${esc(label)}"></button>`
    + `<span class="rv-mc-place n5" aria-hidden="true">${c.place}</span>`
    + `<span class="rv-mc-pair" aria-hidden="true">${mcSide(c.a, c.A, 'a', top ? 44 : 28)}<span class="rv-mc-vs ovl">vs</span>${mcSide(c.b, c.B, 'b', top ? 44 : 28)}</span>`
    + `<span class="rv-mc-hype" aria-hidden="true"><span class="${top ? 'n3' : 'n4'}">${c.hype}</span><span class="ovl">Hype</span><i style="transform:scaleX(${c.hype / 100})"></i></span>`
    + (c.tags.length ? `<span class="rv-mc-tags" aria-hidden="true">${c.tags.map(t => `<span class="rv-mc-tag">${esc(t)}</span>`).join('')}</span>` : '')
    + (vm ? `<span class="rv-mc-vote">${vtLine(key, vm)}</span>` : '')
    + `</li>`;
}
function motwRows(res, vm) { return res.list.map(c => mcRow(c, vm)).join(''); }
const shareLabel = vm => !vm || !vm.locked ? 'Share for the vote' : vm.leader ? 'Share the pick' : 'Share the shortlist';
function motwHTML(lens) {
  const res = motw.candidates(lens);
  if (!res || !res.list.length) return '';
  const vm = voteModel();
  const more = res.list.length > SHOWN;
  return `<section class="rv-motw" id="rv-motw" data-enter aria-labelledby="rv-motw-h">`
    + `<div class="rv-motw-head"><h2 class="t-2" id="rv-motw-h">Matchup of the Week</h2><span class="ovl rv-motw-wk">Week ${res.week}</span></div>`
    + `<p class="rv-motw-sub">${esc(lensSub(res.lens))}</p>`
    + ui.seg({name: 'motw-lens', items: motw.LENSES, value: res.lens, small: true, label: 'Rank by', cls: 'rv-motw-seg'})
    + `<div class="card rv-motw-card">${vm ? `<div class="rv-vt-sw">${vtStatusHTML(vm)}</div>` : ''}`
    + `<ol class="rv-motw-list" aria-label="${esc(`Week ${res.week} games, best first`)}">${motwRows(res, vm)}</ol>`
    + `<div class="rv-motw-foot">`
    + (more ? ui.button({label: `Show all ${res.list.length}`, kind: 'plain', size: 's', attrs: {'data-motw-more': '', 'aria-expanded': 'false'}}) : '<span></span>')
    + ui.button({label: shareLabel(vm), kind: 'secondary', size: 's', icon: 'share', attrs: {'data-motw-share': ''}})
    + `</div></div></section>`;
}
// Re-rank in place (lens change, new data, new "me"). FLIP moves rows that change places.
function patchMotw(animate) {
  if (!st) return;
  const sec = st.el.querySelector('.rv-motw');
  const res = motw.candidates(st.lens);
  if (!sec) {
    // A reload brought a schedule where there was none: add the section at the top of the week.
    const wrap = st.el.querySelector('.rv-week');
    if (res && res.list.length && wrap) {
      wrap.insertAdjacentHTML('afterbegin', motwHTML(st.lens));
      if (st.all) toggleMore(true);
      syncH2hTitle();
    }
    return;
  }
  if (!res || !res.list.length) { sec.remove(); syncH2hTitle(); return; }
  const list = sec.querySelector('.rv-motw-list');
  const wk = sec.querySelector('.rv-motw-wk');
  if (wk) wk.textContent = `Week ${res.week}`;
  const vm = voteModel();
  const put = () => { list.innerHTML = motwRows(res, vm); };
  if (animate) ui.flip(list, put); else put();
  patchVotes({animate: false});
}
function toggleMore(on) {
  const sec = st && st.el.querySelector('.rv-motw');
  if (!sec) return;
  st.all = on;
  sec.classList.toggle('is-all', on);
  const b = sec.querySelector('[data-motw-more]');
  if (b) {
    const n = sec.querySelectorAll('.rv-mc').length;
    b.setAttribute('aria-expanded', String(on));
    const lab = b.querySelector('.btn-label');
    if (lab) lab.textContent = on ? 'Show fewer' : `Show all ${n}`;
  }
  if (on) sec.querySelectorAll('.rv-mc.is-more').forEach(li => ui.animate(li, [{opacity: 0, transform: 'translateY(-6px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: 'ease-out'}));
}
// Scroll so el sits just under the nav bar.
function scrollUnder(el, gap = 8, behavior) {
  const scr = st.ctx.screen;
  if (!el || !scr) return;
  const nav = scr.querySelector(':scope > .nav');
  const top = el.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - (nav ? nav.offsetHeight : 44) - gap;
  scr.scrollTo({top: Math.max(0, top), behavior: behavior || (ui.RM ? 'auto' : 'smooth')});
}
function chooseMotw(key) {
  if (!st || st.swapping || !st.m) return;
  let [a, b] = key.split('|');
  if (!data.M[a] || !data.M[b]) return;
  if (b === data.me()) [a, b] = [b, a]; // your side on the left
  ui.haptic('selection');
  const same = (st.m.a === a && st.m.b === b) || (st.m.a === b && st.m.b === a);
  if (!same) go(a, b, 'list');
  scrollUnder(st.r.hdr); // bring the head to head into view, just under the bar
  focusPicker('b');
}
function shareMotw() {
  const vm = voteModel();
  const link = ui.absLink('/rivals');
  let text;
  if (vm && vm.locked && vm.leader) {
    const n = vm.tally[vm.leader] || 0;
    text = `Matchup of the Week, Week ${vm.cur.week}: ${pairName(vm.leader)}. ${n} of ${plural(vm.total, 'vote', 'votes')}.\n${link}`;
  } else {
    const res = motw.candidates(st ? st.lens : readLens());
    if (!res) return;
    // Voting is live in the app: send the chat to the vote (the link lands on it) instead of "vote by number".
    // Before the rules are deployed (off) the chat still votes by number.
    // After kickoff with no votes there is nothing left to vote on: the plain shortlist.
    text = vm && vm.open
      ? motw.shareText(res, ui.absLink('/rivals?s=motw')).replace(/ Vote by number:$/m, ' Vote in the app:')
      : vm && vm.locked
        ? motw.shareText(res, link).replace(/ Vote by number:$/m, '')
        : motw.shareText(res, link);
  }
  // ui.share runs inside the tap (iOS user activation)
  return ui.share({text}).then(r => {
    if (r === 'copied') ui.toast(vm && vm.locked && vm.leader ? "The pick is copied. Paste it in the league chat." : 'Shortlist copied. Paste it in the league chat.', {icon: 'check-circle'});
    else if (r === 'unavailable') ui.toast("Couldn't copy the shortlist.");
  });
}

// Patch the vote parts in place: the status strip, each row's bar, share, voters and button.
// Focus stays on the equivalent control (a keyboard user can vote twice in a row).
function morphInto(el, html) {
  if (!el || el._html === html) return false;
  const f = document.activeElement;
  let sel = null;
  if (f && f !== el && el.contains(f)) {
    for (const a of ['data-vote', 'data-vt-who', 'data-pk-retry', 'data-pk-all', 'data-pk-stand']) {
      if (f.hasAttribute(a)) { sel = `[${a}="${CSS.escape(f.getAttribute(a))}"]`; break; }
    }
  }
  el.innerHTML = html;
  el._html = html;
  if (sel) { const n = el.querySelector(sel); if (n) n.focus({preventScroll: true}); }
  return true;
}
function patchVotes({animate = false, pop = null} = {}) {
  const sec = st && st.el.querySelector('.rv-motw');
  if (!sec) return;
  const vm = voteModel();
  if (!vm) return;
  morphInto(sec.querySelector('.rv-vt-sw'), vtStatusHTML(vm));
  sec.querySelectorAll('.rv-mc').forEach(li => {
    const key = li.dataset.key;
    const box = li.querySelector('.rv-mc-vote');
    if (!box) return;
    const oi = box.querySelector('.rv-vt-bar > i');
    const old = oi ? parseFloat(oi.dataset.share) || 0 : 0;
    morphInto(box, vtLine(key, vm));
    li.classList.toggle('is-voted', vm.mine === key);
    li.classList.toggle('is-lead', vm.locked && vm.leader === key);
    if (li.classList.contains('is-more') && keepRow(key, vm)) {
      li.classList.remove('is-more'); // never re-hidden here: a row you just tapped never vanishes under you
      if (animate) ui.animate(li, [{opacity: 0, transform: 'translateY(-6px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: 'ease-out'});
    }
    const ni = box.querySelector('.rv-vt-bar > i');
    const now = ni ? parseFloat(ni.dataset.share) || 0 : 0;
    if (animate && ni && Math.abs(now - old) > 1e-6) ui.animate(ni, [{transform: `scaleX(${old})`}, {transform: `scaleX(${now})`}], {spring: 'smooth'});
    if (pop === key) {
      const ck = box.querySelector('.rv-vt-ck');
      if (ck) ui.stamp(ck, {from: .2});
    }
  });
  const sb = sec.querySelector('[data-motw-share] .btn-label');
  if (sb) sb.textContent = shareLabel(vm);
  if (st.wk.sheet && st.wk.sheet.kind === 'votes') fillSheet();
}

function vote(key) {
  const w = st && st.wk;
  const vm = voteModel();
  if (!w || !vm) return;
  if (!vm.open) {
    ui.toast(vm.off ? VOTE_OFF : 'Voting closed at kickoff.', {icon: vm.off ? 'info' : 'lock'});
    return;
  }
  if (!vm.cur.games.some(g => g.key === key)) return;
  const next = vm.mine === key ? null : key;
  w.vpend = next;
  const seq = ++w.vseq;
  ui.haptic(next ? 'light' : 'selection');
  patchVotes({animate: true, pop: next});
  ui.announce(next ? `Voted for ${pairName(next)}.` : 'Vote removed.');
  let p;
  try { p = next ? week.castVote(next) : week.clearVote(); } catch (e) { console.error(e); p = 'failed'; }
  Promise.resolve(p).then(r => r, () => 'failed').then(r => {
    if (!st || st.wk !== w || seq !== w.vseq) return;
    if (r === 'ok' || r === 'dev') {
      // Held until the snapshot shows it (Firestore's local echo is immediate); a quiet fallback after 4 s.
      clearTimeout(w.vT);
      w.vT = setTimeout(() => { if (st && st.wk === w && seq === w.vseq && w.vpend !== undefined && w.vsnap) { w.vpend = undefined; patchVotes({animate: true}); } }, 4000);
      return;
    }
    w.vpend = undefined;
    if (r === 'locked') ui.toast('Voting closed at kickoff.', {icon: 'lock'});
    else if (r === 'denied') { w.voff = true; ui.toast(VOTE_OFF, {icon: 'info'}); }
    else ui.toast("Couldn't save your vote. Try again.");
    patchVotes({animate: true});
  });
}

// ---------------------------------------------------------------- Pick'em
function pickModel() {
  const w = st && st.wk;
  const cur = w ? w.cur : curWeek();
  if (!cur) return null;
  const snap = w ? w.psnap : null;
  const locked = lockedNow(cur);
  const off = !!(w && w.poff);
  const uid = mineUid(snap);
  const entries = markYou(snap && snap.entries, uid);
  const mineE = (snap && snap.mine && typeof snap.mine === 'object' ? snap.mine : null) || entries.find(e => e.you) || null;
  const saved = (mineE && mineE.picks) || {};
  const picks = (w && w.draft && !locked) ? w.draft : saved;
  const count = cur.games.filter(g => picks[g.key] === g.a || picks[g.key] === g.b).length;
  // Until the server has answered (week.js: ready), your saved picks aren't known: taps wait, so a pick can
  // never be saved over an entry that hasn't loaded yet.
  const loading = !snap || snap.ready === false;
  return {cur, locked, off, open: !locked && !off && !loading, wait: !locked && !off && loading, loading, entries, mineE, picks, count, n: cur.games.length,
    save: w ? w.save : '', dirty: !!(w && w.dirty)};
}
const pkMode = pm => pm.off ? 'off' : pm.locked ? 'locked' : pm.wait ? 'wait' : 'open';

function pkSideHTML(g, id, side, pm) {
  const other = side === 'a' ? g.b : g.a;
  const pick = pm.picks[g.key];
  const on = pick === id, dim = !!pick && !on;
  const cls = `rv-pk-side ${side} ${data.color(id).cls}${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}`;
  const inner = `<span class="rv-pk-av">${ui.avatar(id, {size: 36, you: id === data.me()})}<span class="rv-pk-ck" aria-hidden="true">${ui.icon('check')}</span></span>`
    + `<span class="rv-pk-txt"><span class="rv-pk-n">${esc(nm(id))}</span><span class="rv-pk-r">${esc(recOf(liveRow(id)))}</span></span>`;
  if (pm.open || pm.wait) {
    // While your saved picks load the sides look the same but wait (aria-disabled; a tap explains).
    return `<button type="button" class="${cls}${pm.wait ? ' is-wait' : ''}" data-pk="${esc(g.key)}" data-id="${esc(id)}" aria-pressed="${on}"${pm.wait ? ' aria-disabled="true"' : ''} aria-label="${esc(`${nm(id)} to beat ${nm(other)}`)}">${inner}</button>`;
  }
  // data-id: patchPicks matches both variants by it.
  return `<div class="${cls} is-static" data-id="${esc(id)}" role="img" aria-label="${esc(`${nm(id)}${on ? ', your pick' : ''}`)}">${inner}</div>`;
}
// After kickoff: who the league picked, per game.
function pkCrowdHTML(g, pm) {
  const A = [], B = [];
  pm.entries.forEach(e => { const p = e.picks && e.picks[g.key]; if (p === g.a) A.push(e); else if (p === g.b) B.push(e); });
  const n = A.length + B.length;
  if (!n) return `<div class="rv-pk-crowd is-none"><span class="rv-pk-nobody">Nobody picked this one.</span></div>`;
  const sort = l => l.sort((x, y) => (y.you - x.you) || atMs(x.at) - atMs(y.at));
  const stack = (l, side) => `<span class="rv-pk-cs ${side}">${l.length ? ui.avatarStack(sort(l).map(stackItem), {max: 2, size: 28}) : ''}</span>`;
  const label = `${nm(g.a)} ${A.length}, ${nm(g.b)} ${B.length}`;
  return `<div class="rv-pk-crowd" role="img" aria-label="${esc(`Picks: ${label}`)}">${stack(A, 'a')}<span class="rv-pk-split" aria-hidden="true">${ui.splitBar(g.a, g.b, A.length / n, {label})}</span>${stack(B, 'b')}</div>`;
}
function pkGameHTML(g, pm) {
  return `<li class="rv-pk-game" data-key="${esc(g.key)}"><div class="rv-pk-pair" role="group" aria-label="${esc(`${nm(g.a)} versus ${nm(g.b)}`)}">`
    + pkSideHTML(g, g.a, 'a', pm) + `<span class="rv-pk-vs ovl" aria-hidden="true">vs</span>` + pkSideHTML(g, g.b, 'b', pm)
    + `</div>${pm.locked && !pm.loading ? pkCrowdHTML(g, pm) : ''}</li>`;
}
function pkStatusHTML(pm) {
  const dots = pm.cur.games.map(g => `<i class="${pm.picks[g.key] === g.a || pm.picks[g.key] === g.b ? 'on' : ''}" data-dot="${esc(g.key)}"></i>`).join('');
  const all = pm.count === pm.n;
  let left;
  if (pm.off) left = `<span class="rv-pk-msg">${ui.icon('info')}<span>${esc(PICK_OFF)}</span></span>`;
  else if (pm.wait) left = `<span class="rv-pk-msg is-wait"><span class="spin" aria-hidden="true"></span><span>Loading your picks</span></span>`;
  else if (pm.locked && !pm.count) left = `<span class="rv-pk-msg">${ui.icon('lock')}<span>${pm.loading ? 'Picks closed' : 'You sat this week out'}</span></span>`;
  else {
    const txt = pm.locked ? `Your picks: ${pm.count} of ${pm.n}` : all ? `All ${pm.n} picked` : `${pm.count} of ${pm.n} picked`;
    left = `<span class="rv-pk-prog${all ? ' is-all' : ''}"><span class="rv-pk-dots" aria-hidden="true">${dots}</span><span class="rv-pk-count">${esc(txt)}</span></span>`;
  }
  let right = '';
  if (pm.locked && !pm.off) right = `<span class="rv-pk-save">${ui.icon('lock')}<span>Closed</span></span>`;
  else if (pm.open) {
    if (pm.save === 'failed') right = `<button type="button" class="rv-pk-save is-failed" data-pk-retry>${ui.icon('x-circle')}<span>Not saved. Retry</span></button>`;
    else if (pm.save === 'saving' || pm.save === 'pending') right = `<span class="rv-pk-save is-saving"><span class="spin" aria-hidden="true"></span><span>Saving</span></span>`;
    else if (pm.save === 'saved' || (pm.mineE && pm.count)) right = `<span class="rv-pk-save is-saved">${ui.icon('check')}<span>Saved</span></span>`;
  }
  return `<div class="rv-pk-status">${left}${right}</div>`;
}
function pkFootHTML(pm) {
  const n = pm.entries.length;
  const last = pkLastHTML();
  if (pm.off) return last;
  if (pm.locked) {
    if (pm.loading) return last;
    return `<div class="rv-pk-foot"><span class="rv-pk-fi">${ui.icon('person')}<span>${n ? `${plural(n, 'person', 'people')} made picks` : 'Nobody made picks this week'}</span></span>`
      + (n ? ui.button({label: "Everyone's picks", kind: 'plain', size: 's', attrs: {'data-pk-all': '', 'aria-haspopup': 'dialog'}}) : '') + `</div>` + last;
  }
  const inSoFar = pm.loading ? '' : n ? `${n} in so far` : 'Nobody in yet';
  return `<div class="rv-pk-foot"><span class="rv-pk-fi">${ui.icon('clock')}<span>Closes ${esc(closeText(pm.cur))}</span></span><span class="rv-pk-in">${esc(inSoFar)}</span></div>` + last;
}
// Last week's pick'em, once it is graded: your score and the week's best. Opens the season standings.
function pkLastText(r) {
  const you = r.rows.find(x => x.you);
  const best = r.winners.map(x => x.you ? 'you' : who(x).name);
  const bestStr = best.length > 2 ? `${best.slice(0, 2).join(', ')} and ${best.length - 2} more` : andJoin(best);
  const top = r.winners[0];
  // One denominator: the week's decided games (a game you didn't pick is a miss), same as the Wrap.
  const n = r.graded;
  if (you && top && you.rank === 1) return `Week ${r.week}: you went ${you.right} for ${n}, ${best.length > 1 ? 'tied for the best' : 'the best'} in the league.`;
  if (you && top) return `Week ${r.week}: you went ${you.right} for ${n}. ${bestStr[0].toUpperCase() + bestStr.slice(1)} went ${top.right} for ${n}.`;
  if (you) return `Week ${r.week}: you went ${you.right} for ${n}.`;
  if (top) return `Week ${r.week}: ${bestStr} went ${top.right} for ${n}, the best in the league.`;
  return '';
}
function pkLastHTML() {
  const r = st && st.wk && st.wk.last;
  const txt = r ? pkLastText(r) : '';
  if (!txt) return '';
  return `<button type="button" class="rv-pk-last" data-pk-stand aria-haspopup="dialog">${ui.icon('trophy')}<span class="rv-pk-lt">${esc(txt)}</span>${ui.icon('chevron-right', {cls: 'chev'})}</button>`;
}
function loadLast() {
  const w = st && st.wk;
  if (!w || !w.cur || w.cur.week < 2) { if (w) w.last = null; return; }
  const key = week.weekKey(w.cur.year, w.cur.week - 1);
  let p;
  try { p = Promise.resolve(week.weekResults(key)); } catch (e) { p = Promise.reject(e); }
  p.then(r => {
    if (!st || st.wk !== w || !w.cur || week.weekKey(w.cur.year, w.cur.week - 1) !== key) return;
    w.last = r && r.graded && r.rows && r.rows.length ? r : null;
    ui.whenIdle(() => { if (st && st.wk === w) patchPicks({}); });
  }, e => console.warn('pickem last week', e));
}
function pkSub(pm) {
  if (pm.locked) return `Picks are locked. Here's how the league called week ${pm.cur.week}.`;
  return `Pick the winner of all ${pm.n} week ${pm.cur.week} games. A point for every one you get right.`;
}
function pickemHTML() {
  const pm = pickModel();
  if (!pm) return '';
  return `<section class="rv-pk" id="rv-pickem" data-enter data-mode="${pkMode(pm)}" aria-labelledby="rv-pk-h">`
    + `<div class="rv-pk-head"><h2 class="t-2" id="rv-pk-h">Pick'em</h2>`
    + ui.button({label: 'Leaderboard', kind: 'plain', size: 's', icon: 'medal', attrs: {'data-pk-stand': '', 'aria-haspopup': 'dialog'}}) + `</div>`
    + `<p class="rv-pk-sub">${esc(pkSub(pm))}</p>`
    + `<div class="card rv-pk-card"><div class="rv-pk-sw">${pkStatusHTML(pm)}</div>`
    + `<ol class="rv-pk-list" aria-label="${esc(`Week ${pm.cur.week} games`)}">${pm.cur.games.map(g => pkGameHTML(g, pm)).join('')}</ol>`
    + `<div class="rv-pk-fw">${pkFootHTML(pm)}</div></div></section>`;
}
// Patch in place (keeps focus and running pops); a mode change (open -> locked, denied) renders afresh.
function patchPicks({pop = null, all = false} = {}) {
  const sec = st && st.el.querySelector('.rv-pk');
  const pm = pickModel();
  if (!sec) return;
  if (!pm) { sec.remove(); syncH2hTitle(); return; }
  if (sec.dataset.mode !== pkMode(pm) || (pm.locked && sec._crowd !== crowdKey(pm))) {
    const t = document.createElement('template');
    t.innerHTML = pickemHTML();
    const n = t.content.firstElementChild;
    n._crowd = crowdKey(pm);
    sec.replaceWith(n);
    return;
  }
  morphInto(sec.querySelector('.rv-pk-sw'), pkStatusHTML(pm));
  morphInto(sec.querySelector('.rv-pk-fw'), pkFootHTML(pm));
  const sub = sec.querySelector('.rv-pk-sub');
  if (sub && sub.textContent !== pkSub(pm)) sub.textContent = pkSub(pm);
  sec.querySelectorAll('.rv-pk-game').forEach(li => {
    const key = li.dataset.key;
    const pick = pm.picks[key];
    li.querySelectorAll('.rv-pk-side').forEach(b => {
      const on = pick === b.dataset.id;
      b.classList.toggle('is-on', on);
      b.classList.toggle('is-dim', !!pick && !on);
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(on));
    });
  });
  if (pop) {
    const b = sec.querySelector(`.rv-pk-side[data-pk="${CSS.escape(pop.key)}"][data-id="${CSS.escape(pop.id)}"]`);
    if (b) {
      ui.stamp(b.querySelector('.rv-pk-ck'), {from: .2});
      ui.animate(b.querySelector('.rv-pk-av .av'), [{transform: 'scale(.86)'}, {transform: 'scale(1)'}], {spring: 'bouncy'});
    }
    const dot = sec.querySelector(`.rv-pk-dots > i[data-dot="${CSS.escape(pop.key)}"]`);
    if (dot) ui.stamp(dot, {from: .3});
  }
  if (all) {
    const c = sec.querySelector('.rv-pk-prog');
    if (c) ui.stamp(c.querySelector('.rv-pk-count'), {from: 1.25});
  }
  if (st.wk.sheet && st.wk.sheet.kind === 'picks') fillSheet();
}
const crowdKey = pm => pm.locked && !pm.loading ? pm.entries.map(e => `${e.uid}:${JSON.stringify(e.picks || {})}`).sort().join(',') : '';

function pickSide(key, id) {
  const w = st && st.wk;
  const pm = pickModel();
  if (!w || !pm) return;
  if (pm.wait) { ui.toast('Still loading your picks. One second.', {icon: 'clock'}); return; }
  if (!pm.open) { ui.toast(pm.off ? PICK_OFF : "Pick'em closed at kickoff.", {icon: pm.off ? 'info' : 'lock'}); return; }
  const g = pm.cur.games.find(x => x.key === key);
  if (!g || (id !== g.a && id !== g.b)) return;
  const picks = Object.assign({}, pm.picks);
  const clear = picks[key] === id;
  if (clear) delete picks[key]; else picks[key] = id;
  w.draft = picks;
  w.touched.set(key, clear ? null : id); // the draft is rebased onto the server's picks with these on top
  w.dirty = true;
  w.save = 'pending';
  const count = pm.cur.games.filter(x => picks[x.key] === x.a || picks[x.key] === x.b).length;
  const all = !clear && count === pm.n && pm.count < pm.n; // the tap that completes the card (not a switch after it)
  ui.haptic(all ? 'success' : clear ? 'selection' : 'light');
  patchPicks({pop: clear ? null : {key, id}, all});
  ui.announce(clear ? `Pick cleared. ${count} of ${pm.n} picked.` : `${nm(id)} to win. ${all ? `All ${pm.n} picked.` : `${count} of ${pm.n} picked.`}`);
  clearTimeout(w.saveT);
  w.saveT = setTimeout(flushPicks, 700); // debounced: a run of taps is one write
}
function flushPicks() {
  const w = st && st.wk;
  if (!w) return;
  clearTimeout(w.saveT);
  w.saveT = 0;
  if (!w.dirty || !w.draft) return;
  sendPicks(w, w.draft);
}
function sendPicks(w, picks) {
  w.dirty = false;
  w.save = 'saving';
  const seq = ++w.saveSeq;
  let p;
  try { p = week.savePicks(picks); } catch (e) { console.error(e); p = 'failed'; }
  Promise.resolve(p).then(r => r, () => 'failed').then(r => {
    if (seq !== w.saveSeq) return; // a newer save owns the status
    if (r === 'ok' || r === 'dev') {
      w.save = 'saved';
      // The snapshot may have echoed the write before this resolved: hand the truth back to it.
      const m = w.psnap && w.psnap.mine && typeof w.psnap.mine === 'object' ? w.psnap.mine.picks : null;
      if (!w.dirty && w.draft && m && sameMap(m, w.draft)) { w.draft = null; w.touched.clear(); }
    }
    else if (r === 'locked') { w.save = ''; w.draft = null; w.touched.clear(); if (st && st.wk === w) ui.toast("Pick'em closed at kickoff.", {icon: 'lock'}); }
    else if (r === 'denied') { w.save = ''; w.draft = null; w.touched.clear(); w.poff = true; if (st && st.wk === w) ui.toast(PICK_OFF, {icon: 'info'}); }
    else { w.save = 'failed'; w.dirty = true; } // the draft stays; Retry (or the next pick) sends it again
    if (st && st.wk === w) patchPicks({});
  });
  if (st && st.wk === w) patchPicks({});
}

// ---------------------------------------------------------------- Past Matchups of the Week
function pastItems(hist) {
  return (Array.isArray(hist) ? hist : []).filter(h => h && h.pick && data.M[pairOf(h.pick)[0]] && data.M[pairOf(h.pick)[1]])
    .slice().sort((x, y) => (y.year - x.year) || (y.week - x.week));
}
// The played game for a past pick: from data.js, else the result week.js carried.
function pastGame(h) {
  const [a, b] = pairOf(h.pick);
  const g = data.GAMES.find(x => x.year === h.year && x.week === h.week && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  if (g) return g;
  const r = h.result;
  if (!r || r.sa == null || r.sb == null) return null;
  return {a: r.a || a, b: r.b || b, sa: +r.sa, sb: +r.sb, week: h.week, year: h.year, type: 'reg', reg: true};
}
const votesStr = h => h.total ? `${h.votes || 0} of ${plural(h.total, 'vote', 'votes')}` : plural(h.votes || 0, 'vote', 'votes');
const votedFor = h => !!(h.mine && h.mine.pick && h.mine.pick === h.pick);
function pastItemHTML(h, hidden) {
  const g = pastGame(h);
  const foot = `WK ${h.week} · ${votesStr(h)}`.toUpperCase();
  const cls = `rv-past-it${hidden ? ' is-more' : ''}`;
  if (g) return ui.scoreBug(g, {footer: foot, cls, key: h.key || `${h.year}-w${h.week}`, badges: votedFor(h) ? [['you', 'Your vote']] : null, attrs: {'data-motw': h.pick, 'data-press': 'row'}});
  const [a, b] = pairOf(h.pick);
  return `<button type="button" class="bug bug-row rv-past-np ${cls}" data-motw="${esc(h.pick)}" data-press="row" aria-label="${esc(`Week ${h.week}, ${nm(a)} versus ${nm(b)}, not played yet. ${votesStr(h)}`)}">`
    + `<span class="bug-side is-tie">${ui.avatar(a, {size: 24})}<span class="bug-name"><b>${esc(nm(a))}</b></span></span>`
    + `<span class="bug-side is-tie">${ui.avatar(b, {size: 24})}<span class="bug-name"><b>${esc(nm(b))}</b></span></span>`
    + `<span class="bug-foot"><span class="ovl">${esc(foot)} · NOT PLAYED YET</span></span></button>`;
}
// Each manager's record when the league made their game the Matchup of the Week (played games only).
function spotRecords(items) {
  let r = null;
  try { r = week.records(items); } catch (_) { r = null; }
  if (r && typeof r === 'object') {
    return Object.keys(r).filter(id => data.M[id] && (r[id].w + r[id].l + r[id].t) > 0).map(id => ({id, w: r[id].w, l: r[id].l, t: r[id].t}))
      .sort((x, y) => (y.w - y.l) - (x.w - x.l) || y.w - x.w || nm(x.id).localeCompare(nm(y.id)));
  }
  const m = new Map();
  const add = id => { if (!m.has(id)) m.set(id, {id, w: 0, l: 0, t: 0}); return m.get(id); };
  items.forEach(h => {
    const g = pastGame(h);
    if (!g || !data.M[g.a] || !data.M[g.b]) return;
    const A = add(g.a), B = add(g.b);
    if (g.sa === g.sb) { A.t++; B.t++; } else if (g.sa > g.sb) { A.w++; B.l++; } else { B.w++; A.l++; }
  });
  return [...m.values()].sort((x, y) => (y.w - y.l) - (x.w - x.l) || y.w - x.w || nm(x.id).localeCompare(nm(y.id)));
}
function pastHTML(hist) {
  const items = pastItems(hist);
  if (!items.length) return '';
  const all = !!(st && st.pastAll);
  const more = items.length > 3;
  const recs = spotRecords(items);
  return `<section class="rv-past${all ? ' is-all' : ''}" aria-labelledby="rv-past-h">`
    + `<h2 class="t-2 rv-past-h" id="rv-past-h">Past Matchups of the Week</h2>`
    + ui.group(items.map((h, i) => pastItemHTML(h, i >= 3)).join(''), {cls: 'rv-past-list'})
    + (more ? `<div class="rv-past-more">${ui.button({label: all ? 'Show fewer' : `Show all ${items.length}`, kind: 'plain', size: 's', attrs: {'data-past-more': '', 'aria-expanded': String(all)}})}</div>` : '')
    + (recs.length ? `<div class="rv-spot"><p class="ovl rv-spot-h">MOTW records</p><div class="rv-spot-rail" data-hscroll role="list">`
      + recs.map(r => `<a class="rv-spot-c" role="listitem" href="#/managers/${encodeURIComponent(r.id)}" aria-label="${esc(`${nm(r.id)}, ${data.recStr(r.w, r.l, r.t)} in Matchups of the Week`)}">${ui.avatar(r.id, {size: 24, you: r.id === data.me(), attrs: {'data-morph-from': true}})}<span class="rv-spot-n">${esc(nm(r.id))}</span><span class="n5 rv-spot-r">${esc(data.recStr(r.w, r.l, r.t))}</span></a>`).join('')
      + `</div></div>` : '')
    + `</section>`;
}
function patchPast(animate) {
  const w = st && st.el.querySelector('.rv-past-w');
  if (!w) return;
  const html = pastHTML(st.wk.hist);
  if (w._html === html) return;
  const was = !!w._html;
  w.innerHTML = html;
  w._html = html;
  syncH2hTitle();
  if (animate && html && !was) ui.animate(w, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.22,1,.36,1)'});
}
function togglePast() {
  const sec = st && st.el.querySelector('.rv-past');
  if (!sec) return;
  st.pastAll = !st.pastAll;
  sec.classList.toggle('is-all', st.pastAll);
  const b = sec.querySelector('[data-past-more]');
  if (b) {
    b.setAttribute('aria-expanded', String(st.pastAll));
    b.querySelector('.btn-label').textContent = st.pastAll ? 'Show fewer' : `Show all ${sec.querySelectorAll('.rv-past-it').length}`;
  }
  const w = sec.closest('.rv-past-w');
  if (w) w._html = pastHTML(st.wk.hist);
  if (st.pastAll) sec.querySelectorAll('.rv-past-it.is-more').forEach(n => ui.animate(n, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'ease-out'}));
}

// ---------------------------------------------------------------- Sheets: who voted, everyone's picks, standings
function votesSheetBody() {
  const vm = voteModel();
  if (!vm) return ui.empty({icon: 'versus', title: 'No games this week.'});
  const status = vm.off ? VOTE_OFF : vm.locked ? 'Voting closed.' : `Voting closes ${closeText(vm.cur)}.`;
  const head = `<p class="rv-sh-sub">${esc(`${plural(vm.total, 'vote', 'votes')}. ${status}`)}</p>`;
  const order = hypeOrder();
  const keys = vm.cur.games.map(g => g.key).sort((x, y) => (vm.tally[y] || 0) - (vm.tally[x] || 0) || order.indexOf(x) - order.indexOf(y));
  const withVotes = keys.filter(k => vm.tally[k]);
  const none = keys.filter(k => !vm.tally[k]);
  const groups = withVotes.map(k => {
    const n = vm.tally[k];
    const lead = vm.locked && vm.leader === k;
    const rows = vm.voters[k].map(v => {
      const w = who(v);
      const t = atMs(v.at);
      return ui.row({lead: whoAvatar(v, 32), title: w.you ? `${w.name} (you)` : w.name,
        trail: t ? `<span class="t-foot ink3">${esc(timeLabel(new Date(t)))}</span>` : '', me: w.you});
    }).join('');
    const hdr = `${pairName(k)} · ${plural(n, 'vote', 'votes')}, ${Math.round(100 * n / vm.total)}%${lead ? " · League's pick" : ''}`;
    return ui.group(rows, {header: hdr});
  }).join('');
  const rest = none.length ? `<p class="rv-sh-note">No votes: ${esc(andJoin(none.map(pairName)))}.</p>` : '';
  if (!vm.total) return head + ui.empty({icon: 'versus', title: 'No votes yet.', body: vm.open ? 'Tap Vote on the game you most want to watch.' : ''});
  return head + groups + rest;
}
function picksSheetBody() {
  const pm = pickModel();
  if (!pm) return ui.empty({icon: 'versus', title: 'No games this week.'});
  if (!pm.entries.length) return ui.empty({icon: 'list-number', title: 'Nobody made picks.'});
  const games = pm.cur.games.map(g => {
    const col = id => {
      const l = pm.entries.filter(e => e.picks && e.picks[g.key] === id).sort((x, y) => (y.you - x.you) || who(x).name.localeCompare(who(y).name));
      return `<div class="rv-sp-col"><div class="rv-sp-h">${ui.avatar(id, {size: 24})}<span class="rv-sp-hn">${esc(nm(id))}</span><span class="n5 rv-sp-hc">${l.length}</span></div>`
        + (l.length ? `<ul class="rv-sp-l">${l.map(e => `<li>${whoAvatar(e, 20)}<span>${esc(who(e).you ? 'You' : who(e).name)}</span></li>`).join('')}</ul>` : `<p class="rv-sp-none">Nobody</p>`)
        + `</div>`;
    };
    return `<div class="rv-sp-g" role="group" aria-label="${esc(`${nm(g.a)} versus ${nm(g.b)}`)}">${col(g.a)}${col(g.b)}</div>`;
  }).join('');
  return `<p class="rv-sh-sub">${esc(`${plural(pm.entries.length, 'person', 'people')} made picks for week ${pm.cur.week}.`)}</p>${games}`;
}
function standBody(res) {
  if (res === null) return ui.skeleton('rows', 5, {label: 'Loading standings.'});
  if (res && res.error && !(Array.isArray(res) && res.some(r => r && r.graded > 0))) {
    return errKind(res.error) === 'denied'
      ? ui.empty({icon: 'info', title: PICK_OFF})
      : ui.empty({icon: 'info', title: "Standings didn't load.", body: 'Check your connection and try again.', action: {label: 'Try again', attrs: {'data-pk-stand-retry': ''}}});
  }
  const rows = Array.isArray(res) ? res.filter(r => r && r.graded > 0) : [];
  const cur = st && st.wk && st.wk.cur;
  if (!rows.length) {
    return ui.empty({icon: 'list-number', title: 'No standings yet.', body: cur ? `The table starts once week ${cur.week} is played.` : 'The table starts once a week with picks is played.'});
  }
  const uid = st && st.wk ? mineUid(st.wk.psnap) : null;
  let rank = 0, prev = null;
  const body = rows.map((r, i) => {
    const rk = r.rank != null ? r.rank : (prev && prev.right === r.right && prev.graded === r.graded ? rank : i + 1);
    rank = rk; prev = r;
    const you = r.you === true || (!!uid && r.uid === uid);
    const w = who(Object.assign({}, r, {you}));
    const lead = `<span class="n5 rv-st-rk${rk === 1 ? ' gold' : ''}">${rk}</span>${w.id ? ui.avatar(w.id, {size: 32, you, crown: rk === 1}) : ui.nickAvatar(w.name, {size: 32, you, crown: rk === 1})}`;
    const weeks = r.weeks != null ? plural(Array.isArray(r.weeks) ? r.weeks.length : +r.weeks || 0, 'week', 'weeks') : '';
    // Out of every decided game in the weeks they played (week.js `games`; a skipped game is a miss).
    const of = r.games || r.graded;
    const pct = of ? `${Math.round(100 * r.right / of)}% right` : '';
    return ui.row({lead, title: w.you ? `${w.name} (you)` : w.name, sub: [weeks, pct].filter(Boolean).join(' · '),
      trail: `<span class="rv-st-v"><span class="n4">${r.right}</span><span class="t-cap ink3">of ${of}</span></span>`, me: you, key: r.uid});
  }).join('');
  return `<p class="rv-sh-sub">${esc(`${cur ? cur.year : ''} season. A point for every winner called; a game you skip is a miss.`.trim())}</p>` + ui.group(body, {cls: 'rv-st-list'});
}
function fillSheet() {
  const w = st && st.wk;
  const s = w && w.sheet;
  if (!s || !s.s.el.isConnected) return;
  const html = s.kind === 'votes' ? votesSheetBody() : s.kind === 'picks' ? picksSheetBody() : standBody(w.stand);
  if (s.html === html) return;
  s.html = html;
  const b = s.s.body;
  const top = b.scrollTop;
  b.innerHTML = html;
  b.scrollTop = top;
  ui.hydrate(b);
}
function openWeekSheet(kind, focusKey) {
  const w = st && st.wk;
  if (!w) return;
  const vm = kind === 'votes' ? voteModel() : null;
  const cur = w.cur;
  const title = kind === 'votes' ? `Week ${cur ? cur.week : ''} votes` : kind === 'picks' ? `Week ${cur ? cur.week : ''} picks` : "Pick'em leaderboard";
  const body = kind === 'votes' ? votesSheetBody() : kind === 'picks' ? picksSheetBody() : standBody(w.stand);
  const rec = {kind, html: body, s: null};
  rec.s = ui.openSheet({title, body, cls: `sh-rv sh-rv-${kind}`, detents: ['medium', 'large'],
    onClose: () => { if (st && st.wk === w && w.sheet === rec) w.sheet = null; }});
  w.sheet = rec;
  rec.s.el.addEventListener('click', e => {
    if (!e.target.closest('[data-pk-stand-retry]') || !st || st.wk !== w) return;
    w.stand = null;
    fillSheet();
    loadStandings(true);
  });
  if (kind === 'votes' && focusKey && vm && vm.tally[focusKey]) {
    // Opened from a game's voters: that game's group first in view.
    const b = rec.s.body;
    const h = [...b.querySelectorAll('.group-h')].find(x => x.textContent.startsWith(pairName(focusKey)));
    if (h && h !== b.querySelector('.group-h')) b.scrollTop = Math.max(0, h.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 12);
  }
  if (kind === 'stand') loadStandings(true);
}
function loadStandings(force) {
  const w = st && st.wk;
  if (!w || (w.standP && !force)) return w && w.standP;
  let p;
  try { p = Promise.resolve(week.standings()); } catch (e) { p = Promise.reject(e); }
  w.standP = p.then(rows => { w.stand = Array.isArray(rows) ? rows : []; }, e => { console.warn('standings', e); w.stand = {error: e}; w.standP = null; })
    .then(() => { if (st && st.wk === w && w.sheet && w.sheet.kind === 'stand') { const b = w.sheet.s.body; ui.crossfade(b, () => fillSheet()); } });
  return w.standP;
}
function loadHistory() {
  const w = st && st.wk;
  if (!w) return;
  const seq = ++w.histSeq;
  let p;
  try { p = Promise.resolve(week.history()); } catch (e) { p = Promise.reject(e); }
  p.then(h => {
    if (!st || st.wk !== w || seq !== w.histSeq) return;
    w.hist = Array.isArray(h) ? h : [];
    ui.whenIdle(() => { if (st && st.wk === w) patchPast(true); });
  }, e => console.warn('motw history', e));
}

// ---------------------------------------------------------------- Subscriptions and lifecycle
function newWk() {
  const cur = curWeek();
  return {cur, vsnap: null, psnap: null, vpend: undefined, vseq: 0, vT: 0, voff: false, poff: false,
    draft: null, touched: new Map(), dirty: false, save: '', saveT: 0, saveSeq: 0, hist: null, histSeq: 0, stand: null, standP: null,
    unsub: [], idleV: null, idleP: null, sheet: null, lockedShown: lockedNow(cur), started: false, last: null};
}
function sameMap(x, y) {
  const a = x || {}, b = y || {};
  const ka = Object.keys(a).filter(k => a[k]), kb = Object.keys(b).filter(k => b[k]);
  return ka.length === kb.length && ka.every(k => a[k] === b[k]);
}
function wkSubscribe() {
  const w = st && st.wk;
  if (!w) return;
  wkUnsub();
  const cur = w.cur;
  if (!cur) return;
  const key = cur.key;
  const onVotes = s => {
    if (!st || st.wk !== w || !w.cur || w.cur.key !== key || !s) return;
    const e = errKind(s.error);
    w.voff = e === 'denied'; // follows the rules: switched on while the screen is open, it opens up
    if (e && !s.votes) { if (!w.vsnap) w.vsnap = {votes: [], mine: null, error: s.error}; }
    else w.vsnap = s;
    if (w.vpend !== undefined) {
      const m = s.mine ? (typeof s.mine === 'string' ? s.mine : s.mine.pick || null) : null;
      if (m === w.vpend || (w.vpend === null && !m)) { w.vpend = undefined; clearTimeout(w.vT); }
    }
    if (w.idleV) w.idleV();
    w.idleV = ui.whenIdle(() => { w.idleV = null; if (st && st.wk === w) patchVotes({animate: true}); });
  };
  const onPicks = s => {
    if (!st || st.wk !== w || !w.cur || w.cur.key !== key || !s) return;
    const e = errKind(s.error);
    w.poff = e === 'denied';
    if (e && !s.entries) { if (!w.psnap) w.psnap = {entries: [], mine: null, error: s.error}; }
    else w.psnap = s;
    const m = s.mine && typeof s.mine === 'object' ? s.mine.picks : null;
    if (w.draft && s.ready !== false && !e) {
      // The server's picks are the base; only the games you tapped here sit on top of them. A pick made on
      // another phone (or saved before this screen knew about it) is never dropped by a later save from here.
      const next = Object.assign({}, m || {});
      w.touched.forEach((v, k) => { if (v) next[k] = v; else delete next[k]; });
      if (!sameMap(next, w.draft)) w.draft = next;
    }
    // Your own saved picks came back and match what's on screen: drop the draft (the server is the truth).
    if (w.draft && !w.dirty && w.save !== 'saving' && m && sameMap(m, w.draft)) { w.draft = null; w.touched.clear(); }
    if (w.idleP) w.idleP();
    w.idleP = ui.whenIdle(() => { w.idleP = null; if (st && st.wk === w) patchPicks({}); });
  };
  try { w.unsub.push(week.subscribeVotes(key, onVotes)); } catch (e) { console.error(e); }
  try { w.unsub.push(week.subscribePicks(key, onPicks)); } catch (e) { console.error(e); }
}
function wkUnsub() {
  const w = st && st.wk;
  if (!w) return;
  w.unsub.splice(0).forEach(f => { try { if (typeof f === 'function') f(); } catch (_) {} });
  if (w.idleV) { w.idleV(); w.idleV = null; }
  if (w.idleP) { w.idleP(); w.idleP = null; }
}
function wkStart() {
  const w = st && st.wk;
  if (!w || w.started) return;
  w.started = true;
  wkSubscribe();
  loadHistory();
  loadLast();
}
// Kickoff passes while the screen is open: everything turns read-only in place.
function wkTick() {
  const w = st && st.wk;
  if (!w || !w.cur) return;
  const locked = lockedNow(w.cur);
  if (locked === w.lockedShown) return;
  w.lockedShown = locked;
  if (locked) { clearTimeout(w.saveT); w.saveT = 0; w.dirty = false; w.vpend = undefined; }
  patchVotes({animate: false});
  patchPicks({});
}
// New data: the week may have moved on (subscribe to the new one), records and results changed.
function wkData() {
  const w = st && st.wk;
  if (!w) return;
  const cur = curWeek();
  const moved = (cur && cur.key) !== (w.cur && w.cur.key);
  if (moved) {
    flushPicks();
    wkUnsub();
    Object.assign(w, {cur, vsnap: null, psnap: null, vpend: undefined, draft: null, touched: new Map(), dirty: false, save: '', stand: null, standP: null, lockedShown: lockedNow(cur)});
    if (w.started) wkSubscribe();
  } else w.cur = cur;
  replacePickem();
  if (w.started) { loadHistory(); loadLast(); }
}
// Render the Pick'em section afresh (records, you-rings, a new week), or add / remove it.
function replacePickem() {
  const sec = st.el.querySelector('.rv-pk');
  const html = pickemHTML();
  if (sec) {
    if (html) { const t = document.createElement('template'); t.innerHTML = html; sec.replaceWith(t.content.firstElementChild); } else sec.remove();
  } else if (html) {
    const anchor = st.el.querySelector('.rv-past-w');
    if (anchor) anchor.insertAdjacentHTML('beforebegin', html);
  }
  syncH2hTitle();
}
function syncH2hTitle() {
  const t = st && st.el.querySelector('.rv-h2h-t');
  if (!t) return;
  const has = !!st.el.querySelector('.rv-week .rv-motw, .rv-week .rv-pk, .rv-week .rv-past');
  t.hidden = !has;
  syncChrome();
}
// Deep links from other screens: #/rivals?s=motw | vote | pickem | picks | past | h2h
const SEC = {motw: 'rv-motw', vote: 'rv-motw', votes: 'rv-motw', pickem: 'rv-pickem', picks: 'rv-pickem', past: 'rv-past', h2h: 'rv-h2h'};
function secOf(q) {
  const v = q && (q.s || q.section || q.focus);
  return v ? SEC[String(v).toLowerCase()] || null : null;
}
function revealSec() {
  if (!st || !st.goSec || !st.ctx.visible) return;
  const id = st.goSec;
  st.goSec = null;
  const t = setTimeout(() => {
    const el = st && st.el.querySelector('#' + id);
    if (!el || !el.getClientRects().length) return;
    // Arriving from another screen: land on the section at once (no long scroll right after the tab switch),
    // then a soft tint pulse on its card says "here".
    scrollUnder(el, 8, 'auto');
    const card = el.querySelector('.card, .group');
    if (card && !ui.RM) {
      const f = document.createElement('i');
      f.className = 'rv-flash';
      f.setAttribute('aria-hidden', 'true');
      card.append(f);
      ui.animate(f, [{opacity: 0}, {opacity: 1, offset: .25}, {opacity: 0}], {duration: 1100, easing: 'ease-out'}).finished.catch(() => {}).then(() => f.remove());
    }
  }, 60);
  st.cleanups.push(() => clearTimeout(t));
}

function pageHTML(m) {
  if (!m || !m.b) {
    return ui.largeTitle({title: 'Rivals'})
      + ui.empty({icon: 'versus', title: 'No rivals yet.', body: 'Rivals needs at least two managers in the league.'});
  }
  const wk = motwHTML(st ? st.lens : readLens()) + pickemHTML();
  const past = st && st.wk && st.wk.hist ? pastHTML(st.wk.hist) : '';
  return ui.largeTitle({title: 'Rivals'})
    + `<div class="rv-week">${wk}<div class="rv-past-w" id="rv-past">${past}</div></div>`
    + `<h2 class="t-2 rv-h2h-t" id="rv-h2h"${wk || past ? '' : ' hidden'}>Head to head</h2>`
    + headerHTML(m)
    + `<div class="rv-main">${mainHTML(m)}</div>`
    + listSecHTML(m);
}

// ============================================================================ Patching
function grab(el) {
  st.r = {
    hdr: el.querySelector('.rv-hdr'),
    main: el.querySelector('.rv-main'),
    listSec: el.querySelector('.rv-list'),
    listW: el.querySelector('.rv-list-w')
  };
  const pw = el.querySelector('.rv-past-w');
  if (pw) pw._html = pw.innerHTML ? pastHTML(st.wk && st.wk.hist) : '';
  markRendered(el);
  st.listA = st.m ? st.m.a : null;
  st.listMe = st.meKey;
}
// Record what freshly rendered markup shows, so later patches can diff against it.
function markRendered(root) {
  root.querySelectorAll('.rv-num').forEach(n => { n._shown = +n.textContent || 0; });
  if (st.m && st.m.n) root.querySelectorAll('.rv-tape-w, .rv-log').forEach(x => { x._html = x.classList.contains('rv-log') ? logHTML(st.m) : tapeHTML(st.m); });
  st.flameKey = st.m && st.m.n ? `${st.m.h.streak.who}|${st.m.h.streak.n}` : null;
  st.secKey = st.m ? st.m.a + '|' + st.m.b : null;
}

// Odometer, serialized per element: a roll that is still running finishes, then rolls on to the latest
// target (a second ui.odometer call mid-roll would restart the columns from its own start value).
function rollTo(el, to, animate) {
  if (!el) return;
  to = Math.max(0, Math.round(Number(to) || 0));
  el._to = to;
  if (el._rolling) return;
  const from = el._shown != null ? el._shown : (+el.textContent || 0);
  if (!animate || ui.RM || from === to || !el.isConnected) {
    el.textContent = String(to);
    el._shown = to;
    return;
  }
  el._rolling = true;
  ui.odometer(el, from, to).then(() => {
    el._rolling = false;
    el._shown = to;
    if (el._to !== to) rollTo(el, el._to, true);
  });
}

// Is el's top on screen below the nav bar? (a layout read: call it before any DOM writes)
function onScreen(el) {
  const scr = st && st.ctx.screen;
  if (!el || !scr) return true;
  const nav = scr.querySelector(':scope > .nav');
  const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect();
  const top = nav ? nav.getBoundingClientRect().bottom : s.top + 20;
  return r.top >= top - 4 && r.top < s.bottom - 80;
}
// Runs fn once el scrolls on screen: a list tap (or a pair arriving from another screen) scrolls back to
// the top first, so the header pops and the numbers roll where they can be seen. Falls back once the
// scroll has stopped (no scroll event for 160 ms, 250 ms when none came yet, AND no movement across the
// next frame: on a slow phone a long task can starve scroll events mid-scroll) or after 1.6 s.
// One pending wait at a time: a newer one flushes the older (its patch lands at once, never lost);
// unmount drops it (stop() without flush).
function whenSeen(el, fn) {
  const scr = st && st.ctx.screen;
  if (!el || !scr) return fn();
  if (st.seen) st.seen(true);
  let idle = 0, max = 0, raf = 0;
  const stop = flush => {
    scr.removeEventListener('scroll', onScroll);
    clearTimeout(idle); clearTimeout(max); cancelAnimationFrame(raf);
    if (st && st.seen === stop) st.seen = null;
    if (flush === true && el.isConnected) fn();
  };
  const go = () => { stop(); if (el.isConnected) fn(); };
  const settle = () => {
    const y = scr.scrollTop;
    raf = requestAnimationFrame(() => { raf = 0; if (scr.scrollTop === y) go(); else arm(160); });
  };
  const arm = ms => { clearTimeout(idle); cancelAnimationFrame(raf); idle = setTimeout(settle, ms); };
  const onScroll = () => { if (onScreen(el)) go(); else arm(160); };
  scr.addEventListener('scroll', onScroll, {passive: true});
  arm(250);
  max = setTimeout(go, 1600);
  st.seen = stop;
}

function flicker(el) {
  if (!el || ui.RM) return;
  ui.animate(el, [
    {opacity: 1, transform: 'scale(1)'}, {opacity: .35, transform: 'scale(.84)'},
    {opacity: 1, transform: 'scale(1.14)'}, {opacity: .4, transform: 'scale(.88)'},
    {opacity: 1, transform: 'scale(1.1)'}, {opacity: .45, transform: 'scale(.9)'},
    {opacity: 1, transform: 'scale(1)'}
  ], {duration: 960, easing: 'ease-in-out'});
}

// A new manager lands in a header slot: the avatar pops (stamp), its glow fades up and the name rises.
function arrive(btn) {
  if (!btn || !btn.isConnected) return;
  btn.classList.remove('is-arriving');
  ui.stamp(btn.querySelector('.rv-av'), {from: .6});
  ui.animate(btn.querySelector('.rv-glow'), [{opacity: 0}, {opacity: 1}], {duration: 420, easing: 'ease-out'});
  ui.animate(btn.querySelector('.rv-pname'), [{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: 240, easing: 'cubic-bezier(.22,1,.36,1)'});
}

// Returns the header buttons whose arrival is held back (defer: the header is off screen; the caller plays
// arrive() once it scrolls into view). Until then .is-arriving keeps the new avatar hidden, so it never shows
// up still and then blinks into the pop. Every patch rewrites className, so the class can never stick.
function patchHeader(m, {animate, via, defer}) {
  const hdr = st.r.hdr;
  const held = [];
  if (!hdr) return held;
  const meChanged = `${data.me()}|${reigning()}` !== st.meKey;
  ['a', 'b'].forEach(side => {
    const btn = hdr.querySelector('.rv-pick.' + side);
    if (!btn) return;
    const id = m[side];
    btn.className = `rv-pick ${side} ${data.color(id).cls}`;
    const changed = btn.dataset.id !== id;
    if (!changed && !meChanged) return;
    btn.innerHTML = pickInner(id);
    btn.dataset.id = id;
    btn.setAttribute('aria-label', pickLabel(id, side));
    if (changed && animate && via !== 'swap') {
      if (defer) { btn.classList.add('is-arriving'); held.push(btn); } else arrive(btn);
    }
  });
  // The swap's crossing avatars land exactly where the new content sits: drop them in the same frame.
  if (st.swapAnims) { st.swapAnims.forEach(a => { try { a.cancel(); } catch (_) {} }); st.swapAnims = null; }
  return held;
}

function patchBoard(animate, via) {
  const m = st && st.m;
  const board = m && st.r.main && st.r.main.querySelector('.rv-board');
  if (!board || !m.n) return;
  const {h} = m;
  // Split bar first: splitUpdate reads the old share from computed style, which is free before any writes.
  const split = board.querySelector('.split');
  if (split) {
    ui.splitUpdate(split, m.pct / 100, {animate});
    const segA = split.querySelector('.split-a'), segB = split.querySelector('.split-b');
    if (segA) segA.className = `split-a ${clsA(m)}`;
    if (segB) segB.className = `split-b ${clsB(m)}`;
    const bar = split.querySelector('.split-bar');
    if (bar) bar.setAttribute('aria-label', `${nm(m.a)} ${m.pct} percent, ${nm(m.b)} ${100 - m.pct} percent`);
  }
  const sideCls = s => m.lead === s ? ' is-lead' : m.lead ? ' is-trail' : '';
  const sa = board.querySelector('.rv-side.a'), sb = board.querySelector('.rv-side.b');
  sa.className = `rv-side a ${clsA(m)}${sideCls('a')}`;
  sb.className = `rv-side b ${clsB(m)}${sideCls('b')}`;
  sa.querySelector('.rv-wl').textContent = h.aw === 1 ? 'Win' : 'Wins';
  sb.querySelector('.rv-wl').textContent = h.bw === 1 ? 'Win' : 'Wins';
  board.querySelector('.rv-wash.a').className = `rv-wash a ${clsA(m)}`;
  board.querySelector('.rv-wash.b').className = `rv-wash b ${clsB(m)}`;
  board.querySelector('.rv-sr').textContent = srSummary(m);
  rollTo(sa.querySelector('.rv-num'), h.aw, animate);
  rollTo(sb.querySelector('.rv-num'), h.bw, animate);
  const t = board.querySelector('.rv-foot-t');
  const txt = footText(m);
  if (t.textContent !== txt) t.textContent = txt;
  const fw = board.querySelector('.rv-flame-w');
  const hot = h.streak.n >= 3;
  const key = `${h.streak.who}|${h.streak.n}`;
  // Delight 8.12: a hot streak's flame flickers when it first shows, when the streak changes, and on a swap.
  const flare = hot && animate && (via === 'swap' || fw.hidden || st.flameKey !== key);
  fw.hidden = !hot;
  if (flare) flicker(fw.querySelector('.rv-flame'));
  st.flameKey = key;
}

function patchSections(m, {animate, pairChanged}) {
  const main = st.r.main;
  const fade = animate && pairChanged;
  [['.rv-tape-w', tapeHTML(m)], ['.rv-log', logHTML(m)]].forEach(([sel, html]) => {
    const w = main.querySelector(sel);
    if (!w || w._html === html) return;
    const put = () => { w.innerHTML = html; w._html = html; };
    if (fade) ui.crossfade(w, put); else put();
  });
}

function patchRow(li, a, x, sel, animate, meChanged) {
  const share = x.n ? (x.w + x.t / 2) / x.n : 0;
  const tone = x.w > x.l ? 'tint' : x.w < x.l ? 'wrong' : 'ink2';
  const rec = data.recStr(x.w, x.l, x.t);
  const on = x.id === sel;
  li.classList.toggle('is-selected', on);
  const hit = li.querySelector('.rv-opp-hit');
  hit.setAttribute('aria-pressed', String(on));
  hit.setAttribute('aria-label', `${nm(x.id)}, ${rec}`);
  const r = li.querySelector('.rv-opp-rec');
  if (r.textContent !== rec) r.textContent = rec;
  r.className = `rv-opp-rec n4 ${tone}`;
  const bar = li.querySelector('.rv-opp-bar');
  bar.className = `rv-opp-bar ${data.color(a).cls}`;
  const i = bar.querySelector('i');
  const old = parseFloat(i.dataset.share);
  if (!(Math.abs(old - share) < 1e-6)) {
    i.dataset.share = share;
    i.style.transform = `scaleX(${share})`;
    if (animate && isFinite(old)) ui.animate(i, [{transform: `scaleX(${old})`}, {transform: `scaleX(${share})`}], {spring: 'smooth'});
  }
  if (meChanged) li.querySelector('.rv-opp-av').innerHTML = ui.avatar(x.id, {size: 32, you: x.id === data.me(), attrs: {'data-morph-from': true}});
}

function patchList(m, {animate, meChanged}) {
  const sec = st.r.listSec;
  if (!sec) return;
  const title = `${nm(m.a)} against everyone`;
  const h2 = sec.querySelector('.sh > h2');
  if (h2 && h2.textContent !== title) {
    h2.textContent = title;
    if (animate) ui.animate(h2, [{opacity: 0}, {opacity: 1}], {duration: 160, easing: 'linear'});
  }
  const w = st.r.listW;
  const ul = w.querySelector('.rv-opps');
  const rows = opponents(m.a);
  if (!ul || !rows.length) { w.innerHTML = listHTML(m); return; }
  ul.setAttribute('aria-label', title);
  const have = new Map([...ul.children].map(li => [li.dataset.key, li]));
  const els = rows.map(x => {
    const li = have.get(x.id);
    if (li) { patchRow(li, m.a, x, m.b, animate, meChanged); return li; }
    const t = document.createElement('template');
    t.innerHTML = oppRow(m.a, x, m.b);
    return t.content.firstElementChild;
  });
  const same = els.length === ul.children.length && els.every((li, i) => ul.children[i] === li);
  if (!same) ul.replaceChildren(...els);
}

// The compact title reads "{A} {aw}–{bw} {B}". Screens pushed on top keep the plain "‹ Rivals" back label
// (ctx.setBackTitle in mount), never "‹ Ben 8–0 Say…".
function chrome(m) {
  st.title = titleOf(m);
  st.hasShare = !!(m && m.b && m.n);
  st.chromeKey = null;
  syncChrome();
}
// While the week sections are what you're looking at (the "Head to head" title is still below the bar), the
// compact bar names the week and drops the rivalry's share action: both would describe a matchup that isn't on
// screen. Re-checked on scroll (once per frame) and whenever the week sections change.
function weekInView() {
  const t = st.el.querySelector('#rv-h2h');
  if (!t || t.hidden || !t.isConnected) return false;
  const scr = st.ctx.screen;
  if (!scr) return false;
  const nav = scr.querySelector(':scope > .nav');
  const line = nav ? nav.getBoundingClientRect().bottom : scr.getBoundingClientRect().top + 44;
  const top = t.getBoundingClientRect().top;
  return !!top && top > line + 4;
}
function syncChrome() {
  if (!st) return;
  const cur = st.wk && st.wk.cur;
  const inWeek = weekInView();
  const key = `${inWeek}|${st.title}|${st.hasShare}|${cur ? cur.week : ''}`;
  if (key === st.chromeKey) return;
  st.chromeKey = key;
  st.ctx.setTitle(inWeek ? (cur ? `Week ${cur.week}` : 'Rivals') : (st.title || 'Rivals'));
  st.ctx.setActions(!inWeek && st.hasShare ? null : []);
}

// Apply a (possibly new) pair. Phase 1 (this frame): the matchup header, the scoreboard and the title, so a
// swap or a pick lands at once. Phase 2 (next frame): the tape, the meeting log and the list, which sit
// below the fold; splitting keeps each task short on slow phones.
// via: 'swap' | 'pick' | 'list' (a row in "{A} against everyone") | 'ext' (the route moved from outside,
// e.g. a profile's Rivalries link over Rivals) | null (data, me, canonicalizing).
function apply(pair, {animate = true, via = null} = {}) {
  const prev = st.m;
  const m = model(pair.a, pair.b);
  const main = st.r.main, hdr = st.r.hdr;
  const board = main.querySelector('.rv-board');
  const both = !!(prev && prev.n && m.n);
  // 'list' and 'ext' scroll back to the top: the header's arrival and the roll wait until they are in view.
  // (layout reads, before any write; the header sits above the board, so it is the one to watch)
  const far = animate && (via === 'list' || via === 'ext');
  const waitOn = !far ? null : !onScreen(hdr) ? hdr : (both && !onScreen(board)) ? board : null;
  st.m = m;
  const held = patchHeader(m, {animate, via, defer: !!waitOn});
  st.meKey = `${data.me()}|${reigning()}`;
  let later = null;
  if (both) {
    if (waitOn) later = () => patchBoard(true, via);
    else patchBoard(animate, via);
  } else if (!prev || prev.a !== m.a || prev.b !== m.b || !!prev.n !== !!m.n) {
    const put = () => { main.innerHTML = mainHTML(m); markRendered(main); };
    if (animate) {
      ui.crossfade(main, put, {duration: 160});
      const nb = main.querySelector('.rv-board');
      if (nb) ui.splitIn(nb);
    } else put();
  }
  if (waitOn) whenSeen(waitOn, () => { held.forEach(arrive); if (later) later(); });
  chrome(m);
  schedule2(animate);
  if (!USER_VIA.includes(via)) return;
  // Spec 9: the new matchup is only drawn (the score is aria-hidden, .rv-sr is silent), so say it.
  ui.announce(spoken(m));
  // A list row or a link on a pushed profile leaves focus at the bottom of the page, on the screen, or in
  // another tab's now hidden layer while the page scrolls to the top: move it to the opponent picker, which
  // now names the new opponent.
  if ((via === 'list' || via === 'ext') && st.ctx.visible) {
    const f = document.activeElement;
    if (!f || f === document.body || f === st.ctx.screen || (st.r.listSec && st.r.listSec.contains(f))
      || !f.getClientRects().length || !!f.closest('.tab-layer[hidden]')) focusPicker('b');
  }
}

// Phase 2. Idempotent: always brings the lower sections up to date with st.m.
function phase2(animate) {
  if (!st || !st.m || !st.m.b) return;
  const m = st.m;
  const key = m.a + '|' + m.b;
  if (m.n) patchSections(m, {animate, pairChanged: st.secKey !== key});
  st.secKey = key;
  const meKey = st.meKey;
  const run = () => { patchList(m, {animate, meChanged: st.listMe !== meKey}); st.listA = m.a; st.listMe = meKey; };
  const ul = st.r.listW && st.r.listW.querySelector('.rv-opps');
  if (animate && ul && st.listA !== m.a) ui.flip(ul, run); else run();
}
// After the next frame paints (rAF, then a task), with a timer fallback for frameless background tabs.
function schedule2(animate) {
  if (st.p2) st.p2();
  let dead = false, raf = 0, t1 = 0, t2 = 0;
  const cancel = () => { dead = true; cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); if (st && st.p2 === cancel) st.p2 = null; };
  const go = () => { if (dead) return; cancel(); phase2(animate); };
  raf = requestAnimationFrame(() => { t1 = setTimeout(go, 0); });
  t2 = setTimeout(go, 250);
  st.p2 = cancel;
}

// ============================================================================ Interactions
function go(a, b, via) {
  const path = canon(a, b);
  st.expect = path;
  st.isDefault = false;
  st.via = via;
  return st.ctx.replace(path);
}

function scrollTop() {
  const scr = st.ctx.screen;
  if (scr.scrollTop > 0) scr.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
}
// preventScroll: a smooth scroll to the top that is under way carries on.
function focusPicker(side) {
  const b = st && st.r.hdr && st.r.hdr.querySelector('.rv-pick.' + side);
  if (b) b.focus({preventScroll: true});
}

async function pick(side) {
  if (!st || st.swapping || !st.m || !st.m.b) return;
  const ctx = st.ctx;
  const cur = st.m[side], other = side === 'a' ? st.m.b : st.m.a;
  const id = await ui.pickManager({title: 'Pick a manager', selected: cur, disabled: [other]});
  if (!st || st.ctx !== ctx || !st.m || !id || id === 'none' || !data.M[id]) return;
  const a = side === 'a' ? id : st.m.a, b = side === 'b' ? id : st.m.b;
  if (a === b || (a === st.m.a && b === st.m.b)) return;
  go(a, b, 'pick');
}

function swap() {
  if (!st || st.swapping || !st.m || !st.m.b) return;
  const ctx = st.ctx;
  const {a, b} = st.m;
  const hdr = st.r.hdr;
  const pa = hdr.querySelector('.rv-pick.a'), pb = hdr.querySelector('.rv-pick.b');
  ui.haptic('light');
  st.swapping = true;
  const release = ctx.busy();
  const dx = pb.getBoundingClientRect().left - pa.getBoundingClientRect().left;
  const cross = (el, d, s) => ui.animate(el, [
    {transform: 'translateX(0) scale(1)'},
    {transform: `translateX(${d / 2}px) scale(${s})`, offset: .5},
    {transform: `translateX(${d}px) scale(1)`}
  ], {spring: 'snappy', fill: 'forwards'});
  const anims = [cross(pa, dx, .88), cross(pb, -dx, 1.08)];
  ui.animate(hdr.querySelector('.rv-swap-ic'), [{transform: 'rotate(0deg)'}, {transform: 'rotate(180deg)'}], {spring: 'snappy'});
  // The captions dip while the avatars pass each other, so the two names never smear across one another.
  hdr.querySelectorAll('.rv-pname, .rv-pteam').forEach(t => ui.animate(t, [{opacity: 1}, {opacity: .15, offset: .35}, {opacity: .15, offset: .6}, {opacity: 1}], {duration: 300, easing: 'linear'}));
  st.swapAnims = anims;
  Promise.all(anims.map(x => x.finished.catch(() => {})))
    .then(() => (st && st.ctx === ctx) ? go(b, a, 'swap') : null)
    .finally(() => {
      if (st && st.ctx === ctx) {
        if (st.swapAnims) { st.swapAnims.forEach(x => { try { x.cancel(); } catch (_) {} }); st.swapAnims = null; }
        st.swapping = false;
      }
      release();
    });
}

function chooseOpp(id) {
  if (!st || st.swapping || !st.m) return;
  if (!data.M[id] || id === st.m.a) return;
  if (id === st.m.b) {
    scrollTop();
    if (st.r.listSec && st.r.listSec.contains(document.activeElement)) focusPicker('b');
    return;
  }
  ui.haptic('selection');
  // Instant feedback: the tint bar moves before the route update lands.
  const ul = st.r.listW.querySelector('.rv-opps');
  if (ul) [...ul.children].forEach(li => {
    const on = li.dataset.key === id;
    li.classList.toggle('is-selected', on);
    li.querySelector('.rv-opp-hit').setAttribute('aria-pressed', String(on));
  });
  go(st.m.a, id, 'list');
  scrollTop();
}

function onClick(e) {
  const t = e.target.closest && e.target.closest('[data-swap], [data-pick], [data-opp], [data-motw], [data-motw-more], [data-motw-share], '
    + '[data-vote], [data-vt-who], [data-pk], [data-pk-stand], [data-pk-all], [data-pk-retry], [data-past-more]');
  if (!t || !st) return;
  if (t.hasAttribute('data-vote')) vote(t.dataset.vote);
  else if (t.hasAttribute('data-vt-who')) openWeekSheet('votes', t.dataset.vtWho);
  else if (t.hasAttribute('data-pk')) pickSide(t.dataset.pk, t.dataset.id);
  else if (t.hasAttribute('data-pk-stand')) openWeekSheet('stand');
  else if (t.hasAttribute('data-pk-all')) openWeekSheet('picks');
  else if (t.hasAttribute('data-pk-retry')) { const w = st.wk; if (w && w.draft) { ui.haptic('light'); sendPicks(w, w.draft); } }
  else if (t.hasAttribute('data-past-more')) { ui.haptic('light'); togglePast(); }
  else if (t.hasAttribute('data-motw')) chooseMotw(t.dataset.motw);
  else if (t.hasAttribute('data-motw-more')) { ui.haptic('light'); toggleMore(!st.all); }
  else if (t.hasAttribute('data-motw-share')) shareMotw();
  else if (t.hasAttribute('data-swap')) swap();
  else if (t.hasAttribute('data-pick')) {
    const side = t.dataset.pick === 'a' ? 'a' : 'b';
    // The no-games card's button is gone once the pick lands: let the header picker own the sheet, so
    // focus has somewhere to come back to (openSheet returns it to document.activeElement at open).
    if (t.closest('.rv-none')) focusPicker(side);
    pick(side);
  }
  else if (t.hasAttribute('data-opp')) chooseOpp(t.dataset.opp);
}

// ============================================================================ View
export default {
  id: 'rivals',
  title: 'Rivals',
  actions: () => SHARE,

  render(ctx) {
    const p = resolvePair(ctx.params);
    return pageHTML(p.a && p.b ? model(p.a, p.b) : null);
  },

  mount(el, ctx) {
    const p = resolvePair(ctx.params);
    st = {ctx, el, m: null, r: {}, isDefault: p.isDefault, expect: null, via: null, swapping: false, swapAnims: null,
      meKey: `${data.me()}|${reigning()}`, flameKey: null, secKey: null, listA: null, listMe: null, p2: null, seen: null, title: null,
      cleanups: [], entrance: false, shown: false, lens: readLens(), all: false, pastAll: false, wk: null, goSec: secOf(ctx.query)};
    st.wk = newWk();
    el.addEventListener('click', onClick);
    // The week: Firestore starts once the first paint is done (never blocks the screen); kickoff is checked
    // every 20 s while the screen is visible; a pick still waiting for its debounce is sent when the page goes away.
    const wk = st.wk;
    ui.onIdle(() => { if (st && st.wk === wk) wkStart(); });
    ctx.timer(wkTick, 20000);
    const onGone = () => { if (st && st.wk === wk) flushPicks(); };
    window.addEventListener('pagehide', onGone);
    document.addEventListener('visibilitychange', onGone);
    st.cleanups.push(() => { window.removeEventListener('pagehide', onGone); document.removeEventListener('visibilitychange', onGone); });
    const onLens = e => {
      if (!st || !e.detail || e.detail.name !== 'motw-lens') return;
      st.lens = e.detail.value;
      saveLens(st.lens);
      const sub = el.querySelector('.rv-motw-sub');
      if (sub) sub.textContent = lensSub(st.lens);
      patchMotw(true);
    };
    el.addEventListener('ui:change', onLens);
    st.cleanups.push(() => el.removeEventListener('ui:change', onLens));
    ctx.setBackTitle('Rivals');
    // A year header stuck under the nav merges with it (rivals.css): mark it on scroll, once per frame. Headers in
    // skipped (content-visibility) years are never measured.
    const scr = ctx.screen;
    let raf = 0;
    const markStuck = () => {
      raf = 0;
      if (!st || st.ctx !== ctx) return;
      const nav = scr.querySelector(':scope > .nav');
      const line = scr.getBoundingClientRect().top + (nav ? nav.offsetHeight : 44);
      scr.querySelectorAll('.rv-yh').forEach(h => {
        let on = false;
        if (typeof h.checkVisibility !== 'function' || h.checkVisibility({contentVisibilityAuto: true})) {
          const r = h.getBoundingClientRect();
          on = r.height > 0 && r.top <= line && r.bottom > line;
        }
        if (h.classList.contains('is-stuck') !== on) h.classList.toggle('is-stuck', on);
      });
      syncChrome();
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(markStuck); };
    scr.addEventListener('scroll', onScroll, {passive: true});
    st.cleanups.push(() => { scr.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); });
    if (!p.a || !p.b) { chrome(null); return; }
    st.m = model(p.a, p.b);
    grab(el);
    chrome(st.m);
    // Entrance (first mount this session): the stagger starts now; the numbers roll up from 0, the bar grows
    // from the center and a hot streak's flame flickers once the screen is visible (onShow).
    if (ctx.first) {
      st.entrance = true;
      ui.stagger(el);
      if (!ui.RM) el.querySelectorAll('.rv-board .rv-num').forEach(n => { n.textContent = '0'; n._shown = 0; });
    }
    const path = canon(p.a, p.b);
    if (ctx.path !== path) { st.expect = path; ctx.replace(path); }
  },

  onShow(ctx) {
    if (!st || st.ctx !== ctx) return;
    syncChrome();
    if (st.goSec) revealSec();
    if (st.wk && !st.wk.started) wkStart();
    if (st.shown) return;
    st.shown = true;
    if (!st.entrance || !st.m || !st.m.n) return;
    const board = st.r.main && st.r.main.querySelector('.rv-board');
    if (!board) return;
    const t = setTimeout(() => {
      if (!st || st.ctx !== ctx || !board.isConnected) return;
      board.querySelectorAll('.rv-num').forEach(n => rollTo(n, n.dataset.num === 'a' ? st.m.h.aw : st.m.h.bw, true));
      ui.splitIn(board);
      if (st.m.h.streak.n >= 3) flicker(board.querySelector('.rv-flame'));
    }, 140);
    st.cleanups.push(() => clearTimeout(t));
  },

  update(ctx) {
    if (!st || st.ctx !== ctx) return;
    const el = st.el;
    const own = ctx.path === st.expect; // a replace this screen made (a tap, or canonicalizing the URL)
    if (own) st.expect = null;
    const shown = st.m && st.m.b ? canon(st.m.a, st.m.b) : null;
    let via = own ? st.via : null;
    st.via = null;
    let p;
    const sec = own ? null : secOf(ctx.query);
    if (sec) st.goSec = sec;
    if (sec && !ctx.params.a && !ctx.params.b && st.m && st.m.b) {
      // A link to a week section (Today's "This week" card): keep the matchup on screen, scroll to the section.
      p = {a: st.m.a, b: st.m.b};
    } else if (ctx.reason === 'params' || (!own && ctx.path !== shown)) {
      // The second case: app.js folds a pending 'params' into 'me'/'data' for a hidden screen.
      p = resolvePair(ctx.params);
      if (!own) {
        // From outside (a profile's Rivalries link over Rivals, a typed link): handled like a list tap,
        // so the new matchup is brought into view instead of landing far above a scrolled-down page.
        st.isDefault = p.isDefault;
        if (st.m && st.m.b && p.a && p.b && (st.m.a !== p.a || st.m.b !== p.b)) via = 'ext';
      }
    } else if (st.isDefault) {
      // A default pair follows "Which one are you?" and new games. Re-run on 'data' too: a hidden screen's
      // pending 'me' is folded into 'data' when a reload lands before it is shown.
      p = resolvePair({});
    } else {
      p = st.m && data.M[st.m.a] && data.M[st.m.b] ? {a: st.m.a, b: st.m.b} : resolvePair(ctx.params);
    }
    const ok = !!(p.a && p.b);
    if (ok !== !!(st.m && st.m.b)) {
      // The league gained or lost its second manager: render afresh.
      if (st.p2) st.p2();
      el.innerHTML = pageHTML(ok ? model(p.a, p.b) : null);
      st.m = ok ? model(p.a, p.b) : null;
      st.meKey = `${data.me()}|${reigning()}`;
      if (ok) grab(el); else st.r = {};
      chrome(st.m);
    } else if (ok) {
      apply(p, {animate: true, via});
      if (via === 'ext') scrollTop();
    } else {
      chrome(null);
    }
    if (ok) {
      const path = canon(p.a, p.b);
      if (ctx.path !== path) { st.expect = path; ctx.replace(path); }
    }
    // New games or a new schedule re-rank the week (and may move it on); a new "me" moves the you-ring.
    if (ctx.reason === 'data') wkData();
    if (ctx.reason === 'data' || ctx.reason === 'me') patchMotw(false);
    if (ctx.reason === 'me') { replacePickem(); patchPast(false); }
    if (st.goSec) revealSec();
  },

  onHide(ctx) {
    if (st && st.ctx === ctx) flushPicks();
  },

  onAction(id, ctx) {
    if (id !== 'share' || !st || st.ctx !== ctx || !st.m || !st.m.n) return;
    const text = shareText(st.m); // ui.share runs synchronously inside the tap (iOS user activation)
    return ui.share({text}).then(r => {
      if (r === 'copied') ui.toast('Rivalry copied. Paste it in the league chat.', {icon: 'check-circle'});
      else if (r === 'unavailable') ui.toast("Couldn't copy the rivalry.");
    });
  },

  unmount(el, ctx) {
    if (!st || st.ctx !== ctx) return;
    el.removeEventListener('click', onClick);
    flushPicks();
    wkUnsub();
    if (st.wk) { clearTimeout(st.wk.vT); st.wk.sheet = null; } // an open sheet goes with the navigation that unmounts us
    st.cleanups.splice(0).forEach(f => { try { f(); } catch (_) {} });
    if (st.p2) st.p2();
    if (st.seen) st.seen();
    if (st.swapAnims) st.swapAnims.forEach(a => { try { a.cancel(); } catch (_) {} });
    st = null;
  }
};
