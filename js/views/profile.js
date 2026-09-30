// Manager profile (#/managers/:id, spec 7.16). Owner: profile package.
// A push that can sit on any tab. Hero (manager-color wash, 96 px hero avatar that the tapped avatar flies into,
// crowns), all-time tiles with count-ups, the "Every team name" slot reel, seasons, a seed sparkline, best and
// worst games, rivalries, records held, first-round picks and recent trades. Everything derives from league.json,
// except "At the podium" (their Matchup of the Week press conferences: core/press.js + views/press.js, loaded at idle;
// shown only when they have one).
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = data.esc;

// ---------------------------------------------------------------------------------------------- At the podium
// PRESS: the latest subscribePressers payload (shared by every mounted profile); PV: views/press.js once loaded.
// Nothing shows before both are in, for a manager without a presser, or on a failure (the Press Room screen shows
// errors). Each small tile opens that presser in the Press Room (#/press/2026-w4).
let PRESS = null, PV = null, pressP = null;
const loadPress = () => pressP || (pressP = Promise.all([import('../core/press.js'), import('./press.js')]).then(([c, v]) => { PV = v; return c; }, e => { pressP = null; throw e; }));
function podiumSig(id) {
  const list = PRESS && PV && Array.isArray(PRESS.list) ? PRESS.list.filter(p => p && p.who === id) : [];
  return list.map(p => [p.key, p.vid, p.title, p.tall ? 1 : 0].join(':')).join('|');
}
function podiumHTML(id) {
  const list = PRESS && PV && Array.isArray(PRESS.list) ? PRESS.list.filter(p => p && p.who === id) : []; // newest week first
  if (!list.length) return '';
  const n = list.length;
  const tiles = list.map(p => `<a class="pf-pod-it" href="#/press/${esc(encodeURIComponent(p.key))}" aria-label="${esc(`${PV.presserName ? PV.presserName(p) : `Week ${p.week} press conference`}${p.title ? ': ' + p.title : ''}. Opens the Press Room`)}">`
    + PV.tileHTML(p, {size: 's', play: false}) + ui.icon('chevron-right', {cls: 'chev'}) + `</a>`).join('');
  return `<section class="pf-sec pf-podium">${ui.sectionHeader({title: 'At the podium'})}`
    + `<p class="pf-tcount"><span class="n3">${data.nf(n)}</span><span class="pf-tcount-t">${n === 1 ? 'press conference' : 'press conferences'}</span>`
    + `<span class="pf-tcount-s">after losing the Matchup of the Week</span></p>`
    + `<div class="pf-pod">${tiles}</div></section>`;
}
const podiumHost = id => `<div class="pf-pod-host" data-sig="${esc(podiumSig(id))}">${podiumHTML(id)}</div>`;

// ---------------------------------------------------------------------------------------------- Derivations
// Cached per manager id; the cache is dropped whenever data.reload() swaps DATA (and on update 'data').
const cache = new Map();
let cacheOf = null;
function fresh() {
  if (cacheOf !== data.DATA) { cache.clear(); cacheOf = data.DATA; }
}

// Route ids are not validated by the app: accept the id, a different case, or the manager's name.
function resolveId(raw) {
  const s = raw == null ? '' : String(raw);
  if (!s) return null;
  if (data.M[s]) return s;
  const lo = s.toLowerCase();
  if (data.M[lo]) return lo;
  const n = data.norm(s);
  return n ? (data.ids.find(id => data.norm(data.name(id)) === n) || null) : null;
}

const EPS = 1e-9;
const f2 = n => Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const plural = (n, one, many) => `${data.nf(n)} ${n === 1 ? one : (many || one + 's')}`;
const yearsText = ys => ys.slice().sort((a, b) => a - b).join(', ');

function rankIn(pool, id, key) {
  const me = pool.find(x => x.id === id);
  if (!me) return null;
  const v = me[key];
  return {
    rank: pool.filter(x => x[key] > v + EPS).length + 1,
    tied: pool.filter(x => Math.abs(x[key] - v) < EPS).length > 1,
    of: pool.length
  };
}
const rankText = r => r ? `${r.tied ? 'T-' : ''}${ui.ordinal(r.rank)} of ${r.of}` : '';

function derive(id) {
  fresh();
  const hit = cache.get(id);
  if (hit) return hit;
  const at = data.AT.find(x => x.id === id) || {id, w: 0, l: 0, t: 0, pf: 0, pa: 0, gp: 0, po: 0, pw: 0, pl: 0, titles: 0, seconds: 0, lasts: 0, seasons: 0, pct: 0, ppg: 0};

  // Seasons this manager played (a regular-season table row), newest first.
  const played = [];
  data.SEASONS.forEach(s => { const row = s.table.find(r => r.id === id); if (row) played.push({s, row}); });
  const first = played.length ? played[played.length - 1].s.year : null;
  const done = played.filter(p => !p.s.live);
  const titleYears = data.SEASONS.filter(s => s.champion === id).map(s => s.year);
  const secondYears = data.SEASONS.filter(s => s.runnerUp === id).map(s => s.year);
  const lastYears = data.SEASONS.filter(s => s.lastPlace === id).map(s => s.year);
  const reigning = !!(data.DONE[0] && data.DONE[0].champion === id);
  const pool = data.AT.filter(x => x.gp > 0);

  // Seeds (oldest first) for the sparkline. The axis runs 1..league size; the playoff cut is the largest playoff
  // field on record (null before any season has finished: then there is no playoff line to draw).
  const seeds = played.slice().reverse().map(({s, row}) => ({year: s.year, seed: row.seed, live: s.live, champ: s.champion === id, n: s.table.length}));
  const leagueSize = Math.max(2, ...data.SEASONS.map(s => s.table.length));
  const cutMax = data.DONE.length ? Math.max(...data.DONE.map(s => s.playoffTeams.size)) : 0;
  const cut = cutMax > 0 && cutMax < leagueSize ? cutMax : null;

  // Best and worst games (all game types).
  let hi = null, lo = null, bw = null, bl = null;
  data.GAMES.forEach(g => {
    if (g.a !== id && g.b !== id) return;
    const A = g.a === id;
    const x = {g, my: A ? g.sa : g.sb, their: A ? g.sb : g.sa, opp: A ? g.b : g.a};
    const m = x.my - x.their;
    if (!hi || x.my > hi.my) hi = x;
    if (!lo || x.my < lo.my) lo = x;
    if (m > EPS && (!bw || m > bw.m)) bw = Object.assign({m}, x);
    if (m < -EPS && (!bl || -m > bl.m)) bl = Object.assign({m: -m}, x);
  });

  // Rivalries: Owns / Nemesis among opponents with 4+ games (2+ when nobody reaches 4), plus Most played.
  const riv = data.ids.filter(o => o !== id).map(o => {
    const h = data.h2hC(id, o);
    const n = h.games.length;
    const last = h.games.reduce((m, g) => Math.max(m, (Number(g.year) || 0) * 100 + (Number(g.week) || 0)), 0);
    return {id: o, n, w: h.aw, l: h.bw, t: h.t, share: n ? (h.aw + h.t / 2) / n : 0, last};
  }).filter(r => r.n > 0);
  const thr = riv.some(r => r.n >= 4) ? 4 : 2;
  const elig = riv.filter(r => r.n >= thr);
  const better = (a, b) => a.share > b.share + EPS || (Math.abs(a.share - b.share) < EPS && a.n > b.n);
  const worse = (a, b) => a.share < b.share - EPS || (Math.abs(a.share - b.share) < EPS && a.n > b.n);
  let owns = elig.length ? elig.reduce((b, r) => better(r, b) ? r : b) : null;
  let nem = elig.length ? elig.reduce((b, r) => worse(r, b) ? r : b) : null;
  if (owns && nem && owns.id === nem.id) { if (owns.share < .5) owns = null; else nem = null; }
  // Most played: the most games. A tie prefers an opponent not already shown as Owns or Nemesis, then the most
  // recent meeting. When the one most-played opponent is also Owns or Nemesis, that row carries both labels.
  const shown = r => !!((owns && owns.id === r.id) || (nem && nem.id === r.id));
  const morePlayed = (a, b) => a.n !== b.n ? a.n > b.n : shown(a) !== shown(b) ? !shown(a) : a.last > b.last;
  const most = riv.length ? riv.reduce((b, r) => morePlayed(r, b) ? r : b) : null;

  // Records whose holder line names this manager first.
  const flat = data.recordsFlat();
  const primaryIs = m => !!(m && m[0] && m[0].id === id);
  const recs = flat.filter(r => (r.matches || []).some(primaryIs)).map(r => ({
    key: r.key, label: r.label, val: r.val, unit: r.unit,
    lines: r.holders.filter((h, k) => primaryIs(r.matches[k]))
  }));

  // First-round picks, newest first.
  const drafts = data.DATA.drafts || [];
  const picks = [];
  drafts.forEach(d => (d.picks || []).forEach(p => {
    if (p.manager === id && Number(p.round) === 1) picks.push({year: d.year, pick: Number(p.pick) || 0, player: p.player});
  }));
  picks.sort((a, b) => b.year - a.year || a.pick - b.pick);

  // Trades this manager is on a side of, most recent first (array order breaks ties within a week).
  const allTrades = data.DATA.trades || [];
  const trades = allTrades.map((t, i) => ({t, i})).filter(x => (x.t.sides || []).some(s => s.manager === id))
    .sort((a, b) => (b.t.year - a.t.year) || ((Number(b.t.week) || 0) - (Number(a.t.week) || 0)) || (a.i - b.i))
    .map(x => x.t);
  const partners = {};
  trades.forEach(t => t.sides.forEach(s => { if (s.manager !== id) partners[s.manager] = (partners[s.manager] || 0) + 1; }));
  const topPartner = Object.entries(partners).sort((a, b) => b[1] - a[1] || data.name(a[0]).localeCompare(data.name(b[0])))[0] || null;

  const d = {
    id, at, played, first, done, titleYears, secondYears, lastYears, reigning, seeds, cut, leagueSize,
    pctRank: rankIn(pool, id, 'pct'), ppgRank: rankIn(pool, id, 'ppg'),
    hi, lo, bw, bl, owns, nem, most, recs, recTotal: flat.length,
    hasDrafts: drafts.length > 0, picks, hasTrades: allTrades.length > 0, trades, topPartner,
    names: new Set(played.map(p => data.teamIn(p.s, id))).size
  };
  cache.set(id, d);
  return d;
}

// ---------------------------------------------------------------------------------------------- Markup
// est: an estimated height for sections below the first screen. They get content-visibility:auto, so a push lays
// out and paints only the hero, the tiles and the reel before the slide starts (the rest renders as it nears view).
const sec = (title, inner, {action, cls = '', note, est} = {}) =>
  `<section class="pf-sec${cls ? ' ' + cls : ''}${est ? ' is-lazy' : ''}"${est ? ` style="contain-intrinsic-size:auto ${Math.round(est + 32)}px"` : ''}>${ui.sectionHeader({title, action})}${inner}${note ? `<p class="note pf-note">${esc(note)}</p>` : ''}</section>`;

// "210.54" → 210<small>.54</small>; other record values pass through as text.
function valHtml(v) {
  const s = String(v == null ? '' : v);
  const m = /^([−-]?[\d,]+)\.(\d+)$/.exec(s);
  return m ? `${esc(m[1])}<small>.${esc(m[2])}</small>` : esc(s);
}

function crownRow(n) {
  if (!n) return '';
  const shown = Math.min(n, 5);
  const icons = Array.from({length: shown}, () => ui.icon('crown')).join('');
  return `<div class="pf-crowns" role="img" aria-label="${esc(plural(n, 'title'))}">${icons}${n > shown ? `<span class="pf-crowns-n n5">×${n}</span>` : ''}</div>`;
}

function hero(id, d) {
  const c = data.color(id);
  const titles = d.at.titles;
  const nm = data.name(id);
  const tm = data.team(id);
  const since = d.first != null ? `In the league since ${d.first} · ${plural(d.played.length, 'season')}` : 'Yet to play a season.';
  const you = data.me() === id;
  return `<header class="pf-hero ${c.cls}">
    <div class="pf-wash" aria-hidden="true"></div>
    <div class="pf-hero-in">
      <div class="pf-av">${ui.avatar(id, {size: 96, hero: true, champ: titles > 0, label: titles ? `${nm}, ${plural(titles, 'title')}` : nm})}</div>
      ${crownRow(titles)}
      <h1 class="t-1 pf-name" tabindex="-1"><span class="pf-name-t">${esc(nm)}</span><span class="pf-you"${you ? '' : ' hidden'}>${ui.badge('you')}</span></h1>
      <span class="pf-sentinel" data-collapse aria-hidden="true"></span>
      ${tm ? `<p class="pf-team">${esc(tm)}</p>` : ''}
      <p class="pf-since">${esc(since)}</p>
      ${d.reigning ? `<div class="pf-reign">${ui.pill('Reigning champion', {tone: 'gold', icon: 'crown'})}</div>` : ''}
    </div>
  </header>`;
}

// Count-up formats (the integer part counts, decimals snap in at the end, like ui.score).
const recordFmt = (w, l, t) => (v, done) => {
  if (done || !w) return data.recStr(w, l, t);
  const f = Math.max(0, Math.min(1, v / w));
  return data.recStr(Math.round(w * f), Math.round(l * f), Math.round(t * f));
};
const dec1Fmt = (v, done, to) => {
  const [i, dd] = Number(to).toFixed(1).split('.');
  return done ? `${data.nf(Number(i))}<small>.${dd}</small>` : `${data.nf(Math.floor(Math.max(0, v)))}<small style="visibility:hidden">.${dd}</small>`;
};

function tiles(id, d) {
  const a = d.at;
  const k = s => `prof-${id}-${s}`;
  const titleLabel = ui.raw(`${a.titles ? ui.icon('crown', {cls: 'pf-tl-ic'}) : ''}Titles`);
  const big = `<div class="tiles pf-tiles">
    ${ui.statTile({label: titleLabel, countTo: a.titles, format: 'int', key: k('titles'), sub: a.titles ? yearsText(d.titleYears) : 'Still chasing', cls: a.titles ? 'pf-gold' : ''})}
    ${ui.statTile({label: 'Record', countTo: a.w, format: recordFmt(a.w, a.l, a.t), key: k('rec'), sub: 'Regular season'})}
    ${a.gp ? ui.statTile({label: 'Win %', countTo: a.pct, format: 'pct', key: k('pct'), sub: rankText(d.pctRank)}) : ui.statTile({label: 'Win %', value: '—', sub: 'No games yet'})}
    ${a.gp ? ui.statTile({label: 'Pts/game', countTo: a.ppg, format: dec1Fmt, key: k('ppg'), sub: rankText(d.ppgRank)}) : ui.statTile({label: 'Pts/game', value: '—'})}
  </div>`;
  const small = `<div class="tiles tiles-3 pf-tiles3">
    ${ui.statTile({label: 'Playoff trips', countTo: a.po, format: 'int', key: k('po'), sub: d.done.length ? `of ${d.done.length}` : ''})}
    ${ui.statTile({label: 'Runner-ups', countTo: a.seconds, format: 'int', key: k('ru'), sub: a.seconds ? yearsText(d.secondYears) : ''})}
    ${ui.statTile({label: 'Last places', countTo: a.lasts, format: 'int', key: k('last'), sub: a.lasts ? yearsText(d.lastYears) : ''})}
  </div>`;
  return `<div class="pf-stats">${big}${small}</div>`;
}

// "Every team name": one row per season, newest first; each line is a reel window (overflow hidden).
function teamNames(id, d) {
  if (!d.played.length) return '';
  const rows = d.played.map(({s}) => ui.row({
    lead: `<span class="pf-reel pf-yr"><span class="pf-reel-t n5">${s.year}</span></span>`,
    title: ui.raw(`<span class="pf-reel"><span class="pf-reel-t">${esc(data.teamIn(s, id))}</span></span>`),
    cls: 'pf-name-row'
  })).join('');
  const n = d.played.length;
  return sec('Every team name', ui.group(rows, {cls: 'pf-names'}), {note: `${plural(d.names, 'name')} in ${plural(n, 'season')}.`});
}

function seasons(id, d) {
  if (!d.played.length) return sec('Seasons', ui.empty({icon: 'calendar', title: 'No seasons yet.', body: 'Their first season will show up here.'}));
  const rows = d.played.map(({s, row}) => {
    const badge = s.live ? ui.badge('progress') : ui.badge(data.finishOf(s, id));
    const sub = s.live ? `Rank ${row.seed} after wk ${data.throughWeek(s)}` : `Seed ${row.seed} · PF ${f2(row.pf)}`;
    return ui.row({
      lead: `<span class="pf-yr n5">${s.year}</span>`,
      title: data.teamIn(s, id),
      sub,
      trail: `<span class="pf-st"><span class="n4">${esc(data.recStr(row.w, row.l, row.t))}</span>${badge}</span>`,
      chevron: true,
      key: 'y' + s.year,
      cls: 'pf-season',
      attrs: {href: '#/standings/' + s.year}
    });
  }).join('');
  return sec('Seasons', ui.group(rows, {cls: 'pf-seasons'}), {est: 54 + 60 * d.played.length});
}

// Seed by season: an HTML/SVG hybrid so the dots stay round at any width (the line stretches, the dots don't).
function seedChart(id, d) {
  const P = d.seeds;
  if (!P.length) return '';
  const N = Math.max(d.leagueSize, ...P.map(p => p.n));
  const H = 96, pad = 8;
  const X = i => P.length === 1 ? 50 : 4 + i * 92 / (P.length - 1);
  const Y = s => pad + (Math.min(N, Math.max(1, s)) - 1) * (H - 2 * pad) / (N - 1);
  // The dashed playoff line sits between the last seed in and the first seed out.
  const cut = d.cut ? Math.min(N - 1, Math.max(1, d.cut)) : null;
  const cutY = cut ? (Y(cut) + Y(cut + 1)) / 2 : 0;
  const line = P.length > 1 ? `<svg class="pf-svg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline class="pf-line" points="${P.map((p, i) => `${X(i).toFixed(2)},${Y(p.seed).toFixed(2)}`).join(' ')}"/></svg>` : '';
  // Seed labels sit above peaks and below valleys, so they never sit on the line.
  const valley = i => {
    const s = P[i].seed, a = P[i - 1], b = P[i + 1];
    if (!a && !b) return false;
    return (!a || s > a.seed) && (!b || s > b.seed);
  };
  const dots = P.map((p, i) => {
    const st = `left:${X(i).toFixed(2)}%;top:${Y(p.seed).toFixed(2)}px`;
    const lab = p.champ ? `${ui.icon('crown')}<span>${p.seed}</span>` : `<span>${p.seed}</span>`;
    return `<span class="pf-dot${p.live ? ' is-live' : ''}${p.champ ? ' is-champ' : ''}" style="${st}"></span><span class="pf-sl n5${p.champ ? ' is-champ' : ''}${!cut || p.seed <= cut ? '' : ' is-out'}${valley(i) ? ' is-below' : ''}" style="${st}">${lab}</span>`;
  }).join('');
  const every = P.length > 14 ? 2 : 1;
  const short = P.length > 8;
  const xs = P.map((p, i) => (i % every && i !== P.length - 1) ? '' : `<span style="left:${X(i).toFixed(2)}%">${short ? '’' + String(p.year).slice(-2) : p.year}</span>`).join('');
  const label = 'Seeds by season: ' + P.map(p => `${p.year} ${ui.ordinal(p.seed)}${p.champ ? ', champion' : ''}${p.live ? ' so far' : ''}`).join(', ') + (cut ? `. Seeds 1 to ${cut} make the playoffs.` : '.');
  const live = P.some(p => p.live);
  const legend = (cut ? '<span><i class="pf-lg-cut"></i>Playoff line</span>' : '') + (live ? '<span><i class="pf-lg-live"></i>In progress</span>' : '');
  return sec('Seed by season', `<div class="card pf-chart ${data.color(id).cls}" role="img" aria-label="${esc(label)}">
    <div class="pf-plot" aria-hidden="true">
      ${cut ? `<span class="pf-cut" style="top:${cutY.toFixed(2)}px"></span>` : ''}
      ${line}${dots}
      <span class="pf-reveal"></span>
      <span class="pf-yl" style="top:${Y(1).toFixed(2)}px">1</span><span class="pf-yl" style="top:${Y(N).toFixed(2)}px">${N}</span>
    </div>
    <div class="pf-xaxis" aria-hidden="true">${xs}</div>
    ${legend ? `<div class="pf-legend" aria-hidden="true">${legend}</div>` : ''}
  </div>`, {est: 254});
}

function bwTile(label, x, kind, id) {
  if (!x) {
    const none = kind === 'win' ? 'No wins yet' : kind === 'loss' ? 'Never lost' : 'No games yet';
    return `<div class="tile pf-bwt is-none"><span class="tile-label">${esc(label)}</span><span class="tile-value n3">—</span><span class="tile-sub">${none}</span></div>`;
  }
  const g = x.g;
  const v = kind === 'win' ? '+' + ui.score(x.m) : kind === 'loss' ? '−' + ui.score(x.m) : ui.score(x.my);
  const plain = kind === 'win' ? `won by ${f2(x.m)}` : kind === 'loss' ? `lost by ${f2(x.m)}` : f2(x.my);
  const cap = `vs ${data.name(x.opp)}, ${g.year} wk ${g.week}`;
  const aria = `${label}: ${plain}. ${data.name(id)} ${f2(x.my)}, ${data.name(x.opp)} ${f2(x.their)}, ${g.year} week ${g.week}.`;
  return `<a class="tile pf-bwt${kind ? ' is-' + kind : ''}" href="#/standings/${g.year}/weeks/${g.week}" aria-label="${esc(aria)}"><span class="tile-label">${esc(label)}</span>${ui.icon('chevron-right', {cls: 'pf-go'})}<span class="tile-value n3">${v}</span><span class="tile-sub">${esc(cap)}</span></a>`;
}
function bestWorst(id, d) {
  if (!d.hi) return '';
  return sec('Best and worst', `<div class="tiles pf-bw">${bwTile('Highest score', d.hi, '', id)}${bwTile('Lowest score', d.lo, '', id)}${bwTile('Biggest win', d.bw, 'win', id)}${bwTile('Worst loss', d.bl, 'loss', id)}</div>`, {est: 257});
}

// alsoMost: this opponent is also the most played; the row says so instead of showing them twice.
function rivalRow(id, r, label, tone, alsoMost) {
  const rec = data.recStr(r.w, r.l, r.t);
  const st = r.w > r.l ? 'tint' : r.l > r.w ? 'wrong' : 'ink2';
  const games = plural(r.n, 'game');
  const sub = alsoMost
    ? `<span class="pf-rk pf-rk-${tone}">${esc(label)}</span> · <span class="pf-rk pf-rk-most">Most played</span>`
    : `<span class="pf-rk pf-rk-${tone}">${esc(label)}</span> · ${esc(games)}`;
  return ui.row({
    lead: ui.avatar(r.id, {size: 40}),
    title: data.name(r.id),
    sub: ui.raw(sub),
    trail: `<span class="pf-rv"><span class="n4 ${st}">${esc(rec)}</span><span class="pf-bar" aria-hidden="true"><i style="transform:scaleX(${r.share.toFixed(3)})"></i></span></span>`,
    chevron: true,
    cls: 'pf-rival',
    attrs: {href: `#/matchup/${id}-vs-${r.id}`, 'aria-label': `${label}${alsoMost ? ' and most played' : ''}: ${data.name(r.id)}, ${rec} in ${games}`}
  });
}
function rivalries(id, d) {
  const rows = [];
  const dup = x => !!(x && d.most && d.most.id === x.id);
  if (d.owns) rows.push(rivalRow(id, d.owns, d.owns.share > .5 ? 'Owns' : 'Best matchup', 'own', dup(d.owns)));
  if (d.nem) rows.push(rivalRow(id, d.nem, d.nem.share < .5 ? 'Nemesis' : 'Toughest matchup', 'nem', dup(d.nem)));
  if (d.most && !dup(d.owns) && !dup(d.nem)) rows.push(rivalRow(id, d.most, 'Most played', 'most'));
  if (!rows.length) return sec('Rivalries', `<div class="card pf-none"><p class="t-sub ink2">Not enough games against anyone yet.</p></div>`);
  return sec('Rivalries', ui.group(rows.join(''), {cls: 'pf-rivals'}), {est: 36 + 63 * rows.length});
}

function records(id, d) {
  if (!d.recs.length) return '';
  const rows = d.recs.map(r => ui.row({
    title: r.label,
    // One line per holder entry, each wrapping in full: the week and year say when the record was set.
    sub: ui.raw(r.lines.map(l => `<span class="pf-hl">${esc(l)}</span>`).join('')),
    trail: `<span class="pf-val"><span class="n4">${valHtml(r.val)}</span>${r.unit ? `<span class="t-cap">${esc(r.unit)}</span>` : ''}</span>`,
    chevron: true,
    cls: 'pf-rec',
    attrs: {href: '#/league/records/' + r.key}
  })).join('');
  return sec('Records held', ui.group(rows, {cls: 'pf-recs'}), {note: `${d.recs.length} of ${d.recTotal} league records.`, est: 45 + 80 * d.recs.length});
}

function draftCapital(id, d) {
  if (!d.hasDrafts) return '';
  if (!d.picks.length) return sec('Draft capital', `<div class="card pf-none"><p class="t-sub ink2">No first-round picks on record.</p></div>`);
  const rows = d.picks.map(p => {
    const pp = '1.' + String(p.pick).padStart(2, '0');
    return ui.row({
      lead: `<span class="pf-yr n5">${p.year}</span><span class="pf-pick n5">${pp}</span>`,
      title: p.player,
      chevron: true,
      cls: 'pf-draft',
      attrs: {href: `#/draft/${p.year}?m=${encodeURIComponent(id)}`, 'aria-label': `${p.year} · ${pp} · ${p.player}`}
    });
  }).join('');
  return sec('Draft capital', ui.group(rows, {cls: 'pf-drafts'}), {note: 'First-round picks.', est: 62 + 44 * d.picks.length});
}

const listAnd = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
function tradeRow(id, t) {
  const mine = t.sides.find(s => s.manager === id) || {got: []};
  const others = t.sides.filter(s => s.manager !== id).map(s => s.manager);
  const when = Number(t.week) ? `${t.year} wk ${t.week}` : `${t.year} preseason`;
  const got = (mine.got || []).filter(Boolean);
  const lead = others.length > 1 ? ui.avatarStack(others, {max: 2, size: 28}) : ui.avatar(others[0], {size: 32});
  const withTxt = listAnd(others.map(data.name));
  return ui.row({
    lead: `<span class="pf-tlead">${lead}</span>`,
    title: got.length ? got.join(', ') : 'Nothing listed',
    sub: `${when} · with ${withTxt}`,
    chevron: true,
    cls: 'pf-trade',
    attrs: {href: '#/draft/trades?m=' + encodeURIComponent(id), 'aria-label': `${when}, with ${withTxt}. Received ${got.length ? listAnd(got) : 'nothing listed'}.`}
  });
}
function tradesSec(id, d) {
  if (!d.hasTrades) return '';
  const n = d.trades.length;
  if (!n) return sec('Trades', `<div class="card pf-none"><p class="t-sub ink2">No trades yet.</p></div>`);
  const since = d.trades[d.trades.length - 1].year;
  const partner = d.topPartner && d.topPartner[1] > 1 ? ` · most with ${data.name(d.topPartner[0])} (${d.topPartner[1]})` : '';
  const head = `<p class="pf-tcount"><span class="n3">${data.nf(n)}</span><span class="pf-tcount-t">${n === 1 ? 'trade' : 'trades'}</span><span class="pf-tcount-s">since ${since}${esc(partner)}</span></p>`;
  return sec('Trades', head + ui.group(d.trades.slice(0, 3).map(t => tradeRow(id, t)).join(''), {cls: 'pf-trades'}),
    {action: {label: 'See all', href: '#/draft/trades?m=' + encodeURIComponent(id)}, est: 92 + 60 * Math.min(3, n)});
}

// Unknown id: the empty state, plus the whole league one tap away (each avatar flies into its profile).
function unknown() {
  const grid = data.ids.map(id => `<a class="pf-mgr" href="#/managers/${esc(id)}">${ui.avatar(id, {size: 56, attrs: {'data-morph-from': ''}})}<span class="pf-mgr-n">${esc(data.name(id))}</span></a>`).join('');
  return `<div class="pf-unknown">${ui.empty({icon: 'football', title: 'No manager by that name.', action: {label: 'Back', attrs: 'data-back'}})}</div>`
    + (grid ? sec('Managers', `<nav class="pf-mgrs" aria-label="Managers">${grid}</nav>`) : '');
}

function page(id) {
  const d = derive(id);
  return hero(id, d) + tiles(id, d) + teamNames(id, d) + seasons(id, d) + seedChart(id, d) + bestWorst(id, d)
    + rivalries(id, d) + podiumHost(id) + records(id, d) + draftCapital(id, d) + tradesSec(id, d);
}

// A new payload: patch the section in place when this manager's pressers changed.
function patchPodium(st) {
  const host = st && !st.dead && st.el && st.el.isConnected ? st.el.querySelector('.pf-pod-host') : null;
  if (!host || !st.id) return;
  const sig = podiumSig(st.id);
  if (host.dataset.sig === sig) return;
  const was = !!host.firstElementChild;
  host.dataset.sig = sig;
  let html = '';
  try { html = podiumHTML(st.id); } catch (e) { console.error(e); html = ''; }
  host.innerHTML = html;
  if (html && !was && !ui.RM && st.ctx && st.ctx.visible) ui.animate(host, [{opacity: 0}, {opacity: 1}], {duration: 240});
}
function podiumStart(ctx) {
  const st = S.get(ctx);
  if (!st || st.dead || st.pressWant) return;
  st.pressWant = true;
  st.ctx = ctx;
  loadPress().then(pr => {
    if (S.get(ctx) !== st || st.dead || !st.pressWant) return;
    try {
      st.pressUnsub = pr.subscribePressers(u => {
        if (S.get(ctx) !== st || st.dead || !u) return;
        PRESS = u;
        if (st.idleP) st.idleP();
        st.idleP = ui.whenIdle(() => { st.idleP = null; patchPodium(st); });
      });
    } catch (e) { console.error(e); }
  }, e => { console.warn('profile: Press Room unavailable', e); st.pressWant = false; });
}
function podiumEnd(st) {
  if (!st) return;
  if (st.idleP) { st.idleP(); st.idleP = null; }
  if (typeof st.pressUnsub === 'function') { try { st.pressUnsub(); } catch (_) {} }
  st.pressUnsub = null; st.pressWant = false;
}

// ---------------------------------------------------------------------------------------------- Motion
// The avatar that was tapped (still painted on the screen underneath, since the push has not started yet).
// The new screen is lifted out of hit testing for the lookup, so we find the real source element and can start
// the flight in its exact look (deep fill, hero fill, you ring...). Null when it is gone (e.g. a closed sheet).
function sourceAvatar(from, screen) {
  let hit = null;
  const prev = screen.style.pointerEvents;
  try {
    screen.style.pointerEvents = 'none';
    const els = document.elementsFromPoint(from.left + from.width / 2, from.top + from.height / 2);
    hit = els.map(e => e.closest && e.closest('.av')).find(e => e && !screen.contains(e)) || null;
  } catch (_) { hit = null; }
  screen.style.pointerEvents = prev;
  if (!hit) return null;
  const r = hit.getBoundingClientRect();
  return Math.abs(r.width - from.width) < 2 && Math.abs(r.left - from.left) < 2 && Math.abs(r.top - from.top) < 2 ? hit : null;
}
function sourceCopy(src, id) {
  if (!src) return ui.avatar(id, {size: 96});
  const n = src.cloneNode(true);
  [...n.classList].forEach(k => { if (/^av-\d+$/.test(k)) n.classList.remove(k); });
  n.classList.remove('is-pressed');
  n.removeAttribute('id'); n.removeAttribute('role'); n.removeAttribute('aria-label'); n.removeAttribute('data-morph-from');
  n.setAttribute('aria-hidden', 'true');
  n.style.cssText = '--sz:96px';
  n.querySelectorAll('.av-crown').forEach(x => x.remove());
  return n.outerHTML;
}

// The tapped avatar flies into the hero (spec 5.2). A fixed clone of the hero avatar travels from the source rect
// while a copy of the source avatar on top of it fades out and the champion ring fades in, so a 40 px deep-fill
// avatar becomes the 96 px solid hero avatar without a color pop. Translate, scale and opacity only.
function flyIn(from, toEl, srcHtml) {
  if (!from || !toEl || ui.RM || ui.LITE) return;
  const to = toEl.getBoundingClientRect();
  if (!to.width || !from.width || !from.height) return;
  const c = document.createElement('div');
  c.className = 'morph-clone c-pfmorph';
  c.setAttribute('aria-hidden', 'true');
  const champ = toEl.classList.contains('av-champ');
  const heroCopy = toEl.cloneNode(true);
  heroCopy.classList.remove('av-champ');
  heroCopy.removeAttribute('role'); heroCopy.removeAttribute('aria-label'); heroCopy.setAttribute('aria-hidden', 'true');
  c.appendChild(heroCopy);
  c.insertAdjacentHTML('beforeend', `${champ ? '<span class="c-pfmorph-ring"></span>' : ''}<span class="c-pfmorph-src">${srcHtml}</span>`);
  Object.assign(c.style, {left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px'});
  document.body.appendChild(c);
  toEl.style.visibility = 'hidden';
  // .morph-clone uses transform-origin 0 0: map the clone's box onto the source rect.
  const s = from.width / to.width;
  const dx = from.left - to.left, dy = from.top - to.top;
  const fly = ui.animate(c, [{transform: `translate(${dx}px,${dy}px) scale(${s})`}, {transform: 'none'}], {spring: 'smooth'});
  const src = c.querySelector('.c-pfmorph-src');
  ui.animate(src, [{opacity: 1}, {opacity: 0}], {duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'});
  const ring = c.querySelector('.c-pfmorph-ring');
  if (ring) ui.animate(ring, [{opacity: 0}, {opacity: 1}], {duration: 360, delay: 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both'});
  let over = false;
  const done = () => { if (over) return; over = true; c.remove(); toEl.style.visibility = ''; };
  fly.finished.then(done, done);
  setTimeout(done, 2000); // a hidden page produces no frames: never leave the hero avatar invisible
}

// Per-screen state (several profiles can be mounted at once, one per tab), keyed by ctx.
const S = new WeakMap();
const reeled = new Set();   // manager ids whose team-name reel already played this session
const drawn = new Set();    // manager ids whose seed chart already revealed this session

function teardown(st) {
  if (!st) return;
  st.ios.forEach(io => io.disconnect()); st.ios.clear();
  st.timers.forEach(clearTimeout); st.timers.clear();
  st.parked.clear();
  st.anims.forEach(a => { try { a.finish(); } catch (_) {} }); st.anims.clear();
}

// Run fn once the screen is visible and not mid push/pop (the reel is the moment; it should not play under the slide).
// A screen that is not the visible one (covered by a push, or not shown yet) parks the job until onShow.
function whenSettled(st, ctx, fn, tries = 0) {
  if (st.dead) return;
  if (!ctx.visible) { st.parked.add(fn); return; }
  if (ctx.screen.classList.contains('is-animating') && tries < 40) {
    const t = setTimeout(() => { st.timers.delete(t); whenSettled(st, ctx, fn, tries + 1); }, 50);
    st.timers.add(t);
    return;
  }
  fn();
}

function playReel(st, group, id) {
  reeled.add(id);
  if (!ui.RM) {
    [...group.querySelectorAll(':scope > .row')].slice(0, 8).forEach((row, i) => {
      row.querySelectorAll('.pf-reel-t').forEach(t => {
        const a = ui.animate(t, [{transform: 'translateY(105%)'}, {transform: 'none'}], {spring: 'smooth', delay: i * 60, fill: 'backwards'});
        st.anims.add(a);
        const rm = () => st.anims.delete(a);
        a.finished.then(rm, rm);
      });
    });
  }
  group.classList.remove('is-armed');
}

function playChart(st, chart, id) {
  drawn.add(id);
  const cover = chart.querySelector('.pf-reveal');
  if (!cover || ui.RM) { chart.classList.remove('is-armed'); return; }
  const a = ui.animate(cover, [{transform: 'scaleX(1)'}, {transform: 'scaleX(0)'}], {duration: 900, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards'});
  st.anims.add(a);
  const fin = () => { st.anims.delete(a); chart.classList.remove('is-armed'); try { a.cancel(); } catch (_) {} };
  a.finished.then(fin, fin);
}

// The strip at the bottom of the viewport that the tab bar covers (0 when it is hidden or not docked there).
function bottomInset() {
  const tb = document.getElementById('tabbar');
  if (!tb) return 0;
  const r = tb.getBoundingClientRect();
  if (!r.height || r.top >= innerHeight || r.bottom < innerHeight - 1) return 0;
  return Math.max(0, Math.min(Math.round(innerHeight - r.top), Math.round(innerHeight / 2)));
}

// Play `run` once enough of `targets` is on screen above the tab bar, with the screen at rest (the move is the
// moment; it should play where the user can see it, not behind the tab bar or under the push). enough(seen) and
// some(seen) read the latest entry per target. A section left part-way on screen (some, not enough) plays after
// IDLE ms at rest, so a reader who never scrolls further does not keep looking at blank rows.
const IDLE = 2000;
function watch(st, ctx, targets, {enough, some, threshold}, run) {
  const seen = new Map();
  let idle = 0, over = false;
  const stopIdle = () => { if (idle) { clearTimeout(idle); st.timers.delete(idle); idle = 0; } };
  const fire = () => {
    if (over) return;
    over = true; stopIdle();
    io.disconnect(); st.ios.delete(io);
    whenSettled(st, ctx, run);
  };
  const inset = bottomInset() + 16;
  const io = new IntersectionObserver(es => {
    if (!ui.rendered(ctx.screen)) return; // hidden tab layer: nothing to see yet
    es.forEach(e => seen.set(e.target, e));
    if (over) return;
    stopIdle();
    if (enough(seen, inset)) { fire(); return; }
    if (some(seen)) { idle = setTimeout(() => { st.timers.delete(idle); idle = 0; fire(); }, IDLE); st.timers.add(idle); }
  }, {rootMargin: `0px 0px -${inset}px 0px`, threshold});
  st.ios.add(io);
  targets.forEach(t => io.observe(t));
}

const fully = e => e.isIntersecting && e.intersectionRatio >= .99;

// Arm the first-view motion (the hidden start state is set before the first paint) and play it once it is on
// screen with the screen at rest.
function wire(el, ctx, id) {
  let st = S.get(ctx);
  if (!st) { st = {ios: new Set(), timers: new Set(), anims: new Set(), parked: new Set(), dead: false}; S.set(ctx, st); }
  teardown(st);
  st.el = el; st.id = id; st.dead = false;
  if (!id || ui.RM || typeof IntersectionObserver !== 'function') return;
  // The reel: its first min(8, n) rows are the ones that roll. It plays once 3 of them (all of them, when fewer)
  // are fully above the tab bar, so the roll happens in view rather than at the bottom edge.
  const group = el.querySelector('.pf-names');
  const rows = group ? [...group.querySelectorAll(':scope > .row')].slice(0, 8) : [];
  if (rows.length && !reeled.has(id)) {
    group.classList.add('is-armed');
    const need = Math.min(rows.length, 3);
    watch(st, ctx, rows, {
      threshold: [0, .99, 1],
      enough: seen => [...seen.values()].filter(fully).length >= need,
      some: seen => [...seen.values()].some(fully)
    }, () => playReel(st, group, id));
  }
  // The chart wipe: once 60% of the card is above the tab bar (or half the free screen, for a card taller than that).
  const chart = el.querySelector('.pf-chart');
  if (chart && !drawn.has(id)) {
    chart.classList.add('is-armed');
    watch(st, ctx, [chart], {
      threshold: [0, .25, .6, 1],
      enough: (seen, inset) => {
        const e = seen.get(chart);
        return !!e && e.isIntersecting && (e.intersectionRatio >= .6
          || e.intersectionRect.height >= Math.min(e.boundingClientRect.height, (innerHeight - inset) * .5) - 1);
      },
      some: seen => { const e = seen.get(chart); return !!e && e.isIntersecting && e.intersectionRatio >= .25; }
    }, () => playChart(st, chart, id));
  }
}

// ---------------------------------------------------------------------------------------------- View
function paint(el, ctx, id) {
  el.innerHTML = id ? page(id) : unknown();
  wire(el, ctx, id);
}

export default {
  id: 'profile',
  chrome: 'nav',
  title: ctx => {
    const id = resolveId(ctx && ctx.params && ctx.params.id);
    return id ? data.name(id) : 'Manager';
  },
  actions: ctx => resolveId(ctx.params && ctx.params.id) ? [{id: 'share', icon: 'share', label: 'Share this profile'}] : [],

  render(ctx) {
    const id = resolveId(ctx.params.id);
    return id ? page(id) : unknown();
  },

  mount(el, ctx) {
    const id = resolveId(ctx.params.id);
    // The morph reads the hero rect first (the one layout this mount forces); wiring the observers after it is free.
    const from = ctx.transition && ctx.transition.morphFrom;
    const av = id && from && !ui.RM && !ui.LITE && el.querySelector('.pf-av > .av');
    if (av) flyIn(from, av, sourceCopy(sourceAvatar(from, ctx.screen), id));
    wire(el, ctx, id);
    ui.onIdle(() => podiumStart(ctx));
    // Unknown id: picking a manager turns this screen into that profile (replace, so Back skips the bad link).
    el.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('.pf-mgr');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const mid = a.getAttribute('href').replace(/^#\/managers\//, '');
      const src = a.querySelector('.av');
      const st = S.get(ctx);
      if (st && src) st.pending = {rect: src.getBoundingClientRect(), html: sourceCopy(src, mid)};
      ui.haptic('light');
      ctx.replace('/managers/' + mid);
    });
  },

  update(ctx) {
    const st = S.get(ctx);
    const el = (st && st.el && st.el.isConnected) ? st.el : ctx.screen.querySelector(':scope > .screen-body');
    if (!el) return;
    const id = resolveId(ctx.params.id);
    if (ctx.reason === 'me') {
      const you = el.querySelector('.pf-you');
      if (you) you.hidden = !id || data.me() !== id;
      return;
    }
    if (ctx.reason === 'params') {
      if (st && st.id === id && el.querySelector(id ? '.pf-hero' : '.pf-unknown')) return;
      const pending = st && st.pending;
      if (st) st.pending = null;
      // The grid link that had focus is about to be replaced: move focus to the new name, so keyboard and
      // screen-reader users keep their place and hear which profile opened.
      const hadFocus = el.contains(document.activeElement);
      paint(el, ctx, id);
      ctx.screen.scrollTo({top: 0, behavior: 'auto'});
      if (hadFocus) {
        const to = el.querySelector('.pf-name') || ctx.screen;
        try { to.focus({preventScroll: true}); } catch (_) { try { to.focus(); } catch (_) {} }
      }
      const av = id && pending && el.querySelector('.pf-av > .av');
      if (av) flyIn(pending.rect, av, pending.html);
      return;
    }
    // 'data': recompute from the new bindings and patch in place, keeping the scroll position.
    cache.clear(); cacheOf = data.DATA;
    const top = ctx.screen.scrollTop;
    paint(el, ctx, id);
    ctx.screen.scrollTop = top;
  },

  onAction(action, ctx) {
    if (action !== 'share') return;
    const id = resolveId(ctx.params.id);
    if (!id) return;
    const d = derive(id);
    const a = d.at;
    const titles = a.titles ? `${plural(a.titles, 'title')} (${yearsText(d.titleYears)})` : 'No titles';
    const tm = data.team(id);
    const text = `${data.name(id)}${tm ? ' · ' + tm : ''}. ${titles}, ${data.recStr(a.w, a.l, a.t)} in the regular season (${data.pct(a.pct)}).`;
    // ui.share must start synchronously inside this tap (iOS user activation); its fallback copies the text and
    // the link together, so the toast says the profile was copied, not just the link.
    return ui.share({text, url: ui.absLink('/managers/' + id)}).then(r => {
      if (r === 'copied') ui.toast('Profile copied. Paste it in the league chat.', {icon: 'check-circle'});
      else if (r === 'unavailable') ui.toast("Couldn't copy the profile.");
    });
  },

  onShow(ctx) {
    const st = S.get(ctx);
    if (!st || !st.parked.size) return;
    const jobs = [...st.parked];
    st.parked.clear();
    jobs.forEach(fn => whenSettled(st, ctx, fn));
  },

  unmount(el, ctx) {
    const st = S.get(ctx);
    if (st) { st.dead = true; teardown(st); podiumEnd(st); }
  }
};
